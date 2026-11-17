'use strict';
/* Twenty seconds at the live browser cadence, one standard Gamepad API device per hero. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
// Capture Chromium's actual composited viewport, including game HUD and live civilians.
async function recordViewport(page,file){
  const session=await page.context().newCDPSession(page);
  await page.evaluate(()=>{
    const surface=document.createElement('canvas');surface.width=1024;surface.height=576;
    const ctx=surface.getContext('2d'),stream=surface.captureStream(0),track=stream.getVideoTracks()[0];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1750000});
    const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
    window.streetMovie={recorder,ctx,track,chunks,count:0,surface};recorder.start();
  });
  let pending=null,closed=false;
  session.on('Page.screencastFrame',event=>{
    session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
    if(closed||pending)return;
    pending=page.evaluate(async data=>{
      const im=new Image();im.src='data:image/jpeg;base64,'+data;await im.decode();
      const v=window.streetMovie;v.ctx.drawImage(im,0,0,v.surface.width,v.surface.height);v.track.requestFrame();v.count++;
    },event.data).finally(()=>{pending=null;});
  });
  await session.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1024,maxHeight:576,everyNthFrame:2});
  return async()=>{
    closed=true;await session.send('Page.stopScreencast');if(pending)await pending;
    const video=await page.evaluate(async()=>{
      const v=window.streetMovie;await new Promise(resolve=>{v.recorder.onstop=resolve;v.recorder.stop();});v.track.stop();
      const blob=new Blob(v.chunks,{type:'video/webm'}),url=URL.createObjectURL(blob),el=document.createElement('video');
      el.src=url;el.muted=true;await new Promise((resolve,reject)=>{el.onloadeddata=resolve;el.onerror=reject;});
      const width=el.videoWidth,height=el.videoHeight;URL.revokeObjectURL(url);
      const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
      return {count:v.count,width,height,data};
    });
    assert.ok(video.count>=60&&video.width===1024&&video.height===576,'Expected a playable street video');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(video.data.split(',')[1],'base64'));
    console.log('Recorded '+video.count+' actual viewport frames at '+video.width+' × '+video.height);
    await session.detach();
  };
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const key=process.env.CITY_WALK_CITY||'ironveil';
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.walkPads=[0,1].map(index=>({index,id:'City walk '+index,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      Object.defineProperty(navigator,'getGamepads',{value:()=>walkPads});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready);
    await page.evaluate(async key=>{
      const g=OW.game;g.start({slot:0,coop:true});g.settings.screenShake=false;
      const w=g.world,c=w.cityZones.find(v=>v.key===key),[p,q]=g.players;
      w.opened.add('ironveil_rail_pass');if(key==='blackglass'){for(let i=0;i<8;i++)w.liberated.add('boss_'+i);w.opened.add('recon_berlin_clearance');}
      const tram=w.getLocation(c.id+'_tram'),button=walkPads[0].buttons[g.input.padBindings.interact];
      Object.assign(p,{x:tram.x,y:tram.y});Object.assign(q,{x:tram.x+22,y:tram.y});g.travelInteractUntil=0;
      await new Promise(requestAnimationFrame);Object.assign(button,{pressed:true,value:1});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);Object.assign(button,{pressed:false,value:0});
      if(OW.CityWatch.zone(w,p)!==c)throw Error('Did not disembark the tram at '+key);
      const route=[c.id,c.id+'_witness',c.id+'_archive',c.id+'_roof'].map(id=>w.getLocation(id)).filter(Boolean);
      const timing={},windows={},portraits=new Set();
      const drawObject=g.renderer.drawObject;g.renderer.drawObject=function(o,...args){if(o.cityCitizen&&this.visible(o.x,o.y,0))portraits.add(o.id);return drawObject.call(this,o,...args);};
      for(const [obj,method] of [[g,'update'],[g.renderer,'draw'],[g.renderer,'drawTerrain'],[w,'steerAround'],[OW.CityVision,'contour'],[OW.CityPaving,'draw']]){
        if(!obj?.[method])continue;const original=obj[method],label=obj===OW.CityPaving?'paving':method;timing[label]=0;windows[label]=[];
        obj[method]=function(...args){const now=performance.now();try{return original.apply(this,args);}finally{const cost=performance.now()-now;timing[label]+=cost;if(method==='draw'||method==='update')windows[label].push(cost);}};
      }
      const walked=[0,0],last=g.players.map(h=>({x:h.x,y:h.y})),start=performance.now();let target=0,frames=0,lastTick=start;const present=[];
      window.walkRecord={walked,route:[],samples:[],c,key,timing,windows,portraits,present,frames:0};
      function tick(){
        const now=performance.now(),elapsed=(now-start)/1000;if(frames>0)present.push(now-lastTick);lastTick=now;
        if(elapsed>21||!g.players.length||window.walkRecord.done){walkPads.forEach(pad=>pad.axes.fill(0));window.walkRecord.done=true;return;}
        const goal=route[target];
        if(Math.hypot(p.x-goal.x,p.y-goal.y)<85&&target<route.length-1){window.walkRecord.route.push(goal.name);target++;}
        for(const [i,h] of g.players.entries()){
          const pad=walkPads[i],gap=i?Math.hypot(h.x-p.x,h.y-p.y):0;
          const dest=i?(gap>94?p:{x:p.x+35,y:p.y-30}):route[target];
          const dist=Math.hypot(dest.x-h.x,dest.y-h.y);
          if(frames%6===0||dist<31){const move=dist>31?w.steerAround(h,dest,.1):{mx:0,my:0};pad.axes[0]=move.mx;pad.axes[1]=move.my;}
          walked[i]+=Math.hypot(h.x-last[i].x,h.y-last[i].y);last[i]={x:h.x,y:h.y};
        }
        frames++;window.walkRecord.frames=frames;
        if(Math.floor(elapsed)>window.walkRecord.samples.length)window.walkRecord.samples.push([Math.round(p.x),Math.round(p.y),Math.round(q.x),Math.round(q.y),g.fps]);
        requestAnimationFrame(tick);
      }
      tick();
    },key);
    const capture=process.env.CITY_WALK_CAPTURE;
    if(capture)fs.mkdirSync(capture,{recursive:true});
    let stopMovie;
    for(const sec of [1,6,12,19]){
      await page.waitForFunction(n=>window.walkRecord?.samples.length>=n,sec,{timeout:32000});
      if(capture)await page.screenshot({path:path.join(capture,key+'-'+String(sec).padStart(2,'0')+'s.png')});
      if(sec===1&&process.env.CITY_WALK_MOVIE)stopMovie=await recordViewport(page,process.env.CITY_WALK_MOVIE);
      if(sec===19&&stopMovie)await stopMovie();
    }
    await page.waitForFunction(()=>window.walkRecord.done);
    const result=await page.evaluate(()=>({walked:walkRecord.walked.map(Math.round),route:walkRecord.route,frames:walkRecord.frames,samples:walkRecord.samples,paintedCivilians:[...walkRecord.portraits],presentationMs:[.5,.95].map(p=>+walkRecord.present.sort((a,b)=>a-b)[Math.floor(walkRecord.present.length*p)].toFixed(1)),browser:navigator.userAgent,logicalCores:navigator.hardwareConcurrency,averageMs:Object.fromEntries(Object.entries(walkRecord.timing).map(([k,v])=>[k,+(v/walkRecord.frames).toFixed(2)])),p95Ms:Object.fromEntries(Object.entries(walkRecord.windows).filter(([,v])=>v.length).map(([k,v])=>[k,+v.sort((a,b)=>a-b)[Math.floor(v.length*.95)].toFixed(2)]))}));
    assert.deepEqual(errors,[]);assert.ok(result.paintedCivilians.length>1,'The live walk should pass several city residents');assert.ok(result.walked.every(v=>v>380),'Both hero sticks should travel on foot '+JSON.stringify(result));
    if(capture)fs.writeFileSync(path.join(capture,key+'-walk.json'),JSON.stringify(result,null,2));
    console.log(key+' · '+result.frames+' visible frames · '+result.paintedCivilians.length+' painted residents · '+result.walked.join(' / ')+' walked units · '+result.route.join(', ')+' · avg ms '+JSON.stringify(result.averageMs)+' · p95 '+JSON.stringify(result.p95Ms)+' · presented p50/p95 '+result.presentationMs.join('/'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
