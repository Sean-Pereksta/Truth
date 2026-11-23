import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, SPECIES, makeMember } from '../catalog.js';
import { ITEMS, battleSupplies, spendSupply } from '../economy.js';
import { ARENA_COURSES } from '../arena-courses.js';
import { attemptCapture, createBattle, encounterOpponents, hexDistance, previewAction, reachable, takeBattleEvents, useBattleSupply } from '../battle.js';

const active = battle => battle.units[battle.order[battle.cursor]];

test('all regional trials and wardens have distinct, connected courts and local teams', () => {
  const floors = new Set();
  const party = [0,1,2,3].map(i => makeMember(i, 6));
  for (const region of REGIONS) {
    for (const arenaId of ['trial','warden']) {
      const kind = arenaId === 'trial' ? 'arena' : 'warden';
      const encounter = {region:region.id, kind, arenaId, level:region.minLevel + 3};
      const course = ARENA_COURSES[region.id][arenaId];
      assert.equal(course.terrain.length, 5);
      assert.ok(course.terrain.every(row => row.length === 7));
      const ground = course.terrain.join('');
      const floor = ground.replace(/[A-D1-4]/g, '.');
      assert.ok(!floors.has(floor));
      floors.add(floor);
      for (const token of ['#','c','h']) assert.ok(floor.includes(token));
      const enemies = encounterOpponents(encounter);
      assert.deepEqual(enemies.map(unit => unit.speciesId), course.lineup);
      assert.equal(new Set(enemies.map(unit => unit.uid)).size, enemies.length);
      assert.ok(enemies.every(unit => SPECIES[unit.speciesId].region === region.id && !SPECIES[unit.speciesId].legendary));
      assert.ok(new Set(enemies.map(unit => SPECIES[unit.speciesId].role)).size >= 2);
      assert.equal(enemies[0].level, encounter.level);
      const battle = createBattle(encounter, party, enemies);
      assert.equal(battle.course, course);
      for (const [i, unit] of battle.units.entries()) {
        const mark = 'ABCD1234'[i];
        assert.equal(ground.indexOf(mark), ground.lastIndexOf(mark));
        assert.equal(ground[unit.key], mark);
        assert.equal(battle.tiles[unit.key], 'plain');
        assert.ok(reachable(battle, unit).size > 1);
      }
      const starts = battle.units.filter(u => u.team === 'you').flatMap(ally =>
        battle.units.filter(u => u.team === 'wild').map(foe => hexDistance(ally.key, foe.key)));
      assert.ok(Math.min(...starts) >= 3);
      // Measure static map connectivity without temporary occupants or movement caps.
      const explorer = battle.units[0];
      explorer.stats.move = battle.tiles.length;
      battle.units = [explorer];
      assert.equal(reachable(battle, explorer).size, battle.tiles.filter(t => t !== 'rock').length);
    }
  }
  assert.equal(floors.size,2 * REGIONS.length);
});

test('off-court encounters retain sanctuary and habitat leaders', () => {
  for (const species of SPECIES.filter(s => s.habitatId)) {
    const encounter = {region:species.region, kind:species.legendary ? 'legendary' : 'tribe',
      habitatId:species.habitatId, leadSpeciesId:species.id, level:8};
    const enemy = encounterOpponents(encounter, () => .34);
    assert.equal(enemy[0].speciesId, species.id);
    assert.equal(createBattle(encounter, [makeMember(0, 4)], enemy).course, undefined);
  }
  const oldSanctuary = encounterOpponents({region:1, kind:'legendary', level:7}, () => .3);
  assert.equal(oldSanctuary[0].speciesId, 13);
});

function setup(roll = () => .99) {
  const battle = createBattle({region:0, kind:'tribe'}, [makeMember(0, 6)], [makeMember(1, 1)], roll);
  battle.tiles.fill('plain');
  const [ally, foe] = battle.units;
  assert.equal(active(battle), ally);
  return {battle, ally, foe};
}

