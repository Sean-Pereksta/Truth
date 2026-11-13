import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Game,HOUSES} from '../../core.js';
import {Renderer} from '../../render.js';
import {WarVision} from '../../vision.js';

const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP visual polish raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
const canvas=(w=1,h=1)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
const symbolMarkup=fs.readFileSync(path.join(root,'index.html'),'utf8');
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const symbols=new Map([...symbolMarkup.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)].map(m=>{
  const attributes=attrs(m[1]);return [attributes.id,{getAttribute:name=>attributes[name],querySelectorAll:tag=>[...m[2].matchAll(new RegExp('<'+tag+'\\b([^>]*)>','g'))].map(n=>{const a=attrs(n[1]);return {getAttribute:name=>a[name]??null};})}];
}));
globalThis.Image=raster.Image;globalThis.Path2D=raster.Path2D;globalThis.window={devicePixelRatio:1};
globalThis.document={createElement:()=>canvas(),getElementById:id=>symbols.get(id)||null};
const asset=name=>path.join(root,'assets',name),image=name=>raster.loadImage(asset(name));
const r=new Renderer(canvas(1100,760));
r.setTerrainAtlases(await image('ground-textures.png'),await image('terrain-props.png'));
r.setTroopAtlas(await image('troops-atlas.png'));
await Promise.all([
  r.loadLandsArt(asset('lands-atlas.png')),r.loadLandsGround(asset('lands-ground.png')),
  r.loadStructures(asset('structures-atlas.png')),r.loadCampaignArt(asset('campaign-structures.png')),
  r.loadHouseEmblems(asset('house-emblems.png')),
  r.loadBridgeArt(asset('bridges/stone-edges.png')),
  r.loadHouseArt({troops:Object.fromEntries(HOUSES.map(h=>[h.sigil,asset(`houses/${h.sigil}-troops.png`)])),castles:asset('house-castles.png'),production:asset('house-production.png')}),
  r.loadRegimentArt(Object.fromEntries(['wolf','lion','dragon','rose','bear','sun','falcon'].map(house=>[house,asset(`regiments/${house}-${['wolf','lion','dragon','rose'].includes(house)?'shield-bearer':'lance-champion'}.png`)]))),
  r.loadRegimentBuildings(asset('regiments/production-buildings.png')),
  r.loadConquestArt(Object.fromEntries(['castles','trebuchet','giant','sharpshooter','buildings'].map(k=>[k,asset(`conquest/${k}.png`)]))),
  r.loadReinforcementArt(Object.fromEntries(['stormbreaker','saltwind_axethrower','tollhouse_crossbow','crannog_spearhand','hornhill_halberdier','sun_horse_archer','buildings'].map(k=>[k,asset(`reinforcements/${k}.png`)])))
]);
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const digest=c=>createHash('sha256').update(pixels(c)).digest('hex');
const difference=(a,b)=>{let total=0;for(let i=0;i<a.length;i++)if(i%4!==3)total+=Math.abs(a[i]-b[i]);return total;};
const ui={selected:new Set(),selectedBuildings:new Set(),quality:'high',showGrid:false,hover:null,formation:'line'};
const view=(x,y,w=1100,h=760,zoom=1.1)=>({x:(x-y)*28,y:(x+y)*14,w,h,zoom,dpr:1});
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(fogOfWar=false){
  const g=new Game({landscape:'riverlands',scale:'standard',house:3,enemies:2,seed:44277,fogOfWar});
  g.units=[];g.buildings=[];g.castles=[];g.objectives=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.teamOrders=[];g.time=42;
  for(const t of g.tiles){t.owner=-1;t.capture=0;t.claim=-1;}
  for(const [i,sigil]of ['stag','bridge','frog'].entries()){
    const s=g.teams[i];Object.assign(s,HOUSES.find(h=>h.sigil===sigil));s.id=i;s.teamColor=s.color;s.alliance=i;s.count=0;s.alive=true;s.cap=1000;s.aiClock=1e9;
  }
  g.vision=new WarVision(g);return g;
}
function group(g,team,type,x,y,count=18,cols=6){
  const units=[];for(let i=0;i<count;i++){
    const u=g.addUnit(team,type,x+(i%cols)*.67,y+Math.floor(i/cols)*.68);g.hold([u.id]);u.phase=i*.6;u.facingX=team===1?-1:1;u.facingY=0;units.push(u);
  }
  return units;
}
function refresh(g){g.hash.rebuild(g.units);g.vision.update(true);}
const g=fixture();group(g,0,'stormbreaker',36.5,17.5);group(g,0,'cavalry',34.5,22.5,8,4);group(g,1,'bridge_warden',50.5,18.2);group(g,1,'tollhouse_crossbow',53.5,21.5,12,6);group(g,2,'crannog_spearhand',41.5,30.5);refresh(g);
const camera=view(44.5,23.5);

