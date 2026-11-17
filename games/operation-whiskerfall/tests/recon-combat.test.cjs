'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
class Game {
  updateAdvancedEnemy(){return false;}
  damageEnemy(e,amount){e.hp-=amount;if(e.hp<=0)this.killEnemy(e);}
  killEnemy(e){e.dead=true;}
  damagePlayer(p,amount){p.hp-=amount;}
  move(e,dx,dy){e.x+=dx;e.y+=dy;}
  effect(){}
  text(){}
  safeZoneAt(){return false;}
  pointLocked(){return false;}
  enemyDamage(e,s,m){return s.damage*m;}
  lineOfSight(){return true;}
  spawnReinforcement(){}
  patrol(){}
  enterDungeon(){this.world={};return true;}
}
class World{
  _buildEnemies(){}
  isBlocked(){return false;}
  isFinalArena(){return true;}
  steerAround(){return {mx:0,my:0};}
}
global.window={OW:{Game,World,Content:{enemies:Array.from({length:51},(_,i)=>({id:'old'+i})),bosses:[{id:'adolph_whisker',range:650,speed:145,damage:32}],enemyScaling(){return {health:1,damage:1};}},wrapAngle:a=>Math.atan2(Math.sin(a),Math.cos(a)),clamp:(n,lo,hi)=>Math.min(hi,Math.max(lo,n))}};
const W=window.OW;
require(path.resolve(__dirname,'../data/recon-enemies.js'));
require(path.resolve(__dirname,'../js/core/recon-combat.js'));
const frame=1/120;
function scene(id='glasswind_sharpshot',heroX=160) {
  const g=new Game(),e={id:'lead',type:W.Content.reconEnemyTypes[id],hp:100,maxHp:100,x:0,y:0,angle:0};
  g.world=new World();g.world.activeEnemies=[e];g.settings={};g.players=[{x:heroX,y:0,hp:200}];
  g.audio={play(){}};g.ui={toast(){}};g.time=0;
  const tick=(n=1)=>{for(let i=0;i<n;i++){g.time+=frame;g.updateAdvancedEnemy(e,null,e.boss?W.Content.bosses[0]:W.Content.enemies[e.type],frame);}};
  const record=()=>W.ReconCombat.record(e);
  const commit=()=>{for(let i=0;i<500&&!record()?.action;i++)tick();assert.ok(record()?.action,'actor committed');return record().action;};
  return {g,e,tick,record,commit};
}
test('six unique appended enemy types and original catalogue indices',()=>{
  assert.deepEqual(Object.values(W.Content.reconEnemyTypes),[51,52,53,54,55,56]);
  assert.equal(W.Content.enemies[50].id,'old50');
});
test('lane edges and endpoints are closed, direction is locked for both co-op heroes',()=>{
  const {g,commit,tick}=scene(),a=commit(),s=a.beats[0].shape;
  const hit=W.ReconCombat.inside;
  assert.ok(hit(s,{x:160,y:19}));assert.ok(!hit(s,{x:160,y:19.01}));
  assert.ok(hit(s,{x:s.length,y:0}));assert.ok(!hit(s,{x:s.length+.01,y:0}));
  g.players[0].y=19.01;g.players.push({x:207,y:19,hp:200});
  tick(70);assert.equal(g.players[1].hp,200);tick(3);assert.ok(g.players[1].hp<200);assert.equal(g.players[0].hp,200);
  const first=g.players[1].hp;tick(34);assert.equal(g.players[1].hp,first);tick(2);assert.ok(g.players[1].hp<first);
});
test('broken ring and sweep boundary, open angular sector and inner refuge',()=>{
  const s={kind:'sector',x:0,y:0,angle:Math.PI,arc:Math.PI*1.5,radius:180,inner:30};
  const hit=W.ReconCombat.inside;assert.ok(!hit(s,{x:178,y:0}));assert.ok(hit(s,{x:-180,y:0}));
  assert.ok(!hit(s,{x:-180.1,y:0}));assert.ok(!hit(s,{x:-29.9,y:0}));
});
test('pause stops both tell and damage, extended warnings include the second shot',()=>{
  const {g,commit,tick}=scene();g.settings.longWarnings=true;const a=commit();
  assert.ok(Math.abs(a.beats[0].at-.9)<1e-8);assert.ok(Math.abs(a.beats[1].at-1.35)<1e-8);
  g.paused=true;tick(240);assert.equal(a.elapsed,0);assert.equal(g.players[0].hp,200);
  g.paused=false;tick(107);assert.equal(g.players[0].hp,200);tick(2);assert.ok(g.players[0].hp<200);
});
test('interruption or losing the linked ally prevents the corresponding signal damage',()=>{
  const {g,e,commit,tick,record}=scene('signal_sergeant');
  const ally={id:'buddy',hp:90,x:10,y:0,type:0};g.world.activeEnemies.push(ally);
  let a=commit();assert.equal(a.links[0],ally);ally.dead=true;tick(91);assert.equal(g.players[0].hp,200);
  a=commit();g.damageEnemy(e,5,g.players[0]);assert.equal(record().action,null);tick(44);assert.equal(g.players[0].hp,200);
});
test('shield counters and recovery damage multiplier',()=>{
  const {g,e,commit}=scene('rivet_guard',100);commit();g.damageEnemy(e,10,g.players[0]);assert.equal(e.hp,96.3);
  g.breakReconGuard(e,g.players[0],.8);g.damageEnemy(e,10,g.players[0]);assert.ok(Math.abs(e.hp-84.1)<.001);
});
test('roles commit distinct geometry with actionable recovery intervals',()=>{
  for(const [id,kind,count] of [
    ['hookclaw_skirmisher','sector',2],['rivet_guard','sector',1],['signal_sergeant','lane',1],
    ['glasswind_sharpshot','lane',2],['sluice_warden','sector',4],['lantern_stalker','disc',1]
  ]){
    const {commit,tick,e,record}=scene(id,80),a=commit();
    assert.equal(a.beats[0].shape.kind,kind,id);assert.equal(a.beats.length,count,id);
    tick(Math.ceil((a.beats.at(-1).at+.16)/frame));assert.equal(e.combatState,'recovery');assert.equal(record().action,null);
  }
});
test('cover stops damage and leaving the scene clears a winding attack',()=>{
  const {g,commit,tick,record}=scene();commit();g.lineOfSight=()=>false;tick(120);assert.equal(g.players[0].hp,200);
  g.enterDungeon();assert.equal(record(),undefined);
});
test('all four Berlin phases use the same locked-footprint attacks, a destructible relay, and phase reset',()=>{
  const {g,e,commit,tick,record}=scene();Object.assign(e,{boss:true,bossIndex:8,locationId:'boss_berlin',hp:42000,maxHp:42000});
  commit();assert.equal(e.phase,1);assert.equal(e.maxHp,9500);
  e.hp=e.maxHp*.7;tick();let a=commit();assert.equal(e.phase,2);assert.ok(a.relay?.reconRelay);
  g.killEnemy(a.relay);tick();assert.equal(record().action,null);
  e.hp=e.maxHp*.4;tick();a=commit();assert.equal(e.phase,3);assert.equal(a.beats[0].shape.stamp,4);
  e.hp=e.maxHp*.2;tick();a=commit();assert.equal(e.phase,4);assert.equal(a.beats.length,2);
});

