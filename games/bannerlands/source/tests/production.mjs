import assert from 'node:assert/strict';
import {Game,BUILD_DEFS} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const setup=(style='mass',team=1)=>{
  const g=new Game({house:0,enemies:3,scale:'standard',seed:44277}),s=g.teams[team];s.strategy=style;s.powerReadyAt=1e9;
  const p=g.aiPlanFor(s);g.time=60;return {g,s,p};
};
const tick=({g,s,p},threat=false)=>{p.economyAt=0;g.hash.rebuild(g.units);g.aiEconomy(s,p,g.group(s.id),threat);};
const factories=(g,s)=>g.buildings.filter(b=>b.team===s.id&&b.hp>0&&b.type!=='keep'&&BUILD_DEFS[b.type].unit);
const supply=({g,s})=>{while(g.group(s.id).length<s.cap)g.addUnit(s.id,'infantry',s.home.x+3,s.home.y+3);};
const scoutEnemy=(state,type,n)=>{
  const {g,s}=state;for(const u of g.units)if(g.hostile(s.id,u.team)){u.x=2;u.y=2;}
  for(let i=0;i<n;i++)g.addUnit(0,type,s.home.x-8-(i%3)*.3,s.home.y-8-Math.floor(i/3)*.3);g.hash.rebuild(g.units);
};

test('Personality changes actual facility purchases and every purchase pays the normal price',()=>{
  for(const [style,team,expected] of [['mass',1,'barracks'],['raider',3,'storm_paddock'],['siege',2,'dragonfire_foundry']]){
    const state=setup(style,team),{g,s,p}=state;s.gold=700;
    const spend=[],build=g.build.bind(g);g.build=(...args)=>{const before=s.gold,result=build(...args);if(result.ok)spend.push({type:args[0],cost:before-s.gold});return result;};
    tick(state);assert.equal(p.production.type,expected);assert.equal(p.production.status,'built');
    assert.equal(spend[0].cost,BUILD_DEFS[expected].cost);assert.equal(spend[0].type,expected);assert.ok(s.gold>=0);
    assert.ok(p.production.options.length>=3);assert.ok(p.production.reason.length>15);
  }
});

test('A chosen factory keeps its savings across decisions and cannot be drained by paid house powers',()=>{
  const state=setup(),{g,s,p}=state;s.gold=150;tick(state);
  assert.equal(p.production.status,'saving');const chosen=p.production.type,reserve=p.production.reserved;
  assert.ok(reserve>=BUILD_DEFS[chosen].cost);assert.equal(s.gold,150);
  s.powerReadyAt=0;g.aiHousePower(s,g.group(s.id));assert.equal(s.gold,150);
  for(let i=0;i<3;i++){g.time+=8;s.gold+=30;tick(state);assert.equal(p.production.type,chosen);assert.equal(p.production.status,'saving');}
  s.gold=p.production.reserved;g.time+=8;tick(state);assert.equal(p.production.status,'built');assert.equal(p.production.type,chosen);
});

test('Free mustering powers remain available while factory and capital money is reserved',()=>{
  const g=new Game({house:0,enemies:5,scale:'standard',seed:44277}),s=g.teams[4];assert.equal(s.sigil,'rose');
  const p=g.aiPlanFor(s);p.production={reserved:400,status:'saving'};p.economyReserve=680;s.gold=0;g.time=20;
  const before=g.group(s.id).length;g.aiHousePower(s,g.group(s.id));assert.ok(g.group(s.id).length>before);assert.equal(s.gold,0);
});

test('Visible enemy archers change a mass planner toward cavalry production',()=>{
  const state=setup(),{g,s,p}=state;s.gold=0;tick(state);assert.equal(p.production.type,'barracks');
  scoutEnemy(state,'archer',35);g.time+=8;tick(state);
  assert.equal(p.production.counter,'archers');assert.equal(p.production.type,'stables');assert.match(p.production.reason,/archers/);
});

test('Enemy cavalry and fortified fronts produce different training choices',()=>{
  const state=setup('raider',3),{g,s,p}=state;s.gold=0;scoutEnemy(state,'cavalry',40);tick(state);
  assert.equal(p.production.counter,'cavalry');assert.ok(['barracks',g.houseContent(s.id).building].includes(p.production.type));
  const siege=setup('siege',2);siege.s.gold=0;
  siege.g.addBuilding(0,'tower',siege.s.home.x-9,siege.s.home.y-9);siege.g.addBuilding(0,'tower',siege.s.home.x-10,siege.s.home.y-9);
  tick(siege);assert.equal(siege.p.production.counter,'forts');assert.ok(siege.p.production.ratios.siege>.18);
  assert.ok(siege.p.production.options.some(o=>o.type==='workshop'&&o.reason.includes('siege')));
});

test('Destroyed production remains a rebuild priority through several low-gold decisions',()=>{
  const state=setup(),{g,s,p}=state;s.gold=0;tick(state);
  const range=g.buildings.find(b=>b.team===s.id&&b.type==='range');range.hp=0;
  for(let i=0;i<4;i++){g.time+=8;tick(state);assert.equal(p.production.type,'range');assert.match(p.production.reason,/Rebuild/);assert.ok(p.productionKnown.range>=1);}
  s.gold=p.production.reserved;g.time+=8;tick(state);assert.equal(p.production.status,'built');assert.ok(factories(g,s).some(b=>b.type==='range'));
});

