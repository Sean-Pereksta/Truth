import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Game, UNIT_DEFS, BUILDING_DEFS, DIFFICULTIES } from '../../engine.js';
import { AIController } from '../../ai.js';
import { Renderer } from '../../render.js';

const started=performance.now();
let passed=0;
function test(name,run){run();passed++;console.log(`✓ ${name}`);}
function advance(game,seconds,ai=[]){
  const steps=Math.ceil(seconds/.1);
  for(let i=0;i<steps&&game.status==='playing';i++){
    game.update(.1);
    for(const commander of ai)commander.update(.1);
  }
}
const tile=(game,p)=>Math.floor(p.y)*game.map.width+Math.floor(p.x);
const fresh=options=>new Game({seed:1975,...options});
function reachableFloor(game){
  const {width,height,tiles,pacStart}=game.map,start=tile(game,pacStart);
  const seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const id=queue[i],x=id%width,y=Math.floor(id/width);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,n=ny*width+nx;
      if(nx>=0&&ny>=0&&nx<width&&ny<height&&tiles[n]&&!seen.has(n)){seen.add(n);queue.push(n);}
    }
  }
  return seen;
}
function legalSpot(game,type,where=()=>true){
  for(let y=1;y<game.map.height-1;y++)for(let x=1;x<game.map.width-1;x++){
    if(!where(x+.5,y+.5))continue;
    const check=game.canBuild(type,x+.5,y+.5);
    if(check.ok)return{x:x+.5,y:y+.5,...check};
  }
  return null;
}
function assertHealthySimulation(game){
  assert.ok(Number.isFinite(game.time));
  for(const teamId of ['pac','pac2','pac3','ghost']){
    assert.ok(Number.isFinite(game.resources[teamId])&&game.resources[teamId]>=0,`${teamId} resources stay valid`);
    assert.ok(game.units.filter(u=>u.teamId===teamId).length<=game.unitCap(teamId),`${teamId} production obeys cap`);
  }
  for(const unit of game.units){
    assert.ok(Number.isFinite(unit.x)&&Number.isFinite(unit.y)&&Number.isFinite(unit.hp));
    assert.ok(game.tileAt(unit.x,unit.y),'units remain on floor');
    assert.ok(unit.hp>0&&unit.hp<=unit.maxHp+.001);
  }
}

function corridorFixture(){
  const game=fresh(),width=29,height=17,tiles=new Uint8Array(width*height);
  for(let y=4;y<=12;y++)for(let x=1;x<=27;x++)if(x<=7||x>=21||(y>=7&&y<=9))tiles[y*width+x]=1;
  game.map={width,height,tiles,regions:[{id:0,x:0,y:0,w:width,h:height}],pacStart:{x:4.5,y:8.5},ghostStart:{x:24.5,y:8.5},centers:[],pockets:[]};
  game.units=[];game.buildings=[];game.pellets=new Map();game.totalPellets=100;game.collected=0;
  game.visible={pac:new Uint8Array(width*height),ghost:new Uint8Array(width*height)};
  game.explored={pac:new Uint8Array(width*height),ghost:new Uint8Array(width*height)};
  game.knownPelletsGhost=new Uint8Array(width*height);game._pathCache.clear();
  return game;
}
function assertBodiesOnFloor(game){
  for(const u of game.units)for(const [dx,dy]of [[0,0],[.28,0],[-.28,0],[0,.28],[0,-.28],[.199,.199],[-.199,.199],[.199,-.199],[-.199,-.199]])assert.ok(game.tileAt(u.x+dx,u.y+dy),'the entire unit body stays inside floor');
}
function closestPair(units){let best=Infinity;for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)best=Math.min(best,Math.hypot(units[i].x-units[j].x,units[i].y-units[j].y));return best;}

