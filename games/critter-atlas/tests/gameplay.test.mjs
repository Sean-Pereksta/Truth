import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, REGIONS, EVOLUTION_LEVELS, makeMember, rollEncounter, captureChance, getForm, getStats, getAbilities, xpToNext } from '../catalog.js';
import { newJournal, addCapture, getParty, setParty, awardXP } from '../journal.js';
import { createBattle, reachable, moveUnit, attemptCapture } from '../battle.js';
import { freshWorld, completeEncounter } from '../world.js';
import { sprite } from '../art.js';

test('every family has four named, illustrated forms and grows through the same levels used in battle', () => {
  const names = new Set();
  const sprites = new Set();
  assert.ok(SPECIES.length >= 50);
  for (const family of SPECIES) {
    const base = makeMember(family.id);
    for (const [stage, level] of [1, ...EVOLUTION_LEVELS].entries()) {
      const member = { ...base, level };
      assert.deepEqual(getForm(member), {stage, name:family.forms[stage]});
      assert.ok(getStats(member).maxHp >= getStats(base).maxHp);
      assert.ok(getAbilities(member).some(a => a.kind === 'attack'));
      names.add(getForm(member).name);
      sprites.add(sprite(family.id, stage));
    }
    assert.ok(captureChance(base, .2, true) > captureChance(base, 1, false));
  }
  assert.equal(names.size, SPECIES.length * 4);
  assert.equal(sprites.size, names.size);
});

test('legendary trails draw from their own region and ordinary wild encounters omit legendaries', () => {
  for (const region of REGIONS) {
    const wild = rollEncounter(region.id, {rng:() => .5});
    assert.ok(wild.every(m => !SPECIES[m.speciesId].legendary && SPECIES[m.speciesId].region === region.id));
    const special = rollEncounter(region.id, {legendary:true, rng:() => .5});
    assert.ok(special.some(m => SPECIES[m.speciesId].legendary && SPECIES[m.speciesId].region === region.id));
  }
});

test('capture range and occupancy use the same board as movement', () => {
  const battle = createBattle({region:0, node:'grove'}, [makeMember(0,5)], [makeMember(1,1)], () => 0);
  const ally = battle.units[0], foe = battle.units[1];
  assert.equal(battle.units[battle.order[battle.cursor]], ally);
  assert.equal(attemptCapture(battle, foe), false);
  assert.equal(moveUnit(battle, foe.key), false);
  const destinations = [...reachable(battle).keys()];
  const landing = destinations.find(cell => cell % 7 >= 3);
  assert.ok(Number.isInteger(landing));
  assert.equal(moveUnit(battle, landing), true);
  assert.equal(moveUnit(battle, ally.key - 1), false);
  assert.equal(attemptCapture(battle, foe), true);
  assert.equal(battle.result, 'won');
  assert.equal(foe.caught, true);
});

test('captured reserves do not displace companions or receive XP until selected', () => {
  const state = newJournal(2);
  assert.deepEqual(getParty(state).map(m => m.speciesId), [2,0]);
  [3,4,5].forEach(id => addCapture(state,makeMember(id)));
  assert.equal(state.roster.length,5);
  const reserve = state.roster.at(-1);
  assert.ok(!state.party.includes(reserve.uid));
  awardXP(state,xpToNext(3));
  assert.equal(reserve.level,1);
  const swapped = [...state.party.slice(1),reserve.uid];
  assert.equal(setParty(state,swapped),true);
  assert.deepEqual(getParty(state).map(m => m.uid),swapped);
});

test('only warden victories advance crest progression, and rematches preserve progress', () => {
  const world = freshWorld();
  for (const region of REGIONS) {
    const encounter = {region:region.id,node:'warden',kind:'warden'};
    completeEncounter(world,encounter,false);
    assert.equal(world.unlocked,region.id);
    completeEncounter(world,encounter,true);
    completeEncounter(world,encounter,true);
    assert.equal(world.unlocked,Math.min(region.id+1,REGIONS.length-1));
    assert.equal(world.cleared.filter(k => k === region.id+'/warden').length,1);
  }
});
