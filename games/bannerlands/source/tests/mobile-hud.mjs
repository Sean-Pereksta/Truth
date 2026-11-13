import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Optional integration check: install Playwright, then npm run test:mobile.
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch(error){
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;
  ({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));
}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}
  catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const executablePath=process.env.BANNERLANDS_BROWSER||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
let cases=0;
const passed=name=>{cases++;console.log('PASS '+name);};
const visible=async(page,selector)=>page.locator(selector).isVisible();
const hidden=async(page,selector)=>assert.equal(await visible(page,selector),false,selector+' must be hidden');
const start=async page=>{
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'load'});
  await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:60000});
  await page.evaluate(()=>{
    document.getElementById('scaleSelect').value='standard';
    document.getElementById('landscapeSelect').value='open';
    document.getElementById('enemySelect').value='1';
    window.__bannerlands.start();window.__bannerlands.game.paused=true;
  });
  await hidden(page,'#menuOverlay');
  await page.waitForTimeout(300);
};
const assertOnscreen=async(page,selector,minHeight=44)=>{
  const result=await page.locator(selector).evaluate(element=>{
    const r=element.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,vw:innerWidth,vh:innerHeight,hit:hit===element||element.contains(hit)};
  });
  assert.ok(result.left>=-1&&result.top>=-1&&result.right<=result.vw+1&&result.bottom<=result.vh+1,`${selector} outside viewport: ${JSON.stringify(result)}`);
  assert.ok(result.height>=minHeight,`${selector} touch target too short: ${result.height}`);
  assert.ok(result.hit,`${selector} is covered by another control`);
};
const open=async(page,pane)=>{
  await page.locator(`[data-drawer="${pane}"]`).click();
  assert.equal(await page.locator('#commandPanel').getAttribute('data-pane'),pane);
  assert.equal(await visible(page,'#commandPanel'),true);
};
const touch=async(session,type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({x:p.x,y:p.y,id:i+1,radiusX:2,radiusY:2,force:1}))});
const touchDrag=async(session,from,to,{cancel=false}={})=>{
  await touch(session,'touchStart',[from]);
  await touch(session,'touchMove',[to]);
  await touch(session,cancel?'touchCancel':'touchEnd',[]);
};

try{
  for(const [width,height,touchScreen]of [[320,740,true],[390,844,true],[844,390,true],[1536,688,true],[1440,900,false]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touchScreen,isMobile:touchScreen,deviceScaleFactor:1});
    const page=await context.newPage();await start(page);
    await hidden(page,'#commandPanel');
    await hidden(page,'#selectionDock');
    const geometry=await page.evaluate(()=>{
      const r=document.getElementById('battleCanvas').getBoundingClientRect();
      const selectors=['#topbar','#gameplayDock','#touchControls'];
      let covered=0;for(const selector of selectors){const e=document.querySelector(selector);if(!e||!e.getClientRects().length)continue;const b=e.getBoundingClientRect();covered+=b.width*b.height;}
      return {width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,covered:covered/(innerWidth*innerHeight),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(geometry.width>=width-1&&geometry.height>=height-1,`Canvas should fill viewport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.covered<=.23,`Idle HUD covers too much of ${width}×${height}: ${geometry.covered}`);
    assert.equal(geometry.overflow,false);
    for(const pane of ['build','army','orders','map','council']){
      await assertOnscreen(page,`[data-drawer="${pane}"]`);
      await open(page,pane);
      await assertOnscreen(page,'#closeDrawer');
      if(pane==='build'){
        await assertOnscreen(page,'[data-build="barracks"]');
        const scrollable=await page.locator('#commandScroll').evaluate(e=>e.scrollHeight>=e.clientHeight&&getComputedStyle(e).overflowY!=='hidden');
        assert.equal(scrollable,true,'Drawer content must remain scrollable');
      }
      await page.locator('#closeDrawer').click();await hidden(page,'#commandPanel');
    }
    passed(`Full battlefield and reachable compact drawers at ${width}×${height}${touchScreen?' touch':''}`);
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();await start(page);
  const session=await context.newCDPSession(page);
  await page.evaluate(()=>window.__bannerlands.selectArmy());
  await page.waitForTimeout(250);
  const before=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,selected:[...window.__bannerlands.ui.selected],orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
  await touchDrag(session,{x:330,y:180},{x:400,y:200});
  const after=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,selected:[...window.__bannerlands.ui.selected],orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
  assert.ok(before.x!==after.x||before.y!==after.y,'One-finger drag must pan by default');
  assert.deepEqual(after.selected,before.selected,'Panning must keep the selection');
  assert.equal(after.orders,before.orders,'Panning must not issue army orders');
  passed('Touch pan preserves selection and army orders');

  await open(page,'build');
  await page.locator('[data-build="barracks"]').click();
  await hidden(page,'#commandPanel');assert.equal(await visible(page,'#buildBanner'),true);
  await touchDrag(session,{x:320,y:180},{x:365,y:195},{cancel:true});
  assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'barracks');
  const zoom=await page.evaluate(()=>window.__bannerlands.view.zoom);
  await touch(session,'touchStart',[{x:300,y:170},{x:440,y:170}]);
  await touch(session,'touchMove',[{x:280,y:170},{x:460,y:170}]);
  await touch(session,'touchEnd',[]);
  assert.ok(await page.evaluate(z=>window.__bannerlands.view.zoom>z,zoom),'Pinch must zoom');
  assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'barracks');
  passed('Canceled drags and pinch navigation preserve construction targeting');
  await page.locator('#cancelBuild').click();assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),null);
  await hidden(page,'#buildBanner');
  await open(page,'map');await page.locator('#minimap').click({position:{x:100,y:60}});assert.equal(await visible(page,'#commandPanel'),true);await page.locator('#closeDrawer').click();await hidden(page,'#commandPanel');
  await open(page,'orders');await page.keyboard.press('Escape');await hidden(page,'#commandPanel');
  await page.setViewportSize({width:390,height:844});
  for(const pane of ['build','army','orders','map','council'])await assertOnscreen(page,`[data-drawer="${pane}"]`);
  passed('Cancel, minimap navigation, Escape and rotation leave a usable battlefield');
  await context.close();
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log(`${cases} mobile HUD integration checks passed.`);
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
