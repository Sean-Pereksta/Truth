(function(){
  'use strict';
  const W=window.OW,R=W.Renderer?.prototype,TAU=Math.PI*2;
  const frames=[[30,190,403,172],[533,90,300,339],[927,82,359,342],[1352,161,395,236],[37,567,393,205],[508,490,354,348],[944,493,335,340],[1385,511,346,320]];
  W.Assets.krakenEffects='assets/expeditions/kraken-effects.png';
  const ready=r=>{const i=r.images?.krakenEffects;return !!i&&i.complete!==false&&i.naturalWidth!==0;};
  function sprite(r,n,x,y,width,height,angle=0,alpha=1,ax=.5,ay=.5){
    if(!ready(r))return false;const c=r.ctx,f=frames[n];c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=W.clamp(alpha,0,1);c.drawImage(r.images.krakenEffects,...f,-width*ax,-height*ay,width,height);c.restore();return true;
  }
  function waveSegments(radius,gapAngle,gapHalf){
    const span=TAU-gapHalf*2,count=Math.min(32,Math.max(4,Math.ceil(radius*span/78)));
    return Array.from({length:count},(_,i)=>gapAngle+gapHalf+(i+.5)*span/count);
  }
  function wave(r,f){
    const c=r.ctx,t=W.clamp((f.maxLife-f.life)/f.maxLife,0,1),radius=f.fromRadius+(f.toRadius-f.fromRadius)*t,start=f.gapAngle+f.gapHalf,end=f.gapAngle+TAU-f.gapHalf;
    // Clip both the foam and the translucent body to the live damage band and
    // its safe opening. Painted wave tips cannot spill across an escape gap.
    c.save();c.beginPath();c.arc(f.x,f.y,radius+22,start,end);c.arc(f.x,f.y,Math.max(1,radius-22),end,start,true);c.closePath();c.clip();
    const angles=waveSegments(radius,f.gapAngle,f.gapHalf),width=Math.max(65,radius*(end-start)/angles.length*1.3);
    for(const a of angles)sprite(r,3,f.x+Math.cos(a)*radius,f.y+Math.sin(a)*radius,width,58,a+Math.PI/2,.9);
    c.restore();
  }
  if(R){
    const effect=R.drawEffect;
    R.drawEffect=function(f,front=false){
      if(!ready(this))return effect.apply(this,arguments);
      const t=W.clamp(1-(f.life||0)/(f.maxLife||1),0,1),fade=Math.min(1,(1-t)*4);
      if(f.type==='krakenTell'){
        const result=effect.apply(this,arguments);
        if(front)return result;
        if(f.shape==='lane')sprite(this,1,f.x,f.y+12,60,112,0,.25+.32*t,.5,1);
        else if(f.shape==='circle')sprite(this,1,f.x,f.y,70,104,Math.sin(t*5)*.06,.16+.25*t,.5,1);
        else if(f.shape==='ring')sprite(this,5,f.x,f.y,135+20*t,135+20*t,-t*.4,.25);
        else if(f.shape==='fan')sprite(this,5,f.x,f.y-65,90,90,t*.6,.35);
        return result;
      }
      if(f.type==='krakenImpact'){
        if(front)return;
        if(f.kind==='lane'){
          const angle=Math.atan2(f.ty-f.y,f.tx-f.x),length=Math.hypot(f.tx-f.x,f.ty-f.y),reach=.82+.18*Math.sin(Math.PI*Math.min(1,t*2));
          const c=this.ctx;c.save();c.translate(f.x,f.y);c.rotate(angle);c.beginPath();c.rect(0,-f.width,length,f.width*2);c.clip();sprite(this,0,0,0,length*reach,f.width*2,0,fade,0,.5);c.restore();
          sprite(this,2,f.tx,f.ty,75+30*t,60+20*t,t*.15,fade*.72);
        }else{
          const size=f.radius*2*(.82+t*.25);sprite(this,2,f.x,f.y,size,size,t*.3,fade);sprite(this,6,f.x,f.y+12,size*.6,size*.85,0,fade*.65,.5,.86);
        }
        return;
      }
      if(f.type==='krakenRing'){
        if(front)return;effect.apply(this,arguments);wave(this,f);return;
      }
      if(f.type==='expeditionGrasp'){
        if(!front)return;sprite(this,1,f.x,f.y+12,76,108*(.85+Math.sin(Math.PI*t)*.15),-.2,fade*.85,.5,1);sprite(this,2,f.x,f.y+6,66,38,t,fade*.4);return;
      }
      if(f.type==='expeditionInk'){
        if(front)return;effect.apply(this,arguments);sprite(this,5,f.x,f.y,180,130,t*.5,.35*fade);return;
      }
      return effect.apply(this,arguments);
    };
    const projectile=R.drawProjectile;
    R.drawProjectile=function(p){
      if(!p.krakenOwner||!ready(this))return projectile.apply(this,arguments);
      // Anchor the glowing head to the projectile; the painted tail trails it.
      sprite(this,4,p.x,p.y-(p.visualHeight??12),48,25,Math.atan2(p.vy||0,p.vx||0),.95,.82,.5);
    };
  }
  W.KrakenEffects={frames,ready,sprite,waveSegments,wave};
})();
