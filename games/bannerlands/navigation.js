import {isPassableTile, tileTravelCost} from './lands.js';

const SQRT2=Math.SQRT2;
const directions=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,SQRT2],[1,-1,SQRT2],[-1,1,SQRT2],[1,1,SQRT2]];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// A duplicate-entry binary heap keeps both searches allocation-light. Old entries
// are discarded against the current distance when popped.
class MinHeap {
  constructor(){this.ids=[];this.scores=[];this.score=0;}
  get length(){return this.ids.length;}
  push(id,score){
    let i=this.ids.length;this.ids.push(id);this.scores.push(score);
    while(i){const parent=(i-1)>>1;if(this.scores[parent]<=score)break;this.ids[i]=this.ids[parent];this.scores[i]=this.scores[parent];i=parent;}
    this.ids[i]=id;this.scores[i]=score;
  }
  pop(){
    const id=this.ids[0];this.score=this.scores[0];
    const lastId=this.ids.pop(),lastScore=this.scores.pop(),length=this.ids.length;
    if(length){let i=0;while(i*2+1<length){let child=i*2+1;if(child+1<length&&this.scores[child+1]<this.scores[child])child++;if(this.scores[child]>=lastScore)break;this.ids[i]=this.ids[child];this.scores[i]=this.scores[child];i=child;}this.ids[i]=lastId;this.scores[i]=lastScore;}
    return id;
  }
}

