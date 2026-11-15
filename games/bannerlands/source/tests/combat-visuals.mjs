import assert from 'node:assert/strict';
import {combatPose,crossbowReloadPose,drawCombatAccents} from '../../combat-visuals.js';
import {Game,HOUSES,UNIT_DEFS} from '../../core.js';
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const visualGame=(time=10)=>({time,unitRange:()=>1.6,config:{fogOfWar:false}});
const soldier=(type='stormbreaker')=>({id:1,type,x:10,y:10,team:0,cooldown:.05,order:{mode:'hold'},target:{id:2,x:10.8,y:10,hp:100},attackVisual:{at:10,cycle:2.1,dx:1,dy:0,distance:.8}});
test('Hammer contact pose and recovery align with the real hit rather than the windup frame',()=>{
  const u=soldier(),def=UNIT_DEFS.stormbreaker;
  assert.equal(combatPose(u,visualGame(10),def).frame,2);assert.equal(combatPose(u,visualGame(10.22),def).frame,3);
  u.attackVisual=null;u.cooldown=.08;const windup=combatPose(u,visualGame(),def);assert.equal(windup.frame,1);assert.ok(windup.windup>0);assert.equal(windup.contact,0);
});
test('Long halberds thrust on contact and retract through their painted recovery frames',()=>{
  const u=soldier('hornhill_halberdier'),def=UNIT_DEFS[u.type];assert.equal(combatPose(u,visualGame(),def).frame,1);
  assert.equal(combatPose(u,visualGame(10.16),def).frame,2);assert.equal(combatPose(u,visualGame(10.25),def).frame,3);
});
test('Crossbows show release, cocking and reload over their actual reload interval',()=>{
  const u=soldier('tollhouse_crossbow'),def=UNIT_DEFS[u.type];
  assert.equal(combatPose(u,visualGame(),def).frame,1);
  u.reload={progress:.35,duration:2.3};u.reloading=true;
  assert.equal(combatPose(u,visualGame(10.13),def).frame,3);
  u.reload.progress=1.8;assert.equal(combatPose(u,visualGame(11),def).frame,3);
  assert.equal(combatPose(u,visualGame(11),def,true),null,'Moving troops cannot freeze in a long stationary reload pose.');
});

test('Each crossbow class animates its own working mechanism from completed reload work',()=>{
  const styles=[];
  for(const type of ['gilded_crossbow','tollhouse_crossbow','sharpshooter']){
    const u=soldier(type);u.reload={progress:1,duration:3};u.reloading=true;u.facingX=1;u.facingY=0;const def=UNIT_DEFS[type];
    const first=crossbowReloadPose(u,def);styles.push(first.style);assert.equal(first.stage,'cock');assert.equal(first.bolt,false);
    assert.equal(crossbowReloadPose(u,def).progress,first.progress,'Game time alone cannot advance reload work.');
    u.reload.progress=2.4;const seating=crossbowReloadPose(u,def);assert.equal(seating.stage,'load');assert.equal(seating.bolt,true);assert.ok(seating.boltSeat>0);
    u.reloading=false;assert.equal(crossbowReloadPose(u,def),null);assert.equal(combatPose(u,visualGame(14),def),null,'An interrupted empty crossbow cannot invent a release or reload from old cooldown time.');
    u.reload.progress=0;u.reloading=true;assert.equal(crossbowReloadPose(u,def).stage,'lower');assert.equal(crossbowReloadPose(u,def).bolt,false);
  }
  assert.deepEqual(styles,['belt','lever','windlass']);
});

