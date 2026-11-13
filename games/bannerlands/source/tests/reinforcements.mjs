import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {FRONTIER_BUILDINGS,regimentRequiredBuilding,regimentsForHouse} from '../../regiments.js';
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(sigil='stag'){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:HOUSES.findIndex(h=>h.sigil===sigil),seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;t.height=0;}
  for(const s of g.teams){s.count=0;s.cap=1000;s.gold=10000;s.alive=true;s.aiClock=1e9;s.rally=null;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
}
const step=(g,n=1)=>{for(let i=0;i<n;i++){g.time+=.025;g.hash.rebuild(g.units);g.updateUnits(.025);g.updateProjectiles(.025);}};
test('Six dedicated facilities enforce house, living building, supply, cost and local rally requirements',()=>{
  for(const [sigil,b]of Object.entries(FRONTIER_BUILDINGS)){
    const g=fixture(sigil),s=g.teams[0];assert.equal(g.recruit(b.unit).ok,false);
    assert.equal(regimentRequiredBuilding(b.unit,sigil),b.type);
    const origin=g.addBuilding(0,b.type,20,20);origin.rally={x:30,y:30};
    const details=g.recruitDetails(b.unit);s.gold=details.cost-1;assert.equal(g.recruit(b.unit).ok,false);
    s.gold=10000;s.cap=details.batch-1;assert.equal(g.recruit(b.unit).ok,false);s.cap=1000;
    assert.equal(g.recruit(b.unit).ok,true);assert.equal(s.gold,10000-details.cost);
    assert.equal(g.units.length,details.batch);assert.ok(g.units.every(u=>u.type===b.unit&&u.order.groupX===30));
    origin.hp=0;assert.equal(g.recruit(b.unit).ok,false);
    const foreign=fixture(sigil==='stag'?'wolf':'stag');assert.equal(foreign.build(b.type,20,20).ok,false);assert.equal(foreign.recruit(b.unit).ok,false);
  }
});
test('Every new facility automatically trains its own troops and respects supply',()=>{
  for(const [sigil,d]of Object.entries(FRONTIER_BUILDINGS)){
    const g=fixture(sigil),b=g.addBuilding(0,d.type,20,20);b.spawnTimer=d.interval;g.updateBuildings(.01);
    assert.equal(g.units.length,d.batch);assert.ok(g.units.every(u=>u.type===d.unit));
    g.teams[0].cap=g.units.length;b.spawnTimer=d.interval;g.updateBuildings(.01);assert.equal(g.units.length,d.batch);
  }
});
test('Hammer strikes damage and physically displace enemies, with visible impact and mass/brace resistance',()=>{
  function hit(type='infantry',brace=false){const g=fixture(),u=g.addUnit(0,'stormbreaker',20,20),v=g.addUnit(1,type,20.75,20);g.hold([u.id,v.id]);u.facingX=1;u.facingY=0;v.facingX=-1;v.facingY=0;
    if(brace){v.braceDir={x:-1,y:0};v.braceTime=1;}
    g.hash.rebuild(g.units);g.attack(u,v);assert.ok(v.hp<v.maxHp);assert.ok(g.effects.some(e=>e.type==='hammerImpact'));const kick=v.knockVX;
    const before=v.x;step(g,8);assert.ok(v.x>before+.02,'The shove must actually move the target.');return kick;
  }
  const normal=hit();assert.ok(normal>hit('hero'));assert.ok(normal>hit('dread_pike',true));assert.ok(normal>hit('shield_bearer'));
  const g=fixture(),u=g.addUnit(0,'stormbreaker',20,20),b=g.addBuilding(1,'tower',20.8,20);g.attack(u,b);assert.equal(b.knockT,undefined);
});
test('Hammer knockback cannot move a fighter into an impassable mountain',()=>{
  const g=fixture(),u=g.addUnit(0,'stormbreaker',20,20.5),v=g.addUnit(1,'infantry',20.8,20.5);
  for(let y=1;y<g.H-1;y++)g.tileAt(21.5,y+.5).terrain='mountain';g.navigation.invalidate();g.hold([u.id,v.id]);g.attack(u,v);step(g,20);
  assert.ok(g.isWalkable(v.x,v.y));assert.ok(v.x<21);
});
test('Reed spearhands receive their additional forest speed and retain light armor without a charge brace',()=>{
  const g=fixture('frog'),u=g.addUnit(0,'crannog_spearhand',20.5,20.5);g.tileAt(u.x,u.y).terrain='forest';
  assert.equal(g.movementMultiplier(u),1.56);assert.ok(!UNIT_DEFS[u.type].spearBrace);assert.ok(u.hp<UNIT_DEFS.infantry.hp*1.2);
  const v=g.addUnit(0,'infantry',20.5,20.5);assert.equal(g.movementMultiplier(v),1.2);
  g.tileAt(u.x,u.y).terrain='grass';assert.equal(g.movementMultiplier(u),1);
});
test('Tarly long halberds hit before swords can reach, using the actual combat loop',()=>{
  const g=fixture('huntsman'),u=g.addUnit(0,'hornhill_halberdier',20,20),v=g.addUnit(1,'infantry',21.45,20);g.hold([u.id,v.id]);u.cooldown=0;v.cooldown=0;
  step(g);assert.equal(u.hp,u.maxHp);assert.ok(v.hp<v.maxHp);assert.equal(g.unitRange(u),1.6);assert.ok(g.unitRange(u)>g.unitRange(v));
});
test('Frey crossbows earn a stationary reload bonus and movement resets it',()=>{
  const g=fixture('bridge'),u=g.addUnit(0,'tollhouse_crossbow',20,20);g.hold([u.id]);step(g,85);assert.ok(u.stationaryTime>=2);
  const v=g.addUnit(1,'infantry',23,20);g.hash.rebuild(g.units);g.attack(u,v);assert.equal(u.cooldown,UNIT_DEFS[u.type].rate/1.25);
  g.command([u.id],16,20,'move','spread');step(g,20);assert.ok(u.stationaryTime<2);
});
test('Greyjoy throws real axe projectiles with short range and keeps its recovery weakness',()=>{
  const g=fixture('kraken'),u=g.addUnit(0,'saltwind_axethrower',20,20),v=g.addUnit(1,'infantry',22,20);g.hash.rebuild(g.units);g.attack(u,v);
  assert.equal(g.projectiles[0].type,'axe');g.updateProjectiles(2);assert.ok(v.hp<v.maxHp);assert.ok(g.unitRange(u)<UNIT_DEFS.archer.range);
  assert.ok(HOUSES.find(h=>h.sigil==='kraken').weaknesses.some(w=>w.includes('50%')));
});
test('Martell replaces catapults in the opening, paid recruitment, buildings, production and AI plans',()=>{
  const opening=new Game({landscape:'open',house:HOUSES.findIndex(h=>h.sigil==='sun'),enemies:1,seed:44277});
  assert.equal(opening.group(0).filter(u=>u.type==='siege').length,0);assert.equal(opening.group(0).filter(u=>u.type==='sun_horse_archer').length,1);assert.equal(opening.group(0).length,70);
  const g=fixture('sun');assert.equal(g.recruitDetails('siege').unlocked,false);assert.equal(g.recruit('siege').ok,false);assert.equal(g.build('workshop',20,20).ok,false);
  const workshop=g.addBuilding(0,'workshop',20,20);workshop.spawnTimer=100;g.updateBuildings(1);g.spawnBatch(workshop,'siege',2);assert.equal(g.units.length,0);
  assert.deepEqual(regimentsForHouse('sun'),['lance_champion','sun_horse_archer']);assert.ok(BUILD_DEFS.sun_lance_court);
  const s=g.teams[0],plan=g.aiPlanFor(s),production=g.aiProductionPlan(s,plan,[],false);assert.ok(!production.options.some(o=>o.type==='workshop'));
});
test('Horse archers shoot arrows, use venom, skirmish and cannot charge',()=>{
  const g=fixture('sun'),u=g.addUnit(0,'sun_horse_archer',20,20),v=g.addUnit(1,'infantry',21.1,20);g.hash.rebuild(g.units);g.command([u.id],24,20,'attack','spread');
  assert.equal(g.unitClass(u),'cavalry');assert.equal(g.isRanged(u),true);assert.equal(g.useHousePower([u.id]).ok,true);g.attack(u,v);
  assert.equal(g.projectiles[0].type,'arrow');assert.equal(g.projectiles[0].venom,true);g.updateProjectiles(1);assert.ok(v.hp<v.maxHp);
  g.beginCharge(u,v);assert.equal(u.charging,false);const before=u.x;step(g,20);assert.ok(u.x<before,'Mounted archers withdraw from close melee.');assert.equal(u.charging,false);
});
console.log(`${checks} reinforcement checks passed.`);
