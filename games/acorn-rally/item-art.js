'use strict';
const colors=['#ffad3f','#eab14d','#97cf42','#d9ac60','#cba9f0','#db9158','#61dece','#ffc36c'];
const descriptions=['Break free of a burr, regain grip and launch with a short blast from the rear wheels.','Aim down a rival’s lane. Sticky amber sap cuts their speed in half and drags on their motor for three seconds.','Plant a prickly burr behind you. Once it opens, it snags a wheel and makes steering sluggish.','Raise a six-second bark shield. Its plates shatter to absorb one incoming item.','Send a widening crosswind through the pack. It shoves each kart out of its lane. Steer into the gust to recover.','Each skip strikes a circle on the road. Catch a rival there or hit them directly to launch them and cut their speed. The strike is wider on stone.','Ride a four-second tailwind. The sustained speed boost helps you close a gap.','Draw in eighth place. Ride a hawk for 15% of a lap, sideswipe nearby rivals, and land at full speed.'];
const TAU=Math.PI*2;
const itemArtTimes=window.AcornSim?.itemTimes||{puff:1.05,pine:1.23};
function meshes(Mesh){
 const nut=new Mesh(),glob=new Mesh(),trap=new Mesh(),puff=new Mesh(),cone=new Mesh(),guard=new Mesh(),wind=new Mesh(),seed=new Mesh(),bounce=new Mesh();
 function hoop(mesh,cy,rx,rz,width,col,count=20){
  for(let j=0;j<count;j++){const a=j/count*TAU,b=(j+1)/count*TAU;mesh.ring([Math.cos(a)*rx,cy,Math.sin(a)*rz],[Math.cos(b)*rx,cy,Math.sin(b)*rz],width,width,col,5)}
 }
 function skin(mesh,rings,colors,sides){
  for(let i=0;i<rings.length-1;i++){
   const [y0,r0]=rings[i],[y1,r1]=rings[i+1];
   for(let j=0;j<sides;j++){const a=j/sides*TAU,b=(j+1)/sides*TAU;
    const p=(u,y,r)=>[Math.cos(u)*r,y,Math.sin(u)*r];
    mesh.quad(p(a,y0,r0),p(a,y1,r1),p(b,y1,r1),p(b,y0,r0),colors[i]);
   }
  }
 }
 skin(nut,[[-.52,.02],[-.40,.20],[-.19,.35],[.14,.40],[.24,.35]],['#e7952c','#e8a437','#f3b547','#d88f31'],14);
 nut.blob(0,.225,0,.436,.175,.436,'#8b5125',12);
 for(let row=0;row<2;row++)for(let j=0;j<13;j++){
  const a=(j+row*.5)*TAU/13,r=.405-row*.065;
  nut.blob(Math.cos(a)*r,.215+row*.10,Math.sin(a)*r,.093,.067,.089,['#b47938','#a76732','#bd8747'][(j+row)%3],6);
 }
 hoop(nut,.145,.408,.408,.018,'#ffe5a9');
 nut.ring([0,.34,0],[.045,.52,-.025],.078,.06,'#724122',8);
 nut.ring([.045,.52,-.025],[.125,.58,-.065],.06,.038,'#9b6834',8);
 const needle=(m,x,y,z,dx,dy,dz,length,col,width)=>m.ring([x,y,z],[x+dx*length,y+dy*length,z+dz*length],width,.006,col,5);
 glob.blob(0,.03,0,.38,.41,.43,'#ffac25',12);glob.blob(-.12,.20,.20,.095,.062,.038,'#fff7bd',8,5);
 glob.blob(-.07,.01,-.38,.19,.16,.28,'#e99b15',7);glob.blob(.14,-.03,-.7,.085,.08,.14,'#ffd24d',7);
 trap.blob(0,0,0,.32,.31,.32,'#638e32',10);
 for(let j=0;j<27;j++){const y=1-(j+.5)*2/27,a=j*2.399963,k=Math.sqrt(1-y*y),x=k*Math.cos(a),z=k*Math.sin(a);
  needle(trap,x*.27,y*.26,z*.27,x,y,z,.25+.035*(j%3),j%2?'#96c949':'#d2e87c',.079)}
 puff.blob(0,0,0,.26,.27,.26,'#af77c7',9);
 for(let j=0;j<19;j++){const y=1-(j+.5)*2/19,a=j*2.399963,k=Math.sqrt(1-y*y),x=k*Math.cos(a),z=k*Math.sin(a);
  const end=[x*.49,y*.49,z*.49];puff.ring([x*.18,y*.18,z*.18],end,.022,.009,'#ecd9f5',4);
  puff.blob(...end,.115,.10,.115,j%3===0?'#f7eff7':'#dfc8ed',6)}
 cone.ring([0,-.45,0],[0,.42,0],.1,.055,'#774626',9);
 for(let j=0;j<6;j++){const t=j/5,r=.30*Math.sin(.14+Math.PI*t*.89)+.03;
  for(let n=0;n<9;n++){const a=(n+j*.44)*TAU/9,position=[Math.cos(a)*r,-.32+t*.64,Math.sin(a)*r];
   const out=[Math.cos(a)*(r+.095),position[1]+.15,Math.sin(a)*(r+.095)];
   cone.ring(position,out,.11,.024,['#9a5e32','#d3914f','#b4753d'][(j+n)%3],6);
  }}
 cone.ring([0,.28,0],[.045,.50,.035],.06,.035,'#6f4427',6);
 for(let i=0;i<8;i++){const a=i*TAU/8,b=a+.58,point=(u,y,r)=>[Math.cos(u)*r,y,Math.sin(u)*r*1.33];
  guard.quad(point(a,-.15,.43),point(a,.1,.46),point(b,.16,.46),point(b,-.15,.43),['#9a643a','#81532e','#b68048'][i%3],2);
  guard.quad(point(a,.10,.46),point(a+.15,.26,.41),point(b-.08,.29,.41),point(b,.16,.46),'#b28254',2);
 }
 hoop(guard,.06,.46,.61,.015,'#e5bb70');hoop(guard,-.09,.44,.586,.011,'#e5bb70');
 for(let i=0;i<8;i++){const a=i*TAU/8,b=a+.45;
  wind.ring([Math.cos(a)*.33,-.05+i*.012,Math.sin(a)*.26],[Math.cos(b)*.34,.02+i*.012,Math.sin(b)*.26],.034,.007,'#7de3d5',5)}
 seed.blob(0,.04,0,.10,.06,.15,'#f8ac39',7,5);
 for(const side of [-1,1]){
  seed.tri([0,.02,.08],[side*.36,.10,-.34],[side*.27,.04,-.39],'#ffcb58',5);
  seed.tri([0,.02,.08],[side*.27,.04,-.39],[side*.06,.03,-.23],'#eea13d',5);
 }
 hoop(bounce,.008,.47,.47,.018,'#efbf72',16);
 const parts={nut,glob,trap,puff,cone,guard,wind,seed,bounce};
 function make(name){const model=new Mesh();parts[name]=model;return model;}
 // Resin has smooth continuous normals, needed for a moving wet reflection.
 function resin(m,x,y,z,rx,ry,rz,rgb,segments=14){
  const steps=8,rgba=rgb.map(c=>c/255);
  function vertex(j,i){
   const a=j*TAU/segments,b=Math.PI*i/steps-Math.PI/2,dx=Math.cos(a)*Math.cos(b),dy=Math.sin(b),dz=Math.sin(a)*Math.cos(b);
   const nx=dx/rx,ny=dy/ry,nz=dz/rz,n=Math.hypot(nx,ny,nz);
   return [x+rx*dx,y+ry*dy,z+rz*dz,nx/n,ny/n,nz/n,...rgba,7];
  }
  for(let i=0;i<steps;i++)for(let j=0;j<segments;j++){
   const a=vertex(j,i),b=vertex(j+1,i),c=vertex(j+1,i+1),d=vertex(j,i+1);
   if(i)m.data.push(...a,...c,...b);if(i<steps-1)m.data.push(...a,...d,...c);
  }
 }
 const coat=make('resinCoat'),drip=make('resinDrip'),wheelBurr=make('snagCluster'),vine=make('snagTendril');
 resin(coat,0,.016,.02,.375,.273,.214,[226,135,24],18);
 resin(coat,-.26,-.025,.015,.205,.166,.157,[246,164,34]);
 resin(coat,.26,-.058,.01,.194,.148,.167,[246,159,31]);
 resin(coat,-.10,-.123,-.045,.146,.213,.168,[239,153,27]);
 resin(coat,.21,-.143,-.04,.107,.144,.11,[252,177,44]);
 resin(coat,-.43,-.101,-.014,.083,.080,.080,[253,187,48],10);
 resin(coat,.39,.106,-.01,.074,.061,.075,[250,175,44],10);
 resin(drip,0,-.045,0,.031,.093,.031,[232,146,31],9);
 resin(drip,0,-.138,0,.056,.076,.054,[248,175,35],10);
 // Nut-brown seed cases and recurved hooks distinguish a rolling snag from a ground trap.
 for(let cluster=0;cluster<3;cluster++){
  const cx=[0,.12,-.14][cluster],cy=[0,-.12,-.08][cluster],cz=[0,.038,.05][cluster],rad=cluster?.12:.20;
  wheelBurr.blob(cx,cy,cz,rad,rad*.86,rad*.86,cluster?'#898e34':'#69922e',9);
  for(let j=0;j<12;j++){
   const h=1-2*(j+.5)/12,a=j*2.3999+cluster,d=Math.sqrt(1-h*h),v=[d*Math.cos(a),h,d*Math.sin(a)];
   const pt=k=>[cx+v[0]*k,cy+v[1]*k,cz+v[2]*k];
   const end=pt(rad*1.68);wheelBurr.ring(pt(rad*.77),end,rad*.22,.009,'#e1e68b',4);
   wheelBurr.ring(end,[end[0]+.02,end[1]-.037,end[2]-.008],.010,.002,'#635834',4);
  }
 }
 for(let n=0;n<2;n++)for(let j=1;j<7;j++){
  const pt=i=>[Math.sin(i*.71+n*.94)*.083,.11-.022*i+.045*Math.sin(i*.9+n),-.125*i];
  vine.ring(pt(j-1),pt(j),.027-.002*j,.024-.002*j,n?'#b8a65d':'#8c8d42',5);
 }
 const gust=make('lateralGust'),impact=make('pineSplinters');
 for(let n=0;n<3;n++){
  const strand=t=>[-1.32+2.84*t,.37+.15*n+.17*Math.sin(t*6+n),-.37+n*.29+.22*Math.sin(t*5.2+n)];
  for(let j=0;j<8;j++){
   const thickness=t=>.006+.05*Math.sin(t*Math.PI)**1.6;
   gust.ring(strand(j/8),strand((j+1)/8),thickness(j/8),thickness((j+1)/8),n===1?'#d6a0ed':'#faedfc',5,5);
  }
 }
 for(let n=0;n<7;n++){
  const a=n*2.3999,root=[Math.cos(a)*.27,.18,Math.sin(a)*.27],end=[Math.cos(a)*(.63+.13*(n%3)),.34+.24*(n%3),Math.sin(a)*.68];
  impact.ring(root,end,.060,.007,n%2?'#cca16d':'#865635',5);
 }
 function ribbon(mesh,centers,widths,edge,core) {
  for(let j=1;j<centers.length;j++){
   const a=centers[j-1],b=centers[j],ra=widths[j-1],rb=widths[j];
   const l=(p,w)=>[p[0]-w,p[1],p[2]],r=(p,w)=>[p[0]+w,p[1],p[2]];
   const c=p=>[p[0],p[1]+.025,p[2]];
   mesh.quad(l(a,ra),l(b,rb),c(b),c(a),edge,5);mesh.quad(c(a),c(b),r(b,rb),r(a,ra),core,5);
  }
 }
 const hawk=make('hawkBody'),hawkWing=make('hawkWing');
 hawk.blob(0,0,0,.29,.32,.70,'#84502f',12);
 hawk.blob(0,-.12,.24,.24,.23,.43,'#e9c797',10);
 hawk.blob(0,.12,.55,.22,.24,.30,'#a66c3c',10);
 hawk.ring([0,.09,.73],[0,-.04,.98],.12,.025,'#edb44b',8,2);
 for(const side of [-1,1]){
  hawk.blob(side*.16,.17,.69,.066,.055,.061,'#241a17',8);
  hawk.ring([side*.15,-.19,.15],[side*.26,-.57,.14],.074,.041,'#c7893b',6,2);
 }
 hawk.tri([-.15,.03,-.44],[.43,.06,-1.24],[-.43,.06,-1.24],'#73452f',5);
 hawkWing.quad([0,0,.32],[1.10,.10,.18],[2.05,.04,-.43],[.16,0,-.46],'#a87343',5);
 for(let i=0;i<7;i++){
  const x=.35+i*.24,z=.04-i*.057;
  hawkWing.tri([x,0,z],[x+.29,.02,z-.16],[x+.51,-.03,z-.71],
   ['#75462f','#915a36','#a56c40'][i%3],5);
 }
 const jets=make('kickJets'),wings=make('kickWings'),air=make('airStream');
 for(const side of [-1,1]){
  ribbon(jets,[[side*.43,.18,-.66],[side*.49,.24,-1.18],[side*.55,.19,-1.8],[side*.72,.16,-2.62]],[.065,.14,.08,0],'#f28a28','#ffcf4d');
  ribbon(jets,[[side*.43,.24,-.74],[side*.49,.28,-1.21],[side*.54,.224,-1.92]],[.024,.066,0],'#ffcc53','#fff4b7');
  const root=[side*.30,.15,-.66],joint=[side*.91,.35,-.96],tip=[side*1.65,.57,-1.79];
  wings.tri(root,joint,[side*.96,.17,-1.37],'#ffb83b',5);
  wings.tri(joint,tip,[side*.96,.17,-1.37],'#ffd96e',5);
  wings.tri([side*.60,.16,-.92],[side*1.01,.14,-1.22],[side*1.52,.24,-1.86],'#ee9824',5);
  wings.ring(root,tip,.046,.004,'#fff1a2',5,5);
  ribbon(air,[[side*.55,.20,-.69],[side*.76,.22,-1.20],[side*.93,.42,-1.78],
    [side*.85,.57,-2.37],[side*.64,.54,-3.05],[side*.51,.33,-3.71],[side*.69,.26,-4.39]],[.025,.048,.063,.046,.042,.028,0],'#51cabb','#bbfff0');
 }
 const leaf=make('gustLeaf');leaf.tri([0,0,-.20],[-.092,.03,.005],[0,.065,.23],'#7cdbb3',5);
 leaf.tri([0,0,-.20],[0,.065,.23],[.08,.015,.025],'#3aaf95',5);
 leaf.ring([0,.023,-.24],[0,.067,.19],.008,.003,'#e0f2b3',4,5);
 const trail=make('honeyThread');
 ribbon(trail,[[0,.02,-.13],[-.02,.025,-.53],[.01,.015,-.94],[-.03,.005,-1.35]],[.118,.085,.040,0],'#dd8426','#ffcf56');
 const drop=make('sapDrop');drop.blob(0,.025,0,.12,.13,.155,'#ed9b27',8,5);
 drop.blob(-.04,.102,.062,.045,.027,.027,'#fff2ab',6,5);
 const splat=make('sapSplat');splat.blob(0,.015,0,.39,.072,.33,'#e29428',11,5);
 for(let j=0;j<9;j++){
  const a=TAU*j/9,r=.37+.12*Math.sin(j*2.63),x=Math.cos(a)*r,z=Math.sin(a)*r;
  splat.ring([0,.027,0],[x,.01,z],.077,.039,'#f2ab39',6,5);
  splat.blob(x,.027,z,.073,.044,.069,j%3?'#f8bb4e':'#ffe098',6,5);
 }
 function mark(name,color,rad,thickness,segments,fill){
  const m=make(name);
  for(let j=0;j<segments;j++){
   const a=j*TAU/segments,b=(j+fill)*TAU/segments, point=(r,t)=>[r*Math.cos(t),0,r*Math.sin(t)];
   m.quad(point(rad,a),point(rad,b),point(rad+thickness,b),point(rad+thickness,a),color,5,[0,1,0]);
  }
  return m;
 }
 mark('burrWarning','#ffcf5a',.74,.075,12,.67);
 mark('burrArmed','#b5e76e',.64,.045,15,.73);
 mark('sapRing','#ffd48a',.54,.035,17,.72);
 mark('pineRing','#ffd38c',.48,.062,14,.83);
 mark('guardFlash','#fbd77d',.78,.055,18,.8);
 const barb=make('burrBarb');barb.ring([0,0,0],[0,.27,0],.052,.003,'#b9d86b',5,5);
 barb.ring([0,.16,0],[.07,.12,.01],.031,.003,'#719646',5);
 const chip=make('barkChip');chip.quad([-.11,-.10,0],[.125,-.12,-.012],[.086,.18,.047],[-.07,.12,.033],'#976039',2);
 chip.tri([-.11,-.10,0],[.086,.18,.047],[-.03,.16,.09],'#dab271',2);
 chip.ring([-.039,-.065,.02],[-.013,.128,.06],.016,.005,'#ebc58c',5);
 // Live bark grain and pale edges give the shell a readable silhouette around the wheels.
 for(let j=0;j<8;j++){
  const a=(j+.23)*TAU/8;
  guard.ring([Math.cos(a)*.453,-.095,Math.sin(a)*.604],[Math.cos(a+.042)*.475,.165,Math.sin(a+.042)*.63],.015,.008,'#e1ad6d',5);
 }
 const floss=make('floss');floss.ring([0,-.094,0],[0,.126,0],.019,.008,'#d9b6df',4,5);
 for(let j=0;j<6;j++){
  const a=j*TAU/6+.1;
  floss.ring([0,.07,0],[Math.cos(a)*.09,.164,Math.sin(a)*.09],.013,.002,'#fff0ff',4,5);
 }
 const cloud=make('cloudPearl');
 cloud.blob(0,0,0,.32,.27,.28,'#d4b5ed',10,5);cloud.blob(-.12,.068,.11,.18,.16,.19,'#ead8f1',8,5);
 const fineStone=make('stoneSpark');
 fineStone.tri([0,.19,0],[.029,0,0],[0,-.14,0],'#ffe9c0',5);fineStone.tri([0,.19,0],[0,-.14,0],[-.03,0,0],'#ffc77a',5);
 fineStone.tri([-.12,0,.008],[0,.035,.008],[.12,0,.008],'#fff1d4',5);
 const soil=make('soilClod');soil.blob(0,0,0,.10,.068,.083,'#ab8361',6);
 const scale=make('coneScale');
 scale.tri([-.075,0,-.09],[.072,.005,-.10],[.013,.082,.17],'#a86134',0);
 scale.tri([.072,.005,-.10],[.091,.081,.071],[.013,.082,.17],'#e3ac71',0);
 const palettes={sapBurst:['#ffad30','#ffe58a'],burrBurst:['#8fcd43','#e2ed91'],guardBurst:['#d8a96a','#fff1b2'],
   puffBurst:['#c599dd','#fce3ff'],pineBurst:['#ce9058','#ffddb1']};
 for(const [name,[mid,tip]] of Object.entries(palettes)){
  const model=make(name);
  for(let j=0;j<9;j++){
   const a=j*TAU/9+.23*(j%2),c=Math.cos(a),s=Math.sin(a),h=.13+.18*(j%3);
   const left=[c*.87-s*.064,h,s*.87+c*.064],right=[c*.87+s*.064,h,s*.87-c*.064];
   const apex=[c*(1.14+.06*(j%2)),h+.24+.07*(j%3),s*(1.14+.06*(j%2))];
   model.tri(left,apex,right,tip,5);
   model.tri([c*.65,h-.09,s*.65],left,right,mid,5);
  }
 }
 return parts;
}

