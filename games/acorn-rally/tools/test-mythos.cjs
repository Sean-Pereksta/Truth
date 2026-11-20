const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const sim = require('../race-sim.js');
const ramps = require('../ramps.js');

const championshipScript = readFileSync(path.join(__dirname, '../championship.js'), 'utf8');
function loadChampionship(saved = new Map()) {
  const page = vm.createContext({
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  });
  vm.runInContext(championshipScript, page);
  return page.AcornChampionship;
}

function driveToLanding(race, course, pad) {
  const kart = race.racers[0];
  for (let frame = 0; frame < 360 && !kart.landingSeq && !kart.fall; frame++) {
    const road = sim.sample(course, kart.s, 0, kart.branch);
    const steer = (pad.lane - kart.x) * .7 - kart.vx * .16 + road.curve * kart.v ** 2 * .43 / 8.85;
    sim.step(race, 1 / 60, { 0: { gas: 1, steer: Math.max(-1, Math.min(1, steer)) } });
  }
  assert.equal(kart.landedRamp, pad.id, pad.id + ' did not land on its platform');
  assert.equal(kart.fall, null);
}

test('Mythos springboards cross open gaps at every engine class and recover missed launches on lap two', () => {
  const mythos = loadChampionship().cups.find(cup => cup.id === 'mythos');
  assert.equal(mythos.tracks.length, 4);
  for (const index of mythos.tracks) {
    const course = sim.track(index);
    const pads = ramps.list(course).filter(pad => pad.style === 'trampoline');
    assert.ok(pads.some(pad => pad.branch) && pads.some(pad => !pad.branch), course.name);
    for (const pad of pads) {
      assert.deepEqual(ramps.solidSpans(course, pad.lipS - 1, pad.landingS + 1, pad.branch),
        [[pad.lipS - 1, pad.lipS], [pad.landingS, pad.landingS + 1]], pad.id);
      for (const cc of sim.engineClasses) {
        const race = sim.create({ trackIndex: index, mode: 'trial', cc });
        race.countdown = 0;
        Object.assign(race.racers[0], { s: pad.lipS - .2, x: pad.lane, branch: pad.branch, v: 10 + .12 * cc });
        driveToLanding(race, course, pad);
        assert.equal(race.racers[0].launchSeq, 1);
        assert.ok(race.racers[0].s >= pad.landingS);
      }
      const race = sim.create({ trackIndex: index, mode: 'trial', cc: 50 });
      const kart = race.racers[0];
      race.countdown = 0;
      Object.assign(kart, { s: course.length + pad.lipS - .01, x: pad.lane, branch: pad.branch, v: 3, lapTimes: [90] });
      sim.step(race, 1 / 60, { 0: { gas: .3 } });
      assert.ok(kart.fall, pad.id + ' allowed driving across a gap');
      for (let frame = 0; frame < 120 && kart.fall; frame++) sim.step(race, 1 / 60);
      assert.ok(kart.s > course.length && kart.s < course.length + pad.startS, pad.id + ' retry position');
      assert.equal(kart.branch, pad.branch);
      driveToLanding(race, course, pad);
    }
  }
});

test('Aurel requires distinct Ultimate wins against rivals and stays unlocked after a reload', () => {
  const saved = new Map();
  let championship = loadChampionship(saved);
  const angel = championship.angelDriver;
  const tracks = championship.cups.flatMap(cup => cup.tracks);
  const first = { position: 1, human: true, driverIndex: 0, time: 75 };
  const second = { position: 2, human: false, driverIndex: 1, time: 79 };
  const result = { trackIndex: tracks[0], mode: 'race', difficulty: 'ultimate', driverIndex: 0, standings: [first, second] };
  for (const change of [{ mode: 'trial' }, { difficulty: 'hard' }, { driverIndex: 1 }, { standings: [first] },
    { standings: [{ ...first, human: false }, { ...second, human: true }] }]) {
    championship.recordUltimate({ ...result, ...change });
    assert.equal(championship.hasUltimateWin(tracks[0]), false);
  }
  const shared = loadChampionship();
  const secondControllerWins = { ...result, driverIndex: 1,
    standings: [first, { ...second, human: true }, { ...second, position: 3, driverIndex: 2 }] };
  shared.recordUltimate(secondControllerWins, true);
  assert.ok(shared.hasUltimateWin(tracks[0]), 'the winning local seat shares the profile');
  for (let i = 0; i < tracks.length; i++) {
    const entry = { ...result, trackIndex: tracks[i], mode: ['race', 'single', 'cup'][i % 3] };
    assert.equal(championship.isDriverAvailable(angel), false);
    assert.equal(championship.recordUltimate(entry), i === tracks.length - 1);
    assert.equal(championship.recordUltimate(entry), false);
    championship = loadChampionship(saved);
    assert.ok(championship.hasUltimateWin(tracks[i]));
  }
  assert.ok(championship.isDriverAvailable(angel));
});
