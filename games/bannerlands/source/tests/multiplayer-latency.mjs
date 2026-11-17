import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {MultiplayerClient} from '../../multiplayer/client.js';
import {createMatchServer} from '../multiplayer-server.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=await createMatchServer({config:{enemies:3,scale:'standard',seed:44277},lobby:{public:true,maxHumans:4}});
const clients=[],accepted=[[],[],[],[]];let unstable=false,requests=0,droppedStates=0,droppedCommands=0;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
function network(index){let loseCommand=true,stateCount=0;return async(url,options)=>{
 if(unstable){requests++;await sleep(75+(requests*37%101));}
 const response=await fetch(url,options);
 if(unstable){await sleep(75+(requests*19%101));
  if(index===1&&url.includes('/api/state')&&++stateCount%4===0){droppedStates++;await response.text();throw new TypeError('Simulated lost world response');}
  if(url.endsWith('/api/command')&&loseCommand){loseCommand=false;droppedCommands++;await response.text();throw new TypeError('Simulated lost command acknowledgement');}
 }
 return response;
};}
try{
 for(let i=0;i<4;i++){const c=new MultiplayerClient({origin:server.url,storage:storage(),fetchImpl:network(i),onCommand:result=>accepted[i].push(result)});clients.push(c);await c.join(i?{name:'Guest '+i}:{hostToken:server.hostToken});}
 const revision=server.getLobby().revision;for(const c of clients)await c.ready(true,revision,true);await clients[0].start(revision);for(const c of clients)await c.poll(true);await Promise.all(clients.map(c=>c.synchronize()));await Promise.all(clients.map(c=>c.poll(true)));
 const initialCounts=clients.map((c,i)=>c.game.units.filter(u=>u.team===i).length);unstable=true;
 for(const [i,c]of clients.entries()){c.game.recruit('infantry');c.game.hold(c.game.units.filter(u=>u.team===i).map(u=>u.id));}
 const deadline=Date.now()+20000;while(accepted.some(results=>results.length<2)&&Date.now()<deadline)await sleep(100);
 for(const results of accepted){assert.equal(results.length,2);assert.ok(results.every(r=>r.ok));assert.equal(results[0].duplicate,true);}
 await sleep(3000);await Promise.all(clients.map(c=>c.poll(true)));
 for(const c of clients){assert.equal(c.session.team,c.game.playerTeam);assert.equal(c.metrics.commands,2);assert.ok(c.game.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)));}
 for(let i=0;i<4;i++)assert.equal(clients[0].game.units.filter(u=>u.team===i).length,initialCounts[i]+8,'A lost purchase acknowledgement must not duplicate troops');
 assert.equal(server.getLobby().players.length,4);assert.ok(droppedStates>0);assert.equal(droppedCommands,4);
 const report={method:'Four real HTTP clients, one local server; synthetic150–350ms request/response delay, deterministic jitter; drop every fourth state response ofguest1 afterservercomputesit and firstcommandack ofeachplayer. No physical-internet claims.',players:4,seed:44277,droppedStates,droppedCommands,results:clients.map((c,i)=>({team:i,metrics:c.metrics,lastError:c.lastError}))};
 if(process.env.BANNERLANDS_LATENCY_OUT)await fs.writeFile(process.env.BANNERLANDS_LATENCY_OUT,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{for(const c of clients)c.close();await server.close();}
