import { createSoloWorld } from "./solo-world.js";

const TAU = Math.PI * 2;
const ROUND_START = 4;
const REACH = 3.25;
const BOT_NAMES = [
  "Ash", "Briar", "Dove", "Flint", "Gale", "Iris", "Juniper", "Lark", "Marl",
  "Nettle", "Onyx", "Piper", "Reed", "Rowan", "Sable", "Sage", "Sparrow",
  "Thorn", "Vale", "Vesper", "Willow", "Wren", "Yarrow"
];
const BOT_STYLES = ["fighter", "runner", "hunter", "stalker"];
const weapons = {
  fists: { damage: 12, reach: 2.1, delay: 0.56 },
  knife: { damage: 23, reach: 2.2, delay: 0.48 },
  hatchet: { damage: 30, reach: 2.5, delay: 0.83 },
  sword: { damage: 34, reach: 2.9, delay: 0.67 },
  spear: { damage: 30, reach: 3.7, delay: 0.77 },
  sling: { damage: 19, ammo: "stone", shot: "stone", speed: 32, range: 29, delay: 0.65 },
  bow: { damage: 34, ammo: "arrows", shot: "arrow", speed: 51, range: 50, delay: 0.77 },
  crossbow: { damage: 51, ammo: "bolts", shot: "bolt", speed: 83, range: 75, delay: 0.44 }
};
const names = {
  branch: "Wood", meal: "Cooked meal", meat: "Game meat", firekit: "Campfire kit",
  fire: "Campfire", lean_to: "Lean-to", bow: "Field bow", barricade: "Low barricade",
  wall: "Timber wall", gate: "Hinged gate", rain_barrel: "Rain barrel", ramp: "Timber ramp",
  floor: "Floor", woven_vest: "Woven vest", scrap_cuirass: "Scrap cuirass", shield: "Round shield"
};
const crafts = [
  ["sling", 1, { fiber: 2, cloth: 1 }],
  ["spear", 1, { branch: 2, stone: 1, fiber: 1 }],
  ["arrows", 5, { branch: 1, stone: 1, fiber: 1 }],
  ["hatchet", 1, { branch: 1, scrap: 2, fiber: 1 }],
  ["bandage", 1, { cloth: 1, fiber: 1 }],
  ["firekit", 1, { branch: 2, stone: 2, tinder: 1 }],
  ["waterskin", 1, { cloth: 2, fiber: 1 }],
  ["bow", 1, { branch: 3, fiber: 3, cloth: 1 }],
  ["woven_vest", 1, { cloth: 2, fiber: 2 }],
  ["scrap_cuirass", 1, { scrap: 3, cloth: 1, fiber: 2 }],
  ["shield", 1, { branch: 3, scrap: 1, fiber: 2 }],
  ["sword", 1, { scrap: 4, branch: 1, cloth: 1 }],
  ["bolts", 3, { scrap: 1, branch: 1 }]
];
const builds = [
  ["barricade", 1, { branch: 2, fiber: 1 }],
  ["wall", 1, { branch: 3, fiber: 2 }],
  ["gate", 1, { branch: 3, fiber: 1, scrap: 1 }],
  ["lean_to", 1, { branch: 3, fiber: 2, cloth: 1 }],
  ["ramp", 1, { branch: 3, fiber: 1 }],
  ["fire", 1, { branch: 2, stone: 2, tinder: 1 }],
  ["rain_barrel", 1, { branch: 4, fiber: 2, cloth: 1 }],
  ["floor", 1, { branch: 3, fiber: 2 }]
];
const pieceSize = {
  barricade: [3.7, 1.2, 0.48], wall: [4, 2.6, 0.42], gate: [3.4, 2.4, 0.44],
  lean_to: [3.8, 2.5, 3.2], ramp: [2.5, 1.8, 3.5], fire: [1.12, 0.45, 1.12],
  rain_barrel: [1.2, 1.15, 1.2], floor: [3.7, 0.24, 3.7]
};
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heading = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const label = (id) => names[id] || id.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const count = (actor, item) => actor.bag[item] || 0;

function add(actor, item, amount) {
  const total = count(actor, item) + amount;
  if (total > 0) actor.bag[item] = total;
  else delete actor.bag[item];
}

function makeActor(id, name, style, spawn, groundY, random) {
  return {
    id, name, x: spawn.x, y: groundY, z: spawn.z, yaw: spawn.yaw,
    style,
    health: 100, stamina: 100, hunger: 100, hydration: 100,
    water: 0, alive: true, placement: 0, weapon: "fists", armor: "", speed: 0,
    cooldown: random() * 0.55, crouch: false, guard: false, swing: 0, hurt: 0, anim: 0,
    reload: 0, crossbowLoaded: false, jump: 0, verticalSpeed: 0, bag: {},
    decision: random() * 0.4, target: null, aggression: random(), intent: "roam",
    lastSeen: null, lastSound: 0, soundMemory: null, opponent: null, openingLoot: false,
    attackedAt: -Infinity, woundedAt: -Infinity, nextStepNoise: 0, lookAt: null,
    escapeUntil: 0, openingRoute: null, leftPlaza: false, winded: false,
    seenHits: new Map(), seenSwings: new Map()
  };
}

function recipeAffordable(actor, recipe, building) {
  if (building && recipe[0] === "fire" && count(actor, "firekit")) return true;
  return Object.entries(recipe[2]).every(([id, quantity]) => count(actor, id) >= quantity);
}

function recipeRows(actor, recipes, building = false) {
  return recipes.map(recipe => {
    const [id, amount, materials] = recipe;
    const cost = building && id === "fire" && count(actor, "firekit") ? "1 campfire kit" :
      Object.entries(materials).map(([item, quantity]) => quantity + " " + label(item).toLowerCase()).join(" / ");
    return [id, label(id) + (amount > 1 ? " x" + amount : ""), cost, recipeAffordable(actor, recipe, building)];
  });
}

function pay(actor, recipe, building) {
  if (building && recipe[0] === "fire" && count(actor, "firekit")) {
    add(actor, "firekit", -1);
  } else {
    for (const [id, quantity] of Object.entries(recipe[2])) add(actor, id, -quantity);
  }
}

function hasShield(actor) {
  return Boolean(count(actor, "shield") && (actor.weapon === "spear" || actor.weapon === "sword"));
}

function equips(actor, id) {
  if (!Object.hasOwn(weapons, id) || (id !== "fists" && !count(actor, id))) return;
  if (actor.weapon === "crossbow" && actor.weapon !== id) actor.reload = 0;
  actor.weapon = id;
}

function itemRow(model, x, y, z, w, h, d, kind, yaw = 0, lit = false) {
  return [model, x, y, z, 1, yaw, w, h, d, kind, lit, -1, 0, false, model];
}

// Intersect the whole sight segment with a rotated building piece. A thin wall
// can fall entirely between movement samples, and a low barricade only hides a crouched rival.
function crossesPiece(from, to, eye, end, piece) {
  const c = Math.cos(piece.angle), s = Math.sin(piece.angle);
  const ox = from.x - piece.x, oz = from.z - piece.z, dx = to.x - from.x, dz = to.z - from.z;
  let near = 0, far = 1;
  function slab(start, delta, extent) {
    if (Math.abs(delta) < 0.00001) return Math.abs(start) <= extent;
    const a = (-extent - start) / delta, b = (extent - start) / delta;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    return near <= far;
  }
  return slab(ox * c - oz * s, dx * c - dz * s, piece.w / 2) &&
    slab(ox * s + oz * c, dx * s + dz * c, piece.d / 2) &&
    slab(eye - piece.y - piece.h / 2, end - eye, piece.h / 2);
}

