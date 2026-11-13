// Static terrain queries for direct fire. Open corridors use four prefix reads;
// only rays near mountains need exact grid traversal, and those are bounded.
export class CombatTerrain {
  constructor(game,{maxRays=8192}={}){
    this.game=game;this.version=-1;this.tiles=null;this.maxRays=Math.min(16384,Math.max(16,Number.isFinite(maxRays)?Math.floor(maxRays):8192));this.rays=new Map();
    this.stats={queries:0,fastClear:0,raycasts:0,cacheHits:0,cellChecks:0,rebuilds:0};
  }
  invalidate(){this.version=-1;this.tiles=null;this.rays.clear();}
  sync(){
    const game=this.game,version=game.navigation?.version??0;
    if(this.version===version&&this.tiles===game.tiles&&this.W===game.W&&this.H===game.H)return;
    this.version=version;this.tiles=game.tiles;this.W=game.W;this.H=game.H;this.rays.clear();this.stats.rebuilds++;
    this.blocked=Uint8Array.from(game.tiles,tile=>tile.terrain==='mountain'&&tile.feature!=='pass'?1:0);
    const stride=this.W+1;this.stride=stride;this.prefix=new Uint32Array(stride*(this.H+1));
    for(let y=0;y<this.H;y++){let row=0;for(let x=0;x<this.W;x++){row+=this.blocked[y*this.W+x];this.prefix[(y+1)*stride+x+1]=this.prefix[y*stride+x+1]+row;}}
  }
  valid(point){return !!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.y>=0&&point.x<this.game.W&&point.y<this.game.H;}
  solid(x,y){this.stats.cellChecks++;return x>=0&&y>=0&&x<this.W&&y<this.H&&!!this.blocked[y*this.W+x];}
  canShoot(source,target,arcing=false){
    this.stats.queries++;
    if(!this.valid(source)||!this.valid(target))return false;
    if(arcing)return true;
    this.sync();
    let sx=source.x,sy=source.y,tx=target.x,ty=target.y;
    // A canonical ray shares cached results in both directions without rounding
    // troop positions toward a mountain edge or aiming from tile centers.
    if(sx>tx||sx===tx&&sy>ty){[sx,tx]=[tx,sx];[sy,ty]=[ty,sy];}
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.floor(tx),y1=Math.floor(ty),left=Math.min(x0,x1),right=Math.max(x0,x1),top=Math.min(y0,y1),bottom=Math.max(y0,y1),p=this.prefix,s=this.stride;
    // Include the other side of an exact grid boundary: touching the corner of
    // a solid mountain cannot become an invisible firing slit.
    const verticalBoundary=sx===tx&&sx===Math.floor(sx),horizontalBoundary=sy===ty&&sy===Math.floor(sy);
    const minX=verticalBoundary?Math.max(0,left-1):left,minY=horizontalBoundary?Math.max(0,top-1):top;
    if(p[(bottom+1)*s+right+1]-p[minY*s+right+1]-p[(bottom+1)*s+minX]+p[minY*s+minX]===0){this.stats.fastClear++;return true;}
    const key=sx+','+sy+':'+tx+','+ty,cached=this.rays.get(key);
    if(cached!==undefined){this.stats.cacheHits++;return cached;}
    this.stats.raycasts++;
    const visible=this.trace(sx,sy,tx,ty,verticalBoundary,horizontalBoundary);
    if(this.rays.size>=this.maxRays)this.rays.delete(this.rays.keys().next().value);
    this.rays.set(key,visible);return visible;
  }
  trace(sx,sy,tx,ty,verticalBoundary,horizontalBoundary){
    let x=Math.floor(sx),y=Math.floor(sy);const endX=Math.floor(tx),endY=Math.floor(ty),dx=tx-sx,dy=ty-sy,stepX=Math.sign(dx),stepY=Math.sign(dy),deltaX=stepX?1/Math.abs(dx):Infinity,deltaY=stepY?1/Math.abs(dy):Infinity;
    let nextX=stepX>0?(x+1-sx)*deltaX:stepX<0?(sx-x)*deltaX:Infinity,nextY=stepY>0?(y+1-sy)*deltaY:stepY<0?(sy-y)*deltaY:Infinity;
    const obstructed=(xx,yy)=>this.solid(xx,yy)||verticalBoundary&&this.solid(xx-1,yy)||horizontalBoundary&&this.solid(xx,yy-1);
    if(obstructed(x,y))return false;
    // Each step crosses at least one grid line, so even a realm-wide query is
    // bounded by map dimensions rather than sampling distance or unit count.
    for(let steps=0;steps<this.W+this.H+2;steps++){
      if(x===endX&&y===endY)return true;
      if(Math.abs(nextX-nextY)<1e-10){
        if(obstructed(x+stepX,y)||obstructed(x,y+stepY))return false;
        x+=stepX;y+=stepY;nextX+=deltaX;nextY+=deltaY;
      }else if(nextX<nextY){x+=stepX;nextX+=deltaX;}
      else{y+=stepY;nextY+=deltaY;}
      if(obstructed(x,y))return false;
    }
    return false;
  }
  hillRange(source,kind){return kind==='archer'&&this.game.tileAt(source.x,source.y)?.terrain==='hill'?.6:0;}
  coverMultiplier(target,projectileType){return (projectileType==='arrow'||projectileType==='bolt'||projectileType==='axe')&&this.game.tileAt(target.x,target.y)?.terrain==='forest'?.75:1;}
}
