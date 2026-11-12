import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {LandsNavigation} from '../../navigation.js';
import {isPassableTile} from '../../lands.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const fixture=(W=36,H=28)=>{
  const game={W,H,tiles:[]};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)game.tiles.push({x,y,terrain:x===0||y===0||x===W-1||y===H-1?'water':'grass',feature:null});
  game.tileAt=(x,y)=>game.tiles[Math.floor(y)*W+Math.floor(x)];
  return game;
};
const tile=(g,x,y)=>g.tiles[y*g.W+x];
const wall=(g,x,bridgeY,width=1)=>{
  for(let y=1;y<g.H-1;y++){const t=tile(g,x,y);t.terrain='water';if(y>=bridgeY&&y<bridgeY+width){t.feature='bridge';t.featureAxis='x';}}
};
const march=(nav,u,goal,steps=800)=>{
  const visited=[];
  for(let i=0;i<steps&&Math.hypot(u.x-goal.x,u.y-goal.y)>.18;i++){
    const p=nav.steer(u,goal,'infantry'),dx=p.x-u.x,dy=p.y-u.y,length=Math.hypot(dx,dy),oldX=u.x,oldY=u.y;
    if(length){const step=Math.min(.16,length);u.x+=dx/length*step;u.y+=dy/length*step;}
    nav.constrain(u,oldX,oldY);assert.ok(isPassableTile(nav.game.tileAt(u.x,u.y)),'A marching soldier stays on traversable terrain.');
    visited.push({...u});
  }
  return visited;
};

test('An army routes around a river through its bridge',()=>{
  const g=fixture();wall(g,17,6);const nav=new LandsNavigation(g),route=nav.route({x:6.5,y:20.5},{x:29.5,y:20.5});
  assert.equal(route.reachable,true);assert.ok(route.distance>23);assert.ok(route.crossings.some(p=>p.kind==='bridge'&&p.y===6.5));
  for(const p of route.points)assert.ok(isPassableTile(g.tileAt(p.x,p.y)));
});

test('Closed barriers and diagonal pinches cannot be crossed',()=>{
  const g=fixture();wall(g,17,-10);const nav=new LandsNavigation(g);
  assert.equal(nav.route({x:6.5,y:12.5},{x:29.5,y:12.5}).reachable,false);
  const p=fixture(6,6);for(const t of p.tiles)t.terrain='water';tile(p,2,2).terrain='grass';tile(p,3,3).terrain='grass';
  const corner=new LandsNavigation(p);assert.equal(corner.route({x:2.5,y:2.5},{x:3.5,y:3.5}).reachable,false);
  assert.equal(corner.clearSegment({x:2.5,y:2.5},{x:3.5,y:3.5}),false);
});

test('Weighted routing can take a faster road detour',()=>{
  const g=fixture();for(let x=3;x<=31;x++)for(let y=8;y<=10;y++)tile(g,x,y).terrain='forest';
  for(let x=3;x<=31;x++)tile(g,x,6).feature='road';
  for(let y=6;y<=9;y++){tile(g,3,y).feature='road';tile(g,31,y).feature='road';}
  const nav=new LandsNavigation(g),road=nav.route({x:3.5,y:9.5},{x:31.5,y:9.5},'cavalry');
  assert.equal(road.reachable,true);assert.ok(road.points.some(p=>g.tileAt(p.x,p.y).feature==='road'));
});

test('Terrain costs distinguish cavalry and siege from ordinary foot soldiers',()=>{
  const g=fixture();for(const t of g.tiles)if(t.terrain!=='water')t.terrain='forest';const nav=new LandsNavigation(g),from={x:4.5,y:10.5},to={x:28.5,y:10.5};
  assert.ok(nav.route(from,to,'cavalry').cost>nav.route(from,to,'infantry').cost);
  for(const t of g.tiles)if(t.terrain!=='water')t.terrain='hill';nav.invalidate();
  assert.ok(nav.route(from,to,'siege').cost>nav.route(from,to,'infantry').cost);
});

