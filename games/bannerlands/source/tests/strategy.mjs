import assert from 'node:assert/strict';
import {Game,BUILD_DEFS} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
// These wave/flag checks isolate their original targets; castle missions have
// their own regression suite, including priority over an ordinary invasion.
const game=(config={})=>{const g=new Game({landscape:'open',house:0,enemies:3,scale:'standard',seed:44277,...config});g.castles=g.castles.filter(c=>!c.ruined);return g;};
const prepare=(g,team=1,style='mass')=>{
  const s=g.teams[team];s.strategy=style;s.gold=0;s.powerReadyAt=1e9;
  const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;
  return {s,p};
};
const launch=(g,s,p,time=90)=>{g.time=time;p.nextAttackAt=0;g.objectives=[];g.hash.rebuild(g.units);g.ai(s);};
const fillSupply=(g,s)=>{while(g.group(s.id).length<s.cap)g.addUnit(s.id,'infantry',s.home.x+3,s.home.y+3);};

test('A fresh bot musters recruits at its capital instead of streaming toward an enemy',()=>{
  const g=game(),{s,p}=prepare(g);
  g.time=10;g.ai(s);
  assert.equal(p.phase,'muster');assert.deepEqual(s.rally,s.home);
  const origin=g.buildings.find(b=>b.team===s.id&&b.type==='barracks'),before=g.units.length;
  g.spawnBatch(origin,'infantry',4);
  for(const u of g.units.slice(before)){
    assert.notEqual(u.order.aiTask,'assault');
    if(u.order.mode!=='idle'){assert.equal(u.order.groupX,s.home.x);assert.equal(u.order.groupY,s.home.y);}
  }
});

test('A massed invasion is a fixed wave with a surviving capital garrison',()=>{
  const g=game(),{s,p}=prepare(g);launch(g,s,p);
  assert.equal(p.phase,'advance');assert.ok(p.cohort.length>=p.min);
  const original=[...p.cohort],guard=g.group(s.id).filter(u=>!original.includes(u.id));
  assert.ok(guard.length>=10);
  const before=g.units.length,origin=g.buildings.find(b=>b.team===s.id);
  g.spawnBatch(origin,'infantry',8);g.time+=5;g.ai(s);
  assert.deepEqual(p.cohort,original);
  for(const u of g.units.slice(before))assert.ok(!['assault','raid'].includes(u.order.aiTask));
});

test('A defeated wave withdraws and waits to regroup before another invasion',()=>{
  const g=game(),{s,p}=prepare(g);launch(g,s,p);
  const ids=[...p.cohort],survivors=ids.slice(0,7).map(id=>g.byId.get(id));
  for(const id of ids.slice(7))g.byId.get(id).hp=0;
  g.time+=3;g.ai(s);
  assert.equal(p.phase,'regroup');assert.ok(p.nextAttackAt>g.time);
  for(const u of survivors){assert.equal(u.order.aiTask,'muster');assert.equal(u.order.mode,'move');}
  g.time+=5;g.ai(s);assert.equal(p.phase,'regroup');
});

test('Raiding bots flank toward vulnerable production instead of charging the capital',()=>{
  const g=game(),{s,p}=prepare(g,1,'raider');launch(g,s,p);
  assert.equal(p.phase,'advance');assert.equal(p.stage,'flank');
  assert.notEqual(g.byId.get(p.targetId).type,'keep');
  assert.ok(p.waypoint);const target=g.byId.get(p.targetId);
  const cross=(target.x-s.home.x)*(p.waypoint.y-s.home.y)-(target.y-s.home.y)*(p.waypoint.x-s.home.x);
  assert.ok(Math.abs(cross)>10);
  for(const id of p.cohort)assert.equal(g.byId.get(id).order.aiTask,'raid');
});

test('Target selection weighs enemy defenses and capital vulnerability',()=>{
  const g=game(),{s,p}=prepare(g);const enemies=g.buildings.filter(b=>b.type==='keep'&&b.team!==s.id);
  s.home={x:30,y:35};
  const near=enemies[0],weak=enemies[1];
  near.x=s.home.x+20;near.y=s.home.y;weak.x=s.home.x+30;weak.y=s.home.y;weak.hp=weak.maxHp*.1;
  enemies[2].x=s.home.x+70;enemies[2].y=s.home.y;
  for(const u of g.units)if(u.team!==s.id){u.x=2;u.y=2;}
  for(let i=0;i<25;i++)g.addUnit(near.team,'infantry',near.x+(i%5)*.4,near.y+Math.floor(i/5)*.4);
  g.hash.rebuild(g.units);assert.equal(g.aiTarget(s,p).id,weak.id);
});

