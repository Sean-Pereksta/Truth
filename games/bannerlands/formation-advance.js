// Cohorts share a destination, front and pace. Individual soldiers retain their
// slot and may strike nearby enemies, but never choose where the cohort turns.
import {assignFormationSlots,formationPreview,formationRole,marchSlot,releaseFormationSlots,fillFormationGaps,updatePlacedFormations} from './formation-placement.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

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

function approachPoint(c,members,live,center){
  if(members.length===c.count)return center;
  let left=Infinity,right=-Infinity,front=Infinity,rear=-Infinity,nearestSlot=null,nearestSlotSquared=Infinity;
  for(const {order} of members){
    left=Math.min(left,order.marchSide);right=Math.max(right,order.marchSide);
    front=Math.min(front,order.marchBack);rear=Math.max(rear,order.marchBack);
    const squared=order.marchSide**2+order.marchBack**2;
    if(squared<nearestSlotSquared){nearestSlot=order;nearestSlotSquared=squared;}
  }
  // Aim the surviving wing rather than its empty center at an enemy. The
  // logical anchor and all slot offsets remain continuous during the approach.
  let side=clamp(0,left,right),back=clamp(0,front,rear);
  // If both outside files survive, their bounds can still enclose a large
  // empty center. Follow the nearest occupied file across that gap.
  if(!side&&!back&&nearestSlotSquared>.8**2){side=nearestSlot.marchSide;back=nearestSlot.marchBack;}
  if(!side&&!back)return center;
  const fx=Math.cos(c.angle),fy=Math.sin(c.angle);
  const offsetX=-fy*side-fx*back,offsetY=fx*side-fy*back;
  const occupied={x:c.x+offsetX,y:c.y+offsetY};
  let enemy=null,nearest=Infinity;
  for(const u of live){
    const d=distance(occupied,u);
    if(d<nearest){nearest=d;enemy=u;}
  }
  return {x:enemy.x-offsetX,y:enemy.y-offsetY,enemy};
}

function fitPassage(g,c,members){
  if((c.passageAt||0)>g.time)return;
  c.passageAt=g.time+.3;
  const fx=Math.cos(c.angle),fy=Math.sin(c.angle),half=c.halfWidth;
  const depth=Math.max(c.halfDepth,(Math.ceil(c.count/(c.passageColumns||c.columns))-1)*.215);
  const normalColumns=Math.min(c.columns,c.count);
  let columns=normalColumns;
  // Look ahead before the first rank reaches a choke, and retain the narrow
  // column until the rear clears it. Soldiers then regain their original slots.
  for(let along=-depth-.4;along<=depth+4;along+=.75){
    const point={x:c.x+fx*along,y:c.y+fy*along};
    if(!g.isWalkable(point.x,point.y))continue;
    let left=0,right=0;
    for(let side=.215;side<=half+.22;side+=.215){if(!g.navigation.isClearPoint(point.x-fy*side,point.y+fx*side,.19))break;left=side;}
    for(let side=.215;side<=half+.22;side+=.215){if(!g.navigation.isClearPoint(point.x+fy*side,point.y-fx*side,.19))break;right=side;}
    columns=Math.min(columns,Math.max(1,Math.floor((left+right)/.43)+1));
  }
  const rows=Math.ceil(c.count/columns);
  c.passageColumns=columns;
  c.crossing=columns<normalColumns;
  for(const u of members){const o=u.order,i=o.advanceIndex;
    o.marchSide=c.crossing?(i%columns-(columns-1)/2)*.43:o.slotSide;
    o.marchBack=c.crossing?(Math.floor(i/columns)-(rows-1)/2)*.43:o.slotBack;
  }
}

function advancePace(g,members,defs){
  return Math.min(...members.map(u=>defs[u.type].speed*g.movementMultiplier(u)*g.specialistSpeed(u)))*.7;
}

function waitForRanks(g,c,members){
  if(!c.formingUntil)return false;
  let nearby=0,furthest=0;
  for(const u of members){const error=distance(u,u.order);if(error<.5)nearby++;furthest=Math.max(furthest,error);}
  if(g.time>=c.formingUntil||nearby>=Math.ceil(members.length*.8)&&furthest<1)c.formingUntil=0;
  return !!c.formingUntil;
}

