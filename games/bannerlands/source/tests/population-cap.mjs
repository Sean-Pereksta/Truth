import assert from 'node:assert/strict';
import {Game,HOUSES,BUILD_DEFS} from '../../core.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const make=(options={})=>new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,...options});
const keepFor=(g,team)=>g.buildings.find(b=>b.team===team&&b.type==='keep'&&b.hp>0);
function fill(g,team,count){while(g.teams[team].count<count)g.addUnit(team,'infantry',g.teams[team].home.x+4,g.teams[team].home.y+4);}

test('All sixteen selected houses and rival houses begin with exactly 280 population capacity',()=>{
  const seen=new Set();
  for(let house=0;house<HOUSES.length;house++){
    const g=make({house});assert.equal(g.teams[0].sigil,HOUSES[house].sigil);seen.add(g.teams[0].sigil);
    for(const s of g.teams){assert.equal(s.keeps,1);assert.equal(s.cap,280,`${s.name} must start with 280 capacity.`);assert.equal(s.count,70);}
  }
  assert.equal(seen.size,16);
});

test('Owning the entire continent, completing Bannerlands and losing land never change population capacity',()=>{
  const g=make({scale:'continent',enemies:15});
  for(const owner of [0,1]){
    for(const tile of g.tiles)tile.owner=owner;g.recount();
    assert.equal(g.teams[owner].tiles,g.tiles.length);assert.ok(g.teams[owner].banners>1000);
    assert.ok(g.teams.every(s=>s.cap===280),'Even maximum territory cannot add population capacity.');
  }
  for(const tile of g.tiles)tile.owner=-1;g.recount();
  assert.ok(g.teams.every(s=>s.tiles===0&&s.banners===0&&s.cap===280),'No-land houses retain the initial 280 capacity.');
});

test('Ordinary buildings, the Treasury, military upgrades and level-three forts add no population capacity',()=>{
  const g=make({enemies:1}),s=g.teams[0];s.gold=1e12;
  for(const type of ['barracks','range','stables','tower','workshop',g.houseContent(0).building])for(let i=0;i<8;i++)g.addBuilding(0,type,30+i*.6,30+i*.4);
  g.recount();assert.equal(s.keeps,1);assert.equal(s.cap,280);assert.ok(g.buildingStatus(0).count>30);
  for(const type of ['weapons','armor','economy']){assert.equal(g.upgrade(type).ok,true);g.recount();assert.equal(s.cap,280);s.upgrades[type]=500;}
  assert.equal(g.upgradeTownHall().ok,true);assert.equal(g.upgradeTownHall().ok,true);assert.equal(g.townHallDetails().level,3);
  const tower=g.buildings.find(b=>b.team===0&&b.type==='tower');assert.equal(g.upgradeTower(tower.id).ok,true);assert.equal(g.upgradeTower(tower.id).ok,true);
  g.recount();assert.equal(s.cap,280,'Neither fort levels nor any maximum-level upgrade can enlarge the army cap.');
});

test('A second and third living castle raise capacity to exactly 340 and 400',()=>{
  const g=make(),ruins=g.castles.filter(c=>c.ruined);assert.equal(g.teams[0].cap,280);
  assert.equal(g.captureCastle(ruins[0],0),true);assert.equal(g.teams[0].keeps,2);assert.equal(g.teams[0].cap,340);
  assert.equal(g.captureCastle(ruins[1],0),true);assert.equal(g.teams[0].keeps,3);assert.equal(g.teams[0].cap,400);
  assert.equal(g.captureCastle(ruins[1],0),false);g.recount();assert.equal(g.teams[0].cap,400,'An already-held castle cannot award capacity twice.');
  for(const tile of g.tiles)tile.owner=0;g.recount();assert.equal(g.teams[0].cap,400,'Land surrounding restored castles does not add a second capacity bonus.');
});

