'use strict';
const {tracks,drivers,icons}=window.RallyData;
const one=s=>document.querySelector(s);
const all=s=>Array.from(document.querySelectorAll(s));
const app=one('#app'),main=one('#main'),dialog=one('#dialog'),dc=one('#dialogContent'),race=one('#race');
const defaults={sound:true,autoAccel:false,deadzone:0.15,padStyle:'xbox',bindings:{accelerate:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',drift:'Space',item:'KeyE',ability:'KeyQ',lookBack:'KeyC'}};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('acorn-rally-'+key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem('acorn-rally-'+key,JSON.stringify(value))}catch{}};
const opts=read('settings',{});
const settings={...defaults,...opts,bindings:{...defaults.bindings,...opts.bindings}};
const championship=window.AcornChampionship;
const cups=championship.cups;
const driverAvailable=championship.isDriverAvailable;
const rewardName=()=>drivers[championship.rewardDriver].name;
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
const padLabels={xbox:['RT','LT','Left stick','Left stick','RB','X','Y','B'],ps:['R2','L2','Left stick','Left stick','R1','Square','Triangle','Circle']};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||''}</svg>`}
function hydrateIcons(){all('[data-i]').forEach(el=>el.outerHTML=icon(el.dataset.i))}
function mapIcon(t){
 const points=window.AcornSim?.track(tracks.indexOf(t)).points;
 if(!points)return `<svg viewBox="0 0 100 54" class="course-map" aria-hidden="true"><path d="${t.shape}"/></svg>`;
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),left=Math.min(...xs),top=Math.min(...zs),w=Math.max(...xs)-left,h=Math.max(...zs)-top;
 const path=points.filter((_,i)=>i%8===0).map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.z.toFixed(1)).join(' ')+'Z';
 return `<svg viewBox="${left-6} ${top-6} ${w+12} ${h+12}" class="course-map" aria-hidden="true"><path style="stroke-width:${w*.028}" d="${path}"/></svg>`
}
function bars(level){let n=({Beginner:1,Intermediate:2,Advanced:3,Expert:3})[level];return `<i class="skill-bars" aria-hidden="true">${[1,2,3].map(i=>`<em class="${i<=n?'on':''}"></em>`).join('')}</i>`}
const pad2=n=>String(n).padStart(2,'0');
function time(v){if(!Number.isFinite(v)||v<=0)return '—';const ms=Math.round(v*1000);return `${Math.floor(ms/60000)}:${pad2(Math.floor(ms/1000)%60)}.${String(ms%1000).padStart(3,'0')}`}
function ordinal(n){return n+((n>=11&&n<=13)?'th':({1:'st',2:'nd',3:'rd'})[n%10]||'th')}
function safeName(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notice(s){const t=one('#toast');clearTimeout(toastTimer);t.textContent=s;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),2400)}
function pref(){write('settings',settings);soundIcon()}
function soundIcon(){const b=one('#soundBtn');b.innerHTML=icon(settings.sound?'volume':'mute');b.title=b.ariaLabel=settings.sound?'Mute sound':'Enable sound'}
function assignSeat(seat,index){const prior=seats[seat],other=seats.indexOf(index);if(other!==-1&&other!==seat)seats[other]=prior;seats[seat]=index}
function updateDriver(){if(!driverAvailable(driver))driver=0;one('#profileName').textContent=drivers[driver].name;one('#profileImage').src=`art/driver-${driver}.webp`;write('driver',driver);assignSeat(0,driver)}
function nav(next){window.KartViewer?.stop();page=next;if(page!=='select')draftGrid=null;const activePage=page==='select'?'hub':page;all('.main-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===activePage);b.setAttribute('aria-current',b.dataset.page===activePage?'page':'false')});if(page==='garage')garage();else if(page==='records')showRecords();else if(page==='select')driverSelect();else hub();window.scrollTo(0,0)}
function hero(){const t=tracks[track];return `<div class="hero-image" style="background-image:url('art/${track===0?'hero':'course-'+track}.webp')"></div><div class="hero-shade"></div>
<div class="hero-copy"><div class="hero-kicker eyebrow"><span class="checker"></span>${track===0?'Featured circuit':'Selected circuit'}</div>
<h1 class="hero-title ${t.name.length>16?'long':''}"><span>${t.line[0]}</span><span>${t.line[1]}</span></h1>
<p class="hero-location">${icon('pin')}${t.place}</p><div class="hero-tags"><span>${bars(t.level)}${t.level}</span><span>${icon('lap')}${laps} ${laps===1?'lap':'laps'}</span><span>${icon('road')}${t.surface}</span><span class="hero-class">${engineClass} cc</span></div>
<div class="hero-actions"><button class="action primary" data-action="start">${icon('flag')}Single race</button><button class="action primary cup-shortcut" data-setup="cup">${icon('trophy')}Cup series</button><button class="action secondary" data-action="setup">${icon('tune')}Race setup</button></div></div>
<div class="hero-ident" aria-label="Circuit ${track+1} of ${tracks.length}">${pad2(track+1)}<span class="slash">/</span><span class="total">${pad2(tracks.length)}</span></div>`}
function cards(){return tracks.map((t,i)=>`<button class="course ${i===track?'chosen':''}" data-track="${i}" aria-pressed="${i===track}" aria-label="Select ${t.name}"><span class="course-photo"><img src="art/course-${i}.webp" alt="" draggable="false"><span class="track-no">${pad2(i+1)}</span>${i===track?`<span class="selected-icon">${icon('check')}</span>`:''}</span><span class="card-info"><strong>${t.name}</strong><span class="card-place">${i===12?'Special exhibition · ':''}${t.region}</span><span class="course-foot"><span class="level ${t.level.toLowerCase()}">${bars(t.level)}${t.level}</span>${mapIcon(t)}</span></span></button>`).join('')}
function hub(){
 main.innerHTML=`<section class="hero" aria-label="Selected circuit">${hero()}</section>
 <section class="circuits" aria-labelledby="circuitsHeading"><div class="section-head"><span class="marks" aria-hidden="true"></span><h2 class="sec-title" id="circuitsHeading">Circuit select</h2><span class="count">${tracks.length} circuits</span><div class="shelf-buttons"><button data-action="prev" aria-label="Previous circuits">${icon('left')}</button><button data-action="next" aria-label="Next circuits">${icon('right')}</button></div></div><div class="course-shelf">${cards()}</div></section>
 <section class="mode-strip" aria-label="More race modes"><h2>Race modes</h2>${[['cup','trophy','Cup series','Three four-circuit championships'],['trial','clock','Time trial','Chase your best lap'],['local','users','Multiplayer','Split-screen & private rooms']].map(([m,i,n,d])=>`<button class="mode-shortcut" data-setup="${m}">${icon(i)}<span><strong>${n}</strong><small>${d}</small></span>${icon('right')}</button>`).join('')}</section>`;
 const shelf=one('.course-shelf');shelf.scrollLeft=shelfPos;shelf.addEventListener('scroll',()=>{shelfPos=shelf.scrollLeft;arrowState()},{passive:true});arrowState();
}
function arrowState(){const shelf=one('.course-shelf');if(!shelf)return;one('[data-action=prev]').disabled=shelf.scrollLeft<3;one('[data-action=next]').disabled=shelf.scrollLeft+shelf.clientWidth>=shelf.scrollWidth-3}
function chooseTrack(i){track=Math.max(0,Math.min(tracks.length-1,i));beginDriverSelect('race')}
function shiftShelf(dir){const s=one('.course-shelf');const w=s.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(s).gap);s.scrollBy({left:dir*w*Math.max(1,Math.floor((s.clientWidth+10)/w)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
function beginDriverSelect(raceMode,fromSetup=false){
 const origin=page==='records'?'records':'hub';
 closeModal();mode=raceMode;
 draftGrid={choices:[...seats],seat:0,count:mode==='local'?Math.max(2,players):1,origin,fromSetup};
 nav('select');
 one('[data-pick-driver][aria-pressed="true"]')?.focus({preventScroll:true});
 window.KartViewer?.loadModels().catch(()=>{});
}
function driverSelect(){
 const {choices,seat,count}=draftGrid,i=choices[seat],d=drivers[i],course=mode==='cup'?cups[cupIndex].tracks[0]:track;
 const eventName=mode==='cup'?cups[cupIndex].name:tracks[course].name;
 const courseHazard=window.AcornHazards.routes[course];
 const eventDetails=mode==='cup'?'4 circuits':(mode==='trial'?3:laps)+' '+((mode==='trial'?3:laps)===1?'lap':'laps');
 const remaining=seat+1<count;
 const portraits=drivers.map((r,n)=>{
   const reserved=choices.slice(0,seat).indexOf(n);
   const taken=reserved!==-1,locked=!driverAvailable(n);
   return `<button type="button" class="driver-card grid-pick ${n===i?'active':''}" data-pick-driver="${n}" aria-label="${r.name} the ${r.species.toLowerCase()}${taken?' · Player '+(reserved+1):locked?' · Win all three cups on Hard or Ultimate to unlock':''}" aria-pressed="${n===i}" ${taken||locked?'disabled':''}><span class="driver-img"><img src="art/driver-${n}.webp" alt="">${n===i?`<span class="selected-icon">${icon('check')}</span>`:taken?`<span class="seat-number">P${reserved+1}</span>`:''}</span><span class="driver-copy"><strong>${r.name}</strong><small>${locked?lockProgress():r.species}</small></span></button>`;
 }).join('');
 main.innerHTML=`<section class="grid-select"><div class="select-top"><div><button class="select-back" data-action="selectBack">${icon('left')}${seat?'Previous player':draftGrid.fromSetup?'Race setup':'Circuit select'}</button><h1>${count>1?'Player '+(seat+1)+' · ':''}Choose your driver</h1></div><div class="entry-rules">${raceRules(mode)}</div></div><div class="select-layout"><div class="select-roster" aria-label="Choose a character">${portraits}</div><aside class="grid-entry" aria-label="Race entry"><div class="entry-course" style="background-image:linear-gradient(0deg,#10180ef5,transparent 100%),url('art/course-${course}.webp')"><span class="label">${modeLabels[mode]} &nbsp;·&nbsp; ${eventDetails}</span><h2>${eventName}</h2></div>${mode==='cup'?cupItinerary(cupIndex):`<div class="course-hazard"><b>${courseHazard.name}</b><small>${window.AcornHazards.tips[course]}</small></div>`}<div class="entry-driver" style="--driver-color:${d.color}"><strong class="entry-name">${d.name}</strong><span class="entry-kart">${d.kart}</span><div class="entry-skill">${icon('bolt')}${d.ability}</div><p>${d.abilityText}</p><div class="entry-stats">${['Agility','Acceleration','Stability'].map((v,k)=>`<div class="stat">${v}<span class="segments" aria-label="${d.stats[k]} out of five">${[1,2,3,4,5].map(j=>`<i class="${j<=d.stats[k]?'on':''}"></i>`).join('')}</span></div>`).join('')}</div><button class="action primary confirm-driver" data-action="confirmDriver">${icon(remaining?'arrow':'play')}${remaining?'Choose player '+(seat+2):mode==='cup'?(championship.activeRun(cupIndex)?'Replace saved cup and start':'Start cup'):mode==='trial'?'Start time trial':'Start race'}</button></div></aside></div></section>`;
}
function pickGridDriver(i){
 const {choices,seat}=draftGrid;
 if(!drivers[i]||!driverAvailable(i)||choices.slice(0,seat).includes(i))return;
 const other=choices.indexOf(i);
 if(other>=0)choices[other]=choices[seat];
 choices[seat]=i;
 driverSelect();one(`[data-pick-driver="${i}"]`).focus({preventScroll:true});
}
function driverSelectBack(){
 if(!draftGrid)return;
 if(draftGrid.seat){draftGrid.seat--;driverSelect();one('[data-pick-driver][aria-pressed="true"]').focus({preventScroll:true});return}
 const {origin,fromSetup}=draftGrid;nav(origin);
 if(fromSetup)setup(mode);else one(`[data-track="${track}"]`)?.focus({preventScroll:true});
}
function confirmGridDriver(){
 if(!draftGrid||running||!driverAvailable(draftGrid.choices[draftGrid.seat]))return;
 if(draftGrid.seat+1<draftGrid.count){draftGrid.seat++;driverSelect();one('[data-pick-driver][aria-pressed="true"]').focus({preventScroll:true});return}
 seats=[...draftGrid.choices];driver=seats[0];updateDriver();startSelection();
}
function lockProgress(){return `Locked · ${championship.qualifyingWins()}/${cups.length} Hard cup wins`}
function garage(){
 window.KartViewer?.stop();
 const d=drivers[driver];
 main.innerHTML=`<div class="page-top"><div><h1>Driver garage</h1><p>Choose your racer for the next grid.</p></div><button class="action primary" data-page="hub">${icon('flag')}Race hub</button></div>
 <div class="garage-bench"><section id="kartViewer" aria-label="Inspect the ${d.kart} in 3D"></section><section class="driver-detail"><div><span class="label">${d.name}’s kart</span><h2>${d.kart}</h2><p>${d.description}</p><div class="ability">${icon('bolt')}${d.ability}</div><p>${d.abilityText}</p></div><div><span class="label">Handling</span>${['Agility','Acceleration','Stability'].map((v,i)=>`<div class="stat">${v}<span class="segments" aria-label="${d.stats[i]} out of five">${[1,2,3,4,5].map(j=>`<i class="${j<=d.stats[i]?'on':''}"></i>`).join('')}</span></div>`).join('')}</div></section></div>
 <div class="section-head"><span class="marks"></span><h2 class="sec-title">Select driver</h2></div>
 <section class="garage-grid" aria-label="Choose driver">${drivers.map((a,i)=>`<button class="driver-card ${i===driver?'active':''}" aria-pressed="${i===driver}" data-driver="${i}" ${driverAvailable(i)?'':'disabled title="Win all three cups on Hard or Ultimate"'}><span class="driver-img"><img src="art/driver-${i}.webp" alt="${a.name} the ${a.species.toLowerCase()}">${i===driver?`<span class="selected-icon">${icon('check')}</span>`:''}</span><span class="driver-copy"><strong>${a.name}</strong><small>${driverAvailable(i)?a.species+' · '+a.kart:lockProgress()}</small></span></button>`).join('')}</section>`;
 window.KartViewer?.mount(one('#kartViewer'),driver);
}
function recordKey(trackIndex,cc){return cc===100?String(trackIndex):cc+'-'+trackIndex}
function showRecords(){
 const rows=tracks.map((t,i)=>{
   const rec=records[recordKey(i,recordsClass)]||{};
   return `<div class="record-row"><img src="art/course-${i}.webp" alt=""><b>${t.name}</b><time>${time(rec.lap)}</time><time>${time(rec.trial)}</time></div>`;
 }).join('');
 main.innerHTML=`<div class="page-top"><div><h1>Track records</h1><p>Your fastest laps and Time Trials in each engine class.</p></div><button class="action primary" data-action="recordTrial">${icon('clock')}Time trial</button></div><div class="record-classes">${segments('Engine class','record-cc',engineChoices,recordsClass)}</div><section class="records" aria-label="${recordsClass} cc track records"><div class="record-row record-heading"><span>Track</span><span>Circuit</span><span>Best lap</span><span>3-lap trial</span></div>${rows}</section>`;
}
function closeModal(){capture='';modal=null;if(dialog.open)dialog.close();document.body.style.overflow=running?'hidden':''}
function modalView(kind,title,content){
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
function cupReward(){
 const unlocked=driverAvailable(championship.rewardDriver),count=championship.qualifyingWins();
 return `<div class="cup-reward"><img src="art/driver-${championship.rewardDriver}.webp" alt=""><div><strong>${rewardName()} · ${unlocked?'Unlocked':'Cup reward'}</strong><span>${unlocked?'Available in the driver garage.':`Win all three cups on Hard or Ultimate · ${count}/${cups.length}`}</span></div></div>`;
}
function setup(m=mode){mode=m;
 const cupMode=m==='cup',local=m==='local',saved=cupMode&&championship.activeRun(cupIndex);
 modalView('setup','Race setup',`${cupMode?'':summaryCard(track)}${segments('Race mode','mode',Object.entries(modeLabels),m)}
 ${cupMode?'':`<label class="field"><span>Circuit</span><select data-setup-track data-focus-id="setup-track">${tracks.map((t,i)=>`<option value="${i}" ${i===track?'selected':''}>${t.name}</option>`).join('')}</select></label>`}
 ${cupMode?cupSetup():''}
 ${raceRules(m)}
 ${local?segments('Local players','players',[[2,'2 players'],[3,'3 players'],[4,'4 players']],Math.max(2,players)):''}
 ${m==='race'||local?segments('Laps','laps',[[1,'1 lap'],[3,'3 laps'],[5,'5 laps']],laps):''}
 <p class="form-note">${({race:'Eight karts on the grid. Collect acorns and hold drift through corners to charge an exit boost.',trial:'Three laps, a clear track, and your personal-best ghost. Acorn items are disabled.',cup:'Four races, three laps each. The driver with the most points wins the cup.',local:'Player 1 can use the keyboard. Connect gamepads for additional drivers and press a button on each pad before the start.'})[m]}</p>
 ${cupMode?cupScoring()+cupReward():''}
 ${saved?`<div class="cup-resume"><div><strong>Continue ${cups[cupIndex].name}</strong><small>Race ${saved.rounds.length+1} of 4 · ${drivers[saved.driver].name} · ${saved.cc} cc · ${skillLabel(saved.difficulty)}</small></div><button type="button" class="action primary" data-action="resumeCup">Resume${icon('arrow')}</button></div>`:''}
 <div class="modal-bottom">${local?`<button class="action secondary" data-action="rooms">${icon('globe')}Private room</button>`:''}<button class="action ${saved?'secondary':'primary'}" data-action="go">${saved?'Start a new cup':local?'Choose drivers':'Choose driver'}${icon('arrow')}</button></div>`);
}
function settingsPanel(){modalView('settings','Settings',`<label class="settings-row">Game audio<input type="checkbox" class="switch" data-pref="sound" ${settings.sound?'checked':''}></label><label class="settings-row">Auto-accelerate<input type="checkbox" class="switch" data-pref="autoAccel" ${settings.autoAccel?'checked':''}></label><label class="settings-row">Stick dead zone <span><output id="dz">${Math.round(settings.deadzone*100)}%</output> <input type="range" min="0" max="75" value="${Math.round(settings.deadzone*100)}" data-pref="deadzone"></span></label><label class="settings-row">Controller prompts<select data-pref="padStyle" class="control"><option value="xbox" ${settings.padStyle==='xbox'?'selected':''}>Xbox</option><option value="ps" ${settings.padStyle==='ps'?'selected':''}>PlayStation</option></select></label>
 <div class="modal-bottom"><button class="action secondary" data-action="bindings">${icon('keyboard')}Controls</button><button class="action primary" data-action="close">Done</button></div>
 <p class="form-note"><a class="kit-link" href="assets/Acorn-Rally-Models.zip" download>${icon('download')}Download editable 3D models</a></p>`)}
function keyName(k){return (k||'').replace(/^Key/,'').replace(/^Digit/,'').replace(/^Arrow/,'Arrow ').replace(/Left$/,' Left').replace(/Right$/,' Right').trim()}
function controlsPanel(){modalView('bindings','Driving controls',`<div class="control-line label"><span>Action</span><span>Keyboard</span><span>${settings.padStyle==='ps'?'PlayStation':'Xbox'}</span></div>${Object.entries(keys).map(([k,l],i)=>`<div class="control-line"><span>${l}</span><span><button data-bind="${k}" data-focus-id="bind-${k}" class="binding ${k===capture?'capture':''}">${k===capture?'Press a key…':keyName(settings.bindings[k])}</button></span><span>${padLabels[settings.padStyle][i]}</span></div>`).join('')}<div class="control-line"><span>Pause</span><span><kbd>Esc</kbd></span><span>${settings.padStyle==='ps'?'Options':'Menu'}</span></div><p class="form-note">Select a keyboard binding to change it. Arrow keys also steer, accelerate, and brake.</p><div class="modal-bottom"><button class="action secondary" data-action="resetKeys">Reset keys</button><button class="action primary" data-action="close">Done</button></div>`)}
function openRooms(){
 if(!window.RallyRooms){notice('Private rooms could not load. Refresh to try again.');return}
 modal='rooms';dc.replaceChildren();if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden';
 window.RallyRooms.open({container:dc,trackIndex:track,driverIndex:driver,cc:engineClass,difficulty:cpuLevel,settings,startRace:o=>{roomSession=o.network;launch({...o,mode:'race'})},onClose:()=>{roomSession=null;closeModal()}});
}
function itemGuide(){modalView('items','Acorn items',`<p class="form-note">Leaders draw tactical items. The farther you fall behind the leader, the more likely you are to draw a catch-up boost.</p>`+window.AcornSim.items.map((name,i)=>`<div class="item-guide-row"><img src="art/item-${i}.webp" alt=""><div><small class="item-role">${window.AcornFeedback.roles[i]}</small><b style="color:${window.AcornItemArt.colors[i]}">${name}</b><p>${window.AcornItemArt.descriptions[i]}</p></div></div>`).join('')+'<div class="modal-bottom"><button class="action primary" data-action="close">Done</button></div>')}
function startSelection(){
 roomSession=null;
 if(mode==='cup'){
   cup=championship.start(cupIndex,driver,engineClass,cpuLevel);
   nextCupRace();
   return;
 }
 cup=null;
 launch({trackIndex:track,cc:engineClass,difficulty:cpuLevel,driverIndex:driver,driverIndices:seats.slice(),mode:mode==='local'?'race':mode,players:mode==='local'?Math.max(2,players):1,laps:mode==='trial'?3:laps});
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
 if(!options.network&&!driverAvailable(options.driverIndex)){notice('Win all three cups on Hard or Ultimate to unlock this driver.');return}
 lastRun=options;running=true;closeModal();race.hidden=false;app.inert=true;document.body.style.overflow='hidden';
 race.innerHTML=`<div class="grid-loading" style="background-image:linear-gradient(0deg,#121712ec,#12171233),url(art/course-${options.trackIndex}.webp)"><div><span class="hero-kicker eyebrow"><span class="checker"></span>${options.cupRoundLabel||'Preparing starting grid'}</span><h2>${tracks[options.trackIndex].name}</h2><div class="load-progress"></div></div></div>`;
 try{await window.KartViewer.loadModels();race.replaceChildren();window.AcornRace.start({...options,container:race,settings:{...settings,bindings:{...settings.bindings}},onExit:leaveRace,onFinish:finish})}catch(err){console.error(err);leaveRace();notice('The race could not start. Refresh the game and try again.')}
}
function detachRace(){running=false;window.AcornRace?.stop();race.hidden=true;app.inert=false;document.body.style.overflow=''}
function returnRoom(){const net=roomSession;roomSession=null;closeModal();modal='rooms';net.returnToLobby();document.body.style.overflow='hidden'}
function leaveRace(){detachRace();if(roomSession){returnRoom();return}const pausedCup=cup;cup=null;nav('hub');if(pausedCup)notice(`${cups[pausedCup.index].name} saved · Resume race ${pausedCup.rounds.length+1} in Cup series`)}
function updateResults(r){const idx=recordKey(r.trackIndex??lastRun.trackIndex,simulation.normalizeCC(r.cc??lastRun.cc)),rec=records[idx]||{};if(r.bestLap>0&&(!rec.lap||r.bestLap<rec.lap))rec.lap=r.bestLap;if(lastRun.mode==='trial'&&lastRun.laps===3&&r.time>0&&(!rec.trial||r.time<rec.trial))rec.trial=r.time;records[idx]=rec;write('records',records)}
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
 modalView('results',title,`<div class="result-podium"><img src="art/driver-${cup.driver}.webp" alt=""><div><strong>${podium}</strong><span>${subhead}</span></div></div>
 <div class="result-stats"><div><small>Race time</small><b>${time(result.time)}</b></div><div><small>Best lap</small><b>${time(result.bestLap)}</b></div><div><small>Your points</small><b>${player.total}</b></div></div>
 <table class="cup-table"><caption>${round.complete?'Final standings':'Cup standings'}</caption><thead><tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Race ${number}</th><th scope="col">Points</th></tr></thead><tbody>${board.map((s,i)=>`<tr class="${s.driver===cup.driver?'human':''}"><td>${i+1}</td><th scope="row">${drivers[s.driver].name}${s.driver===cup.driver?' · You':''}</th><td>${ordinal(s.last)} <small>+${championship.points[s.last-1]}</small></td><td><b>${s.total}</b></td></tr>`).join('')}</tbody></table>
 ${round.unlocked?`<div class="cup-unlocked" role="status"><img src="art/driver-${championship.rewardDriver}.webp" alt=""><div><small>Driver unlocked</small><strong>${rewardName()}</strong><span>${drivers[championship.rewardDriver].kart} · Available in the garage</span></div></div>`:round.complete?cupReward():''}
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
 const next=roomSession?'Room lobby':'Race again';
 modalView('results',title,`<div class="result-podium"><img src="art/driver-${r.driverIndex??driver}.webp" alt=""><div><strong>${lastRun.mode==='trial'?'Finish':ordinal(r.position||1)+' place'}</strong><span>${d.name} · ${tracks[idx].name} · ${simulation.normalizeCC(r.cc??lastRun.cc)} cc</span></div></div><div class="result-stats"><div><small>Race time</small><b>${time(r.time)}</b></div><div><small>Best lap</small><b>${time(r.bestLap)}</b></div></div>
 ${board.map(s=>`<div class="finish-row ${s.human?'human':''}"><span>${pad2(s.position)}</span><b>${safeName(s.name)}</b><span>${time(s.time)}</span></div>`).join('')}
 <div class="modal-bottom"><button class="action secondary" data-action="resultHub">Race hub</button><button class="action primary" data-action="rematch">${next}${icon('arrow')}</button></div>`);
}
function rematch(){
 if(roomSession){returnRoom();return}
 if(!cup){beginDriverSelect(mode);return}
 if(cup.rounds.length<cups[cup.index].tracks.length){nextCupRace();return}
 cup=null;closeModal();nav('hub');setup('cup');
}
function resultHub(){roomSession?.leave();roomSession=null;cup=null;closeModal();nav('hub')}
function closeAction(){if(modal==='results'){resultHub();return}if(modal==='rooms'){dc.querySelector('[data-rr="close"]')?.click();return}closeModal()}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.page){if(b.dataset.page==='records')recordsClass=engineClass;nav(b.dataset.page);return}
 if(b.dataset.engine){engineClass=simulation.normalizeCC(b.dataset.engine);refreshRuleControls('engine-'+engineClass);return}
 if(b.dataset.skill){cpuLevel=simulation.normalizeDifficulty(b.dataset.skill);refreshRuleControls('skill-'+cpuLevel);return}
 if(b.dataset.recordCc){recordsClass=simulation.normalizeCC(b.dataset.recordCc);showRecords();one(`[data-record-cc="${recordsClass}"]`)?.focus({preventScroll:true});return}
 if(b.hasAttribute('data-track')){chooseTrack(+b.dataset.track);return}
 if(b.hasAttribute('data-pick-driver')){pickGridDriver(+b.dataset.pickDriver);return}
 if(b.hasAttribute('data-driver')){if(!driverAvailable(+b.dataset.driver))return;driver=+b.dataset.driver;updateDriver();garage();one(`[data-driver="${driver}"]`).focus({preventScroll:true});return}
 if(b.dataset.setup){setup(b.dataset.setup);return}
 if(b.dataset.mode){setup(b.dataset.mode);return}
 if(b.hasAttribute('data-cup')){cupIndex=+b.dataset.cup;setup();return}
 if(b.dataset.players){players=+b.dataset.players;setup();return}
 if(b.dataset.laps){laps=+b.dataset.laps;if(page==='hub')one('.hero').innerHTML=hero();setup();return}
 if(b.dataset.bind){capture=b.dataset.bind;controlsPanel();return}
 ({recordTrial:()=>{engineClass=recordsClass;saveRaceRules();setup('trial')},start:()=>beginDriverSelect('race'),setup:()=>setup(),go:()=>beginDriverSelect(mode,true),selectBack:driverSelectBack,confirmDriver:confirmGridDriver,prev:()=>shiftShelf(-1),next:()=>shiftShelf(1),close:closeAction,bindings:controlsPanel,rooms:openRooms,resetKeys:()=>{capture='';settings.bindings={...defaults.bindings};pref();controlsPanel()},rematch,resultHub,resumeCup})[b.dataset.action]?.();
});
document.addEventListener('change',e=>{const a=e.target;if(a.hasAttribute('data-setup-track')){track=+a.value;if(page==='hub')hub();setup(mode);return}if(a.dataset.pref){const p=a.dataset.pref;settings[p]=p==='deadzone'?+a.value/100:a.type==='checkbox'?a.checked:a.value;pref()}});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&page==='select'&&!dialog.open&&!running){e.preventDefault();driverSelectBack()}});
document.addEventListener('input',e=>{if(e.target.dataset.pref==='deadzone')one('#dz').textContent=e.target.value+'%'});
document.addEventListener('keydown',e=>{if(!capture)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){capture='';controlsPanel();return}if(['Tab','Enter','F5','MetaLeft','MetaRight'].includes(e.code))return;const prior=Object.keys(settings.bindings).find(k=>settings.bindings[k]===e.code);if(prior)settings.bindings[prior]=settings.bindings[capture];settings.bindings[capture]=e.code;capture='';pref();controlsPanel()},true);
dialog.addEventListener('cancel',e=>{e.preventDefault();if(modal!=='rooms')closeAction()});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeAction()}});
one('#settingsBtn').onclick=settingsPanel;one('#guideBtn').onclick=controlsPanel;one('#itemGuideBtn').onclick=itemGuide;one('#soundBtn').onclick=()=>{settings.sound=!settings.sound;pref();notice(settings.sound?'Sound on':'Sound muted')};
window.addEventListener('resize',arrowState);
let previousPads=[],nextMove=0;
function menuGamepad(ts){
 const pads=Array.from(navigator.getGamepads?.()||[]);let seen=[];
 pads.forEach((p,i)=>{if(!p)return;const b=p.buttons.map(v=>v.pressed),last=previousPads[i]||[];seen[i]=b;
 if(running||(!b.some(Boolean)&&!p.axes.some(v=>Math.abs(v)>.65)))return;
 let active=document.activeElement;const root=dialog.open?dialog:app;
 const candidates=Array.from(root.querySelectorAll('button:not(:disabled),a[href],select,input')).filter(e=>e.getClientRects().length);
 if(!candidates.includes(active)){active=candidates[0];active?.focus({preventScroll:true})}
 if(b[1]&&!last[1]&&dialog.open){closeAction();return}
 if(b[1]&&!last[1]&&page==='select'){driverSelectBack();return}
 if(b[0]&&!last[0]&&active){if(active.tagName==='SELECT'){const choices=Array.from(active.options).filter(o=>!o.disabled);if(choices.length){const i=choices.indexOf(active.selectedOptions[0]);active.value=choices[(i+1)%choices.length].value;active.dispatchEvent(new Event('change',{bubbles:true}))}}else active.click();return}
 if(!active||ts<nextMove)return;
 const dx=b[15]||p.axes[0]>.65?1:b[14]||p.axes[0]<-.65?-1:0,dy=b[13]||p.axes[1]>.65?1:b[12]||p.axes[1]<-.65?-1:0;
 if(!dx&&!dy)return;nextMove=ts+200;
 if(active.matches('input[type=range]')&&dx){active.value=String(Math.min(+active.max,Math.max(+active.min,+active.value+dx*5)));active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));return}
 const rect=active.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 let winner=null,score=Infinity;
 for(const c of candidates){if(c===active)continue;const cr=c.getBoundingClientRect(),cx=cr.left+cr.width/2-x,cy=cr.top+cr.height/2-y;const forward=dx?cx*dx:cy*dy,lateral=Math.abs(dx?cy:cx);if(forward<3)continue;const val=forward+lateral*3.5;if(val<score){winner=c;score=val}}
 if(winner){winner.focus({preventScroll:true});winner.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})}
 });previousPads=seen;requestAnimationFrame(menuGamepad)
}
hydrateIcons();soundIcon();updateDriver();if(location.hash==='#garage')nav('garage');else if(location.hash==='#records')nav('records');else hub();requestAnimationFrame(menuGamepad);
if(new URLSearchParams(location.search).has('room'))openRooms();
