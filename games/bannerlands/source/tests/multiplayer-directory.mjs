import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseDirectory,publicLobbyRecord,filterLobbies,safeHostOrigin,parseGuestInvite,DIRECTORY_TTL_MS,DIRECTORY_HEARTBEAT_MS,DIRECTORY_POLL_MS,LOBBY_COLLECTION} from '../../multiplayer/directory.js';
import {createHostDirectoryPublisher} from '../hosting/firebase-directory.mjs';

const now=1_800_000_000_000;
const lobby=(changes={})=>({id:'campaign-1',ownerUid:'owner-1',name:'Northern campaign',hostName:'Sean',origin:'https://northern-campaign.trycloudflare.com',public:true,status:'waiting',mode:'conquest',map:'crownlands',config:{mode:'conquest',landscape:'crownlands',scale:'epic',difficulty:'standard',fogOfWar:true},maxHumans:4,humans:1,availableSeats:3,aiHouses:4,v:1,gameVersion:'test-v1',assetVersion:'art-v1',...changes});
const record=(changes={})=>publicLobbyRecord(lobby(changes),{now});

test('public metadata is explicitly allowlisted and never carries credentials or game state',()=>{
  const value=record({hostToken:'HOST_SECRET',token:'PLAYER_SECRET',invite:'INVITE_SECRET',players:[{token:'SEAT_SECRET'}],units:[{hidden:true}],config:{mode:'conquest',landscape:'crownlands',scale:'epic',difficulty:'standard',fogOfWar:true,token:'CONFIG_SECRET'}});
  const serialized=JSON.stringify(value);for(const forbidden of ['SECRET','hidden','units','players'])assert.ok(!serialized.includes(forbidden));
  assert.equal(value.hostIdentity,'unverified display name');assert.equal(value.expiresAt,now+DIRECTORY_TTL_MS);
});

test('discovery excludes expired, private, closed, full, starting, playing and incompatible lobbies',()=>{
  const records=[record(),record({id:'full',availableSeats:0,status:'full'}),record({id:'private',public:false}),record({id:'closed',status:'closed'}),record({id:'old'}),record({id:'future'}),record({id:'wrong-version',gameVersion:'different'}),record({id:'starting',status:'starting'}),record({id:'playing',status:'in-progress'})];
  records[4].heartbeatAt=now-DIRECTORY_TTL_MS-1;records[5].heartbeatAt=now+30_001;
  assert.deepEqual(filterLobbies(records,{now,gameVersion:'test-v1',assetVersion:'art-v1',v:1}).map(x=>x.id),['campaign-1']);
  assert.equal(filterLobbies(records,{now,includeUnavailable:true}).length,5);
});

test('Firestore server timestamps govern freshness and document identity cannot be forged',()=>{
  const value=record();delete value.heartbeatAt;delete value.expiresAt;value.updatedAt={toMillis:()=>now};value.directoryId='owner-1';
  assert.equal(filterLobbies([value],{now}).length,1);assert.equal(filterLobbies([{...value,directoryId:'other-owner'}],{now}).length,0);
  assert.equal(filterLobbies([{...value,updatedAt:{toMillis:()=>now-DIRECTORY_TTL_MS-1}}],{now}).length,0);
});

test('invitations reject host-control fragments, credentials and unsafe origins',()=>{
  const valid='https://northern-campaign.trycloudflare.com/#invite=abcdefghijklmnop';assert.deepEqual(parseGuestInvite(valid),{origin:'https://northern-campaign.trycloudflare.com',invite:'abcdefghijklmnop'});
  for(const invalid of ['http://example.com','https://127.0.0.1/','https://host.local/','https://user:password@example.com/','https://example.com/#hostToken=abcdefghijklmnop','https://example.com/?hostToken=abcdefghijklmnop#invite=abcdefghijklmnop','https://example.com/#invite=short','https://example.com/private'])assert.throws(()=>parseGuestInvite(invalid));
  assert.equal(safeHostOrigin('http://127.0.0.1:4173',{allowLocalOrigins:true}),'http://127.0.0.1:4173');
});

