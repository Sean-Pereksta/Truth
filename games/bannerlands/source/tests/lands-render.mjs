import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Game} from '../../core.js';
import {Renderer} from '../../render.js';
import {LAND_MAPS} from '../../lands.js';

// Optional raster integration: npm install --no-save @napi-rs/canvas, or point
// LANDS_CANVAS_MODULE at an existing installation. No browser or game dependency.
const require=createRequire(import.meta.url);
let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP raster renderer checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output)fs.mkdirSync(output,{recursive:true});
const canvas=(w=1,h=1)=>{const c=raster.createCanvas(w,h);c.style={};c.getBoundingClientRect=()=>({width:c.width,height:c.height,left:0,top:0});return c;};
globalThis.Image=raster.Image;
globalThis.window={devicePixelRatio:1};
globalThis.document={createElement:kind=>{assert.equal(kind,'canvas');return canvas();},getElementById:()=>null};
const image=async name=>raster.loadImage(path.join(root,name));
const renderer=new Renderer(canvas(1400,900));
renderer.setTerrainAtlases(await image('assets/ground-textures.png'),await image('assets/terrain-props.png'));
await renderer.loadLandsArt(path.join(root,'assets/lands-atlas.png'));
await renderer.loadLandsGround(path.join(root,'assets/lands-ground.png'));
renderer.setTroopAtlas(await image('assets/troops-atlas.png'));
await renderer.loadStructures(path.join(root,'assets/structures-atlas.png'));
await renderer.loadCampaignArt(path.join(root,'assets/campaign-structures.png'));
let cases=0;
const test=(label,fn)=>{fn();cases++;console.log('PASS '+label);};
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(Math.floor(x),Math.floor(y),1,1).data];
const save=(name,c)=>{if(output)fs.writeFileSync(path.join(output,name),c.toBuffer('image/png'));};
const ui={selected:new Set(),selectedBuildings:new Set(),quality:'high',formation:'line',showGrid:false,hover:null};
const view=(g,zoom=.3,x=g.W*.5,y=g.H*.5)=>({x:(x-y)*28,y:(x+y)*14,w:1400,h:900,dpr:1,zoom});

test('All eight landscape sprites extract nonempty artwork within their atlas cells',()=>{
  assert.equal(Object.keys(renderer.landsFrames).length,8);
  for(const f of Object.values(renderer.landsFrames)){
    assert.ok(f.width>20&&f.height>20);assert.ok(f.left>=0&&f.top>=0);
    assert.ok(f.left+f.width<=f.image.width&&f.top+f.height<=f.image.height);
  }
});
test('All new ground materials use nonempty raster texture cells',()=>{
  assert.deepEqual(Object.keys(renderer.landsGroundFrames),['water','road','bridge','ford','pass','mountain','bank','timber']);
  for(const [kind,texture]of Object.entries(renderer.landsGroundFrames)){
    assert.ok(texture.width>100&&texture.height>100,kind+' has real texture resolution');
    const colors=new Set();for(let y=1;y<texture.height;y+=17)for(let x=1;x<texture.width;x+=17)colors.add(pixel(texture,x,y).join(','));
    assert.ok(colors.size>40,kind+' retains illustrated texture variation.');
  }
});

const bridge=new Game({landscape:'open',scale:'standard',enemies:1,seed:44277});
bridge.units=[];bridge.buildings=[];bridge.objectives=[];bridge.byId.clear();bridge.time=30;
for(const t of bridge.tiles){t.owner=-1;t.feature=null;t.terrain=t.x===0||t.y===0||t.x===bridge.W-1||t.y===bridge.H-1?'water':'grass';}
for(const t of bridge.tiles)if(t.x>=46&&t.x<=52&&t.y>0&&t.y<bridge.H-1)t.terrain='water';
for(const t of bridge.tiles)if(t.x>=46&&t.x<=52&&t.y>=40&&t.y<=44){t.feature='bridge';t.featureAxis='x';t.owner=0;}
bridge.landmarks=[{id:'test-crossing',kind:'bridge',name:'Broad Stone Crossing',x:49.5,y:42.5,axis:'x',width:5,length:7}];

test('A five-tile crossing draws deck across every passable lane, including tile corners',()=>{
  for(let y=40;y<=44;y++)for(let x=46;x<=52;x++){
    assert.ok(bridge.isWalkable(x+.5,y+.5));const sprite=renderer.landsTileSprite(bridge,bridge.tileAt(x+.5,y+.5));
    for(const [u,v]of [[.1,.1],[.9,.1],[.1,.9],[.9,.9],[.5,.5]]){
      const [r,g,b,a]=pixel(sprite,(28+(u-v)*28+1)*2,((u+v)*14+1)*2);
      assert.ok(a>200&&r>55&&r>b*.95,`Missing deck at ${x},${y} offset ${u},${v}: ${r},${g},${b},${a}`);
    }
  }
});

