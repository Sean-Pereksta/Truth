import assert from 'node:assert/strict';
import {PresentationBuffer,MultiplayerClient} from '../../multiplayer/client.js';
import {createMatchServer} from '../multiplayer-server.mjs';
import {COMPATIBILITY} from '../../multiplayer/protocol.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await sleep(30);}throw new Error('Timed out waiting for client recovery.');}
const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const match=await createMatchServer({config:{enemies:1,scale:'standard',seed:44277},lobby:{public:true,maxHumans:2},simulation:false});
let loseReply=true,rateLimit=true;const results=[];
const transport=async(url,options)=>{
 if(url.endsWith('/api/join'))assert.equal(JSON.parse(options.body).lobbyId,match.getLobby().id);
 if(url.endsWith('/api/command')&&rateLimit){rateLimit=false;return new Response(JSON.stringify({ok:false,code:'rate',message:'Try again.'}),{status:429});}
 const response=await fetch(url,options);
 if(url.endsWith('/api/command')&&loseReply){loseReply=false;await response.text();throw new TypeError('Simulated lost acknowledgement');}
 return response;
};
const client=new MultiplayerClient({origin:match.url,storage,fetchImpl:transport,onCommand:result=>results.push(result)});
try{
 const host=await fetch(match.url+'/api/host/session',{method:'POST',headers:{Authorization:'Bearer '+match.hostToken,'Content-Type':'application/json'},body:JSON.stringify(COMPATIBILITY)}).then(r=>r.json());
 await client.join({name:'Guest',lobbyId:match.getLobby().id});
 const req=(route,body,token=host.token)=>fetch(match.url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>{const value=await r.json();assert.equal(r.ok,true,JSON.stringify(value));return value;});
 const revision=(await match.getLobby()).revision;
 await req('/api/ready',{ready:true,assetsReady:true,revision});await client.ready(true,revision,true);await req('/api/start',{revision});await client.poll(true);
 const hostWorld=await fetch(match.url+'/api/state?initial=1',{headers:{Authorization:'Bearer '+host.token}}).then(r=>r.json());
 await req('/api/synchronized',{matchId:hostWorld.lobby.matchId,sequence:hostWorld.snapshot.sequence});await client.synchronize();await client.poll(true);
 assert.equal(client.game.playerTeam,1);
 const before=client.game.teams[1].gold;const sent=client.game.recruit('infantry');assert.equal(sent.pending,true);
 await until(()=>results.length===1);await client.poll(true);
 assert.equal(results[0].ok,true);assert.equal(results[0].duplicate,true,'A lost reply retries the identical command');
 assert.ok(client.game.teams[1].gold<before);const after=client.game.teams[1].gold;
 const ids=client.game.units.filter(u=>u.team===1).map(u=>u.id);client.game.hold(ids);await until(()=>results.length===2);
 assert.equal(results[1].ok,true,'Rate-limited command does not break later order sequences');await client.poll(true);assert.equal(client.game.teams[1].gold,after,'Retry does not spend twice');
 // A rejected command consumes its acknowledged sequence. The next valid
 // command still executes in order and cannot move another player's army.
 const enemy=client.game.units.find(u=>u.team===0);client.game.hold([enemy.id]);await until(()=>results.length===3);assert.equal(results[2].ok,false);client.game.hold(ids);await until(()=>results.length===4);assert.equal(results[3].ok,true);
 const token=client.session.token;client.close();
 let releaseLeave;const leaveGate=new Promise(resolve=>{releaseLeave=resolve;});
 const restored=new MultiplayerClient({origin:match.url,storage,fetchImpl:async(url,options)=>{
  if(url.endsWith('/api/leave')){assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.keepalive,true);await leaveGate;}
  return fetch(url,options);
 }});
 assert.equal(await restored.restore(),true);assert.equal(restored.session.token,token);assert.equal(restored.game.playerTeam,1);assert.equal((await match.getLobby()).players.length,2);
 const leaving=restored.leave();
 try{
  assert.equal(restored.session,null);assert.equal(restored.game,null);assert.equal(restored.lobby,null);
  assert.equal(restored.running,false);assert.equal(storage.getItem('bannerlands-session:'+match.url),null);
  assert.equal(await new MultiplayerClient({origin:match.url,storage}).restore(),false);
  assert.equal(match.getLobby().players.length,2,'The client already left while server acknowledgement is pending');
 }finally{releaseLeave();await leaving;}
 assert.equal(match.getLobby().players.length,1,'Explicit leave releases the running campaign seat');
 console.log('PASS client retries lost acknowledgements and rate limits, preserves ordered rejection recovery, reconnects one session without duplicate purchases.');
}finally{client.close();await match.close();}

const buffer=new PresentationBuffer({delay:.1}),unit={id:7,x:10,y:0},game={time:2,units:[unit]};
buffer.push({sequence:1,time:1,units:[{id:7,x:0,y:0}]},1000);buffer.push({sequence:2,time:2,units:[{id:7,x:10,y:0}]},2000);
buffer.draw(game,2000,()=>{assert.ok(unit.x>0&&unit.x<10);assert.ok(game.time>1&&game.time<2);});assert.equal(unit.x,10);assert.equal(game.time,2);
buffer.draw(game,10000,()=>assert.equal(unit.x,10,'A stale connection never extrapolates beyond the authoritative world'));
buffer.push({sequence:3,time:2.1,units:[{id:7,x:20,y:0}]},10010);unit.x=20;game.time=2.1;
buffer.draw(game,10010,()=>assert.ok(unit.x>=10,'A new update after a stall never reverses presentation time.'));
assert.throws(()=>buffer.draw(game,2000,()=>{throw new Error('draw');}));assert.equal(unit.x,20);
console.log('PASS interpolation restores authoritative state even on draw errors and never extrapolates hidden or stale movement.');
