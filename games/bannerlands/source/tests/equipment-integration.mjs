import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS} from '../../core.js';
import {migrateRegimentState,poseForUnit} from '../../equipment.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(){
  const g=new Game({house:1,landscape:'open',scale:'standard',enemies:1,seed:73119});
  g.units=[];g.buildings=[];g.byId.clear();g.effects=[];g.projectiles=[];
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.height=0;t.owner=0;}
  for(const s of g.teams){s.alive=true;s.count=0;s.upgrades.weapons=0;s.upgrades.armor=0;}
  g.navigation.invalidate();return g;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} must equal ${b}`);
const boltTypes=['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel'];

test('All four actual bolt impacts apply the proposed cavalry multiplier exactly once',()=>{
  for(const [i,type]of boltTypes.entries()){
    const g=fixture(),u=g.addUnit(0,type,30,30),target=g.addUnit(1,'cavalry',34,30);
    target.hp=target.maxHp=10000;u.facingX=1;u.facingY=0;g.hash.rebuild(g.units);
    g.attack(u,target);assert.equal(g.projectiles.length,0,'Aiming cannot release a bolt.');
    g.updateWeaponActions(u,.25);assert.equal(g.projectiles.length,1);
    assert.equal(g.projectiles[0].type,'bolt');assert.equal(target.hp,10000);
    g.updateProjectiles(2);
    close(10000-target.hp,[108,144,200,121.6][i]);
    for(let frame=0;frame<20;frame++){g.attack(u,target);g.updateWeaponActions(u,.06);}
    assert.equal(g.projectiles.length,0,'An empty weapon cannot fire from repeated attack or animation updates.');
    close(u.reload.duration,[3,3.6,5,3.2][i]);
  }
});

test('Incoming bolt direction stays authoritative after the shooter moves behind a shield',()=>{
  for(const [incomingX,incomingY,expected]of [[-1,0,25],[0,-1,100],[1,0,150]]){
    const g=fixture();g.teams[1].sigil='dragon';
    const shield=g.addUnit(1,'shield_bearer',40,40),shooter=g.addUnit(0,'archer',35,40);
    shield.facingX=1;shield.facingY=0;shield.hp=shield.maxHp=1000;
    const sx=40-incomingX*4,sy=40-incomingY*4;
    g.projectiles.push({sx,sy,x:sx,y:sy,tx:40,ty:40,t:0,duration:.4,type:'bolt',team:0,target:shield.id,sourceId:shooter.id,sourceType:'archer',damage:100});
    shooter.x=35;shooter.y=40;g.hash.rebuild(g.units);g.updateProjectiles(.5);
    close(1000-shield.hp,expected);
  }
});

test('Stage completion is deterministic at different simulation cadences and pause does no work',()=>{
  for(const type of boltTypes)for(const dt of [1/120,1/30,.06]){
    const g=fixture(),u=g.addUnit(0,type,30,30),target=g.addUnit(1,'cavalry',34,30);target.hp=10000;u.facingX=1;u.facingY=0;
    g.attack(u,target);g.updateWeaponActions(u,.25);const duration=u.reload.duration;
    g.paused=true;const before=JSON.stringify(u.reload),time=g.time;for(let i=0;i<10;i++)g.update(dt);
    assert.equal(JSON.stringify(u.reload),before);assert.equal(g.time,time);g.paused=false;
    let elapsed=0;while(u.reload&&elapsed<duration+.3){g.time+=dt;g.updateCrossbowReload(u,dt);elapsed+=dt;}
    assert.equal(u.reload,null);assert.ok(elapsed>=duration-1e-7&&elapsed<=duration+.16);
    assert.equal(g.stats.battles,1,'Reload completion cannot generate a second projectile by itself.');
  }
});

test('Legacy migration preserves references, group IDs, upgrades and fractional health',()=>{
  const orders=[{mode:'move',x:12,y:14},{mode:'hold',facingX:0,facingY:1}],groups=new Map([['1',[7,8]]]);
  const units=[{id:7,team:0,type:'shield_bearer',hp:65,maxHp:260,order:orders[0],upgrade:3},{id:8,team:1,type:'shield_bearer',hp:182,maxHp:260,order:orders[1],upgrade:2}];
  const state={teams:[HOUSES[0],HOUSES[4]],units,groups,buildings:[{type:'winter_shield_hall'},{type:'rose_guard_pavilion'}]};
  assert.equal(migrateRegimentState(state),state);
  assert.deepEqual(units.map(u=>u.type),['winter_pikeman','thornwall_pikeman']);
  assert.equal(units[0].order,orders[0]);assert.equal(units[1].order,orders[1]);assert.equal(state.groups,groups);
  close(units[0].hp/units[0].maxHp,.25);close(units[1].hp/units[1].maxHp,.7);
  assert.deepEqual(groups.get('1'),[7,8]);assert.deepEqual(units.map(u=>u.upgrade),[3,2]);
  for(const u of units)assert.equal(poseForUnit(u).shieldPresented,false);
  assert.deepEqual(state.buildings.map(b=>b.type),['winter_pike_hall','thornwall_drill_hall']);
  assert.equal(migrateRegimentState(state).units,units,'Migration is idempotent and retains the same troop records.');
});

console.log(`${cases} cross-system equipment checks passed.`);
