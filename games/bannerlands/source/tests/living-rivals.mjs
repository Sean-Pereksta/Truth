import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,...config});
  g.castles=g.castles.filter(c=>!c.ruined);g.objectives=[];
  for(const s of g.teams){s.gold=0;s.powerReadyAt=1e9;s.aiClock=1e9;}
  // A deployment away from home creates a real opening without altering armies.
  for(const u of g.units)if(u.team!==1){u.x=g.W*.5+(u.id%5)*.4;u.y=g.H*.5+Math.floor(u.id%25/5)*.4;}
  const s=g.teams[1];s.strategy='mass';const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;
  return {g,s,p};
}
function launch(f){f.g.time=90;f.p.nextAttackAt=0;f.g.hash.rebuild(f.g.units);f.g.ai(f.s);return f;}

test('A viable committed invasion retains its target when campaign leadership changes',()=>{
  const f=launch(fixture({difficulty:'veteran'})),{g,s,p}=f;
  assert.equal(p.phase,'advance');const target=p.targetId,cohort=[...p.cohort],orders=cohort.map(id=>g.byId.get(id).order);
  const rival=g.teams.find(t=>g.hostile(s.id,t.id)&&t.id!==p.targetTeam);
  for(let i=0;i<180;i++)g.addUnit(rival.id,'infantry',rival.home.x+(i%5)*.1,rival.home.y+Math.floor(i/5)*.1);
  for(let i=0;i<5;i++){g.time+=6;g.hash.rebuild(g.units);g.ai(s);}
  assert.equal(p.targetId,target);assert.deepEqual(p.cohort,cohort);for(let i=0;i<cohort.length;i++)assert.equal(g.byId.get(cohort[i]).order,orders[i]);
});

test('A nearby visible attack recalls an invasion and retains a capital reserve',()=>{
  const {g,s,p}=launch(fixture({difficulty:'warlord'}));const target=g.byId.get(p.targetId);
  for(let i=0;i<12;i++)g.addUnit(target.team,'infantry',s.home.x+3+(i%3)*.3,s.home.y+Math.floor(i/3)*.3);
  g.time+=4;g.hash.rebuild(g.units);g.ai(s);assert.equal(p.phase,'defend');
  const army=g.group(s.id);assert.ok(army.filter(u=>u.order?.aiTask==='defend').length>=20);assert.ok(army.some(u=>u.order?.aiTask!=='defend'));
  assert.equal(p.cohort.length,0);assert.equal(p.secondary,null);
});

test('Own battlefield losses trigger bounded recovery before another major offensive',()=>{
  const {g,s,p}=launch(fixture());const soldiers=g.group(s.id),survivors=soldiers.slice(0,24);
  for(const u of soldiers.slice(24))u.hp=0;g.time+=3;g.hash.rebuild(g.units);g.ai(s);
  assert.equal(p.role,'rebuild');assert.ok(p.rebuildUntil>g.time);assert.notEqual(p.phase,'advance');
  for(const u of survivors)assert.ok(!['assault','raid'].includes(u.order?.aiTask));
});

test('Remote owned castles keep a persistent guard while a main army deploys',()=>{
  const f=fixture(),{g,s,p}=f;const site=g.navigation.nearestPassable({x:s.home.x+(s.home.x>g.W/2?-12:12),y:s.home.y+(s.home.y>g.H/2?-5:5)}),keep=g.addBuilding(s.id,'keep',site.x,site.y);
  launch(f);const guards=g.group(s.id).filter(u=>u.order?.aiTask==='castleGuard'&&u.order.aiCastle===keep.id);assert.ok(guards.length>=3);assert.ok(guards.every(u=>!p.cohort.includes(u.id)));
  const orders=guards.map(u=>u.order);g.time+=3;g.ai(s);for(let i=0;i<guards.length;i++)assert.equal(guards[i].order,orders[i]);
});

