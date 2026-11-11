import assert from 'node:assert/strict';
import {Game,UNIT_DEFS,TEAM_DEFS,PAC_TEAMS,DIFFICULTIES,GHOST_BOUNTIES} from '../../engine.js';

let passed=0;
const test=(name,run)=>{run();passed++;console.log('✓ '+name);};
const fresh=options=>new Game({seed:1975,...options});
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/.1);i++)g.update(.1);};
const bank=g=>Object.fromEntries(Object.keys(TEAM_DEFS).map(id=>[id,g.resources[id]]));

test('Three independent Pac settlements occupy the expanded exterior on every battlefield',()=>{
  for(const map of ['catacombs','ruins','crossroads']){
    const g=fresh({map}),m=g.map.mazeBounds;
    assert.equal(g.map.beltWidth,26);
    assert.equal(g.getHeroes().length,3);
    for(const id of PAC_TEAMS){
      const team=g.teams[id],units=g.units.filter(u=>u.teamId===id),structures=g.buildings.filter(b=>b.teamId===id);
      assert.equal(units.length,5);assert.equal(units.filter(u=>u.type==='hero').length,1);
      assert.equal(structures.length,2);assert.equal(g.resources[id],240);
      assert.equal(team.eliminated,false);
      assert.ok(team.start.x<m.x||team.start.x>=m.x+m.w||team.start.y<m.y||team.start.y>=m.y+m.h);
      for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++)assert.ok(g.tileAt(team.start.x+dx,team.start.y+dy),'each team has a broad clear homestead');
      assert.ok(g.findPath(team.start.x,team.start.y,g.map.ghostStart.x,g.map.ghostStart.y).length>20);
    }
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.hypot(g.map.pacStarts[i].x-g.map.pacStarts[j].x,g.map.pacStarts[i].y-g.map.pacStarts[j].y)>35);
  }
});

test('Choosing any team assigns its commander, bank and production without taking allied funds',()=>{
  for(const id of PAC_TEAMS){
    const g=fresh({teamId:id}),before=bank(g),base=g.buildings.find(b=>b.type==='nest'&&b.teamId===id);
    assert.equal(g.playerTeam,id);assert.equal(g.teamId,id);assert.equal(g.getHero().teamId,id);
    assert.equal(g.train('miner'),true);assert.equal(base.queue.length,1);
    for(const team of PAC_TEAMS)assert.equal(g.resources[team],before[team]-(team===id?40:0));
    advance(g,8.1);assert.equal(g.units.filter(u=>u.teamId===id&&u.type==='miner').length,3);
  }
  assert.equal(fresh({side:'ghost',teamId:'pac2'}).playerTeam,'ghost');
});

test('Allied teams cannot be ordered, built for, trained from or refunded by another owner',()=>{
  const g=fresh(),ally=g.getHero('pac2'),own=g.getHero('pac'),allyBase=g.buildings.find(b=>b.teamId==='pac2'&&b.type==='nest');
  assert.equal(g.command([own.id,ally.id],'move',own.x+4,own.y),true);
  assert.equal(ally.order,null);assert.equal(own.order.type,'move');
  assert.equal(g.train('miner',allyBase.id),false);
  assert.equal(g.train('miner',allyBase.id,'pac2'),true);
  const queued=allyBase.queue[0],before=bank(g);
  assert.equal(g.cancelTraining(allyBase.id,queued.id),false);
  assert.deepEqual(bank(g),before);
  assert.equal(g.cancelTraining(allyBase.id,queued.id,'pac2'),true);
  assert.equal(g.resources.pac2,before.pac2+40);
  assert.equal(g.canBuild('lair',own.x,own.y).ok,false);
  assert.equal(g.command(own.id,'attack',ally.x,ally.y,ally.id),false);
});

test('Mining awards the owner while vision and objective progress are shared among Pac teams',()=>{
  const g=fresh({teamId:'pac3'}),before=bank(g),hero=g.getHero(),pellet=[...g.pellets.values()].find(p=>p.type==='small');
  for(const ally of g.getHeroes()){
    const cell=Math.floor(ally.y)*g.map.width+Math.floor(ally.x);
    assert.equal(g.isVisible(g.side,ally.x,ally.y),true,'Every allied settlement is in the human team’s shared live vision');
    assert.equal(g.explored.pac[cell],1,'Remote allied settlements also share explored terrain');
  }
  hero.x=pellet.x;hero.y=pellet.y;g._updateVision();
  assert.equal(g.isVisible('pac',hero.x,hero.y),true);
  g._consume(pellet,hero);
  assert.equal(g.collected,1);assert.equal(g.resources.pac3,before.pac3+1);assert.equal(g.resources.pac,before.pac);
  g.powerByTeam.pac3.charges=0;
  const large=[...g.pellets.values()].find(p=>p.type==='large');g._consume(large,hero);
  assert.equal(g.powerByTeam.pac3.charges,1);assert.equal(g.powerByTeam.pac.charges,1);
});

