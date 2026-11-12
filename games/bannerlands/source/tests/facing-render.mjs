import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';

// Raster integration uses the same optional native canvas as lands-render.mjs.
const require=createRequire(import.meta.url);
let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP facing raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const canvas=(w=640,h=480)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.document={createElement:()=>canvas(1,1)};
globalThis.window={devicePixelRatio:1};
const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output)fs.mkdirSync(output,{recursive:true});
const r=new Renderer(canvas());r.setTroopAtlas(await raster.loadImage(path.join(root,'assets/troops-atlas.png')));
globalThis.Image=raster.Image;
const houseOrder=['wolf','lion','dragon','stag','rose','sun','kraken','falcon','flayed','bridge','bear','fish','frog','beacon','huntsman','bone'];
await r.loadHouseArt({troops:Object.fromEntries(houseOrder.map(sigil=>[sigil,path.join(root,'assets/houses',sigil+'-troops.png')])),castles:path.join(root,'assets/house-castles.png'),production:path.join(root,'assets/house-production.png')});
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const opaque=c=>{let n=0;for(let i=3,p=pixels(c);i<p.length;i+=4)if(p[i]>40)n++;return n;};
const g={teams:[{color:'#81adce',dark:'#284953',sigil:'wolf'}],time:30,unitClass:()=> 'infantry',houseContent:()=>({unit:null}),allied:()=>true,isWalkable:()=>true};
const unit=()=>({id:1,team:0,type:'infantry',x:0,y:0,vx:-1,vy:0,facingX:1,facingY:0,order:{mode:'move',facingX:1,facingY:0},phase:Math.PI*.6,backpedaling:true,hp:132,maxHp:132});

test('Frey spearmen and Bolton pikes keep their existing distinct painted house artwork',()=>{
  const spear=r.getTroopFrame('bridge_warden','bridge'),pike=r.getTroopFrame('dread_pike','flayed');
  assert.equal(spear.frames.length,8);assert.equal(pike.frames.length,8);
  assert.equal(spear.house,'bridge');assert.equal(pike.house,'flayed');
  for(let i=0;i<8;i++){
    assert.ok(opaque(spear.frames[i].image)>800);assert.ok(opaque(pike.frames[i].image)>800);
    assert.notDeepEqual(pixels(spear.frames[i].image),pixels(pike.frames[i].image));
  }
  assert.notEqual(spear.frames[0].image,r.troopFrames.infantry.frames[0].image);
});

test('A backward march keeps the sprite facing forward and reverses its walk cycle',()=>{
  const target=canvas(),ctx=target.getContext('2d'),u=unit(),calls=[],original=r.soldierSprite;
  r.soldierSprite=(...args)=>{calls.push(args);return null;};ctx.translate(320,240);
  try{
    r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],1);assert.equal(calls.at(-1)[4],2);
    u.facingX=-1;u.backpedaling=false;r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],-1);assert.equal(calls.at(-1)[4],1);
    u.attackAnim=.8;u.facingX=1;r.unit(ctx,u,g,{selected:new Set()},1);assert.equal(calls.at(-1)[3],1);assert.equal(calls.at(-1)[5],true);
  }finally{r.soldierSprite=original;}
});

test('Selected troops expose their facing even while their velocity points backward',()=>{
  const draw=face=>{const c=canvas(),ctx=c.getContext('2d'),u=unit();ctx.translate(320,240);u.facingX=face;const original=r.soldierSprite;r.soldierSprite=()=>null;try{r.unit(ctx,u,g,{selected:new Set([1])},1);}finally{r.soldierSprite=original;}return c;};
  const front=draw(1),rear=draw(-1);assert.notDeepEqual(pixels(front),pixels(rear));
  assert.ok(front.getContext('2d').getImageData(334,247,4,4).data.some((v,i)=>i%4===3&&v>50),'Forward direction tick remains in front of the soldier.');
});

