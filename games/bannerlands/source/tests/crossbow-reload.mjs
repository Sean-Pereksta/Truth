import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
import {RELOAD_STAGES} from '../../equipment.js';
const types=['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel'];
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(type='gilded_crossbow'){
 const g=new Game({landscape:'open',enemies:1,house:1,seed:44277});g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];
 for(const t of g.tiles){t.terrain='grass';t.feature=null;t.owner=0;t.height=0;}
 for(const s of g.teams){s.count=0;s.alive=true;s.upgrades.weapons=0;s.upgrades.armor=0;}
 const u=g.addUnit(0,type,30,30),v=g.addUnit(1,'archer',34,30);v.hp=v.maxHp=10000;v.cooldown=1e9;g.hold([u.id,v.id]);u.facingX=1;u.facingY=0;u.cooldown=0;g.navigation.invalidate();g.hash.rebuild(g.units);return {g,u,v};
}
function step(g,seconds){for(let left=seconds;left>1e-8;){const dt=Math.min(.025,left);g.time+=dt;g.hash.rebuild(g.units);g.updateUnits(dt);g.updateProjectiles(dt);left-=dt;}}
function fire(g,u,v){g.attack(u,v);assert.ok(u.pendingShot);assert.equal(g.projectiles.length,0);step(g,.3);assert.ok(u.reload);}

test('All four crossbows aim, release one real bolt, and apply damage at projectile contact',()=>{
 for(const type of types){const {g,u,v}=fixture(type),before=v.hp;fire(g,u,v);assert.equal(g.projectiles.length,1);assert.equal(g.projectiles[0].type,'bolt');assert.equal(v.hp,before);assert.ok(g.projectiles[0].sx>u.x,'Bolt originates at the authored release point.');g.updateProjectiles(2);assert.equal(before-v.hp,UNIT_DEFS[type].damage);assert.equal(g.stats.battles,1);}
});
test('Every loading stage completes in sequence and an unloaded weapon cannot fire',()=>{
 for(const type of types){const {g,u,v}=fixture(type);fire(g,u,v);v.x=60;u.target=null;const seen=new Set([u.reload.stage]),count=g.stats.battles;for(let i=0;i<UNIT_DEFS[type].rate/.025+5;i++){g.attack(u,v);if(u.reload)seen.add(u.reload.stage);step(g,.025);if(!u.reload)break;}assert.deepEqual([...seen],RELOAD_STAGES.map(s=>s.name));assert.equal(u.reload,null);assert.equal(u.loadingState,'Loaded');assert.equal(g.stats.battles,count);}
});
test('Move interrupts the current physical stage and preserves completed stages',()=>{
 for(const type of types){const {g,u,v}=fixture(type);fire(g,u,v);step(g,UNIT_DEFS[type].rate*.67);assert.ok(u.reload.stageIndex>=2);const completed=u.reload.completed,index=u.reload.stageIndex;v.hp=0;g.command([u.id],25,30,'move','spread');assert.equal(u.reload.progress,completed);assert.equal(u.reload.stageProgress,0);step(g,.5);assert.ok(u.x<29.8);assert.equal(u.reloading,false);assert.equal(u.reload.stageIndex,index);assert.equal(u.reload.progress,completed);g.hold([u.id]);step(g,UNIT_DEFS[type].rate*.5);assert.equal(u.reload,null);}
});
test('Loaded weapons remain loaded during deliberate movement and aim cancels immediately',()=>{
 const {g,u,v}=fixture();g.attack(u,v);assert.ok(u.pendingShot);g.command([u.id],25,30,'move');assert.equal(u.pendingShot,null);step(g,.5);assert.equal(u.reload,undefined);assert.equal(g.projectiles.length,0);assert.equal(u.loadingState,'Loaded');assert.ok(u.x<30);
});
test('Substantial knockback discards only the interrupted stage and pauses loading',()=>{
 const {g,u,v}=fixture();fire(g,u,v);step(g,2);const completed=u.reload.completed,index=u.reload.stageIndex;u.knockT=u.knockDuration=.3;u.knockVX=-2;u.knockVY=0;step(g,.1);assert.equal(u.reload.progress,completed);assert.equal(u.reload.stageIndex,index);assert.equal(u.reloading,false);step(g,.5);assert.ok(u.reloading);assert.ok(u.reload.progress>completed);
});
test('Minor collision shuffles preserve loading work',()=>{
 const {g,u,v}=fixture();fire(g,u,v);const before=u.reload.progress;u.x+=.005;u.vx=.04;g.updateCrossbowReload(u,.1);assert.ok(u.reload.progress>before);assert.equal(u.reloading,true);
});
test('Attack while travelling stops to complete the unloaded weapon before a new aim',()=>{
 const {g,u,v}=fixture('sharpshooter');fire(g,u,v);g.command([u.id],25,30,'move');step(g,.3);const before=u.x,count=g.stats.battles;g.attackNearest([u.id]);step(g,.5);assert.ok(Math.abs(u.x-before)<.01);assert.ok(u.reload);assert.equal(g.stats.battles,count);step(g,5.3);assert.ok(g.stats.battles>count);
});
console.log(`${checks} staged crossbow checks passed.`);
