import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {HOUSES} from '../../core.js';
import {PAINTED_TROOPS} from '../../painted-troops.js';

const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP native reload raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE. Browser equivalent: test:painted-browser.');process.exit(0);}
const base=fileURLToPath(new URL('../..',import.meta.url));
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);globalThis.Image=raster.Image;globalThis.document={createElement:()=>canvas()};
const r=new Renderer(canvas(320,200));
r.setTroopAtlas(await raster.loadImage(path.join(base,'assets/troops-atlas.png')));
await r.loadPaintedTroops(Object.fromEntries(Object.entries(PAINTED_TROOPS).map(([id,d])=>[id,path.join(base,d.file)])));
const entries=[['gilded_crossbow','lion','Belt hook'],['tollhouse_crossbow','bridge','Foot-stirrup lever'],['sharpshooter','fish','Windlass crank'],['vale_sentinel','falcon','Compact lever']];
const digest=c=>createHash('sha256').update(c.getContext('2d').getImageData(0,0,c.width,c.height).data).digest('hex');
function draw(type,sigil,stage,{moving=false,face=1,low=false,progress=1}={}){
  const c=canvas(180,180),ctx=c.getContext('2d'),u={id:1,type,team:0,x:0,y:0,facingX:face,facingY:0,hp:100,maxHp:100,phase:0,order:{mode:'attack'},reloading:!moving,reload:{stage,progress,duration:3},vx:moving?1:0,vy:0};
  const g={time:20,teams:[HOUSES.find(h=>h.sigil===sigil)],houseContent:()=>({unit:type}),unitClass:()=> 'archer'};
  ctx.translate(90,160);ctx.scale(3,3);r.lowDetail=low;r.unit(ctx,u,g,{selected:new Set()},1);return c;
}
const stages=['lower','span','retrieve','seat','raise'],sheet=canvas(1120,850),ctx=sheet.getContext('2d');ctx.fillStyle='#172d30';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='bold 23px Georgia';ctx.fillStyle='#e9d8ad';ctx.fillText('Crossbow reloads · complete authored character poses',25,35);
for(const [row,[type,sigil,label]]of entries.entries()){
  ctx.font='18px Segoe UI';ctx.fillStyle=HOUSES.find(h=>h.sigil===sigil).color;ctx.fillText(label,25,80+row*190);
  const frames=stages.map(stage=>draw(type,sigil,stage));
  assert.equal(new Set(frames.map(digest)).size,stages.length,'Every completed loading stage has its own painted character pose.');
  assert.equal(digest(draw(type,sigil,'seat',{progress:2.4})),digest(draw(type,sigil,'seat',{progress:2.41})),'A discrete painted pose is stable within the same loading stage.');
  assert.equal(digest(draw(type,sigil,'span')),digest(draw(type,sigil,'span')),'Paused progress freezes the authored pose.');
  assert.equal(digest(draw(type,sigil,'lower',{moving:true})),digest(draw(type,sigil,'seat',{moving:true})),'Moving soldiers use movement frames rather than loading frames.');
  assert.notEqual(digest(draw(type,sigil,'span',{low:true})),digest(draw(type,sigil,'seat',{low:true})),'Economy detail keeps genuine painted loading stages.');
  assert.notEqual(digest(draw(type,sigil,'span',{face:-1})),digest(draw(type,sigil,'span')),'The complete character and crossbow mirror together.');
  for(const [i,c]of frames.entries())ctx.drawImage(c,190+i*180,43+row*190);
  console.log('PASS '+label+' authored loading stages, pause, movement, mirroring and economy detail.');
}
if(process.env.LANDS_RENDER_OUT){fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.LANDS_RENDER_OUT,'crossbow-reloads.png'),sheet.toBuffer('image/png'));}
