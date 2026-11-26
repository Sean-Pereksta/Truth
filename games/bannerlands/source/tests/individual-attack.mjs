import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const fixture=()=>{
  const g=new Game({landscape:'open',scale:'standard',enemies:3,seed:44277});
  g.units=[];g.buildings=[];g.byId.clear();g.objectives=[];g.time=100;
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.featureAxis=null;t.owner=0;t.capture=0;t.claim=-1;}
  for(const s of g.teams){s.count=0;s.alive=true;s.aiClock=1e9;s.cap=260;s.powerReadyAt=1e9;}
  g.navigation.invalidate();g.hash.rebuild(g.units);return g;
};
const targetPoint=(u,target)=>{
  assert.equal(u.order.mode,'attack');
  assert.equal(u.order.groupX,target.x);assert.equal(u.order.groupY,target.y);
  assert.equal(u.order.x,target.x);assert.equal(u.order.y,target.y);
};

test('Charge releases every chosen formation into independent nearest-unit destinations',()=>{
  const g=fixture(),left=g.addUnit(0,'infantry',25.5,45.5),right=g.addUnit(0,'cavalry',85.5,45.5);
  const west=g.addUnit(1,'infantry',15.5,45.5),east=g.addUnit(2,'archer',95.5,45.5);
  for(const formation of ['line','spread','wedge']){
    const result=g.attackNearest(new Set([left.id,right.id]),formation);
    assert.equal(result.ok,true);assert.equal(result.count,2);
    targetPoint(left,west);targetPoint(right,east);
    assert.equal(left.order.formation,'spread');assert.equal(right.order.formation,'spread');
    assert.equal(left.order.advanceId,undefined);assert.equal(right.order.advanceId,undefined);
  }
});

test('Allied, fallen and eliminated troops never become nearest-enemy targets',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5);
  g.teams[1].alliance=g.teams[0].alliance;
  g.addUnit(1,'infantry',21.5,40.5);
  const fallen=g.addUnit(2,'infantry',22.5,40.5);fallen.hp=0;
  g.addUnit(3,'infantry',23.5,40.5);g.teams[3].alive=false;
  const enemy=g.addUnit(2,'archer',30.5,40.5);
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,enemy);
});

test('Nearest attacks compare buildings and troops on equal distance terms',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5);
  const post=g.addBuilding(1,'barracks',23.5,40.5),enemy=g.addUnit(1,'archer',40.5,40.5);
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,post);
  enemy.x=21.5;
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,enemy);
  enemy.hp=0;
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,post);
});

test('Scattered troops choose their own nearest building or troop even with enemy armies remaining',()=>{
  const g=fixture(),left=g.addUnit(0,'infantry',20.5,40.5),right=g.addUnit(0,'infantry',80.5,40.5);
  const post=g.addBuilding(1,'barracks',15.5,40.5),enemy=g.addUnit(2,'infantry',85.5,40.5);
  assert.equal(g.attackNearest([left.id,right.id]).count,2);targetPoint(left,post);targetPoint(right,enemy);
});

const advance=(g,seconds,inspect)=>{
  for(let i=0;i<Math.round(seconds*30);i++){
    g.time+=1/30;g.navigation.beginUpdate();g.hash.rebuild(g.units);
    g.updateUnits(1/30);g.updateProjectiles(1/30);
    inspect?.(i);
  }
};

function clusteredTroops(g,type,x,y,count,gap){
  return Array.from({length:count},(_,i)=>{
    const u=g.addUnit(0,type,x-(i%3)*gap,y+(Math.floor(i/3)-(Math.ceil(count/3)-1)/2)*gap);
    u.facingX=1;u.facingY=0;u.cooldown=0;
    return u;
  });
}
function heldDefender(g,x,y){
  const u=g.addUnit(1,'infantry',x,y);
  g.hold([u.id]);u.cooldown=1e9;u.hp=u.maxHp=1e6;
  return u;
}
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const nearestAlly=(u,allies)=>Math.min(...allies.filter(v=>v!==u).map(v=>Math.hypot(u.x-v.x,u.y-v.y)));

test('Independent melee charges spread across the enemy line and keep striking',()=>{
  const g=fixture(),units=clusteredTroops(g,'infantry',39,41.05,24,.34),samples=[];
  const defenders=Array.from({length:7},(_,i)=>heldDefender(g,43,39.5+i*.52));
  g.attackNearest(units.map(u=>u.id));
  advance(g,8.5,i=>{
    if(i>=60&&i%10===0)samples.push(mean(units.map(u=>nearestAlly(u,units))));
  });
  assert.ok(mean(samples)>.50,'Attackers should keep room between them through contact.');
  assert.ok(defenders.every(u=>u.hp<u.maxHp),'The attackers should reach the full enemy line.');
  assert.ok(g.stats.battles>160,'Spacing should keep the attackers in striking range.');
});

