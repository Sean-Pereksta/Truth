import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,seed:44277,...config});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.owner=-1;t.claim=-1;t.capture=0;}
  for(const s of g.teams){s.count=0;s.cap=1000;s.alive=true;s.aiClock=1e9;s.home={x:30.5,y:30.5};s.rally=null;}
  own(g,20,20,41,41);g.navigation.invalidate();g.hash.rebuild(g.units);g.recount();return g;
}
function own(g,x0,y0,x1,y1,team=0){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)g.tiles[y*g.W+x].owner=team;}
function step(g,seconds){for(let i=0;i<Math.round(seconds*30);i++){g.time+=1/30;g.hash.rebuild(g.units);g.updateUnits(1/30);}}

test('Patrol accepts only the issuing living house\'s cavalry and preserves excluded soldiers',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',30,30),champion=g.addUnit(0,'lance_champion',31,30),rider=g.addUnit(0,'storm_rider',32,30),foot=g.addUnit(0,'infantry',30,31),enemy=g.addUnit(1,'cavalry',30,32),dead=g.addUnit(0,'cavalry',30,33);
  g.hold([foot.id,enemy.id]);const oldFoot=foot.order,oldEnemy=enemy.order;dead.hp=0;
  const r=g.patrol([horse.id,champion.id,rider.id,foot.id,enemy.id,dead.id,horse.id,-1]);
  assert.equal(r.ok,true);assert.equal(r.count,3);for(const u of [horse,champion,rider])assert.equal(u.order.mode,'patrol');assert.equal(foot.order,oldFoot);assert.equal(enemy.order,oldEnemy);
  assert.equal(g.patrol([foot.id,enemy.id]).ok,false);assert.equal(g.patrol([enemy.id],1).count,1);
});

test('A patrol group spreads across owned perimeter waypoints rather than piling onto one tile',()=>{
  const g=fixture(),troops=Array.from({length:8},(_,i)=>g.addUnit(0,'cavalry',29+i*.35,30));g.patrol(troops.map(u=>u.id));
  assert.equal(new Set(troops.map(u=>u.order.patrolTile)).size,troops.length);
  for(const u of troops){assert.ok(g.isPatrolEdge(u.order.patrolTile,0));assert.equal(g.tileAt(u.order.x,u.order.y).owner,0);assert.ok(g.navigation.route(u,u.order,'cavalry').reachable);}
  const scans=g.patrolScans;for(let i=0;i<4;i++){g.time+=.5;g.updatePatrolOrders();}assert.equal(g.patrolScans,scans,'The edge scan is shared and cached, not repeated for every horse or frame.');
});

test('Patrol engages nearby enemies and resumes visiting successive edge points without charging',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',30,30),foe=g.addUnit(1,'infantry',31,30);foe.cooldown=1e9;g.hold([foe.id]);g.patrol([horse.id]);
  const visited=new Set([horse.order.patrolTile]),order=horse.order;let nearEdge=false,engaged=false;
  for(let i=0;i<900;i++){g.time+=1/30;g.hash.rebuild(g.units);g.updateUnits(1/30);visited.add(horse.order.patrolTile);nearEdge||=Math.hypot(horse.x-horse.order.x,horse.y-horse.order.y)<1;engaged||=horse.target===foe;assert.equal(horse.order,order);assert.equal(horse.order.mode,'patrol');assert.equal(horse.charging,false);assert.ok(g.isWalkable(horse.x,horse.y));}
  assert.ok(engaged);assert.ok(foe.hp<foe.maxHp,'A patrol must attack nearby opposition.');assert.ok(nearEdge);assert.ok(visited.size>=3,'Continuous patrol must resume and advance after combat, rather than becoming Hold.');assert.equal(g.stats.chargeImpacts,0);assert.equal(g.projectiles.length,0);
});

