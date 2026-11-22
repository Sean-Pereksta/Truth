import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, REGIONS, EVOLUTION_LEVELS, getAbilities, captureChance, makeMember, rollEncounter } from '../catalog.js';
import { newJournal, addCapture, loadJournal, saveJournal } from '../journal.js';

const frontier = SPECIES.slice(56);
const always = () => .5;

test('frontier catalog adds 12 rare and 8 legendary families with distinct moves and evolutions', () => {
  assert.equal(SPECIES.length, 76);
  assert.equal(frontier.filter(s => s.rarity === 'Rare').length, 12);
  assert.equal(frontier.filter(s => s.legendary).length, 8);
  assert.equal(new Set(SPECIES.flatMap(s => s.forms)).size, 304);
  assert.equal(new Set(SPECIES.map(s => s.captureRate)).size, 76);
  assert.equal(new Set(SPECIES.map(s => s.signature)).size, 76);
  for (const { id } of REGIONS) {
    const local = frontier.filter(s => s.region === id);
    assert.equal(local.filter(s => s.legendary).length, 1);
    assert.ok(local.some(s => s.rarity === 'Rare'));
    assert.equal(new Set(local.map(s => s.habitatId)).size, local.length);
  }
  for (const family of frontier) {
    assert.equal(SPECIES[family.id], family);
    const adult = makeMember(family.id, EVOLUTION_LEVELS.at(-1));
    const skills = getAbilities(adult);
    const signature = skills.find(s => s.id === 'signature');
    const apex = skills.find(s => s.id === 'apex');
    assert.equal(signature.name, family.signature);
    assert.equal(apex.kind, signature.kind);
    assert.ok(apex.power > signature.power && apex.range > signature.range);
    assert.ok(captureChance(adult, .1, true) > captureChance(adult, .1));
  }
});

test('each frontier sighting needs its native region, matching site, and tracked species', () => {
  for (const family of frontier) {
    const options = { habitatId: family.habitatId, leadSpeciesId: family.id, legendary: family.legendary, rng: always };
    const pack = rollEncounter(family.region, options);
    assert.equal(pack[0].speciesId, family.id);
    assert.ok(pack.slice(1).every(m => m.speciesId < 56 && SPECIES[m.speciesId].region === family.region && !SPECIES[m.speciesId].legendary));
    for (const changed of [{ habitatId: undefined }, { habitatId: 'grove' }, { leadSpeciesId: undefined }]) {
      assert.ok(rollEncounter(family.region, { ...options, ...changed }).every(m => m.speciesId < 56));
    }
    assert.ok(rollEncounter((family.region + 1) % REGIONS.length, options).every(m => m.speciesId < 56));
  }
  for (const region of REGIONS) {
    assert.equal(rollEncounter(region.id, { legendary: true, rng: always })[0].speciesId, region.id * 7 + 6);
    assert.equal(rollEncounter(region.id, { habitatId: 'hollow', legendary: true, rng: always })[0].speciesId, region.id * 7 + 6);
    assert.ok(rollEncounter(region.id, { habitatId: 'vault', legendary: true, rng: always }).every(m => !SPECIES[m.speciesId].legendary));
  }
});

test('the same saved roster can hold established and frontier families', () => {
  const state = newJournal();
  for (const family of frontier) addCapture(state, makeMember(family.id, 12));
  let json;
  const storage = { setItem: (_, value) => { json = value; }, getItem: () => json };
  assert.equal(saveJournal(state, storage), true);
  const reloaded = loadJournal(storage);
  assert.deepEqual(reloaded.roster, state.roster);
  assert.deepEqual(reloaded.party, state.party);
});
