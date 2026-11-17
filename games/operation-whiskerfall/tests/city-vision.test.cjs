'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const W={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/world/city-vision.js'),'utf8'),{window:{OW:W}});
const V=W.CityVision,from={x:0,y:0},range=335,area={sightBlocks:[{x:80,y:-88,w:45,h:73},{x:80,y:16,w:45,h:69},{x:155,y:18,w:65,h:60},{x:2000,y:560,w:80,h:60}]};
let blocks=V.nearby(area,from,range);assert.equal(blocks.length,3);
const limit=(angle,source=from)=>V.limit(source,angle,blocks,range);
assert.equal(limit(0),range);assert.ok(Math.abs(limit(.31)*Math.cos(.31)-80)<1e-8);
assert.ok(Math.abs(limit(-.325)*Math.cos(.325)-80)<1e-8);assert.equal(limit(Math.PI),range);
assert.equal(limit(0,{x:125,y:35}),30);assert.equal(limit(Math.PI,{x:80,y:35}),range);
assert.equal(limit(0,{x:95,y:35}),0);assert.equal(limit(.4,{x:-600,y:-20}),range);
const cone=V.contour(from,0,.405,range,blocks);assert.ok(cone.length>=25);
for(const p of cone){const angle=Math.atan2(p.y,p.x);assert.ok(Math.abs(Math.hypot(p.x,p.y)-limit(angle))<1e-7);}
assert.ok(cone.some(p=>Math.abs(p.y)<.01&&Math.abs(p.x-range)<.01));
area.sightBlocks[1].open=true;assert.ok(Math.abs(limit(.31)*Math.cos(.31)-155)<1e-8);area.sightBlocks[1].open=false;
const gate={x:133,y:-10,w:4,h:20};area.sightBlocks=[...area.sightBlocks,gate];blocks=V.nearby(area,from,range);assert.equal(limit(0),133);
gate.enabled=false;assert.equal(limit(0),range);assert.strictEqual(blocks,V.nearby(area,{x:30,y:20},range));
for(const dt of [1/24,1/60,1/120]){
  const e={x:0,y:0,watchBearing:Math.PI-.02,angle:Math.PI-.02,watchPath:[[0,0],[110,0],[110,105]]};
  V.face(e,-Math.PI+.08,dt,1.2);assert.ok(Math.abs(Math.atan2(Math.sin(e.angle-Math.PI+.02),Math.cos(e.angle-Math.PI+.02)))<=1.2*dt+.00001);
  const g={time:0};let stand=0;const turns=[];
  const move=(g,e,p,v,dt)=>{const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);e.x+=dx/d*v*dt;e.y+=dy/d*v*dt;turns.push(p.x+','+p.y);};
  while(g.time<12){const prev={x:e.x,y:e.y};g.time+=dt;V.patrol(g,e,dt,move);if(e.x===prev.x&&e.y===prev.y)stand+=dt;}
  assert.ok(turns.includes('110,105')&&turns.includes('0,0'));assert.ok(stand>=1&&stand<8);
  V.stand(e,'aim');assert.equal(e.velocityX,0);assert.equal(e.velocityY,0);assert.equal(e.anim,'aim');
}
console.log('PASS · facade walls, set-back wings, open passage, thin door, outward and grazing rays, contour agreement, smooth facing and authored patrols at 24/60/120 Hz.');
