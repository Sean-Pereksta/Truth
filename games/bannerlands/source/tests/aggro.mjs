import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:2,seed:44277,...config});
  g.units=[];g.buildings=[];g.byId.clear();g.castles=[];g.objectives=[];
  g.projectiles=[];g.effects=[];g.fireZones=[];g.teamOrders=[];g.time=100;
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.featureAxis=null;t.owner=-1;t.claim=-1;t.capture=0;}
  const homes=[{x:5,y:5},{x:105,y:5},{x:105,y:85}];
  for(const s of g.teams){
    s.count=0;s.cap=1000;s.gold=0;s.alive=true;s.aiClock=1e9;s.powerReadyAt=1e9;s.home={...homes[s.id]};s.rally=null;
    const keep=g.addBuilding(s.id,'keep',s.home.x,s.home.y);keep.spawnTimer=-1e9;keep.cooldown=1e9;
  }
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
}
function step(g,seconds){
  for(let i=0;i<Math.round(seconds*30);i++){
    g.time+=1/30;g.navigation.beginUpdate();g.hash.rebuild(g.units);g.vision?.update(true);
    g.updateUnits(1/30);g.updateProjectiles(1/30);g.updateCastles(1/30);g.vision?.update(true);
  }
}
function idle(g,team,x,y,type='infantry'){
  const u=g.addUnit(team,type,x,y);u.order={x,y,mode:'idle',formation:'line'};u.seek=0;return u;
}
function stationaryFoe(g,x=36,y=40,team=1){
  const u=g.addUnit(team,'infantry',x,y);g.hold([u.id]);u.cooldown=1e9;return u;
}
function expansionFrontier(g){
  for(let y=38;y<=42;y++)for(let x=25;x<=31;x++)g.tileAt(x+.5,y+.5).owner=0;
}

test('Two rival capture companies close a contested castle gap and deal real damage',()=>{
  for(const fogOfWar of [false,true]){
    const g=fixture({fogOfWar}),site=g.createCastleSite({x:50,y:40}),groups=[],offset=fogOfWar?2.5:3;
    for(const team of [1,2]){
      const force=Array.from({length:8},(_,i)=>{
        const u=g.addUnit(team,'infantry',site.x+(team===1?-offset:offset)+(i%2-.5)*.16,site.y+(Math.floor(i/2)-1.5)*.35);
        u.order={x:u.x,y:u.y,mode:'attack',aiTask:'objective'};u.cooldown=0;return u;
      });
      groups.push(force);const s=g.teams[team],p=g.aiPlanFor(s);
      Object.assign(p,{phase:'objective',objectiveKind:'castle',objectiveId:site.id,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:g.time,economyAt:1e9,frontierAt:1e9,nextAttackAt:1e9});
    }
    g.hash.rebuild(g.units);g.vision.update(true);g.updateCastles(.1);assert.equal(site.contested,true);
    for(const team of [1,2])g.ai(g.teams[team]);
    for(const force of groups)for(const u of force)assert.equal(u.order.mode,'idle','Capture arrivals must remain free to engage a competing army.');
    step(g,2);
    assert.ok(groups[0].some(u=>u.x>48)&&groups[1].some(u=>u.x<52),'Opposing armies must physically close the gap.');
    step(g,6);
    for(const force of groups)assert.ok(force.some(u=>u.hp<u.maxHp),'Both rival companies must participate in combat, rather than waiting out a contested capture.');
  }
});

test('Unordered and idle soldiers notice nearby enemies well beyond weapon range',()=>{
  for(const unordered of [false,true]){
    const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,37.5,40);
    if(unordered)u.order=null;
    step(g,.6);assert.equal(u.target,foe);assert.ok(u.x>30.4,'An idle soldier must approach a nearby hostile troop.');
  }
});

