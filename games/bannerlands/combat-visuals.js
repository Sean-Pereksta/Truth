// Presentation only: anticipate the existing cooldown, then show weapon contact
// on the simulation's actual strike. These poses never delay or add damage.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const iso=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const crossbows=new Set(['gilded_crossbow','tollhouse_crossbow','sharpshooter']);
const reloadStyles={gilded_crossbow:'belt',tollhouse_crossbow:'lever',sharpshooter:'windlass'};
const smooth=(a,b,t)=>{const v=clamp((t-a)/(b-a),0,1);return v*v*(3-2*v);};
// Every part follows the simulation's completed stationary work. Paused games,
// interrupted orders and resumed reloads therefore cannot animate a loaded bolt.
export function crossbowReloadPose(u,definition={}){
  if(!u.reloading||!u.reload||!(u.reload.duration>0))return null;
  const progress=clamp((u.reload.progress||0)/u.reload.duration,0,1),style=definition.reloadStyle||reloadStyles[u.type];
  if(!style)return null;
  const cock=smooth(.12,.65,progress),load=smooth(.7,.88,progress),raise=smooth(.88,1,progress);
  const bend=style==='lever'?Math.sin(Math.PI*smooth(0,.88,progress)):.55*Math.sin(Math.PI*smooth(0,.88,progress));
  return {style,progress,stage:progress<.12?'lower':progress<.65?'cock':progress<.88?'load':'raise',cock,load,raise,bend,
    lever:style==='lever'?Math.sin(Math.PI*smooth(.12,.65,progress)):0,
    crank:style==='windlass'?smooth(.12,.65,progress)*Math.PI*10:0,
    bolt:progress>=.7,boltSeat:load,weaponTilt:(style==='lever'?.72:style==='belt'?.45:.12)*(1-raise),
    pull:style==='belt'?cock*(1-smooth(.65,.7,progress)):0};
}
export function combatPose(u,g,definition={},moving=false){
  const now=g.time||0,event=u.attackVisual,age=event?now-event.at:Infinity;
  const ranged=definition.class==='archer'||definition.ranged||u.type==='archer';
  const crossbow=crossbows.has(u.type),hammer=!!definition.hammer;
  const windup=hammer?.2:definition.spearWeapon?.16:.12;
  const active=event&&age>=0&&age<(crossbow?.12:hammer?.4:definition.spearWeapon?.3:.26);
  const reload=crossbow&&!moving?crossbowReloadPose(u,definition):null;
  const hit=u.hitVisual,hitAge=hit?now-hit.at:Infinity,reacting=hitAge>=0&&hitAge<.18;
  const preparing=!moving&&!(crossbow&&u.reload)&&u.target&&u.cooldown>0&&u.cooldown<windup&&!['move','expand','retreat'].includes(u.order?.mode)&&!(u.shockUntil>now);
  // Most soldiers are walking, waiting or between swings. Avoid range and fog
  // queries (and all pose allocation) for that overwhelmingly common case.
  if(!active&&!reload&&!preparing&&!reacting)return null;
  let pose=null;
  if(active){
    const contact=clamp(1-age/(hammer?.15:.1),0,1),recovery=clamp(age/(hammer?.4:.26),0,1);
    let frame;
    if(crossbow){frame=1;}
    else if(hammer){frame=age<.13?2:3;}
    else if(definition.spearWeapon){frame=age<.12?1:age<.21?2:3;}
    else frame=age<.08?1:age<.17?2:3;
    // Moving archers retain their gait after the release, rather than freezing
    // their mount or feet for the rest of a reload.
    if(!moving||age<.12||!ranged){
      const dir=iso(event.dx,event.dy),len=Math.hypot(dir.x,dir.y)||1;
      const lunge=ranged?-1.5*contact:hammer?2.8*contact:definition.spearWeapon?2.5*contact:1.5*contact;
      pose={frame,attack:true,contact,recovery,dx:dir.x/len*lunge,dy:dir.y/len*lunge,tilt:ranged?0:hammer?-.035*contact:.018*contact,event,crossbow,ranged,hammer};
    }
  }else if(reload){
    pose={frame:reload.stage==='raise'?0:3,attack:true,contact:0,recovery:reload.progress,
      dx:0,dy:0,tilt:0,crossbow:true,ranged:true,reload,bodyTilt:reload.bend*(reload.style==='lever'?.18:.08),bodyDrop:reload.bend*(reload.style==='lever'?3.8:1.8)};
  }else if(preparing){
    const target=u.target,visible=!g.config?.fogOfWar||g.isVisibleTo?.(0,target),range=g.unitRange?.(u)??definition.range??.7;
    if(target.hp>0&&visible&&Math.hypot(target.x-u.x,target.y-u.y)<=range+(target.radius||.07)&&(!g.canAttackFacing||g.canAttackFacing(u,target))){
      const progress=1-u.cooldown/windup,dx=target.x-u.x,dy=target.y-u.y,length=Math.hypot(dx,dy)||1,dir=iso(dx/length,dy/length),len=Math.hypot(dir.x,dir.y)||1;
      pose={frame:hammer&&progress>.35?1:0,attack:true,contact:0,windup:progress,dx:-dir.x/len*progress*1.8,dy:-dir.y/len*progress*1.8,tilt:hammer?.025*progress:0,ranged,hammer};
    }
  }
  if(reacting){
    const dir=iso(hit.dx,hit.dy),len=Math.hypot(dir.x,dir.y)||1,kick=Math.sin(Math.PI*hitAge/.18)*(hit.blocked?1:2.2);
    pose??={attack:false,dx:0,dy:0,tilt:0,contact:0};
    pose.dx+=dir.x/len*kick;pose.dy+=dir.y/len*kick;pose.tilt+=(hit.blocked?.012:.035)*Math.sin(Math.PI*hitAge/.18);pose.blocked=hit.blocked;
  }
  return pose;
}

