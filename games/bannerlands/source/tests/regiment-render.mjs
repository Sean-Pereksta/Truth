import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {BUILD_DEFS,HOUSES} from '../../core.js';

const require=createRequire(import.meta.url);
let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP regiment raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const regiments={wolf:'shield_bearer',lion:'shield_bearer',dragon:'shield_bearer',rose:'shield_bearer',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion'};
const sources=Object.fromEntries(Object.entries(regiments).map(([sigil,type])=>[sigil,path.join(root,'assets/regiments',sigil+'-'+type.replaceAll('_','-')+'.png')]));
if(Object.values(sources).some(file=>!fs.existsSync(file))){console.log('SKIP regiment raster checks: seven house regiment sheets are not present yet.');process.exit(0);}
const canvas=(w=256,h=256)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.document={createElement:()=>canvas(1,1)};globalThis.Image=raster.Image;
const r=new Renderer(canvas());
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const digest=c=>createHash('sha256').update(pixels(c)).digest('hex');
const visible=c=>{let n=0;for(let i=3,p=pixels(c);i<p.length;i+=4)if(p[i]>40)n++;return n;};
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};

test('New regiments never silently use a house specialist or ordinary soldier image',()=>{
  r.houseArtReady=true;r.houseTroopFrames.wolf={frames:['wrong house image']};r.rasterSpritesReady=true;r.troopFrames.infantry={frames:['wrong infantry image']};
  for(const [sigil,type]of Object.entries(regiments)){assert.equal(r.getTroopFrame(type,sigil),null);assert.equal(r.soldierSprite(type,'#ffffff','#000000',1,0,false,sigil),null);}
  r.houseArtReady=false;r.rasterSpritesReady=false;
});

const info=await r.loadRegimentArt(sources);
test('Seven house sheets each expose four real walk and four real attack frames',()=>{
  assert.equal(r.regimentArtReady,true);assert.deepEqual(Object.keys(info),Object.keys(sources));const firstFrames=[];
  for(const [sigil,type]of Object.entries(regiments)){
    const row=r.getTroopFrame(type,sigil);assert.equal(row.regiment,type);assert.equal(row.house,sigil);assert.equal(row.frames.length,8);assert.ok(row.width>15&&row.height>20);
    assert.deepEqual(info[sigil].walkFrames,[0,1,2,3]);assert.deepEqual(info[sigil].attackFrames,[4,5,6,7]);assert.equal(info[sigil].type,type);
    for(const f of row.frames){assert.ok(f.width>20&&f.height>30);assert.ok(visible(f.image)>500);}
    assert.equal(new Set(row.frames.map(f=>digest(f.image))).size,8,'Animation cells must contain distinct artwork.');firstFrames.push(digest(row.frames[0].image));
  }
  assert.equal(new Set(firstFrames).size,7,'Every house has a separate source drawing.');
});

test('Sheet transparency preserves the battlefield around every extracted fighter',()=>{
  for(const [sigil,type]of Object.entries(regiments))for(const f of r.getTroopFrame(type,sigil).frames){
    const c=f.image,ctx=c.getContext('2d'),corners=[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]];
    assert.ok(corners.every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]<40),'Each cell retains a transparent border.');
    assert.ok(visible(c)<c.width*c.height*.9,'The sheet cannot be an opaque background rectangle.');
  }
});

test('Each regiment selects only its exact house drawing and preserves existing specialists',()=>{
  const houseRow={frames:['existing specialist']};r.houseArtReady=true;r.houseTroopFrames.wolf=houseRow;
  for(const [sigil,type]of Object.entries(regiments)){
    assert.equal(r.getTroopFrame(type,sigil),r.regimentTroopFrames[type][sigil]);
    assert.equal(r.getTroopFrame(type==='shield_bearer'?'lance_champion':'shield_bearer',sigil),null);
    assert.equal(r.getTroopFrame(type,'bridge'),null);assert.equal(r.getTroopFrame(type),null);
  }
  assert.equal(r.getTroopFrame('winter_guard','wolf'),houseRow);r.houseArtReady=false;
});

