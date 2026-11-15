// Cohorts share a destination, front and pace. Individual soldiers retain their
// slot and may strike nearby enemies, but never choose where the cohort turns.
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
  const rows=Math.ceil(c.count/columns);
  for(const u of members){const o=u.order,i=o.advanceIndex;
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
    const cohort={...center,id,team,angle,radius:.2,members:members.map(u=>u.id),seekAt:0,target:null,count:members.length,columns:Math.max(3,Math.ceil(Math.sqrt(members.length)*1.45))};
    g.command(cohort.members,center.x,center.y,'advance',formation,{x:Math.cos(angle),y:Math.sin(angle)});
    for(const u of members){const o=u.order,dx=o.x-center.x,dy=o.y-center.y;o.advanceId=id;o.slotSide=-Math.sin(angle)*dx+Math.cos(angle)*dy;o.slotBack=-Math.cos(angle)*dx-Math.sin(angle)*dy;}
    [...members].sort((a,b)=>a.order.slotBack-b.order.slotBack||a.order.slotSide-b.order.slotSide).forEach((u,i)=>{u.order.advanceIndex=i;});
    g.formationAdvances.set(id,cohort);
  }
  updateFormationAdvances(g,0,defs);
  return {ok:true,message:'Advance together, keep formation and engage the nearest enemy force.',count:troops.length};
}

export function updateFormationAdvances(g,dt,defs){
  if(!g.formationAdvances?.size)return;
  const forcesByTeam=new Map();
  for(const [id,c]of g.formationAdvances){
    const members=c.members.map(id=>g.byId.get(id)).filter(u=>u?.hp>0&&u.order?.advanceId===c.id&&u.order.mode==='advance');
    if(!members.length){g.formationAdvances.delete(id);continue;}
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
      c.angle+=clamp(delta,-Math.min(.65,pace/radius)*dt,Math.min(.65,pace/radius)*dt);
      const fx=Math.cos(c.angle),fy=Math.sin(c.angle),front=Math.max(...members.map(u=>-u.order.marchBack));
      const range=Math.min(...members.filter(u=>-u.order.marchBack>front-.3).map(u=>g.unitRange(u)));
      const edge=Math.min(...live.map(u=>(u.x-c.x)*fx+(u.y-c.y)*fy-(u.radius||.2)));
      const errors=members.map(u=>distance(u,u.order)).sort((a,b)=>a-b),cohesive=errors[Math.floor((errors.length-1)*.8)]<.5&&errors[errors.length-1]<1;
      if(cohesive&&Math.abs(delta)<.45&&edge>front+range*.85){
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
