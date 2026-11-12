import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS,HOUSE_CONTENT} from './core.js';
import {Renderer,worldToScreen,screenToWorld} from './render.js';
import {LAND_MAPS,isPassableTile,tileTravelCost} from './lands.js';

const $=id=>document.getElementById(id),canvas=$('battleCanvas'),field=$('battlefield');
const hudMarkup=new WeakMap();
function setHudHTML(element,markup){if(hudMarkup.get(element)!==markup){element.innerHTML=markup;hudMarkup.set(element,markup);}}
const renderer=new Renderer(canvas),view={x:0,y:0,zoom:1,w:800,h:600,dpr:Math.min(window.devicePixelRatio||1,2)};
const ui={selected:new Set(),selectedBuildings:new Set(),rallyMode:false,teamOrderMode:null,hover:null,drag:null,buildMode:null,orderMarker:null,showGrid:true,quality:'auto',formation:'line'};
let game=new Game({enemies:3,scale:'epic',seed:628410}),started=false,menuOpen=true,chosenHouse=0,orderMode='attack',speed=1;
let toastUntil=0,lastEvent=0,lastHud=0,lastMini=0,lastNow=performance.now(),accumulator=0,fps=60,frameMs=16.7,lastResult=null,wasPaused=false;
const keys=new Set(),groups=new Map(),pointers=new Map();let gesture=null,pinch=null,edgeMouse=null,allSelected=false,allBuildingsSelected=false;
let audio=null,sound=true,lastSfx=0,lastBattle=0,tab='army';
const icons={infantry:'shield',archer:'bow',cavalry:'horse',siege:'siege',barracks:'shield',range:'bow',stables:'horse',tower:'castle',workshop:'siege',weapons:'swords',armor:'shield',economy:'coin'};
const HOUSE_ART_SOURCES={troops:Object.fromEntries(HOUSES.map(h=>[h.sigil,`assets/houses/${h.sigil}-troops.png`])),castles:'assets/house-castles.png',production:'assets/house-production.png'};
const MENU_TAB_KEYS={u:'army',b:'build',c:'council'};
const MENU_ACTIONS={
 army:['[data-recruit="infantry"]','[data-recruit="archer"]','[data-recruit="cavalry"]','[data-recruit="siege"]','[data-special-recruit]'],
 build:['[data-build="barracks"]','[data-build="range"]','[data-build="stables"]','[data-build="tower"]','[data-build="workshop"]','[data-special-build]'],
 council:['#housePowerButton','[data-upgrade="weapons"]','[data-upgrade="armor"]','[data-upgrade="economy"]','#compareHousesCouncilButton','#townHallUpgradeButton']
};
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const houseEmblem=index=>`<span class="sigil house-sigil-art" aria-hidden="true" style="background-position:${index%4*100/3}% ${Math.floor(index/4)*100/3}%"></span>`;
const short=name=>name.replace('House ','');
const num=n=>Math.floor(n||0).toLocaleString('en-US');
function compactGold(value){return value<1000?num(value):new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);}
function bonusText(value){return '+'+(value*100).toLocaleString('en-US',{maximumFractionDigits:1})+'%';}
function upgradeSummary(kind,details){const label={weapons:'Damage',armor:'Health',economy:'Income'}[kind];return details.level>=details.max?`${label} ${bonusText(details.currentBonus)} · maximum reached`:`${label} ${bonusText(details.currentBonus)} → ${bonusText(details.nextBonus)}`;}
function upgradeTooltip(kind,details){const label={weapons:'Army damage',armor:'Army health',economy:'Income'}[kind],current=`Level ${details.level} / ${details.max}. ${label}: ${bonusText(details.currentBonus)}.`;return details.level>=details.max?current+' Maximum level reached.':`${current} Next level: ${bonusText(details.nextBonus)} (${bonusText(details.nextBonus-details.currentBonus)} more). Cost: ${num(details.cost)} gold. ${kind==='economy'?'Treasury gains diminish at higher levels.':'Each level adds 2% of the base stat.'} Prices rise more steeply with each level.`;}
function specialistTooltip(type){const d=UNIT_DEFS[type];return d.impact?`${d.label} · ${d.impactName||'Specialist effect'}: ${d.impact}`:d.role;}
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const iso=p=>({x:(p.x-p.y)*28,y:(p.x+p.y)*14});
const percent=s=>Math.round(s.tiles/game.playable*100);
const selected=()=>game.units.filter(u=>u.team===0&&u.hp>0&&ui.selected.has(u.id));
const selectedBuildings=()=>game.buildings.filter(b=>b.team===0&&b.hp>0&&ui.selectedBuildings.has(b.id));
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const houseData=team=>HOUSES[game.teams[team]?.house??0]||HOUSES[0];
const houseAdvantages=h=>Array.isArray(h.advantages)&&h.advantages.length?h.advantages:[h.trait||'Command your house to victory.'];
const houseWeaknesses=h=>Array.isArray(h.weaknesses)?h.weaknesses:[];
const powerData=h=>h.power||{name:'House power',description:'Your house has a unique battlefield power.',cooldown:45,cost:0};

function resize(){const r=field.getBoundingClientRect();view.w=r.width;view.h=r.height;renderer.resize(view.w,view.h,view.dpr);}
new ResizeObserver(resize).observe(field);resize();
function minZoom(){return Math.max(.008,Math.min(.08,(view.w-36)/((game.W+game.H)*28+80),(view.h-100)/((game.W+game.H)*14+110)));}
function setCamera(x,y,zoom=view.zoom){view.x=x;view.y=y;view.zoom=clamp(zoom,minZoom(),2.6);boundCamera();}
function boundCamera(){view.x=clamp(view.x,-game.H*28,game.W*28);view.y=clamp(view.y,-80,(game.W+game.H)*14+80);}
function fitMap(){view.zoom=clamp(Math.min((view.w-60)/((game.W+game.H)*28+80),(view.h-180)/((game.W+game.H)*14+110)),minZoom(),1.2);view.x=(game.W-game.H)*14;view.y=(game.W+game.H)*7+25;}
function focusPoint(x,y,zoom=view.zoom){const p=iso({x,y});setCamera(p.x,p.y,zoom);}
function home(){const p=game.teams[0].home;focusPoint(p.x,p.y,1.3);}
function zoomAt(factor,sx=view.w/2,sy=view.h/2){const p=screenToWorld(sx,sy,view);view.zoom=clamp(view.zoom*factor,minZoom(),2.6);const q=iso(p);view.x=q.x-(sx-view.w/2)/view.zoom;view.y=q.y-(sy-view.h/2)/view.zoom;boundCamera();}
function toast(message,bad=false){$('toast').textContent=message;$('toast').style.borderColor=bad?'#b66c55':'#8d7c52';$('toast').classList.add('visible');toastUntil=performance.now()+3400;}
function initAudio(){if(!audio)try{audio=new(window.AudioContext||window.webkitAudioContext)();}catch{}if(audio?.state==='suspended')audio.resume().catch(()=>{});}
function tone(freq=240,kind='click',gain=.025){if(!sound||!audio||audio.state!=='running')return;const t=audio.currentTime;const osc=audio.createOscillator(),g=audio.createGain();osc.type=kind==='battle'?'triangle':'sine';osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(freq*.55,t+.12);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+.16);osc.connect(g).connect(audio.destination);osc.start(t);osc.stop(t+.18);}

