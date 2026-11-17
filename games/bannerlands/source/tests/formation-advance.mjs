import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
import {formationStatus,placeFormation} from '../../formation-placement.js';
import {snapshotWorld,createRemoteGame,applySnapshot} from '../../multiplayer/snapshot.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(config={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:9,fogOfWar:false,seed:72742,...config});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];g.castles=[];
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.owner=0;t.claim=-1;t.capture=0;}
  g.navigation.invalidate();
  for(const team of g.teams){team.count=0;team.cap=1000;team.aiClock=1e9;team.heroTimer=0;team.gold=0;team.alive=true;}
  for(let team=0;team<2;team++){const b=g.addBuilding(team,'keep',team?100:4,team?82:4);b.cooldown=1e9;b.spawnTimer=-1e9;}
  return g;
}
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60);};
function company(g,team,n,x,y,type='bridge_warden'){
  return Array.from({length:n},(_,i)=>{const u=g.addUnit(team,type,x-Math.floor(i/6)*.43,y+(i%6-2.5)*.43);u.facingX=team?-1:1;u.facingY=0;return u;});
}

test('W advances the company in fixed ranks and ignores a lone flanking distraction',()=>{
  const g=fixture(),troops=company(g,0,24,30,40),enemy=company(g,1,18,44,40,'infantry'),bait=g.addUnit(1,'infantry',30,34);
  for(const u of [...enemy,bait]){g.hold([u.id]);u.cooldown=1e9;}
  const result=g.advance(troops.map(u=>u.id),'line');assert.equal(result.ok,true);
  const original=troops.map(u=>({side:u.order.slotSide,back:u.order.slotBack})),center=[...g.formationAdvances.values()][0],start=center.x;
  step(g,5);
  assert.ok(center.x>start+1.4,'The shared formation anchor physically advances.');
  assert.ok(Math.abs(center.angle)<.15,'The lone soldier cannot turn the entire company away from the main enemy force.');
  troops.forEach((u,i)=>{assert.equal(u.order.mode,'advance');assert.equal(u.order.slotSide,original[i].side);assert.equal(u.order.slotBack,original[i].back);assert.ok(Math.abs(u.order.facingY)<.15);});
  assert.ok(troops.every(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y)<.75),'All ranks keep up with their slots: '+troops.map(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y).toFixed(2)).join(','));
});

test('The formation wheels gradually toward an enemy force and keeps its slot layout',()=>{
  const g=fixture(),troops=company(g,0,18,30,40),foes=company(g,1,12,30,52,'infantry');
  for(const u of foes){g.hold([u.id]);u.cooldown=1e9;}
  g.advance(troops.map(u=>u.id));const c=[...g.formationAdvances.values()][0];
  step(g,.2);assert.ok(c.angle>0&&c.angle<.2,'Rotation is bounded rather than instantaneous.');
  step(g,8);assert.ok(c.angle>1.35&&c.angle<1.8,'The whole front eventually faces the substantial enemy force.');
  assert.ok(troops.every(u=>u.order.facingY>.97&&Math.abs(u.order.facingX)<.25));
});

test('Spearmen engage as a formed company and do not pursue through their neighbors',()=>{
  const g=fixture(),troops=company(g,0,18,30,40),foes=company(g,1,12,36,40,'cavalry');
  for(const u of foes){g.hold([u.id]);u.cooldown=1e9;u.hp=u.maxHp=1000;}
  g.advance(troops.map(u=>u.id));step(g,14);
  assert.ok(foes.some(u=>u.hp<1000),'The front ranks reach real weapon range and deal damage.');
  assert.ok(troops.every(u=>u.order.mode==='advance'&&Math.hypot(u.x-u.order.x,u.y-u.order.y)<.75),'Combat preserves each soldier\'s slot.');
  assert.ok(troops.some(u=>g.isSpearBraced(u,{x:-1,y:0})),'After the line halts, spears can prepare their stationary brace.');
  assert.equal(formationStatus(troops,UNIT_DEFS),'Engaged');
});

test('A breaks formation into independent charges, and a move command cancels W immediately',()=>{
  const g=fixture(),troops=company(g,0,12,30,40);company(g,1,8,45,40,'infantry');
  const ids=troops.map(u=>u.id);g.advance(ids);g.attackNearest(ids);
  assert.ok(troops.every(u=>u.order.mode==='attack'&&u.order.formation==='spread'&&u.order.advanceId===undefined&&!g.hasFacingOrder(u)));
  step(g,.1);assert.equal(g.formationAdvances.size,0,'Dissolved cohorts are cleaned up.');
  g.advance(ids);g.command(ids,20,40,'move');step(g,.1);
  assert.ok(troops.every(u=>u.order.mode==='move'&&!g.hasFacingOrder(u)));assert.equal(g.formationAdvances.size,0);
});