test('House armor and colors stay baked into their own artwork without tint replacement',()=>{
  for(const [sigil,type]of Object.entries(regiments)){
    const original=r.soldierSprite(type,'#ff0000','#000000',1,0,false,sigil),otherColor=r.soldierSprite(type,'#00ff00','#000000',1,0,false,sigil);
    assert.equal(original,otherColor,'House art shares its stable sprite cache and ignores generic recoloring.');assert.ok(visible(original)>150);
  }
});

test('Walk, attack, mirrored directions, portraits and battlefield units use the house sheets',()=>{
  for(const [sigil,type]of Object.entries(regiments)){
    for(const attack of [false,true])for(const direction of [-1,1])for(let frame=0;frame<4;frame++)assert.ok(visible(r.soldierSprite(type,'#a5b7ef','#3e4a72',direction,frame,attack,sigil))>150);
    assert.notEqual(digest(r.soldierSprite(type,'#a5b7ef','#3e4a72',1,0,false,sigil)),digest(r.soldierSprite(type,'#a5b7ef','#3e4a72',-1,0,false,sigil)));
    const portrait=canvas(96,96);r.drawTroopPortrait(portrait,type,{sigil,color:'#8ac9e8',dark:'#234c61'});assert.ok(visible(portrait)>600);
    const field=canvas(160,160),ctx=field.getContext('2d');ctx.translate(80,110);
    const game={teams:[{sigil,color:'#ffffff',dark:'#000000'}],time:30,unitClass:()=>type==='shield_bearer'?'infantry':'cavalry',houseContent:()=>({unit:'existing_specialist'}),allied:()=>true};
    r.unit(ctx,{id:1,team:0,type,x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,hp:100,maxHp:100,phase:0},game,{selected:new Set()},1);assert.ok(visible(field)>100,'The battlefield passes its house sigil to regiment artwork.');
  }
});

test('Incomplete regiment artwork fails clearly and cannot activate a silent fallback',()=>{
  assert.throws(()=>r.setRegimentArt({}),/Missing wolf regiment artwork/);assert.equal(r.regimentArtReady,false);assert.equal(r.getTroopFrame('shield_bearer','wolf'),null);
});
await r.loadRegimentArt(sources);

const productionSource=path.join(root,'assets/regiments/production-buildings.png'),productionDefinitions=Object.entries(BUILD_DEFS).filter(([,d])=>d.regimentBuilding);
test('Dedicated regiment buildings cannot fall back to the original house production picture',()=>{
  assert.equal(productionDefinitions.length,7);r.houseArtReady=true;r.houseProductionFrames.wolf={image:'wrong original building'};
  for(const [type,d]of productionDefinitions)assert.equal(r.getStructureFrame(type,d.house),null);r.houseArtReady=false;
});
await r.loadRegimentBuildings(productionSource);
test('Seven dedicated production buildings use unique illustrated atlas cells',()=>{
  assert.equal(r.regimentBuildingsReady,true);assert.equal(r.regimentBuildingArtInfo.frames,7);assert.deepEqual(r.regimentBuildingArtInfo.houses,Object.keys(regiments));const artwork=[];
  for(const [type,d]of productionDefinitions){
    const f=r.getStructureFrame(type,d.house);assert.ok(f.regimentBuilding);assert.equal(f.house,d.house);assert.ok(f.drawWidth>40&&f.drawHeight>40);assert.ok(visible(f.image)>1500);artwork.push(digest(f.image));
    assert.equal(r.getStructureFrame(type,d.house==='wolf'?'lion':'wolf'),null);assert.equal(r.getStructureFrame(type),null);
  }
  assert.equal(new Set(artwork).size,7,'Each house production building has a separate source drawing.');
});
test('Production portraits and world buildings keep their painted house architecture and colors',()=>{
  for(const [type,d]of productionDefinitions){
    const house=HOUSES.find(h=>h.sigil===d.house),portrait=canvas(96,96);r.drawStructurePortrait(portrait,type,house);assert.ok(visible(portrait)>800);
    const original=r.structureSprite(type,'#ff0000',d.house),otherColor=r.structureSprite(type,'#00ff00',d.house);assert.equal(original,otherColor,'Baked house architecture is not generically tinted.');
    const field=canvas(220,220),ctx=field.getContext('2d');ctx.translate(110,150);r.building(ctx,{id:1,type,x:0,y:0,team:0,hp:100,maxHp:100},{teams:[house],time:30,allied:()=>true});assert.ok(visible(field)>1200);
  }
});
test('Runtime regiment and building artwork buffers stay below eight megabytes',()=>{
  const frames=[...Object.values(r.regimentTroopFrames).flatMap(houses=>Object.values(houses).flatMap(row=>row.frames)),...Object.values(r.regimentBuildingFrames)],bytes=frames.reduce((n,f)=>n+f.image.width*f.image.height*4,0);
  assert.ok(bytes<8*1024*1024,`${bytes} decoded bytes exceed the runtime artwork budget.`);
});

