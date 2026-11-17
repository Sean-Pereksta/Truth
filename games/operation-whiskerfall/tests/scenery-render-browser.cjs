'use strict';
// Optional browser test. Providing a baseline renderer also compares every visible pixel.
// SCENERY_BASELINE is a path to a pre-change js/world/renderer.js from the same game.
// NODE_PATH and CHROME_PATH can point to an installed Playwright and Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.env.SCENERY_BASELINE;
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + route);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function measure(browser, source) {
  const page = await browser.newPage({viewport:{width:1280, height:720}, deviceScaleFactor:1});
  try {
    await page.route('**/js/world/renderer.js', async route => {
      const code = fs.readFileSync(source || path.join(root, 'js/world/renderer.js'), 'utf8');
      // Keep the original terrain entry point before dungeon and encounter decorators load.
      await route.fulfill({contentType:'text/javascript', body:code + '\nwindow.terrainProbe = OW.Renderer.prototype.drawTerrain; window.sceneryFrame = OW.Renderer.prototype.draw;'});
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
    await page.waitForFunction(() => window.OW?.game?.ready);
    const names = await page.evaluate(async () => {
      const g = OW.game;
      g.start({coop:false}); g.frame = () => {};
      const w = g.world, r = g.renderer;
      // Leave all static objects, labels, painted approaches and roaming village
      // cats in their normal render stack. Exclude random combat and player poses.
      g.players=[];g.allies=[];g.drops=[];g.missionRuns={};g.marker=null;g.itemReveals=[];
      w.activeEnemies=[];g.bulletPool.reset();g.effectPool.reset();g.particlePool.reset();
      const coast = w.groundDetails.find(s => s.type === 'coastalShore');
      const bridge = w.bridges[0];
      const approach = w.getLocation('recon_archive');
      const scenes = {
        camp:w.start,
        bridge,
        shoreline:{x:coast.x + coast.w / 2 + 450, y:coast.y},
        archive:{x:approach.x - 540, y:approach.y},
        berlin:w.getLocation('recon_vault_east')
      };
      const paintings=[];
      for(const key of OW.ReconArt.registry.keys()){
        const [group,...parts]=key.split('-'),getter=({surface:'roadSurface',ground:'approachGround',landmark:'landmark',approach:'approach',mechanism:'mechanism'})[group];
        if(getter)paintings.push(()=>OW.ReconArt[getter](parts.join('-')));
      }
      await new Promise((resolve,reject) => {
        const start = performance.now();
        function ready(){
          if(paintings.map(load=>load()).every(Boolean))return resolve();
          if(performance.now() - start > 10000)return reject(Error('Timed out loading scenery artwork'));
          setTimeout(ready,25);
        }ready();
      });
      r.chunks.clear(); g.time=5; r.clock=5;
      window.sceneryScenes = scenes;
      return Object.keys(scenes);
    });
    const results = [];
    for (const name of names) {
      const sample = await page.evaluate(async name => {
        const g = OW.game, w = g.world, r = g.renderer, c = r.ctx, pt = sceneryScenes[name];
        const width = r.width, height = r.height;
        const camera = {x:pt.x, y:pt.y, zoom:1, shake:0};
        g.camera = camera;
        r.clock=5;r.frame=17;sceneryFrame.call(r,1/60);
        const framePixels=c.getImageData(0,0,c.canvas.width,c.canvas.height).data;
        const frameHash=await crypto.subtle.digest('SHA-256',framePixels);
        const left = pt.x - width / 2, top = pt.y - height / 2;
        // Use the production camera transform and padded view for overlays/actors.
        r.view = {x:left-150, y:top-150, w:width+300, h:height+300};
        const paint = () => {
          c.setTransform(1,0,0,1,0,0); c.fillStyle='#182d35'; c.fillRect(0,0,width,height);
          c.translate(-left,-top); terrainProbe.call(r,w);
        };
        for (let i=0;i<4;i++) paint();
        const counts = {}, methods = ['stroke','drawImage','moveTo','lineTo','fillRect'];
        for (const method of methods) {const original=c[method]; counts[method]=0; c[method]=function(...args){counts[method]++;return original.apply(this,args);};}
        paint();
        for (const method of methods) delete c[method];
        const pixels = c.getImageData(0,0,width,height).data;
        const hash = await crypto.subtle.digest('SHA-256', pixels);
        const ms = [];
        // Force queued painting to finish in each batch; divide by its frame count.
        for(let batch=0;batch<13;batch++){
          const start=performance.now();
          for(let i=0;i<6;i++)paint();
          c.getImageData(0,0,1,1);
          if(batch>1)ms.push((performance.now()-start)/6);
        }
        ms.sort((a,b)=>a-b);
        // The command sink removes rasterization and measures only traversal,
        // clipping, path setup and draw dispatch in the running browser.
        const sink={},ignore=()=>{},submit=[];
        for(const method of ['drawImage','setLineDash','save','restore','translate','rotate','strokeRect','fillRect','clip','fill','stroke','beginPath','moveTo','lineTo','roundRect','ellipse'])sink[method]=ignore;
        const terrain=r.terrainNeighborhood;
        const candidates=terrain?[terrain.roads.length,terrain.rivers.length,terrain.details.length,terrain.bridges.length]:[w.roads.length,w.rivers.length,w.groundDetails.length,w.bridges.length];
        try{
          r.ctx=sink;
          for(let batch=0;batch<11;batch++){
            const start=performance.now();
            for(let n=0;n<200;n++)terrainProbe.call(r,w);
            if(batch>1)submit.push((performance.now()-start)/200);
          }
        } finally {r.ctx=c;}
        submit.sort((a,b)=>a-b);
        const hex=buffer=>Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');
        return {name,counts,candidates,hash:hex(hash),frameHash:hex(frameHash),ms:+ms[Math.floor(ms.length/2)].toFixed(3),submitMs:+submit[Math.floor(submit.length/2)].toFixed(4)};
      }, name);
      results.push(sample);
    }
    return results;
  } finally {await page.close();}
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || undefined});
  try {
    const before = baseline ? await measure(browser, baseline) : null;
    const after = await measure(browser);
    for (const [i,scene] of after.entries()) {
      const prior = before?.[i];
      console.log(JSON.stringify({name:scene.name,before:prior,after:scene}));
      if (prior) {
        assert.equal(scene.hash, prior.hash, scene.name+' terrain pixels changed');
        assert.equal(scene.frameHash, prior.frameHash, scene.name+' scenery pixels changed');
      }
    }
    assert.equal(new Set(after.map(s=>s.hash)).size,after.length);
  } finally {await browser.close();server.close();}
})().catch(e => {console.error(e);server.close();process.exitCode=1;});
