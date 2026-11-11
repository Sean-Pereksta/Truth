(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype;
  const fencer=e=>e&&!e.boss&&W.Content.enemies[e.type]?.role==='fencer';
  function clearTell(g,e){for(const effect of g.effects||[])if(effect.alive&&effect.readableEnemyId===e.id)effect.alive=false;}
  function recovery(g,e,interrupted){
    e.specialMove=null;e.jumpHeight=0;e.stun=0;e.fencerRecovery=1.05;e.fireTimer=Math.max(e.fireTimer||0,1.25);
    e.combatState='recovery';g.setAnim(e,'land');clearTell(g,e);g.text(interrupted?'INTERRUPTED · EXPOSED':'EXPOSED',e.x,e.y-53,'#a9edc0');
  }
  const effect=G.effect;G.effect=function(type,x,y,radius,life,extra={}){return effect.call(this,type,x,y,radius,life,this._fencerTell&&['telegraph','chargeLane'].includes(type)?{...extra,readableEnemyId:this._fencerTell}:extra);};
  const begin=G.beginMove;G.beginMove=function(e,target,kind,windup,duration,damage,radius){
    if(!fencer(e)||kind!=='charge')return begin.call(this,e,target,kind,windup,duration,damage,radius);
    const previous=this._fencerTell;this._fencerTell=e.id;
    try{begin.call(this,e,target,kind,.75,.32,damage,40);}finally{this._fencerTell=previous;}
    if(e.specialMove){e.specialMove.readableFencer=true;this.text('LOCKED LUNGE',e.x,e.y-53,'#ffd197');if(!this.fencerLessonShown){this.fencerLessonShown=true;this.ui.toast('Fencers lock their lunge direction. Sidestep the amber lane, or interrupt the windup with your blade. Their green recovery takes 20% extra damage.');}}
  };
  const advance=G.updateAdvancedEnemy;G.updateAdvancedEnemy=function(e,target,spec,dt){
    if(fencer(e)&&e.fencerRecovery>0){e.fencerRecovery=Math.max(0,e.fencerRecovery-dt);e.anim='land';if(!e.fencerRecovery)e.combatState=null;return true;}
    return advance.call(this,e,target,spec,dt);
  };
  const move=G.updateSpecialMove;G.updateSpecialMove=function(e,target,dt){
    const before=e.specialMove,result=move.call(this,e,target,dt);
    if(before?.readableFencer&&!e.specialMove&&e.hp>0&&!e.dead)recovery(this,e,false);
    return result;
  };
  const effects=G.updateEffects;G.updateEffects=function(dt){
    if(this.paused)return;
    for(const effect of this.effects||[])if(effect.alive&&effect.readableEnemyId){
      const e=this.world.activeEnemies.find(enemy=>enemy.id===effect.readableEnemyId),m=e?.specialMove;
      if(!e||e.dead||!m?.readableFencer){effect.alive=false;continue;}
      // Freeze and stun pause the actor's windup. Its warning must remain until
      // the attack resumes, rather than expiring independently in the pool.
      if(m.windup>0)effect.life=Math.max(effect.life,m.windup+(effect.type==='telegraph'?m.duration:0)+dt);
    }
    return effects.call(this,dt);
  };
  const melee=G.updateMelee;G.updateMelee=function(p,dt){const previous=this._fencerMeleeOwner;this._fencerMeleeOwner=p;try{return melee.call(this,p,dt);}finally{this._fencerMeleeOwner=previous;}};
  const damage=G.damageEnemy;G.damageEnemy=function(e,amount,p,...args){
    const vulnerable=fencer(e)&&e.fencerRecovery>0,interrupt=fencer(e)&&e.specialMove?.readableFencer&&e.specialMove.windup>0&&p===this._fencerMeleeOwner,hp=e?.hp;
    const result=damage.call(this,e,amount*(vulnerable?1.2:1),p,...args);
    if(interrupt&&e.hp<hp&&e.hp>0&&!e.dead)recovery(this,e,true);
    if(e?.dead)clearTell(this,e);
    return result;
  };
  const damagePlayer=G.damagePlayer;G.damagePlayer=function(p,amount,source){const down=p.downed,result=damagePlayer.call(this,p,amount,source);if(!down&&p.downed&&fencer(source))this.ui.toast('Downed by a Fencer lunge. Dodge across the amber lane, then attack during its green recovery.','error');return result;};
  if(W.Renderer?.prototype.drawActor){const R=W.Renderer.prototype,draw=R.drawActor;R.drawActor=function(e,isPlayer=false,...args){const result=draw.call(this,e,isPlayer,...args);if(!isPlayer&&fencer(e)&&e.hp>0&&e.fencerRecovery>0){const c=this.ctx;c.save();c.strokeStyle='#a9edc0';c.lineWidth=2;c.globalAlpha=.8;c.beginPath();c.ellipse(e.x,e.y+3,30,12,0,0,Math.PI*2);c.stroke();c.restore();}return result;};}
  W.ReadableCombat={fencerWindup:.75,fencerRecovery:1.05,recoveryDamageMultiplier:1.2};
})();
