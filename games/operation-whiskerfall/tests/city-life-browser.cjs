'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready);
    const report=await page.evaluate(()=>{
      const g=OW.game;g.start({coop:true});g.frame=()=>{};g.ui.hideMenu();
      const w=g.world,p=g.players[0],q=g.players[1],life=OW.CityLife;
      w.opened.add('ironveil_rail_pass');w.opened.add('recon_berlin_clearance');
      for(let i=0;i<8;i++)w.liberated.add('boss_'+i);
      let sampled=0,names=0;
      for(const city of w.cityZones){
        const all=life.population(w).get(city.key),residents=all.filter(a=>a.cityCitizen);
        if(residents.length!==24||all.filter(a=>a.cityVehicle).length!==(city.key==='ironveil'?2:1))throw Error(city.key+' population');
        for(const resident of residents){
          if(resident.name)names++;
          for(let i=0;i<60;i++){
            const pos=life.sample(resident,i*resident.route.total/60);
            if(w.isBlocked(pos.x,pos.y,12))throw Error(resident.id+' sidewalk is blocked at '+pos.x+','+pos.y);
            sampled++;
          }
        }
        const entry=w.getLocation(city.id);
        Object.assign(p,{x:entry.x,y:entry.y});Object.assign(q,{x:p.x+20,y:p.y});w.activeEnemies=[];
        g.time=5;life.update(g,1/60);
        const a=residents.find(n=>n.name&&!w.locations.some(l=>l.city&&Math.hypot(l.x-n.x,l.y-n.y)<145));
        if(!a)throw Error('No resident available away from contacts');
        Object.assign(p,{x:a.x,y:a.y});let greeting;
        const toast=g.ui.toast;g.ui.toast=text=>{greeting=text;};g.interact(p);g.ui.toast=toast;
        if(!greeting?.includes(a.name)||!greeting.includes(a.line))throw Error('Missing citizen dialogue');
        if(g.ui.hudRegionInfo(p).title!==city.name)throw Error('District HUD');
        const alarm={cityWatch:city.key,watchMode:'alarm',hp:1,x:a.x+20,y:a.y-10};w.activeEnemies=[alarm];
        life.update(g,1/60);if(!a.refugeUntil)throw Error('Citizen missed alarm');
        w.activeEnemies=[];for(let i=0;i<1200;i++){g.time+=1/60;life.update(g,1/60);}
        if(a.refugeUntil!=null||a.sheltering)throw Error('Citizen did not return to route');
        Object.assign(p,{x:a.x+3,y:a.y});g.cityGunshot(p,OW.Content.weapons[0]);life.update(g,1/60);
        if(!a.refugeUntil)throw Error('Citizen missed a nearby shot without a sighting');
        const traffic=all.find(v=>v.cityVehicle),pos1=life.sample(traffic,5),pos2=life.sample(traffic,15);
        if(Math.hypot(pos1.x-pos2.x,pos1.y-pos2.y)<10)throw Error('Transit is stationary');
      }
      return {sampled,names};
    });assert.deepEqual(errors,[]);console.log('Passed '+report.sampled+' sidewalk samples, '+report.names+' named residents, city dialogue, shelter and return, street addresses and moving transit.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
