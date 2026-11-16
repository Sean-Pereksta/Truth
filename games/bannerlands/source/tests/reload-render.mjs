import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {Renderer} from '../../render.js';
import {UNIT_DEFS,HOUSES} from '../../core.js';
import {authoredAnimationState,completeTroopFrame} from '../../complete-troops.js';
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
catch{console.log('SKIP complete-cel reload raster checks: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);globalThis.document={createElement:()=>canvas()};
const r=new Renderer(canvas(320,200)),digest=c=>createHash('sha256').update(c.getContext('2d').getImageData(0,0,c.width,c.height).data).digest('hex');
const entries=[['gilded_crossbow','lion'],['tollhouse_crossbow','bridge'],['sharpshooter','fish'],['vale_sentinel','falcon']];
const stages=['lower','span','take_bolt','seat_bolt','raise'];
for(const [type,sigil]of entries){
 const team=HOUSES.find(h=>h.sigil===sigil),u={id:1,type,team:0,x:0,y:0,facingX:1,facingY:0,hp:100,maxHp:100,phase:0,order:{mode:'attack'},reloading:true,vx:0,vy:0},g={time:20,teams:[team],houseContent:()=>({unit:type}),unitClass:()=> 'archer'};
 const signatures=[];
 for(const stage of stages){u.reload={stage,stageProgress:.5,stageDuration:1,progress:1,duration:3};const state=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(state.action,stage);signatures.push(digest(completeTroopFrame(type,team,state).image));}
 assert.equal(new Set(signatures).size,stages.length,'Every physical loading stage must select a distinct complete body/weapon cel.');
 u.reload={stage:'span',stageProgress:.15,stageDuration:1,progress:.5,duration:3};const first=authoredAnimationState(u,g,UNIT_DEFS[type]);u.reload.stageProgress=.65;const second=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.notEqual(digest(completeTroopFrame(type,team,first).image),digest(completeTroopFrame(type,team,second).image),'The authored stage contains actual hand and mechanism motion.');
 assert.equal(completeTroopFrame(type,team,second),completeTroopFrame(type,team,second),'Paused state reuses the identical immutable cel.');
 u.vx=.1;assert.equal(authoredAnimationState(u,g,UNIT_DEFS[type]).action,'span','Minor collision shuffles cannot display marching while physical reload work continues.');u.vx=1;u.reloading=false;const walking=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(walking.action,'march');
 u.vx=0;u.reloading=true;u.releaseFrame=.1;assert.equal(authoredAnimationState(u,g,UNIT_DEFS[type]).action,'release','Exactly-once release presentation precedes lower/reload even when reload state already exists.');
 u.releaseFrame=0;const draw=low=>{const c=canvas(200,180),ctx=c.getContext('2d');ctx.translate(90,140);r.lowDetail=low;r.unit(ctx,u,g,{selected:new Set()},1);return digest(c);};assert.equal(draw(false),draw(true),'Economy detail retains the same complete equipment and physical pose.');
 u.facingX=-1;const reversed=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.notEqual(reversed.directionIndex,second.directionIndex);
 u.facingX=1;u.vx=1;u.reloading=false;u.reload={stage:'span',stageIndex:1,stageProgress:0,stageDuration:1,progress:.4,duration:3};
 const emptyTravel=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(emptyTravel.loaded,false);assert.equal(emptyTravel.cocked,false);assert.equal(emptyTravel.boltSeated,false);const emptyCel=digest(completeTroopFrame(type,team,emptyTravel).image);
 u.reload.stageIndex=2;const spannedTravel=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(spannedTravel.cocked,true);assert.equal(spannedTravel.boltSeated,false);assert.notEqual(digest(completeTroopFrame(type,team,spannedTravel).image),emptyCel,'Completed spanning stays visible while the empty crossbow is carried.');
 u.reload.stageIndex=4;const seatedTravel=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(seatedTravel.loaded,false);assert.equal(seatedTravel.cocked,true);assert.equal(seatedTravel.boltSeated,true);const seatedCel=digest(completeTroopFrame(type,team,seatedTravel).image);assert.notEqual(seatedCel,digest(completeTroopFrame(type,team,spannedTravel).image),'Interrupting the raise stage must retain the already seated physical bolt while carrying.');
 u.reload=null;const loadedTravel=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(loadedTravel.loaded,true);assert.equal(loadedTravel.cocked,true);assert.equal(loadedTravel.boltSeated,true);assert.equal(digest(completeTroopFrame(type,team,loadedTravel).image),seatedCel,'The completed physical loading stages must survive their carrying animation.');assert.notEqual(digest(completeTroopFrame(type,team,loadedTravel).image),digest(completeTroopFrame(type,team,spannedTravel).image),'A crossbow without a seated bolt must remain visibly empty.');
 u.vx=0;const ready=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(ready.cocked,true);assert.notEqual(digest(completeTroopFrame(type,team,ready).image),digest(completeTroopFrame(type,team,{...ready,cocked:false}).image),'The loaded ready cel must visibly hold its string at the nut.');
 console.log('PASS '+type+' complete reload stages, interruption, release ordering, pause, direction and economy rendering');
}
