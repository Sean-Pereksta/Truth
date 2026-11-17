import {firebaseConfig} from './firebase-config.js';
// Discovery metadata only. Battle traffic and seat ownership belong to the host.
export const FIREBASE_PROJECT_ID='bible-game-246c0';
export const DIRECTORY_SCHEMA=1;
export const DIRECTORY_TTL_MS=90_000;
export const DIRECTORY_HEARTBEAT_MS=30_000;
export const DIRECTORY_POLL_MS=30_000;
export const LOBBY_COLLECTION='bannerlandsCampaignLobbies';
const MAX_RECORD_BYTES=4096,MAX_LOBBIES=50;
const STATUSES=new Set(['waiting','full','starting','in-progress','closed']);
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const text=(value,max,fallback='')=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):fallback;
const count=(value,max=16)=>Number.isInteger(value)&&value>=0&&value<=max?value:0;

export function safeHostOrigin(value,{allowLocalOrigins=false}={}){
  let url;try{url=new URL(value);}catch{throw new Error('The match address is invalid.');}
  const local=url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]';
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(!local&&url.port)||!(url.protocol==='https:'||allowLocalOrigins&&local&&url.protocol==='http:'))throw new Error('Use the secure match address supplied by the host.');
  if(!local&&(/(^|\.)(localhost|local|internal|invalid|test)$/.test(url.hostname)||/^\[/.test(url.hostname)||/^[\d.]+$/.test(url.hostname)||!url.hostname.includes('.')))throw new Error('The match needs a public internet address.');
  if(local&&!allowLocalOrigins)throw new Error('A local address cannot be listed publicly.');
  return url.origin;
}

export function parseGuestInvite(value,{allowLocalOrigins=false}={}){
  let url;try{url=new URL(String(value).trim());}catch{throw new Error('Paste the complete invitation link supplied by the host.');}
  if(url.pathname!=='/'&&url.pathname!=='/index.html')throw new Error('That link is not a Bannerlands invitation.');
  if(url.username||url.password||url.search)throw new Error('Use a guest invitation without host-control credentials or extra query parameters.');
  // Private guest invitations are fragments; they are never sent to the directory.
  const fragment=new URLSearchParams(url.hash.slice(1)),invite=fragment.get('invite');
  if(invite!==null&&!/^[A-Za-z0-9_-]{16,256}$/.test(invite))throw new Error('The invitation code is invalid.');
  const allowed=new Set(['invite','join']);for(const name of fragment.keys())if(!allowed.has(name))throw new Error('Use a guest invitation, not a host-control link.');
  url.hash='';url.search='';url.pathname='/';
  return {origin:safeHostOrigin(url.href,{allowLocalOrigins}),...(invite?{invite}:{})};
}

export function publicLobbyRecord(input,{now=Date.now(),ownerUid=input?.ownerUid,allowLocalOrigins=false}={}){
  if(!input||typeof input!=='object'||!key(input.id))throw new Error('The lobby identifier is invalid.');
  if(!key(ownerUid))throw new Error('The directory publisher must have a Firebase user identity.');
  const status=STATUSES.has(input.status)?input.status:'closed';
  const maxHumans=count(input.maxHumans??input.humanCapacity,4),humans=count(input.humans??(Array.isArray(input.players)?input.players.length:input.players),4);
  if(maxHumans<1||humans<1||humans>maxHumans)throw new Error('The human seat count is invalid.');
  const availableSeats=Math.min(maxHumans-humans,count(input.availableSeats??input.seatsAvailable??maxHumans-humans));
  const config=input.config||{};
  const record={schema:DIRECTORY_SCHEMA,id:input.id,ownerUid,name:text(input.name,80,'Bannerlands campaign')||'Bannerlands campaign',hostName:text(input.hostName,40,'Host')||'Host',hostIdentity:'unverified display name',origin:safeHostOrigin(input.origin,{allowLocalOrigins}),public:input.public===true,status,mode:text(input.mode??config.mode,40),map:text(input.map??config.landscape,40),scale:text(config.scale??input.scale,20),difficulty:text(config.difficulty??input.difficulty,20),fogOfWar:(config.fogOfWar??input.fogOfWar)===true,maxHumans,humans,availableSeats,aiHouses:count(input.aiHouses,15),v:input.v??input.protocolVersion,gameVersion:text(input.gameVersion,64),assetVersion:text(input.assetVersion,64),heartbeatAt:now,expiresAt:now+DIRECTORY_TTL_MS};
  if(record.maxHumans+record.aiHouses>16)throw new Error('A campaign supports at most sixteen houses.');
  if(!Number.isSafeInteger(record.v)||record.v<1||!record.gameVersion||!record.assetVersion)throw new Error('The lobby must identify compatible game, asset and protocol versions.');
  if(new TextEncoder().encode(JSON.stringify(record)).length>MAX_RECORD_BYTES)throw new Error('The public lobby record is too large.');
  return record;
}

