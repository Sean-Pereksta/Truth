/* The labyrinth's survey records terrain. Actors and effects are clipped against
   fresh sight polygons, so returning to a surveyed corridor still means scouting it. */
(() => {
  'use strict';
  const cache=new WeakMap();
  const tau=2*Math.PI, radius=310, fogScale=4;
  const unknown=[9,17,23,255], remembered=[11,22,29,204];
  const ring=Array.from({length:112},(_,i)=>i*tau/112);
  let lamp;
  function state(lab){
    let s=cache.get(lab);
    if(!s){
      const count=lab.cols*lab.rows;
      let hash=2166136261;
      for(let i=0;i<count;i++)hash=Math.imul(hash^lab.cells[i],16777619);
      s={lab,tile:lab.tile,cols:lab.cols,rows:lab.rows,
        width:lab.cols*lab.tile,height:lab.rows*lab.tile,
        signature:[lab.cols,lab.rows,hash>>>0,lab.door?.cx,lab.door?.cy].join('/'),
        opaque:new Uint8Array(count),seen:new Uint8Array(count),cornerRows:[],views:[],
        surveyDirty:true,dirty:true};
      cache.set(lab,s);
    }
    const open=!!lab.door?.open,sealed=!!lab.sealClosed;
    if(s.doorOpen!==open||s.sealClosed!==sealed){
      for(let i=0;i<s.opaque.length;i++)s.opaque[i]=lab.cells[i]?0:1;
      if(!open)for(const cell of lab.door?.cells||[])s.opaque[cell.cy*s.cols+cell.cx]=1;
      if(sealed)for(const cell of lab.sealCells||[])s.opaque[cell.cy*s.cols+cell.cx]=1;
      // Long straight walls need rays only at bends, ends, and diagonal joins.
      s.cornerRows=Array.from({length:s.rows+1},()=>[]);
      for(let y=0;y<=s.rows;y++)for(let x=0;x<=s.cols;x++){
        const a=solid(s,x-1,y-1),b=solid(s,x,y-1),c=solid(s,x-1,y),d=solid(s,x,y);
        const sum=a+b+c+d;
        if(sum===1||sum===3||(sum===2&&a===d&&b===c))
          s.cornerRows[y].push(x*s.tile);
      }
      s.doorOpen=open;s.sealClosed=sealed;s.dirty=true;s.surveyDirty=true;
    }
    return s;
  }
  function solid(s,x,y){
    return x<0||y<0||x>=s.cols||y>=s.rows?1:s.opaque[y*s.cols+x];
  }
  function visit(s,x,y,surfaces){
    if(x<0||y<0||x>=s.cols||y>=s.rows)return;
    const i=y*s.cols+x;
    if(!s.seen[i]){s.seen[i]=1;s.surveyDirty=true;}
    if(s.opaque[i])surfaces.add(i);
  }
  // DDA stops at the actual near face. Crossing the shared vertex of two
  // solids cannot expose enemies through a diagonal seam.
  function ray(s,x,y,dx,dy,limit,survey=null){
    const t=s.tile;
    let cx=Math.floor(x/t),cy=Math.floor(y/t);
    if(solid(s,cx,cy))return 0;
    if(survey)visit(s,cx,cy,survey);
    const sx=dx>0?1:-1,sy=dy>0?1:-1;
    const stepX=dx===0?Infinity:t/Math.abs(dx),stepY=dy===0?Infinity:t/Math.abs(dy);
    let nextX=dx===0?Infinity:((cx+(sx>0?1:0))*t-x)/dx;
    let nextY=dy===0?Infinity:((cy+(sy>0?1:0))*t-y)/dy;
    for(;;){
      const at=Math.min(nextX,nextY);
      if(at>=limit)return limit;
      if(Math.abs(nextX-nextY)<1e-7){
        if(solid(s,cx+sx,cy)||solid(s,cx,cy+sy)){
          if(survey){if(solid(s,cx+sx,cy))visit(s,cx+sx,cy,survey);if(solid(s,cx,cy+sy))visit(s,cx,cy+sy,survey);}
          return at;
        }
        cx+=sx;cy+=sy;nextX+=stepX;nextY+=stepY;
      }else if(nextX<nextY){cx+=sx;nextX+=stepX;}
      else{cy+=sy;nextY+=stepY;}
      if(survey)visit(s,cx,cy,survey);
      if(solid(s,cx,cy))return at;
    }
  }
  function line(lab,x1,y1,x2,y2){
    if(!lab)return true;
    const s=state(lab),vx=x2-x1,vy=y2-y1,len=Math.hypot(vx,vy);
    if(!Number.isFinite(len))return false;
    if(solid(s,Math.floor(x2/s.tile),Math.floor(y2/s.tile)))return false;
    return len<.0001||ray(s,x1,y1,vx/len,vy/len,len)>=len;
  }
  function pilots(g){return g.players?.length?g.players:g.player?[g.player]:[];}
  function sightRange(p){return radius+(p.stats?.earlyWarn?25:0);}
  function fromPilot(g,p,x,y){
    const lab=g.map?.lab;
    return p.hp>0&&(!lab||((p.x-x)**2+(p.y-y)**2<=sightRange(p)**2&&line(lab,p.x,p.y,x,y)));
  }
  function canSee(g,x,y){
    return !g.map?.lab||pilots(g).some(p=>fromPilot(g,p,x,y));
  }
  function polygon(s,p){
    const angles=ring.slice(),reach=sightRange(p);
    const first=Math.max(0,Math.ceil((p.y-reach-2)/s.tile)),last=Math.min(s.rows,Math.floor((p.y+reach+2)/s.tile));
    for(let row=first;row<=last;row++){
      const dy=row*s.tile-p.y;
      for(const cx of s.cornerRows[row]){
        const dx=cx-p.x;
        if(dx*dx+dy*dy>(reach+2)**2)continue;
        const a=Math.atan2(dy,dx);
        angles.push((a-.00002+tau)%tau,(a+.00002+tau)%tau);
      }
    }
    angles.sort((a,b)=>a-b);
    const path=new Path2D(),surfaces=new Set(),vertices=[];
    let xMin=p.x,yMin=p.y,xMax=p.x,yMax=p.y;
    for(let i=0;i<angles.length;i++){
      const dx=Math.cos(angles[i]),dy=Math.sin(angles[i]);
      const cut=ray(s,p.x,p.y,dx,dy,reach,surfaces);
      const x=p.x+dx*cut,y=p.y+dy*cut,n=vertices.length;
      xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x);yMax=Math.max(yMax,y);
      if(n>=4&&((Math.abs(x-vertices[n-2])<1e-7&&Math.abs(x-vertices[n-4])<1e-7)
        ||(Math.abs(y-vertices[n-1])<1e-7&&Math.abs(y-vertices[n-3])<1e-7))){
        vertices[n-2]=x;vertices[n-1]=y;
      }else vertices.push(x,y);
    }
    path.moveTo(vertices[0],vertices[1]);
    for(let i=2;i<vertices.length;i+=2)path.lineTo(vertices[i],vertices[i+1]);
    path.closePath();
    // In the top-down illustration the bulkhead's lock and wall trim sit inside
    // their solid tile. Show that surface without exposing its far-side floor.
    const litWall=new Path2D(path);
    for(const i of surfaces){
      const x=i%s.cols*s.tile,y=Math.floor(i/s.cols)*s.tile;litWall.rect(x,y,s.tile,s.tile);
      xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x+s.tile);yMax=Math.max(yMax,y+s.tile);
    }
    const bounds={x:Math.max(0,Math.floor(xMin/fogScale)-1),y:Math.max(0,Math.floor(yMin/fogScale)-1),
      right:Math.min(s.fog.width,Math.ceil(xMax/fogScale)+1),bottom:Math.min(s.fog.height,Math.ceil(yMax/fogScale)+1)};
    return {path,litWall,bounds};
  }
  function surface(w,h){
    const c=document.createElement('canvas');c.width=w;c.height=h;return c;
  }
  function createLayers(s){
    if(s.memory)return;
    s.memory=surface(Math.ceil(s.width/fogScale),Math.ceil(s.height/fogScale));
    s.fog=surface(s.memory.width,s.memory.height);
    s.survey=surface(s.cols,s.rows);
    const m=s.memory.getContext('2d');
    m.fillStyle='#091117';m.fillRect(0,0,s.memory.width,s.memory.height);
    s.fog.getContext('2d').drawImage(s.memory,0,0);
  }
  function dirtyRegions(views){
    const regions=[];
    for(const v of views){
      const r={...v.bounds};
      for(let i=regions.length-1;i>=0;i--){
        const b=regions[i];
        if(b.right<=r.x||b.bottom<=r.y||r.right<=b.x||r.bottom<=b.y)continue;
        r.x=Math.min(r.x,b.x);r.y=Math.min(r.y,b.y);
        r.right=Math.max(r.right,b.right);r.bottom=Math.max(r.bottom,b.bottom);
        regions.splice(i,1);
      }
      regions.push(r);
    }
    return regions;
  }
  function inView(v,box){
    const b=v.bounds;
    return !box||(b.right*fogScale>=box.x-6&&b.bottom*fogScale>=box.y-6
      &&b.x*fogScale<=box.x+box.sw/box.zoom+6&&b.y*fogScale<=box.y+box.sh/box.zoom+6);
  }
  function prepare(g){
    const lab=g.map?.lab;
    if(!lab)return null;
    const s=state(lab),group=pilots(g).filter(p=>p.hp>0);
    if(!s.dirty&&group.length===s.views.length&&group.every((p,i)=>{
      const old=s.views[i];
      return Math.abs(p.x-old.x)<.2&&Math.abs(p.y-old.y)<.2&&sightRange(p)===old.reach;
    }))return s;
    createLayers(s);
    const previous=s.views,union=new Path2D(),views=[];
    for(let i=0;i<group.length;i++){
      const p=group[i],reach=sightRange(p),old=previous[i];
      const shape=!s.dirty&&old&&p.x===old.x&&p.y===old.y&&reach===old.reach?old:polygon(s,p);
      const v=shape===old?old:{...shape,x:p.x,y:p.y,reach,lamp:old?.lamp};
      union.addPath(v.path);views.push(v);
    }
    s.clipPath=union;
    s.views=views;
    const m=s.memory.getContext('2d'),f=s.fog.getContext('2d');
    for(let i=0;i<views.length;i++){
      const v=views[i];if(v===previous[i])continue;
      const b=v.bounds,x=b.x*fogScale,y=b.y*fogScale,w=(b.right-b.x)*fogScale,h=(b.bottom-b.y)*fogScale;
      m.save();m.scale(1/fogScale,1/fogScale);m.clip(v.litWall);
      m.clearRect(x,y,w,h);m.fillStyle='rgba(11,22,29,0.8)';m.fillRect(x,y,w,h);m.restore();
    }
    // Removing yesterday's light and revealing today's requires only the two
    // lamp footprints. The rest of a large installation stays untouched.
    for(const b of dirtyRegions(previous.concat(views))){
      const w=b.right-b.x,h=b.bottom-b.y;
      f.clearRect(b.x,b.y,w,h);f.drawImage(s.memory,b.x,b.y,w,h,b.x,b.y,w,h);
    }
    f.globalCompositeOperation='destination-out';
    f.save();f.scale(1/fogScale,1/fogScale);
    group.forEach((p,i)=>{
      const r=sightRange(p),gr=f.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      gr.addColorStop(0,'#000');gr.addColorStop(.55,'#000');
      gr.addColorStop(.72,'rgba(0,0,0,.96)');gr.addColorStop(.86,'rgba(0,0,0,.82)');
      gr.addColorStop(.95,'rgba(0,0,0,.59)');gr.addColorStop(1,'rgba(0,0,0,.28)');
      f.save();f.clip(views[i].litWall);f.fillStyle=gr;f.fillRect(p.x-r,p.y-r,r*2,r*2);f.restore();
    });
    f.restore();f.globalCompositeOperation='source-over';
    s.dirty=false;return s;
  }
  function clip(ctx,g){
    if(!g.map?.lab)return;
    const s=prepare(g),box=g.camera?.activeView;
    if(box&&s.views.length===2){
      if(!inView(s.views[0],box)){ctx.clip(s.views[1].path);return;}
      if(!inView(s.views[1],box)){ctx.clip(s.views[0].path);return;}
    }
    ctx.clip(s.clipPath);
  }
  function lampTexture(){
    if(lamp)return lamp;
    lamp=surface(192,192);
    const c=lamp.getContext('2d'),im=c.createImageData(lamp.width,lamp.height);
    // A cool bounce around the boots and a warmer, wider pool downrange.
    // Baking the soft beam once leaves only a rotation and a blit per pilot.
    for(let y=0;y<192;y++)for(let x=0;x<192;x++){
      const u=(x+.5-96)/96,v=(y+.5-96)/96,r=Math.hypot(u,v);
      if(r>=1)continue;
      const bounce=.19*Math.exp(-4*r*r)*(1-r*r);
      const width=.145+.31*Math.max(0,u);
      const beam=.24*Math.exp(-((u-.22)**2)/.19-v*v/(width*width))*(1-r*r);
      const sum=bounce+beam,i=(y*192+x)*4;
      im.data[i]=(108*bounce+255*beam)/sum;
      im.data[i+1]=(175*bounce+222*beam)/sum;
      im.data[i+2]=(183*bounce+163*beam)/sum;
      // Match the headlamp's reflected light on the shaded steel, moss and
      // basalt tile palettes without a screen blend on the main game canvas.
      im.data[i]+=50*(1-im.data[i]/255);im.data[i+1]+=62*(1-im.data[i+1]/255);im.data[i+2]+=66*(1-im.data[i+2]/255);
      im.data[i+3]=255*sum;
    }
    c.putImageData(im,0,0);return lamp;
  }
  function lightTerrain(ctx,g){
    if(!g.map?.lab)return;
    const s=prepare(g),box=g.camera?.activeView;
    let i=0;
    for(const p of pilots(g)){
      if(p.hp<=0)continue;
      const v=s.views[i++];if(!inView(v,box))continue;
      const r=v.reach,angle=p.a||0,b=v.bounds;
      const size=Math.ceil((2*r+4*fogScale)/fogScale);
      const left=Math.floor((v.x-r)/fogScale)-1,top=Math.floor((v.y-r)/fogScale)-1;
      if(v.lampAngle!==angle){
        if(!v.lamp||v.lamp.width!==size)v.lamp=surface(size,size);
        const l=v.lamp.getContext('2d');l.clearRect(0,0,size,size);
        l.save();l.setTransform(1/fogScale,0,0,1/fogScale,-left,-top);l.clip(v.litWall);
        l.translate(v.x,v.y);l.rotate(angle);l.drawImage(lampTexture(),-r,-r,2*r,2*r);l.restore();
        v.lampAngle=angle;
      }
      // The pilot's clipped headlamp is already rasterized at fog resolution.
      // Source-over avoids a destination read/blend for every screen pixel.
      const x=Math.max(left,b.x),y=Math.max(top,b.y);
      const w=Math.min(left+size,b.right)-x,h=Math.min(top+size,b.bottom)-y;
      ctx.save();ctx.imageSmoothingEnabled=false;
      if(w>0&&h>0)ctx.drawImage(v.lamp,x-left,y-top,w,h,x*fogScale,y*fogScale,w*fogScale,h*fogScale);
      ctx.restore();
    }
  }
  function shadeTerrain(ctx,g){
    if(!g.map?.lab)return;
    const s=prepare(g),box=g.camera?.activeView;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(box){
      // Include camera shake and a filtering gutter in the source subrectangle.
      const x=Math.max(0,Math.floor((box.x-8)/fogScale)),y=Math.max(0,Math.floor((box.y-8)/fogScale));
      const w=Math.min(s.fog.width,Math.ceil((box.x+box.sw/box.zoom+8)/fogScale))-x;
      const h=Math.min(s.fog.height,Math.ceil((box.y+box.sh/box.zoom+8)/fogScale))-y;
      if(w>0&&h>0)ctx.drawImage(s.fog,x,y,w,h,x*fogScale,y*fogScale,w*fogScale,h*fogScale);
    }else ctx.drawImage(s.fog,0,0,s.width,s.height);
    ctx.restore();
  }
  function chartDetails(ctx,g,scale,mapX,mapY,known){
    const lab=g.map.lab,ink='#102029';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='600 11px "Segoe UI", Arial, sans-serif';ctx.lineJoin='round';ctx.lineWidth=3;
    for(const room of lab.rooms||[]){
      if(!room.visited)continue;
      const x=mapX(room.center),y=mapY(room.center)-room.h*scale*.23;
      const lines=ctx.measureText(room.name).width>room.w*scale-8?room.name.split(' '):[room.name];
      ctx.strokeStyle=ink;ctx.fillStyle='#e2e6d9';
      lines.forEach((label,i)=>{
        const cy=Math.round(y+(i-(lines.length-1)/2)*12);
        ctx.strokeText(label,x,cy);ctx.fillText(label,x,cy);
      });
    }
    if(known(lab.key)&&!lab.key.taken){
      const x=mapX(lab.key),y=mapY(lab.key);
      ctx.strokeStyle='#ffd47b';ctx.lineWidth=2.5;ctx.beginPath();
      ctx.arc(x-3,y-2,3,0,tau);ctx.moveTo(x-1,y);ctx.lineTo(x+5,y+6);
      ctx.lineTo(x+8,y+3);ctx.stroke();
    }
    if(known(lab.door)&&!lab.door.open){
      const x=mapX(lab.door),y=mapY(lab.door);
      ctx.strokeStyle='#ffba76';ctx.lineWidth=2;ctx.beginPath();
      ctx.arc(x,y-2,3.5,Math.PI,0);ctx.lineTo(x+3.5,y+1);ctx.stroke();
      ctx.fillStyle='#ffba76';ctx.fillRect(x-5,y,10,6);ctx.fillStyle=ink;ctx.fillRect(x-1,y+2,2,2);
    }
    if(known(lab.gate)){
      const x=mapX(lab.gate),y=mapY(lab.gate);
      ctx.strokeStyle=g.map.complete?'#b9f3cf':'#b4c0bd';ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(x-6,y+6);ctx.lineTo(x-6,y-6);ctx.lineTo(x+6,y-6);ctx.lineTo(x+6,y+6);
      ctx.moveTo(x-3,y+2);ctx.lineTo(x,y-1);ctx.lineTo(x+3,y+2);ctx.stroke();
    }
    pilots(g).forEach((p,i)=>{
      const x=mapX(p),y=mapY(p),color=i?'#ffaf7e':'#9ef9dd';
      ctx.save();ctx.translate(x,y);
      ctx.fillStyle=color;ctx.strokeStyle=ink;ctx.lineWidth=2.5;
      if(p.hp>0){
        ctx.rotate(p.a||0);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,5);
        ctx.lineTo(-3,0);ctx.lineTo(-5,-5);ctx.closePath();ctx.stroke();ctx.fill();
      }else{
        ctx.fillRect(-5,-2,10,4);ctx.fillRect(-2,-5,4,10);
      }
      ctx.restore();
      ctx.textAlign='left';ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.fillStyle=color;
      ctx.font='bold 10px Consolas, monospace';ctx.strokeText('P'+(i+1),x+8,y+4);ctx.fillText('P'+(i+1),x+8,y+4);
    });
  }
  function surveyObjectives(ctx,g,mapX,mapY,known,large){
    const m=g.map,unit=large?2:1;
    function symbol(obj,type){
      if(!known(obj))return;
      ctx.save();ctx.translate(mapX(obj),mapY(obj));ctx.scale(unit,unit);
      if(type==='node'){
        ctx.fillStyle='#a7d6f3';ctx.beginPath();ctx.moveTo(0,-3);ctx.lineTo(3,0);
        ctx.lineTo(0,3);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();
        ctx.fillStyle='#173240';ctx.fillRect(-1,-1,2,2);
      }else if(type==='cache'){
        ctx.fillStyle='#d7be8d';ctx.fillRect(-3,-2,6,4);
        ctx.fillStyle='#40372d';ctx.fillRect(-3,-.5,6,1);ctx.fillRect(-.5,-2,1,2);
      }else{
        ctx.strokeStyle='#f79a81';ctx.lineWidth=1;ctx.beginPath();
        ctx.moveTo(-3,-2);ctx.lineTo(0,1);ctx.lineTo(3,-2);
        ctx.moveTo(-3,0);ctx.lineTo(0,3);ctx.lineTo(3,0);ctx.stroke();
      }
      ctx.restore();
    }
    for(const node of m.nodes||[])if(!node.done)symbol(node,'node');
    if(m.side&&m.side.state!=='claimed')symbol(m.side,'cache');
    if(m.lab.bossEntry&&!m.lab.bossDefeated)symbol(m.lab.bossEntry,'boss');
  }
  function drawMap(ctx,g,box={}){
    if(!g.map?.lab)return;
    const s=prepare(g),lab=s.lab;
    if(s.surveyDirty){
      const c=s.survey.getContext('2d'),im=c.createImageData(s.cols,s.rows);
      for(let i=0;i<s.seen.length;i++)if(s.seen[i]){
        const j=i*4,wall=s.opaque[i];
        im.data[j]=wall?91:49;im.data[j+1]=wall?113:75;im.data[j+2]=wall?114:80;im.data[j+3]=255;
      }
      c.putImageData(im,0,0);s.surveyDirty=false;
    }
    const x=box.x??10,y=box.y??10,w=box.width??122,h=box.height??72;
    const scale=Math.min((w-10)/s.width,(h-10)/s.height);
    const left=x+(w-s.width*scale)/2,top=y+(h-s.height*scale)/2;
    const mapX=obj=>Math.round(left+obj.x*scale),mapY=obj=>Math.round(top+obj.y*scale);
    function known(obj){
      return obj&&!!s.seen[Math.floor(obj.y/s.tile)*s.cols+Math.floor(obj.x/s.tile)];
    }
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(8,20,25,.89)';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#48615f';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.drawImage(s.survey,left,top,s.width*scale,s.height*scale);
    surveyObjectives(ctx,g,mapX,mapY,known,box.labels);
    if(box.labels){chartDetails(ctx,g,scale,mapX,mapY,known);ctx.restore();return;}
    if(known(lab.key)&&!lab.key.taken){
      const kx=mapX(lab.key),ky=mapY(lab.key);
      ctx.fillStyle='#ffcd73';ctx.fillRect(kx-2,ky-2,3,3);ctx.fillRect(kx,ky,4,1);ctx.fillRect(kx+2,ky,1,3);
    }
    if(known(lab.door)&&!lab.door.open){ctx.fillStyle='#e3ab66';ctx.fillRect(mapX(lab.door)-1,mapY(lab.door)-2,3,5);}
    if(known(lab.gate)){
      ctx.strokeStyle=g.map.complete?'#b9f3cf':'#8d9d98';ctx.strokeRect(mapX(lab.gate)-2.5,mapY(lab.gate)-2.5,5,5);
    }
    pilots(g).forEach((p,i)=>{
      const px=mapX(p),py=mapY(p);ctx.fillStyle='#12232a';ctx.fillRect(px-3,py-3,7,7);
      ctx.fillStyle=i?'#ffaf7e':'#9ef9dd';
      if(p.hp>0){
        ctx.fillRect(px-1,py-2,3,5);ctx.fillRect(px-2,py-1,5,3);
        ctx.fillRect(px+Math.round(Math.cos(p.a||0)*3),py+Math.round(Math.sin(p.a||0)*3),2,2);
      }else{ctx.fillRect(px-2,py,5,1);ctx.fillRect(px,py-2,1,5);}
    });
    ctx.restore();
  }
  function runs(length,has){
    const out=[];
    for(let i=0;i<length;){
      if(!has(i)){i++;continue;}
      const start=i++;while(i<length&&has(i))i++;out.push(start,i-start);
    }
    return out;
  }
  function snapshot(g){
    if(!g.map?.lab)return null;
    const s=prepare(g),m=s.memory,rgba=m.getContext('2d').getImageData(0,0,m.width,m.height).data;
    return {v:1,layout:s.signature,tiles:runs(s.seen.length,i=>s.seen[i]),
      terrain:runs(m.width*m.height,i=>rgba[i*4+3]<230)};
  }
  function validRuns(ranges,count){
    if(!Array.isArray(ranges)||ranges.length%2||ranges.length>count*2)return false;
    let end=0;
    for(let i=0;i<ranges.length;i+=2){
      const from=ranges[i],len=ranges[i+1];
      if(!Number.isInteger(from)||!Number.isInteger(len)||from<end||len<1||from+len>count)return false;
      end=from+len;
    }
    return true;
  }
  function restore(g,data){
    const lab=g.map?.lab;
    if(!lab||data?.v!==1)return false;
    const s=state(lab);createLayers(s);
    const m=s.memory,c=m.getContext('2d'),count=m.width*m.height;
    if(data.layout!==s.signature||!validRuns(data.tiles,s.seen.length)||!validRuns(data.terrain,count))return false;
    s.seen.fill(0);
    for(let i=0;i<data.tiles.length;i+=2)s.seen.fill(1,data.tiles[i],data.tiles[i]+data.tiles[i+1]);
    const mask=new Uint8Array(count);
    for(let i=0;i<data.terrain.length;i+=2)mask.fill(1,data.terrain[i],data.terrain[i]+data.terrain[i+1]);
    const im=c.createImageData(m.width,m.height);
    for(let i=0;i<count;i++)im.data.set(mask[i]?remembered:unknown,i*4);
    c.putImageData(im,0,0);
    const f=s.fog.getContext('2d');f.save();f.globalCompositeOperation='copy';f.drawImage(m,0,0);f.restore();
    s.surveyDirty=true;s.dirty=true;return true;
  }
  window.Sight={prepare,lightTerrain,shadeTerrain,clip,canSee,fromPilot,range:sightRange,line,drawMap,snapshot,restore};
})();
