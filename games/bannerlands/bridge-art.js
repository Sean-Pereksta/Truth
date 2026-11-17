import {queueArtwork} from './asset-loader.js';
// Painted bridge sides are cosmetic and baked into the renderer's static
// bridge-chunk cache. The lane deck, navigation and bridge tiles stay unchanged.
const bridgeArtPoint=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const bridgeArtAt=(g,x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H?g.tiles[y*g.W+x]:null;
const bridgeArtTile=(g,x,y)=>bridgeArtAt(g,x,y)?.feature==='bridge';
const bridgeArtAxis=t=>t?.featureAxis==='y'?'y':'x';
const crossingPlans=new WeakMap();
const openWater=t=>t?.terrain==='water'&&!t.feature;
const approach=t=>!!t&&t.terrain!=='water'&&t.terrain!=='mountain';
const bridgeCoords=(axis,along,across)=>axis==='x'?{x:along,y:across}:{x:across,y:along};

// River generation can leave a bridge tag at a ford confluence or on an
// isolated piece of passable ground. Look at both banks AND both water exits.
// The classification belongs to the renderer and never edits a gameplay tile.
export function bridgeCrossings(g){
  const saved=crossingPlans.get(g);if(saved?.tiles===g.tiles)return saved;
  const classes=new Uint8Array(g.W*g.H),visited=new Uint8Array(classes.length),spanTiles=new Int16Array(classes.length),spans=[];
  for(let id=0;id<g.tiles.length;id++){
    const tile=g.tiles[id];if(visited[id]||tile.feature!=='bridge')continue;
    const axis=bridgeArtAxis(tile),members=[id],lanes=new Map();
    const at=(u,v)=>axis==='x'?bridgeArtAt(g,u,v):bridgeArtAt(g,v,u);
    let ford=false,lo=Infinity,hi=-Infinity,first=Infinity,last=-Infinity;
    visited[id]=1;
    for(let n=0;n<members.length;n++){
      const t=g.tiles[members[n]],u=axis==='x'?t.x:t.y,v=axis==='x'?t.y:t.x;
      first=Math.min(first,u);last=Math.max(last,u+1);lo=Math.min(lo,v);hi=Math.max(hi,v+1);
      let lane=lanes.get(v);if(!lane)lanes.set(v,lane={start:u,end:u+1});lane.start=Math.min(lane.start,u);lane.end=Math.max(lane.end,u+1);
      for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
        const next=bridgeArtAt(g,t.x+dx,t.y+dy);if(!next)continue;
        if(next.feature==='ford')ford=true;
        if(next.feature==='bridge'&&bridgeArtAxis(next)===axis){
          const j=next.y*g.W+next.x;if(!visited[j]){visited[j]=1;members.push(j);}
        }
      }
    }
    // Only water on the two OUTER sides counts. At a meandering bank an
    // interior notch must not promote a road or ford into a second bridge.
    let west=false,east=false;
    for(const j of members){const t=g.tiles[j],u=axis==='x'?t.x:t.y,v=axis==='x'?t.y:t.x;
      if(v===lo&&openWater(at(u,lo-1)))west=true;
      if(v===hi-1&&openWater(at(u,hi)))east=true;
    }
    let banks=true,rectangle=true;
    for(const [v,lane] of lanes){
      if(!approach(at(lane.start-1,v))||!approach(at(lane.end,v)))banks=false;
      for(let u=first;u<last;u++)if(at(u,v)?.feature!=='bridge'&&!approach(at(u,v)))rectangle=false;
    }
    const real=west&&east&&banks&&rectangle&&members.some(j=>g.tiles[j].terrain==='water');
    for(const j of members)classes[j]=real?1:ford?3:2;
    if(!real)continue;
    // Span the stepped shoreline as one structure; extend each approach only
    // onto verified dry tiles so the ramps reach the existing road network.
    const dryColumn=u=>{for(let v=lo;v<hi;v++)if(!approach(at(u,v)))return false;return true;};
    let start=first,end=last;
    for(let k=1;k<=2&&dryColumn(first-k);k++)start=first-k+.15;
    for(let k=1;k<=2&&dryColumn(last+k-1);k++)end=last+k-.15;
    let safeStart=first,safeEnd=last;
    while(safeStart>first-10&&dryColumn(safeStart-1))safeStart--;
    while(safeEnd<last+10&&dryColumn(safeEnd))safeEnd++;
    const a=bridgeCoords(axis,start,lo),b=bridgeCoords(axis,end,hi);
    spans.push({axis,start,end,lo,hi,wetStart:first,wetEnd:last,safeStart,safeEnd,x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)});
    for(let u=Math.floor(start);u<Math.ceil(end);u++)for(let v=lo;v<hi;v++){
      const p=bridgeCoords(axis,u,v);spanTiles[p.y*g.W+p.x]=spans.length;
    }
  }
  const plan={tiles:g.tiles,classes,spanTiles,spans};crossingPlans.set(g,plan);return plan;
}
export function bridgeSurface(g,t){
  if(t?.feature!=='bridge')return t?.feature;
  return ['road','bridge','road','ford'][bridgeCrossings(g).classes[t.y*g.W+t.x]];
}
const bridgeArtSides={
  north:{axis:'x',outside:[0,-1],start:[0,0],end:[1,0],front:false},
  south:{axis:'x',outside:[0,1],start:[0,1],end:[1,1],front:true},
  west:{axis:'y',outside:[-1,0],start:[0,0],end:[0,1],front:true},
  east:{axis:'y',outside:[1,0],start:[1,0],end:[1,1],front:false}
};
function bridgeArtEdge(g,x,y,side){
  const info=bridgeArtSides[side],tile=bridgeArtAt(g,x,y);
  return tile?.feature==='bridge'&&bridgeArtAxis(tile)===info.axis&&!bridgeArtTile(g,x+info.outside[0],y+info.outside[1]);
}

