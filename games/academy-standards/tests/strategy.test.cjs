const test=require('node:test');
const assert=require('node:assert/strict');
const strategy=require('../strategy.js');

function scenario(difficulty='veteran'){
  const house={id:'mars',controller:'mars',castle:{x:500,y:500}};
  const rival={id:'player',controller:'player',castle:{x:2300,y:500}};
  const unit=(id,extra={})=>({id,controller:'mars',x:600,y:500,state:'idle',weapon:'Sword',weaponLevel:1,hp:100,maxHp:100,moveSpeed:84,armor:'Light',item:'Boots',mount:false,order:{type:'idle',x:600,y:500},...extra});
  const troops=Array.from({length:10},(_,i)=>unit(`mars_${i}`,{x:540+i*20}));
  troops[7].weapon='Bow';troops[8].weapon='Bow';troops[9].item='Medkit';
  const game={difficulty,time:1,students:troops,houses:[house,rival],standards:[{houseId:'mars',x:500,y:466,carriedBy:null,dropped:false},{houseId:'player',x:2300,y:466,carriedBy:null,dropped:false}],objectives:[{id:'obj_rally',x:1450,y:850,controller:null}],lootBoxes:[],groundLoot:[]};
  const orders=[],hidden=new Set();
  const ctx={game,setOrder(s,o){s.order={...o};orders.push({id:s.id,...o});},canSee:(controller,x,y)=>!hidden.has(`${x},${y}`),isVisibleTo:(controller,s)=>!hidden.has(s.id),terrainAt:()=>({speed:1,concealment:1})};
  return {house,rival,unit,troops,game,ctx,orders,hidden,tick:()=>strategy.think(ctx,house)};
}

test('Veteran assembles a squad in cover while Tactician advances directly',()=>{
  const hard=scenario(),normal=scenario('normal');hard.tick();normal.tick();
  assert.equal(strategy.getState(hard.house).plan.stage,'rally');
  assert.equal(strategy.getState(normal.house).plan.stage,'advance');
  assert(hard.troops.some(s=>s.order.type==='defend'));
  assert(hard.troops.some(s=>s.order.type==='move'));
  assert(normal.troops.some(s=>s.order.type==='attackMove'));
});

test('hidden enemies cannot alter the plan or become attack targets',()=>{
  const empty=scenario(),hidden=scenario();
  hidden.game.students.push(hidden.unit('hidden_army',{controller:'player',x:1450,y:850,hp:1,weapon:'Longbow',carryingStandard:'mars'}));
  hidden.hidden.add('hidden_army');hidden.game.standards[0].carriedBy='hidden_army';
  empty.tick();hidden.tick();
  assert.deepEqual(hidden.orders,empty.orders);
  assert.equal(strategy.getState(hidden.house).seen.size,0);
});

test('a stolen banner is searched for at its last observed position',()=>{
  const s=scenario();
  const thief=s.unit('thief',{controller:'player',x:780,y:540,carryingStandard:'mars'});s.game.students.push(thief);s.game.standards[0].carriedBy=thief.id;
  s.tick();s.orders.length=0;s.game.time=3;s.hidden.add(thief.id);thief.x=4000;thief.y=4000;
  s.tick();
  assert(s.orders.some(o=>o.type==='attackMove'&&o.x<1000&&o.y<1000));
  assert(!s.orders.some(o=>o.targetId===thief.id));
  assert(s.orders.every(o=>o.x<3000&&o.y<3000));
  s.game.time=50;s.tick();assert.equal(strategy.getState(s.house).seen.size,0);
});

test('wounded troops withdraw and a medic heals them',()=>{
  const s=scenario();s.troops[3].hp=20;s.tick();
  assert.equal(s.troops[3].order.type,'move');
  assert.equal(s.troops[9].order.type,'heal');
  assert.equal(s.troops[9].order.targetId,s.troops[3].id);
  s.troops[3].hp=90;s.game.time=4;s.tick();assert(!strategy.getState(s.house).retreat.has(s.troops[3].id));
});

test('without a medic, wounded troops can finish regrouping and rejoin',()=>{
  const s=scenario();s.troops[9].item='Boots';s.troops[3].hp=20;s.tick();
  assert(strategy.getState(s.house).retreat.has(s.troops[3].id));
  s.game.time=17;s.tick();s.game.time=18;s.tick();
  assert(!strategy.getState(s.house).retreat.has(s.troops[3].id));
  assert(strategy.getState(s.house).regroupCooldown.get(s.troops[3].id)>18);
});

test('Veteran counters cavalry with spears and protects the home castle',()=>{
  const s=scenario();s.troops[0].weapon='Spear';s.troops[0].x=735;
  const cavalry=s.unit('horse',{controller:'player',x:750,y:500,mount:true});
  const infantry=s.unit('sword',{controller:'player',x:740,y:500});
  s.game.students.push(cavalry,infantry);s.tick();
  assert.equal(s.troops[0].order.type,'attack');assert.equal(s.troops[0].order.targetId,'horse');
  assert(s.troops.some(u=>u.order.type==='defend'));
});

