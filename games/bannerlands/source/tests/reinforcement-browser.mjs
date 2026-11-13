import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {FRONTIER_BUILDINGS} from '../../regiments.js';
import {HOUSES} from '../../core.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  for(const [house,b]of Object.entries(FRONTIER_BUILDINGS)){
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:60000});
    await page.locator(`[data-house="${HOUSES.findIndex(h=>h.sigil===house)}"]`).click();
    await page.evaluate(()=>{document.getElementById('scaleSelect').value='standard';document.getElementById('enemySelect').value='1';window.__bannerlands.start();window.__bannerlands.game.paused=true;});
    assert.equal(await page.locator(`[data-recruit="${b.unit}"]`).count(),1);assert.equal(await page.locator(`[data-build="${b.type}"]`).count(),1);
    if(house==='sun'){assert.equal(await page.locator('[data-recruit="siege"]').count(),0);assert.equal(await page.locator('[data-build="workshop"]').count(),0);assert.equal(await page.locator('[data-recruit="lance_champion"]').count(),1);}
    await page.evaluate(({type})=>{const g=window.__bannerlands.game;g.teams[0].gold=10000;g.teams[0].cap=1000;g.addBuilding(0,type,g.teams[0].home.x+4,g.teams[0].home.y+4);},{type:b.type});
    await page.keyboard.press('u');await page.waitForFunction(type=>!document.querySelector(`[data-recruit="${type}"]`).disabled,b.unit);await page.locator(`[data-recruit="${b.unit}"]`).click();
    const count=await page.evaluate(type=>window.__bannerlands.game.group(0).filter(u=>u.type===type).length,b.unit);assert.ok(count>=3);
    const art=await page.evaluate(({unit,type,house})=>{const r=window.__bannerlands.renderer;const t=r.getTroopFrame(unit,house),b=r.getStructureFrame(type,house);return {frames:t?.frames.length,building:!!b};},{unit:b.unit,type:b.type,house});assert.deepEqual(art,{frames:8,building:true});
    console.log('PASS '+HOUSES.find(h=>h.sigil===house).name+' real menu, recruitment and painted artwork.');
    if(process.env.LANDS_RENDER_OUT&&house==='stag')await page.screenshot({path:path.join(process.env.LANDS_RENDER_OUT,'Baratheon-muster-preview.png')});
  }
  assert.deepEqual(errors,[]);
  if(process.env.BANNERLANDS_STANDALONE){await page.goto(new URL('file:///'+process.env.BANNERLANDS_STANDALONE.replaceAll('\\','/')).href);await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:60000});assert.deepEqual(errors,[]);console.log('PASS Self-contained offline game loads all artwork.');}
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
