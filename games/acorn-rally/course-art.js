(function(root){
  'use strict';
  const TAU=Math.PI*2, cap=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
  const contacts={front:'Front bumper',rear:'Rear bumper',side:'Side contact',glance:'Glancing bump',brace:'Bumper brace'};
  function build(Mesh,simple=false){
    const shapes={};
    const make=name=>shapes[name]=new Mesh();
    const bar=(m,a,b,r,c,mat=2)=>m.ring(a,b,r,r,c,simple?4:6,mat);
    function disk(m,axis,radius,width,color,count=18){
      const p=(t,r)=>axis==='z'?[Math.cos(t)*r,Math.sin(t)*r,0]:[Math.cos(t)*r,.015,Math.sin(t)*r];
      for(let i=0;i<count;i++){const a=TAU*i/count,b=TAU*(i+1)/count;m.quad(p(a,radius),p(b,radius),p(b,radius-width),p(a,radius-width),color);}
    }
    function screenPoly(m,pts,co,z=-.095){
      for(let i=1;i<pts.length-1;i++)m.tri([pts[0][0],pts[0][1],z],[pts[i][0],pts[i][1],z],[pts[i+1][0],pts[i+1][1],z],co,5,[0,0,-1]);
    }
    // Bark splinters and the exposed scarps of the hollow trunk are visible from both directions.
    const log=make('envLog'),segments=simple?12:19;
    const bark=['#6b4935','#81563b','#795037','#5d4936','#927049'];
    for(let i=0;i<segments;i++){
      const a=TAU*i/segments,b=TAU*(i+1)/segments;
      const p=(t,r,z)=>[Math.cos(t)*r,Math.sin(t)*r,z],r=.93+.035*Math.sin(i*4.77);
      log.quad(p(a,r,-.98),p(b,r,-.98),p(b,r,.98),p(a,r,.98),bark[i%5],2);
      for(const end of [-1,1]){
        log.quad(p(a,r,end),p(b,r,end),p(b,.61,end),p(a,.61,end),'#c79a62',2);
        log.quad(p(a,.77,end*1.003),p(b,.77,end*1.003),p(b,.74,end*1.003),p(a,.74,end*1.003),'#98734c',2);
        log.quad(p(a,.61,end),p(b,.61,end),p(b,.56,end*.72),p(a,.56,end*.72),'#5c452f',2);
        log.tri(p(a,.56,end*.72),p(b,.56,end*.72),[.05,-.03,end*.68],'#352e25',2);
      }
      if(i%2===0){bar(log,p(a,r+.012,-.78),p(a+.08,r+.015,.72),.037,'#705034');
        log.blob(Math.cos(a)*.91,Math.sin(a)*.91,Math.sin(i*7.2)*.50,.13,.15,.46,['#578245','#82934d','#405e39'][i%3],simple?4:7,3);}
    }
    const culm=make('envBamboo');culm.ring([-1,0,0],[1,0,0],.16,.14,'#a4bd6f',10,3);
    for(let j=-4;j<=4;j++){const x=j*.213;culm.ring([x-.018,0,0],[x+.022,0,0],.18,.18,j%3?'#69854c':'#d5bc76',8,2);}
    for(const x of [-.76,.76]){bar(culm,[x,-.13,0],[x-.14,-.39,.04],.024,'#a35136');culm.tri([x-.08,-.25,.036],[x+.16,-.23,.036],[x+.07,-.58,.02],'#d75f42',2);}
    const stand=make('envPost');stand.box(0,0,0,.28,3.1,.31,0,'#795f42',2);
    for(const y of [.22,2.44,2.91])stand.box(0,y,0,.33,.10,.36,0,'#b59060',2);
    const gate=make('envSluice');for(const d of [-1,1]){gate.box(0,0,d*.97,.44,2.4,.34,0,'#68573f',2);
      gate.box(0,1.95,d*.97,.5,.14,.4,0,'#a19d87',2);}
    for(let i=0;i<6;i++)gate.box(0,.26+i*.30,0,.23,.265,1.79,0,i%2?'#90734f':'#aa8c61',2);
    bar(gate,[.15,.28,-.85],[.15,1.76,.85],.077,'#666e64');bar(gate,[.15,1.76,-.85],[.15,.28,.85],.077,'#666e64');
    const rock=make('envRock');const n=simple?7:12,rows=[[-.84,.47],[-.39,.91],[.3,.98],[.80,.53]];
    const rv=(i,j)=>{const t=TAU*i/n+(j%2)*.16,q=rows[j],rad=q[1]*(.95+.075*Math.cos(i*3.7+j*4.23));return [Math.cos(t)*rad,q[0]+.045*Math.sin(t*2+j),Math.sin(t)*rad];};
    for(let j=0;j<3;j++)for(let i=0;i<n;i++){
      const a=rv(i,j),b=rv(i+1,j),c=rv(i+1,j+1),d=rv(i,j+1);
      rock.tri(a,b,c,['#a96948','#b9734e','#c58962','#ac6547'][(i+j)%4],2);
      rock.tri(a,c,d,['#bd7c54','#b56f4b','#c98a64','#9e6245'][(i+2*j)%4],2);
      if(j===1&&i%2===0){const lift=v=>[v[0]*1.007,v[1]*(.48)+.04,v[2]*1.007];bar(rock,lift(d),lift(c),.027,'#dba982');}
    }
    for(let i=0;i<n;i++){rock.tri(rv(i,3),rv(i+1,3),[.07,.94,.03],'#cf9270',2);rock.tri(rv(i+1,0),rv(i,0),[-.06,-.94,-.03],'#956044',2);}
    const pebble=make('envPebble');pebble.blob(0,0,0,1,.73,.78,'#b08f6b',6,2);
    const waterColors=[['#6c9993','#86b6ac','#accbc1'],['#497f77','#70a99b','#b2d3bb'],['#487486','#8aabb5','#bad6d4']];
    const waterTri=(m,a,b,c,color,mat,edges)=>{
      m.tri(a,b,c,color,mat);
      if(m.data){const end=m.data.length;for(let i=0;i<3;i++)m.data[end-21+i*10]=mat+.27*edges[i];}
    };
    for(let style=0;style<3;style++){
      const m=make('envFlow'+style),[base,sheen,foam]=waterColors[style],cols=simple?16:30,rows=simple?7:13;
      const wave=z=>.045*Math.sin(12*z+style)+.031*Math.sin(23*z-.7*style);
      const forward=z=>.95-(style===2?.55:style===1?.32:.43)*z*z+wave(z);
      // The jet fans out from the gate, runoff spreads into lobes, and surf breaks on an arc.
      const point=(u,v)=>{
        const side=2*v-1,factor=style===0?.24+.76*u:style===1?.42+.58*Math.sin(u*1.81):.79+.21*Math.sin(u*Math.PI);
        const z=side*factor+.06*Math.sin(4.8*u+style)*Math.sin(Math.PI*v);
        const back=-.99+.22*side*side+.045*Math.sin(side*8+style);
        const x=back+(forward(side)-back)*u;
        const lip=(style===2?.34:style===1?.17:.10)*Math.exp(-Math.pow((u-.78)/.179,2))*(1-.74*Math.abs(side)**2);
        return [x,.026+lip+.024*Math.sin(10*u+side*5)*Math.sin(u*Math.PI),z];
      };
      const edge=(u,v)=>cap(Math.min(u*9,(1-u)*10,v*9,(1-v)*9));
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const u=i/rows,un=(i+1)/rows,v=j/cols,vn=(j+1)/cols;
        const a=point(u,v),b=point(u,vn),c=point(un,vn),d=point(un,v);
        const tint=.28+.38*u+.18*Math.sin(v*9+u*7)*Math.cos(u*8-v*4);
        const color=[1,3,5].map(k=>((1-tint)*parseInt(base.slice(k,k+2),16)+tint*parseInt(sheen.slice(k,k+2),16))/255);
        waterTri(m,a,b,c,color,8+style,[edge(u,v),edge(u,vn),edge(un,vn)]);
        waterTri(m,a,c,d,color,8+style,[edge(u,v),edge(un,vn),edge(un,v)]);
      }
      // Thin, branching foam threads widen under compression, then taper to nothing.
      const stitch=(track,lo,hi,width,offset=0)=>{
        const count=Math.max(4,Math.ceil((hi-lo)*cols));
        const rim=(t,which)=>{const v=lo+(hi-lo)*t,ell=Math.sin(Math.PI*t)**.64;
          const u=cap(track(v)+which*width*ell*(.61+.37*Math.sin(t*9+offset)),.02,.99),q=point(u,v);
          q[1]+=.014;return q;};
        for(let j=0;j<count;j++){const a=j/count,b=(j+1)/count;
          m.quad(rim(a,-1),rim(b,-1),rim(b,1),rim(a,1),foam,11.235);}
      };
      for(let i=0;i<(style===2?9:6);i++){
        const start=.015+i/(style===2?10:7),end=Math.min(.994,start+.11+.07*(1+Math.sin(i*7.1)));
        stitch(v=>.825+.051*Math.sin(v*15+style)+.026*Math.sin(v*36+.7),start,end,style===2?.02:.012,i);
        if(i%2===0)stitch(v=>.73+.082*Math.sin(v*17+i),start+.025,end,.008,i);
      }
      if(style<2)for(let i=0;i<8;i++){
        const seed=.12+i*.095,span=.07+.04*(1+Math.sin(i*7));
        stitch(v=>.20+.23*Math.sin((v-seed)/span*2.1+i*1.1)+.055*i,seed,Math.min(.98,seed+span),.008+i%3*.002,i);
      }
    }
    const foam=make('envFoam');
    for(let i=0;i<7;i++){
      const angle=i*2.399,reach=.27+.19*Math.sin(i*8.4),sz=.35+.13*Math.cos(i*5.3);
      const pt=(t,sign)=>[Math.cos(angle)*reach*t+sign*.036*(1-t)*Math.sin(angle),.028+sz*Math.sin(Math.PI*t),Math.sin(angle)*reach*t-sign*.036*(1-t)*Math.cos(angle)];
      for(let n=0;n<4;n++)foam.quad(pt(n/4,-1),pt(n/4,1),pt((n+1)/4,1),pt((n+1)/4,-1),i%3?'#caddcd':'#ebeddd',11.24);
      foam.blob(Math.cos(angle)*reach*.80,sz*(1.06+(i%2)*.15),Math.sin(angle)*reach*.78,.019,.044,.024,'#d7e8dd',4,11.25);
    }
    const chute=make('envChute'),ledge=make('envLedge');
    for(let i=0;i<8;i++)for(let j=0;j<6;j++){
      const pos=(u,v)=>{const bevel=.086*Math.sin(v*9.2)+.046*Math.sin(v*21);
        return [-.1+.9*(1-(1-u)**1.7)+bevel*u,2.8-2.65*u*u+.04*Math.cos(v*8.7)*(1-u),v*(.76+.18*u)+.035*Math.sin(v*8+u*5)];};
      const u=j/6,un=(j+1)/6,v=i/4-1,vn=(i+1)/4-1;
      const a=pos(u,v),b=pos(u,vn),c=pos(un,vn),d=pos(un,v);const e=v=>cap((1-Math.abs(v))*7);
      const col=['#8fbfb0','#74a9a1','#b6d2c3','#85b2ae'][i%4];
      waterTri(chute,a,b,c,col,12,[e(v),e(vn),e(vn)]);waterTri(chute,a,c,d,col,12,[e(v),e(vn),e(v)]);
    }
    for(let j=0;j<13;j++){
      const level=j<7?0:j<11?1:2,i=level===0?j:level===1?j-7:j-11,count=[7,4,2][level];
      const z=(i-(count-1)*.5)*(level===0?.49:level===1?.57:.69),x=[-.42,-.66,-.48][level]+.12*Math.sin(i*4.81);
      ledge.blob(x,.46+level*.86,z,.65+.17*Math.sin(i*3.9),.62,.48+.09*Math.cos(i),['#58614c','#626347','#77765b'][i%3],simple?5:8,6,i*.56);
      ledge.blob(x+.06,.91+level*.86,z,.47,.16,.42,['#678044','#80944d','#4b7041'][i%3],6,3);
    }
    for(const z of [-1.48,1.35])for(let j=0;j<5;j++){
      const a=j*2.4,base=[-.47,1.14,z],tip=[-.47+Math.cos(a)*.79,1.53+.26*Math.sin(j*4),z+Math.sin(a)*.60];
      ledge.tri(base,[tip[0]-.15,tip[1]-.13,tip[2]+.12],tip,j%2?'#708b45':'#47734b',3);
    }
    const arm=make('envCrane');arm.box(0,0,0,2,.20,.22,0,'#806345',2);
    for(const q of [-.83,.84])arm.box(q,.005,0,.087,.22,.235,0,'#666b59',2);
    arm.ring([.77,.035,-.13],[.77,.035,.13],.21,.21,'#5c5949',9,2);
    const brine=make('envBrine'),saltCrack=make('envCracks'),crystal=make('envCrystal');
    const pool=t=>.89+.071*Math.sin(t*3+.5)+.053*Math.cos(t*5.0)+.032*Math.sin(t*11.);
    for(let i=0;i<30;i++){
      const a=i*TAU/30,b=(i+1)*TAU/30,point=(r,t,y)=>[Math.cos(t)*r*pool(t),y,Math.sin(t)*r*pool(t)];
      const a1=point(.76,a,.018),b1=point(.76,b,.018),a2=point(1.04,a,.022),b2=point(1.04,b,.022);
      waterTri(brine,[0,.017,0],b1,a1,'#3e7981',13,[1,1,1]);
      waterTri(brine,a1,b1,b2,'#5b9799',13,[1,1,0]);waterTri(brine,a1,b2,a2,'#659e9b',13,[1,0,0]);
      if(i%5===0){const center=point(.63,a+.06,.037),end=point(1.06,a-.075,.038);
        bar(saltCrack,point(.42,a,.036),center,.010,'#899b96');bar(saltCrack,center,end,.012,'#899b96');
        bar(saltCrack,center,point(.88,a+.19,.037),.008,'#869e9b');}
    }
    for(let id=0;id<3;id++){
      const plate=make('envSaltPlate'+id),count=5+id;
      const corner=i=>{const a=(i%count)*TAU/count+.059*Math.sin((i%count)*5+id),rad=.81+.16*Math.sin((i%count)*4.9+id*.45);return [Math.cos(a)*rad,.12+(.025*Math.sin(a*3)),Math.sin(a)*rad];};
      for(let i=0;i<count;i++){
        const a=corner(i),b=corner(i+1),inner=v=>[v[0]*.86,v[1]+.013,v[2]*.86],bottom=v=>[v[0]*.96,-.14+v[1]*.26,v[2]*.96];
        plate.tri([.02,.16,-.05],inner(a),inner(b),i%3?'#ede9dc':'#e6e3d6',2,[0,1,0]);
        plate.quad(inner(a),a,b,inner(b),'#f3eddb',2);
        plate.quad(a,b,bottom(b),bottom(a),'#a2bab4',2);
      }
    }
    for(let i=0;i<4;i++){const angle=i*2.2;crystal.ring([Math.cos(angle)*.13,0,Math.sin(angle)*.13],[Math.cos(angle)*.36,.46+(i%2)*.15,Math.sin(angle)*.36],.18,.07,i%2?'#c7dad7':'#eff0dd',5,2);}
    const basket=make('envBasket'),woven=['#c59254','#d4ac70','#997044'];
    for(let row=0;row<8;row++)for(let side=0;side<4;side++){
      const a=side*Math.PI*.5,y=-.78+row*.15,rad=.77+row*.019,x=Math.cos(a)*rad,z=Math.sin(a)*rad;
      basket.box(x,y,z,1.78,.128,.12,Math.PI*.5-a,woven[(row+side)%3],2);
    }
    for(const x of [-.79,.79])for(const z of [-.79,.79])bar(basket,[x*.92,-.77,z*.92],[x*1.14,.43,z*1.14],.074,'#6d533e');
    basket.box(0,.39,0,1.74,.13,1.74,0,'#bb955c',2);
    basket.blob(-.28,.62,.08,.43,.31,.45,'#a66e49',8,2);basket.box(.36,.52,-.17,.54,.39,.61,.16,'#a79870',2);
    basket.box(0,-.44,-.91,.76,.43,.055,0,'#ba5342',2);screenPoly(basket,[[-.19,-.31],[.15,-.31],[.04,-.06],[-.13,-.06]],'#eee1ae',-.946);
    const rope=make('envRope');bar(rope,[0,0,0],[0,1,0],.045,'#b79b70');
    const marker=make('envMarker');marker.box(0,0,0,.10,.98,.11,0,'#72583b',2);
    marker.box(0,.75,0,.89,.73,.13,0,'#453d30',2);screenPoly(marker,[[-.408,.79],[.408,.79],[.408,1.436],[-.408,1.436]],'#e4be72');
    // Each sign carries the profile of the obstacle ahead, also readable in silhouette.
    for(let id=0;id<8;id++){
      const glyph=make('envSign'+id),ink='#4e4534',z=-.106,stroke=(a,b,w=.032)=>bar(glyph,[a[0],a[1],z],[b[0],b[1],z],w,ink,5);
      if(id===0||id===3){const points=id===0?[[-.25,1.03],[-.21,1.25],[-.04,1.32],[.25,1.18],[.22,.99],[.06,.94]]:
        [[-.26,.99],[-.20,1.23],[-.04,1.32],[.15,1.25],[.27,1.04],[.12,.96]];screenPoly(glyph,points,ink,z);if(!id){for(let i=0;i<10;i++){const a=TAU*i/10,b=TAU*(i+1)/10;bar(glyph,[-.09+.09*Math.cos(a),1.125+.115*Math.sin(a),z-.028],[-.09+.09*Math.cos(b),1.125+.115*Math.sin(b),z-.028],.020,'#e9c882',5);}}}
      else if([2,6,7].includes(id)){for(let row=0;row<2;row++)for(let i=0;i<8;i++)stroke([-.28+i*.07,1.00+row*.17+.048*Math.sin(i*1.15)],[ -.28+(i+1)*.07,1.00+row*.17+.048*Math.sin((i+1)*1.15)]);}
      else if(id===4){stroke([-.23,1.28],[-.02,1.18]);stroke([-.02,1.18],[-.11,1.08]);stroke([-.11,1.08],[.23,.97]);stroke([-.11,1.08],[.20,1.14]);}
      else if(id===5){screenPoly(glyph,[[-.22,1.13],[.22,1.13],[.17,.94],[-.17,.94]],ink,z);stroke([-.22,1.14],[0,1.32]);stroke([0,1.32],[.22,1.14]);}
      else {stroke([-.26,1.02],[.26,1.20],.065);stroke([.18,1.19],[.18,1.36]);stroke([-.18,1.06],[-.18,1.35]);}
    }
    for(const [name,color] of [['envReady','#729276'],['envAmber','#ffc15b'],['envActive','#ff8d60']]){const m=make(name);m.blob(0,1.58,0,.12,.095,.12,color,8,5);}
    const arrow=make('envArrow');screenPoly(arrow,[[-.33,.69],[.09,.69],[.09,.76],[.31,.61],[.09,.47],[.09,.54],[-.33,.54]],'#e3bd75',-.10);
    const stripes=make('envStripes');for(let i=-2;i<=2;i++){const z=i*.36;stripes.quad([-.92,.016,z-.08],[-.92,.016,z+.076],[.92,.016,z+.25],[.92,.016,z+.094],'#f2c477',5,[0,1,0]);}
    const shade=make('envShade');for(let j=0;j<16;j++){const a=TAU*j/16,b=TAU*(j+1)/16;shade.tri([0,.008,0],[Math.cos(a),.008,Math.sin(a)],[Math.cos(b),.008,Math.sin(b)],'#544e3d',0,[0,1,0]);}
    const scrape=make('envScrape');scrape.ring([0,0,-.24],[0,.035,.25],.039,.017,'#e3ceaa',4,2);
    const skid=make('envSkid');skid.quad([-.06,0,-.5],[.08,0,-.5],[.06,0,.5],[-.05,0,.5],'#5a5548',2);
    for(const [i,col] of ['#aa956e','#d5a47a','#c9baa1','#93a18c'].entries()){const dust=make('envLand'+i);
      dust.blob(-.13,.095,0,.23,.105,.25,col,6);dust.blob(.16,.125,-.11,.18,.12,.21,col,6);}
    return shapes;
  }
  function scene(h,time,emit){
    const {id,s,x,branch,sourceSide:side,anchorX,halfWidth:w,halfLength:l,bottom,top,progress:p,strength:k}=h;
    const water=id===2||id===6||id===7,warning=h.warning,active=h.active;
    const show=active?1:warning?1:h.phase==='receding'?cap(1-p*3):0;
    const at=(name,ss,xx,y,yaw=0,size=1,opacity=1,roll=0,pitch=0,stretch=[1,1,1])=>{if(opacity>.025&&size>.005)emit(name,ss,xx,y,yaw,size,Math.min(1,opacity),roll,pitch,stretch,branch);};
    const fixedSide=side*(branch?3.22:5.83),signX=side*(branch?3.10:5.88),signS=h.baseS-20;
    at('envMarker',signS,signX,0,0,1.22);
    at('envSign'+id,signS,signX,0,0,1.22);
    at('envArrow',signS,signX,0,0,1.22,1,0,0,[h.safeSide,1,1]);
    at(active?'envActive':warning?'envAmber':'envReady',signS,signX,0,0,warning?1.2+.045*Math.sin(time*7):1.22);
    if(warning){
      const area=water?Math.abs(anchorX-h.mainX):id===0?1.7:w;
      at('envStripes',s,h.mainX,.038,0,1,.14+.09*p+.03*Math.sin(time*5),0,0,[area,1,l]);
    }
    if(id===0&&show){
      const rot=active?p*3.8:warning?Math.sin(time*10)*.025*p:3.8;
      at('envShade',s,x,.034,0,1,.28*show,0,0,[w*.95,1,l]);
      at('envLog',s,x,.42,Math.PI*.40+.035*Math.sin(rot),1,show,rot,0,[.47,.41,w]);
      if(active)for(let i=0;i<3;i++){const q=(time*2+i/3)%1;at('envPebble',s+.3-q*.52,x+side*(w*.5+q*.4),.08+Math.sin(q*Math.PI)*.23,0,.10*(1-.5*q),1-q);}
    }
    if(id===1){
      at('envPost',h.baseS,side*5.65,0,0,1.12);
      at('envBamboo',s,x,(top+bottom)/2,0,1,1,0,0,[Math.max(.22,w-.1),1,l/.49]);
      for(const frac of [.28,.75]){
        const lane=anchorX+(h.tipX-anchorX)*frac,span=3.38-bottom-.2;
        if(span>.08)at('envRope',s,lane,bottom+.25,0,1,1,0,0,[1,span,1]);
      }
      at('envBamboo',s,side*3.31,3.43,0,1,1,0,0,[2.45,.69,.69]);
    }
    if(id===2){
      at('envSluice',s,side*3.26,.10,0,1,1,0,0,[1,1,1.06]);
      if(warning||active)at('envChute',s,side*3.05,.05,side>0?Math.PI:0,1,warning?.19+p*.22:.36+k*.53,0,0,[.49,.30+k*.35,1.1]);
    }
    if(id===3&&show){
      at('envShade',s,x,.035,0,1,(.15+.15*cap(1-bottom/3))*show,0,0,[w*(1+.12*bottom),1,l]);
      at('envRock',s,x,bottom+(top-bottom)*.5,active?p*1.75:0,1,show,active?p*1.95:0,active?p*.66:0,[w, .80,l]);
      if(warning||active&&bottom<.75)for(let i=0;i<4;i++){const u=(time*1.9+i*.217)%1;at('envPebble',s+Math.sin(i*4)*.73,x+side*(.2+i%3*.19),warning?3.3*(1-u*u):.1+Math.sin(u*Math.PI)*.33,i+u,.12+i%2*.036,show*(1-u*.55));}
    }
    if(id===4){
      at('envBrine',s,x,.035,0,1,.97,0,0,[w*1.05,1,l*1.06]);
      for(let i=0;i<7;i++){
        const a=(i-1)*TAU/6,d=i?.64:0,shift=k*(i?.34:.06),cx=x+Math.sin(a)*w*(d+shift),ss=s+Math.cos(a)*l*(d+shift);
        const shrink=i?1-.29*k:1-.93*k;
        at('envSaltPlate'+i%3,ss+.105*Math.cos(a*3),cx+.075*Math.sin(a*5),.06-k*(i?.02:.06),a*.33+i*.17,1,.98,Math.sin(a)*k*.36,Math.cos(a)*k*.21,[w*.55*shrink,.54,l*.57*shrink]);
      }
      at('envCracks',s,x,.122,0,1,.47+(warning?.32*p:.2),0,0,[w,1,l]);
      for(const sign of [-1,1])at('envCrystal',s+sign*l*1.04,x+side*w*.73,.03,0,.41);
    }
    if(id===5){
      at('envPost',s+.2,fixedSide,0,0,1,1,0,0,[1.2,1.94,1.2]);
      at('envCrane',s+.2,(fixedSide+side*.91)*.5,5.83,side>0?Math.PI:0,1,1,0,0,[Math.abs(fixedSide-side*.91)*.5,1,1]);
      const center=bottom+.735;
      at('envShade',s,x,.038,0,1,.27-.035*bottom,0,0,[w*1.04,1,l*1.02]);
      at('envBasket',s,x,center,Math.sin(time*1.8)*.05,1,1,Math.sin(time*2)*.035,0,[w, .94,l]);
      at('envRope',s,x,top+.45,0,1,1,0,0,[1.35,Math.max(.11,5.9-top-.45),1.35]);
      for(const side2 of [-1,1])for(const end of [-1,1]){
        const dx=side2*w*.85,dz=end*l*.83,up=top+.45-(center+.38);
        const len=Math.hypot(dx,dz,up);
        at('envRope',s+dz,x+dx,center+.38,Math.atan2(dx,dz),1,1,0,-Math.atan2(Math.hypot(dx,dz),up),[.83,len,.83]);
      }
    }
    if(id===6){
      at('envLedge',s,side*6.43,.02,side>0?Math.PI:0,1,1,0,0,[1.23,1.13,1.23]);
      at('envChute',s,side*6.38,.01,side>0?Math.PI:0,1,.82,0,0,[1.66,1.08,1.45]);
      at('envFoam',s,side*5.03,.06,time*.26,.74,.72);
    }
    if(water){
      const style=id===2?0:id===6?1:2,edge=active?x:anchorX;
      const amplitude=active?Math.max(.16,k):warning?.17+p*.16:.17;
      const reach=active?Math.max(.1,w):.21;
      at('envFlow'+style,s,edge,.043,side>0?Math.PI:0,1,.73+amplitude*.24,0,0,[reach,.47+amplitude*(id===7?.87:.60),l]);
      if(active||warning)for(let i=0;i<(id===7?5:3);i++){
        const count=id===7?5:3,zz=-.82+1.64*(i+.36)/count;
        const lip=.95-(id===7?.55:id===6?.32:.43)*zz*zz+.045*Math.sin(12*zz+style)+.031*Math.sin(23*zz-.7*style);
        const u=(time*1.48+i*.668)%1;
        at('envFoam',s+zz*l+Math.sin(time*.9+i)*.12,active?edge-side*reach*(lip-.045):anchorX,
          .06+Math.sin(u*Math.PI)*.06,.21*Math.sin(time*2+i),(.28+.38*amplitude)*(id===7?1.26:1),(.48+.37*amplitude)*Math.sin(Math.PI*u),0,0,[.93,1,1.13]);
      }
    }
  }
  function reaction(st,r,emit){
    if(r.landingSeq&&r.landingFx>0){
      const t=cap(1-r.landingFx/.60),force=cap(r.landingForce),dry=st.trackIndex===3?1:st.trackIndex===5?2:st.trackIndex===6?3:0;
      for(const side of [-1,1]){
        const s=r.s-.53-Math.max(0,r.v)*t*.54,x=r.x+side*(.54+t*(.38+force*.3));
        const deck=root.AcornRamps?.surface(root.AcornSim.track(st.trackIndex),s,x,r.branch)||0;
        emit('envLand'+dry,s,x,deck+.06+t*.19,side*t*.5,.58+force*.54+t*.61,(1-t)*(.29+.26*force),0,0,[1,1,1.15],r.branch);
      }
    }
    const h=r.hazardHit,age=h?st.time-h.at:1;
    if(h&&age>=0&&age<.53){
      const t=age/.53,water=[2,6,7].includes(h.id);
      for(let j=0;j<5;j++){const dir=(j%2?1:-1),span=.37+t*(.49+(j%3)*.18);
        emit(water?'envFoam':h.id===4?'envCrystal':'envPebble',r.s-.2-t*(1.15+j%2*.53),r.x+dir*span,
          .17+Math.sin(t*Math.PI)*(.26+j%3*.15),t*3+j,(water?.39:.16)*(1-t*.52),.94*(1-t),j*.2,0,[1,1,1],r.branch);}
    }
    if(!r.contactSeq||!(r.contactFx>0))return;
    const t=cap(1-r.contactFx/.58),force=cap(r.contactForce||.24),side=-(r.contactSide||1),kind=r.contactKind;
    const ds=kind==='front'||kind==='brace'?.68:kind==='rear'?-.86:-.13;
    for(let i=0;i<3+Math.floor(force*4);i++){
      const j=(i*13+r.contactSeq*7)%19,u=j/18,spread=(.26+u*.7)*t;
      emit('envScrape',r.s+ds-(.22+u)*t*1.6,r.x+side*(.68+spread),.31+Math.sin(Math.PI*t)*(.17+u*.43)-t*.17,
        side*(.28+u*.83),.34+force*.34,(1-t)*.91,side*(t*2.7+u),-.3,[1,1,.72+force],r.branch);
    }
    if(t<.7&&force>.33)emit('envSkid',r.s-.8-t*.6,r.x+side*.51,.028,side*.13,1,.31*(1-t),0,0,[1,1,.36+t*.9],r.branch);
  }
  let geometry2d=null;
  function fallbackMeshes(Mesh){
    if(geometry2d)return geometry2d;
    geometry2d={};
    for(const [key,m] of Object.entries(build(Mesh,true))){
      const coords=[],map=new Map(),faces=[];
      for(let i=0;i<m.data.length;i+=30){const indices=[];
        for(let j=0;j<3;j++){const k=i+j*10,pos=m.data.slice(k,k+3),id=pos.map(n=>Math.round(n*10000)).join(',');
          if(!map.has(id)){map.set(id,coords.length);coords.push(pos);}indices.push(map.get(id));}
        const n=m.data.slice(i+3,i+6),c=m.data.slice(i+6,i+9),light=m.data[i+9]===5?.99:.75+.26*Math.max(0,.42*n[0]+.78*n[1]-.53*n[2]);
        const m0=m.data[i+9],coverage=m0>7.98?cap(((m0%1)+(m.data[i+19]%1)+(m.data[i+29]%1))/.81):1;
        faces.push([...indices,'rgb('+c.map(k=>Math.round(255*cap(k*light))).join(',')+')',coverage]);
      }
      geometry2d[key]={coords,faces};
    }
    return geometry2d;
  }
  function paint(ctx,library,P,name,s,x,height,yaw=0,size=1,opacity=1,roll=0,pitch=0,stretch=[1,1,1],branch=false){
    const mesh=library[name];if(!mesh||opacity<.04)return;
    const p=P(s,x,height,branch);if(p.z<1.0||p.z>116)return;
    const px=P(s,x+1,height,branch),pz=P(s+1,x,height,branch),py=P(s,x,height+1,branch);
    const ox=p.x*p.z,oy=p.y*p.z,delta=q=>[q.x*q.z-ox,q.y*q.z-oy,q.z-p.z];
    const ax=delta(px),az=delta(pz),ay=delta(py),a=Math.cos(roll),b=Math.sin(roll),c=Math.cos(yaw),d=Math.sin(yaw),k=Math.cos(pitch),l=Math.sin(pitch);
    const projected=mesh.coords.map(v=>{
      const X=v[0]*size*stretch[0],Y=v[1]*size*stretch[1],Z=v[2]*size*stretch[2];
      const dx=(c*a+d*l*b)*X+(-c*b+d*l*a)*Y+d*k*Z,dy=k*b*X+k*a*Y-l*Z,dz=(-d*a+c*l*b)*X+(d*b+c*l*a)*Y+c*k*Z;
      const depth=p.z+dx*ax[2]+dy*ay[2]+dz*az[2];
      return [(ox+dx*ax[0]+dy*ay[0]+dz*az[0])/Math.max(.42,depth),(oy+dx*ax[1]+dy*ay[1]+dz*az[1])/Math.max(.42,depth),depth];});
    const tris=[];
    for(const [A,B,C,color,coverage] of mesh.faces){
      const u=projected[A],v=projected[B],w=projected[C];if(Math.min(u[2],v[2],w[2])<.65)continue;
      if(Math.abs((v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]))<.10)continue;
      tris.push([u,v,w,color,u[2]+v[2]+w[2],coverage]);
    }
    tris.sort((a,b)=>b[4]-a[4]);ctx.save();ctx.globalAlpha=cap(opacity);
    for(const [a,b,c,color,depth,coverage] of tris){ctx.globalAlpha=cap(opacity*coverage);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.fill();}
    ctx.restore();
  }
  function hud(ctx,w,h,r,time,compact){
    if(!r.contactSeq||r.contactFx<=.055||r.finish||r.itemHitFx>.42)return;
    const t=cap(1-r.contactFx/.58),force=cap(r.contactForce||.22),kind=r.contactKind||'side';
    if(kind==='glance'&&force<.21)return;
    const label=contacts[kind].toUpperCase(),offset=compact?37:58,side=r.contactSide>0?-1:1,center=w*.5+side*(compact?28:47),y=h*.71,size=compact?9:12;
    ctx.save();ctx.globalAlpha=cap((1-t)*3)*(.74+force*.22);ctx.font='700 '+size+'px Condensed, sans-serif';ctx.textAlign='center';
    const width=Math.max(offset,ctx.measureText(label).width+18);
    ctx.fillStyle='#22332eea';ctx.fillRect(center-width*.5,y-size-4,width,size+9);
    ctx.fillStyle='#efd4a4';ctx.fillRect(side<0?center-width*.5:center+width*.5-2,y-size-4,2,size+9);
    ctx.fillText(label,center,y);ctx.restore();
  }
  function feedback(sound,pad,kind,force,quiet=false){
    const f=cap(force||.29),gain=quiet?.60:1;
    if(kind==='side'||kind==='glance'){
      sound.tone(184,.055,(.010+f*.017)*gain,'triangle',118);
      sound.tone(470,.074,(.004+f*.006)*gain,'sawtooth',278,.026);
    }else if(kind==='water'){
      sound.tone(135,.15,.019*gain,'sine',61);sound.tone(340,.105,.008*gain,'triangle',178,.04);
    }else{
      sound.tone(kind==='brace'?138:107,.095,(.022+f*.022)*gain,'triangle',54);
      sound.tone(kind==='stone'?286:326,.044,(.008+f*.012)*gain,'triangle',160,.008);
    }
    try{pad?.vibrationActuator?.playEffect('dual-rumble',{duration:Math.round(44+82*f),strongMagnitude:.10+f*.32,weakMagnitude:.13+f*.31})?.catch(()=>{});}catch{}
  }
  function approach(sound,id){
    const cues=[
      [[180,86,.12],[120,77,.08]],[[656,820,.12],[896,690,.14]],[[175,116,.14],[310,202,.15]],
      [[216,97,.065],[293,144,.055]],[[595,310,.04],[810,440,.045]],[[420,298,.11],[339,253,.08]],
      [[305,216,.12],[363,243,.14]],[[173,111,.16],[251,155,.17]]
    ][id];
    cues.forEach(([tone,end,duration],i)=>sound.tone(tone,duration,i?.009:.014,id===4?'square':'triangle',end,i*.082));
  }
  root.AcornCourseArt={meshes:build,scene,reaction,fallbackMeshes,paint,hud,feedback,approach};
})(typeof globalThis==='object'?globalThis:this);
