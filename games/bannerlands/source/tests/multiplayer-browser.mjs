import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createMatchServer} from '../multiplayer-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const out=process.env.BANNERLANDS_QA_OUT;
const browserName=path.basename(process.env.BANNERLANDS_BROWSER||'chromium').toLowerCase().includes('msedge')?'Edge':'Chrome';
const humans=Number(process.env.BANNERLANDS_QA_HUMANS)||2,enemies=humans===4?15:3;
const match=await createMatchServer({config:{enemies,scale:'standard',mode:'conquest',landscape:'crownlands',fogOfWar:true,seed:44277},lobby:{name:'Painted browser campaign',public:false,maxHumans:humans}});
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
const contexts=[];for(let i=0;i<humans;i++)contexts.push(await browser.newContext({viewport:{width:1440,height:960}}));
const pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
for(const [i,p]of pages.entries())p.on('pageerror',error=>errors.push({page:i,message:error.message,stack:error.stack}));
const started=performance.now();
try{
 console.log('Opening the private loopback lobby for '+humans+' browser players.');
 await pages[0].goto(match.url,{waitUntil:'domcontentloaded',timeout:120000});
 await pages[0].waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:120000});
 await pages[0].evaluate(token=>window.__bannerlands.online.client.join({hostToken:token}),match.hostToken);
 for(const p of pages.slice(1)){await p.goto(match.url+'/#invite='+encodeURIComponent(match.invite),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>!document.getElementById('startButton').disabled&&window.__bannerlands.online.client.session,null,{timeout:120000});}
 for(const p of pages)await p.waitForFunction(n=>window.__bannerlands.online.client.lobby?.players.length===n,humans);
 const teams=await Promise.all(pages.map(p=>p.evaluate(()=>window.__bannerlands.online.client.session.team)));
 console.log('All private seats connected.');
 assert.deepEqual(teams,Array.from({length:humans},(_,i)=>i));
 for(const p of pages)await p.evaluate(()=>{const c=window.__bannerlands.online.client;return c.ready(true,c.lobby.revision,true);});
 await pages[0].waitForFunction(()=>window.__bannerlands.online.client.lobby.players.every(p=>p.ready));
 await pages[0].evaluate(()=>{const c=window.__bannerlands.online.client;return c.start(c.lobby.revision);});
 for(const p of pages)await p.waitForFunction(()=>window.__bannerlands.game.remote&&window.__bannerlands.game.time>1,null,{timeout:120000});
 await pages[1].evaluate(()=>window.__bannerlands.selectArmy());
 const before=await pages[1].evaluate(()=>{const a=window.__bannerlands,g=a.game;return {team:g.playerTeam,house:g.teams[g.playerTeam].name,count:a.ui.selected.size,own:g.units.filter(u=>u.team===g.playerTeam).length,graphics:{painted:a.renderer.paintedArtReady,paintedTroops:a.renderer.paintedRows?.size,heroes:a.renderer.heroArtReady,heroHouses:a.renderer.heroRows?.size},time:g.time};});
 assert.equal(before.team,1);assert.equal(before.count,before.own);assert.ok(before.own>0);
 assert.equal(before.graphics.painted,true);assert.equal(before.graphics.paintedTroops,23);assert.equal(before.graphics.heroes,true);assert.equal(before.graphics.heroHouses,16);
 const feedback=await pages[1].evaluate(()=>{const a=window.__bannerlands,start=performance.now(),result=a.game.hold([...a.ui.selected]);return {immediateMs:performance.now()-start,pending:result.pending,visible:!document.getElementById('orderReceipt').hidden};});
 assert.ok(feedback.pending&&feedback.visible);
 await pages[1].waitForFunction(()=>window.__bannerlands.game.units.filter(u=>u.team===1).every(u=>u.order?.mode==='hold'));
 // Browser guest can reopen commands, use its own hero and recruit through
 // unchanged controls. These must reach the host instead of changing the view.
 await pages[1].keyboard.press('f');
 const hero=await pages[1].evaluate(()=>{const a=window.__bannerlands;return [...a.ui.selected].map(id=>a.game.byId.get(id)).map(u=>({type:u.type,team:u.team}));});
 assert.deepEqual(hero,[{type:'hero',team:1}]);
 await pages[1].keyboard.press('u');
 await pages[1].locator('[data-recruit="infantry"]').click();
 await pages[1].waitForFunction(()=>window.__bannerlands.online.client.metrics.commands>=2);
 const acknowledgments=await pages[1].evaluate(()=>window.__bannerlands.online.client.metrics.commandRoundTrips.slice());
 console.log('Host confirmed holds and recruitment. Reloading the same guest seat.');
 await pages[1].reload({waitUntil:'domcontentloaded',timeout:120000});
 await pages[1].waitForFunction(()=>window.__bannerlands?.game.remote&&window.__bannerlands.game.playerTeam===1&&!document.getElementById('startButton').disabled,null,{timeout:120000});
 assert.equal((await match.getLobby()).players.length,humans,'Reload must reconnect the same seat');
 if(out){await fs.mkdir(out,{recursive:true});await pages[1].screenshot({path:path.join(out,'bannerlands-browser-guest.png'),timeout:120000});}
 // Collect frame intervals with two real renderers and the authoritative host
 // in one process. This is reference-machine evidence, never a universal FPS claim.
 const seconds=Number(process.env.BANNERLANDS_QA_SECONDS||5),memory=[];
 if(!Number.isFinite(seconds)||seconds<1||seconds>3600)throw new Error('Choose a sample duration of 1 to 3600 seconds.');
 console.log('Guest reconnected. Sampling '+seconds+' seconds.');
 const hostStart=match.game.time,measurementStart=performance.now();
 const sampler=setInterval(()=>memory.push({elapsedMs:performance.now()-started,hostHeapBytes:process.memoryUsage().heapUsed}),5000);
 let performanceSamples;
 try{performanceSamples=await pages[1].evaluate(seconds=>new Promise(resolve=>{const frames=[],guestHeap=[],start=performance.now();let last,lastHeap=-Infinity;function frame(now){if(last!==undefined)frames.push(now-last);last=now;if(now-lastHeap>=5000){guestHeap.push({elapsedMs:now-start,bytes:performance.memory?.usedJSHeapSize??null});lastHeap=now;}if(now-start<seconds*1000)requestAnimationFrame(frame);else{const a=window.__bannerlands;resolve({frames,guestHeap,fps:a.fps,metrics:a.online.client.metrics,units:a.game.units.length,team:a.game.playerTeam,lastError:a.online.client.lastError});}}requestAnimationFrame(frame);}),seconds);}finally{clearInterval(sampler);}
 assert.deepEqual(errors,[],'No full-game browser runtime errors');
 const allPlayers=await Promise.all(pages.map(p=>p.evaluate(()=>{const a=window.__bannerlands;a.selectArmy();return {team:a.game.playerTeam,selected:[...a.ui.selected].every(id=>a.game.byId.get(id).team===a.game.playerTeam),time:a.game.time};})));
 assert.ok(allPlayers.every(p=>p.selected&&p.time>1));
 const sampleElapsedMs=performance.now()-measurementStart,hostGameSeconds=match.game.time-hostStart;
 const ordered=performanceSamples.frames.slice().sort((a,b)=>a-b);
 assert.ok(ordered.length>0);
 const frameAt=p=>ordered[Math.ceil(ordered.length*p)-1];
 const summary={p95FrameMs:frameAt(.95),p99FrameMs:frameAt(.99),frames:ordered.length,stallsOver100Ms:ordered.filter(ms=>ms>100).length,hostGameSeconds,sampleElapsedMs,realTimeRatio:hostGameSeconds*1000/sampleElapsedMs,feedback,acknowledgments};
 const report={summary,hostMetrics:match.metrics,browserName,browserVersion:browser.version(),scenario:`${humans} humans + ${enemies+1-humans} AI; standard Crownlands; fog; seed44277; ${humans} ${browserName} contexts; same laptop; browser reload reconnect`,elapsedMs:performance.now()-started,sampleSeconds:seconds,hostHeap:memory,guest:before,players:allPlayers,performance:performanceSamples,errors};
 if(out)await fs.writeFile(path.join(out,'multiplayer-browser.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,performance:{...performanceSamples,frames:performanceSamples.frames.length}},null,2));
}finally{await browser.close();await match.close();}
