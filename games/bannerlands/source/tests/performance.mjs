// Repeatable simulation benchmark. Run the same command against old and new core modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL,fileURLToPath} from 'node:url';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const modulePath=path.resolve(option('module',fileURLToPath(new URL('../../core.js',import.meta.url))));
const {Game}=await import(pathToFileURL(modulePath));
const frames=Math.max(20,Number(option('frames',80))),warmup=Math.max(0,Number(option('warmup',20)));
const scales=option('scales','epic,continent').split(','),scenarios=option('scenarios','idle,march,battle').split(',');
const percentile=(values,p)=>values[Math.min(values.length-1,Math.floor(values.length*p))];
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {meanMs:values.reduce((a,b)=>a+b,0)/values.length,p50Ms:percentile(sorted,.5),p95Ms:percentile(sorted,.95),maxMs:sorted.at(-1)};};
const digest=g=>{
  let hash=2166136261;
  const add=value=>{const n=Math.round(value*1e5);hash=Math.imul(hash^(n|0),16777619)>>>0;};
  for(const u of g.units){add(u.id);add(u.team);add(u.x);add(u.y);add(u.hp);}
  for(const t of g.tiles){add(t.owner);add(t.claim);add(t.capture);}
  for(const s of g.teams){add(s.count);add(s.tiles);add(s.gold);}
  return hash.toString(16).padStart(8,'0');
};
function setup(scale,scenario){
  const g=new Game({scale,enemies:15,seed:44277,landscape:'riverlands',difficulty:'warlord'});
  for(const s of g.teams){s.aiClock=scenario==='campaign'?s.id*.05:1e9;s.powerReadyAt=1e9;}
  for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
  if(scenario==='march'){
    for(const s of g.teams){const other=g.teams[(s.id+8)%g.teams.length];g.command(g.group(s.id).map(u=>u.id),other.home.x,other.home.y,'move','line');}
  }else if(scenario==='battle'){
    const center={x:g.W*.5,y:g.H*.5},slots=[];
    for(let y=center.y-18;y<=center.y+18;y+=.5)for(let x=center.x-18;x<=center.x+18;x+=.5)if(g.navigation.isClearPoint(x,y,.25))slots.push({x,y});
    assert.ok(slots.length>=g.units.length,'Battle fixture needs legal room for all soldiers.');
    // Interleave houses while keeping distinct half-tile positions.
    const units=[...g.units].sort((a,b)=>((Math.imul(a.id,2654435761)>>>0)-(Math.imul(b.id,2654435761)>>>0)));
    for(let i=0;i<units.length;i++){const u=units[i],p=slots[Math.floor(i*slots.length/units.length)];u.x=p.x;u.y=p.y;u.seek=0;u.cooldown=0;u.order={x:center.x,y:center.y,mode:'attack',formation:'line',groupX:center.x,groupY:center.y};}
    g.hash.rebuild(g.units);
  }else if(scenario==='campaign')g.time=90;
  return g;
}
const results=[];
for(const scale of scales)for(const scenario of scenarios){
  const g=setup(scale,scenario),methods={},names=['updateUnits','updateBuildings','capture','recount','ai','updateExpansionOrders','updateSpecialists','updateHouseEffects','updateObjectives'];
  for(const name of names){const original=g[name];g[name]=function(...params){const start=performance.now();try{return original.apply(this,params);}finally{const record=methods[name]||(methods[name]={calls:0,ms:0,maxMs:0});const elapsed=performance.now()-start;record.calls++;record.ms+=elapsed;record.maxMs=Math.max(record.maxMs,elapsed);}};}
  const cold=[];for(let i=0;i<warmup;i++){const start=performance.now();g.update(1/30);cold.push(performance.now()-start);}
  const times=[];for(let i=0;i<frames;i++){const start=performance.now();g.update(1/30);times.push(performance.now()-start);}
  for(const u of g.units)assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp)&&g.isWalkable(u.x,u.y),'Simulation must retain finite soldiers on legal terrain.');
  results.push({scale,scenario,frames,warmup,units:g.units.filter(u=>u.hp>0).length,...summary(times),warmupMs:cold.reduce((a,b)=>a+b,0),warmupMaxMs:cold.length?Math.max(...cold):0,methods,navigation:{...g.navigation.stats},digest:digest(g)});
}
const result={module:modulePath,seed:44277,dt:1/30,results};
const out=option('output',null);if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
