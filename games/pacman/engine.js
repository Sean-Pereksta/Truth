/** Pac-Man: Blackout — deterministic tile-world RTS simulation. */
export const UNIT_DEFS = {
  hero:{name:'Pac-Man',side:'pac',cost:0,hp:280,speed:3.35,damage:11,range:1.05,trainTime:0,sight:8,description:'Your team commander. Eats pellets on contact. His death eliminates his team; allies can still win.'},
  miner:{name:'Muncher',side:'pac',cost:40,hp:78,speed:2.55,damage:4,range:1.05,trainTime:8,sight:5,description:'Fast pellet mining. Harvest orders automatically clear nearby corridors.'},
  guardian:{name:'Guardian',side:'pac',cost:65,hp:175,speed:2.45,damage:15,range:1.25,trainTime:12,sight:5,description:'Durable escort. Protect miners and Pac-Man from hunting parties.'},
  engineer:{name:'Engineer',side:'pac',cost:45,hp:92,speed:2.75,damage:5,range:1.2,trainTime:9,sight:6,description:'Fast support and repairs nearby friendly structures. Can mine pellets.'},
  extractor:{name:'Extractor',side:'pac',cost:100,hp:88,speed:1.95,damage:3,range:1.1,trainTime:16,sight:6,mineRange:4.5,description:'Fragile ranged miner. Extracts visible pellets along a clear corridor.'},
  scout:{name:'Wisp',side:'ghost',cost:30,hp:130,speed:3.15,damage:13,range:1.15,trainTime:7,sight:9,description:'Durable fast scout. Reveals runners in cleared, dark corridors.'},
  hunter:{name:'Hunter',side:'ghost',cost:45,hp:220,speed:2.8,damage:25,range:1.2,trainTime:9,sight:5,description:'Powerful hunting-party core. Combine Hunters with Binder snares to trap runners.'},
  binder:{name:'Binder',side:'ghost',cost:70,hp:175,speed:2.45,damage:14,range:3.5,trainTime:13,sight:6,description:'Casts a marked AoE Snare. Dodge the circle before it roots nearby Pac troops.'},
  brute:{name:'Brute',side:'ghost',cost:95,hp:450,speed:1.9,damage:42,range:1.35,trainTime:16,sight:5,description:'Massive heavy escort. Excellent against buildings, slow through the maze.'}
};

export const BUILDING_DEFS = {
  nest:{name:'Command Nest',side:'pac',cost:130,w:3,h:3,hp:620,buildTime:14,description:'Summons Pac troops and slowly restores nearby allies. Losing it does not end the match.'},
  refuge:{name:'Refuge',side:'pac',cost:90,w:3,h:3,hp:380,buildTime:10,description:'Forward troop production, healing and vision. Build on any cleared ground that fits.'},
  tower:{name:'Pulse Tower',side:'pac',cost:75,w:2,h:2,hp:270,buildTime:10,damage:12,range:6,description:'Automatic defense. Provides time to retreat or finish mining.'},
  well:{name:'Digestor',side:'pac',cost:110,w:3,h:3,hp:310,buildTime:14,description:'Generates Spark and forges renewable Power charges. Sustains the final breach.'},
  lair:{name:'Haunt Lair',side:'ghost',cost:125,w:3,h:3,hp:640,buildTime:14,description:'Produces hunting parties. Build forward lairs to shorten reinforcement routes.'},
  watch:{name:'Watch Relay',side:'ghost',cost:70,w:2,h:2,hp:230,buildTime:10,description:'Long-range local vision. Scout and hold the dark corridors after pellets are consumed.'},
  spike:{name:'Spectral Spire',side:'ghost',cost:85,w:2,h:2,hp:285,buildTime:10,damage:9,range:5.5,description:'Defensive ranged support. Protect lairs and important junctions.'}
};

export const DIFFICULTIES = {
  easy:{name:'Scout',label:'Easy',allyDifficulty:'hard',enemyDifficulty:'easy',description:'Your AI partners play on Hard; opposing AI plays on Easy.',thinkInterval:2.1,partySize:3,maxUnits:24,caution:.9,buildInterval:40},
  normal:{name:'Hunter',label:'Medium',allyDifficulty:'normal',enemyDifficulty:'normal',description:'Your AI partners and opposing AI both play on Medium.',thinkInterval:1.15,partySize:4,maxUnits:38,caution:.72,buildInterval:27},
  hard:{name:'Stalker',label:'Hard',allyDifficulty:'easy',enemyDifficulty:'hard',description:'Your AI partners play on Easy; opposing AI plays on Hard.',thinkInterval:.65,partySize:5,maxUnits:48,caution:.65,buildInterval:19},
  nightmare:{name:'Nightmare',label:'Nightmare',allyDifficulty:'easy',enemyDifficulty:'nightmare',description:'Your AI partners play on Easy; opposing AI plays on Nightmare.',thinkInterval:.4,partySize:6,maxUnits:54,caution:.58,buildInterval:15}
};

export const PAC_TEAMS = ['pac','pac2','pac3'];
export const TEAM_DEFS = {
  pac:{id:'pac',side:'pac',name:'Pac Gold',color:'#ffd552'},
  pac2:{id:'pac2',side:'pac',name:'Pac Jade',color:'#7de5cc'},
  pac3:{id:'pac3',side:'pac',name:'Pac Coral',color:'#ff9e87'},
  ghost:{id:'ghost',side:'ghost',name:'Ghost Legion',color:'#a48bfa'}
};
export const GHOST_BOUNTIES = {miner:50,guardian:90,engineer:65,extractor:125,hero:400};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const BODY_RADIUS=.28;
const FRIEND_SPACING=.88;
const other=side=>side==='pac'?'ghost':'pac';
function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

