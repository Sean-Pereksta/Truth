'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,{},{polling:100});
    const rows=await page.evaluate(()=>{
      const W=OW,g=W.game,ui=g.ui,city=W.CityInvestigations,checks=[];
      const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      const choose=(a,value)=>{const b=document.querySelector('button[data-action="city-case-'+a+'"]'+(value!==undefined?'[data-value="'+value+'"]':''));if(!b)throw Error('missing city control '+a);b.click();};
      const place=t=>{g.players.forEach((p,i)=>Object.assign(p,{x:t.x+i*40,y:t.y}));g.time++;};
      for(const c of city.cases)for(const side of ['a','b']){
        check(g.start({slot:0,coop:true}),'fresh co-op '+c.id+side);
        place(city.site(g,c));g.interact(g.players[0]);
        check(!!document.querySelector('[data-action="city-case-lead"]')&&!document.querySelector('[data-action="city-case-start"]')&&city.step(g,c)===0,'physical briefing requires the earned city milestone');
        ui.hideMenu();
        if(c.id==='ironveil'){
          g.world.opened.add('ironveil_rail_pass');
          place(g.world.getLocation('town_6'));
        }else{
          for(const b of g.majorBosses())g.world.liberated.add(b.id);
          const data=g.snapshot();delete data.reconDossier;
          check(W.Save.write(0,data)&&g.start({load:true,slot:0})&&g.berlinUnlocked(),'earned Berlin access');place(g.world.getLocation('town_7'));
        }
        const mainBefore=g.reconDossier.filed.slice(),get=key=>city.site(g,c,key),progress=()=>city.step(g,c);
        const close=()=>{if(ui.isOpen)ui.hideMenu();};
        ui.showMenu('journal');choose('open',c.id);
        check(ui.journalMenu().includes(get('tram').name),'journal identifies the approach tram');
        choose('pin');check(g.marker.x===get('tram').x,'out-of-city pin leads to the tram');close();
        place(get('tram'));g.interact(g.players[0]);
        check(Math.hypot(g.players[0].x-get('return').x,g.players[0].y-get('return').y)<160,'both heroes enter by the town tram');
        place(get());g.interact(g.players[0]);choose('start');
        check(progress()===1&&ui.journalMenu().includes(c.clues[0].subject),'physical briefing '+c.id);
        close();
        for(const [i,clue] of c.clues.entries()){
          const loc=get(clue[side][0]);place(loc);g.interact(g.players[1]);
          if(side==='a'){
            if(i===0){
              g.players[1].x+=220;g.updateMissions(.2);check(!g.cityWatch&&progress()===1,'observation can be locally retried');
              place(loc);g.interact(g.players[1]);
            }
            g.updateMissions(3.1);
          }else{
            check(!ui.cityReader,'records remain guarded');
            const watches=g.world.activeEnemies.filter(e=>e.id.startsWith('city_watch_'+c.id+'_'+(i+1)+'_'));
            check(watches.length===2,'two-hero record guards');
            for(const e of watches)g.killEnemy(e,g.players[0]);
            g.interact(g.players[1]);
          }
          check(ui.cityReader?.hero===1,'P2 owns the source');
          ui.handlePad('back',0);check(ui.isOpen&&ui.cityReader?.hero===1,'P1 cannot dismiss P2’s evidence');
          choose('answer',String((clue.answer+1)%3));
          check(progress()===i+1&&ui.cityResponse.includes('conflicts'),'incorrect deduction preserves the source');
          choose('answer',String(clue.answer));
          check(progress()===i+2&&ui.journalMenu().includes(clue.fact),'confirmed '+c.id+' '+(i+1)+' route '+side);
          close();check(g.save(false)&&g.start({slot:0,load:true})&&progress()===i+2,'evidence survives Continue');
        }
        // A resting partner owns this optional reward just like an active one.
        g.toggleCoop();const earned=g.players[0].gold,reserve=g.reservePlayer.gold;
        place(get('exit'));g.interact(g.players[0]);check(progress()===5&&g.players[0].gold===earned+c.reward&&g.reservePlayer.gold===reserve+c.reward,'physical debrief pays both heroes');
        check(g.save(false)&&g.start({slot:0,load:true})&&progress()===5&&g.players[0].gold===earned+c.reward,'no repeat payment on Continue');
        place(get('exit'));g.interact(g.players[0]);choose('shortcut');
        check(Math.hypot(g.players[0].x-get().x,g.players[0].y-get().y)<110,'permanent city return passage');
        check(g.reconDossier.filed.join()===mainBefore.join()&&!g.campaignWon,'optional case leaves main dossier and finale intact');
      }
      return checks;
    });
    if(process.env.CITY_CAPTURE){
      fs.mkdirSync(process.env.CITY_CAPTURE,{recursive:true});
      for(const [width,height] of [[1280,720],[1920,1080]]){
        await page.setViewportSize({width,height});
        for(const id of ['ironveil','blackglass']){
          await page.evaluate(id=>{
            const g=OW.game;g.start({slot:1,coop:true});g.world.opened.add('ironveil_rail_pass');g.world.opened.add('recon_berlin_clearance');for(const b of g.majorBosses())g.world.liberated.add(b.id);const c=OW.CityInvestigations.cases.find(c=>c.id===id),l=OW.CityInvestigations.site(g,c);
            for(const [i,p] of g.players.entries())Object.assign(p,{x:l.x+i*38,y:l.y});g.interact(g.players[0]);
          },id);
          await page.waitForFunction(()=>document.querySelector('.city-file header img')?.naturalWidth>0,{},{polling:100});
          await page.screenshot({path:path.join(process.env.CITY_CAPTURE,id+'-case-'+height+'.png')});
        }
      }
    }
    assert.ok(rows.length>=80);console.log('PASS '+rows.length+' city investigation checks');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
