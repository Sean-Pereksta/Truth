import {initializeDesktopBridge} from './desktop-bridge.js';
import {MultiplayerClient} from './client.js';
import {HOST_CONNECTION_MESSAGE,mountLobbyUI} from './lobby-ui.js';
import {createFirebaseDirectory,parseGuestInvite,safeHostOrigin} from './directory.js';
import {GAME_VERSION,ASSET_VERSION,PROTOCOL_VERSION} from './protocol.js';

export function setupMultiplayer({getConfig,onGame,onOrderResult,onPending,onConnection,onLeave,getAssetsReady=()=>false}={}){
 initializeDesktopBridge();
 const standalone=document.body.dataset.standalone==='true';
 const downloadLink=document.querySelector('.online-download');if(downloadLink)downloadLink.hidden=!!window.bannerlandsHost||standalone;
 const downloadUrl=standalone?'https://sean-pereksta.github.io/Truth/games/bannerlands/download.html':'download.html';
 let client=null,inviteUrl=null,guestInvite=null,stopBrowsing=null,directoryPublished=false,publishing=null,lastStatus='',wasBattle=false,activeGame=null,selectionEpoch=0,lastLobbyProblem=null,leaving=Promise.resolve();
 const directory=createFirebaseDirectory(),compatibility={gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION,protocolVersion:PROTOCOL_VERSION};
 const local=/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin);
 function matchOrigin(value){
  // Phones can use the gateway's own LAN address. External match addresses
  // still pass the existing public-host checks.
  if(value===location.origin&&/^https?:$/.test(location.protocol))return value;
  return safeHostOrigin(value,{allowLocalOrigins:local});
 }
 const activeHostKey='bannerlands.active-host';
 function selectedHost(){try{const saved=sessionStorage.getItem(activeHostKey);return saved?matchOrigin(saved):location.origin;}catch{try{sessionStorage.removeItem(activeHostKey);}catch{}return location.origin;}}
 function rememberHost(origin){try{sessionStorage.setItem(activeHostKey,origin);}catch{}}
 function clearHost(){try{sessionStorage.removeItem(activeHostKey);}catch{}}
 function lobbyProblem(lobby){return lobby?.error||client?.session?.host&&lobby?.directoryManaged&&lobby?.directoryError&&(lobby.directoryError+' Share the guest invitation instead.');}
 function stopWatch(){stopBrowsing?.();stopBrowsing=null;}
 async function updateDirectory(lobby,source){
  if(!source.session?.host||publishing||lobby.directoryManaged)return;
  const available=lobby.public&&lobby.reachable&&lobby.status==='waiting'&&lobby.availableSeats>0;
  publishing=source;
  try{
   if(available){if(!directoryPublished){await directory.publish(lobby);if(client===source)directoryPublished=true;}else await directory.heartbeat(lobby);}
   else if(directoryPublished){await directory.remove();if(client===source)directoryPublished=false;}
  }catch{if(client===source)ui.setStatus('Public discovery is unavailable. Share the guest invitation to connect.',{error:true});}
  finally{if(publishing===source)publishing=null;}
 }
 function receive(state,source){
  if(state.lobby?.status==='closed'){endSession('The host closed this lobby.');return;}
  if(state.lobby)void updateDirectory(state.lobby,source);
  if(state.lobby?.status==='in-progress'&&state.game){
   if(!wasBattle||activeGame!==state.game){wasBattle=true;activeGame=state.game;ui.hide();onGame(state.game,client);}
  }else if(state.lobby){
   const matchEnded=wasBattle;
   if(wasBattle){wasBattle=false;activeGame=null;onLeave?.();}
   ui.renderSession({...state,matchEnded,isHost:!!client.session?.host,inviteUrl});ui.setAssetsReady(getAssetsReady());
   if(state.lobby.status==='starting'){
    ui.setStatus('Synchronizing the world for every commander…',{loading:true});
    if(state.game&&getAssetsReady())void source.synchronize().catch(error=>{if(client===source)ui.setStatus(error.message,{error:true});});
   }else{
    const problem=lobbyProblem(state.lobby);if(problem)ui.setStatus(problem,{error:true});else if(matchEnded)ui.setStatus('The host ended the match. Confirm the campaign settings and mark ready to play again.');else if(lastLobbyProblem)ui.setStatus('Connected · waiting in the lobby');lastLobbyProblem=problem||null;
   }
  }
 }
 function makeClient({origin=location.origin}={}){
  origin=matchOrigin(origin);
  client?.close();let next;next=new MultiplayerClient({origin,onState:state=>{if(client===next)receive(state,next);},onStatus:(status,message)=>{
   if(client!==next)return;
   if(status==='closed'){if(lastStatus)endSession(message);return;}
   if(status==='connected'&&lobbyProblem(client.lobby))ui.setStatus(lobbyProblem(client.lobby),{error:true});
   else if(status!=='connected'||lastStatus!==status)ui.setStatus(message,{loading:status==='connecting'||status==='reconnecting'});
   if(lastStatus!==status&&wasBattle)onConnection?.(status,message);lastStatus=status;
  },onPending:envelope=>{if(client===next)onPending?.(envelope);},onCommand:(result,envelope)=>{
   if(client!==next)return;
   onOrderResult?.(result,envelope);

  }});client=next;return client;
 }
 async function join({origin=location.origin,invite,name='Guest',lobby,lobbyId=lobby?.id}={}){
  origin=matchOrigin(origin);
  if(client?.session&&client.origin===origin&&(lobbyId?lobbyId===client.lobby?.id:invite&&invite===guestInvite)){stopWatch();ui.show('session');return;}
  const ready=leave({showHome:false}),epoch=selectionEpoch;
  await ready;if(epoch!==selectionEpoch)return;
  const next=makeClient({origin});await next.join({invite,name,lobbyId});
  if(client===next&&epoch===selectionEpoch){guestInvite=invite;rememberHost(origin);}
 }
 async function host(config,metadata){
  if(!window.bannerlandsHost)throw new Error(HOST_CONNECTION_MESSAGE);
  const ready=leave({showHome:false}),epoch=selectionEpoch;
  await ready;if(epoch!==selectionEpoch)return;
  let progress=null,pending=true,hosted,next;
  try{
   progress=setInterval(()=>window.bannerlandsHost.status().then(status=>{
    if(pending&&epoch===selectionEpoch)ui.setStatus(status.message||status.status||'Opening your temporary connection…',{loading:true});
   }).catch(()=>{}),1000);
   hosted=await window.bannerlandsHost.host(config,metadata);
   if(epoch!==selectionEpoch){await stopHosting(hosted.hostToken);return;}
   if(new URL(hosted.url).origin!==location.origin)throw new Error('The local hosting service changed address. Restart Bannerlands.');
   inviteUrl=hosted.inviteUrl;next=makeClient({origin:location.origin});
   await next.join({hostToken:hosted.hostToken,name:metadata.hostName});
   if(client===next&&epoch===selectionEpoch)rememberHost(location.origin);
  }catch(error){
   if(next&&client===next){detachSession({showHome:false});next.close();next.forget();}
   if(hosted&&!expired(error))await stopHosting(hosted.hostToken);
   if(epoch===selectionEpoch)throw error;
  }finally{pending=false;clearInterval(progress);}
 }
 const expired=error=>error?.status===401||error?.status===410;
 function stopHosting(token){return token?window.bannerlandsHost?.stop(token).catch(()=>{}):undefined;}
 function detachSession({showHome=true}={}){
  const previous=client,hadSession=previous?.session||wasBattle||lastStatus==='connected'||lastStatus==='reconnecting';
  client=null;
  if(previous?.session?.host&&!previous.lobby?.managed||directoryPublished||publishing)void directory.remove().catch(()=>{});
  directoryPublished=false;publishing=null;wasBattle=false;activeGame=null;inviteUrl=null;guestInvite=null;lastLobbyProblem=null;lastStatus='';
  clearHost();ui.clearSession();if(showHome)ui.show('home');if(hadSession)onLeave?.();
  return previous;
 }
 function endSession(message){
  stopWatch();
  const previous=detachSession();previous?.close();previous?.forget();ui.setStatus(message,{error:true});
 }
 function leave({showHome=true}={}){
  selectionEpoch++;stopWatch();
  const previous=detachSession({showHome}),session=previous?.session;
  if(previous){
   const cleanup=previous.leave().catch(error=>{if(session?.host&&!expired(error))return stopHosting(session.token);});
   leaving=Promise.all([leaving,cleanup]).then(()=>{});
  }
  return leaving;
 }
 const ui=mountLobbyUI({getConfig,...compatibility,version:GAME_VERSION,downloadUrl,allowLocalOrigins:local,canHost:!!window.bannerlandsHost,
  onHost:host,onJoin:join,onBrowse:async()=>{
   stopWatch();stopBrowsing=directory.watch(records=>ui.renderLobbies(records),{...compatibility,onError:error=>ui.setStatus('Lobby discovery is unavailable. You can still join by invitation.',{error:true})});return directory.list(compatibility);
  },onLeave:()=>{void leave();},onReady:async({ready,revision,assetsReady})=>client.ready(ready,revision,assetsReady),onChooseHouse:async team=>client.chooseHouse(team),onStart:async({revision})=>client.start(revision),
  onEnd:()=>client.request('/api/end',{method:'POST',body:{}}),onVisibility:({public:listed})=>client.request('/api/visibility',{method:'POST',body:{public:listed}}),onConfigure:(config,metadata)=>client.request('/api/config',{method:'POST',body:{config,...metadata}}),onClose:stopWatch});
 for(const [id,view]of [['hostLobbyButton','host'],['browseLobbiesButton','browse'],['joinInviteButton','invite']])document.getElementById(id)?.addEventListener('click',()=>ui.show(client?.session?'session':view));
 let discovery;
 async function openManaged(live){
  if(client?.session){ui.show('session');return;}
  try{
   if(!window.CatnmiceServers){
    discovery??=new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.src='https://catnmice.com/shared/managed-servers.js';
     script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('The server directory could not load. Check your connection and try again.'));};
     document.head.append(script);
    });
    await discovery;
   }
   await window.CatnmiceServers.open('bannerlands',{live});
  }catch(error){discovery=null;ui.show('home');ui.setStatus(error.message,{error:true});}
 }
 for(const [id,live] of [['managedLiveJoin',true],['managedServerBrowser',false]]){
  const button=document.getElementById(id);
  if(button){button.hidden=false;button.addEventListener('click',()=>void openManaged(live));}
 }
 const leaveButton=document.getElementById('leaveOnlineButton');leaveButton?.addEventListener('click',()=>ui.show(client?.session?'session':'home'));
 window.addEventListener('pagehide',()=>{client?.close();stopWatch();});
 async function recover(){
  let epoch=selectionEpoch,failureView='invite';
  try{
   const fragment=new URLSearchParams(location.hash.slice(1)),invite=fragment.get('invite'),auto=fragment.has('join')||!!invite;
   if(fragment.has('managed')){
    failureView='home';
    const lobbyId=fragment.get('managed'),query=new URLSearchParams(location.search);
    const name=query.get('name')?.trim().slice(0,60)||'Commander';
    history.replaceState(null,'',location.pathname);
    if(!/^[a-f0-9]{24}$/.test(lobbyId))throw new Error('This server link has expired. Browse servers to reconnect.');
    const candidate=makeClient({origin:location.origin});
    const restored=await candidate.restore();
    if(epoch!==selectionEpoch||client!==candidate)return;
    if(restored&&candidate.lobby?.id===lobbyId){rememberHost(location.origin);return;}
    const joining=join({origin:location.origin,lobbyId,name});epoch=selectionEpoch;await joining;
    return;
   }
   if(fragment.has('room')){
    failureView='home';
    history.replaceState(null,'',location.pathname+location.search);
    const lobbyId=fragment.get('room');
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(lobbyId))throw new Error('The lobby link has an invalid room identifier.');
    ui.show('home');
    const joining=join({origin:fragment.get('host'),lobbyId});epoch=selectionEpoch;await joining;
    return;
   }
   if(fragment.get('view')==='browse'){history.replaceState(null,'',location.pathname+location.search);ui.show('browse');}
   else if(!auto&&new URLSearchParams(location.search).get('host')==='1')ui.show('host');
   if(auto){parseGuestInvite(location.href,{allowLocalOrigins:local});history.replaceState(null,'',location.pathname+location.search);ui.show('session');}
   const c=makeClient({origin:auto?location.origin:selectedHost()});
   const restored=await c.restore();if(epoch!==selectionEpoch||client!==c||restored)return;
   c.close();if(auto){const joining=join({origin:location.origin,invite});epoch=selectionEpoch;await joining;}else clearHost();
  }catch(error){if(epoch===selectionEpoch){ui.show(failureView);ui.setStatus(error.message,{error:true});}}
 }
 void recover();
 return {get client(){return client;},ui,directory,leave,assetsReady(){ui.setAssetsReady(getAssetsReady());},show(){ui.show(client?.session?'session':'home');}};
}
