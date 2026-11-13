import assert from 'node:assert/strict';
import {Renderer} from '../../render.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g={W:3,H:2,time:0,config:{fogOfWar:false},teams:[{color:'#102030'},{color:'#a0b0c0'}],tiles:[]};
  for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++)g.tiles.push({x,y,owner:-1,blocked:false});
  g.isWalkable=(x,y)=>!g.tiles[Math.floor(y)*g.W+Math.floor(x)].blocked;
  const r=new Renderer({getContext:()=>({})});let uploads=0;
  r.ownerPixels={getContext:()=>({putImageData(){uploads++;}})};
  r.ownerImageData={data:new Uint8ClampedArray(g.W*g.H*4)};
  return {g,r,get uploads(){return uploads;},refresh(){g.time+=.55;r.updateTerritory(g);},pixel(index){return [...r.ownerImageData.data.slice(index*4,index*4+4)];}};
}

test('Adjacent owned tiles retain exact colors and expose only their outside edges',()=>{
  const f=fixture(),{g,r}=f;g.tiles[0].owner=0;g.tiles[1].owner=0;g.tiles[4].owner=1;f.refresh();
  assert.deepEqual(f.pixel(0),[16,32,48,255]);assert.deepEqual(f.pixel(4),[160,176,192,255]);assert.deepEqual(f.pixel(5),[0,0,0,0]);
  const edge=(x1,y1,x2,y2,color='#102030')=>({x1,y1,x2,y2,color});
  assert.deepEqual(r.territoryEdges,[
    edge(0,0,28,14),edge(0,28,-28,14),edge(-28,14,0,0),
    edge(28,14,56,28),edge(56,28,28,42),edge(28,42,0,28),
    edge(0,28,28,42,'#a0b0c0'),edge(28,42,0,56,'#a0b0c0'),edge(0,56,-28,42,'#a0b0c0'),edge(-28,42,0,28,'#a0b0c0')
  ]);
});

test('Unchanged territory avoids pixel uploads, edge allocation and minimap invalidation',()=>{
  const f=fixture(),{g,r}=f;g.tiles[0].owner=0;f.refresh();const edges=r.territoryEdges,revision=r.minimapRevision;
  for(let i=0;i<120;i++)f.refresh();
  assert.equal(f.uploads,1);assert.equal(r.territoryEdges,edges);assert.equal(r.minimapRevision,revision);assert.equal(r.territoryTime,g.time);
  g.tiles[1].owner=0;f.refresh();assert.equal(f.uploads,2);assert.equal(r.minimapRevision,revision+1);assert.notEqual(r.territoryEdges,edges);
  g.tiles[0].owner=-1;f.refresh();assert.deepEqual(f.pixel(0),[0,0,0,0]);
});

test('Fog territory refreshes from remembered ownership without leaking hidden changes',()=>{
  const f=fixture(),{g,r}=f,known=new Int16Array(6).fill(-1);g.config.fogOfWar=true;g.vision={ownersFor:()=>known};known[0]=0;f.refresh();const revision=r.minimapRevision;
  g.tiles[0].owner=1;g.tiles[1].owner=1;f.refresh();assert.equal(r.minimapRevision,revision);assert.deepEqual(f.pixel(0),[16,32,48,255]);assert.deepEqual(f.pixel(1),[0,0,0,0]);
  known[0]=1;f.refresh();assert.equal(r.minimapRevision,revision+1);assert.deepEqual(f.pixel(0),[160,176,192,255]);
  known[0]=-1;f.refresh();assert.deepEqual(f.pixel(0),[0,0,0,0]);
});

test('Passability, palette, new maps and replaced pixel buffers invalidate cached territory',()=>{
  const f=fixture(),{g,r}=f;g.tiles[0].owner=0;f.refresh();g.tiles[0].blocked=true;f.refresh();assert.deepEqual(f.pixel(0),[0,0,0,0]);assert.deepEqual(r.territoryEdges,[]);
  g.tiles[0].blocked=false;g.teams[0].color='#abcdef';f.refresh();assert.deepEqual(f.pixel(0),[171,205,239,255]);assert.ok(r.territoryEdges.every(e=>e.color==='#abcdef'));
  r.ownerImageData={data:new Uint8ClampedArray(24)};f.refresh();assert.deepEqual(f.pixel(0),[171,205,239,255]);
  const other=fixture();other.g.tiles[1].owner=1;r.updateTerritory(other.g);assert.deepEqual(f.pixel(0),[0,0,0,0]);assert.deepEqual(f.pixel(1),[160,176,192,255]);
});

console.log(`${checks} territory rendering performance checks passed.`);
