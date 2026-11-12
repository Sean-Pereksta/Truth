import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let passed=0;
const test=(name,fn)=>{fn();console.log('PASS '+name);passed++;};
const make=(config={})=>{
  const g=new Game({landscape:'open',scale:'standard',seed:44277,...config});
  g.units=[];g.buildings=[];g.byId=new Map();
  for(const team of g.teams){team.count=0;team.gold=3000;}
  g.hash.rebuild(g.units);return g;
};
const shoot=g=>{g.hash.rebuild(g.units);g.projectiles=[];for(const b of g.buildings)b.cooldown=0;g.updateBuildings(.01);return g.projectiles;};

test('New watchtowers start at level one with the shared base combat values',()=>{
  const g=make(),tower=g.addBuilding(0,'tower',50,50),d=g.towerDetails(tower.id);
  assert.equal(tower.level,1);assert.equal(tower.radius,.38);assert.equal(d.level,1);assert.equal(d.maxHp,1150);assert.equal(d.hp,1150);assert.equal(d.damage,25);assert.equal(d.range,4.6);assert.equal(d.cost,250);assert.equal(d.nextLevel,2);assert.equal(d.nextHp,2000);assert.equal(d.alive,true);
});

test('Both tower upgrades charge their price and preserve the exact remaining health percentage',()=>{
  const g=make(),tower=g.addBuilding(0,'tower',50,50);tower.hp=tower.maxHp*.4;const count=g.buildings.length;
  assert.equal(g.upgradeTower(tower.id).ok,true);let d=g.towerDetails(tower.id);assert.equal(d.level,2);assert.equal(d.maxHp,2000);assert.equal(d.hp,800);assert.equal(d.damage,38);assert.equal(d.range,5.2);assert.equal(d.radius,.48);assert.equal(d.cost,450);assert.equal(g.teams[0].gold,2750);
  assert.equal(g.upgradeTower(tower.id).ok,true);d=g.towerDetails(tower.id);assert.equal(d.level,3);assert.equal(d.maxHp,3200);assert.equal(d.hp,1280);assert.equal(d.damage,55);assert.equal(d.range,5.9);assert.equal(d.radius,.58);assert.equal(g.buildingRadius(tower),.58);assert.equal(d.maxed,true);assert.equal(d.nextLevel,null);assert.equal(g.teams[0].gold,2300);assert.equal(g.buildings.length,count);assert.equal(g.group(0).length,0);
});

test('Insufficient gold and maximum level reject upgrades without spending money or changing health',()=>{
  const g=make(),tower=g.addBuilding(0,'tower',50,50);g.teams[0].gold=249;assert.equal(g.upgradeTower(tower.id).ok,false);assert.equal(tower.level,1);assert.equal(tower.hp,1150);assert.equal(g.teams[0].gold,249);
  g.teams[0].gold=700;assert.equal(g.upgradeTower(tower.id).ok,true);assert.equal(g.upgradeTower(tower.id).ok,true);assert.equal(g.teams[0].gold,0);assert.equal(g.upgradeTower(tower.id).ok,false);assert.equal(g.teams[0].gold,0);assert.equal(tower.hp,3200);
});

test('Only the owning living faction can upgrade a living tower; allies, enemies, troops and dead towers fail',()=>{
  const g=make({mode:'team-conquest'}),allied=g.addBuilding(1,'tower',50,50),enemy=g.addBuilding(2,'tower',60,50),owned=g.addBuilding(0,'tower',40,50),unit=g.addUnit(0,'infantry',40,40),hall=g.addBuilding(0,'keep',30,30);
  for(const id of [allied.id,enemy.id,unit.id,hall.id,99999]){assert.equal(g.towerDetails(id,0).alive,false);assert.equal(g.upgradeTower(id,0).ok,false);}
  assert.equal(g.teams[0].gold,3000);assert.equal(allied.level,1);assert.equal(enemy.level,1);assert.equal(g.upgradeTower(allied.id,1).ok,true);assert.equal(g.teams[1].gold,2750);
  owned.hp=0;assert.equal(g.upgradeTower(owned.id).ok,false);owned.hp=1150;g.teams[0].alive=false;assert.equal(g.upgradeTower(owned.id).ok,false);
});

test('Actual tower projectiles use upgraded range and damage at both higher levels',()=>{
  const g=make(),tower=g.addBuilding(0,'tower',50,50),enemy=g.addUnit(1,'infantry',55,50);
  assert.equal(shoot(g).length,0);g.upgradeTower(tower.id);let projectiles=shoot(g);assert.equal(projectiles.length,1);assert.equal(projectiles[0].target,enemy.id);assert.equal(projectiles[0].damage,38);
  enemy.x=55.6;assert.equal(shoot(g).length,0);g.upgradeTower(tower.id);projectiles=shoot(g);assert.equal(projectiles.length,1);assert.equal(projectiles[0].damage,55);
  g.teams[0].upgrades.weapons=10;assert.equal(shoot(g)[0].damage,66);
});

test('Upgraded towers ignore allies and fire at the enemy within their extended range',()=>{
  const g=make({mode:'team-conquest'}),tower=g.addBuilding(0,'tower',50,50);g.upgradeTower(tower.id);g.upgradeTower(tower.id);const ally=g.addUnit(1,'infantry',50.4,50),enemy=g.addUnit(2,'infantry',55.6,50),projectiles=shoot(g);
  assert.equal(projectiles.length,1);assert.equal(projectiles[0].target,enemy.id);assert.notEqual(projectiles[0].target,ally.id);
});

test('Falcon Guard range and rate still combine with upgraded tower combat values',()=>{
  const g=make({house:7}),tower=g.addBuilding(0,'tower',50,50);g.upgradeTower(tower.id);g.upgradeTower(tower.id);g.addUnit(1,'infantry',57.6,50);assert.equal(shoot(g).length,0);
  g.teams[0].buffs.falconUntil=10;const projectiles=shoot(g);assert.equal(projectiles.length,1);assert.equal(projectiles[0].damage,55);assert.ok(Math.abs(tower.cooldown-1.25/1.4)<1e-9);
});

console.log(`${passed} tower checks passed.`);
