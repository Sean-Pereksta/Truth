import assert from 'node:assert/strict';
import {PAINTED_TROOPS,selectPaintedFrame} from '../../painted-troops.js';

for(const id of ['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel']){
  const d=PAINTED_TROOPS[id],u={hp:100,attackVisual:{at:10},reloading:true,reload:{stage:'lower',progress:.15,duration:3}};
  assert.equal(selectPaintedFrame(u,{time:10.04},d),d.actions.fire,id+' displays the single release');
  assert.equal(selectPaintedFrame(u,{time:10.15},d),d.actions.lower,id+' must visibly lower during the real post-shot reload');
  u.reload.stage='span';u.reload.progress=1;
  assert.equal(selectPaintedFrame(u,{time:11},d),selectPaintedFrame(u,{time:90},d),id+' loading frames follow completed work, not wall time');
  assert.ok(d.actions.walk.includes(selectPaintedFrame(u,{time:11},d,true)),id+' immediate movement drops loading pose');
}
const halberd=PAINTED_TROOPS.hornhill_halberdier;
assert.equal(selectPaintedFrame({hp:100,attackVisual:{at:10,action:'swing'}},{time:10.04},halberd),halberd.actions.swing,'Halberd swing is a complete authored body/weapon action');
assert.equal(selectPaintedFrame({hp:100,attackVisual:{at:10,action:'thrust'}},{time:10.04},halberd),halberd.actions.thrust,'Halberd thrust remains distinct');
const shield=PAINTED_TROOPS.lion_shield_bearer;
assert.equal(selectPaintedFrame({hp:100,shieldLowerUntil:10.14},{time:10.05},shield,true),shield.actions.lower,'Movement can immediately lower the shield without blocking movement');
assert.ok(shield.actions.walk.includes(selectPaintedFrame({hp:100,shieldLowerUntil:10.14},{time:10.2},shield,true)));
assert.equal(selectPaintedFrame({hp:100,shieldGuard:'guard',hitVisual:{at:10,blocked:true}},{time:10.05},shield),shield.actions.block,'A valid guarded impact uses the authored block pose');
assert.equal(selectPaintedFrame({hp:100,shieldGuard:'guard',vx:.1,vy:0},{time:10.05},shield,true),shield.actions.guard,'Minor collision drift keeps the same valid guard represented in artwork');
assert.equal(selectPaintedFrame({hp:100,facingX:1,facingY:0,order:{facingX:0,facingY:1}},{time:10},shield),shield.actions.turn,'Logical turning uses the existing authored orientation');
assert.equal(PAINTED_TROOPS.dread_pike.actions.guard,undefined,'Dread Pikes have no shield artwork action');
assert.ok(Object.values(PAINTED_TROOPS).every(d=>d.facing==='screen-right-mirrored'),'All actions preserve the original two facings');
console.log('PASS authored shot/lower/reload, halberd swing/thrust, shield transitions, no-shield pikes and original facings.');
