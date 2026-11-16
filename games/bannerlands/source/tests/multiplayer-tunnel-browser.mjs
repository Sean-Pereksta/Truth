// Opt-in: requires an explicitly authorized, already verified live fixture.
// Private fixture credentials stay in memory and are never written to results.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const fixture=JSON.parse(await fs.readFile(process.argv[2],'utf8')),out=process.argv[3];
const local=fixture.url,headers={Authorization:'Bearer '+fixture.hostToken,'Content-Type':'application/json'};
async function hostRequest(route,body){const r=await fetch(local+route,{method:'POST',headers,body:JSON.stringify(body)}),v=await r.json();assert.equal(r.ok,true,v.message);return v;}
await hostRequest('/api/config',{config:{house:0,houses:[0,1,2,3],enemies:3,mode:'blitz-flags',difficulty:'relaxed',scale:'standard',landscape:'open',seed:44277,fogOfWar:true},maxHumans:2});
await hostRequest('/api/visibility',{public:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER}),contexts=[await browser.newContext({viewport:{width:1440,height:960}}),await browser.newContext({viewport:{width:1440,height:960}})],pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
for(const [i,p]of pages.entries())p.on('pageerror',e=>errors.push({page:i,message:e.message}));
const started=Date.now();let phase='loading the local host';
try{
 await pages[0].goto(fixture.bootstrapUrl,{timeout:30000,waitUntil:'domcontentloaded'});await pages[0].waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:180000});
 await pages[0].evaluate(token=>window.__bannerlands.online.client.join({hostToken:token}),fixture.hostToken);console.log('Local downloaded-host interface loaded.');
 phase='loading the public browser guest';await pages[1].goto(fixture.inviteUrl,{timeout:30000,waitUntil:'domcontentloaded'});await pages[1].waitForFunction(()=>!document.getElementById('startButton').disabled&&window.__bannerlands.online.client.session,null,{timeout:240000});console.log('Full painted browser guest loaded through the public connection.');
 assert.equal(await pages[1].evaluate(()=>typeof window.bannerlandsHost),'undefined','Public browser cannot acquire the installed hosting bridge');
 assert.equal(await pages[1].locator('[data-pane="host"] button[type="submit"]').isDisabled(),true,'Browser Create Lobby control stays disabled');
 const denied=await pages[1].evaluate(async()=>{const c=window.__bannerlands.online.client,r=await fetch('/api/desktop/host',{method:'POST',headers:{Authorization:'Bearer '+c.session.token,'Content-Type':'application/json'},body:'{}'});return r.status;});assert.ok([401,403].includes(denied));
 for(const p of pages)await p.waitForFunction(()=>window.__bannerlands.online.client.lobby?.players.length===2);
 for(const p of pages)await p.evaluate(()=>{const c=window.__bannerlands.online.client;return c.ready(true,c.lobby.revision,true);});
 await pages[0].waitForFunction(()=>window.__bannerlands.online.client.lobby.players.every(p=>p.ready));
 await pages[0].evaluate(()=>{const c=window.__bannerlands.online.client;return c.start(c.lobby.revision);});
 for(const p of pages)await p.waitForFunction(()=>window.__bannerlands.game.remote&&window.__bannerlands.game.time>1,null,{timeout:45000});
 await pages[1].keyboard.press('f');assert.equal(await pages[1].evaluate(()=>{const a=window.__bannerlands;return [...a.ui.selected].every(id=>a.game.byId.get(id)?.team===1);}),true);
 await pages[1].keyboard.press('u');await pages[1].locator('[data-recruit="infantry"]').click();await pages[1].waitForFunction(()=>window.__bannerlands.online.client.metrics.commands>0);await pages[1].keyboard.press('Escape');
 await pages[1].evaluate(()=>{const g=window.__bannerlands.game;g.hold(g.units.filter(u=>u.team===1).map(u=>u.id));});
 const target=await pages[0].evaluate(()=>{const g=window.__bannerlands.game,h=g.teams[g.playerTeam].home,t=[...g.objectives].sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];window.__networkOrders=new Set();return {x:t.x,y:t.y,id:t.id};});
 console.log('Public-path match started after both synchronization acknowledgments.');
 phase='playing the public-path match';
 let lastPurchase=0,lastProgress=-1,outcome=null;
 const deadline=Date.now()+210000;
 while(Date.now()<deadline){
  outcome=await pages[0].evaluate(({target,purchase})=>{const a=window.__bannerlands,g=a.game;if(g.winner!==null)return {winner:g.winner,time:g.time,scores:g.objectiveScores};const troops=g.units.filter(u=>u.team===g.playerTeam),fresh=troops.filter(u=>!window.__networkOrders.has(u.id));if(fresh.length){g.command(fresh.map(u=>u.id),target.x,target.y,'move','line');for(const u of fresh)window.__networkOrders.add(u.id);}const arrivals=troops.filter(u=>u.order?.mode==='move'&&Math.hypot(u.x-target.x,u.y-target.y)<2.5);if(arrivals.length)g.hold(arrivals.map(u=>u.id));if(purchase)g.recruit('infantry');return {winner:null,time:g.time,scores:g.objectiveScores,units:troops.length};},{target,purchase:Date.now()-lastPurchase>15000});
  if(Date.now()-lastPurchase>15000)lastPurchase=Date.now();
  const progress=Math.floor(outcome.time/30);if(progress>lastProgress){lastProgress=progress;console.log('Campaign time '+Math.floor(outcome.time)+'s; public score '+JSON.stringify(outcome.scores)+'.');}
  if(outcome.winner!==null)break;
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 await fs.mkdir(out,{recursive:true});await pages[1].screenshot({path:path.join(out,'public-browser-guest.png')});
 const report={browser:'Chrome '+browser.version(),method:'Downloaded-host interface on localhost and full browser guest through actual Cloudflare edge, both automated contexts on one physical laptop. Legal player commands only; Blitz Flags,2humans+2AI,Easy,Standard,Open Realm,fog,seed44277. This is not a separate-physical-location acceptance match.',elapsedMs:Date.now()-started,publicGameVerified:true,browserCanJoin:true,browserCannotCreate:true,artwork:{painted:23,heroHouses:16},outcome,completed:outcome?.winner!==null,errors};
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}catch(error){
 const message=String(error.message||error).split('\n')[0].replace(/https?:\/\/\S+/g,'[test address]');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'result.json'),JSON.stringify({completed:false,phase,error:message,elapsedMs:Date.now()-started},null,2));console.error('Public game check failed while '+phase+': '+message);process.exitCode=1;
}finally{await browser.close();}