function marchToward(g,c,aim,pace,dt){
  const clear=c.destination&&g.navigation.openRectangle(Math.min(c.x,aim.x)-c.radius,Math.min(c.y,aim.y)-c.radius,Math.max(c.x,aim.x)+c.radius,Math.max(c.y,aim.y)+c.radius);
  const waypoint=clear?aim:g.navigation.steer(c,aim,'infantry'),dx=waypoint.x-c.x,dy=waypoint.y-c.y,len=Math.hypot(dx,dy);
  if(waypoint.blocked||len<=.01)return {speed:0,status:'Blocked'};
  const tile=g.tileAt(c.x,c.y),step=Math.min(len,pace*dt/(tile?.terrain==='forest'?1.4:tile?.terrain==='hill'?1.2:1));
  c.x+=dx/len*step;c.y+=dy/len*step;
  return {speed:dt?step/dt:0,status:c.crossing||['bridge','ford','pass'].includes(tile?.feature)?'Crossing':'Advancing'};
}

function frontMeleeContact(g,c,members,defs){
  // Only melee troops in the first occupied melee rank can stop the march.
  // Crossing columns have their own temporary ranks until the rear clears.
  const melee=members.filter(u=>!g.isRanged(u)&&g.unitClass(u)!=='siege');
  const rank=u=>c.crossing?Math.floor(u.order.advanceIndex/c.passageColumns):c.slots[u.order.advanceIndex].rank;
  const front=Math.min(...melee.map(rank)),fx=Math.cos(c.angle),fy=Math.sin(c.angle);
  for(const u of melee){
    if(rank(u)!==front||distance(u,u.order)>.6)continue;
    const range=g.unitRange(u)+.07;
    let contact=false;
    g.hash.visit(u.x,u.y,range,enemy=>{
      if(contact||enemy.hp<=0||!g.hostile(c.team,enemy.team)||!g.teams[enemy.team]?.alive)return;
      const dx=enemy.x-u.x,dy=enemy.y-u.y,along=dx*fx+dy*fy,lateral=-dx*fy+dy*fx;
      if(along<=Math.abs(lateral)*.4||dx*dx+dy*dy>range*range||!g.isVisibleTo(c.team,enemy))return;
      if((defs[u.type].lanceChampion||u.type==='beacon_engineer')&&!g.combatTerrain.canShoot(u,enemy))return;
      contact=g.navigation.clearSegment(u,enemy,.05);
    },c.team);
    if(contact)return true;
  }
  return false;
}

function updateDirectedAdvance(g,c,members,defs,dt){
  if(c.stopped)return {speed:0,status:c.stopped};
  const pace=advancePace(g,members,defs),radius=Math.max(.6,c.halfWidth,c.halfDepth);
  const delta=Math.atan2(Math.sin(c.marchAngle-c.angle),Math.cos(c.marchAngle-c.angle));
  const turn=clamp(pace/radius,.4,.65)*dt;
  if(Math.abs(delta)>.002){
    c.angle+=clamp(delta,-turn,turn);
    c.formingUntil=g.time+1.2;
    return {speed:0,status:'Turning'};
  }
  c.angle=c.marchAngle;
  if(dt&&frontMeleeContact(g,c,members,defs))c.stopped='Engaged';
  else if(distance(c,c.destination)<=.01)c.stopped='Holding';
  if(c.stopped)return {speed:0,status:c.stopped};
  if(waitForRanks(g,c,members))return {speed:0,status:'Forming'};
  return marchToward(g,c,c.destination,pace,dt);
}

