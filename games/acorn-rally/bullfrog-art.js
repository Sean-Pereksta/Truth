(function(root){
  'use strict';

  const tau=2*Math.PI;
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const gain=(color,f)=>color.map(v=>Math.min(1,v*f));
  const unit=vec=>{const l=Math.hypot(...vec)||1;return vec.map(v=>v/l);};
  const skin=[.31,.40,.19],dorsal=[.36,.49,.23],flank=[.54,.55,.29],belly=[.71,.66,.42];
  const frame=[
    [-.83,.34,.023,.039,.041],[-.73,.348,.23,.14,.155],[-.52,.364,.385,.198,.205],
    [-.27,.391,.47,.236,.256],[-.02,.419,.491,.235,.274],[.19,.433,.455,.224,.248],
    [.39,.454,.462,.194,.228],[.58,.432,.444,.178,.184],[.72,.403,.368,.139,.13],
    [.82,.389,.26,.093,.082],[.874,.388,.107,.051,.044],[.884,.389,.019,.019,.019]
  ];
  const profilePoint=([z,y,r,top,bottom],a,offset=0)=>{
    const t=Math.sin(a);
    return [Math.cos(a)*(r+offset),y+t*((t>0?top:bottom)+offset),z];
  };

  function bodySurface(loft,segments,z,a){
    let end=1;
    while(end<loft.length-1&&loft[end][0]<z)end++;
    const t=(z-loft[end-1][0])/(loft[end][0]-loft[end-1][0]);
    const ring=mix(loft[end-1],loft[end],t),sector=a*segments/tau,section=Math.floor(sector);
    return mix(profilePoint(ring,section*tau/segments,.006),profilePoint(ring,(section+1)*tau/segments,.006),sector-section);
  }

  function ellipsoid(m,xyz,radii,cols,rows,paint,mat=0){
    const coord=(j,i)=>{
      const lat=Math.PI*(i/rows-.5),lon=tau*j/cols,c=Math.cos(lat);
      return [c*Math.cos(lon),Math.sin(lat),c*Math.sin(lon)];
    };
    const point=v=>v.map((v,i)=>xyz[i]+v*radii[i]);
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const a=coord(j,i),b=coord(j,i+1),c=coord(j+1,i+1),d=coord(j+1,i);
      const n=unit(a.map((n,k)=>(n+b[k]+c[k]+d[k])/radii[k]));
      const co=typeof paint==='function'?paint(n,j,i):paint;
      if(i===0)m.tri(point(a),point(b),point(c),co,mat,n);
      else if(i===rows-1)m.tri(point(a),point(b),point(d),co,mat,n);
      else m.quad(point(a),point(b),point(c),point(d),co,mat,n);
    }
  }

  function ridgeline(m,points,radius,color,sides){
    for(let i=1;i<points.length;i++){
      const r=j=>radius*(.58+.42*Math.sin(Math.PI*j/(points.length-1)));
      m.ring(points[i-1],points[i],r(i-1),r(i),color,sides);
    }
  }

  // Each limb starts at its socket, with its next joint one unit forward.
  function limb(m,profile,sides,col){
    for(let i=1;i<profile.length;i++)for(let j=0;j<sides;j++){
      const a=tau*j/sides,b=tau*(j+1)/sides;
      const p=([z,x,y,lift],angle)=>[x*Math.cos(angle),lift+y*Math.sin(angle),z];
      const n=unit([Math.cos((a+b)*.5),Math.sin((a+b)*.5),0]);
      const c=mix(col,belly,Math.max(0,-n[1])*.39);
      m.quad(p(profile[i-1],a),p(profile[i-1],b),p(profile[i],b),p(profile[i],a),c,0,n);
    }
  }

  function meshes(Mesh,simple=false){
    const parts={};
    const part=name=>(parts[name]=new Mesh());
    const body=part('bullfrogBody');
    const throat=part('bullfrogThroat');
    const eyes=part('bullfrogEyes');
    const lids=part('bullfrogLids');
    const fore=part('bullfrogForelimb');
    const thigh=part('bullfrogThigh');
    const shin=part('bullfrogShin');
    const foot=part('bullfrogFoot');
    const around=simple?10:26,slim=simple?5:10,detail=simple?5:9;
    const loft=simple?frame.filter((_,i)=>i%2===0||i===frame.length-1):frame;

    for(let i=1;i<loft.length;i++)for(let j=0;j<around;j++){
      const a=tau*j/around,b=tau*(j+1)/around,t=Math.sin((a+b)*.5);
      let col=t<-.21?mix(flank,belly,-t):mix(flank,dorsal,Math.max(0,(t+.20)/1.20));
      col=gain(col,1+.059*Math.sin(j*7.1+i*5.23)+.037*Math.sin(i*8.47+j*5.12));
      const before=loft[i-1],after=loft[i];
      const normal=unit([Math.cos((a+b)*.5),t*1.7,(before[2]-after[2])/(after[0]-before[0])*.64]);
      body.quad(profilePoint(before,a),profilePoint(before,b),profilePoint(after,b),profilePoint(after,a),col,0,normal);
    }

    const cheek=[[.451,.394,.502],[.426,.373,.606],[.379,.349,.723],[.268,.333,.822],[.144,.348,.863],[0,.354,.884]];
    for(const side of [-1,1]){
      const mirrored=list=>list.map(([x,y,z])=>[side*x,y,z]);
      ridgeline(body,mirrored(cheek),.019,'#37432c',simple?4:6);
      if(!simple){
        ridgeline(body,mirrored(cheek.map(([x,y,z])=>[x*1.003,y-.021,z+.004])),.014,'#9b945b',5);
        ridgeline(body,mirrored([[.325,.691,.46],[.401,.675,.375],[.449,.603,.277],[.474,.547,.172],[.48,.491,.023]]),.029,'#75874f',6);
      }
      // The external eardrum and raised eye mound give the face its bullfrog profile.
      ellipsoid(body,[side*.45,.499,.242],[.047,.107,.121],simple?7:12,simple?4:7,
        n=>gain([.41,.39,.235],.84+.28*n[1]));
      ellipsoid(body,[side*.475,.501,.247],[.031,.078,.086],simple?6:10,simple?3:6,'#5a5a36');
      ellipsoid(body,[side*.321,.661,.446],[.166,.126,.158],slim,simple?4:7,n=>mix(skin,dorsal,Math.max(0,n[1])));
      ellipsoid(body,[side*.142,.464,.831],[.034,.017,.029],detail,4,'#3d462d');
      if(!simple)ellipsoid(body,[side*.142,.471,.822],[.044,.017,.024],detail,5,'#8b995f');

      ellipsoid(eyes,[side*.323,.693,.471],[.143,.141,.133],simple?7:16,simple?4:9,'#a7854d');
      ellipsoid(eyes,[side*.331,.699,.554],[.116,.106,.065],simple?8:18,simple?4:9,
        (n,j)=>gain([.73,.438,.14],.83+.24*Math.max(0,n[1])+.17*Math.sin(j*5.8)));
      ellipsoid(eyes,[side*.337,.705,.609],[.093,.045,.030],simple?7:16,simple?3:8,'#1f2119');
      ellipsoid(eyes,[side*.337-.034,.729,.634],[.028,.021,.013],detail,simple?4:6,'#ffe5a1',5);
      if(!simple)ellipsoid(eyes,[side*.341+.025,.688,.635],[.011,.008,.010],6,4,'#d7bc79',5);
      ellipsoid(lids,[side*.323,.697,.477],[.144,.143,.139],slim,simple?5:10,n=>mix(skin,dorsal,Math.max(0,n[1])));
      ridgeline(lids,mirrored([[.224,.683,.577],[.271,.660,.610],[.337,.659,.626],[.402,.676,.591],[.424,.697,.543]]),.012,'#4b5b32',simple?4:6);
    }

    // Mottling follows the actual loft so it never floats above the skin.
    const spots=simple?11:38,patches=simple?4:7;
    for(let j=0;j<spots;j++){
      const a=.22+((j*.6180339887)%1)*2.67,z=-.72+((j*.4142135624)%1)*1.43;
      const r=.017+.036*((j*.73531)%1),c=['#3e5030','#4e5f33','#566d3a','#778b4d'][j%4];
      const p=bodySurface(loft,around,z,a);
      const tip=i=>{
        const b=tau*i/patches,edge=r*(.75+.24*Math.sin(i*5.4+j*3.61));
        return bodySurface(loft,around,z+Math.cos(b)*edge,a+Math.sin(b)*edge*2.6);
      };
      for(let i=0;i<patches;i++)body.tri(p,tip(i+1),tip(i),c,0,unit([Math.cos(a),Math.sin(a)*1.8,0]));
    }

    ellipsoid(throat,[0,0,0],[.348,.195,.254],simple?9:20,simple?5:10,
      n=>mix([.68,.60,.32],[.78,.71,.45],Math.max(0,n[1]+.22)));
    if(!simple)for(const z of [-.02,.073,.145]){
      const arc=[-.23,-.13,0,.13,.23].map(x=>[x,-.153+x*x*.5+(z*z)*.62,z]);
      ridgeline(throat,arc,.009,'#b8a465',5);
    }

    limb(fore,[[0,.080,.071,0],[.25,.108,.075,.02],[.55,.087,.073,.018],[1,.047,.041,0]],slim,dorsal);
    limb(thigh,[[0,.120,.115,0],[.21,.191,.153,.017],[.47,.208,.172,.033],[.73,.152,.137,.021],[1,.085,.077,0]],slim,[.32,.45,.245]);
    limb(shin,[[0,.084,.082,0],[.33,.106,.086,.017],[.67,.076,.066,.016],[1,.052,.050,0]],slim,skin);
    if(!simple)for(const x of [-.1,.1]){
      ridgeline(thigh,[[x*.67,.112,.17],[x,.168,.33],[x*.86,.172,.53],[x*.66,.117,.74]],.013,'#697f47',5);
    }

    ellipsoid(foot,[0,.025,.077],[.081,.032,.092],slim,simple?4:6,dorsal);
    const toes=[[-.16,.018,.233],[-.107,.015,.305],[0,.011,.34],[.105,.016,.292],[.157,.020,.205]];
    for(let i=0;i<toes.length;i++){
      const point=toes[i],base=[(i-2)*.029,.031,.118];
      foot.ring(base,point,.027,.014,'#7e9858',simple?4:6);
      if(!simple)ellipsoid(foot,point,[.021,.019,.027],detail,4,'#a1a863');
      if(i>0){
        const before=toes[i-1],half=mix(point,before,.5),gap=[half[0]*.95,.014,half[2]*.87];
        foot.tri(base,before,gap,'#7b8f55',0,[0,1,0]);
        foot.tri(base,gap,point,'#7b8f55',0,[0,1,0]);
      }
    }
    return parts;
  }

  root.AcornBullfrogArt={meshes};
})(typeof globalThis==='object'?globalThis:this);
