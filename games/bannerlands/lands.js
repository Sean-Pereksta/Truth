// Lands are deterministic from the campaign seed; map generation never advances the combat RNG.
export const LAND_MAPS=Object.freeze([
  {id:'crownlands',label:'Crownlands',description:'Rolling woodland and a winding river. Three stone crossings link the royal roads.'},
  {id:'riverlands',label:'Riverlands',description:'Twin rivers and a broad tributary divide the realm. Bridges and shallow fords decide the approach.'},
  {id:'highlands',label:'Highland Marches',description:'Mountain walls divide wooded valleys. Stone passes offer short, defensible invasion routes.'},
  {id:'coast',label:'Shattered Coast',description:'Long tidal inlets shelter peninsulas. Causeways and coastal roads offer routes around the water.'},
  {id:'kingsroad',label:'Kingsroad',description:'A dense royal road network crosses deep forest and a central river. Fast roads reward mobile armies.'},
  {id:'twin-lakes',label:'Twin Lakes',description:'Two broad lakes split the flanks. Long causeways and a clear central corridor offer very different routes to the battle.'},
  {id:'mountain-crown',label:'Mountain Crown',description:'A jagged ring of peaks shelters a central valley. Four broad gates and an outer river reward control of the approaches.'},
  {id:'four-rivers',label:'Four Rivers',description:'Four river arms reach toward an open central arena. Cross the outer bridges or race along the banks to contest the middle.'},
  {id:'open',label:'Open Realm',description:'The original open battlefield: rolling grass, forests and hills, with no interior impassable barriers.'}
]);

export function isPassableTile(tile){
  return !!tile&&(tile.terrain!=='water'&&tile.terrain!=='mountain'||tile.feature==='bridge'||tile.feature==='ford'||tile.feature==='pass');
}