test('Formed fronts resist direct hits and displacement while flanks remain exposed',()=>{
  const g=fixture(),u=g.addUnit(0,'shield_bearer',30,40);u.facingX=1;u.facingY=0;g.hold([u.id]);step(g,.6);
  const hit=x=>{const hp=u.hp;g.damage(u,20,{team:1,type:'infantry',impactKind:'weapon',originX:x,originY:40});return hp-u.hp;};
  const front=hit(31),rear=hit(29);assert.ok(front<rear*.65);assert.ok(g.knockbackFactor(u)<1);
  g.attackNearest([u.id]); // No troops are needed for a structure-directed charge.
  assert.equal(g.knockbackFactor(u),1,'Breaking formation loses the cohesion resistance.');
});

test('An ordinary right-click move withdraws faster than a deliberate backward formation march',()=>{
  const retreat=locked=>{const g=fixture(),u=g.addUnit(0,'bridge_warden',40,40);u.facingX=1;u.facingY=0;g.command([u.id],25,40,'move','line',locked?{x:1,y:0}:null);step(g,2);return 40-u.x;};
  assert.ok(retreat(false)>retreat(true)*1.65);
});

test('A large mixed company advances at a shared pace and preserves its rear ranged ranks',()=>{
  const g=fixture(),troops=Array.from({length:160},(_,i)=>g.addUnit(0,i<120?'bridge_warden':'tollhouse_crossbow',30,40));
  const ids=troops.map(u=>u.id);g.command(ids,30,40,'move','line',{x:1,y:0});
  for(const u of troops){u.x=u.order.x;u.y=u.order.y;u.facingX=1;u.facingY=0;}
  const foes=company(g,1,36,50,40,'infantry');for(const u of foes){g.hold([u.id]);u.cooldown=1e9;}
  g.advance(ids);const c=[...g.formationAdvances.values()][0],start=c.x;step(g,9);
  assert.ok(c.x>start+4,'A large group must not stall while already in formation.');
  assert.ok(troops.every(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y)<.8),'Both fast spears and slower crossbows keep up with the same anchor.');
  assert.ok(Math.max(...troops.slice(120).map(u=>u.order.x))<Math.max(...troops.slice(0,120).map(u=>u.order.x)),'Crossbows retain their protected rear ranks.');
});

for(const feature of ['bridge','pass'])test(`Advancing formations cross a five-lane ${feature} under losses and regain their width`,()=>{
  const g=fixture(),troops=Array.from({length:160},()=>g.addUnit(0,'bridge_warden',40,40.5)),ids=troops.map(u=>u.id);
  g.command(ids,40,40.5,'move','line',{x:1,y:0});for(const u of troops){u.x=u.order.x;u.y=u.order.y;u.facingX=1;u.facingY=0;}
  for(let y=1;y<g.H-1;y++)for(const x of [48,49]){const t=g.tileAt(x,y);t.terrain=feature==='bridge'?'water':'mountain';t.feature=y>=38&&y<=42?feature:null;t.featureAxis='x';}
  g.navigation.invalidate();const foes=company(g,1,18,60,40.5,'infantry');for(const u of foes){g.hold([u.id]);u.cooldown=1e9;u.hp=u.maxHp=1000;}
  g.advance(ids);const c=[...g.formationAdvances.values()][0];
  const slots=new Map(troops.map(u=>[u.id,u.order.advanceIndex]));
  let loss=false,widened=false;
  for(let i=0;i<1800;i++){
    g.update(1/30);
    const living=troops.filter(u=>u.hp>0);
    assert.ok(living.every(u=>g.isWalkable(u.x,u.y)));
    if(!loss&&c.status==='Crossing'&&c.x>47){troops[0].hp=0;loss=true;}
    if(loss&&c.crossing)assert.ok(living.every(u=>u.order.advanceIndex===slots.get(u.id)),'No one switches files on the bridge.');
    if(loss&&!c.crossing&&living.every(u=>u.x>50.3)){widened=true;break;}
  }
  assert.ok(loss&&widened,'The surviving ranks cross the bridge and regain their full width.');
});

