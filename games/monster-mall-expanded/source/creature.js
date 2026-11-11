/* A local, articulated horror model. Front is +Z; ground is Y=0.
   Geometry is sculpted into anatomical masses and merged per moving joint. */
const horrorCreatureCache = new WeakMap();
const horrorCreatureTextureStates = new WeakMap();

export async function initHorrorCreatureTextures(THREE) {
  const previous=horrorCreatureTextureStates.get(THREE);if(previous)return previous.promise;
  const state={};horrorCreatureTextureStates.set(THREE,state);
  state.promise=(async()=>{
    if(typeof MONSTER_SKIN_DATA!=='string'||!MONSTER_SKIN_DATA.startsWith('data:'))return false;
    const color=await new THREE.TextureLoader().loadAsync(MONSTER_SKIN_DATA);
    color.colorSpace=THREE.SRGBColorSpace;color.wrapS=color.wrapT=THREE.RepeatWrapping;color.anisotropy=4;
    const maps={color};
    if(typeof document!=='undefined'){
      const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(color.image,0,0,size,size);
      const pixels=context.getImageData(0,0,size,size).data,height=new Float32Array(size*size),normal=new Uint8Array(size*size*4),rough=new Uint8Array(normal.length),bone=new Uint8Array(normal.length);maps.photo={pixels,size};
      for(let i=0;i<height.length;i++)height[i]=(pixels[i*4]*.2126+pixels[i*4+1]*.7152+pixels[i*4+2]*.0722)/255;
      const sample=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const at=(y*size+x)*4,h=sample(x,y),dx=(sample(x+1,y)-sample(x-1,y))*4.2,dy=(sample(x,y+1)-sample(x,y-1))*4.2,length=Math.hypot(dx,dy,1);
        normal[at]=(-dx/length*.5+.5)*255;normal[at+1]=(-dy/length*.5+.5)*255;normal[at+2]=(1/length*.5+.5)*255;normal[at+3]=255;
        const r=Math.max(210,Math.min(248,218+h*24+Math.abs(dx+dy)*10));rough[at]=rough[at+1]=rough[at+2]=r;rough[at+3]=255;
        const stain=Math.max(0,.48-h)*70+((x*37+y*79)%101>94?8:0),striation=(Math.sin(x*.19+y*.043+h*8)*.5+.5)*6;
        const worn=154+(h-.45)*58-stain-striation,warm=(pixels[at]-pixels[at+2])*.11;
        bone[at]=worn+4+warm;bone[at+1]=worn+2;bone[at+2]=worn-6;bone[at+3]=255;
      }
      for(const[name,data]of [['normal',normal],['rough',rough],['bone',bone]]){
        const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;if(name==='bone')texture.colorSpace=THREE.SRGBColorSpace;maps[name]=texture;
      }
    }
    state.maps=maps;const library=horrorCreatureCache.get(THREE);if(library)applyHorrorSurfaceMaps(library,maps);return true;
  })();return state.promise;
}

