import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(){
  const g=new Game({landscape:'open',scale:'standard',enemies:1,house:9,fogOfWar:false,seed:72742});
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
  assert.ok(troops.filter(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y)<.75).length>=troops.length*.8,'The main body advances while locally blocked stragglers catch up: '+troops.map(u=>Math.hypot(u.x-u.order.x,u.y-u.order.y).toFixed(2)).join(','));
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
});

test('A breaks formation into independent charges, and a move command cancels W immediately',()=>{
  const g=fixture(),troops=company(g,0,12,30,40);company(g,1,8,45,40,'infantry');
  const ids=troops.map(u=>u.id);g.advance(ids);g.attackNearest(ids);
  assert.ok(troops.every(u=>u.order.mode==='attack'&&u.order.formation==='spread'&&u.order.advanceId===undefined&&!g.hasFacingOrder(u)));
  step(g,.1);assert.equal(g.formationAdvances.size,0,'Dissolved cohorts are cleaned up.');
  g.advance(ids);g.command(ids,20,40,'move');step(g,.1);
  assert.ok(troops.every(u=>u.order.mode==='move'&&!g.hasFacingOrder(u)));assert.equal(g.formationAdvances.size,0);
});

test('Actual shield fronts resist direct hits and displacement while flanks remain exposed',()=>{
  const g=fixture(),u=g.addUnit(0,'shield_bearer',30,40);u.facingX=1;u.facingY=0;g.hold([u.id]);
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

test('Advancing formations respect impassable riverbanks and cross a five-lane bridge',()=>{
  const g=fixture(),troops=Array.from({length:160},()=>g.addUnit(0,'bridge_warden',40,40.5)),ids=troops.map(u=>u.id);
  g.command(ids,40,40.5,'move','line',{x:1,y:0});for(const u of troops){u.x=u.order.x;u.y=u.order.y;u.facingX=1;u.facingY=0;}
  for(let y=1;y<g.H-1;y++)for(const x of [48,49]){const t=g.tileAt(x,y);t.terrain='water';t.feature=y>=38&&y<=42?'bridge':null;t.featureAxis='x';}
  g.navigation.invalidate();const foes=company(g,1,18,60,40.5,'infantry');for(const u of foes){g.hold([u.id]);u.cooldown=1e9;u.hp=u.maxHp=1000;}
  g.advance(ids);
  for(let i=0;i<1800;i++){g.update(1/30);assert.ok(troops.every(u=>g.isWalkable(u.x,u.y)));if(troops.every(u=>u.x>50.3))break;}
  assert.ok(troops.every(u=>u.x>50.3),'Every rank must eventually cross the passable bridge.');
});

console.log(`${checks} formation advance checks passed.`);
