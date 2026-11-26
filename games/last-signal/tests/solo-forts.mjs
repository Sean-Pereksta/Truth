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

function selectPlayerTemplate(kind) {
  const { game } = field(0.1);
  const player = game.player;
  Object.assign(player, { x: 30, y: 0, z: -20, yaw: 0, bag: { branch: 10, fiber: 8, scrap: 1 } });
  game.command("build:blueprint_" + kind);
  return game;
}

function moveToNextPiece(game) {
  const row = game.frame().fortGhosts[0];
  const [, x, , z] = row;
  const player = game.player;
  for (let direction = 0; direction < 16; direction++) {
    const yaw = direction * Math.PI / 8;
    Object.assign(player, { x: x + Math.sin(yaw) * 1.95, z: z + Math.cos(yaw) * 1.95, y: 0, yaw: yaw + Math.PI });
    if (game.frame().ghostFits) return;
  }
  assert.fail(game.frame().fortGuide.error);
}

test("the player can place and pay for every template one piece at a time", () => {
  for (const [name, pieces, wood, fiber] of [["hide", 2, 2, 2], ["camp", 4, 4, 4],
    ["lookout", 5, 6, 5], ["stronghold", 8, 10, 8]]) {
    const game = selectPlayerTemplate(name);
    const first = game.frame();
    assert.equal(first.fortGhosts.length, pieces, name);
    assert.equal(first.fortGhosts[0][16], "ready", name);
    assert.ok(first.fortGhosts.slice(1).every(row => row[16] === "pending"), name);
    if (name === "lookout" || name === "stronghold") assert.ok(first.fortGuide.ramp, name);
    game.command("place");
    assert.equal(game.pieces.length, 1, name);
    for (let step = 1; step < pieces; step++) {
      moveToNextPiece(game);
      game.command("repeat");
      assert.equal(game.pieces.length, step + 1, `${name} piece ${step + 1}`);
    }
    assert.equal(game.frame().fortGuide, null, name);
    assert.equal(game.player.bag.branch ?? 0, 10 - wood, name);
    assert.equal(game.player.bag.fiber ?? 0, 8 - fiber, name);
    assert.equal(game.player.bag.scrap ?? 0, name === "stronghold" ? 0 : 1, name);
  }
});

test("player blueprint rotation pivots around the first piece and partial work resumes at its original site", () => {
  const game = selectPlayerTemplate("lookout");
  const before = game.frame().fortGhosts;
  game.command("rotate:1");
  const after = game.frame().fortGhosts;
  assert.deepEqual(after[0].slice(1, 4), before[0].slice(1, 4));
  assert.notDeepEqual(after[1].slice(1, 4), before[1].slice(1, 4));
  game.command("place");
  game.command("rotate:1");
  assert.match(game.frame().hud.notice, /fixed/i);
  game.command("cancel");
  Object.assign(game.player, { x: 60, z: -25, yaw: Math.PI });
  game.command("build:blueprint_lookout");
  const frame = game.frame();
  assert.equal(frame.fortGuide.placed, 1);
  assert.equal(frame.fortGuide.remaining, 4);
  assert.match(frame.fortGuide.error, /move closer/i);
  assert.deepEqual(frame.fortGhosts.map(row => row.slice(1, 4)), after.slice(1).map(row => row.slice(1, 4)));
  const listing = frame.build.find(row => row[0] === "blueprint_lookout");
  assert.deepEqual(listing[4].needs.map(({ id, required }) => [id, required]), [["branch", 5], ["fiber", 4]]);
  assert.equal(game.pieces.length, 1);
});

test("abandoning an active or paused blueprint allows a fresh site and keeps paid pieces", () => {
  for (const paused of [false, true]) {
    const game = selectPlayerTemplate("hide");
    game.command("place");
    const piece = game.pieces[0];
    const buildRow = () => game.frame().build.find(row => row[0] === "blueprint_hide");
    assert.equal(buildRow()[4].saved, true);
    if (paused) game.command("cancel");
    game.command("abandon-blueprint:blueprint_hide");
    assert.equal(game.frame().fortGuide, null);
    assert.equal(buildRow()[4].saved, false);
    assert.deepEqual(game.pieces, [piece]);
    assert.equal(game.removed.has(piece.propIndex), false);
    assert.equal(game.player.bag.branch, 9);
    Object.assign(game.player, { x: 80, z: -25, yaw: 0 });
    game.command("build:blueprint_hide");
    const frame = game.frame();
    assert.equal(frame.fortGuide.placed, 0);
    assert.equal(frame.fortGuide.remaining, 2);
    assert.ok(frame.fortGhosts.every(row => row[1] > 75));
  }
});

test("fort previews explain missing materials and blocked terrain and a selected ramp can snap to support", () => {
  const game = selectPlayerTemplate("hide");
  game.player.bag = {};
  const missing = game.frame();
  assert.equal(missing.ghostFits, false);
  assert.match(missing.fortGuide.error, /wood.*fiber/i);
  game.map.surfaceAt = () => 1;
  assert.match(game.frame().fortGuide.error, /water/i);

  game.map.surfaceAt = () => -Infinity;
  game.player.bag = { branch: 2, fiber: 2 };
  const support = { id: "wall", x: game.player.x, y: 0, z: game.player.z + 4.95,
    angle: 0, w: 3, h: 2.3, d: 0.27, propIndex: game.nextProp++ };
  game.pieces.push(support);
  game.input.pitch = 0.3;
  game.command("build:ramp");
  const ramp = game.frame();
  assert.ok(ramp.fortGuide.ramp);
  assert.equal(ramp.fortGuide.support[0], "wall");
  assert.equal(ramp.ghostFits, true);
  assert.equal(ramp.fortGuide.ramp.angle % (Math.PI * 2), 0);
});

test("craft and build rows show inventory counts, acquisition hints and available recipe copies", () => {
  const game = selectPlayerTemplate("camp");
  game.player.bag = { branch: 2, stone: 2, tinder: 1, firekit: 2, fiber: 2 };
  const { craft, build } = game.frame();
  const arrows = craft.find(row => row[0] === "arrows")[4];
  assert.equal(arrows.category, "Ammo");
  assert.equal(arrows.yield, 5);
  assert.equal(arrows.copies, 2);
  assert.deepEqual(arrows.needs.map(({ id, held, required }) => [id, held, required]),
    [["branch", 2, 1], ["stone", 2, 1], ["fiber", 2, 1]]);
  assert.ok(arrows.needs.every(need => need.source.length > 0));
  const fire = build.find(row => row[0] === "fire");
  assert.equal(fire[2], "1 campfire kit");
  assert.equal(fire[4].kit, true);
  assert.equal(fire[4].copies, 3);
  const camp = build.find(row => row[0] === "blueprint_camp");
  assert.equal(camp[3], true, "the player can begin a blueprint with fewer than all materials");
  assert.equal(camp[4].copies, 0);
});