test('The actual battlefield draws exact painted house-selection crests above three troop groups',()=>{
  assert.equal(Object.keys(r.houseEmblemFrames).length,16);
  assert.equal(new Set(Object.values(r.houseEmblemFrames).map(digest)).size,16,'Every crest retains distinct source artwork.');
  const calls=[],original=r.drawHouseCrest;r.drawHouseCrest=function(c,team,x,y,size){calls.push({sigil:team.sigil,source:this.houseEmblemFrames[team.sigil],size});return original.call(this,c,team,x,y,size);};
  r.resize(camera.w,camera.h,1);try{r.draw(g,camera,ui);}finally{r.drawHouseCrest=original;}
  assert.ok(['stag','bridge','frog'].every(sigil=>calls.some(call=>call.sigil===sigil&&call.source===r.houseEmblemFrames[sigil]&&call.size===17)),'Markers use the exact loaded menu crest image at a small fixed screen size.');
  const anchors=[...r.formationBannerLayer.anchors.keys()];assert.ok(anchors.some(k=>k.startsWith('0:')));assert.ok(anchors.some(k=>k.startsWith('1:')));assert.ok(anchors.some(k=>k.startsWith('2:')));
  const withBanners=digest(r.canvas),draw=r.formationBannerLayer.draw;r.formationBannerLayer.draw=()=>[];
  try{r.draw(g,camera,ui);assert.notEqual(digest(r.canvas),withBanners,'Formation crests must affect actual battlefield pixels.');}
  finally{r.formationBannerLayer.draw=draw;}
});
test('The optional default grid is faint while construction restores a stronger placement grid',()=>{
  r.draw(g,camera,{...ui,showGrid:false});const clear=Uint8ClampedArray.from(pixels(r.canvas));
  r.draw(g,camera,{...ui,showGrid:true});const faint=Uint8ClampedArray.from(pixels(r.canvas));
  r.draw(g,camera,{...ui,showGrid:false,buildMode:'barracks'});const construction=pixels(r.canvas);
  const faintDifference=difference(clear,faint),strongDifference=difference(clear,construction);assert.ok(faintDifference>0);assert.ok(strongDifference>faintDifference*2,'Construction grid must be materially clearer than the faint grid.');
});
test('Repeated actual draws reuse terrain overview and tile chunks without repainting static terrain',()=>{
  const small=view(44.5,23.5,800,600);r.resize(small.w,small.h,1);r.draw(g,small,ui);r.draw(g,small,ui);
  const overview=r.terrainOverview,before=new Map(r.terrainChunkCache),tile=r.landsTileSprite,build=r.buildOverview;let tilePaints=0,overviewPaints=0;
  r.landsTileSprite=function(...args){tilePaints++;return tile.apply(this,args);};r.buildOverview=function(...args){overviewPaints++;return build.apply(this,args);};
  try{for(let i=0;i<3;i++)r.draw(g,small,ui);assert.equal(tilePaints,0);assert.equal(overviewPaints,0);assert.equal(r.terrainOverview,overview);for(const [key,value]of before)assert.equal(r.terrainChunkCache.get(key),value);}
  finally{r.landsTileSprite=tile;r.buildOverview=build;}
});
test('Fog excludes hidden army standards and hidden troop movement cannot alter their battlefield pixels',()=>{
  const fog=fixture(true);group(fog,0,'infantry',34,18,12);group(fog,1,'bridge_warden',38,18,12);const hidden=group(fog,2,'crannog_spearhand',59,30,12);refresh(fog);
  const fogCamera=view(46,24,1400,850,.95);r.resize(fogCamera.w,fogCamera.h,1);r.draw(fog,fogCamera,ui);
  const keys=[...r.formationBannerLayer.anchors.keys()];assert.ok(keys.some(k=>k.startsWith('0:')));assert.ok(keys.some(k=>k.startsWith('1:')));assert.equal(keys.some(k=>k.startsWith('2:')),false);
  const before=digest(r.canvas);for(const u of hidden){u.x+=5;u.y+=4;}refresh(fog);r.draw(fog,fogCamera,ui);assert.equal(digest(r.canvas),before,'Hidden armies cannot move a banner or change any battlefield pixels.');
});

if(output){
  fs.mkdirSync(output,{recursive:true});const shot=view(44.5,23.5,1600,1000,1.1);r.resize(shot.w,shot.h,1);r.draw(g,shot,{...ui,showGrid:true});
  fs.writeFileSync(path.join(output,'Battlefield-visuals-preview.png'),r.canvas.toBuffer('image/png'));
  console.log('Saved '+path.join(output,'Battlefield-visuals-preview.png'));
  const bridgeView=view(44.5,18.5,1600,1000,2.2);r.resize(bridgeView.w,bridgeView.h,1);r.draw(g,bridgeView,{...ui,showGrid:false});
  const bridgeCrop=canvas(1200,740);bridgeCrop.getContext('2d').drawImage(r.canvas,200,130,1200,740,0,0,1200,740);
  fs.writeFileSync(path.join(output,'Textured-bridge-preview.png'),bridgeCrop.toBuffer('image/png'));
  console.log('Saved '+path.join(output,'Textured-bridge-preview.png'));
}
console.log(`${checks} visual-polish renderer checks passed.`);
