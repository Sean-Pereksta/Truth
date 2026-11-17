'use strict';
/* Exercise the production field renderer, gun simulation and shared aim joints in Chromium. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const root=path.resolve(__dirname,'..');
    await page.route('http://meowquest.test/**',async route=>{
      const file=path.resolve(root,'.'+decodeURIComponent(new URL(route.request().url()).pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({path:file});
    });
    await page.goto('http://meowquest.test/index.html');
    await page.waitForFunction(()=>window.OW?.game?.ready&&window.OW?.FieldMotionArt);
    const result=await page.evaluate(async()=>{
      const g=OW.game,r=g.renderer,F=OW.FieldMotionArt,fail=m=>{throw Error(m);};
      g.start({slot:0,coop:true});g.paused=true;
      const heroes=g.players.map(p=>({...p,x:85,y:103,equipment:{},skills:{},angle:0,anim:'idle'}));
      const base=heroes[0],tile=document.createElement('canvas');tile.width=184;tile.height=128;
      const c=tile.getContext('2d',{willReadFrequently:true}),orig=r.ctx;
      function withContext(fn){const saved=r.ctx;r.ctx=c;try{return fn();}finally{r.ctx=saved;}}
      function draw(p,body=false){
        return withContext(()=>{c.clearRect(0,0,184,128);if(body)r.drawActor(p,true,p.skin%2);else r.drawPlayerArms(p,77,0);
          const data=c.getImageData(0,0,184,128).data;let hash=2166136261,ink=0;
          for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);for(let i=3;i<data.length;i+=4)if(data[i]>64)ink++;
          return {hash:hash>>>0,ink};});
      }
      const poses=['idle','shoot','recovery','reload'];
      function action(p,phase){
        return {...p,anim:phase==='recovery'?'shoot':phase,animTime:phase==='recovery'?.105:0,reloading:phase==='reload'?.8:0};
      }
      draw(base);draw({...base,anim:'melee',melee:1});draw({...base,anim:'run',velocityX:75,moveTime:0},true);
      const sheets=['fieldGunMotion','fieldMeleeMotion','fieldScoutMotion'];
      await Promise.all(sheets.map(k=>r.images[k]?.decode()||Promise.reject(Error(k+' was not requested'))));
      const stats={guns:0,blades:0,scout:0,orientations:0,actionCells:0,choice:{}};
      for(const [index,w] of OW.Content.weapons.entries()){
        const p={...base,weapon:index},model=F.gunModel(w);
        stats.choice[model.attachment]=(stats.choice[model.attachment]||0)+1;
        const frames=poses.map((pose,i)=>{
          const e=action(p,pose);if(F.gunPhase(e,0)!==i)fail(w.name+' phase '+pose);
          const previous=c.drawImage,calls=[];
          c.drawImage=function(im,...a){if(im===r.images.fieldGunMotion)calls.push(a);return previous.call(this,im,...a);};
          let frame;try{frame=draw(e);}finally{c.drawImage=previous;}
          if(!calls.some(a=>Math.floor(a[0]/256)===i&&Math.floor(a[1]/118)===model.row))fail(w.name+' missing illustrated '+pose);
          stats.actionCells++;return frame;
        });
        if(frames.some(f=>f.ink<30)||new Set(frames.map(f=>f.hash)).size!==4)fail('Weapon did not render four different action poses: '+w.name+' '+JSON.stringify(frames));
        const right=draw(action(p,'shoot')),left=draw(action({...p,angle:Math.PI},'shoot'));if(left.ink<30||left.hash===right.hash)fail('Reflected '+w.name);
        for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){const tip=F.muzzle(r,{...p,angle});if(!tip||![tip.x,tip.y,tip.visualHeight].every(Number.isFinite))fail('Missing measured muzzle '+w.name+' at '+angle);}
        stats.guns++;stats.orientations+=2;
      }
      for(const [index,w] of OW.Content.melee.entries()){
        const p={...base,melee:index,anim:'heavy'},frames=[.04,.3,.58].map(t=>draw({...p,animTime:t,meleeStrike:t<.1?{windup:.12}:null}));
        if(frames.some(f=>f.ink<25)||new Set(frames.map(f=>f.hash)).size!==3)fail('Blade needs three attack phases: '+w.name);
        stats.blades++;
      }
      for(const hero of heroes){
        const cells=[];
        for(let col=0;col<6;col++){
          const p={...hero,anim:col<4?'run':'dodge',moveTime:(col+.2)/11,velocityX:125,dodgeTime:col===4?.22:col===5?.06:0};
          const f=r.actorFrame(p,true);if(f.key!=='fieldScoutMotion'||f.row!==hero.skin%2||f.col!==col)fail('Scout '+hero.skin+'/'+col+' '+JSON.stringify(f));
          cells.push(draw(p,true).hash);stats.scout++;
        }
        if(new Set(cells).size!==6)fail('Duplicate scout poses');
        const suit=OW.Content.equipment.find(item=>item.reconSuit),outfitted={...hero,equipment:{armor:suit},anim:'run',velocityX:125,moveTime:.1};if(r.actorFrame(outfitted,true).key==='fieldScoutMotion')fail('Scout displaced '+suit.name);
        for(const state of ['hurt','death'])if(r.actorFrame({...hero,anim:state},true).key==='fieldScoutMotion')fail('Scout displaced '+state);
      }
      for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
        const p=g.players[0];Object.assign(p,{weapon:0,x:900,y:900,angle,ammo:8,reloading:0,fireTimer:0,overheat:0,velocityX:0,velocityY:0,anim:'idle',animTime:1,meleeCommit:0});
        const m=F.muzzle(r,p);let bullet=null;const previous=g.bulletPool.take;
        g.bulletPool.take=function(data){bullet={...data};return previous.call(this,data);};
        try{g.shoot(p);}finally{g.bulletPool.take=previous;}
        if(!bullet||Math.hypot(bullet.x-m.x,bullet.y-m.y)>.01||bullet.visualHeight!==m.visualHeight||F.gunPhase(p,g.time)!==1)fail('Live muzzle mismatch at angle '+angle);
      }
      const sheet=document.createElement('canvas'),sx=166,sy=110;sheet.width=sx*6;sheet.height=sy*5+36;
      const out=sheet.getContext('2d');out.fillStyle='#1d302c';out.fillRect(0,0,sheet.width,sheet.height);
      out.fillStyle='#eedab4';out.font='bold 20px Georgia';out.fillText('Field movement and weapon poses',15,26);
      function cell(i,j,p,label){draw(p,true);const x=i*sx,y=36+j*sy;out.drawImage(tile,0,0,184,118,x,y,154,99);out.fillStyle='#d4ccaf';out.font='12px sans-serif';out.fillText(label,x+8,y+104);}
      for(let i=0;i<6;i++)for(let j=0;j<2;j++)cell(i,j,{...heroes[j],anim:i<4?'run':'dodge',moveTime:(i+.2)/11,velocityX:150,dodgeTime:i===4?.22:i===5?.06:0},i<4?'Step '+(i+1):i===4?'Tuck':'Land');
      const ids=['rushleaf','lockjaw','skyneedle','wrenwheel','field_pistol','firefly'];
      for(let i=0;i<6;i++)for(let j=0;j<3;j++){const index=OW.Content.weapons.findIndex(w=>w.id===ids[i]);cell(i,j+2,action({...heroes[j%2],weapon:index},['shoot','recovery','reload'][j]),OW.Content.weapons[index].name+' · '+['fire','recover','reload'][j]);}
      r.ctx=orig;return {stats,image:sheet.toDataURL('image/webp',.91)};
    });
    assert.deepEqual(errors,[]);
    if(process.env.MEOWQUEST_CAPTURE_DIR){fs.mkdirSync(process.env.MEOWQUEST_CAPTURE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.MEOWQUEST_CAPTURE_DIR,'field-motion.webp'),Buffer.from(result.image.split(',')[1],'base64'));}
    console.log('PASS · field motion '+JSON.stringify(result.stats));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
