import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const file=process.env.BANNERLANDS_STANDALONE||process.argv[2];
assert.ok(file,'Provide BANNERLANDS_STANDALONE or a path argument to the built Bannerlands.html.');
assert.ok(fs.existsSync(file),'Standalone file exists');
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
try{
  await page.goto(pathToFileURL(path.resolve(file)).href,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>document.getElementById('startButton')?.disabled===false,null,{timeout:120000});
  const loaded=await page.evaluate(()=>{
    const {renderer}=window.__bannerlands;
    return {painted:renderer.paintedRows?.size,ready:renderer.paintedArtReady,pikeBuildings:Object.keys(renderer.pikeBuildingFrames||{}),moduleScript:document.querySelector('script[type="module"]').hasAttribute('src')};
  });
  assert.equal(loaded.ready,true);assert.equal(loaded.painted,23);
  assert.deepEqual(loaded.pikeBuildings.sort(),['thornwall_pavilion','winter_pike_hall']);assert.equal(loaded.moduleScript,false);
  await page.evaluate(()=>{
    document.getElementById('scaleSelect').value='standard';document.getElementById('enemySelect').value='1';document.getElementById('fogSelect').value='off';window.__bannerlands.start();window.__bannerlands.game.paused=true;
  });
  assert.equal(await page.locator('#menuOverlay').isVisible(),false);
  await page.keyboard.press('z');await page.keyboard.press('Escape');
  assert.deepEqual(errors,[],'Standalone runtime and artwork loaders have no errors');assert.deepEqual(external,[],'All game dependencies load offline');
  if(process.env.LANDS_RENDER_OUT){fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.LANDS_RENDER_OUT,'standalone-battlefield.png')});}
  console.log('PASS Standalone file loads 23 painted troops and both pike buildings offline, starts a battle, and handles placement cancellation.');
}finally{await browser.close();}
