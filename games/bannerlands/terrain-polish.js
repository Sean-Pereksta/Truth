import {bridgeCrossings,bridgeSurface} from './bridge-art.js';
// Static terrain accents are painted into the renderer's existing overview and
// terrain-chunk caches. They never change terrain, ownership or the game RNG.
const TERRAIN_POLISH_DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const terrainPolishHash=(x,y,salt=0)=>{
  let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(salt+1,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
};
const terrainPolishAt=(g,x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H?g.tiles[y*g.W+x]:null;
const terrainPolishLand=t=>!!t&&['grass','forest','hill'].includes(t.terrain)&&(!t.feature||t.feature==='road');
const terrainPolishOpenLand=t=>terrainPolishLand(t)&&!t.feature;

const routeWeatherByMap=new WeakMap();
function routeWeather(g){
  const saved=routeWeatherByMap.get(g);
  if(saved?.tiles===g.tiles)return saved;
  const mud=[];
  if(g.landscape?.id==='riverlands'){
    const addBank=(axis,along,across,sign)=>{
      const center=along+sign*.45,radius=2.85;
      const x=axis==='x'?center:across,y=axis==='x'?across:center;
      mud.push({axis,x,y,radius,sign});
    };
    for(const span of bridgeCrossings(g).spans){
      const mid=(span.lo+span.hi)/2;
      addBank(span.axis,span.start,mid,-1);
      addBank(span.axis,span.end,mid,1);
    }
    for(const crossing of g.landmarks||[]){
      if(crossing.kind!=='ford')continue;
      const alongX=crossing.axis==='x',mid=alongX?crossing.y:crossing.x;
      const at=a=>alongX?terrainPolishAt(g,a,Math.floor(mid)):terrainPolishAt(g,Math.floor(mid),a);
      const origin=Math.floor(alongX?crossing.x:crossing.y);
      if(at(origin)?.feature!=='ford')continue;
      for(const sign of [-1,1]){
        let bank=origin;
        while(at(bank)?.feature==='ford')bank+=sign;
        if(terrainPolishLand(at(bank)))addBank(crossing.axis,bank+(sign<0?1:0),mid,sign);
      }
    }
  }
  const weather={tiles:g.tiles,width:g.W,height:g.H,mud};
  routeWeatherByMap.set(g,weather);
  return weather;
}

function climateInRange(height,range){
  return range.y0<height*.36||range.y1>height*.64;
}

function mudInRange(bank,range){
  const {x,y,radius}=bank;
  return x+radius>range.x0&&x-radius<range.x1&&y+radius>range.y0&&y-radius<range.y1;
}

function paintRoadWear(c,weather,range){
  const {tiles,width,height}=weather;
  for(const cold of [true,false]){
    const first=cold?range.y0:Math.max(range.y0,Math.floor(height*.7));
    const limit=cold?Math.min(range.y1,Math.ceil(height*.3)):range.y1;
    if(first>=limit)continue;
    c.fillStyle=cold?'rgba(207,221,220,.38)':'rgba(245,198,127,.37)';
    c.beginPath();
    for(let y=first;y<limit;y++)for(let x=range.x0;x<range.x1;x++){
      const tile=tiles[y*width+x];
      if(tile?.feature!=='road')continue;
      const latitude=(y+.5)/height,exposure=cold?.3-latitude:latitude-.7;
      if(terrainPolishHash(x,y,85)>exposure*2)continue;
      const along=.12+terrainPolishHash(x,y,86)*.62;
      const across=terrainPolishHash(x,y,87)<.5?.16:.79;
      const alongX=tile.featureAxis!=='y',length=cold?.09:.19,depth=cold?.024:.035;
      const px=x+(alongX?along:across),py=y+(alongX?across:along);
      c.rect(px,py,alongX?length:depth,alongX?depth:length);
      c.rect(px+.04,py+.06,depth,depth);
    }
    c.fill();
  }
}

// The road layer clips these washes to the same painted mask as the tracks.
// World coordinates keep the color and puddles continuous at cache boundaries.
function paintRouteWeather(c,weather,range,overview){
  const {x0,y0,x1,y1}=range,{height,mud}=weather;
  if(climateInRange(height,range)){
    const color=c.createLinearGradient(0,0,0,height);
    color.addColorStop(0,'rgba(133,164,186,.51)');
    color.addColorStop(.15,'rgba(145,170,182,.34)');
    color.addColorStop(.36,'rgba(145,170,182,0)');
    color.addColorStop(.64,'rgba(212,160,89,0)');
    color.addColorStop(.85,'rgba(212,160,89,.38)');
    color.addColorStop(1,'rgba(222,170,94,.49)');
    c.fillStyle=color;
    c.fillRect(x0,y0,x1-x0,y1-y0);
    if(!overview)paintRoadWear(c,weather,range);
  }
  for(const bank of mud){
    if(!mudInRange(bank,range))continue;
    const {axis,x,y,radius,sign}=bank;
    const wash=c.createRadialGradient(x,y,0,x,y,radius);
    wash.addColorStop(0,'rgba(63,49,37,.66)');
    wash.addColorStop(.48,'rgba(76,58,42,.45)');
    wash.addColorStop(1,'rgba(93,73,54,0)');
    c.fillStyle=wash;
    c.fillRect(x-radius,y-radius,radius*2,radius*2);
    if(overview)continue;
    const alongX=axis==='x',tilt=alongX?.08:Math.PI/2-.08;
    for(const [along,across,length] of [[.35,-.72,.34],[.94,.68,.24]]){
      const px=x+(alongX?sign*along:across),py=y+(alongX?across:sign*along);
      c.fillStyle='rgba(49,42,34,.57)';
      c.beginPath();c.ellipse(px,py,length+.08,.15,tilt,0,Math.PI*2);c.fill();
      c.fillStyle='rgba(137,159,151,.57)';
      c.beginPath();c.ellipse(px-.014,py-.026,length,.072,tilt,0,Math.PI*2);c.fill();
    }
  }
}

// Roadside field boundaries belong to the map. Their placement must not depend
// on a living faction, a discovered building or any hidden settlement state.
export function roadsideFields(g){
  if(!['riverlands','highlands'].includes(g.landscape?.id))return null;
  const fields=new Uint8Array(g.W*g.H);
  for(let y=2;y+4<g.H;y+=5)for(let x=2;x+5<g.W;x+=6){
    if(terrainPolishHash(x,y,52)<.22)continue;
    let open=true,road=false;
    for(let sy=y-1;sy<=y+3;sy++)for(let sx=x-1;sx<=x+4;sx++){
      const t=terrainPolishAt(g,sx,sy);
      if(sy>=y&&sy<y+3&&sx>=x&&sx<x+4){
        if(!t||t.feature||t.terrain!=='grass')open=false;
      }else if(t?.feature==='road')road=true;
    }
    if(!open||!road)continue;
    for(let dy=0;dy<3;dy++)for(let dx=0;dx<4;dx++){
      fields[(y+dy)*g.W+x+dx]=16|(dy===0?1:0)|(dx===3?2:0)|(dy===2?4:0)|(dx===0?8:0);
    }
  }
  return fields;
}

// Kept separate from painting so callers and checks can inspect eligible edges
// without allocating a canvas. Sides are north, east, south, west.
export function terrainPolishEdges(g,t){
  if(!terrainPolishLand(t))return null;
  const neighbors=TERRAIN_POLISH_DIRECTIONS.map(([dx,dy])=>terrainPolishAt(g,t.x+dx,t.y+dy));
  return {
    road:t.feature==='road',
    shoulders:neighbors.map(n=>terrainPolishLand(n)&&(t.feature==='road')!==(n.feature==='road')),
    forest:neighbors.map(n=>terrainPolishOpenLand(t)&&terrainPolishOpenLand(n)&&(t.terrain==='forest')!==(n.terrain==='forest')),
    shore:neighbors.map(n=>terrainPolishOpenLand(t)&&n?.terrain==='water'&&!n.feature)
  };
}

function terrainPolishBand(c,x,y,side,depth,outer,inner){
  c.save();c.translate(x,y);
  // A common local edge coordinate system keeps the width consistent around
  // bends and caps; every mark stays inside its own tile, including at chunks.
  if(side===1){c.translate(1,0);c.rotate(Math.PI/2);}
  else if(side===2){c.translate(1,1);c.rotate(Math.PI);}
  else if(side===3){c.translate(0,1);c.rotate(-Math.PI/2);}
  const fade=c.createLinearGradient(0,0,0,depth);fade.addColorStop(0,outer);fade.addColorStop(1,inner);
  c.fillStyle=fade;c.fillRect(0,0,1,depth);c.restore();
}

function terrainPolishEdgePoint(x,y,side,along,inset){
  return side===0?[x+along,y+inset]:side===1?[x+1-inset,y+along]:side===2?[x+along,y+1-inset]:[x+inset,y+along];
}

function terrainPolishTuft(c,x,y,shade,height=.065){
  c.strokeStyle=shade;c.lineWidth=.014;c.lineCap='round';
  c.beginPath();c.moveTo(x,y);c.lineTo(x-height*.8,y-height*1.1);
  c.moveTo(x,y);c.lineTo(x-height*.25,y-height*1.45);
  c.moveTo(x,y);c.lineTo(x-height*1.3,y-height*.4);c.stroke();
}

// x1/y1 are exclusive, matching terrainChunk's bake loop. The context must use
// the renderer's normal isometric pixel coordinates (any outer scale/translate
// is preserved). Calling once per baked chunk avoids per-frame full-map scans.
export function paintTerrainPolish(c,g,range={},options={}){
  const x0=Math.max(0,Math.floor(range.x0??0)),y0=Math.max(0,Math.floor(range.y0??0));
  const x1=Math.min(g.W,Math.ceil(range.x1??g.W)),y1=Math.min(g.H,Math.ceil(range.y1??g.H));
  const hw=options.halfWidth??28,hh=options.halfHeight??14,overview=options.detail==='overview';
  const stats={tiles:0,roadEdges:0,forestEdges:0,shoreEdges:0,ruts:0};
  const weather=routeWeather(g),area={x0,y0,x1,y1};
  const weatherRoads=climateInRange(g.H,area)||weather.mud.some(bank=>mudInRange(bank,area))?[]:null;
  c.save();c.transform(hw,hh,-hw,hh,0,0);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const t=terrainPolishAt(g,x,y),edges=terrainPolishEdges(g,t);if(!edges)continue;
    if(edges.road)weatherRoads?.push(x,y);
    stats.tiles++;c.save();c.beginPath();c.rect(x,y,1,1);c.clip();
    // Gentle soil/grass variation breaks identical texture repetition without
    // replacing the painted ground or adding another decorative sprite layer.
    const grain=terrainPolishHash(x,y,19),cx=x+.18+terrainPolishHash(x,y,20)*.64,cy=y+.18+terrainPolishHash(x,y,21)*.64;
    if(!edges.road&&grain>.55){const wash=c.createRadialGradient(cx,cy,0,cx,cy,.62);wash.addColorStop(0,grain>.78?'rgba(187,164,95,.12)':'rgba(38,65,31,.1)');wash.addColorStop(1,'rgba(65,87,43,0)');c.fillStyle=wash;c.fillRect(x,y,1,1);}
    for(let side=0;side<4;side++){
      const salt=side*37;
      if(edges.shoulders[side]){
        stats.roadEdges++;
        terrainPolishBand(c,x,y,side,edges.road?.18:.23,edges.road?'rgba(96,112,54,.58)':'rgba(158,131,83,.38)','rgba(111,117,63,0)');
        // Uneven sandy flecks and tiny grass incursions hide the straight tile
        // outline. All marks are clipped to the eligible land tile.
        for(let k=0;k<(overview?3:6);k++){
          const along=.05+terrainPolishHash(x*7+k,y,salt+1)*.9,inset=.025+terrainPolishHash(x,y*7+k,salt+2)*.16;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset),size=.018+terrainPolishHash(x+k,y,salt+3)*.045;
          c.fillStyle=edges.road?'rgba(112,128,62,.35)':'rgba(178,154,105,.28)';c.beginPath();c.ellipse(px,py,size*1.5,size,0,0,Math.PI*2);c.fill();
          if(!overview&&k%2===0)terrainPolishTuft(c,px,py,edges.road?'rgba(122,142,70,.52)':'rgba(148,161,87,.45)',.045);
        }
      }
      if(edges.forest[side]){
        stats.forestEdges++;const inside=t.terrain==='forest';
        terrainPolishBand(c,x,y,side,.3,inside?'rgba(129,137,72,.3)':'rgba(48,75,37,.29)','rgba(78,102,49,0)');
        for(let k=0;k<(overview?1:4);k++){
          const along=.07+terrainPolishHash(x*5+k,y,salt+8)*.86,inset=.025+terrainPolishHash(x,y*5+k,salt+9)*.24;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset);
          if(overview){c.fillStyle='rgba(57,83,38,.18)';c.beginPath();c.ellipse(px,py,.07,.045,0,0,Math.PI*2);c.fill();}
          else terrainPolishTuft(c,px,py,inside?'rgba(168,163,90,.42)':'rgba(80,111,45,.57)',.055+terrainPolishHash(x+k,y,salt+10)*.05);
        }
      }
      if(edges.shore[side]){
        stats.shoreEdges++;
        terrainPolishBand(c,x,y,side,.24,'rgba(164,151,104,.62)','rgba(123,127,73,0)');
        // Reeds and washed pebbles sit on the land side. Water pixels and
        // bridge/ford/pass decks remain untouched and fully readable.
        for(let k=0;k<(overview?2:5);k++){
          const along=.08+terrainPolishHash(x*7+k,y,salt+14)*.84,inset=.045+terrainPolishHash(x,y*7+k,salt+15)*.13;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset);
          c.fillStyle=k%2?'rgba(184,175,131,.52)':'rgba(104,116,76,.34)';c.beginPath();c.ellipse(px,py,.025,.018,0,0,Math.PI*2);c.fill();
          if(!overview&&k%3===0)terrainPolishTuft(c,px,py,'rgba(116,136,75,.6)',.11);
        }
      }
    }
    if(edges.road&&!overview){
      const axis=t.featureAxis||'x';
      for(const offset of [.31,.69]){
        // Broken, offset wheel impressions complement the underlying track
        // texture without forming another hard seam across every road tile.
        const start=.02+terrainPolishHash(x,y,axis==='x'?31:32)*.16,end=.83+terrainPolishHash(x,y,33)*.15;
        const wobble=(terrainPolishHash(x,y,34)-.5)*.035;c.beginPath();
        if(axis==='y'){c.moveTo(x+offset+wobble,y+start);c.bezierCurveTo(x+offset-.018,y+.35,x+offset+.018,y+.65,x+offset-wobble,y+end);}
        else{c.moveTo(x+start,y+offset+wobble);c.bezierCurveTo(x+.35,y+offset-.018,x+.65,y+offset+.018,x+end,y+offset-wobble);}
        c.strokeStyle='rgba(77,69,45,.16)';c.lineWidth=.024;c.lineCap='round';c.stroke();stats.ruts++;
      }
    }
    c.restore();
  }
  if(weatherRoads?.length){
    c.save();c.beginPath();
    for(let i=0;i<weatherRoads.length;i+=2)c.rect(weatherRoads[i],weatherRoads[i+1],1,1);
    c.clip();
    paintRouteWeather(c,weather,area,overview);
    c.restore();
  }
  c.restore();return stats;
}

