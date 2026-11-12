import assert from 'node:assert/strict';
import {Game} from '../../core.js';
import {WarVision} from '../../vision.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({fogOfWar:true,landscape:'open',scale:'standard',enemies:3,seed:44277,...config});
  g.units=[];g.buildings=[];g.castles=[];g.byId.clear();g.projectiles=[];g.effects=[];
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=-1;t.claim=-1;t.capture=0;}
  for(const s of g.teams){s.alive=true;s.count=0;s.cap=1000;s.aiClock=1e9;s.gold=10000;}
  g.navigation.invalidate();g.hash.rebuild(g.units);g.vision=new WarVision(g);return g;
}
const refresh=g=>{g.hash.rebuild(g.units);g.vision.update(true);};

test('Fog is optional and disabled games retain complete combat and structure knowledge',()=>{
  const g=fixture({fogOfWar:false}),u=g.addUnit(1,'infantry',70.5,70.5),b=g.addBuilding(1,'keep',75.5,75.5);
  assert.equal(g.isVisibleTo(0,u),true);assert.ok(g.knownUnits(0).includes(u));assert.ok(g.knownBuildings(0).includes(b));assert.equal(g.vision.gridFor(0),null);
});

test('Factions only see enemies inside their own sight and cavalry scouts see farther',()=>{
  const g=fixture(),foot=g.addUnit(0,'infantry',20.5,20.5),enemy=g.addUnit(1,'infantry',27.5,20.5);refresh(g);
  assert.equal(g.isVisibleTo(0,enemy),false);assert.equal(g.isVisibleTo(1,foot),false);assert.equal(g.knownUnits(0).some(u=>u.id===enemy.id),false);
  const scout=g.addUnit(0,'cavalry',20.5,20.5);refresh(g);assert.equal(g.isVisibleTo(0,enemy),true);assert.equal(g.isVisibleTo(1,scout),false);
  scout.hp=0;refresh(g);assert.equal(g.isVisibleTo(0,enemy),false,'Dead scouts provide no vision.');
});

test('Allied houses share sight without sharing it with opposing alliances',()=>{
  const g=fixture({mode:'team-conquest'}),ally=g.addUnit(1,'cavalry',45.5,40.5),enemy=g.addUnit(2,'infantry',52.5,40.5);refresh(g);
  assert.equal(g.isVisibleTo(0,enemy),true);assert.equal(g.isVisibleTo(3,ally),false);assert.equal(g.vision.gridFor(0),g.vision.gridFor(1));assert.notEqual(g.vision.gridFor(0),g.vision.gridFor(2));
});

test('Watchtowers reveal a broad frontier and each tower level expands its sight',()=>{
  const g=fixture(),tower=g.addBuilding(0,'tower',20.5,20.5),enemy=g.addUnit(1,'infantry',34.5,20.5);refresh(g);
  assert.equal(g.vision.sightRadius(tower),12);assert.equal(g.isVisibleTo(0,enemy),false);
  tower.level=2;refresh(g);assert.equal(g.vision.sightRadius(tower),15);assert.equal(g.isVisibleTo(0,enemy),true);
  enemy.x=37.5;tower.level=3;refresh(g);assert.equal(g.vision.sightRadius(tower),18);assert.equal(g.isVisibleTo(0,enemy),true);
  tower.hp=0;refresh(g);assert.equal(g.isVisibleTo(0,enemy),false);
});

test('Unseen new buildings and castle sites are unknown until scouting reaches them',()=>{
  const g=fixture(),scout=g.addUnit(0,'cavalry',20.5,20.5),enemy=g.addBuilding(1,'keep',50.5,45.5),ruin=g.createCastleSite({x:60.5,y:45.5});refresh(g);
  assert.equal(g.knownBuildings(0).some(b=>b.id===enemy.id),false);assert.equal(g.knownCastleSites(0).some(s=>s.id===ruin.id),false);
  scout.x=55.5;scout.y=45.5;refresh(g);assert.ok(g.knownBuildings(0).some(b=>b.id===enemy.id));assert.ok(g.knownCastleSites(0).some(s=>s.id===ruin.id));
});

test('Last-seen buildings freeze health, level and ownership until the location is revisited',()=>{
  const g=fixture(),scout=g.addUnit(0,'cavalry',30.5,30.5),enemy=g.addBuilding(1,'tower',35.5,30.5);enemy.hp=800;refresh(g);
  assert.equal(g.knownBuildings(0).find(b=>b.id===enemy.id),enemy);scout.x=10.5;scout.y=10.5;g.time=1;refresh(g);
  enemy.hp=200;enemy.level=3;enemy.team=2;g.time=2;refresh(g);
  const memory=g.knownBuildings(0).find(b=>b.id===enemy.id);assert.equal(memory.remembered,true);assert.equal(memory.hp,800);assert.equal(memory.level,1);assert.equal(memory.team,1);assert.equal(memory.lastSeen,0);assert.ok(Object.isFrozen(memory));
  scout.x=30.5;scout.y=30.5;refresh(g);const current=g.knownBuildings(0).find(b=>b.id===enemy.id);assert.equal(current,enemy);assert.equal(current.team,2);assert.equal(current.level,3);
});

