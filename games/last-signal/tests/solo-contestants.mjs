import assert from "node:assert/strict";
import test from "node:test";
import { SoloArena } from "../source/Mobile/solo.js";

// Flat, empty ground isolates perception and construction from generated scenery.
function clearing(styles = [], fullRoster = false) {
  const game = new SoloArena({ seed: 314159 });
  game.clock = 34;
  game.map.heightAt = () => 0;
  game.map.surfaceAt = () => -Infinity;
  game.map.canOccupy = () => true;
  game.map.clearSight = () => true;
  game.map.caches = [];
  game.map.nodes = [];
  game.dropped = [];
  const participants = [game.player, ...styles.map(style => game.actors.find(actor => actor.style === style))];
  if (!fullRoster) game.actors = participants;
  for (const actor of game.actors) {
    if (!participants.includes(actor)) Object.assign(actor, { x: 100 + actor.id, z: 60 });
  }
  game.alive = game.actors.length;
  for (const [index, actor] of participants.entries()) {
    Object.assign(actor, { x: 0, z: 0 - index * 10, y: 0, yaw: 0, cooldown: 0, decision: 0 });
  }
  return game;
}

function wallAcrossTrail(game) {
  game.pieces.push({ id: "wall", propIndex: game.nextProp++, x: 0, y: 0, z: -5,
    angle: 0, w: 14, d: 0.42, h: 2.6 });
}

test("three contestants choose different openings from the same supply and opponent", () => {
  for (const [style, expected] of [["runner", "retreat"], ["fighter", "engage"], ["stalker", "watch"]]) {
    const game = clearing([style], true);
    game.clock = 7;
    const actor = game.actors.find(actor => actor.style === style);
    game.drop(actor.x, actor.z + 1, { spear: 1 });
    game.bot(actor, 0.1);
    game.bot(actor, 0.1);
    assert.equal(actor.intent, expected, style);
    if (style !== "stalker") assert.equal(actor.weapon, "spear");
  }
});

test("a broken sight line freezes last-known position until a real sound is heard", () => {
  const game = clearing(["hunter"]);
  const actor = game.actors[1];
  game.thinkRival(actor);
  assert.equal(actor.intent, "engage");
  assert.equal(actor.opponent, game.player.id);
  wallAcrossTrail(game);
  Object.assign(game.player, { x: 3, z: 1 });
  game.clock++;
  assert.equal(game.canSeeRival(actor, game.player), false);
  game.thinkRival(actor);
  assert.equal(actor.intent, "search");
  assert.deepEqual([actor.target.x, actor.target.z], [0, 0]);

  game.setInput({ right: 1, forward: 0, yaw: 0, pitch: 0, crouch: true, sprint: false });
  game.updateActor(game.player, 0.15);
  game.thinkRival(actor);
  assert.equal(actor.intent, "search");
  game.setInput({ right: 1, forward: 0, yaw: 0, pitch: 0, crouch: false, sprint: true });
  game.updateActor(game.player, 0.15);
  const eventAt = { x: game.player.x, z: game.player.z };
  Object.assign(game.player, { x: -6, z: 4 });
  game.thinkRival(actor);
  assert.equal(actor.intent, "investigate");
  assert.ok(Math.hypot(actor.target.x - eventAt.x, actor.target.z - eventAt.z) < 3);
  assert.notEqual(actor.target.x, game.player.x);
  game.clock += 12;
  game.thinkRival(actor);
  assert.ok(!["investigate", "search", "engage"].includes(actor.intent));
});

test("in the final three the observer waits, intervenes, then withdraws when hurt", () => {
  const game = clearing(["hunter", "fighter"]);
  const [player, watcher, fighter] = game.actors;
  Object.assign(watcher, { x: 0, z: -11, weapon: "spear" });
  Object.assign(fighter, { x: 1, z: 1, yaw: -Math.PI / 2 });
  game.attack(fighter);
  game.thinkRival(watcher);
  assert.equal(watcher.intent, "watch");
  game.damage(fighter, 65, player);
  game.thinkRival(watcher);
  assert.equal(watcher.intent, "engage");
  assert.equal(watcher.opponent, fighter.id);
  game.damage(watcher, 60, player);
  game.thinkRival(watcher);
  assert.equal(watcher.intent, "retreat");
});

