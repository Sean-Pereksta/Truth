'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { create } = require('../online-motion.js');

const sim = { isFrozen: (state, racer) => (racer.freezeUntil || 0) > state.time };
const kart = (seat, s, props = {}) => ({ seat, s, x: 0, v: 30, branch: false, yaw: 0, ...props });
function sample(tick, receivedAt, props) {
  return { tick, receivedAt, state: { countdown: 0, time: tick / 60,
    racers: [kart(0, 15), kart(1, tick / 2, props)] } };
}

test('other karts keep moving between irregular updates without changing input or race state', () => {
  const timeline = create(sim);
  const arrivals = [[0, 0], [3, 50], [6, 126], [9, 129], [12, 205], [15, 270]];
  const history = [];
  let next = 0;
  const positions = [];
  for (let now = 50; now <= 330; now += 10) {
    while (arrivals[next]?.[1] <= now) history.push(sample(...arrivals[next++]));
    const latest = history.at(-1).state;
    latest.racers[1].item = 4;
    const rendered = timeline.view(latest, 0, history, now);
    assert.equal(rendered.racers[0], latest.racers[0]);
    assert.equal(rendered.racers[1].item, 4);
    assert.equal(latest.racers[1].s, history.at(-1).tick / 2);
    positions.push(rendered.racers[1].s);
  }
  assert.ok(positions.every((s, index) => index === 0 || s >= positions[index - 1]));
  assert.ok(positions[6] > positions[5], 'kart moves between packets');
  assert.ok(positions.at(-1) < 9.01, 'extrapolation is limited to three ticks');
});

test('playback holds during a long gap and resumes from ordered snapshots', () => {
  const timeline = create(sim);
  const history = [sample(0, 0), sample(3, 50), sample(6, 100), sample(9, 150)];
  let shown;
  for (let now = 150; now <= 800; now += 10) shown = timeline.view(history.at(-1).state, 0, history, now);
  assert.equal(shown.racers[1].s, 6);
  const held = timeline.view(history.at(-1).state, 0, history, 1500);
  assert.equal(held.racers[1].s, 6);
  history.push(sample(12, 1500), sample(15, 1500));
  const recovered = timeline.view(history.at(-1).state, 0, history, 1516);
  assert.ok(recovered.racers[1].s >= 6 && recovered.racers[1].s < 7);
});

test('falls, freezes, route changes and large teleports use authoritative poses', () => {
  for (const variation of [{ fall: {} }, { freezeUntil: 9 }, { branch: true }, { flight: {} }, { s: 100 }]) {
    const history = [sample(0, 0), sample(3, 50), sample(6, 100)];
    const state = { ...history.at(-1).state, racers: [kart(0, 15), kart(1, 3, variation)] };
    assert.equal(create(sim).view(state, 0, history, 100), state);
  }
  const jumped = [sample(0, 0), sample(3, 50, { s: 100 }), sample(6, 100, { s: 102 })];
  assert.equal(create(sim).view(jumped.at(-1).state, 0, jumped, 100), jumped.at(-1).state);
});