export class SoloArena {
  constructor({ name = "Contestant", round = 1, seed = Date.now(), arena = 0 } = {}) {
    this.map = createSoloWorld(seed, arena);
    const { terrain, props, spawns, heightAt, random } = this.map;
    this.world = { type: "world", round, arena, seed, radius: this.map.radius || 185, terrain, props };
    const styles = BOT_NAMES.map((_, index) => BOT_STYLES[index % BOT_STYLES.length]);
    for (let i = styles.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [styles[i], styles[j]] = [styles[j], styles[i]];
    }
    this.actors = [name, ...BOT_NAMES].map((contestant, id) => {
      const spawn = spawns[id];
      return makeActor(id, contestant, id ? styles[id - 1] : "player", spawn, heightAt(spawn.x, spawn.z), random);
    });
    this.player = this.actors[0];
    this.input = { right: 0, forward: 0, lean: 0, pitch: 0, yaw: this.player.yaw };
    this.hold = new Set();
    this.clock = 0;
    this.winner = "";
    this.alive = this.actors.length;
    this.storm = { x: 0, z: 0, radius: this.world.radius, nextRadius: 118, seconds: 38, warning: false, moving: false, active: false };
    this.removed = new Set();
    this.changes = new Map();
    this.falling = new Map();
    this.nodeHealth = new Map();
    this.pieces = [];
    this.dropped = [];
    this.shots = [];
    this.rivalSounds = [];
    this.soundSerial = 0;
    this.wildlife = (this.map.wildlife || []).map(animal => ({ ...animal, phase: random() * TAU }));
    this.stoves = props.flatMap((prop, propIndex) => prop?.[0] === "stove" ?
      [{ x: prop[1], z: prop[3], propIndex, lit: true }] : []);
    this.nextProp = props.length;
    this.focusChoice = 0;
    this.focus = [];
    this.build = null;
    this.buildAngle = 0;
    this.drawStarted = null;
    this.throwStarted = null;
    this.notice = "";
    this.noticeUntil = 0;
    this.feed = "";
    this.feedUntil = 0;
    this.hitUntil = 0;
    this.impactAngle = 0;
    this.useUntil = 0;
  }

  say(message, seconds = 2.5) {
    this.notice = message;
    this.noticeUntil = this.clock + seconds;
  }

  setInput(input) {
    if (!this.player.alive || this.winner) return;
    this.input = input;
    this.player.yaw = input.yaw ?? this.player.yaw;
    this.refreshFocus();
    if (this.clock < ROUND_START) return;
    for (const action of input.actions || []) this.command(action);
  }

  command(action) {
    const actor = this.player;
    const [verb, arg] = action.split(":");
    if (action === "unfocus") {
      this.hold.clear();
      actor.guard = false;
      this.drawStarted = this.throwStarted = null;
      return;
    }
    if (verb === "+Attack") {
      this.hold.add("attack");
      const weapon = weapons[actor.weapon];
      if (actor.weapon !== "crossbow" && weapon.ammo) this.drawStarted = this.clock;
      else this.attack(actor);
    }
    if (verb === "-Attack") {
      this.hold.delete("attack");
      if (this.drawStarted !== null) {
        this.attack(actor, clamp((this.clock - this.drawStarted) / 0.8, 0.24));
        this.drawStarted = null;
      }
    }
    if (verb === "+Guard" || verb === "-Guard") actor.guard = verb[0] === "+";
    if (verb === "+Throw" && actor.weapon === "spear") this.throwStarted = this.clock;
    if (verb === "-Throw" && this.throwStarted !== null && actor.weapon === "spear") {
      if (this.projectile(actor, { damage: 41, shot: "spear", speed: 32, range: 36, delay: 0.9 }, clamp((this.clock - this.throwStarted) / 0.75, 0.3))) {
        add(actor, "spear", -1);
        equips(actor, "fists");
      }
      this.throwStarted = null;
    }
    if (verb === "+Use") this.use();
    if (verb === "+Jump" && actor.jump <= 0) actor.verticalSpeed = 4.8;
    if (verb === "+Dodge" && actor.stamina >= 12) {
      const sideways = this.input.right;
      const ahead = this.input.forward || (sideways ? 0 : -1);
      for (let step = 0; step < 3; step++) this.move(actor, sideways, ahead, 0.12, 7.5);
      actor.stamina -= 12;
    }
    if (verb === "+Shove") this.attack(actor, 1, { damage: 8, reach: 2.35, delay: 0.6 });
    if (verb === "+Dismiss") this.noticeUntil = 0;
    if (verb === "cycle" && this.focus.length) {
      this.focusChoice = (this.focusChoice + (arg === "-1" ? -1 : 1) + this.focus.length) % this.focus.length;
    }
    if (verb === "weapon") {
      const owned = Object.keys(weapons).filter(id => id === "fists" || count(actor, id));
      equips(actor, owned[(owned.indexOf(actor.weapon) + (arg === "-1" ? -1 : 1) + owned.length) % owned.length]);
    }
    if (verb === "equip") equips(actor, arg);
    if (verb === "pack") this.usePack(arg);
    if (verb === "drop" && count(actor, arg) && actor.weapon !== arg) {
      add(actor, arg, -1);
      if (!count(actor, arg) && actor.armor === arg) actor.armor = "";
      this.drop(actor.x + Math.sin(actor.yaw), actor.z + Math.cos(actor.yaw), { [arg]: 1 });
    }
    if (verb === "craft") this.craft(arg);
    if (verb === "build") {
      const recipe = builds.find(row => row[0] === arg);
      if (recipe && recipeAffordable(actor, recipe, true)) {
        this.build = recipe;
        this.buildAngle = 0;
      }
    }
    if (verb === "cancel") this.build = null;
    if (verb === "rotate") this.buildAngle += (arg === "-1" ? -1 : 1) * Math.PI / 4;
    if (verb === "place" || verb === "repeat") this.place(verb === "repeat");
  }

  craft(id) {
    const recipe = crafts.find(row => row[0] === id);
    if (!recipe || !recipeAffordable(this.player, recipe)) return;
    pay(this.player, recipe);
    add(this.player, id, recipe[1]);
    equips(this.player, id);
    this.say("Made " + label(id).toLowerCase() + ".");
  }

  usePack(id) {
    const actor = this.player;
    if (!count(actor, id)) return;
    if (id === "bandage" && actor.health < 100) {
      add(actor, id, -1);
      actor.health = Math.min(100, actor.health + 28);
      this.say("Wounds dressed.");
    }
    if (id === "meal" || id === "berries") {
      add(actor, id, -1);
      actor.hunger = Math.min(100, actor.hunger + (id === "meal" ? 42 : 18));
      this.say(id === "meal" ? "Ate a cooked meal." : "Ate berries.");
    }
    if (id === "waterskin" && actor.water > 0) {
      const amount = Math.min(actor.water, 100 - actor.hydration, 24);
      actor.water -= amount;
      actor.hydration += amount;
    }
    if (id === "woven_vest" || id === "scrap_cuirass") actor.armor = actor.armor === id ? "" : id;
    if (id === "firekit") this.command("build:fire");
    equips(actor, id);
  }

  blueprint(actor = this.player, recipe = this.build, rotation = this.buildAngle, reach = 3.45) {
    if (!recipe) return null;
    const { x, z, yaw, id: actorId } = actor;
    const id = recipe[0];
    const px = Math.round((x + Math.sin(yaw) * reach) * 2) / 2;
    const pz = Math.round((z + Math.cos(yaw) * reach) * 2) / 2;
    const y = this.map.heightAt(px, pz);
    const [w, h, d] = pieceSize[id];
    const angle = Math.round(yaw / (Math.PI / 4)) * Math.PI / 4 + rotation;
    const fits = this.map.surfaceAt(px, pz) <= y + 0.25 &&
      this.canOccupy(px, pz, 0.7) &&
      this.pieces.every(piece => this.removed.has(piece.propIndex) || piece.id !== id || distance(piece, { x: px, z: pz }) > 0.75) &&
      this.actors.every(actor => !actor.alive || actor.id === actorId || distance(actor, { x: px, z: pz }) > 1.5);
    return { id, x: px, y, z: pz, w, h, d, angle, fits };
  }