test('Pac team sprite colors change real pixels while preserving armor, shadows and ghost rows',()=>{
  const originalDocument=globalThis.document;
  const atlas={width:2,height:2,pixels:new Uint8ClampedArray([220,170,40,128,80,80,80,255,220,170,40,200,5,8,12,255])};
  globalThis.document={createElement(){const canvas={};canvas.getContext=()=>({drawImage(image){canvas.pixels=new Uint8ClampedArray(image.pixels);},getImageData(){return{data:canvas.pixels};},putImageData(frame){canvas.pixels=frame.data;}});return canvas;}};
  try{
    const renderer=Object.create(Renderer.prototype);
    const jade=renderer._recolorPacAtlas(atlas,'#7de5cc').pixels,coral=renderer._recolorPacAtlas(atlas,'#ff9e87').pixels;
    assert.ok(jade[1]>jade[0]&&jade[2]>jade[0],'golden bodies become jade');
    assert.ok(coral[0]>coral[1]&&coral[2]>atlas.pixels[2],'golden bodies become coral');
    assert.equal(jade[3],128,'semi-transparent sprite edges stay semi-transparent');
    assert.deepEqual([...jade.slice(4,8)],[80,80,80,255],'neutral armor retains its shading');
    assert.deepEqual([...jade.slice(8)],[...atlas.pixels.slice(8)],'lower ghost rows are never recolored');
    renderer.game={playerTeam:'pac2',side:'pac',teams:{pac2:{color:'#7de5cc'}}};
    assert.equal(renderer._owns({teamId:'pac2',side:'pac'}),true);
    assert.equal(renderer._owns({teamId:'pac',side:'pac'}),false,'shared faction vision does not grant army ownership');
    assert.equal(renderer._teamColor({teamId:'pac2',side:'pac'}),'#7de5cc');
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});

test('All three maze types are connected, reproducible, and have legal routes',()=>{
  for(const map of ['catacombs','ruins','crossroads'])for(const seed of [17,1975,8201]){
    const game=fresh({map,seed}),copy=fresh({map,seed});
    assert.deepEqual(game.map.tiles,copy.map.tiles,'same seed reproduces terrain');
    assert.equal(reachableFloor(game).size,game.map.tiles.reduce((sum,value)=>sum+value,0));
    const route=game.findPath(game.map.pacStart.x,game.map.pacStart.y,game.map.ghostStart.x,game.map.ghostStart.y);
    assert.ok(route.length>20);
    assert.ok(route.every(p=>game.tileAt(p.x,p.y)));
    for(let i=1;i<route.length;i++)assert.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].y-route[i-1].y),1);
    assert.ok(game.totalPellets>600,'the center contains a substantial objective field');
    const m=game.map.mazeBounds;
    for(const p of game.pellets.values()){
      assert.ok(p.x>=m.x&&p.x<m.x+m.w);
      assert.ok(p.y>=m.y&&p.y<m.y+m.h);
    }
  }
});

test('Pac starts in a broad buildable exterior; ghosts live in the true central citadel',()=>{
  for(const map of ['catacombs','ruins','crossroads']){
    const game=fresh({map}),{width,height,mazeBounds:m,pacStart:p,ghostStart:g,citadel,entrances}=game.map;
    const inside=q=>q.x>=m.x&&q.x<m.x+m.w&&q.y>=m.y&&q.y<m.y+m.h;
    assert.equal(inside(p),false,'Pac-Man begins outside the maze');
    assert.ok(inside(g));
    assert.ok(Math.abs(g.x-(m.x+m.w/2))<=.5&&Math.abs(g.y-(m.y+m.h/2))<=.5,'the ghost home is at the maze center');
    assert.ok(game.map.beltWidth>=26,'the outer settlement belt is wider than the previous fourteen tiles');
    let exteriorFloor=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(game.tileAt(x,y)&&!inside({x:x+.5,y:y+.5}))exteriorFloor++;
    assert.ok(exteriorFloor>=7000,'there is room for three independent settlements outside');
    assert.equal(game.map.pacStarts.length,3);
    for(const start of game.map.pacStarts){
      assert.equal(inside(start),false,'every Pac team begins outside the maze');
      assert.ok(reachableFloor(game).has(tile(game,start)),'each settlement is connected to the maze');
    }
    assert.ok(entrances.length>=4);
    assert.equal(new Set(entrances.map(e=>e.side)).size,4,'the maze has broad connections on every side');
    const reachable=reachableFloor(game);
    for(const entry of entrances)assert.ok(reachable.has(tile(game,entry)));
    for(const pellet of game.pellets.values()){
      assert.ok(inside(pellet),'no objectives force settlement in the outer belt');
      assert.ok(Math.abs(pellet.x-citadel.x)>=citadel.w/2||Math.abs(pellet.y-citadel.y)>=citadel.h/2,'the central citadel starts clear');
    }
    game.resources.pac=5000;game.explored.pac.fill(1);
    const buildable=legalSpot(game,'refuge',(x,y)=>!inside({x,y})&&Math.hypot(x-p.x,y-p.y)>12);
    assert.ok(buildable,'an exterior base can be founded away from the starting yard');
    assert.ok(game.build('refuge',buildable.x,buildable.y));
  }
});