test('Placement finds distant safe owned land after the capital area is blocked',()=>{
  const state=setup(),{g,s,p}=state;
  for(const tile of g.tiles)if(tile.owner===s.id)tile.owner=-1;
  const remote={x:g.W/2+.5,y:g.H/2+.5},tile=g.tileAt(remote.x,remote.y);tile.owner=s.id;tile.terrain='grass';g.recount();
  // Earlier random probing could miss this sole valid site on every decision.
  s.gold=500;tick(state);assert.equal(p.production.status,'built');assert.deepEqual(p.production.site,remote);
});

test('Unsafe or entirely occupied owned land blocks spending until a legal site is restored',()=>{
  const state=setup(),{g,s,p}=state;s.gold=500;
  for(const tile of g.tiles)if(tile.owner===s.id)tile.owner=-1;
  const own=g.tileAt(s.home.x,s.home.y);own.owner=s.id;g.recount();tick(state);
  assert.equal(p.production.status,'blocked');assert.equal(p.production.reserved,0);assert.match(p.production.reason,/safe, clear/);
  const x=Math.floor(g.W/2)+.5,y=Math.floor(g.H/2)+.5,tile=g.tileAt(x,y);tile.owner=s.id;tile.terrain='grass';
  const enemy=g.addUnit(0,'infantry',x+1,y);g.hash.rebuild(g.units);g.time+=8;s.gold=500;tick(state);assert.equal(p.production.status,'blocked');
  enemy.hp=0;g.time+=8;s.gold=500;tick(state);assert.equal(p.production.status,'built');
});

test('Near-full supply pauses factory growth and construction resumes after troop losses',()=>{
  const state=setup(),{g,s,p}=state;supply(state);s.gold=1000;const before=factories(g,s).length;
  tick(state);assert.equal(p.production.status,'supply');assert.equal(factories(g,s).length,before);
  for(const u of g.group(s.id).slice(0,60))u.hp=0;g.recount();g.time+=8;s.gold=1000;tick(state);
  assert.equal(p.production.status,'built');assert.ok(factories(g,s).length>before);
});

test('A capital emergency buys immediate defenders and delays speculative construction',()=>{
  const state=setup(),{g,s,p}=state;s.gold=700;const before=factories(g,s).length,troops=g.group(s.id).length;
  tick(state,true);assert.equal(p.production.status,'threat');assert.equal(p.production.reserved,0);assert.equal(factories(g,s).length,before);assert.ok(g.group(s.id).length>troops);
  g.time+=8;tick(state);assert.equal(p.production.status,'built');assert.ok(factories(g,s).length>before);
});

test('Useful production is built before a pending town-hall upgrade can monopolize savings',()=>{
  const state=setup('defensive'),{g,s,p}=state;g.time=120;s.gold=700;
  tick(state);assert.equal(p.production.status,'built');assert.ok(factories(g,s).length>2);assert.equal(g.townHallDetails(s.id).level,1);
});

test('A supplied army saves for its capital instead of repeatedly buying cheaper general upgrades',()=>{
  const state=setup(),{g,s,p}=state;supply(state);g.time=100;s.gold=400;tick(state);
  assert.equal(p.production.status,'supply');assert.equal(p.economyReserve,680);assert.equal(s.gold,400);
  let turns=0;while(g.townHallDetails(s.id).level===1&&turns++<10){g.time+=8;s.gold+=40;tick(state);}
  assert.equal(g.townHallDetails(s.id).level,2);assert.equal(s.gold,180);assert.deepEqual(s.upgrades,{weapons:0,armor:0,economy:0});
  g.time+=8;tick(state);assert.equal(p.economyReserve,1130);
  s.gold=1130;g.time+=8;tick(state);assert.equal(g.townHallDetails(s.id).level,3);assert.equal(s.gold,180);
  for(const u of g.group(s.id).slice(0,60))u.hp=0;g.recount();g.time+=8;s.gold=700;tick(state,true);assert.equal(p.economyReserve,0);
});

test('Training throughput avoids redundant factories and resumes growth with a larger economy',()=>{
  const state=setup(),{g,s,p}=state;
  for(const [type,n]of [['barracks',8],['range',6],['stables',3],['workshop',2]])for(let i=0;i<n;i++)g.addBuilding(s.id,type,15+i*2,40);
  s.gold=0;tick(state);assert.equal(p.production.status,'enough');
  for(const tile of g.tiles)if(tile.x>20&&tile.x<55&&tile.y>20&&tile.y<55)tile.owner=s.id;
  s.upgrades.economy=500;g.recount();g.time+=8;tick(state);assert.equal(p.production.status,'saving');assert.ok(p.production.target>p.production.total);
});

test('Expanded wealthy realms can build duplicate facilities beyond the old fifteen-building ceiling',()=>{
  const state=setup('mass'),{g,s,p}=state;
  for(const tile of g.tiles)if(tile.terrain!=='water'&&tile.x>20&&tile.x<100&&tile.y>20&&tile.y<85)tile.owner=s.id;
  for(const u of g.units)if(g.hostile(s.id,u.team)){u.x=2;u.y=2;}
  s.upgrades.economy=500;g.recount();s.gold=30000;g.time=100;
  for(let i=0;i<22;i++){tick(state);g.time+=8;}
  const network=factories(g,s),counts={};for(const b of network)counts[b.type]=(counts[b.type]||0)+1;
  assert.ok(network.length>15,`Expected more than15 factories, found ${network.length}`);assert.ok(Object.values(counts).some(n=>n>3));assert.ok(s.gold>=0);
  for(const b of network.filter(b=>b.spawnTimer===0))assert.equal(g.tileAt(b.x,b.y).owner,s.id);
});

console.log(`${cases} adaptive production tests passed.`);
