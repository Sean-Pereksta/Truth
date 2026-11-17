/* Production-order browser fixtures. Travel, prerequisites, enemy damage,
   escort transit, escrowed vault keys and mission clocks are accelerated. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,{},{polling:100});
    const ids=await page.evaluate(()=>OW.Content.quests.map(q=>q.id));
    const exported=require('../data/quests.json').map(q=>q.id);
    assert.deepEqual(ids,exported);
    assert.deepEqual((await page.evaluate(()=>Object.keys(OW.Content.fieldAssignments))).sort(),ids.slice().sort());
    const rows=[];
    for(const id of ids.filter(id=>!process.env.FIELD_IDS||new RegExp(process.env.FIELD_IDS).test(id))){
      try{
        const record=await page.evaluate(async id=>{
          const g=OW.game,F=OW.FieldAssignments,q=OW.Content.quests.find(q=>q.id===id),ui=g.ui;
          const ensure=(v,m)=>{if(!v)throw Error(id+' / '+m);};
          ensure(g.start({slot:0}),'new fixture');
          const save=g.save;
          const live=()=>g.players[0];
          const place=p=>{ensure(p&&Number.isFinite(p.x),'missing fixture position');Object.assign(live(),{x:p.x,y:p.y});g.time+=1;};
          const use=p=>{place(p);g.interact(live());};
          const btn=(action,value)=>document.querySelector('[data-action="'+action+'"]'+(value?'[data-value="'+value+'"]':''));
          const click=(a,v)=>{const b=btn(a,v);ensure(b,'missing '+a+' / '+ui.menu+' '+ui.modernDialogueView);b.click();};
          const resume=()=>{ui.showMenu('main');ui.slot=0;ui.mainTab='continue';ui.render();click('launch');return g.state==='playing'&&!ui.isOpen;};
          const npc=g.questContact(q);
          const defeat=id=>{const w=g.world,e=w._active.get(id)||w._dormant.get(id)||(w._spawns.get(id)&&w._createEnemy(w._spawns.get(id)));if(e&&!w.dead.has(id))g.killEnemy(e,live());};
          const prereqs=new Set();let parent=q.prerequisite;
          while(parent){ensure(!prereqs.has(parent),'prerequisite cycle');prereqs.add(parent);g.completedQuests.add(parent);parent=OW.Content.quests.find(z=>z.id===parent)?.prerequisite;}
          if(q.id==='main_berlin_final'){
            for(const boss of g.majorBosses())g.world.liberated.add(boss.id);
            const backup=g.snapshot();delete backup.reconDossier;
            ensure(OW.Save.write(0,backup)&&g.start({slot:0,load:true}),'Berlin clearance migration');
          }
          const pre=OW.Content.fieldAssignments[q.id],s=F.sites(g,q);
          for(const pos of [s.left,s.right,s.rally])ensure(!g.world.isBlocked(pos.x,pos.y,19),'blocked evidence or rendezvous');
          ensure(Math.hypot(s.left.x-s.right.x,s.left.y-s.right.y)>100,'indistinguishable approaches');
          const interview=()=>{
            const contact=g.questContact(q);place(contact);g.updateMissions(.05);
            g.world.discovered.add(contact.id);
            g.interact(live());ensure(ui.isOpen&&ui.menu==='dialogue'&&g.npcLocation.id===contact.id,'normal giver conversation '+JSON.stringify({menu:ui.menu,open:ui.isOpen,location:g.npcLocation?.id,dungeon:g.world.entry?.id,receipt:ui.activeQuestCelebration?.quest?.id,near:g.world.locations.filter(l=>Math.hypot(l.x-live().x,l.y-live().y)<150).map(l=>l.id)}));
          };
          // World creation and save/load are exercised for every case. Suppress
          // intermediate autosaves during accelerated enemy deaths and clocks.
          g.save=()=>true;
          try{
            interview();ensure(g.questProgress(q).available,'offer unavailable');
            click('dialogue-work');if(ui.modernDialogueView!=='offer')click('dialogue-offer',id);
            ensure(ui.modernDialogueQuest===id,'incorrect offer');
            const illustration=ui.host.querySelector('img.assignment-cover');ensure(illustration?.getAttribute('src')===F.caseURL(q),'unique illustrated offer');
            await illustration.decode();ensure(illustration.naturalWidth>0,'local case painting decodes');
            click('field-examine',id);const evidence=ui.host.querySelector('.field-evidence-zoom img');ensure(evidence,'evidence can be inspected');
            await evidence.decode();ui.handlePad('back',0);ensure(!ui.host.querySelector('.field-evidence-zoom'),'controller returns to offer');
            click('accept-quest',id);
            ensure(g.acceptedQuests.has(id),'NPC acceptance');
            const pending=F.route(g,q)===-1;
            ui.hideMenu();
            if(pending){
              ensure(!g.questProgress(q).readyForTurnIn,'early reward');
              const side=OW.Content.quests.indexOf(q)%2?'right':'left';
              const other=side==='left'?'right':'left';
              ensure(save.call(g,false),'save pending field file');
              use(s[other]);ensure(F.route(g,q)===(other==='left'?1:2),'alternate evidence source');
              ensure(resume()&&F.route(g,q)===-1,'pending Continue');
              use(s[side]);ensure(F.route(g,q)===(side==='left'?1:2),'world evidence interaction');
              // A second field interaction cannot settle the same choice.
              const kits=live().medkits;g.interact(live());ensure(live().medkits===kits,'duplicate preparation');
              if(ui.isOpen)ui.hideMenu();
            }
            const savedRoute=F.route(g,q);
            ensure(save.call(g,false)&&resume()&&F.route(g,q)===savedRoute,'accepted Continue');
            const w=g.world;
            if(q.steps){
              live().materials+=80;live().medkits+=10;
              const run=g.missionRuns[id];let n=0;
              while(!g.questProgress(q).readyForTurnIn&&run.stepIndex<q.steps.length&&n++<40){
                const step=q.steps[run.stepIndex],t=step.targets.find(id=>!run.completedTargets.includes(id)),l=w.getLocation(t);
                place(l);g.updateMissions(.01);
                for(const e of [...w.activeEnemies])if(e.hp>0&&(e.resistanceGuard||e.missionTarget===id||Math.hypot(e.x-l.x,e.y-l.y)<230))defeat(e.id);
                g.interact(live());
                if(ui.isOpen)ui.hideMenu();
                if(run.channelTarget)g.updateMissions((step.duration||1)+.1);
              }
            }else if(['liberate','rescue','convoy'].includes(q.type)){
              const loc=w.getLocation(q.target);place(loc);for(const id of loc.enemyIds)defeat(id);g.updateLocations(.1);
              if(q.type==='convoy'&&savedRoute>0){
                ensure(!g.questProgress(q).readyForTurnIn,'cargo still in transit');
                place(F.cargoPoint(g,q));g.interact(live());
                ensure(g.questCounters[F.counter(q,'cargo')]===1,'manifest intercepted');
              }
              if(q.type==='rescue'&&savedRoute>0){
                for(let i=0;i<32&&!g.questProgress(q).readyForTurnIn;i++){
                  const point=F.evacuationPoint(g,q);ensure(!w.isBlocked(point.x,point.y,17),'crew crosses walkable ground');
                  place(point);g.updateMissions(.5);
                }
              }
            }else if(q.type==='boss'){
              const post=w.getLocation(q.target);place(post);defeat(post.id+'_commander');g.updateLocations(.1);
              if(ui.menu==='victory'){click('recon-credits');click('recon-home');}
            }else if(q.type==='cache'){use(w.getLocation(q.target));}
            else if(q.type==='explore'){
              const site=w.getLocation(q.target);place(site);w.reveal(site.x,site.y);
            }else if(q.type==='kill'){for(const id of s.location.enemyIds.slice(0,3))defeat(id);}
            else if(q.type==='assassination'||q.type==='bounty')for(const id of [].concat(q.target))defeat(id);
            else if(q.type==='defend'){
              const r=g.missionRuns[id],plan=OW.Content.fieldDefenses[id];
              for(let t=0;t<65&&r.state==='active';t++){
                place(r);g.updateMissions(1);
                if(plan?.signal&&r.elapsed===plan.signal&&!r.fieldSignal){
                  g.updateMissions(2);ensure(r.elapsed===plan.signal,'hold stops for crew signal');
                  use(r);ensure(r.fieldSignal,'released the local mechanism');
                }
              }
            }else if(q.type==='escort'){
              let r=g.missionRuns[id];
              if(id==='escort_0'){
                const rendezvous={x:r.targetX,y:r.targetY};place(r);r.hp=0;g.updateMissions(.1);
                ensure(r.state==='failed','escort defeat');use(r);r=g.missionRuns[id];
                ensure(r.state==='active'&&r.hp===r.maxHp&&r.targetX===rendezvous.x&&r.targetY===rendezvous.y&&F.route(g,q)===savedRoute,'local escort retry');
              }
              Object.assign(r,{x:r.targetX,y:r.targetY});place(r);g.updateMissions(.01);
            }else if(q.type==='campDefense'){
              const r=g.encounterRuns[id];use(r);
              for(let i=0;i<30&&r.state!=='complete';i++){
                place(r);for(const id of r.enemyIds||[])defeat(id);g.updateEncounters(20);
                if(r.phase==='counterattack'){place(r);for(const id of r.enemyIds)defeat(id);g.updateEncounters(.1);g.interact(live());}
              }
            }else if(q.type==='invasion'){
              const r=g.invasionRuns[id];
              for(let stage=0;stage<3;stage++){
                use(g.questTarget(q));
                if(stage<2){place(r);g.updateInvasions(stage?12:20);}
                else{place(r);g.updateInvasions(3);defeat(r.captainId);g.interact(live());}
              }
            }else if(q.type==='dungeon'){
              const d=OW.Content.dungeons.find(d=>d.id===q.target),entrance=w.getLocation(q.target);
              if(d.keyId)g.distantVaultKeys.add(d.keyId);
              place(entrance);ensure(g.enterDungeon(entrance),'dungeon entry');
              const interior=g.world;
              if(interior.vaultSpec){
                const order={cave_rimeglass:[0,2,1,2],cave_zephyr:[0,1,2,3],cave_cindercoil:[0,1],cave_kraken:[1,0,2]}[d.id];
                for(const index of order)use(interior.vaultSpec.nodes[index]);
              }else if(d.encounter==='survival'){
                const altar={x:580,y:650};use(altar);
                for(let wave=0;wave<10&&!interior.state.solved;wave++){
                  const trial=interior.state.survival;
                  if(trial.phase==='between')use(altar);
                  for(const e of [...interior.activeEnemies])if(e.encounterOwner===d.id&&e.hp>0)g.killEnemy(e,live());
                  g.updateEncounters(4);
                }
              }else{
                for(let move=0;move<32&&!interior.state.solved;move++){
                  const index=OW.ChamberRules.solution(interior.config,interior.state)[0];
                  ensure(Number.isInteger(index),'mechanism has a valid next move');
                  use(OW.Dungeons.currentNodes(interior)[index]);
                }
              }
              ensure(interior.state.solved,'live chamber solution');
              const boss=interior.activeEnemies.find(e=>e.dungeonBoss);
              ensure(boss,'guardian present');g.killEnemy(boss,live());ensure(interior.state.bossDead,'guardian defeat');
              const chest=interior.locations.find(l=>/treasure/i.test(l.type))||interior.locations[1];
              use(chest);
              if(g.pendingReward){const drop=g.drops.find(d=>d.id===g.pendingReward.id);ensure(g.claimReward(drop.choices[0]),'reliquary claim');}
              if(ui.isOpen)ui.hideMenu();
              ensure(interior.state.claimed,'seal receipt');
              g.leaveDungeon(false);
            }else throw Error('unsupported objective '+q.type);
            g.checkQuests();
            ensure(g.questProgress(q).readyForTurnIn,'objective ready · '+g.questObjectiveText(q));
            ensure(save.call(g,false)&&resume()&&g.questProgress(q).readyForTurnIn,'ready Continue');
            const to=g.questTurnInContact(q),gold=live().gold;
            if(ui.isOpen)ui.hideMenu();use(to);
            ensure(ui.menu==='dialogue','turn-in conversation '+ui.menu);click('finish-quest',id);
            ensure(g.completedQuests.has(id)&&live().gold>=gold+(q.rewardGold||100),'NPC grant');
            ensure(!g.finishQuestFromNpc(id),'duplicate grant');
            const after=live().gold;
            ensure(save.call(g,false)&&resume()&&g.completedQuests.has(id)&&live().gold===after,'paid Continue');
            return {id,route:savedRoute,objective:q.type,checks:['NPC offer','field','active Continue','objective','ready Continue','turn-in','paid Continue'],art:pre.art};
          }finally{g.save=save;}
        },id);
        rows.push(record);console.log('PASS '+id);
      }catch(e){rows.push({id,error:e.message.split('\n')[0]});console.error('FAIL '+id+' '+e.message);}
    }
    if(process.env.FIELD_RESULT)fs.writeFileSync(process.env.FIELD_RESULT,JSON.stringify(rows,null,2));
    console.log(rows.filter(r=>!r.error).length+'/'+rows.length+' quest fixtures passed');
    assert.ok(rows.every(r=>!r.error));
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