test('Riders keep space during physical charges and still land their impacts',()=>{
  const g=fixture(),units=clusteredTroops(g,'cavalry',39.5,40.5,12,.29),samples=[],charged=new Set();
  heldDefender(g,47.5,40.5);
  g.attackNearest(units.map(u=>u.id));
  advance(g,7,()=>{
    const riders=units.filter(u=>u.charging);
    for(const rider of riders)charged.add(rider.id);
    if(riders.length>=3)samples.push(mean(riders.map(u=>nearestAlly(u,units))));
  });
  assert.ok(mean(samples)>.50);
  assert.ok(charged.size>=10&&g.stats.chargeImpacts>=4);
});

test('Independent move orders to the same point still leave room after arrival',()=>{
  const g=fixture(),units=clusteredTroops(g,'infantry',34.5,40.5,12,.22),goal={x:42.5,y:40.5};
  for(const u of units)g.command([u.id],goal.x,goal.y,'move','spread');
  advance(g,10);
  assert.ok(mean(units.map(u=>nearestAlly(u,units)))>.42);
  assert.ok(units.every(u=>Math.hypot(u.x-goal.x,u.y-goal.y)<1.4&&g.isWalkable(u.x,u.y)));
});

test('An explicit building attack closes the distance and damages that building despite nearer troops',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),post=g.addBuilding(1,'barracks',27.5,40.5),enemy=g.addUnit(1,'infantry',20.5,43.5);
  g.hold([enemy.id]);enemy.cooldown=1e9;soldier.cooldown=0;
  assert.equal(g.attackTarget([soldier.id],post.id).ok,true);
  advance(g,1);assert.equal(soldier.target,post);assert.ok(soldier.x>21,'The explicit target must pull the soldier toward the building.');
  advance(g,5);assert.ok(post.hp<post.maxHp);assert.equal(enemy.hp,enemy.maxHp,'Nearby troops must not steal a focused building attack.');
});

test('An ordinary attack-move encounters and damages a building with enemy troops elsewhere',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),post=g.addBuilding(1,'barracks',24.5,40.5),enemy=g.addUnit(1,'infantry',80.5,40.5);
  g.hold([enemy.id]);enemy.cooldown=1e9;soldier.cooldown=0;g.command([soldier.id],35.5,40.5,'attack');
  advance(g,5);assert.ok(post.hp<post.maxHp);assert.equal(enemy.hp,enemy.maxHp);
});

test('A focused archer routes around blocked sightlines to damage the chosen building',()=>{
  const g=fixture(),soldier=g.addUnit(0,'archer',30.5,40.5),post=g.addBuilding(1,'barracks',34.5,40.5);
  g.tileAt(32.5,40.5).terrain='mountain';g.navigation.invalidate();soldier.cooldown=0;
  assert.equal(g.combatTerrain.canShoot(soldier,post),false);g.attackTarget([soldier.id],post.id);
  advance(g,10);assert.equal(soldier.target,post);assert.ok(post.hp<post.maxHp,'A focused ranged troop must move for a clear shot, instead of waiting behind cover forever.');
  assert.ok(g.isWalkable(soldier.x,soldier.y));
});

test('Invalid explicit targets preserve orders and a new player order overrides building focus',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),post=g.addBuilding(1,'barracks',25.5,40.5);
  for(const kind of ['allied','fallen','eliminated','hidden','missing']){
    g.teams[1].alliance=g.teams[0].alliance+1;g.teams[1].alive=true;post.hp=post.maxHp;g.isVisibleTo=()=>true;
    if(kind==='allied')g.teams[1].alliance=g.teams[0].alliance;
    if(kind==='fallen')post.hp=0;
    if(kind==='eliminated')g.teams[1].alive=false;
    if(kind==='hidden')g.isVisibleTo=()=>false;
    g.command([soldier.id],15.5,40.5,'move');const previous=soldier.order;
    assert.equal(g.attackTarget([soldier.id],kind==='missing'?-99:post.id).ok,false,kind);assert.equal(soldier.order,previous,kind);
  }
  g.teams[1].alive=true;post.hp=post.maxHp;g.isVisibleTo=()=>true;
  for(const mode of ['move','hold','expand','attack']){
    assert.equal(g.attackTarget([soldier.id],post.id).ok,true);
    if(mode==='hold')g.hold([soldier.id]);else if(mode==='expand')g.expand([soldier.id]);else g.command([soldier.id],15.5,40.5,mode);
    const order=soldier.order;assert.equal(soldier.target,null);advance(g,.3);assert.equal(soldier.order,order);assert.equal(soldier.target,null);
  }
});

test('A focused building releases combat when destroyed, allied, eliminated or out of sight',()=>{
  for(const kind of ['fallen','allied','eliminated','hidden']){
    const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),post=g.addBuilding(1,'barracks',25.5,40.5);
    g.attackTarget([soldier.id],post.id);advance(g,.4);assert.equal(soldier.target,post);
    if(kind==='fallen')post.hp=0;
    if(kind==='allied')g.teams[1].alliance=g.teams[0].alliance;
    if(kind==='eliminated')g.teams[1].alive=false;
    if(kind==='hidden')g.isVisibleTo=(team,entity)=>entity!==post;
    advance(g,.4);assert.notEqual(soldier.target,post,kind);
  }
});