test('Ordinary Move takes priority until arrival, then the soldier can engage nearby enemies',()=>{
  const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,36,40);
  g.command([u.id],28,40,'move');step(g,.5);
  assert.equal(u.order.mode,'move');assert.equal(u.target,null);assert.ok(u.x<29.6);
  step(g,1.4);assert.equal(u.order.mode,'idle','A completed ordinary march should release automatic engagement.');
  step(g,.6);assert.equal(u.target,foe);assert.ok(u.x>28.3);
});

test('A new Hold, Move or Attack immediately overrides an automatic pursuit',()=>{
  for(const mode of ['hold','move','attack']){
    const g=fixture(),u=idle(g,0,30,40);stationaryFoe(g);step(g,.5);
    assert.ok(u.target);const start={x:u.x,y:u.y};
    if(mode==='hold')g.hold([u.id]);else g.command([u.id],20,40,mode);
    assert.equal(u.target,null);step(g,.5);assert.equal(u.order.mode,mode);assert.equal(u.target,null);
    if(mode==='hold')assert.ok(Math.hypot(u.x-start.x,u.y-start.y)<.03,'Hold must stop the chase.');
    else assert.ok(u.x<start.x-.4,'The new destination must pull the soldier away from the automatic contact.');
  }
});

test('Expand and retreat replace an automatic pursuit without acquiring new contacts',()=>{
  for(const mode of ['expand','retreat']){
    const g=fixture(),u=idle(g,0,30,40);stationaryFoe(g);step(g,.5);assert.ok(u.target);
    g.tileAt(30,40).owner=0;
    if(mode==='expand')assert.equal(g.expand([u.id]).ok,true);else g.retreat([u.id]);
    assert.equal(u.target,null);step(g,.5);assert.equal(u.target,null);assert.equal(u.order.mode,mode==='expand'?'expand':'move');
  }
});

test('An attacked expansion responds locally while distant troops keep marching on the same order',()=>{
  const g=fixture(),struck=idle(g,0,30,40),near=idle(g,0,31,43),separate=idle(g,0,32,42),far=idle(g,0,75,40),foe=stationaryFoe(g,36,40);
  expansionFrontier(g);g.expand([struck.id,near.id,far.id]);g.expand([separate.id]);
  const orders=new Map([struck,near,separate,far].map(u=>[u.id,u.order])),distant=structuredClone(far.order),farStart={x:far.x,y:far.y};
  g.damage(struck,1,g.unitSource(foe));step(g,.7);
  for(const u of [struck,near,separate]){
    assert.equal(u.order,orders.get(u.id));assert.equal(u.order.mode,'expand');assert.equal(u.target,foe,'Each nearby expander must respond, even if assigned separately.');
  }
  assert.equal(far.order,orders.get(far.id));assert.deepEqual(far.order,distant);assert.equal(far.target,null);
  assert.ok(Math.hypot(far.x-farStart.x,far.y-farStart.y)>.4,'Distant troops must keep physically following their frontier order.');
  assert.ok(struck.x>30.4,'Defenders must close the gap rather than hold outside weapon range.');
  step(g,4);assert.ok(foe.hp<foe.maxHp,'The local defensive response must deal real combat damage.');
});

test('Local expansion defense resumes the saved frontier after combat ends or an enemy leaves the leash',()=>{
  for(const escapes of [false,true]){
    const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,36,40);expansionFrontier(g);g.expand([u.id]);
    const order=u.order,goal={x:order.x,y:order.y,tile:order.expandTile};
    g.damage(u,1,g.unitSource(foe));step(g,1);assert.equal(u.target,foe);assert.ok(u.x>30.4);
    if(escapes){foe.x=55;foe.order.x=55;}else foe.hp=0;
    step(g,10);
    assert.equal(u.order,order);assert.equal(order.mode,'expand');assert.equal(order.expandTile,goal.tile);assert.equal(u.target,null);
    assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<.3,'The soldier must resume moving to its original frontier without another T command.');
    if(escapes)assert.equal(foe.hp,foe.maxHp,'A local defense must not pursue a fleeing contact across the realm.');
  }
});

