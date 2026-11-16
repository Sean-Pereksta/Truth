import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {COMPLETE_TROOP_TYPES,AUTHORED_BODY_VIEWS,completeTroopFrame,completeArtCacheInfo,pikeProductionFrame,TROOP_CELL,authoredAnimationState} from '../../complete-troops.js';
import {equipmentFor} from '../../equipment.js';
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP complete troop raster checks: set LANDS_CANVAS_MODULE.');process.exit(0);}
globalThis.document={createElement:()=>raster.createCanvas(1,1)};
const pixels=image=>image.getContext('2d').getImageData(0,0,image.width,image.height).data,digest=image=>createHash('sha256').update(pixels(image)).digest('hex');
const team={sigil:'wolf',color:'#8ac9e8',dark:'#234c61'};
assert.equal(new Set(AUTHORED_BODY_VIEWS.map(v=>JSON.stringify(v))).size,16,'All sixteen body views must be separately authored, including rear and diagonal silhouettes.');
const priorities=['river_ranger','sharpshooter','hill_huntsman','tollhouse_crossbow','hornhill_halberdier','vale_sentinel','winter_pikeman','thornwall_pikeman'];
const identities=priorities.map(type=>digest(completeTroopFrame(type,team,{action:'ready',directionIndex:0,directions:equipmentFor(type).directions,frame:0,equipment:equipmentFor(type)}).image));assert.equal(new Set(identities).size,priorities.length);
let cels=0;
for(const type of ['winter_pikeman','thornwall_pikeman','bridge_warden','dread_pike','crannog_spearhand','hornhill_halberdier','lance_champion','storm_rider','thorn_lancer','cavalry','dune_skirmisher']){
 const eq=equipmentFor(type),directions=eq.directions;assert.ok(directions>=8);if(eq.plantedLoss>0)assert.equal(directions,16);
 for(const action of ['ready','march','backward','turn','lower','brace','thrust','recovery','hit','death'])for(let directionIndex=0;directionIndex<directions;directionIndex++){
  const cel=completeTroopFrame(type,team,{action,directionIndex,directions,frame:4,equipment:eq}),b=cel.sourceBounds;
  const edge=pixels(cel.image);for(let x=0;x<cel.width;x++)assert.ok(edge[x*4+3]===0&&edge[((cel.height-1)*cel.width+x)*4+3]===0,`${type} ${action} direction ${directionIndex}: full weapon must fit vertically.`);for(let y=0;y<cel.height;y++)assert.ok(edge[y*cel.width*4+3]===0&&edge[(y*cel.width+cel.width-1)*4+3]===0,`${type} ${action} direction ${directionIndex}: full weapon must fit horizontally.`);
  assert.equal(cel.bodyHeight,31,'Long weapons cannot shrink the human authoring scale.');
  const data=pixels(cel.image);assert.ok(data.some((v,i)=>i%4===3&&v>0));cels++;
 }
}
const portraits=['winter_pike_hall','thornwall_drill_hall'].map((type,i)=>pikeProductionFrame(type,i?'rose':'wolf'));assert.notEqual(digest(portraits[0].image),digest(portraits[1].image));
for(const type of ['river_ranger','dune_skirmisher','saltwind_axethrower']){
 const u={type,x:0,y:0,hp:100,facingX:1,facingY:0,pendingShot:{aimProgress:.1,aimDuration:.2,kind:type==='river_ranger'?'bow':type==='dune_skirmisher'?'javelin':'axe'}},g={time:2};
 const aim=authoredAnimationState(u,g);assert.equal(aim.action,'aiming');assert.equal(aim.phase,.5);delete u.pendingShot;u.releaseFrame=.1;assert.equal(authoredAnimationState(u,g).action,'release');
 if(type==='dune_skirmisher'){
  const countForward=state=>{const cel=completeTroopFrame(type,team,state),data=pixels(cel.image);let count=0;for(let y=cel.anchorY-25;y<Math.min(cel.height,cel.anchorY+15);y++)for(let x=cel.anchorX+18;x<Math.min(cel.width,cel.anchorX+42);x++)if(y>=0&&data[(y*cel.width+x)*4+3]>0)count++;return count;};
  const base={directionIndex:0,directions:8,frame:0,equipment:equipmentFor(type)};assert.ok(countForward({...base,action:'ready'})>5);assert.equal(countForward({...base,action:'release'}),0,'A thrown javelin cannot remain painted ahead of the releasing hand.');
 }
}
assert.ok(completeArtCacheInfo().frames<=completeArtCacheInfo().maxFrames);assert.ok(COMPLETE_TROOP_TYPES.length>=30);
console.log('PASS '+cels+' complete directional long-weapon cels, eight redesign identities, unshrunk bodies, pike halls and bounded shared cache.');
