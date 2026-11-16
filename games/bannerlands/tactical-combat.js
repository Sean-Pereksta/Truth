// Simulation-space equipment rules. Artwork still uses the renderer's two facings.
export const RELOAD_STAGES=Object.freeze([
  {name:'lower',end:.10,label:'Lowering'},
  {name:'span',end:.65,label:'Spanning'},
  {name:'retrieve',end:.78,label:'Loading Bolt'},
  {name:'seat',end:.90,label:'Loading Bolt'},
  {name:'raise',end:1,label:'Raising'}
]);

export function reloadStage(reload){
  const p=(reload.progress||0)/reload.duration;
  const index=RELOAD_STAGES.findIndex(s=>p<s.end-1e-9);
  return index<0?RELOAD_STAGES.length-1:index;
}
export function checkpointReload(reload){
  // Only completed physical work survives an interruption. The incomplete pose
  // returns to its start, rather than discarding an already spanned string.
  const index=reloadStage(reload),start=index?RELOAD_STAGES[index-1].end:0;
  reload.progress=start*reload.duration;reload.completedStage=index-1;
  reload.stage=RELOAD_STAGES[index].name;
}
export function advanceReload(reload,dt){
  reload.progress=Math.min(reload.duration,(reload.progress||0)+dt);
  const index=reloadStage(reload);reload.completedStage=index-1;
  reload.stage=RELOAD_STAGES[index].name;
  return reload.progress>=reload.duration-1e-7;
}

// Earliest swept horse-circle contact with the actual forward weapon capsule.
// Unlike a distance aura this has finite reach, a narrow lane and a swept path.
export function sweptWeaponContact(start,end,defender,reach,radius){
  const fx=defender.facingX||0,fy=defender.facingY||0,length=Math.hypot(fx,fy);
  if(length<.5)return null;
  const nx=fx/length,ny=fy/length,dx=end.x-start.x,dy=end.y-start.y;
  const px=(start.x-defender.x)*nx+(start.y-defender.y)*ny;
  const py=-(start.x-defender.x)*ny+(start.y-defender.y)*nx;
  const vx=dx*nx+dy*ny,vy=-dx*ny+dy*nx,base=.12;
  const candidates=[];
  let lo=0,hi=1;
  for(const [p,v,min,max]of [[px,vx,base,reach],[py,vy,-radius,radius]]){
    if(Math.abs(v)<1e-9){if(p<min||p>max){lo=2;break;}}
    else{const a=(min-p)/v,b=(max-p)/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
  }
  if(lo<=hi&&lo<=1&&hi>=0)candidates.push(Math.max(0,lo));
  const a=vx*vx+vy*vy;
  for(const center of [base,reach]){
    const ox=px-center,c=ox*ox+py*py-radius*radius;
    if(c<=0)candidates.push(0);
    else if(a>1e-9){const b=2*(ox*vx+py*vy),disc=b*b-4*a*c;
      if(disc>=0){const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1)candidates.push(t);}}
  }
  if(!candidates.length)return null;
  const t=Math.min(...candidates),x=start.x+dx*t,y=start.y+dy*t;
  // A contact behind the hands never becomes a frontal interception.
  if((x-defender.x)*nx+(y-defender.y)*ny<base-radius)return null;
  return {t,x,y};
}

export function directionalShieldMultiplier(target,source,shieldType){
  if(!shieldType||!source||source.secondary||!['weapon','charge','bolt'].includes(source.impactKind)||source.projectileType==='rock')return 1;
  // Travel direction survives shooter movement and target displacement. Contact
  // origin is the fallback for melee strikes and older projectile records.
  const dx=Number.isFinite(source.travelX)?-source.travelX:source.originX-target.x;
  const dy=Number.isFinite(source.travelY)?-source.travelY:source.originY-target.y;
  const length=Math.hypot(dx,dy),fl=Math.hypot(target.facingX,target.facingY);
  if(!(length>.001&&fl>.5))return 1;
  const dot=(dx*target.facingX+dy*target.facingY)/(length*fl),heavy=shieldType==='heavy';
  if(dot<-.5)return heavy?1.5:1.25;
  if(dot<.5)return 1;
  if(target.shieldGuard!=='guard'||target.knockT>0||target.spearState==='disrupted')return 1;
  if(source.impactKind==='charge')return heavy?.45:.8;
  if(['arrow','bolt','axe','javelin'].includes(source.projectileType))return heavy?.25:.6;
  return heavy?.35:.75;
}
