// Formation geometry belongs to the simulation. Nothing here selects a new
// character-facing image; the renderer continues to use its existing two views.
import {trebuchetAnchored} from './regiments.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const FORMATION_PRESETS=Object.freeze({line:'Line',pike:'Pike Block',shield:'Shield Wall',wedge:'Wedge',loose:'Loose'});
const FORMATION_SPACING=Object.freeze({line:.56,pike:.52,shield:.48,wedge:.58,loose:.78});
export function marchSlot(index,count,columns,formation){
  const spacing=FORMATION_SPACING[formation==='spread'?'loose':formation]??FORMATION_SPACING.line,rank=Math.floor(index/columns),rows=Math.ceil(count/columns);
  if(formation==='wedge'&&count>1){
    const side=(index%columns-(columns-1)/2)*spacing;
    return {rank,side,back:Math.abs(side)*.7+rank*spacing-rows*spacing*.45};
  }
  const inRank=Math.min(columns,count-rank*columns);
  return {rank,side:(index%columns-(inRank-1)/2)*spacing,back:(rank-(rows-1)/2)*spacing};
}
export function formationSettings(count,options={}){
  const preset=FORMATION_PRESETS[options.preset]?options.preset:options.preset==='spread'?'loose':'line';
  const spacing=FORMATION_SPACING[preset],n=Math.max(1,count|0);
  const requestedRanks=clamp(Math.round(options.ranks||(preset==='pike'?4:preset==='shield'?2:2)),1,Math.min(4,n));
  // Width controls the column count, while the selected rank count bounds depth.
  const minColumns=Math.ceil(n/Math.min(4,n)),maxColumns=n;
  const columns=Number.isFinite(options.width)?clamp(Math.round(options.width/spacing)+1,minColumns,maxColumns):Math.ceil(n/requestedRanks);
  const ranks=Math.ceil(n/columns),width=(Math.min(n,columns)-1)*spacing;
  return {preset,spacing,columns,ranks,width,depth:(ranks-1)*spacing,lockFacing:options.lockFacing!==false};
}
export function formationRole(g,u,defs){
  const d=defs[u.type]||{},kind=g.unitClass(u);
  return kind==='siege'?5:kind==='archer'||d.crossbow||d.ranged?4:kind==='cavalry'?3:d.spearBrace||d.spearWeapon?0:d.shieldBearer||d.shieldType?1:2;
}
// Each slot keeps its assigned role. Find a nearby soldier of that role so a
// new order does not send the whole front through neighboring occupied files.
export function assignFormationSlots(g,troops,slots,center,angle,defs){
  const fx=Math.cos(angle),fy=Math.sin(angle),byRole=new Map(),roles=[];
  for(const u of troops){
    const role=formationRole(g,u,defs);
    if(!byRole.has(role))byRole.set(role,[]);
    byRole.get(role).push(u);roles.push(role);
  }
  return slots.map(({side,back},i)=>{
    const x=center.x-fy*side-fx*back,y=center.y+fx*side-fy*back;
    const candidates=byRole.get(roles[i]);
    let nearest=0,best=Infinity;
    for(let j=0;j<candidates.length;j++){
      const u=candidates[j],error=(u.x-x)**2+(u.y-y)**2;
      if(error<best||error===best&&u.id<candidates[nearest].id){nearest=j;best=error;}
    }
    const u=candidates[nearest];candidates[nearest]=candidates.at(-1);candidates.pop();
    return u;
  });
}
// Slot indices and roles belong to the original footprint. A casualty only
// frees that slot. A replacement order also releases the departing soldier.
export function releaseFormationSlots(g,c,living){
  if(living.length===c.members.length)return;
  const present=new Set(living.map(u=>u.id));
  c.members=[...present];
  c.gaps??=[];
  for(const slot of c.slots){
    if(slot.unitId!=null&&!present.has(slot.unitId)){
      slot.unitId=null;
      c.gaps.push({slot,after:g.time+.25});
    }
  }
}

