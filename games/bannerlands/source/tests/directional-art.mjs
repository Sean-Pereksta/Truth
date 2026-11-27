import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UNIT_DEFS,HOUSES} from '../../core.js';
import {atlasPose,atlasPoses,attackFacing,facingRow} from '../../directional-art.js';
import {directionalSheets} from '../../directional-sheets.js';

const headings=[[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];
assert.deepEqual(headings.map(([x,y])=>facingRow(x,y)),[0,1,2,3,4,5,6,7]);
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
}
const soldier={type:'infantry',hp:100,facingX:0,facingY:1,attackVisual:{at:2,faceX:-1,faceY:-1}};
assert.equal(atlasPose(soldier,{time:2.04},false),'strike');
assert.equal(atlasPose(soldier,{time:2.22},false),'recover');
assert.deepEqual(attackFacing(soldier,{time:2.22},{x:0,y:1}),{x:-1,y:-1});
assert.deepEqual(attackFacing(soldier,{time:2.5},{x:0,y:1}),{x:0,y:1});
assert.equal(atlasPose({...soldier,attackVisual:null},{time:2.6},false,.5),'wind');
console.log(Object.keys(directionalSheets).length+' troop and hero sheets checked across eight facings.');
