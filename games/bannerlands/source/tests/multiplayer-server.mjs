import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMatchServer} from '../multiplayer-server.mjs';
import {COMPATIBILITY} from '../../multiplayer/protocol.js';
import {applySnapshotDelta} from '../../multiplayer/transport-delta.js';

async function fixture(options={}){
  const server=await createMatchServer({config:{enemies:1,scale:'standard',landscape:'open',seed:44277},lobby:{public:true,maxHumans:2},simulation:false,...options});
  const request=async(route,{token,body,method=body?'POST':'GET',headers={}}={})=>{
    const response=await fetch(server.url+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    const text=await response.text();return {status:response.status,headers:response.headers,body:text?JSON.parse(text):null};
  };
  return {server,request,host:server.hostToken,close:()=>server.close()};
}
const join=(request,extra={})=>request('/api/join',{body:{...COMPATIBILITY,name:'Guest',...extra}});
async function readyAll(f,guest){const record=(await f.request('/api/lobby')).body.lobby;for(const token of [f.host,guest])assert.equal((await f.request('/api/ready',{token,body:{ready:true,assetsReady:true,revision:record.revision}})).status,200);return record.revision;}
async function synchronizeAll(f,tokens){for(const token of [f.host,...tokens]){const state=(await f.request('/api/state?initial=1',{token})).body;assert.equal((await f.request('/api/synchronized',{token,body:{matchId:state.lobby.matchId,sequence:state.snapshot.sequence}})).status,200);}assert.equal(f.server.getLobby().status,'in-progress');}

test('last seat is atomic; directory/lobby never contain control credentials',async()=>{
  const f=await fixture();try{
    const results=await Promise.all([join(f.request),join(f.request)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const accepted=results.find(r=>r.status===201).body;assert.equal(accepted.team,1);
    const publicRecord=JSON.stringify((await f.request('/api/lobby')).body);for(const value of [f.host,f.server.invite,accepted.token])assert.ok(!publicRecord.includes(value));
    assert.equal((await f.request('/api/start',{token:accepted.token,body:{revision:2}})).status,403);
    assert.equal((await f.request('/api/host/session',{token:accepted.token,body:{}})).status,403);
  }finally{await f.close();}
});
test('private invite reserves a fresh private session and rejects mismatched versions',async()=>{
  const f=await fixture({lobby:{public:false,maxHumans:2}});try{
    assert.equal((await join(f.request)).status,403);
    assert.equal((await join(f.request,{invite:f.server.invite,gameVersion:'old'})).status,409);
    const response=await join(f.request,{invite:f.server.invite});assert.equal(response.status,201);assert.notEqual(response.body.token,f.server.invite);assert.notEqual(response.body.token,f.host);
    assert.equal((await f.request('/api/state',{token:response.body.token})).body.session.team,1);
  }finally{await f.close();}
});
test('ready and connectivity transitions invalidate ETags; changed settings require fresh consent',async()=>{
  let now=100000;const f=await fixture({clock:()=>now});try{
    const guest=(await join(f.request)).body.token;
    const initial=await f.request('/api/state',{token:f.host});const revision=initial.body.lobby.revision;
    assert.equal((await f.request('/api/ready',{token:guest,body:{ready:true,assetsReady:true,revision}})).status,200);
    const after=await f.request('/api/state',{token:f.host,headers:{'If-None-Match':initial.headers.get('etag')}});assert.equal(after.status,200);assert.equal(after.body.lobby.players.find(p=>!p.host).ready,true);
    assert.equal((await f.request('/api/config',{token:f.host,body:{config:{fogOfWar:true}}})).status,200);
    assert.equal((await f.request('/api/ready',{token:guest,body:{ready:true,assetsReady:true,revision}})).status,409);
    const newState=await f.request('/api/state',{token:f.host});now+=20000;const disconnected=await f.request('/api/state',{token:f.host,headers:{'If-None-Match':newState.headers.get('etag')}});assert.equal(disconnected.status,200);assert.equal(disconnected.body.lobby.players.find(p=>!p.host).connected,false);
  }finally{await f.close();}
});
test('initial synchronization, delta recovery, exactly-once actions and reconnect identity',async()=>{
  const f=await fixture();try{
    const guest=(await join(f.request)).body.token,revision=await readyAll(f,guest);
    assert.equal((await f.request('/api/start',{token:f.host,body:{revision}})).status,200);
    await synchronizeAll(f,[guest]);
    const first=(await f.request('/api/state?initial=1',{token:guest})).body;assert.ok(first.snapshot.terrain);assert.equal(first.session.team,1);
    const troop=f.server.game.units.find(u=>u.team===1),command={v:1,matchId:f.server.getLobby().matchId,seq:1,type:'hold',args:[[troop.id]]};
    const response=await f.request('/api/command',{token:guest,body:command});assert.equal(response.status,200);
    const duplicate=await f.request('/api/command',{token:guest,body:command});assert.equal(duplicate.body.duplicate,true);
    const next=(await f.request('/api/state?since='+first.snapshot.sequence,{token:guest})).body;assert.ok(next.delta);const merged=applySnapshotDelta(first.snapshot,next.delta);assert.equal(merged.commandSeq,1);assert.equal(next.session.id,first.session.id);
    const missing=(await f.request('/api/state?since=-1',{token:guest})).body;assert.ok(missing.snapshot.terrain);
    const rejection=await f.request('/api/command',{token:guest,body:{v:1,matchId:f.server.getLobby().matchId,seq:2,type:'command',args:[[troop.id],-999,0,'move']}});assert.equal(rejection.body.ok,false);assert.equal(rejection.body.seq,2);
    assert.equal((await f.request('/api/state',{token:guest})).body.session.lastSeq,2);
    assert.equal((await f.request('/api/command',{token:guest,body:{v:1,matchId:f.server.getLobby().matchId,seq:3,type:'hold',args:[[troop.id]]}})).status,200);
    const oldMatch=f.server.getLobby().matchId;assert.equal((await f.request('/api/end',{token:f.host,body:{}})).status,200);const nextRevision=await readyAll(f,guest);await f.request('/api/start',{token:f.host,body:{revision:nextRevision}});await synchronizeAll(f,[guest]);assert.notEqual(f.server.getLobby().matchId,oldMatch);
    const stale=await f.request('/api/command',{token:guest,body:{...command,matchId:oldMatch,seq:1}});assert.equal(stale.status,409);assert.equal(stale.body.code,'match');assert.equal((await f.request('/api/state',{token:guest})).body.session.lastSeq,0);
    const current=await f.request('/api/command',{token:guest,body:{...command,matchId:f.server.getLobby().matchId,seq:1}});assert.equal(current.status,200);
  }finally{await f.close();}
});
test('abandoned waiting reservations expire; running houses remain reserved',async()=>{
  let now=1000;const f=await fixture({clock:()=>now});try{
    const oldGuest=(await join(f.request)).body.token;now+=91000;await f.request('/api/state',{token:f.host});const guest=(await join(f.request)).body.token;assert.notEqual(guest,oldGuest);assert.equal((await f.request('/api/state',{token:oldGuest})).status,401);
    const revision=await readyAll(f,guest);await f.request('/api/start',{token:f.host,body:{revision}});await synchronizeAll(f,[guest]);now+=100000;assert.equal((await f.request('/api/state',{token:guest})).body.session.team,1);assert.equal((await join(f.request)).status,409);
  }finally{await f.close();}
});
test('only intended game files are served and malformed requests are bounded',async()=>{
  const f=await fixture();try{
    for(const route of ['/source/multiplayer-server.mjs','/source/hosting/licenses/Node-LICENSE.txt','/package.json','/multiplayer/../source/tests/menu.mjs','/%2e%2e/package.json'])assert.equal((await f.request(route)).status,404,route);
    assert.equal((await fetch(f.server.url+'/core.js')).status,200);
    const oversized=await fetch(f.server.url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(40000)})});assert.equal(oversized.status,413);
    const invalid=await fetch(f.server.url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(invalid.status,400);
    const noJson=await fetch(f.server.url+'/api/join',{method:'POST',body:'{}'});assert.equal(noJson.status,415);
  }finally{await f.close();}
});
test('directory publishes only after verified reachability, closes and republishes safely',async()=>{
  const operations=[];const publisher={publish:async record=>operations.push(['publish',record]),heartbeat:async record=>operations.push(['heartbeat',record]),remove:async id=>operations.push(['remove',id])};
  const f=await fixture({publisher});try{
    assert.equal(operations.length,0);await f.server.setPublicAddress('https://test-bannerlands.trycloudflare.com');assert.equal(operations.at(-1)[0],'publish');
    const guest=(await join(f.request)).body.token;await f.server.flushDirectory();assert.equal(operations.at(-1)[0],'remove');await f.request('/api/leave',{token:guest,body:{}});await f.server.flushDirectory();assert.equal(operations.at(-1)[0],'publish');
    const published=JSON.stringify(operations);assert.ok(!published.includes(f.host));assert.ok(!published.includes(f.server.invite));assert.ok(!published.includes(guest));
  }finally{await f.close();}assert.equal(operations.at(-1)[0],'remove');
});
test('unrecognized bearer values cannot bypass per-address admission limits',async()=>{
  const f=await fixture({clock:()=>1000});try{
    const results=await Promise.all(Array.from({length:55},(_,index)=>f.request('/api/state',{token:'random-credential-000000000000'+index})));
    assert.equal(results.filter(result=>result.status===401).length,45);assert.equal(results.filter(result=>result.status===429).length,10);
    assert.equal((await f.request('/api/state',{token:f.host})).status,200);
  }finally{await f.close();}
});
test('installed host closes online service while keeping single-player and a new lobby usable',async()=>{
  let stopped=0,touched=0;const desktop={secret:'desktop-private-capability-000000000',touch:()=>{touched++;},status:()=>({stage:'idle'}),host:async instance=>({url:instance.url,hostToken:instance.hostToken,invite:instance.invite}),stop:async instance=>{stopped++;await instance.setReachable(false);}};
  const f=await fixture({desktop});try{
    const guest=(await join(f.request)).body.token,oldInvite=f.server.invite;
    assert.equal((await f.request('/api/desktop/status')).status,401);
    assert.equal(touched,0);await f.request('/api/state',{token:guest});assert.equal(touched,0);
    assert.equal((await f.request('/api/desktop/status',{token:desktop.secret})).status,200);
    assert.equal(touched,1);
    await f.request('/api/close',{token:f.host,body:{}});assert.equal(stopped,1);assert.notEqual(f.server.invite,oldInvite);
    assert.equal((await f.request('/api/state',{token:guest})).status,401);assert.equal(f.server.getLobby().players.length,1);assert.equal(f.server.getLobby().public,false);
    assert.equal((await fetch(f.server.url+'/')).status,200);assert.equal((await f.request('/api/desktop/host',{token:desktop.secret,body:{config:{enemies:3},lobby:{maxHumans:4}}})).status,200);
  }finally{await f.close();}
});
test('four humans coexist with twelve AI houses; start never fills an empty human seat with AI',async()=>{
  const f=await fixture({config:{enemies:15,scale:'standard',landscape:'open'},lobby:{public:true,maxHumans:4}});try{
    assert.equal(f.server.getLobby().houses.length,16);assert.equal(f.server.getLobby().aiHouses,12);
    const guests=[];for(let i=0;i<2;i++)guests.push((await join(f.request)).body.token);
    const lobby=f.server.getLobby();for(const token of [f.host,...guests])await f.request('/api/ready',{token,body:{ready:true,assetsReady:true,revision:lobby.revision}});
    assert.equal((await f.request('/api/start',{token:f.host,body:{revision:lobby.revision}})).body.code,'empty-seats');
    assert.equal((await f.request('/api/config',{token:f.host,body:{maxHumans:5}})).status,400);
    guests.push((await join(f.request)).body.token);const filled=f.server.getLobby();for(const token of [f.host,...guests])await f.request('/api/ready',{token,body:{ready:true,assetsReady:true,revision:filled.revision}});
    assert.equal((await f.request('/api/start',{token:f.host,body:{revision:filled.revision}})).status,200);assert.deepEqual([...f.server.game.humanTeams].sort(),[0,1,2,3]);
  }finally{await f.close();}
});
test('a lost response reuses recent delta history and older baselines receive full synchronization',async()=>{
  const f=await fixture();try{
    const guest=(await join(f.request)).body.token,revision=await readyAll(f,guest);await f.request('/api/start',{token:f.host,body:{revision}});await synchronizeAll(f,[guest]);
    const first=(await f.request('/api/state?initial=1',{token:guest})).body.snapshot,troop=f.server.game.units.find(unit=>unit.team===1),matchId=f.server.getLobby().matchId;
    await f.request('/api/command',{token:guest,body:{v:1,matchId,seq:1,type:'hold',args:[[troop.id]]}});
    const lost=(await f.request('/api/state?since='+first.sequence,{token:guest})).body;assert.ok(lost.delta);
    const recovered=(await f.request('/api/state?since='+first.sequence,{token:guest})).body;assert.ok(recovered.delta);assert.equal(recovered.delta.base,first.sequence);assert.equal(recovered.delta.sequence,lost.delta.sequence);
    let acknowledged=recovered.delta.sequence;
    for(let seq=2;seq<=6;seq++){await f.request('/api/command',{token:guest,body:{v:1,matchId,seq,type:'hold',args:[[troop.id]]}});const next=(await f.request('/api/state?since='+acknowledged,{token:guest})).body;assert.ok(next.delta);acknowledged=next.delta.sequence;}
    const expired=(await f.request('/api/state?since='+first.sequence,{token:guest})).body;assert.ok(expired.snapshot.terrain);
  }finally{await f.close();}
});
test('world synchronization holds simulation, requires delivered snapshot acknowledgement, and times out clearly',async()=>{
  let now=1000;const f=await fixture({clock:()=>now});try{
    const guest=(await join(f.request)).body.token,revision=await readyAll(f,guest);await f.request('/api/start',{token:f.host,body:{revision}});assert.equal(f.server.getLobby().status,'starting');assert.equal(f.server.game.time,0);
    const matchId=f.server.getLobby().matchId;assert.equal((await f.request('/api/synchronized',{token:guest,body:{matchId,sequence:1}})).status,409);
    const hostState=(await f.request('/api/state?initial=1',{token:f.host})).body;await f.request('/api/synchronized',{token:f.host,body:{matchId,sequence:hostState.snapshot.sequence}});assert.equal(f.server.getLobby().status,'starting');assert.equal(f.server.game.time,0);
    now+=45001;const timeout=(await f.request('/api/state',{token:guest})).body;assert.equal(timeout.lobby.phase,'waiting');assert.equal(timeout.lobby.matchId,null);assert.equal(timeout.snapshot,null);assert.match(timeout.lobby.error,/finish loading/);assert.ok(timeout.lobby.players.every(player=>!player.ready&&!player.synchronized));
    const retryRevision=await readyAll(f,guest);await f.request('/api/start',{token:f.host,body:{revision:retryRevision}});await synchronizeAll(f,[guest]);
  }finally{await f.close();}
});
test('fog lobby records do not disclose the private campaign seed',async()=>{
  const f=await fixture({config:{enemies:1,scale:'standard',landscape:'open',fogOfWar:true,seed:127448113}});try{
    const publicRecord=(await f.request('/api/lobby')).body.lobby;assert.equal(Object.hasOwn(publicRecord.config,'seed'),false);assert.equal(f.server.game.config.seed,127448113);
    const guest=(await join(f.request)).body;assert.equal(Object.hasOwn(guest.lobby.config,'seed'),false);const state=(await f.request('/api/state',{token:guest.token})).body;assert.equal(Object.hasOwn(state.lobby.config,'seed'),false);
  }finally{await f.close();}
});
test('asynchronous directory errors, recovery and reachability changes invalidate lobby ETags',async()=>{
  let fail=false;const publish=async()=>{if(fail)throw new Error('temporary directory failure');};const f=await fixture({publisher:{publish,heartbeat:publish,remove:async()=>{}}});try{
    await f.server.setPublicAddress('https://metadata-test.trycloudflare.com');const first=await f.request('/api/state',{token:f.host});fail=true;await f.server.setPublicAddress('https://metadata-test.trycloudflare.com');const failed=await f.request('/api/state',{token:f.host,headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(failed.status,200);assert.ok(failed.body.lobby.directoryError);
    fail=false;await f.server.setPublicAddress('https://metadata-test.trycloudflare.com');const recovered=await f.request('/api/state',{token:f.host,headers:{'If-None-Match':failed.headers.get('etag')}});assert.equal(recovered.status,200);assert.equal(recovered.body.lobby.directoryError,null);
    await f.server.setReachable(false);const disconnected=await f.request('/api/state',{token:f.host,headers:{'If-None-Match':recovered.headers.get('etag')}});assert.equal(disconnected.status,200);assert.equal(disconnected.body.lobby.reachable,false);
    const options=await f.request('/api/ready',{method:'OPTIONS'});assert.equal(options.status,204);assert.match(options.headers.get('access-control-allow-headers'),/Authorization,Content-Type,If-None-Match/);
  }finally{await f.close();}
});