export function filterLobbies(records,{now=Date.now(),gameVersion,assetVersion,protocolVersion,v=protocolVersion,includeUnavailable=false,allowLocalOrigins=false}={}){
  const items=Array.isArray(records)?records:Object.values(records||{}),result=[];
  for(const raw of items.slice(0,MAX_LOBBIES)){
    try{
      const updatedAt=typeof raw?.updatedAt?.toMillis==='function'?raw.updatedAt.toMillis():raw?.heartbeatAt;
      if(raw?.schema!==DIRECTORY_SCHEMA||raw.public!==true||!Number.isSafeInteger(updatedAt)||updatedAt>now+30_000||now-updatedAt>DIRECTORY_TTL_MS||raw.directoryId&&raw.directoryId!==raw.ownerUid)continue;
      const item=publicLobbyRecord(raw,{now:updatedAt,ownerUid:raw.ownerUid,allowLocalOrigins});
      if(item.status==='closed')continue;
      item.compatible=(!gameVersion||item.gameVersion===gameVersion)&&(!assetVersion||item.assetVersion===assetVersion)&&(v==null||item.v===v);
      item.joinable=item.compatible&&item.status==='waiting'&&item.availableSeats>0;
      if(!includeUnavailable&&!item.joinable)continue;
      result.push(item);
    }catch{/* Treat all public directory input as untrusted. */}
  }
  return result.sort((a,b)=>b.heartbeatAt-a.heartbeatAt||a.id.localeCompare(b.id));
}

async function loadFirebase(){
  const [app,auth,firestore]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
  ]);
  return {app,auth,firestore};
}

async function readPublicLobbies(fetchImpl,signal){
  const endpoint=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  try{
    const response=await fetchImpl(endpoint,{
      method:'POST',credentials:'omit',signal,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({structuredQuery:{from:[{collectionId:LOBBY_COLLECTION}],orderBy:[{field:{fieldPath:'updatedAt'},direction:'DESCENDING'}],limit:MAX_LOBBIES}})
    });
    if(!response.ok)throw new Error(`Firestore returned HTTP ${response.status}.`);
    const rows=await response.json();
    return rows.slice(0,MAX_LOBBIES).flatMap(({document})=>{
      const directoryId=document?.name?.split('/').at(-1);
      if(!key(directoryId)||!document.fields)return [];
      const fields=Object.fromEntries(Object.entries(document.fields).map(([name,value])=>[
        name,value?.stringValue??value?.booleanValue??(value?.integerValue==null?undefined:Number(value.integerValue))
      ]));
      return [{...fields,directoryId,heartbeatAt:Date.parse(document.fields.updatedAt?.timestampValue)}];
    });
  }catch(error){
    throw new Error('Lobby discovery is unavailable. You can still join by invitation.',{cause:error});
  }
}

