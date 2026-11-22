import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMember, SPECIES } from '../catalog.js';
import {
  createBattle, previewAction, takeBattleEvents, reachable, hexDistance, moveUnit,
  useAbility, guard, attemptCapture, retreatBattle, canWait, waitTurn
} from '../battle.js';

const member = id => makeMember(id, 12);
const active = b => b.units[b.order[b.cursor]];
function arena(party = [0], enemies = [1], region = 0, rng = () => 0) {
  const b = createBattle({ region }, party.map(member), enemies.map(member), rng);
  b.tiles.fill('plain');
  return b;
}
function first(b, actor) {
  b.order = [actor.id, ...b.order.filter(id => id !== actor.id)];
  b.cursor = 0;
}

test('movement animates only traversable neighboring hexes and keeps coordinates after turns', () => {
  const b = arena();
  const [ally, foe] = b.units;
  ally.key = 14;
  foe.key = 16;
  b.tiles[15] = 'rock';
  const distances = reachable(b);
  for (const [key, distance] of distances) {
    if (!distance) continue;
    const path = previewAction(b, 'move', key).path;
    assert.equal(path[0], 14);
    assert.equal(path.at(-1), key);
    assert.equal(path.length - 1, distance);
    assert.ok(path.every(cell => cell !== 15 && cell !== 16));
    for (let i = 1; i < path.length; i++) assert.equal(hexDistance(path[i], path[i-1]), 1);
  }
  assert.equal(previewAction(b, 'move', foe.key), null);
  assert.equal(moveUnit(b, foe.key), false);
  assert.deepEqual(takeBattleEvents(b), []);
  const preview = previewAction(b, 'move', 17);
  assert.ok(moveUnit(b, 17));
  const [action] = takeBattleEvents(b);
  assert.deepEqual(action.path, preview.path);
  assert.equal(action.from, 14);
  assert.equal(action.to, 17);
  assert.equal(action.actorId, ally.id);
  assert.deepEqual(takeBattleEvents(b), []);
  assert.equal(canWait(b), false);
});

test('ranged attack and preview agree on cover, guard, exposed and exact HP', () => {
  const b = arena([3], [1]);
  const [ally, foe] = b.units;
  first(b, ally);
  ally.key = 14;
  foe.key = 16;
  foe.guarded = true;
  foe.status.exposed = 1;
  b.tiles[16] = 'cover';
  const preview = previewAction(b, 0, foe.key);
  assert.equal(preview.style, 'ranged');
  assert.deepEqual(preview.modifiers, ['cover','guard','exposed']);
  const base = Math.max(3, ally.stats.attack - foe.stats.defense * .42);
  assert.equal(preview.amount, Math.round(base * .72 * .4 * 1.25));
  assert.ok(useAbility(b, 0, foe));
  const [event] = takeBattleEvents(b);
  assert.equal(event.type, 'attack');
  assert.equal(event.hpAfter, foe.hp);
  assert.equal(event.amount, preview.amount);
  assert.deepEqual(event.modifiers, preview.modifiers);
  assert.equal(event.skillName, ally.abilities[0].name);
  assert.ok(b.logIcons.includes('ranged'));
});

test('melee flank, status, lethal hit, faint and victory retain their action order', () => {
  const b = arena([0,1], [3]);
  const [ally, friend, foe] = b.units;
  first(b, ally);
  ally.key = 14;
  foe.key = 15;
  friend.key = 8;
  const preview = previewAction(b, 1, foe.key);
  assert.deepEqual(preview.modifiers, ['flank']);
  assert.equal(preview.effect, 'exposed');
  assert.ok(useAbility(b, 1, foe));
  const actions = takeBattleEvents(b);
  assert.equal(actions[0].style, 'melee');
  assert.equal(actions[1].type, 'status');
  assert.equal(actions[1].phase, 'apply');
  assert.equal(actions[1].targetId, foe.id);
  first(b, ally);
  foe.hp = 1;
  assert.equal(previewAction(b, 1, foe.key).effect, null);
  useAbility(b, 1, foe);
  assert.deepEqual(takeBattleEvents(b).map(e => e.type), ['attack','faint','outcome']);
  assert.equal(b.result, 'won');
  assert.equal(retreatBattle(b), false);
  assert.deepEqual(takeBattleEvents(b), []);
});

