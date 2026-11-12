import assert from 'node:assert/strict';
import {Game,BUILDING_DEFS,PAC_TEAMS} from '../../engine.js';

let passed=0;
const test=(name,run)=>{run();passed++;console.log('✓ '+name);};
function fixture(){
  const game=new Game({seed:1975}),width=31,height=31,tiles=new Uint8Array(width*height);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)tiles[y*width+x]=1;
  game.map={...game.map,width,height,tiles,regions:[],pockets:[],centers:[]};
  game.units=[];game.buildings=[];game.pellets.clear();game.totalPellets=100;game.time=10;
  game.visible={pac:new Uint8Array(tiles.length),ghost:new Uint8Array(tiles.length)};
  game.explored={pac:new Uint8Array(tiles.length).fill(1),ghost:new Uint8Array(tiles.length).fill(1)};
  game.knownPelletsGhost=new Uint8Array(tiles.length);game._pathCache.clear();
  return game;
}
function wounded(game,type,x,y,teamId='pac'){
  const unit=game.spawnUnit(type,x,y,teamId);unit.x=x;unit.y=y;unit.hp=unit.maxHp/2;return unit;
}

test('Sanctuary construction uses the real build cost, footprint and faction rules',()=>{
  const game=fixture(),before=game.resources.pac;
  assert.equal(game.build('sanctuary',12.5,12.5),true);
  const sanctuary=game.buildings.at(-1);
  assert.equal(game.resources.pac,before-BUILDING_DEFS.sanctuary.cost);
  assert.equal(sanctuary.progress,0);assert.equal(sanctuary.w,3);assert.equal(sanctuary.h,3);
  assert.equal(game.canBuild('sanctuary',12.5,12.5).ok,false,'structures cannot overlap');
  assert.equal(game.canBuild('sanctuary',22.5,22.5,'ghost').ok,false,'ghosts cannot construct Pac healing');
  assert.equal(game.train('miner',sanctuary.id),false,'healing structures cannot train troops');
});

test('A completed Sanctuary heals Pac-Man and troops from every allied Pac team',()=>{
  const game=fixture(),sanctuary=game._spawnBuilding('sanctuary',12.5,12.5,true,'pac');
  const patients=PAC_TEAMS.flatMap((teamId,index)=>[
    wounded(game,'hero',11.5+index,11.5,teamId),
    wounded(game,'guardian',11.5+index,13.5,teamId)
  ]);
  const ghost=wounded(game,'hunter',12.5,14.5,'ghost'),ghostHP=ghost.hp;
  const before=patients.map(u=>u.hp);
  game._updateHealing(.5);
  patients.forEach((u,i)=>assert.equal(u.hp,before[i]+5));
  assert.equal(ghost.hp,ghostHP,'opposing ghosts receive no healing');
  assert.equal(sanctuary.healingCount,patients.length);
  assert.ok(patients.every(u=>u.healedUntil>game.time));
  assert.equal(game.effects.filter(e=>e.type==='heal').length,patients.length);
});

test('Healing waits for completion and safe time, obeys range and walls, and never revives',()=>{
  const game=fixture(),sanctuary=game._spawnBuilding('sanctuary',12.5,12.5,false,'pac');
  const patient=wounded(game,'hero',16.5,12.5),original=patient.hp;
  game._updateHealing(.5);assert.equal(patient.hp,original,'construction has no healing aura');
  sanctuary.progress=1;patient._lastHit=game.time-3.9;
  game._updateHealing(.5);assert.equal(patient.hp,original,'recent damage interrupts recovery');
  patient._lastHit=game.time-4;
  game.map.tiles[12*game.map.width+14]=0;
  game._updateHealing(.5);assert.equal(patient.hp,original,'a wall blocks the aura');
  game.map.tiles[12*game.map.width+14]=1;
  patient.x=sanctuary.x+6.01;game._updateHealing(.5);assert.equal(patient.hp,original,'outside the six-tile radius');
  patient.x=sanctuary.x+6;game._updateHealing(.5);assert.equal(patient.hp,original+5,'the marked radius boundary heals');
  patient.hp=0;game._updateHealing(.5);assert.equal(patient.hp,0,'fallen commanders stay eliminated');
  patient.hp=original;sanctuary.hp=0;
  game._updateHealing(.5);assert.equal(patient.hp,original,'destroyed structures have no aura');
});

