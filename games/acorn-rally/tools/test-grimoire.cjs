const assert = require('node:assert/strict');
const test = require('node:test');
const sim = require('../race-sim.js');
const fs = require('node:fs');
const vm = require('node:vm');

const tick = 1 / 60;
const wolf = sim.drivers.indexOf('Grimoire the Vile');

test('only a competitive Ultimate first on Realm of Darkness unlocks Grimoire, including after reload', () => {
  const state = new Map();
  const source = fs.readFileSync(require.resolve('../championship.js'), 'utf8');
  function load() {
    const root = {localStorage: {getItem: k => state.get(k) ?? null, setItem: (k,v) => state.set(k,v)}};
    vm.runInNewContext(source, root);
    return root.AcornChampionship;
  }
  const game = load();
  const first = {position:1, human:true, driverIndex:0, time:82};
  const rival = {position:2, human:false, driverIndex:1, time:84};
  const win = {trackIndex:game.darknessCircuit, difficulty:'ultimate', mode:'race', driverIndex:0, standings:[first,rival]};
  for (const change of [{difficulty:'hard'}, {mode:'trial'}, {trackIndex:19}, {standings:[first]}, {driverIndex:2}]) {
    game.recordUltimate({...win,...change});
    assert.equal(game.isDriverAvailable(wolf), false);
  }
  assert.equal(game.recordUltimate(win), true);
  assert.equal(game.recordUltimate(win), false);
  assert.equal(load().isDriverAvailable(wolf), true);
  assert.equal(load().isDriverAvailable(game.angelDriver), false);
});

function race(cc = 100) {
  const st = sim.create({ trackIndex: 4, cc, gridSize: 2, humanSeats: [0, 1], driverIndices: [wolf, 0] });
  st.countdown = 0;
  st.pickups = [];
  Object.assign(st.racers[0], { s: 52, x: 0, v: 14, meter: 1 });
  Object.assign(st.racers[1], { s: 55.2, x: 0, v: 14 });
  return st;
}
function drive(st, ability = false, steer = 0) {
  sim.step(st, tick, [{ gas: 1, steer, ability }, { gas: 1 }]);
}

test('Gravehook swings behind to ahead on the chosen side, with a small shove and no rival stun', () => {
  for (const cc of sim.engineClasses) {
    for (const side of [-1, 1]) {
      const st = race(cc), control = race(cc);
      const [r, rival] = st.racers;
      let flank = 0, push = 0;
      for (let frame = 0; frame < 95; frame++) {
        drive(st, frame === 0, frame === 0 ? side : 0);
        drive(control, false, frame === 0 ? side : 0);
        if (frame === 0) assert.equal(r.signature.stage, 'latched');
        if (r.signature.stage === 'release') break;
        flank = Math.max(flank, side * (r.x - rival.x));
        push = Math.max(push, Math.abs(rival.x - control.racers[1].x));
        assert.equal(rival.slow, 0);
        assert.equal(rival.spin, 0);
      }
      assert.equal(r.signature.stage, 'release');
      assert.ok(r.s > rival.s + 2 && flank > 2.5);
      assert.ok(push > .05 && push < .6 && Math.abs(rival.v - control.racers[1].v) < .45);
    }
  }
});

test('a distant, protected or different-route rival cannot spend the charge; a shield can break the latch', () => {
  for (const patch of [{ s: 78 }, { branch: true }, { ghost: 1 }, { protect: 1 }, { freezeUntil: 3 }]) {
    const st = race(), [r, rival] = st.racers;
    Object.assign(rival, patch);
    drive(st, true);
    assert.equal(r.signature, undefined);
    assert.equal(r.meter, 1);
  }
  for (const defendedAtStart of [true, false]) {
    const st = race(), [r, rival] = st.racers;
    if (defendedAtStart) rival.guard = 3;
    drive(st, true);
    if (!defendedAtStart) {
      assert.equal(r.signature.stage, 'latched');
      rival.guard = 3;
      drive(st);
    }
    assert.equal(r.signature.stage, 'cut');
    assert.equal(rival.guard, 0);
    assert.equal(rival.signatureHit.blocked, true);
    assert.ok(r.meter < .1);
  }
});

test('manual release preserves momentum and wraps at the finish without inheriting the rival’s lap', () => {
  const st = race(), [r, rival] = st.racers;
  const length = sim.track(st.trackIndex).length;
  r.s = length - 1; rival.s = 2.2;
  drive(st, true, 1);
  for (let i = 0; i < 16; i++) drive(st);
  const snapshot = JSON.parse(JSON.stringify(st));
  const speed = r.v;
  drive(st, true);
  drive(snapshot, true);
  assert.deepEqual(snapshot.racers[0].signature, r.signature);
  assert.equal(r.s, snapshot.racers[0].s);
  assert.equal(r.signature.stage, 'release');
  assert.ok(r.v >= speed - .35);
  assert.equal(r.lapTimes.length, 1);
  assert.ok(r.s > length && r.s < length + 12);
});

test('the tether drops if an anchored kart changes seat control, route or position discontinuously', () => {
  for (const patch of [{ human: false }, { branch: true }, { s: 200 }, { ghost: .9 }]) {
    const st = race(), [r, rival] = st.racers;
    drive(st, true);
    Object.assign(rival, patch);
    const previous = r.s;
    drive(st);
    assert.equal(r.signature.stage, 'cut');
    assert.ok(Math.abs(r.s - previous) < 1);
  }
});
