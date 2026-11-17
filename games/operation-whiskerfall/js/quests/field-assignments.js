/* Assignment decisions live in the existing questCounters envelope. A missing
   counter means a pre-fieldwork acceptance, which keeps its original objective. */
(function () {
  'use strict';
  const W=window.OW, C=W.Content, G=W.Game.prototype, U=W.UI.prototype, R=W.Renderer.prototype;
  const files=C.fieldAssignments, catalogue=new Map(C.quests.map(q=>[q.id,q]));
  const entry=value=>typeof value==='string'?catalogue.get(value):value;
  const counter=(q,suffix='route')=>'fieldwork:'+q.id+':'+suffix;
  const route=(g,q)=>q&&g.questCounters?.[counter(q)]||0;
  const living=p=>p&&!p.downed&&p.hp>0;
  const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const home=g=>g.world.isDungeon?g.overworld:g.world;
  const choices=(g,q)=>route(g,q)===-1&&!g.completedQuests.has(q.id);
  const artURL=index=>(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/fieldwork/evidence-'+index+'.webp';
  const caseURL=q=>(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/cases/'+q.id+'.webp';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const images=new Map(), siteCache=new WeakMap();
  const sides=['left','right'];
  const start=G.start;
  G.start=function(){
    const ok=start.apply(this,arguments);
    if(ok){
      this.ui.activeQuestCelebration=null;this.ui.questCelebrationQueue=[];
      this.ui.questCelebrationAfterChoice=false;
    }
    return ok;
  };
  function plate(url) {
    if(!images.has(url)){
      const im=new Image();images.set(url,null);im.onload=()=>images.set(url,im);im.src=url;
    }
    return images.get(url);
  }
  function safe(w,x,y) {
    for(let ring=0;ring<=20;ring++)for(let i=0;i<(ring?24:1);i++){
      const a=i*Math.PI/12, px=x+ring*24*Math.cos(a),py=y+ring*24*Math.sin(a);
      if(px>=40&&py>=40&&px<w.width-40&&py<w.height-40&&!w.isBlocked(px,py,22)&&!w.gateAt?.(px,py,22))return {x:px,y:py};
    }
    return null;
  }
  function sites(g,q) {
    const w=home(g);
    let cache=siteCache.get(w);
    if(!cache){cache=new Map();siteCache.set(w,cache);}
    if(cache.has(q.id))return cache.get(q.id);
    const raw=Array.isArray(q.target)?q.target[0]:q.target;
    let location=w.getLocation(raw)||w._spawns.get(raw)||w.getLocation(q.targetLocation);
    if(q.type==='kill')location=w.getLocation('base_'+q.region+'_1');
    if(q.type==='escort')location={x:q.startX,y:q.startY};
    if(q.id==='main_berlin_final')location=w.getLocation('town_7');
    if(!Number.isFinite(location?.x))location=q.destination||g.questContact(q);
    if(!location)return null;
    const seed=[...q.id].reduce((n,c)=>n+c.charCodeAt(0),0);
    const direction=(q.id==='main_0_0'?2.5:seed*.36);
    const around=(angle,distance)=>safe(w,location.x+Math.cos(angle)*distance,location.y+Math.sin(angle)*distance);
    const fallback=g.questContact(q);
    const a=around(direction,260)||safe(w,fallback.x,fallback.y);
    let b=around(direction+2.4,210);
    if(!b||near(a,b)<120)b=around(direction-1.9,325)||safe(w,fallback.x+145,fallback.y);
    const rally=around(direction+.9,440)||a;
    const records={left:a,right:b,rally,location};
    cache.set(q.id,records);return records;
  }
  function squad(g,q) {
    const location=sites(g,q)?.location;
    return (location?.enemyIds||[]).slice(0,3);
  }
  function guardTarget(g,q){
    const w=home(g),ids=squad(g,q);
    const id=ids.find(id=>!w.dead.has(id));
    return id&&(w._active.get(id)||w._dormant.get(id)||w._spawns.get(id));
  }
  function rescuePending(g,q) {
    return q.type==='rescue'&&route(g,q)>0&&!g.completedQuests.has(q.id)&&home(g).liberated.has(q.target)&&!g.questCounters[counter(q,'safe')];
  }
  function cargoPending(g,q){
    return q.type==='convoy'&&route(g,q)>0&&!g.completedQuests.has(q.id)&&!g.questCounters[counter(q,'cargo')];
  }
  function resultOf(q,side) {
    const first=side==='left';
    if(q.type==='escort'||q.type==='defend')return first?'Scout the ambush lanes. One fewer attacker joins each road wave.':q.type==='escort'?'Send the courier to a second rendezvous beyond the ambush.':'Move the initial hold to the chalked fallback position.';
    if(q.type==='rescue')return first?'Prepare the short escape. Rally the freed party at this shelter.':'Take the longer road to a guarded rendezvous. A field dressing is waiting here.';
    if(q.type==='convoy')return first?'Trace the wheel marks and intercept the moving cargo cart.':'Set the yard signal to divert the cart to a fixed siding.';
    if(['liberate','kill','assassination','bounty'].includes(q.type))return first?'Draw one lookout away from the formation.':'Split two guards onto opposite approaches.';
    if(q.type==='triage')return first?'Recover two field dressings for the patients.':'Recover one dressing and open a protected fallback.';
    if(q.type==='delivery')return first?'Fit a shoulder sling. Move faster while carrying the delivery.':'Mark a protected stop on the delivery road.';
    if(q.type==='campDefense')return first?'Brace the supply chest. It can absorb 25% more damage.':'Chalk a fallback for both defenders beside this source.';
    if(q.steps?.some(step=>step.targets.length>1))return first?'Follow the original crew’s work order. Take a field dressing.':'Trace the installation from its far end. Pin the remaining stations in reverse order.';
    if(q.type==='dungeon'||q.type==='explore')return first?'Trace the approach on the map and collect a field dressing.':'Mark a protected rally point beside the entrance.';
    return first?'Pick up the scout’s field dressing before continuing.':'Mark a fallback that reduces incoming damage within its chalk circle.';
  }
  function divert(g,q,side) {
    const w=g.world,loc=sites(g,q),def=loc.location;
    let ids=def.enemyIds||[];
    if(!ids.length&&def.locationId)ids=w.getLocation(def.locationId)?.enemyIds||[];
    if(def.type!=null&&w._spawns.has(def.id))ids=[def.id,...ids.filter(i=>i!==def.id)];
    const count=side==='left'?1:2;
    for(const [index,id] of ids.filter(i=>!w.dead.has(i)).slice(0,count).entries()){
      const point=index===0?loc[side]:loc[side==='left'?'right':'left'];
      const p=safe(w,point.x+70,point.y+45);
      const spec=w._spawns.get(id);if(!spec||!p)continue;
      const e=w._active.get(id)||w._dormant.get(id)||w._createEnemy(spec);
      // Preserve the enemy's identity and health, including existing wound saves.
      Object.assign(e,p,{homeX:p.x,homeY:p.y,investigateX:p.x,investigateY:p.y,state:'investigate',alert:1.2});
      if(!w._active.has(id))w._dormant.set(id,e);
    }
    w._rebuildEnemyGrid();
  }
  const progress=G.questProgress;
  G.questProgress=function(id){
    const s=progress.call(this,id),q=entry(id);
    if(!q||!s.accepted||s.complete||!files[q.id]||!route(this,q)||this.readyQuestTurnIns?.has(q.id)&&s.readyForTurnIn)return s;
    if(choices(this,q)||rescuePending(this,q)||cargoPending(this,q))return {...s,ready:false,readyForTurnIn:false,objectiveReady:false};
    if(q.type==='kill'){
      const ids=squad(this,q),current=ids.filter(id=>home(this).dead.has(id)).length,done=ids.length>0&&ids.length===current;
      return {...s,current,required:ids.length,objectiveReady:done,readyForTurnIn:done&&s.available,ready:done&&this._turnInGrantId===q.id};
    }
    return s;
  };
  const accept=G.acceptQuest;
  function brace(g,q){
    const run=g.encounterRuns?.[q.id];if(!run||run.fieldBrace)return;
    run.fieldBrace=true;const extra=Math.round(run.maxHp*.25);run.maxHp+=extra;run.hp+=extra;
  }
  G.acceptQuest=function(id){
    const q=entry(id),newFile=q&&files[id]&&!this.acceptedQuests.has(id)&&this.canAcceptQuestFromNpc(q)&&this.questProgress(q).available;
    // Prior world work, final-boss clearance and an already-earned checkmark
    // remain usable immediately. New files have a persistent physical lead.
    const alreadyDone=newFile&&(q.type==='kill'?squad(this,q).every(guard=>home(this).dead.has(guard)):this.questProgress(q).objectiveReady);
    const open=newFile&&!alreadyDone&&id!=='main_berlin_final';
    if(open)this.questCounters[counter(q)]=-1;
    this._acceptingFieldFile=true;
    let ok;
    try{ok=accept.apply(this,arguments);}finally{this._acceptingFieldFile=false;if(open&&!ok)delete this.questCounters[counter(q)];}
    if(ok&&q?.type==='campDefense'&&route(this,q)===1)brace(this,q);
    return ok;
  };
  G.assignmentSites=function(id){const q=entry(id);return q&&files[q.id]?sites(this,q):null;};
  function select(g,q,side,p) {
    if(!living(p)||g.paused||g.world.isDungeon||!choices(g,q)||!sides.includes(side))return false;
    const s=sites(g,q),point=s[side];
    if(near(p,point)>100)return false;
    const left=side==='left',key=counter(q);
    g.questCounters[key]=left?1:2;
    const run=g.missionRuns[q.id],defense=q.type==='defend',escort=q.type==='escort';
    if(['liberate','convoy','kill','assassination','bounty'].includes(q.type))divert(g,q,side);
    else if(left&&q.type==='campDefense')brace(g,q);
    else if((defense||escort)&&!left&&run){
      if(escort){run.targetX=s.rally.x;run.targetY=s.rally.y;}
      else{run.x=point.x;run.y=point.y;}
    }else if(q.type==='triage'||(q.type==='rescue'?!left:left)&&!defense&&!escort) p.medkits=(p.medkits||0)+(q.type==='triage'&&left?2:1);
    const landmark=g.world.getLocation(s.location.id||q.target);if(landmark)g.world.discovered.add(landmark.id);
    g.audio.play('quest');g.effect('level',point.x,point.y,58,.65);
    g.ui.toast(files[q.id].clue,'quest');
    if(g.trackedQuest===q.id){const next=g.questTarget(q);if(next)g.marker={x:next.x,y:next.y};}
    g.checkQuests();g.save(false);return true;
  }
  const wave=G.missionWave;
  G.missionWave=function(run,q,count){
    if(route(this,q)===1&&['escort','defend'].includes(q.type))count=Math.max(1,count-1);
    return wave.call(this,run,q,count);
  };
  const playerTick=G.updatePlayer;
  G.updatePlayer=function(p,input,dt){
    const sling=Object.values(this.missionRuns).some(r=>r.carry&&r.state==='active'&&r.carrierId===p.id&&catalogue.get(r.questId)?.type==='delivery'&&route(this,catalogue.get(r.questId))===1);
    return playerTick.call(this,p,sling?{...input,mx:(input.mx||0)*1.19,my:(input.my||0)*1.19}:input,dt);
  };
  const target=G.questTarget;
  function pinnedSide(g,q){return g.questCounters[counter(q,'pin')]===2?'right':'left';}
  function rally(g,q){const s=sites(g,q);return route(g,q)===1?s.left:s.rally;}
  // Plan a collision-checked local footpath once per rescue. Its geometry is
  // deterministic so saved percentages restore to the same place on Continue.
  function evacuationPath(g,q) {
    const w=home(g),s=sites(g,q),key=route(g,q)===1?'shortPath':'longPath';
    if(s[key])return s[key];
    const start=safe(w,s.location.x,s.location.y),goal=rally(g,q),step=46;
    const queue=[{...start,parent:null}],seen=new Set(['0,0']);
    let end=queue[0];
    for(let i=0;i<queue.length&&i<1150;i++){
      const p=queue[i];
      if(near(p,goal)<near(end,goal))end=p;
      if(near(p,goal)<90&&w._navigationRay(p.x,p.y,goal.x,goal.y,19)){end={...goal,parent:p};break;}
      for(const [dx,dy] of [[0,1],[-1,0],[1,0],[0,-1]]){
        const x=p.x+dx*step,y=p.y+dy*step,id=Math.round((x-start.x)/step)+','+Math.round((y-start.y)/step);
        if(seen.has(id)||Math.hypot(x-start.x,y-start.y)>900)continue;
        seen.add(id);
        if(w._navigationRay(p.x,p.y,x,y,19))queue.push({x,y,parent:p});
      }
    }
    const path=[];for(let p=end;p;p=p.parent)path.unshift({x:p.x,y:p.y});
    let length=0;for(const [i,p] of path.entries()){if(i)length+=near(p,path[i-1]);p.distance=length;}
    return s[key]={path,length,end:path.at(-1)};
  }
  function alongPath(g,q,fraction){
    const {path,length,end}=evacuationPath(g,q),distance=length*W.clamp(fraction,0,1);
    const i=path.findIndex(p=>p.distance>=distance);
    if(i<0)return end;if(!i)return path[0];
    const a=path[i-1],b=path[i],t=(distance-a.distance)/(b.distance-a.distance);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  const evac=(g,q)=>alongPath(g,q,(g.questCounters[counter(q,'walk')]||0)/100);
  function cargo(g,q){
    if(route(g,q)===2)return sites(g,q).rally;
    // Each freight line has a different slow, reversible trip. The player can
    // meet the cart on the line or wait at either end without a deadline.
    const cycle=(g.time%(14+q.region)) / (14+q.region);
    return alongPath(g,q,1-Math.abs(2*cycle-1));
  }
  G.fieldHoldLimit=function(q,r){const plan=C.fieldDefenses[q.id];return route(this,q)>0&&plan?.signal&&!r.fieldSignal?plan.signal:r.duration;};
  function defensePhase(g,q,r){
    const plan=C.fieldDefenses[q.id];if(!plan||r.state!=='active'||route(g,q)<=0)return;
    if(!r.fieldOrigin)r.fieldOrigin={x:r.x,y:r.y};
    const phase=plan.shifts?.filter(([seconds])=>r.elapsed>=seconds).at(-1);
    const aim=plan.moving?alongPath(g,q,r.elapsed/r.duration):phase?.[1]==='origin'?r.fieldOrigin:phase?sites(g,q)[phase[1]]:r.fieldOrigin;
    if(phase&&r.fieldPhase!==phase[0]){r.fieldPhase=phase[0];g.ui.toast(plan.name+' · Move to the next marked hold. Earned seconds are safe.','quest');}
    r.x=aim.x;r.y=aim.y;
  }
  function needsSignal(g,q,r){return r?.state==='active'&&route(g,q)>0&&C.fieldDefenses[q.id]?.signal<=r.elapsed&&!r.fieldSignal;}
  G.questTarget=function(id){
    const q=entry(id),w=this.world;
    if(!q||!files[q.id]||!this.acceptedQuests.has(q.id)||this.completedQuests.has(q.id)||this._acceptingFieldFile)return target.apply(this,arguments);
    if(choices(this,q)){
      if(w.isDungeon)return {...w.locations[0],label:'Return to the assignment search area'};
      const s=sites(this,q),key=pinnedSide(this,q);
      if(s)return {...s[key],label:files[q.id][key]};
    }
    if(!w.isDungeon&&rescuePending(this,q)){
      const rendezvous=evacuationPath(this,q).end,guide=evac(this,q);
      const nearGuide=this.players.some(p=>living(p)&&near(p,guide)<240);
      return {...(nearGuide?rendezvous:guide),label:nearGuide?'Walk the freed crew to the rally flag':'Meet the freed crew'};
    }
    if(!w.isDungeon&&q.type==='kill'&&route(this,q)>0){const guard=guardTarget(this,q);if(guard)return {x:guard.x,y:guard.y,label:'Marked patrol · '+guard.name};}
    if(!w.isDungeon&&cargoPending(this,q))return {...cargo(this,q),label:route(this,q)===1?'Intercept the moving cargo':'Collect the diverted cargo at the siding'};
    if(!w.isDungeon&&q.steps&&route(this,q)===2&&!this.questProgress(q).readyForTurnIn){
      const r=this.missionRuns[q.id],stage=r?.state==='active'&&q.steps[r.stepIndex];
      if(stage?.targets.length>1){
        const next=stage.targets.slice().reverse().find(id=>!r.completedTargets.includes(id)),loc=w.getLocation(next);
        if(loc)return {x:loc.x,y:loc.y,label:loc.name};
      }
    }
    if(!w.isDungeon&&q.type==='escort'&&this.missionRuns[q.id]?.state==='failed'){
      const r=this.missionRuns[q.id];return {x:r.x,y:r.y,label:'Regroup with the courier'};
    }
    if(!w.isDungeon&&q.type==='defend'&&route(this,q)>0&&!this.questProgress(q).readyForTurnIn){
      const run=this.missionRuns[q.id];if(run)return {x:run.x,y:run.y,label:needsSignal(this,q,run)?C.fieldDefenses[q.id].command:C.fieldDefenses[q.id]?.name||'Hold the barricade'};
    }
    return target.apply(this,arguments);
  };
  const objective=G.questObjectiveText;
  G.questObjectiveText=function(id){
    const q=entry(id);
    if(!q||!files[q.id])return objective.apply(this,arguments);
    const f=files[q.id];
    if(choices(this,q))return 'Inspect '+f.left+' or '+f.right+'. Choose a lead in the assignment journal to pin its approach.';
    if(rescuePending(this,q))return 'Walk beside the freed crew to the rally flag. If separated, follow their marker. Evacuation '+Math.floor(this.questCounters[counter(q,'walk')]||0)+'%.';
    if(cargoPending(this,q))return route(this,q)===1?'Follow the marked freight cart and interact beside it to take the cargo seal. It repeats its route.':'The signal has diverted the cargo. Interact beside the stationary cart at the siding to take its seal.';
    if(q.type==='defend'&&route(this,q)>0&&this.missionRuns[q.id]?.state==='active'){
      const plan=C.fieldDefenses[q.id],r=this.missionRuns[q.id];
      if(plan)return (needsSignal(this,q,r)?'Use Interact at the mark · '+plan.command+'.':plan.plan)+' Hold '+Math.floor(r.elapsed)+' / '+r.duration+' s.';
    }
    if(q.type==='escort'&&this.missionRuns[q.id]?.state==='failed')return 'The courier fell during the ambush. Interact at their marker to regroup. Your evidence and chosen route are safe.';
    if(q.type==='kill'&&route(this,q)>0&&!this.completedQuests.has(q.id)){const s=this.questProgress(q);if(!s.readyForTurnIn)return 'Follow the marked patrol from its muster point. Defeat its three marked members · '+s.current+' / '+s.required+'.';}
    return objective.apply(this,arguments);
  };
  function tracked(g){return catalogue.get(g.trackedQuest);}
  function visibleFiles(g){
    if(!g.acceptedQuests||g.world.isDungeon)return [];
    const trackedQ=tracked(g);
    const active=[...g.acceptedQuests].filter(id=>files[id]&&!g.completedQuests.has(id)).map(id=>catalogue.get(id));
    if(trackedQ&&active.includes(trackedQ))return [trackedQ,...active.filter(q=>q!==trackedQ)];
    return active;
  }
  function closeChoice(g,p){
    for(const q of visibleFiles(g)){
      if(!choices(g,q))continue;
      const s=sites(g,q);
      for(const side of sides)if(near(p,s[side])<100)return {q,side};
    }
  }
  const interact=G.interact;
  G.interact=function(p){
    if(!this.paused&&!this.world.isDungeon&&living(p)&&!this.players.some(h=>h!==p&&h.downed&&near(h,p)<100)){
      const lead=closeChoice(this,p);
      if(lead&&select(this,lead.q,lead.side,p))return true;
      for(const q of visibleFiles(this)){
        if(cargoPending(this,q)&&near(p,cargo(this,q))<110){
          this.questCounters[counter(q,'cargo')]=1;this.audio.play('pickup');
          this.ui.toast('Cargo seal secured. '+(this.world.liberated.has(q.target)?'Report to your contact.':'Clear the depot guards, then report to your contact.'),'quest');
          this.checkQuests();const t=this.questTarget(q);if(this.trackedQuest===q.id&&t)this.marker={x:t.x,y:t.y};this.save(false);return true;
        }
        const run=this.missionRuns[q.id];
        if(needsSignal(this,q,run)&&near(p,run)<110){
          run.fieldSignal=true;this.ui.toast(C.fieldDefenses[q.id].command+' · The withdrawal is moving.','quest');this.save(false);return true;
        }
      }
      const failed=Object.values(this.missionRuns).find(r=>r.type==='escort'&&r.state==='failed'&&near(p,r)<110);
      if(failed&&this.acceptQuest(failed.questId)){
        const run=this.missionRuns[failed.questId];
        Object.assign(run,safe(this.world,failed.x,failed.y)||{x:p.x,y:p.y},{targetX:failed.targetX,targetY:failed.targetY});
        this.ui.toast('Courier regrouped. Escort health restored. Confirmed evidence and the rendezvous are retained.','quest');
        this.save(false);return true;
      }
    }
    return interact.apply(this,arguments);
  };
  const update=G.updateMissions;
  G.updateMissions=function(dt){
    const result=update.apply(this,arguments);if(this.paused||this.world.isDungeon)return result;
    for(const q of visibleFiles(this)){
      if(q.type==='defend'&&this.missionRuns[q.id])defensePhase(this,q,this.missionRuns[q.id]);
      if(cargoPending(this,q)){
        const t=cargo(this,q);if(this.trackedQuest===q.id&&!this.reconDossier?.pinned)this.marker={x:t.x,y:t.y};
        if(this.players.some(p=>living(p)&&near(p,t)<110))this.interactionPrompt='Inspect the cargo seal';
      }
      if(!rescuePending(this,q))continue;
      const point=evac(this,q);
      if(!this.players.some(p=>living(p)&&near(p,point)<240))continue;
      const k=counter(q,'walk'),distance=Math.max(1,evacuationPath(this,q).length);
      this.questCounters[k]=Math.min(100,(this.questCounters[k]||0)+dt*87/distance*100);
      if(this.questCounters[k]>=100){
        this.questCounters[counter(q,'safe')]=1;this.ui.toast(files[q.id].reply,'quest');this.checkQuests();this.save(false);
      }
    }
    for(const p of this.players){
      if(!living(p))continue;
      const lead=closeChoice(this,p);
      if(lead){this.interactionPrompt='Inspect · '+files[lead.q.id][lead.side];break;}
    }
    return result;
  };
  const damage=G.damagePlayer;
  G.damagePlayer=function(hero,amount,source){
    if(!this.world.isDungeon&&visibleFiles(this).some(q=>(route(this,q)===2&&near(hero,sites(this,q).right)<150)||(C.fieldDefenses[q.id]?.shelter&&route(this,q)>0&&this.missionRuns[q.id]?.state==='active'&&near(hero,this.missionRuns[q.id])<100)))amount*=.75;
    return damage.call(this,hero,amount,source);
  };
  function figure(r,point,q,label){
    if(!r.visible(point.x,point.y,90))return;
    const image=plate(label===files[q.id].left?caseURL(q):artURL(files[q.id].art)),c=r.ctx;
    c.save();c.translate(point.x,point.y);c.fillStyle='#352e23';c.fillRect(-3,-40,6,43);c.fillStyle='#f1d8a1';c.fillRect(-25,-65,50,34);
    if(image)c.drawImage(image,-23,-63,46,30);c.restore();
    r.worldLabel(label,point.x,point.y-74,'#fff0c3',13);
  }
  const labels=R.drawLocationLabels;
  R.drawLocationLabels=function(w){
    const result=labels.apply(this,arguments),g=this.game;
    for(const q of visibleFiles(g)){
      const s=sites(g,q),f=files[q.id];
      if(choices(g,q))for(const side of sides)figure(this,s[side],q,f[side]);
      if(cargoPending(g,q)){
        const p=cargo(g,q);if(this.visible(p.x,p.y,140)){this.sprite('landmarks',3,0,4,2,p.x,p.y,100,92,{py:.82});this.worldLabel('Cargo seal · '+(route(g,q)===1?'in transit':'siding'),p.x,p.y-74,'#ffe4ad',12);}
      }
      const run=g.missionRuns[q.id],plan=C.fieldDefenses[q.id];
      if(run&&plan&&run.state==='active'&&route(g,q)>0&&this.visible(run.x,run.y,180)){
        if(plan.moving)this.drawFriendly({role:'engineer',skin:q.region%3},{x:run.x,y:run.y,walk:true,flip:false});
        this.worldLabel(needsSignal(g,q,run)?plan.command:plan.name,run.x,run.y-73,'#e6e8b9',12);
      }
      if(route(g,q)===2&&this.visible(s.right.x,s.right.y,160)){
        const c=this.ctx;c.save();c.strokeStyle='#dae7c8aa';c.lineWidth=3;c.setLineDash([12,15]);c.beginPath();c.ellipse(s.right.x,s.right.y,150,150,0,0,2*Math.PI);c.stroke();c.restore();
      }
      if(rescuePending(g,q)){
        const a=evac(g,q),flag=evacuationPath(g,q).end;figure(this,flag,q,'Rally flag');
        if(this.visible(a.x,a.y,95))this.drawFriendly({role:'courier',skin:q.region%3,name:'Freed crew'},{...a,flip:flag.x<a.x,walk:true});
      }
    }
    if(!w.isDungeon&&g.completedQuests?.has('main_0_0')){
      const s=sites(g,catalogue.get('main_0_0')),p=s.left;
      if(this.visible(p.x,p.y,180)){
        for(let i=0;i<2;i++)this.drawFriendly({role:'farmer',skin:i},{x:p.x+i*58+Math.sin(this.clock*.6+i)*14,y:p.y+32,flip:false,walk:true});
        this.sprite('landmarks',3,0,4,2,p.x+103,p.y+22,105,92,{py:.82});
        this.worldLabel('Harvest crews · orchard road open',p.x+24,p.y-76,'#dbe5bb',12);
      }
    }
    return result;
  };
  const detail=U.questDetail,offer=U.dialogueOffer,celebrate=U.questCelebrationHTML;
  function note(ui,q,actions){
    const f=q&&files[q.id];if(!f)return '';
    const g=ui.game,r=route(g,q),final=q.id==='main_berlin_final',archived=r===0&&g.completedQuests.has(q.id);
    const known=r>0||archived||final&&!!g.reconDossier?.evidence.command_vault,ready=g.questProgress(q).readyForTurnIn;
    const pin=(side)=>'<button data-action="field-pin-'+side+'" data-value="'+esc(q.id)+'">Pin '+esc(f[side])+'</button>';
    const buttons=actions&&choices(g,q)?'<div class="field-lead-actions">'+sides.map(pin).join('')+'</div>':'';
    const inspect=ui.fieldInspection===q.id;
    const zoom='<button data-action="field-examine" data-value="'+esc(q.id)+'" aria-expanded="'+inspect+'">'+(inspect?'Close evidence detail':'Examine the evidence')+'</button>'+
      (inspect?'<figure class="field-evidence-zoom"><img src="'+esc(artURL(f.art))+'" alt=""><figcaption>'+esc(known?f.clue:f.left+' and '+f.right+' are the two reported sources.')+'</figcaption></figure>':'');
    return '<aside class="field-file"><div><small>'+ (archived?'RESISTANCE ARCHIVE':known?'CONFIRMED FIELD NOTE':'FIELD SOURCES')+'</small>'+(known?'<p>'+esc(f.clue)+'</p>':'')+
      (g.completedQuests.has(q.id)?'<p>'+esc(f.reply)+'</p>':final?'<p>Confirm the command relay from either vault entrance. The western document lift exposes the relay code.</p>':!known&&!ready?'<p><strong>'+esc(f.left)+'</strong> · '+esc(resultOf(q,'left'))+'<br><strong>'+esc(f.right)+'</strong> · '+esc(resultOf(q,'right'))+'</p>':'')+buttons+zoom+'</div></aside>';
  }
  const cover=q=>'<img class="assignment-cover" src="'+esc(caseURL(q))+'" alt="'+esc(q.title+' · field illustration')+'">';
  U.questDetail=function(q){return (q&&files[q.id]?cover(q):'')+detail.apply(this,arguments)+note(this,q,true);};
  U.dialogueOffer=function(){
    const q=catalogue.get(this.modernDialogueQuest),f=q&&files[q.id];let html=offer.apply(this,arguments);
    if(!f)return html;
    if(!this.game.acceptedQuests.has(q.id)){
      const preview=q.id==='main_berlin_final'?'Take the command courtyard checkpoint, then confront Adolph Whisker at the Berlin relay.':'At the marked site, inspect '+f.left+' or '+f.right+' and choose your approach.';
      html=html.replace(esc(this.objectiveText(q)),esc(preview));
    }
    return html.replace('</h3>','</h3>'+cover(q))+note(this,q,false);
  };
  const greeting=U.dialogueHome;
  U.dialogueHome=function(){
    const html=greeting.apply(this,arguments),g=this.game,who=g.npcLocation?.id;
    if(!who)return html;
    const latest=[...g.completedQuests].reverse().map(id=>catalogue.get(id)).find(q=>q&&files[q.id]&&(q.turnInNpcId||q.giverNpcId)===who);
    return latest?html.replace('</p></div>','</p><p>'+esc(files[latest.id].reply)+'</p></div>'):html;
  };
  U.questCelebrationHTML=function(){
    const html=celebrate.apply(this,arguments),q=this.activeQuestCelebration?.quest,f=q&&files[q.id];
    return f?html.replace('<div class="quest-medal">','<div class="quest-medal case-medal"><img src="'+esc(caseURL(q))+'" alt="">').replace(/(<p class="quest-celebration-thanks">)[\s\S]*?(<\/p>)/,'$1'+esc(f.reply)+'$2'):html;
  };
  const click=U.click;
  U.click=function(event){
    const btn=event.target.closest?.('button[data-action]'),action=btn?.dataset.action,q=catalogue.get(btn?.dataset.value);
    if(action==='field-examine'&&q&&files[q.id]){this.fieldInspection=this.fieldInspection===q.id?null:q.id;this.sound();this.render();return;}
    if(q&&['field-pin-left','field-pin-right'].includes(action)&&choices(this.game,q)){
      const side=action.slice('field-pin-'.length);this.game.questCounters[counter(q,'pin')]=side==='right'?2:1;
      this.game.trackQuest(q.id);this.toast('Pinned · '+files[q.id][side]);this.render();return;
    }
    return click.apply(this,arguments);
  };
  const pad=U.handlePad;U.handlePad=function(action){
    if(this.fieldInspection&&['dialogue','journal'].includes(this.menu)&&this.host.querySelector('.field-evidence-zoom')&&action==='back'){
      this.fieldInspection=null;this.render();return true;
    }
    return pad.apply(this,arguments);
  };
  const hide=U.hideMenu;U.hideMenu=function(){this.fieldInspection=null;return hide.apply(this,arguments);};
  const validate=W.Save.validData;
  W.Save.validData=function(data){
    if(!validate.call(this,data))return false;
    for(const [name,value] of Object.entries(data.questCounters||{})){
      if(!name.startsWith('fieldwork:'))continue;
      const [,id,kind]=name.split(':');if(!files[id])return false;
      if(kind==='walk'){if(!Number.isFinite(value)||value<0||value>100)return false;}
      else if(kind==='route'){if(![-1,1,2].includes(value))return false;}
      else if(kind==='pin'){if(![1,2].includes(value))return false;}
      else if(!['safe','cargo'].includes(kind)||value!==1)return false;
    }
    for(const r of Object.values(data.missionRuns||{}))if(r.fieldOrigin&&(!Number.isFinite(r.fieldOrigin.x)||!Number.isFinite(r.fieldOrigin.y)))return false;
    return true;
  };
  W.FieldAssignments={sites,route,counter,resultOf,evacuationPoint:evac,cargoPoint:cargo,caseURL};
}());
