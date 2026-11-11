/* Nova, Sky and Kai by VTubeMe, CC BY4.0: https://vtubeme.com/free-vrm-avatars
   Original textured adult model; garment shades and articulated gait adapted.
   Model, photographic maps, facial morphs and full skeleton are bundled offline. */
const realHumanStates=new WeakMap();
export async function initRealHumans(THREE){
 const existing=realHumanStates.get(THREE);if(existing)return existing.promise;
 const state={};realHumanStates.set(THREE,state);
 state.promise=(async()=>{
  const tools=createRealHumanTools(THREE),models=typeof REAL_HUMAN_GLBS!=="undefined"?REAL_HUMAN_GLBS:[REAL_HUMAN_GLB];
  state.profiles=await Promise.all(models.map(async(encodedModel,index)=>{
  const profile={tools,name:["Nova","Sky","Kai"][index]||"Shopper"},encoded=atob(encodedModel),bytes=new Uint8Array(encoded.length);for(let i=0;i<encoded.length;i++)bytes[i]=encoded.charCodeAt(i);
  const gltf=await new tools.GLTFLoader().parseAsync(bytes.buffer,'');gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene,true),height=bounds.max.y-bounds.min.y;if(!Number.isFinite(height)||height<.1)throw Error('Invalid human dimensions');
  profile.reference=gltf.scene;profile.scale=1.85/height;profile.bottom=bounds.min.y;profile.wardrobes=[];
  const originals=new Map();gltf.scene.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])originals.set(material.uuid,material);});
  for(const shade of [0xffffff,0xa9c2d1,0xc4b8a5]){
   const palette=new Map();for(const[key,source]of originals){
    const material=new THREE.MeshStandardMaterial({name:source.name,map:source.map||null,color:source.color?.clone()||new THREE.Color(0xffffff),normalMap:source.normalMap||null,roughness:.82,metalness:0,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest||0,side:source.side,depthWrite:source.depthWrite});
    if(/outfit_top/i.test(source.name))material.color.multiply(new THREE.Color(shade));
    if(/eye(ball)?/i.test(source.name)&&!/lash/i.test(source.name))material.roughness=.38;
    palette.set(key,material);
   }profile.wardrobes.push(palette);
  }
  return profile;}));
  state.shadowGeometry=new THREE.CircleGeometry(.29,16);state.shadowMaterial=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.23,depthWrite:false});for(const profile of state.profiles){profile.shadowGeometry=state.shadowGeometry;profile.shadowMaterial=state.shadowMaterial;}state.ready=true;return true;
 })();return state.promise;
}

