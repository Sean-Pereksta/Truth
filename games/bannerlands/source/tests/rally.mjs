import assert from 'node:assert/strict';
import { Game, HOUSES, HOUSE_CONTENT } from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const game=()=>new Game({landscape:'open',house:0,enemies:1,scale:'standard',seed:44277});
const newTroops=(g,origin)=>{const count=g.units.length;g.spawnBatch(origin,'infantry',3);return g.units.slice(count);};
const assertRally=(troops,point)=>{assert.equal(troops.length,3);for(const u of troops){assert.equal(u.order.mode,'attack');assert.equal(u.order.groupX,point.x);assert.equal(u.order.groupY,point.y);}};

test('Player troops idle at their production building until a rally is explicitly set',()=>{
  const g=game(),posts=g.buildings.filter(b=>b.team===0);
  assert.equal(g.teams[0].rally,null);
  for(const post of posts){assert.equal(post.rally,null);for(const u of newTroops(g,post)){assert.equal(u.order.mode,'idle');assert.equal(u.order.x,u.x);assert.equal(u.order.y,u.y);}}
  assert.ok(g.teams[1].rally);
});
test('Individual building rallies remain independent and do not set a global default',()=>{
  const g=game(),posts=g.buildings.filter(b=>b.team===0),p={x:20.5,y:20.5},q={x:30.5,y:30.5};
  assert.equal(g.setRally(p.x,p.y,0,[posts[0].id]).ok,true);
  assert.equal(g.setRally(q.x,q.y,0,new Set([posts[1].id])).ok,true);
  assert.equal(g.teams[0].rally,null);
  assertRally(newTroops(g,posts[0]),p);assertRally(newTroops(g,posts[1]),q);
  for(const u of newTroops(g,posts[2]))assert.equal(u.order.mode,'idle');
  assert.equal(g.addBuilding(0,'barracks',40,40).rally,null);
});
test('An all-buildings rally applies to existing and future buildings, with local overrides',()=>{
  const g=game(),p={x:20.5,y:20.5},q={x:30.5,y:30.5};
  assert.equal(g.setRally(p.x,p.y).ok,true);
  for(const b of g.buildings.filter(b=>b.team===0)){assert.deepEqual(b.rally,p);assert.notEqual(b.rally,g.teams[0].rally);}
  const b=g.addBuilding(0,'barracks',40,40);assert.deepEqual(b.rally,p);assertRally(newTroops(g,b),p);
  g.setRally(q.x,q.y,0,[b.id]);assert.deepEqual(g.teams[0].rally,p);assertRally(newTroops(g,b),q);
  const later=g.addBuilding(0,'barracks',50,50);assert.deepEqual(later.rally,p);
});
test('Clearing an individual rally idles its recruits without clearing other building defaults',()=>{
  const g=game(),p={x:20.5,y:20.5};g.setRally(p.x,p.y);const posts=g.buildings.filter(b=>b.team===0);
  assert.equal(g.clearRally(0,[posts[0].id]).ok,true);assert.equal(posts[0].rally,null);assert.deepEqual(posts[1].rally,p);
  for(const u of newTroops(g,posts[0]))assert.equal(u.order.mode,'idle');
  assert.deepEqual(g.addBuilding(0,'barracks',40,40).rally,p);
  assert.equal(g.clearRally().ok,true);assert.equal(g.teams[0].rally,null);
  for(const b of g.buildings.filter(b=>b.team===0))assert.equal(b.rally,null);
  assert.equal(g.addBuilding(0,'barracks',50,50).rally,null);
});
test('Water, invalid, foreign, dead, and empty selections cannot mutate rally orders',()=>{
  const g=game(),posts=g.buildings.filter(b=>b.team===0),foreign=g.buildings.find(b=>b.team===1),p={x:20.5,y:20.5};
  g.setRally(p.x,p.y,0,[posts[0].id]);const before=JSON.stringify(posts.map(b=>b.rally));
  for(const [x,y]of [[0,0],[-1,20],[20,999],[NaN,20],[20,Infinity]])assert.equal(g.setRally(x,y).ok,false);
  for(const ids of [[],[foreign.id],[g.units[0].id],[999999]]){assert.equal(g.setRally(30,30,0,ids).ok,false);assert.equal(g.clearRally(0,ids).ok,false);}
  posts[2].hp=0;assert.equal(g.setRally(30,30,0,[posts[2].id]).ok,false);
  assert.equal(JSON.stringify(posts.map(b=>b.rally)),before);
});
test('Army commands do not alter explicitly assigned rally destinations',()=>{
  const g=game(),b=g.buildings[0],p={x:20.5,y:20.5};g.setRally(p.x,p.y,0,[b.id]);
  g.command(g.group(0).map(u=>u.id),40,40,'attack','line');assert.deepEqual(b.rally,p);assert.equal(g.teams[0].rally,null);
});
test('AI reinforcement routes still follow the current AI rally',()=>{
  const g=game(),b=g.buildings.find(b=>b.team===1),p={x:30.5,y:30.5};g.teams[1].rally=p;assertRally(newTroops(g,b),p);
});
test('Every house can recruit and evaluate its power without a default player rally',()=>{
  for(let house=0;house<HOUSES.length;house++){
    const g=new Game({landscape:'open',house,enemies:1,scale:'standard',seed:44277}),s=g.teams[0],content=HOUSE_CONTENT[s.sigil];
    s.gold=100000;s.cap=10000;
    g.addBuilding(0,content.building,s.home.x+4,s.home.y+4);g.addBuilding(0,'workshop',s.home.x-4,s.home.y-4);g.addBuilding(0,'tower',s.home.x+4,s.home.y-4);
    assert.equal(g.recruit('infantry').ok,true,`${s.name} infantry`);
    assert.equal(g.recruit(content.unit).ok,true,`${s.name} specialist`);
    const power=g.useHousePower(g.group(0).map(u=>u.id));assert.equal(typeof power.ok,'boolean');
    assert.equal(s.rally,null,`${s.name} default remains unset`);
    for(const u of g.units.filter(u=>u.team===0&&u.id>g.buildings[5].id&&u.order))assert.notEqual(u.order.mode,'attack',`${s.name} summoned troops wait near their origin`);
  }
});
console.log(`${cases} rally behavior checks passed.`);
