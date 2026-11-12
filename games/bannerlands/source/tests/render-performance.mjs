import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import {Game} from '../../core.js';
import {Renderer} from '../../render.js';
if(process.env.LANDS_RENDER_BASELINE&&!process.env.LANDS_RENDER_CHILD){
 const combined=[];for(const version of ['baseline','current']){const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,LANDS_RENDER_CHILD:version},encoding:'utf8',maxBuffer:1024*1024});if(child.status!==0){process.stderr.write(child.stderr||child.stdout);process.exit(child.status||1);}combined.push(...JSON.parse(child.stdout));}console.log(JSON.stringify(combined,null,2));process.exit(0);
}
const require=createRequire(import.meta.url);
let raster;try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP renderer performance checks: set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const canvas=(w=1,h=1)=>{const c=raster.createCanvas(w,h);c.style={};c.getBoundingClientRect=()=>({width:c.width,height:c.height,left:0,top:0});return c;};
globalThis.Image=raster.Image;globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>canvas(),getElementById:()=>null};
const images=await Promise.all(['ground-textures','terrain-props','troops-atlas','structures-atlas','campaign-structures'].map(name=>raster.loadImage(path.join(root,'assets',name+'.png'))));
const setup=async Class=>{const r=new Class(canvas(1400,900));r.setTerrainAtlases(images[0],images[1]);r.setTroopAtlas(images[2]);await r.loadStructures(path.join(root,'assets/structures-atlas.png'));await r.loadCampaignArt(path.join(root,'assets/campaign-structures.png'));await r.loadLandsArt(path.join(root,'assets/lands-atlas.png'));await r.loadLandsGround(path.join(root,'assets/lands-ground.png'));return r;};
const ui={selected:new Set(),selectedBuildings:new Set(),quality:'high',showGrid:false};
const g=new Game({landscape:'riverlands',scale:'continent',enemies:15,seed:628410});
const scenes=[{name:'overview',zoom:.14,x:g.W*.5,y:g.H*.5},{name:'woodland',zoom:.55,x:g.W*.5,y:g.H*.5},{name:'woodland-pan',zoom:.6,x:g.W*.5,y:g.H*.5,pan:true},{name:'capital',zoom:1.1,...g.teams[0].home}];
const results=[];
let classes=[['current',Renderer]];
if(process.env.LANDS_RENDER_CHILD==='baseline'){const m=await import(pathToFileURL(path.resolve(process.env.LANDS_RENDER_BASELINE)));classes=[['baseline',m.Renderer]];}
for(const [name,Class]of classes){
 const r=await setup(Class);
 for(const scene of scenes){
  const v={x:(scene.x-scene.y)*28,y:(scene.x+scene.y)*14,zoom:scene.zoom,w:1400,h:900,dpr:1};
  r.draw(g,v,ui);r.draw(g,v,ui);
  const cameraX=v.x,cameraY=v.y;
  if(scene.pan)for(const offset of [-140,0,140]){v.x=cameraX+offset;v.y=cameraY+offset*.2;r.draw(g,v,ui);}
  if(name==='current'){
   assert.ok(r.bridgeArchitectureBytes<=32*1024*1024,'Bridge masonry buffers stay within their memory budget.');
   assert.ok(r.sceneryChunkBytes<=64*1024*1024,'Static scenery buffers stay within their memory budget.');
   if(scene.name==='woodland'){const tree=r.treeSprite;r.treeSprite=()=>{throw new Error('A stationary strategic view rebuilt cached tree artwork.');};try{r.draw(g,v,ui);}finally{r.treeSprite=tree;}}
  }
  const metrics={};for(const method of ['drawGround','drawBridgeArchitecture','updateTerritory','unit']){const fn=r[method];r[method]=function(...args){const at=performance.now();const out=fn.apply(this,args);metrics[method]=(metrics[method]||0)+performance.now()-at;return out;};}
  const times=[];
  for(let i=0;i<12;i++){g.time=30+i/30;if(scene.pan){const offset=Math.sin(i/11*Math.PI*2)*140;v.x=cameraX+offset;v.y=cameraY+offset*.2;}const at=performance.now();r.draw(g,v,ui);times.push(performance.now()-at);}
  times.sort((a,b)=>a-b);results.push({version:name,scene:scene.name,medianMs:+times[Math.floor(times.length/2)].toFixed(2),p95Ms:+times[Math.floor(times.length*.95)].toFixed(2),stages:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,+(v/12).toFixed(2)]))});
 }
}
console.log(JSON.stringify(results,null,2));
assert.ok(results.every(r=>Number.isFinite(r.medianMs)));
process.exit(0);