test('Every pellet is a small automatic camera; no watch relay is required',()=>{
  const game=fresh();
  game.units=game.units.filter(u=>u.side==='pac');
  game.buildings=game.buildings.filter(b=>b.side==='pac');
  const pellet=[...game.pellets.values()].find(p=>game.tileAt(p.x+2,p.y));
  game.pellets=new Map([[pellet.id,pellet]]);
  advance(game,.4);
  assert.ok(game.isVisible('ghost',pellet.x,pellet.y));
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(game.tileAt(pellet.x+dx,pellet.y+dy))assert.ok(game.isVisible('ghost',pellet.x+dx,pellet.y+dy));
  }
  assert.equal(game.isVisible('ghost',pellet.x+2,pellet.y),false,'one camera cannot illuminate an entire corridor');
  assert.deepEqual(game.watchedRegions,[]);
  assert.equal(game.tuneRegion(0),false,'surveillance does not require channel controls');
});

test('Consuming cameras creates darkness and preserves unverified ghost memory',()=>{
  const game=fresh();
  game.units=game.units.filter(u=>u.side==='pac');
  game.buildings=game.buildings.filter(b=>b.side==='pac');
  const pellet=[...game.pellets.values()][50];
  game.pellets=new Map([[pellet.id,pellet]]);
  advance(game,.4);
  const lastKnown=game.knownPelletsGhost[pellet.id];
  assert.ok(lastKnown>0);
  game.pellets.delete(pellet.id);
  advance(game,.4);
  assert.equal(game.isVisible('ghost',pellet.x,pellet.y),false);
  assert.equal(game.knownPelletsGhost[pellet.id],lastKnown,'the fog must not disclose an unseen cleared tile');
  game.spawnUnit('scout',pellet.x,pellet.y);
  advance(game,.4);
  assert.ok(game.isVisible('ghost',pellet.x,pellet.y));
  assert.equal(game.knownPelletsGhost[pellet.id],0,'a scout verifies the now-empty tile');
});

test('Empty deep routes stay dark until a ghost scouts them',()=>{
  const game=fresh();
  const deep=game.map.centers.find(p=>p.x<game.map.width*.12&&!game.isVisible('ghost',p.x,p.y));
  assert.ok(deep,'the map has a genuinely unlit peripheral route');
  assert.ok(!game.pellets.has(tile(game,deep)));
  const scout=game.units.find(u=>u.type==='scout');
  scout.x=deep.x;scout.y=deep.y;
  advance(game,.4);
  assert.ok(game.isVisible('ghost',deep.x,deep.y));
  assert.ok(game.explored.ghost[tile(game,deep)]);
});

test('Minions channel to mine; Pac-Man eats on contact and all progress is permanent',()=>{
  const game=fresh();
  const miner=game.units.find(u=>u.type==='miner');
  const small=[...game.pellets.values()].find(p=>p.type==='small');
  miner.x=small.x;miner.y=small.y;
  assert.ok(game.command([miner.id],'harvest',small.x,small.y));
  advance(game,.5);
  assert.ok(game.pellets.has(small.id),'a minion cannot instantly eat a pellet');
  assert.ok(miner.order.progress>0);
  advance(game,.9);
  assert.ok(!game.pellets.has(small.id),'a completed mining channel consumes it');
  game.command(miner.id,'stop');
  const hero=game.getHero(),target=[...game.pellets.values()].find(p=>p.type==='small');
  hero.x=target.x;hero.y=target.y;
  advance(game,.1);
  assert.ok(!game.pellets.has(target.id),'the hero needs no mining channel');
  const earned=game.collected;
  game.resources.pac=1000;
  assert.ok(game.train('guardian'));
  assert.equal(game.collected,earned,'spending Spark never rewinds victory progress');
  assert.ok(!game.pellets.has(small.id)&&!game.pellets.has(target.id));
});

test('Large pellets take longer to mine and strengthen present and future troops',()=>{
  const mining=fresh(),miner=mining.units.find(u=>u.type==='miner');
  const core=[...mining.pellets.values()].find(p=>p.type==='large');
  miner.x=core.x;miner.y=core.y;
  mining.command(miner.id,'harvest',core.x,core.y);
  advance(mining,2);
  assert.ok(mining.pellets.has(core.id),'a large core survives an ordinary pellet mining interval');
  advance(mining,5.2);
  assert.ok(!mining.pellets.has(core.id));
  assert.equal(mining.largeCollected,1);

  const game=fresh(),hero=game.getHero(),guard=game.units.find(u=>u.type==='guardian'),oldHp=guard.maxHp;
  const cores=[...game.pellets.values()].filter(p=>p.type==='large').slice(0,3);
  for(const p of cores){hero.x=p.x;hero.y=p.y;advance(game,.1);}
  assert.equal(game.largeCollected,3);
  assert.ok(game.powerRanks>=1);
  assert.ok(guard.maxHp>oldHp,'existing troops receive the permanent upgrade');
  const recruit=game.spawnUnit('guardian',game.map.pacStart.x,game.map.pacStart.y);
  assert.equal(recruit.maxHp,guard.maxHp,'future troops receive the same upgrade');
  assert.equal(game.powerCharges,2,'Power storage is capped');
});

