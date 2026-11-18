(function(root,make){
  const ramps=make();
  if(typeof module==='object'&&module.exports)module.exports=ramps;
  else root.AcornRamps=ramps;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // All distances are in the same world units as course progress. The center
  // lane belongs to the selected route (main or shortcut), even on an overpass.
  const profiles=[
    {id:'bark-rise',name:'Uphill bark ramp',style:'bark',courseIndex:0,branch:false,u:.100,lane:1.55,halfWidth:2.20,landingWidth:2.35,
      runup:9.0,rise:1.68,gap:2.25,landingRise:.95,landingLength:27.6,minSpeed:6},
    {id:'root-step-1',name:'First root step',style:'root',courseIndex:0,branch:true,u:.525,lane:0,halfWidth:2.04,landingWidth:2.22,
      runup:6.4,rise:.97,gap:1.25,landingRise:.48,landingLength:29.0,minSpeed:5},
    {id:'root-step-2',name:'Second root step',style:'root',courseIndex:0,branch:true,u:.571,lane:0,halfWidth:2.05,landingWidth:2.27,
      runup:6.4,rise:1.16,gap:1.55,landingRise:.62,landingLength:31.1,minSpeed:5.5},
    {id:'slickrock-drop',name:'Slickrock ledge',style:'sandstone',courseIndex:3,branch:true,u:.555,lane:0,halfWidth:2.10,landingWidth:3.35,
      runup:9.5,rise:2.30,gap:3.70,landingRise:.82,landingLength:40.1,minSpeed:7},
    {id:'workshop-crest',name:'Workshop exit crest',style:'chalk',courseIndex:5,branch:true,u:.535,lane:0,halfWidth:2.03,landingWidth:2.24,
      runup:8.2,rise:1.60,gap:1.45,landingRise:.95,landingLength:31.2,minSpeed:6},
    {id:'ravine-trestle',name:'Ravine trestle',style:'trestle',courseIndex:6,branch:true,u:.398,lane:0,halfWidth:2.12,landingWidth:2.36,
      runup:8.25,rise:2.60,gap:4.0,landingRise:1.58,landingLength:44.8,minSpeed:8}
  ];
  const cap=x=>Math.max(0,Math.min(1,x)),smooth=x=>x*x*(3-2*x);
  const cache=new WeakMap();
  function list(c){
    let result=cache.get(c);
    if(!result){
      result=profiles.filter(p=>p.courseIndex===c.index).map(p=>{
        const lipS=c.length*p.u,landingS=lipS+p.gap;
        return Object.freeze({...p,lipS,startS:lipS-p.runup,landingS,endS:landingS+p.landingLength,
          slope:1.65*p.rise/p.runup,shoulder:.45,courseLength:c.length});
      });
      Object.freeze(result);cache.set(c,result);
    }
    return result;
  }
  // Signed distance from a lip, including subsequent laps and reverse crossings.
  function relative(r,s){const d=s-r.lipS;return d-r.courseLength*Math.round(d/r.courseLength);}
  function deck(r,s,x){
    const d=relative(r,s),land=d>=r.gap-1e-8,approach=d<=1e-8;
    const width=land?r.landingWidth:r.halfWidth,border=width-Math.abs(x-r.lane);
    const blend=smooth(cap(border/r.shoulder));
    if(d< -r.runup-1e-8||d>r.gap+r.landingLength+1e-8||border<0)
      return {phase:'outside',height:0,grade:0,blend:0,border,width};
    if(!approach&&!land)return {phase:'gap',height:0,grade:0,blend,border,width};
    if(approach){
      const u=cap(1+d/r.runup);
      // Slightly eased entry, then a positive grade right up to the takeoff edge.
      return {phase:'approach',height:r.rise*u*(.35+.65*u)*blend,grade:r.rise/r.runup*(.35+1.30*u)*blend,blend,border,width};
    }
    const u=cap((d-r.gap)/r.landingLength);
    // A nearly level nose, a gentle rollout and a tangent join to the original road.
    return {phase:'landing',height:r.landingRise*(1-smooth(u))*blend,grade:-6*r.landingRise*u*(1-u)/r.landingLength*blend,blend,border,width};
  }
  function surface(c,s,x=0,branch=false){
    for(const r of list(c)){
      if(r.branch!==!!branch)continue;
      const d=relative(r,s);
      if(d>=-r.runup&&d<=r.gap+r.landingLength)return deck(r,s,x).height;
    }
    return 0;
  }
  function crossed(c,oldS,s,oldX,x,branch){
    if(!(s>oldS)||s-oldS>12)return null;
    for(const r of list(c)){
      if(r.branch!==!!branch)continue;
      const d=relative(r,oldS),dist=s-oldS;
      if(d>=0||d+dist<0)continue;
      const lateral=oldX+(x-oldX)*(-d/dist);
      // Tapered shoulders permit an ordinary drive-around or a missed approach.
      if(Math.abs(lateral-r.lane)<=r.halfWidth-r.shoulder)return r;
    }
    return null;
  }
  function matchLanding(r,s,x){
    const local=relative(r,s);
    return local>=r.gap-1e-8&&local<=r.gap+r.landingLength+1e-8&&Math.abs(x-r.lane)<=r.landingWidth-.18;
  }
  function aim(c,r,target){
    r.rampPace=0;
    for(const ramp of list(c)){
      if(r.branch!==ramp.branch||r.v<2||r.catchShelf)continue;
      const d=relative(ramp,r.s),look=Math.max(13,r.v*(ramp.style==='trestle'?1.75:1.20));
      if(d< -ramp.runup-look||d>0&&r.flight?.id!==ramp.id)continue;
      // The approach in Hoh has an ordinary outside passing line. Drivers on
      // that side keep their lane instead of cutting across a pack for the ramp.
      if(!ramp.branch&&r.seat%3===2&&r.x<ramp.lane-1.1&&!r.flight)continue;
      const ready=smooth(cap((d+ramp.runup+look)/(look*.58)));
      const bends=ramp.style==='sandstone'||ramp.style==='trestle';
      r.rampPace=ramp.style==='trestle'&&d< -ramp.runup?17.2:bends?20.3:24.7;
      return target+(ramp.lane-target)*ready;
    }
    return target;
  }
  return {list,deck,surface,crossed,matchLanding,aim};
});
