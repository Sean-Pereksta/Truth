(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,U=W.UI?.prototype;
  const ids=['airstrike','medic_drop','shockwave','dashstep','aegis_field'];
  const supports=id=>ids.includes(id),number=n=>Number.isFinite(Number(n))?Number(n):0;
  const format=n=>Number(n.toFixed(2)).toString();
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function initialize(p){
    if(!p)return;
    const old=p.abilityRanks,clean={};
    if(old&&typeof old==='object'&&!Array.isArray(old))for(const id of ids)if(Number.isInteger(old[id])&&old[id]>=2&&old[id]<=3)clean[id]=old[id];
    p.abilityRanks=clean;p.abilityRankVersion=1;
    // Existing heroes retain their exact point balance. Rank one is their
    // original learned ability, so this migration never grants repeat points.
  }
  function rank(p,id){const value=p?.abilityRanks?.[id];return supports(id)&&Number.isInteger(value)&&value>=1&&value<=3?value:1;}
  function definition(a,r){
    const n=r-1,e={...a,cooldown:a.cooldown*(1-n*.05),rank:r};
    if(a.id==='airstrike'){e.damage=a.damage*(1+n*.15);e.radius=a.radius*(r===3?1.15:1);}
    if(a.id==='shockwave'){e.damage=a.damage*(1+n*.15);e.radius=a.radius*(1+n*.1);e.controlSeconds=.45+n*.15;}
    if(a.id==='medic_drop'){e.radius=a.radius+n*25;e.damage=0;e.healFraction=.5+n*.1;}
    if(a.id==='dashstep'){e.radius=a.radius+n*40;e.dodgeProtection=.38+n*.06;}
    if(a.id==='aegis_field'){e.barrierFraction=.7+n*.1;e.barrierFlat=40+n*10;e.barrierSeconds=8+n;}
    for(const field of ['damage','radius','cooldown'])if(Number.isFinite(e[field]))e[field]=Math.round(e[field]*100)/100;
    return e;
  }
  function description(a,r){
    const e=definition(a,r),cooldown=format(e.cooldown)+'s base cooldown';
    if(a.id==='airstrike')return format(e.damage)+' base damage per strike; '+format(e.radius)+' radius; '+cooldown+'. Hero level and explosives training still scale damage.';
    if(a.id==='shockwave')return format(e.damage)+' base damage; '+format(e.radius)+' radius; '+format(e.controlSeconds)+'s stun on ordinary enemies; '+cooldown+'. Boss stun stays 0.08s.';
    if(a.id==='medic_drop')return Math.round(e.healFraction*100)+'% max-health healing + 20 per Support rank; '+format(e.radius+100)+' healing range; '+cooldown+(r>1?'. Nearby resistance NPCs receive '+Math.round(e.healFraction*100)+'% max-health healing.':'.');
    if(a.id==='dashstep')return format(e.radius)+' dash distance; '+format(e.dodgeProtection)+'s protection; '+cooldown+'. Walls and campaign seals still stop the dash.';
    if(a.id==='aegis_field')return Math.round(e.barrierFraction*100)+'% max health + '+e.barrierFlat+' damage absorption; '+e.barrierSeconds+'s duration; '+cooldown+'.';
    return '';
  }
  G.abilityUpgradeStatus=function(p,index){
    const a=W.Content.abilities[index];if(!p||!a||!supports(a.id)||!Number.isInteger(Number(index)))return{supported:false,canUpgrade:false,reason:'This ability has no rank upgrades in this release.'};
    const r=rank(p,a.id),next=Math.min(3,r+1),cost=r===1?1:2,level=(a.level||1)+(r===1?1:3),learned=this.abilityStatus(p,index).unlocked;
    const reason=!learned?'Learn this ability first.':r===3?'Maximum rank.':p.level<level?'Requires hero level '+level+'.':number(p.skillPoints)<cost?'Requires '+cost+' skill points.':'';
    return{supported:true,rank:r,nextRank:next,cost:r===3?0:cost,level,canUpgrade:!reason,reason,current:description(a,r),next:description(a,next),effective:definition(a,r)};
  };
  G.upgradeAbility=function(playerIndex,index){
    const p=this.players[playerIndex];if(!p)return false;initialize(p);
    const state=this.abilityUpgradeStatus(p,index);if(!state.canUpgrade){this.ui.toast(state.reason,'error');return false;}
    const a=W.Content.abilities[index];p.skillPoints-=state.cost;p.abilityRanks[a.id]=state.nextRank;
    this.audio.play('level');this.ui.toast(a.name+' · Rank '+state.nextRank,'ability');this.save(false);return true;
  };
  G.abilityUpgradeRefund=function(p){return ids.reduce((sum,id)=>sum+(rank(p,id)===3?3:rank(p,id)===2?1:0),0);};
  G.resetAbilityUpgrades=function(playerIndex){
    const p=this.players[playerIndex];if(!p)return false;const refund=this.abilityUpgradeRefund(p);if(!refund)return false;
    initialize(p);p.abilityRanks={};p.skillPoints=number(p.skillPoints)+refund;
    this.ui.toast('Ability ranks reset · '+refund+' skill points returned. Learned abilities and cooldowns are retained.','ability');this.save(false);return true;
  };
  const use=G.useAbility;
  G.useAbility=function(p,slot='ability'){
    const index=p?.[slot],base=W.Content.abilities[index];if(!base||!supports(base.id)||rank(p,base.id)===1)return use.call(this,p,slot);
    const r=rank(p,base.id),effective=definition(base,r),controlled=base.id==='shockwave'?this.grid.query(p.x,p.y,effective.radius+40).filter(enemy=>enemy.hp>0&&!enemy.dead&&!enemy.boss&&!this.pointLocked(enemy.x,enemy.y)&&enemy.combatState!=='rolling'&&Math.hypot(enemy.x-p.x,enemy.y-p.y)<=effective.radius+12&&this.lineOfSight(p,enemy)):[];
    // Casting is synchronous. A per-cast definition feeds the existing ability
    // and armor pipeline; delayed effects capture their damage and geometry.
    // Restore in finally so neither co-op hero nor the catalogue inherits it.
    W.Content.abilities[index]=effective;let cast;
    try{cast=use.call(this,p,slot);}finally{W.Content.abilities[index]=base;}
    if(!cast)return cast;
    if(base.id==='medic_drop'){
      const extra=effective.healFraction-.5;
      for(const ally of this.players)if(!ally.downed&&Math.hypot(ally.x-p.x,ally.y-p.y)<effective.radius+100)ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*extra);
      for(const ally of this.allies||[])if(ally.hp>0&&ally.maxHp>0&&Math.hypot(ally.x-p.x,ally.y-p.y)<effective.radius+100)ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*effective.healFraction);
      for(const effect of this.effects||[])if(effect.alive&&effect.type==='heal'&&effect.owner===p.id&&effect.life===1.8)effect.radius=effective.radius+100;
    }
    if(base.id==='dashstep')p.invuln=Math.max(p.invuln||0,effective.dodgeProtection);
    if(base.id==='aegis_field'){
      p.aegisHp=p.maxHp*effective.barrierFraction+effective.barrierFlat;p.aegisTime=effective.barrierSeconds;
      for(const effect of this.effects||[])if(effect.alive&&effect.type==='aegisField'&&effect.owner===p.id)effect.life=effect.maxLife=effective.barrierSeconds;
    }
    if(base.id==='shockwave')for(const enemy of controlled)if(enemy.hp>0&&!enemy.dead)enemy.stun=Math.max(enemy.stun||0,effective.controlSeconds);
    for(const field of ['ability','ability2'])if(p[field]===index)p.cooldowns[field]=Math.max(p.cooldowns[field]||0,p.abilityCooldowns?.[base.id]||0);
    return cast;
  };
  for(const method of ['newPlayer','load','toggleCoop'])if(G[method]){const original=G[method];G[method]=function(...args){const result=original.apply(this,args);if(method==='newPlayer')initialize(result);else if(result!==false){for(const p of this.players||[])initialize(p);initialize(this.reservePlayer);}return result;};}
  if(W.Save?.validPlayer){const valid=W.Save.validPlayer;W.Save.validPlayer=function(p){return valid.call(this,p)&&(p.abilityRanks===undefined||p.abilityRanks&&typeof p.abilityRanks==='object'&&!Array.isArray(p.abilityRanks)&&Object.entries(p.abilityRanks).every(([id,r])=>supports(id)&&Number.isInteger(r)&&r>=1&&r<=3));};}
  if(U){
    const card=U.abilityCard;U.abilityCard=function(a,index){
      const p=this.player(),state=this.game.abilityUpgradeStatus(p,index);if(!state.supported)return card.call(this,a,index);
      const metrics={...a,...state.effective,description:state.current};if(a.id==='medic_drop')metrics.radius=state.effective.radius+100;if(a.id==='aegis_field')metrics.radius=0;
      const original=card.call(this,metrics,index);
      const details='<section class="ability-rank-panel" aria-label="'+escape(a.name)+' upgrades"><p><strong>Rank '+state.rank+' / 3</strong> · '+escape(state.current)+'</p>'+(state.rank<3?'<p><strong>Next: rank '+state.nextRank+'</strong> · '+escape(state.next)+'</p><p>'+state.cost+' skill point'+(state.cost===1?'':'s')+' · Hero level '+state.level+' · Ability learned</p><button data-action="ability-upgrade" data-value="'+index+'" class="primary" '+(state.canUpgrade?'':'disabled')+'>Upgrade to rank '+state.nextRank+' · '+state.cost+' point'+(state.cost===1?'':'s')+'</button>'+(state.reason?'<small>'+escape(state.reason)+'</small>':''):'<p>Maximum rank reached.</p>')+'</section>';
      return original.replace('</article>',details+'</article>');
    };
    const overview=U.skillOverview;U.skillOverview=function(){const p=this.player(),refund=this.game.abilityUpgradeRefund(p);return overview.call(this)+'<div class="ability-rank-summary"><p>Ability mastery: Airstrike, Medic Drop, Shockwave, Dashstep and Aegis Field have three ranks. Rank 2 costs 1 point; rank 3 costs 2. Learning, passive training and mastery share your skill points. Upgrades keep current cooldowns.</p><button data-action="ability-ranks-reset" '+(!refund?'disabled':'')+'>Reset ability ranks · refund '+refund+' point'+(refund===1?'':'s')+'</button><small>Free reassignment. Keeps learned abilities, equipped slots and passive training.</small></div>';};
    const click=U.click;U.click=function(event){
      const button=event.target?.closest?.('button[data-action]');if(!button||button.disabled)return click.call(this,event);
      if(button.dataset.action==='ability-upgrade'){const index=Number(button.dataset.value);this.game.upgradeAbility(this.playerIndex,index);const s=this.game.abilityUpgradeStatus(this.player(),index);this.refreshAbilityCard(index,s.canUpgrade?'ability-upgrade':'ability-inspect');return;}
      if(button.dataset.action==='ability-ranks-reset'){this.game.resetAbilityUpgrades(this.playerIndex);this.refreshAbilityCard(this.selectedAbility??0);return;}
      return click.call(this,event);
    };
  }
  W.AbilityUpgrades={ids,initialize,rank,definition,description};
})();