test('Construction works on any sufficient explored floor, without deleting pellets',()=>{
  const game=fresh();game.resources.pac=5000;game.explored.pac.fill(1);
  const spot=legalSpot(game,'refuge',(x,y)=>!game.map.pockets.some(r=>Math.abs(r.x-x)<4&&Math.abs(r.y-y)<4)&&Math.hypot(x-game.map.pacStart.x,y-game.map.pacStart.y)>10);
  assert.ok(spot,'an ordinary cleared corridor fits a structure outside designated pockets');
  const before=game.pellets.size;
  assert.ok(game.build('refuge',spot.x,spot.y));
  const refuge=game.buildings.at(-1);
  assert.ok(refuge.progress<1);
  assert.equal(game.canBuild('refuge',spot.x,spot.y).ok,false,'occupied footprints cannot overlap');
  advance(game,BUILDING_DEFS.refuge.buildTime+1);
  assert.equal(refuge.progress,1);
  assert.equal(game.pellets.size,before);
  assert.equal(game.canBuild('tower',0,0).ok,false,'a footprint must fit entirely on floor');
  const pellet=[...game.pellets.values()][0];
  assert.equal(game.canBuild('tower',pellet.x,pellet.y).ok,false,'building cannot erase an objective');
});

test('Digestors renew Power after the original harvest; surge cooldown is enforced',()=>{
  const game=fresh();game.resources.pac=1000;game.explored.pac.fill(1);
  const spot=legalSpot(game,'well');assert.ok(spot);
  assert.ok(game.build('well',spot.x,spot.y));
  advance(game,BUILDING_DEFS.well.buildTime+1);
  game.powerCharges=0;
  const originalPellets=game.pellets.size;
  advance(game,51);
  assert.ok(game.powerCharges>=1,'renewable charges do not require another yellow pellet');
  assert.equal(game.pellets.size,originalPellets,'forging never respawns or consumes objective pellets');
  const hero=game.getHero();
  assert.ok(game.activatePower(hero.id));
  assert.ok(hero.powered>8);
  assert.ok(game.powerCooldown>0);
  assert.equal(game.activatePower(hero.id),false,'charges cannot stack through the cooldown');
});

test('Training has a real delay and enforces each team cap including queued units',()=>{
  for(const side of ['pac','ghost']){
    const game=fresh({side});game.resources[side]=100000;
    const type=side==='pac'?'miner':'hunter',start=side==='pac'?game.map.pacStart:game.map.ghostStart;
    while(game.units.filter(u=>u.teamId===side).length<game.unitCap(side)-1)game.spawnUnit(type,start.x,start.y);
    const count=game.units.filter(u=>u.teamId===side).length;
    assert.ok(game.train(type));
    assert.equal(game.units.filter(u=>u.teamId===side).length,count,'queued recruits are not instantly spawned');
    assert.equal(game.train(type),false,'queued units reserve the final army slot');
    advance(game,UNIT_DEFS[type].trainTime+1);
    assert.equal(game.units.filter(u=>u.teamId===side).length,game.unitCap(side));
    assert.equal(game.train(type),false);
  }
});

test('A Pac-Man death eliminates its team; all three deaths or the final pellet end the match',()=>{
  const caught=fresh(),hero=caught.getHero();
  caught.buildings=caught.buildings.filter(b=>b.side!=='pac');
  assert.equal(caught.status,'playing','base destruction itself is not the defeat condition');
  hero.hp=1;
  const hunter=caught.units.find(u=>u.type==='hunter');hunter.x=hero.x+.3;hunter.y=hero.y;hunter.cooldown=0;
  caught.visible.ghost[tile(caught,hero)]=1;
  advance(caught,.1);
  assert.equal(caught.status,'playing','the other two Pac teams remain in the match');
  assert.equal(caught.teams.pac.eliminated,true);
  assert.ok(caught.units.every(u=>u.teamId!=='pac'),'the eliminated team cannot leave a fighting army behind');
  assert.equal(caught.getHeroes().length,2);
  for(const survivor of [...caught.getHeroes()])caught._damage(survivor,10000,hunter);
  assert.equal(caught.status,'ghost-won','the last commander death ends the alliance');
  const stoppedAt=caught.time;advance(caught,1);assert.equal(caught.time,stoppedAt,'the completed match no longer simulates');

  const complete=fresh(),pac=complete.getHero(),last=[...complete.pellets.values()][10];
  complete.pellets=new Map([[last.id,last]]);complete.collected=complete.totalPellets-1;
  pac.x=last.x;pac.y=last.y;
  advance(complete,.1);
  assert.equal(complete.status,'pac-won');
  assert.equal(complete.collected,complete.totalPellets);
});