// Same Firebase project/auth foundation as the prototype; a separate collection
// keeps its strict two-player records and existing deployed rules untouched.
export function createFirebaseDirectory({loader=loadFirebase,fetchImpl=globalThis.fetch,now=Date.now,schedule=setInterval,unschedule=clearInterval,onUsage=()=>{},allowLocalOrigins=false,requestTimeoutMs=12_000}={}){
  const metrics={readQueries:0,documentReads:0,writes:0,deletes:0,estimatedPayloadBytes:0,errors:0};
  let sdk,db,uid,connecting=null,authConnecting=null,cached=[],lastRead=-Infinity,reading=null,writeChain=Promise.resolve(),current=null,revision=0,heartbeatTimer=null,pollTimer=null,expiryTimer=null,closed=false,lastWrite=-Infinity;
  const report=()=>onUsage({...metrics});
  const size=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  const bounded=promise=>{let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The lobby directory timed out. Try again or use a guest invitation.')),requestTimeoutMs);})]).finally(()=>clearTimeout(timer));};
  const ref=()=>sdk.firestore.doc(db,LOBBY_COLLECTION,uid);
  const enqueue=action=>{const next=writeChain.then(action);writeChain=next.catch(()=>{});return next;};
  const counted=async action=>{try{return await action();}catch(error){metrics.errors++;throw error;}finally{report();}};
  async function connect({publisher=false}={}){
    if(closed)throw new Error('The lobby directory has closed.');
    if(!connecting)connecting=(async()=>{
      sdk=await bounded(loader());
      const app=sdk.app.getApps().find(a=>a.options.projectId===firebaseConfig.projectId)||sdk.app.initializeApp(firebaseConfig,'bannerlands-campaign-directory');
      db=sdk.firestore.getFirestore(app);return {app};
    })().catch(error=>{connecting=null;throw error;});
    const {app}=await connecting;
    // Public discovery is authorized without sign-in. Create an anonymous
    // identity only for a browser that actually publishes a lobby.
    if(publisher&&!uid){
      if(!authConnecting)authConnecting=(async()=>{const auth=sdk.auth.getAuth(app);if(typeof auth.authStateReady==='function')await bounded(auth.authStateReady());if(!auth.currentUser)await bounded(sdk.auth.signInAnonymously(auth));uid=auth.currentUser?.uid;if(!key(uid))throw new Error('Could not sign in to the lobby directory.');})().finally(()=>{authConnecting=null;});
      await authConnecting;
    }
    return {uid};
  }
  function filter(options){return filterLobbies(cached,{...options,now:now(),allowLocalOrigins});}
  function list(options={}){
    if(closed)return Promise.reject(new Error('The lobby directory has closed.'));
    if(reading)return reading.then(()=>filter(options));
    if(now()-lastRead<DIRECTORY_POLL_MS)return Promise.resolve(filter(options));
    reading=counted(async()=>{
      const controller=new AbortController();
      cached=await bounded(readPublicLobbies(fetchImpl,controller.signal)).finally(()=>controller.abort());
      lastRead=now();
      metrics.readQueries++;metrics.documentReads+=Math.max(1,cached.length);
      metrics.estimatedPayloadBytes+=size(cached);
      return filter(options);
    }).finally(()=>{reading=null;});
    return reading;
  }
  async function write(input,expected){
    if(closed||!current||expected!==revision)return;
    const record=publicLobbyRecord(input,{now:now(),ownerUid:uid,allowLocalOrigins});
    if(!record.public||record.status==='closed')throw new Error('Private or closed lobbies cannot be published.');
    delete record.heartbeatAt;delete record.expiresAt;
    const data={...record,updatedAt:sdk.firestore.serverTimestamp()};
    // Only a small explicit allowlist is persisted; supplied tokens/players
    // arrays and complete campaign/simulation objects are discarded.
    if(size(record)>MAX_RECORD_BYTES)throw new Error('The lobby record is too large.');
    metrics.writes++;metrics.estimatedPayloadBytes+=size(record);
    await bounded(sdk.firestore.setDoc(ref(),data));lastWrite=now();
    return {...record,directoryId:uid};
  }
  async function publish(input){
    if(closed)throw new Error('The lobby directory has closed.');
    const expected=++revision;current=input;stopHeartbeat();
    await connect({publisher:true});if(closed||expected!==revision||!current)return;
    const result=await counted(()=>enqueue(()=>write(input,expected)));
    return result;
  }
  function heartbeat(input=current){
    if(closed||!current)return Promise.resolve();
    current=input;
    if(now()-lastWrite<DIRECTORY_HEARTBEAT_MS)return Promise.resolve();
    const expected=revision;return counted(()=>enqueue(()=>write(input,expected)));
  }
  function stopHeartbeat(){if(heartbeatTimer!==null)unschedule(heartbeatTimer);heartbeatTimer=null;}
  function remove(){
    ++revision;current=null;stopHeartbeat();
    if(!db||!uid)return Promise.resolve();
    return counted(()=>enqueue(async()=>{metrics.deletes++;await bounded(sdk.firestore.deleteDoc(ref()));}));
  }
  function watch(onLobbies,{onError=()=>{},...options}={}){
    if(pollTimer!==null)unschedule(pollTimer);if(expiryTimer!==null)unschedule(expiryTimer);
    let stopped=false;
    const refresh=()=>{if(stopped)return;list(options).then(value=>{if(!stopped)onLobbies(value);},error=>{if(!stopped)onError(error);});};
    refresh();pollTimer=schedule(refresh,DIRECTORY_POLL_MS);
    expiryTimer=schedule(()=>{if(!stopped)onLobbies(filter(options));},5_000);
    return ()=>{stopped=true;unschedule(pollTimer);unschedule(expiryTimer);pollTimer=expiryTimer=null;};
  }
  async function startPublishing(getRecord,{onError=()=>{}}={}){
    stopHeartbeat();await publish(await getRecord());
    heartbeatTimer=schedule(()=>{Promise.resolve(getRecord()).then(record=>heartbeat(record)).catch(onError);},DIRECTORY_HEARTBEAT_MS);
    return ()=>remove();
  }
  async function close(){if(pollTimer!==null)unschedule(pollTimer);if(expiryTimer!==null)unschedule(expiryTimer);try{await remove();}finally{closed=true;}}
  return {connect,list,publish,heartbeat,remove,unpublish:remove,watch,startPublishing,close,usage:()=>({...metrics}),get isConnected(){return !!db;}};
}