test('Crossing direction uses the same world axes as generation for both orientations',()=>{
  const middle=bridge.tileAt(49.5,42.5),edge=bridge.tileAt(49.5,40.5);
  const at=(sprite,u,v)=>pixel(sprite,(28+(u-v)*28+1)*2,((u+v)*14+1)*2);
  const a=renderer.landsTileSprite(bridge,middle),b=renderer.landsTileSprite(bridge,edge);save('bridge-tile.png',a);
  assert.notDeepEqual(at(a,.5,.015),at(b,.5,.015),'The outer edge has a parapet; interior lane seams do not.');
  for(const t of bridge.tiles)if(t.feature==='bridge')t.featureAxis='y';
  renderer.terrainTileSprites.clear();
  const c=renderer.landsTileSprite(bridge,bridge.tileAt(46.5,42.5));
  assert.notDeepEqual(at(c,.015,.5),at(a,.015,.5),'Rotating the crossing rotates the outside parapet.');
  for(const t of bridge.tiles)if(t.feature==='bridge')t.featureAxis='x';
  renderer.terrainTileSprites.clear();
});

test('Rendered minimap keeps a controlled bridge visible above ownership colors',()=>{
  renderer.prepare(bridge);const mini=canvas(560,300),v=view(bridge,.8,49.5,42.5);renderer.drawMinimap(bridge,mini,v);
  const m=renderer.minimapTransform,x=(49.5-42.5)*28*m.scale+m.ox,y=(49.5+42.5)*14*m.scale+m.oy;
  const [r,g,b]=pixel(mini,x,y);assert.ok(r>140&&g>135&&r>b,'The owned crossing retains its light stone minimap color.');
  save('bridge-minimap.png',mini);
});

test('Wide bridge and bank graphics render coherently at battlefield scale',()=>{
  renderer.cachedGame=null;renderer.draw(bridge,view(bridge,1.2,49.5,42.5),ui);save('wide-bridge.png',renderer.canvas);
  const rgba=renderer.ctx.getImageData(0,0,renderer.canvas.width,renderer.canvas.height).data;let stone=0,water=0;
  for(let i=0;i<rgba.length;i+=4){if(rgba[i]>130&&rgba[i+1]>120&&rgba[i]>rgba[i+2]*1.1)stone++;if(rgba[i+2]>rgba[i]*1.5&&rgba[i+1]>rgba[i]*1.3)water++;}
  assert.ok(stone>2000&&water>2000,'Both the wide deck and surrounding river remain visible.');
});

test('Sixty real soldiers cross on the drawn deck throughout the movement simulation',()=>{
  for(const s of bridge.teams){s.count=0;s.aiClock=1e9;s.gold=0;s.income=0;}
  bridge.addBuilding(0,'keep',30.5,42.5);bridge.addBuilding(1,'keep',80.5,42.5);
  const force=[];for(let i=0;i<60;i++)force.push(bridge.addUnit(0,i<8?'cavalry':i<12?'archer':'infantry',40.5-Math.floor(i/10)*.46,40.3+(i%10)*.46));
  bridge.navigation.invalidate();bridge.hash.rebuild(bridge.units);bridge.command(force.map(u=>u.id),60.5,42.5,'move','line');
  let mostOnDeck=0;const frames=new Set([90,180,270,360,480,660]);
  for(let i=0;i<=660;i++){
    if(i)bridge.update(1/30);
    let onDeck=0;for(const u of force){const tile=bridge.tileAt(u.x,u.y);if(tile.terrain==='water'){assert.equal(tile.feature,'bridge','A soldier in the river stands on the drawn bridge surface.');onDeck++;}}
    mostOnDeck=Math.max(mostOnDeck,onDeck);
    if(frames.has(i)){renderer.draw(bridge,view(bridge,1.2,49.5,42.5),ui);save('troops-crossing-'+String(i/30).padStart(2,'0')+'s.png',renderer.canvas);}
  }
  assert.ok(mostOnDeck>=12,'The crossing carries a substantial company at once.');
  assert.ok(force.filter(u=>u.x>53).length>=45,'Most of the company reaches the opposite bank.');
});

for(const map of LAND_MAPS)test(map.label+' renders terrain, landmarks, armies and minimap at overview and close range',()=>{
  const g=new Game({landscape:map.id,scale:'standard',enemies:3,seed:628410}),v=view(g,.31);
  renderer.cachedGame=null;renderer.draw(g,v,ui);save(map.id+'-overview.png',renderer.canvas);
  const landmark=g.landmarks.find(l=>l.kind==='pass')||g.landmarks.find(l=>l.kind==='bridge')||g.teams[0].home;
  renderer.draw(g,view(g,.85,landmark.x,landmark.y),ui);save(map.id+'-terrain.png',renderer.canvas);
  renderer.draw(g,view(g,1,g.teams[0].home.x,g.teams[0].home.y),ui);
  const mini=canvas(560,300);renderer.drawMinimap(g,mini,v);save(map.id+'-minimap.png',mini);
  assert.ok(renderer.terrainTileSprites.size>5);assert.ok(renderer.decor.length>50);
  assert.equal(renderer.assetError,null);
});
console.log(cases+' raster landscape rendering checks passed.');
if(output)console.log('Saved landscape previews to '+output);
// Native canvas can keep image-decoder worker handles alive after rendering.
process.exit(0);
