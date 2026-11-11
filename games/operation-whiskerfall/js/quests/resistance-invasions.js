(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const copy=o=>JSON.parse(JSON.stringify(o)),alive=e=>e&&e.hp>0&&!e.dead&&!e.downed,quests=()=>W.Content.invasions||[],quest=id=>quests().find(q=>q.id===(typeof id==='string'?id:id?.id));
  const runs=g=>g.invasionRuns||(g.invasionRuns={}),active=g=>Object.values(runs(g)).filter(r=>r.state==='active'),distance=W.dist;
  function clear(g,point,origin=point){
    for(let ring=0;ring<15;ring++)for(let i=0;i<(ring?24:1);i++){
      const a=i*TAU/24,p={x:point.x+Math.cos(a)*ring*24,y:point.y+Math.sin(a)*ring*24};
      if(!g.world.isBlocked(p.x,p.y,22)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y)&&g.world._navigationRay(origin.x,origin.y,p.x,p.y,20))return p;
    }return null;
  }
  function removeEnemies(g,id){const r=runs(g)[id],ids=new Set([...(r?.enemyIds||[]),...(r?.records||[]).map(e=>e.id)]),owned=e=>e.invasionId===id||ids.has(e.id);
    for(const w of new Set([g.world,g.overworld].filter(Boolean))){w.activeEnemies=w.activeEnemies.filter(e=>!owned(e));for(const map of [w._active,w._dormant])if(map)for(const [key,e]of map)if(owned(e))map.delete(key);w._rebuildEnemyGrid?.();}
    // Stage checkpoints retire nearby hostile fire as well as its attackers.
    if(r&&!g.world.isDungeon)for(const e of [...g.projectiles,...g.effects])if(e.alive&&!(e.owner>=0)&&e.damage>0&&distance(e,r)<1000)e.alive=false;
  }
  function removeAllies(g,id){g.allies=g.allies.filter(a=>a.invasionId!==id);if(g.overworldAllies)g.overworldAllies=g.overworldAllies.filter(a=>a.invasionId!==id);}
  function captainDefeated(g,r){const id=r.captainId||r.records?.find(e=>e.invasionCaptain)?.id||(r.spawnIndex>0&&r.enemyIds?.[0]);return r.stage===2&&!!id&&g.world.dead.has(id);}
  function scaleInvasionEnemy(e){if(e.invasionScaling===1)return;const scale=W.Content.enemyScaling(e.region),healthRatio=Math.min(7.8,scale.health)/scale.health;e.hp*=healthRatio;e.maxHp*=healthRatio;e.invasionScaling=1;}
  const enemyDamage=G.enemyDamage;G.enemyDamage=function(e,...args){const amount=enemyDamage.call(this,e,...args);if(!e.invasionId)return amount;const scale=W.Content.enemyScaling(e.region).damage;return amount*Math.min(4.9,scale)/scale;};
  function point(g,r,stage=r.stage){const l=g.world.getLocation(quest(r.questId).target);return stage===1?{x:l.x-260,y:l.y+180}:stage===2?{x:l.x+280,y:l.y-120}:{x:l.x,y:l.y};}
  function syncAllies(g,r){removeAllies(g,r.questId);if(r.state==='active')for(const a of r.allies||[])if(alive(a)){a.life=999999;g.allies.push(a);}}
  function spawnAllies(g,r){
    const center=point(g,r),q=quest(r.questId),roles=['rifle','rifle','engineer',...(r.choice==='medic'||g.completedQuests.has('invasion_frost')?['medic']:[])];
    r.allies=roles.map((role,i)=>{const p=clear(g,{x:center.x-90+i*60,y:center.y+65},center)||center;return{id:r.questId+'_ally_'+i,invasionId:r.questId,role,name:role==='medic'?'Lumi’s medics':role==='engineer'?'Cinder’s repair crew':'Resistance riflecat',...p,hp:340+q.level*18,maxHp:340+q.level*18,life:999999,fire:.4+i*.18,owner:0,skin:i%2,armorSet:0,angle:0,anim:'idle',animTime:0,skills:{},perks:{},stats:{},state:'active',type:'escort',invuln:0};});syncAllies(g,r);
  }
  G.invasionStatus=function(id){const q=quest(id),r=runs(this)[q?.id];if(!r)return'Enlist with the regional captain. Recommended level '+(q?.level||1)+'.';
    if(r.state==='complete')return'Front secured. Report to your captain; '+q.support+' will support the final push.';
    if(r.state==='failed')return r.failure+' Return to the marked banner and press E / B to retry stage '+(r.stage+1)+'. Completed stages are safe.';
    if(r.phase==='ready')return'Stage '+(r.stage+1)+' checkpoint · E / B at the banner to begin.'+(r.stage===0&&!r.choice?' Optional: west medic flag = healing; east repair flag = +40% supplies. Choose one.':'');
    const allies=(r.allies||[]).filter(alive).length,health=Math.ceil(r.hp/r.maxHp*100),base='Stage '+(r.stage+1)+' / 3 · '+(r.stage===2?'evacuation secure':'supplies '+health+'%')+' · '+allies+' allies · ';
    return base+(r.stage===0?'Hold the barricade: '+Math.ceil(Math.max(0,20-r.elapsed))+'s'+(r.paused?' · PAUSED: return within the circle':''):r.stage===1?'Escort families to the fallback lantern: '+Math.floor(r.elapsed/12*100)+'%'+(r.paused?' · waiting for a nearby hero':''):'Defeat the siege captain, then E / B at the command engine · '+r.remaining+' enemies nearby. No kill timer.');
  };
  G.beginInvasionStage=function(id){
    const q=quest(id),r=runs(this)[id];if(!q||!r||this.world.isDungeon||r.state==='complete'||!this.players.some(p=>alive(p)&&distance(p,point(this,r))<115))return false;
    if(active(this).some(other=>other!==r&&other.phase==='fighting')){this.ui.toast('Finish or leave the current frontline before starting another.','quest');return false;}
    if(r.phase==='fighting')return false;
    removeEnemies(this,id);removeAllies(this,id);r.state='active';r.phase='fighting';r.elapsed=0;r.attempt=(r.attempt||0)+1;r.records=[];r.enemyIds=[];r.captainId=null;r.spawnIndex=0;r.nextSpawn=0;r.remaining=0;r.failure='';
    r.maxHp=(900+q.level*75)*(r.choice==='repair'?1.4:1);r.hp=r.maxHp;const p=point(this,r);r.x=p.x;r.y=p.y;
    r.lineup=r.stage===0?[0,1,0,2,3,0]:r.stage===1?[1,0,2,0,1]:[3,1,5,0,2];if(this.players.length>1)r.lineup.push(0,1);
    spawnAllies(this,r);this.ui.toast(r.stage===0?q.opening:r.stage===1?q.fallback:'Dawn: Break the captain’s command and shut down the engine. The surviving patrols can retreat.','quest');this.save(false);return true;
  };
  G.chooseInvasionSupport=function(id,choice,p){const r=runs(this)[id];if(!r||r.stage!==0||r.phase!=='ready'||r.choice||!['medic','repair'].includes(choice)||!alive(p))return false;
    const center=point(this,r),flag={x:center.x+(choice==='medic'?-145:145),y:center.y};if(distance(p,flag)>80)return false;
    r.choice=choice;this.ui.toast(choice==='medic'?'Pinned medics rescued. Their healer joins every stage.':'Gate reinforced. Every stage starts with 40% more supply integrity.','quest');this.save(false);return true;};
  G.failInvasion=function(r,reason){if(r.state!=='active')return;r.state='failed';r.phase='ready';r.failure=reason;removeEnemies(this,r.questId);removeAllies(this,r.questId);r.records=[];r.enemyIds=[];this.ui.toast(reason+' Stage '+(r.stage+1)+' checkpoint retained. Return to the banner and press E / B to retry.','error');this.save(false);};
  G.advanceInvasion=function(r){removeEnemies(this,r.questId);removeAllies(this,r.questId);r.records=[];r.enemyIds=[];r.elapsed=0;
    if(r.stage===2){r.state='complete';r.phase='complete';this.missionCompleted.add(r.questId);this.ui.toast(quest(r.questId).victory,'quest');this.checkQuests();}
    else{r.stage++;r.phase='ready';const p=point(this,r);r.x=p.x;r.y=p.y;this.ui.toast('STAGE CHECKPOINT · '+(r.stage===1?'Move to the fallback lantern and begin the evacuation.':'Follow the arrow to the siege engine. Press E / B when ready.'),'quest');}
    if(this.trackedQuest===r.questId){const p=point(this,r);this.marker={...p};}this.save(false);
  };
  function spawnNext(g,r){
    const i=r.spawnIndex;if(i>=r.lineup.length)return;const q=quest(r.questId),center=point(g,r),a=-1.5+(i%4)*.7,desired={x:center.x+Math.cos(a)*380,y:center.y+Math.sin(a)*380},p=clear(g,desired,center);if(!p){r.nextSpawn=2;return;}
    const type=r.lineup[i],s=W.Content.enemies[type],captain=r.stage===2&&i===0,hp=s.hp*(1+q.level*.12)*(captain?2.5:1);
    const e={id:q.id+'_stage_'+r.stage+'_attempt_'+r.attempt+'_'+i,invasionId:q.id,invasionCaptain:captain,type,name:captain?'Siege Captain':s.name,...p,homeX:p.x,homeY:p.y,region:q.region,level:q.level,hp,maxHp:hp,state:'chase',anim:'run',animTime:0,angle:a+Math.PI,alert:30,ephemeral:true,fireTimer:1.2};
    g.ensureEnemyScaling(e);scaleInvasionEnemy(e);g.world.addEnemy(e);if(captain)r.captainId=e.id;r.enemyIds.push(e.id);r.records.push(copy(e));r.spawnIndex++;r.nextSpawn=2.3;g.effect('reinforcement',p.x,p.y,50,.9);
  }
  function track(g,r,dt){
    const center=point(g,r),records=[];let count=0;
    for(const saved of r.records||[]){if(g.world.dead.has(saved.id))continue;let e=g.world.activeEnemies.find(e=>e.id===saved.id)||g.world._dormant?.get(saved.id);if(e&&!alive(e))continue;if(!e){if(saved.hp<=0)continue;e=copy(saved);}scaleInvasionEnemy(e);if(!g.world.activeEnemies.some(n=>n.id===e.id)){g.world._dormant?.delete(e.id);e=g.world.addEnemy(e);}
      const moved=Math.hypot(e.x-(e.invasionLastX??e.x),e.y-(e.invasionLastY??e.y));e.invasionStuck=moved<1?(e.invasionStuck||0)+dt:0;e.invasionLastX=e.x;e.invasionLastY=e.y;
      if(distance(e,center)>1100||g.world.isBlocked(e.x,e.y,18)||e.invasionStuck>10){const p=clear(g,{x:center.x+260,y:center.y-180},center);if(p){Object.assign(e,p);e.invasionStuck=0;g.effect('reinforcement',e.x,e.y,45,.8);}}
      records.push({...e,_steer:null});count++;
    }r.records=records;r.remaining=count;
  }
  G.updateInvasions=function(dt){if(this.paused)return;this.updateResistanceFinale();if(this.world.isDungeon)return;
    for(const r of active(this)){const center=point(this,r),near=this.players.filter(alive).some(p=>distance(p,center)<110);
      if(r.phase==='ready'){if(near)this.interactionPrompt='E / B · begin invasion stage '+(r.stage+1);continue;}
      if(!this.players.some(alive)){this.failInvasion(r,'The resistance fighters fell.');continue;}
      if(r.stage<2&&r.hp<=0){this.failInvasion(r,'Evacuation supplies destroyed.');continue;}
      if(this.players.filter(alive).every(p=>distance(p,center)>1450)){this.failInvasion(r,'The frontline was abandoned.');continue;}
      track(this,r,dt);r.nextSpawn-=dt;if(r.nextSpawn<=0&&r.remaining<8)spawnNext(this,r);
      const close=this.players.some(p=>alive(p)&&distance(p,r)<(r.stage===0?260:240));r.paused=!close;
      if(r.stage===0&&close){r.elapsed=Math.min(20,r.elapsed+dt);if(r.elapsed>=20){this.advanceInvasion(r);continue;}}
      if(r.stage===1&&close){const end={x:center.x-160,y:center.y+100},step=Math.min(dt,12-r.elapsed),fraction=(r.elapsed+step)/12;
        const next={x:center.x+(end.x-center.x)*fraction,y:center.y+(end.y-center.y)*fraction};if(this.world._navigationRay(r.x,r.y,next.x,next.y,20)){r.x=next.x;r.y=next.y;r.elapsed+=step;}else{const p=clear(this,next,{x:r.x,y:r.y});if(p){r.x=p.x;r.y=p.y;r.elapsed+=step;}}
        if(r.elapsed>=12){this.advanceInvasion(r);continue;}
      }
      if(captainDefeated(this,r)&&near)this.interactionPrompt='E / B · disable siege command';
    }
    for(const r of Object.values(runs(this)))if(r.state==='failed'&&this.players.some(p=>alive(p)&&distance(p,point(this,r))<110))this.interactionPrompt='E / B · retry invasion checkpoint';
  };
  const update=G.updateMissions;G.updateMissions=function(dt){update.call(this,dt);this.updateInvasions(dt);};
  const accept=G.acceptQuest;G.acceptQuest=function(id){const ok=accept.call(this,id),q=quest(id);if(ok&&q&&!this.completedQuests.has(id)&&!runs(this)[id]){const p=this.world.getLocation(q.target);runs(this)[id]={questId:id,state:'active',phase:'ready',stage:0,attempt:0,x:p.x,y:p.y,hp:1,maxHp:1,elapsed:0,records:[],enemyIds:[],allies:[]};this.ui.toast('Resistance muster marked. Meet your allies at the banner. Optional support flags are west and east.','quest');this.save(false);}return ok;};
  const progress=G.questProgress;G.questProgress=function(id){const state=progress.call(this,id),q=quest(id);if(q){const r=runs(this)[q.id];state.current=r?.state==='complete'?3:r?.stage||0;state.ready=state.current>=3;}return state;};
  const target=G.questTarget;G.questTarget=function(id){const q=quest(id),r=q&&runs(this)[q.id];if(q&&r&&!this.completedQuests.has(q.id)&&r.state!=='complete'&&!this.world.isDungeon)return{...(r.stage===1&&r.phase==='fighting'?{x:r.x,y:r.y}:point(this,r)),label:(r.stage===0?'Muster / barricade':r.stage===1?'Evacuating families':'Siege command')+' · '+q.frontName};return target.call(this,id);};
  const objective=G.questObjectiveText;G.questObjectiveText=function(id){const q=quest(id);return q&&this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id)?this.invasionStatus(q.id):objective.call(this,id);};
  const interact=G.interact;G.interact=function(p){if(!this.paused&&!this.world.isDungeon&&alive(p))for(const r of Object.values(runs(this))){if(r.state==='complete')continue;const center=point(this,r);
    if(r.phase==='ready'&&r.stage===0&&!r.choice)for(const choice of ['medic','repair'])if(this.chooseInvasionSupport(r.questId,choice,p))return;
    if(distance(p,center)<110){if(r.phase==='ready'){this.beginInvasionStage(r.questId);return;}if(captainDefeated(this,r)){this.advanceInvasion(r);return;}}
  }return interact.call(this,p);};
  const finaleRoles=[['invasion_orchard','rifle','Orchard signal crew'],['invasion_frost','medic','Warmhearth medic'],['invasion_berlin','engineer','Blackbanner engineer']];
  function detachFinale(g,reset=false){
    g.allies=g.allies.filter(a=>!a.finaleAlly);if(g.overworldAllies)g.overworldAllies=g.overworldAllies.filter(a=>!a.finaleAlly);
    for(const p of g.players){p.resistanceEngineeringWardHp=0;p.resistanceEngineeringWardUntil=0;}
    if(reset)g.resistanceFinale=null;else if(g.resistanceFinale)g.resistanceFinale.active=false;
  }
  G.updateResistanceFinale=function(){
    const inside=!this.world.isDungeon&&this.berlinUnlocked()&&!this.campaignWon&&!this.bossDefeated(this.finalBossLocation()),hero=inside&&this.players.find(p=>alive(p)&&this.world.isFinalArena(p.x,p.y));
    const earned=finaleRoles.filter(([id])=>this.completedQuests.has(id));
    if(!hero||!earned.length){detachFinale(this);return;}
    const state=this.resistanceFinale||(this.resistanceFinale={version:1,active:false,allies:[]}),wasActive=state.active;state.active=true;
    for(const [i,[source,role,name]]of earned.entries())if(!state.allies.some(a=>a.source===source)){
      const p=clear(this,{x:hero.x-70+i*65,y:hero.y+95},hero);if(!p||!this.world.isFinalArena(p.x,p.y))continue;
      state.allies.push({id:'finale_'+source,source,finaleAlly:true,role,name,...p,hp:850,maxHp:850,life:999999,fire:.3+i*.2,owner:0,skin:i%2,armorSet:0,angle:0,anim:'idle',animTime:0,skills:{},perks:{},stats:{},type:'escort',state:'active'});
    }
    this.allies=this.allies.filter(a=>!a.finaleAlly);
    for(const a of state.allies.filter(a=>alive(a)&&earned.some(([id])=>id===a.source)).slice(0,3)){
      if(distance(a,hero)>1000||this.world.isBlocked(a.x,a.y,18)||!this.world.isFinalArena(a.x,a.y)){const p=clear(this,{x:hero.x-60,y:hero.y+90},hero);if(p&&this.world.isFinalArena(p.x,p.y))Object.assign(a,p);}
      this.allies.push(a);
    }
    if(!wasActive&&this.allies.some(a=>a.finaleAlly))this.ui.toast('THE RESISTANCE ARRIVES · '+earned.map(([, ,name])=>name).join(', ')+'. Your earlier victories brought them to Berlin.','quest');
  };
  function friendlyActors(g){return [...active(g).filter(r=>r.phase==='fighting').flatMap(r=>[...(r.stage<2?[r]:[]),...(r.allies||[]).filter(alive)]),...g.allies.filter(a=>a.finaleAlly&&alive(a))];}
  function hurtFriendly(g,a,amount){if(!(amount>0)||!alive(a))return;const supply=!!a.questId&&!a.role;
    if(!supply&&(a.invasionHitUntil||0)>g.time)return;
    // Armored wagons are objective-scale targets; allies have modest armor.
    a.hp=Math.max(0,a.hp-amount*(supply?.3:.6));if(!supply)a.invasionHitUntil=g.time+.22;
    if(a.hp<=0&&a.role){a.anim='death';g.effect('defeat',a.x,a.y,28,.5);}
  }
  // Expose real friendly targets only during combat processing; never put them in saved mission state.
  function withTargets(g,fn,args){if(g._invasionTargets||g.world.isDungeon)return fn.apply(g,args);const keys=[];g._invasionTargets=true;
    for(const a of friendlyActors(g)){const key='__invasion_'+(a.id||a.questId);keys.push(key);g.missionRuns[key]={type:'escort',state:'active',x:a.x,y:a.y,get hp(){return a.hp;},set hp(v){const loss=a.hp-v;if(loss>0)hurtFriendly(g,a,loss);else a.hp=Math.min(a.maxHp,Math.max(0,v));},maxHp:a.maxHp,invasionProxy:true,skills:{},perks:{},stats:{},invuln:0};}
    try{return fn.apply(g,args);}finally{for(const key of keys)delete g.missionRuns[key];g._invasionTargets=false;}
  }
  for(const method of ['updateEnemies','updateProjectiles','explode']){const original=G[method];G[method]=function(...args){if(this.paused)return;return withTargets(this,original,args);};}
  const effects=G.updateEffects;G.updateEffects=function(dt){if(this.paused)return;
    if(!this.world.isDungeon)for(const e of this.effects)if(e.alive){
      if(e.type==='meleeWarning'&&e.life<=dt){const source=this.world.activeEnemies.find(n=>n.id===e.enemyId);if(alive(source))for(const a of friendlyActors(this))if(distance(a,{x:e.sourceX,y:e.sourceY})<95)hurtFriendly(this,a,e.damage);}
      if(e.type==='hazard'&&(e.tick||0)<=dt&&!this.pointLocked(e.x,e.y))for(const a of friendlyActors(this))if(distance(a,e)<e.radius)hurtFriendly(this,a,e.damage||0);
    }return withTargets(this,effects,[dt]);
  };
  const specialMove=G.updateSpecialMove;G.updateSpecialMove=function(e,target,dt){const m=e.specialMove,old={x:e.x,y:e.y},result=specialMove.call(this,e,target,dt);
    if(!this.world.isDungeon&&m&&m.windup<=0&&m.damage&&['charge','skate'].includes(m.kind)&&distance(old,e)>0){const dx=e.x-old.x,dy=e.y-old.y;for(const a of friendlyActors(this)){const t=W.clamp(((a.x-old.x)*dx+(a.y-old.y)*dy)/(dx*dx+dy*dy||1),0,1);if(Math.hypot(a.x-old.x-dx*t,a.y-old.y-dy*t)<(e.boss?65:40))hurtFriendly(this,a,m.damage);}}
    return result;
  };
  const damage=G.damagePlayer;G.damagePlayer=function(p,amount,...args){if(p.invasionProxy){p.hp-=amount;return;}
    if(p.resistanceEngineeringWardUntil>this.time&&p.resistanceEngineeringWardHp>0&&alive(p)&&!(p.invuln>0)&&!(p.smokeTime>0)&&!this.safeZoneAt(p.x,p.y)){const absorbed=Math.min(amount,p.resistanceEngineeringWardHp);p.resistanceEngineeringWardHp-=absorbed;amount-=absorbed;this.effect('shield',p.x,p.y,38,.25);if(amount<=0)return;}
    return damage.call(this,p,amount,...args);
  };
  const allies=G.updateAllies;G.updateAllies=function(dt){if(this.paused)return;this.updateResistanceFinale();const special=this.allies.filter(a=>a.invasionId||a.finaleAlly);this.allies=this.allies.filter(a=>!a.invasionId&&!a.finaleAlly);allies.call(this,dt);this.allies.push(...special.filter(alive));
    for(const r of active(this).filter(r=>r.phase==='fighting'))for(const a of r.allies||[]){if(!alive(a))continue;a.fire-=dt;a.animTime+=dt;const nearest=this.world.activeEnemies.filter(e=>alive(e)&&distance(a,e)<620&&this.lineOfSight(a,e)).sort((b,c)=>((c.resistanceMarkedUntil||0)>this.time)-((b.resistanceMarkedUntil||0)>this.time)||distance(a,b)-distance(a,c))[0];
      if(a.fire<=0){a.fire=a.role==='rifle'?.85:2;
        if(a.role==='medic'){const target=[...this.players,...r.allies].filter(p=>alive(p)&&distance(a,p)<260&&p.hp<p.maxHp).sort((b,c)=>b.hp/b.maxHp-c.hp/c.maxHp)[0];if(target){target.hp=Math.min(target.maxHp,target.hp+18+quest(r.questId).level);this.effect('heal',target.x,target.y,45,.6);}}
        else if(a.role==='engineer'&&r.stage<2&&distance(a,r)<250){r.hp=Math.min(r.maxHp,r.hp+20+quest(r.questId).level);this.effect('heal',r.x,r.y,35,.4);}
        if(nearest){a.angle=Math.atan2(nearest.y-a.y,nearest.x-a.x);this.bulletPool.take({x:a.x,y:a.y,vx:Math.cos(a.angle)*850,vy:Math.sin(a.angle)*850,damage:14+quest(r.questId).level*1.8,life:.8,owner:0,kind:'bullet',radius:4});a.anim='shoot';}
      }
      if(distance(a,r)>160){const steer=this.world.steerAround(a,r,dt);this.move(a,steer.mx*150*dt,steer.my*150*dt,18);a.anim='run';}
    }
    for(const a of this.allies.filter(a=>a.finaleAlly&&alive(a))){a.fire-=dt;a.animTime+=dt;const heroes=this.players.filter(p=>alive(p)&&this.world.isFinalArena(p.x,p.y)),hero=heroes.sort((b,c)=>distance(a,b)-distance(a,c))[0];if(!hero)continue;
      const foe=this.world.activeEnemies.filter(e=>alive(e)&&distance(a,e)<650&&this.lineOfSight(a,e)).sort((b,c)=>((c.resistanceMarkedUntil||0)>this.time)-((b.resistanceMarkedUntil||0)>this.time)||distance(a,b)-distance(a,c))[0];
      if(a.fire<=0){a.fire=a.role==='rifle'?.85:a.role==='medic'?2.5:4;
        if(a.role==='medic'){const injured=[...heroes,...this.allies.filter(n=>n.finaleAlly)].filter(p=>alive(p)&&distance(a,p)<280&&p.hp<p.maxHp).sort((b,c)=>b.hp/b.maxHp-c.hp/c.maxHp)[0];if(injured){injured.hp=Math.min(injured.maxHp,injured.hp+34);this.effect('heal',injured.x,injured.y,45,.6);}}
        if(a.role==='engineer'){const target=heroes.filter(p=>distance(a,p)<280).sort((b,c)=>(b.resistanceEngineeringWardHp||0)-(c.resistanceEngineeringWardHp||0))[0];if(target){target.resistanceEngineeringWardHp=40;target.resistanceEngineeringWardUntil=this.time+4;this.effect('shield',target.x,target.y,55,.7);this.text('ENGINEER WARD',target.x,target.y-54,'#e9cf91');}}
        if(foe){a.angle=Math.atan2(foe.y-a.y,foe.x-a.x);const owner=hero.id;this.bulletPool.take({x:a.x,y:a.y,vx:Math.cos(a.angle)*850,vy:Math.sin(a.angle)*850,damage:a.role==='rifle'?34:22,life:.85,owner,kind:'bullet',radius:4});a.anim='shoot';}
      }
      if(distance(a,hero)>145){const steer=this.world.steerAround(a,hero,dt);this.move(a,steer.mx*155*dt,steer.my*155*dt,18);a.anim='run';}
    }
  };
  const defeat=G.defeat;G.defeat=function(){if(this.players.length&&this.players.every(p=>!alive(p))){detachFinale(this,true);for(const r of active(this).filter(r=>r.phase==='fighting'))this.failInvasion(r,'The resistance fighters fell.');}return defeat.call(this);};
  const travel=G.fastTravel;G.fastTravel=function(...args){const ok=travel.apply(this,args);if(ok){detachFinale(this);for(const r of active(this).filter(r=>r.phase==='fighting'))this.failInvasion(r,'The frontline was left during travel.');this.save(false);}return ok;};
  const enter=G.enterDungeon;G.enterDungeon=function(...args){const [entry,restoring]=args;
    // Dungeon entry saves internally. Retire the surface battle before that
    // snapshot, and only when its existing entry conditions can succeed.
    if(!restoring&&!this.world.isDungeon&&entry?.type==='cave'&&this.players.every(p=>alive(p)&&distance(p,entry)<=230)){detachFinale(this);for(const r of active(this).filter(r=>r.phase==='fighting'))this.failInvasion(r,'The frontline was left for a cavern.');}
    const ok=enter.apply(this,args);if(ok){detachFinale(this);if(!restoring)for(const r of active(this).filter(r=>r.phase==='fighting'))this.failInvasion(r,'The frontline was left for a cavern.');}return ok;
  };
  const leave=G.leaveDungeon;G.leaveDungeon=function(...args){const ok=leave.apply(this,args);if(ok){for(const r of Object.values(runs(this)))if(r.state!=='active'||r.phase!=='fighting'){removeEnemies(this,r.questId);removeAllies(this,r.questId);}this.updateResistanceFinale();}return ok;};
  const snap=G.snapshot;G.snapshot=function(){for(const r of active(this).filter(r=>r.phase==='fighting'))if(!this.world.isDungeon)track(this,r,0);const result=snap.call(this);result.invasionVersion=1;result.invasionRuns=copy(runs(this));result.resistanceFinale=copy(this.resistanceFinale||null);result.missionRuns=Object.fromEntries(Object.entries(result.missionRuns||{}).filter(([key])=>!key.startsWith('__invasion_')));return result;};
  const load=G.load;G.load=function(slot=0){const data=W.Save.read(slot);if(!data)return false;const previous=this.invasionRuns,oldFinale=this.resistanceFinale;this.invasionRuns=copy(data.invasionRuns||{});this.resistanceFinale=copy(data.resistanceFinale||null);let ok;try{ok=load.call(this,slot);}finally{if(!ok){this.invasionRuns=previous;this.resistanceFinale=oldFinale;}}
    if(ok){for(const id of Object.keys(runs(this)))if(!quest(id))delete this.invasionRuns[id];if(!this.world.isDungeon)for(const r of active(this).filter(r=>r.phase==='fighting')){track(this,r,0);syncAllies(this,r);}else if(this.world.isDungeon)for(const r of active(this).filter(r=>r.phase==='fighting')){r.state='failed';r.phase='ready';r.failure='The frontline was left for a cavern.';removeEnemies(this,r.questId);removeAllies(this,r.questId);r.records=[];r.enemyIds=[];}
      this.updateResistanceFinale();}
    return ok;
  };
  const start=G.start;G.start=function(options={}){if(!options.load){this.invasionRuns={};this.resistanceFinale=null;}return start.call(this,options);};
  if(W.Save?.validData){const valid=W.Save.validData,actor=a=>a&&typeof a.id==='string'&&['x','y','hp','maxHp'].every(k=>Number.isFinite(a[k]))&&a.hp>=0&&a.maxHp>0,run=r=>r&&quest(r.questId)&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<=2&&['active','failed','complete'].includes(r.state)&&['ready','fighting','complete'].includes(r.phase)&&['x','y','hp','maxHp','elapsed'].every(k=>Number.isFinite(r[k]))&&r.hp>=0&&r.maxHp>0&&r.elapsed>=0&&Array.isArray(r.records)&&r.records.length<=20&&r.records.every(actor)&&Array.isArray(r.allies)&&r.allies.length<=4&&r.allies.every(actor)&&Array.isArray(r.enemyIds)&&(r.phase!=='fighting'||Array.isArray(r.lineup)&&r.lineup.length<=10&&r.lineup.every(i=>Number.isInteger(i)&&i>=0&&i<W.Content.enemies.length)&&Number.isInteger(r.spawnIndex)&&r.spawnIndex>=0&&r.spawnIndex<=r.lineup.length&&Number.isFinite(r.nextSpawn));
    W.Save.validData=function(data){if(!valid.call(this,data))return false;if(data.invasionRuns!==undefined&&(!data.invasionRuns||typeof data.invasionRuns!=='object'||Array.isArray(data.invasionRuns)||!Object.entries(data.invasionRuns).every(([id,r])=>id===r?.questId&&run(r))))return false;const f=data.resistanceFinale;return !f||typeof f==='object'&&Array.isArray(f.allies)&&f.allies.length<=3&&new Set(f.allies.map(a=>a.source)).size===f.allies.length&&f.allies.every(a=>actor(a)&&a.id==='finale_'+a.source&&finaleRoles.some(([id,role])=>a.source===id&&a.role===role));};
  }
  const type=W.UI?.prototype.questTypeLabel;if(type)W.UI.prototype.questTypeLabel=function(q){return q.type==='invasion'?'Resistance invasion · 3 stage checkpoints':type.call(this,q);};
  const labels=R.drawLocationLabels;R.drawLocationLabels=function(world){labels.call(this,world);if(world.isDungeon)return;const g=this.game,c=this.ctx;
    const label=(s,x,y,color='#dfebce')=>{c.fillStyle='rgba(12,29,32,.9)';c.fillRect(x-145,y-17,290,25);c.fillStyle=color;c.font='bold 12px system-ui';c.textAlign='center';c.fillText(s,x,y);};
    for(const q of quests()){const l=world.getLocation(q.target),r=runs(g)[q.id];if(!l||!this.visible(l.x,l.y,1000))continue;c.save();
      if(!r){label(q.frontName,l.x,l.y);c.restore();continue;}const p=point(g,r),zone=r.stage===1&&r.phase==='fighting'?r:p;c.strokeStyle='#9eddb4';c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.arc(zone.x,zone.y,r.phase==='ready'||r.stage===2?110:r.stage===0?260:240,0,TAU);c.stroke();c.setLineDash([]);
      W.Art?.draw(this,'encounterProps',2,1,p.x,p.y+30,120,75,{py:.7});label(r.state==='complete'?'FRONT SECURED':r.phase==='ready'?'E / B · STAGE '+(r.stage+1)+' CHECKPOINT':r.stage===2?'EVACUATION SECURE · COUNTERATTACK':'SUPPLIES '+Math.ceil(r.hp/r.maxHp*100)+'%',p.x,p.y-80);
      if(r.stage===0&&r.phase==='ready'&&!r.choice){label('E / B · RESCUE MEDICS',p.x-145,p.y+85,'#9de9c0');label('E / B · REINFORCE GATE',p.x+145,p.y+120,'#f5d4a0');}
      if(r.stage===1&&r.phase==='fighting'){this.drawFriendly?.({x:r.x,y:r.y,hp:r.hp,maxHp:r.maxHp,skin:1,armorSet:0,angle:2.5,anim:'run',animTime:g.time,friendlyRole:3});label('EVACUATING FAMILIES',r.x,r.y+65);}
      for(const a of r.allies||[])if(alive(a)&&r.phase==='fighting')label(a.role.toUpperCase()+' '+Math.ceil(a.hp/a.maxHp*100)+'%',a.x,a.y-100);
      c.restore();
    }
    for(const a of g.allies.filter(a=>a.finaleAlly&&alive(a)))if(this.visible(a.x,a.y,140)){c.save();label(a.name+' · '+Math.ceil(a.hp/a.maxHp*100)+'%',a.x,a.y-82,'#b6eac7');c.restore();}
  };
  W.Invasions={quests,point,track,clear,captainDefeated,removeEnemies};
})();
