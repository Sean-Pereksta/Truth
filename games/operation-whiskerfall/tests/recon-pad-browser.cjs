'use strict';
/* Optional browser acceptance. Set NODE_PATH to Playwright's modules and
   CHROME_PATH to a local browser when bundled Chromium is unavailable. */
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      window.testPads=[0,1].map(index=>({id:index?'DualSense QA':'Xbox QA',index,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      Object.defineProperty(navigator,'getGamepads',{value:()=>testPads.map(p=>p.connected?p:null)});
      window.frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
      window.padButton=async (button,owner=0)=>{
        const b=testPads[owner].buttons[button];b.pressed=true;b.value=1;await frames(2);b.pressed=false;b.value=0;await frames(2);
      };
      // Read the current focus geometry and walk its graph using actual D-pad
      // edges. No control receives a synthetic click, focus or action call.
      window.padNavigate=async (selector,owner=0)=>{
        for(let attempt=0;attempt<65;attempt++){
          const root=OW.game.ui,ui=root.menu==='coop-personal'?root.personalMenuFor(owner):root;
          const buttons=ui.focusableControls(),target=ui.host.querySelector(selector);
          if(!target||!buttons.includes(target))throw Error('Control unavailable '+selector);
          const current=buttons.includes(ui.controllerFocus[owner])?ui.controllerFocus[owner]:buttons.includes(document.activeElement)?document.activeElement:ui.defaultControllerFocus(buttons);
          if(current===target)return;
          const nodes=buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,group:ui.navigationGroup(b)};});
          const start=buttons.indexOf(current),goal=buttons.indexOf(target),seen=new Set([start]),queue=[[start,null]];
          let first;
          for(let n=0;n<queue.length&&first==null;n++){
            const [i,earlier]=queue[n],a=nodes[i];
            for(const [d,dx,dy] of [[12,0,-1],[13,0,1],[14,-1,0],[15,1,0]]){
              if(dx&&(buttons[i].tagName==='SELECT'||['range','checkbox'].includes(buttons[i].type)))continue;
              let near=[],local=[];
              for(let j=0;j<nodes.length;j++){
                const b=nodes[j],along=(b.x-a.x)*dx+(b.y-a.y)*dy,across=Math.abs(dy?b.x-a.x:b.y-a.y);
                if(along<4)continue;
                const candidate=[j,along+2.5*across];near.push(candidate);
                if(dy&&a.group&&b.group===a.group)local.push(candidate);
              }
              const options=local.length?local:near,step=options.length?options.sort((a,b)=>a[1]-b[1])[0][0]:(i+(dx+dy<0?buttons.length-1:1))%buttons.length;
              if(step===goal){first=earlier??d;break;}
              if(!seen.has(step)){seen.add(step);queue.push([step,earlier??d]);}
            }
          }
          if(first==null)throw Error('Unreachable '+selector+' from '+current.outerHTML.slice(0,90));
          await padButton(first,owner);
        }
        throw Error('Navigation did not converge on '+selector+' from '+document.activeElement?.outerHTML.slice(0,100));
      };
    });
    const button=(n,p=0)=>page.evaluate(([n,p])=>padButton(n,p),[n,p]);
    const pick=async (action,value,p=0)=>{
      const selector='[data-action="'+action+'"]'+(value!=null?'[data-value="'+value+'"]':'');
      await page.evaluate(async([s,p])=>{await padNavigate(s,p);await padButton(0,p);},[selector,p]);
    };
    const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url);await page.waitForFunction(()=>window.OW?.game?.ready);
    await pick('menu','controls');await button(5);
    assert.equal(await page.evaluate(()=>OW.game.ui.controlPlayer),1);
    await pick('pad-preset','steady');
    assert.deepEqual(await page.evaluate(()=>[0,1].map(i=>OW.game.input.padProfile(i).assist)),[0,.65]);
    await button(1);
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.value),'controls');
    await pick('mode','coop');await pick('launch');
    await page.waitForFunction(()=>OW.game.state==='playing'&&OW.game.players.length===2);
    const pos=()=>page.evaluate(()=>OW.game.players.map(p=>({x:p.x,y:p.y})));
    const start=await pos();
    await page.keyboard.down('KeyD');
    await page.evaluate(async()=>{testPads[1].axes[1]=.85;await frames(12);testPads[1].axes[1]=0;});
    await page.keyboard.up('KeyD');
    const end=await pos();assert.ok(end[0].x>start[0].x&&end[1].y>start[1].y,'mixed keyboard and pad movement');
    await button(8,0);await button(3,1);
    assert.deepEqual(await page.evaluate(()=>OW.game.ui.personalMenus.map(p=>p.menu)),['inventory','skills']);
    await pick('filter','armor');await pick('item','armor_recon_reedrunner');
    await pick('wardrobe-compare','armor_recon_reedrunner');
    assert.ok(await page.locator('[data-coop-owner="0"] .wardrobe-more').innerText().then(t=>t.includes('Walk 15% faster')));
    assert.equal(await page.locator('[data-coop-owner="1"] .wardrobe-more').count(),0);
    await button(1,0);assert.ok(await page.evaluate(()=>OW.game.ui.personalMenuFor(0).isOpen));
    await button(1,0);assert.ok(await page.evaluate(()=>OW.game.paused));
    await button(1,1);assert.equal(await page.evaluate(()=>OW.game.paused),false);
    await page.evaluate(async()=>{
      const pad=testPads[1];pad.connected=false;const event=new Event('gamepaddisconnected');Object.defineProperty(event,'gamepad',{value:pad});window.dispatchEvent(event);await frames(2);
    });
    assert.ok(await page.evaluate(()=>OW.game.paused&&OW.game.ui.menu==='pause'&&OW.game.players.length===2));
    await page.evaluate(async()=>{testPads[1].index=3;testPads[1].connected=true;await frames(3);});
    assert.equal(await page.evaluate(()=>OW.game.input.padAssignments.get(3)),1);
    const blocked=await page.evaluate(async()=>{
      const p=OW.game.players[1],ammo=p.ammo,n=testPads[1].buttons[7];
      n.value=1;n.pressed=true;await frames(2);await padButton(9,1);await frames(5);
      n.value=0;n.pressed=false;await frames(2);return p.ammo===ammo;
    });
    assert.ok(blocked,'holding the trigger in a menu cannot fire on resume');
    // Move the party across the intervening road. Every observation, menu
    // selection, debrief, forge purchase, save and Continue uses pad polling.
    await page.evaluate(()=>{const g=OW.game,t=g.reconTarget();g.players.forEach((p,i)=>{p.x=t.x+i*36;p.y=t.y;});});
    await button(1);
    await page.waitForFunction(()=>OW.game.reconEvidenceCount()||!OW.game.reconWatch,null,{timeout:90000});
    assert.ok(await page.evaluate(()=>OW.game.reconEvidenceCount()),await page.evaluate(()=>JSON.stringify({t:OW.game.time,toasts:document.getElementById('toast-region').innerText,heroes:OW.game.players.map(p=>[p.x,p.y,p.hp]),enemies:OW.game.world.activeEnemies.filter(e=>OW.dist(e,OW.game.players[0])<250).map(e=>[e.id,e.x,e.y,e.state])})));
    await button(9);await pick('menu','journal');await pick('recon-file');
    assert.equal(await page.evaluate(()=>OW.game.reconDossier.filed.length),1);
    await button(1);
    await page.evaluate(()=>{const g=OW.game,t=g.world.locations.find(l=>l.type==='forge');g.players.forEach((p,i)=>{p.x=t.x+i*45;p.y=t.y;});});
    await button(1);assert.equal(await page.evaluate(()=>OW.game.ui.menu),'forge');
    await pick('rf-tab','Craft');await pick('rf-select','weapon_rushleaf');await pick('rf-inspect','weapon_rushleaf');
    assert.ok(await page.locator('.rf-inspection').innerText().then(text=>text.includes('range')&&text.includes('reload')));
    await button(1);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'rf-inspect');
    await pick('rf-review','weapon_rushleaf');
    await button(1);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'rf-review');
    await pick('rf-review','weapon_rushleaf');await pick('rf-commit','equip');
    assert.equal(await page.evaluate(()=>OW.game.weapon(OW.game.players[0]).id),'rushleaf');
    await button(1);await button(9);await pick('save');
    await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready);
    await pick('launch');
    assert.deepEqual(await page.evaluate(()=>{
      const g=OW.game;return [g.players.length,g.reconEvidenceCount(),g.reconDossier.filed.length,g.weapon(g.players[0]).id,g.input.padProfile(1).assist];
    }),[2,1,1,'rushleaf',.65]);
    await page.evaluate(()=>{
      const g=OW.game,t=g.questContact('main_0_0');g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*36,y:t.y,invuln:3}));
    });
    await button(1);await pick('dialogue-work');
    if(await page.locator('[data-action="dialogue-offer"][data-value="main_0_0"]').count())await pick('dialogue-offer','main_0_0');
    await page.waitForFunction(()=>document.querySelector('img.assignment-cover')?.naturalWidth>0);
    if(process.env.FIELD_CAPTURE){
      require('node:fs').mkdirSync(process.env.FIELD_CAPTURE,{recursive:true});
      await page.screenshot({path:path.join(process.env.FIELD_CAPTURE,'orchard-offer-720.png')});
    }
    await pick('field-examine','main_0_0');
    assert.ok(await page.locator('.field-evidence-zoom img').isVisible(),'inspect painted evidence with a gamepad');
    await button(1);await pick('accept-quest','main_0_0');await pick('dialogue-leave');
    await page.evaluate(()=>{
      const g=OW.game,t=g.assignmentSites('main_0_0').left;g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*36,y:t.y,invuln:3}));
    });
    await button(1);assert.equal(await page.evaluate(()=>OW.FieldAssignments.route(OW.game,OW.Content.quests[0])),1);
    await button(9);await pick('save');await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready);await pick('launch');
    assert.equal(await page.evaluate(()=>OW.FieldAssignments.route(OW.game,OW.Content.quests[0])),1,'field route survives pad save and title Continue');
    // Stage an earned Berlin clearance here. The separate campaign run earns it
    // continuously through the 24 regional jobs and twelve filed operations.
    await page.evaluate(()=>{
      const g=OW.game,w=g.world;for(const b of g.majorBosses())w.liberated.add(b.id);
      w.opened.add('recon_berlin_clearance');g.reconDossier=OW.Recon.migrate(g.snapshot());
      const boss=w._createEnemy(w._spawns.get('boss_berlin_commander'));
      g.players.forEach((p,i)=>Object.assign(p,{x:boss.x+i*40,y:boss.y+100,invuln:6}));
      g.killEnemy(boss,g.players[0]);
    });
    await pick('recon-credits');await pick('recon-home');
    assert.deepEqual(await page.evaluate(()=>[OW.game.campaignWon,OW.game.checkpoint.locationId]),[true,'town_7']);
    await page.evaluate(()=>{const g=OW.game,t=g.world.getLocation('city_blackglass_tram');g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*35,y:t.y}));});
    await button(1);assert.ok(await page.evaluate(()=>OW.game.players.every(p=>OW.CityWatch.zone(OW.game.world,p)?.key==='blackglass')));
    await page.evaluate(()=>{const g=OW.game,t=g.world.getLocation('city_blackglass');g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*35,y:t.y}));});
    await button(1);await pick('city-case-start');await pick('city-case-pin','a');await button(1);
    assert.equal(await page.evaluate(()=>OW.CityInvestigations.step(OW.game,OW.CityInvestigations.cases[1])),1);
    await page.evaluate(()=>{const g=OW.game,t=g.world.getLocation('city_blackglass_return');g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*35,y:t.y}));});
    await button(1);
    const returned=await page.evaluate(()=>{const g=OW.game,t=g.world.getLocation('city_blackglass_tram');return {distances:g.players.map(p=>Math.round(OW.dist(p,t))),inCity:g.players.some(p=>OW.CityWatch.zone(g.world,p)),notice:document.getElementById('toast-region').innerText};});
    assert.ok(!returned.inCity&&returned.distances.every(d=>d<250)&&returned.notice.includes('Back at Dawnbridge'),'both heroes disembark at the Dawnbridge night tram '+JSON.stringify(returned));
    assert.deepEqual(errors,[]);
    console.log('Passed virtual-pad title, P2 controls, return focus, mixed movement, personal menus, reconnect, debrief, forge, painted assignment, Continue, credits, Dawnbridge, borough case and return tram on '+browser.version());
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
