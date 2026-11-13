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

test('Scattered troops receive independent nearest-unit destinations in every formation',()=>{
  const g=fixture(),left=g.addUnit(0,'infantry',25.5,45.5),right=g.addUnit(0,'cavalry',85.5,45.5);
  const west=g.addUnit(1,'infantry',15.5,45.5),east=g.addUnit(2,'archer',95.5,45.5);
  for(const formation of ['line','spread','wedge']){
    const result=g.attackNearest(new Set([left.id,right.id]),formation);
    assert.equal(result.ok,true);assert.equal(result.count,2);
    targetPoint(left,west);targetPoint(right,east);
    assert.equal(left.order.formation,formation);assert.equal(right.order.formation,formation);
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

test('Enemy units take priority over nearby structures, with structures as the final fallback',()=>{
  const g=fixture(),soldier=g.addUnit(0,'infantry',20.5,40.5);
  const post=g.addBuilding(1,'barracks',23.5,40.5),enemy=g.addUnit(1,'archer',40.5,40.5);
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,enemy);
  enemy.hp=0;
  assert.equal(g.attackNearest([soldier.id]).ok,true);targetPoint(soldier,post);
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
