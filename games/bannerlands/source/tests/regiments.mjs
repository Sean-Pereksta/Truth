import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {REGIMENT_UNITS,REGIMENT_BUILDINGS,CONQUEST_BUILDINGS,FRONTIER_BUILDINGS,SHIELD_HOUSES,CHAMPION_HOUSES,CHAMPION_TRAINING_SECONDS,registerRegiments,regimentForHouse,regimentAllowed,regimentBuildingForHouse,regimentRequiredBuilding} from '../../regiments.js';

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
    const expected=SHIELD_HOUSES.includes(house.sigil)?'shield_bearer':CHAMPION_HOUSES.includes(house.sigil)?'lance_champion':CONQUEST_BUILDINGS[house.sigil]?.unit||FRONTIER_BUILDINGS[house.sigil]?.unit||null;
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

test('Champions are tougher and hit harder while their real first charge remains decisive',()=>{
  assert.equal(UNIT_DEFS.lance_champion.hp,400);assert.equal(UNIT_DEFS.lance_champion.damage,18);
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

test('Champion Retreat returns to its own training rally and safely falls back when rallies become invalid',()=>{
  const g=fixture('bear'),s=g.teams[0],origin=post(g,'bear_lance_lodge',0,20,20),near=post(g,'bear_lance_lodge',0,38,20);
  origin.rally={x:24,y:24};near.rally={x:36,y:25};s.rally={x:16,y:16};g.spawnBatch(origin,'lance_champion',1);
  const horse=members(g,'lance_champion')[0];horse.x=38;horse.y=22;assert.equal(horse.spawnOriginId,origin.id);
  g.retreat([horse.id]);assert.equal(horse.order.groupX,24);assert.equal(horse.order.groupY,24);assert.equal(horse.order.mode,'move');assert.ok(horse.order.championWithdraw);assert.equal(horse.target,null);
  origin.hp=0;g.retreat([horse.id]);assert.equal(horse.order.groupX,36);assert.equal(horse.order.groupY,25);
  near.rally={x:NaN,y:20};g.retreat([horse.id]);assert.equal(horse.order.groupX,16);assert.equal(horse.order.groupY,16);
  s.rally={x:-10,y:-10};g.retreat([horse.id]);assert.equal(horse.order.groupX,s.home.x);assert.equal(horse.order.groupY,s.home.y);
  const infantry=g.addUnit(0,'infantry',34,20);g.retreat([infantry.id]);assert.equal(infantry.order.groupX,s.home.x);assert.equal(infantry.order.groupY,s.home.y);
});

test('A moving champion disengages faster and can escape a melee crowd without crossing blocked terrain',()=>{
  const trial=(withdrawing,crowded=false)=>{const g=fixture('bear'),horse=g.addUnit(0,'lance_champion',40,40);horse.facingX=-1;horse.facingY=0;horse.cooldown=100;
    if(crowded)for(let i=0;i<12;i++){const angle=i*Math.PI/6,foe=g.addUnit(1,'infantry',40+Math.cos(angle)*.48,40+Math.sin(angle)*.48);foe.cooldown=100;g.hold([foe.id]);}
    g.command([horse.id],30,40,withdrawing?'move':'attack','line');
    for(let i=0;i<180;i++){g.time+=1/60;g.hash.rebuild(g.units);g.updateUnits(1/60);assert.ok(g.isWalkable(horse.x,horse.y));}
    return {g,horse,travel:40-horse.x};};
  const moving=trial(true),marching=trial(false);assert.ok(moving.travel>marching.travel*1.2,'A pure withdrawal must gain a material speed advantage.');
  const crowded=trial(true,true);assert.ok(crowded.travel>5,'A champion should pull out of a tight melee rather than remain body locked.');
  const g=fixture('bear'),horse=g.addUnit(0,'lance_champion',40,40);for(let y=0;y<g.H;y++)g.tiles[y*g.W+38].terrain='water';g.navigation.invalidate();g.command([horse.id],35,40,'move');
  for(let i=0;i<240;i++){g.time+=1/60;g.hash.rebuild(g.units);g.updateUnits(1/60);assert.ok(horse.x>=39.2,'Disengagement cannot tunnel through an impassable river.');assert.ok(g.isWalkable(horse.x,horse.y));}
});

test('Crowds materially slow withdrawing champions, while champions escape them better than ordinary cavalry',()=>{
  const trial=(type,rings)=>{const g=fixture('bear'),horse=g.addUnit(0,type,40,40);horse.facingX=-1;horse.facingY=0;horse.cooldown=100;
    for(let ring=0;ring<rings;ring++)for(let i=0;i<12;i++){const angle=i*Math.PI/6,foe=g.addUnit(1,'infantry',40+Math.cos(angle)*(.48+ring*.4),40+Math.sin(angle)*(.48+ring*.4));foe.cooldown=100;g.hold([foe.id]);}
    g.command([horse.id],30,40,'move','line');let firstSecond=0;
    for(let i=0;i<180;i++){g.time+=1/60;g.hash.rebuild(g.units);g.updateUnits(1/60);if(i===59)firstSecond=40-horse.x;assert.ok(g.isWalkable(horse.x,horse.y));}
    return {firstSecond,total:40-horse.x};};
  const clear=trial('lance_champion',0);
  for(const rings of [1,3]){const champion=trial('lance_champion',rings),cavalry=trial('cavalry',rings);
    assert.ok(champion.firstSecond<clear.firstSecond*.85,'Body crowds must impose a substantial initial slowdown rather than being ignored.');
    assert.ok(champion.total>cavalry.total*1.08,'Champions should escape the same crowd sooner than ordinary cavalry.');
    assert.ok(champion.total<clear.total,'The crowd must impose an escape cost even after the champion reaches clear ground.');
  }
});

test('Rival champions regroup after a genuine charge, retain their wave task and make another real charge',()=>{
  const g=fixture('wolf');g.teams[1].sigil='bear';g.teams[1].home={x:30,y:40};g.teams[1].rally={x:30,y:40};
  const horse=g.addUnit(1,'lance_champion',30,40),foe=g.addUnit(0,'infantry',37,40);horse.cooldown=100;foe.hp=foe.maxHp=10000;foe.cooldown=100;g.hold([foe.id]);
  g.command([horse.id],50,40,'attack','line');horse.order.aiTask='assault';horse.order.aiTarget=foe.id;
  let withdrawing=false,resumed=false,firstHit=false,secondCharge=false;
  for(let i=0;i<2400;i++){
    g.time+=1/60;g.hash.rebuild(g.units);g.updateUnits(1/60);
    if(g.stats.chargeImpacts>0)firstHit=true;
    if(horse.championRegroup){withdrawing=true;assert.equal(horse.order.mode,'move');assert.equal(horse.order.aiTask,'assault');assert.equal(horse.target,null);}
    if(withdrawing&&!horse.championRegroup&&horse.order.mode==='attack')resumed=true;
    if(resumed&&horse.charging){secondCharge=true;break;}
  }
  assert.ok(firstHit&&withdrawing&&resumed&&secondCharge,'The full charge-withdraw-regroup-charge cycle must run through physical movement.');
  g.stopCharge(horse);g.updateUnits(1/60);g.command([horse.id],44,44,'move');assert.equal(horse.championRegroup,null);assert.equal(horse.championCyclePending,false);
  horse.championRegroup={resumeOrder:{x:50,y:40,mode:'attack'},rally:{x:44,y:44}};g.hold([horse.id]);assert.equal(horse.championRegroup,null,'Explicit Hold cancels a saved attack rather than reviving it later.');
});

test('A real rival strategy decision preserves an active champion withdrawal and its assault wave',()=>{
  const g=fixture('wolf'),s=g.teams[1];s.sigil='bear';s.home={x:30,y:40};s.rally={...s.home};s.powerReadyAt=1e9;
  const target=post(g,'keep',0,60,40),horse=g.addUnit(1,'lance_champion',48,40),force=[horse];
  for(let i=0;i<8;i++)force.push(g.addUnit(1,'infantry',46+i*.3,42));
  for(let i=0;i<12;i++){const guard=g.addUnit(1,'infantry',29+i*.3,39);g.hold([guard.id]);}
  const p=g.aiPlanFor(s);Object.assign(p,{phase:'advance',cohort:force.map(u=>u.id),initialSize:force.length,targetId:target.id,targetTeam:0,startedAt:0,timeout:1000,economyAt:1e9,frontierAt:1e9});
  g.time=20;g.aiIssue(force,target,'attack','assault',{aiTarget:target.id});g.regroupChampion(horse);const cycle=horse.championRegroup;
  g.hash.rebuild(g.units);g.ai(s);
  assert.equal(horse.championRegroup,cycle);assert.equal(horse.order.mode,'move');assert.equal(horse.order.aiTask,'assault');assert.equal(p.phase,'advance');assert.ok(p.cohort.includes(horse.id));
});

test('Replacement orders cancel champion cycles and stale targets or expired calls cannot resurrect attacks',()=>{
  const g=fixture('wolf');g.teams[1].sigil='bear';g.teams[1].rally={x:30,y:40};
  const horse=g.addUnit(1,'lance_champion',40,40),target=g.addUnit(0,'infantry',50,40);
  for(const replace of [()=>g.command([horse.id],44,44,'move'),()=>g.hold([horse.id]),()=>g.expand([horse.id])]){
    g.command([horse.id],50,40,'attack');horse.order.aiTask='assault';g.regroupChampion(horse);assert.ok(horse.championRegroup);replace();assert.equal(horse.championRegroup,null);assert.equal(horse.championCyclePending,false);
  }
  for(const reason of ['dead','allied','expired-call']){
    target.hp=100;target.team=0;horse.chargeCooldown=0;
    const resume={x:50,y:40,mode:'attack',aiTask:reason==='expired-call'?'team':'assault',...(reason==='expired-call'?{aiOrder:999}:{aiTarget:target.id})};
    horse.championRegroup={resumeOrder:resume,rally:{x:horse.x,y:horse.y}};horse.order={x:horse.x,y:horse.y,mode:'move'};
    if(reason==='dead')target.hp=0;if(reason==='allied')target.team=1;
    g.hash.rebuild(g.units);g.updateUnits(1/60);assert.equal(horse.championRegroup,null);assert.equal(horse.order.mode,'idle');assert.equal(horse.order.aiTask,'muster');
  }
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
