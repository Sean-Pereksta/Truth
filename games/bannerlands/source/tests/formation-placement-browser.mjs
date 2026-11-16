import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const focusedArt=process.env.BANNERLANDS_UI_ART_IDS?.split(',').filter(Boolean);
const server=http.createServer((request,response)=>{const pathname=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}if(focusedArt&&path.basename(file)==='app.js')data=Buffer.from(data.toString().replace('renderer.loadPaintedTroops(PAINTED_TROOP_SOURCES)','renderer.loadPaintedTroops(PAINTED_TROOP_SOURCES,'+JSON.stringify(focusedArt)+')'));response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER}),errors=[];
async function start(context){
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`,{timeout:90000});
 await page.waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:90000});
 await page.evaluate(()=>{
  document.getElementById('scaleSelect').value='standard';document.getElementById('landscapeSelect').value='open';document.getElementById('enemySelect').value='1';window.__bannerlands.start();
  const {game:g,ui,view}=window.__bannerlands;g.paused=true;g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.objectives=[];g.castles=[];g.time=100;
  for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;}g.navigation.invalidate();for(const s of g.teams){s.count=0;s.cap=1000;s.aiClock=1e9;s.alive=true;}
  ui.selected.clear();ui.selectedBuildings.clear();for(let i=0;i<24;i++){const u=g.addUnit(0,i<18?'winter_pikeman':'river_ranger',30-Math.floor(i/6)*.48,40+(i%6-2.5)*.48);u.facingX=1;u.facingY=0;ui.selected.add(u.id);}view.x=(30-40)*28;view.y=(30+40)*14;view.zoom=1;document.getElementById('battleCanvas').focus();
  window.__point=(x,y)=>{const v=window.__bannerlands.view,r=document.getElementById('battleCanvas').getBoundingClientRect();return {x:r.left+((x-y)*28-v.x)*v.zoom+v.w/2,y:r.top+((x+y)*14-v.y)*v.zoom+v.h/2};};
 });await page.waitForTimeout(260);return page;
}
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:900}}),page=await start(desktop);
 await page.keyboard.press('z');assert.equal(await page.locator('#formationSheet').isVisible(),true);
 await page.locator('#formPreset').selectOption('pike');await page.locator('#formRanks').selectOption('3');
 const point=await page.evaluate(()=>window.__point(34,40));await page.mouse.click(point.x,point.y);
 const before=await page.evaluate(()=>({...window.__bannerlands.ui.formPreview}));assert.equal(before.ranks,3);assert.equal(before.slots.length,24);
 const handle=await page.evaluate(()=>{const p=window.__bannerlands.ui.formPreview;return window.__point(p.x-p.faceY*p.width/2,p.y+p.faceX*p.width/2);});
 await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(handle.x+40,handle.y-20,{steps:4});await page.mouse.up();
 assert.notEqual(await page.evaluate(()=>window.__bannerlands.ui.formPreview.width),before.width,'Dragging a width handle changes the footprint.');
 await page.locator('#formLockFacing').check();await page.locator('#formTurnRight').click();await page.locator('#formRanks').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#formationSheet').isVisible(),false);assert.ok(await page.evaluate(()=>window.__bannerlands.game.units.every(u=>u.order.placementId&&u.order.lockFacing&&Number.isFinite(u.order.facingX))));
 console.log('PASS Real Z, ground placement, width handles, rank controls, rotation, facing lock and Enter commit a formation.');
 await page.locator('#battleCanvas').focus();await page.keyboard.press('Control+3');
 const settings=await page.evaluate(()=>({...window.__bannerlands.ui.formationOptions}));await page.keyboard.press('z');await page.locator('#formRanks').selectOption('1');await page.keyboard.press('Escape');await page.keyboard.press('3');
 assert.deepEqual(await page.evaluate(()=>({...window.__bannerlands.ui.formationOptions})),settings);
 await page.keyboard.press('Shift+d');assert.equal(await page.locator('#formationSheetTitle').textContent(),'Face in place');await page.keyboard.press('Escape');
 const destination=await page.evaluate(()=>window.__point(25,40));await page.mouse.click(destination.x,destination.y,{button:'right'});assert.equal(await page.evaluate(()=>window.__bannerlands.game.units.every(u=>u.order.mode==='move'&&!u.order.placementId)),true);
 console.log('PASS Command groups restore formation dimensions and lock; Shift+D and Escape preserve orders; right-click immediately moves.');
 await desktop.close();
 for(const size of [{width:320,height:740},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport:size,hasTouch:true,isMobile:true}),mobile=await start(context);
  for(const selector of ['#quickFormButton','#quickHoldButton','#quickAdvanceButton','#quickRetreatButton']){
   const hit=await mobile.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:top===e||e.contains(top),height:r.height};});assert.ok(hit.visible&&hit.hit,selector+' is reachable at '+JSON.stringify(size));
  }
  const view=await mobile.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y}));await mobile.locator('#quickFormButton').tap();assert.equal(await mobile.locator('#formationSheet').isVisible(),true);
  const tap={x:Math.round(size.width*.7),y:Math.round(size.height*.34)};await mobile.touchscreen.tap(tap.x,tap.y);
  assert.deepEqual(await mobile.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y})),view,'Touch placement does not pan the camera.');
  await mobile.locator('#formConfirmButton').tap();assert.equal(await mobile.locator('#formationSheet').isVisible(),false);
  assert.equal(await mobile.evaluate(()=>window.__bannerlands.game.units.every(u=>u.order.placementId)),true);
  console.log('PASS Touch Form/Hold/Advance/Retreat and compact placement sheet at '+size.width+'×'+size.height);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Formation placement browser checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
