(function(root){
  'use strict';
  const tau=Math.PI*2;
  const palette={sky:'#24263f',mist:'#676980',soil:'#5d6474',edge:'#41485a',land:'#262837',
    wood:'#595161',accent:'#bfd5ce',leaf:['#54615a','#3d454e','#7b8184'],water:'#344958'};
  const stone='#656979',dark='#3b4050',cap='#9596a1',metal='#514957',bronze='#ad8062';
  const deck=28,masonry=29;
  function spire(m,x,y,z,r,h){
    m.ring([x,y,z],[x,y+h*.17,z],r*1.20,r*.9,dark,4,masonry);
    m.ring([x,y+h*.17,z],[x,y+h*.87,z],r*.97,r*.13,'#596070',4,masonry);
    m.ring([x,y+h*.84,z],[x,y+h,z],r*.17,.015,bronze,5,5);
  }
  function pillar(m,x,y,z,r,h){
    m.box(x,y,z,r*2.48,.33,r*2.48,0,cap,masonry);
    m.ring([x,y+.3,z],[x,y+h,z],r,r*.85,stone,8,masonry);
    m.box(x,y+h-.3,z,r*2.25,.36,r*2.25,0,cap,masonry);
  }
  function plinth(m,w,d,depth){
    // Ragged crags taper below the dressed upper course.
    const outline=[[-.55,-.74],[.37,-.86],[.94,-.45],[.88,.36],[.43,.74],[-.46,.85],[-1,.30],[-.92,-.39]];
    for(let i=0;i<outline.length;i++){
      const q=j=>{const [x,z]=outline[j%8];return [x*w,0,z*d];},a=q(i),b=q(i+1);
      const lower=p=>[p[0]*.76,-depth*(.55+.12*Math.sin(i*2.14)),p[2]*.79];
      const lo=lower(a),hi=lower(b);
      m.tri([0,.16,0],b,a,'#4e515c',masonry);m.quad(a,b,hi,lo,i%2?'#454550':'#363b4a',masonry);
      m.tri(lo,hi,[-.15*w,-depth,.09*d],i%2?'#383c47':'#484654',masonry);
    }
  }
  // Transform a flat Gothic front onto any face of a building.
  function lancet(m,center,angle,w,h,lit){
    const [x,y,z]=center,co=Math.cos(angle),si=Math.sin(angle);
    const p=(a,b,f=0)=>[x+co*a+si*f,y+b,z-si*a+co*f];
    const outline=[[-1,0],[-1,.47],[-.83,.68],[-.48,.84],[0,1],[.48,.84],[.83,.68],[1,.47],[1,0]];
    for(let i=1;i<outline.length;i++){
      const [a,b]=outline[i-1],[c,d]=outline[i],inside=(u,v)=>p(u*w*.75,v*h*.82+.05*h,.036);
      m.quad(p(a*w,b*h),p(c*w,d*h),inside(c,d),inside(a,b),'#989aa1',masonry);
      m.tri(p(0,h*.41,.028),inside(a,b),inside(c,d),lit?'#7d9b9e':'#262c3e',lit?5:masonry);
    }
    m.ring(p(0,.13*h,.09),p(0,h*.79,.09),w*.065,w*.04,dark,4);
    m.ring(p(-w*.77,h*.47,.086),p(w*.77,h*.47,.086),w*.05,w*.05,dark,4);
  }
  function arch(m,x,y,z,width,height,depth,angle=0){
    const local=(a,b,f)=>[x+a*Math.cos(angle)+f*Math.sin(angle),y+b,z-a*Math.sin(angle)+f*Math.cos(angle)];
    const profile=[[-1,0],[-1,.50],[-.92,.64],[-.64,.82],[0,1],[.64,.82],[.92,.64],[1,.5],[1,0]];
    for(let i=1;i<profile.length;i++){
      const a=profile[i-1],b=profile[i];
      const inner=(t,f)=>local(t[0]*width,t[1]*height,f);
      const outer=(t,f)=>local(t[0]*(width+.47),t[1]*(height+.53),f);
      m.quad(inner(a,0),inner(b,0),outer(b,0),outer(a,0),i%2?cap:stone,masonry);
      m.quad(outer(a,-depth),outer(b,-depth),inner(b,-depth),inner(a,-depth),stone,masonry);
      m.quad(inner(a,-depth),inner(b,-depth),inner(b,0),inner(a,0),dark,masonry);
      m.quad(outer(a,0),outer(b,0),outer(b,-depth),outer(a,-depth),cap,masonry);
    }
  }
  function bell(m,x,y,z,r){
    // Broad lip, recessed clapper and gilded waist on the open-frame belfry.
    const sections=[[0,.94],[.14,1],[.25,.86],[.33,.63],[.95,.45],[1.16,.34],[1.32,.17]];
    for(let i=1;i<sections.length;i++){
      const [lo,a]=sections[i-1],[hi,b]=sections[i];
      m.ring([x,y+lo*r,z],[x,y+hi*r,z],a*r,b*r,i===2||i===4?'#b39368':'#75634f',12);
    }
    m.blob(x,y-.13*r,z,.19*r,.31*r,.19*r,'#aa855b',7);
  }
  function tower(m){
    plinth(m,6.8,6.8,10);
    m.box(0,.1,0,8.7,.55,8.7,0,cap,masonry);m.box(0,.66,0,7.7,15.6,7.7,0,stone,masonry);
    for(const y of [1.15,8.8,15.3])m.box(0,y,0,8.4,.43,8.4,0,cap,masonry);
    for(let i=0;i<4;i++){
      const a=i*tau/4,anchor=r=>[Math.sin(a)*r,Math.cos(a)*r],[x,z]=anchor(3.87);
      lancet(m,[x,9.9,z],a,1.06,4.51,false);lancet(m,[x,3.0,z],a,.85,4.55,false);
      arch(m,Math.sin(a)*3.1,21.3,Math.cos(a)*3.1,2.56,3.5,.65,a);
    }
    for(const x of [-3.22,3.22])for(const z of [-3.22,3.22]){
      m.box(x,15.72,z,1.11,8.66,1.11,0,stone,masonry);
      const bx=x*1.27,bz=z*1.27;
      m.ring([bx,.69,bz],[x*1.15,12.2,z*1.15],1.1,.35,dark,4,masonry);
      spire(m,bx,12.2,bz,.49,2.2);
      m.box(x,24.22,z,1.25,2.7,1.25,0,cap,masonry);spire(m,x,26.76,z,.85,5.0);
    }
    m.box(0,24.35,0,8.08,.55,8.08,0,cap,masonry);
    m.ring([0,24.9,0],[0,32.5,0],4.76,.45,'#444955',4,masonry);
    spire(m,0,32.4,0,.58,3.2);
    m.box(0,23.82,0,6.6,.39,.36,0,bronze);m.ring([0,21.8,0],[0,23.82,0],.15,.15,bronze,6);
    bell(m,0,18.8,0,2.28);
  }
  function lantern(m){
    plinth(m,1.08,1.08,2.5);
    m.ring([0,0,0],[0,.65,0],.55,.36,stone,7,masonry);
    m.ring([0,.64,0],[0,3.03,0],.22,.12,metal,6);
    m.ring([0,3.05,0],[0,3.38,0],.24,.64,bronze,6);
    for(let i=0;i<6;i++){
      const s=Math.sin(i*tau/6),c=Math.cos(i*tau/6);
      m.ring([s*.55,3.3,c*.55],[s*.40,4.38,c*.40],.044,.031,dark,4);
    }
    m.ring([0,4.38,0],[0,4.82,0],.60,.045,stone,6);
    m.blob(0,3.76,0,.29,.48,.29,'#a4d1c2',7,5);
    m.ring([0,3.73,0],[.08,4.22,-.035],.18,.009,'#e0e6c4',6,5);
  }
  function crypt(m){
    plinth(m,4.9,4.4,4.4);
    m.box(0,0,0,5.6,.37,4.87,0,cap,masonry);m.box(0,.33,0,4.99,2.89,4.26,0,stone,masonry);
    for(const side of [-1,1]){
      const z=side*2.30;
      m.tri([-2.9,3.17,z],[0,4.88,z],[2.9,3.17,z],dark,masonry);
      m.quad([0,4.91,-2.45],[side*2.95,3.15,-2.45],[side*2.95,3.15,2.45],[0,4.91,2.45],'#525561',masonry);
      pillar(m,side*2.26,.36,2.18,.25,2.88);
    }
    lancet(m,[0,.37,2.17],0,.88,2.84,false);lancet(m,[2.50,.79,0],tau*.25,.60,1.87,true);
    for(const x of [-2.4,2.4])spire(m,x,3.21,2.10,.26,1.03);
    for(const [x,z,s] of [[-2.8,-1.7,.75],[3.15,1.7,.59],[2.73,-1.85,.89]]){
      m.box(x,.1,z,1.14*s,1.42*s,.28*s,.13,cap,masonry);
      m.blob(x,1.52*s,z,.57*s,.46*s,.15*s,cap,7,masonry);
      m.box(x,1.30*s,z+.15*s,.09*s,.42*s,.02*s,0,dark);
      m.box(x,1.53*s,z+.15*s,.32*s,.075*s,.024*s,0,dark);
    }
  }
  function deadwood(m){
    plinth(m,3.60,3.85,4.2);
    const root=[0,.08,0],fork=[-.35,3.27,.16];
    m.ring(root,fork,.78,.39,'#4d4852',7,2);
    for(let i=0;i<5;i++){
      const a=i*tau/5+.41,c=Math.cos(a),s=Math.sin(a),bend=[c*1.55,3.63+i*.31,s*1.45],outer=[c*2.3,5.48+i*.37,s*2.11];
      m.ring(fork,bend,.32,.20,'#5c515a',6,2);m.ring(bend,outer,.20,.10,'#655964',5,2);
      m.ring(outer,[c*2.02,7+i*.29,s*2.07],.098,.018,'#776e76',5,2);
      m.ring(outer,[c*3.01,6.41+i*.32,s*2.86],.09,.012,'#655b69',5,2);
      m.ring([c*.24,.77,s*.21],[c*1.73,.07,s*1.51],.31,.06,'#4a4650',5,2);
    }
  }
  function buttress(m){
    plinth(m,2.73,3.05,7.2);
    m.box(0,0,0,2.20,.50,1.7,0,cap,masonry);
    m.box(0,.46,0,1.68,5.1,1.29,0,stone,masonry);
    m.box(0,5.4,0,2.08,.4,1.72,0,cap,masonry);spire(m,0,5.8,0,.86,3.9);
    arch(m,1.93,1.2,.28,1.19,2.68,.55);
    m.box(3.13,-.14,0,.71,2.96,.94,0,dark,masonry);spire(m,3.13,2.77,0,.47,1.37);
  }
  function gate(m){
    arch(m,0,0,0,5.75,10.6,.93);
    for(const side of [-1,1]){
      pillar(m,side*6.1,-.54,-.45,.55,5.62);spire(m,side*6.09,5.08,-.45,.68,2.66);
      m.box(side*6.09,-1.4,-.45,1.47,1.05,1.65,0,stone,masonry);
    }
    spire(m,0,11.06,-.47,.36,1.36);
  }
  const builders=[tower,lantern,crypt,deadwood,buttress,gate],cache=new WeakMap();
  function models(Mesh){
    if(!cache.has(Mesh))cache.set(Mesh,builders.map(make=>{const m=new Mesh();make(m);return m;}));
    return cache.get(Mesh);
  }
  function basin(c){
    let bottom=Infinity,minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for(const p of c.points){bottom=Math.min(bottom,p.y);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
    const y0=bottom-19,tile=18,faces=[];
    function point(x,z){
      const channel=Math.abs(x*.43-z*.55+11*Math.sin(x*.043)+6*Math.sin(z*.057));
      const y=y0+Math.min(1,channel/31)*(5.1+3.3*Math.cos(z*.040+x*.017))+2.4*Math.sin(x*.032-z*.08);
      return [x,y,z];
    }
    for(let x=Math.floor((minX-30)/tile)*tile;x<maxX+30;x+=tile)for(let z=Math.floor((minZ-30)/tile)*tile;z<maxZ+30;z+=tile){
      for(const f of [[point(x,z),point(x,z+tile),point(x+tile,z+tile)],[point(x,z),point(x+tile,z+tile),point(x+tile,z)]]){
        const px=(f[0][0]+f[1][0]+f[2][0])/3,pz=(f[0][2]+f[1][2]+f[2][2])/3;
        const water=Math.abs(px*.43-pz*.55+11*Math.sin(px*.043)+6*Math.sin(pz*.057))<12;
        faces.push({f,x:px,z:pz,y:f[0][1],col:water?'#485f6b':Math.sin(px*.29+pz*.67)>.18?'#414555':'#373d4c',mat:water?4:masonry});
      }
    }
    return faces;
  }
  function decorate(c,sim,rand,clear){
    const props=[],points=c.points;
    let baseY=Infinity;for(const p of points)baseY=Math.min(baseY,p.y);
    let towerCenter;
    // Search outward from the knot; the tower must stay clear of every deck and the fork.
    for(let radius=11;radius<112&&!towerCenter;radius+=3)for(let j=0;j<28;j++){
      const a=(j+.17)*tau/28,at=[Math.cos(a)*radius,baseY-8,Math.sin(a)*radius];
      if(clear(at,12.5)){towerCenter=at;break;}
    }
    if(towerCenter)props.push({center:towerCenter,k:0,size:1.78,yaw:.49,radius:12});
    for(let i=0;i<84;i++){
      const u=(i+.55)/84,q=sim.sample(c,u*c.length,0),side=i%2?1:-1;
      const k=i%3===0?1:u<.18||u>.82?[2,3,1,2,4][i%5]:u>.46&&u<.7?[2,4,2,3][i%4]:[4,1,3,1][i%4];
      const size=k===1?.75+rand()*.42:.81+rand()*.72,r=[0,1.1,5.3,4.1,4.0][k]*size;
      const off=side*(q.w+r+(k===1?1.5:2.8+rand()*6)),p=[q.x+q.nx*off,q.y-(k===1?.25:1.65+rand()*2.5),q.z+q.nz*off];
      if(clear(p,r+.45)&&props.every(s=>Math.hypot(p[0]-s.center[0],p[2]-s.center[2])>r+s.radius))
        props.push({center:p,k,size,radius:r,yaw:k===1?0:Math.atan2(-side*q.nx,-side*q.nz)});
    }
    for(const u of [.046,.303,.499,.705,.904]){
      const q=sim.sample(c,u*c.length,0),size=Math.max(.76,(q.w+1.05)/5.75);
      const nearOther=points.some((p,i)=>{
        const forward=Math.abs(i/points.length-u);if(Math.min(forward,1-forward)<.025)return false;
        return Math.hypot(p.x-q.x,p.z-q.z)<q.w+5.9*size&&Math.abs(p.y-q.y)<13*size;
      });
      if(!nearOther)props.push({center:[q.x,q.y,q.z],k:5,size,yaw:Math.atan2(q.tx,q.tz),radius:size*7.0});
    }
    return {props,floor:basin(c)};
  }
  function build(m,Mesh,scene){
    const library=models(Mesh);
    for(const t of scene.floor)m.tri(...t.f,t.col,t.mat);
    for(const {center:[x,y,z],k,size,yaw} of scene.props){
      const co=Math.cos(yaw),si=Math.sin(yaw),d=library[k].data;
      for(let i=0;i<d.length;i+=10)m.data.push(x+size*(co*d[i]+si*d[i+2]),y+size*d[i+1],z+size*(-si*d[i]+co*d[i+2]),
        co*d[i+3]+si*d[i+5],d[i+4],-si*d[i+3]+co*d[i+5],d[i+6],d[i+7],d[i+8],d[i+9]);
    }
  }
  function paint(ctx,scene,project,heading,width){
    const visible=[],lib=models(root.AcornWorld.Mesh);
    for(const t of scene.floor){
      const p=project(t.x,t.y,t.z);if(p.z<1||p.z>175||p.x+p.k*20<0||p.x-p.k*20>width)continue;
      const points=t.f.map(v=>project(...v));if(points.some(v=>v.z<1))continue;
      ctx.fillStyle=t.col;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
      ctx.lineTo(points[1].x,points[1].y);ctx.lineTo(points[2].x,points[2].y);ctx.closePath();ctx.fill();
    }
    for(const prop of scene.props){
      const p=project(...prop.center),r=p.k*prop.radius*1.1;
      if(p.z>2&&p.z<(prop.k===0?250:166)&&p.x+r>=0&&p.x-r<=width)visible.push({prop,p});
    }
    visible.sort((a,b)=>b.p.z-a.p.z);
    for(const {prop,p} of visible){
      const img=root.AcornMythicWorld.sprite(lib[prop.k],heading-prop.yaw),k=prop.size*p.k;
      ctx.drawImage(img.canvas,p.x+img.left*k,p.y+img.top*k,img.width*k,img.height*k);
    }
  }
  const materials=`
    if(mat>27.5&&mat<28.5){
      vec2 ground=wp.xz*.138;
      vec4 stones=texture2D(mythosAlbedo,ground);
      vec2 brick=ground*vec2(4.,6.);brick.x+=.5*mod(floor(brick.y),2.);
      vec2 edge=abs(fract(brick)-.5);
      float joint=1.-smoothstep(.46,.49,max(edge.x,edge.y));
      vec3 fallback=tint*(.80+.19*joint+.18*noise(wp.xz*.55));
      tint=mix(fallback,stones.rgb,stones.a);
      float wet=smoothstep(.29,.76,noise(wp.xz*.19));
      highlight+=wet*.13*pow(max(0.,dot(reflect(-sun,norm),normalize(eye-wp))),13.);
      light=.85+.20*max(0.,dot(norm,sun));tex=1.;
    }
    if(mat>28.5&&mat<29.5){
      vec2 uv=abs(norm.y)>.75?wp.xz:(abs(norm.z)>.55?wp.xy:wp.zy);
      vec2 stone=uv*vec2(.67,1.26);stone.x+=.5*mod(floor(stone.y),2.);
      vec2 p=abs(fract(stone)-.5);float joint=smoothstep(.43,.496,max(p.x,p.y));
      float fleck=noise(uv*4.)-.5;
      tex=.99+.22*fleck-.23*joint+.07*(h(floor(stone))-.5);
    }`;
  function paintRoad(c,from,to,branch,split,P,quad,ctx){
    const sim=root.AcornSim;
    for(const [s,e] of root.AcornRamps.solidSpans(c,from,to,branch)){
      const a=sim.sample(c,s,0,branch),b=sim.sample(c,e,0,branch);
      const R=(v,x,y=0)=>P(v,x,y,branch),tile=Math.floor((((s+e)*.5%c.length+c.length)%c.length)/1.35);
      const strip=(al,ar,bl,br,color)=>quad(R(s,al),R(e,bl),R(e,br),R(s,ar),color);
      const pts=[R(s,-a.w),R(e,-b.w),R(e,b.w),R(s,a.w)];
      if(!root.AcornMythicWorld.paintSurface(ctx,20,a,b,pts,quad,1/.138))quad(...pts,palette.soil);
      for(const side of [-1,1]){
        const aw=a.w*side,bw=b.w*side;
        if(split&&side===(branch?-1:1)){
          const other=sim.sample(c,s,0,!branch);if(Math.hypot(other.x-a.x,other.z-a.z)<a.w+other.w)continue;
        }
        quad(R(s,aw),R(e,bw),R(e,bw,-1.05),R(s,aw,-1.05),'#3d4450');
        strip(aw,aw-side*.20,bw,bw-side*.20,tile%6<4?palette.accent:dark);
        if(tile%9===2)strip(aw-side*.28,aw-side*.75,bw-side*.28,bw-side*.47,'#87978e');
      }
    }
  }
  root.AcornDarkWorld={palette,materials,decorate,build,paint,paintRoad,surfacePath:index=>index===20?'art/road-20.webp':null};
})(typeof globalThis==='object'?globalThis:this);