export function createRealHuman(THREE,person={}){
 const library=realHumanStates.get(THREE);if(!library?.ready)throw Error('Await initRealHumans first');
 const id=Math.abs(Number(person.id)||0),state=library.profiles[id%library.profiles.length],group=new THREE.Group();group.name='Textured adult shopper / '+state.name+' '+id;
 const normalized=new THREE.Group();normalized.name='Human dimensions / 1.85 meters';normalized.scale.setScalar(state.scale);normalized.position.y=-state.bottom*state.scale;group.add(normalized);
 const model=state.tools.clone(state.reference);normalized.add(model);const bones=new Map(),faces=[];
 model.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/[^a-zA-Z0-9]/g,''),o);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const palette=state.wardrobes[Math.floor(id/library.profiles.length)%3];o.material=Array.isArray(o.material)?o.material.map(m=>palette.get(m.uuid)):palette.get(o.material.uuid);if(o.morphTargetDictionary)faces.push(o);}});
 const find=name=>bones.get(name)||bones.get('mixamorig'+name),arms=[find('LeftArm'),find('RightArm')],legs=[find('LeftUpLeg'),find('RightUpLeg')],elbows=[find('LeftForeArm'),find('RightForeArm')],knees=[find('LeftLeg'),find('RightLeg')],hands=[find('LeftHand'),find('RightHand')],feet=[find('LeftFoot'),find('RightFoot')];
 if([...arms,...legs,...elbows,...knees].some(o=>!o))throw Error('Human rig missing required joints');
 const shadow=new THREE.Mesh(state.shadowGeometry,state.shadowMaterial);shadow.name='Contact shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.014;group.add(shadow);
 group.updateMatrixWorld(true);const rests=new Map();for(const bone of bones.values())rests.set(bone,{local:bone.quaternion.clone(),world:bone.getWorldQuaternion(new THREE.Quaternion()),position:bone.position.clone()});
 const groupQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),desired=new THREE.Vector3(),referenceDirection=new THREE.Vector3(),worldQ=new THREE.Quaternion(),delta=new THREE.Quaternion(),axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0);
 function aim(bone,child,x,y,z){
  const rest=rests.get(bone);referenceDirection.copy(child.position).normalize().applyQuaternion(rest.world).applyQuaternion(groupQ);
  desired.set(x,y,z).normalize().applyQuaternion(groupQ);delta.setFromUnitVectors(referenceDirection,desired);worldQ.copy(groupQ).multiply(rest.world).premultiply(delta);
  bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(worldQ));bone.updateMatrixWorld(true);
 }
 function bend(bone,axis,angle){if(!bone)return;bone.quaternion.copy(rests.get(bone).local).multiply(delta.setFromAxisAngle(axis,angle));bone.updateMatrixWorld(true);}
 const hips=find('Hips'),spine=find('Spine'),chest=find('Spine2'),head=find('Head'),toes=[find('LeftToeBase'),find('RightToeBase')];let oldX,oldZ,speed=0,panic=0,crouch=0;
 const footPoint=new THREE.Vector3(),faceRests=new Map(faces.map(face=>[face,face.morphTargetInfluences.slice()]));
 // Cache the actual shoe bounds in foot space once per character. A bone's
 // origin sits above its sole, so pinning only that origin sinks bent shoes.
 if(!state.soleBoxes){
  state.soleBoxes=[new THREE.Box3(),new THREE.Box3()];
  model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;
   for(let vertex=0;vertex<indices.count;vertex++){
    const strength=[0,0];for(let slot=0;slot<4;slot++){const bone=mesh.skeleton.bones[indices.getComponent(vertex,slot)],weight=weights.getComponent(vertex,slot);for(let side=0;side<2;side++)if(bone===feet[side]||bone===toes[side])strength[side]+=weight;}
    const side=strength[0]>=strength[1]?0:1;if(strength[side]<.5||!feet[side])continue;
    mesh.getVertexPosition(vertex,footPoint);mesh.localToWorld(footPoint);group.worldToLocal(footPoint);if(footPoint.y>.12)continue;group.localToWorld(footPoint);feet[side].worldToLocal(footPoint);state.soleBoxes[side].expandByPoint(footPoint);
   }
  });
 }
 function footLevel(){group.updateMatrixWorld(true);let lowest=Infinity;for(let side=0;side<2;side++){const box=state.soleBoxes[side],foot=feet[side];if(!foot)continue;if(box&&!box.isEmpty()){for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){footPoint.set(x,y,z);foot.localToWorld(footPoint);group.worldToLocal(footPoint);lowest=Math.min(lowest,footPoint.y);}}else{foot.getWorldPosition(footPoint);group.worldToLocal(footPoint);lowest=Math.min(lowest,footPoint.y);}}return lowest;}
 function reset(){oldX=oldZ=undefined;speed=panic=crouch=0;for(const[bone,rest]of rests){bone.quaternion.copy(rest.local);bone.position.copy(rest.position);}for(const[face,values]of faceRests)face.morphTargetInfluences.splice(0,values.length,...values);normalized.position.y=-state.bottom*state.scale;update(0,{x:0,z:0,phase:0,panic:0,moving:false,grabbed:false},0);oldX=oldZ=undefined;}
 function update(dt,c,time=0){
  const smooth=1-Math.exp(-Math.min(.1,Math.max(0,dt))*9);if(oldX!==undefined&&dt>0)speed+=(Math.min(7,Math.hypot(c.x-oldX,c.z-oldZ)/dt)-speed)*smooth;oldX=c.x;oldZ=c.z;panic+=(Math.max(0,Math.min(1,Number(c.panic)||0))-panic)*smooth;
  const grabbed=!!c.grabbed||c.grabbedBy!==null&&c.grabbedBy!==undefined;
  if(grabbed)crouch=0;else crouch+=((c.crouching||c.hiding||c.state==='hide'?1:0)-crouch)*smooth;
  const quiet=!!c.hiding||c.state==='hide',stride=grabbed?0:(c.moving===false?0:Math.min(1,speed/1.5))*(1-crouch*.75),run=panic*stride,phase=(Number.isFinite(c.phase)?c.phase*.50:time*5),guard=grabbed?0:Math.max(crouch,panic*(quiet?.85:.7));
  group.getWorldQuaternion(groupQ);
  if(hips)hips.position.y=rests.get(hips).position.y-crouch*.54/state.scale;
  bend(hips,axisY,Math.sin(phase)*stride*.055);bend(spine,axisX,run*.11+crouch*.25);
  bend(chest,axisY,-Math.sin(phase)*stride*.075);if(chest){chest.quaternion.multiply(delta.setFromAxisAngle(axisX,crouch*.15+panic*.025+Math.sin(time*(quiet?2.4:3.1)+id)*panic*.006));chest.updateMatrixWorld(true);}
  bend(head,axisY,grabbed?Math.sin(time*13)*.14:Math.sin(time*(quiet?.62:1.4)+id)*(.04+panic*(quiet?.08:.16)));if(head){head.quaternion.multiply(delta.setFromAxisAngle(axisX,-crouch*.20+Math.sin(time*17+id)*panic*(quiet?.002:.006)));head.updateMatrixWorld(true);}
  for(let i=0;i<2;i++){
   const side=i===0?1:-1,wave=Math.sin(phase+(i===0?0:Math.PI)),upperAngle=-wave*stride*(.28+run*.38)*(1-guard)+guard*(.78+crouch*.22),elbowAngle=(upperAngle+.12+run*.85)*(1-guard)+guard*2.6;
   aim(arms[i],elbows[i],side*(.075+guard*.025),-Math.cos(upperAngle),Math.sin(upperAngle));
   const fore=grabbed?.6+Math.sin(time*15+i)*.45:elbowAngle+Math.sin(time*17+i)*panic*(quiet?.008:.02);aim(elbows[i],hands[i],side*.035,-Math.cos(fore),Math.sin(fore));bend(hands[i],axisX,guard*.2);
   const thighAngle=wave*stride*(.34+run*.44)+crouch*1.275,kneeBend=grabbed?.45+Math.max(0,Math.sin(time*16+i))*.8:Math.max(0,-wave)*stride*(.25+run*.85)+crouch*2.45,shinAngle=thighAngle-kneeBend;
   aim(legs[i],knees[i],side*.028,-Math.cos(thighAngle),Math.sin(thighAngle));aim(knees[i],feet[i],side*.018,-Math.cos(shinAngle),Math.sin(shinAngle));
   if(!grabbed&&feet[i]&&toes[i])aim(feet[i],toes[i],0,0,1);
  }
  normalized.position.y=-state.bottom*state.scale+Math.abs(Math.sin(phase*2))*stride*(.012+run*.025);
  if(!grabbed){const lowest=footLevel();if(Number.isFinite(lowest))normalized.position.y+=.008-lowest;}
  const blinkPhase=(time+id*.47)%4.3,blink=blinkPhase<.15?Math.sin(blinkPhase/.15*Math.PI):0;
  for(const face of faces)for(const[name,index]of Object.entries(face.morphTargetDictionary)){
   let value;
   if(/eyeBlink|blinkLeft|blinkRight/i.test(name))value=blink*(1-panic*.45);
   else if(/eyeWide/i.test(name))value=panic*.72;
   else if(/browInnerUp/i.test(name))value=panic*.8;
   else if(/browOuterUp/i.test(name))value=panic*.32;
   else if(/mouthFrown/i.test(name))value=panic*.48;
   else if(/mouthStretch/i.test(name))value=panic*.16;
   else if(/mouthPress/i.test(name))value=quiet?panic*.24:0;
   else if(/jawOpen|mouthOpen|viseme_aa/i.test(name))value=grabbed?.38+Math.sin(time*8)*.12:panic*(quiet?.025:.12);
   if(value!==undefined&&Number.isInteger(index)&&index>=0&&index<face.morphTargetInfluences.length)face.morphTargetInfluences[index]=Math.max(0,Math.min(1,value));
  }
 }
 reset();update(.016,{x:person.x||0,z:person.z||0,phase:0,panic:0,moving:false,grabbed:false},0);
 return {group,arms,legs,shadow,update,reset,name:group.name,isPhototextured:true};
}

