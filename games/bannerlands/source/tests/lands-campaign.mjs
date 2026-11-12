import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';

let cases=0;
const started=performance.now();
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const fixture=(mode='conquest')=>{
  const g=new Game({landscape:'open',scale:'standard',enemies:3,mode,seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.time=100;g.objectives=[];
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.featureAxis=null;t.owner=-1;t.claim=-1;t.capture=0;t.value=1;}
  for(const s of g.teams){s.count=0;s.tiles=0;s.aiPlan=null;s.alive=true;s.gold=10000;s.cap=260;s.powerReadyAt=1e9;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
};
const tile=(g,x,y)=>g.tiles[y*g.W+x];
const river=(g,x,bridgeY=43,width=5)=>{
  for(let xx=x;xx<x+7;xx++)for(let y=1;y<g.H-1;y++){const t=tile(g,xx,y);t.terrain='water';t.feature=y>=bridgeY&&y<bridgeY+width?'bridge':null;t.featureAxis=t.feature?'x':null;}
  g.navigation.invalidate();
};
const simulate=(g,steps)=>{
  for(let step=0;step<steps;step++){
    g.time+=.05;g.hash.rebuild(g.units);g.updateUnits(.05);
    for(const u of g.units)assert.ok(g.isWalkable(u.x,u.y),`${u.type} cannot leave the bridge deck or enter a mountain.`);
  }
};
const targetFixture=()=>{
  const g=fixture(),s=g.teams[1];s.home={x:20.5,y:45.5};s.strategy='mass';
  g.addBuilding(s.id,'keep',s.home.x,s.home.y);
  const near=g.addBuilding(0,'keep',48.5,45.5),other=g.addBuilding(2,'keep',20.5,75.5),p=g.aiPlanFor(s);
  return {g,s,p,near,other};
};

test('A150-soldier mixed company crosses a wide bridge and reforms on the far bank',()=>{
  const g=fixture();river(g,55);
  for(let i=0;i<150;i++)g.addUnit(0,i%6===0?'cavalry':i%11===0?'siege':'infantry',39.5+i%10*.55,39.5+Math.floor(i/10)*.55);
  const ids=g.units.map(u=>u.id);g.command(ids,73.5,45.5,'move','line');
  simulate(g,1200);
  assert.equal(g.units.filter(u=>u.x>62).length,150);
  assert.ok(g.units.every(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y)<1));
  assert.ok(g.navigation.stats.fieldBuilds<=6,'Formation slots reuse the company fields.');
});

test('Allied companies can cross the same bridge in opposite directions',()=>{
  const g=fixture('team-conquest');river(g,55);const left=[],right=[];
  for(let i=0;i<40;i++){
    left.push(g.addUnit(0,'infantry',42.5+i%8*.5,40.5+Math.floor(i/8)*.7).id);
    right.push(g.addUnit(1,'infantry',64.5+i%8*.5,46.5+Math.floor(i/8)*.7).id);
  }
  g.command(left,70.5,45.5,'move','line');g.command(right,40.5,45.5,'move','line');simulate(g,1100);
  assert.ok(left.every(id=>g.byId.get(id).x>62));assert.ok(right.every(id=>g.byId.get(id).x<52));
});

test('Spawns and every formation destination stay on legal terrain',()=>{
  const g=fixture();river(g,55);const displaced=g.addUnit(0,'siege',55.5,20.5);assert.ok(g.isWalkable(displaced.x,displaced.y));
  const soldiers=[];for(let i=0;i<35;i++)soldiers.push(g.addUnit(0,'infantry',45.5+i%7*.5,43.5+Math.floor(i/7)*.5).id);
  for(const formation of ['line','spread','wedge']){
    g.command(soldiers,55.5,45.5,'move',formation);
    assert.ok(soldiers.every(id=>{const u=g.byId.get(id);return g.isWalkable(u.order.x,u.order.y);}));
  }
});

test('Bridges and passes accept rally orders but cannot be blocked by construction',()=>{
  const g=fixture();river(g,55);g.teams[0].home={x:15.5,y:45.5};
  const keep=g.addBuilding(0,'keep',15.5,45.5),bridge=tile(g,55,45),pass=tile(g,66,45),road=tile(g,75,45),mountain=tile(g,83,45);
  pass.terrain='mountain';pass.feature='pass';pass.featureAxis='x';road.feature='road';mountain.terrain='mountain';
  for(const t of g.tiles)if(t.terrain!=='water'||t.feature)t.owner=0;
  g.navigation.invalidate();
  assert.equal(g.setRally(55.5,45.5,0,[keep.id]).ok,true);
  assert.equal(g.setRally(66.5,45.5,0,[keep.id]).ok,true);
  assert.equal(g.setRally(55.5,20.5,0,[keep.id]).ok,false);
  assert.equal(g.setRally(83.5,45.5,0,[keep.id]).ok,false);
  for(const t of [bridge,pass,road,mountain])assert.equal(g.build('barracks',t.x+.5,t.y+.5,0).ok,false);
  assert.equal(g.build('barracks',93.5,65.5,0).ok,true);
});

test('Territory can capture crossings while solid water and mountain remain unowned',()=>{
  const g=fixture();river(g,55);const bridge=tile(g,55,45),water=tile(g,55,46),mountain=tile(g,56,45);
  water.feature=null;mountain.terrain='mountain';mountain.feature=null;tile(g,54,45).owner=0;g.navigation.invalidate();
  g.addUnit(0,'infantry',55.5,45.5);g.capture(10);
  assert.equal(bridge.owner,0);assert.equal(water.owner,-1);assert.equal(mountain.owner,-1);
});

test('Enemy decisions use the reachable route rather than the nearest capital by straight line',()=>{
  const {g,s,p,near,other}=targetFixture();assert.equal(g.aiTarget(s,p),near);
  river(g,34,82,5);assert.equal(g.aiTarget(s,p),other);
  // Removing the only crossing makes the nearer capital unreachable entirely.
  river(g,34,-10,0);assert.equal(g.aiTarget(s,p),other);
});

test('Guards on an unavoidable crossing can change a lord\'s invasion target',()=>{
  const {g,s,p,near,other}=targetFixture();river(g,34,43,5);assert.equal(g.aiTarget(s,p),near);
  for(let i=0;i<24;i++)g.addUnit(3,'infantry',34.5+(i%3)*.1,44.5+Math.floor(i/3)*.2);
  g.hash.rebuild(g.units);assert.equal(g.aiTarget(s,p),other);
});

test('Every new landscape keeps standards outside capital reservations after snapping to land',()=>{
  for(const landscape of ['crownlands','riverlands','highlands','coast','kingsroad']){
    const g=new Game({landscape,scale:'standard',enemies:15,seed:44277});
    for(const flag of g.objectives){assert.ok(g.isWalkable(flag.x,flag.y));assert.ok(g.teams.every(s=>Math.hypot(flag.x-s.home.x,flag.y-s.home.y)>=11));assert.ok(!g.units.some(u=>Math.hypot(u.x-flag.x,u.y-flag.y)<flag.radius));}
  }
});

console.log(`${cases} lands campaign tests passed in ${((performance.now()-started)/1000).toFixed(1)}s.`);
