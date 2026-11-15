// Real simulation stress scenarios. Compare saved modules with identical seeded
// worlds; no simulation rules, collision passes or fog checks are stubbed out.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const modulePath=path.resolve(option('module',fileURLToPath(new URL('../../core.js',import.meta.url))));
const {Game}=await import(pathToFileURL(modulePath));
const counts=option('counts','3000,6000').split(',').map(Number),scenes=option('scenes','idle,march,battle,campaign,realm').split(',');
const frames=Number(option('frames',90)),warmup=Number(option('warmup',30)),fog=option('fog','on')!=='off';
const output=option('output',null),rows=[];
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function summary(values){const sorted=[...values].sort((a,b)=>a-b);return {meanMs:values.reduce((a,b)=>a+b,0)/values.length,p50Ms:median(values),p95Ms:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],maxMs:sorted.at(-1)};}

export function setupLargeArmy(Game,count,scene,fog=true){
  const g=new Game({scale:'continent',enemies:15,landscape:'riverlands',fogOfWar:fog,difficulty:'warlord',seed:44277});
  const campaign=scene==='campaign'||scene==='realm',ownerAt=p=>{let team=0,best=Infinity;for(const s of g.teams){const d=(s.home.x-p.x)**2+(s.home.y-p.y)**2;if(d<best){best=d;team=s.id;}}return team;};
  for(const u of g.units)g.byId.delete(u.id);g.units=[];g.projectiles=[];g.effects=[];g.time=900;
  for(const s of g.teams){s.count=0;s.aiClock=campaign?s.id*.071:1e9;s.powerReadyAt=1e9;s.gold=campaign?1800:700;s.heroTimer=0;}
  if(scene==='realm')for(const tile of g.tiles)if(g.isWalkable(tile.x+.5,tile.y+.5))tile.owner=ownerAt(tile);
  // 16 production and defensive structures per house model a developed realm.
  for(const s of g.teams){
    let extra=0;
    for(let y=2;y<g.H-2&&extra<13;y+=3)for(let x=2;x<g.W-2&&extra<13;x+=3){
      if((x-s.home.x)**2+(y-s.home.y)**2>20**2||!g.buildingGround('barracks',x+.5,y+.5)||g.buildings.some(b=>(b.x-x-.5)**2+(b.y-y-.5)**2<3.5**2))continue;
      const type=extra%4===0?'tower':['barracks','range','stables','workshop'][extra%4];
      g.addBuilding(s.id,type,x+.5,y+.5);extra++;
    }
  }
  for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
  const slots=[];
  if(scene==='battle'){
    for(let y=g.H/2-31;y<g.H/2+31;y+=.6)for(let x=g.W/2-36;x<g.W/2+36;x+=.6)if(g.navigation.isClearPoint(x,y,.25)&&!g.buildings.some(b=>(b.x-x)**2+(b.y-y)**2<(g.buildingRadius(b)+.4)**2))slots.push({x,y});
  }else{
    for(let y=3.5;y<g.H-3;y+=1.7)for(let x=3.5;x<g.W-3;x+=1.7)if(g.navigation.isClearPoint(x,y,.25)&&!g.buildings.some(b=>(b.x-x)**2+(b.y-y)**2<(g.buildingRadius(b)+.4)**2))slots.push({x,y});
  }
  assert.ok(slots.length>=count,`${scene} needs ${count} legal distinct slots, has ${slots.length}`);
  const types=['infantry','archer','bridge_warden','cavalry','gilded_crossbow','infantry','dread_pike','sharpshooter'];
  for(let i=0;i<count;i++){
    const p=slots[Math.floor(i*slots.length/count)],team=scene==='realm'?ownerAt(p):i%16,u=g.addUnit(team,types[i%types.length],p.x,p.y);
    // Long-lived targets keep the measured population comparable in both versions.
    u.hp=u.maxHp=scene==='battle'?10000:u.maxHp;u.cooldown=(i%23)*.07;u.seek=(i%11)*.02;
    u.order={x:u.x,y:u.y,mode:scene==='battle'?'attack':'hold',formation:'line'};
  }
  if(scene==='march')for(const s of g.teams){const goal=g.teams[(s.id+8)%16].home;g.command(g.group(s.id).map(u=>u.id),goal.x,goal.y,'move','line');}
  if(scene==='realm')g.recount();g.hash.rebuild(g.units);g.vision.update(true);return g;
}

for(const count of counts)for(const scene of scenes){
  const g=setupLargeArmy(Game,count,scene,fog),methods={},names=['updateUnits','updateBuildings','capture','recount','ai','updateExpansionOrders','updateSpecialists','updateHouseEffects','updateObjectives','updateCastles','aiFogProductionSite','aiFogTowerSite','aiProductionSite'];
  for(const name of names){const original=g[name];if(!original)continue;g[name]=function(...params){const start=performance.now();try{return original.apply(this,params);}finally{const record=methods[name]||(methods[name]={calls:0,ms:0,maxMs:0});const ms=performance.now()-start;record.calls++;record.ms+=ms;record.maxMs=Math.max(record.maxMs,ms);}};}
  for(let i=0;i<warmup;i++)g.update(1/30);
  for(const record of Object.values(methods)){record.calls=0;record.ms=0;record.maxMs=0;}
  const times=[];for(let i=0;i<frames;i++){const start=performance.now();g.update(1/30);times.push(performance.now()-start);}
  for(const u of g.units)assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp)&&g.isWalkable(u.x,u.y));
  const row={count,scene,fog,frames,units:g.units.filter(u=>u.hp>0).length,buildings:g.buildings.length,...summary(times),methods,navigation:{...g.navigation.stats}};
  rows.push(row);console.log(JSON.stringify(row));
}
if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify({module:modulePath,rows},null,2));}
