const assert = require('node:assert/strict');
const sim = require('../race-sim.js');

const tick = 1 / 60;
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

// Begin steering after both roads have visibly diverged, approaching from either side.
function testLateEntry(trackIndex, fromBranch) {
  const course = sim.track(trackIndex);
  const race = sim.create({ trackIndex, mode: 'trial', cc: 100, seed: 17 });
  const kart = race.racers[0];
  race.countdown = 0;
  race.time = 4;
  kart.s = (course.branchA + .15 * (course.branchB - course.branchA)) * course.length;
  kart.lastValid = kart.safeS = kart.s;
  kart.branch = fromBranch;
  kart.x = fromBranch ? -1.7 : 1.7;
  kart.v = 15;

  let switches = 0;
  for (let i = 0; i < 48; i++) {
    const previous = sim.wheelPosition(course, kart, race);
    const steer = switches ? clamp(-kart.x * .5 - kart.vx * .15, -1, 1) : (fromBranch ? -1 : 1);
    sim.step(race, tick, { 0: { gas: 1, steer } });
    assert.ok(!kart.fall, course.name + ' lost a supported kart');
    if (previous.branch !== kart.branch) {
      switches++;
      const next = sim.wheelPosition(course, kart, race);
      const moved = Math.hypot(next.x - previous.x, next.contactY - previous.contactY, next.z - previous.z);
      assert.ok(moved < .85, course.name + ' teleported across the fork');
    }
  }
  assert.equal(switches, 1, course.name + ' failed to transfer cleanly');
  assert.equal(kart.branch, !fromBranch);
}

// This reference driver uses the same throttle, steering, drift and item inputs as a player.
function playerInput(race, kart, course) {
  const here = sim.sample(course, kart.s, 0, kart.branch);
  const ahead = sim.sample(course, kart.s + Math.max(4, kart.v * .38), 0, kart.branch);
  const atFork = !kart.branch && here.u >= course.branchA - .035 && here.u < course.branchA;
  const lane = atFork ? 2.55 : clamp(-ahead.curve * 40, -1.55, 1.55) + 1.15 * Math.sin(race.time * 1.9);
  const bend = .65 * here.curve + .35 * ahead.curve;
  return {
    gas: 1,
    steer: clamp((lane - kart.x) * .47 - kart.vx * .05 + bend * kart.v ** 2 * .035, -1, 1),
    drift: kart.v > 8 && kart.drift < .71,
    item: kart.item >= 0 && kart.reveal <= 0 && !kart.prevItem,
    ability: kart.meter >= .998 && !kart.prevAbility
  };
}

function playerLeadAtFinish(trackIndex, cc, difficulty) {
  const course = sim.track(trackIndex);
  const race = sim.create({ trackIndex, cc, difficulty, mode: 'cup', laps: 3, gridSize: 8, driverIndex: 5, seed: 4439 });
  const [player, ...bots] = race.racers;
  race.countdown = 0;
  let input;
  for (let i = 0; i < 300 / tick; i++) {
    if (i % 6 === 0) input = playerInput(race, player, course);
    sim.step(race, tick, { 0: input });
    if (race.racers.some(r => r.finish)) return (player.s - Math.max(...bots.map(r => r.s))) / course.length;
  }
  assert.fail(course.name + ' did not finish');
}

for (const id of [1, 9, 12]) {
  testLateEntry(id, false);
  testLateEntry(id, true);
}
for (const [id, cc] of [[0, 100], [3, 150]]) {
  const hard = playerLeadAtFinish(id, cc, 'hard');
  const ultimate = playerLeadAtFinish(id, cc, 'ultimate');
  assert.ok(hard < .06, sim.track(id).name + ' Hard rivals dropped off the pace');
  assert.ok(ultimate < hard, sim.track(id).name + ' Ultimate rivals should challenge this driver more than Hard');
}
console.log('Six late route transfers and four three-lap rival benchmarks passed.');
