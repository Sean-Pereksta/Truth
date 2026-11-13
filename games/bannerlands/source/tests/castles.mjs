import assert from 'node:assert/strict';
import {Game} from '../../core.js';
import {LAND_MAPS,isPassableTile} from '../../lands.js';
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const make=(config={})=>new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,...config});
const empty=g=>{g.units=[];for(const s of g.teams)s.count=0;g.hash.rebuild(g.units);};
const occupy=(g,site,team,n)=>{for(let i=0;i<n;i++)g.addUnit(team,'infantry',site.x+(i%3)*.1,site.y+Math.floor(i/3)*.1);g.hash.rebuild(g.units);};

test('Castle ruins stay sparse, reachable and clear on every landscape and map size with sixteen factions',()=>{
  for(const {id:landscape}of LAND_MAPS)for(const [scale,count]of [['standard',3],['epic',5],['continent',6]]){
    const g=make({scale,enemies:15,landscape}),ruins=g.castles.filter(c=>c.ruined);
    assert.equal(ruins.length,count,`${landscape} ${scale}`);assert.equal(g.castles.filter(c=>!c.ruined).length,16);
    for(const c of ruins){assert.ok(isPassableTile(g.tileAt(c.x,c.y)));assert.ok(g.teams.some(s=>g.navigation.route(s.home,c).reachable));assert.ok(g.teams.every(s=>Math.hypot(s.home.x-c.x,s.home.y-c.y)>=14));assert.ok(g.objectives.every(o=>Math.hypot(o.x-c.x,o.y-c.y)>=9));assert.ok(ruins.every(o=>o===c||Math.hypot(o.x-c.x,o.y-c.y)>=18));assert.equal(c.progress.length,g.objectiveScores.length);}
  }
});
test('A full minute restores a castle, raises the fixed 280 cap by 60 and claims an eight-tile realm',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined);empty(g);
  for(const tile of g.tiles)if(isPassableTile(tile))tile.owner=0;
  const inside=g.tileAt(site.x+7,site.y),outside=g.tileAt(site.x+9,site.y);inside.owner=1;outside.owner=1;g.recount();const cap=g.teams[0].cap;
  occupy(g,site,0,3);g.updateCastles(59.9);assert.equal(site.ruined,true);g.updateCastles(.1);
  assert.equal(site.ruined,false);assert.equal(site.team,0);assert.equal(g.teams[0].keeps,2);assert.equal(cap,280);assert.equal(g.teams[0].cap,cap+60);assert.equal(g.teams[0].cap,340);assert.equal(inside.owner,0);assert.equal(outside.owner,1);
  const keep=g.byId.get(site.buildingId);assert.equal(keep.type,'keep');assert.equal(keep.restoredCastle,true);assert.equal(keep.castleId,site.id);
});
test('Contested and absent armies pause castle capture exactly like flags; 90 percent counts',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined);empty(g);occupy(g,site,0,9);g.updateCastles(15);occupy(g,site,1,2);g.updateCastles(30);assert.equal(site.progress[0],15);assert.equal(site.contested,true);
  g.units.find(u=>u.team===1).hp=0;g.hash.rebuild(g.units);g.updateCastles(5);assert.equal(site.progress[0],20);assert.equal(site.controller,0);
  for(const u of g.units)u.hp=0;g.hash.rebuild(g.units);g.updateCastles(120);assert.equal(site.progress[0],20);
  occupy(g,site,1,3);g.updateCastles(10);assert.equal(site.progress[1],10);assert.equal(site.progress[0],20);
});
test('Allied troops share hold time, award the locally strongest house and preserve allied territory',()=>{
  const g=make({mode:'team-conquest'}),site=g.castles.find(c=>c.ruined);empty(g);const tile=g.tileAt(site.x+1,site.y);tile.owner=0;occupy(g,site,0,4);occupy(g,site,1,5);occupy(g,site,2,1);g.updateCastles(60);
  assert.equal(site.team,1);assert.equal(g.teams[1].keeps,2);assert.equal(tile.owner,0);assert.equal(g.tileAt(site.x,site.y).owner,1);
});
test('A faction survives its capital loss, moves home to a remaining castle, and its destroyed castle can be captured anew',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined),original=g.buildings.find(b=>b.team===0&&b.type==='keep');g.captureCastle(site,0);const second=g.byId.get(site.buildingId),before=g.group(0).length;
  g.damage(original,1e6,{team:1});assert.equal(g.teams[0].alive,true);assert.equal(g.group(0).length,before);assert.equal(g.winner,null);assert.deepEqual(g.teams[0].home,{x:second.x,y:second.y});assert.equal(g.teams[0].keeps,1);
  const ruin=g.castles.find(c=>c.id===original.castleId),sites=g.castles.length;assert.equal(ruin.ruined,true);assert.equal(ruin.team,-1);assert.equal(ruin.buildingId,null);assert.ok(ruin.progress.every(n=>n===0));
  empty(g);occupy(g,ruin,1,4);g.updateCastles(60);assert.equal(ruin.team,1);assert.equal(g.castles.length,sites);assert.equal(g.teams[1].keeps,2);
  g.damage(second,1e6,{team:1});assert.equal(g.teams[0].alive,false);assert.equal(g.winner,1);assert.equal(g.victoryReason,'Your last castle was destroyed');assert.equal(site.ruined,true);
});
test('Destroyed castles remove 60 supply immediately; excess surviving troops are retained',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined);g.captureCastle(site,0);const keep=g.byId.get(site.buildingId);for(const tile of g.tiles)if(isPassableTile(tile))tile.owner=0;g.recount();const cap=g.teams[0].cap;
  while(g.teams[0].count<cap)g.addUnit(0,'infantry',site.x+3,site.y+3);g.damage(keep,1e6,{team:1});assert.equal(g.teams[0].cap,cap-60);assert.equal(g.teams[0].count,cap);assert.equal(g.teams[0].alive,true);
});
test('Direct faction elimination turns all owned castle sites into recapturable ruins',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined);g.captureCastle(site,1);const owned=g.castles.filter(c=>c.team===1);assert.equal(owned.length,2);g.eliminate(1);
  assert.equal(g.teams[1].alive,false);assert.ok(owned.every(c=>c.ruined&&c.team===-1&&c.buildingId===null&&c.progress.every(n=>n===0)));assert.equal(g.castles.filter(c=>c.team===1).length,0);
  assert.equal(g.captureCastle(site,2),true);assert.equal(site.team,2);
});
test('Restoration is awarded once and preserves living entity lookup through dead keep cleanup',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined),unit=g.group(0)[0];g.captureCastle(site,0);const first=g.byId.get(site.buildingId),sites=g.castles.length;g.damage(first,1e6,{team:1});
  assert.equal(g.captureCastle(site,2),true);const restored=g.byId.get(site.buildingId),cap=g.teams[2].cap;assert.equal(g.captureCastle(site,2),false);assert.equal(site.captures,2);assert.equal(g.teams[2].cap,cap);assert.equal(g.castles.length,sites);assert.equal(g.byId.get(unit.id),unit);
  for(let i=0;i<7;i++)g.update(.06);assert.equal(g.byId.has(first.id),false);assert.equal(g.byId.get(restored.id),restored);assert.equal(restored.hp>0,true);assert.equal(g.byId.get(unit.id),unit);
});
test('Ruin footprints cannot be covered by ordinary player construction',()=>{
  const g=make(),site=g.castles.find(c=>c.ruined);g.tileAt(site.x,site.y).owner=0;g.teams[0].gold=1e6;const outcome=g.build('barracks',site.x,site.y);assert.equal(outcome.ok,false);assert.match(outcome.message,/castle ruins/i);
});
test('Bots prioritize a reachable ruin, keep a fixed capture company and idle inside its radius',()=>{
  const g=make(),s=g.teams[1];s.gold=0;s.powerReadyAt=1e9;const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;p.nextAttackAt=0;g.time=90;g.hash.rebuild(g.units);g.ai(s);
  assert.equal(p.phase,'objective');assert.equal(p.objectiveKind,'castle');const site=g.castles.find(c=>c.id===p.objectiveId),cohort=[...p.cohort];assert.equal(site.ruined,true);
  for(const id of cohort){const u=g.byId.get(id);u.x=site.x;u.y=site.y;}g.hash.rebuild(g.units);g.time+=3;g.ai(s);assert.deepEqual(p.cohort,cohort);for(const id of cohort)assert.equal(g.byId.get(id).order.mode,'idle');
  g.updateCastles(60);g.time+=3;g.ai(s);assert.equal(site.team,s.id);assert.equal(p.phase,'regroup');
});
test('A successful siege converts its surviving army straight into a castle capture company',()=>{
  const g=make(),s=g.teams[1];s.gold=0;s.powerReadyAt=1e9;const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;p.nextAttackAt=0;for(const c of g.castles)if(c.ruined)c.ruined=false;g.objectives=[];g.time=90;g.hash.rebuild(g.units);g.ai(s);assert.equal(p.phase,'advance');
  const target=g.byId.get(p.targetId);assert.equal(target.type,'keep');g.damage(target,1e6,{team:s.id});g.time+=3;g.hash.rebuild(g.units);g.ai(s);assert.equal(p.phase,'objective');assert.equal(p.objectiveKind,'castle');assert.equal(p.objectiveId,target.castleId);assert.ok(p.cohort.every(id=>g.byId.get(id).order.aiTask==='objective'));
});
console.log(`${passed} castle checks passed.`);
