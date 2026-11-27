import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {CONQUEST_BUILDINGS,regimentAllowed,regimentForHouse,regimentBuildingForHouse} from '../../regiments.js';
import {placeFormation} from '../../formation-placement.js';

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

test('Both player houses queue deployment at their assigned slot and ignore later army moves',()=>{
  for(const house of ['flayed','beacon']){
    const g=fixture(house),engine=g.addUnit(0,'trebuchet',30,30),guard=g.addUnit(0,'infantry',26,30);
    const ids=[engine.id,guard.id];
    g.command(ids,33,30,'move','line');
    const destination={x:engine.order.x,y:engine.order.y};
    assert.equal(g.setTrebuchetDeployment(ids,true,true).ok,true);
    assert.equal(engine.order.setupOnArrival,true);
    g.command(ids,27,30,'move','line');
    assert.equal(guard.order.groupX,27);
    for(let i=0;i<700&&engine.trebuchetState==='packed';i++)step(g,.05);
    assert.equal(engine.trebuchetState,'settingUp');
    assert.ok(Math.hypot(engine.x-destination.x,engine.y-destination.y)<.23);
    const anchor=[engine.x,engine.y];
    guard.x=engine.x;guard.y=engine.y;
    engine.knockVX=7;engine.knockVY=3;engine.knockT=engine.knockDuration=.4;
    g.command(ids,45,42,'move');g.hold(ids);g.retreat(ids);
    for(let i=0;i<200;i++)step(g,.05);
    assert.equal(engine.trebuchetState,'deployed');
    assert.deepEqual([engine.x,engine.y],anchor);
  }
});
test('Take down is available during setup and while setup is queued',()=>{
  const g=fixture('beacon'),u=g.addUnit(0,'trebuchet',30,30);
  g.command([u.id],34,30,'move');
  g.setTrebuchetDeployment([u.id],true,true);
  assert.equal(g.setTrebuchetDeployment([u.id],false).ok,true);
  assert.equal(u.order.setupOnArrival,undefined);
  assert.equal(u.order.mode,'move');
  g.setTrebuchetDeployment([u.id],true);step(g,1);
  assert.equal(g.setTrebuchetDeployment([u.id],false).ok,true);
  step(g,4.9);assert.equal(u.trebuchetState,'takingDown');
  step(g,.1);assert.equal(u.trebuchetState,'packed');
});
test('AI trebuchets still deploy after fifteen stationary seconds',()=>{
  const g=fixture(),u=g.addUnit(1,'trebuchet',30,30);
  g.hold([u.id]);for(let i=0;i<151;i++)step(g,.1);
  assert.equal(u.setupProgress,15);
  g.command([u.id],34,30,'move');step(g,.1);assert.equal(u.setupProgress,0);
});

test('Trebuchets outrange ordinary siege and bombard buildings heavily with a slow reload',()=>{
  const g=fixture('beacon'),engine=g.addUnit(0,'trebuchet',30,30),fort=g.addBuilding(1,'barracks',40,30);
  assert.ok(UNIT_DEFS.trebuchet.range>UNIT_DEFS.siege.range*1.8);
  assert.ok(UNIT_DEFS.trebuchet.rate>UNIT_DEFS.siege.rate*2);
  g.setTrebuchetDeployment([engine.id],true);step(g,10);g.projectiles=[];engine.cooldown=0;g.hash.rebuild(g.units);g.attack(engine,fort);
  const shot=g.projectiles[0];assert.equal(shot.type,'rock');assert.equal(shot.splash,1.7);
  const hp=fort.hp;g.updateProjectiles(shot.duration);assert.ok(hp-fort.hp>=540);
});

test('Catapult and trebuchet earth bursts spawn only where the projectile lands',()=>{
  const g=fixture('beacon'),fort=g.addBuilding(1,'barracks',40,30);
  let catapultLife=0;
  for(const [type,kind] of [['siege','catapult'],['trebuchet','trebuchet']]){
    g.effects=[];
    const engine=g.addUnit(0,type,36,30);
    if(type==='trebuchet'){g.setTrebuchetDeployment([engine.id],true);step(g,10);g.projectiles=[];g.effects=[];}
    g.attack(engine,fort);
    const shot=g.projectiles[0];
    g.updateProjectiles(shot.duration/2);
    assert.equal(g.effects.length,0);
    g.updateProjectiles(shot.duration/2);
    const burst=g.effects.find(effect=>effect.type==='explosion');
    assert.deepEqual([burst.kind,burst.x,burst.y,burst.radius],[kind,fort.x,fort.y,shot.splash]);
    if(kind==='catapult')catapultLife=burst.maxLife;
    else assert.ok(burst.maxLife>catapultLife);
  }
});

