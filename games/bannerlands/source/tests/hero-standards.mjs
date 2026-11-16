import assert from 'node:assert/strict';
import {Game} from '../../core.js';
import {heroProfile} from '../../heroes.js';
import {aiStandards} from '../../battle-standards.js';

let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function fixture(house=0,extra={}){
  const g=new Game({house,enemies:1,scale:'standard',landscape:'open',seed:44277,...extra});
  const heroes=g.units.filter(u=>u.type==='hero');g.units=heroes;g.byId=new Map([...g.buildings,...heroes,...g.standards].map(u=>[u.id,u]));
  for(const t of g.teams){t.aiClock=1e9;t.heroTimer=0;t.count=1;t.powerReadyAt=1e9;}
  for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;if(b.team===0&&b.type==='keep'){b.x=34;b.y=34;}}
  const h=g.heroFor(0);h.x=40;h.y=40;g.hold([h.id]);h.cooldown=1e9;
  for(const other of heroes)if(other!==h){other.x=70;other.y=70;g.hold([other.id]);other.cooldown=1e9;}
  for(let y=25;y<55;y++)for(let x=25;x<60;x++){const t=g.tileAt(x,y);t.terrain='grass';t.feature=null;}
  g.navigation.invalidate();g.hash.rebuild(g.units);g.updateStandards(0);return {g,h,s:g.standardFor(0)};
}
function step(g,seconds){for(let time=0;time<seconds-1e-8;time+=.025)g.update(Math.min(.025,seconds-time));}
function handling(g,h){g.update(.025);assert.equal(h.standardAction?.phase,'handling');}
function plant(g,h,x=h.x,y=h.y){assert.equal(g.plantStandard(h.id,x,y).ok,true);handling(g,h);step(g,3);assert.equal(g.standardFor(h.team).state,'planted');}
function atKeep(g,h){const keep=g.buildings.find(b=>b.team===h.team&&b.type==='keep');h.x=keep.x+g.buildingRadius(keep)+h.radius+.25;h.y=keep.y;g.hold([h.id]);g.hash.rebuild(g.units);return keep;}
function kill(g,h){g.damage(h,1e6,{team:1,type:'infantry',impactKind:'weapon',originX:h.x+1,originY:h.y});}