test('Stronger ghost troops earn each Pac-unit bounty exactly once',()=>{
  const floors={scout:{hp:130,damage:13},hunter:{hp:220,damage:25},binder:{hp:175,damage:14},brute:{hp:450,damage:42}};
  for(const [type,stats]of Object.entries(floors)){assert.ok(UNIT_DEFS[type].hp>=stats.hp);assert.ok(UNIT_DEFS[type].damage>=stats.damage);}
  const rewards={miner:50,guardian:90,engineer:65,extractor:125,hero:400};
  for(const [type,reward]of Object.entries(rewards)){
    const game=fresh(),target=type==='hero'?game.getHero():game.spawnUnit(type,game.map.pacStart.x,game.map.pacStart.y),hunter=game.units.find(u=>u.type==='hunter'),before=game.resources.ghost;
    game._damage(target,10000,hunter);
    assert.equal(game.resources.ghost,before+reward);
    assert.ok(game.events.some(e=>e.kind==='ghost'&&e.text.includes('+'+reward+' Dread')));
    assert.equal(game.effects.filter(e=>e.type==='bounty'&&e.amount===reward).length,1);
    game._damage(target,10000,hunter);
    assert.equal(game.resources.ghost,before+reward,'hitting a dead unit does not pay twice');
  }
  const structure=fresh(),miner=structure.units.find(u=>u.type==='miner'),spike=structure._spawnBuilding('spike',structure.map.ghostStart.x+3,structure.map.ghostStart.y,true),balance=structure.resources.ghost;
  structure._damage(miner,10000,spike);assert.equal(structure.resources.ghost,balance+50,'a ghost structure receives the kill reward too');
  const uncredited=fresh(),worker=uncredited.units.find(u=>u.type==='miner'),before=uncredited.resources.ghost;
  uncredited._damage(worker,10000);assert.equal(uncredited.resources.ghost,before,'uncredited deaths do not manufacture money');
});

test('Only the unique Ghost HQ grants an alternative Pac victory',()=>{
  const game=fresh(),hq=game.getGhostHQ();
  assert.ok(hq&&hq.isHQ&&hq.id===game.ghostHQId);
  assert.equal(hq.hp,20000);assert.equal(hq.maxHp,20000);
  const ordinary=game._spawnBuilding('lair',game.map.ghostStart.x+7,game.map.ghostStart.y,true);
  assert.equal(ordinary.maxHp,640);assert.ok(!ordinary.isHQ);
  game._damage(ordinary,10000,game.getHero());
  assert.equal(game.status,'playing','ordinary forward lairs are not win objectives');
  game._damage(hq,20001,game.getHero());
  assert.equal(game.status,'pac-won');assert.ok(game.collected<game.totalPellets);
  assert.match(game.winnerReason,/Citadel.*destroyed/i);
  assert.equal(game.build('lair',hq.x,hq.y),false,'the defeated headquarters cannot be rebuilt after the match ends');

  const caught=fresh();
  for(const hero of [...caught.getHeroes()])caught._damage(hero,10000,caught.units.find(u=>u.side==='ghost'));
  assert.equal(caught.status,'ghost-won','eliminating all Pac commanders wins even while the HQ survives');
  assert.equal(caught.getGhostHQ().hp,20000);
});

test('Ghost HQ regenerates after eight safe seconds, at the stated rate and cap',()=>{
  const game=fresh(),hq=game.getGhostHQ();
  game._damage(hq,1000,game.getHero());advance(game,7.8);
  assert.equal(hq.hp,19000,'damage does not immediately regenerate');
  advance(game,1.2);assert.ok(hq.hp>=19027&&hq.hp<=19037,'regeneration is approximately thirty HP per second after the delay');
  game._damage(hq,50,game.getHero());const afterHit=hq.hp;advance(game,7);
  assert.equal(hq.hp,afterHit,'another hit restarts the safe-time requirement');
  advance(game,60);assert.equal(hq.hp,hq.maxHp,'regeneration never exceeds the maximum');
});

