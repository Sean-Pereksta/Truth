export const HALF_TILE_WIDTH=28;
export const HALF_TILE_HEIGHT=14;

export function projectileKind({type,sourceType,crossbow}){
  if(crossbow||sourceType==='beacon_engineer')return 'bolt';
  if(sourceType==='dragonfire_acolyte')return 'firepot';
  return type||'arrow';
}

export function projectileFlightDuration(type,sourceType,distance){
  if(sourceType==='trebuchet')return 1.15+distance*.025;
  if(type==='rock'||sourceType==='beacon_engineer')return .8;
  if(type==='bolt')return .09+distance*.022;
  return .24+distance*.035;
}

export function projectileDrawPose(projectile,kind=projectileKind(projectile)){
  // A fog-filtered snapshot can supply the local pose without sending endpoints.
  if(Number.isFinite(projectile.flightHeight)&&Number.isFinite(projectile.flightAngle)){
    return {height:projectile.flightHeight,angle:projectile.flightAngle};
  }
  const {sourceType,x,y,sx=x,sy=y,tx=x,ty=y,t=0,duration=1}=projectile;
  const dx=tx-sx,dy=ty-sy,distance=Math.hypot(dx,dy);
  const progress=Math.max(0,Math.min(1,t/duration));
  let startHeight=14,endHeight=10,arc=20;
  if(kind==='arrow'){
    arc=Math.min(55,17+distance*8);
    if(sourceType==='tower'||sourceType==='keep')startHeight=34;
    if(sourceType==='sun_horse_archer')startHeight=20;
  }else if(kind==='bolt'){
    arc=Math.min(2.8,distance*.5);
  }else if(kind==='rock'){
    arc=sourceType==='trebuchet'?89:65;
    startHeight=sourceType==='trebuchet'?30:18;
    endHeight=0;
  }else if(kind==='firepot'){
    arc=42;
    endHeight=0;
  }
  const height=startHeight+(endHeight-startHeight)*progress+4*arc*progress*(1-progress);
  const verticalTangent=endHeight-startHeight+4*arc*(1-2*progress);
  const angle=Math.atan2((dx+dy)*HALF_TILE_HEIGHT-verticalTangent,(dx-dy)*HALF_TILE_WIDTH);
  return {height,angle:kind==='axe'?angle+progress*Math.PI*6:angle};
}