test('Open-field losses preserve the exact control march, order, front, and all unpromoted slots',()=>{
  function march(withLosses){
    const g=fixture(),troops=company(g,0,32,30,40),foes=company(g,1,10,62,40,'infantry');
    for(const u of foes){g.hold([u.id]);u.cooldown=1e9;}
    g.advance(troops.map(u=>u.id),'pike',{ranks:4,lockFacing:true});
    const c=[...g.formationAdvances.values()][0],orders=troops.map(u=>u.order);
    for(const u of troops){u.x=u.order.x;u.y=u.order.y;}
    step(g,2);
    const path=[],start=c.x;let changes=0,stops=0;
    for(let tick=0;tick<180;tick++){
      if(withLosses&&[4,36,68].includes(tick))troops.find(u=>u.hp>0&&u.order.advanceIndex===3).hp=0;
      if(withLosses&&tick===100)for(const u of troops)if([0,1,2,8,9,10,16,17,18,31].includes(u.order.advanceIndex))u.hp=0;
      const living=troops.filter(u=>u.hp>0),before=liveSlots(living),x=c.x,enemy=c.enemyId;
      g.update(1/30);
      const promoted=living.filter(u=>u.order.advanceIndex!==before.get(u.id).index);
      assert.ok(promoted.length<=2);changes+=promoted.length;
      for(const u of living){
        assert.equal(u.order,orders[troops.indexOf(u)]);assert.equal(u.order.advanceId,c.id);assert.ok(u.order.lockFacing);
        if(!promoted.includes(u))assert.deepEqual(liveSlots([u]).get(u.id),before.get(u.id));
      }
      assert.equal(c.enemyId,enemy);assert.equal(c.angle,0);assert.equal(formationStatus(living,UNIT_DEFS),'Advancing');
      if(x===c.x)stops++;path.push([c.x,c.y]);
    }
    assert.equal(stops,0);assert.ok(!withLosses||changes>0);
    return {path,travel:c.x-start};
  }
  const control=march(false),losses=march(true);
  assert.deepEqual(losses,control);console.log(`Matched march: ${control.travel.toFixed(3)} tiles in 180 ticks, zero stops with and without losses.`);
});
function liveSlots(troops){
  return new Map(troops.map(({id,order})=>[id,{index:order.advanceIndex,side:order.slotSide,back:order.slotBack}]));
}

test('Lead rank loss, a lone survivor and a wipe preserve rear roles and clean up the cohort',()=>{
  const g=fixture(),pikes=company(g,0,8,30,40),archers=company(g,0,4,28,40,'river_ranger'),all=[...pikes,...archers];
  const foes=company(g,1,8,58,40,'infantry');for(const u of foes)g.hold([u.id]);
  g.advance(all.map(u=>u.id),'line',{ranks:3,lockFacing:true});
  const c=[...g.formationAdvances.values()][0],protectedSlots=liveSlots(archers);
  for(const u of all){u.x=u.order.x;u.y=u.order.y;}
  step(g,2);
  for(const u of pikes.slice(0,4))u.hp=0;
  for(let tick=0;tick<30;tick++){const x=c.x;g.update(1/30);assert.ok(c.x>x);}
  assert.ok(pikes.slice(4).some(u=>u.order.advanceIndex<4),'A surviving pike takes the lead.');
  assert.deepEqual(liveSlots(archers),protectedSlots);
  for(const u of all.slice(0,-1))u.hp=0;
  const last=all.at(-1),order=last.order,x=c.x;
  step(g,1);assert.equal(last.order,order);assert.ok(c.x>x);assert.equal(c.members.length,1);
  assert.equal(c.status,'Advancing');assert.equal(last.order.marchSide,last.order.slotSide);assert.equal(last.order.marchBack,last.order.slotBack);
  // The last archer may close a rear-rank gap, but cannot fill a pike lane.
  assert.equal(c.slots[last.order.advanceIndex].role,4);
  last.hp=0;g.update(1/30);assert.equal(g.formationAdvances.size,0);
});

test('A surviving outside file reaches real weapon contact without resetting its slot or stopping for losses',()=>{
  for(const bothWings of [false,true]){
    const g=fixture(),troops=company(g,0,32,30,40),foes=company(g,1,4,43,40,'infantry');
    for(const u of foes){g.hold([u.id]);u.cooldown=1e9;u.hp=u.maxHp=1000;}
    g.advance(troops.map(u=>u.id),'line',{ranks:1,lockFacing:!bothWings});
    for(const u of troops){u.x=u.order.x;u.y=u.order.y;}
    step(g,2);
    const c=[...g.formationAdvances.values()][0],survivors=bothWings?[troops[0],troops.at(-1)]:[troops.at(-1)];
    const original=liveSlots(survivors);
    for(const u of troops)if(!survivors.includes(u))u.hp=0;
    for(let tick=0;tick<900&&foes.every(u=>u.hp===1000);tick++){
      const x=c.x,y=c.y;g.update(1/30);
      assert.ok(c.x!==x||c.y!==y||c.status==='Engaged','A loss alone cannot interrupt an underway wheel or march.');
      if(c.status==='Engaged')assert.ok(survivors.some(s=>foes.some(f=>Math.hypot(s.x-f.x,s.y-f.y)<=g.unitRange(s)+.1)));
    }
    assert.deepEqual(liveSlots(survivors),original);
    assert.ok(foes.some(u=>u.hp<1000),'An empty center cannot claim contact on behalf of the surviving wing.');
  }
});

