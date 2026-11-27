(() => {
  'use strict';

  const W = 960, H = 540, SAVE = 'cinder-relay.expedition.v1', OPTIONS = 'cinder-relay.options.v1';
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d', {alpha:false});
  ctx.imageSmoothingEnabled = false;
  const clamp = (n,min,max) => Math.max(min, Math.min(max,n));
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } };
  const forget = key => { try { localStorage.removeItem(key); } catch {} };
  const defaults = {volume:.72,music:.34,shake:true,flashes:true,friendly:.86,outline:true,assist:.32,adaptiveResolution:true};
  const g = {
    worldW:W,worldH:H,screen:'home',stage:1,room:0,mapId:0,route:null,routeOptions:[],
    time:0,elapsed:0,enemies:[],hostile:[],particles:[],drops:[],ghosts:[],floaters:[],
    settings:{...defaults,...read(OPTIONS)},meta:Progress.loadMeta(),saved:false,saveInfo:null,
    player:null,players:[],coopLayout:'solo',rewardOwner:0,aim:{x:700,y:270},choices:[],trail:[],pendingLevels:0,rerolls:1,kills:0,
    hudDelay:0,shakePower:0,hurtTint:0,saveIssue:false
  };
  let seedState = 1, checkpoint = null, continuation = null;
  const screens = [];
  const stations = new WeakMap();
  const wingInput = {x:0,y:0,aimX:1,aimY:0,fire:false,pressed:false,released:false};
  const crewed = () => g.players.length === 2;
  function forPilot(p) {
    if(stations.has(p))return stations.get(p);
    const wing=p===g.players[1];
    const local={player:p,hurtPlayer:amount=>hurtPilot(p,amount)};
    if(wing)Object.assign(local,{aim:{x:p.x+180,y:p.y},combat:null,decoy:null,aimingAbility:null});
    const view=new Proxy(g,{
      get(target,key) {
        if(key==='pendingLevels'&&crewed())return p.pendingLevels||0;
        return Object.hasOwn(local,key)?local[key]:target[key];
      },
      set(target,key,value) {
        if(key==='pendingLevels'&&crewed())p.pendingLevels=value;
        else if(Object.hasOwn(local,key))local[key]=value;
        else target[key]=value;
        return true;
      }
    });
    stations.set(p,view);return view;
  }
  g.forPilot=forPilot;
  function selectPilot(index=0) {
    g.rewardOwner=crewed()&&index===1?1:0;
    g.player=g.players[g.rewardOwner]||null;
  }
  g.rng = () => {
    seedState = (seedState + 0x6D2B79F5) >>> 0;
    let t = Math.imul(seedState ^ seedState >>> 15, 1 | seedState);
    t = (t + Math.imul(t ^ t >>> 7,61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  g.blocked = (x,y,r=0) => x-r < 0 || y-r < 0 || x+r > g.worldW || y+r > g.worldH || World.blocked(g,x,y,r);
  g.shotBlocked = (x,y,r=0) => World.blocked(g,x,y,r,true);
  g.move = (ent,dx,dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    const distance=Math.max(Math.abs(dx),Math.abs(dy));
    if (!distance) return true;
    const steps = Math.max(1, Math.ceil(distance/6)), radius = ent.bodyR ?? ent.r ?? 4;
    const x = ent.x,y = ent.y;
    for(let i=0;i<steps;i++) {
      if(!g.blocked(ent.x+dx/steps,ent.y,radius)) ent.x+=dx/steps;
      if(!g.blocked(ent.x,ent.y+dy/steps,radius)) ent.y+=dy/steps;
    }
    return Math.abs(x-ent.x)+Math.abs(y-ent.y)>.02;
  };
  g.sound = RelayAudio.play;
  g.fx = (x,y,color='#ffb16a',n=6) => {
    const count=Math.min(n,26,220-g.particles.length);
    for (let i=0;i<count;i++) {
      const a=Math.random()*Math.PI*2, v=15+Math.random()*(n>12?115:73);
      const life=.12+Math.random()*.35;
      g.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,size:1+Math.random()*2.8,color});
    }
  };
  function float(x,y,text,color='#ffcf8b') {
    if(g.floaters.length<14) g.floaters.push({x,y,t:.85,text,color});
  }
  function toast(message) {
    g.notice=message; g.noticeTime=2.6;
    const el=document.getElementById('relay-toast');
    if(!el) return;
    el.textContent=message; el.classList.add('visible');
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),2400);
  }
  g.toast = toast;
  g.spawn = (id,x,y,options) => {
    const enemy=Foes.spawn(g,id,x,y,options);
    if(enemy)Progress.observe(g.meta,id,!!options?.boss);
    return enemy;
  };
  g.hurtEnemy = (e,damage,angle=0,push=0,element='') => {
    if(!e||e.dead||e.hp<=0||!(damage>0)||e.boss&&e.arrive>0) return 0;
    let delta=Foes.mitigate ? Foes.mitigate(g,e,damage,angle,element) : damage;
    if(!Number.isFinite(delta)) delta=damage;
    const actual=Math.min(e.hp,Math.max(0,delta));
    e.hp-=actual; e.flash=g.settings.flashes?.09:0;
    if(push>0) {
      const impulse=Math.min(580,push)/Math.max(.65,e.mass||1);
      const resistance=1/(1+(e.pushFatigue||0));
      e.kx=(e.kx||0)+Math.cos(angle)*impulse*resistance;
      e.ky=(e.ky||0)+Math.sin(angle)*impulse*resistance;
      e.pushFatigue=Math.min(2,(e.pushFatigue||0)+.24);
      if(!e.boss && !e.elite && push>95) e.stagger=Math.max(e.stagger||0,.16);
    }
    if(actual>0 && (g.time-(e.lastSpark??-1))>.065) {
      e.lastSpark=g.time; g.fx(e.x,e.y,e.id>=24?'#ccb7ff':e.id>=12?'#a7d8a3':'#ffc193',3);
    }
    if(e.hp<=0) {
      e.hp=0; e.dead=true; g.kills++;
      const boss=e.boss, elite=e.elite, color=boss?'#ffd59c':e.id>=24?'#bba1ff':e.id>=12?'#acc48c':'#e99765';
      g.fx(e.x,e.y,color,boss?32:elite?19:9);
      Combat.deathFX?.(g,e);
      g.sound(boss?'boss-death':'kill');
      g.shakePower=Math.max(g.shakePower,boss?7:elite?3:1.2);
      g.seenFoes = g.seenFoes || {};
      g.seenFoes[(boss?'b':'e')+e.id]=true;
      Progress.observe(g.meta,e.id,!!boss);
      if(!e.noReward) {
        const fodder=e.def.fodder&&!elite&&!boss;
        const xp=boss?24:elite?9:fodder?1:2;
        g.drops.push({x:e.x,y:e.y,xp,scrap:boss?14:elite?5:(g.rng()<(fodder?.07:.22)?1:0),type:boss?'core':'xp',age:0});
        if(!boss && g.players.some(p=>p.hp>0&&p.hp<p.maxHp*.78) && g.rng()<(elite?.56:fodder?.012:.042))
          g.drops.push({x:e.x+6,y:e.y-3,xp:0,scrap:0,heal:7,type:'repair',age:0});
      }
      if(elite||boss)for(const p of g.players)if(p.hp>0)Progress.onElite?.(forPilot(p),e);
    }
    return actual;
  };
  function hurtPilot(p,amount) {
    if(g.screen!=='play'||!p||p.hp<=0||p.invuln>0||p.dashTime>0||amount<=0) return 0;
    amount=Progress.guardDamage?.(forPilot(p),amount)??amount;
    const absorbed=Math.min(p.shield,amount), hull=amount-absorbed;
    p.shield-=absorbed; p.hp=Math.max(0,p.hp-hull);
    p.invuln=.69; p.flash=g.settings.flashes?.13:0; p.lastHit=g.time;
    g.hurtTint=.2; g.shakePower=3.2; g.sound('hurt');
    g.fx(p.x,p.y,hull?'#ff7957':'#80e8df',11);
    if(p.hp<=0) {
      p.downed=true;p.revive=0;p.dashTime=0;
      if(g.players.every(member=>member.hp<=0))endRun(false);
      else toast('Pilot '+(g.players.indexOf(p)+1)+' down. Stand beside your partner to revive.');
    }
    return amount;
  }
  g.hurtPilot=hurtPilot;
  g.hurtPlayer=amount=>hurtPilot(g.player,amount);
  const keys=new Set(), pointers=new Map();
  let aiming='mouse', heldFire=false, pressed=false,released=false, lastPointer={x:650,y:270};
  let padMove={x:0,y:0},padFire=false, aimVector={x:1,y:0};
  let touchMove=null,touchAim=null, lastHud=0, lastTime=0, frame=0;
  function releaseControls() {
    keys.clear(); heldFire=false; padFire=false; pressed=false; released=false;
    padMove={x:0,y:0}; touchMove=null; touchAim=null; pointers.clear();g.aimingAbility=null;
    Object.assign(wingInput,{x:0,y:0,fire:false,pressed:false,released:false});
    if(crewed())forPilot(g.players[1]).aimingAbility=null;
  }
  function setScreen(screen, data={}) {
    if(['play','pause','junction','routes'].includes(screen))selectPilot();
    g.canInspectOther=crewed()&&screen==='inventory'&&!screens.includes('draft');
    g.screen=screen; g.safeRefit=screen==='junction'||screen==='draft'||screen==='routes'||
      (screen==='inventory'&&screens.some(x=>['junction','draft','routes'].includes(x)));
    releaseControls(); UI.show(screen,g,data); if(screen==='play') UI.hud(g);
  }
  function showBase(screen,data) { screens.length=0; setScreen(screen,data); }
  function open(screen) {
    if(!['inventory','guide','settings','pause','records'].includes(screen)||g.screen===screen)return;
    if(screen==='inventory'&&!g.player)return;
    if(screen==='pause'&&g.screen!=='play')return;
    screens.push(g.screen); setScreen(screen);
  }
  function inspectPilot(index){
    if(!crewed()||g.screen!=='inventory'||screens.includes('draft'))return false;
    selectPilot(index);UI.show('inventory',g);return true;
  }
  function back() {
    if(screens.length) { setScreen(screens.pop()); return; }
    if(g.screen==='play') open('pause');
    else if(g.screen==='pause') showBase('play');
    else if(['settings','guide','records'].includes(g.screen)) home();
  }
  function checkpointSummary() {
    if(checkpoint) g.saveInfo={stage:checkpoint.stage,room:checkpoint.room,mapId:checkpoint.mapId,screen:checkpoint.screen,
      elapsed:checkpoint.elapsed,level:checkpoint.player.level,coopLayout:checkpoint.coopLayout||'solo',
      labName:checkpoint.labState?.layoutName,mode:checkpoint.expeditionMode};
    else g.saveInfo=null;
    g.saved=!!checkpoint;
  }
  function saveAt(screen,entrySeed=seedState,labState=null) {
    const fields=['stage','room','mapId','route','routeOptions','player','kitId','contract','runId','elapsed','time','kills','cleared','rerolls','pendingLevels','dataEarned','seenFoes','runData','bankedStages','contractedStages','seed','huntCarry','lastBossId'];
    const snapshot={version:1,screen,seedState:entrySeed,expeditionMode:g.expeditionMode,waspBudget:g.combat?.healUsed||0};
    if(screen==='junction'||screen==='routes')snapshot.securedLayout=g.encounter;
    for(const field of fields) snapshot[field]=g[field];
    snapshot.player=g.players[0];
    if(labState){
      snapshot.labState=labState;
      snapshot.sightMemory=Sight.snapshot(g);
      snapshot.labDrops=g.drops;
    }
    if(crewed()){
      snapshot.players=g.players;snapshot.coopLayout=g.coopLayout;
      snapshot.wingBudget=forPilot(g.players[1]).combat?.healUsed||0;
    }
    // Markers used for live UI, lock-on targets, and field effects do not survive a safe gate.
    const omit = new Set(['target','lastTarget','lockTarget','trackedTarget','bankTarget','latched','parent','owner']);
    try {
      checkpoint=JSON.parse(JSON.stringify(snapshot,(key,value)=>omit.has(key)&&value&&typeof value==='object'?undefined:value));
      g.saveIssue=!write(SAVE,checkpoint); checkpointSummary();
    }catch {g.saveIssue=true;}
    if(g.saveIssue) toast('Checkpoint is available for this session only.');
  }
  function clearTransient() {
    g.enemies=[]; g.hostile=[]; g.particles=[]; g.drops=[]; g.ghosts=[]; g.floaters=[];
    g.labSavePending=false;
    g.shakePower=0; g.hurtTint=0; g.prompt='';g.objective='';g.encounter='';
    for(const p of g.players){
      p.dashTime=0;p.invuln=.7;p.flash=0;
      Combat.reset?.(forPilot(p));
    }
  }
  g.labSafe=()=>{g.labSavePending=true;};
  function saveLabIfReady(){
    if(!g.labSavePending||g.screen!=='play'||g.draftQueue.length||g.players.some(p=>forPilot(p).pendingLevels>0))return;
    const state=World.labCheckpoint(g);
    if(state){g.labSavePending=false;saveAt('lab',seedState,state);}
  }
  function enterRoom(initial=false,savedLab=null) {
    const entrySeed=seedState;
    const positions=savedLab?g.players.map(p=>({x:p.x,y:p.y})):null;
    selectPilot();clearTransient();
    if(initial)saveAt('entry',entrySeed);
    World.build(g,{legacy:!!savedLab&&(!savedLab.labState?.generation||savedLab.labState.generation===1)});g.roomDone=false;
    g.player.a=0;aimVector={x:1,y:0};
    if(crewed()){
      const partner=g.players[1],offsets=[[0,28],[0,-28],[28,0],[-28,0],[0,0]];
      const [dx,dy]=offsets.find(([x,y])=>!g.blocked(g.player.x+x,g.player.y+y,partner.bodyR));
      partner.x=g.player.x+dx;partner.y=g.player.y+dy;partner.a=0;
      forPilot(partner).aim={x:partner.x+180,y:partner.y};
      wingInput.aimX=1;wingInput.aimY=0;
    }
    if(savedLab&&g.map.lab&&World.restoreLab(g,savedLab.labState)!==false){
      seedState=entrySeed;
      g.players.forEach((p,i)=>{
        const at=positions[i];
        if(Number.isFinite(at.x)&&Number.isFinite(at.y)&&!g.blocked(at.x,at.y,p.bodyR))Object.assign(p,at);
      });
      g.drops=savedLab.labDrops||[];
      Sight.restore(g,savedLab.sightMemory);
    }
    for(const p of g.players)forPilot(p).aim={x:p.x+180,y:p.y};
    RelayCamera.update(g,0,true);
    lastPointer=RelayCamera.screenPoint(g,g.aim.x,g.aim.y);
    showBase('play'); g.introTime=2.9; g.introTitle=g.encounter||World.maps[g.mapId].name;
  }
  function start(kitId=0,contract=null,layout='solo',mode='campaign') {
    RelayAudio.unlock();
    if(mode==='endless'&&!Progress.endlessUnlocked(g.meta))return;
    if(layout!=='solo'&&CrewInput.status({coopLayout:layout}).missing.length){
      toast(layout==='dual-pad'?'Connect both controllers and press a button on each.':'Connect a controller and press a button to join.');
      return;
    }
    if(kitId!==0 && !(g.meta.unlocked||[0]).includes(Number(kitId))) { toast('Unlock this kit with Relay Data first.');return; }
    kitId=Number(kitId)||0;
    seedState=(Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0;
    Object.assign(g,{stage:1,room:0,mapId:0,route:null,routeOptions:[],time:0,elapsed:0,seed:seedState,
      runId:Date.now().toString(36)+'-'+seedState.toString(36),cleared:0,kills:0,pendingLevels:0,rerolls:1,
      dataEarned:0,runData:0,bankedStages:0,contractedStages:0,kitId,contract,seenFoes:{},result:null,choices:[],draftQueue:[]});
    g.huntCarry=null;g.lastBossId=-1;g.combat=null;
    g.expeditionMode=mode==='endless'?'endless':'campaign';
    if(g.expeditionMode==='endless'){
      g.route=Progress.routes(g)[0];
      g.mapId=g.route.mapId;
    }
    g.coopLayout=['keyboard-pad','dual-pad'].includes(layout)?layout:'solo';
    g.players=Array.from({length:g.coopLayout==='solo'?1:2},()=>Progress.newPlayer(kitId));
    selectPilot();
    for(const p of g.players){p.kitId=kitId;Progress.recalc(forPilot(p));initPlayer(p);}
    continuation=null;
    g.sound('gate');enterRoom(true);
  }
  function initPlayer(p) {
    p.guns.forEach(Combat.normalizeGun);
    p.a??=0; p.r??=10;p.hitR=4.5;p.lastHit??=-10;p.dashCharges??=2;
    p.dashTimer??=0;p.dashTime=0;p.invuln=0;p.moving=false;p.combatMove=1;
    p.walkCycle??=0;p.stats??={};p.bodyR??=Math.min(10,p.r);
  }
  function resumeSave() {
    if(!checkpoint)return;
    RelayAudio.unlock();
    const cached=JSON.parse(JSON.stringify(checkpoint));
    const {screen,version,seedState:state,labState,labDrops,sightMemory,securedLayout,...rest}=cached;
    Object.assign(g,rest);seedState=state;continuation=null;g.draftQueue=[];g.choices=[];
    g.expeditionMode=cached.expeditionMode==='endless'?'endless':'campaign';
    g.players=cached.players?.length===2?cached.players:[cached.player];
    g.coopLayout=crewed()?(cached.coopLayout==='dual-pad'?'dual-pad':'keyboard-pad'):'solo';
    selectPilot();g.map=null;g.combat=null;
    for(const p of g.players){initPlayer(p);Progress.recalc(forPilot(p));}
    if(screen==='entry'||screen==='lab') enterRoom(false,screen==='lab'?{labState,labDrops,sightMemory}:null);
    else {clearTransient();g.encounter=securedLayout||World.maps[g.mapId].rooms?.[g.room]||World.maps[g.mapId].name;g.objective='Sector secured';showBase(screen);}
    if(g.combat) g.combat.healUsed=cached.waspBudget||0;
    if(crewed())forPilot(g.players[1]).combat.healUsed=cached.wingBudget||0;
  }
  function home() {
    continuation=null;g.draftQueue=[];g.choices=[];g.players=[];g.coopLayout='solo';selectPilot();g.result=null;
    g.map=null;g.camera=null;g.combat=null;
    g.enemies=[];g.hostile=[];g.drops=[];g.particles=[];g.ghosts=[];g.floaters=[];
    showBase('home');
  }
  function endRun(extracted) {
    if(!g.player||g.screen==='result')return;
    selectPilot();
    const summary=Progress.finish(g.meta,g,extracted)||{};
    g.result={...summary,extracted,stage:g.stage,depth:g.cleared,kills:g.kills,elapsed:g.elapsed,
      data:summary.data??g.dataEarned,reason:extracted?'Beacon extraction complete':'Hull integrity lost'};
    checkpoint=null;forget(SAVE);checkpointSummary();
    g.draftQueue=[];continuation=null;showBase('result',g.result);
  }
  function beginDraft(kind,previous=[],level=null) {
    g.draftKind=kind;g.draftLevel=level;g.choices=Progress.draft(forPilot(g.player),kind,previous,level);
    if(!g.choices?.length){settleDrafts();return;}
    g.sound('reward');showBase('draft',{kind,cards:g.choices});
  }
  function settleDrafts() {
    const owner=g.players.findIndex(p=>forPilot(p).pendingLevels>0);
    if(owner>=0){
      selectPilot(owner);
      const pilot=forPilot(g.player);
      pilot.pendingLevels--;
      beginDraft('level',[],g.player.level-pilot.pendingLevels);
      return;
    }
    if(g.draftQueue?.length){const {owner,kind}=g.draftQueue.shift();selectPilot(owner);beginDraft(kind);return;}
    selectPilot();
    if(continuation) {const action=continuation;continuation=null;action();return;}
    showBase('play');
  }
  function choose(card,index) {
    if(g.screen!=='draft')return false;
    if(typeof card==='number')card=g.choices[card];
    if(!g.choices.includes(card))return false;
    if(Progress.take(forPilot(g.player),card,index)===false)return false;
    g.sound('equip');settleDrafts();return true;
  }
  function reroll() {
    if(g.screen!=='draft'||!g.rerolls)return;
    g.rerolls--;beginDraft(g.draftKind,g.choices,g.draftLevel);
  }
  function salvage(card) {
    if(g.screen!=='draft'||!g.choices.includes(card))return;
    if(Progress.salvage)Progress.salvage(g,card);else g.player.scrap+=6;
    settleDrafts();
  }
  function queueCache(kind){
    g.players.forEach((p,owner)=>g.draftQueue.push({kind,owner}));
  }
  g.sideReward = kind => {
    if(g.screen!=='play')return;
    if(kind==='repair') {for(const p of g.players)if(p.hp>0)p.hp=Math.min(p.maxHp,p.hp+18);g.sound('heal');toast('Field pack recovered · +18 hull');return;}
    queueCache(kind);settleDrafts();
  };
  function collect(drop,recipient) {
    for(const p of g.players){
      if(drop.xp)Progress.addXP(forPilot(p),drop.xp);
      p.scrap+=(drop.scrap||0);
    }
    const p=recipient||g.players.filter(p=>p.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(drop.heal&&p){p.hp=Math.min(p.maxHp,p.hp+drop.heal);float(p.x,p.y-16,'+'+drop.heal+' HULL','#8cf0b9');g.sound('heal');}
  }
  g.completeRoom = () => {
    if(g.screen!=='play'||g.roomDone)return;
    g.roomDone=true;g.hostile=[];g.drops.forEach(d=>collect(d));g.drops=[];
    for(const p of g.players){if(p.hp<=0)revive(p);Progress.onObjective?.(forPilot(p));}g.sound('gate');
    if(g.room<3) {
      if(g.room===0)queueCache('gun');
      if(g.room===1)queueCache(g.stage===1||g.stage%2===0?'active':'armor');
      if(g.room===2 && (g.stage%2===0||g.stage===3))queueCache(g.stage===3?'armor':'gun');
      continuation=()=>{saveAt('junction');showBase('junction');};
    } else {
      g.cleared=g.stage;
      for(const p of g.players)Progress.onGate?.(forPilot(p));
      g.dataEarned+=(Progress.bankGate(g.meta,g)||0);
      const beacon=g.stage>=5||g.expeditionMode==='endless';
      if(beacon)g.routeOptions=Progress.routes(g);
      if(g.stage===1)queueCache('gun');
      if(g.route?.reward)queueCache(g.route.reward);
      continuation=()=>{const screen=beacon?'routes':'junction';saveAt(screen);showBase(screen);};
    }
    settleDrafts();
  };
  function next() {
    if(g.screen!=='junction')return;
    if(g.room<3)g.room++;
    else {g.stage++;g.mapId=g.stage-1;g.room=0;g.rerolls=1;g.route=null;}
    enterRoom(true);
  }
  function route(index) {
    if(g.screen!=='routes'||!g.routeOptions[index])return;
    g.route=g.routeOptions[index];g.stage++;g.mapId=g.route.mapId;g.room=0;g.rerolls=1;
    enterRoom(true);
  }
  function extract() {if(g.screen==='routes'&&(g.cleared>=5||g.expeditionMode==='endless'&&g.cleared>=1))endRun(true);}
  function repair() {
    if(!g.safeRefit||!g.player||!Progress.repair(g))return;
    g.sound('heal');refreshSafe();
  }
  function refreshSafe() {
    const base=screens[0]||g.screen;
    if(base==='junction'||base==='routes') saveAt(base);
    UI.show(g.screen,g);UI.hud(g);
  }
  function refit(kind,index,slot) {
    if(!g.safeRefit)return false;
    const result=Progress.refit(g,kind,index,slot);refreshSafe();return result;
  }
  function setSetting(key,value) {
    if(!(key in defaults))return;
    g.settings[key]=typeof defaults[key]==='boolean'?!!value:clamp(Number(value)||0,0,1);
    write(OPTIONS,g.settings);
  }
  function buyKit(id) {const result=Progress.unlockKit(g.meta,Number(id)); UI.show(g.screen,g);return result;}
  function pilotMovement(p){
    if(p!==g.players[1])return movement();
    const len=Math.max(1,Math.hypot(wingInput.x,wingInput.y));
    return {x:wingInput.x/len,y:wingInput.y/len};
  }
  function dash(p) {
    if(!p||p.hp<=0||p.dashCharges<1||p.dashTime>0)return;
    const input=pilotMovement(p);let x=input.x,y=input.y;
    if(Math.hypot(x,y)<.05){x=Math.cos(p.a);y=Math.sin(p.a);}
    const norm=Math.hypot(x,y);p.dashX=x/norm;p.dashY=y/norm;
    const longStep=p.dashCharges===2 && p.stats.armorMark==='of the Long Step';
    p.dashCharges--;p.dashTime=.155;p.dashLength=100*(1+(p.stats.dashDistance||0))*(longStep?1.1:1);
    if(p.dashCharges===1)p.dashTimer=0;
    p.invuln=Math.max(p.invuln,.205);p.dodgeCounted=false;Progress.onDodge?.(forPilot(p));
    g.fx(p.x,p.y,'#8ee9db',7);g.sound('dash');
  }
  function action(name,index=0) {
    if(name==='pause'){if(g.screen==='play')open('pause');else back();return;}
    if(name==='inventory'){
      if(g.screen==='inventory')back();
      else if(g.screen==='play'){selectPilot(index);open('inventory');}
      return;
    }
    const p=g.players[index];
    if(g.screen!=='play'||!p||p.hp<=0)return;
    const view=forPilot(p);
    if(name==='dash')dash(p);
    else if(name==='swap')Combat.swap(view);
    else if(name==='reload')Combat.reload(view);
    else if(name==='active1'||name==='active2')Combat.cast(view,name==='active1'?0:1);
    else if(name==='interact')World.interact(view);
  }
  function armAbility(slot,index=0) {
    const p=g.players[index];
    if(g.screen!=='play'||!p||p.hp<=0)return;
    const view=forPilot(p),ab=p.abilities[p.activeSlots[slot]];
    if(!ab)return;
    if([0,1,3,4,5,9,10].includes(ab.id) && ab.cd<=0)view.aimingAbility=slot;
    else action(slot===0?'active1':'active2',index);
  }
  function castArmed(slot,index=0) {
    const p=g.players[index];if(!p||p.hp<=0)return;
    const view=forPilot(p);if(g.screen!=='play'||view.aimingAbility!==slot)return;
    view.aimingAbility=null;aimPlayer(p);Combat.cast(view,slot);
  }
  function movement() {
    let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+padMove.x;
    let y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+padMove.y;
    if(touchMove){x+=touchMove.dx/40;y+=touchMove.dy/40;}
    const mag=Math.hypot(x,y);return mag>1?{x:x/mag,y:y/mag}:{x,y};
  }
  function canvasPoint(event) {
    const b=canvas.getBoundingClientRect();
    return {x:(event.clientX-b.left)*W/b.width,y:(event.clientY-b.top)*H/b.height};
  }
  function captureFire(on) {
    if(on&&!heldFire)pressed=true;if(!on&&heldFire)released=true;heldFire=on;
  }
  canvas.addEventListener('pointerdown',e=>{
    if(g.screen!=='play')return;
    RelayAudio.unlock();canvas.setPointerCapture?.(e.pointerId);
    const pos=canvasPoint(e);
    if(e.pointerType==='touch') {
      e.preventDefault();aiming='touch';
      const stick={id:e.pointerId,ox:pos.x,oy:pos.y,dx:0,dy:0};
      if(pos.x<W*.5&&!touchMove)touchMove=stick;
      else if(!touchAim){touchAim=stick;const p=g.player,at=RelayCamera.worldPoint(g,pos.x,pos.y),mag=Math.hypot(at.x-p.x,at.y-p.y)||1;aimVector={x:(at.x-p.x)/mag,y:(at.y-p.y)/mag};captureFire(true);}
      pointers.set(e.pointerId,stick);
    } else if(e.button===0){aiming='mouse';lastPointer=pos;captureFire(true);}
    else if(e.button===2)action('dash');
  });
  canvas.addEventListener('pointermove',e=>{
    const pos=canvasPoint(e);
    if(e.pointerType!=='touch'){if(g.screen==='play'){aiming='mouse';lastPointer=pos;}return;}
    const s=pointers.get(e.pointerId);if(!s)return;
    const x=pos.x-s.ox,y=pos.y-s.oy,mag=Math.hypot(x,y),v=Math.min(1,47/(mag||1));
    s.dx=x*v;s.dy=y*v;
    if(s===touchAim&&mag>4)aimVector={x:x/mag,y:y/mag};
  });
  for(const pad of document.querySelectorAll('[data-stick]')){
    const move=pad.dataset.stick==='move', knob=pad.querySelector('i');
    function updatePad(e,s){
      const bounds=pad.getBoundingClientRect();
      const x=e.clientX-bounds.left-bounds.width/2,y=e.clientY-bounds.top-bounds.height/2;
      const limit=Math.max(1,bounds.width*.34),length=Math.hypot(x,y),scale=Math.min(1,limit/(length||1));
      s.dx=40*x*scale/limit;s.dy=40*y*scale/limit;
      knob.style.transform='translate('+x*scale+'px,'+y*scale+'px)';
      if(!move&&length>3)aimVector={x:x/length,y:y/length};
    }
    pad.addEventListener('pointerdown',e=>{
      if(g.screen!=='play'||(move?touchMove:touchAim))return;
      e.preventDefault();RelayAudio.unlock();pad.setPointerCapture(e.pointerId);
      const s={id:e.pointerId,dx:0,dy:0,pad};
      pointers.set(e.pointerId,s);aiming='touch';
      if(move)touchMove=s;
      else{touchAim=s;captureFire(true);}
      updatePad(e,s);
    });
    pad.addEventListener('pointermove',e=>{
      const s=pointers.get(e.pointerId);if(s?.pad===pad)updatePad(e,s);
    });
    pad.addEventListener('lostpointercapture',e=>{if(pointers.get(e.pointerId)?.pad===pad)pointerEnd(e)});
  }
  function pointerEnd(e) {
    const pad=pointers.get(e.pointerId)?.pad;
    if(pad)pad.querySelector('i').style.transform='';
    if(e.pointerType==='touch'||pad){
      if(e.pointerId===touchMove?.id)touchMove=null;
      if(e.pointerId===touchAim?.id){touchAim=null;captureFire(false);}
      pointers.delete(e.pointerId);
    }else if(e.button===0 || e.type==='pointercancel')captureFire(false);
  }
  window.addEventListener('pointerup',pointerEnd);window.addEventListener('pointercancel',pointerEnd);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let lastWheel=-Infinity;
  canvas.addEventListener('wheel',e=>{if(g.screen==='play'){e.preventDefault();if(e.timeStamp-lastWheel>220){lastWheel=e.timeStamp;action('swap');}}},{passive:false});
  const bindings={Space:'dash',KeyQ:'active1',KeyE:'active2',KeyF:'interact',KeyR:'reload',Tab:'swap',KeyI:'inventory',Escape:'pause',KeyP:'pause'};
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    RelayAudio.unlock();
    if(g.screen!=='play'){
      if(e.code==='Escape'){e.preventDefault();if(!e.repeat)back();}
      else if(e.code==='KeyI'&&g.screen==='inventory'){e.preventDefault();if(!e.repeat)back();}
      return;
    }
    if(e.code.startsWith('Arrow')||bindings[e.code])e.preventDefault();
    keys.add(e.code);
    if(!e.repeat&&e.code==='KeyQ')armAbility(0);
    else if(!e.repeat&&e.code==='KeyE')armAbility(1);
    else if(!e.repeat&&bindings[e.code])action(bindings[e.code]);
  });
  window.addEventListener('keyup',e=>{
    keys.delete(e.code);
    if(e.code==='KeyQ')castArmed(0);
    if(e.code==='KeyE')castArmed(1);
  });
  const pauseOnBlur=()=>{if(g.screen==='play')open('pause');releaseControls();};
  window.addEventListener('blur',pauseOnBlur);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnBlur();});
  document.addEventListener('pointerdown',RelayAudio.unlock,{once:true});

  function menuPad(dx,dy) {
    document.body.classList.add('pad-nav');
    const modal=document.getElementById('scrim');
    const scope=modal&&!modal.hidden?modal:document;
    const nodes=Array.from(scope.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
      .filter(el=>el.offsetWidth>0&&el.offsetHeight>0&&!el.closest('[inert]')&&getComputedStyle(el).visibility!=='hidden');
    if(!nodes.length)return;
    const active=document.activeElement;
    if(!nodes.includes(active)){
      const primary=scope.querySelector('.primary:enabled');
      (nodes.includes(primary)?primary:nodes[0]).focus();return;
    }
    const a=active.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;
    let best=null,score=Infinity;
    for(const node of nodes) {
      if(node===active)continue;
      const b=node.getBoundingClientRect(),x=b.left+b.width/2-ax,y=b.top+b.height/2-ay;
      const dot=x*dx+y*dy;if(dot<3)continue;
      const cost=dot+Math.abs(x*dy-y*dx)*3;
      if(cost<score){score=cost;best=node;}
    }
    if(!best){
      const index=nodes.indexOf(active),step=(dy||dx)>0?1:-1;
      best=nodes[index+step];
    }
    best?.focus();
  }
  const padHooks={
    input(index,state){
      const aimLength=Math.hypot(state.aimX,state.aimY);
      if(index===1){
        Object.assign(wingInput,{x:state.moveX,y:state.moveY,fire:state.fire});
        wingInput.pressed||=state.firePressed;wingInput.released||=state.fireReleased;
        if(aimLength){wingInput.aimX=state.aimX/aimLength;wingInput.aimY=state.aimY/aimLength;}
      }else{
        padMove={x:state.moveX,y:state.moveY};padFire=state.fire;
        pressed||=state.firePressed;released||=state.fireReleased;
        if(aimLength){aiming='pad';aimVector={x:state.aimX/aimLength,y:state.aimY/aimLength};}
        if(state.firePressed){aiming='pad';RelayAudio.unlock();}
      }
    },
    action:(i,name)=>action(name,i),
    ability:(i,slot,held)=>held?armAbility(slot,i):castArmed(slot,i),
    disconnect(i){if(g.screen==='play')open('pause');toast('Pilot '+(i+1)+' controller disconnected. Reconnect, then resume.');},
    menuMove:menuPad,
    menuBack:()=>UI.back(),
    menuAccept(){
      RelayAudio.unlock();
      const active=document.activeElement;
      if(active?.matches('button,input,select')&&active.offsetWidth&&!active.disabled&&!active.closest('[inert]'))active.click();
      else menuPad(0,1);
    }
  };
  function pollPad(){CrewInput.poll(g,padHooks);}
  function aimPlayer(p) {
    const wing=p===g.players[1],view=forPilot(p),aim=view.aim;
    if(!wing&&aiming==='mouse')Object.assign(aim,RelayCamera.worldPoint(g,lastPointer.x,lastPointer.y));
    else {
      let a=wing?Math.atan2(wingInput.aimY,wingInput.aimX):Math.atan2(aimVector.y,aimVector.x);
      let dist=280,best=Infinity,bestAngle=a;
      const assist=g.settings.assist;
      if(assist>0)for(const e of g.enemies) {
        if(e.dead||e.arrive>0)continue;
        const ex=e.x-p.x,ey=e.y-p.y,squared=ex*ex+ey*ey;
        if(g.map.lab&&squared>340*340)continue;
        const angle=Math.atan2(ey,ex),delta=Math.abs(angle-a);
        const offset=Math.min(delta,Math.PI*2-delta);
        if(offset>=.07+.23*assist)continue;
        const d=Math.sqrt(squared),rank=offset+d/20000;
        if(rank<best&&(!g.map.lab||Sight.line(g.map.lab,p.x,p.y,e.x,e.y))){best=rank;dist=d;bestAngle=angle;}
      }
      if(best<Infinity)a+=Math.atan2(Math.sin(bestAngle-a),Math.cos(bestAngle-a))*Math.min(1,assist*1.5);
      aim.x=clamp(p.x+Math.cos(a)*dist,1,g.worldW-1);aim.y=clamp(p.y+Math.sin(a)*dist,1,g.worldH-1);
    }
    const dx=aim.x-p.x,dy=aim.y-p.y;
    if(Math.abs(dx)+Math.abs(dy)>.02)p.a=Math.atan2(dy,dx);
  }
  function pickupStep(dt) {
    const live=g.players.filter(p=>p.hp>0);
    if(!live.length)return;
    let kept=0;
    for(const d of g.drops) {
      let p=live[0];
      if(live.length===2){
        const q=live[1];
        if((q.x-d.x)**2+(q.y-d.y)**2<=(p.x-d.x)**2+(p.y-d.y)**2)p=q;
      }
      const magnet=62*(1+(p.stats.pickup||0));
      d.age+=dt;const dx=p.x-d.x,dy=p.y-d.y,dist=Math.hypot(dx,dy);
      if(dist<12 || d.age>12&&!d.heal){collect(d,p);continue;}
      if(dist<magnet||d.age>5.5&&!d.heal){
        const mult=Math.min(1,dt*(105+(magnet-Math.min(magnet,dist))*2.6)/Math.max(.1,dist));
        d.x+=dx*mult;d.y+=dy*mult;
      }
      g.drops[kept++]=d;
    }
    g.drops.length=kept;
  }
  function stepPilot(p,dt) {
    const view=forPilot(p),s=p.stats,wing=p===g.players[1];
    p.invuln=Math.max(0,p.invuln-dt);p.flash=Math.max(0,p.flash-dt);
    const recharge=3.5/Math.max(.45,1+(s.dashRecovery||0));
    p.dashRecharge=recharge;
    if(p.dashCharges<2){p.dashTimer+=dt;if(p.dashTimer>=recharge){p.dashTimer-=recharge;p.dashCharges++;}}
    else p.dashTimer=0;
    if(g.time-p.lastHit>Math.max(1,6-(s.shieldDelay||0)))p.shield=Math.min(p.maxShield,p.shield+dt*5.4*(1+(s.shieldRate||0)));
    const m=pilotMovement(p);aimPlayer(p);
    p.moving=Math.hypot(m.x,m.y)>.04;
    p.moveX=m.x;p.moveY=m.y;
    if(p.dashTime>0){
      const travel=Math.min(dt,p.dashTime)*p.dashLength/.155;
      g.move(p,p.dashX*travel,p.dashY*travel);p.dashTime=Math.max(0,p.dashTime-dt);
      if(frame%2===0 && g.ghosts.length<18)g.ghosts.push({x:p.x,y:p.y,a:p.a,t:.16,p});
      if(!p.dodgeCounted && g.hostile.some(b=>!b.dead&&Math.hypot((b.x??-999)-p.x,(b.y??-999)-p.y)<27)){
        p.dodgeCounted=true;Progress.onNearMiss?.(view);p.lastCleanDodge=g.time;
      }
    }else{
      const speed=155*Math.max(.45,1+(s.move||0))*(p.combatMove||1);
      g.move(p,m.x*speed*dt,m.y*speed*dt);
      if(p.moving)p.walkCycle+=dt*10;
    }
    const input={fire:wing?wingInput.fire:heldFire||padFire,firePressed:wing?wingInput.pressed:pressed,
      fireReleased:wing?wingInput.released:released,moveX:m.x,moveY:m.y};
    Combat.update(view,dt,input,false);
  }
  function revive(p){
    p.hp=Math.max(1,Math.ceil(p.maxHp*.35));p.shield=0;p.downed=false;p.revive=0;
    p.invuln=2;p.lastHit=g.time;p.dashCharges=Math.max(1,p.dashCharges);
    g.fx(p.x,p.y,'#86eee3',18);float(p.x,p.y-18,'REVIVED','#a5fff0');g.sound('heal');
  }
  function step(dt) {
    if(g.screen!=='play')return;
    g.time+=dt;g.elapsed+=dt;g.introTime=Math.max(0,(g.introTime||0)-dt);
    g.noticeTime=Math.max(0,(g.noticeTime||0)-dt);
    Combat.updateStatuses(g,dt);
    for(const p of g.players){
      if(p.hp>0)stepPilot(p,dt);
      else if(crewed()){
        Combat.update(forPilot(p),dt,{fire:false,moveX:0,moveY:0},false);
        const mate=g.players.find(other=>other!==p&&other.hp>0);
        p.revive=mate&&Math.hypot(mate.x-p.x,mate.y-p.y)<=42?(p.revive||0)+dt:0;
        if(p.revive>=2)revive(p);
      }
      if(g.screen!=='play')return;
    }
    pressed=false;released=false;wingInput.pressed=false;wingInput.released=false;
    if(g.screen!=='play')return;
    Foes.update(g,dt);
    if(g.screen!=='play')return;
    for(const e of g.enemies){e.pushFatigue=Math.max(0,(e.pushFatigue||0)-dt*.9);}
    g.enemies=g.enemies.filter(e=>!e.dead&&e.hp>0);
    pickupStep(dt);World.update(g,dt);
    if(g.screen!=='play')return;
    const drag=Math.exp(-dt*4);
    for(const f of g.particles){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=drag;f.vy*=drag;f.life-=dt;}
    g.particles=g.particles.filter(f=>f.life>0);
    for(const f of g.floaters){f.y-=dt*17;f.t-=dt;}
    g.floaters=g.floaters.filter(f=>f.t>0);
    for(const ghost of g.ghosts)ghost.t-=dt;
    g.ghosts=g.ghosts.filter(o=>o.t>0);
    g.hurtTint=Math.max(0,g.hurtTint-dt);g.shakePower=Math.max(0,g.shakePower-dt*13);
    if(g.players.some(p=>forPilot(p).pendingLevels>0))settleDrafts();
    else saveLabIfReady();
  }
  function drawDrops() {
    const t=g.time;
    for(const d of g.drops){
      const x=Math.round(d.x),y=Math.round(d.y),bob=Math.round(Math.sin(t*4+x)*1.4);
      ctx.fillStyle='#0c181e99';ctx.fillRect(x-4,y+3,8,2);
      if(d.type==='repair'){
        ctx.fillStyle='#284a41';ctx.fillRect(x-6,y-5+bob,12,9);
        ctx.fillStyle='#a1e3bc';ctx.fillRect(x-4,y-4+bob,8,6);
        ctx.fillStyle='#376652';ctx.fillRect(x-1,y-4+bob,2,6);ctx.fillRect(x-3,y-2+bob,6,2);
      }else {
        const size=d.type==='core'?7:d.scrap?4:3;
        ctx.save();ctx.translate(x,y+bob);ctx.rotate(Math.PI/4);
        ctx.fillStyle=d.scrap?'#69452b':'#235555';ctx.fillRect(-size-1,-size-1,size*2+2,size*2+2);
        ctx.fillStyle=d.scrap?'#f6bb69':'#73cbbc';ctx.fillRect(-size,-size,size*2,size*2);
        ctx.fillStyle='#e1f4d7';ctx.fillRect(-size,-size,size,1);ctx.restore();
      }
    }
  }
  function drawReticle(p){
    if(g.screen!=='play'||p.hp<=0)return;
    const view=forPilot(p),gun=Combat.currentGun?.(view),x=Math.round(view.aim.x)+.5,y=Math.round(view.aim.y)+.5;
    const color=gun?.reload>0?'#ffc37d':p===g.players[1]?'#ffb68a':'#c2e9dd';
    const d=4+Math.min(4,gun?.charge||0)*2;
    ctx.save();ctx.translate(x,y);
    function cross(stroke,width){
      ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();
      for(let i=0;i<4;i++){const a=i*Math.PI/2,c=Math.cos(a),s=Math.sin(a);ctx.moveTo(c*d,s*d);ctx.lineTo(c*(d+4),s*(d+4));}ctx.stroke();
    }
    cross('#071b24',3);cross(color,1);ctx.fillStyle='#fff3ce';ctx.fillRect(-.5,-.5,1,1);
    if(gun?.charge>0){ctx.strokeStyle='#ffb565';ctx.beginPath();ctx.arc(0,0,10,-Math.PI*.5,-Math.PI*.5+Math.PI*2*clamp(gun.charge,0,1));ctx.stroke();}
    ctx.restore();
  }
  function drawAbilityAim(p) {
    const view=forPilot(p);
    if(view.aimingAbility==null||p.hp<=0)return;
    const ab=p.abilities[p.activeSlots[view.aimingAbility]];
    if(!ab)return;
    const id=ab.id,color=Combat.abilities[id].color,a=p.a;
    const {x,y}=Combat.targetPoint(view,id===10?135:285);
    const scale=p.overclock==='Tight Orbit'?.85:1;
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color+'1c';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();
    if(id===0||id===5){
      const half=id===0&&ab.augment===1?1.55:id===5?1.04:1;
      ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,(id===0?155:146)*scale,a-half,a+half);ctx.closePath();
    }else if(id===1||id===3){
      const px=id===1?p.x+Math.cos(a)*34:x,py=id===1?p.y+Math.sin(a)*34:y;
      const r=(id===1?53:59)*scale,dx=Math.sin(a)*r,dy=-Math.cos(a)*r;
      ctx.moveTo(px-dx,py-dy);ctx.lineTo(px+dx,py+dy);
      if(id===3&&ab.augment===1){ctx.lineTo(px+Math.cos(a)*r,py+Math.sin(a)*r);ctx.closePath();}
    }else ctx.arc(x,y,(id===4?(ab.augment===2?57:77):id===9?112:17)*scale,0,Math.PI*2);
    ctx.fill();ctx.stroke();ctx.restore();
  }
  function sticks(){
    for(const stick of [touchMove,touchAim])if(stick&&!stick.pad){
      ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#c9e9db80';ctx.fillStyle='#19323855';
      ctx.beginPath();ctx.arc(stick.ox,stick.oy,38,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e6f0d77d';ctx.beginPath();ctx.arc(stick.ox+stick.dx,stick.oy+stick.dy,12,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }
  function roomBrief(){
    const remaining=g.introTime;
    if(!(remaining>0)||g.screen!=='play')return;
    const elapsed=2.9-remaining, t=Math.min(1,elapsed*5,remaining*2);
    const title=g.introTitle,lab=g.map.lab;
    const sub=lab?(g.map.bossRoom?'BOSS VAULT':'EXPLORATION')+'  /  '+lab.rooms.length+' CHAMBERS':'SECTOR ENTRY';
    const touch=matchMedia('(pointer: coarse)').matches;
    const hint=g.stage===1&&g.room===0&&!lab?.key.taken?(touch?'Drag left to move  /  Drag right to fire':aiming==='pad'?'Left stick to move  /  Right stick to aim':'WASD to move  /  Hold left click to fire'):lab?Labyrinth.goal(lab):'';
    ctx.save();ctx.globalAlpha=Math.max(0,t);ctx.translate(45-Math.round(8*(1-t)),432);
    ctx.font='bold 17px Consolas, monospace';
    const titleWidth=ctx.measureText(title).width;
    ctx.font='10px Consolas, monospace';
    const width=Math.max(titleWidth,ctx.measureText(hint).width,148)+22;
    ctx.fillStyle='#101f23e8';ctx.fillRect(0,0,width,hint?55:40);
    ctx.fillStyle=World.maps[g.mapId].accent||'#e4a064';ctx.fillRect(0,0,3,hint?55:40);
    ctx.textAlign='left';ctx.font='bold 8px Consolas, monospace';ctx.fillText(sub,11,11);
    ctx.font='bold 17px Consolas, monospace';ctx.fillStyle='#f4ecd5';ctx.fillText(title,10,31);
    if(hint){ctx.font='10px Consolas, monospace';ctx.fillStyle='#b9d2c7';ctx.fillText(hint,10,46);}
    ctx.restore();
  }
  function renderView(view,actors){
    ctx.save();ctx.beginPath();ctx.rect(view.sx,view.sy,view.sw,view.sh);ctx.clip();
    ctx.translate(view.sx,view.sy);ctx.scale(view.zoom,view.zoom);ctx.translate(-view.x,-view.y);
    if(g.settings.shake && g.shakePower>.2 && g.screen==='play'){
      const a=g.time*73,m=Math.min(3,g.shakePower*.5);ctx.translate(Math.round(Math.cos(a)*m),Math.round(Math.sin(a*1.3)*m));
    }
    World.draw(ctx,g);
    if(g.map.lab)Sight.lightTerrain(ctx,g);
    ctx.save();
    if(g.map.lab)Sight.clip(ctx,g);
    World.drawObjects(ctx,g);
    ctx.save();ctx.globalAlpha=g.settings.friendly;
    for(const p of g.players)Combat.drawBlasts(ctx,forPilot(p));
    ctx.restore();
    Foes.drawWarnings(ctx,g);drawDrops();g.players.forEach(drawAbilityAim);
    for(const gh of g.ghosts){
      ctx.save();ctx.globalAlpha=gh.t*1.6;
      Art.player(ctx,{...gh.p,x:gh.x,y:gh.y,a:gh.a,invuln:0},g.time);ctx.restore();
    }
    for(const e of actors){
      if(e.x<view.x-65||e.x>view.x+view.sw/view.zoom+65||e.y<view.y-65||e.y>view.y+view.sh/view.zoom+65)continue;
      ctx.save();
      const i=g.players.indexOf(e);
      if(i<0)Art.enemy(ctx,e,g.time);
      else {
        if(e.hp<=0)ctx.globalAlpha=.42;
        Art.player(ctx,e,g.time);ctx.globalAlpha=1;
        if(crewed())drawPilotMarker(e,i);
      }
      ctx.restore();
    }
    ctx.save();ctx.globalAlpha=g.settings.friendly;for(const p of g.players)Combat.draw(ctx,forPilot(p));ctx.restore();
    for(const part of g.particles){
      ctx.globalAlpha=Math.min(1,part.life*6)*(.55+.45*g.settings.friendly);ctx.fillStyle=part.color;
      ctx.fillRect(Math.round(part.x),Math.round(part.y),Math.ceil(part.size),Math.ceil(part.size*.72));
    }
    ctx.globalAlpha=1;Foes.drawShots(ctx,g);
    for(const p of g.players)if(p.hp>0){
      ctx.fillStyle='#122129';ctx.fillRect(Math.round(p.x)-2,Math.round(p.y)-2,5,5);
      ctx.fillStyle=p.invuln>0?'#fff1bc':p===g.players[1]?'#ffc199':'#d4fff0';ctx.fillRect(Math.round(p.x)-1,Math.round(p.y)-1,3,3);
    }
    ctx.textAlign='center';ctx.font='bold 9px Consolas, monospace';
    for(const f of g.floaters){ctx.globalAlpha=Math.min(1,f.t*4);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}
    ctx.globalAlpha=1;
    ctx.restore();
    if(g.map.lab)Sight.shadeTerrain(ctx,g);
    BossTellArt.drawPilotCues(ctx,g,view);
    if(view.pilot===null)g.players.forEach(drawReticle);else drawReticle(g.players[view.pilot]);
    ctx.restore();
  }
  const battleWidths=[960,768,640];
  let resolutionStep=0,slowSeconds=0,recoverySeconds=0;
  function adaptResolution(dt){
    const busy=g.enemies.length>=20||g.hostile.length>=55;
    if(!g.settings.adaptiveResolution){
      resolutionStep=0;slowSeconds=0;recoverySeconds=0;
    }else if(dt>0){
      const late=dt>1/52;
      slowSeconds=busy&&late?slowSeconds+dt:Math.max(0,slowSeconds-dt*.45);
      recoverySeconds=!busy||dt<1/80?recoverySeconds+dt:0;
      if(slowSeconds>=1.5){
        resolutionStep=Math.min(battleWidths.length-1,resolutionStep+1);
        slowSeconds=0;recoverySeconds=0;
      }else if(recoverySeconds>=(busy?8:2.5)){
        resolutionStep=Math.max(0,resolutionStep-1);
        slowSeconds=0;recoverySeconds=0;
      }
    }
    const width=battleWidths[resolutionStep];
    if(canvas.width!==width){canvas.width=width;canvas.height=width*H/W;}
  }
  function render(){
    if(!g.player||!g.map||!['play','pause','inventory','draft'].includes(g.screen))return;
    const scale=canvas.width/W;
    ctx.save();ctx.setTransform(scale,0,0,scale,0,0);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#0b131a';ctx.fillRect(0,0,W,H);
    if(g.map.lab)Sight.prepare(g);
    const actors=g.enemies.filter(e=>!e.dead).concat(g.players).sort((a,b)=>a.y-b.y);
    for(const view of g.camera.views){
      g.camera.activeView=view;
      renderView(view,actors);
    }
    g.camera.activeView=null;
    if(g.camera.split){
      ctx.fillStyle='#0d1a20';ctx.fillRect(W/2-2,0,4,H);
      ctx.font='bold 10px Consolas, monospace';ctx.textAlign='left';
      for(let i=0;i<2;i++){
        const x=i*W/2+6;
        ctx.fillStyle='#102026';ctx.fillRect(x,6,25,16);
        ctx.fillStyle=i?'#ffab76':'#a4e8d7';ctx.fillText('P'+(i+1),x+6,17);
      }
    }
    if(g.map.lab)Sight.drawMap(ctx,g,{x:W-154,y:8,width:146,height:88});
    if(g.settings.flashes && g.hurtTint>.02){ctx.strokeStyle='rgba(225,95,66,'+g.hurtTint*2.8+')';ctx.lineWidth=10;ctx.strokeRect(0,0,W,H);}
    roomBrief();sticks();
    ctx.restore();
  }
  function drawPilotMarker(p,index){
    const x=Math.round(p.x),y=Math.round(p.y),col=index?'#ffb17b':'#99f1dc';
    ctx.font='bold 8px Consolas, monospace';ctx.textAlign='center';
    ctx.lineWidth=3;ctx.strokeStyle='#12222b';ctx.fillStyle=col;
    const label=p.hp>0?'P'+(index+1):'REVIVE P'+(index+1);
    ctx.strokeText(label,x,y-21);ctx.fillText(label,x,y-21);
    if(p.hp<=0){
      ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2;
      ctx.arc(x,y,15,-Math.PI/2,-Math.PI/2+Math.PI*2*(p.revive||0)/2);ctx.stroke();
    }
  }
  function tick(stamp) {
    const dt=lastTime?Math.min(.07,Math.max(0,(stamp-lastTime)/1000)):0;
    lastTime=stamp;pollPad();
    if(g.screen==='play'){
      adaptResolution(dt);
      const sub=Math.max(1,Math.ceil(dt/(1/60)));
      for(let i=0;i<sub;i++){frame++;step(dt/sub);}
      RelayCamera.update(g,dt);
      if(g.map?.lab&&g.screen==='play'&&aiming==='mouse'&&g.players[0]?.hp>0)aimPlayer(g.players[0]);
      render();
      if(stamp-lastHud>65){lastHud=stamp;UI.hud(g);}
    }
    RelayAudio.update(g);
    requestAnimationFrame(tick);
  }
  function safeCall(method,args,refresh=true){
    if(!g.safeRefit||typeof Progress[method]!=='function')return false;
    const result=Progress[method](g,...args);
    if(refresh)refreshSafe();return result;
  }
  window.Game={
    state:g,start,startCoop:(kit,contract,layout,mode)=>start(kit,contract,layout,mode),inspectPilot,resumeSave,action,choose,reroll,salvage,resume:back,next,extract,route,home,open,back,refit,repair,buyKit,setSetting,
    restart:()=>start(g.kitId,g.contract,g.coopLayout,g.expeditionMode),installChip:(...args)=>safeCall('installChip',args),
    rollAffix:(...args)=>safeCall('rollAffix',args,false),buyAffix:(...args)=>safeCall('buyAffix',args),
    buyContract:id=>{const ok=Progress.unlockContract(g.meta,id);UI.show(g.screen,g);return ok;},
    buySkin:id=>{const ok=Progress.unlockCosmetic(g.meta,Number(id));UI.show(g.screen,g);return ok;},
    setSkin:id=>{if(!g.safeRefit)return false;const ok=Progress.setSkin(g,id);refreshSafe();return ok;}
  };
  const saved=read(SAVE);
  if(saved?.version===1&&saved.player?.guns?.length&&saved.stage>=1&&saved.room>=0&&saved.room<4){
    checkpoint=saved;checkpointSummary();
  }
  UI.init();showBase('home');requestAnimationFrame(tick);
})();