test('Reloads draw animated weapons, limbs, strings and separate class mechanisms',()=>{
  const calls=[],context=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args]),set:(target,key,value)=>{target[key]=value;return true;}});
  const drawings=[];
  for(const type of ['gilded_crossbow','tollhouse_crossbow','sharpshooter']){
    const u=soldier(type);u.attackVisual=null;u.reloading=true;u.reload={progress:1,duration:3};u.facingX=1;u.facingY=0;
    calls.length=0;const pose=combatPose(u,visualGame(),UNIT_DEFS[type]);drawCombatAccents(context,u,visualGame(),UNIT_DEFS[type],{x:0,y:0},pose);
    assert.ok(calls.filter(c=>c[0]==='lineTo').length>=15,'Reload needs actual articulated weapon and arms, not a cooldown indicator.');
    drawings.push(JSON.stringify(calls));
    u.reload.progress=1.1;calls.length=0;drawCombatAccents(context,u,visualGame(),UNIT_DEFS[type],{x:0,y:0},combatPose(u,visualGame(),UNIT_DEFS[type]));
    assert.notEqual(JSON.stringify(calls),drawings.at(-1),'The weapon mechanism must move continuously inside one painted frame.');
  }
  assert.equal(new Set(drawings).size,3,'The three mechanisms cannot share the same animation.');
});
test('Hit reactions are cosmetic, distinguish blocked blows and expire on paused game time',()=>{
  const u=soldier();u.attackVisual=null;u.target=null;u.hitVisual={at:10,dx:1,dy:0,blocked:false};
  const before=JSON.stringify(u),normal=combatPose(u,visualGame(10.09),UNIT_DEFS.stormbreaker);assert.equal(JSON.stringify(u),before);assert.ok(normal.dx>0);
  u.hitVisual.blocked=true;assert.ok(combatPose(u,visualGame(10.09),UNIT_DEFS.stormbreaker).dx<normal.dx);assert.equal(combatPose(u,visualGame(10.2),UNIT_DEFS.stormbreaker),null);
});
test('Idle, marching and expired combat poses avoid unnecessary range and visibility queries',()=>{
  const u=soldier();u.attackVisual={...u.attackVisual,at:0};u.target=null;const g=visualGame();g.unitRange=()=>{throw new Error('Idle troops must keep the fast path.');};g.isVisibleTo=()=>{throw new Error('No idle visibility query.');};
  assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null);assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker,true),null);
  u.target={x:11,y:10,hp:100};u.cooldown=1;assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null);
});
test('Fog, expired shocks and explicit orders cannot expose hidden targets or invent windups',()=>{
  const u=soldier();u.attackVisual=null;const g=visualGame();g.config.fogOfWar=true;g.isVisibleTo=()=>false;
  assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null);u.target=null;g.isVisibleTo=()=>{throw new Error('Must not inspect missing target.');};assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null);
  u.team=1;u.target={x:10.8,y:10,hp:100};g.isVisibleTo=team=>team===1;assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null,'Enemy windup cannot reveal a target only its own army sees.');
  u.target={x:10.8,y:10,hp:100};g.config.fogOfWar=false;u.shockUntil=9;assert.ok(combatPose(u,g,UNIT_DEFS.stormbreaker));u.order.mode='move';assert.equal(combatPose(u,g,UNIT_DEFS.stormbreaker),null);
});
test('Simulation strikes still apply identical damage immediately and record the contact direction',()=>{
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:HOUSES.findIndex(h=>h.sigil==='stag'),seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();for(const t of g.tiles){t.terrain='grass';t.feature=null;}for(const s of g.teams){s.count=0;s.alive=true;}
  const u=g.addUnit(0,'stormbreaker',20,20),v=g.addUnit(1,'archer',20.7,20);v.facingX=-1;v.facingY=0;g.hash.rebuild(g.units);const hp=v.hp;g.attack(u,v);
  assert.equal(v.hp,hp-UNIT_DEFS.stormbreaker.damage);assert.equal(u.attackVisual.at,g.time);assert.equal(u.attackVisual.dx,1);assert.equal(u.attackVisual.cycle,u.cooldown);assert.ok(v.knockT>0);assert.equal(v.hitVisual.at,g.time);
  assert.equal(combatPose(u,g,UNIT_DEFS[u.type]).frame,2);
});
console.log(`${checks} combat presentation checks passed.`);
