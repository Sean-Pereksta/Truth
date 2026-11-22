import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, REGIONS, SPECIES, makeMember } from '../catalog.js';
import { addCapture, newJournal } from '../journal.js';
import { awardCoins, buyCritter, critterOffer, critterStock, sellCritter } from '../economy.js';

const huntFamilies = [76, 77, 78, 79, 80];

test('a wonder victory earns a larger bounty than a legendary or trail victory in its region', () => {
  const state = newJournal();
  for (const family of huntFamilies) {
    const region = SPECIES[family].region;
    for (const firstClear of [true, false]) {
      const normal = awardCoins(state, {region, kind:'tribe', node:'grove'}, firstClear);
      const legend = awardCoins(state, {region, kind:'legendary', node:'vault'}, firstClear);
      const wonder = awardCoins(state, {region, kind:'wonder', node:'wonder'}, firstClear);
      assert.ok(wonder > legend && legend > normal);
    }
  }
});

test('all five Hyper Rares stay off sale racks and command more than a legendary of the same level', () => {
  const state = newJournal();
  state.economy.coins = 10000;
  state.world.unlocked = REGIONS.length - 1;
  state.world.node = 'town';
  const legend = addCapture(state, makeMember(6));
  const hunted = huntFamilies.map(id => {
    assert.equal(SPECIES[id]?.rarity, 'Hyper Rare');
    return addCapture(state, makeMember(id));
  });
  for (const level of [1, MAX_LEVEL]) {
    for (const member of [legend, ...hunted]) member.level = level;
    for (const {id:region} of REGIONS) {
      state.world.region = region;
      const before = structuredClone(state);
      const stock = critterStock(region);
      const benchmark = critterOffer(state, region, legend.uid).price;
      for (const member of hunted) {
        const price = critterOffer(state, region, member.uid).price;
        assert.ok(Number.isSafeInteger(price) && price > benchmark);
        assert.ok(!stock.some(offer => offer.speciesId === member.speciesId));
        assert.equal(buyCritter(state, region, member.speciesId).ok, false);
      }
      assert.deepEqual(state, before);
    }
  }
});

test('a Hyper Rare sale requires the reviewed price and credits only the selected companion once', () => {
  for (const id of huntFamilies) {
    const state = newJournal();
    state.world.node = 'town';
    const retained = addCapture(state, makeMember(id, 22));
    const offered = addCapture(state, makeMember(id, 22));
    const before = structuredClone(state);
    const quote = critterOffer(state, 0, offered.uid);
    assert.equal(quote.member.uid, offered.uid);
    assert.ok(quote.sellable);
    assert.equal(sellCritter(state, 0, offered.uid, undefined).ok, false);
    assert.equal(sellCritter(state, 0, offered.uid, quote.price - 1).ok, false);
    assert.deepEqual(state, before);
    assert.ok(sellCritter(state, 0, offered.uid, quote.price).ok);
    assert.equal(sellCritter(state, 0, offered.uid, quote.price).ok, false);
    assert.equal(state.economy.coins, before.economy.coins + quote.price);
    assert.deepEqual(state.roster.map(member => member.uid), before.roster.map(member => member.uid).filter(uid => uid !== offered.uid));
    assert.ok(state.party.includes(retained.uid) && !state.party.includes(offered.uid));
    assert.ok(state.seen.includes(id));
  }
});
