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