test('A settled directional attack line draws its leveled pikes without a Hold order',()=>{
  const draw=braced=>{const c=canvas(),ctx=c.getContext('2d'),u=unit();ctx.translate(320,240);u.type='dread_pike';u.order.mode='attack';u.vx=0;u.backpedaling=false;u.braceDir={x:1,y:0};u.braceTime=braced?1:0;const original=r.soldierSprite;r.soldierSprite=()=>null;try{r.unit(ctx,u,g,{selected:new Set()},1);}finally{r.soldierSprite=original;}return c;};
  assert.ok(opaque(draw(true))>opaque(draw(false))+30,'The braced spear and front line are visible on the ground.');
});

test('Formation previews rotate with facing and sample at most thirty-six destination slots',()=>{
  const draw=(faceX,faceY,count=1000)=>{const c=canvas(),ctx=c.getContext('2d');let checks=0;ctx.translate(320,240);r.facingPreview(ctx,{isWalkable:()=>{checks++;return true;}},{x:0,y:0,faceX,faceY,count,formation:'line'},1);return {c,checks};};
  const a=draw(1,0),b=draw(0,1);assert.equal(a.checks,36);assert.equal(b.checks,36);assert.notDeepEqual(pixels(a.c),pixels(b.c));assert.ok(opaque(a.c)>100);
  assert.equal(draw(1,0,1).checks,1);
});

test('Blocked formation slots are marked and an invalid direction draws nothing',()=>{
  const blocked=canvas(),ctx=blocked.getContext('2d');ctx.translate(320,240);r.facingPreview(ctx,{isWalkable:()=>false},{x:0,y:0,faceX:1,faceY:0,count:12,formation:'spread'},1);
  let orange=0;const data=pixels(blocked);for(let i=0;i<data.length;i+=4)if(data[i]>150&&data[i+1]>70&&data[i+1]<190&&data[i+2]<160&&data[i+3]>100)orange++;
  assert.ok(orange>20,'Impassable preview positions use visible warning crosses.');
  const invalid=canvas();r.facingPreview(invalid.getContext('2d'),g,{x:0,y:0,faceX:0,faceY:0,count:12},1);assert.equal(opaque(invalid),0);
});

