'use strict';
/* Normal title-to-town route. Only the two virtual Gamepad devices send input. */
const path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    for(const [height,coop] of [[720,false],[1080,true]]){
      const page=await browser.newPage({viewport:{width:height===720?1280:1920,height}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(({coop})=>{
        const pads=Array.from({length:coop?2:1},(_,index)=>({id:'Route device '+index,index,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
        Object.defineProperty(navigator,'getGamepads',{value:()=>pads});
        const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
        window.coachTest={pads,frames,press:async n=>{const b=pads[0].buttons[n];b.pressed=true;b.value=1;await frames(2);b.pressed=false;b.value=0;await frames(2);}};
      },{coop});
      await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.OW?.game?.ready);
      const checks=await page.evaluate(async coop=>{
        const g=OW.game,t=coachTest,ui=g.ui,log=[],check=(v,msg)=>{if(!v)throw Error(msg);log.push(msg);};
        async function focus(action,value){
          const selector='button[data-action="'+action+'"]'+(value==null?'':'[data-value="'+value+'"]');
          for(let i=0;i<50;i++){
            const all=ui.focusableControls(),current=all.includes(ui.controllerFocus[0])?ui.controllerFocus[0]:all.includes(document.activeElement)?document.activeElement:ui.defaultControllerFocus(all),goal=ui.host.querySelector(selector);
            if(!goal||!all.includes(goal))throw Error('Cannot select '+selector+' from '+ui.menu+' · '+ui.host.innerText.slice(0,430));
            if(current===goal){await t.press(0);return;}
            const boxes=all.map(el=>{const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,group:ui.navigationGroup(el)};});
            const queue=[[all.indexOf(current),null]],visited=new Set([all.indexOf(current)]);let first;
            for(let q=0;q<queue.length&&first==null;q++){
              const [index,start]=queue[q],at=boxes[index];
              for(const [dx,dy,n] of [[0,-1,12],[0,1,13],[-1,0,14],[1,0,15]]){
                let list=boxes.map((v,j)=>({j,along:(v.x-at.x)*dx+(v.y-at.y)*dy,across:Math.abs(dy?v.x-at.x:v.y-at.y),same:at.group&&at.group===v.group})).filter(v=>v.along>=4);
                if(dy&&list.some(v=>v.same))list=list.filter(v=>v.same);
                list.sort((a,b)=>(a.along+a.across*2.5)-(b.along+b.across*2.5));
                const to=list[0]?.j??(index+(dx+dy<0?all.length-1:1))%all.length;
                if(to===all.indexOf(goal)){first=start??n;break;}
                if(!visited.has(to)){visited.add(to);queue.push([to,start??n]);}
              }
            }
            if(first==null)throw Error('D-pad cannot reach '+selector+' from '+current.dataset.action);await t.press(first);
          }throw Error('Focus never reaches '+selector);
        }
        if(coop)await focus('mode','coop');
        await focus('launch');check(g.state==='playing'&&g.players.length===(coop?2:1),'launch from title');
        async function ride(id,loc){
          await t.press(9);check(ui.menu==='pause'&&ui.isOpen,'open Camp');
          await focus('menu','venueRoutes');check(ui.menu==='venueRoutes','Camp directory opens');
          const sel='[data-action="street-coach"][data-value="'+id+'"]';
          check(!!ui.host.querySelector(sel),'Crownrest coach is available');
          await focus('street-coach',id);await t.frames(6);
          const l=g.world.getLocation(loc);check(!ui.isOpen&&g.players.every(p=>Math.hypot(p.x-l.x,p.y-l.y)<76&&p.hp>0),'coach leaves party on foot beside '+id);
          await t.frames(28);await t.press(g.input.padBindings.interact);
        }
        await ride('bay','activity_bay');check(g.activity?.id==='bay'&&ui.menu==='town-activity','enter Shellbreak Bay from its sign');
        await t.press(13);await t.press(0);check(g.activity?.mode==='fish'&&g.activity.state.vsAI===!coop,'start count contest from the physical pier');
        await t.press(1);await t.press(13);await t.press(13);await t.press(0);check(!ui.isOpen&&!g.activity,'return to Crownrest');
        await ride('copper_minnow','tavern_copper_minnow');check(g.tavernVisit?.scene==='room','walk inside Copper Minnow');
        const who=g.tavernVisit.actors[0],pad=t.pads[0];pad.axes[1]=-.95;
        for(let i=0;i<200&&who.y>65;i++)await t.frames(1);pad.axes[1]=0;await t.frames(2);await t.press(0);
        check(g.tavernVisit.scene==='table'&&g.tavernVisit.table===1,'walk to the brass table and interact');
        await t.press(0);check(g.tavernBook.hand.phase!=='done'&&g.tavernBook.hand.seats.length===2,'sit down to five-card draw with Magpie');
        return log;
      },coop);if(errors.length)throw Error(errors.join('; '));console.log(height+'p '+(coop?'local co-op':'solo')+' · '+checks.length+' fresh-title coach checks passed');await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
