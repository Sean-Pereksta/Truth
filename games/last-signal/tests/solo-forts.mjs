import assert from "node:assert/strict";
import test from "node:test";
import { SoloArena } from "../source/Mobile/solo.js";
import { rivalFortCandidate, stepRivalFort } from "../source/Mobile/solo-forts.js";

function field(inclination, weapon = "spear", scrap = 0) {
  const game = new SoloArena({ seed: 88122 });
  game.clock = 28;
  game.map.heightAt = () => 0;
  game.map.surfaceAt = () => -Infinity;
  game.map.canOccupy = () => true;
  game.map.clearSight = () => true;
  game.map.caches = [];
  game.map.nodes = [];
  for (const actor of game.actors) Object.assign(actor, { x: -95, y: 0, z: 60 });
  const actor = game.actors[1];
  Object.assign(actor, {
    x: 40, y: 0, z: 0, yaw: 0, buildBias: inclination, weapon,
    bag: { branch: 10, fiber: 10, [weapon]: 1, ...(scrap ? { scrap } : {}) }
  });
  return { actor, game };
}

function build(game, actor, steps = 300) {
  for (let step = 0; step < steps; step++) {
    game.clock += 0.1;
    const candidate = rivalFortCandidate(game, actor, {});
    if (!candidate) continue;
    actor.target = candidate.target;
    stepRivalFort(game, actor, 0.1);
    const work = actor.fortWork;
    if (work.next === work.pieces.length) return work;
  }
  return actor.fortWork;
}

test("browser bots build four distinct templates, charging each player recipe", () => {
  const cases = [
    ["hide", 0.74, "spear", 0, ["wall", "wall"], 2, 2],
    ["camp", 0.79, "spear", 0, ["wall", "wall", "wall", "wall"], 4, 4],
    ["lookout", 0.87, "bow", 0, ["wall", "wall", "floor", "ramp", "barricade"], 6, 5],
    ["stronghold", 0.99, "bow", 1, ["wall", "ramp", "wall", "wall", "wall", "gate", "floor", "floor"], 10, 8]
  ];
  for (const [expected, inclination, weapon, scrap, pieces, wood, fiber] of cases) {
    const { game, actor } = field(inclination, weapon, scrap);
    const fort = build(game, actor);
    assert.equal(fort?.kind, expected);
    assert.deepEqual(game.pieces.map(piece => piece.id), pieces, expected);
    assert.ok(game.pieces.every(piece => piece.owner === actor.id && game.changes.has(piece.propIndex)), expected);
    assert.equal(actor.bag.branch ?? 0, 10 - wood, expected);
    assert.equal(actor.bag.fiber, 10 - fiber, expected);
    assert.equal(actor.bag.scrap ?? 0, 0, expected);
  }
});

test("ramp reaches the lookout deck and only unsupported elevated pieces collapse", () => {
  const { game, actor } = field(0.87, "bow");
  const fort = build(game, actor);
  assert.equal(fort.next, fort.pieces.length);
  const [left, right, deck, ramp, rail] = game.pieces;
  const player = game.player;
  const back = ramp.d / 2 + 0.7;
  Object.assign(player, { x: ramp.x - Math.sin(ramp.angle) * back, z: ramp.z - Math.cos(ramp.angle) * back,
    y: ramp.y, yaw: ramp.angle });
  for (let step = 0; step < 20; step++) game.move(player, 0, 1, 0.1, 2.7);
  assert.ok(player.y >= deck.y + deck.h - 0.05, `climbed to ${player.y}`);
  game.remove(left);
  assert.equal(game.removed.has(deck.propIndex), false);
  game.remove(right);
  for (const piece of [deck, rail]) assert.ok(game.removed.has(piece.propIndex));
  assert.equal(game.removed.has(ramp.propIndex), false);
  game.move(player, 0, 0, 0.1, 2.7);
  assert.equal(player.y, 0);
});

test("a rival can take over a built lookout and descend again", () => {
  const { game, actor } = field(0.87, "bow");
  build(game, actor);
  const visitor = game.actors[2];
  Object.assign(actor, { x: -95, z: 60 });
  Object.assign(visitor, { x: 40, y: 0, z: -6, yaw: 0, weapon: "bow", bag: { bow: 1, arrows: 3 }, buildBias: 0.1 });
  const post = rivalFortCandidate(game, visitor, {});
  assert.equal(post?.target.post?.piece.id, "floor");
  visitor.target = post.target;
  for (let step = 0; step < 70 && !visitor.fortVisitUntil; step++) {
    game.clock += 0.1;
    stepRivalFort(game, visitor, 0.1);
  }
  assert.ok(visitor.fortVisitUntil, "the visitor climbed to the post");
  assert.ok(visitor.y > 2.2, `visitor is on the deck at ${visitor.y}`);
  let usedRamp = false;
  const exit = { x: 42, z: -9, y: 0 };
  for (let step = 0; step < 70 && visitor.z > -6; step++) {
    game.clock += 0.1;
    game.moveRival(visitor, exit, 0.1, "roam");
    if (visitor.z < -1.6 && visitor.z > -4.4 && visitor.y > 0.2 && visitor.y < 2.1) usedRamp = true;
  }
  assert.ok(usedRamp, "the visitor descended along the ramp");
  assert.ok(visitor.z < -6);
  assert.equal(visitor.y, 0);
});

test("the stronghold's outside ramp reaches the deck over its side wall", () => {
  const { game, actor } = field(0.99, "bow", 1);
  build(game, actor);
  const ramp = game.pieces.find(piece => piece.id === "ramp");
  const player = game.player;
  const back = ramp.d / 2 + 0.65;
  Object.assign(player, { x: ramp.x - Math.sin(ramp.angle) * back, y: ramp.y,
    z: ramp.z - Math.cos(ramp.angle) * back, yaw: ramp.angle });
  for (let step = 0; step < 19; step++) game.move(player, 0, 1, 0.1, 2.7);
  assert.ok(player.y > 2.2, `stronghold climbed to ${player.y}`);
  assert.ok(Math.abs(player.x - 40) < 1);
});

test("building pauses for a seen rival and drops a site the storm will cut off", () => {
  const { game, actor } = field(0.74);
  const work = build(game, actor, 1);
  assert.equal(work.next, 1);
  const rival = { x: actor.x + 4, z: actor.z };
  assert.equal(rivalFortCandidate(game, actor, { enemy: rival }), null);
  assert.equal(game.pieces.length, 1);
  game.storm.active = true;
  game.storm.radius = 49;
  assert.equal(rivalFortCandidate(game, actor, {}), null);
  assert.equal(actor.fortWork, null);
  assert.equal(game.pieces.length, 1);
});
