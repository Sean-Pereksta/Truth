import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
function fixture(){
  const g=new Game({scale:'standard',landscape:'open',enemies:1,seed:44277,fogOfWar:true});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];
  for(const tile of g.tiles){tile.terrain='grass';tile.feature=null;tile.height=0;tile.owner=0;}
  for(const s of g.teams){s.count=0;s.alive=true;s.upgrades.armor=0;s.upgrades.weapons=0;}
  g.navigation.invalidate();return g;
}
function structures(g){
  for(let i=0;i<320;i++){const b=g.addBuilding(i%2,i%4?'barracks':'tower',3+(i%20)*5,3+Math.floor(i/20)*5);if(i%9===0)b.radius=1.3;}
}

test('Local structure queries preserve full-scan geometry and original order across cell and map edges',()=>{
  const g=fixture();structures(g);g.prepareBuildingQueries();
  let seed=44277;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<250;i++){
    const point={x:random()*g.W,y:random()*g.H},radius=i%7*.63;
    for(const includeRadius of [false,true]){
      const hit=b=>b.hp>0&&distance(b,point)<=(radius+(includeRadius?g.buildingRadius(b):0))**2;
      const expected=g.buildings.filter(hit),candidates=g.buildingCandidates(point.x,point.y,radius,includeRadius);
      assert.deepEqual(candidates.filter(hit),expected);
      assert.deepEqual(candidates.map(b=>g.buildings.indexOf(b)),candidates.map(b=>g.buildings.indexOf(b)).sort((a,b)=>a-b),'Tie-breaking and summed pushes retain source order.');
    }
  }
  g.releaseBuildingQueries();
});

test('Scopes observe construction, death, upgrades, replacement arrays and same-time direct external edits',()=>{
  const g=fixture();structures(g);g.prepareBuildingQueries();
  const added=g.addBuilding(0,'tower',20,20);assert.ok(g.buildingCandidates(20,20,.1).includes(added));
  added.hp=0;assert.ok(!g.buildingCandidates(20,20,.1).filter(b=>b.hp>0).includes(added));
  const replacement=g.buildings.slice().reverse();g.buildings=replacement;assert.deepEqual(g.buildingCandidates(20,20,100),replacement.filter(b=>b.hp>0));
  g.prepareBuildingQueries();g.releaseBuildingQueries();assert.ok(g.buildingQueryDepth>0,'Nested batches cannot release their caller\'s index.');
  g.releaseBuildingQueries();
  const moved=g.buildings.find(b=>b.hp>0);moved.x=20;moved.y=20;
  assert.equal(g.buildingCandidates(20,20,.1),g.buildings,'Outside simulation batches direct edits always use the current source.');
  g.prepareBuildingQueries();assert.ok(g.buildingCandidates(20,20,.1).includes(moved));g.releaseBuildingQueries();
  const keep=g.addBuilding(0,'keep',3.99,20);g.teams[0].gold=10000;
  g.prepareBuildingQueries();assert.ok(g.buildingCandidates(5.1,20,.1,true).includes(keep));
  assert.equal(g.upgradeTownHall(0).ok,true);assert.equal(g.upgradeTownHall(0).ok,true);
  assert.ok(g.buildingCandidates(5.3,20,.01,true).includes(keep),'A wider upgraded keep invalidates the batch radius.');g.releaseBuildingQueries();
});

test('A developed realm checks nearby structures rather than every distant production building',()=>{
  const g=fixture();structures(g);g.prepareBuildingQueries();
  const candidates=g.buildingCandidates(40,40,.2,true);
  assert.ok(candidates.length<12,`${candidates.length} local candidates for ${g.buildings.length} buildings`);
  assert.equal(g.buildingCandidates(40.01,40.01,.2,true),candidates,'Identical covered cells reuse one candidate list.');
  g.releaseBuildingQueries();
});

test('Crowded target searches check sight only for candidates that can beat the visible target',()=>{
  const g=fixture(),u=g.addUnit(0,'infantry',20,20),foes=[];g.hold([u.id]);
  for(let i=0;i<100;i++)foes.push(g.addUnit(1,'infantry',20.5+i*.02,20));
  let checks=0;g.isVisibleTo=(team,enemy)=>{checks++;return enemy!==foes[0];};g.hash.rebuild(g.units);
  assert.equal(g.findTarget(u),foes[1],'A closer hidden soldier cannot steal the nearest visible target.');
  assert.equal(checks,2,'Inferior scores and out-of-range candidates need no repeated fog query.');
});

test('Scoped fog queries read live coordinates without repeating refresh work or leaking hidden units',()=>{
  const g=fixture(),scout=g.addUnit(0,'infantry',20,20);g.hold([scout.id]);g.hash.rebuild(g.units);g.vision.update(true);
  const original=g.vision.update.bind(g.vision);let refreshCalls=0;g.vision.update=(...args)=>{refreshCalls++;return original(...args);};
  let exercised=false;g.updateSpecialists=()=>{
    const initial=refreshCalls,enemy={team:1,x:20,y:20};
    for(let i=0;i<1000;i++){
      assert.equal(g.isVisibleTo(0,enemy),true);enemy.x=90;assert.equal(g.isVisibleTo(0,enemy),false);enemy.x=20;
      assert.equal(g.isVisibleTo(0,{team:0,x:90,y:90}),true);assert.equal(g.isVisibleTo(0,{team:1,x:NaN,y:20}),false);
    }
    assert.equal(refreshCalls,initial,'One synchronous troop step shares the already refreshed grid.');exercised=true;
  };
  g.updateUnits(.025);assert.ok(exercised);assert.equal(g.sightQueryGrids,undefined);
  g.time+=.3;scout.x=90;scout.y=90;
  assert.equal(g.isVisibleTo(0,{team:1,x:20,y:20}),false,'Outside the step the ordinary visibility API refreshes current sight.');
});

