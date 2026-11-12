import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Game} from '../../core.js';
import {LandsNavigation} from '../../navigation.js';
import {WarVision} from '../../vision.js';
import {Renderer} from '../../render.js';

const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP fog raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
const canvas=(w=1,h=1)=>{const c=raster.createCanvas(w,h);c.style={};c.getBoundingClientRect=()=>({width:c.width,height:c.height,left:0,top:0});return c;};
globalThis.Image=raster.Image;globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>canvas(),getElementById:()=>null};
const image=name=>raster.loadImage(path.join(root,name));
const r=new Renderer(canvas(1100,760));
r.setTerrainAtlases(await image('assets/ground-textures.png'),await image('assets/terrain-props.png'));
await r.loadLandsArt(path.join(root,'assets/lands-atlas.png'));await r.loadLandsGround(path.join(root,'assets/lands-ground.png'));
r.setTroopAtlas(await image('assets/troops-atlas.png'));await r.loadStructures(path.join(root,'assets/structures-atlas.png'));await r.loadCampaignArt(path.join(root,'assets/campaign-structures.png'));
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const digest=c=>createHash('sha256').update(pixels(c)).digest('hex');
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(Math.floor(x),Math.floor(y),1,1).data];
const ui={selected:new Set(),selectedBuildings:new Set(),showGrid:false,quality:'high'};
const view={x:0,y:24*28,w:1100,h:760,zoom:.8,dpr:1};
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(fogOfWar=true){
  const g=new Game({fogOfWar,landscape:'open',scale:'standard',enemies:3,seed:44277});
  g.W=48;g.H=40;g.tiles=g.tiles.filter(t=>t.x<g.W&&t.y<g.H);g.units=[];g.buildings=[];g.castles=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.landmarks=[];g.teamOrders=[];g.time=30;
  for(const t of g.tiles){t.terrain=t.x>=17&&t.x<=20&&t.y>=8&&t.y<=28?'forest':t.x>32&&t.y>30?'hill':'grass';t.feature=null;t.owner=-1;t.claim=-1;t.capture=0;}
  for(const s of g.teams){s.alive=true;s.count=0;s.cap=1000;s.aiClock=1e9;}
  g.navigation=new LandsNavigation(g);g.vision=new WarVision(g);
  const keep=g.addBuilding(0,'keep',10.5,22.5),scout=g.addUnit(0,'cavalry',13.5,22.5),visible=g.addUnit(1,'infantry',18.5,22.5),hidden=g.addUnit(1,'cavalry',40.5,27.5),unseen=g.addBuilding(1,'keep',40.5,24.5);
  g.objectives=[{id:0,name:'Eastern Standard',x:35.5,y:30.5,radius:4,required:30,progress:[0,0,0,0],controller:null,contested:false,cooldownUntil:0,captures:0}];
  refresh(g);return {g,keep,scout,visible,hidden,unseen};
}
const refresh=g=>{g.hash.rebuild(g.units);g.vision.update(true);};
const draw=g=>{r.draw(g,view,ui);return digest(r.canvas);};
const mini=g=>{const c=canvas(360,220);r.drawMinimap(g,c,view);return c;};

test('Battlefield rendering excludes unseen armies and structures while retaining visible enemies',()=>{
  const {g,visible,hidden,unseen}=fixture(),units=[],buildings=[],originalUnit=r.unit,originalBuilding=r.building;
  r.unit=function(c,u,...rest){units.push(u.id);return originalUnit.call(this,c,u,...rest);};
  r.building=function(c,b,...rest){buildings.push(b.id);return originalBuilding.call(this,c,b,...rest);};
  try{draw(g);}finally{r.unit=originalUnit;r.building=originalBuilding;}
  assert.ok(units.includes(visible.id));assert.equal(units.includes(hidden.id),false);assert.equal(buildings.includes(unseen.id),false);
});

