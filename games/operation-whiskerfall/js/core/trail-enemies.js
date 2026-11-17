(function () {
  'use strict';
  const W=window.OW, C=W.Content, G=W.Game.prototype, R=W.Renderer.prototype;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function walk(g,e,p,spec,dt,visible){
    const a=Math.atan2(p.y-e.y,p.x-e.x),steer=visible?{mx:Math.cos(a),my:Math.sin(a)}:g.world.steerAround(e,p,dt);
    const gait=spec.id==='seam_ripper'?1+.35*Math.sin(g.time*13):.88+.13*Math.sin(g.time*8);
    const x=e.x,y=e.y,speed=spec.speed*gait*(e.chillTime>0?.6:1);
    g.move(e,steer.mx*dt*speed,steer.my*dt*speed,17);
    e.velocityX=(e.x-x)/dt;e.velocityY=(e.y-y)/dt;e.angle=a;e.anim='run';
  }
  function start(g,e,p,spec){
    const bell=spec.id==='gallows_bell',angle=Math.atan2(p.y-e.y,p.x-e.x);
    const duration=(bell?.78:.51)*(g.settings.longWarnings?1.5:1);
    const a={kind:bell?'ring':'lane',x:e.x,y:e.y,angle,elapsed:0,phase:'windup',duration,length:0,travel:0,hit:0};
    if(!bell){
      const limit=Math.min(420,distance(e,p)+55);
      for(let d=8;d<=limit;d+=8){
        const x=e.x+Math.cos(angle)*d,y=e.y+Math.sin(angle)*d;
        if(g.world.isBlocked(x,y,18)||g.pointLocked(x,y))break;
        a.length=d;
      }
      if(a.length<32){e.fireTimer=.3;return;}
    }
    e.trailAction=a;e.combatState='windup';g.setAnim(e,'windup');e.angle=angle;
    e.velocityX=e.velocityY=0;g.audio.play(bell?'crackedBell':'shearClick',(e.x-p.x)/520);
  }
  G.updateTrailEnemy=function(e,p,spec,dt,visible){
    const a=e.trailAction;
    if(!a){
      if(visible&&distance(e,p)<=spec.range&&e.fireTimer<=0)start(this,e,p,spec);
      else walk(this,e,p,spec,dt,visible);
      return;
    }
    a.elapsed+=dt;
    if(a.phase==='windup'){
      if(a.elapsed<a.duration)return;
      a.phase='strike';a.elapsed=0;e.combatState='strike';e.anim='melee';
      if(a.kind==='ring'){
        this.audio.play('crackedBell');const damage=this.enemyDamage(e,spec);
        for(const hero of this.players){const r=distance(a,hero);if(r>=85&&r<=265&&this.lineOfSight(a,hero))this.damagePlayer(hero,damage,e);}
      }
    }
    if(a.phase==='strike'){
      if(a.kind==='ring'){if(a.elapsed<.15)return;}
      else {
        const before=a.travel,after=Math.min(a.length,before+dt*1160),dx=Math.cos(a.angle),dy=Math.sin(a.angle);
        this.move(e,a.x+dx*after-e.x,a.y+dy*after-e.y,18);
        a.travel=Math.max(before,(e.x-a.x)*dx+(e.y-a.y)*dy);
        for(const hero of this.players){
          const bit=1<<hero.id;if(a.hit&bit||hero.downed)continue;
          const along=(hero.x-a.x)*dx+(hero.y-a.y)*dy,cross=(hero.y-a.y)*dx-(hero.x-a.x)*dy;
          if(along>=before&&along<=a.travel&&Math.abs(cross)<=34&&this.lineOfSight(e,hero)){
            a.hit|=bit;this.damagePlayer(hero,this.enemyDamage(e,spec),e);
          }
        }
        if(a.travel+1>=after&&after<a.length)return;
      }
      a.phase='recovery';a.elapsed=0;e.combatState='recovery';e.anim='land';
    }
    if(a.elapsed>=.86){e.trailAction=null;e.combatState=null;e.fireTimer=.42;}
  };
  // The floor preview and hit test use the same fixed origin, angle and bounds.
  const ground=R.drawTerrain;
  R.drawTerrain=function(world){
    const result=ground.apply(this,arguments),c=this.ctx;
    for(const e of world.activeEnemies){
      const a=e.trailAction;if(!a||e.dead||e.hp<=0||a.phase==='recovery'||!this.visible(a.x,a.y,470))continue;
      c.save();c.translate(a.x,a.y);c.rotate(a.angle);
      const strong=this.game.settings.highContrastWarnings;
      c.fillStyle=strong?'#ffbb4999':a.kind==='ring'?'#dc8a354d':'#bf53605c';
      c.strokeStyle=strong?'white':a.kind==='ring'?'#ffe49a':'#ffd1c9';c.lineWidth=strong?5:3;
      if(a.kind==='ring'){c.beginPath();c.arc(0,0,265,0,Math.PI*2);c.moveTo(85,0);c.arc(0,0,85,0,Math.PI*2,true);c.fill('evenodd');c.stroke();}
      else {c.fillRect(0,-34,a.length,68);c.setLineDash([14,7]);c.strokeRect(0,-34,a.length,68);}
      c.restore();
    }
    return result;
  };
  const portraits=new Map(),frame=R.actorFrame,paint=R.drawIllustratedEnemy;
  R.actorFrame=function(e,isPlayer,legacy){
    const s=!isPlayer&&!legacy&&C.enemies[e.type];
    if(!s?.trailEnemy)return frame.apply(this,arguments);
    return {art:true,trailPortrait:s.image,h:s.id==='gallows_bell'?110:65,w:s.id==='gallows_bell'?79:108};
  };
  R.drawIllustratedEnemy=function(e,f,options){
    if(!f.trailPortrait)return paint.apply(this,arguments);
    let im=portraits.get(f.trailPortrait);
    if(!im){im=new Image();portraits.set(f.trailPortrait,im);im.src=(W.config.assetBaseURL||'assets')+'/enemies/'+f.trailPortrait+'.webp';}
    if(!im.naturalWidth)return false;
    const c=this.ctx,moving=e.anim==='run',a=e.trailAction,t=this.clock;
    const lean=a?.phase==='windup'?-.10:a?.phase==='recovery'?.15:moving?Math.sin(t*11)*.055:0;
    c.save();c.translate(e.x,e.y+(moving?Math.abs(Math.sin(t*10))*-3:0));c.scale(Math.cos(e.angle)<0?-1:1,1);c.rotate(lean);
    c.drawImage(im,-f.w/2,-f.h+5,f.w,f.h);c.restore();return true;
  };
})();