test('A stale fortified observation is investigated before launching a new invasion',()=>{
  const {g,s,p}=fixture({fogOfWar:true}),enemy=g.buildings.find(b=>g.hostile(s.id,b.team)&&b.type==='keep');
  g.time=100;const scout=g.group(s.id)[0];scout.x=enemy.x-4;scout.y=enemy.y;g.hash.rebuild(g.units);g.vision.update(true);
  const observation={...enemy,remembered:true,lastSeen:20};
  assert.equal(g.aiAttackReady(s,p,observation),false);assert.equal(p.uncertainTarget.id,enemy.id);
  assert.equal(g.aiAttackReady(s,p,{...observation,lastSeen:95}),true);
});

function observedFogFront(){
  const f=fixture({fogOfWar:true}),{g,s,p}=f,enemy=g.buildings.find(b=>g.hostile(s.id,b.team)&&b.type==='keep'),scout=g.group(s.id)[0];
  g.time=100;scout.x=enemy.x-4;scout.y=enemy.y;g.hash.rebuild(g.units);g.vision.update(true);
  const report=g.aiCampaignAssessment(s,p),cached=report.rivals.flatMap(r=>r.targets).find(t=>t.target.id===enemy.id).target;
  assert.equal(g.aiAttackReady(s,p,cached),true);return {...f,enemy,scout,cached};
}

test('A visible allied acquisition invalidates a stale hostile cached invasion fallback',()=>{
  const {g,s,p,enemy,cached}=observedFogFront(),oldTeam=enemy.team;
  enemy.team=s.id;
  for(const b of g.buildings)if(b.team===oldTeam&&(b.x-enemy.x)**2+(b.y-enemy.y)**2<144)b.hp=0;
  g.vision.update(true);
  assert.equal(g.aiAttackReady(s,p,cached),false,'Current legitimate ownership overrides the cached hostile record.');
  assert.equal(g.aiPreparedTarget(s,p,null,g.group(s.id)),null,'Cached hostile production observations also expire after visible destruction.');
});

test('Hidden hostile ownership and damage changes cannot invalidate remembered preparation',()=>{
  const a=observedFogFront(),b=observedFogFront();
  for(const f of [a,b]){f.scout.x=f.s.home.x;f.scout.y=f.s.home.y;f.g.time=101;f.g.hash.rebuild(f.g.units);f.g.vision.update(true);assert.equal(f.g.isVisibleTo(f.s.id,f.enemy),false);}
  b.enemy.team=2;b.enemy.hp=1;
  for(const f of [a,b]){f.g.time=102;f.g.vision.update(true);}
  assert.equal(a.g.aiAttackReady(a.s,a.p,a.cached),true);assert.equal(b.g.aiAttackReady(b.s,b.p,b.cached),true);
  assert.equal(b.g.knownBuildings(b.s.id).find(x=>x.id===b.enemy.id).team,a.enemy.team);
});

test('Warlord surplus troops open a second exposed front without taking either garrison',()=>{
  const f=launch(fixture({difficulty:'warlord'})),{g,s,p}=f;assert.equal(p.phase,'advance');
  const target=g.buildings.find(b=>g.hostile(s.id,b.team)&&b.type==='barracks');target.hp=target.maxHp*.2;
  for(let i=0;i<75;i++)g.addUnit(s.id,i%3?'infantry':'cavalry',s.home.x+2+(i%5)*.3,s.home.y+Math.floor(i/5)*.15);
  g.time+=5;g.rivalAssessments.clear();g.hash.rebuild(g.units);g.ai(s);assert.ok(p.secondary,'Enough fresh troops and a feasible exposed production site permit a second front.');
  const main=new Set(p.cohort);assert.ok(p.secondary.cohort.length>=12);assert.ok(p.secondary.cohort.every(id=>!main.has(id)));
  assert.ok(g.group(s.id).filter(u=>!main.has(u.id)&&!p.secondary.cohort.includes(u.id)).length>=10);
});

test('Adaptive intent follows public objectives and never converts a king into an invasion soldier',()=>{
  for(const mode of ['conquest','dominion','bannerfall','team-conquest','team-dominion','team-bannerfall','crown-control','blitz-flags','defend-king']){
    const g=new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,mode,difficulty:'veteran'}),s=g.teams[1];g.time=25;if(g.mode.kingSurvival)g.updateObjectives(0);g.ai(s);const p=g.aiPlanFor(s);
    if(g.mode.flagPriority||g.mode.objectiveGoal||g.mode.kingSurvival)assert.equal(p.role,'objective',mode);
    if(g.mode.kingSurvival)assert.ok(!p.cohort.includes(g.kingFor(s.id).id));
    for(const u of g.group(s.id))if(u.order?.aiTarget){const target=g.byId.get(u.order.aiTarget);if(target)assert.ok(g.hostile(s.id,target.team));}
  }
});