test('Blocked goals snap to land and terrain edits invalidate cached routes',()=>{
  const g=fixture();wall(g,17,6);const nav=new LandsNavigation(g),goal=nav.nearestPassable({x:17.5,y:20.5});
  assert.ok(goal&&isPassableTile(g.tileAt(goal.x,goal.y)));
  const from={x:6.5,y:20.5},to={x:29.5,y:20.5};assert.equal(nav.route(from,to).reachable,true);
  tile(g,17,6).feature=null;nav.invalidate();assert.equal(nav.route(from,to).reachable,false);
});

test('Long charge and knockback displacement cannot tunnel through water or mountain',()=>{
  for(const terrain of ['water','mountain']){
    const g=fixture();for(let y=1;y<g.H-1;y++)tile(g,17,y).terrain=terrain;
    const nav=new LandsNavigation(g),u={x:31.5,y:12.5};assert.equal(nav.constrain(u,4.5,12.5),true);
    assert.ok(u.x<17);assert.ok(isPassableTile(g.tileAt(u.x,u.y)));
  }
});

test('A soldier overlapping the shore margin can recover within its own land tile',()=>{
  const g=fixture();wall(g,17,6);const nav=new LandsNavigation(g),u={x:16.8,y:12.5,radius:.24};
  assert.equal(nav.constrain(u,16.96,12.5),true);
  assert.equal(Math.floor(u.x),16);assert.ok(nav.isClearPoint(u.x,u.y,u.radius));
  const oldX=u.x,oldY=u.y;u.x-=.2;assert.equal(nav.constrain(u,oldX,oldY),false);
  assert.ok(u.x<oldX,'The recovered soldier can move away from the shore.');
});

test('Continuous movement reaches the other bank without clipping corners',()=>{
  const g=fixture();wall(g,17,6,4);const nav=new LandsNavigation(g),goal={x:29.5,y:20.5},u={x:6.5,y:20.5,order:{...goal,groupX:goal.x,groupY:goal.y}};
  const positions=march(nav,u,goal);assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<.2);
  assert.ok(positions.some(p=>Math.floor(p.x)===17&&p.y>=6&&p.y<10));
});

test('Wide bridges carry independent lanes in both marching directions',()=>{
  const g=fixture();wall(g,17,9,5);const nav=new LandsNavigation(g),lanes=[];
  for(const direction of [1,-1])for(let row=0;row<5;row++){
    const goal={x:direction===1?29.5:5.5,y:11.5},u={x:direction===1?6.5:28.5,y:9.5+row,order:{...goal,groupX:goal.x,groupY:goal.y}},positions=march(nav,u,goal);
    assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<.2);
    const crossing=positions.find(p=>Math.floor(p.x)===17);assert.ok(crossing);lanes.push(crossing.y);
  }
  assert.ok(Math.max(...lanes)-Math.min(...lanes)>1,'The full company is not compressed onto a single bridge centerline.');
});

test('A thousand soldiers share only one field per movement class',()=>{
  const g=fixture(120,96);wall(g,60,43,5);const nav=new LandsNavigation(g),goal={x:108.5,y:80.5},start=performance.now();
  for(let i=0;i<1000;i++){
    const order={x:goal.x+(i%5)*.3,y:goal.y+Math.floor(i%25/5)*.3,groupX:goal.x,groupY:goal.y},u={x:5.5+i%20,y:5.5+Math.floor(i/20),order};
    nav.steer(u,order,['infantry','cavalry','siege'][i%3]);
  }
  assert.equal(nav.stats.fieldBuilds,3);assert.ok(nav.fields.size<=nav.maxFields);
  console.log(`Navigation benchmark: 1000 soldiers, ${nav.stats.fieldBuilds} shared fields, ${Math.round(performance.now()-start)}ms initial planning.`);
});

console.log(`${cases} lands navigation tests passed.`);