function fixture({delayAuth=false}={}){
  let clock=now,resolveAuth;const stored=new Map(),writes=[],timers=new Map();let nextTimer=0;
  const authentication=delayAuth?new Promise(resolve=>{resolveAuth=resolve;}):Promise.resolve();
  const sdk={app:{getApps:()=>[],initializeApp:()=>({})},auth:{getAuth:()=>({currentUser:{uid:'owner-1'},authStateReady:()=>authentication})},firestore:{getFirestore:()=>({}),doc:(_,collection,id)=>({collection,id}),collection:(_,collection)=>({collection}),orderBy:(field,direction)=>({field,direction}),limit:value=>({limit:value}),query:(...args)=>args,serverTimestamp:()=>{const at=clock;return {toMillis:()=>at};},setDoc:async(ref,data)=>{writes.push({type:'write',ref,data});stored.set(ref.id,data);},deleteDoc:async ref=>{writes.push({type:'delete',ref});stored.delete(ref.id);},getDocs:async query=>({docs:[...stored].map(([id,data])=>({id,data:()=>data})),query})}};
  const directory=createFirebaseDirectory({loader:async()=>sdk,now:()=>clock,schedule:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},unschedule:id=>timers.delete(id)});
  return {directory,writes,timers,stored,sdk,setTime:value=>{clock=value;},resolveAuth:()=>resolveAuth?.()};
}

test('adapter preserves one owner document, bounds read/write frequency and records usage',async()=>{
  const f=fixture();await f.directory.publish(lobby());assert.equal(f.writes[0].ref.collection,LOBBY_COLLECTION);assert.equal(f.writes[0].ref.id,'owner-1');assert.equal(f.writes[0].data.updatedAt.toMillis(),now);
  for(let n=0;n<10;n++)await f.directory.heartbeat(lobby());assert.equal(f.writes.length,1);
  f.setTime(now+DIRECTORY_HEARTBEAT_MS);await f.directory.heartbeat(lobby({humans:2,availableSeats:2}));assert.equal(f.writes.length,2);
  const first=await f.directory.list();assert.equal(first.length,1);for(let n=0;n<10;n++)await f.directory.list();assert.equal(f.directory.usage().readQueries,1);
  f.setTime(now+DIRECTORY_HEARTBEAT_MS+DIRECTORY_POLL_MS);await f.directory.list();assert.equal(f.directory.usage().readQueries,2);assert.equal(f.directory.usage().documentReads,2);
  await f.directory.remove();assert.equal(f.stored.size,0);assert.equal(f.directory.usage().deletes,1);assert.ok(f.directory.usage().estimatedPayloadBytes>0);
});

test('removal wins an in-flight anonymous sign-in and cannot resurrect a listing',async()=>{
  const f=fixture({delayAuth:true}),publishing=f.directory.publish(lobby());await Promise.resolve();await f.directory.remove();f.resolveAuth();await publishing;
  assert.equal(f.writes.length,0);assert.equal(f.stored.size,0);
});
test('public browsing does not create an anonymous Firebase account',async()=>{
  const f=fixture();let authCalls=0;f.sdk.auth.getAuth=()=>{authCalls++;throw new Error('Browsing must not request authentication.');};
  assert.deepEqual(await f.directory.list(),[]);assert.equal(authCalls,0);assert.equal(f.directory.usage().readQueries,1);await f.directory.close();
});
test('a stalled directory connection returns an actionable bounded failure',async()=>{
  const directory=createFirebaseDirectory({loader:()=>new Promise(()=>{}),requestTimeoutMs:20});await assert.rejects(directory.list(),/timed out.*guest invitation/i);assert.equal(directory.usage().errors,1);await directory.close();
});

test('watch locally hides stale hosts even without a Firebase change',async()=>{
  const f=fixture();await f.directory.publish(lobby());const seen=[];const stop=f.directory.watch(value=>seen.push(value));await new Promise(resolve=>setImmediate(resolve));assert.equal(seen.at(-1).length,1);
  f.setTime(now+DIRECTORY_TTL_MS+1);[...f.timers.values()].find(t=>t.ms===5_000).fn();assert.equal(seen.at(-1).length,0);stop();assert.equal(f.timers.size,0);
});

