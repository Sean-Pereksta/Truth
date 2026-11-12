import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {CONQUEST_BUILDINGS,regimentAllowed,regimentForHouse,regimentBuildingForHouse} from '../../regiments.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(sigil='flayed'){
  const g=new Game({landscape:'open',scale:'standard',enemies:2,house:HOUSES.findIndex(h=>h.sigil===sigil),seed:44277});
  g.units=[];g.buildings=[];g.projectiles=[];g.effects=[];g.byId.clear();
  for(const tile of g.tiles){tile.terrain='grass';tile.feature=null;tile.owner=0;}
  for(const s of g.teams){s.count=0;s.cap=1000;s.gold=10000;s.alive=true;s.rally=null;s.aiClock=1e9;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
}
const step=(g,dt)=>{g.time+=dt;g.hash.rebuild(g.units);g.updateUnits(dt);};

test('New regiments and dedicated facilities are exclusive to their requested houses',()=>{
  for(const house of HOUSES){
    const g=fixture(house.sigil),expected=CONQUEST_BUILDINGS[house.sigil];
    for(const type of ['trebuchet','giant','sharpshooter']){
      assert.equal(regimentAllowed(type,house.sigil),expected?.unit===type);
      assert.equal(g.recruitDetails(type).unlocked,false);
    }
    for(const definition of Object.values(CONQUEST_BUILDINGS)){
      const gold=g.teams[0].gold,built=g.build(definition.type,20.5,20.5);
      assert.equal(built.ok,definition.house===house.sigil);
      assert.equal(g.teams[0].gold,gold-(built.ok?definition.cost:0),'Foreign facilities cannot spend gold.');
    }
    if(!expected)continue;
    assert.equal(regimentForHouse(house.sigil),expected.unit);
    assert.equal(regimentBuildingForHouse(house.sigil),expected.type);
    const b=g.buildings.find(b=>b.type===expected.type);
    assert.equal(g.recruitDetails(expected.unit).unlocked,true);
    assert.equal(g.recruit(expected.unit).ok,true);
    assert.equal(g.units.length,UNIT_DEFS[expected.unit].batch,'Free Folk giants must not receive the mass-infantry batch bonus.');
    b.hp=0;assert.equal(g.recruitDetails(expected.unit).unlocked,false);
  }
});

test('Trebuchets cannot fire before fifteen stationary seconds and movement restarts setup',()=>{
  for(const sigil of ['flayed','beacon']){
    const g=fixture(sigil),engine=g.addUnit(0,'trebuchet',30,30),fort=g.addBuilding(1,'barracks',38,30);
    engine.cooldown=0;g.hold([engine.id]);
    for(let i=0;i<149;i++)step(g,.1);
    step(g,.09);assert.equal(g.projectiles.length,0);assert.ok(engine.setupProgress<15);
    step(g,.02);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].target,fort.id);
    assert.equal(engine.setupProgress,15);assert.equal(engine.cooldown,7.5);
    g.command([engine.id],35,30,'move','line');assert.equal(engine.setupProgress,0);
    step(g,.1);assert.equal(engine.setupProgress,0);assert.ok(Math.hypot(engine.vx,engine.vy)>.03);
    g.hold([engine.id]);engine.vx=engine.vy=0;engine.setupX=engine.x;engine.setupY=engine.y;
    for(let i=0;i<100;i++)step(g,.1);
    assert.ok(engine.setupProgress<15);engine.cooldown=0;g.attack(engine,fort);assert.equal(g.projectiles.length,1,'A partially rebuilt engine cannot attack directly.');
  }
});

test('Physical displacement and knockback invalidate a prepared trebuchet',()=>{
  const g=fixture(),engine=g.addUnit(0,'trebuchet',30,30),fort=g.addBuilding(1,'barracks',38,30);
  engine.setupProgress=15;engine.x+=.2;engine.cooldown=0;step(g,.01);
  assert.equal(g.projectiles.length,0);assert.equal(engine.setupProgress,0);
  engine.setupProgress=15;engine.knockT=.2;engine.knockVX=2;engine.knockVY=0;g.attack(engine,fort);assert.equal(g.projectiles.length,0);
});

