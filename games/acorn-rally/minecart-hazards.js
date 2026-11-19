(function(root, build){
  const api=build();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AcornMinecarts=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const id=12,courseIndex=8,trackGauge=.69;
  const cap=t=>Math.max(0,Math.min(1,t));
  const smooth=t=>{t=cap(t);return t*t*(3-2*t);};

  function roadWidth(course,s){
    const length=course.length,points=course.points;
    const at=((s%length+length)%length)/length*points.length;
    const i=Math.floor(at)%points.length,f=at-Math.floor(at),w=points[i].w;
    return w+(points[(i+1)%points.length].w-w)*f;
  }

  // Each spur crosses a shoulder, shares the road for the middle of its run,
  // then curves into the opposite siding. Both ends are beyond the race deck.
  function path(course,baseS,span,side,p){
    const s=baseS+(p-.5)*2*span,width=roadWidth(course,s);
    const lane=side*(1.42-1.42*smooth((p-.28)/.44));
    const enter=1-smooth(p/.29),exit=smooth((p-.70)/.30),siding=width+2.80;
    return {s,x:lane*(1-enter-exit)+side*siding*(enter-exit)};
  }

  function sample(course,cfg,state,p,cycle){
    const direction=cycle%2?-1:1,progress=direction===1?p:1-p;
    const {baseS}=state,{side,length:span}=cfg;
    const here=path(course,baseS,span,side,progress);
    const a=path(course,baseS,span,side,Math.max(0,progress-.007));
    const b=path(course,baseS,span,side,Math.min(1,progress+.007));
    const heading=Math.atan2((b.x-a.x)*direction,(b.s-a.s)*direction);
    // The car body is roughly 1.65 by 2.35, plus the wheels and buffer beam.
    return Object.assign(state,here,{span,side,direction,railProgress:progress,heading,
      halfWidth:.88,halfLength:1.29,top:1.42+railLift(course,here),
      bottom:railLift(course,here),safeSide:here.x<0?1:-1,
      strength:state.active?1:0});
  }

  function railLift(course,p){
    const width=roadWidth(course,p.s),shoulder=Math.max(0,Math.abs(p.x)-width);
    return .125-.035*shoulder;
  }

  // Resolve in the cart's local axes so a driver can clear its corners.
  function overlaps(h,ds,dx){
    const sin=Math.sin(h.heading),cos=Math.cos(h.heading);
    return Math.abs(dx*cos-ds*sin)<h.halfWidth+.54&&Math.abs(dx*sin+ds*cos)<h.halfLength+.69;
  }

  function meshes(Mesh,simple){
    const body=new Mesh(),wheel=new Mesh(),signal=new Mesh(),lamp=new Mesh();
    const gold='#b49e79',steel='#4d5667',rim='#9c96a6';
    const corner=(x,y,z)=>[x,y,z];
    const low=[corner(-.62,.33,-.94),corner(.62,.33,-.94),corner(.62,.33,.94),corner(-.62,.33,.94)];
    const high=[corner(-.78,1.12,-1.14),corner(.78,1.12,-1.14),corner(.78,1.12,1.14),corner(-.78,1.12,1.14)];
    const inner=high.map(([x,y,z])=>[x*.86,y-.045,z*.90]);
    const ribs=['#56566b','#655d70','#4d5266','#605c76'];
    for(let i=0;i<4;i++){
      const j=(i+1)%4;
      body.quad(low[j],low[i],high[i],high[j],ribs[i]);
      body.quad(high[j],high[i],inner[i],inner[j],rim);
      body.quad(inner[j],inner[i],low[i].map((n,k)=>k===1?n+.12:n*.86),low[j].map((n,k)=>k===1?n+.12:n*.86),'#332e40');
      const a=high[i],b=low[i];
      body.ring([b[0]*1.037,b[1],b[2]*1.025],[a[0]*1.035,a[1],a[2]*1.02],.045,.046,gold,5);
    }
    body.box(0,.32,0,1.34,.15,2.03,0,steel);
    for(const z of [-1,1]){
      body.box(0,.40,z*1.14,1.30,.17,.15,0,'#363947');
      body.box(0,.47,z*1.225,.38,.13,.16,0,'#a59072');
      const y=.77,z0=z*1.058;
      body.ring([0,y,z0],[0,y,z0+z*.125],.146,.138,'#514f59',9);
      body.ring([0,y,z0+z*.126],[0,y,z0+z*.136],.098,.088,z>0?'#ffe7a0':'#ff8050',9,5);
      for(const x of [-.48,.48])body.blob(x,.76,z*1.082,.046,.046,.034,gold,5);
    }
    for(const x of [-1,1])for(const z of [-.67,0,.67]){
      body.ring([x*.65,.43,z],[x*.792,1.075,z],.028,.032,'#7d7989',5);
      body.blob(x*.782,1.023,z,.034,.04,.036,gold,5);
    }
    const ore=['#61bba9','#68e4cf','#3c8f94','#aeffe0','#a57bea'];
    for(let i=0;i<(simple?5:8);i++){
      const x=Math.sin(i*2.34)*.41,z=(i%4-1.5)*.39,H=.99+(i%3)*.17,r=.18+(i%3)*.045;
      const tip=[x+.085,H+.16,z-.045];
      for(let j=0;j<5;j++){
        const angle=(j+i*.39)*Math.PI*2/5,next=angle+Math.PI*2/5;
        const edge=a=>[x+Math.cos(a)*r,H-.15,z+Math.sin(a)*r];
        const base=a=>[x+Math.cos(a)*r*.67,H-.48,z+Math.sin(a)*r*.67];
        body.quad(base(angle),base(next),edge(next),edge(angle),ore[(i+j)%ore.length]);
        body.tri(edge(angle),edge(next),tip,ore[(i+j+2)%ore.length],j===1?5:0);
      }
    }
    wheel.ring([-.12,0,0],[.12,0,0],.31,.31,'#2f3544',simple?8:14);
    wheel.ring([-.087,0,0],[.087,0,0],.347,.347,'#525e6c',simple?8:14);
    for(const side of [-1,1]){
      wheel.ring([side*.125,0,0],[side*.15,0,0],.103,.093,'#a89b8f',8);
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5;
        wheel.ring([side*.13,0,0],[side*.13,Math.sin(a)*.276,Math.cos(a)*.276],.030,.022,'#7e8790',5);
      }
    }
    signal.box(0,0,0,.42,.16,.42,0,'#494351');
    signal.box(0,.12,0,.21,1.02,.24,0,'#6d594e',2);
    signal.box(0,.89,0,.37,.32,.32,0,'#494554');
    signal.box(0,1.20,0,.46,.1,.40,0,'#917d6e');
    for(const z of [-1,1])lamp.ring([0,1.055,z*.162],[0,1.055,z*.182],.102,.093,'#ffd18b',9,5);
    return {lumenCart:body,lumenCartWheel:wheel,lumenCartSignal:signal,lumenCartLamp:lamp};
  }

  function point(course,at,sampleRoad){
    const q=sampleRoad(at.s,at.x,false);
    return [q.x,q.y+railLift(course,at),q.z];
  }

  function basis(a,b){
    const dx=b[0]-a[0],dz=b[2]-a[2],flat=Math.hypot(dx,dz)||1;
    return {x:dz/flat,z:-dx/flat,yaw:Math.atan2(dx,dz),pitch:-Math.atan2(b[1]-a[1],flat)};
  }

  const lanePoint=(p,q,x,y,z=0)=>[p[0]+q.x*x-q.z*z,p[1]+y,p[2]+q.z*x+q.x*z];

  function draw(course,hazards,time,sampleRoad,stamp){
    for(const h of hazards){
      if(h.id!==id)continue;
      const at=p=>point(course,path(course,h.baseS,h.span,h.side,p),sampleRoad);
      const p=h.railProgress,center=at(p);
      const a=at(cap(p-h.direction*.007)),b=at(cap(p+h.direction*.007)),q=basis(a,b);
      const wheelAngle=h.direction*(p-.5)*h.span*2/.335;
      stamp('lumenCart',center,q.yaw,1,1,0,q.pitch);
      for(const x of [-trackGauge,trackGauge])for(const z of [-.79,.79]){
        const wheel=lanePoint(center,q,x,.337-Math.sin(q.pitch)*z,z*Math.cos(q.pitch));
        stamp('lumenCartWheel',wheel,q.yaw,1,1,0,q.pitch+wheelAngle);
      }
      for(const [fraction,sign] of [[.18,h.side],[.82,-h.side]]){
        const s=h.baseS+(fraction-.5)*2*h.span,road=sampleRoad(s,0,false);
        const edge=sampleRoad(s,sign*(road.w+.53),false),position=[edge.x,edge.y-.02,edge.z];
        const yaw=Math.atan2(road.tx,road.tz);
        stamp('lumenCartSignal',position,yaw);
        if(h.warning||h.active)stamp('lumenCartLamp',position,yaw,1,.69+.31*Math.sin(time*13+sign));
      }
    }
  }

  // The same world-space panels feed WebGL's static mesh and the canvas fallback.
  function railRows(course,hazards,sampleRoad){
    const rows=[];
    for(const h of hazards){
      if(h.id!==id)continue;
      const count=Math.ceil(2*h.span/.79),nodes=[];
      for(let i=0;i<=count;i++){
        const at=path(course,h.baseS,h.span,h.side,i/count);
        nodes.push({s:at.s,p:point(course,at,sampleRoad)});
      }
      for(let i=0;i<count;i++){
        const a=nodes[i],b=nodes[i+1],qa=basis(nodes[Math.max(0,i-1)].p,b.p),qb=basis(a.p,nodes[Math.min(count,i+2)].p);
        const A=(x,y,z)=>lanePoint(a.p,qa,x,y,z),B=(x,y)=>lanePoint(b.p,qb,x,y),panels=[];
        const tie=i%3===0?'#795f54':'#514650';
        panels.push([A(-1.04,-.071,-.11),A(-1.04,-.071,.11),A(1.04,-.071,.11),A(1.04,-.071,-.11),tie]);
        for(const x of [-trackGauge,trackGauge]){
          const L=x-.048,R=x+.048;
          panels.push([A(L,0),B(L,0),B(R,0),A(R,0),'#9ca4a9']);
          panels.push([A(L,-.058),B(L,-.058),B(L,0),A(L,0),'#474a58']);
          panels.push([A(R,0),B(R,0),B(R,-.058),A(R,-.058),'#585467']);
        }
        rows.push({s:a.s,panels});
      }
    }
    return rows;
  }

  return {id,courseIndex,sample,overlaps,meshes,draw,railRows};
});
