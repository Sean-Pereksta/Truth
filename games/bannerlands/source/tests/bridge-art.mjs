import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BridgeArtwork,bridgeSideSegments} from '../../bridge-art.js';
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(axis='x',length=7,width=5){
  const g={W:24,H:24,tiles:[],random(){throw new Error('Artwork must not use gameplay randomness.');}};
  for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++)g.tiles.push({x,y,terrain:'water',feature:null,owner:-1});
  for(let across=0;across<width;across++)for(let along=0;along<length;along++){const x=5+(axis==='x'?along:across),y=5+(axis==='x'?across:along);Object.assign(g.tiles[y*g.W+x],{feature:'bridge',featureAxis:axis});}
  return g;
}
test('Only the two exposed sides receive architecture; all five lane interiors remain clear',()=>{
  const g=fixture(),before=JSON.stringify(g.tiles),edges=bridgeSideSegments(g);assert.equal(edges.length,14);
  assert.ok(edges.every(e=>e.y===5||e.y===9));assert.ok(edges.every(e=>e.run.length===7));assert.equal(JSON.stringify(g.tiles),before);
  assert.deepEqual(edges.find(e=>e.side==='north'&&e.offset===0).a,{x:5,y:5});
  assert.deepEqual(edges.find(e=>e.side==='south'&&e.offset===6).b,{x:12,y:10});
});
test('North/south and east/west crossings follow their true world axes',()=>{
  const edges=bridgeSideSegments(fixture('y'));assert.equal(edges.length,14);assert.ok(edges.every(e=>e.x===5||e.x===9));
  assert.ok(edges.every(e=>e.b.x===e.a.x&&e.b.y===e.a.y+1));assert.ok(edges.every(e=>e.side==='west'||e.side==='east'));
});
test('Global run endpoints and arch phase are unchanged when a bridge crosses cache boundaries',()=>{
  const g=fixture('x',18),whole=bridgeSideSegments(g),left=bridgeSideSegments(g,{x0:0,y0:0,x1:15,y1:23}),right=bridgeSideSegments(g,{x0:16,y0:0,x1:23,y1:23});
  assert.equal(left.length+right.length,whole.length);assert.ok([...left,...right].every(e=>e.run.x===5&&e.run.length===18));
  assert.equal(left.filter(e=>e.offset===0).length,2);assert.equal(right.filter(e=>e.offset===17).length,2);
});
test('Unloaded art cleanly requests the existing fallback renderer',()=>{assert.equal(new BridgeArtwork().paint({},fixture()),false);});
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log(`${checks} bridge geometry checks passed; raster checks need LANDS_CANVAS_MODULE.`);process.exit(0);}
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);globalThis.document={createElement:()=>canvas()};
const atlas=canvas(400,400),c=atlas.getContext('2d');
for(let i=0;i<4;i++){const x=i%2*200,y=Math.floor(i/2)*200;c.fillStyle=i===0?'#b8a584':i===1?'#aa997c':'#d0bb95';if(i<2)c.fillRect(x+20,y+40,160,85);else c.fillRect(x+80,y+30,40,120);}
c.clearRect(200+55,80,90,45);
test('The 2×2 atlas preserves transparent arch openings and extracts four distinct sprites',()=>{
  const art=new BridgeArtwork(),info=art.setAtlas(atlas);assert.equal(art.ready,true);assert.deepEqual(info.sprites,['masonry','arch','endPost','cornerPost']);
  const arch=art.frames.arch,pixels=arch.image.getContext('2d').getImageData(0,0,arch.width,arch.height).data;assert.ok([...pixels].filter((value,index)=>index%4===3&&value===0).length>100);
});
test('Painted walls use affine source images with true arch holes and endpoint-aligned posts',()=>{
  const art=new BridgeArtwork();art.setAtlas(atlas);const target=canvas(1400,1000),ctx=target.getContext('2d'),g=fixture(),before=JSON.stringify(g.tiles);
  ctx.translate(500,50);const stats=art.paint(ctx,g);assert.deepEqual(stats,{walls:14,arches:8,posts:4});assert.equal(JSON.stringify(g.tiles),before);
  const y=fixture('y');assert.deepEqual(art.paint(ctx,y),stats);
  assert.equal(art.paint(ctx,fixture('x',2)).arches,0,'Short banks must not become repeated arches.');
});
test('Chunked bridge painting owns each endpoint exactly once, without middle-of-tile posts',()=>{
  const art=new BridgeArtwork();art.setAtlas(atlas);const target=canvas(1600,1000),ctx=target.getContext('2d'),g=fixture('x',18);ctx.translate(500,50);
  const left=art.paint(ctx,g,{x0:0,y0:0,x1:15,y1:23}),right=art.paint(ctx,g,{x0:16,y0:0,x1:23,y1:23});assert.equal(left.posts+right.posts,4);assert.equal(left.walls+right.walls,36);
});
test('Front and back passes partition walls, arch openings and endpoint posts without duplicates',()=>{
  const art=new BridgeArtwork();art.setAtlas(atlas);const ctx=canvas(1400,1000).getContext('2d');ctx.translate(500,50);
  for(const axis of ['x','y']){
    const g=fixture(axis),whole=art.paint(ctx,g),back=art.paint(ctx,g,{}, {layer:'back'}),front=art.paint(ctx,g,{}, {layer:'front'});
    assert.deepEqual(back,{walls:7,arches:4,posts:2});assert.deepEqual(front,back);
    for(const key of ['walls','arches','posts'])assert.equal(back[key]+front[key],whole[key]);
  }
});
test('Left/start piers draw under their rail joins and the nearest terminal post draws last',()=>{
  const art=new BridgeArtwork();art.setAtlas(atlas);const calls=[],ctx={};
  for(const name of ['save','restore','beginPath','moveTo','lineTo','closePath','clip','transform'])ctx[name]=()=>{};
  ctx.drawImage=(image,...args)=>calls.push({image,args});
  for(const axis of ['x','y']){
    calls.length=0;const g=fixture(axis);art.paint(ctx,g,{}, {layer:'front'});
    const wallIndex=calls.findIndex(call=>call.image===art.frames.masonry.image||call.image===art.frames.arch.image);
    assert.ok(wallIndex>0);assert.equal(calls[0].image,art.frames.endPost.image,'The rear/left join must place its pier below the rail.');
    const last=calls.at(-1);assert.equal(last.image,art.frames.endPost.image,'The near terminal pier must be the last bridge graphic.');
    const endpoint=axis==='x'?{x:12,y:10}:{x:5,y:12};assert.equal(last.args[0]+last.args[2]/2,(endpoint.x-endpoint.y)*28);
    assert.equal(last.args[1]+last.args[3]-12,(endpoint.x+endpoint.y)*14);
    calls.length=0;art.paint(ctx,g,{}, {layer:'back'});
    assert.equal(calls[0].image,art.frames.endPost.image);assert.equal(calls[1].image,art.frames.endPost.image);
    assert.ok(calls.slice(2).every(call=>call.image===art.frames.masonry.image||call.image===art.frames.arch.image),'Both rear posts must remain beneath rear rail graphics.');
  }
});
test('Painting the deck between side passes hides rear-face openings beneath the walking surface',()=>{
  const art=new BridgeArtwork();art.setAtlas(atlas);const target=canvas(700,700),ctx=target.getContext('2d'),g=fixture();
  const water='#274e58',deck='#b9af92';ctx.fillStyle=water;ctx.fillRect(0,0,700,700);ctx.translate(250,20);art.paint(ctx,g,{}, {layer:'back'});
  const p=(x,y)=>({x:(x-y)*28,y:(x+y)*14});
  for(const t of g.tiles){if(t.feature!=='bridge')continue;const a=p(t.x,t.y),b=p(t.x+1,t.y),e=p(t.x+1,t.y+1),d=p(t.x,t.y+1);ctx.fillStyle=deck;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(e.x,e.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill();}
  art.paint(ctx,g,{}, {layer:'front'});
  const color=(x,y,depth)=>{const point=p(x,y);return [...ctx.getImageData(Math.round(point.x+250),Math.round(point.y+20+depth),1,1).data];};
  assert.deepEqual(color(7,5,6),[185,175,146,255],'The deck must cover the rear wall below its coping.');
  assert.deepEqual(color(6.1,5,6),[185,175,146,255],'Opaque rear masonry must also disappear below the deck.');
  assert.deepEqual(color(7,10,12),[39,78,88,255],'The forward arch must still reveal water below the deck.');
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),source=path.join(root,'assets/bridges/stone-edges.png');
if(fs.existsSync(source)){
  const art=new BridgeArtwork();art.setAtlas(await raster.loadImage(source));
  test('The real painted atlas preserves the arch opening and discards low-alpha generation fringe',()=>{
    const {image,width,height}=art.frames.arch,pixels=image.getContext('2d').getImageData(0,0,width,height).data;
    let transparent=0,solid=0,low=0;for(let i=3;i<pixels.length;i+=4){if(!pixels[i])transparent++;else if(pixels[i]<40)low++;else solid++;}
    assert.ok(transparent>width*height*.1&&solid>width*height*.3);assert.equal(low,0);
  });
  if(process.env.LANDS_RENDER_OUT){
    fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});
    const closeup=canvas(1400,800),ctx=closeup.getContext('2d');ctx.fillStyle='#274e58';ctx.fillRect(0,0,1400,800);
    ctx.fillStyle='#c6e2d2';ctx.font='bold 27px Georgia';ctx.fillText('Painted bridge masonry · continuous stone faces and real arch openings',30,40);
    ctx.save();ctx.translate(680,-260);ctx.scale(2.6,2.6);const g=fixture('x');art.paint(ctx,g,{}, {layer:'back'});
    for(const tile of g.tiles){if(tile.feature!=='bridge')continue;const x=tile.x,y=tile.y,p=(xx,yy)=>({x:(xx-yy)*28,y:(xx+yy)*14});const a=p(x,y),b=p(x+1,y),d=p(x,y+1),e=p(x+1,y+1);
      ctx.fillStyle=(x+y)%2?'#a9a28c':'#b9af92';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(e.x,e.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill();
    }
    art.paint(ctx,g,{}, {layer:'front'});ctx.restore();fs.writeFileSync(path.join(process.env.LANDS_RENDER_OUT,'Painted-bridge-closeup.png'),closeup.toBuffer('image/png'));
  }
}
console.log(`${checks} painted bridge checks passed.`);
