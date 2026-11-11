(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const alive=e=>!!e&&e.hp>0&&!e.dead;
  const reaver=e=>!e?.boss&&W.Content.enemies[e?.type]?.role==='blackglassreaver';
  const targetList=g=>[...g.players,...Object.values(g.missionRuns||{}).filter(r=>r.type==='escort'&&r.state==='active')].filter(p=>alive(p)&&!p.downed&&!(p.smokeTime>0)&&!g.safeZoneAt(p.x,p.y)&&!g.pointLocked(p.x,p.y));
  const side=e=>String(e.id||'reaver').split('').reduce((v,s)=>v+s.charCodeAt(0),0)%2?1:-1;
  const key=(g,p)=>p.campProxy?'camp:'+p.campProxy:g.players.includes(p)?'player:'+p.id:'escort:'+(p.questId||p.id||p.type);
  const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const owned=(f,e,a)=>f.alive&&f.blackglassOwnerId===e.id&&(!a||f.volleyId===a.volleyId);
  const arcPoint=(curve,t)=>{
    const forward=curve.reach*(1-Math.cos(t))*.5,lateral=curve.side*curve.width*Math.sin(t),c=Math.cos(curve.angle),s=Math.sin(curve.angle);
    return{x:curve.x+c*forward-s*lateral,y:curve.y+s*forward+c*lateral};
  };

  function blocked(g,x,y,r=9){return !!g.safeZoneAt(x,y)||!!g.pointLocked(x,y)||g.world.isBlocked(x,y,r)||x<r||y<r||x>g.world.width-r||y>g.world.height-r;}
  function move(g,e,dx,dy,dt){
    const x=e.x,y=e.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/9));
    for(let i=0;i<n;i++){
      if(g.safeZoneAt(e.x+dx/n,e.y+dy/n)||g.pointLocked(e.x+dx/n,e.y+dy/n))break;
      g.move(e,dx/n,dy/n,19);
    }
    e.velocityX=(e.x-x)/Math.max(.001,dt);e.velocityY=(e.y-y)/Math.max(.001,dt);
    e.anim=Math.hypot(e.velocityX,e.velocityY)>8?'run':'idle';e.moveTime=(e.moveTime||0)+dt;
  }
  function pursue(g,e,p,s,dt){
    const distance=W.dist(e,p),a=angle(e,p),visible=g.lineOfSight(e,p);
    let dx=Math.cos(a),dy=Math.sin(a);
    if(!visible){const steer=g.world.steerAround(e,p,dt);dx=steer.mx;dy=steer.my;}
    else if(distance<520){
      // Circle in a consistent direction; do not flee from low health or blink.
      const forward=distance>390?.35:distance<210?-.4:0,turn=side(e);
      dx=Math.cos(a)*forward-Math.sin(a)*turn;dy=Math.sin(a)*forward+Math.cos(a)*turn;
      const length=Math.hypot(dx,dy);dx/=length;dy/=length;
    }
    const speed=s.speed*1.3*(e.chillTime>0?.6:1);
    move(g,e,dx*speed*dt,dy*speed*dt,dt);e.angle=a;
  }
  function recover(g,e,a){
    for(const f of g.effects)if(owned(f,e,a))f.alive=false;
    a.phase='recovery';a.timer=.95;e.combatState='recovery';e.velocityX=e.velocityY=0;
    e.artAttackUntil=g.time+.24;e.artAttackPose=1;g.setAnim(e,'land');
    g.effect('blackglassCatch',e.x,e.y,42,.35,{blackglassOwnerId:e.id,volleyId:a.volleyId});
    g.text('GUARD OPEN',e.x,e.y-49,'#e6caff');
  }
  G.cancelBlackglassAttack=function(e,cooldown=.65){
    if(!reaver(e))return;
    e.reaverAction=null;e.combatState=null;e.velocityX=e.velocityY=0;e.artAttackUntil=0;e.artAttackPose=0;
    e.fireTimer=Math.max(e.fireTimer||0,cooldown);
    for(const f of this.effects)if(owned(f,e))f.alive=false;
  };
  const updateEnemies=G.updateEnemies;
  G.updateEnemies=function(dt){
    if(this.paused||!(dt>0))return;
    for(const e of this.world.activeEnemies)if(reaver(e)&&(!alive(e)||e.freeze>0||e.stun>0||this.safeZoneAt(e.x,e.y)||this.pointLocked(e.x,e.y)))this.cancelBlackglassAttack(e);
    return updateEnemies.call(this,dt);
  };
  const updateAdvanced=G.updateAdvancedEnemy;
  G.updateAdvancedEnemy=function(e,ignored,s,dt){
    if(!reaver(e))return updateAdvanced.call(this,e,ignored,s,dt);
    if(this.paused||!(dt>0))return true;
    if(!alive(e)||e.freeze>0||e.stun>0){this.cancelBlackglassAttack(e);return true;}
    const p=targetList(this).sort((a,b)=>W.dist(e,a)-W.dist(e,b))[0];
    if(!p||W.dist(e,p)>1250||this.pointLocked(e.x,e.y)||this.safeZoneAt(e.x,e.y)){
      if(e.reaverAction)this.cancelBlackglassAttack(e);
      e.state='patrol';e.anim='idle';e.velocityX=e.velocityY=0;return true;
    }
    const distance=W.dist(e,p);
    if(distance>850&&!e.alert){e.state='patrol';e.anim='idle';return true;}
    e.state='attack';e.alert=Math.max(e.alert||0,5);
    let a=e.reaverAction;
    if(a){
      a.timer-=dt;e.velocityX=e.velocityY=0;
      if(a.phase==='windup'&&a.timer<=0){
        // The complete elliptical paths stay fixed after the warning begins.
        for(const f of this.effects)if(owned(f,e,a)&&f.type==='blackglassLane')f.alive=false;
        for(const lane of a.lanes){
          const x=lane.x,y=lane.y;
          if(blocked(this,x,y))continue;
          this.effect('blackglassBlade',x,y,17,a.flightTime+.25,{owner:-1,blackglassOwnerId:e.id,volleyId:a.volleyId,leg:'outbound',curve:lane.curve,pathAngle:0,angularSpeed:TAU/a.flightTime,angle:a.angle+lane.side*Math.PI/2,damage:a.damage,spin:lane.side,visualHeight:21});
        }
        a.phase='flight';a.timer=a.flightTime+.3;e.combatState='strike';this.setAnim(e,'shoot');e.artAttackUntil=this.time+.24;e.artAttackPose=0;
      }else if(a.phase==='flight'){
        if(a.timer<=0||!this.effects.some(f=>owned(f,e,a)&&f.type==='blackglassBlade'))recover(this,e,a);
      }else if(a.phase==='recovery'&&a.timer<=0){
        e.reaverAction=null;e.combatState=null;e.fireTimer=.55;e.anim='idle';
      }
      return true;
    }
    if(e.fireTimer>0||distance>s.range||distance<180||!this.lineOfSight(e,p)){pursue(this,e,p,s,dt);return true;}
    e.angle=angle(e,p);e.velocityX=e.velocityY=0;
    const reach=W.clamp(distance+20,200,620),width=Math.max(80,reach*.34),major=reach*.5,h=((major-width)/(major+width))**2;
    const circumference=Math.PI*(major+width)*(1+3*h/(10+Math.sqrt(4-3*h)));
    a={phase:'windup',timer:.62,angle:e.angle,flightTime:circumference/560,volleyId:(e.reaverVolleyCounter||0)+1,damage:this.enemyDamage(e,s,.7)*((e.officerBuff||0)>this.time?1.18:1),hitOut:[],hitBack:[],lanes:[]};
    e.reaverVolleyCounter=a.volleyId;
    for(const direction of [-1,1]){
      const x=e.x,y=e.y,tx=x+Math.cos(e.angle)*reach,ty=y+Math.sin(e.angle)*reach,curve={x,y,angle:e.angle,reach,width,side:direction};
      const lane={x,y,tx,ty,side:direction,curve};a.lanes.push(lane);
      const warning=this.effect('blackglassLane',x,y,reach+40,.62,{tx,ty,curve,owner:-1,blackglassOwnerId:e.id,volleyId:a.volleyId});
      // Never launch an unwarned volley when the shared visual pool is full.
      if(!warning){this.cancelBlackglassAttack(e,.3);return true;}
    }
    e.reaverAction=a;e.combatState='windup';this.setAnim(e,'windup');return true;
  };

  function hitSweep(g,f,a,x,y,tx,ty){
    const dx=tx-x,dy=ty-y,hit=f.leg==='outbound'?a.hitOut:a.hitBack;
    for(const p of targetList(g)){
      const id=key(g,p);if(hit.includes(id)||hit.length>=64)continue;
      const t=W.clamp(((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy||1),0,1),nearest={x:x+dx*t,y:y+dy*t};
      if(W.dist(nearest,p)>35||!g.lineOfSight(nearest,p))continue;
      // Record a dodge as a resolved crossing too: hovering inside a ring never
      // causes repeated damage when the player's invulnerability ends.
      hit.push(id);
      if(g.players.includes(p)||p.campProxy)g.damagePlayer(p,f.damage,{x,y,kind:'blackglassBlade'});
      else p.hp=Math.max(0,p.hp-f.damage);
    }
  }
  function reflectSweep(g,f,x,y,tx,ty,direction){
    const dx=tx-x,dy=ty-y;
    for(const p of g.players){
      if(!alive(p)||p.downed||!(p.mirrorWardTime>0))continue;
      const t=W.clamp(((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy||1),0,1),near={x:x+dx*t,y:y+dy*t};
      if(W.dist(near,p)>115||!g.lineOfSight(p,near))continue;
      // Use the same bounded player-shot contract as ordinary Mirror Ward
      // reflections. Retiring the ring prevents its return leg hitting allies.
      const damage=Math.min(180,f.damage);f.alive=false;
      g.bulletPool.take({x:near.x,y:near.y,vx:-Math.cos(direction)*560,vy:-Math.sin(direction)*560,life:1.4,damage,owner:p.id,kind:'bullet',radius:9,color:'#cef8eb',homing:false,hitIds:[]});
      g.effect('impact',near.x,near.y,22,.2,{color:'#cef8eb'});return true;
    }
    return false;
  }
  function advanceBlade(g,f,e,a,dt){
    let remaining=Math.min(dt,Math.max(0,f.life))*f.angularSpeed,guard=0;
    while(f.alive&&remaining>0&&guard++<480){
      if(!alive(e)||e.stun>0||e.freeze>0||e.reaverAction!==a){g.cancelBlackglassAttack(e);break;}
      if(f.pathAngle>=TAU-1e-8){f.alive=false;break;}
      if(f.pathAngle>=Math.PI-1e-8)f.leg='return';
      const boundary=f.leg==='outbound'?Math.PI:TAU,step=Math.min(8/Math.max(f.curve.reach*.5,f.curve.width),remaining,boundary-f.pathAngle),next=arcPoint(f.curve,f.pathAngle+step),x=f.x,y=f.y,nx=next.x,ny=next.y,direction=Math.atan2(ny-y,nx-x);
      if(blocked(g,nx,ny)||W.Dungeons?.hitProjectile(g,{owner:-1,kind:'blackglassBlade',x:nx,y:ny},x,y)){
        f.alive=false;g.effect('impact',x,y,17,.2,{color:'#d5b0ff'});break;
      }
      if(reflectSweep(g,f,x,y,nx,ny,direction))break;
      f.angle=direction;hitSweep(g,f,a,x,y,nx,ny);f.x=nx;f.y=ny;f.pathAngle+=step;remaining-=step;
      if(f.pathAngle>=TAU-1e-8){f.alive=false;break;}
    }
  }
  const updateEffects=G.updateEffects;
  G.updateEffects=function(dt){
    if(this.paused||!(dt>0))return;
    for(const f of this.effects.filter(f=>f.alive&&f.type==='blackglassBlade')){
      const e=this.world.activeEnemies.find(e=>e.id===f.blackglassOwnerId),a=e?.reaverAction;
      if(!alive(e)||!reaver(e)||e.stun>0||e.freeze>0||!a||a.phase!=='flight'||a.volleyId!==f.volleyId||this.safeZoneAt(e.x,e.y)||this.pointLocked(e.x,e.y)){f.alive=false;continue;}
      advanceBlade(this,f,e,a,dt);
    }
    return updateEffects.call(this,dt);
  };
  const damageEnemy=G.damageEnemy;
  G.damageEnemy=function(e,amount,p,critical){return damageEnemy.call(this,e,amount*(reaver(e)&&e.reaverAction?.phase==='recovery'?1.2:1),p,critical);};
  const killEnemy=G.killEnemy;
  G.killEnemy=function(e,p){const result=killEnemy.call(this,e,p);if(reaver(e)&&!alive(e))this.cancelBlackglassAttack(e,0);return result;};
  for(const method of ['start','load','enterDungeon','leaveDungeon','fastTravel'])if(G[method]){
    const original=G[method];
    G[method]=function(...args){
      const before=this.world,result=original.apply(this,args);
      if(method==='start'||method==='load'&&result||before!==this.world||result){
        for(const world of new Set([before,this.world,this.overworld].filter(Boolean))){
          const enemies=new Set([...(world.activeEnemies||[]),...(world._dormant?.values()||[])]);
          for(const e of enemies)if(reaver(e))this.cancelBlackglassAttack(e);
        }
      }
      return result;
    };
  }

  const drawEffect=R.drawEffect;
  R.drawEffect=function(f,front){
    if(!['blackglassLane','blackglassBlade','blackglassCatch'].includes(f.type))return drawEffect?.call(this,f,front);
    const c=this.ctx,t=1-W.clamp(f.life/f.maxLife,0,1);
    if(f.type==='blackglassLane'){
      if(front)return;
      if(!f.curve)return;
      c.save();c.lineCap='round';
      for(let leg=0;leg<2;leg++){
        c.beginPath();for(let i=0;i<=24;i++){const p=arcPoint(f.curve,leg*Math.PI+i*Math.PI/24);if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}
        c.strokeStyle='rgba(165,112,239,'+((leg?.045:.09)+t*.08)+')';c.lineWidth=30;c.setLineDash([]);c.stroke();
        c.lineWidth=leg?1.5:2;c.strokeStyle=leg?'#d1a0d9':'#e3baff';c.setLineDash(leg?[4,8]:[12,8]);c.stroke();c.setLineDash([]);
        for(const offset of [.3,.7]){const theta=(leg+offset)*Math.PI,p=arcPoint(f.curve,theta),next=arcPoint(f.curve,theta+.02),a=angle(p,next);c.beginPath();c.moveTo(p.x+Math.cos(a-2.6)*8,p.y+Math.sin(a-2.6)*8);c.lineTo(p.x,p.y);c.lineTo(p.x+Math.cos(a+2.6)*8,p.y+Math.sin(a+2.6)*8);c.stroke();}
      }
      c.restore();return;
    }
    if(!front)return;
    c.save();c.translate(f.x,f.y-(f.type==='blackglassBlade'?21:25));
    if(f.type==='blackglassCatch'){
      c.globalAlpha=1-t;c.strokeStyle='#e8caff';c.lineWidth=3;
      for(let i=0;i<6;i++){const a=i*TAU/6;c.beginPath();c.moveTo(Math.cos(a)*(12+t*15),Math.sin(a)*(12+t*15));c.lineTo(Math.cos(a)*(25+t*21),Math.sin(a)*(25+t*21));c.stroke();}
    }else{
      const returning=f.leg==='return';c.rotate((this.clock||0)*17*(f.spin||1));c.shadowColor=returning?'#f3bdff':'#b494ff';c.shadowBlur=9;
      c.strokeStyle=returning?'rgba(244,183,255,.25)':'rgba(184,148,255,.25)';c.lineWidth=7;c.beginPath();c.arc(0,0,23,0,TAU*.72);c.stroke();
      c.fillStyle='#24152f';c.strokeStyle=returning?'#ffd9ff':'#dfd5ff';c.lineWidth=2;
      for(const rotation of [0,Math.PI]){c.save();c.rotate(rotation);c.beginPath();c.arc(0,0,18,-1.1,1.1);c.quadraticCurveTo(4,3,7,-8);c.closePath();c.fill();c.stroke();c.restore();}
      c.fillStyle='#b78bff';c.beginPath();c.arc(0,0,4,0,TAU);c.fill();
    }
    c.restore();
  };
})();