test('A banner guard commits a company to a flag and idles troops inside its capture area',()=>{
  const g=game(),{s,p}=prepare(g,1,'objective');g.time=90;p.nextAttackAt=0;
  g.ai(s);assert.equal(p.phase,'objective');assert.ok(p.cohort.length>=p.min);
  const flag=g.objectives.find(o=>o.id===p.objectiveId);
  for(const id of p.cohort){const u=g.byId.get(id);u.x=flag.x;u.y=flag.y;}
  g.hash.rebuild(g.units);g.time+=3;g.ai(s);
  for(const id of p.cohort){const u=g.byId.get(id);assert.equal(u.order.mode,'idle');assert.equal(u.order.aiTask,'objective');}
});

test('Allied houses never appear in bot invasion targets',()=>{
  const g=game({mode:'team-conquest'}),{s,p}=prepare(g,1,'raider');
  const target=g.aiTarget(s,p);assert.ok(target);assert.equal(g.hostile(s.id,target.team),true);assert.notEqual(target.team,0);
});

test('Allied bots gather for a player assault call and launch together after its countdown',()=>{
  const g=game({mode:'team-conquest'}),{s,p}=prepare(g);
  const enemy=g.buildings.find(b=>b.team===2&&b.type==='keep');g.time=10;
  assert.equal(g.callTeamOrder('assault',enemy.x,enemy.y,0).ok,true);
  const order=g.teamOrders[0];g.ai(s);
  assert.equal(p.phase,'coordinate');assert.equal(p.teamLaunched,false);assert.ok(p.teamCohort.length>10);
  for(const id of p.teamCohort)assert.equal(g.byId.get(id).order.mode,'move');
  g.time=order.launchAt+.01;g.ai(s);assert.equal(p.teamLaunched,true);
  for(const id of p.teamCohort){const u=g.byId.get(id);assert.equal(u.order.aiOrder,order.id);assert.equal(u.order.mode,'attack');assert.equal(u.order.groupX,enemy.x);}
  g.time=order.expiresAt+.1;g.ai(s);assert.equal(p.coordinationId,null);assert.equal(p.phase,'regroup');
});

test('Bots answer allied capital threats without treating allied soldiers as attackers',()=>{
  const g=game({mode:'team-conquest'}),{s}=prepare(g);
  const alliedCapital=g.buildings.find(b=>b.team===0&&b.type==='keep');
  for(let i=0;i<8;i++)g.addUnit(2,'infantry',alliedCapital.x+3+(i%2)*.5,alliedCapital.y+Math.floor(i/2)*.5);
  g.hash.rebuild(g.units);g.time=25;g.ai(s);
  assert.ok(g.group(s.id).some(u=>u.order?.aiTask==='defend'&&u.order.aiDefend===alliedCapital.id));
  assert.ok(g.teamOrders.some(o=>o.kind==='defend'&&o.alliance===s.alliance));
  for(const u of g.units)if(u.team===2)u.hp=0;
  g.hash.rebuild(g.units);g.teamOrders=[];g.time+=3;g.ai(s);
  assert.ok(!g.group(s.id).some(u=>u.order?.aiTask==='defend'));
});

test('Siege planners invest in artillery production and supplied defenders strengthen their town hall',()=>{
  const g=game(),{s,p}=prepare(g,2,'siege');g.time=35;s.gold=700;p.economyAt=0;
  g.aiEconomy(s,p,g.group(s.id),false);
  assert.ok(g.buildings.some(b=>b.team===s.id&&g.unitClass(BUILD_DEFS[b.type].unit)==='siege'));
  const h=game(),def=prepare(h,1,'defensive');h.time=60;def.s.gold=800;def.p.economyAt=0;
  fillSupply(h,def.s);
  h.aiEconomy(def.s,def.p,h.group(def.s.id),false);assert.equal(h.townHallDetails(def.s.id).level,2);
});

test('A capital emergency recalls every deployed wave member into defense or regrouping',()=>{
  const g=game(),{s,p}=prepare(g);launch(g,s,p);const wave=[...p.cohort];
  for(let i=0;i<8;i++)g.addUnit(0,'infantry',s.home.x+3+(i%2)*.25,s.home.y+Math.floor(i/2)*.25);
  g.hash.rebuild(g.units);g.time+=3;g.ai(s);
  assert.equal(p.phase,'defend');assert.equal(p.cohort.length,0);
  for(const id of wave)assert.ok(['defend','muster','retreat'].includes(g.aiTaskOf(g.byId.get(id))));
});

