import assert from 'node:assert/strict';
import {Game} from '../../core.js';
import {WarVision} from '../../vision.js';
import {evaluateRivals,campaignRoute} from '../../rival-intelligence.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,...config});
  g.units=[];g.buildings=[];g.castles=[];g.objectives=[];g.byId.clear();g.time=100;
  for(const tile of g.tiles){tile.terrain=tile.x>0&&tile.y>0&&tile.x<g.W-1&&tile.y<g.H-1?'grass':'water';tile.feature=null;tile.owner=-1;tile.claim=-1;tile.capture=0;}
  for(const s of g.teams){s.alive=true;s.tiles=0;s.count=0;s.cap=1000;s.aiClock=1e9;s.aiPlan=null;}
  g.navigation.invalidate();g.vision=new WarVision(g);
  const s=g.teams[1];s.home={x:20.5,y:30.5};
  const keep=g.addBuilding(s.id,'keep',s.home.x,s.home.y);
  for(let i=0;i<70;i++)g.addUnit(s.id,'infantry',19+(i%10)*.3,29+Math.floor(i/10)*.3);
  const player=g.addBuilding(0,'keep',55.5,30.5),rival=g.addBuilding(2,'keep',80.5,60.5);
  return {g,s,keep,player,rival,plan:{style:'mass',reserve:.22}};
}
const refresh=g=>{g.recount();g.hash.rebuild(g.units);g.vision.update(true);};
const addArmy=(g,team,n,point)=>{for(let i=0;i<n;i++)g.addUnit(team,'infantry',point.x+(i%10)*.2,point.y+Math.floor(i/10)*.2);};
const digest=report=>report.rivals.map(r=>({team:r.team,threat:r.strategicThreat,opportunity:r.invasionOpportunity,danger:r.immediateDanger,risk:r.costRisk,strength:r.knownStrength,land:r.knownTerritory,confidence:r.confidence,targets:r.targets.map(t=>({id:t.target.id,x:t.target.x,y:t.target.y,hp:t.target.hp,guards:t.guards,feasible:t.feasible}))}));

test('A shared terrain survey retains legal routes, weighted costs and crossings for every movement class',()=>{
  const g=new Game({landscape:'riverlands',scale:'standard',enemies:3,seed:44277}),home=g.teams[1].home;
  for(const kind of ['infantry','cavalry','siege'])for(const target of [...g.teams.map(t=>t.home),...g.castles.filter(c=>c.ruined)]){
    const reference=g.navigation.route(home,target,kind),route=campaignRoute(g,home,target,kind);assert.equal(route.reachable,reference.reachable);
    if(!route.reachable)continue;
    assert.ok(Math.abs(route.cost-reference.cost)<.025,'The same terrain weights produce the same shortest-route cost within Float32 rounding.');
    for(let i=1;i<route.points.length;i++)assert.ok(g.navigation.clearSegment(route.points[i-1],route.points[i]),'Survey routes never cross an illegal corner or water tile.');
    for(const crossing of route.crossings)assert.equal(g.tileAt(crossing.x,crossing.y).feature,crossing.kind);
  }
});

test('Candidate routes reuse one survey and invalidate when public terrain or the origin changes',()=>{
  const {g,s,player,rival}=fixture();
  const before=g.navigation.stats.fieldBuilds,one=campaignRoute(g,s.home,player),two=campaignRoute(g,s.home,rival);
  assert.ok(one.reachable&&two.reachable);assert.equal(g.navigation.stats.fieldBuilds-before,1);assert.equal(campaignRoute(g,s.home,player),one);
  player.hp=1;g.teams[0].gold=1e9;assert.equal(campaignRoute(g,s.home,player),one,'Private damage and resources never invalidate public route geometry.');
  const shifted=campaignRoute(g,{x:s.home.x+.1,y:s.home.y+.1},player);assert.notEqual(shifted,one);assert.notEqual(shifted.distance,one.distance);
  for(const tile of g.tiles)if(tile.x===40)tile.terrain='water';g.navigation.invalidate();assert.equal(campaignRoute(g,s.home,player).reachable,false);
});

