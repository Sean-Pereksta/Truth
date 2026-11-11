(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,specs=()=>W.Content.resistanceHidden||[],entry=q=>typeof q==='string'?W.Content.quests.find(v=>v.id===q):q;
  const live=e=>e&&!e.dead&&e.hp>0;
  G.syncResistanceRewards=function(){
    let changed=false;
    for(const [questId,itemId]of Object.entries(W.Content.resistanceRewardSources||{})){
      if(!this.completedQuests.has(questId))continue;
      const item=W.Content.equipment.find(i=>i.id===itemId);if(!item)continue;let fresh=false;
      for(const p of [...this.players,...(this.reservePlayer?[this.reservePlayer]:[])]){
        p.resistanceRewardClaims=p.resistanceRewardClaims||[];if(p.resistanceRewardClaims.includes(questId))continue;
        p.resistanceRewardClaims.push(questId);changed=true;
        if(!p.inventory.some(v=>(v.id||v)===itemId)){p.inventory.push({id:itemId,upgrade:0});fresh=true;}
      }
      if(fresh)this.revealItem?.(item,'Adventure reward · '+(entry(questId)?.title||questId));
    }
    return changed;
  };
  const progress=G.questProgress;
  G.questProgress=function(q){const result=progress.call(this,q);q=entry(q);if(q?.hiddenResistance&&!result.accepted&&!result.complete&&!this.questCounters?.['discovered:'+q.id])result.available=false;return result;};
  function clearPoint(g,x,y,anchor){
    for(let radius=0;radius<=300;radius+=35)for(let n=0;n<(radius?20:1);n++){const a=n*Math.PI/10,p={x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius};if(!g.world.isBlocked(p.x,p.y,22)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y)&&(!anchor||g.lineOfSight(p,anchor)))return p;}
    return null;
  }
  G.ensureResistanceGuard=function(q,run){
    const step=q.steps?.[run.stepIndex],target=step?.resistanceGuard&&this.world.getLocation(step.targets[0]);if(!target)return null;
    if(!this.players.some(p=>!p.downed&&W.dist(p,target)<450))return run.resistanceGuard||null;
    if(!run.resistanceGuard){
      const spec=specs().find(s=>s.id===q.id),types=[...spec.types,...(this.players.length>1?[0]:[])],records=[];
      if(this.world.activeEnemies.filter(live).length+types.length>W.config.maxEnemies)return null;
      for(let i=0;i<types.length;i++){
        const type=types[i],definition=W.Content.enemies[type],angle=i/types.length*Math.PI*2,point=clearPoint(this,target.x+Math.cos(angle)*140,target.y+Math.sin(angle)*140,target);if(!point)return null;
        const level=spec.level,hp=definition.hp*(1+level*.12)*(i===types.length-1?1.35:1),id='resistance-guard-'+q.id+'-'+i;
        const enemy={id,...point,homeX:point.x,homeY:point.y,type,level,region:q.region,hp,maxHp:hp,angle:angle+Math.PI,anim:'idle',animTime:0,state:'chase',alert:15,ephemeral:true,missionTarget:q.id,resistanceGuard:true,name:i===types.length-1?'Prototype custodian':undefined};
        this.ensureEnemyScaling(enemy);records.push(enemy);
      }
      for(const enemy of records){this.world.addEnemy({...enemy});this.effect('reinforcement',enemy.x,enemy.y,45,.7);}
      run.resistanceGuard={records,ids:records.map(e=>e.id)};this.ui.toast('Guard encounter · defeat '+records.length+' enemies, then recover the marked item. No time limit.','quest');this.save(false);
    }
    const guard=run.resistanceGuard;
    for(const record of guard.records){
      if(this.world.dead.has(record.id)){record.dead=true;record.hp=0;continue;}
      let enemy=this.world.activeEnemies.find(e=>e.id===record.id)||this.world._dormant?.get(record.id);
      if(enemy){Object.assign(record,{hp:enemy.hp,maxHp:enemy.maxHp,regionScaleApplied:enemy.regionScaleApplied,regionHealthScale:enemy.regionHealthScale,regionDamage:enemy.regionDamage,dead:enemy.dead,x:enemy.x,y:enemy.y});if(live(enemy)&&(W.dist(enemy,target)>650||this.world.isBlocked(enemy.x,enemy.y,20))){const point=clearPoint(this,target.x+120,target.y+80,target);if(point){Object.assign(enemy,point);this.effect('reinforcement',point.x,point.y,45,.6);}}}
      else if(live(record)){const point=clearPoint(this,record.x,record.y,target);if(point){enemy={...record,...point,specialMove:null};this.world.addEnemy(enemy);}}
    }
    return guard;
  };
  const update=G.updateMissions;
  G.updateMissions=function(dt){
    const result=update.call(this,dt);if(this.paused||this.world.isDungeon)return result;
    for(const spec of specs()){
      const q=entry(spec.id),npc=this.questContact(q);
      if(npc&&!this.questCounters['discovered:'+q.id]&&this.players.some(p=>!p.downed&&W.dist(p,npc)<230)){this.questCounters['discovered:'+q.id]=1;this.ui.toast('Hidden adventure discovered · '+q.title+' · speak with '+npc.name+'.','quest');this.save(false);}
      const run=this.missionRuns[q.id];if(run?.state==='active')this.ensureResistanceGuard(q,run);
    }
    return result;
  };
  const interact=G.handleMissionInteraction;
  G.handleMissionInteraction=function(p){
    if(!this.paused&&!p.downed)for(const spec of specs()){
      const q=entry(spec.id),run=this.missionRuns[q.id],step=q.steps?.[run?.stepIndex],target=step?.resistanceGuard&&this.world.getLocation(step.targets[0]);
      if(run?.state!=='active'||!target||W.dist(p,target)>=105)continue;
      const guard=this.ensureResistanceGuard(q,run),remaining=guard?.records.filter(live).length;
      if(!guard||remaining){this.ui.toast(guard?'Defeat the '+remaining+' remaining guards before recovering this item.':'The guard patrol is gathering. Clear nearby combatants, then try again.','quest');return true;}
    }
    return interact.call(this,p);
  };
  const objective=G.questObjectiveText;
  G.questObjectiveText=function(q){q=entry(q);let text=objective.call(this,q);const run=q&&this.missionRuns?.[q.id];if(q?.hiddenResistance&&run?.state==='active'&&q.steps?.[run.stepIndex]?.resistanceGuard)text+=' '+(run.resistanceGuard?run.resistanceGuard.records.filter(live).length+' guards remaining. ':'Approach the marked recovery site. ')+'No kill timer.';return text;};
  const check=G.checkQuests;
  G.checkQuests=function(){const result=check.call(this);if(this.syncResistanceRewards())this.save(false);return result;};
  const finish=G.finishQuestFromNpc;
  if(finish)G.finishQuestFromNpc=function(...args){const result=finish.apply(this,args);if(this.syncResistanceRewards())this.save(false);return result;};
  for(const method of ['load','toggleCoop']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false&&this.syncResistanceRewards())this.save(false);return result;};}
  const converse=W.Conversations?.build;
  if(converse)W.Conversations.build=function(profile,location,game,topic,memory,node){const result=converse.apply(this,arguments),lead=specs().find(s=>s.region===location.region);if(lead&&node==='route'&&!game.completedQuests.has(lead.id)){const guide=W.Content.npcs.find(n=>n.id==='npc_town_way_'+lead.region);result.lines=[...result.lines,guide?.topics?.advice?.slice(-1)[0]||lead.description];}return result;};
  W.ResistanceRewards={specs,clearPoint};
})();
