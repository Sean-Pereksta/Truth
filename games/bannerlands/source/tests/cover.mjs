import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
import {CombatTerrain} from '../../cover.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const fixture=()=>{
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:0,seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];
  for(const tile of g.tiles){tile.terrain='grass';tile.feature=null;tile.height=0;tile.owner=-1;}
  for(const team of g.teams){team.count=0;team.alive=true;team.cap=1000;team.aiClock=1e9;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
};
const tile=(g,x,y)=>g.tiles[y*g.W+x];
const mountain=(g,x,y,feature=null)=>{Object.assign(tile(g,x,y),{terrain:'mountain',feature});g.navigation.invalidate();};
const terrain=g=>g.combatTerrain||new CombatTerrain(g);
const shoot=(g,source,target)=>{
  g.projectiles=[];source.cooldown=0;g.hash.rebuild(g.units);const before=target.hp;g.attack(source,target);g.updateProjectiles(2);return before-target.hp;
};

test('Mountains block direct fire in both directions and open passes restore the sightline',()=>{
  const g=fixture(),line=terrain(g),a={x:30.5,y:30.5},b={x:34.5,y:30.5};
  assert.equal(line.canShoot(a,b),true);mountain(g,32,30);
  assert.equal(line.canShoot(a,b),false);assert.equal(line.canShoot(b,a),false);
  const casts=line.stats.raycasts;assert.equal(line.canShoot(a,b),false);assert.equal(line.stats.raycasts,casts);assert.ok(line.stats.cacheHits>0);
  mountain(g,32,30,'pass');assert.equal(line.canShoot(a,b),true,'A drawn pass must also be an open firing lane.');
  assert.equal(line.canShoot({x:NaN,y:30},b),false);assert.equal(line.canShoot(a,{x:-1,y:30}),false);
});

test('Exact troop positions and mountain corners cannot be replaced by tile-center aiming',()=>{
  const g=fixture(),line=terrain(g);mountain(g,31,30);
  const highA={x:30.05,y:30.95},highB={x:32.05,y:32.95},lowA={x:30.95,y:30.05},lowB={x:32.95,y:32.05};
  assert.equal(line.canShoot(highA,highB),true);assert.equal(line.canShoot(lowA,lowB),false,'Different rays inside the same endpoint tiles may have different visibility.');
  assert.equal(line.canShoot({x:30.5,y:30.5},{x:32.5,y:32.5}),false,'A diagonal cannot shoot through the corner of a solid mountain.');
  tile(g,31,30).terrain='grass';mountain(g,30,30);
  assert.equal(line.canShoot({x:31,y:29.5},{x:31,y:32.5}),false,'A ray exactly on a grid boundary still touches the mountain beside it.');
});

test('Actual archers and both defensive buildings choose clear enemies instead of shooting through a ridge',()=>{
  for(const kind of ['archer','tower','keep']){
    const g=fixture();assert.ok(g.combatTerrain instanceof CombatTerrain,'Game must use the shared terrain combat rules.');
    const source=kind==='archer'?g.addUnit(0,kind,30.5,30.5):g.addBuilding(0,kind,30.5,30.5),blocked=g.addUnit(1,'infantry',33.5,30.5),clear=g.addUnit(1,'infantry',30.5,34);
    mountain(g,32,30);g.hash.rebuild(g.units);
    if(kind==='archer'){
      assert.equal(g.findTarget(source),clear);g.attack(source,blocked);assert.equal(g.projectiles.length,0);
      g.attack(source,clear);
    }else{source.cooldown=0;g.updateBuildings(.01);}
    assert.equal(g.projectiles.length,1,kind+' must still fire down its clear lane.');assert.equal(g.projectiles[0].target,clear.id);
  }
});

test('Forest troops take one quarter less real arrow and ballista damage while buildings receive no cover bonus',()=>{
  for(const type of ['archer','beacon_engineer']){
    const g=fixture(),source=g.addUnit(0,type,30.5,30.5),target=g.addUnit(1,'infantry',32.5,30.5);
    const open=shoot(g,source,target);assert.ok(open>0);target.hp=target.maxHp;tile(g,32,30).terrain='forest';
    const covered=shoot(g,source,target);assert.ok(Math.abs(covered-open*.75)<1e-8,type+' should apply forest cover exactly once.');
  }
  const g=fixture(),source=g.addUnit(0,'archer',30.5,30.5),target=g.addBuilding(1,'tower',32.5,30.5);
  const open=shoot(g,source,target);target.hp=target.maxHp;tile(g,32,30).terrain='forest';assert.equal(shoot(g,source,target),open);
});