test('New Move, Attack, Hold, Expand and Retreat orders replace a patrol permanently',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',30,30);
  for(const replace of [()=>g.command([horse.id],32,32,'move'),()=>g.command([horse.id],32,32,'attack'),()=>g.hold([horse.id]),()=>g.expand([horse.id]),()=>g.retreat([horse.id])]){
    g.patrol([horse.id]);replace();assert.notEqual(horse.order.mode,'patrol');g.time+=4;g.updatePatrolOrders();assert.notEqual(horse.order.mode,'patrol');
  }
});

test('Patrol follows a changing border and safely waits when no owned perimeter remains',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',30,30);g.patrol([horse.id]);const old=horse.order.patrolTile;
  own(g,20,20,41,41,-1);own(g,25,25,36,36);g.recount();g.time+=3.1;g.updatePatrolOrders();assert.notEqual(horse.order.patrolTile,old);assert.ok(g.isPatrolEdge(horse.order.patrolTile,0));
  own(g,25,25,36,36,-1);g.recount();g.time+=3.1;g.updatePatrolOrders();assert.equal(horse.order.patrolTile,null);assert.equal(horse.order.x,horse.x);assert.equal(horse.order.y,horse.y);assert.equal(horse.order.mode,'patrol');
  own(g,27,27,34,34);g.recount();g.time+=3.1;g.updatePatrolOrders();assert.ok(g.isPatrolEdge(horse.order.patrolTile,0));
});

test('Disconnected land and blocked shorelines cannot send patrols to unreachable territory',()=>{
  const g=fixture();for(let y=1;y<g.H-1;y++)g.tiles[y*g.W+45].terrain='water';own(g,60,20,76,36);g.navigation.invalidate();
  const horse=g.addUnit(0,'cavalry',30,30);g.patrol([horse.id]);for(let i=0;i<12;i++){assert.ok(horse.order.x<45);assert.ok(g.navigation.route(horse,horse.order,'cavalry').reachable);horse.x=horse.order.x;horse.y=horse.order.y;g.time+=.6;g.updatePatrolOrders();}
  step(g,5);assert.ok(horse.x<45);assert.ok(g.isWalkable(horse.x,horse.y));
});

test('Patrol planning preserves rallies and touches only active patrol orders',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',30,30),foot=g.addUnit(0,'infantry',30,32),post=g.addBuilding(0,'stables',26,26);post.rally={x:33,y:33};g.teams[0].rally={x:28,y:28};g.hold([foot.id]);const old=foot.order;
  g.patrol([horse.id]);step(g,2);assert.deepEqual(post.rally,{x:33,y:33});assert.deepEqual(g.teams[0].rally,{x:28,y:28});assert.equal(foot.order,old);
});

test('A patrol actually discovers hidden enemies along the border without abandoning its scouting order',()=>{
  const g=fixture({fogOfWar:true}),horse=g.addUnit(0,'cavalry',30,30);g.patrol([horse.id]);
  const point={x:horse.order.x,y:horse.order.y},foe=g.addUnit(1,'infantry',point.x,point.y);foe.cooldown=1e9;g.hold([foe.id]);g.vision.update(true);
  assert.equal(g.isVisibleTo(0,foe),false);let spotted=false,engaged=false;
  for(let i=0;i<450;i++){g.time+=1/30;g.hash.rebuild(g.units);g.updateUnits(1/30);g.vision.update(true);spotted||=g.isVisibleTo(0,foe);engaged||=horse.target===foe;assert.equal(horse.order.mode,'patrol');if(horse.target)assert.equal(g.isVisibleTo(0,horse.target),true);}
  assert.ok(spotted,'Moving sight should reveal a previously hidden border contact.');assert.ok(engaged,'A patrol should react after discovering the hostile border contact.');assert.equal(g.vision.exploredFor(0)[Math.floor(point.y)*g.W+Math.floor(point.x)],1);
});

console.log(`${cases} cavalry patrol checks passed.`);