const clamp01=t=>Math.max(0,Math.min(1,t));
function local(p,side=0,up=0,fwd=0) {
 return [p.x+p.nx*side+p.tx*fwd,p.y+up,p.z+p.nz*side+p.tz*fwd];
}
function tilt(ctx,s,x,branch) {
 const a=ctx.sample(s-.6,x,branch),b=ctx.sample(s+.6,x,branch);
 return -Math.atan2(b.y-a.y,Math.hypot(b.x-a.x,b.z-a.z));
}

function drawObject(ctx,o) {
 const p=ctx.sample(o.s,o.x,o.branch),distance=ctx.distance(p);
 if(distance>100)return;
 const stamp=ctx.stamp,yaw=Math.atan2(p.tx,p.tz),age=o.age,key=o.kind,near=distance<(ctx.split?27:46);
 const phase=o.id*.731,spin=age*4+phase;
 if(key===1) {
  const h=o.height??.68;
  stamp('glob',local(p,0,h),yaw,1.08,1,.14*Math.sin(spin));
  if(near){
   stamp('honeyThread',local(p,0,h-.02,-.22),yaw,1,.80,0,0,[1,1,1.4]);
   for(let j=0;j<3;j++){
    const t=(age*3.6+j/3)%1;
    stamp('sapDrop',local(p,Math.sin(phase+j)*t*.13,h-.07*t,-.61-t*1.75),yaw,.21+(1-t)*.42,.72*(1-t));
   }
  }
 } else if(key===2) {
  const armed=o.armed??age>=.55,opening=clamp01(age/.55),beats=Math.sin(age*(armed?4:30));
  const slope=tilt(ctx,o.s,o.x,o.branch);
  stamp(armed?'burrArmed':'burrWarning',local(p,0,.055),yaw,armed?1.30+beats*.045:1.72-opening*.30,armed?.68:.67+.24*beats,0,slope);
  const swell=1+.22*Math.exp(-Math.pow((age-.59)/.105,2));
  stamp('trap',local(p,0,.25),yaw+phase+(armed?0:age*4),swell,1,0,0,armed?[1,1,1]:[.62+.35*opening,.72, .62+.35*opening]);
 } else if(key===4) {
  const radius=o.radius??.68+age*1.28,h=o.height??.71,span=Math.max(.64,radius);
  // A solid seed core anchors the translucent, lateral cotton wisps.
  stamp('puff',local(p,0,h),yaw+spin,.69+.10*Math.sin(spin),1);
  const count=near?5:3;
  for(let j=0;j<count;j++){
   const t=count===1?0:(j/(count-1)*2-1),w=.75+Math.cos(t*1.16)*.49;
   stamp('cloudPearl',local(p,t*span*.78,h+.09*Math.sin(phase+age*5+j),-.17*Math.abs(t)),yaw+spin+j,w,.62-.14*Math.abs(t),.1*j,0,[1.27,1,1]);
  }
  if(near)for(let j=0;j<4;j++){
   const t=(age*1.27+j*.25)%1,side=j%2?1:-1;
   stamp('floss',local(p,side*(.65+span*(.31+.55*t)),h+.36*Math.sin(Math.PI*t),-.31*t),yaw+spin+t*3,.76+.32*t,.82*(1-t),side*t*1.36);
  }
 } else if(key===5) {
  const period=o.bouncePeriod??.42,t=(age%period)/period,hard=period>.45,apex=o.height??(.29+4*t*(1-t)*.68);
  stamp('cone',local(p,0,apex),yaw+spin,.95,1,.32,age*10);
  const predictedTime=period*(1-t), edge=o.edge??p.w,projected=o.x+(o.vx||0)*predictedTime;
  const nextX=projected>edge?2*edge-projected:projected< -edge?-2*edge-projected:projected;
  const ns=o.nextLandingS??o.s+predictedTime*o.v;
  const next=ctx.sample(ns,nextX,o.branch);
  const strikeRadius=o.landingRadius??(hard?1.95:1.55);
  stamp('pineRing',local(next,0,.046),Math.atan2(next.tx,next.tz),strikeRadius/.54,.34+.46*t,0,tilt(ctx,ns,nextX,o.branch));
  if(near&&age>period&&t<.55){
   const touched=o.s-o.v*period*t,base=ctx.sample(touched,o.x-(o.vx||0)*period*t,o.branch);
   stamp('pineRing',local(base,0,.075),Math.atan2(base.tx,base.tz),strikeRadius/.54*(.6+.73*t),.9*(1-t/.55),0,tilt(ctx,touched,o.x,o.branch));
   for(let j=0;j<(ctx.split?3:5);j++){
    const a=phase+j*2.399,r=(.20+t*.98);
    stamp(hard?'stoneSpark':'soilClod',local(base,Math.sin(a)*r,.09+.44*Math.sin(t*Math.PI*1.8),Math.cos(a)*r),yaw+a,.92-t*.56,1-t*1.7,a*.43);
   }
  }
 }
}