test('Losing each additional castle immediately removes 60 capacity while preserving excess surviving troops',()=>{
  const g=make(),ruins=g.castles.filter(c=>c.ruined);g.captureCastle(ruins[0],0);g.captureCastle(ruins[1],0);fill(g,0,400);
  const survivors=g.group(0).map(u=>u.id);g.damage(g.byId.get(ruins[1].buildingId),1e6,{team:1});
  assert.equal(g.teams[0].cap,340);assert.equal(g.teams[0].count,400);assert.deepEqual(g.group(0).map(u=>u.id),survivors);
  g.damage(g.byId.get(ruins[0].buildingId),1e6,{team:1});assert.equal(g.teams[0].cap,280);assert.equal(g.teams[0].count,400);assert.equal(g.teams[0].alive,true);
  g.teams[0].gold=10000;assert.equal(g.recruit('infantry').ok,false);const home=keepFor(g,0);home.spawnTimer=BUILD_DEFS.keep.interval;g.updateBuildings(.01);
  assert.equal(g.teams[0].count,400,'Training must wait until an over-cap surviving army has enough room.');
});

test('Player and rival armies receive the same castle-only capacity changes regardless of land ownership',()=>{
  const g=make(),ruins=g.castles.filter(c=>c.ruined);g.captureCastle(ruins[0],0);g.captureCastle(ruins[1],1);
  assert.equal(g.teams[0].cap,340);assert.equal(g.teams[1].cap,340);
  for(const tile of g.tiles)tile.owner=0;g.recount();assert.equal(g.teams[0].cap,340);assert.equal(g.teams[1].cap,340);
  g.damage(g.byId.get(ruins[1].buildingId),1e6,{team:0});assert.equal(g.teams[1].cap,280);assert.equal(g.teams[0].cap,340);
  g.damage(g.byId.get(ruins[0].buildingId),1e6,{team:1});assert.equal(g.teams[0].cap,280);assert.equal(g.teams[1].cap,280);
});

test('A living king without any castle keeps the initial 280 capacity and receives no phantom castle bonus',()=>{
  const g=make({mode:'defend-king'});
  for(const s of g.teams){const king=g.kingFor(s.id);assert.ok(king?.hp>0);g.damage(keepFor(g,s.id),1e6,{team:(s.id+1)%g.teams.length});assert.equal(s.alive,true);}
  g.recount();for(const s of g.teams){assert.equal(s.keeps,0);assert.equal(s.cap,280);assert.ok(g.kingFor(s.id)?.hp>0);}
  for(const tile of g.tiles)tile.owner=0;g.recount();assert.ok(g.teams.every(s=>s.cap===280));
});

test('Paid recruitment and automatic training obey the fixed cap for players, rivals and larger Free Folk companies',()=>{
  for(const house of [0,HOUSES.findIndex(h=>h.sigil==='bone')]){
    const g=make({house,enemies:1});
    for(const s of g.teams){
      s.gold=100000;const details=g.recruitDetails('infantry',s.id);fill(g,s.id,280-details.batch);
      assert.equal(g.recruit('infantry',s.id).ok,true);assert.equal(s.count,280);assert.equal(s.cap,280);
      const gold=s.gold;assert.equal(g.recruit('infantry',s.id).ok,false);assert.equal(s.gold,gold);
    }
    for(const b of g.buildings)if(BUILD_DEFS[b.type].unit)b.spawnTimer=BUILD_DEFS[b.type].interval;
    g.updateBuildings(.01);assert.ok(g.teams.every(s=>s.count===280));
    const victim=g.group(0).find(u=>u.type==='infantry');g.damage(victim,1e6,{team:1});assert.equal(g.teams[0].count,279);
    g.updateBuildings(.01);assert.equal(g.teams[0].count,280,'A training batch must truncate to the single remaining place.');
    assert.equal(g.teams[1].count,280);assert.ok(g.teams.every(s=>s.cap===280));
  }
});

console.log(`${checks} castle-only population capacity checks passed.`);
