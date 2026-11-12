import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {LandsNavigation} from '../../navigation.js';
import {isPassableTile} from '../../lands.js';

const fixture=(W=48,H=36)=>({W,H,tiles:Array.from({length:W*H},(_,i)=>({x:i%W,y:Math.floor(i/W),terrain:i%W===0||i%W===W-1||i<W||i>=W*(H-1)?'water':'grass',feature:null}))});
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
let seed=6197;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

// A deliberately slow sampling oracle, independent of the integral-grid and
// cached-topology optimizations, preserves the existing shore/corner semantics.
const open=(g,x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H&&isPassableTile(g.tiles[Math.floor(y)*g.W+Math.floor(x)]);
const pointClear=(g,x,y,r)=>open(g,x,y)&&[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.707,-.707],[.707,-.707],[-.707,.707],[.707,.707]].every(([dx,dy])=>open(g,x+dx*r,y+dy*r));
const segmentClear=(g,a,b,r)=>{
  if(!pointClear(g,a.x,a.y,r))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.22));let previous={x:Math.floor(a.x),y:Math.floor(a.y)};
  for(let i=1;i<=steps;i++){
    const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps,next={x:Math.floor(x),y:Math.floor(y)};
    if(!pointClear(g,x,y,r))return false;
    if(next.x!==previous.x&&next.y!==previous.y&&(!open(g,next.x+.5,previous.y+.5)||!open(g,previous.x+.5,next.y+.5)))return false;
    previous=next;
  }
  return true;
};

test('Fast open-ground sweeps agree with sampled shore and corner clearance',()=>{
  const g=fixture();for(const t of g.tiles)if(t.x>0&&t.y>0&&t.x<g.W-1&&t.y<g.H-1&&random()<.11)t.terrain=random()<.5?'water':'mountain';
  const nav=new LandsNavigation(g);
  for(let i=0;i<16000;i++){
    const a={x:random()*g.W,y:random()*g.H},b={x:a.x+(random()-.5)*16,y:a.y+(random()-.5)*16},r=[0,.1,.145,.24,.4][i%5];
    assert.equal(nav.isClearPoint(a.x,a.y,r),pointClear(g,a.x,a.y,r));
    assert.equal(nav.clearSegment(a,b,r),segmentClear(g,a,b,r));
  }
});

test('Terrain invalidation refreshes both fast collision and cached routing topology',()=>{
  const g=fixture(30,24);for(let y=1;y<g.H-1;y++)g.tiles[y*g.W+15].terrain='water';
  const nav=new LandsNavigation(g),a={x:7.5,y:12.5},b={x:23.5,y:12.5};
  assert.equal(nav.route(a,b).reachable,false);assert.equal(nav.clearSegment(a,b,.24),false);
  const crossing=g.tiles[12*g.W+15];crossing.feature='bridge';crossing.featureAxis='x';nav.invalidate();
  assert.equal(nav.route(a,b).reachable,true);assert.equal(nav.clearSegment(a,b,.24),true);
  crossing.feature=null;nav.invalidate();assert.equal(nav.route(a,b).reachable,false);assert.equal(nav.clearSegment(a,b,.24),false);
});

test('A nearby requested origin settles without searching the entire map',()=>{
  const g=fixture(100,80),nav=new LandsNavigation(g),goal={x:49.5,y:39.5},origin=39*g.W+50;
  const partial=nav.field(goal,'infantry',origin),complete=new LandsNavigation(g).field(goal,'infantry');
  assert.equal(partial.settled[origin],1);assert.equal(partial.distance[origin],complete.distance[origin]);assert.equal(partial.next[origin],complete.next[origin]);
  assert.ok(partial.settled.reduce((n,v)=>n+v,0)<30,'A short return-home route must not flood every tile.');
});

test('Shared search quotas bound planning work and resume exact routes on later updates',()=>{
  const g=fixture(80,64);g.time=0;const nav=new LandsNavigation(g),goal={x:70.5,y:55.5},origin=7*g.W+7;
  let result;
  for(let update=0;update<120;update++){
    g.time=update/30;nav.beginUpdate(100);const before=nav.stats.fieldSteps;
    for(let request=0;request<25;request++)result=nav.field(goal,'infantry',origin);
    assert.ok(nav.stats.fieldSteps-before<=100,'Many troops share one bounded update budget.');
    if(result.settled[origin])break;
  }
  assert.equal(result.settled[origin],1,'Deferred planning must eventually finish.');
  const reference=new LandsNavigation(g).field(goal,'infantry');
  assert.equal(result.distance[origin],reference.distance[origin]);assert.equal(result.next[origin],reference.next[origin]);
  assert.ok(nav.stats.fieldBudgetStops>0);
});

test('Pending planning holds safely without inventing a route through a river',()=>{
  const g=fixture(80,64);g.time=0;for(let y=1;y<g.H-1;y++)g.tiles[y*g.W+40].terrain='water';
  const nav=new LandsNavigation(g),u={x:10.5,y:8.5,radius:.24},goal={x:68.5,y:55.5};nav.beginUpdate(1);
  const waypoint=nav.steer(u,goal,'siege');assert.equal(waypoint.blocked,true);assert.equal(waypoint.x,u.x);assert.equal(waypoint.y,u.y);
  assert.equal(nav.clearSegment(u,goal,u.radius),false);
});

console.log(`${cases} navigation performance regression checks passed.`);

if(process.argv.includes('--benchmark')){
  const baseline=process.env.NAV_BASELINE_MODULE?await import(pathToFileURL(process.env.NAV_BASELINE_MODULE)):null;
  const run=(Nav,bridge)=>{
    const g=fixture(120,96);
    if(bridge)for(let x=60;x<67;x++)for(let y=1;y<g.H-1;y++){const t=g.tiles[y*g.W+x];t.terrain='water';if(y>=43&&y<48){t.feature='bridge';t.featureAxis='x';}}
    const nav=new Nav(g),goal=bridge?{x:88.5,y:45.5}:{x:108.5,y:48.5};
    const troops=Array.from({length:1000},(_,i)=>({x:bridge?40.5+Math.floor(i/20)*.2:14.5+i%40*.4,y:bridge?43.25+i%20*.22:35.5+Math.floor(i/40)*.6,radius:i%3===2?.24:.145,order:{...goal,groupX:goal.x,groupY:goal.y}}));
    for(let i=0;i<troops.length;i++)nav.steer(troops[i],goal,['infantry','cavalry','siege'][i%3]);
    const started=performance.now();
    for(let frame=0;frame<240;frame++)for(let i=0;i<troops.length;i++){
      const u=troops[i],p=nav.steer(u,goal,['infantry','cavalry','siege'][i%3]),dx=p.x-u.x,dy=p.y-u.y,length=Math.hypot(dx,dy)||1,step=Math.min(.12,length),x=u.x,y=u.y;
      u.x+=dx/length*step;u.y+=dy/length*step;nav.constrain(u,x,y);
    }
    return performance.now()-started;
  };
  for(const bridge of [false,true]){
    const current=[],before=[];for(let i=0;i<3;i++){if(baseline)before.push(run(baseline.LandsNavigation,bridge));current.push(run(LandsNavigation,bridge));}
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    console.log(JSON.stringify({scenario:bridge?'1000 moving troops through a five-lane bridge':'1000 moving troops on open land',baselineMs:baseline?median(before):undefined,currentMs:median(current),improvement:baseline?median(before)/median(current):undefined}));
  }
}
