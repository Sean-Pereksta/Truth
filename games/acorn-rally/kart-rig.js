(function(root,make){
  const rig=make();
  if(typeof module==='object'&&module.exports)module.exports=rig;
  else root.AcornRig=rig;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const BONE_COUNT=16,TAU=Math.PI*2;
  const parents=[0,0,0,0,0,0,5,6,6,5,0,5,5,5,9,14];
  const names=['Nib','Bristle','Clover','Tumble','Hazel','Ember','Flint','Mica','Solstice'];
  const tailWeight=[.82,.89,.46,1.24,.46,1.10,.66,.54,.48];
  const earWeight=[.72,.59,1.95,.77,.39,1.08,.46,.57,.35];
  const durations=[1.1,3,.86,2.7,1.05,1.25,1.15,1.12,1.5];
  const cap=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const finite=(n,f=0)=>Number.isFinite(n)?n:f;
  const defaults=[[0,.29,0],[-.526,.29,-.61],[.526,.29,-.61],[-.526,.29,.55],[.526,.29,.55],
    [0,.64,-.12],[0,1.15,-.14],[-.2,1.43,-.12],[.2,1.43,-.12],[0,.77,-.34],
    [0,.902,.2],[-.21,.86,.23],[.21,.86,.23],[0,1.00,-.21],[.06,.76,-.41],[.10,.79,-.48]];
  const zero=()=>new Float32Array(BONE_COUNT*16);
  function fresh(r={}){
    return {travel:0,wheelV:finite(r.v),offset:0,steer:0,lean:0,leanV:0,nod:0,nodV:0,head:0,headV:0,headRoll:0,headRollV:0,
      ears:0,earsV:0,tail:0,tailV:0,tailMid:0,tailMidV:0,tailTip:0,tailTipV:0,tailPitch:0,tailPitchV:0,
      compression:0,compressionV:0,heave:0,impact:0,drift:0,gesture:0,gesturePhase:0,victory:0,
      previousV:finite(r.v),previousX:finite(r.vx),previousAir:finite(r.air),previousHit:0,previousItemHit:0};
  }
  function spring(a,key,velocity,target,omega,damping,dt){
    const dx=target-a[key],dv=omega*omega*dx-2*omega*damping*a[velocity];
    a[velocity]+=dv*dt;a[key]+=a[velocity]*dt;
    if(Math.abs(dx)<.00004&&Math.abs(a[velocity])<.0003){a[key]=target;a[velocity]=0;}
  }
  // Advances once per authoritative physics tick. Local and remote seats share the
  // same independent springs. The renderer never integrates them per camera.
  function advance(r,dt,curve=0,groundTravel,turnOffset){
    if(!(dt>0))return;
    if(dt>.025){const n=Math.ceil(dt/.022);for(let i=0;i<n;i++)advance(r,dt/n,curve,groundTravel/n,turnOffset/n);return;}
    const a=r.motion||(r.motion=fresh(r)),v=finite(r.v),side=finite(r.vx),air=finite(r.air);
    const steering=cap(finite(r.steer),-1,1),speed=cap(Math.abs(v)/16,0,1.3);
    const longitudinal=cap((v-a.previousV)/(dt*21),-1.3,1.05),lateral=cap((side-a.previousX)/(dt*26),-1.25,1.25);
    const bend=cap(curve*v*v*.044,-1,1),load=cap(steering*.74+bend*.26,-1.12,1.12),landing=a.previousAir>0&&air<=0;
    const hit=(r.hit||0)>a.previousHit+.06||(r.itemHitFx||0)>a.previousItemHit+.10;
    const kick=finite(r.itemHitSide,Math.sign(side)||1);
    if(hit){
      const dir=r.itemHitFx>0?kick:(Math.sign(side-a.previousX)||((r.seat||0)%2?1:-1));
      a.impact=dir*(r.itemBlocked?.62:1);
      a.leanV+=dir*2.9;a.headV-=dir*3.2;a.headRollV+=dir*2.8;a.nodV+=1.95;
      a.earsV-=2.8;a.tailV-=dir*3.25;a.tailPitchV+=2.4;a.compressionV+=.48;
    }
    if(landing){a.compressionV+=1.34;a.nodV+=2.35;a.earsV-=3.7;a.tailPitchV+=3.15;}
    const distance=finite(groundTravel,r.finish?0:v*dt);
    // Ground contact constrains angular displacement this tick. Airborne
    // wheels freewheel from their speed at takeoff until contact resumes.
    if(air<=0)a.wheelV=distance/dt;
    const rolled=air>0?a.wheelV*dt:distance;
    a.travel+=rolled;
    a.offset+=air>0?0:finite(turnOffset,rolled*cap(curve*.526,-.22,.22));
    a.steer+=(steering-a.steer)*(1-Math.exp(-dt*19));
    a.drift+=((r.prevDrift?1:0)-a.drift)*(1-Math.exp(-dt*9));
    a.impact*=Math.exp(-dt*6.5);
    const duration=durations[r.driverIndex]||1,remaining=finite(r.fx);
    if(remaining>0){a.gesturePhase=cap(1-remaining/duration,0,1);}
    const actionWeight=remaining>0?Math.min(1,remaining/.16):0;
    a.gesture=finite(a.gesture)+(actionWeight-finite(a.gesture))*(1-Math.exp(-dt*24));
    if(r.finish&&r.rank===1)a.victory=finite(a.victory)+dt;else a.victory=0;
    const muscle=cap(speed,0,1),driftLoad=a.drift*.14;
    spring(a,'lean','leanV',cap(load*(.24+driftLoad)*muscle+lateral*.17,-.49,.49),10.3,.72,dt);
    spring(a,'nod','nodV',cap(-longitudinal*.205+(air>0?-.083:0),-.31,.36),9.8,.65,dt);
    spring(a,'head','headV',cap(a.steer*(.095+.38*muscle)+bend*.105-a.leanV*.022,-.60,.60),9.1,.66,dt);
    spring(a,'headRoll','headRollV',cap(-a.lean*.43+a.leanV*.052,-.27,.27),8.1,.59,dt);
    spring(a,'ears','earsV',cap(-a.nod*.72-a.nodV*.118+a.headV*.045,-.37,.37),7.35,.49,dt);
    spring(a,'tail','tailV',cap(-load*muscle*.43-a.leanV*.083-lateral*.16,-.72,.72),7.7,.58,dt);
    spring(a,'tailMid','tailMidV',cap(a.tail*1.08-a.tailV*.058,-.81,.81),7.0,.64,dt);
    spring(a,'tailTip','tailTipV',cap(a.tailMid*1.02-a.tailMidV*.058,-.85,.85),6.5,.65,dt);
    spring(a,'tailPitch','tailPitchV',cap(longitudinal*.29+a.nodV*.11+(air>0?.17:0),-.52,.52),6.65,.56,dt);
    spring(a,'compression','compressionV',cap((air>0?-.055:0)+Math.abs(a.lean)*.09-longitudinal*.028,-.075,.09),14,.60,dt);
    a.heave=(air<=0?(.0065*Math.sin(a.travel*3.4)+.004*Math.sin(a.travel*5.15))*Math.min(1,speed):0);
    a.previousV=v;a.previousX=side;a.previousAir=air;a.previousHit=r.hit||0;a.previousItemHit=r.itemHitFx||0;
  }
  function motion(r,postFinishTime=0){
    if(r?.motion){if(postFinishTime>0&&r.finish&&r.rank===1)return {...r.motion,victory:finite(r.motion.victory)+postFinishTime};return r.motion;}
    return {travel:finite(r?.s),wheelV:finite(r?.v),steer:cap(finite(r?.yaw)/.24,-1,1),lean:finite(r?.yaw)*.63,head:finite(r?.yaw)*1.15,
      tail:-finite(r?.yaw)*1.2,nod:0,ears:0,compression:0,heave:0,impact:0,drift:+!!r?.prevDrift};
  }
  // Local rigid transform T(pivot+translation) R Y-X-Z T(-pivot).
  function pivotTransform(out,index,p,rx,ry,rz,dx=0,dy=0,dz=0){
    const x=Math.cos(rx),X=Math.sin(rx),y=Math.cos(ry),Y=Math.sin(ry),z=Math.cos(rz),Z=Math.sin(rz),k=index*16;
    out[k]=y*z+Y*X*Z;out[k+1]=x*Z;out[k+2]=-Y*z+y*X*Z;out[k+3]=0;
    out[k+4]=-y*Z+Y*X*z;out[k+5]=x*z;out[k+6]=Y*Z+y*X*z;out[k+7]=0;
    out[k+8]=Y*x;out[k+9]=-X;out[k+10]=y*x;out[k+11]=0;
    out[k+12]=p[0]+dx-out[k]*p[0]-out[k+4]*p[1]-out[k+8]*p[2];
    out[k+13]=p[1]+dy-out[k+1]*p[0]-out[k+5]*p[1]-out[k+9]*p[2];
    out[k+14]=p[2]+dz-out[k+2]*p[0]-out[k+6]*p[1]-out[k+10]*p[2];out[k+15]=1;
  }
  function inherit(out,id,parent){
    const k=id*16,b=parent*16;
    for(let j=0;j<4;j++){
      const c=k+j*4,x=out[c],y=out[c+1],z=out[c+2],w=out[c+3];
      out[c]=out[b]*x+out[b+4]*y+out[b+8]*z+out[b+12]*w;
      out[c+1]=out[b+1]*x+out[b+5]*y+out[b+9]*z+out[b+13]*w;
      out[c+2]=out[b+2]*x+out[b+6]*y+out[b+10]*z+out[b+14]*w;
    }
  }
  function transform(palette,id,p){
    const k=id*16,x=p[0],y=p[1],z=p[2];return [0,1,2].map(j=>palette[k+j]*x+palette[k+j+4]*y+palette[k+j+8]*z+palette[k+j+12]);
  }
  function pose(model,a={},out=zero()){
    const id=Math.max(0,names.indexOf(model?.name)),p=model?.pivots||model?.rig?.pivots||defaults,tw=tailWeight[id],ew=earWeight[id];
    const steer=cap(finite(a.steer),-1,1);
    let lean=cap(finite(a.lean),-.63,.63),nod=cap(finite(a.nod),-.45,.45);
    let head=cap(finite(a.head),-.74,.74),headRoll=cap(finite(a.headRoll,-lean*.27),-.37,.37),ears=cap(finite(a.ears),-.56,.56);
    let tail=cap(finite(a.tail),-.96,.96),mid=cap(finite(a.tailMid,tail*.85),-.97,.97),tip=cap(finite(a.tailTip,mid*.79),-1,1),tailPitch=cap(finite(a.tailPitch,-nod*.9),-.68,.68);
    let lift=0,twist=0,armBrace=0;
    const action=cap(finite(a.gesture),0,1),phase=cap(finite(a.gesturePhase),0,1),direction=Math.sign(steer||head||1),wave=Math.sin(phase*Math.PI);
    if(action>.001){
      if(id===0){nod+=.27*action;head+=direction*.28*action;lean+=direction*.16*action;ears-=.24*action;}
      if(id===1){nod+=.38*action;lift-=.041*action;armBrace=.18*action;headRoll-=.15*action;ears-=.34*action;}
      if(id===2){lift+=(wave*.135-.043)*action;nod+=(.28-.61*wave)*action;ears+=(.36-.72*wave)*action;tailPitch+=wave*.32*action;}
      if(id===3){lean+=direction*.24*action;twist=direction*.19*action;tail+=direction*.40*action;mid+=direction*.42*action;tip+=direction*.44*action;tailPitch-=.35*action;}
      if(id===4){twist=Math.sin(phase*Math.PI*2.6)*.42*action;head-=twist*.78;lift+=wave*.055*action;armBrace=.25*action;}
      if(id===5){nod+=.43*action;lift-=.050*action;ears-=.50*action;tailPitch-=.52*action;headRoll+=.13*action;}
      if(id===6){nod+=(phase<.25?-.26:.39)*action;lift+=(phase<.25?.085:-.062)*action;armBrace=.24*action;ears+=Math.sin(phase*TAU)*.29*action;}
      if(id===7){nod+=.49*action;lift-=.095*action;ears-=.31*action;tailPitch-=.47*action;twist=Math.sin(phase*TAU)*.17*action;}
      if(id===8){lift+=.048*wave*action;head*=1-.55*action;headRoll-=lean*.24*action;armBrace=.11*wave*action;}
    }
    const vt=finite(a.victory),envelope=vt>0?Math.min(1,vt/.25,Math.max(0,(2.1-vt)/.36)):0,pump=(.83+.17*Math.sin(vt*TAU*1.6))*envelope;
    if(envelope>0){lift+=.064*envelope;nod-=.225*pump;lean-=.20*envelope;head+=.32*Math.sin(vt*4.1)*envelope;
      headRoll+=.19*pump;ears+=.23*Math.sin(vt*8.4)*envelope;tail+=.30*Math.sin(vt*6)*envelope;mid+=.35*Math.sin(vt*6-.3)*envelope;tip+=.39*Math.sin(vt*6-.6)*envelope;tailPitch+=.24*pump;}
    const comp=cap(finite(a.compression),-.10,.135),heave=cap(finite(a.heave),-.035,.035),hit=cap(finite(a.impact),-1,1);
    const wheelR=model?.rig?.wheelRadius||.29,travel=finite(a.travel),offset=finite(a.offset);
    const make=(bone,rx=0,ry=0,rz=0,dx=0,dy=0,dz=0)=>pivotTransform(out,bone,p[bone]||defaults[bone],rx,ry,rz,dx,dy,dz);
    // Wheels stay planted while the sprung chassis moves around its axle line.
    make(0,nod*.083,0,lean*.092,0,heave-comp*.60,0);
    for(let i=1;i<=4;i++){
      const side=Math.sign((p[i]||defaults[i])[0]),front=i>=3;
      const toe=front?steer*(.47+side*steer*.041):0,angle=((travel-side*offset)/wheelR)%TAU;
      make(i,angle,toe,0,0,Math.min(0,comp)*.13,0);
    }
    make(5,nod*.88,steer*.062+twist,lean,0,-Math.max(0,comp)*.12+lift,-Math.abs(lean)*.013);inherit(out,5,0);
    make(6,nod*.38+ears*.16,head,headRoll);inherit(out,6,5);
    for(const i of [7,8]){const side=i===7?-1:1;make(i,ears*ew+nod*.12,side*(ears*.14+hit*.032),headRoll*ew*.58+side*ears*ew*.16);inherit(out,i,6);}
    make(9,tailPitch*tw*.53,tail*tw*.57,tail*tw*.68);inherit(out,9,5);
    // Rotate about the actual tilted steering column, not a vertical world axis.
    const wheelAngle=-steer*1.03,wheelAxis=[0,Math.sin(.66),Math.cos(.66)];
    const cos=Math.cos(wheelAngle),sin=Math.sin(wheelAngle),u=wheelAxis[1],v=wheelAxis[2],t=1-cos,k=10*16;
    make(10);out[k]=cos;out[k+1]=v*sin;out[k+2]=-u*sin;out[k+4]=-v*sin;out[k+5]=cos+t*u*u;out[k+6]=u*v*t;
    out[k+8]=u*sin;out[k+9]=u*v*t;out[k+10]=cos+t*v*v;
    const wp=p[10]||defaults[10];for(let j=0;j<3;j++)out[k+12+j]=wp[j]-(out[k+j]*wp[0]+out[k+4+j]*wp[1]+out[k+8+j]*wp[2]);
    inherit(out,10,0);
    for(const i of [11,12]){
      const arm=i===12?pump:0,edge=i===11?-1:1,h=[edge*.203,.912,.190];
      make(i,nod*-.22-arm*1.84,steer*.12+arm*.27,-steer*.39-lean*.52+arm*.51+edge*armBrace,edge*arm*.029,arm*.055,-arm*.032);inherit(out,i,5);
      const wrist=transform(out,i,h),rim=transform(out,10,h);
      for(let j=0;j<3;j++)out[i*16+12+j]+=(rim[j]-wrist[j])*.985*(1-(i===12?envelope:0));
    }
    make(13,ears*.58+tailPitch*.30,tail*.41,lean*-.56+mid*.32);inherit(out,13,5);
    make(14,tailPitch*tw*.39,mid*tw*.49,mid*tw*.46);inherit(out,14,9);
    make(15,tailPitch*tw*.25,tip*tw*.43,tip*tw*.31);inherit(out,15,14);
    return out;
  }
  const fields=['travel','steer','lean','nod','head','headRoll','ears','tail','tailMid','tailTip','tailPitch','compression','heave','impact','drift','offset','gesture','gesturePhase','victory','wheelV'];
  function exposure(model,speed,frameSeconds=1/60){
    const radius=model?.rig?.wheelRadius||.29;
    return cap(finite(speed)/radius*cap(frameSeconds,1/144,1/24)*.82,-3.8,3.8);
  }
  // Integrate the service paint across the camera exposure. The wheel still
  // completes one turn per circumference on both render paths.
  const wheelVertex=`
    varying vec4 tire;
    uniform float wheelExposure;
    void bindTire(vec3 p,float bone){
      tire=vec4(0.);
      if(bone>.5&&bone<4.5){
        float side=mod(bone,2.)>.5?-1.:1.;
        tire=vec4(p.y-.29,p.z-(bone<2.5?-.60:.63),p.x*side-.526,1.);
      }
    }
    vec3 exposedNormal(vec3 n){
      if(tire.w<.5||dot(tire.xy,tire.xy)<.064)return n;
      vec3 radial=normalize(vec3(n.x,tire.xy/.29));
      return mix(n,radial,(1.-smoothstep(.36,.88,abs(n.x)))*smoothstep(.12,.8,abs(wheelExposure))*.92);
    }`;
  const wheelFragment=`
    varying vec4 tire;
    uniform float wheelExposure;
    float paintCoverage(float angle,float center,float width,float sweep){
      float d=mod(angle-center+sweep*.5+3.141593,6.283185)-3.141593;
      float halfTime=max(.0001,abs(sweep)*.5);
      return max(0.,min(d+halfTime,width)-max(d-halfTime,-width))/(2.*halfTime);
    }
    vec3 exposedPaint(vec3 tint){
      if(tire.w<.5||abs(wheelExposure)<.09)return tint;
      float radius=length(tire.xy);
      if(radius<.06)return tint;
      float tread=smoothstep(.252,.275,radius);
      float shoulder=smoothstep(.102,.110,tire.z)*smoothstep(.168,.179,radius)*(1.-smoothstep(.227,.24,radius));
      float hub=smoothstep(.115,.137,tire.z)*smoothstep(.056,.070,radius)*(1.-smoothstep(.148,.163,radius));
      float coverage=max(tread,max(shoulder,hub));
      if(coverage<.01)return tint;
      float angle=atan(tire.y,tire.x),pitch=.369599,center=13.*pitch;
      float chevron=.068*clamp(tire.z/.055,-1.,1.);
      float yellow=paintCoverage(angle,center+chevron,.102,wheelExposure);
      float white=paintCoverage(angle,center+pitch+chevron,.085,wheelExposure)*smoothstep(-.008,.015,tire.z);
      yellow=max(yellow*tread,shoulder*paintCoverage(angle,center,.097,wheelExposure));
      white=max(white*tread,hub*paintCoverage(angle,center,.117,wheelExposure));
      float amount=smoothstep(.09,.63,abs(wheelExposure));
      vec3 base=mix(tint,vec3(.185,.166,.139),tread*.90);
      base=mix(base,vec3(.24,.212,.174),shoulder*.68);
      base=mix(base,vec3(.46,.43,.35),hub*.49);
      base=mix(base,vec3(.92,.64,.21),min(.96,pow(yellow,.63)*1.23));
      base=mix(base,vec3(.96,.89,.71),min(.99,pow(white,.63)*1.24));
      return mix(tint,base,amount*coverage);
    }`;
  // The 2D renderer reuses projected bind pivots and bone masks exported from the
  // same model. Each cropped layer is built once, including the rear tread cycle.
  function spritePainter(){
    const layersByModel=new WeakMap(),matrices=zero(),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    function pixels(img){
      const c=canvas(img.naturalWidth,img.naturalHeight),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height);
    }
    function prepare(sprite,mask,model){
      const src=pixels(sprite),ids=pixels(mask),n=src.width,h=src.height,byKey=new Map();
      if(n!==ids.width||src.height!==ids.height)return [];
      for(let y=0;y<h;y++)for(let x=0;x<n;x++){
        const i=(y*n+x)*4;if(!src.data[i+3]||ids.data[i+3]<5)continue;
        const joint=Math.min(BONE_COUNT-1,ids.data[i]),id=joint===14||joint===15?9:joint,weight=5,key=id*6+weight;
        let layer=byKey.get(key);if(!layer){layer={id,weight:weight/5,minX:x,maxX:x,minY:y,maxY:y,indices:[]};byKey.set(key,layer);}
        layer.minX=Math.min(layer.minX,x);layer.maxX=Math.max(layer.maxX,x);layer.minY=Math.min(layer.minY,y);layer.maxY=Math.max(layer.maxY,y);layer.indices.push(y*n+x);
      }
      const zOrder=[3,4,0,5,13,10,11,12,6,7,8,1,2,9];
      const layers=Array.from(byKey.values()).sort((a,b)=>zOrder.indexOf(a.id)-zOrder.indexOf(b.id)||a.weight-b.weight);
      for(const layer of layers){
        const wheel=layer.id>=1&&layer.id<=4,num=wheel?24:1,fillDepth=[0,5,6,13].includes(layer.id)?9:0;
        layer.minX=Math.max(0,layer.minX-fillDepth);layer.maxX=Math.min(n-1,layer.maxX+fillDepth);
        layer.minY=Math.max(0,layer.minY-fillDepth);layer.maxY=Math.min(h-1,layer.maxY+fillDepth);
        const w=layer.maxX-layer.minX+1,height=layer.maxY-layer.minY+1;
        // The rest sprite omits surface pixels behind a nearer part. Extend the
        // nearest visible material under those specific occluders before posing.
        let under=null;
        if(fillDepth){under=new Int32Array(w*height);under.fill(-1);const queue=new Int32Array(w*height),depth=new Uint8Array(w*height);let start=0,end=0;
          for(const idx of layer.indices){const at=(Math.floor(idx/n)-layer.minY)*w+idx%n-layer.minX;under[at]=idx;
            if(src.data[idx*4+3]<235||ids.data[idx*4+3]<235)continue;
            let interior=0;for(const off of [-3,3,-3*n,3*n,-3*n-3,-3*n+3,3*n-3,3*n+3]){const j=(idx+off)*4;if(ids.data[j]===layer.id&&ids.data[j+3]>235)interior++;}
            if(interior>=4)queue[end++]=at;}
          const rank=zOrder.indexOf(layer.id);
          while(start<end){const k=queue[start++];if(depth[k]>=fillDepth)continue;const x=k%w,y=Math.floor(k/w);
            for(const j of [x>0?k-1:-1,x+1<w?k+1:-1,y>0?k-w:-1,y+1<height?k+w:-1]){
              if(j<0||under[j]>=0)continue;const si=((Math.floor(j/w)+layer.minY)*n+j%w+layer.minX)*4,raw=ids.data[si],bone=raw>=14?9:raw;
              if(src.data[si+3]<40||zOrder.indexOf(bone)<=rank)continue;under[j]=under[k];depth[j]=depth[k]+1;queue[end++]=j;
            }
          }
        }
        layer.frames=[];
        for(let f=0;f<num;f++){
          const c=canvas(w,height),ctx=c.getContext('2d'),out=ctx.createImageData(w,height);
          if(under){for(let k=0;k<under.length;k++)if(under[k]>=0){const srcI=under[k]*4;for(let j=0;j<4;j++)out.data[k*4+j]=src.data[srcI+j];}}
          for(const index of layer.indices){
            const x=index%n-layer.minX,y=Math.floor(index/n)-layer.minY,srcI=index*4,k=(y*w+x)*4;
            let light=1,base=srcI,paint=null,paintMix=0;
            if(wheel&&f){
              const witness=ids.data[srcI+2]>75;
              if(witness){
                // Recover nearby unpainted rubber when the painted block rotates
                // away from its bind-pose location on the tire.
                for(const off of [-5*n,5*n,-10*n,10*n,-16*n,16*n,-2,2]){
                  const c=(index+off)*4;if(ids.data[c]===layer.id&&ids.data[c+2]<30&&src.data[c+3]>200&&Math.max(src.data[c],src.data[c+1],src.data[c+2])<150){base=c;break;}
                }
              }
              const b=Math.max(src.data[srcI],src.data[srcI+1],src.data[srcI+2]),rgbMin=Math.min(src.data[srcI],src.data[srcI+1],src.data[srcI+2]);
              if((b<135&&b-rgbMin<48)||witness){
                const u=x/Math.max(1,w-1),phase=f/num*TAU;
                const center=model.rearPivots[layer.id][1]*src.height,radius=model.rig.wheelRadius*model.rearCamera.pixelsPerUnit[1];
                const d=cap((Math.floor(index/n)-center)/radius,-1,1),face=Math.sqrt(Math.max(0,1-d*d));
                const azimuth=Math.atan2(-d*.347-face*.938,-d*.938+face*.347),mark=13*TAU/17+phase+(u-.5)*.20;
                const tread=Math.pow(.5+.5*Math.cos((azimuth-phase)*17+Math.abs(u-.5)*4.3),3.6);
                light=.80+.66*tread;
                const angular=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
                const yellow=angular(azimuth,mark),ivory=angular(azimuth,mark+TAU/17);
                if(yellow<.103){paint=[218,162,56];paintMix=cap((.103-yellow)/.044,0,.88);}
                else if(ivory<.078&&((layer.id%2===1&&u>.47)||(layer.id%2===0&&u<.53))){paint=[233,218,181];paintMix=cap((.078-ivory)/.035,0,.93);}
              }
            }
            for(let j=0;j<3;j++){const unpainted=src.data[base+j]*light;out.data[k+j]=paint?unpainted*(1-paintMix)+paint[j]*paintMix:unpainted;}
            out.data[k+3]=src.data[srcI+3];
          }
          ctx.putImageData(out,0,0);layer.frames.push(c);
        }
        delete layer.indices;
      }
      return layers;
    }
    function draw(ctx,model,r,sprite,mask,x,y,w,h,postFinishTime=0,dt=1/60){
      if(!model?.pivots||!model.rearCamera||!model.rearPivots||!sprite.naturalWidth||!mask.naturalWidth)return false;
      let layers=layersByModel.get(model);
      if(!layers){try{layers=prepare(sprite,mask,model);}catch{layers=[];}layersByModel.set(model,layers);}
      if(!layers.length)return false;
      const physical=motion(r,postFinishTime),a={...physical};
      for(const field of ['lean','head','headRoll','nod','ears','impact','compression'])a[field]=(physical[field]||0)*.69;
      // Keep the entire 2D plume contiguous. Its rotation follows a combination
      // of the three simulated links. The GPU uses each individual weighted link.
      a.tail=((physical.tail||0)*.52+(physical.tailMid||0)*.32+(physical.tailTip||0)*.16)*.91;
      a.tailPitch=(physical.tailPitch||0)*.78;pose(model,a,matrices);
      const cam=model.rearCamera,right=cam.right,down=cam.up.map(v=>-v),sx=cam.pixelsPerUnit[0],sy=cam.pixelsPerUnit[1],size=sprite.naturalWidth;
      if(!sx||!sy)return false;
      ctx.save();ctx.translate(x,y);ctx.scale(w/size,h/sprite.naturalHeight);
      for(const layer of layers){
        const id=layer.id,k=id*16,pk=parents[id]*16,t=layer.weight;
        const matrixAt=j=>matrices[k+j]*t+matrices[pk+j]*(1-t);
        const mv=v=>[0,1,2].map(j=>matrixAt(j)*v[0]+matrixAt(4+j)*v[1]+matrixAt(8+j)*v[2]);
        const p=model.pivots[id],pixels=model.rearPivots[id],moved=mv(p),delta=[0,1,2].map(j=>moved[j]+matrixAt(j+12)-p[j]);
        let horizontal=mv(right),vertical=mv(down);
        if(id>=1&&id<=4){
          const toe=id>=3?(a.steer||0)*.45:0,cs=Math.cos(toe),sn=Math.sin(toe),yaw=v=>[cs*v[0]+sn*v[2],v[1],-sn*v[0]+cs*v[2]];
          horizontal=yaw(right);vertical=yaw(down);
        }
        const A=dot(horizontal,right),B=dot(horizontal,down)*sy/sx,C=dot(vertical,right)*sx/sy,D=dot(vertical,down);
        const px=pixels[0]*size,py=pixels[1]*sprite.naturalHeight;
        const u=px+dot(delta,right)*sx-A*px-C*py,v=py+dot(delta,down)*sy-B*px-D*py;
        ctx.save();ctx.transform(A,B,C,D,u,v);
        if(layer.frames.length===1)ctx.drawImage(layer.frames[0],layer.minX,layer.minY);
        else {
          const phase=(a.travel-Math.sign(p[0])*(a.offset||0))/(model.rig?.wheelRadius||.29);
          const arc=exposure(model,a.wheelV??r.v,dt),count=layer.frames.length;
          const samples=Math.max(1,Math.min(6,Math.ceil(Math.abs(arc)*count/TAU)));
          const weights=new Map();
          for(let i=0;i<samples;i++){
            const t=(phase-arc*(i+.5)/samples)/TAU;
            const index=((t%1+1)%1)*count,whole=Math.floor(index),f=index-whole;
            weights.set(whole,(weights.get(whole)||0)+1-f);
            const next=(whole+1)%count;weights.set(next,(weights.get(next)||0)+f);
          }
          // Composite exposures into the wheel's own transparent tile so
          // opponent and ghost opacity is applied just once to the final tire.
          if(weights.size<=2&&Math.abs(arc)<.004){
            const f=((phase/TAU%1+1)%1)*count;
            ctx.drawImage(layer.frames[Math.round(f)%count],layer.minX,layer.minY);
          }else{
            const tile=layer.mix||(layer.mix=canvas(layer.frames[0].width,layer.frames[0].height));
            const mix=tile.getContext('2d');mix.clearRect(0,0,tile.width,tile.height);
            mix.globalCompositeOperation='lighter';
            for(const [index,weight] of weights)if(weight>.0001){
              mix.globalAlpha=weight/samples;mix.drawImage(layer.frames[index],0,0);
            }
            mix.globalAlpha=1;ctx.drawImage(tile,layer.minX,layer.minY);
          }
        }
        ctx.restore();
      }
      ctx.restore();return true;
    }
    return {draw};
  }
  return {pose,motion,advance,fresh,transform,spritePainter,exposure,wheelVertex,wheelFragment,parents,fields,count:BONE_COUNT};
});
