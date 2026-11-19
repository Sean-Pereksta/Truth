(function(root){
  'use strict';

  const tau=2*Math.PI,emissive=5,stone=23;
  const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
  const move=(p,x,y,z)=>[p[0]+x,p[1]+y,p[2]+z];
  const lavaColors=['#514147','#685254','#503e47','#765652','#635155','#493a42'];
  const warmColors=['#aa5240','#c46a43','#e17e44','#fba55b'];
  const titanSite={position:[-27,-4,29],size:10.85};
  const pick=(colors,index)=>colors[((index%colors.length)+colors.length)%colors.length];

  function rock(m,center,radii,sides,id,hot=false){
    const rows=sides<8?[[-.96,.34],[-.48,.82],[.25,1],[.97,.37]]:[[-.96,.34],[-.62,.76],[.07,1],[.59,.76],[.97,.37]];
    const rim=(j,i,offset=0)=>{
      const angle=j/sides*tau+(i%2)*.22+id*.76;
      const [h,r]=rows[i],bump=r*(.98+.10*Math.sin(j*4.9+i*3.1+id));
      return move(center,Math.cos(angle)*(radii[0]*bump+offset),
        radii[1]*(h+.063*Math.sin(j*6.71+i*3.15+id)),Math.sin(angle)*(radii[2]*bump+offset));
    };
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<sides;j++){
      const a=rim(j,i),b=rim(j+1,i),c=rim(j+1,i+1),d=rim(j,i+1);
      m.tri(a,d,c,pick(lavaColors,j+2*i+id),stone);
      m.tri(a,c,b,pick(lavaColors,j+i+id+1),stone);
      if(!hot||(j+i+id)%(sides<8?4:3)!==0)continue;
      const l=rim(j,i,.038),r=rim(j+1,i,.038),upper=rim(j,i+1,.038),edge=rim(j+1,i+1,.038);
      const centerline=(v,u)=>mix(mix(l,r,u),mix(upper,edge,u),v);
      const ribbon=(v1,u1,v2,u2,w,color)=>m.quad(centerline(v1,u1-w),centerline(v2,u2-w),
        centerline(v2,u2+w),centerline(v1,u1+w),color,emissive);
      const w=.027+.012*((i+id)%3);
      ribbon(.03,.077,.57,.18,w,'#ab5036');
      ribbon(.56,.178,.98,.101,w*.68,'#f28c4d');
    }
    for(let j=0;j<sides;j++){
      m.tri(move(center,0,radii[1],0),rim(j+1,rows.length-1),rim(j,rows.length-1),pick(lavaColors,j+id+3),stone);
      m.tri(move(center,0,-radii[1],0),rim(j,0),rim(j+1,0),pick(lavaColors,j+id),stone);
    }
  }

  function vein(m,points,thickness,sides){
    for(let i=1;i<points.length;i++){
      const t=i/(points.length-1),a=points[i-1],b=points[i];
      if(sides<6){
        const dx=b[0]-a[0],dy=b[1]-a[1],w=thickness/(Math.hypot(dx,dy)||1);
        const d=[dy*w,-dx*w,.023];
        m.quad(move(a,-d[0],-d[1],d[2]),move(b,-d[0],-d[1],d[2]),move(b,d[0],d[1],d[2]),move(a,d[0],d[1],d[2]),pick(warmColors,i),emissive);
        continue;
      }
      m.ring(a,b,thickness*(1-t*.28),thickness*(.94-t*.44),pick(warmColors,i),sides,emissive);
      m.ring(move(a,0,0,.021),move(b,0,0,.021),thickness*.36,thickness*.25,'#ffce6f',sides,emissive);
    }
  }

  function groundRings(m,style,simple){
    const sides=simple?18:36,ice=style==='beam';
    const disk=(r,a,y)=>[r*Math.cos(a),y,r*Math.sin(a)];
    for(let j=0;j<sides;j++){
      const t=j*tau/sides,next=(j+1)*tau/sides;
      for(const [r,w,y] of [[.98,.062,.028],[.78,.038,.011],[.51,.025,.016]]){
        if(r<.9&&(j%5===0||j%5===1))continue;
        const col=ice?(r>.9?'#8eeefb':'#76a5ff'):(r>.9?'#ff9861':'#ffce80');
        m.quad(disk(r,t,y),disk(r-w,t,y),disk(r-w,next,y),disk(r,next,y),col,emissive,[0,1,0]);
      }
      if(j%3!==0)continue;
      const col=ice?'#d7faff':'#ffe7a3',a=t+.036,b=t-.036;
      m.tri(disk(.92,a,.032),disk(.74,t,.041),disk(.92,b,.032),col,emissive,[0,1,0]);
    }
  }

  function titan(parts,simple){
    const stance=parts('lavaTitanStance'),torso=parts('lavaTitan'),head=parts('lavaTitanHead'),jaw=parts('lavaTitanJaw');
    const low=simple?5:8,large=simple?7:12;
    rock(stance,[0,-.12,0],[2.34,.31,1.80],large,30,true);
    for(const side of [-1,1]){
      rock(stance,[side*.95,.43,.44],[.86,.43,.84],large,side+2,true);
      rock(stance,[side*.95,.99,.01],[.78,.67,.64],large,side+3,true);
      if(!simple)for(let i=0;i<3;i++)rock(stance,[side*.95+(i-1)*.36,.18,1.03],[.24,.17,.30],low,i+9);
      rock(torso,[side*1.38,1.43,.13],[.83,.60,.73],large,side+8,true);
      rock(torso,[side*.75,1.03,.81],[.66,.53,.35],large,side+13,true);
      const crest=[[side*.31,1.87,-.43],[side*.54,2.88,-.74],[side*.64,1.79,-.85]];
      torso.tri(crest[0],crest[1],crest[2],'#6b5050',stone);
      torso.tri(crest[0],move(crest[1],0,.052,.116),crest[2],'#b35f43',stone);
      torso.ring([side*.91,1.28,-.61],[side*1.29,2.45,-.86],.247,.024,'#78564e',low,stone);
      vein(torso,[[side*.39,.12,-.99],[side*.55,.57,-1.07],[side*.23,.90,-1.08],[side*.51,1.51,-.86]],.05,low);
    }
    rock(torso,[0,.28,-.14],[1.36,.9,1.03],large,4,true);
    rock(torso,[0,1.23,.06],[1.54,1.0,1.08],large,9,true);
    // Magma shows through broken armor at the breast and joints.
    torso.blob(0,1.12,1.04,.27,.37,.13,'#ed7a45',large,emissive);
    torso.blob(.02,1.14,1.15,.139,.235,.085,'#ffbc61',large,emissive);
    vein(torso,[[.04,1.44,1.07],[-.16,1.65,1.02],[-.09,1.91,.74],[.18,2.06,.53]],.062,low);
    vein(torso,[[.00,1.00,1.12],[.24,.82,1.09],[.18,.64,1.03],[.37,.51,.87]],.069,low);
    vein(torso,[[-1.22,1.57,.70],[-.97,1.48,1.05],[-.76,1.21,1.13],[-.53,1.14,1.11]],.035,low);
    vein(torso,[[.56,1.14,1.11],[.91,1.22,1.09],[1.10,1.41,.93],[1.31,1.53,.75]],.042,low);

    rock(head,[0,.27,.06],[.73,.53,.62],large,2,true);
    rock(head,[0,.69,.30],[.94,.53,.73],large,17,true);
    for(const side of [-1,1]){
      rock(head,[side*.68,.56,.56],[.34,.44,.54],low,side+10);
      const feature=[side*.52,.68,.92];
      head.blob(...feature,.225,.118,.066,'#442d34',large);
      head.blob(...move(feature,-side*.022,.013,.047),.175,.072,.055,'#ff9841',large,emissive);
      head.blob(...move(feature,-side*.039,.014,.088),.099,.040,.021,'#ffe292',large,emissive);
      rock(head,[side*.54,.804,.883],[.37,.16,.19],low,side+8);
      const tip=[side*.79,1.60,.01],heel=[side*.69,.93,.25];
      head.ring(heel,tip,.231,.028,'#665157',large,stone);
      head.ring(mix(heel,tip,.56),move(tip,0,.031,.012),.10,.005,'#eb864e',low,emissive);
      vein(head,[[side*.72,.90,.67],[side*.46,1.076,.64],[side*.33,1.164,.39],[side*.10,1.185,.38]],.032,low);
    }
    head.blob(0,.354,.76,.562,.192,.27,'#30232b',large);
    head.blob(0,.377,.942,.415,.133,.128,'#9d3c32',large,emissive);
    head.blob(0,.377,1.006,.32,.081,.085,'#dc6037',large,emissive);
    for(let i=0;i<5;i++){
      const x=(i-2)*.188,s=.12+.025*(i%2);
      head.ring([x,.47,1.044-.012*Math.abs(i-2)],[x*.94,.47-s,1.056],.059,.006,'#c18b67',low,stone);
    }
    rock(jaw,[0,-.042,.367],[.62,.192,.43],large,18,true);
    jaw.blob(0,.063,.326,.495,.063,.34,'#be5736',large,emissive);
    for(const side of [-1,1])for(let i=0;i<2;i++){
      const x=side*(.25+i*.184),z=.652-i*.133;
      jaw.ring([x,.064,z],[x*.92,.227-i*.04,z+.04],.070,.005,'#bb8866',low,stone);
    }
    for(const side of [-1,1]){
      const left=side<0,arm=parts(left?'lavaTitanArmL':'lavaTitanArmR'),fist=parts(left?'lavaTitanFistL':'lavaTitanFistR');
      rock(arm,[side*.14,-.23,.04],[.56,.62,.51],large,side+10,true);
      rock(arm,[side*.23,-.77,.10],[.43,.41,.43],large,side+13,true);
      vein(arm,[[side*.20,-.07,.46],[side*.34,-.38,.39],[side*.18,-.57,.46],[side*.27,-.87,.43]],.051,low);
      rock(fist,[side*.06,-.32,.08],[.45,.55,.43],large,side+14,true);
      rock(fist,[side*.15,-.81,.19],[.52,.45,.49],large,side+5,true);
      vein(fist,[[side*.01,-.10,.37],[side*.18,-.31,.46],[side*.08,-.54,.49],[side*.25,-.83,.57]],.052,low);
      for(let i=0;i<3;i++)rock(fist,[(i-1)*.24+side*.13,-1.13+i*.04,.25+i*.075],[.152,.25,.173],low,i+7,true);
    }
  }

  function lathe(m,profile,sides){
    const edge=([y,r],j)=>[r*Math.cos(j*tau/sides),y,r*Math.sin(j*tau/sides)];
    for(let i=1;i<profile.length;i++)for(let j=0;j<sides;j++){
      const [y,r,col,material=0]=profile[i],a=profile[i-1],b=profile[i];
      const shade=Array.isArray(col)?pick(col,j):col;
      const l=edge(a,j),right=edge(a,j+1),upper=edge(b,j),other=edge(b,j+1);
      if(a[1]===0)m.tri(l,upper,other,shade,material);
      else if(r===0)m.tri(l,upper,right,shade,material);
      else m.quad(l,upper,other,right,shade,material);
    }
  }

  function saucer(parts,simple){
    const craft=parts('ufoSaucer'),glass=parts('ufoCanopy'),lights=parts('ufoRimLights');
    const n=simple?16:40,small=simple?4:8;
    lathe(craft,[[-.56,0],[-.58,.34,'#596a9b'],[-.46,.63,'#6979a0'],[-.36,.95,'#3c4868'],[-.21,1.68,['#5b6489','#626d94','#7281a1']],
      [-.112,2.055,'#546485'],[.025,2.14,'#778bb0'],[.107,2.09,'#9da9c5'],[.164,1.96,'#667899'],[.241,1.73,'#9baec6'],
      [.31,1.5,['#7a8ba9','#859ab4','#8da1b6']],[.43,1.24,'#b0c0ce'],[.456,1.12,'#4a5379'],[.419,.95,'#645a79'],[.419,0,'#474761']],n);
    const rimPos=(a,r,y)=>[Math.cos(a)*r,y,Math.sin(a)*r];
    const lamps=simple?12:16;
    for(let j=0;j<lamps;j++){
      const a=j*tau/lamps,b=a+.17,center=(a+b)*.5;
      const color=j%4===0?'#b8edec':j%4===2?'#78b8fa':'#e1aaff';
      const socket=rimPos(center,2.074,.060);
      craft.box(...socket,.25,.058,.14,Math.PI*.5-center,'#526384');
      lights.quad(rimPos(a,2.10,.028),rimPos(a,2.10,.067),rimPos(b,2.10,.067),rimPos(b,2.10,.028),color,emissive);
      if(j%2===0&&!simple){
        const strut=(r,y)=>rimPos(center,r,y);
        craft.ring(strut(1.29,.427),strut(1.75,.274),.027,.028,'#60758f',small);
        craft.ring(strut(1.74,.275),strut(1.98,.176),.018,.021,'#a9b8c6',small);
      }
    }
    lathe(craft,[[-.555,0],[-.566,.22,'#a5dcfa',emissive],[-.560,.29,'#91bff2',emissive],[-.531,.39,'#5a72a4'],[-.48,.465,'#687f9f']],n);
    const seats=['#505379','#605277'];
    for(const side of [-1,1]){
      craft.blob(side*.54,.451,.018,.36,.11,.43,seats[side<0?0:1],small);
      craft.blob(side*.55,.691,-.277,.305,.31,.14,seats[side<0?0:1],small);
      craft.ring([side*.98,.442,.13],[side*.88,.745,-.18],.055,.050,'#a3b6ca',small);
      craft.ring([side*.89,.74,-.18],[side*.76,.934,-.565],.050,.043,'#a3b6ca',small);
      craft.ring([side*1.02,.454,.407],[side*.85,.648,.8],.041,.037,'#a5b5ca',small);
      const joint=[side*.84,.68,.81],top=[side*.86,1.234,.33];
      craft.ring(joint,top,.034,.031,'#88a4b9',small);
      glass.quad(joint,[side*1.012,.485,.419],[side*.94,.95,.147],top,'#91cbe4',22);
    }
    craft.ring([-.83,.78,.75],[.83,.78,.75],.052,.052,'#a6bcce',small);
    craft.box(0,.465,.782,1.57,.115,.31,0,'#565c80');
    for(let i=0;i<7;i++){
      const x=(i-3)*.165;
      craft.blob(x,.609,.83,.056,.018,.063,i%3?'#86e6ee':'#f3a9d7',small,emissive);
    }
    const cockpitArc=(a,z)=>[Math.cos(a)*.93,.53+Math.sin(a)*1.015,z+(1-Math.sin(a))*.07];
    for(let j=0;j<(simple?7:12);j++){
      const count=simple?7:12,a=Math.PI*j/count,b=Math.PI*(j+1)/count;
      craft.ring(cockpitArc(a,-.51),cockpitArc(b,-.51),.036,.036,'#a1b7c8',small);
      glass.quad(cockpitArc(a,-.66),cockpitArc(b,-.66),cockpitArc(b,-.54),cockpitArc(a,-.54),'#a8baf5',22);
    }
    craft.ring([-.79,.646,-.74],[.79,.646,-.74],.073,.073,'#777eaa',small);
    for(const side of [-1,1]){
      craft.ring([side*.82,.549,-.89],[side*.83,1.15,-.94],.026,.013,'#778bbc',small);
      craft.blob(side*.83,1.157,-.94,.056,.049,.052,'#bad9fd',small,emissive);
    }
  }

  function alien(m,violet,simple){
    const sides=simple?6:13,small=simple?4:9;
    const skin=violet?'#b477cd':'#8abe78',light=violet?'#d59fe6':'#abdc83';
    const contour=violet?'#8055a3':'#60945e';
    const suit=violet?'#507891':'#5b5794',trim=violet?'#bee7a3':'#b7b7f5';
    for(const side of [-1,1]){
      if(!simple){
        m.blob(side*.104,.067,.19,.094,.063,.139,'#526381',small);
        m.ring([side*.09,.09,.087],[side*.106,.232,-.029],.08,.072,suit,small);
      }
      const b=[side*.15,.316,.006],elbow=[side*.216,.248,.061],hand=[side*.209,.31,.26];
      m.ring(b,elbow,.071,.065,suit,small);
      m.ring(elbow,hand,.068,.040,suit,small);
      m.blob(...hand,.052,.048,.070,light,small);
      if(!simple)for(let j=0;j<3;j++)m.ring(move(hand,(j-1)*.026,.014,.03),move(hand,(j-1)*.031,.008,.101-(j%2)*.014),.013,.010,light,5);
    }
    m.blob(0,.265,-.026,.18,.188,.141,suit,sides);
    m.ring([0,.355,.016],[0,.418,.016],.105,.125,trim,small);
    m.blob(0,.272,.108,.099,.073,.023,trim,small,emissive);
    if(!simple)m.blob(0,.272,.129,.040,.038,.009,'#8296ce',small);
    m.blob(0,.472,.021,.101,.090,.098,skin,small);
    m.blob(0,.654,.032,violet?.261:.248,violet?.259:.241,.199,skin,sides);
    m.blob(0,.538,.146,.162,.113,.12,light,sides);
    for(const side of [-1,1]){
      const eye=[side*.111,.658,.183];
      m.blob(...move(eye,side*.025,.002,-.003),.109,.140,.067,contour,sides,0,side*.135);
      m.blob(...move(eye,side*.031,.010,.039),.078,.106,.054,violet?'#4a314f':'#283d48',sides,0,side*.165);
      m.blob(...move(eye,side*.027-.020,.048,.083),.026,.032,.015,'#f5e3f1',small,emissive);
      if(!simple)m.blob(...move(eye,side*.032+.018,-.024,.085),.013,.018,.008,'#c0c6da',6,emissive);
      m.ring([side*.065,.554,.241],[side*.111,.575,.234],.010,.007,contour,small);
      if(violet){
        m.blob(side*.249,.636,-.016,.082,.13,.057,'#9a6abd',small);
        m.blob(side*.300,.661,.025,.043,.058,.037,'#df9ce0',small);
      }else if(!simple){
        for(let j=0;j<3;j++)m.blob(side*(.17+.023*j),.539+.027*(j%2),.204-j*.012,.019,.014,.012,'#719747',small);
      }
      const root=[side*(violet?.102:.145),.799,-.008],mid=[side*(violet?.097:.168),.946,-.045],tip=[side*(violet?.084:.206),violet?1.106:1.026,-.030];
      m.ring(root,mid,.028,.019,contour,small);
      m.ring(mid,tip,.021,.013,skin,small);
      m.blob(...tip,.049,.055,.049,violet?'#d8a8ec':'#bbec9a',small,emissive);
    }
    m.blob(0,.547,.242,.081,.024,.017,contour,small);
    if(!simple)m.blob(.011,.541,.252,.035,.012,.010,violet?'#b374b8':'#97bf78',small);
  }

  function projectiles(parts,simple){
    const fire=parts('lavaFireball'),ember=parts('lavaEmber'),beam=parts('ufoBeam'),frost=parts('ufoSpark');
    const n=simple?10:21,small=simple?5:8;
    fire.blob(0,0,.027,.887,.887,.887,'#e85a2c',n,emissive);
    fire.blob(0,0,.25,.722,.729,.652,'#ff8d37',n,emissive);
    fire.blob(.034,.012,.56,.423,.442,.402,'#fac96d',small,emissive);
    const flutter=['#f26933','#ffa246','#ffbc56','#d5482e'];
    for(let i=0;i<(simple?8:15);i++){
      const a=i*2.399,t=(i*.382)%1;
      const curve=(k,edge)=>{
        const spin=a+.78*k+edge*(.17+.04*Math.sin(i));
        const rad=.86*(.74+.26*Math.sin(Math.PI*k))*(1-.37*k);
        const z=.486-1.63*k+.21*t*Math.sin(Math.PI*k);
        return [Math.cos(spin)*rad,Math.sin(spin)*rad,z];
      };
      for(let j=0;j<4;j++){
        const u=j/4,v=(j+1)/4;
        if(j===3)fire.tri(curve(u,-1),curve(u,1),curve(v,0),pick(flutter,i+j),emissive);
        else fire.quad(curve(u,-1),curve(u,1),curve(v,1),curve(v,-1),pick(flutter,i+j),emissive);
      }
    }
    ember.ring([0,-.18,.02],[.046,.19,-.04],.13,.058,'#ff9e50',small,emissive);
    ember.ring([.046,.19,-.04],[.013,.323,-.079],.061,.005,'#ffd58a',small,emissive);
    ember.ring([-.058,-.04,.069],[-.08,.102,.092],.062,.043,'#d76134',small,emissive);

    const rays=simple?14:26,beamColors=['#77c2f6','#a1e8fa','#917bd9','#92dcef'];
    const raysPath=(a,t,mult=1)=>{
      const r=(.147+.853*t**.87)*mult;
      return [Math.cos(a)*r,-t,Math.sin(a)*r];
    };
    for(let j=0;j<rays;j++){
      const a=j*tau/rays,b=(j+1)*tau/rays;
      beam.quad(raysPath(a,0),raysPath(a,.39),raysPath(b,.39),raysPath(b,0),pick(beamColors,j),emissive);
      beam.quad(raysPath(a,.39),raysPath(a,1),raysPath(b,1),raysPath(b,.39),pick(beamColors,j+1),emissive);
      if(j%2===0){
        const t=a+.068,inner=a+.032;
        beam.quad(raysPath(t,.035,1.01),raysPath(t,.969,1.009),raysPath(inner,.969,1.009),raysPath(inner,.035,1.01),'#b4edfd',emissive);
      }
      if(j%3===0){
        const t=.82+.055*Math.sin(j*3.71);
        beam.tri(raysPath(a+.033,t-.027,1.015),raysPath(a+.146,t,1.015),raysPath(a+.072,t+.034,1.015),'#c6eff1',emissive);
      }
    }
    for(let j=0;j<6;j++){
      const a=j*tau/6,end=[Math.cos(a)*.55,.021,Math.sin(a)*.55];
      if(simple){
        frost.tri([-.037*Math.sin(a),.015,.037*Math.cos(a)],end,[.037*Math.sin(a),.015,-.037*Math.cos(a)],'#bcf2fe',emissive,[0,1,0]);
        continue;
      }
      frost.ring([0,0,0],end,.045,.021,'#bcf2fe',small,emissive);
      for(const off of [-.47,.47]){
        const tip=[Math.cos(a+off)*.54,.019,Math.sin(a+off)*.54],joint=mix([0,0,0],end,.63);
        frost.ring(joint,tip,.025,.014,'#93c7ef',small,emissive);
      }
    }
    frost.blob(0,.018,0,.133,.071,.137,'#defafa',small,emissive);
  }

  root.AcornCosmicHazardsArt={titanSite,meshes(Mesh,simple=false){
    const result={},part=name=>(result[name]=new Mesh());
    titan(part,simple);
    saucer(part,simple);
    alien(part('ufoAlienGreen'),false,simple);
    alien(part('ufoAlienViolet'),true,simple);
    groundRings(part('lavaShockwave'),'fire',simple);
    groundRings(part('ufoGroundRings'),'beam',simple);
    projectiles(part,simple);
    return result;
  }};
})(typeof globalThis==='object'?globalThis:this);
