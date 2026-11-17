import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createMatchServer} from '../multiplayer-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
let publishFails=true,ownedStops=0;
const desktop={secret:'website-test-private-capability-12345',status:()=>({stage:'idle'}),async stop(instance){ownedStops++;await instance.setReachable(false);}};
const publisher={async publish(){if(publishFails)throw new Error('Simulated directory outage');},async heartbeat(){if(publishFails)throw new Error('Simulated directory outage');},async remove(){}};
const website=await createMatchServer({simulation:false,desktop,publisher,lobby:{public:true,maxHumans:2},config:{enemies:3,scale:'standard'}});
const first=await createMatchServer({simulation:false,lobby:{public:true,maxHumans:2},config:{enemies:3,scale:'standard'}});
const second=await createMatchServer({simulation:false,lobby:{public:true,maxHumans:2},config:{enemies:1,scale:'standard'}});
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER}),context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[],artOrigins=new Set(),checks=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('.png'))artOrigins.add(new URL(request.url()).origin);});
const post=async(server,route,body)=>{const response=await fetch(server.url+route,{method:'POST',headers:{Authorization:'Bearer '+server.hostToken,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.ok,true,await response.clone().text());return response.json();};
const waitReady=()=>page.waitForFunction(()=>window.__bannerlands?.online&&!document.getElementById('startButton').disabled,{timeout:120000});
const joinThroughWebsite=async origin=>{
  await page.evaluate(()=>window.__bannerlands.online.ui.show('invite'));
  await page.locator('[name="guestName"]').fill('Website guest');await page.locator('[name="inviteUrl"]').fill(origin+'/#join=1');await page.locator('[data-pane="invite"] button[type="submit"]').click();
  await page.waitForFunction(origin=>window.__bannerlands.online.client?.origin===origin&&window.__bannerlands.online.client?.session,origin);
};
try{
  await page.goto(website.url);await waitReady();
  await page.evaluate(()=>window.__bannerlands.online.ui.show('host'));assert.ok(await page.locator('[data-pane="host"] button[type="submit"]').isDisabled());assert.ok(await page.locator('[data-pane="host"] [data-download]').isVisible());assert.equal(await page.evaluate(()=>!!window.bannerlandsHost),false);checks.push('website visitors are offered the host download and cannot start native hosting');
  const preflight=await fetch(first.url+'/api/state',{method:'OPTIONS',headers:{Origin:website.url,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,if-none-match'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);assert.match(preflight.headers.get('access-control-allow-headers'),/If-None-Match/);checks.push('CORS preflight permits authenticated game requests and update baselines');
  await joinThroughWebsite(first.url);assert.equal(new URL(page.url()).origin,website.url);assert.equal(await page.evaluate(()=>sessionStorage.getItem('bannerlands.active-host')),first.url);const token=await page.evaluate(()=>window.__bannerlands.online.client.session.token);assert.equal(first.getLobby().players.length,2);checks.push('joining a remote host keeps the website page and artwork origin');
  await page.reload();await waitReady();await page.waitForFunction(origin=>window.__bannerlands.online.client?.origin===origin&&window.__bannerlands.online.client?.session,first.url);assert.equal(await page.evaluate(()=>window.__bannerlands.online.client.session.token),token);assert.equal(first.getLobby().players.length,2);checks.push('website reload restores the same remote host session without another seat');
  await joinThroughWebsite(second.url);assert.equal(first.getLobby().players.length,1);assert.equal(second.getLobby().players.length,2);assert.equal(new URL(page.url()).origin,website.url);checks.push('switching remote lobbies leaves the prior waiting session');
  const revision=second.getLobby().revision;await post(second,'/api/ready',{ready:true,assetsReady:true,revision});await page.evaluate(revision=>window.__bannerlands.online.client.ready(true,revision,true),revision);await post(second,'/api/start',{revision});
  const response=await fetch(second.url+'/api/state?initial=1',{headers:{Authorization:'Bearer '+second.hostToken}}),hostState=await response.json();await post(second,'/api/synchronized',{matchId:hostState.lobby.matchId,sequence:hostState.snapshot.sequence});
  await page.waitForFunction(()=>window.__bannerlands.game.remote&&window.__bannerlands.game.playerTeam===1);assert.deepEqual([...artOrigins],[website.url]);checks.push('the full remote battle hydrates and renders using only website-origin artwork');
  // Hold the HTTP reply so immediate acknowledgement feedback is observable even on loopback.
  let release;
  const replyGate=new Promise(resolve=>{release=resolve;});
  await page.route(second.url+'/api/command',async route=>{await replyGate;await route.continue();});
  await page.evaluate(()=>window.__bannerlands.selectArmy());await page.locator('#quickHoldButton').click();
  assert.match(await page.locator('#orderReceipt').textContent(),/pending/i);release();
  await page.waitForFunction(()=>document.getElementById('orderReceipt').textContent.includes('confirmed'));
  await page.evaluate(()=>{const game=window.__bannerlands.game;game.hold([game.units.find(u=>u.team!==game.playerTeam).id]);});
  await page.waitForFunction(()=>document.getElementById('orderReceipt').textContent.includes('rejected'));
  await page.route(second.url+'/api/state**',route=>route.abort());
  await page.waitForSelector('#connectionStatus:visible');assert.match(await page.locator('#connectionStatus').textContent(),/Reconnecting/);
  await page.unroute(second.url+'/api/state**');await page.waitForSelector('#connectionStatus',{state:'hidden'});
  checks.push('pending, confirmed and rejected orders; persistent connection status while reconnecting');
  await post(second,'/api/end',{});await page.waitForFunction(()=>!window.__bannerlands.game.remote&&['waiting','full'].includes(window.__bannerlands.online.client.lobby?.status));assert.match(await page.locator('.multiplayer-status').textContent(),/host ended the match/i);await page.evaluate(()=>window.__bannerlands.online.leave());assert.equal(second.getLobby().players.length,1);checks.push('ending and leaving a remote match returns the website to its own menu');
  await page.evaluate(()=>sessionStorage.setItem('bannerlands.active-host','http://192.168.1.1:1234'));await page.reload();await waitReady();assert.equal(await page.evaluate(()=>window.__bannerlands.online.client.origin),website.url);assert.equal(await page.evaluate(()=>sessionStorage.getItem('bannerlands.active-host')),null);checks.push('an unsafe stored remote address is discarded before restoration');
  await website.setPublicAddress('https://website-directory-check.trycloudflare.com');await page.evaluate(token=>window.__bannerlands.online.client.join({hostToken:token}),website.hostToken);await page.waitForFunction(()=>document.querySelector('.multiplayer-status').textContent.includes('guest invitation'));await page.waitForTimeout(350);assert.ok((await page.locator('.multiplayer-status').getAttribute('class')).includes('error'));checks.push('managed directory failure stays visible with a guest-invitation fallback');
  publishFails=false;await website.setPublicAddress('https://website-directory-check.trycloudflare.com');await page.waitForFunction(()=>!window.__bannerlands.online.client.lobby.directoryError&&!document.querySelector('.multiplayer-status').classList.contains('error'));checks.push('directory recovery clears the failure message after a metadata update');
  await page.evaluate(secret=>{window.__ownedStopRequests=0;window.bannerlandsHost={stop:async()=>{window.__ownedStopRequests++;const response=await fetch('/api/desktop/stop',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('Could not stop the owned host.');}};},desktop.secret);
  await joinThroughWebsite(first.url);assert.ok(ownedStops>=1);assert.equal(await page.evaluate(()=>window.__ownedStopRequests),1);assert.equal(website.getLobby().public,false);assert.equal(website.getLobby().players.length,1);assert.equal((await fetch(website.url)).status,200);checks.push('switching away from an owned host stops its connection and keeps the website service usable');
  await page.evaluate(()=>window.__bannerlands.online.leave());
  const direct=await context.newPage();direct.on('pageerror',error=>errors.push(error.message));await direct.goto(first.url+'/#join=1');await direct.waitForFunction(()=>window.__bannerlands?.online?.client?.session,{timeout:120000});assert.equal(new URL(direct.url()).origin,first.url);assert.equal(await direct.evaluate(()=>window.__bannerlands.online.client.origin),first.url);checks.push('direct temporary-host invitations keep their existing join flow');await direct.close();
  assert.deepEqual(errors,[]);const report={checks,errors,websiteOriginRetained:true,artworkOrigins:artOrigins.size,remoteReloadKeptSeat:true,ownedHostStopped:true};
  if(process.env.BANNERLANDS_QA_OUT){await fs.mkdir(process.env.BANNERLANDS_QA_OUT,{recursive:true});await fs.writeFile(path.join(process.env.BANNERLANDS_QA_OUT,'multiplayer-website-browser.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report));
}finally{await context.close();await browser.close();await Promise.all([website.close(),first.close(),second.close()]);}
