(function(root){
  'use strict';
  const tau=Math.PI*2, sim=root.AcornSim;
  const palettes=[
    {sky:'#9ccbd0',mist:'#afd0a7',soil:'#9a7143',edge:'#527738',land:'#405d32',wood:'#60412a',accent:'#f4a648',leaf:['#285334','#416b3d','#729341'],water:'#407b78'},
    {sky:'#a6d3d2',mist:'#bdd5aa',soil:'#a99571',edge:'#658046',land:'#5f7848',wood:'#795735',accent:'#de5739',leaf:['#497747','#6a9b58','#939b55'],water:'#448e8b'},
    {sky:'#9bceda',mist:'#c3d1bd',soil:'#977c60',edge:'#71944d',land:'#789454',wood:'#795439',accent:'#e2693c',leaf:['#5e7f45','#6b914f','#8e9d58'],water:'#448f9b'},
    {sky:'#85b5d1',mist:'#f3bf8c',soil:'#c88c5d',edge:'#be764c',land:'#b77c58',wood:'#79503a',accent:'#77c0c9',leaf:['#6e7a46','#a4a15d','#757b53'],water:'#8b8273'},
    {sky:'#91bfe7',mist:'#d8e7eb',soil:'#c8d3d0',edge:'#dce3dc',land:'#c4d3d1',wood:'#807466',accent:'#ef6c3c',leaf:['#8a8f75','#a8aa86','#677967'],water:'#78adbd'},
    {sky:'#91c3d7',mist:'#ebc5a3',soil:'#caa288',edge:'#b08a70',land:'#c3a087',wood:'#866347',accent:'#d75a32',leaf:['#737e56','#879165','#a49c65'],water:'#8d9593'},
    {sky:'#80c0cc',mist:'#a6cdb9',soil:'#928772',edge:'#477f55',land:'#3b7251',wood:'#74533b',accent:'#f2af46',leaf:['#226947','#388052','#70a55a'],water:'#418e96'},
    {sky:'#9cb9c6',mist:'#bcc6c7',soil:'#545c5d',edge:'#5f724a',land:'#63734d',wood:'#786b57',accent:'#fbbb49',leaf:['#557249','#778553','#91a364'],water:'#668c99'}
  ].concat(root.AcornExpansionWorld?.palettes || []);
  function rgb(hex){return typeof hex==='string'?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):hex;}
  function tone(col,f){return rgb(col).map(a=>Math.min(1,a*f));}
  function dir(a,b){const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],k=Math.hypot(x,y,z)||1;return [x/k,y/k,z/k];}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  class Mesh{
    constructor(){this.data=[];}
    tri(a,b,c,color,surf=0,norm=null){const n=norm||dir([0,0,0],cross(dir(a,b),dir(a,c)));const co=rgb(color);for(const p of [a,b,c])this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],co[0],co[1],co[2],surf);}
    quad(a,b,c,d,col,mat=0,normal=null){this.tri(a,b,c,col,mat,normal);this.tri(a,c,d,col,mat,normal);}
    ring(a,b,ra,rb,col,sides=8,mat=0){
      const axis=dir(a,b),base=Math.abs(axis[1])>.85?[1,0,0]:[0,1,0],u=dir([0,0,0],cross(axis,base)),v=cross(axis,u);
      const rim=(p,r,j)=>{const x=Math.cos(tau*j/sides)*r,y=Math.sin(tau*j/sides)*r;return p.map((n,i)=>n+u[i]*x+v[i]*y);};
      for(let j=0;j<sides;j++){const p=rim(a,ra,j),q=rim(a,ra,j+1),r=rim(b,rb,j+1),s=rim(b,rb,j);this.quad(p,q,r,s,tone(col,.94+.08*Math.cos(j*1.27)),mat);if(rb>.001)this.tri(b,s,r,col,mat,axis);}
    }
    blob(x,y,z,rx,ry,rz,col,sides=7,mat=0,tilt=0){
      const rows=[[-1,.03],[-.53,.84],[.12,1],[.72,.68],[1,.025]],pt=(j,k)=>{const a=tau*j/sides+tilt+(k%2)*.17;return [x+Math.cos(a)*rx*rows[k][1],y+ry*rows[k][0],z+Math.sin(a)*rz*rows[k][1]];};
      for(let k=0;k<rows.length-1;k++)for(let j=0;j<sides;j++)this.quad(pt(j+1,k),pt(j,k),pt(j,k+1),pt(j+1,k+1),tone(col,.95+.07*Math.sin(j*2.798+k*3.1)),mat);
    }
    box(x,y,z,w,h,d,yaw,col,mat=0){
      const c=Math.cos(yaw),s=Math.sin(yaw),p=(a,b,k)=>[x+a*c+k*s,y+b,z-a*s+k*c];
      const a=p(-w/2,0,-d/2),b=p(w/2,0,-d/2),e=p(w/2,0,d/2),f=p(-w/2,0,d/2),A=p(-w/2,h,-d/2),B=p(w/2,h,-d/2),E=p(w/2,h,d/2),F=p(-w/2,h,d/2);
      this.quad(a,A,B,b,col,mat);this.quad(b,B,E,e,col,mat);this.quad(e,E,F,f,col,mat);this.quad(f,F,A,a,col,mat);this.quad(A,F,E,B,col,mat,[0,1,0]);
    }
  }
  const vp=`attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float m;attribute vec2 texCoord,skin;
  uniform mat4 proj,view,model,bones[16];uniform float articulated;varying vec3 wp,normal,col;varying float encodedMaterial,depth;varying vec2 uv;
  ${root.AcornRig.wheelVertex}
  void main(){
    bindTire(p,articulated*skin.x);
    vec4 point=vec4(p,1.);vec3 norm=n;
    if(articulated>.5){
      int j=int(skin.x+.5);mat4 transform=bones[j];
      if(skin.y<254.5&&(j==9||j==14||j==15)){
        int parent=j==9?5:(j==14?9:14);float amount=skin.y/255.;
        transform=bones[parent]*(1.-amount)+transform*amount;
      }
      point=transform*point;norm=mat3(transform)*exposedNormal(norm);
    }
    vec4 world=model*point;wp=world.xyz;normal=mat3(model)*norm;col=c;encodedMaterial=m;uv=m<7.8?texCoord:(m>=12.&&m<13.?vec2(p.z,p.y):p.xz);
    vec4 camera=view*world;depth=-camera.z;gl_Position=proj*camera;
  }`;
  const fp=`precision highp float;varying vec3 wp,normal,col;varying float encodedMaterial,depth;varying vec2 uv;uniform vec3 fog,eye,driverPoint;uniform float clock,alpha,usingAtlas,trackId;uniform sampler2D kartAtlas,kartSurface;uniform bool skidPass;
  ${root.AcornRig.wheelFragment}
  ${root.AcornSurfaces?.glsl||'vec3 materialGrain(vec3 wp,vec3 normal,float mat,float trackId){return vec3(1.);}'}
  float h(vec2 p){return fract(sin(dot(mod(p,256.),vec2(12.9898,78.233)))*437.58);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
  void main(){float mat=encodedMaterial>=30.?encodedMaterial-30.:encodedMaterial;
    if(skidPass){
      // Only the skid pass interprets vertex colors as birth time, tread and load.
      float age=clock-col.r,fade=1.-smoothstep(15.,20.,age);
      float edge=1.-smoothstep(.70,1.,abs(col.g));
      float groove=1.-.23*smoothstep(.76,1.,cos(col.g*17.));
      float ink=(.46+.36*col.b)*edge*fade*groove*(.82+.18*noise(wp.xz*12.));
      if(ink<.015)discard;
      gl_FragColor=vec4(mix(vec3(.096,.078,.065),fog,smoothstep(48.,130.,depth)),ink);return;
    }
    vec3 norm=normalize(normal);vec3 sun=normalize(vec3(-.54,.91,-.43));vec3 tint=col;float highlight=0.;
    if(depth<7.6&&(encodedMaterial>=30.||(mat>2.5&&mat<3.5)||(mat>1.5&&mat<2.5&&abs(norm.y)<.66)||(mat>5.5&&mat<6.5))){
      vec3 ray=driverPoint-eye,fromEye=wp-eye;float along=clamp(dot(fromEye,ray)/max(.1,dot(ray,ray)),0.,.97);
      if(length(fromEye-ray*along)<mix(2.15,.82,along))discard;
    }
    if(usingAtlas>.5){tint=texture2D(kartAtlas,uv).rgb;vec3 surface=texture2D(kartSurface,uv).rgb;vec3 base=abs(norm.y)>.8?vec3(1.,0.,0.):normalize(cross(vec3(0.,1.,0.),norm));vec3 bv=cross(norm,base);norm=normalize(norm+(base*(surface.r-.5)+bv*(surface.g-.5))*.52);vec3 halfVector=normalize(normalize(eye-wp)+sun);highlight=pow(max(0.,dot(norm,halfVector)),mix(58.,8.,surface.b))*(1.-surface.b*.83)*.24;}
    if(tire.w>.5)tint=exposedPaint(tint);
    float light=.66+.33*max(0.,dot(norm,sun))+.075*max(0.,norm.y);
    tint*=materialGrain(wp,norm,mat,trackId);
    float tex=1.;
    ${root.AcornSurfaces?'':`if(mat>.5&&mat<1.5){float a=noise(wp.xz*.9),b=noise(wp.xz*9.);tex=.88+.15*a+.11*b;}
    if(mat>1.5&&mat<2.5){tex=.87+.13*noise(vec2(wp.x+wp.z,wp.y*.13)*6.)+.1*noise(wp.xz*3.+wp.y*.25);}
    if(mat>2.5&&mat<3.5){tex=.92+.14*noise(wp.xz*1.4+wp.y*.58);}
    if(mat>5.5&&mat<6.5){float a=noise(wp.xz*1.1),b=noise(wp.xz*10.);tex=.9+.17*a+.07*b;}`}
    if(mat>3.5&&mat<4.5){float r=sin(wp.z*1.9+wp.x*.55+clock*1.75)*.5+.5;tex=.92+.12*r+.09*noise(wp.xz*2.+clock*.1);tint=mix(tint,vec3(.82,.91,.92),.1*r);}
    if(mat>4.5&&mat<5.5){light=1.06;tex=1.;}
    if(mat>6.5&&mat<7.5){
      vec3 toEye=normalize(eye-wp),ref=reflect(-toEye,norm),halfLight=normalize(sun+toEye);
      float rim=pow(1.-max(0.,dot(norm,toEye)),2.8),shine=pow(max(0.,dot(norm,halfLight)),31.);
      float skyReflection=smoothstep(.12,.75,ref.y);
      tint=mix(tint*vec3(.91,.74,.63),tint*vec3(1.14,1.16,.95),skyReflection);
      tint+=vec3(.30,.18,.042)*rim+vec3(.23,.16,.08)*skyReflection;highlight=shine*.84;light=.87+.17*max(0.,dot(norm,sun));
    }
    float opacity=alpha;
    if(mat>=7.98 && mat<19.5){
      float kind=floor(mat+.001),coverage=clamp((mat-kind)*3.704,0.,1.);
      vec2 current=vec2(uv.x*3.9-clock*(kind>9.5?.83:1.4),uv.y*7.7);
      if(kind==12.)current=vec2(uv.x*8.2,uv.y*2.4+clock*2.1);
      float longWave=noise(current*.73),ripple=noise(current*2.3+longWave*2.7),fine=noise(current*5.2+vec2(2.1*longWave,ripple));
      float shimmer=pow(max(0.,sin(12.*longWave+5.*ripple+fine)),12.)*.14;
      float fleck=smoothstep(.67,.88,ripple*.64+fine*.36);
      vec3 viewDir=normalize(eye-wp);float fresnel=pow(1.-abs(viewDir.y),2.3);
      tint=mix(tint*.76,tint*1.14,longWave*.70+fine*.30);
      tint=mix(tint,vec3(.81,.90,.86),fresnel*.20+shimmer+fleck*(kind==10.?.34:.21));
      tex=1.;light=1.;highlight=.018+ripple*.028;
      opacity*=mix(.035,.95,smoothstep(.025,.94,coverage+(.17*longWave+.08*fine-.13)));
      if(kind==11.){tint=mix(vec3(.74,.84,.81),vec3(.96,.96,.86),fine);opacity*=.70+.22*ripple;}
      if(kind==12.){tint=mix(tint,vec3(.88,.94,.83),smoothstep(.45,.8,ripple)*.47);opacity*=.78;}
    }
    ${root.AcornExpansionWorld?.materials || ''}
    float canopy=1.;if((trackId<1.5||abs(trackId-6.)<.3)&&mat<3.5){vec2 ground=wp.xz+vec2(.5,.35)*wp.y;canopy=mix(.78,1.075,smoothstep(.32,.69,noise(ground*.105)*.79+noise(ground*.88)*.21));}
    vec3 color=tint*(light*tex*canopy);color+=vec3(.035,.024,.007)*max(0.,dot(norm,sun))+vec3(highlight);float haze=1.-exp(-depth*depth*.000031);gl_FragColor=vec4(mix(color,fog,clamp(haze,0.,.94)),opacity);}`;
  const sv=`attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,.9999,1.);}`;
  const sf=`precision highp float;varying vec2 uv;uniform vec3 sky,fog;uniform float dir,aspect;
  ${root.AcornHorizon?.glsl||'vec3 backdrop(vec2 uv,float heading,float aspect,vec3 fallback){return fallback;}'}
  float hash(vec2 p){return fract(sin(dot(mod(p,256.),vec2(15.4,73.2)))*843.35);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){float g=smoothstep(.4,1.,uv.y);vec3 c=mix(fog,sky,g);vec2 p=vec2(uv.x*2.+dir*.32,uv.y*2.5);float cloud=smoothstep(.42,.88,n(p*2.)*.65+n(p*7.)*.35)*g;c=mix(c,vec3(.94,.94,.83),cloud*.53);
  float glow=exp(-length((uv-vec2(.72+.24*sin(dir),.83))*vec2(1.65,1.))*6.);c+=vec3(.19,.13,.045)*glow;gl_FragColor=vec4(backdrop(uv,dir,aspect,c),1.);}`;
  function shader(gl,vs,fs){function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  function matrix(x=0,y=0,z=0,yaw=0,scale=1,roll=0,pitch=0){
    const s=Math.sin(yaw),c=Math.cos(yaw),a=Math.cos(roll),b=Math.sin(roll),k=Math.cos(pitch),l=Math.sin(pitch);
    return new Float32Array([(c*a+s*l*b)*scale,k*b*scale,(-s*a+c*l*b)*scale,0,(-c*b+s*l*a)*scale,k*a*scale,(s*b+c*l*a)*scale,0,s*k*scale,-l*scale,c*k*scale,0,x,y,z,1]);
  }
  function view(eye,target){
    const z=dir(target,eye),x=dir([0,0,0],cross([0,1,0],z)),y=cross(z,x),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  }
  function project(aspect,fov){const a=1/Math.tan(fov/2),n=.14,f=390;return new Float32Array([a/aspect,0,0,0,0,a,0,0,0,0,-(f+n)/(f-n),-1,0,0,-2*f*n/(f-n),0]);}
  function fern(m,x,y,z,size,pal,rand){
    const phase=rand()*tau;for(let j=0;j<7;j++){
      const a=j*tau/7+phase,c=Math.cos(a),s=Math.sin(a),len=size*(.64+rand()*.48);
      const base=[x,y,z],end=[x+c*len,y+size*.42,z+s*len],mid=[x+c*len*.58,y+size*.64,z+s*len*.58];
      const wing=(q,w)=>[q[0]-s*w,q[1]+w*.3,q[2]+c*w];
      m.tri(base,mid,wing(mid,size*.095),pal[j%3],3);m.tri(mid,end,wing(mid,-size*.1),pal[(j+1)%3],3);
      for(let t=.24;t<.94;t+=.155){const p=[x+c*len*t,y+Math.sin(t*2.12)*size*.6,z+s*len*t],w=(1-t)*size*.27;for(const sign of [-1,1])m.tri(p,wing([p[0]+c*w*.78,p[1]+.018,p[2]+s*w*.78],w*sign),[p[0]+c*len*.19,p[1]+.02,p[2]+s*len*.19],pal[(j+1)%3],3);}
    }
  }
  function tree(m,x,y,z,size,index,pal,r){
    if(index===1){
      const h=size*(1.05+r()*.3),a=(r()-.5)*1.6,b=(r()-.5)*1.6,th=.15+size*.009;
      m.ring([x,y,z],[x+a,y+h,z+b],th,th*.72,'#63834a',7,2);
      for(let i=1;i<7;i++){const t=i/7;m.ring([x+a*t,y+h*t,z+b*t],[x+a*t,y+h*t+.09,z+b*t],th*1.16,th*1.05,'#a7a66d',7);}
      for(let j=0;j<4;j++)fern(m,x+a+(r()-.5)*2,y+h*(.62+r()*.36),z+b+(r()-.5)*2,size*.3,pal.leaf,r);
      return;
    }
    const h=size,rad=h*(index===6?.029:.047),lean=(r()-.5)*.8;
    m.ring([x,y,z],[x+lean,y+h*.81,z],rad*1.32,rad*.55,pal.wood,8,2);
    for(let j=0;j<4;j++){const a=j*tau/4+r()*.7;
      m.ring([x+Math.cos(a)*rad*2.8,y-.1,z+Math.sin(a)*rad*2.8],[x,y+rad*1.8,z],rad*.33,rad*.62,pal.wood,5,2);}
    if(index===6){fern(m,x+lean,y+h*.81,z,h*.54,pal.leaf,r);fern(m,x+lean,y+h*.85,z,h*.45,pal.leaf,r);return;}
    if(index===0&&r()<.52){
      const phase=r()*tau;
      for(let layer=0;layer<6;layer++){
        const t=layer/6,level=h*(.35+t*.68),radius=h*(.036+(1-t)*.215),length=h*(.1+.08*(1-t)),angle=phase+layer*1.08;
        for(let j=0;j<9;j++){
          const a=j*tau/9+angle+(r()-.5)*.13,c=Math.cos(a),s=Math.sin(a),len=radius*(.78+r()*.38),base=[x+lean*.7,y+level+length*.46,z],tip=[x+c*len,y+level-length*.47,z+s*len];
          const l=[x+c*len*.61-s*len*.30,y+level-length*.16,z+s*len*.61+c*len*.30],rr=[x+c*len*.61+s*len*.30,y+level-length*.14,z+s*len*.61-c*len*.30],ridge=[x+c*len*.59,y+level+length*.2,z+s*len*.59];
          const col=tone(pal.leaf[layer%3],.87+r()*.23);m.tri(base,l,ridge,col,3,[0,.86,.24]);m.tri(base,ridge,rr,col,3,[.3,.88,0]);m.tri(l,tip,ridge,col,3,[.1,.93,.12]);m.tri(ridge,tip,rr,tone(col,.86),3,[.12,.9,.2]);
        }
      }
      m.ring([x+lean,y+h*.90,z],[x+lean,y+h*1.06,z],h*.038,0,pal.leaf[1],6,3);
    }else{
      for(let j=0;j<3;j++){const a=tau*j/3+r()*.7,len=h*(.14+r()*.05),bx=x+Math.cos(a)*len,bz=z+Math.sin(a)*len,by=y+h*(.72+r()*.14);
        m.ring([x,y+h*.49,z],[bx,by,bz],rad*.7,rad*.21,pal.wood,6,2);m.blob(bx,by,bz,len*1.3,len*.9,len*1.12,pal.leaf[j],7,3);
        if(index===0){const ex=bx+Math.cos(a)*len*.52,ez=bz+Math.sin(a)*len*.52; m.blob(ex,by+len*.29,ez,len*.86,len*.72,len*.82,tone(pal.leaf[j],1.08),6,3);
          for(let w=0;w<4;w++){const px=ex+(r()-.5)*len*1.33,pz=ez+(r()-.5)*len*1.33,hy=by+len*.24,lenY=(.23+r()*.77)*len;
            m.tri([px-.105,hy,pz],[px+.14,hy,pz+.08],[px+.055,hy-lenY,pz+.15],'#7a8954',3,[0,.7,.4]);}}}
      m.blob(x,y+h*.92,z,h*.18,h*.17,h*.18,pal.leaf[1],7,3);
    }
  }
  function building(m,x,y,z,scale,pal){
    m.ring([x,y,z],[x,y+scale*4.3,z],scale*2.25,scale*1.5,'#a17d59',10,2);
    m.ring([x,y+scale*4.2,z],[x,y+scale*6.4,z],scale*1.85,scale*.15,'#82643b',10,2);
    for(let i=0;i<3;i++)m.box(x,y+scale*(1+i),z+scale*(2.1-.21*i),scale*.63,scale*.76,scale*.12,0,'#36494a');
  }
  function regionProp(m,x,y,z,size,index,pal,r){
    if(index===0||index===1||index===6){tree(m,x,y,z,size,index,pal,r);return;}
    if(index===2){if(r()<.6)tree(m,x,y,z,size*.75,2,pal,r);else fern(m,x,y,z,size*.23,pal.leaf,r);return;}
    if(index===3){for(let j=0;j<3;j++){const rr=size*(.55-j*.09);m.ring([x,y+size*.22*j,z],[x+size*.03,y+size*.22*(j+1),z],rr,rr*.92,['#a76042','#b97450','#ce8b61'][j],7,6);}return;}
    if(index===4){m.blob(x,y+size*.18,z,size*.64,size*.35,size*.42,r()<.5?'#5c6466':'#767c77',7,6);return;}
    if(index===5){m.ring([x,y,z],[x+.16,y+size*.87,z],size*.34,size*.095,'#d6b198',8,6);m.blob(x+.16,y+size*.9,z,size*.19,size*.11,size*.17,'#967e72',7,6);return;}
    if(index===7){for(let j=0;j<4;j++){const d=size*.2,h=size*(.4+r()*.49),a=j*tau/4;m.ring([x+Math.cos(a)*d,y,z+Math.sin(a)*d],[x+Math.cos(a)*d,y+h,z+Math.sin(a)*d],d*.85,d*.79,['#4d5556','#5f6767','#656d6a','#535d60'][j],6,6);}}
  }
  function worldMeshes(course){
    if(course.index>=8)return root.AcornExpansionWorld.build(Mesh,course,sim);
    const index=course.index,pal=palettes[index],r=seeded(830483+index*143),m=new Mesh(),mov=[],p=course.points,count=p.length;
    const local=(a,x,y=0,forward=0)=>[a.x+a.nx*x+a.tx*forward,a.y+y,a.z+a.nz*x+a.tz*forward];
    const roadP=(s,x=0,br=false)=>sim.sample(course,s,x,br);
    function strip(a,b,x1,x2,y1,y2,col,mat=1){m.quad(local(a,x1,y1),local(b,x1,y1),local(b,x2,y2),local(a,x2,y2),col,mat,[0,1,0]);}
    m.quad([-1500,-1.35,-1500],[-1500,-1.35,1500],[1500,-1.35,1500],[1500,-1.35,-1500],index===4||index===7?pal.water:pal.land,index===4||index===7?4:1,[0,1,0]);
    for(let j=0;j<count;j++){
      const a=p[j],b=p[(j+1)%count],s=course.length*j/count,u=j/count,nearBridge=Math.abs(u-course.bridgeS)<(index===0?.038:.032);
      const plank=nearBridge&&[0,1,2,6].includes(index);
      const w=a.w;
      for(const sign of [-1,1]) {
        if(!plank){strip(a,b,sign*w,sign*(w+2.7),-.025,-.31,tone(pal.edge,.92+.03*Math.sin(j*.22)),1);
          const outer=sign*(w+11+2.3*Math.sin(j*.11)),a1=local(a,sign*(w+2.7),-.32),b1=local(b,sign*(w+2.7),-.32),a2=local(a,outer),b2=local(b,outer);a2[1]=-.96;b2[1]=-.96;
          m.quad(a1,b1,b2,a2,pal.land,1,[0,1,0]);}
        if(plank){const ap=local(a,sign*(w-.16),.24),bp=local(b,sign*(w-.16),.24);m.ring(ap,bp,.22,.22,pal.wood,7,2);if(j%4===0){const pt=local(a,sign*(w-.18));m.ring(pt,[pt[0],pt[1]+.94,pt[2]],.11,.075,pal.wood,6,2);}}
      }
      if(plank){
        if(index===0){
          strip(a,b,-w,w,.012,.012,'#977241',2);
          for(let k=-4;k<=4;k++)strip(a,b,k*1.12+.07,k*1.12+.12,.025,.025,'#6c5133',2);
          for(let k=0;k<7;k++){const aa=Math.PI*k/7,bb=Math.PI*(k+1)/7;
            const p1=local(a,Math.cos(aa)*w,-Math.sin(aa)*w*.59),p2=local(b,Math.cos(aa)*w,-Math.sin(aa)*w*.59),p3=local(b,Math.cos(bb)*w,-Math.sin(bb)*w*.59),p4=local(a,Math.cos(bb)*w,-Math.sin(bb)*w*.59);m.quad(p1,p2,p3,p4,tone(pal.wood,1.03+.1*Math.sin(k)),2);}
        }else{
          strip(a,b,-w,w,0,0,tone('#a4815b',.9+r()*.15),2);
          const mid=roadP(s+.08);strip(a,mid,-w,w,.016,.016,pal.wood,2);
          if(j%7===0){for(const sign of [-1,1]){const pt=local(a,sign*(w-.3));m.ring([pt[0],-1.45,pt[2]],pt,.31,.27,pal.wood,7,2);}}
        }
      }else{
        strip(a,b,-w,w,0,0,pal.soil,1);
        for(const sign of [-1,1]){strip(a,b,sign*(w-.53),sign*w,.018,.018,tone(pal.soil,.82),1);
          if([2,3,4,5,7].includes(index)&&Math.abs(a.curve)>.019&&j%4<2)strip(a,b,sign*(w-.47),sign*(w-.07),.035,.035,j%8<4?pal.accent:'#eee7cf',5);}
        if(j%3===0)for(let n=0;n<3;n++){const x=(r()-.5)*2*w,pt=local(a,x,.035,(r()-.5)*1.7),sz=.032+r()*.085;
          m.tri([pt[0]-sz,pt[1],pt[2]],[pt[0]+sz*1.8,pt[1],pt[2]+sz*.7],[pt[0],pt[1],pt[2]-sz],tone(pal.soil,.7+r()*.51),1,[0,1,0]);}
      }
      if(u>=course.branchA-.002&&u<course.branchB){
        const a1=roadP(s,0,true),b1=roadP(s+course.length/count,0,true);
        const col=[0,1,6].includes(index)?'#a58051':[2,4,7].includes(index)?pal.water:tone(pal.soil,1.12);
        strip(a1,b1,-a1.w,a1.w,.037,.037,col,[0,1,6].includes(index)?2:4);
        for(const sign of [-1,1]){strip(a1,b1,sign*(a1.w-.23),sign*a1.w,.055,.055,tone(col,.71),2);
          if(a1.peak>.65&&j%6===0&&[0,1,6].includes(index)){const pt=local(a1,sign*a1.w);m.ring([pt[0],-.9,pt[2]],pt,.26,.23,pal.wood,6,2);}}
      }
    }
    // Grid markings, start arch and striped timber columns.
    const line=roadP(0),yaw=Math.atan2(line.tx,line.tz),gate=roadP(3.3);
    for(let i=0;i<16;i++)for(let k=0;k<2;k++){
      const a=roadP(k*.58),b=roadP((k+1)*.58);strip(a,b,-line.w+line.w*2*i/16,-line.w+line.w*2*(i+1)/16,.05,.05,(i+k)%2?'#393d34':'#e9ddbd',5);}
    for(let j=0;j<4;j++)for(let k=0;k<2;k++){const a=roadP(-3.3-k*3.1),b=roadP(-3.13-k*3.1);strip(a,b,(j-1.5)*2.25-.62,(j-1.5)*2.25+.62,.04,.04,'#c0ae87');}
    for(const sign of [-1,1]){
      const pt=local(gate,sign*(gate.w+.49));m.ring(pt,[pt[0],pt[1]+5.55,pt[2]],.28,.22,pal.wood,8,2);
      for(let j=0;j<3;j++)m.ring([pt[0],pt[1]+1+j*.38,pt[2]],[pt[0],pt[1]+1.15+j*.38,pt[2]],.283,.275,j%2?pal.accent:'#e2d3ad',8,2);
    }
    m.ring(local(gate,-gate.w-.66,5.1),local(gate,gate.w+.66,5.1),.24,.24,pal.wood,8,2);
    for(let k=0;k<14;k++){const x=-gate.w+(k+.5)*gate.w/7,a=local(gate,x-.32,4.8),b=local(gate,x+.32,4.8),d=local(gate,x,4.07);
      m.tri(a,b,d,['#e9b652','#e1d5a7','#cf6b3f','#69816a'][k%4],5);}
    // Turn boards, race poles, rocks and thousands of discrete fronds.
    const clearance=(x,z,minY=-1e3)=>{let best=1e9;for(let j=0;j<count;j+=3){const a=p[j];if(Math.abs(a.y-minY)>6&&minY>-900)continue;const d=(a.x-x)**2+(a.z-z)**2;if(d<best)best=d;}return Math.sqrt(best);};
    for(let j=0;j<count;j+=3){
      const a=p[j],u=j/count,bridge=Math.abs(u-course.bridgeS)<.04,br=u>course.branchA-.008&&u<course.branchB+.008;
      const yaw=Math.atan2(a.tx,a.tz);
      if(j%15===0&&!bridge){for(const sign of [-1,1]){if(br&&sign===1)continue;const pt=local(a,sign*(a.w+.56),-.13);
        m.ring(pt,[pt[0],pt[1]+1.22,pt[2]],.088,.071,pal.wood,6,2);m.ring([pt[0],pt[1]+.86,pt[2]],[pt[0],pt[1]+1.19,pt[2]],.092,.08,pal.accent,6,5);}}
      if(Math.abs(a.curve)>.014&&j%21===0&&!bridge){
        const side=-Math.sign(a.curve),x=side*(a.w+.9),pt=local(a,x,.34);if(!(br&&side>0)){
          m.box(pt[0],pt[1],pt[2],1.38,1.06,.09,yaw,'#34483b');m.box(pt[0],pt[1]+.08,pt[2],1.24,.89,.12,yaw,'#e8b34c');
          const P=(o,h)=>local(a,x+o,h,-.09),d=-side;
          m.quad(P(-d*.28,.56),P(d*.1,.56),P(d*.42,.96),P(d*.08,.96),'#34483b',0);m.quad(P(d*.08,.96),P(d*.42,.96),P(d*.1,1.32),P(-d*.28,1.32),'#34483b',0);
        }}
      if(bridge)continue;
      const sign=r()<.5?-1:1,d=a.w+1.65+r()*2.4,pt=local(a,d*sign,-.12-(d-a.w)*.13,(r()-.5)*2);
      if((!br||sign<0)&&clearance(pt[0],pt[2],a.y)>a.w+.45){
        if([0,1,2,6].includes(index))fern(m,...pt,.7+r()*1.8,pal.leaf,r);
        if(r()<.5)m.blob(pt[0],pt[1],pt[2],.5+r(),.25+r()*.55,.4+r()*.7,tone(index<3?'#7d8466':pal.soil,.72+r()*.34),6,6);
        if(index===0&&r()<.27){for(let h=0;h<3;h++){const px=pt[0]+r()*.72,pz=pt[2]+r()*.72,sz=.22+r()*.15;m.ring([px,pt[1],pz],[px,pt[1]+sz*1.1,pz],sz*.2,sz*.16,'#e7daba',5);m.blob(px,pt[1]+sz*1.15,pz,sz,sz*.48,sz,'#c76037',7);}}
      }
    }
    const amount=[800,670,220,208,100,230,570,245][index];
    for(let j=0;j<amount;j++){
      const u=r(),a=roadP(u*course.length),sg=r()<.5?-1:1,d=a.w+2.8+r()**1.22*49;
      const pt=local(a,d*sg);if(clearance(pt[0],pt[2])<a.w+2.25)continue;
      if(sg===1&&u>course.branchA-.015&&u<course.branchB+.015&&d<20)continue;
      pt[1]=Math.max(-1.3,a.y-.32-(d-a.w)*.43);
      if(Math.abs(u-course.bridgeS)<.05&&d<16)pt[1]=-1.4;
      if(index===7&&sg===1&&u>.25&&u<.6&&r()<.85)continue;
      const size=[13,10,8,11,5,13,13,9][index]*(.38+r()*.81);
      if(clearance(pt[0],pt[2])<a.w+4.4+size*([0,6].includes(index)?.43:.28))continue;
      regionProp(m,...pt,size,index,pal,r);
    }
    if(index===0||index===6){
      const undergrowth=seeded(321778+index);
      for(let j=0;j<375;j++){
        const u=undergrowth(),a=roadP(u*course.length),side=undergrowth()<.5?-1:1,d=a.w+1.1+undergrowth()*9.8;
        if(Math.abs(u-course.bridgeS)<.045||(side===1&&u>course.branchA-.01&&u<course.branchB+.01))continue;
        const pt=local(a,d*side);if(clearance(pt[0],pt[2])<a.w+.65)continue;
        pt[1]=Math.max(-1.2,a.y-.15-(d-a.w)*.39);const size=.65+undergrowth()*1.85;
        if(j%6===0){
          const end=local(a,d*side+undergrowth()-.5,0,2.3+size);end[1]=pt[1]+.08;
          m.ring([pt[0],pt[1]-.03,pt[2]],end,size*.24,size*.18,'#65503a',8,2);
          m.blob((pt[0]+end[0])*.5,pt[1]+size*.16,(pt[2]+end[2])*.5,size*.56,size*.18,size*.46,'#749248',6,3);
        }else if(j%3===0){m.blob(pt[0],pt[1]-.07,pt[2],size*.89,size*.34,size*.70,'#77865e',7,6);m.blob(pt[0]-.09,pt[1]+size*.13,pt[2],size*.74,size*.23,size*.56,'#758c41',6,3);}
        else fern(m,...pt,size,pal.leaf,undergrowth);
      }
    }
    // Silhouettes on the horizon and regional landmarks.
    const outerRadius=Math.max(...p.map(a=>Math.hypot(a.x,a.z)))+139;
    for(let j=0;j<38;j++){const a=j*tau/38,d=outerRadius+r()*65,h=([3,5,7].includes(index)?21:8)*(1+r());m.blob(Math.cos(a)*d,-9+h*.12,Math.sin(a)*d,h*2.35,h,h*1.38,tone(index===4?'#8e9da4':pal.land,1.1),9,6);}
    const landmark=roadP((course.bridgeS+.015)*course.length),lp=local(landmark,-landmark.w-14,-landmark.y);
    if(index===0){tree(m,...lp,25,0,pal,r);for(let j=0;j<8;j++){const a=tau*j/8,x=lp[0]+Math.cos(a)*3.4,z=lp[2]+Math.sin(a)*3.4;m.ring([x,1,z],[lp[0],7,lp[2]],.65,.85,pal.wood,7,2);}}
    if(index===1){for(let j=0;j<2;j++){const a=roadP((course.bridgeS-.05)*course.length+j*15);for(const sign of [-1,1]){const pt=local(a,sign*(a.w+.4));m.ring(pt,[pt[0],pt[1]+4.3,pt[2]],.2,.16,'#8d4333',8,2);}
      m.ring(local(a,-a.w-1,4.3),local(a,a.w+1,4.3),.21,.21,'#944c37',7,2);
      m.ring(local(a,-.65,3.85),local(a,-.65,4.22),.26,.11,'#ae8a4e',8);m.ring(local(a,.65,3.85),local(a,.65,4.22),.26,.11,'#ae8a4e',8);}}
    if(index===2){for(const u of [.19,.57,.72]){const a=roadP(u*course.length),pt=local(a,-a.w-9,-a.y);building(m,...pt,2.25,pal);mov.push({kind:'mill',x:pt[0],y:pt[1]+9.5,z:pt[2]+3.8});}}
    if(index===3||index===7){
      const a=roadP(.7*course.length),rad=index===3?1.8:1.35;
      for(let j=0;j<12;j++){const angle=(j/12)*Math.PI,b=(j+1)/12*Math.PI;
        m.ring(local(a,(a.w+1.9)*Math.cos(angle),Math.sin(angle)*9.3-1.1),local(a,(a.w+1.9)*Math.cos(b),Math.sin(b)*9.3-1.1),rad*(1+Math.abs(Math.cos(angle))*.38),rad*(1+Math.abs(Math.cos(b))*.38),index===3?'#b96742':'#50585a',index===3?8:6,6);}}
    if(index===5){for(let k=0;k<12;k++){const u=course.branchA+.03+k*.007,a=roadP(u*course.length,0,true);
      for(const sign of [-1,1]){const pt=local(a,sign*(a.w+.48));m.ring(pt,[pt[0],pt[1]+3.8,pt[2]],.19,.2,pal.wood,6,2);}
      m.ring(local(a,-a.w-.7,3.8),local(a,a.w+.7,3.8),.31,.28,pal.wood,7,2);
      if(k%3===0)m.blob(...local(a,a.w-.05,2.4),.17,.3,.17,'#ffd080',6,5);}}
    if(index===6){const a=roadP(.46*course.length),pt=local(a,-a.w-11);m.blob(pt[0],8,pt[2],11,12,7,'#637269',8,6);
      for(let k=0;k<12;k++){const x=pt[0]-5+k*.78,top=14.8+.7*Math.sin(k),z=pt[2]+6;m.quad([x,top,z],[x,1,z+1.4],[x+.83,1,z+1.4],[x+.83,top,z],k%3?'#8ed3cf':'#c8e6dc',4);}}
    for(const ramp of root.AcornRamps.list(course)){
      const deck=root.AcornRampArt.rampMesh(Mesh,course,ramp);
      for(const value of deck.data)m.data.push(value);
    }
    return {mesh:m,mov};
  }
  function kartMesh(i,lod=false){
    const m=new Mesh(),asset=root.AcornKartModels?.[i];
    if(asset){const groups=lod&&asset.lod?.length?asset.lod:asset.groups;m.uvs=[];m.skin=[];for(const g of groups){const pp=g.positions,nn=g.normals;for(const idx of g.indices){const j=idx*3;m.data.push(pp[j],pp[j+1],pp[j+2],nn[j],nn[j+1],nn[j+2],g.color[0],g.color[1],g.color[2],0);if(g.uvs)m.uvs.push(g.uvs[idx*2],g.uvs[idx*2+1]);if(g.rig)m.skin.push(g.rig[idx],Math.round((g.flex?.[idx]??1)*255));}}}
    if(!m.data.length){
      m.box(0,.36,0,1.19,.35,1.56,0,['#d17f42','#817b77','#a1a86b','#b88651','#b6994a','#cf6944','#73916a','#7194a0'][i],2);
      for(const x of [-.66,.66])for(const z of [-.57,.55])m.ring([x-.12,.32,z],[x+.12,.32,z],.31,.31,'#373b35',12);
      m.blob(0,.99,-.1,.4,.48,.33,'#628873');m.blob(0,1.53,-.06,.42,.39,.38,['#ab9479','#9c8b84','#e8e0c8','#c88346','#997e57','#d07b48','#797c71','#77716b'][i]);for(const s of [-1,1])m.blob(s*.28,1.82,-.09,.18,i===2?.39:.17,.085,'#b88f75');
    }return m;
  }
  function extras(){
    const meshes={};
    const nut=new Mesh();nut.blob(0,0,0,.36,.43,.36,'#d89b42',9,0);nut.blob(0,.18,0,.4,.19,.4,'#775332',9,2);nut.ring([0,.28,0],[.08,.49,0],.074,.048,'#745232',7,2);
    for(let j=0;j<9;j++){const a=tau*j/9;nut.blob(Math.cos(a)*.35,.2,Math.sin(a)*.35,.056,.048,.056,'#a77e44',5,2);}
    meshes.nut=nut;const shadow=new Mesh();for(let i=0;i<18;i++){const a=i*tau/18,b=(i+1)*tau/18;shadow.tri([0,0,0],[Math.cos(a)*.91,0,Math.sin(a)*1.26],[Math.cos(b)*.91,0,Math.sin(b)*1.26],'#33392c',0,[0,1,0]);}meshes.shadow=shadow;
    const spark=new Mesh();spark.blob(0,0,0,.084,.12,.084,'#ffd988',5,5);meshes.spark=spark;
    const sail=new Mesh();for(let j=0;j<4;j++){const a=j*tau/4,c=Math.cos(a),s=Math.sin(a),p=(h,w)=>[c*h-s*w,s*h+c*w,.02];sail.ring([0,0,0],p(7,0),.18,.12,'#704a34',7,2);sail.quad(p(2,0),p(6.9,0),p(6.9,1.16),p(2,.8),'#e0ca9b',2);for(let k=2.6;k<7;k+=.8)sail.ring(p(k,-.1),p(k,1.15),.06,.06,'#8a7352',4,2);}meshes.sail=sail;
    return Object.assign(meshes,root.AcornItemArt.meshes(Mesh),root.AcornDriftArt.meshes(Mesh));
  }
  function bakeRegions(geometry,bake){
    const triangles=geometry.data,regions=new Map();
    for(let i=0;i<triangles.length;i+=30){
      const xs=[triangles[i],triangles[i+10],triangles[i+20]],zs=[triangles[i+2],triangles[i+12],triangles[i+22]];
      const gx=Math.floor((xs[0]+xs[1]+xs[2])/144),gz=Math.floor((zs[0]+zs[1]+zs[2])/144);
      const key=(Math.max(...xs)-Math.min(...xs)>90||Math.max(...zs)-Math.min(...zs)>90)?'ground':gx+','+gz;
      if(!regions.has(key))regions.set(key,{data:[],x:gx*48+24,z:gz*48+24,r:0,ground:key==='ground'});
      const region=regions.get(key);
      for(let k=0;k<3;k++)region.r=Math.max(region.r,Math.hypot(xs[k]-region.x,zs[k]-region.z));
      for(let j=0;j<30;j++)region.data.push(triangles[i+j]);
    }
    const packed=new Float32Array(triangles.length),draws=[];let offset=0;
    for(const reg of regions.values()){
      packed.set(reg.data,offset);draws.push({first:offset/10,count:reg.data.length/10,x:reg.x,z:reg.z,r:reg.r,ground:reg.ground});offset+=reg.data.length;
    }
    return {mesh:bake({data:packed}),draws};
  }
  function bakeDriver(gl,groups,buffers){
    const nv=groups.reduce((s,g)=>s+g.positions.length/3,0),ni=groups.reduce((s,g)=>s+g.indices.length,0),wide=nv>65535;
    if(wide&&!gl.getExtension('OES_element_index_uint'))return null;
    const data=new Float32Array(nv*10),uvs=new Float32Array(nv*2),skin=new Uint8Array(nv*2),indices=wide?new Uint32Array(ni):new Uint16Array(ni);
    let offset=0,ii=0,hasUV=true,hasRig=false;
    for(const g of groups){const count=g.positions.length/3;
      for(let i=0;i<count;i++){const a=i*3,b=(i+offset)*10;data[b]=g.positions[a];data[b+1]=g.positions[a+1];data[b+2]=g.positions[a+2];data[b+3]=g.normals[a];data[b+4]=g.normals[a+1];data[b+5]=g.normals[a+2];data[b+6]=g.color[0];data[b+7]=g.color[1];data[b+8]=g.color[2];}
      if(g.uvs)uvs.set(g.uvs,offset*2);else hasUV=false;
      if(g.rig){hasRig=true;for(let i=0;i<count;i++){skin[(i+offset)*2]=g.rig[i];skin[(i+offset)*2+1]=Math.round((g.flex?.[i]??1)*255);}}
      for(const idx of g.indices)indices[ii++]=offset+idx;offset+=count;
    }
    function upload(target,array){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);return b;}
    return {b:upload(gl.ARRAY_BUFFER,data),uv:hasUV?upload(gl.ARRAY_BUFFER,uvs):null,skin:hasRig?upload(gl.ARRAY_BUFFER,skin):null,ix:upload(gl.ELEMENT_ARRAY_BUFFER,indices),indexType:wide?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,n:ni};
  }
  function camera(course,r,back,st={trackIndex:course.index,time:0}){
    const road=sim.sample(course,r.s,r.x,r.branch),future=sim.sample(course,r.s+1.8,r.x,r.branch),past=sim.sample(course,r.s-1.8,r.x,r.branch);
    const v=dir([past.x,0,past.z],[future.x,0,future.z]),sign=back?-1:1;
    const distance=6.0+Math.min(1,Math.abs(r.v)/20)*.35,forward=sim.sample(course,r.s+7.5*sign,r.x,r.branch);
    const slope=clampValue((future.y-past.y)/3.6,-.30,.30);
    const floor=sim.groundLift(st,r),follow=capAir(sim.lift(st,r)-floor);
    const ahead=root.AcornRamps.surface(course,r.s+7.5*sign,r.x,r.branch);
    return {eye:[road.x-v[0]*distance*sign,road.y+floor+follow*.72+2.63-slope*distance*sign,road.z-v[2]*distance*sign],target:[road.x+v[0]*7.5*sign,forward.y+.75+floor*.54+ahead*.46+follow*.55,road.z+v[2]*7.5*sign],angle:Math.atan2(v[0],v[2])+(back?Math.PI:0)};
  }
  const capAir=n=>Math.max(0,Math.min(6,n));
  function clampValue(v,a,b){return Math.max(a,Math.min(b,v));}
  class World {
    constructor(canvas,course){
      const gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');
      if(!gl)throw Error('WebGL unavailable');
      this.gl=gl;this.course=course;this.pal=palettes[course.index];this.buffers=[];
      this.pr=shader(gl,vp,fp);this.sk=shader(gl,sv,sf);
      const attrs=(p,ns)=>Object.fromEntries(ns.map(n=>[n,gl.getAttribLocation(p,n)]));
      const uniforms=(p,ns)=>Object.fromEntries(ns.map(n=>[n,gl.getUniformLocation(p,n)]));
      this.at=attrs(this.pr,['p','n','c','m','texCoord','skin']);this.un=uniforms(this.pr,['proj','view','model','fog','clock','alpha','eye','driverPoint','trackId','groundAtlas','kartAtlas','kartSurface','usingAtlas','articulated','bones[0]','wheelExposure','skidPass']);
      this.sa=attrs(this.sk,['p']);this.su=uniforms(this.sk,['sky','fog','dir','aspect','viewHorizon']);
      this.screen=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const bake=m=>{const b=gl.createBuffer();this.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,m.data instanceof Float32Array?m.data:new Float32Array(m.data),gl.STATIC_DRAW);let uv=null;
        if(m.uvs?.length===m.data.length/5){uv=gl.createBuffer();this.buffers.push(uv);gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.uvs),gl.STATIC_DRAW);}
        let skin=null;if(m.skin?.length===m.data.length/5){skin=gl.createBuffer();this.buffers.push(skin);gl.bindBuffer(gl.ARRAY_BUFFER,skin);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(m.skin),gl.STATIC_DRAW);}
        return {b,n:m.data.length/10,uv,skin};};
      const scene=worldMeshes(course);this.regions=bakeRegions(scene.mesh,bake);this.moving=scene.mov;
      const model=(i,lod=false)=>{const a=root.AcornKartModels?.[i],groups=lod&&a?.lod?.length?a.lod:a?.groups;return (groups&&bakeDriver(gl,groups,this.buffers))||bake(kartMesh(i,lod));};
      const courseParts=root.AcornCourseArt.meshes(Mesh);
      if(course.index>=8)root.AcornExpansionWorld.themeHazards(courseParts,course.index);
      this.karts=sim.drivers.map((_,i)=>model(i));this.kartLOD=sim.drivers.map((_,i)=>root.AcornKartModels?.[i]?.lod?.length?model(i,true):this.karts[i]);this.parts=Object.fromEntries(Object.entries({...extras(),...root.AcornSignatureArt.meshes(Mesh),...courseParts}).map(([key,m])=>[key,bake(m)]));
      this.textures=[];this.atlasReady=false;
      const load=(url,unit,pixel,onload)=>{const tex=gl.createTexture();this.textures.push(tex);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixel));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        if(!url)return;const im=new Image();im.onload=()=>{if(gl.isContextLost()||!gl.isTexture(tex))return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
          if((im.width&(im.width-1))===0&&(im.height&(im.height-1))===0){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}else{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
          gl.activeTexture(gl.TEXTURE0);if(onload)onload();};im.src=url;};
      load(root.AcornKartTexture,0,[255,255,255,255],()=>{this.atlasReady=true;});load(root.AcornKartSurface,1,[128,128,200,255]);
      if(root.AcornSurfaces)this.textures.push(root.AcornSurfaces.load(gl));if(root.AcornHorizon)this.textures.push(root.AcornHorizon.load(gl,course.index));gl.activeTexture(gl.TEXTURE0);
      this.id=matrix();this.cameras={};this.canvas=canvas;this.poseFrame=0;this.poseCache=new Map();
      this.skids=new root.AcornDriftArt.SkidMarks(course);
      this.skidMesh={b:gl.createBuffer(),n:0};this.buffers.push(this.skidMesh.b);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.skidMesh.b);gl.bufferData(gl.ARRAY_BUFFER,this.skids.vertices.byteLength,gl.DYNAMIC_DRAW);
    }
    beginFrame(){this.poseFrame++;}
    render(st,seat,rect,scale,back,ghost,dt,postFinishTime=0){
      const gl=this.gl, c=this.course,p=this.pal,r=st.racers[seat]||st.racers[0];
      gl.enable(gl.SCISSOR_TEST);const v=[Math.round(rect.x*scale),Math.round((this.canvas.height/scale-rect.y-rect.h)*scale),Math.round(rect.w*scale),Math.round(rect.h*scale)];
      gl.viewport(...v);gl.scissor(...v);gl.clearColor(...rgb(p.mist),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const cam=camera(c,r,back,st);
      let smooth=this.cameras[seat];if(!smooth||smooth.back!==back||Math.abs(smooth.s-r.s)>9){smooth={eye:cam.eye.slice(),target:cam.target.slice(),back,s:r.s};this.cameras[seat]=smooth;}
      const follow=Math.min(1,1-Math.exp(-dt*27));for(let i=0;i<3;i++){smooth.eye[i]+=(cam.eye[i]-smooth.eye[i])*follow;smooth.target[i]+=(cam.target[i]-smooth.target[i])*follow;}smooth.s=r.s;
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(this.sk);gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);
      Object.values(this.at).forEach(i=>gl.disableVertexAttribArray(i));gl.enableVertexAttribArray(this.sa.p);gl.vertexAttribPointer(this.sa.p,2,gl.FLOAT,false,0,0);
      gl.uniform3fv(this.su.sky,rgb(p.sky));gl.uniform3fv(this.su.fog,rgb(p.mist));gl.uniform1f(this.su.dir,cam.angle);gl.uniform1f(this.su.aspect,rect.w/rect.h);gl.uniform1i(this.su.viewHorizon,4);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(this.pr);gl.uniformMatrix4fv(this.un.proj,false,project(rect.w/rect.h,Math.max(.88,Math.min(1.2,.95+(.12*(r.boost>0?1:0))+(rect.w/rect.h<1?.22:0)))));gl.uniformMatrix4fv(this.un.view,false,view(smooth.eye,smooth.target));gl.uniform3fv(this.un.fog,rgb(p.mist));gl.uniform1f(this.un.clock,st.time);gl.uniform1f(this.un.alpha,1);
      gl.uniform1i(this.un.kartAtlas,0);gl.uniform1i(this.un.kartSurface,1);gl.uniform1i(this.un.groundAtlas,3);gl.uniform1f(this.un.trackId,c.index);gl.uniform3fv(this.un.eye,smooth.eye);
      const focus=sim.sample(c,r.s,r.x,r.branch);gl.uniform3f(this.un.driverPoint,focus.x,focus.y+sim.lift(st,r)+.86,focus.z);
      let bound=null,previousModel=null;const draw=(mesh,model,first=0,count=mesh.n)=>{if(mesh!==bound){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);
        for(const [key,size,offset] of [['p',3,0],['n',3,12],['c',3,24],['m',1,36]]){const a=this.at[key];gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,40,offset);}
        gl.uniform1f(this.un.usingAtlas,mesh.uv&&this.atlasReady?1:0);if(mesh.uv){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv);gl.enableVertexAttribArray(this.at.texCoord);gl.vertexAttribPointer(this.at.texCoord,2,gl.FLOAT,false,0,0);}
        else{gl.disableVertexAttribArray(this.at.texCoord);gl.vertexAttrib2f(this.at.texCoord,0,0);}
        gl.uniform1f(this.un.articulated,mesh.skin?1:0);if(mesh.skin){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.skin);gl.enableVertexAttribArray(this.at.skin);gl.vertexAttribPointer(this.at.skin,2,gl.UNSIGNED_BYTE,false,2,0);}
        else{gl.disableVertexAttribArray(this.at.skin);gl.vertexAttrib2f(this.at.skin,0,255);}bound=mesh;}
        if(previousModel!==model){gl.uniformMatrix4fv(this.un.model,false,model);previousModel=model;}if(mesh.ix){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ix);gl.drawElements(gl.TRIANGLES,count,mesh.indexType,0);}else gl.drawArrays(gl.TRIANGLES,first,count);};
      const facing=dir(smooth.eye,smooth.target),horizontal=Math.hypot(facing[0],facing[2])||1,fx=facing[0]/horizontal,fz=facing[2]/horizontal;
      const split=rect.w*rect.h*scale*scale<this.canvas.width*this.canvas.height*.74;
      for(const reg of this.regions.draws){const dx=reg.x-smooth.eye[0],dz=reg.z-smooth.eye[2],d=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
        if(reg.ground||(d+reg.r>-.4&&d-reg.r<(split?135:215)&&side<Math.max(0,d)*.65*rect.w/rect.h+reg.r*1.6))draw(this.regions.mesh,this.id,reg.first,reg.count);}
      this.skids.update(st);this.skids.upload(gl,this.skidMesh);
      if(this.skidMesh.n){
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
        gl.uniform1i(this.un.skidPass,1);
        draw(this.skidMesh,this.id);
        gl.uniform1i(this.un.skidPass,0);
        gl.depthMask(true);gl.disable(gl.BLEND);
      }
      for(const a of this.moving)draw(this.parts.sail,matrix(a.x,a.y,a.z,0,1,st.time*.46));
      for(const a of st.pickups){if(a.cooldown>0)continue;const t=sim.sample(c,a.s,a.x);if(Math.hypot(t.x-cam.eye[0],t.z-cam.eye[2])>110)continue;
        draw(this.parts.nut,matrix(t.x,t.y+1.1+.12*Math.sin(st.time*3+a.x),t.z,st.time*2+a.x,1.12,.17));}
      // Opaque item geometry writes depth normally. Reusable translucent ribbons,
      // telegraphs and fragments draw back-to-front after all physical karts.
      const translucent=[];
      const itemEffects={time:st.time,index:c.index,split,
        sample:(s,x,branch)=>sim.sample(c,s,x,branch),
        distance:pos=>Math.hypot(pos.x-smooth.eye[0],pos.z-smooth.eye[2]),
        stamp:(name,at,yaw=0,size=1,opacity=1,roll=0,pitch=0,stretch=null)=>{
          if(opacity<.035||size<=0)return;
          const pose=matrix(at[0],at[1],at[2],yaw,size,roll,pitch);
          if(stretch)for(let axis=0;axis<3;axis++)for(let n=0;n<3;n++)pose[axis*4+n]*=stretch[axis];
          const mesh=this.parts[name];
          if(opacity>=.995){draw(mesh,pose);return;}
          const depth=(at[0]-smooth.eye[0])*facing[0]+(at[1]-smooth.eye[1])*facing[1]+(at[2]-smooth.eye[2])*facing[2];
          if(depth>-.5)translucent.push({mesh,pose,depth,opacity});
        }};
      for(const a of st.objects)root.AcornItemArt.drawObject(itemEffects,a);
      const roadStamp=(name,s,x,height,angle,size,alpha,roll,pitch,stretch,branch)=>{
        const q=sim.sample(c,s,x,branch);
        itemEffects.stamp(name,[q.x,q.y+height,q.z],Math.atan2(q.tx,q.tz)+angle,size,alpha,roll,pitch,stretch);
      };
      const hazard=root.AcornHazards.sample(c,st.time);
      if(itemEffects.distance(sim.sample(c,hazard.s,hazard.x,hazard.branch))<133)
        root.AcornCourseArt.scene(hazard,st.time,roadStamp);
      const drawKart=(k,g=false)=>{
        const pos=sim.sample(c,k.s,k.x,k.branch),yaw=Math.atan2(pos.tx,pos.tz),next=sim.sample(c,k.s+1.05,k.x,k.branch);
        const cameraDist=Math.hypot(pos.x-cam.eye[0],pos.z-cam.eye[2]);if(cameraDist>145)return;
        if(k.seat!==seat&&cameraDist<6.05){
          const viewDir=dir(smooth.eye,smooth.target),dx=pos.x-smooth.eye[0],dz=pos.z-smooth.eye[2],forward=dx*viewDir[0]+dz*viewDir[2],side=Math.abs(dx*viewDir[2]-dz*viewDir[0]);
          if(forward<5.85&&side<1.5)return;
        }
        const burrow=k.driverIndex===7&&k.active>0?Math.min(1,(1.12-k.active)*5,k.active*5):0;
        const floor=sim.groundLift(st,k),jump=sim.lift(st,k)-burrow*.89;
        const height=capAir(jump-floor),groundGrade=root.AcornRamps.surface(c,k.s+.12,k.x,k.branch)-floor;
        const basePitch=-Math.atan2(next.y-pos.y,1.05),rampPitch=sim.rampPitch(st,k);
        const pitch=basePitch+rampPitch+(k.air>0&&k.flight?.kind!=='ramp'?.08*Math.cos(k.air*4):0);
        const shadowPitch=basePitch-(floor>.01&&Math.abs(groundGrade)<.09?Math.atan(groundGrade/.12):0);
        const shadow=sim.sample(c,k.s-height*.095,k.x+height*.08,k.branch);
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
        gl.uniform1f(this.un.alpha,(g?.13:.43)/(1+height*.53));
        if(!k.fall)draw(this.parts.shadow,matrix(shadow.x,shadow.y+floor+.056,shadow.z,yaw,1-height*.025,0,shadowPitch));
        gl.depthMask(true);
        gl.uniform1f(this.un.alpha,g?.36:1);if(!g)gl.disable(gl.BLEND);
        const mesh=((split&&rect.h<480)||k.seat!==seat&&(split||cameraDist>8.0)?this.kartLOD:this.karts)[k.driverIndex];
        if(mesh.skin){
          const source=root.AcornKartModels[k.driverIndex],motion=root.AcornRig.motion(k,postFinishTime);
          gl.uniform1f(this.un.wheelExposure,root.AcornRig.exposure(source,motion.wheelV??k.v,dt));
          let cached=this.poseCache.get(k.seat);if(!cached){cached={frame:-1,bones:new Float32Array(root.AcornRig.count*16)};this.poseCache.set(k.seat,cached);}
          if(cached.frame!==this.poseFrame||!this.poseFrame){root.AcornRig.pose(source,motion,cached.bones);cached.frame=this.poseFrame;}
          gl.uniformMatrix4fv(this.un['bones[0]'],false,cached.bones);
        }
        draw(mesh,matrix(pos.x,pos.y+.037+jump,pos.z,yaw+(k.yaw||0),1,0,pitch));
        if(!g&&(k.signature||k.signatureHit))root.AcornSignatureArt.render(st,k,(name,s,l,height,angle,size,alpha,stretch,branch=k.branch)=>{
          const q=sim.sample(c,s,l,branch);
          itemEffects.stamp(name,[q.x,q.y+height+.03,q.z],Math.atan2(q.tx,q.tz)+angle,size,alpha,0,0,stretch);
        },c.length);
        const itemBoost=k.boost>0&&(k.boostStyle==='seed'||k.boostStyle==='tailwind');
        if(!g)root.AcornDriftArt.sparks(k,pos,floor,st.time,itemEffects.stamp);
        if(!g&&!itemBoost&&k.boost>0&&k.boostStyle!=='drift')for(let h=0;h<5;h++){
          const direction=h%2?1:-1,phase=(st.time*(k.boost>0?3.8:2.5)+h*.193)%1,px=k.x+direction*(.56+phase*.38),q=sim.sample(c,k.s-.75-phase*(k.boost>0?2.5:1.05),px,k.branch);
          draw(this.parts.spark,matrix(q.x,q.y+.17+Math.sin(phase*Math.PI)*.25,q.z,yaw+phase*1.7,1.2-phase));}
        if(!g){root.AcornItemArt.drawRacer(itemEffects,k,pos,yaw,jump,pitch);root.AcornCourseArt.reaction(st,k,roadStamp);}
        gl.uniform1f(this.un.alpha,1);gl.disable(gl.BLEND);
      };
      for(const k of st.racers)drawKart(k);if(ghost)drawKart(ghost,true);
      if(translucent.length){
        translucent.sort((a,b)=>b.depth-a.depth);
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
        for(const effect of translucent){gl.uniform1f(this.un.alpha,effect.opacity);draw(effect.mesh,effect.pose);}
        gl.depthMask(true);gl.uniform1f(this.un.alpha,1);gl.disable(gl.BLEND);
      }
      gl.disable(gl.SCISSOR_TEST);
    }
    dispose(){for(const b of this.buffers)this.gl.deleteBuffer(b);for(const tex of this.textures)this.gl.deleteTexture(tex);this.gl.deleteBuffer(this.screen);this.gl.deleteProgram(this.pr);this.gl.deleteProgram(this.sk);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
  }
  root.AcornWorld={World,palettes,camera,worldMeshes,Mesh,matrix};
})(window);