// Inclusive range matches Renderer.paintBridgeArchitecture. Runs are measured
// beyond that range so arches and end posts remain aligned at cache boundaries.
export function bridgeSideSegments(g,range={}){
  const x0=Math.max(0,Math.floor(range.x0??0)),y0=Math.max(0,Math.floor(range.y0??0));
  const x1=Math.min(g.W-1,Math.floor(range.x1??g.W-1)),y1=Math.min(g.H-1,Math.floor(range.y1??g.H-1));
  const runs=new Map(),segments=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(!bridgeArtTile(g,x,y))continue;
    const axis=bridgeArtAxis(bridgeArtAt(g,x,y));
    for(const side of axis==='x'?['north','south']:['west','east']){
      if(!bridgeArtEdge(g,x,y,side))continue;
      const info=bridgeArtSides[side],stepX=axis==='x'?1:0,stepY=axis==='y'?1:0,key=`${side}:${x}:${y}`;
      let run=runs.get(key);
      if(!run){
        let sx=x,sy=y,ex=x,ey=y;
        while(bridgeArtEdge(g,sx-stepX,sy-stepY,side)){sx-=stepX;sy-=stepY;}
        while(bridgeArtEdge(g,ex+stepX,ey+stepY,side)){ex+=stepX;ey+=stepY;}
        run={x:sx,y:sy,length:axis==='x'?ex-sx+1:ey-sy+1,startIsEnd:!bridgeArtTile(g,sx-stepX,sy-stepY),endIsEnd:!bridgeArtTile(g,ex+stepX,ey+stepY)};
        for(let k=0;k<run.length;k++)runs.set(`${side}:${sx+k*stepX}:${sy+k*stepY}`,run);
      }
      const offset=axis==='x'?x-run.x:y-run.y;
      const a={x:x+info.start[0],y:y+info.start[1]},b={x:x+info.end[0],y:y+info.end[1]};
      segments.push({x,y,side,axis,front:info.front,a,b,run,offset});
    }
  }
  return segments;
}

function bridgeArtPostInfo(g,vx,vy){
  let owner=Infinity,front=false,end=false,foreground=false;
  for(let y=vy-1;y<=vy;y++)for(let x=vx-1;x<=vx;x++){
    if(!bridgeArtTile(g,x,y))continue;
    const axis=bridgeArtAxis(bridgeArtAt(g,x,y)),sx=axis==='x'?1:0,sy=axis==='y'?1:0;
    for(const side of axis==='x'?['north','south']:['west','east']){
      if(!bridgeArtEdge(g,x,y,side))continue;const info=bridgeArtSides[side];
      const atStart=x+info.start[0]===vx&&y+info.start[1]===vy,atEnd=x+info.end[0]===vx&&y+info.end[1]===vy;
      const start=atStart&&!bridgeArtEdge(g,x-sx,y-sy,side),finish=atEnd&&!bridgeArtEdge(g,x+sx,y+sy,side);
      if(start||finish){owner=Math.min(owner,y*g.W+x);front||=info.front;end||=start&&!bridgeArtTile(g,x-sx,y-sy)||finish&&!bridgeArtTile(g,x+sx,y+sy);foreground||=info.front&&finish&&!bridgeArtTile(g,x+sx,y+sy);}
    }
  }
  return {owner,front,end,foreground};
}

