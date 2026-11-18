'use strict';

const assert = require('node:assert/strict');
const sim = require('../race-sim.js');
const HAWK = 7;
const tick = 1 / 60;
const pass = [];

function race(trackIndex, { cc = 100, s, x = 0, branch = false, laps = 3, gridSize = 8 } = {}) {
  const course = sim.track(trackIndex);
  const state = sim.create({ trackIndex, cc, laps, players: gridSize, gridSize, seed: 0xACE110 });
  const driver = state.racers[0];
  const progress = s ?? course.length * .18;
  state.countdown = 0;
  state.pickups.length = 0;
  state.racers.forEach((kart, i) => {
    kart.s = progress + (i ? course.length * .22 + i * 6 : 0);
    kart.x = 0;
    kart.v = 0;
    kart.rank = i ? i : state.racers.length;
    kart.safeS = kart.s;
    kart.lastValid = kart.s;
    kart.lapTimes = Array.from({ length: Math.floor(kart.s / course.length) }, () => 50);
    kart.splitTime = kart.lapTimes.length * 50;
  });
  state.time = Math.max(...state.racers.map(kart => kart.splitTime)) + 5;
  Object.assign(driver, { x, branch, v: 14, item: HAWK });
  return { course, state, driver };
}

function ride(fixture, onTick = () => {}) {
  const { course, state, driver } = fixture;
  const start = driver.s;
  const phases = new Set();
  let leftGround = false;
  let minCarrySpeed = Infinity;
  let peakHeight = -Infinity;
  for (let i = 0; i < 900; i += 1) {
    const priorS = driver.s;
    const prior = sim.sample(course, driver.s, driver.x, driver.branch);
    sim.step(state, tick, { 0: { item: i === 0, gas: 1, steer: 1, drift: true } });
    const now = sim.sample(course, driver.s, driver.x, driver.branch);
    assert.ok(Number.isFinite(driver.s) && Number.isFinite(driver.v), `${course.name} finite Hawk motion`);
    assert.ok(driver.s >= priorS - .08, `${course.name} Hawk went backward`);
    assert.ok(driver.s - priorS <= 4, `${course.name} position snapped forward at tick ${i}`);
    assert.ok(Math.hypot(now.x - prior.x, now.z - prior.z) <= 4.5, `${course.name} world position snapped at tick ${i}`);
    assert.ok(!driver.fall, `${course.name} fell during Hawk carry`);
    if (driver.hawkPhase) {
      phases.add(driver.hawkPhase);
      peakHeight = Math.max(peakHeight, sim.lift(state, driver));
      if (driver.hawkPhase === 'carry') minCarrySpeed = Math.min(minCarrySpeed, driver.v);
      leftGround = true;
    }
    onTick({ i, phases, state, driver });
    if ((leftGround && !driver.hawkPhase) || (state.done && !driver.hawkPhase)) {
      return { start, distance: driver.s - start, phases, minCarrySpeed, peakHeight };
    }
  }
  assert.fail(`${course.name} Hawk never completed (${[...phases]})`);
}

function verifyRolls() {
  assert.equal(sim.items[HAWK], 'Hawk');
  for (const cc of sim.engineClasses) {
    const { state } = race(0, { cc });
    const driver = state.racers[0];
    for (let rank = 1; rank <= 8; rank += 1) {
      driver.rank = rank;
      const weights = sim.rollWeights(state, driver);
      assert.ok(Math.abs(weights.reduce((total, weight) => total + weight, 0) - 100) < 1e-8);
      assert.equal(weights[HAWK] || 0, rank === 8 ? 50 : 0, `${cc} cc rank ${rank}`);
    }
  }
  const { state, driver } = race(0, { gridSize: 7 });
  assert.equal(sim.rollWeights(state, driver)[HAWK] || 0, 0, '7-player last place cannot draw Hawk');
  for (const [rank, seed, expected] of [[8, 0, false], [8, 1000, true], [7, 1000, false]]) {
    const pickupRace = race(0);
    const kart = pickupRace.driver;
    kart.item = -1;
    kart.rank = rank;
    if (rank === 7) {
      const behind = pickupRace.state.racers[7];
      behind.s = kart.s - 20;
      behind.rank = 8;
    }
    pickupRace.state.seed = seed;
    pickupRace.state.pickups.push({ s: kart.s, x: kart.x, cooldown: 0 });
    sim.step(pickupRace.state, tick);
    assert.ok(kart.item >= 0, `rank ${rank} should draw an item from an acorn`);
    assert.equal(kart.item === HAWK, expected, `rank ${rank} acorn draw for seed ${seed}`);
  }
  pass.push('8th-place-only 50% distribution across all engine classes');
}

