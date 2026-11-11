(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const tuning={load:.62,flight:.95,bounce:.6,flightDurations:[.95,.6,.58,.56],arcHeights:[280,235,215,195],bounces:3,reload:3.1,craterLife:2.4,burnTick:.55,firstRadius:58,burstRadius:88,bounceDistance:110};
  const flightTime=tuning.flightDurations.reduce((total,time)=>total+time,0);
  const mortar=e=>!e?.boss&&W.Content.enemies[e?.type]?.role==='cindermortar';
  const alive=e=>!!e&&e.hp>0&&!e.dead;
  const targets=g=>[...g.players,...Object.values(g.missionRuns||{}).filter(r=>r.type==='escort'&&r.state==='active')].filter(p=>p.hp>0&&!p.downed&&!(p.smokeTime>0)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y));
  const permitted=(g,p,r=4)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&!g.pointLocked(p.x,p.y)&&!g.safeZoneAt(p.x,p.y)&&!g.world.isBlocked(p.x,p.y,r);
  const caster=(g,f)=>g.world.activeEnemies.find(e=>e.id===f.cinderOwnerId&&mortar(e));
  const validCaster=(g,e)=>alive(e)&&!(e.freeze>0)&&!(e.stun>0)&&!g.pointLocked(e.x,e.y)&&!g.safeZoneAt(e.x,e.y);
  let serial=0;
  function effect(g,type,x,y,radius,life,extra){return g.effect(type,x,y,radius,life,{owner:-1,cinderToken:++serial,...extra});}
  function hit(g,f,multiplier){
    if(!permitted(g,f))return;
    const source={x:f.x,y:f.y,kind:'cinderMortar',fire:true,cinderOwnerId:f.cinderOwnerId};
    for(const p of targets(g))if(W.dist(p,f)<f.radius&&g.lineOfSight(f,p)){
      if(g.players.includes(p)||p.campProxy)g.damagePlayer(p,f.damage*multiplier,source);
      else p.hp=Math.max(0,p.hp-f.damage*multiplier);
    }
  }
  function clippedPoint(g,origin,desired){
    const steps=Math.max(1,Math.ceil(W.dist(origin,desired)/8));let point={x:origin.x,y:origin.y};
    for(let i=1;i<=steps;i++){
      const next={x:origin.x+(desired.x-origin.x)*i/steps,y:origin.y+(desired.y-origin.y)*i/steps};
      if(!permitted(g,next,6)||!g.lineOfSight(point,next))break;
      point=next;
    }
    return point;
  }
  function chase(g,e,p,spec,dt){
    const angle=Math.atan2(p.y-e.y,p.x-e.x);let dx=Math.cos(angle),dy=Math.sin(angle);
    if(!g.lineOfSight(e,p)){const nav=g.world.steerAround(e,p,dt);dx=nav.mx;dy=nav.my;}
    const speed=(spec.speed||88)*1.35*(e.chillTime>0?.6:1),travel=speed*dt,steps=Math.max(1,Math.ceil(travel/8)),ox=e.x,oy=e.y;
    for(let i=0;i<steps;i++){
      const point={x:e.x+dx*travel/steps,y:e.y+dy*travel/steps};
      if(!permitted(g,point,19))break;g.move(e,dx*travel/steps,dy*travel/steps,19);
    }
    e.angle=angle;e.velocityX=(e.x-ox)/dt;e.velocityY=(e.y-oy)/dt;e.anim=Math.hypot(e.velocityX,e.velocityY)>8?'run':'idle';e.moveTime=(e.moveTime||0)+(e.anim==='run'?dt:0);
  }
  G.cancelCinderMortar=function(e,cooldown=.65){
    if(!mortar(e))return;
    e.cinderAction=null;e.combatState=null;e.artAttackUntil=0;e.artAttackPose=0;e.velocityX=e.velocityY=0;e.fireTimer=Math.max(e.fireTimer||0,cooldown);
    for(const f of this.effects)if(f.cinderOwnerId===e.id)f.alive=false;
  };
  G.clearCinderMortars=function(){
    const worlds=new Set([this.world,this.overworld].filter(Boolean));
    for(const world of worlds){const enemies=new Set([...(world.activeEnemies||[]),...(world._active?.values?.()||[]),...(world._dormant?.values?.()||[])]);for(const e of enemies)this.cancelCinderMortar(e);}
    for(const run of Object.values(this.encounterRuns||{}))for(const e of run.records||[])this.cancelCinderMortar(e);
    for(const state of Object.values(this.dungeonStates||{}))for(const e of [...(state.enemies||[]),...(state.survival?.records||[])])this.cancelCinderMortar(e);
    for(const f of this.effects)if(f.cinderOwnerId)f.alive=false;
    this._cinderWorld=this.world;
  };
  const updateEnemies=G.updateEnemies;
  G.updateEnemies=function(dt){
    if(this.paused||!(dt>0))return;
    if(this._cinderWorld!==this.world)this.clearCinderMortars();
    for(const e of this.world.activeEnemies)if(mortar(e)&&!validCaster(this,e))this.cancelCinderMortar(e);
    return updateEnemies.call(this,dt);
  };
  const advanced=G.updateAdvancedEnemy;
  G.updateAdvancedEnemy=function(e,ignored,spec,dt){
    if(!mortar(e))return advanced.call(this,e,ignored,spec,dt);
    if(this.paused||!(dt>0)||!validCaster(this,e))return true;
    const target=targets(this).sort((a,b)=>W.dist(e,a)-W.dist(e,b))[0];
    if(!target||W.dist(e,target)>1300){if(e.cinderAction)this.cancelCinderMortar(e);e.state='patrol';e.anim='idle';e.velocityX=e.velocityY=0;return true;}
    e.state='attack';e.alert=Math.max(5,e.alert||0);e.velocityX=e.velocityY=0;
    const action=e.cinderAction;
    if(action){
      action.timer-=dt;
      if(action.phase==='load'&&action.timer<=0){
        if(action.points.some(point=>!permitted(this,point))||!this.lineOfSight(e,action.points[0])){this.cancelCinderMortar(e);return true;}
        effect(this,'cinderShell',e.x,e.y,330,flightTime+.5,{cinderOwnerId:e.id,cinderVolleyId:action.volleyId,damage:action.damage,startX:e.x,startY:e.y,points:action.points,stage:0,age:0,flightDuration:tuning.flight,height:32});
        this.effect('muzzle',e.x,e.y-36,25,.16,{angle:e.angle-Math.PI/2,color:'#ffc06c'});this.audio.play('mortar');
        action.phase='reload';action.timer=tuning.reload;e.combatState='recovery';this.setAnim(e,'shoot');e.artAttackUntil=this.time+.24;e.artAttackPose=0;
      }else if(action.phase==='reload'){
        if(action.timer<tuning.reload-.24){e.anim='reload';e.artAttackUntil=action.timer>tuning.reload-.45?this.time+.12:0;e.artAttackPose=1;}
        if(action.timer<=0){e.cinderAction=null;e.combatState=null;e.fireTimer=.35;e.artAttackUntil=0;e.anim='idle';}
      }
      return true;
    }
    if(e.fireTimer>0){e.anim='idle';return true;}
    const d=W.dist(e,target);
    if(d>spec.range||!this.lineOfSight(e,target)){chase(this,e,target,spec,dt);return true;}
    const predicted={x:target.x+W.clamp(target.velocityX||0,-280,280)*.35,y:target.y+W.clamp(target.velocityY||0,-280,280)*.35},first=clippedPoint(this,e,predicted);
    if(W.dist(e,first)<55){chase(this,e,target,spec,dt);return true;}
    const angle=Math.atan2(first.y-e.y,first.x-e.x),points=[first];
    for(let i=0;i<tuning.bounces;i++){const previous=points[points.length-1];points.push(clippedPoint(this,previous,{x:previous.x+Math.cos(angle)*tuning.bounceDistance,y:previous.y+Math.sin(angle)*tuning.bounceDistance}));}
    const damage=this.enemyDamage(e,spec)*((e.officerBuff||0)>this.time?1.18:1);
    const volleyId=++serial;e.angle=angle;e.cinderAction={phase:'load',timer:tuning.load,points,damage,volleyId};e.combatState='windup';this.setAnim(e,'windup');
    let deadline=tuning.load,marked=true;
    points.forEach((point,index)=>{deadline+=tuning.flightDurations[index];const next=points[index+1],labelOffsetY=points.slice(0,index).filter(other=>W.dist(other,point)<24).length*18,mark=effect(this,'cinderMark',point.x,point.y,index===tuning.bounces?tuning.burstRadius:tuning.firstRadius,deadline+.2,{cinderOwnerId:e.id,cinderVolleyId:volleyId,number:index+1,labelOffsetY,tx:next?.x,ty:next?.y});if(!mark)marked=false;});
    // All four landings must be visible before committing, even under effect-pool
    // pressure. A partial warning never turns into an unannounced attack.
    if(!marked)this.cancelCinderMortar(e);
    return true;
  };
  function burst(g,f){
    f.radius=tuning.burstRadius;hit(g,f,1.05);
    effect(g,'cinderBurst',f.x,f.y,tuning.burstRadius,.38,{cinderOwnerId:f.cinderOwnerId});
    effect(g,'cinderCrater',f.x,f.y,tuning.burstRadius,tuning.craterLife,{cinderOwnerId:f.cinderOwnerId,damage:f.damage,tick:tuning.burnTick});
    g.audio.play('explosion');g.camera.shake=Math.max(g.camera.shake||0,4);f.alive=false;
  }
  function advanceShell(g,f,dt){
    let remaining=Math.min(dt,Math.max(0,f.life));
    while(f.alive&&remaining>1e-8){
      const duration=tuning.flightDurations[f.stage],from={x:f.startX,y:f.startY},to=f.points[f.stage];
      // Sweep in world-space increments as well as time increments: a distant
      // shot must not skip narrow cover at its higher horizontal speed.
      const step=Math.min(remaining,.025,8/Math.max(1,W.dist(from,to)/duration),duration-f.age);
      f.age+=step;remaining-=step;const t=W.clamp(f.age/duration,0,1),next={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      if(!permitted(g,next,6)||!g.lineOfSight(f,next)){f.alive=false;for(const mark of g.effects)if(mark.cinderOwnerId===f.cinderOwnerId&&mark.type==='cinderMark')mark.alive=false;break;}
      f.x=next.x;f.y=next.y;f.height=Math.sin(t*Math.PI)*tuning.arcHeights[f.stage]+(f.stage?0:32*(1-t));
      if(f.age>=duration-1e-8){
        for(const mark of g.effects)if(mark.alive&&mark.type==='cinderMark'&&mark.cinderVolleyId===f.cinderVolleyId&&mark.number===f.stage+1)mark.alive=false;
        if(f.stage===tuning.bounces){burst(g,f);break;}
        // Three smaller impacts keep total impact pressure near the previous
        // two-landing attack while making every high rebound meaningful.
        const splash={...f,radius:tuning.firstRadius};hit(g,splash,.2);effect(g,'cinderBurst',f.x,f.y,tuning.firstRadius,.25,{cinderOwnerId:f.cinderOwnerId,bounce:true});
        f.stage++;f.age=0;f.startX=f.x;f.startY=f.y;f.flightDuration=tuning.flightDurations[f.stage];f.height=0;
      }
    }
  }
  const updateEffects=G.updateEffects;
  G.updateEffects=function(dt){
    if(this.paused||!(dt>0))return;
    if(this._cinderWorld!==this.world)this.clearCinderMortars();
    // Snapshot identities as the pool may reuse an expired marker for a burst.
    for(const {f,token} of this.effects.filter(f=>f.alive&&f.cinderOwnerId).map(f=>({f,token:f.cinderToken}))){
      if(!f.alive||f.cinderToken!==token)continue;
      const source=caster(this,f);
      if(!validCaster(this,source)){f.alive=false;continue;}
      if(f.type==='cinderShell')advanceShell(this,f,dt);
      if(f.type==='cinderCrater'){
        if(!permitted(this,f)){f.alive=false;continue;}
        f.tick-=Math.min(dt,Math.max(0,f.life));
        while(f.tick<=0){hit(this,f,.18);f.tick+=tuning.burnTick;}
      }
    }
    return updateEffects.call(this,dt);
  };
  const kill=G.killEnemy;G.killEnemy=function(e,p){const result=kill.call(this,e,p);if(mortar(e)&&!alive(e))this.cancelCinderMortar(e,0);return result;};
  for(const method of ['start','load','defeat','enterDungeon','leaveDungeon','fastTravel'])if(G[method]){
    const original=G[method];G[method]=function(...args){const before=this.world,result=original.apply(this,args);if(method==='start'||method==='load'&&result||result||before!==this.world)this.clearCinderMortars();return result;};
  }
  const drawEffect=R.drawEffect;
  R.drawEffect=function(e,front=false){
    if(!['cinderMark','cinderShell','cinderCrater','cinderBurst'].includes(e.type))return drawEffect.call(this,e,front);
    const c=this.ctx,t=1-W.clamp(e.life/e.maxLife,0,1),r=e.radius,clock=this.clock||0;
    if(e.type==='cinderMark'){
      if(front)return;c.save();c.lineWidth=2;c.strokeStyle='#ffc475';c.fillStyle='rgba(219,74,27,.18)';c.setLineDash([9,7]);c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.fill();c.stroke();c.setLineDash([]);
      c.globalAlpha=.55;c.beginPath();c.ellipse(e.x,e.y,r*(1-t),r*(1-t)*.7,0,0,TAU);c.stroke();
      if(Number.isFinite(e.tx)){const a=Math.atan2(e.ty-e.y,e.tx-e.x);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();c.beginPath();c.moveTo(e.tx-Math.cos(a-.45)*13,e.ty-Math.sin(a-.45)*13);c.lineTo(e.tx,e.ty);c.lineTo(e.tx-Math.cos(a+.45)*13,e.ty-Math.sin(a+.45)*13);c.stroke();}
      c.globalAlpha=1;c.font='800 14px system-ui';c.textAlign='center';c.fillStyle='#fff0b6';c.strokeStyle='#552b25';c.lineWidth=4;c.strokeText(String(e.number),e.x,e.y+5-(e.labelOffsetY||0));c.fillText(String(e.number),e.x,e.y+5-(e.labelOffsetY||0));c.restore();return;
    }
    if(e.type==='cinderShell'){
      c.save();if(!front){c.fillStyle='rgba(34,20,21,.3)';c.beginPath();c.ellipse(e.x,e.y,12,6,0,0,TAU);c.fill();c.restore();return;}
      c.translate(e.x,e.y-(e.height||0));c.rotate((e.age||0)*10);c.shadowColor='#ffb852';c.shadowBlur=15;c.fillStyle='#a14e25';c.strokeStyle='#ffdc8f';c.lineWidth=2;c.beginPath();c.ellipse(0,0,10,15,0,0,TAU);c.fill();c.stroke();c.shadowBlur=0;c.fillStyle='#f6c66b';c.fillRect(-10,-4,20,5);c.fillStyle='#fff1b5';c.beginPath();c.arc(0,-15,4+Math.sin(clock*28),0,TAU);c.fill();c.restore();return;
    }
    if(e.type==='cinderCrater'){
      c.save();c.globalAlpha=Math.min(1,e.life/.4);
      if(!front){c.fillStyle='#35251f';c.strokeStyle='#dc702c';c.lineWidth=3;c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.fill();c.stroke();c.strokeStyle='#ffb957';c.lineWidth=2;for(let i=0;i<7;i++){const a=i*2.4;c.beginPath();c.moveTo(e.x+Math.cos(a)*r*.18,e.y+Math.sin(a)*r*.13);c.lineTo(e.x+Math.cos(a+.15)*r*.65,e.y+Math.sin(a+.15)*r*.46);c.stroke();}}
      else for(let i=0;i<6;i++){const a=i*2.4,rr=r*(.22+i%3*.2),x=e.x+Math.cos(a)*rr,y=e.y+Math.sin(a)*rr*.7,h=18+Math.sin(clock*13+i)*7;c.fillStyle=i%2?'#ffb448':'#ef6c2e';c.beginPath();c.moveTo(x-6,y);c.quadraticCurveTo(x-9,y-h*.5,x+2,y-h);c.quadraticCurveTo(x+9,y-h*.3,x+6,y);c.fill();c.fillStyle='#ffe49a';c.beginPath();c.ellipse(x,y-5,3,5,0,0,TAU);c.fill();}
      c.restore();return;
    }
    if(!front)return;c.save();c.globalAlpha=1-t;c.strokeStyle=e.bounce?'#ffc57f':'#ff9b40';c.lineWidth=6*(1-t)+1;c.beginPath();c.ellipse(e.x,e.y,r*(.3+t),r*(.3+t)*.7,0,0,TAU);c.stroke();c.fillStyle='#ffd785';for(let i=0;i<9;i++){const a=i*TAU/9,x=e.x+Math.cos(a)*r*t,y=e.y+Math.sin(a)*r*t*.7-Math.sin(t*Math.PI)*25;c.beginPath();c.arc(x,y,Math.max(1,5*(1-t)),0,TAU);c.fill();}c.restore();
  };
  W.CinderMortar={...tuning,flightTime};
})();
