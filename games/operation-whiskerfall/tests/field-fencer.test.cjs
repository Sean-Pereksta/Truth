'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..'),noop=()=>{};
const c={console,performance,Math,Date,Map,Set,JSON,Number,Array,Object,String,Boolean,setTimeout:noop,requestAnimationFrame:noop,localStorage:{getItem:()=>null,setItem:noop},document:{readyState:'loading',addEventListener:noop,getElementById:()=>({}),body:{classList:{add:noop}}},addEventListener:noop};c.window=c;vm.createContext(c);
for(const file of ['config.js','data/content.js','js/core/spatial.js','js/world/world.js','js/save/save.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
c.OW.Audio=class{init(){}play(){}update(){}setVolumes(){}};c.OW.Input=class{update(){}};c.OW.Renderer=class{load(){return Promise.resolve()}resize(){}draw(){}drawEffect(){}drawActor(){}};c.OW.UI=class{constructor(g){this.game=g;this.messages=[];}update(){}hideMenu(){this.game.paused=false;}showMenu(){}toast(s){this.messages.push(s);}};
for(const file of ['js/main.js','js/core/abilities.js','js/core/combat-polish.js','js/core/readable-combat.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const W=c.OW,g=new W.Game();g.start({coop:true});const type=W.Content.enemies.findIndex(e=>e.role==='fencer');assert(type>=0);let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function reset(){g.players=[g.newPlayer(0),g.newPlayer(1)];g.effectPool.reset();g.bulletPool.reset();g.grid.clear();g.time=0;g.ui.messages=[];g.fencerLessonShown=false;g.safeZoneAt=()=>null;g.pointLocked=()=>false;g.world.isBlocked=()=>false;g.lineOfSight=()=>true;g.alertEnemies=noop;g.paused=false;
  for(const [i,p]of g.players.entries())Object.assign(p,{x:2200,y:2000+i*180,level:1,hp:1000,maxHp:1000,invuln:0,angle:Math.PI});
  const e={id:'fencer-readable',type,x:2000,y:2000,homeX:2000,homeY:2000,hp:1000,maxHp:1000,level:1,region:0,regionScaleApplied:true,angle:0,animTime:0,fireTimer:0,state:'attack'};g.world.activeEnemies=[e];g.grid.insert(e);return{e,p:g.players[0],q:g.players[1]};
}
function begin(e,p){assert(g.updateAdvancedEnemy(e,p,W.Content.enemies[type],.016));assert(e.specialMove?.readableFencer);}
function advance(seconds){for(let t=0;t<seconds-1e-8;t+=.02){g.time+=.02;g.updateEnemies(.02);g.updateEffects(.02);for(const p of g.players)p.invuln=Math.max(0,p.invuln-.02);}}
check('Fencer commits to a locked 0.58-second amber lane with visible counterplay instructions',()=>{
  const {e,p}=reset();begin(e,p);assert.equal(e.specialMove.windup,.58);assert.equal(e.specialMove.radius,40);const target=e.specialMove.tx;assert(g.effects.some(f=>f.alive&&f.type==='chargeLane'&&f.readableEnemyId===e.id&&f.radius===40&&f.life===.58));assert(g.ui.messages.some(m=>/Sidestep.*interrupt/.test(m)));advance(.5);assert.equal(e.x,2000);assert.equal(p.hp,1000);p.x=2350;p.y=2100;assert.equal(e.specialMove.tx,target);
});
check('sidestepping avoids the real lunge and leaves a stationary punish window',()=>{
  const {e,p,q}=reset();begin(e,p);p.y+=140;advance(.92);assert.equal(p.hp,1000);assert.equal(q.hp,1000);assert(e.fencerRecovery>.72);assert.equal(e.combatState,'recovery');const x=e.x;advance(.5);assert.equal(e.x,x);assert(e.fencerRecovery>0);assert(!g.effects.some(f=>f.alive&&f.readableEnemyId===e.id));
});
check('standing in the warned lane takes actual damage while the co-op partner outside it remains safe',()=>{
  const {e,p,q}=reset();begin(e,p);advance(.92);assert(p.hp<1000);assert.equal(q.hp,1000);assert(e.fencerRecovery>0);
});
check('a real blade hit interrupts windup and cancels both attack and its obsolete warnings',()=>{
  const {e,p}=reset();p.x=2060;begin(e,p);g.meleeAttack(p);g.updateMelee(p,.11);assert(e.hp<1000);assert.equal(e.specialMove,null);assert(e.fencerRecovery>0);assert(!g.effects.some(f=>f.alive&&f.readableEnemyId===e.id));assert(g.effects.some(f=>f.type==='text'&&/INTERRUPTED/.test(f.text||'')));const hp=p.hp;advance(.8);assert.equal(p.hp,hp);
});
check('ordinary shots do not cancel the tell and the recovery reward is exactly 20 percent damage',()=>{
  const {e,p}=reset();begin(e,p);g.damageEnemy(e,100,p);assert.equal(e.hp,900);assert(e.specialMove);p.y+=140;advance(.92);const before=e.hp;g.damageEnemy(e,100,p);assert.equal(before-e.hp,120);advance(1.2);assert(!(e.fencerRecovery>0));const hp=e.hp;g.damageEnemy(e,100,p);assert.equal(hp-e.hp,100);
});
check('freezing a winding-up Fencer retains the warning until its delayed attack can resume',()=>{
  const {e,p}=reset();begin(e,p);e.freeze=1.4;advance(1.2);assert(e.specialMove.windup>.55);assert(g.effects.some(f=>f.alive&&f.type==='chargeLane'&&f.readableEnemyId===e.id));p.y+=140;advance(1.4);assert.equal(p.hp,1000);assert(e.fencerRecovery>0);
});
check('locked gates and walls still constrain the charge instead of allowing the new warning to bypass collision',()=>{
  let {e,p}=reset();g.pointLocked=(x,y)=>x>2100;g.beginMove(e,p,'charge',.45,.25,20,36);assert(!e.specialMove);({e,p}=reset());begin(e,p);g.world.isBlocked=(x,y,r)=>x+r>=2110;advance(.92);assert(e.x<2110);assert.equal(p.hp,1000);
});
check('a failed lunge names the attack and tells the fallen player how to counter it',()=>{
  const {e,p}=reset();p.hp=1;begin(e,p);advance(.92);assert(p.downed);assert(g.ui.messages.some(m=>/Downed by a Fencer lunge/.test(m)));
});
check('other enemy roles and bosses retain their original movement and damage behavior',()=>{
  const {e,p}=reset();e.type=0;g.beginMove(e,p,'charge',.45,.25,20,36);assert.equal(e.specialMove.windup,.45);assert.equal(e.specialMove.readableFencer,undefined);g.damageEnemy(e,100,p);assert.equal(e.hp,900);
});
check('recovery artwork is a small ground ring and cannot change combat state',()=>{
  const {e,p}=reset();begin(e,p);p.y+=140;advance(.92);const r=Object.create(W.Renderer.prototype),calls=[];r.ctx=new Proxy({},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});const before=JSON.stringify(e);r.drawActor(e,false);assert(calls.some(a=>a[0]==='ellipse'));assert.equal(JSON.stringify(e),before);
});
check('extended warnings give a Fencer the matching 870 ms lane and windup',()=>{
  const {e,p}=reset();g.settings.longWarnings=true;begin(e,p);
  assert.equal(e.specialMove.windup,.87);
  assert(g.effects.some(f=>f.alive&&f.type==='chargeLane'&&f.readableEnemyId===e.id&&f.life===.87));
  advance(.78);assert.equal(p.hp,1000);assert.equal(e.x,2000);
});
console.log(checks+' readable Fencer combat checks passed.');

