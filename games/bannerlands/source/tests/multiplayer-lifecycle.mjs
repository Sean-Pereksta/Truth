import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerClient} from '../../multiplayer/client.js';
import {createMatchServer} from '../multiplayer-server.mjs';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
const until=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Lifecycle condition timed out.');};

test('closing ignores a late poll response and stops all callbacks/timers',async()=>{
  const waiting=gate();let states=0,statuses=0;
  const client=new MultiplayerClient({origin:'https://test.trycloudflare.com',storage:storage(),fetchImpl:async()=>{await waiting.promise;return new Response(JSON.stringify({lobby:{matchId:null,status:'waiting'},session:{team:0,lastSeq:0}}));},onState:()=>states++,onStatus:()=>statuses++});
  client.session={token:'private',team:0};client.running=true;const pending=client.poll(true);client.close();waiting.release();await pending;
  assert.equal(states,0);assert.equal(statuses,0);assert.equal(client.running,false);assert.equal(client.pollPromise,null);assert.equal(client.controllers.size,0);
});

test('overlapping polls share one request instead of applying out-of-order worlds',async()=>{
  const waiting=gate();let requests=0;
  const client=new MultiplayerClient({origin:'https://test.trycloudflare.com',storage:storage(),fetchImpl:async()=>{requests++;await waiting.promise;return new Response(JSON.stringify({lobby:{matchId:null,status:'waiting'},session:{team:0,lastSeq:0}}));}});
  client.session={token:'private',team:0};client.running=true;const first=client.poll(true),second=client.poll(true);assert.equal(first,second);waiting.release();await first;assert.equal(requests,1);client.close();
});

test('formation commands provide pending feedback without mutating the remote world',async()=>{
  const waiting=gate(),unit={id:7,team:1,x:10,y:10,order:{mode:'hold',x:10,y:10}};
  const client=new MultiplayerClient({origin:'https://test.trycloudflare.com',storage:storage(),fetchImpl:async()=>{await waiting.promise;return new Response(JSON.stringify({ok:true}));}});
  client.session={token:'private',team:1};client.running=true;client.lobby={matchId:'match-1',status:'in-progress'};client.game={units:[unit]};client.lastGood=client.now();client.attachCommands(client.game);
  const before=JSON.stringify(unit),result=client.game.placeFormation([7],{x:20,y:20,preset:'line',width:4,ranks:2,faceX:1,faceY:0});
  assert.equal(result.pending,true);assert.equal(JSON.stringify(unit),before);assert.equal(client.queue[0].matchId,'match-1');assert.equal(result.formation.x,20);client.close();waiting.release();await new Promise(resolve=>setImmediate(resolve));
});

test('four private sessions retain houses across end/restart and reject a delayed prior-match command',async()=>{
  const server=await createMatchServer({config:{enemies:5,scale:'standard',landscape:'open',seed:44277},lobby:{public:true,maxHumans:4},simulation:false});
  const clients=[],stores=Array.from({length:4},storage),acks=[];let holdCommand=false,oldResponse=null;const delayed=gate();
  const transport=async(url,options)=>{
    if(holdCommand&&url.endsWith('/api/command')){holdCommand=false;await delayed.promise;const response=await fetch(url,{...options,signal:undefined});oldResponse={status:response.status,body:await response.clone().json()};return response;}
    return fetch(url,options);
  };
  const make=i=>new MultiplayerClient({origin:server.url,storage:stores[i],fetchImpl:i===1?transport:fetch,onCommand:result=>acks.push({i,result})});
  const request=async(route,body)=>{const response=await clients[0].request(route,{method:'POST',body});assert.equal(response.ok,true);return response;};
  const pollAll=()=>Promise.all(clients.map(client=>client.poll(true)));
  const readyAll=async()=>{const revision=server.getLobby().revision;await Promise.all(clients.map(client=>client.ready(true,revision,true)));return revision;};
  const synchronizeAll=async()=>{await pollAll();assert.equal(server.getLobby().status,'starting');assert.ok(clients.every(client=>client.game&&client.snapshot));await Promise.all(clients.map(client=>client.request('/api/synchronized',{method:'POST',body:{matchId:client.lobby.matchId,sequence:client.snapshot.sequence}})));assert.equal(server.getLobby().status,'in-progress');await pollAll();};
  try{
    for(let i=0;i<4;i++){const client=make(i);clients.push(client);await client.join({name:'Commander '+(i+1),...(i===0?{hostToken:server.hostToken}:{})});}
    assert.equal(server.getLobby().players.length,4);const tokens=clients.map(client=>client.session.token);
    await clients[1].chooseHouse(5);await pollAll();assert.equal(clients[1].session.team,5);assert.ok(server.getLobby().players.every(player=>!player.ready));
    await request('/api/start',{revision:await readyAll()});await synchronizeAll();const oldMatch=server.getLobby().matchId,oldGames=clients.map(client=>client.game);
    assert.deepEqual(clients.map(client=>client.game.playerTeam),[0,5,2,3]);
    holdCommand=true;const sent=clients[1].game.recruit('infantry');assert.equal(sent.pending,true);await until(()=>!holdCommand);
    await request('/api/end',{});await pollAll();assert.ok(clients.every(client=>client.game===null));assert.deepEqual(clients.map(client=>client.session.token),tokens);
    await request('/api/start',{revision:await readyAll()});await synchronizeAll();assert.notEqual(server.getLobby().matchId,oldMatch);assert.ok(clients.every((client,index)=>client.game!==oldGames[index]));assert.deepEqual(clients.map(client=>client.game.playerTeam),[0,5,2,3]);
    const gold=server.game.teams[5].gold,count=server.game.group(5).length;delayed.release();await until(()=>oldResponse!==null);
    assert.equal(oldResponse.status,409);assert.equal(oldResponse.body.code,'match');assert.equal(server.game.teams[5].gold,gold);assert.equal(server.game.group(5).length,count);assert.equal(clients[1].sequence,0);
    clients[1].game.recruit('infantry');await until(()=>acks.some(ack=>ack.i===1&&ack.result.ok));assert.ok(server.game.teams[5].gold<gold);assert.ok(server.game.group(5).length>count);assert.equal(clients[1].sequence,1);
    clients[1].close();const restored=make(1);assert.equal(await restored.restore(),true);clients[1]=restored;assert.equal(restored.session.token,tokens[1]);assert.equal(restored.game.playerTeam,5);assert.equal(server.getLobby().players.length,4);
  }finally{delayed.release();for(const client of clients)client.close();await server.close();}
});

