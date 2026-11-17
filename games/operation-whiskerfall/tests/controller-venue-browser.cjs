'use strict';
/* Real Gamepad API polling with two simulated devices. Travel alone is accelerated. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    for(const [width,height] of [[1280,720],[1920,1080]]){
      const page=await browser.newPage({viewport:{width,height}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.exposeFunction('captureVenue',async name=>{if(process.env.MEOWQUEST_CAPTURE_DIR){fs.mkdirSync(process.env.MEOWQUEST_CAPTURE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MEOWQUEST_CAPTURE_DIR,name+'-'+height+'.png')});}});
      await page.addInitScript(()=>{
        const pads=[0,1].map(index=>({id:index?'QA DualSense':'QA Xbox',mapping:'standard',index,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
        Object.defineProperty(navigator,'getGamepads',{value:()=>pads.map(p=>p.connected?p:null)});
        const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
        window.venueTest={
          async press(key,owner=0){const b=pads[owner].buttons[key];Object.assign(b,{pressed:true,value:1});await frames(2);Object.assign(b,{pressed:false,value:0});await frames(2);},
          async hold(key,on,owner){Object.assign(pads[owner].buttons[key],{pressed:on,value:Number(on)});await frames(2);},
          async connect(on,owner){pads[owner].connected=on;await frames(4);},
          frames
        };
      });
      await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready);
      const result=await page.evaluate(async()=>{
        const g=OW.game,t=window.venueTest,log=[];const press=t.press;
        const check=(v,msg)=>{if(!v)throw Error(msg);log.push(msg);};
        const wait=async(test,msg,limit=650)=>{for(let n=0;n<limit;n++){if(test())return;await t.frames(1);}throw Error('Timeout · '+msg);};
        async function travel(id){
          const entry=g.world.getLocation('activity_'+id);
          if(!entry)throw Error('Missing venue '+id);
          for(const [i,p] of g.players.entries())Object.assign(p,{x:entry.x+12*i,y:entry.y});
          g.travelInteractUntil=0;g.camera.x=entry.x;g.camera.y=entry.y;await t.frames(3);
          await press(g.input.padBindings.interact,0);await wait(()=>g.activity?.id===id,'enter '+id);
          check(g.activity.phase==='lobby','Physical '+id+' entry opens the venue');
        }
        async function choose(key){
          const dom=()=>[...document.querySelectorAll('.activity-choices [data-venue-choice]')],options=dom(),i=options.findIndex(b=>b.dataset.venueChoice===key);
          check(i>=0,'Offer '+key+' is visible');
          for(let n=0;n<options.length+1&&g.activity.cursor!==i;n++)await press(13);
          check(g.activity.cursor===i,'D-pad reaches '+key);const focused=dom().find(b=>b.classList.contains('is-current'))?.dataset.venueChoice;check(focused===key,'Focused '+key+'; actual '+focused);await press(0);if(!g.activity&&key!=='leave')throw Error('Closed after '+key+' from '+options.map(b=>b.dataset.venueChoice).join(','));
        }
        async function square(target,seat){
          const cursor=()=>g.activity.boardCursor[seat];
          for(let j=0;j<10&&cursor()!==target;j++){const pos=cursor(),dx=target%5-pos%5,dy=Math.floor(target/5)-Math.floor(pos/5);await press(dx<0?14:dx>0?15:dy<0?12:13,seat);}
          check(cursor()===target,'Seat '+(seat+1)+' reaches '+target);
        }
        g.start({slot:0,coop:true});await t.frames(5);
        await travel('lantern');await choose('versus');const a=g.activity;
        check(a.phase==='play'&&!a.solo,'Shared board has two seats');
        const L=OW.TownActivities.lantern,seen=[false,false];
        for(let j=0;j<2;j++){
          const s=a.state,seat=s.side,enemy=1-seat,cursor=a.boardCursor[seat],wrong=a.boardCursor[enemy];
          await press(15,enemy);check(a.boardCursor[seat]===cursor&&a.boardCursor[enemy]===wrong,'Out-of-turn controller cannot move either cursor');
          const m=L.moves(s).find(m=>s.pieces[m.i].at>=0),p=s.pieces[m.i];
          await square(p.at,seat);await press(0,seat);check(a.selected===m.i,'Own controller selects a legal piece');
          await press(1,seat);check(a.selected===null&&a.phase==='play','Back cancels the selection');
          await press(0,seat);await square(m.to,seat);await press(0,seat);check(a.state.pieces[m.i].at===m.to,'Controller commits a legal move');seen[seat]=true;
        }
        check(seen.every(Boolean),'Both board seats played');await window.captureVenue('lantern-two-pads');
        await t.connect(false,1);check(!!a.disconnected,'Board pauses on seat two disconnect');
        await t.connect(true,1);await press(0,1);check(!a.disconnected,'Board restores seat two');
        await press(1,a.owner);await wait(()=>a.phase==='pause','pause board');await choose('leave');await wait(()=>!g.activity,'leave board');
        await travel('lantern');await choose('ai1');const solo=g.activity;
        await wait(()=>solo.state.side===0,'solo player turn');
        const move=L.moves(solo.state).find(m=>solo.state.pieces[m.i].at>=0);
        await square(solo.state.pieces[move.i].at,0);await press(0);await square(move.to,0);await press(0);
        await wait(()=>solo.state.side===0,'AI reply');check(solo.state.turns[1]>=1,'Bellkeeper answers a controller move');
        await press(1);await choose('leave');await wait(()=>!g.activity,'leave tea room');
        await travel('bay');await choose('assist');await choose('fish');const bay=g.activity;
        await press(14,0);await press(15,1);check(bay.state.lines[0].aim!==bay.state.lines[1].aim,'Anglers select independent cast positions');
        await press(0,0);await wait(()=>bay.state.lines[0].state==='wait','float settles');check(bay.state.lines[1].state==='ready','P1 casts while P2 stays on the dock');
        await press(0,1);await wait(()=>bay.state.lines.every(l=>l.state==='bite'),'both floats dive');await press(0,0);await press(0,1);
        check(bay.state.lines.every(l=>l.state==='reel'),'Each controller hooks its own fish');
        await t.hold(0,true,0);await t.hold(0,true,1);await window.captureVenue('anglers-reeling');
        await wait(()=>bay.state.lines.every(l=>l.bag.length>0),'both fish landed',1800);await t.hold(0,false,0);await t.hold(0,false,1);
        check(g.activityBook.stock.every(b=>b.length>0),'Both catches reach their own market inventory');
        await window.captureVenue('fishing-two-pads');
        await press(1);await choose('leave');await wait(()=>!g.activity,'return from fishing');
        // Give each seat a distinct qualifying score, then use production equipment, rest and Continue.
        const M=OW.ActivityMastery,book=g.activityBook;
        check(M.settle(g,'quarry',{tier:3,won:true},[0]).length===1,'Arena winner receives a personal Laurel');
        check(M.settle(g,'bay',{lines:[{count:4,bestThree:4.25},{count:3,bestThree:7.22}]},[0,1]).length===1,'A personal 7 kg catch qualifies independently of the four-fish count');
        check(g.equip(0,'accessory_mastery_quarry')&&g.equip(1,'accessory_mastery_bay'),'Each hero can equip the earned item');
        g.toggleCoop();check(g.reservePlayer?.equipment.accessory.id==='accessory_mastery_bay','Resting hero keeps the equipped Creel');
        g.save(false);g.ui.showMenu('main');g.ui.slot=0;g.ui.mainTab='continue';g.ui.render();
        g.ui.host.querySelector('[data-action="launch"]').click();
        check(g.players.length===1&&g.reservePlayer?.equipment.accessory.id==='accessory_mastery_bay','Continue restores the resting hero and item');
        g.toggleCoop();check(g.players[1].equipment.accessory.id==='accessory_mastery_bay'&&g.players[0].equipment.accessory.id==='accessory_mastery_quarry','Rejoined heroes retain separate rewards');
        check(M.settle(g,'bay',{lines:[null,{count:4,bestThree:9}]},[1]).length===0,'Replayed high score cannot duplicate a saved item');
        check(g.activityBook.stock[1].length===book.stock[1].length,'Personal catches survive Save and Continue');
        return log;
      });
      assert.deepEqual(errors,[]);console.log('PASS · '+width+'×'+height+' · '+result.length+' controller venue checks.');
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