test('Node host publisher uses private anonymous auth and server-time transforms without publishing credentials',async()=>{
  const calls=[];let clock=now;
  const publisher=createHostDirectoryPublisher({now:()=>clock,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(url.includes('accounts:signUp')?{idToken:'PRIVATE_ID_TOKEN',refreshToken:'PRIVATE_REFRESH_TOKEN',localId:'owner-1',expiresIn:'3600'}:{})};}});
  await publisher.publish(lobby({hostToken:'HOST_SECRET',token:'SEAT_SECRET',invite:'INVITE_SECRET'}));assert.equal(calls.length,2);
  const commit=JSON.parse(calls[1].options.body);assert.ok(calls[1].url.endsWith('/documents:commit'));assert.equal(commit.writes[0].updateTransforms[0].setToServerValue,'REQUEST_TIME');assert.equal(commit.writes[0].update.fields.ownerUid.stringValue,'owner-1');assert.equal(calls[1].options.headers.Authorization,'Bearer PRIVATE_ID_TOKEN');
  assert.ok(!calls[1].options.body.includes('SECRET'));assert.ok(!calls[1].options.body.includes('PRIVATE'));
  await publisher.heartbeat(lobby());assert.equal(calls.length,2);clock+=DIRECTORY_HEARTBEAT_MS;await publisher.heartbeat(lobby());assert.equal(calls.length,3);
  await publisher.remove('campaign-1');assert.equal(calls.at(-1).options.method,'DELETE');assert.equal(publisher.usage().writes,2);assert.equal(publisher.usage().deletes,1);
});

test('Node host removal cancels delayed publication before a listing is written',async()=>{
  let release;const requests=[];const gate=new Promise(resolve=>{release=resolve;});
  const publisher=createHostDirectoryPublisher({fetchImpl:async(url,options)=>{requests.push({url,options});await gate;return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({idToken:'PRIVATE',refreshToken:'PRIVATE',localId:'owner-1',expiresIn:'3600'})};}});
  const publishing=publisher.publish(lobby());await Promise.resolve();const removing=publisher.remove();release();await Promise.all([publishing,removing]);assert.equal(requests.length,1);assert.equal(publisher.usage().writes,0);
});
test('long-running hosts refresh with the documented form encoding and recover a failed refresh',async()=>{
  let clock=now,failRefresh=true;const calls=[];
  const publisher=createHostDirectoryPublisher({now:()=>clock,fetchImpl:async(url,options)=>{
    calls.push({url,options});const refresh=url.includes('securetoken.googleapis.com');
    if(refresh&&failRefresh){failRefresh=false;return {ok:false,status:503,headers:{get:()=>null},text:async()=>JSON.stringify({error:{message:'UNAVAILABLE'}})};}
    return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(url.includes('accounts:signUp')?{idToken:'FIRST_PRIVATE',refreshToken:'REFRESH+/= private',localId:'owner-1',expiresIn:'3600'}:refresh?{id_token:'SECOND_PRIVATE',refresh_token:'ROTATED_PRIVATE',user_id:'owner-1',expires_in:'3600'}:{})};
  }});
  await publisher.publish(lobby());clock+=3_541_000;await assert.rejects(publisher.heartbeat(lobby()),/unavailable/i);assert.equal(publisher.usage().writes,1);
  await publisher.heartbeat(lobby());const refreshes=calls.filter(call=>call.url.includes('securetoken.googleapis.com'));assert.equal(refreshes.length,2);
  for(const call of refreshes){assert.equal(call.options.headers['Content-Type'],'application/x-www-form-urlencoded');const body=new URLSearchParams(call.options.body);assert.equal(body.get('grant_type'),'refresh_token');assert.equal(body.get('refresh_token'),'REFRESH+/= private');}
  const lastWrite=calls.filter(call=>call.url.endsWith('/documents:commit')).at(-1);assert.equal(lastWrite.options.headers.Authorization,'Bearer SECOND_PRIVATE');assert.equal(JSON.parse(lastWrite.options.body).writes[0].update.fields.ownerUid.stringValue,'owner-1');assert.ok(!lastWrite.options.body.includes('PRIVATE'));assert.equal(publisher.usage().authRequests,3);assert.equal(publisher.usage().errors,1);await publisher.remove();
});