// Examine at most two holes per pass. A donor's old slot becomes a later
// vacancy, so a single loss cannot make a whole file change goals at once.
export function fillFormationGaps(g,c,members,slotKey){
  if(!c.gaps?.length||g.time<(c.refillAt||0))return;
  c.refillAt=g.time+.25;
  const pending=c.gaps.splice(0,2);
  const promoted=new Set();
  for(const gap of pending){
    const slot=gap.slot;
    if(g.time<gap.after){c.gaps.push(gap);continue;}
    if(slot.blocked)continue;
    const fx=Math.cos(c.angle),fy=Math.sin(c.angle);
    const goal=slotKey==='advanceIndex'?{x:c.x-fy*slot.side-fx*slot.back,y:c.y+fx*slot.side-fy*slot.back}:slot;
    let next=null,best=Infinity,waiting=false;
    for(const u of members){
      const other=c.slots[u.order[slotKey]];
      if(other.role!==slot.role||other.rank<=slot.rank)continue;
      // A soldier out of position, fighting, or recovering from knockback
      // keeps following its own orders; it can be considered on a later pass.
      if(promoted.has(u.id)||distance(u,u.order)>.7||u.knockT>0||u.target&&distance(u,u.target)<=g.unitRange(u)+(u.target.radius||.2)){
        waiting=true;continue;
      }
      const cost=(u.x-goal.x)**2+(u.y-goal.y)**2;
      if(cost<best||cost===best&&u.id<next.id){
        if(g.navigation.clearSegment(u,goal,u.radius)){next=u;best=cost;}
        else waiting=true;
      }
    }
    if(!next){if(waiting)c.gaps.push(gap);continue;}
    promoted.add(next.id);
    const order=next.order,previous=c.slots[order[slotKey]];
    previous.unitId=null;slot.unitId=next.id;
    c.gaps.push({slot:previous,after:g.time+.25});
    order[slotKey]=slot.index;order.slotSide=slot.side;order.slotBack=slot.back;
    if(slotKey==='advanceIndex'){
      order.marchSide=slot.side;order.marchBack=slot.back;
    }else{
      Object.assign(order,{x:slot.x,y:slot.y,mode:'move',slotBlocked:slot.blocked});
    }
    next.braceTime=0;next.braceDir=null;
  }
}
export function formationPreview(g,troops,options={},defs={}){
  const settings=formationSettings(troops.length,options),angle=Number.isFinite(options.angle)?options.angle:0,fx=Math.cos(angle),fy=Math.sin(angle);
  const center={x:options.x??0,y:options.y??0},slots=[];
  const planningTeam=troops[0]?.team??g.playerTeam??0;
  // A footprint may avoid observed and remembered structures, but cannot use
  // a hidden enemy post as a placement oracle. Physical collision still uses
  // the complete authoritative building list when troops reach that ground.
  const buildings=(g.config?.fogOfWar&&g.knownBuildings?g.knownBuildings(planningTeam):g.buildings||[]).filter(b=>b.hp>0).map(b=>({x:b.x,y:b.y,radius:g.buildingRadius?.(b)??b.radius??.6}));
  for(let i=0;i<troops.length;i++){
    const rank=Math.floor(i/settings.columns),inRank=Math.min(settings.columns,troops.length-rank*settings.columns);
    let side=(i%settings.columns-(inRank-1)/2)*settings.spacing,back=(rank-(settings.ranks-1)/2)*settings.spacing;
    if(settings.preset==='wedge')back+=Math.abs(side)*.7;
    // A hero standard is an order anchor, never a front-rank soldier. Preserve
    // the chosen columns/ranks and open a real central lane around its pole.
    const anchor=options.standardAnchor;
    if(anchor&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.y)){
      const clearance=Math.max(.7,anchor.clearance||1)+(troops[i]?.radius||.2);
      if(Math.abs(back)<clearance){
        const gap=Math.sqrt(clearance*clearance-back*back),column=i%settings.columns,left=Math.floor(inRank/2);
        side=column<left?-(gap+(left-1-column)*settings.spacing):gap+(column-left)*settings.spacing;
      }
    }
    const x=center.x-fy*side-fx*back,y=center.y+fx*side-fy*back;
    const radius=troops[i]?.radius||.2,buildingBlocked=buildings.some(b=>{const dx=x-b.x,dy=y-b.y,r=b.radius+radius;return Math.abs(dx)<r&&Math.abs(dy)<r&&dx*dx+dy*dy<r*r;});
    const walkable=!buildingBlocked&&g.isWalkable(x,y)&&g.navigation.isClearPoint(x,y,radius);
    // A passable island across water is still unreachable from the soldier.
    const regions=g.navigation.regions,origin=g.navigation.index(troops[i]),destination=g.navigation.index({x,y});
    const reachable=walkable&&(!regions||origin>=0&&destination>=0&&regions[origin]===regions[destination]);
    slots.push({index:i,x,y,side,back,rank,blocked:!reachable});
  }
  return {...settings,...center,angle,faceX:fx,faceY:fy,standardAnchor:options.standardAnchor||null,slots,blocked:slots.filter(s=>s.blocked).length};
}
export function placeFormation(g,ids,options,defs){
  const troops=[...new Set(ids||[])].map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&defs[u.type]&&g.teams[u.team]?.alive&&!trebuchetAnchored(u));
  if(!troops.length)return {ok:false,message:'Select soldiers first.'};
  if(!Number.isFinite(options.x)||!Number.isFinite(options.y)||!g.isWalkable(options.x,options.y))return {ok:false,message:'Choose reachable ground for the formation center.'};
  // Keep a surviving soldier's lane when a group is rotated or repositioned.
  const same=troops.every(u=>u.order?.placementId===troops[0].order?.placementId&&Number.isFinite(u.order?.slotIndex));
  troops.sort((a,b)=>formationRole(g,a,defs)-formationRole(g,b,defs)||(same?a.order.slotIndex-b.order.slotIndex:a.id-b.id));
  const preview=formationPreview(g,troops,options,defs);
  if(preview.slots.every(s=>s.blocked))return {ok:false,message:'Forming: blocked or unreachable ground. Move or narrow the footprint.'};
  const id=g.nextPlacementId=(g.nextPlacementId||0)+1;
  g.placedFormations??=new Map();
  const formation=preview.preset==='loose'?'spread':preview.preset==='wedge'?'wedge':'line';
  g.command(troops.map(u=>u.id),preview.x,preview.y,'move',formation,{x:preview.faceX,y:preview.faceY});
  const cohort={...preview,id,members:troops.map(u=>u.id),slots:preview.slots.map(s=>({...s,unitId:troops[s.index].id,role:formationRole(g,troops[s.index],defs)})),checkAt:0,faceInPlace:!!options.faceInPlace};
  troops.forEach((u,i)=>{
    const s=cohort.slots[i],safe=s.blocked?g.navigation.nearestPassable(s)||u:s;
    Object.assign(u.order,{x:safe.x,y:safe.y,groupX:preview.x,groupY:preview.y,placementId:id,formationPreset:preview.preset,lockFacing:preview.lockFacing,slotIndex:i,slotSide:s.side,slotBack:s.back,slotBlocked:s.blocked});
    u.braceTime=0;u.braceDir=null;
  });
  g.placedFormations.set(id,cohort);
  return {ok:true,count:troops.length,formation:cohort,message:preview.blocked?'Forming: blocked ground; clear slots will form while others find a route.':options.faceInPlace?'Face in place. The line turns together.':'Form up. Each soldier will settle into position before defending.'};
}
export function updatePlacedFormations(g,dt,defs){
  if(!g.placedFormations?.size)return;
  for(const [id,c]of g.placedFormations){
    const living=c.members.map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&u.order?.placementId===id&&['move','hold','idle'].includes(u.order.mode));
    if(!living.length){g.placedFormations.delete(id);continue;}
    releaseFormationSlots(g,c,living);
    if(c.checkAt>g.time)continue;c.checkAt=g.time+.2;
    fillFormationGaps(g,c,living,'slotIndex');
    for(const u of living){
      const o=u.order;
      if(o.mode==='idle')o.mode='hold';
      if(o.mode==='hold'&&!c.lockFacing){delete o.facingX;delete o.facingY;}
      if(o.mode==='hold'&&!o.slotBlocked&&!(u.knockT>0)&&distance(u,o)>.25){o.mode='move';u.target=null;u.aggroAnchor=null;}
    }
  }
}
export function formationStatus(troops,defs){
  if(!troops.length)return '';
  const spears=troops.filter(u=>defs[u.type]?.spearBrace||defs[u.type]?.spearWeapon);
  const braced=spears.filter(u=>u.spearState?u.spearState==='braced':u.spearReadiness==='braced'||(u.braceTime||0)>=.5&&Math.hypot(u.vx||0,u.vy||0)<.18&&!(u.knockT>0)).length;
  let primary;
  const advancing=troops.find(u=>u.order?.mode==='advance'&&u.order.advanceStatus);
  if(advancing)primary=advancing.order.advanceStatus;
  else if(spears.length&&braced)primary=`Braced: ${braced}/${spears.length}`;
  else if(troops.some(u=>u.knockT>0||u.spearState==='disrupted'))primary='Disrupted';
  else if(troops.some(u=>Number.isFinite(u.order?.facingX)&&(u.facingX*u.order.facingX+u.facingY*u.order.facingY)<.985))primary='Turning';
  else if(troops.some(u=>u.order?.slotBlocked))primary='Forming: blocked ground';
  else if(troops.some(u=>u.order?.placementId&&distance(u,u.order)>.35))primary='Forming';
  else if(troops.some(u=>['move','advance','retreat'].includes(u.order?.mode)))primary='Marching';
  else primary=troops.some(u=>u.order?.mode==='hold')?'Holding':'Ready';
  const labels={loaded:'Loaded',aiming:'Aiming',fire:'Firing',lower:'Lowering',span:'Spanning',retrieve:'Loading Bolt',seat:'Loading Bolt',raise:'Ready',unloaded:'Unloaded'},counts=new Map();
  for(const u of troops){
    if(!defs[u.type]?.crossbow)continue;
    const state=u.crossbowAim?'aiming':u.reload?(u.reloading?u.reload.stage:'unloaded'):u.crossbowState||'loaded',label=labels[state]||'Loaded';
    counts.set(label,(counts.get(label)||0)+1);
  }
  if(!counts.size)return primary;
  const summary=[...new Set(Object.values(labels))].filter(label=>counts.has(label)).map(label=>`${label}: ${counts.get(label)}`).join(' · ');
  return primary==='Ready'?summary:`${primary} · ${summary}`;
}
// Only ground indicators are drawn here. All soldiers and equipment remain
// authored raster artwork handled by the existing troop renderer.
export function drawFormationGround(c,preview,project,{slots=true,handles=true}={}){
  if(!preview)return;
  const p=(side,back)=>project(preview.x-preview.faceY*side-preview.faceX*back,preview.y+preview.faceX*side-preview.faceY*back);
  c.save();c.strokeStyle='#f1d592';c.fillStyle='#f1d592';c.lineWidth=1.8;
  if(slots)for(const slot of preview.slots){const q=project(slot.x,slot.y);c.beginPath();c.ellipse(q.x,q.y,4,2.2,0,0,Math.PI*2);c.fillStyle=slot.blocked?'#ee8a79':'#b6ddc3';c.fill();if(slot.blocked){c.moveTo(q.x-4,q.y-4);c.lineTo(q.x+4,q.y+4);c.moveTo(q.x+4,q.y-4);c.lineTo(q.x-4,q.y+4);c.stroke();}}
  const front=-(preview.depth/2+.35),half=Math.max(.3,preview.width/2),a=p(-half,front),b=p(half,front),middle=p(0,front),arrow=p(0,front-1.1);
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.moveTo(middle.x,middle.y);c.lineTo(arrow.x,arrow.y);c.stroke();
  const angle=Math.atan2(arrow.y-middle.y,arrow.x-middle.x);c.beginPath();c.moveTo(arrow.x,arrow.y);c.lineTo(arrow.x-Math.cos(angle-.5)*10,arrow.y-Math.sin(angle-.5)*10);c.moveTo(arrow.x,arrow.y);c.lineTo(arrow.x-Math.cos(angle+.5)*10,arrow.y-Math.sin(angle+.5)*10);c.stroke();
  if(handles){for(const q of [p(-half,0),p(half,0)]){c.fillStyle='#12292b';c.fillRect(q.x-6,q.y-6,12,12);c.strokeRect(q.x-6,q.y-6,12,12);}c.beginPath();c.arc(arrow.x,arrow.y,8,0,Math.PI*2);c.stroke();}
  c.font='600 11px Segoe UI';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#10282d';c.fillStyle='#f7e4bc';const text=`${preview.ranks} rank${preview.ranks===1?'':'s'} · ${FORMATION_PRESETS[preview.preset]||'Formation'}${preview.blocked?' · blocked '+preview.blocked:''}`;c.strokeText(text,middle.x,middle.y-14);c.fillText(text,middle.x,middle.y-14);c.restore();
}
