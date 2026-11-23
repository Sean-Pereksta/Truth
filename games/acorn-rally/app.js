'use strict';
const {tracks,drivers,icons}=window.RallyData;
const one=s=>document.querySelector(s);
const all=s=>Array.from(document.querySelectorAll(s));
const app=one('#app'),main=one('#main'),dialog=one('#dialog'),dc=one('#dialogContent'),race=one('#race');
const defaults={sound:true,music:true,graphics:'full',autoAccel:false,deadzone:0.15,padStyle:'xbox',padPreset:'trigger',bindings:{accelerate:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',drift:'Space',item:'KeyE',ability:'KeyQ',lookBack:'KeyC'}};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('acorn-rally-'+key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem('acorn-rally-'+key,JSON.stringify(value))}catch{}};
const opts=read('settings',{});
const settings={...defaults,...opts,bindings:{...defaults.bindings,...opts.bindings}};
const championship=window.AcornChampionship;
const cups=championship.cups;
const driverAvailable=championship.isDriverAvailable;
const skillLabel=level=>level[0].toUpperCase()+level.slice(1);
const savedDriver=Number(read('driver',0));
const simulation=window.AcornSim;
const engineChoices=simulation.engineClasses.map(cc=>[cc,cc+' cc']);
const skillChoices=simulation.difficulties.map(level=>[level,level[0].toUpperCase()+level.slice(1)]);
const savedRules=read('race-rules',{});
let engineClass=simulation.normalizeCC(savedRules.cc),cpuLevel=simulation.normalizeDifficulty(savedRules.difficulty);
let recordsClass=engineClass;
let driver=drivers[savedDriver]&&driverAvailable(savedDriver)?savedDriver:0, track=0,page='hub',mode='race',players=1,laps=3,cupIndex=0,cup=null,modal=null,capture='',running=false;
let records=read('records',{}),seats=[driver,...drivers.map((_,i)=>i).filter(i=>i!==driver).slice(0,3)],lastRun=null,toastTimer,shelfPos=0,roomSession=null;
let draftGrid=null;
const modeLabels={race:'Single race',cup:'Cup series',trial:'Time trial',local:'Split-screen'};
const keys={accelerate:'Accelerate',brake:'Brake / reverse',left:'Steer left',right:'Steer right',drift:'Drift',item:'Use acorn item',ability:'Species ability',lookBack:'Look back'};
const gamepadControls=window.AcornGamepad;
function presetPicker(){
 const options=Object.entries(gamepadControls.presets).map(([id,p])=>{
   const label=action=>gamepadControls.buttonLabel(p,action,settings.padStyle);
   return `<option value="${id}" ${p===gamepadControls.get(settings.padPreset)?'selected':''}>${p.name} · ${label('accelerate')} gas / ${label('drift')} drift</option>`;
 }).join('');
 return `<label class="settings-row">Controller preset<select class="control" data-pref="padPreset" data-focus-id="pad-preset">${options}</select></label>`;
}
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||''}</svg>`}
function hydrateIcons(){all('[data-i]').forEach(el=>el.outerHTML=icon(el.dataset.i))}
function mapIcon(t){
 const points=window.AcornSim?.track(tracks.indexOf(t)).points;
 if(!points)return `<svg viewBox="0 0 100 54" class="course-map" aria-hidden="true"><path d="${t.shape}"/></svg>`;
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),left=Math.min(...xs),top=Math.min(...zs),w=Math.max(...xs)-left,h=Math.max(...zs)-top;
 const path=points.filter((_,i)=>i%8===0).map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.z.toFixed(1)).join(' ')+'Z';
 return `<svg viewBox="${left-6} ${top-6} ${w+12} ${h+12}" class="course-map" aria-hidden="true"><path style="stroke-width:${w*.028}" d="${path}"/></svg>`
}
function bars(level){let n=({Beginner:1,Intermediate:2,Advanced:3,Expert:3,Master:3,Ultra:3})[level];return `<i class="skill-bars" aria-hidden="true">${[1,2,3].map(i=>`<em class="${i<=n?'on':''}"></em>`).join('')}</i>`}
const pad2=n=>String(n).padStart(2,'0');
function time(v){if(!Number.isFinite(v)||v<=0)return '—';const ms=Math.round(v*1000);return `${Math.floor(ms/60000)}:${pad2(Math.floor(ms/1000)%60)}.${String(ms%1000).padStart(3,'0')}`}
function ordinal(n){return n+((n>=11&&n<=13)?'th':({1:'st',2:'nd',3:'rd'})[n%10]||'th')}
function safeName(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notice(s){const t=one('#toast');clearTimeout(toastTimer);t.textContent=s;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),2400)}
function syncMusic(){
 window.AcornMusic?.setEnabled(settings.sound && settings.music && !document.hidden);
}
function activateAudio(){
 if(settings.sound && !document.hidden)window.AcornRace?.unlockAudio();
}
function pref(){write('settings',settings);soundIcon();syncMusic()}
function soundIcon(){const b=one('#soundBtn');b.innerHTML=icon(settings.sound?'volume':'mute');b.title=b.ariaLabel=settings.sound?'Mute sound':'Enable sound'}
function assignSeat(seat,index){const prior=seats[seat],other=seats.indexOf(index);if(other!==-1&&other!==seat)seats[other]=prior;seats[seat]=index}
function updateDriver(){if(!driverAvailable(driver))driver=0;one('#profileName').textContent=drivers[driver].name;one('#profileImage').src=`art/driver-${driver}.webp`;write('driver',driver);assignSeat(0,driver)}
function nav(next){window.KartViewer?.stop();page=next;if(page!=='select')draftGrid=null;const activePage=page==='select'?'hub':page;all('.main-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===activePage);b.setAttribute('aria-current',b.dataset.page===activePage?'page':'false')});if(page==='garage')garage();else if(page==='records')showRecords();else if(page==='select')driverSelect();else hub();window.scrollTo(0,0)}
function hero(){const t=tracks[track];return `<div class="hero-image" style="background-image:url('art/${track===0?'hero':'course-'+track}.webp')"></div><div class="hero-shade"></div>
<div class="hero-copy"><div class="hero-kicker eyebrow"><span class="checker"></span>${track===0?'Featured circuit':'Selected circuit'}</div>
<h1 class="hero-title ${t.name.length>16?'long':''}"><span>${t.line[0]}</span><span>${t.line[1]}</span></h1>
<p class="hero-location">${icon('pin')}${t.place}</p><div class="hero-tags"><span>${bars(t.level)}${t.level}</span><span>${icon('lap')}${laps} ${laps===1?'lap':'laps'}</span><span>${icon('road')}${t.surface}</span><span class="hero-class">${engineClass} cc</span></div>
<div class="hero-actions"><button class="action primary" data-action="start">${icon('flag')}Single race</button><button class="action primary cup-shortcut" data-setup="cup">${icon('trophy')}Cup series</button><button class="action secondary" data-action="liveJoin">${icon('globe')}Live Join</button><button class="action secondary" data-action="setup">${icon('tune')}Race setup</button></div></div>
<div class="hero-ident" aria-label="Circuit ${track+1} of ${tracks.length}">${pad2(track+1)}<span class="slash">/</span><span class="total">${pad2(tracks.length)}</span></div>`}
function cards(){return tracks.map((t,i)=>`<button class="course ${i===track?'chosen':''}" data-track="${i}" aria-pressed="${i===track}" aria-label="Select ${t.name}"><span class="course-photo"><img src="art/course-${i}.webp" alt="" draggable="false"><span class="track-no">${pad2(i+1)}</span>${i===track?`<span class="selected-icon">${icon('check')}</span>`:''}</span><span class="card-info"><strong>${t.name}</strong><span class="card-place">${t.region}</span><span class="course-foot"><span class="level ${t.level.toLowerCase()}">${bars(t.level)}${t.level}</span>${mapIcon(t)}</span></span></button>`).join('')}
function hub(){
 main.innerHTML=`<section class="hero" aria-label="Selected circuit">${hero()}</section>
 <section class="circuits" aria-labelledby="circuitsHeading"><div class="section-head"><span class="marks" aria-hidden="true"></span><h2 class="sec-title" id="circuitsHeading">Circuit select</h2><span class="count">${tracks.length} circuits</span><div class="shelf-buttons"><button data-action="prev" aria-label="Previous circuits">${icon('left')}</button><button data-action="next" aria-label="Next circuits">${icon('right')}</button></div></div><div class="course-shelf">${cards()}</div></section>
 <section class="mode-strip online-modes" aria-label="More race modes"><h2>Race modes</h2>${[['cup','trophy','Cup series',`${cups.length} championships`],['trial','clock','Time trial','Chase your best lap'],['local','users','Multiplayer','Split-screen & private rooms']].map(([m,i,n,d])=>`<button class="mode-shortcut" data-setup="${m}">${icon(i)}<span><strong>${n}</strong><small>${d}</small></span>${icon('right')}</button>`).join('')}<button class="mode-shortcut" data-action="rooms">${icon('globe')}<span><strong>Online servers</strong><small>Public list &amp; private codes</small></span>${icon('right')}</button></section>`;
 const shelf=one('.course-shelf');shelf.scrollLeft=shelfPos;shelf.addEventListener('scroll',()=>{shelfPos=shelf.scrollLeft;arrowState()},{passive:true});arrowState();
}
function arrowState(){const shelf=one('.course-shelf');if(!shelf)return;one('[data-action=prev]').disabled=shelf.scrollLeft<3;one('[data-action=next]').disabled=shelf.scrollLeft+shelf.clientWidth>=shelf.scrollWidth-3}
function chooseTrack(i){track=Math.max(0,Math.min(tracks.length-1,i));beginDriverSelect('race')}
function shiftShelf(dir){const s=one('.course-shelf');const w=s.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(s).gap);s.scrollBy({left:dir*w*Math.max(1,Math.floor((s.clientWidth+10)/w)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
function beginDriverSelect(raceMode,fromSetup=false){
 const origin=page==='records'?'records':'hub';
 closeModal();mode=raceMode;
 draftGrid={choices:[...seats],seat:0,count:mode==='local'?Math.max(2,players):1,origin,fromSetup};
 if(mode==='local')openLocalGrid(draftGrid);
 nav('select');
 one('[data-pick-driver][aria-pressed="true"]')?.focus({preventScroll:true});
 window.KartViewer?.loadModels().catch(()=>{});
}
function driverSelect(){
 if(mode==='local'&&draftGrid?.ready){localGridScreen();return;}
 const {choices,seat,count}=draftGrid,i=choices[seat],d=drivers[i],course=mode==='cup'?cups[cupIndex].tracks[0]:track;
 const eventName=mode==='cup'?cups[cupIndex].name:tracks[course].name;
 const courseHazard=window.AcornHazards.routes[course];
 const realmReward=course===championship.darknessCircuit&&mode!=='trial'&&!driverAvailable(championship.wolfDriver)
   ? '<small class="realm-reward">Win on Ultimate to unlock Grimoire the Vile.</small>':'';
 const eventDetails=mode==='cup'?'4 circuits':(mode==='trial'?3:laps)+' '+((mode==='trial'?3:laps)===1?'lap':'laps');
 const remaining=seat+1<count;
 const portraits=drivers.map((r,n)=>{
   const reserved=choices.slice(0,seat).indexOf(n);
   const taken=reserved!==-1,locked=!driverAvailable(n);
   return `<button type="button" class="driver-card grid-pick ${n===i?'active':''}" data-pick-driver="${n}" aria-label="${r.name} the ${r.species.toLowerCase()}${taken?' · Player '+(reserved+1):locked?' · '+championship.rewardRequirement(n):''}" aria-pressed="${n===i}" ${taken||locked?'disabled':''}><span class="driver-img"><img src="art/driver-${n}.webp" alt="">${n===i?`<span class="selected-icon">${icon('check')}</span>`:taken?`<span class="seat-number">P${reserved+1}</span>`:''}</span><span class="driver-copy"><strong>${r.name}</strong><small>${locked?lockProgress(n):r.species}</small></span></button>`;
 }).join('');
 main.innerHTML=`<section class="grid-select"><div class="select-top"><div><button class="select-back" data-action="selectBack">${icon('left')}${seat?'Previous player':draftGrid.fromSetup?'Race setup':'Circuit select'}</button><h1>${count>1?'Player '+(seat+1)+' · ':''}Choose your driver</h1></div><div class="entry-rules">${raceRules(mode)}</div></div><div class="select-layout"><div class="select-roster" aria-label="Choose a character">${portraits}</div><aside class="grid-entry" aria-label="Race entry"><div class="entry-course" style="background-image:linear-gradient(0deg,#10180ef5,transparent 100%),url('art/course-${course}.webp')"><span class="label">${modeLabels[mode]} &nbsp;·&nbsp; ${eventDetails}</span><h2>${eventName}</h2></div>${mode==='cup'?cupItinerary(cupIndex):`<div class="course-hazard"><b>${courseHazard.name}</b><small>${window.AcornHazards.tips[course]}</small>${realmReward}</div>`}<div class="entry-driver" style="--driver-color:${d.color}"><strong class="entry-name">${d.name}</strong><span class="entry-kart">${d.kart}</span><div class="entry-skill">${icon('bolt')}${d.ability}</div><p>${d.abilityText}</p><div class="entry-stats">${['Agility','Acceleration','Stability'].map((v,k)=>`<div class="stat">${v}<span class="segments" aria-label="${d.stats[k]} out of five">${[1,2,3,4,5].map(j=>`<i class="${j<=d.stats[k]?'on':''}"></i>`).join('')}</span></div>`).join('')}</div><button class="action primary confirm-driver" data-action="confirmDriver">${icon(remaining?'arrow':'play')}${remaining?'Choose player '+(seat+2):mode==='cup'?(championship.activeRun(cupIndex)?'Replace saved cup and start':'Start cup'):mode==='trial'?'Start time trial':'Start race'}</button></div></aside></div></section>`;
}
function pickGridDriver(i){
 if(mode==='local'&&draftGrid?.ready){localCursor(draftGrid.seat,i);return;}
 const {choices,seat}=draftGrid;
 if(!drivers[i]||!driverAvailable(i)||choices.slice(0,seat).includes(i))return;
 const other=choices.indexOf(i);
 if(other>=0)choices[other]=choices[seat];
 choices[seat]=i;
 driverSelect();one(`[data-pick-driver="${i}"]`).focus({preventScroll:true});
}
function driverSelectBack(){
 if(!draftGrid)return;
 if(draftGrid.seat&&!draftGrid.ready){draftGrid.seat--;driverSelect();one('[data-pick-driver][aria-pressed="true"]').focus({preventScroll:true});return}
 const {origin,fromSetup}=draftGrid;nav(origin);
 if(fromSetup)setup(mode);else one(`[data-track="${track}"]`)?.focus({preventScroll:true});
}
function confirmGridDriver(){
 if(mode==='local'&&draftGrid?.ready&&!running){localConfirm(draftGrid.seat,true);return;}
 if(!draftGrid||running||!driverAvailable(draftGrid.choices[draftGrid.seat]))return;
 if(draftGrid.seat+1<draftGrid.count){draftGrid.seat++;driverSelect();one('[data-pick-driver][aria-pressed="true"]').focus({preventScroll:true});return}
 seats=[...draftGrid.choices];driver=seats[0];updateDriver();startSelection();
}
function lockProgress(index){return `Locked · ${championship.rewardProgress(index)}`}
function garage(){
 window.KartViewer?.stop();
 const d=drivers[driver];
 main.innerHTML=`<div class="page-top"><div><h1>Driver garage</h1><p>Choose your racer for the next grid.</p></div><button class="action primary" data-page="hub">${icon('flag')}Race hub</button></div>
 <div class="garage-bench"><section id="kartViewer" aria-label="Inspect the ${d.kart} in 3D"></section><section class="driver-detail"><div><span class="label">${d.name}’s kart</span><h2>${d.kart}</h2><p>${d.description}</p><div class="ability">${icon('bolt')}${d.ability}</div><p>${d.abilityText}</p></div><div><span class="label">Handling</span>${['Agility','Acceleration','Stability'].map((v,i)=>`<div class="stat">${v}<span class="segments" aria-label="${d.stats[i]} out of five">${[1,2,3,4,5].map(j=>`<i class="${j<=d.stats[i]?'on':''}"></i>`).join('')}</span></div>`).join('')}</div></section></div>
 <div class="section-head"><span class="marks"></span><h2 class="sec-title">Select driver</h2></div>
 <section class="garage-grid" aria-label="Choose driver">${drivers.map((a,i)=>`<button class="driver-card ${i===driver?'active':''}" aria-pressed="${i===driver}" data-driver="${i}" ${driverAvailable(i)?'':`disabled title="${championship.rewardRequirement(i)}"`}><span class="driver-img"><img src="art/driver-${i}.webp" alt="${a.name} the ${a.species.toLowerCase()}">${i===driver?`<span class="selected-icon">${icon('check')}</span>`:''}</span><span class="driver-copy"><strong>${a.name}</strong><small>${driverAvailable(i)?a.species+' · '+a.kart:lockProgress(i)}</small></span></button>`).join('')}</section>`;
 window.KartViewer?.mount(one('#kartViewer'),driver);
}
function recordKey(trackIndex,cc){return cc===100?String(trackIndex):cc+'-'+trackIndex}
function showRecords(){
 const rows=tracks.map((t,i)=>{
   const rec=records[recordKey(i,recordsClass)]||{};
   return `<div class="record-row"><img src="art/course-${i}.webp" alt=""><b>${t.name}<small class="ultimate-mark">${championship.hasUltimateWin(i)?"✓ Ultimate win":"Ultimate win needed"}</small></b><time>${time(rec.lap)}</time><time>${time(rec.trial)}</time></div>`;
 }).join('');
 main.innerHTML=`<div class="page-top"><div><h1>Track records</h1><p>Your fastest laps and Time Trials in each engine class. Aurel · ${championship.rewardProgress(championship.angelDriver)}.</p></div><button class="action primary" data-action="recordTrial">${icon('clock')}Time trial</button></div><div class="record-classes">${segments('Engine class','record-cc',engineChoices,recordsClass)}</div><section class="records" aria-label="${recordsClass} cc track records"><div class="record-row record-heading"><span>Track</span><span>Circuit</span><span>Best lap</span><span>3-lap trial</span></div>${rows}</section>`;
}
function closeModal(){capture='';modal=null;if(dialog.open)dialog.close();document.body.style.overflow=running?'hidden':''}
let bindingsFromSettings=false;
function modalView(kind,title,content){
 if(kind==='bindings'&&modal!=='bindings')bindingsFromSettings=modal==='settings';
 const already=dialog.open,focus=already&&document.activeElement?.dataset?.focusId;modal=kind;
 dc.innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="close-btn" ${kind==='results'?'data-action="resultHub"':'data-action="close"'} aria-label="Close">${icon('close')}</button></div>${content}`;
 if(!already)dialog.showModal();document.body.style.overflow='hidden';
 if(focus)Array.from(dc.querySelectorAll('[data-focus-id]')).find(e=>e.dataset.focusId===focus)?.focus({preventScroll:true});
}
function summaryCard(i){return `<div class="summary-card"><img src="art/course-${i}.webp" alt=""><span><b>${tracks[i].name}</b><small>${tracks[i].place}</small></span></div>`}
function segments(label,action,vals,current){return `<fieldset class="group"><legend>${label}</legend><div class="segmented">${vals.map(([v,l])=>`<button data-${action}="${v}" data-focus-id="${action}-${v}" class="${v===current?'active':''}" aria-pressed="${v===current}">${l}</button>`).join('')}</div></fieldset>`}
function raceRules(m){
 return segments('Engine class','engine',engineChoices,engineClass)+(m==='trial'?'':segments('AI difficulty','skill',skillChoices,cpuLevel));
}
function saveRaceRules(){
 write('race-rules',{cc:engineClass,difficulty:cpuLevel});
}
function refreshRuleControls(key){
 saveRaceRules();
 if(modal==='setup'){if(page==='hub')one('.hero').innerHTML=hero();setup(mode);return}
 if(page==='select'){driverSelect();one(`[data-focus-id="${key}"]`)?.focus({preventScroll:true})}
}
function cupItinerary(index){
 const cup=cups[index];
 return `<ol class="cup-itinerary" aria-label="${cup.name} race order">${cup.tracks.map((id,n)=>`<li><img src="art/course-${id}.webp" alt=""><span><small>Race ${n+1}</small><b>${tracks[id].name}</b></span></li>`).join('')}</ol>`;
}
function cupSetup(){
 const c=cups[cupIndex],gold=championship.goldLevel(cupIndex);
 return segments('Championship','cup',cups.map((entry,i)=>[i,entry.name]),cupIndex)+
   `<section class="cup-brief"><div class="cup-title"><strong>${c.name}</strong>${gold?`<span>${icon('trophy')}${skillLabel(gold)} gold</span>`:''}</div><p>${c.theme}</p>${cupItinerary(cupIndex)}</section>`;
}
function cupScoring(){
 return `<details class="cup-scoring"><summary>How cup points work</summary><p>First through eighth earn ${championship.points.join(', ')} points. The highest total after four races wins. Ties go to the most firsts, then seconds and so on, then the better finish in the last race.</p></details>`;
}
function cupReward(index){
 const reward=championship.rewardForCup(index),unlocked=driverAvailable(reward),racer=drivers[reward];
 const requirement=championship.rewardRequirement(reward)+(reward!==championship.spectrumDriver?' · '+championship.rewardProgress(reward):'');
 return `<div class="cup-reward"><img src="art/driver-${reward}.webp" alt=""><div><strong>${racer.kart} · ${unlocked?'Unlocked':reward===championship.angelDriver?'Circuit mastery reward':'Cup reward'}</strong><span>${unlocked?`${racer.name} is available in the garage.`:requirement}</span></div></div>`;
}
function setup(m=mode){mode=m;
 const cupMode=m==='cup',local=m==='local',saved=cupMode&&championship.activeRun(cupIndex);
 modalView('setup','Race setup',`${cupMode?'':summaryCard(track)}${segments('Race mode','mode',Object.entries(modeLabels),m)}
 ${cupMode?'':`<label class="field"><span>Circuit</span><select data-setup-track data-focus-id="setup-track">${tracks.map((t,i)=>`<option value="${i}" ${i===track?'selected':''}>${t.name}</option>`).join('')}</select></label>`}
 ${cupMode?cupSetup():''}
 ${raceRules(m)}
 ${local?segments('Local players','players',[[2,'2 players'],[3,'3 players'],[4,'4 players']],Math.max(2,players))+'<div id="localDevices">'+localDevicesMarkup(Math.max(2,players))+'</div>':''}
 ${m==='race'||local?segments('Laps','laps',[[1,'1 lap'],[3,'3 laps'],[5,'5 laps']],laps):''}
 <p class="form-note">${({race:'Eight karts on the grid. Collect acorns and hold drift through corners to charge an exit boost.',trial:'Three laps, a clear track, and your personal-best ghost. Acorn items are disabled.',cup:'Four races, three laps each. The driver with the most points wins the cup.',local:'Press a button on each controller to show it here. Choose a controller or keyboard for each player.'})[m]}</p>
 ${cupMode?cupScoring()+cupReward(cupIndex):''}
 ${saved?`<div class="cup-resume"><div><strong>Continue ${cups[cupIndex].name}</strong><small>Race ${saved.rounds.length+1} of 4 · ${drivers[saved.driver].name} · ${saved.cc} cc · ${skillLabel(saved.difficulty)}</small></div><button type="button" class="action primary" data-action="resumeCup">Resume${icon('arrow')}</button></div>`:''}
 <div class="modal-bottom">${local?`<button class="action secondary" data-action="rooms">${icon('globe')}Private room</button>`:''}<button class="action ${saved?'secondary':'primary'}" data-action="go">${saved?'Start a new cup':local?'Choose drivers':'Choose driver'}${icon('arrow')}</button></div>`);
}
function settingsPanel(){modalView('settings','Settings',`<label class="settings-row">Graphics<select class="control" data-pref="graphics"><option value="full" ${settings.graphics!=='performance'?'selected':''}>Full</option><option value="performance" ${settings.graphics==='performance'?'selected':''}>Performance</option></select></label><label class="settings-row">Game audio<input type="checkbox" class="switch" data-pref="sound" ${settings.sound?'checked':''}></label><label class="settings-row">Music<input type="checkbox" class="switch" data-pref="music" ${settings.music?'checked':''}></label><label class="settings-row">Auto-accelerate with keyboard or controller<input type="checkbox" class="switch" data-pref="autoAccel" ${settings.autoAccel?'checked':''}></label><label class="settings-row">Stick dead zone <span><output id="dz">${Math.round(settings.deadzone*100)}%</output> <input type="range" min="0" max="75" value="${Math.round(settings.deadzone*100)}" data-pref="deadzone"></span></label>${presetPicker()}<label class="settings-row">Controller prompts<select data-pref="padStyle" data-focus-id="pad-style" class="control"><option value="xbox" ${settings.padStyle==='xbox'?'selected':''}>Xbox</option><option value="ps" ${settings.padStyle==='ps'?'selected':''}>PlayStation</option></select></label>
 <button type="button" class="action secondary touch-layout-setting" data-action="touchLayout">Edit touch controls</button>
 <p class="form-note">Touch driving accelerates automatically. Hold Brake to slow down and release it to accelerate again.</p>
 <div class="modal-bottom"><button class="action secondary" data-action="bindings">${icon('keyboard')}Controls</button><button class="action primary" data-action="close">Done</button></div>
 <p class="form-note"><a class="kit-link" href="assets/Acorn-Rally-Models.zip" download>${icon('download')}Download editable 3D models</a></p>`)}
