(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype;
  const tuning={windup:1.15,recovery:1.4,laneOffset:65,laneRadius:17,length:560,slow:.65,exposed:1.15};
  const sentry=e=>!e?.boss&&W.Content.enemies[e?.type]?.role==='prismsentry',live=e=>e&&e.hp>0&&!e.dead;
  const valid=(g,e)=>live(e)&&!(e.freeze>0)&&!(e.stun>0)&&!g.safeZoneAt(e.x,e.y)&&!g.pointLocked(e.x,e.y);
  const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=W.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
  const targets=g=>[...g.players,...Object.values(g.missionRuns||{}).filter(r=>r.type==='escort'&&r.state==='active')].filter(p=>p.hp>0&&!p.downed&&!(p.smokeTime>0)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y));
  G.cancelPrismSentry=function(e,cooldown=.8){if(!sentry(e))return;e.prismAction=null;e.combatState=null;e.artAttackUntil=0;e.velocityX=e.velocityY=0;e.fireTimer=Math.max(e.fireTimer||0,cooldown);for(const f of this.effects)if(f.prismOwner===e.id)f.alive=false;};
  G.clearPrismSentries=function(){for(const w of new Set([this.world,this.overworld].filter(Boolean)))for(const e of new Set([...(w.activeEnemies||[]),...(w._active?.values?.()||[]),...(w._dormant?.values?.()||[])]))this.cancelPrismSentry(e);for(const f of this.effects)if(f.prismOwner)f.alive=false;this._prismWorld=this.world;};
  G.beginPrismSentryAttack=function(e,p){
    if(!sentry(e)||!valid(this,e)||!p||!this.lineOfSight(e,p))return false;
    const angle=Math.atan2(p.y-e.y,p.x-e.x),dx=Math.cos(angle),dy=Math.sin(angle),lanes=[];
    for(const side of [-1,1]){
      const start={x:e.x+dx*24-dy*tuning.laneOffset*side,y:e.y+dy*24+dx*tuning.laneOffset*side};if(this.world.isBlocked(start.x,start.y,6))return false;
      let end={...start};for(let n=8;n<=tuning.length;n+=8){const next={x:start.x+dx*n,y:start.y+dy*n};if(this.world.isBlocked(next.x,next.y,6)||this.pointLocked(next.x,next.y)||this.safeZoneAt(next.x,next.y))break;end=next;}if(W.dist(start,end)<80)return false;lanes.push({start,end});
    }
    const marks=[];for(const lane of lanes){const mark=this.effect('prismLane',lane.start.x,lane.start.y,tuning.laneRadius,tuning.windup+.04,{prismOwner:e.id,tx:lane.end.x,ty:lane.end.y,warning:true,color:'#80e4f0'});if(mark)marks.push(mark);}
    if(marks.length!==2){for(const mark of marks)mark.alive=false;return false;}
    e.angle=angle;e.prismAction={phase:'windup',timer:tuning.windup,lanes};e.combatState='windup';this.setAnim(e,'windup');e.velocityX=e.velocityY=0;return true;
  };
  const enemies=G.updateEnemies;G.updateEnemies=function(dt){if(this.paused||!(dt>0))return;if(this._prismWorld!==this.world)this.clearPrismSentries();for(const e of this.world.activeEnemies)if(sentry(e)&&!valid(this,e))this.cancelPrismSentry(e);for(const f of this.effects)if(f.alive&&f.prismOwner&&!this.world.activeEnemies.some(e=>e.id===f.prismOwner&&valid(this,e)))f.alive=false;return enemies.apply(this,arguments);};
  const advanced=G.updateAdvancedEnemy;G.updateAdvancedEnemy=function(e,ignored,spec,dt){
    if(!sentry(e))return advanced.apply(this,arguments);if(this.paused||!(dt>0)||!valid(this,e))return true;
    const p=targets(this).sort((a,b)=>W.dist(e,a)-W.dist(e,b))[0];if(!p||W.dist(e,p)>1100){this.cancelPrismSentry(e);e.anim='idle';return true;}
    e.alert=5;e.state='attack';const a=e.prismAction;
    if(a){e.velocityX=e.velocityY=0;if(a.phase==='windup'&&this.effects.filter(f=>f.alive&&f.prismOwner===e.id&&f.warning).length!==2){this.cancelPrismSentry(e);return true;}a.timer-=dt;
      if(a.phase==='windup'&&a.timer<=0){
        for(const f of this.effects)if(f.prismOwner===e.id)f.alive=false;
        const amount=(spec.damage||15)*(1+(e.level||1)*.065)*(1+(e.region||0)*.04);
        for(const target of targets(this))if(a.lanes.some(l=>segmentDistance(target,l.start,l.end)<tuning.laneRadius+16)&&this.lineOfSight(e,target)){
          const hp=target.hp;if(this.players.includes(target)||target.campProxy)this.damagePlayer(target,amount,{x:e.x,y:e.y,kind:'prismFrost'});else target.hp=Math.max(0,target.hp-amount);if(target.hp<hp)target.slowTime=Math.max(target.slowTime||0,tuning.slow);
        }
        for(const lane of a.lanes)this.effect('prismLane',lane.start.x,lane.start.y,tuning.laneRadius,.25,{prismOwner:e.id,tx:lane.end.x,ty:lane.end.y,warning:false,color:'#b9f8ff'});
        a.phase='recovery';a.timer=tuning.recovery;e.combatState='recovery';e.artAttackUntil=this.time+.25;e.artAttackPose=0;this.setAnim(e,'shoot');this.audio.play('ice');
      }else if(a.phase==='recovery'){if(a.timer<tuning.recovery-.25){e.anim='reload';e.artAttackPose=1;}if(a.timer<=0){e.prismAction=null;e.combatState=null;e.artAttackUntil=0;e.fireTimer=.5;e.anim='idle';}}
      return true;
    }
    if(e.fireTimer>0){e.anim='idle';return true;}
    if(W.dist(e,p)>spec.range||!this.lineOfSight(e,p)){
      const direction=this.world.steerAround(e,p,dt),speed=(spec.speed||85)*(e.chillTime>0?.6:1),x=e.x,y=e.y;this.move(e,direction.mx*speed*dt,direction.my*speed*dt,19);e.velocityX=(e.x-x)/dt;e.velocityY=(e.y-y)/dt;e.angle=Math.atan2(p.y-e.y,p.x-e.x);e.anim='run';e.moveTime=(e.moveTime||0)+dt;return true;
    }
    if(!this.beginPrismSentryAttack(e,p))e.fireTimer=.5;return true;
  };
  const damage=G.damageEnemy;G.damageEnemy=function(e,amount,...args){return damage.call(this,e,amount*(sentry(e)&&e.prismAction?.phase==='recovery'?tuning.exposed:1),...args);};
  const kill=G.killEnemy;G.killEnemy=function(e,...args){const result=kill.call(this,e,...args);if(sentry(e)&&!live(e))this.cancelPrismSentry(e,0);return result;};
  for(const method of ['start','load','defeat','enterDungeon','leaveDungeon','fastTravel']){const original=G[method];if(original)G[method]=function(...args){const old=this.world,result=original.apply(this,args);if(result||old!==this.world||method==='start')this.clearPrismSentries();return result;};}
  const effect=R.drawEffect;R.drawEffect=function(e,front=false){if(e.type!=='prismLane')return effect.apply(this,arguments);if(front)return;const c=this.ctx;c.save();c.strokeStyle=e.color;c.lineCap='butt';c.globalAlpha=e.warning?.2:.7;c.lineWidth=e.radius*2;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();c.globalAlpha=1;c.lineWidth=e.warning?2:5;if(e.warning)c.setLineDash([14,9]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();c.setLineDash([]);if(e.warning){c.fillStyle='#c6f8ff';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText('FROST LANE · GAP IS SAFE',(e.x+e.tx)/2,(e.y+e.ty)/2-25);}c.restore();};
  W.PrismSentry={tuning,isSentry:sentry,segmentDistance};
})();
