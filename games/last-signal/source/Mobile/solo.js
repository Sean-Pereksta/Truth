import { createSoloWorld } from "./solo-world.js";
import {
  collapseFort, fortBlocksActor, fortGround, fortSizes, FORT_STEP_HEIGHT,
  playerFortPiece, playerFortRecipes, previewPlayerFort, updatePlayerFort,
  rivalFortApproach, rivalFortCandidate, rivalFortDescent, stepRivalFort
} from "./solo-forts.js";

const TAU = Math.PI * 2;
const ROUND_START = 4;
const REACH = 3.25;
const BOT_NAMES = [
  "Ash", "Briar", "Dove", "Flint", "Gale", "Iris", "Juniper", "Lark", "Marl",
  "Nettle", "Onyx", "Piper", "Reed", "Rowan", "Sable", "Sage", "Sparrow",
  "Thorn", "Vale", "Vesper", "Willow", "Wren", "Yarrow"
];
const BOT_STYLES = ["fighter", "runner", "hunter", "stalker"];
const tendencies = {
  fighter: { opening: 0.94, risk: 0.72, track: 0.4 },
  runner: { opening: 0.42, risk: 0.45, track: 0.46 },
  hunter: { opening: 0.53, risk: 0.57, track: 0.85 },
  stalker: { opening: 0.14, risk: 0.31, track: 0.77 }
};
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
  ["shield", 1, { branch: 3, scrap: 1 }],
  ["sword", 1, { scrap: 4, branch: 1, cloth: 1 }],
  ["bolts", 3, { scrap: 1, branch: 1 }]
];
const builds = [
  ["barricade", 1, { branch: 2, fiber: 1 }],
  ["wall", 1, { branch: 1, fiber: 1 }],
  ["gate", 1, { branch: 3, fiber: 1, scrap: 1 }],
  ["lean_to", 1, { branch: 3, fiber: 2, cloth: 1 }],
  ["ramp", 1, { branch: 1, fiber: 1 }],
  ["fire", 1, { branch: 2, stone: 2, tinder: 1 }],
  ["rain_barrel", 1, { branch: 4, fiber: 2, cloth: 1 }],
  ["floor", 1, { branch: 1, fiber: 1 }]
];
const pieceSize = {
  barricade: [3.7, 1.2, 0.48], lean_to: [3.8, 2.5, 3.2], fire: [1.12, 0.45, 1.12],
  rain_barrel: [1.2, 1.15, 1.2], ...fortSizes
};
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heading = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const label = (id) => names[id] || id.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const count = (actor, item) => actor.bag[item] || 0;
const SHIELD_HEALTH = 100;
const STRUCTURE_HEALTH = { wall: 100, gate: 80, floor: 90, ramp: 75 };
const REPAIRABLE = new Set(["wall", "barricade", "floor", "ramp"]);
const REPAIR_WOOD = 1;
const REPAIR_SECONDS = 2;
const REPAIR_FRACTION = 0.35;

function add(actor, item, amount) {
  const total = count(actor, item) + amount;
  if (total > 0) actor.bag[item] = total;
  else delete actor.bag[item];
}

function makeActor(id, name, style, spawn, groundY, random) {
  const cooldown = random() * 0.55, decision = random() * 0.4, aggression = random();
  return {
    id, name, x: spawn.x, y: groundY, z: spawn.z, yaw: spawn.yaw,
    style, tendencies: tendencies[style], buildBias: (id * 0.61803398875 + aggression) % 1,
    health: 100, stamina: 100, hunger: 100, hydration: 100,
    water: 0, alive: true, placement: 0, weapon: "fists", armor: "", speed: 0,
    cooldown, crouch: false, guard: false, swing: 0, hurt: 0, anim: 0,
    reload: 0, crossbowLoaded: false, jump: 0, verticalSpeed: 0, bag: {},
    shieldStock: [], shieldRecovery: 0, guardStarted: -Infinity,
    decision, target: null, aggression, intent: "roam",
    lastSeen: null, lastSound: 0, soundMemory: null, opponent: null, openingLoot: false,
    attackedAt: -Infinity, woundedAt: -Infinity, nextStepNoise: 0, lookAt: null,
    openingRoute: null, leftPlaza: false, winded: false,
    seenHits: new Map(), seenSwings: new Map(), visitedSites: new Map(),
    commitUntil: 0, noProgress: 0, detourUntil: 0, detourAngle: 0,
    trackDistance: 0, lastTrack: 0
  };
}

function rivalWeaponReady(actor) {
  const weapon = weapons[actor.weapon];
  return actor.weapon !== "fists" && (!weapon.ammo || count(actor, weapon.ammo) > 0);
}

function chooseRivalWeapon(actor, reach) {
  let best = actor.weapon, high = -Infinity;
  for (const [id, weapon] of Object.entries(weapons)) {
    if (id !== actor.weapon && id !== "fists" && !count(actor, id)) continue;
    if (weapon.ammo && !count(actor, weapon.ammo)) continue;
    const reachPenalty = weapon.ammo ? Math.max(0, 7 - reach) * 5 + Math.max(0, reach - weapon.range * 0.65) * 1.8 :
      Math.min(28, Math.max(0, reach - weapon.reach) * 2.4);
    const reloadPenalty = id === "crossbow" && (id !== actor.weapon || !actor.crossbowLoaded) ? 14 : 0;
    const shieldBonus = count(actor, "shield") && (id === "sword" || id === "spear") ? 6 : 0;
    const score = weapon.damage - reachPenalty - reloadPenalty + shieldBonus + (id === actor.weapon ? 5 : 0);
    if (score > high) { best = id; high = score; }
  }
  if (best !== actor.weapon) equips(actor, best);
}

function recipeAffordable(actor, recipe, building, batches = 1) {
  if (building && recipe[0] === "fire" && count(actor, "firekit")) return true;
  return Object.entries(recipe[2]).every(([id, quantity]) => count(actor, id) >= quantity * batches);
}

function recipeRows(actor, recipes, building = false) {
  return recipes.map(recipe => {
    const [id, amount, materials, metadata] = recipe;
    const kits = building && id === "fire" ? count(actor, "firekit") : 0;
    const effective = kits ? { firekit: 1 } : materials;
    const needs = Object.entries(effective).map(([item, required]) => ({ id: item, name: label(item),
      held: count(actor, item), required, source: materialSources[item] || "Search supplies or the crafting menu." }));
    const cost = needs.map(need => need.required + " " + need.name.toLowerCase()).join(" / ");
    const copies = kits + Math.min(...Object.entries(materials).map(([item, n]) => Math.floor(count(actor, item) / n)));
    const category = recipeCategory(id, building, metadata?.blueprint);
    const available = metadata?.startCost ? Object.entries(metadata.startCost).every(([item, n]) => count(actor, item) >= n) : copies > 0;
    return [id, metadata?.title || label(id) + (amount > 1 ? " x" + amount : ""), cost, available,
      { category, needs, yield: amount, copies, description: metadata?.description || recipeDescriptions[id] || "",
        blueprint: Boolean(metadata?.blueprint), saved: Boolean(metadata?.saved), kit: kits > 0 }];
  });
}

function recipeCategory(id, building, blueprint) {
  if (blueprint) return "Blueprints";
  if (building) {
    if (["ramp", "floor"].includes(id)) return "Levels";
    if (["fire", "rain_barrel", "lean_to"].includes(id)) return "Camp";
    return "Cover";
  }
  if (["arrows", "bolts"].includes(id)) return "Ammo";
  if (["sling", "spear", "hatchet", "bow", "sword", "shield", "woven_vest", "scrap_cuirass"].includes(id)) return "Weapons & Armor";
  return "Essentials";
}

const materialSources = {
  branch: "Cut trees with a hatchet or loot supply caches.", fiber: "Harvest plants or trees.",
  stone: "Mine rocks with a hatchet or loot supply caches.", scrap: "Search supply caches and packs.",
  cloth: "Search supply caches and packs.", tinder: "Gather dry plants.", firekit: "Craft a campfire kit."
};

const recipeDescriptions = {
  sling: "Ranged weapon that throws stones.", spear: "Long melee reach. Can also be thrown.",
  arrows: "Ammunition for the bow.", bolts: "Ammunition for the crossbow.",
  hatchet: "Harvest wood and stone or use it in a fight.", bandage: "Recover health after a fight.",
  firekit: "Build a campfire to cook game.", waterskin: "Carry fresh water between stops.",
  bow: "Ranged weapon that fires arrows.", sword: "Heavy melee weapon that pairs with a shield.",
  woven_vest: "Light protection that reduces incoming damage.", scrap_cuirass: "Heavier protection from incoming damage.",
  shield: "Raise with a spear or sword to catch incoming hits.", barricade: "Crouch behind this low cover.",
  wall: "Timber wall for cover or platform support.", gate: "The entrance opens and closes.",
  lean_to: "Quick shelter for a small camp.", ramp: "The arrow marks the uphill end. Aim high at a landing to snap it.",
  fire: "Cook game meat. Firelight and smoke can give away your location.",
  rain_barrel: "A water storage barrel for camp.", floor: "Aim high to place a supported platform next to timber."
};