test('Forest cover does not reduce melee attacks, arcing stones or burning ground',()=>{
  for(const type of ['infantry','siege']){
    const g=fixture(),source=g.addUnit(0,type,30.5,30.5),target=g.addUnit(1,'infantry',32.5,30.5),open=shoot(g,source,target);
    assert.ok(open>0);target.hp=target.maxHp;tile(g,32,30).terrain='forest';assert.equal(shoot(g,source,target),open);
  }
  const g=fixture(),target=g.addUnit(1,'infantry',32.5,30.5);tile(g,32,30).terrain='forest';g.hash.rebuild(g.units);g.addFireZone(0,32.5,30.5,1,3,8);const before=target.hp;g.updateHouseEffects(.5);assert.equal(before-target.hp,4);
});

test('Player and rival archers obey the same forest cover and blocked-sightline rules',()=>{
  const losses=[];
  for(const team of [0,1]){
    const g=fixture(),archer=g.addUnit(team,'archer',30.5,30.5),target=g.addUnit(1-team,'infantry',33.5,30.5);tile(g,33,30).terrain='forest';
    losses.push(shoot(g,archer,target));target.hp=target.maxHp;mountain(g,32,30);g.projectiles=[];g.attack(archer,target);assert.equal(g.projectiles.length,0);
  }
  assert.ok(losses[0]>0);assert.equal(losses[0],losses[1]);
});

test('High-ground archers gain modest range and actually fire from a hill at an otherwise unreachable enemy',()=>{
  const g=fixture(),archer=g.addUnit(0,'archer',30.5,30.5),target=g.addUnit(1,'infantry',34.45,30.5);
  archer.order={x:archer.x,y:archer.y,mode:'hold'};target.order={x:target.x,y:target.y,mode:'hold'};archer.cooldown=0;archer.seek=0;g.hash.rebuild(g.units);
  assert.equal(g.unitRange(archer),UNIT_DEFS.archer.range);g.updateUnits(.01);assert.equal(g.projectiles.length,0);
  tile(g,30,30).terrain='hill';assert.equal(g.unitRange(archer),UNIT_DEFS.archer.range+.6);archer.cooldown=0;archer.seek=0;g.hash.rebuild(g.units);g.updateUnits(.01);assert.equal(g.projectiles.length,1);
  const sword=g.addUnit(0,'infantry',30.5,30.5);assert.equal(g.unitRange(sword),UNIT_DEFS.infantry.range,'Melee reach must not gain a hill bonus.');
});

test('Arcing catapult stones cross ridges while direct ballista bolts remain blocked',()=>{
  const g=fixture(),stone=g.addUnit(0,'siege',30.5,30.5),bolt=g.addUnit(0,'beacon_engineer',30.5,31),target=g.addUnit(1,'infantry',34.5,30.5);
  mountain(g,32,30);g.hash.rebuild(g.units);assert.equal(g.findTarget(bolt),null);g.attack(bolt,target);assert.equal(g.projectiles.length,0);
  assert.equal(g.findTarget(stone),target);g.attack(stone,target);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].type,'rock');g.updateProjectiles(2);assert.ok(target.hp<target.maxHp);
});

test('A newly blocked sightline prevents an already launched direct projectile from damaging through the ridge',()=>{
  const g=fixture(),archer=g.addUnit(0,'archer',30.5,30.5),target=g.addUnit(1,'infantry',33.5,30.5);g.attack(archer,target);assert.equal(g.projectiles.length,1);
  mountain(g,32,30);g.updateProjectiles(2);assert.equal(target.hp,target.maxHp);assert.equal(g.projectiles.length,0);
});

test('Open battles avoid ray traversal and repeated blocked shots reuse a bounded cache',()=>{
  const g=fixture(),line=new CombatTerrain(g,{maxRays:32}),a={x:30.5,y:30.5},b={x:35.5,y:30.5};mountain(g,32,30);
  for(let i=0;i<10000;i++)assert.equal(line.canShoot({x:10.5,y:10.5},{x:100.5,y:10.5}),true);
  assert.equal(line.stats.raycasts,0);assert.equal(line.stats.cellChecks,0);assert.equal(line.stats.fastClear,10000);
  for(let i=0;i<10000;i++)assert.equal(line.canShoot(a,b),false);assert.equal(line.stats.raycasts,1);assert.equal(line.stats.cacheHits,9999);
  for(let i=0;i<100;i++)line.canShoot({x:30.1+i*.001,y:30.5},b);assert.equal(line.rays.size,32);
  assert.ok(line.stats.cellChecks<(g.W+g.H+2)*102,'Each unique obstructed ray has a bounded amount of grid work.');
});

console.log(`${cases} sightline and cover checks passed.`);
