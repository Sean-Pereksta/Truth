(function(root, factory) {
  const server=typeof module==='object'&&module.exports;
  const api=factory(server?require('./kart-rig.js'):root.AcornRig,server?require('./signature-kit.js'):root.AcornSignatures,server?require('./hazards.js'):root.AcornHazards,server?require('./ramps.js'):root.AcornRamps,server?require('./tracks-expansion.js'):root.AcornExpansion,server?require('./breakwater-tides.js'):root.AcornBreakwater);
  if (server) module.exports = api;
  else root.AcornSim = api;
})(typeof globalThis === 'object' ? globalThis : this, function(Rig,Signatures,Hazards,Ramps,Expansion,Breakwater) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (v, n) => ((v % n) + n) % n;
  const isFrozen = (st, r, elapsed = 0) => r.freezeUntil > st.time - elapsed + 1e-9;
  const engineClasses=[50,100,150,200],difficulties=['easy','normal','hard','ultimate'];
  const normalizeCC=value=>engineClasses.includes(Number(value))?Number(value):100;
  const normalizeDifficulty=value=>difficulties.includes(value)?value:'normal';
  const motors={
    50:{speed:.76,acceleration:.84,brakes:.96},
    100:{speed:1,acceleration:1,brakes:1},
    150:{speed:1.21,acceleration:1.23,brakes:1.055},
    200:{speed:1.43,acceleration:1.49,brakes:1.11}
  };
  const astraDriver=9;
  const angelDriver=10;
  const drivers = ['Nib','Bristle','Clover','Tumble','Hazel','Ember','Flint','Mica','Solstice','Astra','Aurel'];
  const abilities = Signatures.names, durations=Signatures.durations;
  // Steering, acceleration, corner-load, transition speed, off-road resistance and bump weight.
  const handling=[
    [1.14,10.65,1.04,8.25,1.02,.79],[.91,10.4,.93,5.9,.94,1.62],
    [1.02,12.0,1.01,7.2,1.03,.88],[1.00,10.75,.84,6.15,.97,1.06],
    [1.055,10.15,.96,7.85,.80,1.10],[1.085,11.3,1.085,7.1,1.15,.89],
    [.85,9.95,.83,5.55,.73,1.40],[.995,11.0,.975,7.0,.65,1.03],
    [1.08,11.35,.99,7.65,1.0,1.04],[1.14,10.8,.96,7.35,.95,.87],
    [.98,11.15,.85,6.3,.86,1.45]
  ];
  const items = ['Seed Kick', 'Sap Sling', 'Burr Patch', 'Bark Guard', 'Thistle Puff', 'Pinecone Skip', 'Tailwind', 'Hawk', 'Tracking Quill', 'Stormburst'];
  const hawkItem=7, quillItem=8, stormItem=9, hawkDistance=.10;
  const stormRadius=6.5, stormWarning=.82, stormCooldown=25;
  const itemTimes={seed:.91,sap:3.05,burr:1.72,guard:6.0,puff:1.05,pine:1.23,tailwind:4.15,spin:1.12};
  const cruiseSpeed=(c,r)=>(c.index===4?20.1:19)+(r.driverIndex===astraDriver?.75:0);
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
  function orientRoad(points,length){
    const n=points.length;
    for(let j=0;j<n;j++){
      const p=points[j],a=points[mod(j-1,n)],b=points[(j+1)%n],dist=Math.hypot(b.x-a.x,b.z-a.z);
      p.tx=(b.x-a.x)/dist;p.tz=(b.z-a.z)/dist;p.nx=p.tz;p.nz=-p.tx;
    }
    for(let j=0;j<n;j++){const p=points[j],b=points[(j+1)%n];p.curve=Math.asin(clamp(p.tz*b.tx-p.tx*b.tz,-1,1))/(length/n);}
  }
  function track(index=0) {
    index = clamp(index | 0,0,definitions.length+Expansion.courses.length-1);
    if (cache[index]) return cache[index];
    const extra=Expansion.courses[index-definitions.length];
    const [name,length,anchors] = extra?[extra.name,extra.length,extra.anchors]:definitions[index], count = anchors.length, raw = [];
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
    const points=[], n=extra?960:640, scale=length/arc, elev=[1.9,2.2,2.2,4,.35,6,5,4][index];
    const bridgeAnchor=[4,6,11,8,4,8,4,11][index];
    const bridgeS=extra?extra.bridge:raw[bridgeAnchor*40].arc/arc;
    const branchA=extra?extra.fork[0]:[.47,.46,.31,.48,.32,.42,.31,.34][index],branchB=extra?extra.fork[1]:branchA+.16;
    for(let j=0, k=0;j<n;j++){
      const s=arc*j/n;
      while(raw[k+1].arc<s) k++;
      const a=raw[k],b=raw[k+1],f=(s-a.arc)/(b.arc-a.arc),u=j/n;
      const x=(a.x+(b.x-a.x)*f)*scale,z=(a.z+(b.z-a.z)*f)*scale;
      if(extra){
        const [y,w]=Expansion.section(extra,u);
        points.push({x,y,z,w,exposed:Expansion.exposed(index,u)});
        continue;
      }
      const bridge=Math.exp(-Math.pow((u-bridgeS)/(.045+(index===5?.018:0)),2));
      const y=1.8+elev*(1+.63*Math.sin(TAU*u-.7)+.28*Math.sin(2*TAU*u+1))+bridge*([8.5,4.2,4,3,0,7,6,4][index]);
      const tide=index===Breakwater.courseIndex?Breakwater.profile(length,u):null;
      points.push({x,y:y-(tide?.drop||0),z,w:5.4+Math.max(0,1-Math.min(u,1-u)*18)*1.15,bank:tide?.bank||0});
    }
    orientRoad(points,length);
    let branchPoints=null;
    if(extra){
      // Give each fork its own rail normals, so the route mesh, kart, camera
      // and collider all turn through the bypass rather than face the main road.
      const [, ,spread,rise,narrowWidth]=extra.fork;
      branchPoints=points.map((p,j)=>{
        const u=j/n,inside=u>branchA&&u<branchB;
        const peak=inside?Math.sin(Math.PI*(u-branchA)/(branchB-branchA))**2:0;
        const offset=peak*spread,w=p.w+(narrowWidth-p.w)*peak;
        const edgeGap=offset-p.w-w,clearance=clamp(edgeGap/Math.max(1,spread-p.w-w),0,1);
        if(inside&&edgeGap<0)p.exposed=false;
        // Keep the two ribbons level while touching at the split and merge.
        const grade=clearance*clearance*(3-2*clearance);
        return {x:p.x+p.nx*offset,y:p.y+rise*grade,z:p.z+p.nz*offset,w,exposed:p.exposed};
      });
      orientRoad(branchPoints,length);
    }
    return cache[index]={index,name,length,points,branchPoints,branchA,branchB,bridgeS,surface:extra?extra.surface:surfaces[index]};
  }
  function sample(course,distance,lane=0,branch=false) {
    const u=mod(distance,course.length)/course.length, a=u*course.points.length, i=Math.floor(a),f=a-i;
    const road=branch&&course.branchPoints?course.branchPoints:course.points;
    const p=road[i],q=road[(i+1)%road.length];
    const mix=k=>p[k]+(q[k]-p[k])*f;
    const b=clamp((u-course.branchA)/(course.branchB-course.branchA),0,1), peak=Math.sin(Math.PI*b)**2;
    const legacyFork=branch&&!course.branchPoints,offset=legacyFork?peak*12:0;
    const nx=mix('nx'),nz=mix('nz'),w=legacyFork?mix('w')-peak*2.7:mix('w');
    const bank=course.index===Breakwater.courseIndex?mix('bank'):0;
    return {x:mix('x')+nx*(offset+lane),y:mix('y')+(legacyFork?peak*([2,-.25,-1.4,3,-.3,-.6,3.5,-1][course.index]):0)+Breakwater.crossfall(bank,lane,w),z:mix('z')+nz*(offset+lane),tx:mix('tx'),tz:mix('tz'),nx,nz,curve:mix('curve'),w,u,peak,bank,exposed:!!p.exposed};
  }
  function groundSample(c,s,x=0,branch=false){
    const p=sample(c,s,x,branch);p.y+=Ramps.surface(c,s,x,branch);return p;
  }
  // Invert the local road ribbon at a world position. A global nearest-road
  // search can put the kart on a different lap segment at a grade crossing.
  function projectRoute(c,nearS,worldX,worldZ,branch){
    let s=nearS,x=0;
    for(let i=0;i<6;i++){
      const p=sample(c,s,0,branch),dx=worldX-p.x,dz=worldZ-p.z;
      x=(dx*p.nx+dz*p.nz)/(p.nx*p.nx+p.nz*p.nz);
      const forward=dx*p.tx+dz*p.tz;
      if(Math.abs(forward)<.002||i===5)break;
      const a=sample(c,s-.16,x,branch),b=sample(c,s+.16,x,branch);
      const rate=((b.x-a.x)*p.tx+(b.z-a.z)*p.tz)/.32;
      if(Math.abs(rate)<.15)break;
      s=clamp(s+clamp(forward/rate,-3,3),nearS-8,nearS+8);
    }
    return {s,x,road:groundSample(c,s,x,branch)};
  }
  function groundLift(st,r){
    if(r.catchShelf&&r.branch===r.catchShelf.branch&&r.s>=r.catchShelf.start-.06&&r.s<r.catchShelf.end)return 0;
    return Ramps.surface(track(st.trackIndex),r.s,r.x,r.branch);
  }
  function lift(st,r){
    if(Number.isFinite(r.ghostLift))return r.ghostLift;
    if(r.hawk)return groundLift(st,r)+2.2*Math.min(1,r.hawk.age/.32,(r.hawk.duration-r.hawk.age)/.30);
    if(r.fall)return r.fall.initialLift-13.5*r.fall.age*r.fall.age;
    if(r.flight){
      const clearance=r.flight.y-sample(track(st.trackIndex),r.s,r.x,r.branch).y;
      return r.flight.kind==='transfer'?clearance:Math.max(0,clearance);
    }
    return groundLift(st,r)+Hazards.lift(st,r);
  }
  function rampPitch(st,r){return Number.isFinite(r.ghostPitch)?r.ghostPitch:r.rampAngle||0;}
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
  function bankAttitude(c,r,road,headingOffset){
    const bank=road.bank;
    if(!bank)return null;
    const slope=slopeAt(c,r.s,r.x,r.branch),along=slope.rise/slope.run;
    const sin=Math.sin(headingOffset),cos=Math.cos(headingOffset);
    return {roll:Math.atan(bank*cos-along*sin),pitch:-Math.atan(along*cos+bank*sin)};
  }
  function rampStep(st,r,c,dt,prev,predict=false){
    const ramps=Ramps.list(c);
    const gravity=c.index===10?14.4:21.2;
    if(r.flight?.kind==='transfer'){
      const f=r.flight,deck=groundSample(c,r.s,r.x,r.branch);
      const oldY=f.y;
      f.y+=f.vy*dt-.5*gravity*dt*dt;f.vy-=gravity*dt;f.age+=dt;
      if(f.supported&&!Ramps.gapAt(c,r.s,r.branch)&&f.y<=deck.y+.025&&oldY>=deck.y-.14&&f.vy<=slopeAt(c,r.s,r.x,r.branch).rise*r.v+.12){
        r.flight=null;r.air=0;r.rampAngle=0;
        if(!predict){r.landingSeq=(r.landingSeq||0)+1;r.landingKind='road';r.landedRamp=f.id||'';
          r.landingForce=clamp(-f.vy/13,.12,1);r.landingFx=.45;}
      }else if(f.age>2.3||f.y<f.floor-.4){
        leaveDeck(st,r);
      }else{
        r.air=Math.max(.035,(f.vy+Math.sqrt(f.vy*f.vy+2*gravity*Math.max(0,f.y-f.floor)))/gravity);
        r.rampAngle+=(-clamp(f.vy/Math.max(9,r.v),-.43,.43)-r.rampAngle)*Math.min(1,dt*12);
      }
      return;
    }
    if(!ramps.length)return;
    const moved=r.s-prev.progress,speed=moved/Math.max(.0001,dt),ground=sample(c,r.s,r.x,r.branch);
    if(r.catchShelf&&(r.branch!==r.catchShelf.branch||r.s>r.catchShelf.end||r.s<r.catchShelf.start-.06))r.catchShelf=null;
    const gap=Ramps.gapAt(c,r.s,r.branch);
    const deck=rampEntry(c,r.s,r.x,r.branch);
    const spring=gap||deck?.ramp.style==='trampoline';
    if((r.ghost||0)>prev.recovery+.1||r.driverIndex===7&&r.active>0&&!spring){
      r.flight=null;r.catchShelf=null;r.rampAngle=0;return;
    }
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
        const elastic=ramp.style==='trampoline';
        const carry=r.air>0&&(!elastic||Hazards.lift(st,r)>.16);
        const launched=!carry&&full&&!r.catchShelf&&r.v>=ramp.minSpeed&&lipShape.height>.1;
        if(elastic&&!launched&&!carry&&gap){leaveDeck(st,r,gap);return;}
        const tangent=launched?lipShape.grade*speed:0;
        const upward=Math.min(8.4,tangent)+Math.max(0,tangent-8.4)*.55;
        const hop=carry?Hazards.lift(st,r):0,hopRate=carry?(Hazards.lift({time:st.time+.008},{...r,air:Math.max(0,r.air-.008)})-hop)/.008:0;
        r.flight={id:ramp.id,kind:carry?'carry':launched?'ramp':'drop',y:base.y+(r.catchShelf?0:Math.max(0,lipShape.height))+hop,vy:slope.rise*speed+upward+hopRate,age:0,lipS:lapLip,launchSpeed:r.v};
        if(elastic&&launched){
          // The spring supplies lift independently of uphill grade. Account for
          // takeoff speed and the actual far bank, including elevated bypasses.
          r.v=Math.max(r.v,ramp.minSpeed+8);
          const travel=r.v*(r.branch?1+.17*base.peak:1);
          const seconds=clamp((ramp.gap+7)/travel,.92,1.55);
          const landing=groundSample(c,lip+travel*seconds,ramp.lane,r.branch);
          r.flight.spring=true;r.flight.vy=(landing.y-r.flight.y)/seconds+.5*gravity*seconds;
          r.hazardHop=null;
          if(r.driverIndex===7){r.active=0;r.signature=null;}
        }
        if(launched&&!predict)r.launchSeq=(r.launchSeq||0)+1;
        elapsed=dt*(1-fraction);
      }
    }
    if(gap&&!r.flight){leaveDeck(st,r,gap);return;}
    let targetPitch=0;
    if(r.flight){
      const f=r.flight,ramp=ramps.find(a=>a.id===f.id),oldY=f.y;
      f.y+=f.vy*elapsed-.5*gravity*elapsed*elapsed;f.vy-=gravity*elapsed;f.age+=elapsed;
      const slope=slopeAt(c,r.s,r.x,r.branch),along=Math.max(4,Math.abs(speed)*slope.run);
      const landingStart=f.lipS+ramp.gap,landingEnd=landingStart+ramp.landingLength;
      if(!r.catchShelf&&prev.progress<landingStart&&r.s>=landingStart){
        const fraction=clamp((landingStart-prev.progress)/Math.max(.001,moved),0,1),crossX=prev.lane+(r.x-prev.lane)*fraction;
        const atFront=groundSample(c,landingStart+.00001,crossX,r.branch);
        if(oldY+(f.y-oldY)*fraction<atFront.y-.035){
          if(ramp.style==='trampoline'){leaveDeck(st,r,ramp);return;}
          r.catchShelf={id:f.id,start:landingStart-.10,end:landingEnd,branch:r.branch};
        }
      }
      const below=ground.y+groundLift(st,r),deckGrade=deck&&!r.catchShelf?deck.shape.grade:0,fallSpeed=(slope.rise+deckGrade)*speed-f.vy;
      targetPitch=clamp(-Math.atan2(f.vy,along)+Math.atan2(slope.rise,slope.run),-.55,.42);
      if(f.age>.02&&f.y<=below+.001&&fallSpeed>0){
        if(gap){leaveDeck(st,r,gap);return;}
        const catchLanding=ramp.style!=='trampoline'&&(r.catchShelf||r.s<landingStart-.02||(!Ramps.matchLanding(ramp,r.s,r.x)&&r.s<landingEnd&&r.s>=landingStart));
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
    const p=wheelPosition(c,r,st),direction=Math.sign(previous.branch===r.branch?r.s-previous.progress:r.v);
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
    const picked=new Set(selection.values()),remaining=drivers.map((_,i)=>i).filter(i=>i!==astraDriver&&i!==angelDriver&&!picked.has(i));
    const st={trackIndex:c.index, mode:config.mode||'race',cc:normalizeCC(config.cc),difficulty:normalizeDifficulty(config.difficulty),totalLaps:clamp(config.laps|0||3,1,12),time:0,countdown:3,
      seed:(config.seed??0xACE110)>>>0,hazardSeed:(config.seed??0xACE110)>>>0,contacts:{},racers:[],pickups:[],objects:[],done:false,serial:0,nextStormTime:14};
    for(let i=0;i<count;i++){
      const human=humanSeats.includes(i),d=selection.get(i)??remaining.shift()??i;
      st.racers.push({seat:i,driverIndex:d,name:drivers[d],human,s:trial?0:-3.8*(1-Math.floor(i/4))-1.7, x:trial?0:(i%4-1.5)*2.25, v:0, vx:0, yaw:0,
        branch:false,drift:0,driftSide:0,driftSlip:0,driftReleaseTier:0,driftReleaseSeq:0,boost:0,boostPower:0,boostStyle:'',item:-1,reveal:0,meter:trial?1:.3,active:0,guard:0,protect:0,slow:0,slip:0,air:0,bank:0,fx:0,stomp:false,
        lapTimes:[],splitTime:0,finish:0,prevItem:false,prevAbility:false,prevDrift:false,rank:i+1,hit:0,usedItem:-1,itemFx:0,itemHitKind:-1,itemHitFx:0,itemBlocked:false,itemHitSide:1,
        sap:0,sapSide:1,burr:0,burrSide:1,puff:0,puffSide:1,pine:0,spin:0,spinSide:1,confirmFx:0,confirmSeq:0,confirmedItem:-1,confirmedName:'',confirmedBlocked:false,lastValid:0,runoff:0,ghost:0,steer:0,
        contactSeq:0,contactFx:0,contactKind:'',contactSide:0,contactForce:0,contactOther:-1,contactSpeed:0,contactCarry:0,grind:0,
        fall:null,safeS:trial?0:-5,safeBranch:false,
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
  const driftRewards=[
    {charge:.42,time:.66,power:6.1,label:'Mini-turbo'},
    {charge:1.15,time:1.15,power:7.8,label:'Super mini-turbo'},
    {charge:2.05,time:1.70,power:9.3,label:'Ultra mini-turbo'}
  ];
  function driftTier(charge){
    return charge>=driftRewards[2].charge?3:charge>=driftRewards[1].charge?2:charge>=driftRewards[0].charge?1:0;
  }
  function clearDrift(r){r.drift=0;r.driftSlip=0;r.driftSide=0;r.prevDrift=false;}
  function slide(r,input,road,dt,time){
    const steer=r.steer,grounded=!r.flight&&r.air<=0&&!(r.driverIndex===7&&r.active>0);
    const eligible=grounded&&!r.spin&&r.v>7;
    const engaged=eligible&&input.drift&&(r.prevDrift||Math.abs(steer)>.18);
    if(!engaged){
      const tier=driftTier(r.drift);
      if(r.prevDrift&&!input.drift&&eligible&&tier){
        const reward=driftRewards[tier-1];
        boost(r,reward.time,reward.power,'drift');
        r.driftReleaseTier=tier;r.driftReleaseSeq=(r.driftReleaseSeq||0)+1;r.driftReleaseAt=time;
        r.meter+=.035+.014*tier;notify(r,reward.label);
      }
      clearDrift(r);return false;
    }
    if(!r.driftSide){
      r.driftSide=Math.sign(steer)||Math.sign(road.curve)||1;
      // Break rear traction on turn-in. Lateral momentum persists as the front wheels bite.
      r.vx-=r.driftSide*(.85+.8*clamp(r.v/24,0,1));
    }
    const speed=clamp((r.v-6)/10,.20,1),bend=road.curve*r.v*1.9*r.driftSide;
    const load=clamp(Math.max(0,steer*r.driftSide,bend)*speed,0,1);
    const oldSlip=r.driftSlip||0;
    r.driftSlip=oldSlip+(load-oldSlip)*Math.min(1,dt*(load>oldSlip?8.5:5.3));
    if(load>.15&&Math.abs(r.x)<road.w-.15)r.drift=Math.min(2.4,r.drift+dt*(.23+1.12*r.driftSlip));
    r.prevDrift=true;return true;
  }
  function steeringYaw(r,steer){
    if(!r.prevDrift)return steer*.19;
    const slip=r.driftSlip||0;
    const travel=Math.atan2(r.vx,Math.max(8,r.v));
    return clamp(travel*.83+steer*.11+(r.driftSide||0)*(.15+.49*slip),-.95,.95);
  }
  function spinYaw(r){
    if(!r.spin)return 0;
    const turn=1-clamp((r.spin||0)/itemTimes.spin,0,1);
    return (r.spinSide||1)*TAU*turn*(2-turn);
  }
  function damage(st,r,type,side=1){
    if(r.protect>0||(r.active>0&&(r.driverIndex===7||(r.driverIndex===4&&type===2)))) return false;
    r.itemHitKind=type;r.itemHitFx=.8;r.itemBlocked=r.guard>0;r.itemHitSide=Math.sign(side)||1;
    if(r.guard>0){r.guard=0;r.protect=.9;notify(r,'Bark guard shattered');return true;}
    r.protect=1.65;r.hit=.5;
    if(type===1){r.sap=itemTimes.sap;r.sapSide=r.itemHitSide;r.v*=.48;notify(r,'Sap stuck');}
    if(type===2){r.burr=itemTimes.burr;r.slip=itemTimes.burr;r.burrSide=r.itemHitSide;r.v*=.82;r.vx+=r.burrSide*2.25;notify(r,'Burr snag');}
    if(type===4){
      r.puff=itemTimes.puff;r.puffSide=r.itemHitSide;
      r.vx=r.vx*.64+r.puffSide*10.5;r.yaw+=r.puffSide*.18;
      notify(r,'Thistle crosswind');
    }
    if(type===5){
      clearDrift(r);r.pine=itemTimes.pine;r.v*=.44;
      if(r.flight)r.flight.vy=Math.max(6.4,r.flight.vy);
      else{
        r.air=.64;r.hazardHop={at:st.time,duration:r.air,height:1.75};
      }
      notify(r,'Pinecone launched you');
    }
    if(type===hawkItem){
      clearDrift(r);r.slow=Math.max(r.slow,.9);r.v*=.48;
      r.vx=r.itemHitSide*10.5;r.yaw+=r.itemHitSide*.22;
      notify(r,'Hawk sideswipe');
    }
    if(type===quillItem){
      r.v*=.68;r.vx+=r.itemHitSide*2.3;r.slow=Math.max(r.slow,.65);
      notify(r,'Tracking Quill hit');
    }
    if(type===stormItem){
      clearDrift(r);r.boostSources=[];r.boost=r.boostPower=r.contactCarry=0;r.boostStyle='';
      r.hawk=null;r.spin=itemTimes.spin;r.spinSide=r.itemHitSide;
      r.v*=.28;r.vx=r.vx*.35+r.spinSide*3.6;
      notify(r,'Stormburst spinout');
    }
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
    const storm=rank>=5&&st.time>=st.nextStormTime&&
      !st.objects.some(o=>o.kind===stormItem&&o.stage!=='burst')&&
      !st.racers.some(kart=>!kart.finish&&kart.item===stormItem)?(rank===8?8.4:3.3+rear*2.1):0;
    const combat=[16+8*rear,26-20*rear,27-12*rear,13+9*rear,18+5*rear,16+8*rear];
    const total=combat.reduce((a,b)=>a+b,0),remaining=100-seed-tail-storm;
    const [sap,burr,guard,puff,pine,quill]=combat.map(w=>w/total*remaining);
    return [seed,sap,burr,guard,puff,pine,tail,0,quill,storm];
  }
  function drawItem(st,r) {
    const weights=rollWeights(st,r);
    const roll=random(st);
    if(r.rank===8&&roll<.5)return hawkItem;
    let n=(r.rank===8?roll*2-1:roll)*weights.reduce((v,a)=>v+a,0);
    for(let i=0;i<weights.length;i++){
      n-=weights[i];if(n>=0)continue;
      if(i===stormItem)st.nextStormTime=st.time+stormCooldown;
      return i;
    }
    return 0;
  }
  function confirmHit(st,o,name,blocked){
    const shooter=st.racers[o.owner];
    if(!shooter)return;
    shooter.confirmFx=1.68;shooter.confirmSeq=(shooter.confirmSeq||0)+1;
    shooter.confirmedItem=o.kind;shooter.confirmedName=name;shooter.confirmedBlocked=blocked;
  }
  function stormLeader(st,owner){
    return st.racers.reduce((leader,r)=>r.seat!==owner&&!r.finish&&
      (!leader||r.s>leader.s||r.s===leader.s&&r.seat<leader.seat)?r:leader,null);
  }
  function steerQuill(st,o,c,dt){
    let target=null,best=48;
    for(const rival of st.racers){
      const gap=Signatures.gap(o.s,rival.s,c.length);
      if(rival.seat===o.owner||rival.finish||rival.fall||rival.hawk||rival.branch!==o.branch||gap<.2||gap>best)continue;
      best=gap;target=rival;
    }
    if(target){
      const seconds=best/Math.max(12,o.v-target.v);
      const aim=target.x+target.vx*Math.min(.22,seconds*.5);
      o.vx+=(clamp((aim-o.x)/Math.max(.15,seconds),-12,12)-o.vx)*Math.min(1,dt*13);
    }
    const u=sample(c,o.s,0).u;
    if(o.branch&&!(u>c.branchA&&u<c.branchB))o.branch=false;
  }
  function advanceStorm(st,o,c,dt){
    o.age+=dt;o.life-=dt;
    if(o.stage==='burst')return;
    if(o.stage==='seek'){
      const leader=stormLeader(st,o.owner);
      if(!leader){o.life=0;return;}
      o.target=leader.seat;
      const gap=leader.s-o.s;
      o.s+=Math.sign(gap)*Math.min(Math.abs(gap),Math.max(56,Math.abs(gap)*.72)*dt);
      o.branch=leader.branch;
      o.x+=(leader.x-o.x)*Math.min(1,dt*6);
      if(Math.abs(leader.s-o.s)>7.5||o.age<.55||leader.fall)return;
      const mark=leader.s+Math.max(0,leader.v)*stormWarning;
      const road=sample(c,mark,0,leader.branch);
      o.stage='warn';o.warning=stormWarning;o.startS=o.s;o.startX=o.x;
      o.blastS=mark;o.blastX=clamp(leader.x+leader.vx*.16,-road.w+.4,road.w-.4);
      o.blastLift=Ramps.surface(c,o.blastS,o.blastX,o.branch);
      o.life=Math.max(o.life,stormWarning+.05);
    }
    o.warning=Math.max(0,o.warning-dt);
    const t=1-o.warning/stormWarning;
    o.s=o.startS+(o.blastS-o.startS)*t;o.x=o.startX+(o.blastX-o.startX)*t;
    o.height=3.9*(1-t)+.35*t;
    if(o.warning>0)return;
    o.stage='burst';o.age=0;o.life=.67;o.height=.12;
    const center=sample(c,o.s,o.x,o.branch);
    const blastY=center.y+o.blastLift;
    let hitCount=0,blocked=null,lastHit=null;
    for(const r of st.racers){
      if(r.finish||r.fall)continue;
      const road=sample(c,r.s,r.x,r.branch);
      if(Math.hypot(road.x-center.x,road.z-center.z)>stormRadius||Math.abs(road.y+lift(st,r)-blastY)>2.9)continue;
      const side=Math.sign((road.x-center.x)*center.nx+(road.z-center.z)*center.nz)||(r.seat%2?1:-1);
      if(!damage(st,r,stormItem,side))continue;
      if(r.seat===o.owner)continue;
      if(r.itemBlocked)blocked=r;
      else {hitCount++;lastHit=r;}
    }
    if(lastHit)confirmHit(st,o,hitCount===1?lastHit.name:hitCount+' karts',false);
    else if(blocked)confirmHit(st,o,blocked.name,true);
  }
  function stormThreat(st,r,c){
    return st.objects.find(o=>{
      if(o.kind!==stormItem||o.stage==='burst')return false;
      if(o.target===r.seat)return true;
      if(o.stage!=='warn')return false;
      const mark=sample(c,o.blastS,o.blastX,o.branch);
      const predicted=sample(c,r.s+Math.max(0,r.v)*o.warning,r.x+r.vx*o.warning*.4,r.branch);
      return Math.hypot(mark.x-predicted.x,mark.z-predicted.z)<stormRadius+6.5&&Math.abs(mark.y-predicted.y)<5;
    });
  }
  function use(st,r) {
    const it=r.item; if(it<0 || r.reveal>0)return;
    r.item=-1;r.usedItem=it;r.itemFx=1.1;notify(r,items[it]);
    if(it===0){r.slip=0;r.burr=0;r.vx*=.38;r.v=Math.max(0,r.v)+4.6;boost(r,itemTimes.seed,8.7,'seed');}
    else if(it===6)boost(r,itemTimes.tailwind,5.7,'tailwind');
    else if(it===hawkItem){
      const c=track(st.trackIndex),cruise=cruiseSpeed(c,r)*motors[st.cc].speed;
      const distance=c.length*hawkDistance;
      let end=Math.min(r.s+distance,c.length*st.totalLaps);
      const nextMerge=r.s+mod(c.branchB*c.length-r.s,c.length);
      const gap=Ramps.gapAt(c,end,r.branch&&end<=nextMerge);
      if(gap)end=gap.startS+c.length*Math.round((end-gap.lipS)/c.length)-8;
      r.hawk={start:r.s,end,age:0,duration:distance/(cruise*2.75),lane:r.x,cruise,hitSeats:[]};
      r.flight=null;r.air=0;r.rampAngle=0;r.catchShelf=null;r.hazardHop=null;
      r.sap=r.burr=r.slip=r.pine=r.puff=r.slow=r.grind=r.spin=0;
      clearDrift(r);
    }
    else if(it===3)r.guard=itemTimes.guard;
    else if(it===stormItem){
      const leader=stormLeader(st,r.seat);
      if(!leader)return;
      st.nextStormTime=Math.max(st.nextStormTime,st.time+stormCooldown);
      st.objects.push({id:++st.serial,kind:it,owner:r.seat,s:r.s+1.7,x:r.x,branch:r.branch,age:0,
        life:16,height:3.9,stage:'seek',target:leader.seat});
    }
    else {
      const road=sample(track(st.trackIndex),r.s,0,r.branch),hard=[2,3,4,5,7].includes(st.trackIndex)&&!r.branch;
      const bouncePeriod=hard?.48:.365;
      let lateral=it===2?0:clamp(r.yaw,-.48,.48)*(it===5?17:it===1?14:7);
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
        life:it===2?9:it===5?(hard?3.7:2.6):it===4?2.25:it===quillItem?2.05:2.0,v:it===2?0:r.v+(it===4?12:it===5?21:it===quillItem?32:28),
        vx:lateral,radius:it===4?.58:it===2?.92:.73,height:it===2?.22:.66,hitSeats:[],
        bouncePeriod,armed:it!==2,nextLandingS:r.s+1.7+(r.v+21)*bouncePeriod,edge:road.w});
    }
  }
  function flyHawk(r,c,dt){
    const flight=r.hawk;
    flight.age=Math.min(flight.duration,flight.age+dt);
    r.v=(c.length*hawkDistance)/flight.duration;
    r.s=Math.min(flight.end,flight.start+r.v*flight.age);
    if(r.branch&&(r.s>flight.start+mod(c.branchB*c.length-flight.start,c.length)))r.branch=false;
    const center=clamp(flight.age/.32,0,1);
    r.x=flight.lane*(1-center)**2;
    r.vx=0;r.yaw=0;r.steer=0;
    if(r.s>=flight.end-1e-6||flight.age>=flight.duration){
      r.hawk=null;r.x=0;r.v=flight.cruise;
      r.safeS=r.lastValid=r.s;r.safeBranch=r.branch;r.runoff=0;
      r.ghost=Math.max(r.ghost,.4);r.protect=Math.max(r.protect,.4);
    }
  }
  const aiProfiles={
    easy:     {look:9,  wander:2.12, correction:.39, pace:.81, itemBeat:2,   itemWait:.80},
    normal:   {look:12, wander:1.65, correction:.48, pace:.95, itemBeat:2.4, itemWait:.70},
    hard:     {look:.62, correction:.53, charge:.71, release:.08, link:1.0, rhythm:1.65},
    ultimate: {look:.83, correction:.65, charge:.46, release:.13, link:1.90, rhythm:2.48}
  };
  function raceTraffic(st,r,c){
    let pass=null,passGap=Infinity,shot=false,chaser=false,close=false,draft=false,quill=false;
    for(const rival of st.racers){
      if(rival===r||rival.finish||rival.fall||rival.ghost>0||rival.branch!==r.branch)continue;
      const gap=Signatures.gap(r.s,rival.s,c.length);
      if(gap>2.5&&gap<45)quill=true;
      if(gap< -18||gap>32)continue;
      const lateral=Math.abs(rival.x-r.x);
      if(Math.hypot(gap,lateral)<6.2)close=true;
      if(gap<0&&lateral<2.6)chaser=true;
      if(gap>2.5&&lateral<1.5+gap*.065)shot=true;
      if(gap>.5&&gap<18&&lateral<2.55)draft=true;
      if(gap>0&&gap<passGap&&gap<3.4+Math.max(0,r.v-rival.v)*.85&&lateral<2.05){
        pass=rival;passGap=gap;
      }
    }
    return {pass,shot,chaser,close,draft,quill};
  }
  function attackItem(r,traffic,pickup,bend,edge){
    if(r.item<0||r.reveal>0||r.prevItem)return false;
    // Empty an unwanted slot before the next box. Keep a shot until a racer is in its line.
    if(pickup)return true;
    switch(r.item){
      case hawkItem:case stormItem:return true;
      case quillItem:return traffic.quill;
      case 0:case 6:return (!edge||bend<.035)&&r.boost<.35;
      case 1:case 4:case 5:return traffic.shot;
      case 2:return traffic.chaser||bend>.026;
      case 3:return r.guard<=0&&(traffic.chaser||traffic.close);
      default:return false;
    }
  }
  function raceAbility(r,traffic,bend,edge){
    if(r.meter<.998||r.air>0||r.prevAbility)return false;
    switch(r.driverIndex){
      case 0:return bend>.015||Math.abs(r.steer)>.34;
      case 1:return traffic.close;
      case 2:return !edge&&bend<.026;
      case 3:return r.bank>.55;
      case 4:return traffic.close||r.boost<.22;
      case 5:return traffic.draft||r.boost<.18;
      case 6:return traffic.close||r.sap>0||r.burr>0;
      case 7:return traffic.close||r.sap>0||r.boost<.22;
      case 8:return Math.abs(r.x)<1.6;
      case astraDriver:return r.prevDrift&&r.drift>.22;
      case angelDriver:return !r.guard && (traffic.chaser||traffic.close);
      default:return false;
    }
  }
  function raceLine(st,r,c,skill){
    const here=sample(c,r.s,0,r.branch),v=Math.max(10,r.v);
    const entry=sample(c,r.s+v*.24,0,r.branch),exit=sample(c,r.s+v*skill.look,0,r.branch);
    const bend=Math.max(Math.abs(entry.curve),Math.abs(here.curve));
    const edge=here.exposed||entry.exposed||exit.exposed;
    const room=Math.max(.55,Math.min(here.w,entry.w)-(edge?1.24:.80));
    const traffic=raceTraffic(st,r,c),car=handling[r.driverIndex];
    // A linked slide carries charge through gentle bends. Tight corners have a fixed inside apex.
    const sweep=skill.link*Math.sin(st.time*skill.rhythm+r.linePhase);
    let target=clamp((here.curve*.3+entry.curve*.7)*55,-room*.62,room*.62)
      +sweep*clamp(1-bend*8,.10,1)*Math.min(1,room/2.7);
    if(r.driverIndex===8&&r.active>0)target=0;
    let pickup=false,bestBox=Infinity;
    if(!r.branch)for(const box of st.pickups){
      const distance=box.s-here.u*c.length;
      if(distance<=0||distance>v*.80||box.cooldown>distance/v)continue;
      pickup=true;
      const cost=Math.abs(box.x-r.x-r.vx*.12);
      if(cost<bestBox){bestBox=cost;target=box.x;}
    }
    if(traffic.pass){
      const rival=traffic.pass;
      if(r.driverIndex===1&&r.active>0)target=rival.x;
      else{
        let side=Math.sign(r.x-rival.x)||Math.sign(target-rival.x)||1;
        if(Math.abs(rival.x+side*2.05)>room)side=-side;
        target=rival.x+side*2.05;
      }
    }
    for(const obj of st.objects){
      if(obj.kind!==2||obj.owner===r.seat||obj.branch!==r.branch)continue;
      const distance=Signatures.gap(r.s,obj.s,c.length);
      if(distance<0||distance>v*.83||Math.abs(target-obj.x)>1.55)continue;
      const side=obj.x>0?-1:1;
      target=obj.x+side*1.9;
    }
    // Take the quick deck unless a slower kart is blocking its entrance.
    const forkDistance=(c.branchA-here.u)*c.length;
    if(!r.branch&&forkDistance>0&&forkDistance<v*1.05){
      target=traffic.pass&&traffic.pass.x>1.2&&r.x<.8?-.8:2.4+.32*Math.sin(r.linePhase);
    }
    target=Hazards.avoid(st,r,c,Ramps.aim(c,r,target));
    target=Breakwater.dryLine(c,r,st.time,target,sample);
    target=clamp(target,-room,room);
    const holdingCorner=r.driftSide*exit.curve>.018&&r.driftSlip>.43;
    const charge=holdingCorner?(st.difficulty==='ultimate'&&bend>.028?driftRewards[2].charge:driftRewards[1].charge):skill.charge+(r.speedSkill-.82)*.55;
    const counterSlide=r.prevDrift&&(target-r.x)*r.driftSide<-.90&&r.driftSide*entry.curve<.013;
    const release=counterSlide||r.drift>=charge&&r.boost<=skill.release;
    // Hard opponents plan their slides around bends. Ultimate links short slides
    // between bends when the road has enough room for another racing line.
    const winding=bend>.014||Math.abs(exit.curve)>.018;
    const drift=r.v>8&&!release&&(winding||st.difficulty==='ultimate'&&!edge);
    const slick=r.branch&&here.peak>.28&&[1,2,4,7].includes(c.index);
    const grip=slick?.80:1;
    const counter=here.curve*r.v*r.v*car[2]*(drift?.24:.43)/((drift?11.7:8.85)*car[0]*grip);
    const steer=clamp((target-r.x)*skill.correction-r.vx*.075+counter,-1,1);
    // Only scrub speed for a real restriction. The kart governor already accounts for CC and earned boosts.
    const brakingBend=Math.max(bend,Math.abs(exit.curve)*.65);
    const cornerPace=edge?Math.sqrt(30*car[0]*grip/Math.max(.01,brakingBend*car[2])):Infinity;
    const over=r.v-Math.min(cornerPace,r.hazardPace||Infinity,r.rampPace||Infinity);
    return {gas:over>.3?.22:1,brake:over>.85?Math.min(.8,over*.13):0,steer,drift,
      item:attackItem(r,traffic,pickup,bend,edge),ability:raceAbility(r,traffic,bend,edge)};
  }
  function ai(st,r,c,motor){
    const skill=aiProfiles[st.difficulty]||aiProfiles.normal,faster=Math.max(0,motor.speed-1);
    if(skill.charge)return raceLine(st,r,c,skill);
    const look=sample(c,r.s+skill.look*(1+faster),0,r.branch),here=sample(c,r.s,0,r.branch);
    let target=clamp(-look.curve*60,-2,2)+skill.wander*Math.sin(r.s*.019+r.linePhase);
    if(here.u>c.branchA-.035&&here.u<c.branchA+.014)target=(r.seat%3===1?2.9:-1.3);
    let nearRival=false;
    for(const other of st.racers){
      if(other===r||other.fall||other.finish||other.branch!==r.branch||other.s-r.s<=0||other.s-r.s>=5||Math.abs(r.x-other.x)>=1.65)continue;
      nearRival=true;
      if(r.driverIndex!==1||r.active<=0)target+=r.x>other.x?1.8:-1.8;
    }
    target=Ramps.aim(c,r,target);
    target=Hazards.avoid(st,r,c,target);
    if(st.difficulty!=='easy')target=Breakwater.dryLine(c,r,st.time,target,sample);
    const exposed=here.exposed||look.exposed;
    if(exposed){
      const margin=Math.max(.6,Math.min(here.w,look.w)-1.05);
      target=clamp(target,-margin,margin);
    }
    const drift=Math.max(Math.abs(look.curve),Math.abs(here.curve))>.025&&r.v>10*motor.speed;
    const car=handling[r.driverIndex],counterSteer=here.curve*r.v*r.v*car[2]*(drift?.24:.43)/((drift?11.7:8.85)*car[0]);
    const steer=clamp((target-r.x)*skill.correction-r.vx*.12+counterSteer,-1,1);
    const speedSkill=Math.min(1.08,r.speedSkill*skill.pace);
    const bend=Math.max(Math.abs(look.curve),Math.abs(here.curve));
    const edgePace=exposed?Math.sqrt(24*car[0]/Math.max(.012,bend*car[2])):Infinity;
    const desired=Math.min((22.8-clamp(bend*(40+faster*180),0,4+faster*12))*speedSkill*motor.speed,edgePace,r.hazardPace||Infinity,r.rampPace||Infinity);
    const over=r.v-desired;
    return {gas:over<0?1:.28,brake:over>1?Math.min(.84,.27+faster*over*.09):0,steer,drift,
      item:r.item>=0&&r.reveal<=0&&Math.sin(st.time*skill.itemBeat+r.linePhase)>skill.itemWait,
      ability:r.meter>=1&&(r.driverIndex===1?nearRival:r.driverIndex===astraDriver?r.prevDrift&&r.drift>.22:Math.abs(look.curve)>.014)};
  }
  const halfWidth=.66,halfLength=1.01,cornerCut=.19;
  const grindPace=load=>1-.065*(load||0);
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
    const d=toLane(body,x,z),lane=body.r.x+d.x;
    body.r.x=body.r.flight?.kind==='transfer'?lane:clamp(lane,-body.p.w-1.25,body.p.w+1.25);
    body.r.s=Math.max(-10,body.r.s+d.s);
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
    r.contactForce=clamp((brace?.76:.26)+closing*.092+(scrape?Math.min(.17,Math.abs(tangent)*.015):0),.26,1);
  }
  function contacts(st,c,starts,dt){
    if(st.racers.length<2)return;
    const memory=st.contacts||(st.contacts={}),grinding=new Set();
    for(const key in memory)if(st.time-memory[key].last>.30)delete memory[key];
    const bodies=st.racers.map((r,i)=>r.finish||r.fall||r.hawk||r.ghost>0||r.driverIndex===7&&r.active>0?null:contactBody(c,r,starts[i],st));
    // The second pass resolves a kart pushed into its neighbour in a tight pack.
    for(let pass=0;pass<3;pass++){
      let resolved=false;
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
        const a=bodies[i],b=bodies[j];if(!a||!b)continue;
        const n=contactNormal(a,b,pass===0);if(!n)continue;
        const A=a.r,B=b.r,key=A.seat*8+B.seat,fresh=memory[key]===undefined;
        const fixedA=isFrozen(st,A,dt),fixedB=isFrozen(st,B,dt);
        if(fixedA&&fixedB)continue;
        const pair=memory[key]||(memory[key]={start:st.time,last:st.time});
        if(st.time-pair.last>.075)pair.start=st.time;
        pair.last=st.time;
        const rvx=a.vx-b.vx,rvz=a.vz-b.vz,closing=rvx*n.x+rvz*n.z,tx=-n.z,tz=n.x,tangent=rvx*tx+rvz*tz;
        const engaged=closing>.66||Math.abs(tangent)>3.7&&(closing>.18||n.depth>.045&&closing>-.20);
        const siding=Math.abs(n.x*a.rx+n.z*a.rz)>.56;
        if(siding&&st.time-pair.start>.25&&(A.v>4||B.v>4)){
          grinding.add(A);grinding.add(B);
        }
        const bracer=(engaged||siding&&st.time-pair.start>.1)&&(A.driverIndex===1&&A.active>0?A:B.driverIndex===1&&B.active>0?B:null);
        const brace=bracer&&!fixedA&&!fixedB&&Signatures.brace(st,A,B);
        const invA=fixedA?0:(brace&&bracer===A?.10:1)/a.mass,invB=fixedB?0:(brace&&bracer===B?.10:1)/b.mass,sum=invA+invB;
        const impact=!!brace||engaged&&fresh;
        if(impact){feedback(A,a,B,n.x,n.z,closing,tangent,brace&&bracer===A);feedback(B,b,A,-n.x,-n.z,closing,tangent,brace&&bracer===B);}
        if(n.depth<.0001&&closing<=.0001&&!impact)continue;
        if(n.depth>.0001){
          const move=n.depth+.0003;
          if(invA)shift(a,-n.x*move*invA/sum,-n.z*move*invA/sum);
          if(invB)shift(b,n.x*move*invB/sum,n.z*move*invB/sum);
        }
        if(closing>0||impact){
          // A first strike separates the hulls. Continued contact only resolves overlap.
          const heavyBumper=A.driverIndex===1||B.driverIndex===1;
          const strike=impact?(brace?6.2:heavyBumper?4.6:2.6)+Math.min(2.6,Math.abs(tangent)*.1):0;
          // Nose-to-tail momentum already carries the struck kart forward. A smaller
          // rebound leaves a drafting kart enough speed to steer out and pass.
          const kick=strike*(siding||brace?1:.60);
          const rebound=impact?(siding?.49:.22):0,jolt=(Math.max(0,closing)*(1+rebound)+kick)/sum;
          const rub=clamp(tangent*.17/sum,-jolt*.22,jolt*.22);
          const ix=n.x*jolt+tx*rub,iz=n.z*jolt+tz*rub;
          impulse(a,-ix*invA,-iz*invA);impulse(b,ix*invB,iz*invB);
          if(impact){
            const twist=Math.min(.28,.04+.023*Math.max(0,closing)+.012*kick);
            if(!fixedA)A.yaw=clamp(A.yaw-(n.x*a.rx+n.z*a.rz)*twist,-.48,.48);
            if(!fixedB)B.yaw=clamp(B.yaw+(n.x*b.rx+n.z*b.rz)*twist,-.48,.48);
          }
        }
        bodies[i]=contactBody(c,A,starts[i],st);bodies[j]=contactBody(c,B,starts[j],st);resolved=true;
      }
      if(!resolved)break;
    }
    for(const r of st.racers){
      const previous=r.grind||0;
      r.grind=clamp(previous+dt*(grinding.has(r)?2:-4),0,1);
      // Apply each increment once, even if three karts are leaning on one another.
      if(r.grind>previous&&r.v>0)r.v*=grindPace(r.grind)/grindPace(previous);
    }
  }
  function leaveDeck(st,r,pad){
    const duration=1.12,initialLift=lift(st,r);
    r.fall={age:0,duration,initialLift,side:Math.sign(r.x)||1};
    const c=track(st.trackIndex);
    pad=pad||Ramps.gapAt(c,r.s,r.branch)||Ramps.list(c).find(p=>p.style==='trampoline'&&p.id===r.flight?.id);
    if(pad){
      // Give the kart enough run-up to clear the same gap even after a miss
      // at the far bank. Subsequent laps retain their absolute progress.
      r.fall.retryS=pad.startS+c.length*Math.round((r.s-pad.lipS)/c.length)-13;
      r.fall.retryLane=pad.lane;r.fall.retryBranch=pad.branch;
    }
    r.flight=null;r.catchShelf=null;r.hazardHop=null;r.air=0;r.rampAngle=0;
    r.ghost=duration+.5;r.protect=duration+.5;r.boostSources=[];r.boost=0;r.active=0;
    r.signature=null;r.stomp=false;clearDrift(r);r.v=0;r.contactCarry=0;r.grind=0;
    notify(r,'Over the edge!');
  }
  function transferFlight(st,r,c,previous,edgeHop){
    if(r.flight?.kind==='transfer')return;
    const flight=r.flight,hop=Hazards.lift(st,r);
    const hopRate=r.air>0?(Hazards.lift({time:st.time+.008},{...r,air:Math.max(0,r.air-.008)})-hop)/.008:0;
    const base=sample(c,previous.progress,previous.lane,previous.branch);
    const floor=base.y+groundLift(st,r);
    r.flight={kind:'transfer',id:flight?.id||'',age:0,floor,supported:false,
      y:flight?.y??Math.max(previous.contactY??floor, floor+hop),
      vy:flight?.vy??(slopeAt(c,r.s,r.x,r.branch).rise*r.v+(edgeHop?3.1:hopRate))};
    r.air=Math.max(.035,r.air);r.catchShelf=null;r.hazardHop=null;
  }
  function enterRoute(st,r,c,target,previous){
    // Preserve heading and planar velocity as well as position. On an angled
    // bypass, a sideways velocity in one ribbon also has a forward component
    // in the other.
    const old=contactBody(c,r,previous,st),speedScale=p=>r.branch?1+.17*p.peak:1;
    const along=r.v*speedScale(old.p);
    const vx=old.sx*along+old.p.nx*r.vx,vz=old.sz*along+old.p.nz*r.vx;
    r.s=target.s;r.x=target.x;r.branch=!r.branch;r.catchShelf=null;r.runoff=0;
    const dest=contactBody(c,r,previous,st),v=toLane(dest,vx,vz);
    r.v=v.s/speedScale(dest.p);r.vx=v.x;
    const angle=old.p.heading-Math.atan2(dest.p.tx,dest.p.tz);
    r.yaw=Math.atan2(Math.sin(angle),Math.cos(angle));
  }
  function tireReach(road,heading){
    // Project all four tire centers onto the deck normal. The second tire
    // reaches the edge at |side - axle|, including when the kart is yawed.
    const fx=Math.sin(heading),fz=Math.cos(heading);
    const side=.46*Math.abs(fz*road.nx-fx*road.nz),axle=.69*Math.abs(fx*road.nx+fz*road.nz);
    return Math.abs(side-axle)+.035;
  }
  function resolveRoute(st,r,c,dt,previous){
    const u=mod(r.s,c.length)/c.length,inside=u>=c.branchA&&u<=c.branchB;
    if(inside&&previous.u<c.branchA&&r.v>0)r.branch=r.x>1;
    if(!inside&&r.branch)r.branch=false;
    let road=sample(c,r.s,r.x,r.branch);
    const edge=r.branch?-r.x:r.x,sourceClear=road.w-Math.abs(r.x);
    let target=null;
    if(inside&&(edge>=road.w-.60||r.flight?.kind==='transfer')){
      target=projectRoute(c,r.s,road.x,road.z,!r.branch);
      if(target.road.u<c.branchA||target.road.u>c.branchB||
          Math.hypot(road.x-target.road.x,road.z-target.road.z)>.10)target=null;
    }
    if(target){
      const heading=Math.atan2(road.tx,road.tz)+r.yaw;
      const sourceY=road.y+groundLift(st,r),feet=r.flight?.y??(sourceY+Hazards.lift(st,r));
      const sourceSupport=sourceClear>=-tireReach(road,heading);
      const targetClear=target.road.w-Math.abs(target.x),rise=target.road.y-feet;
      const jumping=!!r.flight||r.air>0;
      // A small step is driveable. In flight, the tires must actually reach
      // the top; passing beneath an elevated ribbon never captures the kart.
      if(targetClear>=-tireReach(target.road,heading)&&targetClear>sourceClear+.32&&rise<=(jumping?.10:.55)&&
          (target.road.y>=sourceY-.32||!sourceSupport)){
        if(jumping||rise<-.32)transferFlight(st,r,c,previous,false);
        enterRoute(st,r,c,target,previous);road=target.road;
      }else if(sourceClear<-.24&&r.flight?.kind!=='transfer'){
        const towards=(r.branch?-1:1)*r.vx;
        // A moving kart can carry over a short seam. Wider gaps need a real
        // jump. Both follow a ballistic path until wheels reach a real deck.
        const shortGap=towards>1.8&&Math.abs(r.v)>5&&-targetClear<=.24+towards*.24&&rise<=.55&&rise>=-1.25;
        if((jumping&&edge>0)||shortGap)transferFlight(st,r,c,previous,!jumping);
      }
    }
    if(r.flight?.kind==='transfer'){
      const f=r.flight,ground=road.y+groundLift(st,r);
      // A projected target already includes its ramp surface.
      const deckY=target?.road===road?target.road.y:ground;
      f.floor=Math.min(deckY,target?.road.y??deckY);
      const heading=Math.atan2(road.tx,road.tz)+r.yaw;
      f.supported=Math.abs(r.x)<=road.w+tireReach(road,heading)&&f.y>=deckY-.10;
      return road;
    }
    if(road.exposed&&Math.abs(r.x)>road.w+.24){leaveDeck(st,r);return null;}
    const limit=road.w+1.25;
    if(Math.abs(r.x)>limit){r.x=clamp(r.x,-limit,limit);r.vx*=-.16;r.v=Math.min(r.v,14.3);}
    return road;
  }
  function recoverFall(r,c,dt){
    const f=r.fall;f.age+=dt;
    r.x+=f.side*(.85+Math.min(3,Math.abs(r.vx)))*dt;
    r.rampAngle=Math.min(.60,f.age*.67);
    if(f.age<f.duration)return;
    // Rejoin the same route behind the departure. A fall can never advance a lap.
    const lapFloor=r.lapTimes.length?r.lapTimes.length*c.length:-10;
    r.s=Math.max(lapFloor,f.retryS??clamp(r.safeS??r.s-5,r.s-9,r.s-2));
    const u=mod(r.s,c.length)/c.length;
    r.branch=(f.retryBranch??r.safeBranch)&&u>c.branchA&&u<c.branchB;
    r.fall=null;r.x=f.retryLane??0;r.v=5.5;r.vx=0;r.yaw=0;r.rampAngle=0;r.runoff=0;
    r.ghost=1.35;r.protect=1.35;r.lastValid=r.s;notify(r,'Back on course');
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
    const hawkPasses=[];
    for(const p of st.pickups)p.cooldown=Math.max(0,p.cooldown-dt);
    for(const r of st.racers){
      const locked=isFrozen(st,r,dt);
      for(const key of ['active','guard','protect','slow','slip','reveal','noticeTime','hit','fx','itemFx','itemHitFx','ghost'])r[key]=Math.max(0,r[key]-dt);
      if(!r.flight&&!locked)r.air=Math.max(0,r.air-dt);
      for(const status of ['sap','burr','puff','pine','spin','confirmFx','contactFx','landingFx'])r[status]=Math.max(0,(r[status]||0)-dt);
      r.contactCarry=Math.max(0,(r.contactCarry||0)-dt*9.8);
      Signatures.advanceBoost(r,dt);
      if(r.finish){r.v=Math.max(0,r.v-dt*5);continue;}
      if(r.fall){recoverFall(r,c,dt);continue;}
      if(locked){
        r.v=r.vx=r.steer=0;
        r.prevItem=r.human&&!!inputs[r.seat]?.item;
        r.prevAbility=r.human&&!!inputs[r.seat]?.ability;
        continue;
      }
      const input=r.human?(inputs[r.seat]||{}):ai(st,r,c,motor),prevS=r.s;
      const road=sample(c,r.s,0,r.branch);
      const spinLoad=clamp(r.spin/.48,0,1),control=1-.87*spinLoad;
      const sgn=Math.sign(r.v||1), steer=clamp(+input.steer||0,-1,1)*control,gas=clamp(+input.gas||0,0,1)*control,brake=clamp(+input.brake||0,0,1)*control;
      r.steer=steer;
      if(input.item&&!r.prevItem&&!r.hawk)use(st,r);
      if(r.hawk){
        hawkPasses.push({r,flight:r.hawk});
        r.prevItem=!!input.item;r.prevAbility=!!input.ability;
        flyHawk(r,c,dt);
        continue;
      }
      r.bank=clamp(r.bank+dt*(r.v>6&&(Math.abs(steer)>.27||Math.abs(road.curve)>.018)?1:-2.5),0,1);
      if(input.ability&&!r.prevAbility&&!r.spin&&r.meter>=.998&&r.air<=0)Signatures.start(st,r,c.length);
      Signatures.tick(st,r,dt,c.length,road,input);
      r.prevItem=!!input.item;r.prevAbility=!!input.ability;
      const drifting=slide(r,input,road,dt,st.time);
      const burrowing=r.driverIndex===7&&r.active>0,verge=Math.abs(r.x)>road.w-.38&&!burrowing,car=handling[r.driverIndex];
      const slick=r.branch&&road.peak>.28&&[1,2,4,7].includes(c.index);
      const sapLoad=clamp(r.sap/.74,0,1),pineLoad=clamp((r.pine||0)/.64,0,1);
      const engineLoad=Math.max(sapLoad,pineLoad),water=Breakwater.load(c,r,st.time,sample);
      const governor=(cruiseSpeed(c,r)*(1-Math.max(.47*sapLoad,.49*pineLoad))+(r.boost>0?r.boostPower*(1-engineLoad):0))*motor.speed*(1-.58*spinLoad);
      const top=(engineLoad>0?governor:Math.max(governor,r.contactCarry))*grindPace(r.grind);
      const accel=car[1]*motor.acceleration*(r.slow>0?.5:1)*(1-.68*sapLoad)*(1-.67*pineLoad)*(1-.22*water);
      const snagLoad=r.slip>0?clamp(r.burr/.4,0,1):0;
      const drag=1.1+.012*r.v*r.v+(verge&&r.air===0?5.5*car[4]:0)+(drifting&&r.active===0?1.1*Math.abs(steer):0)+4.3*snagLoad+(1.7+.15*Math.abs(r.v))*water;
      const thrust=r.boost>0?(r.boostStyle==='seed'?12:r.boostStyle==='tailwind'?7.4:9):0;
      const airborne=!!r.flight;
      r.v+=(thrust*motor.acceleration*(1-.96*engineLoad)+(gas*accel-brake*(r.v>0?23*motor.brakes:4.1))*(airborne?.075:1)-sgn*((airborne?.38:drag)+1.45*sapLoad))*dt;
      if(!gas&&!brake&&r.boost===0&&Math.abs(r.v)<.22)r.v=0;
      r.v=clamp(r.v,-3.8,top);
      if(r.v>top-.2)r.v=top;
      if(water>0)r.v=Breakwater.drag(r.v,water,top,dt);
      const needle=r.driverIndex===0&&r.active>0,grip=(slick&&!burrowing&&!needle?.8:1)*(1-.17*water);
      const targetX=steer*(drifting?11.7:8.85)*car[0]*(needle?1.46:1)*grip*clamp(Math.abs(r.v)/5,0,1)*sgn
        -road.curve*r.v*r.v*(needle?.11:drifting?.24:.43)*car[2]+(r.puffSide||1)*12.8*clamp((r.puff||0)/.80,0,1)**1.35+r.spinSide*3*spinLoad
        -(!airborne&&r.air===0?road.bank*3.3*clamp(Math.abs(r.v)/4,0,1):0);
      const impactGrip=r.contactFx>.23?1-.48*r.contactForce:1;
      r.vx+=(targetX-r.vx)*Math.min(1,dt*(airborne?.91:needle?car[3]*1.55:r.slip>0?1.35:drifting?car[3]*.47:car[3])*grip*impactGrip);
      if(r.burr>0&&r.slip>0)r.vx+=r.burrSide*Math.sin((itemTimes.burr-r.burr)*12)*2.9*dt;
      r.x+=r.vx*dt;
      r.yaw+=(steeringYaw(r,steer)-r.yaw)*Math.min(1,dt*(drifting?9.5:8));
      const adv=r.v*(1-(verge?.075:0))*(r.branch?1+.17*road.peak:1);
      r.s=Math.max(-10,r.s+adv*dt);
      const previous=wheelStarts[r.seat],arrival=resolveRoute(st,r,c,dt,previous);
      if(!arrival)continue;
      if(!r.flight&&r.air<=0&&Math.abs(r.x)<arrival.w-.62){r.safeS=r.s;r.safeBranch=r.branch;}
      if(Math.abs(r.x)<arrival.w+.12){r.lastValid=r.s;r.runoff=0;}
      else if(!r.flight&&Math.abs(r.x)>arrival.w+1.12&&r.v>4&&Math.sign(steer)===Math.sign(r.x)&&Math.abs(steer)>.78)r.runoff+=dt;
      else r.runoff=Math.max(0,r.runoff-dt*.45);
      if(r.runoff>(r.branch?.65:1.25)){
        r.s=Math.max(r.lapTimes.length*c.length,r.lastValid);r.x=clamp(r.x,-2.15,2.15);r.v=clamp(r.v*.65,5.5,11);r.vx=0;r.yaw=0;r.air=0;
        r.ghost=1.35;r.protect=1.35;r.runoff=0;clearDrift(r);notify(r,'Back on course');
      }
      rampStep(st,r,c,dt,previous);
      if(r.fall)continue;
      const from=previous.branch===r.branch?{s:prevS,x:previous.lane}:projectRoute(c,prevS,previous.x,previous.z,r.branch);
      const caught=Hazards.contact(st,r,c,from.s,from.x,dt,lift(st,r));
      if(caught&&r.flight&&r.hazardHop?.at===st.time){r.hazardHop=null;}
      if(caught&&isFrozen(st,r)){
        clearDrift(r);r.contactCarry=r.steer=0;
        continue;
      }
      r.meter=clamp(r.meter+Math.max(0,Math.min(adv*dt,r.s-prevS))/c.length*1.85,0,1);
      for(const p of st.pickups){
        const gap=mod(p.s-mod(r.s,c.length)+c.length*.5,c.length)-c.length*.5;
        if(p.cooldown<=0&&r.item<0&&!r.branch&&!burrowing&&Math.abs(gap)<1.25&&Math.abs(p.x-r.x)<1.2){
          r.rank=1+st.racers.filter(other=>other!==r&&(other.finish||other.s>r.s||(other.s===r.s&&other.seat<r.seat))).length;
          p.cooldown=2;r.item=drawItem(st,r);r.reveal=.5;notify(r,items[r.item]);
        }
      }
    }
    if(st.mode!=='trial'){
      for(const {r,flight} of hawkPasses){
        const start=wheelStarts[r.seat];
        for(const target of st.racers){
          if(target===r||target.finish||target.fall||target.hawk||target.branch!==r.branch||flight.hitSeats.includes(target.seat))continue;
          const before=wheelStarts[target.seat];
          const gap=mod(before.progress-start.progress+c.length*.5,c.length)-c.length*.5;
          const endGap=gap+(target.s-before.progress)-(r.s-start.progress);
          if(Math.min(gap,endGap)>1.5||Math.max(gap,endGap)<-1.5)continue;
          const fraction=gap===endGap?1:clamp(gap/(gap-endGap),0,1);
          const lane=before.lane-start.lane+fraction*(target.x-r.x-before.lane+start.lane);
          if(Math.abs(lane)>2.3||Math.abs(wheelPosition(c,target,st).contactY-sample(c,r.s,r.x,r.branch).y)>3.4)continue;
          if(damage(st,target,hawkItem,Math.sign(lane)||(target.seat%2?1:-1)))flight.hitSeats.push(target.seat);
        }
      }
      contacts(st,c,wheelStarts,dt);
      for(const o of st.objects){
        if(o.kind===stormItem){advanceStorm(st,o,c,dt);continue;}
        if(o.kind===quillItem)steerQuill(st,o,c,dt);
        o.age+=dt;o.life-=dt;o.s+=o.v*dt;o.x+=o.vx*dt;
        if(o.kind===2)o.armed=o.age>=.55;
        if(o.kind===4){o.radius=.68+o.age*1.28;o.height=.68+.12*Math.sin(o.age*4);}
        let bounce=null;
        if(o.kind===5){
          const lane=sample(c,o.s,0,o.branch);o.edge=lane.w-.43;
          if(Math.abs(o.x)>o.edge){const side=Math.sign(o.x);o.x=side*o.edge;o.vx=-side*Math.max(.8,Math.abs(o.vx)*.91);o.v*=.96;}
          const period=o.bouncePeriod||.42,f=mod(o.age,period)/period;
          o.height=.29+4*f*(1-f)*(.66+.16*(period>.45));o.nextLandingS=o.s+o.v*period*(1-f);
          o.landingRadius=period>.45?1.95:1.55;
          if(Math.floor(o.age/period)>Math.floor((o.age-dt)/period)){
            const ageSinceBounce=f*period;
            bounce={s:o.s-o.v*ageSinceBounce,x:o.x-o.vx*ageSinceBounce,radius:o.landingRadius};
          }
        }
        for(const r of st.racers){
          if(r.seat===o.owner||r.finish||r.fall||r.hawk||r.branch!==o.branch||(o.kind===2&&!o.armed)||(!r.flight&&r.air>.22)||(r.driverIndex===7&&r.active>0)||o.hitSeats?.includes(r.seat))continue;
          const delta=mod(r.s-o.s+c.length*.5,c.length)-c.length*.5;
          const direct=Math.abs(delta)<1.28&&Math.abs(r.x-o.x)<(o.radius??.78)+.43;
          const onBounce=bounce&&Math.hypot(delta+o.s-bounce.s,r.x-bounce.x)<bounce.radius;
          if(direct||onBounce){
            const height=lift(st,r);
            if(!(direct&&height<=(o.height??.68)+.30)&&!(onBounce&&height<.45))continue;
            if(!damage(st,r,o.kind,Math.sign(r.x-o.x)||Math.sign(o.vx)||1))continue;
             confirmHit(st,o,r.name,r.itemBlocked);
            if(o.kind===4){(o.hitSeats||(o.hitSeats=[])).push(r.seat);continue;}
            o.life=0;break;
          }
        }
      }
      st.objects=st.objects.filter(o=>o.life>0);
    }
    for(let i=0;i<st.racers.length;i++){
      const r=st.racers[i],line=(r.lapTimes.length+1)*c.length;
      if(!r.finish&&!r.fall&&r.s>=line){
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
    const humansFinished=st.racers.some(r=>r.finish)&&st.racers.every(r=>!r.human||r.finish);
    if(st.mode==='cup'&&humansFinished){
      st.classificationStart??=st.time;
      st.done=st.racers.every(r=>r.finish)||st.time-st.classificationStart>=45;
    }else st.done=humansFinished;
    return st;
  }
  function result(st,seat=0){
    const r=st.racers[seat]||st.racers[0];
    return {trackIndex:st.trackIndex,cc:normalizeCC(st.cc),difficulty:normalizeDifficulty(st.difficulty),driverIndex:r.driverIndex,mode:st.mode,position:r.rank,time:r.finish||st.time,bestLap:r.lapTimes.length?Math.min(...r.lapTimes):0,
      laps:r.lapTimes.slice(),standings:st.racers.slice().sort((a,b)=>a.rank-b.rank).map(a=>({name:a.name,driverIndex:a.driverIndex,position:a.rank,time:a.finish||null,human:a.human,seat:a.seat}))};
  }
  return {create,step,result,track,trackCount:definitions.length+Expansion.courses.length,sample,baseSample:sample,groundSample,groundLift,lift,rampPitch,predictRamps:(st,r,c,dt,prev)=>rampStep(st,r,c,dt,prev,true),
    projectRoute,resolveRoute,wheelPosition,bankAttitude,roll,isFrozen,flyHawk,hawkItem,quillItem,stormItem,stormRadius,stormThreat,driftTier,steeringYaw,spinYaw,drivers,abilities,items,itemTimes,durations,engineClasses,normalizeCC,difficulties,normalizeDifficulty,rollWeights,drawItem};
});
