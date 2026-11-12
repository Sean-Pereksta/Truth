import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
function fixture(house=1){
  const g=new Game({landscape:'open',house,enemies:1,scale:'standard',seed:62741});
  g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];
  for(const t of g.tiles)if(t.terrain!=='water'){t.terrain='grass';t.feature=null;t.owner=0;t.claim=-1;t.capture=0;}
  g.navigation.invalidate();
  for(const s of g.teams){s.count=0;s.cap=2000;s.gold=10000;s.aiClock=1e9;s.heroTimer=0;}
  for(let team=0;team<2;team++){const keep=g.addBuilding(team,'keep',team?101:4,team?85:4);keep.spawnTimer=-1e9;keep.cooldown=1e9;}
  return g;
}
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60);};
const face=(u,x,y)=>{u.facingX=x;u.facingY=y;};

test('Explicit facing orients the formation independently of its destination and ranks spears ahead of archers',()=>{
  const g=fixture(),units=['archer','infantry','bridge_warden','dread_pike','archer','infantry','archer','infantry','siege'].map((type,i)=>g.addUnit(0,type,60+i*.5,40));
  g.command(units.map(u=>u.id),30,40,'move','line',{x:5,y:0});
  for(const u of units){assert.equal(u.order.facingX,1);assert.equal(u.order.facingY,0);assert.equal(u.order.groupX,30);}
  const front=units.filter(u=>UNIT_DEFS[u.type].spearBrace),rear=units.filter(u=>g.unitClass(u)==='archer'||g.unitClass(u)==='siege');
  assert.ok(Math.min(...front.map(u=>u.order.x))>Math.min(...rear.map(u=>u.order.x)),'Polearms occupy forward-facing ranks even while marching west.');
  const spread=units[0].order;g.command([units[0].id],NaN,40,'move','line',{x:1,y:0});assert.equal(units[0].order,spread,'Invalid destinations cannot corrupt a real order.');
  g.command([units[0].id,units[0].id],30,40,'move','line',{x:0,y:0});assert.equal(units[0].order.facingX,undefined,'A zero facing vector falls back to the ordinary command.');
});

test('Backward formation marching preserves the chosen facing and is slower than forward or sideways marching',()=>{
  const march=(x,y)=>{const g=fixture(),u=g.addUnit(0,'infantry',50,40);face(u,1,0);g.command([u.id],x,y,'move','line',{x:1,y:0});step(g,2);return {distance:Math.hypot(u.x-50,u.y-40),u};};
  const forward=march(80,40),back=march(20,40),side=march(50,70);
  assert.ok(back.distance>1&&back.distance<forward.distance*.62);
  assert.ok(side.distance>back.distance&&side.distance<forward.distance*.86);
  assert.equal(back.u.backpedaling,true);assert.ok(back.u.facingX>.999&&Math.abs(back.u.facingY)<.001);
  assert.ok(side.u.facingX>.999,'Sideways translation does not rotate the ordered front.');
});

test('A reorientation takes real time and settled directional pikes brace only after facing the ordered direction',()=>{
  const g=fixture(),u=g.addUnit(0,'dread_pike',50,40);face(u,1,0);
  g.command([u.id],50,40,'attack','line',{x:0,y:1});step(g,.2);
  assert.ok(u.facingX>.8&&u.facingY<.5,'A new facing cannot spin a whole line instantly.');assert.ok(u.braceTime<.45);
  step(g,1.7);assert.ok(u.facingY>.999);assert.ok(u.braceTime>=.45);
  assert.equal(g.isSpearBraced(u,{x:0,y:-1}),true,'A settled directional attack order can form a defensive pike front.');
  g.hold([u.id]);assert.equal(u.order.facingY,1,'Hold preserves the explicitly chosen front.');
  const before=u.y;g.command([u.id],50,30,'move','line',{x:0,y:1});step(g,.5);
  assert.ok(u.y<before&&u.backpedaling);assert.equal(g.isSpearBraced(u,{x:0,y:-1}),false,'Moving pikes never retain the stationary hard charge stop.');
});

test('Directional attack marches stay on the ordered route rather than chasing nearby flank targets',()=>{
  const g=fixture(),u=g.addUnit(0,'infantry',50,40),enemy=g.addUnit(1,'infantry',52,40);face(u,1,0);enemy.cooldown=1e9;
  g.command([u.id],40,40,'attack','line',{x:1,y:0});step(g,.7);
  assert.ok(u.x<49.7,'The formation withdraws west while facing a nearby enemy to the east.');assert.ok(u.facingX>.999);
});

test('A locked formation can strike only across its actual front and front shields do not protect the rear',()=>{
  const g=fixture(),u=g.addUnit(0,'bridge_warden',50,40),rear=g.addUnit(1,'cavalry',49.4,40),front=g.addUnit(1,'cavalry',50.6,40);face(u,1,0);
  g.command([u.id],50,40,'attack','line',{x:1,y:0});
  const rearHp=rear.hp;g.attack(u,rear);assert.equal(rear.hp,rearHp,'A locked spear line cannot attack behind itself without turning.');
  const frontHp=front.hp;g.attack(u,front);assert.ok(front.hp<frontHp);
  const hit=(x,y,projectileType)=>{const target=g.addUnit(0,'bridge_warden',60,40);face(target,1,0);target.order={x:60,y:40,mode:'hold',formation:'line'};const hp=target.hp;g.damage(target,20,{team:1,type:projectileType?'archer':'infantry',impactKind:'weapon',projectileType,originX:x,originY:y});return hp-target.hp;};
  assert.ok(hit(61,40)<hit(60,41));assert.ok(hit(60,41)<hit(59,40));assert.ok(hit(61,40,'arrow')<hit(59,40,'arrow'));
});