if(output){
  const sheet=canvas(960,520),ctx=sheet.getContext('2d');ctx.fillStyle='#152e32';ctx.fillRect(0,0,960,520);ctx.font='22px Georgia';ctx.fillStyle='#e9d7a4';ctx.fillText('Directional formations · Frey spears and Bolton pikes',30,39);
  const art=r.soldierSprite.bind(r);
  for(const [i,[type,sigil,label]]of [['infantry',null,'Swordsmen'],['bridge_warden','bridge','Bridge Wardens'],['dread_pike','flayed','Dread Pikes']].entries()){
    const sprite=art(type,'#81adce','#284953',1,0,false,sigil);ctx.drawImage(sprite,50+i*150,70,128,144);ctx.font='16px Segoe UI';ctx.fillStyle='#c2d4c5';ctx.fillText(label,50+i*150,235);
  }
  ctx.save();ctx.translate(680,160);r.facingPreview(ctx,g,{x:0,y:0,faceX:1,faceY:-.4,count:45,formation:'line'},1);ctx.restore();
  ctx.font='14px Segoe UI';ctx.fillStyle='#b4c9bd';ctx.fillText('Right-drag preview shows the formation front',520,265);
  const displayGame={...g,teams:[{color:'#b6c4d1',dark:'#465763',sigil:'bridge'},{color:'#df8f9d',dark:'#703c4b',sigil:'flayed'}],houseContent:team=>({unit:team===0?'bridge_warden':'dread_pike'})};
  for(let i=0;i<8;i++){
    const u=unit();u.id=i+1;u.x=0;u.y=0;u.team=i<4?0:1;u.type=i<4?'bridge_warden':'dread_pike';u.order.mode='attack';u.vx=0;u.backpedaling=false;u.braceDir={x:1,y:0};u.braceTime=1;
    ctx.save();ctx.translate(90+i*100,410);r.unit(ctx,u,displayGame,{selected:new Set([i+1])},1);ctx.restore();
  }
  ctx.font='14px Segoe UI';ctx.fillStyle='#b4c9bd';ctx.fillText('Leveled spear and pike line · visible ground arrows show facing',30,476);
  fs.writeFileSync(path.join(output,'directional-formation-art.png'),sheet.toBuffer('image/png'));

  // A staged battlefield uses the actual game renderer and existing house art.
  // It illustrates a locked Frey spear front, Bolton pikes and cavalry at the rear.
  const {Game,HOUSES}=await import('../../core.js');
  const scene=new Game({house:9,landscape:'open',scale:'standard',enemies:3,seed:628410});
  scene.units=[];scene.buildings=[];scene.objectives=[];scene.effects=[];scene.byId.clear();scene.time=30;
  Object.assign(scene.teams[1],HOUSES[8],{house:8,houseColor:HOUSES[8].color,teamColor:HOUSES[8].color});
  Object.assign(scene.teams[2],HOUSES[3],{house:3,houseColor:HOUSES[3].color,teamColor:HOUSES[3].color});
  for(const s of scene.teams){s.count=0;s.aiClock=1e9;s.gold=0;s.income=0;}
  for(const t of scene.tiles)if(t.x>=38&&t.x<=72&&t.y>=30&&t.y<=66){
    t.terrain=t.x>=60&&t.x<=65&&t.y>=38&&t.y<=43?'forest':t.x>=47&&t.x<=53&&t.y>=54&&t.y<=59?'hill':'grass';t.height=t.terrain==='hill'?.12:0;t.feature=t.y===49?'road':null;t.owner=-1;
  }
  const selected=new Set();
  for(let row=0;row<2;row++)for(let col=0;col<14;col++){
    const u=scene.addUnit(0,'bridge_warden',56.5-row*.46,44.2+col*.46);Object.assign(u,{facingX:1,facingY:0,braceDir:{x:1,y:0},braceTime:1,held:true});u.order={x:u.x,y:u.y,mode:'move',formation:'line',facingX:1,facingY:0};selected.add(u.id);
  }
  for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const u=scene.addUnit(1,'dread_pike',61.3+row*.46,42.3+col*.46);Object.assign(u,{facingX:-1,facingY:0,braceDir:{x:-1,y:0},braceTime:1,held:true});u.order={x:u.x,y:u.y,mode:'hold',formation:'line',facingX:-1,facingY:0};
  }
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const u=scene.addUnit(2,'cavalry',50.1-row*.8,46+col*.8);Object.assign(u,{vx:3.5,vy:0,motionVX:3.5,motionVY:0,facingX:1,facingY:0,charging:true,momentum:.95,chargeDir:{x:1,y:0}});u.order={x:56.2,y:u.y,mode:'attack',formation:'wedge'};
  }
  scene.navigation.invalidate();scene.hash.rebuild(scene.units);
  r.setTerrainAtlases(await raster.loadImage(path.join(root,'assets/ground-textures.png')),await raster.loadImage(path.join(root,'assets/terrain-props.png')));
  await r.loadLandsArt(path.join(root,'assets/lands-atlas.png'));await r.loadLandsGround(path.join(root,'assets/lands-ground.png'));
  r.resize(1400,900,1);
  r.draw(scene,{x:(55.8-47.5)*28,y:(55.8+47.5)*14,w:1400,h:900,dpr:1,zoom:1.7},{selected,selectedBuildings:new Set(),quality:'high',showGrid:false,facingPreview:{x:57.5,y:47.5,faceX:1,faceY:0,count:28,formation:'line'}});
  fs.writeFileSync(path.join(output,'Combat-formations.png'),r.canvas.toBuffer('image/png'));
}
console.log(`${cases} facing raster checks passed.`);
