(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const actions=['dodge','ability','ability2','grenade','melee'];
  let buffers=new WeakMap();
  const clear=()=>{buffers=new WeakMap();};
  const updatePlayer=G.updatePlayer;
  G.updatePlayer=function(p,input,dt){
    if(this.paused||this.ui?.isOpen){buffers.delete(p);return;}
    if(p.downed){buffers.delete(p);return updatePlayer.call(this,p,input,dt);}
    let state=buffers.get(p);if(!state||state.world!==this.world){state={world:this.world,pending:{}};buffers.set(p,state);}
    const pending=state.pending,step=Math.max(0,dt||0);
    for(const key of actions){
      if(pending[key]){pending[key].life-=step;if(pending[key].life<=0)delete pending[key];}
      if(input?.[key])pending[key]={life:.14,heavy:!!input.heavy};
    }
    const next=Object.assign({},input);for(const key of actions)next[key]=false;
    // A short input buffer bridges recovery frames without cancelling attacks,
    // changing cooldowns, extending invulnerability or slowing enemy simulation.
    const ready=key=>{
      if((p.meleeCommit||0)>step+1e-6||(p.cooldowns?.[key]||0)>step+1e-6)return false;
      if(key!=='dodge'&&(p.dodgeTime||0)>step+1e-6)return false;
      if(key==='ability'||key==='ability2'){
        const ability=W.Content.abilities[p[key]];
        return ability&&this.abilityStatus(p,p[key]).unlocked&&(p.jamTime||0)<=step&&(p.abilityCooldowns?.[ability.id]||0)<=step;
      }
      if(key==='grenade')return p.grenades>0;
      return true;
    };
    const selected=actions.find(key=>pending[key]&&ready(key));
    if(selected){next[selected]=true;if(selected==='melee')next.heavy=pending[selected].heavy;}
    const result=updatePlayer.call(this,p,next,dt);
    // A failed target-dependent cast is an attempted action, not a held request.
    // Discard it so it cannot starve a queued melee or grenade on later frames.
    if(selected)delete pending[selected];
    if(p.downed||this.paused||this.ui?.isOpen)buffers.delete(p);
    return result;
  };
  for(const method of ['load','start','defeat','leaveDungeon','enterDungeon'])if(G[method]){
    const original=G[method];G[method]=function(...args){clear();return original.apply(this,args);};
  }
  if(W.UI?.prototype.showMenu){const show=W.UI.prototype.showMenu;W.UI.prototype.showMenu=function(...args){clear();return show.apply(this,args);};}
  const clearCombat=G.clearPlayerCombat;if(clearCombat)G.clearPlayerCombat=function(p){buffers.delete(p);return clearCombat.call(this,p);};
  const damage=G.damageEnemy;
  G.damageEnemy=function(e,amount,p,critical=false){
    const hp=e?.hp,result=damage.call(this,e,amount,p,critical);
    if(e&&Number.isFinite(hp)&&e.hp<hp&&p&&(!e.polishImpactUntil||e.polishImpactUntil<=this.time)){
      e.polishImpactUntil=this.time+.065;
      this.effect('combatImpact',e.x,e.y-26,critical?30:19,.23,{angle:Math.atan2(e.y-p.y,e.x-p.x),color:critical?'#ffe4a1':'#fff5d9',critical});
    }
    return result;
  };
  const draw=R.drawEffect;
  R.drawEffect=function(e,front){
    if(e.type!=='combatImpact')return draw.call(this,e,front);
    if(!front)return;
    const c=this.ctx,t=1-W.clamp(e.life/e.maxLife,0,1),fade=(1-t)*(1-t),r=e.radius;
    c.save();c.globalAlpha=fade;c.translate(e.x,e.y);c.rotate(e.angle||0);c.lineCap='round';
    c.strokeStyle=e.color||'#fff1cd';c.lineWidth=e.critical?3:2;
    for(let i=0;i<7;i++){const a=(i/6-.5)*Math.PI*1.65,near=3+t*r*.45,far=near+r*(.4+(i%3)*.13);c.beginPath();c.moveTo(Math.cos(a)*near,Math.sin(a)*near);c.lineTo(Math.cos(a)*far,Math.sin(a)*far);c.stroke();}
    c.fillStyle='#fffdf1';c.beginPath();c.arc(0,0,Math.max(1,5*(1-t)),0,TAU);c.fill();c.restore();
  };
  W.CombatPolish={bufferSeconds:.14,clear};
})();
