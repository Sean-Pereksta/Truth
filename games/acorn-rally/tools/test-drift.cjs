const assert = require('node:assert/strict');
const sim = require('../race-sim.js');
const course = sim.track(4);
const dt = 1/60;

function start() {
  const state = sim.create({ mode: 'trial', trackIndex: 4, driverIndex: 0, cc: 100 });
  state.countdown = 0;
  Object.assign(state.racers[0], { s: 656, x: -1.8, v: 19 });
  return state;
}

// Enter the right-hand Saltway bend and countersteer as the track turns under the kart.
function corner(frames, drift = true) {
  const state = start(), r = state.racers[0];
  let slip;
  for (let i=0; i<frames; i++) {
    const from = sim.wheelPosition(course, r, state);
    const steer = i<29 ? .70 : Math.max(-1, Math.min(1, -.49*r.x - .075*r.vx + from.curve*r.v*r.v*.034));
    sim.step(state, dt, { 0: { gas: 1, steer, drift } });
    const to = sim.wheelPosition(course, r, state);
    const angle = to.heading - Math.atan2(to.x-from.x, to.z-from.z);
    slip = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    assert.ok(!r.fall && Math.abs(r.x)<to.w, 'corner left the road');
  }
  return { state, slip };
}
const release = state => sim.step(state, dt, { 0: { gas: 1 } });

const normal = corner(24, false), slide = corner(24);
assert.ok(slide.slip > .35 && slide.slip > normal.slip + .20, 'rear tires should visibly slide across the racing line');

let lastPower = 0, lastDuration = 0;
for (const [frames, tier] of [[15,0], [48,1], [80,2], [125,3]]) {
  const { state } = corner(frames), kart = state.racers[0];
  assert.equal(sim.driftTier(kart.drift), tier);
  const restored = JSON.parse(JSON.stringify(state));
  release(state);
  release(restored);
  assert.deepEqual(state, restored);
  assert.equal(kart.driftReleaseTier, tier);
  if (tier) assert.ok(kart.boostPower > lastPower && kart.boost > lastDuration);
  lastPower = kart.boostPower;
  lastDuration = kart.boost;
  release(state);
  assert.equal(kart.driftReleaseSeq, Number(tier>0));
}

const straight = start();
straight.racers[0].s = 50;
for (let i=0; i<120; i++) sim.step(straight, dt, { 0: { gas: 1, drift: true } });
release(straight);
assert.equal(straight.racers[0].driftReleaseSeq, 0);
const airborne = corner(48).state;
airborne.racers[0].air = .28;
release(airborne);
assert.equal(airborne.racers[0].driftReleaseSeq, 0);
assert.equal(airborne.racers[0].drift, 0);
console.log('Tire slip, three drift tiers, grounded releases and snapshot replay passed.');