function pay(actor, recipe, building, batches = 1) {
  if (building && recipe[0] === "fire" && count(actor, "firekit")) {
    add(actor, "firekit", -1);
  } else {
    for (const [id, quantity] of Object.entries(recipe[2])) add(actor, id, -quantity * batches);
  }
}

function hasShield(actor) {
  return Boolean(count(actor, "shield") && (actor.weapon === "spear" || actor.weapon === "sword"));
}

function shieldDurabilities(actor) {
  const quantity = count(actor, "shield");
  const stock = actor.shieldStock;
  if (stock.length > quantity) stock.length = quantity;
  while (stock.length < quantity) stock.push(SHIELD_HEALTH);
  return stock;
}

function shieldRaised(actor) {
  return hasShield(actor) && actor.guard && actor.stamina >= 6 && actor.shieldRecovery <= 0 && actor.swing <= 0.19;
}

// The front face intercepts the actual swing or projectile segment.
function shieldContact(actor, from, to) {
  if (!shieldRaised(actor)) return null;
  const sin = Math.sin(actor.yaw), cos = Math.cos(actor.yaw);
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const normalSpeed = dx * sin + dz * cos;
  if (normalSpeed >= -0.0001) return null;
  const t = (0.56 - (from.x - actor.x) * sin - (from.z - actor.z) * cos) / normalSpeed;
  if (t < 0 || t > 1) return null;
  const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
  const side = ((x - actor.x) * cos - (z - actor.z) * sin + 0.24) / 0.41;
  const vertical = (y - actor.y - (actor.crouch ? 0.80 : 1.19)) / 0.49;
  return side * side + vertical * vertical <= 1 ? { t, x, y, z } : null;
}

function projectileBodyContact(actor, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const px = from.x - actor.x, pz = from.z - actor.z;
  const span = dx * dx + dz * dz;
  const projection = px * dx + pz * dz;
  const crossed = projection * projection - span * (px * px + pz * pz - 0.25);
  if (span < 0.000001 || crossed < 0) return null;
  const root = Math.sqrt(crossed);
  const t = Math.max(0, (-projection - root) / span);
  if (t > 1 || (-projection + root) / span < 0) return null;
  const height = from.y + (to.y - from.y) * t - actor.y;
  return height >= 0.13 && height < (actor.crouch ? 1.24 : 1.78) ? t : null;
}

function equips(actor, id) {
  if (!Object.hasOwn(weapons, id) || (id !== "fists" && !count(actor, id))) return;
  if (actor.weapon === "crossbow" && actor.weapon !== id) actor.reload = 0;
  actor.weapon = id;
}

function itemRow(model, x, y, z, w, h, d, kind, yaw = 0, lit = false) {
  return [model, x, y, z, 1, yaw, w, h, d, kind, lit, -1, 0, false, model];
}

function fortPieceRow(piece, status) {
  if (!piece) return null;
  const row = itemRow(piece.id, piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, "structure", piece.angle);
  if (status) row[16] = status;
  return row;
}

// Intersect the whole sight segment with a rotated building piece. A thin wall
// can fall entirely between movement samples, and a low barricade only hides a crouched rival.
function crossesPiece(from, to, eye, end, piece) {
  return pieceContact(from, to, eye, end, piece) !== null;
}

function pieceContact(from, to, eye, end, piece) {
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
  const forward = ox * s + oz * c, forwardDelta = dx * s + dz * c;
  if (!slab(ox * c - oz * s, dx * c - dz * s, piece.w / 2) ||
      !slab(forward, forwardDelta, piece.d / 2)) return null;
  const vertical = piece.id === "ramp"
    ? slab(eye - piece.y - piece.h * (forward / piece.d + 0.5),
      end - eye - piece.h * forwardDelta / piece.d, 0.18)
    : slab(eye - piece.y - piece.h / 2, end - eye, piece.h / 2);
  return vertical ? near : null;
}

