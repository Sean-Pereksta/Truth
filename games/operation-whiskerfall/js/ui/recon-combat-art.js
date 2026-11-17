(function () {
  'use strict';
  const W=window.OW, R=W.Renderer.prototype, TAU=Math.PI*2;
  W.Assets.reconPatrol='assets/recon/patrol.webp';
  W.Assets.reconThreats='assets/recon/threats.webp';
  W.Assets.reconCasualties='assets/recon/casualties.webp';
  W.Assets.reconCommander='assets/recon/whisker.webp';
  const frame=R.illustratedEnemyFrame;
  R.illustratedEnemyFrame=function(e){
    const commander=e.bossIndex===8 && e.boss,def=W.Content.enemies[e.type];
    if(!commander && (!def?.reconRole || e.boss || e.dungeonBoss))return frame.apply(this,arguments);
    const fallen=e.hp<=0 || e.anim==='death', hurt=e.hit>.04 || e.freeze>0 || e.stun>0;
    const attack=e.combatState==='commit',windup=e.combatState==='windup';
    let key='reconPatrol',row=def?.artRow||0,col=attack?2:windup?1:e.combatState==='recovery'?3:0,cols=4,rows=6;
    if(commander){
      key='reconCommander';row=W.clamp((e.phase||1)-1,0,3);rows=4;
      if(fallen || hurt)col=3;
    }else if(fallen || hurt){
      key='reconCasualties';col=fallen?1:0;cols=2;
    }
    const size=commander?142:102;
    return {key,art:true,reconArt:true,col,row,cols,rows,w:size,h:size};
  };
  const illustrated=R.drawIllustratedEnemy;
  R.drawIllustratedEnemy=function(e,f=this.illustratedEnemyFrame(e),opts={}){
    if(!f?.reconArt)return illustrated.apply(this,arguments);
    if(!this.images[f.key])return false;
    const run=f.col===0 && e.anim==='run' && Math.hypot(e.velocityX||0,e.velocityY||0)>8;
    const bob=run?Math.abs(Math.sin((e.moveTime||0)*10))*3:0;
    this.sprite(f.key,f.col,f.row,f.cols,f.rows,e.x,e.y+3-bob,f.w,f.h,
      {py:164/170,flip:Math.cos(e.angle||0)<0,angle:opts.angle||0,alpha:opts.alpha??1});
    return true;
  };
  function path(c,s) {
    c.beginPath();
    if(s.kind==='lane') {
      if(s.roundCaps){c.moveTo(0,-s.halfWidth);c.arc(s.length,0,s.halfWidth,-Math.PI/2,Math.PI/2);c.arc(0,0,s.halfWidth,Math.PI/2,Math.PI*1.5);c.closePath();}
      else c.rect(0,-s.halfWidth,s.length,s.halfWidth*2);
      return;
    }
    if(s.kind==='disc') {c.arc(0,0,s.radius,0,TAU);return;}
    c.moveTo((s.inner||0)*Math.cos(-s.arc/2),(s.inner||0)*Math.sin(-s.arc/2));
    c.arc(0,0,s.radius,-s.arc/2,s.arc/2);
    if(s.inner)c.arc(0,0,s.inner,s.arc/2,-s.arc/2,true);else c.lineTo(0,0);
    c.closePath();
  }
  function stamp(r,id,x,y,w,h,alpha=1) {
    if(r.images.reconThreats)r.sprite('reconThreats',id%4,Math.floor(id/4),4,2,x,y,w,h,{alpha});
  }
  function mark(r,s,ratio,second) {
    const c=r.ctx,hi=r.game.settings?.highContrastWarnings;
    const bright=hi?'#ffed55':s.stamp===6?'#c7f7e4':second?'#ffe3a2':'#ffb187';
    c.save();c.translate(s.x,s.y);c.rotate(s.angle);
    path(c,s);
    c.fillStyle=hi?'rgba(20,13,10,.68)':s.stamp===6?'rgba(23,98,104,.38)':'rgba(143,41,29,.27)';
    c.fill();c.save();c.clip();
    if(s.kind==='lane'){
      for(let n=25;n<s.length+30;n+=58)stamp(r,1,n,0,46,s.halfWidth*1.85,.55+ratio*.45);
    }else{
      c.save();if(s.stamp===3)c.rotate(Math.PI);
      stamp(r,s.stamp,0,0,s.radius*2,s.radius*2,.65+ratio*.33);c.restore();
      if(s.stamp===6){
        c.strokeStyle=bright;c.lineWidth=2;c.globalAlpha=.48;
        for(let x=-s.radius*2;x<s.radius*2;x+=15){c.beginPath();c.moveTo(x,-s.radius);c.lineTo(x+s.radius,s.radius);c.stroke();}
      }
    }
    c.restore();path(c,s);c.lineWidth=hi?6:4;c.strokeStyle='#261d22';c.stroke();
    c.strokeStyle=bright;c.lineWidth=hi?3:2;if(second)c.setLineDash([8,5]);c.stroke();c.setLineDash([]);
    // The interior mark closes toward impact without moving the outer edge.
    c.globalAlpha=.88;c.lineWidth=2;c.strokeStyle=bright;
    if(s.kind==='lane'){const x=ratio*s.length;c.beginPath();c.moveTo(x,-s.halfWidth);c.lineTo(x,s.halfWidth);c.stroke();}
    else {c.scale(Math.max(.04,1-ratio),Math.max(.04,1-ratio));path(c,s);c.stroke();}
    c.restore();
  }
  function link(r,e,ally) {
    const d=Math.hypot(ally.x-e.x,ally.y-e.y),c=r.ctx;
    c.save();c.translate(e.x,e.y);c.rotate(Math.atan2(ally.y-e.y,ally.x-e.x));
    c.strokeStyle='#ffe5ab';c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();c.moveTo(0,0);c.lineTo(d,0);c.stroke();
    stamp(r,5,d/2,0,d,17,.94);c.restore();
  }
  const boundaries=R.drawCampaignBoundaries;
  R.drawCampaignBoundaries=function(world){
    boundaries.call(this,world);
    for(const e of world.activeEnemies||[]){
      const state=W.ReconCombat.record(e),a=state?.action;
      if(!a || state.world!==world || e.dead || e.hp<=0)continue;
      for(const ally of a.links||[])if(ally.hp>0&&!ally.dead)link(this,e,ally);
      // Repeated shots in one locked lane share a boundary. Separate shapes
      // for simultaneous beats and landings stay visible from commitment.
      const drawn=new Set();
      for(let i=0;i<a.beats.length;i++){
        const b=a.beats[i];
        if(b.spent || drawn.has(b.shape) || (b.source && (b.source.hp<=0||b.source.dead)))continue;
        drawn.add(b.shape);mark(this,b.shape,Math.min(.999,a.elapsed/b.at),drawn.size>1);
      }
      if(a.beats.some(b=>!b.spent)){
        const ticks=a.beats.map(b=>b.spent?'●':'○').join('');
        this.worldLabel(a.name+'  '+ticks,e.x,e.y+23,'#ffedbf',11);
      }
    }
  };
  const drawActor=R.drawActor;
  R.drawActor=function(e,player,...rest){
    const result=drawActor.call(this,e,player,...rest);
    if(!player && e.hp>0 && (e.reconRelay || ((e.bossIndex===8 || W.Content.enemies[e.type]?.reconRole) && e.combatState==='recovery'))){
      this.worldLabel(e.reconRelay?'COMMAND RELAY':'EXPOSED',e.x,e.y+20,e.reconRelay?'#fbd875':'#b6f2c9',10);
    }
    return result;
  };
  const drawEffect=R.drawEffect;
  R.drawEffect=function(e,front){
    if(e.type==='defeat' && e.reconCommanderPhase){
      if(front && this.images.reconCommander){
        const actor={type:e.typeIndex,boss:true,bossIndex:8,phase:e.reconCommanderPhase,anim:'death',angle:e.reconFacing,x:e.x,y:e.y};
        const elapsed=1-W.clamp(e.life/e.maxLife,0,1);this.drawIllustratedEnemy(actor,this.illustratedEnemyFrame(actor),{alpha:1-elapsed,angle:elapsed*.35});
        return;
      }
    }
    if(front && this.game.settings?.reducedFlash){
      if(['muzzle','impact','combatImpact','reconImpact'].includes(e.type))return;
      if(e.type==='lightning' && Number.isFinite(e.tx)){
        const c=this.ctx;c.save();c.globalAlpha=.55;c.strokeStyle='#a9ccce';c.lineWidth=2;c.beginPath();c.moveTo(e.x,e.y-15);c.lineTo(e.tx,e.ty-15);c.stroke();c.restore();return;
      }
    }
    if(!front && (e.type==='chargeLane'||e.type==='prismLane'&&e.warning)){
      const dx=e.tx-e.x,dy=e.ty-e.y;
      const s={kind:'lane',x:e.x,y:e.y,angle:Math.atan2(dy,dx),length:Math.hypot(dx,dy),halfWidth:e.radius||40,stamp:1,roundCaps:true};
      mark(this,s,W.clamp(1-e.life/e.maxLife,0,1),false);return;
    }
    if(!front && e.type==='telegraph' && e.movement && !e.guardianId){
      mark(this,{kind:'disc',x:e.x,y:e.y,angle:0,radius:e.radius,stamp:4},W.clamp(1-e.life/e.maxLife,0,1),false);return;
    }
    if(e.type!=='reconImpact')return drawEffect.call(this,e,front);
    if(front && !this.game.settings?.reducedFlash)stamp(this,7,e.x,e.y,e.radius*2,e.radius*2,W.clamp(e.life/e.maxLife,0,1));
  };
  const menu=W.UI.prototype.settingsMenu;
  W.UI.prototype.settingsMenu=function(){
    const settings=this.game.settings;
    const controls=[
      ['highContrastWarnings','High-contrast attack warnings',!!settings.highContrastWarnings],
      ['longWarnings','Longer reconnaissance windups (+50%)',!!settings.longWarnings],
      ['reducedFlash','Reduce impact flashes',!!settings.reducedFlash],
      ['screenShake','Camera shake',settings.screenShake!==false]
    ].map(([key,label,checked])=>'<label class="setting"><span>'+label+'</span><input type="checkbox" data-setting="'+key+'" '+(checked?'checked':'')+'></label>').join('');
    return menu.call(this).replace('</section>',controls+'</section>');
  };
})();
