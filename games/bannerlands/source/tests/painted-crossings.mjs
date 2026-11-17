import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {BridgeArtwork,bridgeCrossings,bridgeSurface} from '../../bridge-art.js';
import {Game} from '../../core.js';
import {isPassableTile} from '../../lands.js';

function river(axis='x',stepped=false){
  const g={W:36,H:36,tiles:[]};
  for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++){
    const u=axis==='x'?x:y,v=axis==='x'?y:x,start=14+(stepped&&v>=17?1:0);
    const water=u>=start&&u<start+6,cross=v>=14&&v<19;
    g.tiles.push({x,y,terrain:water?'water':'grass',feature:cross?(water?'bridge':'road'):null,featureAxis:cross?axis:null});
  }
  return g;
}
for(const axis of ['x','y'])for(const stepped of [true,false]){
  const g=river(axis,stepped),before=g.tiles.map(t=>[t.terrain,t.feature,isPassableTile(t)]),plan=bridgeCrossings(g);
  assert.equal(plan.spans.length,1);const span=plan.spans[0];
  assert.equal(span.hi-span.lo,5);assert.equal(span.axis,axis);
  assert.ok(g.tiles.filter(t=>t.feature==='bridge').every(t=>bridgeSurface(g,t)==='bridge'));
  assert.deepEqual(g.tiles.map(t=>[t.terrain,t.feature,isPassableTile(t)]),before);
  assert.equal(bridgeCrossings(g),plan,'Immutable map geometry reused between views');
}
const confluence=new Game({landscape:'riverlands',scale:'standard',seed:44277,enemies:1});
assert.equal(bridgeSurface(confluence,confluence.tileAt(54.5,47.5)),'ford','Willow Ford has no detached bridge or posts at the shallow junction');
assert.equal(bridgeSurface(confluence,confluence.tileAt(44.5,18.5)),'bridge','Willow Bridge crosses a river between two banks');
const orphan=river();for(const t of orphan.tiles)if(t.terrain==='water')t.terrain='grass';
assert.equal(bridgeSurface(orphan,orphan.tiles[15*36+16]),'road','A dry tagged crossing remains a road');
console.log('PASS constant/stepped channels in both axes, dry causeways, actual Willow Ford junction, passability parity.');

let raster;
try{raster=createRequire(import.meta.url)(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP painted crossing pixels: set LANDS_CANVAS_MODULE.');process.exit(0);}
globalThis.Image=raster.Image;globalThis.document={createElement:()=>raster.createCanvas(1,1)};
const assets=fileURLToPath(new URL('../../assets/battlefield-slice/',import.meta.url)),art=new BridgeArtwork();
await art.loadSpan(path.join(assets,'river-bridge.png'),path.join(assets,'broad-bridge.png'));
for(const axis of ['x','y']){
  const g=river(axis,true),ctx=raster.createCanvas(1100,850).getContext('2d');
  const range={x0:0,y0:0,x1:36,y1:36};ctx.translate(480,-180);art.drawSpans(ctx,g,range);
  const span=art.plan.spans[0],first=art.visibleSpans[0];assert.ok(first);assert.ok(art.spanBytes<=32*1024*1024);
  assert.equal(span.count,0,'Use one intact painting for an ordinary river');
  assert.ok(Math.abs(first.whole.width/first.whole.height-span.art.plate.w/span.art.plate.h)<.005,'Exact painting proportions in either direction');
  const pos=(u,v)=>{const along=span.start+(span.end-span.start)*u,cross=span.lo+(span.hi-span.lo)*v;
    const x=axis==='x'?along:cross,y=axis==='x'?cross:along;return {wx:x,wy:y,x:(x-y)*28,y:(x+y)*14};};
  const pixels=first.whole.getContext('2d').getImageData(0,0,first.whole.width,first.whole.height).data;
  const alpha=(x,y)=>pixels[4*(Math.floor((y-first.top)*first.scale)*first.whole.width+Math.floor((x-first.left)*first.scale))+3]||0;
  for(const u of [.2,.4,.6,.8])for(const v of [.12,.35,.6,.83]){
    const p=pos(u,v),lift=art.deckLift(g,p.wx,p.wy);
    assert.ok(lift>0);assert.ok(alpha(p.x,p.y-lift)>230,'Complete painted deck under every lane');
  }
  const toe=pos(0,.5),middle=pos(.5,.5);assert.ok(art.deckLift(g,toe.wx,toe.wy)<.01);
  assert.ok(art.deckLift(g,middle.wx,middle.wy)>6);assert.equal(art.deckLift(g,2,2),0);
  let open=0,stone=0;
  for(let i=12;i<87;i++){const p=pos(i/100,1),lift=art.deckLift(g,p.wx-.001,p.wy-.001),a=alpha(p.x,p.y-lift+18);
    if(a<20)open++;if(a>220)stone++;}
  assert.ok(open>6&&stone>6,'Opaque supporting piers and transparent water apertures both occur under the front of the bridge');
  for(const u of [.055,.10,.90,.945]){
    const p=pos(u,1),below=12,tx=Math.floor(p.wx+below/28),ty=Math.floor(p.wy+below/28);
    assert.equal(g.tiles[ty*g.W+tx].terrain,'grass');
    assert.equal(alpha(p.x,p.y+below),0,'Dry ground occludes the buried portion of the abutment');
  }
  const rails=[];art.queueParapets(rails);
  assert.ok(rails.length>=8&&rails.every(item=>item.kind===6));assert.ok(new Set(rails.map(item=>item.depth)).size>4);
  const unoccupied=[];art.queueParapets(unoccupied,[],g);assert.equal(unoccupied.length,0);
  const occupied=[];art.queueParapets(occupied,[{x:middle.wx,y:middle.wy}],g);assert.equal(occupied.length,rails.length);
  for(const item of rails)art.drawParapet(ctx,item);
  ctx.scale(.43,.43);art.drawSpans(ctx,g,range);assert.equal(art.visibleSpans[0],first,'Zoom and pan reuse one continuous bridge projection');
  assert.deepEqual(art.clearDecor(g,[{kind:'tree',x:middle.wx,y:middle.wy},{kind:'tree',x:1,y:1}]),[{kind:'tree',x:1,y:1}]);
}
const lake={W:90,H:60,tiles:[]};
for(let y=0;y<lake.H;y++)for(let x=0;x<lake.W;x++){
  const wet=x>=25&&x<67,road=y>=24&&y<29;
  lake.tiles.push({x,y,terrain:wet?'water':'grass',feature:road?(wet?'bridge':'road'):null,featureAxis:road?'x':null});
}
const longSpan=art.registeredPlan(lake).spans[0];assert.ok(longSpan.count>0,'Long lake causeway repeats complete rigid center bays');
art.drawSpans(raster.createCanvas(1,1).getContext('2d'),lake,{x0:0,y0:0,x1:90,y1:60});
const image=art.visibleSpans[0],plate=longSpan.art.plate;
assert.ok(Math.abs(image.whole.width/image.whole.height-(plate.w+longSpan.dx)/(plate.h+longSpan.dy))<.005,'Repeated bays retain the native scale in both axes');
console.log('PASS proportion-preserving spans and causeways, bank occlusion, arch apertures, troop/parapet depth and shared camera cache.');
