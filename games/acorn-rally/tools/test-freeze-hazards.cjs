const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const sim = require('../race-sim.js');
const hazards = require('../hazards.js');

const page = vm.createContext({AcornSim: sim, AcornRig: require('../kart-rig.js'), AcornMinecarts: require('../minecart-hazards.js')});
page.window = page;
for (const script of ['race-world.js', 'darkness-hazards-art.js', 'cosmic-hazards-art.js', 'course-art.js']) {
  vm.runInContext(readFileSync(require.resolve('../' + script), 'utf8'), page, {filename: script});
}

function checkCollision(course, site, holdSeconds, meshes, lockMesh) {
  const courseIndex = course.index;
  const race = sim.create({trackIndex: courseIndex, gridSize: 8, humanSeats: [0]});
  const kart = race.racers[0], tick = 1 / 60;
  race.countdown = 0;
  let obstacle;
  for (let i = 0; i < 600 && !obstacle; i++) {
    race.time = 2 + i * tick;
    obstacle = hazards.samples(course, race.time).find(h => h.key === site.key && h.active && h.progress > .3 && h.progress < .7);
  }
  assert.ok(obstacle, 'an active obstacle exists');
  Object.assign(kart, {s: obstacle.s - .1, x: obstacle.x, v: 18, branch: obstacle.branch});
  Object.assign(race.racers[1], {s: kart.s - 4, x: kart.x, v: 18, branch: kart.branch});
  const drive = () => sim.step(race, tick, [{gas: 1}]);
  drive();
  assert.equal(kart.hazardHit.key, site.key);
  assert.ok(sim.isFrozen(race, kart));
  const impactS = kart.s, hitTime = race.time, drawn = new Set();
  for (let frame = 0; frame < 120; frame++) {
    page.AcornCourseArt.reaction(race, kart, name => {
      assert.ok(meshes[name]?.data.length, 'missing collision mesh on ' + course.name + ': ' + name);
      drawn.add(name);
    });
    if (race.time - hitTime < holdSeconds - tick) assert.equal(kart.s, impactS);
    drive();
  }
  assert.ok(drawn.has(lockMesh), site.key + ' must show the hold around the kart');
  assert.ok(!sim.isFrozen(race, kart));
  assert.ok(kart.v > 0 && kart.s > impactS + 1);
  assert.equal(kart.hazardHit.count, 1);
}

for (const [courseIndex, hazardId, holdSeconds, lockMesh] of [[20, 23, .42, 'shadeMark1'], [10, 11, 1, 'ufoIceLock']]) {
  const course = sim.track(courseIndex);
  test(course.name + ' renders a caught kart and lets it drive away', () => {
    const meshes = page.AcornCourseArt.meshes(page.AcornWorld.Mesh, false, false, courseIndex === 10, false, false, courseIndex);
    const sites = hazards.samples(course, 0).filter(h => h.id === hazardId);
    assert.ok(sites.length > 0);
    for (const site of sites) checkCollision(course, site, holdSeconds, meshes, lockMesh);
  });
}