test('Bolton trebuchets set up in 10 seconds and take down in 5, with no automatic deployment or fire during transitions',()=>{
  const g=fixture(),engine=g.addUnit(0,'trebuchet',30,30),fort=g.addBuilding(1,'barracks',38,30);
  engine.cooldown=0;
  for(let i=0;i<200;i++)step(g,.1);
  assert.equal(engine.trebuchetState,'packed');
  assert.equal(g.projectiles.length,0);
  g.command([engine.id],34,30,'move');
  assert.equal(g.setTrebuchetDeployment([engine.id],true).ok,true);
  assert.equal(g.setTrebuchetDeployment([engine.id],true).ok,false);
  for(let i=0;i<199;i++)step(g,.05);
  assert.equal(engine.trebuchetState,'settingUp');
  assert.equal(g.projectiles.length,0);
  step(g,.05);
  assert.equal(engine.trebuchetState,'deployed');
  assert.equal(g.projectiles[0].target,fort.id);
  assert.equal(g.setTrebuchetDeployment([engine.id],false).ok,true);
  engine.cooldown=0;
  for(let i=0;i<99;i++)step(g,.05);
  assert.equal(engine.trebuchetState,'takingDown');
  assert.equal(g.projectiles.length,1);
  assert.equal(g.command([engine.id],34,30,'move').ok,false);
  step(g,.05);
  assert.equal(engine.trebuchetState,'packed');
  assert.deepEqual([engine.x,engine.y],[30,30],'Ignored movement orders are never resumed.');
  g.command([engine.id],34,30,'move');
  step(g,.05);
  assert.ok(engine.x>30);
});

test('Bolton trebuchets stay put through mixed movement orders and can fire at a designated target in range',()=>{
  const g=fixture(),engine=g.addUnit(0,'trebuchet',30,30),troop=g.addUnit(0,'infantry',30.35,30);
  const fort=g.addBuilding(1,'barracks',40,30),distant=g.addBuilding(1,'barracks',52,30);
  g.setTrebuchetDeployment([engine.id],true);
  for(let i=0;i<200;i++)step(g,.05);
  const ids=[engine.id,troop.id];
  g.command(ids,35,30,'move','line',{x:1,y:0});assert.equal(troop.order.mode,'move');
  assert.equal(g.advance(ids,'line',{}, {x:35,y:30}).count,1);
  assert.equal(placeFormation(g,ids,{x:35,y:30},UNIT_DEFS).count,1);
  assert.equal(g.expand(ids).ok,true);
  assert.equal(g.attackNearest(ids).count,1);
  assert.equal(g.attackTarget([engine.id],distant.id).ok,false);
  assert.equal(g.attackTarget(ids,fort.id).count,2);
  assert.equal(engine.order.targetId,fort.id);
  g.retreat(ids);assert.equal(troop.order.retreat,true);
  g.idle(ids);
  for(let i=0;i<10;i++)step(g,.05);
  assert.equal(engine.order.mode,'hold');
  assert.deepEqual([engine.x,engine.y],[30,30],'Crowds and mixed orders cannot move a deployed engine.');
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
  const shield=g.addUnit(1,'shield_bearer',giant.x+1,giant.y);shield.hp=shield.maxHp=1000;shield.facingX=-1;shield.facingY=0;shield.shieldGuard='guard';g.hash.rebuild(g.units);g.attack(giant,shield);const front=Math.hypot(shield.knockVX,shield.knockVY);shield.facingX=1;g.attack(giant,shield);assert.ok(Math.hypot(shield.knockVX,shield.knockVY)>front*1.7,'A frontal greatshield resists the shove, but its rear does not.');
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
  step(g,.2);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].sourceType,'sharpshooter');
  for(let i=0;i<30;i++)step(g,.1);assert.equal(g.projectiles.length,1);
  for(let i=0;i<24;i++)step(g,.1);assert.equal(g.projectiles.length,2);
});

console.log(`${checks} conquest regiment checks passed.`);
