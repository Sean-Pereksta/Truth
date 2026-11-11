(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,dist=W.dist;
  const originalProgress=G.questProgress,originalAccept=G.acceptQuest,originalSnapshot=G.snapshot,originalLoad=G.load,originalInteract=G.interact,originalUpdatePlayer=G.updatePlayer;
  G.questContact=function(q){
    if(typeof q==='string')q=W.Content.quests.find(t=>t.id===q);if(!q)return null;
    const profile=W.Content.npcs.find(n=>n.id===q.giverNpcId)||W.Content.npcs.find(n=>(n.questIds||[]).includes(q.id));
    const world=this.world.isDungeon?this.overworld:this.world;return profile?(world?.getLocation(profile.id)||null):null;
  };
  G.questsForNpc=function(npc){
    const id=typeof npc==='string'?npc:npc?.npcId||npc?.locationId||npc?.id;
    return W.Content.quests.filter(q=>(q.giverNpcId||W.Content.npcs.find(n=>(n.questIds||[]).includes(q.id))?.id)===id);
  };
  G.availableQuestsForNpc=function(npc){return this.questsForNpc(npc).filter(q=>{const state=this.questProgress(q);return state.available&&!state.complete&&!state.accepted;});};
  G.canAcceptQuestFromNpc=function(q){
    const npc=this.npcLocation,p=this.players[this.ui.playerIndex??this.shopPlayer??0]||this.players[0];
    return !this.world.isDungeon&&this.ui.isOpen&&this.ui.menu==='dialogue'&&npc&&this.questContact(q)?.id===npc.id&&p&&!p.downed&&dist(p,npc)<150;
  };
  G.acceptQuestFromNpc=function(id){
    const q=W.Content.quests.find(t=>t.id===id);if(!q||!this.canAcceptQuestFromNpc(q))return false;
    const accepted=this.acceptQuest(id);if(!accepted)return false;
    if(!this.completedQuests.has(id))this.trackQuest(id);
    this.save(false);return true;
  };
  G.questNextContact=function(q){
    if(typeof q==='string')q=W.Content.quests.find(t=>t.id===q);if(!q)return null;
    const valid=t=>t&&t.id!==q.id&&!this.completedQuests.has(t.id)&&!this.acceptedQuests.has(t.id)&&this.questProgress(t).available;
    let next=W.Content.quests.find(t=>t.id===q.nextQuestId),seen=new Set([q.id]);
    while(next&&this.completedQuests.has(next.id)&&!seen.has(next.id)){seen.add(next.id);next=W.Content.quests.find(t=>t.id===next.nextQuestId);}
    if(!valid(next))next=W.Content.quests.find(t=>valid(t)&&t.main&&t.prerequisite===q.id)||W.Content.quests.find(t=>valid(t)&&t.region===q.region&&t.giverNpcId!==q.giverNpcId)||W.Content.quests.find(t=>valid(t)&&t.main);
    const npc=next&&this.questContact(next);if(!npc)return null;
    const world=this.world.isDungeon?this.overworld:this.world,town=world.getLocation(npc.townId);
    return{quest:next,npc,text:'Next: speak with '+npc.name+(town?' at '+town.name:'')+' about “'+next.title+'”.'};
  };
  G.followQuestContact=function(q){
    const next=this.questNextContact(q);if(!next)return false;
    this.trackedQuest=next.quest.id;const marker={x:next.npc.x,y:next.npc.y};
    if(this.world.isDungeon)this.dungeonMarker=marker;else this.marker=marker;
    this.ui.toast(next.text,'quest');return true;
  };
  G.questProgress=function(id){const q=typeof id==='object'?id:W.Content.quests.find(t=>t.id===id),base=originalProgress.call(this,id);if(!q)return base;
    if(q.requiresAllBosses)base.available=base.available&&this.world.berlinUnlocked();
    if(q.steps){const run=this.missionRuns[q.id];base.current=this.missionCompleted.has(q.id)?base.required:Math.min(base.required,run?.stepIndex||0);}
    if(['escort','defend'].includes(q.type))base.current=this.missionCompleted.has(q.id)?base.required:0;
    if(['assassination','bounty'].includes(q.type)){const ids=Array.isArray(q.target)?q.target:[q.target];base.current=ids.filter(t=>this.world.dead.has(t)||this.world.liberated.has(t)).length;}
    base.ready=base.current>=base.required;return base;
  };
  G.questTarget=function(q){
    if(typeof q==='string')q=W.Content.quests.find(t=>t.id===q);if(!q)return null;
    if(!this.acceptedQuests.has(q.id)&&!this.completedQuests.has(q.id)){const npc=this.questContact(q);return npc?{x:npc.x,y:npc.y,label:'Speak with '+npc.name}:null;}
    if(this.completedQuests.has(q.id)){const next=this.questNextContact(q);return next?{x:next.npc.x,y:next.npc.y,label:'Next contact: '+next.npc.name}:null;}
    const run=this.missionRuns[q.id];
    if(q.steps){const step=q.steps[run?.stepIndex||0];if(!step)return null;const target=step.targets.find(id=>!run?.completedTargets?.includes(id))||step.targets[0],l=this.world.getLocation(target);return l?{x:l.x,y:l.y,label:l.name||step.label}:null;}
    if(q.requiresAllBosses&&!this.world.berlinUnlocked()){const gate=this.world.berlinSector.gate;return{x:gate.x-100,y:gate.y,label:'Berlin gate · defeat all eight commanders'};}
    if(run?.type==='escort'&&run.state==='active'){const p=this.players[0];return dist(p,run)>170?{x:run.x,y:run.y,label:'Meet your escort'}:{x:run.targetX,y:run.targetY,label:'Escort rendezvous'};}
    const id=Array.isArray(q.target)?q.target[0]:q.target,enemy=this.world._spawns?.get(id);
    if(enemy)return{x:enemy.x,y:enemy.y,label:q.targetName||enemy.name||'Wanted officer'};
    const l=this.world.locations.find(l=>l.id===id||l.id===q.targetLocation);if(l)return{x:l.x,y:l.y,label:l.name};
    if(q.destX!=null)return{x:q.destX,y:q.destY,label:'Escort rendezvous'};
    if(q.destination)return{x:q.destination.x,y:q.destination.y,label:'Escort rendezvous'};
    const r=this.world.regions[q.region||0];return{x:r.x+r.w*.5,y:r.y+r.h*.5,label:r.name};
  };
  G.questObjectiveText=function(q){
    if(typeof q==='string')q=W.Content.quests.find(t=>t.id===q);if(!q)return'Visit a quest scout to choose a mission.';
    const run=this.missionRuns[q.id],prog=this.questProgress(q);if(prog.complete)return'Completed · rewards collected. '+(this.questNextContact(q)?.text||'Explore the kingdom for remaining requests.');
    if(!prog.accepted){const npc=this.questContact(q),world=this.world.isDungeon?this.overworld:this.world,town=npc&&world.getLocation(npc.townId);return'Speak with '+(npc?.name||'the quest giver')+(town?' at '+town.name:'')+' to accept this assignment.';}
    if(q.steps){const step=q.steps[run?.stepIndex||0];if(!step)return'All objectives complete.';const done=run?.completedTargets?.length||0,total=step.targets.length,channel=run?.channelTarget?' · '+Math.ceil(Math.max(0,step.duration-(run.elapsed||0)))+'s remaining':['scan','hold'].includes(step.action)?' · '+step.duration+'s uninterrupted channel (no kill deadline)':'';return'Step '+((run?.stepIndex||0)+1)+' / '+q.steps.length+' · '+step.label+(total>1?' · '+done+' / '+total:'')+channel+'.'+(step.medkit?' Each patient requires one medkit.':'')+(step.materials?' Requires '+step.materials+' materials.':'');}
    if(q.requiresAllBosses&&!this.world.berlinUnlocked())return'Berlin is sealed. Defeat the remaining '+this.world.remainingMajorBosses().length+' regional commander(s), then confront Adolph Whisker.';
    if(q.type==='escort')return run?.state==='failed'?'Escort lost. Speak with the quest scout to retry.':run?'Stay within 340m of your ally and guide them to the rendezvous.':'Accept this job, then meet your ally outside the settlement.';
    if(q.type==='defend')return run?.state==='complete'?'Area held. The supply convoy is safe.':run?'Hold the area for '+run.duration+' seconds · '+Math.ceil(Math.max(0,run.duration-run.elapsed))+'s remaining. '+(this.players.some(p=>!p.downed&&dist(p,run)<190)?'Progress active.':'PAUSED — return inside the marked circle.')+' Survive the attack; defeating every enemy is not required.':'Hold the area for 45 seconds. Leaving the circle pauses progress; there is no kill deadline.';
    if(q.type==='assassination')return'Find and defeat '+(q.targetName||'the marked enemy officer')+'.';
    if(q.type==='bounty')return'Wanted: '+(q.targetName||'the marked general')+'. Defeat this target to collect the bounty.';
    if(q.type==='kill')return'Defeat '+prog.required+' occupying troops in this region: '+prog.current+' / '+prog.required+'.';
    if(q.type==='cache')return'Find the marked chest and interact to recover its supplies.';
    if(q.type==='explore')return'Reach the marked hidden landmark.';
    if(q.type==='rescue')return'Clear every guard at the marked prison to free the captives.';
    if(q.type==='convoy')return'Defeat the guards at the marked convoy supply depot.';
    return q.type==='boss'?(q.requiresAllBosses?'Defeat Adolph Whisker in the Berlin Sector to win the campaign.':'Defeat the regional commander. Their defeat breaks the stronghold’s command.'):'Defeat every guard in the marked outpost to liberate it.';
  };
  G.acceptQuest=function(id){
    if(!originalAccept.call(this,id))return false;
    const q=W.Content.quests.find(t=>t.id===id);if(this.completedQuests.has(id))return true;
    if(q.steps){if(this.missionRuns[id]?.state==='active')return true;const target=this.questTarget(q);this.missionRuns[id]={questId:id,type:q.type,state:'active',stepIndex:0,completedTargets:[],elapsed:0,x:target.x,y:target.y,carry:false,wave:0};this.save(false);return true;}
    if(!['escort','defend'].includes(q.type))return true;
    if(this.missionRuns[id]?.state==='active')return true;
    for(const e of this.world.activeEnemies)if(e.missionTarget===id){e.hp=0;e.dead=true;}
    const target=this.questTarget(q),town=this.world.locations.find(l=>l.id==='town_'+q.region)||this.world.locations.find(l=>l.type==='town');
    this.missionRuns[id]=q.type==='escort'?{questId:id,type:'escort',x:q.startX??town.x,y:q.startY??town.y+180,targetX:q.destX??q.destination?.x??target.x,targetY:q.destY??q.destination?.y??target.y,hp:320+(q.region||0)*55,maxHp:320+(q.region||0)*55,state:'active',skin:1,armorSet:0,angle:0,anim:'idle',animTime:0,moveTime:0,elapsed:0,wave:0,friendlyRole:3}:{questId:id,type:'defend',x:target.x,y:target.y,elapsed:0,duration:q.duration||45,wave:0,state:'active'};
    this.missionRuns[id].instanceId=id+'-'+Math.round(this.time*1000)+'-'+Math.floor(Math.random()*1000000);
    this.ui.toast(q.type==='escort'?'Your ally is waiting outside the settlement.':'Hold the area for 45 seconds. Enter the circle to begin; leaving pauses progress. You do not need to defeat every enemy.','quest');this.save(false);return true;
  };
  G.trackQuest=function(id){
    const state=this.questProgress(id);if(!state.available||state.complete)return false;
    this.trackedQuest=id;const target=this.questTarget(id);
    if(target){this.marker={x:target.x,y:target.y};if(this.world.isDungeon&&!state.accepted){const npc=this.questContact(id);if(npc)this.dungeonMarker={x:npc.x,y:npc.y};}}
    this.ui.toast(state.accepted?'Mission tracked':'Quest giver marked. Speak with them to accept the assignment.','quest');this.save(false);return true;
  };
  G.operationCompleteTarget=function(q,run,id,p){
    const step=q.steps[run.stepIndex];if(!step||run.completedTargets.includes(id))return;
    run.completedTargets.push(id);run.channelTarget=null;run.elapsed=0;
    if(step.carry){run.carry=true;run.carrierId=p.id;}
    if(step.consumeCarry)run.carry=false;
    if(run.completedTargets.length>=step.targets.length){
      if(step.action==='detonate')for(const n of step.blastTargets||[]){const l=this.world.getLocation(q.objectives[n]?.id);if(l)this.explode(l.x,l.y,170,260+(q.region||0)*30,p.id);}
      run.stepIndex++;run.completedTargets=[];run.wave=0;
      if(run.stepIndex>=q.steps.length){run.state='complete';run.carry=false;this.missionCompleted.add(q.id);this.ui.toast(q.title+' · all objectives completed.','quest');this.checkQuests();}
      else{const target=this.questTarget(q);if(target){run.x=target.x;run.y=target.y;if(this.trackedQuest===q.id)this.marker={x:target.x,y:target.y};}this.ui.toast('Next: '+q.steps[run.stepIndex].label,'quest');}
    }else this.ui.toast(step.label+' · '+run.completedTargets.length+' / '+step.targets.length,'quest');
    this.save(false);
  };
  G.handleMissionInteraction=function(p){
    if(this.paused||p.downed)return false;
    const options=[];
    for(const q of W.Content.quests){const run=this.missionRuns[q.id];if(!q.steps||run?.state!=='active')continue;const step=q.steps[run.stepIndex];if(!step)continue;for(const id of step.targets){if(run.completedTargets.includes(id))continue;const l=this.world.getLocation(id);if(l&&dist(p,l)<105)options.push({q,run,step,l,d:dist(p,l)});}}
    options.sort((a,b)=>a.d-b.d);
    if(options.length){const{q,run,step,l}=options[0];
      if(step.medkit&&p.medkits<1){this.ui.toast('This wounded cat needs one field medkit. Rest at a settlement or buy supplies.','error');return true;}
      if(step.materials&&(p.materials||0)<step.materials){this.ui.toast('Repair requires '+step.materials+' materials.','error');return true;}
      if(['scan','hold'].includes(step.action)){
        if(run.channelTarget!==l.id){run.channelTarget=l.id;run.elapsed=0;run.x=l.x;run.y=l.y;run.channelPlayer=p.id;run.channelHp=p.hp;this.ui.toast(step.action==='scan'?'Recording started. Stay close and clear of nearby hostiles.':'Uplink started. Hold this position.','quest');if(step.ambush){this.missionWave(run,q,step.ambush);run.wave=1;}}return true;
      }
      if(step.medkit){p.medkits--;this.effect('heal',l.x,l.y,70,1);this.ui.toast(l.name+' is stable.','quest');}
      if(step.materials)p.materials-=step.materials;
      this.operationCompleteTarget(q,run,l.id,p);return true;
    }
    return false;
  };
  G.interact=function(p){
    if(this.players.some(other=>other!==p&&other.downed&&dist(p,other)<100))return originalInteract.call(this,p);
    if(this.handleMissionInteraction(p))return;
    if(!this.paused&&!p.downed){const bounty=this.world.locations.filter(l=>l.type==='bounty'&&dist(p,l)<110).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(bounty){this.bountyLocation=bounty;this.shopPlayer=p.id;this.ui.showMenu('bounty',p.id);return;}}
    return originalInteract.call(this,p);
  };
  G.updatePlayer=function(p,input,dt){
    const carrying=Object.values(this.missionRuns).some(run=>run.state==='active'&&run.carry&&(run.carrierId==null||run.carrierId===p.id));
    return originalUpdatePlayer.call(this,p,carrying?Object.assign({},input,{mx:(input.mx||0)*.78,my:(input.my||0)*.78}):input,dt);
  };
  G.updateMissions=function(dt){
    this.interactionPrompt='';
    for(const [id,run]of Object.entries(this.missionRuns)){
      if(run.state!=='active')continue;const q=W.Content.quests.find(t=>t.id===id);if(!q)continue;
      const near=this.players.filter(p=>!p.downed).sort((a,b)=>dist(a,run)-dist(b,run))[0];if(!near)continue;
      // Dormant escorts do not run pathfinding or event simulation on the other side of the kingdom.
      if(dist(near,run)>1600)continue;
      if(q.steps){
        const step=q.steps[run.stepIndex];if(!step)continue;
        const nearby=step.targets.map(t=>this.world.getLocation(t)).filter(l=>l&&!run.completedTargets.includes(l.id)).sort((a,b)=>dist(near,a)-dist(near,b))[0];
        if(nearby&&dist(near,nearby)<110)this.interactionPrompt='E / B · '+step.label+(step.medkit?' · 1 medkit':'');
        if(run.channelTarget){const l=this.world.getLocation(run.channelTarget),operator=this.players.find(p=>p.id===run.channelPlayer&&!p.downed);const danger=l&&step.action==='scan'&&this.world.activeEnemies.some(e=>e.hp>0&&!e.dead&&dist(e,l)<180),hurt=step.action==='scan'&&operator&&operator.hp<run.channelHp;
          if(!l||!operator||dist(operator,l)>110||danger||hurt){run.channelTarget=null;run.elapsed=0;this.ui.toast(danger?'Recording interrupted by nearby enemies. Clear the area, then interact again.':'Signal interrupted. Return to the point and interact to restart the '+step.duration+'-second channel.','error');}
          else{run.elapsed+=dt;if(run.elapsed>=step.duration)this.operationCompleteTarget(q,run,l.id,operator);}
        }
        continue;
      }
      if(run.resumeWave&&!this.safeZoneAt(run.x,run.y)&&dist(near,run)<400){this.missionWave(run,q,3);run.resumeWave=false;}
      if(run.type==='escort'){
        run.animTime+=dt;const gap=dist(near,run);run.anim='idle';
        if(run.hp<=0){run.state='failed';this.ui.toast('Escort lost. Return to a quest scout to retry.','error');continue;}
        if(gap<340&&gap>60&&!run.arrived){const target={x:run.targetX,y:run.targetY},speed=q.escortSpeed||100;run.angle=Math.atan2(target.y-run.y,target.x-run.x);const nav=this.lineOfSight(run,target)?{mx:Math.cos(run.angle),my:Math.sin(run.angle)}:this.world.steerAround(run,target,dt);this.move(run,nav.mx*speed*dt,nav.my*speed*dt,17);run.moveTime+=dt;run.anim='run';run.velocityX=nav.mx*speed;run.velocityY=nav.my*speed;}
        else{run.velocityX=0;run.velocityY=0;}
        run.elapsed+=gap<500?dt:0;
        if(run.elapsed>run.wave*8+3&&run.wave<(q.waveCount||2)&&!this.safeZoneAt(run.x,run.y)){this.missionWave(run,q,3);run.wave++;}
        if(Math.hypot(run.x-run.targetX,run.y-run.targetY)<85){run.arrived=true;if(!this.world.activeEnemies.some(e=>e.missionTarget===id&&e.hp>0&&!e.dead&&dist(e,run)<650)){run.state='complete';this.missionCompleted.add(id);this.ui.toast('Escort safe. Your ally reached the rendezvous.','quest');this.checkQuests();this.save(false);}}
      }else if(run.type==='defend'){
        const inside=dist(near,run)<190;
        if(run.holdInside&&!inside)this.ui.toast('HOLD PAUSED · return inside the marked circle. Your earned seconds are safe.','event');
        if(run.holdInside===false&&inside&&run.elapsed>0)this.ui.toast('Hold resumed · '+Math.ceil(Math.max(0,run.duration-run.elapsed))+' seconds remaining.','quest');
        run.holdInside=inside;
        if(inside){run.elapsed=Math.min(run.duration,run.elapsed+dt);if(run.elapsed>run.wave*14&&run.wave<(q.waveCount||3)){this.missionWave(run,q,3+run.wave);run.wave++;}}
        if(run.elapsed>=run.duration){run.state='complete';this.missionCompleted.add(id);this.ui.toast('Supply point defended. The resistance thanks you.','quest');this.checkQuests();this.save(false);}
      }
    }
  };
  G.missionWave=function(run,q,count){
    run.instanceId=run.instanceId||q.id+'-'+Math.round(this.time*1000)+'-'+Math.floor(Math.random()*1000000);
    this.ui.toast(run.type==='escort'?'Ambush! Protect your ally.':'Enemy wave approaching the supply point.','event');
    for(let i=0;i<count;i++){
      if(this.world.activeEnemies.length>=W.config.maxEnemies)break;
      const a=i/count*Math.PI*2+run.wave,x=W.clamp(run.x+Math.cos(a)*520,60,this.world.width-60),y=W.clamp(run.y+Math.sin(a)*520,60,this.world.height-60);
      if(this.world.isBlocked(x,y,20)||this.safeZoneAt(x,y))continue;
      const type=i===count-1?24:(q.region||0)>3?18:0,s=W.Content.enemies[type],level=this.world.regions[q.region||0].level;
      this.world.addEnemy({id:'mission-'+run.instanceId+'-'+run.wave+'-'+i,x,y,homeX:x,homeY:y,type,level,region:q.region||0,hp:s.hp*(1+level*.12),maxHp:s.hp*(1+level*.12),angle:a+Math.PI,anim:'run',animTime:0,state:'chase',alert:20,ephemeral:true,missionTarget:q.id});
    }
  };
  G.snapshot=function(){return Object.assign(originalSnapshot.call(this),{missionRuns:this.missionRuns,missionCompleted:[...this.missionCompleted],missionEnemies:this.world.activeEnemies.filter(e=>e.missionTarget&&e.hp>0&&!e.dead).map(e=>Object.assign({},e,{specialMove:null,jumpHeight:0}))});};
  G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;const runs=this.missionRuns,completed=this.missionCompleted;let ok;
    W.World.migrateSaveCoordinates?.(data);this.missionRuns=data.missionRuns||{};this.missionCompleted=new Set(data.missionCompleted||[]);if(!Array.isArray(data.missionEnemies))for(const run of Object.values(this.missionRuns))if(run.state==='active'&&run.wave>0)run.resumeWave=true;
    try{ok=originalLoad.call(this,slot);}finally{if(!ok){this.missionRuns=runs;this.missionCompleted=completed;}}
    if(ok&&Array.isArray(data.missionEnemies))for(const e of data.missionEnemies)if(e&&e.hp>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&W.Content.enemies[e.type]&&this.missionRuns[e.missionTarget]?.state==='active')this.world.addEnemy(e);
    return ok;
  };
}());