test('Expansion defense uses each responding troop\'s range around the attacker rather than the whole party',()=>{
  const g=fixture(),victim=idle(g,0,30,40),inRange=idle(g,0,43.5,40),outOfRange=idle(g,0,45,40),foe=stationaryFoe(g,36,40);
  expansionFrontier(g);g.expand([victim.id,inRange.id,outOfRange.id]);const outside=outOfRange.order;
  g.damage(victim,1,g.unitSource(foe));step(g,.2);
  assert.equal(inRange.target,foe,'A troop in range of the attacker must assist, even on its far side.');
  assert.equal(outOfRange.target,null);assert.equal(outOfRange.order,outside);assert.equal(outside.mode,'expand');
});

test('Expansion resumes even when a new building occupies the original defensive position',()=>{
  const g=fixture(),u=idle(g,0,30.5,40.5),foe=stationaryFoe(g,36.5,40.5);expansionFrontier(g);g.expand([u.id]);const order=u.order;
  g.damage(u,1,g.unitSource(foe));step(g,1);assert.equal(u.target,foe);
  foe.hp=0;g.addBuilding(0,'barracks',30.5,40.5);step(g,12);
  assert.equal(u.order,order);assert.equal(u.target,null);assert.ok(Math.hypot(u.x-order.x,u.y-order.y)<.3,'Resuming expansion must not depend on returning to a now-obstructed contact point.');
});

test('Rival spears resume frontier planning after bracing interrupts their local expansion defense',()=>{
  const g=fixture(),u=idle(g,1,30.5,40.5,'bridge_warden'),horse=idle(g,0,34.5,40.5,'cavalry');
  for(let y=38;y<=42;y++)for(let x=25;x<=31;x++)g.tileAt(x+.5,y+.5).owner=u.team;
  g.expand([u.id]);const frontier=u.order.expandTile;assert.notEqual(frontier,null);
  g.command([horse.id],28.5,40.5,'attack');horse.vx=-2;horse.vy=0;horse.momentum=.8;
  g.damage(u,1,g.unitSource(horse));step(g,1/30);
  assert.equal(u.order.mode,'hold');assert.equal(u.order.aiTask,'spearBrace','An incoming cavalry charge must temporarily brace the rival spears.');
  horse.hp=0;g.tiles[frontier].owner=u.team;
  step(g,8);
  assert.equal(u.order.mode,'expand');assert.equal(u.target,null);
  assert.notEqual(u.order.expandTile,frontier,'After the old frontier is secured, resumed spears must plan another capture destination.');
  assert.ok(Math.hypot(u.x-30.5,u.y-40.5)>.5,'The rival company must physically resume expansion after its defensive brace.');
  assert.ok(Math.hypot(u.x-u.order.x,u.y-u.order.y)<.3,'The resumed expansion must reach its new frontier.');
});

test('Damage without source coordinates remains a local expansion response',()=>{
  const g=fixture(),victim=idle(g,0,30,40),near=idle(g,0,31,42),far=idle(g,0,75,40),foe=stationaryFoe(g,35,40);
  expansionFrontier(g);g.expand([victim.id,near.id,far.id]);const order=far.order,saved=structuredClone(order);
  g.damage(victim,1,{team:foe.team});step(g,.5);
  assert.equal(victim.target,foe);assert.equal(near.target,foe);assert.equal(far.target,null);assert.equal(far.order,order);assert.deepEqual(order,saved);
});

test('A tower projectile triggers local retaliation without cancelling distant expansion',()=>{
  const g=fixture(),victim=idle(g,0,30,40),far=idle(g,0,75,40),tower=g.addBuilding(1,'tower',34,40);
  expansionFrontier(g);g.expand([victim.id,far.id]);const order=far.order,saved=structuredClone(order);tower.cooldown=0;
  g.hash.rebuild(g.units);g.updateBuildings(.1);assert.ok(g.projectiles.some(p=>p.target===victim.id));
  // Resolve a genuine contact before marching resumes; a moving soldier can now
  // evade the original aim point rather than taking damage by target ID alone.
  g.updateProjectiles(1);
  step(g,1);assert.ok(victim.hp<victim.maxHp);assert.equal(victim.target,tower);assert.equal(far.target,null);assert.equal(far.order,order);assert.deepEqual(order,saved);
  step(g,4);assert.ok(tower.hp<tower.maxHp,'A defensive response must be able to retaliate against the attacking structure.');
});