function applyHorrorSurfaceMaps(library,maps){
  if(maps.photo&&!maps.blend&&library.baseColorMap?.image?.data){
    const THREE=library.THREE,{pixels,size}=maps.photo,base=library.baseColorMap.image,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const at=(y*size+x)*4,from=(Math.floor(y/size*base.height)*base.width+Math.floor(x/size*base.width))*4;
      for(let channel=0;channel<3;channel++)data[at+channel]=base.data[from+channel]*.70+pixels[at+channel]*.30;data[at+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.anisotropy=4;maps.blend=texture;
  }
  const all=[...Object.values(library.materials),...library.ownedMaterials];
  for(const material of all){
    const type=material.userData.horrorSurface;if(!type||type==='teeth')continue;
    material.map=maps.blend||maps.color;
    if(maps.normal){material.normalMap=maps.normal;material.normalScale.setScalar(type==='skin'?.30:type==='tendon'?.28:.20);material.bumpMap=null;}
    if(maps.rough)material.roughnessMap=maps.rough;
    material.needsUpdate=true;
  }
}

export function createHorrorCreature(THREE, type = 'stalker') {
  let library = horrorCreatureCache.get(THREE);
  if (!library) {
    library = buildCreatureLibrary(THREE);
    horrorCreatureCache.set(THREE, library);
  }
  const { geometries: geo, materials } = library;
  const watcher = type === 'watcher';
  const skin = materials[type] || materials.stalker;
  const bone = watcher ? materials.watcherBone : materials.bone;
  const tendon = watcher ? materials.watcherTendon : materials.tendon;
  const group = new THREE.Group();
  group.name = watcher ? 'The Still One / articulated watcher' : 'The Hollow / articulated creature';
  const body = new THREE.Group();
  // Keep the distortion inside the rig: the caller owns world growth and scale.
  if (watcher) body.scale.set(.75, 1.28, .78);
  group.add(body);

  function mesh(geometry, material, parent) {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function joint(name, x, y, z, parent) {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(x, y, z);
    parent.add(node);
    return node;
  }

  const hips = joint('pelvis', 0, 1.42, -0.07, body);
  mesh(geo.pelvis, skin, hips);
  mesh(geo.pelvisBone, bone, hips);
  const chest = joint('thorax', 0, 0.16, -0.015, hips);
  mesh(geo.torso, skin, chest);
  mesh(geo.ribs, bone, chest);
  mesh(geo.sinew, tendon, chest);
  const neck = joint('cervical spine', 0, 0.79, 0.10, chest);
  mesh(geo.neck, skin, neck);
  mesh(geo.neckTendons, tendon, neck);
  const head = joint('elongated skull', 0, 0.20, 0.20, neck);
  mesh(geo.skull, skin, head);
  mesh(geo.faceBone, watcher ? materials.watcherMask : materials.bone, head);
  mesh(geo.eyeSockets, materials.cavity, head);
  mesh(geo.eyes, materials.eye, head);
  if (watcher) {
    // A blank, long porcelain face hangs over the familiar articulated mouth.
    // The eye light is steady and has no point light or flashing effect.
    mesh(geo.watcherMask, materials.watcherMask, head);
    mesh(geo.watcherSockets, materials.cavity, head);
    mesh(geo.watcherEyes, materials.watcherEye, head);
    mesh(geo.watcherTears, materials.watcherTendon, head);
  }
  const upperTeeth = mesh(geo.upperTeeth, materials.teeth, head);
  const upperGum = mesh(geo.upperGum, materials.gum, head);
  mesh(geo.mouth, materials.cavity, head);
  const jaw = joint('mandible', 0, -0.075, 0.035, head);
  const jawSkin = mesh(geo.jaw, skin, jaw);
  const jawBone = mesh(geo.jawBone, bone, jaw);
  const lowerTeeth = mesh(geo.lowerTeeth, materials.teeth, jaw);
  const lowerGum = mesh(geo.lowerGum, materials.gum, jaw);
  const bloodTargets = [jawSkin, jawBone, upperTeeth, lowerTeeth, upperGum, lowerGum];
  const bloodMaterials = new Map();
  function setBloodiness(amount = 0) {
    const value = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
    if (!bloodMaterials.size && value === 0) return;
    if (!bloodMaterials.size) {
      // Only the stained surfaces receive owned material copies. Texture and
      // geometry stay shared, and repeated meals reuse these same three copies.
      for (const object of bloodTargets) {
        const original = object.material;
        let owned = bloodMaterials.get(original);
        if (!owned) {
          owned = { original, material: original.clone(), color: original.color.clone(), roughness: original.roughness };
          bloodMaterials.set(original, owned);
          library.ownedMaterials.add(owned.material);
        }
        object.material = owned.material;
      }
    }
    for (const owned of bloodMaterials.values()) {
      const stain = owned.original === materials.teeth ? 0x71151a : 0x6b0b13;
      owned.material.color.copy(owned.color).lerp(new THREE.Color(stain), value);
      owned.material.roughness = owned.roughness + (0.26 - owned.roughness) * value;
    }
  }
  function dispose() {
    for (const object of bloodTargets) for (const owned of bloodMaterials.values()) if (object.material === owned.material) object.material = owned.original;
    for (const owned of bloodMaterials.values()){library.ownedMaterials.delete(owned.material);owned.material.dispose();}
    bloodMaterials.clear();
  }

  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const upper = joint(side < 0 ? 'left humerus' : 'right humerus', side * (side < 0 ? 0.55 : 0.50), 0.61 + (side < 0 ? 0.045 : -0.065), -0.025, chest);
    const g = side < 0 ? geo.leftArm : geo.rightArm;
    mesh(g.upper, skin, upper);
    mesh(g.upperTendons, tendon, upper);
    const elbow = joint('elbow / radius and ulna', 0, -0.67, 0, upper);
    mesh(g.forearm, skin, elbow);
    mesh(g.forearmBone, bone, elbow);
    const wrist = joint('wrist / articulated hand', 0, -0.78, 0, elbow);
    mesh(g.hand, skin, wrist);
    mesh(g.claws, materials.claws, wrist);
    if (watcher) {
      // Keep the hands unnaturally narrow and long, while allowing their
      // fingertips to clear the floor when the tall rig plants its feet.
      wrist.scale.set(.82, 1.08, .82);
    }
    arms.push({ upper, elbow, wrist, side });

    const thigh = joint(side < 0 ? 'left femur' : 'right femur', side * 0.235, -0.03, 0.015, hips);
    mesh(geo.thigh, skin, thigh);
    mesh(geo.thighTendons, tendon, thigh);
    const knee = joint('backward knee', 0, -0.62, 0.025, thigh);
    mesh(geo.shin, skin, knee);
    mesh(geo.shinBone, bone, knee);
    const ankle = joint('hock / splayed foot', 0, -0.62, 0.035, knee);
    mesh(geo.foot, skin, ankle);
    mesh(geo.toeClaws, materials.claws, ankle);
    legs.push({ thigh, knee, ankle, side });
  }

  const shadow = new THREE.Mesh(geo.shadow, materials.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const rest = watcher ? .025 : type === 'crawler' ? 0.30 : type === 'brute' ? 0.13 : 0.19;
  const groundPoint = new THREE.Vector3();
  const down = new THREE.Vector3(0,-1,0), reachTarget = new THREE.Vector3(), axis = new THREE.Vector3(), pole = new THREE.Vector3(), elbowPoint = new THREE.Vector3(), foreDirection = new THREE.Vector3();
  const upperQ = new THREE.Quaternion(), foreQ = new THREE.Quaternion(), relativeQ = new THREE.Quaternion(), handQ = new THREE.Quaternion();
  const ease = x => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  function solveRightArm(target,handAngle,weight){
    const arm=arms[1], shoulder=arm.upper.position;
    axis.copy(target).sub(shoulder);
    const distance=Math.max(.06,Math.min(1.445,axis.length()));axis.normalize();
    const along=(.67*.67-.78*.78+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,.67*.67-along*along));
    pole.set(.9,-.35,.52).addScaledVector(axis,-pole.dot(axis)).normalize();
    elbowPoint.copy(shoulder).addScaledVector(axis,along).addScaledVector(pole,height);
    foreDirection.copy(elbowPoint).sub(shoulder).normalize();
    upperQ.setFromUnitVectors(down,foreDirection);
    foreDirection.copy(target).sub(elbowPoint).normalize();
    foreQ.setFromUnitVectors(down,foreDirection);
    relativeQ.copy(upperQ).invert().multiply(foreQ);
    arm.upper.quaternion.slerp(upperQ,weight);
    arm.elbow.quaternion.slerp(relativeQ,weight);
    handQ.setFromAxisAngle(new THREE.Vector3(1,0,0),handAngle);
    relativeQ.copy(foreQ).invert().multiply(handQ);
    arm.wrist.quaternion.slerp(relativeQ,weight);
  }
  let huntBlend = 0, feedBlend = 0, stunBlend = 0, lastX, lastZ, velocity = 0;
  function reset() {
    huntBlend = feedBlend = stunBlend = velocity = 0;
    lastX = lastZ = undefined;
    setBloodiness(0);
    head.scale.set(1,1,1);
    jaw.scale.set(1,1,1);
  }
  function update(dt, m, time = 0) {
    const feeding = m.feeding > 0 || m.state === 'feed' || m.state === 'eat' || m.state === 'feeding';
    // The moving joints remain intact, including the feeding attachments.
    // Turning the shoulders in on narrow stairs keeps the entire silhouette
    // inside the railings, rather than only fitting its collision capsule.
    if (!watcher) body.scale.x = m.onStair ? .78 : 1;
    // Freeze every joint exactly where it was caught. Breathing, head sway and
    // the gait all stop, while flashes and feeding retain their normal poses.
    if (watcher && (m.observed || m.watching || m.state === 'watching') && !(m.stunned > 0) && !feeding) {
      lastX = m.x; lastZ = m.z; velocity = 0;
      return;
    }
    const smooth = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    if (lastX !== undefined && dt > 0) {
      const currentSpeed = Math.hypot(m.x - lastX, m.z - lastZ) / dt;
      velocity += (Math.min(currentSpeed, 7) - velocity) * smooth;
    }
    lastX = m.x;
    lastZ = m.z;
    huntBlend += ((m.state === 'hunt' || m.state === 'chase' ? 1 : 0) - huntBlend) * smooth;
    feedBlend += ((feeding ? 1 : 0) - feedBlend) * smooth;
    stunBlend += ((m.stunned > 0 ? 1 : 0) - stunBlend) * smooth;
    const phase = Number.isFinite(m.phase) ? m.phase * .42 : time * 2;
    const feedProgress = Number.isFinite(m.feedProgress) ? Math.max(0,Math.min(1,m.feedProgress)) : .65;
    // The face distends around the full-size victim. The body and the person
    // keep their scale, and the mouth attachment hooks inherit this motion.
    const distention = feedBlend * ease((feedProgress-.48)/.16) * (1-ease((feedProgress-.90)/.10));
    head.scale.set(1 + distention*1.2, 1 + distention*.12, 1 + distention*.10);
    jaw.scale.set(1 + distention*.16, 1 + distention*.08, 1);
    const stride = Math.min(1, velocity / 1.8) * (1 - feedBlend) * (1 - stunBlend * 0.9);
    const running = huntBlend * Math.min(1, velocity / 2.7);
    const breathing = Math.sin(time * 1.8 + (m.id || 0));

    // Weight settles over the planted foot; the chest leads the pelvis.
    body.position.y = Math.sin(phase * 2) * 0.025 * stride - feedBlend * 0.34 - stunBlend * 0.08;
    body.rotation.z = Math.sin(phase) * (0.04 + running*.025) * stride;
    hips.rotation.y = Math.sin(phase) * 0.065 * stride;
    chest.rotation.x = rest + running * 0.14 + feedBlend * 0.48 + stunBlend * 0.18;
    chest.rotation.z = -Math.sin(phase) * (0.055 + running*.045) * stride;
    chest.rotation.y = -hips.rotation.y * 0.5;
    chest.scale.y = 1 + breathing * 0.009;
    neck.rotation.x = -rest * 0.48 - running * 0.09 - feedBlend * 0.12;
    head.rotation.x = -0.12 + Math.sin(time * 1.17) * 0.025 - running * 0.06;
    head.rotation.z = (type === 'stalker' ? -0.13 : 0.065) + Math.sin(time * 0.63) * 0.045;
    head.rotation.y = Math.sin(time * 0.7 + (m.id || 0)) * (running > 0.2 ? 0.035 : 0.10);
    if (stunBlend > 0.01) {
      head.rotation.y += Math.sin(time * 21) * stunBlend * 0.12;
      head.rotation.z += Math.sin(time * 17) * stunBlend * 0.08;
    }
    // A hinged lower jaw makes feeding a physical action.
    let chew = feedBlend * (feedProgress>.46 ? .28 + Math.max(0,Math.sin(time*8.5))*.38 : .08);
    if(feedProgress>.70&&feedProgress<.92)chew=feedBlend*.78;
    if(feedProgress>=.92)chew=feedBlend*(.78*(1-ease((feedProgress-.92)/.055)));
    jaw.rotation.x = 0.12 + huntBlend * 0.13 + chew + stunBlend * 0.2 + breathing * 0.015;
    jaw.rotation.z = -0.105;

    for (const arm of arms) {
      const swing = Math.sin(phase + (arm.side < 0 ? 0 : Math.PI));
      const reach = Math.max(0, swing) * running;
      // Shoulder, elbow and wrist move as a weighted chain, never independently wave.
      arm.upper.rotation.x = -0.11 + swing * stride * (0.25 + running * 0.30) - feedBlend * 0.66 - stunBlend * 0.37;
      arm.upper.rotation.z = arm.side * (0.12 + running * 0.075 + feedBlend * 0.14);
      arm.upper.rotation.y = -arm.side * (0.10 + running * 0.09);
      arm.elbow.rotation.x = -0.13 - reach * 0.32 - feedBlend * (0.9 + Math.sin(time * 4.25 + arm.side) * 0.12);
      arm.elbow.rotation.z = arm.side * 0.045;
      arm.wrist.rotation.x = 0.2 + reach * 0.18 + feedBlend * 0.2;
      arm.wrist.rotation.z = -arm.side * (0.08 + running * 0.07);
    }
    for (const leg of legs) {
      const swing = Math.sin(phase + (leg.side < 0 ? Math.PI : 0));
      const lift = Math.max(0, swing);
      leg.thigh.rotation.x = 0.08 + swing * stride * (0.36 + running * 0.43) + feedBlend * 0.5;
      leg.thigh.rotation.z = leg.side * (0.025 + feedBlend * 0.15);
      leg.knee.rotation.x = -0.24 - lift * stride * (0.25 + running * 0.43) - feedBlend * 0.5;
      leg.ankle.rotation.x = 0.15 - swing * stride * 0.12 + lift * stride * 0.13;
    }
    if(feedBlend>.001){
      const reach=ease(feedProgress/.22),lift=ease((feedProgress-.22)/.32),release=ease((feedProgress-.94)/.06);
      reachTarget.set(.57,-.88,.13).lerp(new THREE.Vector3(.33,-.55,.68),reach);
      reachTarget.lerp(new THREE.Vector3(.14,.68,.45),lift);
      reachTarget.lerp(new THREE.Vector3(.55,-.80,.28),release);
      solveRightArm(reachTarget,.18-lift*2.03+release*1.6,feedBlend);
    }
    if (watcher && feedBlend < .01 && stunBlend < .01) {
      // Slow, disjointed stalking and a sideways listening tilt. The small
      // motion is skeletal, rather than a light or visibility strobe.
      const twitch = Math.pow(Math.max(0, Math.sin(time * 1.7 + (m.id || 0))), 18);
      chest.rotation.x = .02 + running * .045;
      chest.scale.y = 1;
      neck.rotation.x = .08;
      head.rotation.z = -.43 + twitch * .12;
      head.rotation.y = Math.sin(time * .31) * .12;
      jaw.rotation.x = .09;
      for (const arm of arms) {
        arm.upper.rotation.x *= .28;
        arm.upper.rotation.z = arm.side * .035;
        arm.elbow.rotation.x = -.78 - twitch * .09;
        arm.wrist.rotation.x = -.12;
        arm.wrist.rotation.z = -arm.side * .15;
      }
    }
    if (m.onStair && feedBlend < .01 && stunBlend < .01) {
      for (const arm of arms) {
        arm.upper.rotation.z = arm.side * .035;
        arm.wrist.rotation.z = -arm.side * .055;
      }
    }
    // Keep the lowest planted sole on the floor through crouches and growth.
    // Measurements are in the model's local space, so caller scale/position
    // and upper-floor placement do not alter foot contact.
    group.updateMatrixWorld(true);
    let lowestSole = Infinity;
    for (const leg of legs) for (const sole of [[0,-.17,-.04],[0,-.17,.13],[0,-.18,.39]]) {
      groundPoint.set(...sole);
      leg.ankle.localToWorld(groundPoint);
      group.worldToLocal(groundPoint);
      lowestSole = Math.min(lowestSole, groundPoint.y);
    }
    if (Number.isFinite(lowestSole)) body.position.y += 0.012 - lowestSole;
  }
  update(0.016, { x: 0, z: 0, phase: 0, state: 'roam', id: 0 }, 0);
  function getGripPosition(out=new THREE.Vector3()){
    group.updateMatrixWorld(true);out.set(0,-.15,.05);return arms[1].wrist.localToWorld(out);
  }
  function getMouthPosition(out=new THREE.Vector3()){
    group.updateMatrixWorld(true);out.set(.005,-.14,.035);return head.localToWorld(out);
  }
  function getMouthApproach(out=new THREE.Vector3()){
    group.updateMatrixWorld(true);out.set(.005,-.12,.60);return head.localToWorld(out);
  }
  return { group, update, reset, setBloodiness, dispose, getGripPosition, getMouthPosition, getMouthApproach, name: watcher ? 'The Still One' : 'The Hollow' };
}

function buildCreatureLibrary(THREE) {
  // Smooth lofts, tapered curved tubes, and fused detail meshes form the model.
  const geometries = {};
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  function transform(g, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const matrix = new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), v3(sx, sy, sz));
    return g.clone().applyMatrix4(matrix);
  }
  function ball(x, y, z, sx, sy, sz, detail = 12, rx = 0, ry = 0, rz = 0) {
    return transform(new THREE.SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.65))), x, y, z, sx, sy, sz, rx, ry, rz);
  }
  function merged(parts) {
    const positions = [], normals = [], uvs = [];
    for (const original of parts) {
      const g = original.index ? original.toNonIndexed() : original;
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      if (g.attributes.uv) uvs.push(...g.attributes.uv.array);
      else uvs.push(...new Float32Array(g.attributes.position.count * 2));
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.computeBoundingSphere();
    return result;
  }
  function loft(rings, sides = 24, distortion = 0.025, opening = null) {
    const vertices = [], uv = [], indices = [];
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, cx = 0, cz = 0] = rings[j];
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2;
        const asymmetry = 1 + Math.sin(a * 3 + y * 6) * distortion + Math.cos(a * 7 - y * 4) * distortion * 0.35;
        vertices.push(cx + Math.cos(a) * rx * asymmetry, y, cz + Math.sin(a) * rz * asymmetry);
        uv.push(i / sides, j / (rings.length - 1));
      }
    }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i, b = a + sides + 1;
      if (opening && opening((rings[j][0] + rings[j + 1][0]) * 0.5, (i + 0.5) / sides * Math.PI * 2)) continue;
      if (rings[rings.length - 1][0] >= rings[0][0]) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  function tube(points, radius = 0.025, endRadius = radius, sections = 12, sides = 7) {
    const path = new THREE.CatmullRomCurve3(points.map(p => v3(...p)));
    const frames = path.computeFrenetFrames(sections, false);
    const vertices = [], uv = [], indices = [];
    for (let j = 0; j <= sections; j++) {
      const t = j / sections, center = path.getPointAt(t);
      const r = radius + (endRadius - radius) * t;
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2;
        const p = center.clone().addScaledVector(frames.normals[j], Math.cos(a) * r).addScaledVector(frames.binormals[j], Math.sin(a) * r);
        vertices.push(p.x, p.y, p.z);
        uv.push(i / sides, t);
      }
    }
    for (let j = 0; j < sections; j++) for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i, b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  function coneBetween(a, b, radius, sides = 7) {
    const start = v3(...a), end = v3(...b), delta = end.clone().sub(start);
    const g = new THREE.ConeGeometry(radius, delta.length(), sides, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), delta.clone().normalize()));
    g.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
    return g;
  }
  function curvedTooth(a,b,radius,seed){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],hook=(seed%2?1:-1)*.003;
    return tube([a,[a[0]+dx*.35+hook,a[1]+dy*.32,a[2]+dz*.25-.004],[a[0]+dx*.75+hook,a[1]+dy*.75,a[2]+dz*.6+.003],[b[0],b[1],b[2]+.012]],radius,.00065,9,7);
  }

  // Texture carries pores, age patches and branching capillaries; the bump map
  // keeps skin tactile under a moving flashlight rather than perfectly smooth.
  const size = 256, albedo = new Uint8Array(size * size * 4), bump = new Uint8Array(size * size * 4);
  const hash = (x, y) => {
    let n = Math.imul(x + 487, 374761393) ^ Math.imul(y + 917, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967295;
  };
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx) * (1 - sy) + (hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx) * sy;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (y * size + x) * 4;
    const n = noise(x / 26, y / 26), m = noise(x / 7, y / 7), pore = hash(x, y);
    const vein = Math.max(0, 1 - Math.abs(Math.sin(x * 0.043 + Math.sin(y * 0.038) * 2.2 + n * 3)) * 16) * (0.3 + m * 0.7);
    const bruise = Math.max(0, 0.53 - n) * 74;
    const grain = (pore - 0.5) * 25;
    const streak = Math.max(0, Math.sin(x*.14 + Math.sin(y*.037)*3.5 + n*3)-.55)*23;
    albedo[at] = 79 + n * 43 + grain - vein * 32 - bruise * 0.35 - streak;
    albedo[at + 1] = 82 + n * 40 + grain - vein * 36 - bruise - streak;
    albedo[at + 2] = 83 + n * 37 + grain - vein * 18 - bruise * 0.45 - streak*.7;
    albedo[at + 3] = 255;
    const height = Math.max(0, Math.min(255, 120 + (m - 0.5) * 62 + (pore > 0.87 ? -45 : pore * 20) + vein * 36));
    bump[at] = bump[at + 1] = bump[at + 2] = height;
    bump[at + 3] = 255;
  }
  const skinMap = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  const bumpMap = new THREE.DataTexture(bump, size, size, THREE.RGBAFormat);
  skinMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [skinMap, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  const enamelData=new Uint8Array(128*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){
    const at=(y*128+x)*4,streak=Math.sin(x*.44+Math.sin(y*.17))*.024+(hash(x,y)-.5)*.025,t=y/63;
    enamelData[at]=(196+t*44+streak*255);enamelData[at+1]=(185+t*45+streak*210);enamelData[at+2]=(151+t*55+streak*150);enamelData[at+3]=255;
  }
  const enamel=new THREE.DataTexture(enamelData,128,64,THREE.RGBAFormat);enamel.colorSpace=THREE.SRGBColorSpace;enamel.wrapS=enamel.wrapT=THREE.RepeatWrapping;enamel.magFilter=THREE.LinearFilter;enamel.minFilter=THREE.LinearMipmapLinearFilter;enamel.generateMipmaps=true;enamel.needsUpdate=true;
  const skinMaterial = color => new THREE.MeshStandardMaterial({ color, map: skinMap, bumpMap, bumpScale: 0.018, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const materials = {
    stalker: skinMaterial(0x96939f), brute: skinMaterial(0x8d8995), crawler: skinMaterial(0x92969e),
    watcher: skinMaterial(0x151b22),
    watcherBone: new THREE.MeshStandardMaterial({color:0x253039,roughness:.92}),
    watcherTendon: new THREE.MeshStandardMaterial({color:0x10151a,roughness:.88}),
    watcherMask: new THREE.MeshStandardMaterial({color:0xd6d8c4,roughness:.81}),
    watcherEye: new THREE.MeshStandardMaterial({color:0xe9f2d0,emissive:0xb6d5aa,emissiveIntensity:1.25,roughness:.3}),
    bone: new THREE.MeshStandardMaterial({ color: 0x7c7b83, map: skinMap, bumpMap, bumpScale: 0.008, roughness: 0.78 }),
    tendon: new THREE.MeshStandardMaterial({ color: 0x50494e, map: skinMap, roughness: 0.69, bumpMap, bumpScale: 0.022 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0x92968b, map:enamel, bumpMap:enamel,bumpScale:.0012,roughness: 0.58 }),
    gum: new THREE.MeshStandardMaterial({color:0x68434a,map:skinMap,bumpMap,bumpScale:.005,roughness:.34}),
    claws: new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: 0.57 }),
    cavity: new THREE.MeshStandardMaterial({ color: 0x040605, roughness: 0.96 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x626d66, roughness: 0.6 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  };
  for(const name of ['stalker','brute','crawler','watcher'])materials[name].userData.horrorSurface='skin';
  for(const name of ['bone','tendon','claws','gum','teeth'])materials[name].userData.horrorSurface=name;

  geometries.pelvis = loft([[-.20,.10,.09,0,0],[-.13,.26,.16,0,0],[0,.31,.18,0,0],[.12,.29,.15,0,-.01],[.22,.19,.13,0,-.01]], 28, .065);
  geometries.pelvisBone = merged([-1, 1].map(s => tube([[s*.18,.14,.08],[s*.30,.08,.04],[s*.28,-.06,.04],[s*.17,-.13,.1]], .047, .027, 10, 7)));
  geometries.torso = loft([
    [-.05,.18,.13,0,0],[.08,.20,.13,0,-.02],[.21,.23,.15,0,-.03],[.34,.29,.18,0,-.04],
    [.45,.38,.22,0,-.04],[.55,.46,.25,0,-.045],[.64,.51,.26,0,-.04],[.71,.45,.23,0,-.01],
    [.77,.30,.17,0,.02],[.82,.13,.115,0,.06]
  ], 32, .055);
  const ribs = [], sinew = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const variation=hash(i+s*13,8),y = .33 + i * .069 + variation*.026, width = .25 + i * .035 + (variation-.5)*.04;
      ribs.push(tube([[s*.028,y+.018,.17+(i/6)*.035],[s*width*.55,y-.025-variation*.018,.18+(i/6)*.05],[s*width,y+.015,.055],[s*width*.88,y+.033,-.18],[s*.06,y+.058,-.245]], .013 + variation*.005, .010, 13, 7));
    }
    ribs.push(tube([[s*.04,.735,.13],[s*.21,.75,.18],[s*.40,.71,.1],[s*.53,.64,-.01]], .037, .05, 12, 8));
    ribs.push(ball(s*.30,.65,-.23,.15,.20,.045,12,0,0,s*.25));
    sinew.push(tube([[s*.10,.78,.09],[s*.18,.55,.225],[s*.13,.23,.14],[s*.06,.02,.13]], .017,.009,14,6));
    sinew.push(tube([[s*.42,.62,-.12],[s*.27,.40,-.21],[s*.16,.10,-.15]], .025,.012,12,6));
  }
  for (let i = 0; i < 10; i++) {
    const y = .04 + i * .077;
    ribs.push(ball(0,y,-.155-Math.sin(i/10*Math.PI)*.115,.055,.045,.04,8));
    ribs.push(coneBetween([0,y,-.17-Math.sin(i/10*Math.PI)*.115],[0,y+.022,-.24-Math.sin(i/10*Math.PI)*.15],.029,5));
  }
  ribs.push(tube([[0,.30,.19],[0,.48,.24],[0,.68,.235],[0,.76,.15]],.023,.027,12,7));
  geometries.ribs = merged(ribs);
  geometries.sinew = merged(sinew);

  geometries.neck = loft([[-.035,.10,.11,0,0],[.04,.115,.10,0,.025],[.12,.087,.10,0,.055],[.22,.095,.105,0,.08]],20,.06);
  geometries.neckTendons = merged([-1,1].flatMap(s=>[
    tube([[s*.10,-.025,.05],[s*.075,.08,.13],[s*.08,.21,.13]],.017,.011,10,6),
    tube([[s*.07,0,-.09],[s*.045,.13,-.045],[s*.07,.25,.015]],.018,.014,10,6)
  ]));

  geometries.skull = loft([
    [-.38,.055,.065,.012,.035],[-.31,.09,.095,.008,.015],[-.23,.115,.135,0,0],[-.12,.145,.165,-.008,0],
    [-.025,.155,.18,-.006,0],[.06,.17,.175,-.008,-.015],[.15,.18,.16,-.015,-.035],[.24,.175,.15,-.02,-.055],
    [.34,.145,.13,-.025,-.075],[.44,.105,.10,-.03,-.09],[.51,.048,.05,-.035,-.09],[.53,.004,.005,-.035,-.09]
  ],32,.09,(y,a)=>(y<.025&&y>-.34&&Math.sin(a)>.49)||(y<.155&&y>-.24&&a>1.6&&a<2.14));
  const face = [];
  for (const s of [-1,1]) {
    const offset=s<0?.026:-.018;
    face.push(tube([[s*.035,.18+offset,.145],[s*.11,.175+offset,.16],[s*.175,.105+offset,.105]],.032,.015,10,7));
    face.push(tube([[s*.17,.07,.085],[s*.15,-.045,.14],[s*.10,-.26,.105]],.024,.008,12,7));
    face.push(ball(s*.13,-.04,.085,.038,.12,.027,10,0,0,s*-.31));
  }
  face.push(tube([[-.015,.20,.145],[-.012,.12,.18],[.008,.035,.187]],.014,.009,10,6));
  geometries.faceBone = merged(face);
  geometries.eyeSockets = merged([-1,1].map(s=>ball(s*.102,.126+(s<0?.022:-.015),.137,.069,.017,.024,14,0,s*.12,s*(s<0?.28:.12))));
  geometries.eyes = merged([-1,1].map(s=>ball(s*.105,.127+(s<0?.022:-.015),.155,.009,.0025,.004,10)));
  geometries.watcherMask = ball(0,.235,.145,.158,.255,.065,24,0,0,-.035);
  geometries.watcherSockets = merged([-1,1].map(s=>ball(s*.071,.247,.205,.041,.034,.012,14)));
  geometries.watcherEyes = merged([-1,1].map(s=>ball(s*.071,.245,.218,.008,.012,.006,10)));
  geometries.watcherTears = merged([-1,1].map(s=>tube([[s*.074,.22,.208],[s*.078,.16,.202],[s*.068,.091,.19]],.007,.0015,10,6)));
  geometries.mouth = merged([ball(.01,-.145,.085,.10,.248,.055,24),ball(-.075,.035,.082,.045,.14,.04,16,0,0,-.18)]);

  const topTeeth = [], bottomTeeth = [];
  for (let i = 0; i < 9; i++) {
    if(i===3||i===7)continue;
    const t = i/8, x=(t-.5)*.205, y=.013-Math.abs(t-.5)*.07+(hash(i,21)-.5)*.027, z=.151-Math.abs(t-.5)*.035;
    const length = .055 + hash(i,8)*.115 + (i===2?.03:0);
    topTeeth.push(coneBetween([x,y,z],[x+(hash(i,17)-.5)*.023,y-length,z+.012],.006+hash(i,6)*.005,7));
  }
  geometries.upperTeeth = merged(topTeeth);
  geometries.upperGum=tube([[-.108,-.023,.125],[-.065,.001,.145],[-.012,.019,.151],[.048,.006,.143],[.10,-.021,.125]],.0085,.0065,15,7);
  // The jaw is open at rest. Its hinge remains behind the cheek bones.
  geometries.jaw = merged([
    tube([[-.125,0,-.01],[-.12,-.15,.02],[-.075,-.28,.08],[.01,-.305,.11],[.085,-.27,.08],[.12,-.11,.02],[.125,0,-.01]],.024,.018,24,9),
    ball(.01,-.292,.08,.065,.026,.048,14)
  ]);
  geometries.jawBone = merged([-1,1].map(s=>tube([[s*.115,-.015,.005],[s*.10,-.17,.035],[s*.06,-.27,.105],[.01,-.28,.115]],.010,.013,12,6)));
  for(let i=0;i<7;i++){
    if(i===1||i===4)continue;
    const t=i/6,x=(t-.5)*.15,y=-.274+Math.abs(t-.5)*.045+(hash(i,22)-.5)*.02,z=.11-Math.abs(t-.5)*.03;
    bottomTeeth.push(coneBetween([x,y,z],[x+(hash(i,19)-.5)*.022,y+.04+hash(i,20)*.082,z+.01],.007+hash(i,21)*.003,7));
  }
  geometries.lowerTeeth=merged(bottomTeeth);
  geometries.lowerGum=tube([[-.077,-.255,.091],[-.038,-.278,.108],[.015,-.284,.11],[.060,-.263,.091]],.007,.005,13,7);

  // Each limb is shaped along its length: deltoid -> biceps -> elbow,
  // ulna/radius -> thin wrist -> metacarpals -> curled, tapered phalanges.
  for(const side of [-1,1]){
    const g={};
    g.upper=loft([[.08,.035,.035,0,0],[.02,.14,.14,0,0],[-.10,.17,.135,side*.015,-.015],[-.22,.13,.105,side*.02,-.025],[-.36,.105,.09,0,-.015],[-.51,.074,.075,0,0],[-.64,.09,.085,0,0],[-.70,.06,.06,0,0]],24,.07);
    g.upperTendons=merged([
      tube([[side*.06,-.08,.105],[side*.07,-.28,.10],[side*.015,-.59,.063]],.018,.011,12,6),
      tube([[-side*.05,-.10,-.115],[-side*.08,-.31,-.085],[0,-.64,-.075]],.022,.015,12,6)
    ]);
    g.forearm=loft([[.04,.07,.065,0,0],[-.04,.11,.085,0,0],[-.15,.12,.095,side*.01,.015],[-.30,.10,.078,side*.015,.025],[-.48,.075,.06,0,.025],[-.66,.045,.045,0,.015],[-.80,.04,.042,0,0]],24,.075);
    g.forearmBone=merged([
      tube([[side*.055,-.025,.05],[side*.055,-.23,.085],[side*.03,-.55,.05],[side*.02,-.76,.03]],.024,.012,14,7),
      tube([[-side*.045,-.03,-.035],[-side*.04,-.28,-.06],[-side*.018,-.72,-.02]],.022,.010,14,7),
      ball(0,-.02,-.055,.055,.06,.04,10)
    ]);
    const hand=[loft([[.04,.035,.03,0,0],[-.03,.07,.035,0,.015],[-.13,.085,.035,0,.02],[-.21,.078,.03,0,.02],[-.25,.06,.02,0,.02]],20,.08)], claws=[];
    for(let f=0;f<4;f++){
      const x=(f-1.5)*.044, length=.25+(f===1||f===2?.075:0);
      hand.push(tube([[x,-.20,.024],[x*1.30,-.28,.05],[x*1.55,-.20-length*.65,.08],[x*1.55,-.20-length,.125]],.024,.010,12,7));
      claws.push(tube([[x*1.55,-.20-length,.125],[x*1.57,-.24-length,.16],[x*1.48,-.25-length,.205]],.013,.001,8,6));
      hand.push(ball(x*1.3,-.28,.05,.025,.03,.026,8));
    }
    hand.push(tube([[side*.06,-.08,.025],[side*.135,-.12,.045],[side*.17,-.22,.10],[side*.15,-.29,.135]],.036,.012,12,7));
    claws.push(tube([[side*.15,-.29,.135],[side*.13,-.32,.17],[side*.095,-.32,.20]],.015,.001,8,6));
    g.hand=merged(hand);g.claws=merged(claws);
    geometries[side<0?'leftArm':'rightArm']=g;
  }
  geometries.thigh=loft([[.035,.09,.075,0,0],[-.04,.15,.145,0,0],[-.15,.16,.15,0,.005],[-.30,.125,.12,0,.015],[-.46,.08,.09,0,.02],[-.59,.10,.10,0,.025],[-.65,.055,.06,0,.025]],24,.07);
  geometries.thighTendons=merged([
    tube([[-.075,-.04,.11],[-.07,-.26,.12],[-.025,-.56,.10]],.026,.015,12,7),
    tube([[.06,-.04,-.11],[.08,-.30,-.10],[.04,-.60,-.05]],.025,.012,12,7)
  ]);
  geometries.shin=loft([[.035,.075,.07,0,0],[-.06,.09,.09,0,-.035],[-.18,.10,.115,0,-.075],[-.31,.073,.08,0,-.095],[-.43,.042,.055,0,-.06],[-.57,.035,.04,0,0],[-.65,.05,.045,0,.035]],22,.06);
  geometries.shinBone=merged([
    tube([[0,.035,.07],[0,-.13,.04],[0,-.34,-.025],[0,-.60,.055]],.026,.016,14,7),
    tube([[.04,-.06,-.07],[.05,-.25,-.145],[.025,-.48,-.06],[.02,-.62,.02]],.02,.012,14,7)
  ]);
  const foot=[ball(0,-.075,.03,.07,.10,.13,16),ball(0,-.13,.15,.10,.05,.17,16)];
  const toeClaws=[];
  for(let i=0;i<3;i++){
    const x=(i-1)*.074,z=.27-Math.abs(i-1)*.025;
    foot.push(tube([[x*.6,-.12,.13],[x,-.13,.22],[x*1.2,-.14,z+.06]],.034,.019,10,7));
    toeClaws.push(tube([[x*1.2,-.14,z+.04],[x*1.2,-.13,z+.10],[x*1.17,-.17,z+.15]],.022,.001,9,6));
  }
  geometries.foot=merged(foot);geometries.toeClaws=merged(toeClaws);
  geometries.shadow=new THREE.CircleGeometry(.8,24);
  const library={THREE,geometries,materials,baseColorMap:skinMap,ownedMaterials:new Set()};
  const loaded=horrorCreatureTextureStates.get(THREE)?.maps;if(loaded)applyHorrorSurfaceMaps(library,loaded);
  return library;
}
