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
await page.context().setOffline(true);
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
try{
  await page.goto(pathToFileURL(path.resolve(file)).href,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>document.getElementById('startButton')?.disabled===false,null,{timeout:120000});
  assert.equal(await page.locator('.online-download').isVisible(),false,'Downloaded offline game does not ask to download again');
  assert.equal(await page.locator('#browseLobbiesButton').isVisible(),false,'The offline campaign does not browse the lobby directory');
  await page.locator('#hostLobbyButton').click();
  assert.match(await page.locator('#offlineHostError').innerText(),/download and launch Bannerlands for Windows/i);
  const painting=await page.locator('#menuOverlay .campaign-painting').evaluate(async img=>{
    await img.decode();return [img.naturalWidth,img.naturalHeight,img.currentSrc.startsWith('data:image/webp;')];
  });
  assert.deepEqual(painting,[1600,900,true],'The offline campaign menu shows its original painted panorama');
  const loaded=await page.evaluate(()=>{
    const {renderer}=window.__bannerlands;
    return {painted:renderer.paintedRows?.size,ready:renderer.paintedArtReady,heroes:renderer.heroRows?.size,heroReady:renderer.heroArtReady,pikeBuildings:Object.keys(renderer.pikeBuildingFrames||{}),moduleScript:document.querySelector('script[type="module"]').hasAttribute('src')};
  });
  assert.equal(loaded.ready,true);assert.equal(loaded.painted,23);
  assert.equal(loaded.heroReady,true);assert.equal(loaded.heroes,16);
  assert.deepEqual(loaded.pikeBuildings.sort(),['thornwall_pavilion','winter_pike_hall']);assert.equal(loaded.moduleScript,false);
  await page.waitForFunction(()=>performance.getEntriesByName('bannerlands-detail-art-finished').length>0,null,{timeout:120000});
  const landscapeArt=await page.evaluate(()=>{
    const r=window.__bannerlands.renderer;
    return {bridge:r.bridgeArtwork?.spanReady,gallop:r.cavalryChargeFrames?.length,crags:r.highlandCrags?.length,
      cartway:!!r.cartway,river:Object.keys(r.riverMaterials||{}).sort()};
  });
  assert.deepEqual(landscapeArt,{bridge:true,gallop:24,crags:6,cartway:true,river:['bank','channel','shoal']});
  await page.evaluate(()=>{
    document.getElementById('scaleSelect').value='standard';document.getElementById('enemySelect').value='1';document.getElementById('fogSelect').value='off';window.__bannerlands.start();window.__bannerlands.game.paused=true;
  });
  assert.equal(await page.locator('#menuOverlay').isVisible(),false);
  const iconSize=await page.locator('[data-drawer="build"] .command-art').first().evaluate(async element=>{
    const image=new Image(),url=getComputedStyle(element).backgroundImage.match(/^url\(["']?(data:image\/png;[^"')]+)["']?\)$/);
    if(!url)return null;
    image.src=url[1];await image.decode();return [image.naturalWidth,image.naturalHeight];
  });
  assert.deepEqual(iconSize,[576,384],'The painted command icons are visible from the offline archive');
  await page.locator('#heroHudButton').click();
  assert.equal(await page.evaluate(()=>window.__bannerlands.ui.selected.has(window.__bannerlands.game.heroFor(0).id)),true);
  assert.equal(await page.locator('#quickStandardOrders').isVisible(),true);
  await page.keyboard.press('z');await page.keyboard.press('Escape');
  // Stage a short skirmish on legal ground in the campaign that just opened.
  // Movement, target acquisition, projectiles and damage use the real game.
  const combat=await page.evaluate(()=>{
    const {game:g}=window.__bannerlands;
    let center;
    for(let y=8;!center&&y<g.H-8;y++)for(let x=8;x<g.W-8;x++){
      if([-3,-2,-1,0,1,2,3].every(dx=>[-1,0,1].every(dy=>g.navigation.isClearPoint(x+dx,y+dy,.3)))&&g.buildings.every(b=>Math.hypot(x-b.x,y-b.y)>6)){center={x,y};break;}
    }
    if(!center)throw new Error('No passable skirmish ground.');
    const soldiers=[];
    for(const team of [0,1]){
      const side=team?1:-1,ids=[];
      for(const [i,type] of ['infantry','archer','cavalry'].entries()){
        const u=g.addUnit(team,type,center.x+side*2,center.y+i-1);
        soldiers.push(u);ids.push(u.id);
      }
      g.command(ids,center.x-side*2,center.y,'attack','line');
    }
    g.hash.rebuild(g.units);g.paused=false;
    for(let tick=0;tick<360&&soldiers.every(u=>u.hp===u.maxHp);tick++)g.update(1/30);
    return {wounded:soldiers.filter(u=>u.hp<u.maxHp).length,time:g.time};
  });
  assert.ok(combat.wounded>0&&combat.time>0,'Standalone combat deals damage offline');
  assert.deepEqual(errors,[],'Standalone runtime and artwork loaders have no errors');assert.deepEqual(external,[],'All game dependencies load offline');
  if(process.env.LANDS_RENDER_OUT){fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});await page.screenshot({path:path.join(process.env.LANDS_RENDER_OUT,'standalone-battlefield.png')});}
  console.log('PASS Offline battle uses embedded painted troops, heroes, cavalry and Riverlands scenery, selects the hero and deals combat damage with zero external requests.');
}finally{await browser.close();}