function chooseHouse(index){
 chosenHouse=index;const h=HOUSES[index],power=powerData(h);document.querySelectorAll('.house-choice').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});$('chosenTrait').textContent=`“${h.motto}.”`;
 $('chosenHouseName').textContent=h.name;$('menuSelectedHouse').textContent=h.name;$('chosenHouseEmblem').style.backgroundPosition=`${index%4*100/3}% ${Math.floor(index/4)*100/3}%`;$('chosenHouseEmblem').setAttribute('aria-label',h.name+' heraldry');
 $('chosenPlaystyle').textContent=h.playstyle||h.trait;$('chosenAdvantages').innerHTML=houseAdvantages(h).map(text=>`<li>${escapeHTML(text)}</li>`).join('');
 $('chosenWeaknesses').innerHTML=houseWeaknesses(h).map(text=>`<li>${escapeHTML(text)}</li>`).join('');
 $('chosenPower').innerHTML=`<b>${escapeHTML(power.name)}</b><span>${escapeHTML(power.description)}</span><small>${power.cost?`${power.cost} gold · `:''}${power.cooldown}s cooldown · Activate with E</small>`;
 $('compareHousesButton').textContent='House details';$('compareHousesCouncilButton').textContent=`Compare all ${HOUSES.length} houses →`;$('houseCountPromise').textContent=`${HOUSES.length} houses · Equal starts`;labelMenuHotkeys();paintHousePreview();
}
function chooseMenuTab(tab,focus=false){
 const selected=tab==='campaign'?'campaign':'house';$('menuOverlay').dataset.menuTab=selected;
 for(const [name,id]of [['house','menuHouseTab'],['campaign','menuCampaignTab']]){const button=$(id),active=name===selected;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();}
}
for(const [name,id]of [['house','menuHouseTab'],['campaign','menuCampaignTab']]){
 $(id).addEventListener('click',()=>chooseMenuTab(name));
 $(id).addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();chooseMenuTab(e.key==='Home'?'house':e.key==='End'?'campaign':name==='house'?'campaign':'house',true);});
}
chooseMenuTab('house');
$('houseChoices').innerHTML=HOUSES.map((h,i)=>`<button class="house-choice${i===0?' active':''}" data-house="${i}" title="${h.motto}" style="--color:${h.color}">${houseEmblem(i)}${short(h.name)}</button>`).join('');
$('houseChoices').addEventListener('click',e=>{const b=e.target.closest('[data-house]');if(b)chooseHouse(+b.dataset.house);});chooseHouse(0);
const difficultyDescriptions={relaxed:'Easy · Deliberate expansion gives you time to gather and plan.',standard:'Normal · Balanced expansion, defenses, and coordinated attacks.',veteran:'Hard · Rivals coordinate attacks and react quickly to exposed frontiers.',warlord:'Warlord · Quick strategic decisions, adaptive reserves and coordinated attacks across multiple fronts.'};
function updateDifficultyDescription(){$('difficultyDescription').textContent=difficultyDescriptions[$('difficultySelect').value]||difficultyDescriptions.standard;}
$('difficultySelect').addEventListener('change',updateDifficultyDescription);updateDifficultyDescription();
const modeDescriptions={conquest:'Conquest · Break every enemy capital. Flags grant elite reinforcements.',bannerfall:'Bannerfall · Reach 5 flag captures, or defeat every enemy capital. Each flag also grants Royal Guard.',dominion:'Dominion · Unite 65% of the realm after 90 seconds, or eliminate every enemy capital.'};
function updateModeDescription(){
 const value=$('modeSelect').value,team=value.startsWith('team-'),base=value.replace('team-',''),prior=$('enemySelect').value;
 const options=team?[[3,'2 teams · 2 vs 2'],[5,'3 teams · 2 per team'],[7,'4 teams · 2 per team'],[11,'6 teams · 2 per team'],[15,'8 teams · 2 per team']]:[[1,'1 · Duel'],[3,'3 · War of four houses'],[5,'5 · Grand campaign'],[7,'7 · Eight-house war'],[11,'11 · Great host'],[15,'15 · Sixteen-house total war']];
 $('enemySelect').innerHTML=options.map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join('');$('enemySelect').value=options.some(([v])=>String(v)===prior)?prior:'3';
 $('factionCountLabel').textContent=team?'Alliance setup':'Rival houses';$('modeDescription').textContent=modeDescriptions[base]+(team?' You lead one house with an allied bot. Share flag control, score and team colors.':' Every house fights for itself.')+' Your town hall must survive.';
}
$('modeSelect').addEventListener('change',updateModeDescription);updateModeDescription();
const landscapePreviewCache=new Map();
function updateLandscapeDescription(){
 const map=LAND_MAPS.find(m=>m.id===$('landscapeSelect').value)||LAND_MAPS[0];$('landscapeDescription').textContent=map.description;
 const preview=$('landscapePreview'),c=preview.getContext('2d'),key=map.id+':'+preview.width+'x'+preview.height,cached=landscapePreviewCache.get(key);$('landscapePreviewName').textContent=map.label;
 if(cached){c.putImageData(cached,0,0);return;}
 const sample=new Game({landscape:map.id,scale:'standard',enemies:3,seed:628410}),sx=preview.width/sample.W,sy=preview.height/sample.H;
 c.fillStyle='#182b2e';c.fillRect(0,0,preview.width,preview.height);
 for(const t of sample.tiles){c.fillStyle=t.feature==='bridge'?'#e4c995':t.feature==='ford'?'#a4b5a3':t.feature==='road'?'#bfa676':t.feature==='pass'?'#b9b39a':t.terrain==='water'?'#397a88':t.terrain==='mountain'?'#8b8c80':t.terrain==='forest'?'#34543d':t.terrain==='hill'?'#797b54':'#67805a';c.fillRect(t.x*sx,t.y*sy,Math.ceil(sx),Math.ceil(sy));}
 for(const s of sample.teams){c.beginPath();c.arc(s.home.x*sx,s.home.y*sy,3.5,0,Math.PI*2);c.fillStyle='#ead7a5';c.fill();c.strokeStyle='#21322c';c.lineWidth=1.5;c.stroke();}
 landscapePreviewCache.set(key,c.getImageData(0,0,preview.width,preview.height));
}
$('landscapeSelect').innerHTML=LAND_MAPS.map(m=>'<option value="'+escapeHTML(m.id)+'">'+escapeHTML(m.label)+'</option>').join('');$('landscapeSelect').value='crownlands';$('landscapeSelect').addEventListener('change',updateLandscapeDescription);updateLandscapeDescription();
function terrainDescription(t){
 if(!t)return 'Sea · choose a bridge or ford to cross';
 const label=t.feature==='bridge'?'Bridge':t.feature==='ford'?'Shallow ford':t.feature==='pass'?'Mountain pass':t.feature==='road'?'Road':({water:'Deep water',mountain:'Mountain',forest:'Forest',hill:'Highlands',grass:'Open ground'})[t.terrain]||'Ground';
 if(!isPassableTile(t))return label+' · impassable';
 if(t.feature==='bridge')return label+' · narrow crossing · keep approaches clear';
 if(t.feature==='ford')return label+' · slow crossing · exposed troops';
 if(t.feature==='pass')return label+' · the route through impassable peaks';
 if(t.feature==='road')return label+' · faster march · all houses';
 const foot=tileTravelCost(t,'infantry'),horse=tileTravelCost(t,'cavalry');return label+(horse>foot+.1?' · cavalry moves slower':t.terrain==='hill'?' · slower climb · valuable land':' · passable');
}
function buildActionLists(){
 const house=game.houseContent(0);
 $('recruitList').innerHTML=['infantry','archer','cavalry','siege',house.unit].map(type=>{const d=UNIT_DEFS[type],special=type===house.unit;return `<button class="action-card${special?' house-special-card':''}" data-recruit="${type}"${special?' data-special-recruit':''} title="${escapeHTML(specialistTooltip(type))}">${special?`<span class="building-art" aria-hidden="true"><canvas data-unit-icon="${type}" width="96" height="96"></canvas></span>`:icon(icons[type])}<span class="action-copy"><span class="action-title"><b>${d.label}<span id="recruitBatch-${type}" style="font:8px 'Segoe UI';color:#718e87"> ×${d.batch}</span></b></span><small>${special?`Requires ${BUILD_DEFS[house.building].label}`:d.role.split(' · ').pop()}</small></span><span class="cost" id="recruitCost-${type}">${d.cost}<small>GOLD</small></span></button>`;}).join('');
 $('buildList').innerHTML=['barracks','range','stables','tower','workshop',house.building].map(type=>{const d=BUILD_DEFS[type];return `<button class="action-card building-card${type===house.building?' house-special-card':''}" data-build="${type}"${type===house.building?' data-special-build':''} title="${d.role}"><span class="building-art" aria-hidden="true"><canvas data-building-icon="${type}" width="96" height="96"></canvas></span><span class="action-copy"><span class="action-title"><b>${d.label}</b></span><small>${d.role.replace(' · ',' / ')}</small></span><span class="cost">${d.cost}<small>GOLD</small></span></button>`;}).join('');
 $('upgradeList').innerHTML=[['weapons','Tempered steel'],['armor','Reinforced armor'],['economy','Royal treasury']].map(([type,label])=>`<button class="action-card" data-upgrade="${type}">${icon(icons[type])}<span class="action-copy"><span class="action-title"><b>${label}</b></span><small id="upgradeEffect-${type}">${upgradeSummary(type,game.upgradeDetails(type,0))}</small></span><span class="cost" id="cost-${type}">200<small>0 / 500</small></span></button>`).join('');
 labelMenuHotkeys();
}
function labelMenuHotkeys(){
 for(const actions of Object.values(MENU_ACTIONS))actions.forEach((selector,index)=>{
  const button=document.querySelector(selector);if(!button)return;
  const shortcut=`Shift+${index+1}`;button.setAttribute('aria-keyshortcuts',shortcut+(selector==='#housePowerButton'?' E':''));
  if(button.dataset.shortcutTitle===undefined)button.dataset.shortcutTitle=button.title;
  button.title=[button.dataset.shortcutTitle,shortcut].filter(Boolean).join(' · ');
  if(!button.querySelector('.menu-hotkey')){const badge=document.createElement('kbd');badge.className='menu-hotkey';badge.textContent=`⇧${index+1}`;badge.setAttribute('aria-hidden','true');(button.querySelector('.action-title')||button).append(badge);}
 });
}
function paintBuildingIcons(){
 if(!renderer.structuresReady)return;
 for(const canvas of document.querySelectorAll('[data-building-icon]')){
  paintStructurePortrait(canvas,canvas.dataset.buildingIcon,game.teams[0]);
 }
 for(const canvas of document.querySelectorAll('[data-unit-icon]'))paintTroopPortrait(canvas,canvas.dataset.unitIcon,game.teams[0]);
}
function paintStructurePortrait(canvas,type,house){
  if(renderer.campaignArtReady&&typeof renderer.drawStructurePortrait==='function'){renderer.drawStructurePortrait(canvas,type,house,1);return;}
  const frame=renderer.getStructureFrame(type,house.sigil),sprite=renderer.structureSprite(type,house.color,house.sigil);if(!frame||!sprite)return;
  const ctx=canvas.getContext('2d'),scale=Math.min(88/frame.drawWidth,88/frame.drawHeight),w=frame.drawWidth*scale,h=frame.drawHeight*scale;
  ctx.clearRect(0,0,96,96);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(sprite,(70-frame.drawWidth/2)*2,(146-frame.drawHeight)*2,frame.drawWidth*2,frame.drawHeight*2,(96-w)/2,(96-h)/2,w,h);
}
function paintTroopPortrait(canvas,type,house){
 const row=renderer.getTroopFrame(type,house.sigil),frame=row?.frames[0];if(!frame)return;
 const ctx=canvas.getContext('2d'),scale=Math.min(88/frame.width,88/frame.height),w=frame.width*scale,h=frame.height*scale;
 ctx.clearRect(0,0,96,96);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(frame.image,frame.left,frame.top,frame.width,frame.height,(96-w)/2,(96-h)/2,w,h);
}
function paintHousePreview(){
 const house=HOUSES[chosenHouse],content=HOUSE_CONTENT[house.sigil];
 $('chosenSpecialistName').textContent=UNIT_DEFS[content.unit].label;$('chosenProductionName').textContent=BUILD_DEFS[content.building].label;$('chosenCastleName').textContent=content.castleName;
 $('chosenSpecialistImpact').textContent=content.impact?`${content.impactName}: ${content.impact}`:'';
 if(!renderer.houseArtReady)return;
 paintTroopPortrait($('chosenTroopArt'),content.unit,house);paintStructurePortrait($('chosenProductionArt'),content.building,house);paintStructurePortrait($('chosenCastleArt'),'keep',house);
}
buildActionLists();
function showTab(name){if(!MENU_ACTIONS[name])return;cancelBuild();tab=name;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-selected',String(b.dataset.tab===name));});['army','build','council'].forEach(n=>$(n+'Tab').hidden=n!==name);$('menuShortcutHint').textContent=`Shift+1–${MENU_ACTIONS[name].length}: ${name==='army'?'recruit companies':name==='build'?'choose a building':'Council actions'} · ⇧ means Shift`;$('panelTabs').scrollIntoView({block:'nearest'});}
function handleMenuHotkey(e){
 if(e.ctrlKey||e.metaKey||e.altKey)return false;
 const name=MENU_TAB_KEYS[e.key.toLowerCase()];
 if(name){e.preventDefault();showTab(name);updateHud();return true;}
 const digit=/^(?:Digit|Numpad)([1-6])$/.exec(e.code)?.[1];
 if(!e.shiftKey||!digit)return false;
 e.preventDefault();updateHud();
 const selector=MENU_ACTIONS[tab][Number(digit)-1],button=selector?document.querySelector(selector):null;
 if(!button)toast(`This menu has ${MENU_ACTIONS[tab].length} items. Use Shift+1–${MENU_ACTIONS[tab].length}.`);
 else if(button.disabled)toast('This item is unavailable. Check gold, supply, structure capacity or power cooldown.',true);
 else button.click();
 return true;
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('recruitList').addEventListener('click',e=>{const b=e.target.closest('[data-recruit]');if(!b||b.disabled||!started||menuOpen)return;const r=game.recruit(b.dataset.recruit);toast(r.message,!r.ok);if(r.ok)tone(360);updateHud();});
$('buildList').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(!b||b.disabled||!started||menuOpen)return;cancelBuild();ui.buildMode=b.dataset.build;$('buildBanner').hidden=false;document.body.classList.add('placing');toast(`Place ${BUILD_DEFS[ui.buildMode].label.toLowerCase()} on your land.`);});
$('upgradeList').addEventListener('click',e=>{const b=e.target.closest('[data-upgrade]');if(!b||b.disabled||!started||menuOpen)return;const r=game.upgrade(b.dataset.upgrade);toast(r.message,!r.ok);if(r.ok)tone(480);updateHud();});
function cancelBuild(){ui.buildMode=null;ui.rallyMode=false;ui.teamOrderMode=null;$('buildBanner').hidden=true;$('buildBanner').firstChild.textContent='Choose a clear tile in your territory ';document.body.classList.remove('placing');}
$('cancelBuild').onclick=()=>{cancelBuild();updateHud();};
function beginTeamOrder(kind){
 if(!started||menuOpen||game.winner!==null||!game.teams[0].alive)return;
 cancelBuild();ui.teamOrderMode=kind;$('buildBanner').firstChild.textContent=kind==='assault'?'Click a target for your allied assault ':'Click a position for allied defense ';$('buildBanner').hidden=false;document.body.classList.add('placing');canvas.focus();updateHud();
}
function placeTeamOrder(x,y){
 const kind=ui.teamOrderMode,r=game.callTeamOrder(kind,x,y,0);toast(r.message,!r.ok);
 if(r.ok){ui.orderMarker={x,y,time:game.time,mode:'team-'+kind};cancelBuild();tone(kind==='assault'?240:430);}updateHud();
}
$('teamAssaultButton').onclick=()=>beginTeamOrder('assault');$('teamDefendButton').onclick=()=>beginTeamOrder('defend');
$('townHallUpgradeButton').onclick=()=>{if(!started||menuOpen)return;const r=game.upgradeTownHall(0);toast(r.message,!r.ok);if(r.ok){tone(470);paintTownHall();}updateHud();};
$('upgradeTowerButton').onclick=()=>{if(!started||menuOpen||game.winner!==null)return;const towers=selectedBuildings();if(towers.length!==1||towers[0].type!=='tower')return;const r=game.upgradeTower(towers[0].id,0);toast(r.message,!r.ok);if(r.ok)tone(470);updateHud();};
$('objectiveList').addEventListener('click',e=>{const button=e.target.closest('[data-objective]');if(!button)return;const objective=game.objectives.find(o=>String(o.id)===button.dataset.objective);if(objective)focusPoint(objective.x,objective.y,Math.max(view.zoom,.9));});
function setMode(mode){orderMode=mode;document.querySelectorAll('[data-order]').forEach(b=>b.classList.toggle('active',b.dataset.order===mode));}
document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{setMode(b.dataset.order);toast(orderMode==='attack'?'Conquer: fight and capture along your route.':'Move: march directly to your destination.');});
document.querySelectorAll('[data-formation]').forEach(b=>b.onclick=()=>{ui.formation=b.dataset.formation;document.querySelectorAll('[data-formation]').forEach(z=>z.classList.toggle('active',z===b));if(ui.selected.size)toast(`${b.dataset.formation[0].toUpperCase()+b.dataset.formation.slice(1)} formation on your next order.`);});
function clearBuildingSelection(){ui.selectedBuildings.clear();allBuildingsSelected=false;}
function selectArmy(){cancelBuild();clearBuildingSelection();ui.selected=new Set(game.units.filter(u=>u.team===0&&u.hp>0).map(u=>u.id));allSelected=true;tone(400);updateHud();}
function selectAllBuildings(){cancelBuild();ui.selected.clear();allSelected=false;ui.selectedBuildings=new Set(game.buildings.filter(b=>b.team===0&&b.hp>0).map(b=>b.id));allBuildingsSelected=true;tone(400);updateHud();$('buildingOrders').scrollIntoView({block:'nearest'});}
function beginRally(){if(!selectedBuildings().length)return;cancelBuild();ui.rallyMode=true;$('buildBanner').firstChild.textContent='Click land to set the selected buildings’ rally point ';$('buildBanner').hidden=false;document.body.classList.add('placing');canvas.focus();updateHud();}
function setSelectedRally(x,y){const buildings=selectedBuildings();if(!buildings.length){cancelBuild();return;}const r=game.setRally(x,y,0,allBuildingsSelected?null:buildings.map(b=>b.id));toast(r.message,!r.ok);if(r.ok){ui.orderMarker={x,y,time:game.time,mode:'rally'};cancelBuild();tone(380);}updateHud();}
function clearSelectedRally(){const r=game.clearRally(0,allBuildingsSelected?null:ui.selectedBuildings);toast(r.message,!r.ok);cancelBuild();updateHud();}
function findHero(){const u=game.units.find(u=>u.team===0&&u.type==='hero'&&u.hp>0);if(!u){toast('Your commander will return while a keep remains.');return;}cancelBuild();clearBuildingSelection();ui.selected=new Set([u.id]);allSelected=false;focusPoint(u.x,u.y,1.7);updateHud();}
function issue(x,y,mode=orderMode){if(!ui.selected.size){toast('Select soldiers first. Drag a box or press Q.');return;}const t=game.tileAt(x,y);if(!isPassableTile(t)){toast('Choose reachable ground, a bridge, a ford or a pass.',true);return;}game.command(ui.selected,x,y,mode,ui.formation);ui.orderMarker={x,y,time:game.time,mode};tone(mode==='attack'?240:340);}
function expandNearby(){
 if(!started||menuOpen||game.winner!==null||!game.teams[0].alive)return;
 const troops=selected();if(!troops.length)return toast('Select soldiers first. Drag a box or press Q.');
 cancelBuild();const result=game.expand(troops.map(u=>u.id));toast(result.message,!result.ok);if(result.ok)tone(310);updateHud();
}
function attackNearest(){
 if(!started||menuOpen||game.winner!==null||!game.teams[0].alive)return;
 const troops=selected();if(!troops.length)return toast('Select soldiers first. Drag a box or press Q.');
 const result=game.attackNearest(troops.map(u=>u.id),ui.formation);
 if(!result.ok)return toast(result.message);
 cancelBuild();setMode('attack');ui.orderMarker=null;tone(240);toast(result.message);
}
function useHousePower(){
 if(!started||menuOpen||game.winner!==null||!game.teams[0].alive)return;
 if(typeof game.useHousePower!=='function')return toast('House powers are preparing.');
 const result=game.useHousePower([...ui.selected],0);toast(result.message,!result.ok);if(result.ok)tone(540,'click',.035);updateHud();
}
function hold(){if(!ui.selected.size)return toast('Select troops to hold the line.');game.hold(ui.selected);toast('Hold the line. Your troops will defend their ground.');tone(260);}
function retreat(){if(!ui.selected.size)return toast('Select troops to retreat.');game.retreat(ui.selected);toast('Fall back! Regroup at your keep.');tone(190);}
$('allButton').onclick=selectArmy;$('heroButton').onclick=findHero;$('attackNearestButton').onclick=attackNearest;$('expandButton').onclick=expandNearby;$('holdButton').onclick=hold;$('retreatButton').onclick=retreat;
$('housePowerButton').onclick=useHousePower;
$('houseQuickPowerButton').onclick=useHousePower;
$('selectedPowerButton').onclick=useHousePower;$('selectBuildingsButton').onclick=selectAllBuildings;$('setRallyButton').onclick=beginRally;$('clearRallyButton').onclick=clearSelectedRally;
$('zoomIn').onclick=()=>zoomAt(1.2);$('zoomOut').onclick=()=>zoomAt(1/1.2);$('fitButton').onclick=fitMap;$('homeButton').onclick=home;
function toggleGrid(){ui.showGrid=!ui.showGrid;$('gridButton').classList.toggle('active',ui.showGrid);}$('gridButton').onclick=toggleGrid;
function togglePause(){if(!started||menuOpen||game.winner!==null)return;game.paused=!game.paused;updatePause();toast(game.paused?'The war is paused. Plan your next move.':'The war continues.');}
function updatePause(){document.body.classList.toggle('paused',game.paused);$('pauseButton').textContent=game.paused?'▶':'Ⅱ';$('pauseButton').setAttribute('aria-label',game.paused?'Resume game':'Pause game');}
$('pauseButton').onclick=togglePause;$('speedButton').onclick=()=>{speed=speed===1?1.5:speed===1.5?2:1;$('speedButton').textContent=speed+'×';};
$('soundButton').onclick=()=>{sound=!sound;if(sound)initAudio();$('soundButton').textContent=sound?'♫':'♪';$('soundButton').style.opacity=sound?'1':'.4';};
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use your browser’s fullscreen control.');}};
function openMenu(){if(!started)return;edgeMouse=null;wasPaused=game.paused;game.paused=true;menuOpen=true;$('menuOverlay').hidden=false;$('resumeButton').hidden=false;$('startButton').innerHTML='START A NEW CONQUEST <span>→</span>';updatePause();}
function resume(){menuOpen=false;$('menuOverlay').hidden=true;game.paused=wasPaused;updatePause();canvas.focus();}
$('menuButton').onclick=openMenu;$('campaignMenuButton').onclick=openMenu;$('resumeButton').onclick=resume;
let helpWasPaused=false;function showHelp(){helpWasPaused=game.paused;game.paused=true;$('helpDialog').showModal();updatePause();}
function closeHelp(){$('helpDialog').close();game.paused=helpWasPaused;updatePause();canvas.focus();}
$('helpButton').onclick=showHelp;$('closeHelp').onclick=closeHelp;$('helpDone').onclick=closeHelp;$('helpDialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});
let housesWasPaused=false;
function renderHouseGuide(){
 $('houseGuideGrid').innerHTML=HOUSES.map((h,i)=>{const p=powerData(h),specialist=HOUSE_CONTENT[h.sigil];return `<article class="house-guide-card" data-house-guide="${i}" style="--house-accent:${h.color}"><div class="guide-house-heading"><span>${icon(h.sigil)}</span><div><h3>${escapeHTML(h.name)}</h3><p>${escapeHTML(h.playstyle||h.trait)}</p></div></div><div class="specialist-impact"><b>${escapeHTML(UNIT_DEFS[specialist.unit].label)} · ${escapeHTML(specialist.impactName||'House specialist')}</b><p>${escapeHTML(specialist.impact||'')}</p></div><div class="house-trait-label">BONUSES</div><ul>${houseAdvantages(h).map(a=>`<li>${escapeHTML(a)}</li>`).join('')}</ul><div class="house-trait-label weakness-label">WEAKNESSES</div><ul class="house-weaknesses">${houseWeaknesses(h).map(a=>`<li>${escapeHTML(a)}</li>`).join('')}</ul><div class="guide-house-power"><b>${escapeHTML(p.name)}</b><p>${escapeHTML(p.description)}</p><small>${p.cost?`${p.cost} gold · `:''}${p.cooldown}s cooldown · E</small></div></article>`;}).join('');
}
function showHouses(){housesWasPaused=game.paused;game.paused=true;keys.clear();renderHouseGuide();$('housesDialog').showModal();updatePause();}
function closeHouses(){$('housesDialog').close();game.paused=housesWasPaused;updatePause();if(started&&!menuOpen)canvas.focus();}
function showChosenHouse(){showHouses();$('houseGuideGrid').querySelector(`[data-house-guide="${chosenHouse}"]`)?.scrollIntoView({block:'start'});}
$('compareHousesButton').onclick=showChosenHouse;$('compareHousesCouncilButton').onclick=showHouses;$('houseCardButton').onclick=()=>showTab('council');$('closeHouses').onclick=closeHouses;$('houseGuideDone').onclick=closeHouses;$('housesDialog').addEventListener('cancel',e=>{e.preventDefault();closeHouses();});
function start(){
 edgeMouse=null;
 game=new Game({house:chosenHouse,landscape:$('landscapeSelect').value,mode:$('modeSelect').value,enemies:+$('enemySelect').value,difficulty:$('difficultySelect').value,scale:$('scaleSelect').value,seed:Math.floor(Math.random()*1e9)});
 ui.quality=$('qualitySelect').value;ui.selected.clear();clearBuildingSelection();ui.drag=null;ui.orderMarker=null;ui.hover=null;allSelected=false;groups.clear();keys.clear();started=true;menuOpen=false;speed=1;lastResult=null;lastEvent=game.eventId;lastBattle=0;accumulator=0;cancelBuild();
 $('menuOverlay').hidden=true;$('resultOverlay').hidden=true;$('speedButton').textContent='1×';$('mapTitle').textContent=game.landscape?.label||'The Shattered Realm';$('campaignLabel').textContent=game.mode.label.toUpperCase();$('landsStatus').textContent=(game.landmarks||[]).filter(l=>['bridge','ford','pass'].includes(l.kind)).length+' crossings & passes';$('objective').textContent=(game.mode.objectiveGoal?'Reach '+game.mode.objectiveGoal+' flag captures or eliminate enemy capitals.':game.mode.id.endsWith('dominion')?'Hold 65% of the realm after 90 seconds or eliminate enemy capitals.':'Destroy every enemy capital.')+(game.mode.teams?' Your alliance shares progress.':'')+' Protect your town hall.';
 document.documentElement.style.setProperty('--house',game.teams[0].teamColor||game.teams[0].color);$('houseName').textContent=game.teams[0].name;$('houseTrait').textContent=houseData(0).playstyle||game.teams[0].trait;$('houseCardButton').title='Bonuses: '+houseAdvantages(houseData(0)).join(' ')+'\nWeaknesses: '+houseWeaknesses(houseData(0)).join(' ')+'\nOpen Council for your house power.';
 document.querySelector('.house-card .crest use').setAttribute('href','#i-'+game.teams[0].sigil);
 buildActionLists();paintBuildingIcons();showTab('army');home();updatePause();updateHud();initAudio();tone(390);canvas.focus();toast(game.mode.teams?'You share a color with your bot ally. Use Call assault or Call defense to coordinate.':'Protect your capital. Capture flags for Royal Guard reinforcements.');
}
$('startButton').onclick=start;
$('playAgain').onclick=()=>{$('resultOverlay').hidden=true;openMenu();};$('inspectButton').onclick=()=>{$('resultOverlay').hidden=true;game.paused=true;updatePause();};

function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function rememberMouse(e){edgeMouse=e.pointerType==='mouse'?{clientX:e.clientX,clientY:e.clientY}:null;}
function mousePan(){
 if(!edgeMouse||!started||menuOpen||gesture||pinch||pointers.size||miniDragging||document.hidden||!document.hasFocus()||$('helpDialog').open||$('housesDialog').open||!$('resultOverlay').hidden)return{x:0,y:0};
 const r=canvas.getBoundingClientRect(),x=edgeMouse.clientX-r.left,y=edgeMouse.clientY-r.top;
 if(x<0||y<0||x>r.width||y>r.height||document.elementFromPoint(edgeMouse.clientX,edgeMouse.clientY)!==canvas)return{x:0,y:0};
 const band=Math.min(32,r.width*.12,r.height*.12);if(band<=0)return{x:0,y:0};
 const axis=(p,size)=>p<band?-(1-p/band):p>size-band?1-(size-p)/band:0,dx=axis(x,r.width),dy=axis(y,r.height),length=Math.max(1,Math.hypot(dx,dy));
 return{x:dx/length,y:dy/length};
}
canvas.addEventListener('pointerenter',rememberMouse);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointerPos(e);zoomAt(Math.exp(-e.deltaY*.0013),p.x,p.y);},{passive:false});
canvas.addEventListener('pointerdown',e=>{
 rememberMouse(e);if(menuOpen||!started)return;e.preventDefault();initAudio();canvas.focus();canvas.setPointerCapture(e.pointerId);const p=pointerPos(e);pointers.set(e.pointerId,p);
 if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:view.zoom,anchor:screenToWorld((a.x+b.x)/2,(a.y+b.y)/2,view)};gesture=null;ui.drag=null;return;}
 gesture={id:e.pointerId,button:e.button,x0:p.x,y0:p.y,x:p.x,y:p.y,camX:view.x,camY:view.y,shift:e.shiftKey,moved:false,touch:e.pointerType==='touch'};
});
canvas.addEventListener('pointermove',e=>{
 rememberMouse(e);const p=pointerPos(e);ui.hover=screenToWorld(p.x,p.y,view);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
 if(pinch&&pointers.size>=2){const[a,b]=[...pointers.values()],sx=(a.x+b.x)/2,sy=(a.y+b.y)/2;view.zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(10,pinch.dist),minZoom(),2.6);const q=iso(pinch.anchor);view.x=q.x-(sx-view.w/2)/view.zoom;view.y=q.y-(sy-view.h/2)/view.zoom;boundCamera();return;}
 if(!gesture||gesture.id!==e.pointerId)return;gesture.x=p.x;gesture.y=p.y;if(Math.hypot(p.x-gesture.x0,p.y-gesture.y0)>6)gesture.moved=true;
 if(gesture.button===2||gesture.button===1){if(gesture.moved){view.x=gesture.camX-(p.x-gesture.x0)/view.zoom;view.y=gesture.camY-(p.y-gesture.y0)/view.zoom;boundCamera();}}else if(gesture.moved&&!ui.buildMode&&!ui.rallyMode&&!ui.teamOrderMode){ui.drag={x0:gesture.x0,y0:gesture.y0,x1:p.x,y1:p.y};}
});
function buildingAt(p){
 let target=null,best=Infinity;
 for(const b of game.buildings){if(b.team!==0||b.hp<=0)continue;const s=worldToScreen(b.x,b.y,view),level=b.level||1,f=renderer.getStructureFrame(b.type,game.teams[0].sigil,level),scale=b.type==='keep'&&!renderer.campaignArtReady?[0,.85,1,1.16][level]:1,w=Math.max((f?.drawWidth||60)*scale,b.type==='keep'&&!renderer.campaignArtReady?[0,70,126,180][level]:0)*view.zoom,h=(f?.drawHeight||70)*scale*view.zoom,bottom=(b.type==='keep'?(level>1?62:44):b.type==='tower'?30:12)*view.zoom;
  if(p.x<s.x-w*.5||p.x>s.x+w*.5||p.y<s.y+12*view.zoom-h||p.y>s.y+bottom)continue;
  const d=Math.hypot((s.x-p.x)/Math.max(1,w),(s.y-h*.35-p.y)/Math.max(1,h));if(d<best){best=d;target=b;}
 }return target;
}
function finishPointer(e,cancel=false){
 pointers.delete(e.pointerId);if(pinch){if(pointers.size<2)pinch=null;gesture=null;ui.drag=null;return;}
 if(!gesture||gesture.id!==e.pointerId)return;const z=gesture;gesture=null;ui.drag=null;if(cancel)return;const p=pointerPos(e),w=screenToWorld(p.x,p.y,view);
 if(z.button===1)return;if(z.button===2){if(!z.moved){if(ui.buildMode||ui.rallyMode||ui.teamOrderMode){cancelBuild();updateHud();}else if(ui.selectedBuildings.size)setSelectedRally(w.x,w.y);else issue(w.x,w.y,'move');}return;}
 if(ui.teamOrderMode){if(!z.moved)placeTeamOrder(w.x,w.y);return;}
 if(ui.rallyMode){if(!z.moved)setSelectedRally(w.x,w.y);return;}
 if(ui.buildMode&&!z.moved){const r=game.build(ui.buildMode,Math.floor(w.x)+.5,Math.floor(w.y)+.5);toast(r.message,!r.ok);if(r.ok){tone(200);if(!e.shiftKey)cancelBuild();}updateHud();return;}
 if(z.moved){clearBuildingSelection();if(!z.shift)ui.selected.clear();const x0=Math.min(z.x0,p.x),x1=Math.max(z.x0,p.x),y0=Math.min(z.y0,p.y),y1=Math.max(z.y0,p.y);for(const u of game.units){if(u.team!==0||u.hp<=0)continue;const s=worldToScreen(u.x,u.y,view);if(s.x>=x0&&s.x<=x1&&s.y>=y0&&s.y<=y1)ui.selected.add(u.id);}allSelected=false;tone(420);updateHud();return;}
 const building=buildingAt(p);if(building){ui.selected.clear();allSelected=false;allBuildingsSelected=false;if(!z.shift)ui.selectedBuildings.clear();if(z.shift&&ui.selectedBuildings.has(building.id))ui.selectedBuildings.delete(building.id);else ui.selectedBuildings.add(building.id);tone(430);updateHud();$('buildingOrders').scrollIntoView({block:'nearest'});return;}
 let closest=null,best=22;for(const u of game.units){if(u.team!==0||u.hp<=0)continue;const s=worldToScreen(u.x,u.y,view),d=Math.hypot(s.x-p.x,s.y-9*view.zoom-p.y);if(d<best){closest=u;best=d;}}
 if(closest){clearBuildingSelection();if(!z.shift)ui.selected.clear();if(z.shift&&ui.selected.has(closest.id))ui.selected.delete(closest.id);else ui.selected.add(closest.id);allSelected=false;tone(430);updateHud();}
 else if(ui.selected.size)issue(w.x,w.y);
 else{clearBuildingSelection();updateHud();const t=game.tileAt(w.x,w.y);if(t)toast(terrainDescription(t)+(t.owner>=0?' · '+game.teams[t.owner].name:''));}
}
canvas.addEventListener('pointerup',e=>finishPointer(e));canvas.addEventListener('pointercancel',e=>{edgeMouse=null;finishPointer(e,true);});canvas.addEventListener('pointerleave',()=>{edgeMouse=null;ui.hover=null;});
canvas.addEventListener('dblclick',e=>{if(!started||menuOpen||ui.buildMode||ui.rallyMode||ui.teamOrderMode)return;const p=pointerPos(e);if(buildingAt(p))return;let target=null,best=28;for(const u of game.units){if(u.team!==0||u.hp<=0)continue;const s=worldToScreen(u.x,u.y,view),d=Math.hypot(s.x-p.x,s.y-10*view.zoom-p.y);if(d<best){target=u;best=d;}}if(target){clearBuildingSelection();allSelected=false;ui.selected=new Set(game.units.filter(u=>u.team===0&&u.hp>0&&u.type===target.type).map(u=>u.id));updateHud();}});

