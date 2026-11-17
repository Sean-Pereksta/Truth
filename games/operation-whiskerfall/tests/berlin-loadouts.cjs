'use strict';
/* Run with Playwright on NODE_PATH and optionally CHROME_PATH. No network
   services, UI automation shortcuts, or production save slots are required. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const ids=['rushleaf','lockjaw','skyneedle','wrenwheel','leafsaber','latchhammer'];
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready);
    const results=[];
    for(const id of ids){
      // Isolate clocks, status effects, AI and random streams between runs.
      await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready);
      const row=await page.evaluate(id=>{
        const W=window.OW,g=W.game,dt=1/60;
        g.frame=()=>{};
        let seed=1839;
        Math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
        g.start({coop:false});g.ui.hideMenu();
        const base={x:4215,y:8790},w=g.world,p=g.players[0],gear=W.Content.reconGear.patterns.find(i=>i.id==='weapon_'+id||i.id==='melee_'+id);
        const melee=gear.melee!=null;
        for(let i=0;i<8;i++)w.liberated.add('boss_'+i);
        g.berlinUnlocked=()=>true;w.berlinUnlocked=()=>true;
        w.activeEnemies=[];w._active.clear();g.bulletPool.reset();g.effectPool.reset();
        g.drops=[];g.allies=[];g.clearPlayerCombat(p);
        Object.assign(p,{x:base.x-70,y:base.y,level:26,xpNext:1e7,hp:10000,maxHp:10000,invuln:0,reserve:99999,armorBonus:.35});
        p.skills.melee=p.skills.firearms=4;
        if(melee){p.melee=gear.melee;p.reconBladeRanks={[id]:4};}
        else {p.weapon=gear.weapon;p.weaponUpgrades={[p.weapon]:4};p.upgrade=4;}
        p.ammo=p.magSize=g.weapon(p).magazine;
        const loc=w._spawns.get('boss_berlin_commander');
        const boss=w._createEnemy({id:'qa-whisker',type:loc.type,x:base.x+150,y:base.y,homeX:base.x+150,homeY:base.y,level:28,region:7,boss:true,bossIndex:8,finalBoss:true,reconPractice:true,name:'Adolph Whisker',patrol:0});
        w.activeEnemies.push(boss);
        g.camera={...base,zoom:.93,shake:0};g.settings.damageNumbers=false;w._rebuildEnemyGrid();
        let received=0,inflicted=0,steps=0;
        const phases=new Set(),realHit=g.damagePlayer.bind(g),realStrike=g.damageEnemy.bind(g);
        g.damagePlayer=(p,...args)=>{
          p.hp=p.maxHp=10000;
          realHit(p,...args);received+=Math.max(0,10000-p.hp);
        };
        g.damageEnemy=(e,...args)=>{
          const before=e.hp,result=realStrike(e,...args);
          if(e===boss)inflicted+=Math.max(0,before-Math.max(0,e.hp));
          return result;
        };
        const aim=()=>Math.atan2(boss.y-p.y,boss.x-p.x);
        function decide(){
          const angle=aim(),dx=Math.cos(angle),dy=Math.sin(angle),d=W.dist(p,boss),gun=g.weapon(p);
          const reach=melee?g.blade(p).range:0;
          let mx=0,my=0;
          if(melee&&d>reach*.72||!melee&&d>300){mx=dx;my=dy;}
          if(!melee){
            if(d<150){mx=-dx;my=-dy;}
            mx-=.32*dy*Math.sin(steps/90);my+=.32*dx*Math.sin(steps/90);
          }
          const action=W.ReconCombat.record(boss)?.action;
          const threatened=action?.beats.some(b=>!b.spent&&b.at-action.elapsed<.15&&W.ReconCombat.inside(b.shape,p));
          if(threatened){mx=-dy;my=dx;}
          const lostLane=!g.lineOfSight(p,boss)||!w.isFinalArena(p.x+mx*75,p.y+my*75);
          if(lostLane||w.isBlocked(p.x+mx*35,p.y+my*35,18)){
            const goal=melee?boss:{x:base.x-50+85*Math.cos(steps/95),y:base.y+65*Math.sin(steps/95)};
            const path=w.steerAround(p,goal,dt);mx=path.mx;my=path.my;
          }
          const shoot=!melee&&(gun.mechanic==='charge'?(p.charge||0)<gun.chargeTime:gun.mechanic!=='semi'||!p.shootWasDown);
          return {mx,my,shoot,melee:melee&&d<reach+19,heavy:gear.reconFamily==='maul',aimX:dx,aimY:dy,dodge:!!threatened&&w.isFinalArena(p.x+mx*170,p.y+my*170)};
        }
        while(boss.hp>0&&steps<60*240){
          steps++;g.time+=dt;g.enemyFrame++;g.grid.clear();
          for(const e of w.activeEnemies)if(e.hp>0)g.grid.insert(e);
          g.updatePlayer(p,decide(),dt);g.updateEnemies(dt);g.updateProjectiles(dt);g.updateEffects(dt);g.updateCamera(dt);
          phases.add(boss.phase);
        }
        return {family:gear.reconFamily,item:gear.name,health:boss.maxHp,seconds:+(steps*dt).toFixed(2),damageTaken:received,directDamageDealt:Math.round(inflicted),remaining:Math.max(0,boss.hp),phases:[...phases].filter(Number.isFinite)};
      },id);
      results.push(row);console.log(JSON.stringify(row));
    }
    assert.deepEqual(errors,[]);
    for(const r of results){assert.equal(r.health,9500);assert.equal(r.remaining,0,r.item+' timed out');assert.equal(new Set(r.phases).size,4,r.item+' missed a phase');}
    console.log('Six-family Berlin check passed in Chromium '+browser.version());
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
