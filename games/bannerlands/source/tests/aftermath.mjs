import assert from 'node:assert/strict';
import {Game,HOUSES} from '../../core.js';
import {BattleAftermath,CORPSE_LIFETIME,MAX_CORPSES,corpseOpacity} from '../../aftermath.js';
let cases=0;const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const fallen=(id=1)=>({id,type:'infantry',team:0,hp:0,x:20.5,y:30.5});

test('Bodies fade continuously for two minutes and expire at exactly 120 seconds',()=>{
  const a=new BattleAftermath(),body=a.record(fallen(),HOUSES[0],12,'infantry');
  assert.equal(CORPSE_LIFETIME,120);assert.equal(corpseOpacity(body,12),1);assert.equal(corpseOpacity(body,42),.75);assert.equal(corpseOpacity(body,72),.5);assert.equal(corpseOpacity(body,117),.125);
  a.update(131.999);assert.equal(a.bodies.length,1);assert.ok(corpseOpacity(body,a.time)>0);a.update(132);assert.equal(a.bodies.length,0);assert.equal(a.ids.size,0);
});
test('Every faction retains its own colors with varied poses and equipment tones',()=>{
  const a=new BattleAftermath(),palettes=new Set(),poses=new Set(),colors=new Set();
  for(let team=0;team<HOUSES.length;team++){const bodies=[];for(let i=0;i<12;i++){const body=a.record({...fallen(team*12+i+1),team},HOUSES[team],0,'infantry');bodies.push(body);poses.add(body.pose);}palettes.add(bodies.map(b=>b.color).sort().join('|'));for(const body of bodies)colors.add(body.color);assert.ok(new Set(bodies.map(b=>b.color)).size>1);}
  assert.equal(palettes.size,HOUSES.length);assert.equal(poses.size,4);assert.ok(colors.size>HOUSES.length*2);
});
test('Snapshots survive unit cleanup and cannot change living simulation state or randomness',()=>{
  const g=new Game({scale:'standard',landscape:'open',enemies:1,seed:5234}),a=new BattleAftermath(),u=g.group(0).find(u=>u.type==='infantry');
  u.hp=0;const state={seed:g.seed,count:g.teams[0].count,units:g.units.length,lookup:g.byId.size,tiles:g.tiles.map(t=>[t.owner,t.capture]),order:u.order};
  const body=a.record(u,g.teams[0],0,g.unitClass(u));a.update(60);
  assert.equal(g.seed,state.seed);assert.equal(g.teams[0].count,state.count);assert.equal(g.units.length,state.units);assert.equal(g.byId.size,state.lookup);assert.deepEqual(g.tiles.map(t=>[t.owner,t.capture]),state.tiles);assert.equal(u.order,state.order);
  const position={x:body.x,y:body.y,color:body.color};u.x=70;u.y=80;u.type='siege';u.order=null;
  assert.deepEqual({x:body.x,y:body.y,color:body.color},position);assert.equal(body.type,'infantry');assert.ok(!('hp' in body)&&!('order' in body)&&!('target' in body));assert.ok(!g.units.includes(body));assert.notEqual(g.byId.get(body.id),body);
});
test('Only real deaths create one body; living troops and repeated damage add none',()=>{
  const a=new BattleAftermath(),u=fallen();assert.equal(a.record({...u,hp:1},HOUSES[0],0),null);a.record(u,HOUSES[0],0);assert.equal(a.record(u,HOUSES[0],.1),null);assert.equal(a.bodies.length,1);assert.equal(a.record({...u,id:2,x:NaN},HOUSES[0],0),null);
});
test('Casualty storage remains bounded and cleanup preserves newer corpses',()=>{
  const a=new BattleAftermath();for(let i=0;i<MAX_CORPSES+4;i++)a.record(fallen(i+1),HOUSES[0],i/100,'infantry');assert.equal(a.bodies.length,MAX_CORPSES);assert.equal(a.ids.size,MAX_CORPSES);assert.equal(a.bodies[0].id,5);
  a.update(125);assert.ok(a.bodies.every(b=>125-b.bornAt<120));assert.equal(a.ids.size,a.bodies.length);a.clear();assert.equal(a.bodies.length,0);assert.equal(a.ids.size,0);
});
test('Fallen kings and mounted or siege units retain the correct cosmetic identity',()=>{
  const a=new BattleAftermath(),king=a.record({...fallen(),isKing:true,type:'hero'},HOUSES[0],0,'hero'),horse=a.record({...fallen(2),type:'lance_champion'},HOUSES[1],0,'cavalry'),engine=a.record({...fallen(3),type:'trebuchet'},HOUSES[2],0,'siege');
  assert.equal(king.isKing,true);assert.equal(king.kind,'hero');assert.equal(horse.kind,'cavalry');assert.equal(engine.kind,'siege');
});
test('Real combat records a body once without leaving it in collision or capture inputs',()=>{
  const g=new Game({scale:'standard',landscape:'open',enemies:1,seed:5234}),u=g.group(0).find(u=>u.type==='infantry'),count=g.teams[0].count;
  g.damage(u,1e6,{team:1,type:'infantry'});assert.equal(g.aftermath.bodies.length,1);const body=g.aftermath.bodies[0];assert.equal(body.id,u.id);assert.equal(g.teams[0].count,count-1);
  g.damage(u,1e6,{team:1,type:'infantry'});assert.equal(g.aftermath.bodies.length,1);g.hash.rebuild(g.units);assert.ok(g.hash.buckets.every(bucket=>!bucket.includes(u)&&!bucket.includes(body)));
  assert.ok(!g.units.includes(body));assert.equal(g.byId.get(u.id),u,'Lookup cleanup still follows the ordinary unit lifecycle.');
});
test('Paused battles freeze fading, and a finished battle keeps fading without advancing combat',()=>{
  const g=new Game({scale:'standard',landscape:'open',enemies:1,seed:5234}),u=g.group(0).find(u=>u.type==='infantry');g.damage(u,1e6,{team:1,type:'infantry'});
  g.paused=true;g.updateAftermath(10);assert.equal(g.aftermath.time,0);g.paused=false;g.winner=0;const time=g.time,seed=g.seed;
  g.update(.06);assert.equal(g.aftermath.time,.06);assert.equal(g.time,time);assert.equal(g.seed,seed);g.updateAftermath(60);assert.ok(corpseOpacity(g.aftermath.bodies[0],g.aftermath.time)<.5);g.updateAftermath(60);assert.equal(g.aftermath.bodies.length,0);
});
test('Faction elimination removes survivors without inventing additional battle casualties',()=>{
  const g=new Game({scale:'standard',landscape:'open',enemies:1,seed:5234}),u=g.group(1).find(u=>u.type==='infantry');g.damage(u,1e6,{team:0,type:'infantry'});assert.equal(g.aftermath.bodies.length,1);g.eliminate(1);assert.equal(g.aftermath.bodies.length,1);
});
console.log(`${cases} cosmetic aftermath checks passed.`);