export class SoloArena {
  constructor({ name = "Contestant", round = 1, seed = Date.now(), arena = 0, difficulty = 1 } = {}) {
    this.difficulty = clamp(Number.isFinite(difficulty) ? difficulty : 1, 0, 3);
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
    this.footprints = [];
    this.trackSerial = 0;
    this.wildlife = (this.map.wildlife || []).map(animal => ({ ...animal, phase: random() * TAU }));
    this.stoves = props.flatMap((prop, propIndex) => prop?.[0] === "stove" ?
      [{ x: prop[1], z: prop[3], propIndex, lit: true }] : []);
    this.nextProp = props.length;
    this.focusChoice = 0;
    this.focus = [];
    this.build = null;
    this.buildAngle = 0;
    this.playerFortPlans = new Map();
    this.drawStarted = null;
    this.throwStarted = null;
    this.notice = "";
    this.noticeUntil = 0;
    this.feed = "";
    this.feedUntil = 0;
    this.hitUntil = 0;
    this.impactAngle = 0;
    this.useUntil = 0;
    this.repairJob = null;
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
    const [verb, arg, amount, surplus] = action.split(":");
    if (action === "unfocus") {
      this.hold.clear();
      actor.guard = false;
      this.drawStarted = this.throwStarted = null;
      this.repairJob = null;
      return;
    }
    if (verb === "repair") {
      this.beginRepair();
      return;
    }
    if (this.repairJob && ["+Attack", "+Throw", "+Dodge", "+Shove", "build", "cancel"].includes(verb))
      this.cancelRepair();
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
    if (verb === "+Guard" && !actor.guard) {
      actor.guard = true;
      actor.guardStarted = this.clock;
      if (hasShield(actor) && actor.stamina >= 6) actor.stamina -= 1;
    }
    if (verb === "-Guard") actor.guard = false;
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
      const shields = arg === "shield" ? [shieldDurabilities(actor).pop()] : undefined;
      add(actor, arg, -1);
      if (!count(actor, arg) && actor.armor === arg) actor.armor = "";
      this.drop(actor.x + Math.sin(actor.yaw), actor.z + Math.cos(actor.yaw), { [arg]: 1 }, false, shields);
    }
    if (verb === "craft" && surplus === undefined) this.craft(arg, amount === undefined ? 1 : amount === "3" ? 3 : 0);
    if (verb === "build") {
      const recipe = [...builds, ...playerFortRecipes(this)].find(row => row[0] === arg);
      if (recipe && (recipe[3]?.blueprint || recipeAffordable(actor, recipe, true))) {
        this.build = recipe;
        this.buildAngle = 0;
      }
    }
    if (verb === "cancel") this.build = null;
    if (verb === "abandon-blueprint") {
      const recipe = playerFortRecipes(this).find(row => row[0] === arg && row[3].saved);
      if (!recipe) return;
      this.playerFortPlans.delete(recipe[3].kind);
      if (this.build?.[0] === arg) this.build = null;
      this.say("Blueprint cleared. Placed pieces stay in the arena.");
    }
    if (verb === "rotate" && this.build) {
      const template = this.build[3]?.blueprint;
      if (template && previewPlayerFort(this, actor, this.build[3].kind, this.buildAngle).anchored) {
        this.say("The layout is fixed after the first piece is placed.");
      } else {
        this.buildAngle = (this.buildAngle + (arg === "-1" ? -1 : 1) * (template ? Math.PI / 2 : Math.PI / 4)) % TAU;
      }
    }
    if (verb === "place" || verb === "repeat") this.place(verb === "repeat");
  }

  craft(id, batches = 1) {
    const recipe = crafts.find(row => row[0] === id);
    if (!recipe || !(batches === 1 || batches === 3 && (id === "arrows" || id === "bolts"))) return;
    if (!recipeAffordable(this.player, recipe, false, batches)) {
      const missing = Object.entries(recipe[2]).filter(([material, need]) => count(this.player, material) < need * batches)
        .map(([material, need]) => (need * batches - count(this.player, material)) + " " + label(material).toLowerCase());
      this.say("Need " + missing.join(" + ") + ".");
      return;
    }
    pay(this.player, recipe, false, batches);
    add(this.player, id, recipe[1] * batches);
    equips(this.player, id);
    const output = recipe[1] * batches;
    this.say("Made " + label(id).toLowerCase() + (output > 1 ? " ×" + output : "") + ".");
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
    if (recipe[3]?.blueprint) return null;
    const { x, z, yaw, id: actorId } = actor;
    const id = recipe[0];
    const px = Math.round((x + Math.sin(yaw) * reach) * 2) / 2;
    const pz = Math.round((z + Math.cos(yaw) * reach) * 2) / 2;
    const y = this.map.heightAt(px, pz);
    const [w, h, d] = pieceSize[id];
    const angle = Math.round(yaw / (Math.PI / 4)) * Math.PI / 4 + rotation;
    const draft = { id, x: px, y, z: pz, w, h, d, angle };
    if (Object.hasOwn(fortSizes, id) || (id === "barricade" && actor === this.player)) {
      return playerFortPiece(this, actor, draft, actor === this.player ? this.input.pitch || 0 : 0);
    }
    let error = "";
    if (this.map.surfaceAt(px, pz) > y + 0.25) error = "The footprint is in water.";
    else if (!this.canOccupy(px, pz, 0.7) || this.pieces.some(piece => !this.removed.has(piece.propIndex) &&
        piece.id === id && distance(piece, draft) <= 0.75)) error = "An obstacle blocks the footprint.";
    else if (this.actors.some(other => other.alive && other.id !== actorId && distance(other, draft) <= 1.5)) {
      error = "A contestant blocks the footprint.";
    }
    return { ...draft, fits: !error, error };
  }

  fortRecipe(id) { return builds.find(row => row[0] === id); }

  equipFortTool(actor) { equips(actor, "hatchet"); }

  place(repeat) {
    if (this.build?.[3]?.blueprint) {
      const preview = previewPlayerFort(this, this.player, this.build[3].kind, this.buildAngle);
      if (preview.error) { this.say(preview.error); return; }
      if (!preview.piece) return;
      updatePlayerFort(this, preview);
      this.say(preview.remaining === 1 ? preview.plan.title + " complete." :
        "Placed " + label(preview.piece.id).toLowerCase() + ". " + (preview.remaining - 1) + " remaining.");
      if (preview.remaining === 1) this.build = null;
      return;
    }
    const piece = this.blueprint();
    if (!piece?.fits || !recipeAffordable(this.player, this.build, true)) {
      this.say(piece?.error || "Check the required materials.");
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
    piece.health = STRUCTURE_HEALTH[piece.id] ?? 48;
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

  drop(x, z, items, leavePack = false, shields) {
    const propIndex = this.nextProp++;
    this.dropped.push({ x, z, propIndex, items, leavePack, shields });
    this.changes.set(propIndex, itemRow("pack", x, this.map.heightAt(x, z), z, 0.6, 0.48, 0.48, "pack"));
  }

  remove(target) {
    this.removed.add(target.propIndex);
    this.changes.set(target.propIndex, null);
    if (this.pieces.includes(target)) collapseFort(this, target);
  }

  aimedRepairPiece() {
    const actor = this.player;
    if (!actor.alive || this.build) return null;
    const pitch = this.input.pitch || 0;
    const y = actor.y + (actor.crouch ? 1.04 : 1.6);
    const reach = REACH * Math.cos(pitch);
    const end = { x: actor.x + Math.sin(actor.yaw) * reach,
      y: y + Math.sin(pitch) * REACH, z: actor.z + Math.cos(actor.yaw) * reach };
    let target = null, range = Infinity;
    for (const piece of this.pieces) {
      if (piece.open || this.removed.has(piece.propIndex)) continue;
      const contact = pieceContact(actor, end, y, end.y, piece);
      if (contact !== null && contact < range) {
        target = piece;
        range = contact;
      }
    }
    if (!target || !REPAIRABLE.has(target.id)) return null;
    const hit = { x: actor.x + (end.x - actor.x) * range, z: actor.z + (end.z - actor.z) * range };
    const height = y + (end.y - y) * range;
    return this.map.clearSight(actor, hit, y, height, this.removed) ? target : null;
  }

  repairStatus(piece = this.aimedRepairPiece()) {
    if (!piece) return null;
    const maxHealth = STRUCTURE_HEALTH[piece.id] ?? 48;
    const active = this.repairJob?.piece === piece;
    let reason = "";
    if (piece.repaired) reason = "Already repaired";
    else if (piece.health >= maxHealth) reason = "At full health";
    else if (count(this.player, "branch") < REPAIR_WOOD) reason = "Need 1 wood";
    return { enabled: !active && !reason, reason, target: label(piece.id), woodNeeded: REPAIR_WOOD, active };
  }

  beginRepair() {
    if (this.repairJob) return;
    const piece = this.aimedRepairPiece();
    const status = this.repairStatus(piece);
    if (!status?.enabled) {
      if (status?.reason) this.say(status.reason + ".");
      return;
    }
    this.repairJob = { piece, started: this.clock, nextSound: this.clock + 0.7 };
    this.hold.delete("attack");
    this.drawStarted = this.throwStarted = null;
    this.rivalNoise(this.player, 14, "build");
  }

  cancelRepair() {
    if (!this.repairJob) return;
    this.repairJob = null;
    this.say("Repair interrupted.");
  }

  stepRepair() {
    const job = this.repairJob;
    if (!job) return;
    const { piece, started } = job;
    if (piece !== this.aimedRepairPiece() || this.repairStatus(piece)?.reason) {
      this.cancelRepair();
      return;
    }
    if (this.clock - started >= REPAIR_SECONDS) {
      add(this.player, "branch", -REPAIR_WOOD);
      const maxHealth = STRUCTURE_HEALTH[piece.id] ?? 48;
      piece.health = Math.min(maxHealth, piece.health + maxHealth * REPAIR_FRACTION);
      piece.repaired = true;
      this.repairJob = null;
      this.rivalNoise(this.player, 14, "build");
      this.showPiece(piece);
      this.say(label(piece.id) + " repaired.");
    } else if (this.clock >= job.nextSound) {
      this.rivalNoise(this.player, 14, "build");
      job.nextSound = this.clock + 0.7;
    }
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
    if (this.repairStatus()?.enabled || this.repairJob) {
      this.beginRepair();
      return;
    }
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
      const closed = { ...target, open: false };
      if (target.open && this.actors.some(other => other.alive &&
          fortBlocksActor(closed, other.x, other.z, 0.28, other.y, other.y + 1.65))) {
        this.say("The gate is blocked.");
      } else {
        target.open = !target.open;
        this.showPiece(target);
      }
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
      const stock = id === "shield" ? shieldDurabilities(actor) : null;
      add(actor, id, amount);
      if (stock)
        for (let i = 0; i < amount; i++) stock.push(cache.shields?.[i] ?? SHIELD_HEALTH);
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

  canOccupy(x, z, padding = 0.28, actor, feet) {
    if (!this.map.canOccupy(x, z, this.removed)) return false;
    if (actor && feet === undefined) {
      const current = fortGround(this, actor.x, actor.z, actor.y + 0.08);
      feet = fortGround(this, x, z, current + FORT_STEP_HEIGHT) + (actor.jump || 0);
    }
    const head = feet + (actor?.crouch ? 1.17 : 1.64);
    return this.pieces.every(piece => this.removed.has(piece.propIndex) || !fortBlocksActor(piece, x, z, padding, feet, head));
  }

  move(actor, right, forward, seconds, speed) {
    const length = Math.max(1, Math.hypot(right, forward));
    const dx = (Math.sin(actor.yaw) * forward + Math.cos(actor.yaw) * right) * seconds * speed / length;
    const dz = (Math.cos(actor.yaw) * forward - Math.sin(actor.yaw) * right) * seconds * speed / length;
    const oldX = actor.x, oldZ = actor.z;
    let ground = fortGround(this, oldX, oldZ, actor.y + 0.08);
    const structuresNearby = this.pieces.some(piece => !this.removed.has(piece.propIndex) && distance(actor, piece) < 5);
    const steps = structuresNearby ? Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.18)) : 1;
    const jump = actor.jump || 0;
    for (let step = 0; step < steps; step++) {
      const x = actor.x + dx / steps, z = actor.z + dz / steps;
      const east = fortGround(this, x, actor.z, ground + FORT_STEP_HEIGHT);
      if (this.canOccupy(x, actor.z, undefined, actor, east + jump)) { actor.x = x; ground = east; }
      const north = fortGround(this, actor.x, z, ground + FORT_STEP_HEIGHT);
      if (this.canOccupy(actor.x, z, undefined, actor, north + jump)) { actor.z = z; ground = north; }
    }
    actor.y = ground + jump;
    actor.speed = Math.hypot(actor.x - oldX, actor.z - oldZ) / Math.max(0.001, seconds);
    actor.anim += (1 + actor.speed * 1.15) * seconds;
  }

  attack(actor, strength = 1, weapon = weapons[actor.weapon], prey = null) {
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
    const start = { x: actor.x, y: handHeight, z: actor.z };
    const end = { x: actor.x + Math.sin(actor.yaw) * weapon.reach,
      y: handHeight + incline * weapon.reach, z: actor.z + Math.cos(actor.yaw) * weapon.reach };
    let guard = null, guardRange = target ? distance(actor, target) - 0.24 : Infinity;
    for (const other of this.actors) {
      if (other === actor || !other.alive || distance(actor, other) > weapon.reach + 0.8) continue;
      const contact = shieldContact(other, start, end);
      if (contact && contact.t * weapon.reach < guardRange &&
          this.map.clearSight(start, contact, start.y, contact.y, this.removed) &&
          !this.pieces.some(piece => !piece.open && !this.removed.has(piece.propIndex) &&
            crossesPiece(start, contact, start.y, contact.y, piece))) {
        guard = other;
        guardRange = contact.t * weapon.reach;
      }
    }
    if (guard) {
      this.blockShield(guard, weapon.damage, actor, false);
      return;
    }
    if (target) {
      this.damage(target, weapon.damage, actor, { height: reachHeight(target) });
      return;
    }
    const animal = prey || (actor === this.player && this.wildlife.find(candidate => candidate.health > 0 && aligned(candidate)));
    if (animal?.health > 0 && aligned(animal)) {
      animal.health -= weapon.damage;
      if (actor === this.player) this.hitUntil = this.clock + 0.23;
      return;
    }
    if (actor !== this.player) return;
    const prop = this.focus.find(option => option.kind === "resource" && distance(actor, option.target) <= Math.max(weapon.reach, 2.85));
    if (prop) {
      this.harvest(prop.target);
      this.refreshFocus();
      return;
    }
    const piece = this.pieces.find(candidate => !this.removed.has(candidate.propIndex) && distance(actor, candidate) < weapon.reach &&
      Math.abs(angleDifference(actor.yaw, heading(actor, candidate))) < 0.6 &&
      handHeight + incline * distance(actor, candidate) >= candidate.y - 0.18 &&
      handHeight + incline * distance(actor, candidate) <= candidate.y + candidate.h + 0.2 &&
      this.lineClear(actor, candidate, [candidate]));
    if (piece) this.damageFort(piece, weapon.damage, actor);
  }

  damageFort(piece, damage, actor) {
    piece.health = (piece.health ?? STRUCTURE_HEALTH[piece.id] ?? 48) - damage;
    if (piece.health > 0) return;
    this.remove(piece);
    const wood = Math.min(this.fortRecipe(piece.id)?.[2].branch ?? 0, piece.id === "fire" ? 1 : 2);
    if (wood > 0) this.drop(piece.x, piece.z, { branch: wood });
    if (actor === this.player) this.say("Structure broken.");
  }

  breachFort(actor, target) {
    if (distance(actor, target) > 9 || this.lineClear(actor, target)) return false;
    const tool = count(actor, "hatchet") ? "hatchet" : actor.weapon;
    const weapon = weapons[tool];
    const eye = actor.y + 1.13;
    const end = (target.y ?? this.map.heightAt(target.x, target.z)) + 1.13;
    const obstacle = this.pieces.find(piece => !this.removed.has(piece.propIndex) && !piece.open &&
      distance(actor, piece) < (weapon.reach || 2.3) + 0.4 && crossesPiece(actor, target, eye, end, piece) &&
      this.lineClear(actor, piece, [piece]));
    if (!obstacle) return false;
    actor.yaw = heading(actor, obstacle);
    if (obstacle.id === "gate") {
      obstacle.open = true;
      this.showPiece(obstacle);
      this.rivalNoise(actor, 10, "build");
      return true;
    }
    if (obstacle.owner === actor.id || !weapon.reach) return false;
    if (actor.cooldown <= 0) {
      equips(actor, tool);
      actor.cooldown = weapon.delay;
      actor.swing = 0.46;
      this.damageFort(obstacle, weapon.damage, actor);
      this.rivalNoise(actor, 17, "strike");
    }
    return true;
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

  lineClear(from, to, ignored = []) {
    const eye = from.y + (from.crouch ? 1.04 : 1.6);
    const end = (to.y ?? this.map.heightAt(to.x, to.z)) + (to.crouch ? 0.99 : to.alive ? 1.55 : 0.55);
    return this.map.clearSight(from, to, eye, end, this.removed) &&
      !this.pieces.some(piece => !piece.open && !this.removed.has(piece.propIndex) && !ignored.includes(piece) &&
        crossesPiece(from, to, eye, end, piece));
  }

  blockShield(actor, amount, source, ranged) {
    const timed = !ranged && this.clock - actor.guardStarted <= 0.22 && actor.guardStarted > -Infinity;
    const stock = shieldDurabilities(actor);
    stock[0] -= Math.max(5, amount * (timed ? 0.51 : 0.69));
    actor.stamina = Math.max(0, actor.stamina - 4 - amount * (timed ? 0.12 : 0.19));
    if (timed) {
      actor.guardStarted = -Infinity;
      source.cooldown = Math.max(source.cooldown, 0.9);
    }
    const broken = stock[0] <= 0;
    if (broken) {
      stock.shift();
      add(actor, "shield", -1);
    }
    if (broken || actor.stamina < 6) actor.shieldRecovery = broken ? 0.55 : 0.38;
    if (actor === this.player)
      this.say(broken ? "Shield broke." : timed ? "Shield parry." : "Shield blocked.");
    this.rivalNoise(actor, 15, "strike");
  }

  damage(actor, amount, source, contact = {}) {
    if (!actor.alive) return;
    if (source) {
      const incoming = contact.angle ?? heading(actor, source);
      if (actor.armor) amount *= actor.armor === "scrap_cuirass" ? 0.64 : 0.79;
      if (actor === this.player) this.impactAngle = incoming;
      if (source === this.player) this.hitUntil = this.clock + 0.25;
      actor.woundedAt = this.clock;
      if (actor !== this.player) actor.decision = this.clock;
    }
    actor.health = Math.max(0, actor.health - amount);
    if (amount > 0 && actor === this.player) this.cancelRepair();
    if (amount >= 1) actor.hurt = source ? 0.43 : Math.max(actor.hurt, 0.12);
    if (actor.health > 0) return;
    actor.alive = false;
    actor.placement = this.alive--;
    if (Object.keys(actor.bag).length)
      this.drop(actor.x, actor.z, { ...actor.bag }, true, shieldDurabilities(actor).slice());
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
        const before = { x: shot.x, y: shot.y, z: shot.z };
        shot.x += Math.sin(shot.yaw) * Math.cos(shot.pitch) * stride;
        shot.z += Math.cos(shot.yaw) * Math.cos(shot.pitch) * stride;
        shot.y += Math.sin(shot.pitch) * stride;
        shot.range -= stride;
        if (shot.range <= 0 || shot.y <= this.map.heightAt(shot.x, shot.z) || !this.map.canOccupy(shot.x, shot.z, this.removed)) {
          ended = true;
          break;
        }
        let piece = null, hit = null, intercept = null, time = Infinity;
        for (const candidate of this.pieces) {
          if (candidate.open || this.removed.has(candidate.propIndex)) continue;
          const t = pieceContact(before, shot, before.y, shot.y, candidate);
          if (t !== null && t < time) { piece = candidate; time = t; }
        }
        if (!shot.deflected) {
          for (const actor of this.actors) {
            if (actor === shot.owner || !actor.alive || distance(actor, shot) > 1.35) continue;
            const guard = shieldContact(actor, before, shot);
            const body = projectileBodyContact(actor, before, shot);
            const contact = guard && (body === null || guard.t <= body) ? guard.t : body;
            if (contact !== null && contact < time) {
              hit = actor;
              intercept = contact === guard?.t ? guard : null;
              time = contact;
              piece = null;
            }
          }
        }
        if (piece) {
          if (!shot.deflected) this.damageFort(piece, shot.damage * 0.48, shot.owner);
          ended = true;
          break;
        }
        if (shot.deflected) continue;
        if (intercept) {
          this.blockShield(hit, shot.damage, shot.owner, true);
          const nx = Math.sin(hit.yaw), nz = Math.cos(hit.yaw);
          const vx = Math.sin(shot.yaw), vz = Math.cos(shot.yaw);
          const normal = vx * nx + vz * nz;
          shot.yaw = Math.atan2(vx - 2 * normal * nx, vz - 2 * normal * nz);
          shot.pitch = Math.max(-0.45, shot.pitch * 0.45 + 0.12);
          shot.x = intercept.x + nx * 0.035;
          shot.y = intercept.y;
          shot.z = intercept.z + nz * 0.035;
          shot.speed *= 0.24;
          shot.range = Math.min(4, shot.range);
          shot.deflected = true;
          break;
        }
        if (hit) {
          this.damage(hit, shot.damage, shot.owner, { angle: shot.yaw + Math.PI });
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
      const reach = distance(actor, sound);
      if (reach >= sound.radius) continue;
      const hearing = this.lineClear(actor, sound) ? sound.radius : sound.radius * 0.82;
      const loudness = 1 - reach / hearing;
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
    return this.rivalLooksAt(actor, other, other.crouch ? 17 : 35 + actor.tendencies.track * 6);
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
        const needsGear = !rivalWeaponReady(actor), needsAid = actor.health < 65, needsFood = actor.hunger < 60;
        const ammo = ["arrows", "bolts", "stone"].some(id => model === id && count(actor, id) < 3 &&
          Object.entries(weapons).some(([weapon, kit]) => kit.ammo === id && count(actor, weapon)));
        const utility = (model === "waterskin" && !count(actor, model)) ||
          (model === "shield" && !count(actor, model) && ["spear", "sword"].includes(actor.weapon)) ||
          ((model === "woven_vest" || model === "scrap_cuirass") && !actor.armor);
        const useful = (needsGear && Object.hasOwn(weapons, model)) || (needsAid && model === "bandage") ||
          (needsFood && (model === "meal" || model === "berries")) || ammo || utility;
        if (!useful && !takeAny && !(container && (needsGear || needsAid || needsFood || reach < 6))) continue;
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
    const direct = heading(threat, actor), side = actor.id % 2 ? 1 : -1;
    const offsets = this.difficulty < 2 ? [0.28, -0.5, 0.9] : [0.15, -0.45, 0.62, -1.1, 1.25, 1.75];
    const points = offsets.map(offset => {
      const angle = direct + side * offset;
      const x = actor.x + Math.sin(angle) * 16 - this.storm.x;
      const z = actor.z + Math.cos(angle) * 16 - this.storm.z;
      const scale = Math.min(1, (this.storm.radius - 2) / Math.max(1, Math.hypot(x, z)));
      return { x: this.storm.x + x * scale, z: this.storm.z + z * scale };
    });
    for (const piece of this.pieces) {
      if (!["wall", "barricade"].includes(piece.id) || distance(actor, piece) > 17 || this.removed.has(piece.propIndex)) continue;
      const nx = Math.sin(piece.angle), nz = Math.cos(piece.angle);
      const actorSide = Math.sign((actor.x - piece.x) * nx + (actor.z - piece.z) * nz) || 1;
      const face = actorSide * (piece.d * 0.5 + 0.12);
      const seen = { x: piece.x + nx * face, z: piece.z + nz * face, y: piece.y };
      if (!this.lineClear(actor, seen)) continue;
      const farSide = Math.sign((piece.x - threat.x) * nx + (piece.z - threat.z) * nz) || actorSide;
      points.push({ x: piece.x + nx * farSide * 1.05, z: piece.z + nz * farSide * 1.05, shelter: true });
    }
    let best = null, bestScore = -Infinity;
    for (const target of points) {
      if (!this.canOccupy(target.x, target.z) || !this.rivalSafe(actor, target, 1)) continue;
      const open = this.lineClear(actor, target);
      const checkCover = target.shelter || this.difficulty >= 2;
      const covered = checkCover && !this.lineClear({ ...target, y: this.map.heightAt(target.x, target.z), crouch: true }, threat);
      const score = distance(threat, target) + (open ? 5 : 0) + (covered ? (target.shelter ? 11 : 6) : 0);
      if (score > bestScore) { best = target; bestScore = score; }
    }
    return best || { x: this.storm.x, z: this.storm.z };
  }

  rivalPlan(actor, intent, goal, lookAt = null, opponent = null) {
    if (intent !== "work" || goal?.workNode?.type !== "roof") actor.roofStarted = null;
    actor.intent = intent;
    actor.target = goal;
    actor.lookAt = lookAt;
    actor.opponent = opponent;
  }

  rivalSafe(actor, target, buffer = 3, workTime = 0) {
    const storm = this.storm;
    const travel = distance(actor, target) / 3.7 + workTime;
    const radius = storm.moving ? Math.max(5, storm.radius - travel * 0.87) :
      storm.warning && travel >= storm.seconds ? Math.max(5, storm.radius - (travel - storm.seconds) * 0.87) : storm.radius;
    return distance(target, storm) <= Math.max(1.5, radius - buffer);
  }

  rivalPatrol(actor) {
    const current = actor.intent === "roam" ? actor.target : null;
    if (current && distance(actor, current) > 1.5 && this.rivalSafe(actor, current)) return current;
    if (current?.site) actor.visitedSites.set(current.site, this.clock);
    const sites = [...this.map.landmarks, ...this.map.waterSources];
    const limit = Math.max(2, this.storm.radius - Math.max(2, Math.min(14, this.storm.radius * 0.2)));
    let best = null, bestScore = -Infinity;
    for (const [index, site] of sites.entries()) {
      const range = distance(actor, site);
      if (range < 8 || range > 96) continue;
      const angle = heading(site, actor) + (actor.id % 2 ? 0.9 : -0.9);
      const target = { x: site.x + Math.sin(angle) * 5, z: site.z + Math.cos(angle) * 5, site: index + 1 };
      if (!this.rivalSafe(actor, target) || !this.canOccupy(target.x, target.z)) continue;
      const lastVisit = actor.visitedSites.get(target.site) ?? -Infinity;
      const score = Math.min(48, this.clock - lastVisit) * 0.56 - Math.abs(range - 36) * 0.26 + this.map.random() * 14;
      if (score > bestScore) { best = target; bestScore = score; }
    }
    if (best) return best;
    // Search locally when landmarks are too distant or the circle is small.
    for (let attempt = 0; attempt < 7; attempt++) {
      const angle = actor.yaw + (this.map.random() - 0.5) * TAU;
      const stride = Math.min(37, 10 + this.map.random() * 29, Math.max(4, limit));
      const x = actor.x + Math.sin(angle) * stride - this.storm.x;
      const z = actor.z + Math.cos(angle) * stride - this.storm.z;
      const scale = Math.min(1, limit / Math.max(1, Math.hypot(x, z)));
      const target = { x: this.storm.x + x * scale, z: this.storm.z + z * scale };
      if (distance(actor, target) > 1.4 && this.canOccupy(target.x, target.z)) return target;
    }
    return { x: this.storm.x, z: this.storm.z };
  }

  rivalTrail(actor) {
    if (!rivalWeaponReady(actor) || actor.health < 39 || actor.stamina < 24) return null;
    let best = null, lowest = Infinity;
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const track = this.footprints[i], age = this.clock - track.at;
      if (age > 8) break;
      if (track.id <= actor.lastTrack || track.maker === actor.id) continue;
      const reach = distance(actor, track);
      const score = reach + age * 0.42;
      if (reach > 8.5 || score >= lowest || !this.rivalLooksAt(actor, track, 8.5)) continue;
      const target = { x: track.x + Math.sin(track.yaw) * 5.5, z: track.z + Math.cos(track.yaw) * 5.5 };
      if (!this.rivalSafe(actor, target)) continue;
      best = { ...target, trailId: track.id };
      lowest = score;
    }
    return best;
  }

  rivalLooksAt(actor, target, range) {
    const reach = distance(actor, target);
    return reach <= range && (reach < 2.2 || Math.abs(angleDifference(actor.yaw, heading(actor, target))) <= 1.45) &&
      this.lineClear(actor, target);
  }

  rivalPrey(actor) {
    if (!rivalWeaponReady(actor) || count(actor, "meat") + count(actor, "meal") >= 3) return null;
    let best = null, lowest = Infinity;
    for (const animal of this.wildlife) {
      if (animal.harvested) continue;
      const reach = distance(actor, animal);
      const cost = reach + (animal.health > 0 ? animal.health * 0.13 : -6);
      if (cost >= lowest || !this.rivalLooksAt(actor, animal, animal.health > 0 ? 30 : 14) || !this.rivalSafe(actor, animal)) continue;
      best = animal;
      lowest = cost;
    }
    return best;
  }

  rivalNeeds(actor, propose) {
    const ready = rivalWeaponReady(actor);
    if (actor.health < 74 && count(actor, "bandage")) propose("recover", actor, 59 + (74 - actor.health) * 0.75);
    if (actor.hydration < 67 && actor.water > 0 && count(actor, "waterskin")) propose("recover", actor, 40 + (67 - actor.hydration) * 0.9);
    if (actor.hunger < 69 && (count(actor, "meal") || count(actor, "berries"))) propose("recover", actor, 37 + (69 - actor.hunger) * 0.65);
    if (actor.hydration < 63) {
      const nearbyWater = [0, 3, 5].map(offset => ({ x: actor.x + Math.sin(actor.yaw) * offset, z: actor.z + Math.cos(actor.yaw) * offset }))
        .filter(site => this.map.surfaceAt(site.x, site.z) > this.map.heightAt(site.x, site.z) + 0.05);
      for (const source of [...nearbyWater, ...this.map.waterSources]) {
        if (this.rivalLooksAt(actor, source, 23) && this.rivalSafe(actor, source)) {
          propose("drink", source, 40 + (63 - actor.hydration) * 0.9 - distance(actor, source) * 0.5);
        }
      }
    }
    if (actor.hunger < 75) {
      const prey = this.rivalPrey(actor);
      if (prey) propose("hunt", prey, 33 + (75 - actor.hunger) * 0.34 + actor.tendencies.track * 8 +
        (prey.health <= 0 ? 12 : 0) - distance(actor, prey) * 0.44);
      for (const node of this.map.nodes) {
        if (node.type === "berry" && !this.removed.has(node.propIndex) && this.rivalLooksAt(actor, node, 13) && this.rivalSafe(actor, node)) {
          propose("forage", node, 36 + (75 - actor.hunger) * 0.44 - distance(actor, node) * 0.68);
        }
      }
    }
    if (count(actor, "meat") && actor.hunger < 79) {
      const fires = [...this.stoves, ...this.pieces.filter(piece => piece.id === "fire" && !this.removed.has(piece.propIndex))];
      for (const fire of fires) {
        if (this.rivalLooksAt(actor, fire, 20) && this.rivalSafe(actor, fire, 4, 3)) {
          propose("cook", fire, 47 + (79 - actor.hunger) * 0.38 - distance(actor, fire) * 0.63);
        }
      }
      const recipe = builds.find(([id]) => id === "fire");
      if (this.rivalSafe(actor, actor, 8, 6) && recipeAffordable(actor, recipe, true) && this.clock >= (actor.nextCookSite ?? 0)) {
        propose("cook", actor, 45 + (79 - actor.hunger) * 0.39);
      }
    }
    if (!ready && this.clock >= (actor.nextCraft ?? 0) && crafts.some(row => (row[0] === "spear" || row[0] === "sling") && recipeAffordable(actor, row))) {
      propose("recover", actor, 66);
    }
  }

  thinkRival(actor) {
    const now = this.clock, age = now - ROUND_START, opening = age < 14;
    const sound = this.heardBy(actor);
    const visible = this.actors.filter(other => this.canSeeRival(actor, other));
    const exposed = other => now - (actor.seenHits.get(other.id) ?? -Infinity) < 2.6 ||
      (other.weapon === "crossbow" && !other.crossbowLoaded && other.reload > 0);
    for (const rival of visible) {
      if (rival.hurt > 0 && now - rival.woundedAt < 0.43) actor.seenHits.set(rival.id, now);
      if (rival.swing > 0 && now - rival.attackedAt < 0.48) {
        actor.seenSwings.set(rival.id, { x: rival.x, z: rival.z, yaw: rival.yaw, at: now });
      }
    }
    const rank = rival => distance(actor, rival) - (exposed(rival) ? 7 : 0) - (rival.id === actor.opponent ? 3 : 0);
    visible.sort((a, b) => rank(a) - rank(b));
    const enemy = visible[0], third = visible[1];
    const sight = enemy && { x: enemy.x, z: enemy.z, y: enemy.y, at: now, id: enemy.id };
    if (sight) actor.lastSeen = sight;
    if (enemy && actor.cooldown <= 0) chooseRivalWeapon(actor, distance(actor, enemy));
    const storm = this.storm;
    const margin = distance(actor, storm) - storm.radius;
    if (margin > -Math.min(2.4, storm.radius * 0.12) && (storm.active || storm.warning)) {
      const angle = heading(storm, actor) + (actor.id % 2 ? 0.18 : -0.18);
      const radius = Math.max(1, storm.radius - 9);
      return this.rivalPlan(actor, "storm", { x: storm.x + Math.sin(angle) * radius, z: storm.z + Math.cos(angle) * radius });
    }

    let best = null;
    const propose = (intent, target, score, lookAt = null, opponent = null) => {
      const continuing = intent === actor.intent && distance(target, actor.target || actor) < 3;
      if (continuing && now < actor.commitUntil) score += 4;
      if (!best || score > best.score) best = { intent, target, score, lookAt, opponent, continuing };
    };
    const ready = rivalWeaponReady(actor);
    const risk = actor.tendencies.risk + (actor.aggression - 0.5) * 0.18;
    const spent = actor.stamina < 23 || actor.hunger < 26 || actor.hydration < 26;
    if (enemy) {
      const reach = distance(actor, enemy);
      const close = reach < (enemy.weapon === "fists" ? 3.5 : 5.2);
      const outmatched = !ready && enemy.weapon !== "fists";
      const extraThreat = third || (sound && sound.source !== enemy.id && now - sound.at < 1.8);
      const vulnerable = exposed(enemy);
      const endangered = actor.health < 26 || ((actor.health < 49 || spent || !ready) && extraThreat) || (outmatched && close);
      const swungAt = (striker, rival) => {
        const swing = actor.seenSwings.get(striker.id);
        return swing && now - swing.at < 2.6 && Math.abs(angleDifference(swing.yaw, heading(swing, rival))) < 1.1;
      };
      const trading = third && distance(enemy, third) < 13 && (swungAt(enemy, third) || swungAt(third, enemy));
      const chance = (actor.health - 60) * 0.22 + (actor.stamina - 55) * 0.12 + (ready ? 8 : 0) + (actor.armor ? 5 : 0) +
        (hasShield(actor) ? 3 : 0) + risk * 9 - (outmatched ? 22 : 0) - (extraThreat && !vulnerable ? 12 : 0) - (spent ? 13 : 0);
      if (endangered && storm.radius > 8) {
        propose("retreat", this.rivalExit(actor, sight), 104, sight);
      }
      if (trading && !close && !vulnerable && (this.alive <= 3 || chance < 30)) {
        propose("watch", actor, this.alive <= 3 ? 84 : 66, sight);
      }
      if (opening && !close && !vulnerable && !actor.openingLoot) {
        propose("watch", actor, 73 - actor.tendencies.opening * 37, sight);
      }
      if (!endangered || storm.radius <= 8) {
        const ideal = weapons[actor.weapon].ammo ? 11 : 5;
        const score = 43 + chance + (vulnerable ? 20 : 0) + (close ? 16 : 0) + (this.alive <= 3 ? 15 : 0) -
          Math.max(0, reach - ideal) * 0.8 - (opening && !ready && !close ? 18 : 0);
        propose("engage", sight, score, sight, enemy.id);
      }
    } else {
      const memory = actor.lastSeen;
      const memoryAge = memory ? now - memory.at : Infinity;
      if (sound && (!memory || sound.at > memory.at)) {
        const startled = ["strike", "shot"].includes(sound.kind) && distance(actor, sound) < 13 && (actor.health < 46 || spent || !ready);
        if (startled && this.alive > 2) propose("retreat", this.rivalExit(actor, sound), 79, sound);
        else if (ready || sound.kind === "footsteps" || actor.health >= 48) propose("investigate", sound, 57 - (now - sound.at) * 3);
      } else if (memoryAge < 6.5 + actor.tendencies.track * 2.5) {
        propose("search", memory, 60 - memoryAge * 2 + (this.alive <= 3 ? 8 : 0));
      }
      if ((!sound || now - sound.at > 2.4) && memoryAge > 1.5) {
        const track = this.rivalTrail(actor);
        if (track) propose("search", track, 46 + actor.tendencies.track * 6);
        if (actor.target?.trailId && actor.intent === "search" && distance(actor, actor.target) > 1.5 && now < actor.commitUntil) {
          propose("search", actor.target, 48 + actor.tendencies.track * 6);
        }
      }
      this.rivalNeeds(actor, propose);
    }

    if (!actor.leftPlaza && this.alive > 3 && age < 25) {
      const bail = actor.openingLoot || age > 4 + actor.tendencies.opening * 13 || actor.health < 63;
      if (bail && (opening || actor.openingRoute)) {
        if (!actor.openingRoute) {
          const angle = Math.atan2(actor.x, actor.z) + (actor.id % 2 ? 0.29 : -0.29);
          const radius = 42 + actor.aggression * 21;
          actor.openingRoute = { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
        }
        if (distance(actor, actor.openingRoute) < 3) actor.leftPlaza = true;
        else propose("retreat", actor.openingRoute, 94 - actor.tendencies.opening * 53 + (actor.openingLoot ? 7 : 0));
      }
    }

    const supply = this.supplyFor(actor, opening && !actor.openingLoot);
    if (supply && this.rivalSafe(actor, supply)) {
      propose("loot", supply, (opening ? 61 : ready ? 39 : 65) - distance(actor, supply) * (opening ? 0.65 : 0.7));
    }
    if (!opening && actor.health >= 40 && actor.hydration >= 35 && actor.hunger >= 35) {
      const camp = actor.campFrame;
      const existingCamp = camp && !this.removed.has(camp.propIndex) && distance(actor, camp) < 32 && this.rivalSafe(actor, camp);
      if (!enemy && (!sound || now - sound.at > 2.2) && existingCamp && camp.shelterFrame) {
        if (actor.intent === "work" && actor.target?.workNode && !this.removed.has(actor.target.workNode.propIndex)) {
          propose("work", actor.target, 63);
        } else {
          const site = this.workSite(actor);
          if (site) propose("work", site, 59 - distance(actor, site) * 0.3);
        }
      } else if (!existingCamp) {
        const fort = rivalFortCandidate(this, actor, { enemy, sound });
        if (fort) propose("fortify", fort.target, fort.score);
      }
    }
    if (!best || best.score < 33) propose("roam", this.rivalPatrol(actor), 33);
    if (!best.continuing) actor.commitUntil = now + (best.intent === "search" ? 4.5 : 3.5 + this.map.random() * 2.5);
    if (best.target.trailId) actor.lastTrack = Math.max(actor.lastTrack, best.target.trailId);
    // Watch and recovery stay in place using a position snapshot.
    const target = best.target === actor ? { x: actor.x, z: actor.z } : best.target;
    this.rivalPlan(actor, best.intent, target, best.lookAt, best.opponent);
  }

  recoverRival(actor) {
    if (actor.health < 74 && count(actor, "bandage")) {
      add(actor, "bandage", -1);
      actor.health = Math.min(100, actor.health + 28);
    } else if (actor.hydration < 67 && actor.water > 0 && count(actor, "waterskin")) {
      const amount = Math.min(24, actor.water);
      actor.water -= amount;
      actor.hydration = Math.min(100, actor.hydration + amount);
    } else if (actor.hunger < 69 && (count(actor, "meal") || count(actor, "berries"))) {
      const food = count(actor, "meal") ? "meal" : "berries";
      add(actor, food, -1);
      actor.hunger = Math.min(100, actor.hunger + (food === "meal" ? 42 : 18));
    } else if (!rivalWeaponReady(actor)) {
      const recipe = ["spear", "sling"].map(id => crafts.find(row => row[0] === id)).find(row => recipeAffordable(actor, row));
      if (recipe) {
        pay(actor, recipe, false);
        add(actor, recipe[0], recipe[1]);
        equips(actor, recipe[0]);
      }
      actor.nextCraft = this.clock + 3;
    }
    actor.target = null;
    actor.decision = this.clock + 0.6;
  }

  cookRival(actor, fire) {
    if (fire.propIndex == null) {
      const recipe = builds.find(([id]) => id === "fire");
      for (let direction = 0; direction < 6; direction++) {
        const candidate = this.blueprint({ ...actor, yaw: actor.yaw + direction * TAU / 6 }, recipe, 0, 1.9);
        if (!candidate?.fits || !recipeAffordable(actor, recipe, true)) continue;
        this.installPiece(actor, recipe, candidate);
        fire = candidate;
        break;
      }
      actor.nextCookSite = this.clock + 9;
      if (fire.propIndex == null) { actor.target = null; actor.decision = this.clock; return; }
      actor.target = fire;
    }
    if (this.removed.has(fire.propIndex) || !count(actor, "meat")) {
      actor.target = null;
      actor.decision = this.clock;
      return;
    }
    if (this.clock < (actor.nextCook ?? 0)) return;
    if (!fire.lit) {
      fire.lit = true;
      this.showPiece(fire);
    } else {
      add(actor, "meat", -1);
      add(actor, "meal", 1);
      this.rivalPlan(actor, "recover", { x: actor.x, z: actor.z });
    }
    actor.nextCook = this.clock + 2.5;
    actor.decision = this.clock + Math.min(0.85, 1.15 - this.difficulty * 0.12);
  }

  rivalFight(actor, target, seconds, hunting = false) {
    if (!target) return false;
    const visible = hunting ? this.rivalLooksAt(actor, target, 33) : this.canSeeRival(actor, target);
    if (!visible) return false;
    const weapon = weapons[actor.weapon];
    const reach = distance(actor, target);
    const ideal = weapon.ammo ? Math.min(weapon.range * 0.44, actor.weapon === "crossbow" ? 23 : 17) : weapon.reach * 0.82;
    const range = weapon.ammo ? weapon.range * 0.68 : weapon.reach;
    actor.yaw = heading(actor, target);
    if (!hunting && hasShield(actor) && !weapon.ammo && actor.stamina > 13) {
      actor.guard = actor.cooldown > Math.max(0.13, 0.31 - this.difficulty * 0.058) ||
        (target.swing > 0.24 && reach < (weapons[target.weapon].reach ?? 3.7) + 1 && actor.cooldown > 0);
    }
    const tired = actor.stamina < 17;
    const elevation = (target.y ?? this.map.heightAt(target.x, target.z)) - actor.y;
    if ((!weapon.ammo && Math.abs(elevation) > 1.06) || (!weapon.ammo && tired)) return false;
    if (reach <= range && actor.cooldown <= 0 && (!weapon.ammo || actor.weapon !== "crossbow" || actor.crossbowLoaded)) {
      const aimHeight = hunting ? -0.68 : target.crouch ? -0.64 : -0.29;
      const error = weapon.ammo ? (this.map.random() - 0.5) * (0.11 - this.difficulty * 0.027) : 0;
      actor.yaw += error;
      actor.aimPitch = Math.atan2(elevation + aimHeight + reach * reach * 0.0009, Math.max(0.2, reach));
      this.attack(actor, 1, weapon, hunting ? target : null);
      actor.stamina = Math.max(0, actor.stamina - (weapon.ammo ? 3 : 8));
      return true;
    }
    if (hunting && reach > ideal) return false;
    if (!hunting && (reach < ideal * 1.35 || weapon.ammo && reach <= range)) {
      const back = reach < ideal * 0.83 ? -0.87 : 0;
      const side = (actor.id % 2 ? 1 : -1) * (weapon.ammo ? 0.65 : 0.45 + this.difficulty * 0.1);
      this.move(actor, side, back, seconds, actor.guard ? 2.1 : 3.15);
      return true;
    }
    return reach < ideal && weapon.ammo;
  }

  moveRival(actor, target, seconds, intent) {
    const route = rivalFortDescent(this, actor, target);
    const yaw = heading(actor, route), side = actor.id % 2 ? 1 : -1;
    const rush = ["retreat", "storm"].includes(intent) || intent === "hunt" && !weapons[actor.weapon].ammo;
    const water = this.map.surfaceAt(actor.x, actor.z) - this.map.heightAt(actor.x, actor.z);
    const speed = (actor.crouch ? 2.05 : rush && !actor.winded ? 5.8 : 3.7 + actor.aggression * 0.9) * (water > 0.3 ? 0.65 : 1);
    const before = distance(actor, route);
    for (const offset of [0, 0.55, -0.55, 1.1, -1.1, 1.65]) {
      actor.yaw = yaw + side * offset + (actor.detourUntil > this.clock ? actor.detourAngle : 0);
      if (!this.canOccupy(actor.x + Math.sin(actor.yaw) * 0.48, actor.z + Math.cos(actor.yaw) * 0.48, undefined, actor)) continue;
      this.move(actor, 0, 1, seconds, speed);
      break;
    }
    if (before - distance(actor, route) < seconds * 0.38) actor.noProgress += seconds;
    else actor.noProgress = Math.max(0, actor.noProgress - seconds * 1.6);
    if (actor.noProgress < 1.8) return;
    actor.noProgress = 0;
    if (actor.detourUntil > this.clock && ["roam", "hunt", "forage", "loot"].includes(intent)) {
      if (target.site) actor.visitedSites.set(target.site, this.clock);
      actor.target = null;
      actor.decision = this.clock;
      return;
    }
    actor.detourAngle = side * 1.22;
    actor.detourUntil = this.clock + 3.1;
  }

  bot(actor, seconds) {
    const current = weapons[actor.weapon];
    if (current.ammo && !count(actor, current.ammo)) {
      equips(actor, Object.keys(weapons).reverse().find(id => weapons[id].reach && count(actor, id)) || "fists");
    }
    if (actor.decision <= this.clock) {
      actor.decision = this.clock + 0.69 + this.map.random() * 0.45 - this.difficulty * 0.105;
      this.thinkRival(actor);
    }
    const target = actor.target;
    actor.speed = 0;
    if (!target) return;
    const reach = distance(actor, target), intent = actor.intent;
    actor.guard = false;
    actor.crouch = intent === "watch" || (intent === "search" && actor.tendencies.track > 0.7);
    if (intent === "fortify") { stepRivalFort(this, actor, seconds); return; }
    if (intent === "recover") { this.recoverRival(actor); return; }
    if (intent === "engage") {
      const enemy = this.actors.find(other => other.id === actor.opponent);
      if (this.rivalFight(actor, enemy, seconds)) return;
    }
    if (intent === "engage" || intent === "search") {
      const approach = rivalFortApproach(this, actor, target);
      if (approach !== target) { this.moveRival(actor, approach, seconds, intent); return; }
      if (this.breachFort(actor, target)) return;
    }
    if (intent === "hunt") {
      if (target.harvested || !this.rivalLooksAt(actor, target, 33)) { actor.target = null; actor.decision = this.clock; return; }
      if (target.health > 0 && this.rivalFight(actor, target, seconds, true)) return;
      if (target.health <= 0 && reach <= 2.4) {
        target.harvested = true;
        add(actor, "meat", 2);
        actor.target = null;
        actor.decision = this.clock;
        return;
      }
    }
    if (intent === "loot" && reach < 2.15 && this.lineClear(actor, target)) {
      if (!this.removed.has(target.propIndex)) {
        this.loot(actor, target);
        actor.openingLoot = true;
      }
      actor.target = null;
      actor.decision = this.clock;
      return;
    }
    if (intent === "work" && (reach < 0.5 || distance(actor, target.workNode) <= 2.7)) {
      if (!this.workAt(actor, target)) { actor.target = null; actor.decision = this.clock; }
      return;
    }
    if (intent === "cook" && reach < 2.38) { this.cookRival(actor, target); return; }
    if (intent === "forage" && reach < 2.4 && this.lineClear(actor, target)) {
      this.harvest(target, actor);
      actor.target = null;
      actor.decision = this.clock + 0.65;
      return;
    }
    if (intent === "drink" && reach < 2.3) {
      actor.hydration = Math.min(100, actor.hydration + 55);
      if (count(actor, "waterskin")) actor.water = 42;
      actor.target = null;
      actor.decision = this.clock;
      return;
    }
    if (reach < 1.0) {
      if (actor.lookAt) actor.yaw = heading(actor, actor.lookAt);
      else if (["investigate", "search", "roam"].includes(intent)) actor.yaw += seconds * (actor.id % 2 ? 1.35 : -1.35);
      return;
    }
    this.moveRival(actor, target, seconds, intent);
  }

  updateActor(actor, seconds) {
    if (!actor.alive) return;
    const oldX = actor.x, oldZ = actor.z;
    actor.cooldown = Math.max(0, actor.cooldown - seconds);
    actor.hurt = Math.max(0, actor.hurt - seconds);
    actor.swing = Math.max(0, actor.swing - seconds);
    actor.shieldRecovery = Math.max(0, actor.shieldRecovery - seconds);
    if (actor.weapon === "crossbow" && !actor.crossbowLoaded && count(actor, "bolts")) {
      actor.reload += seconds;
      if (actor.reload >= 4) {
        actor.crossbowLoaded = true;
        actor.reload = 0;
      }
    }
    if (actor !== this.player) {
      const wasGuarding = actor.guard;
      this.bot(actor, seconds);
      if (actor.guard && !wasGuarding) actor.guardStarted = this.clock;
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
    actor.trackDistance += Math.hypot(actor.x - oldX, actor.z - oldZ);
    if (actor.trackDistance >= 2.3) {
      actor.trackDistance = 0;
      const ground = this.map.heightAt(actor.x, actor.z);
      if (!actor.crouch && Math.abs(actor.y - ground) < 0.35 && this.map.surfaceAt(actor.x, actor.z) <= ground + 0.12) {
        this.footprints.push({ id: ++this.trackSerial, x: actor.x, z: actor.z, at: this.clock,
          maker: actor.id, yaw: Math.atan2(actor.x - oldX, actor.z - oldZ) });
      }
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
    while (this.footprints.length && this.clock - this.footprints[0].at > 8) this.footprints.shift();
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
      let threat = null, closest = 10;
      for (const actor of this.actors) {
        if (!actor.alive) continue;
        const reach = distance(animal, actor);
        if (reach < closest && (!actor.crouch || reach < 4.5)) { threat = actor; closest = reach; }
      }
      if (threat) animal.yaw = heading(threat, animal);
      else animal.yaw += Math.sin(this.clock * 0.45 + animal.phase) * seconds * 0.75;
      const pace = threat ? 3.8 : 0.8;
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
    this.stepRepair();
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
    const template = this.build?.[3]?.blueprint && previewPlayerFort(this, actor, this.build[3].kind, this.buildAngle);
    const building = template?.piece || blueprint;
    const error = template?.error || blueprint?.error || "";
    const support = template?.support || blueprint?.support;
    const ramp = template?.ramp || (blueprint?.id === "ramp" ? blueprint : null);
    const shield = hasShield(actor);
    const raised = shieldRaised(actor);
    const repair = this.repairStatus();
    const buildRows = recipeRows(actor, [...builds, ...playerFortRecipes(this)], true);
    const selectedBuild = this.build && buildRows.find(row => row[0] === this.build[0]);
    const daylight = clamp(0.87 + Math.cos(this.clock / 82) * 0.14, 0.48, 1);
    const { x, y, z, yaw } = actor;
    const lean = this.input.lean * 0.28 || 0;
    const cameraX = x + Math.cos(yaw) * lean;
    const cameraZ = z - Math.sin(yaw) * lean;
    const leaning = lean && this.canOccupy(cameraX, cameraZ, 0, actor);
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
          hasShield(other), shieldRaised(other), Number(hasShield(other) ? shieldRaised(other) : other.guard), other.reload / 4,
          other.crossbowLoaded, other.swing, this.clock - other.woundedAt < 0.43 ? other.hurt / 0.43 : 0,
          other.armor, 0, count(other, "arrows") > 0]),
      wildlife: this.wildlife.filter(animal => !animal.harvested && distance(actor, animal) < 85)
        .map(animal => [animal.model, animal.x, this.map.heightAt(animal.x, animal.z), animal.z, animal.yaw, animal.health > 0, animal.phase]),
      tracks: this.footprints.filter(track => distance(actor, track) < 18)
        .map(track => [track.x, this.map.heightAt(track.x, track.z) + 0.026, track.z, track.yaw, clamp(1 - (this.clock - track.at) / 8)]),
      shots: this.shots.map(shot => [shot.model, shot.x, shot.y, shot.z, shot.yaw, Math.PI / 2 - shot.pitch]),
      ghost: fortPieceRow(blueprint),
      ghostFits: Boolean(building && !error),
      fortGhosts: template ? template.ghosts.map(({ piece, status }) => fortPieceRow(piece, status)) : [],
      fortGuide: building ? {
        title: template?.plan.title || label(building.id), placed: template?.placed ?? 0,
        remaining: template?.remaining ?? 1, total: template?.total ?? 1, error,
        blueprint: Boolean(template), copies: template ? 0 : selectedBuild?.[4].copies ?? 0,
        anchored: Boolean(template?.anchored),
        support: fortPieceRow(support), ramp: ramp ? { x: ramp.x, y: ramp.y, z: ramp.z, w: ramp.w, h: ramp.h, d: ramp.d, angle: ramp.angle } : null
      } : null,
      player: {
        id: actor.id, name: actor.name, yaw, pitch: this.input.pitch || 0,
        health: actor.health, stamina: actor.stamina, hunger: actor.hunger, hydration: actor.hydration,
        water: actor.water, weapon: actor.weapon, armor: actor.armor, aim: actor.guard && !shield,
        hurt: actor.hurt, swing: actor.swing, shield, guard: actor.guard, shieldRaised: raised,
        shieldHealth: shieldDurabilities(actor)[0] ?? 0, shieldMaxHealth: SHIELD_HEALTH,
        guardBlend: Number(shield ? raised : actor.guard), crossbowLoaded: actor.crossbowLoaded, reload: actor.reload / 4, reloadSeconds: 4,
        speed: actor.speed, alive: actor.alive, placement: actor.placement
      },
      alive: this.alive, countdown, winner: this.winner,
      hud: {
        hint: building ? error ? "" : "[Attack] Place " + label(building.id).toLowerCase() :
          selected ? "[E] " + selected.title : this.nearbyRemnant || (this.clock < 15 ? "Look for supplies near the center or along trails." : ""),
        notice: this.clock < this.noticeUntil ? this.notice : "",
        event: !countdown && this.clock < 9 ? "Outlast 23 arena bots." : "",
        feed: this.clock < this.feedUntil ? this.feed : "",
        progress: this.repairJob ? clamp((this.clock - this.repairJob.started) / REPAIR_SECONDS) : 0,
        repair,
        charge: this.drawStarted !== null ? clamp((this.clock - this.drawStarted) / 0.8) :
          this.throwStarted !== null ? clamp((this.clock - this.throwStarted) / 0.75) : 0,
        zone: this.map.zoneAt?.(x, z) || "Arena",
        impact: actor.hurt > 0.15 ? actor.hurt : 0, impactAngle: this.impactAngle, impactStrength: 0.7,
        confirmed: Math.max(0, this.hitUntil - this.clock),
        buildId: this.build?.[0] || "", buildProblem: error,
        useAction: repair?.enabled || repair?.active ? "repair" : selected?.kind || "",
        focusOptions: this.focus.map(option => option.title), focusChoice: this.focusChoice
      },
      pack: Object.entries(actor.bag).map(([id, quantity]) => [id, label(id), quantity])
        .sort((a, b) => a[1].localeCompare(b[1])),
      craft: recipeRows(actor, crafts),
      build: buildRows
    };
  }
}
