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
 let client=null,inviteUrl=null,stopBrowsing=null,directoryPublished=false,publishing=false,lastStatus='',wasBattle=false,activeGame=null,selectionEpoch=0,lastLobbyProblem=null;
 const directory=createFirebaseDirectory(),compatibility={gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION,protocolVersion:PROTOCOL_VERSION};
 const local=/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin);
 const activeHostKey='bannerlands.active-host';
 function selectedHost(){try{const saved=sessionStorage.getItem(activeHostKey);return saved?safeHostOrigin(saved,{allowLocalOrigins:local}):location.origin;}catch{try{sessionStorage.removeItem(activeHostKey);}catch{}return location.origin;}}
 function rememberHost(origin){try{sessionStorage.setItem(activeHostKey,origin);}catch{}}
 function clearHost(){try{sessionStorage.removeItem(activeHostKey);}catch{}}
 function lobbyProblem(lobby){return lobby?.error||client?.session?.host&&lobby?.directoryManaged&&lobby?.directoryError&&(lobby.directoryError+' Share the guest invitation instead.');}
 function stopWatch(){stopBrowsing?.();stopBrowsing=null;}
 async function updateDirectory(lobby){
  if(!client?.session?.host||publishing||lobby.directoryManaged)return;
  const available=lobby.public&&lobby.reachable&&lobby.status==='waiting'&&lobby.availableSeats>0;
  publishing=true;
  try{
   if(available){if(!directoryPublished){await directory.publish(lobby);directoryPublished=true;}else await directory.heartbeat(lobby);}
   else if(directoryPublished){await directory.remove();directoryPublished=false;}
  }catch(error){ui.setStatus('Public discovery is unavailable. Share the guest invitation to connect.',{error:true});}
  finally{publishing=false;}
 }
 function receive(state){
  void updateDirectory(state.lobby);
  if(state.lobby?.status==='in-progress'&&state.game){
   if(!wasBattle||activeGame!==state.game){wasBattle=true;activeGame=state.game;ui.hide();onGame(state.game,client);}
  }else if(state.lobby){
   const matchEnded=wasBattle;
   if(wasBattle){wasBattle=false;activeGame=null;onLeave?.();}
   ui.renderSession({...state,matchEnded,isHost:!!client.session?.host,inviteUrl});ui.setAssetsReady(getAssetsReady());
   if(state.lobby.status==='starting'){
    ui.setStatus('Synchronizing the world for every commander…',{loading:true});
    if(state.game&&getAssetsReady())void client.synchronize().catch(error=>ui.setStatus(error.message,{error:true}));
   }else{
    const problem=lobbyProblem(state.lobby);if(problem)ui.setStatus(problem,{error:true});else if(matchEnded)ui.setStatus('The host ended the match. Confirm the campaign settings and mark ready to play again.');else if(lastLobbyProblem)ui.setStatus('Connected · waiting in the lobby');lastLobbyProblem=problem||null;
   }
  }
 }
 function makeClient({origin=location.origin}={}){
  origin=safeHostOrigin(origin,{allowLocalOrigins:local});
  client?.close();let next;next=new MultiplayerClient({origin,onState:state=>{if(client===next)receive(state);},onStatus:(status,message)=>{
   if(client!==next)return;
   if(status==='connected'&&lobbyProblem(client.lobby))ui.setStatus(lobbyProblem(client.lobby),{error:true});
   else if(status!=='connected'||lastStatus!==status)ui.setStatus(message,{error:status==='closed',loading:status==='reconnecting'});
   if(lastStatus!==status&&wasBattle)onConnection?.(status,message);lastStatus=status;
  },onPending:envelope=>{if(client===next)onPending?.(envelope);},onCommand:(result,envelope)=>{
   if(client!==next)return;
   onOrderResult?.(result,envelope);

  }});client=next;return client;
 }
 async function join({origin=location.origin,invite,name='Guest',lobby}={}){
  selectionEpoch++;
  stopWatch();
  origin=safeHostOrigin(origin,{allowLocalOrigins:local});
  if(client?.session&&client.origin===origin&&(!lobby||lobby.id===client.lobby?.id)){ui.show('session');return;}
  if(client?.session)await leave({showHome:false});
  const next=makeClient({origin}),epoch=selectionEpoch;await next.join({invite,name});if(client===next&&epoch===selectionEpoch)rememberHost(origin);
 }
 async function host(config,metadata){
  selectionEpoch++;
  if(!window.bannerlandsHost)throw new Error(HOST_CONNECTION_MESSAGE);
  if(client?.session)await leave({showHome:false});
  stopWatch();let progress=null,pending=true;const epoch=selectionEpoch;
  try{
   progress=setInterval(()=>window.bannerlandsHost.status().then(status=>{
    if(pending&&epoch===selectionEpoch)ui.setStatus(status.message||status.status||'Opening your temporary connection…',{loading:true});
   }).catch(()=>{}),1000);
   const hosted=await window.bannerlandsHost.host(config,metadata);inviteUrl=hosted.inviteUrl;
   if(epoch!==selectionEpoch)return;
   if(new URL(hosted.url).origin!==location.origin)throw new Error('The local hosting service changed address. Restart Bannerlands.');
   const next=makeClient({origin:location.origin});await next.join({hostToken:hosted.hostToken,name:metadata.hostName});if(client===next&&epoch===selectionEpoch)rememberHost(location.origin);
  }finally{pending=false;clearInterval(progress);}
 }
 async function leave({showHome=true}={}){
  selectionEpoch++;
  stopWatch();const host=client?.session?.host;
  await directory.remove().catch(()=>{});directoryPublished=false;
  await client?.leave().catch(()=>{});if(host&&window.bannerlandsHost)await window.bannerlandsHost.stop().catch(()=>{});
  client=null;wasBattle=false;activeGame=null;inviteUrl=null;lastLobbyProblem=null;clearHost();if(showHome)ui.show('home');onLeave?.();
 }
 const ui=mountLobbyUI({getConfig,...compatibility,version:GAME_VERSION,downloadUrl,allowLocalOrigins:local,canHost:!!window.bannerlandsHost,
  onHost:host,onJoin:join,onBrowse:async()=>{
   stopWatch();stopBrowsing=directory.watch(records=>ui.renderLobbies(records),{...compatibility,onError:error=>ui.setStatus('Lobby discovery is unavailable. You can still join by invitation.',{error:true})});return directory.list(compatibility);
  },onLeave:leave,onReady:async({ready,revision,assetsReady})=>client.ready(ready,revision,assetsReady),onChooseHouse:async team=>client.chooseHouse(team),onStart:async({revision})=>client.start(revision),
  onEnd:()=>client.request('/api/end',{method:'POST',body:{}}),onVisibility:({public:listed})=>client.request('/api/visibility',{method:'POST',body:{public:listed}}),onConfigure:(config,metadata)=>client.request('/api/config',{method:'POST',body:{config,...metadata}}),onClose:stopWatch});
 for(const [id,view]of [['hostLobbyButton','host'],['browseLobbiesButton','browse'],['joinInviteButton','invite']])document.getElementById(id)?.addEventListener('click',()=>ui.show(client?.session?'session':view));
 const leaveButton=document.getElementById('leaveOnlineButton');leaveButton?.addEventListener('click',()=>ui.show('session'));
 window.addEventListener('pagehide',()=>{client?.close();stopWatch();});
 async function recover(){
  const epoch=selectionEpoch;
  const fragment=new URLSearchParams(location.hash.slice(1)),invite=fragment.get('invite'),auto=fragment.has('join')||!!invite;
  if(fragment.get('view')==='browse'){history.replaceState(null,'',location.pathname+location.search);ui.show('browse');}
  else if(!auto&&new URLSearchParams(location.search).get('host')==='1')ui.show('host');
  if(auto){parseGuestInvite(location.href,{allowLocalOrigins:local});history.replaceState(null,'',location.pathname+location.search);ui.show('session');}
  const c=makeClient({origin:auto?location.origin:selectedHost()});
  const restored=await c.restore();if(epoch!==selectionEpoch||client!==c)return;if(restored)return;
  c.close();if(auto)await join({origin:location.origin,invite});else clearHost();
 }
 void recover().catch(error=>{ui.show('invite');ui.setStatus(error.message,{error:true});});
 return {get client(){return client;},ui,directory,leave,assetsReady(){ui.setAssetsReady(getAssetsReady());},show(){ui.show(client?.session?'session':'home');}};
}