  place(repeat) {
    const piece = this.blueprint();
    if (!piece?.fits || !recipeAffordable(this.player, this.build, true)) {
      this.say("Find clear ground and check materials.");
      return;
    }
    this.installPiece(this.player, this.build, piece);
    this.say("Placed " + label(piece.id).toLowerCase() + ".");
    if (!repeat || !recipeAffordable(this.player, this.build, true)) this.build = null;
  }

  installPiece(actor, recipe, piece) {
    pay(actor, recipe, true);
    piece.propIndex = this.nextProp++;
    piece.owner = actor.id;
    piece.health = 48;
    piece.lit = false;
    this.pieces.push(piece);
    this.showPiece(piece);
    this.rivalNoise(actor, 14, "build");
  }

  showPiece(piece) {
    const { id, x, y, z, w, h, d, angle, lit, open } = piece;
    const record = itemRow(id, x, y, z, w, h, d, "structure", angle, lit);
    record[13] = Boolean(open);
    record[15] = Boolean(piece.shelterFrame);
    this.changes.set(piece.propIndex, record);
  }

  drop(x, z, items, leavePack = false) {
    const propIndex = this.nextProp++;
    this.dropped.push({ x, z, propIndex, items, leavePack });
    this.changes.set(propIndex, itemRow("pack", x, this.map.heightAt(x, z), z, 0.6, 0.48, 0.48, "pack"));
  }

  remove(target) {
    this.removed.add(target.propIndex);
    this.changes.set(target.propIndex, null);
  }

  refreshFocus() {
    const actor = this.player;
    const options = [];
    const aimAt = target => distance(actor, target) <= REACH &&
      Math.abs(angleDifference(actor.yaw, heading(actor, target))) < (distance(actor, target) < 0.85 ? 1.75 : 0.82);
    const addOption = (target, kind, title) => {
      if (aimAt(target)) options.push({ target, kind, title, distance: distance(actor, target) });
    };
    this.nearbyRemnant = "";
    let clueDistance = REACH;
    for (const cache of [...this.map.caches, ...this.dropped]) {
      if (!this.removed.has(cache.propIndex)) addOption(cache, "cache", "Take supplies");
      else if (cache.emptied && aimAt(cache) && distance(actor, cache) <= clueDistance && this.lineClear(actor, cache)) {
        this.nearbyRemnant = cache.emptied;
        clueDistance = distance(actor, cache);
      }
    }
    for (const node of this.map.nodes) {
      if (this.removed.has(node.propIndex)) continue;
      if (node.type === "tree") addOption(node, "resource", "Harvest tree");
      if (node.type === "stone") addOption(node, "resource", "Mine stone");
      if (node.type === "fiber") addOption(node, "resource", "Gather fiber");
      if (node.type === "berry") addOption(node, "resource", "Gather berries");
    }
    for (const animal of this.wildlife) {
      if (animal.health <= 0 && !animal.harvested) addOption(animal, "wildlife", "Dress game");
    }
    for (const source of this.map.waterSources || []) addOption(source, "water", "Drink at spring");
    for (const reach of [0, 1.5, 3]) {
      const x = actor.x + Math.sin(actor.yaw) * reach;
      const z = actor.z + Math.cos(actor.yaw) * reach;
      if (this.map.surfaceAt(x, z) > this.map.heightAt(x, z) + 0.05) {
        options.push({ target: { x, z }, kind: "water", title: "Drink water", distance: REACH });
        break;
      }
    }
    for (const stove of this.stoves) addOption(stove, "campfire", "Cook game");
    for (const piece of this.pieces) {
      if (this.removed.has(piece.propIndex)) continue;
      if (piece.shelterFrame && aimAt(piece) && distance(actor, piece) <= clueDistance) {
        // Look at the near face, so the frame's own solid windbreak does not hide the clue.
        const range = distance(actor, piece);
        const inset = Math.min(1, Math.max(piece.w, piece.d) * 0.55 / Math.max(0.01, range));
        const near = { x: piece.x + (actor.x - piece.x) * inset, z: piece.z + (actor.z - piece.z) * inset };
        if (this.lineClear(actor, near)) {
          this.nearbyRemnant = "Unfinished shelter frame";
          clueDistance = range;
        }
      }
      if (piece.id === "fire") addOption(piece, "campfire", piece.lit ? "Cook game" : "Light campfire");
      if (piece.id === "gate") addOption(piece, "gate", piece.open ? "Close gate" : "Open gate");
    }
    options.sort((a, b) => a.distance - b.distance);
    this.focus = options.slice(0, 5);
    if (this.focusChoice >= this.focus.length) this.focusChoice = 0;
  }

  use() {
    const option = this.focus[this.focusChoice];
    if (!option || this.clock < this.useUntil) return;
    const { target, kind } = option;
    const actor = this.player;
    this.useUntil = this.clock + 0.42;
    if (kind === "cache") {
      this.loot(actor, target);
      this.say("Took " + Object.entries(target.items).map(([id, quantity]) => quantity + " " + label(id).toLowerCase()).join(", ") + ".");
    } else if (kind === "resource") {
      this.harvest(target);
    } else if (kind === "water") {
      actor.hydration = Math.min(100, actor.hydration + 55);
      if (count(actor, "waterskin")) actor.water = 42;
      this.say(count(actor, "waterskin") ? "Drank and filled your waterskin." : "Drank fresh water.");
    } else if (kind === "campfire") {
      if (!target.lit) {
        target.lit = true;
        this.showPiece(target);
        this.say("Campfire lit.");
      } else if (count(actor, "meat")) {
        add(actor, "meat", -1);
        add(actor, "meal", 1);
        this.say("Cooked a meal.");
      } else this.say("Find game meat to cook.");
    } else if (kind === "gate") {
      target.open = !target.open;
      this.showPiece(target);
    } else if (kind === "wildlife") {
      target.harvested = true;
      add(actor, "meat", 2);
      this.say("Collected two portions of game meat.");
    }
    this.refreshFocus();
  }

  loot(actor, cache) {
    if (this.removed.has(cache.propIndex)) return;
    for (const [id, amount] of Object.entries(cache.items)) {
      add(actor, id, amount);
      if (actor.weapon === "fists") equips(actor, id);
    }
    const row = this.world.props[cache.propIndex] || this.changes.get(cache.propIndex);
    this.remove(cache);
    if (row && (row[0] === "cache" || cache.leavePack)) {
      cache.emptied = row[0] === "cache" ? "Stripped supply chest" : "Emptied pack";
      const remnant = [...row];
      remnant[9] = "remnant";
      this.changes.set(cache.propIndex, remnant);
    }
  }

  harvest(node, actor = this.player) {
    if (this.removed.has(node.propIndex)) return;
    const notify = message => { if (actor === this.player) this.say(message); };
    const hatchet = actor.weapon === "hatchet";
    if (node.type === "stone" && !hatchet) {
      notify("Equip a hatchet to mine stone.");
      return;
    }
    if (node.type === "tree" && !hatchet && actor.weapon !== "fists") {
      notify("Use your hands for fiber or equip a hatchet.");
      return;
    }
    const health = (this.nodeHealth.get(node.propIndex) ?? (node.type === "tree" ? 7 : 3)) -
      (node.type === "tree" && !hatchet ? 0 : 1);
    this.nodeHealth.set(node.propIndex, health);
    if (node.type === "tree") {
      add(actor, "fiber", 1);
      if (hatchet) {
        add(actor, "branch", 2);
        this.rivalNoise(actor, 35, "chop");
      }
      notify(hatchet ? "Collected wood and fiber." : "Collected fiber. A hatchet cuts wood.");
    } else if (node.type === "stone") {
      add(actor, "stone", 2);
      notify("Collected stone.");
    } else if (node.type === "berry") {
      actor.hunger = Math.min(100, actor.hunger + 21);
      notify("Ate berries.");
    } else {
      add(actor, "fiber", 2);
      add(actor, "tinder", 1);
      notify("Collected fiber and tinder.");
    }
    if (health <= 0) {
      this.remove(node);
      if (node.type === "tree") this.falling.set(node.propIndex, { born: this.clock, angle: actor.yaw });
    }
  }

