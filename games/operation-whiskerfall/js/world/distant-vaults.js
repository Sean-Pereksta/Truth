(function(){
  'use strict';
  const W=window.OW,C=W.Content,G=W.Game?.prototype,R=W.Renderer?.prototype;
  C.installDistantVaultSites(W.World);if(!G||!R)return;
  const specs=C.distantVaults,keys=C.distantVaultKeys,copy=v=>JSON.parse(JSON.stringify(v)),live=e=>e&&e.hp>0&&!e.dead,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),specFor=id=>specs.find(s=>s.id===id),surface=g=>g.world.isDungeon?g.overworld:g.world;
  const guardianName=w=>w.vaultSpec?.kraken?'Nacremaw, the Great Kraken':W.DungeonGuardians[w.config.guardian].name;
  const inside=(p,r)=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h;
  function floors(w){return w.vaultSpec.bridge&&w.state.solved?[...w.rooms,w.vaultSpec.bridge]:w.rooms;}
  function blocked(x,y,r=16){
    const floor=floors(this),valid=(x,y)=>floor.some(a=>inside({x,y},a));
    if(![[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.707,r*.707],[-r*.707,r*.707],[r*.707,-r*.707],[-r*.707,-r*.707]].every(([dx,dy])=>valid(x+dx,y+dy)))return true;
    if(!this.state.solved&&x+r>1020&&x-r<1115&&y+r>520&&y-r<720)return true;
    if(!this.state.bossDead&&x+r>1400&&x-r<1580&&y+r>1080&&y-r<1170)return true;
    return false;
  }
  function clearPoint(w,x,y,r=20){for(let ring=0;ring<10;ring++)for(let n=0;n<(ring?16:1);n++){const a=n*Math.PI/8,p={x:x+Math.cos(a)*ring*28,y:y+Math.sin(a)*ring*28};if(!w.isBlocked(p.x,p.y,r))return p;}return null;}
  function guard(g,id,type,p,region,level){const s=C.enemies[type],hp=Math.round(s.hp*(1+level*.08)*(g.players.length>1?1.15:1));return{id,type,...p,homeX:p.x,homeY:p.y,region,level,hp,maxHp:hp,regionScaleApplied:true,angle:0,state:'patrol',anim:'idle',animTime:0,alert:0,fireTimer:1.1,attackTimer:1.1,specialTimer:1.5,ephemeral:true,distantVaultGuard:true};}
  function adapt(g,positions){
    const w=g.world,s=specFor(w.entry.id);if(!s)return;w.vaultSpec=s;w.rooms=s.rooms;w.isBlocked=blocked;w.name=s.name;w.state.vaultNodes=s.nodes.map((_,i)=>w.state.vaultNodes?.[i]===true);
    if(w.state.solved)w.state.vaultNodes=s.nodes.map(()=>true);
    const saved=new Map((w.state.enemies||[]).map(e=>[e.id,e])),keep=w.activeEnemies.filter(e=>e.dungeonBoss||e.guardianOwner);w.activeEnemies=keep;w._active.clear();w._dormant.clear();for(const e of keep)w._active.set(e.id,e);
    if(s.kraken&&!w.state.bossDead){w.state.krakenPartySize=w.state.krakenPartySize===2?2:w.state.krakenPartySize===1?1:g.players.length>1?2:1;const boss=keep.find(e=>e.dungeonBoss),old=saved.get(s.id+'_guardian'),max=w.state.krakenPartySize===2?72000:48000;if(boss)Object.assign(boss,{kraken:true,name:'Nacremaw, the Great Kraken',artKey:'kraken',hp:old?max*W.clamp(old.hp/(old.maxHp||max),0,1):max,maxHp:max,damage:110});}
    for(const [i,xy]of s.spawns.entries()){const id=s.id+'_vault_guard_'+i;if(w.dead.has(id))continue;const point=clearPoint(w,xy[0],xy[1]);if(!point)continue;const old=saved.get(id);if(old&&!live(old))continue;const e=old?{...old,prismAction:null,combatAction:null,combatState:null,fireTimer:1}:guard(g,id,i%2?C.prismSentryType:0,point,s.region,s.level);if(w.isBlocked(e.x,e.y,20))Object.assign(e,point);w.addEnemy(e);}
    for(const [i,p]of g.players.entries()){const wanted=positions?.[i]||p,point=clearPoint(w,wanted.x,wanted.y,19)||{x:570+i*55,y:1400};p.x=point.x;p.y=point.y;}
    w.locations[2].name=s.instruction;w.locations[2].x=580;w.locations[2].y=1320;w._rebuildEnemyGrid();g.camera.x=g.players[0].x;g.camera.y=g.players[0].y;
  }
  G.hasDistantVaultKey=function(id){return !id||this.distantVaultKeys?.has(id)||false;};
  G.distantVaultEntryReason=function(entry){const spec=specFor(typeof entry==='string'?entry:entry?.id),key=keys.find(k=>k.id===spec?.keyId);return key&&!this.hasDistantVaultKey(key.id)?'Locked · '+key.name+' required. '+key.clue:'';};
  const enter=G.enterDungeon;
  G.enterDungeon=function(entry,restoring=false,positions){
    const spec=specFor(entry?.id);if(!spec)return enter.apply(this,arguments);
    const reason=this.distantVaultEntryReason(entry);if(reason){this.ui.toast(reason,'quest');return false;}
    // The base constructor uses the legacy floor plan. Adapt before the first
    // checkpoint so no temporary old layout or duplicated den enters a save.
    const save=this.save;let ok;this.save=()=>false;try{ok=enter.apply(this,arguments);}finally{this.save=save;}
    if(ok){adapt(this,positions);if(!restoring){this.ui.toast(spec.name+' · '+spec.instruction,'quest');this.save(false);}}return ok;
  };
  G.activateDistantVaultNode=function(index,p=this.players[0]){
    const w=this.world,s=w.vaultSpec,n=s?.nodes[index];if(!s||!n||p.downed||dist(p,n)>105||w.state.solved)return false;
    if(n.requires?.some(i=>!w.state.vaultNodes[i])){this.ui.toast('First activate '+n.requires.filter(i=>!w.state.vaultNodes[i]).map(i=>s.nodes[i].name).join(' and ')+'.');return false;}
    if(w.state.vaultNodes[index]){this.ui.toast(n.name+' is already active.');return false;}
    w.state.vaultNodes[index]=true;this.effect('shockwave',n.x,n.y,70,.6,{color:s.color});this.audio.play('ui');
    if(s.nodes.every((_,i)=>w.state.vaultNodes[i])){w.state.solved=true;this.ui.toast('The guardian bridge is open. '+guardianName(w)+' awaits.','quest');this.audio.play('quest');}else this.ui.toast(n.name+' active · '+w.state.vaultNodes.filter(Boolean).length+'/'+s.nodes.length+' mechanisms.');
    this.save(false);return true;
  };
  const puzzle=G.puzzleAction;G.puzzleAction=function(){if(this.world.vaultSpec)return false;return puzzle.apply(this,arguments);};
  const projectile=W.Dungeons.hitProjectile;W.Dungeons.hitProjectile=function(g,...args){const w=g.world;if(!w.vaultSpec)return projectile(g,...args);const solved=w.state.solved;try{w.state.solved=true;return projectile(g,...args);}finally{w.state.solved=solved;}};
  function syncKeyRuns(g,restore=false){
    const w=surface(g);if(!w)return;
    for(const [keyId,run]of Object.entries(g.distantVaultKeyRuns||{})){
      if(g.hasDistantVaultKey(keyId))continue;const key=keys.find(k=>k.id===keyId),site=key&&w.getLocation(key.site);if(!site)continue;
      for(const record of run.records||[]){if(w.dead.has(record.id)){record.dead=true;record.hp=0;continue;}
        const e=w.activeEnemies.find(e=>e.id===record.id)||w._active.get(record.id)||w._dormant.get(record.id);if(e){Object.assign(record,copy({...e,prismAction:null,combatAction:null,combatState:null}));}
        else if(restore&&!g.world.isDungeon&&live(record)&&g.players.some(p=>dist(p,site)<650)){const p=clearPoint(w,record.x,record.y);if(p)w.addEnemy({...record,...p,prismAction:null,fireTimer:1});}
      }
    }
  }
  G.collectDistantVaultKey=function(id,p=this.players[0]){
    const key=keys.find(k=>k.id===id),w=this.world,site=key&&w.getLocation(key.site);if(!site||w.isDungeon||p.downed||dist(p,site)>115)return false;
    if(this.hasDistantVaultKey(id)){this.ui.toast(key.name+' is already on the shared keyring.');return false;}
    this.distantVaultKeyRuns=this.distantVaultKeyRuns||{};let run=this.distantVaultKeyRuns[id];
    if(!run){
      if(w.activeEnemies.filter(live).length+3>W.config.maxEnemies){this.ui.toast('Clear nearby hostiles before investigating the guarded cache.');return false;}
      const records=[];for(let i=0;i<3;i++){const a=i*Math.PI*2/3,p=clearPoint(w,site.x+Math.cos(a)*150,site.y+Math.sin(a)*150);if(!p||w.safeZoneAt(p.x,p.y)){this.ui.toast('The patrol is regrouping. Approach again from the trail.');return false;}records.push({...guard(this,'vault-key-'+id+'-'+i,i===1?C.prismSentryType:0,p,key.region,key.level),missionTarget:'vault-key-'+id});}
      run=this.distantVaultKeyRuns[id]={records};for(const e of records){w.addEnemy({...e});this.effect('reinforcement',e.x,e.y,42,.7);}this.ui.toast('Guarded cache · defeat all three sentries, then collect '+key.name+'. No time limit.','quest');this.save(false);return false;
    }
    syncKeyRuns(this,true);const remaining=run.records.filter(live).length;if(remaining){this.ui.toast(remaining+' cache guards remain.');return false;}
    this.distantVaultKeys=this.distantVaultKeys||new Set();this.distantVaultKeys.add(id);w.opened.add(site.id);this.ui.toast('Shared key found · '+key.name+' · permanently opens its dungeon for both heroes.','loot');this.audio.play('pickup');this.save(false);return true;
  };
  const interact=G.interact;G.interact=function(p){
    if(this.paused||p.downed)return interact.apply(this,arguments);if(this.players.some(q=>q!==p&&q.downed&&dist(q,p)<100))return interact.apply(this,arguments);
    const w=this.world,s=w.vaultSpec;
    if(!s){const key=keys.find(k=>{const site=w.getLocation(k.site);return site&&dist(site,p)<115;});if(key)return this.collectDistantVaultKey(key.id,p);return interact.apply(this,arguments);}
    const treasure=w.locations[1];if(dist(p,treasure)<125){
      if(!w.state.bossDead){this.ui.toast('Defeat the guardian before recovering the expedition seal.');return false;}if(w.state.claimed){this.ui.toast('The expedition seal has already been recovered.');return false;}
      w.state.claimed=true;this.questStats.caches.add(w.entry.id);this.overworld.opened.add(w.entry.id);this.overworld.discovered.add(w.entry.id);this.ui.toast('Expedition seal recovered · return to '+s.npcName+'. '+s.rewardStatement,'quest');this.checkQuests();this.save(false);return true;
    }
    const index=s.nodes.findIndex(n=>dist(n,p)<105);if(index>=0)return this.activateDistantVaultNode(index,p);
    if(dist(p,w.locations[2])<120){this.ui.toast(s.instruction,'quest');return true;}
    if(dist(p,w.locations[0])<125||dist(p,{x:820,y:1460})<105)return interact.apply(this,arguments);
    this.ui.toast(w.state.solved?'Cross the open bridge, defeat the guardian and recover the expedition seal.':s.instruction);return false;
  };
  const missions=G.updateMissions;G.updateMissions=function(dt){const result=missions.apply(this,arguments);if(this.paused||this.world.isDungeon)return result;syncKeyRuns(this,true);
    for(const s of specs){const npc=this.world.getLocation(s.npcId);if(npc&&!this.questCounters['discovered:'+s.questId]&&this.players.some(p=>!p.downed&&dist(p,npc)<260)){this.questCounters['discovered:'+s.questId]=1;this.ui.toast('Hidden expedition discovered · '+s.title+' · speak with '+s.npcName+'.','quest');this.save(false);}}
    return result;
  };
  const progress=G.questProgress;G.questProgress=function(id){const q=typeof id==='object'?id:C.quests.find(q=>q.id===id),v=progress.apply(this,arguments);if(q?.distantVault&&!v.accepted&&!v.complete&&!this.questCounters?.['discovered:'+q.id])v.available=false;return v;};
  const target=G.questTarget;G.questTarget=function(id){const q=typeof id==='object'?id:C.quests.find(q=>q.id===id),s=specs.find(s=>s.questId===q?.id);if(!s||!this.acceptedQuests.has(q.id)||this.questProgress(q).readyForTurnIn)return target.apply(this,arguments);
    if(this.world.vaultSpec?.id===s.id&&!this.world.state.solved){const i=s.nodes.findIndex((n,i)=>!this.world.state.vaultNodes[i]&&!n.requires?.some(j=>!this.world.state.vaultNodes[j]));return{...s.nodes[Math.max(0,i)],label:'Activate '+s.nodes[Math.max(0,i)].name};}
    if(this.world.vaultSpec?.id===s.id&&!this.world.state.bossDead)return{x:1470,y:650,label:guardianName(this.world)};
    if(!this.world.isDungeon&&s.keyId&&!this.hasDistantVaultKey(s.keyId)){const k=keys.find(k=>k.id===s.keyId);return{...this.world.getLocation(k.site),label:'Recover '+k.name};}return target.apply(this,arguments);
  };
  const objective=G.questObjectiveText;G.questObjectiveText=function(id){const q=typeof id==='object'?id:C.quests.find(q=>q.id===id),s=specs.find(s=>s.questId===q?.id);if(!s||this.questProgress(q).readyForTurnIn||this.completedQuests.has(q.id))return objective.apply(this,arguments);if(s.keyId&&!this.hasDistantVaultKey(s.keyId))return keys.find(k=>k.id===s.keyId).clue;if(this.world.vaultSpec?.id===s.id&&!this.world.state.solved)return s.instruction+' '+this.world.state.vaultNodes.filter(Boolean).length+'/'+s.nodes.length+' active.';const state=this.dungeonStates?.[s.id];if(s.kraken&&this.acceptedQuests.has(q.id)&&state?.solved&&!state.bossDead)return'The tide gate is open. Defeat Nacremaw, the Great Kraken in the Drowned Maw, then recover its expedition seal.';return objective.apply(this,arguments);};
  const snapshot=G.snapshot;G.snapshot=function(){syncKeyRuns(this);const data=snapshot.apply(this,arguments);data.distantVaultKeys=[...(this.distantVaultKeys||[])];data.distantVaultKeyRuns=copy(this.distantVaultKeyRuns||{});return data;};
  const load=G.load;G.load=function(slot=0){const data=W.Save.read(slot),before=[this.distantVaultKeys,this.distantVaultKeyRuns];if(data){this.distantVaultKeys=new Set((data.distantVaultKeys||[]).filter(id=>keys.some(k=>k.id===id)));this.distantVaultKeyRuns=copy(data.distantVaultKeyRuns||{});}const ok=load.apply(this,arguments);if(!ok)[this.distantVaultKeys,this.distantVaultKeyRuns]=before;return ok;};
  const start=G.start;G.start=function(options={}){if(!options.load){this.distantVaultKeys=new Set();this.distantVaultKeyRuns={};}return start.apply(this,arguments);};
  const enemyDamage=G.enemyDamage;G.enemyDamage=function(e,spec,multiplier=1){const expedition=e.distantVaultGuard||String(e.id).startsWith('vault-key-')||specs.some(s=>String(e.id).startsWith(s.id+'_vault_guard_'));return expedition?(spec.damage||12)*(1+(e.level||1)*.065)*(1+(e.region||0)*.04)*multiplier:enemyDamage.apply(this,arguments);};
  const label=(c,text,x,y,size=14,color='#e1e8da')=>{c.save();c.fillStyle=color;c.font='bold '+size+'px sans-serif';c.textAlign='center';c.strokeStyle='#07151c';c.lineWidth=3.5;c.strokeText(text,x,y);c.fillText(text,x,y);c.restore();};
  const terrain=R.drawTerrain;R.drawTerrain=function(w){if(!w.vaultSpec)return terrain.apply(this,arguments);const c=this.ctx,s=w.vaultSpec,clock=this.clock||0,illustrated=W.DistantVaultScenery?.drawGround(this,w);if(!illustrated){c.fillStyle='#0d1821';c.fillRect(0,0,w.width,w.height);
    for(const h of s.holes){c.fillStyle=s.region===6?'#5b281e':'#163c52';c.fillRect(h.x,h.y,h.w,h.h);c.strokeStyle=s.color;c.globalAlpha=.25;for(let y=h.y+20;y<h.y+h.h;y+=35){c.beginPath();c.moveTo(h.x+12,y);c.lineTo(h.x+h.w-12,y+Math.sin(clock+y)*5);c.stroke();}c.globalAlpha=1;}
    for(const r of floors(w)){c.fillStyle='#586266';c.fillRect(r.x-9,r.y-9,r.w+18,r.h+18);c.fillStyle='#293f48';c.fillRect(r.x,r.y,r.w,r.h);}
    c.save();c.beginPath();for(const r of floors(w))c.rect(r.x,r.y,r.w,r.h);c.clip();for(let y=192;y<1664;y+=128)for(let x=128;x<1792;x+=128){if(!W.Art?.draw(this,'dungeonFloors',s.region%4,Math.floor(s.region/4),x,y,128,128,{fullCell:true,px:0,py:0})){c.strokeStyle='#40515a';c.strokeRect(x,y,128,128);}}c.restore();}
    if(s.bridge){if(!illustrated){c.fillStyle=w.state.solved?'#83aaa1':'#8d4127';c.fillRect(s.bridge.x,s.bridge.y,s.bridge.w,s.bridge.h);}label(c,w.state.solved?'COOLED CROSSING':'FURNACE · BOTH VALVES REQUIRED',580,665,11);}
    for(const [i,n]of s.nodes.entries()){const active=w.state.vaultNodes[i];c.fillStyle=active?'#8ddab8':'#24333c';c.strokeStyle=s.color;c.lineWidth=4;c.beginPath();c.arc(n.x,n.y,30,0,Math.PI*2);c.fill();c.stroke();if(!W.DistantVaultScenery?.drawDevice(this,w,n,i))label(c,active?'ON':String(i+1),n.x,n.y+6,20,active?'#173d39':s.color);label(c,(active?'ACTIVE · ':'')+n.name,n.x,n.y+53,13,active?'#b5f1ca':'#e1e8da');if(!active)label(c,'E / B · ACTIVATE',n.x,n.y+71,11,s.color);}
    for(const gate of [{x:1020,y:540,w:95,h:160,open:w.state.solved},{x:1420,y:1080,w:140,h:90,open:w.state.bossDead}]){if(!W.DistantVaultScenery?.drawGate(this,w,gate)){c.fillStyle=gate.open?'#608e81':'#bd8956';c.globalAlpha=gate.open?.3:.85;c.fillRect(gate.x,gate.y,gate.w,gate.h);c.globalAlpha=1;}label(c,gate.open?'OPEN':'SEALED',gate.x+gate.w/2,gate.y-14,12);}
    const exit=w.locations[0],treasure=w.locations[1];W.Art?.draw(this,'dungeonProps',3,0,exit.x,exit.y,135,130);label(c,'E / B · SURFACE',exit.x,exit.y+80);W.Art?.draw(this,'dungeonProps',2,2,820,1460,80,76);label(c,'E / B · AMMUNITION',820,1510,12);W.Art?.draw(this,'dungeonProps',w.state.claimed?1:0,2,treasure.x,treasure.y,115,105);label(c,w.state.claimed?'EXPEDITION SEAL RECOVERED':w.state.bossDead?'E / B · EXPEDITION SEAL':'GUARDIAN’S RELIQUARY',treasure.x,treasure.y+62,12);label(c,s.name,580,1210,23,s.color);label(c,'E / B · READ EXPEDITION NOTES',580,1340,12);if(s.layout==='figure-eight')label(c,'SAFE STONE CROSSING',580,850,11,s.color);
  };
  const map=R.drawMap;R.drawMap=function(c,width,height,options={}){const w=this.game.world;if(!w.vaultSpec)return map.apply(this,arguments);c.fillStyle='#13232d';c.fillRect(0,0,width,height);c.save();c.scale(width/w.width,height/w.height);for(const r of floors(w)){c.fillStyle='#608786';c.fillRect(r.x,r.y,r.w,r.h);}for(const [i,n]of w.vaultSpec.nodes.entries()){c.fillStyle=w.state.vaultNodes[i]?'#a9e1b6':'#f6c477';c.fillRect(n.x-18,n.y-18,36,36);}for(const p of this.game.players){c.fillStyle='#fff3bb';c.beginPath();c.arc(p.x,p.y,24,0,Math.PI*2);c.fill();}c.restore();};
  const labels=R.drawLocationLabels;R.drawLocationLabels=function(w){const result=labels.apply(this,arguments);if(w.isDungeon)return result;const c=this.ctx;for(const key of keys){const l=w.getLocation(key.site);if(l)label(c,this.game.hasDistantVaultKey(key.id)?'KEY RECOVERED':'E / B · GUARDED KEY CACHE',l.x,l.y+38,12,'#9ee8e6');}for(const s of specs){const l=w.getLocation(s.id);if(l&&s.keyId&&!this.game.hasDistantVaultKey(s.keyId))label(c,'LOCKED · '+keys.find(k=>k.id===s.keyId).name,l.x,l.y+48,12,'#f0be89');}return result;};
  W.DistantVaults={specs,keys,adapt,blocked,clearPoint,syncKeyRuns};
})();
