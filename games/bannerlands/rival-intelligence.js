// Campaign intelligence is separate from tactical target acquisition. Every
// opponent, including house zero, is evaluated through the same observations.
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const distance2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const histories=new WeakMap();
const routeSurveys=new WeakMap();
const confidence=(entity,time,unit=false)=>!entity.remembered?1:Math.exp(-Math.max(0,time-entity.lastSeen)/(unit?45:180));

// Campaign candidates share an origin. One existing terrain field surveys all
// of them, rather than flooding the same map separately for every production
// post. Costs are symmetric; reversing its links gives legal outward routes.
// Both caches contain public static geography only, never hostile state.
export function campaignRoute(game,from,to,movement='infantry'){
  const navigation=game.navigation,origin=navigation.nearestPassable(from),goal=navigation.nearestPassable(to),empty={points:[],distance:Infinity,cost:Infinity,reachable:false,crossings:[]};
  if(!origin||!goal)return empty;
  const start=navigation.index(origin),target=navigation.index(goal),kind=navigation.kind(movement);
  if(navigation.regions[start]!==navigation.regions[target])return empty;
  let cache=routeSurveys.get(navigation);
  if(!cache||cache.version!==navigation.version){cache={version:navigation.version,sources:new Map(),routes:new Map(),points:0};routeSurveys.set(navigation,cache);}
  const sourceKey=kind+':'+start,key=sourceKey+':'+target+':'+origin.x+':'+origin.y+':'+goal.x+':'+goal.y;
  const retained=cache.routes.get(key);if(retained){cache.routes.delete(key);cache.routes.set(key,retained);return retained;}
  let field=cache.sources.get(sourceKey);
  if(field){cache.sources.delete(sourceKey);cache.sources.set(sourceKey,field);}
  else{field=navigation.field(origin,kind,-1);if(!field?.complete)return empty;cache.sources.set(sourceKey,field);while(cache.sources.size>32)cache.sources.delete(cache.sources.keys().next().value);}
  if(!Number.isFinite(field.distance[target]))return empty;
  const indices=[];let cursor=target;
  while(cursor>=0&&indices.length<=navigation.walkable.length){indices.push(cursor);if(cursor===start)break;cursor=field.next[cursor];}
  if(indices.at(-1)!==start)return empty;indices.reverse();
  const points=[origin,...indices.slice(1,-1).map(i=>navigation.point(i)),goal],crossings=[];
  if(start!==target&&indices.length===2)points.splice(1,0,navigation.point(start),navigation.point(target));
  let distance=0;for(let i=1;i<points.length;i++)distance+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  for(const index of indices){const tile=game.tiles[index];if(['bridge','ford','pass'].includes(tile.feature))crossings.push({...navigation.point(index),kind:tile.feature});}
  const offset=Math.hypot(origin.x-(start%game.W+.5),origin.y-(Math.floor(start/game.W)+.5))+Math.hypot(goal.x-(target%game.W+.5),goal.y-(Math.floor(target/game.W)+.5)),terrainCost=navigation.costGrid(kind).values[start];
  const route={points,distance,cost:start===target?distance*terrainCost:field.distance[target]+offset*terrainCost,reachable:true,crossings,goal};
  cache.routes.set(key,route);cache.points+=points.length;
  // At most 32 source grids (~12 MiB on Continent), 1,024 routes and 65,536
  // point records. A changed terrain revision discards every derived result.
  while(cache.routes.size>1024||cache.points>65536){const oldest=cache.routes.keys().next().value,entry=cache.routes.get(oldest);cache.points-=entry.points.length;cache.routes.delete(oldest);}
  return route;
}

export function observedStrength(game,unit){
  const kind=game.unitClass(unit),weight=kind==='hero'?3:kind==='siege'?2:kind==='cavalry'?1.35:1;
  // Unit definitions are public roster data. Read by type string so this
  // estimate never asks for a hostile house's private upgrades or hero mode.
  const definition=game.unitDefinition?.(unit.type),baseline=game.unitDefinition?.(kind),damage=definition?.damage/Math.max(.2,definition?.rate||1),baseDamage=baseline?.damage/Math.max(.2,baseline?.rate||1);
  const specialist=definition&&baseline?clamp(Math.sqrt(definition.hp/Math.max(1,baseline.hp)*damage/Math.max(1,baseDamage)),.7,3):1;
  const observedArmor=definition?clamp(Math.sqrt((unit.maxHp||definition.hp)/Math.max(1,definition.hp)),.7,2):1;
  return weight*specialist*observedArmor*Math.sqrt(clamp(unit.hp/Math.max(1,unit.maxHp||unit.hp),0,1));
}