test('An overwhelmingly defended campaign leads to preparation rather than an unsupported attack',()=>{
  const {g,s,p}=fixture({difficulty:'warlord'});
  for(const opponent of g.teams)if(g.hostile(s.id,opponent.id)){
    for(const u of g.group(opponent.id)){u.x=opponent.home.x+(u.id%5)*.2;u.y=opponent.home.y+Math.floor(u.id%25/5)*.2;}
    for(let i=0;i<90;i++)g.addUnit(opponent.id,'infantry',opponent.home.x+(i%5)*.25,opponent.home.y+Math.floor(i/5)*.18);
  }
  g.time=90;p.nextAttackAt=0;g.hash.rebuild(g.units);g.ai(s);
  assert.equal(p.phase,'muster');assert.ok(!g.group(s.id).some(u=>['assault','raid'].includes(u.order?.aiTask)));assert.match(p.preparationReason,/healthy troops/);
});

test('A comparable dominant AI or player causes the same counterweight decision',()=>{
  const outcomes=[];
  for(const dominant of [0,2]){
    const {g,s,p}=fixture({difficulty:'veteran'}),opponent=g.teams[dominant];
    // Swap ownership of an otherwise identical exposed front. Geometry and
    // defender positions are identical for the player and AI comparisons.
    for(const team of g.teams){const old={...team.home},point=team.id===1?{x:40.5,y:40.5}:team.id===dominant?{x:70.5,y:40.5}:team.id===3?{x:90.5,y:85.5}:{x:40.5,y:70.5};team.home=point;for(const b of g.buildings)if(b.team===team.id){b.x=point.x+b.x-old.x;b.y=point.y+b.y-old.y;}}
    for(const u of g.group(s.id)){u.x=s.home.x+(u.id%7)*.3;u.y=s.home.y+Math.floor(u.id%49/7)*.3;}
    const staging=g.navigation.nearestPassable({x:g.W*.5,y:g.H*.5});
    for(let i=0;i<180;i++)g.addUnit(dominant,'infantry',staging.x+(i%5)*.1,staging.y+Math.floor(i/5)*.1);
    for(const tile of g.tiles)if(tile.x>g.W*.28&&tile.x<g.W*.72&&tile.y>g.H*.3&&tile.y<g.H*.65)tile.owner=dominant;
    g.recount();g.time=90;p.nextAttackAt=0;g.hash.rebuild(g.units);g.ai(s);
    assert.equal(p.role,'counterweight');assert.equal(p.intentTeam,opponent.id);
    assert.equal(p.phase,'advance','The observed, viable dominant front receives an actual response.');
    assert.equal(g.byId.get(p.targetId)?.team,dominant,'The company contests the dominant house rather than an unrelated neighbor.');
    assert.ok(p.cohort.length>=p.min);assert.ok(p.cohort.every(id=>g.byId.get(id).order?.aiTarget===p.targetId));
    assert.ok(g.group(s.id).filter(u=>!p.cohort.includes(u.id)).length>=10,'Counterweight action retains home defenses.');
    outcomes.push({role:p.role,attacking:p.phase==='advance',target:g.byId.get(p.targetId)?.team===dominant});
  }
  assert.deepEqual(outcomes[0],outcomes[1]);
});

test('Legacy plans gain adaptive state while preserving a viable deployed company',()=>{
  const {g,s,p}=launch(fixture());const cohort=[...p.cohort],target=p.targetId;
  for(const key of ['baseStyle','baseFraction','baseReserve','baseExpansion','role','roleUntil','secondary'])delete p[key];
  g.time+=3;g.ai(s);assert.equal(s.aiPlan,p);assert.deepEqual(p.cohort,cohort);assert.equal(p.targetId,target);assert.equal(p.baseStyle,p.style);assert.ok(p.role);
});

console.log(checks+' living rival scenarios passed.');
