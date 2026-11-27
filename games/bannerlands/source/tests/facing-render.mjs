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
test('Large selections share local markers while retaining separate formations and opposite locked fronts',()=>{
  const troops=Array.from({length:70},(_,i)=>({...unit(),id:i+1,x:Math.floor(i/5)*.75,y:i%5*.6}));
  const selected=new Set(troops.map(u=>u.id));selected.add(2000);
  const distant={...unit(),id:1000,x:70,y:20};selected.add(distant.id);
  troops[1].order={facingX:-1,facingY:0};
  const markers=r.selectionMarkers([...troops,distant],selected,1);
  assert.ok(markers.size>=4&&markers.size<=12,'A handful of cues serves seventy nearby soldiers');
  assert.ok(markers.has(distant.id)&&markers.has(troops[1].id),'Show the detached formation and opposing locked direction');
  assert.equal(markers.has(2000),false,'A selected ID outside current sight cannot add a cue');
  assert.equal(selected.size,72,'Every actual selection is retained');
  assert.equal(r.selectionMarkers(troops,new Set([1]),1),null,'One unit keeps its full selection indicators');
});
test('Wounded health, brace and charge survive the large-group marker budget',()=>{
  const selected=new Set(Array.from({length:70},(_,i)=>i+1));
  const probe=(u,markers)=>{
    const ctx=canvas().getContext('2d'),bars=[],rings=[],labels=[],rect=ctx.fillRect.bind(ctx),stroke=ctx.stroke.bind(ctx),label=ctx.fillText.bind(ctx);
    ctx.fillRect=(x,y,w,h)=>{if(w===12&&h===2&&y===-34)bars.push(w);rect(x,y,w,h);};
    ctx.stroke=()=>{rings.push(ctx.strokeStyle);stroke();};
    ctx.fillText=(s,x,y)=>{labels.push(s);label(s,x,y);};
    r.unit(ctx,u,g,{selected},1,markers);return {bars,rings,labels};
  };
  assert.ok(probe(unit(),null).bars.length>0,'Small-group full health');
  const healthy=probe(unit(),new Set());assert.equal(healthy.bars.length,0);assert.ok(!healthy.rings.includes('#f6d986'));
  assert.ok(probe(unit(),new Set([1])).rings.includes('#f6d986'),'Selected representative retains its existing gold ring');
  const hurt=probe({...unit(),hp:127,charging:true,spearState:'braced',braceDir:{x:1,y:0},braceTime:1},new Set());
  assert.ok(hurt.bars.length>0&&hurt.labels.includes('CHARGE')&&hurt.rings.includes('#b7d6d1'));
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
await r.loadCavalryCharge(path.join(root,'assets/battlefield-slice/cavalry-charge.png'));
const chargeFirst=new Renderer(canvas());
await chargeFirst.loadCavalryCharge(path.join(root,'assets/battlefield-slice/cavalry-charge.png'));
await chargeFirst.loadPaintedTroops({cavalry:path.join(root,PAINTED_TROOPS.cavalry.file)},['cavalry']);
assert.equal(chargeFirst.getPaintedTroop('cavalry').chargeFrameStart,16);
assert.equal(chargeFirst.getPaintedTroop('cavalry').frames.length,40);
test('The cavalry views retain horse scale, ground registration and house-colored cloth',()=>{
  const row=r.getPaintedTroop('cavalry','wolf'),start=row.chargeFrameStart;
  assert.equal(row.frames.length,40);assert.equal(start,16);assert.equal(row.directionFrameStart,24);
  assert.equal(r.getPaintedTroop('storm_rider','stag').chargeFrameStart,undefined);
  const plate=canvas(9*110,3*168),ctx=plate.getContext('2d');
  ctx.fillStyle='#68755a';ctx.fillRect(0,0,plate.width,plate.height);
  const signatures=new Set();
  for(let view=0;view<3;view++)for(let i=0;i<9;i++){
    const index=i?start+view*8+i-1:row.actions.ready,top=view*168;
    const frame=row.frames[index],a=r.paintedSprite(row,index,1),b=r.paintedSprite(row,index,-1);
    assert.equal(a.anchorY,b.anchorY);assert.ok(Math.abs(a.anchorX+b.anchorX-a.width)<1e-6);
    if(i){assert.ok(frame.height*frame.scale>35&&frame.height*frame.scale<60);signatures.add(frame.image.toBuffer('image/png').toString('base64'));}
    for(const [j,color] of ['#6dace8','#cc4c40'].entries())r.drawPaintedTroop(ctx,row,index,1,110*i+45,top+65+j*84,color);
    const blue=ctx.getImageData(110*i,top,110,80).data,red=ctx.getImageData(110*i,top+84,110,80).data;
    let clothPixels=0;
    for(let k=0;k<blue.length;k+=4)if(red[k]-blue[k]>8&&blue[k+2]-red[k+2]>8)clothPixels++;
    assert.ok(clothPixels>12,'House cloth remains visible at normal zoom for frame '+index);
  }
  assert.equal(signatures.size,24);
  if(process.env.LANDS_RENDER_OUT){
    fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});
    fs.writeFileSync(path.join(process.env.LANDS_RENDER_OUT,'cavalry-poses.png'),plate.toBuffer('image/png'));
  }
});
console.log(`${cases} facing raster checks passed.`);
