'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,null,{timeout:60000});
    const result=await page.evaluate(async()=>{
      const W=window.OW,g=W.game, checks=[];
      const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
      g.frame=()=>{};
      g.start({slot:0,coop:true});
      async function read(title){
        check(g.comic?.book.title===title && g.paused,title+' pauses play');
        for(const panel of g.comic.book.panels){
          const im=new Image();im.src=W.Comics.asset(panel.art);await im.decode();
        }
        document.querySelector('.comic-reader .primary').click();
        check(g.comic.index===1,title+' advances');
        document.querySelector('.comic-reader .primary').click();
      }
      for(const i of [0,1,2,3,4,5,6,7,8]){
        const w=g.world,fort=w.getLocation(i===8?'boss_berlin':'boss_'+i);
        if(i===8){
          for(let n=0;n<8;n++)w.liberated.add('boss_'+n);
          w.opened.add('recon_berlin_clearance');
        }
        const boss=w._createEnemy(w._spawns.get(fort.id+'_commander'));
        w.addEnemy(boss);
        const hp=boss.hp;
        Object.assign(g.players[0],{x:fort.x-1200,y:fort.y});
        Object.assign(g.players[1],{x:fort.x-1200,y:fort.y+60});
        g.damageEnemy(boss,100,g.players[0]);check(boss.hp===hp&&!g.comic,'protected approach '+i);
        Object.assign(g.players[1],{x:fort.x,y:fort.y+90});
        g.updateAdvancedEnemy(boss,null,W.Content.bosses[i],1/60);
        await read(W.Content.bosses[i].name);
        check(!g.awaitBossIntroduction(boss),'shared introduction '+i);
        g.damageEnemy(boss,10,g.players[1]);check(boss.hp<hp,'battle unlocked '+i);
      }
      g.start({slot:0,load:true});
      check(g.questCounters['comic:commander:0']===1,'Continue remembers introductions');
      const w=g.world;
      g.npcLocation=w.getLocation('npc_town_way_0')||w.locations.find(l=>l.type==='npc'&&l.region===0);
      g.ui.showMenu('dialogue',0);
      for(const [key,title] of [['gallows_bell','The bell on the trail'],['seam_ripper','A seam in the dust']]){
        g.ui.host.querySelector('[data-action="hear-enemy"][data-value="'+key+'"]').click();
        await read(title);check(g.ui.menu==='dialogue'&&g.ui.isOpen,'conversation resumes '+key);
      }
      g.ui.host.querySelector('[data-action="hear-commander"]').click();
      await read(W.Content.bosses[0].name);
      g.ui.hideMenu();
      const book=W.Content.reconCampaign, d=g.reconDossier;
      for(const [act,index] of [[2,2],[3,8]]){
        d.filed=book.ops.slice(0,index).map(op=>op.id);
        for(const op of book.ops.slice(0,index+1))d.evidence[op.id]={route:'observed',source:'Field record'};
        g.ui.showMenu('journal',0);
        g.ui.host.querySelector('[data-action="recon-file"]').click();
        check(W.Save.read(0).questCounters['comic:pending-act']===act,'chapter break checkpoint '+act);
        await read('Act '+(act===2?'II':'III')+' · '+book.acts[act-1]);
        check(!g.questCounters['comic:pending-act']&&g.ui.isOpen&&g.ui.menu==='journal','chapter returns to Journal '+act);
        g.ui.hideMenu();
      }
      for(const [i,id] of ['cave_0_0','cave_0_1','cave_1_0','cave_1_1','cave_kraken'].entries()){
        const entry=g.world.getLocation(id);
        check(g.enterDungeon(entry,true),'enter lair '+id);
        const dw=g.world,e=dw.activeEnemies.find(n=>n.dungeonBoss);dw.state.solved=true;
        Object.assign(g.players[1],{x:1330,y:630});g.update(1/60);
        await read(i===4?'Nacremaw, the Great Kraken':W.DungeonGuardians[i].name);
        check(!g.awaitBossIntroduction(e),'guardian active '+id);g.leaveDungeon(false);
      }
      return checks;
    });
    assert.deepEqual(errors,[]);
    console.log('Passed '+result.length+' checks for nine commanders, five guardians, both act breaks, dialogue, and Continue.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
