'use strict';
/* Real input polling in Chromium. Camera jumps only shorten travel; real time is
   accelerated inside the long race after steering and the P2 handoff are checked. */
const path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const height=Number(process.env.MEOWQUEST_VIEWPORT_HEIGHT)===1080?1080:720;
    const page=await browser.newPage({viewport:{width:height===1080?1920:1280,height}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const pads=[0,1].map(i=>({id:'Test gamepad '+i,mapping:'standard',index:i,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
      Object.defineProperty(navigator,'getGamepads',{value:()=>pads.map(p=>p.connected?p:null)});
      const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
      window.activityTest={pads,frames,press:async(n,seat=0)=>{const b=pads[seat].buttons[n];b.pressed=true;b.value=1;await frames(2);b.pressed=false;b.value=0;await frames(2);}};
    });
    await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready);
    const results=await page.evaluate(async()=>{
      const r=[],g=OW.game,t=activityTest,press=t.press;
      function ok(v,msg){if(!v)throw Error(msg);r.push(msg);}
      async function enter(id){
        const loc=g.world.getLocation('activity_'+id);ok(loc&&!g.world.isBlocked(loc.x,loc.y,22),'walkable '+id);
        g.players.forEach((p,i)=>Object.assign(p,{x:loc.x+i*15,y:loc.y}));g.travelInteractUntil=0;await t.frames(2);await press(g.input.padBindings.interact);ok(g.activity?.phase==='lobby'&&g.activity.id===id,'enter '+id+' using controller');
      }
      async function choose(id){
        const buttons=[...document.querySelectorAll('.activity-choices [data-venue-choice]')],index=buttons.findIndex(b=>b.dataset.venueChoice===id);
        if(index<0)throw Error('Missing '+id+' in '+buttons.map(b=>b.dataset.venueChoice));
        for(let i=0;i<buttons.length&&g.activity.cursor!==index;i++)await press(13);
        if(g.activity.cursor!==index)throw Error('Unreachable '+id);await press(0);
      }
      g.start({slot:0,coop:true});await t.frames(3);
      await enter('yard');await choose('rail1');
      const y=g.activity.state;ok(y.coop,'separate switch banks');await press(13,1);await press(0,1);
      await press(13,1);await press(0,1);await press(13,1);await press(0,1);ok(y.cars.every(c=>!c.held),'P2 releases three carts');
      await press(2);ok(y.beat===0&&y.ready[0],'P1 cannot advance alone');await press(2,1);ok(y.beat===1,'P2 commits the beat');
      await press(3);ok(!y.rewind&&y.beat===0,'P1 rewinds the shift');
      for(let j=0;j<3;j++){await press(2);await press(2,1);}
      ok(g.activity.phase==='result'&&g.activity.banked&&g.activityBook.yard===2,'shift clears and banks next tier');await choose('leave');
      await enter('quarry');await choose('bout0');const q=g.activity.state;
      t.pads[0].axes[0]=1;t.pads[0].buttons[0].pressed=true;await t.frames(30);t.pads[0].axes[0]=0;
      ok(q.fighters[0].x>16,'real stick moves P1 in chalk ring');await press(2,1);ok(q.fighters[1].dodge>0,'P2 dodge owns its cooldown');
      // Bring the already-visible combatants into striking distance to cover banking.
      q.foes.forEach((e,i)=>{e.x=q.fighters[0].x+5+i;e.y=q.fighters[0].y;e.hp=1;});
      const pre=g.players.map(p=>p.gold);for(let j=0;j<150&&g.activity.phase==='play';j++)await t.frames(1);
      t.pads[0].buttons[0].pressed=false;await t.frames(2);
      ok(g.activity.phase==='result'&&g.players.every((p,i)=>p.gold===pre[i]+35),'first bout banks exact payout on both heroes');await choose('leave');
      await enter('wind');await choose('heats');const kite=g.activity.state;
      t.pads[0].axes[0]=.75;await t.frames(12);t.pads[0].axes[0]=0;ok(kite.x>0,'P1 steers first heat');
      function approachFinal(){Object.assign(g.activity.state,{stage:5,y:5.9998,x:OW.TownActivities.wind.rings[5],time:104,tension:.3});}
      approachFinal();await t.frames(6);ok(g.activity.phase==='handoff','local handoff waits for P2');await press(0);ok(g.activity.phase==='handoff','P1 cannot launch rival heat');await press(0,1);ok(g.activity.phase==='play'&&g.activity.heat===1,'P2 launches identical course');
      t.pads[1].axes[0]=-.75;await t.frames(12);t.pads[1].axes[0]=0;ok(g.activity.state.x<0,'P2 owns second kite');
      approachFinal();await t.frames(6);ok(g.activity.phase==='result'&&g.activity.banked&&g.activityBook.kiteBest>0,'two times settle record');await choose('leave');
      await enter('quarry');await choose('bout1');const gold=g.players.map(p=>p.gold);
      g.activity.state.fighters.forEach(p=>p.hp=0);await t.frames(4);ok(g.activity.phase==='result'&&g.players.every((p,i)=>p.gold===gold[i]),'defeat preserves prior coins');
      await choose('rematch');ok(g.activity.phase==='play','retry at gate');g.save(false);g.start({load:true,slot:0});await t.frames(3);
      ok(!g.activity&&!g.activityBook.interrupted&&g.players.every((p,i)=>p.gold===gold[i]),'Continue recovers both heroes and banked coins');
      const loc=g.world.getLocation('activity_quarry');ok(g.players.every(p=>Math.hypot(p.x-loc.x,p.y-loc.y)<78&&!g.world.isBlocked(p.x,p.y,18)),'both recover at walkable ring gate');
      await enter('bay');await choose('fish');
      const bay=g.activity.state;bay.lines[0].bag=[{weight:2.5},{weight:2.6},{weight:2.7}];bay.lines[1].bag=Array.from({length:4},()=>({weight:.6}));
      bay.time=bay.limit-.002;await t.frames(5);
      const creel=OW.Content.activityMasterworks.find(i=>i.activityMastery==='bay').id,owns=(p,id)=>p.inventory.some(e=>(e.id||e)===id);
      ok(g.activity.phase==='result'&&bay.winner===1&&owns(g.players[0],creel)&&!owns(g.players[1],creel),'losing count race can earn personal 7 kg Creel; light-count winner earns none');
      await choose('rematch');const next=g.activity.state;
      next.lines[1].bag=Array.from({length:8},()=>({weight:.5}));
      next.time=next.limit-.002;await t.frames(5);
      ok(g.activity.phase==='result'&&owns(g.players[1],creel)&&g.activityBook.catchRecords[1]===8,'eight light catches earn the timed race prize');
      await choose('leave');g.start({load:true,slot:0});
      ok(g.activityBook.catchRecords[1]===8&&g.activityBook.weightRecords[0]>=7&&owns(g.players[1],creel),'Continue retains both personal records and the timed catch award');
      return r;
    });assert.deepEqual(errors,[]);console.log(results.length+' controller venue integration checks passed');console.log(results.join('\n'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
