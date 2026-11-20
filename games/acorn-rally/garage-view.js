'use strict';
(() => {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const unit = v => { const length = Math.hypot(...v) || 1; return v.map(x => x / length); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  function lookAt(eye, target) {
    const back = unit(eye.map((x,i) => x-target[i])), right = unit(cross([0,1,0],back)), up = cross(back,right);
    return new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,
      -dot(right,eye),-dot(up,eye),-dot(back,eye),1]);
  }
  function projection(fov, aspect, near = .07, far = 35) {
    const f = 1/Math.tan(fov/2);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  }
  function multiply(a,b) {
    const c = new Float32Array(16);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++)
      for(let i=0;i<4;i++)c[col*4+row]+=a[i*4+row]*b[col*4+i];
    return c;
  }
  function rotation(angle) {
    const s=Math.sin(angle),c=Math.cos(angle);
    return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);
  }
  function view(state,aspect) {
    const tall = Math.max(1.8, state.high+.1), radius = tall*2.4 / state.zoom * Math.max(1,1.1/aspect);
    const center = [.0,tall*(.29+.11*Math.max(0,state.zoom-1)),.0];
    const eye = [0,center[1]+Math.sin(state.pitch)*radius,Math.cos(state.pitch)*radius];
    return {eye, matrix:multiply(projection(.62,aspect),lookAt(eye,center)),model:rotation(state.yaw)};
  }
  const imageCache = new Map();
  const softwareAtlases = new Map();
  let modelLoad = null;
  function loadModels() {
    const ready = () => {
      const models = window.AcornKartModels;
      if (!models || models.length < 8) return false;
      if (!models[8] && window.AcornSolsticeKart) models[8] = window.AcornSolsticeKart();
      if (!models[9] && window.AcornAuroraKart) models[9] = window.AcornAuroraKart();
      if (!models[10] && window.AcornAngelKart) models[10] = window.AcornAngelKart();
      if (!models[11] && window.AcornGrimoireKart) models[11] = window.AcornGrimoireKart();
      return window.RallyData.drivers.every((_, index) => models[index]);
    };
    if (ready()) return Promise.resolve(window.AcornKartModels);
    if (modelLoad) return modelLoad;
    modelLoad = new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.async=true;script.src='race-models.js';script.fetchPriority='high';
      script.onload=()=>{
        if(ready())resolve(window.AcornKartModels);
        else { modelLoad=null;script.remove();reject(Error('The complete kart collection could not load.')); }
      };
      script.onerror=()=>{modelLoad=null;script.remove();reject(Error('The kart collection could not load.'));};
      document.head.append(script);
    });
    return modelLoad;
  }
  function loadImage(url) {
    if (!imageCache.has(url)) imageCache.set(url,new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;
    }));
    return imageCache.get(url);
  }

  function makePlatform() {
    const meshes=[], steps=128;
    const profile=[
      [1.40,-.18,[.105,.116,.102],3],[1.43,-.15,[.21,.205,.163],3],
      [1.43,-.112,[.51,.38,.22],3],[1.435,-.101,[.68,.52,.30],3],
      [1.436,-.088,[.24,.25,.214],3],[1.436,-.059,[.24,.25,.214],3],
      [1.425,-.045,[.51,.39,.24],3],[1.40,-.018,[.32,.27,.20],3],
      [1.37,-.009,[.44,.36,.25],2]
    ];
    for(let k=0;k<profile.length-1;k++){
      const [r1,y1,color,kind]=profile[k],[r2,y2]=profile[k+1];
      const positions=[], normals=[], uvs=[],indices=[];
      for(let t=0;t<=steps;t++){
        const a=t/steps*2*Math.PI,s=Math.sin(a),c=Math.cos(a);
        const n=unit([s*(y2-y1),r1-r2,c*(y2-y1)]);
        positions.push(s*r1,y1,c*r1,s*r2,y2,c*r2);normals.push(...n,...n);uvs.push(t/steps,0,t/steps,1);
        if(t<steps){const j=t*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
      }
      meshes.push({positions,normals,uvs,indices,color,kind,name:'base'});
    }
    const last=profile[profile.length-1],positions=[0,last[1],0],normals=[0,1,0],uvs=[.5,.5],indices=[];
    for(let t=0;t<=steps;t++){
      const a=t/steps*Math.PI*2,s=Math.sin(a),c=Math.cos(a);
      positions.push(s*last[0],last[1],c*last[0]);normals.push(0,1,0);uvs.push(.5+s*.5,.5+c*.5);
      if(t<steps)indices.push(0,t+1,t+2);
    }
    meshes.push({positions,normals,uvs,indices,color:last[2],kind:2,name:'wood turntable'});
    return meshes;
  }
  const platform=makePlatform();
  const lightDirection=unit([-3.4,5.2,3.2]);
  const restPose = new Float32Array(16*16);
  for(let bone=0;bone<16;bone++)restPose.set(identity(),bone*16);

  // Slow, repeating steering and braking sequence for the stationary workshop stand.
  function previewMotion(seconds, racer, dt) {
    const t=seconds%6.8;
    function ramp(start,end){const n=clamp((t-start)/(end-start),0,1);return n*n*(3-2*n);}
    racer.v=(7*ramp(0,1.05)+12*ramp(1.65,2.55))*(1-ramp(4.75,5.31))-2.8*ramp(5.6,5.97)*(1-ramp(6.3,6.8));
    racer.steer=.96*Math.sin(t*1.27-.21)*ramp(.08,.7)*(1-ramp(5.75,6.77));
    racer.vx=racer.steer*racer.v*.55;
    racer.prevDrift=Math.abs(racer.steer)>.57&&racer.v>6;
    window.AcornRig.advance(racer,dt,racer.steer*.056);
    return window.AcornRig.motion(racer);
  }

  function makeGL(canvas,model,invalidate) {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});
    if(!gl)return null;
    const buffers=[],textures=[],programs=[],shaders=[];
    const ext=gl.getExtension('OES_standard_derivatives');
    const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision?'highp':'mediump';
    const skinning='attribute vec2 skin; uniform mat4 bones[16]; mat4 posed(){int b=int(skin.x+.5);mat4 own=bones[b];if(skin.y<254.5){int parent=b==9?5:(b==14?9:14);float w=skin.y/255.;return bones[parent]*(1.-w)+own*w;}return own;}';
    const vtx=skinning+window.AcornRig.wheelVertex+'attribute vec3 position; attribute vec3 normal; attribute vec2 uv; uniform mat4 transform,model,lightVP; varying vec3 P,N,Q; varying vec2 UV; void main(){bindTire(position,skin.x);mat4 part=model*posed();vec4 world=part*vec4(position,1.);P=world.xyz;N=mat3(part)*exposedNormal(normal);UV=uv;Q=(lightVP*world).xyz*.5+.5;gl_Position=transform*world;}';
    const frag=(ext?'#extension GL_OES_standard_derivatives : enable\n':'')+
      'precision '+precision+' float; varying vec3 P,N,Q; varying vec2 UV; uniform vec3 eye,base; uniform float kind,atlasReady,surfaceReady,metal,rough,shadowReady; uniform sampler2D atlas,surface,shadow;\n'+
      window.AcornRig.wheelFragment+'float hash(vec2 p){return fract(sin(dot(p,vec2(23.791,71.325)))*4174.914);}\n'+
      'float depth(vec2 p){vec4 v=texture2D(shadow,p);return v.r+v.g/255.;}\n'+
      'float visibility(vec3 norm,vec3 L){if(shadowReady<.5||Q.x<0.||Q.x>1.||Q.y<0.||Q.y>1.)return 1.;float sum=0.;float bias=.0012+.0024*(1.-max(0.,dot(norm,L)));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){sum+=step(Q.z-bias,depth(Q.xy+vec2(float(x),float(y))*.00155));}return sum/9.;}\n'+
      'void main(){vec3 n=normalize(N), V=normalize(eye-P), L=normalize(vec3(-3.4,5.2,3.2));vec3 col=base;float r=rough,m=metal;\n'+
      'if(kind<.5&&atlasReady>.5){col=texture2D(atlas,UV).rgb;}\n'+
      'if(tire.w>.5)col=exposedPaint(col);\n'+
      'if(kind<.5&&surfaceReady>.5){vec3 surf=texture2D(surface,UV).rgb;r=clamp(surf.b,.1,.98);'+
      (ext?'vec3 dp1=dFdx(P),dp2=dFdy(P);vec2 du1=dFdx(UV),du2=dFdy(UV);vec3 B1=cross(dp2,n),B2=cross(n,dp1);vec3 t=B1*du1.x+B2*du2.x,b=B1*du1.y+B2*du2.y;float power=max(dot(t,t),dot(b,b));if(power>.00000000001){float inv=inversesqrt(power);vec2 map=(surf.rg*2.-1.)*.62;n=normalize(n*sqrt(max(.01,1.-dot(map,map)))+(t*map.x+b*map.y)*inv);}':'')+'}\n'+
      'if(kind>1.5&&kind<2.5){float radius=length(P.xz);float grain=sin(39.*P.z+1.6*sin(P.x*5.)+.28*sin(15.*P.x))*sin(140.*P.z+2.*sin(9.*P.x));col*=.96+.085*grain+.036*hash(floor(P.xz*330.));float ring=1.-smoothstep(.002,.006,abs(radius-1.308));float edge=1.-smoothstep(.001,.003,abs(radius-1.283));col=mix(col,vec3(.53,.435,.288),max(ring,edge)*.85);float marks=1.-smoothstep(.035,.09,abs(fract((atan(P.x,P.z)+3.1416)*11.459+.5)-.5));if(radius>1.249&&radius<1.276)col=mix(col,vec3(.58,.46,.27),marks*.9);r=.63;}\n'+
      'float sh=visibility(n,L),ndl=max(dot(n,L),0.), hemi=.5+.5*n.y;vec3 amb=mix(vec3(.235,.19,.16),vec3(.49,.49,.46),hemi);vec3 fill=vec3(.18,.22,.26)*max(dot(n,normalize(vec3(3.,1.4,.6))),0.);vec3 linear=pow(max(col,vec3(.002)),vec3(2.2));vec3 diffuse=linear*(amb+fill+vec3(1.25,1.02,.80)*ndl*(.22+.78*sh));\n'+
      'vec3 H=normalize(V+L);float gloss=pow(max(0.,dot(n,H)),mix(104.,8.,r*r));vec3 spec=mix(vec3(.038),linear*.75,m);vec3 glossColor=spec*gloss*(1.-r*.54)*2.2*sh;vec3 refl=reflect(-V,n);float strip=pow(max(dot(refl,normalize(vec3(.36,.62,-.85))),0.),mix(32.,5.,r));glossColor+=spec*vec3(.49,.56,.72)*strip*(1.-r*.74);float edge=pow(1.-max(dot(n,V),0.),4.);glossColor+=edge*(1.-r*.6)*vec3(.067,.061,.047);vec3 lit=diffuse+glossColor;gl_FragColor=vec4(pow(lit/(1.+lit*.22),vec3(.45455)),1.);}';
    function program(vertex,fragment) {
      const out=gl.createProgram();programs.push(out);
      for(const [type,src] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const sh=gl.createShader(type);shaders.push(sh);gl.shaderSource(sh,src);gl.compileShader(sh);
        if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
        gl.attachShader(out,sh);
      }
      gl.bindAttribLocation(out,0,'position');gl.bindAttribLocation(out,1,'normal');gl.bindAttribLocation(out,2,'uv');gl.bindAttribLocation(out,3,'skin');
      gl.linkProgram(out);if(!gl.getProgramParameter(out,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(out));
      return out;
    }
    const main=program(vtx,frag), depthProgram=program(
      skinning+'attribute vec3 position;uniform mat4 transform,model;void main(){gl_Position=transform*model*posed()*vec4(position,1.);}',
      'precision '+precision+' float;void main(){float d=gl_FragCoord.z;gl_FragColor=vec4(floor(d*255.)/255.,fract(d*255.),0.,1.);}');
    function uniforms(p,fields){return Object.fromEntries(fields.split(' ').map(k=>[k,gl.getUniformLocation(p,k)]));}
    const uni=uniforms(main,'transform model lightVP eye base kind atlasReady surfaceReady metal rough shadowReady atlas surface shadow wheelExposure');
    const du=uniforms(depthProgram,'transform model');
    uni.palette=gl.getUniformLocation(main,'bones[0]');du.palette=gl.getUniformLocation(depthProgram,'bones[0]');
    function upload(target,Type,arr){
      const buf=gl.createBuffer();buffers.push(buf);gl.bindBuffer(target,buf);gl.bufferData(target,arr instanceof Type?arr:new Type(arr),gl.STATIC_DRAW);return buf;
    }
    function makeMesh(g){
      const metal=/metal|brass|chrome|lens|steel|copper|silver|bolt|hub|washer/i.test(g.name);
      const rubber=/rubber|tire|fur|felt|wood|leather|weave|cloth|cork|bark|thread/i.test(g.name);
      let skin=null;
      if(g.rig){
        const encoded=new Uint8Array(g.rig.length*2);
        for(let i=0;i<g.rig.length;i++){encoded[i*2]=g.rig[i];encoded[i*2+1]=Math.round((g.flex?.[i]??1)*255);}
        skin=upload(gl.ARRAY_BUFFER,Uint8Array,encoded);
      }
      return {skin,pos:upload(gl.ARRAY_BUFFER,Float32Array,g.positions),norm:upload(gl.ARRAY_BUFFER,Float32Array,g.normals),
        uv:upload(gl.ARRAY_BUFFER,Float32Array,g.uvs||new Float32Array(g.positions.length/3*2)),
        index:upload(gl.ELEMENT_ARRAY_BUFFER,Uint16Array,g.indices),count:g.indices.length,hasUv:Boolean(g.uvs),
        color:g.color,kind:g.kind||0,metal:metal?.76:g.kind===3?.6:.025,rough:metal?.31:rubber?.74:.39};
    }
    const kart=model.groups.map(makeMesh),stage=platform.map(makeMesh);
    const shadowSize=1024,lightVP=multiply(new Float32Array([.41,0,0,0, 0,.41,0,0,0,0,-.17,0,0,0,-1.01,1]),lookAt([-3.4,5.2,3.2],[0,.48,0]));
    function texture(pixel) {
      const tex=gl.createTexture();textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixel));return tex;
    }
    const atlas=texture([255,255,255,255]),surface=texture([128,128,166,255]),shadow=texture([255,255,255,255]);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const framebuffer=gl.createFramebuffer(),depthBuffer=gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadow,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depthBuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depthBuffer);
    const shadows=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    let disposed=false,baseReady=false,surfReady=false,lastYaw=NaN,lastPose=-1;
    const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
    function loadTexture(url,target,loaded) {
      if(!url)return;
      loadImage(url).then(img=>{
        if(disposed)return;
        const limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
        let source=img;
        if(Math.max(img.width,img.height)>limit){
          const scale=limit/Math.max(img.width,img.height);
          source=document.createElement('canvas');source.width=Math.max(1,Math.floor(img.width*scale));source.height=Math.max(1,Math.floor(img.height*scale));
          const ctx=source.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,source.width,source.height);
        }
        gl.bindTexture(gl.TEXTURE_2D,target);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        if((source.width&(source.width-1))===0&&(source.height&(source.height-1))===0){
          gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
          if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        }
        loaded();invalidate();
      }).catch(()=>{});
    }
    loadTexture(window.AcornKartTexture,atlas,()=>baseReady=true);
    loadTexture(window.AcornKartSurface,surface,()=>surfReady=true);
    function attr(slot,buffer,size) {
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,size,gl.FLOAT,false,0,0);
    }
    function geo(mesh,lit) {
      attr(0,mesh.pos,3);
      if(mesh.skin){
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.skin);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.UNSIGNED_BYTE,false,0,0);
      }else{gl.disableVertexAttribArray(3);gl.vertexAttrib2f(3,0,255);}
      if(lit){
        attr(1,mesh.norm,3);attr(2,mesh.uv,2);gl.uniform3fv(uni.base,mesh.color);
        gl.uniform1f(uni.kind,mesh.kind);
        gl.uniform1f(uni.metal,mesh.metal);gl.uniform1f(uni.rough,mesh.rough);
        gl.uniform1f(uni.atlasReady,Number(baseReady&&mesh.hasUv));gl.uniform1f(uni.surfaceReady,Number(surfReady&&mesh.hasUv));
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
    }
    return {
      render(state){
        const {eye,matrix,model:spin}=view(state,canvas.width/canvas.height);
        const stamp=state.poseVersion||0;
        if(shadows&&(lastYaw!==state.yaw||lastPose!==stamp)){
          gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          gl.useProgram(depthProgram);gl.uniformMatrix4fv(du.transform,false,lightVP);gl.uniformMatrix4fv(du.model,false,spin);
          gl.uniformMatrix4fv(du.palette,false,state.palette||restPose);
          gl.disableVertexAttribArray(1);gl.disableVertexAttribArray(2);
          for(const m of kart)geo(m,false);
          lastYaw=state.yaw;lastPose=stamp;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(main);gl.uniform3fv(uni.eye,eye);gl.uniformMatrix4fv(uni.transform,false,matrix);gl.uniformMatrix4fv(uni.lightVP,false,lightVP);gl.uniform1f(uni.shadowReady,Number(shadows));
        [atlas,surface,shadow].forEach((tex,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);});
        gl.uniform1i(uni.atlas,0);gl.uniform1i(uni.surface,1);gl.uniform1i(uni.shadow,2);
        gl.uniformMatrix4fv(uni.palette,false,restPose);gl.uniformMatrix4fv(uni.model,false,identity());for(const m of stage)geo(m,true);
        gl.uniform1f(uni.wheelExposure,state.playing?state.wheelExposure||0:0);
        gl.uniformMatrix4fv(uni.palette,false,state.palette||restPose);gl.uniformMatrix4fv(uni.model,false,spin);for(const m of kart)geo(m,true);
      },
      dispose(){
        disposed=true;
        for(const b of buffers)gl.deleteBuffer(b);for(const t of textures)gl.deleteTexture(t);
        for(const p of programs)gl.deleteProgram(p);for(const s of shaders)gl.deleteShader(s);
        gl.deleteRenderbuffer(depthBuffer);gl.deleteFramebuffer(framebuffer);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }
  // Rasterize the same model on systems where hardware acceleration is unavailable.
  // Average the paint over a shutter interval once per visible triangle.
  // This keeps the software turntable's per-pixel texture lookup inexpensive.
  function tireColor(g,face,model,arc,out){
    out[0]=1;out[1]=0;out[2]=0;out[3]=0;
    const i=g.indices,p=g.positions,bone=g.rig?.[i[face]];
    if(!(bone>=1&&bone<=4&&Math.abs(arc)>.09))return;
    const pin=model.pivots[bone],a=i[face]*3,b=i[face+1]*3,c=i[face+2]*3;
    const y=(p[a+1]+p[b+1]+p[c+1])/3-pin[1],z=(p[a+2]+p[b+2]+p[c+2])/3-pin[2];
    const x=((p[a]+p[b]+p[c])/3-pin[0])*Math.sign(pin[0]),radius=Math.hypot(y,z);
    const tread=radius>.257,shoulder=x>.106&&radius>.17&&radius<.235,hub=x>.126&&radius>.06&&radius<.15;
    if(!tread&&!shoulder&&!hub)return;
    const angle=Math.atan2(z,y),pitch=2*Math.PI/17,center=13*pitch,chevron=tread?.068*clamp(x/.055,-1,1):0;
    function band(mark,width){
      const half=Math.abs(arc)*.5,wrapped=angle-mark+arc*.5;
      const d=Math.atan2(Math.sin(wrapped),Math.cos(wrapped));
      return Math.max(0,Math.min(d+half,width)-Math.max(d-half,-width))/(2*half);
    }
    const amount=clamp((Math.abs(arc)-.09)/.54,0,1),base=tread?.90:shoulder?.68:.49;
    const t=tread?[47,42,35]:shoulder?[61,54,44]:[117,110,89];
    const gold=hub?0:Math.min(.96,1.23*band(center+chevron,.102)**.63);
    const ivory=shoulder||tread&&x<0?0:Math.min(.99,1.24*band(hub?center:center+pitch+chevron,hub?.117:.085)**.63);
    out[0]=1-amount+amount*(1-base)*(1-gold)*(1-ivory);
    for(let j=0;j<3;j++)out[j+1]=amount*((base*t[j]*(1-gold)+[235,163,54][j]*gold)*(1-ivory)+[245,227,181][j]*ivory);
  }
  function makeSoftware(canvas,model,invalidate){
    const ctx=canvas.getContext('2d');
    const projected=new WeakMap();
    let levels=null,disposed=false,frame=null,stageKey='';
    const url=window.AcornKartTexture;
    if(url){
      if(!softwareAtlases.has(url))softwareAtlases.set(url,loadImage(url).then(img=>{
        const imageCanvas=document.createElement('canvas'),c=imageCanvas.getContext('2d',{willReadFrequently:true}),mips=[];
        for(let w=img.width,h=img.height;w>=16&&h>=16;w=Math.floor(w/2),h=Math.floor(h/2)){
          imageCanvas.width=w;imageCanvas.height=h;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
          c.drawImage(img,0,0,w,h);mips.push(c.getImageData(0,0,w,h));
        }
        return mips;
      }));
      softwareAtlases.get(url).then(mips=>{if(!disposed){levels=mips;invalidate();}}).catch(()=>{});
    }
    return {software:true,render(state){
      const w=canvas.width,h=canvas.height;
      if(!frame||frame.pixels.width!==w||frame.pixels.height!==h){
        frame={pixels:ctx.createImageData(w,h),depth:new Float32Array(w*h),stagePixels:new Uint8ClampedArray(w*h*4),stageDepth:new Float32Array(w*h)};
        stageKey='';
      }
      const {pixels,depth}=frame;
      const viewData=view(state,w/h), s=Math.sin(state.yaw),c=Math.cos(state.yaw);
      function draw(g,spun){
        const mat=spun?multiply(viewData.matrix,viewData.model):viewData.matrix;
        const p=g.positions,n=g.normals,i=g.indices,uv=g.uvs;
        if(!projected.has(g))projected.set(g,new Float32Array(p.length*2));
        const verts=projected.get(g);
        const bones=spun&&g.rig&&state.palette;
        for(let k=0,j=0;k<p.length;k+=3,j+=6){
          let x=p[k],y=p[k+1],z=p[k+2],nx=n[k],ny=n[k+1],nz=n[k+2];
          if(bones){
            const vertex=k/3,id=g.rig[vertex],a=id*16;
            let px=bones[a]*x+bones[a+4]*y+bones[a+8]*z+bones[a+12],py=bones[a+1]*x+bones[a+5]*y+bones[a+9]*z+bones[a+13],pz=bones[a+2]*x+bones[a+6]*y+bones[a+10]*z+bones[a+14];
            let vx=bones[a]*nx+bones[a+4]*ny+bones[a+8]*nz,vy=bones[a+1]*nx+bones[a+5]*ny+bones[a+9]*nz,vz=bones[a+2]*nx+bones[a+6]*ny+bones[a+10]*nz;
            const weight=g.flex?.[vertex]??1;
            if(weight<.999){
              const b=window.AcornRig.parents[id]*16,f=1-weight;
              px=px*weight+(bones[b]*x+bones[b+4]*y+bones[b+8]*z+bones[b+12])*f;
              py=py*weight+(bones[b+1]*x+bones[b+5]*y+bones[b+9]*z+bones[b+13])*f;
              pz=pz*weight+(bones[b+2]*x+bones[b+6]*y+bones[b+10]*z+bones[b+14])*f;
              vx=vx*weight+(bones[b]*nx+bones[b+4]*ny+bones[b+8]*nz)*f;
              vy=vy*weight+(bones[b+1]*nx+bones[b+5]*ny+bones[b+9]*nz)*f;
              vz=vz*weight+(bones[b+2]*nx+bones[b+6]*ny+bones[b+10]*nz)*f;
            }
            x=px;y=py;z=pz;nx=vx;ny=vy;nz=vz;
          }
          const rw=1/(mat[3]*x+mat[7]*y+mat[11]*z+mat[15]);
          verts[j]=(.5+.5*(mat[0]*x+mat[4]*y+mat[8]*z+mat[12])*rw)*w;
          verts[j+1]=(.5-.5*(mat[1]*x+mat[5]*y+mat[9]*z+mat[13])*rw)*h;
          verts[j+2]=(mat[2]*x+mat[6]*y+mat[10]*z+mat[14])*rw;verts[j+3]=rw;
          if(spun){const t=c*nx+s*nz;nz=-s*nx+c*nz;nx=t;}
          const diffuse=Math.max(0,nx*lightDirection[0]+ny*lightDirection[1]+nz*lightDirection[2]);
          verts[j+4]=(.60+.14*ny+.36*diffuse+.065*Math.max(0,nx+nz*.25))*rw;
          verts[j+5]=Math.pow(Math.max(0,-.33*nx+.64*ny+.69*nz),30)*rw*22;
        }
        const tex=Boolean(spun&&levels&&uv),top=g.kind===2,bytes=pixels.data;
        const tire=[1,0,0,0],motionArc=spun&&state.playing?state.wheelExposure||0:0;
        for(let face=0;face<i.length;face+=3){
          const a=i[face]*6,b=i[face+1]*6,d=i[face+2]*6;
          const ax=verts[a],ay=verts[a+1],bx=verts[b],by=verts[b+1],cx=verts[d],cy=verts[d+1];
          const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<.001)continue;
          if(motionArc)tireColor(g,face,model,motionArc,tire);
          const x0=clamp(Math.floor(Math.min(ax,bx,cx)),0,w-1),x1=clamp(Math.ceil(Math.max(ax,bx,cx)),0,w-1);
          const y0=clamp(Math.floor(Math.min(ay,by,cy)),0,h-1),y1=clamp(Math.ceil(Math.max(ay,by,cy)),0,h-1);
          const aU=uv?uv[i[face]*2]*verts[a+3]:0,bU=uv?uv[i[face+1]*2]*verts[b+3]:0,dU=uv?uv[i[face+2]*2]*verts[d+3]:0;
          const aV=uv?uv[i[face]*2+1]*verts[a+3]:0,bV=uv?uv[i[face+1]*2+1]*verts[b+3]:0,dV=uv?uv[i[face+2]*2+1]*verts[d+3]:0;
          let atlas;
          if(tex){
            const u0=uv[i[face]*2],v0=uv[i[face]*2+1],u1=uv[i[face+1]*2],v1=uv[i[face+1]*2+1],u2=uv[i[face+2]*2],v2=uv[i[face+2]*2+1];
            const dx=Math.hypot(levels[0].width*((by-cy)*(u0-u2)+(cy-ay)*(u1-u2)),levels[0].height*((by-cy)*(v0-v2)+(cy-ay)*(v1-v2)))/Math.abs(det);
            const dy=Math.hypot(levels[0].width*((cx-bx)*(u0-u2)+(ax-cx)*(u1-u2)),levels[0].height*((cx-bx)*(v0-v2)+(ax-cx)*(v1-v2)))/Math.abs(det);
            atlas=levels[clamp(Math.floor(Math.log2(Math.max(1,Math.max(dx,dy)))),0,levels.length-1)];
          }
          for(let y=y0;y<=y1;y++){
            for(let x=x0;x<=x1;x++){
              const ba=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/det;
              const bb=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/det,bc=1-ba-bb;
              if(ba<0||bb<0||bc<0)continue;
              const pixel=y*w+x,z=ba*verts[a+2]+bb*verts[b+2]+bc*verts[d+2];
              if(z>depth[pixel])continue;depth[pixel]=z;
              const rhw=1/(ba*verts[a+3]+bb*verts[b+3]+bc*verts[d+3]);
              let light=(ba*verts[a+4]+bb*verts[b+4]+bc*verts[d+4])*rhw;
              const gloss=(ba*verts[a+5]+bb*verts[b+5]+bc*verts[d+5])*rhw;
              let R=g.color[0]*255,G=g.color[1]*255,B=g.color[2]*255;
              if(tex||top){
                const U=(aU*ba+bU*bb+dU*bc)*rhw,V=(aV*ba+bV*bb+dV*bc)*rhw;
                if(tex){
                  const t=4*(clamp(Math.floor(V*atlas.height),0,atlas.height-1)*atlas.width+clamp(Math.floor(U*atlas.width),0,atlas.width-1));
                  R=atlas.data[t];G=atlas.data[t+1];B=atlas.data[t+2];
                }else{
                  const wx=(U-.5)*2.74,wz=(V-.5)*2.74,rx=c*wx-s*wz,rz=s*wx+c*wz;
                  light*=1-.49*Math.exp(-1.75*(rx*rx/.60+rz*rz/.99));
                  const tireX=(Math.abs(rx)-.54)/.21,tireZ=(Math.abs(rz)-.59)/.28;
                  light*=1-.62*Math.exp(-1.13*(tireX*tireX+tireZ*tireZ));
                  light*=.96+.024*Math.sin(wz*82+.7*Math.sin(wx*9)+1.2*Math.sin(wz*17))+.013*Math.sin(wz*121+wx*4);
                }
              }
              if(tire[0]<1){R=R*tire[0]+tire[1];G=G*tire[0]+tire[2];B=B*tire[0]+tire[3];}
              const at=pixel*4;bytes[at]=R*light+gloss;bytes[at+1]=G*light+gloss*.88;bytes[at+2]=B*light+gloss*.77;bytes[at+3]=255;
            }
          }
        }
      }
      // Only the kart moves on the test stand. Retain the fixed pedestal pixels
      // and depth until the camera or viewport changes.
      const key=[state.yaw,state.pitch,state.zoom].join('/');
      if(key!==stageKey){
        pixels.data.fill(0);depth.fill(Infinity);
        for(const g of platform)draw(g,false);
        frame.stagePixels.set(pixels.data);frame.stageDepth.set(depth);stageKey=key;
      }else{pixels.data.set(frame.stagePixels);depth.set(frame.stageDepth);}
      const groups=(state.moving||state.playing)&&model.lod?.length?model.lod:model.groups;
      for(const g of groups)draw(g,true);
      ctx.putImageData(pixels,0,0);
    },dispose(){disposed=true;}};
  }

  const paths={
    play:'<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14m8-14v14" stroke-width="4"/>',
    orbit:'<path d="M4 14c2 3 7 4 12 2 5-2 7-6 5-8-2-3-7-3-12-1C5 9 3 11 3 13m1-4-1 4 4 1"/><path d="M10 5c2 2 3 4 4 7s1 5 0 7"/>',
    left:'<path d="M18 7a7 7 0 1 0 1 9M18 3v5h-5"/>',right:'<path d="M6 7a7 7 0 1 1-1 9M6 3v5h5"/>',
    minus:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6"/>',
    plus:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6m-3-3v6"/>',
    reset:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>'
  };
  const icon=name=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">'+paths[name]+'</svg>';
  let current=null,mountVersion=0;
  function stop(){mountVersion++;current?.();current=null;}
  function mount(container,driverIndex){
    stop();
    const model=window.AcornKartModels?.[driverIndex],driver=window.RallyData.drivers[driverIndex];
    if(!container||!driver)return;
    if(!model){
      const version=mountVersion;
      container.className='kv-stage';
      container.innerHTML='<div class="kv-background"></div><p class="kv-loading" role="status">Loading '+driver.kart+'…</p>';
      loadModels().then(()=>{
        if(version===mountVersion&&container.isConnected)mount(container,driverIndex);
      }).catch(()=>{
        if(version!==mountVersion||!container.isConnected)return;
        const status=container.querySelector('.kv-loading');
        status.textContent='Could not load the kart. ';
        const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>mount(container,driverIndex);status.append(retry);
      });
      return;
    }
    const actionButtons=[['left','Rotate left'],['right','Rotate right'],['minus','Zoom out'],['plus','Zoom in'],['reset','Reset view']];
    container.className='kv-stage';
    container.setAttribute('aria-label',driver.kart+' inspection');
    container.innerHTML='<div class="kv-background"></div><div class="kv-base-shadow"></div><canvas tabindex="0" aria-label="Interactive 3D view of '+driver.name+' driving the '+driver.kart+'. Arrow keys rotate, plus and minus zoom, Home resets."></canvas>'+
      '<div class="kv-label"><span>'+icon('orbit')+' 360° VIEW · DRAG TO ROTATE</span><h2>'+driver.kart+'</h2></div><div class="kv-bar"><button type="button" class="kv-motion" data-kv="preview" aria-pressed="false">'+icon('play')+'Preview motion</button><div role="group" aria-label="Model controls">'+
      actionButtons.map(([action,label])=>'<button type="button" data-kv="'+action+'" title="'+label+'" aria-label="'+label+'">'+icon(action)+'</button>').join('')+'</div></div>';
    let canvas=container.querySelector('canvas');
    let high=0;
    for(const g of model.groups)for(let i=1;i<g.positions.length;i+=3)high=Math.max(high,g.positions[i]);
    const defaults={yaw:-.67,pitch:.14,zoom:1},state={...defaults,high,moving:false,playing:false,palette:null,poseVersion:0};
    const palette=new Float32Array(16*16),previewButton=container.querySelector('[data-kv="preview"]');
    const canAnimate=Boolean(model.pivots?.length===16&&window.AcornRig?.pose);
    previewButton.hidden=!canAnimate;
    let renderer,frame=0,dispose=false,inView=true,idleTimer=0,elapsed=0,benchRacer={driverIndex},lastPoseTime=0,softWidth=640;
    const listeners=new AbortController(),events={signal:listeners.signal};
    function invalidate(){
      if(!frame&&inView&&!document.hidden&&!dispose)frame=requestAnimationFrame(draw);
    }
    function draw(now){
      frame=0;if(dispose||!renderer||!container.isConnected)return;
      const width=container.clientWidth,height=container.clientHeight;
      if(!width||!height)return;
      if(state.playing){
        const interval=renderer.software?1000/24:1000/60;
        if(lastPoseTime&&now-lastPoseTime<interval-1){invalidate();return;}
        const dt=lastPoseTime?Math.min((now-lastPoseTime)/1000,.12):0;
        elapsed+=dt;lastPoseTime=now;
        const pose=previewMotion(elapsed,benchRacer,dt);
        state.wheelExposure=window.AcornRig.exposure(model,pose.wheelV,dt);
        state.palette=window.AcornRig.pose(model,pose,palette);
        state.poseVersion++;
      }
      const cap=renderer.software?(state.playing?softWidth:state.moving?660:1080):1850,dpr=Math.min(devicePixelRatio||1,1.8,cap/width);
      const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const start=performance.now();
      renderer.render(state);
      if(state.playing){
        if(renderer.software){
          const duration=performance.now()-start;
          if(duration>46&&softWidth>380)softWidth=Math.max(380,Math.round(softWidth*.9));
          else if(duration<20&&softWidth<640)softWidth=Math.min(640,Math.round(softWidth*1.04));
        }
        invalidate();
      }
      container.querySelector('[data-kv="minus"]').disabled=state.zoom<=.7301;
      container.querySelector('[data-kv="plus"]').disabled=state.zoom>=1.75;
    }
    try{renderer=makeGL(canvas,model,invalidate);}catch(e){console.warn('Using the software kart viewer.',e.message);}
    if(!renderer){
      const alternate=canvas.cloneNode();canvas.replaceWith(alternate);canvas=alternate;
      renderer=makeSoftware(canvas,model,invalidate);
    }
    function motion(){
      state.moving=true;clearTimeout(idleTimer);idleTimer=setTimeout(()=>{state.moving=false;invalidate();},160);invalidate();
    }
    function zoom(by){state.zoom=clamp(state.zoom*by,.73,1.75);motion();}
    function play(value){
      state.playing=canAnimate&&value;lastPoseTime=0;
      previewButton.setAttribute('aria-pressed',String(state.playing));
      previewButton.innerHTML=icon(state.playing?'pause':'play')+(state.playing?'Pause motion':'Preview motion');
      invalidate();
    }
    function action(name){
      if(name==='preview')return play(!state.playing);
      if(name==='left'||name==='right')state.yaw+=name==='left'?-.24:.24;
      else if(name==='minus'||name==='plus')return zoom(name==='plus'?1.16:1/1.16);
      else if(name==='reset'){play(false);Object.assign(state,defaults);elapsed=0;benchRacer={driverIndex};state.palette=null;state.poseVersion++;}
      motion();
    }
    container.querySelector('.kv-bar').addEventListener('click',e=>{
      const btn=e.target.closest('[data-kv]');if(btn)action(btn.dataset.kv);
    },events);
    canvas.addEventListener('keydown',e=>{
      const cmd={ArrowLeft:'left',ArrowRight:'right','+':'plus','=':'plus','-':'minus',Home:'reset','0':'reset'}[e.key];
      if(cmd){e.preventDefault();action(cmd);}
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();state.pitch=clamp(state.pitch+(e.key==='ArrowUp'?.07:-.07),.06,.62);motion();}
    },events);
    const pointers=new Map();
    function span(){const a=Array.from(pointers.values());return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;}
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.classList.add('is-dragging');
    },events);
    canvas.addEventListener('pointermove',e=>{
      const old=pointers.get(e.pointerId);if(!old)return;
      const before=span();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const after=span();if(before>1)zoom(after/before);}
      else{state.yaw+=(e.clientX-old.x)*.0105;state.pitch=clamp(state.pitch+(e.clientY-old.y)*.004,.06,.62);motion();}
    },events);
    function release(e){pointers.delete(e.pointerId);if(!pointers.size)canvas.classList.remove('is-dragging');}
    canvas.addEventListener('lostpointercapture',release,events);canvas.addEventListener('pointercancel',release,events);
    canvas.addEventListener('wheel',e=>{if(document.activeElement===canvas||e.ctrlKey){e.preventDefault();zoom(Math.exp(-e.deltaY*.002));}},{...events,passive:false});
    const resize=new ResizeObserver(invalidate);resize.observe(container);
    const visible=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;lastPoseTime=0;if(inView)invalidate();});visible.observe(container);
    document.addEventListener('visibilitychange',()=>{lastPoseTime=0;if(!document.hidden)invalidate();},events);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!dispose)mount(container,driverIndex);},events);
    current=()=>{dispose=true;listeners.abort();resize.disconnect();visible.disconnect();cancelAnimationFrame(frame);clearTimeout(idleTimer);renderer.dispose();};
    invalidate();
  }
  window.KartViewer={mount,stop,loadModels};
})();
