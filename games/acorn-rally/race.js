(function(root){
  'use strict';
  const Sim=root.AcornSim, tau=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mod=(v,n)=>((v%n)+n)%n;
  const defaults={accelerate:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',drift:'Space',item:'KeyE',ability:'KeyQ',lookBack:'KeyR'};
  const second={accelerate:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',drift:'ShiftRight',item:'Slash',ability:'Period',lookBack:'Comma'};
  const moreKeys=[{accelerate:'KeyI',brake:'KeyK',left:'KeyJ',right:'KeyL',drift:'KeyU',item:'KeyO',ability:'KeyP',lookBack:'KeyH'},
    {accelerate:'Numpad8',brake:'Numpad5',left:'Numpad4',right:'Numpad6',drift:'Numpad0',item:'Numpad1',ability:'Numpad2',lookBack:'Numpad3'}];
  const timeText=t=>{const ms=Math.floor(Math.max(0,t)*100);return Math.floor(ms/6000)+':'+String(Math.floor(ms/100)%60).padStart(2,'0')+'.'+String(ms%100).padStart(2,'0');};
  function label(k){return ({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space',ShiftLeft:'Shift',ShiftRight:'R Shift',ControlRight:'R Ctrl',Slash:'/',Period:'.',Comma:',',Escape:'Esc'})[k]||String(k).replace(/^Key|^Digit|^Numpad/,'');}
  function safeRead(k,def){try{return JSON.parse(localStorage.getItem(k))??def;}catch{return def;}}
  function safeWrite(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
  function svg(name){const d=(root.RallyData?.icons||{})[name]||'<path d="M7 6h3v12H7zm7 0h3v12h-3z" fill="currentColor" stroke="none"/>';return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';}
  function style(){
    if(document.querySelector('#rally-race-styles'))return;const s=document.createElement('style');s.id='rally-race-styles';
    s.textContent=`.rr-stage{position:relative;height:100%;width:100%;overflow:hidden;background:#283429;font-family:DM,Arial,sans-serif;touch-action:none;color:#fff8e4;isolation:isolate}.rr-world,.rr-hud{position:absolute;inset:0;width:100%;height:100%;display:block}.rr-hud{pointer-events:none}.rr-corner{position:absolute;top:max(18px,env(safe-area-inset-top));right:max(20px,env(safe-area-inset-right));display:flex;gap:7px}.rr-btn,.rr-menu button,.rr-touch button{border:1px solid #fff5d345;background:#18221dda;color:#fff5df;cursor:pointer;font:700 15px Condensed,Arial,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:9px}.rr-btn{height:38px;width:38px;border-radius:7px}.rr-btn:hover,.rr-menu button:hover,.rr-menu button:focus-visible{background:#384638;outline:2px solid #ffc36a;outline-offset:2px}.rr-menu{display:none;position:absolute;inset:0;background:#0c1815ab;place-items:center;backdrop-filter:blur(7px);padding:20px;z-index:3}.rr-menu.open{display:grid}.rr-sheet{width:min(390px,100%);background:#1c241f;padding:30px;border:1px solid #627059;border-radius:16px;box-shadow:0 25px 70px #0006}.rr-sheet small{letter-spacing:.16em;font-size:10px;color:#e6b976;text-transform:uppercase}.rr-sheet h2{font:italic 900 50px/.98 Rally,Impact,sans-serif;text-transform:uppercase;margin:10px 0 21px}.rr-menu button{width:100%;padding:11px 15px;margin-top:7px;border-radius:7px;font-family:DM,Arial,sans-serif;font-size:14px}.rr-menu button:first-of-type{background:#f6a45c;color:#211d15;border-color:transparent}.rr-keys{font-size:12px;line-height:1.7;color:#d6dacb;margin-bottom:13px}.rr-help{display:grid;grid-template-columns:auto 1fr;gap:3px 16px;padding:0;margin:0}.rr-help dt{color:#ecefde}.rr-help dd{margin:0;text-align:right;color:#d2b991}.rr-touch{position:absolute;bottom:max(20px,env(safe-area-inset-bottom));left:12px;right:12px;justify-content:space-between;align-items:end;pointer-events:none;display:none}.rr-touch>div{display:flex;align-items:end;gap:5px}.rr-touch button{pointer-events:auto;width:46px;height:43px;border-radius:9px;background:#16221dba;touch-action:none;user-select:none;-webkit-user-select:none;font:bold 12px DM,Arial,sans-serif}.rr-touch button.on{background:#da8f42}.rr-stage:focus{outline:none}@media(pointer:coarse),(max-width:650px){.rr-touch.visible{display:flex}.rr-corner{right:8px;top:9px}.rr-btn{width:32px;height:32px}}@media(max-height:560px){.rr-sheet{padding:15px 21px}.rr-sheet h2{font-size:34px;margin:7px 0}.rr-menu button{padding:7px}.rr-keys{line-height:1.4}}`;
    document.head.append(s);
  }
  class Sound {
    constructor(enabled){this.enabled=enabled;this.ctx=null;this.engine=null;this.lastSurface=0;}
    unlock(){
      if(!this.enabled)return;
      try{
        if(!this.ctx){const C=root.AudioContext||root.webkitAudioContext;if(!C)return;const c=this.ctx=new C(),o=c.createOscillator(),filter=c.createBiquadFilter(),level=c.createGain();
          o.type='sawtooth';o.frequency.value=35;filter.type='lowpass';filter.frequency.value=220;level.gain.value=.0001;o.connect(filter).connect(level).connect(c.destination);o.start();this.engine=o;this.level=level;this.filter=filter;}
        if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
      }catch{}
    }
    tone(frequency,duration=.13,volume=.065,type='sine',end=0,delay=0){
      if(!this.ctx||!this.enabled)return;
      const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);if(end>0)o.frequency.exponentialRampToValueAtTime(end,t+duration);
      g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.015);
    }
    update(r,paused,surface){if(!this.ctx)return;const t=this.ctx.currentTime,speed=Math.abs(r.v);
      this.level.gain.setTargetAtTime(paused||!this.enabled?.0001:.014+speed*.00048,t,.09);
      this.engine.frequency.setTargetAtTime(38+speed*2.33+(r.boost>0?12:0)+Math.sin(t*24)*1.1,t,.08);
      this.filter.frequency.setTargetAtTime((r.prevDrift?320:190)+speed*9+(surface==='wet'?170:0),t,.12);
      if(!paused&&this.enabled&&r.prevDrift&&t-this.lastSurface>.11){this.lastSurface=t;this.tone(surface==='wet'?240:155,.07,.008,'triangle',73);}
    }
    close(){try{this.engine?.stop();this.ctx?.close()?.catch(()=>{});}catch{}}
  }
  function roundBox(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function txt(ctx,value,x,y,size,color='#fff8e9',style='700',family='Condensed',align='left'){
    ctx.textAlign=align;ctx.fillStyle=color;ctx.font=style+' '+size+'px '+family+', Arial, sans-serif';ctx.fillText(value,x,y);
  }
  const fallbackImages={};
  function art(src){if(!fallbackImages[src]){const i=new Image();i.src=src;fallbackImages[src]=i;}return fallbackImages[src];}
  class CanvasWorld{
    constructor(canvas,c){this.ctx=canvas.getContext('2d');this.canvas=canvas;this.c=c;this.painter=root.AcornRig.spritePainter();this.p=root.AcornWorld?.palettes[c.index]||{sky:'#bad1b8',mist:'#a2cfa9',land:'#40653e',soil:'#a1794c',edge:'#668349',wood:'#67513a',leaf:['#3a6539','#8a9e5b','#548144']};}
    render(st,seat,rect,k,back,ghost,dt,postFinishTime=0){
      const ctx=this.ctx,c=this.c,p=this.p,r=st.racers[seat],w=rect.w,h=rect.h;
      ctx.save();ctx.setTransform(k,0,0,k,rect.x*k,rect.y*k);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
      const horizon=h*.37;ctx.fillStyle=p.sky;ctx.fillRect(0,0,w,h);
      const bd=art('art/course-'+c.index+'.webp');if(bd.complete&&bd.naturalWidth){ctx.drawImage(bd,0,0,bd.naturalWidth,bd.naturalHeight*.6,0,0,w,h*.55);}
      ctx.fillStyle=p.land;ctx.fillRect(0,horizon,w,h-horizon);
      const me=Sim.sample(c,r.s,0,r.branch), f=h*1.02, direction=back?-1:1;
      const groundLift=kart=>Sim.groundLift(st,kart),lift=kart=>Sim.lift(st,kart);
      const follow=groundLift(r)+Math.max(0,lift(r)-groundLift(r))*.72;
      const worldPoint=(x,y,z)=>{const ax=x-me.x,az=z-me.z,depth=(ax*me.tx+az*me.tz)*direction+6.3;
        return {x:w/2-((ax*me.nx+az*me.nz-r.x*.88)*direction)*f/Math.max(1,depth),y:horizon+(me.y+follow+2.65-y)*f/Math.max(1,depth),z:depth,k:f/Math.max(1,depth)};};
      const P=(s,lane,dy=0,br=false)=>{const a=Sim.sample(c,s,lane,br);return worldPoint(a.x,a.y+dy,a.z);};
      const quad=(a,b,d,e,col)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(d.x,d.y);ctx.lineTo(e.x,e.y);ctx.fillStyle=col;ctx.fill();};
      const racers=st.racers.concat(ghost?[ghost]:[]);
      const obstacle=root.AcornHazards.sample(c,st.time),obstaclesByRow=new Map();
      const rampRows=new Map();
      this.rampSections||=root.AcornRampArt.drawing(root.AcornWorld.Mesh,c);
      for(const segment of this.rampSections){
        const row=Math.floor((root.AcornSignatures.gap(r.s,segment.s,c.length)*direction-.30)/1.35);
        if(row< -3||row>72)continue;if(!rampRows.has(row))rampRows.set(row,[]);rampRows.get(row).push(segment);
      }
      if(Math.abs(root.AcornSignatures.gap(r.s,obstacle.s,c.length))<126){
        root.AcornCourseArt.scene(obstacle,st.time,(...stamp)=>{
          const name=stamp[0],ground=name.startsWith('envFlow')||name.startsWith('envSaltPlate')||['envBrine','envStripes','envCracks','envShade'].includes(name);
          const nearEdge=ground?Math.abs(stamp[9]?.[2]||1)*stamp[5]:0;
          const center=root.AcornSignatures.gap(r.s,stamp[1],c.length)*direction;
          if(center+nearEdge< -4.05)return;
          const row=Math.max(-3,Math.floor((center-nearEdge)/1.35));if(row>72)return;
          if(!obstaclesByRow.has(row))obstaclesByRow.set(row,[]);
          obstaclesByRow.get(row).push(stamp);
        });
      }
      const courseStamp=(...stamp)=>{this.courseParts||=root.AcornCourseArt.fallbackMeshes(root.AcornWorld.Mesh);root.AcornCourseArt.paint(ctx,this.courseParts,P,...stamp);};
      const drawKart=(a,point,dim)=>{const iw=art('art/rear-'+a.driverIndex+'.webp'),groundHeight=groundLift(a),offGround=Math.max(0,lift(a)-groundHeight);
        ctx.save();ctx.globalAlpha=.45/(1+offGround*.54);ctx.fillStyle='#18241c';ctx.beginPath();ctx.ellipse(point.x+offGround*dim*.025,point.y-dim*groundHeight/1.53,dim*.55,dim*.12,0,0,tau);ctx.fill();ctx.restore();
        root.AcornItemArt.drawKart2d(ctx,a,point,dim,st.time,false);
        const ground=point;
        if(a.signature||a.signatureHit){
          const base=P(a.s,a.x,0,a.branch),factor=dim/(1.53*base.k);
          root.AcornSignatureArt.render(st,a,(name,s,x,height,angle,size,alpha,stretch,branch=a.branch)=>{
            const project=(s,l,h)=>{const p=P(s,l,h,branch);return {x:ground.x+(p.x-base.x)*factor,y:ground.y+(p.y-base.y)*factor,k:p.k*factor,z:p.z};};
            if(root.AcornSignatureArt.groundGlyph(ctx,name,s,x,height,angle,size,alpha,stretch,project))return;
            const pos=project(s,x,height);if(pos.z<1)return;
            root.AcornSignatureArt.glyph(ctx,name,pos.x,pos.y,pos.k*size,angle*direction,alpha,stretch);
          },c.length);
        }
        root.AcornCourseArt.reaction(st,a,courseStamp);
        const jump=lift(a)/1.53;
        const burrow=a.driverIndex===7&&a.active>0?Math.max(0,Math.min(1,(1.12-a.active)*5,a.active*5))*.78:0;
        ctx.save();if(burrow){ctx.beginPath();ctx.rect(ground.x-dim,ground.y-dim*1.8,dim*2,dim*1.83);ctx.clip();}
        point={x:ground.x,y:ground.y+dim*(burrow-jump)};
        if(iw.complete&&iw.naturalWidth){const mask=art('art/rear-mask-'+a.driverIndex+'.png'),pitch=Sim.rampPitch(st,a),spriteH=dim*(1+clamp(pitch,-.42,.42)*.18),bounds=[point.x-dim*.63,point.y-spriteH*.98,dim*1.26,spriteH];
          if(!this.painter.draw(ctx,root.AcornKartModels?.[a.driverIndex],a,iw,mask,...bounds,postFinishTime,dt))ctx.drawImage(iw,...bounds);}
        else{ctx.save();ctx.translate(point.x,point.y);ctx.scale(dim/100,dim/100);roundBox(ctx,-48,-24,17,24,5,'#302e29');roundBox(ctx,31,-24,17,24,5,'#302e29');roundBox(ctx,-38,-35,76,27,7,['#bc7545','#9b9b8d','#96ab79','#ae7952','#af923d','#bd5e4a','#719673','#608e9a'][a.driverIndex]);roundBox(ctx,-20,-57,40,30,10,'#787d54');const fc=['#ad9879','#93867c','#e4dbc6','#b87643','#8f785b','#c5703f','#757974','#716b64'][a.driverIndex];for(const s of [-1,1]){ctx.fillStyle=fc;ctx.beginPath();ctx.ellipse(s*15,-75,8,a.driverIndex===2?19:8,s*-.22,0,tau);ctx.fill();}ctx.fillStyle=fc;ctx.beginPath();ctx.ellipse(0,-60,20,18,0,0,tau);ctx.fill();ctx.restore();}ctx.restore();root.AcornItemArt.drawKart2d(ctx,a,point,dim,st.time,true);};
      for(let i=72;i>=-3;i--){const s=r.s+i*1.35*direction,e=s+1.35*direction,main=Sim.sample(c,s);
        const split=main.u>c.branchA&&main.u<c.branchB,branch=Boolean(split&&r.branch),a=branch?Sim.sample(c,s,0,true):main;
        const route=(z,l,height=0)=>P(z,l,height,branch),pt=route(s,0);if(pt.z<.5)continue;
        quad(route(s,-a.w*3),route(e,-a.w*3),route(e,a.w*3),route(s,a.w*3),i%4<2?p.land:p.edge);
        if(split){const other=Sim.sample(c,s,0,!branch);quad(P(s,-other.w,.03,!branch),P(e,-other.w,.03,!branch),P(e,other.w,.03,!branch),P(s,other.w,.03,!branch),branch?p.soil:p.wood);}
        quad(route(s,-a.w),route(e,-a.w),route(e,a.w),route(s,a.w),branch?([2,7].includes(c.index)?p.soil:p.wood):p.soil);
        for(const side of [-1,1]){quad(route(s,side*(a.w-.23)),route(e,side*(a.w-.23)),route(e,side*a.w),route(s,side*a.w),i%7<3?'#c4aa78':p.wood);}
        const j=Math.floor(mod(s,c.length)/4.2);if(Math.floor(mod(e,c.length)/4.2)!==j&&i>0){const side=j%2?-1:1,pt=route(s,side*(a.w+1.1+(j%4)*.9)),sz=pt.k;
          ctx.fillStyle=p.wood;ctx.fillRect(pt.x-sz*.18,pt.y-sz*3,sz*.36,sz*3);
          if([0,1,2,6].includes(c.index)){for(let z=0;z<3;z++){ctx.fillStyle=p.leaf[z];ctx.beginPath();ctx.moveTo(pt.x,pt.y-sz*(4.6+z*.3));ctx.lineTo(pt.x-sz*(1.4-z*.2),pt.y-sz*(1.7+z*.5));ctx.lineTo(pt.x+sz*(1.45-z*.2),pt.y-sz*(1.7+z*.5));ctx.fill();}}
          else{ctx.fillStyle=p.edge;ctx.beginPath();ctx.moveTo(pt.x-sz,pt.y);ctx.lineTo(pt.x-sz*.6,pt.y-sz*1.25);ctx.lineTo(pt.x+sz*.4,pt.y-sz*1.6);ctx.lineTo(pt.x+sz,pt.y);ctx.fill();}}
        for(const pick of st.pickups){if(pick.cooldown>0)continue;const gap=mod(pick.s-mod(s,c.length)+c.length/2,c.length)-c.length/2;if(gap*direction<0||gap*direction>1.35)continue;const q=P(pick.s,pick.x,1);ctx.fillStyle='#edb759';ctx.beginPath();ctx.ellipse(q.x,q.y,q.k*.33,q.k*.41,0,0,tau);ctx.fill();ctx.fillStyle='#715036';ctx.fillRect(q.x-q.k*.35,q.y-q.k*.35,q.k*.7,q.k*.21);}
        for(const o of st.objects){const gap=mod(o.s-s+c.length/2,c.length)-c.length/2;if(gap*direction>=0&&gap*direction<1.35)root.AcornItemArt.drawObject2d(ctx,o,P(o.s,o.x,0,o.branch));}
        for(const section of rampRows.get(i)||[])root.AcornRampArt.paint(ctx,section,worldPoint);
        for(const stamp of obstaclesByRow.get(i)||[])courseStamp(...stamp);
        for(const a of racers){if(a.seat===seat)continue;const gap=mod(a.s-s+c.length/2,c.length)-c.length/2;if(gap*direction>=0&&gap*direction<1.35){const q=P(a.s,a.x,0,a.branch);drawKart(a,q,q.k*1.53);}}
      }
      const kartScale=Math.min(w*.29,h*.34);drawKart(r,{x:w*.5-clamp(r.vx,-10,10)*w*.002,y:h*.84+follow*kartScale/1.53},kartScale);
      ctx.restore();
    }
    dispose(){}
  }
  function createMap(c){
    const pts=c.points,xx=pts.map(p=>p.x),zz=pts.map(p=>p.z),xmin=Math.min(...xx),xmax=Math.max(...xx),zmin=Math.min(...zz),zmax=Math.max(...zz),scale=1/Math.max(xmax-xmin,zmax-zmin);
    const cv=p=>[(p.x-(xmin+xmax)*.5)*scale,-(p.z-(zmin+zmax)*.5)*scale],route=pts.filter((_,i)=>i%4===0).map(cv),branch=[];
    for(let j=0;j<=45;j++)branch.push(cv(Sim.sample(c,(c.branchA+(c.branchB-c.branchA)*j/45)*c.length,0,true)));
    return {cv,route,branch};
  }
  function drawMap(ctx,map,c,st,seat,x,y,w,h){
    const factor=Math.min(w,h*1.4),loc=p=>[x+w/2+p[0]*factor*.84,y+h/2+p[1]*factor*.84],path=(pts)=>{ctx.beginPath();pts.forEach((p,i)=>{const a=loc(p);if(i)ctx.lineTo(...a);else ctx.moveTo(...a);});};
    ctx.lineJoin='round';ctx.lineCap='round';path(map.route);ctx.closePath();ctx.strokeStyle='#152119b8';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#fff5d9d0';ctx.lineWidth=2.5;ctx.stroke();path(map.branch);ctx.strokeStyle='#e7c78f';ctx.lineWidth=1.45;ctx.stroke();
    const pos=a=>loc(map.cv(Sim.sample(c,a.s,a.x,a.branch)));
    for(const a of st.racers.slice().sort((a,b)=>(a.seat===seat)-(b.seat===seat))){const [px,py]=pos(a);ctx.beginPath();ctx.arc(px,py,a.seat===seat?4.8:2.6,0,tau);ctx.fillStyle=a.seat===seat?'#ffad57':'#d9e4c4';ctx.fill();ctx.strokeStyle='#273024';ctx.lineWidth=1.3;ctx.stroke();}
  }
  const ordinal=n=>n===1?'ST':n===2?'ND':n===3?'RD':'TH';
  function hud(ctx,st,c,seat,rect,opt){
    const r=st.racers[seat],compact=opt.multi||rect.h<420,small=rect.w<570,w=rect.w,h=rect.h;
    ctx.save();ctx.translate(rect.x,rect.y);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    const inset=compact?12:small?14:26;
    const vign=ctx.createLinearGradient(0,0,0,h);vign.addColorStop(0,'#0c161b67');vign.addColorStop(.22,'#07121100');vign.addColorStop(.7,'#07121100');vign.addColorStop(1,'#0b171d76');ctx.fillStyle=vign;ctx.fillRect(0,0,w,h);
    if(r.boost>0){const glow=ctx.createRadialGradient(w/2,h*.42,h*.2,w/2,h*.42,w*.6);glow.addColorStop(0,'#ffba5b00');glow.addColorStop(1,'#ffd18b4f');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);}
    const panel='#19221dd9',line='#f1e4b12c', gold='#ffb669',muted='#cbd1ba';
    if(compact&&opt.multi){
      roundBox(ctx,inset,inset,112,27,4,panel,line);txt(ctx,'P'+(opt.localIndex+1)+'  '+r.name.toUpperCase(),inset+9,inset+18,13,'#f3d9ac','700','DM');
    }else{roundBox(ctx,inset,inset,Math.min(w*.64,218),32,4,panel,line);ctx.fillStyle=gold;ctx.fillRect(inset,inset+6,3,20);txt(ctx,c.name.toUpperCase(),inset+12,inset+22,17);}
    if(st.countdown<=0&&!r.finish&&Math.abs(r.v)>5){
      const q=Sim.sample(c,r.s+Math.max(7,r.v*.82),0,r.branch),fork=q.u>c.branchA-.03&&q.u<c.branchA+.008;
      const obstacle=root.AcornHazards.sample(c,st.time),gap=root.AcornSignatures.gap(r.s,obstacle.s,c.length);
      const hazard=r.branch===obstacle.branch&&(obstacle.active||obstacle.warning)&&gap>-.7&&gap<Math.max(14,r.v*1.30);
      if(fork||hazard||Math.abs(q.curve)>.018){
        const sx=w*.50,sy=inset+7,sz=compact?22:29;
        roundBox(ctx,sx-sz*.68,sy-4,sz*1.36,sz+5,4,panel,line);ctx.strokeStyle=hazard?'#ffb761':'#f3cf81';ctx.lineWidth=compact?2.5:3;ctx.lineCap='round';ctx.lineJoin='round';
        ctx.beginPath();if(hazard){ctx.moveTo(sx,sy+sz*.14);ctx.lineTo(sx-sz*.35,sy+sz*.73);ctx.lineTo(sx+sz*.35,sy+sz*.73);ctx.closePath();ctx.moveTo(sx,sy+sz*.37);ctx.lineTo(sx,sy+sz*.51);ctx.moveTo(sx,sy+sz*.61);ctx.lineTo(sx,sy+sz*.63);}
        else if(fork){ctx.moveTo(sx,sy+sz*.81);ctx.lineTo(sx,sy+sz*.48);ctx.lineTo(sx-sz*.28,sy+sz*.18);ctx.moveTo(sx,sy+sz*.48);ctx.lineTo(sx+sz*.28,sy+sz*.18);}
        else{const side=q.curve>0?-1:1;ctx.moveTo(sx-side*sz*.14,sy+sz*.78);ctx.lineTo(sx-side*sz*.14,sy+sz*.47);ctx.quadraticCurveTo(sx-side*sz*.14,sy+sz*.28,sx+side*sz*.29,sy+sz*.28);ctx.moveTo(sx+side*sz*.12,sy+sz*.12);ctx.lineTo(sx+side*sz*.31,sy+sz*.28);ctx.lineTo(sx+side*sz*.12,sy+sz*.46);}
        ctx.stroke();
        if(hazard&&!compact)txt(ctx,obstacle.name.toUpperCase(),sx,sy+sz+15,10,'#fff0cf','700','DM','center');
      }
    }
    const y=inset+(compact?37:52);
    if(st.mode!=='trial'){
      ctx.shadowColor='#142015';ctx.shadowBlur=9;txt(ctx,r.rank,inset,y+(compact?30:45),compact?43:67,'#fff5de','italic 900','Rally');
      const dig=ctx.measureText(String(r.rank)).width;txt(ctx,ordinal(r.rank),inset+dig+1,y+(compact?12:20),compact?16:23,gold,'italic 900','Rally');ctx.shadowBlur=0;
    }
    const metricsY=st.mode==='trial'?y+8:y+(compact?50:70),mwidth=compact?104:122;
    roundBox(ctx,inset,metricsY-13,mwidth,compact?38:46,5,panel,line);txt(ctx,'LAP',inset+9,metricsY+2,10,muted,'700','DM');txt(ctx,Math.min(st.totalLaps,r.lapTimes.length+1)+' / '+st.totalLaps,inset+42,metricsY+3,15);
    txt(ctx,timeText(r.finish||st.time),inset+9,metricsY+(compact?20:25),compact?15:19,'#eee2c7','700','Condensed');
    const mobile=opt.touch;const bottom=mobile?65:compact?10:24;
    const cardH=compact?34:48, cardW=compact?102:148, yb=h-bottom-cardH, abilityReady=r.meter>.998;
    const sig=r.signature,showSkill=sig&&(r.active>0||st.time-sig.beat<.72),skillColor=root.AcornSignatures.colors[r.driverIndex];
    const skillFill=showSkill?(r.driverIndex===3&&sig.stage==='active'?sig.charge:clamp(1-(st.time-sig.since)/Sim.durations[r.driverIndex],0,1)):r.meter;
    roundBox(ctx,inset,yb,cardW,cardH,5,panel,showSkill?skillColor:line);
    txt(ctx,showSkill?sig.label.toUpperCase():'ABILITY',inset+8,yb+(compact?11:15),compact?7:8,showSkill?skillColor:muted,'700','DM');
    txt(ctx,Sim.abilities[r.driverIndex],inset+8,yb+(compact?25:34),compact?13:18,showSkill?skillColor:abilityReady?gold:'#fff1d7');
    ctx.fillStyle='#776d4d';ctx.fillRect(inset+5,yb+cardH-5,cardW-10,2);ctx.fillStyle=showSkill?skillColor:abilityReady?gold:'#c9bf91';ctx.fillRect(inset+5,yb+cardH-5,(cardW-10)*skillFill,2);
    if(!compact){txt(ctx,opt.keyAbility,inset+cardW-9,yb+15,10,gold,'700','DM','right');}
    if(st.mode!=='trial'){
      const x=inset+(small||compact?0:cardW+7),iy=(small||compact)?yb-cardH-5:yb;
      const slot=r.item<0?7:r.reveal>0?Math.floor(st.time*20)%7:r.item;
      const itemIcon=art('art/item-'+slot+'.webp'),accent=r.item<0?'#9b927d':root.AcornItemArt.colors[slot],size=compact?25:40;
      roundBox(ctx,x,iy,cardW,cardH,5,panel,r.item<0?line:accent);
      if(itemIcon.complete&&itemIcon.naturalWidth){
        ctx.save();ctx.globalAlpha=r.item<0?.58:1;ctx.drawImage(itemIcon,x+4,iy+(cardH-size)/2,size,size);ctx.restore();
      }
      const tx=x+size+7;txt(ctx,'ACORN ITEM',tx,iy+(compact?11:15),compact?7:8,muted,'700','DM');
      txt(ctx,r.item<0?'Empty':r.reveal>0?'Drawing…':Sim.items[r.item],tx,iy+(compact?26:34),compact?12:16,r.item<0?'#bdc1ab':accent);
      if(!compact)txt(ctx,opt.keyItem,x+cardW-9,iy+15,10,gold,'700','DM','right');
    }
    const mapW=compact?88:small?96:145,mapH=compact?66:small?77:100;
    drawMap(ctx,opt.map,c,st,seat,w-inset-mapW,h-bottom-mapH-(compact?32:56),mapW,mapH);
    const speedY=h-bottom-(compact?4:6),speedx=w-inset;
    ctx.shadowColor='#182b22';ctx.shadowBlur=8;
    txt(ctx,Math.round(Math.abs(r.v)*3.6),speedx-(compact?24:38),speedY,compact?33:50,'#fff7e6','italic 900','Rally','right');ctx.shadowBlur=0;
    txt(ctx,'KM/H',speedx,speedY-2,compact?9:12,'#e1dec5','700','DM','right');
    if(st.countdown>0||st.time<.85){const n=st.countdown>0?Math.ceil(st.countdown):'GO!';
      ctx.shadowColor='#26362680';ctx.shadowBlur=17;txt(ctx,n,w/2,h*.43,clamp(h*.18,40,110),'#fff3ce','italic 900','Rally','center');ctx.shadowBlur=0;
      txt(ctx,st.countdown>0?'ON THE GRID':'',w/2,h*.43+22,compact?11:16,'#fae2b0','700','Condensed','center');
    }else if(r.finish){txt(ctx,'FINISH!',w/2,h*.44,compact?45:78,'#ffe0a4','italic 900','Rally','center');}
    else if(r.noticeTime>0&&!(r.itemFx>0||r.itemHitFx>0)){const message=r.notice;ctx.font='700 18px Condensed, sans-serif';const mw=ctx.measureText(message).width+33,cy=h*.25;
      roundBox(ctx,w/2-mw/2,cy-20,mw,30,5,panel,line);txt(ctx,message,w/2,cy+1,18,gold,'700','Condensed','center');}
    if(!compact&&st.countdown<=0&&st.time<12&&r.s<2&&Math.abs(r.v)<.3&&!r.finish){
      const msg=opt.touch?'Hold GAS to accelerate':'Hold '+opt.keyGas+' to accelerate';ctx.font='700 15px DM, sans-serif';const mw=ctx.measureText(msg).width+26;
      roundBox(ctx,w/2-mw/2,h*.67-15,mw,30,6,panel,line);txt(ctx,msg,w/2,h*.67+5,15,'#fff3d8','700','DM','center');}
    root.AcornFeedback.draw(ctx,w,h,r,st.time,compact);
    root.AcornCourseArt.hud(ctx,w,h,r,st.time,compact);
    if(compact&&opt.multi){ctx.strokeStyle='#1c271e';ctx.lineWidth=3;ctx.strokeRect(0,0,w,h);}
    ctx.restore();
  }
  let active=null;
  function stop(){if(active){active.dispose();active=null;}}
  function start(options={}){
    stop();style();const container=typeof options.container==='string'?document.querySelector(options.container):options.container||document.getElementById('race');
    if(!container)throw Error('Race container is missing.');
    const settings=options.settings||{},net=options.network,players=net?1:clamp(+options.players||1,1,4);
    const mode=['trial','timeTrial','time-trial'].includes(options.mode)?'trial':options.mode||'race';
    const seed=options.seed??(mode==='trial'?9110:(Date.now()>>>0));let st=Sim.create({...options,seed,mode,players});
    const c=Sim.track(options.trackIndex),map=createMap(c),keysets=[Object.assign({},defaults,settings.bindings||{}),second,...moreKeys];
    const stage=document.createElement('div');stage.className='rr-stage';stage.tabIndex=-1;container.hidden=false;container.replaceChildren(stage);
    stage.innerHTML='<canvas class="rr-world" aria-label="Kart race"></canvas><canvas class="rr-hud" aria-hidden="true"></canvas><div class="rr-corner"><button class="rr-btn rr-sound" aria-label="Toggle race sound"></button><button class="rr-btn rr-pause" aria-label="Pause race" title="Pause (Esc)">'+svg('pause')+'</button></div><div class="rr-menu" role="dialog" aria-modal="true" aria-label="Race menu"><div class="rr-sheet"></div></div><div class="rr-touch"></div>';
    let wc=stage.querySelector('.rr-world'),hc=stage.querySelector('.rr-hud'),ctx=hc.getContext('2d'),renderer;
    try{renderer=new root.AcornWorld.World(wc,c);}catch(error){console.info('Acorn Rally is using its canvas renderer.',error.message);const rep=wc.cloneNode();wc.replaceWith(rep);wc=rep;renderer=new CanvasWorld(wc,c);}
    const ghostKey='acorn-rally-ghost-'+c.index+(st.cc===100?'':'-'+st.cc);
    const sound=new Sound(settings.sound!==false),menu=stage.querySelector('.rr-menu'),sheet=stage.querySelector('.rr-sheet'),touchbar=stage.querySelector('.rr-touch'),keys=new Set(),touch=new Set(),listeners=[],loadedGhost=safeRead(ghostKey,null);
    const seat=net?.seat??0;let alive=true,paused=false,help=false,endDelay=0,raf=0,prev=performance.now(),timeBank=0,lastSnap=null,lastSend=-1,trace=[],lastTrace=-1,oldLap=0,ghost=loadedGhost,trialBest=loadedGhost?.time||Infinity,snapshotTime=0;
    let lastCount=4,lastItem=-1,lastBoost=0,lastHit=0,lastUseFx=0,lastHitFx=0,lastSkill=0,lastConfirm=0,previousPad=[],padMap=[],padReservations=[],lastDims={},drawScale=1,hudScale=1;
    const driverCues=new Map(),approachCues=new Map();let lastApproach=-2;
    let quality=1,frameMean=1/60,budgetClock=0;
    const on=(obj,type,fn,opts)=>{obj.addEventListener(type,fn,opts);listeners.push(()=>obj.removeEventListener(type,fn,opts));};
    const readPads=()=>{try{return Array.from(navigator.getGamepads?.()||[]).filter(Boolean);}catch{return [];}};
    function syncSound(){const b=stage.querySelector('.rr-sound');b.innerHTML=svg(sound.enabled?'volume':'mute');b.title=sound.enabled?'Mute sound':'Enable sound';b.setAttribute('aria-label',b.title);}
    syncSound();
    function togglePause(v=!paused){if(!alive)return;paused=v;help=false;touch.clear();keys.clear();menu.classList.toggle('open',v);
      if(v)makeMenu();else {stage.focus({preventScroll:true});sound.unlock();}if(net&&v)net.sendInput({steer:0,gas:0,brake:0,drift:false,item:false,ability:false,lookBack:false});}
    function makeMenu(){
      const binds=keysets[0],rows=[['Steer',label(binds.left)+' / '+label(binds.right)+' · Left stick'],['Accelerate / brake',label(binds.accelerate)+' / '+label(binds.brake)+' · RT / LT'],['Drift',label(binds.drift)+' · RB'],['Item / ability',label(binds.item)+' / '+label(binds.ability)+' · X / Y'],['Look back',label(binds.lookBack)+' · B']];
      sheet.replaceChildren();const small=document.createElement('small');small.textContent=c.name+' · '+Sim.normalizeCC(st.cc)+' cc';const title=document.createElement('h2');title.textContent=help?'Controls':net?'Race menu':'Paused';sheet.append(small,title);
      if(help){const list=document.createElement('dl');list.className='rr-help rr-keys';for(const [a,b] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;list.append(dt,dd);}sheet.append(list);}
      const button=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.addEventListener('click',fn);sheet.append(b);return b;};
      const first=button('Resume race',()=>togglePause(false));if(!help)button('Controls',()=>{help=true;makeMenu();});else button('Back',()=>{help=false;makeMenu();});
      if(!net)button('Restart race',()=>start(options));button('Leave race',()=>{stop();options.onExit?.();});first.focus({preventScroll:true});
    }
    on(stage.querySelector('.rr-pause'),'click',()=>togglePause());on(stage.querySelector('.rr-sound'),'click',()=>{sound.enabled=!sound.enabled;if(sound.enabled)sound.unlock();syncSound();});
    for(const [i,buttons] of [['steer',[['left','◀'],['right','▶']]],['action',[['ability','Skill'],['item','Item'],['drift','Drift'],['brake','Brake'],['accelerate','GAS']]]]){const div=document.createElement('div');for(const [action,text] of buttons){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',action);b.type='button';div.append(b);
      on(b,'pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(action);b.classList.add('on');sound.unlock();});const off=()=>{touch.delete(action);b.classList.remove('on');};on(b,'pointerup',off);on(b,'pointercancel',off);on(b,'lostpointercapture',off);}touchbar.append(div);}
    touchbar.classList.toggle('visible',players===1);
    const allowed=new Set(keysets.flatMap(set=>Object.values(set)).concat(['Escape','KeyP','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft']));
    on(window,'keydown',e=>{if(!alive)return;if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)togglePause();return;}
      if(paused)return;if(allowed.has(e.code)){e.preventDefault();e.stopImmediatePropagation();keys.add(e.code);if(!e.repeat)sound.unlock();}},true);
    on(window,'keyup',e=>{keys.delete(e.code);if(alive&&!paused&&allowed.has(e.code)){e.preventDefault();e.stopImmediatePropagation();}},true);
    on(window,'blur',()=>{keys.clear();touch.clear();if(!net&&!paused)togglePause(true);});
    on(document,'visibilitychange',()=>{if(document.hidden&&!net&&!paused)togglePause(true);});
    on(stage,'pointerdown',()=>sound.unlock());
    function input(i,pads){
      const b=keysets[i]||defaults,pad=padMap[i],single=players===1,use=(act)=>keys.has(b[act])||(i===0&&touch.has(act))||(single&&({accelerate:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',drift:'ShiftLeft'})[act]&&keys.has(({accelerate:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',drift:'ShiftLeft'})[act]));
      const stick=pad?.axes?.[0]||0,dz=clamp(Number(settings.deadzone??.12),0,.8),axis=Math.abs(stick)<dz?0:Math.sign(stick)*(Math.abs(stick)-dz)/(1-dz),button=j=>pad?.buttons?.[j]?.pressed||false;
      // The course normal points left when the chase camera looks along the tangent.
      const screenRight=(use('right')?1:0)-(use('left')?1:0)+axis+(button(15)?1:0)-(button(14)?1:0);
      const steer=-clamp(screenRight,-1,1);
      const brake=Math.max(use('brake')?1:0,pad?.buttons[6]?.value||0);
      return {steer,gas:Math.max(use('accelerate')?1:0,pad?.buttons[7]?.value||0,(settings.autoAccel||settings.autoAcceleration)&&!brake?1:0),brake,drift:!!use('drift')||button(5),item:!!use('item')||button(2),ability:!!use('ability')||button(3),lookBack:!!use('lookBack')||button(1)};
    }
    function gamepads(){
      const pads=readPads();
      if(pads.length&&!padReservations.some(Boolean)){
        const shift=players>1&&pads.length<players?1:0;
        pads.slice(0,players-shift).forEach((p,i)=>padReservations[i+shift]={index:p.index,id:p.id});
      }
      const claimed=new Set();padMap=Array(players).fill(null);
      for(let i=0;i<players;i++){const reserved=padReservations[i];if(!reserved)continue;
        const pad=pads.find(p=>p.index===reserved.index&&p.id===reserved.id);if(pad){padMap[i]=pad;claimed.add(pad.index);}}
      for(const pad of pads){if(claimed.has(pad.index))continue;
        let i=padReservations.findIndex((r,j)=>r?.id===pad.id&&!padMap[j]);
        if(i<0)i=Array.from({length:players},(_,j)=>j).find(j=>!padReservations[j])??-1;
        if(i<0)i=padMap.findIndex(p=>p===null);
        if(i>=0){padMap[i]=pad;padReservations[i]={index:pad.index,id:pad.id};claimed.add(pad.index);}}
      if(!pads.length)return pads;
      pads.forEach((p,i)=>{const mask=[9,0,1,12,13].map(j=>!!p.buttons[j]?.pressed),last=previousPad[p.index]||[];
        if(mask[0]&&!last[0]){togglePause();sound.unlock();}
        else if(paused){let btns=Array.from(sheet.querySelectorAll('button')),idx=Math.max(0,btns.indexOf(document.activeElement));
          if(mask[3]&&!last[3])btns[(idx-1+btns.length)%btns.length]?.focus();if(mask[4]&&!last[4])btns[(idx+1)%btns.length]?.focus();
          if(mask[1]&&!last[1])document.activeElement?.click();if(mask[2]&&!last[2])togglePause(false);}
        if(!sound.ctx&&p.buttons.some(b=>b.pressed))sound.unlock();previousPad[p.index]=mask;});return pads;
    }
    function dimensions(){
      const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),dpr=window.devicePixelRatio||1;
      if(w!==lastDims.w||h!==lastDims.h||dpr!==lastDims.dpr||quality!==lastDims.quality){
        drawScale=Math.min(dpr,players>2?.92:1.5,Math.sqrt((players>2?840000:players>1?1450000:1800000)/(w*h)))*quality;hudScale=Math.min(2,dpr);
        wc.width=Math.max(1,Math.round(w*drawScale));wc.height=Math.max(1,Math.round(h*drawScale));if(hc.width!==Math.round(w*hudScale)||hc.height!==Math.round(h*hudScale)){hc.width=Math.round(w*hudScale);hc.height=Math.round(h*hudScale);}lastDims={w,h,dpr,quality};
      }return {w,h};
    }
    function views(w,h){
      if(players===1)return [{x:0,y:0,w,h}];
      if(players===2)return w/h>2.02?[{x:0,y:0,w:w/2,h},{x:w/2,y:0,w:w/2,h}]:[{x:0,y:0,w,h:h/2},{x:0,y:h/2,w,h:h/2}];
      return Array.from({length:players},(_,i)=>({x:i%2*w/2,y:Math.floor(i/2)*h/2,w:w/2,h:h/2}));
    }
    function trial(){
      if(mode!=='trial'||!st.racers[seat])return null;const r=st.racers[seat],lap=r.lapTimes.length,current=st.time-r.splitTime;
      const record=(t,s)=>[+t.toFixed(3),+s.toFixed(2),+r.x.toFixed(2),+r.branch,+r.yaw.toFixed(2),+r.air.toFixed(2),
        ...root.AcornRig.fields.map(key=>+Number(r.motion?.[key]||0).toFixed(3)),
        +Sim.lift(st,r).toFixed(3),+Sim.rampPitch(st,r).toFixed(4)];
      if(lap>oldLap){const t=r.lapTimes[lap-1];if(t<trialBest){trialBest=t;ghost={version:2,poseFields:root.AcornRig.fields,time:t,cc:st.cc,driverIndex:r.driverIndex,trace:trace.concat([record(t,c.length)])};safeWrite(ghostKey,ghost);}trace=[];oldLap=lap;lastTrace=-1;}
      if(st.countdown<=0&&current-lastTrace>=.085){lastTrace=current;trace.push(record(current,mod(r.s,c.length)));}
      if(!ghost?.trace?.length||st.countdown>0||current>ghost.time)return null;
      let lo=0,hi=ghost.trace.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(ghost.trace[mid][0]<current)lo=mid+1;else hi=mid;}
      const b=ghost.trace[lo],a=ghost.trace[Math.max(0,lo-1)],f=clamp((current-a[0])/(b[0]-a[0]||1),0,1),mix=i=>a[i]+(b[i]-a[i])*f;
      const playback={s:lap*c.length+mix(1),x:mix(2),branch:!!a[3],yaw:mix(4),air:mix(5),driverIndex:ghost.driverIndex,seat:-1,v:(b[1]-a[1])/(b[0]-a[0]||1)};
      const poseFields=ghost.version===2&&Array.isArray(ghost.poseFields)?ghost.poseFields:root.AcornRig.fields.slice(0,a.length-6);
      if(poseFields.length&&b.length>=a.length)playback.motion=Object.fromEntries(poseFields.map((key,i)=>[key,mix(6+i)]));
      const liftAt=6+poseFields.length;
      if(ghost.version===2&&a.length>=liftAt+2&&b.length>=liftAt+2){playback.ghostLift=mix(liftAt);playback.ghostPitch=mix(liftAt+1);}
      return playback;
    }
    let playSignalled=false;
    function run(now){
      if(!alive)return;const frame=clamp((now-prev)/1000,0,.115);prev=now;const pads=gamepads();
      if(!paused&&!document.hidden&&st.time>1&&renderer.gl){frameMean+=(frame-frameMean)*.032;budgetClock+=frame;
        if(budgetClock>1.7){if(frameMean>(players>1?.0178:.0198))quality=Math.max(players>1?.62:.7,quality-.09);
          else if(frameMean<(players>1?.01655:.0169))quality=Math.min(1,quality+.035);budgetClock=0;}}
      const inputs={};for(let i=0;i<players;i++)inputs[net?seat:i]=paused?{}:input(i,pads);
      if(net){
        if(now-lastSend>36){net.sendInput(inputs[seat]);lastSend=now;}
        const snap=net.getState();
        if(snap&&snap!==lastSnap){const old=st;st=JSON.parse(JSON.stringify(snap));lastSnap=snap;snapshotTime=now;
          if(old&&old.time>0&&!st.done){for(const r of st.racers){const a=old.racers[r.seat];if(!a||Math.abs(a.s-r.s)>3.3||a.branch!==r.branch)continue;
            const v=(r.seat===seat?.43:.6)*(!!a.flight!==!!r.flight?.28:1);r.x+=(a.x-r.x)*v;r.s+=(a.s-r.s)*v;
            if(a.flight&&r.flight&&a.flight.id===r.flight.id&&Math.abs(a.flight.lipS-r.flight.lipS)<.5){
              r.flight.y+=(a.flight.y-r.flight.y)*v;r.flight.vy+=(a.flight.vy-r.flight.vy)*v;
            }
            if(Number.isFinite(r.rampAngle)&&Number.isFinite(a.rampAngle))r.rampAngle+=(a.rampAngle-r.rampAngle)*v;
            if(a.motion&&r.motion){for(const field of root.AcornRig.fields){if(Number.isFinite(a.motion[field])&&Number.isFinite(r.motion[field]))r.motion[field]+=(a.motion[field]-r.motion[field])*v;}}}}
        }else if(snap&&!st.done&&now-snapshotTime<180){
          const dt=Math.min(frame,.045);if(st.countdown<=0)st.time+=dt;
          for(const r of st.racers){
            const previous=Sim.wheelPosition(c,r,st);
            if(r.seat===seat)r.steer=inputs[seat].steer||0;
            if(!r.finish&&st.countdown<=0){
              const runoff=Math.abs(r.x)>previous.w-.38&&!(r.driverIndex===7&&r.active>0),speed=r.v*(runoff?.925:1)*(r.branch?1+.17*previous.peak:1);
              r.s+=speed*dt;r.x+=r.vx*dt;
              if(!r.flight)r.air=Math.max(0,r.air-dt);
              if(r.seat===seat){r.yaw+=(r.steer*(inputs[seat].drift?.43:.19)-r.yaw)*Math.min(1,dt*12);r.x+=r.steer*.48*dt;}
              Sim.predictRamps(st,r,c,dt,previous);
            }
            Sim.roll(c,r,dt,previous,st);}
        }
      }else if(!paused){timeBank=Math.min(.13,timeBank+frame);while(timeBank>=1/60){Sim.step(st,1/60,inputs);timeBank-=1/60;}}
      const r=st.racers[seat]||st.racers[0],sounds=!paused&&sound.enabled;
      const obstacle=root.AcornHazards.sample(c,st.time);
      for(let i=0;i<players;i++){
        const driver=st.racers[net?seat:i];if(!driver)continue;
        const b=driver.contactSeq||0,h=driver.hazardHit,hit=h?.count||0,landing=driver.landingSeq||0,last=driverCues.get(driver.seat)||[0,0,0];
        if(!paused&&b!==last[0]&&driver.contactFx>.24)root.AcornCourseArt.feedback(sound,padMap[i],driver.contactKind,driver.contactForce,i>0);
        if(!paused&&hit!==last[1]&&h&&st.time-h.at<.4)root.AcornCourseArt.feedback(sound,padMap[i],[2,6,7].includes(h.id)?'water':'stone',h.blocked?.24:.62,i>0);
        if(!paused&&landing!==last[2]&&driver.landingFx>.32)root.AcornCourseArt.feedback(sound,padMap[i],'landing',Math.min(.65,driver.landingForce||.30),i>0);
        if(b!==last[0]||hit!==last[1]||landing!==last[2])driverCues.set(driver.seat,[b,hit,landing]);
        const distance=root.AcornSignatures.gap(driver.s,obstacle.s,c.length),visit=Math.round((driver.s-obstacle.s)/c.length);
        if(sounds&&st.countdown<=0&&driver.branch===obstacle.branch&&(obstacle.warning||obstacle.active)&&distance>0&&distance<Math.max(15,driver.v*1.35)&&approachCues.get(driver.seat)!==visit){
          if(st.time-lastApproach>.72){root.AcornCourseArt.approach(sound,obstacle.id);lastApproach=st.time;}approachCues.set(driver.seat,visit);
        }
      }
      if(sounds){const count=Math.ceil(st.countdown);if(count!==lastCount&&count<4){sound.tone(count?420:780,count?.12:.38,.06,'sine',count?315:1100);}lastCount=count;
        if(r.item>=0&&lastItem<0){sound.tone(780,.18,.04,'triangle',1320);}if(r.boost>0&&lastBoost<=0)sound.tone(180,.2,.024,'sawtooth',440);
        if(r.hit>0&&lastHit<=0&&!(r.contactFx>.33)&&!(r.hazardHit&&st.time-r.hazardHit.at<.40)){sound.tone(112,.18,.045,'triangle',48);try{padMap[0]?.vibrationActuator?.playEffect('dual-rumble',{duration:130,strongMagnitude:.28,weakMagnitude:.45})?.catch(()=>{});}catch{}}
        if(r.itemFx>lastUseFx+.2)root.AcornFeedback.cue(sound,r.usedItem);
        if(r.itemHitFx>lastHitFx+.15)root.AcornFeedback.impactCue(sound,r.itemHitKind,r.itemBlocked);
        if(r.confirmSeq>lastConfirm){root.AcornFeedback.confirmCue(sound,r.confirmedBlocked);lastConfirm=r.confirmSeq;}
        if(r.fx>lastSkill+.09)sound.tone([490,170,540,285,660,310,120,185][r.driverIndex],.23,.038,'triangle',[830,85,1030,640,1050,890,66,410][r.driverIndex]);
        lastItem=r.item;lastBoost=r.boost;lastHit=r.hit;lastUseFx=r.itemFx||0;lastHitFx=r.itemHitFx||0;lastSkill=r.fx||0;}
      sound.update(r,paused||st.countdown>0,r.branch?'wet':'dry');
      const {w,h}=dimensions();ctx.setTransform(hudScale,0,0,hudScale,0,0);ctx.clearRect(0,0,w,h);const ghostKart=trial();
      const touchActive=(matchMedia('(pointer:coarse)').matches||w<=650)&&players===1;
      renderer.beginFrame?.();
      views(w,h).forEach((rect,i)=>{const id=net?seat:i;if(!st.racers[id])return;renderer.render(st,id,rect,drawScale,!!inputs[id]?.lookBack,ghostKart,frame,endDelay);
        const b=keysets[i]||defaults,gamepad=!!padMap[i],ps=/^ps$|playstation/i.test(settings.padStyle||settings.prompts||'');
        hud(ctx,st,c,id,rect,{map,multi:players>1,localIndex:i,touch:touchActive,keyGas:gamepad?(ps?'R2':'RT'):label(b.accelerate),keyAbility:gamepad?(ps?'△':'Y'):label(b.ability),keyItem:gamepad?(ps?'□':'X'):label(b.item)});});
      if(players===3){ctx.fillStyle='#1c291f';ctx.fillRect(w/2,h/2,w/2,h/2);txt(ctx,c.name.toUpperCase(),w*.75,h*.68,Math.max(20,w*.027),'#eee8d2','italic 900','Rally','center');drawMap(ctx,map,c,st,0,w*.57,h*.7,w*.36,h*.24);}
      if(!playSignalled&&!paused&&st.countdown<=0&&st.time>0){
        playSignalled=true;
        document.documentElement.dataset.catnmicePlaying='true';
        root.dispatchEvent(new Event('catnmice-game-started'));
      }
      if(st.done&&!paused){endDelay+=frame;if(endDelay>2.12){
        const data=Sim.result(lastSnap?.done?lastSnap:st,seat);stop();options.onFinish?.(data);return;}}
      raf=requestAnimationFrame(run);
    }
    const dispose=()=>{alive=false;cancelAnimationFrame(raf);listeners.forEach(fn=>fn());sound.close();renderer.dispose();stage.remove();container.hidden=true;};
    active={dispose,get state(){return st;},get renderer(){return renderer;},pause:togglePause};stage.focus({preventScroll:true});sound.unlock();raf=requestAnimationFrame(run);return active;
  }
  root.AcornRace={start,stop,get active(){return active;}};
})(window);
