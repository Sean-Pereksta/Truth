(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,conversationActions=new Set(['talk','speak','report','deliver','message']);
  const entry=q=>typeof q==='string'?W.Content.quests.find(t=>t.id===q):q;
  const npcId=n=>typeof n==='string'?n:n?.npcId||n?.locationId||n?.id;
  const surface=g=>g.world.isDungeon?g.overworld:g.world;
  const npcAt=(g,id)=>{const n=surface(g)?.getLocation(id);return n?.type==='npc'?n:null;};
  const pending=g=>g.readyQuestTurnIns||(g.readyQuestTurnIns=new Set());
  function conversationTargets(g,steps){
    if(!steps?.length||steps.some(s=>!conversationActions.has(s.action)||!s.targets?.length||s.targets.some(id=>!npcAt(g,id))))return [];
    return [...new Set(steps.flatMap(s=>s.targets))];
  }
  function pureConversation(g,q){
    if(q.steps?.length)return conversationTargets(g,q.steps).length>0;
    return conversationActions.has(q.type)&&!!npcAt(g,q.targetNpcId||q.recipientNpcId||q.target);
  }
  function finalContact(g,q){
    const lastSpoken=pureConversation(g,q)&&npcAt(g,g.questCounters?.['turn-in-recipient:'+q.id]);if(lastSpoken)return lastSpoken;
    const explicit=npcAt(g,q.turnInNpcId||q.recipientNpcId);if(explicit)return explicit;
    if(q.steps?.length){const last=q.steps[q.steps.length-1],ids=conversationTargets(g,[last]);if(ids.length===1)return npcAt(g,ids[0]);}
    if(pureConversation(g,q))return npcAt(g,q.targetNpcId||q.target);
    return g.questContact(q);
  }
  function atReportStage(g,q){
    const run=g.missionRuns?.[q.id];
    if(!q.steps?.length||pureConversation(g,q)||!run||run.state==='failed'||(run.stepIndex||0)<1)return false;
    const ids=conversationTargets(g,q.steps.slice(run.stepIndex));
    return ids.length===1&&ids[0]===finalContact(g,q)?.id;
  }
  G.questTurnInContact=function(q){q=entry(q);return q?finalContact(this,q):null;};
  const progress=G.questProgress;
  G.questProgress=function(id){
    const q=entry(id),state=progress.call(this,id);if(!q)return state;
    const objectiveReady=!!(state.ready||atReportStage(this,q)||pending(this).has(q.id));
    state.objectiveReady=objectiveReady;
    state.readyForTurnIn=!!(state.accepted&&!state.complete&&state.available&&objectiveReady);
    // Legacy completion/reward wrappers may only pay the explicitly selected job.
    state.ready=state.readyForTurnIn&&this._turnInGrantId===q.id;
    return state;
  };
  G.questsReadyForNpc=function(npc){
    const id=npcId(npc);return W.Content.quests.filter(q=>this.questProgress(q).readyForTurnIn&&this.questTurnInContact(q)?.id===id);
  };
  function rememberReady(g,notify=true){
    let changed=false;
    for(const q of W.Content.quests){
      const state=g.questProgress(q);
      if(state.complete||!state.accepted){if(pending(g).delete(q.id))changed=true;continue;}
      if(!state.readyForTurnIn||pending(g).has(q.id))continue;
      pending(g).add(q.id);changed=true;
      const npc=g.questTurnInContact(q);
      if(notify&&npc)g.ui.toast('Ready to finish: '+q.title+' · speak with '+npc.name+'.','quest');
      if(g.trackedQuest===q.id){const target=g.questTarget(q);if(target)g.marker={x:target.x,y:target.y};if(g.world.isDungeon&&npc)g.dungeonMarker={x:npc.x,y:npc.y};}
    }
    return changed;
  }
  const check=G.checkQuests;
  G.checkQuests=function(){const changed=rememberReady(this);const result=check.call(this);if(changed&&!this._turnInGrantId)this.save(false);return result;};
  const target=G.questTarget;
  G.questTarget=function(q){
    q=entry(q);if(!q)return target.call(this,q);
    if(this.questProgress(q).readyForTurnIn){
      const npc=this.questTurnInContact(q);if(!npc)return null;
      if(this.world.isDungeon){const exit=this.world.locations.find(l=>l.type==='dungeonExit')||this.world.locations[0];return{...exit,label:'Leave the dungeon, then finish with '+npc.name,turnIn:true,npcId:npc.id};}
      return{x:npc.x,y:npc.y,label:'Finish quest · '+npc.name,turnIn:true,npcId:npc.id};
    }
    if(this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id)&&pureConversation(this,q)&&!q.steps){const npc=finalContact(this,q);if(npc&&!this.world.isDungeon)return{x:npc.x,y:npc.y,label:'Speak with '+npc.name,npcId:npc.id};}
    return target.call(this,q);
  };
  const track=G.trackQuest;
  G.trackQuest=function(id){
    const result=track.call(this,id);
    if(result&&this.world.isDungeon&&this.questProgress(id).readyForTurnIn){const npc=this.questTurnInContact(id);if(npc)this.dungeonMarker={x:npc.x,y:npc.y};}
    return result;
  };
  const objective=G.questObjectiveText;
  G.questObjectiveText=function(q){
    q=entry(q);if(!q)return objective.call(this,q);
    if(this.questProgress(q).readyForTurnIn){const npc=this.questTurnInContact(q),town=npc&&surface(this)?.getLocation(npc.townId);return'Objectives complete. '+(this.world.isDungeon?'Leave the dungeon, then ':'')+'Speak with '+(npc?.name||'your quest contact')+(town?' at '+town.name:'')+' and choose Finish quest to collect your rewards.';}
    if(this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id)&&pureConversation(this,q)){const run=this.missionRuns?.[q.id],step=q.steps?.[run?.stepIndex||0],id=step?.targets.find(id=>!run?.completedTargets?.includes(id)),npc=npcAt(this,id)||this.questTurnInContact(q);return'Speak with '+(npc?.name||'the marked cat')+'. '+(conversationTargets(this,q.steps).length>1?'Speak with each marked contact to complete the assignment.':'This conversation completes the assignment.');}
    return objective.call(this,q);
  };
  function canSpeak(g,npc){
    const current=g.npcLocation,p=g.players[g.ui.playerIndex??g.shopPlayer??0]||g.players[0];
    return !g.world.isDungeon&&g.ui.isOpen&&g.ui.menu==='dialogue'&&npc&&current?.id===npc.id&&p&&!p.downed&&p.hp>0&&W.dist(p,npc)<150;
  }
  function canFinish(g,q){return canSpeak(g,g.questTurnInContact(q));}
  function finish(g,q,automatic=false,deferCelebration=false){
    if(!q||g._turnInGrantId||!g.questProgress(q).readyForTurnIn||!canFinish(g,q))return false;
    const run=g.missionRuns?.[q.id];
    if(atReportStage(g,q)){run.stepIndex=q.steps.length;run.completedTargets=[];run.state='complete';run.carry=false;run.channelTarget=null;run.elapsed=0;g.missionCompleted.add(q.id);}
    const recipient=g.players[g.ui.playerIndex??g.shopPlayer??0]||g.players[0],before={gold:recipient.gold||0,materials:recipient.materials||0,cores:recipient.cores||0};
    const rewards={gold:q.rewardGold||100,xp:q.rewardXp||80,materials:0,cores:0,choices:[]};
    // The original completion chain pays gold/XP, coastal supplies and equipment
    // exactly once, keeping existing completed saves and reward claim keys valid.
    g._turnInGrantId=q.id;
    try{check.call(g);}finally{g._turnInGrantId=null;}
    if(!g.completedQuests.has(q.id))return false;
    pending(g).delete(q.id);
    const cacheId=W.CoastalDefense?.cacheId(q),drop=cacheId&&g.drops.find(d=>d.id===cacheId);
    // Receipts include salvage when every equipment choice was already owned.
    rewards.gold=(recipient.gold||0)-before.gold;rewards.materials=(recipient.materials||0)-before.materials;rewards.cores=(recipient.cores||0)-before.cores;rewards.choices=[...(drop?.choices||[])];
    const result={quest:q,rewards,nextContact:g.questNextContact(q),automatic,rewardDropId:drop?.id||null};
    g.save(false);if(!deferCelebration)g.ui.showQuestCelebration?.(q,result);return result;
  }
  G.finishQuestFromNpc=function(id){return finish(this,entry(id));};
  const dropChoice=G.dropRewardChoice;
  G.dropRewardChoice=function(ids,x,y,source,id,extra={}){
    if(extra.coastalDefenseQuest&&extra.coastalDefenseQuest===this._turnInGrantId){const npc=this.questTurnInContact(extra.coastalDefenseQuest);if(npc){x=npc.x+65;y=npc.y+35;source=entry(extra.coastalDefenseQuest).title+' · '+npc.name+'’s reward';}}
    return dropChoice.call(this,ids,x,y,source,id,extra);
  };
  const awardXP=G.awardXP;
  G.awardXP=function(p,amount){const downed=this._turnInGrantId&&p.downed,result=awardXP.call(this,p,amount);if(downed){p.downed=true;p.hp=0;}return result;};
  const interaction=G.handleMissionInteraction;
  G.handleMissionInteraction=function(p){
    // A report/delivery to a named cat opens their conversation, so the player
    // can deliberately collect the reward instead of consuming the interaction.
    const nearby=[];
    for(const q of W.Content.quests){const run=this.missionRuns?.[q.id],step=q.steps?.[run?.stepIndex||0];if(run?.state!=='active'||!step)continue;for(const id of step.targets||[]){if(run.completedTargets?.includes(id))continue;const l=this.world.getLocation(id);if(l&&W.dist(p,l)<105)nearby.push({q,step,l,d:W.dist(p,l)});}}
    nearby.sort((a,b)=>a.d-b.d);const first=nearby[0];
    if(first?.l.type==='npc'&&conversationActions.has(first.step.action)&&(pureConversation(this,first.q)||this.questProgress(first.q).readyForTurnIn))return false;
    return interaction.call(this,p);
  };
  G.completeConversationQuests=function(npc){
    const id=npcId(npc),results=[];
    if(!canSpeak(this,npcAt(this,id)))return results;
    for(const q of W.Content.quests){
      if(!this.acceptedQuests.has(q.id)||this.completedQuests.has(q.id)||!pureConversation(this,q))continue;
      if(q.steps){const run=this.missionRuns[q.id],step=q.steps[run?.stepIndex||0];if(!run||!step||!step.targets.includes(id))continue;
        run.completedTargets=run.completedTargets||[];if(!run.completedTargets.includes(id))run.completedTargets.push(id);
        if(step.targets.every(t=>run.completedTargets.includes(t))){run.stepIndex++;run.completedTargets=[];if(run.stepIndex>=q.steps.length){run.state='complete';run.carry=false;this.missionCompleted.add(q.id);}}
        if(run.state!=='complete'){this.save(false);continue;}
      }else if(finalContact(this,q)?.id!==id)continue;
      this.questCounters['turn-in-recipient:'+q.id]=id;
      pending(this).add(q.id);const result=finish(this,q,true,true);if(result)results.push(result);
    }
    for(const result of results)this.ui.showQuestCelebration?.(result.quest,result);
    return results;
  };
  const interact=G.interact;
  G.interact=function(p){
    const wasOpen=this.ui.isOpen,result=interact.call(this,p);
    if(!wasOpen&&this.ui.isOpen&&this.ui.menu==='dialogue'&&this.npcLocation){rememberReady(this);this.completeConversationQuests(this.npcLocation);}
    return result;
  };
  const accept=G.acceptQuest;
  G.acceptQuest=function(id){
    if(this.acceptedQuests.has(id)&&this.questProgress(id).readyForTurnIn)return this.trackQuest(id);
    const prior=this.missionRuns?.[id],priorEncounter=this.encounterRuns?.[id],result=accept.call(this,id);
    if(result&&this.questProgress(id).readyForTurnIn){if(prior?.state==='complete')this.missionRuns[id]=prior;if(priorEncounter?.state==='complete')this.encounterRuns[id]=priorEncounter;}
    return result;
  };
  const snapshot=G.snapshot;
  G.snapshot=function(){return{...snapshot.call(this),questTurnInVersion:1,readyQuestTurnIns:[...pending(this)].filter(id=>this.acceptedQuests.has(id)&&!this.completedQuests.has(id))};};
  const start=G.start;
  G.start=function(options={}){if(options.load)return start.call(this,options);this.readyQuestTurnIns=new Set();this._turnInGrantId=null;return start.call(this,options);};
  const load=G.load;
  G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;
    const ready=this.readyQuestTurnIns,grant=this._turnInGrantId;let ok;
    this.readyQuestTurnIns=new Set((data.readyQuestTurnIns||[]).filter(id=>W.Content.quests.some(q=>q.id===id)&&data.acceptedQuests?.includes(id)&&!data.completedQuests?.includes(id)));this._turnInGrantId=null;
    try{ok=load.call(this,slot);}finally{if(!ok){this.readyQuestTurnIns=ready;this._turnInGrantId=grant;}}if(ok)rememberReady(this,false);return ok;
  };
  W.QuestTurnIn={version:1,pureConversation,atReportStage};
}());
