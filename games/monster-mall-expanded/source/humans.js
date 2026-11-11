/* Original articulated adult shoppers. Front +Z; soles at Y=0, eyes Y=1.69. */
const humanModelLibraries = new WeakMap();
export function createHuman(THREE, person = {}) {
  let lib=humanModelLibraries.get(THREE);if(!lib){lib=buildHumanLibrary(THREE);humanModelLibraries.set(THREE,lib);}
  const id=Math.abs(Number(person.id)||0),style=id%3,skin=lib.skin[id%lib.skin.length],hair=lib.hair[(id*3+style)%lib.hair.length];
  const clothes=lib.outfit(person.color||[0x536767,0x794e49,0x536276][style]);
  const group=new THREE.Group();group.name=['Shopper / field jacket','Shopper / knit and bob','Shopper / business casual'][style];
  const body=new THREE.Group();body.name='Body balance';group.add(body);
  const geo=lib.geo;
  function mesh(g,m,parent,name){const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function joint(name,x,y,z,parent){const o=new THREE.Group();o.name=name;o.position.set(x,y,z);parent.add(o);return o;}
  const pelvis=joint('Pelvis',0,.94,0,body);mesh(geo.pelvis,lib.pants,pelvis,'Tailored trousers / waist');
  const torso=joint('Spine / chest',0,.065,0,pelvis);mesh(geo.torso[style],clothes,torso,'Shaped jacket / cloth seams');mesh(geo.shirt[style],lib.shirt,torso,'Shirt, collar and buttons');
  const head=joint('Neck / head',0,.635,.012,torso);mesh(geo.head,skin,head,'Face / ears / nose / eyelids');const eyes=mesh(geo.eyes,lib.eyes,head,'Inset eyes');mesh(geo.hair[style],hair,head,'Hair / brows');
  const brows=[];for(const side of [-1,1]){const brow=mesh(new THREE.BoxGeometry(.044,.0045,.006),hair,head,'Worried brow');brow.position.set(side*.043,.071,.109);brows.push({brow,side});}
  const arms=[],legs=[],armRig=[],legRig=[];
  for(const side of [-1,1]){
    const upper=joint(side<0?'Left shoulder':'Right shoulder',side*.225,.405,0,torso);
    mesh(geo.upperArm,clothes,upper,'Sleeve / upper arm');
    const elbow=joint('Elbow',0,-.295,0,upper);mesh(geo.forearm,clothes,elbow,'Sleeve / forearm');
    const wrist=joint('Wrist',0,-.265,.005,elbow);mesh(geo.hand[side<0?0:1],skin,wrist,'Hand / fingers');
    arms.push(upper);armRig.push({upper,elbow,wrist,side});
    const thigh=joint(side<0?'Left hip':'Right hip',side*.105,-.025,0,pelvis);mesh(geo.thigh,lib.pants,thigh,'Trousers / thigh');
    const knee=joint('Knee',0,-.43,.008,thigh);mesh(geo.shin,lib.pants,knee,'Trousers / shin');
    const ankle=joint('Ankle',0,-.405,.008,knee);mesh(geo.shoe,lib.shoes,ankle,'Shoe / sole / laces');
    legs.push(thigh);legRig.push({thigh,knee,ankle,side});
  }
  const shadow=new THREE.Mesh(geo.shadow,lib.shadow);shadow.name='Contact shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.014;group.add(shadow);
  let oldX,oldZ,speed=0,panic=0,crouch=0;
  const footPoint=new THREE.Vector3(),shoeBounds=geo.shoe.boundingBox||(geo.shoe.computeBoundingBox(),geo.shoe.boundingBox);
  function groundFeet(){group.updateMatrixWorld(true);let bottom=Infinity;for(const leg of legRig)for(const x of [shoeBounds.min.x,shoeBounds.max.x])for(const y of [shoeBounds.min.y,shoeBounds.max.y])for(const z of [shoeBounds.min.z,shoeBounds.max.z]){footPoint.set(x,y,z);leg.ankle.localToWorld(footPoint);group.worldToLocal(footPoint);bottom=Math.min(bottom,footPoint.y);}if(Number.isFinite(bottom))body.position.y+=.008-bottom;}
  function reset(){oldX=oldZ=undefined;speed=panic=crouch=0;body.position.set(0,0,0);body.rotation.set(0,0,0);pelvis.position.y=.94;pelvis.rotation.set(0,0,0);torso.rotation.set(0,0,0);head.rotation.set(0,0,0);for(const a of armRig)for(const joint of [a.upper,a.elbow,a.wrist])joint.rotation.set(0,0,0);for(const l of legRig)for(const joint of [l.thigh,l.knee,l.ankle])joint.rotation.set(0,0,0);eyes.scale.set(1,1,1);for(const{brow,side}of brows){brow.position.y=.071;brow.rotation.z=0;}update(0,{x:0,z:0,phase:0,panic:0,moving:false,grabbed:false},0);oldX=oldZ=undefined;}
  function update(dt,c,time=0){
    const smooth=1-Math.exp(-Math.max(0,Math.min(.1,dt))*10);
    if(oldX!==undefined&&dt>0)speed+=(Math.min(7,Math.hypot(c.x-oldX,c.z-oldZ)/dt)-speed)*smooth;
    oldX=c.x;oldZ=c.z;panic+=(Math.max(0,Math.min(1,Number(c.panic)||0))-panic)*smooth;
    const grabbed=!!c.grabbed||c.grabbedBy!==null&&c.grabbedBy!==undefined;
    if(grabbed)crouch=0;else crouch+=((c.crouching||c.hiding||c.state==='hide'?1:0)-crouch)*smooth;
    const quiet=!!c.hiding||c.state==='hide',stride=grabbed?0:(c.moving===false?0:Math.min(1,speed/1.5))*(1-crouch*.75),phase=(Number.isFinite(c.phase)?c.phase*.50:time*5),run=panic*stride,guard=grabbed?0:Math.max(crouch,panic*(quiet?.85:.7));
    body.position.set(Math.sin(time*19+id)*panic*(quiet?.0008:.002), (Math.abs(Math.sin(phase))*.028+run*Math.abs(Math.sin(phase))*.025)*stride,0);
    body.rotation.z=Math.sin(phase)*.025*stride+Math.sin(time*16+id)*panic*(quiet?.001:.003);
    pelvis.position.y=.94-crouch*.54;
    pelvis.rotation.y=Math.sin(phase)*.065*stride;
    torso.rotation.x=.025+run*.13+crouch*.38+panic*.025+Math.sin(time*(quiet?2.4:3.1)+id)*panic*.007;
    torso.rotation.y=-pelvis.rotation.y*.65;
    head.rotation.x=-run*.08-crouch*.22+Math.sin(time*1.4+id)*.012;
    head.rotation.y=grabbed?Math.sin(time*11)*.22:Math.sin(time*(quiet?.62:1.4)+id)*(.06+panic*(quiet?.07:.16));
    head.rotation.z=grabbed?Math.sin(time*15)*.10:Math.sin(time*.5+id)*.015;
    for(const a of armRig){const wave=Math.sin(phase+(a.side<0?0:Math.PI));a.upper.rotation.set((wave*stride*(.28+run*.5)-run*.10)*(1-guard)-guard*(.78+crouch*.22),-a.side*guard*.10,a.side*(.055+guard*.11));a.elbow.rotation.set((-.10-run*.85-Math.max(0,-wave)*stride*.15)*(1-guard)-guard*1.75,0,0);a.wrist.rotation.set(-.04+guard*.23+Math.sin(time*17+a.side)*panic*(quiet?.008:.018),0,-a.side*guard*.13);if(grabbed){a.elbow.rotation.x=-.55-Math.sin(time*16+a.side)*.42;a.wrist.rotation.x=Math.sin(time*19+a.side)*.18;}}
    for(const l of legRig){const wave=Math.sin(phase+(l.side<0?Math.PI:0));l.thigh.rotation.x=wave*stride*(.30+run*.40)-crouch*1.25;l.thigh.rotation.z=l.side*.015;l.knee.rotation.x=Math.max(0,-wave)*stride*(.26+run*.75)+crouch*2.40;l.ankle.rotation.x=-wave*stride*.11-crouch*1.15;if(grabbed){l.knee.rotation.x=.30+Math.max(0,Math.sin(time*15+l.side))*.9;l.ankle.rotation.x=Math.sin(time*16+l.side)*.2;}}
    eyes.scale.y=1+panic*.32;eyes.position.y=-panic*.011;for(const{brow,side}of brows){brow.position.y=.071+panic*.009;brow.rotation.z=-side*panic*.26;}
    if(!grabbed)groundFeet();
  }
  update(.016,{x:person.x||0,z:person.z||0,phase:person.phase||0,panic:0,moving:false},0);
  return {group,arms,legs,shadow,update,reset,name:group.name};
}

function buildHumanLibrary(THREE){
 const geo={},V=(x,y,z)=>new THREE.Vector3(x,y,z);
 function paint(g,color=0xffffff){const c=new THREE.Color(color),values=new Float32Array(g.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}g.setAttribute('color',new THREE.Float32BufferAttribute(values,3));return g;}
 function move(g,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){return g.applyMatrix4(new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(sx,sy,sz)));}
 function ball(x,y,z,sx,sy,sz,color=0xffffff,n=12,rz=0){return paint(move(new THREE.SphereGeometry(1,n,Math.max(6,Math.round(n*.7))),x,y,z,sx,sy,sz,0,0,rz),color);}
 function merge(parts){const p=[],n=[],u=[],c=[];for(let g of parts){if(g.index)g=g.toNonIndexed();p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);u.push(...g.attributes.uv.array);c.push(...g.attributes.color.array);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeBoundingSphere();return g;}
 function loft(rings,sides=20,color=0xffffff){const p=[],u=[],indices=[];for(let j=0;j<rings.length;j++){const[y,rx,rz,cx=0,cz=0]=rings[j];for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,wrinkle=1+Math.sin(a*5+y*33)*.012;p.push(cx+Math.cos(a)*rx*wrinkle,y,cz+Math.sin(a)*rz*wrinkle);u.push(i/sides,j/(rings.length-1));}}for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;if(rings[0][0]<rings.at(-1)[0])indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(indices);g.computeVertexNormals();return paint(g,color);}
 function tube(points,r=.004,end=r,sections=10,sides=6,color=0xffffff){const path=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),frames=path.computeFrenetFrames(sections,false),p=[],u=[],index=[];for(let j=0;j<=sections;j++){const t=j/sections,center=path.getPointAt(t),radius=r+(end-r)*t;for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,v=center.clone().addScaledVector(frames.normals[j],Math.cos(a)*radius).addScaledVector(frames.binormals[j],Math.sin(a)*radius);p.push(v.x,v.y,v.z);u.push(i/sides,t);}}for(let j=0;j<sections;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(index);g.computeVertexNormals();return paint(g,color);}
 const texSize=128,cloth=new Uint8Array(texSize*texSize*4),pores=new Uint8Array(cloth.length),hairData=new Uint8Array(cloth.length);
 for(let y=0;y<texSize;y++)for(let x=0;x<texSize;x++){const at=(y*texSize+x)*4,n=((x*73+y*151+x*y*13)%97)/97,weave=(x%3===0?-.09:0)+(y%3===0?-.07:0),strand=Math.sin(x*.8+Math.sin(y*.09)*1.7)*.13;for(let k=0;k<3;k++){cloth[at+k]=Math.round(220+n*26+weave*160);pores[at+k]=Math.round(220+n*30+(n>.90?-25:0));hairData[at+k]=Math.round(170+n*35+strand*120);}cloth[at+3]=pores[at+3]=hairData[at+3]=255;}
 function dataTexture(data){const t=new THREE.DataTexture(data,texSize,texSize,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
 const clothMap=dataTexture(cloth),skinMap=dataTexture(pores),hairMap=dataTexture(hairData);
 function mat(color,map,roughness=.8,bumpScale=.002){return new THREE.MeshStandardMaterial({color,map,bumpMap:map,bumpScale,roughness,vertexColors:true,side:THREE.DoubleSide});}
 const skin=[0xb77f60,0x84563f,0xd9ad89,0x694637,0xb78c73,0xc9987d].map(c=>mat(c,skinMap,.67,.0018));
 const hair=[0x242322,0x4c3429,0x81705a,0x343433].map(c=>mat(c,hairMap,.85,.003));
 const shirt=mat(0xbabbb2,clothMap,.9,.002),pants=mat(0x333940,clothMap,.87,.0025),shoes=mat(0x302e2c,null,.69,0);
 const eyes=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.48,vertexColors:true});
 const outfits=new Map();function outfit(color){if(!outfits.has(color))outfits.set(color,mat(color,clothMap,.88,.003));return outfits.get(color);}
 const shadow=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.23,depthWrite:false});

 geo.pelvis=loft([[-.05,.08,.065,0,0],[0,.155,.105,0,0],[.06,.16,.105,0,0],[.11,.14,.095,0,0]],24);
 geo.torso=[];geo.shirt=[];
 for(let style=0;style<3;style++){
  const parts=[loft([[-.005,.15,.10,0,0],[.06,.16,.105,0,0],[.15,.165,.108,0,-.003],[.24,.185,.115,0,-.006],[.33,.205,.12,0,-.009],[.405,.225,.11,0,-.005],[.45,.18,.085,0,0],[.48,.075,.055,0,0]],28)];
  for(const s of [-1,1]){parts.push(tube([[s*.185,.35,.065],[s*.18,.23,.095],[s*.145,.05,.085]],.0025,.0025,12,5,0x9b9f9b));if(style!==1)parts.push(tube([[s*.055,.445,.075],[s*.10,.33,.119],[s*.075,.22,.122]],.007,.004,10,5,0xc1c0b9));}
  if(style!==1){for(const s of [-1,1])parts.push(tube([[s*.10,.13,.10],[s*.12,.09,.102],[s*.17,.09,.09]],.004,.004,8,5,0x89918e));}
  geo.torso.push(merge(parts));
  const shirtParts=[move(new THREE.PlaneGeometry(.075,.24),0,.32,.119),loft([[.445,.066,.047,0,.01],[.49,.071,.045,0,.01],[.515,.06,.045,0,.01]],20)];
  shirtParts[0]=paint(shirtParts[0],style===1?0x77766b:0xffffff);
  for(const s of [-1,1])shirtParts.push(tube([[s*.055,.49,.05],[s*.075,.44,.082],[s*.035,.405,.116]],.007,.004,10,5));
  for(let j=0;j<3;j++)shirtParts.push(ball(0,.27+j*.058,.124,.005,.005,.002,0x777c7b,7));
  geo.shirt.push(merge(shirtParts));
 }
 const headParts=[loft([[-.16,.052,.055,0,.035],[-.12,.075,.073,0,.026],[-.075,.098,.086,0,.014],[-.015,.112,.097,0,.002],[.055,.113,.10,0,-.005],[.12,.104,.09,0,-.013],[.17,.073,.063,0,-.02],[.185,.025,.023,0,-.02],[.19,.002,.002,0,-.02]],32),loft([[-.255,.061,.053,0,0],[-.19,.064,.055,0,0],[-.145,.056,.048,0,.012]],20)];
 for(const s of [-1,1]){
  headParts.push(ball(s*.114,.008,-.003,.018,.036,.020,0xe3b8a4,12));
  headParts.push(ball(s*.116,.008,.012,.008,.024,.007,0xa8786e,10));
  headParts.push(ball(s*.065,-.015,.084,.035,.03,.020,0xffffff,12));
  headParts.push(tube([[s*.019,.041,.105],[s*.041,.047,.111],[s*.065,.039,.103]],.0035,.0025,10,5));
  headParts.push(tube([[s*.020,.035,.105],[s*.043,.028,.110],[s*.064,.035,.103]],.0024,.002,10,5,0xe8c2ae));
 }
 headParts.push(loft([[-.042,.022,.019,0,.113],[-.027,.026,.024,0,.131],[-.012,.017,.027,0,.127],[.03,.011,.013,0,.105],[.055,.006,.006,0,.099]],16));
 headParts.push(tube([[-.031,-.071,.099],[0,-.067,.111],[.031,-.071,.099]],.004,.0032,12,6,0xc7887e));
 headParts.push(tube([[-.029,-.074,.099],[0,-.079,.109],[.029,-.074,.099]],.0034,.0025,12,6,0xce9c8e));
 headParts.push(tube([[-.029,-.073,.105],[0,-.073,.112],[.029,-.073,.105]],.0013,.001,10,5,0x6f4c46));
 geo.head=merge(headParts);
 const eyeParts=[];for(const s of [-1,1]){eyeParts.push(ball(s*.042,.037,.105,.021,.0065,.004,0xc6c3b7,14));eyeParts.push(ball(s*.041,.037,.109,.005,.0052,.0014,0x454134,10));eyeParts.push(ball(s*.041,.037,.110,.0023,.0034,.001,0x141a1a,8));}geo.eyes=merge(eyeParts);
 geo.hair=[];
 for(let style=0;style<3;style++){
  const p=[],u=[],indices=[],sides=32,rings=10;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){
   const a=i/sides*Math.PI*2,front=Math.sin(a),bottom=front>0?.03+front*(style===2?.115:.075):.015+front*.085;
   const maxPhi=Math.acos(bottom/.195),phi=j/rings*maxPhi,r=.5+.5*Math.sin(a*9+phi*4);
   p.push(Math.cos(a)*Math.sin(phi)*(.119+r*.003),Math.cos(phi)*.195+.006,-.02+Math.sin(a)*Math.sin(phi)*(.107+r*.004));u.push(i/sides,j/rings);
  }
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(p,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));cap.setIndex(indices);cap.computeVertexNormals();const parts=[paint(cap)];
  for(const s of [-1,1])parts.push(tube([[s*.018,.067,.103],[s*.043,.071,.108],[s*.069,.063,.097]],.0035,.0022,10,5));
  if(style===1){for(const s of [-1,1])for(let strand=0;strand<4;strand++){const z=-.065+strand*.035;parts.push(tube([[s*.108,.09,z],[s*.124,-.025,z-.008],[s*(.105+strand*.003),-.17,z+.005]],.018,.011,10,6));}}
  if(style===2){parts.push(ball(0,.025,-.126,.055,.067,.035,0xd2cbc0,14));parts.push(tube([[0,.025,-.14],[.012,-.075,-.14],[.018,-.14,-.10]],.025,.013,14,7));}
  geo.hair.push(merge(parts));
 }
 geo.upperArm=loft([[.04,.025,.025,0,0],[.0,.076,.077,0,0],[-.07,.078,.075,0,-.005],[-.16,.065,.061,0,-.005],[-.25,.054,.052,0,0],[-.30,.052,.05,0,0]],24);
 geo.forearm=loft([[.035,.049,.047,0,0],[-.03,.06,.053,0,.005],[-.11,.054,.047,0,.008],[-.20,.042,.038,0,.005],[-.275,.036,.031,0,0]],24);
 geo.hand=[];
 for(const s of [-1,1]){const parts=[loft([[.018,.031,.023,0,0],[-.025,.036,.022,0,.002],[-.072,.038,.020,0,.006],[-.105,.03,.017,0,.007]],18)];for(let f=0;f<4;f++){const x=(f-1.5)*.017,length=.055+(f===1||f===2?.018:0);parts.push(tube([[x,-.085,.007],[x*1.05,-.12,.013],[x*1.02,-.10-length,.027]],.0095,.006,9,6));}parts.push(tube([[s*.028,-.025,.007],[s*.053,-.055,.02],[s*.048,-.098,.035]],.014,.007,10,7));geo.hand.push(merge(parts));}
 geo.thigh=loft([[.035,.06,.065,0,0],[-.015,.089,.094,0,0],[-.10,.09,.095,0,.005],[-.22,.077,.078,0,.003],[-.34,.062,.064,0,0],[-.445,.055,.058,0,.008]],24);
 geo.shin=loft([[.025,.054,.056,0,0],[-.04,.06,.059,0,0],[-.13,.064,.063,0,-.008],[-.24,.051,.049,0,-.008],[-.34,.041,.042,0,0],[-.415,.043,.041,0,.005]],24);
 const shoe=[ball(0,-.035,.055,.054,.052,.115,0xffffff,18),ball(0,-.065,.06,.057,.017,.119,0x72716d,16)];
 for(let j=0;j<3;j++)shoe.push(tube([[-.028,-.003,.045+j*.019],[0,.009,.05+j*.019],[.028,-.003,.045+j*.019]],.0023,.0023,8,5,0x9a9b96));geo.shoe=merge(shoe);geo.shadow=new THREE.CircleGeometry(.29,16);
 return {geo,skin,hair,outfit,shirt,pants,shoes,eyes,shadow};
}

