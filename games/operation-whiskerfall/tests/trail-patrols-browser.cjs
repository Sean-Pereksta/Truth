'use strict';
const {strict:assert}=require('node:assert'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.OW?.game?.ready,null,{timeout:120000});
    const result=await page.evaluate(async()=>{
      const g=OW.game,C=OW.Content;g.frame=()=>{};g.start({coop:true});
      const w=g.world,p=g.players[1],other=g.players[0];
      const ok=(value,message)=>{if(!value)throw Error(message);};
      const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
      const patrols=Array.from(w._spawns.values()).filter(e=>e.id.startsWith('trail_'));
      const regions=new Set(patrols.map(e=>e.region)),packs=new Map();
      for(const e of patrols){
        const id=e.id.slice(0,e.id.lastIndexOf('_')),pack=packs.get(id)||[];pack.push(e);packs.set(id,pack);
        ok(!w.quietApproach(e.x,e.y)&&!w.isBlocked(e.x,e.y,18),'optional patrol on protected or blocked ground '+e.id);
      }
      ok(regions.size>=3&&new Set(patrols.map(e=>e.type)).size===2,'patrols distributed across regions and roles');
      for(const [id,pack] of packs){
        ok(pack.length<=2,'oversized pack '+id);
        for(const [otherId,otherPack] of packs)if(otherId!==id)ok(delta(pack[0],otherPack[0])>=789,'overlapping packs');
      }
      const center=patrols[0];Object.assign(p,{x:center.x,y:center.y});Object.assign(other,w.start);
      w.updateActive(g.players,1,g);ok(!w.activeEnemies.some(e=>e.id===center.id),'new pack appeared beside P2');
      ok(w.activeEnemies.length<=w.maxActiveEnemies,'global activation cap exceeded');
      const town=w.getLocation('town_0'),radius=town.safeRadius||500;let course;
      for(let n=0;n<64&&!course;n++){
        const a=n*Math.PI/32,point=r=>({x:town.x+r*Math.cos(a),y:town.y+r*Math.sin(a)});
        let clear=true;for(let r=45;r<=radius+430;r+=12){const q=point(r);if(w.isBlocked(q.x,q.y,20)){clear=false;break;}}
        if(clear)course=point;
      }
      ok(course,'could not place actors on an open Willow street');
      w._spawnChunks.clear();w._active.clear();w.activeEnemies=[];w._streamTimer=0;
      const spawn=(id,type,pos)=>{
        const e=w._createEnemy({id,type,...pos,homeX:pos.x,homeY:pos.y,level:1,region:0,patrol:0});
        g.ensureEnemyScaling(e);e.fireTimer=0;w.addEnemy(e);return e;
      };
      Object.assign(other,course(50));Object.assign(p,course(radius+70));p.invuln=0;p.hp=p.maxHp=1000;
      const rat=spawn('test-street-rifle',0,course(radius+135));rat.state='attack';rat.alert=7;
      const tick=n=>{for(let i=0;i<n;i++){g.time+=.016;w.updateActive(g.players,.016,g);g.updateEnemies(.016);g.updateProjectiles(.016);p.invuln=Math.max(0,p.invuln-.016);}};
      tick(3);ok(rat.pursuitTarget===1,'rat must acquire P2 in field');
      Object.assign(p,course(radius-300));const health=p.hp;
      g.interact(p);ok(g.townUnderPursuit(p)&&!g.ui.isOpen,'active chase must block services');
      tick(420);
      ok(w._active.has(rat.id)&&g.safeZoneAt(rat.x,rat.y)===town&&rat.pursuitTarget===1,'rat followed P2 onto the street');
      ok(p.hp<health,'targeted rat must deal projectile damage on street');
      const protectedHp=other.hp;g.damagePlayer(other,100,rat);ok(other.hp===protectedHp,'bystander remains protected');
      Object.assign(p,course(radius+50));tick(4);ok(rat.pursuitTarget===1,'target lost on outward crossing');
      Object.assign(p,course(radius-180));tick(4);g.killEnemy(rat,p);
      ok(!g.townUnderPursuit(p),'defeated pursuer still blocks services');
      const merchant=w.locations.find(l=>l.type==='npc'&&l.townId===town.id);
      Object.assign(p,{x:merchant.x,y:merchant.y});g.travelInteractUntil=0;g.interact(p);
      ok(g.ui.isOpen,'town contact should serve party after pursuit');g.ui.hideMenu();
      const lost=spawn('test-lost-pursuer',0,course(radius-100));lost.pursuitTarget=1;lost.streetChase=true;lost.pursuitMemory=.1;
      p.smokeTime=1;tick(2);ok(lost.pursuitTarget==null&&!g.townUnderPursuit(p),'lost chase prevents services');p.smokeTime=0;
      // An opaque wall crosses the street between the last sighting and P2.
      // Check movement, projectiles, targeting and service recovery together.
      const wall=course(radius-165),outer=course(radius-65),inside=course(radius-235);
      const nx=(outer.x-wall.x)/100,ny=(outer.y-wall.y)/100;
      const wallDistance=o=>(o.x-wall.x)*nx+(o.y-wall.y)*ny;
      const townCollision=w.isBlocked;
      try{
        w.isBlocked=function(x,y,r=0){
          return Math.abs((x-wall.x)*nx+(y-wall.y)*ny)<26+r&&Math.abs((y-wall.y)*nx-(x-wall.x)*ny)<1200+r||townCollision.call(this,x,y,r);
        };
        Object.assign(p,inside);p.invuln=0;
        const guard=spawn('test-wall-pursuer',0,outer),health=p.hp;
        Object.assign(guard,{pursuitTarget:1,streetChase:true,pursuitMemory:4,lastPursuitX:p.x,lastPursuitY:p.y});
        tick(130);
        ok(guard.pursuitTarget===1&&wallDistance(guard)>26&&health===p.hp,'wall should protect the target while the pursuer searches');
        tick(150);
        ok(guard.pursuitTarget==null&&health===p.hp&&!g.townUnderPursuit(p),'lost sight releases the town after the search expires');
      }finally{w.isBlocked=townCollision;}
      const spec=id=>C.enemies[C.trailEnemyTypes[id]];
      for(const id of ['gallows_bell','seam_ripper']){
        const at=course(radius+100),e=spawn('test-'+id,C.trailEnemyTypes[id],at),s=spec(id);
        Object.assign(p,course(radius+260));e.fireTimer=0;p.invuln=0;g.updateTrailEnemy(e,p,s,.016,true);
        const a=e.trailAction,h=p.hp;ok(a?.phase==='windup',id+' warning missing');
        // Honor the locked floor preview: underneath the bell or sideways out of the cut.
        if(id==='gallows_bell')Object.assign(p,at);
        else {p.x+=-Math.sin(a.angle)*100;p.y+=Math.cos(a.angle)*100;}
        for(let i=0;i<130&&e.trailAction?.phase!=='recovery';i++)g.updateTrailEnemy(e,p,s,.016,true);
        ok(p.hp===h&&e.trailAction?.phase==='recovery',id+' counter or recovery failed');
        const renderer=g.renderer,frame=renderer.actorFrame(e,false);
        ok(frame.trailPortrait===s.image,id+' art missing');
        for(let i=0;i<100&&!renderer.drawIllustratedEnemy(e,frame);i++)await new Promise(r=>setTimeout(r,20));
        ok(renderer.drawIllustratedEnemy(e,frame),id+' painted asset failed to decode');
        e.dead=true;e.hp=0;
      }
      // Drive the real roll action against a deterministic corridor with both walls.
      const blocked=w.isBlocked,safe=w.safeZoneAt,lock=w.isPointLocked;
      w.isBlocked=(x,y,r=0)=>x-r<0||x+r>850;w.safeZoneAt=()=>null;w.isPointLocked=()=>false;
      let budget;
      try{
        const type=C.enemies.findIndex(e=>e.role==='roller'),e=spawn('test-roll',type,{x:610,y:310});
        Object.assign(g.camera,{x:610,y:310,zoom:1});
        Object.assign(p,{x:715,y:310,invuln:0});e.fireTimer=0;
        ok(g.updateAdvancedEnemy(e,p,C.enemies[type],.016),'roller windup');
        const a=e.combatAction;budget=a.length;ok(a.course.length>1&&Math.abs(budget-1450*.87*.70)<.1,'roll path includes shortened ricochet budget');
        const h=p.hp;
        for(let i=0;i<180&&e.combatState!=='recovery';i++)g.updateAdvancedEnemy(e,null,C.enemies[type],.016);
        ok(p.hp<h&&e.combatState==='recovery'&&a.bounces>0,'roller sweeping hit, bounce and recovery');
        const guardType=C.enemies.findIndex(e=>e.role==='rivet_guard'),guard=spawn('test-guard',guardType,{x:300,y:305});
        guard.angle=0;Object.assign(p,{x:355,y:305});const h0=guard.hp;g.damageEnemy(guard,10,p);const blockedDamage=h0-guard.hp;
        ok(g.breakReconGuard(guard,p,.8),'guard counter failed');const h1=guard.hp;g.damageEnemy(guard,10,p);
        ok(h1-guard.hp>blockedDamage,'broken guard should increase frontal damage');
      }finally{w.isBlocked=blocked;w.safeZoneAt=safe;w.isPointLocked=lock;}
      return {packs:packs.size,regions:regions.size,actors:patrols.length,rollerTravel:Math.round(budget)};
    });
    assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
