import assert from 'node:assert/strict';
import {Game,UNIT_DEFS,HOUSES,BUILD_DEFS} from '../../core.js';
import {regimentForHouse,regimentAllowed,migrateLegacyRegiments} from '../../regiments.js';
import {sweptWeaponContact} from '../../tactical-combat.js';
import {placeFormation,updatePlacedFormations} from '../../formation-placement.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g=new Game({landscape:'open',enemies:1,house:1,seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;t.height=0;}
  for(const s of g.teams){s.count=0;s.alive=true;s.upgrades.weapons=0;s.upgrades.armor=0;s.aiClock=1e9;}
  g.navigation.invalidate();g.regimentSchemaVersion=2;return g;
}
function step(g,seconds,dt=.025){for(let i=0;i<Math.ceil(seconds/dt);i++){g.time+=dt;g.hash.rebuild(g.units);g.updateUnits(dt);g.updateProjectiles(dt);}}
function pair(type){const g=fixture(),u=g.addUnit(0,type,30,30),v=g.addUnit(1,'cavalry',34,30);v.hp=v.maxHp=10000;v.cooldown=1e9;g.hold([u.id,v.id]);v.facingX=0;v.facingY=1;v.order.facingX=0;v.order.facingY=1;u.cooldown=0;g.hash.rebuild(g.units);return {g,u,v};}
const specs=[['gilded_crossbow',60,3,1.8],['tollhouse_crossbow',72,3.6,2],['sharpshooter',100,5,2],['vale_sentinel',64,3.2,1.9]];

