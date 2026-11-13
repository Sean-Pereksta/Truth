// Presentation only: anticipate the existing cooldown, then show weapon contact
// on the simulation's actual strike. These poses never delay or add damage.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const iso=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const crossbows=new Set(['gilded_crossbow','tollhouse_crossbow','sharpshooter']);
export function combatPose(u,g,definition={},moving=false){
  const now=g.time||0,event=u.attackVisual,age=event?now-event.at:Infinity;
  const ranged=definition.class==='archer'||definition.ranged||u.type==='archer';
  const crossbow=crossbows.has(u.type),hammer=!!definition.hammer;
  const windup=hammer?.2:definition.spearWeapon?.16:.12;
  const active=event&&age>=0&&age<(crossbow?event.cycle:hammer?.4:definition.spearWeapon?.3:.26);
  const hit=u.hitVisual,hitAge=hit?now-hit.at:Infinity,reacting=hitAge>=0&&hitAge<.18;
  const preparing=!moving&&u.target&&u.cooldown>0&&u.cooldown<windup&&!['move','expand','retreat'].includes(u.order?.mode)&&!(u.shockUntil>now);
  // Most soldiers are walking, waiting or between swings. Avoid range and fog
  // queries (and all pose allocation) for that overwhelmingly common case.
  if(!active&&!preparing&&!reacting)return null;
  let pose=null;
  if(active){
    const contact=clamp(1-age/(hammer?.15:.1),0,1),recovery=clamp(age/(hammer?.4:.26),0,1);
    let frame;
    if(crossbow){frame=age<.075?1:age<.22?2:age<event.cycle-.12?3:0;}
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
  if(pose.crossbow&&pose.event&&pose.recovery>.15&&pose.frame>=2){
    // Small string/bolt motion reinforces the painted cock-and-reload poses.
    c.save();c.globalAlpha=.55;c.strokeStyle='#d0b78d';c.lineWidth=1;
    const sweep=Math.sin((g.time-pose.event.at)*8)*2;c.beginPath();c.moveTo(p.x-3,p.y-19);c.lineTo(p.x+3,p.y-19+sweep);c.stroke();c.restore();
  }
}
