(function (root) {
  'use strict';

  const tau = Math.PI * 2;
  const spectrum = ['#f3748c', '#ed996c', '#eacc73', '#7cdba7', '#69cbe6', '#829bf0', '#bc86e4'];
  const palettes = [
    {sky:'#172237',mist:'#394358',soil:'#726c80',edge:'#4c5868',land:'#2b354a',wood:'#664d43',accent:'#81f5de',leaf:['#706ca5','#5db2ba','#a68ad4'],water:'#234e5c'},
    {sky:'#76b4da',mist:'#d8e4e6',soil:'#b3764f',edge:'#6e4a38',land:'#b9d5df',wood:'#695044',accent:'#ffe3a0',leaf:['#a8bd8d','#8eab91','#b7c9a0'],water:'#aecad4'},
    {sky:'#11162f',mist:'#35324e',soil:'#667083',edge:'#444761',land:'#161d36',wood:'#333b58',accent:'#81f0f1',leaf:['#7182ae','#a78acd','#52688a'],water:'#33304f'},
    {sky:'#803f4c',mist:'#85514d',soil:'#665452',edge:'#463c43',land:'#352d38',wood:'#493a3e',accent:'#ffc06c',leaf:['#83524b','#a45d48','#4e4149'],water:'#e2773e'},
    {sky:'#222545',mist:'#494366',soil:'#6e76a4',edge:'#46445f',land:'#332d50',wood:'#514764',accent:'#ffdfac',leaf:['#88b6cb','#bd95d3','#dcae99'],water:'#635889'},
    {sky:'#4b92ac',mist:'#8db7ac',soil:'#936851',edge:'#62605a',land:'#476660',wood:'#775744',accent:'#f6cf91',leaf:['#53754b','#819761','#577e6f'],water:'#346f75'},
    {sky:'#171b43',mist:'#3c3b52',soil:'#5f4b4d',edge:'#58453d',land:'#493a35',wood:'#665050',accent:'#8ceadf',leaf:['#486b74','#395164','#6764a1'],water:'#3d4e46'},
    {sky:'#303e61',mist:'#637282',soil:'#715c56',edge:'#614b40',land:'#334949',wood:'#60483c',accent:'#f8c78b',leaf:['#446966','#556776','#34575b'],water:'#526a79'}
  ].concat(root.AcornMythicWorld?.palettes||[]);
  const roadMaterial = 20, lavaMaterial = 21, prismMaterial = 22, rockMaterial = 23;
  const peatMaterial = 24, spillwaterMaterial = 25, marshWaterMaterial = 26;
  const up = [0, 1, 0];
  const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);
  const move = (a, dx, dy, dz) => [a[0]+dx,a[1]+dy,a[2]+dz];
  const local = (p, side=0, height=0, ahead=0) => [p.x+p.nx*side+p.tx*ahead,p.y+height,p.z+p.nz*side+p.tz*ahead];
  const yaw = p => Math.atan2(p.tx,p.tz);
  const unit = x => Math.max(0,Math.min(1,x));
  const forestFloor = (x,z) => -28+3.7*Math.sin(x*.046+z*.021)+2.5*Math.cos(z*.062)+1.9*Math.cos(x*.073-z*.039);

  function timberDeck(index,u,branch){
    return index===9||index===14||index===15||(index===13&&(branch||u>.185&&u<.32||u>.755&&u<.91));
  }

  function diamond(m, at, radius, height, lean, colors, angle=0) {
    const sides=5, tip=move(at,lean,height,0);
    const point=(i, size, level)=>move(at,lean*level+Math.cos(angle+i*tau/sides)*radius*size,height*level,Math.sin(angle+i*tau/sides)*radius*size);
    for(let i=0;i<sides;i++){
      const low=point(i,.65,0), next=point(i+1,.65,0), high=point(i,1,.64), end=point(i+1,1,.64);
      m.quad(low,next,end,high,colors[i%colors.length],prismMaterial);
      m.tri(high,end,tip,colors[(i+1)%colors.length],prismMaterial);
    }
  }

  function arch(m,p,width,height,colors,thickness,material=0,steps=9){
    const rim=(t,delta)=>local(p,(width+delta)*Math.cos(t*Math.PI),-.45+(height+delta)*Math.sin(t*Math.PI));
    for(let i=0;i<steps;i++){
      const t=i/steps,u=(i+1)/steps;
      m.quad(rim(t,0),rim(u,0),rim(u,thickness),rim(t,thickness),colors[i%colors.length],material);
      const a=rim(t,0),b=rim(u,0),c=rim(t,thickness),d=rim(u,thickness);
      const back=q=>move(q,p.tx*thickness,0,p.tz*thickness);
      m.quad(a,b,back(b),back(a),colors[(i+1)%colors.length],material);
      m.quad(c,d,back(d),back(c),colors[i%colors.length],material);
      m.quad(back(a),back(b),back(d),back(c),colors[i%colors.length],material);
    }
  }

  function roadSegment(m,a,b,index,palette,j,branch=false,otherA=null,otherB=null){
    const exposed=!!a.exposed;
    // Both endpoints use their own width so a narrowing deck has no cracks.
    const cut=(p,main)=>{
      if(!branch||!main)return -p.w;
      const offset=(p.x-main.x)*main.nx+(p.z-main.z)*main.nz;
      const cosine=Math.max(.25,p.nx*main.nx+p.nz*main.nz);
      return Math.max(-p.w,Math.min(p.w,(main.w-offset)/cosine));
    };
    const leftA=cut(a,otherA),leftB=cut(b,otherB);
    const strip=(l1,r1,l2,r2,dy,color,mat)=>{
      l1=Math.max(leftA,l1);r1=Math.max(leftA,r1);l2=Math.max(leftB,l2);r2=Math.max(leftB,r2);
      if(l1!==r1||l2!==r2)m.quad(local(a,l1,dy),local(b,l2,dy),local(b,r2,dy),local(a,r1,dy),color,mat,up);
    };
    const base=branch?.048:0;
    if(index===12){
      for(let k=0;k<7;k++){
        const start=k*2/7-1,end=(k+1)*2/7-1;
        strip(start*a.w,end*a.w,start*b.w,end*b.w,base,spectrum[k],roadMaterial);
      }
    }else{
      const planks=timberDeck(index,a.u,branch);
      const color=index===9?['#b07e59','#bc8c65','#b48a67','#ad7c58'][j%4]:index===13&&planks?'#9d7655':palette.soil;
      strip(-a.w,a.w,-b.w,b.w,base,color,index>=16?27:planks?2:roadMaterial);
    }
    for(const side of [-1,1]){
      const aw=a.w*side,bw=b.w*side;
      const cap=index===9?'#e9c789':index===11?'#d89365':palette.accent;
      const insideFork=otherA&&side===(branch?-1:1);
      const sharedEdge=insideFork&&Math.hypot(a.x-otherA.x,a.z-otherA.z)<a.w+otherA.w;
      if(!sharedEdge){
        strip(aw-side*.24,aw,bw-side*.24,bw,base+.014,j%8<6?cap:palette.edge,5);
        const fascia=index===14||index===15||index===13&&timberDeck(index,a.u,branch);
        m.quad(local(a,aw,base),local(b,bw,base),local(b,bw,base-.7),local(a,aw,base-.7),palette.edge,fascia?2:0);
        if(index===19){
          // A continuous gold fillet with alternating keyed blocks at the edge.
          strip(aw-side*.72,aw-side*.65,bw-side*.72,bw-side*.65,base+.018,'#a78346',5);
          if(j%4===1)strip(aw-side*.68,aw-side*.26,bw-side*.68,bw-side*.26,base+.024,'#bd9b64',5);
        }
      }
      // Each fork owns its outside shoulder. An inside apron from the higher
      // route would otherwise span the lower road as the two lanes rejoin.
      if(!exposed&&!insideFork){
        const extension=index===8||index===11?8:4.4;
        const slope=index===8||index===11?-.27:-.10;
        const outerA=local(a,aw+side*extension,slope),outerB=local(b,bw+side*extension,slope);
        const shoulder=index===15?2:index===14?peatMaterial:index===11||index===8?rockMaterial:0;
        m.quad(local(a,aw,-.05),local(b,bw,-.05),outerB,outerA,palette.edge,shoulder,up);
        if(index===14){
          const toe=(p,width)=>{
            const foot=local(p,width+side*(extension+2.9+1.1*Math.sin(p.u*tau*9)));
            foot[1]=.97;return foot;
          };
          m.quad(outerA,outerB,toe(b,bw),toe(a,aw),palette.land,peatMaterial);
        }
        if(index===15){
          m.quad(outerA,outerB,move(outerB,0,-.64,0),move(outerA,0,-.64,0),palette.wood,2);
          if(j%4===0){
            const clip=local(a,aw+side*(extension-.28),-.08);
            m.box(...clip,.21,.05,.16,yaw(a),'#9e8870',5);
          }
        }
        if(index===8||index===11){
          const apron=(p,width)=>{
            const toe=local(p,width+side*(extension+3.2+1.8*Math.sin(p.u*tau*19)));
            toe[1]=index===11?-4.2:-5.3;return toe;
          };
          m.quad(outerA,outerB,apron(b,bw),apron(a,aw),palette.land,rockMaterial);
        }
      }
      if(index===10&&j%12<7)strip(aw-side*.82,aw-side*.74,bw-side*.82,bw-side*.74,base+.022,'#a3cfd1',5);
      if(index===8&&branch)strip(aw*.49,aw*.49+side*.09,bw*.49,bw*.49+side*.09,base+.027,'#9badb2',5);
    }
    if(index===10){
      for(const side of [-1,1]){
        strip(side*a.w*.71,side*(a.w*.71+.045),side*b.w*.71,side*(b.w*.71+.045),base+.011,'#48526a',0);
        if(j%10===2){
          const x=side*a.w*.89,lamp=local(a,x,base+.027);
          m.quad(lamp,local(a,x+side*.21,base+.027),local(a,x+side*.21,base+.027,.38),local(a,x,base+.027,.38),'#efc687',5,up);
        }
      }
    }
    if(index===17&&j%3===1){
      // Cross veins follow the actual leaf ribbon through turns and both forks.
      for(const side of [-1,1]){
        strip(side*.17,side*.08,side*b.w*.80,side*(b.w*.80+.09),base+.018,'#8baf7e',0);
      }
    }
    if(index===16&&j%8===2){
      const x=.71*a.w*(j%16<8?-1:1);
      if(x>leftA+.35){
        m.quad(local(a,x-.24,base+.021),local(a,x,base+.021,.50),local(a,x+.24,base+.021),local(a,x,base+.021,-.50),'#e3d5be',5,up);
      }
    }
    if(j%5===0&&(index===9||index===10)){
      const L=local(a,leftA,base+.009),R=local(a,a.w,base+.009);
      m.quad(L,R,move(R,a.tx*.076,0,a.tz*.076),move(L,a.tx*.076,0,a.tz*.076),index===9?'#795941':'#41485e');
    }
  }

  function grid(m,at,index,pal){
    const q=at(0);
    for(let row=0;row<2;row++){
      const a=at(row*.56),b=at((row+1)*.56);
      for(let j=0;j<16;j++){
        const left=(j/8-1)*q.w,right=((j+1)/8-1)*q.w;
        m.quad(local(a,left,.078),local(b,left,.078),local(b,right,.078),local(a,right,.078),(j+row)%2?'#38364a':'#f7e9cc',0,up);
      }
    }
    arch(m,at(2.1),q.w+1.2,6.9,index===12?spectrum:[pal.edge,pal.edge,pal.accent,pal.wood],.53,0,13);
    for(const side of [-1,1]){
      const pos=local(q,side*(q.w+.93),.2,-.6);
      m.ring(pos,move(pos,0,2.95,0),.25,.16,pal.wood,7);
      for(let i=0;i<3;i++)m.blob(...move(pos,0,1.35+i*.52,0),.20,.19,.20,i===2?pal.accent:'#ecc37c',6,5);
    }
  }

  function turnBoards(m,c,at,pal){
    const spacing=21;
    let last=-100;
    for(let s=12;s<c.length-14;s+=4){
      const a=at(s),b=at(s+6);
      if(s-last<spacing||Math.abs(b.curve)<.024)continue;
      const side=-Math.sign(b.curve),x=side*(a.w+.75);
      if(a.u>c.branchA-.02&&a.u<c.branchB+.02&&side>0)continue;
      const prop=local(a,x,-.39);
      m.ring(prop,move(prop,0,1.53,0),.1,.082,pal.wood,5);
      const left=local(a,x-.79,.58),right=local(a,x+.79,.58);
      m.quad(left,right,move(right,0,.83,0),move(left,0,.83,0),'#282a39',0);
      for(const offset of [-.32,.29]){
        const P=(xx,y)=>local(a,x+offset+xx*Math.sign(b.curve),y,-.024);
        m.quad(P(-.22,.65),P(.01,.65),P(.31,1),P(.07,1),pal.accent,5);
        m.quad(P(.07,1),P(.31,1),P(.01,1.34),P(-.22,1.34),pal.accent,5);
      }
      last=s;
    }
  }

  function tunnel(m,at,start,end,width,height,colors,step=6){
    const nodes=[];
    for(let s=start;s<end+step;s+=step){
      const p=at(Math.min(s,end)),ring=[];
      for(let k=0;k<=8;k++){
        const a=k*Math.PI/8,ripple=1+.055*Math.sin(s*.24+k*4.9)+.044*Math.cos(k*9.2+s*.094);
        ring.push(local(p,Math.cos(a)*width*ripple,(Math.sin(a)*height-1.5)*ripple));
      }
      nodes.push(ring);if(s>=end)break;
    }
    for(let j=0;j<nodes.length-1;j++)for(let i=0;i<8;i++){
      const a=nodes[j][i],b=nodes[j+1][i],c=nodes[j+1][i+1],d=nodes[j][i+1];
      m.tri(a,b,c,colors[(i+j)%colors.length],rockMaterial);m.tri(a,c,d,colors[(i+j+1)%colors.length],rockMaterial);
    }
  }

  function crystalBunch(m,p,side,offset,scale,rand){
    const colors=['#527f9f','#62d3c6','#a3f2db','#7974b3','#aea4df'];
    for(let k=0;k<5;k++){
      const at=local(p,side*(p.w+offset+k*.39*scale),-.38,(k%3-1)*1.05*scale);
      diamond(m,at,scale*(.19+rand()*.34),scale*(.95+rand()*1.47),side*(k-2)*.27*scale,colors.slice(k%3),k*1.25);
    }
  }

  function cave({m,c,at,rand,clear}){
    const length=c.length;
    tunnel(m,at,length*.065,length*.277,10.1,9.8,['#35394d','#404253','#3b4057','#4c4960']);
    tunnel(m,at,length*.721,length*.878,9.4,13.6,['#323747','#363d50','#393650','#453b5a']);
    for(let j=0;j<55;j++){
      const u=(j+.5)/55,p=at(u*length),side=j%2?1:-1,offset=1.9+rand()*3.7;
      if(!clear(local(p,side*(p.w+offset)),1.5))continue;
      crystalBunch(m,p,side,offset,u>.28&&u<.51?2.35:1.25,rand);
      if(u>.075&&u<.27||u>.73&&u<.87){
        const high=local(p,side*4.8,u<.27?7.8:11.2);
        m.ring(high,move(high,.24,-2.2-rand()*1.8,0),.77,.025,'#536474',6,rockMaterial);
        m.blob(...move(high,.22,-2.1,0),.13,.20,.13,'#a8ffdf',5,5);
      }
    }
    // The twin-door mining gallery is a landmark and a scale cue for the geodes.
    for(const u of [.017,.043,.517,.54,.57,.60,.63,.665,.951]){
      const branch=u>.52&&u<.68,p=at(length*u,branch);
      if(branch){
        const main=at(length*u);
        if(Math.hypot(main.x-p.x,main.z-p.z)<main.w+p.w+3)continue;
      }
      const width=p.w+1.35;
      for(const sign of [-1,1]){
        const base=local(p,sign*width,-.45),top=local(p,sign*(width-.55),5.2);
        m.ring(base,top,.35,.26,'#77594c',7,2);
        m.ring(local(p,sign*(width-.17),3.65),local(p,sign*(width-1.89),5.0),.22,.20,'#87624c',6,2);
        m.ring(local(p,sign*(width-.42),4.86),local(p,sign*(width-.45),5.11),.32,.32,'#a6a29e',6);
        const lamp=local(p,sign*(width-1.63),4.6);
        m.ring(lamp,move(lamp,0,-.5,0),.045,.045,'#4a4852',5);
        m.blob(...move(lamp,0,-.61,0),.21,.32,.21,'#ffd388',6,5);
      }
      m.ring(local(p,-width-.25,5.11),local(p,width+.25,5.11),.36,.31,'#7d5947',7,2);
    }
    for(const [u,side] of [[.31,-1],[.345,1],[.42,-1],[.475,1]]){
      const p=at(u*length),atRock=local(p,side*(p.w+8),-2);
      if(!clear(atRock,4))continue;
      m.blob(...atRock,5,3,5,'#41435a',8,rockMaterial);
      crystalBunch(m,p,side,8,4.4,rand);
    }
  }

  function bridgeTowers(m,at,u1,u2,length){
    const steps=16;
    for(const side of [-1,1]){
      let prev;
      for(let i=0;i<=steps;i++){
        const t=i/steps,p=at(length*(u1+(u2-u1)*t)),h=2.2+7.4*(2*t-1)**2,x=side*(p.w+.75);
        const cable=local(p,x,h);
        if(prev)m.ring(prev,cable,.077,.077,'#695b52',5);
        if(i%2===0&&i>0&&i<steps)m.ring(local(p,x,-.52),cable,.04,.04,'#8d806b',4);
        if(i===0||i===steps){
          m.ring(local(p,x+side*.87,-3),local(p,x,h+.24),.46,.28,'#906b48',7,2);
          m.ring(local(p,x,h-.64),local(p,x,h-.29),.41,.39,'#e5bc74',7,5);
          diamond(m,local(p,x,h+.15),.32,1,0,['#bc9566','#ffdd95','#bc8d55']);
        }
        prev=cable;
      }
    }
    for(const u of [u1,u2]){
      const p=at(length*u);
      m.ring(local(p,-p.w-.8,7.6),local(p,p.w+.8,7.6),.23,.23,'#947048',6,2);
      for(const side of [-1,1])m.ring(local(p,side*(p.w+.9),5.9),local(p,side*(p.w-.9),7.65),.17,.17,'#b78650',6);
    }
  }

  function balloon(m,at,size,colors){
    const rows=[[-.9,.28],[-.57,.76],[.06,1],[.65,.79],[.98,.12]];
    const vertex=(q,a)=>move(at,size*rows[q][1]*Math.cos(a),size*rows[q][0]*1.29,size*rows[q][1]*Math.sin(a));
    for(let i=0;i<12;i++){
      const a=tau*i/12,b=tau*(i+1)/12;
      for(let j=0;j<4;j++)m.quad(vertex(j,a),vertex(j,b),vertex(j+1,b),vertex(j+1,a),colors[i%colors.length]);
      if(i%3===0)m.ring(vertex(0,a),move(at,Math.cos(a)*size*.16,-size*1.61,Math.sin(a)*size*.16),.039,.039,'#675444',4);
    }
    const base=move(at,0,-size*1.85,0);
    m.ring(base,move(base,0,size*.27,0),size*.21,size*.25,'#906a43',8,2);
  }

  function sky({m,c,at,rand,clear}){
    bridgeTowers(m,at,.105,.211,c.length);bridgeTowers(m,at,.352,.444,c.length);bridgeTowers(m,at,.876,.957,c.length);
    for(let j=0;j<75;j++){
      const p=at(c.length*j/75),b=at(c.length*(j+.9)/75);
      if(j%2===0){
        m.ring(local(p,-p.w+.1,-.64),local(p,p.w-.1,-.64),.22,.22,'#73543e',5,2);
        for(const side of [-1,1])m.ring(local(p,side*p.w,-.7),local(b,side*(b.w-.12),-1.64),.14,.14,'#946849',5,2);
      }
      if(j%5===0){
        const side=j%2?1:-1;
        const tip=local(p,side*(p.w+.4),1.66);
        m.ring(local(p,side*(p.w+.4),-.4),tip,.075,.061,'#80553c',5);
        m.tri(tip,move(tip,0,-.58,0),move(tip,p.tx*1.32+side*.28,-.15,p.tz*1.32),j%3?'#e87154':'#eacc72',5);
      }
    }
    for(let j=0;j<22;j++){
      const p=at(c.length*(j+.39)/22),side=j%2?1:-1,pt=local(p,side*(19+rand()*33));
      pt[1]=2+rand()*7;
      const r=4+rand()*7;
      m.blob(...pt,r,r*.26,r*.72,'#dfebea',8);
      m.blob(...move(pt,r*.33,r*.15,r*.1),r*.53,r*.29,r*.47,'#f5f2e6',7);
    }
    for(const [u,side] of [[.19,-1],[.52,1],[.77,-1]]){
      const p=at(c.length*u),point=local(p,side*32,6);
      if(clear(point,7))balloon(m,point,4.4,u>.7?['#487c87','#f3ce88','#688e95']:['#d88b68','#eee0b0','#c97353']);
    }
  }

  function ringBand(m,p,center,radius,tilt,col,thickness,segments=24){
    const ring=(angle,r)=>local(p,center[0]+Math.cos(angle)*r,center[1]+r*Math.sin(angle)*Math.sin(tilt),center[2]+r*Math.sin(angle)*Math.cos(tilt));
    for(let j=0;j<segments;j++){
      const a=tau*j/segments,b=tau*(j+1)/segments;
      m.quad(ring(a,radius),ring(b,radius),ring(b,radius+thickness),ring(a,radius+thickness),col,5);
    }
  }

  function satellite(m,p,side,rand){
    const body=local(p,side*23,6+rand()*2);
    m.blob(...body,1.17,1.41,1,'#c4b298',8);
    for(const sign of [-1,1]){
      const x=side*23+sign*3.1,y=body[1]-p.y;
      const at=local(p,x,y);
      m.ring(body,at,.13,.13,'#cfa971',6);
      for(let j=-1;j<=1;j++)for(const k of [-1,1]){
        const tile=local(p,x+j*.91,y,k*.57);
        m.box(...tile,.84,.13,1.05,yaw(p),'#536aa1');
        const mark=move(tile,0,.14,0);m.box(...mark,.046,.026,.94,yaw(p),'#afc2d8',5);
      }
    }
    m.ring(move(body,0,1.0,0),move(body,.5,2.7,0),.09,.048,'#e3c48e',5);
  }

  function space({m,c,at,rand,clear}){
    for(const u of [.12,.156,.191,.233,.272]){
      const p=at(c.length*u);
      arch(m,p,p.w+1.75,7.9,['#616783','#64718d','#9ce2df','#78819b','#575e81'],.52);
      for(const side of [-1,1]){
        m.ring(local(p,side*(p.w+1.83),-.9),local(p,side*(p.w+1.82),1.3),.5,.43,'#4e536c',8);
        m.blob(...local(p,side*(p.w+1.82),1.46),.22,.28,.22,'#94fff1',6,5);
      }
    }
    for(let j=0;j<28;j++){
      const p=at(c.length*(j+.29)/28),side=j%2?1:-1;
      const atRock=local(p,side*(25+rand()*32),rand()*23-11);
      const size=1.3+rand()*4;
      if(clear(atRock,size+1))m.blob(...atRock,size,size*.72,size*.80,j%2?'#736a78':'#5c627d',7,rockMaterial);
      if(j%5===2&&clear(local(p,side*23,6),6))satellite(m,p,side,rand);
    }
    const p=at(.855*c.length);
    for(const side of [-1,1]){
      const x=side*24,base=local(p,x,-1);
      if(!clear(base,9))continue;
      m.ring(move(base,0,-9,0),move(base,0,2,0),3.6,4.2,'#525b75',10);
      m.ring(move(base,0,2,0),move(base,0,3.4,0),4.3,3.7,'#a5b3bd',10);
      m.blob(...move(base,0,3.2,0),3.8,2.7,3.8,'#7895a9',12);
      m.ring(local(p,x,4,0),local(p,x+side*3.3,8.8,.7),1.09,1.25,'#a4aabd',10);
      m.ring(local(p,x+side*3.3,8.8,.7),local(p,x+side*3.57,9.13,.77),1.4,1.4,'#8ae5e3',10,5);
    }
    const orbit=at(.69*c.length),side=clear(local(orbit,-36,12),13)?-1:1;
    const globe=local(orbit,side*36,12);
    if(clear(globe,12)){
      m.blob(...globe,5.7,5.5,5.7,'#b18ea9',14);
      ringBand(m,orbit,[side*36,12,0],7.7,.38,'#d7bc9e',.93);
      ringBand(m,orbit,[side*36,12,0],9.1,.38,'#aaa2bb',.35);
    }
  }

  function volcanoCone(m,center,radius,height,rand){
    const rings=[],n=18;
    for(let level=0;level<4;level++){
      const q=[],scale=[1,.77,.49,.25][level];
      for(let i=0;i<n;i++){
        const ang=tau*i/n,dist=radius*scale*(.94+.11*rand());
        q.push(move(center,Math.cos(ang)*dist,height*[0,.24,.61,.91][level]+rand()*height*.08,Math.sin(ang)*dist));
      }rings.push(q);
    }
    const stone=['#55404a','#64444a','#493946','#70474a','#765049','#4d3a43'];
    for(let j=0;j<3;j++)for(let i=0;i<n;i++){
      const k=(i+1)%n;
      m.quad(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i],stone[(i+j)%stone.length],rockMaterial);
      if(i%4===1){
        const edge=(row,t)=>move(mix(row[i],row[k],t),0,.08,0);
        m.quad(edge(rings[j],.38),edge(rings[j],.62),edge(rings[j+1],.66),edge(rings[j+1],.40),'#ff8542',lavaMaterial);
      }
    }
    const middle=move(center,0,height*.88,0);
    for(let i=0;i<n;i++)m.tri(rings[3][i],rings[3][(i+1)%n],middle,'#f49a4c',lavaMaterial);
  }

  function volcano({m,c,at,rand,clear}){
    const pal=palettes[3],extent=Math.max(...c.points.map(q=>Math.max(Math.abs(q.x),Math.abs(q.z))))+140;
    m.quad([-extent,-4,-extent],[-extent,-4,extent],[extent,-4,extent],[extent,-4,-extent],pal.water,lavaMaterial,up);
    // Choose a broad pocket inside the loop. Its lava fissures can be seen on both the climb and descent.
    let best=[0,-5,0],room=0;
    for(let j=0;j<52;j++){
      const p=at((j+.33)*c.length/52);
      for(const side of [-1,1]){
        const pos=local(p,side*40);pos[1]=-5;
        if(pos[0]*pos[0]+pos[2]*pos[2]>extent*extent*.44)continue;
        for(let r=room+2;r<42&&clear(pos,r,true);r+=2){room=r;best=pos;}
      }
    }
    if(room>9)volcanoCone(m,best,room*.91,Math.min(52,room*1.5),rand);
    for(let j=0;j<42;j++){
      const p=at((j+.2)*c.length/42),side=j%2?1:-1,pt=local(p,side*(p.w+3+rand()*7),-2.7);
      if(!clear(pt,2.8))continue;
      for(let k=0;k<4;k++){
        const o=move(pt,Math.sin(k*2.17)*1.5,0,Math.cos(k*2.17)*1.5),h=1.8+rand()*5.5;
        m.ring(o,move(o,.12,h,0),.92,.85,k%2?'#54434b':'#6d5351',6,rockMaterial);
        if(k===0&&j%4===1)m.ring(move(o,.12,h,0),move(o,.12,h+.052,0),.84,.82,'#f39a54',6,lavaMaterial);
      }
    }
    tunnel(m,s=>at(s,true),.594*c.length,.636*c.length,7.1,7.6,['#453b42','#59444b','#5c474a','#734a48'],4.8);
    for(const u of [.13,.24,.44,.75,.87]){
      const p=at(u*c.length),side=u>.5?1:-1;
      const pt=local(p,side*(p.w+12),-3.7);if(!clear(pt,5))continue;
      volcanoCone(m,pt,3.6,5.4,rand);
      m.ring(move(pt,0,4.9,0),move(pt,.45,8.5,.25),.52,.2,'#ff9444',6,lavaMaterial);
      for(let i=0;i<5;i++)m.blob(...move(pt,Math.sin(i*2.43)*1.1,8.4+i*.50,Math.cos(i*2.43)*1.1),.18,.36,.18,'#ffc377',5,lavaMaterial);
    }
  }

  function rainbow({m,c,at,rand,clear}){
    for(const u of [.12,.188,.274,.457,.675,.752,.867]){
      const p=at(u*c.length),width=p.w+1.15;
      for(let ring=0;ring<3;ring++){
        const colors=Array.from({length:14},(_,i)=>spectrum[(Math.floor(i/2)+ring*2)%spectrum.length]);
        arch(m,p,width+ring*.29,7.7+ring*.29,colors,.18,prismMaterial,14);
      }
    }
    for(let j=0;j<48;j++){
      const p=at((j+.35)*c.length/48),side=j%2?1:-1;
      const pt=local(p,side*(p.w+5+rand()*12),rand()*10-6);
      if(!clear(pt,2.2))continue;
      const radius=.67+rand()*1.4,height=2.5*radius;
      diamond(m,pt,radius,height,0,[spectrum[j%7],spectrum[(j+2)%7],'#e4d9ec'],j);
      diamond(m,pt,radius,-height*.79,0,[spectrum[(j+1)%7],'#998bbd',spectrum[j%7]],j);
      if(j%6===0){
        const axis=move(pt,0,-height*.85,0);
        m.ring(axis,move(axis,0,-3.4,0),.034,.034,'#b8b2cb',4);
        m.blob(...move(axis,0,-3.55,0),.23,.33,.23,'#ffdc92',5,5);
      }
    }
    const p=at(.39*c.length),x=clear(local(p,-32,6),12)?-32:32;
    if(clear(local(p,x,6),12)){
      diamond(m,local(p,x,-.8),3.9,9.6,1.1,['#f3becd','#a9e3ec','#b7a8f0']);
      for(let k=0;k<7;k++)ringBand(m,p,[x,6,0],6.3+k*.40,.59,spectrum[k],.3);
    }
  }

  function lowlands(m,palette,material){
    m.quad([-390,1,-390],[-390,1,390],[390,1,390],[390,1,-390],palette.water,material,up);
  }

  const sceneCache=new WeakMap();
  function scenery(c,sim){
    if(c.index<13)return null;
    if(sceneCache.has(c))return sceneCache.get(c);
    let seed=0xb165162f+c.index*137;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const at=s=>sim.sample(c,c.length*s,0),lines=[];
    for(let j=0;j<c.points.length;j+=4){
      const u=j/c.points.length,p=at(u);lines.push(p);
      if(u>c.branchA&&u<c.branchB)lines.push(sim.sample(c,c.length*u,0,true));
    }
    const clear=(point,radius)=>lines.every(p=>Math.hypot(p.x-point[0],p.z-point[2])>p.w+radius);
    const scene={index:c.index,pads:[],frogs:[],trees:[],ridges:[],ripples:[],ground:[]};
    if(c.index>=16){
      scene.mythic=root.AcornMythicWorld.decorate(c,sim,rand,clear);
      scene.basin=root.AcornMythicWorld.underworld(c);
    }
    if(c.index===13||c.index===14){
      for(let i=0;i<94;i++){
        const p=at((i+.39)/94),side=i%2?1:-1;
        const center=local(p,side*(p.w+3.7+rand()*33),1.055-p.y);
        scene.ripples.push({center,width:i%2===0?1.5+rand()*4:3.5+rand()*10,phase:rand()*tau,yaw:rand()*tau});
      }
    }
    if(c.index===14){
      for(let i=0;i<42;i++){
        const p=at((i+.55)/42),side=i%2?1:-1,separation=p.w+8.3+rand()*7.5;
        const pads=[];
        for(let j=0;j<3;j++){
          const center=local(p,side*(separation+Math.sin(j*1.2)*2.45),1.09-p.y,(j-1)*3.3);
          const radius=.87+rand()*.51;
          if(!clear(center,radius+.55))continue;
          pads.push({center,radius,rotation:rand()*tau,hue:(i+j)%3,bloom:(i+2*j)%11===0});
        }
        scene.pads.push(...pads);
        if(pads.length===3){
          if(i%3===0)scene.frogs.push({pads,phase:rand()*8,period:1.82+rand()*.67,size:.75+rand()*.31});
          else if(i%3===1)scene.frogs.push({pads:[...pads].reverse(),phase:i*.67,period:1.74+(i%7)*.10,size:.62+(i%5)*.082});
        }
      }
    }
    if(c.index===15){
      for(let i=0;i<75;i++){
        const p=at((i+.54)/75),side=i%2?1:-1;
        const base=local(p,side*(p.w+6+rand()*30));
        if(!clear(base,4.35))continue;
        base[1]=forestFloor(base[0],base[2]);
        const top=[base[0]+(rand()-.5)*1.4,p.y-5+rand()*18,base[2]+(rand()-.5)*1.4];
        scene.trees.push({base,top,size:.86+rand()*.53,phase:rand()*tau});
      }
      for(let j=0;j<16;j++){
        const a=j*tau/16,dist=151+rand()*26,x=Math.cos(a)*dist,z=Math.sin(a)*dist;
        scene.ridges.push([x,forestFloor(x,z),z]);
      }
      for(let x=-210;x<210;x+=42)for(let z=-210;z<210;z+=42){
        const corners=[[x,z],[x,z+42],[x+42,z+42],[x+42,z]].map(([x,z])=>[x,forestFloor(x,z),z]);
        scene.ground.push({corners,hue:Math.abs(Math.round(x/42+z/42))%3});
      }
    }
    sceneCache.set(c,scene);
    return scene;
  }

  function spillway({m,c,at,clear}){
    lowlands(m,palettes[c.index-8],spillwaterMaterial);
    for(const u of [.065,.095,.125,.155,.185]){
      const p=at(c.length*u);
      for(const side of [-1,1]){
        const foot=local(p,side*(p.w+1.1),1-p.y),head=local(p,side*(p.w+1.1),4.6);
        if(!clear(foot,1,true))continue;
        m.ring(foot,head,.95,.58,'#b69275',6,rockMaterial);
        m.box(...head,1.9,.45,1.8,yaw(p),'#d4b293');
      }
      m.ring(local(p,-p.w-1.1,4.7),local(p,p.w+1.1,4.7),.22,.22,'#d5a268',6,2);
    }
    for(const u of [.255,.655]){
      const p=at(c.length*u),side=[-1,1].find(s=>clear(local(p,s*23,2),7,true));
      if(side===undefined)continue;
      m.box(...local(p,side*24,-.2),9,2.1,7,yaw(p),'#886f5c',rockMaterial);
      m.box(...local(p,side*24,1.89),8.85,3,6.9,yaw(p),'#af8863',2);
      m.box(...local(p,side*24,4.8),9.6,.65,7.5,yaw(p),'#5c6b5c',2);
      for(const z of [-4.2,4.2])ringBand(m,p,[side*23,2,z],4.5,Math.PI/2,'#c39961',.47,18);
      for(let i=0;i<10;i++){
        const a=i*tau/10,spoke=local(p,side*23+4.5*Math.cos(a),2+4.5*Math.sin(a),-4.2);
        m.ring(local(p,side*23,2,-4.2),spoke,.13,.22,'#916745',5,2);
        m.ring(spoke,move(spoke,p.tx*8.4,0,p.tz*8.4),.23,.23,'#ac8256',5,2);
      }
      m.ring(local(p,side*23,2,-4.5),local(p,side*23,2,4.5),.47,.47,'#dbaf75',7,2);
    }
    for(const u of [.195,.31,.46,.51,.55,.755,.89]){
      const branch=u>.45&&u<.56,p=at(u*c.length,branch);
      for(const side of [-1,1]){
        const deckEdge=side*(p.w+.89),top=local(p,deckEdge,.43);
        if(!clear(top,.5,true))continue;
        const foot=local(p,deckEdge,1-p.y);
        m.ring(foot,top,.34,.28,'#73513d',6,2);
        m.ring(local(p,deckEdge,1-p.y+1.1,-2.2),top,.147,.123,'#916346',5,2);
        m.box(...local(p,deckEdge,-.22,.04),.44,.3,1.9,yaw(p),'#ab8259',2);
      }
    }
  }

  function lilyPad(m,pad){
    const {center,radius,rotation,hue,bloom}=pad;
    const green=['#607a46','#749753','#517c57'][hue],edge=['#9ab570','#87ad68','#71a075'][hue];
    const n=12,notch=.46;
    const leaf=(j,f)=>{
      const t=rotation+notch+(tau-2*notch)*j/n;
      return move(center,Math.cos(t)*radius*f,.019*Math.sin(j*1.4),Math.sin(t)*radius*f);
    };
    for(let j=0;j<n;j++){
      m.tri(center,leaf(j+1,1),leaf(j,1),j%4===0?edge:green,0,up);
      if(j%3===0)m.ring(move(center,0,.024,0),move(leaf(j,.91),0,.032,0),.022,.009,edge,3);
    }
    if(bloom){
      const bud=move(center,-radius*.32,.08,radius*.2);
      for(let j=0;j<6;j++){
        const a=j*tau/6;
        m.blob(...move(bud,Math.cos(a)*.14,.045,Math.sin(a)*.14),.12,.057,.12,'#d5adc2',5,5);
      }
      m.blob(...move(bud,0,.09,0),.085,.07,.085,'#e6b87d',5,5);
    }
  }

  function mooncap({m,c,at,rand,clear,scene}){
    lowlands(m,palettes[c.index-8],marshWaterMaterial);
    for(const pad of scene.pads)lilyPad(m,pad);
    for(let i=0;i<64;i++){
      const p=at(c.length*(i+.4)/64),side=i%2?1:-1,offset=p.w+2.3+rand()*11;
      const cap=local(p,side*offset,-.64+rand()*3.65),size=.75+rand()*1.4;
      if(!clear(cap,size+.4,true))continue;
      const hue=i%3===0?'#c37ee2':i%3===1?'#6dcfc5':'#8a9cfd';
      m.ring([cap[0],1,cap[2]],cap,.22*size,.15*size,'#af97bd',6);
      m.blob(...cap,size,.31*size,size,hue,8,22);
      m.blob(...move(cap,0,.17*size,0),size*.71,.26*size,size*.73,hue,7,5);
      for(let j=0;j<3;j++){
        const r=local(p,side*(offset+size+1.4+j*.4),1.15-p.y,(j-1)*1.45);
        if(!clear(r,.48,true))continue;
        const tip=move(r,j*.16,1.2+rand()*2.3,-.24);
        m.ring(r,tip,.046,.036,'#5b9784',4);
        m.blob(...tip,.09,.15,.09,'#c3ffe1',4,5);
      }
    }
  }

  function tempest({m,c,at,clear,scene}){
    const ground=(x,z)=>[x,forestFloor(x,z),z];
    for(let x=-196;x<196;x+=14)for(let z=-196;z<196;z+=14){
      const col=['#344941','#3e5045','#364e48'][Math.abs(x/14+z/14)%3];
      m.quad(ground(x,z),ground(x,z+14),ground(x+14,z+14),ground(x+14,z),col,peatMaterial);
    }
    for(const [x,y,z] of scene.ridges)m.blob(x,y+2,z,20,10,18,'#364e4a',7,peatMaterial);
    bridgeTowers(m,at,.136,.206,c.length);
    bridgeTowers(m,at,.755,.814,c.length);
    for(const {base,top,size,phase} of scene.trees){
      const stem=move(base,0,4.7*size,0);
      m.ring(move(base,0,-2,0),stem,1.85*size,1.22*size,'#5d493d',8,2);
      m.ring(stem,top,1.23*size,.22*size,'#655346',8,2);
      for(let j=0;j<5;j++){
        const a=phase+j*tau/5,rootX=base[0]+Math.cos(a)*size*4.2,rootZ=base[2]+Math.sin(a)*size*4.2;
        m.ring(move(stem,0,-1.6,0),move(ground(rootX,rootZ),0,-.27,0),.52*size,.07,'#5c493e',5,2);
      }
      for(let j=0;j<5;j++){
        const canopy=move(top,Math.cos(phase+j)*.3,-3.25*j*size,Math.sin(phase+j)*.3),radius=(2.15+j*1.06)*size;
        const color=['#3d5b52','#3b5650','#34504a','#364f49','#2f4943'][j];
        const cap=move(canopy,0,2.9*size,0),inside=move(canopy,0,-3.26*size,0);
        const skirt=i=>{
          const a=phase+i*tau/8,r=radius*(i%2?.80:1.04);
          return move(canopy,r*Math.cos(a),-3.35*size+(i%2?.51:-.26)*size,r*Math.sin(a));
        };
        for(let i=0;i<8;i++){
          const a=skirt(i),b=skirt(i+1);
          m.tri(cap,b,a,color,3);m.tri(inside,a,b,'#2e4640',3);
        }
      }
    }
    for(let i=0;i<52;i+=3){
      const p=at(c.length*(i+.54)/52),side=i%2?1:-1;
      const upper=local(p,side*(p.w-.32),-.35),lower=local(p,-side*(p.w-.32),-4.1);
      if(clear(lower,.6))m.ring(upper,lower,.18,.17,'#795d52',6,2);
    }
  }

  function build(Mesh,c,sim){
    const m=new Mesh(),index=c.index,pal=palettes[index-8],count=c.points.length,length=c.length;
    let seed=0xb16b00b5+index*101;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const at=(s,branch=false)=>sim.sample(c,s,0,branch);
    const lines=[];
    for(let j=0;j<count;j+=3){
      const s=length*j/count,q=at(s);lines.push(q);
      if(q.u>c.branchA&&q.u<c.branchB)lines.push(at(s,true));
    }
    const clear=(point,radius,anyHeight=false)=>lines.every(q=>(!anyHeight&&Math.abs(q.y-point[1])>13+radius)||Math.hypot(q.x-point[0],q.z-point[2])>q.w+radius);
    for(let j=0;j<count;j++){
      const s=length*j/count,end=length*(j+1)/count,a=at(s),b=at(end);
      const fork=end>c.branchA*length&&s<c.branchB*length;
      if(index>=16){
        // Intersect each ribbon with its own gap boundaries. Trimming at the
        // exact lip and catch preserves the visible drop even between samples.
        for(const branch of fork?[false,true]:[false]){
          for(const [start,stop] of root.AcornRamps.solidSpans(c,s,end,branch)){
            roadSegment(m,at(start,branch),at(stop,branch),index,pal,j,branch,
              fork?at(start,!branch):null,fork?at(stop,!branch):null);
          }
        }
      }else if(fork){
        const branchA=at(s,true),branchB=at(end,true);
        roadSegment(m,a,b,index,pal,j,false,branchA,branchB);
        roadSegment(m,branchA,branchB,index,pal,j,true,a,b);
      }else roadSegment(m,a,b,index,pal,j);
    }
    const scene=scenery(c,sim);
    if(index>=16)root.AcornMythicWorld.build(m,Mesh,scene);
    else [cave,sky,space,volcano,rainbow,spillway,mooncap,tempest][index-8]({m,c,at,rand,clear,scene});
    if(index===root.AcornMinecarts.courseIndex){
      const sampleRoad=(s,x,branch)=>sim.sample(c,s,x,branch);
      for(const row of root.AcornMinecarts.railRows(c,root.AcornHazards.samples(c,0),sampleRoad)){
        for(const panel of row.panels)m.quad(...panel);
      }
    }
    grid(m,at,index,pal);turnBoards(m,c,at,pal);
    for(const ramp of root.AcornRamps.list(c)){
      const deck=root.AcornRampArt.rampMesh(Mesh,c,ramp);
      for(let i=0;i<deck.data.length;i++){
        // A kart can miss the launch and pass under the catch shelf. Mark the
        // physical ramp so the chase camera can look through its near face.
        m.data.push(i%10===9?30+deck.data[i]:deck.data[i]);
      }
    }
    return {mesh:m,mov:[]};
  }

  // World-space materials keep glow veins and brushed panels attached to the terrain.
  const materials=`
    if(mat>19.5 && mat<20.5){
      float grain=h(floor(wp.xz*12.));
      float seams=noise(wp.xz*.7);
      tex=.94+.055*grain+.055*seams;
      if(abs(trackId-8.)<.2||abs(trackId-11.)<.2){
        float layer=noise(wp.xz*.21+vec2(.22*noise(wp.xz*.8),0.));
        tex*=.89+.16*smoothstep(.30,.82,layer);
        float vein=1.-smoothstep(.004,.024,abs(layer-.55));
        tint=mix(tint,trackId<9.?vec3(.46,.56,.58):vec3(.45,.26,.22),vein*.31);
      }
      if(abs(trackId-12.)<.2){float glint=pow(max(0.,sin(dot(wp.xz,vec2(.078,.11))+clock*.8)),15.);
        light=.89+.09*max(0.,norm.y);tint=mix(tint,vec3(.95,.91,1.),.10*glint); tex*=.98+.026*seams;}
    }else if(mat>20.5 && mat<21.5){
      vec2 v=wp.xz*.22+wp.y*.07;float field=noise(v+vec2(clock*.06,0.))*.65+noise(v*2.6-vec2(.03,.017)*clock)*.35;
      float cracks=1.-smoothstep(.015,.095,abs(field-.54));tint=mix(col*vec3(.50,.34,.36),vec3(1.,.73,.30),cracks);
      light=1.06;tex=.94+.06*noise(v*5.);
    }else if(mat>21.5 && mat<22.5){
      float rim=pow(1.-max(0.,abs(dot(norm,normalize(eye-wp)))),2.);
      tint=mix(col,vec3(.86,.98,1.),.22*rim);light=.86+.24*max(0.,dot(norm,sun))+.16*rim;
      highlight+=.14*pow(max(0.,dot(reflect(-sun,norm),normalize(eye-wp))),14.);
    }else if(mat>22.5 && mat<23.5){
      float bedding=noise(vec2(wp.x*.24+wp.z*.33,wp.y*1.23));tex=.84+.16*bedding+.07*h(floor(wp.xz*3.+wp.y));
    }else if(mat>23.5 && mat<24.5){
      vec2 uvGround=wp.xz;
      float muddy=noise(uvGround*.49)*.54+noise(uvGround*1.9)*.30+noise(uvGround*9.2)*.16;
      float grit=noise(uvGround*19.);
      tex=.62+.55*muddy+.19*grit;
      if(abs(trackId-14.)<.2){
        tint=mix(tint*vec3(1.20,1.01,.89),tint*vec3(.64,.78,.80),smoothstep(.26,.70,muddy));
        vec3 halfLight=normalize(normalize(eye-wp)+sun);
        highlight=pow(max(0.,dot(norm,halfLight)),19.)*smoothstep(.50,.75,muddy)*.22;
      }
    }else if(mat>24.5 && mat<25.5){
      vec2 current=wp.xz+vec2(clock*1.55,clock*.43);
      float eddies=noise(current*.19),crossWave=sin(dot(current,vec2(-.13,.87))+2.5*eddies);
      float wave=sin(dot(current,vec2(.69,.38))+crossWave*1.3);
      float fineWave=sin(dot(current,vec2(.56,-1.78))+clock*.56+3.9*eddies);
      float crest=smoothstep(.74,1.,wave*.75+fineWave*.25);
      float foam=smoothstep(.82,.98,wave)*smoothstep(.39,.67,noise(current*1.3));
      tint=mix(tint*.78,tint*1.27,.46+.23*wave+.16*crossWave);
      tint=mix(tint,vec3(.63,.83,.81),crest*.42+foam*.33);
      light=.93+fineWave*.06;
    }else if(mat>25.5 && mat<26.5){
      float shallows=noise(wp.xz*.115)*.78+noise(wp.xz*.62)*.22;
      float ripple=sin(dot(wp.xz,vec2(.23,1.03))+clock*.94+8.*shallows);
      tint=mix(tint*.72,vec3(.29,.22,.16),smoothstep(.28,.78,shallows));
      tint=mix(tint,vec3(.38,.48,.43),smoothstep(.73,1.,ripple)*.23);
      tex=.88+.12*noise(wp.xz*7.8);
    }`+(root.AcornMythicWorld?.materials||'');

  function frogMeshes(Mesh){
    function frog(leap){
      const m=new Mesh();
      m.blob(0,.28,.03,.46,.24,.58,'#617b43',8);
      m.blob(0,.20,.29,.40,.17,.43,'#b5a568',8);
      m.blob(0,.35,.32,.47,.22,.38,'#78974b',9);
      for(const side of [-1,1]){
        m.blob(side*.34,.50,.34,.16,.15,.16,'#839c54',7);
        m.blob(side*.36,.549,.426,.111,.086,.078,'#e2bf68',7);
        m.blob(side*.374,.553,.483,.050,.045,.038,'#292522',6);
        m.blob(side*.385,.578,.504,.016,.016,.012,'#ffe6a4',5,5);
        const fore=[side*(leap?.46:.30),leap?.11:.065,leap?.67:.53];
        const knee=[side*(leap?.59:.47),leap?.16:.18,leap?-.52:-.22];
        const heel=[side*(leap?.43:.42),leap?.095:.054,leap?-1.05:-.47];
        m.ring([side*.29,.26,.33],fore,.092,.06,'#8da057',6);
        m.ring([side*.25,.22,-.30],knee,.145,.109,'#638348',7);
        m.ring(knee,heel,.103,.056,'#7b914c',6);
        for(const [foot,dir] of [[fore,1],[heel,-1]])for(let i=-1;i<=1;i++){
          m.ring(foot,move(foot,.056*i,-.023,dir*(.11+.037*(1-Math.abs(i)))),.025,.014,'#aab364',4);
        }
      }
      for(let i=0;i<5;i++)m.blob((i-2)*.12,.49-Math.abs(i-2)*.017,-.17+i%2*.12,.045,.025,.069,'#a9b357',5);
      return m;
    }
    return {marshFrog:frog(false),marshFrogLeap:frog(true)};
  }

  const frogRoute=[0,1,2,1];
  function frogPose(frog,time){
    const tick=(time+frog.phase)/frog.period,step=Math.floor(tick),rest=tick-step;
    const a=frog.pads[frogRoute[step%frogRoute.length]].center;
    const b=frog.pads[frogRoute[(step+1)%frogRoute.length]].center;
    const progress=unit((rest-.55)/.45),air=Math.sin(Math.PI*progress);
    const at=mix(a,b,progress);
    at[1]+=.045+air*.97;
    return {at,yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),air};
  }

  function drawWildlife(scene,time,distance,stamp){
    for(const frog of scene?.frogs||[]){
      const {at,yaw,air}=frogPose(frog,time);
      if(distance({x:at[0],z:at[2]})<94)
        stamp(air>.14?'marshFrogLeap':'marshFrog',at,yaw,frog.size,1,0,(air>.10?.19*Math.cos(air*5):0));
    }
  }

  function paintFrog(ctx,point,size,air=0,angle=0){
    if(point.z<1)return;
    const scale=point.k*size;
    if(scale<.95)return;
    ctx.save();ctx.translate(point.x,point.y);ctx.scale(scale,scale);
    const front=Math.sin(angle)*.21;
    const shape=(x,y,rx,ry,color,turn=0)=>{
      ctx.beginPath();ctx.ellipse(x,y,rx,ry,turn,0,tau);ctx.fillStyle=color;ctx.fill();
    };
    for(const side of [-1,1]){
      shape(side*(.39+air*.18),-.14,.24+air*.19,.098,'#527744',side*(.32+air*.35));
      shape(side*(.55+air*.24),-.075,.117,.047,'#97ab63',side*.11);
    }
    shape(0,-.26,.47,.24,'#617f46');
    shape(front,-.19,.39,.13,'#ac9e60');
    shape(front,-.32,.42,.20,'#83a35d');
    for(const sign of [-1,1]){
      const x=front+sign*.27;
      shape(x,-.48,.124,.125,'#789848');
      shape(x,-.51,.077,.063,'#e6c974');
      shape(x+front*.16,-.51,.036,.038,'#272d27');
    }
    ctx.restore();
  }

  function paintScenery(ctx,scene,time,worldPoint,heading,width){
    if(!scene)return;
    if(scene.mythic){root.AcornMythicWorld.paint(ctx,scene,worldPoint,heading,width);return;}
    const project=p=>worldPoint(...p);
    const path=(points,col)=>{
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();ctx.fillStyle=col;ctx.fill();
    };
    for(const tile of scene.ground){
      const points=tile.corners.map(project);
      if(points.every(p=>p.z>2)&&points.some(p=>p.z<180))path(points,['#384b43','#3c4e46','#3e524b'][tile.hue]);
    }
    for(const ripple of scene.ripples){
      const pos=project(ripple.center);
      if(pos.z<2||pos.z>128)continue;
      const cycle=time*1.4+ripple.phase,scale=ripple.width;
      const dx=Math.cos(ripple.yaw),dz=Math.sin(ripple.yaw),offset=Math.sin(cycle)*1.7;
      ctx.lineWidth=Math.max(.5,pos.k*(scene.index===13?.062:.038));
      ctx.strokeStyle=scene.index===13?`rgba(178,218,209,${.23+.17*Math.sin(cycle)})`:`rgba(133,160,128,${.13+.08*Math.sin(cycle)})`;
      ctx.beginPath();let visible=false;
      for(let j=0;j<7;j++){
        const x=(j/6-.5)*scale,forward=offset+Math.sin(j*.75+cycle)*.43;
        const p=project(move(ripple.center,x*dx+forward*dz,0,x*dz-forward*dx));
        if(p.z<1.5){visible=false;continue;}
        if(visible)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
        visible=true;
      }
      ctx.stroke();
    }
    const pads=scene.pads.map(pad=>({pad,pt:project(pad.center)})).filter(({pt})=>pt.z>2&&pt.z<115).sort((a,b)=>b.pt.z-a.pt.z);
    for(const {pad,pt} of pads){
      const r=pad.radius,a=pad.rotation,outline=[pt];
      for(let i=0;i<=11;i++){
        const w=a+.43+(tau-.86)*i/11;
        outline.push(project(move(pad.center,Math.cos(w)*r,0,Math.sin(w)*r)));
      }
      path(outline,['#688447','#789f5a','#527c53'][pad.hue]);
      if(pad.bloom){
        const radius=Math.max(1,pt.k*.16);
        for(let i=0;i<5;i++){
          const a=i*tau/5;
          ctx.beginPath();ctx.ellipse(pt.x+Math.cos(a)*radius,pt.y+Math.sin(a)*radius*.64,radius,radius*.52,a,0,tau);
          ctx.fillStyle='#dbabc6';ctx.fill();
        }
      }
    }
    for(const frog of scene.frogs){
      const {at,yaw,air}=frogPose(frog,time),pt=project(at);
      if(pt.z<113)paintFrog(ctx,pt,frog.size,air,yaw);
    }
    const trees=scene.trees.map(tree=>({tree,pt:project(tree.base)})).filter(({pt})=>pt.z>2&&pt.z<170).sort((a,b)=>b.pt.z-a.pt.z);
    for(const {tree,pt} of trees){
      const {top,size}=tree,k=pt.k*size,tip=project(top);
      path([{x:pt.x-1.64*k,y:pt.y},{x:tip.x-.20*k,y:tip.y},{x:tip.x+.20*k,y:tip.y},{x:pt.x+1.64*k,y:pt.y}],'#685447');
      for(let j=4;j>=0;j--){
        const b=project(move(top,0,-3.34*size*j,0)),width=(2.4+1.06*j)*k;
        path([{x:b.x,y:b.y-2.9*k},{x:b.x-width,y:b.y+3.1*k},{x:b.x+width,y:b.y+3.1*k}],j%2?'#36554b':'#456458');
      }
    }
  }

  function paintShoulders(ctx,index,route,s,e,a,b,branch,fork){
    if((index!==14&&index!==15)||a.exposed)return;
    const mud=index===14,ext=4.4,step=Math.floor(s*1.32);
    const shape=(pts,col)=>{
      ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();ctx.fillStyle=col;ctx.fill();
    };
    for(const side of [-1,1]){
      if(fork&&side===(branch?-1:1))continue;
      const x=side*a.w,ex=side*b.w,toe=x+side*ext,endToe=ex+side*ext;
      shape([route(s,x,-.05),route(e,ex,-.05),route(e,endToe,-.10),route(s,toe,-.10)],mud?'#564139':step%2?'#715641':'#745b46');
      if(mud){
        shape([route(s,toe,-.10),route(e,endToe,-.10),route(e,endToe+side*3.2,.98-b.y),route(s,toe+side*3.2,.98-a.y)],'#47362c');
        for(let j=0;j<3;j++){
          const t=.45+((Math.sin(step*13.24+j*7.6)+1)*.5)*3.5;
          const p=route(s+.34*(e-s),x+side*t,.018);
          if(p.z<1||p.k<1.4)continue;
          ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(.5,p.k*.15),Math.max(.4,p.k*.053),0,0,tau);
          ctx.fillStyle=j%2?'#775a43':'#382e28';ctx.fill();
        }
      }else{
        for(const offset of [1.5,3.0]){
          shape([route(s,x+side*offset,-.017),route(e,ex+side*offset,-.017),route(e,ex+side*(offset+.062),-.017),route(s,x+side*(offset+.062),-.017)],'#47392f');
        }
      }
    }
  }

  function themeHazards(parts,index){
    // The warning markers and timing come from the shared hazard. Recolor the
    // physical meshes by vertex, preserving facets and the water's edge coverage.
    const color=(name,range,material,predicate=()=>true)=>{
      const d=parts[name].data,low=range[0],high=range[1];
      for(let i=0;i<d.length;i+=10){
        if(!predicate(d[i+9],d[i],d[i+1],d[i+2]))continue;
        const l=Math.max(0,Math.min(1,d[i+6]*.4+d[i+7]*.44+d[i+8]*.16));
        for(let j=0;j<3;j++)d[i+6+j]=(low[j]+(high[j]-low[j])*l)/255;
        if(material!==null)d[i+9]=material;
      }
    };
    if(index===8){
      color('envBasket',[[40,87,105],[136,248,213]],prismMaterial,(mat,x,y)=>y>.55);
    }else if(index===9){
      color('envBamboo',[[158,72,43],[255,219,136]],0,(mat,x,y)=>Math.abs(y)<.20);
    }else if(index===10){
      color('envRock',[[25,31,62],[153,150,181]],rockMaterial);
    }else if(index===11){
      for(let i=0;i<3;i++)color('envSaltPlate'+i,[[28,24,38],[101,75,70]],rockMaterial);
      color('envBrine',[[157,40,27],[255,138,62]],lavaMaterial);
      color('envCracks',[[255,87,37],[255,190,87]],5);
      color('envCrystal',[[72,42,49],[204,103,78]],rockMaterial);
    }else if(index===12){
      color('envFlow0',[[71,115,190],[189,185,248]],null);
      color('envChute',[[77,129,202],[209,216,249]],null);
      color('envSluice',[[87,73,130],[181,160,202]],prismMaterial);
    }else if(index===13||index===14){
      color('envFlow0',index===13?[[46,104,112],[178,217,198]]:[[82,101,166],[185,245,235]],null);
      color('envSluice',[[51,61,76],[148,175,168]],rockMaterial);
    }else if(index===15){
      color('envBamboo',[[80,61,73],[236,170,95]],2);
    }
    return parts;
  }

  const horizonImages=[];
  function paintSky(ctx,w,h,heading,index){
    const pal=palettes[index-8];if(!pal)return;
    const wash=ctx.createLinearGradient(0,0,0,h);
    wash.addColorStop(0,pal.sky);wash.addColorStop(.44,pal.mist);wash.addColorStop(1,pal.land);
    ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
    let image=horizonImages[index];
    if(!image){image=new Image();image.src='art/horizon-'+index+'.webp';horizonImages[index]=image;}
    if(!image.naturalWidth)return;
    const slide=((heading/tau)%1+1)%1,band=Math.max(w*2.2,h*2.3),left=-slide*band,destHeight=h*.82;
    if(index>=16){
      // Mirror the panorama over one full revolution, as the WebGL sky shader does.
      const scroll=2*slide;
      for(let tile=Math.floor(scroll);(tile-scroll)*band<w;tile++){
        const x=(tile-scroll)*band,mirror=tile%2===1;
        ctx.save();ctx.translate(mirror?x+band:x,0);
        if(mirror)ctx.scale(-1,1);
        ctx.drawImage(image,0,-h*.08,band+.5,destHeight);ctx.restore();
      }
      return;
    }
    for(let x=left-band;x<w;x+=band)ctx.drawImage(image,x,-h*.08,band,destHeight);
  }
  root.AcornExpansionWorld={build,palettes,materials,paintSky,themeHazards,scenery,frogMeshes,drawWildlife,paintFrog,paintScenery,paintShoulders,timberDeck};
})(typeof globalThis==='object'?globalThis:this);