test('Rear cavalry impact deals more damage and spends less momentum than an otherwise identical frontal impact',()=>{
  const impact=facingX=>{const g=fixture(),horse=g.addUnit(0,'cavalry',39.5,40),foe=g.addUnit(1,'infantry',40.2,40);foe.hp=foe.maxHp=1000;face(foe,facingX,0);foe.order={x:foe.x,y:foe.y,mode:'attack',formation:'line'};horse.momentum=1;horse.chargeDir={x:1,y:0};g.beginCharge(horse,foe);g.hash.rebuild(g.units);horse.x=40.3;g.chargeContact(horse,39.5,40,1/60);return {damage:1000-foe.hp,momentum:horse.momentum};};
  const front=impact(-1),rear=impact(1);assert.ok(rear.damage>front.damage*1.4);assert.ok(1-rear.momentum<(1-front.momentum)*.5);
});

test('Settled directional Frey and Bolton fronts stop a real run-up while flank and rear charges bypass them',()=>{
  const charge=(type,side)=>{
    const g=fixture(),defender=g.addUnit(0,type,46,40);face(defender,-1,0);defender.cooldown=1e9;g.command([defender.id],46,40,'attack','line',{x:-1,y:0});step(g,1);
    const horse=g.addUnit(1,'cavalry',side==='rear'?54:side==='flank'?46:38,side==='flank'?32:40);horse.cooldown=1e9;face(horse,side==='rear'?-1:side==='flank'?0:1,side==='flank'?1:0);
    g.command([horse.id],side==='rear'?38:side==='flank'?46:56,side==='flank'?48:40,'attack','line');let blocked=false;
    for(let i=0;i<300;i++){g.update(1/60);blocked||=horse.chargeBlockedUntil>g.time;}
    return {blocked,hits:g.stats.chargeImpacts,horse,defender};
  };
  for(const type of ['bridge_warden','dread_pike']){
    const front=charge(type,'front');assert.equal(front.blocked,true,type+' must stop a frontal gallop.');assert.ok(front.horse.x<46);
    for(const side of ['flank','rear']){const hit=charge(type,side);assert.equal(hit.blocked,false,type+' cannot brace against its '+side);assert.ok(hit.hits>0);}
  }
});

test('Backward cavalry cannot build a charge and still reaches its ordered retreat position',()=>{
  const g=fixture(),horse=g.addUnit(0,'cavalry',50,40);face(horse,1,0);
  g.command([horse.id],45,40,'attack','line',{x:1,y:0});step(g,6);
  assert.ok(horse.x<45.3);assert.ok(horse.facingX>.999);assert.equal(horse.charging,false);assert.equal(horse.momentum,0);assert.equal(g.stats.chargeImpacts,0);
});

test('A backward marching company crosses the real five-lane bridge without walking through the river',()=>{
  const g=fixture();
  for(let y=1;y<g.H-1;y++)for(const x of [56,57]){const t=g.tileAt(x,y);t.terrain='water';t.owner=-1;t.feature=y>=38&&y<=42?'bridge':null;}
  g.navigation.invalidate();
  const troops=Array.from({length:9},(_,i)=>g.addUnit(0,'infantry',50+Math.floor(i/3)*.5,39.5+i%3*.5));
  for(const u of troops)face(u,-1,0);g.command(troops.map(u=>u.id),62,40,'move','line',{x:-1,y:0});
  for(let i=0;i<1500;i++){g.update(1/60);for(const u of troops){assert.ok(g.isWalkable(u.x,u.y),'Facing does not bypass river collision.');assert.ok(u.facingX<-.999);}}
  assert.ok(troops.every(u=>u.x>60&&Math.hypot(u.x-u.order.x,u.y-u.order.y)<.4),'The whole company reaches and reforms on the far bank.');
});

test('Bolton pikes and Frey spears remain exclusive house troops rather than universal new recruits',()=>{
  assert.equal(UNIT_DEFS.spearman,undefined);assert.equal(UNIT_DEFS.pikeman,undefined);
  for(const [house,type,building,foreign]of [[8,'dread_pike','dreadfort_yard','bridge_warden'],[9,'bridge_warden','twin_guardhouse','dread_pike']]){
    const g=fixture(house);assert.equal(g.recruitDetails(type).unlocked,false);g.addBuilding(0,building,8,8);
    const details=g.recruitDetails(type),gold=g.teams[0].gold;assert.equal(details.unlocked,true);assert.equal(g.recruit(type).ok,true);assert.equal(g.teams[0].gold,gold-details.cost);assert.equal(g.recruit(foreign).ok,false);
    assert.ok(UNIT_DEFS[type].spearBrace);
  }
});

console.log(`${cases} directional combat checks passed.`);
