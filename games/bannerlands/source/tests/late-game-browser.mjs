// Exercise real input and the application's own RAF loop with a large fog army.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=process.env.BANNERLANDS_URL?null:http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(process.env.BANNERLANDS_URL||`http://127.0.0.1:${server.address().port}`,{timeout:90000});
  await page.waitForFunction(()=>!document.getElementById('startButton').disabled,null,{timeout:60000});
  const prepared=await page.evaluate(()=>{
    for(const [id,value]of [['scaleSelect','continent'],['landscapeSelect','riverlands'],['enemySelect','15'],['fogSelect','on']])document.getElementById(id).value=value;
    window.__bannerlands.start();const {game:g,ui,view,renderer}=window.__bannerlands;g.paused=true;
    for(const u of g.units)g.byId.delete(u.id);g.units=[];g.projectiles=[];g.effects=[];g.time=900;
    const types=['infantry','archer','bridge_warden','cavalry','gilded_crossbow','dread_pike','sharpshooter'];
    for(const s of g.teams){
      s.count=0;s.aiClock=.2+s.id*.071;s.powerReadyAt=1e9;
      const slots=[];
      for(let y=s.home.y-15;y<s.home.y+15;y+=.7)for(let x=s.home.x-15;x<s.home.x+15;x+=.7){
        if(!g.navigation.isClearPoint(x,y,.25)||g.buildings.some(b=>(x-b.x)**2+(y-b.y)**2<(g.buildingRadius(b)+.4)**2))continue;
        slots.push({x,y});
      }
      if(slots.length<375)throw new Error('Insufficient legal late-game camp positions.');
      for(let i=0;i<375;i++){const p=slots[Math.floor(i*slots.length/375)],u=g.addUnit(s.id,types[i%types.length],p.x,p.y);g.hold([u.id]);}
    }
    g.recount();g.hash.rebuild(g.units);g.vision.update(true);
    ui.selected=new Set(g.group(0).slice(0,96).map(u=>u.id));ui.selectedBuildings.clear();
    const h=g.teams[0].home;view.x=(h.x-h.y)*28;view.y=(h.x+h.y)*14;view.zoom=.9;
    // A visible opposing company makes actual W and A targets available.
    for(let i=0;i<12;i++){const p=g.navigation.nearestPassable({x:h.x+5+i%4*.45,y:h.y+5+Math.floor(i/4)*.45}),u=g.addUnit(1,'infantry',p.x,p.y);g.hold([u.id]);}
    g.hash.rebuild(g.units);g.vision.update(true);
    window.__lateGameFrames=0;const draw=renderer.draw.bind(renderer);renderer.draw=(...args)=>{window.__lateGameFrames++;return draw(...args);};
    document.getElementById('battleCanvas').focus();g.paused=false;
    return {count:g.units.length,fog:g.config.fogOfWar,time:g.time};
  });
  assert.ok(prepared.count>=6000);assert.equal(prepared.fog,true);
  // A late campaign already has decoded terrain and painted troop textures.
  // Exclude the one-off full-map preparation caused by replacing the fixture.
  await page.waitForFunction(()=>window.__lateGameFrames>=12,null,{timeout:60000});
  const sampleStart=await page.evaluate(()=>{window.__lateGameFrames=0;return window.__bannerlands.game.time;});
  await page.waitForTimeout(1200);
  const timing=await page.evaluate(start=>({frames:window.__lateGameFrames,seconds:window.__bannerlands.game.time-start,paused:window.__bannerlands.game.paused,hidden:document.hidden,winner:window.__bannerlands.game.winner}),sampleStart);
  console.log('Late-game app sample '+JSON.stringify(timing));
  assert.deepEqual(errors,[],'The running app must not stop its frame loop on an exception.');
  assert.ok(timing.frames>=8,'The actual app loop must keep drawing large armies.');assert.ok(timing.seconds>.3,'The actual simulation must keep advancing.');
  await page.keyboard.press('w');
  assert.equal(await page.evaluate(()=>{const {game:g,ui}=window.__bannerlands;return [...ui.selected].every(id=>g.byId.get(id)?.order?.mode==='advance');}),true);
  await page.keyboard.press('a');
  assert.equal(await page.evaluate(()=>{const {game:g,ui}=window.__bannerlands;return [...ui.selected].every(id=>g.byId.get(id)?.order?.mode==='attack'&&!g.hasFacingOrder(g.byId.get(id)));}),true);
  const point=await page.evaluate(()=>{const {game:g,view:v}=window.__bannerlands,h=g.teams[0].home,r=document.getElementById('battleCanvas').getBoundingClientRect(),p=g.navigation.nearestPassable({x:h.x-2,y:h.y+2});return {x:r.left+((p.x-p.y)*28-v.x)*v.zoom+v.w/2,y:r.top+((p.x+p.y)*14-v.y)*v.zoom+v.h/2};});
  await page.mouse.click(point.x,point.y,{button:'right'});
  assert.equal(await page.evaluate(()=>{const {game:g,ui}=window.__bannerlands;return [...ui.selected].every(id=>g.byId.get(id)?.order?.mode==='move'&&!g.hasFacingOrder(g.byId.get(id)));}),true);
  assert.deepEqual(errors,[]);console.log('PASS Real app RAF, fog, W, A and right-click movement with '+prepared.count+' troops; '+JSON.stringify(timing));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
