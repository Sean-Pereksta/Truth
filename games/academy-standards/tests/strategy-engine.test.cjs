const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./engine-harness.cjs');

test('engine runs coordinated strategy with equipment and fog loaded',()=>{
  const {A,T,S}=loadGame(),g=A.game;
  A.setDifficulty('veteran');A.setPaused(false);T.update(.1);
  const mars=A.getHouse('mars'),plan=S.getState(mars).plan;
  assert(plan,'the engine called the strategic commander');
  assert.equal(plan.stage,'rally');
  assert(g.students.filter(s=>s.controller==='mars').some(s=>s.order.type==='defend'));
  assert(g.students.filter(s=>s.controller==='mars').some(s=>s.order.type==='move'));
  for(let i=0;i<300;i++)T.update(.1);
  let moved=0;
  for(const s of g.students){
    assert(Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.hp),`${s.id} remains valid`);
    assert(s.hp>=0&&s.hp<=s.maxHp,`${s.id} health bounded`);
    assert(T.terrainClear(s.x,s.y,s.radius),`${s.id} remains on traversable terrain`);
    if(s.controller!=='player'&&Math.hypot(s.x-A.getHouse(s.controller).castle.x,s.y-A.getHouse(s.controller).castle.y)>400)moved++;
  }
  assert(moved>15,'enemy squads advance rather than endlessly reselecting objectives');
  assert.equal(A.importSave(A.exportSave()).ok,true,'strategy and equipment still round-trip through saved trials');
});

test('Veteran has no enemy damage bonus over Tactician',()=>{
  const {A,T}=loadGame(),att=A.game.students.find(s=>s.controller==='mars'),victim=A.game.students.find(s=>s.controller==='player');
  A.setDifficulty('normal');const normal=T.combatMatchup(att,victim).multiplier;
  A.setDifficulty('veteran');assert.equal(T.combatMatchup(att,victim).multiplier,normal);
  A.setDifficulty('relaxed');assert(T.combatMatchup(att,victim).multiplier<normal);
});
