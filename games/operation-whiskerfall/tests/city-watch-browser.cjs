'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready);
  const result=await page.evaluate(()=>{
    const g=OW.game;g.start({slot:0,coop:true});g.frame=()=>{};g.ui.hideMenu();
    const w=g.world,[p,q]=g.players,log=[];
    const check=(v,label)=>{if(!v)throw Error(label);log.push(label);};
    function enter(id,side='tram'){
      const site=w.getLocation(id+'_'+side);Object.assign(p,{x:site.x,y:site.y});q.x=p.x+27;q.y=p.y;
      g.travelInteractUntil=0;g.interact(p);
    }
    const locked=w.getLocation('city_blackglass');check(w.isBlocked(locked.x,locked.y,19),'sealed borough');
    enter('city_blackglass');check(!OW.CityWatch.zone(w,p),'locked night tram');
    const city=w.cityZones[0];enter(city.id);check(!OW.CityWatch.zone(w,p)&&w.isBlocked(city.x,city.y,19),'early Ironveil tram and on-foot entry are sealed');
    const reports=OW.Content.reconCampaign.ops;g.reconDossier.filed=reports.slice(0,8).map(op=>op.id);
    for(const op of reports.slice(0,9))g.reconDossier.evidence[op.id]={route:'observed',source:OW.Recon.sourceName(op,'observed')};
    check(g.fileReconDebrief()&&w.opened.has('ironveil_rail_pass'),'normal ninth debrief opens Ironveil');
    enter(city.id);check(OW.CityWatch.zone(w,p)===city&&OW.CityWatch.zone(w,q)===city,'two heroes ride the city tram');
    check(w.regionAt(p.x,p.y).index===6,'urban annex retains region');
    const buildings=w.objects.filter(o=>o.type==='cityBuilding');check(buildings.length>=165,'two large built city districts');
    for(const c of w.cityZones){
      // All contacts lie at intersections. Every adjoining road segment must be traversable.
      if(c.region===7){for(let i=0;i<8;i++)w.liberated.add('boss_'+i);w.opened.add('recon_berlin_clearance');}
      for(const x of c.streetsX)check(w._navigationRay(x,c.streetsY[0],x,c.streetsY.at(-1),21),c.key+' northbound '+x);
      for(const y of c.streetsY)check(w._navigationRay(c.streetsX[0],y,c.streetsX.at(-1),y,21),c.key+' cross street '+y);
      for(const suffix of ['','_archive','_roof','_witness','_relay','_exit']){const l=w.getLocation(c.id+suffix);check(!!l&&!w.isBlocked(l.x,l.y,22),c.key+suffix+' site');}
    }
    const defs=[...w._spawns.values()].filter(e=>e.cityWatch===city.key),e=w._createEnemy(defs[0]),ally=w._createEnemy(defs[1]),far=w._createEnemy(defs[2]);
    w.activeEnemies=[e,ally,far];w._rebuildEnemyGrid();
    const pt={x:city.streetsX[1],y:city.streetsY[2]};
    Object.assign(e,pt,{homeX:pt.x,homeY:pt.y,watchBearing:0,angle:0});Object.assign(ally,{x:pt.x-150,y:pt.y,watchBearing:Math.PI});Object.assign(far,{x:pt.x-900,y:pt.y});
    Object.assign(p,{x:e.x-50,y:e.y});Object.assign(q,{x:e.x+123,y:e.y});
    check(!OW.CityWatch.sees(w,e,p)&&OW.CityWatch.sees(w,e,q),'back of patrol is hidden and second hero is in beam');
    const box=city.cover[0],ray={x:box.x-34,y:box.y+box.h/2,watchBearing:0,cityWatch:city.key};
    const hidden={x:box.x+box.w+7,y:ray.y,hp:5};check(!OW.CityWatch.sees(w,ray,hidden),'solid building blocks light and sight');
    check(Math.abs(OW.CityWatch.limit(ray,0,[box])-34)<.01,'render ray ends on collision footprint');
    q.smokeTime=2;check(!OW.CityWatch.sees(w,e,q),'smoke conceals player');q.smokeTime=0;
    for(let i=0;i<65;i++){g.time+=1/60;e.watchBearing=0;g.updateCityWatch(e,OW.Content.enemies[e.type],1/60);}
    check(e.watchMode==='alarm'&&ally.watchMode==='search'&&!far.watchLast,'sighting alerts local guards only');
    const reported=ally.watchLast.x;q.x=pt.x-200;q.y+=145;p.x=pt.x-200;p.y-=145;
    g.updateCityWatch(ally,OW.Content.enemies[ally.type],.1);check(ally.watchLast.x===reported,'search retains last sighting');
    g.paused=true;const memory=ally.watchMemory;g.updateCityWatch(ally,OW.Content.enemies[ally.type],1);check(ally.watchMemory===memory,'pause freezes search');g.paused=false;
    p.smokeTime=q.smokeTime=10;for(let i=0;i<420;i++){g.time+=1/60;g.updateCityWatch(ally,OW.Content.enemies[ally.type],1/60);}
    check(ally.watchMode==='patrol','patrol stands down when party hides');p.smokeTime=q.smokeTime=0;
    enter(city.id,'return');check(!OW.CityWatch.zone(w,p)&&!OW.CityWatch.zone(w,q),'return tram carries whole party');
    enter('city_blackglass');check(OW.CityWatch.zone(w,p)?.key==='blackglass','earned clearance admits both players');
    g.save(false);check(g.start({slot:0,load:true})&&OW.CityWatch.zone(g.world,g.players[1])?.key==='blackglass','urban Continue with partner');
    return log;
  });
  if(process.env.MEOWQUEST_CITY_CAPTURES){
    const target=process.env.MEOWQUEST_CITY_CAPTURES;fs.mkdirSync(target,{recursive:true});
    for(const id of ['ironveil','blackglass']){
      await page.evaluate(async key=>{
        const g=OW.game,w=g.world,c=w.cityZones.find(c=>c.key===key),e=[...w._spawns.values()].find(e=>e.cityWatch===key);
        Object.assign(g.players[0],{x:e.x-108,y:e.y+55});Object.assign(g.players[1],{x:e.x-63,y:e.y+80});
        w.updateActive(g.players,1,g);g.camera={x:e.x-20,y:e.y-15,zoom:.86,shake:0};
        for(const enemy of w.activeEnemies.filter(e=>e.cityWatch)){enemy.watchBearing=.12;enemy.angle=.12;}
        g.ui.hideMenu();g.renderer.draw(1/60);await new Promise(r=>setTimeout(r,400));g.renderer.draw(1/60);
      },id);await page.locator('#game').screenshot({path:path.join(target,id+'.png')});
    }
  }
  assert.deepEqual(errors,[]);console.log(result.length+' city geometry, flashlight detection, cover, local alarm, search, tram and Continue checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