  recentWorkSound() {
    const listener = this.player;
    if (!listener.alive) return null;
    for (let i = this.rivalSounds.length - 1; i >= 0; i--) {
      const sound = this.rivalSounds[i];
      if (this.clock - sound.at > 0.55) break;
      if (sound.kind !== "chop" && sound.kind !== "build") continue;
      const range = distance(listener, sound);
      if (range >= sound.radius) continue;
      const reach = this.lineClear(listener, sound) ? sound.radius : sound.radius * 0.68;
      if (range < reach) return {
        at: sound.at, kind: sound.kind, volume: 1 - range / reach,
        pan: range < 0.2 ? 0 : Math.sin(heading(listener, sound) - listener.yaw)
      };
    }
    return null;
  }

  workSite(actor) {
    const frame = actor.campFrame;
    if (frame && this.removed.has(frame.propIndex)) actor.campFrame = null;
    const camp = actor.campFrame;
    if (this.alive <= 3 || this.clock < (actor.nextWorkSearch || 0) ||
        actor.health < 40 || actor.hydration < 35 || actor.hunger < 35) return null;
    if (camp && (!camp.shelterFrame || distance(actor, camp) > 32 ||
        (this.storm.active && distance(camp, this.storm) >= this.storm.radius - 5))) return null;
    if (!camp && this.pieces.some(p => p.owner === actor.id && !this.removed.has(p.propIndex))) return null;
    actor.nextWorkSearch = this.clock + 3;
    const recipe = builds.find(row => row[0] === (camp ? "lean_to" : "barricade"));
    if (recipeAffordable(actor, recipe, true)) {
      if (camp) return { ...camp.workSpot, workNode: { ...camp.workSpot, type: "roof", propIndex: camp.propIndex } };
      return { x: actor.x, z: actor.z, workNode: { x: actor.x, z: actor.z, type: "camp" } };
    }
    let best = null, nearest = 22;
    const needs = id => count(actor, id) < (recipe[2][id] || 0);
    for (const cache of this.map.caches) {
      const model = this.world.props[cache.propIndex]?.[0];
      const useful = model === "cache" || needs(model) || (model === "hatchet" && !count(actor, "hatchet"));
      if (!useful || this.removed.has(cache.propIndex)) continue;
      if (camp && distance(cache, camp) > 30) continue;
      const range = distance(actor, cache);
      if (range >= nearest || (range > 2 && Math.abs(angleDifference(heading(actor, cache), actor.yaw)) > 1.7)) continue;
      if ((this.storm.active && distance(cache, this.storm) >= this.storm.radius - 6) || !this.lineClear(actor, cache)) continue;
      best = { x: cache.x, z: cache.z, workNode: cache };
      nearest = range;
    }
    for (const node of this.map.nodes) {
      const useful = (node.type === "tree" && count(actor, "hatchet") && (needs("branch") || needs("fiber"))) ||
        (node.type === "fiber" && needs("fiber"));
      if (!useful || this.removed.has(node.propIndex)) continue;
      if (camp && distance(node, camp) > 30) continue;
      const range = distance(actor, node);
      if (range < 0.1 || range >= nearest || Math.abs(angleDifference(heading(actor, node), actor.yaw)) > 1.7) continue;
      if (this.storm.active && distance(node, this.storm) >= this.storm.radius - 6) continue;
      const offset = Math.min(1, 1.65 / range);
      const edge = { x: node.x + (actor.x - node.x) * offset, z: node.z + (actor.z - node.z) * offset };
      if (!this.canOccupy(edge.x, edge.z) || !this.lineClear(actor, edge)) continue;
      best = { ...edge, workNode: node };
      nearest = range;
    }
    return best;
  }

  finishRoof(actor, recipe) {
    const frame = actor.campFrame;
    if (!frame?.shelterFrame || this.removed.has(frame.propIndex) || !recipeAffordable(actor, recipe, true)) return false;
    // Both sides use the frame's actual orientation. The roof sits beside the
    // cover and the worker stays outside its footprint when the roof goes up.
    for (const yaw of [frame.angle, frame.angle + Math.PI]) {
      const roof = this.blueprint({ id: actor.id, x: frame.x, z: frame.z, yaw }, recipe, 0, 2.25);
      if (!roof.fits || distance(actor, roof) < 2.2) continue;
      this.installPiece(actor, recipe, roof);
      frame.shelterFrame = false;
      this.showPiece(frame);
      break;
    }
    actor.roofStarted = null;
    return false;
  }

  workAt(actor, site) {
    const node = site.workNode;
    if (!node || this.removed.has(node.propIndex) || this.alive <= 3) return false;
    actor.speed = 0;
    actor.yaw = heading(actor, node);
    if (distance(actor, node) > 2.7 || !this.lineClear(actor, site)) return false;
    if (this.clock < (actor.nextWorkStroke || 0)) return true;
    actor.nextWorkStroke = this.clock + 1.05;
    const camp = actor.campFrame;
    const recipe = builds.find(row => row[0] === (camp ? "lean_to" : "barricade"));
    if (node.type === "roof") {
      if (!camp?.shelterFrame || camp.propIndex !== node.propIndex || !recipeAffordable(actor, recipe, true)) return false;
      actor.yaw = heading(actor, camp);
      if (actor.roofStarted == null) actor.roofStarted = this.clock;
      actor.swing = 0.4;
      this.rivalNoise(actor, 14, "build");
      return this.clock - actor.roofStarted < 4 || this.finishRoof(actor, recipe);
    }
    if (camp && recipeAffordable(actor, recipe, true)) return false;
    if (!camp && recipeAffordable(actor, recipe, true)) {
      const facing = actor.yaw;
      for (const turn of [Math.PI, Math.PI / 2, -Math.PI / 2]) {
        actor.yaw = facing + turn;
        const piece = this.blueprint(actor, recipe, 0);
        if (!piece.fits) continue;
        piece.shelterFrame = true;
        piece.workSpot = { x: actor.x, z: actor.z };
        actor.campFrame = piece;
        this.installPiece(actor, recipe, piece);
        break;
      }
      return false;
    }
    if (node.items) {
      this.loot(actor, node);
      actor.nextWorkSearch = this.clock + 0.5;
      return false;
    }
    if (node.type === "camp" || (node.type === "tree" && !count(actor, "hatchet"))) return false;
    if (camp && node.type === "tree" && count(actor, "branch") >= recipe[2].branch && count(actor, "fiber") >= recipe[2].fiber) return false;
    if (node.type === "tree") equips(actor, "hatchet");
    actor.swing = 0.48;
    actor.cooldown = Math.max(actor.cooldown, weapons.hatchet.delay);
    this.harvest(node, actor);
    return true;
  }

  canOccupy(x, z, padding = 0.28) {
    if (!this.map.canOccupy(x, z, this.removed)) return false;
    return this.pieces.every(piece => {
      if (piece.open || piece.h < 0.65 || this.removed.has(piece.propIndex)) return true;
      const vx = x - piece.x;
      const vz = z - piece.z;
      const c = Math.cos(piece.angle);
      const s = Math.sin(piece.angle);
      return Math.abs(vx * c - vz * s) > piece.w / 2 + padding || Math.abs(vx * s + vz * c) > piece.d / 2 + padding;
    });
  }

  move(actor, right, forward, seconds, speed) {
    const length = Math.max(1, Math.hypot(right, forward));
    const dx = (Math.sin(actor.yaw) * forward + Math.cos(actor.yaw) * right) * seconds * speed / length;
    const dz = (Math.cos(actor.yaw) * forward - Math.sin(actor.yaw) * right) * seconds * speed / length;
    if (this.canOccupy(actor.x + dx, actor.z)) actor.x += dx;
    if (this.canOccupy(actor.x, actor.z + dz)) actor.z += dz;
    actor.y = this.map.heightAt(actor.x, actor.z) + actor.jump;
    actor.speed = Math.hypot(dx, dz) / Math.max(0.001, seconds);
    actor.anim += (1 + actor.speed * 1.15) * seconds;
  }

