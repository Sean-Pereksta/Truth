(function (root) {
  'use strict';
  const palette = {
    lapis:'#29456e', blue:'#41698d', shadow:'#202c40', gold:'#d8a653', sun:'#ffdb80',
    cream:'#fff1cb', porcelain:'#ede4cf', pearl:'#d6dded', quill:'#a9b5d1',
    chestnut:'#865036', honey:'#b67b4e', lightFur:'#cd9464', muzzle:'#ecd2a2',
    ear:'#715042', nose:'#382c2a', iris:'#473226', rubber:'#30313a', tread:'#595358',
    leather:'#75493b', garnet:'#ce6f48'
  };
  const pivots = [[0,.29,0],[-.55,.29,-.61],[.55,.29,-.61],[-.53,.29,.6],[.53,.29,.6],
    [0,.69,-.13],[0,1.16,-.13],[-.25,1.52,-.15],[.25,1.52,-.15],[0,.76,-.39],
    [0,.90,.22],[-.25,.92,.04],[.25,.92,.04],[0,1.0,-.26],[-.18,1.06,-.3],[.18,1.06,-.3]];
  function build(low) {
    const {groups, oval, rod, ring, face} = root.AcornKartMesh(palette,low);
    const count = low ? 6 : 10;
    // The chariot has an upswept prow, a low open cockpit and gilded blue wheel guards.
    oval('shadow',0,[0,.33,.04],[.51,.15,1.01]);
    oval('lapis',0,[0,.42,.03],[.51,.19,1.03]);
    oval('blue',0,[0,.50,.58],[.41,.18,.49]);
    oval('gold',0,[0,.63,.65],[.30,.042,.33]);
    oval('lapis',0,[0,.665,.63],[.26,.029,.28]);
    oval('leather',0,[0,.60,-.19],[.34,.12,.35]);
    oval('shadow',0,[0,.67,-.43],[.35,.19,.12]);
    const discZ=.68;
    oval('sun',0,[0,.70,discZ],[.077,.018,.077]);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,point=(r,w)=>[r*Math.sin(angle)+w*Math.cos(angle),.70,discZ+r*Math.cos(angle)-w*Math.sin(angle)];
      face('gold',0,[point(.09,-.022),point(.19,0),point(.09,.022)]);
    }
    for(const side of [-1,1]){
      let from=[side*.18,.47,1.01];
      for(const [x,y,z] of [[.36,.52,.8],[.465,.53,.42],[.505,.55,0],[.45,.64,-.47],[.33,.72,-.82]]){
        const to=[side*x,y,z];rod('gold',0,from,to,.022);from=to;
      }
      oval('porcelain',0,[side*.4,.48,-.52],[.13,.11,.37],side*.15);
      oval('gold',0,[side*.37,.42,-.82],[.082,.072,.077]);
      oval('garnet',0,[side*.37,.43,-.875],[.054,.044,.04]);
      oval('cream',0,[side*.31,.51,.85],[.076,.054,.085]);
    }
    for(let id=1;id<=4;id++){
      const [x,y,z]=pivots[id],side=Math.sign(x);
      rod('shadow',0,[x*.42,y,z],[x,y,z],.048);
      ring('rubber',id,[x,y,z],[0,.216,0],[0,0,.216],.073,low?16:30);
      oval('rubber',id,[x,y,z],[.119,.228,.228]);
      oval('gold',id,[x+side*.112,y,z],[.032,.185,.185]);
      oval('lapis',id,[x+side*.14,y,z],[.012,.155,.155]);
      for(let j=0;j<count;j++){
        const a=j*Math.PI*2/count,p=(r,t)=>[x+side*.155,y+r*Math.cos(t),z+r*Math.sin(t)];
        face('sun',id,[p(.045,a-.40),p(.144,a+.13),p(.059,a+.57)]);
      }
      oval('gold',id,[x+side*.159,y,z],[.024,.058,.058]);
    }
    rod('gold',0,[0,.54,.32],pivots[10],.027);
    ring('leather',10,pivots[10],[.194,0,0],[0,.139,-.096],.024);
    for(const side of [-1,1])rod('gold',10,pivots[10],[side*.171,.919,.205],.013);

    // Round ears, broad honey muzzle, paired cheeks and short heavy paws keep the ursine silhouette.
    oval('honey',5,[0,.88,-.13],[.294,.30,.246]);
    oval('porcelain',5,[0,.89,-.06],[.276,.24,.20]);
    oval('blue',5,[0,1.018,-.11],[.286,.102,.221]);
    oval('gold',5,[0,1.011,.114],[.056,.059,.029]);
    oval('chestnut',6,[0,1.33,-.13],[.308,.282,.247]);
    oval('honey',6,[0,1.332,-.087],[.302,.267,.239]);
    oval('muzzle',6,[0,1.236,.095],[.184,.116,.121]);
    oval('nose',6,[0,1.278,.202],[.082,.056,.047]);
    oval('lightFur',6,[-.026,1.299,.24],[.017,.008,.005]);
    rod('chestnut',6,[0,1.217,.211],[0,1.18,.203],.006,.003);
    for(const side of [-1,1]){
      const ear=side<0?7:8,arm=side<0?11:12;
      oval('chestnut',ear,[side*.25,1.538,-.154],[.108,.108,.074]);
      oval('lightFur',ear,[side*.253,1.541,-.127],[.099,.099,.060]);
      oval('ear',ear,[side*.254,1.54,-.079],[.062,.064,.025]);
      oval('muzzle',6,[side*.083,1.217,.142],[.101,.068,.071]);
      oval('iris',6,[side*.137,1.365,.117],[.043,.051,.034],-side*.09);
      oval('cream',6,[side*.127,1.384,.145],[.012,.014,.006],0,8,5);
      rod('chestnut',6,[side*.099,1.429,.103],[side*.177,1.433,.079],.015,.013);
      oval('lightFur',6,[side*.241,1.279,.004],[.083,.085,.085],side*.32);
      oval('gold',arm,[side*.266,.978,-.02],[.116,.093,.132]);
      oval('honey',arm,[side*.252,.916,.061],[.105,.099,.158],side*.19);
      oval('lightFur',arm,[side*.202,.906,.183],[.081,.064,.084]);
    }
    ring('gold',6,[0,1.823,-.141],[.255,0,0],[0,.022,.204],.021,low?20:36);
    ring('cream',6,[0,1.831,-.141],[.253,0,0],[0,.022,.202],.008,low?20:36);
    // Overlapping flight feathers have a raised shaft, shaded underside and a curved, tapered tip.
    function feather(bone,side,x,y,z,dx,dy,dz,width,material){
      const n=Math.hypot(dx,dy),edgeX=-dy/n,edgeY=dx/n,rows=[];
      for(const [t,w] of [[0,.18],[.25,.72],[.54,1],[.79,.72],[1,0]]){
        const cx=x+dx*t,cy=y+dy*t+.026*Math.sin(Math.PI*t),cz=z+dz*t;
        rows.push([[side*(cx+edgeX*width*w),cy+edgeY*width*w,cz],
          [side*cx,cy,cz-.030*w],[side*(cx-edgeX*width*w),cy-edgeY*width*w,cz]]);
      }
      for(let i=1;i<rows.length;i++){
        const [a,b,c]=rows[i-1],[d,e,f]=rows[i];
        face(material,bone,[a,d,e,b]);face('porcelain',bone,[b,e,f,c]);
        face('pearl',bone,[c,f,d,a]);
      }
      rod('quill',bone,rows[0][1],rows[2][1],.008,.004,5);
    }
    for(const side of [-1,1]){
      const wing=side<0?14:15;
      oval('pearl',wing,[side*.33,1.15,-.30],[.16,.23,.075],-side*.68);
      for(let j=0;j<6;j++){
        const t=j/5;
        feather(wing,side,.235+.19*t,1.24+.12*t,-.34-.03*t,
          .32+.29*t,-.27+.65*t,-.14+.04*t,.072+.012*t,j%2?'cream':'pearl');
      }
      for(let j=0;j<4;j++)feather(wing,side,.21+.064*j,1.15+.038*j,-.40,
        .26+.011*j,.005+.062*j,-.077,.068,'cream');
    }
    return Array.from(groups.values());
  }
  const up=[0,.943858356,.330350425],scale=220;
  root.AcornAngelKart=()=>({
    name:'Aurel', groups:build(false), lod:build(true), pivots, rig:{wheelRadius:.29},
    rearCamera:{right:[-1,0,0],up,pixelsPerUnit:[scale,scale]},
    rearPivots:pivots.map(([x,y,z])=>[.5-x*scale/512,.88-(up[1]*y+up[2]*z)*scale/512])
  });
})(typeof globalThis==='object'?globalThis:this);
