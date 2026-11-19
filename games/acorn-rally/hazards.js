(function(root,make){
  const api=make(typeof module==='object'&&module.exports?require('./tracks-expansion.js'):root.AcornExpansion);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AcornHazards=api;
})(typeof globalThis==='object'?globalThis:this,function(Expansion){
  'use strict';
  const cap=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=(x,p)=>((x%p)+p)%p;
  const smooth=x=>{const t=cap(x,0,1);return t*t*(3-2*t);};
  const frog=8,timber=9;
  const tips=[
    'Give the rolling log room. Follow the open lane past its end.',
    'When the bamboo pole starts to dip, take the lane opposite its hinge.',
    'Take the high towpath while the sluice is open, or wait for the water to drain.',
    'Watch the boulder’s landing mark and pass behind it as it rolls.',
    'Leave the cracked plates before they sink. The unbroken salt stays firm.',
    'Watch the cargo rope. Pass beside the basket or underneath once it rises.',
    'When the waterfall surges, steer away from the spray and onto dry stone.',
    'Follow the retreating foam, or take the inland route above the wash.'
  ];
  const routes=[
    {name:'Rolling cedar',u:.320,side:1,period:8.8,warn:2.15,live:3.50,offset:3.2,width:1.53,length:.79,speed:.66,push:3.35,hop:.28},
    {name:'Bamboo gate',u:.400,side:-1,period:7.8,warn:2.10,live:3.20,offset:1.8,width:.46,length:.57,speed:.72,push:4.4,hop:0},
    {name:'Sluice release',u:.380,side:1,period:9.0,warn:2.35,live:3.65,offset:2.5,width:1.22,length:3.15,speed:.72,push:5.25,slip:.72,branch:true},
    {name:'Canyon rockfall',u:.380,side:-1,period:8.1,warn:2.20,live:3.15,offset:.75,width:.81,length:.84,speed:.57,push:4.1,hop:.46},
    {name:'Salt-crust break',u:.270,side:1,period:10.6,warn:2.45,live:4.80,offset:2.35,width:1.58,length:2.85,speed:.65,push:2.4,slip:.55,hop:.16},
    {name:'Cargo basket',u:.195,side:-1,period:9.2,warn:2.30,live:4.05,offset:1.30,width:1.26,length:1.09,speed:.59,push:3.8,hop:.17},
    {name:'Cascade surge',u:.795,side:1,period:8.8,warn:2.15,live:3.80,offset:3.4,width:1.92,length:2.75,speed:.76,push:6.15,slip:.65},
    {name:'Surf wash',u:.410,side:-1,period:10.4,warn:2.70,live:4.50,offset:1.1,width:1.35,length:3.78,speed:.68,push:5.80,slip:.90,branch:true}
  ];
  const obstacles=routes.map(cfg=>[cfg]);
  for(const course of Expansion.courses){
    routes.push(course.hazard);tips.push(course.tip);
    obstacles.push([course.hazard,...(course.obstacles||[])]);
  }
  function sample(c,time){return sampleObstacle(c,time,routes[c.index]);}
  function samples(c,time){return obstacles[c.index].map(cfg=>sampleObstacle(c,time,cfg));}
  function sampleObstacle(c,time,cfg){
    const id=cfg.style??c.index,key=cfg.key??c.index,t=wrap(time+cfg.offset,cfg.period),end=cfg.warn+cfg.live;
    const phase=t<cfg.warn?'warning':t<end?'active':t<end+.9?'receding':'clear';
    const progress=phase==='warning'?t/cfg.warn:phase==='active'?(t-cfg.warn)/cfg.live:
      phase==='receding'?(t-end)/.9:(t-end-.9)/(cfg.period-end-.9);
    const p=phase==='active'?progress:phase==='warning'?0:1,side=cfg.side,branch=!!cfg.branch;
    const anchorX=side*(branch?2.75:5.05),mainX=side*(branch?.66:1.14);
    const strength=phase==='active'?smooth(p/.18)*smooth((1-p)/.21):0;
    const baseS=cfg.u*c.length;
    let x=mainX,s=baseS,halfWidth=cfg.width,halfLength=cfg.length,bottom=0,top=.5,tipX=mainX;
    const roll=smooth(p),water=id===2||id===6||id===7;
    if(id===0){
      x=side*(4.65-4.85*roll);s+=3.0*(.5-roll);top=.78;
    }else if(id===1){
      // The hanging cane swings down from its roadside hinge; the outside edge stays open.
      tipX=anchorX-side*(.4+5.85*strength);x=(anchorX+tipX)/2;
      halfWidth=Math.abs(tipX-anchorX)*.5+.13;
      bottom=.29+2.58*(1-strength);top=bottom+.33;
    }else if(water){
      const reach=(branch?3.05:5.65)*strength;
      tipX=anchorX-side*reach;x=(anchorX+tipX)/2;
      halfWidth=Math.max(.13,Math.abs(tipX-anchorX)*.5);top=.13+.20*strength;
    }else if(id===3){
      x=side*(4.55-5.15*roll);s+=2.55*roll;
      bottom=phase==='warning'?3.2:(1-smooth(p/.20))*3.2+.96*Math.abs(Math.sin(Math.PI*p*2.8))*(1-p);
      top=bottom+1.55;
    }else if(id===4){
      x=1.12;bottom=-.22*strength;top=.12;
    }else if(id===5){
      x=side*(1.36+.53*Math.sin(p*Math.PI*2));
      bottom=.19+3.25*(1-strength);top=bottom+1.57;
    }
    const state={id,key,name:cfg.name,tip:tips[c.index],s,x,baseS,branch,halfWidth,halfLength,bottom,top,warning:phase==='warning',
      active:phase==='active',phase,progress,strength,sourceSide:side,safeSide:-side,anchorX,mainX,tipX,period:cfg.period,
      shift:id===0?-side*4.85*6*p*(1-p)/cfg.live:id===3?-side*5.15*6*p*(1-p)/cfg.live:water?-side*cfg.push*strength:0};
    if(id===frog||id===timber){
      const road=c.points[Math.floor(cfg.u*c.points.length)];
      if(id===frog)frogPath(state,cfg,road.w,p,Math.floor((time+cfg.offset)/cfg.period));
      else timberPath(state,cfg,road.w,p);
    }
    return state;
  }
  function frogPath(state,cfg,width,p,cycle){
    const side=cycle%2?-cfg.side:cfg.side,shoulder=width+.52,hops=4;
    // Finish each crossing at the next cycle's starting bank. Pauses between
    // hops give drivers a moment to read the next landing spot.
    const step=Math.min(hops-1,Math.floor(p*hops));
    const hopPhase=cap((p*hops-step)/.79,0,1);
    const progress=(step+smooth(hopPhase))/hops;
    const bottom=1.34*Math.sin(Math.PI*hopPhase);
    const x=side*shoulder*(1-2*progress),s=state.baseS+2.65*Math.sin(Math.PI*progress);
    const heading=Math.atan2(-side*shoulder*2,2.65*Math.PI*Math.cos(Math.PI*progress));
    const landing=(step+1)/hops;
    Object.assign(state,{s,x,bottom,top:bottom+.88,heading,hopPhase,sourceSide:side,safeSide:x<0?1:-1,
      landingS:state.baseS+2.65*Math.sin(Math.PI*landing),landingX:side*shoulder*(1-2*landing),
      anchorX:side*shoulder,tipX:-side*shoulder,warningX:0,warningHalfWidth:width-.2});
  }
  function timberPath(state,cfg,width,p){
    const radius=cfg.width,anchorX=cfg.side*(width+.24),hingeHeight=.52;
    const reach=Math.min(cfg.reach,width+1.05);
    const fallProgress=state.active?smooth(p/.28):state.phase==='receding'?1-smooth(state.progress):
      state.warning?.045*state.progress*(1+Math.sin(state.progress*34))*.5:0;
    const angle=fallProgress*Math.PI*.5;
    const tipX=anchorX-cfg.side*reach*Math.sin(angle),tipHeight=hingeHeight+reach*Math.cos(angle);
    const warningX=anchorX-cfg.side*reach*.5;
    Object.assign(state,{x:(anchorX+tipX)*.5,halfWidth:Math.abs(anchorX-tipX)*.5+radius,
      bottom:hingeHeight-radius,top:tipHeight+radius,anchorX,tipX,radius,hingeHeight,tipHeight,fallProgress,
      warningX,warningHalfWidth:reach*.5+radius});
  }
  function lift(st,r){
    if(!(r.air>0))return 0;
    const hop=r.hazardHop;
    if(hop&&st.time>=hop.at&&st.time<hop.at+hop.duration&&r.air<=hop.duration+.001&&
        Math.abs((hop.at+hop.duration-st.time)-r.air)<.065)
      return Math.max(0,Math.sin(Math.PI*(st.time-hop.at)/hop.duration))*hop.height;
    const duration=r.driverIndex===2?.86:r.driverIndex===6?.29:.62;
    const height=r.driverIndex===6?.48:r.driverIndex===2&&r.signature?.stage==='active'?1.58:1.12;
    return Math.sin(Math.PI*cap(r.air/duration,0,1))*height;
  }
  function contact(st,r,c,previousS,previousX,dt,actualLift){
    const courseObstacles=obstacles[c.index];
    if(r.hazardHit&&!r.hazardHit.rearmed){
      const last=courseObstacles.find(cfg=>(cfg.key??c.index)===(r.hazardHit.key??c.index));
      if(last&&Math.abs(r.s-r.hazardHit.cross)>last.length+10)r.hazardHit.rearmed=true;
    }
    if(r.finish||r.ghost>0||r.protect>0||!Number.isFinite(previousS)||Math.abs(r.s-previousS)>Math.max(3.6,Math.abs(r.v)*dt*3))return false;
    for(const cfg of courseObstacles){
      if(!!r.branch===!!cfg.branch&&contactObstacle(st,r,c,cfg,previousS,previousX,dt,actualLift))return true;
    }
    return false;
  }
  function contactObstacle(st,r,c,cfg,previousS,previousX,dt,actualLift){
    const base=cfg.u*c.length,near=base+Math.round((previousS-base)/c.length)*c.length;
    if(Math.abs(r.s-near)>cfg.length+5)return false;
    // One contact per crossing. A stopped kart can't be repeatedly hit by the same span.
    if(r.hazardHit?.id===(cfg.style??c.index)&&(r.hazardHit.key??c.index)===(cfg.key??c.index)&&
        r.hazardHit.cross===near&&!r.hazardHit.rearmed)return false;
    const x0=Number.isFinite(previousX)?previousX:r.x,liftNow=Number.isFinite(actualLift)?actualLift:lift(st,r);
    const buried=r.driverIndex===7&&r.active>0;
    for(const f of [.0,.5,1]){
      const h=sampleObstacle(c,st.time-dt*(1-f),cfg);
      if(!h.active||h.strength<.105&&[2,4,6,7].includes(h.id))continue;
      const s=previousS+(r.s-previousS)*f-near-(h.s-base),x=x0+(r.x-x0)*f;
      if(Math.abs(s)>h.halfLength+.70||Math.abs(x-h.x)>h.halfWidth+.49)continue;
      const wheels=buried?-.84:liftNow,roof=wheels+(buried?.62:1.25);
      let bottom=h.bottom,top=h.top;
      if(h.id===timber){
        const reach=h.tipX-h.anchorX;
        const t=Math.abs(reach)>.001?cap((x-h.anchorX)/reach,0,1):0;
        const height=h.hingeHeight+(h.tipHeight-h.hingeHeight)*t;
        bottom=height-h.radius;top=height+h.radius;
      }
      if(wheels>top+.035||roof<bottom-.035)continue;
      let direction=h.safeSide;
      if([0,3,4,5,frog].includes(h.id)&&Math.abs(x-h.x)>.10)direction=Math.sign(x-h.x);
      r.hazardHit={id:h.id,key:h.key,at:st.time,side:direction,blocked:r.guard>0,cross:near,count:(r.hazardHit?.count||0)+1};
      if(r.guard>0){r.guard=0;r.protect=.80;r.notice='Bark Guard absorbed '+h.name;r.noticeTime=1.25;return true;}
      const speedFactor=cap(Math.abs(r.v)/13,.32,1);
      r.v=h.id===frog?-(1.4+2.1*speedFactor):r.v*cfg.speed;
      r.vx=cap((r.vx||0)+direction*cfg.push*speedFactor,-10,10);
      r.x+=direction*.12*speedFactor;r.yaw=cap((r.yaw||0)+direction*(cfg.slip?.12:.075),-.44,.44);
      r.protect=.86;r.hit=.38;r.slow=Math.max(r.slow||0,cfg.slip?.35:.24);
      if(cfg.slip)r.slip=Math.max(r.slip||0,cfg.slip);
      if(cfg.hop&&speedFactor>.42){
        const duration=.21+cfg.hop*.41;r.air=duration;r.hazardHop={at:st.time,duration,height:cfg.hop*speedFactor};
      }
      r.notice=h.id===frog?'Bullfrog bumped you back':h.name;r.noticeTime=1.25;return true;
    }
    return false;
  }
  function decision(seed,id,lap,seat){
    let n=(seed|0)^Math.imul(id+1,0x9e3779b1)^Math.imul(lap+9,0x85ebca77)^Math.imul(seat+1,0x7feb352d);
    n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);
    return ((n^(n>>>16))>>>0)/4294967296;
  }
  function avoid(st,r,c,target){
    r.hazardPace=0;
    for(const cfg of obstacles[c.index])target=avoidObstacle(st,r,c,cfg,target);
    return target;
  }
  function avoidObstacle(st,r,c,cfg,target){
    if(r.v<2||!!cfg.branch!==!!r.branch)return target;
    const lap=Math.floor(r.s/c.length),distance=cfg.u*c.length+lap*c.length-r.s;
    const tier=st.difficulty==='ultimate'?3:st.difficulty==='hard'?2:st.difficulty==='easy'?0:1;
    const horizon=[.98,1.55,2.05,2.45][tier],v=Math.max(6,r.v);
    const extra=cfg.style===frog||cfg.style===timber;
    const pathShift=cfg.style===frog?2.65:0;
    if(distance<-(cfg.length+1.35+pathShift)||distance>v*horizon+cfg.length+2+pathShift)return target;
    const live=sampleObstacle(c,st.time,cfg);
    if(!extra&&(live.phase==='clear'||live.phase==='receding'))return target;
    const miss=decision(st.hazardSeed??0xace110,c.index+Math.round(cfg.u*1000)*(extra?1:0),lap,r.seat)<[.42,.14,.027,.006][tier];
    let eta=Math.max(0,distance)/v;
    if(cfg.style===frog)eta+=Math.max(0,sampleObstacle(c,st.time+eta,cfg).s-live.baseS)/v;
    if(miss&&eta>(tier>=2?.29:.12))return target;
    // Look at the hazard during the time this kart would occupy its footprint.
    // A basket that will clear its roof or a withdrawn flood needs no detour.
    let danger=null;
    for(const d of [-.18,0,.20]){
      const h=sampleObstacle(c,st.time+Math.max(0,eta+d),cfg);
      if(!h.active||h.bottom>=1.35||(!extra&&h.strength<=.09))continue;
      if(cfg.style===frog&&Math.abs(target-h.x)>h.halfWidth+1.3)continue;
      if(cfg.style===timber&&(h.fallProgress<.48||Math.abs(target-h.x)>h.halfWidth+.65))continue;
      danger=h;
    }
    if(!danger)return target;
    const side=extra?danger.safeSide:live.safeSide;
    const safe=side*(cfg.branch?2.02:3.38);
    // Fast classes may exhaust their lateral grip if a bot steers at full
    // throttle into the sluice bend. Give it time to move onto the clear line.
    if(!miss&&side*(r.x-safe)<-.68&&eta>.18){
      const lateral=Math.abs(safe-r.x),comfortable=cfg.branch?17.6:20.3;
      r.hazardPace=Math.min(r.hazardPace||Infinity,comfortable+Math.max(0,1-lateral/3)*4);
    }
    const blend=smooth((horizon+.20-eta)/(.36+tier*.05));
    return target+(safe-target)*blend;
  }
  return {routes,tips,sample,samples,lift,avoid,contact};
});