export function startFormationAdvance(g,ids,formation,defs,options={},point){
  const troops=[...new Set(ids||[])].map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&defs[u.type]&&g.teams[u.team]?.alive);
  if(!troops.length)return {ok:false,message:'Select soldiers first.',count:0};
  const unreachable={ok:false,message:'Choose reachable ground for the advance.',count:0};
  let destination;
  if(point!==undefined){
    if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||point.x<0||point.y<0||point.x>=g.W||point.y>=g.H)return unreachable;
    destination=g.navigation.nearestPassable(g.bound({...point}));
    if(!destination)return unreachable;
    if(!g.navigation.isClearPoint(destination.x,destination.y,.2))destination=g.navigation.point(g.navigation.index(destination));
  }
  const teams=new Map();for(const u of troops){if(!teams.has(u.team))teams.set(u.team,[]);teams.get(u.team).push(u);}
  const groups=[...teams].map(([team,members])=>{
    const average=members.reduce((p,u)=>({x:p.x+u.x/members.length,y:p.y+u.y/members.length}),{x:0,y:0}),center=g.navigation.nearestPassable(average)||average;
    return {team,members,average,center};
  });
  const regions=g.navigation.regions;
  if(destination&&groups.some(({center})=>regions[g.navigation.index(center)]!==regions[g.navigation.index(destination)]))return unreachable;
  g.formationAdvances??=new Map();
  for(const {team,members,average,center} of groups){
    const id=g.nextFormationAdvanceId=(g.nextFormationAdvanceId||0)+1;
    // Preserve an existing ordered front; regrouping must not snap every soldier
    // through a new heading merely because W was pressed.
    const fx=members.reduce((n,u)=>n+(u.order?.facingX??u.facingX??1),0),fy=members.reduce((n,u)=>n+(u.order?.facingY??u.facingY??0),0);
    const angle=Math.hypot(fx,fy)>.01?Math.atan2(fy,fx):0;
    const useSettings=Object.keys(options).length>0,previous=members.every(u=>u.order?.placementId===members[0].order?.placementId&&Number.isFinite(u.order?.slotIndex));
    const cohort={...center,id,team,angle,radius:.2,members:members.map(u=>u.id),seekAt:0,target:null,count:members.length,columns:Math.max(3,Math.ceil(Math.sqrt(members.length)*1.45)),lockFacing:options.lockFacing===true};
    if(destination){
      cohort.destination=destination;
      cohort.marchAngle=distance(average,point)>.01?Math.atan2(point.y-average.y,point.x-average.x):angle;
    }
    members.sort((a,b)=>formationRole(g,a,defs)-formationRole(g,b,defs)||(previous?a.order.slotIndex-b.order.slotIndex:a.id-b.id));
    const placed=previous?g.placedFormations?.get(members[0].order.placementId):null;
    const assigned=useSettings&&!placed?formationPreview(g,members,{...options,...center,angle,preset:formation},defs):null;
    const layout=placed||assigned;
    if(layout){cohort.columns=layout.columns;cohort.ranks=layout.ranks;cohort.width=layout.width;cohort.preset=layout.preset;}
    const slots=placed?members.map(u=>placed.slots[u.order.slotIndex]):assigned?.slots||members.map((_,i)=>marchSlot(i,cohort.count,cohort.columns,formation));
    const ordered=!placed&&(destination||!useSettings)?assignFormationSlots(g,members,slots,center,angle,defs):members;
    g.command(cohort.members,center.x,center.y,'advance',formation,{x:Math.cos(angle),y:Math.sin(angle)});
    cohort.slots=ordered.map((u,i)=>{
      const {side,back,rank}=slots[i],order=u.order;
      Object.assign(order,{advanceId:id,advanceIndex:i,lockFacing:cohort.lockFacing,slotSide:side,slotBack:back,formationPreset:layout?.preset||formation});
      return {index:i,side,back,rank,unitId:u.id,role:formationRole(g,u,defs)};
    });
    // Passage width belongs to the commanded footprint. Losing its outside
    // files must never make open ground look like a choke to the survivors.
    cohort.halfWidth=Math.max(.215,(Math.min(cohort.count,cohort.columns)-1)*.215,...cohort.slots.map(s=>Math.abs(s.side)));
    cohort.halfDepth=Math.max(.215,...cohort.slots.map(s=>Math.abs(s.back)));
    // On the initial order only, give soldiers crossing over into their new
    // files a short head start. Later losses never restart this interval.
    cohort.formingUntil=g.time+1.2;
    g.formationAdvances.set(id,cohort);
  }
  updateFormationAdvances(g,0,defs);
  return {ok:true,message:destination?'Advance toward the chosen point.':'Advance together, keep formation and engage the nearest enemy force.',count:troops.length};
}

