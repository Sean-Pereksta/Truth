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
const match=await createMatchServer({config:{enemies,scale:'standard',mode:'conquest',landscape:'crownlands',fogOfWar:true,seed:44277},lobby:{name:'Painted browser campaign',public:true,maxHumans:humans}});
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const contexts=[];for(let i=0;i<humans;i++)contexts.push(await browser.newContext({viewport:{width:1440,height:960}}));
const pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
for(const [i,p]of pages.entries())p.on('pageerror',error=>errors.push({page:i,message:error.message,stack:error.stack}));
const started=performance.now();
try{
 await pages[0].goto(match.url);
 await pages[0].waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:120000});
 await pages[0].evaluate(token=>window.__bannerlands.online.client.join({hostToken:token}),match.hostToken);
 for(const p of pages.slice(1)){await p.goto(match.url+'/#join=1');await p.waitForFunction(()=>!document.getElementById('startButton').disabled&&window.__bannerlands.online.client.session,{timeout:120000});}
 for(const p of pages)await p.waitForFunction(n=>window.__bannerlands.online.client.lobby?.players.length===n,humans);
 const teams=await Promise.all(pages.map(p=>p.evaluate(()=>window.__bannerlands.online.client.session.team)));
 assert.deepEqual(teams,Array.from({length:humans},(_,i)=>i));
 for(const p of pages)await p.evaluate(()=>{const c=window.__bannerlands.online.client;return c.ready(true,c.lobby.revision,true);});
 await pages[0].waitForFunction(()=>window.__bannerlands.online.client.lobby.players.every(p=>p.ready));
 await pages[0].evaluate(()=>{const c=window.__bannerlands.online.client;return c.start(c.lobby.revision);});
 for(const p of pages)await p.waitForFunction(()=>window.__bannerlands.game.remote&&window.__bannerlands.game.time>1,{timeout:30000});
 await pages[1].evaluate(()=>window.__bannerlands.selectArmy());
 const before=await pages[1].evaluate(()=>{const a=window.__bannerlands,g=a.game;return {team:g.playerTeam,house:g.teams[g.playerTeam].name,count:a.ui.selected.size,own:g.units.filter(u=>u.team===g.playerTeam).length,graphics:{painted:a.renderer.paintedArtReady,paintedTroops:a.renderer.paintedRows?.size,heroes:a.renderer.heroArtReady,heroHouses:a.renderer.heroRows?.size},time:g.time};});
 assert.equal(before.team,1);assert.equal(before.count,before.own);assert.ok(before.own>0);
 assert.equal(before.graphics.painted,true);assert.equal(before.graphics.paintedTroops,23);assert.equal(before.graphics.heroes,true);assert.equal(before.graphics.heroHouses,16);
 await pages[1].evaluate(()=>{const a=window.__bannerlands;return a.game.hold([...a.ui.selected]);});
 await pages[1].waitForFunction(()=>window.__bannerlands.game.units.filter(u=>u.team===1).every(u=>u.order?.mode==='hold'));
 // Browser guest can reopen commands, use its own hero and recruit through
 // unchanged controls. These must reach the host instead of changing the view.
 await pages[1].keyboard.press('f');
 const hero=await pages[1].evaluate(()=>{const a=window.__bannerlands;return [...a.ui.selected].map(id=>a.game.byId.get(id)).map(u=>({type:u.type,team:u.team}));});
 assert.deepEqual(hero,[{type:'hero',team:1}]);
 await pages[1].keyboard.press('u');
 await pages[1].locator('[data-recruit="infantry"]').click();
 await pages[1].waitForFunction(()=>window.__bannerlands.online.client.metrics.commands>=2);
 await pages[1].reload();
 await pages[1].waitForFunction(()=>window.__bannerlands.game.remote&&window.__bannerlands.game.playerTeam===1,{timeout:120000});
 assert.equal((await match.getLobby()).players.length,humans,'Reload must reconnect the same seat');
 if(out){await fs.mkdir(out,{recursive:true});await pages[1].screenshot({path:path.join(out,'bannerlands-browser-guest.png')});}
 // Collect frame intervals with two real renderers and the authoritative host
 // in one process. This is reference-machine evidence, never a universal FPS claim.
 const performanceSamples=await pages[1].evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();let last;function frame(now){if(last!==undefined)frames.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{const a=window.__bannerlands;resolve({frames,fps:a.fps,metrics:a.online.client.metrics,units:a.game.units.length,team:a.game.playerTeam,lastError:a.online.client.lastError});}}requestAnimationFrame(frame);}));
 assert.deepEqual(errors,[],'No full-game browser runtime errors');
 const allPlayers=await Promise.all(pages.map(p=>p.evaluate(()=>{const a=window.__bannerlands;a.selectArmy();return {team:a.game.playerTeam,selected:[...a.ui.selected].every(id=>a.game.byId.get(id).team===a.game.playerTeam),time:a.game.time};})));
 assert.ok(allPlayers.every(p=>p.selected&&p.time>1));
 const report={browserName,browserVersion:browser.version(),scenario:`${humans} humans + ${enemies+1-humans} AI; standard Crownlands; fog; seed44277; ${humans} ${browserName} contexts; same laptop; browser reload reconnect`,elapsedMs:performance.now()-started,guest:before,players:allPlayers,performance:performanceSamples,errors};
 if(out)await fs.writeFile(path.join(out,'multiplayer-browser.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,performance:{...performanceSamples,frames:performanceSamples.frames.length}},null,2));
}finally{await browser.close();await match.close();}
