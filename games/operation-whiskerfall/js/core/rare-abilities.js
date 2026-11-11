(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,U=W.UI?.prototype,R=W.Renderer?.prototype;
  const ids=['frost_breath','aurora_well'],living=e=>e&&e.hp>0&&!e.dead&&!e.downed;
  const rare=a=>a?.questOnly&&ids.includes(a.id),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let frost=new WeakMap();
  function initialize(p){if(!p)return;p.rareAbilityClaims=Array.isArray(p.rareAbilityClaims)?[...new Set(p.rareAbilityClaims.filter(id=>ids.includes(id)))]:[];}
  G.syncRareAbilities=function(announce=false){
    const gained=[];
    for(const p of [...(this.players||[]),this.reservePlayer].filter(Boolean)){
      initialize(p);p.unlockedAbilities=Array.isArray(p.unlockedAbilities)?p.unlockedAbilities:[];
      for(const [quest,id]of Object.entries(W.Content.rareAbilityRewards||{}))if(this.completedQuests?.has(quest)){
        const fresh=!p.rareAbilityClaims.includes(id);if(fresh)p.rareAbilityClaims.push(id);
        if(!p.unlockedAbilities.includes(id))p.unlockedAbilities.push(id);
        if(fresh)gained.push({p,a:W.Content.abilities.find(a=>a.id===id)});
      }
    }
    if(announce&&gained.length){const names=[...new Set(gained.map(v=>v.a?.name).filter(Boolean))];this.ui?.toast?.('RARE ABILITY EARNED · '+names.join(' + ')+' · Open Skills to equip. Every hero keeps their own loadout.','ability');}
    return gained.length>0;
  };
  const status=G.abilityStatus;
  G.abilityStatus=function(p,index){
    const a=W.Content.abilities[index];if(!rare(a))return status.call(this,p,index);
    const earned=!!p&&(p.rareAbilityClaims||[]).includes(a.id)&&(p.unlockedAbilities||[]).includes(a.id),eligible=(p?.level||0)>=a.level;
    return{unlocked:earned&&eligible,canUnlock:false,cost:0,level:a.level,questOnly:true,earned,questId:a.questId,reason:!earned?'Complete '+a.questName+' to earn this rare ability.':!eligible?'Earned · requires hero level '+a.level:'Earned through '+a.questName};
  };
  const unlock=G.unlockAbility;
  G.unlockAbility=function(playerIndex,index){const a=W.Content.abilities[index];if(!rare(a))return unlock.call(this,playerIndex,index);const state=this.abilityStatus(this.players[playerIndex],index);if(!state.unlocked)this.ui?.toast?.(state.reason,'error');return state.unlocked;};
  G.applyExpeditionFrost=function(e,hits=1){
    if(!living(e))return false;
    e.chillTime=Math.max(e.chillTime||0,2.5);
    if(e.boss||e.dungeonBoss||e.bossIndex!=null)return false;
    const now=this.time||0;let state=frost.get(e);if(!state){state={hits:0,until:0,readyAt:0};frost.set(e,state);}
    if(now<state.readyAt||(e.freezeResist||0)>0)return false;
    if(now>state.until)state.hits=0;
    state.hits+=hits;state.until=now+2.5;
    if(state.hits<4)return false;
    state.hits=0;state.readyAt=now+4;
    // An armored roll keeps its established warning/recovery. Chill still
    // slows it, but freezing cannot silently cancel its committed collision.
    if(e.combatState==='rolling'||e.charging>0)return false;
    e.freeze=Math.max(e.freeze||0,1.1);e.freezeResist=Math.max(e.freezeResist||0,4);
    this.effect('frostNova',e.x,e.y,40,.35,{color:'#b7f3ff'});return true;
  };
  G.applyExpeditionChill=function(e,duration=1.5){if(living(e))e.chillTime=Math.max(e.chillTime||0,Math.max(0,Math.min(4,duration)));};
  const apply=G.applyEnemyStatus;
  G.applyEnemyStatus=function(e,b){const result=apply.call(this,e,b);if(b?.expeditionGun==='winterswhisper')this.applyExpeditionFrost(e,1);return result;};
  function cast(g,p,a){
    if(a.id==='frost_breath'){
      const damage=a.damage*(1+p.level*.08+(p.skills?.tactics||0)*.08);
      const effect=g.effect('rareFrostBreath',p.x,p.y,a.radius,a.duration,{owner:p.id,angle:p.angle||0,damage,pulseIndex:0});
      if(!effect)return false;g.audio.play('ice');return true;
    }
    if(a.id==='aurora_well'){
      // One well per caster. Other heroes may place a second well, but the
      // update collects recipients before healing so overlapping fields do not stack.
      // Reserve the replacement before retiring a live well. A full effect
      // pool must not consume a cooldown or destroy an existing sanctuary.
      const effect=g.effect('rareAuroraWell',p.x,p.y,a.radius,a.duration,{owner:p.id});
      if(!effect)return false;
      for(const e of g.effects)if(e!==effect&&e.alive&&e.type==='rareAuroraWell'&&e.owner===p.id)e.alive=false;
      g.audio.play('heal');return true;
    }
    return false;
  }
  const updateEffects=G.updateEffects;
  G.updateEffects=function(dt){
    if(dt>0&&!this.paused){
      const healing=new Map();
      for(const effect of this.effects){if(!effect.alive||!['rareFrostBreath','rareAuroraWell'].includes(effect.type))continue;
        const p=this.players[effect.owner];if(!living(p)){effect.alive=false;continue;}
        if(effect.type==='rareFrostBreath'){
          effect.x=p.x;effect.y=p.y;const end=effect.maxLife-effect.life+Math.min(dt,effect.life);
          while(effect.pulseIndex<3&&end+1e-8>=effect.pulseIndex*.3){
            effect.pulseIndex++;
            const foes=this.grid.query(effect.x,effect.y,effect.radius).filter(e=>living(e)&&Math.hypot(e.x-effect.x,e.y-effect.y)<=effect.radius&&Math.abs(W.wrapAngle(Math.atan2(e.y-effect.y,e.x-effect.x)-effect.angle))<=Math.PI/5&&!this.pointLocked(e.x,e.y)&&this.lineOfSight(effect,e));
            for(const e of foes){this.damageEnemy(e,effect.damage,p);this.applyExpeditionFrost(e,2);}
          }
        }else{
          const tick=Math.max(0,Math.min(dt,effect.life));
          for(const ally of [...this.players,...(this.allies||[])])if(living(ally)&&ally.maxHp>0&&Math.hypot(ally.x-effect.x,ally.y-effect.y)<=effect.radius&&!this.pointLocked(ally.x,ally.y)&&this.lineOfSight(effect,ally))healing.set(ally,Math.max(healing.get(ally)||0,tick));
        }
      }
      for(const [ally,tick]of healing){ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.06*tick);ally.chillTime=0;ally.slowTime=0;}
    }
    return updateEffects.call(this,dt);
  };
  for(const method of ['checkQuests','finishQuestFromNpc']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false&&this.syncRareAbilities(true))this.save(false);return result;};}
  for(const method of ['start','load','toggleCoop']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false){this.syncRareAbilities(false);if(method!=='toggleCoop')frost=new WeakMap();}return result;};}
  for(const method of ['enterDungeon','leaveDungeon','fastTravel','defeat']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false)frost=new WeakMap();return result;};}
  if(W.Save?.validPlayer){const valid=W.Save.validPlayer;W.Save.validPlayer=function(p){return valid.call(this,p)&&(p.rareAbilityClaims===undefined||Array.isArray(p.rareAbilityClaims)&&p.rareAbilityClaims.length<=2&&new Set(p.rareAbilityClaims).size===p.rareAbilityClaims.length&&p.rareAbilityClaims.every(id=>ids.includes(id)));};}
  if(U){
    const card=U.abilityCard;
    U.abilityCard=function(a,index){
      if(!rare(a))return card.call(this,a,index);
      const p=this.player(),s=this.abilityStatus(p,index),primary=p.ability===index,secondary=p.ability2===index,selected=this.selectedAbility===index;
      return `<article class="field-ability-card rare-ability-card ${s.unlocked?'learned':'locked'} ${selected?'inspected':''}"><button class="ability-heading" data-action="ability-inspect" data-value="${index}" aria-pressed="${selected}" aria-label="Inspect ${escape(a.name)}. ${escape(s.reason)}">${this.abilityGlyph(a)}<span><small>${escape(a.category)} · RARE QUEST REWARD</small><strong>${escape(a.name)}</strong></span><span class="ability-state">${s.earned?'EARNED':'QUEST LOCKED'}</span></button>${this.abilityArtwork(a)}<p class="ability-effect">${escape(a.description)}</p><dl class="ability-metrics"><div><dt>Cooldown</dt><dd>${a.cooldown}s</dd></div><div><dt>${a.range?'Range':'Radius'}</dt><dd>${a.radius}</dd></div><div><dt>Hero level</dt><dd>${a.level}</dd></div></dl><section class="rare-ability-source"><strong>${escape(a.rewardStatement)}</strong><p>${escape(a.discoveryClue)}</p><small>Complete ${escape(a.questName)}. This reward costs no skill points and cannot be purchased with them.</small></section><p class="ability-requirement ${s.unlocked?'unlocked':''}">${escape(s.reason)}</p>${s.earned?`<div class="ability-actions"><button data-action="ability-primary" data-value="${index}" class="${primary?'selected':'primary'}" aria-pressed="${primary}" ${primary||!s.unlocked?'disabled':''}>${primary?'✓ Primary equipped':'Equip primary'}</button><button data-action="ability-secondary" data-value="${index}" class="${secondary?'selected':''}" aria-pressed="${secondary}" ${secondary||!s.unlocked?'disabled':''}>${secondary?'✓ Secondary equipped':'Equip secondary'}</button></div>`:'<p class="small-note">Discover the expedition to earn this power permanently for each hero.</p>'}</article>`;
    };
  }
  if(R){const draw=R.drawEffect;R.drawEffect=function(e,front){
    if(!['rareFrostBreath','rareAuroraWell'].includes(e.type))return draw.call(this,e,front);
    if(front)return;const c=this.ctx,fade=Math.min(1,e.life*3),time=e.maxLife-e.life;c.save();
    if(e.type==='rareFrostBreath'){
      c.translate(e.x,e.y);c.rotate(e.angle);const reach=e.radius,half=Math.PI/5;c.fillStyle='rgba(155,227,250,'+(.12*fade)+')';c.strokeStyle='rgba(190,245,255,'+(.6*fade)+')';c.lineWidth=2;c.beginPath();c.moveTo(15,0);c.arc(0,0,reach,-half,half);c.closePath();c.fill();
      for(let i=0;i<11;i++){const q=(time*1.7+i/11)%1,a=-half+half*2*((i*7%11)/10),x=25+Math.cos(a)*reach*q,y=Math.sin(a)*reach*q;c.beginPath();c.moveTo(x-5,y);c.lineTo(x+5,y);c.moveTo(x,y-5);c.lineTo(x,y+5);c.stroke();}
    }else{c.strokeStyle='rgba(156,244,218,'+(.7*fade)+')';c.fillStyle='rgba(111,217,199,'+(.09*fade)+')';c.lineWidth=2;c.beginPath();c.ellipse(e.x,e.y,e.radius,e.radius*.72,0,0,Math.PI*2);c.fill();c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.3,x=e.x+Math.cos(a)*e.radius*.8,y=e.y+Math.sin(a)*e.radius*.56;c.beginPath();c.moveTo(x-5,y);c.lineTo(x+5,y);c.moveTo(x,y-5);c.lineTo(x,y+5);c.stroke();}}
    c.restore();
  };}
  W.RareAbilities={ids,initialize,cast,frostState:e=>frost.get(e)};
})();
