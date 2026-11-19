import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
import {FORMATION_PRESETS,formationSettings,formationPreview,placeFormation,updatePlacedFormations,formationStatus} from '../../formation-placement.js';

let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
 const g=new Game({landscape:'open',scale:'standard',enemies:1,house:0,fogOfWar:false,seed:7713});
 g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.castles=[];g.objectives=[];
 for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.owner=0;}
 g.navigation.invalidate();for(const s of g.teams){s.count=0;s.cap=1000;s.aiClock=1e9;s.gold=0;s.alive=true;}
 for(let team=0;team<2;team++){const b=g.addBuilding(team,'keep',team?100:4,team?82:4);b.cooldown=1e9;b.spawnTimer=-1e9;}
 return g;
}
const company=(g,n=24,type='winter_pikeman')=>Array.from({length:n},(_,i)=>{const u=g.addUnit(0,type,30-Math.floor(i/6)*.48,40+(i%6-2.5)*.48);u.facingX=1;u.facingY=0;return u;});
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60);};

test('Five presets and one to four ranks preserve count and derive consistent width/depth',()=>{
 assert.deepEqual(Object.keys(FORMATION_PRESETS),['line','pike','shield','wedge','loose']);
 for(const ranks of [1,2,3,4]){const s=formationSettings(24,{ranks});assert.equal(s.ranks,ranks);assert.equal(s.columns*ranks,24);assert.equal(s.width,(s.columns-1)*s.spacing);}
 const narrow=formationSettings(25,{width:0});assert.equal(narrow.ranks,4);assert.equal(narrow.columns,7);
 const wide=formationSettings(25,{width:500});assert.equal(wide.ranks,1);assert.equal(wide.columns,25);
});

test('Placement uses precise logical angles, mixed roles, and stable soldier lanes',()=>{
 const g=fixture(),archers=company(g,6,'river_ranger'),pikes=company(g,12),shields=company(g,6,'shield_bearer'),all=[...archers,...pikes,...shields];
 let result=placeFormation(g,all.map(u=>u.id),{x:40,y:40,angle:.73,ranks:4,preset:'pike',lockFacing:true},UNIT_DEFS);assert.ok(result.ok);
 assert.ok(pikes.every(u=>u.order.slotBack<Math.min(...archers.map(a=>a.order.slotBack))));
 assert.ok(all.every(u=>Math.abs(u.order.facingX-Math.cos(.73))<1e-9&&Math.abs(u.order.facingY-Math.sin(.73))<1e-9));
 const slots=new Map(all.map(u=>[u.id,u.order.slotIndex]));
 result=placeFormation(g,all.reverse().map(u=>u.id),{x:40,y:40,angle:1.2,ranks:4,preset:'pike',lockFacing:true,faceInPlace:true},UNIT_DEFS);assert.ok(result.ok);
 for(const u of all)assert.equal(u.order.slotIndex,slots.get(u.id),'Reversing selection iteration cannot reshuffle ranks.');
 assert.ok(all.every(u=>u.order.mode==='move'&&(u.braceTime||0)===0));
});

test('Blocked and disconnected slots are previewed, and impossible placement preserves orders',()=>{
 const g=fixture(),troops=company(g,12);for(let y=1;y<g.H-1;y++){const t=g.tileAt(50,y);t.terrain='water';}g.navigation.invalidate();
 const preview=formationPreview(g,troops,{x:60,y:40,angle:0,ranks:3},UNIT_DEFS);assert.equal(preview.blocked,12);
 const previous=troops.map(u=>u.order);assert.equal(placeFormation(g,troops.map(u=>u.id),{x:60,y:40,angle:0,ranks:3},UNIT_DEFS).ok,false);
 troops.forEach((u,i)=>assert.equal(u.order,previous[i]));
});

test('Living building footprints block soldier slots using actual structure and soldier radii',()=>{
 const g=fixture(),troops=company(g,2),keep=g.addBuilding(0,'keep',40,40),options={x:40,y:40,angle:0,ranks:2};
 assert.equal(formationPreview(g,troops,options,UNIT_DEFS).blocked,2);
 assert.equal(placeFormation(g,troops.map(u=>u.id),options,UNIT_DEFS).ok,false,'A footprint wholly inside a keep cannot be confirmed.');
 const edge={...options,x:keep.x+g.buildingRadius(keep)+troops[0].radius-.01,ranks:1};assert.ok(formationPreview(g,[troops[0]],edge,UNIT_DEFS).blocked>0,'Soldier radius contributes to footprint clearance.');
 keep.hp=0;assert.equal(formationPreview(g,troops,options,UNIT_DEFS).blocked,0,'Destroyed structures no longer obstruct placement.');
});

test('A front casualty promotes a rear soldier without resetting planted neighbors',()=>{
 const g=fixture(),troops=company(g,12),result=placeFormation(g,troops.map(u=>u.id),{x:35,y:40,angle:0,ranks:3,preset:'pike',lockFacing:true},UNIT_DEFS);
 for(const u of troops){u.x=u.order.x;u.y=u.order.y;u.order.mode='hold';u.braceTime=.8;}
 const dead=troops[0],deadSlot=dead.order.slotIndex,others=new Map(troops.slice(1).map(u=>[u.id,{index:u.order.slotIndex,x:u.order.x,y:u.order.y}]));dead.hp=0;
 updatePlacedFormations(g,1/60,UNIT_DEFS);
 assert.ok(troops.slice(1).every(u=>u.order.slotIndex===others.get(u.id).index),'The lost soldier leaves a gap immediately.');
 g.time+=.3;updatePlacedFormations(g,1/60,UNIT_DEFS);
 const changed=troops.slice(1).filter(u=>u.order.slotIndex!==others.get(u.id).index);
 assert.deepEqual(changed.map(u=>u.id),[troops[4].id],'The nearest compatible soldier in the next rank takes the gap.');
 assert.equal(changed[0].order.slotIndex,deadSlot);
 for(const u of troops.slice(1).filter(u=>!changed.includes(u))){assert.equal(u.braceTime,.8);assert.equal(u.order.x,others.get(u.id).x);assert.equal(u.order.y,others.get(u.id).y);}
 assert.equal(g.placedFormations.get(result.formation.id).members.length,11);
});

