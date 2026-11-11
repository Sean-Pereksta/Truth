(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,TAU=Math.PI*2;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),living=e=>e&&e.hp>0&&!e.dead;
  function initialize(p){
    p.unlockedAbilities=Array.isArray(p.unlockedAbilities)?p.unlockedAbilities.filter(id=>W.Content.abilities.some(a=>a.id===id&&a.unlockCost>0)):[];
    p.abilityCooldowns=p.abilityCooldowns&&typeof p.abilityCooldowns==='object'?p.abilityCooldowns:{};
    for(const [id,time]of Object.entries(p.abilityCooldowns))if(!W.Content.abilities.some(a=>a.id===id)||!Number.isFinite(time)||time<0)delete p.abilityCooldowns[id];
    if(p.skillBookVersion!==1){
      p.skillPoints=Math.max(0,p.skillPoints||0)+3+Math.max(0,(p.level||1)-1);p.skillBookVersion=1;
      for(const slot of ['ability','ability2']){const a=W.Content.abilities[p[slot]],time=p.cooldowns?.[slot];if(a&&Number.isFinite(time)&&time>0)p.abilityCooldowns[a.id]=Math.max(p.abilityCooldowns[a.id]||0,time);}
    }
  }
  G.abilityStatus=function(p,index){
    const a=W.Content.abilities[index];if(!p||!a||!Number.isInteger(Number(index)))return{unlocked:false,canUnlock:false,cost:0,level:1,reason:'Unknown ability.'};
    const cost=a.unlockCost||0,level=a.level||1,eligible=p.level>=level,learned=!cost||(p.unlockedAbilities||[]).includes(a.id),unlocked=eligible&&learned,canUnlock=eligible&&!learned&&(p.skillPoints||0)>=cost;
    return{unlocked,canUnlock,cost,level,reason:!eligible?'Reach level '+level:unlocked?(cost?'Learned':'Unlocked by hero level'):canUnlock?'Learn for '+cost+' skill point'+(cost===1?'':'s'):'Need '+cost+' skill points'};
  };
  G.unlockAbility=function(playerIndex,index){const p=this.players[playerIndex],a=W.Content.abilities[index];if(!p||!a)return false;initialize(p);const state=this.abilityStatus(p,index);if(state.unlocked)return true;if(!state.canUnlock){this.ui.toast(state.reason,'error');return false;}p.skillPoints-=state.cost;p.unlockedAbilities.push(a.id);this.audio.play('level');this.ui.toast(a.name+' learned. Choose a primary or secondary slot.','ability');this.save(false);return true;};
  G.equipAbility=function(playerIndex,index,slot='ability'){const p=this.players[playerIndex];if(!p||!['ability','ability2'].includes(slot))return false;initialize(p);const status=this.abilityStatus(p,index);if(!status.unlocked){this.ui.toast(status.reason,'error');return false;}p[slot]=Number(index);p.cooldowns[slot]=Math.max(p.cooldowns[slot]||0,p.abilityCooldowns[W.Content.abilities[index].id]||0);this.ui.toast(W.Content.abilities[index].name+' equipped');this.save(false);return true;};
  G.cycleAbility=function(p,slot='ability',direction=1){if(!p||!['ability','ability2'].includes(slot))return false;const choices=W.Content.abilities.map((a,i)=>i).filter(i=>this.abilityStatus(p,i).unlocked);if(!choices.length)return false;const current=choices.indexOf(p[slot]),next=choices[(current+(direction<0?-1:1)+choices.length)%choices.length];return this.equipAbility(p.id,next,slot);};
  const load=G.load;G.load=function(slot=0){const before=W.Save.read(slot),ok=load.call(this,slot);if(!ok)return false;for(const [i,p]of this.players.entries()){if(before?.players?.[i]?.skillBookVersion!==1)p.skillBookVersion=0;initialize(p);for(const [field,type,radius]of [['aegisTime','aegisField',65],['mirrorWardTime','mirrorWard',115],['overdriveTime','overdrive',50]])if(p[field]>0)this.effect(type,p.x,p.y,radius,p[field],{owner:p.id});}if(this.reservePlayer){if(before?.reservePlayer?.skillBookVersion!==1)this.reservePlayer.skillBookVersion=0;initialize(this.reservePlayer);}this.restoreCommanderRewards();return true;};
  function aimPoint(g,p,range){let end={x:p.x,y:p.y};for(let d=25;d<=range;d+=25){const next={x:p.x+Math.cos(p.angle)*d,y:p.y+Math.sin(p.angle)*d};if(g.world.isBlocked(next.x,next.y,18)||g.pointLocked(next.x,next.y))break;end=next;}return end;}
  function targets(g,p,radius,arc=Math.PI){return g.grid.query(p.x,p.y,radius).filter(e=>living(e)&&distance(e,p)<=radius&&!g.pointLocked(e.x,e.y)&&g.lineOfSight(p,e)&&Math.abs(W.wrapAngle(Math.atan2(e.y-p.y,e.x-p.x)-p.angle))<=arc).sort((a,b)=>distance(a,p)-distance(b,p));}
  const use=G.useAbility;
  G.useAbility=function(p,slot='ability'){
    if(!p||p.downed||!['ability','ability2'].includes(slot)||(p.meleeCommit||0)>0)return false;
    initialize(p);const a=W.Content.abilities[p[slot]];if(!a||!this.abilityStatus(p,p[slot]).unlocked)return false;
    if((p.cooldowns[slot]||0)>0||(p.abilityCooldowns[a.id]||0)>0||(p.jamTime||0)>0)return false;
    if(!a.unlockCost){const before=p.cooldowns[slot]||0;use.call(this,p,slot);if(p.cooldowns[slot]>before){p.abilityCooldowns[a.id]=p.cooldowns[slot];this.effect('abilityCast',p.x,p.y,48,.6,{kind:a.kind,color:a.color,angle:p.angle});return true;}return false;}
    const damage=(a.damage||0)*(1+p.level*.08+(p.skills.tactics||0)*.08),radius=a.radius||200,point=aimPoint(this,p,310);let cast=true;
    switch(a.kind){
      case'dashstep':{const old={x:p.x,y:p.y};this.move(p,Math.cos(p.angle)*radius,Math.sin(p.angle)*radius,19);p.invuln=Math.max(p.invuln||0,.38);this.effect('dashTrail',old.x,old.y,0,.38,{tx:p.x,ty:p.y,color:a.color});this.audio.play('dash');break;}
      case'aegis':p.aegisHp=p.maxHp*.7+40;p.aegisTime=8;this.effect('aegisField',p.x,p.y,65,8,{owner:p.id});break;
      case'frostnova':for(const e of targets(this,p,radius)){this.damageEnemy(e,damage,p);e.chillTime=4;if(!e.boss&&e.combatState!=='rolling')e.freeze=Math.max(e.freeze||0,2.2);}this.effect('frostNova',p.x,p.y,radius,.8,{color:'#9eeaff'});break;
      case'gravitywell':this.effect('gravityWell',point.x,point.y,radius,5,{owner:p.id,damage,tick:0});break;
      case'mirrorward':p.mirrorWardTime=4;this.effect('mirrorWard',p.x,p.y,radius,4,{owner:p.id});break;
      case'siphon':{let drained=0;const foes=targets(this,p,radius,.8).slice(0,3);if(!foes.length){cast=false;break;}for(const e of foes){const hp=e.hp;this.damageEnemy(e,damage,p);drained+=Math.max(0,hp-Math.max(0,e.hp));this.effect('siphonLink',e.x,e.y,0,.6,{tx:p.x,ty:p.y,color:'#efa2b8'});}p.hp=Math.min(p.maxHp,p.hp+drained*.3);break;}
      case'venomfan':for(let i=0;i<7;i++){const angle=p.angle+(i-3)*.16;this.bulletPool.take({x:p.x+Math.cos(angle)*26,y:p.y+Math.sin(angle)*26,vx:Math.cos(angle)*740,vy:Math.sin(angle)*740,life:1,owner:p.id,damage,kind:'bullet',radius:5,poison:true,pierce:1,color:'#b5dc80'});}this.audio.play('plasma');break;
      case'overdrive':p.overdriveTime=6;this.effect('overdrive',p.x,p.y,50,6,{owner:p.id});break;
      case'supply':for(const ally of this.players)if(!ally.downed&&distance(p,ally)<=radius){ally.reserve=Math.min(1200,ally.reserve+200);ally.medkits=Math.min(20,ally.medkits+1);ally.grenades=Math.min(30,ally.grenades+2);}this.effect('heal',p.x,p.y,radius,1.3);this.effect('supplyDrop',p.x,p.y,32,1.3,{color:a.color});this.audio.play('pickup');break;
      case'revivebeacon':this.effect('revivalBeacon',p.x,p.y,radius,5,{owner:p.id,tick:0,revives:{}});this.audio.play('heal');break;
      case'orbitblades':this.effect('orbitBlades',p.x,p.y,radius,8,{owner:p.id,damage,hitTimes:{}});break;
      case'grapple':{const e=targets(this,p,radius,.45).find(e=>!e.boss);if(!e){cast=false;break;}const d=distance(e,p),pull=Math.min(320,Math.max(0,d-75)),angle=Math.atan2(p.y-e.y,p.x-e.x);this.move(e,Math.cos(angle)*pull,Math.sin(angle)*pull,19);this.damageEnemy(e,damage,p);e.stun=Math.max(e.stun||0,.5);this.effect('grappleLine',p.x,p.y,0,.4,{tx:e.x,ty:e.y,color:a.color});break;}
      default:cast=W.RareAbilities?.cast?.(this,p,a,slot)===true;
    }
    if(!cast){if((p.abilityNotice||0)<=this.time){this.ui.toast('Aim at a reachable enemy to use '+a.name+'.');p.abilityNotice=this.time+1;}return false;}
    this.effect('abilityCast',p.x,p.y,48,.6,{kind:a.kind,color:a.color,angle:p.angle});p.cooldowns[slot]=a.cooldown/(1+(p.skills.tactics||0)*.065);p.abilityCooldowns[a.id]=p.cooldowns[slot];this.setAnim(p,'ability');this.ui.toast(a.name,'ability');this.alertEnemies(p.x,p.y,750);return true;
  };
  const updatePlayer=G.updatePlayer;G.updatePlayer=function(p,input,dt){
    initialize(p);for(const id of Object.keys(p.abilityCooldowns))p.abilityCooldowns[id]=Math.max(0,p.abilityCooldowns[id]-dt);
    for(const key of ['aegisTime','mirrorWardTime','overdriveTime'])p[key]=Math.max(0,(p[key]||0)-dt);if(!p.aegisTime)p.aegisHp=0;
    // Scene changes rebuild the effect pool while the hero's timed buffs survive.
    for(const [field,type,radius]of [['aegisTime','aegisField',65],['mirrorWardTime','mirrorWard',115],['overdriveTime','overdrive',50]])if(p[field]>0&&!this.effects.some(e=>e.alive&&e.type===type&&e.owner===p.id))this.effect(type,p.x,p.y,radius,p[field],{owner:p.id});
    return updatePlayer.call(this,p,input,dt);
  };
  const damagePlayer=G.damagePlayer;G.damagePlayer=function(p,amount,source){
    if(!p.campProxy&&p.aegisTime>0&&p.aegisHp>0&&!p.downed&&p.invuln<=0&&p.smokeTime<=0&&!this.safeZoneAt(p.x,p.y)){const absorbed=Math.min(p.aegisHp,amount);p.aegisHp-=absorbed;amount-=absorbed;this.effect('impact',p.x,p.y,24,.2);if(p.aegisHp<=0)p.aegisTime=0;if(amount<=0)return;}
    return damagePlayer.call(this,p,amount,source);
  };
  const shoot=G.shoot;G.shoot=function(p,...args){const ammo=p.ammo,result=shoot.call(this,p,...args);if(p.overdriveTime>0&&p.ammo<ammo)p.fireTimer*=.55;return result;};
  const updateProjectiles=G.updateProjectiles;G.updateProjectiles=function(dt){
    for(const p of this.players)if(!p.downed&&p.mirrorWardTime>0)for(const b of this.projectiles)if(b.alive&&b.owner<0){const dx=b.vx*dt,dy=b.vy*dt,t=W.clamp(((p.x-b.x)*dx+(p.y-b.y)*dy)/(dx*dx+dy*dy||1),0,1),near=Math.hypot(b.x+dx*t-p.x,b.y+dy*t-p.y);if(near<=115&&this.lineOfSight(p,b)){b.owner=p.id;b.vx=-b.vx;b.vy=-b.vy;b.damage=Math.min(180,b.damage);b.kind='bullet';b.life=Math.max(.5,b.life);b.homing=false;b.hitIds=[];b.color='#cef8eb';this.effect('impact',b.x,b.y,22,.2);}}
    return updateProjectiles.call(this,dt);
  };
  const updateEffects=G.updateEffects;G.updateEffects=function(dt){
    for(const effect of this.effects){if(!effect.alive)continue;const p=this.players[effect.owner];
      if(['aegisField','mirrorWard','overdrive','orbitBlades'].includes(effect.type)){if(!p||p.downed){effect.alive=false;continue;}effect.x=p.x;effect.y=p.y;}
      if(effect.type==='aegisField'&&!(p.aegisTime>0&&p.aegisHp>0))effect.alive=false;
      if(effect.type==='gravityWell'){
        effect.tick=(effect.tick||0)-dt;const pulse=effect.tick<=0;if(pulse)effect.tick=.5;
        for(const e of this.grid.query(effect.x,effect.y,effect.radius))if(living(e)&&distance(e,effect)<effect.radius&&this.lineOfSight(effect,e)){if(!e.boss&&e.combatState!=='rolling'){const a=Math.atan2(effect.y-e.y,effect.x-e.x);this.move(e,Math.cos(a)*dt*180,Math.sin(a)*dt*180,18);e.chillTime=Math.max(e.chillTime||0,.4);}if(pulse)this.damageEnemy(e,effect.damage,p);}
      }
      if(effect.type==='revivalBeacon')for(const ally of this.players){if(distance(effect,ally)>effect.radius){effect.revives[ally.id]=0;continue;}if(ally.downed){effect.revives[ally.id]=(effect.revives[ally.id]||0)+dt;if(effect.revives[ally.id]>=2){ally.downed=false;ally.hp=ally.maxHp*.4;ally.revive=0;ally.invuln=2;this.audio.play('revive');this.audio.vocal?.('cat_happy',ally,this);}}else ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.045*dt);}
      if(effect.type==='orbitBlades'){
        const elapsed=effect.maxLife-effect.life;for(let i=0;i<4;i++){const a=elapsed*4+i*TAU/4,x=p.x+Math.cos(a)*effect.radius,y=p.y+Math.sin(a)*effect.radius;for(const e of this.grid.query(x,y,42))if(living(e)&&Math.hypot(e.x-x,e.y-y)<42&&(effect.hitTimes[e.id]||0)<=elapsed&&this.lineOfSight(p,e)){this.damageEnemy(e,effect.damage,p);effect.hitTimes[e.id]=elapsed+.45;}}
      }
    }
    return updateEffects.call(this,dt);
  };
  const drawEffect=R.drawEffect;R.drawEffect=function(e,front){
    if(['abilityCast','dashTrail','frostNova','siphonLink','grappleLine','supplyDrop'].includes(e.type)){
      const floor=e.type==='abilityCast'||e.type==='frostNova';if(front===floor)return;
      const c=this.ctx,t=1-W.clamp(e.life/e.maxLife,0,1),color=e.color||'#b8eacb';c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2.5;c.lineCap='round';c.globalAlpha=(1-t)*.8;
      if(e.type==='abilityCast'){
        const r=e.radius*(.7+t*.5);c.beginPath();c.ellipse(e.x,e.y+3,r,r*.52,0,0,TAU);c.stroke();
        for(let i=0;i<3;i++){const a=(e.angle||0)+i*TAU/3+t*.7;c.beginPath();c.arc(e.x+Math.cos(a)*r,e.y+3+Math.sin(a)*r*.52,3.5,0,TAU);c.fill();}
      }else if(e.type==='dashTrail'){
        const a=Math.atan2(e.ty-e.y,e.tx-e.x);for(let i=-1;i<=1;i++){const dx=Math.sin(a)*i*10,dy=-Math.cos(a)*i*10;c.lineWidth=i?2:6;c.beginPath();c.moveTo(e.x+dx,e.y-18+dy);c.lineTo(e.tx+dx,e.ty-18+dy);c.stroke();}
        for(let i=1;i<=3;i++){const q=i/4,x=e.x+(e.tx-e.x)*q,y=e.y+(e.ty-e.y)*q-19;c.beginPath();c.moveTo(x+Math.cos(a-2.5)*12,y+Math.sin(a-2.5)*12);c.lineTo(x,y);c.lineTo(x+Math.cos(a+2.5)*12,y+Math.sin(a+2.5)*12);c.stroke();}
      }else if(e.type==='frostNova'){
        const r=e.radius*Math.min(1,t*2);c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.stroke();for(let i=0;i<12;i++){const a=i*TAU/12,x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r*.7,size=9+Math.sin(i*3)*3;c.beginPath();for(let j=0;j<3;j++){const b=j*Math.PI/3;c.moveTo(x-Math.cos(b)*size,y-Math.sin(b)*size);c.lineTo(x+Math.cos(b)*size,y+Math.sin(b)*size);}c.stroke();}
      }else if(e.type==='siphonLink'){
        const mx=(e.x+e.tx)/2,my=(e.y+e.ty)/2-48;c.beginPath();c.moveTo(e.x,e.y-20);c.quadraticCurveTo(mx,my,e.tx,e.ty-20);c.stroke();for(let i=0;i<3;i++){const q=(t*2+i/3)%1,x=(1-q)*(1-q)*e.x+2*(1-q)*q*mx+q*q*e.tx,y=(1-q)*(1-q)*(e.y-20)+2*(1-q)*q*my+q*q*(e.ty-20);c.beginPath();c.arc(x,y,4,0,TAU);c.fill();}
      }else if(e.type==='grappleLine'){
        c.setLineDash([5,3]);c.beginPath();c.moveTo(e.x,e.y-21);c.lineTo(e.tx,e.ty-21);c.stroke();c.setLineDash([]);c.lineWidth=4;c.beginPath();c.arc(e.tx,e.ty-21,11,-Math.PI*.8,Math.PI*.6);c.stroke();
      }else if(e.type==='supplyDrop'){
        const y=e.y-22-Math.max(0,1-t*5)*65;c.fillStyle='#234b39';c.fillRect(e.x-21,y-16,42,32);c.strokeRect(e.x-21,y-16,42,32);c.fillStyle=color;c.fillRect(e.x-3,y-10,6,20);c.fillRect(e.x-10,y-3,20,6);
      }c.restore();return;
    }
    if(!['aegisField','mirrorWard','overdrive','gravityWell','revivalBeacon','orbitBlades'].includes(e.type))return drawEffect?.call(this,e,front);
    const isFloor=['gravityWell','revivalBeacon'].includes(e.type);if(front===isFloor)return;const c=this.ctx,t=e.maxLife-e.life,colors={aegisField:'#91d8ff',mirrorWard:'#dbfff1',overdrive:'#ffc67d',gravityWell:'#c29bec',revivalBeacon:'#94e4b8',orbitBlades:'#eee3c0'};c.save();c.strokeStyle=colors[e.type];c.fillStyle=colors[e.type];c.lineWidth=3;c.globalAlpha=Math.min(1,e.life*2)*.8;
    if(e.type==='orbitBlades'){for(let i=0;i<4;i++){const a=t*4+i*TAU/4,x=e.x+Math.cos(a)*e.radius,y=e.y+Math.sin(a)*e.radius;c.save();c.translate(x,y-12);c.rotate(a+Math.PI/2);c.beginPath();c.moveTo(0,-23);c.lineTo(7,6);c.lineTo(0,16);c.lineTo(-7,6);c.closePath();c.fill();c.restore();}}
    else {const radius=e.type==='overdrive'?42:e.radius;c.setLineDash(e.type==='mirrorWard'?[15,9]:[]);c.lineDashOffset=-t*35;c.beginPath();c.ellipse(e.x,e.y-(isFloor?0:25),radius,radius*(isFloor?.65:.8),0,0,TAU);c.stroke();if(isFloor){c.globalAlpha=.11;c.fill();c.globalAlpha=.7;for(let i=0;i<5;i++){const a=t*(e.type==='gravityWell'?-2:1)+i*TAU/5;c.beginPath();c.arc(e.x+Math.cos(a)*radius*.7,e.y+Math.sin(a)*radius*.45,5,0,TAU);c.fill();}}}
    c.restore();
  };
  W.AbilityProgression={initialize};
})();
