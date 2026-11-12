import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {REGIMENT_UNITS,REGIMENT_BUILDINGS,SHIELD_HOUSES,CHAMPION_HOUSES,CHAMPION_TRAINING_SECONDS,registerRegiments,regimentForHouse,regimentAllowed,regimentBuildingForHouse,regimentRequiredBuilding} from '../../regiments.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const houseIndex=sigil=>HOUSES.findIndex(h=>h.sigil===sigil);
function fixture(sigil='wolf'){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:houseIndex(sigil),seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];
  for(const tile of g.tiles){tile.terrain='grass';tile.feature=null;tile.height=0;tile.owner=0;}
  for(const team of g.teams){team.count=0;team.alive=true;team.cap=1000;team.gold=5000;team.aiClock=1e9;team.home={x:team.id?96:10,y:team.id?80:10};team.rally=null;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
}
const post=(g,type,team=0,x=20,y=20)=>g.addBuilding(team,type,x,y);
const members=(g,type)=>g.units.filter(u=>u.type===type&&u.hp>0);

test('Only the requested houses gain shield or lance regiments and existing spears stay exclusive',()=>{
  assert.deepEqual(SHIELD_HOUSES,['wolf','lion','dragon','rose']);assert.deepEqual(CHAMPION_HOUSES,['bear','sun','falcon']);
  assert.equal(UNIT_DEFS.shield_bearer.class,'infantry');assert.equal(UNIT_DEFS.lance_champion.class,'cavalry');
  assert.deepEqual(Object.keys(UNIT_DEFS).filter(type=>UNIT_DEFS[type].spearBrace).sort(),['bridge_warden','dread_pike']);
  for(const house of HOUSES){
    const expected=SHIELD_HOUSES.includes(house.sigil)?'shield_bearer':CHAMPION_HOUSES.includes(house.sigil)?'lance_champion':null;
    assert.equal(regimentForHouse(house.sigil),expected);
    const g=fixture(house.sigil);post(g,'barracks',0,10,20);post(g,'stables',0,10,25);
    for(const type of Object.keys(REGIMENT_UNITS))assert.equal(g.recruitDetails(type).unlocked,false,'Ordinary facilities must not unlock '+type);
    for(const definition of Object.values(REGIMENT_BUILDINGS)){
      const gold=g.teams[0].gold,built=g.build(definition.type,20.5,20.5);
      assert.equal(built.ok,definition.house===house.sigil,house.name+' '+definition.label);
      if(definition.house!==house.sigil)assert.equal(g.teams[0].gold,gold,'Foreign production cannot spend gold.');
      else assert.equal(g.teams[0].gold,gold-definition.cost,'The dedicated building must pay its normal cost.');
    }
    for(const type of Object.keys(REGIMENT_UNITS)){
      assert.equal(g.recruitDetails(type).unlocked,regimentAllowed(type,house.sigil),house.name+' '+type);
      if(type!==expected){const gold=g.teams[0].gold;assert.equal(g.recruit(type).ok,false);assert.equal(g.teams[0].gold,gold);assert.equal(members(g,type).length,0);}
    }
  }
});

test('Requested raiders and rangers gain ten percent speed without compounding registration',()=>{
  const expected={river_ranger:1.672,freefolk_berserker:1.738,ironborn_reaver:1.815};
  for(const [type,speed]of Object.entries(expected))assert.equal(UNIT_DEFS[type].speed,speed);
  const copy={...Object.fromEntries(Object.entries(expected).map(([type,speed])=>[type,{speed}]))};registerRegiments(copy);registerRegiments(copy);
  for(const [type,speed]of Object.entries(expected))assert.equal(copy[type].speed,speed);
  assert.equal(UNIT_DEFS.infantry.speed,1.42);assert.equal(UNIT_DEFS.archer.speed,1.38);assert.equal(UNIT_DEFS.cavalry.speed,2.25);
});