test('A building destroyed out of sight remains a ghost until rescout confirms its absence',()=>{
  const g=fixture(),scout=g.addUnit(0,'cavalry',30.5,30.5),enemy=g.addBuilding(1,'tower',35.5,30.5);refresh(g);
  scout.x=10.5;scout.y=10.5;g.time=1;refresh(g);enemy.hp=0;g.buildings=g.buildings.filter(b=>b.hp>0);g.byId.delete(enemy.id);g.time=2;refresh(g);
  assert.equal(g.knownBuildings(0).find(b=>b.id===enemy.id).hp,enemy.maxHp,'Hidden destruction cannot update the remembered picture.');
  scout.x=30.5;scout.y=30.5;refresh(g);assert.equal(g.knownBuildings(0).some(b=>b.id===enemy.id),false);
});

test('Castle capture state and territorial ownership remain deliberately stale outside sight',()=>{
  const g=fixture(),scout=g.addUnit(0,'cavalry',30.5,30.5),site=g.createCastleSite({x:35.5,y:30.5}),tile=g.tileAt(35.5,31.5);tile.owner=1;refresh(g);
  scout.x=10.5;scout.y=10.5;g.time=1;refresh(g);site.team=2;site.ruined=false;site.progress[1]=30;tile.owner=2;g.time=2;refresh(g);
  const memory=g.knownCastleSites(0).find(s=>s.id===site.id);assert.equal(memory.ruined,true);assert.equal(memory.team,-1);assert.equal(memory.progress[1],0);assert.equal(g.vision.ownersFor(0)[tile.y*g.W+tile.x],1);
  scout.x=30.5;scout.y=30.5;refresh(g);assert.equal(g.knownCastleSites(0).find(s=>s.id===site.id).team,2);assert.equal(g.vision.ownersFor(0)[tile.y*g.W+tile.x],2);
});

test('Troops cannot acquire or fire at hidden targets and drop enemies that leave sight',()=>{
  const g=fixture(),siege=g.addUnit(0,'trebuchet',20.5,20.5),enemy=g.addUnit(1,'infantry',29.5,20.5);siege.setupProgress=15;siege.cooldown=0;refresh(g);
  assert.equal(g.findTarget(siege),null);g.attack(siege,enemy);assert.equal(g.projectiles.length,0);
  const scout=g.addUnit(0,'cavalry',24.5,20.5);refresh(g);assert.equal(g.findTarget(siege),enemy);g.attack(siege,enemy);assert.equal(g.projectiles.length,1);
  siege.target=enemy;scout.hp=0;g.time=1;refresh(g);g.updateUnits(.01);assert.equal(siege.target,null);assert.equal(g.projectiles.length,1,'Already launched attacks may finish, but no new hidden shot is launched.');
});

test('Nearest-enemy commands use visible armies and remembered structures without tracking hidden motion',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',20.5,20.5),enemy=g.addUnit(1,'infantry',60.5,20.5),b=g.addBuilding(1,'barracks',28.5,20.5);refresh(g);
  horse.x=10.5;g.time=1;refresh(g);const remembered=g.knownBuildings(0).find(e=>e.id===b.id);assert.ok(remembered.remembered);
  const result=g.attackNearest([horse.id]);assert.equal(result.ok,true);assert.equal(horse.order.groupX,b.x);assert.equal(horse.target,null);
  const empty=fixture(),u=empty.addUnit(0,'cavalry',20.5,20.5);empty.addUnit(1,'infantry',60.5,20.5);refresh(empty);assert.equal(empty.attackNearest([u.id]).ok,false);
  assert.equal(enemy.x,60.5);
});

test('Visibility refresh is bounded and preserves explored terrain after scouts leave',()=>{
  const g=fixture(),scout=g.addUnit(0,'cavalry',30.5,30.5);refresh(g);const index=30*g.W+30,revision=g.vision.revision;
  scout.x=60.5;g.time=.1;g.vision.update();assert.equal(g.vision.revision,revision);g.time=.21;g.vision.update();assert.equal(g.vision.revision,revision+1);assert.equal(g.vision.gridFor(0)[index],0);assert.equal(g.vision.exploredFor(0)[index],1);
});

test('Firestorm cannot find or rank hidden enemy groups beyond the selected army sight',()=>{
  const g=fixture({house:2}),soldier=g.addUnit(0,'infantry',30.5,30.5),enemy=g.addUnit(1,'infantry',37.5,30.5);refresh(g);
  const status=g.powerStatus(0);assert.equal(status.name,'Firestorm');assert.equal(g.useHousePower([soldier.id]).ok,false);assert.equal(g.fireZones.length,0);assert.equal(g.teams[0].powerReadyAt,0);
  const scout=g.addUnit(0,'cavalry',32.5,30.5);refresh(g);assert.equal(g.isVisibleTo(0,enemy),true);assert.equal(g.useHousePower([soldier.id]).ok,true);assert.equal(g.fireZones.length,1);assert.equal(g.fireZones[0].x,enemy.x);assert.equal(g.fireZones[0].y,enemy.y);
  assert.ok(scout.hp>0);
});

console.log(`${cases} vision and intelligence checks passed.`);
