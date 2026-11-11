(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer?.prototype,TAU=Math.PI*2;
  const live=e=>e&&e.hp>0&&!e.dead&&!e.downed,kraken=e=>e?.kraken||e?.id==='cave_kraken_guardian';
  const arena=p=>p&&p.x>1120&&p.x<1760&&p.y>220&&p.y<1040;
  const point=p=>({x:W.clamp(p.x,1175,1705),y:W.clamp(p.y,275,985)});
  const segment=(p,a)=>{const dx=a.tx-a.x,dy=a.ty-a.y,t=W.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
  function ensure(g,e){
    if(!kraken(e)||!g.world?.isDungeon)return;
    e.kraken=true;e.name='Nacremaw, the Great Kraken';e.dungeonBoss=e.boss=true;e.guardian=3;
    const s=g.world.state;if(![1,2].includes(s.krakenPartySize))s.krakenPartySize=g.players.length>1?2:1;
    const max=s.krakenPartySize===2?72000:48000;
    if(e.maxHp!==max){const fraction=W.clamp(e.hp/(e.maxHp||max),0,1);e.maxHp=max;e.hp=max*fraction;}
    e.damage=190;e.phase=e.hp/e.maxHp>.7?1:e.hp/e.maxHp>.35?2:3;e.krakenPose=e.krakenPose||0;
  }
  G.clearKrakenThreats=function(e){
    for(const f of this.effects||[])if(f.krakenOwner===e.id)f.alive=false;
    for(const b of this.projectiles||[])if(b.krakenOwner===e.id)b.alive=false;
    e.krakenAction=null;e.krakenPose=0;e.krakenRecovery=0;e.cooldown=Math.max(1.25,e.cooldown||0);
  };
  function tell(g,e,event){
    const size=event.radius||event.width||200;
    return g.effect('krakenTell',event.x,event.y,size,event.at,{owner:-1,krakenOwner:e.id,shape:event.kind,...event,color:event.kind==='ring'?'#b1f3d5':event.kind==='fan'?'#cda5f3':'#84e5ed'});
  }
  G.beginKrakenAttack=function(e,target,kind){
    ensure(this,e);if(!live(e)||!arena(target)||!this.world.state.solved)return false;
    const phase=e.phase,angle=Math.atan2(target.y-e.y,target.x-e.x),targets=this.players.filter(p=>live(p)&&arena(p)),events=[],power=e.damage*(1+(phase-1)*.15);
    if(kind==='tentacleLash'){
      const list=phase===1?[target]:targets;
      for(const [i,p]of list.entries()){const to=point(p);events.push({kind:'lane',x:1175+(i%2)*530,y:315,tx:to.x,ty:to.y,width:36,at:1.15+i*.3,damage:power*1.15});}
      if(phase===3){const to=point({x:target.x+(target.x<1440?120:-120),y:target.y});events.push({kind:'lane',x:1440,y:960,tx:to.x,ty:to.y,width:32,at:1.95,damage:power});}
      e.krakenPose=1;
    }else if(kind==='tidalSlam'){
      for(const [i,p]of (phase===1?[target]:targets).entries()){const pos=point(p);events.push({kind:'circle',...pos,radius:80,at:1.15+i*.25,damage:power*1.25});}
      if(phase===3)events.push({kind:'circle',...point({x:target.x+(target.x<1440?155:-155),y:target.y+110}),radius:75,at:2,damage:power});
      e.krakenPose=1;
    }else if(kind==='inkBarrage'){
      events.push({kind:'fan',x:e.x,y:e.y,angle,spread:1.35,count:phase===1?5:7,at:1.2,damage:power*.75});
      if(phase>1)events.push({kind:'fan',x:e.x,y:e.y,angle:angle+.28,spread:1.35,count:7,at:1.95,damage:power*.75});
      e.krakenPose=3;
    }else if(kind==='undertow'||kind==='maelstrom'){
      events.push({kind:'ring',x:e.x,y:e.y,radius:45,toRadius:430,gapAngle:angle,gapHalf:.46,at:1.2,damage:power});
      if(kind==='maelstrom'){
        events.push({kind:'circle',...point(target),radius:76,at:1.8,damage:power});
        events.push({kind:'ring',x:e.x,y:e.y,radius:45,toRadius:430,gapAngle:angle+.65,gapHalf:.52,at:2.8,damage:power*.9});
      }
      e.krakenPose=3;
    }else return false;
    const duration=Math.max(...events.map(v=>v.at+(v.kind==='ring'?1.35:0)))+.25;
    e.krakenAction={kind,elapsed:0,duration,events:events.map(v=>({...v,fired:false}))};e.lastAttack=kind;e.krakenRecovery=0;e.anim='windup';
    for(const event of events)if(!tell(this,e,event)){this.clearKrakenThreats(e);return false;}
    return e.krakenAction;
  };
  function impact(g,e,event){
    const source={x:event.x,y:event.y,kind:'kraken',krakenOwner:e.id,name:e.name};
    if(event.kind==='lane'||event.kind==='circle'){
      for(const p of g.players)if(live(p)&&arena(p)&&g.lineOfSight(source,p)&&(event.kind==='lane'?segment(p,event)<=event.width+14:Math.hypot(p.x-event.x,p.y-event.y)<=event.radius+14))g.damagePlayer(p,event.damage,source);
      g.effect('krakenImpact',event.x,event.y,event.radius||event.width,.35,{...event,krakenOwner:e.id,owner:-1});e.krakenPose=2;g.audio.play('stomp');
    }else if(event.kind==='fan'){
      for(let i=0;i<event.count;i++){const a=event.angle-event.spread/2+i*event.spread/(event.count-1);g.bulletPool.take({x:e.x+Math.cos(a)*70,y:e.y+Math.sin(a)*70,vx:Math.cos(a)*345,vy:Math.sin(a)*345,life:1.7,owner:-1,kind:'enemy',radius:8,damage:event.damage,color:'#a8a1e8',krakenOwner:e.id});}
      e.krakenPose=4;g.audio.play('plasma');
    }else if(event.kind==='ring'){
      g.effect('krakenRing',event.x,event.y,event.toRadius,1.35,{owner:-1,krakenOwner:e.id,fromRadius:event.radius,toRadius:event.toRadius,gapAngle:event.gapAngle,gapHalf:event.gapHalf,damage:event.damage,hitPlayers:{}});e.krakenPose=4;g.audio.play('waterstep');
    }
  }
  const update=G.updateEnemies;
  G.updateEnemies=function(dt){
    const w=this.world,bosses=w?.activeEnemies?.filter(kraken)||[];
    if(!bosses.length)return update.call(this,dt);
    if(this.paused||!(dt>0))return;
    w.activeEnemies=w.activeEnemies.filter(e=>!kraken(e));
    try{update.call(this,dt);}finally{w.activeEnemies.push(...bosses.filter(live));}
    for(const e of bosses){
      if(!live(e))continue;ensure(this,e);
      const targets=this.players.filter(p=>live(p)&&arena(p)),target=targets.sort((a,b)=>Math.hypot(e.x-a.x,e.y-a.y)-Math.hypot(e.x-b.x,e.y-b.y))[0];
      if(!w.state.solved||!target){this.clearKrakenThreats(e);continue;}
      for(const status of ['burn','poison','bleed'])if(e[status]>0){const tick=Math.min(dt,e[status]);e[status]=Math.max(0,e[status]-dt);e.hp-=tick*(e[status+'Damage']||7)*(status==='poison'?(e.poisonStacks||1):1);if(e.hp<=0){this.killEnemy(e,this.players[e[status+'Owner']]||this.players[0]);break;}}
      if(!live(e))continue;
      const phase=e.hp/e.maxHp>.7?1:e.hp/e.maxHp>.35?2:3;
      if(e.krakenAnnouncedPhase!==phase){e.krakenAnnouncedPhase=phase;this.effect('bossWarning',e.x,e.y,190,1.2,{text:'NACREMAW · PHASE '+phase});}
      e.phase=phase;e.animTime=(e.animTime||0)+dt;e.hit=Math.max(0,(e.hit||0)-dt);e.chillTime=Math.max(0,(e.chillTime||0)-dt);e.stun=Math.max(0,(e.stun||0)-dt);e.angle=Math.atan2(target.y-e.y,target.x-e.x);
      if(e.krakenAction){const a=e.krakenAction;a.elapsed+=dt;for(const event of a.events)if(!event.fired&&a.elapsed+1e-8>=event.at){event.fired=true;impact(this,e,event);}if(a.elapsed>=a.duration){e.krakenAction=null;e.krakenRecovery=phase===3?1.6:2.1;e.cooldown=e.krakenRecovery;e.krakenPose=5;e.anim='idle';}continue;}
      e.krakenRecovery=Math.max(0,(e.krakenRecovery||0)-dt);e.cooldown=Math.max(0,(e.cooldown||0)-dt*(e.chillTime>0?.86:1));e.krakenPose=e.krakenRecovery>0?5:0;e.anim='idle';
      if(e.cooldown>0)continue;
      const roster=phase===1?['tentacleLash','tidalSlam','inkBarrage']:phase===2?['tentacleLash','undertow','inkBarrage','tidalSlam']:['maelstrom','tentacleLash','inkBarrage','tidalSlam'];
      const kind=roster[(e.cycle||0)%roster.length];e.cycle=(e.cycle||0)+1;this.beginKrakenAttack(e,target,kind);
    }
    w._rebuildEnemyGrid?.();
  };
  const effects=G.updateEffects;
  G.updateEffects=function(dt){
    if(dt>0&&!this.paused)for(const f of this.effects){if(!f.alive||!f.krakenOwner)continue;const boss=this.world.activeEnemies.find(e=>e.id===f.krakenOwner&&live(e));if(!boss){f.alive=false;continue;}if(f.type!=='krakenRing')continue;
      const elapsed=f.maxLife-f.life,from=f.fromRadius+(f.toRadius-f.fromRadius)*W.clamp(elapsed/f.maxLife,0,1),to=f.fromRadius+(f.toRadius-f.fromRadius)*W.clamp((elapsed+Math.min(dt,f.life))/f.maxLife,0,1);
      for(const p of this.players){if(!live(p)||!arena(p)||f.hitPlayers[p.id])continue;const d=Math.hypot(p.x-f.x,p.y-f.y),a=Math.atan2(p.y-f.y,p.x-f.x);if(Math.abs(W.wrapAngle(a-f.gapAngle))<=f.gapHalf)continue;if(d>=from-27&&d<=to+27){f.hitPlayers[p.id]=true;this.damagePlayer(p,f.damage,{x:f.x,y:f.y,kind:'kraken',krakenOwner:f.krakenOwner});}}
    }
    return effects.call(this,dt);
  };
  const damage=G.damageEnemy;G.damageEnemy=function(e,amount,...args){return damage.call(this,e,amount*(kraken(e)?e.krakenRecovery>0?1.25:.2:1),...args);};
  const kill=G.killEnemy;G.killEnemy=function(e,...args){if(kraken(e)){this.clearKrakenThreats(e);e.krakenPose=7;}return kill.call(this,e,...args);};
  function restore(g){if(!g.world?.isDungeon)return;for(const e of g.world.activeEnemies)if(kraken(e)){ensure(g,e);g.clearKrakenThreats(e);}}
  for(const method of ['enterDungeon','load','resetCheckpointCombat']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false)restore(this);return result;};}
  const snapshot=G.snapshot;G.snapshot=function(){for(const e of this.world?.activeEnemies||[])if(kraken(e))ensure(this,e);const data=snapshot.call(this);for(const s of Object.values(data.dungeonStates||{}))for(const e of s.enemies||[])if(kraken(e)){e.krakenAction=null;e.krakenRecovery=0;e.krakenPose=0;}return data;};
  if(R){
    const draw=R.drawActor;R.drawActor=function(e,isPlayer,...args){if(!kraken(e)||isPlayer)return draw.call(this,e,isPlayer,...args);if(!W.ExpeditionArt?.drawKraken?.(this,e))return draw.call(this,e,isPlayer,...args);const c=this.ctx;c.save();c.textAlign='center';c.font='700 14px system-ui';c.strokeStyle='#071a23';c.lineWidth=4;c.strokeText(e.name,e.x,e.y-180);c.fillStyle='#b4f1e8';c.fillText(e.name,e.x,e.y-180);c.fillStyle='#10232d';c.fillRect(e.x-100,e.y-166,200,8);c.fillStyle=e.krakenRecovery>0?'#b9e890':'#a88cd9';c.fillRect(e.x-100,e.y-166,200*W.clamp(e.hp/e.maxHp,0,1),8);c.font='11px system-ui';c.fillStyle='#e0efd9';c.fillText(e.krakenRecovery>0?'EXPOSED · +25% DAMAGE':'PHASE '+(e.phase||1)+' · ARMORED SHELL',e.x,e.y-146);c.restore();};
    const effect=R.drawEffect;R.drawEffect=function(f,front){if(!['krakenTell','krakenImpact','krakenRing'].includes(f.type))return effect.call(this,f,front);if(front)return;const c=this.ctx;c.save();c.strokeStyle=f.color||'#a6ebec';c.fillStyle=f.color||'#a6ebec';c.lineWidth=f.type==='krakenImpact'?8:2.5;c.globalAlpha=f.type==='krakenImpact'?.55:.8;
      if(f.type==='krakenRing'||f.shape==='ring'){const radius=f.type==='krakenRing'?f.fromRadius+(f.toRadius-f.fromRadius)*W.clamp((f.maxLife-f.life)/f.maxLife,0,1):f.toRadius;c.lineWidth=f.type==='krakenRing'?15:2;c.beginPath();c.arc(f.x,f.y,radius,f.gapAngle+f.gapHalf,f.gapAngle+TAU-f.gapHalf);c.stroke();if(f.type==='krakenTell'){c.strokeStyle='#c2f9a4';for(const sign of [-1,1]){const a=f.gapAngle+f.gapHalf*sign;c.beginPath();c.moveTo(f.x+Math.cos(a)*45,f.y+Math.sin(a)*45);c.lineTo(f.x+Math.cos(a)*radius,f.y+Math.sin(a)*radius);c.stroke();}}}
      else if(f.shape==='lane'||f.kind==='lane'){const a=Math.atan2(f.ty-f.y,f.tx-f.x),nx=-Math.sin(a)*f.width,ny=Math.cos(a)*f.width;c.beginPath();c.moveTo(f.x+nx,f.y+ny);c.lineTo(f.tx+nx,f.ty+ny);c.lineTo(f.tx-nx,f.ty-ny);c.lineTo(f.x-nx,f.y-ny);c.closePath();c.stroke();c.globalAlpha=.1;c.fill();}
      else if(f.shape==='fan'){for(let i=0;i<f.count;i++){const a=f.angle-f.spread/2+i*f.spread/(f.count-1);c.beginPath();c.moveTo(f.x+Math.cos(a)*70,f.y+Math.sin(a)*70);c.lineTo(f.x+Math.cos(a)*550,f.y+Math.sin(a)*550);c.stroke();}}
      else{c.beginPath();c.arc(f.x,f.y,f.radius,0,TAU);c.stroke();c.globalAlpha=.1;c.fill();}
      c.restore();};
  }
  W.Kraken={ensure,arena,point,ownsRenderer:true};
})();