test('Trebuchets outrange ordinary siege and bombard buildings heavily with a slow reload',()=>{
  const g=fixture(),engine=g.addUnit(0,'trebuchet',30,30),fort=g.addBuilding(1,'barracks',40,30);
  assert.ok(UNIT_DEFS.trebuchet.range>UNIT_DEFS.siege.range*1.8);
  assert.ok(UNIT_DEFS.trebuchet.rate>UNIT_DEFS.siege.rate*2);
  engine.setupProgress=15;engine.cooldown=0;g.hash.rebuild(g.units);g.attack(engine,fort);
  const shot=g.projectiles[0];assert.equal(shot.type,'rock');assert.equal(shot.splash,1.7);
  const hp=fort.hp;g.updateProjectiles(shot.duration);assert.ok(hp-fort.hp>=540);
});

test('Giants have high health and splash nearby enemies without harming allies',()=>{
  const g=fixture('bone'),giant=g.addUnit(0,'giant',30,30),target=g.addUnit(1,'infantry',31,30),near=g.addUnit(1,'infantry',31.8,30),far=g.addUnit(1,'infantry',34,30),friendly=g.addUnit(0,'infantry',31,30.8),ally=g.addUnit(2,'infantry',31,29.2);
  g.teams[2].alliance=g.teams[0].alliance;
  g.hash.rebuild(g.units);assert.ok(giant.maxHp>UNIT_DEFS.infantry.hp*8);
  const start=[target.hp,near.hp,far.hp,friendly.hp,ally.hp];g.attack(giant,target);
  assert.ok(target.hp<start[0]);assert.ok(near.hp<start[1]);assert.equal(far.hp,start[2]);assert.equal(friendly.hp,start[3]);assert.equal(ally.hp,start[4]);
  assert.ok(start[1]-near.hp<start[0]-target.hp,'The main blow is stronger than its surrounding splash.');
  assert.ok(target.knockVX>0&&near.knockVX>0);assert.equal(far.knockT,0);assert.equal(friendly.knockT,0);assert.equal(ally.knockT,0);
});

test('Giant swings visibly shove surviving main and splash victims away and break cavalry charges',()=>{
  const g=fixture('bone'),giant=g.addUnit(0,'giant',30,30),target=g.addUnit(1,'infantry',31,30),splash=g.addUnit(1,'cavalry',31,30.9),dead=g.addUnit(1,'archer',31,29.5),fort=g.addBuilding(1,'barracks',31,29.2);
  g.teams[1].sigil='lion';
  for(const foe of [target,splash]){foe.hp=foe.maxHp=1000;g.hold([foe.id]);foe.cooldown=1e9;}dead.hp=1;
  splash.charging=true;splash.momentum=1;splash.chargeDir={x:-1,y:0};
  g.hash.rebuild(g.units);g.attack(giant,target);
  assert.ok(target.knockVX>0);assert.ok(splash.knockVX>0&&splash.knockVY>0);assert.equal(splash.charging,false);assert.ok(dead.hp<=0);assert.equal(dead.knockT,0);assert.equal(fort.knockT,undefined);
  const start={x:target.x,y:target.y};giant.x=20;giant.y=20;giant.cooldown=1e9;
  for(let i=0;i<30;i++)step(g,.02);
  assert.ok(target.x-start.x>.75,'The main club hit visibly moves an infantry victim.');
  assert.ok(splash.x>31.2&&splash.y>31,'Splash shoves survivors radially away from the giant.');
});

test('Giant knockback respects defensive resistance, buildings, terrain and exact-overlap positions',()=>{
  const g=fixture('bone'),giant=g.addUnit(0,'giant',31.5,40),victim=g.addUnit(1,'infantry',32.5,40);
  victim.hp=victim.maxHp=1000;victim.cooldown=1e9;g.hold([victim.id]);g.hash.rebuild(g.units);
  g.attack(giant,victim);const ordinary=Math.hypot(victim.knockVX,victim.knockVY);victim.resolveUntil=100;g.attack(giant,victim);assert.ok(Math.hypot(victim.knockVX,victim.knockVY)<ordinary*.7);
  for(let y=0;y<g.H;y++)g.tiles[y*g.W+33].terrain='water';g.navigation.invalidate();giant.x=20;giant.y=20;giant.cooldown=1e9;
  for(let i=0;i<35;i++){step(g,.02);assert.ok(victim.x<33);assert.ok(g.isWalkable(victim.x,victim.y));}
  const fort=g.addBuilding(1,'barracks',20.5,20);g.attack(giant,fort);assert.equal(fort.knockT,undefined,'Buildings are never displaced.');
  const overlap=g.addUnit(1,'infantry',giant.x,giant.y);overlap.hp=1000;g.hash.rebuild(g.units);g.attack(giant,overlap);assert.ok(Number.isFinite(overlap.knockVX)&&Number.isFinite(overlap.knockVY));assert.ok(Math.hypot(overlap.knockVX,overlap.knockVY)>0);
  const shield=g.addUnit(1,'shield_bearer',giant.x+1,giant.y);shield.hp=shield.maxHp=1000;shield.facingX=-1;shield.facingY=0;g.hash.rebuild(g.units);g.attack(giant,shield);const front=Math.hypot(shield.knockVX,shield.knockVY);shield.facingX=1;g.attack(giant,shield);assert.ok(Math.hypot(shield.knockVX,shield.knockVY)>front*1.7,'A frontal greatshield resists the shove, but its rear does not.');
});

