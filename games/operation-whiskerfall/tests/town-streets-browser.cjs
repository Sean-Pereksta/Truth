'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const game=path.resolve(__dirname,'..'),shots=process.env.MEOWQUEST_STREET_CAPTURES;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(game,'index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready);
    const plans=await page.evaluate(()=>{
      const g=OW.game;g.frame=()=>{};g.start({slot:0,coop:true});g.ui.hideMenu();
      return Object.values(OW.Content.townStreets).map(d=>({id:d.id,key:d.key,small:d.small}));
    });
    const nav=await page.evaluate(()=>{
      const w=OW.game.world,report=[];
      for(const town of w.locations.filter(l=>l.type==='town')){
        // Flood fill at both heroes' body clearance. Services are operated within reaching distance.
        const step=30,lim=18,size=2*lim+1,seen=new Uint8Array(size*size),queue=[[0,0]],reached=[];
        seen[lim*size+lim]=1;
        for(let i=0;i<queue.length;i++){
          const [x,y]=queue[i],p={x:town.x+x*step,y:town.y+y*step};reached.push(p);
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const nx=x+dx,ny=y+dy,idx=(ny+lim)*size+nx+lim;
            if(Math.abs(nx)>lim||Math.abs(ny)>lim||seen[idx])continue;
            if(!w._navigationRay(p.x,p.y,town.x+nx*step,town.y+ny*step,22))continue;
            seen[idx]=1;queue.push([nx,ny]);
          }
        }
        const stops=w.locations.filter(l=>(l.townId===town.id||['activity','tavern','cityTram'].includes(l.type)&&l.region===town.region)&&Math.hypot(l.x-town.x,l.y-town.y)<550);
        const bad=stops.filter(s=>!reached.some(p=>Math.hypot(p.x-s.x,p.y-s.y)<52)).map(s=>s.id);
        const exit=queue.some(([x,y])=>Math.abs(x)===lim||Math.abs(y)===lim);
        if(!exit||bad.length)throw Error(town.name+' · exits '+exit+' · inaccessible '+bad.join(', '));
        report.push({id:town.id,count:stops.length});
      }return report;
    });
    assert.equal(nav.length,26);
    for(const d of plans.filter(d=>!d.small)){
      const inspection=await page.evaluate(async(d)=>{
        const g=OW.game,w=g.world,t=w.getLocation(d.id),l=w.getLocation('work_'+d.id),plan=OW.Content.townStreets[d.id];
        for(const [i,p] of g.players.entries())Object.assign(p,{x:t.x+25*i,y:t.y+80});
        g.ui.hideMenu();g.time=20;g.camera={x:t.x,y:t.y-25,zoom:.92,shake:0};g.renderer.draw(1/60);
        const keys=['landmark-'+plan.key,'street-'+plan.index,'home-'+plan.key];
        for(const key of keys){
          for(let i=0;!OW.TownStreets.image(key)&&i<80;i++)await new Promise(r=>setTimeout(r,25));
          if(!OW.TownStreets.image(key))throw Error('Missing scene '+key);
        }
        g.interactionPrompt='';g.ui.lastUpdate=0;g.ui.update();g.renderer.draw(1/60);
        if(OW.TownStreets.active(g,plan))throw Error('Already restored '+t.name);
        return {id:t.id,first:plan.action,walkable:!w.isBlocked(l.x,l.y,22)};
      },d);
      assert.ok(inspection.walkable);
      if(shots){fs.mkdirSync(shots,{recursive:true});await page.locator('#game').screenshot({path:path.join(shots,d.key+'-before.png')});}
      const completed=await page.evaluate(d=>{
        const g=OW.game,w=g.world,t=w.getLocation(d.id),l=w.getLocation('work_'+d.id),plan=OW.Content.townStreets[d.id],p=g.players[1];
        p.x=l.x;p.y=l.y;g.travelInteractUntil=0;g.interact(p);
        if(g.ui.menu!=='townGuide'||g.ui.playerIndex!==1||!w.opened.has('restored_'+d.id))throw Error('Player 2 local work '+t.name+' opened '+g.ui.menu);
        const guide=g.ui.townGuideMenu();if(!guide.includes(t.name)||!guide.includes('Forge'))throw Error('Missing services '+t.name);
        g.ui.hideMenu();g.completedQuests.add(plan.quest);g.ui.lastUpdate=0;g.ui.update();g.renderer.draw(1/60);
        return OW.TownStreets.home(g,plan);
      },d);
      assert.ok(completed);
      if(shots)await page.locator('#game').screenshot({path:path.join(shots,d.key+'-after.png')});
    }
    await page.evaluate(()=>{
      const g=OW.game,p=g.players[0],t=g.world.getLocation('town_0'),building=g.world.objects.find(o=>o.townPainting==='landmark-willow');
      p.x=building.x;p.y=building.y+building.h*.17;
      if(!g.world.isBlocked(p.x,p.y,19))throw Error('Fixture does not collide');
      g.save(false);g.start({slot:0,load:true});
      if(g.world.isBlocked(g.players[0].x,g.players[0].y,19)||Math.hypot(g.players[0].x-t.x,g.players[0].y-t.y)>650)throw Error('Continue relocation');
      if(!g.world.opened.has('restored_town_0')||!g.world.opened.has('restored_town_12'))throw Error('Local restoration lost');
    });
    assert.deepEqual(errors,[]);console.log(nav.length+' settlements, '+nav.reduce((s,t)=>s+t.count,0)+' walkable stops, 11 before/after states, P2 interaction and collision recovery passed in Chrome '+browser.version());
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
