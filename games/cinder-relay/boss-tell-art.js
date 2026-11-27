/* Boss warning strokes share the hit test's space. Only the charge moves;
   the outer rails, blast edge and missing sockets stay where the attack lands. */
(() => {
  'use strict';
  const tau=2*Math.PI,shadow='#221d26',hot='#fff2bb',rim='#ffab80';
  const flavors=['#ffad79','#c8e58b','#ffc67d','#d9b1ff','#b3d4ff','#ffa58a','#bce8ab'];
  const sockets=new WeakMap(),rails=new WeakMap(),curves=new WeakMap(),warningFrames=new WeakMap();
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function circle(c,x,y,r){
    c.beginPath();c.arc(x,y,r,0,tau);
  }
  function stroke(c,color,width){
    c.lineWidth=width;c.strokeStyle=color;c.stroke();
  }
  function railGeometry(b){
    const dx=b.x2-b.x,dy=b.y2-b.y,len=Math.hypot(dx,dy),r=b.r;
    const contour=new Path2D();
    contour.moveTo(0,-r);contour.lineTo(len,-r);contour.arc(len,0,r,-Math.PI/2,Math.PI/2);
    contour.lineTo(0,r);contour.arc(0,0,r,Math.PI/2,Math.PI*1.5);contour.closePath();
    const geom={len,angle:Math.atan2(dy,dx),contour};rails.set(b,geom);return geom;
  }
  function rail(c,b,progress,armed,color){
    // Both endpoints and the width lock at cast time. Reuse the exact capsule
    // in the other pilot's viewport and throughout the charge and discharge.
    const {len,angle,contour}=rails.get(b)||railGeometry(b),r=b.r;
    c.translate(b.x,b.y);c.rotate(angle);
    c.fillStyle=color+(armed?'88':'1c');c.fill(contour);
    c.strokeStyle=shadow;c.lineWidth=3;c.stroke(contour);
    c.strokeStyle=armed?hot:rim;c.lineWidth=1.15;c.stroke(contour);
    if(armed){
      c.beginPath();c.moveTo(0,0);c.lineTo(len,0);stroke(c,color,Math.max(2,r*.78));
      stroke(c,'#fff8df',1.5);return;
    }
    // Opposing rails meet at firing time. No directional arrow is drawn for
    // an area that activates simultaneously along its full length.
    const end=len*progress/2,edge=Math.max(1,r-1.4);
    c.beginPath();
    for(const side of [-1,1]){
      c.moveTo(0,side*edge);c.lineTo(end,side*edge);
      c.moveTo(len,side*edge);c.lineTo(len-end,side*edge);
    }
    stroke(c,color,1.8);
    if(len>32){
      c.beginPath();c.moveTo(len/2-3,-edge);c.lineTo(len/2,-edge+2.4);c.lineTo(len/2+3,-edge);
      c.moveTo(len/2-3,edge);c.lineTo(len/2,edge-2.4);c.lineTo(len/2+3,edge);
      stroke(c,progress>.78?hot:color,1.3);
    }
  }
  function disk(c,b,progress,armed,color){
    const r=b.r;c.translate(b.x,b.y);circle(c,0,0,r);
    c.fillStyle=color+(armed?'87':'25');c.fill();
    stroke(c,shadow,3.4);stroke(c,armed?hot:rim,1.2);
    if(armed){
      const age=clamp((b.age-b.warn)/Math.max(.01,b.duration),0,1);
      circle(c,0,0,Math.max(2,r*(.44+.45*age)));stroke(c,color,2.4);
      const arm=Math.min(r*.56,12);c.beginPath();
      for(let i=0;i<4;i++){
        const a=i*tau/4+.56,x=Math.cos(a),y=Math.sin(a);
        c.moveTo(x*arm*.28,y*arm*.28);c.lineTo(x*arm,y*arm);
      }
      stroke(c,hot,1.6);return;
    }
    const track=Math.max(1,r-2.4),a=-Math.PI/2;
    if(progress>0){c.beginPath();c.arc(0,0,track,a,a+tau*progress);stroke(c,color,2.5);}
    const tick=Math.min(4.5,r*.21);
    c.beginPath();for(let i=0;i<4;i++){
      const dx=Math.cos(i*tau/4),dy=Math.sin(i*tau/4);
      c.moveTo(dx*(r-tick-1),dy*(r-tick-1));c.lineTo(dx*(r-1),dy*(r-1));
    }
    stroke(c,progress>.78?hot:color,1.3);
  }
  function muzzle(c,b,progress,color){
    c.translate(b.x,b.y);
    const hub=Math.max(3,b.r*.68),start=hub+3,reach=Math.min(46,b.reach||36);
    // Each printed spoke is one actual shot direction. Open arcs print no
    // spokes, including the deliberately missing teeth of a radial volley.
    c.beginPath();
    const directions=socketDirections(b),length=start+(reach-start)*(.36+progress*.64);
    if(b.shotCurl&&b.shotSpeed){
      const curve=flightCurve(b),lo=curvePoint(curve,start),mid=curvePoint(curve,(start+length)/2),hi=curvePoint(curve,length);
      const cx=2*mid.x-(lo.x+hi.x)/2,cy=2*mid.y-(lo.y+hi.y)/2;
      for(let i=0;i<directions.length;i+=2){
        const dx=directions[i],dy=directions[i+1];
        c.moveTo(dx*lo.x-dy*lo.y,dy*lo.x+dx*lo.y);
        c.quadraticCurveTo(dx*cx-dy*cy,dy*cx+dx*cy,dx*hi.x-dy*hi.y,dy*hi.x+dx*hi.y);
      }
    }else{
      for(let i=0;i<directions.length;i+=2){
        const dx=directions[i],dy=directions[i+1];
        c.moveTo(dx*start,dy*start);c.lineTo(dx*length,dy*length);
      }
    }
    stroke(c,shadow,3.2);stroke(c,progress>.77?hot:color,1.55);
    circle(c,0,0,hub);c.fillStyle=shadow;c.fill();stroke(c,rim,1.2);
    if(progress>0){
      c.beginPath();c.arc(0,0,Math.max(1,hub-1.7),-Math.PI/2,-Math.PI/2+progress*tau);
      stroke(c,color,1.8);
    }
  }
  function draw(c,b){
    if(!b.signatureId||b.life<=0)return false;
    if(b.castToken?.cancelled)return true;
    if(b.kind!=='beam'&&b.kind!=='blast'&&(b.kind!=='muzzle'||!b.angles?.length))return false;
    const color=flavors[(b.bossOwner||b.owner)?.id]||rim;
    const armed=b.age>=b.warn,progress=clamp(b.age/Math.max(.001,b.warn),0,1);
    c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
    if(b.kind==='beam')rail(c,b,progress,armed,color);
    else if(b.kind==='blast')disk(c,b,progress,armed,color);
    else if(!armed)muzzle(c,b,progress,color);
    c.restore();return true;
  }
  function inChamber(p,room){
    return !room||(p.x>=room.x&&p.y>=room.y&&p.x<=room.x+room.w&&p.y<=room.y+room.h);
  }
  function localSight(g,p,point){
    const lab=g.map?.lab;
    return !lab||Sight.line(lab,p.x,p.y,point.x,point.y);
  }
  function socketDirections(b){
    let dirs=sockets.get(b.angles);
    if(!dirs){
      dirs=new Float64Array(b.angles.length*2);
      for(let i=0;i<b.angles.length;i++){dirs[i*2]=Math.cos(b.angles[i]);dirs[i*2+1]=Math.sin(b.angles[i]);}
      sockets.set(b.angles,dirs);
    }
    return dirs;
  }
  function flightCurve(b){
    let curve=curves.get(b);if(curve)return curve;
    const limit=Math.min(1.45,b.shotLifetime||1.45),steps=Math.ceil(limit*60);
    const path=new Float64Array((steps+1)*2);
    const turn=b.shotCurl/60,cos=Math.cos(turn),sin=Math.sin(turn);
    let vx=b.shotSpeed,vy=0,x=0,y=0,minX=0,maxX=0,minY=0,maxY=0;
    for(let i=1;i<=steps;i++){
      // The hostile update turns velocity before advancing each 60 Hz substep.
      const dt=Math.min(1/60,limit-(i-1)/60),last=i===steps&&dt<1/60-1e-10;
      const a=last?Math.cos(b.shotCurl*dt):cos,z=last?Math.sin(b.shotCurl*dt):sin,oldX=vx;
      vx=oldX*a-vy*z;vy=oldX*z+vy*a;x+=vx*dt;y+=vy*dt;
      path[i*2]=x;path[i*2+1]=y;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    curve={path,steps,limit,speed:b.shotSpeed,minX,maxX,minY,maxY};curves.set(b,curve);return curve;
  }
  function curvePoint(curve,distance){
    const phase=Math.min(curve.limit,distance/curve.speed)*60;
    const i=Math.min(curve.steps-1,Math.floor(phase));
    const f=clamp((phase-i)/Math.min(1,curve.limit*60-i),0,1),p=curve.path,j=i*2;
    return {x:p[j]+(p[j+2]-p[j])*f,y:p[j+1]+(p[j+3]-p[j+1])*f};
  }
  function clearCurve(g,b,curve,ray,ux,uy,step){
    const lab=g.map?.lab,room=b.chamber,blocked=g.shotBlocked||g.blocked;
    if(!lab&&!room&&!blocked)return true;
    // Cast sockets and arena walls lock in world space. Check each new piece
    // of a candidate trajectory once, invalidating it when a shutter changes.
    if(!curve.clear||curve.lab!==lab||curve.open!==lab?.door?.open||curve.seal!==lab?.sealClosed){
      curve.lab=lab;curve.open=lab?.door?.open;curve.seal=lab?.sealClosed;
      curve.clear=new Int16Array(b.angles.length);curve.blocked=new Int16Array(b.angles.length);
    }
    if(curve.blocked[ray]&&step>=curve.blocked[ray])return false;
    const pts=curve.path,r=b.shotRadius||3;
    for(let i=curve.clear[ray]+1;i<=step;i++){
      const j=i*2,x=b.x+pts[j]*ux-pts[j+1]*uy,y=b.y+pts[j]*uy+pts[j+1]*ux;
      const px=b.x+pts[j-2]*ux-pts[j-1]*uy,py=b.y+pts[j-2]*uy+pts[j-1]*ux;
      if((room&&(x<room.x+r||y<room.y+r||x>room.x+room.w-r||y>room.y+room.h-r))
        ||blocked?.(x,y,Math.min(2,r*.4))||(lab&&!Sight.line(lab,px,py,x,y))){
        curve.blocked[ray]=i;return false;
      }
      curve.clear[ray]=i;
    }
    return true;
  }
  function curvedThreat(g,p,b,dx,dy,clearance,remaining){
    const curve=flightCurve(b),pts=curve.path,dirs=socketDirections(b);
    let best=null,visibleOrigin;
    for(let ray=0;ray<b.angles.length;ray++){
      const ux=dirs[ray*2],uy=dirs[ray*2+1],x=dx*ux+dy*uy,y=dy*ux-dx*uy;
      if(x<curve.minX-clearance||x>curve.maxX+clearance||y<curve.minY-clearance||y>curve.maxY+clearance)continue;
      for(let step=1;step<=curve.steps;step++){
        const j=step*2,sx=pts[j-2],sy=pts[j-1],ex=pts[j],ey=pts[j+1];
        if(x<Math.min(sx,ex)-clearance||x>Math.max(sx,ex)+clearance||y<Math.min(sy,ey)-clearance||y>Math.max(sy,ey)+clearance)continue;
        const vx=ex-sx,vy=ey-sy,t=clamp(((x-sx)*vx+(y-sy)*vy)/(vx*vx+vy*vy||1),0,1);
        const startTime=(step-1)/60,travel=startTime+t*Math.min(1/60,curve.limit-startTime);
        const hx=x-sx-t*vx,hy=y-sy-t*vy;
        // At high refresh rates the rotation-before-motion integrator travels
        // slightly inside this arc. Keep grazing misses out of the warning.
        const margin=curve.speed/60*Math.abs(Math.sin(b.shotCurl*travel/2));
        if(hx*hx+hy*hy>=Math.max(0,clearance-margin)**2)continue;
        visibleOrigin??=localSight(g,p,b);if(!visibleOrigin)return null;
        if(!clearCurve(g,b,curve,ray,ux,uy,step))break;
        const time=remaining+travel;
        if(!best||time<best.time)best={time,angle:Math.atan2(-(vx*uy+vy*ux),-(vx*ux-vy*uy)),charge:b.age/b.warn};
        break;
      }
    }
    return best;
  }
  function warnings(g){
    let frame=warningFrames.get(g);
    if(!frame){frame={marks:[]};warningFrames.set(g,frame);}
    if(Number.isFinite(g.time)&&frame.time===g.time&&frame.source===g.hostile&&frame.count===g.hostile.length)return frame.marks;
    frame.time=g.time;frame.source=g.hostile;frame.count=g.hostile.length;
    frame.marks.length=0;
    for(const b of g.hostile)if(b.kind&&b.signatureId&&b.life>0&&!b.castToken?.cancelled)frame.marks.push(b);
    return frame.marks;
  }
  function onCamera(source,view){
    const r=source.r||5;
    return source.x+r>=view.x&&source.y+r>=view.y&&source.x-r<=view.x+view.sw/view.zoom&&source.y-r<=view.y+view.sh/view.zoom;
  }
  function sourceVisible(g,p,source,view){
    if(!onCamera(source,view))return false;
    if(!g.map?.lab)return true;
    return Sight.fromPilot(g,p,source.x,source.y);
  }
  function nearestPoint(b,p){
    if(b.kind!=='beam')return b;
    const dx=b.x2-b.x,dy=b.y2-b.y;
    const k=clamp(((p.x-b.x)*dx+(p.y-b.y)*dy)/(dx*dx+dy*dy||1),0,1);
    return {x:b.x+dx*k,y:b.y+dy*k};
  }
  function localThreat(g,p,b,view,focus){
    if(!inChamber(p,b.chamber))return null;
    const remaining=b.warn-b.age;
    const hitRadius=p.hitR??p.r??6;
    if(b.kind==='muzzle'){
      if(remaining<=0||!b.shotSpeed||!b.angles?.length)return null;
      const dx=p.x-b.x,dy=p.y-b.y,clearance=hitRadius+(b.shotRadius||3);
      // Inside the pilot's view and lamp range, a socket is either already
      // visible or is behind a wall. Neither outcome needs a second cue.
      if(onCamera(b,view)&&(!g.map?.lab||dx*dx+dy*dy<=Sight.range(p)**2))return null;
      const horizon=b.shotSpeed*Math.min(1.45,b.shotLifetime||1.45);
      if(dx*dx+dy*dy>(horizon+clearance)**2)return null;
      if(b.shotCurl)return curvedThreat(g,p,b,dx,dy,clearance,remaining);
      const dirs=socketDirections(b);
      for(let i=0;i<dirs.length;i+=2){
        const ux=dirs[i],uy=dirs[i+1],along=dx*ux+dy*uy;
        if(along<=0||along>horizon||Math.abs(dx*uy-dy*ux)>clearance)continue;
        if(!localSight(g,p,b))return null;
        return {time:remaining+along/b.shotSpeed,angle:Math.atan2(-uy,-ux),charge:b.age/b.warn};
      }
      return null;
    }
    if(b.kind!=='beam'&&b.kind!=='blast')return null;
    const caster=b.bossOwner||b.owner;
    if(!caster)return null;
    const near=nearestPoint(b,p);
    const dx=near.x-p.x,dy=near.y-p.y;
    if(dx*dx+dy*dy>=(hitRadius+b.r)**2)return null;
    if(!focus.busy){
      if(caster!==focus.boss){if(sourceVisible(g,p,caster,view))return null;}
      else {
        focus.visible??=sourceVisible(g,p,caster,view);
        if(focus.visible)return null;
      }
    }
    if(!localSight(g,p,b)||(near!==b&&!localSight(g,p,near)))return null;
    return {time:remaining,angle:null,charge:b.age/b.warn,armed:remaining<=0};
  }
  function marker(c,p,cue,index,coop){
    const color=coop?(index?'#ffb183':'#9df2dc'):hot;
    const r=Math.max(17,(p.r||9)+10),step=clamp(cue.charge,0,1);
    c.save();c.translate(p.x,p.y);c.lineCap='round';c.lineJoin='round';
    c.beginPath();
    if(cue.angle!==null){
      // A compact bearing, tied to this pilot. It cannot expose a caster
      // through cover and never points at a photographed safe gap.
      c.rotate(cue.angle);
      c.moveTo(r+3,-5);c.lineTo(r+7+2*step,0);c.lineTo(r+3,5);
      if(!cue.cast){c.moveTo(r,-3);c.lineTo(r+3,0);c.lineTo(r,3);}
    }else{
      for(const sx of [-1,1]){
        c.moveTo(sx*(r-5),9);c.lineTo(sx*r,7);c.lineTo(sx*(r+1),2);
      }
    }
    stroke(c,shadow,4.7);stroke(c,cue.armed?hot:cue.cast?color:'#ffa17c',2.5);stroke(c,color,1);
    c.restore();
  }
  function drawPilotCues(c,g,view){
    const boss=g.map?.bossEntity;
    if(!boss||boss.dead||boss.hp<=0||!view)return;
    const marks=warnings(g),casting=boss.signatureIndex==null&&boss.windup>0;
    if(!marks.length&&!casting)return;
    const crew=g.players||[g.player],busy=g.hostile.length>=30||(g.particles?.length||0)>=55;
    for(let i=0;i<crew.length;i++){
      if(view.pilot!=null&&view.pilot!==i)continue;
      const p=crew[i];if(!p||p.hp<=0||!inChamber(p,boss.chamber))continue;
      let best=null;
      const focus={boss,busy,visible:null};
      for(const b of marks){
        const candidate=localThreat(g,p,b,view,focus);
        if(candidate&&(!best||candidate.time<best.time))best=candidate;
      }
      if(!best&&casting&&boss.volleyTarget===p){
        const inLamp=onCamera(boss,view)&&(!g.map?.lab||(boss.x-p.x)**2+(boss.y-p.y)**2<=Sight.range(p)**2);
        if(!inLamp&&localSight(g,p,boss))
          best={cast:true,angle:Math.atan2(boss.y-p.y,boss.x-p.x),charge:1-boss.windup/boss.windMax};
      }
      if(best)marker(c,p,best,i,crew.length>1);
    }
  }
  window.BossTellArt={draw,drawPilotCues};
})();