let miniDragging=false;function navigateMini(e){const m=renderer.minimapTransform;if(!m)return;const r=$('minimap').getBoundingClientRect();view.x=((e.clientX-r.left)-m.ox)/m.scale;view.y=((e.clientY-r.top)-m.oy)/m.scale;boundCamera();}
$('minimap').addEventListener('pointerdown',e=>{e.preventDefault();miniDragging=true;$('minimap').setPointerCapture(e.pointerId);navigateMini(e);});$('minimap').addEventListener('pointermove',e=>{if(miniDragging)navigateMini(e);});$('minimap').addEventListener('pointerup',()=>miniDragging=false);$('minimap').addEventListener('pointercancel',()=>miniDragging=false);
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||'')||e.target?.isContentEditable||e.target?.closest?.('[contenteditable="true"],[contenteditable=""],[role="textbox"]')||$('helpDialog').open||$('housesDialog').open)return;
 if(e.key==='Escape'){if(ui.buildMode||ui.rallyMode||ui.teamOrderMode){cancelBuild();updateHud();return;}if(started){if(menuOpen)resume();else{ui.selected.clear();clearBuildingSelection();allSelected=false;updateHud();}}return;}
 if(!started||menuOpen||game.winner!==null||!$('resultOverlay').hidden)return;const k=e.key.toLowerCase(),digit=/^(?:Digit|Numpad)([1-5])$/.exec(e.code)?.[1]||(/^[1-5]$/.test(k)?k:null);
 if(e.metaKey||e.altKey||e.ctrlKey&&(!digit||e.shiftKey))return;
 if([' ','tab','arrowup','arrowdown','arrowleft','arrowright','home','+','-','='].includes(k)||digit)e.preventDefault();
 if(e.repeat){keys.add(k);return;}
 if(handleMenuHotkey(e))return;
 keys.add(k);
 if(k===' '||k==='p')togglePause();else if(k==='a'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();attackNearest();}else if(k==='t'){e.preventDefault();expandNearby();}else if(k==='e'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();useHousePower();}else if(k==='q')selectArmy();else if(k==='f')findHero();else if(k==='h')hold();else if(k==='r'){e.preventDefault();selectAllBuildings();}else if(k==='v')retreat();else if(k==='g')toggleGrid();else if(k==='tab')fitMap();else if(k==='home')home();else if(k==='+'||k==='=')zoomAt(1.2);else if(k==='-')zoomAt(1/1.2);else if(k==='x')setMode(orderMode==='attack'?'move':'attack');
 else if(/^[1-5]$/.test(k)){if(e.ctrlKey){groups.set(k,[...ui.selected]);toast(`Company ${k} assigned · ${ui.selected.size} soldiers.`);}else{const ids=groups.get(k);if(ids){cancelBuild();clearBuildingSelection();ui.selected=new Set(ids.filter(id=>game.byId.get(id)?.hp>0));allSelected=false;updateHud();}else toast(`Select troops, then Ctrl + ${k} to assign this company.`);}}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{edgeMouse=null;keys.clear();gesture=null;ui.drag=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)edgeMouse=null;if(document.hidden&&started&&!menuOpen&&game.winner===null){game.paused=true;updatePause();}lastNow=performance.now();accumulator=0;});

