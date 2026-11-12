const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {loadGame}=require('./engine-harness.cjs');

function scenario(){
  const env=loadGame(),{A,T}=env,g=A.game;
  const initialSave=A.exportSave();
  g.terrain={dirt:[],waters:[],rivers:[],forestRects:[],hills:[],stones:[],marshes:[],ridges:[],ruins:[],roads:[]};
  g.barricades=[];g.traps=[];g.lootBoxes=[];g.groundLoot=[];g.objectives=[];
  g.visibility={};g.visibilityAt=-1;g.cam={x:0,y:0};g.nextLootSpawnAt=1e9;g.nextBigMidLootAt=1e9;
  for(const house of g.houses)house.ai.thinkAt=1e9;
  for(const s of g.students){s.state='knocked';s.koUntil=1e9;s.attackAction=null;s.engageId=null;s.carryingStandard=null;}
  T.rebuildWalkableGrid();
  function unit(id,x,y){const s=g.students.find(s=>s.id===id);Object.assign(s,{x,y,tx:x,ty:y,weapon:'Sword',weaponLevel:1,armor:'None',item:'None',mount:false,state:'idle',path:[],pathIndex:0,attackCd:0,order:{type:'idle',x,y,manual:false,targetId:null,targetType:null}});A.applyLoadout(s);s.hp=s.maxHp;return s;}
  const student=unit('player_0',1000,1000),enemy=unit('mars_0',1034,1000);
  A.selectUnits([student.id]);A.refreshVisibility(true);g.paused=false;
  return {...env,g,student,enemy,unit,initialSave};
}

test('A immediately attacks nearest visible enemy without a second click',()=>{
  const {A,T,dispatch,student,enemy,unit}=scenario();
  unit('mars_1',1190,1000);unit('mars_2',2200,1000);A.refreshVisibility(true);
  A.setMode('escort');
  const event=dispatch('window','keydown',{key:'a',code:'KeyA'});
  assert(event.defaultPrevented);
  assert.equal(A.getMode(),'move','attack command leaves right click available for movement');
  assert.equal(student.order.type,'attack');
  assert.equal(student.order.targetId,enemy.id);
  assert.equal(student.attackAction?.phase,'windup','an in-range attack begins immediately on the key event');
  const action=student.attackAction;
  dispatch('window','keydown',{key:'a',code:'KeyA',repeat:true});
  assert.equal(student.attackAction,action,'holding A does not repeatedly restart windup');
});

test('A ignores a nearer enemy hidden by terrain',()=>{
  const {A,T,g,dispatch,student,enemy,unit}=scenario();
  enemy.x=1140;g.terrain.ridges=[{x:1060,y:960,w:40,h:80}];
  g.terrainGridReference=null;T.rebuildWalkableGrid();
  const visible=unit('mars_1',1000,1220);A.refreshVisibility(true);
  assert.equal(A.isVisibleTo('player',enemy),false);
  dispatch('window','keydown',{key:'a',code:'KeyA'});
  assert.equal(student.order.targetId,visible.id);
});

test('right-click ground cancels windup and pursuit, moves immediately, and ignores attacks while travelling',()=>{
  const {A,T,g,dispatch,student,enemy}=scenario();
  assert(T.beginAttack(student,enemy));
  student.engageId=enemy.id;
  A.setOrder(enemy,{type:'attack',x:student.x,y:student.y,targetId:student.id,targetType:'student',manual:true});
  dispatch('game','mousedown',{button:2,clientX:1400,clientY:1000});
  assert.equal(student.attackAction,null);
  assert.equal(student.engageId,null);
  assert.equal(student.order.type,'move');
  assert.equal(student.order.targetId,null);
  T.applyStudentDamage(student,8,enemy);
  const x=student.x;
  for(let i=0;i<15;i++){
    A.update(.033);
    assert.equal(student.order.type,'move','taking damage does not replace the move command');
    assert.equal(student.engageId,null);
    assert.equal(student.attackAction,null);
  }
  assert(student.x>x+20,'the student actually disengages and moves toward the clicked destination');
  assert(student.hp<student.maxHp,'movement remains responsive after taking damage');
});

test('movement cancels flag capture and does not restart it while travelling',()=>{
  const {A,T,g,dispatch,student,enemy}=scenario();
  enemy.state='knocked';const standard=g.standards.find(st=>st.houseId==='mars');
  Object.assign(standard,{x:student.x,y:student.y,carriedBy:null,dropped:false,controller:'mars'});
  A.setOrder(student,{type:'capture',x:standard.x,y:standard.y,targetId:'mars',targetType:'standard',manual:true});
  assert(T.startFlagCapture(student,standard));
  dispatch('game','mousedown',{button:2,clientX:1400,clientY:1000});
  assert.equal(student.flagCaptureId,null);assert.equal(standard.captureStudentId,null);
  for(let i=0;i<5;i++){A.update(.033);assert.equal(student.flagCaptureId,null);}
  assert.equal(student.order.type,'move');
});