function keyName(k){return (k||'').replace(/^Key/,'').replace(/^Digit/,'').replace(/^Arrow/,'Arrow ').replace(/Left$/,' Left').replace(/Right$/,' Right').trim()}
function controlsPanel(){modalView('bindings','Driving controls',`${presetPicker()}<div class="control-line label"><span>Action</span><span>Keyboard</span><span>${settings.padStyle==='ps'?'PlayStation':'Xbox'}</span></div>${Object.entries(keys).map(([k,l])=>`<div class="control-line"><span>${l}</span><span><button data-bind="${k}" data-focus-id="bind-${k}" class="binding ${k===capture?'capture':''}">${k===capture?'Press a key…':keyName(settings.bindings[k])}</button></span><span>${gamepadControls.buttonLabel(gamepadControls.get(settings.padPreset),k,settings.padStyle)}</span></div>`).join('')}<div class="control-line"><span>Pause</span><span><kbd>Esc</kbd></span><span>${settings.padStyle==='ps'?'Options':'Menu'}</span></div><p class="form-note">Select a keyboard binding to change it. Arrow keys also steer, accelerate, and brake.</p><div class="modal-bottom"><button class="action secondary" data-action="resetKeys">Reset keys</button><button class="action primary" data-action="close">Done</button></div>`)}
function openRooms(liveJoin=false){
 if(!window.RallyRooms){notice('Private rooms could not load. Refresh to try again.');return}
 modal='rooms';dc.replaceChildren();if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden';
 window.RallyRooms.open({container:dc,trackIndex:track,driverIndex:driver,cc:engineClass,difficulty:cpuLevel,settings,liveJoin,
  preloadRaceGraphics:()=>{void window.KartViewer.loadRaceGraphics().catch(()=>{});},
  startRace:o=>{roomSession=o.network;launch({...o,mode:'race'})},
   onStartCancelled:()=>{roomSession=null;detachRace();modal='rooms';document.body.style.overflow='hidden'},
  onRetired:hasResults=>{
   roomSession=null;
   if(!hasResults&&running){detachRace();closeModal();nav('hub');notice('The race room closed before results arrived.')}
  },
  onClose:()=>{roomSession=null;closeModal()}
 });
}
function itemGuide(){
 const {items,hawkItem}=window.AcornSim;
 const art=window.AcornItemArt;
 modalView('items','Acorn items',
  '<p class="form-note">Items vary by race position. Eighth place has a 50% chance to draw Hawk, and the back of the pack can occasionally draw Stormburst.</p>'+
  items.map((name,i)=>{
   const icon=i>=hawkItem?`<canvas data-item-icon="${i}" width="48" height="48" aria-hidden="true"></canvas>`:`<img src="art/item-${i}.webp" alt="">`;
   return `<div class="item-guide-row">${icon}<div><small class="item-role">${window.AcornFeedback.roles[i]}</small><b style="color:${art.colors[i]}">${name}</b><p>${art.descriptions[i]}</p></div></div>`;
  }).join('')+'<div class="modal-bottom"><button class="action primary" data-action="close">Done</button></div>');
 for(const icon of dc.querySelectorAll('[data-item-icon]'))art.drawItemIcon(icon.getContext('2d'),Number(icon.dataset.itemIcon),24,24,24);
}
function startSelection(){
 roomSession=null;
 if(mode==='cup'){
   cup=championship.start(cupIndex,driver,engineClass,cpuLevel);
   nextCupRace();
   return;
 }
 cup=null;
 launch({trackIndex:track,cc:engineClass,difficulty:cpuLevel,driverIndex:driver,driverIndices:seats.slice(),padSeats:mode==='local'?draftGrid?.padSeats:undefined,mode:mode==='local'?'race':mode,players:mode==='local'?Math.max(2,players):1,laps:mode==='trial'?3:laps});
}
function resumeCup(){
 const saved=championship.activeRun(cupIndex);
 if(!saved||!driverAvailable(saved.driver)){setup('cup');return}
 mode='cup';roomSession=null;cup=saved;driver=cup.driver;updateDriver();nextCupRace();
}
function nextCupRace(){
 const c=cups[cup.index],round=cup.rounds.length;
 track=c.tracks[round];
 launch({mode:'cup',trackIndex:track,cc:cup.cc,difficulty:cup.difficulty,driverIndex:cup.driver,players:1,laps:3,cupRoundLabel:`${c.name} · ${round+1}/4`});
}
async function launch(options){
 if(!window.AcornRace){notice('The race engine could not load. Refresh to try again.');return}
 if(running)return;
 if(!options.network&&!driverAvailable(options.driverIndex)){notice(championship.rewardRequirement(options.driverIndex)+' to unlock this driver.');return}
 lastRun=options;running=true;closeModal();race.hidden=false;app.inert=true;document.body.style.overflow='hidden';
 race.innerHTML=`<div class="grid-loading" style="background-image:linear-gradient(0deg,#121712ec,#12171233),url(art/course-${options.trackIndex}.webp)"><div><span class="hero-kicker eyebrow"><span class="checker"></span>${options.cupRoundLabel||'Preparing starting grid'}</span><h2>${tracks[options.trackIndex].name}</h2><p role="status">Loading kart graphics…</p><div class="load-progress"></div></div></div>`;
 let kartTextures;
 try{
   kartTextures=await window.KartViewer.loadRaceGraphics();
   if(!running||lastRun!==options)return;
   race.replaceChildren();window.AcornRace.start({
     ...options,container:race,kartTextures,settings:{...settings,bindings:{...settings.bindings}},
     onExit:leaveRace,onFinish:finish,onSoundChange:enabled=>{settings.sound=enabled;pref()},
     onPadPresetChange:id=>{settings.padPreset=id;pref()},onGraphicsChange:graphics=>{settings.graphics=graphics;pref()}
   });
 }catch(err){
   if(!running||lastRun!==options)return;
   console.error(err);leaveRace();
   notice(kartTextures?'The race could not start. Refresh the game and try again.':'Kart graphics could not load. Check your connection and try again.');
 }
}
function detachRace(){running=false;window.AcornRace?.stop();race.hidden=true;app.inert=false;document.body.style.overflow=''}
function returnRoom(){const net=roomSession;roomSession=null;closeModal();modal='rooms';net.returnToLobby();document.body.style.overflow='hidden'}
function leaveRace(){detachRace();if(roomSession){returnRoom();return}const pausedCup=cup;cup=null;nav('hub');if(pausedCup)notice(`${cups[pausedCup.index].name} saved · Resume race ${pausedCup.rounds.length+1} in Cup series`)}
function updateResults(r){const idx=recordKey(r.trackIndex??lastRun.trackIndex,simulation.normalizeCC(r.cc??lastRun.cc)),rec=records[idx]||{};if(r.bestLap>0&&(!rec.lap||r.bestLap<rec.lap))rec.lap=r.bestLap;if(lastRun.mode==='trial'&&lastRun.laps===3&&r.time>0&&(!rec.trial||r.time<rec.trial))rec.trial=r.time;records[idx]=rec;write('records',records)}
function unlockCard(id){
 return `<div class="cup-unlocked" role="status"><img src="art/driver-${id}.webp" alt=""><div><small>Racer unlocked</small><strong>${drivers[id].name}</strong><span>${drivers[id].kart} · Available in the garage</span></div></div>`;
}
function finishCup(result){
 const round=championship.record(cup,result);
 cup=round.run;
 const c=cups[cup.index],number=cup.rounds.length,board=championship.standings(cup);
 const player=board.find(row=>row.driver===cup.driver),place=board.indexOf(player)+1;
 const winner=drivers[board[0].driver].name,course=tracks[result.trackIndex].name;
 const title=round.complete?c.name+' results':c.name+' · '+number+' / 4';
 const next=round.complete?'Choose cup':`Race ${number+1} · ${tracks[c.tracks[number]].name}`;
 const podium=round.complete?(round.won?'Cup champion':ordinal(place)+' overall'):ordinal(result.position)+' in '+course;
 const subhead=round.complete?`${winner} wins with ${board[0].total} points · ${cup.cc} cc · ${skillLabel(cup.difficulty)}`:`${drivers[cup.driver].name} · +${championship.points[player.last-1]} pts · ${cup.cc} cc · ${skillLabel(cup.difficulty)}`;
 const unlocks=[];
 if(round.unlockedDriver!==null)unlocks.push(round.unlockedDriver);
 if(championship.recordUltimate(result))unlocks.push(championship.angelDriver);
 modalView('results',title,`<div class="result-podium"><img src="art/driver-${cup.driver}.webp" alt=""><div><strong>${podium}</strong><span>${subhead}</span></div></div>
 <div class="result-stats"><div><small>Race time</small><b>${time(result.time)}</b></div><div><small>Best lap</small><b>${time(result.bestLap)}</b></div><div><small>Your points</small><b>${player.total}</b></div></div>
 <table class="cup-table"><caption>${round.complete?'Final standings':'Cup standings'}</caption><thead><tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Race ${number}</th><th scope="col">Points</th></tr></thead><tbody>${board.map((s,i)=>`<tr class="${s.driver===cup.driver?'human':''}"><td>${i+1}</td><th scope="row">${drivers[s.driver].name}${s.driver===cup.driver?' · You':''}</th><td>${ordinal(s.last)} <small>+${championship.points[s.last-1]}</small></td><td><b>${s.total}</b></td></tr>`).join('')}</tbody></table>
 ${unlocks.length?unlocks.map(unlockCard).join(''):round.complete?cupReward(cup.index):''}
 <div class="modal-bottom"><button class="action secondary" data-action="resultHub">${round.complete?'Race hub':'Save and exit'}</button><button class="action primary" data-action="rematch">${next}${icon('arrow')}</button></div>`);
}
function finish(r){
 if(!running)return;
 updateResults(r);detachRace();
 if(cup){
   try{finishCup(r)}catch(err){console.error(err);notice('The round could not be scored. Resume the cup to retry this circuit.');resultHub()}
   return;
 }
 const idx=r.trackIndex??lastRun.trackIndex,d=drivers[r.driverIndex??driver],board=r.standings||[];
 const title=lastRun.mode==='trial'?'Trial complete':'Race results';
 const queueRace=lastRun.network?.queueMode;
 const next=queueRace?'Race queue':roomSession?'Room lobby':'Race again';
 const unlocked=!r.dnf&&championship.recordUltimate(r,!roomSession&&lastRun.players>1);
 if(queueRace)roomSession=null;
 modalView('results',title,`<div class="result-podium"><img src="art/driver-${r.driverIndex??driver}.webp" alt=""><div><strong>${r.dnf?'DNF':lastRun.mode==='trial'?'Finish':ordinal(r.position||1)+' place'}</strong><span>${d.name} · ${tracks[idx].name} · ${simulation.normalizeCC(r.cc??lastRun.cc)} cc</span></div></div><div class="result-stats"><div><small>Race time</small><b>${r.dnf?'—':time(r.time)}</b></div><div><small>Best lap</small><b>${time(r.bestLap)}</b></div></div>
 ${unlocked?unlockCard(idx===championship.darknessCircuit?championship.wolfDriver:championship.angelDriver):''}
 ${board.map(s=>`<div class="finish-row ${s.human?'human':''}"><span>${pad2(s.position)}</span><b>${safeName(s.name)}</b><span>${queueRace&&s.time==null?'DNF':time(s.time)}</span></div>`).join('')}
 <div class="modal-bottom"><button class="action secondary" data-action="resultHub">Race hub</button><button class="action primary" data-action="${queueRace?'rooms':'rematch'}">${next}${icon('arrow')}</button></div>`);
}
function rematch(){
 if(roomSession){returnRoom();return}
 if(!cup){beginDriverSelect(mode);return}
 if(cup.rounds.length<cups[cup.index].tracks.length){nextCupRace();return}
 cup=null;closeModal();nav('hub');setup('cup');
}
function resultHub(){roomSession?.leave();roomSession=null;cup=null;closeModal();nav('hub')}
function closeAction(){if(modal==='results'){resultHub();return}if(modal==='rooms'){dc.querySelector('[data-rr="close"]')?.click();return}closeModal()}
function backFromDialog(){
 if(modal==='bindings'&&bindingsFromSettings){
   capture='';settingsPanel();dc.querySelector('[data-action="bindings"]')?.focus({preventScroll:true});return;
 }
 closeAction();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.action==='liveJoin'){openRooms(true);return}
 if(b.dataset.page){if(b.dataset.page==='records')recordsClass=engineClass;nav(b.dataset.page);return}
 if(b.dataset.engine){engineClass=simulation.normalizeCC(b.dataset.engine);refreshRuleControls('engine-'+engineClass);return}
 if(b.dataset.skill){cpuLevel=simulation.normalizeDifficulty(b.dataset.skill);refreshRuleControls('skill-'+cpuLevel);return}
 if(b.dataset.recordCc){recordsClass=simulation.normalizeCC(b.dataset.recordCc);showRecords();one(`[data-record-cc="${recordsClass}"]`)?.focus({preventScroll:true});return}
 if(b.hasAttribute('data-track')){chooseTrack(+b.dataset.track);return}
 if(b.hasAttribute('data-pick-driver')){pickGridDriver(+b.dataset.pickDriver);return}
 if(b.hasAttribute('data-local-seat')&&draftGrid?.ready){draftGrid.seat=+b.dataset.localSeat;renderLocalGrid();return}
 if(b.hasAttribute('data-driver')){if(!driverAvailable(+b.dataset.driver))return;driver=+b.dataset.driver;updateDriver();garage();one(`[data-driver="${driver}"]`).focus({preventScroll:true});return}
 if(b.dataset.setup){setup(b.dataset.setup);return}
 if(b.dataset.mode){setup(b.dataset.mode);return}
 if(b.hasAttribute('data-cup')){cupIndex=+b.dataset.cup;setup();return}
 if(b.dataset.players){players=+b.dataset.players;setup();return}
 if(b.dataset.laps){laps=+b.dataset.laps;if(page==='hub')one('.hero').innerHTML=hero();setup();return}
 if(b.dataset.bind){capture=b.dataset.bind;controlsPanel();return}
 ({recordTrial:()=>{engineClass=recordsClass;saveRaceRules();setup('trial')},start:()=>beginDriverSelect('race'),setup:()=>setup(),go:()=>beginDriverSelect(mode,true),selectBack:driverSelectBack,confirmDriver:confirmGridDriver,prev:()=>shiftShelf(-1),next:()=>shiftShelf(1),close:closeAction,touchLayout:()=>window.AcornTouch.edit(),bindings:controlsPanel,rooms:openRooms,resetKeys:()=>{capture='';settings.bindings={...defaults.bindings};pref();controlsPanel()},rematch,resultHub,resumeCup})[b.dataset.action]?.();
});
document.addEventListener('change',e=>{const a=e.target;if(a.hasAttribute('data-setup-track')){track=+a.value;if(page==='hub')hub();setup(mode);return}if(a.dataset.pref){const p=a.dataset.pref;settings[p]=p==='deadzone'?+a.value/100:a.type==='checkbox'?a.checked:a.value;pref();if(p==='sound'||p==='music')activateAudio();if(p==='padPreset'&&modal==='bindings')controlsPanel();if(p==='padStyle'&&modal==='settings')settingsPanel()}});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&page==='select'&&!dialog.open&&!running){e.preventDefault();driverSelectBack()}});
document.addEventListener('input',e=>{if(e.target.dataset.pref==='deadzone')one('#dz').textContent=e.target.value+'%'});
document.addEventListener('keydown',e=>{if(!capture)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){capture='';controlsPanel();return}if(['Tab','Enter','F5','MetaLeft','MetaRight'].includes(e.code))return;const prior=Object.keys(settings.bindings).find(k=>settings.bindings[k]===e.code);if(prior)settings.bindings[prior]=settings.bindings[capture];settings.bindings[capture]=e.code;capture='';pref();controlsPanel()},true);
dialog.addEventListener('cancel',e=>{e.preventDefault();if(modal!=='rooms')backFromDialog()});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeAction()}});
one('#settingsBtn').onclick=settingsPanel;one('#guideBtn').onclick=controlsPanel;one('#itemGuideBtn').onclick=itemGuide;one('#soundBtn').onclick=()=>{settings.sound=!settings.sound;pref();activateAudio();notice(settings.sound?'Sound on':'Sound muted')};
document.addEventListener('pointerup',activateAudio,true);
document.addEventListener('keydown',activateAudio,true);
document.addEventListener('visibilitychange',syncMusic);
window.addEventListener('resize',arrowState);
let previousPads=[],navHeld='',nextMove=0,connectedPads='',focusView=null;
const focusable='button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled):not([type="hidden"]),details > summary:first-of-type';
const dialogEntry={setup:'[data-mode][aria-pressed="true"]',settings:'[data-pref="sound"]',bindings:'[data-pref="padPreset"]',results:'.modal-bottom .primary'};
const padHint=document.createElement('span');
padHint.className='pad-nav-hint';padHint.hidden=true;
one('footer').prepend(padHint);
function focusWithPad(el){
 if(!el)return;
 el.focus({preventScroll:true});
 el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
}
function adjustControl(el,step){
 if(el.tagName==='SELECT'){
   const options=Array.from(el.options).filter(o=>!o.disabled);
   if(!options.length)return false;
   const i=options.indexOf(el.selectedOptions[0]);
   const next=i<0 ? (step>0?0:options.length-1) : (i+step+options.length)%options.length;
   el.value=options[next].value;
 }else if(el.matches('input[type=range]')){
   const n=+(el.step||1)*step*5;
   el.value=String(Math.min(+el.max,Math.max(+el.min,+el.value+n)));
   el.dispatchEvent(new Event('input',{bubbles:true}));
 }else return false;
 el.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function moveMenuFocus(active,candidates,dx,dy){
 const rect=active.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 let winner=null,score=Infinity;
 for(const el of candidates){
   if(el===active)continue;
   const r=el.getBoundingClientRect(),cx=r.left+r.width/2-x,cy=r.top+r.height/2-y;
   const forward=dx?cx*dx:cy*dy;if(forward<3)continue;
   const across=dx?Math.max(0,rect.top-r.bottom,r.top-rect.bottom):Math.max(0,rect.left-r.right,r.left-rect.right);
   const lateral=Math.abs(dx?cy:cx);
   const cost=forward+across*5+lateral*.65;
   if(cost<score){winner=el;score=cost;}
 }
 if(winner)focusWithPad(winner);
}
function menuGamepad(ts){
 requestAnimationFrame(menuGamepad);
 let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]);}catch{return;}
 const earlier=previousPads;
 previousPads=pads.map(p=>p?.buttons.map(b=>b.pressed)||[]);
 const devices=pads.filter(p=>p&&p.connected!==false),ids=devices.map(p=>p.index+'-'+p.id).join('|'),connected=ids!==connectedPads;
 connectedPads=ids;
 if(!devices.length){if(!padHint.hidden)padHint.hidden=true;if(connected)delete document.documentElement.dataset.padNav;focusView=null;navHeld='';if(!running)handleLocalPads(pads,earlier,ts);return;}
 const ps=settings.padStyle==='ps';
 const hint=ps?'D-pad · Move　 Cross · Select　 Circle · Back　 L1/R1 · Cycle':'D-pad · Move　 A · Select　 B · Back　 LB/RB · Cycle';
 if(padHint.textContent!==hint)padHint.textContent=hint;
 const hideHint=running||(!dialog.open&&page==='select'&&mode==='local');
 if(padHint.hidden!==hideHint)padHint.hidden=hideHint;
 if(connected)document.documentElement.dataset.padNav='on';
 if(running||window.AcornTouch.editing)return;
 const press=(p,i)=>p.buttons[i]?.pressed&&!earlier[p.index]?.[i];
 const controller=devices.find(p=>p.buttons.some((_,i)=>press(p,i)))||devices.find(p=>p.buttons.some(b=>b.pressed)||p.axes.some(v=>Math.abs(v)>.56));
 if(controller)document.documentElement.dataset.padNav='on';
 if(handleLocalPads(pads,earlier,ts)){focusView=null;navHeld='';return;}
 const owner=dialog.open?dc:app;
 if(document.documentElement.dataset.padNav!=='on')return;
 const view=dialog.open?modal:page,changedView=focusView!==view;
 let active=document.activeElement;
 if(!controller){navHeld='';if(!connected&&!changedView&&owner.contains(active)&&active.matches(focusable))return;}
 focusView=view;
 const candidates=Array.from(owner.querySelectorAll(focusable)).filter(el=>el.getClientRects().length);
 if(!candidates.length)return;
 if(!candidates.includes(active)||changedView&&dialog.open&&active.matches('.close-btn')){
   const initial=dialog.open?owner.querySelector(dialogEntry[modal]||'.modal-bottom .primary'):
     (page==='hub'?one('[data-action=start]'):page==='select'?one('[data-pick-driver][aria-pressed=true]'):one('.main-nav [aria-current=page]'));
   active=candidates.includes(initial)?initial:candidates[0];focusWithPad(active);
 }
 if(!controller){navHeld='';return;}
 const p=controller;
 if(p.buttons.some((_,i)=>press(p,i)))activateAudio();
 if(press(p,1)){
   if(capture){capture='';controlsPanel();}else if(dialog.open)backFromDialog();else if(page==='select')driverSelectBack();else if(page!=='hub')nav('hub');
   return;
 }
 if(press(p,4)||press(p,5)){
   const delta=press(p,5)?1:-1,index=candidates.indexOf(active);
   focusWithPad(candidates[(index+delta+candidates.length)%candidates.length]);return;
 }
 if(press(p,0)){if(active.tagName==='SELECT')adjustControl(active,1);else active.click();return;}
 const dx=p.buttons[15]?.pressed||p.axes[0]>.56?1:p.buttons[14]?.pressed||p.axes[0]<-.56?-1:0;
 const dy=p.buttons[13]?.pressed||p.axes[1]>.56?1:p.buttons[12]?.pressed||p.axes[1]<-.56?-1:0;
 if(!dx&&!dy){navHeld='';return;}
 const key=p.index+':'+dx+':'+dy;
 if(key===navHeld&&ts<nextMove)return;
 nextMove=ts+(key===navHeld?145:310);navHeld=key;
 if(dx&&adjustControl(active,dx))return;
 moveMenuFocus(active,candidates,dx,dx?0:dy);
}
document.addEventListener('pointerdown',()=>{delete document.documentElement.dataset.padNav;},true);
hydrateIcons();soundIcon();syncMusic();window.AcornMusic?.setScene('menu');updateDriver();if(location.hash==='#garage')nav('garage');else if(location.hash==='#records')nav('records');else hub();requestAnimationFrame(menuGamepad);
if(new URLSearchParams(location.search).has('room'))openRooms();
