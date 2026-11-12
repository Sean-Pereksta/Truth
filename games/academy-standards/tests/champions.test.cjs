const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadGame}=require('./engine-harness.cjs');
const {plan}=require('../equipment.js');
const {relics}=require('../champions.js');
test('every original house has a distinct compatible relic and champion sheet',()=>{
 assert.equal(relics.length,10);assert.equal(new Set(relics.map(r=>r.name)).size,10);
 const hashes=new Set();for(const relic of relics){const bytes=fs.readFileSync(path.join(__dirname,'..',relic.image));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);assert(Math.abs(w/h-3)<.1,'champion sheets have consistent 8×2 frame proportions');hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));}assert.equal(hashes.size,10,'each house has its own generated sheet');
});
test('matching champion relic improves stats, returns old armor and remains protected by role presets',()=>{
 const {A}=loadGame(),s=A.game.students[0],stock=A.getPlayerHouse().stockpile;A.selectUnits([s.id]);const before={hp:s.maxHp,def:s.defense,damage:s.atkDmg},key='Champion_'+s.origHouse,old=s.armor,spares=stock[old];stock[key]=1;
 const preview=A.planEquipment({scope:'selected',mode:'auto'});assert(preview.changes.some(c=>c.after===key));A.applyEquipment({scope:'selected',mode:'auto'});assert.equal(s.armor,key);assert(s.maxHp>before.hp);assert(s.defense>before.def);assert(s.atkDmg>before.damage);assert.equal(stock[key],0);assert.equal(stock[old],spares+1);
 stock.Light=5;A.equipPreset('ranged');assert.equal(s.armor,key,'a role preset must not silently discard ultra rare armor');assert.equal(A.importSave(A.exportSave()).ok,true);
});
test('relics are house bound, including recruited students',()=>{
 const {A,T}=loadGame(),g=A.game,aug=g.students[0],stock=A.getPlayerHouse().stockpile;stock.Champion_mars=2;assert.equal(A.equipItemOn(aug,'Champion_mars',true),false);assert.equal(aug.armor,'Heavy');
 T.transferHouse('mars','player');const recruited=g.students.find(s=>s.origHouse==='mars');A.selectUnits([recruited.id]);A.applyEquipment({scope:'selected',gear:'Champion_mars'});assert.equal(recruited.armor,'Champion_mars');assert.equal(stock.Champion_mars,1);
 const wrong=plan([aug],stock,{gear:'Champion_mars'});assert.equal(wrong.changed,0);assert(wrong.missing[0].incompatible);
});
test('every enemy house equips its own rare relic and old saves without relic counts still load',()=>{
 const {A,T}=loadGame();for(const house of A.game.houses.filter(h=>h.id!=='player')){house.stockpile['Champion_'+house.id]=1;T.autoEquipAI(house);assert(A.game.students.some(s=>s.controller===house.id&&s.armor==='Champion_'+house.id));}
 const snapshot=A.exportSave();for(const h of snapshot.game.houses)for(const relic of relics)delete h.stockpile[relic.key];assert.equal(A.importSave(snapshot).ok,true);assert(A.CHAMPION_KEYS.every(k=>A.getPlayerHouse().stockpile[k]===0));
});
test('champion armor is absent from ordinary crates and very rare in special crates',()=>{
 const {A,T}=loadGame();const count=(rare,big)=>{A.game.lootBoxes=[];for(let i=0;i<1000;i++)T.spawnLootBoxAt(1500,1500,rare,big);return A.game.lootBoxes.filter(b=>b.loot.some(A.isChampionArmor)).length;};assert.equal(count(false,false),0);const rare=count(true,false),great=count(true,true);assert(rare>35&&rare<100,`rare crates yielded ${rare}/1000 relics`);assert(great>120&&great<240,`great caches yielded ${great}/1000 relics`);
});
