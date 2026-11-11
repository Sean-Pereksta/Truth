import { Game, UNIT_DEFS, BUILDING_DEFS, DIFFICULTIES, TEAM_DEFS, PAC_TEAMS } from './engine.js';
import { AIController } from './ai.js';
import { Renderer } from './render.js';

const $=id=>document.getElementById(id);
const rows={hero:0,miner:1,guardian:2,engineer:3,extractor:3,hunter:4,scout:5,binder:6,brute:7};
const buildingFrames={nest:0,refuge:1,tower:2,well:3,lair:4,watch:5,spike:6};
const other=side=>side==='pac'?'ghost':'pac';
const clock=t=>{const n=Math.floor(t||0);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
const settings={side:'pac',teamId:'pac',difficulty:'normal',map:'catacombs',seed:1975,sound:false};
try{Object.assign(settings,JSON.parse(localStorage.getItem('blackout-settings')||'{}'));}catch{}
if(!['pac','ghost'].includes(settings.side))settings.side='pac';
if(!PAC_TEAMS.includes(settings.teamId))settings.teamId='pac';
if(!DIFFICULTIES[settings.difficulty])settings.difficulty='normal';
if(!['catacombs','ruins','crossroads'].includes(settings.map))settings.map='catacombs';
settings.seed=Math.max(1,Number(settings.seed)||1975);
let game,ai,renderer,started=false,ended=false,selected=new Set(),productionTab='troops',buildType=null,orderMode=null;
let pointer=null,drag=null,mouseWorld=null,mouseCanvas=null,panPointer=null,toastTimer=null,lastSoundPellets=0,audio=null,uiTime=0,previousHp=null;
let menuWasPaused=false,helpWasPaused=false,speed=1,accumulator=0;
const keys=new Set(),coarse=matchMedia('(pointer:coarse)').matches;
const canvas=$('game-canvas'),minimap=$('minimap');
const trainingQueueNodes=new Map();
const rosterNodes=new Map();
let trainingQueueGame=null,trainingQueueCount=-1,playerWasEliminated=false;

function saveSettings(){try{localStorage.setItem('blackout-settings',JSON.stringify(settings));}catch{}}
function spritePosition(type){return '0 '+((rows[type]??0)/7*100)+'%';}
function buildingPosition(type){const n=buildingFrames[type]??7;return (n%4/3*100)+'% '+(Math.floor(n/4)*100)+'%';}
function ownUnits(){return game.units.filter(u=>u.teamId===game.playerTeam&&u.hp>0);}
function selectedUnits(){return ownUnits().filter(u=>selected.has(u.id));}
function selectedBuilding(){return game.buildings.find(b=>selected.has(b.id)&&b.teamId===game.playerTeam&&b.hp>0);}
function playerEliminated(){return !!game.teams[game.playerTeam]?.eliminated;}
function difficultyLabel(key){return key==='normal'?'Medium':DIFFICULTIES[key]?.label||key;}
function toast(text,error=false){
  $('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,error?3500:4200);
}
function tone(frequency=400,duration=.045,volume=.025,type='sine'){
  if(!settings.sound)return;
  try{
    audio??=new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=frequency;
    g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.01);
  }catch{}
}
// FULLSCREEN CONTROL START — keeps native fullscreen state separate from match state.
let fullscreenBusy=false,fullscreenFeedbackTimer=null;
const fullscreenButtons=[$('fullscreen-btn'),$('setup-fullscreen-btn')];
function fullscreenActive(){return !!document.fullscreenElement;}
function syncFullscreenControls(){
  const active=fullscreenActive(),label=active?'Exit fullscreen':'Enter fullscreen';
  for(const button of fullscreenButtons){
    button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',label);button.title=label+' (F10)';
    const glyph=button.querySelector('.fullscreen-glyph');if(glyph)glyph.textContent='⛶';
    const text=button.querySelector('.fullscreen-label');if(text)text.textContent=active?'Exit fullscreen':'Fullscreen';
  }
  renderer?.resize();requestAnimationFrame(()=>renderer?.resize());
}
function fullscreenFeedback(message,error=false){
  const feedback=$('fullscreen-feedback');feedback.textContent=message;feedback.classList.toggle('error',error);feedback.hidden=false;
  clearTimeout(fullscreenFeedbackTimer);fullscreenFeedbackTimer=setTimeout(()=>feedback.hidden=true,error?8000:3000);
}
async function toggleFullscreen(){
  if(fullscreenBusy)return;
  fullscreenBusy=true;keys.clear();mouseCanvas=null;
  try{
    if(fullscreenActive()){
      if(typeof document.exitFullscreen!=='function')throw new Error('Fullscreen unavailable');
      await document.exitFullscreen();
    }else{
      if(typeof document.documentElement.requestFullscreen!=='function'||document.fullscreenEnabled===false)throw new Error('Fullscreen unavailable');
      await document.documentElement.requestFullscreen();
    }
    $('fullscreen-feedback').hidden=true;
  }catch{
    fullscreenFeedback('Fullscreen is unavailable in this preview. Open pacman-blackout.html in your browser, then use Fullscreen or F11.',true);
  }finally{fullscreenBusy=false;syncFullscreenControls();}
}
for(const button of fullscreenButtons)button.addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange',syncFullscreenControls);
document.addEventListener('keydown',e=>{
  if(e.key==='F10'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleFullscreen();}
  else if(e.key==='Escape'&&fullscreenActive()){e.preventDefault();e.stopImmediatePropagation();toggleFullscreen();}
},true);
syncFullscreenControls();
// FULLSCREEN CONTROL END

function captureSetupChoices(){
  const map=$('map-select').value;if(['catacombs','ruins','crossroads'].includes(map))settings.map=map;
  const text=String($('seed-input').value).trim(),seed=Number(text);
  if(text!==''&&Number.isFinite(seed))settings.seed=Math.max(1,Math.min(999999999,Math.floor(seed)));
}
function refreshSetup({preserveInputs=false}={}){
  $('app').classList.toggle('ghost-theme',settings.side==='ghost');
  $('app').dataset.team=settings.side==='ghost'?'ghost':settings.teamId;
  $('app').style.setProperty('--team',TEAM_DEFS[settings.side==='ghost'?'ghost':settings.teamId].color);
  document.querySelectorAll('[data-side]').forEach(b=>{const active=b.dataset.side===settings.side;b.classList.toggle('chosen',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-team]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.team===settings.teamId)));
  document.querySelectorAll('[data-difficulty]').forEach(b=>{const active=b.dataset.difficulty===settings.difficulty;b.classList.toggle('chosen',active);b.setAttribute('aria-pressed',String(active));});
  if(!preserveInputs){$('map-select').value=settings.map;$('seed-input').value=settings.seed;}
  const matchup=DIFFICULTIES[settings.difficulty];
  $('difficulty-name').textContent=difficultyLabel(settings.difficulty).toUpperCase();
  $('difficulty-description').textContent=settings.side==='pac'?'Your AI partners: '+difficultyLabel(matchup.allyDifficulty||'normal')+' · Enemy Ghosts: '+difficultyLabel(matchup.enemyDifficulty||settings.difficulty):'All three enemy Pac teams: '+difficultyLabel(matchup.enemyDifficulty||settings.difficulty)+' AI. You command the entire Ghost Legion.';
  $('pac-team-choices').hidden=settings.side==='ghost';
  $('matchup-summary').textContent=settings.side==='pac'?'You + 2 AI partners vs 1 Ghost Legion':'Your Ghost Legion vs 3 allied AI Pac teams';
  $('faction-brief').textContent=settings.side==='pac'?'Settle the wide outer lands with two AI partners. Share vision and pellet progress; each team owns its army and Spark. Clear every pellet or destroy the Citadel. Ghosts must catch all three commanders.':'Command a stronger legion. Cast Binder traps and collect generous Dread bounties from battle. Defend your regenerating Citadel and eliminate all three Pac-Men to win.';
  $('art-faction-name').textContent=settings.side==='pac'?'PAC ALLIANCE':'GHOST LEGION';
  $('art-faction-tagline').textContent=settings.side==='pac'?'Outrun the dark.':'The hunt begins.';
  $('art-bottom-left').textContent=settings.side==='pac'?'THREE TEAMS.':'BUILD THE HUNT.';
  $('art-bottom-right').textContent=settings.side==='pac'?'EVERY PELLET.':'CONTROL THE DARK.';
  $('sound-btn').setAttribute('aria-pressed',String(!!settings.sound));$('sound-btn').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound');$('sound-btn').style.color=settings.sound?'var(--teal)':'';
}
function configureFaction(){
  const pac=game.side==='pac';$('app').classList.toggle('ghost-theme',!pac);
  $('app').dataset.team=game.playerTeam;
  $('app').style.setProperty('--team',game.teams[game.playerTeam].color);
  $('faction-label').textContent=game.teams[game.playerTeam].name;
  $('objective-text').textContent=pac?'Work with your partners. Eat every pellet or destroy the Citadel.':'Eliminate all three Pac-Men. Protect your Citadel.';
  $('resource-label').textContent=pac?'SPARK':'DREAD';$('production-note').textContent=pac?'SPARK':'DREAD';
  $('harvest-order').hidden=!pac;$('snare-order').hidden=pac;$('power-panel').hidden=!pac;
  $('quick-power').hidden=!pac;$('quick-hero-name').textContent=pac?'PAC TEAM '+(PAC_TEAMS.indexOf(game.playerTeam)+1):'PAC-MEN LEFT';
  $('hero-title').textContent=pac?'YOUR COMMANDER':'PRIORITY TARGET';
  $('hero-status-note').textContent=pac?'One life per commander. If you fall, surviving partners can still win.':'Eliminate all three Pac-Men. Pellets reveal nearby targets only.';
  $('map-label').textContent=game.map.name.toUpperCase();$('difficulty-tag').textContent=difficultyLabel(game.difficulty).toUpperCase();
  $('focus-btn').innerHTML=(pac?'Pac-Man':'Army')+' <kbd>F</kbd>';
}
function makeGame(){
  game=new Game(settings);
  const matchup=DIFFICULTIES[game.difficulty];
  ai=Object.values(game.teams).filter(team=>team.id!==game.playerTeam).map(team=>new AIController(game,team.id,team.side===game.side?(matchup.allyDifficulty||'normal'):(matchup.enemyDifficulty||game.difficulty)));
  if(renderer)renderer.setGame(game);else renderer=new Renderer(canvas,game,{zoom:.9});
  game.paused=true;configureFaction();
  selected=new Set(game.side==='pac'?[game.getHero()?.id].filter(Boolean):ownUnits().filter(u=>u.type==='hunter').map(u=>u.id));
  lastSoundPellets=0;previousHp=game.getHero()?.hp??0;updateHUD.lastDanger=0;buildType=null;orderMode=null;drag=null;mouseWorld=null;ended=false;accumulator=0;playerWasEliminated=false;
  renderTeamRoster();renderProduction();updateHUD();updateSelection();focusArmy();
}
function startGame(){
  if(startGame.busy)return;
  startGame.busy=true;$('launch-btn').disabled=true;$('rematch-btn').disabled=true;
  try{
    captureSetupChoices();$('seed-input').value=settings.seed;saveSettings();
    if(game)game.paused=true;
    keys.clear();cancelMode();panPointer=null;mouseCanvas=null;mouseWorld=null;pointer=null;drag=null;
    productionTab='troops';speed=1;accumulator=0;uiTime=0;menuWasPaused=false;helpWasPaused=false;
    $('setup-screen').hidden=true;$('result-screen').hidden=true;$('help-screen').hidden=true;$('pause-label').hidden=true;
    $('fullscreen-feedback').hidden=true;clearTimeout(toastTimer);$('toast').hidden=true;
    started=true;ended=false;makeGame();game.paused=false;
    frame.last=performance.now();$('speed-btn').textContent='1×';$('setup-close').hidden=false;
    renderProduction();updateHUD();updateSelection();
    toast(game.side==='pac'?'You command Pac Team '+(PAC_TEAMS.indexOf(game.playerTeam)+1)+'. Your two AI partners share vision and pellet progress.':'Hunt all three Pac commanders. Battle kills earn Dread. Binders trap escaping enemies.');
    tone(game.side==='pac'?620:270,.16,.04,'triangle');
  }catch(error){
    started=false;ended=false;if(game)game.paused=true;
    $('result-screen').hidden=true;$('help-screen').hidden=true;$('pause-label').hidden=true;$('setup-screen').hidden=false;$('setup-close').hidden=true;
    $('loading-status').textContent='This match could not start. Try another maze seed or reopen the local game file.';
    console.error('Unable to start a new match.',error);
  }finally{startGame.busy=false;$('launch-btn').disabled=false;$('rematch-btn').disabled=false;}
}
function openMenu(){
  const alreadyOpen=!$('setup-screen').hidden;
  $('result-screen').hidden=true;$('help-screen').hidden=true;$('pause-label').hidden=true;
  if(!alreadyOpen)menuWasPaused=!!game?.paused;
  if(game)game.paused=true;keys.clear();cancelMode();panPointer=null;mouseCanvas=null;
  if(!alreadyOpen)refreshSetup();$('setup-screen').hidden=false;$('setup-close').hidden=!started||ended;
  $('launch-btn').querySelector('span').textContent=started?'START NEW MATCH':'ENTER THE MAZE';
}
function closeMenu(){
  if(!started||ended)return;
  settings.side=game.side;settings.difficulty=game.difficulty;settings.map=game.map.kind;settings.seed=game.seed;
  if(game.side==='pac')settings.teamId=game.playerTeam;
  $('setup-screen').hidden=true;configureFaction();game.paused=menuWasPaused;updateHUD();
}
function openHelp(){
  helpWasPaused=game.paused;game.paused=true;keys.clear();$('help-screen').hidden=false;
}
function closeHelp(){
  $('help-screen').hidden=true;if(started&&$('setup-screen').hidden&&!ended)game.paused=helpWasPaused;updateHUD();
}
function setPaused(value){
  if(!started||ended||!$('setup-screen').hidden||!$('help-screen').hidden)return;
  game.paused=value;keys.clear();updateHUD();
}
function cancelMode(){buildType=null;orderMode=null;drag=null;pointer=null;$('placement-note').hidden=true;canvas.style.cursor='default';document.querySelectorAll('[data-order]').forEach(b=>b.classList.remove('active'));}
function setOrderMode(type){
  if(!selectedUnits().length){toast('Select one or more of your units first.',true);return;}
  if(type==='snare'&&!selectedUnits().some(u=>u.type==='binder')){toast('Select at least one Binder to cast a snare.',true);return;}
  if(type==='stop'){game.command([...selected],'stop');cancelMode();tone(170);return;}
  cancelMode();orderMode=type;canvas.style.cursor='crosshair';
  const names={move:'Move',attack:'Attack or advance',harvest:'Harvest and sweep nearby pellets',snare:'Binder snare — choose the ground (1.25s cast)'};
  $('placement-note').textContent=names[type]+' · Choose a destination · Esc cancels';$('placement-note').hidden=false;
  document.querySelector('[data-order="'+type+'"]')?.classList.add('active');
}
function attackNearest(){
  const troops=selectedUnits();
  if(!troops.length){toast('Select your troops first.',true);return;}
  if(game.paused){toast('Resume the match to attack.',true);return;}
  const enemies=[...game.units,...game.buildings].filter(u=>u.hp>0&&u.side!==game.side&&game.isVisible(game.side,u.x,u.y));
  if(!enemies.length){setOrderMode('attack');toast('No visible enemies. Click a destination to advance.');return;}
  cancelMode();
  for(const troop of troops){
    const target=enemies.reduce((best,u)=>Math.hypot(u.x-troop.x,u.y-troop.y)<Math.hypot(best.x-troop.x,best.y-troop.y)?u:best,enemies[0]);
    game.command([troop.id],'attack',target.x,target.y,target.id);
  }
  tone(210,.06,.025);toast('ATTACK · Each troop is engaging its nearest visible enemy.');updateSelection();
}
function beginConstruction(type){
  const def=BUILDING_DEFS[type];if(!def||!started||ended)return;
  if(playerEliminated()){toast('Your commander has fallen. Your partners are still fighting.',true);return;}
  if(game.resources[game.playerTeam]<def.cost){toast('Not enough '+(game.side==='pac'?'Spark':'Dread')+' to build '+def.name+'.',true);return;}
  productionTab='buildings';cancelMode();buildType=type;renderProduction();canvas.style.cursor='crosshair';
  $('placement-note').textContent='Place '+def.name+' · '+def.w+'×'+def.h+' clear ground · Esc cancels';$('placement-note').hidden=false;
}
function summonTroop(type){
  const def=UNIT_DEFS[type];if(!def||!started||ended)return;
  if(playerEliminated()){toast('Your commander has fallen. Your partners are still fighting.',true);return;}
  if(game.paused){toast('Resume the match to summon units.',true);return;}
  if(game.train(type,selectedBuilding()?.id)){tone(480,.05);toast(def.name+' queued. New troops wait at their production building.');}
  else toast('Need resources, a completed production building, and room in your army.',true);
  updateHUD();updateSelection();
}
function focusArmy(){
  if(game.side==='pac'){
    const hero=game.getHero();if(hero){renderer.centerOn(hero.x,hero.y);selected=new Set([hero.id]);}
    else{const survivor=game.getHeroes()[0];if(survivor){selected.clear();renderer.centerOn(survivor.x,survivor.y);}}
  }else{
    const units=selectedUnits().length?selectedUnits():ownUnits();if(units.length)renderer.centerOn(units.reduce((s,u)=>s+u.x,0)/units.length,units.reduce((s,u)=>s+u.y,0)/units.length);
    else {const b=game.buildings.find(b=>b.teamId===game.playerTeam);if(b)renderer.centerOn(b.x,b.y);}
  }
  updateSelection();
}
function activatePower(){
  if(game.side!=='pac'||playerEliminated())return;
  const candidate=selectedUnits().find(u=>u.type==='hero')||selectedUnits()[0]||game.getHero();
  if(game.activatePower(candidate?.id)){tone(190,.24,.06,'sawtooth');toast('POWER ACTIVE · Nearby allies empowered for 9 seconds.');}
  else toast(game.powerCooldown>0?'Power recharging: '+Math.ceil(game.powerCooldown)+'s.':'No Power charge. Find a large pellet or build a Digestor.',true);
  updateHUD();
}
function renderProduction(){
  const grid=$('production-grid');grid.replaceChildren();
  const definitions=productionTab==='troops'?UNIT_DEFS:BUILDING_DEFS;
  $('troops-tab').classList.toggle('active',productionTab==='troops');$('buildings-tab').classList.toggle('active',productionTab==='buildings');
  $('troops-tab').setAttribute('aria-selected',String(productionTab==='troops'));$('buildings-tab').setAttribute('aria-selected',String(productionTab==='buildings'));
  grid.setAttribute('aria-labelledby',productionTab==='troops'?'troops-tab':'buildings-tab');
  for(const [type,def]of Object.entries(definitions)){
    if(def.side!==game.side||type==='hero')continue;
    // Four choices remain readable; the second Pac structure row fits into the same grid.
    const constructionKey=Object.keys(definitions).filter(k=>definitions[k].side===game.side&&k!=='hero').indexOf(type)+1;
    const b=document.createElement('button');b.className='production-card';b.dataset.type=type;b.title=def.name+' — '+def.description+' Cost: '+def.cost+(productionTab==='troops'?' · '+def.trainTime+'s training. T then '+constructionKey:' · '+def.w+'×'+def.h+' ground. B then '+constructionKey+' / Shift+'+constructionKey);b.dataset.constructionKey=String(constructionKey);
    b.setAttribute('aria-label',(productionTab==='troops'?'Summon ':'Build ')+def.name+', '+def.cost+' '+(game.side==='pac'?'Spark':'Dread')+'. '+def.description);
    const art=document.createElement('span');art.className=productionTab==='troops'?'unit-art':'building-art';art.style.backgroundPosition=productionTab==='troops'?spritePosition(type):buildingPosition(type);art.setAttribute('aria-hidden','true');b.append(art);
    const hotkey=document.createElement('kbd');hotkey.className='construction-key';hotkey.textContent=String(constructionKey);b.append(hotkey);
    const name=document.createElement('strong');name.textContent=def.name;b.append(name);
    const cost=document.createElement('small');cost.textContent='◇ '+def.cost;b.append(cost);
    b.addEventListener('click',()=>{
      if(!started||ended)return;
      if(productionTab==='troops'){
        summonTroop(type);
      }else{
        beginConstruction(type);
      }
    });grid.append(b);
  }
}
function updateSelection(){
  const selectedEntities=[...game.units,...game.buildings].filter(u=>u.teamId===game.playerTeam&&selected.has(u.id)&&u.hp>0);
  const first=selectedEntities[0],isBuilding=first&&!!BUILDING_DEFS[first.type];
  const portrait=$('selection-portrait');portrait.style.backgroundImage=first?'url("assets/'+(isBuilding?'buildings':'units')+'.png")':'none';portrait.style.backgroundPosition=isBuilding?buildingPosition(first.type):spritePosition(first?.type);portrait.style.backgroundSize=isBuilding?'400% 200%':'800% 800%';
  portrait.dataset.type=first?.type||'';
  const baseDef=first?(UNIT_DEFS[first.type]||BUILDING_DEFS[first.type]):null;
  const def=first?.isHQ?{...baseDef,name:'Ghost Citadel',description:'Your headquarters. 20,000 health. Regenerates after damage stops. Its destruction gives Pac the victory.'}:baseDef;
  portrait.title=def?.description||'';
  $('selection-category').textContent=selectedEntities.length>1?'SELECTED FORCE':isBuilding?'STRUCTURE':first?.type==='hero'?'COMMANDER':'UNIT';
  $('selection-title').textContent=selectedEntities.length>1?selectedEntities.length+' units selected':def?.name||(playerEliminated()?'Spectating allies':'No selection');
  $('selection-description').textContent=selectedEntities.length>1?'Right click to move, attack, or harvest as a group.':def?.description||'Left click a friendly unit or drag a selection box.';
  const details=$('selection-details');details.replaceChildren();
  if(first){
    const hp=document.createElement('span');hp.textContent='HP '+Math.ceil(first.hp)+' / '+first.maxHp;details.append(hp);
    if(isBuilding){
      const status=document.createElement('span');status.textContent=first.progress<1?'BUILDING '+Math.floor(first.progress*100)+'%':'OPERATIONAL';details.append(status);
      if(first.queue?.length){const q=document.createElement('span');q.textContent='QUEUE '+first.queue.length+' · '+UNIT_DEFS[first.queue[0].type].name+' '+Math.ceil(first.queue[0].remaining)+'s';details.append(q);}
      if(first.type==='well'){const t=document.createElement('span');t.textContent='FORGE '+Math.floor((first.forge||0)/50*100)+'%';details.append(t);}
      if(first.isHQ){const t=document.createElement('span');t.textContent=game.time-(first._lastHit??-100)>=8&&first.hp<first.maxHp?'REGENERATING':'HEADQUARTERS';details.append(t);}
    }else{
      const action=document.createElement('span');let text=first.order?.type?.toUpperCase()||'IDLE';
      if(first.order?.type==='harvest'&&first.order.duration&&first.order.progress>0)text='MINING '+Math.min(100,Math.floor(first.order.progress/first.order.duration*100))+'%';
      if(first.powered>0)text='POWER '+Math.ceil(first.powered)+'s';action.textContent=text;details.append(action);
      if(first.cast)action.textContent='CASTING '+Math.max(0,first.cast.remaining).toFixed(1)+'s';
      else if(first.rooted>0)action.textContent='TRAPPED '+first.rooted.toFixed(1)+'s';
    }
  }
  const units=$('selection-units');units.replaceChildren();
  if(selectedEntities.length>1)for(const u of selectedEntities.slice(0,12)){
    if(!UNIT_DEFS[u.type])continue;const b=document.createElement('button');b.className='mini-unit';b.style.backgroundPosition=spritePosition(u.type);b.title=UNIT_DEFS[u.type].name+' · '+Math.ceil(u.hp)+' HP';b.setAttribute('aria-label','Select '+UNIT_DEFS[u.type].name);b.addEventListener('click',()=>{selected=new Set([u.id]);renderer.centerOn(u.x,u.y);updateSelection();});units.append(b);
  }
  $('order-hint').textContent=selectedUnits().length?selectedUnits().length+' SELECTED':'SELECT A UNIT';
  document.querySelectorAll('[data-order]').forEach(b=>b.disabled=!selectedUnits().length);
  $('snare-order').disabled=!selectedUnits().some(u=>u.type==='binder');
}
function renderTeamRoster(){
  const roster=$('team-roster');roster.replaceChildren();rosterNodes.clear();
  for(const team of Object.values(game.teams)){
    const button=document.createElement('button');button.type='button';button.className='team-chip'+(team.id===game.playerTeam?' is-player':'')+(team.side==='ghost'?' is-ghost':'');button.style.setProperty('--owner-color',team.color);
    const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');const label=document.createElement('span');const status=document.createElement('b');button.append(dot,label,status);
    button.addEventListener('click',()=>{
      const targets=team.side==='pac'?[game.getHero(team.id)]:[game.getGhostHQ()];
      const target=targets.find(u=>u?.hp>0&&(team.side===game.side||game.isVisible(game.side,u.x,u.y)));
      if(target){renderer.centerOn(target.x,target.y);if(team.id===game.playerTeam){selected=new Set([target.id]);updateSelection();}}
    });
    roster.append(button);rosterNodes.set(team.id,{button,label,status});
  }
}
function updateTeamRoster(){
  $('team-roster').hidden=!started;
  for(const team of Object.values(game.teams)){
    const record=rosterNodes.get(team.id);if(!record)continue;
    const own=team.id===game.playerTeam,ally=team.side===game.side,target=team.side==='pac'?game.getHero(team.id):game.getGhostHQ();
    const visible=target&&target.hp>0&&(ally||game.isVisible(game.side,target.x,target.y));
    const controller=ai.find(c=>c.teamId===team.id);
    record.label.textContent=team.side==='pac'?(PAC_TEAMS.indexOf(team.id)+1)+' '+team.name.replace('Pac ','').toUpperCase():'GHOST';
    record.status.textContent=team.eliminated?'OUT':own?'YOU':controller?difficultyLabel(controller.difficulty).toUpperCase():'';
    record.button.classList.toggle('is-out',team.eliminated);record.button.disabled=!visible||team.eliminated;
    const owner=own?'You':(ally?'AI partner':'Enemy AI')+' · '+difficultyLabel(controller?.difficulty||'normal');
    record.button.title=team.name+' · '+owner+' · '+(team.eliminated?'Eliminated':visible?'Click to focus':'Unseen — scout to locate');
    record.button.setAttribute('aria-label',record.button.title);
  }
}
function updateTrainingQueue(){
  const panel=$('training-queue'),orders=$('training-queue-orders');
  if(trainingQueueGame!==game){orders.replaceChildren();trainingQueueNodes.clear();trainingQueueGame=game;trainingQueueCount=-1;}
  const items=[];
  for(const building of game.buildings){
    if(building.teamId!==game.playerTeam||building.hp<=0)continue;
    for(let index=0;index<(building.queue?.length||0);index++)items.push({building,order:building.queue[index],index});
  }
  const liveKeys=new Set(items.map(({building,order})=>building.id+':'+order.id));
  for(const [key,record]of trainingQueueNodes){if(!liveKeys.has(key)){record.button.remove();trainingQueueNodes.delete(key);}}
  items.forEach(({building,order,index},position)=>{
    const key=building.id+':'+order.id,definition=UNIT_DEFS[order.type],active=index===0;
    let record=trainingQueueNodes.get(key);
    if(!record){
      const button=document.createElement('button');button.type='button';button.className='training-order';button.dataset.queueId=order.id;button.dataset.buildingId=building.id;
      const sprite=document.createElement('span');sprite.className='training-order-sprite';sprite.setAttribute('aria-hidden','true');sprite.style.backgroundPosition=spritePosition(order.type);
      const cancel=document.createElement('span');cancel.className='training-order-cancel';cancel.textContent='×';cancel.setAttribute('aria-hidden','true');
      const status=document.createElement('span');status.className='training-order-status';status.setAttribute('aria-hidden','true');
      const track=document.createElement('span');track.className='training-order-progress';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');track.append(fill);
      button.append(sprite,cancel,status,track);
      const queueGame=game;
      button.addEventListener('click',event=>{
        event.stopPropagation();if(game!==queueGame)return;
        const refund=order.paidCost??definition.cost;
        if(game.cancelTraining(building.id,order.id)){
          tone(230,.045,.02);toast(definition.name+' cancelled · '+refund+' '+(game.side==='pac'?'Spark':'Dread')+' refunded.');
          updateHUD();
        }else{toast('This troop is no longer queued.');updateTrainingQueue();}
      });
      record={button,status,fill};trainingQueueNodes.set(key,record);
    }
    const seconds=Math.max(0,Math.ceil(order.remaining)),refund=order.paidCost??definition.cost;
    const producer=building.isHQ?'Ghost Citadel':BUILDING_DEFS[building.type].name;
    record.button.classList.toggle('is-training',active);record.button.classList.toggle('is-waiting',!active);
    record.status.textContent=active?seconds+'s':'#'+(index+1);
    record.fill.style.width=Math.max(0,Math.min(100,(1-order.remaining/(order.total||1))*100))+'%';
    const description=definition.name+' — '+(active?'training, '+seconds+' seconds left':'waiting, position '+(index+1))+' at '+producer+'. Refund '+refund+' '+(game.side==='pac'?'Spark':'Dread')+'.';
    record.button.title='Cancel '+description;record.button.setAttribute('aria-label','Cancel '+description);
    record.button.disabled=game.status!=='playing';
    if(orders.children[position]!==record.button)orders.insertBefore(record.button,orders.children[position]||null);
  });
  if(items.length!==trainingQueueCount){$('training-queue-count').textContent=String(items.length);trainingQueueCount=items.length;}
  panel.hidden=!started||ended||items.length===0||!$('setup-screen').hidden||!$('help-screen').hidden;
}
function updateHUD(){
  updateTrainingQueue();
  updateTeamRoster();
  $('pellet-count').textContent=game.pellets.size.toLocaleString();$('resource-count').textContent=Math.floor(game.resources[game.playerTeam]).toLocaleString();
  const troops=ownUnits().length;$('army-count').textContent=troops+' / '+game.unitCap(game.playerTeam);$('match-clock').textContent=clock(game.time);
  const hero=game.getHero(),seeHero=game.side==='pac'||hero&&game.isVisible('ghost',hero.x,hero.y);
  $('hero-hp-label').textContent=hero?(seeHero?Math.ceil(hero.hp)+' / '+hero.maxHp:'UNCONFIRMED'):'ELIMINATED';
  $('hero-hp-bar').style.width=hero?(seeHero?Math.max(0,hero.hp/hero.maxHp*100):100)+'%':'0%';$('hero-hp-bar').style.opacity=seeHero?'1':'.25';
  $('hero-hp-bar').style.background=hero&&seeHero&&hero.hp/hero.maxHp<.3?'#ff7286':'var(--team)';
  $('quick-hero-hp').textContent=game.side==='ghost'?game.getHeroes().length+' / 3 ALIVE':hero?Math.ceil(hero.hp)+' HP':'SPECTATING';
  $('quick-hp-bar').style.width=hero?(seeHero?Math.max(0,hero.hp/hero.maxHp*100):100)+'%':'0%';
  $('quick-hp-bar').style.opacity=seeHero?'1':'.25';
  $('quick-hp-bar').style.background=hero&&seeHero&&hero.hp/hero.maxHp<.3?'#ff7286':'var(--team)';
  const hq=game.getGhostHQ?.()||game.buildings.find(b=>b.isHQ);
  const seeHQ=!!hq&&(game.side==='ghost'||game.isVisible(game.side,hq.x,hq.y));
  $('citadel-hp-label').textContent=hq?(seeHQ?Math.ceil(hq.hp).toLocaleString()+' / '+hq.maxHp.toLocaleString():'UNSCOUTED'):'DESTROYED';
  $('citadel-hp-bar').style.width=hq?(seeHQ?Math.max(0,hq.hp/hq.maxHp*100):100)+'%':'0%';$('citadel-hp-bar').style.opacity=seeHQ?'1':'.2';
  $('hero-title').parentElement.parentElement.classList.toggle('danger-pulse',game.side==='pac'&&hero&&hero.hp/hero.maxHp<.3);
  $('hero-quick').classList.toggle('danger-pulse',game.side==='pac'&&hero&&hero.hp/hero.maxHp<.3);
  $('power-count').textContent=game.powerCharges+' CHARGE'+(game.powerCharges===1?'':'S');$('rank-value').textContent='RANK '+game.powerRanks;
  $('power-btn').disabled=game.powerCharges<=0||game.powerCooldown>0||!started||ended||playerEliminated();
  $('power-label').textContent=game.powerCooldown>0?'RECHARGING '+Math.ceil(game.powerCooldown)+'s':'UNLEASH POWER';
  $('quick-power').disabled=$('power-btn').disabled;
  $('quick-power-text').textContent=game.powerCooldown>0?'POWER · '+Math.ceil(game.powerCooldown)+'s':'POWER · '+game.powerCharges;
  $('pause-btn').textContent=game.paused?'▶':'Ⅱ';$('pause-btn').setAttribute('aria-label',game.paused?'Resume match':'Pause match');
  $('pause-label').hidden=!game.paused||!started||ended||!$('setup-screen').hidden||!$('help-screen').hidden;
  const contacts=game.units.filter(u=>u.side!==game.side&&game.isVisible(game.side,u.x,u.y));$('contact-count').textContent=contacts.length?contacts.length+' CONTACT'+(contacts.length===1?'':'S'):'NO CONTACT';
  $('contact-count').style.color=contacts.length?'var(--ghost)':'';
  const events=game.events.filter(e=>e.kind!==other(game.side)).slice(-4).reverse();
  $('activity-log').replaceChildren(...events.map(e=>{const row=document.createElement('div');row.className='log-row'+(/attack|danger|killed|slain/i.test(e.text)?' warn':'');const time=document.createElement('time');time.textContent=clock(e.time);const txt=document.createElement('span');txt.textContent=e.kind==='start'&&game.side==='ghost'?'Form hunting parties. Pellets reveal nearby targets; scout the darkness.':e.text;row.append(time,txt);return row;}));
  document.querySelectorAll('.production-card').forEach(b=>{
    const d=(productionTab==='troops'?UNIT_DEFS:BUILDING_DEFS)[b.dataset.type];b.disabled=!started||ended||playerEliminated()||game.resources[game.playerTeam]<d.cost;
    b.classList.toggle('selected',buildType===b.dataset.type&&productionTab==='buildings');
  });
  $('zoom-label').textContent=Math.round(renderer.camera.zoom*100)+'%';
  if(started&&!game.paused&&game.side==='pac'&&hero&&previousHp!==null&&hero.hp<previousHp-2&&game.time>3){
    if(!updateHUD.lastDanger||game.time-updateHUD.lastDanger>5){toast('PAC-MAN IS UNDER ATTACK · F to focus · E for Power',true);tone(150,.2,.05,'square');updateHUD.lastDanger=game.time;}
  }
  previousHp=hero?.hp??0;
  if(started&&!ended&&playerEliminated()&&!playerWasEliminated){cancelMode();selected.clear();toast('YOUR COMMANDER HAS FALLEN · Your partners can still win. Click a team badge to watch them.',true);}
  playerWasEliminated=playerEliminated();
  if(game.collected>lastSoundPellets){if(!game.paused&&started)tone(430+(game.collected%5)*80,.025,.014);lastSoundPellets=game.collected;}
  const ids=new Set([...game.units,...game.buildings].map(u=>u.id));selected=new Set([...selected].filter(id=>ids.has(id)));
  updateSelection();renderer.drawMinimap(minimap,{selected});
}
function endMatch(){
  ended=true;keys.clear();cancelMode();
  const won=game.status===(game.side==='pac'?'pac-won':'ghost-won');
  const citadelVictory=game.status==='pac-won'&&/citadel|headquarters/i.test(game.winnerReason||'');
  $('result-kicker').textContent=game.status==='pac-won'?(citadelVictory?'THE CITADEL HAS FALLEN':'EVERY PELLET. EVERY CORRIDOR.'):'THE HUNT IS OVER';
  $('result-title').textContent=won?'VICTORY':'DEFEAT';
  $('result-reason').textContent=game.winnerReason||(game.status==='pac-won'?'Every yellow pellet has been consumed.':'Pac-Man has fallen. The ghosts own the maze.');
  $('result-symbol').style.backgroundImage='url("assets/'+(citadelVictory?'buildings':'units')+'.png")';
  $('result-symbol').style.backgroundSize=citadelVictory?'400% 200%':'800% 800%';
  $('result-symbol').style.backgroundPosition=citadelVictory?buildingPosition('lair'):spritePosition(game.status==='pac-won'?'hero':'hunter');
  $('result-stats').replaceChildren(...[['TIME',clock(game.time)],['CLEARED',Math.round(game.collected/game.totalPellets*100)+'%'],['ENEMIES LOST',game.kills[game.side]||0]].map(([name,value])=>{const d=document.createElement('div');d.className='result-stat';const strong=document.createElement('strong');strong.textContent=value;const label=document.createElement('span');label.textContent=name;d.append(strong,label);return d;}));
  $('result-screen').hidden=false;$('pause-label').hidden=true;
  [0,1,2].forEach((x)=>setTimeout(()=>tone(won?440+x*170:320-x*70,.22,.04,'triangle'),x*130));
  try{const records=JSON.parse(localStorage.getItem('blackout-records')||'{}');const k=game.side+'-'+game.difficulty;if(won&&(!records[k]||game.time<records[k]))records[k]=game.time;localStorage.setItem('blackout-records',JSON.stringify(records));}catch{}
}
function entityAt(world,side=game.side){
  const available=u=>u.side===side&&u.hp>0&&(side!==game.side||u.teamId===game.playerTeam);
  const units=game.units.filter(u=>available(u)&&Math.hypot(u.x-world.x,u.y-world.y)<.85).sort((a,b)=>Math.hypot(a.x-world.x,a.y-world.y)-Math.hypot(b.x-world.x,b.y-world.y));
  return units[0]||game.buildings.find(b=>available(b)&&Math.abs(b.x-world.x)<=b.w/2&&Math.abs(b.y-world.y)<=b.h/2)||null;
}
function unitsInBox(box){
  const left=Math.min(box.x1,box.x2),right=Math.max(box.x1,box.x2),top=Math.min(box.y1,box.y2),bottom=Math.max(box.y1,box.y2);
  const radius=Math.max(9,renderer.camera.zoom*32*.5);
  return ownUnits().filter(u=>{const p=renderer.worldToScreen(u.x,u.y),x=Math.max(left,Math.min(right,p.x)),y=Math.max(top,Math.min(bottom,p.y));return Math.hypot(p.x-x,p.y-y)<=radius;});
}
function clearTargetingForDrag(){
  buildType=null;orderMode=null;$('placement-note').hidden=true;canvas.style.cursor='default';
  document.querySelectorAll('[data-order]').forEach(b=>b.classList.remove('active'));
}
function issueAt(world,action=null){
  if(game.paused){toast('Match paused. Press Space to resume.',true);return;}
  const units=selectedUnits();if(!units.length){toast('Select your units first.',true);return;}
  if(action==='snare'){
    const binders=units.filter(u=>u.type==='binder');const count=game.castSnare?.(binders.map(u=>u.id),world.x,world.y)||0;
    if(count){toast('SNARE CASTING · The marked ground will trap enemies when the cast finishes.');tone(290,.12,.035,'triangle');}
    else toast('Move a ready Binder within casting range and clear sight of that ground.',true);
    cancelMode();updateSelection();return;
  }
  const enemy=entityAt(world,other(game.side));const target=enemy&&game.isVisible(game.side,enemy.x,enemy.y)?enemy:null;
  const pellet=game.pellets.get(Math.floor(world.y)*game.map.width+Math.floor(world.x));
  action=action||(target?'attack':pellet&&game.side==='pac'?'harvest':'move');
  if(action==='harvest'&&game.side!=='pac')action='move';
  game.command(units.map(u=>u.id),action,world.x,world.y,target?.id);
  game.effects.push({x:world.x,y:world.y,type:'command',life:.65,maxLife:.65,side:game.side});
  tone(action==='attack'?180:360,.035,.02);cancelMode();updateSelection();
}

