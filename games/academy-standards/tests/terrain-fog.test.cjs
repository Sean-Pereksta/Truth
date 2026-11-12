const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');

function loadGame(){
  const elements=new Map();
  const noop=()=>{};
  const drawing=new Proxy({},{get:()=>noop});
  function element(id){
    if(!elements.has(id))elements.set(id,{style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>drawing,getBoundingClientRect:()=>({width:1200,height:720,left:0,top:0}),addEventListener:noop,setAttribute:noop,querySelectorAll:()=>[],click(){this.onclick?.();}});
    return elements.get(id);
  }
  const context={console,Math,Date,Set,Map,Uint8Array,devicePixelRatio:1,addEventListener:noop,requestAnimationFrame:noop,document:{getElementById:element,querySelectorAll:()=>[]},AcademyUI:noop};
  context.window=context;
  vm.createContext(context);
  const root=path.join(__dirname,'..');
  if(fs.existsSync(path.join(root,'equipment.js')))vm.runInContext(fs.readFileSync(path.join(root,'equipment.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'engine.js'),'utf8'),context);
  return {A:context.Academy,T:context.AcademyTest};
}

const start=performance.now();
const {A,T}=loadGame(),g=A.game;
assert.ok(g.terrain.forestRects.length>=20,'map contains abundant woodland');
assert.ok(g.terrain.marshes.length>=10&&g.terrain.ridges.length>=10&&g.terrain.ruins.length>=10,'map has new terrain families');
for(const student of g.students)assert.ok(T.terrainClear(student.x,student.y,student.radius),`${student.id} spawned on traversable ground`);

const originalSave=A.exportSave();
const remotePoint={x:4400,y:4800},remoteIndex=Math.floor(remotePoint.y/A.VISION_TILE)*A.VISION_COLS+Math.floor(remotePoint.x/A.VISION_TILE);
originalSave.game.fogExplored.player[remoteIndex]=1;
assert.equal(A.importSave(originalSave).ok,true,'new terrain and explored map round-trip');
assert.ok(A.isExplored('player',remotePoint.x,remotePoint.y),'saved exploration beyond current sight survives import');
assert.equal(A.canSee('player',remotePoint.x,remotePoint.y),false,'imported exploration does not grant current vision');
const oldSave=JSON.parse(JSON.stringify(originalSave));
delete oldSave.game.fogExplored;
for(const name of ['marshes','ridges','ruins','roads'])delete oldSave.game.terrain[name];
assert.equal(A.importSave(oldSave).ok,true,'existing trial saves remain loadable');
const differentTerrainSave=JSON.parse(JSON.stringify(originalSave));
differentTerrainSave.game.terrain.forestRects=[];differentTerrainSave.game.terrain.marshes=[];
assert.equal(A.importSave(differentTerrainSave).ok,true);
assert.equal(A.terrainAt(600,500).type,'grass','imported terrain changes the cached profiles');
A.init();
assert.equal(A.terrainAt(600,500).type,'forest','starting a new trial rebuilds woodland profiles after an import');
assert.equal(A.terrainAt(1260,1180).type,'marsh','starting a new trial rebuilds marsh profiles after an import');
assert.equal(A.isExplored('player',remotePoint.x,remotePoint.y),false,'a new trial starts with a fresh explored map');

function sandbox(terrain={}){
  g.terrain={dirt:[],waters:[],rivers:[],forestRects:[],hills:[],stones:[],marshes:[],ridges:[],ruins:[],roads:[],...terrain};
  g.barricades=[];g.traps=[];g.lootBoxes=[];g.groundLoot=[];g.visibility={};g.visibilityAt=-1;
  for(const s of g.students){s.state='knocked';s.koUntil=1e9;s.carryingStandard=null;s.attackAction=null;s.engageId=null;}
  T.rebuildWalkableGrid();
}
function troop(id,x,y){const s=g.students.find(s=>s.id===id);Object.assign(s,{state:'idle',x,y,tx:x,ty:y,hp:100,attackCd:0,path:[],pathIndex:0,order:{type:'idle',x,y,manual:false,targetId:null,targetType:null}});return s;}

sandbox({forestRects:[{x:1000,y:1000,w:280,h:200}],marshes:[{x:1500,y:1100,rx:120,ry:100}],ridges:[{x:1800,y:1000,w:80,h:280}],ruins:[{x:2200,y:1100,r:120}],hills:[{x:2600,y:1100,r:130}],roads:[{width:80,points:[{x:2900,y:1000},{x:3300,y:1000}]}]});
assert.ok(T.terrainClear(1100,1100),'woodland can be crossed');
assert.equal(T.terrainClear(1840,1100),false,'ridge blocks movement');
assert.equal(A.terrainAt(1100,1100).type,'forest');
assert.equal(A.terrainAt(1500,1100).type,'marsh');
assert.ok(A.terrainMoveFactor({x:1500,y:1100,mount:true})<A.terrainMoveFactor({x:1500,y:1100,mount:false}),'marsh penalizes cavalry more');
assert.ok(A.terrainAt(2600,1100).sight>1,'high ground increases sight');
assert.ok(A.terrainAt(3100,1000).speed>1,'roads accelerate movement');
assert.equal(A.lineOfSight(1740,1100,1960,1100),false,'ridge blocks sight');
assert.equal(A.lineOfSight(960,1100,1320,1100),false,'dense woodland blocks sight through the grove');
assert.equal(A.lineOfSight(1040,1100,1100,1100),true,'close combat is possible within woodland');

sandbox();
const scout=troop('player_0',1000,1000),other=troop('player_1',1900,1000),enemy=troop('mars_0',1100,1000);
A.refreshVisibility(true);
assert.ok(A.isVisibleTo('player',enemy),'enemy in unobstructed team sight is visible');
assert.ok(A.canSee('player',2000,1000),'separate friendly squads share sight');
assert.ok(A.isExplored('player',2000,1000));
other.state='knocked';A.refreshVisibility(true);
assert.equal(A.canSee('player',2000,1000),false,'a knocked scout supplies no vision');
assert.ok(A.isExplored('player',2000,1000),'exploration persists after vision is lost');
enemy.x=1600;A.refreshVisibility(true);
assert.equal(A.isVisibleTo('player',enemy),false);
assert.equal(A.isVisibleTo('player',{houseId:'player',controller:'player',x:enemy.x,y:enemy.y,carriedBy:enemy.id}),false,'a stolen friendly banner does not reveal its hidden carrier');
assert.equal(A.isVisibleTo('player',{houseId:'player',controller:'player',x:enemy.x,y:enemy.y,carriedBy:null,dropped:true}),false,'a friendly banner dropped beyond sight does not reveal its position');
assert.equal(A.hitStudent(enemy.x,enemy.y),null,'hidden enemies cannot be clicked');
g.lootBoxes=[{id:'box_hidden',x:1600,y:1000,alive:true}];
assert.equal(A.hitBox(1600,1000),null,'hidden loot cannot be clicked');

sandbox({forestRects:[{x:1120,y:960,w:80,h:120}]});
troop('player_0',900,1000);const hidden=troop('mars_0',1160,1000);A.refreshVisibility(true);
assert.equal(A.isVisibleTo('player',hidden),false,'woodland conceals distant troops even near its edge');
troop('player_0',1080,1000);A.refreshVisibility(true);
assert.ok(A.isVisibleTo('player',hidden),'approaching scouts reveal troops in cover');

sandbox({ridges:[{x:1100,y:920,w:80,h:200}]});
const archer=troop('player_0',1040,1000),victim=troop('mars_0',1220,1000);
archer.weapon='Longbow';archer.weaponLevel=1;A.applyLoadout(archer);A.refreshVisibility(true);
assert.equal(T.beginAttack(archer,victim),false,'archers cannot shoot through an opaque ridge');

sandbox({marshes:[{x:1200,y:1000,rx:220,ry:120}]});
const route=T.pathfind(820,1020,1580,1020);
const marshSteps=route.filter(p=>A.terrainAt(p.x,p.y).type==='marsh').length;
assert.ok(marshSteps<8,'route finder prefers a faster detour around broad marshland');
for(const p of route)assert.ok(T.terrainClear(p.x,p.y,16),'route remains traversable');

sandbox();
const pursuer=troop('player_0',1000,1000),runner=troop('mars_0',1100,1000);
A.refreshVisibility(true);A.setOrder(pursuer,{type:'attack',x:runner.x,y:runner.y,targetId:runner.id,targetType:'student',manual:true});
runner.x=1800;A.refreshVisibility(true);g.paused=false;A.update(.033);g.paused=true;
assert.equal(pursuer.order.targetId,null,'pursuit drops live tracking once the target is hidden');
assert.equal(pursuer.order.x,1100,'pursuit retains only the last known position');

sandbox();
const capturer=troop('player_0',1000,1000),carrier=troop('mars_0',1800,1000);
const banner=g.standards.find(s=>s.houseId==='mars');
Object.assign(banner,{controller:'mars',x:carrier.x,y:carrier.y,carriedBy:carrier.id,dropped:false});
carrier.carryingStandard='mars';
A.setOrder(capturer,{type:'capture',x:1120,y:1000,targetId:'mars',targetType:'standard',manual:true});
A.refreshVisibility(true);g.paused=false;A.update(.033);g.paused=true;
assert.equal(capturer.order.targetId,'mars','a capture order does not lock onto an unseen carrier');
assert.equal(capturer.order.x,1120,'capture orders retain the last observed banner position');
const beforeLog=g.logs.length;
T.knockOut(carrier,{controller:'player'});
assert.equal(g.logs.length,beforeLog,'unseen enemy knockout and dropped gear do not appear in the player log');

function travel(terrain){
  sandbox(terrain);
  for(const house of g.houses)house.ai.thinkAt=1e9;
  const s=troop('player_0',1000,1000);s.carryingStandard=null;
  A.setOrder(s,{type:'move',x:1260,y:1000,manual:true});
  A.refreshVisibility(true);g.paused=false;
  for(let step=0;step<20;step++)A.update(.033);
  g.paused=true;return Math.hypot(s.x-1000,s.y-1000);
}
const flatTravel=travel({}),marshTravel=travel({marshes:[{x:1100,y:1000,rx:500,ry:400}]});
assert.ok(marshTravel<flatTravel*.7,'terrain penalties change actual troop movement');
console.log(`Terrain/fog tests passed (${Math.round(performance.now()-start)} ms).`);