/** Static terrain navigation. Call invalidate after editing terrain at runtime. */
export class LandsNavigation {
  constructor(game){
    this.game=game;this.W=game.W;this.H=game.H;this.version=0;
    this.maxFields=64;this.maxRoutes=256;this.fields=new Map();this.routes=new Map();
    this.stats={fieldBuilds:0,routeSearches:0,fieldHits:0};this.invalidate();
  }
  invalidate(){
    this.version++;this.fields.clear();this.routes.clear();this.costs=new Map();
    this.walkable=Uint8Array.from(this.game.tiles,tile=>isPassableTile(tile)?1:0);
  }
  index(point){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return -1;
    const x=Math.floor(point.x),y=Math.floor(point.y);return x<0||y<0||x>=this.W||y>=this.H?-1:y*this.W+x;
  }
  point(index){return {x:index%this.W+.5,y:Math.floor(index/this.W)+.5};}
  kind(kind){return kind==='cavalry'||kind==='siege'?kind:'infantry';}
  costGrid(kind){
    kind=this.kind(kind);if(this.costs.has(kind))return this.costs.get(kind);
    const values=Float32Array.from(this.game.tiles,(tile,i)=>this.walkable[i]?Math.max(.1,tileTravelCost(tile,kind)):Infinity);
    let minimum=Infinity;for(let i=0;i<values.length;i++)if(values[i]<minimum)minimum=values[i];
    const grid={values,minimum};this.costs.set(kind,grid);return grid;
  }
  remember(map,key,value,limit){if(map.has(key))map.delete(key);map.set(key,value);if(map.size>limit)map.delete(map.keys().next().value);return value;}
  nearestPassable(point){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;
    const x=clamp(Math.floor(point.x),0,this.W-1),y=clamp(Math.floor(point.y),0,this.H-1),index=y*this.W+x;
    if(this.walkable[index]&&point.x>=0&&point.y>=0&&point.x<this.W&&point.y<this.H)return {x:point.x,y:point.y};
    // Search complete square rings, choosing the nearest tile on the first
    // intersecting ring. This is used only for blocked command/spawn endpoints.
    for(let radius=1;radius<Math.max(this.W,this.H);radius++){
      let best=-1,bestDistance=Infinity;
      const accept=(xx,yy)=>{if(xx<0||yy<0||xx>=this.W||yy>=this.H)return;const i=yy*this.W+xx;if(!this.walkable[i])return;const distance=(xx+.5-point.x)**2+(yy+.5-point.y)**2;if(distance<bestDistance){best=i;bestDistance=distance;}};
      for(let xx=x-radius;xx<=x+radius;xx++){accept(xx,y-radius);accept(xx,y+radius);}
      for(let yy=y-radius+1;yy<y+radius;yy++){accept(x-radius,yy);accept(x+radius,yy);}
      if(best>=0)return this.point(best);
    }
    return null;
  }
  forNeighbors(index,visit){
    const x=index%this.W,y=Math.floor(index/this.W);
    for(const [dx,dy,length] of directions){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=this.W||yy>=this.H)continue;
      const next=yy*this.W+xx;if(!this.walkable[next])continue;
      if(dx&&dy&&(!this.walkable[y*this.W+xx]||!this.walkable[yy*this.W+x]))continue;
      visit(next,length);
    }
  }
  field(goal,kind){
    const target=this.index(goal);if(target<0||!this.walkable[target])return null;
    kind=this.kind(kind);const key=`${kind}:${target}`;
    if(this.fields.has(key)){this.stats.fieldHits++;return this.remember(this.fields,key,this.fields.get(key),this.maxFields);}
    const {values}=this.costGrid(kind),distance=new Float32Array(this.walkable.length),next=new Int32Array(this.walkable.length),heap=new MinHeap();
    distance.fill(Infinity);next.fill(-1);distance[target]=0;heap.push(target,0);
    while(heap.length){
      const i=heap.pop(),base=distance[i];if(heap.score>base+1e-4)continue;
      this.forNeighbors(i,(neighbor,length)=>{const cost=base+length*(values[i]+values[neighbor])*.5;if(cost<distance[neighbor]-1e-5){distance[neighbor]=cost;next[neighbor]=i;heap.push(neighbor,distance[neighbor]);}});
    }
    this.stats.fieldBuilds++;
    return this.remember(this.fields,key,{distance,next,target,kind},this.maxFields);
  }
  route(from,to,kind='infantry',options={}){
    const origin=this.nearestPassable(from),goal=this.nearestPassable(to),empty={points:[],distance:Infinity,cost:Infinity,reachable:false,crossings:[]};
    if(!origin||!goal)return empty;
    const start=this.index(origin),target=this.index(goal),className=this.kind(kind),key=`${className}:${start}:${target}`;
    let path=this.routes.get(key);
    if(path){this.remember(this.routes,key,path,this.maxRoutes);}else{
      this.stats.routeSearches++;
      const {values,minimum}=this.costGrid(className),distance=new Float32Array(this.walkable.length),previous=new Int32Array(this.walkable.length),heap=new MinHeap();
      distance.fill(Infinity);previous.fill(-1);distance[start]=0;
      const tx=target%this.W,ty=Math.floor(target/this.W),heuristic=i=>{const dx=Math.abs(i%this.W-tx),dy=Math.abs(Math.floor(i/this.W)-ty);return minimum*(Math.max(dx,dy)+(SQRT2-1)*Math.min(dx,dy));};
      heap.push(start,heuristic(start));let found=false,visited=0;
      while(heap.length){
        const i=heap.pop();if(heap.score>distance[i]+heuristic(i)+1e-4)continue;
        if(i===target){found=true;break;}if(++visited>(options.maxVisited||this.walkable.length*2))break;
        this.forNeighbors(i,(neighbor,length)=>{const cost=distance[i]+length*(values[i]+values[neighbor])*.5;if(cost<distance[neighbor]-1e-5){distance[neighbor]=cost;previous[neighbor]=i;heap.push(neighbor,distance[neighbor]+heuristic(neighbor));}});
      }
      if(!found)return empty;
      const indices=[];for(let i=target;i>=0;i=previous[i]){indices.push(i);if(i===start)break;}
      indices.reverse();path={indices,cost:distance[target]};this.remember(this.routes,key,path,this.maxRoutes);
    }
    const points=[origin,...path.indices.slice(1,-1).map(i=>this.point(i)),goal],crossings=[];
    if(start!==target&&path.indices.length===2)points.splice(1,0,this.point(start),this.point(target));
    let distance=0;for(let i=1;i<points.length;i++)distance+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
    for(const index of path.indices){const tile=this.game.tiles[index];if(['bridge','ford','pass'].includes(tile.feature))crossings.push({...this.point(index),kind:tile.feature});}
    const cost=path.cost+(Math.hypot(origin.x-(start%this.W+.5),origin.y-(Math.floor(start/this.W)+.5))+Math.hypot(goal.x-(target%this.W+.5),goal.y-(Math.floor(target/this.W)+.5)))*this.costGrid(className).values[start];
    return {points,distance,cost:start===target?distance*this.costGrid(className).values[start]:cost,reachable:true,crossings,goal};
  }
  isClearPoint(x,y,radius=0){
    const open=(xx,yy)=>{const i=this.index({x:xx,y:yy});return i>=0&&this.walkable[i];};
    if(!open(x,y))return false;if(!radius)return true;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-.707,-.707],[.707,-.707],[-.707,.707],[.707,.707]])if(!open(x+dx*radius,y+dy*radius))return false;
    return true;
  }
  clearSegment(from,to,radius=0){
    const dx=to.x-from.x,dy=to.y-from.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.22));let previous=this.index(from);
    if(previous<0||!this.isClearPoint(from.x,from.y,radius))return false;
    for(let step=1;step<=steps;step++){
      const x=from.x+dx*step/steps,y=from.y+dy*step/steps,index=this.index({x,y});if(!this.isClearPoint(x,y,radius))return false;
      if(index!==previous&&index%this.W!==previous%this.W&&Math.floor(index/this.W)!==Math.floor(previous/this.W)){
        if(!this.walkable[Math.floor(previous/this.W)*this.W+index%this.W]||!this.walkable[Math.floor(index/this.W)*this.W+previous%this.W])return false;
      }
      previous=index;
    }
    return true;
  }
  steer(unit,goal,kind='infantry'){
    const destination=this.nearestPassable(goal);if(!destination)return {x:unit.x,y:unit.y,blocked:true};
    const originIndex=this.index(unit);if(originIndex<0||!this.walkable[originIndex])return this.nearestPassable(unit)||{x:unit.x,y:unit.y,blocked:true};
    const distance=Math.hypot(destination.x-unit.x,destination.y-unit.y),order=unit.order,radius=unit.radius||.1;
    const followsOrder=order&&Number.isFinite(order.groupX)&&Number.isFinite(order.groupY)&&Math.hypot(goal.x-order.x,goal.y-order.y)<.2;
    // Nearby pursuits and the final formation alignment should stay responsive.
    if(distance<8&&this.clearSegment(unit,destination,radius))return destination;
    let shared=destination;
    if(followsOrder){
      if(Math.hypot(unit.x-order.groupX,unit.y-order.groupY)>3)shared=this.nearestPassable({x:order.groupX,y:order.groupY})||destination;
      else if(this.clearSegment(unit,destination,radius))return destination;
    }
    const field=this.field(shared,kind);if(!field||!Number.isFinite(field.distance[originIndex]))return {x:unit.x,y:unit.y,blocked:true};
    if(originIndex===field.target){if(this.clearSegment(unit,destination,radius))return destination;return this.point(originIndex);}
    const next=field.next[originIndex];if(next<0)return {x:unit.x,y:unit.y,blocked:true};
    let point=this.point(next);
    // Follow tile centers through bends; a short safe look-ahead avoids sawtooth
    // marching along straight roads without skipping their terrain cost.
    if(!this.clearSegment(unit,point,radius))return this.point(originIndex);
    let cursor=next;
    for(let i=0;i<2;i++){
      const after=field.next[cursor];if(after<0)break;const candidate=this.point(after),tile=this.game.tiles[after],current=this.game.tiles[next];
      if(tile.feature!==current.feature||tile.terrain!==current.terrain||!this.clearSegment(unit,candidate,radius))break;
      point=candidate;cursor=after;
    }
    // Wide crossings are traffic lanes, not a single waypoint. Preserve the
    // soldier's lateral position across the deck/pass while the flow advances
    // longitudinally; local separation can then use the full crossing width.
    const crossing=this.game.tiles[originIndex].feature?this.game.tiles[originIndex]:this.game.tiles[next];
    if(['bridge','ford','pass'].includes(crossing.feature)){
      const axis=crossing.featureAxis,lane=axis==='x'?{x:point.x,y:unit.y}:axis==='y'?{x:unit.x,y:point.y}:null;
      if(lane&&Math.hypot(lane.x-unit.x,lane.y-unit.y)>.1&&this.clearSegment(unit,lane,radius))point=lane;
    }
    if(cursor===field.target&&shared===destination&&this.clearSegment(unit,destination,radius))return destination;
    return point;
  }
  /** Returns true when any part of the attempted displacement hit solid terrain. */
  constrain(unit,oldX,oldY){
    if(!Number.isFinite(unit.x)||!Number.isFinite(unit.y)){unit.x=oldX;unit.y=oldY;return true;}
    const start={x:oldX,y:oldY};
    if(!this.isClearPoint(oldX,oldY)){
      const rescued=this.nearestPassable(start);if(rescued){unit.x=rescued.x;unit.y=rescued.y;}return true;
    }
    const dx=unit.x-oldX,dy=unit.y-oldY,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.18)),stepX=dx/steps,stepY=dy/steps;
    // Unit data does not duplicate definition radii. A small navigation margin
    // keeps every class on the deck; troop spacing remains the combat engine's job.
    const radius=unit.radius||.1;
    if(!this.isClearPoint(oldX,oldY,radius)){const center=this.point(this.index(start));unit.x=center.x;unit.y=center.y;return true;}
    let x=oldX,y=oldY,blocked=false;
    for(let i=0;i<steps;i++){
      const next={x:x+stepX,y:y+stepY};
      if(this.clearSegment({x,y},next,radius)){x=next.x;y=next.y;continue;}
      blocked=true;
      if(this.clearSegment({x,y},{x:x+stepX,y},radius))x+=stepX;
      if(this.clearSegment({x,y},{x,y:y+stepY},radius))y+=stepY;
    }
    unit.x=x;unit.y=y;return blocked;
  }
}