// Native pointer controls: click/drag selection, middle-drag pan, context commands.
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(!started||ended||!$('setup-screen').hidden||!$('help-screen').hidden)return;
  const r=canvas.getBoundingClientRect();mouseWorld=renderer.screenToWorld(e.clientX,e.clientY);
  if(e.button===2){e.preventDefault();if(buildType||orderMode){cancelMode();return;}issueAt(mouseWorld);return;}
  if(e.button===1){e.preventDefault();panPointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  e.preventDefault();
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX-r.left,sy:e.clientY-r.top,shift:e.shiftKey};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  const bounds=canvas.getBoundingClientRect();mouseCanvas={x:e.clientX-bounds.left,y:e.clientY-bounds.top};
  mouseWorld=renderer.screenToWorld(e.clientX,e.clientY);
  if(panPointer){renderer.pan(panPointer.x-e.clientX,panPointer.y-e.clientY);panPointer.x=e.clientX;panPointer.y=e.clientY;return;}
  if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5){
    if(buildType||orderMode)clearTargetingForDrag();
    const r=canvas.getBoundingClientRect();drag={x1:pointer.sx,y1:pointer.sy,x2:e.clientX-r.left,y2:e.clientY-r.top};drag.count=unitsInBox(drag).length;
    e.preventDefault();
  }
  if(buildType){const r=game.canBuild(buildType,mouseWorld.x,mouseWorld.y);$('placement-note').textContent=(r.ok?'Place '+BUILDING_DEFS[buildType].name:r.reason)+' · Esc cancels';}
});
function finishPointer(e){
  if(panPointer){panPointer=null;return;}
  if(!pointer||e.button!==0)return;
  const world=renderer.screenToWorld(e.clientX,e.clientY),start=pointer;pointer=null;
  e.preventDefault();
  if(drag||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){
    const r=canvas.getBoundingClientRect();drag={x1:start.sx,y1:start.sy,x2:e.clientX-r.left,y2:e.clientY-r.top};
    clearTargetingForDrag();if(!start.shift)selected.clear();unitsInBox(drag).forEach(u=>selected.add(u.id));drag=null;updateSelection();return;
  }
  if(buildType){
    if(game.paused){toast('Resume the match to construct.',true);return;}
    const check=game.canBuild(buildType,world.x,world.y);
    if(check.ok&&game.build(buildType,world.x,world.y)){tone(260,.09,.035);toast(BUILDING_DEFS[buildType].name+' construction started.');if(!e.shiftKey)cancelMode();}
    else toast(check.reason||'Cannot build here.',true);
    updateHUD();return;
  }
  if(orderMode){issueAt(world,orderMode);return;}
  const entity=entityAt(world);
  if(entity){if(start.shift){if(selected.has(entity.id))selected.delete(entity.id);else selected.add(entity.id);}else selected=new Set([entity.id]);tone(600,.02,.01);}
  else if(coarse&&selectedUnits().length)issueAt(world);
  else if(!start.shift)selected.clear();
  updateSelection();
}
canvas.addEventListener('pointerup',finishPointer);
window.addEventListener('pointerup',finishPointer);
canvas.addEventListener('pointercancel',()=>{pointer=null;drag=null;panPointer=null;});
canvas.addEventListener('pointerleave',()=>{mouseCanvas=null;if(!pointer&&!panPointer)mouseWorld=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.zoomAt(e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY);},{passive:false});
minimap.addEventListener('pointerdown',e=>{const r=minimap.getBoundingClientRect(),scale=Math.min(r.width/game.map.width,r.height/game.map.height),ox=(r.width-game.map.width*scale)/2,oy=(r.height-game.map.height*scale)/2;renderer.centerOn((e.clientX-r.left-ox)/scale,(e.clientY-r.top-oy)/scale);});

