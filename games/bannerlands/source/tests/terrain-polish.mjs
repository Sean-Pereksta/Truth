import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {paintTerrainPolish,terrainPolishEdges,roadsideFields,preparePaintedGround,onPaintedApproach} from '../../terrain-polish.js';
import {Game} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g={W:8,H:8,tiles:[],random(){throw new Error('Terrain painting must not advance the simulation RNG.');}};
  for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++)g.tiles.push({x,y,terrain:'grass',feature:null,owner:-1});
  const at=(x,y)=>g.tiles[y*g.W+x];
  for(let x=1;x<7;x++){at(x,3).feature='road';at(x,3).featureAxis='x';}
  for(let y=4;y<7;y++)for(let x=1;x<4;x++)at(x,y).terrain='forest';
  for(let y=0;y<8;y++)at(7,y).terrain='water';
  at(6,1).terrain='water';at(6,1).feature='ford';
  at(6,3).terrain='water';at(6,3).feature='bridge';
  at(5,5).terrain='mountain';at(5,5).feature='pass';
  return g;
}

test('Transition eligibility distinguishes exposed road, forest and land-side shoreline edges',()=>{
  const g=fixture(),at=(x,y)=>g.tiles[y*g.W+x];
  const road=terrainPolishEdges(g,at(3,3));assert.equal(road.road,true);assert.deepEqual(road.shoulders,[true,false,true,false]);
  const tree=terrainPolishEdges(g,at(2,4));assert.equal(tree.forest.some(Boolean),false,'Road adjacency belongs to shoulder treatment.');
  const forest=terrainPolishEdges(g,at(1,5));assert.equal(forest.forest[3],true);
  const shore=terrainPolishEdges(g,at(6,5));assert.equal(shore.shore[1],true);
  assert.equal(terrainPolishEdges(g,at(6,2)).shore[0],false,'Do not decorate a crossing approach as a water bank.');
});
test('Water, mountains, bridge decks, fords and passes never receive terrain polish',()=>{
  const g=fixture();for(const t of g.tiles)if(t.terrain==='water'||t.terrain==='mountain'||['bridge','ford','pass'].includes(t.feature))assert.equal(terrainPolishEdges(g,t),null);
});

test('Willow Bridge narrows into the meadow while its public road stays fully walkable',()=>{
  const g=new Game({landscape:'riverlands',scale:'standard',seed:44277,enemies:1});
  const ground=preparePaintedGround(g,{sliceGround:{}});
  assert.equal(g.tileAt(37.5,20.5).feature,'road');
  assert.ok(g.isWalkable(37.5,20.5));
  assert.ok(!onPaintedApproach(ground,37.5,20.5),'Outside corner of the maneuvering area is grass.');
  assert.ok(onPaintedApproach(ground,37.5,18.5),'Dirt reaches the painted bridge ramp.');
  assert.ok(onPaintedApproach(ground,34.5,17.5),'The dirt track continues past the former square end.');
  assert.ok(!onPaintedApproach(ground,31.5,17.5),'The travelled dirt has faded by the woodland.');
});

test('Wet road marks are deterministic and follow land on both sides of Riverlands crossings',()=>{
  const make=landscape=>new Game({landscape,scale:'standard',seed:44277,enemies:1});
  const material={sliceGround:{}},g=make('riverlands'),before=JSON.stringify(g.tiles);
  const weather=preparePaintedGround(g,material).weather;
  assert.ok(weather.mud.some(bank=>bank.axis==='x'));
  assert.ok(weather.mud.some(bank=>bank.axis==='y'));
  for(const bank of weather.mud){
    assert.equal(g.tileAt(bank.x,bank.y).terrain==='water',false);
  }
  for(const ford of g.landmarks.filter(mark=>mark.kind==='ford')){
    const alongX=ford.axis==='x',axis=alongX?'x':'y',across=alongX?'y':'x';
    for(const sign of [-1,1])assert.ok(weather.mud.some(bank=>bank.axis===ford.axis&&bank.sign===sign&&bank[across]===ford[across]&&
      (bank[axis]-ford[axis])*sign>0&&Math.abs(bank[axis]-ford[axis])<ford.length+2),ford.name);
  }
  assert.equal(JSON.stringify(g.tiles),before);
  assert.equal(preparePaintedGround(g,material).weather,weather);
  assert.deepEqual(preparePaintedGround(make('riverlands'),material).weather.mud,weather.mud);
  assert.deepEqual(preparePaintedGround(make('highlands'),material).weather.mud,[]);
});

