// Full app, native RAF, High graphics, 15 rivals: simulation, drawing and input
// are measured separately. Fixtures are synthetic, not saved late campaigns.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const root=path.resolve(option('root',fileURLToPath(new URL('../..',import.meta.url)))),output=path.resolve(option('output','campaign-browser.json'));
const samples=Number(option('frames',120)),seed=44277,scenarios=option('scenarios','early,late-march,late-campaign,invasions,objectives,woodland').split(',');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const rows=[],errors=[];
try{
 for(const scenario of scenarios){
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`,{timeout:90000});
  await page.waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:90000});
  await page.evaluate(({scenario,seed})=>{
   const set=(id,value)=>document.getElementById(id).value=value;
   set('scaleSelect','continent');set('landscapeSelect','riverlands');set('enemySelect','15');set('difficultySelect','warlord');set('fogSelect','off');
   // Start uses its existing seed control when present; explicitly seeded Game
   // below removes dependence on a menu-generated random seed.
   window.__bannerlands.start();window.__bannerlands.game.paused=true;
   window.__fixture={scenario,seed};
  },{scenario,seed});
  await page.evaluate(async()=>{
   const {game:g,renderer:r,view,ui}=window.__bannerlands,{Game}=await import('./core.js'),{scenario,seed}=window.__fixture;
   const seeded=new Game({scale:'continent',landscape:'riverlands',enemies:15,seed,difficulty:'warlord',mode:scenario==='objectives'?'crown-control':'conquest'});
   // Keep the app's Game identity, including the public diagnostics getter.
   for(const key of Object.keys(g))delete g[key];Object.assign(g,seeded);
   g.navigation.game=g;g.combatTerrain.game=g;g.vision.game=g;r.cachedGame=null;
   ui.quality='high';ui.lowDetail=false;ui.showGrid=true;ui.selected.clear();ui.selectedBuildings.clear();
   if(scenario==='late-march'||scenario==='late-campaign'){
    g.time=480;
    for(const s of g.teams){const keep=g.buildings.find(b=>b.team===s.id&&b.type==='keep');while(g.group(s.id).length<280){const i=g.group(s.id).length;g.addUnit(s.id,i%4===0?'archer':'infantry',keep.x+(i%12-6)*.3,keep.y+(Math.floor(i/12)%12-6)*.3);}s.aiClock=scenario==='late-march'?1e9:s.id*.05;}
    if(scenario==='late-march')for(const s of g.teams){const other=g.teams[(s.id+8)%16];g.command(g.group(s.id).map(u=>u.id),other.home.x,other.home.y,'move','line');}
   }else if(scenario==='invasions'){
    g.time=90;for(const s of g.teams)if(s.id)s.aiClock=s.id*.05;
   }else if(scenario==='objectives'){
    g.time=150;const center=g.objectives[0],slots=[];
    for(let y=center.y-14;y<=center.y+14;y+=.55)for(let x=center.x-18;x<=center.x+18;x+=.55)if(g.navigation.isClearPoint(x,y,.24))slots.push({x,y});
    const units=[...g.units];if(slots.length<units.length)throw new Error('Insufficient legal objective slots');
    for(let i=0;i<units.length;i++){const u=units[i],p=slots[Math.floor(i*slots.length/units.length)];u.x=p.x;u.y=p.y;u.seek=0;u.order={x:center.x,y:center.y,mode:'attack',formation:'line'};}
    for(const s of g.teams)if(s.id)s.aiClock=s.id*.05;
   }
   g.hash.rebuild(g.units);g.vision.update(true);g.paused=false;
   const center=scenario==='objectives'?g.objectives[0]:scenario==='woodland'?{x:g.W*.5,y:g.H*.5}:g.teams[0].home;
   view.x=(center.x-center.y)*28;view.y=(center.x+center.y)*14;view.zoom=scenario==='woodland'?.55:scenario==='objectives'?.7:.8;
   const selected=g.group(0).slice(0,12);for(const u of selected)ui.selected.add(u.id);
   window.__measured={updates:[],draws:[],intervals:[],inputs:[],collecting:false,frames:0,selected:selected.map(u=>u.id),units:g.units.length,scenario};
   for(const [object,name,field]of [[g,'update','updates'],[r,'draw','draws']]){const original=object[name];object[name]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{if(window.__measured.collecting)window.__measured[field].push(performance.now()-at);}};}
   window.addEventListener('keydown',e=>{if(e.key!=='h')return;const at=performance.now();requestAnimationFrame(()=>window.__measured.inputs.push(performance.now()-at));},true);
   document.getElementById('battleCanvas').focus();
  });
  // Cache/art warmup uses the real app loop and is excluded from timings.
  await page.evaluate(()=>new Promise(resolve=>{let n=0;const warm=()=>{if(++n>=24)resolve();else requestAnimationFrame(warm);};requestAnimationFrame(warm);}));
  await page.evaluate(samples=>{const m=window.__measured;m.collecting=true;let prior=performance.now();const frame=now=>{m.intervals.push(now-prior);prior=now;m.frames++;if(m.frames<samples)requestAnimationFrame(frame);else{m.collecting=false;m.done=true;}};requestAnimationFrame(frame);},samples);
  for(const threshold of [10,30,50]){
   await page.waitForFunction(n=>window.__measured.frames>=n,Math.min(threshold,samples-2),{timeout:90000});
   await page.keyboard.press('h');
  }
  await page.waitForFunction(()=>window.__measured.done,null,{timeout:90000});
  const row=await page.evaluate(()=>{
   const m=window.__measured,g=window.__bannerlands.game;
   const summary=values=>{const v=[...values].sort((a,b)=>a-b),round=n=>Math.round(n*100)/100;return {samples:v.length,medianMs:round(v[Math.floor(v.length*.5)]||0),p95Ms:round(v[Math.min(v.length-1,Math.floor(v.length*.95))]||0),maxMs:round(v.at(-1)||0),meanMs:round(v.reduce((a,b)=>a+b,0)/Math.max(1,v.length))};};
   return {scenario:m.scenario,unitsAtStart:m.units,livingAtEnd:g.units.length,simulation:summary(m.updates),render:summary(m.draws),frame:summary(m.intervals),inputToNextFrame:summary(m.inputs),framesOver50Ms:m.intervals.filter(x=>x>50).length,framesOver100Ms:m.intervals.filter(x=>x>100).length,holdApplied:m.selected.every(id=>!g.byId.get(id)||g.byId.get(id).hp<=0||g.byId.get(id).order?.mode==='hold'),gameTime:g.time,quality:window.__bannerlands.ui.quality,plans:g.teams.slice(1).map(s=>({id:s.id,phase:s.aiPlan?.phase,intent:s.aiPlan?.role,cohort:s.aiPlan?.cohort?.length})),userAgent:navigator.userAgent};
  });
  assert.equal(row.holdApplied,true,'Trusted H input must preserve the player order during rival planning');assert.equal(row.quality,'high');rows.push(row);console.log(JSON.stringify(row));
  if(option('screenshots',null)){fs.mkdirSync(option('screenshots',null),{recursive:true});await page.screenshot({path:path.join(option('screenshots',null),scenario+'.png')});}
  await page.close();
 }
 assert.deepEqual(errors,[]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({seed,root,samples,viewport:{width:1400,height:900,dpr:1},quality:'high',notes:['Full app RAF, HUD, minimap and controls remain active.','Synthetic late/movement/invasion/objective fixtures; game-time offsets do not represent a natural full campaign.','Input is a trusted Playwright H key; timing covers its browser handler to the next RAF, not physical device latency.','Headless browser timings depend on local graphics/host scheduling.'],rows},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
