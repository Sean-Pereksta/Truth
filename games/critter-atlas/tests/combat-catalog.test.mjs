import assert from 'node:assert/strict';
import test from 'node:test';
import { AFFINITIES, AFFINITY_DAMAGE, AURAS, BUFFS, MAX_LEVEL, REGIONS, SPECIES, affinityMultiplier, getAbilities, getAura } from '../catalog.js';

test('affinities have two counters and resist their own attacks, with a neutral fallback', () => {
  const { effective, resisted, neutral } = AFFINITY_DAMAGE;
  assert.equal(affinityMultiplier('volcanic', 'forest'), effective);
  assert.equal(affinityMultiplier('forest', 'volcanic'), resisted);
  assert.equal(affinityMultiplier('astral', 'volcanic'), neutral);
  for (const [type, affinity] of Object.entries(AFFINITIES)) {
    assert.equal(affinity.strongAgainst.length, 2);
    assert.equal(affinity.resistedBy.length, 3);
    assert.equal(affinityMultiplier(type, type), resisted);
    assert.equal(affinityMultiplier(undefined, type), neutral);
    for (const counter of affinity.strongAgainst) {
      assert.equal(affinityMultiplier(type, counter), effective);
      assert.equal(affinityMultiplier(counter, type), resisted);
    }
  }
});

test('every family learns a typed attack and the four roles have varied support kits', () => {
  const learnedBuffs = new Set();
  const supportRoles = new Set();
  let alliesWithSupport = 0;
  let startersWithSupport = 0;
  for (const species of SPECIES) {
    const moves = getAbilities({ speciesId: species.id, level: MAX_LEVEL });
    assert.ok(AFFINITIES[species.affinity], species.name);
    assert.equal(moves.find(move => move.id === 'strike').affinity, undefined);
    assert.ok(moves.some(move => move.kind === 'attack' && AFFINITIES[move.affinity]), species.name);
    const support = moves.filter(move => move.kind === 'support');
    if (support.length) {
      alliesWithSupport++;
      supportRoles.add(species.role);
      if (support.some(move => move.learnLevel === 1)) startersWithSupport++;
    }
    for (const move of support) {
      assert.equal(move.status, null);
      assert.ok(BUFFS[move.buff], move.name);
      learnedBuffs.add(move.buff);
    }
  }
  assert.deepEqual(supportRoles, new Set(['defender', 'healer', 'ranged', 'striker']));
  assert.deepEqual(learnedBuffs, new Set(Object.keys(BUFFS)));
  assert.equal(alliesWithSupport, SPECIES.length);
  assert.ok(startersWithSupport >= 60);
});

test('support signatures grow into wider or longer-lasting versions after evolution', () => {
  const ability = (speciesId, level, id) => getAbilities({ speciesId, level }).find(move => move.id === id);
  assert.equal(ability(2, 5, 'signature'), undefined);
  const pollen = ability(2, 6, 'signature');
  const apex = ability(2, 20, 'apex');
  assert.deepEqual([pollen.name, pollen.buff, pollen.range, pollen.area], ['Pollen Veil', 'regen', 3, 0]);
  assert.deepEqual([apex.name, apex.buff, apex.range, apex.area], ['Pollen Veil II', 'regen', 4, 1]);
  assert.equal(ability(6, 20, 'apex').duration, BUFFS.regen.duration + 1);
});

test('passive auras unlock at the family’s level and their radii vary by Critter', () => {
  const types = new Set();
  for (const {id} of REGIONS) {
    const carriers = SPECIES.filter(species => species.region === id && species.aura);
    assert.ok(carriers.length > 2);
    for (const species of carriers) {
      const {unlockLevel} = species.aura;
      assert.equal(getAura({speciesId:species.id, level:unlockLevel-1}), null);
      const aura = getAura({speciesId:species.id, level:unlockLevel});
      assert.equal(aura.target, aura.id === 'dread' ? 'enemy' : 'ally');
      assert.equal(aura.amount, AURAS[aura.id].amount);
      types.add(aura.id);
    }
  }
  assert.deepEqual(types, new Set(Object.keys(AURAS)));
  assert.equal(getAura({speciesId:111, level:MAX_LEVEL}).radius, 1);
  assert.equal(getAura({speciesId:119, level:MAX_LEVEL}).radius, 2);
});
