'use strict';
// node tools/profile-campaign.cjs GAME_DIR OUTPUT.json [runs=3] [--stress]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync}=require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const destination = process.argv[3];
const runs = Number(process.argv[4]) || 3;
const stress = process.argv.includes('--stress');
const viewport = {width:1280, height:720};
const settings = {quality:'high', resolution:'1280', minimap:true, highContrastWarnings:true,
  damageNumbers:true, screenShake:false};
async function privateMemoryMiB(session){
  if(process.platform!=='win32')return null;
  const {processInfo}=await session.send('SystemInfo.getProcessInfo');
  const ids=processInfo.map(p=>p.id).filter(n=>Number.isSafeInteger(n)&&n>0);
  if(!ids.length)throw Error('Chrome process list was empty');
  const command='(Get-Process -Id '+ids.join(',')+' -ErrorAction SilentlyContinue | Measure-Object -Property PrivateMemorySize64 -Sum).Sum';
  const bytes=Number(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8'}).trim());
  if(!(bytes>0))throw Error('Chrome process memory measurement failed');
  return +(bytes/1048576).toFixed(1);
}
function install({settings}) {
  localStorage.setItem('whiskerfall.settings',JSON.stringify(settings));
  window.probePads = [0,1].map(index => ({id:'Fixture pad '+index, mapping:'standard', connected:true, index,
    axes:[0,0,0,0], buttons:Array.from({length:17}, () => ({value:0, pressed:false}))}));
  Object.defineProperty(navigator,'getGamepads',{value:() => probePads});
  window.cold = {};
  function watch(t) {
    const image = document.querySelector('.main-art img');
    if (!cold.coverMs && image?.complete && image.naturalWidth) cold.coverMs = performance.now();
    if (!cold.readyMs && window.OW?.game?.ready) cold.readyMs = performance.now();
    if (!cold.coverMs || !cold.readyMs) requestAnimationFrame(watch);

  }
  requestAnimationFrame(watch);
}
async function setupCampaign({coop}) {
  const g = OW.game;
  // Seed before World construction and before fixtures create a single actor.
  let seed = 1839;
  Math.random = () => ((seed = (Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const start = performance.now();
  if (g.beginCampaign) g.beginCampaign({slot:0,coop}); else g.start({slot:0,coop});
  const campaignStartMs = performance.now()-start;
  let exitMs = null;
  if (g.opening?.phase === 'comic') {
    OW.Comics.advance(g,true);
    if (!g.world.isTutorial) throw Error('Opening did not enter the training yard');
    // The component under measurement starts at a completed yard, facing its exit.
    g.opening.step='exit';
    for (const p of g.players) Object.assign(p,{x:g.world.exit.x,y:g.world.exit.y});
    for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);
    const before = performance.now();
    g.interact(g.players[0]);
    if (g.world.isTutorial || g.opening.phase!=='complete') throw Error('Tutorial exit did not transfer the party');
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    exitMs = performance.now()-before;
  }
  if (g.paused || g.ui.isOpen) throw Error('Gameplay remains paused');
  return {campaignStartMs, exitMs};
}
async function fixture({scene,frames,warmup,stressRoles}) {
  const g = OW.game, w = g.world;
  // The old campaign has no yard. Reset clocks and RNG at the field boundary
  // so time spent reading the comic or awaiting its exit cannot shift attacks.
  let seed=1839;
  Math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  Object.assign(g,{time:0,playTime:0,enemyFrame:0,eventTime:60,autosaveTime:0,questTime:0});
  g.renderer.clock=0;g.renderer.frame=0;
  g.audio.resetAnimals?.();g.bulletPool.reset();g.effectPool.reset();g.particlePool.reset();
  g.players=g.players.map(p=>g.newPlayer(p.id,p.skin));
  g.drops=[];g.allies=[];g.itemReveals=[];g.marker=null;
  document.getElementById('toast-region').replaceChildren();
  // Use the full frame loop, ordinary stream/AI, physics, input, draw, HUD and audio.
  // Pin authored spawns to this roster to keep the before/after fixture identical.
  w._spawnChunks.clear(); w._active.clear(); w.activeEnemies.length=0; w._streamTimer=0;
  g.renderer.chunks.clear();
  const town=w.getLocation('town_0');
  const roles=scene==='town'?['rifle','rifle']:['fencer','blinkstalker','cindermortar','prismsentry','roller','fencer'];
  if (scene==='stress') roles.push(...stressRoles);
  let dx=1,dy=0;
  if(scene==='town'){
    // Pick a real, walkable street that crosses the circular town boundary.
    let found=false;
    for(let n=0;n<32&&!found;n++){
      dx=Math.cos(n*Math.PI/16);dy=Math.sin(n*Math.PI/16);
      found=true;
      for(let r=70;r<=730;r+=12)if(w.isBlocked(town.x+dx*r,town.y+dy*r,20)){found=false;break;}
    }
    if(!found)throw Error('Willow has no traversable street for the chase fixture');
  }
  const point=scene==='town'?{x:town.x+555*dx,y:town.y+555*dy}:{x:16500,y:11180};
  g.questStats.explored.add(w.regionAt(point.x,point.y).id);
  for (const [i,p] of g.players.entries()) {
    g.clearPlayerCombat(p);
    Object.assign(p,point,{y:point.y+i*60,level:15,hp:10000,maxHp:10000,invuln:0,reserve:5000,weapon:0,upgrade:3});
  }
  Object.assign(g.camera,point,{zoom:.93,shake:0});
  const sources = [];
  for(const [i,role] of roles.entries()){
    const type=role==='rifle'?0:OW.Content.enemies.findIndex(e=>e.role===role);
    if (type<0) throw Error('Missing enemy role '+role);
    const x=point.x+(scene==='town'?(85+i*26)*dx:90+i*45), y=point.y+(scene==='town'?(85+i*26)*dy:-20+i%2*75);
    const e=w._createEnemy({id:'release-fixture-'+i,type,x,y,homeX:x,homeY:y,level:15,region:scene==='town'?0:4,patrol:0});
    e.state='chase';e.alert=7;g.ensureEnemyScaling(e);e.hp=e.maxHp=12000;
    w.addEnemy(e);sources.push(e);
  }
  const components = {};
  const undo = [];
  let measuring = false;
  function trace(obj,name,key=name){
    if (typeof obj[name]!=='function') return;
    const old=obj[name];
    components[key]={calls:0,ms:0};
    obj[name]=function(){
      if(!measuring)return old.apply(this,arguments);
      const start=performance.now();
      try {return old.apply(this,arguments);} finally {components[key].ms+=performance.now()-start;components[key].calls++;}
    };
    undo.push(()=>obj[name]=old);
  }
  for(const name of ['update','updateEnemies','updateLocations','updateMissions','updateProjectiles','updatePlayer','updateEffects'])trace(g,name);
  for(const name of ['draw','drawTerrain','drawObject','drawActor','drawEffect','atmosphere','drawLocationLabels'])trace(g.renderer,name);
  trace(w,'updateActive');trace(w,'reveal');trace(g.ui,'update','hud');trace(g.ui,'drawMinimap');
  const elapsed=[], framesInside=[];
  let previous, sampleCount=0, peakEnemies=0,maxProjectiles=0,attackFrames=0;
  const originalFrame=g.frame;
  g.frame=function(t){this.last=t-1000/60;return originalFrame.call(this,t);};
  undo.push(()=>g.frame=originalFrame);
  const attackStates=new Set();
  for(let i=0;i<warmup+frames;i++){
    const before=g.enemyFrame;
    const t=await new Promise(requestAnimationFrame);
    if(g.enemyFrame===before && i>1)throw Error('Game simulation stalled at '+scene+' frame '+i+' ('+g.ui.menu+')');
    if(i===warmup-1 && scene!=='town') {
      for(const p of g.players){p.downed=false;p.hp=p.maxHp=10000;}
    }
    if (i>=warmup) {
      elapsed.push(t-previous);sampleCount++;peakEnemies=Math.max(peakEnemies,w.activeEnemies.length);
      framesInside.push(!!g.safeZoneAt(g.players[0].x,g.players[0].y));
      maxProjectiles=Math.max(maxProjectiles,g.projectiles.filter(o=>o.alive).length);
      for(const e of sources)if(e.combatState)attackStates.add(e.combatState);
      if(sources.some(e=>e.windup||e.combatState==='windup'||e.specialMove?.windup>0))attackFrames++;
    }
    previous=t; measuring=i>=warmup-1;
    for(const [j,pad] of probePads.entries()){
      pad.axes[0]=scene==='town'?(i<105?-dx:dx):0;
      pad.axes[1]=scene==='town'?(i<105?-dy:dy):(i%96<48?.46:-.46);
      pad.axes[2]=1;
      for(const [button,pressed] of [[7,scene!=='town'&&i%14<4],[0,scene!=='town'&&i===70+j*12],[5,scene!=='town'&&i===84+j*7],[13,i===144+j*5]]){
        pad.buttons[button].pressed=pressed;pad.buttons[button].value=Number(pressed);
      }
    }
  }
  for(const restore of undo.reverse())restore();
  for(const pad of probePads){pad.axes.fill(0);for(const b of pad.buttons){b.pressed=false;b.value=0;}}
  function quantile(values, fraction){const a=values.slice().sort((a,b)=>a-b);return +a[Math.ceil(fraction*a.length)-1].toFixed(2);}
  return {scene,frames:sampleCount,p95Ms:quantile(elapsed,.95),p99Ms:quantile(elapsed,.99),over33:elapsed.filter(t=>t>33).length,
    over50:elapsed.filter(t=>t>50).length,peakEnemies,framesInside:framesInside.filter(Boolean).length,
    maxProjectiles,attackFrames,attackStates:[...attackStates],
    end:g.players.map(p=>({x:Math.round(p.x),y:Math.round(p.y),hp:p.hp,shots:p.reserve})),
    roles: sources.map(e=>OW.Content.enemies[e.type].role),
    costPerFrameMs:Object.fromEntries(Object.entries(components).map(([key,val])=>[key,+(val.ms/sampleCount).toFixed(3)]))};
}
async function measure() {
  const records=[];
  for(let run=0;run<runs;run++){
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
    try{
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const cdp=await page.context().newCDPSession(page);
      const browserSession=await browser.newBrowserCDPSession();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(install,{settings});
      await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.cold?.readyMs&&cold.coverMs);
      const cold=await page.evaluate(()=>window.cold);
      const journeys=[],scenes=[],heapMiB=[],privateMiB=[],surfaceReturns=[];
      for(const scene of ['town','coop']){
        journeys.push(await page.evaluate(setupCampaign,{coop:scene!=='town'}));
        const roles=['gallows_bell','seam_ripper'];
        scenes.push(await page.evaluate(fixture,{scene,frames:180,warmup:45,stressRoles:roles}));
      }
      // Collect retained JS heap only after the same four complete start/arrival cycles.
      for(let visit=0;visit<4;visit++){
        const visitStart=await page.evaluate(setupCampaign,{coop:true});
        journeys.push(visitStart);
        surfaceReturns.push(await page.evaluate(async()=>{
          const g=OW.game,entry=g.world.getLocation('cave_0_0');
          for(const [i,p] of g.players.entries())Object.assign(p,{x:entry.x+i*30,y:entry.y+30});
          if(!g.enterDungeon(entry))throw Error('Could not enter reference cavern');
          for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
          const begin=performance.now();
          if(!g.leaveDungeon())throw Error('Could not return to surface');
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          return +(performance.now()-begin).toFixed(2);
        }));
        await cdp.send('HeapProfiler.collectGarbage');
        heapMiB.push(+((await cdp.send('Runtime.getHeapUsage')).usedSize/1048576).toFixed(2));
        privateMiB.push(await privateMemoryMiB(browserSession));
      }
      if(stress){
        await page.evaluate(setupCampaign,{coop:true});
        scenes.push(await page.evaluate(fixture,{scene:'stress',frames:180,warmup:45,stressRoles:['gallows_bell','seam_ripper']}));
      }
      if(errors.length)throw Error(errors.join('\n'));
      records.push({run:run+1,browser:browser.version(),cold,journeys,scenes,heapMiB,privateMiB,surfaceReturns});
      const result={device:os.cpus()[0].model,platform:os.platform()+' '+os.release(),viewport,settings,records};
      if(destination) fs.writeFileSync(destination,JSON.stringify(result,null,2)+'\n');
      console.log(JSON.stringify(records.at(-1)));
    }finally{await browser.close();}
  }
}
measure().catch(e=>{console.error(e);process.exitCode=1;});
