import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, SPECIES, MAX_LEVEL, makeMember } from '../catalog.js';
import { newJournal, addCapture, loadJournal, saveJournal } from '../journal.js';
import {
  ITEMS, MARKETS, freshEconomy, restoreEconomy, awardCoins, battleSupplies, spendSupply,
  buyItem, itemOffer, sellItem, critterStock, buyCritter, critterOffer, sellCritter, feedCritter
} from '../economy.js';

function visit(region = 0) {
  const state = newJournal();
  state.economy = freshEconomy();
  Object.assign(state.world,{region,unlocked:region,node:'town'});
  return state;
}

test('a legacy save receives starting supplies while zero balances and known bag quantities round-trip', () => {
  assert.deepEqual(restoreEconomy(undefined), freshEconomy());
  assert.deepEqual(restoreEconomy({coins:0,bag:{tonic:2,thread:0,nope:300,starweave:-3}}),{coins:0,bag:{tonic:2}});
  const raw={coins:11,bag:{tonic:1,honeyroll:2}};
  const restored=restoreEconomy(raw);
  assert.deepEqual(restored,raw);
  restored.bag.tonic=9;
  assert.equal(raw.bag.tonic,1);
  assert.equal(restoreEconomy({coins:Infinity,bag:{}}).coins,0);
});

test('all eight trading posts have unique local recruits and goods, with affordable starting options', () => {
  const species = new Set(), foods = new Set(), battleItems = new Set();
  for (const region of REGIONS) {
    const s=visit(region.id), stock=critterStock(region.id);
    assert.equal(stock.length,2);
    for (const offer of stock) {
      assert.equal(SPECIES[offer.speciesId].region,region.id);
      assert.equal(SPECIES[offer.speciesId].legendary,false);
      assert.ok(offer.speciesId < 56);
      species.add(offer.speciesId);
      const member=makeMember(offer.speciesId,offer.level);
      addCapture(s,member);
      assert.ok(MARKETS.every(market => critterOffer(s,market.region,member.uid).price < offer.price));
    }
    const goods=MARKETS[region.id].stock;
    for (const [id,price] of Object.entries(goods)) {
      assert.ok(MARKETS.every(market => itemOffer(market.region,id) < price));
      if (ITEMS[id].kind === 'food') foods.add(id);
      else if (!['tonic','thread'].includes(id)) battleItems.add(id);
    }
  }
  assert.equal(species.size,16); assert.equal(foods.size,8); assert.equal(battleItems.size,8);
  assert.ok(critterStock(0)[0].price <= freshEconomy().coins);
});

test('purchases require reaching the right town and having the full price', () => {
  const s=visit(), before=structuredClone(s);
  assert.equal(buyItem(s,3,'pearlloop').ok,false);
  assert.equal(buyItem(s,0,'starweave').ok,false);
  assert.equal(buyCritter(s,0,6).ok,false);
  assert.deepEqual(s,before);
  s.world.node='camp';assert.equal(buyCritter(s,0,3).ok,false);
  s.world.node='town';s.economy.coins=0;
  const poor=structuredClone(s);
  assert.equal(buyItem(s,0,'tonic').ok,false);
  assert.equal(buyCritter(s,0,3).ok,false);
  assert.deepEqual(s,poor);
  s.economy.coins=1000;
  for (const id of [3,4,3]) assert.ok(buyCritter(s,0,id).ok);
  assert.equal(s.party.length,4);assert.equal(s.roster.length,5);
  assert.equal(s.seen.filter(id => id===3).length,1);
  assert.ok(!s.party.includes(s.roster.at(-1).uid));
});