test('Fog limits nearest attacks to visible troops and known building destinations',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),hidden=g.addBuilding(1,'barracks',21.5,40.5),visible=g.addUnit(1,'infantry',30.5,40.5);
  const memory={id:-500,team:2,type:'barracks',hp:500,x:25.5,y:40.5,remembered:true};g.config.fogOfWar=true;
  g.knownBuildings=()=>[memory];g.knownUnits=()=>[visible];g.isVisibleTo=(team,entity)=>entity!==hidden;
  g.attackNearest([soldier.id]);targetPoint(soldier,memory);assert.equal(soldier.target,null);
  g.knownBuildings=()=>[];g.attackNearest([soldier.id]);targetPoint(soldier,visible);
});

test('Invalid, duplicate and dead selection entries cannot command extra troops',()=>{
  const g=fixture(),chosen=g.addUnit(0,'infantry',20.5,40.5),unselected=g.addUnit(0,'archer',70.5,40.5);
  const fallen=g.addUnit(0,'infantry',30.5,40.5);fallen.hp=0;
  const keep=g.addBuilding(0,'keep',10.5,10.5),enemy=g.addUnit(1,'infantry',25.5,40.5);
  g.hold([unselected.id]);const untouched=unselected.order;
  const result=g.attackNearest([chosen.id,chosen.id,fallen.id,keep.id,-999]);
  assert.equal(result.ok,true);assert.equal(result.count,1);targetPoint(chosen,enemy);
  assert.equal(unselected.order,untouched);assert.equal(fallen.order,null);
});

test('An empty selection or a realm without enemies leaves current orders intact',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5);
  g.command([soldier.id],30.5,40.5,'move');const previous=soldier.order;
  assert.equal(g.attackNearest([]).ok,false);
  assert.equal(g.attackNearest([soldier.id]).ok,false);assert.equal(soldier.order,previous);
});

test('Individual nearest attacks preserve recruitment rallies and building orders',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5),post=g.addBuilding(0,'barracks',10.5,10.5);
  g.teams[0].rally={x:30.5,y:20.5};post.rally={x:15.5,y:20.5};
  const global=structuredClone(g.teams[0].rally),local=structuredClone(post.rally);
  g.addUnit(1,'infantry',25.5,40.5);g.attackNearest([soldier.id]);
  assert.deepEqual(g.teams[0].rally,global);assert.deepEqual(post.rally,local);
});

test('Infantry and cavalry on separate fronts actually march in opposite directions',()=>{
  const g=fixture(),left=g.addUnit(0,'infantry',30.5,45.5),right=g.addUnit(0,'cavalry',80.5,45.5);
  const west=g.addUnit(1,'infantry',15.5,45.5),east=g.addUnit(2,'archer',95.5,45.5);
  for(const u of g.units)u.cooldown=1e9;g.hold([west.id,east.id]);
  g.attackNearest([left.id,right.id]);
  for(let i=0;i<30;i++){g.time+=1/30;g.hash.rebuild(g.units);g.updateUnits(1/30);}
  assert.ok(left.x<30.1,'The western infantry must engage its own western front.');
  assert.ok(right.x>80.9,'The eastern cavalry must engage its own eastern front.');
  assert.ok(g.units.every(u=>g.isWalkable(u.x,u.y)));
});

test('Pressing nearest attack again recomputes from each troop and current enemy positions',()=>{
  const g=fixture(),left=g.addUnit(0,'infantry',20.5,45.5),right=g.addUnit(0,'infantry',80.5,45.5);
  const a=g.addUnit(1,'archer',10.5,45.5),b=g.addUnit(2,'cavalry',90.5,45.5);
  g.attackNearest([left.id,right.id]);targetPoint(left,a);targetPoint(right,b);
  a.x=65.5;b.x=15.5;
  g.attackNearest([left.id,right.id]);targetPoint(left,b);targetPoint(right,a);
});

test('The production A and button handler dispatches individual orders without a shared marker',()=>{
  const source=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8'),start=source.indexOf('function attackNearest(){'),end=source.indexOf('\nfunction useHousePower()',start);
  assert.ok(start>=0&&end>start);
  const g=fixture(),left=g.addUnit(0,'infantry',25.5,45.5),right=g.addUnit(0,'cavalry',85.5,45.5),west=g.addUnit(1,'infantry',15.5,45.5),east=g.addUnit(2,'archer',95.5,45.5);
  let cancelled=0;const context={game:g,started:true,menuOpen:false,battleHud:{close(){}},ui:{formation:'wedge',orderMarker:{x:50,y:50}},selected:()=>[left,right],toast:()=>{},tone:()=>{},cancelBuild:()=>cancelled++,setMode:mode=>assert.equal(mode,'attack')};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.attackNearest();
  targetPoint(left,west);targetPoint(right,east);assert.equal(context.ui.orderMarker,null);assert.equal(cancelled,1);
});

console.log(`${cases} individual nearest-attack checks passed.`);