function bridgeArtFrame(image,col,row,label){
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const x0=Math.floor(col*width/2),y0=Math.floor(row*height/2),w=Math.floor((col+1)*width/2)-x0,h=Math.floor((row+1)*height/2)-y0;
  const cell=document.createElement('canvas');cell.width=w;cell.height=h;const ctx=cell.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,x0,y0,w,h,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),data=pixels.data;let left=w,top=h,right=-1,bottom=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const index=(y*w+x)*4+3,a=data[index];if(a<40){data[index]=0;continue;}if(a>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(right<left||right-left<8||bottom-top<8)throw new Error('Missing or empty bridge artwork: '+label);
  ctx.putImageData(pixels,0,0);
  const sprite=document.createElement('canvas');sprite.width=right-left+1;sprite.height=bottom-top+1;const out=sprite.getContext('2d');out.drawImage(cell,left,top,sprite.width,sprite.height,0,0,sprite.width,sprite.height);
  return {image:sprite,width:sprite.width,height:sprite.height};
}

// Registration uses pixels in the two complete paintings. Rails, arches, piers,
// cobbles and ramps share one scale. The Y crossing mirrors the whole painting.
// Horizontal and vertical scales are always identical.
const bridgePlates={
  broad:{w:1080,h:720,widthRun:286,lengthRun:788,anchorX:542,anchorY:356,rise:22,
    lip:[[15,238],[65,222],[98,210],[119,220],[121,233],[340,317],[376,326],[492,372],[598,426],[666,465],[695,467],[723,481],[724,504],[812,568]]},
  narrow:{w:900,h:450,widthRun:153,lengthRun:746,anchorX:452,anchorY:211,rise:51,
    lip:[[1,84],[54,77],[121,98],[219,114],[337,150],[431,183],[536,229],[612,278],[659,305],[674,313],[680,345],[758,397]],
    joint:{near:[337,151],far:[490,123],dx:273,dy:134}}
};
const spanCrown=(span,u)=>Math.max(0,4*u*(1-u))*span.lift;
function nativeLayers(image,plate){
  const canvas=()=>{const c=document.createElement('canvas');c.width=plate.w;c.height=plate.h;return c;};
  const front=canvas(),fc=front.getContext('2d',{willReadFrequently:true});fc.drawImage(image,0,0,plate.w,plate.h);
  const data=fc.getImageData(0,0,plate.w,plate.h),line=plate.lip;
  for(let x=0,i=0;x<plate.w;x++){
    while(i<line.length-2&&x>=line[i+1][0])i++;
    const [ax,ay]=line[i],[bx,by]=line[i+1],cut=x<line[0][0]||x>line.at(-1)[0]?plate.h:ay+(by-ay)*(x-ax)/(bx-ax);
    for(let y=0;y<cut;y++)data.data[(y*plate.w+x)*4+3]=0;
  }
  fc.putImageData(data,0,0);return {image,front,plate,canvas};
}
function cutBays(art){
  if(art.bays)return art.bays;
  const {plate,canvas}=art,{near,far,dx,dy}=plate.joint;
  const after=(x,y)=>x>=far[0]||x>=near[0]&&y>=near[1]+(far[1]-near[1])*(x-near[0])/(far[0]-near[0]);
  const split=source=>{
    const base=canvas(),bc=base.getContext('2d',{willReadFrequently:true});bc.drawImage(source,0,0,plate.w,plate.h);
    const original=bc.getImageData(0,0,plate.w,plate.h);
    return [0,1,2].map(part=>{
      const c=canvas(),ctx=c.getContext('2d'),out=ctx.createImageData(plate.w,plate.h);out.data.set(original.data);
      for(let y=0;y<plate.h;y++)for(let x=0;x<plate.w;x++){
        const owner=!after(x,y)?0:after(x-dx,y-dy)?2:1;if(owner!==part)out.data[(y*plate.w+x)*4+3]=0;
      }
      ctx.putImageData(out,0,0);return c;
    });
  };
  return art.bays={whole:split(art.image),front:split(art.front)};
}
function registerSpan(s,artwork){
  const width=s.hi-s.lo,wet=s.wetEnd-s.wetStart;
  let best=null;
  for(const art of artwork){
    if(!art)continue;
    const p=art.plate,scale=width*28/p.widthRun;
    // Repeat complete, rigid center bays only on long lake causeways. Both
    // cuts run through solid piers; bank aprons appear only at the two ends.
    const count=p.joint?Math.max(0,Math.ceil(((wet+.75)*28/scale-p.lengthRun)/p.joint.dx)):0;
    const dx=(p.joint?.dx||0)*count,dy=(p.joint?.dy||0)*count;
    const length=(p.lengthRun+dx)*scale/28;
    if(length<wet+.20)continue;
    const score=Math.abs(length-(s.end-s.start))+.5*count;
    if(!best||score<best.score)best={art,scale,count,dx,dy,length,score};
  }
  if(!best)return null;
  const roomStart=Math.max(s.safeStart,s.wetEnd+.1-best.length),roomEnd=Math.min(s.wetStart-.1,s.safeEnd-best.length);
  const centered=(s.wetStart+s.wetEnd-best.length)/2;
  const start=roomStart<=roomEnd?Math.max(roomStart,Math.min(roomEnd,centered)):centered,end=start+best.length;
  const a=bridgeCoords(s.axis,start,s.lo),b=bridgeCoords(s.axis,end,s.hi);
  return {...s,...best,start,end,lift:best.art.plate.rise*best.scale,
    x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)};
}
// A bank sits in front of any masonry below its ground plane. Sample the four
// surrounding terrain centers, using the same waterline as the ground painter.
// Only coverage changes. The original stone faces keep their pixel positions.
function buryAbutments(g,span,whole,front,left,top,density){
  const c=whole.getContext('2d'),fc=front.getContext('2d'),w=whole.width,h=whole.height;
  const all=c.getImageData(0,0,w,h),near=fc.getImageData(0,0,w,h);
  const wet=(x,y)=>{const t=bridgeArtAt(g,x,y);return t&&(t.terrain==='water'||t.feature==='ford'||t.feature==='bridge'&&bridgeSurface(g,t)==='bridge')?1:0;};
  for(let i=0;i<w;i++){
    const sx=left+(i+.5)/density,grade=span.hi*28+(span.axis==='x'?sx:-sx)*.5;
    for(let j=Math.max(0,Math.floor((grade-top)*density));j<h;j++){
      const k=4*(j*w+i)+3;if(!all.data[k])continue;
      const sy=top+(j+.5)/density,x=sx/56+sy/28-.5,y=sy/28-sx/56-.5;
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      const water=(wet(ix,iy)*(1-fx)+wet(ix+1,iy)*fx)*(1-fy)+(wet(ix,iy+1)*(1-fx)+wet(ix+1,iy+1)*fx)*fy;
      const shore=Math.max(0,Math.min(1,(water-.35)/.10)),buried=Math.max(0,Math.min(1,(sy-grade)*density));
      const coverage=1-buried*(1-shore);all.data[k]*=coverage;near.data[k]*=coverage;
    }
  }
  c.putImageData(all,0,0);fc.putImageData(near,0,0);
}
function bakeSpan(g,span){
  const {art,scale:worldScale,count,dx,dy}=span,p=art.plate,mirrored=span.axis==='y';
  const center=bridgeCoords(span.axis,(span.start+span.end)/2,(span.lo+span.hi)/2),foot=bridgeArtPoint(center.x,center.y);
  const w=(p.w+dx)*worldScale,h=(p.h+dy)*worldScale;
  const anchor=(p.anchorX+dx*.5)*worldScale,left=foot.x-(mirrored?w-anchor:anchor),top=foot.y-(p.anchorY+dy*.5)*worldScale;
  const scale=Math.min(2,Math.sqrt(1200000/(w*h)));
  const layer=()=>{const c=document.createElement('canvas');c.width=Math.ceil(w*scale);c.height=Math.ceil(h*scale);return c;};
  const whole=layer(),front=layer();
  function paint(canvas,kind){
    const ctx=canvas.getContext('2d'),factor=worldScale*scale;
    ctx.imageSmoothingQuality='high';
    if(mirrored){ctx.translate(w*scale,0);ctx.scale(-1,1);}
    ctx.scale(factor,factor);
    if(!count){ctx.drawImage(kind==='whole'?art.image:art.front,0,0,p.w,p.h);return;}
    const parts=cutBays(art)[kind];ctx.drawImage(parts[0],0,0);
    for(let k=0;k<=count;k++)ctx.drawImage(parts[1],k*p.joint.dx,k*p.joint.dy);
    ctx.drawImage(parts[2],dx,dy);
  }
  paint(whole,'whole');paint(front,'front');buryAbutments(g,span,whole,front,left,top,scale);
  const lips=[],steps=Math.ceil(span.length),startX=p.lip[0][0],endX=p.lip.at(-1)[0]+dx;
  for(let i=0;i<steps;i++){
    const u=i/steps,v=(i+1)/steps,a=(startX+(endX-startX)*u)*worldScale,b=(startX+(endX-startX)*v)*worldScale;
    const point=bridgeCoords(span.axis,span.start+span.length*(u+v)/2,span.hi);
    lips.push({x0:left+(mirrored?w-b:a),x1:left+(mirrored?w-a:b),depth:bridgeArtPoint(point.x,point.y).y});
  }
  return {span,whole,front,left,top,w:whole.width/scale,h:whole.height/scale,scale,lips,bytes:8*whole.width*whole.height};
}


