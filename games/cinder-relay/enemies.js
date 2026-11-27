/* Cinder Relay — actors, telegraphs and hostile ordnance. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const factions = ['Foundry garrison', 'Orchard brood', 'Relay constructs'];
  const signal = ['#ff9561', '#ffe66f', '#ff9dda'];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);
  const polar = (p,a,d) => ({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d});
  const living = e => !e.dead && e.hp>0;
  const width = g => g.worldW || g.W || 960;
  const height = g => g.worldH || g.H || 540;
  const pilots=g=>g.players?.length?g.players:[g.player];
  const active=p=>p&&p.hp>0&&!p.downed;
  const decoyFor=(g,p)=>g.forPilot?g.forPilot(p).decoy:g.decoy;
  const hurtPilot=(g,p,amount)=>g.hurtPilot?g.hurtPilot(p,amount):g.hurtPlayer(amount);
  function insideRoom(room,p,pad=0){
    return !room||(p.x>=room.x+pad&&p.y>=room.y+pad&&p.x<=room.x+room.w-pad&&p.y<=room.y+room.h-pad);
  }
  function insideBounds(room,p,pad){
    return room?{x:clamp(p.x,room.x+pad,room.x+room.w-pad),y:clamp(p.y,room.y+pad,room.y+room.h-pad)}:p;
  }
  // A socket or emitter can sit near an outer corner cut from the chamber.
  // Pull it back along its original line toward the actor until its body fits.
  function arenaPoint(g,e,p,pad){
    if(!e.chamber)return p;
    const dest=insideBounds(e.chamber,p,pad);
    for(let i=0;i<=12;i++){
      const t=i/12,pt=i?{x:dest.x+(e.x-dest.x)*t,y:dest.y+(e.y-dest.y)*t}:dest;
      if(!g.blocked(pt.x,pt.y,pad)&&clearLab(g,e,pt))return pt;
    }
    return {x:e.x,y:e.y};
  }
  function moveEnemy(g,e,dx,dy){
    const room=e.chamber;
    if(room){
      dx=clamp(e.x+dx,room.x+e.r+2,room.x+room.w-e.r-2)-e.x;
      dy=clamp(e.y+dy,room.y+e.r+2,room.y+room.h-e.r-2)-e.y;
    }
    g.move(e,dx,dy);
  }
  function aimPoint(g,e){
    if(e.boss&&e.windup>0&&active(e.volleyTarget)&&insideRoom(e.chamber,e.volleyTarget))return e.volleyTarget;
    let closest=null,distance=Infinity,lure=null,lureDistance=270,visible=null,visibleDistance=Infinity;
    for(const p of pilots(g)){
      if(!active(p)||!insideRoom(e.chamber,p))continue;
      const d=dist(e,p);
      if(d<distance){closest=p;distance=d;}
      if(g.map?.lab&&g.players?.length===2&&d<visibleDistance&&clearLab(g,e,p)){visible=p;visibleDistance=d;}
      if(e.boss||(e.serial+e.salvo)%4===0)continue;
      const decoy=decoyFor(g,p);
      if(decoy?.life>0&&insideRoom(e.chamber,decoy)&&dist(e,decoy)<lureDistance&&clearLab(g,e,decoy)){lure=decoy;lureDistance=dist(e,decoy);}
    }
    return lure||visible||closest||(e.chamber?e:g.player);
  }
  function bossVolleyTarget(g,e,nearest){
    if(g.players?.length!==2||!e.attackTarget)return nearest;
    const partner=g.players.find(p=>p!==e.attackTarget&&active(p)&&insideRoom(e.chamber,p)&&clearLab(g,e,p));
    return partner||nearest;
  }
  const profiles = [
    // Name, movement, attack, hull, radius, speed, preferred range, shot interval, field notes
    ['Rivet Infantry','post','burst',49,12,76,203,2.45,'Takes firing posts and brackets your route with staggered bursts.'],
    ['Slab Guard','advance','fan',82,15,49,125,2.95,'A moving shield. Circle behind its plate while it opens fire.'],
    ['Rail Spotter','retreat','rail',44,11,79,260,3.52,'Its tracking laser freezes just before the needle leaves the scope.'],
    ['Crawler Rack','orbit','mine',42,13,64,105,3.1,'Treads lay shootable mines along your previous route.'],
    ['Chain Hauler','orbit','tether',65,16,44,100,3.8,'A tethered head sweeps a broad, marked arc.'],
    ['Bastion Rig','post','wall',81,17,36,195,5,'Two rows of rivets leave a shifting opening.'],
    ['Wedge Sapper','flank','sapper',35,11,92,140,3.3,'A diagonal jet dash sets up an aimed retreat-cutting burst.'],
    ['Forklift Bruiser','advance','crate',72,16,46,130,3.9,'Throws its crate at a marked square. Shooting the load staggers it.'],
    ['Mortar Mule','strafe','mortar',52,13,62,225,4.5,'A rear-line artillery rig. Watch the circles where its shells will land.'],
    ['Skiff Pursuer','flank','wake',38,13,90,155,3.5,'Straight passes leave a trail of separated wake pellets.'],
    ['Bulwark Welder','support','weld',45,13,68,190,3.4,'Repairs a wounded ally after a visible weld. Interrupt either end.'],
    ['Magazine Runner','support','supply',30,10,110,175,3.9,'Runs between firing posts and restocks nearby gunners.'],
    ['Skitter','melee','leap',29,9,119,45,2.25,'Curves into an open approach slot, crouches, then commits to a leap.'],
    ['Pod Boiler','post','seedring',46,14,41,132,3.9,'Its abdomen swells before releasing a broken ring of seeds.'],
    ['Lung Sower','post','nest',44,13,52,185,6,'Roots in place and grows a nest. Shoot the pod before its skitter hatches.'],
    ['Needle Mantis','flank','prong',35,12,83,86,3.0,'An offset lunge ends in a three-pronged burst.'],
    ['Carapace Choir','support','link',52,14,48,180,4,'Hollow ribs recharge the shielding of nearby brood.'],
    ['Glass Leech','retreat','trail',27,10,85,128,2.8,'Slips away on shallow curves and leaves outlined acid pools.'],
    ['Gutter Clam','scavenge','consume',54,15,36,140,4.0,'Opens at a fallen creature, feeds, then spits a thick fan.'],
    ['Tendril Kite','edge','seedlines',34,12,75,185,4.4,'Drifts across the edge and drops two lines of falling seeds.'],
    ['Pollen Ram','flank','ram',68,15,65,147,4.1,'Bait its straight charge into cover. It sheds pollen on impact.'],
    ['Root Crab','burrow','burrow',41,13,51,115,3.8,'Disturbed ground marks the next emergence point.'],
    ['Pouch Spore','retreat','pouch',30,11,69,145,3.2,'Backpedals from danger and leaves a pair of corrosive pockets.'],
    ['Graft Hunter','flank','hooks',45,13,83,125,3.4,'Two hook-shaped seeds curl inward from the edge of your approach.'],
    ['Prism Jack','post','bank',39,12,67,180,3.1,'Its bright marker shows the corner where a shot will bend.'],
    ['Echo Scribe','retreat','echo',36,12,55,205,3.0,'Prints nested blast outlines where you stood one beat ago.'],
    ['Gate Warden','edge','gate',58,15,51,185,4.8,'Two destructible mouths take turns sending a fan across the floor.'],
    ['Harrow Orb','orbit','spiral',44,14,69,150,4.2,'A revolving pair of arms writes two open spirals.'],
    ['Null Stitcher','post','stitch',43,12,68,185,4.8,'Two anchors briefly link with a damage fence, leaving an open segment.'],
    ['Crown Socket','chord','chord',60,15,69,133,3.5,'Moves while plated. The plates open for a bright three-note volley.'],
    ['Clock Lattice','beat','echoes',42,13,105,150,3.6,'Moves on a beat and fires from two former positions.'],
    ['Halo Cradle','edge','halo',50,14,64,170,5,'Drops three satellites in a triangle. Break one to clear a spoke.'],
    ['Switchback Blade','flank','switchback',36,12,86,150,3.5,'Cuts down a telegraphed zigzag, then reverses it.'],
    ['Null Pivot','pivot','null',47,14,34,160,3.9,'A black tile eats incoming fire. Walk through or shoot from a new angle.'],
    ['Pane Fisher','strafe','pane',47,14,68,165,4.1,'Sets a temporary mirror pane across a lane and bends its marked shots.'],
    ['Phase Lantern','support','phase',39,12,71,175,4.2,'Teleports an ally to the marked landing ring after a bright pulse.'],
    ['Foundry Tack Hound','pursue','bite',12,7,133,13,1.55,'Low-slung wheel packs race straight down a lane. Their jaws flare amber before a short bite.'],
    ['Brood Needleling','pack','bite',10,6,147,15,1.69,'Pairs of small mantids fan around opposite shoulders, then snap their glowing mandibles.'],
    ['Relay Glint Mite','skitter','bite',9,6,151,14,1.45,'Triprong drones drift, then dart in alternating beats. Turn as the violet core flashes.']
  ];
  const defs = profiles.map(([name,move,attack,hp,r,speed,range,interval,desc],id)=>({
    id,name,move,attack,hp,r,speed,range,interval,desc,fodder:id>=36,
    faction:factions[id>=36?id-36:Math.floor(id/12)],color:signal[id>=36?id-36:Math.floor(id/12)]
  }));
  // Firing range is deliberately independent of preferred movement range.
  // A fireteam suppresses an open lane while it advances to its assigned posts.
  const reach = [760,635,865,266,190,720,380,427,760,375,385,405,
    119,650,525,176,425,365,645,640,229,370,490,675,
    730,575,680,645,495,715,685,490,293,475,680,415,30,33,32];
  const covering = new Set(['burst','fan','rail','wall','wake','prong','sapper','seedring','consume','bank','spiral','chord','hooks','echoes','gate','pane']);
  const responders = new Set([0,1,2,5,6,8,9,13,14,16,18,19,22,23,24,25,26,27,29,30,34,35]);
  const bosses = [
    ['Breakwater Walker','Firing solution','Radiator sweep','Broken rivet rings','A dock hauler with a failing rivet turret.',1690,31,0],
    ['Brood Lantern','Nest choir','Curling spores','Inward bloom','A luminous heart suspended on four tall limbs.',2150,31,1],
    ['Crucible Regent','Press lanes','Molten ingots','Compression walls','A foundry press riding an articulated carriage.',2550,34,0],
    ['Choir of One','Projected fan','Dish crossing','Offset chorus','A triangular core conducts three projections.',2995,31,2],
    ['The Pale Relay','Paired gates','Folding bridges','Closing iris','A spindle of machine bones orbits an exposed lens.',3610,33,2],
    ['The Twin Forges','Paired pistons','Counterstroke','Traveling shockline','Two press heads share a shifting power circuit.',3480,33,0],
    ['Husk of the Horizon','Wing gates','Limb anchors','Crossing orbits','A living orbital vessel with seed-filled wings.',3610,34,1]
  ].map(([name,p1,p2,p3,desc,hp,r,f],id)=>({id,name,phases:[p1,p2,p3],desc,hp,r,faction:factions[f],color:signal[f]}));
  const fields = new WeakMap();
  function field(g) {
    let f=fields.get(g);
    if(!f || f.map!==g.map || f.room!==g.room || f.stage!==g.stage) {
      f={map:g.map,room:g.room,stage:g.stage,serial:0,history:new WeakMap(),lastDash:new WeakMap(),historyClock:0,corpses:[],live:[]}; fields.set(g,f);
    }
    return f;
  }
  function floorPoint(g,x,y,r=10,away=false,room=null) {
    const w=width(g),h=height(g);
    let legal=null;
    for(let i=0;i<80;i++){
      const radius= i===0?0:14*Math.ceil(i/8);
      const a=i*2.399963;
      const p={x:clamp(x+Math.cos(a)*radius,r+4,w-r-4),y:clamp(y+Math.sin(a)*radius,r+4,h-r-4)};
      if(!insideRoom(room,p,r+2)||g.blocked(p.x,p.y,r)||!clearLab(g,{x,y},p))continue;
      legal??=p;
      if(!away||(pilots(g).every(pilot=>!active(pilot)||dist(p,pilot)>76)&&!g.enemies.some(e=>living(e)&&dist(e,p)<e.r+r+2)))return p;
    }
    return legal||(room?room.center:{x:clamp(x,r+6,w-r-6),y:clamp(y,r+6,h-r-6)});
  }
  function spawn(g,id,x,y,{boss=false,elite=false,chamber=null}={}) {
    const f=field(g),d=(boss?bosses:defs)[id];
    if(!d)throw Error('Unknown enemy '+id);
    const stage=Math.max(1,g.stage||1);
    const factor=(1+Math.min(4,stage-1)*.18)*(1+Math.min(30,Math.max(0,stage-5))*.04);
    if(boss&&g.map?.lab)chamber=g.map.bossRoom||g.map.lab.bossRoom||null;
    const r=d.r*(elite&&!boss?1.12:1), p=floorPoint(g,x,y,r,true,chamber);
    const hullFactor=d.fodder?Math.min(1.4,factor):boss&&stage<=5?1:factor;
    const standardHull=d.hp*hullFactor*(boss?1.22:elite?1.85:1)*(g.map?.challenge?.hull??1);
    const crewHull=g.players?.length===2?(boss?1.78:elite?1.2:1):1;
    const serial=++f.serial;
    const e={...p,id,name:d.name,boss,elite,chamber,serial,r,def:d,a:0,arrive:boss?1.12:.72,windup:0,windMax:1,
      hp:Math.round(standardHull*crewHull),maxHp:0,
      mass:boss?7:Math.max(.62,(r/12)**2)*(elite?1.25:1),kx:0,ky:0,stagger:0,stun:0,flash:0,
      post:serial*2.39996,turn:serial%2?1:-1,salvo:0,phase:1,cd:boss?.3:.19+g.rng()*.43,recover:0,
      events:[],memory:[],traits:[],attackAge:9,walk:0,pulse:0,impactHold:0,shield:0};
    e.maxHp=e.hp;
    e.a=angle(e,aimPoint(g,e));
    if(elite&&!boss){
      const traits=['Foreman','Overgrown','Prismatic','Armored'];const t=Math.floor(g.rng()*4);
      e.traits.push(traits[t]);
      if(stage>=20)e.traits.push(traits[(t+1+Math.floor(g.rng()*3))%4]);
      if(e.traits.includes('Armored'))e.shield=Math.round(Math.round(standardHull)*.26);
    }
    g.enemies.push(e);return e;
  }
  function mitigate(g,e,value,attackAngle,element) {
    if(e.dead||(e.boss&&e.arrive>0))return 0;
    let factor=e.arrive>.33?.46:1;
    const frontal=Math.cos(attackAngle+Math.PI-e.a)>.42;
    if(!e.boss){
      if(e.id===1 && frontal && e.recover<=0 && e.stagger<=0)factor=.51;
      if(e.id===29 && e.recover<=0 && e.windup<=0 && e.stagger<=0)factor=.63;
      if(e.id===7 && e.windup>.12 && frontal && (e.loadDamage=(e.loadDamage||0)+value)>15){e.stagger=.95;e.windup=0;e.cd=2;e.loadDamage=0;g.fx(e.x,e.y,'#ffd372',9);}
      if(e.elite && e.stagger>.18)factor=1.19;
    }else if(e.interruptedUntil>g.time)factor=1.14;
    else if(e.recover>.16)factor=1.06;
    else if(e.id===6 && e.breakAnchors?.some(b=>b.life>0))factor=.63;
    if(e.shield>0) {
      const absorbed=Math.min(e.shield,value*factor);e.shield-=absorbed;
      if(e.shield<=0){e.stagger=Math.max(e.stagger,.55);g.fx(e.x,e.y,'#9ff7ff',9);}
      return Math.max(0,value*factor-absorbed);
    }
    return value*factor;
  }
  const maxShots=g=>Math.min(165,72+Math.max(1,g.stage)*8);
  function pushShot(g,b) {
    if(g.hostile.length<maxShots(g))g.hostile.push(b);
    else b.life=0;
  }
  function bullet(g,e,x,y,a,speed,extras={}) {
    const heavy=!!extras.heavy,r=heavy?5.4:3.5;
    speed*=1+.0065*Math.min(26,Math.max(0,(g.stage||1)-1));
    const start=extras.atOrigin?0:(Math.abs(x-e.x)+Math.abs(y-e.y)<1 ? e.r+3:0);
    const muzzle={x:x+Math.cos(a)*start,y:y+Math.sin(a)*start};
    if(!insideRoom(e.chamber,muzzle,r)||!clearLab(g,e,muzzle))return;
    pushShot(g,{...muzzle,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      r,life:5.7,age:0,heavy,shape:heavy?'diamond':'dot',color:e.def.color,damage:heavy?13:8,
      bossOwner:e.boss?e:null,chamber:e.chamber,split:e.traits.includes('Prismatic') && e.salvo%2===0 && !extras.curl, ...extras});
  }
  function fan(g,e,p,a,n=4,spread=.7,speed=141,opt={}) {
    for(let i=0;i<n;i++)bullet(g,e,p.x,p.y,a+(n===1?0:(i/(n-1)-.5)*spread),speed,opt);
  }
  function ring(g,e,p,count,speed,rot=0,gap=2,opt={}) {
    for(let i=gap;i<count;i++)bullet(g,e,p.x,p.y,rot+i*TAU/count,speed,opt);
  }
  function event(e,delay,fn){e.events.push({delay,fn});}
  function repeat(e,count,delay,fn){for(let i=0;i<count;i++)event(e,i*delay,()=>fn(i));}
  function zone(g,e,type,p,r,warn,duration,opt={}) {
    const b={kind:type,x:p.x,y:p.y,r,vx:0,vy:0,age:0,life:warn+duration,warn,duration,heavy:true,
      color:e.def.color,damage:12,owner:e,bossOwner:e.boss?e:null,chamber:e.chamber,period:0,fired:false,...opt};
    if(!insideRoom(e.chamber,p)||!clearLab(g,e,p)){b.life=0;b.hp=0;return b;}
    pushShot(g,b);return b;
  }
  function beam(g,e,from,to,warn=.76,duration=.24,thickness=7,opt={}) {
    if(e.chamber){
      // Clip both ends along the marked line so wall-edge attacks keep the same angle.
      const room=e.chamber,dx=to.x-from.x,dy=to.y-from.y;
      let lo=0,hi=1;
      for(const [start,delta,min,max] of [[from.x,dx,room.x+thickness,room.x+room.w-thickness],[from.y,dy,room.y+thickness,room.y+room.h-thickness]]){
        if(!delta){if(start<min||start>max)return;continue;}
        const enter=(min-start)/delta,leave=(max-start)/delta;
        lo=Math.max(lo,Math.min(enter,leave));hi=Math.min(hi,Math.max(enter,leave));
      }
      if(lo>=hi)return;
      to={x:from.x+hi*dx,y:from.y+hi*dy};from={x:from.x+lo*dx,y:from.y+lo*dy};
      // A clipped corner can be solid while the middle of the beam is clear.
      if(g.blocked(from.x,from.y,0)&&!g.blocked(to.x,to.y,0))from=clipLab(g,to,from);
    }
    to=clipLab(g,from,to);
    return zone(g,e,'beam',from,thickness,warn,duration,{x2:to.x,y2:to.y,damage:13,...opt});
  }
  function seed(g,e,p){return zone(g,e,'nest',p,10,.9,4.2,{hp:16,damage:0});}
  function emitter(g,e,p,r,kind='mouth',opt={}){return zone(g,e,kind,p,r,.6,2.2,{hp:20,damage:0,...opt});}
  function targetAlly(g,e) {
    let target=null,best=Infinity;
    for(const other of g.enemies){
      if(other===e || !living(other)||other.boss||other.arrive>0)continue;
      const dx=other.x-e.x,dy=other.y-e.y,d2=dx*dx+dy*dy;
      if(d2>=208*208||!clearLab(g,e,other))continue;
      const score=Math.sqrt(d2)+(other.hp/other.maxHp)*95-(other.elite?45:0);
      if(score<best){best=score;target=other;}
    }
    return target;
  }
  function nearestCorpse(g,e){
    let best=null,bestD=160;for(const p of field(g).corpses){const d=dist(e,p);if(d<bestD){best=p;bestD=d;}}return best;
  }
  function rememberDeath(g,e){if(e.deathSeen)return;e.deathSeen=true;field(g).corpses.push({x:e.x,y:e.y,time:g.time});}
  function segmentDistance(px,py,x1,y1,x2,y2) {
    const dx=x2-x1,dy=y2-y1;
    const t=clamp(((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy||1),0,1);
    return Math.hypot(px-x1-dx*t,py-y1-dy*t);
  }
  function lane(g,e,a,speed=100,offset=0,shift=0,count=9) {
    const nx=-Math.sin(a),ny=Math.cos(a);
    for(let i=-Math.floor(count/2);i<=Math.floor(count/2);i++){
      if(Math.abs(i-shift)<1.1)continue;
      const p=polar(e,a,offset+e.r+4);
      bullet(g,e,p.x+nx*i*18,p.y+ny*i*18,a,speed,{shape:'bar',heavy:true,r:4.5});
    }
  }
  function dash(e,a,speed,time,finish=''){e.dash={a,speed,time,finish,hit:new Set(),wake:0};}
  function fire(g,e){
    const t=aimPoint(g,e),a=e.lockA,p={x:e.tx,y:e.ty},now={x:e.x,y:e.y};
    e.salvo++;e.attackAge=0;e.recover=e.boss?.78:.44;e.pulse=.18;
    const shot=(ang=a,speed=147,opt={})=>bullet(g,e,e.x,e.y,ang,speed,opt);
    const direct=()=>shot(a,148);
    switch(e.def.attack){
      case 'bite':dash(e,a,e.id===38?202:171,.145,'bite');break;
      case 'burst':{
        const long=dist(e,t)>325,spread=long?.45:.82;
        // A slow screen leads two faster, alternating bursts through its gaps.
        fan(g,e,e,a-.055*e.turn,3,spread,155,{shape:'dart'});
        event(e,.17,()=>fan(g,e,e,a+.07*e.turn,2,spread*.48,182,{shape:'dart'}));
        event(e,.34,()=>shot(a,203,{shape:'dart'}));break;}
      case 'fan':{
        fan(g,e,e,a,7,1.18,147,{shape:'dart'});
        if(e.salvo%2===0)event(e,.37,()=>fan(g,e,e,a+.08*e.turn,4,.82,161,{shape:'dart'}));break;}
      case 'rail':{
        shot(a,410,{shape:'lance',heavy:true,r:3.3});
        if(e.elite||g.stage>=3)fan(g,e,e,a,2,.44,158,{shape:'dart'});break;}
      case 'mine':{
        zone(g,e,'mine',now,22,.95,6,{hp:12,damage:13});
        if(e.salvo%2===0){
          const recent=field(g).history.get(t)?.[1]||t;
          zone(g,e,'mine',floorPoint(g,recent.x,recent.y,7),21,1.15,4.6,{hp:12,damage:12});
        }break;}
      case 'tether':{
        const anchor=emitter(g,e,polar(e,a-1.03,26),6,'stake',{hp:14});
        zone(g,e,'sweep',now,72,.58,.85,{a:a-1.03,swing:2.1,damage:13,anchors:[anchor]});break;}
      case 'wall': lane(g,e,a,108,0,-1);event(e,.65,()=>lane(g,e,a,111,0,1));break;
      case 'sapper': dash(e,a+.69*e.turn,218,.46,'sapper');break;
      case 'crate': zone(g,e,'crate',p,27,.85,.22,{damage:15});break;
      case 'mortar': for(let i=-1;i<=1;i++)zone(g,e,'blast',polar(p,a+Math.PI/2,i*36),22,.75+(i+1)*.15,.21);break;
      case 'wake': dash(e,a,256,.78,'wake');break;
      case 'weld': case 'link': case 'supply': case 'phase': {
        const ally=targetAlly(g,e);if(!ally){fan(g,e,e,a,3,.51,137);break;}
        const kind=e.def.attack;
        if(kind==='phase'){
          const dest=floorPoint(g,t.x+Math.cos(e.post)*76,t.y+Math.sin(e.post)*76,ally.r);
          if(!clearLab(g,e,dest)||!clearLab(g,ally,dest)||g.blocked(dest.x,dest.y,ally.r))break;
          zone(g,e,'anchor',dest,19,1,.22,{damage:8});
          event(e,1,()=>{if(living(ally)&&clearLab(g,ally,dest)&&!g.blocked(dest.x,dest.y,ally.r)){g.fx(ally.x,ally.y,'#f8a8ff',7);ally.x=dest.x;ally.y=dest.y;ally.arrive=.38;}});
        }else{
          e.link=ally;e.linkTime=.8;
          event(e,.76,()=>{if(!living(ally)||dist(e,ally)>220||!clearLab(g,e,ally))return;
            if(kind==='weld')ally.hp=Math.min(ally.maxHp,ally.hp+Math.max(8,ally.maxHp*.19));
            if(kind==='link')ally.shield=Math.min(25,(ally.shield||0)+12);
            if(kind==='supply')ally.cd=Math.max(.26,ally.cd-1.4);
            g.fx(ally.x,ally.y,'#9fffd0',5);
          });
        }break;
      }
      case 'leap':dash(e,a,231,.43,'leap');break;
      case 'seedring':{
        ring(g,e,e,16,110,e.post+e.salvo*.35,3,{shape:'seed'});
        if(g.stage>=2)event(e,.28,()=>fan(g,e,e,a,4,.79,151,{shape:'seed'}));break;}
      case 'nest':{
        if(g.hostile.filter(b=>b.kind==='nest').length<3)seed(g,e,polar(e,a,e.r+13));else direct();
        if(g.stage>=2)fan(g,e,e,a,4,.82,133,{shape:'seed',curl:e.turn*.16});break;}
      case 'prong':dash(e,a,278,.51,'prong');break;
      case 'trail':{
        for(let i=0;i<3;i++)zone(g,e,'acid',polar(e,a+Math.PI,i*19),14,.57,2.65,{damage:7});
        fan(g,e,e,a,3,.72,108,{shape:'seed',curl:.19*e.turn});break;}
      case 'consume':{
        const body=nearestCorpse(g,e);if(body && dist(e,body)<75){e.hp=Math.min(e.maxHp,e.hp+11);body.time=-100;}
        fan(g,e,e,a,7,1.18,104,{shape:'seed',heavy:true,r:4});e.recover=.9;break;}
      case 'seedlines':{
        for(let j=0;j<2;j++)for(let i=-2;i<=2;i++)zone(g,e,'blast',polar(p,a+Math.PI/2,i*24+j*11),10,.61+j*.48,.19);
        fan(g,e,e,a,5,1.12,123,{shape:'seed'});break;}
      case 'ram':dash(e,a,300,.95,'ram');break;
      case 'burrow':{
        const dest=floorPoint(g,p.x,p.y,e.r);
        if(!clearLab(g,e,dest)||g.blocked(dest.x,dest.y,e.r))break;
        zone(g,e,'burrow',dest,26,.8,.22);
        event(e,.8,()=>{if(!clearLab(g,e,dest)||g.blocked(dest.x,dest.y,e.r))return;
          e.x=dest.x;e.y=dest.y;e.recover=.72;ring(g,e,e,10,89,a,3,{shape:'seed'});});break;}
      case 'pouch':{
        zone(g,e,'acid',now,23,.65,3.5);zone(g,e,'acid',polar(p,a+Math.PI/2,e.turn*27),18,1.0,2.6);
        fan(g,e,e,a,3,.65,139,{shape:'seed'});break;}
      case 'hooks':{
        for(const n of [-1,1]){
          shot(a+n*.61,145,{curl:-n*.89,shape:'hook'});
          shot(a+n*.34,169,{curl:-n*.33,shape:'hook'});
        }break;}
      case 'bank':{const corner=polar(e,a+.40*e.turn,76);shot(a+.40*e.turn,154,{turnAt:.49,turnTo:angle(corner,p),shape:'dart',bounce:1});break;}
      case 'echo':zone(g,e,'echo',p,28,.85,.24);break;
      case 'gate':for(const i of [-1,1]){const m=emitter(g,e,polar(e,a+Math.PI/2,i*54),9);event(e,.68+(i+1)*.24,()=>{if(m.life>0)fan(g,e,m,angle(m,t),7,1.13,147);});}break;
      case 'spiral':repeat(e,10,.13,i=>{for(let j=0;j<3;j++)shot(a-1.2+i*.24+j*TAU/3,116,{shape:'diamond'});});break;
      case 'stitch':{
        const left=polar(p,a+Math.PI/2,-83),right=polar(p,a+Math.PI/2,83);
        const m1=emitter(g,e,left,7,'stake'),m2=emitter(g,e,right,7,'stake');
        beam(g,e,left,polar(left,a+Math.PI/2,56),.88,.86,4,{anchors:[m1,m2]});
        beam(g,e,right,polar(right,a-Math.PI/2,65),.88,.86,4,{anchors:[m1,m2]});break;}
      case 'chord':repeat(e,3,.22,i=>fan(g,e,e,a+(i-1)*.13,i===1?3:5,.76,153));e.recover=1.0;break;
      case 'echoes':for(const pos of [e.memory[0],e.memory[e.memory.length-1]].filter(Boolean)){zone(g,e,'glyph',pos,8,.36,.24,{damage:0});event(e,.42,()=>fan(g,e,pos,angle(pos,t),5,.82,146));}break;
      case 'halo':for(let i=0;i<3;i++){const pos=polar(e,e.post+i*TAU/3,55),s=emitter(g,e,pos,7,'stake');beam(g,e,pos,polar(pos,angle(pos,p),130),.99,.52,3.6,{anchors:[s]});}break;
      case 'switchback':dash(e,a+.45*e.turn,223,.43,'switch1');break;
      case 'null': zone(g,e,'null',p,24,.76,2.45,{damage:0});fan(g,e,e,a,3,1.04,136);break;
      case 'pane':{
        const pos=polar(e,a,47),pane=emitter(g,e,pos,17,'pane',{a:a+Math.PI/2,turnTo:a+.42*e.turn});
        for(let i=-1;i<=1;i++)shot(a+i*.13,135,{turnAt:.36,turnTo:a+.42*e.turn+i*.13,shape:'dart',pane});break;}
    }
    if(e.traits.includes('Foreman')){
      const ally=targetAlly(g,e);if(ally)ally.cd=Math.max(.4,ally.cd-.5);
    }
    if(g.stage>=2&&!e.def.fodder)requestCover(g,e,t);
  }
  function requestCover(g,e,target) {
    const f=field(g);if(g.time<(f.nextCover||0))return;
    for(const ally of g.enemies){
      if(ally===e||!living(ally)||ally.boss||ally.arrive>0||ally.stun>0||ally.stagger>0||ally.dash||!responders.has(ally.id))continue;
      if(dist(e,ally)>355||dist(ally,target)>700)continue;
      const lane=firingLane(g,ally,target);if(!lane)continue;
      const aim=angle(ally,lane)+ally.turn*.07;
      ally.coverA=aim;ally.coverTime=.57;
      f.nextCover=g.time+Math.max(1.65,3.5-g.stage*.20);
      event(ally,.57,()=>{
        ally.coverTime=0;
        if(!clearLab(g,ally,target))return;
        fan(g,ally,ally,aim,g.stage>=4?6:4,.82,151,{shape:ally.id<12?'dart':ally.id<24?'seed':'diamond'});
      });
      break;
    }
  }
  function bossFire(g,e,p,a) {
    const phase=e.phase,s=e.salvo,d=w=>({heavy:true,shape:w});
    const socket=(at,pad=12)=>arenaPoint(g,e,at,pad);
    const emit=(w,h,offset)=>{const x=socket(polar(e,a+Math.PI/2,offset),7);fan(g,e,x,angle(x,p),w,1.11,h,d('diamond'));};
    const rays=(count,curl,offset=0,speed=119)=>repeat(e,count,.13,i=>{
      bullet(g,e,e.x,e.y,a+offset+i*curl,speed,{shape:'seed',curl:curl*.27});
      bullet(g,e,e.x,e.y,a+Math.PI+offset+i*curl,speed,{shape:'seed',curl:curl*.27});
    });
    const stamp=(count,span,delay=.23)=>{for(let i=0;i<count;i++){
      const center=polar(p,a+Math.PI/2,(i-(count-1)/2)*span);
      const start=polar(center,a,112),end=polar(center,a+Math.PI,112);
      beam(g,e,start,end,.87+i*delay,.21,7.7,{color:'#ff9f67'});
    }};
    const dish=(side,rot=0)=>{
      const at=socket(polar(e,a+Math.PI/2,side*82));
      const m=emitter(g,e,at,10,'mouth',{hp:30});
      event(e,.76+(side>0?.35:0),()=>{if(m.life>0)fan(g,e,m,angle(m,p)+rot,7,1.3,134,{shape:'dart'});});
    };
    const brokenRing=(n,rot,speed=103)=>ring(g,e,e,n,speed,rot,3,{heavy:true,r:4.6});
    const fitting=(kind,side,hp,life)=>{
      const r=kind==='core'?9:7;
      const at=socket({x:e.x+side*(e.id===0?22:32),y:e.y+(e.id===0?-6:-8)},r);
      return zone(g,e,kind,at,r,.16,life,{hp,damage:0,dx:at.x-e.x,dy:at.y-e.y});
    };
    switch(e.id){
      case 0:
        if(phase===1)repeat(e,3,.33,i=>fan(g,e,e,a+(i-1)*.11,5,.89,138+i*6,{shape:'dart'}));
        if(phase===2){lane(g,e,a,112,0,-1,13);fitting('core',Math.cos(a)<0?1:-1,Infinity,1.65);event(e,.72,()=>lane(g,e,a,118,0,1,13));e.recover=1.35;}
        if(phase===3){brokenRing(21,a+s*.29);event(e,.63,()=>brokenRing(21,a+.27+s*.29,112));}
        break;
      case 1:
        if(phase===1){
          const missing=3-g.hostile.filter(x=>x.kind==='nest').length;
          for(let i=0;i<missing;i++){const d=e.post+(s+i)*TAU/3,at=socket(polar(e,d,63));seed(g,e,floorPoint(g,at.x,at.y,10,false,e.chamber));}
          fan(g,e,e,a,7,1.5,120,{shape:'seed'});
        }
        if(phase===2){rays(10,.24,-1);event(e,.4,()=>fan(g,e,e,a+.67,3,.28,128,{curl:-.65,shape:'hook'}));}
        if(phase===3){
          const center=e.chamber?insideBounds(e.chamber,p,119):{x:clamp(p.x,110,width(g)-110),y:clamp(p.y,105,height(g)-105)};
          for(let i=3;i<18;i++){
            const at=socket(polar(center,s*.36+i*TAU/18,106),5);
            const glyph=zone(g,e,'glyph',at,5,.82,.16,{damage:0});
            if(glyph.life>0)event(e,.81,()=>bullet(g,e,at.x,at.y,angle(at,center),72,{life:1.14,shape:'seed'}));
          }fan(g,e,e,a,3,.79,105,{shape:'seed'});
        }break;
      case 2:
        if(phase===1){stamp(3,46);fitting('core',s%2?1:-1,Infinity,1.3);event(e,.34,()=>emit(6,143,e.turn*29));}
        if(phase===2){for(let i=-1;i<=1;i++){const at=socket(polar(p,a+Math.PI/2,i*48),22);zone(g,e,'ingot',at,22,.88+Math.abs(i)*.18,.19);
          const blast=zone(g,e,'blast',socket(polar(at,a,35),19),19,1.55+Math.abs(i)*.18,.19);
          if(i===0&&blast.life>0)event(e,1.54,()=>ring(g,e,blast,13,108,a,3,{shape:'diamond'}));}
        }
        if(phase===3){lane(g,e,a,115,0,-2,17);event(e,.76,()=>lane(g,e,a,114,0,0,17));event(e,1.45,()=>lane(g,e,a,114,0,2,17));}
        break;
      case 3:
        if(phase===1){
          const decoy=socket(polar(e,a+Math.PI/2,55*e.turn),15);
          zone(g,e,'glyph',decoy,15,.67,.24,{damage:0});
          for(let i=-2;i<=2;i++)beam(g,e,decoy,polar(decoy,a+i*.23,130),.5,.12,1,{damage:0});
          event(e,.86,()=>fan(g,e,e,a,7,1.38,155,{shape:'lance'}));
        }
        if(phase===2){
          const a1=polar(p,a+.5,130),a2=polar(p,a+Math.PI+.5,130);
          beam(g,e,a1,a2,.87,.40,6);const p2=polar(p,a+Math.PI/2,46);beam(g,e,polar(p2,a,98),polar(p2,a+Math.PI,98),1.36,.43,5);
          event(e,.38,()=>emit(6,129,50*e.turn));
        }
        if(phase===3)for(let i=0;i<3;i++){const at=i===0?e:socket(polar(e,a+Math.PI/2,i===1?-68:68),11);
          if(i&&zone(g,e,'glyph',at,11,.65+i*.25,.3,{damage:0}).life<=0)continue;
          event(e,.5+i*.25,()=>ring(g,e,at,11,100,a+i*.4,3,{shape:'diamond'}));}
        break;
      case 4:
        if(phase===1){dish(-1);dish(1);brokenRing(19,a+.51*s,97);}
        if(phase===2){
          for(const side of [-1,1]){const p2=polar(p,a+Math.PI/2,side*39);beam(g,e,polar(p2,a,107),polar(p2,a+Math.PI,107),.95,1.25,9);}
          event(e,.66,()=>fan(g,e,e,a-.42,5,.82,117,{shape:'hook',curl:.30}));
          event(e,1.0,()=>fan(g,e,e,a+.42,5,.82,126,{shape:'hook',curl:-.30}));}
        if(phase===3){zone(g,e,'sweep',e,165,.88,1.15,{a:a-1.1,swing:1.94,damage:15});
          brokenRing(17,a-.55,108);event(e,1.36,()=>rays(12,.23,-.8));e.recover=1.24;}
        break;
      case 5:
        fitting('piston',s%2?1:-1,24,2);
        if(phase===1){stamp(2,55);event(e,.64,()=>emit(6,135,54*e.turn));}
        if(phase===2){emit(5,130,-49);event(e,.55,()=>emit(7,132,52));stamp(1,0);}
        if(phase===3){
          const gap=polar(p,a+Math.PI/2,Math.sin(s)*32);
          for(const side of [-1,1])beam(g,e,polar(gap,a+Math.PI/2,side*18),polar(gap,a+Math.PI/2,side*116),.86,.55,6);
          event(e,.78,()=>lane(g,e,a,110,0,e.turn*2,13));
        }
        break;
      case 6:
        if(phase===1){dish(-1,.10);dish(1,-.10);fan(g,e,e,a,4,.7,110,{shape:'seed',curl:.38*e.turn});}
        if(phase===2){
          for(const side of [-1,1]){
            const anchor=emitter(g,e,socket(polar(e,a+Math.PI/2,side*61)),12,'limb',{hp:26,life:4.5});
            e.breakAnchors=(e.breakAnchors||[]).filter(b=>b.life>0);e.breakAnchors.push(anchor);
            event(e,1,()=>{if(anchor.life>0)fan(g,e,anchor,angle(anchor,p),4,.8,135,{shape:'seed'});});
          }
        }
        if(phase===3){rays(11,.26,-.8,106);event(e,.52,()=>rays(9,-.25,.88,105));}
        break;
    }
    if(g.stage>=10 && ![5,6].includes(e.id) && s%3===0)event(e,1.12,()=>fan(g,e,e,a+e.turn*.41,3,.53,125));
  }
  function signatureTools(g,e,pilot,token){
    const room=e.chamber||{x:0,y:0,w:width(g),h:height(g),center:{x:width(g)/2,y:height(g)/2}};
    const at=(p,pad=12)=>arenaPoint(g,e,insideBounds(room,p,pad),pad);
    const tag={signatureId:e.attackSerial,signatureName:e.attackName,castToken:token,
      warningPilot:pilot,targetIndex:Math.max(0,pilots(g).indexOf(pilot))};
    const delayOf=n=>clamp(n,.60,3.5);
    const count=b=>{
      if(b?.life>0){token.count++;token.last=Math.max(token.last,b.warn);}
      return b;
    };
    const local=(p,r=0)=>dist(p,pilot)<275+r&&clearLab(g,pilot,p);
    function muzzle(from,angles,speed,delay,options){
      if(token.count>=14||angles.length===0)return;
      const origin=at(from,9);
      // A remote boss must place its firing socket inside this pilot's light.
      // A socket halfway across the map cannot substitute for a local warning.
      if(!local(origin))return;
      const velocity=clamp(speed,75,270),heavy=!!options.heavy,shotRadius=clamp(options.r??(heavy?5.4:3.5),2.5,6);
      const shotLifetime=clamp(options.life??4.1,.45,5);
      const shotCurl=clamp(options.curl||0,-1.5,1.5);
      count(zone(g,e,'muzzle',origin,8,delayOf(delay),.09,{...tag,angles,reach:36,velocity,shotRadius,shotLifetime,shotCurl,
        shotSpeed:velocity*(1+.0065*Math.min(26,Math.max(0,(g.stage||1)-1))),damage:0,
        shotOptions:{heavy,r:shotRadius,life:shotLifetime,curl:shotCurl,shape:options.shape||(heavy?'diamond':'dart'),
          damage:clamp(options.damage??(heavy?14:10),5,21),atOrigin:true}}));
    }
    return {
      room,phase:e.phase,turn:e.turn,point:at,angle,offset:polar,
      warnLine(from,to,delay,duration=.24,r=6,damage=13){
        if(token.count>=14)return;r=clamp(r,2,15);
        if(segmentDistance(pilot.x,pilot.y,from.x,from.y,to.x,to.y)>272+r)return;
        count(beam(g,e,from,to,delayOf(delay),clamp(duration,.12,1.45),r,{...tag,damage:clamp(damage,3,24)}));
      },
      warnDisk(center,r,delay,duration=.22,damage=14){
        if(token.count>=14)return;r=clamp(r,7,88);
        const p=at(center,r);
        if(!local(p,r))return;
        count(zone(g,e,'blast',p,r,delayOf(delay),clamp(duration,.12,1.45),{...tag,damage:clamp(damage,3,24)}));
      },
      volley(from,a,n,spread,speed,delay,options={}){
        n=clamp(Math.round(n),1,24);
        muzzle(from,Array.from({length:n},(_,i)=>a+(n===1?0:(i/(n-1)-.5)*spread)),speed,delay,options);
      },
      ring(from,a,n,gap,speed,delay,options={}){
        n=clamp(Math.round(n),4,24);gap=clamp(Math.ceil(gap),1,n-1);
        muzzle(from,Array.from({length:n-gap},(_,i)=>a+(i+gap)*TAU/n),speed,delay,options);
      }
    };
  }
  function cancelBossCast(e){
    if(e.castToken)e.castToken.cancelled=true;
    if(e.interceptToken)e.interceptToken.cancelled=true;
    e.interceptToken=null;
    e.castToken=null;e.windup=0;e.events.length=0;e.volleyTarget=null;
    e.signatureIndex=null;e.attackName=null;e.attackRemote=false;
  }
  // Read two measured strides. Erratic speed, a sharp turn, or a dash breaks
  // the read. Once the floor is marked, no further pilot input changes it.
  function readCourse(g,p,delay){
    const samples=field(g).history.get(p);
    if(!samples||samples.length<6||p.dashTime>0)return null;
    const a=samples.at(-6),b=samples.at(-3),t0=b.time-a.time,t1=g.time-b.time;
    if(t0<=.12||t1<=.12)return null;
    const vx=(p.x-b.x)/t1,vy=(p.y-b.y)/t1;
    const ux=(b.x-a.x)/t0,uy=(b.y-a.y)/t0;
    const v=Math.hypot(vx,vy),u=Math.hypot(ux,uy),bearing=Math.atan2(vy,vx);
    if(Math.max(v,u)<22)return {x:p.x,y:p.y,heading:p.a||0};
    if(Math.min(v,u)<72||Math.abs(v-u)>38||Math.max(v,u)>250)return null;
    const turn=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy)*2/(t0+t1);
    if(Math.abs(turn)>1.85)return null;
    const heading=bearing+turn*t1/2,end=heading+turn*delay;
    if(Math.abs(turn)<.06)return {...polar(p,heading,v*delay),heading};
    return {x:p.x+v*(Math.sin(end)-Math.sin(heading))/turn,
      y:p.y+v*(Math.cos(heading)-Math.cos(end))/turn,heading:end};
  }
  function markCourse(g,e){
    if(!e.attackSerial||g.time<(e.nextIntercept||0))return;
    e.nextIntercept=g.time+.28;
    const delay=.99-.065*(e.phase-1),token={count:0,last:0,cancelled:false},placed=[];
    for(const p of pilots(g)){
      if(!active(p)||!insideRoom(e.chamber,p)||!clearLab(g,e,p))continue;
      const predicted=readCourse(g,p,delay);
      if(!predicted)continue;
      const api=signatureTools(g,e,p,token),spot=api.point(predicted,36);
      if(dist(spot,predicted)>37||placed.some(other=>dist(other,spot)<110))continue;
      const count=token.count,damage=16+e.phase*2;
      if(e.id===0||e.id===3||e.id===5){
        const across=predicted.heading+Math.PI/2+(e.id===3?.29:0);
        const half=e.id===5?84:59;
        api.warnLine(polar(spot,across,-half),polar(spot,across,half),delay,.28,9,damage);
      }else{
        api.warnDisk(spot,e.id===2?43:e.id===6?38:32,delay,e.id===4?.20:.31,damage);
      }
      if(token.count>count)placed.push(spot);
    }
    if(token.count){
      e.interceptToken=token;
      e.nextIntercept=g.time+4.5-.42*(e.phase-1);
    }
  }
  function chooseBossMove(g,e,target){
    if(!clearLab(g,e,target))return false;
    const book=window.BossPatterns?.[e.id],moves=book?.moves||[];
    const nearby=!g.map?.lab||(dist(e,target)<=290&&clearLab(g,target,e));
    // Cycle through every available signature and the current phase's original
    // attack. Each phase opens with a different entry; far casts skip body tells.
    const deck=Array.from({length:moves.length},(_,i)=>i).filter(i=>(moves[i].minPhase||1)<=e.phase);
    if(deck.length)deck.splice(1,0,-1);else deck.push(-1);
    const start=e.patternCursor??(e.phase-1);
    for(let n=0;n<deck.length;n++){
      const offset=(start+n)%deck.length,index=deck[offset],spec=index<0?null:moves[index];
      if(!nearby&&!spec?.remote)continue;
      e.attackSerial=(e.attackSerial||0)+1;e.volleyTarget=target;e.attackTarget=target;
      e.signatureIndex=spec?index:null;e.attackRemote=!!spec?.remote;
      e.attackName=spec?spec.name:e.def.phases[e.phase-1];e.tx=target.x;e.ty=target.y;e.a=e.lockA=angle(e,target);
      let tell=.84-.045*(e.phase-1);
      if(spec){
        const token={count:0,last:0,cancelled:false};e.castToken=token;
        const history=field(g).history.get(target)||[],old=history[Math.max(0,history.length-3)];
        const age=old?Math.max(.1,g.time-old.time):1;
        const locked=Object.freeze({x:target.x,y:target.y,vx:old?clamp((target.x-old.x)/age,-210,210):0,
          vy:old?clamp((target.y-old.y)/age,-210,210):0});
        book.cast(index,g,e,locked,signatureTools(g,e,target,token));
        if(!token.count){cancelBossCast(e);continue;}
        tell=clamp(Math.max(spec.tell||.8,token.last),.60,3.6);
        e.nextRecovery=clamp(spec.recovery??.47,.24,.85);
      }else{e.castToken=null;e.nextRecovery=.55;}
      e.windup=e.windMax=tell;e.patternCursor=(offset+1)%deck.length;e.attackAge=0;
      g.sound('boss-windup',e.id);return true;
    }
    return false;
  }
  function stepBoss(g,e,t,dt){
    const phase=e.hp/e.maxHp>2/3?1:e.hp/e.maxHp>1/3?2:3;
    if(phase!==e.phase){
      cancelBossCast(e);
      for(const b of g.hostile)if(b.bossOwner===e)b.life=0;
      for(const p of pilots(g))if(active(p)&&p.stats?.['Clean Escape'])p.dashCharges=Math.min(2,p.dashCharges+1);
      e.phase=phase;e.patternCursor=phase-1;e.cd=.44;e.recover=.28;e.turn*=-1;
      e.stagger=0;e.stun=0;e.interruptedUntil=0;e.breakAnchors=null;
      g.fx(e.x,e.y,e.def.color,19);g.sound('boss-phase',phase);
    }
    if(e.volleyTarget&&(!active(e.volleyTarget)||!insideRoom(e.chamber,e.volleyTarget))){
      cancelBossCast(e);e.cd=.28;
    }
    if(t===e||!active(t)){
      if(e.windup||e.events.length||e.castToken)cancelBossCast(e);
      e.cd=Math.max(.3,e.cd);return;
    }
    const anchorBreak=e.breakAnchors?.some(b=>b.hp<=0);
    if(anchorBreak||(g.time>=(e.breakGuardUntil||0)&&(e.stagger>.2||e.stun>.1))){
      const duration=anchorBreak?.94:clamp(Math.max(e.stagger,e.stun),.34,.74);
      cancelBossCast(e);e.interruptedUntil=g.time+duration;e.breakGuardUntil=g.time+2.65;
      e.cd=.30;e.kx*=.35;e.ky*=.35;
      if(anchorBreak){
        e.breakAnchors=null;zone(g,e,'core',e,11,.12,1.35,{hp:Infinity,damage:0,dx:0,dy:-4});g.fx(e.x,e.y,'#ffeac0',10);
      }
    }
    e.stun=0;e.stagger=Math.max(0,(e.interruptedUntil||0)-g.time);
    shoveMotion(g,e,dt);
    if(e.stagger>0)return;
    markCourse(g,e);
    for(let i=e.events.length-1;i>=0;i--){const item=e.events[i];item.delay-=dt;if(item.delay<=0){e.events.splice(i,1);item.fn();}}
    walk(g,e,dt,t);
    if(e.windup>0){
      if(e.signatureIndex==null&&!canTelegraph(g,e,t)){cancelBossCast(e);e.cd=.18;return;}
      e.windup=Math.max(0,e.windup-dt);e.a=e.lockA;
      if(e.windup>0)return;
      e.salvo++;e.pulse=.22;e.recover=e.nextRecovery;
      if(e.signatureIndex==null)bossFire(g,e,{x:e.tx,y:e.ty},e.lockA);
      e.recover=Math.min(.85,e.recover);e.cd=(.53-.105*(phase-1))*(.95+.1*g.rng());return;
    }
    e.a=angle(e,t);e.cd-=dt;
    if(e.cd>0||e.recover>0||e.events.length)return;
    if(!chooseBossMove(g,e,bossVolleyTarget(g,e,t)))e.cd=.16;
  }
  function clearLab(g,from,to) {
    return !g.map?.lab || window.Labyrinth.clearLine(g.map.lab,from,to);
  }
  function canTelegraph(g,e,t){
    return !g.map?.lab || (window.Sight.canSee(g,e.x,e.y)&&clearLab(g,e,t));
  }
  function clipLab(g,from,to){
    if(clearLab(g,from,to))return to;
    let lo=0,hi=1;
    const along=t=>({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});
    for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clearLab(g,from,along(mid)))lo=mid;else hi=mid;}
    return along(lo);
  }
  function canSee(g,e,t) {
    if(g.map?.lab)return clearLab(g,e,t);
    const d=dist(e,t),steps=Math.ceil(d/22);
    for(let i=1;i<steps;i++){const f=i/steps;if((g.shotBlocked||g.blocked)(e.x+(t.x-e.x)*f,e.y+(t.y-e.y)*f,1))return false;}
    return true;
  }
  function choosePost(g,e,t) {
    const from=angle(t,e),w=width(g),h=height(g),beh=e.boss?'boss':e.def.move;
    const range=e.boss?(e.id===6?171:156):e.def.range;
    const rotate=Math.sin(g.time*.68+e.post);
    if(e.chase)return e.chase;
    const lastDash=field(g).lastDash.get(t);
    if(!e.boss && e.id===23 && lastDash && g.time-lastDash.time<2.7){
      return polar(lastDash,lastDash.a+e.turn*.75,79);
    }
    let direction=from,d=range;
    switch(beh){
      case 'post':direction=from+e.turn*(Math.sin(e.salvo+e.post)*.56);break;
      case 'pursue':break;
      case 'pack':{
        const approach=clamp((dist(e,t)-33)/80,0,1);
        direction=from+e.turn*(.52+approach*.65);
        d+=approach*(30+e.serial%4*6);break;}
      case 'skitter':{
        const approach=clamp((dist(e,t)-32)/68,0,1);
        direction=from+rotate*approach*.91;d+=approach*32;break;}
      case 'pivot':if(dist(e,t)<235)return e;break;
      case 'advance':direction=from+.15*rotate;break;
      case 'retreat':direction=from+rotate*.39;break;
      case 'orbit':direction=from+e.turn*.74;break;
      case 'strafe':direction=from+.68*Math.sin(g.time*.89+e.post);break;
      case 'flank':direction=from+e.turn*.56;break;
      case 'melee':direction=Math.round((from+.34*rotate)/(TAU/10))*TAU/10;break;
      case 'burrow':direction=from+rotate*.31;break;
      case 'chord':case 'beat':direction=from+rotate*.42;break;
      case 'scavenge':{const corpse=nearestCorpse(g,e);if(corpse)return corpse;break;}
      case 'support':{
        const friend=targetAlly(g,e);if(friend)return polar(friend,angle(t,friend)+e.turn*.52,31);direction=from+.41*rotate;break;}
      case 'edge':direction=from+e.turn*.76;d=Math.min(210,range+22*rotate);break;
      case 'boss':direction=from+e.turn*(e.id===6?.76:.46);d+=Math.sin(g.time*.7)*24;break;
    }
    const at=polar(t,direction,d);
    if(e.chamber)return insideBounds(e.chamber,at,e.r+9);
    return {x:clamp(at.x,26,w-26),y:clamp(at.y,52,h-26)};
  }
  function corridorTurn(g,e,t){
    const lab=g.map.lab,r=e.route||(e.route={});
    // Share the labyrinth's destination field and keep steering toward its next turn
    // between planning ticks. The body still collides and combat checks sight every tick.
    if(r.target===t&&g.time<r.until&&r.open===lab.door.open&&
      (t.x-r.x)**2+(t.y-r.y)**2<22*22&&(!r.point||r.point===e||dist(e,r.point)>10))return r.point;
    r.target=t;r.x=t.x;r.y=t.y;r.open=lab.door.open;
    r.until=g.time+.11+(e.serial%5)*.012;
    r.point=clearLab(g,e,t)?null:window.Labyrinth.waypoint(lab,e,t);
    return r.point;
  }
  function walk(g,e,dt,t) {
    let speed=e.boss?35:e.def.speed;
    if(e.boss && e.id===1 && e.phase===3)speed=58;
    if(e.boss){
      const d=dist(e,t);
      speed=d>295?146+e.phase*7:d>223?91+e.phase*8:51+e.phase*6;
    }
    if(e.def.move==='skitter')speed*=(g.time+e.serial*.213)%.83<.32?1.48:.66;
    if(e.def.move==='beat' && (g.time+e.post)%.92>.43)speed=0;
    if(e.def.move==='chord' && (e.recover>0 || e.windup>0))speed=0;
    speed*=clamp(Number.isFinite(e.combatSlow)?e.combatSlow:1,.02,1.35);
    if(e.windup>0 || e.recover>0)speed*=e.boss?(e.signatureIndex!=null?.53:.17):.12;
    if(e.stagger>0 || e.stun>0)speed=0;
    const lab=g.map?.lab;
    let dest=lab?corridorTurn(g,e,t):null;
    if(!dest){
      dest=choosePost(g,e,t);
      if(lab&&(g.blocked(dest.x,dest.y,e.r)||!clearLab(g,e,dest))){
        dest=dist(e,t)>(e.boss?156:e.def.range)?t:e;
      }
    }
    let vx=dest.x-e.x,vy=dest.y-e.y;
    if(!lab&&!e.chase && e.def.move!=='melee' && !canSee(g,e,t)){vx=t.x-e.x;vy=t.y-e.y;}
    const len=Math.hypot(vx,vy);
    let A=Math.atan2(vy,vx);
    const test=Math.max(13,speed*dt+7);
    if(g.blocked(e.x+Math.cos(A)*test,e.y+Math.sin(A)*test,e.r)){
      const options=[.43,-.43,.82,-.82,1.24,-1.24,1.65,-1.65,2.05,-2.05];
      const turn=options.find(offset=>!g.blocked(e.x+Math.cos(A+offset*e.turn)*test,e.y+Math.sin(A+offset*e.turn)*test,e.r));
      if(turn!==undefined)A+=turn*e.turn;else speed=0;
    }
    const step=Math.min(speed*dt,len);
    if(step>.03){moveEnemy(g,e,Math.cos(A)*step,Math.sin(A)*step);e.walk+=step*.14;}
  }
  function collideBodies(g,dt,units) {
    for(let i=0;i<units.length;i++){
      const e=units[i];
      if(e.arrive>.5)continue;
      for(let j=i+1;j<units.length;j++){
        const other=units[j];if(other.arrive>.5)continue;
        const dx=other.x-e.x,min=e.r+other.r+(e.def.fodder&&other.def.fodder?2:6);
        // Most pairs in a wave occupy different lanes. Keep contact resolution in spawn order
        // so chains of knockback still propagate through tightly packed units in the same tick.
        if(dx>=min||dx<=-min)continue;
        const dy=other.y-e.y,d2=dx*dx+dy*dy;
        if(d2>=min*min)continue;
        const d=Math.sqrt(d2);
        const nx=d>.01?dx/d:Math.cos(e.post),ny=d>.01?dy/d:Math.sin(e.post);
        const reaction=Math.min(10,(min-d)*Math.min(1,dt*9));
        const share=other.mass/(e.mass+other.mass);
        moveEnemy(g,e,-nx*reaction*share,-ny*reaction*share);moveEnemy(g,other,nx*reaction*(1-share),ny*reaction*(1-share));
        const force=(e.kx-other.kx)*nx+(e.ky-other.ky)*ny;
        if(d<min-2 && force>85 && e.impactHold<=0 && other.impactHold<=0){
          const a=Math.atan2(ny,nx),first=Math.hypot(e.kx,e.ky)>Math.hypot(other.kx,other.ky);
          const hit=first?other:e,source=first?e:other,hitAngle=first?a:a+Math.PI;
          if((source.chainDepth||0)<2){
            const push=Math.min(109,force*.37);
            g.hurtEnemy(hit,Math.min(7,force*.025),hitAngle,push,'impact');
            hit.chainDepth=(source.chainDepth||0)+1;hit.stagger=Math.max(hit.stagger,.15);
          }
          source.kx*=.59;source.ky*=.59;source.impactHold=.22;hit.impactHold=.07;
        }
      }
    }
  }
  function shoveMotion(g,e,dt) {
    const speed=Math.hypot(e.kx,e.ky);if(speed<2){e.kx=0;e.ky=0;e.chainDepth=0;return;}
    const x=e.x,y=e.y;moveEnemy(g,e,e.kx*dt,e.ky*dt);
    if(speed>106 && e.impactHold<=0 && Math.hypot(e.x-x,e.y-y)<speed*dt*.53){
      e.impactHold=.35;g.hurtEnemy(e,Math.min(8,speed*.027),0,0,'impact');g.fx(e.x,e.y,'#f2c68c',6);
      e.kx*=-.26;e.ky*=-.26;e.stagger=Math.max(e.stagger,.20);
    }
    const drag=Math.exp(-7*dt);e.kx*=drag;e.ky*=drag;
  }
  function runDash(g,e,dt) {
    const d=e.dash,x=e.x,y=e.y;moveEnemy(g,e,Math.cos(d.a)*d.speed*dt,Math.sin(d.a)*d.speed*dt);
    d.time-=dt;d.wake-=dt;e.a=d.a;e.walk+=dt*15;
    for(const p of pilots(g)){
      if(active(p)&&insideRoom(e.chamber,p)&&!d.hit.has(p)&&dist(e,p)<e.r+(p.hitR??p.r)+1&&clearLab(g,e,p)){
        hurtPilot(g,p,d.finish==='bite'?4:d.finish==='ram'?16:10);d.hit.add(p);
      }
    }
    if(['wake','switch1','switch2','switch3','switch4'].includes(d.finish) && d.wake<=0){d.wake=.16;zone(g,e,'spark',{x,y},7,.19,.71,{damage:7});}
    if(d.time>0 && Math.hypot(e.x-x,e.y-y)>d.speed*dt*.26)return;
    e.dash=null;e.recover=d.finish==='bite'?.38:.6;
    if(d.finish==='sapper')fan(g,e,e,angle(e,aimPoint(g,e)),5,.82,161);
    if(d.finish==='prong')fan(g,e,e,d.a,3,.87,132,{shape:'seed'});
    if(d.finish==='ram'){ring(g,e,e,13,115,d.a,3,{shape:'seed'});e.stagger=.66;g.fx(e.x,e.y,e.def.color,9);}
    if(d.finish==='leap')g.fx(e.x,e.y,e.def.color,5);
    if(d.finish==='switch1')dash(e,d.a-.94*e.turn,235,.41,'switch2');
    if(d.finish==='switch2')dash(e,d.a+Math.PI,210,.38,'switch3');
    if(d.finish==='switch3')dash(e,d.a+.94*e.turn,210,.41,'switch4');
  }
  function startTell(g,e,t) {
    let delay=e.boss?.97:.61;
    const type=e.def.attack;
    if(type==='rail')delay=1.03;
    if(['ram','burrow','crate','stitch','wall'].includes(type))delay=.82;
    if(type==='leap')delay=.50;
    if(type==='bite')delay=.30+e.serial%3*.04;
    e.windup=delay;e.windMax=delay;e.tx=t.x;e.ty=t.y;e.lockA=angle(e,t);e.a=e.lockA;e.loadDamage=0;
    if(type==='echo'){const history=field(g).history.get(t)||[],at=history[Math.max(0,history.length-5)]||t;e.tx=at.x;e.ty=at.y;}
    if(type==='rail'||e.boss)g.sound(type==='rail'?'lock':'alarm',e.id);
  }
  function firingLane(g,e,t) {
    if(!canTelegraph(g,e,t))return null;
    const d=dist(e,t),a=angle(e,t),history=field(g).history.get(t);
    if(history?.length>=4 && ['burst','sapper','fan','wall','hooks','bank','pane'].includes(e.def.attack)){
      const past=history[history.length-4],dx=t.x-past.x,dy=t.y-past.y;
      const lead=Math.min(1.55,59/Math.max(1,Math.hypot(dx,dy)))*(e.serial%3===0?.40:1);
      const ahead={x:t.x+dx*lead,y:t.y+dy*lead};
      if(!g.blocked(ahead.x,ahead.y,3)&&canSee(g,e,ahead))return ahead;
    }
    if(canSee(g,e,t))return t;
    // Cover still stops bullets. Foes on the far side can cover an exit if it
    // has a clear line, rather than all crowding around the same corner.
    if(d>225 && covering.has(e.def.attack)){
      for(const lateral of [43,-43,85,-85,130,-130]){
        const edge=polar(t,a+Math.PI/2,lateral*e.turn);
        if(!g.blocked(edge.x,edge.y,2)&&canSee(g,e,edge))return edge;
      }
    }
    return null;
  }
  function stepEnemy(g,e,dt) {
    if(!living(e)){rememberDeath(g,e);return;}
    const t=aimPoint(g,e);
    e.arrive=Math.max(0,e.arrive-dt);e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);
    e.stagger=Math.max(0,e.stagger-dt);e.impactHold=Math.max(0,e.impactHold-dt);
    e.attackAge+=dt;e.recover=Math.max(0,e.recover-dt);e.pulse=Math.max(0,e.pulse-dt);
    if(e.coverTime>0)e.coverTime=Math.max(0,e.coverTime-dt);
    if(e.linkTime>0)e.linkTime-=dt;else e.link=null;
    if(e.arrive>0)return;
    if(e.boss){stepBoss(g,e,t,dt);return;}
    if(e.chamber){
      if(e.windup>0&&e.volleyTarget&&!insideRoom(e.chamber,e.volleyTarget)){e.windup=0;e.cd=.38;}
      if(t===e){e.events.length=0;e.dash=null;e.windup=0;e.cd=Math.max(.4,e.cd);e.volleyTarget=null;return;}
    }
    if(e.traits.includes('Overgrown') && !e.planted && e.hp<e.maxHp*.52){seed(g,e,polar(e,e.a+Math.PI,e.r+9));e.planted=true;}
    if(e.id===30&&!e.boss && (!e.nextMemory || g.time>=e.nextMemory)){
      e.nextMemory=g.time+.46;e.memory.push({x:e.x,y:e.y});if(e.memory.length>4)e.memory.shift();
    }
    shoveMotion(g,e,dt);
    if(e.stun>.01 || e.stagger>.19 || (e.windup>0 && e.stagger>.10)){
      if(e.windup>0){e.windup=0;e.cd=Math.max(.62,e.cd);}
      if(!e.boss || e.stagger>.55){e.events.length=0;e.dash=null;e.link=null;e.linkTime=0;}return;
    }
    for(let i=e.events.length-1;i>=0;i--){const item=e.events[i];item.delay-=dt;if(item.delay<=0){e.events.splice(i,1);item.fn();}}
    if(e.dash){runDash(g,e,dt);return;}
    walk(g,e,dt,t);
    if(e.windup>0){
      e.windup-=dt;
      if(!canTelegraph(g,e,t)){e.windup=0;e.cd=.28;return;}
      if(e.def.attack==='rail' && e.windup>.28){e.tx=t.x;e.ty=t.y;e.lockA=angle(e,t);}
      e.a=e.lockA;
      if(e.windup<=0){e.windup=0;fire(g,e);e.cd=(e.boss?2.3:e.def.interval)*(e.elite?.87:1)*(1-.009*Math.min(19,g.stage||1))*(.91+g.rng()*.18);}
      return;
    }
    e.a=angle(e,t);e.cd-=dt;
    if(e.cd>0||e.recover>0)return;
    const distance=dist(e,t);
    const close=['leap','prong','ram'].includes(e.def.attack);
    if(close && g.enemies.filter(o=>o!==e&&living(o)&&(o.windup>0||o.dash)&&['leap','prong','ram'].includes(o.def.attack)).length>=2){e.cd=.25;return;}
    if(distance>reach[e.id])return;
    if(!canTelegraph(g,e,t)){e.cd=.23;return;}
    const ignoresCover=['nest','mine','echo','burrow','mortar','weld','link','supply','phase'].includes(e.def.attack);
    const laneTarget=ignoresCover?t:firingLane(g,e,t);
    if(!laneTarget){e.cd=.21;return;}
    startTell(g,e,laneTarget);
  }
  function objective(g,kind,x,y,opts={}) {
    const portal=kind==='portal',hp=opts.hp||50;
    const p=floorPoint(g,x,y,12), color=portal?'#d2a1ff':'#cfdf84';
    const owner={...p,def:{color},r:12,traits:[],salvo:0};
    const b={...p,kind:portal?'portal':'nest',r:14,vx:0,vy:0,age:0,warn:.8,duration:Infinity,life:Infinity,
      owner,stationaryObjective:true,goal:true,color,damage:0,heavy:true,period:4.5,hp,maxHp:hp,...opts};
    // An objective is allowed even when the projectile budget is exhausted.
    g.hostile.push(b);return b;
  }
  function intercept(g,x,y,damage=1,objects=g.hostile) {
    for(const b of objects){
      if(b.life<=0||!b.kind)continue;
      if(b.kind==='null' && b.age>=b.warn && Math.abs(b.x-x)<b.r && Math.abs(b.y-y)<b.r&&clearLab(g,{x,y},b))return true;
      if(!(b.hp>0) || Math.hypot(b.x-x,b.y-y)>(b.kind==='mine'?9:b.r+2)||!clearLab(g,{x,y},b))continue;
      damageObject(g,b,damage);
      return true;
    }
    return false;
  }
  function damageObject(g,b,damage) {
    if(b.kind==='core'){
      if(living(b.owner)){g.hurtEnemy(b.owner,damage*1.6,angle(g.player,b),0,'weakpoint');b.hit=.09;}
      return;
    }
    b.hp=Math.max(0,b.hp-Math.max(0,damage));b.hit=.13;
    if(b.hp<=0){
      b.life=0;g.fx(b.x,b.y,b.color,10);g.sound('break',0);
      if(b.kind==='piston' && living(b.owner)){
        const o=b.owner;
        zone(g,o,'core',{x:o.x-b.dx,y:o.y+b.dy},10,.12,2,{hp:Infinity,damage:0,dx:-b.dx,dy:b.dy});
        o.recover=Math.max(o.recover,.85);
      }
    }
  }
  function lineBlocker(g,start,end){
    let closest=null,nearest=Infinity;
    const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy);
    for(const b of g.hostile){
      if(b.life<=0)continue;
      const nullTile=b.kind==='null'&&b.age>=b.warn;
      if(!nullTile&&!(b.hp>0))continue;
      if(!len){
        const touch=nullTile?Math.max(Math.abs(b.x-start.x),Math.abs(b.y-start.y))<=b.r:
          Math.hypot(b.x-start.x,b.y-start.y)<=(b.kind==='mine'?9:b.r+2);
        if(touch&&clearLab(g,start,b))return {object:b,x:start.x,y:start.y};
        continue;
      }
      let entry;
      if(nullTile){
        // Clip against the same square that eats ballistic projectiles.
        let lo=0,hi=1;
        for(const [origin,delta,center] of [[start.x,dx,b.x],[start.y,dy,b.y]]){
          if(Math.abs(delta)<1e-8){if(Math.abs(origin-center)>b.r){hi=-1;break;}continue;}
          const a=(center-b.r-origin)/delta,z=(center+b.r-origin)/delta;
          lo=Math.max(lo,Math.min(a,z));hi=Math.min(hi,Math.max(a,z));
        }
        if(lo>hi)continue;
        entry=lo*len;
      }else{
        const ox=b.x-start.x,oy=b.y-start.y;
        const along=(ox*dx+oy*dy)/len,side=Math.abs(ox*dy-oy*dx)/len;
        const radius=b.kind==='mine'?9:b.r+2;
        if(side>radius)continue;
        const chord=Math.sqrt(radius*radius-side*side);
        if(along+chord<0||along-chord>len)continue;
        entry=Math.max(0,along-chord);
      }
      if(entry<nearest&&clearLab(g,start,b)){nearest=entry;closest={object:b,x:start.x+dx*entry/len,y:start.y+dy*entry/len};}
    }
    return closest;
  }
  function interceptLine(g,start,end,damage,seen){
    const hit=lineBlocker(g,start,end);
    if(hit?.object.hp>0&&!seen?.has(hit.object)){
      damageObject(g,hit.object,damage);
      seen?.add(hit.object);
    }
    return hit;
  }
  function blast(g,point,radius,damage) {
    for(const b of g.hostile)if(b.life>0&&b.hp>0&&dist(b,point)<=radius+b.r&&clearLab(g,point,b))damageObject(g,b,damage);
  }
  function spawnBudget(g){return g.enemies.reduce((sum,e)=>sum+(living(e)?1:0),0)<Math.min(18,9+(g.stage||1));}
  function impact(g,b) {
    if(b.anchors?.some(anchor=>anchor.life<=0)){b.life=0;return;}
    for(const p of pilots(g)){
      if(!active(p)||!insideRoom(b.chamber,p)||(b.hitTimes?.get(p)??-1)>b.age)continue;
      const rr=p.hitR??p.r??6,dx=p.x-b.x,dy=p.y-b.y;
      let hit;
      if(b.kind==='beam')hit=segmentDistance(p.x,p.y,b.x,b.y,b.x2,b.y2)<b.r+rr;
      else if(b.kind==='sweep'){
        const a=b.a+b.swing*clamp((b.age-b.warn)/b.duration,0,1),at=polar(b,a,b.r);
        hit=segmentDistance(p.x,p.y,b.x,b.y,at.x,at.y)<rr+4;
      }else if(b.kind==='crate')hit=Math.max(Math.abs(dx),Math.abs(dy))<=b.r+rr;
      else hit=Math.hypot(dx,dy)<b.r+rr;
      if(hit&&b.damage>0&&clearLab(g,b,p)){
        hurtPilot(g,p,b.damage);
        (b.hitTimes??=new WeakMap()).set(p,b.age+.33);
      }
    }
  }
  function areaTick(g,b,dt) {
    b.hit=Math.max(0,(b.hit||0)-dt);
    if(b.kind==='core'||b.kind==='piston'){
      if(!living(b.owner)){b.life=0;return;}
      const at=arenaPoint(g,b.owner,{x:b.owner.x+b.dx,y:b.owner.y+b.dy},b.r);
      b.x=at.x;b.y=at.y;return;
    }
    if(b.age<b.warn)return;
    if(b.kind==='muzzle'){
      if(!b.fired){
        b.fired=true;
        for(const a of b.angles)bullet(g,b.owner,b.x,b.y,a,b.velocity,{...b.shotOptions,
          signatureId:b.signatureId,signatureName:b.signatureName,castToken:b.castToken});
      }
      b.life=0;return;
    }
    if(b.anchors?.some(anchor=>anchor.life<=0)){b.life=0;return;}
    if(b.kind==='nest'||b.kind==='portal'){
      if(b.stationaryObjective){
        b.period-=dt;if(b.period<=0 && Number.isInteger(b.spawnId) && spawnBudget(g)){spawn(g,b.spawnId,b.x+13,b.y+9);b.period=6;}
      }else if(b.life<=.22&&!b.fired){
        b.fired=true;if(spawnBudget(g))spawn(g,12,b.x,b.y,{chamber:b.chamber||null});
        else ring(g,b.owner,b,8,92,g.time,2,{shape:'seed'});
        g.fx(b.x,b.y,b.color,6);
      }
      return;
    }
    if(b.kind==='mine'){
      if(!b.trigger && pilots(g).some(p=>active(p)&&dist(p,b)<b.r+12&&clearLab(g,b,p))){b.trigger=.44;g.sound('lock',0);}
      if(b.trigger>0){b.trigger-=dt;if(b.trigger<=0){impact(g,b);ring(g,b.owner,b,9,96,g.time,2);g.fx(b.x,b.y,b.color,9);b.life=0;}}
      return;
    }
    if(b.damage<=0)return;
    impact(g,b);
    if(!b.fired && ['crate','blast','ingot','echo','burrow'].includes(b.kind)){
      b.fired=true;g.fx(b.x,b.y,b.color,7);if(b.kind==='ingot'||b.kind==='crate')g.sound('impact',0);
    }
  }
  function shotTick(g,b,dt){
    if(b.curl){
      const turn=b.curl*dt,cos=Math.cos(turn),sin=Math.sin(turn),vx=b.vx;
      b.vx=vx*cos-b.vy*sin;b.vy=vx*sin+b.vy*cos;
    }
    if(b.turnAt && b.age>=b.turnAt){
      if(!b.pane || b.pane.life>0){const speed=Math.hypot(b.vx,b.vy);b.vx=Math.cos(b.turnTo)*speed;b.vy=Math.sin(b.turnTo)*speed;}
      b.turnAt=0;
    }
    if(b.split && b.age>.8 && !b.didSplit){
      b.didSplit=true;const a=Math.atan2(b.vy,b.vx),s=Math.hypot(b.vx,b.vy)*.83;
      pushShot(g,{...b,vx:Math.cos(a-.34)*s,vy:Math.sin(a-.34)*s,life:Math.min(2,b.life),shape:'diamond',r:3});b.vx=Math.cos(a+.28)*s;b.vy=Math.sin(a+.28)*s;
    }
    const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;
    if(b.chamber&&!insideRoom(b.chamber,{x:nx,y:ny},b.r)){b.life=0;return;}
      if((g.shotBlocked||g.blocked)(nx,ny,Math.min(2,b.r*.4))||!clearLab(g,b,{x:nx,y:ny})){
        if(b.bounce>0){if((g.shotBlocked||g.blocked)(nx,b.y,1))b.vx*=-1;else b.vy*=-1;b.bounce--;}else b.life=0;
      return;
    }
    let closest=Infinity,target=null;
    const check=(actor,r,pilot)=>{
      if(segmentDistance(actor.x,actor.y,b.x,b.y,nx,ny)>=r+b.r||!clearLab(g,b,actor))return;
      const d=dist(b,actor);
      if(d<closest){closest=d;target=pilot;}
    };
    for(const p of pilots(g)){
      if(!active(p)||!insideRoom(b.chamber,p))continue;
      check(p,p.hitR??p.r??6,p);
      const decoy=decoyFor(g,p);if(decoy?.life>0)check(decoy,9,null);
    }
    if(closest<Infinity){if(target)hurtPilot(g,target,b.damage||8);b.life=0;}
    b.x=nx;b.y=ny;
    if(nx<-12||ny<-12||nx>width(g)+12||ny>height(g)+12)b.life=0;
  }
  function update(g,dt) {
    dt=Math.min(.10,Math.max(0,dt));const f=field(g);f.historyClock+=dt;
    const record=f.historyClock>.12;if(record)f.historyClock=0;
    for(const p of pilots(g)){
      if(!active(p))continue;
      if(p.dashTime>0){
        const prior=f.lastDash.get(p),dx=p.x-(prior?.x??p.x),dy=p.y-(prior?.y??p.y);
        f.lastDash.set(p,{x:p.x,y:p.y,time:g.time,a:Math.hypot(dx,dy)>.1?Math.atan2(dy,dx):(prior?.a??p.a)});
      }
      if(record){
        let history=f.history.get(p);
        if(!history){history=[];f.history.set(p,history);}
        history.push({x:p.x,y:p.y,time:g.time});if(history.length>10)history.shift();
      }
    }
    if(f.corpses.length)f.corpses=f.corpses.filter(e=>g.time-e.time<7).slice(-20);
    const live=f.live;live.length=0;for(const e of g.enemies){stepEnemy(g,e,dt);if(living(e))live.push(e);}
    collideBodies(g,dt,live);
    for(let i=g.hostile.length-1;i>=0;i--){
      const b=g.hostile[i];
      if((b.bossOwner&&!living(b.bossOwner))||b.castToken?.cancelled)b.life=0;
      if(b.life>0){b.age=(b.age||0)+dt;b.life-=dt;if(b.kind)areaTick(g,b,dt);else shotTick(g,b,dt);}
      if(b.life<=0)g.hostile.splice(i,1);
    }
  }
  function stroke(c,x,y,xx,yy,color,w=1){
    c.lineWidth=w;c.strokeStyle=color;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();
  }
  function circle(c,x,y,r,color,w=1,fill=false){
    if(r<=0)return;c.beginPath();c.arc(x,y,r,0,TAU);
    if(fill){c.fillStyle=color;c.fill();}else{c.lineWidth=w;c.strokeStyle=color;c.stroke();}
  }
  function poly(c,points,fill,outline='',line=1){
    c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(outline){c.strokeStyle=outline;c.lineWidth=line;c.stroke();}
  }
  const square = (c,x,y,r,col,line)=>{c.lineWidth=line;c.strokeStyle=col;c.strokeRect((x-r)|0,(y-r)|0,r*2,r*2);};
  function areaArt(c,b,t) {
    const {x,y,r,color}=b,k=b.kind,armed=b.age>=b.warn;
    const pct=clamp(b.age/b.warn,0,1);
    c.save();
    if(b.chamber){const {x,y,w,h}=b.chamber;c.beginPath();c.rect(x,y,w,h);c.clip();}
    if(b.signatureId&&window.BossTellArt?.draw(c,b,t)){c.restore();return;}
    if(k==='muzzle'){
      circle(c,x,y,5+3*(1-pct),color,1.4);
      for(const a of b.angles){
        const from=polar(b,a,9),to=polar(b,a,14+pct*(b.reach-14));
        stroke(c,from.x,from.y,to.x,to.y,pct>.76?'#ffebc1':color,1.5);
      }
      c.restore();return;
    }
    if(k==='beam'){
      if(b.anchors?.some(a=>a.life<=0)){c.restore();return;}
      const angle=Math.atan2(b.y2-y,b.x2-x);
      if(armed){stroke(c,x,y,b.x2,b.y2,color+'52',r*2+4);stroke(c,x,y,b.x2,b.y2,color,r*1.23);stroke(c,x,y,b.x2,b.y2,'#fff9cd',2);}
      else{const nx=-Math.sin(angle)*r,ny=Math.cos(angle)*r;
        stroke(c,x+nx,y+ny,b.x2+nx,b.y2+ny,color+'80');stroke(c,x-nx,y-ny,b.x2-nx,b.y2-ny,color+'80');
        c.setLineDash([5,5]);c.lineDashOffset=-Math.floor(t*12);stroke(c,x,y,b.x2,b.y2,color,1+Math.floor(pct));}
      c.restore();return;
    }
    if(k==='sweep'){
      const at=b.a+b.swing*clamp((b.age-b.warn)/b.duration,0,1);
      const tip=polar(b,at,r);c.strokeStyle=color+(armed?'a0':'64');c.lineWidth=2;c.setLineDash(armed?[]:[4,5]);
      c.beginPath();c.arc(x,y,r,b.a,b.a+b.swing);c.stroke();
      stroke(c,x,y,tip.x,tip.y,armed?color:color+'9a',armed?5:1);if(armed)circle(c,tip.x,tip.y,4,'#fff8e3',1,true);c.restore();return;
    }
    if(['nest','portal','mine','mouth','stake','limb','pane'].includes(k)){
      const flash=b.hit>0?'#fff9dc':color;
      if(k==='nest'){
        const pulse=1+Math.sin(t*4.1+x)*.066;c.translate(Math.round(x),Math.round(y));c.scale(pulse,pulse);
        circle(c,1,3,r+1,'#0c1b1e',1,true);
        for(let i=0;i<6;i++){
          const a=i*TAU/6+.2,xx=Math.cos(a)*(r+4),yy=Math.sin(a)*(r+4);
          stroke(c,xx,yy,xx*.48,yy*.5,'#102221',4);stroke(c,xx,yy,xx*.4,yy*.55,'#799c67',2);
        }
        poly(c,[[-r,2],[-r*.6,-r*.8],[0,-r],[r*.8,-r*.56],[r,0],[r*.58,r*.8],[-r*.57,r]],'#405443',flash,1.8);
        for(let i=0;i<3;i++){const a=i*TAU/3+.3;circle(c,Math.cos(a)*4,Math.sin(a)*4,2.5,'#ffe38b',1,true);}
      }else if(k==='portal'){
        c.translate(x,y);circle(c,0,0,r+5,'#161425',1,true);circle(c,0,0,r+2,flash,2.5);circle(c,0,0,r-3,'#a69add',1);
        for(let i=0;i<4;i++){const a=i*TAU/4+t*.66;const p=polar({x:0,y:0},a,r+2);c.fillStyle='#ffdaeb';c.fillRect(p.x-2,p.y-2,4,4);}
      }else if(k==='mine'){
        c.translate(x,y);
        c.setLineDash([3,5]);circle(c,0,0,r,b.trigger?'#fff1ae':color+'74',1.2);c.setLineDash([]);
        poly(c,[[-8,4],[-6,-4],[-2,-7],[4,-7],[8,-2],[8,5]],'#412b31',flash,1.7);
        c.fillStyle=((t*(b.trigger?14:3))|0)%2?'#fff6c1':'#dc6549';c.fillRect(-3,-5,6,4);
      }else if(k==='pane'){
        c.translate(x,y);c.rotate(b.a);poly(c,[[-r,-2],[r,-3],[r+2,2],[-r,3]],'#b7b0ff52',flash);
        c.rotate(b.turnTo-b.a);poly(c,[[10,0],[4,-3],[4,3]],'#fff1fc');
      }else{
        c.translate(x,y);c.rotate(k==='mouth'?t*.65:-t*.3);
        poly(c,[[0,-r],[r*.8,0],[0,r],[-r*.8,0]],'#372b50',flash,2);circle(c,0,0,r*.43,'#fff5dc',1.4);
      }
      c.restore();
      if(b.goal){const hp=clamp(b.hp/(b.maxHp||50),0,1),w=29;c.fillStyle='#1c1722';c.fillRect(x-w/2-1,y-r-9,w+2,4);
        c.fillStyle=color;c.fillRect(x-w/2,y-r-8,w*hp,2);}
      return;
    }
    if(k==='null'){
      const size=armed?r:r*pct;c.fillStyle=armed?'#17101fb0':'#34233d5d';c.fillRect(x-size,y-size,size*2,size*2);square(c,x,y,size,color,1.5);
      stroke(c,x-5,y+4,x+5,y-4,color,1);c.restore();return;
    }
    const sq=k==='crate'||k==='echo';
    if(armed){if(sq){c.fillStyle=color+'54';c.fillRect(x-r,y-r,r*2,r*2);square(c,x,y,r,color,2);}
      else{circle(c,x,y,r,color+(k==='acid'?'39':'54'),1,true);circle(c,x,y,r,color,1.6);}
      if(k==='acid')for(let i=0;i<3;i++){const at=polar(b,t*.64+i*TAU/3,r*.48);circle(c,at.x,at.y,1.5,color,1,true);}
    }else{
      c.setLineDash([3,3]);if(sq)square(c,x,y,r,color,1.4);else circle(c,x,y,r,color,1.4);c.setLineDash([]);
      const tight=Math.max(2,r*(1-pct));if(sq)square(c,x,y,tight,color+'c7',1);else circle(c,x,y,tight,color+'d7',1);
      if(r>13){stroke(c,x-4,y,x+4,y,color);stroke(c,x,y-4,x,y+4,color);}
    }
    c.restore();
  }
  function bossTell(c,g,e,color,frac){
    const a=e.lockA,next=e.salvo+1;
    c.save();c.lineWidth=1.5;
    if(e.chamber){const {x,y,w,h}=e.chamber;c.beginPath();c.rect(x,y,w,h);c.clip();}
    // Radial volleys omit the same first three seeds as the attack itself.
    if((e.id===0&&e.phase===3)||(e.id===4&&e.phase===1)){
      const n=e.id===0?21:19,start=a+next*(e.id===0?.29:.51);
      for(let i=3;i<n;i++){
        const dir=start+i*TAU/n,from=polar(e,dir,e.r+6),to=polar(e,dir,e.r+10+frac*6);
        stroke(c,from.x,from.y,to.x,to.y,color+'d9',1.5);
      }
    }else if((e.id===0&&e.phase===2)||(e.id===2&&e.phase===3)){
      const gap=e.id===0?-1:-2;
      for(let i=-5;i<=5;i++){
        if(Math.abs(i-gap)<1.1)continue;
        const side=polar(e,a+Math.PI/2,i*18),from=polar(side,a,e.r+5),to=polar(from,a,4+5*frac);
        stroke(c,from.x,from.y,to.x,to.y,color+'b8',2);
      }
    }else{
      // Aim brackets sit on the locked target point for floor attacks. The others
      // flash the mounting's actual firing direction at the edge of the body.
      const floorAttack=(e.id===1&&e.phase===3)||(e.id===2&&e.phase<3)||(e.id===3&&e.phase===2)||
        (e.id===4&&e.phase===2)||(e.id===5&&e.phase!==2);
      if(floorAttack){
        const t=e.id===1&&e.chamber?insideBounds(e.chamber,{x:e.tx,y:e.ty},119):{x:e.tx,y:e.ty};
        const r=10+7*(1-frac);
        for(const sx of [-1,1])for(const sy of [-1,1]){
          const x=t.x+sx*r,y=t.y+sy*r;
          stroke(c,x-4*sx,y,x,y,color+'bb');stroke(c,x,y,x,y-4*sy,color+'bb');
        }
      }else if(e.id===0||e.id===1||e.id===3||e.id===6){
        for(const offset of [-.42,0,.42]){
          const from=polar(e,a+offset,e.r+7),to=polar(from,a+offset,5+frac*8);
          stroke(c,from.x,from.y,to.x,to.y,color+'d5',1.5);
        }
      }
    }
    c.restore();
  }
  function visibleBounds(g){
    const v=g.camera?.activeView;
    return v?{left:v.x-5,right:v.x+v.sw/v.zoom+5,top:v.y-5,bottom:v.y+v.sh/v.zoom+5}:null;
  }
  function inView(v,x,y,r){
    return !v||(x+r>=v.left&&x-r<=v.right&&y+r>=v.top&&y-r<=v.bottom);
  }
  function lineInView(v,x,y,u,w,pad){
    return !v||(Math.max(x,u)+pad>=v.left&&Math.min(x,u)-pad<=v.right&&Math.max(y,w)+pad>=v.top&&Math.min(y,w)-pad<=v.bottom);
  }
  function tellInView(v,e){
    if(!v)return true;
    if(e.arrive>0||e.coverTime>0){if(inView(v,e.x,e.y,e.r+47))return true;}
    if(e.link?.hp>0&&e.linkTime>0&&lineInView(v,e.x,e.y,e.link.x,e.link.y,3))return true;
    if(e.windup<=0)return false;
    const type=e.def.attack;
    const range=type==='rail'?518:type==='ram'?239:type==='wake'?178:type==='switchback'?199:
      type==='bank'?189:['leap','prong'].includes(type)?109:e.boss?149:e.r+28;
    return inView(v,e.x,e.y,range)||inView(v,e.tx,e.ty,e.boss?135:21);
  }
  function drawWarnings(c,g) {
    const v=visibleBounds(g);c.save();
    for(const b of g.hostile){
      if(!b.kind||b.kind==='core'||b.kind==='piston'||b.life<=0)continue;
      const visible=b.kind==='beam'?lineInView(v,b.x,b.y,b.x2,b.y2,b.r+9):inView(v,b.x,b.y,b.kind==='muzzle'?b.reach+10:b.r+24);
      if(visible)areaArt(c,b,g.time);
    }
    for(const e of g.enemies){
      if(!living(e)||!tellInView(v,e))continue;
      if(e.arrive>0){
        const r=e.r+3+e.arrive*16;
        if(e.def.fodder){
          // Fodder deploys in clusters. Use two short brackets per arrival to keep gaps legible.
          for(const side of [-1,1]){
            const x=e.x+side*r*.72,y=e.y+side*3;
            stroke(c,x,y-3,x,y+3,e.def.color+'ab');stroke(c,x,y-3,x-side*3,y-3,e.def.color+'ab');
          }
          continue;
        }
        c.save();c.setLineDash([8,5]);circle(c,e.x,e.y,r,e.def.color+'bc',1.7);c.restore();
        circle(c,e.x,e.y,Math.max(2,r*.60),e.def.color+'65');continue;
      }
      if(e.link?.hp>0 && e.linkTime>0){
        c.save();c.setLineDash([4,4]);c.lineDashOffset=-g.time*22;stroke(c,e.x,e.y,e.link.x,e.link.y,'#90f6cc',2);c.restore();
      }
      if(e.coverTime>0){
        const at=polar(e,e.coverA,e.r+38),start=polar(e,e.coverA,e.r+1);
        c.save();c.setLineDash([3,5]);stroke(c,start.x,start.y,at.x,at.y,e.def.color+'b9',1.5);c.restore();
      }
      if(e.windup<=0)continue;
      const p={x:e.tx,y:e.ty},a=e.lockA,type=e.def.attack,frac=1-e.windup/e.windMax,col=e.def.color;
      if(type==='bite'){
        c.save();c.translate(e.x,e.y);c.rotate(a);
        const jaw=e.r+3+frac*2,spread=5-frac*3;
        for(const side of [-1,1])stroke(c,jaw,side*spread,jaw+4,side*(spread-1),col,1.5);
        c.restore();
      }else if(type==='rail'||['leap','prong','ram','wake','switchback'].includes(type)){
        const max=type==='rail'?515:type==='ram'?235:type==='wake'?174:type==='switchback'?97:104;
        const at=clipLab(g,e,polar(e,a+(type==='switchback'?.45*e.turn:0),max));
        c.save();c.setLineDash(e.windup>.25?[5,5]:[]);stroke(c,e.x,e.y,at.x,at.y,e.windup>.25?col+'8c':'#fff2b2',type==='rail'?1.25:1.8);
        if(type==='switchback'&&dist(e,at)>max-.2){const end=clipLab(g,at,polar(at,a-.49*e.turn,95));stroke(c,at.x,at.y,end.x,end.y,col+'8c',1.5);}
        c.restore();
      }else if(['crate','mortar','burrow','echo','pouch'].includes(type)){
        circle(c,p.x,p.y,7+9*(1-frac),col+'b0');stroke(c,p.x-3,p.y,p.x+3,p.y,col);
      }else if(type==='seedring'||type==='spiral'||e.boss){
        c.save();c.lineDashOffset=e.windup*20;c.setLineDash([7,6]);circle(c,e.x,e.y,e.r+5+(1-frac)*5,col+'a1',1.4);c.restore();
          if(e.boss&&e.signatureIndex==null)bossTell(c,g,e,col,frac);
          if(e.boss&&g.players?.length===2&&e.volleyTarget){
            const pilotColor=e.volleyTarget===g.players[1]?'#ffb17b':'#99f1dc',r=9+(1-frac)*6;
            for(const sx of [-1,1])for(const sy of [-1,1]){
              const x=p.x+sx*r,y=p.y+sy*r;
              stroke(c,x-sx*4,y,x,y,pilotColor,1.5);
              stroke(c,x,y,x,y-sy*4,pilotColor,1.5);
            }
          }
      }else if(type==='bank'){
        const corner=clipLab(g,e,polar(e,a+.4*e.turn,76));
        c.save();c.setLineDash([3,5]);stroke(c,e.x,e.y,corner.x,corner.y,col+'80');
        if(dist(e,corner)>75.8){const end=clipLab(g,corner,polar(corner,angle(corner,p),110));stroke(c,corner.x,corner.y,end.x,end.y,col+'80');}
        c.restore();
      }else{
        const m=polar(e,a,e.r+4),q=polar(e,a,e.r+9+frac*7);
        stroke(c,m.x,m.y,q.x,q.y,col,2);
      }
    }
    c.restore();
  }
  const shotSheets=new Map();
  function shotShape(c,r,col,shape,outline){
    if(shape==='dot'||shape==='seed'){
      poly(c,[[-r*2.6,0],[-r*.6,-r*.69],[r*.3,0],[-r*.6,r*.69]],col+'88');
      if(outline)circle(c,0,0,r+1.4,'#351d30',1,true);
      circle(c,0,0,r,col,1,true);circle(c,.6,-.4,Math.max(1,r*.47),'#fff8d1',1,true);
    }else{
      const length=shape==='lance'?r*3.6:shape==='dart'?r*2.3:shape==='bar'?r*1.55:r*1.25;
      const points=shape==='hook'?[[length,0],[0,-r],[-length,-r*.3],[-r,r*.63],[0,r]]:[[length,0],[0,-r],[-length,0],[0,r]];
      poly(c,points,col,outline?'#371c32':'',2);stroke(c,0,0,length*.44,0,'#ffffe6',Math.max(2,r*.56));
    }
  }
  // Each material gets one small sheet. Bake a facing on its first use and
  // reuse the same pixels for both views, including the hostile outline option.
  function drawShotSprite(c,b,x,y,a,outline){
    const r=b.r,col=b.color||'#ffc06d',shape=b.shape||'dot';
    let s=b.shotSheet;
    if(!s||s.r!==r||s.col!==col||s.shape!==shape||s.outline!==outline){
      const key=[r,col,shape,outline].join('/');
      s=shotSheets.get(key);
      if(!s){
        const half=Math.ceil(r*(shape==='lance'?3.6:2.6))+3,size=half*2;
        const canvas=document.createElement('canvas');canvas.width=size*8;canvas.height=size*4;
        s={canvas,ctx:canvas.getContext('2d'),size,half,mask:0,r,col,shape,outline};shotSheets.set(key,s);
      }
      b.shotSheet=s;
    }
    const facing=Math.round(a*(32/TAU))&31,sx=(facing&7)*s.size,sy=(facing>>3)*s.size;
    if(!(s.mask&(1<<facing))){
      const ctx=s.ctx;ctx.save();ctx.translate(sx+s.half,sy+s.half);ctx.rotate(facing*(TAU/32));
      shotShape(ctx,r,col,shape,outline);ctx.restore();s.mask|=1<<facing;
    }
    c.drawImage(s.canvas,sx,sy,s.size,s.size,x-s.half,y-s.half,s.size,s.size);
  }
  function drawShots(c,g) {
    const outline=g.settings?.outline!==false,v=visibleBounds(g);
    c.save();
    for(const b of g.hostile){
      if((b.kind!=='core'&&b.kind!=='piston')||b.life<=0||!inView(v,b.x,b.y,16))continue;
      const x=Math.round(b.x),y=Math.round(b.y),r=b.kind==='core'?7:5,col=b.kind==='core'?'#96f6dc':'#ffd68d';
      circle(c,x,y,r+1.5,'#2c2826',1,true);
      circle(c,x,y,r,b.hit>0?'#fffae7':col,1.6);
      c.fillStyle=col;
      for(let j=-1;j<=1;j++)c.fillRect(x-3+j,y+j*2,6,1);
      c.fillStyle='#fff9da';c.fillRect(x,y-1,2,2);
      if(b.kind==='core'){
        const pt=polar(b,g.time*3.1,r+3);
        c.fillStyle=col;c.fillRect(Math.round(pt.x)-1,Math.round(pt.y)-1,3,3);
      }
    }
    for(const b of g.hostile){
      if(b.kind||b.life<=0||!inView(v,b.x,b.y,b.r*3.6+3))continue;
      const x=Math.round(b.x),y=Math.round(b.y),a=Math.atan2(b.vy,b.vx);
      const fade=b.life<.23?Math.max(.45,b.life/.23):1;c.globalAlpha=fade;
      drawShotSprite(c,b,x,y,a,outline);
      if(b.split&&!b.didSplit)circle(c,x,y,b.r+2.7,'#fff3da',.7);
    }
    c.restore();
  }
  window.Foes={defs,bosses,spawn,update,mitigate,intercept,interceptLine,lineBlocker,blast,objective,drawWarnings,drawShots};
})();