test('Binder Snare marks locked ground, stands still, and can be dodged',()=>{
  const game=corridorFixture(),binder=game.spawnUnit('binder',22.5,8.5),runner=game.spawnUnit('miner',25.5,8.5),caught=game.spawnUnit('miner',26.5,8.5);
  game.visible.ghost.fill(1);
  assert.equal(game.castSnare([binder.id],runner.x,runner.y,'ghost'),1);
  const locked={x:binder.cast.x,y:binder.cast.y},origin={x:binder.x,y:binder.y};
  assert.equal(binder.cast.total,1.25);assert.equal(binder.cast.radius,2.1);
  assert.ok(game.effects.some(e=>e.type==='binder-windup'&&e.x===locked.x&&e.y===locked.y));
  game.command(runner.id,'move',25.5,12.5);
  advance(game,.6);
  assert.ok(binder.cast&&binder.cast.remaining>0);
  assert.equal(binder.cast.x,locked.x);assert.equal(binder.cast.y,locked.y);
  assert.equal(binder.x,origin.x);assert.equal(binder.y,origin.y);
  advance(game,.8);
  assert.equal(binder.cast,null);
  assert.equal(runner.rooted,0,'walking out of the marked circle avoids the root');
  assert.ok(caught.rooted>0,'a victim still inside is rooted');
  assert.ok(game.effects.some(e=>e.type==='snare'));
  const held={x:caught.x,y:caught.y};game.command(caught.id,'move',26.5,12.5);advance(game,.6);
  assert.equal(caught.x,held.x);assert.equal(caught.y,held.y,'root is a real movement lock');
  advance(game,1.0);
  assert.equal(caught.rooted,0);assert.ok(caught.slow>0,'the brief slow follows the root');
  assert.ok(caught.snareImmunity>0,'the target remains protected against chain roots');
});

test('Binder casts cancel on movement, stop, or death and respect cooldown',()=>{
  for(const cancel of ['move','stop','death']){
    const game=corridorFixture(),binder=game.spawnUnit('binder',22.5,8.5),victim=game.spawnUnit('miner',26.5,8.5);
    game.visible.ghost.fill(1);assert.equal(game.castSnare([binder.id],victim.x,victim.y,'ghost'),1);advance(game,.3);
    if(cancel==='death')game._damage(binder,10000,victim);else game.command(binder.id,cancel,22.5,11.5,undefined,'ghost');
    assert.equal(binder.cast,null);assert.ok(!game.effects.some(e=>e.type==='binder-windup'));
    if(cancel!=='death')assert.equal(game.castSnare([binder.id],victim.x,victim.y,'ghost'),0,'canceling does not refund the cooldown');
    advance(game,1.4);assert.equal(victim.rooted,0,'a canceled telegraph never applies its snare');
  }
});

test('A basic Binder bolt deals damage without an untelegraphed root or slow',()=>{
  const game=corridorFixture(),binder=game.spawnUnit('binder',22.5,8.5),victim=game.spawnUnit('guardian',25.5,8.5);
  binder.snareCooldown=100;binder.cooldown=0;const before=victim.hp;
  game._attack(binder,victim);
  assert.equal(victim.hp,before-UNIT_DEFS.binder.damage);
  assert.equal(victim.rooted,0);assert.equal(victim.slow,0);
  advance(game,.3);assert.equal(victim.rooted,0);assert.equal(victim.slow,0);
});

test('Overlapping snares do not refresh a root during the immunity window',()=>{
  const game=corridorFixture(),one=game.spawnUnit('binder',22.5,8.5),two=game.spawnUnit('binder',22.5,7.5),victim=game.spawnUnit('guardian',26.5,8.5);
  game.visible.ghost.fill(1);one.damage=two.damage=0;
  assert.equal(game.castSnare([one.id],victim.x,victim.y,'ghost'),1);advance(game,1.3);
  assert.ok(victim.rooted>0);const remaining=victim.rooted;
  assert.equal(game.castSnare([two.id],victim.x,victim.y,'ghost'),1);advance(game,1.3);
  assert.ok(victim.rooted<remaining-.8,'the second pulse does not restart the first root');
  advance(game,.4);assert.equal(victim.rooted,0);assert.ok(victim.snareImmunity>2.5);
});

test('Automatic Binder casts lead visible motion, lock the aim, and avoid duplicate zones',()=>{
  const game=corridorFixture(),binder=game.spawnUnit('binder',22.5,8.5),runner=game.spawnUnit('miner',24.5,8.5);
  binder.snareCooldown=.3;game.command(runner.id,'move',26.5,8.5);game.visible.ghost.fill(1);
  advance(game,.4);assert.ok(binder.cast);
  assert.ok(binder.cast.x>runner.x+.5,'auto aim leads actual visible movement instead of trailing it');
  const point={x:binder.cast.x,y:binder.cast.y};game.command(runner.id,'move',24.5,12.5);advance(game,.3);
  assert.equal(binder.cast.x,point.x);assert.equal(binder.cast.y,point.y,'the telegraph does not home after a turn');

  const group=corridorFixture();group.spawnUnit('binder',22.5,8.5);group.spawnUnit('binder',22.5,7.5);group.spawnUnit('guardian',26.5,8.5);group.visible.ghost.fill(1);advance(group,.1);
  assert.equal(group.units.filter(u=>u.cast).length,1,'automatic allied Binders stagger overlapping cast zones');
});

