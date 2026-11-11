(function(){
  'use strict';
  // Load after dungeon and encounter extensions so their defeat cleanup still runs.
  const W=window.OW,G=W.Game.prototype,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const living=p=>p&&!p.downed&&p.hp>0,fallen=p=>p&&(p.downed||p.hp<=0);
  const surface=g=>g.world.isDungeon?g.overworld:g.world;
  const safe=(w,l)=>l&&(l.type==='town'||w.liberated.has(l.id))&&!w.isLocationLocked?.(l);
  const identity=['id','type','name','level','region','boss','bossIndex','bossId','finalBoss','dungeonBoss','guardian','kraken','color','homeX','homeY','x','y','maxHp','damage','speed','range','fireRate','xp','radius','role','elite','hpMultiplier','locationId','questTargetId','ephemeral','missionTarget','encounterOwner','encounterWave','encounterSurvival','turret','summonerId','guardianOwner','regionScaleApplied','regionHealthScale','regionDamage','patrol','variant'];

  function resetEnemy(e,w){
    if(!e||e.dead||e.hp<=0||w?.dead?.has(e.id))return;
    const keep={};for(const key of identity)if(e[key]!==undefined)keep[key]=e[key];
    for(const key of Object.keys(e))delete e[key];
    Object.assign(e,keep,{hp:keep.maxHp,dead:false,x:Number.isFinite(keep.homeX)?keep.homeX:keep.x,y:Number.isFinite(keep.homeY)?keep.homeY:keep.y,state:'patrol',anim:'idle',animTime:0,angle:0,alert:0,hit:0,velocityX:0,velocityY:0,attackTimer:1,fireTimer:1,specialTimer:1.5,phase:1,bossCycle:0,cycle:0,cooldown:1.5,guardianRecovery:!!keep.dungeonBoss,windup:null,specialMove:null,combatAction:null,combatState:null,comboMoves:[],charging:0,jumpHeight:0,burn:0,bleed:0,poison:0,stun:0,freeze:0});
  }
  function resetWorld(w){
    if(!w)return;
    // Summons belong to the failed attempt; removing them grants no kills or loot.
    const summoned=e=>e&&(e.guardianOwner||e.summonerId),seen=new Set();
    const reset=e=>{if(!e||seen.has(e))return;seen.add(e);resetEnemy(e,w);};
    w.activeEnemies=(w.activeEnemies||[]).filter(e=>!summoned(e));
    for(const map of [w._active,w._dormant])if(map)for(const [id,e]of map){if(summoned(e))map.delete(id);else reset(e);}
    for(const e of w.activeEnemies)reset(e);
    w._streamTimer=0;w._lastPlayerCells='';w._rebuildEnemyGrid?.();
  }
  G.clearPlayerCombat=function(p){
    for(const key of ['poisonTime','poisonTick','poisonDamage','slowTime','jamTime','burn','bleed','stun','freeze','reloading','dodgeTime','dodgeX','dodgeY','meleeCommit','charge','heat','overheat','spin','recoil','velocityX','velocityY','combo','comboTime','shieldTime','smokeTime','rageTime','aegisTime','mirrorWardTime','overdriveTime'])p[key]=0;
    p.meleeStrike=null;p.burstQueue=[];p.revive=0;p.reviveTarget=null;p.shootWasDown=false;p.harpoonPull=null;p.harpoonPullImmuneUntil=0;
  };
  G.checkpointLocation=function(){
    const w=surface(this);if(!w)return null;
    let l=w.getLocation(this.checkpoint?.locationId);
    if(!safe(w,l)){
      // Old saves have no travel history. A discovered refuge is a safe migration
      // fallback; subsequent visits replace it with an explicit checkpoint.
      const p=this.world.isDungeon?this.dungeonReturn?.[0]:this.players[0],known=w.locations.filter(l=>safe(w,l)&&w.discovered.has(l.id));
      l=known.sort((a,b)=>dist(p||w.start,a)-dist(p||w.start,b))[0]||w.getLocation('town_0')||w.locations.find(l=>safe(w,l));
      this.checkpoint=l?{version:1,locationId:l.id}:null;
    }
    return l;
  };
  G.activateCheckpoint=function(location,announce=true){
    const w=surface(this),l=typeof location==='string'?w?.getLocation(location):location;
    if(!w||!safe(w,l)||this.checkpoint?.locationId===l.id)return false;
    this.checkpoint={version:1,locationId:l.id};
    if(announce){this.ui.toast('CHECKPOINT · '+l.name+' · your team will return here if everyone falls.','quest');this.audio.play('heal');}
    this.save(false);return true;
  };
  G.updateCheckpoints=function(){
    if(this.world.isDungeon)return;
    const w=this.world,heroes=this.players.filter(living),near=w.locations.filter(l=>safe(w,l)&&heroes.some(p=>dist(p,l)<Math.min(340,(l.radius||250)+30)));
    const previous=this._checkpointInside||new Set(),arrived=near.filter(l=>!previous.has(l.id));
    this._checkpointInside=new Set(near.map(l=>l.id));
    if(!arrived.length)return;
    arrived.sort((a,b)=>Math.min(...heroes.map(p=>dist(p,a)))-Math.min(...heroes.map(p=>dist(p,b))));
    this.activateCheckpoint(arrived[0]);
  };
  G.resetCheckpointCombat=function(){
    resetWorld(this.world);if(this.overworld)resetWorld(this.overworld);
    for(const [id,state]of Object.entries(this.dungeonStates||{})){
      // Guardian attack cycles restart at zero. Retire their temporary brood IDs
      // too, otherwise a previous attempt's kill ledger suppresses fresh summons.
      if(!state.bossDead)for(const dead of surface(this).dead)if(dead.startsWith(id+'_guardian_brood_'))surface(this).dead.delete(dead);
      state.enemies=(state.enemies||[]).filter(e=>!e.guardianOwner&&!e.summonerId&&!(state.bossDead&&e.dungeonBoss));
      for(const e of state.enemies)resetEnemy(e,surface(this));
      for(const e of state.survival?.records||[])resetEnemy(e,surface(this));
    }
    for(const run of Object.values(this.encounterRuns||{}))for(const e of run.records||[])resetEnemy(e,surface(this));
  };
  G.respawnAtCheckpoint=function(){
    if(!this.players.length||!this.players.every(fallen))return false;
    const l=this.checkpointLocation()||{...this.world.start,name:'Resistance camp'};
    for(const [i,p]of this.players.entries()){
      this.clearPlayerCombat(p);p.x=l.x+i*50;p.y=l.y+100;this.restorePlayerPosition(p);
      p.hp=p.maxHp;p.downed=false;p.anim='idle';p.animTime=0;p.gold=Math.floor(p.gold*.95);p.ammo=this.weapon(p).magazine||12;p.reserve=Math.max(p.reserve||0,120);p.invuln=4;p.lastHit=this.time;
    }
    this.bulletPool.reset();this.effectPool.reset();this.particlePool.reset();this.grid.clear();this.allies=[];
    this.pendingReward=null;this.travelInteractUntil=this.time+1;this.audio.resetAnimals?.();this.input.clear?.();
    this.world._streamTimer=0;this.world.updateActive(this.players,1,this);this.renderer.chunks?.clear();
    this.camera.x=this.players[0].x;this.camera.y=this.players[0].y;this.camera.shake=0;this.camera.zoom=1;
    this._checkpointInside=new Set(l.id?[l.id]:[]);this.ui.hideMenu();
    this.ui.toast('Rescued at checkpoint: '+l.name+' · enemies recovered · 5% gold used for rescue supplies.','event');
    this.save(false);return true;
  };
  const defeat=G.defeat;G.defeat=function(){
    if(!this.players.length||!this.players.every(fallen))return false;
    this.checkpointLocation();this.resetCheckpointCombat();return defeat.call(this);
  };
  const locations=G.updateLocations;G.updateLocations=function(...args){const result=locations.apply(this,args);this.updateCheckpoints();return result;};
  const travel=G.fastTravel;G.fastTravel=function(id){if(this.players.some(fallen)){this.ui.toast('Revive your teammate before travelling.','error');return false;}const ok=travel.call(this,id);if(ok){this.activateCheckpoint(id);this._checkpointInside=new Set([id]);}return ok;};
  const snapshot=G.snapshot;G.snapshot=function(){this.checkpointLocation();return{...snapshot.call(this),checkpoint:this.checkpoint?{...this.checkpoint}:null};};
  const start=G.start;G.start=function(options={}){if(options.load)return start.call(this,options);this.checkpoint=null;this._checkpointInside=new Set();const result=start.call(this,options);this.checkpointLocation();this.updateCheckpoints();return result;};
  const load=G.load;G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;
    const previous=this.checkpoint,inside=this._checkpointInside;let ok;
    this.checkpoint=data.checkpoint&&typeof data.checkpoint.locationId==='string'?{version:1,locationId:data.checkpoint.locationId}:null;
    this._checkpointInside=new Set();try{ok=load.call(this,slot);}finally{if(!ok){this.checkpoint=previous;this._checkpointInside=inside;}}if(!ok)return false;
    this.checkpointLocation();
    for(const [i,p]of this.players.entries()){
      const saved=data.players[i];p.downed=!!saved.downed||saved.hp<=0;
      if(p.downed){this.clearPlayerCombat(p);p.hp=0;p.anim='death';p.animTime=0;}
      else{p.revive=0;p.reviveTarget=null;}
    }
    if(this.players.every(fallen))this.defeat();
    else if(this.players.some(fallen))this.ui.toast('Teammate down · approach and press E / B, then stay close to revive.','quest');
    return true;
  };
  const damage=G.damagePlayer;G.damagePlayer=function(p,...args){
    const before=p.hp,result=damage.call(this,p,...args);
    if(p.hp<before&&p.reviveTarget!=null){const q=this.players.find(q=>q.id===p.reviveTarget);if(q)q.revive=0;p.reviveTarget=null;}
    if(p.downed){this.clearPlayerCombat(p);for(const q of this.players)if(q.reviveTarget===p.id&&q.downed)q.reviveTarget=null;}
    return result;
  };
  const updatePlayer=G.updatePlayer;G.updatePlayer=function(p,input,dt){
    // Venom projectiles apply their status after dealing the fatal hit. Clear
    // that delayed status without erasing a teammate's ongoing revive progress.
    if(p.downed){p.poisonTime=0;p.poisonTick=0;p.poisonDamage=0;p.slowTime=0;p.jamTime=0;}
    if(p.reviveTarget!=null&&(p.harpoonPull||Math.hypot(input?.mx||0,input?.my||0)>.2||input?.dodge||input?.shoot||input?.melee)){
      const q=this.players.find(q=>q.id===p.reviveTarget);if(q)q.revive=0;p.reviveTarget=null;
    }
    const down=this.players.filter(fallen),result=updatePlayer.call(this,p,input,dt);
    for(const q of down)if(living(q))this.clearPlayerCombat(q);
    return result;
  };
  const effects=G.updateEffects;G.updateEffects=function(...args){
    const down=this.players.filter(fallen);
    // A beacon can support a surviving partner, but cannot undo a full party wipe.
    if(down.length===this.players.length)for(const effect of this.effects)if(effect.type==='revivalBeacon')effect.alive=false;
    const result=effects.apply(this,args);for(const p of down)if(living(p))this.clearPlayerCombat(p);return result;
  };
  const coop=G.toggleCoop;G.toggleCoop=function(){
    const returning=this.players.length===1&&this.reservePlayer,wasDown=returning&&fallen(returning),result=coop.call(this);
    if(wasDown){const p=this.players[1];this.clearPlayerCombat(p);p.downed=true;p.hp=0;p.anim='death';this.ui.toast('Player 2 is still down · revive them nearby.','quest');this.save(false);}
    return result;
  };
  const actor=W.Renderer.prototype.drawActor;
  W.Renderer.prototype.drawActor=function(e,isPlayer,...args){
    const result=actor.call(this,e,isPlayer,...args),g=this.game;
    if(!isPlayer||!e.downed||g?.players?.length!==2||!g.players.includes(e))return result;
    const helper=g.players.find(p=>p!==e&&living(p)&&dist(p,e)<100),reviving=helper?.reviveTarget===e.id;
    const duration=Math.max(.65,1.6-(helper?.skills?.support||0)*.1),progress=reviving?W.clamp((e.revive||0)/duration,0,1):0;
    const c=this.ctx,x=e.x-79,y=e.y-119,label=reviving?'REVIVING '+Math.floor(progress*100)+'%':helper?'E / B · REVIVE':'TEAMMATE DOWN';
    c.save();c.fillStyle='rgba(12,29,36,.94)';c.fillRect(x,y,158,34);c.strokeStyle=reviving?'#a5efc3':'#e7bd8a';c.lineWidth=1.5;c.strokeRect(x,y,158,34);
    c.font='700 11px system-ui';c.textAlign='center';c.fillStyle=reviving?'#baffd3':'#ffe3b9';c.fillText(label,e.x,y+15);
    c.fillStyle='#304449';c.fillRect(x+7,y+23,144,5);c.fillStyle='#88e7b2';c.fillRect(x+7,y+23,144*progress,5);c.restore();return result;
  };
}());