test('A replacement alliance call regroups members omitted from the next coordinated wave',()=>{
  const g=game({mode:'team-conquest'}),{s,p}=prepare(g);
  const target=g.teams[2].home;g.time=20;g.callTeamOrder('assault',target.x,target.y,0);g.ai(s);
  const old=[...p.teamCohort],first=old[0];
  // Wounded soldiers are omitted when a second call forms its new company.
  g.byId.get(first).hp=g.byId.get(first).maxHp*.35;
  g.time+=10;g.callTeamOrder('assault',target.x+1,target.y,0);g.ai(s);
  assert.ok(!p.teamCohort.includes(first));assert.equal(g.aiTaskOf(g.byId.get(first)),'muster');
  for(const id of old)assert.ok(p.teamCohort.includes(id)||['muster','retreat'].includes(g.aiTaskOf(g.byId.get(id))));
});

test('A temporary spear brace does not make a living assault cohort disappear from its plan',()=>{
  const g=game(),{s,p}=prepare(g);launch(g,s,p);
  for(const id of p.cohort){const u=g.byId.get(id);u.spearResumeOrder={...u.order};u.order={x:u.x,y:u.y,mode:'hold',aiTask:'spearBrace'};}
  g.time+=3;g.ai(s);assert.equal(p.phase,'advance');assert.ok(p.cohort.length>=p.min);
});

test('Repeated strategy decisions preserve garrison orders while troops are returning home',()=>{
  const g=game(),{s,p}=prepare(g);g.time=10;p.nextAttackAt=1000;
  for(const u of g.group(s.id)){u.x=s.home.x*.65+g.W*.175;u.y=s.home.y*.65+g.H*.175;}
  g.hash.rebuild(g.units);g.ai(s);
  const orders=new Map(g.group(s.id).map(u=>[u.id,u.order]));
  for(let i=0;i<5;i++){g.time+=2;g.ai(s);}
  for(const u of g.group(s.id))assert.equal(u.order,orders.get(u.id));
});

test('Bastion planners fortify the weakest capital tower while retaining an army budget',()=>{
  const g=game(),{s,p}=prepare(g,1,'defensive');g.time=60;s.gold=1450;g.upgradeTownHall(s.id);g.upgradeTownHall(s.id);
  fillSupply(g,s);
  const near=g.addBuilding(s.id,'tower',s.home.x-2,s.home.y),far=g.addBuilding(s.id,'tower',s.home.x-8,s.home.y);
  s.gold=450;p.economyAt=0;g.aiEconomy(s,p,g.group(s.id),false);
  assert.equal(g.towerDetails(near.id,s.id).level,2);assert.equal(g.towerDetails(far.id,s.id).level,1);assert.equal(s.gold,200);
  g.time+=10;s.gold=1000;p.economyAt=0;g.aiEconomy(s,p,g.group(s.id),false);
  assert.equal(g.towerDetails(near.id,s.id).level,2);assert.equal(g.towerDetails(far.id,s.id).level,1);
  // A later investment reaches the final tier after every weaker capital tower is fortified.
  g.time+=40;s.gold=450;p.economyAt=0;g.aiEconomy(s,p,g.group(s.id),false);
  assert.equal(g.towerDetails(far.id,s.id).level,2);
  g.time+=45;s.gold=650;p.economyAt=0;g.aiEconomy(s,p,g.group(s.id),false);
  assert.equal(g.towerDetails(near.id,s.id).level,3);assert.equal(s.gold,200);
});

test('Bots preserve capital savings and recruit defenders rather than upgrading towers during an emergency',()=>{
  const g=game(),{s,p}=prepare(g,1,'defensive');g.time=60;s.gold=500;g.upgradeTownHall(s.id);
  const tower=g.addBuilding(s.id,'tower',s.home.x-2,s.home.y),before=g.group(s.id).length;
  s.gold=800;p.economyAt=0;g.aiEconomy(s,p,g.group(s.id),true);
  assert.equal(g.towerDetails(tower.id,s.id).level,1);assert.equal(g.townHallDetails(s.id).level,2);
  assert.ok(g.group(s.id).length>before);assert.ok(s.gold>=0);
  const h=game(),attacker=prepare(h,1,'mass');h.time=60;attacker.s.gold=500;h.upgradeTownHall(attacker.s.id);
  const post=h.addBuilding(attacker.s.id,'tower',attacker.s.home.x-2,attacker.s.home.y);
  attacker.s.gold=450;attacker.p.economyAt=0;h.aiEconomy(attacker.s,attacker.p,h.group(attacker.s.id),false);
  assert.equal(h.towerDetails(post.id,attacker.s.id).level,1);
});

console.log(`${cases} strategic AI tests passed.`);
