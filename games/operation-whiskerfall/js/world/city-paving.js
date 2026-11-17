/* City ground is opaque up to the district limits. All surface images share
   world-space coordinates across chunks, including when both heroes zoom out. */
(function(){
  'use strict';
  const W=window.OW,SIZE=384,GUTTER=2,LIMIT=72,TAU=Math.PI*2;
  const stores=new WeakMap();
  const intersects=(a,b)=>a.x<=b.x+b.w&&a.y<=b.y+b.h&&b.x<=a.x+a.w&&b.y<=a.y+a.h;
  const grow=(b,n)=>({x:b.x-n,y:b.y-n,w:b.w+2*n,h:b.h+2*n});
  const clamp=(n,a,b)=>Math.max(a,Math.min(n,b));
  function bounds(points,margin=0){
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
    return {x:x-margin,y:y-margin,w:Math.max(...xs)-x+2*margin,h:Math.max(...ys)-y+2*margin};
  }
  function rect(c,b,style){c.fillStyle=style;c.fillRect(b.x,b.y,b.w,b.h);}
  function inset(b,n){return {x:b.x+n,y:b.y+n,w:Math.max(0,b.w-2*n),h:Math.max(0,b.h-2*n)};}
  function border(c,b,width,color){c.lineWidth=width;c.strokeStyle=color;c.strokeRect(b.x,b.y,b.w,b.h);}
  function line(c,x,y,tx,ty,color,width=1){
    c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  function routeLine(c,r,width,style){
    if(width<=0)return;c.strokeStyle=style;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke(r.path);
  }
  function rng(seed){
    let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  }
  function sourceRoutes(city){
    if(city.routes?.length)return city.routes;
    return [...(city.streetsX||[]).map((x,i)=>({kind:i===4?'boulevard':'street',width:i===4?98:64,points:[{x,y:city.top},{x,y:city.bottom}]})),
      ...(city.streetsY||[]).map((y,i)=>({kind:i===3?'boulevard':'street',width:i===3?104:62,points:[{x:city.left,y},{x:city.right,y}]}))];
  }
  function geometry(city,w){
    const routes=[],segments=[];
    for(const data of sourceRoutes(city)){
      const points=data.points||[];if(points.length<2)continue;
      const width=data.width||60,kind=data.kind||'street',side={boulevard:33,street:21,alley:7,quay:23,rail:10}[kind]||16;
      const path=new Path2D();path.moveTo(points[0].x,points[0].y);
      const r={...data,points,kind,width,side,path,bounds:bounds(points,width/2+side+17),segments:[],idx:routes.length};
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        if(length<1)continue;path.lineTo(b.x,b.y);
        const seg={a,b,length,dx:dx/length,dy:dy/length,r,junctions:[],bounds:bounds([a,b],width/2+side+20)};
        r.segments.push(seg);segments.push(seg);
      }routes.push(r);
    }
    const crosses=[];
    for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
      const a=segments[i],b=segments[j];
      if(a.r===b.r||a.r.kind==='rail'||b.r.kind==='rail'||!intersects(a.bounds,b.bounds))continue;
      const den=a.dx*b.dy-a.dy*b.dx;if(Math.abs(den)<.30)continue;
      const x=b.a.x-a.a.x,y=b.a.y-a.a.y,u=(x*b.dy-y*b.dx)/den,v=(x*a.dy-y*a.dx)/den;
      if(u<-.5||u>a.length+.5||v<-.5||v>b.length+.5)continue;
      const p={x:a.a.x+a.dx*u,y:a.a.y+a.dy*u};a.junctions.push({t:u,gap:b.r.width*.5+8});b.junctions.push({t:v,gap:a.r.width*.5+8});
      if(crosses.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<90))continue;
      const squares=city.squares||[],plaza=squares.some(s=>intersects(grow(s,96),{...p,w:0,h:0}));
      if(!plaza&&!([a.r.kind,b.r.kind].includes('boulevard')&&(i*3+j)%3!==1))continue;
      const road=a.r.width<=b.r.width?a:b,other=road===a?b:a;
      if(road.r.kind==='alley')continue;
      const t=road===a?u:v,delta=other.r.width/2+12,direction=(road.length-t<delta+13?-1:t<delta+13?1:(i+j)%2?1:-1);
      const cx=p.x+road.dx*delta*direction,cy=p.y+road.dy*delta*direction;
      crosses.push({x:cx,y:cy,dx:road.dx,dy:road.dy,width:road.r.width,bounds:{x:cx-road.r.width,y:cy-road.r.width,w:road.r.width*2,h:road.r.width*2}});
    }
    const lamps=(w.objects||[]).filter(o=>o.x>=city.left&&o.x<=city.right&&o.y>=city.top&&o.y<=city.bottom&&(/lamp|lantern/i.test(o.id||'')||o.painting==='civic-6'||o.cityLamp)).map(o=>({x:o.x,y:o.y,rad:/station|plaza|square/i.test(o.id||'')?92:64}));
    const buildings=(w.objects||[]).filter(o=>o.type==='cityBuilding'&&o.cityKey===city.key&&o.cityFootprint);
    const doors=buildings.map((o,i)=>{
      const foot=o.cityFootprint,door={x:o.x+((i%3)-1)*o.w*.12,y:o.frontY||o.y};
      let access=null,best=Infinity;
      for(const seg of segments){
        if(seg.r.kind==='rail')continue;
        const k=clamp((door.x-seg.a.x)*seg.dx+(door.y-seg.a.y)*seg.dy,0,seg.length),
          x=seg.a.x+k*seg.dx,y=seg.a.y+k*seg.dy,dx=x-door.x,dy=y-door.y,d=Math.hypot(dx,dy)||1;
        if(d>170||dy< -16||d<seg.r.width*.5)continue;
        const gap=Math.max(0,d-seg.r.width*.5-seg.r.side*.5),score=gap+Math.max(0,-dy)*2;
        if(gap<5||score>best)continue;
        const tip={x:door.x+dx/d*gap,y:door.y+dy/d*gap};
        if(buildings.some(other=>other!==o&&intersects(other.cityFootprint,{x:(door.x+tip.x)/2-2,y:(door.y+tip.y)/2-2,w:4,h:4})))continue;
        best=score;access=tip;
      }
      return {door,foot,access,idx:i,bounds:grow(foot,180)};
    });
    return {routes,crosses,lamps,doors,squares:city.squares||[],canals:city.canals||[],blocks:city.blocks||[]};
  }
  const palettes={
    ironveil:{ground:'#45494a',bed:'#6c665e',side:'#81796a',curb:'#999286',road:'#435158',brick:'#795a49',tint:'rgba(50,45,42,.37)',rail:'#414342',water:'#24464a',stone:'#7c7a6b'},
    blackglass:{ground:'#414950',bed:'#6b6d75',side:'#84858a',curb:'#a2a5a4',road:'#404e5e',brick:'#665453',tint:'rgba(32,40,52,.45)',rail:'#3d444d',water:'#213e4b',stone:'#7a8087'}
  };
  function materials(c,images){
    return images.map((im,i)=>{if(!im)return null;const pat=c.createPattern(im,'repeat');
      if(pat?.setTransform){const size=[204,110,148,210,150,195][i];pat.setTransform(new DOMMatrix().scale(size/im.width,size/im.height));}
      return pat;});
  }
  function ground(c,g,city,b,p,m){
    rect(c,b,p.ground);
    if(m[4]){c.save();c.globalAlpha=.39;rect(c,b,m[4]);c.restore();}
    for(const [i,block] of g.blocks.entries()){
      if(!intersects(grow(block,8),b))continue;
      const inside=inset(block,4);rect(c,block,'#333d42');rect(c,inside,(i%3===1?m[2]:m[4])||p.bed);
      c.save();c.globalAlpha=.47;rect(c,inside,i%3===1?p.brick:p.bed);c.restore();
      const quarter=block.district||0;
      c.save();c.globalAlpha=.34;rect(c,inset(block,6),city.key==='ironveil'?['#705441','#544b44','#726953','#63544b'][quarter]:['#5a5353','#656758','#6a6864','#52565e'][quarter]);c.restore();
      border(c,inset(block,8),2,'#b5ab8b50');
      const random=rng((block.idx+11)*8761),px=block.x+block.w*(.2+.58*random()),py=block.y+block.h*(.24+.42*random());
      if(i%3!==1&&block.w>170){
        const side=27+random()*33;
        c.save();c.translate(px,py);c.rotate(i%2?.15:-.09);c.fillStyle='#716e5c4d';c.fillRect(-side,-side*.38,side*2,side*.76);c.strokeStyle='#a49b806d';c.lineWidth=1.5;c.strokeRect(-side,-side*.38,side*2,side*.76);c.restore();
      }
    }
  }
  function frontages(c,g,b,p,m){
    for(const v of g.doors){
      if(!intersects(v.bounds,b))continue;
      const {door,foot:f,access}=v,actual=intersects(grow(f,15),b);
      if(actual){
        rect(c,{x:f.x-4,y:f.y+f.h-4,w:f.w+8,h:12},'#393f3e');
        rect(c,{x:f.x-3,y:f.y+f.h-2,w:f.w+6,h:8},m[1]||p.curb);
        line(c,f.x-2,f.y+f.h+6,f.x+f.w+2,f.y+f.h+6,'#b3ab92',1.5);
      }
      if(access){
        const dx=access.x-door.x,dy=access.y-door.y,len=Math.hypot(dx,dy),stripe=Math.max(13,Math.min(29,f.w*.17));
        c.save();c.lineCap='butt';
        line(c,door.x,door.y,access.x,access.y,'#485253',stripe+2);
        line(c,door.x,door.y,access.x,access.y,m[v.idx%3===0?2:3]||p.side,stripe);
        if(len>12){const nx=-dy/len,ny=dx/len;for(let d=10;d<len;d+=20){
          const x=door.x+d*dx/len,y=door.y+d*dy/len;line(c,x-nx*stripe*.5,y-ny*stripe*.5,x+nx*stripe*.5,y+ny*stripe*.5,'#64686575',1);
        }}c.restore();
      }
      if(actual&&v.idx%3===0){
        const rad=Math.min(60,16+f.w*.18),light=c.createRadialGradient(door.x,door.y,1,door.x,door.y,rad);light.addColorStop(0,'rgba(236,180,101,.28)');light.addColorStop(1,'rgba(220,152,84,0)');
        c.fillStyle=light;c.fillRect(door.x-rad,door.y-rad,rad*2,rad*2);
      }
    }
  }
  function square(c,s,p,m){
    const isGarden=s.kind==='garden',face=isGarden?'#536355':s.kind==='market'?(m[2]||p.brick):(m[3]||p.side);
    rect(c,grow(s,6),'#363e41');rect(c,grow(s,3),p.curb);rect(c,s,face);
    if(!isGarden){c.save();c.globalAlpha=.09;rect(c,s,s.kind==='ministry'?'#dce6ef':'#debc8b');c.restore();}
    border(c,inset(s,11),3,s.kind==='ministry'?'#d1b98f':'#afa18a');
    const cx=s.x+s.w/2,cy=s.y+s.h/2,r=Math.max(10,Math.min(s.w,s.h)*.23);
    if(s.kind==='ministry'){
      c.save();c.translate(cx,cy);c.rotate(Math.PI/4);c.strokeStyle='#565b5f';c.lineWidth=4;c.strokeRect(-r,-r,2*r,2*r);
      c.strokeStyle='#b5a47e';c.lineWidth=2;c.strokeRect(-r+8,-r+8,r*2-16,r*2-16);c.restore();
      for(const side of [-1,1]){line(c,s.x+16,cy+side*(r+19),s.x+s.w-16,cy+side*(r+19),'#a59f89',2);}
    }else if(s.kind==='market'){
      const margin=20;for(let x=s.x+margin;x<s.x+s.w-margin;x+=42){line(c,x,s.y+14,x,s.y+20,'#dec49a',2);line(c,x,s.y+s.h-14,x,s.y+s.h-20,'#dec49a',2);}
      for(const rr of [r,r-5]){if(rr<=0)continue;c.strokeStyle='#ccb48a';c.lineWidth=2;c.beginPath();c.ellipse(cx,cy,rr,rr*.78,0,0,TAU);c.stroke();}
    }else if(s.kind==='station'){
      const horizontal=s.w>=s.h;c.save();c.translate(s.x,s.y);
      if(!horizontal){c.translate(s.w,0);c.rotate(Math.PI/2);}
      const length=horizontal?s.w:s.h,depth=horizontal?s.h:s.w;
      line(c,12,depth-18,length-12,depth-18,'#cbab6b',4);
      for(let x=23;x<length-18;x+=11)line(c,x,depth-12,x+3,depth-12,'#d0b47c',2);c.restore();
    }else if(isGarden){
      c.save();c.translate(cx,cy);c.fillStyle='#a3987c';c.fillRect(-s.w/2, -9,s.w,18);c.fillRect(-9,-s.h/2,18,s.h);
      c.fillStyle='#a79d84';c.beginPath();c.ellipse(0,0,r*.6,r*.52,0,0,TAU);c.fill();c.restore();
    }
  }
  function pavements(c,routes,b,p,m){
    const street=routes.filter(r=>r.kind!=='rail'&&intersects(r.bounds,b));
    for(const r of street)routeLine(c,r,r.width+2*r.side+4,'#333c40');
    for(const r of street)routeLine(c,r,r.width+2*r.side,p.curb);
    for(const r of street)routeLine(c,r,r.width+2*r.side-4,m[r.kind==='alley'?2:3]||p.side);
    // All outer sidewalks are laid before any carriageway. At intersections
    // the second road cannot paint a curb across the first road's traffic lane.
    for(const r of street)routeLine(c,r,r.width+7,'#4c5050');
    for(const r of street)routeLine(c,r,r.width+4,m[1]||p.curb);
    for(const r of street){
      const material=r.kind==='alley'?2:r.kind==='quay'?4:0;
      routeLine(c,r,r.width,m[material]||(r.kind==='alley'?p.brick:p.road));
      routeLine(c,r,r.width,'rgba(32,40,44,.13)');
    }
    for(const r of street)for(const seg of r.segments){
      if(!intersects(seg.bounds,b))continue;
      const step=r.kind==='boulevard'?62:r.kind==='quay'?94:126;
      for(let t=28;t<seg.length-22;t+=step){
        if(seg.junctions.some(j=>Math.abs(t-j.t)<j.gap+20))continue;
        const x=seg.a.x+seg.dx*t,y=seg.a.y+seg.dy*t;if(!intersects(grow(b,32),{x,y,w:1,h:1}))continue;
        const nx=-seg.dy,ny=seg.dx;
        if(r.kind==='boulevard'){
          line(c,x-seg.dx*9,y-seg.dy*9,x+seg.dx*9,y+seg.dy*9,'#c8b88c98',2.6);
        }else if(r.kind==='quay'){
          line(c,x+nx*(r.width*.42),y+ny*(r.width*.42),x+nx*(r.width*.42)+seg.dx*16,y+ny*(r.width*.42)+seg.dy*16,'#cdbb8c85',2);
        }
        if((Math.floor(t/step)+r.idx)%5===2&&r.kind!=='alley'){
          const side=r.width*(r.idx%2?-.35:.37),rx=x+nx*side,ry=y+ny*side;
          c.save();c.translate(rx,ry);c.rotate(Math.atan2(seg.dy,seg.dx));c.fillStyle='#82979836';c.beginPath();c.moveTo(-20,1);c.quadraticCurveTo(-9,-3,0,-2);c.quadraticCurveTo(7,-1,22,0);c.quadraticCurveTo(13,2,-6,3);c.closePath();c.fill();
          line(c,-11,1,-4,.5,'#b5b4a780',.8);line(c,2,0,8,0,'#c4b8a65c',1);c.restore();
        }
        if((Math.floor(t/step)+r.idx)%4===0){
          const side=(r.idx%2?-1:1)*(r.width*.5-4),gx=x+nx*side,gy=y+ny*side;
          c.save();c.translate(gx,gy);c.rotate(Math.atan2(seg.dy,seg.dx));c.fillStyle='#343d40';c.fillRect(-8,-3.5,16,7);c.fillStyle='#747774';for(let j=-6;j<8;j+=3)c.fillRect(j,-2.5,1,5);c.restore();
        }
      }
    }
  }
  function crossing(c,q){
    c.save();c.translate(q.x,q.y);c.rotate(Math.atan2(q.dy,q.dx));
    // Each stripe runs along traffic direction. The crossing connects opposite sidewalks.
    const half=q.width/2-5;c.fillStyle='#dcd2b4b8';
    for(let y=-half+2;y<half-2;y+=9)c.fillRect(-7,y,14,4.2);
    c.restore();
  }
  function track(c,r,b,p,m){
    if(!intersects(r.bounds,b))return;
    routeLine(c,r,Math.max(23,r.width),m[4]||p.rail);routeLine(c,r,Math.max(20,r.width-3),'#2c3139a8');
    const gauge=clamp(r.width*.20,6,11);
    for(const seg of r.segments){
      if(!intersects(seg.bounds,b))continue;const nx=-seg.dy,ny=seg.dx;
      for(let t=3;t<seg.length;t+=16){const x=seg.a.x+seg.dx*t,y=seg.a.y+seg.dy*t;
        if(!intersects(grow(b,20),{x,y,w:1,h:1}))continue;
        line(c,x-nx*(gauge+4),y-ny*(gauge+4),x+nx*(gauge+4),y+ny*(gauge+4),'#806b57',4);}
      for(const side of [-1,1]){const off=side*gauge;line(c,seg.a.x+nx*off,seg.a.y+ny*off,seg.b.x+nx*off,seg.b.y+ny*off,'#282e34',4.5);
        line(c,seg.a.x+nx*off,seg.a.y+ny*off-1,seg.b.x+nx*off,seg.b.y+ny*off-1,'#ada99b',2);}
    }
  }
  function bridge(c,b,canal,p,m){
    rect(c,grow(b,4),'#2d373a');rect(c,b,m[3]||p.side);
    const vertical=canal.w>=canal.h;
    c.save();c.translate(b.x,b.y);if(!vertical){c.translate(0,b.h);c.rotate(-Math.PI/2);}
    const width=vertical?b.w:b.h,length=vertical?b.h:b.w;
    c.fillStyle=m[0]||p.road;c.fillRect(8,0,width-16,length);
    for(const x of [2,width-5]){
      c.fillStyle='#c6bb9f';c.fillRect(x,1,3,length-2);c.fillStyle='#6d6b5c';c.fillRect(x+2,1,2,length-2);
      for(let y=6;y<length;y+=26){c.fillStyle='#d2c6ab';c.fillRect(x-1,y,6,4);}
    }
    c.restore();
  }
  function water(c,s,b,p,m){
    if(!intersects(grow(s,22),b))return;
    rect(c,grow(s,14),'#343e42');rect(c,grow(s,10),m[1]||p.stone);rect(c,grow(s,3),'#999583');rect(c,s,m[5]||p.water);
    c.save();c.beginPath();c.rect(s.x,s.y,s.w,s.h);c.clip();c.fillStyle='#142f4054';c.fillRect(s.x,s.y,s.w,s.h);
    const horizontal=s.w>=s.h,depth=horizontal?s.h:s.w;
    const grad=horizontal?c.createLinearGradient(0,s.y,0,s.y+depth):c.createLinearGradient(s.x,0,s.x+depth,0);
    grad.addColorStop(0,'#1a2733b0');grad.addColorStop(.18,'#1e344048');grad.addColorStop(.65,'#93b5b311');grad.addColorStop(1,'#182b3799');c.fillStyle=grad;c.fillRect(s.x,s.y,s.w,s.h);c.restore();
    const long=s.w>=s.h,span=long?s.w:s.h,lo=long?b.x-s.x:b.y-s.y,hi=lo+(long?b.w:b.h);
    for(let t=Math.max(22,22+Math.floor((lo-22)/91)*91);t<Math.min(span-10,hi+16);t+=91){
      for(const side of [-1,1]){const x=long?s.x+t:side<0?s.x-7:s.x+s.w+7,y=long?(side<0?s.y-7:s.y+s.h+7):s.y+t;
        if((s.bridges||[]).some(br=>intersects(grow(br,7),{x,y,w:1,h:1})))continue;
        c.fillStyle='#324041';c.fillRect(x-3,y-2,7,5);c.fillStyle='#a19674';c.fillRect(x-2,y-3,5,2);
        if(Math.floor(t/91)%4===1){c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+8,y+6,x+12,y-3,x+18,y+2);c.strokeStyle='#aaa18191';c.lineWidth=1.2;c.stroke();}
      }
    }
    for(const br of s.bridges||[])if(intersects(grow(br,8),b))bridge(c,br,s,p,m);
  }
  function lamp(c,l){
    const rad=l.rad,g=c.createRadialGradient(l.x,l.y,1,l.x,l.y,rad);
    g.addColorStop(0,'rgba(250,216,133,.42)');g.addColorStop(.32,'rgba(244,184,95,.24)');g.addColorStop(.75,'rgba(221,149,67,.08)');g.addColorStop(1,'rgba(194,127,58,0)');
    c.fillStyle=g;c.fillRect(l.x-rad,l.y-rad,2*rad,2*rad);
  }
  function makeChunk(s,city,cx,cy){
    const board=document.createElement('canvas');board.width=board.height=SIZE+2*GUTTER;
    const c=board.getContext('2d',{alpha:false}),x=city.left+cx*SIZE-GUTTER,y=city.top+cy*SIZE-GUTTER,b={x,y,w:board.width,h:board.height};
    c.translate(-x,-y);const m=materials(c,s.images),g=s.geo,p=palettes[city.key]||palettes.ironveil;
    ground(c,g,city,b,p,m);
    for(const plaza of g.squares)if(intersects(grow(plaza,8),b))square(c,plaza,p,m);
    frontages(c,g,b,p,m);
    pavements(c,g.routes,b,p,m);
    for(const q of g.crosses)if(intersects(q.bounds,b))crossing(c,q);
    for(const r of g.routes)if(r.kind==='rail')track(c,r,b,p,m);
    for(const canal of g.canals)water(c,canal,b,p,m);
    for(const l of g.lamps)if(intersects({x:l.x-l.rad,y:l.y-l.rad,w:l.rad*2,h:l.rad*2},b))lamp(c,l);
    // Sparse grain softens stone and repair edges. Seeded in world-unit cells,
    // so the same marks are present on both overlapped sides of a chunk edge.
    for(let gx=Math.floor(x/72);gx<=Math.floor((x+b.w)/72);gx++)for(let gy=Math.floor(y/72);gy<=Math.floor((y+b.h)/72);gy++){
      const random=rng(Math.imul(gx,673261)^Math.imul(gy,891531));for(let n=0;n<10;n++){
        const px=gx*72+random()*72,py=gy*72+random()*72;c.fillStyle=random()>.4?'#ddcba21b':'#22343824';c.fillRect(px,py,1+random()*2,1);
      }
    }
    return board;
  }
  function glints(c,canal,v,t){
    if(!intersects(v,canal))return;const horizontal=canal.w>=canal.h;
    c.save();c.beginPath();c.rect(canal.x,canal.y,canal.w,canal.h);c.clip();
    const step=62,start=horizontal?canal.x:canal.y,from=Math.max(0,Math.floor(((horizontal?v.x:v.y)-start)/step)-1),to=Math.min(Math.ceil((horizontal?canal.w:canal.h)/step),Math.ceil(((horizontal?v.x+v.w:v.y+v.h)-start)/step)+1);
    for(let i=from;i<to;i++){
      const across=.21+(i*17%23)/42,along=i*step+16+Math.sin(t*.55+i)*4;
      const x=canal.x+(horizontal?along:canal.w*across),y=canal.y+(horizontal?canal.h*across:along);
      if((canal.bridges||[]).some(b=>intersects(b,{x:x-14,y,w:28,h:1})))continue;
      const k=.11+.10*(1+Math.sin(t*1.2+i*2.1))*.5;
      line(c,x-7,y,x+8+Math.sin(i+t*.5)*4,y-.6,'rgba(203,211,193,'+k+')',1.3);
    }c.restore();
  }
  function draw(r,w,city){
    const view=r.terrainView||r.view;if(!view||city.right<=view.x||city.bottom<=view.y||city.left>=view.x+view.w||city.top>=view.y+view.h)return;
    let s=stores.get(city);
    if(!s){s={geo:geometry(city,w),chunks:new Map(),mask:-1,images:[]};stores.set(city,s);}
    const images=Array.from({length:6},(_,i)=>W.TownStreets?.image('urban-floor-'+i)),mask=images.reduce((n,im,i)=>n+(im?1<<i:0),0);
    if(mask!==s.mask){s.images=images;s.mask=mask;s.chunks.clear();}
    const x0=Math.max(0,Math.floor((view.x-city.left)/SIZE)),y0=Math.max(0,Math.floor((view.y-city.top)/SIZE));
    const x1=Math.ceil((Math.min(city.right,view.x+view.w)-city.left)/SIZE),y1=Math.ceil((Math.min(city.bottom,view.y+view.h)-city.top)/SIZE);
    const c=r.ctx;c.save();c.beginPath();c.rect(city.left,city.top,city.right-city.left,city.bottom-city.top);c.clip();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const k=x+','+y;let tile=s.chunks.get(k);if(!tile)tile=makeChunk(s,city,x,y);
      else s.chunks.delete(k);s.chunks.set(k,tile);
      c.drawImage(tile,city.left+x*SIZE-GUTTER,city.top+y*SIZE-GUTTER);
    }
    while(s.chunks.size>LIMIT)s.chunks.delete(s.chunks.keys().next().value);
    for(const canal of s.geo.canals)glints(c,canal,view,r.clock||0);
    c.restore();
  }
  W.CityPaving={draw};
}());
