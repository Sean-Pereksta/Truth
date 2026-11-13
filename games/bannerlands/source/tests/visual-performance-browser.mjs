// Actual Chromium comparison: the previous renderer and current renderer use
// identical deterministic current simulation fixtures and decoded source PNGs.
// No app animation loop runs alongside the benchmark's saved native RAF.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const baseline=process.env.LANDS_RENDER_BASELINE?fs.readFileSync(process.env.LANDS_RENDER_BASELINE,'utf8'):execFileSync('git',['show','origin/main:games/bannerlands/render.js'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const baselineSource=baseline.replace(/from ['"]file:[^'"]*\/(core|aftermath)\.js['"]/g,(_,name)=>`from './${name}.js'`);
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
const symbols=markup.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/)?.[0]||'';
const html=`<!doctype html><html><head><style>html,body{margin:0;background:#10272e;overflow:hidden}#bench{display:block;width:1400px;height:900px}</style></head><body>${symbols}<canvas id="bench"></canvas><script>window.__benchRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;</script></body></html>`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/benchmark.html'){res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
  if(url.pathname==='/render-baseline.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(baselineSource);return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[],rows=[],samples=Number(process.env.LANDS_VISUAL_PERFORMANCE_FRAMES||90),warmup=Number(process.env.LANDS_VISUAL_PERFORMANCE_WARMUP||24);
const scenarios=[
  {name:'stationary-1200',army:1200,zoom:.9,combat:false,pan:false},
  {name:'panning-1200',army:1200,zoom:.85,combat:false,pan:true},
  {name:'combat-1200',army:1200,zoom:.95,combat:true,pan:false},
  {name:'combat-2500',army:2500,zoom:.8,combat:true,pan:false},
  {name:'strategic-pan-2500',army:2500,zoom:.55,combat:false,pan:true}
];
const versions=process.env.LANDS_VISUAL_PERFORMANCE_VERSIONS?.split(',')||['baseline','current'];
const activeScenarios=process.env.LANDS_VISUAL_PERFORMANCE_SCENES?scenarios.filter(s=>process.env.LANDS_VISUAL_PERFORMANCE_SCENES.split(',').includes(s.name)):scenarios;
const disableCrests=process.env.LANDS_VISUAL_PERFORMANCE_DISABLE_CRESTS==='1';
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  for(const version of versions){
    const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});page.on('pageerror',error=>errors.push({version,message:error.message}));
    await page.goto(origin+'/benchmark.html');
    const environment=await page.evaluate(async version=>{
      const {Game,HOUSES}=await import('./core.js'),{Renderer}=await import(version==='baseline'?'./render-baseline.js':'./render.js');
      const r=new Renderer(document.getElementById('bench'));
      const houses=['wolf','lion','dragon','rose','bear','sun','falcon'];
      await Promise.all([
        r.loadTroops('/assets/troops-atlas.png'),r.loadTerrain('/assets/ground-textures.png','/assets/terrain-props.png'),
        r.loadLandsArt('/assets/lands-atlas.png'),r.loadLandsGround('/assets/lands-ground.png'),
        r.loadStructures('/assets/structures-atlas.png'),r.loadCampaignArt('/assets/campaign-structures.png'),
        r.loadHouseArt({troops:Object.fromEntries(HOUSES.map(h=>[h.sigil,`/assets/houses/${h.sigil}-troops.png`])),castles:'/assets/house-castles.png',production:'/assets/house-production.png'}),
        r.loadRegimentArt(Object.fromEntries(houses.map(h=>[h,`/assets/regiments/${h}-${['wolf','lion','dragon','rose'].includes(h)?'shield-bearer':'lance-champion'}.png`]))),
        r.loadRegimentBuildings('/assets/regiments/production-buildings.png'),
        r.loadConquestArt(Object.fromEntries(['castles','trebuchet','giant','sharpshooter','buildings'].map(k=>[k,`/assets/conquest/${k}.png`]))),
        ...(r.loadReinforcementArt?[r.loadReinforcementArt(Object.fromEntries(['stormbreaker','saltwind_axethrower','tollhouse_crossbow','crannog_spearhand','hornhill_halberdier','sun_horse_archer','buildings'].map(k=>[k,`/assets/reinforcements/${k}.png`])))]:[]),
        ...(r.loadHouseEmblems?[r.loadHouseEmblems('/assets/house-emblems.png')]:[])
      ]);
      r.resize(1400,900,1);window.__visualBench={Game,HOUSES,r};
      const gl=document.createElement('canvas').getContext('webgl'),extension=gl?.getExtension('WEBGL_debug_renderer_info');
      return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,graphics:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null};
    },version);
    for(const scenario of activeScenarios){
      const result=await page.evaluate(async ({scenario,version,samples,warmup,disableCrests})=>{
        const {Game,r}=window.__visualBench;
        const g=new Game({scale:'continent',landscape:'riverlands',enemies:15,seed:44277,difficulty:'standard'});
        g.units=[];for(const [id,e]of g.byId)if(!g.buildings.includes(e))g.byId.delete(id);
        for(const s of g.teams){s.count=0;s.cap=20000;s.aiClock=1e9;s.powerReadyAt=1e9;s.upgrades.armor=500;s.alliance=scenario.combat?s.id%2:0;}
        for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
        // Keep neutral fixture lifecycle stable while measuring the real update
        // path. AI, training and victory resolution are intentionally disabled
        // in both versions, isolating troop simulation and visual overhead.
        g.checkVictory=()=>{};g.objectives=[];g.castles=[];g.time=10;
        const center={x:g.W*.5,y:g.H*.5},slots=[];
        for(let y=center.y-18;y<=center.y+18;y+=.55)for(let x=center.x-23;x<=center.x+23;x+=.55)if(g.navigation.isClearPoint(x,y,.24))slots.push({x,y});
        if(slots.length<scenario.army)throw new Error('Insufficient legal benchmark slots.');
        const types=['infantry','archer','infantry','cavalry','archer','infantry','cavalry','archer','infantry','siege'];
        for(let i=0;i<scenario.army;i++){
          const team=i%16,p=slots[Math.floor(i*slots.length/scenario.army)],type=types[i%types.length],u=g.addUnit(team,type,p.x,p.y);
          u.cooldown=(i%19)*.07;u.seek=(i%7)*.02;
          u.order={x:scenario.combat?center.x:u.x,y:scenario.combat?center.y:u.y,mode:scenario.combat?'attack':'hold',formation:'line'};
          u.facingX=team%2?1:-1;u.facingY=0;
        }
        g.hash.rebuild(g.units);g.vision.update(true);
        const camera={x:(center.x-center.y)*28,y:(center.x+center.y)*14,w:1400,h:900,zoom:scenario.zoom,dpr:1};
        const ui={selected:new Set(),selectedBuildings:new Set(),quality:'auto',showGrid:false,hover:null},cx=camera.x,cy=camera.y;
        let clock=16.7,lastTime=null,detailFrames=0;
        const coldAt=performance.now();r.draw(g,camera,ui);const coldMs=performance.now()-coldAt;
        const bannerDraw=r.formationBannerLayer?.draw;
        if(disableCrests&&bannerDraw)r.formationBannerLayer.draw=()=>[];
        if(scenario.pan)for(const offset of [-150,-75,0,75,150]){camera.x=cx+offset;camera.y=cy+offset*.15;r.draw(g,camera,ui);}
        const update=[],draw=[],interval=[],stages={},stageNames=['drawGround','drawBridgeArchitecture','updateTerritory','unit','effects'];
        const originals=new Map();let collecting=false;
        for(const name of stageNames){const fn=r[name];originals.set(name,fn);r[name]=function(...args){if(!collecting)return fn.apply(this,args);const at=performance.now();try{return fn.apply(this,args);}finally{stages[name]=(stages[name]||0)+performance.now()-at;}};}
        const measureBanner=r.formationBannerLayer?.draw;
        if(measureBanner&&!disableCrests)r.formationBannerLayer.draw=function(...args){if(!collecting)return measureBanner.apply(this,args);const at=performance.now();try{return measureBanner.apply(this,args);}finally{stages.formationCrests=(stages.formationCrests||0)+performance.now()-at;}};
        const nextFrame=()=>new Promise(resolve=>window.__benchRAF(resolve));
        try{
          for(let i=-warmup;i<samples;i++){
            const time=await nextFrame(),delta=lastTime===null?16.7:time-lastTime;lastTime=time;clock=clock*.95+Math.min(100,delta)*.05;
            ui.lowDetail=1000/clock<46;collecting=i>=0;
            if(collecting){interval.push(delta);if(ui.lowDetail)detailFrames++;}
            if(i%2===0){const at=performance.now();g.update(1/30);if(collecting)update.push(performance.now()-at);}
            if(scenario.pan){const offset=Math.sin((i+warmup)/45)*150;camera.x=cx+offset;camera.y=cy+offset*.15;}
            const at=performance.now();r.draw(g,camera,ui);if(collecting)draw.push(performance.now()-at);
          }
        }finally{for(const [name,fn]of originals)r[name]=fn;if(bannerDraw)r.formationBannerLayer.draw=bannerDraw;}
        const summary=values=>{const sorted=[...values].sort((a,b)=>a-b),round=n=>Math.round(n*100)/100;return {samples:values.length,medianMs:round(sorted[Math.floor(sorted.length*.5)]||0),p95Ms:round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]||0),maxMs:round(sorted.at(-1)||0),meanMs:round(values.reduce((a,b)=>a+b,0)/Math.max(1,values.length))};};
        return {version,scene:scenario.name,armyRequested:scenario.army,livingAtEnd:g.units.filter(u=>u.hp>0).length,zoom:scenario.zoom,quality:'auto',crestsDisabledForDiagnosis:disableCrests,lowDetailPercent:Math.round(detailFrames/samples*100),coldPrepareMs:Math.round(coldMs),draw:summary(draw),update:summary(update),frameInterval:summary(interval),framesOver33Ms:interval.filter(v=>v>33.4).length,framesOver50Ms:interval.filter(v=>v>50).length,framesOver100Ms:interval.filter(v=>v>100).length,stagesMeanMs:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,Math.round(v/samples*100)/100]))};
      },{scenario,version,samples,warmup,disableCrests});
      rows.push({...result,environment});console.log(JSON.stringify(result));
    }
    await page.close();
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  const output=path.resolve(process.env.LANDS_VISUAL_PERFORMANCE_OUT||path.resolve(root,'../../../visual-performance-browser.json'));
  const metadata={createdAt:new Date().toISOString(),samples,warmup,versions,crestsDisabledForDiagnosis:disableCrests,viewport:{width:1400,height:900,dpr:1},notes:['Actual headless Chromium RAF frame intervals, not an inferred FPS claim.','Both renderers use the current Game and identical seeded fixtures; AI, training and victory resolution disabled.','Default Auto quality follows the app\'s smoothed 46 FPS detail threshold.','App RAF is disabled; only the saved native RAF drives samples.','Method timing wrappers add the same measurement overhead to both versions.'],results:rows};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(metadata,null,2));
  const report=rows.map(row=>`${row.version.padEnd(8)} ${row.scene.padEnd(22)} draw ${row.draw.medianMs}/${row.draw.p95Ms} ms; update ${row.update.medianMs}/${row.update.p95Ms} ms; frame ${row.frameInterval.medianMs}/${row.frameInterval.p95Ms} ms; >50 ms ${row.framesOver50Ms}/${samples}; low detail ${row.lowDetailPercent}%`).join('\n');
  fs.writeFileSync(output.replace(/\.json$/i,'-report.txt'),report+'\n');console.log('\n'+report+'\nSaved '+output);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