test('Allied guest snapshots preserve the host anchor, slots and march status after a loss',()=>{
  const g=fixture({mode:'team-conquest',enemies:3,multiplayer:true,humanTeams:[0,1]}),troops=company(g,0,12,30,40),ids=troops.map(u=>u.id),ally=1;
  assert.ok(g.allied(0,ally)&&g.hostile(0,2));
  for(const team of [2,3])g.addBuilding(team,'keep',90,70+team*2);
  company(g,2,8,48,40,'infantry').forEach(u=>g.hold([u.id]));
  g.advance(ids,'line',{ranks:3,lockFacing:true});step(g,2);
  const view=createRemoteGame(snapshotWorld(g,ally,{initial:true})),c=[...g.formationAdvances.values()][0];
  troops[0].hp=0;step(g,.8);applySnapshot(view,snapshotWorld(g,ally,{sequence:1}));
  const remote=view.formationAdvances.get(c.id),living=troops.filter(u=>u.hp>0),remoteTroops=living.map(u=>view.byId.get(u.id));
  assert.ok(!view.byId.has(troops[0].id));assert.deepEqual(remote.members,c.members);
  assert.deepEqual([remote.x,remote.y,remote.angle,remote.lockFacing,remote.status],[c.x,c.y,c.angle,c.lockFacing,c.status]);
  assert.deepEqual(liveSlots(remoteTroops),liveSlots(living));assert.equal(formationStatus(remoteTroops,UNIT_DEFS),formationStatus(living,UNIT_DEFS));
  assert.ok(snapshotWorld(g,2).formationAdvances.length===0);
});

test('Fixed-destination moves and Form Up retain their destination through losses and accept a replacement order',()=>{
  for(const placement of [false,true]){
    const g=fixture(),troops=company(g,0,24,30,40),ids=troops.map(u=>u.id);
    if(placement)placeFormation(g,ids,{x:42,y:40,angle:0,ranks:3,lockFacing:true},UNIT_DEFS);
    else g.command(ids,42,40,'move','line',{x:1,y:0});
    step(g,1);troops[0].hp=0;
    const living=troops.slice(1),orders=living.map(u=>u.order),start=living[4].x;
    step(g,1);assert.ok(living[4].x>start);
    living.forEach((u,i)=>{assert.equal(u.order,orders[i]);assert.equal(u.order.groupX,42);});
    g.command(living.map(u=>u.id),22,38,'move');step(g,.1);
    assert.ok(living.every(u=>u.order.groupX===22&&!u.order.placementId));
    assert.equal(g.placedFormations?.size||0,0);
  }
});

test('Blocked ground holds the anchor, while Hold detaches only the selected troops',()=>{
  const g=fixture(),troops=company(g,0,12,30,40);
  for(let y=1;y<g.H-1;y++)g.tileAt(34,y).terrain='mountain';
  g.navigation.invalidate();
  company(g,1,12,50,40,'infantry').forEach(u=>g.hold([u.id]));
  g.advance(troops.map(u=>u.id),'pike',{ranks:3,lockFacing:true});
  step(g,2);const c=[...g.formationAdvances.values()][0],x=c.x;
  assert.equal(formationStatus(troops,UNIT_DEFS),'Blocked');
  const [held,...marching]=troops;g.hold([held.id]);g.setFacingLock([held.id],false);
  step(g,.5);
  assert.equal(c.x,x);assert.equal(held.order.mode,'hold');assert.equal(held.order.advanceId,undefined);
  assert.ok(c.lockFacing);assert.ok(marching.every(u=>u.order.advanceId===c.id&&u.order.advanceStatus==='Blocked'));
  g.attackNearest(marching.map(u=>u.id));g.update(1/30);
  assert.equal(g.formationAdvances.size,0);assert.ok(marching.every(u=>u.order.mode==='attack'));
});

console.log(`${checks} formation advance checks passed.`);