test('Local expansion defense preserves nearby explicit orders and obeys a new command immediately',()=>{
  for(const replacement of ['move','hold','attack','expand','retreat']){
    const g=fixture(),victim=idle(g,0,30,40),marcher=idle(g,0,31,41),guard=idle(g,0,31,39),foe=stationaryFoe(g,36,40);
    expansionFrontier(g);g.expand([victim.id]);g.command([marcher.id],20,40,'move');g.hold([guard.id]);const march=marcher.order,hold=guard.order;
    g.damage(victim,1,g.unitSource(foe));step(g,.4);assert.equal(victim.target,foe);
    assert.equal(marcher.order,march);assert.equal(marcher.target,null);assert.equal(guard.order,hold);assert.equal(guard.target,null);
    if(replacement==='hold')g.hold([victim.id]);else if(replacement==='expand')g.expand([victim.id]);else if(replacement==='retreat')g.retreat([victim.id]);else g.command([victim.id],20,40,replacement);
    const order=victim.order;assert.equal(victim.target,null);step(g,.3);assert.equal(victim.order,order);assert.equal(victim.target,null,'A fresh command must override the temporary local defense.');
  }
});

test('Expansion defense cannot chase unseen or unreachable attackers',()=>{
  for(const blocked of ['unseen','river']){
    const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,35,40);expansionFrontier(g);g.expand([u.id]);const order=u.order;
    if(blocked==='unseen')g.isVisibleTo=(team,entity)=>entity!==foe;
    else{for(let y=1;y<g.H-1;y++)g.tileAt(33.5,y+.5).terrain='water';g.navigation.invalidate();}
    g.damage(u,1,g.unitSource(foe));step(g,2);
    assert.equal(u.order,order);assert.equal(order.mode,'expand');assert.equal(u.target,null);assert.equal(foe.hp,foe.maxHp);assert.ok(u.x<33,'The local response must respect a blocked or unseen attack position.');
  }
});

test('Deliberate Hold defends at weapon range while refusing a distant chase',()=>{
  const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,35,40);g.hold([u.id]);u.cooldown=0;
  step(g,1);assert.ok(Math.hypot(u.x-30,u.y-40)<.03);assert.equal(foe.hp,foe.maxHp);
  foe.x=30.6;foe.order.x=foe.x;u.seek=0;step(g,.2);
  assert.ok(foe.hp<foe.maxHp,'An explicit Hold still permits defensive strikes in reach.');assert.equal(u.order.mode,'hold');
});

test('Facing orders retain their route and front after their destination is reached',()=>{
  const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,35,40);u.facingX=1;u.facingY=0;
  g.command([u.id],29,40,'move','line',{x:1,y:0});step(g,2);
  assert.equal(u.order.mode,'hold');assert.ok(Math.hypot(u.x-29,u.y-40)<.25);assert.ok(u.facingX>.999);assert.equal(u.target,null);assert.equal(foe.hp,foe.maxHp);
});

test('Automatic pursuit drops a fleeing enemy outside the local leash and returns to its post',()=>{
  const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,36,40);step(g,1);assert.ok(u.x>31);
  const farthest=u.x;foe.x=52;foe.order.x=52;step(g,.5);
  assert.equal(u.target,null);assert.ok(u.x<farthest,'Idle troops must return instead of following a contact across the map.');
  step(g,3);assert.ok(Math.hypot(u.x-30,u.y-40)<.3);assert.equal(foe.hp,foe.maxHp);
});