// Ground classes come only from the public map. Their blended edges are baked
// into static canvases; every visible surface sample comes from painted art.
const PASTURE=0, WOODLAND=1, SCREE=2, FIELD=3, ROAD=4, PASS=5, BANK=6, SHALLOWS=7, RIVER=8;
const MASK_RESOLUTION=9;
const coverage=(weight,lo,hi)=>{
  const t=Math.min(1,Math.max(0,(weight-lo)/(hi-lo)));
  return Math.round(255*t*t*(3-2*t));
};
const paintCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export function preparePaintedGround(g,renderer){
  const ground=renderer.sliceGround,highland=g.landscape?.id==='highlands';
  if(!ground||(!highland&&g.landscape?.id!=='riverlands'))return null;
  const river=renderer.riverMaterials,lands=renderer.landsGroundFrames;
  const materials=[
    highland?ground.hillPasture:ground.riverPasture,renderer.groundFrames?.forest||ground.riverPasture,
    ground.passGravel,ground.cropland,ground.cartRoad,ground.passGravel,
    river?.bank||lands?.bank||ground.cartRoad,river?.shoal||ground.shallows,
    river?.channel||lands?.water||ground.shallows
  ];
  const ids=new Uint8Array(g.W*g.H);
  for(const tile of g.tiles){
    const i=tile.y*g.W+tile.x;
    const feature=bridgeSurface(g,tile);
    ids[i]=feature==='bridge'?RIVER:feature==='ford'?SHALLOWS:
      feature==='road'?ROAD:feature==='pass'?PASS:tile.terrain==='water'?RIVER:
      tile.terrain==='forest'?WOODLAND:tile.terrain==='mountain'?SCREE:renderer.fieldTiles?.[i]?FIELD:PASTURE;
  }
  return {width:g.W,height:g.H,materials,ids,cartway:renderer.cartway,
    weather:routeWeather(g),
    bridgeApproaches:bridgeApproachProfiles(g,ids),
    approaches:renderer.cartway?straightApproaches(g,ids):[]};
}

