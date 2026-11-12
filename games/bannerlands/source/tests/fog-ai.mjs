import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(style='mass'){
  const g=new Game({fogOfWar:true,landscape:'open',scale:'standard',enemies:3,seed:44277});
  g.units=[];g.buildings=[];g.castles=[];g.objectives=[];g.byId.clear();g.time=90;
  for(const tile of g.tiles){tile.terrain=tile.x>0&&tile.y>0&&tile.x<g.W-1&&tile.y<g.H-1?'grass':'water';tile.feature=null;tile.owner=-1;tile.claim=-1;tile.capture=0;}
  g.navigation.invalidate();for(const s of g.teams){s.count=0;s.cap=300;s.gold=0;s.alive=true;s.aiClock=1e9;s.powerReadyAt=1e9;s.aiPlan=null;}
  const s=g.teams[1];s.home={x:20.5,y:20.5};s.strategy=style;g.addBuilding(1,'keep',s.home.x,s.home.y);
  for(let y=13;y<=28;y++)for(let x=13;x<=28;x++)g.tileAt(x+.5,y+.5).owner=1;
  for(let i=0;i<42;i++){const u=g.addUnit(1,i<8?'cavalry':'infantry',18.5+(i%7)*.7,23.5+Math.floor(i/7)*.6);g.hold([u.id]);}
  const enemy=g.addBuilding(0,'keep',86.5,75.5);g.teams[0].home={x:enemy.x,y:enemy.y};
  const hidden=g.addUnit(0,'archer',85,74);g.hold([hidden.id]);
  const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;p.nextAttackAt=0;
  g.hash.rebuild(g.units);g.vision.update(true);return {g,s,p,enemy,hidden};
}
const decisions=f=>({phase:f.p.phase,style:f.p.scoutStyle,target:f.p.targetId??null,orders:f.g.group(f.s.id).map(u=>({id:u.id,mode:u.order?.mode,task:u.order?.aiTask,x:u.order?.x,y:u.order?.y}))});

test('Fog bots cannot target undiscovered armies, castles or structures',()=>{
  const f=fixture();assert.equal(f.g.isVisibleTo(f.s.id,f.enemy),false);assert.equal(f.g.aiTarget(f.s,f.p),null);assert.equal(f.g.aiCastleTarget(f.s),null);
  f.g.ai(f.s);assert.equal(f.p.phase,'muster');assert.equal(f.p.targetId,undefined);assert.ok(f.g.group(f.s.id).some(u=>u.order?.aiTask==='scout'),'A bot with no enemy information sends scouts.');
});

test('Hidden enemy position, health, army mix and realm size cannot change bot decisions',()=>{
  const a=fixture('raider'),b=fixture('raider');
  b.enemy.x=70.5;b.enemy.y=88.5;b.enemy.hp=1;b.hidden.x=90;b.hidden.y=20;b.hidden.type='siege';
  b.g.teams[0].tiles=30000;b.g.teams[0].keeps=9;b.g.teams[0].gold=1e6;b.g.hash.rebuild(b.g.units);b.g.vision.update(true);
  a.g.ai(a.s);b.g.ai(b.s);assert.deepEqual(decisions(a),decisions(b));
  const pa=a.g.aiProductionPlan(a.s,a.p,a.g.group(a.s.id),false),pb=b.g.aiProductionPlan(b.s,b.p,b.g.group(b.s.id),false);
  assert.deepEqual(pa.ratios,pb.ratios);assert.equal(pa.counter,pb.counter);assert.equal(pa.type,pb.type);
});

test('Bots discover targets through scouts and continue toward frozen last-seen buildings until rescouting',()=>{
  const {g,s,p,enemy}=fixture(),scout=g.group(s.id).find(u=>u.type==='cavalry');scout.x=80;scout.y=75.5;g.hash.rebuild(g.units);g.vision.update(true);
  assert.equal(g.aiTarget(s,p),enemy);scout.x=20;scout.y=20;g.time+=1;g.vision.update(true);
  const memory=g.aiTarget(s,p);assert.equal(memory.id,enemy.id);assert.equal(memory.remembered,true);assert.equal(memory.hp,2500);
  enemy.hp=0;enemy.x=95.5;enemy.y=85.5;g.time+=1;g.vision.update(true);
  const remembered=g.aiTarget(s,p);assert.equal(remembered.id,enemy.id);assert.equal(remembered.hp,2500);assert.equal(remembered.x,86.5);
  const force=g.group(s.id).slice(0,32);g.aiIssue(force,remembered,'attack','assault',{aiTarget:enemy.id});Object.assign(p,{phase:'advance',cohort:force.map(u=>u.id),targetId:enemy.id,targetCastleId:null,initialSize:force.length,startedAt:g.time,timeout:1000,stage:'strike'});
  g.ai(s);assert.equal(p.phase,'advance','A hidden death cannot cancel an invasion.');
  scout.x=80;scout.y=75.5;g.time+=1;g.hash.rebuild(g.units);g.vision.update(true);assert.equal(g.aiTarget(s,p),null);g.ai(s);assert.equal(p.phase,'regroup');
});

