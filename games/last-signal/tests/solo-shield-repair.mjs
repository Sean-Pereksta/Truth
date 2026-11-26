import test from "node:test";
import assert from "node:assert/strict";
import { SoloArena } from "../source/Mobile/solo.js";

function clearing() {
  const game = new SoloArena({ seed: 7751 });
  game.clock = 30;
  game.map.heightAt = () => 0;
  game.map.surfaceAt = () => -Infinity;
  game.map.canOccupy = () => true;
  game.map.clearSight = () => true;
  game.map.caches = [];
  game.map.nodes = [];
  game.wildlife = [];
  const player = game.player, rival = game.actors[1];
  game.actors = [player, rival];
  game.alive = 2;
  Object.assign(player, { x: 0, y: 0, z: 0, yaw: 0, cooldown: 0, bag: { sword: 1, shield: 1 }, weapon: "sword" });
  Object.assign(rival, { x: -0.24, y: 0, z: 2.5, yaw: Math.PI, cooldown: 0, bag: { spear: 1 }, weapon: "spear" });
  game.setInput({ yaw: 0, pitch: 0 });
  return { game, player, rival };
}

function fire(game, owner, x, y, z, yaw = Math.PI) {
  game.shots = [{ owner, model: "arrow", x, y, z, yaw, pitch: 0, speed: 34, range: 20, damage: 35 }];
  game.stepShots(0.1);
}

test("a raised shield blocks a real melee contact while high, low, and lateral body hits bypass it", () => {
  const { game, player, rival } = clearing();
  game.command("+Guard");
  game.attack(rival);
  assert.equal(player.health, 100);
  assert.equal(game.frame().player.shieldHealth, 100 - 30 * 0.51);
  assert.equal(game.frame().player.shieldRaised, true);

  Object.assign(rival, { x: 0.38, cooldown: 0 });
  game.attack(rival);
  assert.equal(player.health, 70);
  assert.equal(game.frame().player.shieldHealth, 100 - 30 * 0.51);

  for (const pitch of [0.32, -0.32]) {
    const { game: pitched, player: attacker, rival: defender } = clearing();
    Object.assign(defender, { x: 0, z: 2.45, bag: { spear: 1, shield: 1 }, guard: true });
    pitched.setInput({ yaw: 0, pitch });
    pitched.attack(attacker);
    assert.equal(defender.health, 66);
    assert.equal(defender.shieldStock.length, 0, "a missed shield never loses durability");
  }
});

test("a shield deflects incoming arrows and retains ordinary side, rear and low damage", () => {
  const { game, player, rival } = clearing();
  game.command("+Guard");
  fire(game, rival, -0.24, 1.19, 2.5);
  assert.equal(player.health, 100);
  assert.ok(game.shots[0].deflected);
  assert.ok(Math.cos(game.shots[0].yaw) > 0.95);
  const health = game.frame().player.shieldHealth;
  assert.equal(health, 100 - 35 * 0.69);
  fire(game, rival, 0.33, 1.12, 2.5);
  assert.equal(player.health, 65);
  fire(game, rival, 0, 0.37, 2.5);
  assert.equal(player.health, 30);
  fire(game, rival, 0, 1.12, -2.5, 0);
  assert.equal(player.health, 0);
  assert.equal(game.frame().player.shieldHealth, health);
});

test("held guard resumes after swinging, and worn shields do not refresh when dropped", () => {
  const { game, player, rival } = clearing();
  game.command("+Guard");
  game.attack(player);
  assert.equal(game.frame().player.shieldRaised, false);
  for (let i = 0; i < 4; i++) game.updateActor(player, 0.12);
  assert.equal(game.frame().player.shieldRaised, true);
  fire(game, rival, -0.24, 1.19, 2.5);
  const worn = game.frame().player.shieldHealth;
  game.command("drop:shield");
  assert.equal(game.frame().player.shieldHealth, 0);
  game.loot(player, game.dropped.find(pack => pack.items.shield));
  assert.equal(game.frame().player.shieldHealth, worn);
  for (let hit = 0; hit < 4; hit++) {
    player.stamina = 100;
    fire(game, rival, -0.24, 1.19, 2.5);
  }
  assert.equal(player.health, 100, "the hit that breaks a shield is still stopped");
  assert.equal(game.frame().player.shield, false);
  assert.equal(game.frame().player.shieldHealth, 0);
  fire(game, rival, -0.24, 1.19, 2.5);
  assert.equal(player.health, 65);
});

function wallAt(game, id = "wall") {
  const [w, h, d] = { wall: [3, 2.3, 0.27], barricade: [3.7, 1.2, 0.48],
    floor: [3, 0.16, 3], ramp: [2.4, 2.3, 3] }[id];
  const piece = { id, propIndex: game.nextProp++, x: 0.85, y: 0, z: 2,
    w, h, d, angle: 0, health: 20 };
  game.pieces.push(piece);
  return piece;
}

test("repair commits one wood after two seconds, restores part of each structure, and can only happen once", () => {
  for (const [id, max, pitch] of [["wall", 100, 0], ["barricade", 48, -0.28], ["floor", 90, -0.64], ["ramp", 75, -0.22]]) {
    const { game, player } = clearing();
    game.actors = [player];
    const piece = wallAt(game, id);
    game.setInput({ yaw: 0, pitch });
    assert.equal(game.frame().hud.repair.enabled, false);
    player.bag.branch = 2;
    assert.equal(game.frame().hud.repair.woodNeeded, 1);
    game.command(id === "wall" ? "+Use" : "repair");
    for (let i = 0; i < 10; i++) game.step(0.1);
    assert.equal(game.frame().hud.repair.active, true);
    assert.ok(game.frame().hud.progress > 0.4);
    assert.equal(player.bag.branch, 2);
    for (let i = 0; i < 11; i++) game.step(0.1);
    assert.equal(piece.health, 20 + max * 0.35);
    assert.equal(player.bag.branch, 1);
    assert.equal(game.frame().hud.repair.enabled, false);
    assert.match(game.frame().hud.repair.reason, /already/i);
    game.command("repair");
    assert.equal(game.repairJob, null);
    assert.ok(game.rivalSounds.some(sound => sound.kind === "build"));
  }
});

test("repair stops on damage, target loss, occlusion, or destruction without spending wood", () => {
  for (const outcome of ["hit", "away", "occluded", "destroy"]) {
    const { game, player, rival } = clearing();
    game.actors = [player];
    const wall = wallAt(game);
    player.bag.branch = 1;
    game.command("repair");
    assert.ok(game.repairJob);
    if (outcome === "hit") game.damage(player, 3, rival);
    if (outcome === "away") game.setInput({ yaw: Math.PI, pitch: 0 });
    if (outcome === "occluded") game.map.clearSight = () => false;
    if (outcome === "destroy") game.damageFort(wall, 45, rival);
    game.step(0.1);
    assert.equal(game.repairJob, null);
    assert.equal(player.bag.branch, 1);
    assert.equal(wall.repaired, undefined);
  }
});
