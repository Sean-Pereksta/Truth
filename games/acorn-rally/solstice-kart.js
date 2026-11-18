// The Orrery shares the wheel, rider and steering rig used by the original grid.
(function (root) {
  'use strict';
  const tau = Math.PI * 2;
  const unit = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const color = {
    enamel:'#15555a', shade:'#12333a', trim:'#498881', brass:'#ca944d', gilt:'#f4cf78',
    rubber:'#302e33', tread:'#4b4849', leather:'#513b30', feather:'#b07e52',
    umber:'#78563f', ash:'#cfac80', fleck:'#d3af80', dusk:'#916647', cream:'#f4e5c9', white:'#fff5dc',
    eye:'#191c22', lens:'#51473d', scarf:'#16565c', binding:'#f0b454', tailLamp:'#fa713f'
  };
  const pivots = [[0,.29,0],[-.526,.29,-.60],[.526,.29,-.60],[-.526,.29,.63],[.526,.29,.63],
    [0,.67,-.11],[0,1.14,-.13],[-.21,1.40,-.13],[.21,1.40,-.13],[0,.78,-.36],
    [0,.90,.21],[-.23,.92,.06],[.23,.92,.06],[0,1.02,-.22],[0,.80,-.50],[0,.84,-.64]];

  function build(low) {
    const groups = new Map();
    function surface(material,bone,cols,rows,vertex) {
      if (!groups.has(material)) {
        const hex=color[material].slice(1);
        groups.set(material,{name:material,color:[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),positions:[],normals:[],rig:[],indices:[]});
      }
      const g=groups.get(material), base=g.positions.length/3;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const [p,n]=vertex(i/cols,j/rows);g.positions.push(...p);g.normals.push(...unit(n));g.rig.push(bone);
        if(j<rows&&i<cols){const k=base+j*(cols+1)+i;g.indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
      }
    }
    function oval(material,bone,center,size,tilt=0,segments=low?8:15,rings=low?5:9) {
      const c=Math.cos(tilt),s=Math.sin(tilt);
      const rotate=([x,y,z])=>[x*c-y*s,x*s+y*c,z];
      surface(material,bone,segments,rings,(u,v)=>{
        const a=tau*u,b=Math.PI*v,n=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
        const p=rotate(n.map((t,i)=>t*size[i]));
        return [p.map((t,i)=>t+center[i]),rotate(n.map((t,i)=>t/size[i]))];
      });
    }
    function rod(material,bone,p,q,r0,r1=r0,segments=low?5:9) {
      const d=unit(q.map((v,i)=>v-p[i])),a=unit(cross(d,Math.abs(d[1])<.85?[0,1,0]:[0,0,1])),b=cross(d,a);
      surface(material,bone,segments,1,(u,v)=>{
        const n=a.map((t,i)=>t*Math.cos(u*tau)+b[i]*Math.sin(u*tau)),r=r0+(r1-r0)*v;
        return [n.map((t,i)=>p[i]+(q[i]-p[i])*v+t*r),n];
      });
    }
    function loop(material,bone,center,axisA,axisB,r,segments=low?15:28) {
      const axis=unit(cross(axisA,axisB));
      surface(material,bone,segments,low?5:8,(u,v)=>{
        const ca=Math.cos(u*tau),sa=Math.sin(u*tau),cv=Math.cos(v*tau),sv=Math.sin(v*tau);
        const offset=axisA.map((t,i)=>t*ca+axisB[i]*sa),normal=unit(offset).map((t,i)=>t*cv+axis[i]*sv);
        return [offset.map((t,i)=>center[i]+t+normal[i]*r),normal];
      });
    }
    // Tapered shell, gilt body seams, suspension and coachwork.
    oval('shade',0,[0,.30,-.01],[.48,.15,.98]);
    oval('enamel',0,[0,.41,.11],[.47,.19,.92]);
    oval('trim',0,[0,.49,.55],[.32,.14,.47]);
    oval('leather',0,[0,.58,-.18],[.36,.115,.37]);
    oval('shade',0,[0,.63,-.39],[.37,.22,.125]);
    for(const z of [-.60,.63])rod('brass',0,[-.54,.28,z],[.54,.28,z],.052);
    for(const side of [-1,1]){
      const x=side*.45;
      rod('brass',0,[x,.45,-.54],[x,.43,.48],.024);
      rod('gilt',0,[x,.43,.48],[side*.24,.46,.90],.018);
      oval('enamel',0,[side*.46,.49,-.60],[.125,.095,.36]);
      rod('brass',0,[side*.35,.53,-.55],[side*.30,.75,-.62],.043);
      for(let j=0;j<3;j++)oval('brass',0,[side*(.31-j*.025),.532,.56+j*.11],[.075,.016,.018],0,7,4);
    }
    // Rear orbital instrument: brass dial, indexed bezel, inset circular tail lamps.
    loop('brass',0,[0,.84,-.64],[.42,0,0],[0,.38,.035],.034);
    for(let j=0;j<(low?4:12);j++){
      const a=tau*j/(low?4:12);oval('gilt',0,[.42*Math.cos(a),.84+.38*Math.sin(a),-.64+.035*Math.sin(a)],[.027,.027,.028],0,6,4);
    }
    oval('brass',0,[0,.37,-.91],[.255,.095,.055]);
    oval('shade',0,[0,.37,-.956],[.202,.062,.022]);
    for(const side of [-1,1])oval('tailLamp',0,[side*.153,.37,-.969],[.034,.034,.013]);
    oval('brass',0,[0,.633,.59],[.142,.020,.16]);oval('shade',0,[0,.651,.59],[.113,.017,.127]);
    oval('gilt',0,[0,.672,.59],[.045,.013,.051]);
    for(let j=0;j<8;j++){
      const a=j*tau/8,p=r=>[Math.sin(a)*r,.669,.59+Math.cos(a)*r];
      rod('gilt',0,p(.052),p(j%2?.086:.108),.007,.004,5);
    }
    // Wheel radii and roll axes match the shared skid, steering and exposure rig.
    for(let id=1;id<=4;id++){
      const [x,y,z]=pivots[id],side=Math.sign(x);
      loop('rubber',id,[x,y,z],[0,.219,0],[0,0,.219],.073,low?16:30);
      oval('rubber',id,[x,y,z],[.118,.218,.218]);
      oval('brass',id,[x+side*.115,y,z],[.027,.181,.181]);
      oval('shade',id,[x+side*.135,y,z],[.012,.138,.138]);
      for(let j=0;j<(low?4:8);j++){
        const a=j*tau/(low?4:8);
        rod('gilt',id,[x+side*.147,y,z],[x+side*.146,y+.13*Math.sin(a),z+.13*Math.cos(a)],.012,.008,5);
      }
      oval('binding',id,[x+side*.15,y,z],[.027,.058,.058],0,9,6);
      if(!low)for(let j=0;j<16;j++){
        const a=j*tau/16;rod('tread',id,[x-.050,y+.286*Math.sin(a),z+.286*Math.cos(a)],
          [x+.051,y+.286*Math.sin(a+.033),z+.286*Math.cos(a+.033)],.009,.009,5);
      }
    }
    rod('brass',0,[0,.51,.34],[0,.90,.21],.03);
    loop('leather',10,pivots[10],[.19,0,0],[0,.14,-.10],.024,low?12:22);
    for(const side of [-1,1])rod('brass',10,pivots[10],[side*.17,.92,.20],.014);
    // A barn owl's paired facial ruffs taper into a single heart above its beak.
    oval('feather',5,[0,.87,-.15],[.265,.34,.235]);
    oval('cream',5,[0,.88,-.012],[.20,.225,.158]);
    oval('scarf',5,[0,1.06,-.105],[.27,.080,.224]);
    oval('gilt',5,[.035,1.05,.117],[.034,.032,.016]);
    oval('scarf',13,[-.15,.99,-.345],[.084,.13,.061],-.42);
    oval('scarf',13,[-.198,.903,-.37],[.052,.11,.047],-.40);
    oval('feather',6,[0,1.31,-.13],[.34,.32,.278]);
    oval('ash',6,[0,1.31,-.105],[.319,.301,.279]);
    // Hand-laid crescent markings follow the rounded crown and stay flush while
    // the head turns. They are visible from the chase camera as well as in profile.
    const crownRows=low?3:5;
    for(let row=0;row<crownRows;row++){
      const count=low?7:13;
      for(let mark=0;mark<count;mark++){
        const angle=Math.PI*.83+(mark+.28*(row%2))/count*Math.PI*1.32;
        const lat=.47+row*(low?.51:.30)+.035*Math.cos(mark*2.1+row);
        const span=.055+.025*Math.cos(mark*1.7);
        function slash(mat,shift,thickness){
          surface(mat,6,low?3:6,1,(u,v)=>{
            const t=2*u-1,a=angle+t*span,b=lat+shift+.037*(1-t*t)+(v-.5)*thickness*(1-.83*t*t);
            const n=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
            return [[.342*n[0],1.31+.322*n[1],-.13+.281*n[2]],n];
          });
        }
        slash('dusk',0,.029);
        if(!low||mark%2===0)slash('fleck',-.025,.019);
      }
    }
    loop('leather',6,[0,1.479,-.135],[.291,0,0],[0,.052,.232],.023);
    for(const side of [-1,1]){
      const center=[side*.128,1.559,.010];
      loop('brass',6,center,[.100,-side*.026,0],[0,.055,-.066],.017);
      surface('lens',6,low?9:16,4,(u,v)=>{
        const x=.093*Math.cos(tau*u)*v,r=.056*Math.sin(tau*u)*v,bump=.027*(1-v*v);
        return [[center[0]+x,center[1]-side*x*.25+r+bump,center[2]-r*1.18+bump],[x,.7,.7]];
      });
      rod('gilt',6,[side*.117,1.591,-.03],[side*.16,1.578,-.026],.006,.003,5);
    }
    rod('leather',6,[-.042,1.566,.008],[.042,1.566,.008],.02);
    for(const side of [-1,1]){
      oval('umber',6,[side*.132,1.33,.078],[.19,.229,.078],-side*.35);
      oval('cream',6,[side*.129,1.334,.102],[.177,.211,.072],-side*.36);
      oval('white',6,[side*.114,1.32,.139],[.139,.170,.050],-side*.36);
      oval('umber',6,[side*.137,1.357,.177],[.077,.087,.030]);
      oval('eye',6,[side*.137,1.358,.194],[.067,.072,.029]);
      oval('white',6,[side*.137-.014,1.382,.220],[.017,.019,.007],0,7,5);
      // Layered flight feathers make the wings readable from the chase camera.
      const wing=side<0?11:12;
      oval('umber',wing,[side*.236,.902,-.093],[.116,.203,.18],side*.22);
      oval('feather',wing,[side*.257,.924,-.059],[.104,.176,.168],side*.22);
      for(let j=0;j<3;j++){
        oval(j%2?'umber':'ash',wing,[side*(.239+j*.026),.857-j*.019,-.205+j*.052],[.056,.137,.052],side*.26);
      }
      oval('feather',wing,[side*.205,.894,.128],[.079,.06,.136]);
    }
    rod('brass',6,[0,1.292,.181],[0,1.211,.231],.039,.004);
    for(let j=-1;j<=1;j++){
      const end=[j*.095,.70,-.59+Math.abs(j)*.05];
      oval(j===0?'feather':'umber',9,[j*.066,.72,-.43],[.068,.031,.161],j*.13);
      rod('ash',9,[j*.04,.747,-.39],end,.012,.003,5);
    }
    return [...groups.values()];
  }
  // Orthographic bind camera used to render the matching 512 px sprite and joint mask.
  const scale=275.470014, up=[0,.943858356,.330350425];
  const rearCamera={right:[-1,0,0],up,pixelsPerUnit:[scale,scale]};
  const rearPivots=pivots.map(([x,y,z])=>[.50043803-x*scale/512,.85281379-(up[1]*y+up[2]*z)*scale/512]);
  root.AcornSolsticeKart = () => ({
    name:'Solstice',groups:build(false),lod:build(true),pivots,rig:{wheelRadius:.29},rearCamera,rearPivots
  });
})(typeof globalThis==='object'?globalThis:this);