test('Comparable dominant player and AI houses receive the same strategic assessment',()=>{
  const a=fixture(),b=fixture();
  addArmy(a.g,0,110,a.player);addArmy(a.g,2,8,a.rival);
  addArmy(b.g,2,110,b.player);addArmy(b.g,0,8,b.rival);
  [b.player.team,b.rival.team]=[2,0];
  for(let i=0;i<700;i++){a.g.tiles[i].owner=0;b.g.tiles[i].owner=2;}
  refresh(a.g);refresh(b.g);
  const ar=evaluateRivals(a.g,a.s,a.plan),br=evaluateRivals(b.g,b.s,b.plan);
  assert.equal(ar.strategicTarget.team,0);assert.equal(br.strategicTarget.team,2);
  assert.equal(ar.strategicTarget.strategicThreat,br.strategicTarget.strategicThreat);
});

test('A weak reachable player is an opportunity while a powerful AI remains the strategic threat',()=>{
  const {g,s,plan,player,rival}=fixture();addArmy(g,0,3,player);addArmy(g,2,110,rival);refresh(g);
  const report=evaluateRivals(g,s,plan),weak=report.rivals.find(r=>r.team===0),strong=report.rivals.find(r=>r.team===2);
  assert.equal(report.strategicTarget.team,2);assert.equal(report.invasionTarget.team,0);
  assert.ok(weak.invasionOpportunity>strong.invasionOpportunity);assert.ok(strong.strategicThreat>weak.strategicThreat);
  assert.equal(weak.targets[0].feasible,true);assert.equal(strong.targets[0].feasible,false);
  [player.team,rival.team]=[2,0];for(const u of g.units)if(u.team!==s.id)u.team=u.team===0?2:0;refresh(g);
  assert.equal(evaluateRivals(g,s,plan).invasionTarget.team,2,'A weak AI receives the same opportunity assessment.');
});

test('Immediate visible attacks are distinct from the greatest distant strategic threat',()=>{
  const {g,s,plan,rival}=fixture();addArmy(g,2,120,rival);addArmy(g,0,16,{x:25.5,y:30.5});refresh(g);
  const report=evaluateRivals(g,s,plan);
  assert.equal(report.strategicTarget.team,2);assert.equal(report.immediateTarget.team,0);assert.equal(report.immediateTarget.kind,'castle');
  assert.ok(report.immediateTarget.immediateDanger>=35);assert.ok(report.reserveStrength>=10);assert.ok(report.availableStrength<report.ownStrength);
});

test('Unseen armies, construction, losses, realm totals and private resources cannot change scores',()=>{
  const a=fixture({fogOfWar:true}),b=fixture({fogOfWar:true});
  addArmy(a.g,0,15,a.player);addArmy(b.g,0,15,b.player);refresh(a.g);refresh(b.g);
  for(const u of b.g.units)if(u.team===0){u.x=91;u.y=83;u.hp=1;u.type='cavalry';}
  b.player.hp=1;b.player.x=95;b.player.y=70;b.g.addBuilding(0,'tower',85,75);b.g.teams[0].gold=1e9;b.g.teams[0].tiles=50000;b.g.teams[0].keeps=30;b.g.teams[0].kills=500;
  b.g.teams[0].alive=false;b.g.time+=1;a.g.time+=1;refresh(a.g);b.g.hash.rebuild(b.g.units);b.g.vision.update(true);
  assert.deepEqual(digest(evaluateRivals(a.g,a.s,a.plan)),digest(evaluateRivals(b.g,b.s,b.plan)));
  assert.equal(evaluateRivals(a.g,a.s,a.plan).invasionTarget,null);
});

