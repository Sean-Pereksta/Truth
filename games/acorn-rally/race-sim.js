(function(root, factory) {
  const server=typeof module==='object'&&module.exports;
  const api=factory(server?require('./kart-rig.js'):root.AcornRig,server?require('./signature-kit.js'):root.AcornSignatures,server?require('./hazards.js'):root.AcornHazards,server?require('./ramps.js'):root.AcornRamps);
  if (server) module.exports = api;
  else root.AcornSim = api;
})(typeof globalThis === 'object' ? globalThis : this, function(Rig,Signatures,Hazards,Ramps) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (v, n) => ((v % n) + n) % n;
  const engineClasses=[50,100,150,200],difficulties=['easy','normal','hard'];
  const normalizeCC=value=>engineClasses.includes(Number(value))?Number(value):100;
  const normalizeDifficulty=value=>difficulties.includes(value)?value:'normal';
  const motors={
    50:{speed:.76,acceleration:.84,brakes:.96},
    100:{speed:1,acceleration:1,brakes:1},
    150:{speed:1.21,acceleration:1.23,brakes:1.055},
    200:{speed:1.43,acceleration:1.49,brakes:1.11}
  };
  const drivers = ['Nib','Bristle','Clover','Tumble','Hazel','Ember','Flint','Mica'];
  const abilities = Signatures.names, durations=Signatures.durations;
  // Steering, acceleration, corner-load, transition speed, off-road resistance and bump weight.
  const handling=[
    [1.14,10.65,1.04,8.25,1.02,.79],[.91,10.4,.93,5.9,.94,1.26],
    [1.02,12.0,1.01,7.2,1.03,.88],[1.00,10.75,.84,6.15,.97,1.06],
    [1.055,10.15,.96,7.85,.80,1.10],[1.085,11.3,1.085,7.1,1.15,.89],
    [.85,9.95,.83,5.55,.73,1.40],[.995,11.0,.975,7.0,.65,1.03]
  ];
  const items = ['Seed Kick', 'Sap Sling', 'Burr Patch', 'Bark Guard', 'Thistle Puff', 'Pinecone Skip', 'Tailwind'];
  const itemTimes={seed:.91,sap:3.05,burr:1.72,guard:6.0,puff:.74,pine:.79,tailwind:4.15};
  const definitions = [
    ['Hoh Root Run',840,[[-86,-52],[-81,-15],[-53,18],[-23,18],[0,0],[28,-31],[58,-40],[91,-21],[91,4],[58,34],[24,28],[0,0],[-15,-30],[-35,-58],[-65,-70]]],
    ['Bamboo Bell Run',900,[[-75,-48],[-72,-8],[-49,14],[-60,40],[-38,62],[-5,62],[45,38],[77,13],[64,-10],[33,-14],[48,-38],[18,-63],[-25,-47],[-52,-66]]],
    ['Sluice Sprint',930,[[-83,-53],[-74,-5],[-63,43],[-32,55],[-14,23],[13,22],[48,51],[76,38],[84,11],[57,-8],[22,-20],[8,-54],[-25,-65],[-54,-57]]],
    ['Finbreak Canyon',1000,[[-86,-42],[-65,-6],[-77,17],[-43,34],[-53,57],[-18,68],[12,47],[57,59],[86,29],[71,-1],[34,2],[54,-26],[74,-45],[38,-58],[0,-33],[-24,-61],[-61,-62]]],
    ['Mirror Saltway',1020,[[-110,-39],[-110,10],[-92,47],[-57,62],[0,61],[55,72],[105,46],[100,5],[71,-4],[73,-27],[51,-33],[13,-58],[-38,-67],[-79,-59]]],
    ['Chimney Spiral',1100,[[-83,-60],[-82,-19],[-63,11],[-35,24],[0,17],[17,-8],[-6,-26],[-30,-11],[-35,18],[-7,48],[29,60],[71,42],[82,13],[47,7],[67,-18],[48,-52],[14,-40],[-22,-70],[-56,-62]]],
    ['Cloudfall Canopy',1030,[[-82,-51],[-73,-17],[-44,-1],[-59,24],[-34,54],[5,54],[30,28],[57,49],[86,21],[66,-3],[32,5],[11,-17],[35,-40],[5,-59],[-26,-39],[-57,-66]]],
    ['Basalt Breakwater',1100,[[-89,-36],[-62,0],[-73,22],[-42,49],[-4,58],[47,60],[84,34],[73,-5],[41,-18],[20,0],[-5,-14],[13,-42],[-23,-57],[-47,-40],[-68,-56]]]
  ];
  const surfaces = ['Forest soil','Wet timber','Dry brick','Slickrock','Salt crust','Chalkstone','River stone','Basalt gravel'];
  const cache = [];
  function track(index=0) {
    index = clamp(index | 0,0,7);
    if (cache[index]) return cache[index];
    const [name,length,anchors] = definitions[index], count = anchors.length, raw = [];
    let arc = 0;
    function sample(t, axis) {
      const k = Math.floor(t), f = t-k;
      const a=anchors[mod(k-1,count)][axis], b=anchors[k%count][axis], c=anchors[(k+1)%count][axis], d=anchors[(k+2)%count][axis];
      return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);
    }
    for(let j=0;j<=count*40;j++){
      const t=j/40,x=sample(t,0),z=sample(t,1);
      if(j) arc+=Math.hypot(x-raw[j-1].x,z-raw[j-1].z);
      raw.push({x,z,t,arc});
    }
    const points=[], n=640, scale=length/arc, elev=[1.9,2.2,2.2,4,.35,6,5,4][index];
    const bridgeAnchor=[4,6,11,8,4,8,4,11][index];
    const bridgeS=raw[bridgeAnchor*40].arc/arc;
    const branchA=[.47,.46,.31,.48,.32,.42,.31,.34][index],branchB=branchA+.16;
    for(let j=0, k=0;j<n;j++){
      const s=arc*j/n;
      while(raw[k+1].arc<s) k++;
      const a=raw[k],b=raw[k+1],f=(s-a.arc)/(b.arc-a.arc),u=j/n;
      const x=(a.x+(b.x-a.x)*f)*scale,z=(a.z+(b.z-a.z)*f)*scale;
      const bridge=Math.exp(-Math.pow((u-bridgeS)/(.045+(index===5?.018:0)),2));
      const y=1.8+elev*(1+.63*Math.sin(TAU*u-.7)+.28*Math.sin(2*TAU*u+1))+bridge*([8.5,4.2,4,3,0,7,6,4][index]);
      points.push({x,y,z,w:5.4+Math.max(0,1-Math.min(u,1-u)*18)*1.15});
    }
    for(let j=0;j<n;j++){
      const p=points[j],a=points[mod(j-1,n)],b=points[(j+1)%n],dist=Math.hypot(b.x-a.x,b.z-a.z);
      p.tx=(b.x-a.x)/dist;p.tz=(b.z-a.z)/dist;p.nx=p.tz;p.nz=-p.tx;
    }
    for(let j=0;j<n;j++){const p=points[j],b=points[(j+1)%n];p.curve=Math.asin(clamp(p.tz*b.tx-p.tx*b.tz,-1,1))/(length/n);}
    return cache[index]={index,name,length,points,branchA,branchB,bridgeS,surface:surfaces[index]};
  }
  function sample(course,distance,lane=0,branch=false) {
    const u=mod(distance,course.length)/course.length, a=u*course.points.length, i=Math.floor(a),f=a-i;
    const p=course.points[i],q=course.points[(i+1)%course.points.length];
    const mix=k=>p[k]+(q[k]-p[k])*f;
    const b=clamp((u-course.branchA)/(course.branchB-course.branchA),0,1), peak=Math.sin(Math.PI*b)**2;
    const offset=branch?peak*12:0;
    const nx=mix('nx'),nz=mix('nz'),w=branch?mix('w')-peak*2.7:mix('w');
    return {x:mix('x')+nx*(offset+lane),y:mix('y')+(branch?peak*([2,-.25,-1.4,3,-.3,-.6,3.5,-1][course.index]):0),z:mix('z')+nz*(offset+lane),tx:mix('tx'),tz:mix('tz'),nx,nz,curve:mix('curve'),w,u,peak};
  }
  function groundSample(c,s,x=0,branch=false){
    const p=sample(c,s,x,branch);p.y+=Ramps.surface(c,s,x,branch);return p;
  }
  function groundLift(st,r){
    if(r.catchShelf&&r.branch===r.catchShelf.branch&&r.s>=r.catchShelf.start-.06&&r.s<r.catchShelf.end)return 0;
    return Ramps.surface(track(st.trackIndex),r.s,r.x,r.branch);
  }
  function lift(st,r){
    if(Number.isFinite(r.ghostLift))return r.ghostLift;
    if(r.flight)return Math.max(0,r.flight.y-sample(track(st.trackIndex),r.s,r.x,r.branch).y);
    return groundLift(st,r)+Hazards.lift(st,r);
  }
  function rampPitch(st,r){return Number.isFinite(r.ghostPitch)?r.ghostPitch:r.rampAngle||0;}
  const gravity=21.2;
  function rampEntry(c,s,x,branch){
    for(const ramp of Ramps.list(c)){
      if(ramp.branch!==!!branch)continue;
      const shape=Ramps.deck(ramp,s,x);if(shape.phase!=='outside')return {ramp,shape};
    }
    return null;
  }
  function slopeAt(c,s,x,branch){
    const a=sample(c,s-.28,x,branch),b=sample(c,s+.28,x,branch);
    return {rise:(b.y-a.y)/.56,run:Math.max(.25,Math.hypot(b.x-a.x,b.z-a.z)/.56)};
  }
  function rampStep(st,r,c,dt,prev,predict=false){
    const ramps=Ramps.list(c);
    if(!ramps.length)return;
    const moved=r.s-prev.progress,speed=moved/Math.max(.0001,dt),ground=sample(c,r.s,r.x,r.branch);
    if(r.catchShelf&&(r.branch!==r.catchShelf.branch||r.s>r.catchShelf.end||r.s<r.catchShelf.start-.06))r.catchShelf=null;
    if((r.ghost||0)>prev.recovery+.1||r.driverIndex===7&&r.active>0){
      r.flight=null;r.catchShelf=null;r.rampAngle=0;return;
    }
    const deck=rampEntry(c,r.s,r.x,r.branch);
    let elapsed=dt;
    if(!r.flight&&Math.abs(moved)<12&&prev.branch===r.branch){
      const from=rampEntry(c,prev.progress,prev.lane,r.branch);
      let ramp=moved>0?Ramps.crossed(c,prev.progress,r.s,prev.lane,r.x,r.branch):null;
      let full=!!ramp;
      if(!ramp){
        const drop=from?.shape.height-(deck?.shape.height||0);
        if(from&&!r.catchShelf&&drop>Math.max(.12,Math.abs(moved)*.68+Math.abs(r.x-prev.lane)*.65))ramp=from.ramp;
        else if(deck&&!r.catchShelf&&r.air<=0&&(deck.shape.height-(from?.shape.height||0))>Math.max(.28,Math.abs(moved)*.74+Math.abs(r.x-prev.lane)*1.4)){
          // The vertical back of a plank cannot lift a kart that approaches from underneath.
          const lip=deck.ramp.lipS+c.length*Math.round((r.s-deck.ramp.lipS)/c.length);
          r.catchShelf={id:deck.ramp.id,start:lip-deck.ramp.runup-.1,end:lip+deck.ramp.gap+deck.ramp.landingLength,branch:r.branch};
        }
      }
      if(ramp){
        const lapLip=ramp.lipS+c.length*Math.round((prev.progress-ramp.lipS)/c.length);
        const lip=full?Math.max(prev.progress,Math.min(lapLip,r.s)):prev.progress,fraction=full&&moved>0?clamp((lip-prev.progress)/moved,0,1):0;
        const x=prev.lane+(r.x-prev.lane)*fraction,lipShape=Ramps.deck(ramp,full?lip-.00001:lip,x),base=sample(c,lip,x,r.branch),slope=slopeAt(c,lip,x,r.branch);
        const carry=r.air>0,launched=!carry&&full&&!r.catchShelf&&r.v>=ramp.minSpeed&&lipShape.height>.1;
        const tangent=launched?lipShape.grade*speed:0;
        const upward=Math.min(8.4,tangent)+Math.max(0,tangent-8.4)*.55;
        const hop=carry?Hazards.lift(st,r):0,hopRate=carry?(Hazards.lift({time:st.time+.008},{...r,air:Math.max(0,r.air-.008)})-hop)/.008:0;
        r.flight={id:ramp.id,kind:carry?'carry':launched?'ramp':'drop',y:base.y+(r.catchShelf?0:Math.max(0,lipShape.height))+hop,vy:slope.rise*speed+upward+hopRate,age:0,lipS:lapLip,launchSpeed:r.v};
        if(launched&&!predict)r.launchSeq=(r.launchSeq||0)+1;
        elapsed=dt*(1-fraction);
      }
    }
    let targetPitch=0;
    if(r.flight){
      const f=r.flight,ramp=ramps.find(a=>a.id===f.id),oldY=f.y;
      f.y+=f.vy*elapsed-.5*gravity*elapsed*elapsed;f.vy-=gravity*elapsed;f.age+=elapsed;
      const slope=slopeAt(c,r.s,r.x,r.branch),along=Math.max(4,Math.abs(speed)*slope.run);
      const landingStart=f.lipS+ramp.gap,landingEnd=landingStart+ramp.landingLength;
      if(!r.catchShelf&&prev.progress<landingStart&&r.s>=landingStart){
        const fraction=clamp((landingStart-prev.progress)/Math.max(.001,moved),0,1),crossX=prev.lane+(r.x-prev.lane)*fraction;
        const atFront=groundSample(c,landingStart+.00001,crossX,r.branch);
        if(oldY+(f.y-oldY)*fraction<atFront.y-.035)r.catchShelf={id:f.id,start:landingStart-.10,end:landingEnd,branch:r.branch};
      }
      const below=ground.y+groundLift(st,r),deckGrade=deck&&!r.catchShelf?deck.shape.grade:0,fallSpeed=(slope.rise+deckGrade)*speed-f.vy;
      targetPitch=clamp(-Math.atan2(f.vy,along)+Math.atan2(slope.rise,slope.run),-.55,.42);
      if(f.age>.02&&f.y<=below+.001&&fallSpeed>0){
        const catchLanding=r.catchShelf||r.s<landingStart-.02||(!Ramps.matchLanding(ramp,r.s,r.x)&&r.s<landingEnd&&r.s>=landingStart);
        if(catchLanding&&r.s<landingEnd)r.catchShelf={id:f.id,start:Math.min(r.s,landingStart)-.12,end:landingEnd,branch:r.branch};
        r.air=0;r.flight=null;
        if(!predict){
          r.landingSeq=(r.landingSeq||0)+1;r.landingFx=.60;r.landingForce=clamp(fallSpeed/13,.12,1);
          r.landingKind=catchLanding?'catch':Ramps.matchLanding(ramp,r.s,r.x)?'deck':'road';r.landedRamp=f.id;
          if(f.kind==='ramp'&&!catchLanding){r.meter=clamp(r.meter+.027,0,1);r.vx*=r.driverIndex===2?.74:.91;}
          if(catchLanding){r.v*=.93;r.vx*=.72;notify(r,'Catch shelf');}
        }
      }else{
        const relative=f.vy-slope.rise*speed,clearance=Math.max(0,f.y-below);
        r.air=Math.max(.035,(relative+Math.sqrt(relative*relative+2*gravity*clearance))/gravity);
      }
    }else if(deck&&deck.shape.height>0&&!r.catchShelf){
      const slope=slopeAt(c,r.s,r.x,r.branch);
      targetPitch=-Math.atan2(slope.rise+deck.shape.grade,slope.run)+Math.atan2(slope.rise,slope.run);
    }
    r.rampAngle=(r.rampAngle||0)+(targetPitch-(r.rampAngle||0))*(1-Math.exp(-dt*19));
    if(Math.abs(r.rampAngle)<.0001)r.rampAngle=0;
  }
  function wheelPosition(c,r,st){
    const p=sample(c,r.s,r.x,r.branch);
    p.heading=Math.atan2(p.tx,p.tz)+(r.yaw||0);p.progress=r.s;p.recovery=r.ghost||0;p.lane=r.x;
    p.branch=r.branch;
    if(st){p.contactY=p.y+lift(st,r);p.tireY=p.contactY;}
    return p;
  }
  function roll(c,r,dt,previous,st){
    const p=wheelPosition(c,r,st),direction=Math.sign(r.s-previous.progress);
    // Recovery deliberately moves the kart without rolling it across the jump.
    const recovered=(r.ghost||0)>previous.recovery+.1;
    const travel=recovered?0:direction*Math.hypot(p.x-previous.x,(p.tireY??p.y)-(previous.tireY??previous.y),p.z-previous.z);
    const heading=p.heading-previous.heading;
    const offset=clamp(.526*Math.atan2(Math.sin(heading),Math.cos(heading)),-Math.abs(travel),Math.abs(travel));
    Rig.advance(r,dt,p.curve,travel,offset);
  }
  function random(st){st.seed=(Math.imul(1664525,st.seed)+1013904223)>>>0;return st.seed/4294967296;}
  function create(config={}) {
    const c=track(config.trackIndex), trial=config.mode==='trial', players=clamp(config.players|0 || 1,1,8);
    const humanSeats=config.humanSeats || Array.from({length:players},(_,i)=>i), count=trial?1:clamp((config.gridSize??8)|0,1,8);
    const selection=new Map(humanSeats.filter(i=>i>=0&&i<count).map(i=>[i,mod((config.driverIndices?.[i]??(i===0?config.driverIndex:undefined)??i)|0,drivers.length)]));
    const picked=new Set(selection.values()),remaining=drivers.map((_,i)=>i).filter(i=>!picked.has(i));
    const st={trackIndex:c.index, mode:config.mode||'race',cc:normalizeCC(config.cc),difficulty:normalizeDifficulty(config.difficulty),totalLaps:clamp(config.laps|0||3,1,12),time:0,countdown:3,
      seed:(config.seed??0xACE110)>>>0,hazardSeed:(config.seed??0xACE110)>>>0,contacts:{},racers:[],pickups:[],objects:[],done:false,serial:0};
    for(let i=0;i<count;i++){
      const human=humanSeats.includes(i),d=selection.get(i)??remaining.shift()??i;
      st.racers.push({seat:i,driverIndex:d,name:drivers[d],human,s:trial?0:-3.8*(1-Math.floor(i/4))-1.7, x:trial?0:(i%4-1.5)*2.25, v:0, vx:0, yaw:0,
        branch:false,drift:0,boost:0,boostPower:0,boostStyle:'',item:-1,reveal:0,meter:trial?1:.3,active:0,guard:0,protect:0,slow:0,slip:0,air:0,bank:0,fx:0,stomp:false,
        lapTimes:[],splitTime:0,finish:0,prevItem:false,prevAbility:false,prevDrift:false,rank:i+1,hit:0,usedItem:-1,itemFx:0,itemHitKind:-1,itemHitFx:0,itemBlocked:false,itemHitSide:1,
        sap:0,sapSide:1,burr:0,burrSide:1,puff:0,puffSide:1,pine:0,confirmFx:0,confirmSeq:0,confirmedItem:-1,confirmedName:'',confirmedBlocked:false,lastValid:0,runoff:0,ghost:0,steer:0,
        contactSeq:0,contactFx:0,contactKind:'',contactSide:0,contactForce:0,contactOther:-1,contactSpeed:0,contactCarry:0,
        flight:null,launchSeq:0,landingSeq:0,landingFx:0,landingForce:0,landingKind:'',landedRamp:'',rampAngle:0,catchShelf:null,
        speedSkill:.82+.12*random(st),linePhase:random(st)*TAU,notice:'',noticeTime:0});
    }
    st.racers.forEach(r=>r.motion=Rig.fresh(r));
    st.racers.slice().sort((a,b)=>b.s-a.s).forEach((r,i)=>r.rank=i+1);
    if(!trial) for(const u of [.145,.49,.835]) for(const x of [-3.1,0,3.1]) st.pickups.push({s:u*c.length,x,cooldown:0});
    return st;
  }
  function notify(r,msg){r.notice=msg;r.noticeTime=1.5;}
  function boost(r,time,power,style=''){Signatures.boost(r,time,power,style);}
  function damage(r,type,side=1){
    if(r.protect>0||(r.active>0&&(r.driverIndex===7||(r.driverIndex===4&&type===2)))) return false;
    r.itemHitKind=type;r.itemHitFx=.8;r.itemBlocked=r.guard>0;r.itemHitSide=Math.sign(side)||1;
    if(r.guard>0){r.guard=0;r.protect=.9;notify(r,'Bark guard shattered');return true;}
    r.protect=1.65;r.hit=.5;
    if(type===1){r.sap=itemTimes.sap;r.sapSide=r.itemHitSide;r.v*=.48;notify(r,'Sap stuck');}
    if(type===2){r.burr=itemTimes.burr;r.slip=itemTimes.burr;r.burrSide=r.itemHitSide;r.v*=.82;r.vx+=r.burrSide*2.25;notify(r,'Burr snag');}
    if(type===4){r.puff=itemTimes.puff;r.puffSide=r.itemHitSide;r.vx+=side*7.4;r.x+=side*.17;notify(r,'Thistle shove');}
    if(type===5){r.pine=itemTimes.pine;r.v*=.66;r.air=.42;notify(r,'Pinecone strike');}
    return true;
  }
  function rollWeights(st,r){
    const rank=clamp(r.rank,1,st.racers.length),rear=(rank-1)/Math.max(1,st.racers.length-1);
    const leader=st.racers.reduce((a,b)=>a.s>b.s?a:b);
    const gap=Math.max(0,leader.s-r.s)/Math.max(12,(Math.max(0,leader.v)+Math.max(0,r.v))*.5);
    const deficit=clamp((gap-.45)/7.25,0,1);
    // Position controls how much of the draw can be recovery. Measured time deficit
    // chooses the recovery mix without a discontinuity as karts exchange places.
    const seed=rank===1?0:3+12*rear+9*deficit+3*rear*deficit;
    const tail=rank===1?0:.05+1.35*rear*rear+6.8*rear**3+deficit*(5+28*rear);
    const combat=[16+8*rear,26-20*rear,27-12*rear,13+9*rear,18+5*rear];
    const total=combat.reduce((a,b)=>a+b,0),remaining=100-seed-tail;
    return [seed,...combat.map(w=>w/total*remaining),tail];
  }
  function drawItem(st,r) {
    const weights=rollWeights(st,r);
    let n=random(st)*weights.reduce((v,a)=>v+a,0);
    for(let i=0;i<weights.length;i++){n-=weights[i];if(n<0)return i;}
    return 0;
  }
  function use(st,r) {
    const it=r.item; if(it<0 || r.reveal>0)return;
    r.item=-1;r.usedItem=it;r.itemFx=1.1;notify(r,items[it]);
    if(it===0){r.slip=0;r.burr=0;r.vx*=.38;r.v=Math.max(0,r.v)+4.6;boost(r,itemTimes.seed,8.7,'seed');}
    else if(it===6)boost(r,itemTimes.tailwind,5.7,'tailwind');
    else if(it===3)r.guard=itemTimes.guard;
    else {
      const road=sample(track(st.trackIndex),r.s,0,r.branch),hard=[2,3,4,5,7].includes(st.trackIndex)&&!r.branch;
      const bouncePeriod=hard?.48:.365;
      let lateral=it===2?0:r.yaw*(it===5?17:it===1?14:7);
      if(it===1){
        // A release assists the driver's line once. Targets can leave that line after firing.
        const c=track(st.trackIndex),aim=lateral;let best=Infinity;
        for(const target of st.racers){
          if(target===r||target.finish||target.branch!==r.branch)continue;
          const gap=mod(target.s-r.s+c.length/2,c.length)-c.length/2,flight=(gap-1.7)/Math.max(12,r.v+28-target.v);
          if(gap<2.5||gap>32||Math.abs(target.x-r.x-aim*flight)>1.5+gap*.068)continue;
          const miss=Math.abs(target.x-r.x-aim*flight),score=gap*.10+miss*1.4;
          if(score<best){best=score;lateral=clamp((target.x-r.x+target.vx*.22*flight)/Math.max(.12,flight),-8.5,8.5);}
        }
      }
      st.objects.push({id:++st.serial,kind:it,owner:r.seat,s:r.s+(it===2?-1.7:1.7),x:r.x,branch:r.branch,age:0,
        life:it===2?9:it===5?(hard?3.7:2.6):it===4?2.25:2.0,v:it===2?0:r.v+(it===4?12:it===5?21:28),
        vx:lateral,radius:it===4?.58:it===2?.92:.73,height:it===2?.22:.66,hitSeats:[],
        bouncePeriod,armed:it!==2,nextLandingS:r.s+1.7+(r.v+21)*bouncePeriod,edge:road.w});
    }
  }
  function ai(st,r,c,motor){
    const easy=st.difficulty==='easy',hard=st.difficulty==='hard',faster=Math.max(0,motor.speed-1);
    const look=sample(c,r.s+(easy?9:hard?15:12)*(1+faster)),here=sample(c,r.s,0,r.branch);
    let target=clamp(-look.curve*60,-2,2)+(easy?2.12:hard?1.16:1.65)*Math.sin(r.s*.019+r.linePhase);
    if(here.u>c.branchA-.035&&here.u<c.branchA+.014)target=(r.seat%3===1?2.9:-1.3);
    for(const other of st.racers)if(other!==r&&other.branch===r.branch&&other.s-r.s>0&&other.s-r.s<5&&Math.abs(r.x-other.x)<1.65)target+=r.x>other.x?1.8:-1.8;
    target=Ramps.aim(c,r,target);
    target=Hazards.avoid(st,r,c,target);
    const steer=clamp((target-r.x)*(easy?.39:hard?.55:.48)-r.vx*.13+here.curve*r.v*r.v*.056,-1,1);
    const speedSkill=easy?r.speedSkill*.83:hard?Math.min(1.04,r.speedSkill*1.11):r.speedSkill;
    const desired=Math.min((22.8-clamp(Math.abs(look.curve)*(40+faster*180),0,4+faster*12))*speedSkill*motor.speed,r.hazardPace||Infinity,r.rampPace||Infinity);
    const over=r.v-desired;
    return {gas:over<0?1:easy?.18:.38,brake:over>1?Math.min(.84,.27+faster*over*.09):0,steer,drift:Math.abs(look.curve)>.025&&r.v>12*motor.speed,
      item:r.item>=0&&r.reveal<=0&&Math.sin(st.time*2.4+r.linePhase)>.7,ability:r.meter>=1&&Math.abs(look.curve)>.014};
  }
  const halfWidth=.66,halfLength=1.01,cornerCut=.19;
  function contactBody(course,r,start,st){
    const p=wheelPosition(course,r,st),fx=Math.sin(p.heading),fz=Math.cos(p.heading);
    const forward=sample(course,r.s+.28,r.x,r.branch),behind=sample(course,r.s-.28,r.x,r.branch);
    const sx=(forward.x-behind.x)/.56,sz=(forward.z-behind.z)/.56;
    // Signed progress and lane offset form a non-orthogonal basis on the branch.
    const determinant=p.nx*sz-p.nz*sx,conversion=Math.abs(determinant)>.15?determinant:Math.sign(determinant||1)*.15;
    return {r,p,start,fx,fz,rx:fz,rz:-fx,sx,sz,conversion,
      vx:sx*r.v+p.nx*r.vx,vz:sz*r.v+p.nz*r.vx,height:p.contactY,mass:handling[r.driverIndex][5]};
  }
  function extent(body,x,z){
    const side=Math.abs(body.rx*x+body.rz*z),along=Math.abs(body.fx*x+body.fz*z);
    return halfWidth*side+halfLength*along-cornerCut*Math.min(side,along);
  }
  function contactNormal(a,b,swept){
    const dx=b.p.x-a.p.x,dz=b.p.z-a.p.z;
    const bx=swept?b.start.x-a.start.x:dx,bz=swept?b.start.z-a.start.z:dz;
    if(Math.min(dx,bx)>2.5||Math.max(dx,bx)<-2.5||Math.min(dz,bz)>2.5||Math.max(dz,bz)<-2.5)return null;
    let entry=-Infinity,exit=Infinity,entryX=0,entryZ=0,entryRadius=0;
    let minOverlap=Infinity,nx=0,nz=0,overlap=true,startOverlap=Infinity,startX=0,startZ=0,startRadius=0;
    for(const face of [a,b]){
      for(let k=0;k<4;k++){
        let x,z;
        if(k===0){x=face.rx;z=face.rz;}
        else if(k===1){x=face.fx;z=face.fz;}
        else {const s=k===2?1:-1;x=(face.fx+s*face.rx)*Math.SQRT1_2;z=(face.fz+s*face.rz)*Math.SQRT1_2;}
        const rad=extent(a,x,z)+extent(b,x,z),end=dx*x+dz*z,start=bx*x+bz*z,move=end-start;
        if(rad-Math.abs(start)<startOverlap){const sign=Math.sign(start)||Math.sign(end)||1;startOverlap=rad-Math.abs(start);startX=sign*x;startZ=sign*z;startRadius=rad;}
        const pen=rad-Math.abs(end);
        if(pen<-.00001)overlap=false;
        if(pen<minOverlap){const side=Math.sign(end)||Math.sign(start)||1;minOverlap=pen;nx=x*side;nz=z*side;}
        if(Math.abs(move)<1e-8){if(Math.abs(start)>rad+.00001)return null;continue;}
        const t0=(-rad-start)/move,t1=(rad-start)/move,first=Math.min(t0,t1);
        if(first>entry){const sign=-Math.sign(move);entry=first;entryX=x*sign;entryZ=z*sign;entryRadius=rad;}
        exit=Math.min(exit,Math.max(t0,t1));if(exit<entry-.00001)return null;
      }
    }
    if(entry>1||exit<0||(!overlap&&entry<0))return null;
    if(entry>=0){nx=entryX;nz=entryZ;minOverlap=entryRadius-(dx*nx+dz*nz);}
    else if(swept&&overlap&&startOverlap>=0){nx=startX;nz=startZ;minOverlap=startRadius-(dx*nx+dz*nz);}
    const t=entry>=0?entry:1;
    const yA=(a.start.contactY??a.height)*(1-t)+a.height*t,yB=(b.start.contactY??b.height)*(1-t)+b.height*t;
    if(Math.abs(yB-yA)>.64)return null;
    return {x:nx,z:nz,depth:Math.max(0,minOverlap)};
  }
  function toLane(body,x,z){
    return {s:(body.p.nx*z-body.p.nz*x)/body.conversion,x:(body.sz*x-body.sx*z)/body.conversion};
  }
  function shift(body,x,z){
    const d=toLane(body,x,z);body.r.x=clamp(body.r.x+d.x,-body.p.w-1.25,body.p.w+1.25);body.r.s=Math.max(-10,body.r.s+d.s);
  }
  function impulse(body,x,z){
    const d=toLane(body,x,z);body.r.v+=d.s;body.r.vx+=d.x;
    if(d.s>.20)body.r.contactCarry=Math.max(body.r.contactCarry||0,body.r.v);
  }
  function feedback(r,body,other,nx,nz,closing,tangent,brace){
    const fore=nx*body.fx+nz*body.fz,side=nx*body.rx+nz*body.rz;
    const scrape=Math.abs(tangent)>Math.max(3.5,closing*2.5);
    r.contactSeq=(r.contactSeq||0)+1;r.contactFx=.58;r.contactOther=other.seat;
    r.contactKind=brace?'brace':scrape?'glance':Math.abs(fore)>.88?(fore>0?'front':'rear'):Math.abs(side)>.89?'side':'glance';
    r.contactSide=-Math.sign(side)||Math.sign(r.x-other.x)||1;r.contactSpeed=closing;
    r.contactForce=clamp(.12+closing*.077+(scrape?Math.min(.14,Math.abs(tangent)*.012):0),.12,1);
  }
  function contacts(st,c,starts){
    if(st.racers.length<2)return;
    const memory=st.contacts||(st.contacts={});
    for(const key in memory)if(st.time-memory[key]>.24)delete memory[key];
    const bodies=st.racers.map((r,i)=>r.finish||r.ghost>0||r.driverIndex===7&&r.active>0?null:contactBody(c,r,starts[i],st));
    // The second pass resolves a kart pushed into its neighbour in a tight pack.
    for(let pass=0;pass<3;pass++){
      let resolved=false;
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
        const a=bodies[i],b=bodies[j];if(!a||!b)continue;
        const n=contactNormal(a,b,pass===0);if(!n)continue;
        const A=a.r,B=b.r,key=A.seat*8+B.seat,fresh=memory[key]===undefined;
        const rvx=a.vx-b.vx,rvz=a.vz-b.vz,closing=rvx*n.x+rvz*n.z,tx=-n.z,tz=n.x,tangent=rvx*tx+rvz*tz;
        const engaged=closing>.66||Math.abs(tangent)>3.7&&(closing>.18||n.depth>.045&&closing>-.20);
        const bracer=fresh&&engaged&&(A.driverIndex===1&&A.active>0?A:B.driverIndex===1&&B.active>0?B:null);
        const brace=bracer&&Signatures.brace(st,A,B);
        const invA=(brace&&bracer===A?.10:1)/a.mass,invB=(brace&&bracer===B?.10:1)/b.mass,sum=invA+invB;
        if(engaged&&fresh){feedback(A,a,B,n.x,n.z,closing,tangent,brace&&bracer===A);feedback(B,b,A,-n.x,-n.z,closing,tangent,brace&&bracer===B);}
        memory[key]=st.time;
        if(n.depth<.0001&&closing<=.0001)continue;
        if(n.depth>.0001){
          const move=n.depth+.0003;shift(a,-n.x*move*invA/sum,-n.z*move*invA/sum);shift(b,n.x*move*invB/sum,n.z*move*invB/sum);
        }
        if(closing>0){
          const rail=Math.abs(n.x*a.rx+n.z*a.rz);
          const bounce=fresh&&closing>1?.10+.15*rail:0,jolt=closing*(1+bounce)/sum;
          const rub=clamp(tangent*.17/sum,-jolt*.22,jolt*.22);
          const ix=n.x*jolt+tx*rub,iz=n.z*jolt+tz*rub;
          impulse(a,-ix*invA,-iz*invA);impulse(b,ix*invB,iz*invB);
          if(fresh&&engaged){A.yaw=clamp(A.yaw-(n.x*a.rx+n.z*a.rz)*.013*closing,-.48,.48);B.yaw=clamp(B.yaw+(n.x*b.rx+n.z*b.rz)*.013*closing,-.48,.48);}
        }
        bodies[i]=contactBody(c,A,starts[i],st);bodies[j]=contactBody(c,B,starts[j],st);resolved=true;
      }
      if(!resolved)break;
    }
  }
  function step(st,dt,inputs={}) {
    if(st.done)return st;
    dt=clamp(Number(dt)||0,0,.1);
    if(dt>.027){const n=Math.ceil(dt/.023);for(let i=0;i<n;i++)step(st,dt/n,inputs);return st;}
    if(st.countdown>0){st.countdown=Math.max(0,st.countdown-dt);
      for(const r of st.racers){r.steer=r.human?clamp(+inputs[r.seat]?.steer||0,-1,1):0;Rig.advance(r,dt);}
      return st;
    }
    st.time+=dt;
    const c=track(st.trackIndex),motor=motors[st.cc]||motors[100];
    const wheelStarts=st.racers.map(r=>wheelPosition(c,r,st));
    for(const p of st.pickups)p.cooldown=Math.max(0,p.cooldown-dt);
    for(const r of st.racers){
      for(const key of ['active','guard','protect','slow','slip','reveal','noticeTime','hit','fx','itemFx','itemHitFx','ghost'])r[key]=Math.max(0,r[key]-dt);
      if(!r.flight)r.air=Math.max(0,r.air-dt);
      for(const status of ['sap','burr','puff','pine','confirmFx','contactFx','landingFx'])r[status]=Math.max(0,(r[status]||0)-dt);
      r.contactCarry=Math.max(0,(r.contactCarry||0)-dt*9.8);
      Signatures.advanceBoost(r,dt);
      if(r.finish){r.v=Math.max(0,r.v-dt*5);continue;}
      const input=r.human?(inputs[r.seat]||{}):ai(st,r,c,motor),prevS=r.s;
      const road=sample(c,r.s,0,r.branch);
      const sgn=Math.sign(r.v||1), steer=clamp(+input.steer||0,-1,1),gas=clamp(+input.gas||0,0,1),brake=clamp(+input.brake||0,0,1);
      r.steer=steer;
      const drifting=!!input.drift&&r.v>7&&r.air<=0;
      if(input.item&&!r.prevItem)use(st,r);
      r.bank=clamp(r.bank+dt*(r.v>6&&(Math.abs(steer)>.27||Math.abs(road.curve)>.018)?1:-2.5),0,1);
      if(input.ability&&!r.prevAbility&&r.meter>=.998&&r.air<=0)Signatures.start(st,r,c.length);
      Signatures.tick(st,r,dt,c.length,road,input);
      r.prevItem=!!input.item;r.prevAbility=!!input.ability;
      if(drifting&&Math.abs(steer)>.16)r.drift=clamp(r.drift+dt*(.67+Math.abs(steer)*.2),0,2);
      if(!drifting&&r.prevDrift&&r.drift>.42){boost(r,.3+Math.min(r.drift,1.5)*.49,5.6);r.meter+=.045;notify(r,'Drift boost');}
      if(!drifting)r.drift=0;r.prevDrift=drifting;
      const burrowing=r.driverIndex===7&&r.active>0,verge=Math.abs(r.x)>road.w-.38&&!burrowing,car=handling[r.driverIndex];
      const slick=r.branch&&road.peak>.28&&[1,2,4,7].includes(c.index);
      const sapLoad=clamp(r.sap/.74,0,1),pineLoad=clamp(r.pine/.45,0,1);
      const governor=((c.index===4?20.1:19.0)*(1-.47*sapLoad)+(r.boost>0?r.boostPower*(1-sapLoad):0))*motor.speed;
      const top=r.sap>0?governor:Math.max(governor,r.contactCarry);
      const accel=car[1]*motor.acceleration*(r.slow>0?.5:1)*(1-.68*sapLoad)*(1-.25*pineLoad);
      const snagLoad=r.slip>0?clamp(r.burr/.4,0,1):0;
      const drag=1.1+.012*r.v*r.v+(verge&&r.air===0?5.5*car[4]:0)+(drifting&&r.active===0?1.1*Math.abs(steer):0)+4.3*snagLoad;
      const thrust=r.boost>0?(r.boostStyle==='seed'?12:r.boostStyle==='tailwind'?7.4:9):0;
      const airborne=!!r.flight;
      r.v+=(thrust*motor.acceleration*(1-.96*sapLoad)+(gas*accel-brake*(r.v>0?23*motor.brakes:4.1))*(airborne?.075:1)-sgn*((airborne?.38:drag)+1.45*sapLoad))*dt;
      if(!gas&&!brake&&r.boost===0&&Math.abs(r.v)<.22)r.v=0;
      r.v=clamp(r.v,-3.8,top);
      if(r.v>top-.2)r.v=top;
      const needle=r.driverIndex===0&&r.active>0,grip=slick&&!burrowing&&!needle?.8:1;
      const targetX=steer*(drifting?10.3:8.85)*car[0]*(needle?1.46:1)*grip*clamp(Math.abs(r.v)/5,0,1)*sgn
        -road.curve*r.v*r.v*(needle?.11:drifting?.28:.43)*car[2]+(r.puffSide||1)*8.25*clamp(r.puff/itemTimes.puff,0,1)**.74;
      r.vx+=(targetX-r.vx)*Math.min(1,dt*(airborne?.91:needle?car[3]*1.55:r.slip>0?1.35:drifting?car[3]*.56:car[3])*grip);
      if(r.burr>0&&r.slip>0)r.vx+=r.burrSide*Math.sin((itemTimes.burr-r.burr)*12)*2.9*dt;
      r.x+=r.vx*dt;
      const lim=road.w+1.25;
      if(Math.abs(r.x)>lim){r.x=clamp(r.x,-lim,lim);r.vx*=-.16;r.v=Math.min(r.v,14.3);}
      r.yaw+=(steer*(drifting?.43:.19)-r.yaw)*Math.min(1,dt*8);
      const adv=r.v*(1-(verge?.075:0))*(r.branch?1+.17*road.peak:1);
      r.s=Math.max(-10,r.s+adv*dt);
      const newU=mod(r.s,c.length)/c.length;
      if(road.u<c.branchA&&newU>=c.branchA&&r.v>0){r.branch=r.x>1.0;}
      if(r.branch&&(newU>c.branchB||newU<c.branchA-.003))r.branch=false;
      if(Math.abs(r.x)<road.w+.12){r.lastValid=r.s;r.runoff=0;}
      else if(Math.abs(r.x)>road.w+1.12&&r.v>4&&Math.sign(steer)===Math.sign(r.x)&&Math.abs(steer)>.78)r.runoff+=dt;
      else r.runoff=Math.max(0,r.runoff-dt*.45);
      if(r.runoff>(r.branch?.65:1.25)){
        r.s=Math.max(r.lapTimes.length*c.length,r.lastValid);r.x=clamp(r.x,-2.15,2.15);r.v=clamp(r.v*.65,5.5,11);r.vx=0;r.yaw=0;r.air=0;
        r.ghost=1.35;r.protect=1.35;r.runoff=0;r.drift=0;r.prevDrift=false;notify(r,'Back on course');
      }
      rampStep(st,r,c,dt,wheelStarts[r.seat]);
      const caught=Hazards.contact(st,r,c,prevS,wheelStarts[r.seat]?.lane,dt,lift(st,r));
      if(caught&&r.flight&&r.hazardHop?.at===st.time){r.hazardHop=null;}
      r.meter=clamp(r.meter+Math.max(0,r.s-prevS)/c.length*1.85,0,1);
      for(const p of st.pickups){
        const gap=mod(p.s-mod(r.s,c.length)+c.length*.5,c.length)-c.length*.5;
        if(p.cooldown<=0&&r.item<0&&!r.branch&&!burrowing&&Math.abs(gap)<1.25&&Math.abs(p.x-r.x)<1.2){
          p.cooldown=2;r.item=drawItem(st,r);r.reveal=.5;notify(r,items[r.item]);
        }
      }
    }
    if(st.mode!=='trial'){
      contacts(st,c,wheelStarts);
      for(const o of st.objects){
        o.age+=dt;o.life-=dt;o.s+=o.v*dt;o.x+=o.vx*dt;
        if(o.kind===2)o.armed=o.age>=.55;
        if(o.kind===4){o.radius=.58+o.age*.93;o.height=.68+.12*Math.sin(o.age*4);}
        if(o.kind===5){
          const lane=sample(c,o.s,0,o.branch);o.edge=lane.w-.43;
          if(Math.abs(o.x)>o.edge){const side=Math.sign(o.x);o.x=side*o.edge;o.vx=-side*Math.max(.8,Math.abs(o.vx)*.91);o.v*=.96;}
          const period=o.bouncePeriod||.42,f=mod(o.age,period)/period;
          o.height=.29+4*f*(1-f)*(.66+.16*(period>.45));o.nextLandingS=o.s+o.v*period*(1-f);
        }
        for(const r of st.racers){
          if(r.seat===o.owner||r.finish||r.branch!==o.branch||(o.kind===2&&!o.armed)||(r.flight?lift(st,r)>(o.height??.68)+.30:r.air>.22)||(r.driverIndex===7&&r.active>0)||o.hitSeats?.includes(r.seat))continue;
          const delta=mod(r.s-o.s+c.length*.5,c.length)-c.length*.5;
          if(Math.abs(delta)<1.28&&Math.abs(r.x-o.x)<(o.radius??.78)+.43){
            if(!damage(r,o.kind,Math.sign(r.x-o.x)||Math.sign(o.vx)||1))continue;
            const shooter=st.racers[o.owner];
            if(shooter){shooter.confirmFx=1.68;shooter.confirmSeq=(shooter.confirmSeq||0)+1;shooter.confirmedItem=o.kind;shooter.confirmedName=r.name;shooter.confirmedBlocked=r.itemBlocked;}
            if(o.kind===4){(o.hitSeats||(o.hitSeats=[])).push(r.seat);continue;}
            o.life=0;break;
          }
        }
      }
      st.objects=st.objects.filter(o=>o.life>0);
    }
    for(let i=0;i<st.racers.length;i++){
      const r=st.racers[i],line=(r.lapTimes.length+1)*c.length;
      if(!r.finish&&r.s>=line){
        const delta=r.s-wheelStarts[i].progress,remaining=r.s-line;
        const cross=st.time-(delta>0?clamp(remaining/delta,0,1)*dt:0);
        r.lapTimes.push(cross-r.splitTime);r.splitTime=cross;
        if(r.lapTimes.length>=st.totalLaps){r.finish=Math.max(.000001,cross);notify(r,'Finish!');}
        else notify(r,r.lapTimes.length+1===st.totalLaps?'Final lap':'Lap '+(r.lapTimes.length+1));
      }
      roll(c,r,dt,wheelStarts[i],st);
    }
    const order=st.racers.slice().sort((a,b)=>a.finish&&b.finish?a.finish-b.finish:a.finish?-1:b.finish?1:b.s-a.s);
    order.forEach((r,j)=>r.rank=j+1);
    st.done=st.racers.some(r=>r.finish)&&st.racers.filter(r=>r.human).every(r=>r.finish);
    return st;
  }
  function result(st,seat=0){
    const r=st.racers[seat]||st.racers[0];
    return {trackIndex:st.trackIndex,cc:normalizeCC(st.cc),difficulty:normalizeDifficulty(st.difficulty),driverIndex:r.driverIndex,mode:st.mode,position:r.rank,time:r.finish||st.time,bestLap:r.lapTimes.length?Math.min(...r.lapTimes):0,
      laps:r.lapTimes.slice(),standings:st.racers.slice().sort((a,b)=>a.rank-b.rank).map(a=>({name:a.name,driverIndex:a.driverIndex,position:a.rank,time:a.finish||null,human:a.human,seat:a.seat}))};
  }
  return {create,step,result,track,sample,baseSample:sample,groundSample,groundLift,lift,rampPitch,predictRamps:(st,r,c,dt,prev)=>rampStep(st,r,c,dt,prev,true),
    wheelPosition,roll,drivers,abilities,items,itemTimes,durations,engineClasses,normalizeCC,difficulties,normalizeDifficulty,rollWeights,drawItem};
});
