(function () {
  'use strict';
  const W = window.OW, G = W.Game.prototype, TAU = Math.PI * 2;
  const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const angleTo = (a,b) => Math.atan2(b.y-a.y, b.x-a.x);
  const offset = (p,a,n) => ({x:p.x + Math.cos(a)*n, y:p.y + Math.sin(a)*n});
  const living = e => e && !e.dead && !e.downed && e.hp > 0;
  const final = e => e.boss && e.bossIndex === 8;
  const role = e => W.Content.enemies[e.type]?.id;
  let records = new WeakMap();
  const current = (g,e) => {
    const record = records.get(e);
    if (record?.world === g.world) return record;
    const fresh = {world:g.world, cycle:0, action:null, cooldown:.28, phase:0, guardDown:0};
    records.set(e,fresh);
    return fresh;
  };

  // All coordinates lie on the floor plane, including the displayed boundary.
  // Angles and endpoints lock once, before the first windup frame.
  function inside(s,p) {
    const dx=p.x-s.x, dy=p.y-s.y, along=dx*Math.cos(s.angle)+dy*Math.sin(s.angle);
    if (s.kind === 'lane') return along >= 0 && along <= s.length && Math.abs(dy*Math.cos(s.angle)-dx*Math.sin(s.angle)) <= s.halfWidth;
    const radius=Math.hypot(dx,dy);
    if (radius > s.radius || radius < (s.inner||0)) return false;
    return s.arc === undefined || Math.abs(W.wrapAngle(Math.atan2(dy,dx)-s.angle)) <= s.arc/2;
  }
  function floor(g,p,r=16) {
    return !g.world.isBlocked(p.x,p.y,r) && !g.safeZoneAt(p.x,p.y) && !g.pointLocked(p.x,p.y);
  }
  function travelPoint(g,start,a,length,r) {
    let point={x:start.x,y:start.y};
    for (let n=8; n<=length+7; n+=8) {
      const next=offset(start,a,Math.min(length,n));
      if (!floor(g,next,r)) break;
      point=next;
    }
    return point;
  }
  function lane(g,from,angle,length,halfWidth,stamp=1) {
    const end=travelPoint(g,from,angle,length,2);
    return {kind:'lane', x:from.x,y:from.y,angle,length:distance(from,end),halfWidth,stamp};
  }
  const disc = (p,radius,stamp=4) => ({kind:'disc',x:p.x,y:p.y,radius,angle:0,stamp});
  const sweep = (p,angle,radius,arc,stamp=2,inner=0) => ({kind:'sector',x:p.x,y:p.y,angle,radius,arc,stamp,inner});
  const beat = (at,shape,scale=1,extra={}) => ({at,shape,scale,...extra});
  function budget(g,e) {
    let used=0;
    for (const other of g.world.activeEnemies) {
      if (other===e || !living(other) || distance(e,other)>850) continue;
      const a=records.get(other)?.action;
      if (a && a.beats.some(b=>!b.spent)) used++;
      else if(['windup','mark','rolling'].includes(other.combatAction?.phase) || other.specialMove?.windup>0 || other.prismAction?.phase==='windup' || other.cinderAction?.phase==='load') used++;
    }
    return used < (g.players.length>1?3:2);
  }
  // Check escape room when multiple commitments overlap. Test reachable
  // ground positions before committing the new windup. A defender can hold,
  // walk sideways or dodge along any of sixteen headings.
  function escapeOpen(g,e,beats){
    if(!beats.length)return true;
    const active=[];
    for(const other of g.world.activeEnemies){
      const a=records.get(other)?.action;
      if(other===e || !living(other) || !a)continue;
      for(const b of a.beats)if(!b.spent)active.push({time:b.at-a.elapsed,shape:b.shape});
    }
    if(!active.length)return true;
    return g.players.filter(p=>validTarget(g,p,e)).every(p=>beats.every(b=>{
      const overlap=active.filter(attack=>Math.abs(attack.time-b.at)<.36);
      if(!overlap.length)return true;
      const danger=q=>inside(b.shape,q)||overlap.some(attack=>inside(attack.shape,q));
      if(!danger(p))return true;
      const reach=Math.min(148,Math.max(38,b.at*185));
      for(let i=0;i<16;i++){
        const point=travelPoint(g,p,i*TAU/16,reach,18);
        if(!danger(point))return true;
      }
      return false;
    }));
  }
  function onscreen(g,e) {
    const r=g.renderer,cam=g.camera;
    if (!r?.width || !cam) return true;
    return Math.abs(e.x-cam.x)<r.width/(2*(cam.zoom||1))+4 && Math.abs(e.y-cam.y)<r.height/(2*(cam.zoom||1))+4;
  }
  function walk(g,e,dest,speed,dt) {
    const d=distance(e,dest);
    if(d<2) {e.velocityX=e.velocityY=0;e.anim='idle';return;}
    let dx=(dest.x-e.x)/d, dy=(dest.y-e.y)/d;
    if (!g.lineOfSight(e,dest)) {
      const nav=g.world.steerAround(e,dest,dt);
      dx=nav.mx;dy=nav.my;
    }
    const step=Math.min(d,speed*(e.chillTime>0?.6:1)*dt), x=e.x,y=e.y;
    g.move(e,dx*step,dy*step,final(e)?34:17);
    e.velocityX=(e.x-x)/dt;e.velocityY=(e.y-y)/dt;e.anim='run';e.moveTime=(e.moveTime||0)+dt;
  }
  function allies(g,e,p) {
    return g.world.activeEnemies.filter(o=>o!==e && living(o) && !o.boss && !o.reconRelay &&
      distance(e,o)<290 && g.lineOfSight(e,o) && (!p || g.lineOfSight(o,p))).sort((a,b)=>distance(e,a)-distance(e,b)).slice(0,2);
  }
  function order(g,e,p,spec,r) {
    const a=angleTo(e,p),d=distance(e,p), second=r.cycle%2===1;
    const landing=()=>travelPoint(g,e,a,Math.min(spec.range,d),20);
    switch (spec.id) {
      case 'hookclaw_skirmisher': {
        if(d>120){const to=landing();return {name:'Hook leap',beats:[beat(.63,disc(to,62),1,{move:to})],rest:.71};}
        return {name:'Crosscut · I / II',beats:[beat(.5,sweep(e,a-.29,123,1.4,0),.68),beat(.81,sweep(e,a+.32,146,1.6,0),.88)],rest:.72};
      }
      case 'rivet_guard':
        return {name:'Shield sweep',beats:[beat(.78,sweep(e,a,152,2.7),1.2)],rest:.94};
      case 'signal_sergeant': {
        const links=allies(g,e,p);
        const origins=links.length?links:[e];
        return {name:links.length?'Linked volley':'Signal pistol',links,interruptible:true,beats:origins.map((from,i)=>beat(.71+i*.29,lane(g,from,angleTo(from,p),650,18),.78,{source:from})),rest:.68};
      }
      case 'glasswind_sharpshot': {
        const shot=lane(g,e,a,695,19);
        return {name:'Double tap',beats:[beat(.60,shot,.83),beat(.9,shot,.83)],rest:.64};
      }
      case 'sluice_warden': {
        const drain=disc(travelPoint(g,e,a,Math.min(190,d),8),62,6);
        return {name:'Flood / drain',beats:[beat(.72,sweep(e,a,275,1.2),.95,{push:55}),
          ...[1.02,1.48,1.94].map(at=>beat(at,drain,.30))],rest:.78};
      }
      case 'lantern_stalker': {
        const to=landing();
        return {name:'Lantern descent',beats:[beat(second?.69:.77,disc(to,84),1.12,{move:to})],rest:.88};
      }
    }
  }
  function placeRelay(g,e,p,r) {
    if (living(r.relay) && g.world.activeEnemies.includes(r.relay)) return r.relay;
    const dir=angleTo(e,p);
    for (const turn of [1.24,-1.24,2.3,-2.3]) {
      const point=offset(e,dir+turn,140);
      if (!floor(g,point,20) || !g.lineOfSight(e,point) || (g.world.isFinalArena && !g.world.isFinalArena(point.x,point.y))) continue;
      const relay={...point,homeX:point.x,homeY:point.y,id:'recon-relay-'+e.id+'-'+r.cycle,
        hp:Math.max(120,e.maxHp*.018),maxHp:Math.max(120,e.maxHp*.018),type:W.Content.reconEnemyTypes.signal_sergeant,
        level:1,region:e.region,regionScaleApplied:true,reconRelay:true,ephemeral:true,summonerId:e.id,angle:dir,anim:'idle',animTime:0,state:'attack'};
      if (g.world.addEnemy) g.world.addEnemy(relay); else g.world.activeEnemies.push(relay);
      r.relay=relay;
      return relay;
    }
    return null;
  }
  function whiskerOrder(g,e,p,r) {
    const a=angleTo(e,p),d=distance(e,p),fast=r.phase===4;
    const to=travelPoint(g,e,a,Math.min(d,460),34);
    const dash=()=>({name:'Command dash',beats:[beat(fast?.48:.63,lane(g,e,a,distance(e,to),36),1,{move:to})],rest:fast?.65:.85});
    const volley=()=>{const s=lane(g,e,a,720,27);return {name:'Command volley',beats:[beat(.56,s,.7),beat(.84,s,.7)],rest:.7};};
    if(r.phase===1) return r.cycle%2?dash():volley();
    if(r.phase===2 || (fast && r.cycle%3===0)){
      if(r.phase===2 && g.reconDossier?.evidence?.command_vault?.route==='observed' && !r.intelSpent){
        r.intelSpent=true;g.ui.toast('Dossier frequency confirmed. The first command relay is silent.','quest');
        return {name:'Relay disabled',beats:[],rest:1.5};
      }
      const relay=placeRelay(g,e,p,r);
      if(!relay) return volley();
      const gap=angleTo(relay,p)+(r.cycle%2?.78:-.78);
      return {name:'Relay sweep · find the gap',links:[relay],relay,beats:[beat(.98,sweep(relay,gap+Math.PI,460,TAU-1.48,3,58),.93,{source:relay})],rest:.79};
    }
    if(r.phase===3 && r.cycle%3===1 && !g.world.activeEnemies.some(o=>living(o)&&!o.reconRelay&&o.summonerId===e.id)){
      g.spawnReinforcement(e,0,W.Content.reconEnemyTypes.signal_sergeant);
      g.spawnReinforcement(e,1,W.Content.reconEnemyTypes.hookclaw_skirmisher);
    }
    if(fast && r.cycle%3===2)return dash();
    // Phase three alternates an actual withdrawal and an attack on the
    // other flank. Both destinations are marked before Whisker leaves cover.
    let destination=to;
    if(r.phase===3){
      const back=r.cycle%2===1;
      const aim=back?a+Math.PI+(r.cycle%4===1?.4:-.4):angleTo(e,g.players.find(h=>h!==p&&validTarget(g,h,e))||p);
      const candidate=travelPoint(g,e,aim,back?185:Math.min(420,d),34);
      if(!g.world.isFinalArena||g.world.isFinalArena(candidate.x,candidate.y))destination=candidate;
    }
    const landing=beat(fast?.91:.75,disc(destination,100),1.12,{move:destination});
    return {name:fast?'Last stand · volley / landing':'False retreat · marked landing',beats:fast?[beat(.53,lane(g,e,a,680,20),.65),landing]:[landing],rest:fast?.72:.92};
  }
  function expose(e,r,duration){
    r.action=null;r.cooldown=duration;e.combatState='recovery';e.anim='land';e.velocityX=e.velocityY=0;
  }
  G.breakReconGuard=function(e,p,duration=.85){
    if(!e || role(e)!=='rivet_guard' || !living(e))return false;
    const r=current(this,e);r.guardDown=Math.max(.7,duration||0);expose(e,r,r.guardDown);
    this.effect('reconImpact',e.x,e.y-28,32,.23,{motif:2,angle:e.angle||0});
    this.text('GUARD BROKEN',e.x,e.y-64,'#9ce5c2');return true;
  };
  function validTarget(g,p,e){
    return living(p) && !(p.smokeTime>0) && !g.safeZoneAt(p.x,p.y) && !g.pointLocked(p.x,p.y) &&
      (!final(e) || !g.world.isFinalArena || g.world.isFinalArena(p.x,p.y));
  }
  function impact(g,e,b,a) {
    const s=b.shape;
    if(b.source && (!living(b.source) || !g.world.activeEnemies.includes(b.source)))return;
    if (b.move && floor(g,b.move,final(e)?34:17)){e.x=b.move.x;e.y=b.move.y;}
    e.anim='shoot';
    const hitOrigin={x:s.x,y:s.y}, hits=[];
    for(const p of g.players){
      if(!validTarget(g,p,e) || !inside(s,p) || !g.lineOfSight(hitOrigin,p))continue;
      const hp=p.hp;
      g.damagePlayer(p,a.damage*b.scale,e);
      if(p.hp<hp)hits.push({x:p.x,y:p.y-20});
      if(b.push && !p.downed && !(p.dodgeTime>0))g.move(p,Math.cos(s.angle)*b.push,Math.sin(s.angle)*b.push,18);
    }
    // Use one pooled object both for the spent footprint and the contacts.
    // A missed volley terminates at the same cover-limited end of its tell.
    const mid=s.kind==='lane'?offset(s,s.angle,s.length/2):s;
    const coverage=s.kind==='lane'?s.length/2+s.halfWidth:s.radius;
    const motif=role(e)==='sluice_warden'?5:role(e)==='lantern_stalker'?6:
      b.move?4:s.inner||role(e)==='signal_sergeant'?7:s.kind==='lane'?1:3;
    const contact=b.move|| (s.kind==='disc'?s:offset(s,s.angle,s.length??s.radius*.72));
    g.effect('reconImpact',mid.x,mid.y,coverage+22,.21,{shape:s,motif,angle:s.angle,contact,hits});
    g.audio.play(s.kind==='lane'?'rifle':s.stamp===4?'leap':'melee');
  }
  function advance(g,e,r,dt){
    const a=r.action;
    if(a.relay&&!living(a.relay)){expose(e,r,1);return;}
    a.elapsed+=dt;
    for(const b of a.beats)if(!b.spent && a.elapsed+1e-7>=b.at){b.spent=true;impact(g,e,b,a);}
    const last=a.beats.at(-1);
    if(!last || a.elapsed>=last.at+.14){expose(e,r,a.rest);return;}
    e.combatState=a.beats.some(b=>b.spent)?'commit':'windup';e.anim=e.combatState==='commit'?'shoot':'windup';
  }
  function face(g,e,r,p,spec,dt,visible){
    const key=spec.id,d=distance(e,p),a=angleTo(e,p);
    e.angle=a;
    if(!visible) {
      if(r.seen)walk(g,e,r.seen,spec.speed*1.1,dt);
      else g.patrol(e,spec,dt);
      return;
    }
    r.seen={x:p.x,y:p.y};
    if(key==='rivet_guard' && d>spec.range){
      const mate=allies(g,e)[0];
      if(mate && distance(mate,p)<d && d>spec.range*1.6){walk(g,e,offset(mate,angleTo(mate,p),65),spec.speed,dt);return;}
    }
    if(d>spec.range || (final(e)&&d>545)){walk(g,e,p,spec.speed*1.18,dt);return;}
    if((key==='glasswind_sharpshot'||key==='signal_sergeant') && d<160 && r.cooldown>0){
      walk(g,e,offset(e,a+Math.PI,90),spec.speed,dt);return;
    }
    if((key==='hookclaw_skirmisher'||key==='lantern_stalker') && r.cooldown>0)
      walk(g,e,offset(e,a+(r.cycle%2?1:-1)*Math.PI/2,60),spec.speed*1.27,dt);
  }
  // A couple of independent scouts flank established patrol posts. Do not add
  // them to a base's clearance ledger or disturb the seeded spawn sequence.
  const build=W.World.prototype._buildEnemies;
  W.World.prototype._buildEnemies=function(){
    build.call(this);
    const rosters=[
      [0,'hookclaw_skirmisher','rivet_guard'],[2,'rivet_guard','signal_sergeant'],
      [4,'glasswind_sharpshot','hookclaw_skirmisher'],[5,'sluice_warden','lantern_stalker'],
      [6,'signal_sergeant','glasswind_sharpshot'],[7,'lantern_stalker','rivet_guard']
    ];
    for(const [region,...pair] of rosters){
      const post=Array.from(this._spawns.values()).find(spawn=>spawn.id.startsWith('patrol_'+region+'_') && !spawn.boss);
      if(!post)continue;
      pair.forEach((id,i)=>{
        const x=post.x+(i?85:-85),y=post.y+72;
        this._spawn({id:'recon_patrol_'+region+'_'+i,type:W.Content.reconEnemyTypes[id],x,y,homeX:x,homeY:y,
          level:post.level,patrol:i*Math.PI,region,locationId:null,boss:false});
      });
    }
  };
  const advanced=G.updateAdvancedEnemy;
  G.updateAdvancedEnemy=function(e,target,spec,dt){
    if(e.reconRelay){e.velocityX=e.velocityY=0;return true;}
    if(!spec.reconRole && !final(e)){
      // Legacy specialists share the initiation budget. In-progress moves
      // always finish through their existing handling.
      const legacy=['fencer','roller','blinkstalker','cindermortar','prismsentry'].includes(spec.role);
      if(legacy && !e.specialMove && !e.combatAction && !e.cinderAction && !e.prismAction &&
        (e.fireTimer||0)<=0 && (!budget(this,e)||!onscreen(this,e)))e.fireTimer=.16;
      return advanced.call(this,e,target,spec,dt);
    }
    if(this.paused || !(dt>0))return true;
    const r=current(this,e), heroes=this.players.filter(p=>validTarget(this,p,e)).sort((a,b)=>distance(e,a)-distance(e,b));
    const p=heroes.find(p=>this.lineOfSight(e,p))||heroes[0];
    if(!p || !floor(this,e,2) || distance(e,p)>960){r.action=null;r.seen=null;r.cooldown=.28;e.combatState=null;e.anim='idle';return true;}
    if(final(e)){
      if(!e.reconPartySize){
        const ratio=W.clamp(e.hp/e.maxHp,0,1);e.reconPartySize=this.players.length;
        e.maxHp=spec.hp*(e.reconPartySize>1?1.42:1);e.hp=ratio*e.maxHp;
        e.specialMove=null;e.comboMoves=[];
      }
      const phase=Math.min(4,1+Math.floor((1-e.hp/e.maxHp)*4));
      if(r.phase!==phase){
        if(living(r.relay)){r.relay.hp=0;r.relay.dead=true;}
        r.phase=e.phase=phase;r.action=null;r.cooldown=.62;r.cycle=0;r.seen=null;
        this.ui.toast(['Command duel','Signal network · destroy the relay','False retreat · watch the lantern','Last stand'][phase-1],'quest');
      }
    }
    r.guardDown=Math.max(0,r.guardDown-dt);
    if(r.action){advance(this,e,r,dt);return true;}
    r.cooldown=Math.max(0,r.cooldown-dt);
    if(e.combatState==='recovery' && r.cooldown>.26){e.velocityX=e.velocityY=0;e.anim='land';return true;}
    e.combatState=null;
    const visible=this.lineOfSight(e,p);
    face(this,e,r,p,spec,dt,visible);
    if(!visible || r.cooldown>0 || distance(e,p)>(final(e)?550:spec.range) || !onscreen(this,e) || !budget(this,e))return true;
    r.cycle++;
    const a=final(e)?whiskerOrder(this,e,p,r):order(this,e,p,spec,r);
    if(!escapeOpen(this,e,a.beats)){r.cooldown=.22;return true;}
    a.elapsed=0;a.damage=this.enemyDamage(e,spec,.72);
    // The two adaptive assists remain meaningful for every follow-up beat.
    if(this.settings?.longWarnings)for(const b of a.beats)b.at*=1.5;
    r.action=a;e.combatState='windup';e.anim='windup';e.velocityX=e.velocityY=0;
    return true;
  };

  const damage=G.damageEnemy;
  G.damageEnemy=function(e,amount,p,...args){
    const r=records.get(e),before=e.hp;
    const frontal=role(e)==='rivet_guard' && !e.reconRelay && p && Math.abs(W.wrapAngle(angleTo(e,p)-(e.angle||0)))<1.0;
    if(frontal && !(r?.guardDown>0) && e.combatState!=='recovery')amount*=.37;
    if((W.Content.enemies[e.type]?.reconRole || final(e)) && e.combatState==='recovery')amount*=1.22;
    const result=damage.call(this,e,amount,p,...args);
    if(living(e) && r?.action?.interruptible && e.hp<before){
      expose(e,r,.86);this.text('SIGNAL CUT',e.x,e.y-64,'#a7edce');
    }
    return result;
  };
  const effect=G.effect;
  G.effect=function(type,x,y,radius,life,extra={}){
    if(type==='defeat' && this._reconLastCommander)extra={...extra,reconCommanderPhase:this._reconLastCommander.phase||4,reconFacing:this._reconLastCommander.angle||0};
    return effect.call(this,type,x,y,radius,life,extra);
  };
  const kill=G.killEnemy;
  G.killEnemy=function(e,p){
    const relay=records.get(e)?.relay;if(living(relay)){relay.hp=0;relay.dead=true;}
    records.delete(e);
    if(e.reconRelay){e.dead=true;e.hp=0;this.effect('reconImpact',e.x,e.y-22,38,.2,{motif:7});return;}
    if(!final(e))return kill.call(this,e,p);
    const previous=this._reconLastCommander;this._reconLastCommander=e;
    try{return kill.call(this,e,p);}finally{this._reconLastCommander=previous;}
  };
  for(const method of ['start','load','defeat','enterDungeon','leaveDungeon','fastTravel']){
    const previous=G[method];
    if(previous)G[method]=function(...args){
      const before=this.world,result=previous.apply(this,args);
      if(before!==this.world||result||method==='start'||method==='defeat')records=new WeakMap();
      return result;
    };
  }
  W.ReconCombat={inside,record:e=>records.get(e)};
})();