test('Scoped commander lists retain the original hash bounds when commanders move during a step',()=>{
  const g=fixture(),hero=g.addUnit(0,'hero',20.05,20),point={x:15.99,y:20};g.hash.rebuild(g.units);
  g.prepareCavalryThreatQueries();hero.x=19.95;
  const indexed=g.nearCommander(point,0,4);g.commanderQueryTeams=null;
  assert.equal(indexed,g.nearCommander(point,0,4));assert.equal(indexed,false,'A movement across the old query rectangle keeps the existing broad-phase timing.');
  g.hash.rebuild(g.units);g.prepareCavalryThreatQueries();assert.equal(g.nearCommander(point,0,4),true);
  hero.hp=0;assert.equal(g.nearCommander(point,0,4),false,'Same-step commander death never leaves a live aura.');g.commanderQueryTeams=null;
});

test('Real combat, physical structure collisions, reloads and target ties match an unindexed simulation',()=>{
  const make=()=>{
    const g=fixture();structures(g);
    for(let i=0;i<96;i++){
      const u=g.addUnit(i%2,['infantry','cavalry','gilded_crossbow','dread_pike'][i%4],30+(i%12)*.6,30+Math.floor(i/12)*.65);
      u.hp=u.maxHp=10000;u.cooldown=(i%5)*.02;u.seek=0;u.facingX=i%2?-1:1;u.facingY=0;
      if(i%3===0)g.command([u.id],40,32,'move','spread');else g.hold([u.id]);
    }
    g.teams[0].sigil='dragon';g.teams[1].sigil='bear';
    for(let team=0;team<2;team++){const hero=g.addUnit(team,'hero',32+team*3,31+team);hero.cooldown=1e9;g.hold([hero.id]);}
    g.hash.rebuild(g.units);g.vision.update(true);return g;
  };
  const actual=make(),reference=make();reference.buildingCandidates=function(){return this.buildings;};
  const visible=reference.vision.isVisible.bind(reference.vision);reference.vision.isVisible=(...args)=>visible(...args);
  reference.prepareCavalryThreatQueries=function(){this.cavalryThreatHash=this.hash;this.commanderQueryTeams=null;};
  const snapshot=g=>({seed:g.seed,units:g.units.map(u=>[u.id,u.x,u.y,u.hp,u.vx,u.vy,u.cooldown,u.target?.id,u.order,u.reload,u.knockT,u.knockVX,u.knockVY,u.braceTime,u.braceDir,u.spearThreatAt]),buildings:g.buildings.map(b=>[b.id,b.hp]),projectiles:g.projectiles,effects:g.effects,stats:g.stats});
  for(let frame=0;frame<45;frame++){
    for(const g of [actual,reference]){g.time+=1/30;g.navigation.beginUpdate();g.hash.rebuild(g.units);g.vision.update();g.updateUnits(1/30);g.updateProjectiles(1/30);}
    assert.deepEqual(snapshot(actual),snapshot(reference),`Frame ${frame} preserves the full-scan outcome.`);
  }
  assert.equal(actual.buildingQueryDepth,0);assert.equal(reference.buildingQueryDepth,0);
});

test('A cavalry-only warning grid preserves live run-up, pike brace and charge outcomes',()=>{
  const make=()=>{
    const g=fixture();structures(g);
    for(const y of [29.7,30.3]){const horse=g.addUnit(0,'cavalry',31,y);horse.hp=horse.maxHp=10000;horse.cooldown=1e9;horse.facingX=1;horse.facingY=0;g.command([horse.id],45,30,'attack','spread');horse.vx=horse.motionVX=2.25;horse.vy=horse.motionVY=0;horse.momentum=.4;horse.chargeRunup=.6;horse.chargeTravel=1.5;}
    const spear=g.addUnit(1,'dread_pike',36,30);spear.hp=spear.maxHp=10000;spear.cooldown=1e9;spear.facingX=-1;spear.facingY=0;g.command([spear.id],36,30,'attack','line');
    for(let i=0;i<80;i++){const u=g.addUnit(i%2,'infantry',32+(i%10)*.4,34+Math.floor(i/10)*.4);u.hp=u.maxHp=10000;u.cooldown=1e9;g.hold([u.id]);}
    g.units.reverse();g.hash.rebuild(g.units);g.vision.update(true);return g;
  };
  const actual=make(),reference=make();reference.prepareCavalryThreatQueries=function(){this.cavalryThreatHash=this.hash;this.commanderQueryTeams=null;};
  const snapshot=g=>g.units.map(u=>[u.id,u.x,u.y,u.hp,u.order,u.braceTime,u.braceDir,u.spearThreatAt,u.charging,u.momentum,u.chargeRunup,u.chargeBlockedUntil]);
  for(let i=0;i<100;i++){
    for(const g of [actual,reference]){g.time+=1/30;g.hash.rebuild(g.units);g.navigation.beginUpdate();g.updateUnits(1/30);}
    assert.deepEqual(snapshot(actual),snapshot(reference));
  }
  assert.ok(actual.units.some(u=>u.type==='dread_pike'&&u.spearThreatAt>0),'The fixture must exercise a real cavalry warning.');
  assert.equal(actual.cavalryThreatUnits.length,2,'Infantry never enters the cavalry-only warning grid.');
});

console.log(`${checks} structure spatial checks passed.`);
