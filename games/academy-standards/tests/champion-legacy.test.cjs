const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./engine-harness.cjs');

test('legacy gear assignment rejects a mismatched champion relic without spending stock',()=>{
  const {A}=loadGame(),student=A.game.students.find(s=>s.controller==='player');
  const stock=A.getPlayerHouse().stockpile,beforeArmor=student.armor;
  A.selectUnits([student.id]);stock.Champion_mars=1;
  A.spendLootOnSelected('Champion_mars');
  assert.equal(student.armor,beforeArmor);assert.equal(stock.Champion_mars,1);
  assert.equal(A.importSave(A.exportSave()).ok,true,'rejected assignment leaves a valid saved trial');
});

test('legacy mixed-group assignment chooses the matching recruit and preserves other slots',()=>{
  const {A,T}=loadGame();T.transferHouse('mars','player');
  const own=A.game.students.find(s=>s.origHouse==='player'),recruit=A.game.students.find(s=>s.origHouse==='mars');
  recruit.weaponLevel=3;recruit.mount=true;A.applyLoadout(recruit);
  A.selectUnits([own.id,recruit.id]);const stock=A.getPlayerHouse().stockpile,ownArmor=own.armor,recruitArmor=recruit.armor,returnedBefore=stock[recruitArmor]||0,weapon=recruit.weapon,item=recruit.item;
  stock.Champion_mars=1;A.spendLootOnSelected('Champion_mars');
  assert.equal(own.armor,ownArmor);assert.equal(recruit.armor,'Champion_mars');
  assert.equal(stock.Champion_mars,0);assert.equal(stock[recruitArmor],returnedBefore+1);
  assert.equal(recruit.weapon,weapon);assert.equal(recruit.weaponLevel,3);assert.equal(recruit.item,item);assert.equal(recruit.mount,true);
  assert.equal(A.importSave(A.exportSave()).ok,true,'matching recruit remains valid on save/import');
});

test('champion armor uses its readable relic name when dropped and recovered',()=>{
  const {A,T,context}=loadGame(),g=A.game,victim=g.students.find(s=>s.controller==='player');
  victim.armor='Champion_player';victim.mount=false;A.applyLoadout(victim);
  const choices=[0,0,0,.99];context.Math.random=()=>choices.length?choices.shift():.5;
  g.logs=[];T.knockOut(victim,{controller:'mars'});
  const dropped=g.groundLoot.find(item=>item.alive&&item.item==='Champion_player');assert(dropped,'knockout dropped the champion armor');
  assert(g.logs.some(log=>log.includes('Laurelguard Plate falls to the ground')));
  const collector=g.students.find(s=>s.controller==='player'&&s.state!=='knocked');collector.x=dropped.x;collector.y=dropped.y;
  g.houses.forEach(h=>h.ai.thinkAt=1e9);A.refreshVisibility(true);A.setPaused(false);T.update(.033);A.setPaused(true);
  assert(g.logs.some(log=>log.includes('recovers <b>Laurelguard Plate</b>')));
  assert(!g.logs.some(log=>log.includes('Champion_player')));
});

test('champion loot crate reports the readable relic name',()=>{
  const {A,T}=loadGame(),g=A.game,attacker=g.students.find(s=>s.controller==='player');
  const box={id:'box_champion_review',x:attacker.x+10,y:attacker.y,hp:1,maxHp:1,alive:true,loot:['Champion_player','Sword'],rare:true,big:false};
  g.lootBoxes.push(box);attacker.atkDmg=999;A.refreshVisibility(true);
  assert(T.beginAttack(attacker,box,'box'));T.resolveAttack(attacker,attacker.attackAction);
  assert.equal(box.alive,false);
  assert(g.logs.some(log=>log.includes('finds <b>Laurelguard Plate, Sword</b>')));
  assert(!g.logs.some(log=>log.includes('Champion_player')));
});
