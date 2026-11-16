// Cohorts share a destination, front and pace. Individual soldiers retain their
// slot and may strike nearby enemies, but never choose where the cohort turns.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export const FORMATION_PRESETS={line:{label:'Line',ranks:2},pike:{label:'Pike Block',ranks:4},shield:{label:'Shield Wall',ranks:2},wedge:{label:'Wedge',ranks:3},loose:{label:'Loose',ranks:2}};
export function formationLayout(count,options={}){
  count=Math.max(0,Math.floor(count));const preset=options.preset==='spread'?'loose':FORMATION_PRESETS[options.preset]?options.preset:'line';
  const spacing=preset==='loose'?.7:.43,requestedRanks=clamp(Math.round(options.ranks||FORMATION_PRESETS[preset].ranks),1,Math.min(4,count||1));
  const dimensionMode=options.dimensionMode==='ranks'?'ranks':Number.isFinite(options.width)||Number.isFinite(options.columns)?'width':'ranks';
  let columns=Math.max(1,Math.ceil(count/requestedRanks));
  if(dimensionMode==='width'&&Number.isFinite(options.width))columns=clamp(Math.round(options.width/spacing)+1,Math.max(1,Math.ceil(count/4)),Math.max(1,count));
  else if(dimensionMode==='width'&&Number.isFinite(options.columns))columns=clamp(Math.round(options.columns),Math.max(1,Math.ceil(count/4)),Math.max(1,count));
  const ranks=dimensionMode==='ranks'?requestedRanks:Math.max(1,Math.ceil(count/columns)),width=(columns-1)*spacing;
  let depth=(ranks-1)*spacing;
  const slots=[];
  for(let row=0;row<ranks;row++){
    const rowCount=dimensionMode==='ranks'?Math.floor(count/ranks)+(row<count%ranks?1:0):Math.min(columns,count-row*columns);
    for(let column=0;column<rowCount;column++){const side=(column-(rowCount-1)/2)*spacing;slots.push({index:slots.length,row,column,side,back:(row-(ranks-1)/2)*spacing+(preset==='wedge'?Math.abs(side)*.7:0)});}
  }
  if(preset==='wedge'&&slots.length){const min=Math.min(...slots.map(s=>s.back)),max=Math.max(...slots.map(s=>s.back));depth=max-min;for(const slot of slots)slot.back-=(min+max)/2;}
  return {preset,spacing,columns,ranks,width,depth,dimensionMode,slots};
}
const soldierRank=(g,u,defs)=>g.unitClass(u)==='siege'?4:g.unitClass(u)==='archer'?3:defs[u.type]?.spearBrace||defs[u.type]?.spearWeapon?0:defs[u.type]?.shieldBearer?.5:1;
export function projectedFormation(g,troops,x,y,options={},defs={}){
  const layout=formationLayout(troops.length,options),length=Math.hypot(options.facing?.x||0,options.facing?.y||0),faceX=length>.001?options.facing.x/length:1,faceY=length>.001?options.facing.y/length:0;
  const members=[...troops].sort((a,b)=>options.relativeSlots?(a.order?.slotIndex??a.id)-(b.order?.slotIndex??b.id):soldierRank(g,a,defs)-soldierRank(g,b,defs)||a.id-b.id);
  const relative=new Map((options.relativeSlots||[]).map(s=>[s.id,s]));
  const slots=layout.slots.map((s,i)=>{const u=members[i],assigned=relative.get(u.id)||s,point={x:x-faceY*assigned.side-faceX*assigned.back,y:y+faceX*assigned.side-faceY*assigned.back},origin=g.navigation.index(u),target=g.navigation.index(point);return {...s,side:assigned.side,back:assigned.back,...point,id:u.id,blocked:!g.navigation.isClearPoint(point.x,point.y,u.radius||.15)||origin<0||target<0||g.navigation.regions[origin]!==g.navigation.regions[target]};});
  const side=Math.max(.3,layout.width/2+.25),front=layout.depth/2+.9;
  return {...layout,count:troops.length,x,y,faceX,faceY,lockFacing:options.lockFacing!==false,slots,handles:{center:{x,y},left:{x:x+faceY*side,y:y-faceX*side},right:{x:x-faceY*side,y:y+faceX*side},facing:{x:x+faceX*front,y:y+faceY*front}}};
}
export function placeFormation(g,ids,x,y,options={},defs){
  const troops=[...new Set(ids||[])].map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&defs[u.type]);
  if(!troops.length)return {ok:false,message:'Select soldiers first.',count:0};
  const p=projectedFormation(g,troops,x,y,options,defs),blocked=p.slots.filter(s=>s.blocked).length;
  if(blocked&&!options.allowBlocked)return {ok:false,message:`Forming: blocked ground (${blocked} slots). Adjust the footprint.`,count:0};
  const facing={x:p.faceX,y:p.faceY},formation=p.preset==='loose'?'spread':p.preset==='wedge'?'wedge':'line';
  g.command(troops.map(u=>u.id),x,y,'move',formation,facing);
  g.formationPlacements??=new Map();const id=g.nextFormationPlacementId=(g.nextFormationPlacementId||0)+1;
  const cohort={...p,id,members:troops.map(u=>u.id),assignments:new Map(p.slots.map(s=>[s.index,s.id]))};
  g.formationPlacements.set(id,cohort);
  for(const s of p.slots){const u=g.byId.get(s.id);Object.assign(u.order,{x:s.x,y:s.y,groupX:x,groupY:y,formationId:id,slotIndex:s.index,slotSide:s.side,slotBack:s.back,preset:p.preset,ranks:p.ranks,columns:p.columns,dimensionMode:p.dimensionMode,lockFacing:p.lockFacing,holdAfterArrival:true});u.formationPreferences={preset:p.preset,ranks:p.ranks,columns:p.columns,width:p.width,dimensionMode:p.dimensionMode,lockFacing:p.lockFacing};}
  return {ok:true,message:`${FORMATION_PRESETS[p.preset].label}: ${p.columns} wide, ${p.ranks} ranks.`,count:troops.length};
}
export function faceFormationInPlace(g,ids,facing,options={},defs){
  const troops=[...ids].map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&defs[u.type]);if(!troops.length)return {ok:false,message:'Select soldiers first.',count:0};
  const center=troops.reduce((p,u)=>({x:p.x+u.x/troops.length,y:p.y+u.y/troops.length}),{x:0,y:0}),preferences=troops[0].formationPreferences||{};
  const shared=troops.every(u=>u.order?.formationId&&u.order.formationId===troops[0].order.formationId),relativeSlots=shared?troops.map(u=>({id:u.id,side:u.order.slotSide,back:u.order.slotBack})):undefined;
  return placeFormation(g,ids,center.x,center.y,{...preferences,...options,relativeSlots,facing,lockFacing:true},defs);
}
export function updateFormationPlacements(g,dt,defs){
  if(!g.formationPlacements?.size)return;
  for(const [id,c]of g.formationPlacements){
    const members=c.members.map(memberId=>g.byId.get(memberId)).filter(u=>u?.hp>0&&u.order?.formationId===id);
    if(!members.length){g.formationPlacements.delete(id);continue;}
    for(const u of members)if(u.order.mode==='hold'){const slot=c.slots[u.order.slotIndex];if(slot){slot.x=u.order.x;slot.y=u.order.y;}}
    // Only a replacement soldier moves after a casualty; planted neighbors retain readiness.
    for(const [slotIndex,memberId]of [...c.assignments]){
      const old=g.byId.get(memberId);if(old?.hp>0&&old.order?.formationId===id&&old.order.slotIndex===slotIndex)continue;
      c.assignments.delete(slotIndex);const slot=c.slots[slotIndex];
      const candidates=members.filter(u=>u.order.slotIndex>slotIndex&&soldierRank(g,u,defs)<=soldierRank(g,old||{type:'infantry'},defs)&&u.order.slotBack>slot.back+.05).sort((a,b)=>distance(a,slot)-distance(b,slot));
      const replacement=candidates[0];if(!replacement)continue;
      c.assignments.delete(replacement.order.slotIndex);c.assignments.set(slotIndex,replacement.id);Object.assign(replacement.order,{x:slot.x,y:slot.y,slotIndex,slotSide:slot.side,slotBack:slot.back,mode:'move',holdAfterArrival:true});replacement.braceTime=0;
    }
  }
}

