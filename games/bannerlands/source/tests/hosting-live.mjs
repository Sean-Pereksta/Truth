// Explicit opt-in integration check. Creates one temporary public test listing,
// uses the real launcher/cloudflared, then removes the listing and its child.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {COMPATIBILITY} from '../../multiplayer/protocol.js';
import {firebaseConfig} from '../../multiplayer/firebase-config.js';
import {LOBBY_COLLECTION} from '../../multiplayer/directory.js';

const option=name=>{const i=process.argv.indexOf('--'+name);return i<0?null:process.argv[i+1];};
const cloudflared=option('cloudflared');if(!cloudflared)throw new Error('Explicit --cloudflared path required for live hosting test.');
const work=path.resolve(option('work')||'../../../../hosting-live');await fs.mkdir(work,{recursive:true});
const start=performance.now(),events=[],checks=[];
const launcher=option('launcher')?path.resolve(option('launcher')):fileURLToPath(new URL('../desktop/launcher.mjs',import.meta.url));
const runtime=option('node')?path.resolve(option('node')):process.execPath;
const child=spawn(runtime,[launcher,'--no-open','--cloudflared',path.resolve(cloudflared),'--data-dir',work],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='',stderr='',local,hosted;
child.stderr.on('data',chunk=>stderr+=chunk.toString());
const bootstrap=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Launcher did not start: '+stderr)),7000);child.stdout.on('data',chunk=>{output+=chunk.toString();const line=output.split('\n').find(line=>line.startsWith('{'));if(line){clearTimeout(timeout);resolve(JSON.parse(line));}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Launcher exited '+code+': '+stderr));});});
local=bootstrap.url;const desktopSecret=new URLSearchParams(new URL(bootstrap.bootstrapUrl).hash.slice(1)).get('desktop');
async function request(origin,route,{token,body,timeout=110000}={}){const response=await fetch(origin+route,{method:body?'POST':'GET',signal:AbortSignal.timeout(timeout),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await response.text();let result;try{result=JSON.parse(text);}catch{result={text};}return {status:response.status,body:result};}
const directory=async()=>{
  const response=await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery`,{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:LOBBY_COLLECTION}],limit:50}})});
  const body=await response.json();if(!response.ok)throw new Error('Directory read failed: '+JSON.stringify(body));return body.flatMap(entry=>entry.document?[entry.document]:[]);
};
try{
  assert.equal((await request(local,'/api/desktop/status')).status,401);checks.push('desktop bootstrap requires private local capability');
  hosted=(await request(local,'/api/desktop/host',{token:desktopSecret,body:{config:{enemies:3,scale:'standard',landscape:'open',mode:'conquest',difficulty:'standard',fogOfWar:true,seed:44277},lobby:{name:'Bannerlands live connection verification',hostName:'Connection test',public:true,maxHumans:2}}}));assert.equal(hosted.status,200,JSON.stringify(hosted.body));hosted=hosted.body;
  const readyMs=performance.now()-start;checks.push('real cloudflared address verified before publication');
  const publicLobby=(await request(hosted.publicUrl,'/api/lobby')).body.lobby;assert.equal(publicLobby.reachable,true);assert.equal(publicLobby.directoryError,null);assert.equal(publicLobby.maxHumans,2);
  let listing=(await directory()).find(document=>document.fields.id?.stringValue===publicLobby.id);assert.ok(listing,'reachable public match appears in Firebase');
  const publicRecord=JSON.stringify(listing);for(const key of [hosted.hostToken,hosted.invite,desktopSecret])assert.ok(!publicRecord.includes(key));checks.push('live Firebase listing contains no host, desktop or invite credentials');
  for(const route of ['/','/app.js','/render.js','/core.js','/assets/house-emblems.png','/assets/overhaul/infantry.png']){const response=await fetch(hosted.publicUrl+route,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,route);const data=await response.arrayBuffer();assert.ok(data.byteLength>1000,route);}
  checks.push('public URL serves maintained full game, renderer and original artwork');
  const status=await request(local,'/api/desktop/status',{token:desktopSecret});assert.equal(status.body.stage,'ready');
  assert.equal((await request(hosted.publicUrl,'/api/host/session',{token:hosted.invite,body:{}})).status,401);checks.push('guest invitation cannot claim host controls');
  await fs.writeFile(path.join(work,'fixture-private.json'),JSON.stringify({...bootstrap,...hosted,desktopSecret,lobbyId:publicLobby.id},null,2));
  const holdMs=Number(option('hold-ms'))||0;
  console.log(JSON.stringify({stage:'ready',publicUrl:hosted.publicUrl,localUrl:local,readyMs,fixture:path.join(work,'fixture-private.json'),checks}));
  if(holdMs){const until=Date.now()+holdMs;while(Date.now()<until){try{await fs.access(path.join(work,'stop'));break;}catch{}await request(local,'/api/desktop/status',{token:desktopSecret});await new Promise(resolve=>setTimeout(resolve,1000));}}
  await request(local,'/api/close',{token:hosted.hostToken,body:{}});checks.push('closing host removes its directory listing and owned tunnel');
  listing=(await directory()).find(document=>document.fields.id?.stringValue===publicLobby.id);assert.equal(listing,undefined);
  assert.equal((await fetch(local+'/')).status,200);checks.push('single-player local service remains available after online hosting closes');
  const afterStop=await request(local,'/api/desktop/status',{token:desktopSecret});assert.equal(afterStop.body.stage,'idle');
  const newLobby=(await request(local,'/api/lobby')).body.lobby;assert.equal(newLobby.public,false);assert.equal(newLobby.status,'waiting');assert.equal(newLobby.players.length,1);
  const result={testedAt:new Date().toISOString(),physicalLocations:1,path:'same laptop -> public Cloudflare HTTPS edge -> local authoritative service',readyMs,publicUrl:hosted.publicUrl,checks,limitations:['Browser graphics and performance require separate browser QA.','This is not a separate-location match or a completed battle.','Quick Tunnels are temporary testing/development connections.']};
  await fs.writeFile(path.join(work,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({stage:'complete',result:path.join(work,'result.json'),checks}));
}catch(error){
  const failure={testedAt:new Date().toISOString(),success:false,physicalLocations:1,stage:'hosting-verification',message:String(error.message).replace(/[A-Za-z0-9_-]{40,}/g,'[private-value]').slice(0,1000),checks};
  await fs.writeFile(path.join(work,'result-failed.json'),JSON.stringify(failure,null,2));console.error(JSON.stringify(failure));process.exitCode=1;
}finally{
  if(hosted?.hostToken)await request(local,'/api/close',{token:hosted.hostToken,body:{},timeout:20000}).catch(()=>{});
  await request(local,'/api/desktop/shutdown',{token:desktopSecret,body:{},timeout:15000}).catch(()=>{});
  if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,2000))]);
  if(child.exitCode===null)child.kill();
  await fs.unlink(path.join(work,'fixture-private.json')).catch(()=>{});
  await fs.unlink(path.join(work,'sessions',child.pid+'.json')).catch(()=>{});
}
