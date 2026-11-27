/* Cinder Relay | late-gate boss attack scores. Coordinates lock when the boss gives its tell. */
(() => {
  'use strict';
  const patterns=window.BossPatterns||(window.BossPatterns={});
  const PI=Math.PI,TAU=2*PI;
  const dart={shape:'dart'},seed={shape:'seed'},iron={heavy:true,shape:'diamond',damage:13};

  // Lay a score in local coordinates, with an inward escape direction at a corner.
  function inward(target,boss,api){
    const room=api.room,center=room.center;
    if(Math.hypot(center.x-target.x,center.y-target.y)<45)return api.angle(target,boss);
    return api.angle(target,center);
  }
  function station(api,center,axis,along,across,padding=10){
    const dx=Math.cos(axis),dy=Math.sin(axis);
    return api.point({x:center.x+dx*along-dy*across,y:center.y+dy*along+dx*across},padding);
  }
  // Only the pilot's direction at the beginning of the tell is sampled. The plotted
  // attacks cannot follow subsequent turns or a change of target in co-op.
  function travel(g,target,fallback){
    if(Math.hypot(target.vx||0,target.vy||0)>20)return Math.atan2(target.vy,target.vx);
    const pilots=g.players?.length?g.players:[g.player];
    let chosen=null,near=Infinity;
    for(const p of pilots){
      if(!p||p.downed||p.hp<=0)continue;
      const d=Math.hypot(p.x-target.x,p.y-target.y);
      if(d<near){near=d;chosen=p;}
    }
    return chosen&&Math.hypot(chosen.moveX||0,chosen.moveY||0)>.18
      ?Math.atan2(chosen.moveY,chosen.moveX):fallback;
  }
  function aimedGap(api,from,toward,count,gap,speed,delay,style){
    const opening=api.angle(from,toward)-(gap-1)*PI/count;
    api.ring(from,opening,count,gap,speed,delay,style);
  }
  function gateBar(api,target,axis,depth,gap,delay){
    const at=x=>station(api,target,axis,depth,x);
    api.warnLine(at(-123),at(gap-25),delay,.35,5,13);
    api.warnLine(at(gap+25),at(123),delay,.35,5,13);
  }

  patterns[3]={
    moves:[
      {name:'Antiphon',tell:1.50,recovery:.76,remote:false,
        counter:'Step out of the conducting mark, then cut behind the second answering fan.'},
      {name:'Rest Measure',tell:1.85,recovery:.76,remote:true,
        counter:'Each broken bar has a fifty-pixel rest. Follow the gaps as they change sides.'},
      {name:'Fermata',minPhase:2,tell:1.88,recovery:.88,remote:true,
        counter:'Leave through the open side of the triangle before its center sounds.'}
    ],
    cast(i,g,e,target,api){
      const axis=i===0?api.angle(target,e):inward(target,e,api),side=api.turn;
      const at=(along,across,pad)=>station(api,target,axis,along,across,pad);
      if(i===0){
        const depth=Math.min(116,Math.hypot(e.x-target.x,e.y-target.y));
        const left=at(depth,side*70),right=at(depth,-side*70);
        api.warnDisk(target,24,.81,.20,13);
        api.volley(left,api.angle(left,at(-12,-side*24)),5,1.03,165,.93,dart);
        api.volley(right,api.angle(right,at(30,side*16)),6,1.17,183,1.48,dart);
      }else if(i===1){
        gateBar(api,target,axis,0,side*46,.88);
        gateBar(api,target,axis,43,0,1.36);
        gateBar(api,target,axis,86,-side*43,1.84);
      }else{
        const rear=at(-76,0),left=at(52,-85),right=at(52,85);
        api.warnLine(rear,left,.86,1.18,5,13);
        api.warnLine(rear,right,.86,1.18,5,13);
        api.warnLine(left,at(52,-30),.86,1.18,5,13);
        api.warnLine(at(52,30),right,.86,1.18,5,13);
        api.warnDisk(target,49,1.85,.25,16);
      }
    }
  };
  patterns[4]={
    moves:[
      {name:'Ghost Exchange',tell:1.71,recovery:.77,remote:true,
        counter:'Leave the paired images sideways. The bridge lights between them on the last beat.'},
      {name:'Spindle Shutters',tell:1.48,recovery:.88,remote:false,
        counter:'Read each spindle separately. The wide missing wedges point to different sides.'},
      {name:'Aperture Inversion',minPhase:2,tell:2.10,recovery:.94,remote:true,
        counter:'Use the hollow eye through the first set of spokes, then leave on a diagonal before it shuts.'}
    ],
    cast(i,g,e,target,api){
      const axis=i===1?api.angle(target,e):inward(target,e,api),side=api.turn;
      const at=(along,across,pad)=>station(api,target,axis,along,across,pad);
      if(i===0){
        const heading=travel(g,target,axis),twin=station(api,target,heading,103,0,16);
        // At a wall a projected twin can coincide with its source. Move it inward.
        const echo=Math.hypot(twin.x-target.x,twin.y-target.y)>58?twin:at(104,0,16);
        api.warnDisk(target,29,.80,.26,14);
        api.warnDisk(echo,34,1.16,.27,14);
        api.warnLine(target,echo,1.69,.40,8,15);
      }else if(i===1){
        const left=at(68,-side*97),right=at(68,side*97);
        aimedGap(api,left,at(10,side*22),17,4,132,.88,dart);
        // The return's sixth spoke crosses the original pilot position. Its missing
        // sector lies to the side, so staying inside the first opening is unsafe.
        api.ring(right,api.angle(right,target)-6*TAU/19,19,4,158,1.47,dart);
      }else{
        const hub=at(24,0);
        for(let beat=0;beat<2;beat++)for(let arm=0;arm<4;arm++){
          const a=axis+PI/2*arm+side*beat*PI/4;
          api.warnLine(station(api,hub,a,37,0),station(api,hub,a,153,0),.87+beat*.58,.34,6,14);
        }
        api.warnDisk(hub,37,2.08,.31,16);
      }
    }
  };
  patterns[5]={
    moves:[
      {name:'Stamp and Shear',tell:1.47,recovery:.81,remote:true,
        counter:'Move lengthwise past the two dies. Their hot chips spray out to either side.'},
      {name:'Scissor Press',tell:1.98,recovery:.91,remote:true,
        counter:'Wait for the first angled jaw to lift, then cross its mark before the second closes.'},
      {name:'Rolling Billet',minPhase:2,tell:1.71,recovery:.94,remote:false,
        counter:'Thread the missing row of the first broadside, then switch rows for the return stroke.'}
    ],
    cast(i,g,e,target,api){
      const axis=i===2?api.angle(target,e):inward(target,e,api),side=api.turn;
      const at=(along,across,pad)=>station(api,target,axis,along,across,pad);
      if(i===0){
        for(const sign of [-1,1]){
          const die=at(0,sign*27,16);
          api.warnDisk(die,37,.91,.32,16);
          api.volley(die,axis+sign*PI/2,5,1.05,178,1.44,iron);
        }
      }else if(i===1){
        const jaw=at(28,0),a=axis+side*.66,b=axis-side*.66;
        api.warnLine(station(api,jaw,a,-110,0),station(api,jaw,a,124,0),.85,.42,10,15);
        api.warnLine(station(api,jaw,b,-110,0),station(api,jaw,b,124,0),1.39,.48,10,15);
        api.warnDisk(jaw,30,1.96,.25,16);
      }else{
        for(let beat=0;beat<2;beat++){
          const from=beat?-110:110,sign=beat?1:-1,gap=beat?-side:side;
          for(let row=-2;row<=2;row++){
            if(row===gap)continue;
            const muzzle=at(from,row*37,10);
            api.volley(muzzle,axis+(sign<0?PI:0),1,0,beat?218:188,.90+beat*.79,iron);
          }
        }
      }
    }
  };
  patterns[6]={
    moves:[
      {name:'Molt Blossom',tell:1.73,recovery:.84,remote:true,
        counter:'The bloom has a missing petal pointing into the arena. Leave through it before the seed bursts.'},
      {name:'Comet Train',tell:1.73,recovery:.79,remote:true,
        counter:'Reverse or cut across your orbit. Falling seeds follow the course you held when the first mark appeared.'},
      {name:'Periapsis',minPhase:2,tell:1.96,recovery:1.04,remote:false,
        counter:'Cross to the empty half of the orbit while the four wing sockets fire in sequence.'}
    ],
    cast(i,g,e,target,api){
      const axis=i===2?api.angle(target,e):inward(target,e,api),side=api.turn;
      if(i===0){
        for(let petal=1;petal<=3;petal++){
          const a=axis+side*petal*PI/2;
          api.warnDisk(station(api,target,a,62,0,13),31,.82+(petal-1)*.23,.43,13);
        }
        api.warnDisk(target,39,1.71,.27,16);
      }else if(i===1){
        const heading=travel(g,target,axis);
        const dx=target.x-e.x,dy=target.y-e.y,radius=Math.hypot(dx,dy);
        const pace=Math.min(185,Math.hypot(target.vx||0,target.vy||0)||155);
        const radial=api.angle(e,target),spin=Math.sin(heading-radial)*pace;
        const orbiting=radius>62&&Math.abs(Math.cos(heading-radial))<.43;
        api.warnDisk(target,25,.80,.22,13);
        for(let k=0;k<4;k++){
          const t=1.03+k*.22;
          const impact=orbiting
            ?station(api,e,radial+spin*t/radius,radius,0,14)
            :station(api,target,heading,pace*t,side*Math.sin(k*PI/2)*13,14);
          api.warnDisk(impact,26+k*1.5,t,.27,14);
        }
      }else{
        const hub=station(api,target,axis,18,0);
        for(let socket=0;socket<4;socket++){
          const a=axis+side*(-.88+socket*.58);
          const wing=station(api,hub,a,111,0);
          const intercept=station(api,hub,a+side*PI/2,32-socket*5,0);
          api.volley(wing,api.angle(wing,intercept),5,1.05,145+socket*10,.85+socket*.36,seed);
        }
      }
    }
  };
})();