test('carriers return home with dedicated escorts',()=>{
  const s=scenario();s.troops[4].carryingStandard='player';s.tick();
  assert.equal(s.troops[4].order.type,'returnBanner');
  assert(s.troops.filter(u=>u.order.type==='escort'&&u.order.targetId===s.troops[4].id).length>=3);
});

test('visible safe supplies receive collectors while reserves hold home',()=>{
  const s=scenario();s.game.lootBoxes.push({id:'box_1',x:700,y:800,alive:true});s.tick();
  assert.equal(s.troops.filter(u=>u.order.type==='box').length,2);
  assert(s.troops.some(u=>u.order.type==='defend'));
  const fog=scenario();fog.game.lootBoxes.push({id:'box_1',x:700,y:800,alive:true});fog.hidden.add('700,800');fog.tick();
  assert(!fog.troops.some(u=>u.order.type==='box'));
});

test('outnumbered Veteran squads disengage instead of feeding a stronger army',()=>{
  const s=scenario();s.troops.forEach(u=>{u.x=1500;u.y=900;});
  for(let i=0;i<20;i++)s.game.students.push(s.unit(`foe_${i}`,{controller:'player',x:1700+i*3,y:900,armor:'Heavy',mount:true}));
  s.tick();assert.equal(strategy.getState(s.house).mode,'regroup outnumbered');
  assert(s.troops.filter(u=>u.order.type==='move').length>=5);
  assert(!s.troops.some(u=>u.order.type==='attack'));
});

test('rally approach avoids impassable terrain and prefers cover',()=>{
  const s=scenario();s.ctx.terrainAt=(x,y)=>y>1000?{speed:0,concealment:1}:y<650?{speed:.9,concealment:.4}:{speed:1,concealment:1};
  s.tick();const rally=strategy.getState(s.house).plan.rally;
  assert(rally);assert(rally.y<1000);assert(s.ctx.terrainAt(rally.x,rally.y).speed>0);
});

test('unchanged plans do not cancel capture channels or attack windups',()=>{
  const s=scenario('normal');s.game.objectives=[];
  s.troops.forEach(u=>{u.x=2200;u.y=500;});
  s.tick();const runner=s.troops.find(u=>u.order.type==='capture');assert(runner);
  s.orders.length=0;s.game.time=2;s.tick();
  assert(!s.orders.some(o=>o.id===runner.id&&o.type==='capture'));
});

test('a visible captain gets a modest preference over an otherwise comparable enemy',()=>{
  const s=scenario();s.ctx.isHouseCaptain=unit=>unit.id==='mars_0'||unit.id==='player_0';
  s.troops[3].x=760;
  const ordinary=s.unit('player_1',{controller:'player',x:810,y:500});
  const captain=s.unit('player_0',{controller:'player',x:820,y:500});
  s.game.students.push(ordinary,captain);s.tick();
  assert.equal(s.troops[3].order.targetId,captain.id,'a slightly more distant captain is a useful morale target');

  const carrier=scenario();carrier.ctx.isHouseCaptain=s.ctx.isHouseCaptain;carrier.troops[3].x=760;
  carrier.game.students.push(carrier.unit('player_0',{controller:'player',x:820,y:500}),carrier.unit('player_1',{controller:'player',x:810,y:500,carryingStandard:'minerva'}));
  carrier.tick();assert.equal(carrier.troops[3].order.targetId,'player_1','banner carriers retain greater priority than captains');
});

test('a hidden captain cannot affect orders or reveal its rank to the commander',()=>{
  const empty=scenario(),fog=scenario();
  empty.ctx.isHouseCaptain=unit=>unit.id==='mars_0';
  fog.ctx.isHouseCaptain=unit=>{assert.notEqual(unit.id,'player_0','hidden enemies must never reach captain scoring');return unit.id==='mars_0';};
  fog.game.students.push(fog.unit('player_0',{controller:'player',x:820,y:500}));fog.hidden.add('player_0');
  empty.tick();fog.tick();assert.deepEqual(fog.orders,empty.orders);assert.equal(strategy.getState(fog.house).seen.size,0);
});

test('an unthreatened captain normally guards home instead of collecting supplies',()=>{
  const s=scenario();s.ctx.isHouseCaptain=unit=>unit.id==='mars_0';
  s.troops[0].x=800;s.troops[1].x=510;
  s.game.lootBoxes.push({id:'box_central',x:810,y:780,alive:true});s.tick();
  assert.equal(s.troops[0].order.type,'defend','captain preference takes precedence over nearest-home reserve selection');
  assert(s.troops.some(unit=>unit.order.type==='box'),'other students still collect the supplies');

  const runner=scenario();runner.ctx.isHouseCaptain=s.ctx.isHouseCaptain;runner.troops[0].carryingStandard='player';runner.tick();
  assert.equal(runner.troops[0].order.type,'returnBanner','carrying a standard still overrides captain reserve duty');
  const wounded=scenario();wounded.ctx.isHouseCaptain=s.ctx.isHouseCaptain;wounded.troops[0].hp=20;wounded.tick();
  assert.equal(wounded.troops[0].order.type,'move','a wounded captain still withdraws before reserve selection');
});
