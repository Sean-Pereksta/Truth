(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2,copy=o=>JSON.parse(JSON.stringify(o));
  const alive=e=>e&&e.hp>0&&!e.dead,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),quest=id=>typeof id==='object'?id:W.Content.quests.find(q=>q.id===id);
  const isTrial=w=>w?.isDungeon&&w.config.encounter==='survival';
  W.Content.installCampLocations?.(W.World);
  // These compact encounters are tuned to their advertised hero level. The
  // overworld's exponential regional multiplier made late camp chests fall in
  // seconds. Keep ordinary campaign enemies unchanged.
  const enemyDamage=G.enemyDamage;G.enemyDamage=function(e,spec,multiplier=1){const damage=enemyDamage.call(this,e,spec,multiplier);if(!e.encounterOwner||e.boss)return damage;const level=W.Content.regions[e.region]?.level||1;return damage*(1+(level-1)*.035)/W.Content.enemyScaling(e.region).damage;};
  function campText(g,q,r){
    if(r.counterattack&&r.phase==='counterattack')return r.commandDefeated?'Captain defeated · E / B at the command post to disable the battery':'Withdrawal saved · pursue the battery captain, then disable the command post';
    if(r.counterattack&&r.phase==='fighting')return'Hold the ridge · '+Math.ceil(Math.max(0,q.holdDuration-(r.holdElapsed||0)))+'s remaining'+(livingPlayers(g).some(p=>dist(p,r)<230)?'':' · PAUSED: return to the ridge')+' · supplies '+Math.ceil(r.hp/r.maxHp*100)+'%';
    return'Wave '+r.wave+' / '+q.waveCount+' · '+(r.phase==='between'?'next wave in '+Math.ceil(r.countdown)+'s · supplies repairing':(r.remaining??r.enemyIds.length)+' enemies remaining')+' · supplies '+Math.ceil(r.hp/r.maxHp*100)+'% · no kill timer';
  }
  function trialState(w){return w.state.survival||(w.state.survival={phase:w.state.solved?'cleared':'ready',wave:0,countdown:0,enemyIds:[],records:[],attempt:0});}
  function livingPlayers(g){return g.players.filter(p=>!p.downed&&p.hp>0);}
  function removeEncounterEnemies(g,owner){const world=g.world;world.activeEnemies=world.activeEnemies.filter(e=>{if(e.encounterOwner!==owner)return true;world._active?.delete(e.id);world._dormant?.delete(e.id);return false;});world._rebuildEnemyGrid();}
  function clearPoint(g,x,y,r=24,origin=null){const valid=p=>!g.world.isBlocked(p.x,p.y,r)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y)&&(!origin||!g.world._navigationRay||g.world._navigationRay(origin.x,origin.y,p.x,p.y,18));if(valid({x,y}))return{x,y};for(let radius=40;radius<=400;radius+=40)for(let i=0;i<20;i++){const a=i*TAU/20,p={x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius};if(valid(p))return p;}return null;}
  function waveRoles(region,wave,survival){return survival?(region<3?[2,24,36,38]:region<6?[24,36,37,38,40,41]:[36,37,38,39,40,41,42,43]):region<2?[0,1,3]:region<5?[0,3,11,14]:[3,11,18,14];}
  function spawnWave(g,run,options){
    const authored=quest(options.owner)?.wavePlan?.[run.wave-1],lineup=authored?[...authored.types,...(g.players.length>1?authored.coopTypes||[]:[])]:null;
    const count=lineup?lineup.length:Math.min(8,3+run.wave+(options.region>=4?1:0)),types=waveRoles(options.region,run.wave,options.survival),records=[];
    if(g.world.activeEnemies.filter(alive).length+count>W.config.maxEnemies){run.phase='between';run.wave--;run.countdown=2;g.ui.toast('Clear nearby patrols to make room for the next squad.','event');return false;}
    for(let i=0;i<count;i++){
      const a=i*TAU/count+run.wave*.67,desired=options.survival?{x:580+Math.cos(a)*285,y:650+Math.sin(a)*270}:{x:run.x+Math.cos(a)*420,y:run.y+Math.sin(a)*420},point=clearPoint(g,desired.x,desired.y,24,options.survival?{x:580,y:650}:run);
      if(!point)continue;
      const type=lineup?lineup[i]:types[(i+run.wave-1)%types.length],s=W.Content.enemies[type],baseLevel=W.Content.regions[options.region].level,level=baseLevel+(authored?authored.levelBonus||0:run.wave-1),hp=Math.round(s.hp*(1+level*.12)*(1+(baseLevel-1)*.11)*(authored?.healthMultiplier||1));
      const e={id:options.owner+'_attempt_'+(run.attempt||0)+'_wave_'+run.wave+'_'+i,type,name:s.name,...point,homeX:point.x,homeY:point.y,region:options.region,level,hp,maxHp:hp,regionScaleApplied:true,encounterBalanceVersion:2,angle:a+Math.PI,state:'chase',anim:'run',animTime:0,alert:30,ephemeral:true,encounterOwner:options.owner,encounterWave:run.wave,encounterSurvival:!!options.survival};
      records.push(copy(e));
    }
    // A wave never reports complete merely because every suggested spawn was blocked.
    if(!records.length||authored&&records.length!==count){run.phase='between';run.wave--;run.countdown=1;g.ui.toast('Reinforcements are finding a clear approach.','event');return false;}
    for(const e of records){g.world.addEnemy(e);g.effect('reinforcement',e.x,e.y,50,.8);}
    run.phase='fighting';run.enemyIds=records.map(e=>e.id);run.records=records;run.countdown=0;
    run.waveName=authored?.name||null;run.waveBrief=authored?.brief||null;
    g.ui.toast('WAVE '+run.wave+' / '+options.total+(authored?' · '+authored.name:'')+' · '+records.length+' enemies incoming.'+(authored?' '+authored.brief:''),'event');g.save(false);return true;
  }
  function trackWave(g,run,center){
    const active=new Map(g.world.activeEnemies.map(e=>[e.id,e]));
    run.records=(run.records||[]).map(saved=>{const e=active.get(saved.id);return alive(e)?{...e,_steer:null}:saved;});
    const living=[];
    for(const id of run.enemyIds||[]){
      if(g.world.dead.has(id))continue;
      let e=active.get(id);if(!alive(e)){
        const saved=run.records.find(r=>r.id===id);if(!saved||saved.hp<=0)continue;
        // Streaming or reload is not a kill. Restore the recorded combatant.
        e=g.world.addEnemy({...copy(saved),_steer:null});
      }
      living.push(e);
      const moved=Math.hypot(e.x-(e.encounterLastX??e.x),e.y-(e.encounterLastY??e.y));
      // Compare speed, not a fixed per-frame distance. At 25–60 fps a normally
      // walking soldier moves less than five pixels each frame.
      e.encounterStuck=moved<Math.max(.05,(g.encounterDelta||0)*8)?(e.encounterStuck||0)+(g.encounterDelta||0):0;e.encounterLastX=e.x;e.encounterLastY=e.y;
      if(dist(e,center)>1000||g.world.isBlocked(e.x,e.y,18)||e.encounterStuck>9){const a=living.length*2.3,point=clearPoint(g,center.x+Math.cos(a)*260,center.y+Math.sin(a)*230,24,center);if(point){e.x=point.x;e.y=point.y;e.homeX=e.x;e.homeY=e.y;e.encounterStuck=0;e._steer=null;e.alert=20;g.effect('reinforcement',e.x,e.y,45,.6);}}
    }
    run.remaining=living.length;return living.length;
  }
  function campProxy(run){return {type:'escort',campProxy:run.questId,reinforced:run.planVersion>=2,state:'active',x:run.x,y:run.y,hp:run.hp,maxHp:run.maxHp,angle:0,velocityX:0,velocityY:0,smokeTime:0,skills:{},perks:{},stats:{},invuln:0};}
  function withCampTargets(g,fn,args){
    if(g.world?.isDungeon||g._campTargetsActive)return fn.apply(g,args);
    const entries=Object.values(g.encounterRuns||{}).filter(r=>r.state==='active'&&r.phase==='fighting'),proxies=[];
    g._campTargetsActive=true;
    for(const run of entries){const key='__camp_'+run.questId,p=campProxy(run);g.missionRuns[key]=p;proxies.push({key,p,run});}
    try{return fn.apply(g,args);}finally{for(const {key,p,run}of proxies){const loss=run.hp-p.hp;run.hp=Math.max(0,loss>0?run.hp-loss*(run.planVersion>=2?.35:1):p.hp);delete g.missionRuns[key];}g._campTargetsActive=false;}
  }
  for(const method of ['updateEnemies','updateProjectiles','explode']){const original=G[method];G[method]=function(...args){return withCampTargets(this,original,args);};}
  const damagePlayer=G.damagePlayer;G.damagePlayer=function(p,amount,source){if(p.campProxy){p.hp=Math.max(0,p.hp-amount);return;}return damagePlayer.call(this,p,amount,source);};
  const updateEffects=G.updateEffects;G.updateEffects=function(dt){
    if(!this.world.isDungeon)for(const effect of this.effects)if(effect.alive&&effect.type==='meleeWarning'&&effect.life<=dt){const source=this.world.activeEnemies.find(e=>e.id===effect.enemyId);if(alive(source))for(const run of Object.values(this.encounterRuns||{}))if(run.state==='active'&&run.phase==='fighting'&&dist(run,source)<95)run.hp=Math.max(0,run.hp-effect.damage*(run.planVersion>=2?.35:1));}
    return withCampTargets(this,updateEffects,[dt]);
  };
  const accept=G.acceptQuest;G.acceptQuest=function(id){
    const q=quest(id),ok=accept.call(this,id);if(!ok||q?.type!=='campDefense'||this.completedQuests.has(id))return ok;
    this.encounterRuns=this.encounterRuns||{};const previous=this.encounterRuns[id];if(previous?.state==='active')return true;
    removeEncounterEnemies(this,id);const location=this.world.getLocation(q.target);if(!location)return false;
    this.encounterRuns[id]={questId:id,state:'active',phase:'ready',wave:0,countdown:0,enemyIds:[],records:[],x:location.x,y:location.y,hp:q.campHealth,maxHp:q.campHealth,attempt:(previous?.attempt||0)+1,planVersion:2,counterattack:!!q.counterattack,holdElapsed:0,checkpoint:previous?.checkpoint||null};
    if(q.counterattack&&previous?.checkpoint==='counterattack'){const run=this.encounterRuns[id],l=this.world.getLocation(q.commandSite.id);run.x=l.x;run.y=l.y;run.holdElapsed=q.holdDuration;run.resumeCounterattack=true;}
    this.ui.toast('Camp marked. Ring its bell with E / B when you are ready. Protect the supply chest.','quest');this.save(false);return true;
  };
  const enter=G.enterDungeon;G.enterDungeon=function(...args){
    const [entry,restoring]=args;
    if(!restoring&&!this.world.isDungeon&&entry?.type==='cave'&&this.players.every(p=>!p.downed&&dist(p,entry)<=230))for(const run of Object.values(this.encounterRuns||{}))if(run.state==='active'&&run.phase!=='ready')this.failCamp(run,'The camp was abandoned when its defenders descended underground.');
    // enterDungeon saves before it returns. Feed its snapshot the most recent
    // checkpoint so a retreat cannot restore a combatant's earlier health.
    const saved=this.dungeonStates?.[entry?.id];if(saved?.survival?.phase==='fighting'){const latest=new Map((saved.enemies||[]).filter(e=>e.encounterOwner===entry.id).map(e=>[e.id,e]));saved.survival.records=(saved.survival.records||[]).map(e=>copy(latest.get(e.id)||e));}
    const ok=enter.apply(this,args);if(ok&&isTrial(this.world)){const s=trialState(this.world);for(const e of this.world.state.enemies||[])if(e.encounterOwner===this.world.entry.id&&alive(e)&&!this.world.dead.has(e.id)&&!this.world.activeEnemies.some(a=>a.id===e.id))this.world.addEnemy(e);if(s.phase==='fighting'){this.encounterDelta=0;trackWave(this,s,{x:580,y:650});}if(!restoring&&!this.world.state.solved)this.ui.toast('Survival trial · ring the watch altar with E / B to begin '+this.world.config.waveCount+' waves.','quest');}return ok;
  };
  const puzzle=G.puzzleAction;G.puzzleAction=function(...args){if(isTrial(this.world))return false;return puzzle.apply(this,args);};
  const hitProjectile=W.Dungeons.hitProjectile;W.Dungeons.hitProjectile=function(g,b,oldX,oldY){if(isTrial(g.world)&&!g.world.state.solved)return false;return hitProjectile(g,b,oldX,oldY);};
  const solve=G.solveDungeon;G.solveDungeon=function(){if(isTrial(this.world)&&trialState(this.world).phase!=='cleared')return false;return solve.call(this);};
  G.failCamp=function(run,reason){if(run.state!=='active')return;run.state='failed';run.phase='failed';run.failureReason=reason;removeEncounterEnemies(this,run.questId);run.enemyIds=[];run.records=[];this.ui.toast(reason+' Return to the camp bell or accept the mission again to retry.'+(run.checkpoint?' The withdrawal checkpoint is safe.':''),'error');this.save(false);};
  G.beginCampCounterattack=function(run,q){
    removeEncounterEnemies(this,q.id);const site=this.world.getLocation(q.commandSite.id);run.x=site.x;run.y=site.y;run.phase='counterattack';run.checkpoint='counterattack';run.wave=2;run.enemyIds=[];run.records=[];run.commandEnemyId=null;
    if(!spawnWave(this,run,{owner:q.id,region:q.region,total:2}))return false;
    run.phase='counterattack';run.commandEnemyId=run.enemyIds[run.enemyIds.length-1];const commander=this.world.activeEnemies.find(e=>e.id===run.commandEnemyId);if(commander)commander.name='Lantern Battery Captain';
    this.ui.toast('CHECKPOINT · mountaineers evacuated. The raiders withdraw. Pursue the battery captain, then use E / B to disable the command post.','quest');if(this.trackedQuest===q.id)this.marker={x:run.x,y:run.y};this.save(false);return true;
  };
  const travel=G.fastTravel;G.fastTravel=function(...args){const ok=travel.apply(this,args);if(ok)for(const run of Object.values(this.encounterRuns||{}))if(run.state==='active'&&run.phase!=='ready'&&this.players.every(p=>dist(p,run)>800))this.failCamp(run,'The camp was abandoned when its defenders travelled away.');return ok;};
  const updateMissions=G.updateMissions;G.updateMissions=function(dt){updateMissions.call(this,dt);this.updateEncounters(dt);};
  G.updateEncounters=function(dt){
    if(this.paused)return;this.encounterDelta=dt;
    if(isTrial(this.world)){
      const w=this.world,s=trialState(w);if(w.state.solved)return;
      if(s.phase==='ready'){if(livingPlayers(this).some(p=>dist(p,{x:580,y:650})<105))this.interactionPrompt='E / B · begin survival trial';return;}
      if(s.phase==='fighting'&&trackWave(this,s,{x:580,y:650})===0){if(s.wave>=w.config.waveCount){s.phase='cleared';this.solveDungeon();return;}s.phase='between';s.countdown=3;this.ui.toast('Wave cleared. Next wave in 3 seconds.','event');this.save(false);}
      else if(s.phase==='between'){s.countdown=Math.max(0,s.countdown-dt);if(s.countdown===0){s.wave++;spawnWave(this,s,{owner:w.entry.id,region:w.entry.region,total:w.config.waveCount,survival:true});}}
      return;
    }
    if(this.world.isDungeon)return;
    for(const run of Object.values(this.encounterRuns||{})){
      if(run.state!=='active')continue;const q=quest(run.questId),players=livingPlayers(this),nearest=players.length?Math.min(...players.map(p=>dist(p,run))):Infinity;
      if(run.phase==='ready'){if(nearest<110)this.interactionPrompt='E / B · ring camp defense bell';continue;}
      if(run.hp<=0){this.failCamp(run,'The camp supplies were destroyed.');continue;}
      if(!players.length){this.failCamp(run,'The defense fell because every resistance fighter was downed.');continue;}
      if(nearest>1400){this.failCamp(run,'The camp was abandoned during the attack.');continue;}
      if(run.counterattack){
        if(run.phase==='fighting'){
          trackWave(this,run,run);if(nearest<230)run.holdElapsed=Math.min(q.holdDuration,(run.holdElapsed||0)+dt);
          if(run.holdElapsed>=q.holdDuration)this.beginCampCounterattack(run,q);
          continue;
        }
        if(run.phase==='counterattack'){
          trackWave(this,run,run);run.commandDefeated=this.world.dead.has(run.commandEnemyId);
          if(nearest<110)this.interactionPrompt=run.commandDefeated?'E / B · disable battery command':'Defeat the battery captain before disabling the command post';
          continue;
        }
      }
      if(run.phase==='fighting'&&trackWave(this,run,run)===0){
        if(run.wave>=q.waveCount){run.state='complete';run.phase='cleared';this.missionCompleted.add(q.id);this.ui.toast(q.title+' · every wave defeated; camp secured.','quest');this.checkQuests();this.save(false);}
        else{run.phase='between';run.countdown=q.intermission||4;if(run.planVersion>=2){run.hp=Math.min(run.maxHp,run.hp+run.maxHp*.18);for(const p of this.players)if(!p.downed&&dist(p,run)<1400)p.reserve=Math.min(600,p.reserve+60);}const next=q.wavePlan?.[run.wave];this.ui.toast('Camp wave cleared. '+(next?next.name:'Reinforcements')+' arrives in '+run.countdown+' seconds.'+(run.planVersion>=2?' Crews repair 18% supplies and deliver 60 reserve rounds per hero.':'')+(next?' '+next.brief:''),'event');this.save(false);}
      }else if(run.phase==='between'){run.countdown=Math.max(0,run.countdown-dt);if(run.countdown===0){run.wave++;spawnWave(this,run,{owner:q.id,region:q.region,total:q.waveCount});}}
    }
  };
  const interact=G.interact;G.interact=function(p){
    if(this.paused||p.downed)return interact.call(this,p);
    if(this.players.some(q=>q!==p&&q.downed&&dist(p,q)<100))return interact.call(this,p);
    if(isTrial(this.world)&&!this.world.state.solved&&dist(p,{x:580,y:650})<110){const s=trialState(this.world);if(s.phase==='ready'){s.wave=1;s.attempt++;spawnWave(this,s,{owner:this.world.entry.id,region:this.world.entry.region,total:this.world.config.waveCount,survival:true});}else this.ui.toast('WAVE '+s.wave+' / '+this.world.config.waveCount+' · '+(s.remaining??s.enemyIds.length)+' enemies remaining.');return;}
    if(!this.world.isDungeon){
      for(const run of Object.values(this.encounterRuns||{}))if(dist(p,run)<105&&run.state!=='complete'){
        if(run.state==='failed'){this.acceptQuest(run.questId);return;}
        if(run.phase==='ready'){run.wave=1;const q=quest(run.questId);if(run.resumeCounterattack){run.resumeCounterattack=false;this.beginCampCounterattack(run,q);}else spawnWave(this,run,{owner:q.id,region:q.region,total:run.counterattack?2:q.waveCount});return;}
        if(run.counterattack&&run.phase==='counterattack'){if(!this.world.dead.has(run.commandEnemyId)){this.ui.toast('Defeat the battery captain first. The other troops do not block the command switch.','quest');return;}run.state='complete';run.phase='cleared';this.missionCompleted.add(run.questId);removeEncounterEnemies(this,run.questId);this.ui.toast('Battery silenced. Crag’s mountaineers have a safe route to the resistance.','quest');this.checkQuests();this.save(false);return;}
      }
      for(const q of W.Content.quests.filter(q=>q.encounter==='demolition')){const run=this.missionRuns[q.id];if(run?.state!=='active')continue;const remote=this.world.getLocation(q.objectives[3].id);if(remote&&dist(p,remote)<100&&(run.placedCharges||[]).length<3){this.ui.toast('Remote interlock: place all three charges first. '+(run.placedCharges||[]).length+' / 3 armed.','error');return;}}
    }
    return interact.call(this,p);
  };
  const complete=G.operationCompleteTarget;G.operationCompleteTarget=function(q,run,id,p){
    if(q.encounter!=='demolition')return complete.call(this,q,run,id,p);
    const step=q.steps[run.stepIndex];if(!step||run.state!=='active'||!step.targets.includes(id)||run.completedTargets.includes(id))return;
    if(step.action==='plant'){run.placedCharges=run.placedCharges||[];if(!run.placedCharges.includes(id)){run.placedCharges.push(id);this.audio.play('ui');const l=this.world.getLocation(id);if(l)this.effect('impact',l.x,l.y,28,.4);}}
    if(step.action==='detonate'){
      if(run.detonated||id!==q.objectives[3].id||(run.placedCharges||[]).length!==3||!q.objectives.slice(0,3).every(o=>run.placedCharges.includes(o.id)))return;
      run.detonated=true;run.blastTime=this.time;this.ui.toast('REMOTE DETONATION · all three targets destroyed.','quest');
    }
    return complete.call(this,q,run,id,p);
  };
  const progress=G.questProgress;G.questProgress=function(id){const q=quest(id),p=progress.call(this,id);if(q?.type==='campDefense'){p.current=this.encounterRuns?.[q.id]?.state==='complete'?1:0;p.required=1;p.ready=p.current===1;}return p;};
  const target=G.questTarget;G.questTarget=function(q){q=quest(q);if(q&&(!this.acceptedQuests.has(q.id)||this.completedQuests.has(q.id)))return target.call(this,q);if(isTrial(this.world)&&!this.world.state.solved)return{x:580,y:650,label:'Survive the watch altar’s waves'};if(q?.type==='campDefense'){const r=this.encounterRuns?.[q.id],l=r&&r.state!=='complete'?r:this.world.getLocation(q.target);return l?{x:l.x,y:l.y,label:r?.counterattack&&r.phase==='counterattack'?'Pursue and disable battery command':q.title}:null;}return target.call(this,q);};
  const objective=G.questObjectiveText;G.questObjectiveText=function(q){q=quest(q);if(q&&(!this.acceptedQuests.has(q.id)||this.completedQuests.has(q.id)))return objective.call(this,q);if(q?.type==='campDefense'){const r=this.encounterRuns?.[q.id];if(r?.state==='complete')return r.counterattack?'Battery silenced. The mountaineers and their route are safe.':'Camp secured. Every wave defeated.';if(r?.state==='failed')return(r.failureReason||'Camp supplies were lost.')+' Return to its bell or accept the quest again to retry.'+(r.checkpoint?' Withdrawal checkpoint retained.':'');if(!r||r.phase==='ready')return r?.counterattack?'Ring the bell with E / B. Hold the ridge for 18 seconds, then pursue and disable the battery command. Leaving the hold circle pauses progress.':'Ring the camp bell with E / B, then defeat all '+q.waveCount+' waves. No overall kill timer. Protect the reinforced supplies; crews repair them between waves.';return campText(this,q,r)+'.';}if(q?.type==='dungeon'){const d=W.Content.dungeons.find(d=>d.id===q.target),s=this.dungeonStates?.[q.target];if(d?.encounter==='survival'&&!s?.solved)return'Ring the watch altar, then defeat all '+d.waveCount+' waves to open the guardian chamber. No overall kill timer.';}if(q?.encounter==='demolition'){const r=this.missionRuns[q.id];if(r?.detonated)return'All three targets destroyed by remote detonation.';return(r?.placedCharges?.length||0)+' / 3 charges planted. '+((r?.placedCharges?.length||0)===3?'Use the separate remote switch.':'Interact with each marked drive; the remote stays locked until all charges are armed.');}return objective.call(this,q);};
  const snapshot=G.snapshot;G.snapshot=function(){if(isTrial(this.world)&&trialState(this.world).phase==='fighting'){this.encounterDelta=0;trackWave(this,trialState(this.world),{x:580,y:650});}else if(!this.world.isDungeon)for(const r of Object.values(this.encounterRuns||{}))if(r.state==='active'&&['fighting','counterattack'].includes(r.phase)){this.encounterDelta=0;trackWave(this,r,r);}const data=snapshot.call(this);data.encounterRuns=copy(this.encounterRuns||{});data.missionRuns=Object.fromEntries(Object.entries(data.missionRuns||{}).filter(([id])=>!id.startsWith('__camp_')));return data;};
  const load=G.load;G.load=function(slot=0){const data=W.Save.read(slot);if(!data)return false;const previous=this.encounterRuns;let ok;this.encounterRuns=data.encounterRuns||{};try{ok=load.call(this,slot);if(ok)for(const r of Object.values(this.encounterRuns)){if(r&&r.state==='active'&&!r.planVersion)r.planVersion=2;}return ok;}finally{if(!ok)this.encounterRuns=previous;}};
  const start=G.start;G.start=function(options={}){if(!options.load)this.encounterRuns={};return start.call(this,options);};
  const defeat=G.defeat;G.defeat=function(){if(isTrial(this.world)&&!this.world.state.solved){const s=trialState(this.world);removeEncounterEnemies(this,this.world.entry.id);Object.assign(s,{phase:'ready',wave:0,enemyIds:[],records:[],remaining:0,countdown:0});}else if(!this.world.isDungeon)for(const r of Object.values(this.encounterRuns||{}))if(r.state==='active'&&r.phase!=='ready')this.failCamp(r,'The defense fell with its fighters.');return defeat.call(this);};
  const typeLabel=W.UI?.prototype.questTypeLabel;if(typeLabel)W.UI.prototype.questTypeLabel=function(q){if(q.type==='campDefense')return q.counterattack?'Hold & counterattack':'Camp defense waves';if(q.type==='dungeon')return W.Content.dungeons.find(d=>d.id===q.target)?.encounter==='survival'?'Survival cavern':'Puzzle cavern';return typeLabel.call(this,q);};
  function text(c,message,x,y,size=14,color='#f7dfab'){c.font='700 '+size+'px system-ui';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#14252c';c.strokeText(message,x,y);c.fillStyle=color;c.fillText(message,x,y);}
  function prop(renderer,col,row,x,y,w,h,options={}){return W.Art?.draw(renderer,'encounterProps',col,row,x,y,w,h,{py:.7,...options})||false;}
  const labels=R.drawLocationLabels;R.drawLocationLabels=function(w){labels.call(this,w);const c=this.ctx,g=this.game;
    if(isTrial(w)&&!w.state.solved){const s=trialState(w),message=s.phase==='ready'?'E / B · WAKE THE WATCH ALTAR':s.phase==='between'?'NEXT WAVE IN '+Math.ceil(s.countdown)+'s':'WAVE '+s.wave+' / '+w.config.waveCount+' · '+(s.remaining??s.enemyIds.length)+' REMAINING';c.save();text(c,message,580,880,18);text(c,'The guardian seal opens after every wave falls.',580,910,13,'#b6d4d2');c.restore();return;}
    if(w.isDungeon)return;
    for(const run of Object.values(g.encounterRuns||{})){
      if(!this.visible(run.x,run.y,240))continue;c.save();c.strokeStyle=run.state==='failed'?'#ec8d83':'#a6dac6';c.lineWidth=3;c.setLineDash([13,9]);c.beginPath();c.ellipse(run.x,run.y,190,125,0,0,TAU);c.stroke();c.setLineDash([]);
      if(!prop(this,2,0,run.x,run.y,110,112))this.sprite('scenery',3,3,6,4,run.x,run.y,86,86,{py:.65});
      prop(this,3,1,run.x+78,run.y+5,68,76);prop(this,2,1,run.x-112,run.y+38,116,64);prop(this,2,1,run.x+114,run.y+68,116,64);
      // The road post keeps its own name near y - 134. Stack event status
      // above it so the name, integrity bar, and wave counter remain separate.
      c.fillStyle='#182d32';c.fillRect(run.x-90,run.y-164,180,12);c.fillStyle=run.hp/run.maxHp>.35?'#8fd2b0':'#f18d79';c.fillRect(run.x-88,run.y-162,176*Math.max(0,run.hp/run.maxHp),8);const q=quest(run.questId);
      text(c,run.state==='failed'?'E / B · RETRY CAMP DEFENSE':run.state==='complete'?'CAMP SECURED':run.phase==='ready'?'E / B · RING DEFENSE BELL':campText(g,q,run),run.x,run.y-184,14);text(c,'SUPPLY INTEGRITY '+Math.ceil(run.hp)+' / '+run.maxHp,run.x,run.y+108,12);c.restore();
    }
    for(const q of W.Content.quests.filter(q=>q.encounter==='demolition')){const run=g.missionRuns[q.id];if(!run)continue;for(let i=0;i<4;i++){
      const l=w.getLocation(q.objectives[i].id);if(!l||!this.visible(l.x,l.y,120))continue;c.save();
      if(i<3){const armed=run.placedCharges?.includes(l.id);
        if(armed&&!run.detonated){if(!prop(this,0,1,l.x,l.y,53,53)){c.fillStyle='#29343a';c.fillRect(l.x-17,l.y-20,34,24);c.fillStyle=Math.sin(this.clock*7)>0?'#ffbd72':'#e37262';c.fillRect(l.x-11,l.y-15,8,8);c.strokeStyle='#daa76c';c.lineWidth=2;c.strokeRect(l.x-17,l.y-20,34,24);}text(c,'CHARGE ARMED',l.x,l.y+45,12,'#ffd594');}
        else if(!run.detonated)prop(this,0,0,l.x,l.y+16,48,48);
        if(run.detonated){c.fillStyle='#22282b99';c.beginPath();c.ellipse(l.x,l.y,55,30,0,0,TAU);c.fill();text(c,'TARGET DESTROYED',l.x,l.y+50,12,'#9daaaa');}
      }else{prop(this,1,run.detonated?1:0,l.x,l.y,84,94);text(c,run.detonated?'REMOTE SPENT':(run.placedCharges?.length||0)===3?'E / B · REMOTE DETONATE':'REMOTE LOCKED · ARM 3 CHARGES',l.x,l.y+65,13,(run.placedCharges?.length||0)===3?'#ffe19a':'#bdc8c7');}
      c.restore();
    }}
  };
  const draw=R.draw;R.draw=function(...args){
    const result=draw.apply(this,args),g=this.game,w=g.world;if(g.state!=='playing'||g.ui?.isOpen||!this.ctx)return result;
    let title,message,ratio=null;
    if(isTrial(w)&&!w.state.solved){const s=trialState(w);title=w.config.title.toUpperCase();message=s.phase==='ready'?'Ring the watch altar with E / B to begin '+w.config.waveCount+' waves.':s.phase==='between'?'Wave '+s.wave+' cleared · next wave in '+Math.ceil(s.countdown)+'s':'Wave '+s.wave+' / '+w.config.waveCount+' · '+(s.remaining??s.enemyIds.length)+' enemies remaining';}
    else if(!w?.isDungeon){const run=Object.values(g.encounterRuns||{}).filter(r=>r.state==='active'&&r.phase!=='ready'&&dist(r,g.camera)<1100).sort((a,b)=>dist(a,g.camera)-dist(b,g.camera))[0];if(run){const q=quest(run.questId);title=q.title.toUpperCase();message=campText(g,q,run);ratio=run.hp/run.maxHp;}}
    if(!title)return result;const c=this.ctx,width=Math.min(620,this.width-30),x=(this.width-width)/2,y=w.isDungeon?98:134;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='rgba(15,31,39,.94)';c.fillRect(x,y,width,62);c.strokeStyle='#9cbba9';c.lineWidth=1;c.strokeRect(x,y,width,62);text(c,title,this.width/2,y+23,14,'#efdcab');text(c,message,this.width/2,y+46,12,'#c7e3df');if(ratio!==null){c.fillStyle='#263f43';c.fillRect(x,y+59,width,3);c.fillStyle=ratio>.35?'#8fd2b0':'#f18d79';c.fillRect(x,y+59,width*Math.max(0,ratio),3);}c.restore();return result;
  };
  W.Encounters={isTrial,trialState,spawnWave,trackWave,withCampTargets};
})();
