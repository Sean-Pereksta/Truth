(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui={api:null,started:false,menu:true,drawer:null,difficulty:'normal',noticeUntil:0,noticeTimer:null,lastLog:null,drawerKey:'',lastMap:0,outcome:false,modalWasPaused:true,modalDone:null,savedSnapshot:null,lastSaveTime:0,storageAvailable:true,flagFocus:null,flagState:null,flagAnnounceKey:'',houseOwners:null,captureToastUntil:0,mapMarkers:null};
 const roleNames={vanguard:'Vanguard',ranged:'Archer',support:'Support'};
 const houseMarks={player:'❧',mars:'⚔',minerva:'◇',diana:'☾',apollo:'☀',juno:'♛',neptune:'♆',vulcan:'⚒',venus:'✿',saturn:'♄'};
 const gearNames={Sword:'Sword',Spear:'Spear',Bow:'Bow',Longbow:'Longbow',Light:'Light armor',Heavy:'Heavy armor',Shield:'Shield',Boots:'Boots',Medkit:'Medic kit',Horse:'Horse',EngineerKit:'Engineer kit',TrapKit:'Trap kit',WarHorn:'War horn',FireOil:'Fire oil'};
 const squadIcons=['','party','shield','bow','cross'];
 let tipAt=0;
 const seen=(api,e)=>!api.isVisibleTo||api.isVisibleTo('player',e);
 const visible=(api,x,y)=>!api.canSee||api.canSee('player',x,y);
 const explored=(api,x,y)=>!api.isExplored||api.isExplored('player',x,y);
 const mapMemory={};

 function refreshFullscreen(){
  const active=!!(document.fullscreenElement||document.webkitFullscreenElement);
  for(const id of ['fullscreenToggle','menuFullscreen']){const button=$(id);if(!button)continue;html(button,icon(active?'contract':'expand'));button.title=active?'Exit fullscreen':'Enter fullscreen';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(active));}
  if(ui.api)requestAnimationFrame(()=>{ui.api.resize();update(ui.api);});
 }
 async function toggleFullscreen(){
  try{
   if(document.fullscreenElement||document.webkitFullscreenElement){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
   else{const root=document.documentElement,enter=root.requestFullscreen||root.webkitRequestFullscreen;if(!enter)throw new Error('Fullscreen unavailable');await enter.call(root);}
   refreshFullscreen();
  }catch{if(ui.menu)showModal('Fullscreen is unavailable here','<p>Open the saved game in Chrome or Edge and use the fullscreen button, or press F11 in your browser.</p>','Got it');else toast('Fullscreen is unavailable here. You can use your browser’s fullscreen control.');}
 }
 function html(el,value){if(el.innerHTML!==value)el.innerHTML=value;}
 function text(el,value){if(el.textContent!==String(value))el.textContent=value;}
 function toast(message,duration=3800,kind=''){
  if(kind!=='capture'&&performance.now()<ui.captureToastUntil)return;
  text($('notice'),message);$('notice').classList.toggle('capture-notice',kind==='capture');$('notice').classList.add('show');ui.noticeUntil=performance.now()+duration;
  if(kind==='capture')ui.captureToastUntil=ui.noticeUntil;
  clearTimeout(ui.noticeTimer);const deadline=ui.noticeUntil;ui.noticeTimer=setTimeout(()=>{if(ui.noticeUntil===deadline){$('notice').classList.remove('show');ui.noticeUntil=0;}},duration);
 }
 function plain(value){const tmp=document.createElement('div');tmp.innerHTML=value;return tmp.textContent||'';}
 function timeLabel(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}

 function update(api){
  ui.api=api; const g=api.game,selected=api.getSelectedUnits().filter(s=>s.state!=='knocked'&&s.controller==='player');
  const party=g.students.filter(s=>s.controller==='player'),active=party.filter(s=>s.state!=='knocked');
  const ruled=g.houses.filter(h=>h.controller==='player').length,sites=g.objectives.filter(o=>o.controller==='player').length;
  html($('battleStats'),`<span title="Active students">${icon('party')}<b>${active.length}</b> party</span><span title="Houses under your standard">${icon('flag')}<b>${ruled}<small> / 10</small></b> houses</span><span title="Central objectives held">${icon('spark')}<b>${sites}<small> / 4</small></b> sites</span><span title="Trial time"><b>${timeLabel(g.time)}</b></span>`);
  text($('selectionCount'),selected.length?`${selected.length} student${selected.length===1?'':'s'} selected`:'Select your party');
  const carrying=selected.find(s=>s.carryingStandard);
  const mode=api.getMode(),placement=api.getPlacementMode();
  const modeLabels={move:'Right click to move, fight or collect',attackmove:'Right click a route · attack along the way',defend:'Right click a position to defend',escort:carrying?'Right click ground to escort your carrier':'Select a carrier with its guards first'};
  text($('selectionHint'),carrying?'A standard is coming home':g.followMode?'Camera following party':'F to follow your party');
  text($('modeHint'),placement?`Right click to place ${placement} · Esc cancels`:modeLabels[mode]||modeLabels.move);
  const total=api.LOOT_KEYS.reduce((n,k)=>n+(api.getPlayerHouse().stockpile[k]||0),0);text($('stockCount'),total);
  for(let i=1;i<=4;i++){
   const button=$(`squad${i}`);if(!button)continue;
   const members=api.getSquadUnits(i),living=members.filter(s=>s.state!=='knocked');
   text(button.querySelector('strong'),i===1?'All students':api.getSquadName(i));
   text(button.querySelector('small'),`${living.length} ready${members.length>living.length?` · ${members.length-living.length} down`:''}`);
   button.querySelector('.squad-health i').style.width=`${members.length?100*members.reduce((n,s)=>n+Math.max(0,s.hp)/s.maxHp,0)/members.length:0}%`;
   button.classList.toggle('active',g.activeSquad===i);
  }
  document.querySelectorAll('[data-order]').forEach(b=>b.classList.toggle('active',b.dataset.order===mode));
  document.querySelectorAll('[data-formation]').forEach(b=>b.classList.toggle('active',b.dataset.formation===(g.formation||'balanced')));
  html($('pauseToggle'),icon(g.paused?'play':'pause'));$('pauseToggle').title=g.paused?'Resume trial (Space)':'Tactical pause (Space)';
  $('pausedIndicator').classList.toggle('hidden',!g.paused||ui.menu||!ui.started||g.gameOver||!$('modal').classList.contains('hidden'));
  updateFlagStatus(api);
  announceCastleChanges(api);
  const newest=g.logs[0];
  if(newest!==ui.lastLog){ui.lastLog=newest;if(ui.started&&!ui.menu&&newest&&/takes the banner|takes command|secures|saved with|equipped|equipment changes|No matching|No available|do not have|upgrades|returns|rescues/i.test(plain(newest)))toast(plain(newest));}
  if(ui.noticeUntil&&performance.now()>ui.noticeUntil){$('notice').classList.remove('show');ui.noticeUntil=0;}
  if(performance.now()-ui.lastMap>170){drawMinimap(api);ui.lastMap=performance.now();}
  if(ui.drawer)renderDrawer(api);
  if(ui.storageAvailable&&ui.started&&!g.paused&&!g.gameOver&&g.time-ui.lastSaveTime>=30){saveTrial(false);ui.lastSaveTime=g.time;}
  if(g.gameOver&&!ui.outcome&&ui.started){ui.outcome=true;showOutcome(api);}
 }
 window.AcademyUI=update;

 function getFlagState(api){
  const g=api.game,student=id=>g.students.find(s=>s.id===id),name=id=>api.getHouse(id)?.name||'Rival house';
  const target=g.flagTargetId?g.standards.find(st=>st.houseId===g.flagTargetId||st.id===g.flagTargetId):null;
  const own=g.standards.find(st=>st.houseId==='player'),thief=own?.carriedBy?student(own.carriedBy):null;
  const carriers=g.students.filter(s=>s.controller==='player'&&s.state!=='knocked'&&s.carryingStandard);
  const carrier=carriers.find(s=>g.flagTargetId&&s.carryingStandard===g.flagTargetId)||carriers.find(s=>g.selected?.has(s.id))||carriers[0];
  const recovery=carriers.find(s=>s.carryingStandard==='player');
  const channel=g.standards.find(st=>st.captureController==='player'&&st.captureStudentId)||null;
  const selectedTarget=channel||target;
  if(thief&&thief.controller!=='player'&&!seen(api,thief))return {kind:'stolen',key:'stolen:unseen',title:'YOUR FLAG STOLEN',detail:'The carrier is out of sight. Scout the routes from your castle.',action:'View home ↗',focus:api.getPlayerHouse().castle,houseId:'player',progress:0};
  if(thief&&thief.controller!=='player')return {kind:'stolen',key:'stolen:'+thief.id,title:'YOUR FLAG STOLEN',detail:`Intercept ${thief.name} before they reach home.`,action:'Find thief ↗',focus:thief,houseId:'player',studentId:thief.id,progress:0};
  if(own?.dropped&&!own.carriedBy&&visible(api,own.x,own.y))return {kind:'danger',key:'dropped:player',title:'RECOVER YOUR FLAG',detail:'Your standard is on the ground. Bring it home.',action:'Find flag ↗',focus:own,houseId:'player',progress:0};
  if(recovery)return {kind:'carrier',key:'recovery:'+recovery.id,title:'YOUR FLAG RECOVERED — RETURNING HOME',detail:`Protect ${recovery.name} until your standard is safe.`,action:'Find carrier ↗',focus:recovery,houseId:'player',studentId:recovery.id,progress:1};
  if(selectedTarget&&!selectedTarget.carriedBy&&(channel===selectedTarget||visible(api,selectedTarget.x,selectedTarget.y))){
   const duration=selectedTarget.captureDuration||3,elapsed=Math.max(0,selectedTarget.captureProgress||0),left=Math.max(0,duration-elapsed).toFixed(1);
   if(selectedTarget.captureContested&&(selectedTarget.captureController==='player'||selectedTarget===target))return {kind:'contested',key:'contested:'+selectedTarget.houseId,title:'FLAG CONTESTED',detail:`Clear enemies, then hold ${duration}s at ${name(selectedTarget.houseId)}.`,action:'Find flag ↗',focus:selectedTarget,houseId:selectedTarget.houseId,progress:elapsed/duration};
   if(selectedTarget.captureInterruptedUntil>g.time)return {kind:'interrupted',key:'interrupted:'+selectedTarget.houseId,title:'CAPTURE INTERRUPTED',detail:`Hold beside ${name(selectedTarget.houseId)}’s flag for ${duration}s.`,action:'Find flag ↗',focus:selectedTarget,houseId:selectedTarget.houseId,progress:0};
   if(channel===selectedTarget&&elapsed>0)return {kind:'capturing',key:'capturing:'+selectedTarget.houseId,title:`TAKING ${name(selectedTarget.houseId).toUpperCase()} FLAG`,detail:`${left}s left · Stay close and avoid damage.`,action:'View flag ↗',focus:selectedTarget,houseId:selectedTarget.houseId,progress:elapsed/duration};
  }
  if(carrier)return {kind:'carrier',key:'carrier:'+carrier.id,title:'FLAG SECURED — ESCORT HOME',detail:`Protect ${carrier.name}, carrying ${name(carrier.carryingStandard)}’s flag.`,action:'Find carrier ↗',focus:carrier,houseId:carrier.carryingStandard,studentId:carrier.id,progress:1};
  if(target){
   const targetCarrier=target.carriedBy?student(target.carriedBy):null;
   if(targetCarrier&&!seen(api,targetCarrier))return {kind:'target',key:'target:unseen:'+target.houseId,title:'SCOUT THE TARGET FLAG',detail:'Its carrier is out of sight. Search near the rival castle.',action:'Scout castle ↗',focus:api.getHouse(target.houseId).castle,houseId:target.houseId,progress:0};
   if(targetCarrier)return {kind:'target',key:'targetcarrier:'+targetCarrier.id,title:`TRACK ${name(target.houseId).toUpperCase()} FLAG`,detail:`${targetCarrier.name} is carrying your target flag.`,action:'Find carrier ↗',focus:targetCarrier,houseId:target.houseId,studentId:targetCarrier.id,progress:0};
   if(!visible(api,target.x,target.y))return {kind:'target',key:'target:scout:'+target.houseId,title:'SCOUT '+name(target.houseId).toUpperCase(),detail:'Explore toward the rival castle to locate its flag.',action:'Scout castle ↗',focus:api.getHouse(target.houseId).castle,houseId:target.houseId,progress:0};
   return {kind:'target',key:'target:'+target.houseId,title:`CAPTURE ${name(target.houseId).toUpperCase()} FLAG`,detail:'Hold nearby for 3 seconds. Enemies or damage interrupt.',action:'Find flag ↗',focus:target,houseId:target.houseId,progress:0};
  }
  const home=api.getPlayerHouse().castle;
  const nearest=g.houses.filter(h=>h.controller!=='player').sort((a,b)=>Math.hypot(a.castle.x-home.x,a.castle.y-home.y)-Math.hypot(b.castle.x-home.x,b.castle.y-home.y))[0];
  return {kind:'idle',key:'idle',title:'BRING RIVAL FLAGS HOME',detail:'Choose a rival flag. Hold nearby for 3 seconds to take it.',action:'Find flag ↗',focus:nearest?.castle||home,houseId:nearest?.id,progress:0};
 }

 function updateFlagStatus(api){
  const state=getFlagState(api),chip=$('mission');ui.flagState=state;ui.flagFocus=state.focus;
  text($('flagStatusTitle'),state.title);text($('flagStatusDetail'),state.detail);text($('flagStatusAction'),state.action);
  chip.dataset.state=state.kind;chip.setAttribute('aria-label',`${state.title}. ${state.detail} ${state.action.replace(' ↗','')}.`);
  $('flagStatusProgress').style.width=`${Math.max(0,Math.min(1,state.progress))*100}%`;
  if(state.key!==ui.flagAnnounceKey){ui.flagAnnounceKey=state.key;text($('flagStatusAnnouncement'),state.title+'. '+state.detail);}
 }

 function focusFlagStatus(){
  if(!ui.api)return;const state=getFlagState(ui.api),point=state.studentId?ui.api.game.students.find(s=>s.id===state.studentId):state.focus;
  if(point){ui.api.centerCamera(point.x,point.y,false);ui.api.canvas.focus({preventScroll:true});drawMinimap(ui.api);}
 }

 function announceCastleChanges(api){
  const g=api.game,current=Object.fromEntries(g.houses.map(h=>[h.id,api.getHouse(h.controller)?.id||h.id]));
  if(ui.houseOwners&&ui.started&&!ui.menu){
   const changed=g.houses.filter(h=>ui.houseOwners[h.id]&&ui.houseOwners[h.id]!==current[h.id]&&(h.controller==='player'||ui.houseOwners[h.id]==='player'||visible(api,h.castle.x,h.castle.y)));
   const house=changed.find(h=>h.id===g.flagTargetId)||changed[0];
   if(house)toast(`${house.name} CAPTURED — now ruled by ${api.getHouse(current[house.id]).name}`,5000,'capture');
  }
  ui.houseOwners=current;
 }

 function drawMinimap(api){
  if($('minimapShell').classList.contains('collapsed'))return;
  const c=$('minimap').getContext('2d'),g=api.game,w=288,h=288,sx=w/api.WORLD_W,sy=h/api.WORLD_H;
  c.clearRect(0,0,w,h);c.fillStyle='#304a36';c.fillRect(0,0,w,h);
  c.strokeStyle='#638477';c.lineWidth=4;
  for(const river of g.terrain.rivers||[]){const pts=river.points||river.pts||[];if(pts.length){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x*sx,p.y*sy):c.moveTo(p.x*sx,p.y*sy));c.stroke();}}
  for(const water of g.terrain.waters||[]){c.fillStyle='#658986';if(water.rx||water.r){c.beginPath();c.ellipse(water.x*sx,water.y*sy,(water.rx||water.r)*sx,(water.ry||water.r)*sy,0,0,Math.PI*2);c.fill();}else if(water.w)c.fillRect(water.x*sx,water.y*sy,water.w*sx,water.h*sy);}
  for(const f of g.terrain.forestRects||[]){c.fillStyle='#233e2a';c.fillRect(f.x*sx,f.y*sy,f.w*sx,f.h*sy);}
  for(let y=0;y<h;y+=5)for(let x=0;x<w;x+=5){const wx=x/sx,wy=y/sy;if(!(api.isTerrainVisible?api.isTerrainVisible('player',wx,wy):visible(api,wx,wy))){c.fillStyle=explored(api,wx,wy)?'#101c2399':'#101b23';c.fillRect(x,y,5,5);}}
  for(const o of g.objectives){if(!explored(api,o.x,o.y))continue;if(visible(api,o.x,o.y))mapMemory[o.id]=o.controller;const owner=mapMemory[o.id];c.fillStyle=owner?api.getHouse(owner).color:'#d7c584';c.beginPath();c.arc(o.x*sx,o.y*sy,4,0,Math.PI*2);c.fill();if(o.contested&&visible(api,o.x,o.y)){c.strokeStyle='#eed9a6';c.stroke();}}
  for(const s of g.students){if(s.state==='knocked'||s.carryingStandard||!seen(api,s))continue;c.fillStyle=s.controller==='player'?'#a7d9ff':api.getHouse(s.controller).color;c.globalAlpha=s.controller==='player'?.95:.7;c.beginPath();c.arc(s.x*sx,s.y*sy,1.7,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  const castleMarkers=[],carrierMarkers=[];
  for(const house of g.houses){
   if(!explored(api,house.castle.x,house.castle.y))continue;
   if(house.controller==='player'||visible(api,house.castle.x,house.castle.y))mapMemory[house.id]=house.controller;
   const owner=api.getHouse(mapMemory[house.id]||house.id)||house,controller=owner.id,x=house.castle.x*sx,y=house.castle.y*sy,captured=controller!==house.id;
   c.fillStyle=owner.color;c.strokeStyle='#10221f';c.lineWidth=2;
   c.beginPath();c.moveTo(x-6,y+5);c.lineTo(x-6,y-5);c.lineTo(x-2,y-5);c.lineTo(x-2,y-2);c.lineTo(x+2,y-2);c.lineTo(x+2,y-5);c.lineTo(x+6,y-5);c.lineTo(x+6,y+5);c.closePath();c.fill();c.stroke();
   if(captured){c.strokeStyle=controller==='player'?'#e6f6ff':'#fff2d0';c.lineWidth=2.2;c.beginPath();c.moveTo(x-3,y+1);c.lineTo(x-1,y+3);c.lineTo(x+4,y-2);c.stroke();}
   if(house.id==='player'){c.strokeStyle='#ffe5a1';c.lineWidth=1.3;c.strokeRect(x-8,y-7,16,14);}
   castleMarkers.push({houseId:house.id,controller,captured});
  }
  const target=g.flagTargetId?g.standards.find(st=>st.houseId===g.flagTargetId):null;
  if(target&&!target.carriedBy&&visible(api,target.x,target.y)){
   const x=target.x*sx,y=target.y*sy,r=9+Math.sin(g.time*4)*1.5;
   c.strokeStyle='#11221b';c.lineWidth=6;c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();c.stroke();
   c.strokeStyle='#ffe09a';c.lineWidth=2.5;c.stroke();c.fillStyle='#ffe09a';c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();
  }
  for(const s of g.students.filter(s=>s.state!=='knocked'&&s.carryingStandard&&seen(api,s))){
   const x=s.x*sx,y=s.y*sy,danger=s.carryingStandard==='player'&&s.controller!=='player',color=danger?'#ffac8c':s.controller==='player'?'#ffe09a':api.getHouse(s.controller).color;
   c.strokeStyle='#10221f';c.lineWidth=5;c.beginPath();c.arc(x,y,8+Math.sin(g.time*5)*1.5,0,Math.PI*2);c.stroke();c.strokeStyle=color;c.lineWidth=2.5;c.stroke();
   c.fillStyle='#172e29';c.beginPath();c.arc(x,y,5.5,0,Math.PI*2);c.fill();c.strokeStyle=color;c.lineWidth=1.8;c.beginPath();c.moveTo(x-2,y+4);c.lineTo(x-2,y-5);c.lineTo(x+5,y-3);c.lineTo(x-2,y-1);c.stroke();
   carrierMarkers.push({studentId:s.id,houseId:s.carryingStandard,danger});
  }
  ui.mapMarkers={targetHouseId:target?.houseId||null,castles:castleMarkers,carriers:carrierMarkers};
  const mapLabel=`Minimap. Click to move the camera.${target?' Gold diamond marks '+api.getHouse(target.houseId).name+'’s target flag.':''}${carrierMarkers.length?' Large flag rings mark '+carrierMarkers.length+' carrier'+(carrierMarkers.length===1?'':'s')+'.':''} Checked castles belong to a conquering house.`;
  if($('minimap').getAttribute('aria-label')!==mapLabel)$('minimap').setAttribute('aria-label',mapLabel);
  const r=api.canvas.getBoundingClientRect();c.strokeStyle='#f0edc2b0';c.lineWidth=1.5;c.strokeRect(g.cam.x*sx,g.cam.y*sy,r.width*sx,r.height*sy);
 }

 function toggleDrawer(type){
  if(ui.drawer===type){closeDrawer();return;}
  ui.drawer=type;ui.drawerKey='';$('drawer').classList.remove('hidden');$('drawer').classList.toggle('armory-drawer',type==='equipment');renderDrawer(ui.api);
 }
 function closeDrawer(){ui.drawer=null;$('drawer').classList.add('hidden');if(!ui.menu&&$('modal').classList.contains('hidden'))ui.api?.canvas.focus({preventScroll:true});}
 function renderDrawer(api){
  if(!api)return;const g=api.game,sel=api.getSelectedUnits(),stock=api.getPlayerHouse().stockpile;
  const key=ui.drawer+'|'+sel.map(s=>`${s.id}:${ui.drawer==='equipment'?'':Math.round(s.hp)}:${s.weapon}:${s.item}:${s.state}`).join(',')+'|'+Object.values(stock).join(',')+'|'+g.houses.map(h=>h.controller).join(',')+'|'+g.activeSquad+'|'+JSON.stringify(window.AcademyArmory?.state)+'|'+g.students.filter(s=>s.controller==='player').map(s=>[s.id,s.weapon,s.weaponLevel,s.armor,s.item,s.mount,s.state].join(':')).join(',');
  if(key===ui.drawerKey)return;ui.drawerKey=key;
  let title='',eyebrow='',body='';
  if(ui.drawer==='equipment'){
   title='Outfit your party';eyebrow='EQUIPMENT & ROLES';
   const priorList=document.querySelector('.armory-students');if(priorList)window.AcademyArmory.state.open=priorList.open;
   body=window.AcademyArmory.render(api);
  }else if(ui.drawer==='roster'){
   title='Students & squads';eyebrow='YOUR PARTY';
   const units=g.students.filter(s=>s.controller==='player');
   body=`<p>Click a student to select them. Shift-click adds or removes students. Save a selection to a squad below.</p><div class="build-row"><button data-save="2">Save to 2</button><button data-save="3">Save to 3</button><button data-save="4">Save to 4</button></div><p><kbd>Ctrl + 2 / 3 / 4</kbd> also saves a squad.</p>${units.map(s=>`<button class="roster-card ${g.selected.has(s.id)?'active':''}" data-student="${s.id}"><div class="row"><b>${esc(s.name)}</b><small>${s.state==='knocked'?'Recovering':`${Math.ceil(s.hp)} / ${s.maxHp}`}</small></div><div class="health-track"><span style="width:${Math.max(0,s.hp/s.maxHp)*100}%"></span></div><small>${roleNames[api.getRole(s)]}${s.mount?' · Mounted':''} · ${s.weapon==='None'?'Unarmed':esc(s.weapon)}${s.item!=='None'?' · '+esc(gearNames[s.item]||s.item):''}</small></button>`).join('')}<button class="wide-button" data-reset-squads>Restore automatic role squads</button>`;
  }else if(ui.drawer==='standings'){
   title='The ten houses';eyebrow='RIVAL STANDARDS';
   const houses=[...g.houses].sort((a,b)=>(a.controller==='player'?-1:0)-(b.controller==='player'?-1:0)||a.name.localeCompare(b.name));
   body=`<p>Every castle keeps its house name. Its banner and the owner below show who rules it now. Checked castles on the minimap have been conquered.</p>${houses.map(h=>{const owner=api.getHouse(h.controller)||h,captured=owner.id!==h.id,active=g.students.filter(s=>s.origHouse===h.id&&s.state!=='knocked'&&seen(api,s)).length;return `<div class="house-row ${captured?'captured-house':''}" data-house-id="${h.id}" data-house-status="${captured?'captured':'independent'}"><div class="row"><span class="house-mark" style="color:${h.color}">${houseMarks[h.id]}</span><b>${esc(h.name)}</b><span class="ownership-badge ${owner.id==='player'?'yours':''}">${owner.id==='player'?'YOURS':captured?'CAPTURED':'FREE'}</span></div><small class="house-owner" style="color:${owner.color}">${captured?'✓ Ruled by '+esc(owner.name):'Independent house'}<span>${active} students ${h.controller==='player'?'ready':'in sight'}</span></small></div>`;}).join('')}`;
  }else if(ui.drawer==='strategy'){
   title='Fight with a plan';eyebrow='TERRAIN & TACTICS';body=`<p>Your students and castles share sight. Unexplored ground is hidden; explored ground stays dim until scouted again. Enemies disappear when sight is lost.</p><div class="terrain-guide">${[['forest',0,'Woodland','Walkable cover. Slower travel, shorter sight and concealed troops.'],['marsh',1,'Marsh','Slow ground. Horses lose more speed than infantry.'],['ridge',4,'Rocky ridge','Blocks movement and vision. Find a route around it.'],['ruins',5,'Ruins','Broken walls conceal troops and slow movement.'],['hill',6,'High ground','Wider sight and a longer view across the field.'],['road',8,'Road','Faster movement; useful for reinforcement and retreat.'],['river',15,'River & ford','Crossable shallows slow your march. Deep ponds block movement.']].map(([type,frame,name,description])=>`<div class="terrain-card"><span class="terrain-thumb" style="background-position:${(frame%4)*100/3}% ${Math.floor(frame/4)*100/3}%"></span><div><b>${name}</b><p>${description}</p></div></div>`).join('')}</div><p>Positioning and party composition change the outcome of a fight. Attacks land after a visible windup: watch the weapon, then reposition.</p>${api.getCounters().map(x=>`<div class="counter-card"><b>${esc(x.name)}</b><p>${esc(x.detail)}</p></div>`).join('')}<p>Taking a flag requires a 3-second hold nearby. Damage or nearby enemies interrupt it. Escort the carrier home to capture its castle.</p><p>Central sites grant speed, damage, healing or faster smithing. Enemy presence pauses their capture.</p>`;
  }
  text($('drawerTitle'),title);text($('drawerEyebrow'),eyebrow);html($('drawerBody'),body);
 }

 function openMenu(){
  if(!ui.api)return;ui.menu=true;ui.api.setPaused(true);closeDrawer();$('tooltip').classList.add('hidden');$('menu').classList.remove('hidden');$('pausedIndicator').classList.add('hidden');
  $('resumeGame').classList.toggle('hidden',!ui.started||ui.api.game.gameOver);text($('startGame'),ui.started?'Start a new trial':'Begin the trial');$('startGame').insertAdjacentHTML('beforeend',icon('arrow'));
  $('battlefield').inert=true;$('menu').inert=false;
  $('saveGame').classList.toggle('hidden',!ui.started||ui.api.game.gameOver);$('exportGame').classList.toggle('hidden',!ui.started||ui.api.game.gameOver);
  $('loadSaved').classList.toggle('hidden',!ui.savedSnapshot);
  (ui.started&&!ui.api.game.gameOver?$('resumeGame'):$('startGame')).focus();
 }
 function resume(){ui.menu=false;$('menu').classList.add('hidden');$('menu').inert=true;$('battlefield').inert=false;ui.api.setPaused(false);ui.api.canvas.focus({preventScroll:true});}
 function begin(){
  $('modal').classList.add('hidden');ui.modalDone=null;ui.houseOwners=null;ui.captureToastUntil=0;ui.flagAnnounceKey='';Object.keys(mapMemory).forEach(k=>delete mapMemory[k]);ui.api.init();ui.api.setDifficulty(ui.difficulty);ui.started=true;ui.outcome=false;ui.lastLog=null;ui.lastSaveTime=0;ui.drawerKey='';ui.api.selectSquad(1,true);ui.api.focusParty();resume();
  $('notice').classList.remove('show');ui.noticeUntil=0;
 }
 function showModal(title,body,button='Got it',onDone=null){
  ui.modalWasPaused=ui.api?.getPaused()??true;if(ui.api)ui.api.setPaused(true);text($('modalTitle'),title);html($('modalBody'),body);html($('modalDone'),esc(button)+icon('arrow'));ui.modalDone=onDone;$('modal').classList.remove('hidden');$('pausedIndicator').classList.add('hidden');$('battlefield').inert=true;$('menu').inert=true;$('modalDone').focus();
 }
 function closeModal(done=false){
  const callback=ui.modalDone;ui.modalDone=null;$('modal').classList.add('hidden');$('battlefield').inert=ui.menu;$('menu').inert=!ui.menu;if(done&&callback){callback();return;}if(!ui.menu&&ui.started&&!ui.api.game.gameOver){ui.api.setPaused(ui.modalWasPaused);ui.api.canvas.focus({preventScroll:true});}else if(ui.menu)(ui.started&&!ui.api.game.gameOver?$('resumeGame'):$('startGame')).focus();
 }
 function saveTrial(announce=true){
  if(!ui.api?.exportSave||!ui.started||ui.api.game.gameOver)return false;
  try{const snapshot=ui.api.exportSave();localStorage.setItem('academy-standards-save-v2',JSON.stringify(snapshot));ui.savedSnapshot=snapshot;ui.lastSaveTime=ui.api.game.time;$('loadSaved').classList.remove('hidden');if(announce){toast('Trial saved on this browser.');text($('saveGame'),'Saved ✓');setTimeout(()=>text($('saveGame'),'Save trial'),2000);}return true;}
  catch{ui.storageAvailable=false;if(announce)showModal('Keep your trial','<p>This browser cannot store a local save here. Choose Export save in the menu to keep your progress as a file.</p>','Got it');return false;}
 }
 function restore(snapshot){
  try{Object.keys(mapMemory).forEach(k=>delete mapMemory[k]);ui.houseOwners=null;ui.captureToastUntil=0;const result=ui.api.importSave(snapshot);if(!result||result.ok===false){console.warn('Saved trial rejected:',result?.error||'Invalid save');throw new Error('Invalid save');}ui.started=true;ui.outcome=false;ui.lastLog=null;ui.lastSaveTime=ui.api.game.time;ui.difficulty=ui.api.game.difficulty;ui.drawerKey='';resume();toast('Your saved party is ready.');}
  catch{showModal('This save could not be opened','<p>Choose an Academy Standards save created by this version of the game. Your current trial is still available.</p>','Got it');}
 }
 function exportTrial(){
  if(!ui.api.exportSave)return;const blob=new Blob([JSON.stringify(ui.api.exportSave())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Academy Standards - saved trial.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your trial was exported as a save file.');
 }
 function showHelp(){
  showModal('Lead your party',`<div class="help-step"><span>01</span><div><b>Choose a squad. Give one clear order.</b><p>Left click or drag to select students. Right click the ground to move, an enemy to attack, or a supply crate to collect its gear. Your camera follows the selected party.</p></div></div><div class="help-step"><span>02</span><div><b>Build a balanced party.</b><p>Vanguard protects your archers. Spears counter cavalry; cavalry threatens archers. Face shield troops toward incoming arrows, and flank heavy infantry. Attacks land after a visible windup, so timing and movement matter. Open Equipment, choose recipients, preview a role loadout and apply. Best gear · whole team fills slots and upgrades from shared supplies.</p></div></div><div class="help-step"><span>03</span><div><b>Bring their standards home.</b><p>Hold beside a rival flag for 3 seconds to take it. Damage or nearby enemies interrupt the hold. Your flag target is marked in gold; click the status above the field to find it. The carrier heads home automatically and moves more slowly. Select the carrier and guards, choose Escort, then right click the ground to assign bodyguards. Protect your own standard.</p></div></div><div class="help-step"><span>04</span><div><b>Control the center.</b><p>Scout before you commit. Forests and ruins hide troops, ridges block sight, marsh slows horses, hills extend sight, and roads speed travel. Veteran rivals rally, guard their castle, retreat and escort carriers. Stand inside a site to capture it. Capture pauses while enemies contest it. Rally grants speed, Arsenal improves attacks, Sanctum heals, and Forge speeds up weapon upgrades.</p></div></div><div class="help-keys"><span><kbd>1–4</kbd> Select squads</span><span><kbd>Ctrl + 2–4</kbd> Save a squad</span><span><kbd>Space</kbd> Pause and plan</span><span><kbd>F</kbd> Follow party</span><span><kbd>A</kbd> Attack move</span><span><kbd>D</kbd> Defend position</span><span><kbd>E</kbd> Escort carrier</span><span><kbd>R</kbd> Recall home</span><span><kbd>Arrows</kbd> Pan the map</span><span><kbd>Esc</kbd> Cancel / menu</span></div>`,'Ready');
 }
 function showOutcome(api){
  const win=api.getPlayerHouse().controller==='player';
  showModal(win?'One academy. Your standard.':'Your standard has fallen.',`<div class="outcome-title">${win?'VICTORY':'TRIAL ENDED'}</div><p>${win?'Every house now answers to House Augustus. Your party has united the academy.':'A rival returned your standard to their castle. Rebuild your strategy and lead a new party.'}</p><div class="outcome-stats"><span><b>${timeLabel(api.game.time)}</b>Trial time</span><span><b>${api.game.houses.filter(h=>h.controller==='player').length}</b>Houses ruled</span></div>`,'Return to menu',openMenu);
 }

 function setup(){
  ui.api=window.Academy;if(!ui.api)return;
  html($('squadButtons'),[1,2,3,4].map(i=>`<button id="squad${i}" class="squad-button" data-squad="${i}" title="${i===1?'Select all students':`Select squad ${i}. Ctrl-click to save your current selection here.`}">${icon(squadIcons[i])}<span class="squad-label"><strong>${['','All students','Vanguard','Ranged','Support'][i]}</strong><small>Ready</small><span class="squad-health"><i></i></span></span><kbd>${i}</kbd></button>`).join(''));
  $('squadButtons').addEventListener('click',e=>{const b=e.target.closest('[data-squad]');if(!b)return;const i=Number(b.dataset.squad);if(e.ctrlKey&&i>1){ui.api.saveSquad(i);toast(`Squad ${i} saved.`);}else{ui.api.selectSquad(i,true);ui.api.focusParty();}ui.api.canvas.focus({preventScroll:true});update(ui.api);});
  $('orderButtons').addEventListener('click',e=>{const b=e.target.closest('[data-order]');if(b){ui.api.setMode(ui.api.getMode()===b.dataset.order?'move':b.dataset.order);update(ui.api);ui.api.canvas.focus({preventScroll:true});}});
  document.querySelectorAll('[data-formation]').forEach(b=>b.addEventListener('click',()=>{ui.api.setFormation(b.dataset.formation);ui.api.canvas.focus({preventScroll:true});}));
  $('openMenu').addEventListener('click',openMenu);$('resumeGame').addEventListener('click',resume);
  try{const saved=localStorage.getItem('academy-standards-save-v2');if(saved){ui.savedSnapshot=JSON.parse(saved);$('loadSaved').classList.remove('hidden');}}catch{ui.storageAvailable=false;}
  $('saveGame').addEventListener('click',()=>saveTrial());$('loadSaved').addEventListener('click',()=>{if(ui.started&&!ui.api.game.gameOver)showModal('Continue the saved trial?','<p>Your current unsaved trial will be replaced by your last saved party.</p>','Continue saved trial',()=>restore(ui.savedSnapshot));else restore(ui.savedSnapshot);});$('exportGame').addEventListener('click',exportTrial);$('importGame').addEventListener('click',()=>$('saveFile').click());
  $('saveFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3000000)throw new Error();const snapshot=JSON.parse(await file.text());if(ui.started&&!ui.api.game.gameOver)showModal('Load this saved trial?','<p>Your current unsaved trial will be replaced by the selected saved party.</p>','Load trial',()=>restore(snapshot));else restore(snapshot);}catch{showModal('This file could not be opened','<p>Choose a valid Academy Standards saved trial.</p>','Got it');}finally{e.target.value='';}});
  $('startGame').addEventListener('click',()=>ui.started&&!ui.api.game.gameOver?showModal('Start a new trial?','<p>Your current trial will end. The new party will begin at House Augustus with the selected challenge.</p>','Start new trial',begin):begin());
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{ui.difficulty=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(x=>x.classList.toggle('active',x===b));}));
  $('howToPlay').addEventListener('click',showHelp);$('helpToggle').addEventListener('click',()=>toggleDrawer('strategy'));
  $('pauseToggle').addEventListener('click',()=>{if(!ui.menu)ui.api.setPaused(!ui.api.getPaused());});
  $('fullscreenToggle').addEventListener('click',toggleFullscreen);$('menuFullscreen').addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',refreshFullscreen);document.addEventListener('webkitfullscreenchange',refreshFullscreen);refreshFullscreen();
  $('focusParty').addEventListener('click',()=>{ui.api.focusParty();ui.api.canvas.focus({preventScroll:true});});$('focusHome').addEventListener('click',()=>{ui.api.focusHome();ui.api.canvas.focus({preventScroll:true});});
  $('recallParty').addEventListener('click',()=>{ui.api.recall();ui.api.canvas.focus({preventScroll:true});toast('Selected students are returning home.');});
  $('mission').addEventListener('click',focusFlagStatus);
  $('mapToggle').addEventListener('click',()=>{const collapsed=$('minimapShell').classList.toggle('collapsed');text($('mapChevron'),collapsed?'+':'−');if(!collapsed)drawMinimap(ui.api);});
  $('minimap').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();ui.api.centerCamera((e.clientX-r.left)/r.width*ui.api.WORLD_W,(e.clientY-r.top)/r.height*ui.api.WORLD_H,false);drawMinimap(ui.api);});
  $('equipmentToggle').addEventListener('click',()=>toggleDrawer('equipment'));$('rosterToggle').addEventListener('click',()=>toggleDrawer('roster'));$('standingsToggle').addEventListener('click',()=>toggleDrawer('standings'));$('closeDrawer').addEventListener('click',closeDrawer);
  $('drawerBody').addEventListener('click',e=>{
   if(ui.drawer==='equipment'&&window.AcademyArmory.handleClick(e,ui.api,toast)){ui.drawerKey='';update(ui.api);return;}
   const equip=e.target.closest('[data-equip]'),gear=e.target.closest('[data-gear]'),student=e.target.closest('[data-student]'),save=e.target.closest('[data-save]'),build=e.target.closest('[data-build]');
   if(equip){if(!ui.api.getSelectedUnits().length){toast('Select a student or squad first.');return;}equip.dataset.equip==='auto'?ui.api.autoEquipSelected():ui.api.equipPreset(equip.dataset.equip);}
   if(gear)ui.api.spendLootOnSelected(gear.dataset.gear);
   if(student){const id=student.dataset.student,s=ui.api.game.students.find(s=>s.id===id);if(s.state==='knocked'){toast('This student is recovering and will return shortly.');return;}let ids=e.shiftKey?ui.api.getSelectedUnits().map(s=>s.id):[];ids=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];ui.api.selectUnits(ids,true);ui.api.focusParty();}
   if(save){ui.api.saveSquad(Number(save.dataset.save));toast(`Selection saved to squad ${save.dataset.save}.`);}
   if(build){ui.api.setMode(build.dataset.build);closeDrawer();toast(`Right click the battlefield to place a ${build.dataset.build}.`);}
   if(e.target.closest('[data-reset-squads]')){[2,3,4].forEach(i=>ui.api.resetSquad(i));toast('Squads now follow student roles automatically.');}
   ui.drawerKey='';update(ui.api);
  });
  $('closeModal').addEventListener('click',()=>{if(ui.api.game.gameOver)openMenu();closeModal();});$('modalDone').addEventListener('click',()=>closeModal(true));
  $('modal').addEventListener('click',e=>{if(e.target===$('modal')&&!ui.api.game.gameOver)closeModal();});
  ui.api.canvas.addEventListener('mousemove',e=>{
   if(ui.menu||!$('modal').classList.contains('hidden')||performance.now()-tipAt<85)return;tipAt=performance.now();const r=ui.api.canvas.getBoundingClientRect(),p=ui.api.screenToWorld(e.clientX-r.left,e.clientY-r.top);
   const s=ui.api.hitStudent(p.x,p.y,s=>s.state!=='knocked'&&seen(ui.api,s));const tip=$('tooltip');
   if(!s){tip.classList.add('hidden');return;}
   const selected=ui.api.getSelectedUnits()[0],match=selected&&s.controller!=='player'?ui.api.combatMatchup(selected,s):null;
   html(tip,`<b>${esc(s.name)}</b><span>${esc(ui.api.getHouse(s.origHouse).name)} · ${roleNames[ui.api.getRole(s)]}${s.mount?' · Mounted':''}<br>${Math.ceil(s.hp)} / ${s.maxHp} HP · ${esc(s.weapon)}${s.carryingStandard?'<br>Carrying a standard':''}</span>${match?.label?`<div class="matchup">${esc(match.label)}</div>`:''}`);
   tip.style.left=`${Math.min(e.clientX+18,window.innerWidth-240)}px`;tip.style.top=`${Math.max(75,Math.min(e.clientY+18,window.innerHeight-230))}px`;tip.classList.remove('hidden');
  });ui.api.canvas.addEventListener('mouseleave',()=>$('tooltip').classList.add('hidden'));
  window.onAcademyEscape=()=>{if(!$('modal').classList.contains('hidden')){closeModal();return;}if(ui.api.getPlacementMode()||ui.api.getMode()!=='move'){ui.api.setMode('move');update(ui.api);return;}if(ui.drawer){closeDrawer();return;}if(ui.menu){if(ui.started&&!ui.api.game.gameOver)resume();}else openMenu();};
  window.onAcademyPause=()=>update(ui.api);
  ui.api.selectSquad(1,true);ui.api.focusParty();update(ui.api);
  $('startGame').focus();window.AcademyShell={ui,begin,resume,openMenu,showHelp,toggleDrawer,closeDrawer,update,drawMinimap,getFlagState,focusFlagStatus,saveTrial,restore,toggleFullscreen,refreshFullscreen};
 }
 window.addEventListener('keydown',e=>{
  const overlay=!$('modal').classList.contains('hidden')?$('modal'):ui.menu?$('menu'):null;
  if(overlay&&e.key==='Tab'){
   const buttons=[...overlay.querySelectorAll('button,input,a,[tabindex]')].filter(x=>!x.disabled&&!x.hidden&&!x.closest('.hidden'));
   const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){e.preventDefault();first?.focus();}
  }
  if(overlay&&e.key!=='Escape'&&e.key!=='Tab'){e.stopImmediatePropagation();if(e.code==='Space'&&e.target?.tagName!=='BUTTON')e.preventDefault();}
 },true);
 window.addEventListener('blur',()=>{if(ui.started&&!ui.menu&&ui.api&&!ui.api.game.gameOver)ui.api.setPaused(true);});
 window.addEventListener('load',setup);
})();