// Costs are seconds of travel relative to open grass. The same values serve player and AI routing.
export function tileTravelCost(tile,kind='infantry'){
  if(!isPassableTile(tile))return Infinity;
  if(tile.feature==='road')return .78;
  if(tile.feature==='bridge')return .9;
  if(tile.feature==='ford')return kind==='siege'?1.9:kind==='cavalry'?1.6:1.35;
  if(tile.feature==='pass')return kind==='siege'?1.25:kind==='cavalry'?1.15:1.08;
  if(tile.terrain==='forest')return kind==='siege'?1.5:kind==='cavalry'?1.4:1.1;
  if(tile.terrain==='hill')return kind==='siege'?1.35:kind==='cavalry'?1.18:1.08;
  return 1;
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const mix=(x,y,seed)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function noise(x,y,seed){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  return (mix(ix,iy,seed)*(1-sx)+mix(ix+1,iy,seed)*sx)*(1-sy)+(mix(ix,iy+1,seed)*(1-sx)+mix(ix+1,iy+1,seed)*sx)*sy;
}

class MinHeap{
  constructor(){this.items=[];}
  push(index,score){const a=this.items;let i=a.length;a.push({index,score});while(i){const p=(i-1)>>1;if(a[p].score<=score)break;a[i]=a[p];i=p;}a[i]={index,score};}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
  get length(){return this.items.length;}
}

export function generateLands(game,homes=[]){
  const {W,H,tiles}=game,seed=(Number(game.config?.seed)||44277)>>>0;
  const landscape=LAND_MAPS.find(m=>m.id===game.config?.landscape)||LAND_MAPS[0];
  if(game.config)game.config.landscape=landscape.id;
  game.landscape=landscape;game.landmarks=[];
  if(landscape.id==='open'){
    for(const tile of tiles){tile.feature=null;tile.featureAxis=null;}
    game.playable=tiles.reduce((n,t)=>n+Number(isPassableTile(t)),0);
    game.landsStats={roads:0,bridges:0,fords:0,passes:0,water:tiles.filter(t=>t.terrain==='water').length,mountains:0};
    return landscape;
  }
  const at=(x,y)=>x>=0&&y>=0&&x<W&&y<H?tiles[y*W+x]:null;
  const inside=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1;
  const xs=Array.from({length:5},(_,i)=>Math.round(8+(W-16)*i/4)+.5),ys=Array.from({length:4},(_,i)=>Math.round(8+(H-16)*i/3)+.5);
  const reservations=[];for(const y of ys)for(const x of xs)reservations.push({x,y});
  const safe=new Uint8Array(tiles.length);
  for(const p of reservations)for(let y=Math.floor(p.y)-8;y<=Math.floor(p.y)+8;y++)for(let x=Math.floor(p.x)-8;x<=Math.floor(p.x)+8;x++){
    if(inside(x,y)&&(x+.5-p.x)**2+(y+.5-p.y)**2<=7.25**2)safe[y*W+x]=1;
  }
  for(const tile of tiles){
    tile.feature=null;tile.featureAxis=null;
    if(!inside(tile.x,tile.y)){tile.terrain='water';tile.height=0;tile.value=0;continue;}
    const forest=noise(tile.x/10,tile.y/10,seed^0x6d2b79f5)*.8+noise(tile.x/4,tile.y/4,seed^0x24635342)*.2;
    const hill=noise(tile.x/14,tile.y/14,seed^0x3c6ef372);
    tile.terrain=forest>(landscape.id==='kingsroad'?.45:landscape.id==='highlands'?.53:landscape.id==='twin-lakes'?.52:.59)?'forest':hill>(['highlands','mountain-crown'].includes(landscape.id)?.52:.65)?'hill':'grass';
    tile.height=tile.terrain==='hill'?.12:0;tile.value=tile.terrain==='hill'?2:1;
    if(safe[tile.y*W+tile.x]){tile.terrain='grass';tile.height=0;tile.value=1;}
  }
  const landmark=(kind,name,x,y,geometry={})=>{
    if(game.landmarks.some(p=>p.kind===kind&&Math.hypot(p.x-x,p.y-y)<5))return;
    game.landmarks.push({id:'land-'+(game.landmarks.length+1),name,kind,x:x+.5,y:y+.5,...geometry});
  };
  const paint=(x,y,terrain)=>{
    if(!inside(x,y)||safe[y*W+x])return;
    const tile=at(x,y);if(terrain==='mountain'&&tile.terrain==='water')return;
    tile.terrain=terrain;tile.feature=null;tile.height=terrain==='mountain'?.5+mix(x,y,seed)*.2:terrain==='hill'?.12:0;tile.value=terrain==='water'||terrain==='mountain'?0:terrain==='hill'?2:1;
  };
  const waterBand=(axis,center,width,phase,extent=1)=>{
    const length=axis==='y'?H:W;
    const samples=[];
    for(let along=1;along<length-1;along++){
      if(along>length*extent)break;
      const wave=Math.sin(along/length*Math.PI*3+phase)*Math.min(4,(axis==='y'?W:H)*.025)+Math.sin(along/length*Math.PI*7+phase)*1.1;
      const cross=Math.round(center+wave);samples[along]=cross;
      for(let offset=-width;offset<=width;offset++)paint(axis==='y'?cross+offset:along,axis==='y'?along:cross+offset,'water');
    }
    return {axis,center,width,samples};
  };
  const pendingCrossings=[];
  const crossing=(...args)=>pendingCrossings.push(()=>carveCrossing(...args));
  const carveCrossing=(band,along,kind,name)=>{
    along=clamp(Math.round(along),2,(band.axis==='y'?H:W)-3);
    const center=band.samples[along]??Math.round(band.center),axis=band.axis==='y'?'x':'y';
    let marked=0;
    for(let lane=-2;lane<=2;lane++)for(let side=-band.width-5;side<=band.width+5;side++){
      const x=band.axis==='y'?center+side:along+lane,y=band.axis==='y'?along+lane:center+side,tile=at(x,y);
      if(!tile||!inside(x,y)||safe[y*W+x])continue;
      if(tile.terrain==='water'){tile.feature=kind;tile.featureAxis=axis;tile.height=0;tile.value=1;marked++;}
      else if(tile.terrain==='mountain'){tile.feature='pass';tile.featureAxis=axis;tile.height=.08;tile.value=1;}
      else if(isPassableTile(tile)&&!tile.feature){tile.feature='road';tile.featureAxis=axis;}
    }
    if(marked)landmark(kind,name,band.axis==='y'?center:along,band.axis==='y'?along:center,{axis,width:5,length:band.width*2+1});
  };
  const ridge=(axis,center,width,phase)=>{
    const length=axis==='y'?H:W,samples=[];
    for(let along=1;along<length-1;along++){
      const cross=Math.round(center+Math.sin(along/length*Math.PI*4+phase)*2.3);samples[along]=cross;
      for(let off=-width;off<=width;off++)paint(axis==='y'?cross+off:along,axis==='y'?along:cross+off,'mountain');
      for(const off of [-width-1,width+1]){const x=axis==='y'?cross+off:along,y=axis==='y'?along:cross+off;if(at(x,y)?.terrain!=='water')paint(x,y,'hill');}
    }
    return {axis,center,width,samples};
  };
  const pass=(...args)=>pendingCrossings.push(()=>carvePass(...args));
  const carvePass=(band,along,name)=>{
    along=clamp(Math.round(along),3,(band.axis==='y'?H:W)-4);const cross=band.samples[along]??Math.round(band.center),axis=band.axis==='y'?'x':'y';let marked=0;
    for(let lane=-2;lane<=2;lane++)for(let side=-band.width-4;side<=band.width+4;side++){
      const x=band.axis==='y'?cross+side:along+lane,y=band.axis==='y'?along+lane:cross+side,tile=at(x,y);
      if(!inside(x,y)||!tile||safe[y*W+x]||tile.terrain==='water')continue;
      if(tile.terrain==='mountain'){tile.feature='pass';tile.featureAxis=axis;tile.height=.08;tile.value=1;marked++;}
      else if(!tile.feature){tile.feature='road';tile.featureAxis=axis;}
    }
    if(marked)landmark('pass',name,band.axis==='y'?cross:along,band.axis==='y'?along:cross,{axis,width:5,length:band.width*2+1});
  };
  const gapX=i=>(xs[i]+xs[i+1])/2-.5,gapY=i=>(ys[i]+ys[i+1])/2-.5;
  const phase=mix(9,17,seed)*Math.PI*2;
  if(landscape.id==='crownlands'){
    const river=waterBand('y',gapX(1),1,phase);
    for(const [i,y] of [.21,.5,.79].entries())crossing(river,H*y,'bridge',['Northwatch Bridge','Crown Bridge','Southwatch Bridge'][i]);
    const hills=ridge('y',gapX(3),1,phase+.7);pass(hills,H*.3,'Fox Pass');pass(hills,H*.7,'Stag Pass');
  }else if(landscape.id==='riverlands'){
    const west=waterBand('y',gapX(1),2,phase),east=waterBand('y',gapX(2),1,phase+2);
    for(const [i,y]of [.19,.48,.8].entries()){crossing(west,H*y,i===1?'ford':'bridge',['Willow Bridge','Willow Ford','Reed Bridge'][i]);crossing(east,H*(y+.035),i===1?'bridge':'ford',['Eastmere Ford','Twinwater Bridge','Rushwater Ford'][i]);}
    const tributary=waterBand('x',gapY(1),1,phase+1);
    for(const [i,x]of [.16,.5,.84].entries())crossing(tributary,W*x,'bridge',['Westbank Bridge','Rivermeet Bridge','Eastbank Bridge'][i]);
    // The junctions remain waterways. Their banks are connected by the independent crossings above.
  }else if(landscape.id==='highlands'){
    for(const [i,x]of [gapX(1),gapX(2)].entries()){
      const wall=ridge('y',x,2,phase+i);
      for(const [j,y]of [.2,.4,.8].entries())pass(wall,H*(y+i*.025),[['Eagle Gate','High King Pass','Greywatch Gap'],['Pine Gate','Eastwind Pass','Stone Gate']][i][j]);
    }
    const river=waterBand('x',gapY(1),1,phase+2);for(const [i,x]of [.18,.49,.82].entries())crossing(river,W*x,'bridge',['Valley Bridge','Stonewater Bridge','East Vale Bridge'][i]);
  }else if(landscape.id==='coast'){
    // Tidal inlets enter from opposite shores, leaving a continuous inland backbone.
    const north=waterBand('y',gapX(1),3,phase,.63);
    crossing(north,H*.32,'bridge','Northshore Causeway');crossing(north,H*.47,'ford','Tidal Ford');
    const south={axis:'y',center:gapX(2),width:3,samples:[]};
    for(let y=Math.round(H*.37);y<H-1;y++){const center=Math.round(south.center+Math.sin(y/H*Math.PI*3+phase+2)*3);south.samples[y]=center;for(let off=-3;off<=3;off++)paint(center+off,y,'water');}
    crossing(south,H*.55,'bridge','Seabreak Causeway');crossing(south,H*.81,'bridge','Southshore Bridge');
    const headland=ridge('x',gapY(0),1,phase);pass(headland,W*.19,'Cliffgate Pass');pass(headland,W*.57,'Headland Pass');pass(headland,W*.86,'Coastwatch Pass');
  }else if(landscape.id==='twin-lakes'){
    const lakeY=H*.5,rx=W*(.105+mix(13,21,seed)*.015),ry=H*.23;
    for(const [i,cx]of [W*.25,W*.75].entries()){
      for(let y=Math.floor(lakeY-ry-2);y<=lakeY+ry+2;y++)for(let x=Math.floor(cx-rx-2);x<=cx+rx+2;x++){
        const edge=((x-cx)/rx)**2+((y-lakeY)/ry)**2,bend=.08*Math.sin(y*.29+phase+i);
        if(edge<1+bend)paint(x,y,'water');else if(edge<1.2&&at(x,y)?.terrain!=='water')paint(x,y,'hill');
      }
      const band={axis:'y',center:cx,width:Math.ceil(rx)+1,samples:[]};
      crossing(band,lakeY,'bridge',i?'Eastmere Causeway':'Westmere Causeway');
    }
  }else if(landscape.id==='mountain-crown'){
    const cx=W*.5,cy=H*.5,rx=W*.235,ry=H*.275;
    for(let y=Math.floor(cy-ry-5);y<=cy+ry+5;y++)for(let x=Math.floor(cx-rx-5);x<=cx+rx+5;x++){
      const angle=Math.atan2((y-cy)/ry,(x-cx)/rx),radius=Math.hypot((x-cx)/rx,(y-cy)/ry),edge=1+.045*Math.sin(angle*7+phase),thickness=3/Math.min(rx,ry);
      if(Math.abs(radius-edge)<thickness)paint(x,y,'mountain');else if(Math.abs(radius-edge)<thickness*1.8&&at(x,y)?.terrain!=='water')paint(x,y,'hill');
    }
    for(const [axis,cross,along,name]of [['x',cx,cy-ry,'North Crown Gate'],['x',cx,cy+ry,'South Crown Gate'],['y',cy,cx-rx,'West Crown Gate'],['y',cy,cx+rx,'East Crown Gate']]){
      pendingCrossings.push(()=>{
        let marked=0;for(let lane=-2;lane<=2;lane++)for(let side=-6;side<=6;side++){
          const x=Math.round(axis==='x'?cross+lane:along+side),y=Math.round(axis==='x'?along+side:cross+lane),tile=at(x,y);
          if(!inside(x,y)||!tile||safe[y*W+x]||tile.terrain==='water')continue;
          if(tile.terrain==='mountain'){tile.feature='pass';tile.featureAxis=axis==='x'?'y':'x';tile.height=.08;tile.value=1;marked++;}else if(!tile.feature){tile.feature='road';tile.featureAxis=axis==='x'?'y':'x';}
        }
        if(marked)landmark('pass',name,axis==='x'?Math.round(cross):Math.round(along),axis==='x'?Math.round(along):Math.round(cross),{axis:axis==='x'?'y':'x',width:5,length:11});
      });
    }
    const river=waterBand('x',gapY(0),1,phase+1);
    for(const [i,x]of [.13,.5,.87].entries())crossing(river,W*x,'bridge',['Raven Bridge','Crownwater Bridge','Falcon Bridge'][i]);
  }else if(landscape.id==='four-rivers'){
    const cx=W*.5,cy=H*.5,arena=Math.min(W,H)*.115;
    const arm=(axis,start,end,center,offset)=>{
      const band={axis,center,width:2,samples:[]},length=axis==='y'?H:W;
      for(let along=Math.max(1,Math.floor(start));along<=Math.min(length-2,Math.ceil(end));along++){
        const cross=Math.round(center+Math.sin(along/length*Math.PI*3+phase+offset)*2);band.samples[along]=cross;
        for(let side=-2;side<=2;side++)paint(axis==='y'?cross+side:along,axis==='y'?along:cross+side,'water');
      }
      return band;
    };
    // Offset the northern and southern channels from the center capital column;
    // otherwise the equal opening reservations would break each river into pools.
    const north=arm('y',1,cy-arena,cx-arena*.9,0),south=arm('y',cy+arena,H-2,cx+arena*.9,1),west=arm('x',1,cx-arena,cy,2),east=arm('x',cx+arena,W-2,cy,3);
    crossing(north,H*.21,'bridge','North River Bridge');crossing(south,H*.79,'bridge','South River Bridge');
    crossing(west,W*.21,'bridge','West River Bridge');crossing(east,W*.79,'bridge','East River Bridge');
  }else{
    const river=waterBand('x',gapY(1),1,phase);
    for(const [i,x]of [.15,.5,.85].entries())crossing(river,W*x,'bridge',['Western Tollbridge','King\'s Crossing','Eastern Tollbridge'][i]);
    const wall=ridge('y',gapX(3),1,phase);pass(wall,H*.2,'North Road Gate');pass(wall,H*.4,'Royal Pass');pass(wall,H*.8,'South Road Gate');
  }
  if(['twin-lakes','mountain-crown','four-rivers'].includes(landscape.id)){
    // New central-objective modes always have a broad arena, independent of the
    // seed. Rivers and mountains shape its approaches rather than its floor.
    const cx=W*.5,cy=H*.5,radius=Math.min(W,H)*.1;
    for(let y=Math.floor(cy-radius);y<=cy+radius;y++)for(let x=Math.floor(cx-radius);x<=cx+radius;x++)if((x+.5-cx)**2+(y+.5-cy)**2<=radius*radius)paint(x,y,'grass');
  }
  for(const carve of pendingCrossings)carve();

  const componentInfo=()=>{
    const labels=new Int32Array(tiles.length);labels.fill(-1);const components=[],queue=new Int32Array(tiles.length);
    for(let start=0;start<tiles.length;start++){
      if(labels[start]>=0||!isPassableTile(tiles[start]))continue;
      const id=components.length;let head=0,tail=0;queue[tail++]=start;labels[start]=id;const members=[];
      while(head<tail){const index=queue[head++],tile=tiles[index];members.push(index);for(const [dx,dy]of DIRS){const x=tile.x+dx,y=tile.y+dy,ni=y*W+x;if(inside(x,y)&&labels[ni]<0&&isPassableTile(tiles[ni])){labels[ni]=id;queue[tail++]=ni;}}}
      components.push(members);
    }
    return {labels,components};
  };
  // Repair only narrow broken crossings, never remove the river or mountain wall itself.
  for(let repair=0;repair<64;repair++){
    const {labels,components}=componentInfo();if(components.length<=1)break;
    let main=0;for(let i=1;i<components.length;i++)if(components[i].length>components[main].length)main=i;
    const scores=new Float64Array(tiles.length);scores.fill(Infinity);const parent=new Int32Array(tiles.length);parent.fill(-1);const heap=new MinHeap();
    for(const index of components[main]){const tile=tiles[index];if(DIRS.some(([dx,dy])=>inside(tile.x+dx,tile.y+dy)&&labels[(tile.y+dy)*W+tile.x+dx]!==main)){scores[index]=0;heap.push(index,0);}}
    let finish=-1;
    while(heap.length){const {index,score}=heap.pop();if(score!==scores[index])continue;if(labels[index]>=0&&labels[index]!==main){finish=index;break;}const tile=tiles[index];for(const [dx,dy]of DIRS){const x=tile.x+dx,y=tile.y+dy;if(!inside(x,y))continue;const ni=y*W+x,next=score+(isPassableTile(tiles[ni])?1:7);if(next<scores[ni]){scores[ni]=next;parent[ni]=index;heap.push(ni,next);}}}
    if(finish<0)throw new Error('The landscape could not connect its land routes.');
    const path=[];for(let n=finish;n>=0;n=parent[n])path.push(n);path.reverse();
    let lastKind=null;
    for(let i=0;i<path.length;i++){
      const tile=tiles[path[i]];if(isPassableTile(tile)){lastKind=null;continue;}
      const previous=tiles[path[Math.max(0,i-1)]],axis=tile.x!==previous.x?'x':'y',kind=tile.terrain==='water'?'bridge':'pass';
      if(kind!==lastKind)landmark(kind,kind==='bridge'?'Old Stone Crossing':'Wayfarer Pass',tile.x,tile.y,{axis,width:5,length:3});lastKind=kind;
      for(let lane=-2;lane<=2;lane++){const x=tile.x+(axis==='y'?lane:0),y=tile.y+(axis==='x'?lane:0),p=at(x,y);if(inside(x,y)&&p&&!safe[y*W+x]&&!isPassableTile(p)){p.feature=p.terrain==='water'?'bridge':'pass';p.featureAxis=axis;p.height=p.terrain==='water'?0:.08;p.value=1;}}
    }
  }

  const roadPath=(start,goal)=>{
    const from=Math.floor(start.y)*W+Math.floor(start.x),to=Math.floor(goal.y)*W+Math.floor(goal.x),scores=new Float64Array(tiles.length);scores.fill(Infinity);scores[from]=0;
    const parent=new Int32Array(tiles.length);parent.fill(-1);const heap=new MinHeap();heap.push(from,0);
    while(heap.length){const {index,score}=heap.pop(),tile=tiles[index],h=(Math.abs(tile.x-Math.floor(goal.x))+Math.abs(tile.y-Math.floor(goal.y)))*.78;if(score>scores[index]+h+1e-8)continue;if(index===to){const path=[];for(let n=to;n>=0;n=parent[n])path.push(n);return path.reverse();}
      for(const [dx,dy]of DIRS){const x=tile.x+dx,y=tile.y+dy;if(!inside(x,y))continue;const ni=y*W+x,cost=tileTravelCost(tiles[ni]);if(!Number.isFinite(cost))continue;const next=scores[index]+cost;if(next<scores[ni]){scores[ni]=next;parent[ni]=index;heap.push(ni,next+(Math.abs(x-Math.floor(goal.x))+Math.abs(y-Math.floor(goal.y)))*.78);}}
    }
    return [];
  };
  const layRoad=(a,b,wide=false)=>{
    const path=roadPath(a,b);
    for(let i=0;i<path.length;i++){
      const tile=tiles[path[i]],next=tiles[path[Math.min(i+1,path.length-1)]],axis=next.x!==tile.x?'x':'y';
      const offsets=wide?[-2,-1,0,1,2]:[-1,0,1];for(const lane of offsets){const x=tile.x+(axis==='y'?lane:0),y=tile.y+(axis==='x'?lane:0),p=at(x,y);if(p&&inside(x,y)&&!safe[y*W+x]&&isPassableTile(p)&&!['bridge','ford','pass'].includes(p.feature)){p.feature='road';p.featureAxis=axis;}}
    }
  };
  // A deterministic minimum spanning network serves every potential capital equally.
  const connected=new Set([0]);
  while(connected.size<reservations.length){let a=0,b=0,best=Infinity;for(const i of connected)for(let j=0;j<reservations.length;j++)if(!connected.has(j)){const distance=(reservations[i].x-reservations[j].x)**2+(reservations[i].y-reservations[j].y)**2;if(distance<best){best=distance;a=i;b=j;}}layRoad(reservations[a],reservations[b],landscape.id==='kingsroad');connected.add(b);}
  if(landscape.id==='kingsroad'){
    layRoad(reservations[0],reservations[19],true);layRoad(reservations[4],reservations[15],true);
    landmark('road','The Kingsroad',Math.floor(W*.5),Math.floor(H*.5));
  }
  // Extra supplied starting positions from future map layouts get the same safe link.
  for(const home of homes)if(!reservations.some(p=>p.x===home.x&&p.y===home.y)){
    let near=reservations[0];for(const p of reservations)if((p.x-home.x)**2+(p.y-home.y)**2<(near.x-home.x)**2+(near.y-home.y)**2)near=p;layRoad(home,near);
  }
  game.playable=tiles.reduce((n,t)=>n+Number(isPassableTile(t)),0);
  game.landsStats={roads:tiles.filter(t=>t.feature==='road').length,bridges:tiles.filter(t=>t.feature==='bridge').length,fords:tiles.filter(t=>t.feature==='ford').length,passes:tiles.filter(t=>t.feature==='pass').length,water:tiles.filter(t=>t.terrain==='water'&&!isPassableTile(t)).length,mountains:tiles.filter(t=>t.terrain==='mountain'&&!isPassableTile(t)).length};
  return landscape;
}
