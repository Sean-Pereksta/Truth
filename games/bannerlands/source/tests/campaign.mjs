import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
let passed=0;
const test=(name,fn)=>{fn();console.log('PASS '+name);passed++;};
const make=(mode='conquest',enemies=3)=>new Game({mode,enemies,scale:'standard',seed:44277});
const empty=g=>{g.units=[];g.byId=new Map(g.buildings.map(b=>[b.id,b]));for(const s of g.teams)s.count=0;g.hash.rebuild(g.units);};
const atFlag=(g,team,n)=>{const f=g.objectives[0];for(let i=0;i<n;i++)g.addUnit(team,'infantry',f.x+(i%3)*.1,f.y+Math.floor(i/3)*.1);g.hash.rebuild(g.units);};
test('Thirty seconds of actual dominance awards exactly eight stronger troops, even at supply limit',()=>{
  const g=make();empty(g);atFlag(g,0,10);g.teams[0].cap=10;g.updateObjectives(29);assert.equal(g.objectiveScores[0],0);g.updateObjectives(1);
  const elites=g.units.filter(u=>u.elite);assert.equal(elites.length,8);assert.equal(g.objectiveScores[0],1);assert.ok(elites.every(u=>u.maxHp===UNIT_DEFS[u.type].hp*1.5));assert.equal(g.objectives[0].cooldownUntil,20);
  g.updateObjectives(100);assert.equal(g.objectiveScores[0],1);
});
test('Contested and empty time freeze progress; dominance at exactly 90% counts',()=>{
  const g=make();empty(g);const f=g.objectives[0];atFlag(g,0,9);g.updateObjectives(12);atFlag(g,1,2);g.updateObjectives(18);assert.equal(f.progress[0],12);assert.equal(f.contested,true);
  g.units.find(u=>u.team===1).hp=0;g.hash.rebuild(g.units);g.updateObjectives(4);assert.equal(f.progress[0],16);assert.equal(f.controller,0);
  for(const u of g.units)u.hp=0;g.hash.rebuild(g.units);g.updateObjectives(90);assert.equal(f.progress[0],16);
});
test('A rival can build its own hold time without erasing earlier progress',()=>{
  const g=make();empty(g);const f=g.objectives[0];atFlag(g,0,6);g.updateObjectives(14);for(const u of g.units)u.hp=0;atFlag(g,1,6);g.updateObjectives(9);
  assert.equal(f.progress[0],14);assert.equal(f.progress[1],9);for(const u of g.units)u.hp=0;atFlag(g,0,6);g.updateObjectives(16);assert.equal(g.objectiveScores[0],1);assert.equal(f.progress[1],9);
});
test('Team soldiers combine flag control and share eight elite reinforcements',()=>{
  const g=make('team-bannerfall');empty(g);atFlag(g,0,4);atFlag(g,1,5);atFlag(g,2,1);g.updateObjectives(30);
  assert.equal(g.objectiveScores[0],1);assert.equal(g.units.filter(u=>u.elite&&u.team===0).length,4);assert.equal(g.units.filter(u=>u.elite&&u.team===1).length,4);
});
test('Town hall upgrades increase health, range, firepower, footprint and retain damage percentage',()=>{
  const g=make(),h=g.buildings[0];g.teams[0].gold=3000;h.hp=h.maxHp/2;const one=g.townHallDetails();assert.equal(g.upgradeTownHall().ok,true);const two=g.townHallDetails();assert.equal(two.hp/two.maxHp,.5);assert.equal(two.maxHp,4500);assert.equal(g.upgradeTownHall().ok,true);const three=g.townHallDetails();assert.equal(three.maxHp,7500);assert.ok(three.damage>two.damage&&two.damage>one.damage);assert.ok(three.range>two.range&&two.range>one.range);assert.ok(three.radius>two.radius&&two.radius>one.radius);assert.equal(g.upgradeTownHall().ok,false);
});
test('A destroyed capital immediately wipes its entire faction and prevents late projectiles',()=>{
  const g=make(),h=g.buildings.find(b=>b.team===1&&b.type==='keep');g.projectiles.push({team:1});g.addFireZone(1,30,30,2,5,10);g.damage(h,h.maxHp+1,{team:0});
  assert.equal(g.teams[1].alive,false);assert.equal(g.group(1).length,0);assert.ok(g.buildings.filter(b=>b.team===1).every(b=>b.hp<=0));assert.ok(g.tiles.every(t=>t.owner!==1));assert.equal(g.projectiles.filter(p=>p.team===1).length,0);const u=g.group(0)[0],hp=u.hp;g.damage(u,20,{team:1});assert.equal(u.hp,hp);
});
test('Player capital loss ends the match immediately even with a surviving teammate',()=>{
  const g=make('team-conquest');g.damage(g.buildings[0],3000,{team:2});assert.equal(g.teams[0].alive,false);assert.equal(g.teams[1].alive,true);assert.ok(g.hostile(g.winner,0));assert.equal(g.victoryReason,'Your town hall was destroyed');
});
test('Allies cannot be targeted, damaged by direct hits, splash, poison, fire or cavalry',()=>{
  const g=make('team-conquest');empty(g);const a=g.addUnit(0,'cavalry',50,50),b=g.addUnit(1,'infantry',50.8,50);g.hash.rebuild(g.units);const hp=b.hp;assert.equal(g.findTarget(a),null);g.attack(a,b);g.damage(b,500,{team:0});assert.equal(b.hp,hp);
  g.siegeImpact({team:0,tx:b.x,ty:b.y,damage:100,siegeBaseDamage:100});g.addFireZone(0,b.x,b.y,2,5,100);g.updateHouseEffects(.1);assert.equal(b.hp,hp);
  b.poisonUntil=10;b.poisonTeam=0;g.updateUnits(.03);assert.equal(b.hp,hp);
  a.charging=true;a.chargeDir={x:1,y:0};a.momentum=1;g.chargeContact(a,49.4,50,.03);assert.equal(b.hp,hp);
});
test('Friendly territory cannot be stolen; allies support territorial capture together',()=>{
  const g=make('team-conquest');empty(g);const tile=g.tileAt(50.5,50.5);tile.owner=1;assert.equal(g.canCapture(tile,0),false);tile.owner=-1;g.tileAt(49.5,50.5).owner=1;assert.equal(g.canCapture(tile,0),true);
  g.addUnit(0,'infantry',50.5,50.5);g.addUnit(1,'infantry',50.5,50.5);g.capture(10);assert.ok(g.allied(tile.owner,0));
});
test('Bannerfall ends at five standards; Capital Conquest never ends from territory alone',()=>{
  const g=make('bannerfall');for(let i=0;i<5;i++)g.awardObjective(g.objectives[0],0);assert.equal(g.winner,0);
  const c=make();c.time=120;c.teams[0].tiles=c.playable;c.checkVictory();assert.equal(c.winner,null);
});
test('Team Dominion combines allies territory and all modes allow capital elimination victories',()=>{
  const g=make('team-dominion');g.time=100;g.teams[0].tiles=g.playable*.34;g.teams[1].tiles=g.playable*.34;g.checkVictory();assert.equal(g.winner,0);
  for(const mode of ['conquest','bannerfall','dominion','team-conquest','team-bannerfall','team-dominion']){const c=make(mode);for(const s of c.teams)if(c.hostile(s.id,0))c.damage(c.buildings.find(b=>b.team===s.id&&b.type==='keep'),1e6,{team:0});assert.equal(c.winner,0,mode);}
});
test('Coordination calls validate map targets and protect player requests from bot replacement',()=>{
  const g=make('team-conquest');assert.equal(g.callTeamOrder('assault',NaN,20).ok,false);assert.equal(g.callTeamOrder('defend',0,0).ok,false);assert.equal(g.callTeamOrder('assault',50,50).ok,true);assert.equal(g.teamOrders[0].launchAt,8);assert.equal(g.callTeamOrder('assault',60,60,1).ok,false);assert.equal(g.teamOrders[0].x,50);assert.equal(g.callTeamOrder('defend',30,30).ok,true);assert.equal(g.teamOrders.find(o=>o.kind==='defend').launchAt,0);
});
test('All sixteen factions have valid alliances and objective progress arrays on every map size',()=>{
  for(const scale of ['standard','epic','continent']){const g=new Game({mode:'team-bannerfall',enemies:15,scale});assert.equal(g.teams.length,16);assert.equal(g.objectiveScores.length,8);assert.ok(g.objectives.every(o=>o.progress.length===8));for(const s of g.teams)assert.equal(g.allied(s.id,s.id^1),true);}
});
console.log(`${passed} campaign checks passed.`);