test('Formation orders turn physically and each arrived pikeman settles independently',()=>{
 const g=fixture(),troops=company(g,8);placeFormation(g,troops.map(u=>u.id),{x:30,y:40,angle:Math.PI/2,ranks:2,preset:'pike',lockFacing:true},UNIT_DEFS);
 tick(g,.1);assert.ok(troops.every(u=>u.facingY<.3),'Facing does not snap to its final angle.');assert.ok(troops.every(u=>(u.braceTime||0)<.5));
 for(const u of troops.slice(1)){u.x=u.order.x;u.y=u.order.y;u.facingX=0;u.facingY=1;u.vx=0;u.vy=0;u.order.mode='hold';}
 troops[0].x-=10;tick(g,.8);assert.ok(troops.slice(1).some(u=>u.spearState==='braced'));assert.notEqual(troops[0].spearState,'braced');assert.match(formationStatus(troops,UNIT_DEFS),/^Braced: /);
 g.command(troops.map(u=>u.id),20,40,'move');assert.ok(troops.every(u=>u.order.placementId===undefined));tick(g,.1);assert.equal(g.placedFormations.size,0);
});

test('Unlocked formations keep their ranks while archers turn to fight off the rear',()=>{
 const g=fixture(),pikes=company(g,6),archers=company(g,6,'river_ranger'),troops=[...pikes,...archers];
 assert.ok(placeFormation(g,troops.map(u=>u.id),{x:34,y:40,angle:0,ranks:2,lockFacing:false},UNIT_DEFS).ok);
 tick(g,8);
 const foe=g.addUnit(1,'infantry',30.8,40);g.hold([foe.id]);foe.cooldown=1e9;foe.hp=foe.maxHp=1000;
 tick(g,5);
 assert.ok(foe.hp<1000,'An unlocked archer may aim behind the formation.');
 assert.ok(archers.some(u=>u.facingX<-.8));
 assert.ok(troops.every(u=>u.order.mode==='hold'&&Math.hypot(u.x-u.order.x,u.y-u.order.y)<.2),'The melee ranks do not leave the line to chase.');
});

test('Locked advance keeps the commanded front and one lost straggler cannot stop the main line',()=>{
 const g=fixture(),troops=company(g,24),enemy=Array.from({length:12},(_,i)=>g.addUnit(1,'infantry',45,38+i*.4));for(const u of enemy){g.hold([u.id]);u.cooldown=1e9;}
 g.advance(troops.map(u=>u.id),'pike',{ranks:4,lockFacing:true});const c=[...g.formationAdvances.values()][0],start=c.x;
 troops[0].x-=20;tick(g,5);assert.ok(c.x>start+1,'The cohort continues while a delayed soldier catches up.');assert.ok(Math.abs(c.angle)<1e-9);assert.ok(troops.every(u=>u.order.lockFacing));
});

test('Four crossbow reload timelines expose compact counted selection states without hiding formation readiness',()=>{
 const g=fixture(),types=['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel'],troops=types.map(type=>g.addUnit(0,type,30,40));
 for(const u of troops)u.order={x:u.x,y:u.y,mode:'idle'};
 assert.equal(formationStatus(troops,UNIT_DEFS),'Loaded: 4');
 for(const u of troops){u.crossbowAim={elapsed:.05};u.crossbowState='aiming';}assert.equal(formationStatus(troops,UNIT_DEFS),'Aiming: 4');
 for(const [stage,label]of [['lower','Lowering'],['span','Spanning'],['retrieve','Loading Bolt'],['seat','Loading Bolt'],['raise','Ready']]){
  for(const u of troops){u.crossbowAim=null;u.reload={stage,duration:UNIT_DEFS[u.type].rate,progress:0};u.reloading=true;u.crossbowState=stage;}
  assert.equal(formationStatus(troops,UNIT_DEFS),`${label}: 4`,stage);
 }
 troops[0].reload=null;troops[0].crossbowState='loaded';troops[1].reload.stage='span';troops[2].reload.stage='retrieve';troops[3].reload.stage='seat';
 const p=g.addUnit(0,'winter_pikeman',30,40);p.order={x:p.x,y:p.y,mode:'hold'};p.spearState='braced';
 assert.equal(formationStatus([p,...troops],UNIT_DEFS),'Braced: 1/1 · Loaded: 1 · Spanning: 1 · Loading Bolt: 2');
 p.spearState='turning';p.facingX=1;p.facingY=0;p.order.facingX=0;p.order.facingY=1;assert.match(formationStatus([p,...troops],UNIT_DEFS),/^Turning · Loaded: 1/);
 for(const u of troops){u.reloading=false;u.reload={stage:'span'};u.order.mode='move';u.order.x+=3;}assert.equal(formationStatus(troops,UNIT_DEFS),'Marching · Unloaded: 4');
});
console.log(`${checks} formation placement checks passed.`);
