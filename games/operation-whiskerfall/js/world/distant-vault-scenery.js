(function(){
  'use strict';
  const W=window.OW;
  const themes={
    cave_rimeglass:{id:'rimeglass',background:'#102637',edge:'#87acb8',water:'#123a50',glow:'#b8eff5',tile:288,device:1},
    cave_cindercoil:{id:'cindercoil',background:'#211b1c',edge:'#8d7768',water:'#60291d',glow:'#ffb36d',tile:272,device:7},
    cave_zephyr:{id:'zephyr',background:'#172b28',edge:'#789688',water:'#1e403b',glow:'#c4ead0',tile:288,device:1},
    cave_kraken:{id:'drowned-maw',background:'#102931',edge:'#698e93',water:'#123c49',glow:'#92e2dc',tile:272,device:7}
  };
  W.Assets=W.Assets||{};
  for(const t of Object.values(themes))for(const kind of ['floor','props'])W.Assets['vault_'+t.id+'_'+kind]='assets/expeditions/'+t.id+'-'+kind+'.png';
  W.Assets.vault_dungeon_walls='assets/expeditions/dungeon-walls.png';
  const ready=image=>!!image&&image.complete!==false&&(image.naturalWidth||image.width)>0;
  const floors=w=>w.vaultSpec.bridge&&w.state.solved?[...w.rooms,w.vaultSpec.bridge]:w.rooms;
  const contains=(rooms,x,y)=>rooms.some(r=>x>=r.x&&y>=r.y&&x<=r.x+r.w&&y<=r.y+r.h);
  const canvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
  function frame(theme,index,image){
    const supplied=W.DungeonSceneryArt?.[theme.id]?.frames?.[index];if(supplied?.crop)return supplied;
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,w=width/4,h=height/2,x=index%4*w,y=Math.floor(index/4)*h;return{crop:[x,y,w,h],anchor:[x+w/2,y+h*.94]};
  }
  function prop(ctx,theme,image,index,x,y,width,height,alpha=1){
    if(!ready(image))return false;const f=frame(theme,index,image),[sx,sy,sw,sh]=f.crop,scale=Math.min(width/sw,height/sh),anchor=f.anchor||[sx+sw/2,sy+sh];
    ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(image,sx,sy,sw,sh,x+(sx-anchor[0])*scale,y+(sy-anchor[1])*scale,sw*scale,sh*scale);ctx.restore();return true;
  }
  function exposedEdges(rooms){
    const xs=[...new Set(rooms.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b),ys=[...new Set(rooms.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b),grid=ys.slice(0,-1).map((y,j)=>xs.slice(0,-1).map((x,i)=>contains(rooms,(x+xs[i+1])/2,(y+ys[j+1])/2))),groups=new Map();
    const add=(axis,at,from,to,nx,ny)=>{const key=[axis,at,nx,ny].join(':');if(!groups.has(key))groups.set(key,{axis,at,nx,ny,intervals:[]});groups.get(key).intervals.push([from,to]);};
    for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){if(!grid[j][i])continue;if(!grid[j-1]?.[i])add('h',ys[j],xs[i],xs[i+1],0,-1);if(!grid[j+1]?.[i])add('h',ys[j+1],xs[i],xs[i+1],0,1);if(!grid[j][i-1])add('v',xs[i],ys[j],ys[j+1],-1,0);if(!grid[j][i+1])add('v',xs[i+1],ys[j],ys[j+1],1,0);}
    const edges=[];for(const group of groups.values()){const intervals=group.intervals.sort((a,b)=>a[0]-b[0]),merged=[];for(const range of intervals){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}for(const [from,to]of merged)edges.push({...group,from,to,intervals:undefined});}return edges;
  }
  function walls(ctx,rooms,theme,image){
    const meta=W.DungeonWallArt;if(!ready(image)||!meta?.frames)return;
    const indices=meta.themes?.[theme.id]||{wall:Object.values(themes).indexOf(theme)*2,corner:Object.values(themes).indexOf(theme)*2+1},edges=exposedEdges(rooms),corners=new Set();
    const paint=(index,x,y,width,height,angle=0)=>{const f=meta.frames[index];if(!f?.crop)return;const [sx,sy,sw,sh]=f.crop,anchor=f.anchor||[sx+sw/2,sy+sh],scale=Math.min(width/sw,height/sh);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,sx,sy,sw,sh,(sx-anchor[0])*scale,(sy-anchor[1])*scale,sw*scale,sh*scale);ctx.restore();};
    for(const e of edges){const count=Math.ceil((e.to-e.from)/190),length=(e.to-e.from)/count,angle=e.ny<0?0:e.ny>0?Math.PI:e.nx>0?Math.PI/2:-Math.PI/2;for(let i=0;i<count;i++){const along=e.from+(i+.5)*length;paint(indices.wall,e.axis==='h'?along:e.at+e.nx*5,e.axis==='v'?along:e.at+e.ny*5,length+8,100,angle);}
      for(const along of [e.from,e.to]){const x=e.axis==='h'?along:e.at,y=e.axis==='v'?along:e.at,key=x+','+y;if(corners.has(key))continue;corners.add(key);paint(indices.corner,x+e.nx*20,y+e.ny*20,90,100);}
    }
  }
  function build(renderer,w,theme,floor,props,wallImage){
    const surface=canvas(w.width,w.height),c=surface.getContext('2d'),rooms=floors(w),tile=canvas(theme.tile,theme.tile),t=tile.getContext('2d');
    t.drawImage(floor,0,0,theme.tile,theme.tile);const pattern=c.createPattern(tile,'repeat');
    c.fillStyle=theme.background;c.fillRect(0,0,w.width,w.height);
    // Dim painted stone continues into the cavern backdrop. Walkable floors
    // are rendered opaquely later, making their exact collision edge distinct.
    c.save();c.globalAlpha=.16;c.fillStyle=pattern;c.fillRect(100,160,1720,1500);c.restore();
    for(const h of w.vaultSpec.holes){c.fillStyle=theme.water;c.fillRect(h.x-8,h.y-8,h.w+16,h.h+16);}
    if(ready(props)){
      let n=0;
      for(let y=240;y<=1540;y+=145)for(let x=180;x<=1740;x+=145){
        if(contains(rooms,x,y)||![[100,0],[-100,0],[0,100],[0,-100]].some(([dx,dy])=>contains(rooms,x+dx,y+dy)))continue;
        prop(c,theme,props,n%3===0?0:n%3===1?2:3,x,y,110+(n%3)*20,150+(n%2)*20,.88);n++;
      }
      for(const [i,h]of w.vaultSpec.holes.entries())if(h.w>=200&&h.h>=170)prop(c,theme,props,theme.id==='cindercoil'?1:2,h.x+h.w*.5,h.y+h.h*.7,h.w*.7,h.h*.8,.86);
    }
    walls(c,rooms,theme,wallImage);
    // Draw the whole union after outside decorations. Props cannot create an
    // apparent obstacle on a route: their overhang is covered by the floor.
    for(const r of rooms){c.fillStyle='#07151c';c.fillRect(r.x-16,r.y-16,r.w+32,r.h+32);c.fillStyle=theme.edge;c.fillRect(r.x-6,r.y-6,r.w+12,r.h+12);}
    c.save();c.beginPath();for(const r of rooms)c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle=pattern;c.fillRect(0,0,w.width,w.height);c.fillStyle='rgba(9,23,29,.15)';c.fillRect(0,0,w.width,w.height);c.restore();
    return surface;
  }
  function drawGround(renderer,w){
    const theme=themes[w.entry?.id],floor=theme&&renderer.images?.['vault_'+theme.id+'_floor'],props=theme&&renderer.images?.['vault_'+theme.id+'_props'],wallImage=renderer.images?.vault_dungeon_walls;if(!theme||!ready(floor))return false;
    const cache=renderer._distantScenery||(renderer._distantScenery=new Map()),key=w.entry.id+':'+(w.vaultSpec.bridge&&w.state.solved?'cooled':'base'),metadata=W.DungeonSceneryArt?.[theme.id],wallMetadata=W.DungeonWallArt;let record=cache.get(key);
    if(!record||record.floor!==floor||record.props!==props||record.metadata!==metadata||record.wallImage!==wallImage||record.wallMetadata!==wallMetadata){record={floor,props,metadata,wallImage,wallMetadata,surface:build(renderer,w,theme,floor,props,wallImage)};cache.set(key,record);while(cache.size>2)cache.delete(cache.keys().next().value);}
    renderer.ctx.drawImage(record.surface,0,0);return true;
  }
  function drawDevice(renderer,w,node,index){
    const theme=themes[w.entry?.id],image=theme&&renderer.images?.['vault_'+theme.id+'_props'];if(!theme||!ready(image))return false;
    const cell=node.requires?7:theme.device;return prop(renderer.ctx,theme,image,cell,node.x,node.y+23,90,96,w.state.vaultNodes[index]?1:.88);
  }
  function drawGate(renderer,w,gate){
    const theme=themes[w.entry?.id],meta=W.DungeonWallArt,image=renderer.images?.vault_dungeon_walls,f=theme&&meta?.frames?.[meta.themes?.[theme.id]?.wall];if(!f||!ready(image))return false;
    if(gate.open)return true;
    // A sealed doorway uses its own dungeon masonry. Opening removes the
    // complete barrier, preserving the exact floor and collision corridor.
    const c=renderer.ctx,[sx,sy,sw,sh]=f.crop,vertical=gate.h>gate.w,width=vertical?gate.h:gate.w,height=vertical?gate.w:gate.h,scale=Math.max(width/sw,height/sh);
    c.save();c.beginPath();c.rect(gate.x,gate.y,gate.w,gate.h);c.clip();c.fillStyle=theme.background;c.fillRect(gate.x,gate.y,gate.w,gate.h);c.translate(gate.x+gate.w/2,gate.y+gate.h/2);if(vertical)c.rotate(Math.PI/2);c.drawImage(image,sx,sy,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);c.restore();return true;
  }
  W.DistantVaultScenery={themes,frame,prop,floors,contains,exposedEdges,walls,drawGround,drawDevice,drawGate};
})();
