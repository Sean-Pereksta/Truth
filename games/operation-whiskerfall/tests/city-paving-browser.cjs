'use strict';
const path=require('node:path'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(process.env.MEOWQUEST_CAPTURE_DIR){fs.mkdirSync(process.env.MEOWQUEST_CAPTURE_DIR,{recursive:true});await page.exposeFunction('cityCapture',async name=>page.locator('#game').screenshot({path:path.join(process.env.MEOWQUEST_CAPTURE_DIR,name+'.png')}));}
    // The test reads exact pixels, so serve the offline files under one test
    // origin. Chromium restricts getImageData on file:// images.
    const root=path.resolve(__dirname,'..');
    await page.route('http://meowquest.test/**',async route=>{
      const name=decodeURIComponent(new URL(route.request().url()).pathname.slice(1)),file=path.resolve(root,name);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({path:file});
    });
    await page.goto('http://meowquest.test/index.html');await page.waitForFunction(()=>window.OW?.game?.ready);
    const out=await page.evaluate(async()=>{
      const checks=[],g=OW.game,ok=(v,name)=>{if(!v)throw Error(name);checks.push(name);};
      g.start({slot:2});g.frame=()=>{};g.ui.hideMenu();g.players[0].level=26;g.players[0].xp=0;g.recalculate(g.players[0]);g.world.opened.add('ironveil_rail_pass');g.world.opened.add('recon_berlin_clearance');for(let i=0;i<8;i++)g.world.liberated.add('boss_'+i);
      const [iron,black]=g.world.cityZones,w=g.world,p=g.players[0],engine=OW.CityPaving,r=g.renderer;
      ok(!!engine?.draw,'production terrain renderer installed');const frames=async n=>{for(let j=0;j<n;j++)await new Promise(requestAnimationFrame);};
      const imgs=[0,1,2,3,4,5].map(i=>'urban-floor-'+i);for(const id of imgs)OW.TownStreets.image(id);
      for(let n=0;n<220&&!imgs.every(id=>OW.TownStreets.image(id));n++)await frames(1);
      ok(imgs.every(id=>OW.TownStreets.image(id)),'six offline material tiles decoded');
      const result={};
      for(const city of [iron,black]){
        const b=city.routes.find(r=>r.kind==='boulevard'),anchor=b.points[Math.min(1,b.points.length-1)],x=Math.floor(anchor.x-310),y=Math.floor(anchor.y-170);
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d',{willReadFrequently:true});
        const sr={ctx:c,time:0,clock:3,terrainView:{x,y,w:640,h:360}};
        let allocations=0;const create=document.createElement.bind(document);document.createElement=(...args)=>{if(args[0]==='canvas')allocations++;return create(...args);};
        function draw(dx,dy){
          c.setTransform(1,0,0,1,0,0);c.fillStyle='#ff00ff';c.fillRect(0,0,640,360);c.translate(-x-dx,-y-dy);
          sr.terrainView={x:x+dx,y:y+dy,w:640,h:360};engine.draw(sr,w,city);
        }
        try{
          draw(0,0);const img=c.getImageData(0,0,640,360).data,first=allocations,colors=new Set();let bare=0;
          for(let i=0;i<img.length;i+=4*53){colors.add((img[i]<<16)|(img[i+1]<<8)|img[i+2]);if(img[i]===255&&img[i+1]===0&&img[i+2]===255)bare++;}
          ok(bare===0&&colors.size>45,city.key+' opaque, varied street ground');
          const ms=[];for(let i=0;i<17;i++){const t=performance.now();for(let j=0;j<12;j++)draw(0,0);c.getImageData(0,0,1,1);ms.push((performance.now()-t)/12);}
          ok(allocations===first,city.key+' warm view reuses raster chunks');ms.sort((a,b)=>a-b);result[city.key]=+ms[8].toFixed(3);
          draw(31,23);const shifted=c.getImageData(0,0,609,337).data;let diff=0,total=0;
          for(let yy=3;yy<332;yy+=11)for(let xx=3;xx<604;xx+=11){const i=((yy+23)*640+xx+31)*4,j=(yy*609+xx)*4;total++;if(Math.max(...[0,1,2].map(k=>Math.abs(img[i+k]-shifted[j+k])))>2)diff++;}
          ok(diff/total<.003,city.key+' camera panning preserves world-aligned paving');
        }finally{document.createElement=create;}
      }
      const canal=iron.canals[0],bridge=canal.bridges[Math.floor(canal.bridges.length/2)];
      ok(canal.w>0&&bridge&&w._navigationRay(bridge.x+12,bridge.y+bridge.h/2,bridge.x+bridge.w-12,bridge.y+bridge.h/2,13),'canal bridge has a traversable crossing');
      async function capture(city,x,y,name){
        Object.assign(p,{x,y});g.camera={x,y,zoom:1.12,shake:0};g.world.updateActive(g.players,1,g);g.interactionPrompt='';g.update(.016);g.ui.lastUpdate=0;g.ui.update();r.draw(.016);
        for(let i=0;i<35;i++){await frames(1);g.update(.025);r.draw(.025);g.ui.update();}
        if(window.cityCapture)await cityCapture(name);
      }
      if(window.cityCapture){
        await new Promise(resolve=>setTimeout(resolve,4300));
        await capture(iron,bridge.x+bridge.w+45,bridge.y+bridge.h/2-12,'ironveil-canal-crossing');
        const square=black.squares.find(s=>s.kind==='ministry')||black.squares[0],spot={x:square.x+square.w*.60,y:square.y+square.h*.71};
        await capture(black,spot.x,spot.y,'blackglass-civic-streets');
      }
      return {checks,warmGroundMedianMs:result};
    });
    if(errors.length)throw Error(errors.join('; '));console.log(JSON.stringify(out,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
