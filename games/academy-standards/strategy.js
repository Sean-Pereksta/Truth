/* House commanders use scouts' reports, persistent plans, and role-based squads.
   Kept independent of the renderer so strategic decisions can be tested directly. */
(() => {
  'use strict';
  const memories=new WeakMap();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const ranged=s=>s.weapon==='Bow'||s.weapon==='Longbow';
  const health=s=>s.hp/Math.max(1,s.maxHp);
  const power=s=>(s.weapon==='None'?.3:1)*(s.weaponLevel>=2?1.25:1)*(String(s.armor).startsWith('Champion_')?1.7:s.armor==='Heavy'?1.2:1)*(s.mount?1.2:1)*(.35+.65*health(s));
  function memoryFor(house){
    if(!memories.has(house))memories.set(house,{seen:new Map(),objectives:new Map(),plan:null,retreat:new Map(),regroupCooldown:new Map(),mode:'prepare'});
    return memories.get(house);
  }
  function think(ctx,house){
    const {game}=ctx,hard=game.difficulty==='veteran',now=game.time;
    const active=game.students.filter(s=>s.controller===house.id&&s.state!=='knocked');
    if(!active.length)return false;
    const memory=memoryFor(house),used=new Set();
    const visible=game.students.filter(s=>s.controller!==house.id&&s.state!=='knocked'&&ctx.isVisibleTo(house.id,s));
    for(const s of visible)memory.seen.set(s.id,{id:s.id,x:s.x,y:s.y,hp:s.hp,maxHp:s.maxHp,weapon:s.weapon,weaponLevel:s.weaponLevel,mount:s.mount,armor:s.armor,controller:s.controller,carryingStandard:s.carryingStandard,at:now});
    for(const [id,report]of memory.seen)if(now-report.at>(hard?35:14))memory.seen.delete(id);
    for(const objective of game.objectives)if(ctx.canSee(house.id,objective.x,objective.y))memory.objectives.set(objective.id,objective.controller);
    const order=(s,type,target,extra={})=>{
      used.add(s.id);
      const old=s.order||{};
      // Repeated strategy updates must not cancel a capture channel or bow windup.
      const next={type,x:target.x,y:target.y,manual:true,...extra};
      if(old.type===type&&(old.targetId||null)===(next.targetId||null)&&distance(old,next)<(type==='attack'?70:35))return;
      ctx.setOrder(s,next);
    };
    const attack=(s,t)=>order(s,'attack',t,{targetId:t.id,targetType:'student'});
    const available=()=>active.filter(s=>!used.has(s.id));
    const fighters=()=>available().filter(s=>s.weapon!=='None'&&s.item!=='Medkit');
    const homes=game.houses.filter(h=>h.controller===house.id).map(h=>h.castle);
    const safeHome=s=>[...homes].sort((a,b)=>distance(s,a)-distance(s,b))[0]||house.castle;
    const force=units=>units.reduce((sum,s)=>sum+power(s),0);
    const priority=(s,t)=>{
      let score=distance(s,t)*.12+health(t)*22;
      if(t.carryingStandard)score-=120;
      if(t.flagCaptureId)score-=100;
      if(ctx.isHouseCaptain?.(t))score-=25;
      if(t.item==='Medkit')score-=hard?35:12;
      if(s.weapon==='Spear'&&t.mount)score-=48;
      if(s.mount&&ranged(t))score-=45;
      if(ranged(s)&&t.armor!=='Heavy'&&!String(t.armor).startsWith('Champion_'))score-=15;
      return score;
    };
    const fight=(units,targets)=>{
      const assigned=new Map();
      for(const s of units){
        const t=[...targets].sort((a,b)=>priority(s,a)+(assigned.get(a.id)||0)*16-priority(s,b)-(assigned.get(b.id)||0)*16)[0];
        if(t){attack(s,t);assigned.set(t.id,(assigned.get(t.id)||0)+1);}
      }
    };
    const formation=(units,target,type='attackMove')=>{
      const center=units.reduce((a,s)=>({x:a.x+s.x/Math.max(1,units.length),y:a.y+s.y/Math.max(1,units.length)}),{x:0,y:0});
      const angle=Math.atan2(target.y-center.y,target.x-center.x),forward={x:Math.cos(angle),y:Math.sin(angle)},side={x:-forward.y,y:forward.x};
      const sorted=[...units].sort((a,b)=>(ranged(a)?1:0)-(ranged(b)?1:0));
      let front=0,back=0;
      for(const s of sorted){
        const isBack=ranged(s)||s.item==='Medkit',index=isBack?back++:front++;
        const lateral=((index%3)-1)*45,depth=isBack?-100-Math.floor(index/3)*38:20-Math.floor(index/3)*40;
        order(s,type,{x:target.x+forward.x*depth+side.x*lateral,y:target.y+forward.y*depth+side.y*lateral});
      }
    };

    // Flag runners keep moving home; escorts screen visible pursuers instead of
    // abandoning the runner to begin another raid.
    for(const carrier of active.filter(s=>s.carryingStandard)){
      order(carrier,'returnBanner',house.castle);
      const escorts=fighters().sort((a,b)=>distance(a,carrier)-distance(b,carrier)).slice(0,hard?3:2);
      for(const s of escorts)order(s,'escort',carrier,{targetId:carrier.id,targetType:'student'});
    }

    // Hurt troops leave the front, and medics explicitly heal the retreating
    // squad. Without a medic a short regroup avoids a permanent retreat loop.
    for(const s of available()){
      if(health(s)<(hard?.36:.22)&&now>(memory.regroupCooldown.get(s.id)||0))memory.retreat.set(s.id,memory.retreat.get(s.id)||now);
      if(memory.retreat.has(s.id)){
        const medic=active.filter(a=>a!==s&&a.item==='Medkit').sort((a,b)=>distance(s,a)-distance(s,b))[0];
        if(health(s)>.76||(!medic&&now-memory.retreat.get(s.id)>14)){
          memory.retreat.delete(s.id);
          if(!medic)memory.regroupCooldown.set(s.id,now+20);
          continue;
        }
        const haven=medic&&!visible.some(e=>distance(e,medic)<160)?medic:safeHome(s);
        const threat=visible.filter(e=>distance(e,s)<240).sort((a,b)=>distance(a,s)-distance(b,s))[0];
        const away=threat?Math.atan2(s.y-threat.y,s.x-threat.x):0;
        const point=threat?{x:s.x+Math.cos(away)*180,y:s.y+Math.sin(away)*180}:haven;
        order(s,'move',point);
        if(medic&&!used.has(medic.id))order(medic,'heal',s,{targetId:s.id,targetType:'student'});
      }
    }

    const ownFlag=game.standards.find(st=>st.houseId===house.id);
    const knownThief=visible.find(e=>e.carryingStandard===house.id);
    const thiefReport=[...memory.seen.values()].find(e=>e.carryingStandard===house.id);
    if(ownFlag&&(knownThief||ownFlag.dropped&&ctx.canSee(house.id,ownFlag.x,ownFlag.y)||ownFlag.carriedBy&&thiefReport)){
      const target=knownThief||thiefReport||ownFlag;
      const recovery=fighters().sort((a,b)=>distance(a,target)/(a.moveSpeed||84)-distance(b,target)/(b.moveSpeed||84)).slice(0,Math.max(3,Math.ceil(active.length*.55)));
      if(knownThief)fight(recovery,[knownThief]);
      else if(ownFlag.dropped&&ctx.canSee(house.id,ownFlag.x,ownFlag.y)){
        for(const s of recovery)order(s,'capture',ownFlag,{targetId:ownFlag.houseId,targetType:'standard'});
      }else formation(recovery,target);
      memory.mode='recover banner';
    }

    // React to a threatened castle even while the main force has an offensive
    // plan. Enemies behind the fog never enter this calculation.
    const threats=visible.filter(e=>homes.some(home=>distance(e,home)<430));
    if(threats.length){
      const needed=Math.min(fighters().length,Math.max(2,Math.ceil(force(threats)*(hard?1.35:1.1))));
      const defenders=fighters().sort((a,b)=>Math.min(...threats.map(t=>distance(a,t)))-Math.min(...threats.map(t=>distance(b,t)))).slice(0,needed);
      fight(defenders,threats);
      memory.mode='defend castle';
    }

    // A small security detail stays at home. Expanded houses retain reserves
    // rather than sending every student to the same remote target.
    const reserveCount=hard?Math.max(1,Math.floor(active.length*.17)):1;
    const reserve=fighters().sort((a,b)=>Number(!!ctx.isHouseCaptain?.(b))-Number(!!ctx.isHouseCaptain?.(a))||distance(a,safeHome(a))-distance(b,safeHome(b))).slice(0,reserveCount);
    reserve.forEach((s,i)=>order(s,'defend',{x:safeHome(s).x+Math.cos(i*2.4)*105,y:safeHome(s).y+Math.sin(i*2.4)*105}));

    const supply=[...game.lootBoxes.filter(b=>b.alive).map(obj=>({obj,type:'box',targetType:'box'})),...game.groundLoot.filter(g=>g.alive).map(obj=>({obj,type:'groundLoot',targetType:'ground'}))]
      .filter(t=>ctx.canSee(house.id,t.obj.x,t.obj.y)&&!visible.some(e=>distance(e,t.obj)<170))
      .sort((a,b)=>distance(a.obj,house.castle)-distance(b.obj,house.castle));
    if(supply.length&&available().length>=3){
      const target=supply[0],collectors=available().filter(s=>s.item!=='Medkit').sort((a,b)=>(a.weapon==='None'?-900:0)+distance(a,target.obj)-(b.weapon==='None'?-900:0)-distance(b,target.obj)).slice(0,hard?2:1);
      for(const s of collectors)order(s,target.type,target.obj,{targetId:target.obj.id,targetType:target.targetType});
    }

    let forceUnits=fighters();
    if(!forceUnits.length){
      for(const s of available())order(s,'defend',safeHome(s));
      return true;
    }
    const center=forceUnits.reduce((a,s)=>({x:a.x+s.x/forceUnits.length,y:a.y+s.y/forceUnits.length}),{x:0,y:0});
    const nearby=visible.filter(e=>distance(e,center)<400);
    const localAllies=active.filter(s=>distance(s,center)<440);
    if(hard&&nearby.length&&force(nearby)>force(localAllies)*1.45){
      const home=safeHome(center),medic=available().find(s=>s.item==='Medkit');
      formation(forceUnits,medic||home,'move');
      memory.plan=null;memory.mode='regroup outnumbered';
      for(const s of available())order(s,'move',home);
      return true;
    }
    if(nearby.length){fight(forceUnits,nearby);memory.mode='engage with counters';}
    else{
      const candidates=[];
      for(const o of game.objectives){
        if(memory.objectives.get(o.id)===house.id)continue;
        const resistance=[...memory.seen.values()].filter(e=>distance(e,o)<340).reduce((sum,e)=>sum+power(e),0);
        candidates.push({kind:'objective',id:o.id,x:o.x,y:o.y,score:distance(center,o)*.17+resistance*100-(hard?270:160)});
      }
      for(const target of game.houses.filter(h=>h.id!==house.id&&h.controller!==house.id)){
        const reports=[...memory.seen.values()].filter(e=>distance(e,target.castle)<400);
        const resistance=reports.length?force(reports):3;
        candidates.push({kind:'raid',id:target.id,x:target.castle.x,y:target.castle.y,score:distance(center,target.castle)*.17+resistance*115+(forceUnits.length<5?500:0)});
      }
      const current=memory.plan;
      const valid=current&&(current.kind==='raid'?game.houses.find(h=>h.id===current.id)?.controller!==house.id:memory.objectives.get(current.id)!==house.id);
      if(!valid||now-current.startedAt>(hard?48:22)){
        const chosen=candidates.sort((a,b)=>a.score-b.score)[0];
        memory.plan=chosen?{...chosen,startedAt:now,stage:hard?'rally':'advance',rally:null}:null;
      }
      const plan=memory.plan;
      if(plan){
        if(hard&&plan.stage==='rally'){
          if(!plan.rally){
            // Approach from cover or firm ground, considering terrain's actual
            // movement cost. This avoids a straight charge through marshes.
            const angle=Math.atan2(center.y-plan.y,center.x-plan.x),points=[];
            for(const delta of [-.85,-.45,0,.45,.85]){
              const p={x:plan.x+Math.cos(angle+delta)*330,y:plan.y+Math.sin(angle+delta)*330};
              const terrain=ctx.terrainAt(p.x,p.y);
              if(terrain.speed>0)points.push({...p,score:distance(center,p)*.2+(1-terrain.speed)*150+(terrain.concealment??1)*90});
            }
            plan.rally=points.sort((a,b)=>a.score-b.score)[0]||center;
          }
          const assembled=forceUnits.filter(s=>distance(s,plan.rally)<180).length>=Math.ceil(forceUnits.length*.65);
          if(assembled||now-plan.startedAt>17)plan.stage='advance';
          else{formation(forceUnits,plan.rally,'move');memory.mode='rally in cover';}
        }
        if(plan.stage==='advance'){
          const flag=plan.kind==='raid'?game.standards.find(st=>st.houseId===plan.id):null;
          if(flag&&ctx.canSee(house.id,flag.x,flag.y)&&!flag.carriedBy){
            const runner=[...forceUnits].sort((a,b)=>(ranged(a)?300:0)+distance(a,flag)/(a.moveSpeed||84)-(ranged(b)?300:0)-distance(b,flag)/(b.moveSpeed||84))[0];
            order(runner,'capture',flag,{targetId:flag.houseId,targetType:'standard'});
            formation(forceUnits.filter(s=>s!==runner),flag);
          }else formation(forceUnits,plan);
          memory.mode=plan.kind==='objective'?'secure objective':'flank rival castle';
        }
      }else formation(forceUnits,house.castle,'defend');
    }
    // Medics travel behind the front and heal whichever ally needs them most.
    for(const medic of available().filter(s=>s.item==='Medkit')){
      const hurt=active.filter(s=>s!==medic&&health(s)<.88).sort((a,b)=>health(a)-health(b)||distance(medic,a)-distance(medic,b))[0];
      if(hurt)order(medic,'heal',hurt,{targetId:hurt.id,targetType:'student'});
      else{
        const anchor=forceUnits[0]||active[0];
        order(medic,'escort',anchor,{targetId:anchor.id,targetType:'student'});
      }
    }
    for(const s of available())order(s,'defend',safeHome(s));
    return true;
  }
  const api={think,getState:house=>memoryFor(house)};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else window.AcademyStrategy=api;
})();