let townHallPortraitKey='';
let towerPortraitKey='';
function updateSelectedTower(buildings){
 const tower=buildings.length===1&&buildings[0].type==='tower'?buildings[0]:null;$('selectedTowerUpgrade').hidden=!tower;if(!tower)return;
 const details=game.towerDetails(tower.id,0),key=game.teams[0].color+':'+tower.id+':'+details.level+':'+!!renderer.campaignArtReady;
 $('selectedTowerName').textContent=details.label+' · Level '+details.level+' / 3';$('selectedTowerStats').textContent=num(details.hp)+' / '+num(details.maxHp)+' HP · '+details.damage+' damage · '+details.range+' range';
 $('selectedTowerUpgradeDetail').textContent=details.maxed?'Maximum level · Your strongest tower.':'Next: level '+details.nextLevel+' · '+num(details.nextHp)+' maximum HP · stronger firepower and longer range.';$('upgradeTowerLabel').textContent=details.maxed?'Maximum level':'Upgrade to level '+details.nextLevel;$('upgradeTowerCost').textContent=details.maxed?'3 / 3':num(details.cost)+' gold';$('upgradeTowerButton').disabled=!started||menuOpen||game.winner!==null||!details.alive||details.maxed||game.teams[0].gold<details.cost;
 if(key!==towerPortraitKey&&renderer.structuresReady){if(typeof renderer.drawTowerPortrait==='function')renderer.drawTowerPortrait($('selectedTowerArt'),game.teams[0],details.level);else paintStructurePortrait($('selectedTowerArt'),'tower',game.teams[0]);towerPortraitKey=key;}
}
function paintTownHall(){
 const details=game.townHallDetails?.(0),team=game.teams[0];if(!details||!renderer.structuresReady)return;
 const key=team.sigil+':'+details.level+':'+(team.teamColor||team.color)+':'+!!renderer.campaignArtReady;if(key===townHallPortraitKey&&renderer.houseArtReady)return;
 const portrait=$('townHallArt');if(typeof renderer.drawTownHallPortrait==='function')renderer.drawTownHallPortrait(portrait,team,details.level);else paintStructurePortrait(portrait,'keep',team);townHallPortraitKey=key;
}
function updateCampaignHud(){
 const s=game.teams[0],hall=game.townHallDetails?.(0),teamMode=!!game.mode?.teams,allies=game.teams.filter(t=>t.id!==0&&t.alive&&game.allied(0,t.id));
 if(hall){
  const health=Math.max(0,Math.min(100,hall.hp/Math.max(1,hall.maxHp)*100));$('townHallName').textContent=hall.label+' · Level '+hall.level+' / 3';$('townHallStats').textContent=num(hall.hp)+' / '+num(hall.maxHp)+' HP · '+num(hall.damage)+' damage · '+hall.range+' range';
  $('townHallHealth').style.width=health+'%';$('townHallHealth').parentElement.setAttribute('aria-valuenow',String(Math.round(health)));$('townHallHealth').classList.toggle('critical',health<30);
  $('townHallUpgradeDetail').textContent=!hall.alive?'Your capital has fallen.':hall.maxed?'Maximum level · Your strongest capital.':'Next: level '+hall.nextLevel+' · '+num(hall.nextHp)+' maximum HP · larger, stronger defenses.';
  $('townHallUpgradeLabel').textContent=hall.maxed?'Maximum level':'Upgrade to level '+hall.nextLevel;$('townHallUpgradeCost').textContent=hall.maxed?'3 / 3':num(hall.cost)+' gold';$('townHallUpgradeButton').disabled=!started||menuOpen||!s.alive||!hall.alive||hall.maxed||s.gold<hall.cost;paintTownHall();
 }
 $('teamCommandSection').hidden=!teamMode;$('allianceName').textContent=s.teamName||'TEAM '+(s.alliance+1);$('teamAssaultButton').disabled=$('teamDefendButton').disabled=!started||menuOpen||game.winner!==null||!s.alive||!allies.length;
 $('teamAssaultButton').classList.toggle('active',ui.teamOrderMode==='assault');$('teamDefendButton').classList.toggle('active',ui.teamOrderMode==='defend');
 const order=[...(game.teamOrders||[])].reverse().find(o=>o.alliance===s.alliance&&o.expiresAt>game.time);
 $('teamOrderStatus').textContent=ui.teamOrderMode?'Click the battlefield · Esc cancels':!allies.length?'No living allied bot remains.':order?order.kind==='assault'?(order.launchAt>game.time?'Allies gathering · launch in '+Math.ceil(order.launchAt-game.time)+'s':'Allied assault underway')+' · '+Math.round(order.x)+', '+Math.round(order.y):'Allies defending · '+Math.round(order.x)+', '+Math.round(order.y):'Choose an order, then click the battlefield.';
 const objectives=game.objectives||[],goal=game.mode?.objectiveGoal||0;$('objectiveSection').hidden=!objectives.length;$('objectiveGoal').textContent=goal?'FIRST TO '+goal:'ELITE REINFORCEMENTS';
 const alliances=[...new Set(game.teams.map(t=>t.alliance))];$('objectiveScore').innerHTML=alliances.map(a=>{const members=game.teams.filter(t=>t.alliance===a),lead=members[0],label=teamMode?'Team '+(a+1):short(lead.name),score=game.objectiveScores?.[a]||0;return '<span style="--team-color:'+(lead.teamColor||lead.color)+'" title="'+escapeHTML(members.map(t=>t.name).join(' + '))+'">'+escapeHTML(label)+' <b>'+score+(goal?' / '+goal:'')+'</b></span>';}).join('');
 const list=$('objectiveList'),buttons=[...list.querySelectorAll('[data-objective]')];
 if(buttons.length!==objectives.length||buttons.some((b,i)=>b.dataset.objective!==String(objectives[i].id))){list.innerHTML=objectives.map(o=>'<button class="objective-card" data-objective="'+escapeHTML(o.id)+'"><span class="objective-heading"><b></b><span></span></span><span class="objective-progress"><i></i></span><small class="objective-state"></small><small class="objective-rival"></small></button>').join('');}
 for(const o of objectives){
  const button=[...list.children].find(b=>b.dataset.objective===String(o.id)),yours=o.progress?.[s.alliance]||0,required=o.required||30,cooldown=Math.max(0,(o.cooldownUntil||0)-game.time),controller=game.teams.find(t=>t.alliance===o.controller),state=cooldown?'Reopens in '+Math.ceil(cooldown)+'s':o.contested?'Contested · time frozen':o.controller===s.alliance?'Your banner advancing':controller?(teamMode?'Team '+(controller.alliance+1):short(controller.name))+' advancing':'Unoccupied · time frozen';
  const entries=alliances.filter(a=>(o.progress?.[a]||0)>0&&a!==s.alliance).sort((a,b)=>(o.progress[b]||0)-(o.progress[a]||0)),rival=entries[0],rivalTeam=game.teams.find(t=>t.alliance===rival),rivalText=rivalTeam?(teamMode?'Team '+(rival+1):short(rivalTeam.name))+': '+(o.progress[rival]||0).toFixed(1)+'s saved':'';
  button.classList.toggle('contested',!!o.contested);button.title='Click to locate '+o.name;button.querySelector('.objective-heading b').textContent=o.name;button.querySelector('.objective-heading>span').textContent=yours.toFixed(1)+' / '+required+'s';button.querySelector('.objective-progress i').style.width=Math.min(100,yours/required*100)+'%';button.querySelector('.objective-state').textContent=state;button.querySelector('.objective-rival').textContent=rivalText;button.querySelector('.objective-rival').hidden=!rivalText;
 }

}
function updateHud(){
 const s=game.teams[0];$('gold').textContent=num(s.gold);$('income').textContent=`+${s.income.toFixed(1)} / sec`;setHudHTML($('army'),`${num(s.count)} <i>/ ${s.cap}</i>`);setHudHTML($('land'),`${num(s.tiles)} <i>tiles</i>`);$('landPercent').textContent=`${percent(s)}% OF THE REALM`;
 $('clock').textContent=`${Math.floor(game.time/60).toString().padStart(2,'0')}:${Math.floor(game.time%60).toString().padStart(2,'0')}`;
 for(const id of ui.selected){const u=game.byId.get(id);if(!u||u.hp<=0)ui.selected.delete(id);}if(allSelected)for(const u of game.units)if(u.team===0&&u.hp>0)ui.selected.add(u.id);
 for(const id of ui.selectedBuildings){const b=game.byId.get(id);if(!b||b.hp<=0||b.team!==0||!BUILD_DEFS[b.type])ui.selectedBuildings.delete(id);}if(allBuildingsSelected)for(const b of game.buildings)if(b.team===0&&b.hp>0)ui.selectedBuildings.add(b.id);
 const buildings=selectedBuildings();if(ui.rallyMode&&!buildings.length)cancelBuild();
 $('selectBuildingsButton').classList.toggle('active',allBuildingsSelected&&buildings.length>0);$('setRallyButton').classList.toggle('active',ui.rallyMode);
 $('buildingOrders').hidden=!buildings.length;
 updateSelectedTower(buildings);
 $('buildingSelectionName').textContent=buildings.length===1?BUILD_DEFS[buildings[0].type].label:`${buildings.length} BUILDINGS SELECTED`;
 const rallyKeys=new Set(buildings.map(b=>b.rally?`${b.rally.x.toFixed(1)}, ${b.rally.y.toFixed(1)}`:'none'));
 const rallyKey=[...rallyKeys][0];$('buildingRallyStatus').textContent=ui.rallyMode?'Click land · Esc cancels':rallyKeys.size>1?'Individual rally points':rallyKey==='none'?'No rally · Troops defend their building':rallyKey?`Rally: ${rallyKey}`:'';
 $('clearRallyButton').disabled=!buildings.some(b=>b.rally)&&!(allBuildingsSelected&&s.rally);$('setRallyButton').disabled=!buildings.length;
 const troops=selected(),counts={};for(const u of troops)counts[u.type]=(counts[u.type]||0)+1;$('selectedCount').textContent=`${troops.length} SELECTED`;
 const expanding=troops.filter(u=>u.order?.mode==='expand').length;
 $('expandButton').disabled=!started||menuOpen||game.winner!==null||!s.alive||!troops.length;
 $('expandButton').classList.toggle('active',expanding>0);$('expandButton').setAttribute('aria-pressed',String(expanding>0));
 $('expandLabel').textContent=expanding?`Expanding nearby · ${expanding}`:'Expand nearby';
 $('selectionTitle').textContent=buildings.length?buildings.length===1?BUILD_DEFS[buildings[0].type].label:`${buildings.length} buildings selected`:troops.length?`${troops.length} ${troops.length===1?'soldier':'soldiers'} under your command`:'Your army awaits';
 $('selectionDetail').textContent=buildings.length?'Right-click land to rally · R selects all buildings':troops.length?Object.entries(counts).map(([t,n])=>`${n} ${t==='hero'?'commander':UNIT_DEFS[t].label.toLowerCase()}`).join(' · '):'Drag to select · Q army · R buildings';
 document.querySelectorAll('[data-recruit]').forEach(b=>{const type=b.dataset.recruit,d=game.recruitDetails(type,0);$('recruitBatch-'+type).textContent=` ×${d.batch}`;$('recruitCost-'+type).innerHTML=`${d.cost}<small>GOLD</small>`;b.disabled=s.gold<d.cost||s.count+d.batch>s.cap||!s.alive||!d.unlocked;if(d.requiredBuilding)b.querySelector('.action-copy>small').textContent=d.unlocked?d.role.split(' · ').pop():`Build ${BUILD_DEFS[d.requiredBuilding].label} to unlock`;});
 const structures=game.buildingStatus(0),atStructureLimit=structures.count>=structures.cap;
 const nextStructureSlot=`Capture ${structures.nextTiles} more land ${structures.nextTiles===1?'tile':'tiles'} to unlock another structure slot.`;
 $('structureCapacity').textContent=`${num(structures.count)} / ${num(structures.cap)} STRUCTURES`;
 $('structureCapacity').title=`16 base slots + 1 per 8 owned tiles, including your keep. ${nextStructureSlot} No fixed ceiling.`;
 $('structureHint').textContent=structures.count>structures.cap?'Land lost: existing structures stay. Reclaim land or lose structures before building more.':atStructureLimit?nextStructureSlot:'16 base slots + 1 per 8 owned tiles. No fixed ceiling. Build on your land; leave room between structures.';
 $('structureHint').hidden=!atStructureLimit;
 document.querySelectorAll('[data-build]').forEach(b=>b.disabled=s.gold<BUILD_DEFS[b.dataset.build].cost||!s.alive||atStructureLimit);
 document.querySelectorAll('[data-upgrade]').forEach(b=>{const kind=b.dataset.upgrade,details=game.upgradeDetails(kind,0),l=details.level,max=details.max,cost=details.cost;$('cost-'+kind).innerHTML=l>=max?`MAX<small>${max} / ${max}</small>`:`${compactGold(cost)}<small>${l} / ${max}</small>`;$('upgradeEffect-'+kind).textContent=upgradeSummary(kind,details);b.title=upgradeTooltip(kind,details);b.disabled=l>=max||s.gold<cost||!s.alive;});
 const h=houseData(0),fallback=powerData(h),status=typeof game.powerStatus==='function'?game.powerStatus(0):{...fallback,remaining:0,ready:false};
 $('housePowerName').textContent=status.name||fallback.name;$('housePowerDescription').textContent=status.description||fallback.description;$('housePowerCost').textContent=status.cost?`${status.cost} gold`:'No gold cost';
 $('housePowerCooldown').textContent=status.remaining>0?`${Math.ceil(status.remaining)}s`:s.gold<(status.cost||0)?'Need gold':status.ready?'Ready · E':'Preparing';
 $('housePowerButton').disabled=!started||menuOpen||!s.alive||!status.ready||s.gold<(status.cost||0);$('housePowerButton').classList.toggle('power-ready',!!status.ready&&s.gold>=(status.cost||0));
 $('houseQuickPowerButton').disabled=$('housePowerButton').disabled;$('houseQuickPowerButton').title=`${status.name||fallback.name} · ${status.description||fallback.description}`;$('houseQuickPowerState').textContent=status.remaining>0?`${Math.ceil(status.remaining)}s`:s.gold<(status.cost||0)?`${status.cost}g`:status.ready?'Ready':'Preparing';$('houseQuickPowerButton').classList.toggle('power-ready',!!status.ready&&s.gold>=(status.cost||0));
 const powerClasses={stag:['cavalry'],sun:['archer'],flayed:['infantry'],bear:['infantry','hero'],huntsman:['infantry']},troopPowerHouses=['wolf','dragon','stag','sun','kraken','flayed','bear','frog','huntsman'];
 const hasSelectedPower=troops.length>0&&troopPowerHouses.includes(s.sigil)&&(!powerClasses[s.sigil]||troops.some(u=>powerClasses[s.sigil].includes(game.unitClass(u))));
 const selectedPower=$('selectedPowerButton');selectedPower.hidden=!hasSelectedPower;selectedPower.disabled=$('housePowerButton').disabled;
 setHudHTML(selectedPower,`${escapeHTML(status.name||fallback.name)} <kbd>E</kbd>${status.remaining>0?` · ${Math.ceil(status.remaining)}s`:s.gold<(status.cost||0)?' · Need gold':status.ready?' · Ready':''}`);selectedPower.title=status.description||fallback.description;
 const passive=[];for(const type of Object.keys(counts)){const d=UNIT_DEFS[type];if(d.impactName)passive.push({label:`${d.impactName} · Automatic`,description:d.impact});}
 if(troops.some(u=>game.unitClass(u)==='cavalry'))passive.push({label:'Charge · Automatic',description:'Conquer or attack with a straight 3-tile run-up. Flank braced spearmen.'});
 if(troops.some(u=>['dread_pike','bridge_warden'].includes(u.type)))passive.push({label:'Spear brace · Hold H',description:'Hold facing an incoming charge to break it. Moving or flanked spearmen cannot brace.'});
 $('selectedPassiveAbilities').textContent=passive.map(p=>p.label).join(' · ');$('selectedPassiveAbilities').title=passive.map(p=>`${p.label}: ${p.description}`).join('\n');$('selectionAbility').hidden=!hasSelectedPower&&!passive.length;
 const specialist=game.houseContent(0);setHudHTML($('housePassives'),`<b>${escapeHTML(h.playstyle||h.trait)}</b><div class="specialist-impact"><b>${escapeHTML(UNIT_DEFS[specialist.unit].label)} · ${escapeHTML(specialist.impactName||'House specialist')}</b><p>${escapeHTML(specialist.impact||'')}</p></div><div class="house-trait-label">BONUSES</div><ul>${houseAdvantages(h).map(a=>`<li>${escapeHTML(a)}</li>`).join('')}</ul><div class="house-trait-label weakness-label">WEAKNESSES</div><ul class="house-weaknesses">${houseWeaknesses(h).map(a=>`<li>${escapeHTML(a)}</li>`).join('')}</ul>`);
 updateCampaignHud();
 const alive=game.teams.filter(t=>t.alive);$('housesAlive').textContent=`${alive.length} HOUSES`;
 const total=game.teams.reduce((a,t)=>a+t.tiles,0)||1;setHudHTML($('powerBar'),game.teams.filter(t=>t.alive).map(t=>`<span style="background:${t.teamColor||t.color};width:${t.tiles/total*100}%"></span>`).join(''));
 setHudHTML($('houseRoster'),game.teams.map(t=>{
  const h=HOUSES[t.house]||t,ally=game.mode?.teams&&game.allied(0,t.id),strategy=t.aiPlan?.label||(typeof t.strategy==='string'?t.strategy:t.strategy?.label||t.strategy?.name||''),phase=({muster:'Gathering',advance:'Invading',objective:'Securing flag',regroup:'Regrouping',defend:'Defending',coordinate:'Coordinating',counter:'Counterattack'})[t.aiPlan?.phase]||t.aiState?.phase||t.strategy?.phase||t.phase||(t.id===0?'':'Preparing'),plan=[strategy,phase].filter(Boolean).join(' · '),production=t.aiPlan?.production;
  const productionText=!production?'':production.status==='built'?'Built '+production.label:production.status==='saving'?'Saving for '+production.label:production.status==='blocked'?'Needs building space':production.status==='supply'?'Army supply full':production.status==='threat'?'Recruiting defenders':'Production ready';
  const title=(h.playstyle||h.trait)+'. Bonuses: '+houseAdvantages(h).join(' ')+' Weaknesses: '+houseWeaknesses(h).join(' ')+' Power: '+powerData(h).name+(plan?' · Plan: '+plan:'')+(productionText?' · '+productionText+'. '+(production.reason||''):'');
  return `<div class="roster-row${t.id===0?' you':''}${ally?' ally':''}" title="${escapeHTML(title)}" style="--color:${t.teamColor||t.color};opacity:${t.alive?1:.3}"><span class="roster-dot"></span><b>${short(t.name)}${t.id===0?' · You':ally?' · Ally':''}${plan&&t.id!==0?'<small>'+escapeHTML(plan)+'</small>':''}${t.id!==0&&t.alive&&productionText?'<small class="production-plan" title="'+escapeHTML(production.reason||'')+'">'+escapeHTML(productionText)+'</small>':''}</b><span class="army-total">${t.count}</span><span class="roster-percent">${t.alive?percent(t)+'%':'Fallen'}</span></div>`;
 }).join(''));
 $('battleCount').textContent=`${num(game.units.filter(u=>u.hp>0).length)} SOLDIERS IN THE REALM`;
 if(ui.hover){const t=game.tileAt(ui.hover.x,ui.hover.y);$('tileInfo').textContent=t?`${t.owner<0?'UNCLAIMED':short(game.teams[t.owner].name).toUpperCase()} · ${t.x}, ${t.y}`:'THE SHIVERING SEA';$('terrainReadout').textContent=terrainDescription(t);}
 else{$('tileInfo').textContent='SCROLL TO ZOOM';$('terrainReadout').textContent='Hover ground to inspect its terrain';}
}
function checkResult(){
 const outcome=game.winner!==null?game.winner:!game.teams[0].alive?'defeat':null;
 if(outcome===null||lastResult===outcome)return;lastResult=outcome;game.paused=true;updatePause();const win=game.teams[0].alive&&Number.isInteger(game.winner)&&game.allied(0,game.winner);
 $('resultEyebrow').textContent=win?'THE REALM IS UNITED':'A BANNER HAS FALLEN';$('resultTitle').textContent=win?'A crown well earned.':'The war is lost.';
 $('resultDetail').textContent=win?`${game.mode.label} victory. ${game.mode.teams?'Your alliance':game.teams[0].name} has secured the realm while your capital stood strong.`:!game.teams[0].alive?'Your town hall has fallen. Your faction, army and buildings have been wiped from the realm. Raise a new banner.':`${game.teams[game.winner]?.name||'An enemy alliance'} wins ${game.mode.label}. Protect your capital and contest the objectives in your next campaign.`;
 $('resultStats').innerHTML=`<div><b>${percent(game.teams[0])}%</b><small>REALM HELD</small></div><div><b>${num(game.teams[0].kills)}</b><small>FOES DEFEATED</small></div><div><b>${Math.floor(game.time/60)}:${Math.floor(game.time%60).toString().padStart(2,'0')}</b><small>CAMPAIGN TIME</small></div>`;$('resultOverlay').hidden=false;tone(win?520:140,'click',.04);
}
function frame(now){
 const dt=Math.min(.1,(now-lastNow)/1000);lastNow=now;frameMs=frameMs*.95+Math.max(.001,dt*1000)*.05;fps=1000/frameMs;
 ui.lowDetail=ui.quality==='auto'&&fps<46;
 if(!menuOpen&&started){const pan=600*dt/view.zoom,mouse=mousePan(),keyX=(keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),keyY=(keys.has('arrowdown')?1:0)-(keys.has('arrowup')?1:0);view.x+=(keyX||mouse.x)*pan;view.y+=(keyY||mouse.y)*pan;boundCamera();
  if(edgeMouse&&(mouse.x||mouse.y||keyX||keyY)){const r=canvas.getBoundingClientRect();ui.hover=screenToWorld(edgeMouse.clientX-r.left,edgeMouse.clientY-r.top,view);}
  if(!game.paused&&game.winner===null){accumulator+=dt*speed;let ticks=0;const deadline=performance.now()+8;while(accumulator>=1/30&&ticks<6){game.update(1/30);accumulator-=1/30;ticks++;if(performance.now()>=deadline)break;}if(ticks>=6||accumulator>1/15)accumulator=Math.min(accumulator,1/30);}else accumulator=0;
  if(game.stats.battles>lastBattle&&now-lastSfx>240){const center=screenToWorld(view.w/2,view.h/2,view),near=game.units.some(u=>u.attackAnim>.7&&Math.hypot(u.x-center.x,u.y-center.y)<10);if(near)tone(95+(game.stats.battles%7)*27,'battle',.008);lastBattle=game.stats.battles;lastSfx=now;}
  const events=game.events.filter(e=>e.id>lastEvent);if(events.length){lastEvent=events[events.length-1].id;const important=events.find(e=>e.team===0&&/lost|fallen|eliminated/.test(e.text))||events.find(e=>/eliminated/.test(e.text));const reward=events.find(e=>game.allied(0,e.team)&&/Royal Guard/.test(e.text));if(important)toast(important.text,true);else if(reward)toast(reward.text);}
  checkResult();
 }
 const menuView=renderer.menuView;
 if(!menuOpen||!menuView||menuView.game!==game||menuView.x!==view.x||menuView.y!==view.y||menuView.zoom!==view.zoom||menuView.w!==view.w||menuView.h!==view.h||menuView.dpr!==view.dpr){renderer.draw(game,view,ui);renderer.menuView=menuOpen?{...view,game}:null;}
 if(now-lastHud>220){updateHud();$('zoomLabel').textContent=Math.round(view.zoom*100)+'%';$('performance').textContent=Math.round(Math.min(240,fps))+' FPS';lastHud=now;}
 if(!menuOpen&&now-lastMini>150){renderer.drawMinimap(game,$('minimap'),view);lastMini=now;}
 if(toastUntil&&now>toastUntil){$('toast').classList.remove('visible');toastUntil=0;}
 requestAnimationFrame(frame);
}
async function boot(){
 $('startButton').disabled=true;$('startButton').innerHTML='PREPARING THE REALM…';
 try{await Promise.all([renderer.loadTroops('assets/troops-atlas.png'),renderer.loadStructures('assets/structures-atlas.png'),renderer.loadCampaignArt('assets/campaign-structures.png'),renderer.loadTerrain('assets/ground-textures.png','assets/terrain-props.png'),renderer.loadHouseArt(HOUSE_ART_SOURCES),renderer.loadLandsArt('assets/lands-atlas.png').catch(error=>console.warn('Using drawn landscape details.',error)),renderer.loadLandsGround('assets/lands-ground.png').catch(error=>console.warn('Using base landscape textures.',error))]);
  $('startButton').disabled=false;$('startButton').innerHTML='RAISE THE BANNERS <span>→</span>';
  paintBuildingIcons();paintHousePreview();paintTownHall();fitMap();updateHud();requestAnimationFrame(frame);
 }catch(error){$('startButton').innerHTML='ARTWORK COULD NOT LOAD';$('chosenTrait').textContent='Open the complete game file or keep the assets folder beside index.html.';console.error('Sprite artwork failed to load',error);}
}
// Exposed for deterministic diagnostics and recovery without changing game rules.
window.__bannerlands={get game(){return game;},view,ui,renderer,start,fitMap,home,selectArmy,get fps(){return fps;}};
boot();
