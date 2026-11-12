import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {BUILD_DEFS,HOUSES,UNIT_DEFS} from '../../core.js';

const require=createRequire(import.meta.url);
let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP conquest raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sources=Object.fromEntries(['castles','trebuchet','giant','sharpshooter','buildings'].map(key=>[key,path.join(root,'assets/conquest',key+'.png')]));
for(const file of Object.values(sources))assert.ok(fs.existsSync(file),'Missing generated conquest artwork: '+file);
const canvas=(w=256,h=256)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.document={createElement:()=>canvas(1,1),getElementById:()=>null};
globalThis.Image=raster.Image;
const r=new Renderer(canvas());
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const digest=c=>createHash('sha256').update(pixels(c)).digest('hex');
const visible=c=>{let n=0;for(let i=3,p=pixels(c);i<p.length;i+=4)if(p[i]>40)n++;return n;};
const house=sigil=>HOUSES.find(h=>h.sigil===sigil);
const units=[['trebuchet','flayed'],['trebuchet','beacon'],['giant','bone'],['sharpshooter','fish']];
const buildings=['dread_siege_yard','hightower_siege_yard','giant_camp','sharpshooter_lodge'];
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};

test('Conquest content never substitutes ordinary soldier or house specialist artwork',()=>{
  r.houseArtReady=true;r.houseTroopFrames.fish={frames:['wrong specialist']};r.houseProductionFrames.fish={image:'wrong lodge'};r.rasterSpritesReady=true;r.troopFrames.infantry={frames:['wrong infantry']};
  for(const [type,sigil]of units){assert.equal(r.getTroopFrame(type,sigil),null);assert.equal(r.soldierSprite(type,'#ffffff','#000000',1,0,false,sigil),null);}
  for(const type of buildings)assert.equal(r.getStructureFrame(type,BUILD_DEFS[type].house),null);
  r.houseArtReady=false;r.rasterSpritesReady=false;
});
const info=await r.loadConquestArt(sources);
test('Five generated sheets expose all twenty-four unit frames, four buildings and four castle states',()=>{
  assert.equal(r.conquestArtReady,true);assert.deepEqual(info,{troops:3,troopFrames:24,buildings:4,castleStates:4});
  for(const type of ['trebuchet','giant','sharpshooter']){
    const row=r.conquestTroopFrames[type];assert.equal(row.frames.length,8);
    for(const f of row.frames){assert.ok(f.width>30&&f.height>30);assert.ok(visible(f.image)>500);}
    assert.equal(new Set(row.frames.map(f=>digest(f.image))).size,8,'Animation frames must contain different source drawings.');
  }
});
test('Transparent borders and padding preserve the battlefield around every sprite',()=>{
  const frames=[...Object.values(r.conquestTroopFrames).flatMap(row=>row.frames),...Object.values(r.conquestBuildingFrames),...r.castleStateFrames];
  for(const f of frames){
    const c=f.image,ctx=c.getContext('2d'),corners=[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]];
    assert.ok(corners.every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]===0),'Extracted frame must retain a transparent border.');
    assert.ok(visible(c)<c.width*c.height*.9,'Artwork must not contain an opaque background rectangle.');
  }
});
test('House restrictions select exactly the intended new units and buildings',()=>{
  for(const [type,sigil]of units){assert.equal(r.getTroopFrame(type,sigil),r.conquestTroopFrames[type]);assert.equal(r.getTroopFrame(type,'wolf'),null);assert.equal(r.getTroopFrame(type),null);}
  assert.equal(r.getTroopFrame('trebuchet','flayed'),r.getTroopFrame('trebuchet','beacon'),'Both siege houses intentionally share the neutral timber machine.');
  for(const type of buildings){const sigil=BUILD_DEFS[type].house;assert.equal(r.getStructureFrame(type,sigil),r.conquestBuildingFrames[type]);assert.equal(r.getStructureFrame(type,'wolf'),null);assert.equal(r.getStructureFrame(type),null);}
});
test('Every facility and castle state has a separate nonempty generated drawing',()=>{
  assert.equal(new Set(Object.values(r.conquestBuildingFrames).map(f=>digest(f.image))).size,4);
  assert.equal(new Set(r.castleStateFrames.map(f=>digest(f.image))).size,4);
  for(const f of [...Object.values(r.conquestBuildingFrames),...r.castleStateFrames])assert.ok(visible(f.image)>5000);
  assert.equal(r.getStructureFrame('restored_castle','wolf'),r.castleStateFrames[1]);
});
test('Walk, attack, mirrored facing and portraits use each new unit sheet',()=>{
  for(const [type,sigil]of units){
    for(const attack of [false,true])for(const direction of [-1,1])for(let frame=0;frame<4;frame++)assert.ok(visible(r.soldierSprite(type,house(sigil).color,house(sigil).dark,direction,frame,attack,sigil))>150);
    assert.notEqual(digest(r.soldierSprite(type,'#ffffff','#000000',1,0,false,sigil)),digest(r.soldierSprite(type,'#ffffff','#000000',-1,0,false,sigil)));
    const portrait=canvas(96,96);r.drawTroopPortrait(portrait,type,house(sigil));assert.ok(visible(portrait)>600);
  }
});
const unit=(type,extra={})=>({id:1,team:0,type,x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,hp:100,maxHp:100,phase:0,...extra});
const game=sigil=>({teams:[{...house(sigil),alliance:0}],time:30,unitClass:u=>UNIT_DEFS[u.type].class,houseContent:()=>({unit:'existing_specialist'}),allied:()=>true});
const drawUnit=(type,sigil,extra={})=>{const c=canvas(200,180),ctx=c.getContext('2d');ctx.translate(100,115);r.unit(ctx,unit(type,extra),game(sigil),{selected:new Set([1])},1);return c;};
test('Battlefield units forward their own house and use actual generated pictures',()=>{
  const calls=[],original=r.soldierSprite.bind(r);r.soldierSprite=(...args)=>{calls.push(args);return original(...args);};
  try{for(const [type,sigil]of units){const c=drawUnit(type,sigil);assert.ok(visible(c)>180);assert.equal(calls.at(-1)[0],type);assert.equal(calls.at(-1)[6],sigil);}}
  finally{r.soldierSprite=original;}
});
test('Trebuchet packed and deployed states draw different machines and setup feedback',()=>{
  const packed=drawUnit('trebuchet','flayed',{setupProgress:0}),deployed=drawUnit('trebuchet','flayed',{setupProgress:15});
  assert.notEqual(digest(packed),digest(deployed));assert.ok(visible(packed)>500&&visible(deployed)>500);
});
test('Production portraits and world buildings use the four faction-specific facilities',()=>{
  for(const type of buildings){
    const h=house(BUILD_DEFS[type].house),portrait=canvas(96,96);r.drawStructurePortrait(portrait,type,h);assert.ok(visible(portrait)>900);
    const field=canvas(260,230),ctx=field.getContext('2d');ctx.translate(130,155);
    r.building(ctx,{id:1,type,x:0,y:0,team:0,hp:100,maxHp:100},game(h.sigil));assert.ok(visible(field)>2000);
  }
});
const drawRuin=(captures=0,contested=false)=>{const c=canvas(280,260),ctx=c.getContext('2d');ctx.translate(140,165);r.castleRuin(ctx,{x:0,y:0,captures,required:60,controller:0,progress:[30],contested},game('fish'),1);return c;};
test('Ruined castles expose distinct destroyed states and visible contested capture progress',()=>{
  const initial=drawRuin(0),destroyed=drawRuin(1),contested=drawRuin(1,true);
  for(const c of [initial,destroyed,contested])assert.ok(visible(c)>9000);
  assert.notEqual(digest(initial),digest(destroyed));assert.notEqual(digest(destroyed),digest(contested));
});
test('A rebuilt keep draws the generated restored castle in the battlefield',()=>{
  const c=canvas(280,260),ctx=c.getContext('2d');ctx.translate(140,165);
  r.building(ctx,{id:1,type:'keep',restoredCastle:true,level:1,x:0,y:0,team:0,hp:2500,maxHp:2500},game('fish'));assert.ok(visible(c)>7000);
});
test('Conquest decoded artwork stays below an eight-megabyte runtime budget',()=>{
  const frames=[...Object.values(r.conquestTroopFrames).flatMap(row=>row.frames),...Object.values(r.conquestBuildingFrames),...r.castleStateFrames],bytes=frames.reduce((n,f)=>n+f.image.width*f.image.height*4,0);
  assert.ok(bytes<8*1024*1024,bytes+' decoded bytes exceeds artwork budget.');
});
test('Incomplete artwork fails clearly and disables conquest rendering',()=>{
  assert.throws(()=>r.setConquestArt({}),/Missing trebuchet conquest artwork/);assert.equal(r.conquestArtReady,false);assert.equal(r.getTroopFrame('giant','bone'),null);
});
await r.loadConquestArt(sources);

