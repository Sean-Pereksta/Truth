import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}if(process.env.BANNERLANDS_SKIP_HERO_ART==='1'&&path.basename(file)==='app.js')data=Buffer.from(data.toString().replace('renderer.loadPaintedHeroes(HERO_ART_SOURCES)','Promise.resolve()'));response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER,args:['--no-sandbox','--disable-dev-shm-usage']}),errors=[];
async function setup(context){
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`,{timeout:90000});
 await page.waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:90000});
 await page.evaluate(()=>{
  document.getElementById('scaleSelect').value='standard';document.getElementById('landscapeSelect').value='open';document.getElementById('enemySelect').value='1';document.getElementById('fogSelect').value='off';window.__bannerlands.start();
  const {game:g,ui,view}=window.__bannerlands;g.paused=true;g.units=[];g.buildings=[];g.byId.clear();g.standards=[];g.standardRemains=[];g.projectiles=[];g.effects=[];g.fireZones=[];g.objectives=[];g.castles=[];g.time=100;
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;}g.navigation.invalidate();for(const s of g.teams){s.count=0;s.cap=1000;s.aiClock=1e9;s.alive=true;s.heroStandardIssued=false;}
  g.addBuilding(0,'keep',20,20);g.addBuilding(1,'keep',80,70);const hero=g.addUnit(0,'hero',30,30);for(let i=0;i<8;i++)g.addUnit(0,'infantry',28,30+i*.5);
  ui.selected=new Set([hero.id]);ui.selectedBuildings.clear();view.x=0;view.y=840;view.zoom=1;document.getElementById('battleCanvas').focus();
  window.__point=(x,y)=>{const v=window.__bannerlands.view,r=document.getElementById('battleCanvas').getBoundingClientRect();return {x:r.left+((x-y)*28-v.x)*v.zoom+v.w/2,y:r.top+((x+y)*14-v.y)*v.zoom+v.h/2};};
  window.__heroTick=seconds=>{g.paused=false;for(let i=0;i<Math.ceil(seconds*30);i++)g.update(1/30);g.paused=true;};
  window.__heroClicks=[];document.addEventListener('click',e=>window.__heroClicks.push({id:e.target.id,selected:[...ui.selected]}));
 });await page.waitForTimeout(280);return page;
}
async function capture(page,name){if(process.env.BANNERLANDS_SCREENSHOT_DIR){fs.mkdirSync(process.env.BANNERLANDS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.BANNERLANDS_SCREENSHOT_DIR,name+'.png')});}}
async function checkHeroBeacon(page){
 await page.evaluate(()=>window.__bannerlands.ui.selected.clear());await page.waitForTimeout(280);assert.equal(await page.locator('#quickStandardOrders').isVisible(),false);assert.equal(await page.locator('#heroHudButton').isVisible(),true);
 const hit=await page.locator('#heroHudButton').evaluate(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {left:r.x,top:r.y,right:r.right,bottom:r.bottom,hit:top===e||e.contains(top)};});assert.ok(hit.left>=0&&hit.top<64&&hit.hit);assert.match(await page.locator('#heroHudHealth').textContent(),/800 \/ 800 HP/);
 await page.locator('#heroHudButton').click();await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>window.__bannerlands.ui.selected.has(window.__bannerlands.game.heroFor(0).id)),true);if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches)){await page.locator('#mobileOptions').tap();assert.ok(await page.locator('#mobileStandard').isVisible());await page.locator('#mobileOptions').tap();}else assert.ok(await page.locator('#quickStandardOrders').isVisible());
}
async function paintedCalls(page,{unseen=false}={}){
 return page.evaluate(({unseen})=>{
  const {renderer:r,game:g,view,ui}=window.__bannerlands,draw=r.drawPaintedTroop,visibility=g.isVisibleTo,fog=g.config.fogOfWar,calls=[];
  r.drawPaintedTroop=function(c,row,index,...args){if(row.type==='hero')calls.push({house:row.house,index});return draw.call(this,c,row,index,...args);};
  if(unseen){g.config.fogOfWar=true;g.isVisibleTo=function(team,object){return object?.type==='standard'?false:visibility.call(this,team,object);};}
  try{r.draw(g,view,ui);}finally{r.drawPaintedTroop=draw;g.isVisibleTo=visibility;g.config.fogOfWar=fog;}
  return calls;
 },{unseen});
}
async function checkHeroArtwork(page){
 if(process.env.BANNERLANDS_SKIP_HERO_ART==='1')return;
 const art=await page.evaluate(()=>{
  const r=window.__bannerlands.renderer,rows=[...r.heroRows.values()],portraits=[];
  for(const row of rows){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;if(!r.drawHeroPortrait(canvas,row.house))throw new Error('Missing portrait '+row.house);const bytes=canvas.getContext('2d').getImageData(0,0,96,96).data;let hash=2166136261,pixels=0;for(let i=0;i<bytes.length;i++){hash=Math.imul(hash^bytes[i],16777619)>>>0;if(i%4===3&&bytes[i]>48)pixels++;}portraits.push({house:row.house,hash,pixels});}
  return {ready:r.heroArtReady,rows:rows.map(row=>({house:row.house,frames:row.frames.length,facings:row.facings,painted:row.painted})),portraits};
 });assert.equal(art.ready,true);assert.equal(art.rows.length,16);assert.ok(art.rows.every(row=>row.frames===64&&row.facings===2&&row.painted));assert.ok(art.portraits.every(p=>p.pixels>150));assert.equal(new Set(art.portraits.map(p=>p.hash)).size,16,'Every faction has a distinct painted portrait.');
 const calls=await paintedCalls(page);assert.equal(calls.filter(call=>call.house==='wolf'&&call.index<56).length,1,'The actual battlefield hero uses its painted row.');assert.equal(calls.filter(call=>call.index>=56).length,0,'A carrying hero has no second world standard.');
 console.log('PASS All 16 heroes have 64 painted frames, exactly 2 facings, unique nonempty portraits and actual painted world rendering.');
}
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:900}}),page=await setup(desktop);
 await checkHeroBeacon(page);
 await checkHeroArtwork(page);
 await page.keyboard.press('j');assert.equal(await page.evaluate(()=>!!window.__bannerlands.ui.standardMode),true);
 const at=await page.evaluate(()=>window.__point(30,30));await page.mouse.click(at.x,at.y);await page.evaluate(()=>window.__heroTick(1.5));
 if(process.env.BANNERLANDS_SKIP_HERO_ART!=='1'){const calls=await paintedCalls(page);assert.equal(calls.length,1);assert.ok(calls[0].index>=8&&calls[0].index<=15,'Planting draws one complete authored interaction, with no spare pole.');}
 await page.evaluate(()=>window.__heroTick(1.4));
 assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).carrierId!=null),true);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).state),'carrying');
 if(process.env.BANNERLANDS_SKIP_HERO_ART!=='1'){const calls=await paintedCalls(page);assert.equal(calls.length,1);assert.ok([32,33].includes(calls[0].index),'Cancellation draws the authored planting abort.');}
 await page.keyboard.press('j');await page.mouse.click(at.x,at.y);await page.evaluate(()=>window.__heroTick(3.3));
 assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).state),'planted');assert.equal(await page.evaluate(()=>window.__bannerlands.game.standards.filter(s=>s.team===0).length),1);
 if(process.env.BANNERLANDS_SKIP_HERO_ART!=='1'){const calls=await paintedCalls(page);assert.equal(calls.filter(call=>call.index<56).length,1);assert.equal(calls.filter(call=>[56,57].includes(call.index)).length,1,'The released standard renders once as a world object.');const fogCalls=await paintedCalls(page,{unseen:true});assert.equal(fogCalls.filter(call=>call.index>=56).length,1,'Owner knowledge through fog renders the same standard exactly once.');}
 await page.keyboard.press('o');await page.waitForTimeout(260);assert.equal(await page.locator('#heroPanel').isVisible(),true);assert.match(await page.locator('#heroName').textContent(),/Winter Marshal/);assert.match(await page.locator('#heroBenefitName').textContent(),/Winter Holds/);assert.match(await page.locator('#standardButton').textContent(),/Retrieve/);await capture(page,'hero-controls-desktop');
 await page.locator('#battleCanvas').focus();await page.keyboard.press('Escape');
 await page.evaluate(()=>{const g=window.__bannerlands.game,h=g.heroFor(0);g.standardFor(0).hp=177;g.command([h.id],34,30,'move','spread');window.__heroTick(3);});
 await page.keyboard.press('j');assert.equal(await page.evaluate(()=>window.__bannerlands.game.heroFor(0).standardAction.phase),'travel');
 await page.evaluate(()=>window.__heroTick(.2));assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).carrierId),null);
 await page.evaluate(()=>window.__heroTick(2.5));
 if(process.env.BANNERLANDS_SKIP_HERO_ART!=='1'){const calls=await paintedCalls(page);assert.equal(calls.length,1);assert.ok(calls[0].index>=24&&calls[0].index<=31,'Pickup draws one complete authored grasp/pull/lift interaction.');}
 await page.evaluate(()=>window.__heroTick(3.1));assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).state),'carrying');assert.equal(await page.evaluate(()=>window.__bannerlands.game.standardFor(0).hp),177);
 await page.keyboard.press('Shift+j');assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'winter_pike_hall');await page.keyboard.press('Escape');
 console.log('PASS Real keyboard/canvas planting, 2.9s cancellation, retrieve travel, health persistence, hero benefit panel and preserved Shift+J.');await desktop.close();
 for(const size of (process.env.BANNERLANDS_HERO_UI_LANDSCAPE_ONLY==='1'?[{width:844,height:390}]:[{width:320,height:740},{width:390,height:844},{width:844,height:390}])){
  const context=await browser.newContext({viewport:size,hasTouch:true,isMobile:true}),mobile=await setup(context);
  await checkHeroBeacon(mobile);
  await mobile.evaluate(()=>{window.__bannerlands.game.standardFor(0).hp=220;});await mobile.waitForTimeout(280);
  await mobile.locator('[data-drawer="orders"]').tap();
  for(const selector of ['#standardButton','#refitStandardButton']){
   await mobile.locator(selector).scrollIntoViewIfNeeded();
   const hit=await mobile.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:top===e||e.contains(top),height:r.height};});assert.ok(hit.visible&&hit.hit,selector+' reachable at '+JSON.stringify(size));assert.ok(hit.height>=(size.width>size.height?36:44));
  }
  await mobile.locator('#closeDrawer').tap();await mobile.locator('#mobileOptions').tap();
  const camera=await mobile.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y}));await mobile.locator('#mobileStandard').tap();assert.equal(await mobile.evaluate(()=>!!window.__bannerlands.ui.standardMode),true);
  const destination=await mobile.evaluate(()=>window.__point(30,30));await mobile.touchscreen.tap(destination.x,destination.y);assert.deepEqual(await mobile.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y})),camera);assert.equal(await mobile.evaluate(()=>window.__bannerlands.game.heroFor(0).standardAction.kind),'plant');
  await mobile.locator('[data-drawer="orders"]').tap();await mobile.waitForTimeout(260);await capture(mobile,'hero-controls-'+size.width+'x'+size.height);assert.equal(await mobile.locator('#heroPanel').isVisible(),true,JSON.stringify(await mobile.evaluate(()=>({selected:[...window.__bannerlands.ui.selected],clicks:window.__heroClicks,pane:document.getElementById('commandPanel').dataset.pane,hidden:document.getElementById('commandPanel').hidden,heroHidden:document.getElementById('heroPanel').hidden}))));assert.equal(await mobile.locator('#cancelStandardButton').isVisible(),true);await mobile.locator('#cancelStandardButton').tap();
  assert.equal(await mobile.evaluate(()=>window.__bannerlands.game.heroFor(0).standardAction),null);console.log('PASS Touch Standard/Refit reachability, no-pan placement and selected hero cancellation at '+size.width+'×'+size.height);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Hero control browser checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