function enemyForces(g,team){
  const buckets=new Map();
  for(const u of g.knownUnits(team)){
    if(u.hp<=0||!g.hostile(team,u.team)||!g.teams[u.team]?.alive)continue;
    const x=Math.floor(u.x/4),y=Math.floor(u.y/4),key=`${u.team}:${x}:${y}`;
    if(!buckets.has(key))buckets.set(key,{team:u.team,x,y,units:[]});
    buckets.get(key).units.push(u);
  }
  const forces=[],seen=new Set();
  for(const [key,bucket]of buckets){
    if(seen.has(key))continue;
    const queue=[bucket],units=[];seen.add(key);
    for(let i=0;i<queue.length;i++){
      const cell=queue[i];units.push(...cell.units);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const nextKey=`${cell.team}:${cell.x+dx}:${cell.y+dy}`,next=buckets.get(nextKey);
        if(next&&!seen.has(nextKey)){seen.add(nextKey);queue.push(next);}
      }
    }
    const center=units.reduce((p,u)=>({x:p.x+u.x/units.length,y:p.y+u.y/units.length}),{x:0,y:0});
    forces.push({...center,units,count:units.length,key:Math.min(...units.map(u=>u.id))});
  }
  // Structures become the objective once no visible enemy troops remain.
  if(!forces.length)for(const b of g.knownBuildings(team))if(b.hp>0&&g.hostile(team,b.team))forces.push({...b,units:[b],count:1,key:b.id});
  return forces;
}

