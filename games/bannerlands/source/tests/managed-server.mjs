import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createMatchServer} from '../multiplayer-server.mjs';
import {GAME_VERSION,ASSET_VERSION,PROTOCOL_VERSION} from '../../multiplayer/protocol.js';

const versions = {v:PROTOCOL_VERSION, gameVersion:GAME_VERSION, assetVersion:ASSET_VERSION};

// Exercise the real request handler while keeping native match tests independent
// of public tunnels and browser sockets.
async function request(match, route, {body, token} = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: body === undefined ? 'GET' : 'POST', url: route, socket:{remoteAddress:'127.0.0.1'},
    headers:{'content-type':'application/json', ...(token && {authorization:'Bearer '+token})},
  });
  const res = {
    writeHead(status) { this.status = status; this.headersSent = true; },
    end(bytes) { this.body = JSON.parse(bytes); },
  };
  await match.server.listeners('request')[0](req,res);
  return {status:res.status, ...res.body};
}

test('a managed campaign assigns a commander, supports partial starts, and reopens after victory, exit or abandonment', async t => {
  let time = Date.now();
  const match = await createMatchServer({managed:true, config:{enemies:3}, lobby:{name:'Stark Table',maxHumans:4,public:false}, simulation:false, clock:()=>time});
  t.after(()=>match.close());
  const join = (name,lobbyId=match.getLobby().id)=>request(match,'/api/join',{body:{...versions,name,lobbyId}});
  const action = (seat,path,body={})=>request(match,path,{token:seat.token,body});
  const initial = match.getLobby();
  assert.equal(initial.humans,0);
  assert.equal(initial.availableSeats,4);
  const [first,second]=await Promise.all([join('Arya'),join('Jon')]);
  assert.equal(first.host,true);assert.equal(second.host,false);
  assert.equal((await action(second,'/api/start',{revision:match.getLobby().revision})).status,403);
  assert.equal((await action(first,'/api/visibility',{public:true})).status,409);
  const revision = match.getLobby().revision;
  for(const seat of [first,second])assert.equal((await action(seat,'/api/ready',{ready:true,assetsReady:true,revision})).status,200);
  assert.equal((await action(first,'/api/start',{revision})).status,200);
  assert.equal((await join('Late')).status,409);
  const matchId=match.getLobby().matchId;
  for(const seat of [first,second]){
    const state=await request(match,'/api/state?initial=1',{token:seat.token});
    assert.equal((await action(seat,'/api/synchronized',{matchId,sequence:state.snapshot.sequence})).status,200);
  }
  assert.equal(match.getLobby().phase,'in-progress');
  match.game.winner=0;
  await request(match,'/api/lobby');
  time+=15001;
  const fresh = (await request(match,'/api/lobby')).lobby;
  assert.equal(fresh.phase,'waiting');assert.equal(fresh.humans,0);
  assert.equal(fresh.name,'Stark Table');assert.equal(fresh.public,false);assert.notEqual(fresh.id,initial.id);
  assert.equal((await request(match,'/api/state',{token:first.token})).status,401);
  assert.equal((await join('Stale',initial.id)).status,409);
  const next=await join('Sansa');assert.equal(next.host,true);
  assert.equal((await action(next,'/api/leave')).status,200);
  assert.equal(match.getLobby().availableSeats,4);
  const absent=await join('Bran');time+=90001;
  assert.equal((await request(match,'/api/lobby')).lobby.humans,0);
  assert.equal((await action(absent,'/api/close')).status,401);
});

