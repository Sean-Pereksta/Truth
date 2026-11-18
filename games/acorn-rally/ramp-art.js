(function(root){
  'use strict';
  const schemes={
    bark:{boards:['#a2784f','#ac8054','#ab7d4a','#98754f'],edge:'#68472f',stripe:'#e6c187',brace:'#785235',landing:'#91a478'},
    root:{boards:['#a08152','#a98c58','#997a4c','#ac8955'],edge:'#69513b',stripe:'#dec792',brace:'#745536',landing:'#8ca378'},
    sandstone:{boards:['#bc8059','#c38961','#c38b64','#bc805c'],edge:'#995e43',stripe:'#efd1a1',brace:'#ab6c50',landing:'#c9b995'},
    chalk:{boards:['#bcab89','#bdaa87','#c5b295','#bda986'],edge:'#9b8b72',stripe:'#765d45',brace:'#8d785e',landing:'#a0a388'},
    trestle:{boards:['#a38966','#937a54','#9a805d','#a58a66'],edge:'#5d523f',stripe:'#efc57c',brace:'#766147',landing:'#90ae8e'}
  };
  function rampMesh(Mesh,c,r){
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