function chooseForce(cohort,forces){
  if(!forces.length)return null;
  const largest=Math.max(...forces.map(f=>f.count)),minimum=Math.min(3,largest);
  const eligible=forces.filter(f=>f.count>=minimum).sort((a,b)=>distance(cohort,a)-distance(cohort,b)||a.key-b.key);
  const previous=eligible.find(f=>f.units.some(u=>u.id===cohort.enemyId));
  return previous&&distance(cohort,previous)<=distance(cohort,eligible[0])*1.2+1?previous:eligible[0];
}

function fitPassage(g,c,members){
  if((c.passageAt||0)>g.time)return;
  c.passageAt=g.time+.3;
  const fx=Math.cos(c.angle),fy=Math.sin(c.angle),half=Math.max(.215,...members.map(u=>Math.abs(u.order.slotSide)));
  const depth=Math.max(.215,...members.map(u=>Math.abs(u.order.marchBack??u.order.slotBack)));
  let columns=c.columns;
  // Look ahead before the first rank reaches a choke, and retain the narrow
  // column until the rear clears it. Soldiers then regain their original slots.
  for(let along=-depth-2;along<=depth+4;along+=.75){
    const point={x:c.x+fx*along,y:c.y+fy*along};
    if(!g.isWalkable(point.x,point.y))continue;
    let left=0,right=0;
    for(let side=.215;side<=half+.22;side+=.215){if(!g.navigation.isClearPoint(point.x-fy*side,point.y+fx*side,.19))break;left=side;}
    for(let side=.215;side<=half+.22;side+=.215){if(!g.navigation.isClearPoint(point.x+fy*side,point.y-fx*side,.19))break;right=side;}
    columns=Math.min(columns,Math.max(1,Math.floor((left+right)/.43)+1));
  }
  const rows=Math.ceil(c.count/columns);c.compressed=columns<c.columns;
  for(const u of members){const o=u.order,i=o.advanceIndex;o.compressed=c.compressed;
    o.marchSide=columns===c.columns?o.slotSide:(i%columns-(Math.min(columns,c.count)-1)/2)*.43;
    o.marchBack=columns===c.columns?o.slotBack:(Math.floor(i/columns)-(rows-1)/2)*.43;
  }
}