// Bridge generation reserves a broad rectangular maneuvering area on each
// bank. Only its travelled center is worn down to dirt. Keep the approach
// continuous into the public road, or taper its end into the meadow.
function bridgeApproachProfiles(g,ids){
  const profiles=new Map();
  for(const span of bridgeCrossings(g).spans){
    const alongX=span.axis==='x',mid=(span.lo+span.hi)/2;
    const tileAt=(a,v)=>terrainPolishAt(g,alongX?a:v,alongX?v:a);
    for(const sign of [-1,1]){
      let center=mid,half=(span.hi-span.lo)/2,opacity=1,tail=0;
      for(let d=0;d<13;d++){
        const a=sign<0?span.wetStart-1-d:span.wetEnd+d;
        let low=Infinity,high=-Infinity,nearest=Infinity;
        if(!tail){
          for(let v=span.lo-3;v<span.hi+3;){
            const start=v;
            while(v<span.hi+3&&tileAt(a,v)?.feature==='road')v++;
            if(v===start){v++;continue;}
            const distance=Math.max(start-center,center-v,0);
            if(distance<nearest){low=start;high=v;nearest=distance;}
          }
        }
        if(nearest>1.5)tail++;
        const target=tail?center:(low+high)/2;
        const nextCenter=center+Math.max(-.45,Math.min(.45,(target-center)*.48));
        const nextHalf=tail?Math.max(.12,half-.17):Math.max(.88,half-.34);
        const nextOpacity=tail?Math.max(0,1-tail/5):1;
        const strip={alongX,sign,a,center,nextCenter,half,nextHalf,opacity,nextOpacity,d,tail};
        for(let v=span.lo-3;v<span.hi+3;v++){
          const t=tileAt(a,v);
          if(t&&ids[t.y*g.W+t.x]<=ROAD)profiles.set(t.y*g.W+t.x,strip);
        }
        if(tail===5)break;
        center=nextCenter;half=nextHalf;opacity=nextOpacity;
      }
    }
  }
  return profiles;
}

