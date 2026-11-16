import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setPaintedTroopAtlases,completeTroopFrame,hasCompleteTroopArt,paintedTroopCoverage,completeArtCacheInfo,authoredAnimationState} from '../../complete-troops.js';
import {Renderer} from '../../render.js';
const require=createRequire(import.meta.url);let raster;
try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP painted PNG renderer checks: set LANDS_CANVAS_MODULE.');process.exit(0);}
const root=fileURLToPath(new URL('../..',import.meta.url)),source='assets/houses/fish-troops.png',image=await raster.loadImage(path.join(root,source));
const dirs=Array.from({length:8},(_,cell)=>[{sheet:'main',cell}]);
const manifest={version:1,troops:{painted_fixture:{directions:8,bodyHeight:31,sheets:{main:{src:source,columns:4,rows:2,sourceBodyHeight:320,anchor:[.5,.88]}},clips:{ready:dirs,thrust:dirs}}}};
setPaintedTroopAtlases(manifest,new Map([[source,image]]));
assert.equal(hasCompleteTroopArt('infantry'),false,'Unaffected ordinary troops must retain the original generated PNG atlas.');
assert.equal(hasCompleteTroopArt('painted_fixture'),true);
globalThis.document={createElement:()=>{throw Error('Selecting painted troop frames must never draw a substitute figure or construct a new canvas.');}};
for(let directionIndex=0;directionIndex<8;directionIndex++){
 const cel=completeTroopFrame('painted_fixture',{}, {action:'ready',directionIndex,directions:8,frame:0,phase:0});
 assert.equal(cel.image,image,'The visible figure must come directly from the image-generated source PNG.');assert.equal(cel.painted,true);assert.equal(cel.bodyHeight,31);assert.equal(cel.scale,31/320);
 assert.equal(cel.sx,Math.floor(directionIndex%4*image.width/4));assert.equal(cel.sy,Math.floor(Math.floor(directionIndex/4)*image.height/2));
 assert.ok(cel.sw>100&&cel.sh>100);assert.equal(completeTroopFrame('painted_fixture',{}, {action:'ready',directionIndex,directions:8,frame:0,phase:0}),cel);
}
assert.equal(completeTroopFrame('painted_fixture',{}, {action:'span',directionIndex:0,directions:8,frame:0}),null,'Missing authored actions cannot invent weapons, limbs or reload mechanisms.');
assert.ok(paintedTroopCoverage().missingFrames.includes('painted_fixture:span'));
assert.equal(paintedTroopCoverage().troops.painted_fixture.complete,false,'An incomplete painted sheet must not be reported as full animation coverage.');
assert.ok(completeArtCacheInfo().hits>=8);
const empty={type:'gilded_crossbow',x:0,y:0,hp:100,facingX:1,facingY:0,vx:1,reloading:false,reload:{stageIndex:1,stage:'span'}},g={time:1};
assert.equal(authoredAnimationState(empty,g).cocked,false);assert.equal(authoredAnimationState(empty,g).boltSeated,false);empty.reload.stageIndex=2;assert.equal(authoredAnimationState(empty,g).cocked,true);assert.equal(authoredAnimationState(empty,g).boltSeated,false);empty.reload.stageIndex=4;assert.equal(authoredAnimationState(empty,g).boltSeated,true);
globalThis.document={createElement:()=>raster.createCanvas(1,1)};
const renderer=new Renderer(raster.createCanvas(100,100));renderer.setTroopAtlas(await raster.loadImage(path.join(root,'assets/troops-atlas.png')));
const calls=[],original=renderer.soldierSprite.bind(renderer);renderer.soldierSprite=(...args)=>{calls.push(args);return original(...args);};
renderer.unit(raster.createCanvas(100,100).getContext('2d'),{id:1,type:'infantry',team:0,x:0,y:0,hp:100,maxHp:100,facingX:1,facingY:0,phase:0},{time:0,teams:[{color:'#8ac9e8',dark:'#234c61'}],unitClass:()=> 'infantry'},{selected:new Set()},1);
assert.equal(calls[0][0],'infantry','Unchanged troops must flow through the original painted sprite renderer.');
const code=fs.readFileSync(path.join(root,'complete-troops.js'),'utf8');assert.ok(!/paintCompleteCel|AUTHORED_BODY_VIEWS|quadraticCurveTo|\.fillRect\(|\.ellipse\(/.test(code),'The troop selector may not contain a shape-drawn character generator.');
console.log('PASS native PNG selection, exact cells, stable body scale, no procedural figure fallback, honest missing coverage, loading metadata and restored ordinary troop artwork.');