test('Scouts create frozen army memory that decays without following hidden movement or death',()=>{
  const {g,s,plan,player}=fixture({fogOfWar:true}),scout=g.addUnit(s.id,'cavalry',50.5,30.5);
  addArmy(g,0,12,{x:55.5,y:30.5});refresh(g);
  const observed=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0);assert.ok(observed.knownStrength>=12);
  scout.x=20;scout.y=30;g.time+=1;refresh(g);
  const memory=g.vision.campaignUnits(s.id).find(u=>u.team===0);assert.ok(memory.remembered&&Object.isFrozen(memory));
  assert.equal(g.knownUnits(s.id).some(u=>u.team===0),false,'Tactical acquisition must not receive remembered armies.');
  const before=digest(evaluateRivals(g,s,plan));
  for(const u of g.units)if(u.team===0){u.x=90;u.y=90;u.hp=0;}player.hp=1;player.level=3;player.x=85;
  g.vision.update(true);assert.deepEqual(digest(evaluateRivals(g,s,plan)),before);
  g.time+=45;g.vision.update(true);const stale=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0);
  assert.ok(stale.knownStrength<observed.knownStrength*.5);assert.ok(stale.confidence<observed.confidence);assert.ok(evaluateRivals(g,s,plan).scoutTargets.some(p=>p.targetId===player.id));
  g.time+=80;g.vision.update(true);assert.equal(g.vision.campaignUnits(s.id).some(u=>u.team===0),false,'Mobile observations expire after a bounded two minutes.');
});

test('Rescouting an empty old position disproves mobile memory without revealing its new location',()=>{
  const {g,s}=fixture({fogOfWar:true}),scout=g.addUnit(s.id,'cavalry',50.5,30.5),enemy=g.addUnit(0,'infantry',55.5,30.5);refresh(g);
  scout.x=20;g.time++;refresh(g);enemy.x=95;enemy.y=80;g.time++;refresh(g);
  assert.equal(g.vision.campaignUnits(s.id).find(u=>u.id===enemy.id).x,55.5);
  scout.x=50.5;g.time++;refresh(g);assert.equal(g.vision.campaignUnits(s.id).some(u=>u.id===enemy.id),false);
});

test('Cached reports retain frozen observations after a currently visible enemy leaves sight',()=>{
  const {g,s,plan,player}=fixture({fogOfWar:true}),scout=g.addUnit(s.id,'cavalry',50.5,30.5),enemy=g.addUnit(0,'infantry',55.5,30.5);refresh(g);
  const report=evaluateRivals(g,s,plan),target=report.rivals.find(r=>r.team===0).targets[0].target;
  assert.ok(Object.isFrozen(target));assert.equal(target.x,55.5);assert.equal(target.hp,2500);
  scout.x=20;g.time++;refresh(g);player.hp=0;player.x=90;enemy.x=90;enemy.hp=0;
  assert.equal(target.hp,2500);assert.equal(target.x,55.5);assert.equal(report.rivals.find(r=>r.team===0).knownStrength,1);
});

test('Known elite types and observed armor matter without consulting hidden upgrades',()=>{
  const {g,s,plan,player}=fixture({fogOfWar:true}),scout=g.addUnit(s.id,'cavalry',50.5,30.5),enemy=g.addUnit(0,'infantry',55.5,30.5);refresh(g);
  const ordinary=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).knownStrength;
  enemy.type='winter_guard';enemy.maxHp=enemy.hp=212;refresh(g);const elite=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).knownStrength;assert.ok(elite>ordinary);
  scout.x=20;g.time++;refresh(g);const before=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).knownStrength;
  g.teams[0].upgrades.armor=50;g.teams[0].upgrades.weapons=50;enemy.hp=enemy.maxHp=50000;player.level=3;
  assert.equal(evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).knownStrength,before);
});

test('Allied reconnaissance is shared and allied houses are never invasion candidates',()=>{
  const {g,s,plan}=fixture({fogOfWar:true,mode:'team-conquest'});
  const allyScout=g.addUnit(0,'cavalry',75.5,60.5);addArmy(g,2,10,{x:80.5,y:60.5});refresh(g);
  const report=evaluateRivals(g,s,plan);assert.ok(report.rivals.find(r=>r.team===2).knownStrength>=10);assert.ok(report.rivals.every(r=>!g.allied(s.id,r.team)));
  assert.ok(report.rivals.flatMap(r=>r.targets).every(t=>!g.allied(s.id,t.team)));
  allyScout.x=10;allyScout.y=10;g.time++;refresh(g);assert.ok(g.vision.campaignUnits(s.id).some(u=>u.team===2&&u.remembered));
});