test('Every army begins with one independently owned physical standard and a faction hero',()=>{
  const {g,h,s}=fixture();assert.equal(g.standards.length,g.teams.length);assert.ok(s.id<0);assert.ok(g.units.every(u=>u.id>0));assert.equal(s.carrierId,h.id);assert.equal(s.heroId,h.id);assert.equal(s.hp,300);assert.equal(h.heroMode,'carrying');assert.equal(h.heroProfile,'wolf');
  assert.equal(g.addUnit(0,'hero',20,20),h);assert.equal(g.units.filter(u=>u.team===0&&u.type==='hero').length,1);
});
test('Planting consumes three seconds after arrival and leaves a separate fixed world object',()=>{
  const {g,h,s}=fixture();const x=h.x,y=h.y;assert.equal(g.plantStandard(h.id,x,y).ok,true);handling(g,h);step(g,2.9);assert.equal(s.state,'planting');assert.equal(s.carrierId,h.id);assert.equal(h.heroMode,'carrying');step(g,.1);assert.equal(s.state,'planted');assert.equal(s.carrierId,null);assert.equal(h.heroMode,'signature');g.command([h.id],46,40,'move','spread');step(g,2);assert.ok(h.x>x+1);assert.equal(s.x,x);assert.equal(s.y,y);
});
test('Cancel planting at 2.9 seconds keeps exactly the same carried standard and responds to movement',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,h.x,h.y);handling(g,h);step(g,2.9);g.command([h.id],46,40,'move','spread');assert.equal(h.standardAction,null);assert.equal(h.standardVisual.phase,'abort');assert.equal(s.state,'carrying');assert.equal(s.carrierId,h.id);step(g,.3);assert.ok(h.x>40);assert.equal(g.standardFor(0).id,s.id);assert.equal(g.standards.filter(b=>b.team===0).length,1);
});
test('Repeated commands preserve progress while a replacement planting position changes the actual goal',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,40,40);handling(g,h);step(g,1);const progress=h.standardAction.progress;g.plantStandard(h.id,40,40);assert.equal(h.standardAction.progress,progress);g.plantStandard(h.id,45,40);assert.equal(h.standardAction.phase,'travel');assert.equal(h.standardAction.x,45);assert.equal(s.state,'carrying');
});
test('Retrieve travels to the real post; two seconds of handling never run remotely',()=>{
  const {g,h,s}=fixture();plant(g,h);h.x=48;h.y=40;g.hold([h.id]);assert.equal(g.retrieveStandard(h.id).ok,true);step(g,1);assert.equal(h.standardAction.phase,'travel');assert.equal(h.standardAction.progress,0);assert.equal(s.state,'planted');for(let i=0;i<1000&&h.standardAction?.phase==='travel';i++)g.update(.025);assert.equal(h.standardAction.phase,'handling');assert.ok(Math.hypot(h.x-s.x,h.y-s.y)<=.6);step(g,1.9);assert.equal(s.state,'picking-up');step(g,.1);assert.equal(s.state,'carrying');assert.equal(s.carrierId,h.id);
});
test('Cancel pickup at 1.9 seconds preserves ground identity, health and resumed planted benefit',()=>{
  const {g,h,s}=fixture();plant(g,h);s.hp=174;g.retrieveStandard(h.id);handling(g,h);step(g,1.9);g.cancelStandard(h.id);assert.equal(s.state,'planted');assert.equal(s.carrierId,null);assert.equal(s.hp,174);assert.equal(s.dormant,false);assert.equal(h.heroMode,'signature');assert.equal(g.standardStatus(h.id).benefit.name,heroProfile('wolf').planted.name);
});
test('Blocked placement and retrieval routes fail without moving a pole or completing interaction',()=>{
  const {g,h,s}=fixture();assert.equal(g.plantStandard(h.id,-2,40).ok,false);assert.equal(h.standardAction,null);plant(g,h);h.x=48;h.y=40;g.hold([h.id]);for(let y=1;y<g.H-1;y++)g.tileAt(44,y).terrain='water';g.navigation.invalidate();assert.equal(g.retrieveStandard(h.id).ok,false);step(g,5);assert.equal(s.state,'planted');assert.equal(s.x,40);assert.equal(s.carrierId,null);
});
test('Heroes cannot attack while handling; carried and free-hand weapon profiles are different',()=>{
  const {g,h}=fixture(7);const foe=g.addUnit(1,'cavalry',41,40);foe.hp=foe.maxHp=10000;h.facingX=1;h.facingY=0;
  assert.equal(g.isRanged(h),false);g.attack(h,foe);assert.equal(g.projectiles.length,0);const before=foe.hp;g.plantStandard(h.id,h.x,h.y);handling(g,h);g.attack(h,foe);assert.equal(foe.hp,before);assert.equal(g.projectiles.length,0);foe.x=70;foe.y=71;g.hold([foe.id]);foe.cooldown=1e9;step(g,3);assert.equal(g.isRanged(h),true);assert.equal(g.unitDefinition(h).crossbow,true);assert.equal(g.unitDefinition(h).cavalryBonus,1.9);
});
test('Hero crossbow bolts carry their own cavalry multiplier through weapon stowing and movement',()=>{
  const {g,h}=fixture(7);plant(g,h);const foe=g.addUnit(1,'cavalry',42,40);foe.hp=foe.maxHp=10000;foe.facingX=0;foe.facingY=1;h.facingX=1;h.facingY=0;h.vx=h.vy=0;g.attack(h,foe);assert.ok(h.crossbowAim);g.updateCrossbowAim(h,.2);assert.equal(g.projectiles.length,1);const bolt=g.projectiles[0];assert.equal(bolt.crossbow,true);assert.equal(bolt.cavalryBonus,1.9);h.heroMode='carrying';g.updateProjectiles(3);assert.ok(Math.abs(foe.maxHp-foe.hp-66*1.9)<1e-8);
});
test('Carried shields provide no block; equipped signature shields must finish their guard action',()=>{
  const {g,h}=fixture();h.shieldGuard='guard';h.facingX=1;h.facingY=0;let before=h.hp;g.damage(h,100,{team:1,type:'archer',impactKind:'weapon',projectileType:'arrow',originX:42,originY:40});assert.equal(before-h.hp,100);plant(g,h);step(g,.35);before=h.hp;g.damage(h,100,{team:1,type:'archer',impactKind:'weapon',projectileType:'arrow',originX:42,originY:40});assert.equal(before-h.hp,25);
});
test('Death carrying or planting drops one standard at the death position',()=>{
  for(const planting of [false,true]){const {g,h,s}=fixture();if(planting){g.plantStandard(h.id,40,40);handling(g,h);step(g,2.9);}kill(g,h);assert.equal(s.state,'fallen');assert.equal(s.carrierId,null);assert.equal(s.dormant,true);assert.equal(s.x,h.x);assert.equal(s.y,h.y);assert.equal(g.teams[0].heroTimer,35);assert.equal(g.standards.filter(b=>b.team===0).length,1);}
});
test('Death while planted or picking up leaves the same ground standard dormant',()=>{
  for(const pickup of [false,true]){const {g,h,s}=fixture();plant(g,h);if(pickup){g.retrieveStandard(h.id);handling(g,h);step(g,1.9);}else{h.x=45;h.y=40;g.hold([h.id]);}kill(g,h);assert.equal(s.state,'planted');assert.equal(s.x,40);assert.equal(s.y,40);assert.equal(s.dormant,true);assert.equal(s.carrierId,null);}
});
test('A killing projectile in the final handling step wins over the completion event',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,40,40);handling(g,h);step(g,2.975);g.projectiles.push({sx:41,sy:40,x:41,y:40,tx:40,ty:40,t:0,duration:.001,type:'arrow',team:1,target:h.id,damage:1e6,splash:0});g.update(.025);assert.ok(h.hp<=0);assert.equal(s.state,'fallen');assert.equal(s.carrierId,null);
});
test('Normal hero return neither duplicates nor remotely reactivates the recoverable standard',()=>{
  const {g,h,s}=fixture();plant(g,h);s.hp=143;kill(g,h);step(g,34.9);assert.equal(g.heroFor(0),null);step(g,.15);const returned=g.heroFor(0);assert.ok(returned);assert.notEqual(returned.id,h.id);assert.equal(returned.heroMode,'signature');assert.equal(s.heroId,returned.id);assert.equal(s.state,'planted');assert.equal(s.dormant,true);assert.equal(s.hp,143);assert.equal(g.standards.filter(b=>b.team===0).length,1);assert.equal(g.reforgeStandard(returned.id).ok,false);
});
test('A genuinely absent standard is not minted for free when a hero returns',()=>{
  const {g,h,s}=fixture();kill(g,h);g.standards=g.standards.filter(b=>b!==s);g.byId.delete(s.id);step(g,35.05);const returned=g.heroFor(0);assert.ok(returned);assert.equal(returned.heroMode,'signature');assert.equal(g.standardFor(0),null);atKeep(g,returned);assert.equal(g.reforgeStandard(returned.id).ok,true);handling(g,returned);step(g,7.9);assert.equal(g.standardFor(0),null);step(g,.1);assert.equal(g.standardFor(0).state,'carrying');assert.equal(g.standardFor(0).carrierId,returned.id);
});
test('Fallen standards require the full crouch-and-lift pickup and retain their damage',()=>{
  const {g,h,s}=fixture();s.hp=91;kill(g,h);step(g,35.05);const returned=g.heroFor(0);returned.x=s.x;returned.y=s.y;g.hold([returned.id]);assert.equal(g.retrieveStandard(returned.id).ok,true);assert.equal(returned.standardAction.fallen,true);handling(g,returned);step(g,1.9);assert.equal(s.carrierId,null);step(g,.1);assert.equal(s.carrierId,returned.id);assert.equal(s.hp,91);
});
test('Ordinary hits hurt a handling hero without resetting interaction progress',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,40,40);handling(g,h);for(let i=0;i<30;i++){g.damage(h,1,{team:1,type:'archer',impactKind:'weapon',projectileType:'arrow',originX:42,originY:40});step(g,.1);}assert.ok(h.hp<800);assert.equal(s.state,'planted');assert.equal(s.carrierId,null);
});
test('A short hard interruption cannot expire within a step and accidentally finish planting',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,40,40);handling(g,h);step(g,2.975);h.knockT=.001;h.knockDuration=.2;h.knockVX=.1;g.update(.025);assert.equal(h.standardAction,null);assert.equal(s.state,'carrying');assert.equal(s.carrierId,h.id);
});
test('Dormant pickup and replant are required to restore a fallen hero’s planted benefit',()=>{
  const {g,h,s}=fixture();plant(g,h);kill(g,h);step(g,35.05);const returned=g.heroFor(0);returned.x=40;returned.y=40;g.hold([returned.id]);g.retrieveStandard(returned.id);handling(g,returned);step(g,2);assert.equal(s.dormant,false);assert.equal(s.state,'carrying');plant(g,returned);assert.equal(s.state,'planted');assert.equal(s.dormant,false);
});
test('Ground standards permit deliberate attacks but never attract ordinary target acquisition',()=>{
  const {g,h,s}=fixture();plant(g,h);h.x=55;h.y=45;g.hold([h.id]);const enemy=g.addUnit(1,'infantry',40.5,40);g.hold([enemy.id]);g.hash.rebuild(g.units);assert.notEqual(g.findTarget(enemy)?.id,s.id);assert.equal(g.attackTarget([enemy.id],s.id).ok,true);g.damage(s,500,{team:1,type:'infantry',impactKind:'weapon'});assert.equal(s.state,'destroyed');assert.equal(s.hp,0);assert.equal(s.dormant,true);assert.equal(g.retrieveStandard(h.id).ok,false);assert.equal(g.standards.length,g.teams.length);
});
test('The carried standard has no independent enemy hitbox',()=>{
  const {g,h,s}=fixture();const enemy=g.addUnit(1,'infantry',41,40);assert.equal(g.attackTarget([enemy.id],s.id).ok,false);g.damage(s,999,{team:1,type:'infantry',impactKind:'weapon'});assert.equal(s.hp,300);assert.equal(s.carrierId,h.id);
});
test('Refit needs eight uninterrupted seconds at the same keep and preserves identity on abort',()=>{
  const {g,h,s}=fixture();s.hp=127;atKeep(g,h);assert.equal(g.refitStandard(h.id).ok,true);handling(g,h);step(g,7.9);assert.equal(s.hp,127);g.command([h.id],40,40,'move','spread');assert.equal(s.hp,127);assert.equal(s.id,h.standardId);atKeep(g,h);g.refitStandard(h.id);handling(g,h);step(g,8);assert.equal(s.hp,300);assert.equal(s.id,h.standardId);
});
test('Losing the chosen keep at completion cancels refit without restoring health',()=>{
  const {g,h,s}=fixture();s.hp=80;const keep=atKeep(g,h);g.refitStandard(h.id);handling(g,h);step(g,7.975);keep.team=1;g.update(.025);assert.equal(s.hp,80);assert.equal(h.standardAction,null);assert.equal(s.id,h.standardId);
});
test('Reforge rejects intact remote flags and replaces a destroyed one once after eight seconds',()=>{
  const {g,h,s}=fixture();plant(g,h);assert.equal(g.reforgeStandard(h.id).ok,false);g.damage(s,300,{team:1,type:'infantry',impactKind:'weapon'});atKeep(g,h);assert.equal(g.reforgeStandard(h.id).ok,true);handling(g,h);step(g,7.9);assert.equal(g.standardFor(0).id,s.id);step(g,.1);const replacement=g.standardFor(0);assert.notEqual(replacement.id,s.id);assert.equal(replacement.state,'carrying');assert.equal(replacement.hp,300);assert.equal(replacement.carrierId,h.id);assert.equal(g.standards.filter(b=>b.team===0).length,1);assert.equal(g.standardRemains.filter(b=>b.id===s.id).length,1);step(g,1);assert.equal(g.standardFor(0).id,replacement.id);
});
test('Pause freezes interaction time and snapshot roundtrip restores the exact pending action',()=>{
  const {g,h,s}=fixture();g.plantStandard(h.id,40,40);handling(g,h);step(g,1.3);const snapshot=g.exportStandards(),progress=h.standardAction.progress;g.paused=true;g.update(.06);assert.equal(h.standardAction.progress,progress);g.paused=false;g.cancelStandard(h.id);g.importStandards(snapshot);assert.equal(h.standardAction.progress,progress);assert.equal(g.standardFor(0).id,s.id);step(g,1.7);assert.equal(g.standardFor(0).state,'planted');assert.equal(g.standardFor(0).carrierId,null);
});
test('Snapshots reject duplicate identities before changing the existing standard state',()=>{
  const {g,s}=fixture();const data=g.exportStandards();data.standards.push({...data.standards[0]});assert.throws(()=>g.importStandards(data),/duplicate/);assert.equal(g.standardFor(0),s);assert.equal(g.standards.length,g.teams.length);const bad=g.exportStandards();bad.standards[0].maxHp=Infinity;assert.throws(()=>g.importStandards(bad),/Invalid/);
});
test('King death eliminates the army before return and leaves its standard permanently inert',()=>{
  const {g,h,s}=fixture(0,{mode:'defend-king'});plant(g,h);kill(g,h);assert.equal(g.teams[0].alive,false);assert.equal(g.teams[0].heroTimer,0);assert.equal(s.dormant,true);assert.equal(s.inert,true);assert.equal(g.standardStatus(h.id).benefit,null);step(g,40);assert.equal(g.heroFor(0),null);
});
test('AI uses the same plant timer, retreats when threatened and retrieves before safe relocation',()=>{
  const {g}=fixture();const h=g.heroFor(1);h.x=45;h.y=40;g.hold([h.id]);for(let i=0;i<6;i++){const soldier=g.addUnit(1,'infantry',45+(i%3)*.5,41+Math.floor(i/3)*.5);g.hold([soldier.id]);soldier.cooldown=1e9;}g.hash.rebuild(g.units);aiStandards(g,g.teams[1]);assert.equal(h.standardAction.kind,'plant');assert.equal(h.standardAction.duration,3);g.updateStandards(.025);assert.equal(h.standardAction.phase,'handling');g.cancelStandard(h.id);const s=g.standardFor(1);s.state='planted';s.carrierId=null;s.x=45;s.y=40;h.heroMode='signature';g.command([h.id],55,40,'move','spread');aiStandards(g,g.teams[1]);assert.equal(h.standardAction.kind,'pickup');assert.equal(h.standardAction.duration,2);g.cancelStandard(h.id);h.hp=100;const threat=g.addUnit(0,'infantry',46,40);g.hash.rebuild(g.units);aiStandards(g,g.teams[1]);assert.equal(h.order.aiTask,'retreat');assert.equal(h.order.mode,'move');assert.ok(h.order.x<h.x);assert.equal(s.state,'planted');assert.ok(threat.hp>0);
});
console.log(`${checks} hero standard checks passed.`);
