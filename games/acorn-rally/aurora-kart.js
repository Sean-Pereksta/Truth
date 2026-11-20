(function (root) {
  'use strict';
  const tau = Math.PI * 2;
  const unit = v => { const length = Math.hypot(...v) || 1; return v.map(value => value / length); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const palette = {
    midnight:'#18233e', enamel:'#25496c', ice:'#589ab6', glow:'#8af4e5', light:'#dcfff8',
    violet:'#535193', dusk:'#372d67', brass:'#be8a4a', gold:'#f0c777', rubber:'#242533',
    tread:'#453f54', snow:'#f0efe8', fur:'#d2dee1', ear:'#c285ab', muzzle:'#fffaf3',
    eye:'#171528', iris:'#642d78', cloth:'#47396f', hem:'#7971bc', strap:'#222333', lamp:'#f47770'
  };
  const pivots = [
    [0,.29,0],[-.568,.29,-.66],[.568,.29,-.66],[-.536,.29,.57],[.536,.29,.57],
    [0,.66,-.16],[0,1.16,-.12],[-.166,1.48,-.13],[.166,1.48,-.13],[0,.80,-.40],
    [0,.90,.24],[-.25,.92,.08],[.25,.92,.08],[0,1.02,-.22],[0,.82,-.46],[0,.83,-.50]
  ];

  function kartMesh(palette, low) {
    const groups = new Map();
    function group(material) {
      if (!groups.has(material)) {
        const hex = palette[material].slice(1);
        groups.set(material,{name:material,color:[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),positions:[],normals:[],rig:[],indices:[]});
      }
      return groups.get(material);
    }
    function surface(material,bone,cols,rows,vertex) {
      const g=group(material),base=g.positions.length/3;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const [p,n]=vertex(i/cols,j/rows);
        g.positions.push(...p);g.normals.push(...unit(n));g.rig.push(bone);
        if(j<rows&&i<cols){const k=base+j*(cols+1)+i;g.indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
      }
    }
    function face(material,bone,positions) {
      const g=group(material),base=g.positions.length/3,[a,b,c]=positions;
      const n=unit(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));
      for(const p of positions){g.positions.push(...p);g.normals.push(...n);g.rig.push(bone);}
      for(let i=1;i<positions.length-1;i++)g.indices.push(base,base+i,base+i+1);
    }
    function oval(material,bone,center,size,tilt=0,segments=low?8:16,rings=low?5:10) {
      const c=Math.cos(tilt),s=Math.sin(tilt);
      const rotate=([x,y,z])=>[x*c-y*s,x*s+y*c,z];
      surface(material,bone,segments,rings,(u,v)=>{
        const a=tau*u,b=Math.PI*v;
        const n=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
        const p=rotate(n.map((t,i)=>t*size[i]));
        return [p.map((t,i)=>t+center[i]),rotate(n.map((t,i)=>t/size[i]))];
      });
    }
    function rod(material,bone,p,q,r0,r1=r0,segments=low?6:10) {
      const d=unit(q.map((v,i)=>v-p[i])),a=unit(cross(d,Math.abs(d[1])<.85?[0,1,0]:[0,0,1])),b=cross(d,a);
      surface(material,bone,segments,1,(u,v)=>{
        const n=a.map((t,i)=>t*Math.cos(u*tau)+b[i]*Math.sin(u*tau)),r=r0+(r1-r0)*v;
        return [n.map((t,i)=>p[i]+(q[i]-p[i])*v+t*r),n];
      });
    }
    function ring(material,bone,center,axisA,axisB,r,segments=low?14:26) {
      const axis=unit(cross(axisA,axisB));
      surface(material,bone,segments,low?5:8,(u,v)=>{
        const ca=Math.cos(u*tau),sa=Math.sin(u*tau),cv=Math.cos(v*tau),sv=Math.sin(v*tau);
        const offset=axisA.map((t,i)=>t*ca+axisB[i]*sa),normal=unit(offset).map((t,i)=>t*cv+axis[i]*sv);
        return [offset.map((t,i)=>center[i]+t+normal[i]*r),normal];
      });
    }
    return {groups, surface, face, oval, rod, ring};
  }
  root.AcornKartMesh = kartMesh;
  function build(low) {
    const {groups, surface, face, oval, rod, ring} = kartMesh(palette, low);
    // A blunt snowplow nose tapers into a low sled and twin ski-shaped side pods.
    const profile=[[-1.04,.14,.35,.07],[-.89,.43,.40,.15],[-.66,.49,.44,.16],[-.25,.45,.45,.18],
      [.18,.42,.42,.15],[.65,.365,.39,.155],[.98,.26,.34,.125],[1.16,.125,.31,.072],[1.19,.04,.31,.03]];
    surface('enamel',0,low?10:20,profile.length-1,(u,v)=>{
      const [z,width,height,rise]=profile[Math.round(v*(profile.length-1))];
      const a=tau*u,c=Math.cos(a),s=Math.sin(a);
      return [[width*c,height+rise*s,z],[c,s,Math.sign(z)*Math.max(0,Math.abs(z)-.68)*1.8]];
    });
    oval('midnight',0,[0,.245,.09],[.42,.11,1.035]);
    oval('dusk',0,[0,.585,-.20],[.34,.098,.36]);
    oval('midnight',0,[0,.66,-.44],[.31,.22,.14]);
    oval('ice',0,[0,.514,.55],[.29,.06,.43]);
    oval('violet',0,[0,.556,.49],[.233,.045,.36]);
    for(const side of [-1,1]){
      let edge=[side*.13,.407,1.17];
      for(const [x,y,z] of [[.25,.444,.98],[.39,.476,.62],[.47,.503,.00],[.49,.523,-.65],[.37,.50,-.94]]){
        const next=[side*x,y,z];rod('brass',0,edge,next,.021);edge=next;
      }
      oval('midnight',0,[side*.425,.39,-.35],[.15,.10,.55]);
      oval('violet',0,[side*.431,.46,-.39],[.14,.094,.53]);
      rod('ice',0,[side*.51,.50,-.87],[side*.54,.515,-.20],.038,.02);
      rod('glow',0,[side*.51,.527,-.84],[side*.54,.534,-.26],.010,.004);
      const x=side*.41,a=[x,.53,-.61],b=[x,.98,-.97],c=[x,.835,-.89],d=[x,.55,-1.013];
      const offset=(p,amount)=>[p[0]+side*amount,p[1],p[2]];
      face('dusk',0,[offset(d,-.04),offset(c,-.04),offset(b,-.04),offset(a,-.04)]);
      face('violet',0,[offset(a,.04),offset(b,.04),offset(c,.04),offset(d,.04)]);
      for(const [p,q] of [[a,b],[b,c],[c,d],[d,a]])face('ice',0,[offset(p,-.04),offset(p,.04),offset(q,.04),offset(q,-.04)]);
      rod('gold',0,offset(a,.042),offset(b,.042),.019,.010);
      rod('glow',0,offset(b,.043),offset(c,.043),.011,.005);
      oval('brass',0,[side*.292,.40,-.961],[.076,.050,.04]);
      oval('lamp',0,[side*.292,.40,-.991],[.050,.031,.019]);
      oval('light',0,[side*.237,.419,1.0],[.072,.028,.032]);
    }
    // Aperture and badge on the rear, with a light strip across the tail.
    rod('brass',0,[-.31,.45,-.945],[.31,.45,-.945],.021);
    oval('midnight',0,[0,.345,-1.009],[.215,.078,.053]);
    oval('ice',0,[0,.348,-1.051],[.142,.053,.021]);
    rod('glow',0,[-.086,.349,-1.072],[.086,.349,-1.072],.010);
    oval('brass',0,[0,.601,.591],[.079,.012,.092]);
    face('glow',0,[[0,.617,.665],[-.038,.618,.59],[0,.617,.52],[.038,.618,.59]]);

    for(let id=1;id<=4;id++){
      const [x,y,z]=pivots[id],side=Math.sign(x);
      rod('brass',0,[x*.5,y,z],[x*.96,y,z],.041);
      ring('rubber',id,[x,y,z],[0,.216,0],[0,0,.216],.073,low?16:32);
      oval('rubber',id,[x,y,z],[.127,.217,.217]);
      oval('brass',id,[x+side*.126,y,z],[.021,.178,.178]);
      oval('midnight',id,[x+side*.139,y,z],[.014,.147,.147]);
      const spokes=low?5:8;
      for(let j=0;j<spokes;j++){
        const angle=tau*j/spokes,p=r=>[x+side*.151,y+r*Math.cos(angle),z+r*Math.sin(angle)];
        rod(j%2?'ice':'gold',id,p(.041),p(.142),.012,.007,5);
      }
      oval('ice',id,[x+side*.154,y,z],[.022,.058,.058],0,low?8:13);
      if(!low)for(let j=0;j<18;j++){
        const angle=tau*j/18,p=(u,a)=>[x+u,y+.287*Math.sin(a),z+.287*Math.cos(a)];
        rod('tread',id,p(-.054,angle-.08),p(0,angle+.03),.008,.009,5);
        rod('tread',id,p(0,angle+.03),p(.054,angle-.08),.009,.008,5);
      }
    }
    rod('brass',0,[0,.54,.27],pivots[10],.029);
    ring('strap',10,pivots[10],[.19,0,0],[0,.14,-.10],.024);
    for(const side of [-1,1])rod('gold',10,pivots[10],[side*.172,.915,.22],.014);

    // Arctic-hare ears, pale fur, tinted racer goggles and an insulated flight jacket.
    oval('cloth',5,[0,.865,-.13],[.262,.285,.22]);
    oval('hem',5,[0,1.058,-.123],[.247,.078,.21]);
    oval('snow',5,[0,1.072,-.093],[.188,.071,.174]);
    rod('gold',5,[0,.69,.058],[0,1.013,.09],.012,.014);
    oval('gold',5,[.03,.946,.097],[.033,.028,.011]);
    oval('cloth',13,[.13,1.007,-.316],[.078,.15,.07],.25);
    oval('dusk',13,[.164,.904,-.404],[.056,.113,.064],.44);
    oval('fur',6,[0,1.307,-.138],[.264,.261,.23]);
    oval('snow',6,[0,1.305,-.105],[.256,.248,.234]);
    oval('muzzle',6,[0,1.193,.041],[.168,.108,.12]);
    for(const side of [-1,1]){
      const ear=side<0?7:8,arm=side<0?11:12;
      oval('fur',ear,[side*.221,1.708,-.128],[.091,.296,.066],-side*.24);
      oval('snow',ear,[side*.222,1.710,-.119],[.085,.282,.066],-side*.24);
      oval('ear',ear,[side*.228,1.726,-.072],[.053,.229,.032],-side*.24);
      oval('dusk',ear,[side*.271,1.913,-.130],[.052,.087,.040],-side*.26);
      oval('muzzle',6,[side*.087,1.202,.096],[.101,.065,.076],-side*.11);
      oval('fur',6,[side*.185,1.248,.023],[.079,.104,.080],side*.34);
      oval('muzzle',6,[side*.125,1.316,.075],[.081,.093,.055],side*.16);
      oval('strap',6,[side*.134,1.324,.110],[.058,.069,.031],side*.16);
      oval('iris',6,[side*.132,1.315,.132],[.043,.052,.018],side*.10);
      oval('eye',6,[side*.131,1.316,.143],[.030,.041,.014]);
      oval('light',6,[side*.131-.012,1.336,.156],[.013,.015,.005],0,8,5);
      oval('dusk',arm,[side*.236,.914,-.044],[.104,.147,.16],side*.24);
      oval('cloth',arm,[side*.245,.917,.027],[.095,.112,.143],side*.28);
      oval('gold',arm,[side*.23,.922,.142],[.058,.044,.035],side*.19);
      oval('snow',arm,[side*.193,.921,.198],[.053,.039,.075],side*.12);
      for(let j=0;j<(low?2:3);j++){
        const p=[side*.129,1.185+j*.018,.149],q=[side*(.234+j*.014),1.16+j*.053,.132];
        rod('fur',6,p,q,.0027,.001,5);
      }
      const gx=side*.111;
      ring('brass',6,[gx,1.479,.016],[.090,-side*.027,0],[0,.033,-.065],.017);
      oval('violet',6,[gx,1.478,.012],[.091,.037,.065],-side*.16);
      rod('ice',6,[gx-.035,1.508,.042],[gx+.023,1.508,.035],.005,.003,5);
    }
    ring('strap',6,[0,1.475,-.136],[.239,0,0],[0,.055,.183],.017);
    rod('brass',6,[-.038,1.499,.006],[.038,1.499,.006],.015);
    oval('iris',6,[0,1.229,.165],[.033,.021,.022]);
    oval('eye',6,[0,1.188,.160],[.039,.008,.009]);
    oval('muzzle',6,[0,1.176,.161],[.024,.014,.011]);
    oval('snow',9,[0,.759,-.444],[.109,.089,.105]);
    return [...groups.values()];
  }

  const scale=230,up=[0,.943858356,.330350425],originY=.879;
  const rearCamera={right:[-1,0,0],up,pixelsPerUnit:[scale,scale]};
  const rearPivots=pivots.map(([x,y,z])=>[.5-x*scale/512,originY-(up[1]*y+up[2]*z)*scale/512]);
  root.AcornAuroraKart=()=>({
    name:'Astra',groups:build(false),lod:build(true),pivots,rig:{wheelRadius:.29},rearCamera,rearPivots
  });
})(typeof globalThis==='object'?globalThis:this);