test('Public mode scores affect strategic danger while hidden capture progress does not',()=>{
  for(const mode of ['bannerfall','team-bannerfall','crown-control','blitz-flags','defend-king','dominion','team-dominion','conquest','team-conquest']){
    const {g,s,plan}=fixture({mode,fogOfWar:true});refresh(g);
    const opponent=g.teams.find(t=>g.hostile(s.id,t.id)),before=evaluateRivals(g,s,plan).rivals.find(r=>r.team===opponent.id).strategicThreat;
    const flag={id:999,x:90,y:90,radius:4,controller:null,progress:Array(g.objectiveScores.length).fill(0)};g.objectives=[flag];
    flag.progress[opponent.alliance]=100;flag.controller=opponent.alliance;
    assert.equal(evaluateRivals(g,s,plan).rivals.find(r=>r.team===opponent.id).strategicThreat,before,mode+' hides private flag progress.');
    if(g.mode.objectiveGoal||g.mode.controlGoal||g.mode.flagWaves){g.objectiveScores[opponent.alliance]=4;g.controlScores[opponent.alliance]=110;assert.ok(evaluateRivals(g,s,plan).rivals.find(r=>r.team===opponent.id).strategicThreat>before,mode+' uses public scores.');}
  }
});

test('Observed expansion and castle conquests survive a ruined intermediate and replacement keep',()=>{
  for(const fogOfWar of [false,true]){
    const {g,s,plan}=fixture({fogOfWar}),scout=g.addUnit(s.id,'cavalry',50.5,30.5),site=g.createCastleSite({x:55.5,y:30.5},2,777),tile=g.tileAt(54.5,30.5);
    tile.owner=2;refresh(g);evaluateRivals(g,s,plan);
    site.team=-1;site.ruined=true;site.buildingId=null;g.time++;refresh(g);evaluateRivals(g,s,plan);
    site.team=0;site.ruined=false;site.buildingId=888;tile.owner=0;g.time++;refresh(g);
    const response=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0);
    assert.ok(response.recentExpansion>=8,'Visible replacement ownership supplies evidence of victory, fog='+fogOfWar);
    const before=response.strategicThreat;g.time+=120;refresh(g);assert.ok(evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).strategicThreat<before,'Recent conquests decay rather than permanently adding hostility.');
    assert.ok(scout.hp>0);
  }
});

test('Unseen castle conquests and territorial losses do not invent expansion or victory reports',()=>{
  const {g,s,plan}=fixture({fogOfWar:true}),scout=g.addUnit(s.id,'cavalry',50.5,30.5),site=g.createCastleSite({x:55.5,y:30.5},2,777),tile=g.tileAt(54.5,30.5);
  tile.owner=2;refresh(g);evaluateRivals(g,s,plan);scout.x=20.5;g.time++;refresh(g);
  site.team=-1;site.ruined=true;g.time++;refresh(g);site.team=0;site.ruined=false;site.buildingId=888;tile.owner=0;g.time++;refresh(g);
  const response=evaluateRivals(g,s,plan).rivals.find(r=>r.team===0);
  assert.equal(response.recentExpansion,0);assert.equal(response.knownTerritory,0);
  scout.x=50.5;g.time++;refresh(g);assert.ok(evaluateRivals(g,s,plan).rivals.find(r=>r.team===0).recentExpansion>=8);
});

test('Another visible war increases the cost of a remote offensive without reading hostile orders',()=>{
  const {g,s,plan,rival}=fixture();refresh(g);const before=evaluateRivals(g,s,plan).rivals.find(r=>r.team===rival.team).costRisk;
  addArmy(g,3,18,{x:25.5,y:30.5});refresh(g);const after=evaluateRivals(g,s,plan).rivals.find(r=>r.team===rival.team).costRisk;
  assert.ok(after>before);for(const u of g.units)if(u.team===3)u.order={mode:'hold',aiTask:'nothing',x:90,y:80};
  assert.equal(evaluateRivals(g,s,plan).rivals.find(r=>r.team===rival.team).costRisk,after,'Private orders do not change observed risk.');
});

console.log(`${cases} campaign intelligence checks passed.`);