test('Overlapping Sanctuaries do not stack, and healing stops exactly at maximum HP',()=>{
  const game=fixture();
  game._spawnBuilding('sanctuary',12.5,12.5,true,'pac');
  game._spawnBuilding('sanctuary',16.5,12.5,true,'pac2');
  const patient=wounded(game,'miner',14.5,12.5),original=patient.hp;
  game._updateHealing(1);assert.equal(patient.hp,original+10,'two auras still heal only ten HP/sec');
  patient.hp=patient.maxHp-1;game._updateHealing(1);assert.equal(patient.hp,patient.maxHp);
  game._updateHealing(1);assert.equal(patient.hp,patient.maxHp);
  assert.ok(game.buildings.every(b=>b.healingCount===0),'full-health troops leave the aura idle');
});

test('Structure roles separate Pac healing from recruitment, vision, defense and economy',()=>{
  const game=fixture(),hero=wounded(game,'hero',12.5,12.5),before=hero.hp;
  game._spawnBuilding('nest',12.5,12.5,true,'pac');
  game._spawnBuilding('refuge',12.5,12.5,true,'pac');
  game._updateHealing(1);assert.equal(hero.hp,before,'Pac recruitment structures leave healing to the Sanctuary');
  assert.equal(BUILDING_DEFS.refuge.sight,9);
  assert.ok(BUILDING_DEFS.refuge.sight>BUILDING_DEFS.nest.sight);
  assert.equal(new Set(['nest','refuge','tower','well','sanctuary'].map(type=>BUILDING_DEFS[type].role)).size,5);
  assert.ok(Object.values(BUILDING_DEFS).every(d=>d.role&&d.description));
  const ghost=wounded(game,'hunter',22.5,22.5,'ghost'),ghostHP=ghost.hp;
  game._spawnBuilding('lair',22.5,22.5,true,'ghost');
  game._updateHealing(1);assert.equal(ghost.hp,ghostHP+4,'Ghost Lair recovery remains available');
});

test('The live simulation applies the Sanctuary aura after construction completes',()=>{
  const game=fixture(),sanctuary=game._spawnBuilding('sanctuary',12.5,12.5,false,'pac');
  const hero=wounded(game,'hero',12.5,13.5),before=hero.hp;
  for(let i=0;i<10;i++)game.update(.1);
  assert.equal(hero.hp,before);
  for(let i=0;i<125;i++)game.update(.1);
  assert.equal(sanctuary.progress,1);assert.ok(hero.hp>before,'the normal game update heals Pac-Man');
});

function reachableFloor(game){
  const {width,height,tiles,pacStart}=game.map,start=Math.floor(pacStart.y)*width+Math.floor(pacStart.x);
  const seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const k=queue[i],x=k%width,y=Math.floor(k/width);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,id=ny*width+nx;
      if(nx>0&&ny>0&&nx<width-1&&ny<height-1&&tiles[id]&&!seen.has(id)){seen.add(id);queue.push(id);}
    }
  }
  return seen;
}

test('Every battlefield has reproducible exterior cover on all four sides with two reachable exits',()=>{
  for(const map of ['catacombs','ruins','crossroads'])for(const seed of [1,17,1975,8201]){
    const game=new Game({map,seed}),copy=new Game({map,seed}),{hidingPlaces,mazeBounds:m}=game.map;
    assert.deepEqual(hidingPlaces,copy.map.hidingPlaces);
    assert.ok(hidingPlaces.length>=16,'substantial cover beyond the old scattered stones');
    assert.equal(new Set(hidingPlaces.map(p=>p.side)).size,4);
    const reachable=reachableFloor(game);
    assert.equal(reachable.size,game.map.tiles.reduce((n,v)=>n+v,0),'ruins leave the entire battlefield connected');
    for(const p of hidingPlaces){
      assert.ok(p.x<m.x||p.x>=m.x+m.w||p.y<m.y||p.y>=m.y+m.h,'cover is outside the main maze');
      assert.ok(reachable.has(Math.floor(p.y)*game.map.width+Math.floor(p.x)));
      assert.equal(p.exits.length,2);
      for(const exit of p.exits){
        assert.ok(game.findPath(p.x,p.y,exit.x,exit.y).length>0);
        assert.ok(game.hasLineOfSight(p.x,p.y,exit.x,exit.y),'the three-tile exit stays open');
      }
      const vertical=p.side==='west'||p.side==='east';
      assert.equal(game.hasLineOfSight(p.x,p.y,p.x+(vertical?5:0),p.y+(vertical?0:5)),false,'solid ruin walls hide the interior');
    }
    for(const start of game.map.pacStarts)for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++)assert.ok(game.tileAt(start.x+dx,start.y+dy),'starting homesteads remain clear');
    for(const gate of game.map.entrances)assert.ok(reachable.has(Math.floor(gate.y)*game.map.width+Math.floor(gate.x)),'every broad gate remains connected');
  }
});

console.log(`\n${passed} Sanctuary and exterior-cover regression groups passed.`);
