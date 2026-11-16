import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Renderer} from '../../render.js';
const require=createRequire(import.meta.url);
let raster;try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP strategic scenery pixel checks: set LANDS_CANVAS_MODULE.');process.exit(0);}
const makeCanvas=(w=1,h=1)=>{const image=raster.createCanvas(w,h);image.style={};return image;};
globalThis.document={createElement:()=>makeCanvas()};
const canvas=makeCanvas(240,160),r=new Renderer(canvas),c=r.ctx;
r.strategicSceneryCacheThresholdMs=0;
let paints=0;
r.paintStrategicScenery=ctx=>{paints++;ctx.fillStyle='rgba(40,140,80,.53)';ctx.fillRect(10.3,15.7,112.1,90.6);ctx.fillStyle='rgba(190,155,90,.67)';ctx.fillRect(65.2,32.6,100.8,95.2);};
const transform=[.63,0,0,.63,13.7,5.2],range={},bounds={};
const frame=()=>{c.setTransform(1,0,0,1,0,0);c.fillStyle='#142a31';c.fillRect(0,0,240,160);c.setTransform(...transform);r.drawStrategicScenery(c,range,bounds);return c.getImageData(0,0,240,160).data;};
const direct=frame();frame();frame();frame();frame();const cached=frame();assert.equal(paints,5,'A settled, repeatedly expensive view paints once into its bounded surface and reuses it.');
let maxDelta=0,changed=0;for(let i=0;i<direct.length;i++){const delta=Math.abs(direct[i]-cached[i]);maxDelta=Math.max(maxDelta,delta);changed+=delta>0?1:0;}
assert.ok(maxDelta<=1,'Compositing retains every painted detail; only one-bit premultiplied-alpha rounding is allowed.');
assert.ok(r.strategicSceneryComposite.bytes<=32*1024*1024);
transform[4]+=.23;frame();transform[4]+=.23;frame();assert.equal(paints,7,'Moving cameras retain direct painting without building a new composite each frame.');
frame();frame();frame();frame();frame();assert.equal(paints,11,'The new camera view caches once it settles and passes three warm cost samples.');
r.decor=[];r.clearBuildingSites({config:{fogOfWar:false},buildings:[],units:[],castles:[],objectives:[]});
assert.equal(r.strategicSceneryComposite,null);assert.equal(r.strategicSceneryView,null);frame();assert.equal(paints,12,'Building-site invalidation immediately draws current scenery.');
r.strategicSceneryCacheThresholdMs=1e9;for(let i=0;i<8;i++)frame();assert.equal(paints,20);assert.equal(r.strategicSceneryComposite,null,'Already-cheap drawing keeps the original path without a composite.');
console.log(`PASS strategic scenery cache preserves pixels (max channel difference ${maxDelta}, ${changed} changed channels), bounded memory, camera motion, site invalidation and the cheap-renderer path.`);
