(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,quests=()=>W.Content.quests.filter(q=>q.coastalDefense);
  const rewardKey=q=>'coastal:defense-reward:'+q.id,claimKey=q=>'coastal:defense-claimed:'+q.id,cacheId=q=>'coastal-defense-cache:'+q.id;
  const heroes=g=>[...g.players,...(g.reservePlayer?[g.reservePlayer]:[])];
  // Coastal lightning resolves before the original effects handler. Keep the
  // temporary supply target present for the entire combined effects pipeline.
  const updateEffects=G.updateEffects;
  G.updateEffects=function(dt){if(this.paused)return;return W.Encounters.withCampTargets(this,updateEffects,[dt]);};
  function ensureCache(g,q){
    if(!q.rewardChoices||g.questCounters[claimKey(q)])return false;
    const world=g.world.isDungeon?g.overworld:g.world,location=world?.getLocation(q.target),list=g.world.isDungeon?(g.overworldDrops||(g.overworldDrops=[])):g.drops;
    if(!location||list.some(d=>d.id===cacheId(q)))return false;
    const previous=g.drops;g.drops=list;
    try{
      const drop=g.dropRewardChoice(q.rewardChoices,location.x+80,location.y+45,q.title+' · defense treasure',cacheId(q),{coastalDefenseQuest:q.id});
      if(!drop){g.questCounters[claimKey(q)]=1;for(const p of heroes(g)){p.materials+=25;p.cores=(p.cores||0)+1;}}
      return true;
    }finally{g.drops=previous;}
  }
  G.settleCoastalDefenseRewards=function(){
    if(!this.players.length)return false;let changed=false;
    for(const q of quests()){
      const done=this.completedQuests.has(q.id),progress=!done&&this.acceptedQuests.has(q.id)?this.questProgress(q):null;
      if(!done&&!(progress?.available&&progress.ready))continue;
      // These marks are written before checkQuests saves its normal gold/XP
      // reward, so a reload cannot pay half of a reward transaction twice.
      if(!this.questCounters[rewardKey(q)]){
        this.questCounters[rewardKey(q)]=1;
        for(const p of heroes(this)){p.materials+=q.rewardMaterials;p.cores=(p.cores||0)+q.rewardCores;}
        this.ui.toast('Defense supplies recovered · '+q.rewardMaterials+' scrap + '+q.rewardCores+' cores per fighter.','loot');changed=true;
      }
      if(ensureCache(this,q))changed=true;
    }
    return changed;
  };
  const check=G.checkQuests;
  G.checkQuests=function(){const changed=this.settleCoastalDefenseRewards();const result=check.call(this);if(changed)this.save(false);return result;};
  const load=G.load;
  // Other load wrappers still restore cooperative/downed state after this one.
  // Repair the in-memory reward ledger now; the next normal save persists the
  // complete restored game rather than a partially restored player state.
  G.load=function(...args){const ok=load.apply(this,args);if(ok)this.settleCoastalDefenseRewards();return ok;};
  const claim=G.claimReward;
  G.claimReward=function(itemId){
    const pending=this.pendingReward,drop=pending&&this.drops.find(d=>d.id===pending.id),q=drop&&W.Content.quests.find(q=>q.id===drop.coastalDefenseQuest);
    if(!q)return claim.call(this,itemId);
    if(this.questCounters[claimKey(q)])return false;
    if(!drop.choices?.includes(itemId)||!W.Content.equipment.some(i=>i.id===itemId)||heroes(this).every(p=>p.inventory.some(i=>(i.id||i)===itemId)))return claim.call(this,itemId);
    this.questCounters[claimKey(q)]=1;
    const ok=claim.call(this,itemId);if(!ok)delete this.questCounters[claimKey(q)];return ok;
  };
  const open=G.openReward;
  G.openReward=function(drop,...args){
    const q=drop&&W.Content.quests.find(q=>q.id===drop.coastalDefenseQuest);
    if(q&&drop.choices?.length&&drop.choices.every(id=>heroes(this).every(p=>p.inventory.some(i=>(i.id||i)===id))))this.questCounters[claimKey(q)]=1;
    return open.call(this,drop,...args);
  };
  const objective=G.questObjectiveText;
  G.questObjectiveText=function(q){const entry=typeof q==='string'?W.Content.quests.find(e=>e.id===q):q,base=objective.call(this,q),run=entry&&this.encounterRuns?.[entry.id];return entry?.coastalDefense&&run?.state==='active'&&run.phase==='fighting'?base+' '+run.waveName+': '+run.waveBrief:base;};
  W.CoastalDefense={rewardKey,claimKey,cacheId};
})();
