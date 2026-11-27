// Match sprite drawing and pointer hit tests without moving the simulation unit.
export function unitPresentationMix(unit,mix){
  if(mix==null||mix===1||!Number.isFinite(unit.previousRenderX)||!Number.isFinite(unit.previousRenderY))return 1;
  const dx=unit.x-unit.previousRenderX,dy=unit.y-unit.previousRenderY;
  // Skip blending across teleports or exceptional collision corrections.
  const distanceSquared=dx*dx+dy*dy;
  return distanceSquared>0&&distanceSquared<=1?mix:1;
}

export function unitPresentationPhase(game,unit,localMix=1){
  if(localMix!==1&&Number.isFinite(unit.previousRenderPhase)){
    return unit.previousRenderPhase+(unit.phase-unit.previousRenderPhase)*localMix;
  }
  const blend=game.unitStrideBlend;
  if(!blend)return unit.phase;
  const end=blend.next.get(unit.id);
  if(end===undefined)return unit.phase;
  if(blend.mix===1)return end;
  const start=blend.previous.get(unit.id);
  return start===undefined?unit.phase:start+(end-start)*blend.mix;
}
