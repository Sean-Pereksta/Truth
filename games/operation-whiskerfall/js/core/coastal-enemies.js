(function () {
  'use strict';
  const W=window.OW,G=W.Game.prototype,alive=e=>!!e&&e.hp>0&&!e.dead;
  const coastal=e=>!!W.Content.enemies[e?.type]?.coastal&&!e.boss;
  const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const targets=g=>[...g.players,...Object.values(g.missionRuns||{}).filter(r=>r.type==='escort'&&r.state==='active')].filter(p=>p.hp>0&&!p.downed&&!(p.smokeTime>0)&&!g.safeZoneAt(p.x,p.y));
  const distance=W.dist;
  const side=e=>String(e.id||e.type).split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%2?1:-1;
  const pressure=(g,e,s,m=1)=>g.enemyDamage(e,s,m)*((e.officerBuff||0)>g.time?1.18:1);
  function hitTarget(g,p,damage,source){
    if(g.players.includes(p)||p.campProxy)g.damagePlayer(p,damage,source);
    else p.hp=Math.max(0,p.hp-damage);
  }

  // A bounded sweep keeps fast feints and shield bashes outside thin obstacles,
  // locked arenas and settlements, even after a long frame.
  function move(g,e,dx,dy,dt){
    const ox=e.x,oy=e.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/10));
    for(let i=0;i<steps;i++){
      const x=e.x+dx/steps,y=e.y+dy/steps;
      if(g.safeZoneAt(x,y)||g.pointLocked(x,y))break;
      g.move(e,dx/steps,dy/steps,19);
    }
    e.velocityX=(e.x-ox)/Math.max(.001,dt);e.velocityY=(e.y-oy)/Math.max(.001,dt);
    if(Math.hypot(e.velocityX,e.velocityY)>8){e.moveTime=(e.moveTime||0)+dt;if(!e.coastalAction)e.anim='run';}
    return Math.hypot(e.x-ox,e.y-oy);
  }
  function setPhase(g,e,a,phase,timer,anim){a.phase=phase;a.timer=timer;e.combatState=phase==='recovery'?'recovery':phase==='bash'||phase==='slash'?'strike':'windup';g.setAnim(e,anim||'windup');}
  function warning(g,e,tx,ty,time,radius=30,color='#73d4ca'){
    return g.effect('chargeLane',e.x,e.y,radius,time,{tx,ty,color,coastalOwnerId:e.id,owner:-1});
  }
  function recover(g,e,a,time){setPhase(g,e,a,'recovery',time,'land');e.coastalGuard=false;}
  function strike(g,e,a,radius,multiplier=1){
    e.artAttackUntil=g.time+.16;e.artAttackPose=multiplier>.8?1:0;
    g.effect('enemySlash',e.x,e.y,radius,.24,{angle:a.angle,color:'#f5a0ad'});
    for(const p of targets(g))if(distance(e,p)<radius&&Math.abs(W.wrapAngle(angleTo(e,p)-a.angle))<1.15&&g.lineOfSight(e,p))hitTarget(g,p,a.damage*multiplier,e);
  }
  function chase(g,e,target,spec,dt,desired=40){
    const d=distance(e,target);e.angle=angleTo(e,target);
    if(d<=desired&&g.lineOfSight(e,target)){e.anim='idle';e.velocityX=e.velocityY=0;return;}
    let vx=Math.cos(e.angle),vy=Math.sin(e.angle);
    if(!g.lineOfSight(e,target)){const nav=g.world.steerAround(e,target,dt);vx=nav.mx;vy=nav.my;}
    const speed=spec.speed*(spec.role==='tideblade'?1.62:spec.role==='shellguard'?1.4:1.35)*(e.chillTime>0?.6:1);
    move(g,e,vx*speed*dt,vy*speed*dt,dt);
  }
  G.cancelCoastalAttack=function(e,cooldown=.6){
    if(!coastal(e))return;
    e.coastalAction=null;e.combatState=null;e.coastalGuard=false;e.velocityX=e.velocityY=0;e.artAttackUntil=0;e.artAttackPose=0;
    e.fireTimer=Math.max(e.fireTimer||0,cooldown);
    for(const f of this.effects)if(f.coastalOwnerId===e.id)f.alive=false;
    for(const b of this.projectiles)if(b.coastalOwnerId===e.id)b.alive=false;
    for(const p of this.players)if(p.harpoonPull?.sourceId===e.id)p.harpoonPull=null;
  };

  const previousUpdate=G.updateEnemies;
  G.updateEnemies=function(dt){
    if(this.paused||!(dt>0))return;
    for(const e of this.world.activeEnemies)if(coastal(e)&&(!alive(e)||e.freeze>0||e.stun>0||this.safeZoneAt(e.x,e.y)))this.cancelCoastalAttack(e);
    return previousUpdate.call(this,dt);
  };
  const previousAdvanced=G.updateAdvancedEnemy;
  G.updateAdvancedEnemy=function(e,ignoredTarget,spec,dt){
    if(!coastal(e))return previousAdvanced.call(this,e,ignoredTarget,spec,dt);
    if(this.paused||!alive(e))return true;
    const target=targets(this).sort((a,b)=>distance(e,a)-distance(e,b))[0];
    if(!target||distance(e,target)>1250||this.pointLocked(e.x,e.y)){
      if(e.coastalAction)this.cancelCoastalAttack(e);
      e.state='patrol';e.anim='idle';e.velocityX=e.velocityY=0;return true;
    }
    const d=distance(e,target),visible=this.lineOfSight(e,target);
    if(d>850&&!e.alert){e.state='patrol';e.anim='idle';return true;}
    e.state='attack';e.alert=Math.max(5,e.alert||0);e.velocityX=e.velocityY=0;
    let a=e.coastalAction;
    if(a){
      const elapsed=Math.min(dt,Math.max(0,a.timer));a.timer-=dt;
      if(a.phase==='recovery'){
        if(a.timer<=0){e.coastalAction=null;e.combatState=null;e.fireTimer=spec.role==='bellringer'?2:spec.role==='harpooner'?.65:.22;e.anim='idle';}
        return true;
      }
      if(a.kind==='harpoon'){
        if(a.phase==='aim'&&a.timer<=0){
          const point={x:a.tx,y:a.ty};
          if(this.lineOfSight(e,point)&&!this.safeZoneAt(point.x,point.y)){
            this.bulletPool.take({x:e.x+Math.cos(a.angle)*30,y:e.y+Math.sin(a.angle)*30,vx:Math.cos(a.angle)*690,vy:Math.sin(a.angle)*690,life:1.35,damage:a.damage,owner:-1,kind:'harpoon',radius:7,color:'#83efe2',coastalOwnerId:e.id});
            this.effect('muzzle',e.x,e.y,18,.08,{angle:a.angle,color:'#83efe2'});
          }
          setPhase(this,e,a,'reposition',.5,'shoot');e.combatState='strike';
          e.artAttackUntil=this.time+.17;e.artAttackPose=0;
        }else if(a.phase==='reposition'){
          const turn=a.angle+side(e)*Math.PI/2;
          move(this,e,Math.cos(turn)*205*elapsed,Math.sin(turn)*205*elapsed,dt);
          if(a.timer<=0)recover(this,e,a,.25);
        }
      }else if(a.kind==='chimes'&&a.timer<=0){
        if(a.phase==='cast'){
          for(let i=0;i<a.marks.length;i++){
            const m=a.marks[i];
            if(this.pointLocked(m.x,m.y)||this.safeZoneAt(m.x,m.y)||!this.lineOfSight(e,m))continue;
            this.effect('telegraph',m.x,m.y,68,.65+i*.28,{owner:-1,color:'#f3db70',coastalStrike:true,coastalOwnerId:e.id,damage:a.damage});
          }
          for(const ally of this.world.activeEnemies)if(alive(ally)&&ally!==e&&distance(e,ally)<360){ally.alert=Math.max(6,ally.alert||0);ally.officerBuff=this.time+2.5;}
          this.effect('shockwave',e.x,e.y,180,.5,{color:'#f3db70'});this.setAnim(e,'ability');e.artAttackUntil=this.time+.22;e.artAttackPose=0;
          recover(this,e,a,.5);
        }
      }else if(a.kind==='bash'){
        if(a.phase==='brace'&&a.timer<=0){setPhase(this,e,a,'bash',.3,'charge');e.coastalGuard=true;}
        else if(a.phase==='bash'){
          e.artAttackUntil=this.time+.12;e.artAttackPose=a.timer>.15?0:1;
          const ox=e.x,oy=e.y,travel=move(this,e,Math.cos(a.angle)*530*elapsed,Math.sin(a.angle)*530*elapsed,dt),dx=e.x-ox,dy=e.y-oy;
          for(const p of targets(this)){
            const t=W.clamp(((p.x-ox)*dx+(p.y-oy)*dy)/(dx*dx+dy*dy||1),0,1),key=p.id??p.campProxy??p.questId??('escort:'+p.x+':'+p.y);
            if(!a.hit.includes(key)&&Math.hypot(p.x-ox-dx*t,p.y-oy-dy*t)<44&&this.lineOfSight(e,p)){a.hit.push(key);hitTarget(this,p,a.damage,e);}
          }
          if(a.timer<=0||travel<530*elapsed*.25){recover(this,e,a,1);this.text('EXPOSED',e.x,e.y-48,'#f6d6a0');}
        }
      }else if(a.kind==='blades'){
        if(a.phase==='feint'){
          const turn=a.angle+side(e)*Math.PI/2;
          move(this,e,Math.cos(turn)*185*elapsed,Math.sin(turn)*185*elapsed,dt);
          if(a.timer<=0){a.angle=angleTo(e,target);e.angle=a.angle;setPhase(this,e,a,'firstWindup',.25);warning(this,e,e.x+Math.cos(a.angle)*100,e.y+Math.sin(a.angle)*100,.25,40,'#ef94a4');}
        }else if(a.phase==='firstWindup'&&a.timer<=0){
          move(this,e,Math.cos(a.angle)*42,Math.sin(a.angle)*42,Math.max(dt,.1));strike(this,e,a,96,.75);
          a.angle=angleTo(e,target);e.angle=a.angle;setPhase(this,e,a,'secondWindup',.38,'melee');
          warning(this,e,e.x+Math.cos(a.angle)*132,e.y+Math.sin(a.angle)*132,.38,40,'#ffb1bd');
        }else if(a.phase==='secondWindup'&&a.timer<=0){
          move(this,e,Math.cos(a.angle)*38,Math.sin(a.angle)*38,Math.max(dt,.1));strike(this,e,a,98,.9);recover(this,e,a,.5);
        }
      }
      return true;
    }
    e.coastalGuard=spec.role==='shellguard';
    if(e.fireTimer>0||!visible||d>spec.range){chase(this,e,target,spec,dt,spec.role==='harpooner'?390:spec.role==='bellringer'?360:40);return true;}
    e.angle=angleTo(e,target);
    const damage=pressure(this,e,spec);
    if(spec.role==='harpooner'){
      const lead=W.clamp(d/690,.15,.55),vx=W.clamp(target.velocityX||0,-300,300),vy=W.clamp(target.velocityY||0,-300,300),tx=target.x+vx*lead,ty=target.y+vy*lead;
      a={kind:'harpoon',phase:'aim',timer:.48,tx,ty,angle:Math.atan2(ty-e.y,tx-e.x),damage:damage*.85};e.angle=a.angle;
      warning(this,e,tx,ty,.48,20);
    }else if(spec.role==='bellringer'){
      const tx=target.x+W.clamp(target.velocityX||0,-300,300)*.3,ty=target.y+W.clamp(target.velocityY||0,-300,300)*.3,perp=e.angle+Math.PI/2;
      const marks=[{x:tx,y:ty},...[-1,1].map(s=>({x:tx+Math.cos(perp)*120*s,y:ty+Math.sin(perp)*120*s}))];
      a={kind:'chimes',phase:'cast',timer:.5,marks,damage:damage*.72};this.effect('shockwave',e.x,e.y,75,.5,{color:'#f3db70',coastalOwnerId:e.id,owner:-1});
    }else if(spec.role==='shellguard'){
      a={kind:'bash',phase:'brace',timer:.52,angle:e.angle,damage:damage*.9,hit:[]};
      warning(this,e,e.x+Math.cos(e.angle)*170,e.y+Math.sin(e.angle)*170,.52,44,'#b5d4e8');
    }else{
      a={kind:'blades',phase:'feint',timer:.2,angle:e.angle,damage};
      warning(this,e,target.x,target.y,.2,28,'#ef94a4');
    }
    e.coastalAction=a;e.combatState='windup';this.setAnim(e,'windup');return true;
  };

  const previousDamagePlayer=G.damagePlayer;
  G.damagePlayer=function(p,amount,source){
    const before=p.hp,result=previousDamagePlayer.call(this,p,amount,source);
    if(p.downed)p.harpoonPull=null;
    if(source?.kind==='harpoon'&&p.hp<before&&!p.downed){
      if(!p.perks?.rimeheart)p.slowTime=Math.max(p.slowTime||0,.8);
      const caster=this.world.activeEnemies.find(e=>e.id===source.coastalOwnerId&&W.Content.enemies[e.type]?.role==='harpooner');
      // Supply proxies and escorts take impact damage but are never displaced.
      // A short per-player immunity prevents packs from chaining endless pulls.
      if(this.players.includes(p)&&alive(caster)&&!p.harpoonPull&&(p.harpoonPullImmuneUntil||0)<=this.time){
        const reach=Math.min(210,Math.max(0,distance(p,caster)-62));
        if(reach>0){this._harpoonWorld=this.world;p.harpoonPull={sourceId:caster.id,sourceX:caster.x,sourceY:caster.y,remaining:reach,duration:.6,time:.6};p.harpoonPullImmuneUntil=this.time+2.4;}
      }
    }
    return result;
  };
  G.clearHarpoonPulls=function(){for(const p of [...this.players,...(this.reservePlayer?[this.reservePlayer]:[])]){p.harpoonPull=null;p.harpoonPullImmuneUntil=0;}this._harpoonWorld=this.world;};
  G.updateHarpoonPull=function(p,dt){
    if(this.paused||!(dt>0))return;
    if(this._harpoonWorld!==this.world){this.clearHarpoonPulls();return;}
    const pull=p.harpoonPull;if(!pull)return;
    const caster=this.world.activeEnemies.find(e=>e.id===pull.sourceId);
    if(p.downed||p.hp<=0||p.dodgeTime>0||p.smokeTime>0||this.safeZoneAt(p.x,p.y)||!alive(caster)||caster.freeze>0||caster.stun>0||!this.lineOfSight(caster,p)){p.harpoonPull=null;return;}
    pull.sourceX=caster.x;pull.sourceY=caster.y;
    const d=distance(p,caster),amount=Math.min(pull.remaining,350*Math.min(dt,pull.time),Math.max(0,d-62)),a=angleTo(p,caster),steps=Math.max(1,Math.ceil(amount/8)),ox=p.x,oy=p.y;
    let moved=0,blocked=false;
    for(let i=0;i<steps;i++){
      const dx=Math.cos(a)*amount/steps,dy=Math.sin(a)*amount/steps;
      if(this.safeZoneAt(p.x+dx,p.y+dy)||this.pointLocked(p.x+dx,p.y+dy)){blocked=true;break;}
      const x=p.x,y=p.y;this.move(p,dx,dy,19);const travel=Math.hypot(p.x-x,p.y-y);moved+=travel;
      if(travel<amount/steps*.2){blocked=true;break;}
    }
    p.velocityX=(p.velocityX||0)+(p.x-ox)/dt;p.velocityY=(p.velocityY||0)+(p.y-oy)/dt;
    pull.remaining=Math.max(0,pull.remaining-moved);pull.time=Math.max(0,pull.time-dt);
    if(blocked||pull.time<=0||pull.remaining<.01||d<=62)p.harpoonPull=null;
  };
  const updatePlayer=G.updatePlayer;
  G.updatePlayer=function(p,input,dt){if(this.paused)return;const result=updatePlayer.call(this,p,input,dt);this.updateHarpoonPull(p,dt);return result;};
  for(const method of ['start','load','defeat','enterDungeon','leaveDungeon','fastTravel','toggleCoop']){
    const original=G[method];if(!original)continue;
    G[method]=function(...args){const before=this.world,result=original.apply(this,args);if(['start','load','defeat','toggleCoop'].includes(method)||result||before!==this.world)this.clearHarpoonPulls();return result;};
  }
  const previousDamageEnemy=G.damageEnemy;
  G.damageEnemy=function(e,amount,p,critical){
    if(coastal(e)&&W.Content.enemies[e.type].role==='shellguard'){
      if(e.combatState==='recovery')amount*=1.25;
      else if(!(e.freeze>0)&&!(e.stun>0)&&p&&Math.abs(W.wrapAngle(angleTo(e,p)-(e.angle||0)))<1.05)amount*=.32;
    }
    return previousDamageEnemy.call(this,e,amount,p,critical);
  };
  const previousKill=G.killEnemy;
  G.killEnemy=function(e,p){const result=previousKill.call(this,e,p);if(coastal(e)&&!alive(e))this.cancelCoastalAttack(e,0);return result;};
  const previousEffects=G.updateEffects;
  G.updateEffects=function(dt){
    if(this.paused||!(dt>0))return;
    for(const f of this.effects)if(f.alive&&f.coastalStrike&&f.life<=dt){
      const caster=this.world.activeEnemies.find(e=>e.id===f.coastalOwnerId);
      if(alive(caster)&&!(caster.freeze>0)&&!(caster.stun>0)&&!this.pointLocked(f.x,f.y)&&!this.safeZoneAt(f.x,f.y)){
        this.effect('lightning',caster.x,caster.y-30,0,.24,{tx:f.x,ty:f.y,color:'#f3db70'});
        this.effect('shockwave',f.x,f.y,f.radius,.24,{color:'#f3db70'});
        for(const p of targets(this))if(distance(p,f)<f.radius&&this.lineOfSight(caster,p))hitTarget(this,p,f.damage,{x:f.x,y:f.y,kind:'stormChime'});
      }
      f.alive=false;
    }
    return previousEffects.call(this,dt);
  };
})();
