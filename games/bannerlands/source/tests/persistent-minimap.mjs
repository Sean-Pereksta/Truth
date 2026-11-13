import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Optional real-browser check for the persistent corner map and drawer layout.
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}
  catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const executablePath=process.env.BANNERLANDS_BROWSER||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];let checks=0;
const passed=name=>{checks++;console.log('PASS '+name);};
const shortcuts={build:'B',army:'U',orders:'O',map:'M',council:'C'};
const mapGeometry=async page=>page.evaluate(()=>{
  const element=document.getElementById('minimapDock'),canvas=document.getElementById('minimap');
  const r=element.getBoundingClientRect(),m=canvas.getBoundingClientRect(),hit=document.elementFromPoint(m.left+m.width/2,m.top+m.height/2);
  return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,mapWidth:m.width,mapHeight:m.height,viewportWidth:innerWidth,viewportHeight:innerHeight,hit:hit===canvas||canvas.contains(hit),outsidePanel:!document.getElementById('commandPanel').contains(element)};
});
try{
  for(const [width,height,touch]of [[320,740,true],[390,844,true],[844,390,true],[1536,688,true],[1440,900,false]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:60000});
    await page.evaluate(()=>{document.getElementById('scaleSelect').value='standard';document.getElementById('landscapeSelect').value='open';document.getElementById('enemySelect').value='1';window.__bannerlands.start();window.__bannerlands.game.paused=true;});
    await page.waitForFunction(()=>!!window.__bannerlands.renderer.minimapTransform,{timeout:10000});
    assert.equal(await page.locator('#commandPanel').isVisible(),false);
    assert.equal(await page.locator('#minimapDock').isVisible(),true,'The map must be visible without opening any drawer.');
    const initial=await mapGeometry(page);
    assert.equal(initial.outsidePanel,true,'The minimap must be independent of drawer visibility.');
    assert.ok(initial.left>=-1&&initial.right<=width+1&&initial.top>=-1&&initial.bottom<=height+1,`Map outside ${width}×${height}: ${JSON.stringify(initial)}`);
    assert.ok(initial.mapWidth>=100&&initial.mapHeight>=75,'The persistent map must remain readable.');assert.equal(initial.hit,true);
    for(const [pane,key]of Object.entries(shortcuts)){
      const button=page.locator(`[data-drawer="${pane}"]`),label=await button.innerText(),title=await button.getAttribute('title'),aria=await button.getAttribute('aria-keyshortcuts');
      assert.match(label,new RegExp(`(?:^|[\\s(\\[])${key}(?:$|[\\s)\\]])`,'i'),`${pane} must display its opening hotkey.`);
      assert.match(title||'',new RegExp(`\\b${key}\\b`,'i'),`${pane} tooltip must name its opening hotkey.`);
      assert.equal(aria?.toUpperCase(),key);
      await button.click();assert.equal(await page.locator('#commandPanel').getAttribute('data-pane'),pane);
      assert.equal(await page.locator('#minimapDock').isVisible(),true);
      const map=await mapGeometry(page),panel=await page.locator('#commandPanel').boundingBox();
      assert.ok(panel.y+panel.height<=map.top+1,`${pane} overlaps the map at ${width}×${height}.`);
      assert.ok(panel.y>=-1&&panel.x>=-1&&panel.x+panel.width<=width+1,`${pane} must stay inside the viewport.`);
      assert.equal(map.hit,true,`${pane} must not cover minimap navigation.`);
      await page.locator('#closeDrawer').click();assert.equal(await page.locator('#minimapDock').isVisible(),true);
    }
    passed(`Persistent map and all five labeled drawers fit ${width}×${height}${touch?' touch':''}.`);
    await page.locator('[data-drawer="army"]').click();
    const before=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
    const map=await page.locator('#minimap').boundingBox();await page.locator('#minimap').click({position:{x:map.width*.78,y:map.height*.36}});
    const after=await page.evaluate(()=>({x:window.__bannerlands.view.x,y:window.__bannerlands.view.y,orders:JSON.stringify(window.__bannerlands.game.units.map(u=>u.order))}));
    assert.ok(Math.abs(after.x-before.x)+Math.abs(after.y-before.y)>.01,'Clicking the persistent map must navigate.');
    assert.equal(after.orders,before.orders,'Map navigation cannot issue army orders.');
    assert.equal(await page.locator('#commandPanel').isVisible(),true);assert.equal(await page.locator('#commandPanel').getAttribute('data-pane'),'army');
    if(process.env.LANDS_RENDER_OUT&&(width===390||width===1440)){fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.LANDS_RENDER_OUT,`Persistent-minimap-${width}x${height}.png`)});}
    await page.locator('#closeDrawer').click();
    for(const [pane,key]of Object.entries(shortcuts)){await page.keyboard.press(key);assert.equal(await page.locator('#commandPanel').getAttribute('data-pane'),pane,`${key} must open ${pane}.`);assert.equal(await page.locator('#commandPanel').isVisible(),true);await page.keyboard.press('Escape');}
    passed(`Map navigation preserves Muster and B/U/O/M/C open their labeled panels at ${width}×${height}.`);
    await context.close();
  }
  assert.deepEqual(errors,[],'Browser runtime errors');console.log(`${checks} persistent minimap integration checks passed.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
