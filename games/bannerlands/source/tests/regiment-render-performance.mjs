import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';
import {Renderer} from '../../render.js';

const require=createRequire(import.meta.url);
let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP regiment renderer benchmark: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const canvas=(w=1,h=1)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.Image=raster.Image;globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>canvas(),getElementById:()=>null};
const image=name=>raster.loadImage(path.join(root,'assets',name+'.png'));
const r=new Renderer(canvas(1200,800));
r.setTerrainAtlases(await image('ground-textures'),await image('terrain-props'));r.setTroopAtlas(await image('troops-atlas'));
await r.loadLandsArt(path.join(root,'assets/lands-atlas.png'));await r.loadLandsGround(path.join(root,'assets/lands-ground.png'));
await r.loadStructures(path.join(root,'assets/structures-atlas.png'));await r.loadCampaignArt(path.join(root,'assets/campaign-structures.png'));
const houseOrder=['wolf','lion','dragon','stag','rose','sun','kraken','falcon','flayed','bridge','bear','fish','frog','beacon','huntsman','bone'];
await r.loadHouseArt({troops:Object.fromEntries(houseOrder.map(sigil=>[sigil,path.join(root,'assets/houses',sigil+'-troops.png')])),castles:path.join(root,'assets/house-castles.png'),production:path.join(root,'assets/house-production.png')});
const regiments={wolf:'shield_bearer',lion:'shield_bearer',dragon:'shield_bearer',rose:'shield_bearer',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion'};
await r.loadRegimentArt(Object.fromEntries(Object.entries(regiments).map(([sigil,type])=>[sigil,path.join(root,'assets/regiments',sigil+'-'+type.replaceAll('_','-')+'.png')])));
await r.loadRegimentBuildings(path.join(root,'assets/regiments/production-buildings.png'));
const g=new Game({landscape:'riverlands',scale:'standard',enemies:15,seed:628410});g.units=[];g.buildings=[];g.objectives=[];g.byId.clear();g.time=30;
for(const t of g.tiles)if(t.x>=40&&t.x<=73&&t.y>=32&&t.y<=65){t.terrain='grass';t.feature=null;t.height=0;}
g.navigation.invalidate();for(const team of g.teams)team.count=0;
let number=0;const selected=new Set();
for(const team of g.teams)for(let i=0;i<100;i++){
  const type=i%4===0&&regiments[team.sigil]?regiments[team.sigil]:i%5===0?g.houseContent(team.id).unit:i%7===0?'cavalry':i%3===0?'archer':'infantry',x=48.1+(number%40)*.42,y=40.1+Math.floor(number/40)*.42;
  const u=g.addUnit(team.id,type,x,y);Object.assign(u,{facingX:1,facingY:0,motionVX:1,motionVY:0});u.order={x:70,y,mode:'move',formation:'line',facingX:1,facingY:0};if(team.id===0)selected.add(u.id);number++;
}
g.hash.rebuild(g.units);assert.equal(g.units.length,1600);
const view={x:(56.3-48.3)*28,y:(56.3+48.3)*14,w:1200,h:800,dpr:1,zoom:.95},ui={selected,selectedBuildings:new Set(),quality:'high',showGrid:false,facingPreview:{x:59.5,y:48.5,faceX:1,faceY:0,count:selected.size,formation:'line'}};
for(let i=0;i<4;i++){for(const u of g.units)u.phase+=.3;r.draw(g,view,ui);}
const times=[];
for(let i=0;i<10;i++){for(const u of g.units)u.phase+=.3;g.time=30+i/30;const start=performance.now();r.draw(g,view,ui);times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
const frames=[...Object.values(r.regimentTroopFrames).flatMap(houses=>Object.values(houses).flatMap(row=>row.frames)),...Object.values(r.regimentBuildingFrames)],bytes=frames.reduce((n,f)=>n+f.image.width*f.image.height*4,0);
assert.ok(bytes<8*1024*1024);assert.ok(r.sprites.size<1000,'Animation caches stay bounded by the loaded frames and factions.');assert.ok(times.every(Number.isFinite));
console.log(JSON.stringify({units:g.units.length,selected:selected.size,newRegimentUnits:g.units.filter(u=>u.type==='shield_bearer'||u.type==='lance_champion').length,medianMs:+times[5].toFixed(2),p95Ms:+times[9].toFixed(2),runtimeRegimentArtworkMiB:+(bytes/1024/1024).toFixed(2),cachedTroopSprites:r.sprites.size},null,2));
