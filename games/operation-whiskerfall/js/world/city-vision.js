/* Ground-level masonry and door openings share one ray calculation with flashlight cones. */
(function(){
  'use strict';
  const W=window.OW;
  const grids=new WeakMap(),patrols=new WeakMap(),cones=new WeakMap(),size=192,epsilon=1e-7;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const point=p=>Array.isArray(p)?{x:p[0],y:p[1]}:p;
  function nearby(area,origin,radius){
    if(!area)return [];
    const source=area.sightBlocks||area.cover||[];
    let grid=grids.get(area);
    if(!grid||grid.source!==source||grid.count!==source.length){
      grid={source,count:source.length,buckets:new Map(),neighbors:new Map()};grids.set(area,grid);
      for(const b of source){
        if(!(b.w>0&&b.h>0))continue;
        for(let x=Math.floor(b.x/size);x<=Math.floor((b.x+b.w)/size);x++)for(let y=Math.floor(b.y/size);y<=Math.floor((b.y+b.h)/size);y++){
          const key=x+','+y,bucket=grid.buckets.get(key);
          if(bucket)bucket.push(b);else grid.buckets.set(key,[b]);
        }
      }
    }
    const ix=Math.floor(origin.x/size),iy=Math.floor(origin.y/size),r=Math.ceil(radius/size),key=ix+','+iy+','+r;
    if(!grid.neighbors.has(key)){
      const result=new Set();
      for(let x=ix-r;x<=ix+r;x++)for(let y=iy-r;y<=iy+r;y++)for(const b of grid.buckets.get(x+','+y)||[])result.add(b);
      grid.neighbors.set(key,[...result]);
    }
    return grid.neighbors.get(key);
  }
  function ray(origin,dx,dy,blocks,range){
    let nearest=range;
    for(const b of blocks){
      if(b.open||b.enabled===false)continue;
      const x0=b.x-origin.x,x1=x0+b.w,y0=b.y-origin.y,y1=y0+b.h;
      // Reject a parallel ray outside the slab. A beam grazing the face remains on the street.
      if(Math.abs(dx)<epsilon&&(x0>=0||x1<=0)||Math.abs(dy)<epsilon&&(y0>=0||y1<=0))continue;
      let left=-Infinity,right=Infinity,top=-Infinity,bottom=Infinity;
      if(Math.abs(dx)>=epsilon){left=x0/dx;right=x1/dx;if(left>right)[left,right]=[right,left];}
      if(Math.abs(dy)>=epsilon){top=y0/dy;bottom=y1/dy;if(top>bottom)[top,bottom]=[bottom,top];}
      const enter=Math.max(left,top,0),leave=Math.min(right,bottom);
      if(leave>enter+epsilon&&enter<nearest)nearest=enter;
    }
    return nearest;
  }
  function limit(origin,angle,blocks,range){return ray(origin,Math.cos(angle),Math.sin(angle),blocks,range);}
  function contour(origin,bearing,angle,range,blocks){
    const fixed=!blocks.some(b=>b.open!=null||b.enabled!=null),cached=fixed&&cones.get(origin);
    if(cached&&cached.x===origin.x&&cached.y===origin.y&&cached.bearing===bearing&&cached.blocks===blocks&&cached.angle===angle&&cached.range===range)return cached.points;
    const near=blocks.filter(b=>{
      if(b.open||b.enabled===false)return false;
      const dx=Math.max(b.x-origin.x,0,origin.x-b.x-b.w),dy=Math.max(b.y-origin.y,0,origin.y-b.y-b.h);
      return dx*dx+dy*dy<range*range;
    });
    // Include both sides of every silhouette corner. Thin pillars and the door between
    // two pieces then cast exactly the shadow used by the per-hero line of sight.
    const offsets=new Set();for(let i=0;i<=18;i++)offsets.add(-angle+2*angle*i/18);
    for(const b of near)for(const x of [b.x,b.x+b.w])for(const y of [b.y,b.y+b.h]){
      const a=wrap(Math.atan2(y-origin.y,x-origin.x)-bearing);
      if(Math.abs(a)<angle-.0004){offsets.add(a-.0003);offsets.add(a);offsets.add(a+.0003);}
    }
    const points=[...offsets].sort((a,b)=>a-b).map(off=>{
      const a=off+bearing,dx=Math.cos(a),dy=Math.sin(a),length=ray(origin,dx,dy,near,range);
      return {x:origin.x+dx*length,y:origin.y+dy*length};
    });
    if(fixed)cones.set(origin,{x:origin.x,y:origin.y,bearing,angle,range,blocks,points});
    return points;
  }
  function face(e,a,dt,speed){
    const error=wrap(a-(e.watchBearing??e.angle??0));
    e.watchBearing=wrap((e.watchBearing??e.angle??0)+Math.sign(error)*Math.min(Math.abs(error),speed*dt));
    e.angle=e.watchBearing;
    return Math.abs(error);
  }
  function stand(e,anim){e.velocityX=0;e.velocityY=0;e.anim=anim;}
  function patrol(g,e,dt,approach){
    const path=e.watchPath;
    if(!Array.isArray(path)||path.length<2)return false;
    let s=patrols.get(e);
    if(!s||s.path!==path){
      let closest=0,best=Infinity;
      for(const [i,raw] of path.entries()){const p=point(raw),d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){closest=i;best=d;}}
      s={path,index:closest,direction:closest===path.length-1?-1:1,pause:0};patrols.set(e,s);
    }
    let target=point(path[s.index]);
    if(Math.hypot(e.x-target.x,e.y-target.y)<15){
      if(s.index===0)s.direction=1;else if(s.index===path.length-1)s.direction=-1;
      s.index+=s.direction;target=point(path[s.index]);s.pause=.52;
    }
    const heading=Math.atan2(target.y-e.y,target.x-e.x),scan=Math.sin(g.time*.8+(e.watchPhase||0))*.23;
    const error=face(e,heading+scan,dt,s.pause>0?2.15:1.45);
    if(s.pause>0||error>1){s.pause=Math.max(0,s.pause-dt);stand(e,'idle');}
    else approach(g,e,target,42,dt);
    return true;
  }
  W.CityVision={nearby,limit,contour,face,stand,patrol};
}());
