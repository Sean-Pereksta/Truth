import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:0,fogOfWar:false,seed:628410});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.objectives=[];g.castles=[];
  for(const t of g.tiles){
    t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';
    t.feature=null;t.featureAxis=null;t.owner=0;t.claim=-1;t.capture=0;
    if(t.x>=55&&t.x<=61&&t.y>0&&t.y<g.H-1){t.terrain='water';if(t.y>=39&&t.y<52){t.feature='bridge';t.featureAxis='x';}}
  }
  g.navigation.invalidate();
  for(const team of g.teams){team.count=0;team.aiClock=1e9;team.heroTimer=0;team.alive=true;team.gold=0;}
  for(let team=0;team<2;team++){const keep=g.addBuilding(team,'keep',team?103.5:7.5,team?88.5:7.5);keep.spawnTimer=-1e9;keep.cooldown=1e9;}
  const troops=Array.from({length:320},(_,i)=>g.addUnit(0,i%19===0?'siege':i%7===0?'cavalry':i%5===0?'archer':'infantry',34.5+i%20*.5,41.5+Math.floor(i/20)*.5));
  g.hash.rebuild(g.units);
  return {g,troops,ids:troops.map(u=>u.id)};
}
function advance(g,frames,until=()=>false){
  for(let frame=0;frame<frames;frame++){
    g.update(1/30);
    assert.equal(g.winner,null,'Movement remains inside a live battle.');
    assert.ok(g.units.every(u=>g.isWalkable(u.x,u.y)),'Every troop stays on land or the bridge deck.');
    if(until())break;
  }
}
function assertGoal(troops,x,y){
  for(const u of troops){assert.equal(u.order.groupX,x);assert.equal(u.order.groupY,y);assert.ok(['move','idle'].includes(u.order.mode));}
}

test('Repeated Move commands replace Hold for all 320 troops and the newest destination starts advancing',()=>{
  const {g,troops,ids}=fixture();g.hold(ids);
  const oldOrders=troops.map(u=>u.order),before=troops.map(u=>({x:u.x,y:u.y}));
  for(const [x,y] of [[25.5,60.5],[85.5,65.5],[73.5,45.5]])g.command(ids,x,y,'move');
  assertGoal(troops,73.5,45.5);
  troops.forEach((u,i)=>{assert.notEqual(u.order,oldOrders[i]);assert.equal(u.target,null);});
  advance(g,90);
  troops.forEach((u,i)=>{
    assert.ok(Math.hypot(u.x-before[i].x,u.y-before[i].y)>.3,`Troop ${i} begins obeying the newest order.`);
    assert.ok(u.x>before[i].x+.2,`Troop ${i} advances toward the bridge.`);
  });
  assertGoal(troops,73.5,45.5);assert.equal(g.units.length,320);
});

test('All 320 mixed troops cross a bridge, then obey a new Move back across the river',()=>{
  const {g,troops,ids}=fixture();g.command(ids,73.5,45.5,'move');
  advance(g,2100,()=>troops.every(u=>u.x>62.5));
  assert.ok(troops.every(u=>u.x>62.5),'No soldier remains frozen on the near bank.');
  assertGoal(troops,73.5,45.5);
  const before=troops.map(u=>({x:u.x,y:u.y}));
  g.command(ids,30.5,45.5,'move');assertGoal(troops,30.5,45.5);
  advance(g,150);
  troops.forEach((u,i)=>assert.ok(u.x<before[i].x-.2,`Troop ${i} reverses toward the new destination.`));
  advance(g,2400,()=>troops.every(u=>u.x<54));
  assert.ok(troops.every(u=>u.x<54),'The entire force obeys the return order and crosses back.');
  assertGoal(troops,30.5,45.5);assert.equal(g.units.length,320);
});

console.log(`${checks} large-army movement checks passed.`);
