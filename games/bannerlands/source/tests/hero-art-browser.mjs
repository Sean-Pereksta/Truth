import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output)fs.mkdirSync(output,{recursive:true});
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');if(url.pathname==='/__hero-qa'){response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html><body style="margin:0;background:#172d30;color:#f0e1b2"></body></html>');return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{response.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':({'.js':'text/javascript','.png':'image/png'})[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/__hero-qa`);
  const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/render.js'),{PAINTED_HEROES,HERO_ACTIONS:a,selectHeroFrame,selectStandardFrame}=await import('/painted-heroes.js'),{HERO_PROFILES}=await import('/heroes.js');
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1000;const renderer=new Renderer(canvas),loaded=await renderer.loadPaintedHeroes(),rows=[];
    const hash=canvas=>{let value=2166136261;for(const n of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data){value^=n;value=Math.imul(value,16777619);}return value>>>0;};
    const flags=document.createElement('canvas');flags.id='flags';flags.width=1280;flags.height=1000;document.body.append(flags);const c=flags.getContext('2d');c.fillStyle='#172d30';c.fillRect(0,0,1280,1000);
    const actions=document.createElement('canvas');actions.id='actions';actions.width=1280;actions.height=16*140;document.body.append(actions);const ac=actions.getContext('2d');ac.fillStyle='#172d30';ac.fillRect(0,0,actions.width,actions.height);
    for(const [n,sigil]of Object.keys(PAINTED_HEROES).entries()){
      const row=renderer.getPaintedTroop('hero',sigil),stats=row.frames.map(f=>{let count=0;for(let k=3,data=f.image.getContext('2d').getImageData(0,0,f.width,f.height).data;k<data.length;k+=4)if(data[k]>75)count++;return {count,width:f.width,height:f.height,anchorX:f.anchorX,anchorY:f.anchorY,scale:f.scale};});
      const right=renderer.paintedSprite(row,0,1),left=renderer.paintedSprite(row,0,-1),rightData=right.getContext('2d').getImageData(0,0,right.width,right.height).data,leftData=left.getContext('2d').getImageData(0,0,left.width,left.height).data;let mirrorErrors=0;
      for(let y=0;y<right.height;y++)for(let x=0;x<right.width;x++)for(let k=0;k<4;k++)if(rightData[(y*right.width+x)*4+k]!==leftData[(y*right.width+right.width-1-x)*4+k])mirrorErrors++;
      const portrait=document.createElement('canvas');portrait.width=64;portrait.height=72;renderer.drawHeroPortrait(portrait,sigil);
      const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=row.source;});const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;const rc=raw.getContext('2d');rc.drawImage(image,0,0);const rgba=rc.getImageData(0,0,raw.width,raw.height).data;let edge=0,opaqueEdge=0,empty=0;for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++){const alpha=rgba[(y*raw.width+x)*4+3];if(alpha<=16)empty++;if(x===0||y===0||x===raw.width-1||y===raw.height-1){if(alpha>48)edge++;if(alpha>160)opaqueEdge++;}}
      const rowGutters=row.rowCuts.slice(1,-1).map(y=>{let count=0;for(let x=0;x<raw.width;x++)if(rgba[(y*raw.width+x)*4+3]>96)count++;return count;});
      const colGutters=row.columnCuts.flatMap((cuts,r)=>cuts.slice(1,-1).map(x=>{let count=0;for(let y=row.rowCuts[r];y<row.rowCuts[r+1];y++)if(rgba[(y*raw.width+x)*4+3]>96)count++;return count;}));
      let opaqueGutters=0;for(const y of row.rowCuts.slice(1,-1))for(let x=0;x<raw.width;x++)if(rgba[(y*raw.width+x)*4+3]>160)opaqueGutters++;for(const [r,cuts]of row.columnCuts.entries())for(const x of cuts.slice(1,-1))for(let y=row.rowCuts[r];y<row.rowCuts[r+1];y++)if(rgba[(y*raw.width+x)*4+3]>160)opaqueGutters++;
      rows.push({sigil,frameCount:row.frames.length,emptyFrames:stats.filter(f=>!f.count).length,mirrorErrors,portrait:hash(portrait),flag:hash(renderer.paintedSprite(row,a.standard[0],1)),edge,opaqueEdge,opaqueGutters,rowGutters,colGutters,transparent:empty/(raw.width*raw.height),scale:stats[0].scale,bodyHeights:[16,18,19,20].map(index=>row.frames[index].bodyPixels*row.frames[index].scale),maxSize:[row.width,row.height]});
      const x=(n%4)*320,y=Math.floor(n/4)*250;c.fillStyle='#e8d8aa';c.font='bold 14px Segoe UI';c.fillText(HERO_PROFILES[sigil].name,x+12,y+22);c.font='11px Segoe UI';c.fillText(sigil.toUpperCase()+' · generated house standard',x+12,y+40);c.drawImage(portrait,x+242,y+62,64,72);
      c.save();c.translate(x+58,y+214);c.scale(1.8,1.8);renderer.drawPaintedTroop(c,row,0,1,0,0);renderer.drawPaintedTroop(c,row,a.standard[0],1,65,0);renderer.drawPaintedTroop(c,row,a.standard[0],-1,105,0);c.restore();c.fillStyle='#9fb7aa';c.fillText('carried',x+33,y+237);c.fillText('planted / mirrored',x+144,y+237);
      const indices=[0,3,5,10,14,16,17,21,22,27,29,31,33,38,41,46,50,52,55,58,59,60,61,63];ac.fillStyle='#e8d8aa';ac.font='12px Segoe UI';ac.fillText(sigil,8,n*140+16);for(const [k,index]of indices.entries()){ac.save();ac.translate(64+k*51,n*140+125);ac.scale(1.35,1.35);renderer.drawPaintedTroop(ac,row,index,k%2?-1:1,0,0);ac.restore();ac.fillStyle='#9fb7aa';ac.fillText(String(index),55+k*51,n*140+25);}
    }
    const h={id:10,hp:800,maxHp:800,heroMode:'carrying',phase:0},g={time:20};
    const selected={carry:selectHeroFrame(h,g),plant:selectHeroFrame({...h,standardAction:{kind:'plant',phase:'handling',progress:1.5,duration:3}},g),pickup:selectHeroFrame({...h,heroMode:'signature',standardAction:{kind:'pickup',phase:'handling',progress:1,duration:2}},g),fallen:selectHeroFrame({...h,standardAction:{kind:'pickup',phase:'handling',fallen:true,progress:1,duration:2}},g),fire:selectHeroFrame({...h,heroMode:'signature',attackVisual:{action:'fire',at:20,elapsed:.05}},g),reload:selectHeroFrame({...h,heroMode:'signature',reload:{stage:'seat'}},g),abort:selectHeroFrame({...h,standardVisual:{kind:'plant',phase:'abort',progress:.1,duration:.22,until:20.2}},g),standard:selectStandardFrame({id:1,state:'planted',dormant:true},g)};
    return {loaded,rows,selected};
  });
  if(output){fs.writeFileSync(path.join(output,'hero-art-report.json'),JSON.stringify(report,null,2));await page.locator('#flags').screenshot({path:path.join(output,'generated-house-standards.png')});await page.locator('#actions').screenshot({path:path.join(output,'painted-hero-actions.png')});}
  assert.equal(report.loaded.heroes,16);assert.equal(report.loaded.facings,2);assert.equal(report.loaded.frames,1024);assert.deepEqual(errors,[]);
  for(const row of report.rows){assert.equal(row.frameCount,64,row.sigil);assert.equal(row.emptyFrames,0,row.sigil);assert.equal(row.mirrorErrors,0,row.sigil+' whole sprite mirrors');assert.equal(row.opaqueEdge,0,row.sigil+' complete opaque equipment inside canvas');assert.equal(row.opaqueGutters,0,row.sigil+' no opaque body/weapon crosses extraction gutters');assert.ok(row.transparent>.4,row.sigil+' alpha background');assert.ok(row.bodyHeights.every(h=>h>23&&h<50),row.sigil+' person scale excludes long poles');}
  assert.equal(new Set(report.rows.map(r=>r.flag)).size,16,'Each house uses independently painted standard art');assert.equal(new Set(report.rows.map(r=>r.portrait)).size,16,'Each hero has its own painted portrait');
  assert.deepEqual(report.selected,{carry:0,plant:12,pickup:28,fallen:38,fire:46,reload:43,abort:32,standard:58});
  console.log(JSON.stringify({heroes:report.loaded.heroes,paintedFrames:report.loaded.frames,facings:2,uniqueHouseFlags:16,uniquePortraits:16,opaqueEdgeClips:report.rows.reduce((n,r)=>n+r.opaqueEdge,0),opaqueGutterClips:report.rows.reduce((n,r)=>n+r.opaqueGutters,0),softEdgePixels:report.rows.filter(r=>r.edge).map(r=>[r.sigil,r.edge]),softGutterPixels:report.rows.filter(r=>Math.max(...r.rowGutters,...r.colGutters)>0).map(r=>[r.sigil,Math.max(...r.rowGutters,...r.colGutters)])}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