test('Paid regiments require their own living facility and obey gold, supply and rally rules',()=>{
  for(const sigil of Object.keys(REGIMENT_BUILDINGS)){
    const type=regimentForHouse(sigil),building=regimentBuildingForHouse(sigil);
    const g=fixture(sigil),s=g.teams[0];post(g,'keep',0,10,10);const enemy=post(g,building,1,80,80);
    assert.equal(regimentRequiredBuilding(type,sigil),building);assert.equal(regimentRequiredBuilding(type,'bridge'),null);
    assert.equal(g.recruitDetails(type).requiredBuilding,building);assert.equal(g.recruitDetails(type).unlocked,false);assert.equal(g.recruit(type).ok,false);
    const origin=post(g,building);assert.equal(g.recruitDetails(type).unlocked,true);const details=g.recruitDetails(type);
    s.gold=details.cost-1;assert.equal(g.recruit(type).ok,false);assert.equal(s.count,0);
    s.gold=5000;s.cap=details.batch-1;assert.equal(g.recruit(type).ok,false);assert.equal(s.gold,5000);
    s.cap=100;origin.rally={x:40,y:25};assert.equal(g.recruit(type).ok,true);assert.equal(s.gold,5000-details.cost);
    assert.equal(members(g,type).length,details.batch);assert.ok(members(g,type).every(u=>u.team===0&&u.order.groupX===40&&u.order.groupY===25));
    assert.deepEqual(origin.rally,{x:40,y:25});assert.equal(enemy.rally,null);
    origin.hp=0;assert.equal(g.recruitDetails(type).unlocked,false);assert.equal(g.recruit(type).ok,false);
  }
});

test('Seven dedicated buildings train the matching shield or lance troops with supply limits and independent rallies',()=>{
  assert.equal(CHAMPION_TRAINING_SECONDS,90);
  for(const sigil of Object.keys(REGIMENT_BUILDINGS)){
    const g=fixture(sigil),type=regimentForHouse(sigil),buildingType=regimentBuildingForHouse(sigil),building=post(g,buildingType),definition=BUILD_DEFS[buildingType];building.rally={x:44,y:26};
    assert.equal(definition.house,sigil);assert.equal(definition.unit,type);assert.equal(definition.trainingFactor,.5);
    assert.equal(definition.interval/definition.trainingFactor,type==='lance_champion'?90:64);
    const rate=g.trainingRate(building);assert.ok(rate>0&&rate<=.6);g.updateBuildings((definition.interval-.01)/rate);assert.equal(members(g,type).length,0);
    g.updateBuildings(.02/rate);assert.equal(members(g,type).length,definition.batch,sigil+' must train exactly one batch.');
    assert.ok(members(g,type).every(u=>u.order.groupX===44&&u.order.groupY===26));
    g.teams[0].cap=g.teams[0].count;g.updateBuildings(definition.interval/rate+1);assert.equal(members(g,type).length,definition.batch);
    g.teams[0].cap+=10;g.updateBuildings(.01);assert.equal(members(g,type).length,definition.batch*2,'A waiting batch deploys when supply returns.');
    g.updateBuildings(.01);assert.equal(members(g,type).length,definition.batch*2,'Restored supply must not release a backlog.');
    building.hp=0;g.updateBuildings(definition.interval/rate+1);assert.equal(members(g,type).length,definition.batch*2,'Destroyed facilities cannot train.');
  }
  for(const sigil of HOUSES.map(h=>h.sigil)){const g=fixture(sigil);post(g,'barracks');post(g,'stables');g.updateBuildings(1000);assert.equal(members(g,'lance_champion').length,0);assert.equal(members(g,'shield_bearer').length,0);}
});

test('Shield bearers strongly resist frontal missiles, melee and charges while leaving the rear exposed',()=>{
  const g=fixture('wolf'),shield=g.addUnit(0,'shield_bearer',40,40);g.hold([shield.id]);shield.facingX=1;shield.facingY=0;
  const loss=(originX,originY,impactKind='weapon',projectileType=null)=>{shield.hp=shield.maxHp;const before=shield.hp;g.damage(shield,100,{team:1,type:projectileType?'archer':'infantry',impactKind,projectileType,originX,originY});return before-shield.hp;};
  assert.equal(loss(45,40,'weapon','arrow'),25);assert.equal(loss(45,40,'bolt','bolt'),25);
  assert.equal(loss(45,40),35);assert.equal(loss(45,40,'charge'),45);
  assert.equal(loss(35,40,'weapon','arrow'),100);assert.ok(loss(35,40)>loss(45,40)*3);
  assert.ok(loss(40,45)>loss(45,40));assert.equal(loss(45,40,'weapon','rock'),100,'Arcing stones do not receive direct-fire shield protection.');
  shield.hp=shield.maxHp;g.damage(shield,20,{team:1,type:'siege',impactKind:'fire',secondary:true,originX:45,originY:40});assert.equal(shield.maxHp-shield.hp,20);
});

