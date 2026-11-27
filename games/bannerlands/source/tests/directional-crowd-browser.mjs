import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Run against two checkouts with --root to compare their actual browser code,
// artwork, and simulation with an identical placement and update schedule.
const args=process.argv.slice(2);
function option(name,fallback){
  const i=args.indexOf('--'+name);
  return i<0?fallback:args[i+1];
}
const root=path.resolve(option('root',fileURLToPath(new URL('../..',import.meta.url))));
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?
  path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const config={army:Number(option('units',2500)),warmup:Number(option('warmup',30)),
  samples:Number(option('frames',100)),zoom:Number(option('zoom',.82)),dragon:args.includes('--dragon')};
assert.ok(Number.isInteger(config.army)&&config.army>0&&config.samples>0&&config.warmup>=0&&config.zoom>0);
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript',
  '.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER,
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Drive a single real animation loop in the benchmark, independent of the menu.
  await page.addInitScript(()=>{window.benchRaf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='bannerlands.test')return route.abort();
    if(url.pathname==='/Truth/hub/play-signal.mjs')return route.fulfill({body:'',contentType:'application/javascript'});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep))return route.abort();
    try{await route.fulfill({body:await fs.readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'});}
    catch{await route.fulfill({status:404,body:''});}
  });
  await page.goto('https://bannerlands.test/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#startButton')?.disabled===false,null,{timeout:120000,polling:100});
  const result=await page.evaluate(async({army,warmup,samples,zoom,dragon})=>{
    const {Game}=await import('./core.js'),r=window.__bannerlands.renderer;
    const g=new Game({scale:'continent',landscape:'riverlands',enemies:15,seed:44277,difficulty:'warlord',fogOfWar:false});
    for(const u of g.units)g.byId.delete(u.id);
    g.units=[];
    // Keep both armies engaged for the sample; disable AI order replacement,
    // training, and victory. Combat, navigation and crowd separation run normally.
    for(const t of g.teams){t.count=0;t.cap=10000;t.alliance=t.id%2;t.aiClock=1e9;t.powerReadyAt=1e9;}
    for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
    g.checkVictory=()=>{};g.objectives=[];g.castles=[];g.time=10;
    const cx=g.W/2,cy=g.H/2,slots=[],dragonTeam=g.teams.find(t=>t.sigil==='dragon').id;
    for(let y=cy-28;y<cy+28;y+=.55)for(let x=cx-27;x<cx+27;x+=.55)
      if(g.navigation.isClearPoint(x,y,.25))slots.push({x,y});
    if(army>slots.length)throw Error('Too many units for the fixed battle area');
    const types=['infantry','archer','cavalry','infantry','archer','siege','infantry','cavalry','archer','infantry'];
    for(let i=0;i<army;i++){
      const team=i%16,p=slots[Math.floor(i*slots.length/army)];
      const type=dragon&&i===dragonTeam?'dragon':i%7===0?g.houseContent(team).unit:types[i%types.length];
      const u=g.addUnit(team,type,p.x,p.y);u.cooldown=(i%19)*.07;u.seek=(i%7)*.02;
      u.order={x:cx,y:cy,mode:'attack',formation:'line',groupX:cx,groupY:cy};
    }
    g.hash.rebuild(g.units);g.vision.update(true);
    g.captureUnitPresentation=true;
    await r.loadDirectionalSheets(g);r.resize(1280,800,1);
    const camera={x:(cx-cy)*28,y:(cx+cy)*14,w:1280,h:800,zoom,dpr:1};
    const ui={selected:new Set(),selectedBuildings:new Set(),quality:'auto',lowDetail:false,showGrid:false,hover:null};
    const intervals=[],renders=[],updates=[];let previous=null,smoothed=16.7,reducedFrames=0,dragonAttacks=0;
    const attack=g.attack;g.attack=function(u,...args){const res=attack.call(this,u,...args);if(u.type==='dragon'&&u.attackVisual?.at===g.time)dragonAttacks++;return res;};
    for(let i=-warmup;i<samples;i++){
      const now=await new Promise(resolve=>window.benchRaf(resolve));
      if(previous!==null){const elapsed=now-previous;smoothed=.95*smoothed+.05*Math.min(100,elapsed);if(i>=0)intervals.push(elapsed);}
      previous=now;ui.lowDetail=1000/smoothed<46;if(i>=0&&ui.lowDetail)reducedFrames++;
      if(i%2===0){const at=performance.now();g.update(1/30);if(i>=0)updates.push(performance.now()-at);}
      // Sample both 60 Hz presentation frames around each 30 Hz simulation tick.
      const at=performance.now();
      ui.localPoseMix=i%2===0?0:.5;
      r.draw(g,camera,ui);
      if(i>=0)renders.push(performance.now()-at);
    }
    function stats(values){
      const sorted=values.slice().sort((a,b)=>a-b),pct=n=>Math.round(100*sorted[Math.floor(n*sorted.length)])/100;
      return {samples:sorted.length,p50:pct(.50),p95:pct(.95)};
    }
    const living=g.units.filter(u=>u.hp>0),visible=living.filter(u=>
      Math.abs((u.x-u.y)*28-camera.x)<640/zoom&&Math.abs((u.x+u.y)*14-camera.y)<400/zoom).length;
    const gl=document.createElement('canvas').getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {seed:44277,viewport:[1280,800],quality:'auto',browser:navigator.userAgent,
      gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,living:living.length,visible,reducedFrames,
      dragonAttacks,frameIntervalMs:stats(intervals),drawMs:stats(renders),simulationTickMs:stats(updates)};
  },config);
  assert.deepEqual(errors,[]);
  if(config.dragon)assert.ok(result.dragonAttacks>0,'The dragon must breathe fire during the stress test');
  const json=JSON.stringify({...config,...result},null,2);
  console.log(json);
  if(option('output',null))await fs.writeFile(option('output'),json+'\n');
}finally{await browser.close();}
