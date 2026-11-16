import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {PAINTED_TROOPS} from '../../painted-troops.js';

const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP native facing raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE. Browser equivalent: test:painted-browser.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const canvas=(w=640,h=480)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.document={createElement:()=>canvas(1,1)};globalThis.window={devicePixelRatio:1};globalThis.Image=raster.Image;
const r=new Renderer(canvas());r.setTroopAtlas(await raster.loadImage(path.join(root,'assets/troops-atlas.png')));
await r.loadPaintedTroops(Object.fromEntries(Object.entries(PAINTED_TROOPS).map(([id,d])=>[id,path.join(root,d.file)])));
let cases=0;const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const opaque=c=>{let n=0;for(let i=3,p=pixels(c);i<p.length;i+=4)if(p[i]>40)n++;return n;};
const g={teams:[{color:'#81adce',dark:'#284953',sigil:'wolf'}],time:30,unitClass:()=> 'infantry',houseContent:()=>({unit:null}),allied:()=>true,isWalkable:()=>true};
const unit=()=>({id:1,team:0,type:'winter_pikeman',x:0,y:0,vx:-1,vy:0,facingX:1,facingY:0,order:{mode:'move',facingX:1,facingY:0},phase:Math.PI*.6,backpedaling:true,hp:132,maxHp:132});

test('Frey spearmen and Bolton pikes use distinct complete painted action sheets',()=>{
  const spear=r.getTroopFrame('bridge_warden','bridge'),pike=r.getTroopFrame('dread_pike','flayed');assert.equal(spear.painted,true);assert.equal(pike.painted,true);assert.equal(spear.frames.length,16);assert.equal(pike.frames.length,16);
  assert.equal(spear.house,'bridge');assert.equal(pike.house,'flayed');
  for(let i=0;i<16;i++){assert.ok(opaque(spear.frames[i].image)>150);assert.ok(opaque(pike.frames[i].image)>150);assert.notDeepEqual(pixels(spear.frames[i].image),pixels(pike.frames[i].image));}
});
test('Backward pike movement keeps logical front and selects its authored defensive step',()=>{
  const c=canvas(),ctx=c.getContext('2d'),u=unit(),calls=[],original=r.drawPaintedTroop;ctx.translate(320,240);r.drawPaintedTroop=(...args)=>calls.push(args);
  try{
    r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],1);assert.equal(calls.at(-1)[2],PAINTED_TROOPS.winter_pikeman.actions.backward);
    u.facingX=-1;u.backpedaling=false;r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],-1);assert.ok(PAINTED_TROOPS.winter_pikeman.actions.walk.includes(calls.at(-1)[2]));
    u.attackVisual={at:30};u.facingX=1;r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],1);assert.equal(calls.at(-1)[2],PAINTED_TROOPS.winter_pikeman.actions.thrust);
  }finally{r.drawPaintedTroop=original;}
});
test('Selected facing markers follow the front while velocity points backward',()=>{
  const draw=face=>{const c=canvas(),ctx=c.getContext('2d'),u=unit(),original=r.drawPaintedTroop;ctx.translate(320,240);u.facingX=face;r.drawPaintedTroop=()=>{};try{r.unit(ctx,u,g,{selected:new Set([1])},1);}finally{r.drawPaintedTroop=original;}return c;};
  assert.notDeepEqual(pixels(draw(1)),pixels(draw(-1)));
});
test('Bracing selects its full painted pose without drawing a replacement spear',()=>{
  const c=canvas(),ctx=c.getContext('2d'),u=unit(),calls=[],original=r.drawPaintedTroop;ctx.translate(320,240);Object.assign(u,{vx:0,backpedaling:false,spearState:'braced',braceDir:{x:1,y:0},braceTime:1});u.order.mode='attack';r.drawPaintedTroop=(...args)=>calls.push(args);
  try{r.unit(ctx,u,g,{selected:new Set()},1);}finally{r.drawPaintedTroop=original;}
  assert.equal(calls[0][2],PAINTED_TROOPS.winter_pikeman.actions.brace);
  const aboveGround=ctx.getImageData(0,0,c.width,234).data;assert.ok(!aboveGround.some((v,i)=>i%4===3&&v>0),'Only the ground-facing marker remains when the authored character is omitted.');
});
test('Long pike frames retain full bounds, common body scale and mirrored foot anchors',()=>{
  for(const id of ['winter_pikeman','thornwall_pikeman','dread_pike']){
    const d=PAINTED_TROOPS[id],row=r.getPaintedTroop(d.type,d.house);assert.equal(row.bodyHeight,35);assert.ok(row.width>65,'Pike bounds expand beyond the old compact sprite box.');
    const scale=row.frames[0].scale;assert.ok(row.frames.every(frame=>frame.scale===scale));
    for(let i=0;i<row.frames.length;i++){const a=r.paintedSprite(row,i,1),b=r.paintedSprite(row,i,-1);assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.ok(Math.abs(a.anchorX+b.anchorX-a.width)<1e-6);assert.equal(a.anchorY,b.anchorY);}
  }
});
test('Facing preview rotates and bounds passability queries for large armies',()=>{
  const draw=(faceX,faceY,count=1000)=>{const c=canvas(),ctx=c.getContext('2d');let checks=0;ctx.translate(320,240);r.facingPreview(ctx,{isWalkable:()=>{checks++;return true;}},{x:0,y:0,faceX,faceY,count,formation:'line'},1);return {c,checks};};
  const a=draw(1,0),b=draw(0,1);assert.equal(a.checks,36);assert.equal(b.checks,36);assert.notDeepEqual(pixels(a.c),pixels(b.c));assert.ok(opaque(a.c)>100);assert.equal(draw(1,0,1).checks,1);
});
test('Blocked destination slots remain visible and zero facing draws nothing',()=>{
  const c=canvas(),ctx=c.getContext('2d');ctx.translate(320,240);r.facingPreview(ctx,{isWalkable:()=>false},{x:0,y:0,faceX:1,faceY:0,count:12,formation:'spread'},1);assert.ok(opaque(c)>30);
  const invalid=canvas();r.facingPreview(invalid.getContext('2d'),g,{x:0,y:0,faceX:0,faceY:0,count:12},1);assert.equal(opaque(invalid),0);
});
console.log(`${cases} facing raster checks passed.`);
