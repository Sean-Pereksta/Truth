'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const height=Number(process.env.MEOWQUEST_VIEWPORT_HEIGHT)===1080?1080:720;
    const page=await browser.newPage({viewport:{width:height===1080?1920:1280,height}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    if(process.env.MEOWQUEST_CAPTURE_DIR){fs.mkdirSync(process.env.MEOWQUEST_CAPTURE_DIR,{recursive:true});await page.exposeFunction('tavernCapture',async id=>page.screenshot({path:path.join(process.env.MEOWQUEST_CAPTURE_DIR,id+'.png')}));}
    await page.addInitScript(()=>{
      const pads=[0,1].map(index=>({id:'Copper test '+index,index,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      Object.defineProperty(navigator,'getGamepads',{value:()=>pads.map(p=>p.connected?p:null)});
      const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
      window.tapTest={pads,frames,press:async(btn,seat=0)=>{const b=pads[seat].buttons[btn];b.pressed=true;b.value=1;await frames(2);b.pressed=false;b.value=0;await frames(2);}};
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready);
    const results=await page.evaluate(async()=>{
      const g=OW.game,t=tapTest,rows=[],press=t.press,ok=(p,m)=>{if(!p)throw Error(m);rows.push(m);};
      g.start({slot:1,coop:true});await t.frames(3);
      async function gate(){
        const l=g.world.getLocation('tavern_copper_minnow');if(!l||g.world.isBlocked(l.x,l.y,20))throw Error('Blocked harbor gate');g.players.forEach((p,i)=>Object.assign(p,{x:l.x+i*12,y:l.y}));g.travelInteractUntil=0;await t.frames(2);await press(g.input.padBindings.interact);if(g.tavernVisit?.scene!=='room')throw Error('Tavern entry failed');
      }
      async function move(id,seat=0){
        const target=OW.CopperMinnow.bodies.find(b=>b.id===id),p=g.tavernVisit.actors[seat],pad=t.pads[seat];
        const step=async(x,y)=>{
          for(let i=0;i<550;i++){const dx=x-p.x,dy=y-p.y;if(Math.hypot(dx,dy)<2)break;
            pad.axes[0]=Math.abs(dx)<1?0:Math.sign(dx)*Math.min(1,Math.abs(dx)/3);pad.axes[1]=Math.abs(dy)<1?0:Math.sign(dy)*Math.min(1,Math.abs(dy)/3);await t.frames(1);}
          pad.axes[0]=pad.axes[1]=0;await t.frames(1);
        };
        if(p.y>58&&target.y<45){await step(35,67);await step(35,41);}
        if(p.y<46&&target.y>55){await step(35,40);await step(35,66);}
        await step(target.x,target.y);if(Math.hypot(target.x-p.x,target.y-p.y)>8)throw Error('Could not walk to '+id+' · '+p.x+','+p.y);
        await press(0,seat);return g.tavernVisit?.scene;
      }
      async function pick(id,seat=0){
        const opts=[...document.querySelectorAll('.tavern-options button')],j=opts.findIndex(b=>b.dataset.tavern===id);
        if(j<0)throw Error('Missing '+id+' on '+g.tavernVisit.scene+' · '+opts.map(b=>b.dataset.tavern));
        for(let k=0;k<opts.length+2&&g.tavernVisit.cursor!==j;k++)await press(13,seat);
        if(g.tavernVisit.cursor!==j)throw Error('No focus '+id);await press(0,seat);
      }
      await gate();await t.frames(10);if(window.tavernCapture)await tavernCapture('copper-minnow-taproom');
      ok(await move('barkeep')==='chat','walk to Mae and open conversation');await pick('talk1');ok(g.tavernVisit.note.includes('delivery slips'),'patron responds to selected question');await press(1);
      for(const [id,stake] of [['regular',15],['expert',25]]){
        ok(await move(id)==='table','walk to distinct '+id+' table');
        ok(document.querySelector('.tavern-panel p').textContent.includes(stake+' coins'),id+' stakes shown before paying');
        const pre=g.players[0].gold;await pick('solo');let h=g.tavernBook.hand;
        ok(h.seats.length===2&&g.players[0].gold===pre-stake,'solo table reserves correct stake');
        const face=JSON.stringify(h.tell);g.ui.render();await t.frames(2);ok(JSON.stringify(g.tavernBook.hand.tell)===face,'table expression stays committed across redraws');
        let moves=0;
        while(g.tavernBook.hand.phase!=='done'&&moves++<100){
          h=g.tavernBook.hand;const p=h.seats[h.turn];if(p.id===2){await t.frames(6);continue;}
          if(id==='expert')await pick('fold');else if(h.phase==='draw')await pick('draw');else await pick(OW.TavernRules.legal(h).includes('call')?'call':'check');
        }
        h=g.tavernBook.hand;ok(h.phase==='done'&&h.paid&&g.players[0].gold===pre-h.seats[0].paid+h.payout[0],id+' solo hand settles actual coins exactly once');await press(1);
      }
      ok(await move('easy')==='table','walk to easy table');const pre=g.players.map(p=>p.gold),priorHand=JSON.stringify(g.tavernBook.hand);
      const save=g.save;g.save=()=>false;await pick('local');g.save=save;
      ok(JSON.stringify(g.tavernBook.hand)===priorHand&&g.players.every((p,i)=>p.gold===pre[i]),'failed opening save preserves previous hand and both wallets');await pick('local');
      let hand=g.tavernBook.hand;ok(hand.seats.length===3&&g.players.every((p,i)=>p.gold===pre[i]-5),'easy table reserves precisely five per human');
      const saved=JSON.stringify(hand);g.save(false);g.start({slot:1,load:true});ok(!g.tavernVisit&&JSON.stringify(g.tavernBook.hand)===saved,'Continue retains exact hand, deck, pot, turn and tell');
      await gate();await move('easy');await pick('resume');let show=false,sawDraw=false,wrongSeat=false,failedMove=false;
      for(let turns=0;turns<90&&g.tavernBook.hand.phase!=='done';turns++){
        hand=g.tavernBook.hand;const seat=hand.seats[hand.turn].id;if(seat===2){await t.frames(6);continue;}
        if(g.tavernVisit.revealed!==seat){
          if(!wrongSeat){await press(0,1-seat);ok(g.tavernVisit.revealed!==seat,'only the current player can reveal their cards');wrongSeat=true;}
          await pick('reveal',seat);
        }
        if(!show&&window.tavernCapture){await t.frames(4);await tavernCapture('copper-minnow-five-card-draw');show=true;}
        if(hand.phase==='draw'){await pick('card0',seat);ok(g.tavernVisit.discards.includes(0),'draw marks a card');await pick('draw',seat);sawDraw=true;}
        else{const legal=OW.TavernRules.legal(hand),action=legal.includes('check')?'check':'call';
          if(!failedMove){const prior=JSON.stringify(hand);g.save=()=>false;await pick(action,seat);g.save=save;ok(JSON.stringify(g.tavernBook.hand)===prior,'failed bet save restores hand and wallet');failedMove=true;}
          await pick(action,seat);}
      }
      hand=g.tavernBook.hand;ok(sawDraw&&hand.phase==='done'&&hand.paid,'draw and showdown complete through both controllers');
      ok(g.players.every((p,i)=>p.gold===pre[i]-hand.seats[i].paid+hand.payout[i]),'showdown returns unused reserve and exact pot share');
      if(window.tavernCapture)await tavernCapture('copper-minnow-showdown');
      const settled=g.players.map(p=>p.gold);g.save(false);g.start({slot:1,load:true});ok(g.players.every((p,i)=>p.gold===settled[i]),'Continue does not pay twice');await gate();
      ok(await move('darts')==='oche','walk from harbor door to darts');await pick('dlocal');await t.frames(4);
      for(let i=0;i<6;i++){const d=g.tavernVisit.darts,seat=d.turn,pad=t.pads[seat];pad.axes[1]=-.7;await t.frames(6);pad.axes[1]=0;pad.buttons[0].pressed=true;await t.frames(8);pad.buttons[0].pressed=false;await t.frames(3);}
      const darts=g.tavernVisit.darts;ok(darts.finish&&darts.count.every(n=>n===3)&&darts.banked,'two local players each throw three darts and bank records');
      if(window.tavernCapture)await tavernCapture('copper-minnow-darts');
      await press(1);ok(g.tavernVisit.scene==='room','return to walkable interior');for(const person of ['angler','mouse']){ok(await move(person)==='chat','walk to '+person);await pick('talk0');ok(g.tavernVisit.note.length>30,person+' offers a substantive reply');await press(1);}
      await move('darts');await pick('dsolo');await t.frames(3);
      const match=g.tavernVisit.darts;
      for(let i=0;i<160&&!match.finish;i++){
        if(match.turn===1){await t.frames(5);continue;}
        t.pads[0].buttons[0].pressed=true;await t.frames(8);t.pads[0].buttons[0].pressed=false;await t.frames(3);
      }
      ok(match.finish&&match.count[1]===3&&match.banked,'Pipkin and a human complete solo darts');await press(1);
      await move('exit');ok(!g.tavernVisit,'walk out through harbor door');
      return rows;
    });assert.deepEqual(errors,[]);console.log(results.length+' tavern browser checks passed');console.log(results.join('\n'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
