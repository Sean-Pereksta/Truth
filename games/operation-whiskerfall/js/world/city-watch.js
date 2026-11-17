(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,U=W.UI.prototype;
  const zone=(w,p)=>!w.isDungeon&&p&&w.cityZones?.find(c=>p.x>=c.left&&p.x<=c.right&&p.y>=c.top&&p.y<=c.bottom);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const halfAngle=.405,reach=335,notice=.86;
  const sight=W.CityVision;
  function walls(w,e){return sight.nearby(zone(w,e),e,reach);}
  function limit(o,angle,blocks,length=reach){return sight.limit(o,angle,blocks,length);}
  function sees(w,e,p){
    if(!p||p.downed||p.hp<=0||p.smokeTime>0||zone(w,p)?.key!==e.cityWatch)return false;
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);if(d>reach)return false;
    const a=Math.atan2(dy,dx);
    return Math.abs(delta(a,e.watchBearing??e.angle))<=halfAngle&&d<=limit(e,a,walls(w,e));
  }
  function report(g,e,p){
    // Neighbors receive the reported location, never the hidden hero's new position.
    const prev=e.watchMode==='alarm';e.watchMode='alarm';e.watchSound=false;e.watchMemory=6.5;e.watchLast={x:p.x,y:p.y};
    for(const ally of g.world.activeEnemies){
      if(ally===e||!ally.cityWatch||ally.cityWatch!==e.cityWatch||ally.hp<=0||ally.dead||distance(ally,e)>690)continue;
      if(ally.watchMode!=='alarm'){ally.watchMode='search';ally.watchMemory=6.5;ally.watchLast={...e.watchLast};}
    }
    if(!prev&&!(g.cityAlarmToast>g.time)){g.cityAlarmToast=g.time+5;g.audio.play('alert');g.ui.toast('Watch whistle! Patrols are searching the last sighting. Break the beam behind masonry.','event');}
  }
  G.cityGunshot=function(hero,gun){
    const city=zone(this.world,hero);if(!city||this.paused)return;
    const radius=gun.mechanic==='beam'?750:gun.pellets>1?850:700;
    let heard=false;
    for(const guard of this.world.activeEnemies){
      if(guard.cityWatch!==city.key||guard.hp<=0||guard.dead||distance(hero,guard)>radius)continue;
      if(guard.watchMode!=='alarm'){guard.watchMode='search';guard.watchSound=true;}
      guard.watchLast={x:hero.x,y:hero.y};guard.watchMemory=6.5;guard.watchSearchBase=null;heard=true;
    }
    if(heard&&!(this.citySoundToast>this.time)){this.citySoundToast=this.time+7;this.ui.toast('Gunshot heard · the watch is moving to the firing position.','event');}
  };
  function approach(g,e,p,speed,dt){
    if(distance(e,p)<10){sight.stand(e,'idle');return;}
    const nav=g.world.steerAround(e,p,dt),x=e.x,y=e.y;g.move(e,nav.mx*speed*dt,nav.my*speed*dt,17);
    e.velocityX=(e.x-x)/dt;e.velocityY=(e.y-y)/dt;e.moveTime=(e.moveTime||0)+dt;e.anim=distance(e,{x,y})>.1?'run':'idle';
  }
  G.updateCityWatch=function(e,spec,dt){
    if(dt<=0||this.paused)return;
    e.watchSuspicion??=[0,0];e.watchMode??='patrol';e.watchBearing??=Number(e.angle)||0;
    let target=null;
    for(const p of this.players){const lit=sees(this.world,e,p);e.watchSuspicion[p.id]=Math.max(0,Math.min(1,(e.watchSuspicion[p.id]||0)+(lit?dt/notice:-dt*1.6)));
      if(lit&&(e.watchSuspicion[p.id]>=1||e.watchMode==='alarm')&&(!target||distance(e,p)<distance(e,target)))target=p;
    }
    e.watchMemory=Math.max(0,(e.watchMemory||0)-dt);
    if(target){
      report(this,e,target);const error=sight.face(e,Math.atan2(target.y-e.y,target.x-e.x),dt,3.35);
      if(distance(e,target)>205)approach(this,e,target,67,dt);else sight.stand(e,'aim');
      if(e.fireTimer<=0&&error<.18){this.enemyBullet(e,target,this.enemyDamage(e,spec)*.75,'enemy',.04);this.setAnim(e,'shoot');e.fireTimer=1.1;}
      return;
    }
    if(e.watchMemory>0&&e.watchLast){
      e.watchMode='search';const last=e.watchLast;
      if(distance(e,last)>35){sight.face(e,Math.atan2(last.y-e.y,last.x-e.x),dt,2.55);approach(this,e,last,77,dt);}
      else{sight.stand(e,'aim');e.watchSearchBase??=e.angle;sight.face(e,e.watchSearchBase+Math.sin(this.time*1.6)*.92,dt,1.65);}
      e.angle=e.watchBearing;return;
    }
    e.watchMode='patrol';e.watchSearchBase=null;
    if(sight.patrol(this,e,dt,approach))return;
    const horizontal=e.watchRoute!=='y',phase=(this.time*.19+(e.watchPhase||0))%(Math.PI*2);
    const p={x:e.homeX+(horizontal?Math.sin(phase)*142:0),y:e.homeY+(horizontal?0:Math.sin(phase)*142)};
    const direction=(horizontal?0:Math.PI/2)+(Math.cos(phase)<0?Math.PI:0);
    const desired=direction+Math.sin(this.time*.85+(e.watchPhase||0))*.49;
    sight.face(e,desired,dt,1.4);
    approach(this,e,p,42,dt);
  };
  function cone(r,e){
    const c=r.ctx,points=sight.contour(e,e.watchBearing??e.angle,halfAngle,reach,walls(r.game.world,e));
    const alert=e.watchMode==='alarm',search=e.watchMode==='search',strong=r.game.settings.highContrastWarnings;
    const grad=c.createRadialGradient(e.x,e.y,4,e.x,e.y,reach);grad.addColorStop(0,alert?'#ff986baa':search?'#ffd17daa':'#ffeeacb8');grad.addColorStop(1,alert?'#ff685452':search?'#ffc36230':'#ffe39a38');
    c.save();c.beginPath();c.moveTo(e.x,e.y);
    for(const p of points)c.lineTo(p.x,p.y);
    c.closePath();c.fillStyle=grad;c.fill();c.lineWidth=strong?3:1;c.strokeStyle=strong?'#fff4be':'#f5d49a8c';if(search)c.setLineDash([6,5]);c.stroke();c.restore();
  }
  const terrain=R.drawTerrain;
  R.drawTerrain=function(w){
    const result=terrain.apply(this,arguments),v=this.view;
    if(w.isDungeon||!v)return result;
    const c=this.ctx;
    if(v.y+v.h>=w.cityOldHeight){
      c.save();c.fillStyle='#192132';const top=Math.max(v.y,w.cityOldHeight);
      let left=v.x;
      for(const city of (w.cityZones||[]).slice().sort((a,b)=>a.left-b.left)){
        if(city.left>left)c.fillRect(left,top,city.left-left,v.h);
        left=Math.max(left,city.right);
      }
      if(left<v.x+v.w)c.fillRect(left,top,v.x+v.w-left,v.h);c.restore();
    }
    for(const city of w.cityZones||[]){
      if(v.x>city.right||v.x+v.w<city.left||v.y>city.bottom||v.y+v.h<city.top)continue;
      W.CityPaving?.draw(this,w,city);
      for(const e of w.activeEnemies)if(e.cityWatch===city.key&&e.hp>0&&!e.dead&&this.visible(e.x,e.y,reach))cone(this,e);
    }return result;
  };
  const detail=R.drawGroundDetail;
  R.drawGroundDetail=function(d){
    if(d.type!=='cityPaving')return detail.apply(this,arguments);
    const c=this.ctx,im=W.TownStreets.image(d.cityKey==='ironveil'?'street-5':'street-7');
    c.save();if(im){this.cityPatterns??={};this.cityPatterns[d.cityKey]??=c.createPattern(im,'repeat');c.fillStyle=this.cityPatterns[d.cityKey];}else c.fillStyle='#494a50';
    c.fillRect(d.x-d.w/2,d.y-d.h/2,d.w,d.h);c.restore();
  };
  const draw=R.drawObject;
  R.drawObject=function(o,w){
    let key=o.type==='cityBuilding'?o.cityArt:o.type==='streetFixture'?o.painting:null;
    if(!key&&o.townId&&!o.townPainting&&['house','building'].includes(o.type)){const d=W.Content.townStreets[o.townId];if(d&&!d.small)key='homes-'+d.index;}
    if(o.type==='tavernDoor')key='tavern-exterior';
    if(!key)return draw.apply(this,arguments);
    let im;
    if(key==='tavern-exterior'){this.tavernExterior??=new Image();if(!this.tavernExterior.src)this.tavernExterior.src=(W.config.assetBaseURL||'assets')+'/tavern/exterior.webp';if(this.tavernExterior.naturalWidth)im=this.tavernExterior;}
    else im=W.TownStreets.image(key);
    if(!im)return draw.apply(this,arguments);
    const width=o.visualWidth||(o.solid?o.w*1.35:o.w),naturalHeight=width*im.height/im.width;
    const height=o.cityArt?Math.max(naturalHeight,Math.min(198,width*1.38)):naturalHeight,y=o.frontY??(o.y+(o.solid?o.h*.31:6));
    const c=this.ctx;c.save();const obscures=this.game.players.some(p=>Math.abs(p.x-o.x)<width*.48&&p.y<=y&&p.y>y-height);
    if(obscures)c.globalAlpha=.39;
    if(o.cityArt){
      this.cityFacadeCache??=new Map();
      if(!this.cityFacadeCache.has(im)){const buffer=document.createElement('canvas');buffer.width=im.width;buffer.height=im.height;const paint=buffer.getContext('2d');paint.drawImage(im,0,0);paint.globalCompositeOperation='source-atop';paint.fillStyle=o.cityKey==='blackglass'?'#18244544':'#352b3040';paint.fillRect(0,0,im.width,im.height);this.cityFacadeCache.set(im,buffer);}
      im=this.cityFacadeCache.get(im);
    }
    c.translate(o.x,y);if(o.flip)c.scale(-1,1);c.drawImage(im,-width/2,-height,width,height);
    c.restore();
  };
  const friendly=R.friendlyPosition;
  R.friendlyPosition=function(o){
    if(!o.streetRoute)return friendly.call(this,o);
    const seq=o.streetRoute,cycle=(this.clock*.18+o.phase)%(2*(seq.length-1)),i=Math.floor(cycle),u=cycle-i,idx=v=>v<seq.length?v:2*(seq.length-1)-v;
    const a=seq[idx(i)],b=seq[idx(i+1)],f=Math.min(1,u*1.38);
    return {x:o.homeX+a[0]+(b[0]-a[0])*f,y:o.homeY+a[1]+(b[1]-a[1])*f,flip:b[0]<a[0],walk:f<1};
  };
  const atmosphere=R.atmosphere;
  R.atmosphere=function(w){
    const result=atmosphere.apply(this,arguments),city=zone(w,this.game.camera);
    const now=performance.now(),dt=Math.min(.1,(now-(this.lastCityLightTime??now))*.001);
    this.lastCityLightTime=now;
    const target=city?(city.key==='blackglass'?.54:.42):0;
    this.cityNight=(this.cityNight||0)+Math.sign(target-(this.cityNight||0))*Math.min(Math.abs(target-(this.cityNight||0)),dt*.8);
    if(this.cityNight>.002){
      const c=this.ctx,wid=this.width,h=this.height;c.save();
      const glow=c.createRadialGradient(wid*.5,h*.5,h*.12,wid*.5,h*.5,wid*.65);
      glow.addColorStop(0,'rgba(12,18,36,'+(this.cityNight*.38)+')');glow.addColorStop(.6,'rgba(10,16,38,'+(this.cityNight*.71)+')');glow.addColorStop(1,'rgba(7,12,30,'+this.cityNight+')');
      c.fillStyle=glow;c.fillRect(0,0,wid,h);c.restore();
    }
    return result;
  };
  const label=R.drawLocationLabels;
  R.drawLocationLabels=function(w){
    const result=label.apply(this,arguments);if(w.isDungeon)return result;
    for(const e of w.activeEnemies){if(!e.cityWatch||e.hp<=0||!this.visible(e.x,e.y,75))continue;
      const suspicion=Math.max(...(e.watchSuspicion||[0]));
      if(e.watchMode==='alarm'||e.watchMode==='search'||suspicion>.08){
        const s=e.watchMode==='alarm'?'!  SPOTTED':e.watchMode==='search'?(e.watchSound?'♪  SHOT HEARD':'?  SEARCHING'):'◐  '+Math.round(suspicion*100)+'%';
        this.worldLabel(s,e.x,e.y-72,e.watchMode==='alarm'?'#ffb491':'#fff1bf',12);
      }
    }
    for(const p of this.game.players){const city=zone(w,p);if(!city)continue;const x=p.x-city.left,y=p.y-city.top;
      if(this===this.game.renderer&&this.game.cityDistrict!==city.key+'/'+(x>2020)+'/'+(y>1550)){
        this.game.cityDistrict=city.key+'/'+(x>2020)+'/'+(y>1550);this.game.ui.toast(city.name+' · '+city.quarters[(y>1550?2:0)+(x>2020?1:0)],'quest');
      }break;
    }return result;
  };
  function platform(g,p){
    const w=g.world;if(w.isDungeon||!w.cityZones)return null;
    for(const city of w.cityZones)for(const end of ['_tram','_return']){
      const l=w.getLocation(city.id+end);if(l&&distance(l,p)<70)return {city,l,home:end==='_return'};
    }return null;
  }
  const interact=G.interact;
  G.interact=function(p){
    const stop=!this.paused&&!p.downed&&platform(this,p);
    if(!stop||this.players.some(q=>q!==p&&q.downed&&distance(q,p)<108))return interact.apply(this,arguments);
    if(this.players.some(q=>q.downed)){this.ui.toast('Revive your partner before boarding.');return true;}
    if(!stop.home&&stop.city.key==='ironveil'&&!this.world.opened.has('ironveil_rail_pass')){this.ui.toast('The freight line is sealed. File Last Car on the Siding from Cinder Rail Depot to obtain a rail pass.');return true;}
    if(!stop.home&&stop.city.region===7&&!this.world.berlinUnlocked()){this.ui.toast('Berlin night tram · file the dossier and defeat the eight commanders for clearance.');return true;}
    const to=this.world.getLocation(stop.city.id+(stop.home?'_tram':'_return'));
    for(const [i,hero] of this.players.entries()){this.clearPlayerCombat(hero);Object.assign(hero,{x:to.x+i*36,y:to.y+62,invuln:3});this.restorePlayerPosition(hero);}
    this.input.clear?.();this.camera.x=this.players[0].x;this.camera.y=this.players[0].y;this.travelInteractUntil=this.time+.5;
    this.world.updateActive(this.players,1,this);this.ui.toast(stop.home?'Back at '+stop.city.tram:stop.city.name+' · watch the flashlight beams and report at the shelter.','quest');
    this.save(false);return true;
  };
  const missions=G.updateMissions;
  G.updateMissions=function(dt){
    const result=missions.apply(this,arguments);if(!this.world.isDungeon)for(const p of this.players){
      const stop=platform(this,p);if(stop){this.interactionPrompt=(this.input.actionLabel?.(p.id,'interact')||'Interact')+' · '+(stop.home?'Return to town':stop.city.tram);break;}
    }return result;
  };
  const map=R.drawMap;
  R.drawMap=function(c,width,height,options){
    const result=map.apply(this,arguments),w=this.game.world;if(w.isDungeon)return result;
    c.save();c.scale(width/w.width,height/w.height);
    for(const city of w.cityZones||[]){c.strokeStyle='#cfb682';c.lineWidth=23;c.strokeRect(city.left,city.top,city.right-city.left,city.bottom-city.top);
      c.fillStyle='#ece1bc';c.textAlign='center';c.font='bold 220px Georgia';c.fillText(city.name,city.x,city.y);}
    c.restore();return result;
  };
  W.CityWatch={sees,limit,zone,report,reach,halfAngle};
}());
