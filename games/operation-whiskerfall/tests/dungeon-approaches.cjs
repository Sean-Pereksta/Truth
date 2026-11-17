/* Run with Playwright on NODE_PATH and an optional CHROME_PATH. */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const root=path.resolve(__dirname,'..'), manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/recon/approaches.json')));
  assert.equal(manifest.length,20);
  for(const row of manifest){assert(fs.statSync(path.join(root,row.path)).size>3000);assert(row.sourceCrop[2]>300&&row.anchor[1]===(row.key.startsWith('ground-')?0:.92));}
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(pathToFileURL(path.join(root,'index.html')).href);await p.waitForFunction(()=>window.OW?.game?.ready);
    const result=await p.evaluate(()=>{
      const g=OW.game,A=OW.DungeonApproaches,Q=OW.Recon,checks=[];
      function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
      function place(pos){g.players.forEach((hero,i)=>{hero.x=pos.x+i*32;hero.y=pos.y;});}
      g.start({coop:true});const initial=A.sites(g.world),before=g.world._spawns.size;
      check(initial.length===26,'all 26 dungeon approaches');
      check(initial.every(s=>s.pad&&!g.world.isBlocked(s.pad.x,s.pad.y,19)&&Math.hypot(s.loc.x-s.pad.x,s.loc.y-s.pad.y)>135),'separate, passable survey points at all entrances');
      check(initial.every(s=>g.world.locations.every(l=>l===s.loc||Math.hypot(l.x-s.pad.x,l.y-s.pad.y)>=142)),'survey pads keep other interactions clear');
      check(new Set(initial.map(s=>s.art)).size===14,'fourteen distinct exterior illustrations');
      check(A.onCamera({view:{x:100,y:100,w:400,h:300}},{x:99,y:95},20)&&!A.onCamera({view:{x:100,y:100,w:400,h:300}},{x:1400,y:295},350),'paint only approaches near the viewport');
      const view=g.renderer.view,originalArt=OW.ReconArt.approach,originalGround=OW.ReconArt.approachGround;
      let offscreenRequests=0;
      try{
        g.renderer.view={x:-10000,y:-10000,w:300,h:300};
        OW.ReconArt.approach=OW.ReconArt.approachGround=()=>{offscreenRequests++;return null;};
        g.renderer.drawTerrain(g.world);
        for(const o of g.world.objects.filter(o=>o.type==='cave'))g.renderer.drawObject(o,g.world);
      }finally{g.renderer.view=view;OW.ReconArt.approach=originalArt;OW.ReconArt.approachGround=originalGround;}
      check(offscreenRequests===0,'off-camera field frame requests zero exterior paintings');
      check(g.world._spawns.size===before,'exterior discovery does not mutate campaign spawns');
      const old=initial.find(s=>!s.custom);place(old.pad);g.interact(g.players[0]);check(g.world.opened.has('survey_'+old.id),'legacy cave advice can be read');
      place(old.loc);g.time+=1;g.interact(g.players[0]);check(g.world.entry?.id===old.id,'legacy entrance keeps normal interact');g.leaveDungeon(false);
      for(const info of initial.filter(s=>s.custom)){
        const s=A.sites(g.world).find(s=>s.id===info.id),stationId='survey_'+s.id;
        place(s.pad);g.time=20;
        if(['gauge','vane','lens'].includes(s.custom.kind)){
          g.time={gauge:1,vane:4,lens:0}[s.custom.kind];
          g.interact(g.players[0]);check(!g.world.opened.has(stationId),'wait for environmental cue · '+s.id);
        }
        g.time=s.custom.kind==='gauge'?4:s.custom.kind==='lens'?2:10;
        const med=g.players[0].medkits,otherMed=g.players[1].medkits;if(s.art==='vault')g.toggleCoop();g.interact(g.players[0]);
        if(s.custom.guards){
          const guards=g.world.activeEnemies.filter(e=>e.id.startsWith(s.id+'_approach_watch_'));
          check(guards.length===2&&!g.world.opened.has(stationId),'bounded optional exterior fight · '+s.id);
          g.killEnemy(guards[0],g.players[0]);g.save(false);g.start({load:true,slot:0});place(s.pad);g.interact(g.players[0]);
          const survivors=g.world.activeEnemies.filter(e=>e.id.startsWith(s.id+'_approach_watch_')&&e.hp>0);
          check(survivors.length===1,'surviving watch restored without duplication · '+s.id);
          g.killEnemy(survivors[0],g.players[0]);g.interact(g.players[0]);
        }
        check(g.world.opened.has(stationId),'survey receipt · '+s.id);
        if(s.art==='vault'){g.interact(g.players[0]);check(g.players[0].medkits===med+1&&g.reservePlayer.medkits===otherMed+1,'field cache pays once for active and resting heroes');g.toggleCoop();}
        const op=Q.book.ops.find(o=>o.site===s.id);
        for(const prev of Q.book.ops.slice(0,Q.book.ops.indexOf(op))){if(!g.reconDossier.filed.includes(prev.id))g.reconDossier.filed.push(prev.id);g.reconDossier.evidence[prev.id]={route:'observed',source:Q.sourceName(prev,'observed')};}
        for(const n of op.bosses||[])g.world.liberated.add('boss_'+n);
        place(s.loc);g.time+=1;
        check(g.enterDungeon(g.world.getLocation(s.id)),'survey preserves dungeon entrance · '+s.id);
        const state=g.world.state;
        check(state.surveyApplied,'survey earns interior benefit · '+s.id);
        if(s.art==='archive'||s.art==='cistern')check(state.reconSwitch===1,'survey presets mechanism · '+s.id);
        if(s.art==='depot')check(state.reconBrake,'freight cart slowed');
        if(s.art==='spire')check(state.reconWindbreak,'wind load reduced');
        if(s.art==='court'){
          place(Q.cell(g.world.reconSite,'R'));g.time+=1;g.interact(g.players[0]);
          check(g.world.activeEnemies.filter(e=>e.id.startsWith('recon_watch_')).length===1,'decoy draws away one court guard');
        }
        check(g.save(false)&&g.start({load:true,slot:0})&&g.world.state.surveyApplied,'benefit survives Continue · '+s.id);
        g.leaveDungeon(false);
      }
      return checks.length;
    });
    assert.deepEqual(errors,[]);console.log(result+' approach checks passed');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
