/* Colony boss signatures. Casts take one motion snapshot: every impact and
   muzzle is fixed when its floor warning appears, including follow-up beats. */
(() => {
  'use strict';
  const registry=window.BossPatterns||(window.BossPatterns={});
  const PI=Math.PI,TAU=PI*2;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const along=(p,a,d)=>({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d});
  function lead(api,target,seconds,pad=18){
    return api.point({x:target.x+(target.vx||0)*seconds,y:target.y+(target.vy||0)*seconds},pad);
  }
  function travel(api,e,target){
    if(Math.hypot(target.vx||0,target.vy||0)>28)return Math.atan2(target.vy,target.vx);
    if(Math.hypot(api.room.center.x-target.x,api.room.center.y-target.y)>55)return api.angle(target,api.room.center);
    return api.angle(e,target)+PI/2;
  }
  function lineAcross(api,p,a,reach,delay,duration,width,damage){
    // Intersect the line with the chamber's actual edges before marking it.
    // Clamping its endpoints independently would bend diagonal sweeps at walls.
    let lo=-reach,hi=reach;
    const room=api.room,margin=width+4,dx=Math.cos(a),dy=Math.sin(a);
    for(const [start,step,min,max] of [[p.x,dx,room.x+margin,room.x+room.w-margin],
      [p.y,dy,room.y+margin,room.y+room.h-margin]]){
      if(Math.abs(step)<.00001){if(start<min||start>max)return;continue;}
      const s=(min-start)/step,t=(max-start)/step;
      lo=Math.max(lo,Math.min(s,t));hi=Math.min(hi,Math.max(s,t));
    }
    if(hi-lo>14)api.warnLine(along(p,a,lo),along(p,a,hi),delay,duration,width,damage);
  }
  function rivets(api,origin,target,count,spread,speed,delay){
    api.volley(origin,api.angle(origin,target),count,spread,speed,delay,{shape:'dart',damage:10});
  }
  function winchScissors(g,e,t,a){
    const heading=travel(a,e,t),side=a.turn;
    const first=lead(a,t,.18,22),second=lead(a,t,.72,22);
    lineAcross(a,first,heading+side*.78,Math.min(330,a.room.w*.42),.89,.23,6,13);
    lineAcross(a,second,heading-side*.83,Math.min(340,a.room.w*.42),1.42,.26,7,14);
    if(a.phase>=2){
      const pin=a.point(along(second,heading,53),25);
      a.warnDisk(pin,a.phase===3?35:29,1.91,.24,13);
    }
  }
  function fallingFreight(g,e,t,a){
    const heading=travel(a,e,t),first=lead(a,t,.22,32),end=lead(a,t,.86,43);
    a.warnDisk(first,37,.89,.23,14);
    // The twin stacks leave a pilot-wide center aisle. The final container
    // lands in that aisle only after the stacks have finished dealing damage.
    for(const s of [-1,1]){
      const stack=a.point(along(end,heading+PI/2,s*75),34);
      if(Math.hypot(stack.x-end.x,stack.y-end.y)>48)a.warnDisk(stack,36,1.37,.25,14);
    }
    a.warnDisk(end,43,1.98,.23,15);
    if(a.phase>=2){
      const far=a.point(along(end,heading,96),34);
      if(Math.hypot(far.x-end.x,far.y-end.y)>53)a.warnDisk(far,31,2.32,.21,13);
    }
  }
  function shutter(a,t,horizontal,offset,slot,delay,phase){
    const room=a.room,pad=24,gap=phase===3?40:48;
    const left=horizontal?room.x+pad:room.y+pad,right=horizontal?room.x+room.w-pad:room.y+room.h-pad;
    const crossMin=horizontal?room.y+28:room.x+28,crossMax=horizontal?room.y+room.h-28:room.x+room.w-28;
    const cross=clamp((horizontal?t.y:t.x)+offset,crossMin,crossMax);
    const gapAt=clamp(slot,left+gap+6,right-gap-6);
    const point=n=>horizontal?{x:n,y:cross}:{x:cross,y:n};
    if(gapAt-gap-left>16)a.warnLine(point(left),point(gapAt-gap),delay,.28,8,15);
    if(right-gapAt-gap>16)a.warnLine(point(gapAt+gap),point(right),delay,.28,8,15);
  }
  function drydockShutters(g,e,t,a){
    const p=lead(a,t,.3,24),h=Math.abs(t.vx||0)>Math.abs(t.vy||0);
    const center=a.room.center,around=h?p.x:p.y,axisStep=Math.sign((h?center.x:center.y)-around)||1;
    // Stage the second shutter toward open water. Even a wall-hugging pilot
    // can either reach its cutout or shelter behind the just-expired shutter.
    const depthStep=Math.sign((h?center.y:center.x)-(h?p.y:p.x))||1;
    shutter(a,p,h,0,around+axisStep*65,.87,a.phase);
    shutter(a,p,h,depthStep*57,around-axisStep*22,1.52,a.phase);
    if(a.phase===3)shutter(a,p,h,depthStep*112,around+axisStep*43,2.20,a.phase);
  }
  function keelbreakerSalute(g,e,t,a){
    const p=lead(a,t,.49,37),forward=travel(a,e,t);
    // Rivet barges attack from opposite flanks and leave the longitudinal
    // channel open. A delayed shot down the channel punishes camping there.
    for(const [side,delay] of [[-1,.91],[1,1.32]]){
      const socket=a.point(along(p,forward+side*1.18,135),23);
      if(Math.hypot(socket.x-p.x,socket.y-p.y)>64)rivets(a,socket,p,5,.77,188,delay);
    }
    lineAcross(a,lead(a,t,.84,24),forward,186,1.96,.24,8,16);
  }
  registry[0]={
    moves:[
      {name:'Mooring Scissors',tell:1.99,recovery:.70,remote:true,counter:'Two cables cut across your course at different angles. Cross the first cable after it fades and watch where the second one lands.'},
      {name:'Falling Freight',tell:2.36,recovery:.73,remote:true,counter:'Leave the first landing circle. The paired containers leave an aisle between them, then the last container drops into that aisle.'},
      {name:'Drydock Shutters',tell:2.24,recovery:.67,remote:true,minPhase:2,counter:'Each shutter has a gap. Follow the gaps as they shift, or let a shutter finish and cross its dark rail.'},
      {name:'Keelbreaker Salute',tell:2.00,recovery:.84,remote:true,minPhase:3,counter:'Two flanks fire rivet fans in succession. Slip between the spokes, then step sideways when the long center rail starts charging.'}
    ],
    cast(i,g,e,t,a){[winchScissors,fallingFreight,drydockShutters,keelbreakerSalute][i](g,e,t,a);}
  };

  function petalEclipse(g,e,t,a){
    const p=lead(a,t,.38,20),toCenter=a.angle(p,a.room.center),hand=a.turn;
    const seeds=a.phase===1?6:8;
    // Always leave a 100-degree wedge toward the room interior. Skip any
    // socket a corner would have collapsed too close to the pilot.
    for(let i=0;i<seeds;i++){
      const side=-1+i*2/(seeds-1),bearing=toCenter+PI+side*2.15;
      const origin=a.point(along(p,bearing,131),19),dist=Math.hypot(origin.x-p.x,origin.y-p.y);
      if(dist<78)continue;
      const exitBearing=a.angle(p,origin)-toCenter;
      if(Math.cos(exitBearing)>.58)continue;
      a.volley(origin,a.angle(origin,p)+hand*.14,2,.19,a.phase===3?144:128,.98+Math.abs(side)*.31,
        {shape:'seed',curl:hand*.15,damage:9,life:2.15});
    }
    if(a.phase===3)a.warnDisk(p,33,1.79,.24,13);
  }
  function nurseryMarch(g,e,t,a){
    const heading=travel(a,e,t),start=lead(a,t,.12,24),steps=a.phase===3?4:3;
    let last=null;
    for(let i=0;i<steps;i++){
      const f=along(start,heading,i*50);
      const pod=a.point(along(f,heading+PI/2,(i%2?1:-1)*(i?24:0)),28);
      if(last&&Math.hypot(last.x-pod.x,last.y-pod.y)<20)continue;
      a.warnDisk(pod,30+i*3,.79+i*.39,.36,13);last=pod;
    }
    // Only the final seedhead opens into an outward bloom. Its missing petals
    // face inward, in the same direction as the escape from a corner.
    if(last){
      const count=13,gap=4,into=a.angle(last,a.room.center),rotation=into-(gap-1)*PI/count;
      a.ring(last,rotation,count,gap,124,1.02+(steps-1)*.39,{shape:'seed',damage:9,life:2.15});
    }
  }
  function trellisBraid(g,e,t,a){
    const p=lead(a,t,.42,38),axis=travel(a,e,t),hand=a.turn;
    const forward=along(p,axis,48);
    for(const side of [-1,1]){
      const origin=a.point(along(forward,axis+PI/2,side*118),20);
      if(Math.hypot(origin.x-p.x,origin.y-p.y)<63)continue;
      const base=a.angle(origin,p),curl=side*.62*hand;
      a.volley(origin,base+side*.31,4,.62,139,.89+(side>0?.14:0),{shape:'hook',curl,damage:9,life:2.35});
      a.volley(origin,base-side*.34,4,.58,154,1.53+(side<0?.14:0),{shape:'hook',curl:-curl,damage:9,life:2.15});
    }
    if(a.phase===3)a.warnDisk(lead(a,t,.92,32),29,2.06,.28,13);
  }
  function lanternSiphon(g,e,t,a){
    const p=lead(a,t,.46,32),inward=a.angle(p,a.room.center),clusters=[];
    for(const s of [-1,1]){
      const at=a.point(along(p,inward+s*PI*.59,103),26);
      if(Math.hypot(at.x-p.x,at.y-p.y)<54)continue;
      clusters.push(at);
      const rootAngle=a.angle(e,at),reach=Math.hypot(e.x-at.x,e.y-at.y);
      if(reach>50)a.warnLine(along(e,rootAngle,e.r+3),at,.96,.26,6,13);
      a.warnDisk(at,32,1.47,.33,14);
    }
    if(clusters.length===2){
      const center={x:(clusters[0].x+clusters[1].x)/2,y:(clusters[0].y+clusters[1].y)/2};
      a.warnDisk(center,45,2.06,.28,15);
    }else a.warnDisk(p,40,2.06,.28,15);
  }
  registry[1]={
    moves:[
      {name:'Petal Eclipse',tell:1.83,recovery:.73,remote:true,counter:'Seed sockets bloom around your path with an opening facing into the room. Move through that opening before the petals curl together.'},
      {name:'Nursery March',tell:2.25,recovery:.71,remote:true,counter:'Pods erupt in a staggered trail. Cut across the trail and read the gap in the final seedhead before it bursts.'},
      {name:'Trellis Braid',tell:2.10,recovery:.74,remote:true,minPhase:2,counter:'Two banks of hooks curl across each other, then reverse. Cross behind the first bank and check the opposite bank before turning again.'},
      {name:'Lantern Siphon',tell:2.10,recovery:.82,remote:false,minPhase:3,counter:'Step clear of the roots leading to the two pods. The pods swell first, then the floor between them erupts.'}
    ],
    cast(i,g,e,t,a){[petalEclipse,nurseryMarch,trellisBraid,lanternSiphon][i](g,e,t,a);}
  };

  function progressiveDie(g,e,t,a){
    const axis=travel(a,e,t),p=lead(a,t,.33,37),jaw=63;
    for(const side of [-1,1]){
      const start=a.point(along(p,axis+PI/2,side*jaw),21);
      if(Math.hypot(start.x-p.x,start.y-p.y)>36)lineAcross(a,start,axis,125,.91,.25,13,15);
    }
    // The first pair retracts before the knockout punch hits the center.
    lineAcross(a,p,axis,140,1.53,.27,15,16);
    if(a.phase>=2){
      const head=lead(a,t,.88,40);
      lineAcross(a,head,axis+PI/2,98,2.07,.20,9,15);
    }
  }
  function ladleSpill(g,e,t,a){
    const axis=travel(a,e,t),p=lead(a,t,.16,30);
    a.warnDisk(p,38,.85,.58,14);
    // The two forks spread outward, leaving a narrow dry route through the
    // middle. Staying on the previously predicted orbit follows a hot branch.
    for(const side of [-1,1]){
      let previous=p;
      for(let i=1;i<=2;i++){
        const at=a.point(along(p,axis+side*.62,i*73),29);
        if(Math.hypot(at.x-previous.x,at.y-previous.y)<34)continue;
        a.warnDisk(at,29+i*3,1.03+i*.38,.63,13);previous=at;
      }
    }
    if(a.phase===3){
      const tip=a.point(along(p,axis,168),30);
      a.warnDisk(tip,33,2.42,.34,15);
    }
  }
  function quenchRollers(g,e,t,a){
    const p=lead(a,t,.4,28),axis=travel(a,e,t),hand=a.turn;
    for(let i=0;i<3;i++){
      const side=i%2?-hand:hand,alongTrack=along(p,axis,(i-1)*64);
      const nozzle=a.point(along(alongTrack,axis+PI/2,side*138),21);
      if(Math.hypot(nozzle.x-p.x,nozzle.y-p.y)<59)continue;
      const aim=along(p,axis,(i-1)*30);
      a.volley(nozzle,a.angle(nozzle,aim),a.phase===3?5:4,.68,172+i*8,.87+i*.41,
        {shape:'bar',heavy:true,r:4.6,damage:11,life:2.3});
    }
    if(a.phase===3)lineAcross(a,lead(a,t,.93,21),axis+PI/2,112,2.10,.21,7,14);
  }
  function crucibleKnockout(g,e,t,a){
    const p=lead(a,t,.42,49),angle=Math.round(travel(a,e,t)/(PI/8))*(PI/8);
    // Four dies strike in two pairs. Their shared bore is a temporary refuge;
    // after they release, the marked central knockout ejects its ingot.
    for(let i=0;i<4;i++){
      const dir=angle+i*PI/2,inner=along(p,dir,43),outer=a.point(along(p,dir,139),17);
      const alongDir=(outer.x-inner.x)*Math.cos(dir)+(outer.y-inner.y)*Math.sin(dir);
      if(alongDir>13)a.warnLine(inner,outer,.85+(i%2)*.37,.30,10,15);
    }
    a.warnDisk(p,48,1.91,.25,16);
    const inward=a.angle(p,a.room.center),count=16,gap=5;
    a.ring(p,inward-(gap-1)*PI/count,count,gap,146,2.09,{shape:'diamond',heavy:true,r:4.4,damage:10,life:2.1});
  }
  registry[2]={
    moves:[
      {name:'Progressive Die',tell:2.11,recovery:.79,remote:true,counter:'The outer jaws strike first. Use the center until they retract, then step onto a cooled rail before the middle punch lands.'},
      {name:'Ladle Spill',tell:2.46,recovery:.71,remote:true,counter:'Molten pools split into two branches. Leave the first pool through the dry fork and keep an eye on the tip in phase three.'},
      {name:'Quench Rollers',tell:2.14,recovery:.75,remote:true,minPhase:2,counter:'The nozzles alternate sides. Follow the gaps in the first fan, then look across the track for the next muzzle.'},
      {name:'Crucible Knockout',tell:2.13,recovery:.85,remote:true,minPhase:3,counter:'Four dies strike in pairs. Leave the center as the dies retract and take the opening in the ring of molten fragments.'}
    ],
    cast(i,g,e,t,a){[progressiveDie,ladleSpill,quenchRollers,crucibleKnockout][i](g,e,t,a);}
  };
})();