function approachCoverage(strip,x,y,original,soil){
  const u=strip.alongX?x:y,v=strip.alongX?y:x;
  const f=strip.sign>0?u-strip.a:strip.a+1-u;
  const center=strip.center+(strip.nextCenter-strip.center)*f;
  const half=strip.half+(strip.nextHalf-strip.half)*f;
  const opacity=strip.opacity+(strip.nextOpacity-strip.opacity)*f;
  const road=coverage(half-Math.abs(v-center),-.16,.13)*opacity*soil;
  const rejoin=strip.tail?0:Math.max(0,Math.min(1,(strip.d+f-9)/4));
  return Math.round(road+(original-road)*rejoin);
}

export function onPaintedApproach(surface,x,y){
  const strip=surface?.bridgeApproaches.get(Math.floor(y)*surface.width+Math.floor(x));
  return strip&&approachCoverage(strip,x,y,0,1)>30;
}

// Painted ruts keep a fixed gauge. Use an authored crossing's bearing and
// centerline only while the road continues straight on either approach. Bends
// and junctions retain the undistorted cart-road material.
function straightApproaches(g,ids){
  const runs=[];
  for(const crossing of g.landmarks||[]){
    if(!['bridge','ford','pass'].includes(crossing.kind)||!['x','y'].includes(crossing.axis))continue;
    const alongX=crossing.axis==='x',along=alongX?crossing.x:crossing.y,cross=alongX?crossing.y:crossing.x;
    const tileAt=(a,v)=>terrainPolishAt(g,alongX?a:v,alongX?v:a);
    const origin=tileAt(Math.floor(along),Math.floor(cross));
    if(crossing.kind==='bridge'&&bridgeSurface(g,origin)!=='bridge')continue;
    for(const sign of [-1,1]){
      let first=null,last=null;
      for(let step=1;step<=16;step++){
        const a=Math.floor(along)+sign*step,center=tileAt(a,Math.floor(cross));
        if(!center)break;
        const material=ids[center.y*g.W+center.x];
        if(first===null&&step<=(crossing.length||5)/2+1&&[RIVER,SHALLOWS,PASS].includes(material))continue;
        if(material!==ROAD||center.featureAxis!==crossing.axis)break;
        // Both wheel ruts must stay on the same straight public road. Interrupt
        // the strip at an intersecting or turning route instead of bending it.
        let straight=true;
        for(const offset of [-1,1]){
          const outside=tileAt(a,Math.floor(cross)+offset);
          if(!outside||ids[outside.y*g.W+outside.x]!==ROAD||outside.featureAxis!==crossing.axis)straight=false;
        }
        if(!straight)break;
        first??=a;last=a;
      }
      if(first!==null&&Math.abs(last-first)>=1)runs.push({alongX,cross,lo:Math.min(first,last),hi:Math.max(first,last)+1});
    }
  }
  return runs;
}

