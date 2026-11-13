import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {LandsNavigation} from '../../navigation.js';

const fixture=(W=100,H=80)=>({W,H,time:0,tiles:Array.from({length:W*H},(_,i)=>({x:i%W,y:Math.floor(i/W),terrain:i%W===0||i%W===W-1||i<W||i>=W*(H-1)?'water':'grass',feature:null}))});
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};

test('A large stream of deferred goals cannot evict a pending movement order',()=>{
  const g=fixture(),nav=new LandsNavigation(g),goal={x:88.5,y:68.5},origin=8*g.W+8;
  let pending;
  for(let update=0;update<200;update++){
    g.time=update/30;nav.beginUpdate(80);
    const before=nav.stats.fieldSteps,field=nav.field(goal,'infantry',origin);
    pending??=field;assert.equal(field,pending,'Unfinished search progress survives unrelated orders.');
    if(field.settled[origin])break;
    for(let i=0;i<90;i++)assert.equal(nav.field({x:60.5+i%30,y:40.5+Math.floor(i/30)},'infantry',origin),null);
    assert.equal(nav.fields.size,1,'Deferred requests do not allocate full-map field arrays.');
    assert.ok(nav.stats.fieldSteps-before<=80);
  }
  assert.equal(pending.settled[origin],1,'The original order eventually obtains its route.');
  const reference=new LandsNavigation(g).field(goal,'infantry');
  assert.equal(pending.distance[origin],reference.distance[origin]);
  assert.equal(pending.next[origin],reference.next[origin]);
});

test('A deferred new destination is admitted as soon as planning work is available',()=>{
  const g=fixture(),nav=new LandsNavigation(g),goal={x:86.5,y:65.5},origin=8*g.W+8;
  nav.beginUpdate(1);nav.field({x:88.5,y:68.5},'infantry',origin);
  assert.equal(nav.field(goal,'infantry',origin),null);
  g.time+=1/30;nav.beginUpdate(100);
  assert.ok(nav.field(goal,'infantry',origin));
});

test('Disconnected destinations are rejected without repeated searches or allocations',()=>{
  const g=fixture(60,48);for(let y=1;y<g.H-1;y++)g.tiles[y*g.W+30].terrain='water';
  const nav=new LandsNavigation(g),from={x:8.5,y:20.5},to={x:50.5,y:20.5},origin=nav.index(from);
  for(let i=0;i<200;i++){
    assert.equal(nav.route(from,to).reachable,false);
    assert.equal(nav.field(to,'infantry',origin),null);
  }
  assert.equal(nav.stats.routeSearches,0);assert.equal(nav.stats.fieldBuilds,0);assert.equal(nav.stats.fieldSteps,0);
  const crossing=g.tiles[20*g.W+30];crossing.feature='bridge';crossing.featureAxis='x';nav.invalidate();
  assert.equal(nav.route(from,to).reachable,true);
  assert.equal(nav.field(to,'infantry',origin).settled[origin],1);
  crossing.feature=null;nav.invalidate();assert.equal(nav.route(from,to).reachable,false);
});

console.log(`${cases} navigation contention checks passed.`);

if(process.argv.includes('--benchmark')){
  const baseline=process.env.NAV_BASELINE_MODULE?await import(pathToFileURL(process.env.NAV_BASELINE_MODULE)):null;
  const coldGoals=Nav=>{
    const g=fixture(120,96),nav=new Nav(g);nav.beginUpdate(1);
    const started=performance.now();
    for(let i=0;i<500;i++)nav.field({x:65.5+i%45,y:55.5+Math.floor(i/45)},'infantry',8*g.W+8);
    return {ms:performance.now()-started,fields:nav.stats.fieldBuilds,steps:nav.stats.fieldSteps};
  };
  const unreachable=Nav=>{
    const g=fixture(120,96);for(let y=1;y<g.H-1;y++)g.tiles[y*g.W+60].terrain='water';
    const nav=new Nav(g),started=performance.now();
    for(let i=0;i<200;i++)nav.route({x:8.5,y:20.5},{x:100.5,y:20.5});
    return {ms:performance.now()-started,searches:nav.stats.routeSearches};
  };
  for(const [scenario,run] of [['500 distinct orders after the shared search budget is spent',coldGoals],['200 requests across an impassable river',unreachable]]){
    const before=baseline?run(baseline.LandsNavigation):undefined,current=run(LandsNavigation);
    console.log(JSON.stringify({scenario,baseline:before,current}));
  }
}