const require=createRequire(import.meta.url);let raster;
test('Roadside parcels follow permanent roads and spare every non-grass or obstructed tile',()=>{
  const g=fixture();g.landscape={id:'riverlands'};
  for(const t of g.tiles){t.terrain='grass';t.feature=t.y===1?'road':null;}
  const fields=roadsideFields(g);
  assert.ok(fields.some(v=>v&16));
  for(const t of g.tiles)if(fields[t.y*g.W+t.x])assert.equal(t.feature,null);
  const blocked=g.tiles.find(t=>fields[t.y*g.W+t.x]);blocked.terrain='hill';
  assert.equal(roadsideFields(g)[blocked.y*g.W+blocked.x],0);
  g.landscape.id='open';assert.equal(roadsideFields(g),null);
});
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP terrain-polish raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');}
if(raster){
  const canvas=()=>{const a=raster.createCanvas(560,270),c=a.getContext('2d');c.translate(250,10);return {a,c};};
  const pixels=a=>a.getContext('2d').getImageData(0,0,a.width,a.height).data;
  const alphaAt=(a,x,y)=>{const sx=Math.floor(250+(x-y)*28),sy=Math.floor(10+(x+y)*14);return a.getContext('2d').getImageData(sx,sy,1,1).data[3];};
  test('Painting is deterministic, preserves caller state and never changes terrain or game RNG',()=>{
    const g=fixture(),before=JSON.stringify(g.tiles),first=canvas(),second=canvas(),matrix=first.c.getTransform();
    first.c.fillStyle='#ff0099';const a=paintTerrainPolish(first.c,g),b=paintTerrainPolish(second.c,g);
    assert.deepEqual(a,b);assert.deepEqual(pixels(first.a),pixels(second.a));assert.equal(JSON.stringify(g.tiles),before);
    // The native canvas getter reports the last assigned string after restore;
    // verify its actual restored paint state with a fresh pixel instead.
    assert.deepEqual(first.c.getTransform(),matrix);first.c.fillRect(-250,-10,1,1);
    assert.deepEqual([...first.c.getImageData(0,0,1,1).data],[255,0,153,255]);
    assert.ok(a.roadEdges>0&&a.forestEdges>0&&a.shoreEdges>0&&a.ruts>0);
    for(const t of g.tiles)if(t.terrain==='water'||t.terrain==='mountain')assert.equal(alphaAt(first.a,t.x+.5,t.y+.5),0);
  });
  test('Road color reads cool in the north and dusty in the south, sparing the crossing deck',()=>{
    const g=fixture(),{a,c}=canvas();
    for(const t of g.tiles)if(t.terrain==='grass'&&t.x>0&&t.x<7&&[1,6].includes(t.y))t.feature='road';
    paintTerrainPolish(c,g);
    function pixel(x,y){
      return a.getContext('2d').getImageData(Math.floor(250+(x-y)*28),Math.floor(10+(x+y)*14),1,1).data;
    }
    const north=pixel(4.5,1.5),south=pixel(4.5,6.5);
    assert.ok(north[2]>north[0]&&north[3]>0,'The northern road receives cool slate hues.');
    assert.ok(south[0]>south[2]&&south[3]>0,'The southern road receives ochre dust hues.');
    assert.equal(pixel(6.5,3.5)[3],0,'The crossing deck stays clear of the road weather layer.');
  });
  test('The bake scans only its requested exclusive tile range and reads a bounded neighbor halo',()=>{
    const g=fixture(),base=g.tiles;let reads=0;g.tiles=new Proxy(base,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key);}});
    const {c}=canvas(),stats=paintTerrainPolish(c,g,{x0:2,y0:2,x1:4,y1:4});assert.equal(stats.tiles,4);assert.ok(reads<=24,'A 2×2 chunk must not scan the full map.');
  });
  test('Overview baking retains broad transitions while omitting fine wheel ruts',()=>{
    const g=fixture(),{a,c}=canvas(),stats=paintTerrainPolish(c,g,{}, {detail:'overview'});
    assert.equal(stats.ruts,0);assert.ok(stats.roadEdges>0&&stats.forestEdges>0&&stats.shoreEdges>0);
    assert.ok(pixels(a).some((v,i)=>i%4===3&&v>0));
  });
  test('Adjacent chunk bakes keep the same interior detail as one full-map bake',()=>{
    const g=fixture(),whole=canvas(),chunks=canvas();paintTerrainPolish(whole.c,g);
    for(let y=0;y<8;y+=4)for(let x=0;x<8;x+=4)paintTerrainPolish(chunks.c,g,{x0:x,y0:y,x1:x+4,y1:y+4});
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(const [u,v]of [[.25,.25],[.5,.5],[.75,.75]]){
      const sx=Math.floor(250+(x+u-y-v)*28),sy=Math.floor(10+(x+u+y+v)*14);
      assert.deepEqual(whole.c.getImageData(sx,sy,1,1).data,chunks.c.getImageData(sx,sy,1,1).data);
    }
  });
}
console.log(`${checks} terrain-polish checks passed.`);
