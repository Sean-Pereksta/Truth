// Run against the Firestore emulator, never the live database. An externally
// installed rules test runtime may be selected for a checkout without dev deps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.BANNERLANDS_FIREBASE_TEST_MODULES||new URL('../../package.json',import.meta.url));
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,setDoc,updateDoc,deleteDoc,getDoc,getDocs,query,orderBy,limit,serverTimestamp,Timestamp,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');
const fragment=await readFile(new URL('../../multiplayer/firebase-campaign-lobbies.rules',import.meta.url),'utf8');
const rules=process.env.BANNERLANDS_FIRESTORE_RULES?await readFile(process.env.BANNERLANDS_FIRESTORE_RULES,'utf8'):`rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n${fragment}\nmatch /{document=**} { allow read, write: if false; }\n}}`;
const [host,port]=(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8097').split(':');
const env=await initializeTestEnvironment({projectId:'demo-bannerlands-campaign-rules',firestore:{host,port:Number(port),rules}});
test.after(()=>env.cleanup());test.beforeEach(()=>env.clearFirestore());
const dbFor=uid=>uid?env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).firestore():env.unauthenticatedContext().firestore();
const ref=(db,owner='host-uid')=>doc(db,'bannerlandsCampaignLobbies',owner);
const data=(changes={})=>({schema:1,id:'campaign-1',ownerUid:'host-uid',name:'Northern campaign',hostName:'Sean',hostIdentity:'unverified display name',origin:'https://northern-campaign.trycloudflare.com',public:true,status:'waiting',mode:'conquest',map:'crownlands',scale:'epic',difficulty:'standard',fogOfWar:true,maxHumans:4,humans:1,availableSeats:3,aiHouses:4,v:1,gameVersion:'campaign-test-v1',assetVersion:'art-test-v1',updatedAt:serverTimestamp(),...changes});
const seed=async()=>assertSucceeds(setDoc(ref(dbFor('host-uid')),data()));

test('anonymous owner may publish, heartbeat, fill, start and delete its campaign',async()=>{
  const r=ref(dbFor('host-uid'));await seed();
  await assertSucceeds(updateDoc(r,{humans:4,availableSeats:0,status:'full',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(r,{status:'starting',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(r,{status:'in-progress',updatedAt:serverTimestamp()}));
  await assertSucceeds(deleteDoc(r));
});
test('large mode-permitted campaigns retain four humans plus twelve AI houses',async()=>{
  await assertSucceeds(setDoc(ref(dbFor('host-uid')),data({maxHumans:4,humans:1,availableSeats:3,aiHouses:12})));
  await assertFails(setDoc(ref(dbFor('host-uid')),data({maxHumans:5,humans:1,availableSeats:4,aiHouses:11})));
});
test('public discovery is bounded to the newest fifty listings',async()=>{
  await seed();const db=dbFor();const result=await assertSucceeds(getDocs(query(collection(db,'bannerlandsCampaignLobbies'),orderBy('updatedAt','desc'),limit(50))));assert.equal(result.size,1);
  await assertSucceeds(getDoc(ref(db)));await assertFails(getDocs(collection(db,'bannerlandsCampaignLobbies')));await assertFails(getDocs(query(collection(db,'bannerlandsCampaignLobbies'),limit(51))));
});
test('unauthenticated and other owners cannot alter, replace or delete a listing',async()=>{
  await seed();for(const uid of ['someone-else',null]){const r=ref(dbFor(uid));await assertFails(setDoc(r,data()));await assertFails(updateDoc(r,{name:'Hijacked',updatedAt:serverTimestamp()}));await assertFails(deleteDoc(r));}
  await assertFails(setDoc(ref(dbFor('host-uid'),'another-owner'),data()));
});
test('private player credentials, simulation data and unknown fields are denied',async()=>{
  for(const key of ['token','hostToken','guestToken','invite','password','units','config','players'])await assertFails(setDoc(ref(dbFor('host-uid')),data({[key]:'private'})));
});
test('only a token-free secure temporary host origin may be advertised',async()=>{
  for(const origin of ['http://northern-campaign.trycloudflare.com','https://evil.example','https://northern-campaign.trycloudflare.com.evil.example','https://northern-campaign.trycloudflare.com/#invite=secret','https://northern-campaign.trycloudflare.com?token=secret','https://user:password@northern-campaign.trycloudflare.com','https://northern-campaign.trycloudflare.com:9999','https://northern-campaign.trycloudflare.com/index.html'])await assertFails(setDoc(ref(dbFor('host-uid')),data({origin})));
});
test('malformed seat counts, private/closed records and client timestamps are denied',async()=>{
  for(const changes of [{schema:2},{v:99},{ownerUid:'other'},{name:''},{name:'x'.repeat(81)},{hostName:'x'.repeat(41)},{hostIdentity:'verified'},{public:false},{status:'closed'},{maxHumans:17},{humans:0},{humans:5},{availableSeats:4},{status:'full',availableSeats:1},{maxHumans:16,aiHouses:1},{aiHouses:-1},{mode:'invented'},{map:'invented'},{scale:'tiny'},{difficulty:'omniscient'},{fogOfWar:'false'},{updatedAt:Timestamp.fromMillis(1)}])await assertFails(setDoc(ref(dbFor('host-uid')),data(changes)));
});
test('the existing two-player prototype rules continue to accept their original schema',async()=>{
  if(!process.env.BANNERLANDS_FIRESTORE_RULES)return;
  const db=dbFor('prototype-host'),r=doc(db,'bannerlandsLobbies','prototype-host');
  await assertSucceeds(setDoc(r,{ownerUid:'prototype-host',name:'Prototype lobby',joinUrl:'https://prototype-host.trycloudflare.com/multiplayer/index.html',status:'waiting',players:1,maxPlayers:2,protocol:1,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(r,{hostToken:'private',updatedAt:serverTimestamp()}));
});
test('existing Basewar authentication rules and the default deny remain unchanged',async()=>{
  if(!process.env.BANNERLANDS_FIRESTORE_RULES)return;
  const db=dbFor('existing-game-player'),publicDb=dbFor(),r=doc(db,'games_basewar','compatibility-check');
  await assertSucceeds(setDoc(r,{compatibility:true}));await assertSucceeds(getDoc(r));await assertFails(getDoc(doc(publicDb,'games_basewar','compatibility-check')));await assertFails(setDoc(doc(publicDb,'games_basewar','public-write'),{compatibility:true}));await assertFails(setDoc(doc(db,'unrecognizedCollection','should-deny'),{value:1}));
});
