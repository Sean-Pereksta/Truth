'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const box={console,document:{readyState:'loading',addEventListener(){}},localStorage:new Map(),sessionStorage:new Map()};
for(const store of [box.localStorage,box.sessionStorage]){
  store.getItem=store.get.bind(store);store.setItem=store.set.bind(store);store.removeItem=store.delete.bind(store);
}
box.window=box;vm.createContext(box);
function run(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),box,{filename:file});}
run('config.js');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,file] of html.matchAll(/<script defer src="(data\/[^"]+)"/g))run(file);
for(const file of ['js/save/save.js','js/core/spatial.js','js/main.js','js/core/recon-gear.js'])run(file);
const W=box.OW,F=W.ReconGear,C=W.Content,g=Object.create(W.Game.prototype);
let leads=0,near=true;
Object.assign(g,{ui:{toast(){}},audio:{play(){}},world:{start:{x:100,y:100}},nearForge:()=>near,bossVictories:()=>0,reconEvidenceCount:()=>leads,slot:0,time:0});
const p=g.newPlayer(0),ally=g.newPlayer(1,1);g.players=[p,ally];
g.snapshot=()=>({version:1,world:{},players:g.players});
const quote=(tab,id)=>F.quote(g,0,tab,id);
const buy=(id,equip=true)=>F.commit(g,quote('Craft',id),equip);
const patterns=C.reconGear.patterns;
assert.equal(patterns.length,20);
assert.equal(new Set(patterns.map(v=>v.id)).size,20);
assert.equal(patterns.filter(i=>i.reconSuit).length,8);
const carbine=patterns[0],saber=patterns[8];
const first=quote('Craft',carbine.id),cash=p.gold;
assert.equal(quote('Craft',carbine.id).reason,'');
assert.equal(p.gold,cash,'leaving preview must not debit');
assert.equal(F.commit(g,first,false),true);
assert.ok(p.inventory.some(i=>i.id===carbine.id));
assert.equal(p.weapon,0,'store keeps primary unchanged');
assert.equal(F.commit(g,first,true),false);
assert.equal(p.gold,cash-first.cost.gold);
assert.equal(p.inventory.filter(i=>i.id===carbine.id).length,1);
assert.equal(ally.inventory.some(i=>i.id===carbine.id),false);
assert.equal(buy(carbine.id),true);
assert.equal(p.weapon,carbine.weapon);
assert.equal(p.gold,cash-first.cost.gold,'equipping owned recipe is free');
const funded=()=>Object.assign(p,{gold:9999,materials:999,cores:99});
const locked=quote('Craft',patterns[1].id);funded();
assert.equal(F.commit(g,locked),false,'locked lead stays locked even with resources');
const stale=quote('Craft',saber.id);near=false;assert.equal(F.commit(g,stale),false);near=true;
const tooPoor=quote('Craft',saber.id);p.materials=0;assert.equal(F.commit(g,tooPoor),false);funded();
const before=JSON.stringify(p),save=g.save;g.save=()=>false;
assert.equal(buy(saber.id),false);assert.equal(JSON.stringify(p),before,'failed save restores complete hero state');g.save=save;
assert.equal(buy(saber.id),true);
const rank=quote('Upgrade','blade'),older=quote('Upgrade','blade');
assert.equal(F.commit(g,rank),true);assert.equal(F.commit(g,older),false,'second quote cannot buy the next rank');
assert.equal(p.reconBladeRanks[C.melee[saber.melee].id],1);
leads=12;
assert.ok(quote('Craft','weapon_redfoundry').reason,'exclusive foundry plans require a quest turn-in');
g.campaignWon=true;
assert.equal(quote('Craft','armor_recon_breakwater').reason,'','Berlin hub issues the shell plan');
g.completedQuests=new Set(['rare_cindercoil','rare_zephyr','rare_rimeglass']);
for(const item of patterns.filter(i=>i.reconFamily!=='armor')){
  funded();if(!p.inventory.some(i=>i.id===item.id)||!(item.weapon===p.weapon||item.melee===p.melee))assert.ok(buy(item.id));
  const slot=item.weapon!=null?'gun':'blade',get=()=>slot==='gun'?g.weapon(p):g.blade(p);
  const factory=JSON.stringify(get());assert.ok(F.commit(g,quote('Tune',slot+'.0')));
  const a=JSON.stringify(get());assert.notEqual(a,factory);
  assert.ok(F.commit(g,quote('Tune',slot+'.1')));assert.notEqual(JSON.stringify(get()),a);
  const balance=p.gold;assert.ok(F.commit(g,quote('Tune',slot+'.0')));assert.equal(p.gold,balance);
}
for(const item of patterns.filter(i=>i.reconSuit)){funded();assert.ok(buy(item.id));assert.equal(p.equipment.armor.id,item.id);}
assert.ok(W.Save.validPlayer(p));assert.ok(g.save(false));
const exported=W.Save.export(0);assert.ok(exported.length>500);assert.ok(W.Save.import(1,exported));
assert.deepEqual(W.Save.read(1).players[0].reconTunes,p.reconTunes);
// The rank-eleven crafts are exclusive to their individual postgame exercise.
g.campaignWon=true;g.reconDossier={scores:{}};
const b=g.blade(p);p.armorRank=10;p.weaponUpgrades[p.weapon]=10;p.reconBladeRanks[b.id]=10;
for(const [station,exercise] of [['gun','intact'],['blade','quiet'],['suit','crossing']]){
  const unavailable=quote('Upgrade',station);assert.match(unavailable.reason,/Dawnbridge/);
  funded();g.reconDossier.scores[exercise]=1;
  const plan=quote('Upgrade',station);assert.equal(plan.reason,'');assert.equal(plan.cost.gold,940);
  assert.ok(F.commit(g,plan));assert.equal(F.commit(g,plan),false);
  assert.equal(quote('Upgrade',station).reason,'Fully reinforced');
}
assert.ok(W.Save.validPlayer(p));assert.ok(g.save(false));assert.equal(W.Save.read(0).players[0].armorRank,11);
console.log('Passed three Dawnbridge masterwork unlocks, exact costs, rank caps and persistence.');
console.log('Passed 20 recipes, 24 weapon tuning installs, ownership, preview, storage rollback, stale confirms, rank persistence and export/import.');
