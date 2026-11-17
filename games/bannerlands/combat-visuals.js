// Presentation only: anticipate the existing cooldown, then show weapon contact
// on the simulation's actual strike. These poses never delay or add damage.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const iso=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const crossbows=new Set(['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel']);
const reloadStyles={gilded_crossbow:'belt',tollhouse_crossbow:'lever',sharpshooter:'windlass',vale_sentinel:'compact-lever'};
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
  const now=g.time||0,event=u.attackVisual,age=event?(event.elapsed??now-event.at):Infinity;
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
    const target=u.target,visible=!g.config?.fogOfWar||g.isVisibleTo?.(g.playerTeam??0,target),range=g.unitRange?.(u)??definition.range??.7;
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

// Character equipment is painted into complete authored raster action frames.
// Retained as a compatibility hook; UI markers are rendered separately.
export function drawCombatAccents(){}
