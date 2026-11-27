/* Cinder Relay | hand-built pixel animation cels for ammunition and detonations */
(() => {
  'use strict';
  const TAU = Math.PI * 2, SIZE = 112, FRAMES = 22;
  const clamp = n => Math.max(0, Math.min(1, n));
  const styles = {
    thermal: {shadow:'#382936', rim:'#a64836', mid:'#f47736', hot:'#ffbf58', core:'#fff3b2', dust:'#6b514d'},
    ion:     {shadow:'#303052', rim:'#6757ae', mid:'#a68bf4', hot:'#94e7fd', core:'#e7ffff', dust:'#575274'},
    spore:   {shadow:'#303d37', rim:'#557547', mid:'#91b650', hot:'#cfdf72', core:'#f6ffc6', dust:'#59694d'},
    quake:   {shadow:'#372f36', rim:'#77564c', mid:'#b38260', hot:'#edb881', core:'#ffebbd', dust:'#74635b'},
    cryo:    {shadow:'#2c3e58', rim:'#577fba', mid:'#75bbd6', hot:'#b0edf4', core:'#edffff', dust:'#50697a'}
  };
  const cache = new Map();
  function noise(i,k) {
    let x=Math.imul(i+131,0x1b873593)^Math.imul(k+17,0x85ebca6b);
    x=Math.imul(x^(x>>>16),0x45d9f3b);
    return ((x^(x>>>16))>>>0)/4294967296;
  }
  function poly(c,pts,fill) {
    c.beginPath();
    for(let i=0;i<pts.length;i+=2){
      const x=Math.round(pts[i]),y=Math.round(pts[i+1]);
      if(i)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.closePath();c.fillStyle=fill;c.fill();
  }
  // Stepped shoulders keep each puff legible as it expands into a silhouette.
  function puff(c,x,y,r,col) {
    if(r<1)return;
    poly(c,[x-r,y-r*.27,x-r*.79,y-r*.27,x-r*.79,y-r*.68,x-r*.36,y-r*.68,
      x-r*.36,y-r,x+r*.34,y-r,x+r*.34,y-r*.82,x+r*.72,y-r*.82,
      x+r*.72,y-r*.49,x+r*.93,y-r*.49,x+r*.93,y+r*.38,x+r*.67,y+r*.38,
      x+r*.67,y+r*.7,x+r*.19,y+r*.7,x+r*.19,y+r*.91,x-r*.51,y+r*.91,
      x-r*.51,y+r*.67,x-r*.84,y+r*.67,x-r*.84,y+r*.31,x-r,y+r*.31],col);
  }
  function streak(c,x,y,a,length,width,col){
    const dx=Math.cos(a),dy=Math.sin(a);
    poly(c,[x-dx*length,y-dy*length,x-dy*width,y+dx*width,x+dx*2,y+dy*2,x+dy*width,y-dx*width],col);
  }
  function ring(c,r,start,end,col,width,tilt=1) {
    c.beginPath();
    const steps=Math.max(3,Math.ceil((end-start)*5));
    for(let i=0;i<=steps;i++){
      const a=start+(end-start)*i/steps,x=Math.round(Math.cos(a)*r),y=Math.round(Math.sin(a)*r*tilt);
      if(i)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.strokeStyle=col;c.lineWidth=width;c.stroke();
  }
  function cel(style,frame,bright) {
    const key=style+'-'+frame+'-'+Number(bright);
    if(cache.has(key))return cache.get(key);
    const surface=document.createElement('canvas');surface.width=surface.height=SIZE;
    const c=surface.getContext('2d'),pal=styles[style],t=(frame+.38)/FRAMES;
    c.translate(SIZE/2,SIZE/2);c.lineJoin='bevel';
    const ion=style==='ion',cryo=style==='cryo',spore=style==='spore',earth=style==='quake';
    // Ground ripple outruns the flame. Breaks in its circumference distinguish it from an attack warning.
    if(t<.60){
      const wave=4+36*(1-(1-clamp(t/.60))**2);
      c.globalAlpha=(bright?.70:.36)*(1-t/.60);
      for(let i=0;i<7;i++)ring(c,wave,i*TAU/7+.12,i*TAU/7+.74,bright?pal.hot:pal.mid,Math.max(1,3*(1-t/.6)),earth?.73:.92);
    }
    // Smoke cools, separates and rises. A clearing center leaves the battlefield readable.
    if(t>.10){
      const u=(t-.10)/.90;
      c.globalAlpha=(earth?.79:.64)*Math.sin(Math.PI*u)**.61;
      for(let i=0;i<(ion||cryo?5:9);i++){
        const a=i*2.399+.21,d=(9+noise(i,2)*13)*Math.sqrt(u);
        const x=Math.cos(a)*d+u*3,y=Math.sin(a)*d*.72-u*u*(9+noise(i,3)*13);
        const r=(3+noise(i,8)*6)*(1+.65*u);
        puff(c,x,y,r,pal.shadow);puff(c,x-1,y-r*.27,r*.78,pal.dust);
      }
    }
    c.globalAlpha=1;
    if((earth||spore)&&t<.67){
      const u=clamp(t/.67);
      for(let i=0;i<(earth?8:6);i++){
        const a=i*TAU/(earth?8:6)+.34,dx=Math.cos(a),dy=Math.sin(a);
        const travel=(18+noise(i,8)*16)*Math.sqrt(u),x=dx*travel,y=dy*travel*(earth?.78:1);
        c.globalAlpha=.95*(1-u*u);
        if(earth){
          const h=(4+noise(i,6)*8)*Math.sin(Math.PI*u),w=2+noise(i,7)*4;
          poly(c,[x-w,y,x-w*.7,y-h,x+w*.3,y-h*1.42,x+w,y-h*.35,x+w*.45,y+2],pal.rim);
          poly(c,[x-w*.7,y-h,x+w*.3,y-h*1.42,x+w,y-h*.35,x+w*.25,y-h*.48],bright?pal.hot:pal.mid);
        }else{
          const size=(1.8+noise(i,4)*2.2)*(1-.45*u);
          streak(c,x,y,a,7*(1-u),1,pal.rim);
          puff(c,x,y,size,pal.mid);c.fillStyle=bright?pal.hot:pal.rim;c.fillRect(Math.round(x-1),Math.round(y-1),2,1);
        }
      }
    }
    if(style==='thermal'&&t<.38){
      const u=t/.38;
      for(let i=0;i<9;i++){
        const a=i*TAU/9+.18,ext=(18+noise(i,6)*23)*Math.sqrt(u);
        c.globalAlpha=(1-u)*(bright?.89:.48);
        streak(c,Math.cos(a)*ext,Math.sin(a)*ext,a,ext*.75,1.7*(1-u)+.55,i%3?pal.mid:pal.hot);
      }
    }
    c.globalAlpha=1;
    if(!ion&&!cryo){
      const clusters=spore?7:earth?8:11;
      for(let i=clusters-1;i>=0;i--){
        const offset=noise(i,1)*.10,u=(t-offset)/(.49+noise(i,4)*.19);
        if(u<=0||u>=1)continue;
        const a=i*2.399+.53,d=(4+noise(i,5)*(earth?19:14))*(.32+.85*Math.sqrt(u));
        const x=Math.cos(a)*d,y=Math.sin(a)*d*.79-u*u*(spore?13:6);
        const r=(4+noise(i,7)*8)*Math.sin(Math.PI*u)**.57;
        puff(c,x,y,r,pal.rim);puff(c,x-.5,y-r*.22,r*.80,pal.mid);
        if(bright&&u<.74)puff(c,x-r*.20,y-r*.33,r*(.65-.4*u),pal.hot);
        if(spore){c.fillStyle=pal.shadow;c.fillRect(Math.round(x+r*.17),Math.round(y+r*.15),2,2);}
      }
    }else{
      const u=clamp(t/.72);
      for(let i=0;i<(cryo?12:7);i++){
        const a=i*TAU/(cryo?12:7)+noise(i,3)*.25,extent=(19+noise(i,9)*21)*Math.sqrt(u);
        const x=Math.cos(a)*extent,y=Math.sin(a)*extent;
        c.globalAlpha=(1-u)*.95;
        if(cryo){
          streak(c,x,y,a,(6+noise(i,4)*12)*(1-u),2.5*(1-u),pal.mid);
          if(bright)streak(c,x,y-1,a,6*(1-u),1,pal.core);
        }else{
          const bend=extent*.60,dx=Math.cos(a),dy=Math.sin(a);
          c.beginPath();c.moveTo(dx*4,dy*4);c.lineTo(dx*bend+dy*4,dy*bend-dx*4);
          c.lineTo(dx*bend-dy*2,dy*bend+dx*2);c.lineTo(x,y);c.strokeStyle=pal.mid;c.lineWidth=2;c.stroke();
          if(bright){c.strokeStyle=pal.core;c.lineWidth=.8;c.stroke();}
        }
      }
      if(ion&&u<.88){
        c.globalAlpha=(1-u)*.8;
        ring(c,6+29*Math.sin(Math.PI*u),.27,3.02,pal.hot,1.6,.34);
        ring(c,6+29*Math.sin(Math.PI*u),3.65,5.95,pal.mid,1.6,.34);
      }
    }
    // Sparks travel away from the center before gravity bends their trajectories.
    for(let i=0;i<17;i++){
      const u=(t-noise(i,10)*.13)/(.58+noise(i,11)*.25);
      if(u<=0||u>=1)continue;
      const a=i*2.399+.3,reach=(13+noise(i,12)*31)*(1-(1-u)**1.7);
      const x=Math.cos(a)*reach,y=Math.sin(a)*reach+u*u*(earth?17:8);
      c.globalAlpha=1-u*.83;
      if(earth||spore){
        const r=(2+noise(i,5)*1.8)*(1-.56*u);
        puff(c,x,y,r,pal.rim);c.fillStyle=pal.hot;c.fillRect(Math.round(x-r*.3),Math.round(y-r*.6),Math.ceil(r),1);
      }else streak(c,x,y,a,2+5*(1-u),1.4*(1-u)+.55,i%3||!bright?pal.mid:pal.core);
    }
    if(t<.29){
      const u=1-t/.29;
      c.globalAlpha=bright?.91:.45;
      puff(c,0,0,(bright?10:6)*u,bright?pal.hot:pal.mid);
      if(bright){
        poly(c,[-21*u,0,-3*u,-2*u,0,-9*u,2*u,-2*u,19*u,0,3*u,2*u,0,8*u,-2*u,2*u],pal.core);
      }
    }
    cache.set(key,surface);
    return surface;
  }
  function draw(ctx,fx,bright) {
    const t=clamp(fx.age/fx.duration),frame=Math.min(FRAMES-1,Math.floor(t*FRAMES));
    const img=cel(fx.style,frame,bright),side=Math.round(SIZE*fx.r/40);
    ctx.save();ctx.translate(Math.round(fx.x),Math.round(fx.y));
    if(fx.seed%2)ctx.scale(-1,1);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(img,-side/2,-side/2,side,side);ctx.restore();
  }
  function muzzle(c,p,w,d,bright){
    const family=d.familyIndex,t=clamp(w.flash/.09);
    const len=([13,18,21,18,9,8][family]+(w.id%3)*2)*(.35+.65*t),col=d.color;
    c.save();
    c.translate(Math.round(p.x),Math.round(p.y));c.rotate(p.a);
    c.translate(w.id===18?20:[24,23,26,23,23,21][family],w.id===18?-5:0);
    if(w.id===18)c.rotate(-.68*(Math.cos(p.a)<0?-1:1));
    if(!bright){c.globalAlpha*=.35;streak(c,4,0,0,4,1,col);c.restore();return;}
    c.globalAlpha*=.45+.48*t;
    if(family===1||family===3){
      for(const sign of [-1,1])streak(c,len*.72,sign*len*.39,sign*.48,len*.81,2,col);
    }else if(family===4||family===5){
      ring(c,4+t*2,-1.25,1.25,col,1.5);
    }
    streak(c,len,0,0,len+2,family===2?1.8:3.3,col);
    streak(c,len*.64,0,0,len*.67,1.4,'#fff4c9');c.restore();
  }
  window.BlastArt={draw,muzzle};
})();
