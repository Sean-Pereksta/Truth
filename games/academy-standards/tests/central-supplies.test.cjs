const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./engine-harness.cjs');

function reachableCells(A,T){
  const start=A.game.students.find(s=>s.controller==='player');
  const queue=[[Math.floor(start.x/A.TILE),Math.floor(start.y/A.TILE)]],seen=new Set(queue.map(([x,y])=>`${x},${y}`));
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(seen.has(key)||!A.game.walkable[ny]?.[nx]||!T.terrainClear(nx*A.TILE+A.TILE/2,ny*A.TILE+A.TILE/2,16))continue;
      seen.add(key);queue.push([nx,ny]);
    }
  }
  return seen;
}

test('new trials open with twenty-four reachable central crates and no castle deliveries',()=>{
  for(const seed of [1,7,12345,987654321]){
    const {A,T}=loadGame(seed),g=A.game,rules=A.SUPPLY_RULES,reachable=reachableCells(A,T);
    assert.equal(g.lootBoxes.length,24,`seed ${seed}: opening supply count`);
    assert.equal(g.earlyBaseLootRemaining,0);
    for(let i=0;i<g.lootBoxes.length;i++){
      const box=g.lootBoxes[i];
      assert(A.isCentralSupplyPoint(box.x,box.y),`seed ${seed}: opening crate is central`);
      assert(T.terrainClear(box.x,box.y,28),'crate footprint is clear of water, ridges and barricades');
      assert(reachable.has(`${Math.floor(box.x/A.TILE)},${Math.floor(box.y/A.TILE)}`),'opening crate can be reached from the player starting area');
      for(const house of g.houses)assert(A.dist(box.x,box.y,house.castle.x,house.castle.y)>=rules.castleClearance);
      for(const other of g.lootBoxes.slice(i+1))assert(A.dist(box.x,box.y,other.x,other.y)>=rules.boxSpacing,'opening crates remain separated');
      for(const forge of g.blacksmiths)assert(!(box.x>forge.x-forge.w/2-28&&box.x<forge.x+forge.w/2+28&&box.y>forge.y-forge.h/2-28&&box.y<forge.y+forge.h/2+28),'crate does not overlap a forge');
    }
  }
});

test('seeded recurring supplies overwhelmingly favor the center and home crates are ordinary',()=>{
  let central=0,home=0;
  for(const seed of [51,814,1024,65537]){
    const {A,T}=loadGame(seed),g=A.game;
    g.nextBigMidLootAt=1e9;
    for(let i=0;i<250;i++){
      g.lootBoxes=[];g.time=g.nextLootSpawnAt;T.updateSupplySpawns();
      assert.equal(g.lootBoxes.length,1,'an uncrowded supply opportunity produces a crate');
      const box=g.lootBoxes[0];
      if(A.isCentralSupplyPoint(box.x,box.y))central++;
      else{
        home++;assert.equal(box.rare,false);assert.equal(box.big,false);
        assert(!box.loot.some(A.isChampionArmor),'home delivery cannot generate a relic');
        assert(g.houses.some(h=>A.dist(box.x,box.y,h.castle.x,h.castle.y)>=155&&A.dist(box.x,box.y,h.castle.x,h.castle.y)<=280),'noncentral supplies are rare home deliveries');
      }
      assert(T.terrainClear(box.x,box.y,28));
      assert(g.nextLootSpawnAt>=g.time+7&&g.nextLootSpawnAt<=g.time+11);
    }
  }
  assert(central>=950,`${central}/1000 recurring regular crates were central`);
  assert(home>=10&&home<=50,`${home}/1000 home deliveries remain rare but possible`);
});

test('depleted central supplies replenish, and great crates always remain central',()=>{
  const {A,T}=loadGame(773),g=A.game;
  for(const box of g.lootBoxes)box.alive=false;
  const oldIds=new Set(g.lootBoxes.map(b=>b.id));
  g.time=g.nextLootSpawnAt;g.nextBigMidLootAt=1e9;
  T.updateSupplySpawns();
  const regular=g.lootBoxes.filter(b=>b.alive&&!oldIds.has(b.id));
  assert.equal(regular.length,1);assert(A.isCentralSupplyPoint(regular[0].x,regular[0].y));
  g.nextBigMidLootAt=26;
  for(let i=0;i<60;i++){
    g.lootBoxes=[];g.time=g.nextBigMidLootAt;g.nextLootSpawnAt=g.time+100;
    T.updateSupplySpawns();
    assert.equal(g.lootBoxes.length,1);
    const box=g.lootBoxes[0];assert(box.big&&box.rare);assert(A.isCentralSupplyPoint(box.x,box.y));
    assert(g.nextBigMidLootAt>=g.time+20&&g.nextBigMidLootAt<=g.time+30);
  }
});

test('an unavailable home-delivery site falls back to the central field',()=>{
  const {A,T,context}=loadGame(91),g=A.game;
  g.lootBoxes=[];g.nextBigMidLootAt=1e9;g.time=g.nextLootSpawnAt;
  g.houses=g.houses.map(h=>({...h,castle:{x:-1000,y:-1000}}));
  let draws=0;context.Math.random=()=>draws++===0?0:.5;
  T.updateSupplySpawns();
  assert.equal(g.lootBoxes.length,1);assert(A.isCentralSupplyPoint(g.lootBoxes[0].x,g.lootBoxes[0].y));
});

test('older saves keep existing home crates and dropped gear without replaying opening home supplies',()=>{
  const {A,T,context}=loadGame(44),save=A.exportSave(),home=A.getPlayerHouse().castle;
  save.game.earlyBaseLootRemaining=20;
  const oldBox=save.game.lootBoxes[0];Object.assign(oldBox,{x:home.x+170,y:home.y+180});
  save.game.lootBoxes=[oldBox];
  save.game.groundLoot=[{id:'ground_legacy',x:home.x+180,y:home.y+180,item:'Sword',alive:true}];
  assert.equal(A.importSave(save).ok,true);
  const g=A.game,oldPosition={x:oldBox.x,y:oldBox.y};
  context.Math.random=()=>.5;g.time=g.nextLootSpawnAt;g.nextBigMidLootAt=1e9;T.updateSupplySpawns();
  assert.deepEqual({x:g.lootBoxes[0].x,y:g.lootBoxes[0].y},oldPosition,'existing saved supplies are not relocated');
  assert.equal(g.groundLoot[0].x,home.x+180);assert.equal(g.groundLoot[0].y,home.y+180);
  assert.equal(g.earlyBaseLootRemaining,0,'legacy delivery queue is ignored');
  assert.equal(g.lootBoxes.length,2);assert(A.isCentralSupplyPoint(g.lootBoxes[1].x,g.lootBoxes[1].y));
  assert.equal(A.importSave(A.exportSave()).ok,true,'current supply state still round-trips');
});

test('the frame update uses the central supply schedule',()=>{
  const {A,T,context}=loadGame(666),g=A.game;
  g.lootBoxes=[];g.time=4.99;g.nextLootSpawnAt=5;g.nextBigMidLootAt=1000;
  for(const house of g.houses)house.ai.thinkAt=1e9;
  context.Math.random=()=>.5;A.setPaused(false);T.update(.02);A.setPaused(true);
  assert.equal(g.lootBoxes.length,1);assert(A.isCentralSupplyPoint(g.lootBoxes[0].x,g.lootBoxes[0].y));
});
