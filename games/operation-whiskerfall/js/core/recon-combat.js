(function () {
  'use strict';
  const W = window.OW, G = W.Game.prototype, TAU = Math.PI * 2;
  const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const angleTo = (a,b) => Math.atan2(b.y-a.y, b.x-a.x);
  const offset = (p,a,n) => ({x:p.x + Math.cos(a)*n, y:p.y + Math.sin(a)*n});
  const living = e => e && !e.dead && !e.downed && e.hp > 0;
  const final = e => e.boss && e.bossIndex === 8;
  const commander = e => e.boss && !e.dungeonBoss && Number.isInteger(e.bossIndex);
  const engagementDistance=[395,540,295,350,390,375,320,420,545];
  const commanderCues=['reload','footstep','stomp','ice','dash','waterstep','mine','alarm','alarm'];
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
    g.move(e,dx*step,dy*step,commander(e)?34:17);
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
  function regionalOrder(g,e,p,r) {
    const a=angleTo(e,p), phase=r.phase, alternate=r.cycle%2===0;
    const origin={x:e.x,y:e.y}, target={x:p.x,y:p.y};
    const tell=phase===3?.51:phase===2?.59:.68;
    const rest=phase===3?.75:.95;
    const line=(from,angle,width,reach=640)=>lane(g,from,angle,reach,width);
    const report=(name,beats,extra)=>({name,beats,rest,...extra});
    function run(length,width){
      const to=travelPoint(g,e,a,Math.min(length,distance(e,p)+50),34);
      return beat(tell,line(e,a,width,distance(e,to)),1.45,{move:to});
    }
    if(phase===3 && r.cycle%3===0){
      switch(e.bossIndex){
        case 0:{
          const thrust=run(370,34);thrust.at=.99;
          return report('Breach drill',[beat(.51,sweep(origin,a,178,2.35),1.12),thrust]);
        }
        case 1:
          return report('Briar snare',[beat(.57,disc(target,65,6),.72,{slow:true}),
            beat(.94,line(e,a,21,730),1.36)]);
        case 2:
          return report('Walking barrage',[-105,0,105].map((step,i)=>
            beat(.55+.24*i,disc(offset(target,a,step),72),1.15)));
        case 3:
          return report('Split glacier',[beat(.56,sweep(origin,a-.71,425,.8,2),.97,{slow:true}),
            beat(.56,sweep(origin,a+.71,425,.8,2),.97,{slow:true}),beat(1.06,line(e,a,28,480),1.15)]);
        case 4:{
          const flank=travelPoint(g,e,a+1.2,115,34),cut=angleTo(flank,p);
          const end=travelPoint(g,flank,cut,Math.min(460,distance(flank,p)+35),34);
          return report('Mirage cut',[beat(.51,disc(flank,52),.67,{move:flank}),
            beat(.93,line(flank,cut,31,distance(flank,end)),1.37,{move:end})]);
        }
        case 5:
          return report('Ebb tide',[beat(.57,sweep(origin,a,390,2.25,6,150),1.05,{push:75}),
            beat(1.03,sweep(origin,a,146,2.25,6),1.03,{venom:true})]);
        case 6:{
          const dynamo=placeRelay(g,e,p,r);
          if(dynamo){
            const beam=line(dynamo,angleTo(dynamo,p),31,540);
            return report('Overload dynamo',[beat(.88,beam,1.24,{source:dynamo}),
              beat(1.20,beam,1.06,{source:dynamo})],{links:[dynamo],relay:dynamo});
          }
          return report('Emergency exhaust',[beat(.62,sweep(origin,a,350,1.85),1.2),
            beat(1.03,disc(target,65),.91)]);
        }
        case 7:{
          const squad=allies(g,e,p),beats=[beat(.56,line(e,a,25),1.08)];
          for(const [i,ally] of squad.entries())beats.push(beat(.85+i*.24,line(ally,angleTo(ally,p),19),.94,{source:ally}));
          beats.push(beat(1.43,disc(target,86),1.25));
          return report('Execution order',beats,{links:squad,interruptible:true});
        }
      }
    }
    switch(e.bossIndex){
      case 0: { // A plated field colonel plants his bayonet before committing.
        if(alternate){
          const cone=sweep(origin,a,415,1.0,2);
          return report('Trench volley', [beat(tell,cone,.93),beat(tell+.33,cone,.74)]);
        }
        const thrust=run(460,39), beats=[thrust];
        if(phase>1)beats.push(beat(tell+.46,line(thrust.move,a+Math.PI,30,distance(origin,thrust.move)),1.05,{move:origin}));
        return report('Bayonet charge',beats);
      }
      case 1: { // The camouflaged marksman covers a retreat with a fixed sightline.
        const shot=line(e,a,17,730);
        if(alternate){
          const nest=travelPoint(g,e,a+(r.cycle%4===0?1:-1)*1.8,135,34);
          return report('Bramble ambush',[beat(tell,disc(nest,52),.7,{move:nest}),
            beat(tell+.40,line(nest,angleTo(nest,p),19,730),1.32)]);
        }
        return report('Sightline double tap',[beat(tell,shot,1.05),beat(tell+(phase===1?.48:.32),shot,1.05)]);
      }
      case 2: { // Heavy quarry artillery forces a choice between the center and outer ring.
        if(alternate){
          const core=disc(origin,134),rim=sweep(origin,a,335,TAU,3,144);
          return report('Battery shockwave',[beat(tell,core,1.35),beat(tell+.50,rim,1.12)]);
        }
        const marks=[beat(tell,disc(target,88),1.28)];
        if(phase>1)marks.push(beat(tell+.34,disc(offset(target,a,116),74),1.02));
        return report('Quarry battery',marks);
      }
      case 3: {
        if(alternate)return report('Glacier skate',[run(425,32),beat(tell+.44,sweep(origin,a,395,.85,2),.88,{slow:true})]);
        const frost=disc(target,88,6),beats=[beat(tell,frost,.84,{slow:true}),beat(tell+.52,frost,.86,{slow:true})];
        if(phase===3)beats.push(beat(tell+.88,frost,.78,{slow:true}));
        return report('Hoarfrost bloom',beats);
      }
      case 4: {
        const first=run(420,26),bearing=a+(r.cycle%4<2?1:-1)*1.2;
        if(!alternate){
          const end=travelPoint(g,first.move,bearing,210,34);
          return report('Switchback dash',[first,beat(tell+.36,line(first.move,bearing,29,distance(first.move,end)),1.16,{move:end})]);
        }
        return report('Sandglass rockets',[beat(tell,disc(target,74),1.14),
          beat(tell+.30,disc(offset(target,a,132),72),1.02)]);
      }
      case 5: {
        const port=offset(target,a-Math.PI/2,142),starboard=offset(target,a+Math.PI/2,142);
        if(alternate)return report('Floodgate purge',[beat(tell,sweep(origin,a,405,1.14,6),1.16,{push:65}),
          beat(tell+.5,disc(target,72,6),.87,{venom:true})]);
        return report('Poison broadside',[beat(tell,disc(port,79,6),.92,{venom:true}),
          beat(tell,disc(starboard,79,6),.92,{venom:true}),beat(tell+.48,disc(target,75,6),1.03,{venom:true})]);
      }
      case 6: {
        const fuse=disc(target,90),boiler=sweep(origin,a,345,TAU,3,110);
        if(alternate)return report('Furnace vent',[beat(tell,boiler,1.35),beat(tell+.54,disc(origin,106),.9)]);
        // A shot into the exposed igniter cuts power to every primed mine.
        return report('Prime demolition rig',[beat(tell+.20,fuse,1.44),beat(tell+.64,fuse,1.1)],{interruptible:true});
      }
      case 7: {
        if(alternate){
          const cross=line(e,a,23,725);
          return report('Citadel firing order',[beat(tell,cross,.94),beat(tell+.29,cross,.87),
            beat(tell+.63,disc(target,81),1.14)]);
        }
        const gap=a+(r.cycle%4===1?.52:-.52);
        return report('Blackbanner encirclement',[beat(tell+.10,sweep(origin,gap+Math.PI,465,TAU-1.4,3,57),1.35),
          beat(tell+.58,disc(target,72),.98)]);
      }
    }
  }
  function placeRelay(g,e,p,r) {
    if (living(r.relay) && g.world.activeEnemies.includes(r.relay)) return r.relay;
    const dir=angleTo(e,p);
    for (const turn of [1.24,-1.24,2.3,-2.3]) {
      const point=offset(e,dir+turn,140);
      if (!floor(g,point,20) || !g.lineOfSight(e,point) || (final(e) && g.world.isFinalArena && !g.world.isFinalArena(point.x,point.y))) continue;
      const relay={...point,homeX:point.x,homeY:point.y,id:'recon-relay-'+e.id+'-'+r.cycle,
        hp:Math.max(120,e.maxHp*.018),maxHp:Math.max(120,e.maxHp*.018),type:W.Content.reconEnemyTypes.signal_sergeant,
        level:1,region:e.region,regionScaleApplied:true,reconRelay:true,dynamo:e.bossIndex===6,ephemeral:true,summonerId:e.id,angle:dir,anim:'idle',animTime:0,state:'attack'};
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
    if(!living(p))return false;
    if(commander(e) && !final(e) && Number.isFinite(e.homeX) && Math.hypot(p.x-e.homeX,p.y-e.homeY)>820)return false;
    return !(p.smokeTime>0) && !g.safeZoneAt(p.x,p.y) && !g.pointLocked(p.x,p.y) &&
      (!final(e) || !g.world.isFinalArena || g.world.isFinalArena(p.x,p.y));
  }
  function impact(g,e,b,a) {
    const s=b.shape;
    if(b.source && (!living(b.source) || !g.world.activeEnemies.includes(b.source)))return;
    if (b.move && floor(g,b.move,commander(e)?34:17)){e.x=b.move.x;e.y=b.move.y;}
    e.anim='shoot';
    const hitOrigin={x:s.x,y:s.y}, hits=[];
    for(const p of g.players){
      if(!validTarget(g,p,e) || !inside(s,p) || !g.lineOfSight(hitOrigin,p))continue;
      const hp=p.hp;
      g.damagePlayer(p,a.damage*b.scale,e);
      if(p.hp<hp){
        hits.push({x:p.x,y:p.y-20});
        if(b.slow && !p.perks?.rimeheart)p.slowTime=Math.max(p.slowTime||0,1);
        if(b.venom){p.poisonTime=2.1;p.poisonTick=.8;p.poisonDamage=a.damage*.12;}
      }
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
    if(d>(commander(e)?engagementDistance[e.bossIndex]:spec.range)){walk(g,e,p,spec.speed*1.18,dt);return;}
    if((key==='glasswind_sharpshot'||key==='signal_sergeant') && d<160 && r.cooldown>0){
      walk(g,e,offset(e,a+Math.PI,90),spec.speed,dt);return;
    }
    if((key==='hookclaw_skirmisher'||key==='lantern_stalker') && r.cooldown>0)
      walk(g,e,offset(e,a+(r.cycle%2?1:-1)*Math.PI/2,60),spec.speed*1.27,dt);
  }
  const advanced=G.updateAdvancedEnemy;
  G.updateAdvancedEnemy=function(e,target,spec,dt){
    if(e.reconRelay){e.velocityX=e.velocityY=0;return true;}
    if(!spec.reconRole && !commander(e)){
      // Legacy specialists share the initiation budget. In-progress moves
      // always finish through their existing handling.
      const legacy=['fencer','roller','blinkstalker','cindermortar','prismsentry'].includes(spec.role);
      if(legacy && !e.specialMove && !e.combatAction && !e.cinderAction && !e.prismAction &&
        (e.fireTimer||0)<=0 && (!budget(this,e)||!onscreen(this,e)))e.fireTimer=.16;
      return advanced.call(this,e,target,spec,dt);
    }
    if(this.paused || !(dt>0))return true;
    if(commander(e) && this.awaitBossIntroduction?.(e))return true;
    const r=current(this,e), heroes=this.players.filter(p=>validTarget(this,p,e)).sort((a,b)=>distance(e,a)-distance(e,b));
    const p=heroes.find(p=>this.lineOfSight(e,p))||heroes[0];
    if(!p || !floor(this,e,2) || distance(e,p)>960){
      r.action=null;r.seen=null;r.cooldown=.28;e.combatState=null;e.anim='idle';
      if(commander(e) && !final(e) && Number.isFinite(e.homeX) && Math.hypot(e.x-e.homeX,e.y-e.homeY)>8)
        walk(this,e,{x:e.homeX,y:e.homeY},spec.speed,dt);
      return true;
    }
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
    }else if(commander(e)){
      const fraction=e.hp/e.maxHp,phase=fraction<.35?3:fraction<.68?2:1;
      if(r.phase!==phase){
        r.phase=e.phase=phase;r.action=null;r.cooldown=.55;r.cycle=0;e.combatState=null;
        this.effect('bossWarning',e.x,e.y,190,.78,{text:spec.name+' · PHASE '+phase});
      }
    }
    r.guardDown=Math.max(0,r.guardDown-dt);
    if(r.action){advance(this,e,r,dt);return true;}
    r.cooldown=Math.max(0,r.cooldown-dt);
    if(e.combatState==='recovery' && r.cooldown>.26){e.velocityX=e.velocityY=0;e.anim='land';return true;}
    e.combatState=null;
    const visible=this.lineOfSight(e,p);
    face(this,e,r,p,spec,dt,visible);
    if(!visible || r.cooldown>0 || distance(e,p)>(commander(e)?engagementDistance[e.bossIndex]+5:spec.range) || !onscreen(this,e) || !budget(this,e))return true;
    r.cycle++;
    const a=final(e)?whiskerOrder(this,e,p,r):commander(e)?regionalOrder(this,e,p,r):order(this,e,p,spec,r);
    if(!escapeOpen(this,e,a.beats)){r.cooldown=.22;return true;}
    a.elapsed=0;a.damage=this.enemyDamage(e,spec,.72);
    if(commander(e))this.audio.play(commanderCues[e.bossIndex]);
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
    if((W.Content.enemies[e.type]?.reconRole || commander(e)) && e.combatState==='recovery')amount*=1.22;
    const result=damage.call(this,e,amount,p,...args);
    if(living(e) && r?.action?.interruptible && e.hp<before){
      expose(e,r,.86);this.text(e.bossIndex===6?'IGNITER BROKEN':'SIGNAL CUT',e.x,e.y-64,'#a7edce');
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
