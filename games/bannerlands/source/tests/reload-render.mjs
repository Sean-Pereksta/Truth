import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {HOUSES} from '../../core.js';
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP reload raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const base=fileURLToPath(new URL('../..',import.meta.url)),src=name=>path.join(base,'assets',name);
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);globalThis.Image=raster.Image;globalThis.document={createElement:()=>canvas()};
const r=new Renderer(canvas(320,200));
await r.loadHouseArt({troops:Object.fromEntries(HOUSES.map(h=>[h.sigil,src('houses/'+h.sigil+'-troops.png')])),castles:src('house-castles.png'),production:src('house-production.png')});
await r.loadConquestArt(Object.fromEntries(['castles','trebuchet','giant','sharpshooter','buildings'].map(k=>[k,src('conquest/'+k+'.png')])));
await r.loadReinforcementArt(Object.fromEntries(['stormbreaker','saltwind_axethrower','tollhouse_crossbow','crannog_spearhand','hornhill_halberdier','sun_horse_archer','buildings'].map(k=>[k,src('reinforcements/'+k+'.png')])));
const entries=[['gilded_crossbow','lion','Belt hook'],['tollhouse_crossbow','bridge','Foot-stirrup lever'],['sharpshooter','fish','Windlass crank']];
const digest=c=>createHash('sha256').update(c.getContext('2d').getImageData(0,0,c.width,c.height).data).digest('hex');
function draw(type,sigil,progress,{moving=false,face=1,low=false}={}){
  const c=canvas(140,160),ctx=c.getContext('2d'),u={id:1,type,team:0,x:0,y:0,facingX:face,facingY:0,hp:100,maxHp:100,phase:0,order:{mode:'attack'},reloading:!moving,reload:{progress,duration:3},vx:moving?1:0,vy:0};
  const g={time:20,teams:[HOUSES.find(h=>h.sigil===sigil)],houseContent:()=>({unit:type}),unitClass:()=> 'archer'};
  ctx.translate(70,140);ctx.scale(3,3);r.lowDetail=low;r.unit(ctx,u,g,{selected:new Set()},1);return c;
}
const sheet=canvas(1120,660),ctx=sheet.getContext('2d');ctx.fillStyle='#172d30';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='bold 23px Georgia';ctx.fillStyle='#e9d8ad';ctx.fillText('Crossbow reloads · stationary work drives every mechanism',25,35);
for(const [row,[type,sigil,label]]of entries.entries()){
  ctx.font='18px Segoe UI';ctx.fillStyle=HOUSES.find(h=>h.sigil===sigil).color;ctx.fillText(label,25,80+row*190);
  const frames=[.06,.6,1.05,1.6,2.25,2.85].map(t=>draw(type,sigil,t));
  assert.equal(new Set(frames.map(digest)).size,frames.length,'Every reload stage must change the rendered soldier and weapon.');
  assert.notEqual(digest(draw(type,sigil,1.05)),digest(draw(type,sigil,1.08)),'Mechanism motion must be continuous within a painted pose.');
  assert.equal(digest(draw(type,sigil,1.05)),digest(draw(type,sigil,1.05)),'Paused simulation progress freezes the rendered mechanism.');
  assert.equal(digest(draw(type,sigil,.6,{moving:true})),digest(draw(type,sigil,2.25,{moving:true})),'Moving soldiers must drop the stationary reload pose.');
  assert.notEqual(digest(draw(type,sigil,1.05,{low:true})),digest(draw(type,sigil,1.08,{low:true})),'Economy detail must retain animated reloads at readable zoom.');
  assert.notEqual(digest(draw(type,sigil,1.05,{face:-1})),digest(draw(type,sigil,1.05)),'Weapon and working arms mirror with the soldier.');
  for(const [i,c]of frames.entries())ctx.drawImage(c,190+i*150,43+row*190);
  console.log('PASS '+label+' actual renderer animation, pause, interruption, mirroring and economy detail.');
}
if(process.env.LANDS_RENDER_OUT){fs.mkdirSync(process.env.LANDS_RENDER_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.LANDS_RENDER_OUT,'crossbow-reloads.png'),sheet.toBuffer('image/png'));}
