import assert from 'node:assert/strict';
import test from 'node:test';
import { AFFINITIES, AFFINITY_DAMAGE, BUFFS, MAX_LEVEL, SPECIES, affinityMultiplier, getAbilities } from '../catalog.js';

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
  for (const species of SPECIES) {
    const moves = getAbilities({ speciesId: species.id, level: MAX_LEVEL });
    assert.ok(AFFINITIES[species.affinity], species.name);
    assert.equal(moves.find(move => move.id === 'strike').affinity, undefined);
    assert.ok(moves.some(move => move.kind === 'attack' && AFFINITIES[move.affinity]), species.name);
    const support = moves.filter(move => move.kind === 'support');
    if (support.length) {
      alliesWithSupport++;
      supportRoles.add(species.role);
    }
    for (const move of support) {
      assert.equal(move.status, null);
      assert.ok(BUFFS[move.buff], move.name);
      learnedBuffs.add(move.buff);
    }
  }
  assert.deepEqual(supportRoles, new Set(['defender', 'healer', 'ranged', 'striker']));
  assert.deepEqual(learnedBuffs, new Set(Object.keys(BUFFS)));
  assert.ok(alliesWithSupport > SPECIES.length / 2);
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