test('selling a duplicate addresses its UID, preserves the owned history and quotes reevaluate on confirm', () => {
  const s=visit(), first=s.roster[0], other=addCapture(s,makeMember(first.speciesId,5));
  const quote=critterOffer(s,0,other.uid), initial=s.economy.coins;
  assert.equal(sellCritter(s,0,other.uid,quote.price+1).ok,false);
  assert.equal(s.economy.coins,initial);
  assert.ok(sellCritter(s,0,other.uid,quote.price).ok);
  assert.equal(s.roster.includes(first),true);
  assert.equal(s.roster.includes(other),false);
  assert.ok(s.seen.includes(other.speciesId));
  assert.equal(s.economy.coins,initial+quote.price);
  assert.equal(sellCritter(s,0,other.uid,quote.price).ok,false);
  s.party=[first.uid];
  const lastActive=critterOffer(s,0,first.uid);
  assert.equal(lastActive.replacement.uid,s.roster[1].uid);
  assert.ok(sellCritter(s,0,first.uid,lastActive.price).ok);
  assert.deepEqual(s.party,[lastActive.replacement.uid]);
  assert.equal(sellCritter(s,0,s.party[0],critterOffer(s,0,s.party[0]).price).ok,false);
});

test('training food works on the chosen reserve and battle supplies debit once', () => {
  const s=visit();s.economy.coins=200;
  const recipient=addCapture(s,makeMember(3,5));
  s.party=s.party.filter(uid => uid!==recipient.uid);
  assert.ok(buyItem(s,0,'honeyroll').ok);
  assert.equal(spendSupply(s,'honeyroll'),false);
  recipient.xp=25;
  assert.ok(feedCritter(s,'honeyroll',recipient.uid).ok);
  assert.equal(recipient.level,6);
  assert.equal(s.roster[0].level,3);
  assert.equal(s.economy.bag.honeyroll,undefined);
  assert.equal(feedCritter(s,'honeyroll',recipient.uid).ok,false);
  assert.ok(buyItem(s,0,'honeyroll').ok);
  recipient.level=MAX_LEVEL;
  assert.equal(feedCritter(s,'honeyroll',recipient.uid).ok,false); assert.equal(s.economy.bag.honeyroll,1);
  assert.ok(buyItem(s,0,'thread').ok);
  assert.deepEqual(battleSupplies(s).map(x=>x.id),['tonic','thread']);
  assert.ok(spendSupply(s,'thread'));assert.equal(spendSupply(s,'thread'),false);
  const before=s.economy.coins;
  assert.ok(sellItem(s,0,'tonic').ok);
  assert.equal(s.economy.coins,before+itemOffer(0,'tonic'));
  assert.equal(sellItem(s,0,'tonic').ok,false);
});

test('demand rewards sought roles, and regional arenas pay more than a common tribe', () => {
  const s=visit(), defender=s.roster.find(m=>SPECIES[m.speciesId].role==='defender');
  assert.ok(critterOffer(s,0,defender.uid).price > critterOffer(s,1,defender.uid).price);
  const before=s.economy.coins, normal=awardCoins(s,{region:0,kind:'tribe',node:'grove'});
  const trial=awardCoins(s,{region:0,kind:'arena',node:'trial'},true);
  assert.ok(trial>normal);assert.equal(s.economy.coins,before+normal+trial);
  s.economy.coins=Number.MAX_SAFE_INTEGER-1;
  assert.equal(awardCoins(s,{region:7,kind:'warden'},true),1);
  assert.equal(s.economy.coins,Number.MAX_SAFE_INTEGER);
});

test('a trade survives journal reload without resetting the wallet, bag, location or roster', () => {
  let payload;
  const storage={setItem:(_,text)=>{payload=text;},getItem:()=>payload};
  const state=visit();
  assert.ok(buyItem(state,0,'thread').ok);
  const first=state.roster[0], price=critterOffer(state,0,first.uid).price;
  assert.ok(sellCritter(state,0,first.uid,price).ok);
  assert.ok(saveJournal(state,storage));
  const restored=loadJournal(storage);
  assert.equal(restored.world.node,'town');
  assert.deepEqual(restored.economy,state.economy);
  assert.deepEqual(restored.party,state.party);
  assert.deepEqual(restored.roster,state.roster);
  assert.ok(restored.seen.includes(first.speciesId));
  delete state.economy;
  assert.ok(saveJournal(state,storage));
  assert.deepEqual(loadJournal(storage).economy,freshEconomy());
});
