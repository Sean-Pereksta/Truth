'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,null,{polling:100});
    const checks=await page.evaluate(()=>{
      const g=OW.game,ui=g.ui,list=[];
      function check(ok,why){if(!ok)throw Error(why);list.push(why);}
      check(g.start({slot:0,coop:true}),'Co-op campaign started');
      const w=g.world,p=g.players[0],other=g.players[1],canvas=document.querySelector('#minimap');
      const ctx=canvas.getContext('2d'),frame=document.querySelector('#minimap-frame');
      const paint=()=>{ui.drawMinimap();return canvas.toDataURL();};
      const color=(data,i)=>(data[i]<<16)|(data[i+1]<<8)|data[i+2];
      for(const city of w.cityZones){
        Object.assign(p,{x:city.streetsX[4],y:city.streetsY[3]});
        Object.assign(other,{x:p.x+180,y:p.y+80});
        g.marker=null;const before=paint(),sheet=ui.cityRadarPlans.get(city);
        check(canvas.getAttribute('aria-label').includes(city.name),city.name+' announced');
        check(!frame.classList.contains('dungeon-minimap'),'Circular street radar');
        const image=ctx.getImageData(0,0,180,180).data,histogram=new Map();
        for(let i=0;i<image.length;i+=4){
          const key=color(image,i);histogram.set(key,(histogram.get(key)||0)+1);
        }
        check((histogram.get(city.key==='ironveil'?0xa29b7b:0x959eae)||0)>400,'Main avenue is readable');
        check((histogram.get(city.key==='ironveil'?0x2e322f:0x282f39)||0)>300,'Building footprints separate from roads');
        check(histogram.has(0xfff4d3)&&histogram.has(0x9ed6e0),'Both hero colors survive');
        g.marker={x:p.x+300,y:p.y-100};const marked=paint();
        check(marked!==before,'Waypoint draws above street plan');
        const e={id:'distant_watch_fixture',x:p.x+1600,y:p.y,cityWatch:city.key,hp:1};
        w.activeEnemies.push(e);check(paint()===marked,'Distant patrol adds no information');
        w.activeEnemies.pop();Object.assign(p,{x:p.x+430,y:p.y+285});
        check(paint()!==marked&&ui.cityRadarPlans.get(city)===sheet,'Panning reuses the same plan');
        if(city.canals.length){
          const canal=city.canals[0],bridge=canal.bridges[2],pixels=sheet.getContext('2d');
          const sample=(x,y)=>color(pixels.getImageData((x-city.left)/6,(y-city.top)/6,1,1).data,0);
          check(sample(bridge.x+bridge.w/2,bridge.y+bridge.h/2)===0xa69b78&&sample(canal.x+50,bridge.y-68)===0x2f6470,'Canal crossings align with walkable bridges');
        }
      }
      g.settings.minimap=false;ui.lastUpdate=-Infinity;ui.update();check(frame.style.display==='none','Radar can be hidden');
      g.settings.minimap=true;ui.lastUpdate=-Infinity;ui.update();check(frame.style.display!=='none','Radar can be restored');
      const town=w.getLocation('town_0');Object.assign(p,{x:town.x,y:town.y});paint();
      check(canvas.getAttribute('aria-label').startsWith('Nearby terrain radar'),'Original overworld radar restored');
      const dungeon=OW.Content.dungeons.find(d=>!d.keyId),entry=w.getLocation(dungeon.id);
      for(const h of g.players)Object.assign(h,{x:entry.x,y:entry.y});
      check(g.enterDungeon(entry),'Normal dungeon entry');paint();
      check(frame.classList.contains('dungeon-minimap')&&canvas.getAttribute('aria-label').includes('Dungeon floor plan'),'Dungeon renderer retains its own floor plan');
      return list;
    });
    assert.deepEqual(errors,[]);console.log(checks.length+' city radar checks passed on Chrome '+browser.version());
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