test('A giant attacking a building shoves nearby enemy defenders while the structure stays fixed',()=>{
  const g=fixture('bone'),giant=g.addUnit(0,'giant',29,30),fort=g.addBuilding(1,'barracks',30,30),defender=g.addUnit(1,'infantry',30,30.8),friendly=g.addUnit(0,'infantry',30,29.8);
  defender.hp=defender.maxHp=1000;g.hash.rebuild(g.units);g.attack(giant,fort);
  assert.equal(fort.x,30);assert.equal(fort.y,30);assert.equal(fort.knockT,undefined);assert.ok(defender.knockVX>0&&defender.knockVY>0);assert.equal(friendly.knockT,0);
});

test('Giant Camps muster only one giant per very long production interval and respect supply',()=>{
  const g=fixture('bone'),camp=g.addBuilding(0,'giant_camp',20,20),definition=BUILD_DEFS.giant_camp;
  assert.equal(definition.interval,130);assert.equal(definition.batch,1);
  g.updateBuildings(129.99);assert.equal(g.units.length,0);
  g.updateBuildings(.02);assert.equal(g.units.length,1);assert.equal(g.units[0].type,'giant');
  g.teams[0].cap=1;g.updateBuildings(260);assert.equal(g.units.length,1);
  g.teams[0].cap=2;g.updateBuildings(.01);assert.equal(g.units.length,2);
  assert.equal(camp.spawnTimer,0);
});

test('Paid giants cannot bypass the slow camp muster and share its automatic training cycle',()=>{
  const g=fixture('bone'),camp=g.addBuilding(0,'giant_camp',20,20);
  g.updateBuildings(100);assert.equal(g.units.length,0);
  assert.equal(g.recruit('giant').ok,true);assert.equal(g.units.length,1);assert.equal(camp.spawnTimer,0);
  const gold=g.teams[0].gold;assert.equal(g.recruit('giant').ok,false);assert.equal(g.teams[0].gold,gold);assert.equal(g.recruitDetails('giant').remaining,130);
  g.updateBuildings(129.99);assert.equal(g.units.length,1);assert.equal(g.recruit('giant').ok,false);
  g.updateBuildings(.02);assert.equal(g.units.length,2);assert.equal(g.recruit('giant').ok,false,'An automatic giant also restarts the camp cooldown.');
  const second=g.addBuilding(0,'giant_camp',28,20);assert.equal(g.recruit('giant').ok,true);assert.equal(g.units.length,3);
  assert.equal(second.musterCooldown,130);assert.equal(g.recruit('giant').ok,false,'Each camp keeps its own single-giant muster cadence.');
});

test('Tully sharpshooters shoot beyond archer range but reload much more slowly',()=>{
  const g=fixture('fish'),shooter=g.addUnit(0,'sharpshooter',30,30),target=g.addUnit(1,'infantry',35.8,30);
  shooter.cooldown=0;shooter.seek=0;g.hold([shooter.id]);g.hold([target.id]);target.cooldown=100;
  assert.ok(UNIT_DEFS.sharpshooter.range>UNIT_DEFS.archer.range*1.6);
  assert.ok(UNIT_DEFS.sharpshooter.rate>UNIT_DEFS.archer.rate*2);
  step(g,.01);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].sourceType,'sharpshooter');
  for(let i=0;i<30;i++)step(g,.1);assert.equal(g.projectiles.length,1);
  for(let i=0;i<5;i++)step(g,.1);assert.equal(g.projectiles.length,2);
});

console.log(`${checks} conquest regiment checks passed.`);
