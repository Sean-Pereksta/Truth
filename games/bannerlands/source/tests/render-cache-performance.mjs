import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';

const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP render cache checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);
globalThis.document={createElement:()=>canvas()};
const r=new Renderer(canvas(1400,900));
r.setTroopAtlas(await raster.loadImage(path.join(root,'assets/troops-atlas.png')));
const data=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};

test('Packed army textures preserve every tinted frame, facing and portrait without per-troop canvases',()=>{
  for(let color=0;color<20;color++)for(const dir of [-1,1])for(let frame=0;frame<8;frame++){
    const tint='#'+(0x657b90+color*1501).toString(16),packed=r.soldierSprite('infantry',tint,'#223344',dir,frame%4,frame>=4,null,true);
    assert.equal(packed.canvas,null,'The battlefield does not allocate a permanent canvas for each cached frame.');
    const actual=canvas(128,144);actual.getContext('2d').drawImage(packed.image,packed.x,packed.y,128,144,0,0,128,144);
    const portrait=r.soldierSprite('infantry',tint,'#223344',dir,frame%4,frame>=4);
    assert.deepEqual(data(actual),data(portrait));assert.equal(r.soldierSprite('infantry',tint,'#223344',dir,frame%4,frame>=4),portrait);
  }
  assert.equal(r.troopAtlasPages.length,Math.ceil(r.sprites.size/224));
  r.resetTroopSprites();assert.equal(r.sprites.size,0);assert.equal(r.troopAtlasPages.length,0);
});

const g={W:224,H:176,time:0,tiles:[],teams:[]};
for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++)g.tiles.push({x,y,terrain:'grass',feature:null});
r.lowDetail=true;r.ownerPixels=canvas(g.W,g.H);r.territoryEdges=[];r.drawBridgeArchitecture=()=>{};
const tile=canvas(58,33);tile.getContext('2d').fillStyle='#718e5c';tile.getContext('2d').fillRect(0,0,58,33);
let paints=0;r.landsTileSprite=()=>{paints++;return tile;};
const c=canvas(1400,900).getContext('2d');
function ground(w=1800,h=1000,zoom=.75,pan=0){
  const v={x:(112-88)*28+pan,y:(112+88)*14,w,h,zoom},bounds={left:v.x-w/zoom/2-90,right:v.x+w/zoom/2+90,top:v.y-h/zoom/2-110,bottom:v.y+h/zoom/2+80};
  r.drawGround(c,g,v,bounds,r.visibleWorldRange(g,bounds));
}

test('A normal wide viewport keeps its complete terrain working set across repeated draws and panning',()=>{
  ground();assert.ok(r.terrainChunkCache.size>24,'The fixture must expose the old24-chunk thrashing limit.');
  for(const pan of [-100,0,100,0])ground(1800,1000,.75,pan);
  const afterWarmup=paints;
  for(let i=0;i<8;i++)for(const pan of [-100,0,100,0])ground(1800,1000,.75,pan);
  assert.equal(paints,afterWarmup,'Repeated nearby camera movement must reuse the same terrain raster images.');
  assert.ok(r.terrainChunkBytes<=96*1024*1024);assert.ok(r.terrainChunkCache.size<=64);
});

test('An oversized viewport respects its byte budget without evicting the entire current working set',()=>{
  ground(3200,2000,.75);const saved=new Set(r.terrainChunkCache.keys()),before=paints;
  ground(3200,2000,.75);
  assert.ok(r.terrainChunkBytes<=96*1024*1024);assert.ok(r.terrainChunkCache.size<=64);
  assert.ok([...saved].every(key=>r.terrainChunkCache.has(key)),'Visible cached chunks remain pinned when excess terrain is drawn transiently.');
  assert.ok(paints>before,'The fixture exercises uncached excess terrain instead of silently skipping it.');
});

console.log(`${checks} rendering cache performance checks passed.`);
