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
  const windup=hammer?.2:ranged&&!crossbow?.28:definition.spearWeapon?.16:.12;
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

const EARTH_IMPACT_COLORS={
  turf:{rim:'#7a633e',pit:'#372a1d',dark:'#51402e',light:'#9b8055',dust:'#b49a71'},
  forest:{rim:'#5d5032',pit:'#2f2718',dark:'#433923',light:'#8a724a',dust:'#a58c66'},
  stone:{rim:'#73695a',pit:'#41392c',dark:'#564d40',light:'#a0947c',dust:'#bdb19a'},
  ford:{rim:'#77918b',pit:'#385652',dark:'#597163',light:'#a7b5a5',dust:'#c0ccc0'}
};
const earthDustSprites=new Map();
const tau=Math.PI*2;

export function isSiegeEarthImpact(effect){
  return effect.type==='explosion'&&(effect.kind==='catapult'||effect.kind==='trebuchet');
}

function earthImpactPalette(tile){
  if(tile?.feature==='ford')return EARTH_IMPACT_COLORS.ford;
  if(tile?.feature==='pass'||tile?.feature==='bridge'||tile?.terrain==='hill')return EARTH_IMPACT_COLORS.stone;
  return tile?.terrain==='forest'?EARTH_IMPACT_COLORS.forest:EARTH_IMPACT_COLORS.turf;
}

function earthNoise(seed,index){
  let n=Math.imul(seed+index+1,0x45d9f3b);
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  return ((n^(n>>>16))>>>0)/0x100000000;
}

function dustSprite(palette){
  let canvas=earthDustSprites.get(palette);
  if(canvas)return canvas;
  canvas=document.createElement('canvas');
  canvas.width=canvas.height=48;
  const c=canvas.getContext('2d'),dust=c.createRadialGradient(23,20,2,24,24,24);
  dust.addColorStop(0,palette.dust);
  dust.addColorStop(.48,palette.dust+'b8');
  dust.addColorStop(.77,palette.dust+'48');
  dust.addColorStop(1,palette.dust+'00');
  c.fillStyle=dust;
  c.fillRect(0,0,48,48);
  earthDustSprites.set(palette,canvas);
  return canvas;
}

function impactEllipse(c,x,y,rx,ry,color){
  c.beginPath();
  c.ellipse(x,y,rx,ry,0,0,tau);
  c.fillStyle=color;
  c.fill();
}

export function drawSiegeEarthImpact(c,f,p,tile,lowDetail,ground){
  const age=clamp(1-f.life/(f.maxLife||1),0,1);
  const heavy=f.kind==='trebuchet',scale=clamp(f.radius||1.3,.7,1.9);
  const palette=earthImpactPalette(tile);
  const seed=Math.round(f.x*1000)+Math.imul(Math.round(f.y*1000),421);
  c.save();
  c.translate(p.x,p.y);
  c.scale(scale,scale);

  if(ground){
    // Keep the impact point beneath the troops while dust and clods rise above it.
    c.globalAlpha=.58*(1-smooth(.42,1,age));
    if(lowDetail||tile?.feature==='ford'){
      impactEllipse(c,0,0,11,5,palette.rim);
    }else{
      c.beginPath();
      for(let i=0;i<12;i++){
        const angle=i*tau/12,radius=8+earthNoise(seed,i)*5;
        const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius*.44;
        if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.closePath();
      c.fillStyle=palette.rim;
      c.fill();
    }
    impactEllipse(c,0,-.6,7.5,2.8,palette.pit);
  }else if(lowDetail){
    c.globalAlpha=.49*(1-age);
    impactEllipse(c,0,-2-age*7,5+age*14,3+age*5,palette.dust);
  }else{
    const puff=dustSprite(palette),count=heavy?8:6;
    const spread=Math.sqrt(age),rotation=earthNoise(seed,23)*tau;
    for(let i=0;i<count;i++){
      const angle=rotation+i*tau/count;
      const range=(4+earthNoise(seed,32+i)*16)*spread;
      const size=(5+age*12)*(.74+earthNoise(seed,48+i)*.5);
      const x=Math.cos(angle)*range+age*4;
      const y=Math.sin(angle)*range*.36-(3+earthNoise(seed,64+i)*18)*spread;
      c.globalAlpha=(.35+earthNoise(seed,80+i)*.2)*(1-age)**1.65*(.5+.5*smooth(0,.12,age));
      c.drawImage(puff,x-size,y-size*.85,size*2,size*1.7);
    }

    // Uneven launch speeds send stone chips and sod up before they settle.
    for(let i=0,n=heavy?14:10;i<n;i++){
      const angle=rotation+i*2.399963;
      const flight=.31+earthNoise(seed,96+i)*.45,travel=Math.min(1,age/flight);
      const range=(9+earthNoise(seed,112+i)*22)*travel;
      const x=Math.cos(angle)*range,y=Math.sin(angle)*range*.46;
      const height=(4+earthNoise(seed,128+i)*(heavy?18:13))*4*travel*(1-travel);
      const size=.55+earthNoise(seed,144+i)*1.45;
      c.globalAlpha=.83*(1-smooth(flight,1,age));
      c.save();
      c.translate(x,y-height);
      c.rotate(angle+travel*3);
      c.beginPath();
      c.moveTo(-size,-size*.27);
      c.lineTo(size*.26,-size*.68);
      c.lineTo(size,size*.3);
      c.lineTo(-size*.3,size*.6);
      c.closePath();
      c.fillStyle=i%3===0?palette.light:palette.dark;
      c.fill();
      c.restore();
    }
  }
  c.restore();
}

// A crowded rank needs one readable contact per effect/patch. Choose locally
// visible events before assigning the budget, so hidden impacts cannot suppress
// a visible cue or disclose a gunner in fog.
export function visibleCombatEffects(g,bounds,lowDetail=false){
  if(!g.effects?.length)return [];
  const bursts=new Map(),limit=lowDetail?24:48,cell=lowDetail?48:32;
  const cx=bounds?(bounds.left+bounds.right)/2:0,cy=bounds?(bounds.top+bounds.bottom)/2:0;
  for(const f of g.effects){
    if(lowDetail&&f.type==='dust')continue;
    const p=iso(f.x,f.y);
    if(bounds&&(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom))continue;
    if(g.config?.fogOfWar&&!g.isVisibleTo(g.playerTeam??0,{x:f.x,y:f.y}))continue;
    const key=[Math.floor(p.x/cell),Math.floor(p.y/cell),f.type,f.kind||'',f.team].join('|');
    const prior=bursts.get(key);
    if(!prior||f.life/(f.maxLife||1)>prior.f.life/(prior.f.maxLife||1)){
      bursts.set(key,{f,p,priority:isSiegeEarthImpact(f)?-1:f.type==='dust'?2:f.type==='hit'?1:0,distance:(p.x-cx)**2+(p.y-cy)**2});
    }
  }
  const chosen=[...bursts.values()];
  if(chosen.length>limit){chosen.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);chosen.length=limit;}
  return chosen;
}