const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output){
  fs.mkdirSync(output,{recursive:true});const sheet=canvas(1140,460),ctx=sheet.getContext('2d');ctx.fillStyle='#152e32';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#e9d7a4';ctx.font='24px Georgia';ctx.fillText('House regiments · Shield Bearers and Lance Champions',28,40);
  const houses=[['Targaryen','#bc98ed','dragon'],['Lannister','#ef7165','lion'],['Stark','#8ac9e8','wolf'],['Tyrell','#95cb75','rose'],['Mormont','#89ba8d','bear'],['Martell','#f4a361','sun'],['Arryn','#a5b7ef','falcon']];
  for(const [i,[name,color,sigil]]of houses.entries()){
    const type=regiments[sigil],portrait=canvas(128,144);r.drawTroopPortrait(portrait,type,{sigil,color,dark:'#253f48'});ctx.drawImage(portrait,28+i*158,90,128,144);ctx.textAlign='center';ctx.font='17px Georgia';ctx.fillStyle=color;ctx.fillText(name,92+i*158,265);ctx.font='12px Segoe UI';ctx.fillStyle='#c0d0bd';ctx.fillText(type==='shield_bearer'?'Shield Bearers':'Lance Champions',92+i*158,288);
    const sprite=r.soldierSprite(type,color,'#253f48',1,2,true,sigil);ctx.drawImage(sprite,28+i*158,306,128,144);
  }
  fs.writeFileSync(path.join(output,'House-regiments.png'),sheet.toBuffer('image/png'));
  const buildings=canvas(1140,260),bctx=buildings.getContext('2d');bctx.fillStyle='#152e32';bctx.fillRect(0,0,buildings.width,buildings.height);bctx.fillStyle='#e9d7a4';bctx.font='24px Georgia';bctx.fillText('Dedicated house training buildings',28,38);
  for(const [i,[name,color,sigil]]of houses.entries()){
    const type=productionDefinitions.find(([,d])=>d.house===sigil)?.[0],portrait=canvas(128,144);r.drawStructurePortrait(portrait,type,{sigil,color,dark:'#253f48'});bctx.drawImage(portrait,28+i*158,60,128,144);bctx.textAlign='center';bctx.font='16px Georgia';bctx.fillStyle=color;bctx.fillText(name,92+i*158,229);
  }
  fs.writeFileSync(path.join(output,'House-regiment-buildings.png'),buildings.toBuffer('image/png'));
}
test('Opaque lances, roofs and foundations stay clear of their atlas cell edges',()=>{
  for(const [sigil,type]of Object.entries(regiments))for(const [index,frame]of r.getTroopFrame(type,sigil).frames.entries()){
    const b=frame.sourceBounds;assert.ok(Math.min(b.left,b.top,b.right,b.bottom)>0,`${sigil} unit frame ${index} touches an atlas cell edge.`);
  }
  for(const [sigil,frame]of Object.entries(r.regimentBuildingFrames)){
    const b=frame.sourceBounds;assert.ok(Math.min(b.left,b.top,b.right,b.bottom)>0,`${sigil} production building touches an atlas cell edge.`);
  }
});
console.log(`${cases} regiment raster checks passed.`);
