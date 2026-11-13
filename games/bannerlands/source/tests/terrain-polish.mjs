import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {paintTerrainPolish,terrainPolishEdges} from '../../terrain-polish.js';

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

const require=createRequire(import.meta.url);let raster;
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
