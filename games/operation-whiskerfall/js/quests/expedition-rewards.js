(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype;
  G.syncExpeditionRewards=function(){let changed=false;for(const [questId,itemId]of Object.entries(W.Content.expeditionRewardSources||{})){if(!this.completedQuests?.has(questId))continue;const item=W.Content.equipment.find(v=>v.id===itemId);if(!item)continue;let fresh=false;for(const p of [...(this.players||[]),...(this.reservePlayer?[this.reservePlayer]:[])]){p.expeditionRewardClaims=Array.isArray(p.expeditionRewardClaims)?p.expeditionRewardClaims:[];if(p.expeditionRewardClaims.includes(questId))continue;p.expeditionRewardClaims.push(questId);changed=true;if(!p.inventory.some(v=>(v.id||v)===itemId)){p.inventory.push({id:itemId,upgrade:0});fresh=true;}}if(fresh)this.revealItem?.(item,'Expedition reward · '+(W.Content.quests.find(q=>q.id===questId)?.title||item.name));}return changed;};
  for(const method of ['checkQuests','finishQuestFromNpc','load','toggleCoop'])if(G[method]){const previous=G[method];G[method]=function(...args){const result=previous.apply(this,args);if(result!==false&&this.syncExpeditionRewards())this.save?.(false);return result;};}
})();
