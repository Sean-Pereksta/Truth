import {firebaseConfig} from '../../multiplayer/firebase-config.js';
import {LOBBY_COLLECTION,publicLobbyRecord,DIRECTORY_HEARTBEAT_MS} from '../../multiplayer/directory.js';

// Node/Electron host adapter. Short-lived anonymous Firebase credentials remain
// only in this process. Public records never contain invitations or sessions.
export function createHostDirectoryPublisher({fetchImpl=globalThis.fetch,now=Date.now,onUsage=()=>{}}={}){
  let auth=null,connecting=null,chain=Promise.resolve(),active=false,revision=0,lastWrite=-Infinity,currentId=null;
  const usage={authRequests:0,writes:0,deletes:0,sentBytes:0,receivedBytes:0,errors:0};
  const bytes=value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value));
  const enqueue=action=>{const result=chain.then(action);chain=result.catch(()=>{});return result;};
  async function request(url,body,{method='POST',authorized=false,form=false}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8_000),payload=body===undefined?undefined:form?new URLSearchParams(body).toString():JSON.stringify(body);
    usage.sentBytes+=payload?bytes(payload):0;
    try{
      const response=await fetchImpl(url,{method,body:payload,headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json',...(authorized?{Authorization:'Bearer '+auth.idToken}:{})},signal:controller.signal,redirect:'error'});
      if(Number(response.headers?.get?.('content-length'))>100_000)throw new Error('The directory response was too large.');
      const raw=await response.text();usage.receivedBytes+=bytes(raw);if(bytes(raw)>100_000)throw new Error('The directory response was too large.');
      if(!response.ok)throw new Error(response.status===401||response.status===403?'Firebase denied the lobby update. Review the campaign directory rules and anonymous sign-in settings.':'The public lobby directory is unavailable. The host can still share a private invitation.');
      return raw?JSON.parse(raw):null;
    }catch(error){usage.errors++;throw error?.name==='AbortError'?new Error('The public lobby directory timed out. Try again or share a private invitation.'):error;}finally{clearTimeout(timer);onUsage({...usage});}
  }
  async function connect(){
    if(auth&&auth.expiresAt-now()>60_000)return auth;
    if(connecting)return connecting;
    connecting=(async()=>{
      usage.authRequests++;
      if(auth?.refreshToken){
        // Follow the Firebase Auth REST documented form encoding explicitly.
        const value=await request('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(firebaseConfig.apiKey),{grant_type:'refresh_token',refresh_token:auth.refreshToken},{form:true});
        if(value.user_id!==auth.uid)throw new Error('Firebase changed the directory publisher identity. Restart hosting.');
        auth={idToken:value.id_token,refreshToken:value.refresh_token,uid:value.user_id,expiresAt:now()+Number(value.expires_in)*1000};
      }else{
        const value=await request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(firebaseConfig.apiKey),{returnSecureToken:true});
        auth={idToken:value.idToken,refreshToken:value.refreshToken,uid:value.localId,expiresAt:now()+Number(value.expiresIn)*1000};
      }
      if(!auth?.idToken||!/^[A-Za-z0-9_-]{1,100}$/.test(auth.uid))throw new Error('Firebase did not create a valid directory publisher.');
      return auth;
    })().finally(()=>{connecting=null;});
    return connecting;
  }
  const field=value=>typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?{integerValue:String(value)}:{stringValue:String(value)};
  const name=()=>`projects/${firebaseConfig.projectId}/databases/(default)/documents/${LOBBY_COLLECTION}/${auth.uid}`;
  async function write(input,expected){
    if(!active||expected!==revision)return;
    await connect();if(!active||expected!==revision)return;
    const record=publicLobbyRecord(input,{now:now(),ownerUid:auth.uid});delete record.heartbeatAt;delete record.expiresAt;
    if(!record.public||record.status==='closed')return;
    const fields=Object.fromEntries(Object.entries(record).map(([k,v])=>[k,field(v)]));
    usage.writes++;currentId=input.id;
    await request(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:commit`,{writes:[{update:{name:name(),fields},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]},{authorized:true});
    lastWrite=now();return record;
  }
  function publish(input){active=true;const expected=++revision;return enqueue(()=>write(input,expected));}
  function heartbeat(input){if(!active||now()-lastWrite<DIRECTORY_HEARTBEAT_MS)return Promise.resolve();const expected=revision;return enqueue(()=>write(input,expected));}
  function remove(id=currentId){
    active=false;++revision;
    return enqueue(async()=>{
      if(!auth||!currentId||id&&id!==currentId)return;
      await connect();usage.deletes++;
      await request('https://firestore.googleapis.com/v1/'+name(),undefined,{method:'DELETE',authorized:true});currentId=null;
    });
  }
  return {publish,heartbeat,remove,close:()=>remove(),usage:()=>({...usage})};
}
