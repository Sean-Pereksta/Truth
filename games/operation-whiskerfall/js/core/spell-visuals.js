(function(){
  'use strict';
  const W=window.OW,R=W.Renderer.prototype,TAU=Math.PI*2;
  W.Assets=W.Assets||{};W.Assets.spellEffects='assets/abilities/spell-effects.png';
  R.drawSpellSprite=function(index,x,y,width,height,options={}){
    const image=this.images?.spellEffects;if(!image||!image.width||!image.height)return false;
    const c=this.ctx,sw=image.width/4,sh=image.height/3;
    c.save();c.translate(x,y);if(options.angle)c.rotate(options.angle);c.globalAlpha*=options.alpha??1;
    c.drawImage(image,index%4*sw,Math.floor(index/4)*sh,sw,sh,-width/2,-height*(options.py??.5),width,height);c.restore();return true;
  };
  const draw=R.drawEffect;
  R.drawEffect=function(e,front){
    if(!this.images?.spellEffects)return draw.call(this,e,front);
    const c=this.ctx,t=1-W.clamp(e.life/(e.maxLife||1),0,1),age=(e.maxLife||1)-e.life,fade=Math.min(1,e.life*3),r=e.radius||60;
    if(e.type==='aegisField'){
      if(!front)return;
      this.drawSpellSprite(0,e.x,e.y-29,148,157,{alpha:.62*fade});
      c.save();c.globalAlpha=.55*fade;c.strokeStyle='#c4f4ff';c.lineWidth=1.5;c.beginPath();c.ellipse(e.x,e.y+2,53,22,0,0,TAU);c.stroke();c.restore();return;
    }
    if(e.type==='mirrorWard'){
      // A split orbit gives the ward depth around its owner without hiding them.
      for(let i=0;i<6;i++){const a=age*.8+i*TAU/6;if((Math.sin(a)>=0)!==!!front)continue;this.drawSpellSprite(3,e.x+Math.cos(a)*r*.65,e.y-28+Math.sin(a)*r*.4,47,55,{alpha:.72*fade,angle:Math.sin(a)*.16});}return;
    }
    if(e.type==='gravityWell'){
      if(front)return;this.drawSpellSprite(2,e.x,e.y,r*2.05,r*1.5,{alpha:.77*fade,angle:Math.sin(age)*.04});
      c.save();c.globalAlpha=.45*fade;c.strokeStyle='#d7b9ff';c.lineWidth=1.4;for(let i=0;i<8;i++){const a=-age*1.7+i*TAU/8,rr=r*(.22+((age*.3+i/8)%1)*.65);c.beginPath();c.arc(e.x+Math.cos(a)*rr,e.y+Math.sin(a)*rr*.65,2+i%2,0,TAU);c.stroke();}c.restore();return;
    }
    if(e.type==='revivalBeacon'){
      if(!front){draw.call(this,e,false);this.drawSpellSprite(6,e.x,e.y,r*1.5,r*.8,{alpha:.3*fade});this.drawSpellSprite(8,e.x,e.y+10,105,150,{py:.88,alpha:.88*fade});}return;
    }
    if(e.type==='orbitBlades'){
      for(let i=0;i<4;i++){const a=age*4+i*TAU/4;if((Math.sin(a)>=0)!==!!front)continue;const x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r-12;this.drawSpellSprite(9,x,y,62,42,{angle:a+Math.PI/2,alpha:fade});}return;
    }
    if(e.type==='overdrive'){
      if(!front)return;this.drawSpellSprite(6,e.x,e.y-22,112,108,{alpha:fade*(.4+Math.sin(age*9)*.08),angle:age*.3});return;
    }
    if(e.type==='supplyDrop'){
      if(!front)return;const lift=Math.max(0,1-t*5)*65;this.drawSpellSprite(7,e.x,e.y-18-lift,90,82,{alpha:fade});return;
    }
    draw.call(this,e,front);
    if(e.type==='frostNova'&&!front){const radius=r*Math.min(1,t*2);for(let i=0;i<10;i++){const a=i*TAU/10;this.drawSpellSprite(1,e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius*.7,50,53,{py:.8,alpha:Math.sin(Math.PI*t)*.85});}}
    if(e.type==='dashTrail'&&front){const dx=e.tx-e.x,dy=e.ty-e.y;this.drawSpellSprite(11,(e.x+e.tx)/2,(e.y+e.ty)/2-19,Math.max(65,Math.min(340,Math.hypot(dx,dy))),56,{angle:Math.atan2(dy,dx),alpha:(1-t)*.7});}
    if(e.type==='siphonLink'&&front){const q=t,x=e.x+(e.tx-e.x)*q,y=e.y+(e.ty-e.y)*q-24-Math.sin(q*Math.PI)*38;this.drawSpellSprite(4,x,y,57,42,{angle:Math.atan2(e.ty-e.y,e.tx-e.x),alpha:(1-t)*.85});}
    if(e.type==='grappleLine'&&front)this.drawSpellSprite(10,e.tx,e.ty-20,51,37,{angle:Math.atan2(e.ty-e.y,e.tx-e.x),alpha:1-t});
    if(e.type==='abilityCast'&&!front){
      const color=e.color||'#b4e9d5',radius=30+t*25;c.save();c.globalAlpha=(1-t)*.55;c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.5;
      for(let i=0;i<8;i++){const a=i*TAU/8+(e.angle||0),x=e.x+Math.cos(a)*radius,y=e.y+Math.sin(a)*radius*.52;c.beginPath();c.moveTo(x,y-4-t*10);c.lineTo(x+2,y-t*10);c.lineTo(x,y+4-t*10);c.lineTo(x-2,y-t*10);c.closePath();c.fill();}c.restore();
    }
  };
  const projectile=R.drawProjectile;
  if(projectile)R.drawProjectile=function(p){
    if(p.owner>=0&&p.poison&&this.drawSpellSprite(5,p.x,p.y-12,37,21,{angle:Math.atan2(p.vy,p.vx),alpha:.92}))return;
    return projectile.call(this,p);
  };
})();
