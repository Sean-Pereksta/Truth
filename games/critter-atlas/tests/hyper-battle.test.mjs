import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, REGIONS, EVOLUTION_LEVELS, makeMember, getForm, xpToNext } from '../catalog.js';
import { addCapture, newJournal, awardXP } from '../journal.js';
import { attemptCapture, capturePercent, createBattle, encounterOpponents, previewAction, reachable, retreatBattle, takeBattleEvents, useAbility } from '../battle.js';

const quarryFamilies = SPECIES.filter(s => s.hyperRare);
function hunt(s, youngling = false) {
  return {region:s.region, kind:'wonder', habitatId:'wonder', leadSpeciesId:s.id,
    level:REGIONS[s.region].minLevel + 7, youngling};
}
function playerTurn(battle) {
  battle.order = battle.units.map(u => u.id);
  battle.cursor = 0;
}

test('each of five wonders has its own reachable lair, entrance and correctly aged local pair', () => {
  assert.equal(quarryFamilies.length, 5);
  const layouts = new Set(), omens = new Set();
  for (const [panel, s] of quarryFamilies.entries()) {
    const encounter = hunt(s), pair = encounterOpponents(encounter, () => .7);
    assert.equal(pair.length, 2);
    assert.equal(pair[0].speciesId, s.id);
    assert.equal(pair[0].level, encounter.level);
    assert.equal(SPECIES[pair[1].speciesId].region, s.region);
    assert.ok(!SPECIES[pair[1].speciesId].hyperRare);
    const allies = [0,1,2,3].map(id => makeMember(id, 16));
    const b = createBattle(encounter, allies, pair);
    assert.equal(b.lair.panel, panel);
    assert.equal(b.log[0], b.lair.omen);
    assert.equal(b.lair.terrain.length, 5);
    assert.ok(b.lair.terrain.every(row => row.length === 7));
    const ground = b.lair.terrain.join('');
    layouts.add(ground.replace(/[A-D12]/g,'.'));
    omens.add(b.lair.omen);
    for (const [i,unit] of b.units.entries()) assert.equal(ground[unit.key], 'ABCD12'[i]);
    const scout = b.units[0];
    scout.stats.move = b.tiles.length;
    b.units = [scout];
    assert.equal(reachable(b,scout).size, b.tiles.filter(t => t !== 'rock').length);
    for (const wrong of [{...encounter,kind:'tribe'}, {...encounter,habitatId:'hollow'}, {...encounter,leadSpeciesId:0}]) {
      assert.equal(createBattle(wrong, allies, pair).lair, undefined);
    }
    const young = encounterOpponents(hunt(s,true), () => .7);
    assert.deepEqual(young.map(m => m.level), [3,encounter.level]);
    assert.equal(young[0].speciesId, s.id);
  }
  assert.equal(layouts.size, 5);
  assert.equal(omens.size, 5);
});

test('every captured youngling keeps level three and earns all three evolutions', () => {
  for (const s of quarryFamilies) {
    const encounter = hunt(s,true), pair = encounterOpponents(encounter,() => .5);
    let roll = .99;
    const b = createBattle(encounter,[makeMember(3,32)],pair,() => roll);
    const [ally,lead,escort] = b.units;
    playerTurn(b); ally.key = lead.key - 1;
    const base = previewAction(b,'capture',lead.key).chance;
    lead.hp = Math.floor(lead.hp * .4);
    const weak = previewAction(b,'capture',lead.key).chance;
    lead.status.slow = 1;
    const forecast = previewAction(b,'capture',lead.key).chance;
    assert.ok(base > 0 && base < weak && weak < forecast && forecast < 1);
    roll = forecast;
    assert.ok(attemptCapture(b,lead));
    assert.ok(!lead.caught);
    assert.equal(takeBattleEvents(b)[0].chance,forecast);
    playerTurn(b); roll = forecast - .0001;
    assert.ok(attemptCapture(b,lead));
    assert.ok(lead.caught);
    assert.equal(b.result, null);
    playerTurn(b); ally.key = escort.key - 1;
    escort.hp = 1;
    assert.ok(useAbility(b,0,escort));
    assert.equal(b.result,'won');
    const state = newJournal(), member = addCapture(state,lead.member);
    assert.equal(member.level,3);
    const forms = [getForm(member).name];
    for (const level of EVOLUTION_LEVELS) {
      while (member.level < level) awardXP(state,xpToNext(member.level)-member.xp,[member.uid]);
      forms.push(getForm(member).name);
    }
    assert.deepEqual(forms,s.forms);
  }
});

test('adult capture readouts preserve sub-two-percent odds and a failed throw permits retreat', () => {
  for (const s of quarryFamilies) {
    const encounter = hunt(s), pair = encounterOpponents(encounter, () => .5);
    const b = createBattle(encounter,[makeMember(0,25)],pair,() => .99);
    const [ally,lead] = b.units;
    playerTurn(b); ally.key = lead.key - 1;
    const {chance} = previewAction(b,'capture',lead.key);
    assert.ok(chance < .02 && chance > 0);
    const printed = capturePercent(chance);
    assert.equal(printed, (chance*100).toFixed(2));
    assert.ok(attemptCapture(b,lead));
    assert.ok(b.log.some(line => line.includes(printed+'% chance')));
    assert.ok(!lead.caught);
    assert.ok(retreatBattle(b));
    assert.equal(b.result,'fled');
    assert.ok(!attemptCapture(b,lead));
  }
});