function createMap(kind,seed){
  const random=seeded(seed),sizes={catacombs:[11,8],ruins:[10,7],crossroads:[12,9]};
  const [cols,rows]=sizes[kind]||sizes.catacombs,step=7,width=cols*step+2,height=rows*step+2;
  const tiles=new Uint8Array(width*height),edges=new Set(),visited=new Set([0]),stack=[0];
  const edge=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
  const neighbors=id=>{const x=id%cols,y=Math.floor(id/cols),out=[];for(const [dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<cols&&ny>=0&&ny<rows)out.push(ny*cols+nx);}return out;};
  while(stack.length){const a=stack[stack.length-1],ns=neighbors(a).filter(b=>!visited.has(b));if(!ns.length){stack.pop();continue;}const b=ns[Math.floor(random()*ns.length)];edges.add(edge(a,b));visited.add(b);stack.push(b);}
  for(let a=0;a<cols*rows;a++)for(const b of neighbors(a))if(b>a&&random()<.24)edges.add(edge(a,b));
  // Every room has multiple exits. A final cluster never lives in an unalterable cul-de-sac.
  for(let a=0;a<cols*rows;a++){let count=neighbors(a).filter(b=>edges.has(edge(a,b))).length;const choices=neighbors(a).sort(()=>random()-.5);for(const b of choices){if(count>=2)break;if(!edges.has(edge(a,b))){edges.add(edge(a,b));count++;}}}
  const carve=(cx,cy,w,h=w)=>{for(let y=Math.floor(cy-h/2);y<Math.ceil(cy+h/2);y++)for(let x=Math.floor(cx-w/2);x<Math.ceil(cx+w/2);x++)if(x>0&&x<width-1&&y>0&&y<height-1)tiles[y*width+x]=1;};
  const centers=[],pockets=[];
  for(let id=0;id<cols*rows;id++){const x=4+(id%cols)*step,y=4+Math.floor(id/cols)*step;const size=id%13===7?5:kind==='ruins'?(random()<.5?5:3):(random()<.25?5:3);centers.push({x:x+.5,y:y+.5,id,roomSize:size});carve(x+.5,y+.5,size);if(id%13===7)pockets.push({x:x+.5,y:y+.5,w:5,h:5});}
  for(const e of edges){const [ai,bi]=e.split(':').map(Number),a=centers[ai],b=centers[bi];const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);if(a.y===b.y)for(let x=minX;x<=maxX;x++)carve(x,a.y,3);else for(let y=minY;y<=maxY;y++)carve(a.x,y,3);}
  if(kind==='crossroads'){const cx=centers[Math.floor(cols/2)].x,cy=centers[cols*Math.floor(rows/2)].y;for(let y=2;y<height-2;y++)carve(cx,y+.5,3);for(let x=2;x<width-2;x++)carve(x+.5,cy,3);}
  // The maze is the central objective, surrounded by a generous open hinterland
  // where Pac settlements can grow. Eight broad gates join both spaces.
  const pad=26,fullWidth=width+pad*2,fullHeight=height+pad*2,fullTiles=new Uint8Array(fullWidth*fullHeight),biome=new Uint8Array(fullWidth*fullHeight);
  const mazeBounds={x:pad,y:pad,w:width,h:height};
  for(let y=1;y<fullHeight-1;y++)for(let x=1;x<fullWidth-1;x++){
    const inside=x>=pad&&x<pad+width&&y>=pad&&y<pad+height;
    fullTiles[y*fullWidth+x]=inside?tiles[(y-pad)*width+x-pad]:1;
    biome[y*fullWidth+x]=inside?0:1;
  }
  const outerCarve=(cx,cy,w,h=w,value=1)=>{for(let y=Math.floor(cy-h/2);y<Math.ceil(cy+h/2);y++)for(let x=Math.floor(cx-w/2);x<Math.ceil(cx+w/2);x++)if(x>0&&x<fullWidth-1&&y>0&&y<fullHeight-1)fullTiles[y*fullWidth+x]=value;};
  // Small scattered ruins break sightlines without partitioning the broad belt.
  for(let y=18;y<fullHeight-15;y+=18){outerCarve(5.5,y+.5,2,3,0);outerCarve(fullWidth-6.5,y+5.5,3,2,0);}
  for(let x=20;x<fullWidth-15;x+=19){outerCarve(x+.5,5.5,3,2,0);outerCarve(x+5.5,fullHeight-6.5,2,3,0);}
  const shiftedCenters=centers.map(c=>({...c,x:c.x+pad,y:c.y+pad})),shiftedPockets=pockets.map(p=>({...p,x:p.x+pad,y:p.y+pad})),entrances=[];
  const gate=(side,col,row)=>{
    const center=shiftedCenters[row*cols+col];let x=center.x,y=center.y;
    if(side==='west'||side==='east'){
      const edge=side==='west'?pad-3:pad+width+2,end=center.x;
      for(let xx=Math.min(edge,end);xx<=Math.max(edge,end);xx++)outerCarve(xx,y,5);
      x=side==='west'?pad-2.5:pad+width+1.5;
    }else{
      const edge=side==='north'?pad-3:pad+height+2,end=center.y;
      for(let yy=Math.min(edge,end);yy<=Math.max(edge,end);yy++)outerCarve(x,yy,5);
      y=side==='north'?pad-2.5:pad+height+1.5;
    }
    entrances.push({x,y,side});
  };
  for(const row of [Math.floor(rows*.25),Math.floor(rows*.72)]){gate('west',0,row);gate('east',cols-1,row);}
  for(const col of [Math.floor(cols*.27),Math.floor(cols*.73)]){gate('north',col,0);gate('south',col,rows-1);}
  const pacStarts=[{x:13.5,y:Math.floor(fullHeight*.72)+.5},{x:pad+Math.floor(width*.68)+.5,y:13.5},{x:fullWidth-13.5,y:Math.floor(fullHeight*.64)+.5}],pacStart=pacStarts[0],ghostStart={x:pad+Math.floor(width/2)+.5,y:pad+Math.floor(height/2)+.5};
  for(const start of pacStarts)outerCarve(start.x,start.y,19);
  const citadel={x:ghostStart.x,y:ghostStart.y,w:9,h:9};outerCarve(citadel.x,citadel.y,citadel.w,citadel.h);
  for(let y=Math.floor(citadel.y-citadel.h/2);y<Math.ceil(citadel.y+citadel.h/2);y++)for(let x=Math.floor(citadel.x-citadel.w/2);x<Math.ceil(citadel.x+citadel.w/2);x++)biome[y*fullWidth+x]=2;
  // Four interior approaches connect the central citadel to the old maze graph.
  const cx=Math.round((ghostStart.x-pad-4.5)/step),cy=Math.round((ghostStart.y-pad-4.5)/step);
  for(const [dx,dy]of DIRS){const c=shiftedCenters[clamp(cy+dy,0,rows-1)*cols+clamp(cx+dx,0,cols-1)];
    const bend={x:c.x,y:ghostStart.y};for(let x=Math.min(ghostStart.x,bend.x);x<=Math.max(ghostStart.x,bend.x);x++)outerCarve(x,bend.y,3);for(let y=Math.min(bend.y,c.y);y<=Math.max(bend.y,c.y);y++)outerCarve(c.x,y,3);
  }
  const outerCenters=[];
  for(let y=13;y<fullHeight-12;y+=14){outerCenters.push({x:13.5,y:y+.5,exterior:true},{x:fullWidth-13.5,y:y+.5,exterior:true});}
  for(let x=27;x<fullWidth-26;x+=14){outerCenters.push({x:x+.5,y:13.5,exterior:true},{x:x+.5,y:fullHeight-13.5,exterior:true});}
  const allCenters=[...shiftedCenters,...entrances.map(e=>({...e,exterior:true})),...outerCenters].map((c,id)=>({...c,id}));
  const regions=[];for(let ry=0;ry<3;ry++)for(let rx=0;rx<4;rx++){const x=pad+Math.floor(rx*width/4),y=pad+Math.floor(ry*height/3),x2=pad+Math.floor((rx+1)*width/4),y2=pad+Math.floor((ry+1)*height/3);regions.push({id:ry*4+rx,x,y,w:x2-x,h:y2-y});}
  const names={catacombs:'The Hollow Archive',ruins:'Mosslight Ruins',crossroads:'The Endless Crossroads'};
  return{width:fullWidth,height:fullHeight,tiles:fullTiles,regions,centers:allCenters,pockets:shiftedPockets,pacStart,pacStarts,ghostStart,mazeBounds,citadel,entrances,biome,beltWidth:pad,name:names[kind]||names.catacombs,seed,kind};
}

export class Game {
  constructor({side='pac',teamId='pac',difficulty='normal',map='catacombs',seed=1975}={}){
    this.side=side==='ghost'?'ghost':'pac';this.difficulty=DIFFICULTIES[difficulty]?difficulty:'normal';this.seed=Number(seed)||1975;this.random=seeded(this.seed+31);
    this.playerTeam=this.side==='ghost'?'ghost':PAC_TEAMS.includes(teamId)?teamId:'pac';this.teamId=this.playerTeam;
    this.map=createMap(map,this.seed);this.time=0;this.paused=false;this.status='playing';this.winnerReason='';this.speed=1;
    this.teams=Object.fromEntries(Object.entries(TEAM_DEFS).map(([id,team])=>[id,{...team,start:id==='ghost'?this.map.ghostStart:this.map.pacStarts[PAC_TEAMS.indexOf(id)],eliminated:false}]));
    this.units=[];this.buildings=[];this.pellets=new Map();this.events=[];this.effects=[];this.alerts=[];this.kills={pac:0,ghost:0};this.stats={pelletsMined:0,structuresBuilt:0,powerUsed:0};
    this.resources={pac:240,pac2:240,pac3:240,ghost:360};this.collected=0;this.largeCollected=0;this.powerRanks=0;this.powerByTeam=Object.fromEntries(PAC_TEAMS.map(id=>[id,{charges:1,cooldown:0}]));this.watchedRegions=[];this.watchCooldown=0;
    this._id=0;this._visionTime=0;this._incomeTime=0;this._healingTime=0;this._alertCounts=new Map();this._pathCache=new Map();
    const n=this.map.width*this.map.height;this.visible={pac:new Uint8Array(n),ghost:new Uint8Array(n)};this.explored={pac:new Uint8Array(n),ghost:new Uint8Array(n)};this.knownPelletsGhost=new Uint8Array(n);this.lastSeen={pac:new Map(),ghost:new Map()};
    this._makePellets();this.totalPellets=this.pellets.size;
    const g=this.map.ghostStart;
    for(const id of PAC_TEAMS){const p=this.teams[id].start;
      this._spawnBuilding('nest',p.x,p.y,true,id);this._spawnBuilding('tower',p.x+2.5,p.y+2.5,true,id);
      this.spawnUnit('hero',p.x+1,p.y,id);this.spawnUnit('miner',p.x,p.y+2,id);this.spawnUnit('miner',p.x+2,p.y,id);this.spawnUnit('guardian',p.x+1,p.y+2,id);this.spawnUnit('engineer',p.x,p.y+1,id);
    }
    const ghostHQ=this._spawnBuilding('lair',g.x,g.y,true);ghostHQ.isHQ=true;ghostHQ.hp=ghostHQ.maxHp=20000;this.ghostHQId=ghostHQ.id;this._spawnBuilding('watch',g.x-2.5,g.y-2.5,true);
    this.spawnUnit('scout',g.x-2,g.y);this.spawnUnit('hunter',g.x,g.y-2);this.spawnUnit('hunter',g.x-1,g.y-2);this.spawnUnit('hunter',g.x-2,g.y-2);this.spawnUnit('binder',g.x,g.y-1);
    this.spawnUnit('scout',g.x+2,g.y);this.spawnUnit('hunter',g.x+2,g.y-2);this.spawnUnit('hunter',g.x+1,g.y+2);this.spawnUnit('binder',g.x+2,g.y+1);this.spawnUnit('brute',g.x-1,g.y+2);
    this._updateVision();this.log('Three Pac teams share the harvest. The Ghost Legion must catch all three commanders.','start');
  }