export function drawCombatAccents(c,u,g,definition,p,pose,zoom=1){
  if(!pose||zoom<.5)return;
  if(pose.event&&pose.contact>.05&&definition.spearWeapon){
    const v=iso(pose.event.dx,pose.event.dy),len=Math.hypot(v.x,v.y)||1;
    const reach=Math.min(definition.range||1,pose.event.distance||1)*len,dx=v.x/len,dy=v.y/len;
    c.save();c.globalAlpha=.8*pose.contact;c.strokeStyle='#e4dcc2';c.lineWidth=1.8;
    c.beginPath();c.moveTo(p.x+dx*4,p.y-15+dy*4);c.lineTo(p.x+dx*reach,p.y-15+dy*reach);c.stroke();
    c.fillStyle='#f4efd9';c.beginPath();c.moveTo(p.x+dx*(reach+4),p.y-15+dy*(reach+4));c.lineTo(p.x+dx*(reach-2)-dy*2,p.y-15+dy*(reach-2)+dx*2);c.lineTo(p.x+dx*(reach-2)+dy*2,p.y-15+dy*(reach-2)-dx*2);c.closePath();c.fill();c.restore();
  }
  if(pose.reload)drawCrossbowReload(c,u,p,pose.reload);
}

function drawCrossbowReload(c,u,p,r){
  const direction=u.braceDir||{x:Number.isFinite(u.facingX)?u.facingX:1,y:Number.isFinite(u.facingY)?u.facingY:0};
  const screen=iso(direction.x,direction.y),facing=screen.x<-.03?-1:1;
  const stroke=(points,color,width)=>{c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const hand=(x,y)=>{c.fillStyle='#b69572';c.beginPath();c.ellipse(x,y,1.65,1.25,0,0,Math.PI*2);c.fill();};
  c.save();c.translate(p.x,p.y);c.scale(facing,1);c.lineCap='round';c.lineJoin='round';
  // Articulated forearms connect the painted shoulders to the working hands.
  const shoulderY=(r.style==='belt'?-19:r.style==='windlass'?-21:-23)+r.bend*2,workY=r.style==='lever'?-13+r.bend*4:r.style==='belt'?-14+r.bend*2:-16+r.bend*2;
  stroke([[-4,shoulderY],[-5,workY-1],[-1-r.pull*3,workY+1+r.pull*3]],'#333c3b',2.8);
  stroke([[-4,shoulderY],[-5,workY-1],[-1-r.pull*3,workY+1+r.pull*3]],'#888b7d',1.7);
  stroke([[3,shoulderY],[6,workY-2],[9,workY]],'#424a44',2.7);
  stroke([[3,shoulderY],[6,workY-2],[9,workY]],'#8d8c78',1.6);
  c.save();c.translate(3,workY);c.rotate(r.weaponTilt);c.scale(.75,.75);
  const wood=r.style==='belt'?'#9b7947':r.style==='lever'?'#806444':'#6e5a43';
  // Stock, bending steel limbs, string and stirrup are separate moving parts.
  stroke([[-10,1],[12,0]],'#302c27',4.1);stroke([[-10,0],[12,-1]],wood,2.6);
  stroke([[10,-7],[13,-1],[10,6]],'#283431',3);stroke([[10,-7],[13,-1],[10,6]],'#9da28f',1.4);
  const stringX=11-r.cock*12;
  stroke([[10,-7],[stringX,-.5],[10,6]],'#c2b58f',.9);
  stroke([[13,-2],[16,-2],[16,1],[13,1]],'#8c9789',1);
  if(r.style==='belt'&&r.progress<.7){
    // The belt hook catches the string; the hand/body draw it to the nut.
    stroke([[stringX,-.5],[stringX-3,4+r.pull*4],[-7,5+r.pull*4]],'#b59a63',1.7);
    stroke([[stringX-1,-1.5],[stringX+1,-1.5],[stringX+1,.5]],'#d7d4b7',1);hand(stringX-3,4+r.pull*4);
  }else if(r.style==='lever'&&r.progress<.7){
    const angle=-.3-r.lever*1.65,lx=-4+Math.cos(angle)*11,ly=1+Math.sin(angle)*11;
    stroke([[-4,1],[lx,ly]],'#303b37',3);stroke([[-4,1],[lx,ly]],'#9c9f88',1.4);stroke([[lx,ly],[stringX,0]],'#9fa68f',.9);hand(lx,ly);
    // A visible boot pins the foot stirrup while the lever folds down.
    stroke([[16,1],[17,5],[12,5]],'#4f4434',2.8);
  }else if(r.style==='windlass'&&r.progress<.7){
    stroke([[-7,-4],[-7,4]],'#d3d0ae',2.7);stroke([[-7,-4],[stringX,-2],[-7,4]],'#c5b58d',.8);
    c.beginPath();c.ellipse(-7,0,3.2,3.2,0,0,Math.PI*2);c.fillStyle='#4c554c';c.fill();c.strokeStyle='#b6bca7';c.lineWidth=1;c.stroke();
    const cx=-7+Math.cos(r.crank)*5,cy=Math.sin(r.crank)*4;
    stroke([[-7,0],[cx,cy],[cx,cy+2]],'#d0c7a3',1.5);hand(cx,cy+2);
  }
  if(r.bolt){
    // A bolt is visibly taken from the pouch and seated only after cocking.
    const bx=-8+(1-r.boltSeat)*-5,by=-2+(1-r.boltSeat)*6;
    stroke([[bx,by],[bx+14,by]],'#e4cf9c',1);stroke([[bx,by-1.5],[bx+2,by],[bx,by+1.5]],'#d8e0cf',.8);
    hand(bx+2,by+1.8);
  }
  hand(7,2);c.restore();c.restore();
}
