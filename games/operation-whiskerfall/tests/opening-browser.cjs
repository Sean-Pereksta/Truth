'use strict';
const {strict:assert}=require('node:assert'), path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.stack));
    await page.addInitScript(()=>{
      window.testPads=()=>[0,1].map(index=>({id:'Test '+index,index,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      window.pads=sessionStorage.coopDrill?testPads():[];
      Object.defineProperty(navigator,'getGamepads',{value:()=>window.pads});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,null,{timeout:120000});
    const check=async(fn,msg)=>assert.ok(await page.evaluate(fn),msg);
    const tick=async(count=1)=>page.evaluate(count=>{
      const g=OW.game;for(let i=0;i<count;i++){g.input.update(g);if(!g.paused)g.update(.016);g.ui.update();}
      g.renderer.draw(.016);
    },count);
    const tap=async key=>{await page.keyboard.down(key);await tick();await page.keyboard.up(key);await tick();};
    const press=async(owner,button)=>{
      await page.evaluate(([i,b])=>{Object.assign(pads[i].buttons[b],{pressed:true,value:1});},[owner,button]);
      await tick();await page.evaluate(([i,b])=>{Object.assign(pads[i].buttons[b],{pressed:false,value:0});},[owner,button]);await tick();
    };
    const resume=async(otherSlot)=>{
      const slot=otherSlot??await page.evaluate(()=>{OW.game.save(false);return OW.game.slot;});
      await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready,null,{timeout:120000});
      await page.evaluate(()=>{OW.game.frame=()=>{};});
      await page.locator('[data-action=slot][data-value="'+slot+'"]').click();
      await page.locator('[data-action=launch]').click();
    };
    await page.evaluate(()=>{OW.game.frame=()=>{};OW.game.input.bindings.right='KeyL';OW.game.input.persist();});
    await page.locator('[data-action=launch]').click();
    await check(()=>OW.game.comic?.index===0&&OW.Save.read(0).opening.panel===0,'fresh title launches the opening');
    await tap('Enter');await resume();
    await check(()=>OW.game.comic?.index===1,'Continue restores comic frame');
    await tap('Escape');
    await check(()=>OW.game.world.isTutorial&&OW.game.opening.step==='movement'&&!OW.game.world.activeEnemies.length,'skip arrives in isolated yard');
    await tick();
    await check(()=>document.querySelector('.yard-hud').textContent.includes('L'),'movement prompt uses rebound key');
    await page.keyboard.down('l');await tick(26);await page.keyboard.up('l');await tick();
    await check(()=>OW.game.opening.step==='attack'&&OW.game.world.activeEnemies.length===1,'walk reaches circle');
    await page.evaluate(()=>{
      const g=OW.game,r=g.renderer,w=g.world.sparringRat,z=g.camera.zoom;
      const x=r.width/2+(w.x-g.camera.x)*z,y=r.height/2+(w.y-g.camera.y)*z;
      g.canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y}));
      g.canvas.dispatchEvent(new PointerEvent('pointerdown',{button:0}));
    });
    await tick(28);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{button:0})));
    await check(()=>OW.game.opening.step==='reload','real projectile lands on clockwork enemy');
    await resume();
    await check(()=>OW.game.opening.step==='reload'&&OW.game.world.isTutorial,'Continue restores tutorial step');
    await tap('r');await tick(150);
    await check(()=>OW.game.opening.step==='dodge','completed reload advances the drill');
    await tick(160);
    await check(()=>OW.game.world.feedback?.includes('Tagged')&&OW.game.players[0].hp>0,'missed warning retries without campaign death');
    for(let i=0;i<160&&!await page.evaluate(()=>OW.game.world.strike?.time<.23);i++)await tick();
    await tap('Space');await tick(24);
    await check(()=>OW.game.opening.step==='interact'&&!OW.game.world.activeEnemies.length,'timed dodge finishes single encounter');
    await page.evaluate(()=>Object.assign(OW.game.players[0],OW.game.world.desk));await tap('e');await tap('j');
    await check(()=>OW.game.opening.step==='exit'&&OW.game.ui.menu==='journal'&&OW.game.ui.host.textContent.includes('orchard stile'),'journal reveals orchard lead and unlocks gate');
    await tap('Escape');await page.evaluate(()=>Object.assign(OW.game.players[0],OW.game.world.exit));await tap('e');
    await check(()=>{const g=OW.game,t=g.reconTarget();return !g.world.isTutorial&&g.opening.phase==='complete'&&g.marker.x===t.x&&g.marker.y===t.y;},'gate places party at Willow and pins the real dossier lead');
    await resume();await check(()=>!OW.game.world.isTutorial&&OW.game.opening.phase==='complete','completed campaign resumes on surface');
    await page.evaluate(()=>{
      const g=OW.game,d=g.snapshot();delete d.opening;OW.Save.write(1,d);g.start({load:true,slot:1});
    });
    await check(()=>OW.game.opening.phase==='complete'&&!OW.game.world.isTutorial&&!OW.game.comic,'legacy slot resumes on surface');
    // Legacy chamber saves hold return positions in players and interior
    // positions in activeDungeon. Exercise both record shapes through Continue.
    const legacy=await page.evaluate(()=>{
      const g=OW.game;g.start({slot:0,coop:true});
      const cave=OW.Content.dungeons.find(d=>d.puzzle==='constellation'&&d.encounter!=='survival'),entry=g.world.getLocation(cave.id);
      g.players.forEach((p,i)=>Object.assign(p,{x:entry.x+i*40,y:entry.y}));g.interact(g.players[0]);
      if(g.world.entry?.id!==cave.id)throw Error('Could not enter test chamber');
      g.players[1].gold=731;g.players[1].inventory[0].upgrade=2;g.acceptedQuests.add('main_0_0');
      g.puzzleAction(0);
      const data=g.snapshot();delete data.opening;
      if(!OW.Save.write(1,data))throw Error('Could not prepare legacy dungeon save');
      return {id:cave.id,entry:{x:entry.x,y:entry.y},stars:data.dungeonStates[cave.id].stars};
    });
    await resume(1);
    assert.ok(await page.evaluate(({id,entry,stars})=>{
      const g=OW.game,s=OW.Save.read(1);
      return !g.world.isDungeon&&!g.world.isTutorial&&!g.comic&&g.players.length===2&&
        g.players.every(p=>OW.dist(p,entry)<230&&!g.world.isBlocked(p.x,p.y,19))&&
        g.acceptedQuests.has('main_0_0')&&g.players[1].gold===731&&g.players[1].inventory[0].upgrade===2&&
        JSON.stringify(g.dungeonStates[id].stars)===JSON.stringify(stars)&&s.opening.phase==='complete'&&!s.activeDungeon;
    },legacy),'legacy chamber opens at surface entrance with both heroes, inventory, quest and puzzle intact');
    await page.evaluate(id=>{
      const g=OW.game,entry=g.world.getLocation(id);
      g.players.forEach((p,i)=>Object.assign(p,{x:entry.x+i*36,y:entry.y}));
      g.travelInteractUntil=0;g.interact(g.players[1]);
    },legacy.id);
    await check(()=>OW.game.world.isDungeon&&OW.game.world.state.stars[0],'re-enter the same chamber with puzzle progress');
    await resume();
    assert.ok(await page.evaluate(id=>OW.game.world.entry?.id===id&&OW.game.world.state.stars[0]&&OW.game.players[1].gold===731,legacy.id),'future Continue restores the migrated party underground');
    await page.evaluate(()=>{
      sessionStorage.coopDrill='1';window.pads=testPads();
      const g=OW.game;g.state='menu';g.ui.showMenu('main');g.ui.mainTab='new';g.ui.slot=2;g.ui.coop=true;g.ui.render();g.ui.host.querySelector('[data-action=launch]').click();
    });
    await tick();await press(1,0);await check(()=>OW.game.comic?.index===1,'second controller advances comic');
    await press(0,1);await check(()=>OW.game.players.length===2&&OW.game.world.isTutorial,'controller skips into shared realm');
    await page.evaluate(()=>{pads[1].axes[0]=1;});await tick(26);await page.evaluate(()=>{pads[1].axes[0]=0;});await tick();
    await check(()=>OW.game.opening.step==='attack','partner can complete shared movement task');
    await resume();await check(()=>OW.game.players.length===2&&OW.game.opening.step==='attack','co-op tutorial survives Continue');
    await page.evaluate(()=>{
      const g=OW.game,p=g.players[1],rat=g.world.sparringRat,a=Math.atan2(rat.y-p.y,rat.x-p.x);
      pads[1].axes[2]=Math.cos(a);pads[1].axes[3]=Math.sin(a);pads[1].buttons[7]={pressed:true,value:1};
    });await tick(32);
    await page.evaluate(()=>{pads[1].buttons[7]={pressed:false,value:0};pads[1].axes[2]=0;pads[1].axes[3]=0;});
    await check(()=>OW.game.opening.step==='reload','partner aims and hits with stick and trigger');
    await press(1,13);await tick(150);
    await check(()=>OW.game.opening.step==='dodge','partner reloads');
    for(let i=0;i<160&&!await page.evaluate(()=>OW.game.world.strike?.time<.23);i++)await tick();
    await press(1,0);await tick(24);
    await check(()=>OW.game.opening.step==='interact','partner dodges the locked attack');
    await page.evaluate(()=>Object.assign(OW.game.players[1],OW.game.world.desk));await press(1,1);await press(1,9);
    await page.locator('[data-action=menu][data-value=journal]').click();
    await check(()=>OW.game.opening.step==='exit','partner opens the dossier from Camp');await press(1,1);
    await page.evaluate(()=>Object.assign(OW.game.players[1],OW.game.world.exit));
    await press(1,1);
    await check(()=>{const g=OW.game;return g.opening.phase==='complete'&&g.players.every(p=>Math.hypot(p.x-g.world.start.x,p.y-g.world.start.y)<160);},'partner can bring both heroes to Willow');
    assert.deepEqual(errors,[]);console.log('Opening verified · comic, bindings, hit, reload, dodge retry, journal, Willow, legacy and two-controller Continue');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