test('Changing invisible troop positions or unseen structures cannot change battlefield or minimap pixels',()=>{
  const {g,hidden,unseen}=fixture();const field=draw(g),map=digest(mini(g));
  hidden.x=38.5;hidden.y=34.5;hidden.hp=1;unseen.hp=100;unseen.level=3;g.addBuilding(2,'tower',43.5,34.5);refresh(g);
  assert.equal(draw(g),field,'Hidden reality cannot alter battlefield pixels.');assert.equal(digest(mini(g)),map,'Hidden armies and construction cannot alter minimap markers or scenery.');
});

test('Remembered structures render their frozen drawing after hidden damage, movement and destruction',()=>{
  const {g,scout}=fixture(),b=g.addBuilding(1,'tower',31.5,21.5);scout.x=28.5;refresh(g);draw(g);
  scout.x=13.5;refresh(g);const calls=[],original=r.rememberedBuilding;
  r.rememberedBuilding=function(c,m,...rest){calls.push({...m});return original.call(this,c,m,...rest);};
  let before;
  try{before=draw(g);b.x=40.5;b.y=34.5;b.hp=0;b.level=3;g.buildings=g.buildings.filter(e=>e.id!==b.id);g.byId.delete(b.id);refresh(g);assert.equal(draw(g),before);}
  finally{r.rememberedBuilding=original;}
  const painted=calls.filter(m=>m.id===b.id);assert.equal(painted.length,2);assert.ok(painted.every(m=>m.remembered&&m.x===31.5&&m.y===21.5&&m.level===1&&m.hp===m.maxHp));
  scout.x=28.5;refresh(g);assert.equal(r.fogScene(g).buildings.some(e=>e.id===b.id),false,'Rescout removes a ghost when the old position is empty.');
});

test('Fog keeps terrain transparent, dims explored ground gently and leaves current sight clear',()=>{
  const {g,scout}=fixture();scout.x=30.5;scout.y=30.5;refresh(g);scout.x=13.5;scout.y=22.5;refresh(g);
  const fog=r.fogPixels(g),clear=pixel(fog,13,22),seen=pixel(fog,30,30),unknown=pixel(fog,45,37);
  assert.equal(clear[3],0);assert.ok(seen[3]>0&&seen[3]<unknown[3]);assert.ok(unknown[3]<180,'Unseen terrain must remain readable through the fog.');
  const testCanvas=canvas(96,40),ctx=testCanvas.getContext('2d');ctx.fillStyle='#98b25c';ctx.fillRect(0,0,48,40);ctx.fillStyle='#497fa0';ctx.fillRect(48,0,48,40);ctx.drawImage(fog,0,0,48,40,0,0,96,40);
  assert.notDeepEqual(pixel(testCanvas,42,38).slice(0,3),pixel(testCanvas,90,38).slice(0,3),'Terrain colors still show through unseen fog.');
});

test('Hidden flag control, projectiles, explosions and fire zones do not disclose an unseen battle',()=>{
  const {g}=fixture();const before=draw(g),map=digest(mini(g)),flag=g.objectives[0];
  Object.assign(flag,{controller:1,progress:[0,29,0,0],contested:true,cooldownUntil:70,captures:5});
  g.projectiles.push({x:37,y:31,sx:36,sy:30,tx:38,ty:32,t:.2,duration:1,type:'rock',team:1});g.effects.push({x:37,y:31,type:'explosion',life:.5,maxLife:1,team:1,radius:1.5});g.fireZones.push({x:37,y:31,life:4,maxLife:5,radius:2,team:1});
  assert.equal(draw(g),before);assert.equal(digest(mini(g)),map);
  const publicFlag=r.fogScene(g).objectives[0];assert.equal(publicFlag.controller,null);assert.equal(publicFlag.contested,false);assert.deepEqual(publicFlag.progress,[]);
  g.effects.push({x:13.5,y:22.5,type:'explosion',life:.5,maxLife:1,team:0});assert.notEqual(draw(g),before,'Effects inside sight still render.');
});

