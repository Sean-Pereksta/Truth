/* Monster Mall: After Hours. Game and art © 2026. Three.js MIT, bundled below. */
(async()=>{'use strict';
let realHumansReady=false;
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),TAU=Math.PI*2;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x020407);scene.fog=new THREE.FogExp2(0x030709,.039);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.06,110);camera.rotation.order='YXZ';
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'});}catch(e){$('start').disabled=true;$('start').textContent='WEBGL UNAVAILABLE';document.querySelector('.intro').textContent='This game needs a browser with hardware graphics enabled. Open it in Chrome or Edge and enable graphics acceleration.';return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.localClippingEnabled=true;
const sound=createAudio(),obstacles=[],flickers=[],lights=[],shopCenters=[],interactables=[],civilMeshes=new Map(),monsterMeshes=new Map(),effects=[],bloodStains=[],bloodRipples=[],bloodFlows=new Map();
let mode='title',elapsed=0,last=performance.now(),sim,frame=0,toastTime=0,flashTime=0,damageTime=0,powered=false,fuseTotal=0,quality='high',mapVisible=true,gentle=false,danger=0,lookSensitivity=1.8,sprintLatched=false,captureState=null,footfallImpulse=0,footCaptionClock=0;
const prefs={sensitivity:1.8,moveSpeed:1,fov:78,volume:.65,brightness:1,quality:'high',toggleSprint:false,invertY:false,headBob:true,screenShake:true,subtitles:true,reduced:false};
const STAIRS=[{x:-6.7,bottomZ:-13.5,topZ:-23.5,y:4.4},{x:6.7,bottomZ:-13.5,topZ:-23.5,y:4.4}];
let player={x:0,y:0,z:54,yaw:0,pitch:0,health:100,stamina:1,alive:true,hiding:false,noise:0,flashes:3,flashlight:true,crouching:false};
const keys=new Set(),touch={x:0,y:0,run:false};
let difficulty='normal';try{const saved=localStorage.getItem('monsterMallDifficultyV3');if(Object.hasOwn(MALL_DIFFICULTIES,saved))difficulty=saved;}catch{}
let objectives=createEscapeObjectives(difficulty),pad={moveX:0,moveY:0,lookX:0,lookY:0,sprint:false,active:false,connected:false};
const difficultyProfile=()=>MALL_DIFFICULTIES[difficulty];
function syncEscapeGate(){const open=objectives.canEscape(powered);if(sim.exitOpen!==open)sim.setExitOpen(open);}
function taskEnabled(item){return !item.taskId||objectives.tasks.some(t=>t.id===item.taskId);}
function refreshObjectives(){
 const remaining=objectives.remaining,ready=objectives.canEscape(powered);
 $('difficultyBadge').textContent=difficultyProfile().name.toUpperCase();
 $('objectiveTag').textContent=ready?'ESCAPE / ALL LOCKS RELEASED':!powered?'01 / RESTORE POWER':'02 / RELEASE THE EXIT';
 $('objectiveTitle').textContent=ready?'Reach the main exit':!powered?(fuseTotal===3?'Restore power at security':'Find the three emergency fuses'):'Complete the remaining escape tasks';
 $('objectiveDetail').textContent=ready?'South end. Use the main doors to escape.':!powered?(fuseTotal===3?'Security panel · far north end.':'Hollow Records · east stockroom · upper west gallery.'):(remaining[0]?.location||'');
 $('taskChecklist').replaceChildren(...objectives.tasks.map(t=>{const row=document.createElement('li');row.className=t.done?'complete':'';row.textContent=(t.done?'✓ ':'□ ')+t.name+(t.id==='crank'&&objectives.hasCrank&&!t.done?' (crank found)':'');return row;}));
 $('taskProgress').textContent=(objectives.tasks.length-remaining.length)+' / '+objectives.tasks.length+' EXTRA TASKS';
}
function syncDifficultyMenu(){const profile=difficultyProfile();$('difficulty').value=difficulty;$('difficultyDescription').textContent=profile.description;$('difficultyTasks').textContent='Also required: '+MALL_TASKS.slice(0,profile.tier).map(t=>t.name.toLowerCase()).join(' · ');}