function paintWheelTracks(c,surface,range,scale){
  const f=surface.cartway,repeat=3;
  if(!f)return;
  for(const run of surface.approaches){
    const alongMin=run.alongX?range.x0:range.y0,alongMax=run.alongX?range.x1:range.y1;
    const acrossMin=run.alongX?range.y0:range.x0,acrossMax=run.alongX?range.y1:range.x1;
    if(run.hi<=alongMin||run.lo>=alongMax||run.cross+repeat/2<acrossMin||run.cross-repeat/2>acrossMax)continue;
    c.save();c.scale(scale,scale);c.translate(-range.x0,-range.y0);
    if(run.alongX)c.rotate(-Math.PI/2);
    const left=(run.alongX?-run.cross:run.cross)-repeat/2;
    for(let a=Math.max(run.lo,alongMin);a<Math.min(run.hi,alongMax);a+=.125){
      const fade=Math.min(1,(a+.0625-run.lo)/1.15,(run.hi-a-.0625)/1.15);
      c.globalAlpha=.85*fade;
      c.drawImage(f,0,(a%repeat)/repeat*f.height,f.width,f.height/(repeat*8),
        left,a,repeat,.125);
    }
    c.restore();
  }
}

function materialMasks(surface,x0,y0,x1,y1){
  const {width,height,ids,bridgeApproaches}=surface,res=MASK_RESOLUTION;
  const mw=(x1-x0)*res+2,mh=(y1-y0)*res+2,active=new Set();
  let hasApproach=false;
  for(let y=Math.max(0,y0-1);y<Math.min(height,y1+1);y++)for(let x=Math.max(0,x0-1);x<Math.min(width,x1+1);x++){
    const id=y*width+x;active.add(ids[id]);hasApproach||=bridgeApproaches.has(id);
  }
  if(hasApproach){active.add(ROAD);active.add(PASTURE);}
  if(active.size===1)return {uniform:active.values().next().value,kinds:[]};
  const wet=active.has(RIVER)||active.has(SHALLOWS);
  if(wet){active.add(BANK);active.add(SHALLOWS);}
  active.delete(PASTURE);
  const kinds=[...active].sort((a,b)=>a-b);
  const masks=kinds.map(()=>new Uint8ClampedArray(mw*mh)),weights=new Float32Array(9);
  for(let py=0;py<mh;py++)for(let px=0;px<mw;px++){
    const wx=x0+(px-.5)/res,wy=y0+(py-.5)/res;
    const sx=Math.max(0,Math.min(width-1,wx-.5));
    const sy=Math.max(0,Math.min(height-1,wy-.5));
    const ix=Math.floor(sx),iy=Math.floor(sy),nx=Math.min(ix+1,width-1),ny=Math.min(iy+1,height-1);
    const fx=sx-ix,fy=sy-iy;
    weights.fill(0);
    weights[ids[iy*width+ix]]+=(1-fx)*(1-fy);
    weights[ids[iy*width+nx]]+=fx*(1-fy);
    weights[ids[ny*width+ix]]+=(1-fx)*fy;
    weights[ids[ny*width+nx]]+=fx*fy;
    const water=weights[RIVER]+weights[SHALLOWS],at=py*mw+px;
    const strip=hasApproach&&bridgeApproaches.get(Math.floor(wy)*width+Math.floor(wx));
    for(let k=0;k<kinds.length;k++){
      const kind=kinds[k];
      masks[k][at]=kind===BANK?coverage(water,.34,.43):
        kind===SHALLOWS?coverage(water,.48,.56):
        kind===RIVER?coverage(weights[RIVER],.67,.81):
        kind===ROAD&&strip?approachCoverage(strip,wx,wy,coverage(weights[ROAD],.42,.64),Math.min(1,weights[ROAD]+weights[PASTURE])):
        kind===ROAD||kind===PASS?coverage(weights[kind],.42,.64):
        kind===FIELD?coverage(weights[kind],.44,.59):coverage(weights[kind],.40,.62);
    }
  }
  return {kinds,masks,mw,mh};
}

