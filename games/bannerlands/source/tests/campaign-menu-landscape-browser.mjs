import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createMatchServer} from '../multiplayer-server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const server=await createMatchServer({simulation:false,lobby:{public:false},config:{enemies:1,scale:'standard',seed:417}});
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const output=process.env.LANDS_RENDER_OUT;
if(output)await fs.mkdir(output,{recursive:true});

async function swipe(session,from,to){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  for(let step=1;step<=5;step++){
    const point={x:from.x+(to.x-from.x)*step/5,y:from.y+(to.y-from.y)*step/5};
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}

async function assertTapTarget(page,selector,safe){
  const rect=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,uncovered:el.contains(hit)};
  });
  assert.ok(rect.left>=safe.left&&rect.right<=safe.right&&rect.top>=0&&rect.bottom<=safe.bottom,`${selector} outside the usable screen: ${JSON.stringify(rect)}`);
  assert.ok(rect.height>=44&&rect.uncovered,selector+' must accept a touch');
}

try{
  for(const [width,height,left,right,bottom] of [[667,375,20,20,0],[844,390,44,44,14]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
    try{
      // Keep the match and invite form local. Directory discovery is not part of this flow.
      await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(server.url).origin?route.continue():route.abort());
      const page=await context.newPage(),session=await context.newCDPSession(page),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await session.send('Emulation.setSafeAreaInsetsOverride',{insets:{left,right,bottom}});
      await page.goto(server.url);
      await page.waitForFunction(()=>window.__bannerlands&&document.querySelector('.campaign-painting').naturalWidth&&!document.querySelector('#startButton').disabled,null,{timeout:120000});
      const safe={left,right:width-right,bottom:height-bottom};
      assert.ok(await page.evaluate(()=>matchMedia('(pointer:coarse) and (orientation:landscape)').matches));
      assert.equal(await page.locator('#menuOverlay').evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft)),left);
      for(const selector of ['#startButton','#browseLobbiesButton','#joinInviteButton','#menuHouseTab','#menuCampaignTab','[data-house="0"]','[data-house="15"]','#compareHousesButton'])await assertTapTarget(page,selector,safe);
      if(output)await page.screenshot({path:path.join(output,`phone-menu-${width}.png`)});
      await page.locator('[data-house="15"]').tap();
      assert.equal(await page.locator('[data-house="15"]').getAttribute('aria-pressed'),'true');
      const panel=await page.locator('#menuSetupContent').boundingBox();
      await swipe(session,{x:panel.x+panel.width*.6,y:panel.y+panel.height*.8},{x:panel.x+panel.width*.6,y:panel.y+panel.height*.2});
      await page.waitForFunction(()=>document.querySelector('#menuSetupContent').scrollTop>40);
      await assertTapTarget(page,'#startButton',safe);
      await page.locator('#menuCampaignTab').tap();
      assert.equal(await page.locator('#menuSetupContent').evaluate(el=>el.scrollTop),0);
      await page.locator('#modeSelect').selectOption('bannerfall');
      await page.locator('#scaleSelect').selectOption('standard');
      await page.locator('#enemySelect').selectOption('1');
      if(output)await page.screenshot({path:path.join(output,`phone-settings-${width}.png`)});
      await swipe(session,{x:panel.x+panel.width*.8,y:panel.y+panel.height*.83},{x:panel.x+panel.width*.8,y:panel.y+panel.height*.18});
      await page.waitForFunction(()=>document.querySelector('#menuSetupContent').scrollTop>40);
      await page.locator('#fogSelect').selectOption('on');
      await page.locator('#landscapeSelect').selectOption('riverlands');
      await page.locator('#joinInviteButton').tap();
      await page.locator('[data-action="close"]').tap();
      assert.equal(await page.locator('.multiplayer-panel').isVisible(),false);
      await page.locator('#menuHouseTab').tap();
      assert.equal(await page.locator('[data-house="15"]').getAttribute('aria-pressed'),'true');
      await page.locator('#startButton').tap();
      await page.waitForFunction(()=>document.querySelector('#menuOverlay').hidden);
      assert.deepEqual(await page.evaluate(()=>[window.__bannerlands.game.config.house,window.__bannerlands.game.mode.id,window.__bannerlands.game.config.fogOfWar]),[15,'bannerfall',true]);
      await page.locator('[data-drawer="council"]').tap();
      await page.locator('[data-drawer-section="settings"]').tap();
      await page.locator('#settingsMenuButton').tap();
      await assertTapTarget(page,'#resumeButton',safe);
      await page.locator('#resumeButton').tap();
      await page.waitForFunction(()=>document.querySelector('#menuOverlay').hidden);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}×${height} landscape touch, ${left}/${right}/${bottom}px safe insets, full roster, settings scroll, invite, launch and resume`);
    }finally{await context.close();}
  }
}finally{await browser.close();await server.close();}
