(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,TAU=Math.PI*2,live=e=>e&&e.hp>0&&!e.dead;
  const tierFor=region=>Math.min(3,Math.max(0,Math.floor((Number(region)||0)/2)));
  const families=[['roll','slam','rockFan','faultRing','chainRoll'],['swoop','iceFan','iceBarrage','frostRoost','crosswind'],['poison','webLattice','brood','venomFan','twinVenom'],['blink','voidFan','burrowLine','royalEcho','royalRing']];
  const roster=(family,region)=>(families[family]||families[0]).slice(0,2+tierFor(region));
  const custom=new Set(['faultRing','frostRoost','crosswind','twinVenom','royalEcho','royalRing']);
  const bounds=p=>({x:W.clamp(p.x,1180,1700),y:W.clamp(p.y,280,980)});
  function settings(g,w=g.world){
    if(!w?.isDungeon)return{version:1,partySize:1};
    const old=w.state.guardianProgression;
    if(!old||old.version!==1)w.state.guardianProgression={version:1,partySize:g.players.length>1?2:1};
    else old.partySize=old.partySize===2?2:1;
    return w.state.guardianProgression;
  }
  function ensure(g,e,w=g.world){
    if(!e||e.kraken||e.id==='cave_kraken_guardian'||!live(e)||!w?.isDungeon||(!e.dungeonBoss&&!e.guardianOwner))return e;
    const r=W.clamp(Number(e.region)||0,0,7),party=settings(g,w).partySize,scale=party===2?1.25:1;
    // Always derive the target from canonical stats. Checkpoint resets retain
    // maxHp but remove arbitrary fields, so multiplying a saved value is unsafe.
    const max=e.dungeonBoss?Math.round(Math.round((1000+r*630)*(1+r*.17))*scale):Math.round((85+r*35)*scale);
    if(e.maxHp!==max){const fraction=W.clamp(e.hp/(e.maxHp||max),0,1);e.maxHp=max;e.hp=Math.min(max,max*fraction);}
    if(e.dungeonBoss){e.damage=(18+r*13)*(1+r*.02);e.guardianTier=tierFor(r);e.guardianProgressionVersion=1;}
    else{e.guardianBroodDamage=10+r*3;e.guardianBroodVersion=1;e.regionScaleApplied=true;}
    return e;
  }
  function initializeWorld(g){if(!g.world?.isDungeon)return;for(const e of g.world.activeEnemies)ensure(g,e);}
  const add=W.DungeonWorld?.prototype.addEnemy;if(add)W.DungeonWorld.prototype.addEnemy=function(e){ensure(this.game,e,this);return add.call(this,e);};
  const scaleEnemy=G.ensureEnemyScaling;G.ensureEnemyScaling=function(e){if(e.guardianOwner&&this.world.isDungeon){ensure(this,e);return;}return scaleEnemy.call(this,e);};
  const damage=G.enemyDamage;G.enemyDamage=function(e,spec,multiplier=1){if(e.guardianOwner&&this.world.isDungeon){ensure(this,e);return(e.guardianBroodDamage||10)*multiplier;}return damage.call(this,e,spec,multiplier);};
  const advanced=G.updateAdvancedEnemy;G.updateAdvancedEnemy=function(e,target,spec,dt){const before=e.combatAction,result=advanced.call(this,e,target,spec,dt),a=e.combatAction;
    if(!e.boss&&spec.role==='roller'&&a&&a!==before&&a.kind==='roll'&&a.phase==='windup'){a.length*=.87;a.rollDistanceVersion=1;}
    return result;
  };
  function marker(g,e,p,radius,delay,amount,color,hazard){return g.effect('telegraph',p.x,p.y,radius,delay,{owner:-1,damage:amount,delay:true,guardianId:e.id,guardianColor:color,guardianHazard:hazard,progressionTell:true});}
  function fanTell(g,e,angle,delay,amount){return g.effect('guardianCrosswind',e.x,e.y,350,delay,{owner:-1,guardianId:e.id,angle,spread:1.05,count:5,damage:amount,color:'#b5edff'});}
  const begin=G.beginGuardianAttack;G.beginGuardianAttack=function(e,p,kind){
    ensure(this,e);const choices=roster(e.guardian,e.region);
    if(this._selectRegionalGuardian&&kind!=='chainContinuation')kind=choices[Math.max(0,(e.cycle||1)-1)%choices.length];
    // Explicit tools may request a known attack, but cannot bypass regional gates.
    if(kind!=='chainContinuation'&&!choices.includes(kind))kind=choices[0];
    if(!custom.has(kind)){
      const existing=new Set(this.effects.filter(f=>f.alive)),a=begin.call(this,e,p,kind);
      if(a){a.time=Math.max(.75,a.time);a.duration=a.time;for(const f of this.effects)if(f.alive&&!existing.has(f)&&f.guardianId===e.id&&f.type==='telegraph'){f.life=Math.max(1,f.life);f.maxLife=f.life;}}
      return a;
    }
    const point=bounds(p),angle=Math.atan2(p.y-e.y,p.x-e.x),power=e.damage*1.8*(1+((e.phase||1)-1)*.14),color=W.DungeonGuardians[e.guardian].color;
    const a={type:kind,x:point.x,y:point.y,sx:e.x,sy:e.y,angle,time:.9,duration:.9,radius:90,shape:'markers',points:[],damage:power,color};
    e.guardianRecovery=false;e.anim='windup';e.lastAttack=kind;e.attackVisual=0;
    if(kind==='faultRing'||kind==='royalRing'){
      a.x=e.x;a.y=e.y;a.radius=95;a.shape='slam';a.label=kind==='faultRing'?'FAULT RING · SAFE INSIDE THE RING':'ROYAL RIFT · CROSS THE MOVING RING';a.time=a.duration=1;
      this.effect('guardianRingPrelude',e.x,e.y,95,1,{guardianId:e.id,owner:-1,damage:power*.72,color,fromRadius:95,toRadius:350,thickness:16});
    }else if(kind==='frostRoost'){
      a.label='FROST ROOST · LEAVE THE LOCKED CIRCLE';a.points=[point];marker(this,e,point,100,1.05,power*.55,'#aeeaff',{life:2.4,damage:power*.12,slow:true,color:'#aeeaff'});
    }else if(kind==='crosswind'){
      a.label='CROSSWINDS · TWO WARNED FANS';a.shape='fan';a.count=5;a.spread=1.05;a.length=350;a.angle=angle-.6;
      fanTell(this,e,angle-.6,1.05,power*.65);fanTell(this,e,angle+.6,1.85,power*.65);
    }else{
      const offset=kind==='royalEcho'?220:190,other=bounds({x:p.x+Math.cos(angle+Math.PI/2)*offset,y:p.y+Math.sin(angle+Math.PI/2)*offset});a.points=[point,other];a.label=kind==='royalEcho'?'ROYAL ECHO · TWO LOCKED SEALS':'TWIN VENOM · LEAVE BOTH CIRCLES';
      for(const [i,pos]of a.points.entries())marker(this,e,pos,kind==='royalEcho'?85:75,1.05+i*.65,power*.65,color,kind==='twinVenom'?{life:2,damage:power*.1,poison:true,color}:undefined);
    }
    e.windup=a;return a;
  };
  const update=G.updateEnemies;G.updateEnemies=function(dt){
    if(this.paused)return;initializeWorld(this);const old=this._selectRegionalGuardian,guardians=this.world.isDungeon?this.world.activeEnemies.filter(e=>e.dungeonBoss&&live(e)):[],before=new Map(guardians.map(e=>[e,e.windup]));this._selectRegionalGuardian=true;
    try{update.call(this,dt);}finally{this._selectRegionalGuardian=old;}
    for(const e of guardians){if(!live(e))continue;const ended=before.get(e)&&!e.windup&&!e.charging;if(ended&&e.guardianRecovery){const danger=this.effects.filter(f=>f.alive&&f.guardianId===e.id&&['telegraph','guardianCrosswind','guardianRingPrelude'].includes(f.type)).reduce((n,f)=>Math.max(n,f.life),0);e.cooldown=Math.max(e.cooldown||0,.8,danger+.8);}}
    initializeWorld(this);
  };
  const effects=G.updateEffects;G.updateEffects=function(dt){if(this.paused)return;const pending=[];
    for(const f of this.effects)if(f.alive&&['guardianRingPrelude','guardianCrosswind'].includes(f.type)){
      const e=this.world.activeEnemies.find(e=>e.id===f.guardianId&&live(e));if(!e){f.alive=false;continue;}
      if(f.life<=dt)pending.push({...f});
    }
    effects.call(this,dt);
    for(const f of pending){const source=this.world.activeEnemies.find(e=>e.id===f.guardianId&&live(e));if(!source)continue;
      if(f.type==='guardianRingPrelude')this.effect('guardianRing',f.x,f.y,350,1.2,{guardianId:f.guardianId,damage:f.damage,owner:-1,fromRadius:95,toRadius:350,thickness:16,hitPlayers:{},color:f.color});
      else for(let i=0;i<f.count;i++){const a=f.angle-f.spread/2+i*f.spread/(f.count-1);this.bulletPool.take({x:f.x+Math.cos(a)*40,y:f.y+Math.sin(a)*40,vx:Math.cos(a)*380,vy:Math.sin(a)*380,life:2.1,damage:f.damage,owner:-1,kind:'ice',radius:6,color:f.color,guardianId:f.guardianId,guardianAttack:'crosswind'});}
    }
  };
  const snap=G.snapshot;G.snapshot=function(){initializeWorld(this);return snap.call(this);};
  const enter=G.enterDungeon;G.enterDungeon=function(...args){const ok=enter.apply(this,args);if(ok){initializeWorld(this);if(!args[1]){const e=this.world.activeEnemies.find(e=>e.dungeonBoss&&live(e));if(e)this.ui.toast('CAVERN TIER '+(tierFor(e.region)+1)+' · '+roster(e.guardian,e.region).length+' guardian techniques. Watch each warning; deeper chambers add new moves.','quest');}}return ok;};
  if(W.Renderer?.prototype.drawEffect){const R=W.Renderer.prototype,draw=R.drawEffect;R.drawEffect=function(f,front){
    if(!['guardianRingPrelude','guardianCrosswind'].includes(f.type))return draw.call(this,f,front);if(front)return;const c=this.ctx;c.save();c.strokeStyle=f.color||'#bce4f2';c.fillStyle=f.color||'#bce4f2';c.lineWidth=2.5;c.setLineDash([9,8]);
    if(f.type==='guardianRingPrelude'){c.beginPath();c.arc(f.x,f.y,f.fromRadius||95,0,TAU);c.stroke();c.globalAlpha=.12;c.lineWidth=30;c.stroke();}
    else{for(let i=0;i<f.count;i++){const a=f.angle-f.spread/2+i*f.spread/(f.count-1);c.beginPath();c.moveTo(f.x+Math.cos(a)*40,f.y+Math.sin(a)*40);c.lineTo(f.x+Math.cos(a)*f.radius,f.y+Math.sin(a)*f.radius);c.stroke();}}
    c.restore();
  };}
  W.GuardianProgression={tierFor,roster,ensure,initializeWorld,rollFactor:.87};
})();
