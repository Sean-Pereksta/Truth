import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';

const Hash=new Game({scale:'standard',enemies:1,seed:44277}).hash.constructor;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function fullRebuild(units){
  for(const bucket of this.buckets)bucket.length=0;
  for(const u of units)if(u.hp>0){const x=clamp(Math.floor(u.x/this.size),0,this.w-1),y=clamp(Math.floor(u.y/this.size),0,this.h-1);this.buckets[y*this.w+x].push(u);}
}
let seed=44277,cases=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};

test('Sparse rebuilds preserve every local query and combat insertion order through movement, death and spawning',()=>{
  const actual=new Hash(360,280),reference=new Hash(360,280);
  reference.rebuild=fullRebuild;
  const troops=Array.from({length:1400},(_,id)=>({id,hp:100,x:random()*360,y:random()*280}));
  for(let frame=0;frame<16;frame++){
    for(const u of troops){u.x+=(random()-.5)*8;u.y+=(random()-.5)*8;if(random()<.03)u.hp=0;}
    troops.push({id:troops.length,hp:100,x:random()*360,y:random()*280});
    actual.rebuild(troops);reference.rebuild(troops);
    for(let query=0;query<100;query++){
      const x=random()*360,y=random()*280,r=random()*12,a=[],b=[];
      actual.visit(x,y,r,u=>a.push(u.id));reference.visit(x,y,r,u=>b.push(u.id));
      assert.deepEqual(a,b,'Broad-phase candidates retain the full-scan order.');
    }
  }
  actual.rebuild([]);const remaining=[];actual.visit(180,140,400,u=>remaining.push(u.id));assert.deepEqual(remaining,[]);
  actual.rebuild([troops[0],{id:9999,hp:100,x:10,y:10}]);const spawned=[];actual.visit(10,10,.1,u=>spawned.push(u.id));assert.ok(spawned.includes(9999));
});

test('A sparse continent clears at most one bucket per previously living troop',()=>{
  const hash=new Hash(360,280),troops=Array.from({length:1120},(_,id)=>({id,hp:100,x:10+id%40*.4,y:10+Math.floor(id/40)*.4}));
  let resets=0;
  hash.buckets=hash.buckets.map(bucket=>new Proxy(bucket,{set(target,key,value){if(key==='length'&&value===0)resets++;return Reflect.set(target,key,value);}}));
  hash.rebuild(troops);resets=0;hash.rebuild(troops);
  assert.ok(resets>0&&resets<=troops.length,'Rebuilding must scale with occupied ground, not world area.');
  for(const u of troops)u.hp=0;hash.rebuild(troops);resets=0;hash.rebuild(troops);assert.equal(resets,0,'An empty world needs no bucket clearing.');
});

console.log(`${cases} spatial performance regression checks passed.`);
if(process.argv.includes('--benchmark')){
  const troops=Array.from({length:1120},(_,id)=>({id,hp:100,x:10+id%40*.4,y:10+Math.floor(id/40)*.4}));
  const run=method=>{const hash=new Hash(360,280);hash.rebuild=method;for(let i=0;i<100;i++)hash.rebuild(troops);const start=performance.now();for(let i=0;i<1000;i++)hash.rebuild(troops);return performance.now()-start;};
  const before=[],after=[];for(let i=0;i<5;i++){before.push(run(fullRebuild));after.push(run(Hash.prototype.rebuild));}
  const median=values=>values.sort((a,b)=>a-b)[2];
  console.log(JSON.stringify({scenario:'1120 troops on a continent, 1000 spatial rebuilds',baselineMs:median(before),currentMs:median(after),speedup:median(before)/median(after)}));
}