// Texture coordinates span several cells and use the same origin in every
// chunk and overview. Only masks blend. The painted strokes retain their size
// and color through intersections, shallow banks and forest transitions.
export function bakePaintedGround(ctx,surface,range,overview=false,density=1){
  const {x0,y0,x1,y1}=range,spanX=x1-x0,spanY=y1-y0,scale=overview?9:Math.round(34*density);
  const out=paintCanvas(spanX*scale,spanY*scale),outCtx=out.getContext('2d');
  const {uniform,kinds,masks,mw,mh}=materialMasks(surface,x0,y0,x1,y1);
  function fill(target,kind){
    const frame=surface.materials[kind],repeat=kind===FIELD?4:kind===ROAD?6:kind===RIVER?6:5;
    target.save();
    target.scale(repeat*scale/frame.width,repeat*scale/frame.height);
    const ox=x0*frame.width/repeat,oy=y0*frame.height/repeat;
    target.translate(-ox,-oy);target.fillStyle=target.createPattern(frame,'repeat');
    target.fillRect(ox,oy,spanX*frame.width/repeat,spanY*frame.height/repeat);
    target.restore();
    if(kind!==ROAD)return;
    paintWheelTracks(target,surface,range,scale);
    const weather=surface.weather;
    if(weather&&(climateInRange(weather.height,range)||weather.mud.some(bank=>mudInRange(bank,range)))){
      target.save();target.scale(scale,scale);target.translate(-x0,-y0);
      paintRouteWeather(target,weather,range,overview);
      target.restore();
    }
  }
  fill(outCtx,uniform??PASTURE);
  if(kinds.length){
    const layer=paintCanvas(out.width,out.height),lc=layer.getContext('2d');
    const mask=paintCanvas(mw,mh),mc=mask.getContext('2d'),alpha=mc.createImageData(mw,mh);
    for(let k=0;k<kinds.length;k++){
      const coverage=masks[k];let maximum=0,minimum=255;
      for(let i=0;i<coverage.length;i++){const a=coverage[i];alpha.data[4*i+3]=a;maximum=Math.max(maximum,a);minimum=Math.min(minimum,a);}
      if(!maximum)continue;
      if(minimum===255){fill(outCtx,kinds[k]);continue;}
      mc.putImageData(alpha,0,0);
      lc.clearRect(0,0,layer.width,layer.height);fill(lc,kinds[k]);
      const pad=scale/MASK_RESOLUTION;
      lc.globalCompositeOperation='destination-in';lc.drawImage(mask,-pad,-pad,layer.width+2*pad,layer.height+2*pad);
      lc.globalCompositeOperation='source-over';outCtx.drawImage(layer,0,0);
    }
  }
  ctx.save();ctx.transform(28,14,-28,14,0,0);
  // Fractional overlap covers filtering seams between two independently baked
  // diamonds without displacing any road, bridge or contour.
  ctx.drawImage(out,x0-.012,y0-.012,spanX+.024,spanY+.024);
  ctx.restore();
}
