'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      window.watchPads=[0,1].map(index=>({index,connected:true,id:'Standard pad '+index,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      Object.defineProperty(navigator,'getGamepads',{value:()=>window.watchPads});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready,{},{polling:75});
    const results=await page.evaluate(()=>{
      const g=OW.game,S=OW.CityWatch,pads=window.watchPads,log=[];
      const check=(v,m)=>{if(!v)throw Error(m);log.push(m);};
      g.start({slot:0,coop:true});const w=g.world;w.opened.add('ironveil_rail_pass');
      const step=n=>{for(let i=0;i<n;i++){g.input.update(g);if(!g.paused)g.update(1/60);}};
      const axis=(seat,x,y)=>{pads[seat].axes[0]=x;pads[seat].axes[1]=y;};
      const button=(seat,action,held)=>Object.assign(pads[seat].buttons[g.input.padBindings[action]],{pressed:held,value:held?1:0});
      const press=(seat,action)=>{button(seat,action,true);step(1);button(seat,action,false);step(1);};
      const [p,q]=g.players,c=w.cityZones.find(v=>v.key==='ironveil'),tram=w.getLocation(c.id+'_tram');
      Object.assign(p,{x:tram.x,y:tram.y});Object.assign(q,{x:tram.x+25,y:tram.y+5});step(1);press(0,'interact');
      check(g.players.every(h=>S.zone(w,h)===c),'Both heroes board the freight tram with the Interact button');
      // Arrange a repeatable corner around real, solid city masonry. Input, guard
      // behavior, suspicion, ballistics, hearing and all resulting movement remain live.
      let fixture;
      for(const b of c.cover){
        const org={x:b.x-54,y:b.y-33},x=b.x+b.w+32,hidden={x,y:b.y+74},lit={x,y:b.y-35};
        const dummy={...org,cityWatch:c.key,watchBearing:0},actor=(v)=>({...v,hp:140});
        const partner={x:hidden.x+27,y:hidden.y+12},partnerEnd={x:partner.x+20,y:partner.y};
        if([org,hidden,lit,partner,partnerEnd].some(v=>w.isBlocked(v.x,v.y,20)))continue;
        if(Array.from({length:13},(_,i)=>w.isBlocked(x,lit.y+i*9,20)).some(Boolean))continue;
        if(!S.sees(w,dummy,actor(lit))||S.sees(w,dummy,actor(hidden))||S.sees(w,dummy,actor(partner))||S.sees(w,dummy,actor(partnerEnd)))continue;
        fixture={b,org,hidden,lit};break;
      }
      check(!!fixture,'A walkable occupied-street corner clips the flashlight beam');
      const {org,lit,hidden}=fixture;
      function reposition(){Object.assign(p,hidden);Object.assign(q,{x:hidden.x+27,y:hidden.y+12});w.updateActive(g.players,1,g);}
      reposition();
      const guard=w.activeEnemies.find(e=>e.cityWatch===c.key);
      check(!!guard,'City streams an actual night patrol');
      function reset(){
        reposition();Object.assign(guard,{...org,homeX:org.x,homeY:org.y,watchRoute:'x',watchPath:[[org.x,org.y],[org.x+80,org.y]],watchBearing:0,watchPhase:0,watchMode:'patrol',watchMemory:0,watchLast:null,watchSuspicion:[0,0],angle:0,fireTimer:3});
        g.time=0;g.eventTime=999;axis(0,0,0);axis(1,0,0);
      }
      reset();axis(1,1,0);step(4);axis(1,0,0);step(6);
      check(q.x>hidden.x+30&&guard.watchSuspicion.every(x=>x===0),'P2 quietly moves behind masonry without revealing either fighter');
      const before=p.y;axis(0,0,-1);step(24);axis(0,0,0);step(3);
      check(p.y<before-80&&guard.watchSuspicion[0]>0&&guard.watchSuspicion[0]<1,'P1 stick movement exposes the hero and starts a readable suspicion window');
      check(guard.watchSuspicion[1]===0,'The covered co-op partner keeps a clean suspicion meter');
      axis(0,0,1);press(0,'dodge');step(21);axis(0,0,0);step(38);
      check(!S.sees(w,guard,p)&&guard.watchSuspicion[0]===0&&guard.watchMode==='patrol','A controller dodge behind the corner clears suspicion before a whistle');
      reset();
      axis(0,0,-1);step(26);axis(0,0,0);
      let n=0;while(guard.watchMode!=='alarm'&&n++<135)step(1);
      check(guard.watchMode==='alarm'&&guard.watchLast,'Sustained exposure raises a real patrol whistle');
      axis(0,0,1);press(0,'dodge');step(28);axis(0,0,0);step(4);
      check(guard.watchMode==='search'&&Math.hypot(p.x-guard.watchLast.x,p.y-guard.watchLast.y)>65,'Breaking sight leaves a last-known-position search');
      check(guard.watchLast.y<hidden.y,'Search retains the sighting outside cover');
      reset();Object.assign(p,{weapon:0,ammo:0,reserve:0,reloading:0,fireTimer:0,shootWasDown:false});step(1);press(0,'shoot');
      check(guard.watchMode==='patrol'&&guard.watchMemory<=0,'An empty trigger behind cover does not report a shot');
      Object.assign(p,{ammo:5,reserve:12,reloading:0,fireTimer:0,shootWasDown:false});step(1);press(0,'shoot');
      check(p.ammo===4&&guard.watchMode==='search'&&guard.watchMemory>0,'An audible trigger press sends the watch to investigate while both heroes stay out of sight');
      axis(0,0,1);const last={...guard.watchLast};step(12);axis(0,0,0);
      check(guard.watchLast.x===last.x&&guard.watchLast.y===last.y&&p.y>last.y+30,'A sentry remembers the noise as the firing hero quietly moves away');
      // Venture through a named alley bordered by two different facade footprints.
      let passage;
      for(const road of c.routes.filter(r=>r.kind==='alley'&&r.points.length>2)){
        const a=road.points[0],b=road.points[1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<80)continue;
        const ux=dx/d,uy=dy/d,bearing=Math.atan2(dy,dx);
        for(let t=38;t<d-25;t+=12){
          const pos={x:a.x+ux*t,y:a.y+uy*t},blocks=OW.CityVision.nearby(c,pos,S.reach);
          const left=S.limit(pos,bearing+Math.PI/2,blocks,150),right=S.limit(pos,bearing-Math.PI/2,blocks,150);
          if(left<21||right<21||left+right>160||w.isBlocked(pos.x,pos.y,19))continue;
          const start={x:pos.x-ux*43,y:pos.y-uy*43},end={x:pos.x+ux*40,y:pos.y+uy*40};
          if(!w._navigationRay(start.x,start.y,end.x,end.y,19))continue;
          passage={road,start,end,ux,uy,bearing,left,right,pos,blocks};break;
        }
        if(passage)break;
      }
      check(!!passage,'An authored alley preserves a walkable gap between separate painted facades');
      const {start,end,ux,uy,bearing,road}=passage;
      Object.assign(p,start);Object.assign(q,{x:start.x-ux*24,y:start.y-uy*24});w.updateActive(g.players,1,g);
      axis(0,ux,uy);axis(1,ux,uy);step(19);axis(0,0,0);axis(1,0,0);
      check(Math.hypot(p.x-end.x,p.y-end.y)<25&&Math.hypot(q.x-start.x,q.y-start.y)>43,'Both controller sticks walk through '+road.name);
      const lamp={...start,watchBearing:bearing,cityWatch:c.key};
      check(S.sees(w,lamp,p)&&S.sees(w,lamp,q),'The flashlight travels through the same open alley as both heroes');
      const wallTarget={hp:140,x:passage.pos.x-uy*(passage.left+5),y:passage.pos.y+ux*(passage.left+5)};
      const sideLamp={...passage.pos,watchBearing:bearing+Math.PI/2,cityWatch:c.key};
      check(!S.sees(w,sideLamp,wallTarget)&&w.isBlocked(wallTarget.x,wallTarget.y,1),'The alley facade stops both movement and the same beam');
      return log;
    });
    assert.deepEqual(errors,[]);console.log('PASS · '+results.length+' live city counterplay checks with both gamepads.');console.log(results.join('\n'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
