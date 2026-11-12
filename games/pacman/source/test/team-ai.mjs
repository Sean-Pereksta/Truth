import assert from 'node:assert/strict';
import {Game} from '../../engine.js';
import {AIController} from '../../ai.js';

let groups=0;
const test=(name,run)=>{run();groups++;console.log('✓ '+name);};
const fresh=()=>new Game({side:'pac',teamId:'pac',map:'ruins',seed:1975});
const owned=(game,teamId)=>game.units.filter(u=>u.teamId===teamId);

test('An allied AI orders, spends and queues only for its own team',()=>{
  const game=fresh(),ai=new AIController(game,'pac2','normal');
  const foreign=game.units.filter(u=>u.teamId!=='pac2').map(u=>[u.id,JSON.stringify(u.order)]);
  const balances={...game.resources};
  ai.update(2.1);
  assert.equal(ai.side,'pac');
  assert.ok(owned(game,'pac2').some(u=>u.order));
  for(const [id,order]of foreign)assert.equal(JSON.stringify(game.getUnit(id).order),order);
  assert.ok(game.resources.pac2<balances.pac2);
  for(const id of ['pac','pac3','ghost'])assert.equal(game.resources[id],balances[id]);
  assert.equal(game.buildings.filter(b=>b.teamId!=='pac2').reduce((n,b)=>n+b.queue.length,0),0);
  assert.equal(game.buildings.filter(b=>b.teamId==='pac2').reduce((n,b)=>n+b.queue.length,0),1);
  const partner=owned(game,'pac')[0],before=JSON.stringify(partner.order);
  ai.issue(partner,'move',partner.x+2,partner.y);
  assert.equal(JSON.stringify(partner.order),before,'AI cannot borrow a partner unit');
});

test('Three independent Pac computers take separate harvest approaches',()=>{
  const game=fresh(),targets=[];
  for(const id of ['pac','pac2','pac3']){
    const ai=new AIController(game,id,'normal');ai.update(.2);
    const hero=game.getHero(id);
    assert.equal(hero.order?.type,'harvest');
    targets.push(hero.order.pelletId??[hero.order.x,hero.order.y].join(':'));
    assert.ok(ai.heroGoal&&game.pellets.has(ai.heroGoal.id));
  }
  assert.equal(new Set(targets).size,3);
});

test('Allied AI uses its own Power reserve',()=>{
  const game=fresh(),hero=game.getHero('pac2'),enemy=game.units.find(u=>u.type==='hunter');
  const point=game.nearestFloor(hero.x+2,hero.y);enemy.x=point.x;enemy.y=point.y;
  hero.hp=hero.maxHp*.4;game._updateVision();
  const partnerBefore=game.getPower('pac').charges,ownBefore=game.getPower('pac2').charges;
  const ai=new AIController(game,'pac2','hard');ai.update(.2);
  assert.equal(game.getPower('pac').charges,partnerBefore);
  assert.equal(game.getPower('pac2').charges,ownBefore-1);
  assert.ok(hero.powered>0);
});

test('Eliminated teams stop making AI decisions',()=>{
  const game=fresh(),ai=new AIController(game,'pac3','nightmare');
  game.teams.pac3.eliminated=true;
  const balance=game.resources.pac3;
  ai.update(50);
  assert.equal(ai.decisionCount,0);
  assert.equal(ai.elapsed,0);
  assert.equal(game.resources.pac3,balance);
});

test('Ghost AI remembers all observed Pac teams and no unseen commander',()=>{
  const game=fresh(),heroes=game.getHeroes(),pellets=[...game.pellets.values()];
  for(let i=0;i<2;i++){const p=pellets[Math.floor(pellets.length*(i+.3)/2.5)];heroes[i].x=p.x;heroes[i].y=p.y;}
  game._updateVision();
  assert.ok(game.isVisible('ghost',heroes[0].x,heroes[0].y));
  assert.ok(game.isVisible('ghost',heroes[1].x,heroes[1].y));
  assert.equal(game.isVisible('ghost',heroes[2].x,heroes[2].y),false);
  const ai=new AIController(game,'ghost','hard');ai.update(.2);
  assert.ok(ai.memories.has(heroes[0].id));
  assert.ok(ai.memories.has(heroes[1].id));
  assert.equal(ai.memories.has(heroes[2].id),false);
  assert.ok(owned(game,'ghost').some(u=>u.order));
});

test('Wounded commanders and troops retreat to allied Sanctuaries rather than recruitment buildings',()=>{
  const game=fresh(),ai=new AIController(game,'pac2','normal'),hero=game.getHero('pac2');
  const sanctuary=game._spawnBuilding('sanctuary',hero.x+5,hero.y,true,'pac');
  const allies=owned(game,'pac2'),buildings=game.buildings.filter(b=>b.teamId==='pac2');
  const miner=allies.find(u=>u.type==='miner'),guardian=allies.find(u=>u.type==='guardian');
  for(const u of [hero,miner,guardian])u.hp=u.maxHp*.4;
  ai.pacTurn(allies,buildings,[]);
  for(const u of [hero,miner,guardian]){
    assert.equal(u.order?.type,'move');assert.equal(u.order.x,sanctuary.x);assert.equal(u.order.y,sanctuary.y);
  }
  miner.hp=miner.maxHp*.7;ai.pacTurn(allies,buildings,[]);
  assert.equal(miner.order?.type,'move','Recovery continues beyond the initial low-health threshold');
  miner.hp=miner.maxHp*.9;ai.pacTurn(allies,buildings,[]);
  assert.equal(ai.recovering.has(miner.id),false);
  sanctuary.progress=.5;
  assert.equal(ai.healerFor(hero),undefined,'Unfinished healing structures cannot attract wounded troops');
});

test('Pac AI prioritizes building a Sanctuary when its own army is wounded',()=>{
  const game=fresh(),ai=new AIController(game,'pac2','normal'),allies=owned(game,'pac2');
  game.getHero('pac2').hp=100;game.resources.pac2=500;
  ai.expand(allies,game.buildings.filter(b=>b.teamId==='pac2'),[]);
  assert.equal(ai.lastBuildType,'sanctuary');
  assert.ok(game.buildings.some(b=>b.teamId==='pac2'&&b.type==='sanctuary'&&b.progress<1));
  assert.equal(game.resources.pac,240,'The allied AI pays from its own bank');
});

test('AI levels change reaction cadence and useful army goals',()=>{
  const slow=new AIController(fresh(),'ghost','easy'),fast=new AIController(fresh(),'ghost','hard');
  for(let i=0;i<30;i++){slow.update(.1);fast.update(.1);}
  assert.ok(fast.decisionCount>slow.decisionCount);
  assert.ok(fast.settings.ghostCap>slow.settings.ghostCap);
  assert.ok(fast.settings.scouts>slow.settings.scouts);
});

console.log(groups+' team AI regression groups passed.');
