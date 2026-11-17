'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={console,document:{readyState:'loading',addEventListener(){}},localStorage:{getItem(){return null}},sessionStorage:{}};
context.window=context;vm.createContext(context);
function run(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
run('config.js');run('data/content.js');run('data/recon-gear.js');run('data/activity-rewards.js');run('js/core/spatial.js');run('js/save/save.js');run('js/main.js');
const W=context.OW;W.UI=class{};run('js/core/recon-gear.js');run('js/core/activity-mastery.js');
const g=Object.create(W.Game.prototype);
Object.assign(g,{ui:{toast(){}},audio:{play(){}},world:{start:{x:10,y:10}},settings:{},effect(){},nearForge:()=>true,bossVictories:()=>8,save:()=>true,slot:0,time:0});
const p=g.newPlayer(0),ally=g.newPlayer(1,1);g.players=[p,ally];
const A=W.ActivityMastery,items=W.Content.activityMasterworks;
for(const it of items)assert.ok(it.rewardOnly&&it.slot==='accessory'&&W.Content.equipment.includes(it));
assert.equal(new Set(items.map(i=>i.id)).size,5);
function award(id,summary,owners=[0,1]){return A.settle(g,id,summary,owners);}
const wins={
  lantern:{mode:'ai3',winner:0,signals:[4,3]},quarry:{tier:3,won:true},
  bay:{lines:[{count:2,bestThree:8},{count:3,bestThree:7.01}]},
  yard:{level:3,deliveries:3,crashes:0,beats:12},
  wind:{heats:[{time:111,penalty:0,rings:6},{time:114,penalty:5,rings:6}]}
};
for(const id of Object.keys(wins)){
  assert.equal(award(id,{...wins[id],practice:true}).length,0);
  assert.ok(!A.qualifies(id,{},0));
}
assert.ok(!A.qualifies('lantern',{mode:'deny',winner:0,signals:[4,0]},0));
assert.ok(!A.qualifies('yard',{...wins.yard,crashes:1},1));
assert.ok(!A.qualifies('bay',{lines:[{count:8,bestThree:6.99}]},0));
assert.ok(A.qualifies('bay',{mode:'fish',lines:[{count:8,bestThree:2.5}]},0));
assert.ok(!A.qualifies('bay',{mode:'fish',lines:[{count:7,bestThree:2.5}]},0));
assert.ok(!A.qualifies('wind',{heats:[{time:120,penalty:0,rings:6}]},0));
assert.equal(award('lantern',wins.lantern).length,1);
assert.equal(award('quarry',wins.quarry).length,2);
assert.equal(award('bay',wins.bay).length,1);
assert.equal(award('yard',wins.yard,[0,0,2]).length,1);
assert.equal(award('wind',wins.wind).length,1);
assert.equal(award('wind',wins.wind).length,0);
assert.equal(p.inventory.filter(i=>i.id==='accessory_mastery_bay').length,0);
assert.equal(ally.inventory.filter(i=>i.id==='accessory_mastery_lantern').length,0);
const eq=(index,id)=>assert.ok(g.equip(index,'accessory_mastery_'+id));
const baseGun=g.weapon(p);eq(0,'lantern');assert.ok(g.weapon(p).range>baseGun.range);
p.velocityX=40;assert.equal(g.weapon(p).range,baseGun.range);
eq(0,'yard');assert.ok(Math.abs(g.weapon(p).reload/baseGun.reload-.8)<.0001);
eq(0,'quarry');assert.equal(W.ReconGear.bladeImpact(g,p,{},g.blade(p),{finisher:true}),1.2);
assert.equal(W.ReconGear.bladeImpact(g,p,{},g.blade(p),{finisher:false}),1);
eq(1,'bay');ally.hp=1;p.hp=1;g.useConsumable(ally);assert.equal(ally.hp,1+ally.maxHp*.55+ally.maxHp*.15);assert.equal(p.hp,1+p.maxHp*.08);
eq(0,'wind');p.cooldowns.dodge=1;g.armorDodge(p);assert.equal(p.cooldowns.dodge,.82);
g.players=[p];g.reservePlayer=ally;assert.equal(award('yard',wins.yard,[1]).length,1);assert.equal(award('quarry',wins.quarry).length,0);assert.ok(W.Save.validPlayer(ally));
console.log('PASS · five mastery thresholds, personal eligibility, duplicate settlement, resting partner and equipped perks.');