test('Four crossbows use exact impact and reload targets, release once at the firing frame, and apply cavalry bonus once',()=>{
  for(const [type,damage,reload,bonus]of specs){
    const {g,u,v}=pair(type),d=UNIT_DEFS[type];assert.equal(d.damage,damage);assert.equal(d.rate,reload);assert.equal(d.cavalryBonus,bonus);
    g.attack(u,v);assert.equal(g.projectiles.length,0);assert.equal(u.crossbowState,'aiming');
    step(g,.2);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].type,'bolt');assert.equal(v.hp,v.maxHp);
    for(let i=0;i<5;i++)g.attack(u,v);assert.equal(g.projectiles.length,1,'Unloaded weapons cannot duplicate releases.');
    g.updateProjectiles(2);assert.ok(Math.abs(v.maxHp-v.hp-damage*bonus)<1e-6,type);
    assert.equal(u.reload.duration,reload);
  }
});
test('Completed reload stages survive movement; unfinished stage work is discarded and resumes after arrival',()=>{
  const {g,u,v}=pair('sharpshooter');g.attack(u,v);step(g,.2);u.target=null;v.hp=0;
  step(g,3.5);assert.equal(u.reload.stage,'retrieve');const completed=.65*u.reload.duration;
  g.command([u.id],27,30,'move','spread');assert.equal(u.reload.progress,completed);assert.equal(u.reloading,false);
  step(g,.5);assert.equal(u.reload.progress,completed);assert.ok(u.x<29.8);
  step(g,3);assert.ok(!u.reload||u.reload.progress>completed);
  step(g,2);assert.equal(u.reload,null);assert.equal(u.crossbowState,'loaded');
});
test('Loaded crossbows remain loaded while travelling; a cancelled aim does not spend a bolt',()=>{
  const {g,u,v}=pair('vale_sentinel');g.attack(u,v);step(g,.05);g.command([u.id],25,30,'move','spread');
  assert.equal(u.crossbowAim,null);assert.equal(u.reload,undefined);step(g,.5);assert.equal(g.projectiles.length,0);assert.equal(u.reload,undefined);
});
test('Collision jitter preserves work, whereas real knockback resets only the incomplete stage',()=>{
  const {g,u,v}=pair('gilded_crossbow');g.attack(u,v);step(g,.2);v.hp=0;u.reload.progress=2.2;u.vx=.04;u.reloadX=u.x-.002;
  g.updateCrossbowReload(u,.025);assert.ok(u.reload.progress>2.2);
  u.knockT=.2;g.updateCrossbowReload(u,.025);assert.ok(Math.abs(u.reload.progress-1.95)<1e-7);assert.equal(u.reload.stage,'retrieve');
});
test('Pikemen replace only Stark and Tyrell Shield Bearers and retain their own facilities',()=>{
  assert.equal(regimentForHouse('wolf'),'winter_pikeman');assert.equal(regimentForHouse('rose'),'thornwall_pikeman');
  assert.equal(regimentForHouse('lion'),'shield_bearer');assert.equal(regimentForHouse('dragon'),'shield_bearer');
  for(const type of ['winter_pikeman','thornwall_pikeman']){assert.equal(UNIT_DEFS[type].shieldType,undefined);assert.ok(UNIT_DEFS[type].spearBrace);}
  assert.equal(regimentAllowed('shield_bearer','wolf'),false);assert.equal(BUILD_DEFS.winter_pike_hall.unit,'winter_pikeman');assert.equal(BUILD_DEFS.thornwall_pavilion.unit,'thornwall_pikeman');assert.equal(UNIT_DEFS.winter_guard.shieldType,'small');assert.equal(UNIT_DEFS.dread_pike.shieldType,undefined,'Two-handed Dread Pikes carry no shield.');
});
test('Legacy migration preserves health percentage, upgrades, orders, IDs and control group membership',()=>{
  const order={mode:'move',x:45,y:32,facingX:1,facingY:0},groups=new Map([['1',[7]]]);
  const old={teams:[{sigil:'wolf',upgrades:{armor:3}},{sigil:'rose'},{sigil:'lion'}],units:[{id:7,team:0,type:'shield_bearer',hp:195,maxHp:390,order},{id:8,team:1,type:'shield_bearer',hp:130,maxHp:260},{id:9,team:2,type:'shield_bearer',hp:130,maxHp:260},{id:10,team:0,type:'winter_guard',hp:100,maxHp:212}],buildings:[{type:'winter_shield_hall'},{type:'rose_guard_pavilion'}],groups};
  migrateLegacyRegiments(old,UNIT_DEFS);assert.equal(old.units[0].hp/old.units[0].maxHp,.5);assert.equal(old.units[0].maxHp,UNIT_DEFS.winter_pikeman.hp*1.5);assert.equal(old.units[0].order,order);assert.equal(old.units[0].id,7);assert.equal(old.groups,groups);assert.equal(old.teams[0].upgrades.armor,3);assert.equal(old.units[2].type,'shield_bearer');assert.equal(old.units[3].type,'winter_guard');
  const before=JSON.stringify(old);migrateLegacyRegiments(old,UNIT_DEFS);assert.equal(JSON.stringify(old),before);
});
function prepared(g,type='winter_pikeman',x=40,y=40){const p=g.addUnit(0,type,x,y);p.facingX=-1;p.facingY=0;g.hold([p.id]);p.order.facingX=-1;p.order.facingY=0;p.braceDir={x:-1,y:0};p.braceTime=.5;p.spearState='braced';return p;}
function sweep(g,p,{from={x:36,y:40},to={x:39,y:40}}={}){const h=g.addUnit(1,'cavalry',from.x,from.y);h.chargeDir={x:1,y:0};h.momentum=1;h.charging=true;h.chargeElapsed=0;h.chargeEnd={x:50,y:40};h.x=to.x;h.y=to.y;g.hash.rebuild(g.units);g.interceptSpears(h,from.x,from.y);return h;}
test('Swept forward pike contact stops a fast horse before body impact and produces one discrete event',()=>{
  const g=fixture(),p=prepared(g),h=sweep(g,p);assert.ok(h.chargeBlockedUntil>g.time);assert.equal(h.charging,false);assert.ok(h.x<38.1,'Pike reach, not a body-radius aura, determines contact.');const hp=h.hp;h.charging=true;h.momentum=1;h.x=39;g.interceptSpears(h,36,40);assert.equal(h.hp,hp);
  assert.ok(sweptWeaponContact({x:36,y:40},{x:42,y:40},p,2.1,.25));
});
test('Flanks, rear, gaps, walls and unrelated friendly bodies never receive a remote brace penalty',()=>{
  for(const scenario of ['flank','rear','gap','wall','body']){
    const g=fixture(),p=prepared(g);let args;
    if(scenario==='flank')args={from:{x:39,y:36},to:{x:39,y:42}};
    if(scenario==='rear')args={from:{x:44,y:40},to:{x:41,y:40}};
    if(scenario==='gap')args={from:{x:36,y:41},to:{x:39,y:41}};
    if(scenario==='wall'){for(let y=0;y<g.H;y++)g.tiles[y*g.W+39].terrain='water';g.navigation.invalidate();}
    if(scenario==='body')g.addUnit(0,'infantry',39,40);
    const h=sweep(g,p,args);assert.equal(h.hp,h.maxHp,scenario);assert.equal(h.chargeBlockedUntil,undefined,scenario);
  }
});
test('Bracing requires half a second per soldier, and actual turning or displacement removes readiness',()=>{
  const g=fixture(),p=prepared(g);p.braceTime=0;p.spearState='forming';
  g.updateDefensiveReadiness(p,.25);assert.equal(p.spearState,'lowering');g.updateDefensiveReadiness(p,.25);assert.equal(p.spearState,'braced');
  p.order.facingX=0;p.order.facingY=1;g.updateDefensiveReadiness(p,.025);assert.equal(p.spearState,'turning');assert.equal(p.braceTime,0);
  p.knockT=.2;g.updateDefensiveReadiness(p,.025);assert.equal(p.spearState,'disrupted');
});
test('Blocked formation slots never acquire full brace readiness at a substitute position',()=>{
  const g=fixture(),p=prepared(g);p.order.slotBlocked=true;p.braceTime=0;
  g.updateDefensiveReadiness(p,1);assert.equal(p.braceTime,0);assert.equal(p.spearState,'forming');
});
test('Moving presented spears reduce only contacted momentum and cannot claim full planted-brace protection',()=>{
  const g=fixture(),p=prepared(g);p.order.mode='advance';p.spearState='moving';p.braceTime=0;p.vx=.8;
  const h=sweep(g,p);assert.ok(Math.abs(h.momentum-.7)<1e-6);assert.equal(h.charging,true);assert.equal(h.chargeBlockedUntil,undefined);
});
test('Rear spear ranks contribute only within finite reach and a bounded aligned lane',()=>{
  const g=fixture(),p=prepared(g,'winter_pikeman',42,40),point={x:39.8,y:40};
  for(const x of [40.4,40.9,41.4])prepared(g,'winter_pikeman',x,40);
  g.hash.rebuild(g.units);assert.equal(g.spearLaneClear(p,point),true);
  prepared(g,'winter_pikeman',41.8,40);g.hash.rebuild(g.units);assert.equal(g.spearLaneClear(p,point),false,'Pikes cannot attack through arbitrarily many friendly ranks.');
});
test('Heavy and small shields use exactly one directional modifier and require an authored active guard',()=>{
  for(const [type,front,rear]of [['shield_bearer',25,150],['winter_guard',60,125]]){
    const g=fixture(),u=g.addUnit(0,type,40,40);u.facingX=1;u.facingY=0;u.shieldGuard='guard';
    const hit=(x,y,extra={})=>{u.hp=u.maxHp=1000;g.damage(u,100,{team:1,type:'infantry',impactKind:'weapon',projectileType:'bolt',originX:x,originY:y,...extra});return 1000-u.hp;};
    assert.equal(hit(45,40),front);assert.equal(hit(40,45),100);assert.equal(hit(35,40),rear);assert.equal(hit(35,40,{projectileType:null}),rear,'Older melee rear bonus must not stack.');
    assert.equal(hit(35,40,{travelX:-1,travelY:0}),front,'Projectile direction at impact is authoritative.');
    u.shieldGuard='lowered';assert.equal(hit(45,40),100);u.shieldGuard='guard';assert.equal(hit(45,40,{secondary:true}),100);assert.equal(hit(45,40,{projectileType:'rock'}),100);
  }
});
test('A decorative Vale back shield never supplies guard protection',()=>{
  const g=fixture(),u=g.addUnit(0,'vale_sentinel',40,40);u.shieldGuard='guard';u.facingX=1;u.facingY=0;const hp=u.hp;g.damage(u,100,{team:1,type:'infantry',impactKind:'weapon',projectileType:'bolt',originX:45,originY:40});assert.equal(hp-u.hp,100);
});
test('Two-handed pikes never inherit shield reductions, even from obsolete saved shield fields',()=>{
  for(const type of ['winter_pikeman','thornwall_pikeman','dread_pike']){
    const g=fixture(),u=prepared(g,type);u.shieldType='heavy';u.shieldGuard='guard';
    const hp=u.hp;g.damage(u,100,{team:1,type:'archer',impactKind:'weapon',projectileType:'bolt',originX:35,originY:40});assert.equal(hp-u.hp,100,type);
  }
});
test('AI cavalry takes a physical flank route around a visible braced lane without changing the commanded order',()=>{
  const g=fixture(),p=prepared(g),horse=g.addUnit(1,'cavalry',36,40),target=g.addUnit(0,'archer',42,40);
  horse.order={mode:'attack',x:48,y:40};g.hash.rebuild(g.units);
  const before={...horse.order},point=g.aiCavalryApproach(horse,target);
  assert.notEqual(point,target);assert.ok(Math.abs(point.y-p.y)>=1.5);assert.deepEqual(horse.order,before);assert.equal(horse.charging,false);
  assert.ok(g.navigation.clearSegment(horse,point,horse.radius));
});
test('Halberd physical attacks alternate authored thrust and swing actions without adding damage events',()=>{
  const g=fixture(),u=g.addUnit(0,'hornhill_halberdier',30,30),v=g.addUnit(1,'archer',31,30);v.hp=v.maxHp=1000;
  g.hash.rebuild(g.units);const actions=[];
  for(let i=0;i<3;i++){g.attack(u,v);actions.push(u.attackVisual.action);}
  assert.deepEqual(actions,['thrust','swing','thrust']);assert.equal(g.stats.battles,3);assert.equal(u.weaponSwings,3);
});
test('Moving from guard selects a brief authored lowering pose while the movement order starts immediately',()=>{
  const g=fixture(),u=g.addUnit(0,'shield_bearer',30,30);u.shieldGuard='guard';
  g.command([u.id],35,30,'move','spread');assert.equal(u.order.mode,'move');assert.equal(u.shieldGuard,'lowered');assert.equal(u.shieldLowerUntil,.14);
  step(g,.05);assert.ok(u.x>30);assert.ok(u.shieldLowerUntil>g.time);
});
test('Hold preserves placed slots and facing settings, including casualty filling after an interrupted march',()=>{
  const g=fixture(),troops=Array.from({length:8},(_,i)=>g.addUnit(0,'winter_pikeman',30+i%4*.5,30+Math.floor(i/4)*.5));
  const result=placeFormation(g,troops.map(u=>u.id),{x:45,y:40,angle:0,preset:'pike',ranks:2,lockFacing:true},UNIT_DEFS);assert.equal(result.ok,true);
  const c=result.formation,indices=troops.map(u=>u.order.slotIndex);g.hold(troops.map(u=>u.id));
  assert.deepEqual(troops.map(u=>u.order.slotIndex),indices);assert.ok(troops.every(u=>u.order.placementId===c.id&&u.order.formationPreset==='pike'&&u.order.lockFacing));
  assert.ok(c.x<33&&c.y<32,'The stopped cohort must not retain its distant travel destination.');
  const front=troops.find(u=>u.order.slotBack<0),gap=c.slots.find(s=>s.index===front.order.slotIndex),point={x:gap.x,y:gap.y};front.hp=0;g.time+=.3;updatePlacedFormations(g,.3,UNIT_DEFS);
  const replacement=troops.find(u=>u.hp>0&&u.order.slotIndex===gap.index);assert.ok(replacement);assert.equal(replacement.order.x,point.x);assert.equal(replacement.order.y,point.y);assert.ok(replacement.order.x<34);
});
console.log(`${checks} tactical combat checks passed.`);
