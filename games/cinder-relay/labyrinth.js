/* Large installations are built from chambers and three-tile service passages. */
(() => {
  'use strict';
  const tile=32;
  // Chamber extents and hall centerlines are in deck tiles. The bulkhead spans a
  // complete hall so neither a player nor a shot can slip around a locked door.
  const plans=[
    {name:'Customs Warrens',cols:75,rows:42,
      rooms:[
        ['entry','Freight lift',2,15,12,10],['hall','Sorting hall',19,13,17,13,1],
        ['key','Bonded stores',16,2,11,7],['cache','Repair annex',8,29,12,9],
        ['loop','Drain exchange',33,30,14,8],['gallery','Inspection gallery',39,3,17,11],
        ['exit','Transfer chamber',58,13,15,15,1]],
      halls:[[[8,20],[27,20]],[[8,20],[8,33],[14,33]],[[14,33],[40,33]],
        [[40,33],[40,22],[27,22]],[[23,19],[23,6],[21,6]],
        [[29,15],[29,8],[47,8]],[[47,8],[62,8],[62,20]]],
      piers:[[25,16,2,2],[30,22,2,2],[43,5,2,2],[36,34,2,2],[64,18,2,2]],
      door:[58,8,'x'],start:[6,20],key:[18,5],cache:[14,34],gate:[69,24]},
    {name:'Undercurrent Loop',cols:70,rows:44,
      rooms:[
        ['entry','Upper intake',4,3,12,9],['hall','Intake rotunda',22,3,17,13,1],
        ['key','Isolation vault',6,29,12,9],['cache','Instrument bay',5,16,11,7],
        ['loop','Lower transfer',25,22,15,13,1],['gallery','Bypass gallery',47,6,14,10],
        ['exit','Terminal well',49,29,18,13,1]],
      halls:[[[10,8],[30,8]],[[30,8],[30,6],[54,6],[54,10]],
        [[54,10],[54,18],[36,18],[36,27]],[[30,27],[23,27],[23,19],[10,19]],
        [[10,19],[10,8]],[[10,19],[10,33]],[[32,29],[32,38],[57,38]]],
      piers:[[31,10,2,2],[27,26,2,2],[35,30,2,2],[51,9,2,2],[57,33,3,2]],
      door:[45,38,'x'],start:[7,7],key:[14,34],cache:[8,18],gate:[63,33]},
    {name:'Spindle Galleries',cols:74,rows:44,
      rooms:[
        ['entry','Return lift',60,28,12,12],['hall','Spindle gallery',39,20,16,12,1],
        ['key','Control archive',61,3,11,8],['cache','Calibration alcove',20,27,12,10],
        ['loop','Crossover',12,13,14,9],['gallery','Upper manifold',36,3,15,11,1],
        ['exit','Extraction court',2,27,13,14,1]],
      halls:[[[66,34],[58,34],[58,26],[47,26]],[[66,34],[66,7]],[[45,26],[45,8]],
        [[45,8],[66,8]],[[45,26],[45,33],[26,33]],[[43,8],[31,8],[31,17],[19,17]],
        [[21,17],[21,32],[26,32]],[[19,17],[8,17],[8,34]]],
      piers:[[42,23,2,2],[49,27,2,2],[40,6,2,2],[22,30,2,2],[9,33,2,2]],
      door:[8,24,'y'],start:[68,35],key:[68,6],cache:[27,33],gate:[5,37]}
  ];
  const skins={
    dock:{base:'#202e36',floor:['#314147','#34434a','#304047'],joint:'#23343c',rim:'#586a6d',wall:'#26363c',trim:'#ac8557',lamp:'#ffd28c',shade:'#12242b',material:'steel'},
    flora:{base:'#162d2d',floor:['#30423c','#33463e','#2e403a'],joint:'#253a35',rim:'#5b7465',wall:'#263c35',trim:'#90a46a',lamp:'#d8e699',shade:'#142a27',material:'root'},
    forge:{base:'#302629',floor:['#443c3b','#483f3b','#403937'],joint:'#342f30',rim:'#78675a',wall:'#443739',trim:'#c48350',lamp:'#ffbf77',shade:'#2a2027',material:'furnace'},
    signal:{base:'#222736',floor:['#383c50','#3b4051','#353a4b'],joint:'#2a3041',rim:'#677186',wall:'#303449',trim:'#a49bc0',lamp:'#d7d5ff',shade:'#1f2333',material:'lens'}
  };
  const routeskins=[skins.dock,skins.flora,skins.forge,skins.signal,
    {...skins.signal,floor:['#34444d','#374851','#32424c'],rim:'#748a8c',trim:'#b4a277',lamp:'#e2d1a2',shade:'#1c2b34'},
    {...skins.dock,floor:['#29434a','#2c464c','#294249'],rim:'#638c8a',trim:'#80a99f',lamp:'#a5e0d2',shade:'#142c34'},
    {...skins.flora,floor:['#3b443d','#42483e','#3c453e'],trim:'#bb996b',rim:'#7f8671',lamp:'#f2c898',shade:'#2c302d'},
    {...skins.forge,floor:['#473b3f','#493d41','#42373c'],rim:'#8d716c',trim:'#c58870',lamp:'#f3b99c',shade:'#2d242c'},
    {...skins.signal,floor:['#403e4b','#413e4d','#3e3c48'],rim:'#7d7a8a',trim:'#aea4c7',lamp:'#e1d9da',shade:'#2a2633'},
    {...skins.dock,floor:['#2e3e50','#334357','#2f3d4f'],rim:'#687e96',trim:'#a0b7c6',lamp:'#caddf0',shade:'#172534'},
    {...skins.forge,floor:['#434339','#46453e','#403f36'],rim:'#83816b',trim:'#b7a264',lamp:'#e4d19a',shade:'#292b25'}
  ];
  const point=([x,y])=>({x:(x+.5)*tile,y:(y+.5)*tile});
  function preview(g){
    const p=LevelTopology.make(g);
    return {name:p.name,rooms:p.rooms.length,cols:p.cols,rows:p.rows,layoutId:p.identity};
  }
  function create(g,options={}){
    const legacy=options.legacy===true;
    if(legacy&&!(g.stage===1?g.room===1:g.room===0))return null;
    const oldLayout=(g.stage<=5?g.stage-1:(g.stage-1)+Math.max(0,g.mapId||0))%plans.length;
    const plan=legacy?plans[oldLayout]:LevelTopology.make(g);
    const route=g.mapId||0,{rows,cols}=plan,cells=new Uint8Array(rows*cols);
    const materials=['dock','flora','forge','signal','signal','dock','flora','forge','signal','dock','forge'];
    const theme=legacy?skins[materials[g.mapId]||'dock']:routeskins[route]||skins.dock;
    const id=legacy?oldLayout:[0,1,3,2,2,1,1,3,2,0,3][route]??0;
    const rooms=plan.rooms.map(([id,name,x,y,w,h,ambush])=>{
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        if((i===0||i===w-1)&&(j===0||j===h-1))continue;
        cells[(y+j)*cols+x+i]=1;
      }
      const center={x:(x+w/2)*tile,y:(y+h/2)*tile},midX=Math.floor(w/2),midY=Math.floor(h/2);
      const vents=[[2,2],[w-3,2],[2,h-3],[w-3,h-3],[2,midY],[w-3,midY],[midX,2],[midX,h-3]]
        .map(([i,j])=>point([x+i,y+j]));
      return {id,name,x:x*tile,y:y*tile,w:w*tile,h:h*tile,center,vents,ambush:!!ambush,state:'idle',visited:false};
    });
    for(const route of plan.halls){
      for(let i=1;i<route.length;i++){
        const [x,y]=route[i-1],[ex,ey]=route[i];
        for(let j=Math.min(y,ey)-1;j<=Math.max(y,ey)+1;j++)
          for(let k=Math.min(x,ex)-1;k<=Math.max(x,ex)+1;k++)cells[j*cols+k]=1;
      }
    }
    for(const [x,y,w,h] of plan.piers)
      for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[j*cols+i]=0;
    const [cx,cy,axis]=plan.door;
    const door={...point([cx,cy]),cx,cy,axis,open:false,cells:[]},doorTiles=new Uint8Array(cells.length);
    for(let i=-1;i<=1;i++){
      const c=cx+(axis==='y'?i:0),r=cy+(axis==='x'?i:0);
      door.cells.push({cx:c,cy:r});doorTiles[r*cols+c]=1;
    }
    const lab={width:cols*tile,height:rows*tile,cols,rows,tile,cells,doorTiles,door,rooms,theme,layout:id,piers:plan.piers,
      generation:legacy?1:2,layoutId:legacy?'legacy-'+oldLayout:plan.identity,scheme:plan.scheme,
      seed:plan.seed||0,route,intro:!!plan.intro,cycles:plan.cycles,
      layoutName:plan.name,entry:point(plan.start),gate:point(plan.gate),cache:point(plan.cache),
      key:{...point(plan.key),taken:false},event:null,serial:0,nav:new Map(),image:null};
    lab.firstRoom=rooms.find(r=>r.id==='hall');
    lab.bossRoom=plan.boss?rooms.find(r=>r.id==='exit'):null;
    lab.bossEntry=plan.boss?point(plan.bossEntry):null;
    lab.bossSpawn=plan.boss?point(plan.bossSpawn):null;
    lab.taskAnchors=['hall','gallery','loop'].map(id=>rooms.find(r=>r.id===id)).filter(Boolean)
      .map(r=>({...r.center,roomId:r.id}));
    for(const r of rooms)r.vents=r.vents.filter(p=>!blocked(lab,p.x,p.y,22));
    return lab;
  }
  function solid(lab,cx,cy){
    if(cx<0||cy<0||cx>=lab.cols||cy>=lab.rows)return true;
    if(lab.sealClosed){
      const s=lab.seal;
      if(cx>=s.left&&cx<=s.right&&cy>=s.top&&cy<=s.bottom)return true;
    }
    const i=cy*lab.cols+cx;
    return !lab.cells[i]||(!lab.door.open&&!!lab.doorTiles[i]);
  }
  function blocked(lab,x,y,r=0){
    if(r<=0)return solid(lab,Math.floor(x/tile),Math.floor(y/tile));
    const loX=Math.floor((x-r)/tile),hiX=Math.floor((x+r)/tile);
    const loY=Math.floor((y-r)/tile),hiY=Math.floor((y+r)/tile);
    for(let j=loY;j<=hiY;j++)for(let i=loX;i<=hiX;i++){
      if(!solid(lab,i,j))continue;
      const dx=x-Math.max(i*tile,Math.min((i+1)*tile,x)),dy=y-Math.max(j*tile,Math.min((j+1)*tile,y));
      if(dx*dx+dy*dy<r*r)return true;
    }
    return false;
  }
  // Traverse every cell crossed by a ray, also blocking diagonal cracks between two walls.
  function ray(lab,x,y,ex,ey) {
    let c=Math.floor(x/tile),r=Math.floor(y/tile);
    const ec=Math.floor(ex/tile),er=Math.floor(ey/tile);
    if(solid(lab,c,r)||solid(lab,ec,er))return false;
    const dx=ex-x,dy=ey-y,sx=Math.sign(dx),sy=Math.sign(dy);
    const tx=dx?Math.abs(tile/dx):Infinity,ty=dy?Math.abs(tile/dy):Infinity;
    let nextX=dx?((c+(sx>0?1:0))*tile-x)/dx:Infinity;
    let nextY=dy?((r+(sy>0?1:0))*tile-y)/dy:Infinity;
    while(c!==ec||r!==er){
      if(Math.min(nextX,nextY)>=1-1e-10)return true;
      if(nextX<nextY){c+=sx;nextX+=tx;}
      else if(nextY<nextX){r+=sy;nextY+=ty;}
      else {
        if(solid(lab,c+sx,r)||solid(lab,c,r+sy))return false;
        c+=sx;r+=sy;nextX+=tx;nextY+=ty;
      }
      if(solid(lab,c,r))return false;
    }
    return true;
  }
  const clearLine=(lab,a,b)=>ray(lab,a.x,a.y,b.x,b.y);
  function clearTravel(lab,a,b,r){
    if(!clearLine(lab,a,b))return false;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<1)return true;
    const nx=-dy*r/d,ny=dx*r/d;
    return ray(lab,a.x+nx,a.y+ny,b.x+nx,b.y+ny)&&ray(lab,a.x-nx,a.y-ny,b.x-nx,b.y-ny);
  }
  const roomAt=(lab,x,y)=>lab.rooms.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h)||null;
  function passMask(lab,radius){
    const key='body'+radius;
    if(lab.nav.has(key))return lab.nav.get(key);
    const mask=new Uint8Array(lab.cells.length);
    for(let i=0;i<mask.length;i++)if(lab.cells[i]){
      mask[i]=!blocked(lab,((i%lab.cols)+.5)*tile,(Math.floor(i/lab.cols)+.5)*tile,radius);
    }
    lab.nav.set(key,mask);return mask;
  }
  function nearestCell(lab,p,mask){
    const c=Math.floor(p.x/tile),r=Math.floor(p.y/tile),idx=r*lab.cols+c;
    if(mask[idx])return idx;
    let best=-1,bestD=Infinity;
    for(let y=Math.max(0,r-2);y<Math.min(r+3,lab.rows);y++)
      for(let x=Math.max(0,c-2);x<Math.min(c+3,lab.cols);x++){
        const i=y*lab.cols+x,dx=(x+.5)*tile-p.x,dy=(y+.5)*tile-p.y,d=dx*dx+dy*dy;
        if(mask[i]&&d<bestD&&ray(lab,p.x,p.y,p.x+dx,p.y+dy)){bestD=d;best=i;}
      }
    return best;
  }
  function field(lab,end,r,mask){
    const key=end+'@'+r;
    if(lab.nav.has(key))return lab.nav.get(key);
    const next=new Int16Array(mask.length).fill(-1),q=new Int16Array(mask.length);
    next[end]=end;q[0]=end;let start=0,tail=1;
    const offsets=[-lab.cols,1,lab.cols,-1];
    while(start<tail){
      const n=q[start++];
      for(const off of offsets){
        const i=n+off;
        if(mask[i]&&next[i]<0){q[tail++]=i;next[i]=n;}
      }
    }
    // Two pilots can move their target cells independently without an unbounded cache in endless mode.
    if(lab.nav.size>=20)for(const k of lab.nav.keys())if(k.includes('@')){lab.nav.delete(k);break;}
    lab.nav.set(key,next);return next;
  }
  function waypoint(lab,from,to){
    const radius=Math.min(32,Math.max(4,from.bodyR||from.r||10));
    if(clearTravel(lab,from,to,radius))return to;
    const bucket=radius<16?15:radius<=24?24:32;
    const mask=passMask(lab,bucket),origin=nearestCell(lab,from,mask),end=nearestCell(lab,to,mask);
    if(origin<0||end<0)return from;
    const next=field(lab,end,bucket,mask);
    if(next[origin]<0)return from;
    const coord=i=>({x:((i%lab.cols)+.5)*tile,y:(Math.floor(i/lab.cols)+.5)*tile});
    let i=origin,best=coord(i);
    for(let n=0;n<5&&i!==end;n++){
      i=next[i];const p=coord(i);
      if(!clearTravel(lab,from,p,radius))break;
      best=p;
    }
    return best;
  }
  function emit(lab,kind,text){lab.event={serial:++lab.serial,kind,text};return text;}
  function interact(lab,p){
    if(!p||p.hp===0)return '';
    if(!lab.key.taken&&Math.hypot(p.x-lab.key.x,p.y-lab.key.y)<43&&clearLine(lab,p,lab.key)){
      lab.key.taken=true;return emit(lab,'key','Access key acquired');
    }
    if(!lab.door.open){
      const d=lab.door;
      const along=d.axis==='x'?Math.abs(p.x-d.x):Math.abs(p.y-d.y);
      const across=d.axis==='x'?Math.abs(p.y-d.y):Math.abs(p.x-d.x);
      if(along<49&&across<47){
        if(!lab.key.taken)return 'Amber access key required';
        d.open=true;lab.nav.clear();return emit(lab,'unlock','Security bulkhead unlocked');
      }
    }
    return '';
  }
  function step(lab,pilots,allowStart=true){
    let trigger=null;
    for(const p of pilots){
      if(!p||p.hp===0)continue;
      interact(lab,p);
      const room=roomAt(lab,p.x,p.y);
      if(!room)continue;
      room.visited=true;
      if(allowStart&&!trigger&&room.ambush&&room.state==='idle'&&p.x>=room.x+20&&p.y>=room.y+20&&p.x<room.x+room.w-20&&p.y<room.y+room.h-20)trigger=room;
    }
    return trigger;
  }
  function snapshot(lab){
    return {generation:lab.generation,layoutId:lab.layoutId,key:lab.key.taken,door:lab.door.open,seen:lab.rooms.filter(r=>r.visited).map(r=>r.id),
      cleared:lab.rooms.filter(r=>r.state==='clear').map(r=>r.id)};
  }
  function restore(lab,state){
    if(!state)return;
    if(state.layoutId&&state.layoutId!==lab.layoutId)return;
    lab.key.taken=!!state.key;lab.door.open=!!state.door;lab.nav.clear();
    for(const r of lab.rooms){
      r.visited=!!state.seen?.includes(r.id);r.state=state.cleared?.includes(r.id)?'clear':'idle';
    }
  }
  function destination(lab){
    const active=lab.rooms.find(r=>r.state==='active');
    if(active)return active.center;
    if(lab.intro&&lab.firstRoom?.state==='idle')return lab.firstRoom.center;
    if(!lab.key.taken)return lab.key;
    if(!lab.door.open)return lab.door;
    const room=lab.rooms.find(r=>r.ambush&&r.state!=='clear');
    return room?room.center:lab.missionTarget||(lab.bossRoom&&!lab.bossDefeated?lab.bossEntry:lab.gate);
  }
  function goal(lab){
    if(lab.intro&&lab.firstRoom?.state==='idle')return 'Enter the '+lab.firstRoom.name.toLowerCase();
    if(!lab.key.taken)return 'Find the amber access key';
    if(!lab.door.open)return 'Unlock the amber bulkhead';
    const room=lab.rooms.find(r=>r.ambush&&r.state!=='clear');
    if(room)return 'Sweep the '+room.name.toLowerCase();
    if(lab.bossRoom&&!lab.bossDefeated)return 'Enter the '+lab.bossRoom.name.toLowerCase();
    return 'Reach the extraction gate';
  }
  function bossReady(lab,pilots){
    if(!lab.bossRoom||!lab.door.open||lab.bossDefeated)return false;
    const r=lab.bossRoom,pad=102;
    return pilots.some(p=>p&&p.hp!==0&&p.x>r.x+pad&&p.x<r.x+r.w-pad&&p.y>r.y+pad&&p.y<r.y+r.h-pad);
  }
  function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h);}
  function stroke(c,points,w,col){
    c.beginPath();c.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
    c.lineWidth=w;c.strokeStyle=col;c.stroke();
  }
  function polygon(c,points,col){
    c.beginPath();c.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
    c.closePath();c.fillStyle=col;c.fill();
  }
  function ellipse(c,x,y,rx,ry,col){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=col;c.fill();
  }
  function haze(c,x,y,r,color){
    const light=c.createRadialGradient(x,y,0,x,y,r);
    light.addColorStop(0,color+'46');light.addColorStop(.45,color+'17');light.addColorStop(1,color+'00');
    rect(c,x-r,y-r,r*2,r*2,light);
  }
  function hash(x,y,s=0){
    let n=Math.imul(x+9,73856093)^Math.imul(y+41,19349663)^Math.imul(s+3,83492791);
    n=Math.imul(n^(n>>>16),2246822507);return(n^(n>>>13))>>>0;
  }
  function floorPanel(c,x,y,i,j,p,seed){
    const n=hash(i,j,seed);
    rect(c,x,y,tile,tile,p.floor[(n>>>2)%3]);
    rect(c,x,y,32,2,p.joint);rect(c,x,y,2,32,p.joint);
    rect(c,x+3,y+2,24,1,p.rim+'55');
    const px=x+4+(n%17),py=y+7+(n>>>5)%15;
    if(n%4===0){
      rect(c,px,py,4,1,p.rim+'69');rect(c,px+4,py-1,6,1,p.rim+'50');
      rect(c,x+5,y+28,2,2,p.joint);rect(c,x+25,y+4,2,2,p.joint);
    }
    if(n%13===2)for(let k=0;k<3;k++)rect(c,x+5+k*6,y+24,3,2,p.trim+'58');
    if(p.material==='root'&&n%3===1){
      stroke(c,[[x,y+5],[x+5,y+8],[x+7,y+15],[x+14,y+21]],2,p.joint);
      stroke(c,[[x+6,y+11],[x+11,y+10],[x+15,y+6]],1,p.trim+'66');
      rect(c,x+14,y+5,3,2,p.trim+'78');
    }
    if(p.material==='furnace'&&n%7===0){
      rect(c,x+4,y+6,23,12,p.joint);
      for(let k=0;k<5;k++){rect(c,x+6+k*4,y+8,2,8,p.shade);rect(c,x+6+k*4,y+14,1,2,p.trim+'99');}
    }
    if(p.material==='lens'&&n%5===2){
      stroke(c,[[x+3,y+13],[x+9,y+13],[x+15,y+19],[x+29,y+19]],1,p.rim+'7a');
      rect(c,x+27,y+18,2,2,p.trim+'9c');
    }
  }
  function wallPanel(c,x,y,i,j,p,near,seed){
    const n=hash(i,j,seed),[north,east,south,west]=near;
    rect(c,x,y,32,32,p.shade);
    if(!north&&!east&&!south&&!west)return;
    rect(c,x+1,y+1,30,29,p.wall);
    rect(c,x+4,y+2,22,2,p.rim+'61');rect(c,x+2,y+4,2,20,p.rim+'55');
    if(n%4===1){
      rect(c,x+8,y+6,17,12,p.shade);
      for(let k=0;k<3;k++)rect(c,x+10,y+8+k*3,12,1,p.rim+'a0');
    }
    if(north){rect(c,x,y,32,5,p.rim);rect(c,x+2,y+1,27,1,p.trim);rect(c,x,y+5,32,3,p.shade);}
    if(west){rect(c,x,y,5,32,p.rim);rect(c,x,y+2,1,28,p.trim);}
    if(east){rect(c,x+26,y,6,32,p.shade);rect(c,x+26,y+1,3,29,p.rim);}
    if(south){
      rect(c,x,y+19,32,12,p.shade);rect(c,x,y+19,32,3,p.rim);
      rect(c,x+2,y+22,27,5,p.wall);rect(c,x+4,y+23,5,3,p.trim+'a0');
      rect(c,x,y+31,32,3,'#07101790');rect(c,x,y+34,32,2,'#0912164d');
      if((i+seed)%4===1){
        rect(c,x+8,y+22,17,5,p.shade);rect(c,x+10,y+23,13,2,p.lamp);
        haze(c,x+16,y+29,38,p.lamp);
      }
    }
    if(p.material==='root'&&n%2===1){
      stroke(c,[[x+3,y],[x+7,y+7],[x+17,y+10],[x+19,y+21],[x+29,y+26]],4,p.shade);
      stroke(c,[[x+3,y],[x+8,y+7],[x+17,y+9],[x+21,y+20]],2,p.trim+'a0');
      ellipse(c,x+9,y+8,4,3,p.trim);rect(c,x+8,y+6,3,1,p.lamp);
    }
  }
  function grate(c,x,y,p){
    rect(c,x-14,y-11,28,22,p.shade);rect(c,x-13,y-10,26,2,p.rim);
    rect(c,x-13,y-8,2,17,p.wall);rect(c,x+11,y-8,2,17,p.wall);
    for(let i=-8;i<=8;i+=4){rect(c,x+i,y-6,2,13,p.rim+'bb');rect(c,x+i+1,y-6,1,13,p.joint);}
    rect(c,x-14,y+9,28,2,p.rim+'80');rect(c,x-11,y+9,4,2,p.trim);
  }
  // The wall fixtures sit on solid deck cells. Their silhouettes also identify an
  // installation when only one chamber fits inside the pilots' lamp radius.
  function fixture(c,x,y,p,n){
    c.save();c.translate(x,y);
    if(p.material==='root'){
      for(const s of [-1,1]){
        stroke(c,[[0,2],[s*9,8],[s*19,3],[s*26,7]],4,p.wall);
        stroke(c,[[s*7,6],[s*13,-3],[s*20,-6]],2,p.trim);
        polygon(c,[[s*15,2],[s*12,-5],[s*18,-12],[s*22,-8],[s*19,-2]],p.trim);
      }
      ellipse(c,0,5,11,7,p.shade);ellipse(c,0,0,8,9,'#5d806a');ellipse(c,-2,-2,5,6,'#a1bd7e');
      rect(c,-3,-5,3,4,'#e4e7a8');haze(c,0,0,28,p.lamp);
    }else if(p.material==='furnace'){
      polygon(c,[[-23,-6],[-16,-13],[17,-13],[23,-6],[21,8],[-20,8]],p.wall);
      rect(c,-17,-8,34,13,p.shade);
      for(let j=0;j<7;j++){rect(c,-14+j*4,-6,2,10,'#783d32');rect(c,-14+j*4,-1,2,4,'#f5a154');}
      rect(c,-20,6,39,3,p.rim);haze(c,0,5,39,'#ee8b47');
    }else if(p.material==='lens'){
      ellipse(c,0,6,22,8,p.shade);
      for(const [dx,h] of [[-10,12],[1,23],[12,10]]){
        polygon(c,[[dx-6,3],[dx-5,-h+4],[dx,-h],[dx+6,-h+6],[dx+5,4],[dx,7]],'#6d698d');
        polygon(c,[[dx,-h],[dx+6,-h+6],[dx+4,3],[dx,6]],'#a89dc5');
        stroke(c,[[dx-4,-h+4],[dx,-h],[dx+3,-h+3]],2,'#ded8ee');
      }
      haze(c,1,-2,36,p.lamp);
    }else{
      rect(c,-21,-8,43,19,p.shade);rect(c,-19,-9,39,16,p.wall);
      rect(c,-19,-9,39,2,p.rim);rect(c,-17,-4,13,9,p.shade);
      rect(c,-15,-2,9,4,n%2?'#8abba2':'#edb77b');
      for(let j=0;j<5;j++)rect(c,1+j*3,-5,1,10,p.rim);
      rect(c,-17,7,10,3,p.trim);rect(c,13,7,6,3,p.trim);
    }
    c.restore();
  }
  // All large installations below are inlaid in the deck or visible through
  // glass. Only the machines mounted on the blueprint's piers rise above it.
  function plate(c,x,y,w,h,cut,color){
    polygon(c,[[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],
      [x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]],color);
  }
  function ring(c,x,y,r,w,color,start=0,end=Math.PI*2){
    c.beginPath();c.arc(x,y,r,start,end);c.strokeStyle=color;c.lineWidth=w;c.stroke();
  }
  function chevron(c,x,y,d,p){
    polygon(c,[[x-6*d,y-7],[x-1*d,y-7],[x+6*d,y],[x-1*d,y+7],[x-6*d,y+7],[x+d,y]],p);
  }
  function stencil(c,s,x,y,size,color,align='center'){
    c.fillStyle=color;c.font='bold '+size+'px monospace';c.textAlign=align;c.fillText(s,x,y);
  }
  function hatch(c,x,y,w,h,p){
    plate(c,x,y,w,h,8,p.shade);plate(c,x+2,y+2,w-4,h-4,7,p.rim);
    plate(c,x+4,y+4,w-8,h-8,6,p.joint);
    for(const sx of [x+8,x+w-10])for(const sy of [y+6,y+h-8]){
      rect(c,sx,sy,3,3,p.shade);rect(c,sx,sy,2,1,p.trim);
    }
  }
  function rail(c,x,y,w,p){
    rect(c,x,y,w,10,p.shade);rect(c,x+3,y+2,w-6,2,p.rim);
    for(let i=5;i<w-5;i+=14)rect(c,x+i,y+4,5,4,p.wall);
    rect(c,x,y+9,w,2,p.rim+'aa');
  }
  function lift(c,x,y,w,h,p,code){
    hatch(c,x-w/2-7,y-h/2-7,w+14,h+14,p);
    plate(c,x-w/2,y-h/2,w,h,12,p.wall);
    for(let a=-w/2+19;a<w/2-9;a+=14){
      rect(c,x+a,y-h/2+10,2,h-20,p.shade);
      rect(c,x+a+2,y-h/2+12,1,h-23,p.rim+'66');
    }
    for(const s of [-1,1]){
      const yy=y+s*(h/2-14);
      rail(c,x-w/2+15,yy-4,w-30,p);
      rect(c,x-w/2+27,yy-4,27,2,p.lamp+'87');
      rect(c,x+w/2-54,yy-4,27,2,p.lamp+'87');
      for(let i=-w/2+19;i<w/2-16;i+=21){
        polygon(c,[[x+i,yy+5*s],[x+i+8,yy+5*s],[x+i+3,yy+11*s],[x+i-5,yy+11*s]],p.trim);
      }
    }
    // Weathered transport marking, readable from the pilots' spawn position.
    stencil(c,code,x,y+12,40,p.trim+'c8');
    for(const s of [-1,1])for(let i=0;i<2;i++)chevron(c,x+s*(w/2-28-i*13),y,s,p.trim+'a9');
  }
  function belt(c,x,y,w,h,p,load=0){
    hatch(c,x,y,w,h,p);
    for(let i=9;i<w-8;i+=10){
      rect(c,x+i,y+10,4,h-20,p.rim+'c0');rect(c,x+i+3,y+10,2,h-20,p.shade);
    }
    for(const sy of [y+7,y+h-9])rect(c,x+13,sy,w-26,2,p.trim+'a8');
    for(let i=0;i<load;i++){
      const mx=x+18+(i+.5)*(w-40)/load,my=y+13+(i%2)*3,mw=32+(i%2)*6,mh=h-29;
      plate(c,mx-mw/2,my,mw,mh,3,'#5b5547');
      rect(c,mx-mw/2+3,my+2,mw-6,2,'#99825a');rect(c,mx-mw/2+3,my+mh-4,mw-6,2,'#302f2d');
      rect(c,mx-9,my+2,3,mh-4,'#ad956c');rect(c,mx+7,my+2,3,mh-4,'#ad956c');
      rect(c,mx-4,my+4,7,4,'#c1b18a');rect(c,mx-2,my+5,3,1,'#514c40');
    }
    // Catchlights across the flush cover distinguish the cargo below from cover.
    stroke(c,[[x+8,y+h*.66],[x+30,y+8],[x+36,y+8],[x+14,y+h*.66]],2,'#b1cdc32b');
    for(let i=0;i<4;i++)rect(c,x+w-28+i*4,y+h-7,2,2,p.lamp+'9c');
  }
  function turbine(c,x,y,r,p,angle=0){
    ellipse(c,x,y,r+4,r+4,p.shade);ellipse(c,x,y,r+1,r+1,p.rim);
    ellipse(c,x,y,r-3,r-3,p.shade);ring(c,x,y,r-8,2,p.wall);
    c.save();c.translate(x,y);c.rotate(angle);
    for(let i=0;i<8;i++){
      c.rotate(Math.PI/4);
      polygon(c,[[3,-6],[r*.45,-r*.38],[r-10,-r*.22],[r-8,2],[r*.68,3],[r*.38,8]],p.rim+'c0');
      stroke(c,[[r*.43,-r*.27],[r*.68,-r*.19],[r-10,-3]],2,p.joint);
    }
    c.restore();ellipse(c,x,y,10,10,p.wall);ellipse(c,x,y,6,6,p.trim);
    // Three fixed bars protect the intake under the walkable grating.
    for(const u of [-.46,0,.46]){
      const len=Math.sqrt(1-u*u)*(r-4),yy=y+r*u;
      rect(c,x-len,yy-1,len*2,3,p.wall);rect(c,x-len,yy-2,len*2,1,p.rim);
    }
  }
  function graft(c,x,y,w,h,p,variant){
    hatch(c,x,y,w,h,p);
    const dw=w-18,dh=h-14;
    plate(c,x+9,y+7,dw,dh,6,'#1a3434');
    for(let i=0;i<9;i++){
      const n=hash(i,variant),sx=x+11+(n%dw),sy=y+9+((n>>>9)%(dh-5));
      rect(c,sx,sy,2,2,i%2?'#81a68a':'#50715d');
    }
    const mx=x+w/2,my=y+h/2;
    for(let i=0;i<5;i++){
      const s=i%2?1:-1,ey=y+10+i*(h-18)/5,ex=i%3?x+13:x+w-14;
      const line=[[ex,ey],[(ex+mx)/2,ey+s*7],[mx+s*7,my+s*10],[mx,my]];
      stroke(c,line,5,'#36594a');stroke(c,line,2,'#7d9664');
      ellipse(c,(ex+mx)/2,ey+s*7,5,2,'#729266');
    }
    ellipse(c,mx+2,my+2,14,18,'#142e31');ellipse(c,mx,my,12,16,'#648b71');
    polygon(c,[[mx,my-14],[mx+3,my-8],[mx+6,my-4],[mx+4,my+9],[mx-1,my+14],[mx-4,my+4]],'#9db57d');
    ellipse(c,mx-3,my-5,3,5,'#b4c488');ellipse(c,mx+5,my+4,2,3,'#46675b');
    stroke(c,[[x+12,y+h*.52],[x+12,y+13],[x+17,y+9],[x+w*.47,y+9]],2,'#a9d1b586');
    for(let i=0;i<3;i++)rect(c,x+w-21+i*4,y+h-8,2,2,i===variant%3?'#d0d5a2':'#657b61');
  }
  function conduit(c,x,y,w,h,p,turn=0){
    for(let k=0;k<3;k++){
      const xx=x+k*9,yy=y+k*9;
      const route=[[xx,yy],[xx+w*.34,yy],[xx+w*.34+h*.5,yy+h*.5],[xx+w+turn,yy+h*.5]];
      stroke(c,route,8,p.shade);stroke(c,route,5,p.rim+'aa');stroke(c,route,1,p.trim+'aa');
    }
    for(const dx of [12,w*.25,w*.77])rect(c,x+dx,y+(dx>w*.5?h*.5:0)-3,5,26,p.wall);
  }
  function optic(c,x,y,r,p,n){
    const dark='#242d3b',brass=p.trim;
    ellipse(c,x,y,r+3,r+3,p.shade);ellipse(c,x,y,r+1,r+1,p.rim);
    ellipse(c,x,y,r-2,r-2,dark);ring(c,x,y,r*.78,2,'#636f83');
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6,px=Math.cos(a),py=Math.sin(a);
      stroke(c,[[x+px*(r-8),y+py*(r-8)],[x+px*(r-4),y+py*(r-4)]],2,j%3?'#627589':brass);
    }
    c.save();c.translate(x,y);c.rotate(n*.19);
    const w=r*.51;
    polygon(c,[[-w,4],[-w*.23,-w],[w,-3],[w*.23,w]],'#827e9e');
    polygon(c,[[-w,4],[-w*.23,-w],[-w*.13,2]],'#c3acca');
    polygon(c,[[-w*.13,2],[-w*.23,-w],[w,-3]],'#aaa2c0');
    polygon(c,[[-w*.13,2],[w,-3],[w*.23,w]],'#6e829b');
    stroke(c,[[-w,4],[-w*.13,2],[w*.23,w]],2,'#d2c7d4');
    c.restore();ring(c,x,y,r*.89,2,'#b8bac185',3.5,4.7);
  }
  function locker(c,x,y,w,h,p,count){
    hatch(c,x,y,w,h,p);
    const step=(w-16)/count;
    for(let i=0;i<count;i++){
      const xx=x+8+i*step;
      plate(c,xx,y+8,step-3,h-17,4,p.rim);
      rect(c,xx+2,y+12,step-7,h-24,p.wall);
      rect(c,xx+5,y+13,step-13,3,p.trim);rect(c,xx+step*.53,y+22,step*.22,4,p.shade);
      for(let j=0;j<4;j++)rect(c,xx+5,y+h-22+j*3,step-16,1,p.shade);
    }
  }
  function survey(c,x,y,w,h,p){
    const left=x-w/2,top=y-h/2;
    hatch(c,left,top,w,h,p);plate(c,left+9,top+8,w-18,h-16,4,'#273d3d');
    for(let i=10;i<w-12;i+=13)rect(c,left+i,top+9,1,h-20,'#789e9555');
    for(let i=12;i<h-10;i+=13)rect(c,left+10,top+i,w-20,1,'#789e9555');
    const r=h*.33;
    for(const m of [.35,.64,1])ring(c,x,y,r*m,2,'#84a69c');
    for(let i=0;i<11;i++){
      const dx=(hash(i,1)%73)/72-.5,dy=(hash(i,2)%38)/37-.5;
      rect(c,x+dx*w*.76,y+dy*h*.72,3,3,'#a0ad84');
    }
    stroke(c,[[x,y],[x+r*.8,y-r*.54]],3,'#b3bc92');
    for(let j=0;j<6;j++)rect(c,left+w-25,top+13+j*5,5+(j%3)*3,2,p.rim);
  }
  function kiln(c,x,y,w,h,p){
    hatch(c,x,y,w,h,p);
    plate(c,x+8,y+8,w-16,h-16,5,'#453135');
    for(let i=13;i<w-13;i+=8){
      const reach=h*.35+(hash(i,h)%9);
      rect(c,x+i,y+h-11-reach,4,reach,'#9d614d');
      rect(c,x+i,y+h-16,4,5,'#cc946a');
      rect(c,x+i-2,y+12,2,h-24,p.shade);
    }
    for(let i=12;i<h-9;i+=14)rect(c,x+8,y+i,w-16,4,p.wall);
    rect(c,x+11,y+9,w-22,2,p.rim);
  }
  function bossCourt(c,lab,w,h,p){
    const x=w/2,y=h/2,rad=Math.min(w,h)*.29;
    const edge=p.rim+'88',ink=p.trim+'82';
    for(const side of [-1,1]){
      rail(c,55,y+side*(h/2-44),w-110,p);
      for(let i=74;i<w-50;i+=82){
        rect(c,i,y+side*(h/2-49),18,3,p.trim);
        if(i%3===0)rect(c,i+20,y+side*(h/2-49),9,3,p.rim);
      }
    }
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=a+Math.PI*.17;
      ring(c,x,y,rad,3,edge,a,b);ring(c,x,y,rad+8,2,ink,a,b-.20);
      const ux=Math.cos(a+.04),uy=Math.sin(a+.04);
      stroke(c,[[x+ux*(rad-7),y+uy*(rad-7)],[x+ux*(rad+14),y+uy*(rad+14)]],3,edge);
    }
    const type=lab.route%4;
    if(type===0){
      const wings=[[0,-30],[-37,1],[-34,15],[0,-7],[34,15],[37,1]];
      polygon(c,wings.map(([a,b])=>[x+a,y+b]),ink);
      polygon(c,[[x-24,y+15],[x,y+2],[x+24,y+15],[x,y+30]],edge);
    }else if(type===1){
      for(const s of [-1,1])stroke(c,[[x,y+30],[x+s*10,y+8],[x+s*28,y-2],[x+s*32,y-22]],5,ink);
      ellipse(c,x,y-15,11,19,edge);stroke(c,[[x,y+10],[x,y-26]],3,ink);
    }else if(type===2){
      for(const s of [-1,0,1])polygon(c,[[x+s*18-7,y+21],[x+s*18-8,y+2],[x+s*18+4,y-24],[x+s*18+9,y+4],[x+s*18+5,y+21]],ink);
    }else{
      polygon(c,[[x,y-33],[x+32,y],[x,y+29],[x-32,y]],edge);
      stroke(c,[[x-30,y],[x,y-9],[x+31,y],[x,y+11],[x-30,y]],4,ink);
    }
    // Direction marks are low-contrast paint. The fight surface stays clear.
    for(const side of [-1,1])for(let i=0;i<3;i++)chevron(c,x+side*(rad+70+i*17),y,-side,ink);
  }
  function extraBay(c,lab,index,w,h,p){
    const x=w/2,y=h/2,id=hash(index,lab.scheme,lab.route)%5;
    if(id===0){belt(c,45,y-39,w-90,54,p,2);locker(c,49,h-78,w-100,42,p,5);}
    else if(id===1){survey(c,x-47,y,140,90,p);turbine(c,x+82,y,36,p,.6);}
    else if(id===2){conduit(c,28,42,w-126,68,p);for(const s of [-1,1])locker(c,x+s*58-42,y+19,84,58,p,2);}
    else if(id===3){for(const s of [-1,1])graft(c,x+s*58-34,y-53,68,106,p,s+3);}
    else {rail(c,40,y,w-80,p);for(const s of [-1,1])optic(c,x+s*56,y,28,p,s);}
  }
  function roomArt(c,lab,r,index){
    const p=lab.theme,w=Math.max(420,r.w),h=Math.max(280,r.h),mx=Math.round(w/2),my=Math.round(h/2);
    c.save();c.translate(r.x,r.y);c.scale(r.w/w,r.h/h);
    if(r===lab.bossRoom)bossCourt(c,lab,w,h,p);
    else if(r.id.startsWith('annex-'))extraBay(c,lab,index,w,h,p);
    else if(lab.layout===3){
      if(r.id==='entry')lift(c,mx,my,234,137,p,'H-01');
      else if(r.id==='hall'){
        for(const s of [-1,1])kiln(c,mx+s*99-61,my-58,122,114,p);
        rail(c,43,my+76,w-86,p);
      }else if(r.id==='key'){locker(c,34,43,w-68,76,p,5);kiln(c,mx-74,my+16,148,57,p);}
      else if(r.id==='cache'){belt(c,39,my-37,w-78,57,p,3);locker(c,43,h-74,145,42,p,4);}
      else if(r.id==='loop'){conduit(c,28,48,w-118,68,p);for(const s of [-1,1])turbine(c,mx+s*69,my+31,40,p,.1);}
      else if(r.id==='gallery'){for(let i=0;i<3;i++)kiln(c,mx-139+i*98,my-46,79,92,p);}
      else{kiln(c,mx-114,my-60,228,116,p);rail(c,60,my+78,w-120,p);}
    }else if(lab.layout===0){
      if(r.id==='entry'){
        lift(c,mx-13,my,Math.min(228,w-118),142,p,'F-01');
        for(const sy of [my-66,my+66]){rail(c,w-67,sy,64,p);for(let i=0;i<3;i++)chevron(c,w-58+i*17,sy+22,1,p.trim+'91');}
      }else if(r.id==='hall'){
        belt(c,48,my-62,w-96,48,p,4);belt(c,75,my+21,w-117,48,p,3);
        rail(c,39,my+3,w-80,p);
        for(let x=78;x<w-48;x+=52)chevron(c,x,my+8,1,p.trim);
      }else if(r.id==='key'){
        locker(c,28,26,w-56,55,p,6);rail(c,30,h-52,w-60,p);
        stencil(c,'BONDED',mx+24,my+12,29,p.trim+'a9');
      }else if(r.id==='cache'){
        lift(c,mx+16,my-18,174,83,p,'M-4');locker(c,28,h-90,104,46,p,3);
      }else if(r.id==='loop'){
        conduit(c,39,47,w-120,70,p);for(const s of [-1,1])turbine(c,mx+s*71,my+22,37,p,s*.3);
      }else if(r.id==='gallery'){
        belt(c,56,my+34,w-112,39,p,0);survey(c,mx+11,my-32,156,81,p);
        for(const sx of [55,w-88])locker(c,sx,35,38,77,p,1);
      }else{
        lift(c,mx-12,my+1,205,145,p,'T-07');rail(c,38,h-61,w-78,p);
      }
    }else if(lab.layout===1){
      if(r.id==='entry'){
        graft(c,38,48,74,123,p,1);graft(c,w-109,48,73,123,p,2);
        turbine(c,mx,my+17,51,p,.25);
      }else if(r.id==='hall'){
        hatch(c,mx-99,my-92,198,184,p);turbine(c,mx,my,77,p,.55);
        for(const s of [-1,1]){graft(c,mx+s*154-31,my-49,62,100,p,s+3);rail(c,mx+s*157-38,my+66,74,p);}
      }else if(r.id==='key'){
        for(let i=0;i<3;i++)graft(c,40+i*91,40,73,101,p,i);
        conduit(c,42,h-70,w-102,36,p);
      }else if(r.id==='cache'){
        survey(c,mx,my-9,161,77,p);locker(c,40,h-48,w-80,32,p,6);
      }else if(r.id==='loop'){
        for(const s of [-1,1]){turbine(c,mx+s*91,my,64,p,s*.26);graft(c,mx+s*91-36,my+80,72,53,p,s+1);}
        conduit(c,56,54,w-148,81,p);
      }else if(r.id==='gallery'){
        for(let i=0;i<4;i++)graft(c,39+i*94,my-49+(i%2)*21,73,100,p,i);
      }else{
        turbine(c,mx-7,my,80,p,.6);for(const s of [-1,1])graft(c,mx+s*140-31,my-47,62,94,p,s+1);
      }
    }else{
      if(r.id==='entry'){
        lift(c,mx,my,224,150,p,'');optic(c,mx,my,46,p,1);
      }else if(r.id==='hall'){
        rail(c,46,my-9,w-92,p);rail(c,46,my+8,w-92,p);
        for(const [dx,rr] of [[-123,31],[0,61],[123,31]])optic(c,mx+dx,my,rr,p,dx*.02);
      }else if(r.id==='key'){
        locker(c,36,36,w-72,56,p,6);survey(c,mx+15,my+25,147,65,p);
      }else if(r.id==='cache'){
        survey(c,mx-50,my,145,89,p);optic(c,mx+75,my,42,p,3);
      }else if(r.id==='loop'){
        conduit(c,42,49,w-128,100,p);conduit(c,45,my,w-112,90,p);
        optic(c,mx,my,37,p,1);
      }else if(r.id==='gallery'){
        for(const [dx,dy,rr] of [[-93,27,32],[0,-29,43],[93,27,32]])optic(c,mx+dx,my+dy,rr,p,dx*.02);
        stroke(c,[[mx-80,my+21],[mx,my-26],[mx+80,my+21]],3,p.trim+'a0');
      }else{
        lift(c,mx+7,my-7,192,148,p,'X-03');for(const s of [-1,1])optic(c,mx+s*105,my+94,21,p,s);
      }
    }
    // Names are painted near a wall so they stay clear of the fighting lanes.
    const label=String(index+1).padStart(2,'0')+' / '+r.name.toUpperCase();
    const labelW=Math.min(w-68,label.length*9+18),ly=h-29;
    rect(c,30,ly-15,labelW,20,p.joint+'de');rect(c,30,ly-15,4,20,p.trim);
    stencil(c,label,40,ly,14,'#a6afa4','left');
    c.restore();
  }
  function pierArt(c,lab){
    const p=lab.theme;
    for(const [cx,cy,cols,rows] of lab.piers){
      const x=cx*tile+4,y=cy*tile+3,w=cols*tile-8,h=rows*tile-7;
      hatch(c,x,y,w,h,p);
      if(lab.layout===0){
        if((cx+cy)%2)locker(c,x+3,y+4,w-6,h-10,p,w>64?3:2);
        else{
          belt(c,x+3,y+4,w-6,h-8,p,0);
          for(const s of [-1,1])rect(c,x+w/2+s*10,y+7,5,h-17,p.trim);
        }
      }else if(lab.layout===1)graft(c,x+2,y+2,w-4,h-4,p,cx%4);
      else if(lab.layout===3)kiln(c,x+2,y+2,w-4,h-4,p);
      else optic(c,x+w/2,y+h/2,Math.min(w,h)*.40,p,cy*.1);
    }
  }
  function bake(lab){
    const c0=document.createElement('canvas');
    // Native pixel art is doubled on the 960×540 game surface.
    c0.width=lab.width/2;c0.height=lab.height/2;
    const c=c0.getContext('2d',{alpha:false}),p=lab.theme,seed=lab.seed||lab.layout*103+3;
    c.scale(.5,.5);c.lineJoin='bevel';c.imageSmoothingEnabled=false;
    rect(c,0,0,lab.width,lab.height,p.shade);
    const floor=(x,y)=>x>=0&&y>=0&&x<lab.cols&&y<lab.rows&&lab.cells[y*lab.cols+x];
    for(let j=0;j<lab.rows;j++)for(let i=0;i<lab.cols;i++)if(floor(i,j)){
      const x=i*tile,y=j*tile;
      floorPanel(c,x,y,i,j,p,seed);
      if(!roomAt(lab,x+16,y+16)){
        // Embedded service conduits follow the turns; their short colored ties
        // let the pilot recognize a corridor while running at the light's edge.
        if(!floor(i,j-1)||!floor(i,j+1)){
          const yy=y+(floor(i,j-1)?24:5);
          rect(c,x,yy,32,4,p.shade);rect(c,x,yy,32,1,p.rim);
          if(i%3===1)rect(c,x+11,yy,9,3,p.trim);
        }
        if(!floor(i-1,j)||!floor(i+1,j)){
          const xx=x+(floor(i-1,j)?24:5);
          rect(c,xx,y,4,32,p.shade);rect(c,xx,y,1,32,p.rim);
          if(j%3===1)rect(c,xx,y+11,3,9,p.trim);
        }
      }
    }
    lab.rooms.forEach((r,i)=>roomArt(c,lab,r,i));
    for(let j=0;j<lab.rows;j++)for(let i=0;i<lab.cols;i++)if(!floor(i,j)){
      const near=[floor(i,j-1),floor(i+1,j),floor(i,j+1),floor(i-1,j)];
      if(near.some(Boolean))wallPanel(c,i*tile,j*tile,i,j,p,near,seed);
    }
    for(const r of lab.rooms){
      if(r.ambush)for(const v of r.vents)grate(c,v.x,v.y,p);
      // Put a larger landmark above the chamber, only if that cell is a solid north wall.
      for(let k=2;k<r.w/tile-1;k+=4){
        const i=r.x/tile+k,j=r.y/tile-1;
        if(!floor(i,j)&&floor(i,j+1))fixture(c,(i+.5)*tile,(j+.52)*tile,p,k);
      }
    }
    pierArt(c,lab);
    return c0;
  }
  function draw(c,g){
    const lab=g.map.lab;
    if(!lab.image)lab.image=bake(lab);
    c.save();c.imageSmoothingEnabled=false;
    const v=g.camera?.activeView;
    if(v){
      const x=Math.max(0,Math.floor(v.x/2)*2),y=Math.max(0,Math.floor(v.y/2)*2);
      const w=Math.min(lab.width,Math.ceil((v.x+v.sw/v.zoom)/2)*2)-x;
      const h=Math.min(lab.height,Math.ceil((v.y+v.sh/v.zoom)/2)*2)-y;
      if(w>0&&h>0)c.drawImage(lab.image,x/2,y/2,w/2,h/2,x,y,w,h);
    }else c.drawImage(lab.image,0,0,lab.width,lab.height);
    for(let i=0;i<lab.rooms.length;i++){
      const r=lab.rooms[i],x=r.x+r.w/2,y=r.y+10;
      if(v&&(x<v.x-110||x>v.x+v.sw/v.zoom+110||y<v.y-8||y>v.y+v.sh/v.zoom+8))continue;
      const phase=Math.floor((g.time||0)*1.5+i)%4;
      for(const side of [-1,1]){
        const xx=x+side*92;
        rect(c,xx-10,y-3,20,7,lab.theme.shade);
        for(let j=0;j<4;j++)rect(c,xx-8+j*4,y-1,3,3,j===phase?lab.theme.lamp:lab.theme.rim);
      }
    }
    // The bulkhead is part of the solid deck. Sight reveals the face a beam
    // stops against; enemy and collectible sprites use the tighter actor mask.
    doorArt(c,lab.door,g.time||0);
    c.restore();
  }
  function keyArt(c,x,y,t){
    const rise=Math.round(Math.sin(t*3)*2);
    c.save();c.translate(x,y);
    ellipse(c,0,6,19,8,'#132128');ellipse(c,0,4,17,7,'#8d754a');
    ellipse(c,0,3,14,6,'#374548');rect(c,-9,2,18,3,'#283337');
    for(const s of [-1,1]){
      rect(c,s*14-1,-2,3,4,'#e5a852');rect(c,s*14-1,-3,3,1,'#fff0b7');
    }
    haze(c,0,-7+rise,36,'#ffc566');
    c.translate(0,rise-9);
    polygon(c,[[-11,-5],[-7,-10],[-1,-9],[2,-6],[1,-2],[11,2],[13,7],[10,8],[7,5],[5,6],[3,3],[-2,1],[-6,2],[-11,-1]],'#271e22');
    polygon(c,[[-9,-5],[-6,-8],[-2,-7],[0,-5],[-1,-1],[10,3],[11,6],[9,6],[7,3],[5,4],[3,2],[-2,0],[-6,1],[-9,-1]],'#e6a643');
    rect(c,-6,-6,4,3,'#574c38');stroke(c,[[-9,-5],[-6,-8],[-2,-7]],2,'#fff1b5');
    stroke(c,[[0,-1],[8,2]],1,'#ffe49c');
    c.restore();
  }
  function doorArt(c,d,t){
    c.save();c.translate(d.x,d.y);
    if(d.axis==='y')c.rotate(Math.PI/2);
    for(const s of [-1,1]){
      rect(c,-16,s===1?43:-51,32,8,'#172429');rect(c,-14,s===1?42:-50,27,4,'#7c8782');
      rect(c,-9,s===1?44:-47,17,2,d.open?'#9ee7ce':'#f4bc68');
    }
    if(!d.open){
      rect(c,-13,-44,26,88,'#16252b');rect(c,-11,-43,22,86,'#4c5453');
      for(let i=-39;i<40;i+=12){
        rect(c,-9,i,18,8,'#636964');
        polygon(c,[[-9,i+1],[-4,i+1],[2,i+7],[-3,i+7]],'#bd9254');
        rect(c,6,i+1,2,3,'#b4b59c');
      }
      plate(c,-15,-17,30,34,5,'#162429');plate(c,-13,-15,26,30,4,'#665d49');
      rect(c,-7,-10,14,11,'#e7bb75');rect(c,-4,-7,8,9,'#263337');
      plate(c,-10,-2,20,14,2,'#ecc582');rect(c,-2,1,4,7,'#3d3930');
      rect(c,-8,-1,16,2,'#ffe8a4');
      if(Math.sin(t*3)>-.4)rect(c,-11,11,3,3,'#ffc468');
    }else{
      for(let y=-36;y<40;y+=14)polygon(c,[[-5,y-2],[0,y-2],[6,y+3],[0,y+8],[-5,y+8],[0,y+3]],'#79a79799');
    }
    c.restore();
  }
  function drawObjects(c,g){
    const lab=g.map.lab;
    if(!lab.key.taken)keyArt(c,lab.key.x,lab.key.y,g.time||0);
    for(const r of lab.rooms)if(r.state==='active'){
      const intensity=(Math.sin((g.time||0)*3)+1)*.15+.28;
      c.save();c.globalAlpha=intensity;
      for(const v of r.vents){rect(c,v.x-11,v.y+9,5,2,'#ffd392');rect(c,v.x+6,v.y+9,5,2,'#ffac65');}
      c.restore();
    }
  }
  window.Labyrinth={create,preview,solid,blocked,clearLine,waypoint,roomAt,step,interact,goal,destination,bossReady,
    snapshot,restore,draw,drawTerrain:draw,drawObjects};
})();
