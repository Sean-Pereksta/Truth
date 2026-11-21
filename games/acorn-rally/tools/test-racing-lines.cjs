const assert = require('node:assert/strict');
const sim = require('../race-sim.js');
const ramps = require('../ramps.js');

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

function testForkClearance(trackIndex) {
  const course = sim.track(trackIndex);
  const [ramp] = ramps.list(course);
  const pad = course.boostPad;
  const main = Array.from({ length: course.length * 2 }, (_, i) => sim.sample(course, i / 2));
  const deckGap = high => main.reduce((gap, low) =>
    Math.min(gap, Math.hypot(high.x - low.x, high.z - low.z) - high.w - low.w), Infinity);

  if (pad) assert.ok(pad.s - pad.halfLength > ramp.endS, 'The pad starts beyond the trestle landing');
  else assert.ok(course.branchA > course.bridgeS + .032, 'The fork starts past the main bridge rails');
  for (let s = course.branchA * course.length; s < course.branchB * course.length; s += .5) {
    const high = sim.sample(course, s, 0, true);
    const low = sim.sample(course, s);
    const gap = deckGap(high);
    const forkProgress = (high.u - course.branchA) / (course.branchB - course.branchA);
    if (ramp && s >= ramp.startS && s <= ramp.endS) assert.ok(gap > 1, 'The ramp clears the stone road');
    if (!ramp && forkProgress >= .3 && forkProgress <= .7) assert.ok(gap > 2.5, 'Bamboo’s catwalk clears the main road');
    if (gap < 0) assert.ok(Math.abs(high.y - low.y) < .01, 'Overlapping junctions stay level');
    if (pad && Math.abs(s - pad.s) <= pad.halfLength) {
      assert.ok(gap > .5 && high.w > pad.halfWidth, 'The pad fits on the separate high road');
    }
  }
}

function testForkDrive(trackIndex) {
  const course = sim.track(trackIndex);
  const [ramp] = ramps.list(course);
  for (const high of [false, true]) {
    const race = sim.create({ trackIndex, mode: 'trial', seed: 17 });
    const kart = race.racers[0];
    Object.assign(race, { countdown: 0, time: 4 });
    Object.assign(kart, { s: course.branchA * course.length - 12, v: 15, x: high ? 2 : 0 });
    let switches = 0;
    let boosts = 0;
    const exit = course.branchB * course.length + 5;
    for (let i = 0; i < 1500 && kart.s < exit; i++) {
      const before = sim.wheelPosition(course, kart, race);
      const alreadyBoosting = kart.boostStyle === 'pad';
      const target = high && before.u < course.branchA ? 2.4 : 0;
      const steer = clamp((target - kart.x) * .5 - kart.vx * .12 + before.curve * kart.v ** 2 * .047, -1, 1);
      sim.step(race, tick, { 0: { gas: 1, steer } });
      assert.ok(!kart.fall, 'The chosen route stays drivable through the merge');
      if (kart.boostStyle === 'pad' && !alreadyBoosting) boosts++;
      if (before.branch !== kart.branch) {
        const after = sim.wheelPosition(course, kart, race);
        switches++;
        assert.ok(Math.hypot(after.x - before.x, after.contactY - before.contactY, after.z - before.z) < .85);
      }
    }
    assert.ok(kart.s >= exit);
    assert.equal(switches, high ? 2 : 0);
    assert.equal(kart.landedRamp, high && ramp ? ramp.id : '');
    assert.equal(boosts, high && course.boostPad ? 1 : 0);
  }
}

function testCanopyPadOnLaterLap() {
  const course = sim.track(6);
  const pad = course.boostPad;
  for (const [x, air, boosted] of [[0, 0, true], [0, .5, false], [pad.halfWidth + .5, 0, false]]) {
    const race = sim.create({ trackIndex: 6, mode: 'trial' });
    const kart = race.racers[0];
    race.countdown = 0;
    Object.assign(kart, { s: course.length + pad.s - pad.halfLength - .5, branch: true, x, air, v: 15, lapTimes: [55] });
    for (let i = 0; i < 12; i++) sim.step(race, tick, { 0: { gas: 1 } });
    assert.equal(kart.boostStyle === 'pad', boosted);
    if (boosted) assert.ok(kart.boost < 1.05, 'Driving across the pad does not refresh it each frame');
  }
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
for (const id of [1, 6]) {
  testForkClearance(id);
  testForkDrive(id);
}
testCanopyPadOnLaterLap();
for (const [id, cc] of [[0, 100], [3, 150]]) {
  const hard = playerLeadAtFinish(id, cc, 'hard');
  const ultimate = playerLeadAtFinish(id, cc, 'ultimate');
  assert.ok(hard < .06, sim.track(id).name + ' Hard rivals dropped off the pace');
  assert.ok(ultimate < hard, sim.track(id).name + ' Ultimate rivals should challenge this driver more than Hard');
}
console.log('Route transfers, Bamboo and Cloudfall fork clearance, the Cloudfall boost pad, and four rival benchmarks passed.');
