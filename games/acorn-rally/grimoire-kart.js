(function (root) {
  'use strict';
  const tau=Math.PI*2;
  const palette={
    obsidian:'#202131', midnight:'#2e2945', lacquer:'#493754', highlight:'#685376',
    brass:'#af987c', pewter:'#a7a2b5', silver:'#ddd3d5', rubber:'#282932', tread:'#464451',
    fur:'#414655', darkFur:'#2f3240', ruff:'#545866', ash:'#787b86', tip:'#a5a0af',
    muzzle:'#9899a4', lips:'#373440', nose:'#272331', inner:'#82555f', hide:'#4f3652',
    vest:'#392c49', velvet:'#654668', binding:'#33283c', leaf:'#dfcbab', gilt:'#c7ae82',
    ink:'#5b3e65', violet:'#a782dd', eye:'#e8e3ff', iris:'#b8a5ef', fang:'#e8decf'
  };
  const pivots=[
    [0,.29,0],[-.55,.29,-.60],[.55,.29,-.60],[-.525,.29,.62],[.525,.29,.62],
    [0,.66,-.14],[0,1.14,-.12],[-.19,1.48,-.18],[.19,1.48,-.18],
    [0,.72,-.34],[0,.90,.22],[-.23,.9,.045],[.23,.9,.045],[0,1.02,-.23],
    [.22,.82,-.50],[.37,.91,-.61]
  ];

  function build(low){
    const mesh=root.AcornKartMesh(palette,low),{oval,ring,rod,face,surface}=mesh;
    // Sections are elliptical in XY and taper along the kart's forward (+Z) axis.
    function loft(material,bone,rows,sides){
      surface(material,bone,sides,rows.length-1,(u,v)=>{
        const j=Math.round(v*(rows.length-1)),[z,y,rx,ry]=rows[j];
        const a=rows[Math.max(0,j-1)],b=rows[Math.min(rows.length-1,j+1)];
        const dx=(b[2]-a[2])/(b[0]-a[0]),dy=(b[1]-a[1])/(b[0]-a[0]),dr=(b[3]-a[3])/(b[0]-a[0]);
        const c=Math.cos(u*tau),s=Math.sin(u*tau);
        return [[rx*c,y+ry*s,z],[ry*c,rx*s,-(ry*dx*c*c+rx*s*(dy+dr*s))]];
      });
      for(const end of [0,rows.length-1]){
        const [z,y,rx,ry]=rows[end],cap=[];
        for(let i=0;i<sides;i++){const a=tau*i/sides;cap.push([rx*Math.cos(a),y+ry*Math.sin(a),z]);}
        face(material,bone,end===0?cap.reverse():cap);
      }
    }
    // A sharply tipped, convex lock of fur. The crest catches rim light along its ridge.
    function tuft(mat,bone,base,end,width,depth){
      const [x,y,z]=base,[ex,ey,ez]=end;
      const dx=ex-x,dy=ey-y,n=Math.hypot(dx,dy)||1;
      const ax=-dy*width/n,ay=dx*width/n;
      const left=[x+ax,y+ay,z],right=[x-ax,y-ay,z],ridge=[x+.33*dx,y+.33*dy,z+depth];
      face(mat,bone,[left,right,ridge]);face(mat,bone,[right,end,ridge]);face(mat,bone,[ridge,end,left]);
      face(mat,bone,[left,end,right]);
    }
    function furLock(mat,bone,base,end,width,depth){
      const dx=end[0]-base[0],dy=end[1]-base[1],dz=end[2]-base[2],n=Math.hypot(dx,dy)||1;
      const ax=-dy/n,ay=dx/n;
      const profile=[.32,1,.82,.38,.012];
      surface(mat,bone,low?6:9,4,(u,v)=>{
        const a=tau*u,rad=profile[Math.round(v*4)],w=width*rad*Math.cos(a),thick=depth*rad*Math.sin(a);
        return [[base[0]+v*dx+ax*w,base[1]+v*dy+ay*w,base[2]+v*dz+thick],
          [ax*Math.cos(a)/width,ay*Math.cos(a)/width,Math.sin(a)/depth]];
      });
    }
    const cut=low?8:14;
    loft('obsidian',0,[[-1.035,.32,.026,.025],[-.92,.34,.39,.107],[-.66,.37,.50,.135],[-.15,.365,.48,.14],[.55,.34,.40,.15],[.93,.32,.22,.10],[1.10,.30,.03,.025]],cut);
    loft('lacquer',0,[[-.98,.41,.15,.055],[-.76,.42,.47,.12],[-.28,.43,.456,.125],[.16,.44,.43,.132],[.49,.453,.394,.16],[.78,.427,.283,.12],[1.055,.347,.057,.037]],cut);
    oval('binding',0,[0,.53,-.165],[.335,.085,.372]);
    oval('vest',0,[0,.65,-.432],[.33,.222,.114]);
    for(const side of [-1,1]){
      const p=(x,y,z)=>[side*x,y,z];
      const rail=[p(.07,.378,1.055),p(.299,.468,.805),p(.438,.492,.37),p(.474,.515,-.12),p(.475,.564,-.68),p(.322,.553,-.93)];
      rail.slice(1).forEach((q,i)=>rod('pewter',0,rail[i],q,.012,.015,low?5:8));
      const hood=[p(.095,.49,.93),p(.158,.54,.75),p(.268,.591,.50),p(.305,.56,.34)];
      hood.slice(1).forEach((q,i)=>rod('highlight',0,hood[i],q,.011,.014,5));
      // Tall quarter panels evoke the scrollwork of a funeral carriage.
      const fin=[p(.412,.49,-.30),p(.42,.55,-.77),p(.38,.89,-.97),p(.36,.73,-.77),p(.40,.64,-.61)];
      const ridge=p(.387,.645,-.72);
      for(let i=0;i<fin.length;i++)face(i%2?'midnight':'lacquer',0,[fin[i],fin[(i+1)%fin.length],ridge]);
      rod('pewter',0,fin[1],fin[2],.020,.008);rod('brass',0,fin[2],fin[3],.009,.016);
      // Hood lamps are beveled coffin-shaped crystals set in silver.
      oval('pewter',0,p(.255,.473,.81),[.084,.051,.064],-side*.14);
      oval('violet',0,p(.255,.48,.854),[.057,.037,.038],-side*.14);
      oval('eye',0,p(.25,.485,.878),[.034,.016,.013],-side*.14);
    }
    for(let id=1;id<=4;id++){
      const [x,y,z]=pivots[id],side=Math.sign(x);
      rod('obsidian',0,[x*.39,y,z],[x,y,z],.048);
      ring('rubber',id,[x,y,z],[0,.215,0],[0,0,.215],.075,low?18:28);
      oval('rubber',id,[x,y,z],[.122,.231,.231]);
      ring('pewter',id,[x+side*.116,y,z],[0,.164,0],[0,0,.164],.018,low?14:22);
      oval('midnight',id,[x+side*.124,y,z],[.013,.144,.144]);
      for(let j=0;j<6;j++){
        const a=tau*j/6,w=(r,turn)=>[x+side*.141,y+r*Math.cos(a+turn),z+r*Math.sin(a+turn)];
        face('brass',id,[w(.051,-.11),w(.149,.31),w(.121,.07),w(.069,-.32)]);
      }
      oval('pewter',id,[x+side*.148,y,z],[.027,.061,.061]);
      oval('violet',id,[x+side*.166,y,z],[.017,.031,.031]);
    }
    rod('pewter',0,[0,.53,.31],pivots[10],.028);
    ring('binding',10,pivots[10],[.194,0,0],[0,.139,-.096],.025);
    for(const side of [-1,1])rod('brass',10,pivots[10],[side*.176,.91,.211],.012);

    // The rear lectern and its raised, open pages are legible from the chase camera.
    rod('pewter',0,[-.25,.423,-.72],[-.24,.729,-.79],.029,.024);
    rod('pewter',0,[.25,.423,-.72],[.24,.729,-.79],.029,.024);
    for(const side of [-1,1]){
      function page(u,v,height=0){
        return [side*(.012+u*.315),.54+v*.304+u*.049+Math.sin(Math.PI*u)*.027+height*.44,-.947+v*.196-height];
      }
      const cover=[page(-.025,-.07),page(1.085,-.07),page(1.085,1.045),page(-.025,1.045)];
      face('binding',0,cover);
      for(let i=0;i<4;i++)rod('brass',0,cover[i],cover[(i+1)%4],.014,.014,6);
      for(let i=0;i<4;i++){
        const u=i*.25,v=(i+1)*.25;
        face('leaf',0,[page(u,0,.018),page(u,1,.018),page(v,1,.018),page(v,0,.018)]);
      }
      const stroke=(a,b,material='ink')=>rod(material,0,page(...a,.026),page(...b,.026),.006,.005,5);
      for(let j=0;j<8;j++){
        const k=(j+.5)*tau/8,l=k+tau/8;
        stroke([.52+.265*Math.sin(k),.62+.19*Math.cos(k)],[.52+.265*Math.sin(l),.62+.19*Math.cos(l)]);
      }
      const sigil=side<0?[[.36,.61],[.49,.77],[.47,.61],[.66,.66],[.48,.46],[.52,.59],[.36,.61]]:
        [[.29,.67],[.47,.61],[.53,.76],[.58,.58],[.73,.68],[.53,.46],[.29,.67]];
      for(let j=1;j<sigil.length;j++)stroke(sigil[j-1],sigil[j],'violet');
      for(const v of [.18,.29])for(const [a,b] of [[.16,.36],[.41,.55],[.6,.81]])stroke([a,v],[b,v+.016]);
    }

    // Three independently sprung tail sections carry the pale tip beyond the racer.
    const tail=[pivots[9],pivots[14],pivots[15],[.54,.91,-.65],[.68,1.015,-.67],[.72,1.105,-.68]];
    rod('darkFur',9,tail[0],tail[1],.080,.129,cut);
    rod('fur',14,tail[1],tail[2],.129,.145,cut);
    rod('ruff',15,tail[2],tail[3],.145,.108,cut);
    rod('ash',15,tail[3],tail[4],.108,.049,cut);
    rod('tip',15,tail[4],tail[5],.049,.004,cut);
    oval('fur',14,tail[1],[.124,.124,.122],0,cut,low?4:6);
    oval('ruff',15,tail[2],[.143,.141,.137],0,cut,low?4:6);
    oval('ash',15,tail[3],[.106,.105,.105],0,cut,low?4:6);
    oval('tip',15,tail[4],[.049,.048,.048],0,cut,4);

    oval('vest',5,[0,.86,-.15],[.253,.284,.205]);
    oval('ruff',5,[0,1.052,-.126],[.215,.166,.196]);
    tuft('ash',5,[0,1.04,.054],[.025,.846,.085],.145,.038);
    for(const side of [-1,1]){
      const arm=side<0?11:12;
      tuft('velvet',5,[side*.214,1.04,-.20],[side*.315,1.245,-.312],.069,.065);
      tuft('hide',13,[side*.18,1.03,-.27],[side*.26,.76,-.474],.119,.055);
      oval('vest',arm,[side*.247,.934,-.030],[.100,.133,.137],-side*.21);
      oval('velvet',arm,[side*.242,.897,.071],[.091,.083,.13],-side*.22);
      oval('pewter',arm,[side*.219,.900,.134],[.073,.065,.046],-side*.17);
      oval('fur',arm,[side*.203,.904,.188],[.064,.052,.078],-side*.13);
      for(let j=0;j<(low?2:3);j++)oval('ash',arm,[side*(.172+j*.028),.902,.241],[.016,.019,.034],-.13,7,4);
    }
    oval('pewter',5,[0,1.001,.100],[.054,.058,.016]);
    face('violet',5,[[-.028,1.003,.121],[0,1.038,.121],[.028,1.003,.121],[0,.967,.121]]);

    // The head tapers from a full ruff into a long, sloping muzzle.
    loft('fur',6,[[-.407,1.328,.034,.062],[-.33,1.350,.189,.193],[-.226,1.355,.258,.228],[-.105,1.35,.257,.221],[.015,1.333,.204,.177],[.109,1.310,.140,.121],[.155,1.27,.084,.076]],low?10:18);
    loft('muzzle',6,[[.021,1.271,.133,.100],[.120,1.255,.140,.088],[.225,1.235,.091,.070],[.315,1.221,.078,.049],[.34,1.223,.049,.035]],cut);
    loft('lips',6,[[.084,1.196,.108,.034],[.153,1.194,.123,.034],[.239,1.188,.094,.027],[.311,1.192,.065,.020]],cut);
    loft('ash',6,[[.054,1.188,.083,.034],[.133,1.170,.105,.040],[.229,1.162,.087,.031],[.299,1.173,.056,.024]],cut);
    oval('nose',6,[0,1.247,.323],[.074,.047,.050]);
    oval('ash',6,[-.022,1.263,.365],[.018,.007,.006],-.18,7,4);
    // A widowed crest follows the muzzle bridge and breaks up the dark crown.
    for(const side of [-1,1]){
      furLock('darkFur',6,[side*.073,1.536,-.111],[side*.018,1.335,.119],.035,.025);
      furLock('ruff',6,[side*.105,1.511,-.103],[side*.088,1.439,.063],.015,.019);
      furLock('darkFur',6,[side*.057,1.538,-.188],[side*.041,1.594,-.286],.056,.038);
    }
    for(const side of [-1,1]){
      const where=(x,y,z)=>[side*x,y,z],ear=side<0?7:8;
      const a=where(.115,1.474,-.138),b=where(.254,1.490,-.154),c=where(.312,1.827,-.228),d=where(.191,1.539,-.260);
      face('darkFur',ear,[a,d,c]);face('ruff',ear,[b,c,d]);face('fur',ear,[a,c,b]);face('darkFur',ear,[a,b,d]);
      face('inner',ear,[where(.148,1.521,-.142),where(.239,1.532,-.153),where(.291,1.762,-.206)]);
      tuft('ash',ear,where(.22,1.527,-.146),where(.25,1.58,-.153),.027,.01);
      for(let j=0;j<3;j++){
        const y=1.392-j*.055,z=-.111+j*.024;
        furLock(j===1?'ruff':'darkFur',6,where(.15,y,z),where(.326+j*.004,y-.062-j*.027,z-.110),.068,.060);
      }
      furLock('ash',6,where(.130,1.282,.065),where(.279,1.235,-.078),.032,.036);
      for(let j=0;j<3;j++){
        const x=.062+j*.055;
        furLock(j%2?'ruff':'darkFur',6,where(x,1.438,-.310),where(x+.040,1.229-j*.014,-.371),.041,.052);
      }
      // The almond-shaped eye faces partly outwards, with the outer corner upturned.
      const eye=(x,y,z)=>where(.135+x*.815+z*.580,1.361+y+.43*x,.125-x*.58+z*.815);
      function almond(mat,w,h,d,offset){
        surface(mat,6,low?10:16,6,(u,v)=>{
          const a=tau*u,b=Math.PI*v,nx=Math.sin(b)*Math.cos(a),ny=Math.cos(b),nz=Math.sin(b)*Math.sin(a);
          return [eye(nx*w,ny*h,offset+nz*d),[side*(nx*.815/w+nz*.580/d),ny/h,-nx*.58/w+nz*.815/d]];
        });
      }
      almond('ruff',.09,.051,.032,-.013);
      almond('nose',.084,.043,.025,0);
      almond('iris',.072,.031,.018,.018);
      almond('eye',.058,.023,.012,.029);
      almond('lips',.010,.022,.005,.040);
      oval('eye',6,eye(-.015,.012,.049),[.007,.007,.004],0,6,4);
      furLock('ruff',6,eye(-.049,.035,-.006),eye(.097,.050,-.021),.024,.020);
      furLock('ash',6,eye(-.051,.040,.015),eye(.077,.052,.002),.011,.007);
      rod('fang',6,where(.099,1.194,.223),where(.104,1.148,.239),.015,.002,7);
      if(!low)for(let j=0;j<3;j++)oval('ruff',6,where(.112-j*.012,1.235-j*.013,.23+j*.035),[.006,.005,.008],0,6,4);
    }
    // A broken silver ear cuff distinguishes his outlined left ear at portrait size.
    ring('pewter',7,[-.269,1.64,-.189],[.026,0,0],[0,.036,-.006],.006,low?9:14);
    return Array.from(mesh.groups.values());
  }
  const up=[0,.943858356,.330350425],scale=220;
  root.AcornGrimoireKart=()=>({
    name:'Grimoire the Vile',groups:build(false),lod:build(true),pivots,rig:{wheelRadius:.29},
    rearCamera:{right:[-1,0,0],up,pixelsPerUnit:[scale,scale]},
    rearPivots:pivots.map(([x,y,z])=>[.5-x*scale/512,.88-(up[1]*y+up[2]*z)*scale/512])
  });
})(typeof globalThis==='object'?globalThis:this);