document.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{captureSetupChoices();settings.side=b.dataset.side;refreshSetup({preserveInputs:true});}));
document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{captureSetupChoices();settings.teamId=b.dataset.team;refreshSetup({preserveInputs:true});}));
document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{captureSetupChoices();settings.difficulty=b.dataset.difficulty;refreshSetup({preserveInputs:true});}));
$('map-select').addEventListener('change',captureSetupChoices);$('seed-input').addEventListener('input',captureSetupChoices);
$('seed-random').addEventListener('click',()=>{$('seed-input').value=1+Math.floor(Math.random()*999999);captureSetupChoices();});
$('launch-btn').addEventListener('click',startGame);
$('menu-btn').addEventListener('click',openMenu);$('menu-link').addEventListener('click',openMenu);$('setup-close').addEventListener('click',closeMenu);
$('help-btn').addEventListener('click',openHelp);$('setup-help').addEventListener('click',openHelp);$('help-close').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
$('pause-btn').addEventListener('click',()=>setPaused(!game.paused));$('resume-inline').addEventListener('click',()=>setPaused(false));
$('sound-btn').addEventListener('click',()=>{settings.sound=!settings.sound;saveSettings();$('sound-btn').setAttribute('aria-pressed',String(settings.sound));$('sound-btn').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound');$('sound-btn').style.color=settings.sound?'var(--teal)':'';tone(700,.08);});
$('speed-btn').addEventListener('click',()=>{speed=speed===1?1.5:speed===1.5?2:1;$('speed-btn').textContent=speed+'×';});
$('focus-btn').addEventListener('click',focusArmy);$('zoom-in').addEventListener('click',()=>renderer.zoomAt(1.2));$('zoom-out').addEventListener('click',()=>renderer.zoomAt(1/1.2));
$('power-btn').addEventListener('click',activatePower);
$('quick-power').addEventListener('click',activatePower);$('hero-quick').addEventListener('click',focusArmy);
$('intel-toggle').addEventListener('click',()=>{const open=$('intel-drawer').classList.toggle('expanded');$('intel-toggle').setAttribute('aria-expanded',String(open));$('intel-toggle').setAttribute('aria-label',open?'Collapse tactical intel':'Expand tactical intel');});
$('troops-tab').addEventListener('click',()=>{productionTab='troops';cancelMode();renderProduction();updateHUD();});
$('buildings-tab').addEventListener('click',()=>{productionTab='buildings';cancelMode();renderProduction();updateHUD();});
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>b.dataset.order==='attack'?attackNearest():setOrderMode(b.dataset.order)));
$('rematch-btn').addEventListener('click',startGame);$('result-menu').addEventListener('click',()=>{$('result-screen').hidden=true;openMenu();});
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const key=e.key.toLowerCase();
  if(key==='escape'){
    if(!$('help-screen').hidden)closeHelp();else if(!$('setup-screen').hidden)closeMenu();else if(buildType||orderMode)cancelMode();else setPaused(!game.paused);e.preventDefault();return;
  }
  if(!started||ended||!$('setup-screen').hidden||!$('help-screen').hidden)return;
  const digit=e.code?.match(/^Digit([1-4])$/)?.[1];
  if(digit&&!e.ctrlKey&&!e.metaKey){
    if(productionTab==='buildings'||e.shiftKey){const types=Object.keys(BUILDING_DEFS).filter(type=>BUILDING_DEFS[type].side===game.side);const type=types[Number(digit)-1];if(type)beginConstruction(type);}
    else{const types=Object.keys(UNIT_DEFS).filter(type=>UNIT_DEFS[type].side===game.side&&type!=='hero');const type=types[Number(digit)-1];if(type)summonTroop(type);}
    e.preventDefault();return;
  }
  if(key===' '){if(!e.repeat)setPaused(!game.paused);e.preventDefault();return;}
  if(key==='f'){focusArmy();e.preventDefault();return;}
  if(key==='e'){if(!e.repeat)activatePower();e.preventDefault();return;}
  if(key==='b'){productionTab='buildings';renderProduction();updateHUD();e.preventDefault();return;}
  if(key==='t'){productionTab='troops';cancelMode();renderProduction();updateHUD();e.preventDefault();return;}
  if(key==='m'){setOrderMode('move');e.preventDefault();return;}
  if(key==='h'&&game.side==='pac'){setOrderMode('harvest');e.preventDefault();return;}
  if(key==='q'&&game.side==='ghost'){setOrderMode('snare');e.preventDefault();return;}
  if(key==='x'){game.command([...selected],'stop');cancelMode();e.preventDefault();return;}
  if(key==='a'&&e.shiftKey){selected=new Set(ownUnits().map(u=>u.id));updateSelection();e.preventDefault();return;}
  if(key==='a'){if(!e.repeat)attackNearest();e.preventDefault();return;}
  if(['w','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){keys.add(key);e.preventDefault();}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();mouseCanvas=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!ended&&$('setup-screen').hidden){game.paused=true;keys.clear();updateHUD();}});
window.addEventListener('resize',()=>renderer?.resize());

function frame(now){
  const dt=Math.min(.12,Math.max(0,(now-frame.last)/1000));frame.last=now;
  if(started&&!ended&&!game.paused){
    accumulator+=dt*speed;let steps=0;
    while(accumulator>=.05&&steps++<8&&game.status==='playing'){for(const controller of ai)controller.update(.05);game.update(.05);accumulator-=.05;}
    if(game.status!=='playing')endMatch();
  }
  if(started&&$('setup-screen').hidden&&$('help-screen').hidden){
    let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(mouseCanvas&&!pointer&&!panPointer&&!coarse){
      const edge=24,w=canvas.clientWidth,h=canvas.clientHeight;
      const edgeAxis=(n,max)=>n<edge?-(edge-n)/edge:n>max-edge?(n-max+edge)/edge:0;
      dx+=edgeAxis(mouseCanvas.x,w);dy+=edgeAxis(mouseCanvas.y,h);
    }
    if(dx||dy)renderer.pan(dx*dt*650,dy*dt*650);
    if(mouseCanvas&&(dx||dy)){const r=canvas.getBoundingClientRect();mouseWorld=renderer.screenToWorld(r.left+mouseCanvas.x,r.top+mouseCanvas.y);}
  }
  const visualSelected=drag?new Set([...(pointer?.shift?selected:[]),...unitsInBox(drag).map(u=>u.id)]):selected;
  renderer.render(dt,{selected:visualSelected,buildType,mouseWorld,drag,snarePreview:orderMode==='snare',showRanges:false});
  uiTime+=dt;if(uiTime>.16){updateHUD();uiTime=0;}
  requestAnimationFrame(frame);
}

refreshSetup();makeGame();
renderer.assetReady.then(result=>{$('loading-status').textContent=result.units&&result.terrain&&result.buildings?'READY TO COMMAND':'Ready. Some artwork could not be loaded.';});
frame.last=performance.now();requestAnimationFrame(frame);
// Local diagnostics support reproducible simulation checks; these never run by themselves.
window.blackout={get game(){return game;},get ai(){return ai;},get renderer(){return renderer;},get selected(){return selected;},startGame,settings};
