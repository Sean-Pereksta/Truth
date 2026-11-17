'use strict';
// Terrain visibility and ordering with centers outside the camera, and the
// world cell traversal shared by generation and drawing. No browser required.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{},Map,Set,WeakMap};
vm.createContext(box);
for(const name of ['world','renderer']){
  const source=fs.readFileSync(path.resolve(__dirname,'../js/world/'+name+'.js'),'utf8');
  vm.runInContext(source,box);
}
const {Renderer,World}=box.window.OW;
const r=Object.create(Renderer.prototype),v={x:800,y:1600,w:1280,h:720};
r.view={...v};r.terrainView={...v};r.patterns=[];r.clock=5;
const draws=[],noop=()=>{};
r.groundChunk=()=>null;
r.ctx={drawImage:noop,strokeRect:noop,save:noop,restore:noop,setLineDash:noop};
r.path=(points,width,color)=>draws.push([points.tag,width,color]);
r.drawBridge=b=>draws.push([b.id]);
r.drawGroundDetail=d=>draws.push([d.id]);
const points=(tag,...coords)=>Object.assign(coords.map(([x,y])=>({x,y})),{tag});
const roads=[
  {width:38,kind:'trail',points:points('bend',[200,900],[1200,1780],[400,920])},
  {width:18,kind:'local',points:points('lane',[700,1615],[1900,2020])},
  {width:80,kind:'highway',points:points('far',[9000,9000],[9800,9600])}
];
const w={width:20000,height:16000,roads,
  rivers:[{id:'edge',width:210,points:points('bank',[500,1495],[2600,1495])},{id:'dry',width:65,points:points('dry',[2000,100],[3900,200])}],
  groundDetails:[{id:'huge',type:'plaza',x:2500,y:1890,w:940,h:780},{id:'outside',type:'campYard',x:4500,y:270,w:780,h:400}],
  bridges:[{id:'angled',x:2155,y:1830,w:690,h:90,angle:.43}]};
r.drawTerrain(w);
assert.deepEqual(draws.map(d=>d[0]),['bank','bank','bank','bank','bank','huge','bend','lane','bend','bend','lane','lane','angled']);
assert.equal(draws[6][2],draws[7][2],'all verges paint before any surface');
const initial=r.terrainNeighborhood;
r.terrainView={...v,x:v.x+100};draws.length=0;r.drawTerrain(w);
assert.equal(r.terrainNeighborhood,initial,'small movements reuse nearby geography');
r.terrainView={...v,x:8700,y:8860};draws.length=0;r.drawTerrain(w);
assert.notEqual(r.terrainNeighborhood,initial);assert.deepEqual(draws.map(d=>d[0]),['far','far','far','far']);
w.roads.push({width:25,kind:'local',points:points('new',[9020,9001],[9110,9014])});
draws.length=0;r.drawTerrain(w);assert(draws.some(d=>d[0]==='new'),'a new route expands the visible candidates');
const other={...w,roads:[{...w.roads[3],points:points('other',[9020,9001],[9110,9014])}]};
draws.length=0;r.drawTerrain(other);assert(draws.every(d=>d[0]==='other'),'replacing the world invalidates candidates');
const real=Object.create(World.prototype);
Object.assign(real,{_objectChunks:new Map(),objects:[],regionAt:()=>({index:0})});
for(const [id,x,y,width,height] of [['large',1300,2100,820,530],['a',1250,2150,95,95],['b',1299,2150,240,115],['far',9200,6500,32,32]]){
  real._addObject({id,type:'building',x,y,w:width,h:height});
}
const visible=[],seen=new Set();
for(const rect of [[750,1700,1280,720],[1000,1950,840,460],[7500,3600,160,180],[9150,6460,250,250]]){
  const previous=Array.from(real.getVisibleObjects(...rect),o=>o.id);
  assert.equal(real.getVisibleObjects(...rect,visible,seen),visible);
  assert.deepEqual(visible.map(o=>o.id),previous);
  assert.equal(new Set(visible).size,visible.length);
}
console.log('Scenery visibility passed: intersecting bends and banks, oversized ground, rotated bridge, layer order, camera travel, added roads and chunk-object order.');