export function startFormationAdvance(g,ids,formation,defs){
  const troops=[...new Set(ids||[])].map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&defs[u.type]&&g.teams[u.team]?.alive);
  if(!troops.length)return {ok:false,message:'Select soldiers first.',count:0};
  g.formationAdvances??=new Map();
  const teams=new Map();for(const u of troops){if(!teams.has(u.team))teams.set(u.team,[]);teams.get(u.team).push(u);}
  for(const [team,members]of teams){
    const average=members.reduce((p,u)=>({x:p.x+u.x/members.length,y:p.y+u.y/members.length}),{x:0,y:0}),center=g.navigation.nearestPassable(average)||average;
    const id=g.nextFormationAdvanceId=(g.nextFormationAdvanceId||0)+1;
    // Preserve an existing ordered front; regrouping must not snap every soldier
    // through a new heading merely because W was pressed.
    const fx=members.reduce((n,u)=>n+(u.order?.facingX??u.facingX??1),0),fy=members.reduce((n,u)=>n+(u.order?.facingY??u.facingY??0),0);
    const angle=Math.hypot(fx,fy)>.01?Math.atan2(fy,fx):0;
    const preferences=members.find(u=>u.formationPreferences)?.formationPreferences;
    const cohort={...center,id,team,angle,lockFacing:preferences?.lockFacing===true,radius:.2,members:members.map(u=>u.id),seekAt:0,target:null,count:members.length,columns:Math.max(3,Math.ceil(Math.sqrt(members.length)*1.45))};
    g.command(cohort.members,center.x,center.y,'advance',formation,{x:Math.cos(angle),y:Math.sin(angle)});
    for(const u of members){const o=u.order,dx=o.x-center.x,dy=o.y-center.y;o.advanceId=id;o.slotSide=-Math.sin(angle)*dx+Math.cos(angle)*dy;o.slotBack=-Math.cos(angle)*dx-Math.sin(angle)*dy;}
    if(preferences){const p=projectedFormation(g,members,center.x,center.y,{...preferences,facing:{x:Math.cos(angle),y:Math.sin(angle)}},defs);cohort.columns=p.columns;for(const s of p.slots){const o=g.byId.get(s.id).order;Object.assign(o,{x:s.x,y:s.y,slotSide:s.side,slotBack:s.back,preset:p.preset,ranks:p.ranks,columns:p.columns,lockFacing:cohort.lockFacing});}}
    [...members].sort((a,b)=>a.order.slotBack-b.order.slotBack||a.order.slotSide-b.order.slotSide).forEach((u,i)=>{u.order.advanceIndex=i;});
    cohort.slots=members.map(u=>({index:u.order.advanceIndex,side:u.order.slotSide,back:u.order.slotBack,id:u.id,rank:soldierRank(g,u,defs)}));
    g.formationAdvances.set(id,cohort);
  }
  updateFormationAdvances(g,0,defs);
  return {ok:true,message:'Advance together, keep formation and engage the nearest enemy force.',count:troops.length};
}

