import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, REGIONS, EVOLUTION_LEVELS, MAX_LEVEL, getForm, getStats, getAbilities, captureChance, makeMember, rollEncounter, localFamilies } from '../catalog.js';
import { newJournal, addCapture, loadJournal, saveJournal } from '../journal.js';

const frontier = SPECIES.slice(56, 76);
const always = () => .5;

test('frontier catalog adds 12 rare and 8 legendary families with distinct moves and evolutions', () => {
  assert.equal(frontier.length, 20);
  assert.equal(frontier.filter(s => s.rarity === 'Rare').length, 12);
  assert.equal(frontier.filter(s => s.legendary).length, 8);
  assert.equal(new Set(SPECIES.flatMap(s => s.forms)).size, 4 * SPECIES.length);
  assert.equal(new Set(SPECIES.map(s => s.captureRate)).size, SPECIES.length);
  assert.equal(new Set(SPECIES.map(s => s.signature)).size, SPECIES.length);
  for (const { id } of REGIONS.slice(0,8)) {
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
    assert.ok(rollEncounter(family.region + 1, options).every(m => SPECIES[m.speciesId].region === family.region + 1 && !SPECIES[m.speciesId].habitatId));
  }
  for (const region of REGIONS) {
    const legend = localFamilies(region.id).find(species => species.legendary);
    assert.equal(rollEncounter(region.id, { legendary: true, rng: always })[0].speciesId, legend.id);
    assert.equal(rollEncounter(region.id, { habitatId: 'hollow', legendary: true, rng: always })[0].speciesId, legend.id);
    assert.ok(rollEncounter(region.id, { habitatId: 'vault', legendary: true, rng: always }).every(m => !SPECIES[m.speciesId].legendary));
  }
});

test('the same saved roster can hold established, frontier, and side habitat families', () => {
  const state = newJournal();
  const sideHabitatFamilies = SPECIES.filter(family => ['glade', 'refuge'].includes(family.habitatId));
  assert.deepEqual(sideHabitatFamilies.map(family => [family.id, family.region, family.habitatId]),
    REGIONS.flatMap(({id}) => [[108 + id * 2, id, 'glade'], [109 + id * 2, id, 'refuge']]));
  for (const family of [...frontier, ...sideHabitatFamilies]) addCapture(state, makeMember(family.id, 12));
  let json;
  const storage = { setItem: (_, value) => { json = value; }, getItem: () => json };
  assert.equal(saveJournal(state, storage), true);
  const reloaded = loadJournal(storage);
  assert.deepEqual(reloaded.roster, state.roster);
  assert.deepEqual(reloaded.party, state.party);
});

test('the five wonders have four evolving forms, distinct low capture odds, and one resident each', () => {
  const wonders = SPECIES.filter(s => s.hyperRare);
  assert.equal(SPECIES.filter(s => s.legendary).length, 2 * REGIONS.length);
  assert.deepEqual(wonders.map(s => [s.id, s.name, s.region]), [
    [76, 'Veilkit', 0], [77, 'Chordcoil', 2], [78, 'Keelwisp', 3],
    [79, 'Crucibex', 5], [80, 'Prismarch', 7]
  ]);
  const lowestLegendaryRate = Math.min(...SPECIES.filter(s => s.legendary).map(s => s.captureRate));
  for (const family of wonders) {
    assert.equal(family.rarity, 'Hyper Rare');
    assert.equal(family.habitatId, 'wonder');
    assert.ok(family.captureRate < lowestLegendaryRate);
    const base = makeMember(family.id);
    for (const [stage, level] of [1, ...EVOLUTION_LEVELS].entries()) {
      const member = {...base, level};
      assert.deepEqual(getForm(member), {name: family.forms[stage], stage});
      assert.ok(getStats(member).maxHp >= getStats(base).maxHp);
      if (stage > 0) {
        const signature = getAbilities(member).find(a => a.id === 'signature');
        assert.equal(signature.name, family.signature);
        assert.equal(signature.kind, family.technique.kind);
      }
    }
    for (const level of [1, MAX_LEVEL]) {
      const member = {...base, level};
      const full = captureChance(member, 1);
      const weak = captureChance(member, .1);
      assert.ok(full >= .01 && full <= .020001);
      assert.ok(full < weak && weak < captureChance(member, .1, true));
    }
    const sighting = {habitatId:'wonder', leadSpeciesId:family.id, rng:always};
    const group = rollEncounter(family.region, sighting);
    assert.equal(group.length, 2);
    assert.equal(group[0].speciesId, family.id);
    assert.ok(group[1].speciesId < 56 && !SPECIES[group[1].speciesId].legendary);
    for (const habitatId of [undefined, 'habitat', 'rookery', 'hollow', 'vault']) {
      assert.ok(rollEncounter(family.region, {...sighting, habitatId}).every(m => !SPECIES[m.speciesId].hyperRare));
    }
    assert.ok(rollEncounter(family.region, {habitatId:'wonder', rng:always}).every(m => !SPECIES[m.speciesId].hyperRare));
    assert.ok(rollEncounter((family.region + 1) % REGIONS.length, sighting).every(m => !SPECIES[m.speciesId].hyperRare));
  }
});