function drawRacer(ctx,k,p,yaw,jump,pitch) {
 const stamp=ctx.stamp,distance=ctx.distance(p),near=distance<(ctx.split?26:43),time=ctx.time,seat=k.seat||0;
 const kartYaw=yaw+(k.yaw||0),sn=Math.sin(kartYaw),cs=Math.cos(kartYaw),si=Math.sin(pitch),co=Math.cos(pitch);
 // Offsets are in the kart's sprung-road frame. A hit on a drifting rival stays on that rival.
 function mounted(side,up,forward){const length=si*up+co*forward;return [p.x+cs*side+sn*length,p.y+jump+.037+co*up-si*forward,p.z-sn*side+cs*length];}
 if(k.hawk){
  const {age,duration}=k.hawk,flap=.34*Math.sin(age*17),swoop=3.5*(1-clamp01(age/.31))**2;
  const height=.95+swoop+1.7*clamp01((age-duration+.23)/.23);
  stamp('hawkBody',mounted(0,height,0),kartYaw,1.28);
  stamp('hawkWing',mounted(.21,height+.07,0),kartYaw,1.28,1,flap);
  stamp('hawkWing',mounted(-.21,height+.07,0),kartYaw,1.28,1,-flap,0,[-1,1,1]);
 }
 if(k.guard>0) {
  const edge=k.guard<.7?.79+.16*Math.sin(k.guard*22):.96,open=clamp01((6-k.guard)/.22);
  stamp('guard',mounted(0,.42+.08*open,0),kartYaw,1.46+.73*Math.sin(open*Math.PI*.5),edge,0,pitch);
 }
 if(k.sap>0&&distance<85){
  const side=k.sapSide||1,load=clamp01(k.sap/.74),fresh=clamp01((3.05-k.sap)/.24);
  const wobble=Math.sin(fresh*Math.PI*2)*Math.exp(-fresh*2.7);
  const size=(1.08+.18*wobble)*(.78+.22*load),alpha=load;
  stamp('resinCoat',mounted(side*.285,.59,-.90),kartYaw,size,alpha,side*.17,pitch,[1.15,1,.86]);
  if(distance<40){
   stamp('resinCoat',mounted(side*.59,.36,-.65),kartYaw+side*.74,.62*(.81+.19*load),alpha,side*-.42,pitch);
   for(let i=0;i<(ctx.split?2:3);i++){
    const t=(time*(.64+.08*i)+i*.41+seat*.065)%1,tip=[-.25,.06,.32][i],stretch=.57+t*.74;
    stamp('resinDrip',mounted(side*(.285+tip),.46-(i%2)*.035,-1.016),kartYaw,(.89+.12*i)*size,alpha,0,pitch,[1,stretch,1]);
    if(i===1&&t>.66){const f=(t-.66)/.34;stamp('sapDrop',mounted(side*.22,.30-.29*f*f,-1.04-.2*f),kartYaw,.4*(1-.33*f),alpha*(1-f),0,pitch);}
   }
  }
 }
 if(k.burr>0&&k.slip>0&&distance<58){
  const side=k.burrSide||1,age=1.72-k.burr,fade=clamp01(k.burr/.33),tremble=Math.sin(age*26)*.029;
  stamp('snagCluster',mounted(side*.61,.29+tremble,-.77),kartYaw,1.19,fade,.2*side+tremble,age*3.2);
  if(near){stamp('snagTendril',mounted(side*.55,.24,-.63),kartYaw+.20*Math.sin(age*13),1.14,fade,side*.22,pitch);}
 }
 if(!near)return;
 const launch=k.itemFx>0?clamp01((1.1-k.itemFx)/1.1):1;
 const launchBurst=launch<.54?Math.sin(Math.PI*clamp01(launch/.54)) : 0;
 if(k.boost>0&&k.boostStyle==='seed') {
  const heat=Math.min(1,k.boost*5);
  stamp('kickJets',local(p,0,.03+jump),yaw,1,.82*heat,0,pitch,[1,1,.94+.09*Math.sin(time*39)]);
  if(launchBurst&&k.usedItem===0)
   stamp('kickWings',local(p,0,jump,-.16*launchBurst),yaw,.82+.33*launchBurst,launchBurst,0,pitch);
  if(launchBurst)for(const side of [-1,1]){
   const t=launch/.54;
   stamp('stoneSpark',local(p,side*(.58+t*.37),.16+jump+t*.26,-.77-t*1.66),yaw,1.35*(1-t)+.15,1-t,side*(1.2+t));
  }
 }
 if(k.boost>0&&k.boostStyle==='tailwind') {
  const air=Math.min(1,k.boost*3);
  stamp('airStream',local(p,0,.04+jump),yaw,1,air*.70,.053*Math.sin(time*4+seat),pitch,[1.0,1.0,.91+.09*Math.sin(time*5)]);
  for(let j=0;j<(ctx.split?3:5);j++){
   const t=(time*1.35+j*.211+seat*.07)%1,side=j%2?1:-1;
   const q=ctx.sample(k.s-.75-t*3.6,k.x+side*(.52+.38*Math.sin(t*3.4)+.29*t),k.branch);
   stamp('gustLeaf',local(q,0,.17+.39*Math.sin(Math.PI*t)),yaw+t*6+j,.54+.35*(1-t),air*(1-t*.80),t*4.1,.31*Math.cos(t*6));
  }
 }
 if(k.puff>0){
  const side=k.puffSide||1,t=clamp01(1-k.puff/itemArtTimes.puff);
  stamp('lateralGust',mounted(side*(-.51+t*.95),.15,-.20),kartYaw+(side<0?Math.PI:0),1.25+.24*Math.sin(t*Math.PI),clamp01(k.puff/.25),0,pitch);
 }
 if(k.pine>0){
  const t=clamp01(1-k.pine/itemArtTimes.pine);
  stamp('pineSplinters',mounted(0,.09,-.56),kartYaw,1+t*.58,(1-t)**1.8,0,pitch);
  if(k.air<=0&&!k.fall&&t>.52&&t<.78){
   const landing=(t-.52)/.26;
   const at=k.s-k.v*(t-.52)*itemArtTimes.pine,ground=ctx.sample(at,k.x,k.branch);
   stamp('pineRing',local(ground,0,.065),yaw,1+landing*2.75,(1-landing)*.8,0,tilt(ctx,at,k.x,k.branch));
  }
 }
 if(launchBurst && [1,2,3,4,5].includes(k.usedItem)) {
  const t=launch/.54;
  if(k.usedItem===3)
   stamp('guardFlash',local(p,0,.16+jump),yaw, .72+.90*t,.69*(1-t),0,pitch);
  else if(k.usedItem===2)
   stamp('burrWarning',local(p,0,.11,-.62-.73*t),yaw,.45+.46*t,launchBurst*.57,0,pitch);
  else {
   const seed=k.usedItem===1?'sapDrop':k.usedItem===4?'floss':'stoneSpark';
   for(let j=-1;j<=1;j++)
    stamp(seed,local(p,j*(.15+.39*t),.59+jump+.17*Math.sin(t*Math.PI),.63+.91*t),yaw+j,.57+launchBurst*.48,.85*(1-t),j*.7+t);
  }
 }
 if(!(k.itemHitFx>0))return;
 const hit=clamp01((.8-k.itemHitFx)/.8),fade=1-hit,kind=k.itemHitKind,blocked=k.itemBlocked;
 const side=Math.sign(k.itemHitSide||k.vx||((seat%2)?-1:1)),direction=side*(.18+hit*.71);
 const burst=blocked?'guardBurst':({1:'sapBurst',2:'burrBurst',4:'puffBurst',5:'pineBurst',7:'puffBurst'})[kind];
 if(burst&&hit<.43){
  const t=hit/.43;
  stamp(burst,local(p,0,.47+jump),yaw+seat*.48,.68+t*.93,1-t*t);
 }
 let part,size,count;
 if(blocked){
  stamp('guardFlash',local(p,0,.26+jump),yaw,1.08+hit*1.20,fade*.73,0,pitch);
  part='barkChip';size=1.32;count=7;
 }else if(kind===1) {
  stamp('sapSplat',local(p,side*.45,.68+jump),yaw+.56,.97-(hit*.22),fade*.89,.36*side);
  part='sapDrop';size=1.10;count=7;
 }else if(kind===2) {
  stamp('burrArmed',local(p,0,.10),yaw,.92+hit*1.36,fade*.70,0,pitch);
  part='burrBarb';size=1.15;count=7;
 }else if(kind===4) {
  stamp('cloudPearl',local(p,direction,.71+jump,-.13),yaw+hit,1.47+hit*.4,fade*.76,0,0,[1.4,1,1]);
  part='floss';size=1.23;count=7;
 }else if(kind===5){
  const hard=[2,3,4,5,7].includes(ctx.index)&&!k.branch;
  part=hard?'stoneSpark':'soilClod';size=hard?1.30:1.58;count=7;
 }else return;
 for(let j=0;j<(ctx.split?4:count);j++){
  const a=seat*.82+kind*.71+j*2.399,sp=.67+((j*7+seat)%6)*.095,range=.34+hit*(.83+sp);
  const dx=kind===4&&!blocked?side*(.21+hit*1.6)+Math.sin(a)*.41:Math.sin(a)*range;
  const dy=.18+jump+Math.max(0,.37*(1-hit)+sp*2.93*hit-2.72*hit*hit);
  const debris=kind===5&&!blocked&&j%3===0?'coneScale':part;
  stamp(debris,local(p,dx,dy,Math.cos(a)*range-hit*.32),yaw+a+hit*(3+j*.4),size*(.83+sp*.17)*(1-.42*hit),fade,a+hit*5.5,hit*3.7);
 }
}
function resin2d(g,x,y,r){
 const fill=g.createRadialGradient(x-r*.30,y-r*.46,r*.05,x,y+r*.12,r);
 fill.addColorStop(0,'#fff3a4');fill.addColorStop(.23,'#ffd24e');fill.addColorStop(.56,'#f6a21c');fill.addColorStop(.83,'#cc7618');fill.addColorStop(1,'#985813');
 g.fillStyle=fill;g.beginPath();g.ellipse(x,y,r,r*.84,-.12,0,TAU);g.fill();
 g.fillStyle='#fff5b4';g.beginPath();g.ellipse(x-r*.28,y-r*.40,r*.18,r*.075,-.56,0,TAU);g.fill();
}
function burr2d(g,x,y,r){
 g.fillStyle='#879c3b';g.strokeStyle='#405927';g.lineWidth=.9;g.beginPath();
 for(let j=0;j<30;j++){const a=j*TAU/30,l=j%2?r*.76:r*(1.05+.13*Math.sin(j*3));const px=x+l*Math.cos(a),py=y+l*Math.sin(a);if(j)g.lineTo(px,py);else g.moveTo(px,py);}
 g.closePath();g.stroke();g.fill();g.fillStyle='#d2d879';g.beginPath();g.ellipse(x-r*.18,y-r*.10,r*.49,r*.38,-.5,0,TAU);g.fill();
}
function drawHawk(g,x,y,size,flap=0){
 g.save();g.translate(x,y);g.scale(size,size);
 g.fillStyle='#865332';
 for(const side of [-1,1]){
  g.beginPath();g.moveTo(0,.07);g.quadraticCurveTo(side*.31,-.28-flap,side*.94,-.15-flap);
  g.lineTo(side*.68,.13-flap);g.lineTo(side*.52,.12-flap);g.lineTo(side*.39,.29-flap);
  g.lineTo(side*.26,.22-flap);g.lineTo(0,.33);g.fill();
 }
 g.beginPath();g.ellipse(0,.11,.22,.34,0,0,TAU);g.fill();
 g.fillStyle='#f1d4a4';g.beginPath();g.ellipse(0,-.09,.16,.17,0,0,TAU);g.fill();
 g.fillStyle='#efac39';g.beginPath();g.moveTo(-.082,-.09);g.lineTo(.082,-.09);g.lineTo(0,.075);g.fill();
 g.restore();
}
function drawKart2d(g,k,point,dim,time,foreground){
 if(dim<4)return;
 if(k.hawk&&foreground){
  const swoop=1-clamp01(k.hawk.age/.31);
  drawHawk(g,point.x,point.y-dim*(1.07+2*swoop*swoop),dim*.85,.12*Math.sin(k.hawk.age*17));
 }
 const sap=k.sap>0,burr=k.burr>0&&k.slip>0,puff=k.puff>0,cone=k.pine>0,boost=k.boost>0&&['seed','tailwind'].includes(k.boostStyle),guard=k.guard>0;
 if(!sap&&!burr&&!puff&&!cone&&!boost&&!guard&&!(k.itemHitFx>0&&k.itemBlocked))return;
 g.save();g.translate(point.x,point.y);g.scale(dim/100,dim/100);g.lineCap='round';g.lineJoin='round';
 if(!foreground){
  if(boost){
   const tail=k.boostStyle==='tailwind',t=time*(tail?5:31);g.strokeStyle=tail?'#9ff1dc':'#ffb333';g.fillStyle=tail?'#82d9b6':'#ffce54';
   for(const s of [-1,1]){g.lineWidth=tail?2.1:4;g.beginPath();g.moveTo(s*23,-10);
    if(tail)g.bezierCurveTo(s*57,-2+4*Math.sin(t),s*17,9,s*(38+4*Math.sin(t)),21);else g.lineTo(s*(32+3*Math.sin(t)),12);
    g.stroke();if(!tail){g.beginPath();g.moveTo(s*22,-11);g.lineTo(s*43,2);g.lineTo(s*31,5);g.closePath();g.fill();}
   }
  }
  if(guard){g.strokeStyle='#825330';g.lineWidth=6;g.beginPath();g.ellipse(0,-19,47,12,0,Math.PI,TAU);g.stroke();}
 }else{
  if(sap){
   const s=-(k.sapSide||1),load=clamp01(k.sap/.74);g.save();g.globalAlpha=load;g.translate(s*14,-22);g.scale(s,1);
   resin2d(g,-8,0,8);resin2d(g,12,3,8);resin2d(g,1,0,13);resin2d(g,19,6,4.5);
   for(let i=0;i<3;i++){const wob=(time*.81+i*.35)%1,x=-7+i*9.3,y=4+(i%2)*.6,reach=2.5+wob*4.8;
    g.strokeStyle='#e99d26';g.lineWidth=2.6;g.beginPath();g.moveTo(x,y);g.lineTo(x,y+reach);g.stroke();resin2d(g,x,y+reach,2.4);}
   g.restore();
  }
  if(burr){const s=-(k.burrSide||1);g.globalAlpha=clamp01(k.burr/.33);g.strokeStyle='#9e9957';g.lineWidth=1.65;g.beginPath();g.moveTo(s*31,-12);g.quadraticCurveTo(s*38,-1,s*(34+Math.sin(time*14)*3),2.5);g.stroke();burr2d(g,s*31,-14+Math.sin(time*24),9.5);g.globalAlpha=1;}
  if(guard){g.strokeStyle='#8e6037';g.lineWidth=6;g.beginPath();g.ellipse(0,-19,47,12,0,0,Math.PI);g.stroke();g.strokeStyle='#efc47f';g.lineWidth=1.3;g.stroke();}
  if(k.itemBlocked&&k.itemHitFx>0){const t=1-k.itemHitFx/.8;g.globalAlpha=1-t;for(let i=0;i<7;i++){
   const a=i*2.399,r=33+t*26;g.save();g.translate(Math.cos(a)*r,-19+Math.sin(a)*r*.43-8*Math.sin(Math.PI*t));g.rotate(a+t*5);g.fillStyle=i%2?'#a97541':'#e4b16c';g.fillRect(-1.8,-3.1,3.6,6.2);g.restore();}g.globalAlpha=1;}
  if(puff){const s=-(k.puffSide||1),t=clamp01(1-k.puff/itemArtTimes.puff);g.globalAlpha=clamp01(k.puff/.25);g.lineWidth=2.6;g.strokeStyle='#e5c3f4';
   for(let i=0;i<5;i++){const x=s*(21+t*23+i*2);g.beginPath();g.moveTo(x-s*12,-18-i*3);g.quadraticCurveTo(x,-19-i*4,x+s*8,-17-i*4);g.stroke();}g.globalAlpha=1;}
  if(cone){const t=clamp01(1-k.pine/itemArtTimes.pine);g.globalAlpha=1-t;for(let i=0;i<7;i++){const a=i*2.399;g.save();g.translate(Math.cos(a)*(24+t*38),-10-Math.abs(Math.sin(a))*(9+t*27));g.rotate(a+t*5);g.fillStyle=i%2?'#e7b47b':'#a76f3e';g.fillRect(-1,-3,2,6);g.restore();}}
 }
 g.restore();
}
function drawObject2d(g,o,pt){
 const h=o.kind===2?.23:o.height||.68;g.save();g.translate(pt.x,pt.y-h*pt.k);g.scale(pt.k/38,pt.k/38);
 if(o.kind===1){g.strokeStyle='#efb146';g.lineWidth=6;g.lineCap='round';g.beginPath();g.moveTo(1,2);g.lineTo(-3,13);g.stroke();resin2d(g,0,0,15);}
 if(o.kind===2){g.strokeStyle=o.armed?'#afcc64':'#ffc453';g.lineWidth=1.6;g.beginPath();g.ellipse(0,9,30,8,0,0,TAU);g.stroke();burr2d(g,0,0,o.armed?14:10);}
 if(o.kind===4){const radius=(o.radius||.6)*31;g.fillStyle='#d5bce4be';for(let i=-2;i<3;i++){g.beginPath();g.ellipse(i*radius*.36,-Math.sin(o.age*5+i)*2,11,9,0,0,TAU);g.fill();}
  g.fillStyle='#f8eafa';g.beginPath();g.arc(0,0,5,0,TAU);g.fill();}
 if(o.kind===5){g.rotate(o.age*9);g.fillStyle='#8d552d';g.beginPath();g.ellipse(0,0,11,16,0,0,TAU);g.fill();for(let i=0;i<9;i++){g.fillStyle=i%2?'#da9e5f':'#ab764b';g.beginPath();const x=(i%3-1)*5,y=(Math.floor(i/3)-1)*8;g.ellipse(x,y,4.6,3.1,-.4,0,TAU);g.fill();}}
 g.restore();
}
window.AcornItemArt={colors,descriptions,drawHawk,meshes,drawObject,drawRacer,drawKart2d,drawObject2d};