  _makePellets(){
    const{width,height,tiles,regions,pockets,mazeBounds:m,citadel}=this.map;
    // Every walkable spot in the central maze carries an objective, except the
    // ghost citadel and clear construction pockets. The exterior has no orbs.
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){if(!tiles[y*width+x])continue;const p={x:x+.5,y:y+.5};if(p.x<m.x||p.x>=m.x+m.w||p.y<m.y||p.y>=m.y+m.h||(Math.abs(p.x-citadel.x)<citadel.w/2&&Math.abs(p.y-citadel.y)<citadel.h/2)||pockets.some(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.y-r.y)<r.h/2))continue;const id=y*width+x;this.pellets.set(id,{id,...p,type:'small'});this.knownPelletsGhost[id]=1;}
    // One large objective per ward plus a few high-value cores in the interior.
    for(const r of regions){const cx=r.x+r.w/2,cy=r.y+r.h/2;let best=null,bd=Infinity;for(const p of this.pellets.values()){if(p.x<r.x||p.x>=r.x+r.w||p.y<r.y||p.y>=r.y+r.h)continue;const d=Math.hypot(p.x-cx,p.y-cy);if(d<bd){bd=d;best=p;}}if(best){best.type='large';this.knownPelletsGhost[best.id]=2;}}
  }

  log(text,kind='info'){this.events.push({text,time:this.time,kind});if(this.events.length>60)this.events.shift();}
  getHero(teamId=this.side==='pac'?this.playerTeam:null){return this.units.find(u=>u.type==='hero'&&u.hp>0&&(!teamId||u.teamId===teamId))||null;}
  getHeroes(){return this.units.filter(u=>u.type==='hero'&&u.hp>0);}
  getPower(teamId=this.side==='pac'?this.playerTeam:'pac'){return this.powerByTeam[teamId]||{charges:0,cooldown:0};}
  get powerCharges(){return this.getPower().charges;}
  set powerCharges(value){this.getPower().charges=value;}
  get powerCooldown(){return this.getPower().cooldown;}
  set powerCooldown(value){this.getPower().cooldown=value;}
  _teamFor(side,teamId){const id=teamId??(side===this.side?this.playerTeam:side);return this.teams[id]?.side===side?id:null;}
  getUnit(id){return this.units.find(u=>u.id===id)||null;}
  getBuilding(id){return this.buildings.find(b=>b.id===id)||null;}
  getGhostHQ(){return this.getBuilding(this.ghostHQId);}
  unitCap(teamId=this.playerTeam){return teamId==='ghost'?54:20;}
  isVisible(side,x,y){const tx=Math.floor(x),ty=Math.floor(y);return tx>=0&&ty>=0&&tx<this.map.width&&ty<this.map.height&&!!this.visible[side]?.[ty*this.map.width+tx];}
  tileAt(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<this.map.width&&y<this.map.height?this.map.tiles[y*this.map.width+x]:0;}
  regionAt(x,y){return this.map.regions.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)?.id??0;}
  nearestFloor(x,y){
    const tx=clamp(Math.floor(x),1,this.map.width-2),ty=clamp(Math.floor(y),1,this.map.height-2);if(this.tileAt(tx,ty))return{x:tx+.5,y:ty+.5};
    for(let r=1;r<Math.max(this.map.width,this.map.height);r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;const xx=tx+dx,yy=ty+dy;if(this.tileAt(xx,yy))return{x:xx+.5,y:yy+.5};}return{x:this.map.pacStart.x,y:this.map.pacStart.y};
  }

  // Movement uses real body positions. These checks keep both steering and
  // crowd separation inside the walkable corridor rather than through its walls.
  _canStand(x,y,r=BODY_RADIUS){
    if(!this.tileAt(x,y))return false;
    for(const [dx,dy]of [[r,0],[-r,0],[0,r],[0,-r],[r*.71,r*.71],[-r*.71,r*.71],[r*.71,-r*.71],[-r*.71,-r*.71]])if(!this.tileAt(x+dx,y+dy))return false;
    return true;
  }

  _displace(u,dx,dy){
    if(u.rooted>0||u.cast)return false;
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return false;
    if(this._canStand(u.x+dx,u.y+dy)){u.x+=dx;u.y+=dy;return true;}
    // Slide along a wall when only one component is obstructed.
    let moved=false;
    if(this._canStand(u.x+dx,u.y)){u.x+=dx;moved=Math.abs(dx)>.00001;}
    if(this._canStand(u.x,u.y+dy)){u.y+=dy;moved=moved||Math.abs(dy)>.00001;}
    return moved;
  }

  _canTravel(x0,y0,x1,y1){
    const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/.18));
    for(let i=1;i<=n;i++)if(!this._canStand(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))return false;
    return true;
  }

  _localCells(x,y,count=1){
    const center=this.nearestFloor(x,y),w=this.map.width,start=Math.floor(center.y)*w+Math.floor(center.x),seen=new Set([start]),queue=[start],out=[];
    // Walking the connected floor graph avoids choosing a visually close slot
    // behind a wall when there is suitable room on this side of the junction.
    for(let head=0;head<queue.length&&out.length<count;head++){
      const k=queue[head],tx=k%w,ty=Math.floor(k/w),p={x:tx+.5,y:ty+.5};
      if(this._canStand(p.x,p.y))out.push(p);
      for(const [dx,dy]of DIRS){const nx=tx+dx,ny=ty+dy,id=ny*w+nx;if(nx<1||ny<1||nx>=w-1||ny>=this.map.height-1||!this.map.tiles[id]||seen.has(id))continue;seen.add(id);queue.push(id);}
    }
    return out;
  }

  _formationSlots(units,x,y){
    const members=new Set(units.map(u=>u.id)),candidates=this._localCells(x,y,Math.max(12,units.length*4));
    const free=candidates.filter(p=>!this.units.some(u=>!members.has(u.id)&&u.hp>0&&u.side===units[0].side&&dist(u,p)<FRIEND_SPACING));
    const slots=(free.length>=units.length?free:candidates).slice(0,units.length),available=new Set(units),assigned=new Map();
    // Greedy nearest pairing prevents the left and right wings crossing each
    // other merely to occupy interchangeable formation cells.
    while(available.size&&slots.length){let bestUnit=null,bestSlot=0,bestScore=Infinity;
      for(const unit of available)for(let i=0;i<slots.length;i++){const score=dist(unit,slots[i]);if(score<bestScore){bestScore=score;bestUnit=unit;bestSlot=i;}}
      assigned.set(bestUnit.id,slots.splice(bestSlot,1)[0]);available.delete(bestUnit);
    }
    return assigned;
  }

  _pathToPoint(u,x,y){
    const path=this.findPath(u.x,u.y,x,y),last=path.at(-1)||u;
    if(path.length&&!this._canTravel(u.x,u.y,path[0].x,path[0].y)){const start=this.nearestFloor(u.x,u.y);if(Math.hypot(start.x-u.x,start.y-u.y)>.05)path.unshift(start);}
    if(this._canStand(x,y)&&Math.hypot(last.x-x,last.y-y)>.03)path.push({x,y});
    return path;
  }

  _attackPosition(u,target,reach){
    const others=this.units.filter(v=>v!==u&&v.side===u.side&&v.hp>0),reserved=others.filter(v=>v.order?.type==='attack'&&v.order.targetId===target.id).map(v=>({x:v.order.approachX??v.x,y:v.order.approachY??v.y}));
    const radius=Math.max(.8,reach-.12),candidates=[];
    // Inner attack slots, then staging rings. Excess attackers queue outside
    // melee range instead of all walking into the target's center.
    for(let ring=0;ring<3;ring++){
      const r=radius+ring*.92,steps=Math.max(6,Math.ceil(Math.PI*2*r/FRIEND_SPACING));
      for(let i=0;i<steps;i++){const angle=i*Math.PI*2/steps,p={x:target.x+Math.cos(angle)*r,y:target.y+Math.sin(angle)*r};
        if(!this._canStand(p.x,p.y)||!this.hasLineOfSight(p.x,p.y,target.x,target.y))continue;
        const crowded=reserved.some(v=>dist(v,p)<FRIEND_SPACING*.92)||others.some(v=>dist(v,p)<FRIEND_SPACING*.82);
        if(!crowded)candidates.push({...p,ring});
      }
      if(candidates.length)break;
    }
    if(!candidates.length){const fallback=this._localCells(target.x,target.y,24).filter(p=>others.every(v=>dist(v,p)>=FRIEND_SPACING*.8));if(fallback.length)return fallback.sort((a,b)=>dist(u,a)+dist(a,target)*.5-dist(u,b)-dist(b,target)*.5)[0];return{x:u.x,y:u.y};}
    candidates.sort((a,b)=>dist(u,a)-dist(u,b));return candidates[0];
  }

  hasLineOfSight(x0,y0,x1,y1){
    let x=Math.floor(x0),y=Math.floor(y0),tx=Math.floor(x1),ty=Math.floor(y1);const dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;let err=dx-dy;
    for(let i=0;i<300;i++){if(!this.tileAt(x,y))return false;if(x===tx&&y===ty)return true;const e=err*2;if(e>-dy){err-=dy;x+=sx;}if(e<dx){err+=dx;y+=sy;}}return false;
  }

  findPath(startX,startY,endX,endY){
    const a=this.nearestFloor(startX,startY),b=this.nearestFloor(endX,endY),w=this.map.width,n=w*this.map.height,start=Math.floor(a.y)*w+Math.floor(a.x),goal=Math.floor(b.y)*w+Math.floor(b.x);
    if(start===goal)return[];const cacheKey=start+'>'+goal,old=this._pathCache.get(cacheKey);if(old)return old.map(p=>({...p}));
    const previous=new Int32Array(n).fill(-1),open=new Int32Array(n);let head=0,tail=1;open[0]=start;previous[start]=start;
    while(head<tail&&previous[goal]===-1){const k=open[head++],x=k%w,y=Math.floor(k/w);for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy,id=ny*w+nx;if(nx<=0||ny<=0||nx>=w-1||ny>=this.map.height-1||!this.map.tiles[id]||previous[id]!==-1)continue;previous[id]=k;open[tail++]=id;}}
    if(previous[goal]===-1)return[];const result=[];let k=goal;while(k!==start){result.push({x:k%w+.5,y:Math.floor(k/w)+.5});k=previous[k];}result.reverse();
    if(this._pathCache.size>300)this._pathCache.clear();this._pathCache.set(cacheKey,result);return result.map(p=>({...p}));
  }

  spawnUnit(type,x,y,teamId){const d=UNIT_DEFS[type];if(!d)return null;teamId=this._teamFor(d.side,teamId);if(!teamId||this.teams[teamId].eliminated)return null;const requested=this.nearestFloor(x,y),p=this._localCells(requested.x,requested.y,20).find(p=>this.units.every(v=>v.side!==d.side||v.hp<=0||dist(v,p)>=FRIEND_SPACING))||requested,bonus=d.side==='pac'?1+this.powerRanks*.08:1;const u={id:'u'+(++this._id),type,side:d.side,teamId,x:p.x,y:p.y,hp:Math.round(d.hp*bonus),maxHp:Math.round(d.hp*bonus),speed:d.speed,damage:d.damage,range:d.range,order:null,path:[],facing:0,cooldown:this.random()*.4,powered:0,slow:0,rooted:0,snareImmunity:0,snareCooldown:0,cast:null,carrying:0,animation:this.random()*8,_retarget:0,_attacker:null,_lastHit:-100};this.units.push(u);return u;}
  _spawnBuilding(type,x,y,complete=false,teamId){const d=BUILDING_DEFS[type];if(!d)return null;teamId=this._teamFor(d.side,teamId);if(!teamId||this.teams[teamId].eliminated)return null;const p=this._snapBuilding(d,x,y);const b={id:'b'+(++this._id),type,side:d.side,teamId,x:p.x,y:p.y,w:d.w,h:d.h,hp:d.hp,maxHp:d.hp,progress:complete?1:0,queue:[],forge:0,cooldown:0,buildTime:d.buildTime};this.buildings.push(b);return b;}
  _snapBuilding(d,x,y){return{x:Math.floor(x-d.w/2)+d.w/2,y:Math.floor(y-d.h/2)+d.h/2};}

  canBuild(type,x,y,teamId=this.playerTeam){
    const d=BUILDING_DEFS[type];if(!d)return{ok:false,reason:'Unknown structure.'};if(this.status!=='playing')return{ok:false,reason:'The match has ended.'};
    if(this.teams[teamId]?.side!==d.side||this.teams[teamId].eliminated)return{ok:false,reason:'This team cannot construct that building.'};
    if(this.resources[teamId]<d.cost)return{ok:false,reason:'Not enough '+(d.side==='pac'?'Spark.':'Dread.')};
    const p=this._snapBuilding(d,x,y),left=Math.round(p.x-d.w/2),top=Math.round(p.y-d.h/2);
    for(let yy=top;yy<top+d.h;yy++)for(let xx=left;xx<left+d.w;xx++){const k=yy*this.map.width+xx;if(!this.tileAt(xx,yy))return{ok:false,reason:'The full footprint must fit on open ground.'};if(this.pellets.has(k))return{ok:false,reason:'Clear the pellets under the building first.'};if(!this.explored[d.side][k])return{ok:false,reason:'Scout this ground before building.'};}
    for(const b of this.buildings)if(Math.abs(b.x-p.x)<(b.w+d.w)/2+.15&&Math.abs(b.y-p.y)<(b.h+d.h)/2+.15)return{ok:false,reason:'Another structure occupies this space.'};
    return{ok:true,reason:'Build '+d.name,x:p.x,y:p.y};
  }
  build(type,x,y,teamId=this.playerTeam){const result=this.canBuild(type,x,y,teamId);if(!result.ok)return false;const d=BUILDING_DEFS[type];this.resources[teamId]-=d.cost;this._spawnBuilding(type,x,y,false,teamId);this.stats.structuresBuilt++;this.log(this.teams[teamId].name+': '+d.name+' construction started.',d.side);return true;}

  train(type,buildingId=null,teamId=this.playerTeam){
    const d=UNIT_DEFS[type];if(!d||type==='hero'||this.status!=='playing'||this.teams[teamId]?.side!==d.side||this.teams[teamId].eliminated||this.resources[teamId]<d.cost)return false;
    const producers=b=>b.hp>0&&b.teamId===teamId&&b.progress>=1&&(d.side==='pac'?['nest','refuge'].includes(b.type):b.type==='lair');
    let b=buildingId?this.getBuilding(buildingId):null;if(buildingId&&!producers(b||{}))return false;if(!b)b=this.buildings.filter(producers).sort((a,b)=>a.queue.length-b.queue.length)[0];
    const queued=this.buildings.filter(b=>b.hp>0&&b.teamId===teamId).reduce((s,b)=>s+b.queue.length,0),count=this.units.filter(u=>u.hp>0&&u.teamId===teamId).length;
    if(!b||b.queue.length>=5||count+queued>=this.unitCap(teamId))return false;this.resources[teamId]-=d.cost;b.queue.push({id:'q'+(++this._id),type,remaining:d.trainTime,total:d.trainTime,paidCost:d.cost});return true;
  }

  cancelTraining(buildingId,queueId,teamId=this.playerTeam){
    if(this.status!=='playing'||typeof queueId!=='string')return false;
    const building=this.getBuilding(buildingId);
    if(!building||building.hp<=0||building.teamId!==teamId||this.teams[teamId]?.eliminated)return false;
    const index=building.queue.findIndex(entry=>entry.id===queueId);
    if(index<0)return false;
    const [entry]=building.queue.splice(index,1),refund=Math.max(0,Number(entry.paidCost)||0);
    this.resources[teamId]+=refund;
    this.log(UNIT_DEFS[entry.type].name+' training cancelled. +'+refund+' '+(building.side==='pac'?'Spark.':'Dread.'),building.side);
    return true;
  }

  command(ids,action,x,y,targetId,teamId=this.playerTeam){
    if(this.status!=='playing'||!this.teams[teamId]||this.teams[teamId].eliminated)return false;if(!Array.isArray(ids))ids=[ids];let changed=false;
    const commanded=[...new Set(ids)].map(id=>this.getUnit(id)).filter(u=>u&&u.hp>0&&u.teamId===teamId);
    const formation=new Map();
    if(['move','patrol','attack'].includes(action)&&!targetId&&Number.isFinite(x)&&Number.isFinite(y)){
      for(const side of ['pac','ghost']){const group=commanded.filter(u=>u.side===side);if(group.length>1)for(const [id,p]of this._formationSlots(group,x,y))formation.set(id,p);}
    }
    for(const id of ids){const u=this.getUnit(id);if(!u||u.hp<=0||u.teamId!==teamId)continue;
      if(u.cast&&['move','stop','patrol'].includes(action))this._cancelSnare(u);
      if(action==='stop'){u.order=null;u.path=[];u._holdSlot=null;changed=true;continue;}
      if(action==='harvest'&&u.side!=='pac')continue;
      const anchor=Number.isFinite(x)&&Number.isFinite(y)?this.nearestFloor(x,y):{x:u.x,y:u.y};let p=formation.get(id)||anchor;
      const target=this.getUnit(targetId)||this.getBuilding(targetId);if(action==='attack'&&target?.side===u.side)continue;if(action==='attack'&&target&&this.isVisible(u.side,target.x,target.y))p={x:target.x,y:target.y};
      const same=u.order&&u.order.type===action&&u.order.targetId===(targetId||null)&&Math.hypot((u.order.commandX??u.order.x)-anchor.x,(u.order.commandY??u.order.y)-anchor.y)<.35;
      if(same){changed=true;continue;}
      u.order={type:action,x:p.x,y:p.y,commandX:anchor.x,commandY:anchor.y,targetId:targetId||null,progress:0,originX:u.x,originY:u.y};u.path=[];u._retarget=0;u._holdSlot=null;
      if(action==='harvest'){
        u.order.anchorX=anchor.x;u.order.anchorY=anchor.y;
        const pellet=this.pellets.get(Math.floor(anchor.y)*this.map.width+Math.floor(anchor.x));
        const reserved=pellet&&this.units.some(v=>v!==u&&v.hp>0&&v.order?.type==='harvest'&&v.order.pelletId===pellet.id);
        if(pellet&&!reserved){u.order.pelletId=pellet.id;u.path=this._pathToPoint(u,pellet.x,pellet.y);}
        else this._assignPellet(u);
      }else if(action==='attack'&&target&&this.isVisible(u.side,target.x,target.y)){
        const reach=u.range+(target.w?Math.min(target.w,target.h)*.4:0),slot=this._attackPosition(u,target,reach);u.order.approachX=slot.x;u.order.approachY=slot.y;u.path=this._pathToPoint(u,slot.x,slot.y);
      }else u.path=this._pathToPoint(u,p.x,p.y);changed=true;
    }return changed;
  }

  activatePower(unitId,teamId=this.playerTeam){
    const power=this.getPower(teamId);if(this.status!=='playing'||this.teams[teamId]?.side!=='pac'||this.teams[teamId].eliminated||power.charges<=0||power.cooldown>0)return false;let carrier=this.getUnit(unitId)||this.getHero(teamId);if(!carrier||carrier.teamId!==teamId)return false;
    power.charges--;power.cooldown=40;this.stats.powerUsed++;
    for(const u of this.units)if(u.side==='pac'&&dist(u,carrier)<=8&&this.hasLineOfSight(u.x,u.y,carrier.x,carrier.y))u.powered=9;
    this.effects.push({x:carrier.x,y:carrier.y,type:'power',life:1.5,maxLife:1.5,side:'pac'});this.log('POWER SURGE — nearby Pac forces empowered for 9 seconds!','power');return true;
  }

  castBinder(unitId,x,y,teamId=this.playerTeam){
    const u=this.getUnit(unitId);
    if(this.status!=='playing'||!u||u.teamId!==teamId||u.type!=='binder'||u.hp<=0||u.cast||u.snareCooldown>0||u.rooted>0)return false;
    const automatic=!Number.isFinite(x)||!Number.isFinite(y);
    if(automatic){
      const candidates=this.units.filter(v=>v.side==='pac'&&v.hp>0&&v.snareImmunity<=0&&dist(u,v)<=5&&this.isVisible('ghost',v.x,v.y)&&this.hasLineOfSight(u.x,u.y,v.x,v.y));
      candidates.sort((a,b)=>(a.type==='hero'?-8:0)-(b.type==='hero'?-8:0)||dist(u,a)-dist(u,b));
      if(!candidates.length)return false;
      const target=candidates[0],motion=Math.hypot(target._motionX||0,target._motionY||0),limit=target.speed*1.15,scale=motion>limit?limit/motion:1;
      x=target.x;y=target.y;
      // Lead observable current motion, not the victim's hidden route or next
      // order. Once started the marked ground never follows its target.
      if(motion>.25)for(let lead=.7;lead>.05;lead-=.1){const px=target.x+(target._motionX||0)*scale*lead,py=target.y+(target._motionY||0)*scale*lead;if(this.tileAt(px,py)&&Math.hypot(px-u.x,py-u.y)<=5.5&&this.isVisible('ghost',px,py)&&this.hasLineOfSight(u.x,u.y,px,py)){x=px;y=py;break;}}
      if(this.units.some(v=>v!==u&&v.side==='ghost'&&v.cast&&Math.hypot(v.cast.x-x,v.cast.y-y)<v.cast.radius+2.1))return false;
    }
    if(Math.hypot(x-u.x,y-u.y)>5.5||!this.tileAt(x,y)||!this.isVisible('ghost',x,y)||!this.hasLineOfSight(u.x,u.y,x,y))return false;
    const id='snare'+(++this._id);
    u.cast={id,x,y,remaining:1.25,total:1.25,radius:2.1};u.snareCooldown=10;u._castResumePath=u.path;u.path=[];u.facing=Math.atan2(y-u.y,x-u.x);
    this.effects.push({type:'binder-windup',id,castId:id,unitId:u.id,x,y,radius:2.1,life:1.25,maxLife:1.25,side:'ghost'});
    return true;
  }

  castSnare(unitIds,x,y,teamId=this.playerTeam){
    const ids=Array.isArray(unitIds)?unitIds:[unitIds];let started=0;
    for(const id of new Set(ids))if(this.castBinder(id,x,y,teamId))started++;
    return started;
  }

  _cancelSnare(u){
    if(!u.cast)return;
    const id=u.cast.id;u.cast=null;u._castResumePath=null;
    this.effects=this.effects.filter(e=>e.castId!==id);u._retarget=0;
  }

  _resolveSnare(u){
    const cast=u.cast;if(!cast)return;
    const point={x:cast.x,y:cast.y};
    for(const victim of this.units){
      if(victim.side!=='pac'||victim.hp<=0||dist(victim,point)>cast.radius||!this.hasLineOfSight(cast.x,cast.y,victim.x,victim.y))continue;
      this._damage(victim,12,u);
      if(victim.hp>0&&victim.snareImmunity<=0){victim.rooted=1.5;victim._snareSlowAfter=2;victim.snareImmunity=5;}
      if(this.status!=='playing')break;
    }
    const resume=u._castResumePath||[];this._cancelSnare(u);u.path=resume;
    this.effects.push({type:'snare',x:cast.x,y:cast.y,radius:cast.radius,life:.65,maxLife:.65,side:'ghost'});
  }

  // Retained for old callers. Pellets now provide automatic, local ghost sight.
  tuneRegion(){return false;}

  _assignPellet(u){
    const order=u.order;if(!order||order.type!=='harvest')return;
    let best=null,score=Infinity;
    // A target reservation is exclusive, including an explicit group harvest.
    // Additional workers take adjacent pellets instead of wasting the channel
    // on one ordinary dot. Finished or dead workers release reservations.
    const reserved=new Set(this.units.filter(v=>v.id!==u.id&&v.hp>0&&v.order?.type==='harvest').map(v=>v.order.pelletId));
    for(const p of this.pellets.values()){
      if(reserved.has(p.id))continue;
      const d=Math.hypot(u.x-p.x,u.y-p.y),anchor=Math.hypot((order.anchorX??u.x)-p.x,(order.anchorY??u.y)-p.y);
      const s=d+anchor*.12+(p.type==='large'&&u.type!=='hero'?2:0);
      if(s<score){best=p;score=s;}
    }
    if(!best){u.order=null;u.path=[];return;}
    order.pelletId=best.id;order.x=best.x;order.y=best.y;order.progress=0;
    const range=u.type==='extractor'?UNIT_DEFS.extractor.mineRange:.68;
    if(dist(u,best)<=range&&this.hasLineOfSight(u.x,u.y,best.x,best.y))u.path=[];
    else u.path=this._pathToPoint(u,best.x,best.y);
  }

  _consume(p,u){
    if(!this.pellets.has(p.id))return;this.pellets.delete(p.id);this.collected++;this.stats.pelletsMined++;
    const owner=this.teams[u.teamId]?.side==='pac'?u.teamId:'pac';this.resources[owner]+=p.type==='large'?24:1;this.effects.push({x:p.x,y:p.y,type:p.type==='large'?'core':'eat',life:p.type==='large'?1.1:.28,maxLife:p.type==='large'?1.1:.28,side:'pac'});
    if(p.type==='large'){
      this.largeCollected++;const power=this.getPower(owner);power.charges=Math.min(2,power.charges+1);const rank=Math.min(3,Math.floor(this.largeCollected/3));
      if(rank>this.powerRanks){this.powerRanks=rank;for(const v of this.units)if(v.side==='pac'){const old=v.maxHp;v.maxHp=Math.round(UNIT_DEFS[v.type].hp*(1+rank*.08));v.hp=Math.min(v.maxHp,v.hp+(v.maxHp-old));}this.log('Power rank '+rank+' — all Pac troops strengthened.','power');}
      this.log('Large pellet consumed. +24 Spark and a Power charge.','pac');
    }
    const regionId=this.regionAt(p.x,p.y),count=this._alertCounts.get(regionId)||{count:0,start:this.time,last:-100};if(this.time-count.start>8){count.count=0;count.start=this.time;}count.count++;
    if((count.count>=10||p.type==='large')&&this.time-count.last>9){const r=this.map.regions[regionId];this.alerts.push({regionId,x:r.x+r.w/2,y:r.y+r.h/2,time:this.time+2,expires:this.time+14,side:'pac'});count.last=this.time;count.count=0;}this._alertCounts.set(regionId,count);
    if(this.collected>=this.totalPellets){this.status='pac-won';this.winnerReason='Every yellow pellet has been consumed.';this.log('BLACKOUT COMPLETE — Pac-Man wins!','victory');}
  }

  _move(u,dt){
    let distance=u.rooted>0?0:(u.speed*(u.powered>0?1.12:1)*(u.slow>0?.55:1))*dt;
    let guard=0;
    while(distance>0&&u.path.length&&guard++<10){
      if(!this._canTravel(u.x,u.y,u.path[0].x,u.path[0].y)){const end=u.path.at(-1);u.path=this._pathToPoint(u,end.x,end.y);if(!u.path.length)break;}
      // Separation can move a body slightly beyond its current waypoint. Look
      // ahead along a clear corridor instead of forcing an unnecessary U-turn
      // back into the unit that just yielded space.
      for(let ahead=Math.min(3,u.path.length-1);ahead>0;ahead--){const q=u.path[ahead];if(Math.hypot(q.x-u.x,q.y-u.y)<4&&this._canTravel(u.x,u.y,q.x,q.y)){u.path.splice(0,ahead);break;}}
      const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);
      if(d<.10){if(this._canStand(p.x,p.y)){u.x=p.x;u.y=p.y;}u.path.shift();continue;}
      const step=Math.min(distance,d,.16),vx=dx/d,vy=dy/d;let steerX=0,steerY=0;
      for(const v of this.units){
        if(v===u||v.side!==u.side||v.hp<=0)continue;
        let ax=u.x-v.x,ay=u.y-v.y,gap=Math.hypot(ax,ay);
        if(gap>1.25)continue;
        if(gap<.001){const angle=(Number(u.id.slice(1))*2.399963+Number(v.id.slice(1)))%6.283;ax=Math.cos(angle);ay=Math.sin(angle);gap=.001;}
        const strength=Math.max(0,1.15-gap)/1.15;
        steerX+=ax/Math.max(gap,.001)*strength*.58;steerY+=ay/Math.max(gap,.001)*strength*.58;
        // A unit directly ahead makes the follower pick a passing lane. Both
        // directions are checked against walls; a narrow lane naturally queues.
        const ahead=(-ax*vx-ay*vy)/Math.max(gap,.001);
        if(ahead>.55&&gap<1.08){
          const left={x:-vy,y:vx},right={x:vy,y:-vx};
          const laneScore=lane=>{const px=u.x+lane.x*.42+vx*.16,py=u.y+lane.y*.42+vy*.16;if(!this._canStand(px,py))return-Infinity;let free=0;for(const t of this.units)if(t!==u&&t.side===u.side&&t.hp>0)free+=Math.min(1.3,Math.hypot(px-t.x,py-t.y));return free;};
          const ls=laneScore(left),rs=laneScore(right),lane=ls>rs?left:right;
          if(Math.max(ls,rs)>-Infinity){steerX+=lane.x*strength*.62;steerY+=lane.y*strength*.62;}
        }
      }
      const steerLength=Math.hypot(steerX,steerY);if(steerLength>.8){steerX*=.8/steerLength;steerY*=.8/steerLength;}
      let mx=vx+steerX,my=vy+steerY,length=Math.hypot(mx,my);mx=mx/Math.max(.001,length)*step;my=my/Math.max(.001,length)*step;
      const moved=this._displace(u,mx,my)||this._displace(u,vx*step,vy*step);
      u.facing=Math.atan2(dy,dx);distance-=step;
      if(!moved)break;
      if(Math.hypot(u.x-p.x,u.y-p.y)<.10){u.x=p.x;u.y=p.y;u.path.shift();}
    }
    if(u.type==='hero'){
      // A small eating radius covers adjacent rows in a wide corridor while preserving movement decisions.
      const tx=Math.floor(u.x),ty=Math.floor(u.y);for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++){const p=this.pellets.get(y*this.map.width+x);if(p&&dist(u,p)<.82)this._consume(p,u);}
    }
  }

  _separateUnits(dt){
    // A soft positional solve handles standing formations, training exits and
    // combat crowds as well as moving units. It never treats a friendly body as
    // an impassable wall, so three-wide corridors remain navigable.
    const active=this.units.filter(u=>u.hp>0),maxPush=Math.min(.16,dt*1.8);
    for(let pass=0;pass<3;pass++){
      const pushes=new Map();
      for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i],b=active[j];if(a.side!==b.side)continue;
        let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
        if(d>=FRIEND_SPACING)continue;
        if(d<.0001){const angle=(i*1.618+j*2.399963)%6.283;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
        const actual=Math.hypot(a.x-b.x,a.y-b.y),amount=Math.min(maxPush,(FRIEND_SPACING-actual)*.55),nx=dx/d,ny=dy/d;
        // Pac-Man keeps immediate movement control; escorts do the yielding.
        const amoving=a.path.length>0,bmoving=b.path.length>0;
        const afixed=a.rooted>0||!!a.cast,bfixed=b.rooted>0||!!b.cast;
        if(afixed&&bfixed)continue;
        let aw=afixed?0:bfixed?1:a.type==='hero'?.12:b.type==='hero'?.88:amoving&&!bmoving?.12:bmoving&&!amoving?.88:.5,bw=1-aw;
        const add=(u,x,y)=>{const p=pushes.get(u.id)||{x:0,y:0};p.x+=x;p.y+=y;pushes.set(u.id,p);};
        add(a,nx*amount*aw,ny*amount*aw);add(b,-nx*amount*bw,-ny*amount*bw);
      }
      for(const u of active){const p=pushes.get(u.id);if(!p)continue;const n=Math.hypot(p.x,p.y),scale=n>maxPush?maxPush/n:1;this._displace(u,p.x*scale,p.y*scale);}
    }
  }

  _damage(target,amount,attacker){
    if(this.status!=='playing'||target.hp<=0)return;target.hp-=amount;target._lastHit=this.time;target._attacker=attacker?.id;
    if(target.order?.type==='harvest'&&target.type!=='hero')target.order.progress=Math.max(0,(target.order.progress||0)-.22);
    if(target.hp<=0){target.hp=0;if(target.cast)this._cancelSnare(target);this.effects.push({x:target.x,y:target.y,type:'death',life:.65,maxLife:.65,side:target.side});if(attacker)this.kills[attacker.side]++;
      if(target.side==='pac'&&attacker?.side==='ghost'&&!target._bountyPaid){const reward=target.w?({nest:200,refuge:140,tower:110,well:160}[target.type]||100):(GHOST_BOUNTIES[target.type]||0);if(reward){target._bountyPaid=true;this.resources.ghost+=reward;this.log('+'+reward+' Dread — '+(target.w?BUILDING_DEFS[target.type].name:UNIT_DEFS[target.type].name)+' eliminated.','ghost');this.effects.push({x:target.x,y:target.y,type:'bounty',text:'+'+reward+' Dread',amount:reward,side:'ghost',life:1.2,maxLife:1.2});}}
      if(target.type==='hero')this._eliminateTeam(target.teamId);
      else if(target.isHQ){this.status='pac-won';this.winnerReason='The Ghost Citadel has been destroyed.';this.log('GHOST CITADEL FALLEN — Pac-Man wins!','victory');}
      else if(target.w)this.log(BUILDING_DEFS[target.type].name+' destroyed.',other(target.side));
    }
  }

  _eliminateTeam(teamId){
    const team=this.teams[teamId];if(!team||team.eliminated)return;
    team.eliminated=true;
    for(const unit of this.units)if(unit.teamId===teamId){if(unit.cast)this._cancelSnare(unit);unit.hp=0;unit.order=null;unit.path=[];}
    for(const building of this.buildings)if(building.teamId===teamId){building.hp=0;building.queue=[];}
    this.log(team.name+' eliminated. Allied teams continue the harvest.','ghost');
    if(PAC_TEAMS.every(id=>this.teams[id].eliminated)){
      this.status='ghost-won';this.winnerReason='All three Pac-Man commanders were caught by the ghost hunters.';this.log('ALL PAC TEAMS CAUGHT — the ghosts win!','victory');
    }
  }

  _attack(u,target){
    if(u.cooldown>0||!target||target.hp<=0)return;const empowered=u.side==='pac'&&u.powered>0;
    let amount=u.damage*(u.side==='pac'?1+this.powerRanks*.06:1);if(empowered)amount*=u.type==='hero'?4:2.25;if(target.w&&u.type==='brute')amount*=2;
    this._damage(target,amount,u);u.cooldown=u.type==='binder'?1.25:u.type==='hero'&&empowered?.32:.85;
    this.effects.push({x:u.x,y:u.y,targetX:target.x,targetY:target.y,type:u.type==='binder'?'bolt':'attack',life:.16,maxLife:.16,side:u.side});
  }

  _updateUnit(u,dt){
    if(u.hp<=0)return;u.cooldown=Math.max(0,u.cooldown-dt);u.powered=Math.max(0,u.powered-dt);u.slow=Math.max(0,u.slow-dt);u.snareCooldown=Math.max(0,(u.snareCooldown||0)-dt);u.snareImmunity=Math.max(0,(u.snareImmunity||0)-dt);
    const wasRooted=u.rooted||0;u.rooted=Math.max(0,wasRooted-dt);if(wasRooted>0&&u.rooted===0&&u._snareSlowAfter){u.slow=Math.max(u.slow,u._snareSlowAfter);u._snareSlowAfter=0;}
    u.animation+=dt*(u.path.length?10:3);u._retarget=Math.max(0,u._retarget-dt);
    if(u.cast){u.cast.remaining-=dt;if(u.cast.remaining<=0)this._resolveSnare(u);return;}
    if(u.type==='binder'&&this.castBinder(u.id,undefined,undefined,u.teamId))return;
    let order=u.order;
    if(!order&&!u.path.length&&u._holdSlot&&u._holdSlot.until>this.time&&Math.hypot(u.x-u._holdSlot.x,u.y-u._holdSlot.y)>.16)u.path=this._pathToPoint(u,u._holdSlot.x,u._holdSlot.y);
    if(order?.type==='attack'&&order.targetId){const target=this.getUnit(order.targetId)||this.getBuilding(order.targetId);
      if(!target||target.hp<=0){if(!u.path.length){u.order=null;order=null;}else{u.order.targetId=null;order=u.order;}}
      else if(this.isVisible(u.side,target.x,target.y)){
        const reach=u.range+(target.w?Math.min(target.w,target.h)*.4:0);
        if(dist(u,target)<=reach&&this.hasLineOfSight(u.x,u.y,target.x,target.y)){u.path=[];this._attack(u,target);return;}
        if(u._retarget<=0){const slot=this._attackPosition(u,target,reach);order.approachX=slot.x;order.approachY=slot.y;u.path=this._pathToPoint(u,slot.x,slot.y);order.x=target.x;order.y=target.y;u._retarget=.7;}
      }else if(!u.path.length){u.order=null;order=null;}
    }
    // All units defend themselves in reach. Move and harvest never acquire distant enemies automatically.
    const enemies=this.units.filter(v=>v.side!==u.side&&v.hp>0&&dist(u,v)<=u.range&&this.isVisible(u.side,v.x,v.y)&&this.hasLineOfSight(u.x,u.y,v.x,v.y));
    if(enemies.length){enemies.sort((a,b)=>(a.type==='hero'?-2:0)-(b.type==='hero'?-2:0)||dist(u,a)-dist(u,b));this._attack(u,enemies[0]);if(!order||order.type==='attack')return;}
    if(order?.type==='harvest'){
      let p=this.pellets.get(order.pelletId);if(!p){this._assignPellet(u);p=this.pellets.get(u.order?.pelletId);order=u.order;if(!p)return;}
      const range=u.type==='extractor'?4.5:.68;
      if(dist(u,p)<=range&&this.hasLineOfSight(u.x,u.y,p.x,p.y)){
        u.path=[];u.facing=Math.atan2(p.y-u.y,p.x-u.x);
        if(u.type==='hero'){this._consume(p,u);this._assignPellet(u);return;}
        const duration=u.type==='extractor'?(p.type==='large'?12:3):(u.type==='miner'?(p.type==='large'?7:1.2):(p.type==='large'?12:2.5));
        order.duration=duration;order.progress=(order.progress||0)+dt;
        if(u._mineFx==null||u._mineFx<=this.time){this.effects.push({x:u.x,y:u.y,targetX:p.x,targetY:p.y,type:'mine',life:.2,maxLife:.2,side:'pac'});u._mineFx=this.time+.18;}
        if(order.progress>=duration){this._consume(p,u);this._assignPellet(u);}return;
      }
      if(!u.path.length&&u._retarget<=0){u.path=this._pathToPoint(u,p.x,p.y);u._retarget=1;}
    }
    this._move(u,dt);
    if(u.order?.type==='move'&&!u.path.length){u._holdSlot={x:u.order.x,y:u.order.y,until:this.time+6};u.order=null;}
    if(u.order?.type==='patrol'&&!u.path.length){const o=u.order,tx=o.x,ty=o.y;o.x=o.originX;o.y=o.originY;o.originX=tx;o.originY=ty;u.path=this._pathToPoint(u,o.x,o.y);}
    if(u.type==='engineer'&&!u.path.length){const b=this.buildings.find(b=>b.hp>0&&b.side==='pac'&&b.hp<b.maxHp&&dist(u,b)<3.5&&this.time-(b._lastHit??-100)>3);if(b&&this.resources[u.teamId]>.2){const repair=Math.min(dt*7,b.maxHp-b.hp,this.resources[u.teamId]/.06);b.hp+=repair;this.resources[u.teamId]-=repair*.06;}}
  }

  _updateBuildings(dt){
    for(const b of this.buildings){if(b.hp<=0)continue;const d=BUILDING_DEFS[b.type];if(b.progress<1){b.progress=Math.min(1,b.progress+dt/d.buildTime);if(b.progress===1)this.log(d.name+' ready.',b.side);continue;}
      b.cooldown=Math.max(0,b.cooldown-dt);
      if(b.isHQ&&this.time-(b._lastHit??-100)>=8)b.hp=Math.min(b.maxHp,b.hp+30*dt);
      if(b.queue.length){const q=b.queue[0];q.remaining-=dt;if(q.remaining<=0){const angle=this.random()*Math.PI*2,p=this.nearestFloor(b.x+Math.cos(angle)*2.4,b.y+Math.sin(angle)*2.4),u=this.spawnUnit(q.type,p.x,p.y,b.teamId);b.queue.shift();if(u)this.log(this.teams[b.teamId].name+': '+UNIT_DEFS[u.type].name+' ready.',b.side);}}
      if(b.type==='well'){this.resources[b.teamId]+=dt*.6;b.forge+=dt;if(b.forge>=50){const power=this.getPower(b.teamId);if(power.charges<2&&this.resources[b.teamId]>=40){this.resources[b.teamId]-=40;power.charges++;this.log(this.teams[b.teamId].name+': Digestor forged a new Power charge.','power');}b.forge=0;}}
      if(d.damage&&b.cooldown<=0){const target=this.units.filter(u=>u.side!==b.side&&u.hp>0&&dist(b,u)<d.range&&this.isVisible(b.side,u.x,u.y)&&this.hasLineOfSight(b.x,b.y,u.x,u.y)).sort((a,c)=>dist(b,a)-dist(b,c))[0];if(target){this._damage(target,d.damage,b);b.cooldown=1.1;this.effects.push({x:b.x,y:b.y,targetX:target.x,targetY:target.y,type:'bolt',life:.25,maxLife:.25,side:b.side});}}
    }
  }

  _reveal(side,cx,cy,r){const {width:w,height:h}=this.map,v=this.visible[side];for(let y=Math.max(0,Math.floor(cy-r));y<Math.min(h,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<Math.min(w,Math.ceil(cx+r));x++){if(Math.hypot(x+.5-cx,y+.5-cy)>r)continue;if(this.hasLineOfSight(cx,cy,x+.5,y+.5))v[y*w+x]=1;else if(!this.tileAt(x,y)){// Show the first wall encountered rather than an outline of unseen rooms.
      const dx=x+.5-cx,dy=y+.5-cy,l=Math.hypot(dx,dy);if(l>0&&this.hasLineOfSight(cx,cy,x+.5-dx/l*.8,y+.5-dy/l*.8))v[y*w+x]=1;
    }}}
  _updateVision(){
    this.visible.pac.fill(0);this.visible.ghost.fill(0);
    for(const u of this.units)if(u.hp>0)this._reveal(u.side,u.x,u.y,UNIT_DEFS[u.type].sight);
    for(const b of this.buildings)if(b.hp>0&&b.progress>=1)this._reveal(b.side,b.x,b.y,b.type==='watch'?9:b.type==='tower'?7:6);
    // Every remaining orb is a tiny camera, without channels or tuning. Four
    // cardinal neighbors are within its ~1.25-tile sight radius; walls stop it.
    for(const p of this.pellets.values()){const x=Math.floor(p.x),y=Math.floor(p.y),w=this.map.width;this.visible.ghost[y*w+x]=1;for(const[dx,dy]of DIRS){const xx=x+dx,yy=y+dy;if(this.tileAt(xx,yy))this.visible.ghost[yy*w+xx]=1;}}
    for(let i=0;i<this.map.tiles.length;i++){if(this.visible.pac[i])this.explored.pac[i]=1;if(this.visible.ghost[i]){this.explored.ghost[i]=1;this.knownPelletsGhost[i]=this.pellets.has(i)?(this.pellets.get(i).type==='large'?2:1):0;}}
    for(const side of ['pac','ghost'])for(const u of this.units)if(u.side!==side&&u.hp>0&&this.isVisible(side,u.x,u.y))this.lastSeen[side].set(u.id,{id:u.id,type:u.type,teamId:u.teamId,x:u.x,y:u.y,time:this.time});
    for(const side of ['pac','ghost'])for(const[id,s]of this.lastSeen[side])if(this.time-s.time>12)this.lastSeen[side].delete(id);
  }

  update(dt){
    if(this.paused||this.status!=='playing')return;dt=clamp(Number(dt)||0,0,.15);if(!dt)return;this.time+=dt;for(const id of PAC_TEAMS)this.powerByTeam[id].cooldown=Math.max(0,this.powerByTeam[id].cooldown-dt);this.watchCooldown=Math.max(0,this.watchCooldown-dt);
    for(const id of PAC_TEAMS)if(!this.teams[id].eliminated)this.resources[id]+=dt*.24;this.resources.ghost+=dt*(2.6+this.buildings.filter(b=>b.hp>0&&b.type==='lair'&&b.progress>=1).length*.35);
    const positions=new Map(this.units.map(u=>[u.id,{x:u.x,y:u.y}]));
    this._updateBuildings(dt);if(this.status!=='playing')return;for(const u of this.units){this._updateUnit(u,dt);if(this.status!=='playing')break;}
    if(this.status==='playing')this._separateUnits(dt);
    for(const u of this.units){const p=positions.get(u.id);if(p){u._motionX=(u.x-p.x)/dt;u._motionY=(u.y-p.y)/dt;}}
    this.units=this.units.filter(u=>u.hp>0);this.buildings=this.buildings.filter(b=>b.hp>0);this.effects=this.effects.filter(e=>(e.life-=dt)>0);this.alerts=this.alerts.filter(a=>a.expires>this.time);
    this._healingTime+=dt;if(this._healingTime>=.5){const elapsed=this._healingTime;this._healingTime=0;for(const b of this.buildings)if(b.progress>=1&&['nest','refuge','lair'].includes(b.type))for(const u of this.units)if(u.side===b.side&&u.hp<u.maxHp&&dist(u,b)<4&&this.time-u._lastHit>4)u.hp=Math.min(u.maxHp,u.hp+elapsed*4);}
    this._visionTime-=dt;if(this._visionTime<=0){this._visionTime=.28;this._updateVision();}
    if(this.collected>=this.totalPellets&&this.status==='playing'){this.status='pac-won';this.winnerReason='Every yellow pellet has been consumed.';}
  }
}
