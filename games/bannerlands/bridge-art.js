// Painted bridge sides are cosmetic and baked into the renderer's static
// bridge-chunk cache. The lane deck, navigation and bridge tiles stay unchanged.
const bridgeArtPoint=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
const bridgeArtAt=(g,x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H?g.tiles[y*g.W+x]:null;
const bridgeArtTile=(g,x,y)=>bridgeArtAt(g,x,y)?.feature==='bridge';
const bridgeArtAxis=t=>t?.featureAxis==='y'?'y':'x';
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

export class BridgeArtwork{
  constructor(){this.ready=false;this.frames={};}
  async load(source='./assets/bridges/stone-edges.png'){
    this.ready=false;
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Painted bridge side artwork could not load.'));im.src=source;});
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
