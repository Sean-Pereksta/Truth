import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFINITIES, BUFFS, REGIONS, makeMember, SPECIES } from '../catalog.js';
import {
  createBattle, previewAction, takeBattleEvents, reachable, hexDistance, moveUnit,
  useAbility, guard, attemptCapture, retreatBattle, canWait, waitTurn, planEnemyTurn
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
  for (const {id: region} of REGIONS) {
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

test('typed attack previews and events multiply exact damage for effectiveness and resistance', () => {
  for (const [affinity, multiplier, modifier] of [
    [AFFINITIES.forest.strongAgainst[0], 1.5, 'effective'],
    ['forest', .65, 'resisted']
  ]) {
    const species = SPECIES.find(family => family.affinity === affinity);
    const b = arena([0], [species.id]);
    const [actor, foe] = b.units;
    first(b, actor);
    actor.key = 14;
    foe.key = 15;
    const signature = actor.abilities.findIndex(skill => skill.id === 'signature');
    const skill = actor.abilities[signature];
    const base = Math.max(3, actor.stats.attack * skill.power - foe.stats.defense * .42);
    const forecast = previewAction(b, signature, foe.key);
    assert.deepEqual(forecast.modifiers, [modifier]);
    assert.equal(forecast.amount, Math.round(base * multiplier));
    assert.deepEqual(previewAction(b, 0, foe.key).modifiers, []);
    assert.ok(useAbility(b, signature, foe));
    const [event] = takeBattleEvents(b);
    assert.equal(event.affinity, 'forest');
    assert.equal(event.hpAfter, foe.hp);
    assert.deepEqual(event.modifiers, [modifier]);
  }
});

test('area regeneration forecasts recipients and its evolved duration, then ticks once at turn end', () => {
  const b = createBattle({ region: 0 }, [makeMember(6, 20), member(1), member(2), member(3)], [member(0)]);
  b.tiles.fill('plain');
  b.order = b.units.map(unit => unit.id);
  const [caster, target, nearby, distant, foe] = b.units;
  [caster.key, target.key, nearby.key, distant.key, foe.key] = [14, 15, 16, 34, 20];
  for (const unit of [target, nearby, distant]) unit.hp -= 30;
  const index = caster.abilities.findIndex(skill => skill.id === 'apex');
  const initialHp = target.hp;
  const forecast = previewAction(b, index, target.key);
  assert.deepEqual(forecast.recipients.map(unit => unit.id), [target.id, nearby.id]);
  assert.equal(forecast.duration, 3);
  assert.equal(previewAction(b, index, foe.key), null);
  assert.ok(useAbility(b, index, target));
  assert.equal(target.status.regen, 3);
  assert.equal(nearby.status.regen, 3);
  assert.equal(distant.status.regen, undefined);
  assert.equal(target.hp, initialHp);
  const [event] = takeBattleEvents(b);
  assert.deepEqual(event.recipients, forecast.recipients);
  assert.equal(event.type, 'support');
  assert.equal(active(b), target);
  assert.ok(waitTurn(b));
  while (active(b) !== target) guard(b);
  assert.equal(target.hp, initialHp);
  assert.equal(target.status.regen, 3);
  guard(b);
  const ticks = takeBattleEvents(b).filter(e => e.type === 'heal' && e.targetId === target.id);
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].amount, Math.round(target.stats.maxHp * BUFFS.regen.amount));
  assert.equal(target.hp, initialHp + ticks[0].amount);
  assert.equal(target.status.regen, 2);
});

test('self-cast haste lasts through two turns and adds reachable hexes', () => {
  const b = arena([8], [1]);
  const [actor, foe] = b.units;
  first(b, actor);
  [actor.key, foe.key] = [14, 20];
  const normal = Math.max(...reachable(b, actor).values());
  const index = actor.abilities.findIndex(skill => skill.buff === 'haste');
  assert.ok(useAbility(b, index, actor));
  assert.equal(actor.status.haste, 2);
  assert.equal(Math.max(...reachable(b, actor).values()), normal + 1);
  for (let i = 1; i >= 0; i--) {
    assert.equal(active(b), foe);
    guard(b);
    assert.equal(active(b), actor);
    guard(b);
    assert.equal(actor.status.haste ?? 0, i);
  }
  assert.ok(takeBattleEvents(b).some(e => e.type === 'status' && e.effect === 'haste' && e.phase === 'expire'));
});

test('might and ward stack with attack affinity and cleanse only removes harmful effects', () => {
  const b = arena([0, 27], [1]);
  const [striker, caster, foe] = b.units;
  [striker.key, caster.key, foe.key] = [14, 8, 15];
  first(b, striker);
  const attack = striker.abilities.findIndex(skill => skill.id === 'signature');
  striker.status.power = 1;
  foe.status.ward = 2;
  const skill = striker.abilities[attack];
  let forecast = previewAction(b, attack, foe.key);
  assert.deepEqual(forecast.modifiers, ['resisted', 'power', 'ward', 'flank']);
  assert.equal(forecast.amount, Math.round(Math.max(3, striker.stats.attack * skill.power - foe.stats.defense * .42) *
    .65 * (1 + BUFFS.power.amount) * (1 - BUFFS.ward.amount) * 1.2));
  const captureWithWard = previewAction(b, 'capture', foe.key).chance;
  foe.status.slow = 1;
  assert.ok(previewAction(b, 'capture', foe.key).chance > captureWithWard);
  delete foe.status.slow;
  delete foe.status.ward;
  assert.equal(previewAction(b, 'capture', foe.key).chance, captureWithWard);

  striker.status.slow = 1;
  striker.status.stun = 1;
  first(b, caster);
  const cleanse = caster.abilities.findIndex(skill => skill.buff === 'cleanse');
  forecast = previewAction(b, cleanse, striker.key);
  assert.deepEqual(forecast.recipients[0].removed, ['slow', 'stun']);
  assert.ok(useAbility(b, cleanse, striker));
  assert.deepEqual(striker.status, { power: 1 });
});

test('enemy tactics choose useful area buffs and switch attacks against resistant targets', () => {
  const charge = arena([3], [41, 5, 0]);
  const [defender, commander, firstAlly, secondAlly] = charge.units;
  first(charge, commander);
  [defender.key, commander.key, firstAlly.key, secondAlly.key] = [20, 14, 15, 16];
  const boost = planEnemyTurn(charge);
  assert.equal(commander.abilities[boost.i].buff, 'power');
  if (boost.key !== commander.key) assert.ok(moveUnit(charge, boost.key));
  assert.ok(previewAction(charge, boost.i, boost.target.key).recipients.length > 1);
  assert.ok(useAbility(charge, boost.i, boost.target));

  for (const [defenderId, expectedAbility] of [[7, 'signature'], [1, 'strike']]) {
    const b = arena([defenderId], [0]);
    const [opponent, attacker] = b.units;
    first(b, attacker);
    [opponent.key, attacker.key] = [14, 15];
    const plan = planEnemyTurn(b);
    assert.equal(attacker.abilities[plan.i].id, expectedAbility);
  }
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
