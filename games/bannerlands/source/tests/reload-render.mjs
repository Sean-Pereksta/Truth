import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Renderer} from '../../render.js';
import {UNIT_DEFS,HOUSES} from '../../core.js';
import {authoredAnimationState,completeTroopFrame,paintedTroopCoverage} from '../../complete-troops.js';
import {loadRuntimePaintedArt,frameSourceKey} from './painted-art-helpers.mjs';
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP painted reload raster checks: set LANDS_CANVAS_MODULE.');process.exit(0);}
const canvas=(w=1,h=1)=>raster.createCanvas(w,h);globalThis.document={createElement:()=>canvas()};
const root=fileURLToPath(new URL('../..',import.meta.url)),manifest=await loadRuntimePaintedArt(root,raster);assert.ok(manifest,'Painted PNG manifest is required for renderer integration checks.');
const r=new Renderer(canvas(320,200)),digest=c=>createHash('sha256').update(c.getContext('2d').getImageData(0,0,c.width,c.height).data).digest('hex');
for(const [type,sigil]of [['gilded_crossbow','lion'],['tollhouse_crossbow','bridge'],['sharpshooter','fish'],['vale_sentinel','falcon']]){
 const definition=manifest.troops[type];assert.ok(definition,type+' must have an actual painted PNG entry.');
 const team=HOUSES.find(h=>h.sigil===sigil),u={id:1,type,team:0,x:0,y:0,facingX:1,facingY:0,hp:100,maxHp:100,phase:0,order:{mode:'attack'},reloading:true,vx:0,vy:0},g={time:20,teams:[team],houseContent:()=>({unit:type}),unitClass:()=> 'archer'};
 for(const stage of ['lower','span','take_bolt','seat_bolt','raise']){
  u.reload={stage,stageProgress:.5,stageDuration:1,progress:1,duration:3};const state=authoredAnimationState(u,g,UNIT_DEFS[type]),cel=completeTroopFrame(type,team,state);
  assert.equal(state.action,stage);assert.ok(cel?.painted,type+' '+stage+' must remain visible using a complete source PNG.');
  if(definition.clips[stage]){assert.equal(cel.action,stage);assert.equal(cel.draftFallback,false);}
  else{assert.equal(cel.draftFallback,true);assert.ok(paintedTroopCoverage().missingFrames.includes(type+':'+stage),'A temporary ready frame cannot be passed off as a finished reload animation.');}
 }
 u.reload={stage:'span',stageIndex:1,stageProgress:.15,stageDuration:1,progress:.5,duration:3};const first=authoredAnimationState(u,g,UNIT_DEFS[type]);u.reload.stageProgress=.85;const second=authoredAnimationState(u,g,UNIT_DEFS[type]);
 if(definition.clips.span?.[0]?.length>1)assert.notEqual(frameSourceKey(completeTroopFrame(type,team,first)),frameSourceKey(completeTroopFrame(type,team,second)),'Declared loading phases must select different source PNG cells.');
 assert.equal(completeTroopFrame(type,team,second),completeTroopFrame(type,team,second),'Pause reuses the same painted source rectangle.');
 u.vx=.1;assert.equal(authoredAnimationState(u,g,UNIT_DEFS[type]).action,'span','Minor collision shuffles cannot make an actively loading figure march.');
 u.vx=1;u.reloading=false;const empty=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(empty.action,'march');assert.equal(empty.cocked,false);assert.equal(empty.boltSeated,false);
 u.reload.stageIndex=2;const spanned=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(spanned.cocked,true);assert.equal(spanned.boltSeated,false);
 u.reload.stageIndex=4;const seated=authoredAnimationState(u,g,UNIT_DEFS[type]);assert.equal(seated.loaded,false);assert.equal(seated.cocked,true);assert.equal(seated.boltSeated,true);
 for(const [state,variant]of [[empty,'march_empty'],[spanned,'march_spanned'],[seated,'march_bolt_seated']]){
  const cel=completeTroopFrame(type,team,state);assert.ok(cel?.painted);if(definition.clips[variant])assert.equal(cel.action,variant);else assert.ok(paintedTroopCoverage().missingFrames.includes(type+':'+variant));
 }
 u.vx=0;u.reloading=true;u.releaseFrame=.1;assert.equal(authoredAnimationState(u,g,UNIT_DEFS[type]).action,'release','Release is shown before reload lowering.');
 u.releaseFrame=0;const draw=low=>{const c=canvas(200,180),ctx=c.getContext('2d');ctx.translate(90,140);r.lowDetail=low;r.unit(ctx,u,g,{selected:new Set()},1);return digest(c);};assert.equal(draw(false),draw(true),'Low detail keeps the same complete painted source art.');
 assert.equal(paintedTroopCoverage().troops[type].complete,false,'Draft sources must remain marked incomplete until per-direction animation phases and mechanics are visually verified.');
 console.log('PASS '+type+' actual PNG selection, honest draft gaps, loading interruption, release ordering, pause and low-detail parity');
}