const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output){
  fs.mkdirSync(output,{recursive:true});
  const originalUnits=Object.fromEntries(await Promise.all(['trebuchet','giant','sharpshooter'].map(async type=>[type,await raster.loadImage(sources[type])])));
  const sheet=canvas(1400,1120),ctx=sheet.getContext('2d');
  ctx.fillStyle='#102c30';ctx.fillRect(0,0,sheet.width,sheet.height);
  ctx.fillStyle='#eddcb4';ctx.font='bold 32px Georgia';ctx.fillText('Bannerlands · Ruins & Reinforcements',44,54);
  ctx.font='18px Segoe UI';ctx.fillStyle='#b9ccc0';ctx.fillText('Hold a ruined castle for 60 seconds · +60 troop capacity · claim an 8-tile realm',44,86);
  const labels=['Neutral ruins','Rebuilt castle','Destroyed again','Stone castle'];
  for(let i=0;i<4;i++){
    const f=r.castleStateFrames[i],scale=1.8,w=f.drawWidth*scale,h=f.drawHeight*scale,x=190+i*340;
    ctx.drawImage(f.image,f.left,f.top,f.width,f.height,x-w/2,345-h,w,h);ctx.fillStyle='#e7d7ad';ctx.font='20px Georgia';ctx.textAlign='center';ctx.fillText(labels[i],x,380);
  }
  ctx.textAlign='left';ctx.strokeStyle='#416367';ctx.beginPath();ctx.moveTo(44,408);ctx.lineTo(1356,408);ctx.stroke();
  const unitLabels=['Bolton trebuchet','Hightower trebuchet','Free Folk giant','Tully sharpshooter'];
  const rules=['15s setup · 10.5 range','Heavy stones · slow fire','High health · splash strikes','6.25 range · patient aim'];
  for(const [i,[type,sigil]]of units.entries()){
    const x=190+i*340,h=house(sigil),bounds=r.conquestTroopFrames[type].frames[0].sourceBounds,cropWidth=bounds.cellWidth-bounds.left-bounds.right,cropHeight=bounds.cellHeight-bounds.top-bounds.bottom,portraitScale=Math.min(230/cropWidth,230/cropHeight),portraitWidth=cropWidth*portraitScale,portraitHeight=cropHeight*portraitScale;
    ctx.drawImage(originalUnits[type],bounds.left,bounds.top,cropWidth,cropHeight,x-portraitWidth/2,660-portraitHeight,portraitWidth,portraitHeight);
    ctx.textAlign='center';ctx.font='22px Georgia';ctx.fillStyle=h.color;ctx.fillText(unitLabels[i],x,695);ctx.font='16px Segoe UI';ctx.fillStyle='#c2d1c3';ctx.fillText(rules[i],x,722);
    const source=r.conquestTroopFrames[type].frames[6],scale=type==='trebuchet'?1:1.05,w=source.width/3*scale,hgt=source.height/3*scale;
    ctx.drawImage(source.image,source.left,source.top,source.width,source.height,x-w/2,795-hgt,w,hgt);
  }
  ctx.strokeStyle='#416367';ctx.beginPath();ctx.moveTo(44,820);ctx.lineTo(1356,820);ctx.stroke();
  for(const [i,type]of buildings.entries()){
    const f=r.conquestBuildingFrames[type],x=190+i*340,w=f.drawWidth*1.8,h=f.drawHeight*1.8;
    ctx.drawImage(f.image,f.left,f.top,f.width,f.height,x-w/2,1048-h,w,h);
    ctx.textAlign='center';ctx.font='20px Georgia';ctx.fillStyle='#e7d7ad';ctx.fillText(BUILD_DEFS[type].label,x,1080);
  }
  fs.writeFileSync(path.join(output,'New-castles-and-regiments.png'),sheet.toBuffer('image/png'));
}
console.log(cases+' conquest raster checks passed.');