test("shelter crafts charge the displayed prices and require every ingredient", () => {
  for (const [item, cloth] of [["floor", 0], ["wall", 0], ["lean_to", 1]]) {
    const game = clearing();
    const player = game.player;
    player.bag = { branch: 2, fiber: 2, ...(cloth && { cloth }) };
    const row = () => game.frame().build.find(recipe => recipe[0] === item);
    assert.equal(row()[3], false, item);
    game.command("build:" + item);
    assert.equal(game.build, null, item);
    player.bag.branch++;
    assert.equal(row()[3], true);
    assert.match(row()[2], /^3 wood \/ 2 fiber/);
    game.command("build:" + item);
    game.command("place");
    assert.deepEqual(player.bag, {});
    assert.equal(game.pieces.length, 1);
    assert.equal(game.pieces[0].id, item);
  }
});

test("taking a supply chest leaves evidence but no second load of supplies", () => {
  const game = new SoloArena({ seed: 531 });
  const cache = game.map.caches.find(cache => game.world.props[cache.propIndex][0] === "cache");
  const looter = game.actors[1];
  assert.ok(cache);
  game.loot(looter, cache);
  assert.deepEqual(looter.bag, cache.items);
  assert.ok(game.removed.has(cache.propIndex));
  const display = game.frame().propChanges.find(([index]) => index === cache.propIndex)[1];
  assert.equal(display[9], "remnant");
  game.loot(game.player, cache);
  assert.deepEqual(game.player.bag, {});
});

test("a nearby contestant chopping wood makes a temporary positional sound", () => {
  const game = new SoloArena({ seed: 531 });
  const tree = game.map.nodes.find(node => node.type === "tree");
  const actor = game.actors[1];
  game.clock = 31;
  Object.assign(actor, { x: tree.x, z: tree.z, weapon: "hatchet" });
  Object.assign(game.player, { x: tree.x + 4, z: tree.z });
  assert.ok(!game.frame().workSound);
  game.harvest(tree, actor);
  assert.ok(actor.bag.branch > 0);
  const sound = game.frame().workSound;
  assert.ok(sound?.volume > 0);
  assert.ok(Math.abs(sound.pan) <= 1);
  game.clock += 15;
  assert.ok(!game.frame().workSound);
});

test("a worker builds a persistent barricade from wood actually gathered at the site", () => {
  const game = clearing(["hunter", "runner", "fighter"]);
  const worker = game.actors[1];
  const tree = { x: worker.x, z: worker.z + 2, type: "tree", propIndex: game.nextProp++ };
  game.map.nodes.push(tree);
  assert.equal(game.workSite(worker), null);
  worker.bag.hatchet = 1;
  game.clock += 7;
  const site = game.workSite(worker);
  assert.equal(site.workNode, tree);
  game.workAt(worker, site);
  assert.ok(worker.bag.branch >= 2);
  assert.ok(worker.bag.fiber >= 1);
  const wood = worker.bag.branch, fiber = worker.bag.fiber;
  assert.equal(game.pieces.length, 0);
  game.clock += 2;
  game.workAt(worker, site);
  const barrier = game.pieces[0];
  assert.equal(barrier.owner, worker.id);
  assert.equal(barrier.id, "barricade");
  assert.equal(worker.bag.branch ?? 0, wood - 2);
  assert.equal(worker.bag.fiber ?? 0, fiber - 1);
  assert.equal(game.changes.get(barrier.propIndex)[9], "structure");
});

test("all three maps run complete 24-contestant solo matches", () => {
  for (let arena = 0; arena < 3; arena++) {
    const game = new SoloArena({ arena, seed: 1776 + arena });
    assert.equal(game.actors.length, 24);
    for (let tick = 0; tick < 5500 && !game.winner; tick++) game.step(0.15);
    const frame = game.frame();
    assert.equal(frame.alive, 1, "arena " + arena);
    assert.equal(frame.winner, game.actors.find(actor => actor.alive).name);
    assert.equal(game.actors.filter(actor => actor.placement > 1).length, 23);
    for (const actor of game.actors) {
      assert.ok([actor.x, actor.y, actor.z, actor.health].every(Number.isFinite));
    }
  }
});