test('two heroes retain an exit when a second commitment would cover a narrow corridor',()=>{
  const {g,e}=scene('glasswind_sharpshot',160);
  g.players.push({x:145,y:3,hp:200});g.settings={highContrastWarnings:true,longWarnings:true};
  g.world.isBlocked=(x,y)=>Math.abs(y)>8;
  const second={...e,id:'second',x:430};g.world.activeEnemies.push(second);
  for(let n=0;n<36;n++){
    for(const actor of g.world.activeEnemies)g.updateAdvancedEnemy(actor,null,W.Content.enemies[actor.type],frame);
  }
  assert.ok(W.ReconCombat.record(e).action);assert.equal(W.ReconCombat.record(second).action,null);
  // Remove the walls. With reachable sideways positions for both heroes,
  // the second shooter can safely start its already extended two-beat tell.
  g.world.isBlocked=()=>false;
  for(let n=0;n<40;n++)g.updateAdvancedEnemy(second,null,W.Content.enemies[second.type],frame);
  const action=W.ReconCombat.record(second).action;assert.ok(action);
  assert.ok(action.beats[0].at>.8);assert.ok(action.beats[1].at>1.2);
});
test('painted poses distinguish six enemy reactions, defeat, and four commander phases',()=>{
  class Renderer {}
  Renderer.prototype.illustratedEnemyFrame=()=>null;
  W.Renderer=Renderer;W.UI=class {};W.Assets={};
  require(path.resolve(__dirname,'../js/ui/recon-combat-art.js'));
  const renderer=new Renderer(), choose=e=>renderer.illustratedEnemyFrame(e);
  for(const [i,type] of Object.values(W.Content.reconEnemyTypes).entries()){
    const e={type,hp:40,anim:'run'};
    assert.deepEqual([choose(e).key,choose(e).row,choose(e).col],['reconPatrol',i,0]);
    e.combatState='recovery';assert.equal(choose(e).col,3);
    e.hit=.1;assert.deepEqual([choose(e).key,choose(e).col],['reconCasualties',0]);
    e.hp=0;assert.deepEqual([choose(e).key,choose(e).col],['reconCasualties',1]);
  }
  for(let phase=1;phase<=4;phase++){
    const pose=choose({type:23,boss:true,bossIndex:8,phase,hp:100,combatState:'windup'});
    assert.deepEqual([pose.key,pose.row,pose.col],['reconCommander',phase-1,1]);
  }
});
