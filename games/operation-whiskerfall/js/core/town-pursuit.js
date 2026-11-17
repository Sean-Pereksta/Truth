(function () {
  'use strict';
  const W=window.OW, G=W.Game.prototype, rodents=new Map();
  function able(p){return !!p&&p.hp>0&&!p.downed&&!(p.smokeTime>0);}
  G.pursuitRange=function(e){return W.Content.enemies[e.type]?.role==='sniper'?1870:1360;};
  G.canPursueTown=function(e){
    if(this.world.isDungeon||this.world.isTutorial||e.boss||e.cityWatch||e.turret||e.guardianOwner)return false;
    if(!rodents.has(e.type))rodents.set(e.type,W.Audio.prototype.isRodent(e));
    return rodents.get(e.type);
  };
  G.rememberRatTarget=function(e){
    let nearest=Infinity;
    for(const p of this.players){
      if(!able(p)||this.safeZoneAt(p.x,p.y))continue;
      const d=W.dist(e,p);
      if(d<nearest&&d<=1100&&this.lineOfSight(e,p)){e.pursuitTarget=p.id;nearest=d;}
    }
  };
  function end(e){
    e.pursuitTarget=null;e.streetBite=null;e.pursuitMemory=0;e.streetChase=false;e.trailAction=null;
    e.alert=0;e.state='patrol';e.combatState=null;
  }
  function approach(g,e,to,speed,dt){
    const steer=g.world.steerAround(e,to,dt),x=e.x,y=e.y;
    g.move(e,steer.mx*speed*dt,steer.my*speed*dt,17);
    e.velocityX=(e.x-x)/dt;e.velocityY=(e.y-y)/dt;e.moveTime=(e.moveTime||0)+dt;e.anim='run';
  }
  G.updateTownPursuit=function(e,spec,dt){
    if(e.pursuitTarget==null&&!e.returnFromTown)return false;
    let p=this.players[e.pursuitTarget],town=this.safeZoneAt(e.x,e.y);
    if(!able(p)||W.dist(e,p)>this.pursuitRange(e)){
      if(e.pursuitTarget!=null){end(e);e.returnFromTown=!!town;}
      if(town){approach(this,e,{x:e.homeX,y:e.homeY},spec.speed,dt);return true;}
      e.returnFromTown=false;return false;
    }
    if(!town&&!this.safeZoneAt(p.x,p.y)&&!e.streetChase)return false;
    const seen=this.lineOfSight(e,p);
    if(!e.streetChase){e.pursuitMemory=4;e.streetChase=true;}
    if(seen){e.pursuitMemory=4;e.lastPursuitX=p.x;e.lastPursuitY=p.y;}
    else if((e.pursuitMemory-=dt)<=0){end(e);e.returnFromTown=!!town;return true;}
    if(!town&&!this.safeZoneAt(p.x,p.y)){
      e.streetChase=false;e.streetBite=null;return false;
    }
    e.state='attack';e.alert=Math.max(e.alert||0,e.pursuitMemory);e.angle=Math.atan2(p.y-e.y,p.x-e.x);
    if(spec.trailEnemy){this.updateTrailEnemy(e,p,spec,dt,seen);return true;}
    // Complete an already signaled movement before beginning a street attack.
    if(e.specialMove&&this.updateSpecialMove(e,null,dt))return true;
    if(e.combatAction&&this.updateAdvancedEnemy(e,null,spec,dt))return true;
    const ranged=/rifle|scout|recruit|machinegun|sniper|officer|commando|heavy/.test(spec.role);
    const range=ranged?Math.min(225,spec.range):75;
    if(e.streetBite){
      const bite=e.streetBite;bite.left-=dt;
      if(bite.left<=0){
        if(W.dist(bite,p)<=75&&seen&&this.world._navigationRay(bite.x,bite.y,p.x,p.y,3))this.damagePlayer(p,this.enemyDamage(e,spec),e);
        e.streetBite=null;e.combatState=null;e.fireTimer=.82;
      }
    }else if(!seen||W.dist(e,p)>range){
      const mark=seen?p:{x:e.lastPursuitX??p.x,y:e.lastPursuitY??p.y};
      approach(this,e,mark,spec.speed*1.45*(e.chillTime>0?.6:1),dt);
    }else if(e.fireTimer<=0){
      if(ranged){this.enemyBullet(e,p,this.enemyDamage(e,spec),'enemy',.035);e.fireTimer=1/Math.max(.7,spec.fireRate);this.setAnim(e,'shoot');}
      else{
        const delay=this.settings.longWarnings?.52:.35;
        e.streetBite={x:e.x,y:e.y,left:delay};e.combatState='windup';this.setAnim(e,'windup');
        this.effect('telegraph',e.x,e.y,75,delay,{color:'#efb779'});
      }
    }
    return true;
  };
  G.townUnderPursuit=function(p){
    const town=this.safeZoneAt(p.x,p.y);
    if(!town)return false;
    return this.world.activeEnemies.some(e=>{
      if(e.pursuitTarget==null||e.hp<=0||e.dead)return false;
      const target=this.players[e.pursuitTarget];
      return able(target)&&this.safeZoneAt(target.x,target.y)===town&&W.dist(e,target)<=this.pursuitRange(e);
    });
  };
  const rest=G.nearTown;
  G.nearTown=function(p){const town=rest.call(this,p);return town&&!this.townUnderPursuit(p)?town:null;};
  const interact=G.interact;
  G.interact=function(p){
    if(this.townUnderPursuit(p)){
      const fallen=this.players.find(q=>q!==p&&q.downed&&W.dist(p,q)<100);
      if(fallen){p.reviveTarget=fallen.id;return;}
      this.ui.toast('Rats on the street! Lose the patrol or drive it out before using town services.');return;
    }
    return interact.call(this,p);
  };
  const travel=G.fastTravel;
  G.fastTravel=function(id){
    if(this.players.some(p=>this.townUnderPursuit(p))){this.ui.toast('Lose the pursuing patrol before travelling.');return false;}
    return travel.call(this,id);
  };
})();