function verifyAllCourses() {
  for (let trackIndex = 0; trackIndex < sim.trackCount; trackIndex += 1) {
    const course = sim.track(trackIndex);
    for (const cc of [50, 200]) {
      const fixture = race(trackIndex, { cc, s: course.length * .79, x: 2.7 });
      const carried = ride(fixture);
      assert.ok(carried.peakHeight > .25, `${course.name} ${cc} cc Hawk should lift the kart`);
      assert.ok(carried.phases.has('carry'), `${course.name} missing carry phase`);
      assert.ok(Math.abs(carried.distance / course.length - .15) < .008, `${course.name} ${cc} cc moved ${carried.distance}`);
      assert.ok(Math.abs(fixture.driver.x) < .18, `${course.name} returned off center`);
      assert.ok(carried.minCarrySpeed > fixture.driver.v * 1.6, `${course.name} did not reach rocket speed`);
      assert.ok(fixture.driver.v > 17 * (cc === 50 ? .76 : 1.43), `${course.name} landed below racing speed`);
      assert.equal(fixture.driver.item, -1, `${course.name} Hawk was not consumed`);
    }
    const branch = race(trackIndex, { s: course.length * (course.branchA * .58 + course.branchB * .42), branch: true });
    const carried = ride(branch);
    assert.ok(Math.abs(carried.distance / course.length - .15) < .008, `${course.name} fork carry lost track progress`);
    assert.ok(Math.abs(branch.driver.x) < .18, `${course.name} fork landing was off center`);
  }
  pass.push(`${sim.trackCount} courses at 50 and 200 cc, plus fork entry on every course`);
}

function verifyLapAndFinish() {
  const course = sim.track(0);
  const nextLap = race(0, { s: course.length * .93 });
  ride(nextLap);
  assert.equal(nextLap.driver.lapTimes.length, 1, 'carry should count exactly one lap at start/finish');
  assert.equal(nextLap.driver.finish, 0, 'first crossing should not finish a three-lap race');
  const finish = race(0, { s: course.length * .93, laps: 1, gridSize: 1 });
  ride(finish);
  assert.equal(finish.driver.lapTimes.length, 1, 'finish should count the last lap once');
  assert.ok(finish.driver.finish > 0 && finish.state.done, 'Hawk should permit a proper race finish');
  assert.ok(Math.abs(finish.driver.s - course.length) < 3.3, 'Hawk should end at the finish line');
  pass.push('start/finish crossing and final-lap classification');
}

function verifyImpact() {
  const fixture = race(0);
  const { course, state, driver } = fixture;
  const [hit, safe] = state.racers.slice(1, 3);
  Object.assign(hit, { s: driver.s + course.length * .037, x: .15, v: 12 });
  Object.assign(safe, { s: hit.s + 8, x: 5, v: 10 });
  let impact;
  let hitSeq = 0;
  ride(fixture, () => {
    if (driver.confirmSeq !== hitSeq) {
      hitSeq = driver.confirmSeq;
      if (driver.confirmedName === hit.name && !impact) impact = { speed: hit.v, kick: Math.abs(hit.vx) };
    }
  });
  assert.ok(impact, 'Hawk should hit a rival in the sweep lane');
  assert.ok(impact.speed < 10, `Hawk impact only slowed the rival to ${impact.speed}`);
  assert.ok(impact.kick > 1, `Hawk impact only applied ${impact.kick} lateral velocity`);
  assert.equal(hitSeq, 1, 'Hawk should not strike the same kart twice or catch a distant lane');
  assert.equal(safe.itemHitKind, -1, 'Hawk should miss karts far outside the sweep lane');
  pass.push('single swept impact with slowdown and lateral shove');
}

function verifySnapshotPrediction() {
  const { course, state, driver } = race(0, { x: 2.5 });
  sim.step(state, tick, { 0: { item: true } });
  const phases = new Set();
  while (driver.hawkPhase && phases.size < 3) {
    if (phases.has(driver.hawkPhase)) {
      sim.step(state, tick);
      continue;
    }
    phases.add(driver.hawkPhase);
    const remote = JSON.parse(JSON.stringify(state));
    const predicted = remote.racers[0];
    sim.predictHawk(remote, predicted, course, tick);
    sim.step(state, tick);
    for (const field of ['s', 'x', 'v', 'airZ', 'hawkPhaseT']) {
      assert.ok(Math.abs(predicted[field] - driver[field]) < 1e-7, `snapshot prediction drifted on ${field}`);
    }
    assert.equal(predicted.hawkPhase, driver.hawkPhase);
  }
  assert.deepEqual([...phases], ['swoop', 'carry', 'release']);
  pass.push('private-room snapshot prediction follows all three Hawk phases');
}

verifyRolls();
verifyAllCourses();
verifyLapAndFinish();
verifyImpact();
verifySnapshotPrediction();
for (const check of pass) console.log(`PASS ${check}`);