function publicProgress(game,team,territory){
  const mode=game.mode||{},alliance=game.teams[team].alliance;
  // The council publicly lists flag scores and cumulative crown control even
  // under fog. A hidden flag's controller and capture progress remain private.
  if(mode.controlGoal)return clamp((game.controlScores?.[alliance]||0)/mode.controlGoal,0,1);
  if(mode.objectiveGoal)return clamp((game.objectiveScores?.[alliance]||0)/mode.objectiveGoal,0,1);
  if(mode.id?.endsWith('dominion')){
    const land=game.teams.filter(t=>t.alliance===alliance).reduce((n,t)=>n+(territory[t.id]||0),0);
    return clamp(land/Math.max(1,(game.playable||game.tiles.length)*.65),0,1);
  }
  if(mode.flagWaves)return clamp((game.objectiveScores?.[alliance]||0)/6,0,1);
  return 0;
}

function visibleEvents(game,team,sites,territory){
  if(game.config.fogOfWar)return game.vision?.campaignEvents(team)||[];
  let perTeam=histories.get(game);if(!perTeam){perTeam=new Map();histories.set(game,perTeam);}
  let history=perTeam.get(team);
  if(!history){history={land:[...territory],owners:new Map(sites.filter(site=>site.team>=0).map(site=>[site.id,site.team])),events:[],at:game.time};perTeam.set(team,history);return history.events;}
  if(history.at!==game.time){
    for(let t=0;t<territory.length;t++)if(territory[t]>history.land[t])history.events.push({kind:'expansion',team:t,time:game.time,amount:territory[t]-history.land[t]});
    for(const site of sites)if(site.team>=0){if(history.owners.has(site.id)&&history.owners.get(site.id)!==site.team)history.events.push({kind:'victory',team:site.team,time:game.time,amount:1});history.owners.set(site.id,site.team);}
    history.land=[...territory];history.at=game.time;
    history.events=history.events.filter(event=>game.time-event.time<=120).slice(-256);
  }
  return history.events;
}

/** Scores are 0..100, not probabilities. An opportunity >=55 is a clear
 * opening, risk >=60 an expensive commitment. `feasible` retains a reserve.
 * This function does not issue orders or use hostile plans/private resources.
 */
