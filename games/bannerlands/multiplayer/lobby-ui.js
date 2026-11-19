import {parseGuestInvite} from './directory.js';
import {HOUSES} from '../core.js';

export const HOST_CONNECTION_MESSAGE='Open Bannerlands in Catnmice Game Hub for Windows and choose Host Lobby.';

// The full game's menu, renderer and controls remain owned by app.js. This
// accessible overlay handles discovery/admission and never changes game state.
export function mountLobbyUI({container=document.body,getConfig=()=>({}),onHost,onJoin,onBrowse,onLeave,onReady,onChooseHouse,onStart,onEnd,onVisibility,onConfigure,onClose=()=>{},version='',gameVersion=version,assetVersion='',protocolVersion=1,downloadUrl='https://sean-pereksta.github.io/Truth/games/bannerlands/download.html',canHost=!!globalThis.bannerlandsHost,showDownload=!canHost,allowLocalOrigins=false}={}){
  const root=document.createElement('section');root.className='multiplayer-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','multiplayerTitle');
  root.innerHTML=`<div class="multiplayer-panel"><header><div><span class="eyebrow">BANNERLANDS</span><h2 id="multiplayerTitle">Multiplayer campaign</h2></div><button type="button" data-action="close" aria-label="Close multiplayer">×</button></header><nav aria-label="Multiplayer"><button data-view="home">Overview</button><button data-view="host">Host Lobby</button><button data-view="browse">Browse Lobbies</button><button data-view="invite">Join by Invite</button></nav><p class="multiplayer-status" role="status" aria-live="polite"></p><div data-pane="home"><h3>Play together</h3><p>Host a campaign or join friends by invitation. Guests can play in their browser.</p><a class="multiplayer-download" data-download>Get the Windows launcher</a><p class="multiplayer-note">The host must stay awake and connected. If the host leaves, sleeps or loses internet, the match stops. Temporary connections may be unavailable; single-player stays available.</p></div><form data-pane="host" hidden><h3>Host a campaign</h3><p class="multiplayer-campaign"></p><label>Lobby name<input name="lobbyName" maxlength="48" value="A war of crowns" required autocomplete="off"></label><label>Your display name<input name="hostName" maxlength="40" value="Host" required autocomplete="nickname"></label><label>Human seats, including you<select name="maxHumans"><option value="1">You + AI houses</option><option value="2" selected>2 humans</option><option value="3">3 humans</option><option value="4">4 humans</option></select></label><fieldset class="multiplayer-house-roster"><legend>Participating houses</legend><p class="multiplayer-roster-hint"></p><div class="multiplayer-roster-options"></div></fieldset><label class="multiplayer-check"><input type="checkbox" name="public"> List this lobby publicly</label><p class="multiplayer-note">Display names are unverified. Empty human seats remain reserved; other houses use the selected AI difficulty. Up to four humans can join a campaign; bots control the other participating houses.</p><button class="primary" type="submit">Create Lobby</button></form><div data-pane="host-required" hidden><p role="alert">${HOST_CONNECTION_MESSAGE}</p><a class="multiplayer-download" data-download>Get the Windows launcher</a></div><div data-pane="browse" hidden><div class="multiplayer-row"><h3>Available campaigns</h3><button type="button" data-action="refresh">Refresh</button></div><p class="multiplayer-note">Only compatible, reachable-looking waiting lobbies with open seats are shown. The host confirms availability when you join.</p><div class="multiplayer-list" aria-live="polite"></div></div><form data-pane="invite" hidden><h3>Join by invitation</h3><label>Your display name<input name="guestName" maxlength="40" value="Guest" required autocomplete="nickname"></label><label>Guest invitation link<input type="url" name="inviteUrl" required placeholder="https://…trycloudflare.com/#invite=…" autocomplete="off" spellcheck="false"></label><button class="primary" type="submit">Join in Browser</button><p class="multiplayer-note">Guests do not need to download Bannerlands or run hosting software. Use the guest invitation supplied by the host.</p></form><div data-pane="session" hidden><div class="multiplayer-row"><h3 class="multiplayer-session-name">Campaign lobby</h3><span class="multiplayer-session-state"></span></div><p class="multiplayer-session-config"></p><p class="multiplayer-identity"></p><div class="multiplayer-players"></div><label>Choose an available house<select data-house aria-label="Choose an available house"></select></label><p class="multiplayer-assets" role="status"></p><div class="multiplayer-row"><button type="button" data-action="ready">Mark Ready</button><button type="button" data-action="start" class="primary" hidden>Start Match</button><button type="button" data-action="leave">Leave Lobby</button></div><div class="multiplayer-host-controls" hidden><h3>Host controls</h3><label class="multiplayer-check"><input type="checkbox" data-public> List this lobby publicly</label><label>Human seats<select data-session-humans><option value="1">You + AI houses</option><option value="2">2 humans</option><option value="3">3 humans</option><option value="4">4 humans</option></select></label><button type="button" data-action="configure">Apply Current Campaign Settings</button><p class="multiplayer-note">This applies the choices in the main campaign menu and resets every player’s Ready status. Each player must confirm the new settings.</p><button type="button" data-action="end" hidden>End Match and Return to Lobby</button></div><div class="multiplayer-invite" hidden><label>Guest invitation link<input readonly aria-label="Guest invitation link"></label><button type="button" data-action="copy">Copy Guest Invitation</button></div><p class="multiplayer-note">A disconnected guest retains their house during the reconnection grace period. The battle continues; ordinary AI does not take over that house. Confirm the same campaign settings again after any host change.</p></div><footer>Game <span data-game-version></span> · Assets <span data-asset-version></span> · Protocol <span data-protocol-version></span></footer></div>`;
  container.append(root);
  const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
  const status=$('.multiplayer-status');let active='home',busy=false,session=null,assetsReady=false,previousFocus=null,destroyed=false,lastPhase=null,lastLobbyError=null;
  $('[data-game-version]').textContent=gameVersion;$('[data-asset-version]').textContent=assetVersion;$('[data-protocol-version]').textContent=String(protocolVersion);
  for(const link of $$('[data-download]')){link.href=downloadUrl;link.target='_blank';link.rel='noopener noreferrer';link.hidden=!showDownload;}
  if(canHost)$('[data-pane="home"] h3 + p').textContent='Host a campaign on this device. Friends can join the full game in their browser.';
  $('[data-pane="host"] button[type="submit"]').disabled=!canHost;
  function setStatus(message,{error=false,loading=false}={}){status.textContent=String(message||'');status.classList.toggle('error',error);status.classList.toggle('loading',loading);status.setAttribute('aria-busy',String(loading));}
  function summarize(config={}){return [config.mode||'Conquest',config.map||config.landscape||'Crownlands',config.scale,config.difficulty,config.fogOfWar?'Fog on':'Fog off'].filter(Boolean).join(' · ');}
  function renderHouseRoster(){
    const config=getConfig(),total=config.mode==='defend-king'?4:Math.min(16,Math.max(2,Number(config.enemies||3)+1)),hostHouse=Number(config.house||0),defaults=[hostHouse,...HOUSES.map((_,i)=>i).filter(i=>i!==hostHouse)].slice(0,total),chosen=new Set(config.houses||defaults),holder=$('.multiplayer-roster-options');holder.replaceChildren();
    for(const [id,house]of HOUSES.entries()){const label=document.createElement('label'),input=document.createElement('input');label.className='multiplayer-check';input.type='checkbox';input.name='participatingHouse';input.value=String(id);input.checked=id===hostHouse||chosen.has(id);input.disabled=id===hostHouse;label.append(input,document.createTextNode(house.name+(id===hostHouse?' · Your host house':'')));holder.append(label);}
    const refresh=()=>{const selected=$$('[name="participatingHouse"]:checked').length;$('.multiplayer-roster-hint').textContent='Choose exactly '+total+' houses for the current campaign: '+selected+' selected. Your chosen host house stays included.';$('[data-pane="host"] button[type="submit"]').disabled=!canHost||selected!==total;};holder.onchange=refresh;refresh();
    for(const option of $('[name="maxHumans"]').options)option.disabled=Number(option.value)>total;
    if(Number($('[name="maxHumans"]').value)>total)$('[name="maxHumans"]').value=String(Math.min(4,total));
  }
  function show(view='home'){
    if(destroyed)return;if(root.hidden)previousFocus=document.activeElement;
    const paneName=view==='host'&&!canHost?'host-required':view;
    root.hidden=false;active=view;for(const pane of $$('[data-pane]'))pane.hidden=pane.dataset.pane!==paneName;
    for(const button of $$('[data-view]')){
      const current=button.dataset.view===view;
      button.classList.toggle('active',current);button.setAttribute('aria-pressed',String(current));
    }
    $('.multiplayer-campaign').textContent='Current campaign settings: '+summarize(getConfig())+'. Choose campaign settings in the main menu before hosting.';
    if(view==='host'&&canHost)renderHouseRoster();
    if(view!=='session')setStatus('');
    if(view==='browse')void browse();
    ($('[data-pane="'+paneName+'"] input, [data-pane="'+paneName+'"] a[href]')||$('[data-action="close"]')).focus();
  }
  function hide(){root.hidden=true;if(previousFocus?.isConnected)previousFocus.focus();}
  async function act(callback,...args){
    if(busy||destroyed)return;busy=true;root.setAttribute('aria-busy','true');
    try{if(typeof callback!=='function')throw new Error('This online feature is not available in this build.');return await callback(...args);}catch(error){setStatus(error?.message||'The connection failed. Try again.',{error:true});}finally{busy=false;root.setAttribute('aria-busy','false');}
  }
  async function startHosting(config,metadata){
    setStatus('Starting your match server and internet connection…',{loading:true});
    await onHost(config,metadata);
  }
  async function browse(){setStatus('Checking the lobby directory…',{loading:true});const records=await act(onBrowse);if(records){renderLobbies(records);setStatus(records.length?'Choose a campaign to join.':'No compatible campaigns have open seats. Try a guest invitation.');}}
  function renderLobbies(records=[]){
    const list=$('.multiplayer-list');list.replaceChildren();
    if(!records.length){const empty=document.createElement('p');empty.textContent='No available campaigns right now.';list.append(empty);return;}
    for(const record of records){
      if(record.compatible===false||record.joinable===false||record.status!=='waiting'||record.availableSeats<=0)continue;
      const card=document.createElement('article');card.className='multiplayer-lobby-card';
      const title=document.createElement('h4');title.textContent=record.name;
      const host=document.createElement('p');host.textContent=(record.hostName||'Host')+' · Unverified display name';
      const info=document.createElement('p');info.textContent=summarize(record)+' · '+record.humans+' / '+record.maxHumans+' humans · '+record.aiHouses+' AI houses';
      const join=document.createElement('button');join.className='primary';join.textContent='Join in Browser';join.addEventListener('click',()=>act(onJoin,{origin:record.origin,lobby:record,name:$('[name="guestName"]').value.trim()||'Guest'}));
      card.append(title,host,info,join);list.append(card);
    }
    if(!list.children.length){const empty=document.createElement('p');empty.textContent='No compatible campaigns have open seats.';list.append(empty);}
  }
  function renderSession(value){
    const lobby=value?.lobby||value;if(!lobby)return;
    // A lobby heartbeat must not dismiss an invitation the player is typing.
    const entering=!session||session.lobby?.id!==lobby.id||session.session?.sessionId!==value.session?.sessionId||value.matchEnded||lobby.status==='starting'&&lastPhase!=='starting';
    session={...value,lobby};
    if(entering)setStatus(lobby.status==='closed'?'The host has closed this lobby.':'Connected to the lobby. Confirm your house and campaign settings.',{error:lobby.status==='closed'});
    const you=value.session||value.player||{},team=you.team??value.team,players=lobby.players||[],self=players.find(p=>p.team===team||you.sessionId&&p.id===you.sessionId),isHost=value.isHost??self?.host??false;
    const synchronizing=lobby.status==='starting',synchronized=players.filter(player=>player.synchronized).length,lobbyError=typeof lobby.error==='string'?lobby.error:lobby.error?.message||null;
    if(synchronizing&&lastPhase!=='starting')setStatus('Synchronizing the battlefield for every commander…',{loading:true});
    if(lobbyError&&lobbyError!==lastLobbyError)setStatus(lobbyError,{error:true});
    else if(lastPhase==='starting'&&['waiting','full'].includes(lobby.status)&&!lobbyError)setStatus('Starting was cancelled. Confirm the campaign settings and mark ready again.');
    lastPhase=lobby.status;lastLobbyError=lobbyError;
    $('.multiplayer-session-name').textContent=lobby.name||'Campaign lobby';$('.multiplayer-session-state').textContent=synchronizing?'Synchronizing '+synchronized+' / '+players.length:lobby.status||'waiting';
    $('.multiplayer-session-config').textContent=summarize(lobby.config||lobby)+' · '+players.length+' / '+lobby.maxHumans+' humans · '+(lobby.aiHouses??0)+' AI houses';
    $('.multiplayer-identity').textContent=team==null?'Synchronizing your private session…':'Your house: '+(lobby.houses?.find(h=>(h.team??h.id)===team)?.name||'House '+(team+1))+' · '+(isHost?'Host':'Guest');
    const people=$('.multiplayer-players');people.replaceChildren();
    for(const player of players){const row=document.createElement('p'),houseName=lobby.houses?.find(h=>(h.team??h.id)===player.team)?.name||'House '+(player.team+1),phase=!player.connected?'Disconnected':!player.assetsReady?'Loading artwork':synchronizing?(player.synchronized?'Battle synchronized':'Receiving battlefield'):player.ready?'Ready':'Preparing';row.textContent=(player.name||'Commander')+(player.host?' · Host':'')+' · '+houseName+' · '+phase+(player.team===team?' · You':'');people.append(row);}
    const houses=$('[data-house]'),old=houses.value;houses.replaceChildren();
    const houseList=lobby.houses||lobby.slots||Array.from({length:(lobby.config?.enemies??Math.max(1,lobby.maxHumans-1))+1},(_,id)=>({team:id,name:'House '+(id+1)}));
    for(const house of houseList){const id=house.team??house.id,option=document.createElement('option'),occupant=players.find(p=>p.team===id);option.value=String(id);option.textContent=(house.name||'House '+(id+1))+(occupant&&id!==team?' · '+(occupant.name||'Taken'):house.human===false||house.kind==='ai'?' · AI':!occupant?' · '+(players.length<lobby.maxHumans?'Open / AI':'AI house'):' · You');option.disabled=id!==team&&(!!occupant||house.human===false||house.kind==='ai');houses.append(option);}
    houses.value=String(team??old);houses.disabled=lobby.status!=='waiting'&&lobby.status!=='full'||self?.ready===true;
    $('[data-action="ready"]').textContent=synchronizing?'Ready':self?.ready?'Not Ready':'Mark Ready';$('[data-action="ready"]').disabled=!assetsReady||!self||!['waiting','full'].includes(lobby.status);
    $('[data-action="start"]').hidden=!isHost;$('[data-action="start"]').disabled=!players.length||!players.every(p=>p.ready&&p.assetsReady&&p.connected)||!['waiting','full'].includes(lobby.status);
    $('.multiplayer-host-controls').hidden=!isHost;$('[data-public]').checked=lobby.public===true;$('[data-public]').disabled=!['waiting','full'].includes(lobby.status);$('[data-session-humans]').value=String(lobby.maxHumans);$('[data-action="configure"]').disabled=!['waiting','full'].includes(lobby.status);$('[data-session-humans]').disabled=!['waiting','full'].includes(lobby.status);$('[data-action="end"]').hidden=!['starting','in-progress'].includes(lobby.status);$('[data-action="end"]').textContent=synchronizing?'Cancel Start and Return to Lobby':'End Match and Return to Lobby';$('[data-action="leave"]').textContent=isHost?'Stop Hosting':'Leave Lobby';
    $('.multiplayer-assets').textContent=!assetsReady?'Loading battle artwork… Mark Ready when it finishes.':synchronizing?(self?.synchronized?'Your battlefield is synchronized. Waiting for every commander: ':'Artwork loaded. Receiving your battlefield. ')+synchronized+' / '+players.length+' synchronized. The battle stays at its opening state until everyone is ready. A stalled start returns to the lobby after 45 seconds.':'Artwork loaded. Confirm the displayed campaign settings before marking ready.';
    const invite=value.inviteUrl||value.guestInvite;$('.multiplayer-invite').hidden=!isHost||!invite;if(invite)$('.multiplayer-invite input').value=invite;
    if(entering&&(root.hidden||active!=='session'))show('session');
  }
  function setAssetsReady(ready){assetsReady=ready===true;if(session)renderSession(session);}
  function clearSession(){
    session=null;lastPhase=null;lastLobbyError=null;
    $('.multiplayer-invite').hidden=true;$('.multiplayer-invite input').value='';
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!root.contains(button))return;
    if(button.dataset.view){show(button.dataset.view);return;}
    const action=button.dataset.action;
    if(action==='close'){hide();onClose();}
    if(action==='refresh')void browse();
    if(action==='leave')void act(onLeave);
    if(action==='ready'){const l=session?.lobby,p=l?.players?.find(p=>p.team===(session.session?.team??session.team));void act(onReady,{ready:!p?.ready,revision:l?.revision,assetsReady});}
    if(action==='start')void act(onStart,{revision:session?.lobby?.revision});
    if(action==='end')void act(onEnd);
    if(action==='configure')void act(onConfigure,getConfig(),{maxHumans:Number($('[data-session-humans]').value)});
    if(action==='copy'){void act(async()=>{const link=$('.multiplayer-invite input');await navigator.clipboard.writeText(link.value);setStatus('Guest invitation copied.');});}
  });
  $('[data-pane="host"]').addEventListener('submit',event=>{event.preventDefault();const config={...getConfig(),houses:$$('[name="participatingHouse"]:checked').map(input=>Number(input.value)).sort((a,b)=>(b===Number(getConfig().house||0))-(a===Number(getConfig().house||0)))},name=$('[name="lobbyName"]').value.trim(),hostName=$('[name="hostName"]').value.trim(),maxHumans=Number($('[name="maxHumans"]').value);void act(startHosting,config,{name,hostName,maxHumans,public:$('[name="public"]').checked});});
  $('[data-pane="invite"]').addEventListener('submit',event=>{event.preventDefault();void act(async()=>{const invite=parseGuestInvite($('[name="inviteUrl"]').value,{allowLocalOrigins});setStatus('Reserving your house with the host…',{loading:true});return onJoin({...invite,name:$('[name="guestName"]').value.trim()||'Guest'});});});
  $('[data-house]').addEventListener('change',event=>{void act(onChooseHouse,Number(event.target.value));});
  $('[data-public]').addEventListener('change',event=>{void act(onVisibility,{public:event.target.checked});});
  root.addEventListener('keydown',event=>{
    // Keep battlefield shortcuts from consuming Tab or issuing orders while
    // this modal has focus, including a pending formation's Enter shortcut.
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();onClose();return;}
    if(event.key==='Tab'){const focusable=[...root.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}
  });
  return {show,hide,setStatus,renderLobbies,renderSession,clearSession,setAssetsReady,get element(){return root;},destroy(){destroyed=true;root.remove();}};
}