test('Hidden target IDs do not reveal live positions to an attack command',()=>{
  const game=fresh(),hunter=game.units.find(u=>u.type==='hunter'),hero=game.getHero();
  game.visible.ghost.fill(0);
  const lastSeen=game.nearestFloor(game.map.width/2,game.map.height/2);
  assert.ok(Math.hypot(hero.x-lastSeen.x,hero.y-lastSeen.y)>10);
  game.command(hunter.id,'attack',lastSeen.x,lastSeen.y,hero.id,'ghost');
  assert.equal(hunter.order.x,lastSeen.x);
  assert.equal(hunter.order.y,lastSeen.y);
  assert.ok(hunter.path.length>0);
  assert.deepEqual(hunter.path.at(-1),lastSeen);
});

test('Ghost AI commands do not depend on an invisible hero’s real position',()=>{
  const a=fresh({seed:433}),b=fresh({seed:433});
  a.visible.ghost.fill(0);b.visible.ghost.fill(0);
  const moved=b.nearestFloor(35.5,26.5);b.getHero().x=moved.x;b.getHero().y=moved.y;
  const one=new AIController(a,'ghost','hard'),two=new AIController(b,'ghost','hard');
  one.update(1);two.update(1);
  const orders=g=>g.units.filter(u=>u.side==='ghost').map(u=>({id:u.id,order:u.order,path:u.path}));
  assert.deepEqual(orders(a),orders(b),'different hidden hero positions must produce identical decisions');
  assert.equal(one.lastHeroSight,null);assert.equal(two.lastHeroSight,null);
});

test('Three-unit ground commands assign distinct reachable formation slots',()=>{
  for(const action of ['move','attack','patrol']){
    const game=corridorFixture();
    const group=[game.spawnUnit('miner',4.5,5.5),game.spawnUnit('miner',4.5,8.5),game.spawnUnit('miner',4.5,11.5)];
    assert.ok(game.command(group.map(u=>u.id),action,24.5,8.5));
    const slots=group.map(u=>({x:u.order.x,y:u.order.y}));
    assert.equal(new Set(slots.map(p=>p.x+':'+p.y)).size,3,'one click creates three real destinations');
    assert.ok(closestPair(slots)>=.88);
    assert.ok(group.every(u=>u.path.length&&game.tileAt(u.path.at(-1).x,u.path.at(-1).y)));
  }
});

test('Three troops file through a three-wide corridor and finish visibly separated',()=>{
  const game=corridorFixture(),group=[game.spawnUnit('miner',4.5,5.5),game.spawnUnit('miner',4.5,8.5),game.spawnUnit('miner',4.5,11.5)];
  game.command(group.map(u=>u.id),'move',24.5,8.5);
  const destinations=group.map(u=>({id:u.id,x:u.order.x,y:u.order.y})),entered=new Set();
  for(let i=0;i<250;i++){game.update(.1);assertBodiesOnFloor(game);for(const u of group)if(u.x>8&&u.x<21)entered.add(u.id);}
  assert.equal(entered.size,3,'all members traversed the narrow middle');
  assert.ok(group.every(u=>u.x>21&&u.path.length===0&&u.order===null),'all troops arrived, without a permanent traffic jam');
  assert.ok(closestPair(group)>=.82,'stopped units retain real body spacing');
  for(const p of destinations){const u=game.getUnit(p.id);assert.ok(Math.hypot(u.x-p.x,u.y-p.y)<.2,'each unit reaches its own assigned slot');}
});

test('A group harvest reserves separate pellets instead of stacking mining channels',()=>{
  const game=corridorFixture(),group=[game.spawnUnit('miner',23.5,7.5),game.spawnUnit('miner',23.5,8.5),game.spawnUnit('miner',23.5,9.5)];
  for(const x of [24,25])for(const y of [7,8,9]){const id=y*game.map.width+x;game.pellets.set(id,{id,x:x+.5,y:y+.5,type:'small'});}
  game.command(group.map(u=>u.id),'harvest',24.5,8.5);
  assert.equal(new Set(group.map(u=>u.order.pelletId)).size,3,'the explicit click honors worker reservations');
  advance(game,8);
  assert.ok(game.collected>=3,'the formation actually performs parallel mining');
  assertBodiesOnFloor(game);
});

