import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Run with Playwright and Chromium; BANNERLANDS_BROWSER selects the browser.
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let file;
 try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const executablePath=process.env.BANNERLANDS_BROWSER||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];let cases=0;
const passed=name=>{cases++;console.log('PASS '+name);};
const visible=(page,selector)=>page.locator(selector).isVisible();
const hidden=async(page,selector)=>assert.equal(await visible(page,selector),false,selector+' must be hidden');
const start=async page=>{
 page.on('pageerror',error=>errors.push(error.message));await page.goto(origin,{waitUntil:'load'});
 await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:60000});
 await page.evaluate(()=>{document.getElementById('scaleSelect').value='standard';document.getElementById('landscapeSelect').value='open';document.getElementById('enemySelect').value='1';window.__bannerlands.start();window.__bannerlands.game.paused=true;});
 await hidden(page,'#menuOverlay');await page.waitForTimeout(300);
};
const assertOnscreen=async(page,selector,minHeight=44)=>{
 const r=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,height:r.height,vw:innerWidth,vh:innerHeight,hit:hit===e||e.contains(hit)};});
 assert.ok(r.left>=-1&&r.top>=-1&&r.right<=r.vw+1&&r.bottom<=r.vh+1,`${selector} outside viewport: ${JSON.stringify(r)}`);
 assert.ok(r.right-r.left>=44,`${selector} touch target too narrow: ${r.right-r.left}`);assert.ok(r.height>=minHeight,`${selector} touch target too short: ${r.height}`);assert.ok(r.hit,`${selector} is covered`);
};
const open=async(page,pane)=>{await page.locator(`[data-drawer="${pane}"]`).click();assert.equal(await page.locator('#commandPanel').getAttribute('data-pane'),pane);assert.equal(await visible(page,'#commandPanel'),true);};
const touch=async(session,type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({x:p.x,y:p.y,id:i+1,radiusX:2,radiusY:2,force:1}))});
const tap=async(session,p)=>{await touch(session,'touchStart',[p]);await touch(session,'touchEnd',[]);};
const drag=async(session,from,to,{hold=0,cancel=false}={})=>{await touch(session,'touchStart',[from]);if(hold)await new Promise(r=>setTimeout(r,hold));await touch(session,'touchMove',[to]);await touch(session,cancel?'touchCancel':'touchEnd',[]);};