  attack(actor, strength = 1, weapon = weapons[actor.weapon]) {
    if (actor.cooldown > 0 || !actor.alive) return;
    if (weapon.ammo) {
      if (actor.weapon === "crossbow" && !actor.crossbowLoaded) return;
      if (!count(actor, weapon.ammo)) {
        if (actor === this.player) this.say("Find " + label(weapon.ammo).toLowerCase() + " to fire.");
        return;
      }
      if (this.projectile(actor, weapon, strength)) {
        add(actor, weapon.ammo, -1);
        if (actor.weapon === "crossbow") actor.crossbowLoaded = false;
      }
      return;
    }
    actor.cooldown = weapon.delay;
    actor.swing = 0.48;
    actor.attackedAt = this.clock;
    this.rivalNoise(actor, 17, "strike");
    const aligned = target => distance(actor, target) <= weapon.reach &&
      Math.abs(angleDifference(actor.yaw, heading(actor, target))) < 0.56 &&
      this.lineClear(actor, target);
    const handHeight = actor.y + (actor.crouch ? 0.82 : 1.18);
    const incline = actor === this.player ? Math.sin(this.input.pitch || 0) : 0;
    const reachHeight = target => handHeight + incline * distance(actor, target) - target.y;
    const target = this.actors.filter(other => {
      if (other === actor || !other.alive || !aligned(other)) return false;
      const height = reachHeight(other);
      return height >= -0.2 && height <= (other.crouch ? 1.55 : 2.05);
    }).sort((a, b) => distance(actor, a) - distance(actor, b))[0];
    if (target) {
      this.damage(target, weapon.damage, actor, { height: reachHeight(target) });
      return;
    }
    if (actor !== this.player) return;
    const animal = this.wildlife.find(candidate => candidate.health > 0 && aligned(candidate));
    if (animal) {
      animal.health -= weapon.damage;
      this.hitUntil = this.clock + 0.23;
      return;
    }
    const prop = this.focus.find(option => option.kind === "resource" && distance(actor, option.target) <= Math.max(weapon.reach, 2.85));
    if (prop) {
      this.harvest(prop.target);
      this.refreshFocus();
      return;
    }
    const piece = this.pieces.find(candidate => !this.removed.has(candidate.propIndex) && distance(actor, candidate) < weapon.reach &&
      Math.abs(angleDifference(actor.yaw, heading(actor, candidate))) < 0.6);
    if (piece && (piece.health -= weapon.damage) <= 0) {
      this.remove(piece);
      const recipe = builds.find(([id]) => id === piece.id);
      const salvage = piece.id === "wall" || piece.id === "gate" ? 3 : piece.id === "fire" ? 1 : 2;
      const wood = Math.min(recipe?.[2].branch ?? 0, salvage);
      if (wood > 0) this.drop(piece.x, piece.z, { branch: wood });
      this.say("Structure broken.");
    }
  }

  projectile(actor, weapon, strength) {
    if (actor.cooldown > 0 || !actor.alive) return false;
    actor.cooldown = weapon.delay;
    actor.swing = 0.36;
    actor.attackedAt = this.clock;
    this.rivalNoise(actor, 23, "shot");
    const pitch = actor === this.player ? this.input.pitch || 0 : actor.aimPitch || 0;
    this.shots.push({
      owner: actor, model: weapon.shot, x: actor.x, y: actor.y + (actor.crouch ? 1.06 : 1.46), z: actor.z,
      yaw: actor.yaw, pitch, speed: weapon.speed * (0.65 + 0.35 * strength), range: weapon.range,
      damage: weapon.damage * (0.56 + 0.44 * strength)
    });
    return true;
  }

  lineClear(from, to) {
    const eye = from.y + (from.crouch ? 1.04 : 1.6);
    const end = (to.y ?? this.map.heightAt(to.x, to.z)) + (to.crouch ? 0.99 : to.alive ? 1.55 : 0.55);
    return this.map.clearSight(from, to, eye, end, this.removed) &&
      !this.pieces.some(piece => !piece.open && !this.removed.has(piece.propIndex) && crossesPiece(from, to, eye, end, piece));
  }

  damage(actor, amount, source, contact = {}) {
    if (!actor.alive) return;
    if (source) {
      const incoming = contact.angle ?? heading(actor, source);
      const height = contact.height ?? 1.1;
      const shieldCenter = actor.crouch ? 0.78 : 1.12;
      const hitsShield = Math.abs(angleDifference(incoming, actor.yaw)) < 0.79 &&
        Math.abs(height - shieldCenter) < 0.48 && Math.abs(contact.side || 0) < 0.53;
      if (hasShield(actor) && actor.guard && hitsShield && actor.stamina >= 6) {
        actor.stamina -= 6;
        amount *= 0.1;
        if (actor === this.player) this.say("Shield caught the hit.");
      }
      if (actor.armor) amount *= actor.armor === "scrap_cuirass" ? 0.64 : 0.79;
      if (actor === this.player) this.impactAngle = incoming;
      if (source === this.player) this.hitUntil = this.clock + 0.25;
      actor.woundedAt = this.clock;
      if (actor !== this.player) actor.decision = this.clock;
    }
    actor.health = Math.max(0, actor.health - amount);
    if (amount >= 1) actor.hurt = source ? 0.43 : Math.max(actor.hurt, 0.12);
    if (actor.health > 0) return;
    actor.alive = false;
    actor.placement = this.alive--;
    if (Object.keys(actor.bag).length) this.drop(actor.x, actor.z, { ...actor.bag }, true);
    this.feed = source ? source.name + " eliminated " + actor.name + "." : actor.name + " was lost to the arena.";
    this.feedUntil = this.clock + 5;
    if (this.alive <= 1) this.winner = this.actors.find(candidate => candidate.alive)?.name || actor.name;
  }

  stepShots(seconds) {
    const remaining = [];
    for (const shot of this.shots) {
      const travel = shot.speed * seconds;
      let ended = false;
      for (let step = 0, steps = Math.max(1, Math.ceil(travel / 0.55)); step < steps; step++) {
        const stride = travel / steps;
        shot.x += Math.sin(shot.yaw) * Math.cos(shot.pitch) * stride;
        shot.z += Math.cos(shot.yaw) * Math.cos(shot.pitch) * stride;
        shot.y += Math.sin(shot.pitch) * stride;
        shot.range -= stride;
        if (shot.range <= 0 || shot.y <= this.map.heightAt(shot.x, shot.z) || !this.canOccupy(shot.x, shot.z, 0)) {
          ended = true;
          break;
        }
        const hit = this.actors.find(actor => actor !== shot.owner && actor.alive && distance(actor, shot) < 0.62 &&
          shot.y >= actor.y + 0.13 && shot.y < actor.y + (actor.crouch ? 1.24 : 1.78));
        if (hit) {
          this.damage(hit, shot.damage, shot.owner, {
            angle: shot.yaw + Math.PI, height: shot.y - hit.y,
            side: Math.cos(hit.yaw) * (shot.x - hit.x) - Math.sin(hit.yaw) * (shot.z - hit.z)
          });
          ended = true;
          break;
        }
        const animal = this.wildlife.find(candidate => candidate.health > 0 && distance(candidate, shot) < 0.86 &&
          Math.abs(this.map.heightAt(candidate.x, candidate.z) + 0.7 - shot.y) < 0.68);
        if (animal) {
          animal.health -= shot.damage;
          if (shot.owner === this.player) this.hitUntil = this.clock + 0.25;
          ended = true;
          break;
        }
      }
      shot.pitch = Math.max(-1.5, shot.pitch - seconds * (shot.model === "bolt" ? 0.064 : 0.16));
      if (!ended) {
        remaining.push(shot);
      } else if (this.canOccupy(shot.x, shot.z, 0)) {
        const recoverable = { arrow: "arrows", bolt: "bolts", spear: "spear" }[shot.model];
        if (recoverable) this.drop(shot.x, shot.z, { [recoverable]: 1 });
      }
    }
    this.shots = remaining;
  }