test('A defeated contact hands off to nearby opposition while preserving the original pursuit leash',()=>{
  const g=fixture(),u=idle(g,0,30,40),first=stationaryFoe(g,36,40);step(g,1);assert.equal(u.target,first);
  const anchor=u.aggroAnchor,x=u.x;first.hp=0;const second=stationaryFoe(g,37,40,2);step(g,.5);
  assert.equal(u.target,second,'A living enemy beside the defeated target should keep the company engaged.');
  assert.equal(u.aggroAnchor,anchor);assert.equal(anchor.x,30);assert.ok(u.x>x+.3);assert.notEqual(anchor.returning,true);
});

test('Automatic acquisition excludes allied, fallen, eliminated and distant troops',()=>{
  for(const kind of ['allied','fallen','eliminated','distant']){
    const g=fixture(),u=idle(g,0,30,40),foe=stationaryFoe(g,kind==='distant'?45:35,40);
    if(kind==='allied')g.teams[foe.team].alliance=g.teams[0].alliance;
    if(kind==='fallen')foe.hp=0;
    if(kind==='eliminated')g.teams[foe.team].alive=false;
    step(g,1);assert.equal(u.target,null,kind);assert.ok(Math.hypot(u.x-30,u.y-40)<.03,kind);
  }
});

test('An unreachable nearby troop cannot pin soldiers away from an accessible enemy',()=>{
  const g=fixture();for(let y=1;y<g.H-1;y++)g.tileAt(33.5,y+.5).terrain='water';g.navigation.invalidate();
  const u=idle(g,0,30,40),acrossRiver=stationaryFoe(g,34.5,40),accessible=stationaryFoe(g,29,46,2);
  step(g,.5);assert.equal(u.target,accessible);assert.ok(u.y>40.3);assert.ok(u.x<33);assert.equal(acrossRiver.hp,acrossRiver.maxHp);
});

test('Visibility limits automatic acquisition and a lost contact releases pursuit',()=>{
  const g=fixture(),u=idle(g,0,30,40),hidden=stationaryFoe(g,35,40),visible=stationaryFoe(g,30,47,2);
  let lost=false;g.isVisibleTo=(team,entity)=>entity!==hidden&&!(lost&&entity===visible);
  step(g,.5);assert.equal(u.target,visible);assert.equal(hidden.hp,hidden.maxHp);
  lost=true;step(g,.4);assert.equal(u.target,null);assert.equal(visible.hp,visible.maxHp);
});

test('A ranged enemy moving behind a mountain cannot pin an idle archer on a blocked shot',()=>{
  const g=fixture();g.tileAt(32.5,40.5).terrain='mountain';g.navigation.invalidate();
  const u=idle(g,0,30.5,40.5,'archer'),foe=stationaryFoe(g,30.5,43.5);step(g,.2);assert.equal(u.target,foe);
  foe.x=33.5;foe.y=40.5;foe.order.x=foe.x;foe.order.y=foe.y;
  assert.equal(g.combatTerrain.canShoot(u,foe),false);step(g,.5);
  assert.notEqual(u.target,foe,'A retained target must be rechecked when terrain blocks further shots.');
});

test('A patrol engages nearby troops and resumes the same waypoint after the contact dies',()=>{
  const g=fixture(),u=idle(g,0,30,40,'cavalry'),foe=stationaryFoe(g,36,40);
  for(let y=30;y<51;y++)for(let x=20;x<41;x++)g.tileAt(x+.5,y+.5).owner=0;g.recount();
  assert.equal(g.patrol([u.id]).ok,true);const order=u.order,waypoint={x:order.x,y:order.y,tile:order.patrolTile};
  step(g,1);assert.equal(u.target,foe);assert.ok(u.x>30.5);assert.equal(u.order,order);assert.equal(order.x,waypoint.x);assert.equal(order.y,waypoint.y);assert.equal(order.patrolTile,waypoint.tile);
  foe.hp=0;step(g,10);
  assert.equal(u.target,null);assert.equal(u.order,order);assert.equal(order.mode,'patrol');assert.equal(u.aggroAnchor,null);assert.ok(Math.hypot(u.x-30,u.y-40)>3,'Patrolling must continue after returning from the engagement.');
});

console.log(`${cases} automatic engagement checks passed.`);
