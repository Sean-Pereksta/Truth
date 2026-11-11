(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype;let states=new WeakMap(),shots=new Set(),completionSeen=new WeakMap();
  const style=p=>p?.equipment?.armor?.resistanceStyle;
  function state(p){let s=states.get(p);if(!s||s.armor!==style(p)){s={armor:style(p),focus:0,lastShot:-100,signalCount:0,signalTarget:null,signalAt:-100,ward:0,wardUntil:0,wardReady:0,moveUntil:0,reloadUntil:0};states.set(p,s);}return s;}
  const shoot=G.shoot;
  G.shoot=function(p,...args){
    const gun=this.weapon(p),s=state(p),before=p.ammo,take=this.bulletPool.take,emit=this.effect,muzzle=W.ResistanceArt?.muzzle(this.renderer,p,true),record={p,gun:gun.id,hit:false,bullets:[],focus:s.focus,time:this.time};
    if(gun.id==='lanternline'&&this.time-s.lastShot<.55)record.focus=0;
    this.bulletPool.take=function(data){if(muzzle&&data.owner===p.id)Object.assign(data,muzzle);const bullet=take.call(this,data);if(bullet&&['lanternline','breachmaker','signalstorm'].includes(gun.id)){bullet.resistanceShot=record;record.bullets.push(bullet);}return bullet;};
    this.effect=function(type,x,y,radius,life,options){if(muzzle&&type==='muzzle'&&options?.owner===p.id){x=muzzle.x;y=muzzle.y;options={...options,height:muzzle.visualHeight};}return emit.call(this,type,x,y,radius,life,options);};
    try{return shoot.call(this,p,...args);}finally{this.bulletPool.take=take;this.effect=emit;if(p.ammo<before&&record.bullets.length){if(gun.id==='lanternline'&&this.time-s.lastShot<.55)s.focus=0;s.lastShot=this.time;shots.add(record);}}
  };
  const status=G.applyEnemyStatus;
  G.applyEnemyStatus=function(e,b){
    const result=status.call(this,e,b),shot=b.resistanceShot,p=shot?.p;if(!shot||!p)return result;const s=state(p),first=!shot.hit;shot.hit=true;
    if(shot.gun==='lanternline'&&first){const exposed=(e.stun||0)>0||['recover','recovery','exposed'].includes(e.combatState)||Math.abs(W.wrapAngle(Math.atan2(p.y-e.y,p.x-e.x)-(e.angle||0)))>1.2;if(exposed&&shot.focus>0&&e.hp>0)this.damageEnemy(e,b.damage*Math.min(.18,shot.focus*.06),p);s.focus=Math.min(3,shot.focus+1);if(s.focus===3)this.text('FOCUS',p.x,p.y-52,'#ffe09c');}
    if(shot.gun==='breachmaker'&&W.dist(p,e)<150&&/shield|armor|bulwark|bruiser|roller/.test(W.Content.enemies[e.type]?.role||'')&&e.hp>0)this.damageEnemy(e,b.damage*.25,p);
    if(shot.gun==='signalstorm'&&first){s.signalCount=s.signalTarget===e.id&&this.time-s.signalAt<=2.5?s.signalCount+1:1;s.signalTarget=e.id;s.signalAt=this.time;if(s.signalCount>=4){s.signalCount=0;e.resistanceMarkedUntil=this.time+3;this.text('MARKED +8%',e.x,e.y-65,'#8df4ef');this.effect('shockwave',e.x,e.y,37,.35,{color:'#8df4ef'});}}
    return result;
  };
  const projectiles=G.updateProjectiles;
  G.updateProjectiles=function(dt){const result=projectiles.call(this,dt);for(const shot of shots)if(shot.bullets.every(b=>!b.alive||b.resistanceShot!==shot)){if(!shot.hit){const s=state(shot.p);if(shot.gun==='lanternline')s.focus=0;if(shot.gun==='signalstorm')s.signalCount=0;}shots.delete(shot);}return result;};
  const damageEnemy=G.damageEnemy;
  G.damageEnemy=function(e,amount,p,...args){return damageEnemy.call(this,e,amount*(e.resistanceMarkedUntil>this.time?1.08:1),p,...args);};
  const dodge=G.armorDodge;
  G.armorDodge=function(p){const result=dodge.call(this,p),s=state(p);if(s.armor==='blackglass'){s.moveUntil=this.time+2;s.reloadUntil=this.time+3;this.effect('shockwave',p.x,p.y,42,.25,{color:'#c5a4ef'});}if(s.armor==='lastwatch'&&s.wardReady<=this.time&&this.projectiles.some(b=>b.alive&&b.owner<0&&W.dist(p,b)<100&&(p.x-b.x)*b.vx+(p.y-b.y)*b.vy>0)){s.ward=35;s.wardUntil=this.time+2;s.wardReady=this.time+8;this.text('WATCH WARD',p.x,p.y-52,'#f1cd81');}return result;};
  const move=G.move;
  G.move=function(actor,dx,dy,...args){if(this.players?.includes(actor)&&style(actor)==='blackglass'&&state(actor).moveUntil>this.time&&!(actor.dodgeTime>0)&&!actor.downed&&Math.abs(dx)+Math.abs(dy)<30){dx*=1.12;dy*=1.12;}return move.call(this,actor,dx,dy,...args);};
  const reload=G.reload;
  G.reload=function(p){const before=p.reloading,result=reload.call(this,p),s=state(p);if(before<=0&&p.reloading>0&&s.armor==='blackglass'&&s.reloadUntil>this.time){p.reloading*=.8;s.reloadUntil=0;this.text('QUICK RELOAD',p.x,p.y-52,'#d2b0ff');}return result;};
  const damagePlayer=G.damagePlayer;
  G.damagePlayer=function(p,amount,source){const s=state(p);if(s.armor==='lastwatch'&&s.wardUntil>this.time&&s.ward>0&&p.invuln<=0&&!p.downed&&!(p.smokeTime>0)&&!this.safeZoneAt(p.x,p.y)){const absorbed=Math.min(amount,s.ward);s.ward-=absorbed;amount-=absorbed;this.effect('shield',p.x,p.y,40,.2);if(amount<=0)return;}return damagePlayer.call(this,p,amount,source);};
  const checkQuests=G.checkQuests;
  G.checkQuests=function(){const before=completionSeen.get(this)||new Set(this.missionCompleted||[]),result=checkQuests.call(this);for(const id of this.missionCompleted||[])if(!before.has(id)&&/defend|camp|invasion|lastwatch/.test(id))for(const p of this.players){const s=state(p);if(s.armor==='lastwatch'){s.ward=35;s.wardUntil=this.time+2;s.wardReady=this.time+8;this.text('WATCH WARD',p.x,p.y-52,'#f1cd81');}}completionSeen.set(this,new Set(this.missionCompleted||[]));return result;};
  const clear=G.clearPlayerCombat;if(clear)G.clearPlayerCombat=function(p){states.delete(p);return clear.call(this,p);};
  for(const method of ['load','start','defeat','enterDungeon','leaveDungeon','fastTravel']){const previous=G[method];if(previous)G[method]=function(...args){const result=previous.apply(this,args);if(result!==false){states=new WeakMap();shots=new Set();completionSeen.set(this,new Set(this.missionCompleted||[]));}return result;};}
  W.ResistanceGear={stateFor:state,reset(){states=new WeakMap();shots=new Set();}};
})();
