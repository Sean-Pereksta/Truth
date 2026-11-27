import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UNIT_DEFS,HOUSES} from '../../core.js';
import {atlasPose,atlasPoses,attackFacing,attackFacingRow,directionalAnchor,facingRow,stableFacingRow} from '../../directional-art.js';
import {directionalSheets} from '../../directional-sheets.js';

const headings=[[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];
assert.deepEqual(headings.map(([x,y])=>facingRow(x,y)),[0,1,2,3,4,5,6,7]);
function bearing(octant){
  const angle=octant*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle);
  return [x+y,y-x];
}
assert.equal(stableFacingRow(...bearing(.53)),1);
assert.equal(stableFacingRow(...bearing(.53),0),0);
assert.equal(stableFacingRow(...bearing(.47),1),1);
assert.equal(stableFacingRow(...bearing(.65),0),1);
assert.equal(stableFacingRow(...bearing(-.53),0),0);
assert.equal(stableFacingRow(...bearing(-.65),0),7);
assert.equal(stableFacingRow(...bearing(3),0),3);
assert.equal(stableFacingRow(0,0,6),6);
for(const type of Object.keys(UNIT_DEFS)){
  assert.ok(Object.keys(directionalSheets).some(id=>id===type||id.startsWith(type+'-')),type);
}
for(const h of HOUSES)assert.ok(directionalSheets['hero-'+h.sigil],h.sigil);
for(const [id,d] of Object.entries(directionalSheets)){
  const poses=atlasPoses(d.kit,id.startsWith('hero-'));
  for(const name of ['idle','walk0','walk1','walk2','walk3','wind','strike','recover'])assert.ok(poses.includes(name),id+' '+name);
  const data=fs.readFileSync(new URL('../../'+d.src,import.meta.url));
  assert.equal(data.toString('ascii',12,16),'VP8X');
  assert.equal(data.readUIntLE(24,3)+1,d.w*poses.length,id+' columns');
  assert.equal(data.readUIntLE(27,3)+1,d.h*8,id+' directions');
  for(const [row,anchors] of Object.entries(d.anchors??{})){
    assert.ok(Number(row)>=0&&Number(row)<8,id+' calibrated direction');
    for(const [col,anchor] of Object.entries(anchors)){
      assert.ok(Number(col)>=0&&Number(col)<poses.length,id+' calibrated pose');
      assert.ok(anchor.x>=0&&anchor.x<d.w&&anchor.y>=0&&anchor.y<d.h,id+' calibrated ground point');
      assert.equal(directionalAnchor(d,row,col),anchor,id+' reuses its source anchor');
    }
  }
}
const cavalry=directionalSheets.cavalry,strikeCol=atlasPoses(cavalry.kit).indexOf('strike');
assert.ok(directionalAnchor(cavalry,0,strikeCol).x>cavalry.ax);
assert.ok(directionalAnchor(cavalry,4,strikeCol).x<cavalry.ax);
assert.equal(directionalAnchor(directionalSheets.dragon,0,strikeCol),undefined);
const soldier={type:'infantry',hp:100,facingX:0,facingY:1,attackVisual:{at:2,faceX:-1,faceY:-1}};
assert.equal(atlasPose(soldier,{time:2.04},false),'strike');
assert.equal(atlasPose(soldier,{time:2.22},false),'recover');
assert.deepEqual(attackFacing(soldier,{time:2.22},{x:0,y:1}),{x:-1,y:-1});
assert.deepEqual(attackFacing(soldier,{time:2.5},{x:0,y:1}),{x:0,y:1});
assert.equal(attackFacingRow(soldier,{time:2.22}),6);
assert.equal(attackFacingRow(soldier,{time:2.5}),undefined);
for(const [row,[faceX,faceY]] of headings.entries()){
  const guard={...soldier,type:'winter_guard',attackVisual:{at:2,faceX,faceY}};
  for(const [time,pose] of [[2.03,'strike'],[2.22,'recover']]){
    assert.equal(atlasPose(guard,{time},false),pose);
    assert.equal(attackFacingRow(guard,{time}),row,'The Winter Guard keeps its contact heading throughout '+pose);
  }
}
assert.equal(atlasPose({...soldier,attackVisual:null},{time:2.6},false,.5),'wind');
const marcher={...soldier,attackVisual:null,phase:0};
assert.equal(atlasPose(marcher,{time:2.6},true),'walk0');
assert.equal(atlasPose(marcher,{time:2.6},true,0,Math.PI+.001),'walk2');
assert.equal(marcher.phase,0);
const dragon={type:'dragon',id:1,hp:10,attackVisual:{action:'dragonBreath',at:2,elapsed:0,faceX:-1,faceY:-1}};
const turning={x:1,y:1};
assert.equal(atlasPose(dragon,{time:2.8},true),'strike');
assert.deepEqual(attackFacing(dragon,{time:2.8},turning),{x:-1,y:-1});
assert.equal(atlasPose(dragon,{time:2.95},false),'recover');
assert.deepEqual(attackFacing(dragon,{time:3.1},turning),turning);
const hovering={...dragon,attackVisual:null};
const wingPhases=[0,.31,.61,.91].map(time=>atlasPose(hovering,{time},false));
assert.equal(new Set(wingPhases).size,4,'All four wing poses animate while hovering');
console.log(Object.keys(directionalSheets).length+' troop and hero sheets checked across eight facings.');
