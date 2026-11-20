(function(root){
  'use strict';
  const schemes={
    bark:{boards:['#a2784f','#ac8054','#ab7d4a','#98754f'],edge:'#68472f',stripe:'#e6c187',brace:'#785235',landing:'#91a478'},
    root:{boards:['#a08152','#a98c58','#997a4c','#ac8955'],edge:'#69513b',stripe:'#dec792',brace:'#745536',landing:'#8ca378'},
    sandstone:{boards:['#bc8059','#c38961','#c38b64','#bc805c'],edge:'#995e43',stripe:'#efd1a1',brace:'#ab6c50',landing:'#c9b995'},
    chalk:{boards:['#bcab89','#bdaa87','#c5b295','#bda986'],edge:'#9b8b72',stripe:'#765d45',brace:'#8d785e',landing:'#a0a388'},
    trestle:{boards:['#a38966','#937a54','#9a805d','#a58a66'],edge:'#5d523f',stripe:'#efc57c',brace:'#766147',landing:'#90ae8e'}
  };
  // Textile, tension cord, frame, and landing inlay for each Mythos realm.
  const springKits={
    16:['#483976','#665295','#93c7ee','#ffdeb0','#5a517c'],
    17:['#485d4a','#698367','#ffd799','#ffc5d7','#53684a'],
    18:['#3f303e','#58434e','#e98376','#ffe3a8','#554555'],
    19:['#38556e','#506d80','#e8bb66','#fff4ce','#667580'],
    20:['#323644','#45495a','#ad8062','#b9f3db','#414856']
  };
  function trampolineMesh(Mesh,c,r){
    const m=new Mesh();m.roadSections=[];
    const [weft,warp,metal,thread,stone]=springKits[c.index]||springKits[16];
    const sim=root.AcornSim,raw=sim.baseSample||sim.sample;
    function point(s,x,lift=0){
      const q=raw(c,s,x,r.branch);
      return [q.x,q.y+root.AcornRamps.deck(r,s,x).height+.055+lift,q.z];
    }
    function part(s,draw){
      const begin=m.data.length;draw();m.roadSections.push({s,begin,end:m.data.length});
    }
    function ribbon(s,t,x,y,width,co,h=.018){
      m.quad(point(s,x-width,h),point(t,y-width,h),point(t,y+width,h),point(s,x+width,h),co,5,[0,1,0]);
    }
    function strip(s,t,x,y,co,h=0){
      m.quad(point(s,x,h),point(t,x,h),point(t,y,h),point(s,y,h),co,5,[0,1,0]);
    }
    const lane=r.lane, usable=r.halfWidth-r.shoulder, start=r.startS,lip=r.lipS;
    const station=u=>start+r.runup*u;
    for(let j=0;j<12;j++){
      const s=station(j/12),t=station((j+1)/12),mid=(s+t)/2;
      part(mid,()=>{
        for(let i=0;i<6;i++){
          const x=lane+usable*(i/3-1),y=lane+usable*((i+1)/3-1);
          strip(s,t,x,y,(i+j)%2?warp:weft);
          if(c.index===20){
            // Backed grille slots, with a raised bronze lip on the forward edge.
            const left=x+(y-x)*.18,right=y-(y-x)*.18;
            strip(s+(t-s)*.35,s+(t-s)*.57,left,right,'#202532',.014);
            strip(s+(t-s)*.57,s+(t-s)*.62,left,right,'#77706e',.018);
          }
        }
        for(const side of [-1,1]){
          const edge=lane+side*usable,frame=lane+side*(r.halfWidth-.14);
          strip(s,t,edge,frame,weft);
          m.ring(point(s,frame,.035),point(t,frame,.035),.085,.085,metal,6,5);
          ribbon(s+.02,t-.02,edge,frame,.035,thread,.045);
          if(j%4===2){
            // A tapered coil winds below each outer rail on the raised deck.
            const center=lane+side*(usable+.05),q=point(mid,center);
            const floor=raw(c,mid,center,r.branch).y+.025,height=q[1]-floor;
            if(height>.15){
              let prev;
              for(let k=0;k<=12;k++){
                const angle=k*Math.PI/3,p=[q[0]+Math.sin(angle)*.14,floor+height*k/12,q[2]+Math.cos(angle)*.14];
                if(prev)m.ring(prev,p,.035,.035,metal,4,5);
                prev=p;
              }
            }
          }
        }
      });
    }
    // The center glyph identifies a launch from either chase camera. Its
    // broken ellipse surrounds three arrowheads pointing across the void.
    for(let k=0;k<28;k++){
      if(k%7===0)continue;
      const a=k*Math.PI/14,b=(k+1)*Math.PI/14;
      const tip=(angle,f)=>point(station(.53+.33*f*Math.cos(angle)),lane+usable*.8*f*Math.sin(angle),.028);
      part(station(.53+.33*Math.cos(a)),()=>m.quad(tip(a,.93),tip(b,.93),tip(b,1),tip(a,1),metal,5));
    }
    for(const u of [.30,.48,.66]){
      part(station(u),()=>{
        for(const sign of [-1,1]){
          const x=lane+sign*usable*.36,s=station(u);
          m.quad(point(s,x,.045),point(s+.53,lane,.045),point(s+.87,lane,.045),point(s+.30,x,.045),thread,5);
        }
      });
    }
    // The edge fittings read as part of the world even when the shared launch
    // arrows are obscured by another kart.
    for(const u of [.29,.58,.86])for(const side of [-1,1]){
      const s=station(u),q=raw(c,s,0,r.branch),rim=point(s,lane+side*(r.halfWidth-.22),.06);
      const at=(out,up,ahead)=>[rim[0]+side*out*q.nx+ahead*q.tx,rim[1]+up,rim[2]+side*out*q.nz+ahead*q.tz];
      part(s,()=>{
        if(c.index===16){
          // Quilted pearl bolsters gathered around a tiny gold star button.
          const p=at(.03,.02,0);
          m.blob(...p,.28,.16,.28,'#aaa6de',7,5);
          for(let i=0;i<10;i++){
            const a=i*Math.PI/5,b=(i+1)*Math.PI/5,ra=i%2?.07:.16,rb=i%2?.16:.07;
            m.tri(at(0,.19,0),at(ra*Math.cos(a),.17,ra*Math.sin(a)),at(rb*Math.cos(b),.17,rb*Math.sin(b)),thread,5,[0,1,0]);
          }
        }else if(c.index===17){
          const root=at(-.07,.05,-.36),tip=at(.47,.27,.29),ridge=at(.17,.30,0);
          const back=at(.48,.14,-.21),front=at(-.02,.14,.24);
          m.tri(root,back,ridge,'#df87ae',5);m.tri(back,tip,ridge,'#f2a7c1',5);
          m.tri(tip,front,ridge,'#ffc7cd',5);m.tri(front,root,ridge,'#d278a5',5);
          m.ring(root,ridge,.032,.021,thread,4,5);m.ring(ridge,tip,.022,.008,thread,4,5);
        }else if(c.index===18){
          const socket=at(-.08,.04,-.26),knuckle=at(.18,.26,-.04),tip=at(.27,.31,.28);
          m.ring(socket,knuckle,.18,.095,'#c7ae99',6,6);
          m.ring(knuckle,tip,.097,.005,'#f1d4b6',6,6);
        }else if(c.index===20){
          // A caged witchlight sits in a four-tined socket on each tension rail.
          const heel=at(.04,.02,0),bowl=at(.04,.19,0),wick=at(.04,.28,0),flame=at(.07,.65,.05);
          m.ring(heel,bowl,.19,.125,metal,7,2);
          m.ring(bowl,wick,.13,.16,'#688a86',7,5);
          m.ring(wick,flame,.105,.004,thread,7,5);
          for(let j=0;j<4;j++){
            const a=j*Math.PI/2,elbow=at(.04+.22*Math.cos(a),.32,.22*Math.sin(a));
            const tip=at(.04+.13*Math.cos(a),.62,.13*Math.sin(a));
            m.ring(bowl,elbow,.048,.035,'#665860',5,2);
            m.ring(elbow,tip,.035,.008,metal,5,2);
          }
        }else{
          const bottom=at(0,-.01,0),top=at(0,.095,0);
          m.ring(bottom,top,.255,.22,metal,12,5);
          m.blob(...top,.15,.11,.15,'#799ba9',8,5);
        }
      });
    }
    // The landing threshold is a clearly visible pair of inset endstones,
    // followed by a narrowing band of dashes as the normal surface returns.
    for(let n=0;n<10;n++){
      const a=r.landingS+r.landingLength*n/10,b=r.landingS+r.landingLength*(n+1)/10;
      part((a+b)/2,()=>{
        const w=r.landingWidth;
        for(const side of [-1,1]){
          const x=lane+side*(w-r.shoulder),y=lane+side*w;
          strip(a,b,lane,x,stone);
          strip(a,b,x,y,warp);
          ribbon(a+.05,a+(b-a)*.64,x,x,.08,n<4?thread:metal,.024);
          if(c.index===20&&n<6){
            // Linked silver lozenges draw the eye toward the middle of the catch platform.
            const center=lane+side*(w-r.shoulder-.46),middle=(a+b)*.5;
            for(const sign of [-1,1]){
              ribbon(a+.12,middle,center,center+sign*.15,.035,n<3?thread:metal,.033);
              ribbon(middle,b-.12,center+sign*.15,center,.035,n<3?thread:metal,.033);
            }
          }
          if(!n){
            strip(a,a+.23,lane,x,metal,.028);
            const face=point(a,x);
            m.quad(point(a,lane),face,[face[0],face[1]-.5,face[2]],point(a,lane,-.5),weft,5);
          }
        }
      });
    }
    return m;
  }
  function rampMesh(Mesh,c,r){
    if(r.style==='trampoline')return trampolineMesh(Mesh,c,r);
    const m=new Mesh();m.roadSections=[];
    const palette=schemes[r.style],wood=!['chalk','sandstone'].includes(r.style),rock=r.style==='sandstone',raw=root.AcornSim.baseSample||root.AcornSim.sample;
    const pt=(s,x,dy=0)=>{const q=raw(c,s,x,r.branch);return [q.x,q.y+root.AcornRamps.deck(r,s,x).height+.028+dy,q.z];};
    const base=(s,x,dy=0)=>{const q=raw(c,s,x,r.branch);return [q.x,q.y+dy,q.z];};
    const piece=(s,fn)=>{const begin=m.data.length;fn();if(m.data.length>begin)m.roadSections.push({s,begin,end:m.data.length});};
    function patch(s1,s2,x1,x2,dy,color,mat=2){
      m.quad(pt(s1,x1,dy),pt(s2,x1,dy),pt(s2,x2,dy),pt(s1,x2,dy),color,mat);
    }
    function vein(s1,s2,x1,x2,width,col,raised=.007){
      m.quad(pt(s1,x1-width,raised),pt(s2,x2-width,raised),pt(s2,x2+width,raised),pt(s1,x1+width,raised),col,2);
    }
    function chevron(s,w,co){
      for(const sign of [-1,1]){const a=r.lane+sign*w*.45,b=r.lane+sign*.015;
        m.quad(pt(s,a,.018),pt(s+.59,b,.018),pt(s+.80,b,.018),pt(s+.21,a,.018),co,2);}
    }
    function deck(a,b,width,landing){
      const steps=Math.ceil((b-a)/(wood?.56:1.02)),stoneTones=palette.boards;
      // Match the physical shoulder blend, including its sloping side faces.
      const offsets=[-width,-width+.15,-width+.33,-width+r.shoulder,-width*.32,width*.32,width-r.shoulder,width-.33,width-.15,width];
      for(let n=0;n<steps;n++){
        const s1=a+(b-a)*n/steps,s2=a+(b-a)*(n+1)/steps,mid=(s1+s2)*.5;
        piece(mid,()=>{
          for(let j=0;j<offsets.length-1;j++){
            const x1=r.lane+offsets[j],x2=r.lane+offsets[j+1];
            const key=wood?(n*7+(j>3&&j<6?0:1))%4:(Math.floor(n/5)+Math.floor(j/3))%4;
            patch(s1,s2,x1,x2,0,stoneTones[key],wood?2:6);
            if(wood)patch(s1,s1+.018,x1,x2,.005,palette.edge,2);
          }
          for(const sign of [-1,1]){
            const x=r.lane+sign*(width-r.shoulder-.045),kick=r.lane+sign*(width-.21);
            if(wood){
              m.ring(pt(s1,x,.036),pt(s2,x,.036),r.style==='root'?.07:.044,r.style==='root'?.067:.043,palette.edge,5,2);
              if(n%4===0){const bolt=pt(mid,x,.083);m.blob(...bolt,.044,.018,.044,'#acaaa0',5,2);}
            }else if(n%3===0)vein(s1+.07,s2-.08,kick,kick-sign*.12,.022,palette.edge);
          }
          if(n%4===1){
            const side=n%8<4?1:-1,x=r.lane+side*width*.31;
            vein(s1+.09,s2-.05,x,x+side*(wood?.028:.15),wood?.013:.023,wood?'#846346':'#a88d70');
          }
          if(n%5===0&&wood){
            for(const side of [-1,1]){
              const x=r.lane+side*(width-r.shoulder-.09),top=pt(mid,x,-.13),foot=base(mid,x,0);
              if(top[1]>foot[1]+.24)m.ring(foot,top, .14,.13,palette.brace,6,2);
            }
          }
        });
      }
      if(!landing){
        for(const fraction of [.33,.57,.81]){const s=a+(b-a)*fraction;piece(s,()=>chevron(s,width,palette.stripe));}
      }else{
        // A broken pair of edge lines brackets the landing without covering its surface.
        for(const fraction of [.06,.16,.28]){const s=a+(b-a)*fraction;
          piece(s,()=>{for(const side of [-1,1]){const x=r.lane+side*(width-r.shoulder-.17);
            vein(s,s+.63,x,x,.084,palette.landing,.019);}});}
      }
      const end=landing?a:b,forward=landing?.13:-.15;
      piece(end,()=>{
        for(let j=0;j<offsets.length-1;j++){
          const x1=r.lane+offsets[j],x2=r.lane+offsets[j+1],v1=pt(end,x1),v2=pt(end,x2);
          const lower=(v,x)=>[v[0],wood?Math.max(base(end,x)[1]+.01,v[1]-.23):base(end,x)[1]+.03,v[2]];
          m.quad(v1,v2,lower(v2,x2),lower(v1,x1),palette.edge,wood?2:6);
          patch(Math.min(end,end+forward),Math.max(end,end+forward),x1,x2,.012,landing?palette.landing:palette.stripe,2);
          if(rock&&Math.abs(offsets[j])<width-.23){m.quad([v1[0],v1[1]-.23,v1[2]],[v2[0],v2[1]-.23,v2[2]],[v2[0],v2[1]-.29,v2[2]],[v1[0],v1[1]-.29,v1[2]],'#c19068',6);}
        }
        if(wood)for(const side of [-1,1]){const x=r.lane+side*(width-r.shoulder-.05),post=pt(end,x,-.16),foot=base(end,x,.015);
          if(post[1]-foot[1]>.36){m.ring(foot,post,.145,.14,palette.brace,7,2);
            const toe=base(end+(landing?.85:-.85),x,.065);m.ring(toe,post,.079,.08,palette.brace,5,2);}
        }
      });
    }
    deck(r.startS,r.lipS,r.halfWidth,false);deck(r.landingS,r.endS,r.landingWidth,true);
    return m;
  }
  function drawing(Mesh,c){
    const result=[];
    for(const r of root.AcornRamps.list(c)){
      const m=rampMesh(Mesh,c,r);
      for(const seg of m.roadSections){
        const faces=[];
        for(let j=seg.begin;j<seg.end;j+=30){
          const n=m.data.slice(j+3,j+6),sun=.74+.24*Math.max(0,-n[0]*.43+n[1]*.82-n[2]*.36);
          const color='rgb('+m.data.slice(j+6,j+9).map(x=>Math.round(Math.min(1,x*sun)*255)).join(',')+')';
          faces.push([m.data.slice(j,j+3),m.data.slice(j+10,j+13),m.data.slice(j+20,j+23),color]);
        }
        result.push({s:seg.s,branch:r.branch,faces});
      }
    }
    return result;
  }
  function paint(ctx,section,project){
    const faces=[];
    for(const [a,b,c,color] of section.faces){const p=project(...a),q=project(...b),r=project(...c);
      if(Math.min(p.z,q.z,r.z)>.68)faces.push([p,q,r,color,p.z+q.z+r.z]);}
    faces.sort((a,b)=>b[4]-a[4]);
    for(const [p,q,r,color] of faces){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.fill();}
  }
  root.AcornRampArt={rampMesh,drawing,paint};
})(typeof globalThis==='object'?globalThis:this);