test('explicit movement overrides automatic return even for a banner carrier',()=>{
  const {A,g,dispatch,student,enemy}=scenario();enemy.state='knocked';
  student.carryingStandard='mars';const standard=g.standards.find(st=>st.houseId==='mars');standard.carriedBy=student.id;
  dispatch('game','mousedown',{button:2,clientX:1400,clientY:1000});
  assert.equal(student.order.type,'move');const x=student.x;A.update(.033);
  assert(student.x>x,'a carrier obeys an explicit move rather than being forced toward home');
});

test('a ground command changes all 100 orders before expensive blocked routes are searched',()=>{
  const {A,T,g,dispatch}=scenario();
  const party=g.students;
  for(let i=0;i<party.length;i++){
    const s=party[i];Object.assign(s,{controller:'player',state:'idle',x:400+(i%10)*34,y:1800+Math.floor(i/10)*34,mount:false,armor:'None',item:'None',weapon:'Sword',carryingStandard:null,engageId:'old-enemy',flagCaptureId:null,attackAction:{phase:'windup'},order:{type:'attack',x:2000,y:2000,targetId:'old-enemy',targetType:'student',manual:true}});A.applyLoadout(s);
  }
  g.terrain.ridges=[{x:800,y:1720,w:80,h:680}];g.terrainGridReference=null;T.rebuildWalkableGrid();
  A.selectUnits(party.map(s=>s.id));g.cam={x:0,y:1600};
  const started=performance.now();dispatch('game','mousedown',{button:2,clientX:1100,clientY:500});const elapsed=performance.now()-started;
  for(const s of party){assert.equal(s.order.type,'move');assert.equal(s.attackAction,null);assert.equal(s.engageId,null);}
  assert(elapsed<350,`100 orders were accepted in ${elapsed.toFixed(1)} ms`);
  const queued=T.getPendingPathCount();assert(queued>20,'many members need a route around the ridge');
  const positions=party.map(s=>[s.x,s.y]);A.update(.033);
  const moved=party.filter((s,i)=>Math.hypot(s.x-positions[i][0],s.y-positions[i][1])>.05).length;
  assert(moved>90,`${moved} of 100 students begin moving on the first update`);
  assert(T.getPendingPathCount()>=queued-4,'only a bounded number of blocked routes are searched per frame');
  console.log(`100-student command accepted in ${elapsed.toFixed(1)} ms.`);
});

test('paused commands are immediate and a newer right click replaces an older queued route',()=>{
  const {A,T,g,student,enemy,dispatch}=scenario();enemy.state='knocked';g.paused=true;
  g.terrain.ridges=[{x:1100,y:860,w:80,h:280}];g.terrainGridReference=null;T.rebuildWalkableGrid();
  dispatch('game','mousedown',{button:2,clientX:1500,clientY:1000});
  assert.equal(T.getPendingPathCount(),1);
  A.update(.1);assert.equal(student.x,1000,'tactical pause does not advance movement');
  dispatch('game','mousedown',{button:2,clientX:700,clientY:1000});
  assert.equal(student.order.type,'move');assert(student.order.x<800);
  assert.equal(T.getPendingPathCount(),0,'a clear newer route removes the older blocked route');
  g.paused=false;A.update(.033);assert(student.x<1000,'the first resumed step follows the newest order');
});

test('New Trial and import discard pending routes from the previous party',()=>{
  const {A,T,g,student,enemy,dispatch,initialSave}=scenario();enemy.state='knocked';
  const queue=()=>{g.terrain.ridges=[{x:1100,y:860,w:80,h:280}];g.terrainGridReference=null;T.rebuildWalkableGrid();A.selectUnits([g.students.find(s=>s.id==='player_0').id]);A.setOrder(g.students.find(s=>s.id==='player_0'),{type:'move',x:1500,y:1000,manual:true});assert(T.getPendingPathCount()>0);};
  queue();assert.equal(A.importSave(initialSave).ok,true);assert.equal(T.getPendingPathCount(),0);
  const restored=g.students.find(s=>s.id==='player_0');assert.notEqual(restored,student);assert.equal(restored.order.type,'idle');
  // Queue a new long order in the restored world, then begin an entirely new trial.
  A.setOrder(restored,{type:'move',x:1500,y:1000,manual:true});assert(T.getPendingPathCount()>0);
  A.init();assert.equal(T.getPendingPathCount(),0);assert.equal(g.students.find(s=>s.id==='player_0').order.type,'idle');
});