  rivalNoise(actor, radius, kind) {
    if (!actor.alive) return;
    this.rivalSounds.push({ id: ++this.soundSerial, source: actor.id, x: actor.x, z: actor.z, at: this.clock, radius, kind });
  }

  heardBy(actor) {
    let best = null, volume = 0;
    for (let i = this.rivalSounds.length - 1; i >= 0; i--) {
      const sound = this.rivalSounds[i];
      if (sound.id <= actor.lastSound || this.clock - sound.at > 1.1) break;
      if (sound.source === actor.id) continue;
      const loudness = 1 - distance(actor, sound) / sound.radius;
      if (loudness > volume) { best = sound; volume = loudness; }
    }
    actor.lastSound = this.soundSerial;
    if (best) {
      const error = 0.4 + 2.2 * (1 - volume), angle = this.map.random() * TAU;
      actor.soundMemory = { x: best.x + Math.sin(angle) * error, z: best.z + Math.cos(angle) * error,
        source: best.source, at: best.at, kind: best.kind };
    }
    return actor.soundMemory && this.clock - actor.soundMemory.at < 4.5 ? actor.soundMemory : null;
  }

  canSeeRival(actor, other) {
    if (other === actor || !other.alive) return false;
    const reach = distance(actor, other);
    const range = other.crouch ? 17 : actor.style === "hunter" ? 43 : 35;
    if (reach > range || (reach > 2.2 && Math.abs(angleDifference(actor.yaw, heading(actor, other))) > 1.45)) return false;
    return this.lineClear(actor, other);
  }

  supplyFor(actor, takeAny) {
    let best = null, score = Infinity;
    for (const group of [this.map.caches, this.dropped]) {
      for (const cache of group) {
        if (this.removed.has(cache.propIndex)) continue;
        const reach = distance(actor, cache);
        if (reach > 28 || reach > score + 6) continue;
        const model = this.world.props[cache.propIndex]?.[0] || "pack";
        const container = model === "cache" || model === "pack";
        const needsGear = actor.weapon === "fists", needsAid = actor.health < 65, needsFood = actor.hunger < 60;
        const useful = (needsGear && Object.hasOwn(weapons, model)) || (needsAid && model === "bandage") ||
          (needsFood && (model === "meal" || model === "berries"));
        if (!useful && !takeAny && !(container && (needsGear || needsAid || needsFood))) continue;
        const value = reach - (useful && !takeAny ? 5 : 0);
        if (value >= score || (reach > 3 && Math.abs(angleDifference(actor.yaw, heading(actor, cache))) > 1.55) ||
          !this.lineClear(actor, cache)) continue;
        score = value;
        best = cache;
      }
    }
    return best;
  }

  rivalExit(actor, threat) {
    const angle = (threat ? heading(threat, actor) : Math.atan2(actor.x, actor.z)) +
      (actor.id % 2 ? 0.28 : -0.28);
    const x = actor.x + Math.sin(angle) * 16, z = actor.z + Math.cos(angle) * 16;
    const scale = Math.min(1, this.storm.radius * 0.96 / Math.max(1, Math.hypot(x - this.storm.x, z - this.storm.z)));
    return { x: this.storm.x + (x - this.storm.x) * scale, z: this.storm.z + (z - this.storm.z) * scale };
  }

  rivalPlan(actor, intent, goal, lookAt = null, opponent = null) {
    if (intent !== "work" || goal?.workNode?.type !== "roof") actor.roofStarted = null;
    actor.intent = intent;
    actor.target = goal;
    actor.lookAt = lookAt;
    actor.opponent = opponent;
  }