function updateSeekingAdvance(g,c,members,defs,dt,forcesByTeam){
  if(c.seekAt<=g.time){
    if(!forcesByTeam.has(c.team))forcesByTeam.set(c.team,enemyForces(g,c.team));
    c.target=chooseForce(c,forcesByTeam.get(c.team));c.enemyId=c.target?.key;c.seekAt=g.time+.45;
  }
  const live=c.target?.units.filter(u=>u.hp>0&&(u.remembered||g.isVisibleTo(c.team,u)))||[];
  if(!live.length){
    if(c.target){c.target=null;c.seekAt=0;}
    return {speed:0,status:'Seeking'};
  }
  const center=live.reduce((p,u)=>({x:p.x+u.x/live.length,y:p.y+u.y/live.length}),{x:0,y:0});
  const aim=approachPoint(c,members,live,center);
  const desired=Math.atan2(aim.y-c.y,aim.x-c.x),delta=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));
  // A broad formation wheels more slowly so its outer ranks can keep up.
  const radius=Math.max(.6,...members.map(u=>Math.hypot(u.order.marchSide,u.order.marchBack)));
  const pace=advancePace(g,members,defs);
  if(!c.lockFacing)c.angle+=clamp(delta,-Math.min(.65,pace/radius)*dt,Math.min(.65,pace/radius)*dt);
  // Contact is judged along the approach. A locked front can travel sideways
  // or backwards; a distant enemy behind it is not already in weapon range.
  const dx=Math.cos(desired),dy=Math.sin(desired),sideProjection=Math.sin(desired-c.angle),backProjection=-Math.cos(desired-c.angle);
  const along=u=>u.order.marchSide*sideProjection+u.order.marchBack*backProjection;
  const front=Math.max(...members.map(along)),range=Math.min(...members.filter(u=>along(u)>front-.3).map(u=>g.unitRange(u)));
  const edge=Math.min(...live.map(u=>(u.x-c.x)*dx+(u.y-c.y)*dy-(u.radius||.2)));
  const forming=waitForRanks(g,c,members);
  // A casualty may move the approach to an outside file. Continue its
  // existing march through this corrective wheel. Fresh turns still form.
  const wingTurn=aim.enemy&&c.wingTurnTarget===c.enemyId&&Math.abs(delta)>=.45;
  if(!wingTurn)c.wingTurnTarget=null;
  if(!c.lockFacing&&!wingTurn&&Math.abs(delta)>=.45)return {speed:0,status:'Turning'};
  if(edge<=front+range*.85&&(!aim.enemy||members.some(u=>distance(u,aim.enemy)<=g.unitRange(u)+(defs[aim.enemy.type] ? .07 : g.buildingRadius(aim.enemy)))))return {speed:0,status:'Engaged'};
  if(forming)return {speed:0,status:'Forming'};
  // On a corrective wheel, the outside file needs speed for both rotating
  // around the anchor and following it. Leave it room to keep up.
  return marchToward(g,c,aim,aim.enemy&&!c.lockFacing&&Math.abs(delta)>.05?pace*.5:pace,dt);
}

export function updateFormationAdvances(g,dt,defs){
  updatePlacedFormations(g,dt,defs);
  if(!g.formationAdvances?.size)return;
  const forcesByTeam=new Map();
  for(const [id,c]of g.formationAdvances){
    const members=c.members.map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&u.order?.advanceId===c.id&&u.order.mode==='advance');
    if(!members.length){g.formationAdvances.delete(id);continue;}
    if(!c.destination&&members.length<c.members.length&&(c.status==='Advancing'||c.status==='Crossing'))c.wingTurnTarget=c.enemyId;
    releaseFormationSlots(g,c,members);
    fitPassage(g,c,members);
    const {speed,status}=c.destination?updateDirectedAdvance(g,c,members,defs,dt):updateSeekingAdvance(g,c,members,defs,dt,forcesByTeam);
    if(status==='Advancing')fillFormationGaps(g,c,members,'advanceIndex');
    c.status=status;
    const fx=Math.cos(c.angle),fy=Math.sin(c.angle),marchPace=Math.min(...members.map(v=>defs[v.type].speed))*.9;
    for(const u of members){
      const o=u.order,goal=g.bound({x:c.x-fy*o.marchSide-fx*o.marchBack,y:c.y+fx*o.marchSide-fy*o.marchBack});
      const safe=g.isWalkable(goal.x,goal.y)?goal:g.navigation.nearestPassable(goal)||u;
      o.x=safe.x;o.y=safe.y;o.groupX=c.x;o.groupY=c.y;o.facingX=fx;o.facingY=fy;o.advanceSpeed=speed;o.advancePace=marchPace;o.advanceStatus=status;
    }
  }
}