test('a purchased tonic spends only when it can actually heal and uses one turn', () => {
  const state = {economy:{bag:{tonic:1}}};
  const [tonic] = battleSupplies(state);
  const {battle, ally, foe} = setup();
  let calls = 0;
  const spend = id => { calls++; return spendSupply(state,id); };
  assert.equal(useBattleSupply(battle,tonic,ally,spend), false);
  assert.equal(useBattleSupply(battle,tonic,foe,spend), false);
  ally.hp -= 6;
  assert.equal(useBattleSupply(battle,tonic,{...ally},spend), false);
  assert.equal(calls, 0);
  const forecast = previewAction(battle,tonic,ally.key);
  assert.equal(forecast.amount, 6);
  assert.equal(forecast.hpAfter, ally.stats.maxHp);
  assert.equal(useBattleSupply(battle,tonic,ally,spend), true);
  assert.equal(ally.hp, forecast.hpAfter);
  assert.equal(active(battle), foe);
  assert.deepEqual(battleSupplies(state), []);
  assert.equal(useBattleSupply(battle,tonic,ally,spend), false);
  assert.equal(calls, 1);
  const [effect] = takeBattleEvents(battle);
  assert.equal(effect.type, 'heal');
  assert.equal(effect.supplyId, tonic.id);
  assert.equal(effect.hpAfter, forecast.hpAfter);
});

test('charms boost one exact capture roll, can fail, and leave free capture available', () => {
  for (const success of [true,false]) {
    let rolls = 0, rollAt;
    const {battle, ally, foe} = setup(() => { rolls++; return rollAt; });
    const state = {economy:{bag:{thread:1}}};
    const [thread] = battleSupplies(state);
    const spend = id => spendSupply(state,id);
    assert.equal(useBattleSupply(battle,thread,foe,spend), false); // out of range
    assert.equal(useBattleSupply(battle,thread,ally,spend), false);
    assert.equal(state.economy.bag.thread, 1);
    assert.equal(rolls, 0);
    foe.key = ally.key + 3;
    const normal = previewAction(battle,'capture',foe.key).chance;
    const forecast = previewAction(battle,thread,foe.key);
    assert.equal(forecast.chance, normal + thread.power);
    assert.equal(useBattleSupply(battle,thread,foe,() => false), false);
    assert.equal(rolls, 0);
    rollAt = success ? forecast.chance - .001 : forecast.chance;
    assert.equal(useBattleSupply(battle,thread,foe,spend), true);
    assert.equal(foe.caught, success);
    assert.equal(rolls, 1);
    assert.deepEqual(battleSupplies(state), []);
    const [effect] = takeBattleEvents(battle);
    assert.equal(effect.type, 'capture');
    assert.equal(effect.chance, forecast.chance);
    assert.equal(effect.supplyId, 'thread');
    assert.equal(effect.success, success);
    assert.equal(useBattleSupply(battle,thread,foe,spend),false);
    if (!success) {
      battle.order = [0,1]; battle.cursor = 0;
      assert.equal(useBattleSupply(battle,thread,foe,spend), false); // stale inventory
      assert.equal(rolls, 1);
      assert.equal(attemptCapture(battle,foe), true);
      assert.equal(takeBattleEvents(battle)[0].chance, normal);
    }
  }
});

test('capture charms apply after both health and status bonuses, capped at 99 percent', () => {
  const {battle, ally, foe} = setup();
  foe.key = ally.key + 1;
  const ribbon = {...ITEMS.starweave, count:1};
  const healthy = previewAction(battle,ribbon,foe.key).chance;
  foe.hp = 1;
  const weak = previewAction(battle,ribbon,foe.key).chance;
  foe.status.slow = 1;
  const withStatus = previewAction(battle,ribbon,foe.key);
  assert.ok(weak > healthy);
  assert.equal(withStatus.baseChance, previewAction(battle,'capture',foe.key).chance);
  assert.equal(withStatus.chance, .99);
  assert.equal(previewAction(battle,{...ribbon,count:0},foe.key),null);
});
