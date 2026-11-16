import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Self-host by default; BANNERLANDS_URL can select an existing local server.
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=process.env.BANNERLANDS_URL?null:http.createServer((request,response)=>{
  const requested=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
try{
  await page.goto(process.env.BANNERLANDS_URL||`http://127.0.0.1:${server.address().port}`,{timeout:90000});
  await page.waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:60000});
  await page.evaluate(()=>{
    document.getElementById('scaleSelect').value='standard';document.getElementById('landscapeSelect').value='open';document.getElementById('enemySelect').value='1';document.getElementById('fogSelect').value='off';
    window.__bannerlands.start();window.__bannerlands.game.paused=true;
    window.__prepare=()=>{
      const {game:g,ui,view}=window.__bannerlands;
      g.paused=true;g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.objectives=[];g.castles=[];g.formationAdvances?.clear();g.time=100;
      for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;t.claim=-1;t.capture=0;}
      for(const s of g.teams){s.count=0;s.alive=true;s.aiClock=1e9;s.cap=1000;s.gold=10000;}
      g.navigation.invalidate();g.hash.rebuild(g.units);
      ui.selected.clear();ui.selectedBuildings.clear();view.x=(32-40)*28;view.y=(32+40)*14;view.zoom=1;
      document.getElementById('battleCanvas').focus();
      return g;
    };
    window.__step=seconds=>{const g=window.__bannerlands.game;for(let i=0;i<Math.ceil(seconds/.025);i++){g.time+=.025;g.navigation.beginUpdate();g.hash.rebuild(g.units);g.updateUnits(.025);g.updateProjectiles(.025);}};
    window.__point=(x,y)=>{const v=window.__bannerlands.view,r=document.getElementById('battleCanvas').getBoundingClientRect();return {x:r.left+((x-y)*28-v.x)*v.zoom+v.w/2,y:r.top+((x+y)*14-v.y)*v.zoom+v.h/2};};
    const g=window.__prepare();
    const ours=Array.from({length:24},(_,i)=>g.addUnit(0,'bridge_warden',30-Math.floor(i/6)*.43,40+(i%6-2.5)*.43));
    const enemies=Array.from({length:18},(_,i)=>g.addUnit(1,'infantry',44-Math.floor(i/6)*.43,40+(i%6-2.5)*.43));
    const bait=g.addUnit(1,'infantry',30,34);
    for(const u of ours){u.facingX=1;u.facingY=0;window.__bannerlands.ui.selected.add(u.id);}
    for(const u of [...enemies,bait]){g.hold([u.id]);u.cooldown=1e9;}
    window.__ours=ours.map(u=>u.id);
  });
  await page.keyboard.press('w');
  const advance=await page.evaluate(()=>{
    const g=window.__bannerlands.game,c=[...g.formationAdvances.values()][0],start=c.x;
    window.__step(4);
    return {modes:window.__ours.map(id=>g.byId.get(id).order.mode),travel:c.x-start,angle:c.angle,errors:window.__ours.map(id=>{const u=g.byId.get(id);return Math.hypot(u.x-u.order.x,u.y-u.order.y);})};
  });
  assert.ok(advance.modes.every(mode=>mode==='advance'));assert.ok(advance.travel>1);assert.ok(Math.abs(advance.angle)<.15);assert.ok(advance.errors.every(error=>error<.8));
  console.log('PASS Real W key advances a coherent spear line without turning toward a lone scout.');
  await page.keyboard.press('a');
  assert.equal(await page.evaluate(()=>{const g=window.__bannerlands.game;return window.__ours.every(id=>{const o=g.byId.get(id).order;return o.mode==='attack'&&o.formation==='spread'&&o.advanceId===undefined&&!Number.isFinite(o.facingX);});}),true);
  await page.keyboard.press('w');
  const point=await page.evaluate(()=>window.__point(25,40));await page.mouse.click(point.x,point.y,{button:'right'});
  assert.equal(await page.evaluate(()=>{const g=window.__bannerlands.game;return window.__ours.every(id=>{const o=g.byId.get(id).order;return o.mode==='move'&&o.advanceId===undefined&&!Number.isFinite(o.facingX);});}),true);
  console.log('PASS Real A releases the ranks, and a plain right-click replaces W with an unlocked retreat.');
  await page.keyboard.press('Shift+w');
  assert.equal(await page.evaluate(()=>window.__bannerlands.ui.buildMode),'workshop');await page.keyboard.press('Escape');
  console.log('PASS Shift+W still opens siege-works placement.');

  for(const type of ['gilded_crossbow','tollhouse_crossbow','sharpshooter']){
    await page.evaluate(type=>{
      const g=window.__prepare(),u=g.addUnit(0,type,30,40),v=g.addUnit(1,'infantry',34.8,40);
      v.hp=v.maxHp=10000;v.cooldown=1e9;g.hold([u.id,v.id]);u.cooldown=0;u.facingX=1;u.facingY=0;g.hash.rebuild(g.units);g.attack(u,v);
      // A crossbow first completes its authored aim, then starts reload work.
      // Keep this reload/control fixture beyond that existing aiming stage.
      window.__step(.45);
      window.__crossbow=u.id;window.__shotsAt=g.stats.battles;window.__bannerlands.ui.selected.add(u.id);
    },type);
    assert.ok(await page.evaluate(()=>window.__bannerlands.game.byId.get(window.__crossbow).reload.progress>.2));
    const destination=await page.evaluate(()=>window.__point(28,40));await page.mouse.click(destination.x,destination.y,{button:'right'});
    const moving=await page.evaluate(()=>{window.__step(.3);const u=window.__bannerlands.game.byId.get(window.__crossbow);return {x:u.x,reloading:u.reloading,progress:u.reload.progress};});
    assert.ok(moving.x<29.8);assert.equal(moving.reloading,false);assert.equal(moving.progress,0);
    await page.keyboard.press('a');
    const stopped=await page.evaluate(()=>{const g=window.__bannerlands.game,u=g.byId.get(window.__crossbow),before=u.x;window.__step(.3);return {travel:Math.abs(u.x-before),progress:u.reload.progress,reloading:u.reloading,shots:g.stats.battles,original:window.__shotsAt,duration:u.reload.duration};});
    assert.ok(stopped.travel<.001);assert.equal(stopped.reloading,true);assert.ok(stopped.progress>.2);assert.equal(stopped.shots,stopped.original);
    assert.equal(await page.evaluate(seconds=>{window.__step(seconds);return window.__bannerlands.game.stats.battles>window.__shotsAt;},stopped.duration+.3),true);
    console.log('PASS '+type+' real move interrupts reload; A stops and reloads before the next shot.');
  }
  await page.locator('[data-drawer="orders"]').click();
  assert.equal(await page.locator('#advanceButton').isVisible(),true);await page.locator('#advanceButton').click();
  assert.equal(await page.evaluate(()=>window.__bannerlands.game.byId.get(window.__crossbow).order.mode),'advance');
  assert.deepEqual(errors,[],'Browser runtime and console errors');
  console.log('PASS Accessible advance button works and the full browser smoke run has no script errors.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
