/* Academy: an illustrated, dependency-free Canvas battlefield. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const chunkCache = new Map();
  const atlases={units:null,cavalry:null,environment:null,grass:null};
  const tintedAtlases=new Map();
  const riverCache=new WeakMap();
  const carrierTrails=new Map();
  const rememberedLandmarks=new Map();
  let rememberedWorld=null;
  const fogCache={canvas:null,reference:null,time:-1};
  let decorCache={reference:null,items:[]};
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const noise = (x,y=0) => {
    let k = Math.imul((x|0)^0x9e3779b9,(y|0)^0x85ebca6b);
    k ^= k>>>16; k=Math.imul(k,0x7feb352d);k^=k>>>15;
    return (k>>>0)/4294967295;
  };
  const poly = (c,pts,fill,stroke=null,lw=1) => {
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
  };
  const ellipse=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();};
  const line=(c,x1,y1,x2,y2,color,w=1)=>{c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=w;c.stroke();};
  const label=(c,text,x,y,size=10,color='#f6f0d7',back=true)=>{
    c.save();c.font=`600 ${size}px "Segoe UI",sans-serif`;c.textAlign='center';
    if(back){const w=c.measureText(text).width+15;c.fillStyle='rgba(20,34,29,.84)';c.beginPath();c.roundRect(x-w/2,y-size+1,w,size+8,4);c.fill();}
    c.fillStyle=color;c.fillText(text,x,y+1);c.restore();
  };
  function makeCanvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
  function loadAtlas(name){
    const src=name.startsWith('faction:')?window.AcademyAssets?.factions?.[name.slice(8)]:name.startsWith('champion:')?window.AcademyAssets?.champions?.[name.slice(9)]:window.AcademyAssets?.[name];
    if(!src)return null;
    if(!atlases[name]||atlases[name].source!==src){
      const img=typeof src==='string'?new Image():src;
      if(typeof src==='string')img.src=src;
      atlases[name]={source:src,img};
    }
    const image=atlases[name].img;
    return image.complete&&image.naturalWidth>0?image:null;
  }
  // Every terrain feature uses the painted production atlas, including its banks,
  // foliage and slopes. Canvas geometry is reserved for commands and fog.
  function terrainStamp(c,image,index,x,y,width,height=width,angle=0){
    const sw=image.naturalWidth/4,sh=image.naturalHeight/4;
    c.save();c.translate(x,y);if(angle)c.rotate(angle);
    c.drawImage(image,(index%4)*sw,Math.floor(index/4)*sh,sw,sh,-width/2,-height/2,width,height);c.restore();
  }
  const visiblePoint=(api,x,y)=>!api.canSee||api.canSee('player',x,y);
  const visibleEntity=(api,entity)=>entity.controller==='player'||!api.isVisibleTo||api.isVisibleTo('player',entity);
  function remembered(api,key,entity,x=entity.x,y=entity.y){
    if(visiblePoint(api,x,y)){
      const snapshot={...entity,progress:{},contested:false,lastCapturedAt:-99};
      rememberedLandmarks.set(key,snapshot);return entity;
    }
    return rememberedLandmarks.get(key)||null;
  }
  function teamAtlas(img,color){
    const key=img.src.slice(-60)+color;
    if(tintedAtlases.has(key))return tintedAtlases.get(key);
    const a=makeCanvas(img.naturalWidth,img.naturalHeight),c=a.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);
    try{
      const image=c.getImageData(0,0,a.width,a.height),d=image.data,hex=color.replace('#','');
      const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<20)continue;
        const red=d[i],green=d[i+1],blue=d[i+2];
        // Only cool blue cloth changes allegiance. Skin, leather, steel and highlights stay intact.
        if(blue>red*1.13&&blue>green*.98&&blue-red>18){
          const value=(red*.21+green*.48+blue*.31)/115;
          d[i]=clamp(r*value,0,255);d[i+1]=clamp(g*value,0,255);d[i+2]=clamp(b*value,0,255);
        }
      }
      c.putImageData(image,0,0);
    }catch(_){/* The base atlas remains usable if pixel access is unavailable. */}
    tintedAtlases.set(key,a);return a;
  }
  function houseCrest(c,id,x,y,scale=1,color='#f4e6b9'){
    c.save();c.translate(x,y);c.scale(scale,scale);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.8;c.lineCap='round';
    if(id==='mars'){line(c,-7,7,7,-7,color,2);line(c,-7,-7,7,7,color,2);poly(c,[[9,-9],[3,-7],[7,-3]],color);poly(c,[[-9,-9],[-7,-3],[-3,-7]],color);}
    else if(id==='minerva'){poly(c,[[-9,-6],[-6,6],[0,10],[6,6],[9,-6],[4,-3],[0,-7],[-4,-3]],null,color,1.6);ellipse(c,-3,-1,2.2,2.2,color);ellipse(c,3,-1,2.2,2.2,color);poly(c,[[-2,3],[2,3],[0,6]],color);}
    else if(id==='diana'){c.beginPath();c.arc(0,0,9,.6,5.68);c.bezierCurveTo(-1,-6,-3,3,7,5);c.fill();}
    else if(id==='apollo'){ellipse(c,0,0,4.5,4.5,color);for(let a=0;a<TAU;a+=Math.PI/4)line(c,Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*10,Math.sin(a)*10,color,1.8);}
    else if(id==='juno'){poly(c,[[-9,-5],[-5,0],[0,-8],[5,0],[9,-5],[7,7],[-7,7]],null,color,2);line(c,-7,4,7,4,color,2);}
    else if(id==='neptune'){line(c,0,-9,0,9,color,2);c.beginPath();c.moveTo(-7,-7);c.lineTo(-7,0);c.quadraticCurveTo(0,7,7,0);c.lineTo(7,-7);c.stroke();poly(c,[[-10,-6],[-7,-10],[-4,-6]],color);poly(c,[[4,-6],[7,-10],[10,-6]],color);}
    else if(id==='vulcan'){poly(c,[[-10,-6],[9,-6],[7,0],[0,1],[-1,6],[7,6],[7,9],[-8,9],[-8,6],[-4,6],[-3,0],[-8,-1]],color);}
    else if(id==='venus'){for(let a=0;a<TAU;a+=TAU/5)ellipse(c,Math.cos(a)*4.7,Math.sin(a)*4.7,4,4,color);ellipse(c,0,0,2,2,'#71805a');}
    else if(id==='saturn'){ellipse(c,0,0,6,6,color);c.save();c.rotate(-.4);c.beginPath();c.ellipse(0,0,12,3,0,0,TAU);c.stroke();c.restore();}
    else{for(const sign of [-1,1]){c.beginPath();c.moveTo(sign*2,10);c.quadraticCurveTo(sign*14,2,sign*7,-9);c.stroke();for(let j=0;j<4;j++){c.save();c.translate(sign*(6+Math.sin(j)*2),6-j*4);c.rotate(sign*(-.65+j*.35));ellipse(c,0,0,2,3.8,color);c.restore();}}}
    c.restore();
  }
  function groundChunk(cx,cy){
    const grass=loadAtlas('grass');const key=`${cx},${cy},${grass?'painted':'procedural'}`;
    if(chunkCache.has(key)){const v=chunkCache.get(key);chunkCache.delete(key);chunkCache.set(key,v);return v;}
    const a=makeCanvas(512,512),c=a.getContext('2d');
    c.fillStyle='#637b49';c.fillRect(0,0,512,512);
    if(grass){c.drawImage(grass,0,0,512,512);c.fillStyle='rgba(68,93,49,.08)';c.fillRect(0,0,512,512);}
    for(let i=0;i<45;i++){
      const x=noise(i+cx*53,cy+3)*512,y=noise(i+cy*71,cx+10)*512,r=28+noise(i,cx+cy)*110;
      const g=c.createRadialGradient(x,y,1,x,y,r);
      g.addColorStop(0,i%3?'rgba(194,191,106,.09)':'rgba(24,57,42,.09)');g.addColorStop(1,'rgba(84,114,61,0)');
      c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<1850;i++){
      const x=noise(i+cx*311,cy+8)*512,y=noise(i+cy*131,cx+21)*512;
      const q=noise(i,cx*53+cy*31);
      c.strokeStyle=q>.65?'rgba(225,218,145,.17)':q>.3?'rgba(34,68,37,.15)':'rgba(150,171,91,.24)';
      c.lineWidth=.65;c.beginPath();c.moveTo(x,y);c.lineTo(x+(q-.5)*3,y-1.5-q*3);c.stroke();
      if(q>.993){ellipse(c,x,y,1.1,1.1,'#e9d1a0');ellipse(c,x+2,y+1,1,1,'#f1dfa9');}
    }
    chunkCache.set(key,a);if(chunkCache.size>32)chunkCache.delete(chunkCache.keys().next().value);return a;
  }
  function environmentSprite(c,image,col,row,x,y,width,height=width){
    const sw=image.naturalWidth/4,sh=image.naturalHeight/4;
    c.drawImage(image,col*sw,row*sh,sw,sh,x-width/2,y-height*.87,width,height);
  }
  function riverGeometry(r){
    if(riverCache.has(r))return riverCache.get(r);
    const points=r.points,samples=[{...points[0]}];let start=points[0];
    for(let i=1;i<points.length-1;i++){
      const control=points[i],end={x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2};
      const steps=Math.max(8,Math.ceil((Math.hypot(start.x-control.x,start.y-control.y)+Math.hypot(control.x-end.x,control.y-end.y))/24));
      for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;samples.push({x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y});}start=end;
    }
    const last=points[points.length-1],n=Math.max(1,Math.ceil(Math.hypot(last.x-start.x,last.y-start.y)/24));
    for(let j=1;j<=n;j++)samples.push({x:start.x+(last.x-start.x)*j/n,y:start.y+(last.y-start.y)*j/n});
    // Small natural meanders stay close to the original playable river corridor.
    const original=samples.map(p=>({...p}));
    for(let i=1;i<samples.length-1;i++){
      const a=original[i-1],b=original[i+1],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
      const bend=(Math.sin(i*.145)*12+Math.sin(i*.31+1.7)*4)*Math.min(1,i/8,(samples.length-i)/8);
      samples[i].x+=-(b.y-a.y)/d*bend;samples[i].y+=(b.x-a.x)/d*bend;
    }
    for(let i=0;i<samples.length;i++){
      const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
      samples[i].nx=-(b.y-a.y)/d;samples[i].ny=(b.x-a.x)/d;
      samples[i].radius=r.width*.5*(1+.16*Math.sin(i*.37)+.08*(noise(i,points[0].x)-.5));
    }
    const ribbon=extra=>{
      const left=[],right=[];samples.forEach(p=>{const w=Math.max(2,p.radius+extra);left.push([p.x+p.nx*w,p.y+p.ny*w]);right.push([p.x-p.nx*w,p.y-p.ny*w]);});return left.concat(right.reverse());
    };
    const data={samples,ribbons:[ribbon(15),ribbon(9),ribbon(4),ribbon(0),ribbon(-8)]};riverCache.set(r,data);return data;
  }
  function paintedPath(c,image,index,points,width,inView){
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),step=Math.max(18,width*.62),count=Math.max(1,Math.ceil(length/step));
      for(let j=0;j<=count;j++){
        const t=j/count,x=a.x+dx*t,y=a.y+dy*t;
        if(inView(x,y,width*2))terrainStamp(c,image,index,x,y,width*2.15,width*2.1,angle);
      }
    }
  }
  function water(c,g,t,inView){
    const image=loadAtlas('terrain');if(!image)return;
    for(const w of g.terrain.waters){
      if(inView(w.x,w.y,Math.max(w.rx,w.ry)+60))terrainStamp(c,image,14,w.x,w.y,w.rx*2.4,w.ry*2.4);
    }
    for(const river of g.terrain.rivers)paintedPath(c,image,15,river.points,river.width,inView);
  }
  function decorationData(g){
    if(decorCache.reference===g.terrain.waters)return decorCache.items;
    const items=[],landmarks=[...g.houses.map(h=>({...h.castle,r:180})),...g.objectives.map(o=>({...o,r:o.r+65})),...g.blacksmiths.map(s=>({...s,r:115}))];
    const safe=(x,y,margin=0)=>{
      if(landmarks.some(p=>Math.hypot(p.x-x,p.y-y)<p.r+margin))return false;
      if(g.terrain.waters.some(w=>((x-w.x)/(w.rx+22+margin))**2+((y-w.y)/(w.ry+22+margin))**2<1))return false;
      if(g.terrain.forestRects.some(f=>x>f.x-30&&x<f.x+f.w+30&&y>f.y-30&&y<f.y+f.h+30))return false;
      for(const river of g.terrain.rivers){const points=riverGeometry(river).samples;for(let i=0;i<points.length;i+=3)if(Math.hypot(points[i].x-x,points[i].y-y)<river.width*.65+margin)return false;}
      return true;
    };
    for(let gy=0;gy<45;gy++)for(let gx=0;gx<42;gx++){
      const x=55+gx*118+(noise(gx,gy)-.5)*70,y=55+gy*118+(noise(gy,gx+19)-.5)*70,q=noise(gx+200,gy+99);
      if(!safe(x,y,5))continue;
      if(q>.85){const count=1+Math.floor(noise(gx+31,gy)*3);for(let k=0;k<count;k++){const xx=x+(noise(k,gx)-.5)*78,yy=y+(noise(k,gy)-.5)*55;if(safe(xx,yy,15))items.push({x:xx,y:yy,type:'tree',variant:Math.floor(noise(gx+k,gy+2)*4),size:68+noise(k,gx+5)*30});}}
      else if(q>.68)items.push({x,y,type:'bush',variant:1,size:31+noise(gx,gy+4)*15});
      else if(q>.58)items.push({x,y,type:'rock',variant:0,size:29+noise(gx,gy+4)*19});
      else if(q>.54)items.push({x,y,type:'log',variant:2,size:36+noise(gx,gy+4)*17});
      else if(q>.28)items.push({x,y,type:'flowers',variant:Math.floor(q*12),size:14+noise(gx,gy+4)*15});
    }
    items.sort((a,b)=>a.y-b.y);decorCache={reference:g.terrain.waters,items};return items;
  }
  function decorations(c,g,inView){
    const environment=loadAtlas('environment'),painted=loadAtlas('terrain');
    for(const d of decorationData(g)){
      if(!inView(d.x,d.y,d.size+30))continue;
      if(d.type==='tree'){
        if(environment)environmentSprite(c,environment,d.variant,0,d.x,d.y,d.size,d.size);
      }else if(d.type==='flowers'){
        if(painted)terrainStamp(c,painted,11,d.x,d.y,d.size*2.3,d.size*1.8);
      }else if(environment)environmentSprite(c,environment,d.variant,1,d.x,d.y,d.size,d.size);
    }
  }
  function terrain(c,g,view,inView){
    const sx=Math.floor(view.x/512),ex=Math.ceil((view.x+view.w)/512),sy=Math.floor(view.y/512),ey=Math.ceil((view.y+view.h)/512);
    for(let y=sy;y<=ey;y++)for(let x=sx;x<=ex;x++)c.drawImage(groundChunk(x,y),x*512,y*512);
    const image=loadAtlas('terrain'),environment=loadAtlas('environment');
    if(image){
      for(const h of g.terrain.hills)if(inView(h.x,h.y,h.r+40))terrainStamp(c,image,6,h.x,h.y,h.r*2.3,h.r*1.9);
      for(const d of g.terrain.dirt)if(inView(d.x,d.y,d.r+30))terrainStamp(c,image,7,d.x,d.y,d.r*1.65,d.r*1.3);
      for(const road of g.terrain.roads||[])paintedPath(c,image,8,road.points,road.width,inView);
    }
    water(c,g,g.time,inView);
    if(image){
      for(const m of g.terrain.marshes||[])if(inView(m.x,m.y,Math.max(m.rx,m.ry)+40)){
        terrainStamp(c,image,2,m.x,m.y,m.rx*2.35,m.ry*2.35);
        for(let j=0;j<6;j++){const a=j/6*TAU;terrainStamp(c,image,j%2?3:2,m.x+Math.cos(a)*m.rx*.6,m.y+Math.sin(a)*m.ry*.55,m.rx*.75,m.ry*.85);}
      }
      for(const r of g.terrain.ridges||[])if(inView(r.x+r.w/2,r.y+r.h/2,Math.max(r.w,r.h))){
        const vertical=r.h>r.w;terrainStamp(c,image,4,r.x+r.w/2,r.y+r.h/2,(vertical?r.h:r.w)*1.25,(vertical?r.w:r.h)*1.65,vertical?Math.PI/2:0);
      }
      for(const r of g.terrain.ruins||[])if(inView(r.x,r.y,r.r+70)){
        terrainStamp(c,image,5,r.x-10,r.y+7,r.r*2.3,r.r*2.15);terrainStamp(c,image,13,r.x+r.r*.6,r.y-r.r*.32,r.r*.85,r.r*1.0);
      }
    }
    for(const s of g.terrain.stones){
      if(!inView(s.x,s.y,35)||g.terrain.waters.some(w=>((s.x-w.x)/(w.rx+16))**2+((s.y-w.y)/(w.ry+16))**2<1))continue;
      if(image)terrainStamp(c,image,12,s.x,s.y,23+s.r*2.8,23+s.r*2.8);
      else if(environment)environmentSprite(c,environment,0,1,s.x,s.y,16+s.r*2.2,16+s.r*2.2);
    }
    for(const f of g.terrain.forestRects){
      if(f.x>view.x+view.w+70||f.y>view.y+view.h+100||f.x+f.w<view.x-70||f.y+f.h<view.y-70)continue;
      for(let yy=25;yy<f.h;yy+=65)for(let xx=25;xx<f.w;xx+=67){
        const x=f.x+xx+(noise(xx,yy)-.5)*15,y=f.y+yy+(noise(yy,xx)-.5)*13;if(!inView(x,y,105))continue;
        if(image)terrainStamp(c,image,noise(xx+f.x,yy+f.y)>.55?1:0,x,y,123,123);
        else if(environment)environmentSprite(c,environment,Math.floor(noise(xx,yy)*4),0,x,y,95,105);
      }
    }
    decorations(c,g,inView);
  }
  function tower(c,x,y,color,roof='#4a5960'){
    ellipse(c,x+5,y+10,19,8,'rgba(27,40,28,.3)');
    const gr=c.createLinearGradient(x-16,y,x+17,y);gr.addColorStop(0,'#d3c9a9');gr.addColorStop(.4,'#b5b39b');gr.addColorStop(1,'#767f77');
    c.fillStyle=gr;c.fillRect(x-15,y-42,30,49);c.strokeStyle='#53635a';c.lineWidth=1;c.strokeRect(x-15,y-42,30,49);
    for(let k=0;k<4;k++){line(c,x-14,y-33+k*10,x+14,y-33+k*10,'rgba(69,83,71,.4)',1);line(c,x+(k%2?-1:-8),y-33+k*10,x+(k%2?-1:-8),y-24+k*10,'rgba(69,83,71,.3)',1);}
    poly(c,[[x-20,y-43],[x,y-65],[x+20,y-43]],roof,'#3a4b43',1);poly(c,[[x,y-65],[x+20,y-43],[x+2,y-43]],'#34494c');
    line(c,x-19,y-42,x+19,y-42,'#d6d1b1',3);c.fillStyle='#273e38';c.fillRect(x-3,y-30,6,13);line(c,x,y-30,x,y-17,'#bbc2a6',1);
    c.fillStyle=color;c.fillRect(x-7,y-10,14,14);poly(c,[[x-7,y+4],[x,y],[x+7,y+4]],color);
  }
  function keep(c,h,api){
    const ruler=api.getHouse(h.controller),color=ruler?.color||h.color,captured=h.controller!==h.id,g=api.game;
    c.save();c.translate(h.castle.x,h.castle.y);
    const environment=loadAtlas('environment');
    if(environment){
      ellipse(c,5,21,91,35,'rgba(34,45,27,.20)');
      environmentSprite(c,environment,h.controller==='player'?0:1,3,0,0,210,210);
      castleAuthority(c,h,g,api,color,captured);
      c.restore();return;
    }
    ellipse(c,7,30,86,30,'rgba(34,45,27,.24)');
    ellipse(c,0,14,84,53,'rgba(183,171,124,.42)');
    for(let j=0;j<35;j++){const x=(noise(j,h.castle.x)-.5)*140,y=(noise(j,h.castle.y)-.5)*67+23;ellipse(c,x,y,2+noise(j,1)*2,1.2,'rgba(208,197,153,.32)');}
    // Courtyard, rear battlements, and the central keep.
    poly(c,[[-49,-28],[49,-28],[57,33],[-57,33]],'#aaa98b','#66735d',2);
    c.fillStyle='#899481';c.fillRect(-49,-42,98,18);c.fillStyle='#c7c4a3';c.fillRect(-49,-44,98,5);
    for(let x=-47;x<49;x+=15){c.fillStyle='#c7c4a3';c.fillRect(x,-50,8,10);}
    const wall=c.createLinearGradient(-31,0,32,0);wall.addColorStop(0,'#d3caac');wall.addColorStop(.65,'#b8b69d');wall.addColorStop(1,'#879383');c.fillStyle=wall;c.fillRect(-31,-52,62,75);
    poly(c,[[-38,-53],[0,-78],[38,-53]],'#59656a','#354c47',1.5);poly(c,[[0,-78],[38,-53],[1,-53]],'#374f51');
    for(let y=-38;y<19;y+=10){line(c,-30,y,30,y,'rgba(91,104,85,.29)',1);for(let x=-20+(y%20?6:0);x<30;x+=19)line(c,x,y,x,y+10,'rgba(91,104,85,.24)',1);}
    c.fillStyle='#435347';c.beginPath();c.roundRect(-13,-4,26,34,[13,13,0,0]);c.fill();c.fillStyle='#5e5039';c.beginPath();c.roundRect(-10,-1,20,31,[10,10,0,0]);c.fill();for(let x=-8;x<10;x+=5)line(c,x,5,x,28,'#312f24',1);
    c.fillStyle='#233e39';c.fillRect(-19,-34,9,15);c.fillRect(10,-34,9,15);line(c,-14,-34,-14,-19,'#d0c9a2');line(c,14,-34,14,-19,'#d0c9a2');
    tower(c,-48,15,color);tower(c,48,15,color);
    castleAuthority(c,h,g,api,color,captured);
    c.restore();
  }
  function castleAuthority(c,h,g,api,color,captured){
    const ruler=api.getHouse(h.controller),wave=Math.sin(g.time*3+h.castle.x)*3;
    // The large pennant and front rampart cloth always show the CURRENT ruler.
    line(c,34,-125,34,-203,'#e9d69e',3);ellipse(c,34,-206,4,4,'#ecd491');
    poly(c,[[36,-202],[90,-195+wave],[82,-163+wave],[36,-171]],color,'#e3d3a2',1.4);houseCrest(c,h.controller,58,-185,.95);
    for(const x of [-51,51]){poly(c,[[x-10,-94],[x+10,-94],[x+10,-61],[x,-52],[x-10,-61]],color,'#e5d39b',1);houseCrest(c,h.controller,x,-77,.63);}
    c.strokeStyle=color;c.lineWidth=captured?3:1.5;c.globalAlpha=captured?.85:.46;c.beginPath();c.ellipse(0,23,99,43,0,0,TAU);c.stroke();c.globalAlpha=1;
    const age=Number.isFinite(h.lastCapturedAt)&&h.lastCapturedAt>=0?g.time-h.lastCapturedAt:99;
    if(age>=0&&age<5){
      const fade=1-age/5;c.save();c.globalAlpha=fade*.75;c.strokeStyle='#ffe4a0';c.lineWidth=2.5;const pulse=(age%1.25)/1.25;c.beginPath();c.ellipse(0,23,102+pulse*33,44+pulse*13,0,0,TAU);c.stroke();
      for(let i=0;i<14;i++){const a=i/14*TAU+age*.25,r=70+(i%3)*14;ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.48-35-age*8,1.5,2.5,i%2?'#f7d991':color);}c.restore();
    }
    // Keep status plates above the celebration pulse for immediate ownership recognition.
    label(c,h.name.replace('House ',''),0,57,11,'#f8edcc');
    if(h.id==='player'&&h.controller==='player')label(c,'YOUR CASTLE',0,76,9,'#b8e3ff');
    else if(captured){label(c,h.controller==='player'?'CAPTURED':'ENEMY CAPTURE',0,76,12,color);label(c,`${ruler?.name.replace('House ','')||'Rival'} controls ${h.name.replace('House ','')}`,0,95,8,'#f3e7c8');}
  }
  function forge(c,s,t){
    c.save();c.translate(s.x,s.y);ellipse(c,7,27,59,25,'rgba(31,43,27,.24)');
    const environment=loadAtlas('environment');
    if(environment){environmentSprite(c,environment,1,2,0,13,142,142);const glow=c.createRadialGradient(-25,-12,2,-25,-12,22);glow.addColorStop(0,`rgba(255,187,72,${.15+Math.sin(t*4)*.04})`);glow.addColorStop(1,'rgba(255,145,42,0)');ellipse(c,-25,-12,24,20,glow);label(c,'BLACKSMITH',0,49,8,'#edddb0');c.restore();return;}
    c.fillStyle='#9b9d85';c.fillRect(-39,-22,78,54);poly(c,[[-48,-24],[-8,-56],[48,-24]],'#74604a','#445449',1.5);poly(c,[[-8,-56],[48,-24],[0,-24]],'#574b3a');
    c.fillStyle='#737b69';c.fillRect(15,-58,14,44);c.fillStyle='#b4b297';c.fillRect(12,-60,20,5);
    c.fillStyle='#38443a';c.beginPath();c.roundRect(-23,-2,27,33,[12,12,0,0]);c.fill();
    const glow=c.createRadialGradient(-10,15,2,-10,15,23);glow.addColorStop(0,'rgba(255,190,72,.85)');glow.addColorStop(1,'rgba(255,135,40,0)');ellipse(c,-10,15,24,22,glow);
    poly(c,[[-18,24],[-13,6],[-8,16],[-3,5],[0,24]],'#e8a547');poly(c,[[-15,24],[-8,12],[-5,24]],'#ffe09b');
    c.fillStyle='#3e4943';c.fillRect(12,14,23,7);c.fillRect(17,20,14,8);poly(c,[[9,14],[15,7],[36,9],[36,14]],'#a5aaa0');
    for(let i=0;i<3;i++){const y=-63-((t*9+i*16)%45);ellipse(c,23+Math.sin(t+i)*5,y,5+i*2,4+i,'rgba(213,212,182,.12)');}
    label(c,'BLACKSMITH',0,49,8,'#edddb0');c.restore();
  }
  function objective(c,o,g,api){
    c.save();c.translate(o.x,o.y);const owner=o.controller?api.getHouse(o.controller)?.color:'#d4c99f';
    const hasFighters=g.students.some(s=>s.state!=='knocked'&&Math.hypot(s.x-o.x,s.y-o.y)<o.r);
    c.fillStyle='rgba(200,199,148,.08)';c.beginPath();c.arc(0,0,o.r,0,TAU);c.fill();
    c.strokeStyle=owner+'77';c.lineWidth=2;c.setLineDash([5,7]);c.stroke();c.setLineDash([]);
    for(let a=0;a<TAU;a+=Math.PI/6){const x=Math.cos(a)*(o.r-3),y=Math.sin(a)*(o.r-3);ellipse(c,x,y,4,3,'#aaa789');ellipse(c,x-1,y-1,2.2,1.4,'#d1c7a1');}
    ellipse(c,5,17,35,16,'rgba(25,40,31,.24)');ellipse(c,0,13,31,16,'#9c9d83');ellipse(c,0,8,29,15,'#c7c1a0');
    const environment=loadAtlas('environment');
    if(environment){
      if(o.type==='forge')environmentSprite(c,environment,1,2,0,10,83,83);
      else if(o.type==='sanctum')environmentSprite(c,environment,2,2,0,10,88,88);
      else if(o.type==='rally')environmentSprite(c,environment,3,2,0,10,84,84);
      else{environmentSprite(c,environment,0,2,0,10,65,65);line(c,-22,2,18,-31,'#d9ddc1',3);line(c,-18,-28,19,3,'#e0e3c9',3);}
    }else if(o.type==='forge'){
      c.fillStyle='#687670';c.fillRect(-15,-12,29,23);poly(c,[[-23,-19],[-12,-29],[22,-25],[19,-15],[-4,-11]],'#9baba3','#4c6259');c.fillStyle='#3b514c';c.fillRect(-7,-11,14,19);c.fillStyle='#efb75b';c.fillRect(-3,-22,7,5);
    }else if(o.type==='rally'){
      line(c,-7,8,-7,-51,'#c1b78d',4);poly(c,[[-5,-51],[31,-43],[21,-31],[-5,-35]],owner,'#536451');poly(c,[[1,-46],[8,-44],[8,-38],[1,-40]],'#f5e9bc');
    }else if(o.type==='arsenal'){
      line(c,-17,8,16,-39,'#d4d6bb',5);line(c,-14,-36,18,8,'#c5cbb7',5);line(c,-19,-1,-7,7,'#a18448',4);line(c,8,5,22,-3,'#a18448',4);poly(c,[[-9,-7],[0,-12],[12,-7],[9,8],[0,15],[-8,7]],owner,'#d4c18f',2);
    }else{
      c.fillStyle='#9fa990';c.fillRect(-10,-31,20,36);poly(c,[[-16,-31],[0,-47],[16,-31]],'#c7cbae','#657d67');c.fillStyle='#e1ddae';c.fillRect(-3,-29,6,22);c.fillRect(-11,-21,22,6);ellipse(c,0,-19,6,6,'rgba(237,229,160,.4)');
    }
    const entries=Object.entries(o.progress||{}).sort((a,b)=>b[1]-a[1]);const lead=entries[0];
    const contested=!!o.contested||new Set(g.students.filter(s=>s.state!=='knocked'&&Math.hypot(s.x-o.x,s.y-o.y)<=o.r).map(s=>s.controller)).size>1;
    if(lead&&lead[1]>0&&(hasFighters||!o.controller)){
      c.lineWidth=4;c.strokeStyle='rgba(30,44,35,.5)';c.beginPath();c.arc(0,0,o.r-10,0,TAU);c.stroke();c.strokeStyle=contested?'#f3c57b':api.getHouse(lead[0])?.color||'#e9d7a4';c.beginPath();c.arc(0,0,o.r-10,-Math.PI/2,-Math.PI/2+TAU*clamp(lead[1]/8,0,1));c.stroke();
    }
    label(c,o.type.toUpperCase(),0,41,9,owner);if(contested)label(c,'CONTESTED',0,58,8,'#f1ca88');c.restore();
  }
  function supplies(c,g,api,inView){
    const environment=loadAtlas('environment');
    for(const b of g.lootBoxes){if(!b.alive||!visiblePoint(api,b.x,b.y)||!inView(b.x,b.y,50))continue;c.save();c.translate(b.x,b.y);const k=b.big?1.2:1;c.scale(k,k);ellipse(c,4,12,22,9,'rgba(27,39,27,.27)');
      if(environment){environmentSprite(c,environment,0,2,0,13,48,48);if(b.rare){c.strokeStyle='rgba(237,205,123,.6)';c.lineWidth=1;c.beginPath();c.ellipse(0,13,25,13,0,0,TAU);c.stroke();}if(b.hp<b.maxHp){c.fillStyle='#293d32';c.fillRect(-16,22,32,3);c.fillStyle='#e7ca7f';c.fillRect(-16,22,32*b.hp/b.maxHp,3);}c.restore();continue;}
      poly(c,[[-16,-9],[12,-12],[21,-4],[20,16],[-16,16]],'#7b5737','#493e29',1.5);poly(c,[[-16,-9],[12,-12],[21,-4],[-8,-1]],b.rare?'#d8b66b':'#b18b55');poly(c,[[12,-12],[21,-4],[20,16],[11,11]],'#684d32');c.fillStyle=b.rare?'#d9c18a':'#b4a278';c.fillRect(-10,-7,4,22);c.fillRect(6,-9,4,23);line(c,-15,3,11,0,'#392e21',1);c.fillStyle='#e8d297';c.fillRect(-1,1,6,7);
      if(b.rare){c.strokeStyle='rgba(239,208,126,.5)';c.lineWidth=1;c.beginPath();c.ellipse(0,12,27,15,0,0,TAU);c.stroke();}
      if(b.hp<b.maxHp){c.fillStyle='#293d32';c.fillRect(-16,22,32,3);c.fillStyle='#e7ca7f';c.fillRect(-16,22,32*b.hp/b.maxHp,3);}c.restore();}
    for(const l of g.groundLoot){if(!l.alive||!visiblePoint(api,l.x,l.y)||!inView(l.x,l.y,25))continue;c.save();c.translate(l.x,l.y);ellipse(c,0,2,9,5,'rgba(242,216,133,.24)');poly(c,[[-6,1],[0,-8],[6,1],[0,7]],'#e9c97e','#6c6544');c.restore();}
    for(const b of g.barricades){if(!b.alive||!visibleEntity(api,b)||!inView(b.x,b.y,70))continue;c.save();c.translate(b.x,b.y);if(environment){environmentSprite(c,environment,2,3,0,b.h*.5,Math.max(66,b.w+12),58);c.restore();continue;}c.fillStyle='rgba(24,39,27,.2)';c.fillRect(-b.w/2+4,-b.h/2+7,b.w,b.h);for(let x=-b.w/2+3;x<b.w/2;x+=9){poly(c,[[x,-b.h/2],[x+3,-b.h/2-7],[x+7,-b.h/2],[x+7,b.h/2],[x,b.h/2]],'#8a7148','#514c31');line(c,x+2,-b.h/2,x+2,b.h/2,'#b49a65',1);}line(c,-b.w/2,0,b.w/2,0,'#5e5134',3);c.restore();}
    for(const trap of g.traps){if(!trap.alive||trap.controller!=='player'||!inView(trap.x,trap.y,20))continue;c.save();c.translate(trap.x,trap.y);ellipse(c,0,0,9,6,'rgba(36,49,34,.4)');c.strokeStyle='#c0b390';c.lineWidth=1.7;c.beginPath();c.ellipse(0,0,8,5,0,0,TAU);c.stroke();for(let a=0;a<TAU;a+=Math.PI/4)line(c,Math.cos(a)*8,Math.sin(a)*5,Math.cos(a)*4,Math.sin(a)*2,'#d6caa5');c.restore();}
  }
  function standard(c,st,g,api){
    if(st.carriedBy)return;
    const targeted=!!g.flagTargetId&&(g.flagTargetId===st.houseId||g.flagTargetId===st.id);
    const channel=!!st.captureStudentId;
    // Secured trophies do not stack on top of the original banner at home.
    if(st.controller==='player'&&st.houseId!=='player'&&!st.dropped&&!targeted&&!channel)return;
    const home=api.getHouse(st.homeOwner||st.houseId),owner=api.getHouse(st.controller||home?.controller),enemy=st.controller!=='player';
    const col=targeted?home?.color||'#e1d7ae':owner?.color||home?.color||'#e1d7ae';
    c.save();c.translate(st.x,st.y);ellipse(c,2,8,11,4,'rgba(32,45,27,.3)');
    if(targeted){
      const pulse=.5+.5*Math.sin(g.time*4);const glow=c.createRadialGradient(0,0,5,0,0,48);glow.addColorStop(0,'rgba(251,215,122,.25)');glow.addColorStop(1,'rgba(251,215,122,0)');ellipse(c,0,0,49,27,glow);
      c.strokeStyle='#f5d481';c.lineWidth=2.3;c.beginPath();c.ellipse(0,4,28+pulse*5,15+pulse*3,0,0,TAU);c.stroke();
      const bob=Math.sin(g.time*4)*3;poly(c,[[-8,-94+bob],[8,-94+bob],[0,-82+bob]],'#ffe1a0','#6c5c35',1);
      label(c,'CAPTURE FLAG',0,channel?-124:-110,11,'#ffe1a0');
    }else if(st.dropped){c.strokeStyle='#e9ca83';c.lineWidth=2;c.beginPath();c.ellipse(0,0,23,13,0,0,TAU);c.stroke();}
    const top=targeted?-76:enemy?-61:-48,flagWidth=targeted?44:enemy?36:30;
    line(c,0,12,0,top,'#ead8aa',targeted?3:2.5);ellipse(c,0,top-3,3,3,'#f0d792');const wave=Math.sin(g.time*3+st.y)*3;
    poly(c,[[1,top],[flagWidth,top+5+wave],[flagWidth-5,top+28+wave],[1,top+22]],col,'rgba(244,225,171,.8)',1);houseCrest(c,st.houseId,flagWidth*.47,top+13,flagWidth/39);
    if(channel){
      const duration=Math.max(.1,Number(st.captureDuration)||3),progress=clamp(Number(st.captureProgress)/duration,0,1),contested=!!st.captureContested;
      const captureColor=contested?'#eea394':api.getHouse(st.captureController)?.color||'#f5d481';
      c.fillStyle='rgba(20,33,29,.95)';c.beginPath();c.roundRect(-43,-103,86,9,4);c.fill();c.fillStyle=captureColor;c.beginPath();c.roundRect(-41,-101,82*progress,5,2);c.fill();
      label(c,contested?'CONTESTED':`${Math.max(0,duration-Number(st.captureProgress)).toFixed(1)}s TO TAKE`,0,-111,8,contested?'#efb4a5':'#f6dfab');
      const capturer=g.students.find(s=>s.id===st.captureStudentId);if(capturer&&visibleEntity(api,capturer)){c.save();c.globalAlpha=.7;c.setLineDash([3,4]);line(c,capturer.x-st.x,capturer.y-st.y-10,0,-8,captureColor,1.4);c.restore();}
    }
    c.restore();
  }
  function horse(c,col,phase){
    ellipse(c,0,9,15,8,'#73503a');ellipse(c,-6,5,10,7,'#9b7651');
    line(c,-9,13,-10+phase*2,24,'#4d3f32',3);line(c,7,13,8-phase*2,24,'#4d3f32',3);
    line(c,-3,13,-1-phase*2,24,'#8a6649',3);line(c,11,11,13+phase*2,21,'#8a6649',3);
    poly(c,[[9,6],[10,-10],[15,-16],[20,-13],[21,-5],[16,1],[16,11]],'#a17b55','#5d4c36',1);poly(c,[[12,-12],[13,-20],[16,-14]],'#5b4632');line(c,11,-9,9,1,'#493a2b',4);line(c,-13,6,-20,13,'#3a3329',3);c.fillStyle=col;c.fillRect(-9,2,17,10);line(c,0,3,10,-5,'#d4c8a0',1);ellipse(c,18,-11,1.2,1.2,'#252d25');
  }
  function attackView(s,g){
    const a=s.attackAction;if(!a)return null;
    const target=a.targetType==='box'?g.lootBoxes.find(t=>t.id===a.targetId):a.targetType==='barricade'?g.barricades.find(t=>t.id===a.targetId):g.students.find(t=>t.id===a.targetId);
    const facing=s.facingDir==='left'?{x:-1,y:0}:s.facingDir==='right'?{x:1,y:0}:s.facingDir==='up'?{x:0,y:-1}:{x:0,y:1};
    let dx=target?target.x-s.x:facing.x,dy=target?target.y-s.y:facing.y;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
    const progress=clamp(Number.isFinite(a.progress)?a.progress:a.phase==='windup'?Number(a.elapsed)/(a.windup||.3):(Number(a.elapsed)-(a.windup||0))/(a.recovery||.3),0,1);
    const thrust=a.phase==='windup'?-2*progress:Math.sin(progress*Math.PI)*5;
    return {action:a,progress,dx,dy,angle:Math.atan2(dy,dx),offsetX:dx*thrust,offsetY:dy*thrust,lean:dx*(a.phase==='windup'?-.055:.10*Math.sin(progress*Math.PI))};
  }
  function carrierBeacon(c,s,g,api){
    const home=api.getHouse(s.carryingStandard),ruler=api.getHouse(s.controller),gold='#f4d384',col=home?.color||gold;
    const targeted=!!g.flagTargetId&&g.flagTargetId===s.carryingStandard,top=s.mount?-104:-89,pulse=.5+.5*Math.sin(g.time*5);
    const trail=carrierTrails.get(s.id)||[];if(trail.length&&g.time<trail[trail.length-1].time)trail.length=0;
    if(!trail.length||g.time-trail[trail.length-1].time>.12){trail.push({x:s.x,y:s.y,time:g.time});while(trail.length>14||trail[0]&&g.time-trail[0].time>2.2)trail.shift();carrierTrails.set(s.id,trail);}
    for(let i=0;i<trail.length-1;i++){const p=trail[i];c.globalAlpha=clamp(1-(g.time-p.time)/2.2,0,.6);ellipse(c,p.x,p.y+10,2.3,1.2,gold);}c.globalAlpha=1;
    c.save();c.translate(s.x,s.y);const glow=c.createRadialGradient(0,8,4,0,8,38);glow.addColorStop(0,'rgba(244,211,132,.19)');glow.addColorStop(1,'rgba(244,211,132,0)');ellipse(c,0,8,40,23,glow);
    c.strokeStyle=gold;c.lineWidth=2.5;c.beginPath();c.ellipse(0,s.mount?17:10,28+pulse*3,14+pulse*2,0,0,TAU);c.stroke();c.strokeStyle=ruler?.color||gold;c.lineWidth=1.3;c.beginPath();c.ellipse(0,s.mount?17:10,23,11,0,0,TAU);c.stroke();
    line(c,-19,8,-19,top,'#ead6a1',3);ellipse(c,-19,top-4,3.7,3.7,gold);const wave=Math.sin(g.time*5+s.x)*4;
    poly(c,[[-17,top],[23,top+5+wave],[17,top+30+wave],[-17,top+23]],col,'#f3dd9e',1.4);houseCrest(c,s.carryingStandard,0,top+15,.85);
    label(c,'FLAG CARRIER',0,top-17,10,'#ffe4a6');
    if(targeted){const bob=Math.sin(g.time*4)*3;poly(c,[[-7,top-40+bob],[7,top-40+bob],[0,top-30+bob]],gold);if(s.controller==='player')label(c,'RETURN TO YOUR CASTLE',0,top-49,8,'#dbeec5');}
    c.restore();
  }
  const championArmor=s=>String(s.armor||'').startsWith('Champion_');
  function paintedArmor(c,s,back,championImage,championMetadata){
    if(s.armor==='None'||!s.armor)return;
    const armor=loadAtlas('armor'),heavy=s.armor==='Heavy'||championArmor(s);
    if(armor){
      const sw=armor.naturalWidth/2,sh=armor.naturalHeight/2,col=back?1:0,row=heavy?1:0;
      const width=heavy?31:25,height=heavy?29:25,y=s.mount?-48:-30;
      c.drawImage(armor,col*sw,row*sh,sw,sh,-width/2,y,width,height);
    }
    // Horse, bow and staff poses remain the functional faction animation. The
    // champion's own painted helmet and pauldrons replace the ordinary head.
    if(championImage){
      const cw=championImage.naturalWidth/8,ch=championImage.naturalHeight/2;
      const frame=championMetadata?.frames?.[(back?1:0)*8];
      const sx=frame?frame.x:0,sy=frame?frame.y:back?ch:0,sw=frame?frame.w:cw,sh=(frame?frame.h:ch)*.48;
      const scale=32/(championMetadata?.referenceHeight||ch*.86),width=sw*scale*1.85,height=sh*scale*1.85;
      c.drawImage(championImage,sx,sy,sw,sh,-width/2,s.mount?-70:-52,width,height);
    }
  }
  function championInsignia(c,s){
    if(!championArmor(s))return;
    const y=s.mount?-58:-55;
    label(c,'★',-23,y,10,'#ffe3a0',true);
    if(!s.mount&&s.weapon==='Spear')label(c,'SPEAR',23,y,6,'#fff0c4',true);
    if(!s.mount&&s.weapon==='None')label(c,'UNARMED',23,y,6,'#fff0c4',true);
  }
  function rasterSoldier(c,s,g,api){
    const factionId=s.origHouse||s.controller,faction=loadAtlas('faction:'+factionId),champion=championArmor(s)?loadAtlas('champion:'+factionId):null;
    const championMetadata=window.AcademyAssets?.championFrames?.[factionId];
    const fullChampion=!!champion&&!s.mount&&!['Bow','Longbow'].includes(s.weapon)&&s.item!=='Medkit';
    const image=fullChampion?champion:faction||loadAtlas(s.mount?'cavalry':'units');if(!image)return false;
    const h=api.getHouse(s.origHouse||s.controller),controller=api.getHouse(s.controller),color=h?.color||'#b6b995',ally=controller?.color||color;
    const selected=g.selected.has(s.id),back=s.facingDir==='up';
    let row=fullChampion?(back?1:0):s.mount?(faction?(back?9:8):(back?1:0)):s.item==='Medkit'?(back?7:6):(s.weapon==='Bow'||s.weapon==='Longbow')?(back?5:4):s.weapon==='Spear'?(back?3:2):(back?1:0);
    const rows=fullChampion?2:faction?10:s.mount?2:8,cw=image.naturalWidth/8,ch=image.naturalHeight/rows;
    let seed=0;for(let i=0;i<s.id.length;i++)seed=(seed+s.id.charCodeAt(i)*(i+1))%100;
    const moving=s.state==='move'||(s.path?.length>s.pathIndex&&s.state!=='idle'&&s.state!=='knocked');
    let frame=moving?1+(Math.floor(g.time*(s.mount?10:9)+seed)%5):0;
    if(s.attackAction)frame=s.attackAction.phase==='windup'?6:7;
    else{if(s.swing>0)frame=s.swing>.14?6:7;if(s.draw>0)frame=s.draw>.09?6:7;}
    if(s.state==='knocked')frame=0;
    const metadata=fullChampion?championMetadata:faction?window.AcademyAssets?.factionFrames?.[factionId]:null;
    const cell=metadata?.frames?.[row*8+frame];
    const rect=cell?{x:cell.x,y:cell.y,w:cell.w,h:cell.h}:{x:frame*cw,y:row*ch,w:cw,h:ch};
    const referenceHeight=metadata?.referenceHeight||ch;
    const anchorX=cell?.anchorX??cw/2,anchorY=cell?.anchorY??ch*.88;
    const texture=fullChampion?champion:faction||teamAtlas(image,color);
    c.save();c.translate(s.x,s.y);
    if(s.state==='knocked'){
      c.globalAlpha=.42;c.rotate(Math.PI/2);const z=45/referenceHeight;c.drawImage(texture,rect.x,rect.y,rect.w,rect.h,-anchorX*z,-anchorY*z,rect.w*z,rect.h*z);c.restore();return true;
    }
    const mounted=s.mount,height=mounted?77:fullChampion?62:50,z=height/referenceHeight;
    ellipse(c,2,mounted?17:9,mounted?21:15,mounted?7:5,'rgba(20,34,27,.29)');
    c.strokeStyle=selected?'#d3efff':s.controller==='player'?'rgba(144,203,244,.65)':ally+'99';c.lineWidth=selected?2:1.1;c.beginPath();c.ellipse(0,mounted?16:9,mounted?24:18,mounted?12:9,0,0,TAU);c.stroke();
    if(selected){c.fillStyle='rgba(141,204,243,.12)';c.fill();}
    c.save();const attack=attackView(s,g);if(attack){c.translate(attack.offsetX,attack.offsetY);c.rotate(attack.lean);}
    const damagedAge=Number.isFinite(s.lastDamagedAt)?g.time-s.lastDamagedAt:99;if(damagedAge>=0&&damagedAge<.16){const bump=Math.sin(damagedAge/.16*Math.PI)*2.5;c.translate(s.facingDir==='left'?bump:-bump,-bump*.3);}
    if(s.facingDir==='left')c.scale(-1,1);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(texture,rect.x,rect.y,rect.w,rect.h,-anchorX*z,(mounted?16:9)-anchorY*z,rect.w*z,rect.h*z);
    if(!fullChampion)paintedArmor(c,s,back,champion,championMetadata);
    c.restore();championInsignia(c,s);
    if(s.burnUntil>g.time){for(let j=0;j<3;j++)poly(c,[[-11+j*9,6],[-10+j*9,-5-Math.sin(g.time*12+j)*5],[-5+j*9,4]],j%2?'#f7c26a':'#d88a3e');}
    if(s.hp<s.maxHp||selected||s.carryingStandard){
      const y=mounted?-75:fullChampion?-65:s.carryingStandard?-58:-42;c.fillStyle='rgba(21,39,32,.9)';c.beginPath();c.roundRect(-16,y,32,5,2);c.fill();c.fillStyle=s.hp/s.maxHp>.5?'#b0d8a2':s.hp/s.maxHp>.25?'#efc87b':'#e89a86';c.beginPath();c.roundRect(-15,y+1,30*clamp(s.hp/s.maxHp,0,1),3,1);c.fill();
    }
    if(selected){ellipse(c,19,mounted?-26:-15,7,7,'rgba(26,43,36,.9)');houseCrest(c,s.origHouse||s.controller,19,mounted?-26:-15,.49);}
    if(s.item==='Shield'&&s.weapon!=='Sword'){poly(c,[[-16,-13],[-8,-13],[-8,-4],[-12,0],[-16,-4]],color,'#ded0a0',1);}
    if(s.smithTimer>0){c.strokeStyle='#eed38e';c.lineWidth=1.5;c.beginPath();c.arc(0,3,20,-Math.PI/2,-Math.PI/2+TAU*s.smithTimer/(api.objectiveBuffsFor?.(s.controller)?.forge?12:18));c.stroke();}
    c.restore();return true;
  }
  function soldier(c,s,g,api){
    if(rasterSoldier(c,s,g,api))return;
    const sel=g.selected.has(s.id),h=api.getHouse(s.origHouse||s.controller),color=h?.color||'#b6b995';
    if(s.state==='knocked'){
      c.save();c.translate(s.x,s.y);c.globalAlpha=.45;ellipse(c,0,4,10,4,'rgba(27,36,27,.24)');poly(c,[[-9,0],[-2,-5],[7,-2],[8,5],[-3,6]],color);ellipse(c,10,2,4,4,'#c9ad83');c.restore();return;
    }
    c.save();c.translate(s.x,s.y);
    const moving=s.path&&s.pathIndex<s.path.length&&s.state!=='idle';const p=moving?Math.sin(g.time*(s.mount?12:10)+noise(s.id.length,s.x|0)):0;
    if(sel){c.strokeStyle='#c6e8ff';c.lineWidth=s===g.selectedOne?2.2:1.3;c.fillStyle='rgba(111,186,231,.12)';c.beginPath();c.ellipse(0,s.mount?14:8,s.mount?21:16,s.mount?11:8,0,0,TAU);c.fill();c.stroke();}
    ellipse(c,4,s.mount?17:9,s.mount?20:11,s.mount?7:4,'rgba(19,37,25,.3)');
    if(s.mount)horse(c,color,p);
    c.translate(0,(s.mount?-10:0)+Math.abs(p)*.7);
    // Boots, cloth legs, cape, tunic, shoulder plates, and a face under the helm.
    if(!s.mount){line(c,-3,3,-4+p*2,12,'#303e36',4);line(c,3,3,4-p*2,12,'#303e36',4);line(c,-4+p*2,12,-1+p*2,13,'#493f2e',3);line(c,4-p*2,12,7-p*2,13,'#493f2e',3);}
    poly(c,[[-6,-10],[5,-10],[8,8],[-8,7]],'#263e38');
    poly(c,[[-5,-11],[5,-11],[6,3],[2,7],[-6,4]],color,'rgba(28,46,39,.7)',.8);
    poly(c,[[-6,-10],[-1,-12],[-2,3],[-7,4]],'rgba(255,255,220,.14)');
    if(s.armor==='Heavy'||championArmor(s)){poly(c,[[-5,-10],[4,-10],[6,0],[0,5],[-6,0]],'#a1aaa0','#4c6059',1);line(c,-3,-8,-2,1,'#d3d4b6',1);line(c,-8,-7,-4,-9,'#bbc2ab',4);line(c,4,-9,8,-7,'#7a8d82',4);}
    if(s.armor==='Light'){line(c,-5,-8,4,1,'#dac798',2);}
    c.fillStyle='#54462e';c.fillRect(-6,1,12,3);c.fillStyle='#d0b77a';c.fillRect(-1,1,3,3);
    line(c,-6,-7,-9,0,color,4);line(c,6,-7,9,-1,color,4);ellipse(c,-9,1,2,2,'#d0ad82');ellipse(c,9,0,2,2,'#d0ad82');
    ellipse(c,0,-16,4.8,5.5,'#e0bb8d');
    const heavy=s.armor==='Heavy'||championArmor(s);if(s.weapon!=='None'||heavy){ellipse(c,0,-19,5.5,4.5,heavy?'#a7b5aa':'#7f9286');poly(c,[[-6,-18],[6,-18],[5,-15],[-6,-15]],heavy?'#ccd2b6':'#a9b5a0');line(c,-3,-21,-1,-22,'#d8dec1',2);if(heavy)line(c,1,-17,1,-12,'#82958a',1.2);}else{ellipse(c,0,-20,5,3,'#66523b');}
    ellipse(c,s.facingDir==='left'?-2:2,-15.5,.7,.7,'#344039');
    // Every loadout has a visibly different silhouette.
    const sign=s.facingDir==='left'?-1:1,sw=s.swing>0?Math.sin((.28-s.swing)/.28*Math.PI):0;
    if(s.weapon==='Sword'){
      c.save();c.translate(sign*9,-2);c.rotate(sign*(-.25-sw*1.7));line(c,0,0,0,-18,s.weaponLevel>=3?'#edb79c':s.weaponLevel>=2?'#a8d7ef':'#e4e4cb',3);poly(c,[[0,-22],[-1.5,-17],[1.5,-17]],'#eef1da');line(c,-4,-3,4,-3,'#c5ac71',2);line(c,0,0,0,4,'#756044',2);c.restore();
    }else if(s.weapon==='Spear'){
      c.save();c.translate(sign*9,0);c.rotate(sign*(-.22-sw*.45));line(c,0,12,0,-29,'#b89c65',2);poly(c,[[0,-37],[-3,-28],[3,-28]],s.weaponLevel>=2?'#b9dfea':'#d8dcc2','#5b7165',.7);c.restore();
    }else if(s.weapon==='Bow'||s.weapon==='Longbow'){
      const len=s.weapon==='Longbow'?14:10;c.save();c.translate(sign*9,-2);c.scale(sign,1);c.strokeStyle='#d4b783';c.lineWidth=2;c.beginPath();c.arc(-5,0,len,-1.05,1.05);c.stroke();line(c,-5+Math.cos(1.05)*len,-Math.sin(1.05)*len,-5+Math.cos(1.05)*len,Math.sin(1.05)*len,'#d7dfc3',.7);if(s.draw>0)line(c,-4,0,18,0,'#d4c69c',1);c.restore();
      line(c,-4,-7,-8,-18,'#544b36',4);line(c,-8,-18,-9,-23,'#d4d3ae',1);
    }
    if(s.item==='Shield'){
      c.save();c.translate(-sign*9,0);poly(c,[[-5,-9],[5,-9],[6,2],[0,9],[-6,2]],color,'#d6c58f',1.5);line(c,0,-7,0,6,'#d9cea0',1);ellipse(c,0,-1,2,2,'#c6b481');c.restore();
    }else if(s.item==='Medkit'){c.fillStyle='#e8e0ba';c.fillRect(-11,-4,7,9);c.fillStyle='#76997d';c.fillRect(-8.5,-2.5,2,6);c.fillRect(-10,-.5,5,2);}
    else if(s.item==='EngineerKit'||s.item==='TrapKit'){c.fillStyle='#bba06a';c.fillRect(-10,-5,6,10);line(c,-11,-10,-7,-5,'#b6beb0',2);line(c,-12,-10,-8,-12,'#c3c9b7',3);}
    else if(s.item==='WarHorn'){poly(c,[[-10,-5],[-4,-1],[-4,3],[-12,1]],'#d6bd72','#82774b');}
    else if(s.item==='FireOil'){ellipse(c,-9,1,3.5,4.5,'#b47b42');c.fillStyle='#d6c58e';c.fillRect(-10,-5,3,4);}
    if(s.carryingStandard){const banner=api.getHouse(s.carryingStandard);line(c,-12,8,-12,-41,'#e1d3a4',2);poly(c,[[-11,-41],[13,-37],[9,-22],[-11,-26]],banner?.color||'#e5d6aa','#d8c89a');ellipse(c,-12,-43,2.5,2.5,'#f3dc9a');}
    if(s.burnUntil>g.time){for(let j=0;j<3;j++)poly(c,[[-8+j*7,5],[-9+j*7,-4-Math.sin(g.time*12+j)*4],[-3+j*7,3]],j%2?'#f7c26a':'#d88a3e');}
    if(s.hp<s.maxHp||sel||s.carryingStandard){const y=s.carryingStandard?-49:-29;c.fillStyle='rgba(24,43,35,.88)';c.beginPath();c.roundRect(-13,y,26,4,2);c.fill();c.fillStyle=s.hp/s.maxHp>.5?'#acd39d':s.hp/s.maxHp>.25?'#efc87b':'#e89a86';c.beginPath();c.roundRect(-12,y+1,24*clamp(s.hp/s.maxHp,0,1),2,1);c.fill();}
    if(s.smithTimer>0){c.strokeStyle='#eed38e';c.lineWidth=1.5;c.beginPath();c.arc(0,3,15,-Math.PI/2,-Math.PI/2+TAU*s.smithTimer/(api.objectiveBuffsFor?.(s.controller)?.forge?12:18));c.stroke();}
    c.restore();
  }
  function commands(c,g,api,inView){
    const units=api.getSelectedUnits().filter(s=>s.state!=='knocked');let shown=0;
    for(const s of units){if(!s.order||s.order.type==='idle')continue;let x=s.tx,y=s.ty,col='#c8e3f0';const o=s.order;
      if(o.type==='attack'||o.type==='escort'||o.type==='heal'){const t=g.students.find(a=>a.id===o.targetId);if(t&&visibleEntity(api,t)){x=t.x;y=t.y;}col=o.type==='attack'?'#efb2a1':o.type==='heal'?'#bee1ad':'#e9d695';}
      if(o.type==='capture'){const t=api.getStandard(o.targetId);if(t&&visiblePoint(api,t.x,t.y)){x=t.x;y=t.y;}col='#f0e1a4';}
      if(o.type==='attackMove')col='#e9c18b';
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      if(shown<12&&inView(s.x,s.y,30)){c.save();c.globalAlpha=.23;c.setLineDash([3,7]);line(c,s.x,s.y,x,y,col,1);c.restore();}
      if(shown<6&&inView(x,y,25)){c.save();c.strokeStyle=col;c.globalAlpha=.7;c.lineWidth=1.3;c.beginPath();c.ellipse(x,y,8,4,0,0,TAU);c.stroke();line(c,x,y-9,x,y+3,col,1);c.restore();}shown++;
    }
  }
  function attackEffects(c,g,api,inView){
    let count=0;
    for(const s of g.students){
      if(!visibleEntity(api,s)||!s.attackAction||s.state==='knocked'||!inView(s.x,s.y,65)||count++>15)continue;
      const a=attackView(s,g),weapon=a.action.weapon||s.weapon,bow=weapon==='Bow'||weapon==='Longbow';
      c.save();c.translate(s.x,s.y-(s.mount?23:12));c.rotate(a.angle);
      if(a.action.phase==='windup'){
        if(bow){c.globalAlpha=.35+.4*a.progress;line(c,9,-5,9-5*a.progress,0,'#f5e1a6',1);line(c,9,5,9-5*a.progress,0,'#f5e1a6',1);ellipse(c,10,0,1.3,1.3,'#f7e5b4');}
        else{c.globalAlpha=.25+.3*a.progress;ellipse(c,10,-4,2.2,1.4,'#f9df9d');}
      }else if(!bow){
        const fade=Math.sin(Math.min(1,a.progress)*Math.PI);c.globalAlpha=.8*fade;
        if(weapon==='Spear'){
          const reach=Math.min(48,s.atkRange||42),p=18+a.progress*reach*.45;line(c,9,0,p,0,'#fcf1cb',2.6);line(c,p-7,-3,p+2,0,'#e9e2b9',1);line(c,p-7,3,p+2,0,'#e9e2b9',1);
        }else{
          const r=clamp((s.atkRange||26)*.8,17,33),angle=-1.2+a.progress*2.4;
          c.strokeStyle='rgba(247,223,163,.26)';c.lineWidth=7;c.beginPath();c.arc(0,0,r,angle-.7,angle);c.stroke();c.strokeStyle='#fff1c8';c.lineWidth=2.2;c.beginPath();c.arc(0,0,r,angle-.55,angle);c.stroke();
        }
      }
      c.restore();
    }
  }
  function effects(c,g,api,inView){
    attackEffects(c,g,api,inView);
    for(const p of g.projectiles){
      if(p.inFlight){
        const progress=clamp((p.flightElapsed||0)/(p.flightDuration||.25),0,1),sx=p.startX??p.x1,sy=p.startY??p.y1,ex=p.endX??p.x2,ey=p.endY??p.y2;
        const x=Number.isFinite(p.x)?p.x:sx+(ex-sx)*progress,y=Number.isFinite(p.y)?p.y:sy+(ey-sy)*progress;if(!visiblePoint(api,x,y)||!inView(x,y,35))continue;
        const dx=ex-sx,dy=ey-sy,d=Math.hypot(dx,dy)||1;c.save();c.translate(x,y);c.rotate(Math.atan2(dy,dx));line(c,-23,0,-7,0,'rgba(245,231,179,.25)',1);line(c,-15,0,0,0,'#f6e8bd',1.5);poly(c,[[2,0],[-4,-2.2],[-3,2.2]],'#eef0db');line(c,-14,0,-17,-3,'#c5cbae',1);line(c,-14,0,-17,3,'#c5cbae',1);c.restore();
      }else{
        const x=(p.x1+p.x2)/2,y=(p.y1+p.y2)/2;if(!visiblePoint(api,p.x1,p.y1)||!visiblePoint(api,p.x2,p.y2)||!inView(x,y,300))continue;const dx=p.x2-p.x1,dy=p.y2-p.y1,d=Math.hypot(dx,dy)||1;line(c,p.x1,p.y1,p.x2,p.y2,p.blocked?'#ffe8a4':'rgba(244,234,188,.4)',p.blocked?2:1);line(c,p.x2-dx/d*13,p.y2-dy/d*13,p.x2,p.y2,'#f0e9cd',1.5);
      }
    }
    for(const p of g.particles){if(!visiblePoint(api,p.x,p.y)||!inView(p.x,p.y,15))continue;c.globalAlpha=clamp(p.t/.5,0,.8);ellipse(c,p.x,p.y,p.r||2.2,p.r||2.2,p.c);}c.globalAlpha=1;
    let damageLabels=0;
    for(let i=(g.hitEffects?.length||0)-1;i>=0;i--){
      const e=g.hitEffects[i];if(!visiblePoint(api,e.x,e.y)||!inView(e.x,e.y,30))continue;const fade=clamp(e.ttl/(e.maxTtl||.4),0,1),burst=1-fade;
      c.save();c.globalAlpha=fade;c.translate(e.x,e.y);const col=e.color||(e.type==='block'?'#c6e9fa':e.type==='miss'?'#d5d7bb':'#ffe1a0');
      if(e.type==='miss'){c.strokeStyle=col;c.lineWidth=1;c.beginPath();c.ellipse(0,0,7+burst*5,4+burst*2,0,0,TAU);c.stroke();}
      else{for(let j=0;j<6;j++){const a=j/6*TAU,r=4+burst*10;line(c,Math.cos(a)*2,Math.sin(a)*2,Math.cos(a)*r,Math.sin(a)*r,col,e.type==='block'?1.8:1.2);}ellipse(c,0,0,2.5*(1-burst),2.5*(1-burst),'#fff5d8');}
      if(damageLabels<6&&e.text){c.font=`700 ${e.type==='hit'?10:8}px "Segoe UI",sans-serif`;c.textAlign='center';c.lineWidth=2.5;c.strokeStyle='rgba(29,38,30,.8)';c.strokeText(String(e.text),0,-12-burst*13);c.fillStyle=col;c.fillText(String(e.text),0,-12-burst*13);damageLabels++;}c.restore();
    }
    // Brief counter feedback is capped so a large melee never becomes a wall of labels.
    let notices=0;
    for(let i=(g.combatEvents?.length||0)-1;i>=0&&notices<5;i--){
      const e=g.combatEvents[i];if(!visiblePoint(api,e.x,e.y)||!inView(e.x,e.y,15))continue;
      c.save();c.globalAlpha=clamp(e.ttl/.35,0,1);label(c,e.text,e.x,e.y-10,8,e.color||'#eed49a');c.restore();notices++;
    }
    const drag=g.drag;if(drag?.active){c.fillStyle='rgba(176,220,238,.13)';c.strokeStyle='#cae6e8';c.lineWidth=1;c.fillRect(drag.x0,drag.y0,drag.x1-drag.x0,drag.y1-drag.y0);c.strokeRect(drag.x0+.5,drag.y0+.5,drag.x1-drag.x0,drag.y1-drag.y0);}
    const placement=api.getPlacementMode?.();const mouse=api.getMouseWorld?.();
    if(placement&&mouse){c.save();c.globalAlpha=.5;c.fillStyle='#e2cd8e';c.strokeStyle='#f4e5b4';if(placement==='barricade'){c.fillRect(mouse.x-30,mouse.y-8,60,16);c.strokeRect(mouse.x-30,mouse.y-8,60,16);}else{c.beginPath();c.arc(mouse.x,mouse.y,12,0,TAU);c.fill();c.stroke();}c.restore();}
  }
  function fog(c,g,api){
    const state=g.visibility?.player;if(!state)return;
    const tile=api.VISION_TILE||80,cols=api.VISION_COLS||Math.ceil(api.WORLD_W/tile),rows=api.VISION_ROWS||Math.ceil(api.WORLD_H/tile);
    if(!Number.isFinite(cols)||!Number.isFinite(rows))return;
    const tick=Math.floor(g.time*5);
    if(fogCache.reference!==state||fogCache.time!==tick){
      if(!fogCache.canvas||fogCache.canvas.width!==cols||fogCache.canvas.height!==rows)fogCache.canvas=makeCanvas(cols,rows);
      const fc=fogCache.canvas.getContext('2d');fc.clearRect(0,0,cols,rows);
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const index=y*cols+x;if(state.visible[index])continue;
        fc.fillStyle=state.explored[index]?'rgba(10,24,25,.68)':'#101d20';fc.fillRect(x,y,1,1);
      }
      fogCache.reference=state;fogCache.time=tick;
    }
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(fogCache.canvas,0,0,cols*tile,rows*tile);c.restore();
  }
  window.AcademyDraw=function(api){
    const {game:g,ctx:c,canvas}=api,rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(w<1||h<1)return;
    const view={x:g.cam.x,y:g.cam.y,w,h},inView=(x,y,pad=100)=>x>=view.x-pad&&y>=view.y-pad&&x<=view.x+w+pad&&y<=view.y+h+pad;
    c.clearRect(0,0,w,h);c.save();c.translate(-view.x,-view.y);
    if(rememberedWorld!==g.terrain.waters){rememberedLandmarks.clear();carrierTrails.clear();rememberedWorld=g.terrain.waters;fogCache.reference=null;}
    terrain(c,g,view,inView);supplies(c,g,api,inView);
    for(const s of g.blacksmiths)if((!api.isExplored||api.isExplored('player',s.x,s.y))&&inView(s.x,s.y,140))forge(c,s,g.time);
    const observedStudents=g.students.filter(s=>visibleEntity(api,s)),observedGame={...g,students:observedStudents};
    for(const o of g.objectives){const known=remembered(api,'objective:'+o.id,o);if(known&&inView(o.x,o.y,150))objective(c,known,observedGame,api);}
    // Depth sorting keeps people in front of walls when standing below them.
    const actors=[];for(const hse of g.houses){const known=remembered(api,'keep:'+hse.id,hse,hse.castle.x,hse.castle.y);if(known&&inView(hse.castle.x,hse.castle.y,150))actors.push({y:hse.castle.y+30,kind:'keep',obj:known});}
    for(const s of observedStudents)if(inView(s.x,s.y,65))actors.push({y:s.y,kind:'student',obj:s});
    actors.sort((a,b)=>a.y-b.y);commands(c,g,api,inView);
    for(const a of actors)a.kind==='keep'?keep(c,a.obj,api):soldier(c,a.obj,g,api);
    for(const st of g.standards)if((!api.isVisibleTo||api.isVisibleTo('player',st))&&inView(st.x,st.y,80))standard(c,st,g,api);
    effects(c,g,api,inView);
    // Carriers render after buildings and combat effects so their banner never disappears.
    for(const s of observedStudents)if(s.carryingStandard&&s.state!=='knocked'&&inView(s.x,s.y,155))carrierBeacon(c,s,g,api);
    fog(c,g,api);
    c.restore();
    // Gentle edge shading gives the field depth without concealing important units.
    const vg=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.73);vg.addColorStop(0,'rgba(11,28,24,0)');vg.addColorStop(1,'rgba(11,28,24,.11)');c.fillStyle=vg;c.fillRect(0,0,w,h);
  };
})();
