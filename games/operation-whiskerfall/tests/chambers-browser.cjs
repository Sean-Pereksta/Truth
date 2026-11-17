'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready);
    const messages=await page.evaluate(()=>{
      const g=OW.game,C=OW.Content,out=[];
      function check(val,msg){if(!val)throw Error(msg);out.push(msg);}
      function place(pos){g.players.forEach((p,i)=>Object.assign(p,{x:pos.x+i*24,y:pos.y}));g.time+=.9;}
      function enter(id){const e=g.world.getLocation(id);place(e);g.interact(g.players[0]);check(g.world.entry?.id===id,'Both heroes entered '+id);}
      function exit(){const id=g.world.entry.id;place(g.world.locations[0]);g.interact(g.players[0]);check(!g.world.isDungeon,'Both heroes returned from '+id);}
      function resume(){g.ui.showMenu('main');g.ui.slot=g.slot;g.ui.mainTab='continue';g.ui.render();g.ui.host.querySelector('[data-action="launch"]').click();check(g.state==='playing'&&!g.ui.isOpen,'Continue restored active game');}
      function press(node){place(g.world.vaultSpec.nodes[node]);return g.interact(g.players[0]);}
      function click(cmd){const b=g.ui.host.querySelector('[data-action="chamber-'+cmd+'"]');if(!b)throw Error('Missing chamber '+cmd);b.click();}
      g.start({slot:0,coop:true});
      const cfg=C.dungeons.find(d=>d.puzzle==='constellation'&&d.encounter!=='survival');
      enter(cfg.id);
      place(g.world.locations[2]);g.interact(g.players[1]);
      check(g.ui.menu==='chamber'&&g.ui.playerIndex===1,'Player two inspects the mechanism');
      g.ui.handlePad('back',0);check(g.ui.menu==='chamber'&&g.ui.isOpen,'Other controller leaves notes and active hero intact');
      click('hint');click('hint');click('hint');check(g.ui.host.textContent.includes('Next move'),'Three optional hint levels');
      click('apply');check(g.world.state.starUndo.length===1,'Mural focuses and operates a fine control');
      click('undo');check(g.world.state.stars.every(v=>!v),'Mural undo restores the constellation');
      click('apply');click('reset');check(g.world.state.stars.every(v=>!v)&&!g.world.state.starUndo.length,'Reset restores only this chamber');
      g.ui.handlePad('back',1);check(!g.ui.isOpen,'Owner returns to the field');
      const n=OW.Dungeons.currentNodes(g.world)[0];place(n);g.interact(g.players[0]);g.interact(g.players[1]);
      check(g.world.state.starUndo.length===1,'Concurrent party interaction changes a shared star once');
      const changed=g.world.state.stars.join();g.save(false);resume();
      check(g.world.entry?.id===cfg.id&&g.world.state.stars.join()===changed,'Continue restores intermediate star state');
      check(g.undoChamberStar(),'Undo also survives Continue');
      while(!g.world.state.solved){const i=OW.ChamberRules.solution(g.world.config,g.world.state)[0];place(OW.Dungeons.currentNodes(g.world)[i]);g.interact(g.players[0]);}
      check(!g.world.isBlocked(1060,620,19),'Completed constellation opens the physical guardian passage');exit();
      g.distantVaultKeys=new Set(C.distantVaultKeys.map(v=>v.id));
      enter('cave_rimeglass');press(1);check(!g.world.state.vaultNodes[1],'Dry pump rejects an unpressurized turn');press(0);
      const w=g.world;check(!w.isBlocked(530,997,19)&&w.isBlocked(530,530,19),'Only the drained lake offers a crossing');
      place(w.vaultSpec.nodes[2]);Object.assign(g.players[1],{x:530,y:997});g.interact(g.players[0]);check(!w.state.pressureEast,'A crossing carrying a partner cannot flood');
      press(2);check(w.state.pressureEast&&!w.isBlocked(530,530,19)&&w.isBlocked(530,997,19)&&!w.isBlocked(530,780,19),'Regulator reverses lakes and retains the central crossing');
      press(2);check(!w.state.pressureEast,'Regulator reverses again');press(2);press(1);press(2);check(w.state.solved,'Both gauges and final regulator open Rimeglass');exit();
      enter('cave_cindercoil');check(g.world.isBlocked(580,665,19),'Uncooled foundry bridge is blocked');press(0);check(!g.world.isBlocked(580,665,19),'First valve vents a timed shortcut');
      place({x:570,y:665});g.updateMissions(11);check(!g.world.isBlocked(580,665,19),'Venting keeps a party on the bridge safe');
      place({x:300,y:510});g.updateMissions(11);check(g.world.isBlocked(580,665,19)&&!g.world.isBlocked(580,320,19),'Vent closes when empty, north catwalk stays open');
      press(1);check(g.world.state.solved&&!g.world.isBlocked(580,665,19),'Second valve cools the permanent bridge');exit();
      enter('cave_zephyr');press(2);check(!g.world.state.vaultNodes.some(Boolean),'Unmatched bell does not advance');press(0);press(2);check(g.world.state.vaultNodes[0],'Correct early bell survives a discordant note');
      press(1);press(2);press(3);check(g.world.state.solved,'Ordered bell reliefs open the sanctuary');exit();
      enter('cave_kraken');check(g.world.isBlocked(285,885,19),'West tide pier begins underwater');press(1);press(0);
      check(!g.world.isBlocked(285,885,19),'Released anchor raises a walkable pier');press(2);check(g.world.state.ferryMastered&&g.world.state.solved,'Tide marks unlock the optional return slip');
      check(g.world.activeEnemies.some(e=>e.kraken),'Kraken remains the expedition guardian');exit();
      for(const d of C.dungeons.filter(d=>d.encounter==='survival')){
        enter(d.id);place({x:580,y:650});g.interact(g.players[0]);
        const run=OW.Encounters.trialState(g.world),plan=OW.Encounters.plan(g.world);
        check(run.waveName===plan.waves[0][0]&&run.records.length===plan.waves[0].length,'Authored co-op opening in '+d.title);
        const pad=OW.Encounters.trialPads[0],p=g.players[0];place(pad);p.hp=p.maxHp*.5;
        if(d.region===1){
          p.invuln=0;const hp=p.hp;g.damagePlayer(p,20,{x:p.x,y:p.y});const sheltered=hp-p.hp;
          p.invuln=0;place({x:580,y:650});const before=p.hp;g.damagePlayer(p,20,{x:p.x,y:p.y});check(before-p.hp>sheltered,'Moonmoss shelter reduces incoming damage');
        }else if(d.region===3){const e=g.world.activeEnemies.find(e=>e.encounterOwner===d.id);Object.assign(e,pad);g.interact(p);check(e.stun>=2&&run.discharged.length===1,'Aurora rods stagger nearby attackers once');}
        else if(d.region===5){g.updateEncounters(3.01);check(run.discharged.length===1&&p.hp>p.maxHp*.5,'Bilge wheel restores health after sustained occupation');}
        else {p.reserve=0;g.interact(p);check(p.reserve===80&&run.discharged.length===1,'West relay pays supplies once');place(OW.Encounters.trialPads[1]);g.interact(p);check(run.discharged.length===1,'Choosing west locks the east relay for this wave');}
        for(const id of run.enemyIds){g.world.dead.add(id);const e=g.world.activeEnemies.find(e=>e.id===id);if(e){e.hp=0;e.dead=true;}}
        g.updateEncounters(.1);g.updateEncounters(20);check(run.phase==='between'&&run.wave===1,'Untimed preparation checkpoint in '+d.title);
        place({x:580,y:650});g.interact(p);check(run.wave===2&&run.waveName===plan.waves[1][0],'Second wave starts when ready in '+d.title);
        exit();
      }
      return out;
    });
    if(process.env.MEOWQUEST_CAPTURE_DIR){
      const out=process.env.MEOWQUEST_CAPTURE_DIR;require('node:fs').mkdirSync(out,{recursive:true});
      for(const [width,height] of [[1280,720],[1920,1080]]){
        await page.setViewportSize({width,height});
        await page.evaluate(()=>{
          const g=OW.game;g.start({slot:1,coop:true});
          const d=OW.Content.dungeons.find(v=>v.puzzle==='echo'&&v.encounter!=='survival'),entry=g.world.getLocation(d.id);
          for(const [i,p] of g.players.entries())Object.assign(p,{x:entry.x+18*i,y:entry.y});
          g.enterDungeon(entry);for(const [i,p] of g.players.entries())Object.assign(p,{x:g.world.locations[2].x+20*i,y:g.world.locations[2].y+65});
          g.interact(g.players[0]);g.ui.host.querySelector('[data-action="chamber-hint"]').click();
        });
        await page.waitForFunction(()=>{const im=document.querySelector('.chamber-notes img');return im?.complete&&im.naturalWidth>0;});
        await page.screenshot({path:path.join(out,'echo-mural-'+height+'.png')});
        await page.evaluate(()=>OW.game.ui.hideMenu());
      }
    }
    assert.deepEqual(errors,[]);console.log('PASS · '+messages.length+' live browser chamber checks on '+await browser.version()+'.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