export function updateFormationAdvances(g,dt,defs){
  updateFormationPlacements(g,dt,defs);
  if(!g.formationAdvances?.size)return;
  const forcesByTeam=new Map();
  for(const [id,c]of g.formationAdvances){
    const members=c.members.map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&u.order?.advanceId===c.id&&u.order.mode==='advance');
    if(!members.length){g.formationAdvances.delete(id);continue;}
    for(const slot of c.slots||[]){
      const old=g.byId.get(slot.id);if(old?.hp>0&&old.order?.advanceId===c.id&&old.order.advanceIndex===slot.index)continue;
      const replacement=members.filter(u=>u.order.slotBack>slot.back+.05&&soldierRank(g,u,defs)<=slot.rank).sort((a,b)=>Math.abs(a.order.slotSide-slot.side)-Math.abs(b.order.slotSide-slot.side)||a.order.slotBack-b.order.slotBack)[0];
      if(replacement){const vacated=c.slots.find(s=>s.id===replacement.id);if(vacated)vacated.id=null;slot.id=replacement.id;Object.assign(replacement.order,{slotSide:slot.side,slotBack:slot.back,advanceIndex:slot.index});replacement.braceTime=0;}
    }
    c.members=members.map(u=>u.id);
    fitPassage(g,c,members);
    if(c.seekAt<=g.time){
      if(!forcesByTeam.has(c.team))forcesByTeam.set(c.team,enemyForces(g,c.team));
      c.target=chooseForce(c,forcesByTeam.get(c.team));c.enemyId=c.target?.key;c.seekAt=g.time+.45;
    }
    const target=c.target;
    const live=target?.units.filter(u=>u.hp>0&&(u.remembered||g.isVisibleTo(c.team,u)))||[];
    if(target&&!live.length){c.target=null;c.seekAt=0;}
    let speed=0;
    if(live.length){
      const center=live.reduce((p,u)=>({x:p.x+u.x/live.length,y:p.y+u.y/live.length}),{x:0,y:0});
      const desired=Math.atan2(center.y-c.y,center.x-c.x),delta=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));
      // A broad formation wheels more slowly so its outer ranks can keep up.
      const radius=Math.max(.6,...members.map(u=>Math.hypot(u.order.marchSide,u.order.marchBack)));
      const pace=Math.min(...members.map(u=>defs[u.type].speed*g.movementMultiplier(u)*g.specialistSpeed(u)))*.7;
      if(!c.lockFacing)c.angle+=clamp(delta,-Math.min(.65,pace/radius)*dt,Math.min(.65,pace/radius)*dt);
      const fx=Math.cos(c.angle),fy=Math.sin(c.angle),front=Math.max(...members.map(u=>-u.order.marchBack));
      const range=Math.min(...members.filter(u=>-u.order.marchBack>front-.3).map(u=>g.unitRange(u)));
      const edge=Math.min(...live.map(u=>(u.x-c.x)*fx+(u.y-c.y)*fy-(u.radius||.2)));
      const errors=members.map(u=>distance(u,u.order)).sort((a,b)=>a-b),cohesive=errors[Math.floor((errors.length-1)*.65)]<.65;
      if(cohesive&&(c.lockFacing||Math.abs(delta)<.45)&&edge>front+range*.85){
        const waypoint=g.navigation.steer(c,center,'infantry'),dx=waypoint.x-c.x,dy=waypoint.y-c.y,len=Math.hypot(dx,dy);
        if(!waypoint.blocked&&len>.01){
          const tile=g.tileAt(c.x,c.y),step=Math.min(len,pace*dt/(tile?.terrain==='forest'?1.4:tile?.terrain==='hill'?1.2:1));
          c.x+=dx/len*step;c.y+=dy/len*step;speed=dt?step/dt:0;
        }
      }
    }
    const fx=Math.cos(c.angle),fy=Math.sin(c.angle),marchPace=Math.min(...members.map(v=>defs[v.type].speed))*.9;
    for(const u of members){
      const o=u.order,goal=g.bound({x:c.x-fy*o.marchSide-fx*o.marchBack,y:c.y+fx*o.marchSide-fy*o.marchBack});
      const safe=g.isWalkable(goal.x,goal.y)?goal:g.navigation.nearestPassable(goal)||u;
      o.x=safe.x;o.y=safe.y;o.groupX=c.x;o.groupY=c.y;o.facingX=fx;o.facingY=fy;o.advanceSpeed=speed;o.advancePace=marchPace;
    }
  }
}
