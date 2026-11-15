import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';

const types=['gilded_crossbow','tollhouse_crossbow','sharpshooter'];
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g=new Game({landscape:'open',enemies:1,house:1,seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;t.height=0;}
  for(const s of g.teams){s.count=0;s.alive=true;s.upgrades.weapons=0;s.upgrades.armor=0;}
  g.navigation.invalidate();return g;
}
function step(g,seconds){for(let i=0;i<Math.ceil(seconds/.025);i++){g.time+=.025;g.hash.rebuild(g.units);g.updateUnits(.025);g.updateProjectiles(.025);}}
function pair(type,targetType='infantry',distance=4.8){
  const g=fixture(),u=g.addUnit(0,type,30,30),v=g.addUnit(1,targetType,30+distance,30);
  v.hp=v.maxHp=10000;v.cooldown=1e9;g.hold([u.id,v.id]);u.cooldown=0;g.hash.rebuild(g.units);return {g,u,v};
}

test('Every crossbow fires real bolts beyond its former range, with higher impact and a cavalry bonus',()=>{
  for(const [type,oldRange,oldDamage]of [['gilded_crossbow',4.05,23],['tollhouse_crossbow',4.25,28],['sharpshooter',6.25,42]]){
    const {g,u,v}=pair(type,'cavalry',oldRange+.35),d=UNIT_DEFS[type];
    assert.ok(d.range>oldRange);assert.ok(d.damage>oldDamage);step(g,.025);
    assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].type,'bolt');
    assert.equal(v.hp,v.maxHp,'Damage belongs to projectile contact, not release.');
    g.updateProjectiles(2);assert.ok(Math.abs(v.maxHp-v.hp-d.damage*d.cavalryBonus)<1e-6);
    assert.ok(u.reload&&u.reloading);
  }
});

test('All three classes stay planted and cannot fire again before completing the stationary reload',()=>{
  for(const type of types){
    const {g,u,v}=pair(type),start={x:u.x,y:u.y};g.attack(u,v);const duration=u.reload.duration;
    v.x=50;g.attackNearest([u.id]);step(g,duration*.5);
    assert.equal(u.x,start.x);assert.equal(u.y,start.y);assert.ok(u.reload.progress>0);
    const count=g.stats.battles;g.attack(u,v);assert.equal(g.stats.battles,count,'Direct attacks cannot bypass an unloaded crossbow.');
    step(g,duration*.55);assert.equal(u.reload,null);assert.equal(u.reloading,false);
    assert.equal(g.stats.battles,count,'No shot at an out-of-range enemy on completion.');
    step(g,.1);assert.ok(u.x>start.x,'Automatic pursuit resumes after the weapon is loaded.');
  }
});

test('A move command interrupts reload immediately, leaves the weapon unloaded, and reloads after arrival',()=>{
  for(const type of types){
    const {g,u,v}=pair(type);g.attack(u,v);step(g,.35);assert.ok(u.reload.progress>0);
    v.hp=0;g.command([u.id],27,30,'move','spread');step(g,.4);
    assert.ok(u.x<29.8);assert.equal(u.reloading,false);assert.equal(u.reload.progress,0);
    const count=g.stats.battles;step(g,.5);assert.equal(u.reload.progress,0);assert.equal(g.stats.battles,count);
    step(g,3);assert.ok(Math.abs(u.x-27)<.25);assert.ok(u.reloading||!u.reload,'Arrival starts a real stationary reload.');
    step(g,UNIT_DEFS[type].rate+.2);assert.equal(u.reload,null);assert.equal(u.cooldown<=0,true);
  }
});

test('An attack command while withdrawing stops the crossbowman to reload before any new shot',()=>{
  const {g,u,v}=pair('sharpshooter');g.attack(u,v);g.command([u.id],20,30,'move','spread');step(g,.5);
  assert.equal(u.reload.progress,0);const before=u.x,count=g.stats.battles;
  g.attackNearest([u.id]);step(g,.5);assert.ok(Math.abs(u.x-before)<.001);assert.ok(u.reloading);assert.ok(u.reload.progress>.4);
  assert.equal(g.stats.battles,count);step(g,3.1);assert.ok(g.stats.battles>count);
});

test('Knockback interrupts a partially completed reload and cannot silently reload a moving weapon',()=>{
  const {g,u,v}=pair('gilded_crossbow');g.attack(u,v);step(g,.4);assert.ok(u.reload.progress>.3);
  u.knockT=u.knockDuration=.3;u.knockVX=-2;u.knockVY=0;step(g,.1);
  assert.equal(u.reload.progress,0);assert.equal(u.reloading,false);
  step(g,.5);assert.ok(u.reloading);assert.ok(u.reload.progress>0&&u.reload.progress<u.reload.duration);
});

test('An ally pushing in the final collision pass interrupts even the last fraction of a reload',()=>{
  const {g,u,v}=pair('gilded_crossbow','infantry',4);
  g.attack(u,v);u.reload.progress=u.reload.duration-.02;
  const ally=g.addUnit(0,'cavalry',30.41,30);g.command([ally.id],25,30,'move','spread');ally.motionVX=-2.25;ally.motionVY=0;
  g.time+=.06;g.hash.rebuild(g.units);g.updateUnits(.06);
  assert.ok(Math.abs(u.x-30)>.003,'The ally must actually displace the crossbowman.');
  assert.ok(u.reload,'Collision prevents completion before the final position is known.');assert.equal(u.reload.progress,0);assert.equal(u.reloading,false);
  const count=g.stats.battles;step(g,.025);assert.equal(g.stats.battles,count,'A displaced weapon cannot fire on the next frame.');
});

test('Moving a prepared Tollhouse crew loses its fast reload until readiness is earned again',()=>{
  const {g,u,v}=pair('tollhouse_crossbow');u.stationaryTime=2;g.attack(u,v);
  assert.equal(u.reload.duration,UNIT_DEFS[u.type].rate/1.25);
  g.command([u.id],25,30,'move','spread');step(g,.2);
  assert.equal(u.reload.progress,0);assert.equal(u.reload.duration,UNIT_DEFS[u.type].rate);assert.ok(u.stationaryTime<2);
});

console.log(`${checks} crossbow combat and reload checks passed.`);