  thinkRival(actor) {
    const now = this.clock, age = now - ROUND_START, opening = age < 14;
    const bold = actor.style === "fighter", cautious = actor.style === "runner" || actor.style === "stalker";
    const sound = this.heardBy(actor);
    const visible = this.actors.filter(other => this.canSeeRival(actor, other));
    for (const rival of visible) {
      if (rival.hurt > 0 && now - rival.woundedAt < 0.43) actor.seenHits.set(rival.id, now);
      if (rival.swing > 0 && now - rival.attackedAt < 0.48) {
        actor.seenSwings.set(rival.id, { x: rival.x, z: rival.z, yaw: rival.yaw, at: now });
      }
    }
    const exposed = other => now - (actor.seenHits.get(other.id) ?? -Infinity) < 2.6 ||
      (other.weapon === "crossbow" && other.reload > 0);
    const rank = other => distance(actor, other) - (exposed(other) ? 7 : 0) -
      (other.id === actor.opponent ? 3 : 0);
    visible.sort((a, b) => rank(a) - rank(b));
    const enemy = visible[0], third = visible[1];
    const sight = enemy && { x: enemy.x, z: enemy.z, at: now, id: enemy.id };
    if (sight) actor.lastSeen = sight;
    if (this.storm.active && distance(actor, this.storm) > this.storm.radius - Math.min(2.5, this.storm.radius * 0.12)) {
      return this.rivalPlan(actor, "storm", { x: this.storm.x, z: this.storm.z });
    }
    if (actor.intent === "retreat" && now < actor.escapeUntil && actor.target && distance(actor, actor.target) > 2) return;
    // Carry a successful grab out of the plaza. Losing a pursuer's sight on the
    // first step should not make a runner turn back toward the same fight.
    const leaveOpening = actor.style === "runner" && (actor.openingLoot || age > 5) ||
      actor.style === "hunter" && age > (actor.aggression < 0.55 ? 2 : 8) ||
      actor.style === "stalker" && age > 10;
    if (!actor.leftPlaza && this.alive > 3 && age < 25 && leaveOpening) {
      if (!actor.openingRoute) {
        const angle = Math.atan2(actor.x, actor.z) + (actor.id % 2 ? 0.25 : -0.25);
        const radius = 42 + actor.aggression * 18;
        actor.openingRoute = { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
      }
      if (distance(actor, actor.openingRoute) > 2.5) {
        actor.lastSeen = null;
        return this.rivalPlan(actor, "retreat", actor.openingRoute);
      }
      actor.leftPlaza = true;
      actor.lastSeen = null;
    }
    if (enemy) {
      const reach = distance(actor, enemy);
      const contact = reach < 4.3 || (reach < 14 && now - actor.woundedAt < 1.8);
      const outmatched = actor.weapon === "fists" && enemy.weapon !== "fists";
      const extraThreat = third || (sound && sound.source !== enemy.id && now - sound.at < 1.8);
      const swungAt = (striker, rival) => {
        const swing = actor.seenSwings.get(striker.id);
        return swing && now - swing.at < 2.6 && Math.abs(angleDifference(swing.yaw, heading(swing, rival))) < 1.1;
      };
      const trading = third && distance(enemy, third) < 13 && (swungAt(enemy, third) || swungAt(third, enemy));
      const vulnerable = exposed(enemy);
      const needsRecovery = actor.health < 48 || actor.stamina < 23 || actor.hunger < 26 || actor.hydration < 26;
      if (this.alive > 2 && ((needsRecovery && extraThreat) ||
        (contact && (actor.health < 25 || (outmatched && cautious))))) {
        actor.escapeUntil = now + 3.5;
        return this.rivalPlan(actor, "retreat", this.rivalExit(actor, sight));
      }
      if (trading && !contact && (cautious || this.alive === 3) && !(vulnerable && actor.health > 48)) {
        return this.rivalPlan(actor, "watch", { x: actor.x, z: actor.z }, sight);
      }
      if ((contact && (!opening || bold || !outmatched)) ||
        ((!opening || (bold && actor.weapon !== "fists")) &&
          (!outmatched || vulnerable || this.alive === 2) &&
          (!cautious || vulnerable || this.alive === 2 || reach < 8 || trading))) {
        return this.rivalPlan(actor, "engage", sight, null, enemy.id);
      }
      if (opening && actor.style === "stalker" && !contact && !vulnerable) {
        return this.rivalPlan(actor, "watch", { x: actor.x, z: actor.z }, sight);
      }
      if (!opening && cautious && (actor.weapon !== "fists" || outmatched)) {
        return this.rivalPlan(actor, "watch", reach < 7 ? this.rivalExit(actor, sight) : { x: actor.x, z: actor.z }, sight);
      }
    }
    if (!enemy) {
      const memory = actor.lastSeen;
      if (cautious && this.alive > 2 && sound && (sound.kind === "strike" || sound.kind === "shot") &&
        (!memory || memory.at < sound.at) && distance(actor, sound) < 12) {
        actor.escapeUntil = now + 2.8;
        return this.rivalPlan(actor, "retreat", this.rivalExit(actor, sound));
      }
      if (sound && (!memory || sound.at > memory.at)) return this.rivalPlan(actor, "investigate", sound);
      if (memory && now - memory.at < (actor.style === "hunter" ? 8 : 5.5)) return this.rivalPlan(actor, "search", memory);
      if (sound) return this.rivalPlan(actor, "investigate", sound);
      if (actor.health < 75 && count(actor, "bandage")) {
        add(actor, "bandage", -1);
        actor.health = Math.min(100, actor.health + 28);
      }
      if (actor.hunger < 68) {
        const food = count(actor, "meal") ? "meal" : "berries";
        if (count(actor, food)) {
          add(actor, food, -1);
          actor.hunger = Math.min(100, actor.hunger + (food === "meal" ? 42 : 18));
        }
      }
      if (actor.hydration < 58) {
        if (actor.water > 0 && count(actor, "waterskin")) {
          const drink = Math.min(24, actor.water);
          actor.water -= drink;
          actor.hydration += drink;
        } else if (this.map.surfaceAt(actor.x, actor.z) > this.map.heightAt(actor.x, actor.z) + 0.05) {
          actor.hydration = Math.min(100, actor.hydration + 55);
        } else {
          const spring = this.map.waterSources.find(source => distance(actor, source) < 18 && this.lineClear(actor, source));
          if (spring) return this.rivalPlan(actor, "drink", spring);
        }
      }
    }
    const supply = this.supplyFor(actor, opening && !actor.openingLoot && actor.style === "runner");
    if (supply) return this.rivalPlan(actor, "loot", supply);
    if (this.alive > 2 && (!opening || actor.leftPlaza) && !enemy && (actor.style === "runner" || actor.style === "hunter")) {
      if (actor.intent === "work" && actor.target && !this.removed.has(actor.target.workNode?.propIndex)) return;
      const site = this.workSite(actor);
      if (site) return this.rivalPlan(actor, "work", site);
    }
    if (actor.intent === "roam" && actor.target && distance(actor, actor.target) > 2) return;
    const angle = opening ? Math.atan2(actor.x, actor.z) : this.map.random() * TAU;
    const radius = opening ? 27 + actor.aggression * 9 : Math.max(2, this.storm.radius * (0.15 + 0.65 * this.map.random()));
    this.rivalPlan(actor, "roam", { x: this.storm.x + Math.sin(angle) * radius, z: this.storm.z + Math.cos(angle) * radius });
  }

  bot(actor, seconds) {
    const current = weapons[actor.weapon];
    if (current.ammo && !count(actor, current.ammo)) {
      equips(actor, Object.keys(weapons).reverse().find(id => weapons[id].reach && count(actor, id)) || "fists");
    }
    if (actor.decision <= this.clock) {
      actor.decision = this.clock + 0.32 + this.map.random() * 0.25;
      this.thinkRival(actor);
    }
    const target = actor.target;
    if (!target) return;
    const reach = distance(actor, target), intent = actor.intent;
    actor.speed = 0;
    actor.guard = false;
    actor.crouch = intent === "watch" || (intent === "search" && actor.style === "stalker");
    if (intent === "engage") {
      const enemy = this.actors.find(other => other.id === actor.opponent), weapon = weapons[actor.weapon];
      const attackRange = weapon.ammo ? weapon.range * 0.68 : weapon.reach;
      if (enemy && reach < attackRange + 1) {
        actor.yaw = heading(actor, target);
        actor.guard = hasShield(actor) && actor.cooldown > 0.18;
        if (actor.cooldown <= 0 && this.canSeeRival(actor, enemy) && distance(actor, enemy) <= attackRange) {
          actor.yaw = heading(actor, enemy);
          actor.aimPitch = Math.atan2(enemy.y - actor.y + (enemy.crouch ? -0.64 : -0.29) + reach * reach * 0.0009, Math.max(0.2, reach));
          this.attack(actor);
          return;
        }
        if (actor.cooldown > 0 && reach < attackRange * 0.85) return;
      }
    }
    if (intent === "loot" && reach < 2.15 && this.lineClear(actor, target)) {
      if (!this.removed.has(target.propIndex)) {
        this.loot(actor, target);
        actor.openingLoot = true;
      }
      actor.target = null;
      actor.decision = 0;
      return;
    }
    if (intent === "work" && (reach < 0.5 || distance(actor, target.workNode) <= 2.7)) {
      if (!this.workAt(actor, target)) { actor.target = null; actor.decision = 0; }
      return;
    }
    if (intent === "drink" && reach < 2.3) {
      actor.hydration = Math.min(100, actor.hydration + 55);
      if (count(actor, "waterskin")) actor.water = 42;
      actor.target = null;
      actor.decision = 0;
      return;
    }
    if (reach < 1.0) {
      if (actor.lookAt) actor.yaw = heading(actor, actor.lookAt);
      else if (intent === "investigate" || intent === "search") actor.yaw += seconds * (actor.id % 2 ? 1.25 : -1.25);
      return;
    }
    const yaw = heading(actor, target), side = actor.id % 2 ? 1 : -1;
    const speed = actor.crouch ? 2.05 : intent === "retreat" && !actor.winded ? 5.8 : 3.7 + actor.aggression * 0.9;
    for (const offset of [0, 0.55, -0.55, 1.1, -1.1, 1.65]) {
      actor.yaw = yaw + side * offset;
      if (!this.canOccupy(actor.x + Math.sin(actor.yaw) * 0.75, actor.z + Math.cos(actor.yaw) * 0.75)) continue;
      this.move(actor, 0, 1, seconds, speed);
      break;
    }
  }

  updateActor(actor, seconds) {
    if (!actor.alive) return;
    const oldX = actor.x, oldZ = actor.z;
    actor.cooldown = Math.max(0, actor.cooldown - seconds);
    actor.hurt = Math.max(0, actor.hurt - seconds);
    actor.swing = Math.max(0, actor.swing - seconds);
    if (actor.weapon === "crossbow" && !actor.crossbowLoaded && count(actor, "bolts")) {
      actor.reload += seconds;
      if (actor.reload >= 4) {
        actor.crossbowLoaded = true;
        actor.reload = 0;
      }
    }
    if (actor !== this.player) {
      this.bot(actor, seconds);
      actor.stamina = clamp(actor.stamina + seconds * (actor.speed > 5 ? -13 : 16), 0, 100);
      if (actor.stamina < 8) actor.winded = true;
      if (actor.stamina > 34) actor.winded = false;
    } else {
      const { right = 0, forward = 0, sprint, crouch } = this.input;
      actor.crouch = Boolean(crouch);
      const run = sprint && actor.stamina > 4 && !actor.guard && !actor.crouch && Math.hypot(right, forward) > 0.08;
      const water = this.map.surfaceAt(actor.x, actor.z) - this.map.heightAt(actor.x, actor.z);
      const speed = (actor.crouch ? 2.22 : run ? 7.3 : 4.65) * (actor.guard ? 0.62 : 1) * (water > 0.3 ? 0.62 : 1);
      actor.stamina = clamp(actor.stamina + seconds * (run ? -13 : 16), 0, 100);
      if (actor.jump > 0 || actor.verticalSpeed > 0) {
        actor.jump = Math.max(0, actor.jump + actor.verticalSpeed * seconds);
        actor.verticalSpeed = actor.jump > 0 ? actor.verticalSpeed - 19 * seconds : 0;
      }
      this.move(actor, right, forward, seconds, speed);
      if (this.hold.has("attack") && !weapons[actor.weapon].ammo && actor.cooldown <= 0) this.attack(actor);
    }
    if (!actor.crouch && actor.speed > 5 && this.clock >= actor.nextStepNoise &&
      Math.hypot(actor.x - oldX, actor.z - oldZ) > seconds * 2.5) {
      actor.nextStepNoise = this.clock + 0.48;
      this.rivalNoise(actor, 15, "footsteps");
    }
    actor.hunger = Math.max(0, actor.hunger - seconds * (actor.speed > 5 ? 0.5 : 0.25));
    actor.hydration = Math.max(0, actor.hydration - seconds * (actor.speed > 5 ? 0.7 : 0.36));
    if (!actor.hunger || !actor.hydration) this.damage(actor, seconds * 2.2);
    if (this.storm.active && distance(actor, this.storm) > this.storm.radius) {
      this.damage(actor, seconds * (this.storm.radius < 35 ? 8 : 4));
    }
  }

  step(seconds) {
    seconds = clamp(seconds, 0, 0.15);
    if (this.winner) return;
    this.clock += seconds;
    const elapsed = this.clock - ROUND_START;
    if (elapsed < 0) return;
    while (this.rivalSounds.length && this.clock - this.rivalSounds[0].at > 1.2) this.rivalSounds.shift();
    const stormTime = Math.max(0, elapsed - 38);
    const radius = this.world.radius;
    this.storm.radius = Math.max(5, radius - stormTime * 0.87);
    this.storm.nextRadius = Math.max(5, this.storm.radius - 30);
    this.storm.seconds = Math.max(0, -elapsed + 38);
    this.storm.warning = elapsed > 22 && elapsed < 38;
    this.storm.active = elapsed >= 38;
    this.storm.moving = this.storm.active && this.storm.radius > 5;
    for (const actor of this.actors) {
      if (!this.winner) this.updateActor(actor, seconds);
    }
    for (const animal of this.wildlife) {
      if (animal.health <= 0) continue;
      if (distance(animal, this.player) < 10) animal.yaw = heading(this.player, animal);
      else animal.yaw += Math.sin(this.clock * 0.45 + animal.phase) * seconds * 0.75;
      const pace = distance(animal, this.player) < 10 ? 3.8 : 0.8;
      const x = animal.x + Math.sin(animal.yaw) * seconds * pace;
      const z = animal.z + Math.cos(animal.yaw) * seconds * pace;
      if (this.canOccupy(x, z)) {
        animal.x = x;
        animal.z = z;
      } else animal.yaw += 0.8;
      animal.phase += seconds * pace;
    }
    if (this.player.alive) this.refreshFocus();
    this.stepShots(seconds);
    for (const [id, fall] of this.falling) {
      const age = this.clock - fall.born;
      if (age >= 1.65) {
        this.falling.delete(id);
        this.changes.set(id, null);
      } else {
        const record = [...this.world.props[id]];
        record[11] = age;
        record[12] = fall.angle;
        this.changes.set(id, record);
      }
    }
  }

  frame() {
    const actor = this.player;
    const countdown = Math.max(0, ROUND_START - this.clock);
    const selected = this.focus[this.focusChoice];
    const blueprint = this.blueprint();
    const shield = hasShield(actor);
    const daylight = clamp(0.87 + Math.cos(this.clock / 82) * 0.14, 0.48, 1);
    const { x, y, z, yaw } = actor;
    const lean = this.input.lean * 0.28 || 0;
    const cameraX = x + Math.cos(yaw) * lean;
    const cameraZ = z - Math.sin(yaw) * lean;
    const leaning = lean && this.canOccupy(cameraX, cameraZ, 0);
    return {
      type: "frame", round: this.world.round, clock: this.clock, time: this.clock,
      mode: "match", daylight, rain: false, flood: false,
      camera: { x: leaning ? cameraX : x, y: y + (actor.crouch ? 1.08 : 1.65),
        z: leaning ? cameraZ : z, yaw, pitch: this.input.pitch || 0 },
      storm: this.storm, workSound: this.recentWorkSound(),
      propChanges: [...this.changes],
      actors: this.actors.filter(other => other !== actor && distance(actor, other) < 105)
        .map(other => [other.x, other.y, other.z, other.yaw, other.alive, other.crouch,
          other.style, other.name, other.yaw, other.anim, other.speed, other.weapon,
          hasShield(other), hasShield(other) && other.guard, Number(other.guard), other.reload / 4,
          other.crossbowLoaded, other.swing, this.clock - other.woundedAt < 0.43 ? other.hurt / 0.43 : 0]),
      wildlife: this.wildlife.filter(animal => !animal.harvested && distance(actor, animal) < 85)
        .map(animal => [animal.model, animal.x, this.map.heightAt(animal.x, animal.z), animal.z, animal.yaw, animal.health > 0, animal.phase]),
      shots: this.shots.map(shot => [shot.model, shot.x, shot.y, shot.z, shot.yaw, Math.PI / 2 - shot.pitch]),
      ghost: blueprint && itemRow(blueprint.id, blueprint.x, blueprint.y, blueprint.z,
        blueprint.w, blueprint.h, blueprint.d, "structure", blueprint.angle),
      ghostFits: Boolean(blueprint?.fits),
      player: {
        id: actor.id, name: actor.name, yaw, pitch: this.input.pitch || 0,
        health: actor.health, stamina: actor.stamina, hunger: actor.hunger, hydration: actor.hydration,
        water: actor.water, weapon: actor.weapon, armor: actor.armor, aim: actor.guard && !shield,
        hurt: actor.hurt, swing: actor.swing, shield, guard: actor.guard, shieldRaised: actor.guard && shield,
        guardBlend: Number(actor.guard), crossbowLoaded: actor.crossbowLoaded, reload: actor.reload / 4, reloadSeconds: 4,
        speed: actor.speed, alive: actor.alive, placement: actor.placement
      },
      alive: this.alive, countdown, winner: this.winner,
      hud: {
        hint: blueprint ? blueprint.fits ? "[Attack] Place " + label(blueprint.id).toLowerCase() : "" :
          selected ? "[E] " + selected.title : this.nearbyRemnant || (this.clock < 15 ? "Look for supplies near the center or along trails." : ""),
        notice: this.clock < this.noticeUntil ? this.notice : "",
        event: !countdown && this.clock < 9 ? "Outlast 23 arena bots." : "",
        feed: this.clock < this.feedUntil ? this.feed : "",
        progress: 0,
        charge: this.drawStarted !== null ? clamp((this.clock - this.drawStarted) / 0.8) :
          this.throwStarted !== null ? clamp((this.clock - this.throwStarted) / 0.75) : 0,
        zone: this.map.zoneAt?.(x, z) || "Arena",
        impact: actor.hurt > 0.15 ? actor.hurt : 0, impactAngle: this.impactAngle, impactStrength: 0.7,
        confirmed: Math.max(0, this.hitUntil - this.clock),
        buildId: blueprint?.id || "", buildProblem: blueprint && !blueprint.fits ? "Find clear ground." : "",
        useAction: selected?.kind || "", focusOptions: this.focus.map(option => option.title), focusChoice: this.focusChoice
      },
      pack: Object.entries(actor.bag).map(([id, quantity]) => [id, label(id), quantity])
        .sort((a, b) => a[1].localeCompare(b[1])),
      craft: recipeRows(actor, crafts),
      build: recipeRows(actor, builds, true)
    };
  }
}