function material(color,roughness=.7,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
const mats={wall:material(0x313c3d),plaster:material(0x656b60),dark:material(0x111d22),metal:material(0x455251,.36,.8),black:material(0x090f12,.65,.2),wood:material(0x4e392b,.8),leather:material(0x263a32),brass:material(0x8f7450,.34,.75),cream:material(0x9a9c83),red:material(0x66352d),paper:material(0xb8b6a0),glass:new THREE.MeshStandardMaterial({color:0x88bfc0,roughness:.15,metalness:.2,transparent:true,opacity:.13,depthWrite:false}),glow:new THREE.MeshBasicMaterial({color:0xabcaba}),water:new THREE.MeshStandardMaterial({color:0x183537,roughness:.12,metalness:.7,transparent:true,opacity:.8})};
const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.SphereGeometry(1,12,9),cylGeo=new THREE.CylinderGeometry(1,1,1,12);
function box(x,y,z,w,h,d,mat=mats.wall,collision=false,parent=scene){const m=new THREE.Mesh(boxGeo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(collision)obstacles.push({x,z,w,d,low:y-h/2,high:y+h/2,transparent:!!(mat.transparent&&mat.opacity<.5)});return m;}
function sphere(x,y,z,sx,sy,sz,mat,parent=scene){const m=new THREE.Mesh(sphereGeo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
function cylinder(x,y,z,r,h,mat,parent=scene,rTop=r){const geo=rTop===r?cylGeo:new THREE.CylinderGeometry(rTop/r,1,1,10);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function hitsBox(x,z,r,o){const ax=Math.max(o.x-o.w/2,Math.min(x,o.x+o.w/2)),az=Math.max(o.z-o.d/2,Math.min(z,o.z+o.d/2));return(x-ax)**2+(z-az)**2<r*r;}
function collides(x,z,r=.3){if(Math.abs(x)>42.65-r||Math.abs(z)>58.65-r)return true;for(const o of obstacles){if((o.low||0)>1.8)continue;if(hitsBox(x,z,r,o))return true;}return false;}
function sampleGround(x,z,y=0){for(const st of STAIRS)if(Math.abs(x-st.x)<1.03&&z<st.bottomZ+.35&&z>st.topZ-.6){const h=clamp((st.bottomZ-z)/(st.bottomZ-st.topZ),0,1)*st.y;return Math.abs(y-h)<.34?h:null;}if(y<.34)return 0;if(y>4.06&&((Math.abs(x)>9.7&&Math.abs(x)<28.5&&Math.abs(z)<58.5)||(Math.abs(x)<16.4&&z<-22.7&&z>-27.5)))return 4.4;return null;}
function playerCollides(x,z,r=.29,y=0){if(Math.abs(x)>42.65-r||Math.abs(z)>58.65-r)return true;const h=sampleGround(x,z,y);if(h===null||Math.abs(h-y)>.34)return true;for(const o of obstacles){if(o.stair)continue;const low=o.low||0,high=o.high??2;if(high<=h+.13||low>=h+1.65)continue;if(hitsBox(x,z,r,o))return true;}return false;}
function lineOfSight(ax,az,bx,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/.55);for(let i=1;i<n;i++){const t=i/n;if(collides(ax+(bx-ax)*t,az+(bz-az)*t,.07))return false;}return true;}
// Perception uses the actual height of cover. Navigation keeps its floor-only
// clearance checks, so seeing over a counter never lets an actor walk through it.
function actorCanSee(observer,target){
 if(!observer||!target||![observer.x,observer.z,target.x,target.z].every(Number.isFinite))return false;
 const observerEye=observer.type?(observer.type==='watcher'?3.5:2.6)*(observer.scale||.82):observer.crouching?1.14:1.66;
 const ax=observer.x,ay=(observer.y||0)+observerEye,az=observer.z;
 const visibleAt=height=>{
  const bx=target.x,by=(target.y||0)+height,bz=target.z,dx=bx-ax,dy=by-ay,dz=bz-az;
  for(const o of sightBlockers){
   const low=o.low||0,high=o.high??.8;
   if(high<Math.min(ay,by)||low>Math.max(ay,by)||o.x+o.w/2<Math.min(ax,bx)||o.x-o.w/2>Math.max(ax,bx)||o.z+o.d/2<Math.min(az,bz)||o.z-o.d/2>Math.max(az,bz))continue;
   let enter=0,leave=1,blocked=true;
   for(const [start,delta,min,max]of [[ax,dx,o.x-o.w/2,o.x+o.w/2],[ay,dy,low,high],[az,dz,o.z-o.d/2,o.z+o.d/2]]){
    if(Math.abs(delta)<1e-8){if(start<min||start>max){blocked=false;break;}}
    else{const a=(min-start)/delta,b=(max-start)/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(leave<enter){blocked=false;break;}}
   }
   if(blocked&&enter<.999&&leave>.001)return false;
  }
  return true;
 };
 const eye=target.type?(target.type==='watcher'?3.5:2.6)*(target.scale||.82):target.crouching?1.14:1.66;
 return visibleAt(eye)||visibleAt(target.type?eye*.72:target.crouching?.72:1.2);
}
function moveEntity(p,dx,dz,r){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));for(let i=0;i<steps;i++){if(!playerCollides(p.x+dx/steps,p.z,r,p.y)){p.x+=dx/steps;p.y=sampleGround(p.x,p.z,p.y)??p.y;}if(!playerCollides(p.x,p.z+dz/steps,r,p.y)){p.z+=dz/steps;p.y=sampleGround(p.x,p.z,p.y)??p.y;}}}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
const floorTex=canvasTexture(512,512,(c,w,h)=>{c.fillStyle='#72796e';c.fillRect(0,0,w,h);for(let j=0;j<4;j++)for(let i=0;i<4;i++){const v=91+Math.random()*15;c.fillStyle=`rgb(${v},${v+6},${v+1})`;c.fillRect(i*128+2,j*128+2,124,124);for(let k=0;k<35;k++){c.strokeStyle=`rgba(20,35,28,${Math.random()*.12})`;c.lineWidth=Math.random()*1.5;c.beginPath();const x=i*128+Math.random()*128,y=j*128+Math.random()*128;c.moveTo(x,y);c.bezierCurveTo(x+15,y+8,x-10,y+25,x+25,y+40);c.stroke();}}for(let i=0;i<3500;i++){c.fillStyle=`rgba(10,22,15,${Math.random()*.07})`;c.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1);}});floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(21.5,30);
const wallTex=canvasTexture(256,256,(c,w,h)=>{c.fillStyle='#a3a398';c.fillRect(0,0,w,h);for(let i=0;i<4000;i++){c.fillStyle=`rgba(30,45,34,${Math.random()*.07})`;c.fillRect(Math.random()*w,Math.random()*h,2,4);}const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0000');g.addColorStop(1,'#0d181b55');c.fillStyle=g;c.fillRect(0,0,w,h);});wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping;wallTex.repeat.set(2,1);mats.plaster.map=wallTex;
function sign(text,x,y,z,w=5,h=.65,color='#c9dac8',rot=0,bg='#0b171b',small=''){const t=canvasTexture(1024,160,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.strokeStyle='#b4c4ae44';c.strokeRect(8,8,W-16,H-16);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font=`${small?'52':'65'}px ${text.length>17?'Arial':'Georgia'}`;c.fillText(text,W/2,small?62:82,940);if(small){c.font='15px Arial';c.fillStyle='#a5b7a0';c.fillText(small,W/2,119,900);}});const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.FrontSide}));m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);return m;}
function glowPool(x,z,color,r=2,y=.018){const tex=canvasTexture(128,128,(c,w,h)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff9');g.addColorStop(.25,'#fff4');g.addColorStop(1,'#fff0');c.fillStyle=g;c.fillRect(0,0,w,h);});const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),new THREE.MeshBasicMaterial({map:tex,color,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m);return m;}
function point(x,y,z,color,intensity,range){const l=new THREE.PointLight(color,intensity,Math.min(range,9),2);l.position.set(x,y,z);scene.add(l);lights.push({light:l,base:intensity});return l;}
scene.add(new THREE.HemisphereLight(0x607b8b,0x111814,.12));
const moon=new THREE.DirectionalLight(0x8ba6c8,.16);moon.position.set(-8,16,-12);scene.add(moon);
const flashlight=new THREE.SpotLight(0xffead0,62,26,Math.PI*.14,.7,1.5);flashlight.castShadow=true;flashlight.shadow.mapSize.set(1024,1024);flashlight.shadow.bias=-.0006;flashlight.shadow.normalBias=.035;flashlight.shadow.camera.near=.1;flashlight.shadow.camera.far=30;scene.add(flashlight);scene.add(flashlight.target);
const nearLight=new THREE.PointLight(0xb7c2aa,.32,2.8,2);scene.add(nearLight);
function shop(side,z,name,color,index){const x=side*19.3,front=side*10;shopCenters.push({x,z});
 box(x,2,z+6.5,19,.22,0.3,mats.black,false);box(x,2.1,z-6.5,19,4.2,.32,mats.plaster,true);box(x,2.1,z+6.5,19,4.2,.32,mats.plaster,true);
 for(const dz of [-4.7,4.7]){box(front,1.8,z+dz,.28,3.6,3.6,mats.metal,true);box(front-side*.04,1.95,z+dz,.31,2.9,2.95,mats.glass,false);}
 box(front,3.65,z,.7,.85,13,mats.black,false);sign(name,front-side*.4,3.68,z,11.7,.68,color,side<0?Math.PI/2:-Math.PI/2);
 box(front,3.18,z,.45,.1,5.6,mats.brass);box(front,0.03,z,.7,.06,5.2,mats.brass);
 const carpet=material(index%2?0x26302d:0x3b3230,.95);box(x,.012,z,18.5,.022,12.6,carpet);
 for(const dz of [-4.7,4.7]){box(side*24.6,.85,z+dz,4.6,1.7,.85,mats.wood,true);for(let k=0;k<5;k++){const itemMat=material([0x636349,0x36434a,0x7c5b4e,0x727f6d,0x393343][(k+index)%5]);box(side*(23+k*.65),1.95,z+dz,.42,.45,.4,itemMat);}box(side*24.6,2.4,z+dz,4.6,.12,.85,mats.metal);}
 box(side*15.3,.6,z-3.7,2.4,1.2,2.4,mats.wood,true);box(side*15.3,1.24,z-3.7,2.5,.08,2.5,mats.black);box(side*15.3,1.48,z-3.7,.65,.42,.18,mats.metal);
 sign(index===1?'SALE ENDS TONIGHT':'SOMETHING FOR EVERYONE',side*28.4,2.2,z+4.6,2.8,1.3,'#9ca591',side<0?Math.PI/2:-Math.PI/2,'#182022',index===1?'UP TO 70% OFF':'WESTBRIDGE / EST. 1986');
 const stripMat=new THREE.MeshBasicMaterial({color});box(side*18.3,3.9,z,13,.035,.07,stripMat);glowPool(side*14,z,color,4);if(index%3===0)flickers.push(point(side*15,3.3,z,color,20,13));
 if(index%2===0){const g=new THREE.Group();g.position.set(side*16,0,z+3.4);scene.add(g);const mannequin=material(0x89978c,.6);cylinder(0,.9,0,.22,.8,mannequin,g);sphere(0,1.55,0,.17,.21,.18,mannequin,g);for(const s of [-1,1]){box(s*.11,.32,0,.13,.65,.15,mannequin,false,g);box(s*.32,.95,0,.12,.75,.12,mannequin,false,g);}}
}
function plant(x,z){cylinder(x,.35,z,.7,.7,mats.cream);obstacles.push({x,z,w:1.4,d:1.4});const leaves=material(0x283d2c);for(let j=0;j<7;j++){const a=j*2.4;const m=sphere(x+Math.cos(a)*.35,1.1+Math.random()*.5,z+Math.sin(a)*.35,.12,.75,.24,leaves);m.rotation.set(Math.cos(a)*.6,0,Math.sin(a)*.65);}cylinder(x,1,z,.055,1.6,mats.wood);}
function bench(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);box(0,.55,0,2.6,.18,.75,mats.wood,false,g);box(0,1.05,-.35,2.6,.85,.12,mats.wood,false,g);for(const s of [-1,1]){box(s*1,.28,0,.1,.55,.6,mats.metal,false,g);box(s*1.3,.8,0,.08,.45,.7,mats.metal,false,g);}obstacles.push({x,z,w:rot?1:2.8,d:rot?2.8:1,low:0,high:1.475});}
function buildMall(){
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(86,120),new THREE.MeshStandardMaterial({map:floorTex,roughness:.31,metalness:.27}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 for(const side of [-1,1]){box(side*29,6.6,0,.4,4.4,118,mats.wall,true);for(let i=0;i<8;i++)shop(side,-49+i*14,['MERCURY MUSIC','ECHO ELECTRONICS','HOLLOW RECORDS','ASTRA DEPARTMENT','SILVER SCREEN','FERN & FABLE','NORTHSTAR OUTFITTERS','LUMEN HOME','OLD TOWN DINER','NIGHT OWL BOOKS','RETRO CINEMA','ARCADE 86','THREAD THEORY','THE GLASSHOUSE','LAST LIGHT CAFE','AFTERIMAGE PHOTO'][(side<0?0:8)+i],['#bcc9c1','#e1a777','#b096a9','#a8c2a3'][(i+(side>0?1:0))%4],(side<0?0:8)+i);
 box(side*19.5,4.24,0,19,.32,118,mats.dark);box(side*9.6,4.32,18.15,.25,.16,81.3,mats.brass);box(side*9.65,4.9,18.15,.08,1,81.3,mats.glass,true);box(side*9.65,5.43,18.15,.12,.09,81.3,mats.metal);
 for(let z=-21.5;z<59;z+=2.8)box(side*9.65,4.95,z,.07,1.1,.07,mats.metal);
 box(side*16.22,6.05,0,.18,3.3,118,mats.black,true);for(let z=-51;z<=48;z+=14){box(side*16,6.05,z,.45,3.3,12.7,mats.wall,true);sign(['MAINTENANCE / NORTH','CLOSED UNTIL FURTHER NOTICE','WEST GALLERY / LEVEL 02','THANK YOU FOR SHOPPING'][Math.floor((z+51)/14)%4],side*15.73,6.5,z,10,.68,'#81938a',side<0?Math.PI/2:-Math.PI/2);for(let n=0;n<12;n++)box(side*15.74,4.55+n*.13,z,.015,.023,12.1,mats.metal);}
 for(let z=-54;z<=51;z+=7){box(side*8.9,6.2,z,.55,12.4,.55,mats.plaster,true);box(side*8.9,.3,z,.78,.6,.78,mats.dark);box(side*8.9,3.6,z,.65,.07,.65,mats.brass);}
 }
 box(0,4.6,-59,86,9.2,.6,mats.wall,true);box(0,4.6,59,86,9.2,.6,mats.wall,true);
 box(0,12.85,0,19,.18,119,new THREE.MeshStandardMaterial({color:0x1f3440,roughness:.2,metalness:.25,transparent:true,opacity:.5}));
 for(let z=-59;z<=59;z+=4){box(0,12.65,z,19,.2,.16,mats.black);for(const s of [-1,1])box(s*6.2,12.7,z,.12,.15,4,mats.black);}
 for(const s of [-1,1])box(s*5.7,12.5,0,.12,.12,119,mats.metal);
 // The flooded atrium: tiled basin, still water, stone sculpture.
 cylinder(0,.28,-4,3.1,.56,mats.dark);obstacles.push({x:0,z:-4,w:5.9,d:5.9});cylinder(0,.57,-4,3.18,.12,mats.cream);cylinder(0,.64,-4,2.9,.03,mats.water);cylinder(0,1.1,-4,.8,1.1,mats.black);const art=new THREE.Mesh(new THREE.TorusKnotGeometry(.82,.18,60,8),mats.brass);art.position.set(0,2.1,-4);scene.add(art);point(0,1,-4,0x66989b,30,13);glowPool(0,-4,0x87b6a6,7);
 for(const x of [-5.5,5.5]){bench(x,5,Math.PI/2);plant(x,10.2);plant(x,-10.3);}
 // The stairs use the same continuous height field as player and predator movement.
 for(const st of STAIRS){const x=st.x;obstacles.push({x,z:-18.5,w:2.1,d:10.7,low:0,high:4.4,stair:true});for(let j=0;j<25;j++){const h=(j+1)/25*4.4;box(x,h/2,-13.7-j*.4,1.8,h,.42,mats.metal);box(x,h+.009,-13.7-j*.4,1.75,.018,.055,mats.brass);}for(const ds of [-1,1]){const rail=box(x+ds*.99,2.78,-18.5,.12,.8,10.9,mats.black);rail.rotation.x=-Math.atan(.44);obstacles.push({x:x+ds*1.01,z:-18.5,w:.14,d:10.6,low:0,high:5.3,sightTransparent:true});}sign('LEVEL 02  ↑',x,.95,-12.55,2,.42,'#b6c6a1');glowPool(x,-13.1,0x879e87,1.5);}
 // Leave real stair openings in the bridge deck so rising heads do not pass
 // through its underside. The continuous rear landing starts at the top tread.
 box(0,4.24,-25.5,33,.32,4,mats.dark);
 for(const [x,w]of [[-12.125,8.75],[0,11.3],[12.125,8.75]])box(x,4.24,-23.1,w,.32,.8,mats.dark);
 for(const [x,w]of [[-8.725,1.85],[0,11.3],[8.725,1.85]]){box(x,4.92,-22.7,w,1,.07,mats.glass,true);box(x,5.45,-22.7,w,.08,.12,mats.metal);}
 for(const side of [-1,1]){for(const z of [-35,-14,8,35]){box(side*15.6,5.45,z,.08,.22,.8,new THREE.MeshBasicMaterial({color:0x7d9484}));glowPool(side*13.8,z,0x7d9484,2.2,4.415);}point(side*12,6.6,-24.8,0x7f9589,15,7);}
 sign('WESTBRIDGE',0,6.9,-58.5,15,1.6,'#bbcab7',0,'#101b20','A WORLD OF POSSIBILITIES');sign('SECURITY  /  EMERGENCY POWER',0,3.1,-58.5,8,.65,'#d5c096');
 box(0,1,-56.5,1.5,2,.8,mats.metal,true);box(0,1.65,-56.05,1.15,.7,.06,mats.black);for(let j=0;j<3;j++){const l=box((j-1)*.3,1.72,-56,.13,.13,.04,new THREE.MeshBasicMaterial({color:0x9b543a}));l.name='powerLed'+j;}
 interactables.push({type:'panel',x:0,z:-55.5,name:'Emergency power',mesh:null});
 // The only way out.
 for(const x of [-2.2,2.2]){box(x,1.75,58.55,4.2,3.5,.15,mats.glass);box(x,1.75,58.42,.1,3.5,.12,mats.metal);box(x,1.2,58.2,2.8,.1,.15,mats.brass);}
 box(0,3.7,58.55,9,.35,.3,mats.black);sign('EXIT  ↓',0,4.2,58.25,4,.8,'#b5dfb9',Math.PI);sign('FIRE EXIT — POWER LOCKED',0,2.9,58.21,5,.4,'#cf9b7f',Math.PI);point(0,3,56,0xa1d4a5,20,14);glowPool(0,57,0xa5d4a0,5);interactables.push({type:'exit',x:0,z:57,name:'Exit'});
 // Suspended wayfinding, emergency strips, and abandoned everyday objects.
 for(const z of [-14,14]){sign('← SHOPS     ATRIUM     SHOPS →',0,3.7,z,8,.65,'#b1bdb0',0,'#152427','POWER / SECURITY AT THE NORTH END');sign('MAIN EXIT ↓',0,3.7,z+.06,8,.65,'#adc3ab',Math.PI);for(const s of [-1,1])box(s*3,6,z,.035,4.6,.035,mats.metal);}
 for(const [x,z] of [[-8,18],[8,-9],[-8,-22],[8,24]]){box(x,1.1,z,.55,2.2,1.5,mats.red,true);sign('FIRE',x+(x>0?-.3:.3),1.6,z,1,.3,'#c2aa93',x>0?-Math.PI/2:Math.PI/2);}
 point(-7,4.6,15,0xc3c5a5,36,9);point(7,4.2,36,0xa4a48e,17,8);point(7,4.6,-17,0x769fae,35,22);
 for(const [x,z] of [[7,0],[-7,21],[7,-25]]){box(x,3.2,z,.13,.16,1.1,new THREE.MeshBasicMaterial({color:0xb44732}));glowPool(x,z,0xc75331,2.5);}
 // Paper litter, wet stains and scuff trails are geometry, not screen overlays.
 for(let i=0;i<52;i++){const x=(Math.random()-.5)*16,z=(Math.random()-.5)*113;if(collides(x,z,.3))continue;const p=box(x,.025,z,.18+Math.random()*.28,.012,.25+Math.random()*.18,mats.paper);p.rotation.y=Math.random()*TAU;p.castShadow=false;}
 for(let i=0;i<12;i++){const x=(Math.random()-.5)*15,z=(Math.random()-.5)*110;if(collides(x,z,.5))continue;const stain=new THREE.Mesh(new THREE.CircleGeometry(.6+Math.random()*.8,18),new THREE.MeshBasicMaterial({color:0x142022,transparent:true,opacity:.27,depthWrite:false}));stain.rotation.x=-Math.PI/2;stain.scale.y=.35;stain.position.set(x,.022,z);scene.add(stain);}
}
buildMall();
function serviceWing(side){
 box(side*43,4.6,0,.5,9.2,118,mats.wall,true);
 // A continuous staff corridor links the rear doors of every store.
 for(let i=0;i<8;i++){
  const z=-49+i*14,x=side*38.2;
  for(const dz of [-4.7,4.7]){
   box(side*29,2.1,z+dz,.36,4.2,3.6,mats.plaster,true);
   box(side*33.5,2.1,z+dz,.3,4.2,3.6,mats.wall,true);
  }
  sign('STAFF ONLY',side*28.76,3.25,z,3.4,.45,'#99ab94',side<0?Math.PI/2:-Math.PI/2);
  sign(['MAINTENANCE','STOCKROOM','SECURITY ARCHIVE','LOADING BAY','STAFF LOCKERS','JANITOR','DELIVERIES','SERVICE STORAGE'][i],side*33.28,3.25,z,4.8,.5,'#9aa292',side<0?Math.PI/2:-Math.PI/2,'#101a1b');
  // Narrow rear doorways connect one back room to the next.
  for(const end of [-1,1])for(const [px,w]of [[35.3,3.4],[41.7,2.1]])box(side*px,2.2,z+end*6.8,w,4.4,.28,mats.wall,true);
  const roomfloor=box(x,.016,z,9.2,.032,13.3,mats.dark);roomfloor.receiveShadow=true;
  for(const dz of [-4.5,4.5]){
   box(side*40.6,.65,z+dz,2.4,1.3,2,mats.wood,true);
   box(side*40.7,1.55,z+dz,.9,.5,1.1,mats.wood,true);
   for(const off of [-.8,0,.8])box(side*(35.1+off),1,z+dz,.65,2,.55,mats.metal,true);
  }
  // Plumbing and cable trays keep the staff spaces distinct from the concourse.
  const pipe=cylinder(side*32.5,3.7,z,.065,14,mats.metal);pipe.rotation.x=Math.PI/2;
  box(side*31.5,4.25,z,2.6,.12,13.7,mats.black);
  box(side*31.5,4.05,z,.8,.035,.22,new THREE.MeshBasicMaterial({color:i%3===0?0x9aa889:0x253d36}));
  if(i%3===0){point(side*31.5,3.7,z,0x879d86,11,6);glowPool(side*31.5,z,0x8b9f83,1.8);}
  if(i===5){cylinder(side*40,1.2,z,1.1,2.4,mats.metal);obstacles.push({x:side*40,z,w:2.2,d:2.2,low:0,high:2.4});}
 }
 sign('SERVICE PASSAGE  ←  →',side*32.8,2.6,55.8,5,.55,'#8c9d88',Math.PI);
}
serviceWing(-1);serviceWing(1);
const fuseData=[{x:-20,y:0,z:-21,label:'Hollow Records'},{x:38.2,y:0,z:21,label:'East service stockroom'},{x:-14,y:4.4,z:7,label:'Upper west gallery'}];
for(const f of fuseData){box(f.x,f.y+.55,f.z,1.1,1.1,1.1,mats.dark,true);const g=new THREE.Group();g.position.set(f.x,f.y+1.28,f.z);scene.add(g);cylinder(0,0,0,.11,.48,mats.glow,g);for(const y of [-.24,.24])cylinder(0,y,0,.14,.08,mats.brass,g);const halo=glowPool(f.x,f.z,0xaaceaa,2.2,f.y+1.11);interactables.push({...f,type:'fuse',name:'Emergency fuse',mesh:g,halo,collected:false});sign('EMERGENCY FUSE',f.x,f.y+1.9,f.z-.45,2,.32,'#d1dfbb');}
const supplies=[{x:21,z:21,type:'flash',name:'Stun flash refill'},{x:21,z:-21,type:'flash',name:'Stun flash refill'},{x:-21,z:21,type:'flash',name:'Stun flash refill'},{x:12,y:4.4,z:18,type:'flash',name:'Stun flash refill'},{x:-12,y:4.4,z:-15,type:'flash',name:'Stun flash refill'},{x:-38,z:-35,type:'flash',name:'Stun flash refill'},{x:38,z:-7,type:'flash',name:'Stun flash refill'},{x:-38,z:21,type:'flash',name:'Stun flash refill'},{x:38,z:49,type:'flash',name:'Stun flash refill'}];
for(const s of supplies){const g=new THREE.Group();g.position.set(s.x,(s.y||0)+.75,s.z);scene.add(g);box(0,0,0,.6,.38,.4,s.type==='med'?mats.cream:mats.brass,false,g);if(s.type==='med'){box(0,.2,0,.35,.012,.09,mats.red,false,g);box(0,.202,0,.09,.012,.3,mats.red,false,g);}interactables.push({...s,mesh:g,collected:false});}
// Amber stations are the additional escape requirements for this night.
for(const task of MALL_TASKS){
 const g=new THREE.Group();g.position.set(task.x,task.y,task.z);scene.add(g);
 box(0,.7,0,.7,1.4,.48,mats.metal,false,g);box(0,1.22,.25,.55,.3,.035,mats.black,false,g);
 const indicator=box(0,1.27,.28,.12,.12,.03,new THREE.MeshBasicMaterial({color:0xefb36b}),false,g);
 const label=sign(({keycard:'SECURITY KEYCARD',valve:'COOLANT VALVE',relay:'GALLERY RELAY',crank:'EXIT SHUTTER',lockdown:'LOCKDOWN OVERRIDE'})[task.id],task.x,task.y+1.9,task.z+.3,2.6,.32,'#e7bc80');g.attach(label);
 if(task.id==='valve'){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.23,.04,8,18),mats.brass);wheel.position.set(0,1,.32);g.add(wheel);}
 if(task.id==='keycard')box(0,1.46,0,.27,.025,.18,mats.cream,false,g);
 const halo=glowPool(task.x,task.z,0xe7a858,1.8,task.y+.035);
 interactables.push({...task,type:'task',taskId:task.id,name:task.action,mesh:g,halo,indicator,collected:false});
}
{const g=new THREE.Group();g.position.set(-38,.85,35);scene.add(g);box(0,0,0,.45,.08,.1,mats.brass,false,g);box(.2,.14,0,.08,.3,.1,mats.brass,false,g);const halo=glowPool(-38,35,0xe7a858,1.7);interactables.push({type:'crankPickup',taskId:'crank',x:-38,y:0,z:35,name:'Take shutter crank',mesh:g,halo,collected:false});}
const sightBlockers=obstacles.filter(o=>!o.transparent&&!o.stair&&!o.sightTransparent);
// Floor slabs support navigation through the height field rather than wall
// collision, but they still stop sight between the two levels.
for(const side of [-1,1])sightBlockers.push({x:side*19.5,z:0,w:19,d:118,low:4.08,high:4.4});
sightBlockers.push({x:0,z:-25.5,w:33,d:4,low:4.08,high:4.4});
for(const [x,w]of [[-12.125,8.75],[0,11.3],[12.125,8.75]])sightBlockers.push({x,z:-23.1,w,d:.8,low:4.08,high:4.4});
const coverPoints=[],coverCells=new Set();
for(let id=0;id<obstacles.length;id++){
 const o=obstacles[id];
 if(o.transparent||o.stair||!Number.isFinite(o.high)||(o.low||0)>.06||o.high<1.15||o.high>2.3||o.w<1||o.d<.7)continue;
 const candidates=[{x:o.x-o.w/2-.4,z:o.z},{x:o.x+o.w/2+.4,z:o.z},{x:o.x,z:o.z-o.d/2-.4},{x:o.x,z:o.z+o.d/2+.4}];
 for(let side=0;side<candidates.length;side++){
  const p=candidates[side];let cell=null,best=1.25**2;
  // End on the same integer lattice as A*. Narrow decorative gaps may fit a
  // crouched body while still being unreachable to the route finder.
  for(let x=Math.floor(p.x)-1;x<=Math.ceil(p.x)+1;x++)for(let z=Math.floor(p.z)-1;z<=Math.ceil(p.z)+1;z++){
   const d=(x-p.x)**2+(z-p.z)**2;if(d>=best||collides(x,z,.48))continue;cell={x,z};best=d;
  }
  if(!cell||coverCells.has(cell.x+','+cell.z))continue;coverCells.add(cell.x+','+cell.z);
  coverPoints.push({id:'cover-'+id+'-'+side,coverId:id,...cell,y:0,coverHeight:o.high});
 }
}
const patrolPoints=[];
function addPatrol(x,y,z,kind){if(playerCollides(x,z,.56,y))return;patrolPoints.push({id:kind+'-'+patrolPoints.length,x,y,z,sector:kind+'-'+Math.floor((z+59)/28)});}
for(const side of [-1,1])for(let i=0;i<8;i++){const z=-49+i*14;addPatrol(side*19.3,0,z,side<0?'west-shops':'east-shops');addPatrol(side*38.2,0,z,side<0?'west-staff':'east-staff');}
for(const side of [-1,1])for(const z of [-42,-8,24,46]){addPatrol(side*4,0,z,'concourse');addPatrol(side*12,4.4,z,side<0?'west-gallery':'east-gallery');}
addPatrol(0,4.4,-25,'north-bridge');
// Floating motes catch the atrium light.
const dustGeo=new THREE.BufferGeometry(),dustArr=new Float32Array(300*3);for(let i=0;i<300;i++){dustArr[i*3]=(Math.random()-.5)*20;dustArr[i*3+1]=Math.random()*8;dustArr[i*3+2]=(Math.random()-.5)*118;}dustGeo.setAttribute('position',new THREE.BufferAttribute(dustArr,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xb8caba,size:.035,transparent:true,opacity:.38,depthWrite:false}));scene.add(dust);
function limb(parent,x,y,z,length,radius,mat){const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);const bone=cylinder(0,-length*.5,0,radius,length,mat,pivot,radius*.78);return pivot;}
function humanMesh(c){const rig=realHumansReady?createRealHuman(THREE,c):createHuman(THREE,c);scene.add(rig.group);return {g:rig.group,arms:rig.arms,legs:rig.legs,shadow:rig.shadow,rig};}
function beastMesh(m){const rig=createHorrorCreature(THREE,m.type);scene.add(rig.group);return {g:rig.group,rig};}
const spawnPoints=[];for(const s of shopCenters)for(const dz of [-1.8,1.8])spawnPoints.push({x:s.x+(Math.random()-.5)*3,z:s.z+dz});for(const p of [{x:3,z:17},{x:-3,z:13},{x:4,z:-15},{x:-4,z:3}])spawnPoints.push(p);
function gameEvent(e){if(!sim)return;if(e.type==='capture'){startCapture(e.id);return;}if(e.type==='watcher'){if(mode==='playing'&&prefs.subtitles)toast('THE STILL ONE · Keep it in sight. It moves when you look away.',4);return;}sound.event(e.type==='grab'?'scream':e.type,e.x,e.z,player);if(e.type==='eat'){bloodAtMonster(e.id,gentle?6:12);if(mode==='playing'&&prefs.subtitles)toast(e.grew===false?'A beast has fed. It is fully grown.':'A beast has fed. It is getting larger.',2.8);}if(e.type==='scream'&&prefs.subtitles&&mode==='playing'&&Math.hypot(e.x-player.x,e.z-player.z)<16)toast('[ A scream echoes nearby ]',1.8);if(e.type==='escape'&&sim.rescued===1&&mode==='playing'&&prefs.subtitles)toast('A shopper reached the service exit.',2.2);}
sim=createSimulation({collides,lineOfSight,spawnPoints,coverPoints,patrolPoints,onEvent:gameEvent,difficulty,navigation:{ground:sampleGround,collides:playerCollides,stairs:STAIRS,upperY:4.4,canSee:actorCanSee}});
function syncActors(dt){for(const c of sim.civilians){let v=civilMeshes.get(c.id);if(!v){v=humanMesh(c);civilMeshes.set(c.id,v);}v.g.visible=c.alive&&!c.escaped&&(c.grabbed||Math.hypot(c.x-camera.position.x,c.z-camera.position.z)<48);if(!v.g.visible)continue;v.g.position.set(c.x,c.y||0,c.z);v.g.rotation.set(0,c.angle,0);v.rig.update(dt,c,elapsed);}
 for(const m of sim.monsters){let v=monsterMeshes.get(m.id);if(!v){v=beastMesh(m);monsterMeshes.set(m.id,v);}v.g.visible=true;v.g.position.set(m.x,m.y||0,m.z);v.g.rotation.y=m.angle;m.scale=clamp(Number.isFinite(m.scale)?m.scale:1,.1,monsterScaleLimit(m.type));v.g.scale.setScalar(Math.min(monsterScaleLimit(m.type),THREE.MathUtils.lerp(v.g.scale.x,m.scale,Math.min(1,dt*3))));v.rig.update(dt,m,elapsed);const plant=Math.floor(m.phase*.42/Math.PI);if(mode==='playing'&&m.moving&&plant!==v.lastPlant){sound.beastStep(m,player);const d=Math.hypot(m.x-player.x,m.z-player.z,(m.y||0)-player.y);if(d<10){footfallImpulse=Math.max(footfallImpulse,(1-d/10)*m.scale*.025);if(prefs.subtitles&&footCaptionClock<=0){toast(d<5?'[ Heavy footsteps. Very close. ]':'[ Heavy footsteps nearby ]',1.5);footCaptionClock=3.5;}}}v.lastPlant=plant;}
 for(const c of sim.civilians){const v=civilMeshes.get(c.id);if(!v)continue;if(c.alive&&c.grabbed){const beast=sim.monsters.find(m=>m.id===c.grabbedBy),holder=beast&&monsterMeshes.get(beast.id);if(holder)poseFeedingVictim(v,beast,holder);}else{setVictimClipping(v,false);v.g.scale.setScalar(1);v.shadow.visible=true;v.bloodStage=0;}}
}
function setVictimClipping(v,active,mouth,outward){
 if(active&&!v.feedMaterials){const copies=new Map();v.feedMaterials=[];v.feedPlane=new THREE.Plane();const privateMaterial=material=>{let copy=copies.get(material);if(!copy){copy=material.clone();copy.clipShadows=true;copies.set(material,copy);v.feedMaterials.push(copy);}return copy;};v.g.traverse(o=>{if(!o.isMesh||o===v.shadow)return;o.material=Array.isArray(o.material)?o.material.map(privateMaterial):privateMaterial(o.material);});}
 if(active)v.feedPlane.setFromNormalAndCoplanarPoint(outward,mouth);
 if(v.feedMaterials&&v.clippingActive!==active)for(const mat of v.feedMaterials){mat.clippingPlanes=active?[v.feedPlane]:null;mat.needsUpdate=true;}
 v.clippingActive=active;
}
function poseFeedingVictim(v,beast,holder){
 const progress=clamp(beast.feedProgress||0,0,1),grip=new THREE.Vector3(),mouth=new THREE.Vector3(),approach=new THREE.Vector3();holder.rig.getGripPosition(grip);holder.rig.getMouthPosition(mouth);holder.rig.getMouthApproach(approach);
 const outward=approach.sub(mouth).normalize(),inward=outward.clone().negate(),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},turn=smooth((progress-.50)/.14),swallow=smooth((progress-.62)/.28);
 v.g.scale.setScalar(1);v.shadow.visible=false;
 v.g.position.copy(grip).add(new THREE.Vector3(0,-1.15,0));v.g.position.y=Math.max(beast.y||0,v.g.position.y);
 const feedPosition=mouth.clone().addScaledVector(outward,1.82-2.12*swallow);v.g.position.lerp(feedPosition,turn);
 const upright=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(elapsed*13)*.18,beast.angle+Math.PI,Math.sin(elapsed*17)*.16));const headfirst=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),inward);v.g.quaternion.slerpQuaternions(upright,headfirst,turn);
 v.arms[0].rotation.x=-.9+Math.sin(elapsed*20)*.45;v.arms[1].rotation.x=1+Math.sin(elapsed*19)*.45;v.legs[0].rotation.x=Math.sin(elapsed*18)*.6;v.legs[1].rotation.x=-Math.sin(elapsed*18)*.6;
 setVictimClipping(v,progress>=.62,mouth,outward);
 const beats=[.67,.79,.89];v.bloodStage=v.bloodStage||0;while(v.bloodStage<beats.length&&progress>=beats[v.bloodStage]){bloodAtMonster(beast.id,gentle?5:18);sound.event('eat',beast.x,beast.z,player);v.bloodStage++;}
}
function startCapture(id){if(mode!=='playing')return;const m=sim.monsters.find(b=>b.id===id);if(!m)return;mode='captured';player.alive=false;player.health=0;captureState={monster:m,age:0,from:camera.position.clone()};keys.clear();touch.x=touch.y=0;sprintLatched=false;$('hud').classList.add('hidden');sound.event('roar',m.x,m.z,player);sound.event('attack',m.x,m.z,player);if(document.pointerLockElement)document.exitPointerLock();}
function updateCapture(dt){const c=captureState;if(!c)return;c.age+=dt;const p=clamp(c.age/4,0,1),m=c.monster;m.feeding=Math.max(.001,4-c.age);m.feedProgress=p;m.phase+=dt*2;m.state='feeding';syncActors(dt);const rig=monsterMeshes.get(m.id)?.rig;if(!rig)return;const grip=new THREE.Vector3(),mouth=new THREE.Vector3();rig.getGripPosition(grip);rig.getMouthPosition(mouth);const toMouth=clamp((p-.43)/.45,0,1);const lifted=grip.clone().add(new THREE.Vector3(0,.24,0));const outside=mouth.clone().add(new THREE.Vector3(Math.sin(m.angle)*.72,0,Math.cos(m.angle)*.72));const destination=lifted.lerp(outside,clamp((p-.25)/.25,0,1)).lerp(mouth,toMouth*toMouth);camera.position.copy(c.from).lerp(destination,clamp(p/.28,0,1));camera.lookAt(mouth);if(!gentle&&prefs.screenShake)camera.rotation.z=Math.sin(c.age*17)*.035*(1-p);camera.fov+=(88-camera.fov)*dt*2;camera.updateProjectionMatrix();$('captureFade').style.opacity=clamp((p-.85)/.15,0,1);sound.update(dt,{danger:1,stamina:.1,moving:false,sprinting:false});if(p>.7&&!c.chomp){c.chomp=true;bloodAtMonster(m.id,gentle?7:24);sound.event('eat',m.x,m.z,player);}if(p>=1){finish(false);}}
const MAX_BLOOD_PARTICLES=140,MAX_BLOOD_STAINS=48,MAX_BLOOD_RIPPLES=18;
const bloodMaterial=new THREE.MeshPhysicalMaterial({color:0x630907,roughness:.14,metalness:0,clearcoat:1,clearcoatRoughness:.055,ior:1.34,reflectivity:.7,emissive:0x170000,emissiveIntensity:.22});
const bloodDropGeometry=new THREE.LatheGeometry([new THREE.Vector2(0,1.75),new THREE.Vector2(.26,.85),new THREE.Vector2(.79,.2),new THREE.Vector2(1,-.38),new THREE.Vector2(.75,-.94),new THREE.Vector2(0,-1.15)],12);
const bloodRippleGeometry=new THREE.RingGeometry(.86,1,28);
const bloodSplatTexture=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#870b08';c.beginPath();for(let j=0;j<24;j++){const a=j/24*TAU,r=27+Math.random()*15,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r*.64;j?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();for(let j=0;j<22;j++){const a=Math.random()*TAU,r=30+Math.random()*30;c.beginPath();c.ellipse(64+Math.cos(a)*r,64+Math.sin(a)*r,1+Math.random()*3,1+Math.random()*2,a,0,TAU);c.fill();}});
const bloodStainGeometry=new THREE.PlaneGeometry(1,1),bloodStainMaterial=new THREE.MeshPhysicalMaterial({map:bloodSplatTexture,color:0x9a2220,transparent:true,opacity:.94,roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.04,ior:1.34,emissive:0x170000,emissiveIntensity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
function addBloodStain(x,y,z,size=.6){while(bloodStains.length>=MAX_BLOOD_STAINS){const index=Math.max(0,bloodStains.findIndex(s=>!s.protected));scene.remove(bloodStains[index].m);bloodStains.splice(index,1);}const m=new THREE.Mesh(bloodStainGeometry,bloodStainMaterial);m.rotation.set(-Math.PI/2,0,Math.random()*TAU);m.position.set(x,y+.025,z);m.scale.set(size*(.7+Math.random()*.6),size,1);scene.add(m);const stain={m,t:90};bloodStains.push(stain);return stain;}
function emitBloodDrop(position,velocity,ground=0,r=.025,secondary=false){if(effects.filter(p=>p.blood).length>=MAX_BLOOD_PARTICLES){const at=effects.findIndex(p=>p.blood);scene.remove(effects[at].m);effects.splice(at,1);}const m=new THREE.Mesh(bloodDropGeometry,bloodMaterial);m.scale.setScalar(r);m.position.copy(position);scene.add(m);effects.push({m,blood:true,ground,radius:r,secondary,vx:velocity.x,vy:velocity.y,vz:velocity.z,t:2.6});}
function makeLiquidStream(){const geometry=new THREE.BufferGeometry(),positions=new Float32Array(21*9*3),normals=new Float32Array(positions.length),indices=[];for(let row=0;row<20;row++)for(let side=0;side<8;side++){const a=row*9+side,b=a+9;indices.push(a,a+1,b,b,a+1,b+1);}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);const mesh=new THREE.Mesh(geometry,bloodMaterial);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);return mesh;}
function addBloodRipple(x,y,z){while(bloodRipples.length>=MAX_BLOOD_RIPPLES){const r=bloodRipples.shift();scene.remove(r.m);r.m.material.dispose();}const material=new THREE.MeshPhysicalMaterial({color:0x8b1b16,roughness:.08,clearcoat:1,transparent:true,opacity:.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),m=new THREE.Mesh(bloodRippleGeometry,material);m.rotation.x=-Math.PI/2;m.position.set(x,y+.032,z);m.scale.setScalar(.04);scene.add(m);bloodRipples.push({m,t:.46,life:.46});}
function startBloodFlow(id){const beast=sim.monsters.find(m=>m.id===id),holder=monsterMeshes.get(id);if(!beast||!holder)return;let flow=bloodFlows.get(id);if(!flow){const meshes=Array.from({length:3},makeLiquidStream),mouth=new THREE.Vector3();holder.rig.getMouthPosition(mouth);const approach=new THREE.Vector3();holder.rig.getMouthApproach(approach);mouth.addScaledVector(approach.sub(mouth).normalize(),.36*beast.scale);const ground=sampleGround(mouth.x,mouth.z,beast.y||0)??0,puddle=addBloodStain(mouth.x,ground,mouth.z,.3);puddle.protected=true;flow={meshes,puddle,baseScale:puddle.m.scale.clone(),volume:1,life:7.5,pour:1.25,clock:0,dropTimer:0};bloodFlows.set(id,flow);}flow.pour=1.25;flow.life=7.5;}
function bloodAtMonster(id,count=18){const beast=sim.monsters.find(m=>m.id===id),holder=monsterMeshes.get(id);if(!beast||!holder)return;const mouth=new THREE.Vector3(),front=new THREE.Vector3();holder.rig.getMouthPosition(mouth);holder.rig.getMouthApproach(front);const outward=front.sub(mouth).normalize();holder.rig.setBloodiness(1);
 for(let j=0;j<count;j++)emitBloodDrop(mouth.clone().addScaledVector(outward,.12*beast.scale),new THREE.Vector3(outward.x*(1+Math.random()*2)+(Math.random()-.5)*2.8,-.45+Math.random()*1.4,outward.z*(1+Math.random()*2)+(Math.random()-.5)*2.8),beast.y||0,.018+Math.random()*.036);
 startBloodFlow(id);
}
function removeBloodFlow(id,flow){for(const mesh of flow.meshes){scene.remove(mesh);mesh.geometry.dispose();}flow.puddle.protected=false;bloodFlows.delete(id);}
function updateBloodFlows(dt){for(const [id,flow]of bloodFlows){const beast=sim.monsters.find(m=>m.id===id),holder=monsterMeshes.get(id);flow.clock+=dt;flow.life-=dt;flow.pour-=dt;if(beast?.stunned>0)flow.pour=0;if(!beast||!holder||flow.life<=0){removeBloodFlow(id,flow);continue;}const mouth=new THREE.Vector3(),front=new THREE.Vector3();holder.rig.getMouthPosition(mouth);holder.rig.getMouthApproach(front);const outward=front.sub(mouth).normalize(),side=new THREE.Vector3(outward.z,0,-outward.x),pouring=flow.pour>0,scale=beast.scale;mouth.addScaledVector(outward,.12*scale);const end=mouth.clone().addScaledVector(outward,.24*scale),ground=sampleGround(end.x,end.z,beast.y||0)??0;
 for(let strand=0;strand<3;strand++){const mesh=flow.meshes[strand];mesh.visible=pouring;if(!pouring)continue;const length=Math.min(mouth.y-ground-.04,(.5+(.5+.5*Math.sin(flow.clock*4.5+strand))*1.05)*scale),radius=(strand===1?.018:.010)*scale;
  const curve=t=>mouth.clone().addScaledVector(outward,.12*scale*t*t).addScaledVector(side,((strand-1)*.045+Math.sin(t*5-flow.clock*7+strand)*.011*t)*scale).setY(mouth.y-length*t);
  const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
  for(let row=0;row<=20;row++){const t=row/20,center=curve(t),tangent=curve(Math.min(1,t+.015)).sub(curve(Math.max(0,t-.015))).normalize(),basis=side.clone().addScaledVector(tangent,-side.dot(tangent)).normalize(),across=new THREE.Vector3().crossVectors(tangent,basis).normalize(),pinch=.64+.36*Math.sin(flow.clock*13-t*9+strand),endShape=t<.7?1:.13+Math.exp(-Math.pow((t-.88)*8,2)),r=radius*pinch*endShape/Math.sqrt(1+t*1.6);
   for(let j=0;j<=8;j++){const a=j/8*TAU,n=basis.clone().multiplyScalar(Math.cos(a)).addScaledVector(across,Math.sin(a)),p=center.clone().addScaledVector(n,r),at=row*9+j;position.setXYZ(at,p.x,p.y,p.z);normal.setXYZ(at,n.x,n.y,n.z);}
  }position.needsUpdate=true;normal.needsUpdate=true;
 }
 flow.dropTimer-=dt;if(flow.dropTimer<=0){flow.dropTimer=pouring?.065:.32+Math.random()*.22;const strand=flow.dropIndex=(flow.dropIndex||0)+1,fall=(pouring?.6+.6*Math.random():.025)*scale;emitBloodDrop(mouth.clone().addScaledVector(side,((strand%3)-1)*.045*scale).add(new THREE.Vector3(0,-fall,0)),new THREE.Vector3(outward.x*.13,-.35-Math.random()*.45,outward.z*.13),beast.y||0,(pouring?.022:.015)*scale);}
 flow.volume=Math.min(18,flow.volume+dt*(pouring?3.4:.16)*scale);const growth=Math.sqrt(flow.volume);flow.puddle.m.scale.set(flow.baseScale.x*growth,flow.baseScale.y*growth,1);flow.puddle.t=90;
}}
function updateEffects(dt){updateBloodFlows(dt);const up=new THREE.Vector3(0,1,0);for(let j=effects.length-1;j>=0;j--){const p=effects[j];p.t-=dt;p.m.position.x+=p.vx*dt;p.m.position.z+=p.vz*dt;p.m.position.y+=p.vy*dt;p.vy-=7*dt;const velocity=new THREE.Vector3(p.vx,p.vy,p.vz),speed=velocity.length(),stretch=1+Math.min(1.3,speed*.23),r=p.radius||.025;p.m.quaternion.setFromUnitVectors(up,velocity.normalize().negate());p.m.scale.set(r/Math.sqrt(stretch),r*stretch,r/Math.sqrt(stretch));const ground=sampleGround(p.m.position.x,p.m.position.z,p.ground||0)??0;if(p.blood&&p.m.position.y<=ground+.035){addBloodStain(p.m.position.x,ground,p.m.position.z,.12+Math.random()*.26);if(!p.secondary){addBloodRipple(p.m.position.x,ground,p.m.position.z);for(let k=0;k<2;k++){const a=Math.random()*TAU;emitBloodDrop(new THREE.Vector3(p.m.position.x,ground+.06,p.m.position.z),new THREE.Vector3(Math.cos(a)*.55,.55+Math.random()*.5,Math.sin(a)*.55),ground,r*.38,true);}}p.t=0;}if(p.t<=0){scene.remove(p.m);const index=effects.indexOf(p);if(index>=0)effects.splice(index,1);}}
 for(let j=bloodRipples.length-1;j>=0;j--){const ripple=bloodRipples[j];ripple.t-=dt;const age=clamp(1-ripple.t/ripple.life,0,1);ripple.m.scale.setScalar(.04+Math.sqrt(age)*.35);ripple.m.material.opacity=.45*(1-age);if(ripple.t<=0){scene.remove(ripple.m);ripple.m.material.dispose();bloodRipples.splice(j,1);}}
 for(let j=bloodStains.length-1;j>=0;j--){bloodStains[j].t-=dt;if(bloodStains[j].t<=0&&!bloodStains[j].protected){scene.remove(bloodStains[j].m);bloodStains.splice(j,1);}}
}
function clearFeedingEffects(){for(const [id,flow]of bloodFlows)removeBloodFlow(id,flow);for(const ripple of bloodRipples){scene.remove(ripple.m);ripple.m.material.dispose();}bloodRipples.length=0;for(const p of effects)scene.remove(p.m);effects.length=0;for(const p of bloodStains)scene.remove(p.m);bloodStains.length=0;for(const v of civilMeshes.values()){v.rig.reset();setVictimClipping(v,false);v.g.scale.setScalar(1);v.shadow.visible=true;v.bloodStage=0;}}
function toast(text,t=3){$('toast').textContent=text;$('toast').style.opacity=1;toastTime=t;}
function reset(){clearFeedingEffects();captureState=null;$('captureFade').style.opacity=0;for(const v of monsterMeshes.values()){v.rig.reset();v.g.scale.setScalar(1);v.g.visible=false;}player={x:0,y:0,z:54,yaw:0,pitch:0,health:100,stamina:1,alive:true,hiding:false,noise:0,flashes:difficultyProfile().flashes,flashlight:true,crouching:false,fov:prefs.fov};elapsed=0;powered=false;fuseTotal=0;danger=0;flashTime=0;damageTime=0;sprintLatched=false;keys.clear();touch.x=touch.y=0;touch.run=false;objectives=createEscapeObjectives(difficulty);sim.reset(difficulty);sim.setExitOpen(false);for(const i of interactables)if('collected'in i){i.collected=false;if(i.mesh)i.mesh.visible=taskEnabled(i);if(i.halo)i.halo.visible=taskEnabled(i);if(i.indicator)i.indicator.material.color.setHex(0xefb36b);}for(let j=0;j<3;j++)scene.getObjectByName('powerLed'+j).material.color.setHex(0x9b543a);for(const l of lights)l.light.intensity=l.base;$('objectiveTag').textContent='01 / RESTORE POWER';$('objectiveTitle').textContent='Find the three emergency fuses';$('objectiveDetail').textContent='Search the shops, service rooms, and upper west gallery.';$('interaction').classList.add('hidden');$('damage').style.opacity=0;refreshObjectives();syncActors(.1);}
function begin(){reset();mode='playing';for(const id of ['title','pause','end'])$(id).classList.add('hidden');$('hud').classList.remove('hidden');sound.start();capture();refreshObjectives();toast(difficultyProfile().name.toUpperCase()+' · 3 fuses + '+objectives.tasks.length+' escape tasks. Amber map dots mark tasks.',6);}
function capture(){if(controller.active)return;if(matchMedia('(pointer:coarse)').matches)return;try{const p=$('game').requestPointerLock();if(p?.catch)p.catch(()=>{toast('Drag to look, or use the arrow keys.',3);});}catch{toast('Drag to look, or use the arrow keys.',3);}}
function pauseGame(){if(mode!=='playing')return;mode='paused';keys.clear();touch.x=touch.y=0;touch.run=false;if(document.pointerLockElement)document.exitPointerLock();$('pause').classList.remove('hidden');$('hud').classList.add('hidden');}
function resume(){if(mode!=='paused')return;mode='playing';$('pause').classList.add('hidden');$('hud').classList.remove('hidden');sound.start();capture();}
function finish(win){if(mode!=='playing'&&mode!=='captured')return;mode=win?'won':'dead';player.alive=false;if(document.pointerLockElement)document.exitPointerLock();keys.clear();$('hud').classList.add('hidden');$('end').classList.remove('hidden');$('endEyebrow').textContent=win?'Transmission received / you made it':'Transmission lost / no signal';$('endTitle').innerHTML=win?'YOU MADE<br><span>IT OUT.</span>':'THE MALL<br><span>KEPT YOU.</span>';$('endDescription').textContent=win?'Cold air. Distant sirens. Behind you, something hits the glass. You do not look back.':'One grip is all it takes. Keep your distance, save a flash for the return trip, and use the upper gallery to break pursuit.';let best=0;try{best=Number(localStorage.getItem('monsterMallBestV3_'+difficulty)||0);if(win&&(!best||elapsed<best)){best=elapsed;localStorage.setItem('monsterMallBestV3_'+difficulty,String(elapsed));}}catch{}$('endStats').innerHTML=`${difficultyProfile().name.toUpperCase()} &nbsp; · &nbsp; TIME ${fmt(elapsed)}<br>FUSES ${fuseTotal}/3 &nbsp; · &nbsp; EXTRA TASKS ${objectives.tasks.length-objectives.remaining.length}/${objectives.tasks.length}<br>EVACUATED ${sim.rescued} &nbsp; · &nbsp; CONSUMED ${sim.eaten}${best?'<br>BEST ESCAPE '+fmt(best):''}`;sound.event(win?'win':'lose',player.x,player.z,player);}
function fmt(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');}
let nearby=null;
function getNearby(){let nearest=null,best=2.35;for(const i of interactables){if(i.collected||!taskEnabled(i)||Math.abs((i.y||0)-player.y)>1)continue;const d=Math.hypot(player.x-i.x,player.z-i.z),stop=Math.min(.82,d);if(d<best&&(player.y>3||lineOfSight(player.x,player.z,i.x+(player.x-i.x)*stop/Math.max(.01,d),i.z+(player.z-i.z)*stop/Math.max(.01,d)))){nearest=i;best=d;}}return nearest;}
function use(){
 if(mode!=='playing')return;const i=getNearby();if(!i)return;
 if(i.type==='fuse'){i.collected=true;i.mesh.visible=false;i.halo.visible=false;fuseTotal++;scene.getObjectByName('powerLed'+(fuseTotal-1)).material.color.setHex(0xbad5aa);sound.event('collect',i.x,i.z,player);toast('FUSE '+fuseTotal+'/3 RECOVERED · '+i.label,3);if(fuseTotal===3)toast('All fuses recovered. Restore power at the north security panel.',4);}
 else if(i.type==='panel'){if(fuseTotal<3){toast('Power offline. '+(3-fuseTotal)+' emergency fuses still missing.',3);return;}if(powered)return;powered=true;sim.noise(0,-55,2,0);sound.event('power',0,-55,player);for(const l of lights)l.light.intensity=l.base*1.7;toast(objectives.remaining.length?'POWER RESTORED · '+objectives.remaining.length+' escape tasks still required':'POWER RESTORED · MAIN EXIT UNLOCKED',5);}
 else if(i.type==='crankPickup'){objectives.takeCrank();i.collected=true;i.mesh.visible=false;i.halo.visible=false;sound.event('collect',i.x,i.z,player);toast('Shutter crank recovered. Take it to the south exit mechanism.',4);}
 else if(i.type==='task'){
  const task=objectives.tasks.find(t=>t.id===i.taskId);if(!task||task.done)return;
  if(task.requiresPower&&!powered){toast('This mechanism needs power. Install the three fuses at security.',3);return;}
  if(task.id==='crank'&&!objectives.hasCrank){toast('The crank is missing. Search west deliveries in the staff corridor.',4);return;}
  if(task.id==='lockdown'&&objectives.remaining.some(t=>t.id!=='lockdown')){toast('Lockdown override refused. Complete the other escape tasks first.',4);return;}
  if(objectives.complete(task.id,powered)){i.collected=true;i.indicator.material.color.setHex(0xbad5aa);i.halo.visible=false;sound.event('collect',i.x,i.z,player);sim.noise(i.x,i.z,task.id==='keycard'?.25:1.5,i.y||0);toast(task.id==='lockdown'?'LOCKDOWN CANCELLED. The Still One knows the way out.':task.name.toUpperCase()+' · COMPLETE',4);}
 }
 else if(i.type==='exit'){if(!powered){toast('Main doors locked. Restore power at mall security.',3);return;}if(!objectives.canEscape(powered)){toast('Exit locked: '+objectives.remaining.length+' escape tasks remain. '+objectives.remaining[0].name+'.',4);return;}finish(true);}
 else if(i.type==='med'){if(player.health>=100)return;player.health=Math.min(100,player.health+50);i.collected=true;i.mesh.visible=false;}
 else if(i.type==='flash'){player.flashes+=2;i.collected=true;i.mesh.visible=false;sound.event('collect',i.x,i.z,player);toast('Two stun flashes recovered.');}
 syncEscapeGate();refreshObjectives();
}
function stun(){if(mode!=='playing')return;if(!player.flashes){toast('No stun flashes. Check the shops for supplies.');return;}player.flashes--;flashTime=gentle?.12:.35;sound.event('flash',player.x,player.z,player);sim.noise(player.x,player.z,1.3,player.y);let n=0;for(const m of sim.monsters){if(Math.hypot(m.x-player.x,m.z-player.z)<10&&Math.abs((m.y||0)-player.y)<2.2&&lineOfSight(player.x,player.z,m.x,m.z)){m.stunned=difficultyProfile().stun;n++;}}toast(n?'Blinded. Move before they recover.':'Flash discharged. The noise will carry.',2.5);}
$('start').onclick=begin;$('restart').onclick=begin;$('resume').onclick=resume;$('mute').onclick=()=>{$('mute').textContent=sound.toggle()?'SOUND ON':'SOUND MUTED';};$('backMenu').onclick=()=>{mode='title';$('end').classList.add('hidden');$('title').classList.remove('hidden');};
function applySettings(){lookSensitivity=prefs.sensitivity;gentle=prefs.reduced;quality=prefs.quality;sound.setVolume(prefs.volume);renderer.toneMappingExposure=1.1*prefs.brightness;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.5:quality==='medium'?1:.75));renderer.shadowMap.enabled=quality!=='low';flashlight.castShadow=quality!=='low';dust.visible=quality!=='low';renderer.setSize(innerWidth,innerHeight);$('sensitivityValue').textContent=prefs.sensitivity.toFixed(1)+'×';$('moveSpeedValue').textContent=prefs.moveSpeed.toFixed(2)+'×';$('fovValue').textContent=prefs.fov+'°';$('volumeValue').textContent=Math.round(prefs.volume*100)+'%';$('brightnessValue').textContent=prefs.brightness.toFixed(2)+'×';}
function showSettings(){if(mode==='playing')pauseGame();$('settingsScreen').classList.remove('hidden');$('closeSettings').focus?.();}
function closeSettings(){$('settingsScreen').classList.add('hidden');}
$('openSettings').onclick=showSettings;$('pauseSettings').onclick=showSettings;$('closeSettings').onclick=closeSettings;
const fullscreenButtons=['fullscreenToggle','titleFullscreen','pauseFullscreen'];let fullscreenNoticeTimer,fullscreenUnavailable=false;
function fullscreenActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function syncFullscreenButtons(){const active=fullscreenActive();for(const id of fullscreenButtons){const button=$(id);if(!button)continue;button.ariaLabel=active?'Exit fullscreen':'Enter fullscreen';button.title=active?'Exit fullscreen (Esc or F11)':'Fullscreen (F11)';if(id!=='fullscreenToggle')button.textContent=active?'EXIT FULLSCREEN ⛶':'FULLSCREEN ⛶';}camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
async function toggleFullscreen(){try{if(fullscreenActive()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(!exit)throw Error('Fullscreen unavailable');await exit.call(document);}else{const target=document.documentElement,enter=target?.requestFullscreen||target?.webkitRequestFullscreen;if(!enter)throw Error('Fullscreen unavailable');await enter.call(target);}fullscreenUnavailable=false;syncFullscreenButtons();$('fullscreenNotice').classList.add('hidden');}catch{fullscreenUnavailable=true;const notice=$('fullscreenNotice');notice.textContent='Open this game in Chrome or Edge for fullscreen, or try F11.';notice.classList.remove('hidden');clearTimeout(fullscreenNoticeTimer);fullscreenNoticeTimer=setTimeout(()=>notice.classList.add('hidden'),6000);}}
for(const id of fullscreenButtons)$(id).onclick=()=>void toggleFullscreen();
document.addEventListener('fullscreenchange',syncFullscreenButtons);document.addEventListener('webkitfullscreenchange',syncFullscreenButtons);syncFullscreenButtons();
try{const saved=JSON.parse(localStorage.getItem('monsterMallSettingsV2')||'{}');for(const k of Object.keys(prefs)){if(typeof saved[k]===typeof prefs[k])prefs[k]=saved[k];}}catch{}
for(const k of ['sensitivity','moveSpeed','fov','volume','brightness']){const ranges={sensitivity:[.4,4],moveSpeed:[.75,1.35],fov:[65,100],volume:[0,1],brightness:[.7,1.5]};prefs[k]=Number.isFinite(prefs[k])?clamp(prefs[k],...ranges[k]):Number($(k).value);}
if(!['high','medium','low'].includes(prefs.quality))prefs.quality='high';
for(const k of Object.keys(prefs)){const el=$(k);if(typeof prefs[k]==='boolean')el.checked=prefs[k];else el.value=prefs[k];const changed=()=>{prefs[k]=typeof prefs[k]==='boolean'?el.checked:typeof prefs[k]==='number'?Number(el.value):el.value;applySettings();try{localStorage.setItem('monsterMallSettingsV2',JSON.stringify(prefs));}catch{}};el.oninput=changed;el.onchange=changed;}
applySettings();
syncDifficultyMenu();$('difficulty').onchange=()=>{difficulty=Object.hasOwn(MALL_DIFFICULTIES,$('difficulty').value)?$('difficulty').value:'normal';try{localStorage.setItem('monsterMallDifficultyV3',difficulty);}catch{}syncDifficultyMenu();if(mode==='title')reset();};
const controller=createMallController({getState:()=>({mode,settingsOpen:!$('settingsScreen').classList.contains('hidden')}),onAction:action=>{
 if(action==='back'){if(!$('settingsScreen').classList.contains('hidden'))closeSettings();else if(mode==='paused')resume();else if(mode==='won'||mode==='dead')$('backMenu').click();return;}
 if(action==='pause'){if(!$('settingsScreen').classList.contains('hidden'))closeSettings();else if(mode==='playing')pauseGame();else if(mode==='paused')resume();return;}
 if(mode!=='playing')return;
 if(action==='use')use();if(action==='stun')stun();if(action==='crouch'){player.crouching=!player.crouching;sprintLatched=false;}if(action==='light'){player.flashlight=!player.flashlight;sound.event('click',player.x,player.z,player);}if(action==='map'){mapVisible=!mapVisible;$('map').classList.toggle('hidden',!mapVisible);$('map-label').classList.toggle('hidden',!mapVisible);}
},onConnection:({connected,mapping})=>{$('controllerStatus').textContent=connected?(mapping==='standard'?'CONTROLLER CONNECTED · A / ✕ SELECT':'CONTROLLER DETECTED · CHECK BUTTON LAYOUT'):'CONTROLLER READY · CONNECT USB / BLUETOOTH, THEN PRESS A BUTTON';}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('keydown',e=>{controller.markKeyboard();if(e.code==='F11'){const supported=!fullscreenUnavailable&&(document.fullscreenEnabled??document.webkitFullscreenEnabled)!==false&&!!(document.documentElement?.requestFullscreen||document.documentElement?.webkitRequestFullscreen);if(fullscreenActive()||supported){e.preventDefault();if(!e.repeat)void toggleFullscreen();}return;}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&mode==='playing')e.preventDefault();if(e.repeat)return;if(e.code==='KeyO'){if($('settingsScreen').classList.contains('hidden'))showSettings();else closeSettings();return;}if(!$('settingsScreen').classList.contains('hidden')){if(e.code==='Escape')closeSettings();return;}keys.add(e.code);if(e.code==='Escape'||e.code==='KeyP'){if(mode==='playing')pauseGame();else if(mode==='paused')resume();return;}if(mode!=='playing')return;if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&prefs.toggleSprint)sprintLatched=!sprintLatched;if(e.code==='KeyE')use();if(e.code==='KeyQ')stun();if(e.code==='KeyF'){player.flashlight=!player.flashlight;sound.event('click',player.x,player.z,player);}if(e.code==='KeyC'){player.crouching=!player.crouching;sprintLatched=false;}if(e.code==='KeyM'){mapVisible=!mapVisible;$('map').classList.toggle('hidden',!mapVisible);$('map-label').classList.toggle('hidden',!mapVisible);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(mode==='playing')pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing')pauseGame();});
let dragging=false,dragX=0,dragY=0;
$('game').addEventListener('pointerdown',e=>{if(mode!=='playing')return;if(e.pointerType!=='touch'){controller.markKeyboard();pad.active=false;if(!document.pointerLockElement){dragging=true;dragX=e.clientX;dragY=e.clientY;capture();}}else if(e.clientX>innerWidth*.38){dragging=true;dragX=e.clientX;dragY=e.clientY;$('game').setPointerCapture(e.pointerId);}});
addEventListener('pointerup',()=>dragging=false);
addEventListener('pointermove',e=>{if(e.movementX||e.movementY)controller.markKeyboard();if(mode!=='playing')return;let dx=0,dy=0;if(document.pointerLockElement){dx=e.movementX;dy=e.movementY;}else if(dragging){dx=e.clientX-dragX;dy=e.clientY-dragY;dragX=e.clientX;dragY=e.clientY;}player.yaw-=dx*.0026*lookSensitivity;player.pitch=clamp(player.pitch-dy*.0024*lookSensitivity*(prefs.invertY?-1:1),-1.1,1.1);});
const stick=$('stick');let stickId=null,stickX=0,stickY=0;stick.onpointerdown=e=>{stickId=e.pointerId;const r=stick.getBoundingClientRect();stickX=r.left+r.width/2;stickY=r.top+r.height/2;stick.setPointerCapture(e.pointerId);};stick.onpointermove=e=>{if(e.pointerId!==stickId)return;touch.x=clamp((e.clientX-stickX)/38,-1,1);touch.y=clamp((e.clientY-stickY)/38,-1,1);};const releaseStick=()=>{touch.x=touch.y=0;stickId=null;};stick.onpointerup=releaseStick;stick.onpointercancel=releaseStick;
$('touchE').onclick=use;$('touchQ').onclick=stun;$('touchF').onclick=()=>player.flashlight=!player.flashlight;$('touchRun').onpointerdown=()=>touch.run=true;$('touchRun').onpointerup=()=>touch.run=false;$('touchRun').onpointercancel=()=>touch.run=false;
function updatePlayer(dt){
 const look=lookSensitivity/1.8;player.fov=camera.fov;player.aspect=camera.aspect;player.yaw-=pad.lookX*dt*2.3*look;player.pitch=clamp(player.pitch-pad.lookY*dt*1.8*look*(prefs.invertY?-1:1),-1.1,1.1);player.yaw+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*dt*2.1*look;player.pitch=clamp(player.pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt*look*(prefs.invertY?-1:1),-1.1,1.1);
 let dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touch.x+pad.moveX,dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touch.y+pad.moveY;const len=Math.hypot(dx,dz);if(len>1){dx/=len;dz/=len;}
 const moving=len>.1,sprinting=moving&&((prefs.toggleSprint?sprintLatched:keys.has('ShiftLeft')||keys.has('ShiftRight'))||touch.run||pad.sprint)&&player.stamina>.04&&!player.crouching;const speed=(player.crouching?1.7:sprinting?6.5:3.8)*prefs.moveSpeed;const oldX=player.x,oldZ=player.z;
 moveEntity(player,(dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))*speed*dt,(-dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))*speed*dt,.29);player.stamina=clamp(player.stamina+(sprinting?-.19:.15)*dt,0,1);
 player.hiding=player.crouching&&!player.flashlight&&!sim.monsters.some(m=>actorCanSee(m,player));player.noise=moving?(sprinting?1:player.crouching?.05:.26):0;if(moving&&sprinting&&frame%14===0)sim.noise(player.x,player.z,.65,player.y);
 let nearest=99;for(const m of sim.monsters)nearest=Math.min(nearest,Math.hypot(m.x-player.x,m.z-player.z,(m.y||0)-player.y));danger=clamp(1-nearest/17,0,1);sound.update(dt,{danger,stamina:player.stamina,moving:Math.hypot(player.x-oldX,player.z-oldZ)>.005,sprinting});
 const bob=gentle||!prefs.headBob?0:moving?Math.sin(elapsed*(sprinting?14:9))*(sprinting?.04:.018):Math.sin(elapsed*1.5)*.005;camera.position.set(player.x,player.y+(player.crouching?1.12:1.69)+bob,player.z);camera.rotation.set(player.pitch,player.yaw,0);if(!gentle&&prefs.screenShake){camera.position.y+=Math.sin(footfallImpulse*180)*footfallImpulse;camera.rotation.z=Math.sin(elapsed*48)*damageTime*.025+footfallImpulse*.2;}
 camera.fov+=((sprinting?prefs.fov+4:prefs.fov)-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();if(player.health<=0)finish(false);
}
function renderMap(){const cv=$('map'),c=cv.getContext('2d'),s=1.75,ox=120,oy=120;const px=x=>ox+x*s,pz=z=>oy+z*s;c.clearRect(0,0,240,240);c.strokeStyle='#729a7540';c.lineWidth=1;c.strokeRect(px(-43),pz(-59),86*s,118*s);c.fillStyle='#667e6744';for(const o of obstacles.filter(o=>player.y>3.5?(o.high??2)>4.5:(o.low||0)<1.8))c.fillRect(px(o.x-o.w/2),pz(o.z-o.d/2),Math.max(1,o.w*s),Math.max(1,o.d*s));c.font='8px Consolas';c.textAlign='center';c.fillStyle='#78927b';c.fillText('N / SECURITY',120,10);c.fillText('MAIN EXIT',120,237);for(const i of interactables){if(i.collected||!taskEnabled(i))continue;if(i.type==='task'||i.type==='crankPickup'||i.type==='fuse'||(i.type==='panel'&&fuseTotal===3&&!powered)||(i.type==='exit'&&objectives.canEscape(powered))){c.fillStyle=i.type==='exit'?'#d5e9c0':Math.abs((i.y||0)-player.y)>2?'#9ca8c199':'#e4b875';c.beginPath();c.arc(px(i.x),pz(i.z),3.2,0,TAU);c.fill();}}for(const st of STAIRS){c.strokeStyle='#8eae8999';c.beginPath();c.moveTo(px(st.x),pz(st.bottomZ));c.lineTo(px(st.x),pz(st.topZ));c.stroke();}for(const m of sim.monsters)if(Math.hypot(m.x-player.x,m.z-player.z)<11){c.fillStyle='#dc785e88';c.beginPath();c.arc(px(m.x),pz(m.z),3.5,0,TAU);c.fill();}c.save();c.translate(px(player.x),pz(player.z));c.rotate(-player.yaw);c.fillStyle='#d1ecc3';c.beginPath();c.moveTo(0,-5);c.lineTo(-3.2,4);c.lineTo(3.2,4);c.closePath();c.fill();c.restore();}
function updateHud(){$('healthValue').textContent=danger>.7?'IN DANGER':'FREE';$('healthBar').style.width=clamp(danger*100,3,100)+'%';$('staminaBar').style.width=player.stamina*100+'%';$('stance').textContent=player.crouching?'CROUCHING':player.noise>.5?'RUNNING':player.noise>0?'WALKING':'STILL';$('timer').textContent=fmt(elapsed);$('fuseCount').textContent=`${fuseTotal} / 3`;$('flashCount').textContent=player.flashes;$('rescued').textContent=String(sim.rescued).padStart(2,'0');$('eaten').textContent=String(sim.eaten).padStart(2,'0');$('threat').textContent=danger>.7?'IT IS CLOSE':danger>.35?'MOVEMENT NEARBY':'LISTEN CAREFULLY';$('threat').classList.toggle('danger',danger>.65);nearby=getNearby();$('interaction').classList.toggle('hidden',!nearby);if(nearby)$('interaction').textContent=(pad.active?'[ A / ✕ ]':matchMedia('(pointer:coarse)').matches?'USE':'[ E ]')+'  '+(nearby.type==='panel'?(powered?'Power restored':fuseTotal===3?'Install fuses & restore power':'Power offline · fuses required'):nearby.type==='exit'?(objectives.canEscape(powered)?'Open main doors · escape':powered?'Main exit · '+objectives.remaining.length+' tasks remain':'Main exit · power locked'):nearby.name);$('map-label').textContent=(pad.active?'VIEW / ':'M / ')+(player.y>3.5?'LEVEL 02 · UPPER GALLERY':'LEVEL 01 · CONCOURSE');if(mapVisible&&frame%5===0)renderMap();}
function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.045);last=now;frame++;pad=controller.update(dt);document.body.classList.toggle('using-controller',pad.active);gentle=$('reduced').checked;
 footfallImpulse=Math.max(0,footfallImpulse-dt*.12);footCaptionClock=Math.max(0,footCaptionClock-dt);
 if(mode==='playing'){elapsed+=dt;updatePlayer(dt);if(mode==='playing')sim.update(dt,player);syncActors(dt);updateHud();toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0;}
 else if(mode==='captured'){updateCapture(dt);}
 else if(mode==='title'){const t=now*.00005;camera.position.set(3+Math.sin(t)*.6,1.8,21);camera.rotation.set(.015,-.12+Math.sin(t)*.04,0);syncActors(dt);const exhibit=monsterMeshes.get(0);if(exhibit){exhibit.g.position.set(5.5,0,16.7);exhibit.g.rotation.y=-.18;exhibit.g.scale.setScalar(monsterScaleLimit(sim.monsters[0]?.type));}}
 else if(mode==='dead'){camera.position.y=Math.max(.45,camera.position.y-dt*.5);camera.rotation.z+=(.16-camera.rotation.z)*dt;}
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);flashlight.position.copy(camera.position).add(new THREE.Vector3(.1,-.12,0));if(mode==='title')flashlight.target.position.set(5.5,2.8,16.7);else flashlight.target.position.copy(camera.position).addScaledVector(dir,14);flashlight.intensity=player.flashlight?(captureState?1.2:mode==='title'?32:62):0;nearLight.position.copy(camera.position);nearLight.intensity=captureState?.006:player.flashlight?.32:.025;
 const time=now*.001;for(let j=0;j<flickers.length;j++){const l=flickers[j],base=lights.find(q=>q.light===l)?.base||20;const f=gentle?1:Math.sin(time*9+j*12)>.97?.2:1;l.intensity=base*(powered?1.7:1)*f;}
 for(const f of interactables)if(f.type==='fuse'&&!f.collected){f.mesh.rotation.z=Math.sin(time*2)*.15;f.mesh.rotation.y=time*.5;f.mesh.position.y=(f.y||0)+1.3+Math.sin(time*2)*.07;}
 if(mode!=='paused')updateEffects(dt);
 dust.rotation.y=Math.sin(time*.02)*.03;flashTime=Math.max(0,flashTime-dt);damageTime=Math.max(0,damageTime-dt);$('flash').style.opacity=gentle?Math.min(.13,flashTime):flashTime*1.8;$('damage').style.opacity=mode==='playing'?Math.min(.7,damageTime*.65+Math.max(0,(35-player.health)/100)):mode==='dead'?.35:0;
 const nearestLights=lights.slice().sort((a,b)=>a.light.position.distanceToSquared(camera.position)-b.light.position.distanceToSquared(camera.position));for(let j=0;j<lightPool.length;j++){const source=nearestLights[j]?.light,l=lightPool[j];if(source){l.position.copy(source.position);l.color.copy(source.color);l.intensity=source.intensity;l.distance=source.distance;}else l.intensity=0;}
 renderer.render(scene,camera);
}
// Reuse a fixed small lighting budget as the much larger mall streams past.
for(const l of lights)scene.remove(l.light);
const lightPool=Array.from({length:6},()=>{const l=new THREE.PointLight(0xffffff,0,9,2);scene.add(l);return l;});
const assetResults=await Promise.allSettled([initRealHumans(THREE),typeof initHorrorCreatureTextures==='function'?initHorrorCreatureTextures(THREE):Promise.resolve(false)]);realHumansReady=assetResults[0].status==='fulfilled'&&assetResults[0].value;if(!realHumansReady)console.warn('Detailed people could not load. Using the included fallback.');if(assetResults[1].status==='rejected')console.warn('Using the included fallback creature material.');
reset();$('start').disabled=false;$('start').innerHTML='<span>ENTER THE MALL</span><span>↗</span>';requestAnimationFrame(tick);
// Read-only runtime snapshot used for local quality checks; no gameplay shortcuts.
window.mallDiagnostics=()=>({mode,elapsed,player:{...player},fuses:fuseTotal,powered,difficulty,extraTasks:objectives.tasks.map(t=>({id:t.id,done:t.done})),hasCrank:objectives.hasCrank,exitOpen:sim.exitOpen,controller:{connected:pad.connected,active:pad.active},civilians:sim.civilians.map(c=>({id:c.id,x:c.x,z:c.z,alive:c.alive,escaped:c.escaped,crouching:c.crouching,hiding:c.hiding,state:c.state,panic:c.panic,coverId:c.coverId})),monsters:sim.monsters.map(m=>({id:m.id,x:m.x,z:m.z,scale:m.scale,state:m.state,type:m.type,observed:m.observed,y:m.y})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2,obstacles:obstacles.length});
})();