test('Territory overlays preserve last-seen enemy ownership instead of reading hidden transfers',()=>{
  const {g,scout}=fixture(),tile=g.tileAt(31.5,21.5);scout.x=28.5;tile.owner=1;refresh(g);draw(g);scout.x=13.5;refresh(g);draw(g);
  const color=pixel(r.ownerPixels,tile.x,tile.y);tile.owner=2;refresh(g);draw(g);assert.deepEqual(pixel(r.ownerPixels,tile.x,tile.y),color);
  scout.x=28.5;refresh(g);draw(g);assert.notDeepEqual(pixel(r.ownerPixels,tile.x,tile.y),color,'New ownership appears only after scouting.');
});

test('The minimap refreshes newly scouted ownership without depending on a preceding battlefield draw',()=>{
  const {g,scout}=fixture(),tile=g.tileAt(31.5,21.5);tile.owner=1;draw(g);mini(g);assert.equal(pixel(r.ownerPixels,tile.x,tile.y)[3],0);
  scout.x=28.5;refresh(g);mini(g);assert.equal(pixel(r.ownerPixels,tile.x,tile.y)[3],255,'Fresh sight must update the standalone minimap territory cache.');
});

test('Remembered minimap strongholds are faded so stale intelligence differs from current sight',()=>{
  const {g,scout}=fixture(),b=g.addBuilding(1,'tower',31.5,21.5);scout.x=28.5;refresh(g);draw(g);scout.x=13.5;refresh(g);
  const c=canvas(360,220),ctx=c.getContext('2d'),fill=ctx.fillRect,alphas=[];ctx.fillRect=function(x,y,w,h){if(w>4&&w<9&&this.fillStyle===g.teams[1].color)alphas.push(this.globalAlpha);return fill.call(this,x,y,w,h);};
  r.drawMinimap(g,c,view);assert.ok(alphas.some(a=>a>0&&a<.7),'Last-seen structure markers use a clearly faded opacity.');assert.ok(r.fogScene(g).buildings.find(e=>e.id===b.id).remembered);
});

test('A fog-disabled game draws every live army and building with no fog overlay',()=>{
  const {g,hidden,unseen}=fixture(false),scene=r.fogScene(g);assert.ok(scene.units.includes(hidden));assert.ok(scene.buildings.includes(unseen));assert.equal(r.fogPixels(g),null);
  const before=draw(g);hidden.x-=3;hidden.y-=2;assert.notEqual(draw(g),before,'Unrestricted battlefields retain their original live world view.');
});

if(output){
  fs.mkdirSync(output,{recursive:true});const {g,scout}=fixture(),old=g.addBuilding(1,'tower',31.5,21.5);scout.x=28.5;refresh(g);scout.x=13.5;refresh(g);g.addBuilding(0,'tower',17.5,26.5);refresh(g);old.hp=400;
  ui.selectedBuildings=new Set(g.buildings.filter(b=>b.team===0&&b.type==='tower').map(b=>b.id));draw(g);const map=mini(g),sheet=canvas(1100,850),ctx=sheet.getContext('2d');ctx.fillStyle='#102a30';ctx.fillRect(0,0,1100,850);ctx.fillStyle='#edddb7';ctx.font='bold 28px Georgia';ctx.fillText('Bannerlands · Scouts, watchtowers & fog of war',28,38);ctx.fillStyle='#b7cec4';ctx.font='15px Segoe UI';ctx.fillText('Terrain stays visible · Ghosts show last-seen buildings · Enemy armies require current sight',28,67);ctx.drawImage(r.canvas,0,90);ctx.fillStyle='#0d262c';ctx.fillRect(728,604,360,232);ctx.drawImage(map,728,610);fs.writeFileSync(path.join(output,'Fog-of-war-preview.png'),sheet.toBuffer('image/png'));ui.selectedBuildings=new Set();
}
console.log(`${cases} fog rendering checks passed.`);
