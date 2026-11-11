(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,patterns=()=>W.Content.heroArmorPatterns||[];
  let states=new WeakMap();
  const definition=p=>patterns().find(item=>item.id===(p?.equipment?.armor?.id||p?.equipment?.armor));
  const style=p=>definition(p)?.armorStyle||null;
  function state(p){const current=style(p);let value=states.get(p);if(!value||value.style!==current){value={style:current,brace:0,stormUntil:0,guardUntil:0,wardUntil:0,wardHp:0};states.set(p,value);}return value;}
  const owns=(p,id)=>p.inventory?.some(item=>(item.id||item)===id);
  const active=(g,p)=>p&&!p.downed&&p.hp>0&&g.players.includes(p);
  G.heroArmorStatus=function(playerIndex,id){
    const p=typeof playerIndex==='object'?playerIndex:this.players[playerIndex],pattern=patterns().find(item=>item.id===id);
    if(!p||!pattern)return {available:false,reason:'Unknown armor pattern.'};
    const owned=owns(p,id),equipped=(p.equipment?.armor?.id||p.equipment?.armor)===id,bosses=this.bossVictories(),cost=pattern.cost;
    const reason=p.downed?'Revive before using the forge.':!this.nearForge(p)?'Visit a resistance forge.':owned?'':bosses<pattern.commanders?'Defeat '+pattern.commanders+' commanders to unlock this pattern.':p.gold<cost.gold||p.materials<cost.materials||(p.cores||0)<cost.cores?'Gather '+cost.gold+' gold, '+cost.materials+' scrap and '+cost.cores+' rare cores.':'';
    return {pattern,owned,equipped,bosses,cost,reason,available:!reason};
  };
  G.craftHeroArmor=function(playerIndex,id){
    const p=this.players[playerIndex],status=this.heroArmorStatus(playerIndex,id);
    if(!status.available){this.ui.toast(status.reason,'error');return false;}
    if(status.owned)return this.equip(playerIndex,id);
    const item=W.Content.equipment.find(item=>item.id===id),cost=status.cost;
    p.gold-=cost.gold;p.materials-=cost.materials;p.cores-=cost.cores;p.inventory.push({id,upgrade:0});
    p.heroArmorCrafted=[...new Set([...(p.heroArmorCrafted||[]),id])];
    this.revealItem(item,'Forged by the resistance');const ok=this.equip(playerIndex,id);this.audio.play('level');return ok;
  };
  const recalculate=G.recalculate;G.recalculate=function(p){const result=recalculate.call(this,p);state(p);return result;};
  const equip=G.equip;G.equip=function(playerIndex,itemId,...args){const p=this.players[playerIndex]||this.players[0],before=style(p),result=equip.call(this,playerIndex,itemId,...args);if(result&&before!==style(p))states.delete(p);return result;};
  const weapon=G.weapon;G.weapon=function(p){const gun=weapon.call(this,p),multiplier=(style(p)==='spellweaver'?.85:1)*(state(p).shotMultiplier||1);return multiplier===1?gun:{...gun,damage:(gun.damage||15)*multiplier};};
  const dodge=G.armorDodge;G.armorDodge=function(p){const result=dodge.call(this,p),s=state(p);s.brace=0;if(active(this,p)&&s.style==='stormrunner'){const take=Math.max(0,Math.min(2,p.reserve||0,(this.weapon(p).magazine||12)-p.ammo));p.ammo+=take;p.reserve-=take;s.stormUntil=this.time+3;this.effect('shockwave',p.x,p.y,52,.3,{color:'#7ce4df'});this.text('STORM SHOT',p.x,p.y-48,'#8dece1');}return result;};
  const shoot=G.shoot;G.shoot=function(p,...args){
    const s=state(p),empowered=s.style==='stormrunner'&&s.stormUntil>this.time,ammo=p.ammo;
    s.shotMultiplier=empowered?1.35:1;
    try{return shoot.call(this,p,...args);}finally{s.shotMultiplier=1;if(empowered&&p.ammo<ammo){s.stormUntil=0;this.effect('shockwave',p.x,p.y,36,.2,{color:'#9df3e8'});}}
  };
  const updatePlayer=G.updatePlayer;G.updatePlayer=function(p,input,dt){
    if(this.paused||!(dt>0))return;
    const s=state(p),mx=Number(input?.mx)||0,my=Number(input?.my)||0,length=Math.hypot(mx,my),standing=active(this,p)&&length<.15&&!input?.dodge&&!(p.dodgeTime>0)&&!(p.meleeCommit>0),wasBraced=s.brace>=.35;
    if(s.style==='bastion')s.brace=standing?Math.min(.35,s.brace+dt):0;else s.brace=0;
    if(s.brace>=.35&&!wasBraced)this.text('BRACED',p.x,p.y-49,'#eed08d');
    let next=input;
    if(s.style==='bastion'&&!input?.dodge&&!(p.dodgeTime>0)){const normalization=Math.max(1,length);next={...input,mx:mx/normalization*.86,my:my/normalization*.86};}
    const x=p.x,y=p.y,result=updatePlayer.call(this,p,next,dt);
    if(Math.hypot(p.x-x,p.y-y)>1||p.downed||p.meleeCommit>0||p.dodgeTime>0)s.brace=0;
    if(p.downed){s.stormUntil=s.guardUntil=s.wardUntil=s.wardHp=0;}
    return result;
  };
  const damagePlayer=G.damagePlayer;G.damagePlayer=function(p,amount,source){
    if(!active(this,p))return damagePlayer.call(this,p,amount,source);
    const s=state(p),eligible=p.invuln<=0&&!(p.smokeTime>0)&&!this.safeZoneAt(p.x,p.y),hp=p.hp;
    const guarded=eligible&&s.style==='bastion'&&s.brace>=.35&&!(p.meleeCommit>0)&&!(p.dodgeTime>0)&&source&&Math.hypot(source.x-p.x,source.y-p.y)>.001&&Math.abs(W.wrapAngle(Math.atan2(source.y-p.y,source.x-p.x)-(p.angle||0)))<=Math.PI*.39;
    if(guarded)amount*=.7;
    if(eligible&&s.style==='spellweaver'&&s.wardUntil>this.time&&s.wardHp>0){const absorbed=Math.min(s.wardHp,amount);s.wardHp-=absorbed;amount-=absorbed;this.effect('shockwave',p.x,p.y,45,.2,{color:'#d8b8ff'});if(amount<=0)return;}
    const result=damagePlayer.call(this,p,amount,source);
    if(guarded&&p.hp<hp&&!p.downed){s.guardUntil=this.time+3;this.text('RIPOSTE READY',p.x,p.y-48,'#f5d18b');}
    return result;
  };
  const melee=G.meleeAttack;G.meleeAttack=function(p,...args){const before=p.meleeStrike,result=melee.call(this,p,...args),s=state(p);if(p.meleeStrike&&p.meleeStrike!==before){s.brace=0;if(s.style==='bastion'&&s.guardUntil>this.time){s.riposteSwing=p.meleeStrike;s.guardUntil=0;}}return result;};
  const updateMelee=G.updateMelee;G.updateMelee=function(p,dt){const swing=p.meleeStrike,s=state(p),boost=s.style==='bastion'&&swing&&s.riposteSwing===swing&&swing.windup<=dt;s.meleeMultiplier=boost?1.3:1;try{return updateMelee.call(this,p,dt);}finally{s.meleeMultiplier=1;if(!p.meleeStrike)s.riposteSwing=null;}};
  const damageEnemy=G.damageEnemy;G.damageEnemy=function(e,amount,p,...args){return damageEnemy.call(this,e,amount*(p?state(p).meleeMultiplier||1:1),p,...args);};
  const use=G.useAbility;G.useAbility=function(p,slot='ability'){
    const result=use.call(this,p,slot);if(!result||style(p)!=='spellweaver'||!active(this,p))return result;
    const a=W.Content.abilities[p[slot]],cooldown=(p.abilityCooldowns?.[a.id]||p.cooldowns[slot])*.8;
    if(p.abilityCooldowns)p.abilityCooldowns[a.id]=cooldown;for(const field of ['ability','ability2'])if(p[field]===p[slot])p.cooldowns[field]=cooldown;
    const s=state(p);s.wardHp=Math.min(75,35+p.level*2);s.wardUntil=this.time+2.5;this.effect('shockwave',p.x,p.y,70,.5,{color:'#d2b0ff'});this.text('SPELLWARD',p.x,p.y-50,'#d8b8ff');return result;
  };
  const clear=G.clearPlayerCombat;if(clear)G.clearPlayerCombat=function(p){states.delete(p);delete p._heroArmorShotMultiplier;delete p._heroArmorMeleeMultiplier;return clear.call(this,p);};
  for(const method of ['start','load','defeat','enterDungeon','leaveDungeon','fastTravel','toggleCoop'])if(G[method]){const original=G[method];G[method]=function(...args){const world=this.world,result=original.apply(this,args);if(result!==false&&(method==='start'||result||world!==this.world||method==='toggleCoop'))states=new WeakMap();return result;};}
  W.HeroArmor={styleFor:style,stateFor:state,reset:()=>{states=new WeakMap();}};
})();