test('Each Pac team has its own power reserve and forge; a surge can protect nearby allies',()=>{
  const g=fresh({teamId:'pac2'}),hero=g.getHero('pac2'),ally=g.getHero('pac3');
  ally.x=hero.x+1;ally.y=hero.y;
  assert.equal(g.activatePower(ally.id),false);
  assert.equal(g.activatePower(hero.id),true);
  assert.equal(g.powerByTeam.pac2.charges,0);assert.equal(g.powerByTeam.pac2.cooldown,40);
  assert.equal(g.powerByTeam.pac.charges,1);assert.equal(g.powerByTeam.pac3.charges,1);
  assert.equal(ally.powered,9);
  const well=g._spawnBuilding('well',hero.x-3,hero.y,true,'pac2');well.forge=49.9;
  g._updateBuildings(.2);
  assert.equal(g.powerByTeam.pac2.charges,1);assert.equal(g.powerByTeam.pac.charges,1);
  assert.ok(g.resources.pac2<240);assert.equal(g.resources.pac,240);
});

test('The Ghost Legion receives increased combat strength, economy and one-time kill bounties',()=>{
  const g=fresh({side:'ghost'});
  assert.equal(g.resources.ghost,360);assert.equal(g.units.filter(u=>u.side==='ghost').length,10);assert.equal(g.unitCap('ghost'),54);
  assert.ok(UNIT_DEFS.hunter.hp>=220&&UNIT_DEFS.hunter.damage>=25);
  assert.ok(UNIT_DEFS.binder.hp>=175&&UNIT_DEFS.binder.damage>=14);
  const hunter=g.units.find(u=>u.type==='hunter');
  for(const [type,reward]of Object.entries(GHOST_BOUNTIES)){
    const target=type==='hero'?g.getHero('pac2'):g.spawnUnit(type,g.map.pacStart.x,g.map.pacStart.y,'pac');
    const before=g.resources.ghost;g._damage(target,1e6,hunter);assert.equal(g.resources.ghost,before+reward);
    g._damage(target,1e6,hunter);assert.equal(g.resources.ghost,before+reward);
  }
  const before=g.resources.ghost;advance(g,1);assert.ok(g.resources.ghost>=before+2.94);
});

test('A caught commander eliminates only its team; ghosts win after all three are caught',()=>{
  const g=fresh({teamId:'pac2'}),hunter=g.units.find(u=>u.type==='hunter');
  for(const [i,id]of ['pac2','pac','pac3'].entries()){
    const hero=g.getHero(id);g._damage(hero,1e6,hunter);
    assert.equal(g.teams[id].eliminated,true);
    assert.equal(g.getHero(id),null);
    assert.ok(g.units.filter(u=>u.teamId===id).every(u=>u.hp===0));
    assert.ok(g.buildings.filter(b=>b.teamId===id).every(b=>b.hp===0&&b.queue.length===0));
    assert.equal(g.train('miner',null,id),false);
    assert.equal(g.status,i===2?'ghost-won':'playing');
    if(i===0)assert.equal(g.getHero(),null,'an eliminated player never inherits an allied commander');
  }
});

test('Any surviving Pac team can finish the shared objective or destroy the Citadel',()=>{
  const g=fresh({teamId:'pac'});g._damage(g.getHero('pac'),1e6,g.units.find(u=>u.type==='hunter'));
  const hero=g.getHero('pac3'),last=[...g.pellets.values()][0];g.pellets=new Map([[last.id,last]]);g.collected=g.totalPellets-1;
  g._consume(last,hero);assert.equal(g.status,'pac-won');
  const siege=fresh({teamId:'pac3'});siege._damage(siege.getGhostHQ(),1e6,siege.getHero());assert.equal(siege.status,'pac-won');
});

test('Difficulty explicitly pairs stronger partners with weaker enemies and reverses on Hard',()=>{
  assert.deepEqual([DIFFICULTIES.easy.allyDifficulty,DIFFICULTIES.easy.enemyDifficulty],['hard','easy']);
  assert.deepEqual([DIFFICULTIES.normal.allyDifficulty,DIFFICULTIES.normal.enemyDifficulty],['normal','normal']);
  assert.deepEqual([DIFFICULTIES.hard.allyDifficulty,DIFFICULTIES.hard.enemyDifficulty],['easy','hard']);
  assert.deepEqual([DIFFICULTIES.nightmare.allyDifficulty,DIFFICULTIES.nightmare.enemyDifficulty],['easy','nightmare']);
});

console.log(passed+' team and balance regression groups passed.');