try{
 for(const [width,height] of [[320,740],[390,844],[844,390],[1536,688]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();await start(page);
  for(const selector of ['#commandPanel','#selectionDock','#touchControls','#minimapDock','#quickFormationOrders','#mobileTroopControls','[data-drawer="map"]'])await hidden(page,selector);
  for(const selector of ['[data-drawer="build"]','[data-drawer="army"]','[data-drawer="orders"]','[data-drawer="council"]','#mobileMapToggle','#heroHudButton','#fieldObjective'])await assertOnscreen(page,selector);
  const geometry=await page.evaluate(()=>{const r=document.querySelector('#battleCanvas').getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth,topbar:document.querySelector('#topbar').getBoundingClientRect().height};});
  assert.ok(geometry.width>=width-1&&geometry.height>=height-1,`Canvas should fill viewport: ${JSON.stringify(geometry)}`);assert.equal(geometry.overflow,false);assert.ok(geometry.topbar<=54,`Resource strip height: ${geometry.topbar}px`);
  for(const pane of ['build','army','orders','council']){await open(page,pane);await assertOnscreen(page,'#closeDrawer');await page.locator('#closeDrawer').click();await hidden(page,'#commandPanel');}
  await page.locator('#mobileMapToggle').click();assert.equal(await visible(page,'#minimapDock'),true);await page.locator('#mobileMapToggle').click();await hidden(page,'#minimapDock');
  await page.evaluate(()=>window.__bannerlands.selectArmy());await assertOnscreen(page,'#quickAdvanceButton');await assertOnscreen(page,'#quickHoldButton');await assertOnscreen(page,'#mobileAttack');await assertOnscreen(page,'#mobileOptions');await hidden(page,'#selectionDock');
  await page.locator('#mobileOptions').click();for(const selector of ['#mobileExpand','#mobilePatrol','#mobileStandard','#mobileMoreOrders','#mobileClear'])assert.equal(await visible(page,selector),true,selector);
  await page.locator('#mobileOptions').click();await hidden(page,'#mobileOptionsMenu');
  if(process.env.BANNERLANDS_QA_OUT){await fs.promises.mkdir(process.env.BANNERLANDS_QA_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.BANNERLANDS_QA_OUT,'hud-touch-'+width+'x'+height+'.png')});}
  passed(`Compact layout, map and selected controls at ${width}×${height}`);await context.close();
 }
 for(const [width,height] of [[1366,768],[1920,1080]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();await start(page);
  assert.equal(await page.locator('#gameplayDock button:visible').count(),5);
  await page.evaluate(()=>window.__bannerlands.selectArmy());await page.locator('#quickAdvanceButton').click();
  assert.equal(await page.locator('#commandPanel').isVisible(),false);
  assert.ok(await page.evaluate(()=>[...window.__bannerlands.ui.selected].some(id=>window.__bannerlands.game.byId.get(id)?.order?.mode==='advance')));
  await page.locator('#quickHoldButton').click();assert.ok(await page.evaluate(()=>[...window.__bannerlands.ui.selected].every(id=>window.__bannerlands.game.byId.get(id)?.order?.mode==='hold')));
  await page.locator('#locateSelection').click();assert.ok(await page.locator('#fieldTypes').textContent());
  const footprint=await page.evaluate(()=>{
   const visible=['#topbar','#fieldArmyControls','#gameplayDock','#minimapDock','#quickStandardOrders','#toast.visible','#battleAlert:not([hidden])','#connectionStatus:not([hidden])','#orderReceipt:not([hidden])'];
   // Sum the distinct occupied controls, conservatively counting any overlap twice.
   return visible.reduce((area,selector)=>{const r=document.querySelector(selector)?.getBoundingClientRect();return area+(r?r.width*r.height:0);},0)/(innerWidth*innerHeight);
  });
  if(process.env.BANNERLANDS_QA_OUT){await fs.promises.mkdir(process.env.BANNERLANDS_QA_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.BANNERLANDS_QA_OUT,'hud-desktop-'+width+'x'+height+'.png')});}
  assert.ok(footprint<=.15,`HUD occupies ${footprint*100}%`);
  await page.evaluate(()=>window.__bannerlands.game.event('Your tower was lost.',window.__bannerlands.game.playerTeam??0,{x:12,y:17}));
  await page.locator('#battleAlert').click();assert.equal(await page.locator('#battleAlert').isVisible(),false);
  passed(`Closed HUD with selection covers ${(footprint*100).toFixed(2)}% at ${width}×${height}; Advance, Hold, find formation and locate alert`);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();await start(page);const session=await context.newCDPSession(page);
 await page.evaluate(()=>window.__bannerlands.selectArmy());
 const before=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,selected:[...window.__bannerlands.ui.selected],orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
 await drag(session,{x:330,y:180},{x:400,y:200});
 const after=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,selected:[...window.__bannerlands.ui.selected],orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
 assert.ok(before.x!==after.x||before.y!==after.y,'Quick drag must pan');assert.deepEqual(after.selected,before.selected);assert.equal(after.orders,before.orders);passed('Quick touch drag pans without changing orders');
 await open(page,'build');await page.locator('[data-build="barracks"]').click();await hidden(page,'#commandPanel');assert.equal(await visible(page,'#buildBanner'),true);
 await drag(session,{x:320,y:180},{x:365,y:195},{cancel:true});assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'barracks');
 const zoom=await page.evaluate(()=>window.__bannerlands.view.zoom);await touch(session,'touchStart',[{x:300,y:170},{x:440,y:170}]);await touch(session,'touchMove',[{x:280,y:170},{x:460,y:170}]);await touch(session,'touchEnd',[]);
 assert.ok(await page.evaluate(z=>window.__bannerlands.view.zoom>z,zoom),'Pinch must zoom');assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'barracks');await page.locator('#cancelBuild').click();passed('Pinch and canceled drags preserve construction targeting');
 // Put a few existing units in known screen positions and freeze the game so
 // actual touch events can be checked without depending on random start layouts.
 const units=await page.evaluate(async()=>{
  const {screenToWorld}=await import('./render.js');const {game,view,ui}=window.__bannerlands;
  const friend=game.units.find(u=>u.team===0&&u.type==='infantry'),enemy=game.units.find(u=>u.team!==0);
  if(!friend||!enemy)throw new Error('Missing test troops');
  for(const u of game.units){u.x=-1000;u.y=-1000;}for(const b of game.buildings){b.x=-1000;b.y=-1000;}
  const place=(u,x,y)=>Object.assign(u,screenToWorld(x,y+9*view.zoom,view));place(friend,300,150);place(enemy,500,150);ui.selected.clear();
  return {friend:friend.id,enemy:enemy.id,type:friend.type,count:game.units.filter(u=>u.team===0&&u.hp>0&&u.type===friend.type).length};
 });
 await tap(session,{x:300,y:150});assert.deepEqual(await page.evaluate(()=>[...window.__bannerlands.ui.selected]),[units.friend]);
 await tap(session,{x:300,y:150});assert.equal(await page.evaluate(()=>window.__bannerlands.ui.selected.size),units.count,'Double tap must select all of this type');
 await tap(session,{x:500,y:150});assert.equal(await page.evaluate(id=>window.__bannerlands.game.byId.get(id).order.targetId,units.friend),units.enemy,'Tapping an enemy must focus attack');
 await drag(session,{x:280,y:130},{x:325,y:180},{hold:420});assert.deepEqual(await page.evaluate(()=>[...window.__bannerlands.ui.selected]),[units.friend],'Hold and drag must select the enclosed troop');
 passed('Tap, double tap, enemy targeting and hold-drag selection');
 assert.deepEqual(errors,[],'Browser runtime errors');console.log(`${cases} mobile HUD integration checks passed.`);await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