test('Melee attackers use distinct approach positions and remain wall-safe in combat',()=>{
  const game=corridorFixture(),target=game.spawnUnit('guardian',24.5,8.5);
  target.hp=target.maxHp=1000000;target.damage=0;
  const group=[game.spawnUnit('hunter',4.5,5.5),game.spawnUnit('hunter',4.5,8.5),game.spawnUnit('hunter',4.5,11.5)];
  game.visible.ghost.fill(1);
  game.command(group.map(u=>u.id),'attack',target.x,target.y,target.id,'ghost');
  const slots=group.map(u=>({x:u.order.approachX,y:u.order.approachY}));
  assert.equal(new Set(slots.map(p=>p.x.toFixed(3)+':'+p.y.toFixed(3))).size,3);
  for(let i=0;i<300;i++){game.update(.1);assertBodiesOnFloor(game);}
  assert.ok(target.hp<target.maxHp,'attackers can reach and damage their focus target');
  assert.ok(closestPair(group)>=.72,'combat does not collapse the party into a single point');
});

test('Pac-Man can move through friendly traffic while escorts yield safely',()=>{
  const game=corridorFixture(),hero=game.spawnUnit('hero',11.5,8.5);
  for(const y of [7.5,8.5,9.5])game.spawnUnit('miner',14.5,y);
  game.command(hero.id,'move',24.5,8.5);
  for(let i=0;i<150;i++){game.update(.1);assertBodiesOnFloor(game);}
  assert.ok(hero.x>23&&hero.path.length===0,'the commander is not trapped behind idle friendly units');
});

test('Every AI level plays both factions for full simulated matches without cheats or invalid state',()=>{
  const results=[];
  for(const difficulty of Object.keys(DIFFICULTIES)){
    const basic=fresh({difficulty});
    assert.equal(basic.getHero().hp,UNIT_DEFS.hero.hp,'difficulty does not change starting combat stats');
    for(const side of ['pac','ghost']){
      const game=fresh({side:side==='pac'?'ghost':'pac',difficulty});
      const commanders=side==='pac'?['pac','pac2','pac3'].map(teamId=>new AIController(game,teamId,difficulty)):[new AIController(game,'ghost',difficulty)];
      const commander=commanders[0];
      if(side==='ghost'){
        // A stationary commander hidden in thousands of exterior tiles provides
        // no harvest clue. Check honest search coverage first, then let him
        // cross a real pellet camera so tactical pursuit can be tested fairly.
        const m=game.map.mazeBounds,isExterior=u=>u.x<m.x||u.x>=m.x+m.w||u.y<m.y||u.y>=m.y+m.h;
        const initialCoverage=game.explored.ghost.reduce((n,v,i)=>n+(v&&isExterior({x:i%game.map.width+.5,y:Math.floor(i/game.map.width)+.5})?1:0),0);
        let scoutsOutside=false;
        for(let step=0;step<1800&&game.status==='playing';step++){
          game.update(.1);commander.update(.1);
          if(game.units.some(u=>u.side==='ghost'&&isExterior(u)))scoutsOutside=true;
          if(step%250===0)assertHealthySimulation(game);
        }
        if(game.status==='playing'){
          const coverage=game.explored.ghost.reduce((n,v,i)=>n+(v&&isExterior({x:i%game.map.width+.5,y:Math.floor(i/game.map.width)+.5})?1:0),0);
          assert.ok(scoutsOutside,'ghost AI sends real scouts or hunters into the exterior');
          assert.ok(coverage>initialCoverage+20,'the outside search opens previously dark ground');
          for(const hero of [...game.getHeroes()]){
            const ghosts=game.units.filter(u=>u.side==='ghost');
            const cue=[...game.pellets.values()].sort((a,b)=>Math.min(...ghosts.map(u=>Math.hypot(a.x-u.x,a.y-u.y)))-Math.min(...ghosts.map(u=>Math.hypot(b.x-u.x,b.y-u.y))))[0];
            assert.ok(cue);hero.x=cue.x;hero.y=cue.y;game.command(hero.id,'stop',undefined,undefined,undefined,hero.teamId);
            advance(game,150,commanders);
            assert.equal(game.getHero(hero.teamId),null,`${difficulty} ghosts pursue a commander after a real camera sighting`);
          }
        }
      }else{
        for(let step=0;step<7200&&game.status==='playing';step++){
          game.update(.1);for(const ai of commanders)ai.update(.1);
          if(step%250===0)assertHealthySimulation(game);
        }
      }
      assertHealthySimulation(game);
      assert.ok(commander.decisionCount>3);
      assert.equal(game.status,side==='pac'?'pac-won':'ghost-won',`${difficulty} ${side} AI can close its objective after fair information is available`);
      if(side==='pac')assert.ok(game.collected===game.totalPellets||game.getGhostHQ()?.hp===0,'the alliance wins through a real shared objective');
      results.push(`${difficulty}/${side}: ${Math.round(game.time)}s`);
    }
  }
  console.log('  Simulated matches: '+results.join(' · '));
});

console.log(`\n${passed} regression groups passed in ${((performance.now()-started)/1000).toFixed(2)}s.`);