test('Observed enemy composition changes production, while remote hidden reinforcements do not',()=>{
  const {g,s,p}=fixture();s.tiles=600;s.gold=0;for(let i=0;i<12;i++)g.addUnit(0,'archer',24+(i%4)*.3,20+Math.floor(i/4)*.3);
  g.hash.rebuild(g.units);g.vision.update(true);const observed=g.aiProductionPlan(s,p,g.group(s.id),false);assert.equal(observed.counter,'archers');
  for(let i=0;i<30;i++)g.addUnit(0,'cavalry',90+(i%3)*.3,60+Math.floor(i/3)*.3);g.hash.rebuild(g.units);g.vision.update(true);
  const hidden=g.aiProductionPlan(s,p,g.group(s.id),false);assert.equal(hidden.counter,'archers');assert.deepEqual(hidden.ratios,observed.ratios);
});

test('House plans use distinct border screens, deep probes, crossing surveys and fan sweeps',()=>{
  const strategies=new Set(),goals=[];
  for(const style of ['defensive','raider','objective','siege','mass']){
    const {g,s,p}=fixture(style);g.ai(s);strategies.add(p.scoutStyle);const scouts=g.group(s.id).filter(u=>u.order?.aiTask==='scout');assert.ok(scouts.length>=2,style+' assigns reconnaissance without committing the main army.');
    if(style==='defensive')assert.ok(scouts.every(u=>u.order.mode==='patrol'),'Defensive houses screen their own border.');
    else assert.ok(scouts.every(u=>u.order.mode==='move'),'Other houses send deliberate exploratory probes.');
    goals.push(scouts.map(u=>[u.order.x,u.order.y]));
    assert.ok(g.group(s.id).filter(u=>!['scout','frontier'].includes(u.order?.aiTask)).length>=30,'Scouting preserves a substantial garrison and invasion reserve.');
  }
  assert.equal(strategies.size,5);assert.notDeepEqual(goals[1],goals[4],'Deep probes and fan sweeps should choose different reconnaissance paths.');
});

test('Watchtower sites spread into blind owned territory and expand actual shared sight',()=>{
  const {g,s,p}=fixture('defensive');for(let y=12;y<=55;y++)for(let x=12;x<=55;x++)g.tileAt(x+.5,y+.5).owner=s.id;s.tiles=44*44;
  g.vision.update(true);const count=()=>g.vision.gridFor(s.id).reduce((n,x)=>n+x,0),before=count(),site=g.aiFogTowerSite(s);
  assert.ok(site?.gain>=8);assert.ok(Math.hypot(site.x-s.home.x,site.y-s.home.y)>=8,'A watchtower should expand the network instead of stacking on the keep.');assert.equal(g.tileAt(site.x,site.y).owner,s.id);
  const tower=g.addBuilding(s.id,'tower',site.x,site.y);g.time+=1;g.vision.update(true);assert.ok(count()>before+150);
  const levelOne=count();tower.level=3;g.time+=1;g.vision.update(true);assert.ok(count()>levelOne+150,'Upgrading a watchtower extends reconnaissance.');
  const plan=g.aiProductionPlan(s,p,g.group(s.id),false);assert.ok(plan.options.some(o=>o.type==='tower'&&/sight network/.test(o.reason)));
});

test('An attack at an unseen location cannot trigger a magical distant defense response',()=>{
  const a=fixture(),b=fixture();a.hidden.x=70;a.hidden.y=30;b.hidden.x=90;b.hidden.y=85;
  a.g.hash.rebuild(a.g.units);b.g.hash.rebuild(b.g.units);a.g.vision.update(true);b.g.vision.update(true);a.g.ai(a.s);b.g.ai(b.s);
  assert.equal(a.p.phase,'muster');assert.equal(b.p.phase,'muster');assert.deepEqual(decisions(a),decisions(b));
});

