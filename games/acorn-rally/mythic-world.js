(function(root){
  'use strict';
  const tau=Math.PI*2;
  const palettes=[
    {sky:'#2e3265',mist:'#a19ac6',soil:'#7683bb',edge:'#514b79',land:'#827fa9',wood:'#575a92',accent:'#ffe0ab',leaf:['#94b9e2','#c8aee0','#e4c9b9'],water:'#9c9bc7'},
    {sky:'#67acb2',mist:'#cee0b1',soil:'#57886f',edge:'#375e51',land:'#5f8c61',wood:'#506f5b',accent:'#ffdb95',leaf:['#92bf70','#5c967b','#d79bb3'],water:'#5c9a8d'},
    {sky:'#24192f',mist:'#805467',soil:'#554153',edge:'#322535',land:'#372738',wood:'#514152',accent:'#ffc383',leaf:['#755266','#624359','#98635f'],water:'#713849'},
    {sky:'#608fb4',mist:'#e3c5a0',soil:'#cec5af',edge:'#726e74',land:'#9b9b9e',wood:'#a39382',accent:'#efbf64',leaf:['#6e8973','#85927a','#a49a77'],water:'#b0b7bd'}
  ];
  // Geometry uses world units. Z faces the course, Y is the deck height.
  const step=(p,x,y,z)=>[p[0]+x,p[1]+y,p[2]+z];
  const polar=(x,y,z,r,theta)=>[x+r*Math.cos(theta),y,z+r*Math.sin(theta)];
  const strut=(m,a,b,r,color,mat=0)=>m.ring(a,b,r,r,color,5,mat);

  function island(m,w,top,bottom){
    const rim=[
      [-.92,.04,-.2],[-.6,.19,-.78],[.17,.24,-.91],[.84,.17,-.47],
      [1,.03,.18],[.49,.16,.78],[-.19,.14,.92],[-.82,.09,.62]
    ];
    const vertices=rim.map(([x,y,z])=>[x*w,y*w,z*w]);
    vertices.forEach((a,i)=>{
      const b=vertices[(i+1)%vertices.length];
      const low=q=>[q[0]*.72,-w*(.35+Math.abs(q[2])*.023),q[2]*.76];
      m.tri([0,.27*w,0],b,a,top[i%top.length],23);
      m.quad(a,b,low(b),low(a),bottom[i%bottom.length],23);
      m.tri(low(a),low(b),[-.12*w,-1.14*w,.13*w],bottom[(i+1)%bottom.length],23);
    });
  }
  // A thick crescent cut out of an offset arc. Its tips close on each other.
  function crescent(m,x,y,z,r,depth,outer,inner){
    function point(theta,inside,back){
      const bite=inside?.53*Math.pow(Math.sin(theta*.5),.80):0;
      const a=.26*Math.PI+theta*.74;
      return [x+Math.cos(a)*r+bite*r,y+Math.sin(a)*r*(inside?1-bite*.62:1),z+(back?depth:0)];
    }
    for(let i=0;i<18;i++){
      const a=i*tau/18,b=(i+1)*tau/18;
      const p=point(a,false,false),q=point(b,false,false),u=point(a,true,false),v=point(b,true,false);
      const back=k=>step(k,0,0,depth);
      m.quad(p,q,v,u,outer,22);m.quad(back(u),back(v),back(q),back(p),inner,22);
      m.quad(p,back(p),back(q),q,inner,5);m.quad(u,v,back(v),back(u),inner,5);
    }
  }
  function dreamHarp(m){
    island(m,4.3,['#b5aecf','#a39dc8','#cdbdd5'],['#69658b','#8b81a4','#6e739a']);
    crescent(m,0,5.75,0,4.85,.5,'#e7c58b','#f6dcb2');
    for(let i=0;i<5;i++){
      const x=-2.95+i*.7,y=8.75+.5*Math.sin(i*.8);
      strut(m,[x,1.25,.29],[x,y,.29],.043,i%2?'#c2dced':'#f5d8aa',5);
      m.blob(x,y+.25,.29,.23,.42,.21,'#d7e9ff',6,22);
    }
    for(let i=0;i<3;i++)m.blob(-2+i*2.04,-.52,-1.85,1.95,.78,1.18,i%2?'#c4c4dc':'#b6b6d3',7);
  }
  function dreamOrrery(m){
    island(m,3.35,['#bbb6d3','#b3a2cc'],['#73769f','#a093b0','#696782']);
    m.ring([0,.4,0],[0,3.1,0],.72,.41,'#86789b',8);
    const c=[0,6.1,0];
    m.blob(...c,1.45,1.45,1.45,'#e6c1be',12,22);
    for(let ring=0;ring<2;ring++){
      const at=a=>step(c,Math.cos(a)*(3.4-ring*.55),Math.sin(a)*(ring===0?.88:2.63),Math.sin(a)*(ring===0?3.33:1.15));
      for(let i=0;i<20;i++)strut(m,at(i*tau/20),at((i+1)*tau/20),.095,ring?'#edc789':'#c1cfe4',5);
      m.blob(...at(1.4+ring*1.87),.46,.46,.46,ring?'#fbe1bc':'#a8d9e5',7,22);
    }
  }
  function cloudfall(m){
    // The thin streams run below the flying islands like falling constellation lines.
    for(let i=0;i<7;i++){
      const a=i*tau/7,center=polar(0,Math.sin(a*2)*1.12,0,3.8,a);
      m.blob(...center,3.9,1.88,3.32,i%2?'#c2bcd8':'#b5bfd9',8);
    }
    m.blob(-.65,1.15,0,4.25,2.27,3.63,'#d2c9dc',9);
    for(let i=0;i<5;i++){
      const a=i*1.4,x=3.56*Math.sin(a),z=3.56*Math.cos(a),length=3.7+i*.71;
      m.ring([x,-.55,z],[x+.37,-length,z],.18,.055,i%2?'#c1d9ea':'#a6bada',6,22);
      m.blob(x+.37,-length-.34,z,.30,.49,.29,'#f1d9c4',7,22);
    }
  }
  // A folded lamina with a raised midrib and pointed tip, used for leaves and petals.
  function petal(m,base,angle,length,width,lift,col,shade,vein){
    const front=[Math.sin(angle),0,Math.cos(angle)],right=[front[2],0,-front[0]];
    const at=(f,s,h)=>[base[0]+front[0]*f+right[0]*s,base[1]+h,base[2]+front[2]*f+right[2]*s];
    const mid=at(length*.47,0,lift*.48+.24),tip=at(length,0,lift);
    const left=at(length*.51,-width,lift*.44),rt=at(length*.51,width,lift*.44);
    m.tri(base,left,mid,shade);m.tri(base,mid,rt,col);
    m.tri(mid,left,tip,shade);m.tri(mid,tip,rt,col);
    strut(m,base,mid,.048,vein);strut(m,mid,tip,.033,vein);
  }
  function bell(m,top,size,col,lip){
    const lower=step(top,0,-size*1.3,0),verts=[];
    for(let i=0;i<10;i++){
      const a=i*tau/10,b=(i+1)*tau/10;
      const rim=t=>polar(...lower,size*(.83+.09*Math.cos(5*t)),t);
      const edge=t=>step(rim(t),0,-.22*size*(1+Math.cos(5*t)),0);
      const neck=t=>polar(...step(top,0,-.29*size,0),size*.41,t);
      m.tri(top,neck(a),neck(b),col);m.quad(neck(a),rim(a),rim(b),neck(b),col);
      m.quad(rim(a),edge(a),edge(b),rim(b),lip);
      verts.push(edge(a));
    }
    for(let i=0;i<10;i++)m.tri(verts[i],step(lower,0,.41*size,0),verts[(i+1)%10],'#825482');
    strut(m,top,step(lower,0,-.38*size,0),.07*size,'#ffdf96',5);
    m.blob(...step(lower,0,-.44*size,0),size*.20,size*.29,size*.20,'#ffc563',6,5);
  }
  function foxglove(m){
    island(m,3.25,['#7e9b65','#7b9367'],['#5e6252','#74634e','#536858']);
    const stalk=[[0,.5,0],[-.37,3,0],[.22,6.9,0],[.89,9.55,.4]];
    for(let i=0;i<3;i++)m.ring(stalk[i],stalk[i+1],.30-.055*i,.24-.065*i,'#558557',7,3);
    for(let i=0;i<6;i++){
      const angle=.43+i*2.44,root=[.28+i*.056,4.2+i*.88,.05];
      const tip=polar(...step(root,0,.57,0),1.44+(5-i)*.14,angle);
      strut(m,root,tip,.095,'#759c64',3);bell(m,tip,1.17-i*.087,i%2?'#cc81a6':'#af82b4','#e5aac0');
      if(i<4)petal(m,[0,1.35+i*.37,0],angle,3.6-i*.32,.9,.52+i*.32,'#7bb47b','#538f73','#aad296');
    }
  }
  function fairySpire(m){
    island(m,3.95,['#8caa72','#7b9a66'],['#596b53','#786c58']);
    m.ring([0,.65,0],[0,4.9,0],1.78,1.45,'#c7a887',10,2);
    for(let i=0;i<7;i++){
      const a=i*tau/7,base=polar(0,4.65,0,1.36,a);
      petal(m,base,a,2.25,1.35,-.56,'#d990ac','#ad7096','#ffd0c9');
      const window=polar(0,2.75,0,1.66,a);
      m.blob(...window,.31,.61,.31,'#ffdf93',6,5);
    }
    m.ring([0,4.8,0],[0,7.65,0],1.81,.08,'#93aa71',9,3);
    m.blob(0,7.88,0,.33,.52,.33,'#fce8a9',7,22);
    for(let i=0;i<3;i++)petal(m,[0,.81,0],i*2.14,3.82,1.11,1.02,'#77a07c','#57836a','#9cc691');
  }
  function dewLily(m){
    island(m,5.7,['#709064','#6c8b67','#8eaa70'],['#5c6054','#6f6354','#586654']);
    const bloom=[.3,3.84,.1];
    m.ring([0,.4,0],bloom,.45,.26,'#5d865d',7,3);
    for(let i=0;i<8;i++){
      const angle=i*tau/8;
      petal(m,bloom,angle,4.02,1.35,1.68,'#efb4b1','#da96a2','#f2c8b1');
      if(i%2===0)petal(m,[0,1,0],angle+.30,5.15,1.67,1.02,'#7da67a','#58886e','#a5bc81');
    }
    for(let i=0;i<5;i++){
      const base=polar(...bloom,.43,i*tau/5),top=step(base,Math.sin(i)*.25,1.13+Math.cos(i)*.25,Math.cos(i)*.25);
      strut(m,base,top,.09,'#ecc675',5);m.blob(...top,.21,.34,.21,'#ffe4a0',6,5);
    }
    m.blob(2.04,2.06,-1.79,.69,.73,.69,'#b1e5d9',9,22);
  }
  function bone(m,a,b,ra,rb){
    m.ring(a,b,ra,rb,'#b3a094',7,23);
    m.ring(a,step(a,(b[0]-a[0])*.12,(b[1]-a[1])*.12,(b[2]-a[2])*.12),ra*1.18,ra,'#c4b1a2',7,23);
  }
  function ribs(m){
    island(m,4,['#5f4150','#593a48'],['#342635','#463447','#574554']);
    for(let j=0;j<3;j++){
      const z=(j-1)*2.25,h=7.6-j*.85;
      const a=[-2.4,.4,z],b=[-3.39,h*.43,z-.21],c=[-2.58,h*.85,z+.08],d=[-.31,h,z+.38];
      bone(m,a,b,.62,.45);bone(m,b,c,.46,.31);bone(m,c,d,.32,.019);
      const point=[2.23,.47,z+.2];
      m.ring(point,step(point,-.42,2.65+.34*j,-.18),.59,.01,'#9d6773',5,23);
    }
  }
  function eyeShrine(m){
    island(m,3.7,['#513848','#634454'],['#463245','#3a2a3b']);
    for(const side of [-1,1]){
      const a=[side*2,.4,0],b=[side*2.67,4.4,.2],c=[side*1.62,7.1,-.13],d=[side*2.84,9.85,0];
      m.ring(a,b,.94,.57,'#3b2b42',5,23);m.ring(b,c,.68,.39,'#66475a',5,23);m.ring(c,d,.51,.015,'#82616f',5,23);
    }
    const eyeZ=-.13,y=4.92;
    for(let i=0;i<16;i++){
      const at=t=>[2.07*Math.cos(t),y+Math.sin(t)*(.3+.7*Math.abs(Math.sin(t))),eyeZ];
      m.tri(at(i*tau/16),at((i+1)*tau/16),[0,y,eyeZ-.20],'#dc967e',5);
      strut(m,at(i*tau/16),at((i+1)*tau/16),.17,'#795768',23);
    }
    m.blob(0,y,eyeZ-.03,.65,.80,.27,'#e6a652',7,5);
    m.blob(0,y,eyeZ-.09,.16,.75,.31,'#331e37',7);
  }
  function crag(m){
    for(let i=0;i<7;i++){
      const a=i*tau/7,h=5.5+2.7*Math.cos(a*2),base=polar(0,-1.7,0,2.98,a);
      const joint=step(base,Math.sin(a)*.75,h,Math.cos(a)*.75),tip=step(joint,.7,2.6+1.89*Math.sin(a),-.4);
      m.ring(base,joint,1.82,.73,i%2?'#4a394f':'#574050',5,23);
      m.ring(joint,tip,.73,.016,i%3?'#62495a':'#9e6e71',5,23);
      if(i%2===0){
        const seam=step(base,.79,.31,-.68),kink=step(seam,.24,h*.46,.26);
        strut(m,seam,kink,.065,'#cc7e77',5);strut(m,kink,step(kink,-.27,h*.4,.17),.045,'#cb8a7e',5);
      }
    }
  }
  function column(m,x,z,height){
    m.box(x,0,z,1.76,.27,1.76,0,'#c0ae96',23);
    m.ring([x,.26,z],[x,.62,z],.83,.70,'#eee1c3',12,23);
    for(let i=0;i<16;i++){
      const a=i*tau/16,b=(i+1)*tau/16,mid=(a+b)/2;
      const rim=(t,y,r)=>polar(x,y,z,r,t);
      for(const [u,v,ru,rv] of [[a,mid,.70,.63],[mid,b,.63,.70]]){
        m.quad(rim(u,.59,ru),rim(v,.59,rv),rim(v,height-.58,rv*.78),rim(u,height-.58,ru*.78),i%3?'#e4d9c2':'#d9ceb8',23);
      }
    }
    m.ring([x,height-.63,z],[x,height-.45,z],.56,.65,'#c39c64',12,5);
    m.ring([x,height-.45,z],[x,height-.19,z],.68,.90,'#e6d7bc',12,23);
    m.box(x,height-.2,z,1.83,.25,1.83,0,'#eee1c8',23);
  }
  function portico(m){
    island(m,6.4,['#aa9b91','#ada59b'],['#89838b','#6e6c7b','#979199']);
    m.box(0,.64,0,10.8,.39,5.7,0,'#b5a290',23);
    m.box(0,1.03,0,10.28,.36,5.32,0,'#d4bea3',23);
    for(const x of [-4.1,-1.38,1.38,4.1])for(const z of [-1.65,1.65])column(m,x,z,7.6);
    m.box(0,7.59,0,10.91,.56,5.45,0,'#ebe1c9',23);
    m.box(0,8.15,0,11.2,.18,5.68,0,'#bb944f',5);
    for(const side of [-1,1]){
      const p=2.85*side;
      m.tri([-5.43,8.29,p],[0,10.34,p],[5.43,8.29,p],'#c7a880',23);
      m.tri([-4.2,8.53,p+side*.017],[0,9.99,p+side*.017],[4.2,8.53,p+side*.017],'#a17f61',23);
      const a=[-5.53,8.30,p],b=[0,10.41,p],c=[5.53,8.30,p];
      strut(m,a,b,.17,'#efdfbf');strut(m,b,c,.17,'#efdfbf');
    }
    m.quad([-5.5,8.3,-2.85],[0,10.41,-2.85],[0,10.41,2.85],[-5.5,8.3,2.85],'#9b7164',23);
    m.quad([0,10.41,-2.85],[5.5,8.3,-2.85],[5.5,8.3,2.85],[0,10.41,2.85],'#ad7e6e',23);
  }
  function brazier(m){
    island(m,2.65,['#beb5a3','#a89e93'],['#828491','#716e7d']);
    column(m,0,0,3.0);
    for(let i=0;i<3;i++){
      const a=tau*i/3;
      strut(m,polar(0,3.06,0,.96,a),polar(0,5.23,0,.6,a),.11,'#ad8344',5);
    }
    m.ring([0,4.94,0],[0,5.61,0],.55,1.28,'#b38a48',10);
    m.ring([0,5.6,0],[0,5.79,0],1.31,1.32,'#e1bf76',12,5);
    for(let i=0;i<5;i++){
      const a=i*tau/5,base=polar(0,5.76,0,.53,a);
      m.ring(base,step(base,.24,1.15+(i%3)*.33,-.12),.42,.018,i%2?'#ffc97b':'#f69b5f',6,5);
    }
  }
  function sacredOlive(m){
    island(m,4.25,['#aaa795','#afa893'],['#827f86','#89848b','#6a6b79']);
    const base=[0,.75,0],fork=[-.32,3.23,0];
    m.ring(base,fork,.75,.46,'#776748',8,2);
    for(let i=0;i<5;i++){
      const a=i*tau/5,elbow=polar(0,4.65+(i%2)*.6,0,1.48,a),top=polar(0,5.85+(i%2)*.9,0,2.53,a);
      m.ring(fork,elbow,.38,.23,'#806d51',7,2);m.ring(elbow,top,.24,.10,'#907952',6,2);
      m.blob(...top,2.02,1.09,1.65,i%2?'#879d80':'#728c76',8,3,a);
      m.blob(...step(top,-.6,.65,.39),1.72,.8,1.19,'#a0ad87',7,3,a);
    }
  }

  // Rare skyline landmarks are also captured by the angle-cached Canvas painter.
  function lunarLoom(m){
    island(m,5.1,['#9e9fc8','#b2a7c6','#c7b5d0'],['#5f628b','#777797','#8481a2']);
    m.ring([0,.59,0],[0,1.22,0],2.32,2.20,'#9690ae',12,23);
    m.ring([0,1.22,0],[0,1.53,0],2.11,1.96,'#d8b87d',12,7);
    m.ring([0,1.51,0],[0,3.83,0],1.85,.77,'#6d81a5',10,22);
    for(let i=0;i<6;i++){
      const a=i*tau/6;
      strut(m,polar(0,1.5,0,1.71,a),polar(0,3.8,0,.76,a),.083,'#d6b884',7);
    }
    for(let j=0;j<3;j++){
      const yaw=j*tau/3+.23,tilt=.20+.27*j,r=3.72+j*.31;
      const at=t=>[r*(Math.cos(t)*Math.cos(yaw)-Math.sin(t)*Math.sin(yaw)*tilt),
        6.45+r*Math.sin(t)*Math.sqrt(1-tilt*tilt),r*(Math.cos(t)*Math.sin(yaw)+Math.sin(t)*Math.cos(yaw)*tilt)];
      for(let k=0;k<30;k++)strut(m,at(k*tau/30),at((k+1)*tau/30),.075,j===1?'#d5d9e8':'#d8b178',7);
      m.blob(...at(.6+j*1.8),.33,.33,.33,['#a8dddf','#e8bd92','#b0c4ee'][j],8,22);
    }
    const corners=(axis,sgn,x,z)=>axis===0?[sgn*.31,x*.33,z*.33]:axis===1?[x*.33,sgn*.31,z*.33]:[x*.33,z*.33,sgn*.31];
    for(const tip of [[0,2.58,0],[0,-2.35,0],[1.75,0,0],[-1.75,0,0],[0,0,1.75],[0,0,-1.75]]){
      const axis=tip.findIndex(v=>v!==0),sgn=Math.sign(tip[axis]),center=[0,6.45,0];
      const shell=[[-1,-1],[1,-1],[1,1],[-1,1]].map(v=>step(center,...corners(axis,sgn,...v)));
      for(let i=0;i<4;i++)m.tri(shell[i],shell[(i+1)%4],step(center,...tip),i%2?'#d3d1ec':'#fff0c0',5);
    }
  }
  function mushroomHall(m){
    island(m,5.6,['#899760','#73936a','#97a572'],['#546445','#626b51','#4e6150']);
    function turret(x,z,size,col){
      const pos=(a,y,r)=>polar(x,y*size,z,r*size,a),rows=[[4.25,.70],[4.56,2.12],[4.70,2.28],[5.15,1.93],[5.72,1.31],[6.03,.47],[6.05,.01]];
      m.ring([x,.6*size,z],[x,4.62*size,z],1.15*size,.82*size,'#d6c7a3',12,23);
      for(let k=0;k<14;k++){
        const a=k*tau/14,b=(k+1)*tau/14;
        for(let j=1;j<rows.length;j++)m.quad(pos(a,...rows[j-1]),pos(b,...rows[j-1]),pos(b,...rows[j]),pos(a,...rows[j]),j===1?'#ddc1a1':j===2?'#efd8b3':col,j<=2?23:3);
        strut(m,pos(a,4.20,.71),pos(a,4.52,2.10),.044*size,'#a58e73',23);
        if(k%2===0){
          m.blob(...pos(a,2.68,1.01),size*.26,size*.42,size*.26,'#805d55',7,2);
          m.blob(...pos(a,2.68,1.07),size*.19,size*.32,size*.19,'#ffd984',7,5);
          m.blob(...pos(a+.07,5.63,1.44),size*.19,size*.094,size*.17,'#f5c6b0',6,23);
        }
      }
    }
    turret(-1.35,.05,1.45,'#ae5572');turret(2.23,.97,.87,'#c27a87');turret(1.02,-2.37,.69,'#a1769c');
    for(let j=0;j<6;j++)petal(m,[-.4,.9,.25],j*tau/6,4.4,.69,1.3,'#77a574','#507957','#a8bc79');
  }
  function abbey(m){
    island(m,4.9,['#56404d','#654856'],['#362d42','#43364a','#53414a']);
    // A pointed, open lancet window with a caged ember suspended in its tracery.
    for(const side of [-1,1]){
      const x=side*2.45;
      m.box(x,.3,0,1.51,6.03,2.32,0,'#5f505c',23);
      for(let j=0;j<4;j++)m.box(x,1+j*1.39,0,1.59,.16,2.42,0,'#8d7777',23);
      for(const z of [-.69,.72]){
        let p=[x,5.85,z];
        for(const [xx,yy] of [[2.42,6.67],[2.12,7.52],[1.60,8.14],[.88,8.68],[.02,9.46]]){
          const q=[side*xx,yy,z];m.ring(p,q,.31,.32,z>0?'#968085':'#745d69',6,23);p=q;
        }
      }
      m.ring([x,6.26,0],[x,9.3,0],.59,.05,'#45384c',5,23);
      bone(m,[x+side*1.14,.44,.12],[x+side*.42,3.48,.12],.57,.36);
    }
    strut(m,[0,8.99,0],[0,5.51,0],.08,'#564153',7);
    for(const y of [3.96,5.20])m.ring([0,y-.13,0],[0,y+.15,0],.93,.82,'#a78775',8,7);
    for(let j=0;j<8;j++)strut(m,polar(0,3.99,0,.83,j*tau/8),polar(0,5.2,0,.81,j*tau/8),.073,'#685664',7);
    m.blob(0,4.50,0,.49,.79,.51,'#e89c80',8,5);
    m.ring([0,3.81,0],[0,2.94,0],.24,.018,'#a5837b',6,7);
  }
  function victoryStatue(m){
    island(m,5.8,['#c2b6a3','#ada79a','#cfc5af'],['#92898f','#777580','#999096']);
    for(const [y,w,h,col] of [[.8,5.7,.42,'#ad9b83'],[1.22,5.02,.33,'#dfcbb1'],[1.55,3.95,.32,'#ad8e64'],[1.87,3.65,1.6,'#d2c4aa'],[3.47,4.12,.26,'#e5d9bf']])m.box(0,y,0,w,h,w*.76,0,col,23);
    const bronze='#b39564',light='#cdb47d',dark='#867449';
    m.ring([0,3.74,0],[.12,6.65,.02],1.15,.74,bronze,12,7);
    for(let j=0;j<10;j++){
      const a=j*tau/10;strut(m,polar(0,3.83,0,1.14,a),polar(.12,6.61,.02,.73,a+.2),.071,light,7);
    }
    m.blob(.10,7.05,.06,.83,1.04,.54,bronze,12,7);
    m.ring([.10,7.73,.06],[.14,8.17,.07],.35,.32,light,9,7);
    m.blob(.13,8.58,.05,.47,.61,.42,bronze,10,7);m.blob(.11,8.62,.40,.16,.19,.15,light,7,7);
    for(const s of [-1,1]){
      const shoulder=[s*.65+.08,7.45,.12],elbow=[s*1.14,7.07,.55],hand=[s*1.41,7.73,.89];
      m.ring(shoulder,elbow,.25,.21,bronze,7,7);m.ring(elbow,hand,.23,.13,light,7,7);
      for(let j=0;j<8;j++){
        const t=j/7,base=[s*(.46+.58*t),7.41+.16*t,-.36-.11*t];
        const end=[s*(1.70+2.03*t),7.13+4.75*t-.28*t*t,-.63-.38*t];
        const mid=[(base[0]+end[0])/2,(base[1]+end[1])/2+.28,(base[2]+end[2])/2];
        const l=step(mid,s*.29,-.11,.03),r=step(mid,-s*.34,.13,0),ridge=step(mid,0,0,.18);
        m.tri(base,l,ridge,dark,7);m.tri(base,ridge,r,light,7);m.tri(l,end,ridge,bronze,7);m.tri(ridge,end,r,light,7);
      }
    }
  }
  const models=[[dreamHarp,dreamOrrery,cloudfall,lunarLoom],[foxglove,fairySpire,dewLily,mushroomHall],
    [ribs,eyeShrine,crag,abbey],[portico,brazier,sacredOlive,victoryStatue]];
  const sceneryRhythm=[
    [1,2,1,0,2,2,1,0,1,2],
    [0,1,0,1,2,2,0,2,1,1],
    [2,0,1,0,2,1,2,0,2,1],
    [1,0,1,2,1,2,1,0,1,2]
  ];
  const libraries=new WeakMap();
  function meshes(Mesh,index){
    let all=libraries.get(Mesh);
    if(!all){all=[];libraries.set(Mesh,all);}
    const realm=index-16;
    if(!all[realm])all[realm]=models[realm].map(build=>{const m=new Mesh();build(m);return m;});
    return all[realm];
  }
  function decorate(c,sim,rand,clear){
    const instances=[],realm=c.index-16;
    const radius=[[5.1,3.6],[3.8,4.1],[4.2,3.9],[6.7,2.9]][realm];
    // Place against both route centrelines, including stacked switchbacks and the fork.
    for(let i=0;i<50;i++){
      const p=sim.sample(c,c.length*(i+.32)/50,0),side=i%2?1:-1;
      const kind=sceneryRhythm[realm][i%10],landmark=i%10===3||i%10===7;
      const size=landmark?1.6+rand()*.45:.72+rand()*.48;
      const footprint=kind===2?[8,6,5,5][realm]:radius[kind];
      const offset=p.w+footprint*size+3.6+rand()*(landmark?11:7);
      const center=[p.x+p.nx*side*offset,p.y-.85-rand()*(landmark?1.4:3.2),p.z+p.nz*side*offset];
      if(clear(center,footprint*size+1.8))instances.push({center,kind,size,yaw:Math.atan2(-side*p.nx,-side*p.nz)+.28*(rand()-.5)});
    }
    // Larger masses occupy the second depth plane, well below and outside the road.
    const views=[.036,.254,.483,.689,.917];
    for(let i=0;i<views.length;i++){
      const p=sim.sample(c,c.length*views[i],0),size=1.22+(i%3)*.13;
      // Search both verges so the entrance is visible without clipping a second route.
      for(const side of [i%2?1:-1,i%2?-1:1]){
        const offset=side*(p.w+7.4*size+7);
        const center=[p.x+p.nx*offset,p.y-1.15,p.z+p.nz*offset];
        if(!clear(center,6.1*size)||instances.some(v=>Math.hypot(v.center[0]-center[0],v.center[2]-center[2])<6.3*size+v.size*3.6))continue;
        instances.push({center,kind:3,size,yaw:Math.atan2(-side*p.nx,-side*p.nz)});
        break;
      }
    }
    for(let i=0;i<15;i++){
      const p=sim.sample(c,c.length*(i+.78)/15,0),side=i%2?1:-1;
      const distance=side*(p.w+33+rand()*27),size=1.6+rand()*1.45;
      const center=[p.x+p.nx*distance,p.y-(realm===0?8:11)-rand()*8,p.z+p.nz*distance];
      if(clear(center,7.7*size))instances.push({center,kind:2,size,yaw:rand()*tau});
    }
    return instances;
  }
  // The flower courts rise above a folded green canopy. In the nightmare the
  // same distant depth plane opens into a red river between black scarps.
  function underworld(c){
    const fairy=c.index===17;
    if(!fairy&&c.index!==18)return [];
    const heights=c.points.map(p=>p.y),floor=Math.min(...heights)-(fairy?17:21);
    const xs=c.points.map(p=>p.x),zs=c.points.map(p=>p.z),step=25;
    const xmin=Math.floor((Math.min(...xs)-50)/step)*step,xmax=Math.max(...xs)+50;
    const zmin=Math.floor((Math.min(...zs)-50)/step)*step,zmax=Math.max(...zs)+50;
    const leaves=['#608673','#557b67','#6c926f','#709377','#61856d','#648d78'];
    const basalt=['#473244','#503345','#412e40','#513c50','#473548','#4f3447'];
    const seam=(x,z)=>Math.abs(x-z*.36-26*Math.sin(z*.025)-9*Math.sin(z*.068));
    const corner=(x,z)=>{
      const ribs=Math.sin(x*.031+z*.064)*.5+Math.cos(x*.057-z*.021)*.5;
      const y=fairy?4.3*ribs+1.45*Math.cos(z*.12):Math.min(1,seam(x,z)/24)*8-9+ribs*3.1;
      return [x,floor+y,z];
    };
    const faces=[];
    for(let x=xmin;x<xmax;x+=step)for(let z=zmin;z<zmax;z+=step){
      const a=corner(x,z),b=corner(x,z+step),d=corner(x+step,z+step),e=corner(x+step,z);
      for(const corners of [[a,b,d],[a,d,e]]){
        const cx=(corners[0][0]+corners[1][0]+corners[2][0])/3,cz=(corners[0][2]+corners[1][2]+corners[2][2])/3;
        const hue=Math.abs(Math.round(Math.sin(cx*.54+cz*1.1)*117))%6,river=!fairy&&seam(cx,cz)<10;
        faces.push({corners,color:river?'#aa5e64':(fairy?leaves:basalt)[hue],material:river?5:fairy?3:23,cx,cz});
      }
    }
    return faces;
  }
  function build(m,Mesh,scene){
    const library=meshes(Mesh,scene.index);
    for(const tile of scene.basin)m.tri(...tile.corners,tile.color,tile.material);
    for(const {center:[x,y,z],kind,size,yaw} of scene.mythic){
      const src=library[kind].data,co=Math.cos(yaw),si=Math.sin(yaw);
      for(let i=0;i<src.length;i+=10){
        m.data.push(x+size*(co*src[i]+si*src[i+2]),y+size*src[i+1],z+size*(-si*src[i]+co*src[i+2]),
          co*src[i+3]+si*src[i+5],src[i+4],-si*src[i+3]+co*src[i+5],src[i+6],src[i+7],src[i+8],src[i+9]);
      }
    }
  }
  // Rasterize the actual 3D silhouettes only on first use at a given viewing angle.
  const sprites=new WeakMap();
  function sprite(mesh,angle){
    const view=Math.round(angle*12/tau),id=(view%12+12)%12;
    let variants=sprites.get(mesh);
    if(!variants){variants=[];sprites.set(mesh,variants);}
    if(variants[id])return variants[id];
    const c=Math.cos(id*tau/12),s=Math.sin(id*tau/12),faces=[],d=mesh.data;
    let left=Infinity,right=-Infinity,low=Infinity,high=-Infinity;
    for(let i=0;i<d.length;i+=30){
      const points=[];let depth=0;
      for(let j=i;j<i+30;j+=10){
        const x=-d[j]*c+d[j+2]*s,z=d[j]*s+d[j+2]*c,y=-d[j+1]-.12*z;
        left=Math.min(left,x);right=Math.max(right,x);low=Math.min(low,y);high=Math.max(high,y);
        depth+=z;points.push([x,y]);
      }
      const light=d[i+9]===5?1:.78+.21*Math.max(0,-.43*d[i+3]+.83*d[i+4]-.34*d[i+5]);
      faces.push({points,depth,color:'rgb('+d.slice(i+6,i+9).map(k=>Math.round(255*Math.min(1,k*light))).join(',')+')'});
    }
    const canvas=document.createElement('canvas'),scale=185/Math.max(right-left,high-low);
    canvas.width=Math.ceil((right-left)*scale)+2;canvas.height=Math.ceil((high-low)*scale)+2;
    const ctx=canvas.getContext('2d');
    ctx.setTransform(scale,0,0,scale,1-left*scale,1-low*scale);
    faces.sort((a,b)=>b.depth-a.depth);
    for(const {points,color} of faces){
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);ctx.lineTo(...points[1]);ctx.lineTo(...points[2]);ctx.closePath();ctx.fill();
    }
    return variants[id]={canvas,left:left-1/scale,top:low-1/scale,width:canvas.width/scale,height:canvas.height/scale};
  }
  function paint(ctx,scene,project,heading,w){
    const items=[],library=meshes(root.AcornWorld.Mesh,scene.index);
    // The basin lies below the entire course, so its tiles can be filled before
    // roadside props. Limit projection work to land inside the camera frustum.
    for(const tile of scene.basin){
      const center=project(tile.cx,tile.corners[0][1],tile.cz);
      if(center.z< -12||center.z>165||center.x+center.k*32<0||center.x-center.k*32>w)continue;
      const points=tile.corners.map(p=>project(...p));
      if(points.some(p=>p.z<1))continue;
      ctx.fillStyle=tile.color;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
      ctx.lineTo(points[1].x,points[1].y);ctx.lineTo(points[2].x,points[2].y);ctx.closePath();ctx.fill();
    }
    for(const prop of scene.mythic){
      const p=project(...prop.center);
      if(p.z<3||p.z>165||p.x+p.k*prop.size*9<0||p.x-p.k*prop.size*9>w)continue;
      items.push({prop,p});
    }
    items.sort((a,b)=>b.p.z-a.p.z);
    for(const {prop,p} of items){
      const im=sprite(library[prop.kind],heading-prop.yaw),k=p.k*prop.size;
      ctx.drawImage(im.canvas,p.x+im.left*k,p.y+im.top*k,im.width*k,im.height*k);
    }
  }
  // The bitmap for each world was painted as a periodic physical material.
  // Both renderers place it in the same world coordinates on banked and forked lanes.
  const repeats=[12,10,8,9];
  function surfacePath(index){
    return index>=16&&index<=19?'art/road-'+index+'.webp':null;
  }
  const materials=`
    if(trackId>=16. && trackId<20. && mat>26.5 && mat<27.5){
      float repeatSize=trackId<16.5?12.:trackId<17.5?10.:trackId<18.5?8.:9.;
      vec2 st=wp.xz/repeatSize;
      vec4 paint=texture2D(mythosAlbedo,st);
      // Fade the relief before subpixel highlights can shimmer in a hairpin.
      float nearDetail=1.-smoothstep(18.,58.,depth);
      vec3 weights=vec3(.24,.61,.15);
      float relief=dot(paint.rgb,weights);
      vec2 slope=vec2(dot(texture2D(mythosAlbedo,st+vec2(.0039,0.)).rgb,weights)-relief,
                      dot(texture2D(mythosAlbedo,st+vec2(0.,.0039)).rgb,weights)-relief);
      norm=normalize(norm+vec3(-slope.x,0.,-slope.y)*nearDetail*2.8);
      tint=mix(col,paint.rgb,paint.a);
      vec3 viewDir=normalize(eye-wp),halfDir=normalize(viewDir+sun);
      float shine=max(0.,dot(norm,halfDir));
      light=.78+.27*max(0.,dot(norm,sun));
      if(trackId<16.5){
        float satin=pow(1.-abs(dot(norm,viewDir)),3.);
        float foil=smoothstep(.03,.21,tint.r-tint.b);
        tint+=vec3(.028,.014,.059)*satin;
        highlight+=nearDetail*(.018*satin+.13*foil*pow(shine,11.));
      }else if(trackId<17.5){
        float blade=smoothstep(.02,.23,tint.g-tint.r);
        float dapples=noise(wp.xz*.25+vec2(.02,-.014)*clock);
        light+=.12*(dapples-.48);highlight+=nearDetail*blade*pow(shine,23.)*.13;
      }else if(trackId<18.5){
        float ember=smoothstep(.12,.57,tint.r-tint.b);
        tint+=vec3(.14,.027,.006)*ember*(.79+.21*sin(clock*.84+wp.x*.19+wp.z*.26));
        highlight+=nearDetail*.12*pow(shine,35.);
      }else{
        float joint=smoothstep(.30,.68,relief);
        highlight+=nearDetail*joint*(.13*pow(shine,36.)+.024*(1.-viewDir.y));
      }
    }else if(trackId>=16. && trackId<20. && mat>28.5 && mat<29.5){
      // The outside apron uses different ground: lunar pebbles, moss, shale, or cut limestone.
      vec2 cell=trackId<16.5?vec2(1.,0.):trackId<17.5?vec2(2.,2.):trackId<18.5?vec2(3.,3.):vec2(2.,3.);
      vec2 repeated=abs(fract(wp.xz/7.)*2.-1.)*.99+.005;
      vec3 stone=texture2D(groundAtlas,(cell+repeated)*.25).rgb;
      vec3 base=trackId<16.5?vec3(.52,.53,.68):trackId<17.5?vec3(.35,.49,.29):trackId<18.5?vec3(.35,.26,.33):vec3(.64,.57,.47);
      float raised=dot(stone,vec3(.25,.55,.20));
      tint=base*clamp(.34+raised*1.38,.42,1.4)+stone*.09;
      light=.76+.29*max(0.,dot(norm,sun));
    }`;
  const maps=new WeakMap();
  function mappedSurface(ctx,index){
    if(!ctx?.createPattern||typeof DOMMatrix==='undefined')return null;
    let materials=maps.get(ctx);
    if(!materials){materials=[];maps.set(ctx,materials);}
    const realm=index-16;
    if(!materials[realm]){
      const image=new Image(),file=surfacePath(index)||root.AcornDarkWorld?.surfacePath?.(index);
      if(!file)return null;
      const material={image,matrix:new DOMMatrix(),pattern:null};
      materials[realm]=material;
      image.onload=()=>{material.pattern=ctx.createPattern(image,'repeat');};
      image.src=root.AcornFileTextures?.[file]||file;
    }
    return materials[realm].pattern?materials[realm]:null;
  }
  // Map three world vertices to their projected positions. A separate mapping on
  // each near triangle keeps the material attached as the road turns under the kart.
  function textureFace(material,repeat,world,screen){
    const [w0,w1,w2]=world,[p0,p1,p2]=screen;
    const x1=w1[0]-w0[0],z1=w1[1]-w0[1],x2=w2[0]-w0[0],z2=w2[1]-w0[1];
    const inv=1/(x1*z2-z1*x2);
    if(!Number.isFinite(inv)||Math.abs(inv)>1e4)return;
    const ax=((p1.x-p0.x)*z2-(p2.x-p0.x)*z1)*inv;
    const az=((p2.x-p0.x)*x1-(p1.x-p0.x)*x2)*inv;
    const bx=((p1.y-p0.y)*z2-(p2.y-p0.y)*z1)*inv;
    const bz=((p2.y-p0.y)*x1-(p1.y-p0.y)*x2)*inv;
    const m=material.matrix,k=repeat/material.image.width;
    m.a=ax*k;m.c=az*k;m.b=bx*k;m.d=bz*k;
    m.e=p0.x-w0[0]*ax-w0[1]*az;m.f=p0.y-w0[0]*bx-w0[1]*bz;
    material.pattern.setTransform(m);
  }
  const shoulders=new WeakMap();
  const shoulderTint=['#9b9cbf','#799669','#796075','#c9b59a'];
  function shoulderMaterial(ctx,index){
    if(!ctx?.createPattern||typeof DOMMatrix==='undefined')return null;
    let state=shoulders.get(ctx);
    if(!state){
      const image=new Image();state={image,tiles:[]};shoulders.set(ctx,state);
      const path='art/trail-materials.webp';image.src=root.AcornFileTextures?.[path]||path;
    }
    const realm=index-16;
    if(!state.tiles[realm]&&state.image.naturalWidth){
      const source=state.image,canvas=document.createElement('canvas');
      const [u,v]=[[1,0],[2,2],[3,3],[2,3]][realm];
      const side=source.naturalWidth/4;canvas.width=512;canvas.height=512;
      const painter=canvas.getContext('2d');
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        const dx=col?1:-1,dy=row?1:-1;
        painter.setTransform(dx,0,0,dy,256,256);
        painter.drawImage(source,u*side+1,v*side+1,side-2,side-2,0,0,256,256);
      }
      painter.setTransform(1,0,0,1,0,0);painter.globalCompositeOperation='color';
      painter.fillStyle=shoulderTint[realm];painter.fillRect(0,0,512,512);
      painter.globalCompositeOperation='source-over';painter.globalAlpha=.34;painter.fillRect(0,0,512,512);
      state.tiles[realm]={image:canvas,pattern:ctx.createPattern(canvas,'repeat'),matrix:new DOMMatrix()};
    }
    return state.tiles[realm];
  }
  function fillMapped(material,repeat,world,pts,quad){
    textureFace(material,repeat,world,pts);
    quad(...pts,material.pattern);
    if(pts[0].z<38){
      textureFace(material,repeat,[world[0],world[2],world[3]],[pts[0],pts[2],pts[3]]);
      quad(pts[0],pts[2],pts[3],pts[3],material.pattern);
    }
  }
  function paintSurface(ctx,index,a,b,pts,quad,repeat){
    const material=mappedSurface(ctx,index);
    if(!material||pts[0].z<=0||pts[1].z<=0)return false;
    const xz=(road,side)=>[road.x+side*road.w*road.nx,road.z+side*road.w*road.nz];
    const world=[xz(a,-1),xz(b,-1),xz(b,1),xz(a,1)];
    fillMapped(material,repeat,world,pts,quad);
    return true;
  }
  function paintRoad(c,from,to,branch,split,P,quad,ctx){
    const realm=c.index-16,pal=palettes[realm],sim=root.AcornSim;
    for(const [s,e] of root.AcornRamps.solidSpans(c,from,to,branch)){
      const a=sim.sample(c,s,0,branch),b=sim.sample(c,e,0,branch);
      const R=(at,lane,y=0)=>P(at,lane,y,branch);
      const strip=(a1,a2,b1,b2,col)=>quad(R(s,a1),R(e,b1),R(e,b2),R(s,a2),col);
      const tile=Math.floor((((s+e)*.5%c.length+c.length)%c.length)/2.75);
      const pts=[R(s,-a.w),R(e,-b.w),R(e,b.w),R(s,a.w)];
      if(!a.exposed){
        const apron=shoulderMaterial(ctx,c.index);
        for(const side of [-1,1]){
          if(split&&side===(branch?-1:1))continue;
          const aw=a.w*side,bw=b.w*side,outer=side*4.4;
          const edge=[R(s,aw,-.05),R(e,bw,-.05),R(e,bw+outer,-.10),R(s,aw+outer,-.10)];
          if(apron?.pattern&&edge[0].z>0&&edge[1].z>0){
            const v=(road,d)=>[road.x+road.nx*d,road.z+road.nz*d];
            fillMapped(apron,7,[v(a,aw),v(b,bw),v(b,bw+outer),v(a,aw+outer)],edge,quad);
          }else quad(...edge,pal.edge);
        }
      }
      if(!paintSurface(ctx,c.index,a,b,pts,quad,repeats[realm]))quad(...pts,pal.soil);
      for(const side of [-1,1]){
        const aw=a.w*side,bw=b.w*side;
        if(split&&side===(branch?-1:1)){
          const alt=sim.sample(c,s,0,!branch);
          if(Math.hypot(alt.x-a.x,alt.z-a.z)<a.w+alt.w)continue;
        }
        quad(R(s,aw),R(e,bw),R(e,bw,-.72),R(s,aw,-.72),pal.edge);
        strip(aw-side*.25,aw,bw-side*.25,bw,tile%6<5?pal.accent:pal.wood);
        const gutter=['#686693','#496e52','#493842','#947c5a'][realm];
        strip(aw-side*.57,aw-side*.43,bw-side*.57,bw-side*.43,gutter);
      }
    }
  }
  const vergeColors=[['#514f81','#d8c38e'],['#416b4e','#a4bc79'],['#4d3545','#a77167'],['#89734e','#e2c187']];
  function verge(strip,side,aw,bw,base,j,index){
    const [ground,inlay]=vergeColors[index-16];
    const band=(u,v,w,z,col,height)=>strip(aw-side*u,aw-side*v,bw-side*w,bw-side*z,base+height,col,0);
    band(.65,.31,.65,.31,ground,.017);
    if(index===19){
      // A running Greek key with a return leg inside each squared hook.
      const step=j%8;
      if(step===1||step===5)band(.62,.34,.62,.34,inlay,.025);
      else{const line=step<5?.61:.39;band(line,line-.055,line,line-.055,inlay,.025);}
      if(step>=2&&step<=4)band(.465,.418,.465,.418,inlay,.025);
    }else if(index===18){
      if(j%4===0)band(.61,.35,.56,.40,inlay,.025);
    }else{
      const edge=n=>.485+.096*Math.sin(n*(index===16?.91:.62));
      band(edge(j)+.036,edge(j)-.036,edge(j+1)+.036,edge(j+1)-.036,inlay,.025);
    }
  }
  root.AcornMythicWorld={palettes,materials,surfacePath,paintSurface,sprite,verge,decorate,underworld,build,paint,paintRoad};
})(typeof globalThis==='object'?globalThis:this);

