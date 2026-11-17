import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../../',import.meta.url)));
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':name.endsWith('.png')?'max-age=3600':'no-cache'});res.end(bytes);}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.BANNERLANDS_BROWSER});
try{
  const page=await browser.newPage(),rows=[];
  await page.addInitScript(()=>{performance.setResourceTimingBufferSize(2000);});
  for(const cache of ['cold','warm']){
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__bannerlands?.renderer.paintedArtReady&&!document.getElementById('startButton').disabled,null,{timeout:120000});
    rows.push(await page.evaluate(async cache=>{
      const readyMark=performance.getEntriesByName('bannerlands-battle-art-ready').at(-1);
      const readyMs=readyMark?.startTime??performance.now();
      const loader=await import('./asset-loader.js');
      const assets=performance.getEntriesByType('resource').filter(r=>r.initiatorType==='img'&&r.responseEnd<=readyMs);
      return {cache,readyMs,readyClock:readyMark?'critical-art mark':'first observed enabled button',images:assets.length,
        imageTransferBytes:assets.reduce((n,r)=>n+r.transferSize,0),imageResponseMs:assets.reduce((n,r)=>n+Math.max(0,r.responseEnd-r.responseStart),0),
        loader:loader.artworkTimings?.()||null,userAgent:navigator.userAgent};
    },cache));
    await page.waitForFunction(()=>window.__bannerlands.renderer.landsArtReady&&window.__bannerlands.renderer.landsGroundFrames,null,{timeout:120000});
    await page.evaluate(()=>navigator.serviceWorker.ready);
  }
  assert.ok(rows.every(r=>r.readyMs>0&&r.images>0));
  const result={method:'Two navigations in the same Chrome context, loopback HTTP. Ready time is navigation-relative. Image response and explicit decode durations sum concurrent operations. The baseline had no explicit decode timer.',rows};
  if(process.argv[3])await fs.writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