export function evaluateRivals(game,teamOrState,plan={}){
  const state=typeof teamOrState==='number'?game.teams[teamOrState]:teamOrState,team=state.id,time=game.time,fog=!!game.config.fogOfWar;
  // Reports are cached by the commander. Freeze observable hostile fields so
  // an entity leaving sight cannot keep mutating a cached live reference.
  const unitObservation=u=>!fog||game.allied(team,u.team)||u.remembered?u:Object.freeze({...game.vision.unitSnapshot(u),remembered:false});
  const visible=game.knownUnits(team).map(unitObservation),observed=new Map(visible.map(u=>[u.id,u]));
  const units=fog&&game.vision?.campaignUnits?game.vision.campaignUnits(team).map(u=>observed.get(u.id)||u):visible;
  const buildings=game.knownBuildings(team).map(b=>!fog||game.allied(team,b.team)||b.remembered?b:Object.freeze({...game.vision.buildingSnapshot(b),remembered:false}));
  const territory=fog?game.vision.campaignTerritory(team):game.teams.map(t=>t.tiles||0),events=visibleEvents(game,team,game.knownCastleSites(team),territory);
  const powerById=new Map(),crossingRisk=new Map(),enemyBuckets=new Map();
  for(let index=0;index<units.length;index++){const u=units[index];if(u.hp<=0)continue;const power=observedStrength(game,u)*confidence(u,time,true);powerById.set(u.id,power);if(game.hostile(team,u.team)){const key=Math.floor(u.x/6)+','+Math.floor(u.y/6);let bucket=enemyBuckets.get(key);if(!bucket){bucket=[];enemyBuckets.set(key,bucket);}bucket.push({unit:u,index,power});}}
  const power=u=>powerById.get(u.id)??0;
  const riskAtCrossing=crossing=>{
    const key=crossing.x+','+crossing.y;if(crossingRisk.has(key))return crossingRisk.get(key);
    const nearby=[];for(let y=Math.floor((crossing.y-6)/6);y<=Math.floor((crossing.y+6)/6);y++)for(let x=Math.floor((crossing.x-6)/6);x<=Math.floor((crossing.x+6)/6);x++)for(const entry of enemyBuckets.get(x+','+y)||[])if(distance2(crossing,entry.unit)<36)nearby.push(entry);
    // Preserve observation order, including floating-point summation order.
    nearby.sort((a,b)=>a.index-b.index);let risk=0;for(const entry of nearby)risk+=entry.power;crossingRisk.set(key,risk);return risk;
  };
  const own=visible.filter(u=>u.team===team&&u.hp>0),ownStrength=own.reduce((n,u)=>n+power(u),0);
  const reserveStrength=Math.min(ownStrength,Math.max(10,ownStrength*(plan.reserve??.22))),availableStrength=Math.max(0,ownStrength-reserveStrength);
  const byTeam=Array.from({length:game.teams.length},()=>({units:[],buildings:[],strength:0,visibleStrength:0}));
  for(const u of units){if(u.hp<=0||!byTeam[u.team])continue;const row=byTeam[u.team],strength=power(u);row.units.push(u);row.strength+=strength;if(!u.remembered)row.visibleStrength+=strength;}
  for(const b of buildings)if(b.hp>0&&byTeam[b.team])byTeam[b.team].buildings.push(b);
  const ownKeeps=buildings.filter(b=>b.hp>0&&b.type==='keep'&&game.allied(team,b.team));
  const protectedPoints=ownKeeps.map(point=>({point,radius:13,kind:'castle'}));
  for(const u of visible)if(u.hp>0&&game.allied(team,u.team)&&(u.isKing||game.unitClass(u)==='hero'))protectedPoints.push({point:u,radius:u.isKing?13:7,kind:u.isKing?'king':'army'});
  for(const objective of game.objectives||[])if(game.isVisibleTo(team,objective)&&objective.controller===state.alliance)protectedPoints.push({point:objective,radius:(objective.radius||4)+6,kind:'objective'});
  const threats=[],dangerByTeam=new Map(),dangerPoint=new Map();
  for(const u of visible){
    if(u.hp<=0||!game.hostile(team,u.team))continue;
    const point=protectedPoints.find(p=>distance2(p.point,u)<p.radius**2);if(!point)continue;
    threats.push(u);dangerByTeam.set(u.team,(dangerByTeam.get(u.team)||0)+power(u));
    if(!dangerPoint.has(u.team)||distance2(u,point.point)<distance2(dangerPoint.get(u.team).enemy,dangerPoint.get(u.team).point))dangerPoint.set(u.team,{point:point.point,enemy:u,kind:point.kind});
  }
  const defenseLoad=clamp([...dangerByTeam.values()].reduce((n,power)=>n+power,0)/Math.max(15,ownStrength)*30,0,25);
  const rivals=[],scoutTargets=[],movement=plan.style==='raider'?'cavalry':plan.style==='siege'?'siege':'infantry';
  const ownLand=Math.max(49,territory[team]||0),maxLand=Math.max(49,...territory),forts=buildings.filter(b=>b.hp>0&&['keep','tower'].includes(b.type)&&game.hostile(team,b.team));
  for(const opponent of game.teams){
    if(!game.hostile(team,opponent.id)||!fog&&!opponent.alive)continue;
    const known=byTeam[opponent.id],targets=[],keeps=known.buildings.filter(b=>b.type==='keep'),knownTerritory=territory[opponent.id]||0;
    const dangerStrength=dangerByTeam.get(opponent.id)||0,immediateDanger=dangerStrength?clamp(dangerStrength*2+dangerStrength/Math.max(15,ownStrength)*60):0;
    const nearest=known.buildings.concat(known.units).reduce((n,p)=>Math.min(n,Math.sqrt(distance2(state.home,p))),Infinity);
    const military=clamp(known.strength/Math.max(20,ownStrength)*23,0,38),land=clamp(knownTerritory/ownLand*7,0,15),castles=clamp(keeps.reduce((n,b)=>n+confidence(b,time),0)*4,0,16);
    const progress=publicProgress(game,opponent.id,territory),recent=events.filter(event=>event.team===opponent.id).reduce((n,event)=>n+event.amount*(event.kind==='victory'?8:.025)*Math.exp(-(time-event.time)/60),0);
    const strategicThreat=clamp(military+land+castles+progress*38+clamp(20-nearest*.24,0,10)+clamp(recent,0,12)+Math.min(8,immediateDanger*.12));
    for(const target of known.buildings){
      const production=target.type!=='keep'&&target.type!=='tower';
      if(target.type!=='keep'&&!production)continue;
      const route=campaignRoute(game,state.home,target,movement);if(!route.reachable)continue;
      let guards=0;
      for(const ally of game.teams)if(game.allied(opponent.id,ally.id))for(const u of byTeam[ally.id].units)if(distance2(u,target)<100)guards+=power(u);
      const towers=forts.filter(b=>b.type==='tower'&&game.allied(opponent.id,b.team)&&distance2(b,target)<81).reduce((n,b)=>n+confidence(b,time),0);
      const targetConfidence=confidence(target,time),uncertainty=fog?7+(1-targetConfidence)*(12+availableStrength*.12):0;
      const health=clamp(target.hp/Math.max(1,target.maxHp),0,1),expectedResistance=guards+towers*9+(target.type==='keep'?18:4)*health+uncertainty;
      let routeResistance=0;
      for(const fort of forts)if(distance2(fort,target)>=100&&route.points.some(p=>distance2(p,fort)<(fort.type==='keep'?7:6)**2))routeResistance+=(fort.type==='keep'?8:5)*confidence(fort,time);
      let hostileCrossings=0;
      for(const crossing of route.crossings||[])hostileCrossings+=riskAtCrossing(crossing);
      const travelRisk=route.cost*.24+Math.max(0,route.cost-(route.distance||route.cost))*.2+routeResistance+Math.min(16,hostileCrossings*.45);
      const costRisk=clamp(travelRisk+expectedResistance/Math.max(12,availableStrength)*36+defenseLoad+immediateDanger*.15);
      const feasible=availableStrength>=Math.max(8,expectedResistance*.9)&&costRisk<80;
      const invasionOpportunity=clamp(62+(availableStrength-expectedResistance)/Math.max(16,availableStrength)*34-travelRisk*.65-defenseLoad*.5-immediateDanger*.2+(production&&plan.style==='raider'?10:0)-(1-targetConfidence)*16);
      const entry={team:opponent.id,target,route,guards,towers,expectedResistance,costRisk,invasionOpportunity,confidence:targetConfidence,feasible};targets.push(entry);
      if(fog&&(target.remembered||expectedResistance>availableStrength*.8))scoutTargets.push({x:target.x,y:target.y,team:opponent.id,targetId:target.id,priority:strategicThreat+(1-targetConfidence)*25,confidence:targetConfidence});
    }
    targets.sort((a,b)=>b.invasionOpportunity-a.invasionOpportunity||a.target.id-b.target.id);
    const best=targets[0],knownConfidence=known.units.length?known.units.reduce((n,u)=>n+confidence(u,time,true),0)/known.units.length:keeps.length?keeps.reduce((n,b)=>n+confidence(b,time),0)/keeps.length:0;
    const row={team:opponent.id,strategicThreat,invasionOpportunity:best?.invasionOpportunity||0,immediateDanger,costRisk:best?.costRisk??100,knownStrength:known.strength,visibleStrength:known.visibleStrength,knownTerritory,territoryShare:knownTerritory/maxLand,knownKeeps:keeps.length,confidence:knownConfidence,victoryProgress:progress,recentExpansion:recent,targets,target:best?.target||null,feasible:!!best?.feasible};
    Object.assign(row,{threat:row.strategicThreat,opportunity:row.invasionOpportunity,danger:row.immediateDanger,risk:row.costRisk});rivals.push(row);
  }
  const strategicTarget=[...rivals].filter(r=>r.strategicThreat>0).sort((a,b)=>b.strategicThreat-a.strategicThreat||a.team-b.team)[0]||null;
  const invasionTarget=rivals.flatMap(r=>r.targets).filter(t=>t.feasible).sort((a,b)=>b.invasionOpportunity-a.invasionOpportunity||a.target.id-b.target.id)[0]||null;
  const urgent=[...rivals].filter(r=>r.immediateDanger>0).sort((a,b)=>b.immediateDanger-a.immediateDanger||a.team-b.team)[0];
  const immediateTarget=urgent?{...urgent,...dangerPoint.get(urgent.team)}:null;
  scoutTargets.sort((a,b)=>b.priority-a.priority||a.targetId-b.targetId);
  return {rivals,strategicTarget,invasionTarget,immediateTarget,leadingThreat:strategicTarget,opportunityTarget:invasionTarget,threats,ownStrength,reserveStrength,availableStrength,scoutTargets:scoutTargets.slice(0,8),observedAt:time};
}