export class BridgeArtwork{
  constructor(){this.ready=false;this.frames={};}
  async loadSpan(src,broadSrc){
    const load=path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The complete painted bridge could not be loaded.'));queueArtwork(im,path);});
    const [narrow,broad]=await Promise.all([load(src),load(broadSrc)]);
    this.artwork=[nativeLayers(broad,bridgePlates.broad),nativeLayers(narrow,bridgePlates.narrow)];
    this.spanReady=true;this.spanCache=new Map();this.spanBytes=0;this.plan=null;
    return {width:broad.naturalWidth||broad.width,height:broad.naturalHeight||broad.height};
  }
  registeredPlan(g){
    if(this.plan?.tiles===g.tiles)return this.plan;
    const base=bridgeCrossings(g),spans=base.spans.map(s=>registerSpan(s,this.artwork)).filter(Boolean),spanTiles=new Int16Array(g.W*g.H);
    for(const [i,s] of spans.entries())for(let u=Math.floor(s.start);u<Math.ceil(s.end);u++)for(let v=s.lo;v<s.hi;v++){
      const {x,y}=bridgeCoords(s.axis,u,v),t=bridgeArtAt(g,x,y);if(t&&(t.feature==='bridge'||approach(t)))spanTiles[y*g.W+x]=i+1;
    }
    return this.plan={...base,spans,spanTiles};
  }
  clearSpans(){this.spanCache?.clear();this.spanBytes=0;this.visibleSpans=[];}
  drawSpans(c,g,range){
    this.registeredPlan(g);this.visibleSpans=[];
    for(const span of this.plan.spans){
      if(span.x1<range.x0-3||span.x0>range.x1+3||span.y1<range.y0-3||span.y0>range.y1+3)continue;
      let image=this.spanCache.get(span);
      if(image)this.spanCache.delete(span);
      else{image=bakeSpan(g,span);this.spanBytes+=image.bytes;}
      this.spanCache.set(span,image);
      while(this.spanBytes>32*1024*1024&&this.spanCache.size>1){
        const oldest=this.spanCache.keys().next().value;this.spanBytes-=this.spanCache.get(oldest).bytes;this.spanCache.delete(oldest);
      }
      c.drawImage(image.whole,image.left,image.top,image.w,image.h);this.visibleSpans.push(image);
    }
  }
  deckLift(g,x,y){
    if(this.plan?.tiles!==g.tiles)return 0;
    const span=this.plan.spans[this.plan.spanTiles[Math.floor(y)*g.W+Math.floor(x)]-1];if(!span)return 0;
    const along=span.axis==='x'?x:y;return spanCrown(span,(along-span.start)/(span.end-span.start));
  }
  clearDecor(g,decor){
    const {spans}=this.registeredPlan(g);return decor.filter(point=>{
      if(!['tree','woodland','bush','reeds','fordStones','heather','forestShrubs','wattle','rock'].includes(point.kind))return true;
      return !spans.some(s=>point.x>s.x0-.45&&point.x<s.x1+.45&&point.y>s.y0-.45&&point.y<s.y1+.45);
    });
  }
  queueParapets(items,troops,g){
    if(!this.visibleSpans?.length)return;
    let occupied;
    if(troops){
      occupied=new Set();
      for(const unit of troops){
        const id=this.plan.spanTiles[Math.floor(unit.y)*g.W+Math.floor(unit.x)];
        if(id)occupied.add(this.plan.spans[id-1]);
      }
    }
    // The complete bridge is already on the ground layer. Re-composite only
    // the front rail of an occupied span to put soldiers behind its masonry.
    for(const image of this.visibleSpans)if(!occupied||occupied.has(image.span)){
      for(const lip of image.lips)items.push({kind:6,depth:lip.depth,image,lip});
    }
  }
  drawParapet(c,item){
    const {image,lip}=item,w=lip.x1-lip.x0;
    c.drawImage(image.front,(lip.x0-image.left)*image.scale,0,w*image.scale,image.front.height,lip.x0,image.top,w,image.h);
  }
  async load(source='./assets/bridges/stone-edges.png'){
    this.ready=false;
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Painted bridge side artwork could not load.'));queueArtwork(im,source);});
    return this.setAtlas(image);
  }
  setAtlas(image){
    this.ready=false;const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(width<64||height<64)throw new Error('The bridge side atlas must contain four painted sprites.');
    const frames={};for(const [i,name]of ['masonry','arch','endPost','cornerPost'].entries())frames[name]=bridgeArtFrame(image,i%2,Math.floor(i/2),name);
    this.frames=frames;this.ready=true;return {columns:2,rows:2,sprites:Object.keys(frames)};
  }
  paint(context,g,range={},options={}){
    if(!this.ready)return false;
    const segments=bridgeSideSegments(g,range),posts=new Map(),stats={walls:0,arches:0,posts:0},layer=options.layer||'all';
    segments.sort((a,b)=>(a.a.x+a.a.y)-(b.a.x+b.a.y)||Number(a.front)-Number(b.front));
    for(const edge of segments){
      // Post ownership considers both sides even in a split pass. A shared
      // corner belongs to its frontmost face and is never painted twice.
      for(const [endpoint,point]of [[edge.offset===0,edge.a],[edge.offset===edge.run.length-1,edge.b]]){
        if(!endpoint)continue;const info=bridgeArtPostInfo(g,point.x,point.y);
        if(info.owner===edge.y*g.W+edge.x)posts.set(`${point.x}:${point.y}`,{point,end:info.end,front:info.front,foreground:info.foreground});
      }
    }
    const orderedPosts=[...posts.values()].filter(post=>layer==='all'||layer===(post.front?'front':'back')).sort((a,b)=>(a.point.x+a.point.y)-(b.point.x+b.point.y));
    const drawPost=post=>{
      const p=bridgeArtPoint(post.point.x,post.point.y),f=this.frames[post.end?'endPost':'cornerPost'];
      const width=post.end?12:10,height=post.end?26:22,bottom=post.front?12:7;
      context.drawImage(f.image,p.x-width/2,p.y+bottom-height,width,height);stats.posts++;
    };
    // Rear and left/start piers sit beneath their rail join. Only the near
    // terminal pier belongs in the final foreground, above the complete rail.
    for(const post of orderedPosts)if(!post.foreground)drawPost(post);
    for(const edge of segments){
      if(layer!=='all'&&layer!==(edge.front?'front':'back'))continue;
      const a=bridgeArtPoint(edge.a.x,edge.a.y),b=bridgeArtPoint(edge.b.x,edge.b.y),dx=b.x-a.x,dy=b.y-a.y;
      const depth=edge.front?(options.frontDepth??16):(options.backDepth??9),top=-(options.copingHeight??3);
      const archStart=1+Math.floor((edge.offset-1)/3)*3;
      const arch=edge.run.length>=4&&edge.offset>=1&&edge.offset<archStart+2&&archStart+2<=edge.run.length-1;
      const frame=this.frames[arch?'arch':'masonry'],span=arch?2:1,offset=arch?edge.offset-archStart:0;
      // Source art is a flat elevation: horizontal source pixels follow the
      // isometric bridge edge while vertical pixels remain upright. Clipping
      // each owned tile avoids double painting long arches between chunks.
      context.save();context.beginPath();context.moveTo(a.x,a.y+top);context.lineTo(b.x,b.y+top);context.lineTo(b.x,b.y+depth);context.lineTo(a.x,a.y+depth);context.closePath();context.clip();
      context.transform(dx*span/frame.width,dy*span/frame.width,0,(depth-top)/frame.height,a.x-dx*offset,a.y-dy*offset+top);
      context.drawImage(frame.image,0,0);context.restore();stats.walls++;if(arch)stats.arches++;
    }
    for(const post of orderedPosts)if(post.foreground)drawPost(post);
    return stats;
  }
}
