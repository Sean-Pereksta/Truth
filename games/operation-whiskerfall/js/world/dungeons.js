(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const copy=v=>JSON.parse(JSON.stringify(v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const rooms=[{x:160,y:1120,w:840,h:480},{x:160,y:220,w:840,h:820},{x:500,y:1020,w:160,h:140},{x:980,y:540,w:160,h:160},{x:1120,y:220,w:640,h:820},{x:1420,y:1020,w:140,h:200},{x:1250,y:1200,w:510,h:400}];
  const symbols=['◆','▲','●','✦'],colors=['#67ded6','#efad74','#a6cafa','#d1a6f2'];
  const inside=(x,y,r)=>x>=r.x&&y>=r.y&&x<=r.x+r.w&&y<=r.y+r.h;
  const inArena=p=>!!p&&p.x>1120&&p.x<1760&&p.y>220&&p.y<1040;
  const segmentsDistance=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=W.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-ax-dx*t,y-ay-dy*t);};
  function initialState(){return{solved:false,bossDead:false,claimed:false,sequenceIndex:0,mirrors:[1,0,0,1,0,1],rotations:[2,3,1,0,0,2,1,1,3],stars:[false,false,false,false,false],enemies:[]};}
  function nodesFor(kind){
    if(kind==='echo')return [{x:370,y:480},{x:760,y:480},{x:370,y:810},{x:760,y:810}];
    if(kind==='mirrors')return [{x:420,y:820},{x:420,y:480},{x:760,y:480},{x:760,y:820},{x:590,y:480},{x:590,y:650}];
    if(kind==='conduit')return Array.from({length:9},(_,i)=>({x:390+i%3*150,y:480+Math.floor(i/3)*150}));
    return Array.from({length:5},(_,i)=>({x:580+Math.sin(i*TAU/5)*225,y:660-Math.cos(i*TAU/5)*225}));
  }
  function mirrorTrace(state){
    const nodes=nodesFor('mirrors'),lines=[];let x=250,y=820,dx=1,dy=0,previous=-1,hitReceiver=false;
    // Two side mirrors create visible dead ends without obscuring the main circuit.
    nodes[4]={x:250,y:480};nodes[5]={x:900,y:650};
    for(let step=0;step<16;step++){
      let near=-1,best=Infinity;
      nodes.forEach((p,i)=>{const along=(p.x-x)*dx+(p.y-y)*dy,side=Math.abs((p.x-x)*dy-(p.y-y)*dx);if(i!==previous&&along>1&&side<2&&along<best){near=i;best=along;}});
      const receiver={x:920,y:820},along=(receiver.x-x)*dx+(receiver.y-y)*dy;
      if(along>0&&Math.abs((receiver.x-x)*dy-(receiver.y-y)*dx)<2&&along<best){lines.push({x1:x,y1:y,x2:receiver.x,y2:receiver.y});hitReceiver=true;break;}
      if(near<0){const edge=dx>0?970:dx<0?190:dy>0?1000:250;lines.push({x1:x,y1:y,x2:dx?edge:x,y2:dy?edge:y});break;}
      const p=nodes[near];lines.push({x1:x,y1:y,x2:p.x,y2:p.y});x=p.x;y=p.y;previous=near;
      const ox=dx;dx=state.mirrors[near]===0?-dy:dy;dy=state.mirrors[near]===0?-ox:ox;
    }
    return{lines,solved:hitReceiver,nodes};
  }
  const pipeTypes=['elbow','elbow','elbow','elbow','straight','elbow','elbow','elbow','elbow'];
  function pipePorts(index,rotation){return(pipeTypes[index]==='straight'?[0,2]:[0,1]).map(v=>(v+rotation)%4);}
  function conduitTrace(state){
    const nodes=nodesFor('conduit'),lit=[],lines=[{x1:240,y1:630,x2:315,y2:630}],seen=new Set();let index=3,incoming=2,solved=false;
    for(let step=0;step<14;step++){
      if(index<0||index>=9||seen.has(index))break;
      const ports=pipePorts(index,state.rotations[index]);if(!ports.includes(incoming))break;
      seen.add(index);lit.push(index);const out=ports.find(p=>p!==incoming),p=nodes[index];
      const dx=[1,0,-1,0][out],dy=[0,1,0,-1][out];lines.push({x1:p.x-dx*0,y1:p.y,x2:p.x+dx*75,y2:p.y+dy*75});
      if(index===5&&out===0){solved=true;lines.push({x1:p.x,y1:p.y,x2:900,y2:630});break;}
      const col=index%3,row=Math.floor(index/3),nc=col+dx,nr=row+dy;if(nc<0||nc>2||nr<0||nr>2)break;
      index=nr*3+nc;incoming=(out+2)%4;
    }
    return{lit,lines,solved};
  }
  function starTarget(config){return Array.from({length:5},(_,i)=>(i+config.region+config.variant)%2===0);}
  function puzzleStatus(config,state){if(config.puzzle==='mirrors')return mirrorTrace(state).solved;if(config.puzzle==='conduit')return conduitTrace(state).solved;if(config.puzzle==='constellation')return state.stars.every((v,i)=>v===starTarget(config)[i]);return state.sequenceIndex>=4;}
  class DungeonWorld {
    constructor(game,entry,state){
      this.game=game;this.entry=entry;this.config=W.Content.dungeons.find(d=>d.id===entry.id);this.state=state;this.isDungeon=true;this.seed=game.overworld.seed;this.coordinateScale=1;
      this.width=1920;this.height=1800;this.chunkSize=640;this.start={x:570,y:1370};this.rooms=rooms;this.name=entry.name;
      const source=game.overworld.regions[entry.region];this.localRegion={...source,name:entry.name+' · '+source.name,x:0,y:0,w:this.width,h:this.height};
      this.regions=game.overworld.regions.map(r=>({...r,x:-99999,y:-99999,w:0,h:0}));this.regions[entry.region]=this.localRegion;this.sectors=[];this.berlinSector=null;
      this.roads=[];this.rivers=[];this.bridges=[];this.objects=[];this.chunks=new Map();this._enemyGrid=new Map();this._active=new Map();this._dormant=new Map();this._spawns=new Map();this._locationMap=new Map();this._objectChunks=new Map();
      this.dead=game.overworld.dead;this.liberated=game.overworld.liberated;this.opened=game.overworld.opened;this.discovered=new Set();this.safeZones=[];
      this.locations=[{id:entry.id+'_exit',name:'Return to '+source.name,type:'dungeonExit',x:310,y:1450,radius:65,region:entry.region},{id:entry.id+'_treasure',name:'Guardian’s reliquary',type:'dungeonTreasure',x:1510,y:1410,radius:70,region:entry.region},{id:entry.id+'_inscription',name:this.config.title,type:'inscription',x:580,y:300,radius:60,region:entry.region}];
      for(const l of this.locations)this._locationMap.set(l.id,l);
      this.activeEnemies=[];this.maxActiveEnemies=160;this.activeRadius=3000;
      const saved=new Map((state.enemies||[]).map(e=>[e.id,e]));
      const types=entry.region<2?[2,24]:entry.region<4?[24,27,29]:[27,29,36,37,38].filter(i=>W.Content.enemies[i]);
      [[350,1220],[840,1230],[250,930],[875,930]].forEach((p,i)=>{
        const id=entry.id+'_den_'+i;if(this.dead.has(id))return;
        const type=types[(i+this.config.variant)%types.length],spec=W.Content.enemies[type],level=this.config.level;
        const hp=Math.round(spec.hp*(1+entry.region*.75+level*.12));
        this.addEnemy(saved.get(id)||{id,type,x:p[0],y:p[1],homeX:p[0],homeY:p[1],hp,maxHp:hp,level,region:entry.region,damage:spec.damage*(1+entry.region*.34),speed:spec.speed,range:spec.range,fireRate:spec.fireRate,angle:0,state:'patrol',anim:'idle',animTime:0,alert:0,name:spec.name});
      });
      if(!state.bossDead){const info=W.DungeonGuardians[this.config.guardian],hp=Math.round((1000+entry.region*630)*(1+entry.region*.17));const id=entry.id+'_guardian';this.addEnemy(saved.get(id)||{id,name:info.name,dungeonBoss:true,boss:true,type:2,guardian:this.config.guardian,x:1470,y:650,homeX:1470,homeY:650,hp,maxHp:hp,damage:18+entry.region*13,level:this.config.level,region:entry.region,angle:0,anim:'idle',state:'patrol',animTime:0,cycle:0,cooldown:1.5,phase:1,color:info.color});}
      if(!state.bossDead)for(const e of saved.values())if(e.guardianOwner&&e.hp>0&&!e.dead&&!this.dead.has(e.id))this.addEnemy(e);
      for(let y=0;y<3;y++)for(let x=0;x<3;x++)this.discovered.add(x+','+y);
    }
    regionAt(){return this.localRegion;}
    terrainAt(){return{type:'dungeon',biome:'mountain',region:this.entry.region};}
    safeZoneAt(){return null;}
    gateAt(){return null;}
    isFinalArena(){return false;}
    isLocationLocked(){return false;}
    berlinUnlocked(){return this.game.overworld.berlinUnlocked();}
    remainingMajorBosses(){return this.game.overworld.remainingMajorBosses();}
    majorBossesDefeated(){return this.game.overworld.majorBossesDefeated();}
    reveal(){}
    getVisibleObjects(){return[];}
    isOnRoad(){return false;}
    isBlocked(x,y,r=16){
      const inFloor=(px,py)=>rooms.some(room=>inside(px,py,room));
      if(!inFloor(x,y)||![[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,-r*.7]].every(([dx,dy])=>inFloor(x+dx,y+dy)))return true;
      if(!this.state.solved&&x+r>1020&&x-r<1115&&y+r>520&&y-r<720)return true;
      if(!this.state.bossDead&&x+r>1400&&x-r<1580&&y+r>1080&&y-r<1170)return true;
      return false;
    }
    updateActive(){this.activeEnemies=this.activeEnemies.filter(e=>e.hp>0&&!e.dead);this._rebuildEnemyGrid();}
    exportState(){return this.game.overworld.exportState();}
  }
  for(const key of ['_key','_index','getLocation','_rebuildEnemyGrid','nearbyEnemies','addEnemy','_navigationRay','steerAround'])DungeonWorld.prototype[key]=W.World.prototype[key];
  W.DungeonWorld=DungeonWorld;
  function checkpoint(g){if(!g.world.isDungeon)return;g.world.state.rewardDrops=copy(g.drops.filter(d=>d.reward));g.world.state.enemies=g.world.activeEnemies.filter(e=>e.hp>0&&!e.dead).map(e=>({...e,_steer:null,windup:null,charging:0,chargeLeft:null,chainPending:false,comboCharges:0,attackVisual:0,guardianRecovery:!!e.dungeonBoss,cooldown:e.dungeonBoss?Math.max(1.1,e.cooldown||0):e.cooldown,alert:0}));}
  function cleanTravel(g){g.audio.resetAnimals?.();g.bulletPool.reset();g.effectPool.reset();g.particlePool.reset();g.drops=[];g.allies=[];g.grid.clear();g.renderer.chunks?.clear();for(const p of g.players){p.burstQueue=[];p.meleeStrike=null;p.meleeCommit=0;p.dodgeTime=0;}}
  G.enterDungeon=function(entry,restoring=false,positions){
    if(this.world.isDungeon||!entry||entry.type!=='cave')return false;
    if(!restoring&&this.players.some(p=>p.downed||distance(p,entry)>230)){this.ui.toast('Bring both fighters to the cave entrance before descending.');return false;}
    this.dungeonStates=this.dungeonStates||{};const state=this.dungeonStates[entry.id]||(this.dungeonStates[entry.id]=initialState());
    // Missing fields in earlier expansion saves are filled independently.
    for(const [key,value]of Object.entries(initialState()))if(state[key]===undefined)state[key]=value;
    this.overworld=this.world;this.dungeonReturn=this.players.map((p,i)=>({x:entry.x+i*50,y:entry.y+90}));this.dungeonMarker=this.marker;
    this.overworldDrops=this.drops;this.overworldAllies=this.allies;
    this.world=new DungeonWorld(this,entry,state);cleanTravel(this);this.drops=copy(state.rewardDrops||[]);this.marker=null;
    for(const [i,p]of this.players.entries()){p.x=positions?.[i]?.x??570+i*55;p.y=positions?.[i]?.y??1400;if(this.world.isBlocked(p.x,p.y,19)){p.x=570+i*55;p.y=1400;}p.invuln=2;p.reviveTarget=null;}
    this.camera.x=this.players[0].x;this.camera.y=this.players[0].y;this.camera.zoom=.82;this.world.updateActive();
    this.travelInteractUntil=this.time+.75;
    if(!restoring){this.ui.toast(entry.name+' · '+this.world.config.title+(this.world.config.encounter==='survival'?' · Wake the watch altar in the next chamber.':' · inspect the mural in the next room.'),'quest');this.save(false);}
    return true;
  };
  G.leaveDungeon=function(save=true){
    if(!this.world.isDungeon)return false;checkpoint(this);const entry=this.world.entry;this.world=this.overworld;this.overworld=null;cleanTravel(this);
    this.drops=this.overworldDrops||[];this.allies=this.overworldAllies||[];this.overworldDrops=[];this.overworldAllies=[];
    for(const [i,p]of this.players.entries()){const pos=this.dungeonReturn?.[i]||{x:entry.x+i*55,y:entry.y+90};p.x=pos.x;p.y=pos.y;p.invuln=3;}
    this.travelInteractUntil=this.time+.75;this.pendingReward=null;
    this.marker=this.dungeonMarker||null;this.camera.x=this.players[0].x;this.camera.y=this.players[0].y;this.world.updateActive(this.players,1,this);this.ui.toast('Returned to '+this.world.regionAt(entry.x,entry.y).name);if(save)this.save(false);return true;
  };
  G.finishDungeonReward=function(w){
    if(w.state.claimed)return false;w.state.claimed=true;this.questStats.caches.add(w.entry.id);this.overworld.opened.add(w.entry.id);this.overworld.discovered.add(w.entry.id);
    for(const p of [...this.players,this.reservePlayer].filter(Boolean)){p.gold+=120+w.entry.region*70;p.materials+=12+w.entry.region*3;p.cores=(p.cores||0)+2;}
    return true;
  };
  G.solveDungeon=function(){const w=this.world;if(!w.isDungeon||w.state.solved)return;w.state.solved=true;this.effect('level',1060,620,130,1.4);this.audio.play('quest');this.ui.toast('The seal opens. '+W.DungeonGuardians[w.config.guardian].name+' awaits beyond it.','quest');this.save(false);};
  G.puzzleAction=function(index,reset=false){
    const w=this.world;if(!w.isDungeon||w.state.solved)return false;const s=w.state,c=w.config;
    if(reset){const initial=initialState();s.sequenceIndex=0;s.mirrors=initial.mirrors;s.rotations=initial.rotations;s.stars=initial.stars;s.flash=0;this.ui.toast('Mechanism reset. The mural keeps its clue.');return true;}
    if(c.puzzle==='echo'){if(index===c.sequence[s.sequenceIndex]){s.sequenceIndex++;this.audio.play('ui');}else{s.sequenceIndex=0;s.flash=1;this.audio.play('hit');this.ui.toast('Wrong note. All four seals reset—read the mural from left to right.');}}
    else if(c.puzzle==='mirrors')s.mirrors[index]=1-s.mirrors[index];
    else if(c.puzzle==='conduit')s.rotations[index]=(s.rotations[index]+1)%4;
    else for(const n of [index,(index+1)%5,(index+4)%5])s.stars[n]=!s.stars[n];
    if(puzzleStatus(c,s))this.solveDungeon();return true;
  };
  function currentNodes(w){return w.config.puzzle==='mirrors'?mirrorTrace(w.state).nodes:nodesFor(w.config.puzzle);}
  W.Dungeons={initialState,nodesFor,mirrorTrace,conduitTrace,pipePorts,starTarget,puzzleStatus,
    hitProjectile(g,b,oldX,oldY){
      const w=g.world;if(!w.isDungeon||b.owner<0)return false;
      const roller=w.activeEnemies.find(e=>e.dungeonBoss&&e.guardian===0&&e.charging>0&&segmentsDistance(e.x,e.y,oldX,oldY,b.x,b.y)<48);
      if(roller){const length=Math.hypot(b.vx,b.vy)||1;b.x=roller.x-b.vx/length*62;b.y=roller.y-b.vy/length*62;b.vx*=-.85;b.vy*=-.85;b.owner=-1;b.homing=false;b.pierce=0;b.damage=Math.min(b.damage,roller.damage);g.effect('impact',b.x,b.y,22,.2);return false;}
      if(!w.state.solved){const nodes=currentNodes(w),index=nodes.findIndex(p=>segmentsDistance(p.x,p.y,oldX,oldY,b.x,b.y)<31);
        if(index>=0){if((w.shotCooldown||0)<=0){g.puzzleAction(index);w.shotCooldown=.22;g.effect('impact',nodes[index].x,nodes[index].y,24,.25);}return true;}}
      return false;
    }};
  const shoot=G.shoot;
  G.shoot=function(p,...args){const ammo=p.ammo,result=shoot.call(this,p,...args);if(this.world.isDungeon&&!this.world.state.solved&&this.weapon(p).mechanic==='beam'&&p.ammo<ammo){const range=this.weapon(p).range||850,nodes=currentNodes(this.world);const hit=nodes.map((n,i)=>({n,i,d:distance(n,p)})).filter(({n,d})=>d<range&&Math.abs(W.wrapAngle(Math.atan2(n.y-p.y,n.x-p.x)-p.angle))<.07&&this.lineOfSight(p,n)).sort((a,b)=>a.d-b.d)[0];if(hit&&(this.world.shotCooldown||0)<=0){this.puzzleAction(hit.i);this.world.shotCooldown=.22;}}return result;};
  const interact=G.interact;
  G.interact=function(p){
    if(this.paused||p.downed)return;
    if(this.players.some(q=>q!==p&&q.downed&&distance(q,p)<100))return interact.call(this,p);
    const w=this.world;if(!w.isDungeon){const entry=w.locations.filter(l=>l.type==='cave'&&distance(p,l)<130).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(entry)return this.time<(this.travelInteractUntil||0)?false:this.enterDungeon(entry);return interact.call(this,p);}
    const exit=w.locations[0],treasure=w.locations[1],board=w.locations[2];
    if(distance(p,{x:820,y:1460})<105){p.reserve=Math.max(120,p.reserve);this.ui.toast('Expedition supplies · reserve ammunition replenished. Reload with R / D-pad down.');return;}
    if(distance(p,exit)<125){if(this.time<(this.travelInteractUntil||0))return false;if(this.players.some(q=>q.downed||distance(q,exit)>260)){this.ui.toast('Bring both fighters to the exit.');return;}return this.leaveDungeon();}
    if(distance(p,treasure)<125){if(!w.state.bossDead){this.ui.toast('The guardian still holds the reliquary seal.');return;}if(w.state.claimed){this.ui.toast('This relic has already been recovered.');return;}
      const reward=W.Content.dungeonRewards[w.entry.region*2+w.config.variant]||[];
      const drop=this.dropRewardChoice(reward,treasure.x,treasure.y,'Guardian’s reliquary','reliquary-'+w.entry.id,{dungeonId:w.entry.id});
      if(drop)this.openReward(drop,p);else{this.finishDungeonReward(w);this.ui.toast('Relics already owned · expedition supplies recovered','loot');this.checkQuests();}
      this.save(false);return;}
    if(distance(p,board)<130){this.puzzleAction(0,true);return;}
    if(!w.state.solved){const nodes=currentNodes(w),index=nodes.findIndex(n=>distance(p,n)<100);if(index>=0&&['mirrors','conduit'].includes(w.config.puzzle)){this.puzzleAction(index);this.audio.play('ui');return;}}
    this.ui.toast(w.state.solved?'Explore beyond the open seal; the reliquary opens after the guardian falls.':'Read the mural. Shoot the marked stones; rotate nearby mirrors or pipes with E / B.');
  };
  const progress=G.questProgress,target=G.questTarget,objective=G.questObjectiveText;
  G.questProgress=function(id){const q=typeof id==='object'?id:W.Content.quests.find(q=>q.id===id),v=progress.call(this,id);if(q?.type==='dungeon'){v.current=this.dungeonStates?.[q.target]?.claimed?1:0;v.required=1;v.ready=v.current===1;}return v;};
  G.questTarget=function(q){if(typeof q==='string')q=W.Content.quests.find(v=>v.id===q);if(this.world.isDungeon){const w=this.world;if(q&&!this.acceptedQuests.has(q.id)){const npc=this.questContact(q);return{...w.locations[0],label:'Return to the surface'+(npc?', then speak with '+npc.name:'')};}return w.state.claimed?{...w.locations[0],label:'Return to the surface'}:!w.state.solved?{x:580,y:650,label:'Decipher the chamber mechanism'}:!w.state.bossDead?{x:1470,y:650,label:W.DungeonGuardians[w.config.guardian].name}:{...w.locations[1],label:'Recover the guardian’s relic'};}return target.call(this,q);};
  G.questObjectiveText=function(q){if(typeof q==='string')q=W.Content.quests.find(v=>v.id===q);if(q?.type==='dungeon'&&this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id)){const s=this.dungeonStates?.[q.target];return s?.claimed?'Relic recovered.':s?.bossDead?'The guardian has fallen. Open the reliquary.':s?.solved?'The seal is open. Defeat the cavern guardian.':'Enter the cavern and solve its visible mechanism to open the guardian chamber.';}return objective.call(this,q);};
  for(const method of ['updateMissions','updateLocations','dynamicEvent']){const original=G[method];G[method]=function(...args){if(!this.world.isDungeon)return original.apply(this,args);};}
  const fastTravel=G.fastTravel;G.fastTravel=function(...args){if(this.world.isDungeon){this.ui.toast('Return to the surface before travelling.');return false;}return fastTravel.apply(this,args);};
  const updateCamera=G.updateCamera;G.updateCamera=function(dt){updateCamera.call(this,dt);if(this.world.isDungeon)this.camera.zoom=Math.min(this.camera.zoom,.82);};
  const completeBoss=G.completeBoss;G.completeBoss=function(e){if(e.dungeonBoss)return;return completeBoss.call(this,e);};
  const majorBosses=G.majorBosses,bossDefeated=G.bossDefeated;
  G.majorBosses=function(){return this.overworld?this.overworld.locations.filter(l=>l.type==='boss'&&!l.finalBoss&&!l.final&&l.bossIndex!==8&&l.id!=='boss_berlin'):majorBosses.call(this);};
  G.bossDefeated=function(l){return this.overworld?!!l&&(this.overworld.liberated.has(l.id)||this.overworld.dead.has(l.id+'_commander')):bossDefeated.call(this,l);};
  const snapshot=G.snapshot;
  G.snapshot=function(){checkpoint(this);const data=snapshot.call(this);data.dungeonStates=copy(this.dungeonStates||{});if(this.world.isDungeon){data.activeDungeon={id:this.world.entry.id,players:this.players.map(p=>({x:p.x,y:p.y})),marker:this.dungeonMarker};data.rewardDrops=(this.overworldDrops||[]).filter(d=>d.reward);data.world=this.overworld.exportState();data.players=this.players.map((p,i)=>({...p,...this.dungeonReturn[i]}));data.marker=this.dungeonMarker;data.missionEnemies=this.overworld.activeEnemies.filter(e=>e.missionTarget&&e.hp>0&&!e.dead).map(e=>({...e}));data.region=this.overworld.regionAt(this.world.entry.x,this.world.entry.y).name;}return data;};
  const load=G.load;G.load=function(slot=0){const data=W.Save.read(slot);if(!data)return false;const previous={overworld:this.overworld,overworldDrops:this.overworldDrops,overworldAllies:this.overworldAllies,dungeonStates:this.dungeonStates};let ok;this.overworld=null;this.overworldDrops=[];this.overworldAllies=[];this.dungeonStates=data.dungeonStates||{};try{ok=load.call(this,slot);}finally{if(!ok)Object.assign(this,previous);}if(ok&&data.activeDungeon){const entry=this.world.getLocation(data.activeDungeon.id);if(entry)this.enterDungeon(entry,true,data.activeDungeon.players);}return ok;};
  const start=G.start;G.start=function(opts={}){if(opts.load)return start.call(this,opts);this.dungeonStates={};this.overworld=null;this.overworldDrops=[];this.overworldAllies=[];return start.call(this,opts);};
  const guardianPhase=e=>e.hp/e.maxHp<.35?3:e.hp/e.maxHp<.68?2:1;
  const guardianPatterns=[
    [['roll','slam','rockFan'],['chainRoll','rockFan','slam','roll'],['chainRoll','slam','rockFan','chainRoll']],
    [['swoop','iceFan','iceBarrage'],['iceBarrage','swoop','iceFan'],['swoop','iceBarrage','iceFan','swoop']],
    [['poison','webLattice','brood','venomFan'],['webLattice','brood','poison','venomFan'],['brood','poison','webLattice','venomFan']],
    [['blink','burrowLine','voidFan'],['burrowLine','voidFan','blink'],['blink','voidFan','burrowLine','voidFan']]
  ];
  const guardianPattern=(guardian,phase)=>guardianPatterns[guardian]?.[W.clamp(phase-1,0,2)]||guardianPatterns[0][0];
  Object.assign(W.Dungeons,{guardianPhase,guardianPattern});
  function clearGuardianThreats(g,e,minions=false){
    for(const effect of g.effects)if(effect.alive&&effect.guardianId===e.id)effect.alive=false;
    for(const bullet of g.projectiles)if(bullet.alive&&bullet.guardianId===e.id)bullet.alive=false;
    if(minions)for(const child of g.world.activeEnemies)if(child.guardianOwner===e.id){child.dead=true;child.hp=0;g.world.dead.add(child.id);}
  }
  function guardianPoint(x,y){return{x:W.clamp(x,1175,1705),y:W.clamp(y,275,985)};}
  function guardianLane(e,p,length=510){
    const angle=Math.atan2(p.y-e.y,p.x-e.x),dx=Math.cos(angle),dy=Math.sin(angle);let span=Math.min(length,Math.max(210,distance(e,p)+95));
    if(dx>0)span=Math.min(span,(1715-e.x)/dx);else if(dx<0)span=Math.min(span,(1165-e.x)/dx);
    if(dy>0)span=Math.min(span,(995-e.y)/dy);else if(dy<0)span=Math.min(span,(265-e.y)/dy);
    span=Math.max(0,span);return{x:e.x+dx*span,y:e.y+dy*span,angle,length:span};
  }
  function guardianStrike(g,e,point,radius,delay,damage,color,hazard){
    return g.effect('telegraph',point.x,point.y,radius,Math.max(.32,delay*.74),{owner:-1,damage,delay:true,guardianId:e.id,guardianColor:color,guardianHazard:hazard});
  }
  function guardianFan(g,e,a,count,spread,damage,kind='enemy',speed=330,color='#e2b68a'){
    for(let i=0;i<count;i++){const angle=a-spread/2+(count===1?0:i*spread/(count-1));g.bulletPool.take({x:e.x+Math.cos(angle)*40,y:e.y+Math.sin(angle)*40,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:3,damage,owner:-1,kind,radius:kind==='enemy'?8:6,color,guardianId:e.id,guardianAttack:e.lastAttack,visualHeight:0});}
    g.effect('muzzle',e.x+Math.cos(a)*40,e.y+Math.sin(a)*40,22,.14,{angle:a,height:0});
  }
  G.beginGuardianAttack=function(e,p,kind){
    const phase=e.phase||guardianPhase(e),point=guardianPoint(p.x+(p.velocityX||0)*.28,p.y+(p.velocityY||0)*.28),angle=Math.atan2(point.y-e.y,point.x-e.x),damage=e.damage*1.8*(1+(phase-1)*.14);
    const a={type:kind,x:point.x,y:point.y,sx:e.x,sy:e.y,angle,time:.85,duration:.85,radius:100,damage,color:W.DungeonGuardians[e.guardian].color};
    e.guardianRecovery=false;e.anim='windup';e.lastAttack=kind;e.attackVisual=0;
    if(kind==='roll'||kind==='chainRoll'||kind==='chainContinuation'||kind==='swoop'){
      Object.assign(a,guardianLane(e,point,kind==='swoop'?540:510));a.type=kind==='swoop'?'swoop':'roll';a.radius=64;a.shape='lane';a.time=kind==='chainContinuation'?.64:.82;a.duration=a.time;
      a.label=kind==='swoop'?'FROST SWOOP':kind==='chainRoll'||kind==='chainContinuation'?'CHAIN RICOCHET · KEEP MOVING':'ARMORED RICOCHET · WATCH THE WALLS';
      if(kind==='chainRoll')e.comboCharges=phase===3?2:1;
    }else if(kind==='slam'){
      a.x=e.x;a.y=e.y;a.radius=145;a.time=1.05;a.duration=1.05;a.label='FAULTLINE SLAM · MOVE OUT';a.shape='slam';
    }else if(['rockFan','iceFan','voidFan','venomFan'].includes(kind)){
      a.shape='fan';a.count=kind==='voidFan'?7+phase*2:5+phase*2;a.spread=kind==='voidFan'?2.25:kind==='venomFan'?1.4:1.7;a.length=370;
      a.label={rockFan:'SHRAPNEL FAN',iceFan:'ICICLE FAN',voidFan:'VOID LANCES',venomFan:'VENOM SPIT'}[kind];a.time=.88;a.duration=.88;
    }else if(kind==='iceBarrage'){
      a.points=[];a.label='FALLING ICICLES · KEEP MOVING';a.shape='markers';a.time=.58;a.duration=.58;
      const count=phase+2,nx=-Math.sin(angle),ny=Math.cos(angle);
      for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*135,point=guardianPoint(p.x+nx*offset+(p.velocityX||0)*.18,p.y+ny*offset+(p.velocityY||0)*.18);a.points.push(point);guardianStrike(this,e,point,70,1.05+i*.2,damage*.85,'#a7e7f4');}
    }else if(kind==='poison'){
      a.label='VENOM BLOOM · LEAVE THE CIRCLE';a.radius=105;
    }else if(kind==='webLattice'){
      a.shape='markers';a.label='WEB SNARES · FIND THE GAPS';a.time=.65;a.duration=.65;a.points=[];
      const offsets=phase===1?[[-115,0],[115,0]]:[[-125,-90],[125,-90],[0,130]];
      for(const [dx,dy]of offsets){const point=guardianPoint(p.x+dx,p.y+dy);a.points.push(point);guardianStrike(this,e,point,66,1.1,damage*.35,'#d7e6d1',{life:3.5,damage:damage*.15,slow:true,color:'#bfd5c1'});}
    }else if(kind==='brood'){
      a.x=e.x;a.y=e.y;a.radius=95;a.time=1.05;a.duration=1.05;a.label='BROOD CALL · BREAK THE SWARM';a.shape='brood';
    }else if(kind==='blink'){
      a.time=.72;a.duration=.72;a.radius=115;a.label='ROYAL EMERGENCE · MOVE AWAY';a.shape='blink';
    }else if(kind==='burrowLine'){
      const lane=guardianLane(e,point,480),count=4+phase;a.shape='markers';a.label='BURROW RIFT · CROSS THE LINE';a.points=[];a.time=.62;a.duration=.62;
      for(let i=1;i<=count;i++){const f=i/count,pos={x:e.x+(lane.x-e.x)*f,y:e.y+(lane.y-e.y)*f};a.points.push(pos);guardianStrike(this,e,pos,58,.95+i*.16,damage*.75,'#c7a5ef');}
    }
    a.time*=.74;a.duration=a.time;e.windup=a;return a;
  };
  function finishGuardianAttack(g,e,a){
    const damage=a.damage??e.damage*1.8,phase=e.phase||1;e.windup=null;e.attackVisual=.4;e.guardianRecovery=true;e.cooldown=phase===3?.55:.85;
    if(a.type==='roll'||a.type==='swoop'){
      const speed=a.type==='swoop'?850:920+phase*40;e.chargeAngle=a.angle??Math.atan2(a.y-e.y,a.x-e.x);e.chargeLeft=a.type==='roll'?1550+phase*250:a.length??Math.min(540,distance(e,a));e.chargeSpeed=speed;e.chargeDamage=damage*1.25;e.rollBounces=0;e.charging=e.chargeLeft/speed;e.guardianRecovery=false;e.anim='run';
    }else if(a.type==='slam'){
      g.explode(a.x,a.y,a.radius||145,damage*1.15,-1,'shockwave');g.effect('guardianRing',a.x,a.y,330,.9,{guardianId:e.id,damage:damage*.85,owner:-1,fromRadius:145,toRadius:330,thickness:18,hitPlayers:{},color:'#e8bc82'});e.cooldown=1.05;
    }else if(['rockFan','iceFan','voidFan','venomFan'].includes(a.type)){
      const kind=a.type==='iceFan'?'ice':a.type==='venomFan'?'venom':'enemy',color=a.type==='iceFan'?'#b4e8f1':a.type==='venomFan'?'#c5db85':a.type==='voidFan'?'#ccadef':'#e6b98a';guardianFan(g,e,a.angle,a.count,a.spread,damage*.8,kind,a.type==='voidFan'?550:470,color);
    }else if(a.type==='blink'){
      e.x=a.x;e.y=a.y;g.effect('reinforcement',e.x,e.y,65,.35,{guardianId:e.id});guardianStrike(g,e,a,115,.44,damage*1.25,'#d0abf3');e.cooldown=.85;
    }else if(a.type==='poison'){
      g.explode(a.x,a.y,105,damage,-1);g.effect('hazard',a.x,a.y,90,phase===3?3.2:4,{owner:-1,damage:damage*.45,color:'#8ab065',tick:.65,poison:true,guardianId:e.id});
      if(phase>1){const side=guardianPoint(a.x+Math.cos(a.angle+Math.PI/2)*170,a.y+Math.sin(a.angle+Math.PI/2)*170);guardianStrike(g,e,side,75,.9,damage*.55,'#b6d98d',{life:2.8,damage:damage*.25,poison:true,color:'#8ab065'});}e.cooldown=.85;
    }else if(a.type==='brood'){
      const living=g.world.activeEnemies.filter(n=>n.guardianOwner===e.id&&n.hp>0&&!n.dead).length,count=Math.max(0,Math.min(phase+1,5-living)),type=W.Content.enemies.findIndex(n=>n.role==='leaper');
      for(let i=0;i<count;i++){const angle=(i+.5)*TAU/Math.max(1,count)+(e.cycle||0),point=guardianPoint(e.x+Math.cos(angle)*135,e.y+Math.sin(angle)*135),hp=85+e.region*35;
        g.world.addEnemy({id:e.id+'_brood_'+(e.cycle||0)+'_'+i,type:Math.max(0,type),...point,homeX:point.x,homeY:point.y,hp,maxHp:hp,damage:e.damage*.35,region:e.region,level:e.level,guardianOwner:e.id,ephemeral:true,angle,state:'chase',anim:'run',alert:12});g.effect('reinforcement',point.x,point.y,40,.55,{guardianId:e.id});}
      e.cooldown=1;
    }else if(a.type==='iceBarrage'||a.type==='webLattice'||a.type==='burrowLine')e.cooldown=.9;
  }
  const updateEffects=G.updateEffects;G.updateEffects=function(dt){
    if(!this.world?.isDungeon)return updateEffects.call(this,dt);if(this.paused)return;
    const pending=[];
    for(const effect of this.effects)if(effect.alive&&effect.guardianId){
      const source=this.world.activeEnemies.find(e=>e.id===effect.guardianId&&e.hp>0&&!e.dead);if(!source){effect.alive=false;continue;}
      if(effect.type==='guardianRing'){
        const elapsed=effect.maxLife-effect.life,from=effect.fromRadius+(effect.toRadius-effect.fromRadius)*W.clamp(elapsed/effect.maxLife,0,1),to=effect.fromRadius+(effect.toRadius-effect.fromRadius)*W.clamp((elapsed+dt)/effect.maxLife,0,1);
        for(const p of this.players){const d=distance(p,effect),key=String(p.id);if(!p.downed&&inArena(p)&&!effect.hitPlayers[key]&&d>=from-effect.thickness-16&&d<=to+effect.thickness+16){effect.hitPlayers[key]=true;this.damagePlayer(p,effect.damage,effect);}}
      }
      // The effect pool may recycle this very object when its impact creates an
      // explosion. Capture the follow-up before allowing that recycling.
      if(effect.life<=dt&&effect.guardianHazard)pending.push({x:effect.x,y:effect.y,radius:effect.radius,hazard:{...effect.guardianHazard},source});
    }
    updateEffects.call(this,dt);
    for(const {x,y,radius,hazard,source}of pending)if(source.hp>0&&!source.dead)this.effect('hazard',x,y,radius,hazard.life,{owner:-1,guardianId:source.id,damage:hazard.damage,tick:.45,slow:hazard.slow,poison:hazard.poison,color:hazard.color});
  };
  const defeat=G.defeat;G.defeat=function(){if(this.world.isDungeon){const w=this.world,b=w.activeEnemies.find(e=>e.dungeonBoss);if(b){clearGuardianThreats(this,b,true);b.hp=b.maxHp;b.x=b.homeX;b.y=b.homeY;b.windup=null;b.charging=0;b.chargeLeft=null;b.comboCharges=0;b.chainPending=false;b.cycle=0;b.phase=1;b.cooldown=1.5;b.burn=0;b.poison=0;}this.leaveDungeon(false);}return defeat.call(this);};
  const damage=G.damageEnemy;G.damageEnemy=function(e,...args){if(e.dungeonBoss&&(!this.world.state.solved||!inArena(args[1])||e.charging>0&&e.guardian===0)){this.effect('impact',e.x,e.y,25,.2);return;}return damage.call(this,e,...args);};
  const applyStatus=G.applyEnemyStatus;G.applyEnemyStatus=function(e,b){if(e.dungeonBoss&&(!this.world.state.solved||!inArena(this.players[b.owner])))return;return applyStatus.call(this,e,b);};
  const kill=G.killEnemy;G.killEnemy=function(e,p){if(!e.dungeonBoss)return kill.call(this,e,p);if(e.dead)return;e.dead=true;e.hp=0;const rodent=this.audio.isRodent?.(e);this.audio.vocal?.(rodent?'mouse_defeat':'cat_happy',rodent?e:(p||this.players[0]),this);clearGuardianThreats(this,e,true);this.world.dead.add(e.id);this.world.state.bossDead=true;this.kills++;this.questStats.kills++;if(p)p.stats.kills++;for(const q of this.players){this.awardXP(q,350+e.region*160);q.cores=(q.cores||0)+1;}this.effect('defeat',e.x,e.y,110,1.1,{dungeonBoss:true,guardian:e.guardian});this.audio.play('quest');this.ui.toast(e.name+' defeated. The southern reliquary seal has opened.','quest');this.save(false);};
  const updateEnemies=G.updateEnemies;
  G.updateEnemies=function(dt){
    const w=this.world;if(!w.isDungeon)return updateEnemies.call(this,dt);if(this.paused)return;
    w.shotCooldown=Math.max(0,(w.shotCooldown||0)-dt);w.state.flash=Math.max(0,(w.state.flash||0)-dt);
    const guardians=w.activeEnemies.filter(e=>e.dungeonBoss);w.activeEnemies=w.activeEnemies.filter(e=>!e.dungeonBoss);updateEnemies.call(this,dt);w.activeEnemies.push(...guardians.filter(e=>e.hp>0));
    for(const e of guardians){if(e.dead||e.hp<=0||!w.state.solved)continue;
      for(const status of ['burn','poison','bleed'])if(e[status]>0){e[status]-=dt;e.hp-=dt*(e[status+'Damage']||7)*(status==='poison'?(e.poisonStacks||1):1);if(e.hp<=0){this.killEnemy(e,this.players[e[status+'Owner']]||this.players[0]);break;}}
      if(e.dead)continue;
      e.animTime=(e.animTime||0)+dt;e.attackVisual=Math.max(0,(e.attackVisual||0)-dt);e.hit=Math.max(0,(e.hit||0)-dt);e.stun=Math.max(0,(e.stun||0)-dt);e.chillTime=Math.max(0,(e.chillTime||0)-dt);
      const phase=guardianPhase(e);if(e.phase!==phase){e.phase=phase;this.effect('bossWarning',e.x,e.y,200,1.15,{text:e.name+' · PHASE '+phase});}
      const p=this.players.filter(p=>!p.downed&&inArena(p)).sort((a,b)=>distance(e,a)-distance(e,b))[0];
      if(!p){clearGuardianThreats(this,e);e.windup=null;e.charging=0;e.chargeLeft=null;e.comboCharges=0;e.chainPending=false;e.cooldown=Math.max(1.1,e.cooldown||0);continue;}
      if(e.stun>0)continue;
      if(e.charging>0){
        const ox=e.x,oy=e.y,speed=(e.chargeSpeed||(e.guardian===0?960:850))*(e.chillTime>0?.75:1),hasDistance=Number.isFinite(e.chargeLeft),step=Math.min(speed*dt,hasDistance?e.chargeLeft:speed*e.charging),damage=e.chargeDamage??e.damage*1.8*(1+(phase-1)*.14)*1.25;
        let travelled=0;e.angle=e.chargeAngle;
        if(e.guardian===0){
          const motion=this.moveRicochet(e,e.chargeAngle,step,37,damage,64,{minX:1165,maxX:1715,minY:265,maxY:995});e.chargeAngle=motion.angle;e.rollBounces=(e.rollBounces||0)+motion.bounces;travelled=motion.travelled;
        }else{
          this.move(e,Math.cos(e.chargeAngle)*step,Math.sin(e.chargeAngle)*step,37);travelled=Math.hypot(e.x-ox,e.y-oy);
          for(const q of this.players)if(!q.downed&&inArena(q)&&segmentsDistance(q.x,q.y,ox,oy,e.x,e.y)<64)this.damagePlayer(q,damage,e);
        }
        if(hasDistance){e.chargeLeft=Math.max(0,e.chargeLeft-travelled);e.charging=e.chargeLeft/speed;}else e.charging=Math.max(0,e.charging-dt);
        if(travelled<1||hasDistance&&e.chargeLeft<1)e.charging=0;
        if(e.charging<=0){e.chargeLeft=null;e.guardianRecovery=true;e.anim='idle';if(e.comboCharges>0){e.comboCharges--;e.chainPending=true;e.cooldown=.28;}else{e.chainPending=false;e.cooldown=e.guardian===0?.75:.6;}}continue;
      }
      e.angle=Math.atan2(p.y-e.y,p.x-e.x);
      if(e.windup){e.windup.time-=dt;if(e.windup.time<=0)finishGuardianAttack(this,e,e.windup);continue;}
      e.cooldown=(e.cooldown??1)-dt;e.anim='idle';if(e.cooldown>0){
        if(e.guardian!==0&&!e.chainPending){const goal=e.guardian===2?guardianPoint(p.x,p.y):guardianPoint(p.x+Math.cos(this.time*1.4+e.guardian)*210,p.y+Math.sin(this.time*1.4+e.guardian)*210),dir=w.steerAround(e,goal,dt),speed=e.guardian===1?125:e.guardian===2?65:100;this.move(e,dir.mx*dt*speed,dir.my*dt*speed,37);}continue;
      }
      if(e.chainPending){e.chainPending=false;this.beginGuardianAttack(e,p,'chainContinuation');continue;}
      const pattern=guardianPattern(e.guardian,phase),cycle=e.cycle||0;e.cycle=cycle+1;this.beginGuardianAttack(e,p,pattern[cycle%pattern.length]);
    }
    w._rebuildEnemyGrid();
  };
  // Interiors use the same actors, camera and combat renderer with bespoke architecture and visual mechanisms.
  function label(c,text,x,y,size=14,color='#e2dbb9'){c.font='700 '+size+'px system-ui';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#12212a';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);}
  function line(c,ax,ay,bx,by,color,width=4){c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function orb(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
  const dungeonAccents=['#7bb39a','#76ab82','#9fb8d0','#9edee8','#d8b37c','#72c6ba','#e5956d','#b09add'];
  const art=(renderer,key,col,row,x,y,width,height,options={})=>!!W.Art?.draw(renderer,key,col,row,x,y,width,height,options);
  function glow(c,x,y,r,color,alpha=.3){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function ring(c,x,y,r,color,width=2){c.beginPath();c.arc(x,y,r,0,TAU);c.lineWidth=width;c.strokeStyle=color;c.stroke();}
  // The bright core follows the collision trace exactly. Fine threads and travelling motes
  // give the light motion without suggesting a second, false puzzle route.
  function lightPath(renderer,segments,color='#f4c775',water=false){
    const c=renderer.ctx,time=renderer.clock||0;c.save();c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='lighter';
    for(const l of segments){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      c.globalAlpha=.08;line(c,l.x1,l.y1,l.x2,l.y2,color,water?20:25);
      c.globalAlpha=.18;line(c,l.x1,l.y1,l.x2,l.y2,color,water?11:12);
      c.globalAlpha=.8;line(c,l.x1,l.y1,l.x2,l.y2,color,water?4:3.2);
      c.globalAlpha=.9;line(c,l.x1,l.y1,l.x2,l.y2,water?'#d7ffff':'#fff5cf',1.1);
      c.globalAlpha=.38;c.lineWidth=.75;c.strokeStyle=color;c.beginPath();c.moveTo(l.x1,l.y1);
      const flutter=Math.sin(time*3+l.x1*.01)*2.4;
      c.bezierCurveTo(l.x1+dx*.33+nx*flutter,l.y1+dy*.33+ny*flutter,l.x1+dx*.66-nx*flutter,l.y1+dy*.66-ny*flutter,l.x2,l.y2);c.stroke();
      const count=Math.max(1,Math.ceil(len/85));for(let i=0;i<count;i++){const t=(i/count+time*(water?.22:.34))%1;c.globalAlpha=.5+Math.sin(t*Math.PI)*.4;orb(c,l.x1+dx*t,l.y1+dy*t,water?2:1.6,'#fff9dc');}
      c.globalAlpha=.45;orb(c,l.x1,l.y1,4,color);orb(c,l.x2,l.y2,4,color);
    }c.restore();
  }
  function socket(c,x,y,r,color,active=false){
    c.save();if(active)glow(c,x,y,r*1.9,color,.2);c.fillStyle='#11202c';c.beginPath();c.ellipse(x,y+7,r+5,r*.72,0,0,TAU);c.fill();
    ring(c,x,y,r,'#111b25',7);ring(c,x,y,r-1,'#766949',2);ring(c,x,y,r-6,active?color:'#40545d',1);c.restore();
  }
  function drawIllustratedGround(renderer,w){
    const image=renderer.images?.dungeonFloors;if(!image||!W.Art?.draw)return false;
    const key=w.entry.region+':'+w.config.variant;
    if(!renderer._dungeonGround||renderer._dungeonGround.key!==key||renderer._dungeonGround.image!==image){
      const surface=document.createElement('canvas');surface.width=w.width;surface.height=w.height;const c=surface.getContext('2d'),r={ctx:c,images:renderer.images},accent=dungeonAccents[w.entry.region];
      if(!art(r,'dungeonFloors',w.entry.region%4,Math.floor(w.entry.region/4),0,0,128,128,{fullCell:true,px:0,py:0}))return false;
      c.fillStyle='#0b141c';c.fillRect(0,0,w.width,w.height);
      // Architecture and floor textures are static: cache one interior rather than
      // rebuilding a full map of gradients, tiles and masonry every frame.
      for(const room of rooms){c.fillStyle='#101d27';c.fillRect(room.x-27,room.y-30,room.w+54,room.h+60);c.fillStyle='#586465';c.fillRect(room.x-14,room.y-18,room.w+28,room.h+36);}
      c.save();c.beginPath();for(const room of rooms)c.rect(room.x,room.y,room.w,room.h);c.clip();
      for(let y=128;y<1664;y+=128)for(let x=128;x<1792;x+=128){const region=w.entry.region;art(r,'dungeonFloors',region%4,Math.floor(region/4),x,y,128,128,{fullCell:true,px:0,py:0});}
      c.fillStyle='rgba(11,24,32,.22)';c.fillRect(0,0,w.width,w.height);c.restore();
      for(const room of [rooms[0],rooms[1],rooms[4],rooms[6]]){
        c.strokeStyle='#0e1b25';c.lineWidth=12;c.strokeRect(room.x+5,room.y+5,room.w-10,room.h-10);
        c.strokeStyle='#6a7470';c.lineWidth=2;c.strokeRect(room.x+3,room.y+3,room.w-6,room.h-6);
        for(let x=room.x+48;x<room.x+room.w-30;x+=96){line(c,x,room.y-14,x,room.y+3,'#26343a',3);line(c,x,room.y+room.h-2,x,room.y+room.h+14,'#26343a',3);}
        c.save();const shade=c.createLinearGradient(0,room.y,0,room.y+100);shade.addColorStop(0,'rgba(4,12,20,.68)');shade.addColorStop(1,'rgba(4,12,20,0)');c.fillStyle=shade;c.fillRect(room.x,room.y,room.w,100);c.restore();
      }
      // Corridors continue the actual tile texture through room thresholds.
      for(const room of [rooms[2],rooms[3],rooms[5]]){c.save();c.beginPath();c.rect(room.x,room.y,room.w,room.h);c.clip();for(let y=Math.floor(room.y/128)*128;y<room.y+room.h;y+=128)for(let x=Math.floor(room.x/128)*128;x<room.x+room.w;x+=128)art(r,'dungeonFloors',w.entry.region%4,Math.floor(w.entry.region/4),x,y,128,128,{fullCell:true,px:0,py:0});c.fillStyle='rgba(11,24,32,.22)';c.fillRect(room.x,room.y,room.w,room.h);c.restore();}
      c.save();c.globalAlpha=.25;art(r,'puzzleDevices',2,3,1460,650,470,470);ring(c,1460,650,245,accent,2);ring(c,1460,650,222,accent,1);c.restore();
      renderer._dungeonGround={key,image,surface};
    }
    renderer.ctx.drawImage(renderer._dungeonGround.surface,0,0);return true;
  }
  function drawDungeonDressing(renderer,w){
    const c=renderer.ctx,accent=dungeonAccents[w.entry.region],clock=renderer.clock||0;
    for(const room of [rooms[0],rooms[1],rooms[4],rooms[6]]){
      for(const [x,y]of [[room.x+31,room.y+57],[room.x+room.w-31,room.y+57],[room.x+30,room.y+room.h-52],[room.x+room.w-30,room.y+room.h-52]]){
        const pulse=.21+Math.sin(clock*5+x)*.025;glow(c,x,y,115,'#f9b866',pulse);art(renderer,'dungeonProps',2,0,x,y,44,74,{glow:'#f3a550'});
      }
      // Decorations hug the masonry, keeping the walkable routes and puzzle ports clear.
      for(let n=0;n<Math.floor(room.h/160);n++){const y=room.y+120+n*160;for(const side of [0,1]){const x=room.x+(side?room.w-16:16);if(y>520&&y<710&&((room===rooms[1]&&side===1)||(room===rooms[4]&&side===0)))continue;
        const kind=(n+w.entry.region+side)%4;art(renderer,'dungeonProps',kind,1,x,y,kind===2?72:61,kind===2?96:83,{flip:side===1,alpha:.94});}}
      for(const x of [room.x+68,room.x+room.w-68])art(renderer,'dungeonProps',1,0,x,room.y+19,60,108,{py:.83});
    }
    for(const [x,y,col]of [[225,1320,3],[945,1515,2],[1685,1280,2],[1320,1530,3],[1697,940,1]])art(renderer,'dungeonProps',col,3,x,y,65,71,{alpha:.85});
    // Sparse ambient dust is deterministic and never resembles a projectile warning.
    c.save();for(let i=0;i<24;i++){const x=210+(i*277)%1490+Math.sin(clock*.13+i)*9,y=260+(i*193)%1280-Math.sin(clock*.24+i)*13;if(!rooms.some(room=>inside(x,y,room)))continue;c.globalAlpha=.12+Math.sin(clock*.5+i)*.06;orb(c,x,y,1.4,accent);}c.restore();
  }
  function drawPuzzle(renderer,w){
    const c=renderer.ctx,s=w.state,config=w.config,nodes=currentNodes(w),lit=config.puzzle==='conduit'?conduitTrace(s).lit:[];
    const muralClear=(273-renderer.game.camera.y)*(renderer.game.camera.zoom||1)+renderer.height/2>185;
    const muralLabel=(...args)=>{if(muralClear)label(...args);};
    c.fillStyle='#12212b';c.fillRect(255,245,650,125);c.strokeStyle='#86794f';c.lineWidth=2;c.strokeRect(255,245,650,125);c.strokeStyle='#33444a';c.lineWidth=1;c.strokeRect(261,251,638,113);
    art(renderer,'dungeonProps',3,2,271,308,80,130,{alpha:.5});art(renderer,'dungeonProps',3,2,889,308,80,130,{alpha:.5,flip:true});
    muralLabel(c,config.title.toUpperCase(),580,273,18,'#f0d49c');
    if(config.encounter==='survival'){
      muralLabel(c,'Hold the chamber. Defeat every wave to break its seal.',580,310,14);
      const cleared=s.survival?.phase==='cleared'||s.solved,accent=cleared?'#9de3bd':'#e1b27b';
      glow(c,580,650,210,accent,.11);art(renderer,'puzzleDevices',2,3,580,650,300,300,{glow:accent});
      renderer.drawArtEffect?.(3,1,580,619,154,126,{alpha:.24+Math.sin((renderer.clock||0)*2)*.04});
      art(renderer,'encounterProps',3,0,580,650,116,134,{py:.7,glow:'#76d6eb'});
      c.save();c.setLineDash([5,22]);c.lineDashOffset=-(renderer.clock||0)*4;ring(c,580,650,245,accent,2);c.restore();
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,x=580+Math.cos(a)*255,y=650+Math.sin(a)*255;socket(c,x,y,33,accent,cleared);art(renderer,'puzzleDevices',cleared?1:0,3,x,y,63,63,{glow:cleared?accent:undefined});}
      label(c,cleared?'TRIAL COMPLETE':'WAVE TRIAL',580,963,18,accent);return;
    }else if(config.puzzle==='echo'){
      muralLabel(c,'Shoot the seals in the mural’s order. A wrong note resets all four.',580,302,13);
      config.sequence.forEach((n,i)=>muralLabel(c,symbols[n],475+i*70,344,30,colors[n]));
      nodes.forEach((n,i)=>{const on=config.sequence.indexOf(i)<s.sequenceIndex;socket(c,n.x,n.y+8,40,colors[i],on);c.save();
        if(!art(renderer,'puzzleDevices',i,0,n.x,n.y,86,90,{glow:s.flash>0?'#ff6571':on?colors[i]:undefined})){c.shadowColor=colors[i];c.shadowBlur=on?22:4;c.fillStyle=s.flash>0?'#a13c48':'#3b454a';c.beginPath();c.moveTo(n.x-31,n.y+22);c.lineTo(n.x-25,n.y-19);c.lineTo(n.x,n.y-40);c.lineTo(n.x+30,n.y-13);c.lineTo(n.x+36,n.y+24);c.closePath();c.fill();c.strokeStyle=on?colors[i]:'#6f7e7b';c.lineWidth=4;c.stroke();}
        // Symbols stay exact, high contrast and aligned with each actual shot target.
        if(on)glow(c,n.x,n.y,44,colors[i],.25);label(c,symbols[i],n.x,n.y+9,29,s.flash>0?'#ff9298':on?colors[i]:'#e8dfc4');c.restore();});
      for(let i=0;i<4;i++)orb(c,520+i*40,965,8,i<s.sequenceIndex?'#93e2c1':'#536066');
    }else if(config.puzzle==='mirrors'){
      muralLabel(c,'Guide amber light into the sun receiver. E / B or shoot to turn a mirror.',580,307,12);muralLabel(c,'/ turns east → north     \\ turns east → south',580,341,15);
      const trace=mirrorTrace(s);lightPath(renderer,trace.lines);
      glow(c,250,820,78,'#f4c775',.3);renderer.drawArtEffect?.(2,0,250,820,118,118,{alpha:.26});if(!art(renderer,'puzzleDevices',1,1,250,820,86,86,{glow:'#f3cc74'}))orb(c,250,820,24,'#f4d27e');
      if(trace.solved)renderer.drawArtEffect?.(2,0,920,820,130,130,{alpha:.34+Math.sin((renderer.clock||0)*2)*.04});
      if(!art(renderer,'puzzleDevices',trace.solved?2:3,1,920,820,86,86,{glow:trace.solved?'#b0ebbc':undefined}))orb(c,920,820,31,trace.solved?'#a6e3c3':'#756d49');
      label(c,'☀',920,829,26,trace.solved?'#f6edb8':'#c9b981');
      nodes.forEach((n,i)=>{socket(c,n.x,n.y,35,'#a6e3ec');if(!art(renderer,'puzzleDevices',0,1,n.x,n.y,76,76,{angle:s.mirrors[i]?Math.PI/2:0})){orb(c,n.x,n.y,32,'#344e55');ring(c,n.x,n.y,30,'#9aa28c',3);}
        line(c,n.x-21,n.y+(s.mirrors[i]?-21:21),n.x+21,n.y+(s.mirrors[i]?21:-21),'#d9f7fc',3);label(c,String(i+1),n.x,n.y+53,13,'#d6ccad');});
    }else if(config.puzzle==='conduit'){
      muralLabel(c,'Rotate pipe joints with E / B or a shot. Connect water to the right-hand wheel.',580,305,12);muralLabel(c,'Only joined pipe ends carry water. Blue joints show the live route.',580,340,13);
      line(c,240,630,315,630,'#405b60',18);line(c,765,630,900,630,'#405b60',18);lightPath(renderer,[{x1:240,y1:630,x2:315,y2:630}], '#68d7e8',true);if(s.solved)lightPath(renderer,[{x1:765,y1:630,x2:900,y2:630}],'#68d7e8',true);
      label(c,'SPRING',235,570,12);label(c,'WHEEL',900,570,12);
      nodes.forEach((n,i)=>{const active=lit.includes(i),ports=pipePorts(i,s.rotations[i]);c.fillStyle='#152b35';c.fillRect(n.x-70,n.y-70,140,140);c.strokeStyle='#5f6a63';c.lineWidth=2;c.strokeRect(n.x-70,n.y-70,140,140);
        // Physical port connectors meet at the exact 150px grid boundaries.
        const parts=ports.map(p=>({x1:n.x,y1:n.y,x2:n.x+[1,0,-1,0][p]*75,y2:n.y+[0,1,0,-1][p]*75}));for(const p of parts){line(c,p.x1,p.y1,p.x2,p.y2,'#151f29',20);line(c,p.x1,p.y1,p.x2,p.y2,'#768479',13);}
        art(renderer,'puzzleDevices',pipeTypes[i]==='straight'?1:0,2,n.x,n.y,132,132,{angle:s.rotations[i]*Math.PI/2});if(active)lightPath(renderer,parts,'#68d7e8',true);orb(c,n.x,n.y,9,active?'#c8fcf1':'#bba66e');ring(c,n.x,n.y,11,'#263f45',2);
      });
      if(!art(renderer,'puzzleDevices',3,2,240,630,90,90,{glow:'#75dce9'}))orb(c,240,630,26,'#79cfe2');
      if(!art(renderer,'puzzleDevices',2,2,900,630,92,92,{angle:s.solved?(renderer.clock||0)*.5:0}))orb(c,900,630,26,s.solved?'#a6e4d7':'#6f755c');
    }else{
      muralLabel(c,'Shooting a star flips it AND its two linked neighbors. Match this pattern:',580,304,12);
      if(muralClear)starTarget(config).forEach((on,i)=>{orb(c,480+i*50,337,12,on?'#f3d487':'#344b55');label(c,String(i+1),480+i*50,341,10,on?'#282b32':'#c8d6dc');});
      c.save();c.globalAlpha=.23;art(renderer,'puzzleDevices',2,3,580,660,370,370);c.restore();
      nodes.forEach((n,i)=>{const next=nodes[(i+1)%5];line(c,n.x,n.y,next.x,next.y,'#172c3b',8);line(c,n.x,n.y,next.x,next.y,'#63798d',2);if(s.stars[i]&&s.stars[(i+1)%5])lightPath(renderer,[{x1:n.x,y1:n.y,x2:next.x,y2:next.y}],'#b6b4f1');});
      nodes.forEach((n,i)=>{socket(c,n.x,n.y,38,'#efd187',s.stars[i]);if(!art(renderer,'puzzleDevices',s.stars[i]?1:0,3,n.x,n.y,76,76,{glow:s.stars[i]?'#efd187':undefined}))orb(c,n.x,n.y,31,s.stars[i]?'#ecd181':'#304954');label(c,String(i+1),n.x,n.y+7,20,s.stars[i]?'#fff7c4':'#afc2d6');});
    }
    label(c,s.solved?'SEAL OPEN':'E / B at mural · reset mechanism',580,1010,13,s.solved?'#9ae0bb':'#c2baa4');
  }
  const terrain=R.drawTerrain;
  R.drawTerrain=function(w){if(!w.isDungeon)return terrain.call(this,w);const c=this.ctx;
    if(!drawIllustratedGround(this,w)){c.fillStyle='#10191f';c.fillRect(0,0,w.width,w.height);
    for(const room of rooms){c.fillStyle='#35454b';c.fillRect(room.x-20,room.y-20,room.w+40,room.h+40);c.fillStyle='#26363d';c.fillRect(room.x,room.y,room.w,room.h);}
    c.save();c.beginPath();for(const r of rooms)c.rect(r.x,r.y,r.w,r.h);c.clip();
    const v=this.view||{x:0,y:0,w:w.width,h:w.height};for(let y=Math.max(0,Math.floor(v.y/80)*80);y<Math.min(w.height,v.y+v.h);y+=80)for(let x=Math.max(0,Math.floor(v.x/80)*80);x<Math.min(w.width,v.x+v.w);x+=80){c.fillStyle=(x/80+y/80)%2?'#2c3c42':'#2a383e';c.fillRect(x+2,y+2,76,76);c.strokeStyle='#203036';c.lineWidth=1;c.strokeRect(x+2,y+2,76,76);}c.restore();
    for(const r of [rooms[0],rooms[1],rooms[4],rooms[6]]){c.strokeStyle='#667271';c.lineWidth=6;c.strokeRect(r.x+4,r.y+4,r.w-8,r.h-8);for(const [x,y]of [[r.x+35,r.y+55],[r.x+r.w-35,r.y+55],[r.x+35,r.y+r.h-55],[r.x+r.w-35,r.y+r.h-55]]){c.save();const grad=c.createRadialGradient(x,y,3,x,y,105);grad.addColorStop(0,'rgba(244,184,99,.22)');grad.addColorStop(1,'rgba(244,184,99,0)');c.fillStyle=grad;c.fillRect(x-105,y-105,210,210);orb(c,x,y,8,'#efbf78');c.restore();}}
    // Mineral veins, moss, broken paving and wall ribs distinguish the regional caverns.
    const accents=['#63876f','#618a77','#819db5','#a0d1dc','#be9a66','#6fa7a0','#cb8068','#9a82b6'],accent=accents[w.entry.region];
    c.save();c.beginPath();for(const r of rooms)c.rect(r.x+10,r.y+10,r.w-20,r.h-20);c.clip();
    for(let i=0;i<85;i++){const x=170+(i*317+w.entry.region*71)%1570,y=230+(i*193+w.config.variant*79)%1330;if(!rooms.some(r=>inside(x,y,r)))continue;
      c.globalAlpha=.18;line(c,x,y,x+15,y+9,accent,2);line(c,x+15,y+9,x+18,y+26,accent,2);if(i%4===0){c.fillStyle=accent;c.beginPath();c.ellipse(x,y,18+i%17,8+i%9,.5,0,TAU);c.fill();}}
    c.globalAlpha=1;c.restore();
    for(const r of [rooms[0],rooms[1],rooms[4],rooms[6]])for(let i=0;i<Math.floor(r.h/125);i++)for(const x of [r.x+15,r.x+r.w-15]){const y=r.y+50+i*125;c.fillStyle='#18282d';c.beginPath();c.moveTo(x-15,y-25);c.lineTo(x+13,y-18);c.lineTo(x+19,y+18);c.lineTo(x-19,y+29);c.closePath();c.fill();line(c,x-7,y-10,x+3,y+13,accent,3);}
    c.save();c.strokeStyle=accent;c.globalAlpha=.3;c.lineWidth=3;c.beginPath();c.arc(1460,650,240,0,TAU);c.stroke();c.setLineDash([12,19]);c.beginPath();c.arc(1460,650,210,0,TAU);c.stroke();c.restore();
    // Cover decorative seams where connected corridors meet room borders.
    for(const r of [rooms[2],rooms[3],rooms[5]]){c.fillStyle='#2d4148';c.fillRect(r.x,r.y,r.w,r.h);}
    }
    drawDungeonDressing(this,w);
    drawPuzzle(this,w);
    const gate=(x,y,width,height,open,text)=>{const cx=x+width/2,cy=y+height/2;
      if(!open){if(!art(this,'dungeonProps',0,3,cx,cy,width+22,height+28)){c.fillStyle='#263f46';c.fillRect(x,y,width,height);for(let n=0;n<width;n+=18)line(c,x+n,y,x+n,y+height,'#a59772',6);}
        art(this,'puzzleDevices',3,3,cx,cy,45,45,{glow:'#edbf75'});glow(c,cx,cy,64,'#edbf75',.12);label(c,text,cx,y-18,13,'#edca89');
      }else{art(this,'dungeonProps',0,0,cx,cy,width+26,height+32,{alpha:.8});label(c,'OPEN',cx,y-13,12,'#8bd8bb');}};
    gate(1020,540,95,160,w.state.solved,'SEALED');gate(1420,1080,140,85,w.state.bossDead,'GUARDIAN SEAL');
    const exit=w.locations[0];if(!art(this,'dungeonProps',3,0,exit.x,exit.y,135,130)){c.fillStyle='#101d25';c.fillRect(exit.x-55,exit.y-55,110,100);for(let i=0;i<5;i++)line(c,exit.x-48,exit.y-35+i*17,exit.x+48,exit.y-35+i*17,'#92a0a1',4);}label(c,'E / B · SURFACE',exit.x,exit.y+85,14);
    if(!art(this,'dungeonProps',2,2,820,1460,80,76,{py:.7}))this.sprite('scenery',3,3,6,4,820,1460,70,70,{py:.7});label(c,'E / B · AMMUNITION',820,1510,12);
    const t=w.locations[1];if(w.state.bossDead&&!w.state.claimed)glow(c,t.x,t.y,100,'#f8d58c',.25+Math.sin((this.clock||0)*2)*.04);
    if(!art(this,'dungeonProps',w.state.claimed?1:0,2,t.x,t.y,115,105,{py:.7,glow:w.state.bossDead&&!w.state.claimed?'#edc678':undefined}))this.sprite('scenery',2,3,6,4,t.x,t.y,90,90,{py:.7});label(c,w.state.claimed?'RELIC RECOVERED':w.state.bossDead?'E / B · CLAIM RELIC':'GUARDIAN’S RELIQUARY',t.x,t.y+58,13,w.state.bossDead?'#f0d387':'#899d9e');
    label(c,w.entry.name.toUpperCase(),590,1190,22,'#e6cf9d');label(c,w.config.encounter==='survival'?'Enter the trial chamber. Survive its waves. Break the seal.':'Clear the den. Read the mural. Open the seal.',590,1220,14);
    const info=W.DungeonGuardians[w.config.guardian];label(c,info.name,1460,292,20,info.color);
  };
  const drawActor=R.drawActor;
  R.drawActor=function(e,isPlayer,...args){if(!e.dungeonBoss)return drawActor.call(this,e,isPlayer,...args);const c=this.ctx,info=W.DungeonGuardians[e.guardian];c.save();
    if(e.windup){const a=e.windup,radius=a.radius||(a.type==='blink'?115:a.type==='poison'?105:64),color=a.color||(e.guardian===3?'#d5a8f5':e.guardian===2?'#b7dc8d':'#f7b580');c.save();
      if(a.shape==='lane'){
        c.save();c.globalAlpha=.12;c.lineCap='round';line(c,a.sx,a.sy,a.x,a.y,color,radius*2);c.restore();const nx=-Math.sin(a.angle)*radius,ny=Math.cos(a.angle)*radius;
        c.setLineDash([8,9]);line(c,a.sx+nx,a.sy+ny,a.x+nx,a.y+ny,color,2);line(c,a.sx-nx,a.sy-ny,a.x-nx,a.y-ny,color,2);c.setLineDash([]);line(c,a.sx,a.sy,a.x,a.y,color,2);ring(c,a.x,a.y,radius,color,2);
      }else if(a.shape==='fan'){
        c.save();c.globalAlpha=.1;c.fillStyle=color;c.beginPath();c.moveTo(e.x,e.y);c.arc(e.x,e.y,a.length,a.angle-a.spread/2,a.angle+a.spread/2);c.closePath();c.fill();c.restore();
        for(let i=0;i<a.count;i++){const angle=a.angle-a.spread/2+i*a.spread/(a.count-1);c.setLineDash([5,12]);line(c,e.x,e.y,e.x+Math.cos(angle)*a.length,e.y+Math.sin(angle)*a.length,color,1.5);}c.setLineDash([]);
      }else if(a.shape!=='markers'){
        glow(c,a.x,a.y,radius,color,.16);ring(c,a.x,a.y,radius,color,2);ring(c,a.x,a.y,radius-8,color,1);
        c.strokeStyle='#fff0c9';c.lineWidth=5;c.beginPath();c.arc(a.x,a.y,radius,-Math.PI/2,-Math.PI/2+TAU*(1-W.clamp(a.time/(a.duration||.85),0,1)));c.stroke();
        for(let i=0;i<4;i++){const angle=i*Math.PI/2;line(c,a.x+Math.cos(angle)*(radius-15),a.y+Math.sin(angle)*(radius-15),a.x+Math.cos(angle)*(radius+9),a.y+Math.sin(angle)*(radius+9),color,3);}
        if(a.type==='slam'){c.setLineDash([4,18]);ring(c,a.x,a.y,285,color,1);c.setLineDash([]);}
      }c.restore();}
    this.shadow(e.x,e.y,46,19,.5);
    const time=e.animTime||this.clock||0,frame=e.hit>0?7:e.windup?3:e.charging>0||e.attackVisual>0?4+Math.floor(time*14)%2:e.guardianRecovery||e.cycle>0&&e.cooldown>1.5?6:e.guardian!==0&&e.cooldown>0?1+Math.floor(time*5)%2:0;
    const sizes=[[140,144],[210,135],[190,147],[160,177]],size=sizes[e.guardian]||sizes[0];
    if(e.burn>0)glow(c,e.x,e.y-20,80,'#f5a15e',.2);if(e.poison>0)glow(c,e.x,e.y-20,80,'#9ddd70',.15);if(e.chillTime>0)glow(c,e.x,e.y-20,80,'#b2eaff',.22);
    const illustrated=art(this,'cavernGuardians',frame,e.guardian,e.x,e.y+24,size[0],size[1],{py:1,flip:Math.cos(e.angle||0)<0,glow:e.hit>0?'#fff0d0':e.phase>=2?info.color:undefined});
    if(e.charging>0&&e.guardian===0){c.save();c.globalAlpha=.48;c.setLineDash([12,17]);c.lineDashOffset=-(this.clock||0)*115;c.beginPath();c.ellipse(e.x,e.y-26,68,61,0,0,TAU);c.lineWidth=3;c.strokeStyle='#edd4a0';c.stroke();c.restore();}
    if(!illustrated){c.translate(e.x,e.y-14);c.rotate(e.charging>0?e.angle:Math.sin(this.clock*2)*.04);c.fillStyle=e.hit>0?'#fff0d0':info.color;c.strokeStyle='#18252a';c.lineWidth=5;
    if(info.kind==='bat'){c.beginPath();c.moveTo(-15,0);c.quadraticCurveTo(-60,-75,-95,-20);c.lineTo(-55,20);c.lineTo(-18,12);c.moveTo(15,0);c.quadraticCurveTo(60,-75,95,-20);c.lineTo(55,20);c.lineTo(18,12);c.fill();c.stroke();}
    if(info.kind==='spider')for(let i=0;i<4;i++)for(const sign of [-1,1]){const y=-25+i*16;line(c,sign*20,y,sign*55,y-18,info.color,9);line(c,sign*55,y-18,sign*(74+Math.sin(this.clock*4+i)*7),y+22,info.color,6);}
    if(info.kind==='rat'&&e.charging>0){orb(c,0,0,46,'#b5a990');for(let i=0;i<5;i++){c.save();c.rotate(i*TAU/5+this.clock*15);line(c,0,6,43,0,'#44525a',5);c.restore();}}
    else{c.beginPath();c.ellipse(0,0,info.kind==='spider'?35:40,info.kind==='bat'?32:47,0,0,TAU);c.fill();c.stroke();if(info.kind!=='spider'){orb(c,-27,-35,16,info.color);orb(c,27,-35,16,info.color);}orb(c,-13,-7,6,'#ef696b');orb(c,13,-7,6,'#ef696b');if(info.kind==='burrower'){c.fillStyle='#e6ca84';c.beginPath();c.moveTo(-25,-35);c.lineTo(-30,-65);c.lineTo(-8,-48);c.lineTo(0,-74);c.lineTo(12,-48);c.lineTo(31,-65);c.lineTo(24,-35);c.fill();}}
    }
    c.restore();const healthY=e.y-(illustrated?size[1]-5:98);c.fillStyle='#101d25';c.fillRect(e.x-74,healthY-2,148,13);c.fillStyle='#4c4745';c.fillRect(e.x-70,healthY,140,9);c.fillStyle=info.color;c.fillRect(e.x-70,healthY,140*Math.max(0,e.hp/e.maxHp),9);label(c,e.name+' · '+(e.phase||1)+'/3',e.x,healthY-13,13,info.color);
    const status=!this.game.players.some(p=>!p.downed&&inArena(p))?'WARD · ENTER THE CHAMBER':e.guardian===0&&e.charging>0?'PLATED · SHOTS REFLECT':e.windup?.label||(e.guardianRecovery?'EXPOSED · RECOVERING':null);
    if(status)label(c,status,e.x,e.y+76,11,e.windup||e.charging>0?'#f5b17e':'#a5e3be');
  };
  const drawEffect=R.drawEffect;
  R.drawEffect=function(effect,front=false){
    if(!effect.guardianId||!['guardianRing','telegraph','hazard'].includes(effect.type))return drawEffect?.call(this,effect,front);
    if(front)return;const c=this.ctx,t=1-W.clamp(effect.life/effect.maxLife,0,1),color=effect.guardianColor||effect.color||'#dfb5f1';c.save();
    // These use actual circular collision dimensions, including the moving annulus.
    if(effect.type==='guardianRing'){
      const radius=effect.fromRadius+(effect.toRadius-effect.fromRadius)*t;c.globalAlpha=.25;ring(c,effect.x,effect.y,radius,color,effect.thickness*2);c.globalAlpha=.95;ring(c,effect.x,effect.y,radius,color,4);c.globalAlpha=.8;ring(c,effect.x,effect.y,radius-effect.thickness,'#fff0cf',1);ring(c,effect.x,effect.y,radius+effect.thickness,'#fff0cf',1);
    }else if(effect.type==='hazard'){
      c.beginPath();c.arc(effect.x,effect.y,effect.radius,0,TAU);c.clip();c.globalAlpha=.19;c.fillStyle=color;c.fillRect(effect.x-effect.radius,effect.y-effect.radius,effect.radius*2,effect.radius*2);c.globalAlpha=1;
      this.drawArtEffect?.(effect.poison?2:0,effect.poison?2:1,effect.x,effect.y,effect.radius*2,effect.radius*2,{alpha:.35});c.setLineDash([7,9]);ring(c,effect.x,effect.y,effect.radius-2,color,2);
    }else{
      c.globalAlpha=.12;c.fillStyle=color;c.beginPath();c.arc(effect.x,effect.y,effect.radius,0,TAU);c.fill();c.globalAlpha=.95;ring(c,effect.x,effect.y,effect.radius,color,2);c.lineWidth=4;c.strokeStyle='#ffefd6';c.beginPath();c.arc(effect.x,effect.y,effect.radius,-Math.PI/2,-Math.PI/2+t*TAU);c.stroke();
      line(c,effect.x-8,effect.y,effect.x+8,effect.y,color,2);line(c,effect.x,effect.y-8,effect.x,effect.y+8,color,2);
    }c.restore();
  };
  const labels=R.drawLocationLabels;
  R.drawLocationLabels=function(w){if(!w.isDungeon)labels.call(this,w);};
  const map=R.drawMap;
  R.drawMap=function(c,width,height,options={}){const w=this.game.world;if(!w?.isDungeon)return map.call(this,c,width,height,options);c.fillStyle='#13232d';c.fillRect(0,0,width,height);c.save();c.scale(width/w.width,height/w.height);for(const r of rooms){c.fillStyle='#6e8887';c.fillRect(r.x,r.y,r.w,r.h);}c.fillStyle=w.state.solved?'#97d6ae':'#df9b69';c.fillRect(1020,530,100,180);c.fillStyle='#f4d68e';c.fillRect(1470,1370,70,70);for(const p of this.game.players)orb(c,p.x,p.y,26,'#fff2b6');c.restore();};
  const draw=R.draw;
  R.draw=function(dt){const g=this.game,w=g.world,runs=g.missionRuns;try{if(w?.isDungeon)g.missionRuns={};draw.call(this,dt);}finally{g.missionRuns=runs;}if(!w?.isDungeon||g.ui.isOpen||w.state.solved||w.config.encounter==='survival'||w.config.distantVault||!g.players.some(p=>p.x<1000&&p.y<1120))return;const c=this.ctx,width=Math.min(610,this.width-330),x=(this.width-width)/2,y=98;if(width<270)return;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='rgba(14,31,39,.94)';c.fillRect(x,y,width,64);c.strokeStyle='#9c926c';c.lineWidth=1;c.strokeRect(x,y,width,64);
    const clue={echo:'Shoot the runes in this order. A wrong shot resets the seal.',mirrors:'Turn mirrors with E / B or shoot. Guide light into the sun.',conduit:'Rotate joints with E / B or shoot. Connect spring to wheel.',constellation:'Each shot flips a star and both neighbors. Match this pattern.'}[w.config.puzzle];
    label(c,clue,this.width/2,y+20,Math.min(13,width/44),'#e5d7b1');
    if(w.config.puzzle==='echo')w.config.sequence.forEach((n,i)=>label(c,symbols[n],this.width/2-90+i*60,y+51,25,i<w.state.sequenceIndex?'#98e3be':colors[n]));
    else if(w.config.puzzle==='constellation')starTarget(w.config).forEach((on,i)=>{orb(c,this.width/2-90+i*45,y+46,11,on?'#efd080':'#4d6068');label(c,String(i+1),this.width/2-90+i*45,y+50,10,on?'#22363d':'#c8d6dc');});
    else label(c,w.config.puzzle==='mirrors'?'Follow the beam. A mirror changes its path by 90°.':'Water lights connected joints. Unjoined ends stop its flow.',this.width/2,y+48,Math.min(13,width/42),'#9fd4d8');c.restore();};
})();