test('Hidden border losses cannot redirect watchtower placement before scouts confirm ownership',()=>{
  const a=fixture('defensive'),b=fixture('defensive');
  for(const f of [a,b]){for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)f.g.tileAt(x+.5,y+.5).owner=f.s.id;f.g.vision.update(true);}
  for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)b.g.tileAt(x+.5,y+.5).owner=0;
  b.g.time+=1;b.g.vision.update(true);assert.equal(b.g.isVisibleTo(b.s.id,{x:44.5,y:44.5}),false);
  assert.deepEqual(a.g.aiFogTowerSite(a.s),b.g.aiFogTowerSite(b.s),'Planning reads remembered ownership, not a live hidden enemy frontier.');
});

test('Patrol routes retain unseen borders until scouts observe the lost territory',()=>{
  const a=fixture('defensive'),b=fixture('defensive');
  for(const f of [a,b]){for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)f.g.tileAt(x+.5,y+.5).owner=f.s.id;f.g.recount();f.g.vision.update(true);}
  const original=b.g.patrolEdges(b.s.id);assert.deepEqual(a.g.patrolEdges(a.s.id).points,original.points);
  for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)b.g.tileAt(x+.5,y+.5).owner=0;
  b.g.recount();
  for(const f of [a,b]){f.g.time+=1;f.g.vision.update(true);}
  assert.equal(b.g.isVisibleTo(b.s.id,{x:44.5,y:44.5}),false);
  assert.equal(b.g.patrolEdges(b.s.id),original,'An unseen loss cannot invalidate the shared route through the live land total.');
  for(const f of [a,b])f.g.time+=3.1;
  assert.deepEqual(a.g.patrolEdges(a.s.id).points,b.g.patrolEdges(b.s.id).points,'A timed route refresh must also use remembered borders.');
  const scout=b.g.group(b.s.id).find(u=>u.type==='cavalry');scout.x=44.5;scout.y=44.5;b.g.time+=3.1;b.g.vision.update(true);
  assert.notDeepEqual(a.g.patrolEdges(a.s.id).points,b.g.patrolEdges(b.s.id).points,'Revealing the changed border must update subsequent patrol routes.');
});

test('Expansion orders use remembered frontier adjacency without changing real capture eligibility',()=>{
  const a=fixture(),b=fixture(),scouts=[];
  for(const f of [a,b]){
    for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)f.g.tileAt(x+.5,y+.5).owner=f.s.id;
    const scout=f.g.addUnit(f.s.id,'infantry',32.5,44.5);scouts.push(scout);f.g.vision.update(true);f.g.expand([scout.id]);
  }
  assert.equal(scouts[0].order.expandTile,scouts[1].order.expandTile);const frontier=scouts[1].order.expandTile;
  assert.ok(scouts[1].order.x>38,'The nearest known frontier is beside the distant holding.');
  for(let y=40;y<=48;y++)for(let x=40;x<=48;x++)b.g.tileAt(x+.5,y+.5).owner=0;
  for(const f of [a,b]){f.g.time+=1;f.g.vision.update(true);f.g.updateExpansionOrders();}
  assert.equal(b.g.isVisibleTo(b.s.id,{x:44.5,y:44.5}),false);
  assert.equal(scouts[1].order.expandTile,frontier,'An unseen loss must not cancel an existing frontier assignment.');
  for(let i=0;i<2;i++)[a,b][i].g.expand([scouts[i].id]);
  assert.equal(scouts[0].order.expandTile,scouts[1].order.expandTile,'A fresh expansion assignment must also use the same observed ownership.');
  assert.equal(b.g.canCapture(b.g.tiles[frontier],b.s.id),false,'Actual capture still requires real connected territory.');
  const scout=b.g.group(b.s.id).find(u=>u.type==='cavalry');scout.x=44.5;scout.y=44.5;b.g.time+=1;b.g.vision.update(true);b.g.updateExpansionOrders();
  assert.notEqual(scouts[1].order.expandTile,frontier,'A scout confirming the loss must invalidate the old frontier.');
});

test('Reconnaissance routing searches a bounded shortlist instead of every map candidate',()=>{
  const {g,s,p}=fixture('raider'),scout=g.group(s.id).find(u=>u.type==='cavalry'),route=g.navigation.route.bind(g.navigation);let searches=0;
  g.navigation.route=(...args)=>{searches++;return route(...args);};
  const goal=g.aiFogScoutGoal(s,p,scout);assert.ok(goal&&g.isWalkable(goal.x,goal.y));assert.ok(searches>0&&searches<=8,'A new scout destination must not flood path planning across the entire map.');
});

console.log(checks+' fog-aware AI checks passed.');
