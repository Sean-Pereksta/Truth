import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, SPECIES, makeMember } from '../catalog.js';
import { addCapture, loadJournal, newJournal, parseJournal, saveJournal, serializeJournal, setParty } from '../journal.js';

test('portable backups restore the latest expedition without browser storage', () => {
  const state = newJournal(1);
  const region = REGIONS.length - 1;
  const member = addCapture(state, makeMember(SPECIES.find(species => species.region === region).id, REGIONS[region].minLevel));
  setParty(state, [member.uid, state.roster[0].uid]);
  const world = {
    region, unlocked: region, node: 'hollow',
    cleared: [`${region}/warden`], clues: [`${region}/ford`, `${region}/lookout`],
    hunts: [`${region}/hollow`], patrols: { [`${region}/warden`]: 3 }, sightings: { [region]: -1 }
  };
  Object.assign(state.world, world);
  state.wins[region] = 3;
  state.economy = { coins: 235, bag: { tonic: 2, thread: 4 } };

  const timestamp = Date.UTC(2026, 10, 22);
  const restored = parseJournal(serializeJournal(state, timestamp));
  assert.equal(restored.savedAt, timestamp);
  assert.equal(restored.region, region);
  assert.equal(restored.unlocked, region);
  assert.deepEqual(restored.world, state.world);
  assert.deepEqual(restored.wins, state.wins);
  assert.deepEqual(restored.economy, state.economy);
  assert.deepEqual(restored.party, state.party);
  assert.deepEqual(restored.roster, state.roster);
});

test('legacy autosaves load, and malformed backup files are rejected', () => {
  const legacy = newJournal(2);
  delete legacy.savedAt;
  delete legacy.world;
  delete legacy.economy;
  const loaded = loadJournal({ getItem: () => JSON.stringify(legacy) });
  assert.deepEqual(loaded.roster, legacy.roster);
  assert.equal(loaded.savedAt, 0);
  assert.equal(loaded.world.node, 'camp');
  assert.equal(parseJournal('broken json'), null);
  assert.equal(parseJournal('{"version":999,"roster":[]}'), null);
  assert.equal(parseJournal('{"version":1,"roster":[null]}'), null);
});

test('a failed local write leaves the last successful timestamp and backup export available', () => {
  const state = newJournal();
  let saved;
  assert.equal(saveJournal(state, { setItem: (_, value) => { saved = value; } }), true);
  assert.equal(parseJournal(saved).savedAt, state.savedAt);
  const previous = state.savedAt;
  state.economy.coins += 12;
  const denied = () => { throw new Error('Storage denied'); };
  assert.equal(saveJournal(state, { setItem: denied }), false);
  assert.equal(state.savedAt, previous);
  assert.equal(loadJournal({ getItem: denied }), null);
  assert.equal(parseJournal(serializeJournal(state)).economy.coins, state.economy.coins);
});
