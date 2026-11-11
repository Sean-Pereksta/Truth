/* Monster Mall: obstacle-aware crowd and predator simulation. No renderer dependencies. */
// The lowest shop entrance is 3.13 m high. These per-rig limits keep animated
// silhouettes below 3 m, including the taller Insane-only watcher.
export const MONSTER_SIZE_LIMITS=Object.freeze({brute:.95,stalker:.95,crawler:.96,watcher:.75});
export function monsterScaleLimit(type){return MONSTER_SIZE_LIMITS[type]??MONSTER_SIZE_LIMITS.stalker;}
export function createSimulation({ collides, lineOfSight, spawnPoints = [], coverPoints = [], patrolPoints = [], onEvent = () => {}, navigation = null, difficulty = 'normal' }) {
  // Difficulty changes what a predator can learn and how it searches, as well
  // as pace. A remembered sighting is a snapshot, never a live player position.
  const profiles = {
    easy: {count:2,sight:12,hearing:.65,memory:3.5,search:2,predict:0,share:0,speed:.86,run:.86,sense:.48},
    normal: {count:3,sight:17,hearing:1,memory:6,search:4,predict:0,share:0,speed:1,run:1,sense:.27},
    hard: {count:3,sight:20,hearing:1.15,memory:9,search:7,predict:.65,share:0,speed:1.04,run:1.15,sense:.19},
    nightmare: {count:3,sight:23,hearing:1.3,memory:13,search:10,predict:1,share:28,speed:1.08,run:1.32,sense:.14},
    insane: {count:4,sight:26,hearing:1.45,memory:17,search:14,predict:1.3,share:38,speed:1.1,run:1.5,sense:.10}
  };
  let level = Object.hasOwn(profiles,difficulty) ? difficulty : 'normal', profile = profiles[level], packSighting = null, noiseId = 0;
  const civilians = [], monsters = [], noises = [], patrols = [], covers = [];
  const XMIN = -43, ZMIN = -59, WIDTH = 87, HEIGHT = 119, COUNT = WIDTH * HEIGHT;
  const walkable = new Uint8Array(COUNT);
  const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];
  let elapsed = 0, rescued = 0, eaten = 0, exitOpen = true, screamClock = 0, seed = 843251;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const heightDifference = (a,b) => Math.abs((a.y||0)-(b.y||0));
  const safeSight = (a,b) => {
    if(heightDifference(a,b)>1.2)return false;
    if(navigation&&(a.y||0)>2&&(b.y||0)>2) {
      const n=Math.ceil(distance(a,b)/.5),y=Math.min(a.y,b.y);
      for(let i=1;i<n;i++){const k=i/n,x=a.x+(b.x-a.x)*k,z=a.z+(b.z-a.z)*k,g=navigation.ground(x,z,y);if(g===null||!Number.isFinite(g)||Math.abs(g-y)>.5||navigation.collides(x,z,.1,g))return false;}
      return true;
    }
    return lineOfSight ? lineOfSight(a.x,a.z,b.x,b.z) : true;
  };
  // Seeing a crouched head over a counter is different from finding an empty
  // route at floor height. The world supplies true-height eye rays when able.
  const perceiveSight = (a,b) => heightDifference(a,b)<=1.2&&(navigation?.canSee ? navigation.canSee(a,b) : safeSight(a,b));
  const index = (x,z) => z*WIDTH+x;
  const point = i => ({x:XMIN+i%WIDTH,z:ZMIN+Math.floor(i/WIDTH)});
  const free = (x,z) => x>=0 && z>=0 && x<WIDTH && z<HEIGHT && walkable[index(x,z)];
  const event = (type,actor,extra={}) => onEvent({type,x:actor.x,y:actor.y||0,z:actor.z,...extra});

  function nearest(x,z) {
    const gx=clamp(Math.round(x-XMIN),0,WIDTH-1), gz=clamp(Math.round(z-ZMIN),0,HEIGHT-1);
    if(free(gx,gz)) return index(gx,gz);
    for(let ring=1;ring<12;ring++) {
      let best=-1,bestD=Infinity;
      for(let dz=-ring;dz<=ring;dz++) for(let dx=-ring;dx<=ring;dx++) {
        if(Math.abs(dx)!==ring && Math.abs(dz)!==ring) continue;
        if(!free(gx+dx,gz+dz)) continue;
        const d=(gx+dx+XMIN-x)**2+(gz+dz+ZMIN-z)**2;
        if(d<bestD) { bestD=d; best=index(gx+dx,gz+dz); }
      }
      if(best>=0) return best;
    }
    return -1;
  }

  // A* uses a binary heap and forbids diagonal wall-corner cuts.
  function pathBetween(actor,target,avoidPredators=false) {
    const start=nearest(actor.x,actor.z), finish=nearest(target.x,target.z);
    if(start<0||finish<0) return [];
    const costs=new Float32Array(COUNT); costs.fill(Infinity);
    const parents=new Int32Array(COUNT); parents.fill(-1);
    const closed=new Uint8Array(COUNT), heap=[];
    const tx=finish%WIDTH,tz=Math.floor(finish/WIDTH);
    function push(i,f) {
      let at=heap.length; heap.push({i,f});
      while(at>0) {const up=(at-1)>>1;if(heap[up].f<=f)break;heap[at]=heap[up];at=up;} heap[at]={i,f};
    }
    function pop() {
      const result=heap[0], last=heap.pop();
      if(heap.length) {let at=0;heap[0]=last;for(;;){let child=at*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[at]=heap[child];at=child;}heap[at]=last;}
      return result.i;
    }
    const heuristic=(x,z)=>{const dx=Math.abs(x-tx),dz=Math.abs(z-tz);return Math.max(dx,dz)+.414*Math.min(dx,dz);};
    costs[start]=0;push(start,heuristic(start%WIDTH,Math.floor(start/WIDTH)));
    let found=false,iterations=0;
    while(heap.length&&iterations++<COUNT) {
      const current=pop();if(closed[current])continue;closed[current]=1;
      if(current===finish){found=true;break;}
      const x=current%WIDTH,z=Math.floor(current/WIDTH);
      for(const [dx,dz,step] of dirs) {
        const nx=x+dx,nz=z+dz;
        if(!free(nx,nz)||(dx&&dz&&(!free(x+dx,z)||!free(x,z+dz))))continue;
        const next=index(nx,nz);if(closed[next])continue;
        let penalty=0;
        if(avoidPredators) for(const beast of monsters) {
          const d=Math.hypot(nx+XMIN-beast.x,nz+ZMIN-beast.z);
          if(d<7) penalty+=(7-d)*.37;
        }
        const cost=costs[current]+step+penalty;
        if(cost<costs[next]) {costs[next]=cost;parents[next]=current;push(next,cost+heuristic(nx,nz));}
      }
    }
    if(!found)return [];
    const result=[];let p=finish;
    while(p!==start&&p>=0){result.push(point(p));p=parents[p];}
    result.reverse();
    if(result.length&&safeSight(result[result.length-1],target)&&!collides(target.x,target.z,.35))result.push({x:target.x,z:target.z});
    return result;
  }

  function randomDestination() {
    for(let i=0;i<50;i++) {
      const x=-40+random()*80,z=-56+random()*110;
      if(!collides(x,z,.6))return {x,z};
    }
    const cell=nearest(0,0);return cell>=0?point(cell):{x:0,z:0};
  }

  const sectorOf = p => p.sector??`${(p.y||0)>2?'upper':'ground'}:${Math.floor((p.x+43)/15)}:${Math.floor((p.z+59)/22)}`;
  function separationScore(m,p,goalKey='roam') {
    let nearestActor=28,nearestGoal=28;
    for(const other of monsters) {
      if(other===m)continue;
      const floorBonus=heightDifference(other,p)>2?9:0;
      nearestActor=Math.min(nearestActor,distance(other,p)+floorBonus);
      const goal=other[goalKey];
      if(goal)nearestGoal=Math.min(nearestGoal,distance(goal,p)+(heightDifference(goal,p)>2?9:0));
    }
    return nearestActor*.6+nearestGoal*1.15-(nearestGoal<7?24:0);
  }

  function assignPatrol(m) {
    const choices=patrols.length?patrols:Array.from({length:14},()=>({...randomDestination(),y:0}));
    let best=null,bestScore=-Infinity;
    for(const p of choices) {
      const sector=sectorOf(p),lastVisit=m.visitedSectors?.[sector]??-1000;
      const travel=distance(m,p);
      const score=separationScore(m,p)+Math.min(20,(elapsed-lastVisit)*.08)+(sector!==m.sector?8:-10)+(heightDifference(m,p)>2?3:0)+random()*4-(travel<5?16:0)-travel*.35;
      if(score>bestScore){bestScore=score;best=p;}
    }
    const destination={...(best||randomDestination())};destination.y=destination.y||0;
    m.previousPatrol=m.patrolGoal;m.patrolGoal=destination;m.roam=destination;m.sector=sectorOf(destination);
    m.roamTimer=Math.max(12+random()*9,patrolTravelDistance(m,destination)/(1.5*profile.speed)+8);m.patrolPause=0;clearRoute(m);m.upperPath=null;
  }

  function patrolMonster(m,dt,r) {
    if(!m.roam||m.roamTimer<=0||m.patrolPause<0)assignPatrol(m);
    const arrived=distance(m,m.roam)<.85&&heightDifference(m,m.roam)<.3;
    if(arrived) {
      if(m.patrolPause===0) {
        m.patrolPause=2+random()*2;m.patrolVisits++;
        m.visitedSectors[sectorOf(m.roam)]=elapsed;
      }
      m.state='search';m.patrolPause-=dt;m.angle+=dt*.4;
      if(m.patrolPause<=0)m.patrolPause=-1;
    } else {
      m.state='roam';walkMonster(m,m.roam,1.5*profile.speed,dt,r);
    }
  }

  function clearRoute(actor) { actor.path=[];actor.pathIndex=0;actor.repath=0; }
  function directClear(actor,target,r) {
    if(!safeSight(actor,target))return false;
    const length=distance(actor,target),steps=Math.ceil(length/.7);
    for(let i=1;i<=steps;i++) {
      const k=i/steps;if(collides(actor.x+(target.x-actor.x)*k,actor.z+(target.z-actor.z)*k,r))return false;
    }
    return true;
  }

  function move(actor,dx,dz,r) {
    const oldX=actor.x,oldZ=actor.z;
    if(!collides(actor.x+dx,actor.z+dz,r)){actor.x+=dx;actor.z+=dz;}
    else {
      if(!collides(actor.x+dx,actor.z,r))actor.x+=dx;
      if(!collides(actor.x,actor.z+dz,r))actor.z+=dz;
    }
    return Math.hypot(actor.x-oldX,actor.z-oldZ);
  }

  function walk(actor,target,speed,dt,r,avoidPredators=false) {
    actor.repath-=dt;
    const targetMoved=!actor.routeTarget||distance(target,actor.routeTarget)>2.2;
    if(actor.repath<=0||targetMoved||!actor.path.length) {
      actor.path=pathBetween(actor,target,avoidPredators);actor.pathIndex=0;
      actor.repath=(actor.type ? Math.max(.22,profile.sense*1.9) : .7)+random()*.4;actor.routeTarget={x:target.x,z:target.z};
    }
    let waypoint=actor.path[actor.pathIndex];
    while(waypoint&&distance(actor,waypoint)<.42)waypoint=actor.path[++actor.pathIndex];
    // Short lookahead removes the robotic right-angle walk without cutting corners.
    if(waypoint&&actor.pathIndex+1<actor.path.length) {
      const next=actor.path[actor.pathIndex+1];
      if(directClear(actor,next,r)) {actor.pathIndex++;waypoint=next;}
    }
    if(!waypoint&&directClear(actor,target,r))waypoint=target;
    if(!waypoint) {actor.stuck+=dt;return;}
    let dx=waypoint.x-actor.x,dz=waypoint.z-actor.z,length=Math.hypot(dx,dz);
    if(length<.05)return;
    dx/=length;dz/=length;
    // Keep the crowd from becoming one overlapping person at doorways.
    if(avoidPredators) {
      let sx=0,sz=0;
      for(const other of civilians) {
        if(other===actor||!other.alive)continue;
        const ox=actor.x-other.x,oz=actor.z-other.z,d=Math.hypot(ox,oz);
        if(d>.01&&d<.62){sx+=ox/d*(.62-d);sz+=oz/d*(.62-d);}
      }
      const amount=Math.hypot(sx,sz);if(amount>.65){sx*=.65/amount;sz*=.65/amount;}
      dx+=sx;dz+=sz;const l=Math.hypot(dx,dz);dx/=l;dz/=l;
    }
    const amount=Math.min(speed*dt,length);
    const moved=move(actor,dx*amount,dz*amount,r);
    if(moved<amount*.12)actor.stuck+=dt;else actor.stuck=Math.max(0,actor.stuck-dt*2);
    if(actor.stuck>.65) {
      actor.repath=0;actor.stuck=0;
      // Sliding and a small, collision-tested sidestep unjam crowded corners.
      const side=random()>.5?1:-1;move(actor,-dz*.24*side,dx*.24*side,r);
    }
    if(moved>.001) {
      const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-actor.angle),Math.cos(desired-actor.angle));
      actor.angle+=delta*Math.min(1,dt*10);actor.phase+=moved*6;
    }
    actor.moving=moved>dt*.12;
  }

  // Upstairs is a U-shaped concourse. Explicit portals keep overlapping floors
  // distinct: predators must physically reach a stair before changing height.
  function navigationMove(actor,dx,dz,r) {
    const oldX=actor.x,oldZ=actor.z;
    function attempt(x,z) {
      const y=navigation.ground(x,z,actor.y||0);
      if(y===null||!Number.isFinite(y)||Math.abs(y-(actor.y||0))>.24||navigation.collides(x,z,r,y))return false;
      actor.x=x;actor.z=z;actor.y=y;return true;
    }
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
    for(let i=0;i<steps;i++) {
      if(!attempt(actor.x+dx/steps,actor.z+dz/steps)) {
        attempt(actor.x+dx/steps,actor.z);
        attempt(actor.x,actor.z+dz/steps);
      }
    }
    return Math.hypot(actor.x-oldX,actor.z-oldZ);
  }

  function navigationWalk(actor,target,speed,dt,r) {
    const dx=target.x-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz);
    if(d<.07){actor.moving=false;return;}
    const amount=Math.min(speed*dt,d),vx=dx/d,vz=dz/d;
    let moved=navigationMove(actor,vx*amount,vz*amount,r);
    if(moved<amount*.15) {
      // Test shallow detours around balcony columns without crossing voids.
      for(const turn of [.55,-.55,1.05,-1.05]) {
        const cx=vx*Math.cos(turn)-vz*Math.sin(turn),cz=vx*Math.sin(turn)+vz*Math.cos(turn);
        moved=navigationMove(actor,cx*amount,cz*amount,r);
        if(moved>amount*.25)break;
      }
    }
    actor.moving=moved>dt*.1;
    if(actor.moving) {
      const desired=Math.atan2(vx,vz),delta=Math.atan2(Math.sin(desired-actor.angle),Math.cos(desired-actor.angle));
      actor.angle+=delta*Math.min(1,dt*9);actor.phase+=moved*6;
    }
  }

  function upperRoute(actor,target) {
    const route=[],rear=-25,lane=12,actorSide=Math.sign(actor.x)||1,targetSide=Math.sign(target.x)||actorSide;
    if(actor.z>-23.8&&target.z>-23.8&&actorSide===targetSide) {
      route.push({x:actorSide*lane,z:actor.z},{x:targetSide*lane,z:target.z});
    } else {
      if(actor.z>-23.8)route.push({x:actorSide*lane,z:actor.z},{x:actorSide*lane,z:rear});
      if(target.z>-23.8)route.push({x:targetSide*lane,z:rear},{x:targetSide*lane,z:target.z});
    }
    route.push({x:target.x,z:target.z});
    return route;
  }

  function walkUpper(actor,target,speed,dt,r) {
    actor.upperRepath=(actor.upperRepath||0)-dt;
    if(!actor.upperPath||actor.upperRepath<=0||!actor.upperTarget||distance(actor.upperTarget,target)>2) {
      actor.upperPath=upperRoute(actor,target);actor.upperIndex=0;actor.upperRepath=1.2;
      actor.upperTarget={x:target.x,z:target.z};
    }
    let waypoint=actor.upperPath[actor.upperIndex];
    while(waypoint&&distance(actor,waypoint)<.28)waypoint=actor.upperPath[++actor.upperIndex];
    if(waypoint)navigationWalk(actor,waypoint,speed,dt,r);
  }

  function stairPoint(stair,top) {
    // The ground-only navigation footprint projects beyond the first tread.
    // Queue outside that footprint, then let height-aware movement enter it.
    // The rear queue must clear the *end* of both handrails by a full body
    // radius before a monster turns sideways from a gallery onto the ramp.
    return {x:stair.x,z:top?stair.topZ-1.1:stair.bottomZ+1.25,y:top?(stair.y||navigation.upperY||4.4):0};
  }

  function patrolTravelDistance(actor,target) {
    const length=(from,points)=>{let result=0,at=from;for(const p of points){result+=distance(at,p);at=p;}return result;};
    const ground=(from,to)=>{const route=pathBetween(from,to);return route.length?length(from,route):distance(from,to)*1.3;};
    const upper=(from,to)=>length(from,upperRoute(from,to));
    if(!navigation?.stairs?.length)return ground(actor,target);
    const actorUp=(actor.y||0)>2.2,goalUp=(target.y||0)>2.2;
    if(actorUp===goalUp)return actorUp?upper(actor,target):ground(actor,target);
    let selected=null,best=Infinity;
    for(const stair of navigation.stairs) {
      const from=stairPoint(stair,!goalUp),to=stairPoint(stair,goalUp),cost=distance(actor,from)+distance(to,target)*.65;
      if(cost<best){best=cost;selected={from,to};}
    }
    if(!selected)return distance(actor,target)*1.5;
    return (actorUp?upper(actor,selected.from):ground(actor,selected.from))+distance(selected.from,selected.to)/.92+(goalUp?upper(selected.to,target):ground(selected.to,target));
  }

  function walkMonster(actor,target,speed,dt,r) {
    if(!navigation||!navigation.stairs?.length) {walk(actor,target,speed,dt,r,false);return;}
    const upperY=navigation.upperY||4.4,goalUp=(target.y||0)>upperY*.5,actorUp=(actor.y||0)>upperY-.3;
    if(!actor.traversal&&(actorUp!==goalUp||((actor.y||0)>.2&&(actor.y||0)<upperY-.3))) {
      let selected=null,best=Infinity;
      for(const stair of navigation.stairs) {
        const from=stairPoint(stair,!goalUp),to=stairPoint(stair,goalUp);
        const cost=distance(actor,from)+distance(to,target)*.65;
        if(cost<best){best=cost;selected=stair;}
      }
      if(selected) {
        const onRamp=Math.abs(actor.x-selected.x)<1.1&&actor.z<selected.bottomZ+.3&&actor.z>selected.topZ-.3;
        actor.traversal={stair:selected,up:goalUp,stage:onRamp?1:0};actor.upperPath=null;clearRoute(actor);
      }
    }
    if(actor.traversal) {
      const trip=actor.traversal;
      // A target changing levels reverses the ramp rather than teleporting it.
      if(trip.stage===1)trip.up=goalUp;
      const from=stairPoint(trip.stair,!trip.up),to=stairPoint(trip.stair,trip.up);
      if(trip.stage===0) {
        if(distance(actor,from)<.12&&Math.abs(actor.x-from.x)<.075){trip.stage=1;actor.upperPath=null;clearRoute(actor);}
        else if(distance(actor,from)<.8)navigationWalk(actor,from,speed,dt,r);
        else if(trip.up)walk(actor,from,speed,dt,r,false);
        else walkUpper(actor,from,speed,dt,r);
      }
      if(trip.stage===1) {
        actor.onStair=true;navigationWalk(actor,to,speed*.92,dt,r);
        const reachedHeight=trip.up?(actor.y||0)>upperY-.15:(actor.y||0)<.15;
        if(distance(actor,to)<.25&&reachedHeight) {
          actor.y=trip.up?upperY:0;actor.traversal=null;actor.onStair=false;actor.upperPath=null;clearRoute(actor);
        }
      }
      return;
    }
    actor.onStair=false;
    if(actorUp)walkUpper(actor,target,speed,dt,r);
    else {actor.y=0;walk(actor,target,speed,dt,r,false);}
  }

  function noise(x,z,strength=1,y=0) {
    noises.push({x,y,z,strength,id:++noiseId,expires:elapsed+3.2});
    if(noises.length>12)noises.shift();
  }

  function reset(nextDifficulty=level) {
    level=Object.hasOwn(profiles,nextDifficulty)?nextDifficulty:'normal';profile=profiles[level];
    elapsed=0;rescued=0;eaten=0;screamClock=0;seed=843251;noises.length=0;packSighting=null;noiseId=0;
    civilians.length=0;monsters.length=0;
    for(let z=0;z<HEIGHT;z++)for(let x=0;x<WIDTH;x++)walkable[index(x,z)]=!collides(x+XMIN,z+ZMIN,.48);
    patrols.length=0;covers.length=0;
    for(const p of patrolPoints)if(Number.isFinite(p.x)&&Number.isFinite(p.z)&&pointFits(p,.52))patrols.push({...p,y:p.y||0});
    for(const p of coverPoints)if(Number.isFinite(p.x)&&Number.isFinite(p.z)&&(p.y||0)<.2&&pointFits(p,.28))covers.push({...p,y:0,id:p.id??p.coverId??`cover-${covers.length}`});
    const colors=['#c9b5a2','#607f87','#a66e60','#d4be84','#6d7b67','#9b859d','#5e6c94','#c8c6bc'];
    for(let i=0;i<32;i++) {
      let location=spawnPoints.length?spawnPoints[i%spawnPoints.length]:randomDestination();
      if(spawnPoints.length) {
        const x=location.x+(random()-.5)*1.5,z=location.z+(random()-.5)*1.5;
        if(!collides(x,z,.3))location={x,z};
      }
      if(collides(location.x,location.z,.3)){const cell=nearest(location.x,location.z);location=cell>=0?point(cell):randomDestination();}
      civilians.push({id:i,x:location.x,y:0,z:location.z,angle:random()*Math.PI*2,alive:true,escaped:false,grabbed:false,grabbedBy:null,panic:0,state:'roam',crouching:false,hiding:false,coverId:null,coverPoint:null,coverRetry:0,coverDeadline:0,hideSince:0,threatMemory:0,threatDistance:Infinity,phase:random()*6.28,color:colors[i%colors.length],path:[],pathIndex:0,repath:0,stuck:0,moving:false,roam:randomDestination(),roamTimer:2+random()*8,screamCooldown:random()*5,senseTimer:random()*.4,danger:null,routeTarget:null});
    }
    for(let i=0;i<profile.count;i++) {
      const places=[{x:-20,z:-52},{x:20,z:-54},{x:0,z:-55},{x:17,z:-37}], cell=nearest(places[i].x,places[i].z);
      let location=cell>=0?point(cell):randomDestination(),spawnScore=-Infinity;
      // Start in different wings/floors, with a clear buffer around the player
      // entrance. A crowded northern spawn is never needed for difficulty.
      for(const p of patrols) {
        if(p.z>36||Math.hypot(p.x,p.z-54)<24)continue;
        let spacing=65;for(const other of monsters)spacing=Math.min(spacing,distance(other,p)+(heightDifference(other,p)>2?8:0));
        const score=spacing*1.4-distance(p,places[i])*.2+random()*2;
        if(score>spawnScore){spawnScore=score;location={...p};}
      }
      const type=['brute','stalker','crawler','watcher'][i],spawnScale=type==='watcher'?.75:type==='brute'?.90:.82;
      monsters.push({id:i,x:location.x,y:location.y||0,z:location.z,angle:random()*6.28,scale:Math.min(monsterScaleLimit(type),spawnScale),state:'roam',phase:random()*6.28,attackCooldown:0,type,name:i===3?'The Still One':null,observed:false,stunned:0,path:[],pathIndex:0,repath:0,stuck:0,moving:false,target:null,lock:0,memory:0,lastSeen:null,lastSeenTime:-100,seesTarget:false,velocity:{x:0,z:0},searchGoal:null,investigateGoal:null,searchStep:0,packStamp:-100,heardNoise:0,watchNotice:0,roam:randomDestination(),patrolGoal:null,previousPatrol:null,patrolPause:0,patrolVisits:0,visitedSectors:{},sector:null,roamTimer:5+random()*5,senseTimer:random()*.2,roarCooldown:5,feeding:0,feedDuration:3.5,feedProgress:0,victimId:null,kills:0,traversal:null,onStair:false});
    }
    for(const m of monsters)assignPatrol(m);
  }

  function scare(civilian,danger) {
    civilian.panic=1;civilian.alerted=true;civilian.threatMemory=6;
    civilian.danger={id:danger.id,x:danger.x,y:danger.y||0,z:danger.z,time:elapsed};
    if(!civilian.hiding&&!civilian.crouching&&civilian.screamCooldown<=0&&screamClock<=0) {
      civilian.screamCooldown=6+random()*7;screamClock=.8;
      event('scream',civilian,{id:civilian.id});noise(civilian.x,civilian.z,.7);
    }
  }

  function leaveCover(c) {
    c.coverId=null;c.coverPoint=null;c.crouching=false;c.hiding=false;c.hideSince=0;
    clearRoute(c);
  }

  function coverReserved(c,p) {
    return civilians.some(other=>other!==c&&other.alive&&!other.grabbed&&other.coverPoint&&(other.coverId===p.id||distance(other.coverPoint,p)<1));
  }

  function coverSafe(c,p) {
    const crouched={...c,x:p.x,y:p.y||0,z:p.z,crouching:true,hiding:true};
    return pointFits(p,.28)&&!monsters.some(m=>heightDifference(m,p)<1.2&&distance(m,p)<18&&perceiveSight(m,crouched));
  }

  function chooseCover(c) {
    c.coverRetry=1.8+random()*.7;
    if(!c.danger||!covers.length)return false;
    const threat=monsters.find(m=>m.id===c.danger.id)||c.danger;
    const candidates=[];
    // Scan static points cheaply; only a few promising positions receive an
    // actual A* route check, at most once per decision interval.
    for(const p of covers) {
      const d=distance(c,p);
      if(d>17||coverReserved(c,p)||distance(threat,p)<2.3)continue;
      candidates.push({p,d,score:d-Math.min(18,distance(threat,p))*.16+random()*.5});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let routeChecks=0,visibilityChecks=0;
    for(const {p,d}of candidates) {
      if(++visibilityChecks>16)break;
      const crouched={...c,x:p.x,y:p.y||0,z:p.z,crouching:true,hiding:true};
      if(perceiveSight(threat,crouched)||!coverSafe(c,p))continue;
      if(++routeChecks>3)break;
      const path=pathBetween(c,p,true);
      if(d>.6&&!path.length&&!directClear(c,p,.28))continue;
      c.coverId=p.id;c.coverPoint=p;c.coverDeadline=elapsed+10+d*.5;c.hideSince=0;
      c.state='seekCover';c.hiding=false;c.crouching=false;c.path=path;c.pathIndex=0;c.repath=.8;c.routeTarget={x:p.x,z:p.z};
      return true;
    }
    return false;
  }

  function fleeDestination(c) {
    if(exitOpen)return {x:0,y:0,z:56.8};
    let best=null,score=-Infinity;
    const threat=c.danger||{x:c.x,z:c.z-1},away=Math.atan2(c.x-threat.x,c.z-threat.z);
    for(let i=0;i<10;i++) {
      const angle=away+(i%2?1:-1)*Math.floor((i+1)/2)*.38;
      const p={x:c.x+Math.sin(angle)*8,y:0,z:c.z+Math.cos(angle)*8};
      if(!pointFits(p,.3))continue;
      const value=distance(p,threat)-distance(p,{x:0,z:0})*.015+random();
      if(value>score){score=value;best=p;}
    }
    return best||randomDestination();
  }

  function updateCivilian(c,dt) {
    if(!c.alive||c.grabbed)return;
    c.screamCooldown-=dt;c.senseTimer-=dt;c.coverRetry=Math.max(0,c.coverRetry-dt);c.threatMemory=Math.max(0,c.threatMemory-dt);c.fleeTimer=(c.fleeTimer||0)-dt;c.moving=false;
    if(c.senseTimer<=0) {
      c.senseTimer=.30+random()*.15;
      let danger=null,nearestDistance=18;
      for(const beast of monsters) {
        if(heightDifference(c,beast)>1.2)continue;
        const d=distance(c,beast);
        if(d<nearestDistance&&(perceiveSight(c,beast)||(d<5.2&&beast.moving)||d<2.4)){nearestDistance=d;danger=beast;}
      }
      c.threatDistance=nearestDistance;
      if(danger)scare(c,danger);
      else {
        for(const other of civilians)if(other!==c&&other.alive&&other.moving&&other.panic>.85&&distance(c,other)<3.5&&perceiveSight(c,other)){
          c.panic=Math.max(c.panic,.82);c.alerted=true;
          if(other.danger&&!c.danger){c.danger={...other.danger};c.threatMemory=3;}
          break;
        }
      }
      const exposedWhileHidden=c.hiding&&monsters.some(m=>heightDifference(m,c)<1.2&&distance(m,c)<profile.sight+3&&perceiveSight(m,c));
      if(c.coverPoint&&(!coverSafe(c,c.coverPoint)||exposedWhileHidden)) {
        leaveCover(c);c.state='flee';c.coverRetry=Math.max(c.coverRetry,.8);c.fleeTimer=0;
      }
    }
    c.panic=Math.max(c.threatMemory>0?.55:0,c.panic-dt*(c.hiding?.025:.06));
    if(c.panic>.35||c.coverPoint||(exitOpen&&c.alerted)) {
      if(exitOpen&&Math.abs(c.x)<2.4&&c.z>55.4) {
        leaveCover(c);c.alive=false;c.escaped=true;rescued++;event('escape',c,{id:c.id});return;
      }
      const safeToEvacuate=exitOpen&&c.threatMemory<=0;
      if(c.coverPoint&&safeToEvacuate&&elapsed-c.hideSince>1.5){leaveCover(c);c.state='flee';c.fleeTimer=0;}
      if(c.coverPoint) {
        const d=distance(c,c.coverPoint);
        if(d<.16) {
          if(c.state!=='hide'){c.hideSince=elapsed;clearRoute(c);}
          c.state='hide';c.crouching=true;c.hiding=true;c.moving=false;
          if(c.danger){const desired=Math.atan2(c.danger.x-c.x,c.danger.z-c.z),delta=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));c.angle+=delta*Math.min(1,dt*2);}
          return;
        }
        if(elapsed>c.coverDeadline){leaveCover(c);c.coverRetry=2;}
        else {c.state='seekCover';c.hiding=false;c.crouching=d<1.1;walk(c,c.coverPoint,c.crouching?1.4:2.85,dt,.28,true);return;}
      }
      const wantsCover=c.threatMemory>0&&(!exitOpen||c.threatDistance<11);
      if(wantsCover&&c.coverRetry<=0&&chooseCover(c))return;
      c.state='flee';c.hiding=false;c.crouching=false;
      if(c.fleeTimer<=0||!c.fleeGoal||distance(c,c.fleeGoal)<1){c.fleeGoal=fleeDestination(c);c.fleeTimer=2+random();clearRoute(c);}
      walk(c,c.fleeGoal,2.7+(.5*(c.id%5)/4),dt,.28,true);
    } else {
      c.state='roam';c.crouching=false;c.hiding=false;
      c.roamTimer-=dt;
      if(c.roamTimer<=0||distance(c,c.roam)<.7){c.roam=randomDestination();c.roamTimer=5+random()*8;clearRoute(c);}
      walk(c,c.roam,.65+(c.id%4)*.08,dt,.28,false);
    }
  }

  function targetValid(target,player) {
    if(!target)return false;
    return target===player?player.alive!==false&&player.health>0:target.alive&&!target.grabbed;
  }

  function releaseVictim(m) {
    const victim=civilians.find(c=>c.id===m.victimId);
    if(victim&&victim.alive&&victim.grabbedBy===m.id) {
      victim.grabbed=false;victim.grabbedBy=null;victim.panic=1;victim.y=0;victim.alerted=true;leaveCover(victim);victim.state='flee';
      if(collides(victim.x,victim.z,.3)){const cell=nearest(victim.x,victim.z);if(cell>=0)Object.assign(victim,point(cell));}
      clearRoute(victim);event('release',m,{victimId:victim.id,id:m.id});
    }
    m.feeding=0;m.feedProgress=0;m.victimId=null;
  }

  function updateFeeding(m,dt) {
    // The player capture camera owns its four-second timeline while the world
    // is paused. Civilian feeding advances here with the regular simulation.
    if(m.victimId==='player'){m.state='feeding';return;}
    const victim=civilians.find(c=>c.id===m.victimId);
    if(!victim||!victim.alive||victim.grabbedBy!==m.id){releaseVictim(m);return;}
    m.feeding=Math.max(0,m.feeding-dt);m.feedProgress=clamp(1-m.feeding/(m.feedDuration||3.5),0,1);
    m.state='feeding';m.phase+=dt*3;
    victim.x=m.x;victim.z=m.z;victim.y=m.y||0;victim.angle=m.angle+Math.PI;
    if(m.feeding<=0) {
      victim.alive=false;victim.escaped=false;victim.grabbed=false;victim.grabbedBy=null;
      const previousScale=m.scale;
      eaten++;m.kills++;m.scale=Math.min(monsterScaleLimit(m.type),m.scale+.08);
      event('eat',m,{victimId:victim.id,id:m.id,scale:m.scale,grew:m.scale>previousScale});noise(m.x,m.z,.75);
      m.victimId=null;m.target=null;m.memory=0;clearRoute(m);
    }
  }

  function pointFits(point,r=.56) {
    if(navigation&&(point.y||0)>.2) {
      const ground=navigation.ground(point.x,point.z,point.y);
      return ground!==null&&Number.isFinite(ground)&&Math.abs(ground-point.y)<.3&&!navigation.collides(point.x,point.z,r,point.y);
    }
    return !collides(point.x,point.z,r);
  }

  function predictedPoint(m) {
    const seen=m.lastSeen;
    if(!seen||!profile.predict||!m.seesTarget)return seen;
    const amount=Math.min(profile.predict,distance(m,seen)/7),vx=m.velocity.x*amount,vz=m.velocity.z*amount;
    const predicted={x:seen.x+vx,y:seen.y,z:seen.z+vz};
    // Prediction can lead a target, but cannot guess through a wall or void.
    return pointFits(predicted)&&safeSight(seen,predicted)?predicted:seen;
  }

  function remember(m,location,duration) {
    const changed=!m.lastSeen||distance(m.lastSeen,location)>1||heightDifference(m.lastSeen,location)>1;
    m.lastSeen={x:location.x,y:location.y||0,z:location.z};m.memory=Math.max(m.memory,duration);
    if(changed){m.searchGoal=null;m.investigateGoal=null;m.searchStep=0;}
  }

  function hear(m,sound) {
    const d=Math.hypot(m.x-sound.x,m.z-sound.z,(m.y||0)-(sound.y||0));
    const clear=safeSight(m,sound),muffling=clear?1:.55;
    // Sound can cross a ceiling, but it has a finite, muffled audible range.
    return d<(3+sound.strength*23)*profile.hearing*muffling;
  }

  function watchedByPlayer(m,player) {
    if(player.alive===false||distance(m,player)>34||!perceiveSight(player,m))return false;
    const dx=m.x-player.x,dz=m.z-player.z,dy=(m.y||0)+2.2-((player.y||0)+(player.crouching?1.12:1.69));
    const yaw=Number(player.yaw)||0,pitch=Number(player.pitch)||0;
    const forward=-Math.sin(yaw)*dx-Math.cos(yaw)*dz,side=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
    const depth=forward*Math.cos(pitch)+dy*Math.sin(pitch),vertical=dy*Math.cos(pitch)-forward*Math.sin(pitch);
    const verticalHalf=clamp(Number(player.fov)||78,50,110)*Math.PI/360;
    const aspect=clamp(Number(player.aspect)||16/9,.6,2.5);
    return depth>0&&Math.abs(side)<depth*Math.tan(verticalHalf)*aspect&&Math.abs(vertical)<depth*Math.tan(verticalHalf);
  }

  function searchNear(m,dt,r) {
    if(!m.searchGoal||distance(m,m.searchGoal)<.8||m.stuck>.5) {
      m.searchStep++;
      // Harder monsters check more exits around the last sighting, rather than
      // standing there forever or following an unseen target's live position.
      const direction=Math.atan2(m.velocity.x,m.velocity.z),turn=(m.searchStep%2?1:-1)*m.searchStep*1.05;
      let goal=null,bestScore=-Infinity;
      for(let i=0;i<8;i++) {
        const angle=direction+turn+i*.78,radius=1.4+Math.min(4.8,profile.search*.27)+random()*1.2;
        const p={x:m.lastSeen.x+Math.sin(angle)*radius,y:m.lastSeen.y,z:m.lastSeen.z+Math.cos(angle)*radius};
        if(!pointFits(p,r))continue;
        const score=separationScore(m,p,'searchGoal')+random()*2;
        if(score>bestScore){bestScore=score;goal=p;}
      }
      m.searchGoal=goal||{...m.lastSeen};clearRoute(m);
    }
    m.state='search';walkMonster(m,m.searchGoal,2.15*profile.speed,dt,r);
  }

  function investigationPoint(m,r) {
    if(m.investigateGoal)return m.investigateGoal;
    let goal=m.lastSeen,bestScore=-Infinity;
    for(let i=0;i<8;i++) {
      const angle=m.id*2.4+i*Math.PI/4,radius=1.8+(m.id%2)*.7;
      const p={x:m.lastSeen.x+Math.sin(angle)*radius,y:m.lastSeen.y,z:m.lastSeen.z+Math.cos(angle)*radius};
      if(!pointFits(p,r)||!safeSight(m.lastSeen,p))continue;
      const score=separationScore(m,p,'investigateGoal');
      if(score>bestScore){bestScore=score;goal=p;}
    }
    m.investigateGoal={...goal};return m.investigateGoal;
  }

  function updateMonster(m,dt,player) {
    const sizeLimit=monsterScaleLimit(m.type);
    m.scale=Number.isFinite(m.scale)?clamp(m.scale,.1,sizeLimit):sizeLimit;
    m.runSpeed=((m.type==='watcher'?4.55:m.type==='crawler'?4.15:m.type==='stalker'?3.85:3.45)+Math.min(.4,m.kills*.045))*profile.run;
    m.attackCooldown=Math.max(0,m.attackCooldown-dt);m.roarCooldown-=dt;m.lock-=dt;m.memory-=dt;m.roamTimer-=dt;m.senseTimer-=dt;m.watchNotice-=dt;m.moving=false;m.observed=false;
    if(m.stunned>0){if(m.victimId!==null&&m.victimId!=='player')releaseVictim(m);m.stunned=Math.max(0,m.stunned-dt);m.state='stunned';m.target=null;m.memory=0;m.seesTarget=false;return;}
    if(m.feeding>0){updateFeeding(m,dt);return;}
    if(elapsed<1.2){m.state='roam';return;}
    if(!targetValid(m.target,player)){m.target=null;m.seesTarget=false;}
    if(m.memory<=0&&m.target){m.target=null;m.seesTarget=false;clearRoute(m);}
    if(m.senseTimer<=0) {
      m.senseTimer=profile.sense+random()*profile.sense*.45;
      let candidate=null,score=Infinity;m.seesTarget=false;
      const playerRange=profile.sight*(player.crouching?.7:1)+(player.flashlight?3:0);
      if(targetValid(m.target,player)&&distance(m,m.target)<profile.sight+5&&perceiveSight(m,m.target)) {
        candidate=m.target;score=distance(m,m.target)*(m.lock>0?.45:.8);
      }
      if(targetValid(player,player)) {
        const d=distance(m,player),priority=m.type==='watcher'?.15:.86;
        if(d<playerRange&&perceiveSight(m,player)&&d*priority<score){candidate=player;score=d*priority;}
      }
      if(m.type!=='watcher')for(const c of civilians) {
        if(!c.alive||c.grabbed)continue;const d=distance(m,c);
        const range=profile.sight*(c.crouching?.68:1);
        if(d<range&&d<score&&perceiveSight(m,c)){candidate=c;score=d;}
      }
      if(candidate) {
        if(!m.target&&m.roarCooldown<=0&&m.type!=='watcher'){event('roar',m,{id:m.id});m.roarCooldown=11+random()*8;}
        const same=candidate===m.target,interval=elapsed-m.lastSeenTime;
        if(same&&m.lastSeen&&interval>.03&&interval<1.2) {
          const vx=(candidate.x-m.lastSeen.x)/interval,vz=(candidate.z-m.lastSeen.z)/interval,speed=Math.hypot(vx,vz),limit=Math.min(1,7/Math.max(.01,speed));
          m.velocity={x:vx*limit,z:vz*limit};
        } else m.velocity={x:0,z:0};
        if(!same){m.lock=2.5;clearRoute(m);}
        m.target=candidate;m.seesTarget=true;m.lastSeenTime=elapsed;
        remember(m,candidate,profile.memory);
        if(candidate===player&&profile.share)packSighting={...m.lastSeen,vx:m.velocity.x,vz:m.velocity.z,time:elapsed,source:m.id};
      } else {
        // Nearby hunters share only the position and velocity actually seen.
        if(profile.share&&packSighting&&packSighting.source!==m.id&&elapsed-packSighting.time<2.2&&packSighting.time>m.packStamp&&distance(m,packSighting)<profile.share) {
          m.packStamp=packSighting.time;
          const velocity=Math.hypot(packSighting.vx,packSighting.vz),angle=m.id*Math.PI*2/profile.count,offset=3.3;
          const dx=velocity>.2?(-packSighting.vz*Math.cos(angle)+packSighting.vx*Math.sin(angle))/velocity*offset:Math.cos(angle)*offset,dz=velocity>.2?(packSighting.vx*Math.cos(angle)+packSighting.vz*Math.sin(angle))/velocity*offset:Math.sin(angle)*offset;
          const flank={x:packSighting.x+dx,y:packSighting.y,z:packSighting.z+dz};
          remember(m,pointFits(flank)?flank:packSighting,profile.memory*.65);clearRoute(m);
        }
        let bestNoise=null,noiseScore=0;
        for(const sound of noises) {
          if(sound.id<=m.heardNoise||!hear(m,sound))continue;
          const value=sound.strength/(1+distance(m,sound)*.12);
          if(value>noiseScore){bestNoise=sound;noiseScore=value;}
        }
        if(bestNoise){m.heardNoise=bestNoise.id;remember(m,bestNoise,profile.memory*.7);clearRoute(m);}
        if(player.noise>.12&&!player.hiding&&hear(m,{...player,strength:player.noise*.65})) {
          remember(m,player,profile.memory*.55);
        }
      }
    }
    if(m.type==='watcher') {
      m.observed=watchedByPlayer(m,player);
      if(m.observed) {
        m.state='watching';
        if(m.watchNotice<=0){event('watcher',m,{id:m.id,name:'The Still One'});m.watchNotice=14;}
        return;
      }
    }
    const bodyRadius=.52+Math.max(0,Math.min(.25,(m.scale-1)*.16));
    if(m.memory>0&&m.lastSeen) {
      const visible=m.seesTarget&&elapsed-m.lastSeenTime<profile.sense*1.7+.08;
      if(visible){m.state=m.type==='watcher'?'stalk':'hunt';walkMonster(m,predictedPoint(m),m.runSpeed,dt,bodyRadius);}
      else if(distance(m,investigationPoint(m,bodyRadius))>1||heightDifference(m,m.lastSeen)>1.2){m.state='investigate';walkMonster(m,m.investigateGoal,2.45*profile.speed,dt,bodyRadius);}
      else searchNear(m,dt,bodyRadius);
      const reach=.78+m.scale*.34;
      if(m.target&&targetValid(m.target,player)&&distance(m,m.target)<reach&&heightDifference(m,m.target)<1.2&&m.attackCooldown<=0&&perceiveSight(m,m.target)) {
        if(m.target===player) {
          player.health=0;player.alive=false;player.capturedBy=m.id;
          m.state='feeding';m.feeding=4;m.feedDuration=4;m.feedProgress=0;m.victimId='player';
          m.target=null;m.memory=0;clearRoute(m);event('capture',m,{id:m.id});
        } else if(m.target.alive) {
          const victim=m.target;leaveCover(victim);victim.state='flee';victim.grabbed=true;victim.grabbedBy=m.id;victim.panic=1;
          m.victimId=victim.id;m.feedDuration=3.5;m.feeding=3.5;m.feedProgress=0;m.state='feeding';m.attackCooldown=1.6;
          event('grab',m,{victimId:victim.id,id:m.id,duration:3.5});noise(m.x,m.z,.75,m.y||0);
          for(const c of civilians)if(c.alive&&heightDifference(c,m)<1.2&&distance(c,m)<13)scare(c,m);
          m.target=null;m.memory=0;clearRoute(m);
        }
      }
    } else {
      m.seesTarget=false;patrolMonster(m,dt,bodyRadius);
    }
  }

  function update(dt,player) {
    dt=clamp(Number(dt)||0,0,.1);if(!dt||!player)return;
    elapsed+=dt;screamClock-=dt;
    for(let i=noises.length-1;i>=0;i--)if(noises[i].expires<elapsed)noises.splice(i,1);
    for(const c of civilians)updateCivilian(c,dt);
    for(const m of monsters)updateMonster(m,dt,player);
  }

  reset();
  return {civilians,monsters,update,reset,noise,
    setExitOpen(value){exitOpen=!!value;for(const c of civilians)clearRoute(c);},
    get rescued(){return rescued;},get eaten(){return eaten;},get elapsed(){return elapsed;},get difficulty(){return level;},
    get exitOpen(){return exitOpen;},set exitOpen(value){exitOpen=!!value;},
    diagnostics(){return {elapsed,rescued,eaten,difficulty:level,profile:{...profile},walkableCells:walkable.reduce((a,b)=>a+b,0),alive:civilians.filter(c=>c.alive).length};}
  };
}