test('healing caps at full HP and shows its shared recovery', () => {
  const b = arena([2,1], [0]);
  const [medic, friend] = b.units;
  medic.stats.speed = 30;
  first(b, medic);
  assert.equal(previewAction(b, 1, friend.key), null);
  friend.hp -= 3;
  assert.equal(previewAction(b, 1, friend.key).amount, 3);
  assert.ok(useAbility(b, 1, friend));
  const [heal, lock] = takeBattleEvents(b);
  assert.equal(heal.type, 'heal');
  assert.equal(heal.amount, 3);
  assert.equal(heal.hpAfter, friend.stats.maxHp);
  assert.deepEqual([lock.type,lock.effect,lock.phase], ['recovery','heal','apply']);
  for (let i = 0; i < 2; i++) guard(b);
  assert.equal(active(b), medic);
  assert.equal(medic.recovery.heal, 1);
  friend.hp--;
  assert.equal(previewAction(b, 1, friend.key), null);
  guard(b); guard(b); guard(b);
  assert.ok(takeBattleEvents(b).some(e => e.type === 'recovery' && e.phase === 'expire' && e.effect === 'heal'));
});

test('each biome hazard preview and event use the same damage or status', () => {
  for (let region = 0; region < 8; region++) {
    const b = arena([0], [1], region);
    const [actor] = b.units;
    b.tiles[15] = 'hazard';
    const { hazard } = previewAction(b, 'move', 15);
    const startHP = actor.hp;
    moveUnit(b, 15); guard(b);
    const actions = takeBattleEvents(b);
    const event = actions.find(e => e.type === 'hazard');
    assert.equal(event.effect, hazard.effect);
    assert.equal(event.region, region);
    assert.equal(event.name, b.biome.hazard);
    assert.equal(event.hpAfter, actor.hp);
    assert.equal(event.amount, startHP - actor.hp);
    if (event.amount === 0) {
      assert.ok(actions.some(e => e.type === 'status' && e.effect === hazard.effect));
    }
  }
  const b = arena([0], [1], 5);
  b.tiles[b.units[0].key] = 'hazard';
  b.units[0].hp = 1;
  guard(b);
  assert.deepEqual(takeBattleEvents(b).map(e => e.type), ['guard','hazard','faint','outcome']);
  assert.equal(b.result, 'lost');
});

test('capture rolls once against the preview, retains target sprite identity and branches on result', () => {
  for (const success of [true,false]) {
    let rolls = 0;
    const b = arena([0], [1], 0, () => { rolls++; return success ? 0 : .999; });
    const foe = b.units[1];
    foe.key = 16;
    const preview = previewAction(b, 'capture', foe.key);
    assert.equal(rolls, 0);
    assert.ok(attemptCapture(b, foe));
    const events = takeBattleEvents(b);
    assert.equal(rolls, 1);
    assert.equal(events[0].success, success);
    assert.equal(events[0].chance, preview.chance);
    assert.equal(b.units[events[0].targetId], foe);
    assert.deepEqual(events.map(e => e.type), success ? ['capture','outcome'] : ['capture']);
    if (!success) {
      assert.ok(retreatBattle(b));
      assert.equal(takeBattleEvents(b)[0].result, 'fled');
    }
  }
});

test('Wait delays exactly one turn in this round and never doubles recovery or tile effects', () => {
  const b = arena([0,1], [3]);
  const actor = active(b);
  actor.recovery.stun = 1;
  actor.status.slow = 1;
  b.tiles[actor.key] = 'hazard';
  const initialRound = b.round;
  assert.ok(canWait(b)); assert.ok(waitTurn(b));
  assert.equal(b.order.at(-1), actor.id);
  assert.equal(b.round, initialRound);
  assert.equal(takeBattleEvents(b)[0].type, 'wait');
  guard(b); guard(b);
  assert.equal(active(b), actor);
  assert.equal(b.round, initialRound);
  assert.equal(canWait(b), false);
  assert.equal(actor.recovery.stun, 1);
  assert.equal(actor.status.slow, 1);
  assert.ok(!takeBattleEvents(b).some(e => e.type === 'hazard'));
  assert.ok(guard(b));
  assert.equal(b.round, initialRound + 1);
  const resolves = takeBattleEvents(b);
  assert.equal(resolves.filter(e => e.type === 'hazard').length, 1);
  assert.ok(resolves.some(e => e.type === 'recovery' && e.phase === 'expire'));
  assert.equal(canWait(b), true);
});

test('Wait rejects the last live slot and a waited Critter can be stunned before it acts', () => {
  const stunner = SPECIES.find(s => s.effect === 'stun');
  const b = arena([0], [stunner.id]);
  const [ally, wild] = b.units;
  first(b, ally);
  ally.key = 14;
  wild.key = 15;
  waitTurn(b);
  assert.equal(active(b), wild);
  const special = wild.abilities.findIndex(a => a.status === 'stun');
  assert.ok(useAbility(b, special, ally));
  assert.equal(b.round, 2);
  const events = takeBattleEvents(b);
  assert.ok(events.some(e => e.type === 'status' && e.phase === 'skip' && e.targetId === ally.id));
  assert.equal(ally.status.stun, undefined);
  const tail = arena([0],[1]);
  guard(tail);
  assert.equal(canWait(tail), false);
  assert.equal(waitTurn(tail), false);
});