function chargeTrial({enemy='infantry',distance=7,rear=true,rows=2}={}){
  const g=fixture('bear'),horse=g.addUnit(0,'lance_champion',30,40);horse.cooldown=100;
  post(g,'keep',0,10,10);post(g,'keep',1,96,80);
  const foes=Array.from({length:rows},(_,i)=>{const u=g.addUnit(1,enemy,30+distance+i*2.2,40);u.hp=u.maxHp=1000;u.cooldown=100;g.hold([u.id]);u.order.facingX=rear?1:-1;u.order.facingY=0;u.facingX=u.order.facingX;u.facingY=0;u.braceDir={x:u.facingX,y:0};u.braceTime=1;return u;});
  g.command([horse.id],50,40,'attack','line');let charging=false,blocked=false;
  const hits=[];
  for(let frame=0;frame<480;frame++){
    const before=foes.map(u=>u.hp);g.update(1/60);charging||=horse.charging;blocked||=horse.chargeBlockedUntil>g.time;
    foes.forEach((u,i)=>{if(before[i]>u.hp)hits.push({id:u.id,damage:before[i]-u.hp,distance:Math.hypot(u.x-horse.x,u.y-horse.y),time:g.time});});
    if(hits.length>=rows||blocked)break;
  }
  return {g,horse,foes,hits,charging,blocked};
}

test('A real lance charge reaches ahead, hits first much harder, and leaves slow weak follow-up attacks',()=>{
  assert.ok(UNIT_DEFS.lance_champion.range>UNIT_DEFS.dread_pike.range);
  assert.ok(UNIT_DEFS.lance_champion.rate>UNIT_DEFS.cavalry.rate);
  const f=chargeTrial();assert.ok(f.charging,'The rider must actually build and enter a charge.');
  assert.equal(f.hits.length,2,'The test must include first and subsequent charge impacts.');
  assert.ok(f.hits[0].distance>1,'The drawn lance must land before horse-body contact.');
  assert.ok(f.hits[0].damage>f.hits[1].damage*2.5,'The first lance impact must be substantially stronger than later impacts.');
  const target=f.foes[0];f.g.stopCharge(f.horse);f.horse.x=target.x-1;f.horse.y=target.y;f.horse.facingX=1;f.horse.facingY=0;
  target.hp=target.maxHp;const before=target.hp;f.g.attack(f.horse,target);const followUp=before-target.hp;
  assert.ok(followUp>0&&followUp<f.hits[0].damage*.15,'Ordinary follow-ups are weak after charge momentum is spent.');
  assert.ok(f.horse.cooldown>=UNIT_DEFS.lance_champion.rate-.001,'Ordinary lance swings retain their slow attack interval.');
});

test('Point-blank lances cannot invent charge damage and living frontal Frey or Bolton spears stop champions',()=>{
  const close=chargeTrial({distance:1,rows:1});assert.equal(close.g.stats.chargeImpacts,0);assert.equal(close.charging,false);
  for(const enemy of ['bridge_warden','dread_pike']){
    const frontal=chargeTrial({enemy,rear:false,rows:1});assert.ok(frontal.blocked,enemy+' must stop a frontal champion.');assert.ok(frontal.foes[0].hp>0);
    const rear=chargeTrial({enemy,rear:true,rows:1});assert.equal(rear.blocked,false,enemy+' cannot brace against a rear lance.');assert.ok(rear.hits.length>0);
  }
});

test('Champion knockback moves targets substantially and remains constrained by terrain',()=>{
  const f=chargeTrial({rows:1});assert.ok(f.hits.length);const target=f.foes[0],start={x:target.x,y:target.y};let travel=0;
  f.g.stopCharge(f.horse);f.horse.x=20;f.horse.y=20;
  for(let i=0;i<60;i++){f.g.update(1/60);travel=Math.max(travel,Math.hypot(target.x-start.x,target.y-start.y));assert.ok(f.g.isWalkable(target.x,target.y));}
  assert.ok(travel>1,'A champion first impact must visibly push a surviving target beyond one tile.');
  const g=fixture('bear'),horse=g.addUnit(0,'lance_champion',35,40),foe=g.addUnit(1,'infantry',36.25,40);foe.hp=foe.maxHp=1000;post(g,'keep',0,10,10);post(g,'keep',1,96,80);
  for(let y=0;y<g.H;y++){const tile=g.tiles[y*g.W+37];tile.terrain='water';}g.navigation.invalidate();g.hash.rebuild(g.units);
  horse.chargeDir={x:1,y:0};horse.momentum=1;horse.charging=true;horse.lanceFirstStrike=true;horse.chargeEnd={x:45,y:40};horse.chargeElapsed=0;
  g.chargeContact(horse,34.95,40,.016);for(let i=0;i<90;i++){g.update(1/60);assert.ok(foe.x<37,'Long-lance knockback cannot send a target through a river.');assert.ok(g.isWalkable(foe.x,foe.y));}
});

console.log(`${cases} house regiment checks passed.`);