async function barrierFixture(options={}){
  const server=await createMatchServer({config:{enemies:3,scale:'standard',landscape:'open',seed:44277},lobby:{public:true,maxHumans:4},...options});
  const request=async(route,{token=server.hostToken,body}={})=>{const response=await fetch(server.url+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
  const {COMPATIBILITY}=await import('../../multiplayer/protocol.js'),tokens=[server.hostToken];
  for(let i=1;i<4;i++){const joined=await request('/api/join',{body:{...COMPATIBILITY,name:'Commander '+(i+1)}});assert.equal(joined.status,201);tokens.push(joined.body.token);}
  const ready=async()=>{const revision=server.getLobby().revision;for(const token of tokens)assert.equal((await request('/api/ready',{token,body:{ready:true,assetsReady:true,revision}})).status,200);return revision;};
  return {server,request,tokens,ready};
}

test('initial synchronization freezes time for a slow fourth player and rejects invalid acknowledgements',async()=>{
  const f=await barrierFixture();try{
    const started=await f.request('/api/start',{body:{revision:await f.ready()}});assert.equal(started.status,200);assert.equal(started.body.lobby.status,'starting');const matchId=started.body.lobby.matchId;
    assert.ok(f.server.getLobby().players.every(player=>!player.synchronized));
    for(const [index,token]of f.tokens.slice(0,3).entries()){
      const state=await f.request('/api/state?initial=1',{token});assert.equal(state.body.snapshot.time,0);const sequence=state.body.snapshot.sequence;
      if(index===0){
        assert.equal((await f.request('/api/synchronized',{token,body:{matchId:'another-match',sequence}})).status,409);
        assert.equal((await f.request('/api/synchronized',{token,body:{matchId,sequence:sequence+1000}})).status,409);
        const unit=state.body.snapshot.units.find(unit=>unit.team===0);assert.equal((await f.request('/api/command',{token,body:{v:1,matchId,seq:1,type:'hold',args:[[unit.id]]}})).status,409);
      }
      assert.equal((await f.request('/api/synchronized',{token,body:{matchId,sequence}})).status,200);
    }
    await new Promise(resolve=>setTimeout(resolve,120));assert.equal(f.server.getLobby().status,'starting');assert.equal(f.server.getLobby().players.filter(player=>player.synchronized).length,3);assert.equal(f.server.game.time,0);assert.equal(f.server.metrics.simulationSteps,0);
    const fourth=await f.request('/api/state?initial=1',{token:f.tokens[3]});assert.equal(fourth.body.snapshot.time,0);assert.equal((await f.request('/api/synchronized',{token:f.tokens[3],body:{matchId,sequence:fourth.body.snapshot.sequence}})).status,200);
    assert.equal(f.server.getLobby().status,'in-progress');await until(()=>f.server.game.time>0);assert.ok(f.server.metrics.simulationSteps>0);
  }finally{await f.server.close();}
});

test('a stalled start times out to a recoverable lobby and the host can cancel a retry',async()=>{
  let clock=100_000;const f=await barrierFixture({clock:()=>clock,simulation:false,synchronizationMs:45_000});try{
    const first=await f.request('/api/start',{body:{revision:await f.ready()}}),oldMatch=first.body.lobby.matchId;assert.equal(first.body.lobby.status,'starting');
    const hostState=await f.request('/api/state?initial=1');await f.request('/api/synchronized',{body:{matchId:oldMatch,sequence:hostState.body.snapshot.sequence}});
    clock+=45_001;const expired=await f.request('/api/lobby');assert.ok(['waiting','full'].includes(expired.body.lobby.status));assert.equal(expired.body.lobby.matchId,null);assert.match(expired.body.lobby.error,/synchron|start|load/i);assert.ok(expired.body.lobby.players.every(player=>!player.ready&&!player.synchronized));assert.equal(f.server.game.time,0);
    const retry=await f.request('/api/start',{body:{revision:await f.ready()}});assert.equal(retry.status,200);assert.equal(retry.body.lobby.status,'starting');assert.notEqual(retry.body.lobby.matchId,oldMatch);
    const cancelled=await f.request('/api/end',{body:{}});assert.equal(cancelled.status,200);assert.ok(['waiting','full'].includes(cancelled.body.lobby.status));assert.equal(cancelled.body.lobby.matchId,null);assert.ok(cancelled.body.lobby.players.every(player=>!player.ready&&!player.synchronized));
  }finally{await f.server.close();}
});
