(function(root,build){
  const api=build();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AcornBreakwater=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const courseIndex=7,quarterTurn=Math.PI*.5;
  const zones=[
    {u:.290,span:25,side:-1,period:15.8,offset:4.8,drop:5.52,approach:75},
    {u:.853,span:23,side:-1,period:17.4,offset:12.6,drop:1.21,approach:48}
  ];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
  const gap=(s,center,length)=>((s-center+length*.5)%length+length)%length-length*.5;

  function profile(length,u){
    for(const zone of zones){
      const distance=Math.abs(u-zone.u)*length;
      if(distance<zone.approach){
        const bank=-zone.side*.235*smooth((zone.span+10-distance)/15);
        const drop=zone.drop*smooth((zone.approach-distance)/(zone.approach-zone.span));
        return {bank,drop};
      }
    }
    return {bank:0,drop:0};
  }
  const crossfall=(bank,lane,w)=>bank*clamp(lane,-w-2.7,w+2.7);

  function level(road,zone,time){
    const phase=((time+zone.offset)%zone.period+zone.period)%zone.period/zone.period;
    const swell=smooth((1-Math.cos(phase*Math.PI*2))*.5);
    return road.y-1.68+1.61*swell;
  }
  function depth(c,s,lane,time,sample){
    if(c.index!==courseIndex)return 0;
    for(const zone of zones){
      const center=zone.u*c.length,distance=Math.abs(gap(s,center,c.length));
      if(distance>=zone.span||lane*zone.side< -2)continue;
      const road=sample(c,s,lane);
      if(Math.abs(lane)>road.w+1.25)continue;
      // The water stays level. Its footprint advances up the bank with the tide.
      return Math.max(0,level(sample(c,center),zone,time)-road.y-(1-smooth((zone.span-distance)/8))*1.58);
    }
    return 0;
  }

  function load(c,r,time,sample){
    if(c.index!==courseIndex||r.branch||r.flight||r.air>0||r.driverIndex===7&&r.active>0)return 0;
    return smooth((depth(c,r.s,r.x,time,sample)-.035)/.78);
  }
  function drag(speed,load,top,dt){
    const pace=Math.abs(speed);
    const limit=speed>=0?top*(1-.66*load):3.8*(1-.58*load);
    return Math.sign(speed)*Math.max(Math.min(pace,limit),pace-(8+pace*.84)*load*dt);
  }
  function dryLine(c,r,time,target,sample){
    if(c.index!==courseIndex||r.branch)return target;
    const speed=Math.max(6,r.v);
    for(const ahead of [5,12,20]){
      const s=r.s+ahead,t=time+ahead/speed;
      if(depth(c,s,target,t,sample)>.11){
        const bank=sample(c,s).bank;
        return bank<0?-1.45:1.45;
      }
    }
    return target;
  }

  function rows(c,time,sample){
    const result=[];
    if(c.index!==courseIndex)return result;
    for(const zone of zones){
      const center=zone.u*c.length,height=level(sample(c,center),zone,time);
      const section=s=>{
        const road=sample(c,s),distance=Math.abs(s-center),taper=smooth((zone.span-distance)/8);
        const bank=Math.abs(road.bank),edge=road.w+2.7;
        const lift=height-road.y-(1-taper)*1.58;
        const edgeDepth=lift+bank*edge;
        const rim=edge+5.4*taper,tideY=height-(1-taper)*1.58;
        const shore=clamp(edge-edgeDepth/Math.max(.065,bank),-2,rim);
        const width=Math.max(0,rim-shore);
        const foam=Math.min(width*.7,.44+.1*Math.sin(s*.71-time*5));
        const point=(x,y)=>[road.x+road.nx*zone.side*x,y,road.z+road.nz*zone.side*x];
        return {width,shore:point(shore,tideY+.009),foam:point(shore+foam,tideY+.013),
          water:point(Math.max(shore+foam,rim-2.2*taper),tideY),end:point(rim,tideY)};
      };
      const start=center-zone.span,segments=Math.ceil(zone.span*2/1.3),step=zone.span*2/segments;
      let a=section(start);
      for(let i=1;i<=segments;i++){
        const s=start+i*step,b=section(s);
        if(a.width>.025||b.width>.025)result.push({s:s-step*.5,panels:[
          {points:[a.shore,b.shore,b.foam,a.foam],color:'#d6eae6',material:11.18,opacity:.72},
          {points:[a.foam,b.foam,b.water,a.water],color:'#4a8493',material:8.24,opacity:.67},
          {points:[a.water,b.water,b.end,a.end],color:'#6899a4',material:8.14,opacity:.48}
        ]});
        a=b;
      }
    }
    return result;
  }

  function spray(c,r,time,amount,sample,emit){
    if(amount<.06||Math.abs(r.v)<2)return;
    const direction=Math.sign(r.v);
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const phase=(time*(2.7+amount)+i*.27+(side===1?.18:0))%1;
      const s=r.s-direction*(.49+phase*2.1),lane=r.x+side*(.62+phase*.78);
      const water=depth(c,s,lane,time,sample);
      emit(s,lane,water+.08+Math.sin(phase*Math.PI)*(.22+.48*amount),
        side*quarterTurn,.27+.23*phase,(1-phase)*(.38+.52*amount));
    }
  }
  return {courseIndex,zones,profile,crossfall,depth,load,drag,dryLine,rows,spray};
});
