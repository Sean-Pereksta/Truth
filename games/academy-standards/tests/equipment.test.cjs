const test=require('node:test'),assert=require('node:assert/strict');
const {plan,slotFor}=require('../equipment.js');
const {loadGame}=require('./engine-harness.cjs');
const unit=(id,extra={})=>({id,name:id,controller:'player',state:'idle',weapon:'None',weaponLevel:0,armor:'None',item:'None',mount:false,...extra});
function ledger(units,stock){
 const result={...stock};for(const s of units)for(const key of [s.weapon,s.armor,s.item,s.mount?'Horse':'None'])if(key!=='None')result[key]=(result[key]||0)+1;
 return Object.fromEntries(Object.entries(result).filter(([,n])=>n).sort());
}
test('auto fills every available slot, upgrades armor and bows, and preserves forged weapons and specialists',()=>{
 const units=[unit('front',{weapon:'Spear',weaponLevel:3,armor:'Light',item:'Shield'}),unit('archer',{weapon:'Bow',weaponLevel:1}),unit('medic',{weapon:'Sword',weaponLevel:2,item:'Medkit'}),unit('new')];
 const stock={Heavy:4,Light:4,Longbow:3,Shield:4,Horse:4,Sword:2,Spear:2,Boots:4};
 const result=plan(units,stock);
 assert.equal(result.units[0].weaponLevel,3);assert.equal(result.units[0].weapon,'Spear');assert.equal(result.units[0].armor,'Heavy');
 assert.equal(result.units[1].weapon,'Longbow');assert.equal(result.units[2].item,'Medkit');assert.equal(result.units[2].weaponLevel,2);
 assert(result.units.every(s=>s.weapon!=='None'&&s.armor!=='None'&&s.item!=='None'&&s.mount));
 assert.deepEqual(ledger(units,stock),ledger(result.units,result.stock));
 assert.deepEqual(stock,{Heavy:4,Light:4,Longbow:3,Shield:4,Horse:4,Sword:2,Spear:2,Boots:4},'preview must not mutate supplies');
});
test('a role preset upgrades compatible equipment and returns replaced gear to supplies',()=>{
 const units=[unit('bow',{weapon:'Bow',weaponLevel:1,armor:'Heavy',item:'Shield'})],stock={Longbow:1,Light:1,Boots:1};
 const result=plan(units,stock,{mode:'ranged'});assert.equal(result.changed,3);assert.equal(result.units[0].weapon,'Longbow');assert.equal(result.stock.Bow,1);assert.equal(result.stock.Heavy,1);assert.equal(result.stock.Shield,1);
 assert.deepEqual(ledger(units,stock),ledger(result.units,result.stock));
});
test('specific gear fills empty slots first and never invents stock when supplies are short',()=>{
 const units=[unit('forged',{weapon:'Spear',weaponLevel:3}),unit('unarmed'),unit('down',{state:'knocked'}),unit('enemy',{controller:'mars'})];
 const result=plan(units,{Sword:1},{gear:'Sword'});assert.equal(result.units[0].weapon,'Spear');assert.equal(result.units[1].weapon,'Sword');assert.equal(result.students,2);assert.equal(result.missing.length,1);assert.equal(result.stock.Sword,0);
});
test('auto uses spare weapons and specialist items to fill every available slot',()=>{
 const units=[unit('front'),unit('archer',{weapon:'Bow'})];
 const result=plan(units,{Longbow:1,EngineerKit:2});assert(result.units.every(s=>s.weapon!=='None'&&s.item==='EngineerKit'));assert.equal(result.stock.Bow||0,0);
});
test('whole team equip ignores selection and preview exactly matches applied changes',()=>{
 const {A}=loadGame(),g=A.game;A.selectUnits([]);const h=A.getPlayerHouse();for(const k of A.LOOT_KEYS)h.stockpile[k]=20;
 const expected=A.planEquipment({scope:'team',mode:'auto'});assert.equal(expected.students,10);assert(expected.changed>0);
 const actual=A.applyEquipment({scope:'team',mode:'auto'});assert.equal(actual.changed,expected.changed);assert.deepEqual(actual.stock,expected.stock);assert.equal(A.getSelectedUnits().length,0);
 for(const copy of expected.units){const s=g.students.find(t=>t.id===copy.id);for(const key of ['weapon','weaponLevel','armor','item','mount'])assert.equal(s[key],copy[key]);}
});
test('saved squad scope changes only that group and keeps inventory conserved',()=>{
 const {A}=loadGame(),g=A.game,party=g.students.filter(s=>s.controller==='player');A.selectUnits([party[0].id,party[1].id]);A.saveSquad(2);A.selectUnits([party[5].id]);
 const stock=A.getPlayerHouse().stockpile;for(const k of A.LOOT_KEYS)stock[k]=10;
 const before=party.map(s=>({...s})),ledgerBefore=ledger(party,stock);const result=A.applyEquipment({scope:'2',mode:'ranged'});assert.equal(result.students,2);
 assert(party.slice(2).every((s,i)=>s.weapon===before[i+2].weapon&&s.armor===before[i+2].armor&&s.item===before[i+2].item&&s.mount===before[i+2].mount));assert.deepEqual(ledger(party,stock),ledgerBefore);
});
