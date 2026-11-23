import {
  SPECIES, REGIONS, MAX_LEVEL, AFFINITIES, AURAS, BUFFS, affinityMultiplier,
  getForm, getStats, getAbilities, getAura, xpToNext, captureChance, rollEncounter, makeMember
} from "./catalog.js";

import { playFightEffects, warmFightEffects } from "./fight-effects.js";
import { arenaCourse, huntLair } from "./arena-courses.js";
import { createFightSound } from "./fight-sound.js";
import { FIGHT_ICONS, fightIcon, abilityIconKey, affinityIconKey, auraIconKey, hazardIconKey } from "./fight-icons.js";
import { EXPANSION_BIOMES } from "./expansion-regions.js";

const COLS = 7;
const ROWS = 5;
const CAPTURE_RANGE = 3;
const BIOMES = [
  { cover: "Fern cover", hazard: "Hookbriar", effect: "slow", pattern: ["..c.h..", "...#...", "..h.c..", ".c.#...", "...h..."] },
  { cover: "Reed bed", hazard: "Sour bog", effect: "hurt", pattern: ["...c...", "..h.c..", "...h...", "..#.#..", ".c.h..."] },
  { cover: "Crystal veil", hazard: "Loose shale", effect: "exposed", pattern: ["..#....", "..c.#..", "...h...", ".h.#.c.", "...c..."] },
  { cover: "Tidegrass", hazard: "Riptide", effect: "slow", pattern: ["..h.h..", "...c...", "..#.#..", ".c..h..", "...c..."] },
  { cover: "Snowbank", hazard: "Black ice", effect: "slow", pattern: ["..c.#..", "...h...", "..#..c.", ".h..#..", "...c..."] },
  { cover: "Ash plume", hazard: "Lava vent", effect: "burn", pattern: ["..#....", "...hc..", "..h.h..", ".c.h...", "....#.."] },
  { cover: "Pillar shade", hazard: "Rune trap", effect: "exposed", pattern: ["..c.h..", "..#.#..", "...c...", "..#.#..", "..h.c.."] },
  { cover: "Star mist", hazard: "Starfall", effect: "burn", pattern: ["...c...", "..h.#..", ".c.h.c.", "..#.h..", "...c..."] },
  ...EXPANSION_BIOMES
];
const GROUND = { c: "cover", h: "hazard", "#": "rock" };
const STATUS = { slow: "Slowed", exposed: "Exposed", stun: "Stunned" };
const STATUS_TIP = { slow: "Moves one fewer hex next turn.", exposed: "Takes 25% more damage until its next turn ends.", stun: "Misses its next turn." };
const CONDITIONS = Object.keys(STATUS);
const ROLE_NAME = { defender: "Defender", ranged: "Ranged attacker", striker: "Fast striker", healer: "Healer" };
const keyOf = (x, y) => y * COLS + x;
const xy = key => ({ x: key % COLS, y: Math.floor(key / COLS) });
const nameOf = unit => getForm(unit.member).name;
const living = unit => unit.hp > 0 && !unit.caught;
const activeUnit = battle => battle.units[battle.order[battle.cursor]];
const unitAt = (battle, key) => battle.units.find(u => living(u) && u.key === key);
function log(battle, line, icon) {
  battle.log.push(line);
  battle.logIcons.push(icon);
  if (battle.log.length > 45) {
    battle.log.shift();
    battle.logIcons.shift();
  }
}

// Cell coordinates are snapshots. A Critter may have moved, fainted, or been
// captured by the time a renderer reaches an earlier event in this sequence.
function record(battle, type, actor, target = actor, details = {}) {
  battle.events.push({
    type, region: battle.region, actorId: actor?.id ?? null, targetId: target?.id ?? null,
    from: actor?.key ?? null, to: target?.key ?? null, ...details
  });
}

export function takeBattleEvents(battle) {
  const events = battle.events;
  battle.events = [];
  return events;
}
const percent = rate => Math.round(rate * 100);
export function capturePercent(rate) {
  return rate < .1 ? (rate * 100).toFixed(2) : String(Number((rate * 100).toFixed(1)));
}
const escape = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function hexDistance(a, b) {
  const p = xy(a), q = xy(b);
  const dx = (p.x - Math.floor(p.y / 2)) - (q.x - Math.floor(q.y / 2));
  const dy = p.y - q.y;
  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}

function adjacent(key) {
  const { x, y } = xy(key);
  const side = y % 2 ? 1 : -1;
  return [[x-1,y],[x+1,y],[x,y-1],[x+side,y-1],[x,y+1],[x+side,y+1]]
    .filter(([a,b]) => a >= 0 && a < COLS && b >= 0 && b < ROWS)
    .map(([a,b]) => keyOf(a,b));
}

function aurasAffecting(battle, unit, movedUnit = unit, destination = movedUnit.key) {
  const effects = {};
  const position = critter => critter === movedUnit ? destination : critter.key;
  for (const source of battle.units) {
    const aura = source.aura;
    if (!aura || source === unit || !living(source) || (aura.target === "ally") !== (source.team === unit.team)) continue;
    if (hexDistance(position(source), position(unit)) <= aura.radius) effects[aura.id] ??= source;
  }
  return effects;
}

function auraChanges(battle, mover, destination) {
  return battle.units.filter(living).flatMap(unit => {
    const before = aurasAffecting(battle, unit);
    const after = aurasAffecting(battle, unit, mover, destination);
    return Object.keys(AURAS).filter(id => Boolean(before[id]) !== Boolean(after[id])).map(id => ({
      id, unitId: unit.id, enters: Boolean(after[id])
    }));
  });
}

export function reachable(battle, unit = activeUnit(battle), parents) {
  const visited = new Map([[unit.key, 0]]);
  const queue = [unit.key];
  const limit = movementAllowance(battle, unit);
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], steps = visited.get(key);
    if (steps >= limit || unit.moved) continue;
    for (const next of adjacent(key)) {
      if (visited.has(next) || battle.tiles[next] === "rock" || unitAt(battle, next)) continue;
      visited.set(next, steps + 1);
      parents?.set(next, key);
      queue.push(next);
    }
  }
  return visited;
}

function movementAllowance(battle, unit, movedUnit, destination) {
  const slow = unit.status.slow ? 1 : 0;
  const haste = unit.status.haste ? BUFFS.haste.amount : 0;
  const tailwind = aurasAffecting(battle, unit, movedUnit, destination).tailwind ? AURAS.tailwind.amount : 0;
  return Math.max(1, unit.stats.move - slow + haste + tailwind);
}

function movementPath(battle, actor, destination) {
  if (actor.moved || actor.key === destination) return null;
  const parents = new Map();
  if (!reachable(battle, actor, parents).has(destination)) return null;
  const path = [destination];
  while (path[0] !== actor.key) path.unshift(parents.get(path[0]));
  return path;
}

function buildUnit(member, team, slot, id) {
  const stats = getStats(member);
  const lane = [2, 1, 3, 0, 4][slot % ROWS];
  const edge = Math.floor(slot / ROWS);
  return {
    id, member: {...member}, team, key: keyOf(team === "you" ? edge : COLS-1-edge, lane),
    stats, hp: stats.maxHp, abilities: getAbilities(member), aura: getAura(member), status: {},
    guarded: false, moved: false, caught: false, waitRound: 0, recovery: { heal: 0, stun: 0, support: 0 }
  };
}

export function encounterOpponents(encounter, rng = Math.random) {
  const course = arenaCourse(encounter);
  if (course) {
    const level = encounter.level || REGIONS[encounter.region].minLevel;
    return course.lineup.map((speciesId, slot) => makeMember(
      speciesId, Math.max(1, level - Math.min(slot, 2))
    ));
  }
  const pack = rollEncounter(encounter.region, {
    level: encounter.level, leadSpeciesId: encounter.leadSpeciesId, habitatId: encounter.habitatId,
    legendary: encounter.kind === "legendary", rng
  });
  if (encounter.youngling && huntLair(encounter, SPECIES[pack[0].speciesId])) {
    for (const escort of pack.slice(1)) escort.level = pack[0].level;
    pack[0].level = 3;
  }
  return pack;
}

export function createBattle(encounter, party, opponents, rng = Math.random) {
  const region = Math.max(0, Math.min(BIOMES.length-1, Number(encounter.region) || 0));
  const biome = BIOMES[region];
  const mirror = [...String(encounter.node ?? "")].reduce((n, c) => n + c.charCodeAt(0), 0) % 2;
  const course = arenaCourse(encounter);
  const lair = huntLair(encounter, SPECIES[opponents[0]?.speciesId]);
  const formation = course || lair;
  const ground = formation ? formation.terrain.join("") :
    biome.pattern.map(row => mirror ? [...row].reverse().join("") : row).join("");
  const tiles = [...ground].map(t => GROUND[t] || "plain");
  const units = [...party.map((m,i) => buildUnit(m,"you",i,i)), ...opponents.map((m,i) => buildUnit(m,"wild",i,party.length+i))];
  units.forEach((unit, index) => {
    if (formation) {
      const mark = index < party.length ? "ABCD"[index] : String(index - party.length + 1);
      const start = ground.indexOf(mark);
      if (start >= 0) unit.key = start;
    }
    tiles[unit.key] = "plain";
  });
  const battle = { encounter, region, biome, course, lair, tiles, units, rng, order: [], round: 0, cursor: -1,
    result: null, log: [], logIcons: [], events: [] };
  if (lair) log(battle, lair.omen, "forecast");
  nextTurn(battle);
  return battle;
}

function checkOutcome(battle) {
  if (battle.result) return battle.result;
  if (!battle.units.some(u => u.team === "wild" && living(u))) battle.result = "won";
  else if (!battle.units.some(u => u.team === "you" && living(u))) battle.result = "lost";
  if (battle.result) record(battle, "outcome", null, null, { result: battle.result });
  return battle.result;
}

export function retreatBattle(battle) {
  if (battle.result) return false;
  battle.result = "fled";
  log(battle, "Your party retreated.", "retreat");
  record(battle, "outcome", null, null, { result: battle.result });
  return true;
}

function wound(battle, unit, amount) {
  unit.hp = Math.max(0, unit.hp - amount);
  if (!unit.hp) {
    record(battle, "faint", unit);
    log(battle, nameOf(unit) + " fainted.", "faint");
  }
}

function hazardAt(battle, unit, key) {
  if (battle.tiles[key] !== "hazard") return null;
  const { hazard: name, effect } = battle.biome;
  const fraction = effect === "burn" ? 0.18 : effect === "hurt" ? 0.12 : 0;
  const amount = fraction ? Math.max(2, Math.round(unit.stats.maxHp * fraction)) : 0;
  return { name, effect, amount, hpAfter: Math.max(0, unit.hp - amount) };
}

function finishTile(battle, unit, freshBuff) {
  if (unit.status.regen && freshBuff !== "regen" && unit.hp < unit.stats.maxHp) {
    const amount = Math.min(unit.stats.maxHp - unit.hp, Math.max(1, Math.round(unit.stats.maxHp * BUFFS.regen.amount)));
    unit.hp += amount;
    record(battle, "heal", unit, unit, { amount, hpAfter: unit.hp, buff: "regen" });
    log(battle, nameOf(unit) + " regenerated " + amount + " HP.", "regen");
  }
  const renewal = aurasAffecting(battle, unit).renewal;
  if (renewal && unit.hp < unit.stats.maxHp) {
    const amount = Math.min(unit.stats.maxHp - unit.hp, Math.max(1, Math.round(unit.stats.maxHp * AURAS.renewal.amount)));
    unit.hp += amount;
    record(battle, "heal", renewal, unit, { amount, hpAfter: unit.hp, aura: "renewal" });
    log(battle, nameOf(renewal) + "’s " + AURAS.renewal.name + " restored " + amount + " HP to " + nameOf(unit) + ".", auraIconKey("renewal"));
  }
  for (const status of Object.keys(unit.status)) {
    if (status === freshBuff) continue;
    if (--unit.status[status] <= 0) {
      delete unit.status[status];
      record(battle, "status", unit, unit, { effect: status, phase: "expire" });
    }
  }
  const hazard = hazardAt(battle, unit, unit.key);
  if (!living(unit) || !hazard) return;
  const { name, effect, amount } = hazard;
  record(battle, "hazard", unit, unit, hazard);
  if (amount) {
    log(battle, name + " dealt " + amount + " damage to " + nameOf(unit) + ".", effect);
    wound(battle, unit, amount);
  } else {
    unit.status[effect] = 1;
    record(battle, "status", unit, unit, { effect, phase: "apply" });
    log(battle, name + " left " + nameOf(unit) + " " + STATUS[effect].toLowerCase() + ".", effect);
  }
}

function nextTurn(battle) {
  while (!checkOutcome(battle)) {
    if (++battle.cursor >= battle.order.length) {
      battle.round++;
      battle.order = battle.units.filter(living).sort((a,b) => b.stats.speed - a.stats.speed || a.id - b.id).map(u => u.id);
      battle.cursor = 0;
    }
    const unit = activeUnit(battle);
    if (!living(unit)) continue;
    // Waiting reorders this turn. Its guard and recovery clocks already ticked.
    if (unit.waitRound !== battle.round) {
      if (unit.guarded) record(battle, "status", unit, unit, { effect: "guard", phase: "expire" });
      unit.guarded = false;
      unit.moved = false;
      for (const key of Object.keys(unit.recovery)) {
        if (unit.recovery[key] && --unit.recovery[key] === 0) {
          record(battle, "recovery", unit, unit, { effect: key, phase: "expire" });
        }
      }
    }
    if (!unit.status.stun) return;
    record(battle, "status", unit, unit, { effect: "stun", phase: "skip" });
    log(battle, nameOf(unit) + " missed its turn while stunned.", "stun");
    finishTile(battle, unit);
  }
}

export function canWait(battle) {
  if (battle.result) return false;
  const actor = activeUnit(battle);
  return !actor.moved && actor.waitRound !== battle.round &&
    battle.order.slice(battle.cursor + 1).some(id => living(battle.units[id]));
}

export function waitTurn(battle) {
  if (!canWait(battle)) return false;
  const actor = activeUnit(battle);
  actor.waitRound = battle.round;
  battle.order.splice(battle.cursor, 1);
  battle.order.push(actor.id);
  battle.cursor--;
  record(battle, "wait", actor);
  log(battle, nameOf(actor) + " will act later this round.", "wait");
  nextTurn(battle);
  return true;
}

function finishTurn(battle, actor, freshBuff) {
  if (!checkOutcome(battle)) finishTile(battle, actor, freshBuff);
  if (!checkOutcome(battle)) nextTurn(battle);
}

export function moveUnit(battle, key) {
  if (battle.result) return false;
  const unit = activeUnit(battle);
  const path = movementPath(battle, unit, key);
  if (!path) return false;
  record(battle, "move", unit, unit, { to: key, path });
  unit.key = key;
  unit.moved = true;
  log(battle, nameOf(unit) + " moved " + (path.length - 1) + (path.length === 2 ? " hex." : " hexes."), "move");
  return true;
}

function captureOdds(unit) {
  return captureChance(unit.member, unit.hp / unit.stats.maxHp, CONDITIONS.some(effect => unit.status[effect]));
}

function flank(battle, actor, target, from) {
  return hexDistance(from, target.key) === 1 && battle.units.some(other =>
    other !== actor && other.team === actor.team && living(other) && hexDistance(other.key, target.key) === 1
  );
}

function damageFor(battle, actor, target, skill, from, modifiers) {
  const distance = hexDistance(from, target.key);
  let amount = Math.max(3, actor.stats.attack * skill.power - target.stats.defense * 0.42);
  const affinity = affinityMultiplier(skill.affinity, SPECIES[target.member.speciesId].affinity);
  if (affinity !== 1) {
    amount *= affinity;
    modifiers?.push(affinity > 1 ? "effective" : "resisted");
  }
  if (actor.status.power) {
    amount *= 1 + BUFFS.power.amount;
    modifiers?.push("power");
  }
  if (target.status.ward) {
    amount *= 1 - BUFFS.ward.amount;
    modifiers?.push("ward");
  }
  const attackAuras = aurasAffecting(battle, actor, actor, from);
  const targetAuras = aurasAffecting(battle, target, actor, from);
  if (attackAuras.rally) {
    amount *= 1 + AURAS.rally.amount;
    modifiers?.push(auraIconKey("rally"));
  }
  if (attackAuras.dread) {
    amount *= 1 - AURAS.dread.amount;
    modifiers?.push(auraIconKey("dread"));
  }
  if (targetAuras.bulwark) {
    amount *= 1 - AURAS.bulwark.amount;
    modifiers?.push(auraIconKey("bulwark"));
  }
  if (distance > 1 && battle.tiles[target.key] === "cover") {
    amount *= 0.72;
    modifiers?.push("cover");
  }
  if (target.guarded) {
    amount *= SPECIES[target.member.speciesId].role === "defender" ? 0.4 : 0.55;
    modifiers?.push("guard");
  }
  if (target.status.exposed) {
    amount *= 1.25;
    modifiers?.push("exposed");
  }
  if (flank(battle, actor, target, from)) {
    amount *= 1.2;
    modifiers?.push("flank");
  }
  return Math.max(1, Math.round(amount));
}
function healingFor(actor, skill) {
  return Math.max(4, Math.round(actor.stats.attack * skill.power));
}
function recoveryGroup(skill) {
  if (skill.kind === "heal") return "heal";
  if (skill.kind === "support") return "support";
  return skill.status === "stun" ? "stun" : null;
}
function recovering(actor, skill) {
  return actor.recovery[recoveryGroup(skill)] > 0;
}
function validTarget(actor, target, skill, from = actor.key) {
  if (recovering(actor, skill)) return false;
  if (!target || !living(target) || (target !== actor && hexDistance(from, target.key) > skill.range)) return false;
  if (skill.kind === "guard") return target === actor;
  if (skill.kind === "support") return target.team === actor.team && Boolean(BUFFS[skill.buff]);
  if (skill.kind === "heal") return target.team === actor.team && target.hp < target.stats.maxHp;
  return target.team !== actor.team;
}

function supportTargets(battle, actor, target, skill, from) {
  const position = unit => unit === actor ? from : unit.key;
  return battle.units.filter(unit => {
    if (unit.team !== actor.team || !living(unit)) return false;
    if (unit !== target && (!skill.area || hexDistance(position(target), position(unit)) > skill.area)) return false;
    if (skill.buff === "cleanse") return CONDITIONS.some(effect => unit.status[effect]);
    if (skill.buff === "regen" && unit.hp === unit.stats.maxHp) return false;
    return !unit.status[skill.buff];
  });
}

function supportPreview(battle, actor, target, skill) {
  const effect = BUFFS[skill.buff];
  if (!effect || target.team !== actor.team) return null;
  const recipients = supportTargets(battle, actor, target, skill, actor.key).map(unit => ({
    id: unit.id, key: unit.key, name: nameOf(unit),
    removed: skill.buff === "cleanse" ? CONDITIONS.filter(condition => unit.status[condition]) : []
  }));
  const duration = skill.duration ?? effect.duration;
  return recipients.length ? { type: "support", buff: skill.buff, duration, recipients } : null;
}

function applySupport(battle, actor, preview) {
  for (const recipient of preview.recipients) {
    const unit = battle.units[recipient.id];
    if (preview.buff === "cleanse") {
      for (const effect of recipient.removed) delete unit.status[effect];
    } else {
      unit.status[preview.buff] = preview.duration;
    }
  }
  const skillName = preview.skillName ?? preview.supplyName;
  log(battle, nameOf(actor) + " used " + skillName + " on " + preview.recipients.map(recipient => recipient.name).join(", ") + ".", preview.buff);
  return preview.recipients.some(recipient => recipient.id === actor.id) ? preview.buff : undefined;
}

function skillPreview(battle, actor, target, skill) {
  if (!skill || !validTarget(actor, target, skill)) return null;
  const move = { skillId: skill.id, skillName: skill.name };
  if (skill.kind === "guard") return { type: "guard", ...move };
  if (skill.kind === "heal") {
    const amount = Math.min(healingFor(actor, skill), target.stats.maxHp - target.hp);
    return { type: "heal", ...move, amount, hpAfter: target.hp + amount };
  }
  if (skill.kind === "support") {
    const preview = supportPreview(battle, actor, target, skill);
    return preview ? { ...preview, ...move } : null;
  }
  const modifiers = [];
  const amount = damageFor(battle, actor, target, skill, actor.key, modifiers);
  const hpAfter = Math.max(0, target.hp - amount);
  return { type: "attack", ...move, style: skill.range > 1 ? "ranged" : "melee",
    amount, hpAfter, modifiers, affinity: skill.affinity, effect: hpAfter ? skill.status : null };
}

function capturePreview(actor, target) {
  if (actor.team !== "you" || !target || target.team !== "wild" || !living(target) ||
      hexDistance(actor.key, target.key) > CAPTURE_RANGE) return null;
  return { type: "capture", chance: captureOdds(target) };
}

function supplyPreview(battle, actor, target, item) {
  if (actor.team !== "you" || !target || !living(target) || !item || !(item.count > 0) ||
      hexDistance(actor.key, target.key) > (item.range ?? CAPTURE_RANGE)) return null;
  const supply = {supplyId:item.id, supplyName:item.name};
  if (item.kind === "support") {
    const preview = supportPreview(battle, actor, target, item);
    return preview ? { ...preview, ...supply } : null;
  }
  if (!Number.isFinite(item.power) || item.power <= 0) return null;
  if (item.kind === "capture" && target.team === "wild") {
    const baseChance = captureOdds(target);
    return {type:"capture", chance:Math.min(.99, baseChance + item.power), baseChance, ...supply};
  }
  if (item.kind !== "heal" || target.team !== actor.team || target.hp >= target.stats.maxHp) return null;
  const amount = Math.min(item.power, target.stats.maxHp - target.hp);
  return {type:"heal", amount, hpAfter:target.hp + amount, ...supply};
}

export function previewAction(battle, mode, key) {
  if (battle.result || !Number.isInteger(key) || key < 0 || key >= battle.tiles.length) return null;
  const actor = activeUnit(battle);
  if (mode === "move") {
    const path = movementPath(battle, actor, key);
    return path ? { type: "move", path, hazard: hazardAt(battle, actor, key), auraChanges: auraChanges(battle, actor, key) } : null;
  }
  const target = unitAt(battle, key);
  if (mode === "guard") return actor === target ? { type: "guard" } : null;
  if (mode === "capture") return capturePreview(actor, target);
  if (typeof mode === "object") return supplyPreview(battle, actor, target, mode);
  return Number.isInteger(mode) ? skillPreview(battle, actor, target, actor.abilities[mode]) : null;
}

export function useAbility(battle, index, target) {
  if (battle.result || !battle.units.includes(target)) return false;
  const actor = activeUnit(battle);
  const skill = actor.abilities[index];
  const preview = skillPreview(battle, actor, target, skill);
  if (!preview) return false;
  if (skill.kind === "guard") return guard(battle);
  const recovery = recoveryGroup(skill);
  let freshBuff;
  record(battle, preview.type, actor, target, preview);
  if (skill.kind === "heal") {
    target.hp = preview.hpAfter;
    log(battle, nameOf(actor) + " used " + skill.name + " and restored " + preview.amount + " HP to " + nameOf(target) + ".", "heal");
  } else if (skill.kind === "support") {
    freshBuff = applySupport(battle, actor, preview);
  } else {
    const bonus = preview.modifiers.length ? " (" + preview.modifiers.map(key => FIGHT_ICONS[key].label.toLowerCase()).join(", ") + ")" : "";
    log(battle, nameOf(actor) + " used " + skill.name + " on " + nameOf(target) + " for " + preview.amount + bonus + ".", preview.style);
    wound(battle, target, preview.amount);
    if (preview.effect) {
      target.status[preview.effect] = 1;
      record(battle, "status", actor, target, { effect: preview.effect, phase: "apply" });
      log(battle, nameOf(target) + " is " + STATUS[preview.effect].toLowerCase() + ".", preview.effect);
    }
  }
  if (recovery) {
    actor.recovery[recovery] = 2;
    record(battle, "recovery", actor, actor, { effect: recovery, phase: "apply" });
  }
  finishTurn(battle, actor, freshBuff);
  return true;
}

export function guard(battle) {
  if (battle.result) return false;
  const unit = activeUnit(battle);
  unit.guarded = true;
  record(battle, "guard", unit);
  log(battle, nameOf(unit) + " took guard.", "guard");
  finishTurn(battle, unit);
  return true;
}

export function attemptCapture(battle, target) {
  if (battle.result) return false;
  const actor = activeUnit(battle);
  const preview = capturePreview(actor, target);
  if (!preview) return false;
  resolveCapture(battle, actor, target, preview);
  finishTurn(battle, actor);
  return true;
}

function resolveCapture(battle, actor, target, preview) {
  target.caught = battle.rng() < preview.chance;
  record(battle, "capture", actor, target, { ...preview, success: target.caught });
  const intro = preview.supplyName ? preview.supplyName + " used. " : "";
  log(battle, intro + (target.caught ? nameOf(target) + " joined your force!" : nameOf(target) + " escaped the capture (" + capturePercent(preview.chance) + "% chance)."),
    target.caught ? "caught" : "escaped");
}

export function useBattleSupply(battle, item, target, spend) {
  if (battle.result || !battle.units.includes(target)) return false;
  const actor = activeUnit(battle);
  const preview = supplyPreview(battle, actor, target, item);
  if (!preview || spend?.(item.id) !== true) return false;
  let freshBuff;
  if (preview.type === "capture") {
    resolveCapture(battle, actor, target, preview);
  } else if (preview.type === "support") {
    record(battle, "support", actor, target, preview);
    freshBuff = applySupport(battle, actor, preview);
  } else {
    target.hp = preview.hpAfter;
    record(battle, "heal", actor, target, preview);
    log(battle, item.name + " restored " + preview.amount + " HP to " + nameOf(target) + ".", "heal");
  }
  finishTurn(battle, actor, freshBuff);
  return true;
}

function supportValue(battle, actor, target, skill, from, opponents) {
  const buff = BUFFS[skill.buff];
  const duration = skill.duration ?? buff.duration;
  const durationValue = buff.duration && skill.buff !== "regen" ? duration / buff.duration : 1;
  return supportTargets(battle, actor, target, skill, from).reduce((total, unit) => {
    const position = unit === actor ? from : unit.key;
    const distance = Math.min(...opponents.map(opponent => hexDistance(position, opponent.key)));
    const range = attackReach(unit);
    const attack = unit.stats.attack;
    const threatened = opponents.some(opponent => hexDistance(position, opponent.key) <= opponent.stats.move + opponent.stats.range);
    switch (skill.buff) {
      case "power":
        return total + (distance <= range + movementAllowance(battle, unit, actor, from) ? attack * buff.amount * (unit === actor ? 1.1 : 1.65) : 0);
      case "ward":
        return total + (threatened ? unit.stats.maxHp * buff.amount * (unit.hp < unit.stats.maxHp / 2 ? .65 : .38) : 0);
      case "haste":
        return total + (distance > range && distance <= range + movementAllowance(battle, unit, actor, from) + 2 ? attack * .5 : 0);
      case "cleanse":
        return total + attack * ((unit.status.stun ? 1 : 0) + (unit.status.exposed && threatened ? .35 : 0) + (unit.status.slow && distance > range ? .3 : 0));
      case "regen":
        return total + Math.min(unit.stats.maxHp - unit.hp, unit.stats.maxHp * buff.amount * duration) * (threatened ? .7 : 1);
      default:
        return total;
    }
  }, 0) * durationValue;
}

const attackReach = unit => Math.max(1, ...unit.abilities.filter(skill => skill.kind === "attack").map(skill => skill.range));

function auraPositionValue(battle, actor, destination, opponents) {
  if (destination === actor.key) return 0;
  return auraChanges(battle, actor, destination).reduce((total, {id, unitId, enters}) => {
    const unit = battle.units[unitId];
    const position = unit === actor ? destination : unit.key;
    const range = attackReach(unit);
    const distance = Math.min(...opponents.map(opponent => hexDistance(position, opponent.key)));
    const nearCombat = distance <= range + movementAllowance(battle, unit, actor, destination);
    const aura = AURAS[id];
    let value = 0;
    switch (id) {
      case "rally": value = nearCombat ? unit.stats.attack * aura.amount * .65 : 0; break;
      case "bulwark": value = nearCombat ? unit.stats.maxHp * aura.amount * .32 : 0; break;
      case "tailwind": value = distance > range && nearCombat ? 2.5 : 0; break;
      case "renewal": value = Math.min(unit.stats.maxHp - unit.hp, unit.stats.maxHp * aura.amount) * .8; break;
      // Either bringing an enemy into Dread or stepping out of enemy Dread helps this team.
      case "dread": value = unit.stats.attack * aura.amount * (unit === actor ? -.55 : .65); break;
    }
    return total + value * (enters ? 1 : -1);
  }, 0);
}

export function planEnemyTurn(battle) {
  const actor = activeUnit(battle), options = reachable(battle, actor);
  const opponents = battle.units.filter(u => u.team !== actor.team && living(u));
  const reach = attackReach(actor);
  let best = { score: -Infinity };
  for (const [key, steps] of options) {
    const distance = Math.min(...opponents.map(e => hexDistance(key, e.key)));
    const tile = battle.tiles[key];
    const ground = (tile === "cover" ? 1.6 : tile === "hazard" ? -6 : 0);
    // Ranged species seek firing distance. A tiny movement cost keeps equivalent choices stable.
    const position = ground - Math.abs(distance-reach)*1.7 - steps*.06 + auraPositionValue(battle, actor, key, opponents);
    const consider = (score, i, target) => { if (score > best.score) best = { score, key, i, target }; };
    consider(position, null, null);
    actor.abilities.forEach((skill,i) => {
      if (skill.kind === "guard") return;
      battle.units.forEach(target => {
        if (!validTarget(actor, target, skill, key)) return;
        if (skill.kind === "heal") {
          const restored = Math.min(healingFor(actor,skill), target.stats.maxHp-target.hp);
          const urgency = target.hp / target.stats.maxHp < 0.4 ? 1.65 : 0.9;
          consider(position + restored * urgency, i, target);
        } else if (skill.kind === "support") {
          const value = supportValue(battle, actor, target, skill, key, opponents);
          if (value > 0) consider(position + value, i, target);
        } else {
          const dmg = damageFor(battle,actor,target,skill,key);
          const finisher = target.hp <= dmg ? 14 : 0;
          const status = !finisher && skill.status && !target.status[skill.status] ? (skill.status === "stun" ? 7 : 3) : 0;
          consider(position + Math.min(dmg,target.hp) + finisher + status, i, target);
        }
      });
    });
  }
  return best;
}

function outcome(battle) {
  const wild = battle.units.filter(u => u.team === "wild");
  const xp = battle.result === "won" ? Math.round(10 + wild.reduce((total,u) => total+4+2*u.member.level,0)) : 0;
  return { result: battle.result, encounter: battle.encounter, xp,
    party: battle.units.filter(u => u.team === "you").map(u => ({...u.member,hp:u.hp})),
    captured: wild.filter(u => u.caught).map(u => ({...u.member})) };
}

const HAZARD_INFO = {
  slow: "End here: lose 1 move next turn.", exposed: "End here: take 25% more damage next turn.",
  hurt: "End here: lose 12% of max HP.", burn: "End here: lose 18% of max HP."
};
function terrainInfo(battle, tile) {
  return ({
    plain: ["Open ground", "Clear footing."],
    cover: [battle.biome.cover, "Reduces incoming ranged damage by 28%."],
    hazard: [battle.biome.hazard, HAZARD_INFO[battle.biome.effect]],
    rock: ["Stone", "Blocks movement."]
  })[tile];
}

let playbackSpeed = 1;
const icon = key => fightIcon(key, "");
const effectsOn = unit => Object.keys(unit.status).filter(effect => unit.status[effect] > 0);
const effectName = effect => STATUS[effect] ?? BUFFS[effect].name;
const turns = count => count + (count === 1 ? " turn" : " turns");
const hexes = count => count + (count === 1 ? " hex" : " hexes");
const affinityName = affinity => AFFINITIES[affinity]?.name ?? "Neutral";

function targetPrompt(skill) {
  if (skill.kind === "heal") return "a wounded ally";
  if (skill.buff === "regen") return skill.area ? "an ally near a wounded companion" : "a wounded ally";
  if (skill.buff === "cleanse") return skill.area ? "an ally near a debuffed companion" : "an ally with a harmful condition";
  if (skill.kind === "support") return skill.range ? "an ally" : "this Critter";
  return "an opponent";
}

export function mountBattle(root, { encounter, party, sprite, onFinish, onResolved, getSupplies = () => [], spendSupply }) {
  const opponents = encounterOpponents(encounter);
  const battle = createBattle(encounter, party, opponents);
  const quarry = battle.lair ? battle.units.find(u => u.team === "wild" && SPECIES[u.member.speciesId].hyperRare) : null;
  const regionHazard = hazardIconKey(battle.region);
  const area = REGIONS[battle.region], artRegion = area.artRegion ?? battle.region;
  warmFightEffects(battle.units);
  const sound = createFightSound();
  const face = unit => sprite(unit.member.speciesId, getForm(unit.member).stage);
  const isPlayer = () => !battle.result && activeUnit(battle).team === "you";
  const animateArrival = Boolean(quarry) && !root.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let opening = animateArrival;
  let mode = "move", inspectedKey = quarry?.key ?? null, note = "", focusKey = activeUnit(battle).key;
  let logOpen = false, keyOpen = false, packOpen = false, retreat = false, disposed = false, timer = 0;
  let playback = null, resolution = null;
  function saveResult() {
    if (battle.result && !resolution) {
      resolution = outcome(battle);
      const rewards = onResolved?.(resolution);
      if (Number.isSafeInteger(rewards?.coins) && rewards.coins > 0) resolution.coins = rewards.coins;
    }
  }
  function terrainIcon(tile) { return tile === "hazard" ? regionHazard : tile; }
  function auraDescription(unit) {
    const { aura } = unit;
    return aura ? '<p class="cb-aura-detail">'+icon(auraIconKey(aura.id))+'<span><b>'+escape(aura.name)+
      ' · '+hexes(aura.radius)+'</b><small>'+escape(aura.tip)+'</small></span></p>' : '';
  }
  function activeEffects(unit, compact = false) {
    const effects = effectsOn(unit).map(effect => ({
      key: effect, label: effectName(effect) + " · " + turns(unit.status[effect]), tip: STATUS_TIP[effect] ?? BUFFS[effect].tip
    }));
    if (unit.guarded) effects.push({key:"guard", label:"Guarding", tip:"Reduces damage until this Critter’s next turn."});
    for (const [id, source] of Object.entries(aurasAffecting(battle, unit))) {
      effects.push({key: auraIconKey(id), label: AURAS[id].name, tip: `From ${nameOf(source)}. ${AURAS[id].tip}`});
    }
    if (!effects.length) return "";
    return '<span class="'+(compact ? "cb-pips" : "cb-effects")+'">'+effects.map(e =>
      '<span class="cb-effect" title="'+escape(e.label + ". " + e.tip)+'">'+icon(e.key)+(compact ? "" : escape(e.label))+'</span>'
    ).join("")+'</span>';
  }
  function forecastText(prediction) {
    if (!prediction) return "";
    if (prediction.type === "capture") return capturePercent(prediction.chance) + "% capture";
    if (prediction.type === "heal") return "+" + prediction.amount + " HP";
    if (prediction.type === "attack") {
      const matchup = prediction.modifiers.find(key => key === "effective" || key === "resisted");
      return "−" + prediction.amount + " HP" + (matchup ? " · " + FIGHT_ICONS[matchup].label : "");
    }
    if (prediction.type === "support") return BUFFS[prediction.buff].name;
    if (prediction.type === "move") return hexes(prediction.path.length - 1);
    return "";
  }
  function inspectPanel(key) {
    const u = unitAt(battle,key), tile = battle.tiles[key];
    const [terrain, tip] = terrainInfo(battle,tile);
    const prediction = isPlayer() && !retreat ? previewAction(battle,mode,key) : null;
    let forecast = "";
    if (prediction) {
      const extras = [];
      if (prediction.type === "attack" || prediction.type === "heal") {
        extras.push(prediction.hpAfter + " / " + u.stats.maxHp + " HP after");
        if (prediction.type === "attack") extras.push(icon(affinityIconKey(prediction.affinity)) + escape(affinityName(prediction.affinity)));
        for (const modifier of prediction.modifiers || []) extras.push(icon(modifier) + escape(FIGHT_ICONS[modifier].label));
        if (prediction.effect) extras.push(icon(prediction.effect) + escape(STATUS[prediction.effect] || prediction.effect));
      } else if (prediction.type === "support") {
        if (prediction.duration) extras.push(turns(prediction.duration));
        extras.push(...prediction.recipients.map(({name, removed}) => escape(name) +
          (removed.length ? " (clears " + escape(removed.map(effectName).join(", ")) + ")" : "")));
      } else if (prediction.type === "capture") {
        extras.push(capturePercent(captureChance(u.member, 1, false)) + "% at full HP");
        if (prediction.supplyName) extras.push(escape(prediction.supplyName) + " · " + capturePercent(prediction.baseChance) + "% without charm");
        if (u.hp < u.stats.maxHp) extras.push(icon("damage") + "Weakened");
        if (effectsOn(u).some(effect => CONDITIONS.includes(effect))) extras.push(icon("status") + "Harmful condition bonus");
      } else if (prediction.type === "move") {
        if (prediction.hazard) {
          extras.push(icon(regionHazard) + escape(prediction.hazard.name));
          if (prediction.hazard.amount) extras.push("−" + prediction.hazard.amount + " HP at turn end");
          else extras.push(escape(tip));
        }
        for (const {id, unitId, enters} of prediction.auraChanges) {
          extras.push(icon(auraIconKey(id)) + escape(nameOf(battle.units[unitId]) + (enters ? " gains " : " loses ") + AURAS[id].name));
        }
      }
      forecast = '<div class="cb-forecast">'+icon("forecast")+'<div><b>'+escape(forecastText(prediction))+'</b>'+
        (extras.length ? '<small>'+extras.join(' · ')+'</small>' : '')+'</div></div>';
    }
    const terrainLine = '<div class="cb-ground-tip">'+icon(terrainIcon(tile))+'<div><b>'+escape(terrain)+'</b>'+
      (tile === "plain" && u ? "" : '<small>'+escape(tip)+'</small>')+'</div></div>';
    if (!u) return '<div class="cb-inspect">'+terrainLine+forecast+'</div>';
    const species = SPECIES[u.member.speciesId], isWild = u.team === "wild";
    return '<div class="cb-inspect"><div class="cb-ident"><span class="cb-portrait">'+face(u)+'</span><div><small>'+
      (isWild ? "WILD" : "ALLY")+(species.hyperRare ? " · HYPER RARE" : "")+' · LV '+u.member.level+'</small><strong>'+escape(nameOf(u))+'</strong><span>'+
      icon(species.role === "ranged" ? "archer" : species.role)+escape(ROLE_NAME[species.role])+'</span></div></div>'+
      '<div class="cb-stat"><span>'+icon(affinityIconKey(species.affinity))+'Affinity</span><b>'+escape(affinityName(species.affinity))+'</b></div>'+
      '<div class="cb-stat"><span>'+icon("hp")+'Health</span><b>'+u.hp+' / '+u.stats.maxHp+'</b></div>'+
      '<div class="cb-meter"><i style="width:'+100*u.hp/u.stats.maxHp+'%"></i></div>'+
      (isWild ? '<div class="cb-stat cb-odds"><span>'+icon("capture")+'Free capture</span><b>'+capturePercent(captureOdds(u))+'%</b></div>' :
        '<div class="cb-stat"><span>'+icon("xp")+'XP</span><b>'+(u.member.level >= MAX_LEVEL ? "MAX" : u.member.xp+' / '+xpToNext(u.member.level))+'</b></div>')+
      auraDescription(u)+activeEffects(u)+(tile !== "plain" ? terrainLine : "")+forecast+'</div>';
  }
  function auraZone(key, actor) {
    if (battle.result || retreat) return null;
    const inspected = unitAt(battle, key);
    if (inspected?.aura) return { aura: inspected.aura, key: inspected.key };
    if (!actor.aura) return null;
    const couldMove = isPlayer() && mode === "move" && Number.isInteger(key) && movementPath(battle, actor, key);
    return { aura: actor.aura, key: couldMove ? key : actor.key };
  }
  function zoneAttribute(zone, key) {
    return zone && hexDistance(zone.key, key) <= zone.aura.radius ? zone.aura.id : null;
  }
  function cellMarkup(key, actor, zone) {
    const tile = battle.tiles[key], u = unitAt(battle,key), {x,y} = xy(key);
    const [terrain, terrainTip] = terrainInfo(battle,tile);
    const forecast = isPlayer() && !retreat ? previewAction(battle, mode, key) : null;
    const moving = forecast?.type === "move", targeting = forecast && !moving;
    const active = !battle.result && u === actor;
    const hint = (forecast ? forecastText(forecast) + ". " : "") + terrainTip;
    const cellName = String.fromCharCode(65+x)+(y+1);
    const parts = ["cb-cell","cb-"+tile];
    if (u) parts.push("cb-occupied","cb-"+u.team);
    if (u && u === quarry) parts.push("cb-quarry");
    if (active) parts.push("cb-active");
    if (moving) parts.push("cb-reach");
    if (targeting) parts.push("cb-target","cb-target-"+forecast.type);
    if (inspectedKey === key) parts.push("cb-selected");
    const occupant = u ? [nameOf(u), u.team === "you" ? "Ally" : "Wild", ...(u === quarry ? ["Hyper Rare"] : []),
      affinityName(SPECIES[u.member.speciesId].affinity), u.hp+"/"+u.stats.maxHp+" HP",
      ...(u.aura ? ["Emits " + u.aura.name + " within " + hexes(u.aura.radius)] : []),
      ...Object.entries(aurasAffecting(battle, u)).map(([id, source]) => AURAS[id].name + " from " + nameOf(source)),
      ...effectsOn(u).map(effect => effectName(effect)+" "+turns(u.status[effect])), ...(u.guarded ? ["Guarding"] : [])].join(" · ")+". " : "";
    const title = cellName+". "+occupant+terrain+". "+hint;
    const ground = tile === "plain" ? "" : '<span class="cb-terrain-art" aria-hidden="true"></span><span class="cb-terrain-mark">'+icon(terrainIcon(tile))+'</span>';
    let content = '<span class="cb-floor"></span><span class="cb-aura-range" aria-hidden="true"></span>'+ground+(moving ? '<span class="cb-step"></span>' : '');
    if (u) {
      content += '<span class="cb-creature" aria-hidden="true">'+face(u)+'</span>'+
        '<i class="cb-hp"><b style="width:'+Math.ceil(100*u.hp/u.stats.maxHp)+'%"></b></i>'+activeEffects(u,true);
      if (u === quarry) content += '<i class="cb-quarry-sigil" aria-hidden="true"></i>';
      if (active) content += '<span class="cb-cursor">'+icon("turn")+'</span>';
      if (u.aura) content += '<span class="cb-aura-source" aria-hidden="true">'+icon(auraIconKey(u.aura.id))+'</span>';
      if (targeting) {
        const matchup = forecast.modifiers?.find(key => key === "effective" || key === "resisted");
        let amount = "";
        if (forecast.type === "capture") amount = capturePercent(forecast.chance)+"%";
        if (forecast.type === "heal") amount = "+"+forecast.amount;
        if (forecast.type === "attack") amount = (matchup ? icon(matchup) : "")+"−"+forecast.amount;
        if (forecast.type === "support") amount = icon(forecast.buff)+(forecast.recipients.length > 1 ? forecast.recipients.length : "");
        if (amount) content += '<b class="cb-amount cb-amount-'+forecast.type+(matchup ? ' cb-amount-'+matchup : '')+'">'+amount+'</b>';
      }
    }
    const zoneId = zoneAttribute(zone, key);
    return '<button type="button" data-cell="'+key+'" '+(u ? 'data-unit-id="'+u.id+'" ' : '')+
      (zoneId ? 'data-aura-zone="'+zoneId+'" ' : '')+'class="'+parts.join(" ")+'" tabindex="'+
      (key === focusKey ? 0 : -1)+'" style="--x:'+((x+(y%2)*.5)/7.5*100)+'%;--y:'+(y*18.75)+'%" title="'+escape(title)+'" aria-label="'+escape(title)+'">'+content+'</button>';
  }
  function command(action, glyph, label, caption, selected, disabled, tip, markers = []) {
    const pressed = ["guard", "wait"].includes(action) ? "" : ' aria-pressed="'+Boolean(selected)+'"';
    return '<button type="button" data-act="'+escape(action)+'" class="cb-command'+(selected ? ' chosen' : '')+'"'+pressed+
      (disabled ? ' disabled' : '')+(tip ? ' title="'+escape(tip)+'"' : '')+'><span class="cb-command-art">'+icon(glyph)+'</span>'+
    '<span class="cb-command-text"><b>'+escape(label)+'</b><small>'+escape(caption)+markers.map(effect => ' '+fightIcon(effect)).join('')+'</small></span></button>';
  }
  function commands(actor, interactive) {
    if (!actor || battle.result) return "";
    const skills = actor.abilities.flatMap((a,i) => {
      if (a.kind === "guard") return [];
      const resting = recovering(actor,a);
      const caption = a.range ? hexes(a.range) : "Self";
      const markers = a.kind === "attack" ? [affinityIconKey(a.affinity), a.status].filter(Boolean) : a.buff ? [a.buff] : [];
      return command('skill-'+i,resting ? "cooldown" : abilityIconKey(a,SPECIES[actor.member.speciesId]),a.name,
        resting ? "Rest · 1 turn" : caption,mode === i,!interactive || resting,a.description,markers);
    });
    const supplies = getSupplies();
    const pack = supplies.length ? '<details class="cb-pack"'+(packOpen ? ' open' : '')+'><summary>Battle bag · '+
      supplies.reduce((sum, item) => sum + item.count, 0)+'</summary><div>'+supplies.map(item => {
        const effect = item.kind === "support" ? BUFFS[item.buff].name :
          item.kind === "heal" ? "+"+item.power+" HP" : "+"+percent(item.power)+" pts";
        return command("supply-"+item.id,item.buff ?? item.kind,item.name,"×"+item.count+" · "+effect,
          mode?.id === item.id,!interactive,item.description);
      }).join("")+'</div></details>' : "";
    return [
      command("move","move","Move",actor.moved ? "Already moved" : hexes(movementAllowance(battle, actor)),
        mode === "move",!interactive || actor.moved,"Move along a lit path before acting."),
      ...skills,
      command("capture","capture","Capture","3 hexes",mode === "capture",!interactive,"Select a marked wild Critter to attempt capture."),
      command("guard","guard",actor.abilities.find(a => a.kind === "guard")?.name || "Guard","End turn",false,!interactive,"Reduce incoming damage until your next turn."),
      command("wait","wait","Wait","Act later",false,!interactive || !canWait(battle),"Before moving, act after the remaining Critters this round. Once per round."),
      pack
    ].join("");
  }
  function legendList(keys) {
    return [...new Set(keys)].filter(key => FIGHT_ICONS[key]).map(key => '<div>'+icon(key)+'<div><b>'+
      escape(FIGHT_ICONS[key].label)+'</b><small>'+escape(FIGHT_ICONS[key].description)+'</small></div></div>').join("");
  }
  const arenaKeys = battle.units.flatMap(u => [
    ...u.abilities.map(a => abilityIconKey(a, SPECIES[u.member.speciesId])),
    ...(u.aura ? [auraIconKey(u.aura.id)] : [])
  ]);
  const glossary = legendList(["move","wait","melee","ranged","heal","guard","capture","caught","escaped","faint","flank","cover","rock",regionHazard,
    battle.biome.effect,"slow","stun","exposed","effective","resisted","neutral",...Object.keys(BUFFS),"clear","cooldown","skip",...arenaKeys]);
  function keyMarkup() {
    return '<details class="cb-key"'+(keyOpen ? ' open' : '')+'><summary><b>Effect key</b><span>'+
      icon("cover")+'Cover</span><span>'+icon(regionHazard)+escape(battle.biome.hazard)+'</span><span>'+icon("rock")+'Blocked</span></summary>'+
      (battle.units.some(unit => unit.aura) ? '<p class="cb-aura-key">Inspect an aura carrier to see its range. Positioning controls who benefits, and auras of the same kind never stack.</p>' : '')+
      '<div class="cb-glossary">'+glossary+'</div></details>';
  }
  function restoreFocus(old) {
    const {cell,act} = old;
    const selector = cell !== undefined ? '[data-cell="'+cell+'"]' : act ? '[data-act="'+act+'"]' : null;
    if (selector) {
      const el = root.querySelector(selector);
      if (el && !el.disabled && !el.hidden) el.focus({preventScroll:true});
    }
  }
  function soundControl() {
    const enabled = sound.enabled;
    return '<button type="button" data-act="sound" aria-label="Battle sound" aria-pressed="'+enabled+'" title="'+(enabled ? "Mute effects" : "Enable sound effects")+'">'+
      icon(enabled ? "sound-on" : "sound-off")+'<span>'+(enabled ? "Sound on" : "Sound off")+'</span></button>';
  }
  function huntArrival() {
    if (!quarry || !opening) return "";
    const {x,y} = xy(quarry.key);
    return '<span class="cb-hunt-arrival" aria-hidden="true" style="--quarry-x:'+((x + (y%2)*.5 + .5)/7.5*100)+'%;--quarry-y:'+(y*18.75 + 12.5)+'%">'+
      '<i class="cb-lair-wave"></i><i class="cb-lair-wave cb-second-wave"></i><i class="cb-lair-motes"></i></span>';
  }
  function quarryStrip() {
    if (!quarry) return "";
    const condition = quarry.caught ? "Captured" : !living(quarry) ? "Defeated" : "Lv. " + quarry.member.level;
    return '<div class="cb-quarry-strip"><i class="cb-quarry-sigil" aria-hidden="true"></i><strong>'+
      escape(nameOf(quarry))+'</strong><span>Hyper Rare'+(encounter.youngling ? ' youngling' : '')+'</span><b>'+condition+'</b></div>';
  }
  function draw() {
    if (disposed) return;
    const focus = root.contains(document.activeElement) ? document.activeElement.dataset : {};
    const actor = activeUnit(battle), interactive = isPlayer() && !retreat;
    const selectedSkill = typeof mode === "number" && actor ? actor.abilities[mode] : null;
    const zone = auraZone(inspectedKey, actor);
    const cells = battle.tiles.map((_,key) => cellMarkup(key,actor,zone)).join("");
    const turnOrder = battle.order.slice(battle.cursor).map(id => battle.units[id]).filter(living);
    let hint = "Move on a lit hex, then choose an action.";
    if (mode === "capture") hint = "Tap a marked Critter to attempt capture at the displayed chance.";
    if (mode?.id) hint = mode.description + " Choose a marked " + (mode.kind === "capture" ? "opponent." : "ally.");
    if (selectedSkill) hint = selectedSkill.description + " Choose " + targetPrompt(selectedSkill) + ".";
    if (!interactive) hint = retreat ? "Confirm or cancel retreat." : "The wild tribe is taking its turn.";
    if (note) hint = note;
    const end = resolution;
    const resultName = {won:"Victory", lost:"Party exhausted", fled:"Retreated"};
    const outcomeGlyph = {won:"victory", lost:"defeat", fled:"retreat"};
    const outcomeBody = end ? '<section class="cb-outcome" aria-live="polite"><div><span class="cb-outcome-seal">'+icon(outcomeGlyph[end.result])+'</span><h3>'+resultName[end.result]+'</h3>'+
      (end.xp ? '<p>'+icon("xp")+'+'+end.xp+' XP for each party member.</p>' : '')+
      (end.coins ? '<p class="cb-coin-reward">+'+end.coins+' coins</p>' : '')+
      (end.captured.length ? '<p>'+icon("caught")+'Captured '+end.captured.map(m => escape(getForm(m).name)+(SPECIES[m.speciesId].hyperRare ? ' (Hyper Rare)' : '')).join(", ")+'.</p>' : '')+
      (!end.xp && !end.captured.length ? '<p>Your party regroups on the trail.</p>' : '')+
      '<button type="button" data-act="return">Return to trail</button></div></section>' : "";
    const orders = turnOrder.map((u,index) => {
      const title = (index === 0 ? "Acting now" : "Upcoming") + " · " + nameOf(u) + (u.team === "you" ? " · Ally" : " · Wild") + (u === quarry ? " · Hyper Rare" : "");
      return '<span class="cb-order-token cb-order-'+u.team+'" title="'+escape(title)+'" aria-label="'+escape(title)+'" role="img"><span aria-hidden="true">'+face(u)+'</span></span>';
    }).join("");
    const logLines = battle.log.slice(-12).reverse().map((line,i) => '<li>'+icon(battle.logIcons?.[battle.log.length-1-i] || "turn")+'<span>'+escape(line)+'</span></li>').join("");
    root.innerHTML = '<section class="cb-shell" aria-busy="false" aria-label="Tactical encounter"><header class="cb-heading"><div><small>'+
      (quarry ? '<i class="cb-quarry-sigil" aria-hidden="true"></i> HYPER RARE HUNT' :
        icon(encounter.kind === "arena" ? "warden" : encounter.kind || "tribe")+({tribe:"WILD TRIBE",arena:"ARENA TRIAL",warden:"WARDEN ARENA",legendary:"LEGENDARY ENCOUNTER"}[encounter.kind] || "ENCOUNTER"))+
      '</small><h2>'+escape(encounter.name || "Wild tribe")+'</h2></div><div class="cb-toolbar">'+soundControl()+
      '<button type="button" data-act="pace" aria-label="Animation speed '+playbackSpeed+' times" title="Change animation speed">'+icon("speed")+playbackSpeed+'×</button>'+
      '<button type="button" data-act="retreat" '+(end ? 'disabled' : '')+'>'+icon("retreat")+'Retreat</button></div></header>'+
      (retreat && !end ? '<div class="cb-retreat" role="group" aria-label="Confirm retreat"><span>Leave this encounter?</span><button data-act="flee">Leave</button><button data-act="stay">Stay</button></div>' : '')+
      '<div class="cb-layout"><div class="cb-main"><div class="cb-turnline"><span>Round <b>'+battle.round+'</b></span><span>'+icon("initiative")+'Turn order</span><div class="cb-order">'+orders+'</div></div>'+
      (battle.course ? '<p class="cb-venue-tactic">'+icon("warden")+escape(battle.course.tactic)+'</p>' : '')+quarryStrip()+
      '<div class="cb-arena'+(battle.course ? ' cb-built-arena' : quarry ? ' cb-hunt-arena' : '')+'" data-region="'+battle.region+'" data-art-region="'+artRegion+'" style="'+
      (quarry ? '--hunt-panel:'+battle.lair.panel*25+'%;' : '')+'--arena-filter:'+(area.artFilter ?? 'none')+';--venue:url(./assets/frontier-arena-'+artRegion+'.webp);--atlas-x:'+(artRegion%2*100)+'%;--atlas-y:'+(Math.floor(artRegion/2)*100/3)+'%">'+
      '<div class="cb-board" role="group" aria-label="Tactical hex grid">'+cells+huntArrival()+'</div>'+outcomeBody+'</div>'+
      '<div class="cb-news"><p class="cb-latest" role="status">'+icon(battle.logIcons?.at(-1) || "flank")+escape(battle.log.at(-1) || "Two allies beside one opponent deal 20% more melee damage.")+'</p>'+
      '<button type="button" data-act="skipfx" hidden>'+icon("skip")+'Skip animation</button></div>'+keyMarkup()+'</div>'+
      '<aside class="cb-panel"><div class="cb-panel-title"><small>'+(end ? "ENCOUNTER COMPLETE" : isPlayer() ? "YOUR TURN" : "WILD TURN")+'</small><strong>'+escape(end ? resultName[end.result] : nameOf(actor))+'</strong></div>'+
      '<div class="cb-commands">'+commands(actor,interactive)+'</div><p class="cb-hint" aria-live="polite">'+escape(end ? "Encounter complete." : hint)+'</p>'+
      inspectPanel(inspectedKey ?? actor.key)+'<details class="cb-log"'+(logOpen ? ' open' : '')+'><summary>Battle log</summary><ol>'+logLines+'</ol></details></aside></div></section>';
    opening = false;
    restoreFocus(focus);
  }
  function lockControls() {
    root.querySelector(".cb-shell").setAttribute("aria-busy","true");
    for (const button of root.querySelectorAll(".cb-command, [data-act=retreat], [data-act=pace]")) button.disabled = true;
    root.querySelector('[data-act="skipfx"]').hidden = false;
    root.querySelector(".cb-hint").textContent = "Action in progress.";
  }
  async function playChanges() {
    saveResult();
    const events = takeBattleEvents(battle);
    if (!events.length || disposed) return;
    const controller = new AbortController();
    playback = controller;
    lockControls();
    try {
      const stopped = new Promise(resolve => controller.signal.addEventListener("abort",resolve,{once:true}));
      await Promise.race([playFightEffects(root.querySelector(".cb-board"),events,{
        battle,sprite,signal:controller.signal,region:battle.region,speed:playbackSpeed,onEvent:event => sound.play(event)
      }),stopped]);
    } catch (error) {
      if (!controller.signal.aborted) console.warn("Battle animation interrupted", error);
    } finally {
      controller.abort();
      if (playback === controller) playback = null;
    }
  }
  function newTurn() {
    mode = "move"; inspectedKey = null; note = ""; focusKey = activeUnit(battle).key;
  }
  async function endAction() {
    await playChanges();
    if (disposed) return;
    newTurn(); draw(); scheduleEnemy();
  }
  function scheduleEnemy(delay = 330) {
    clearTimeout(timer);
    if (disposed || battle.result || isPlayer() || retreat || playback) return;
    timer = setTimeout(async () => {
      if (disposed || retreat || playback) return;
      const plan = planEnemyTurn(battle);
      if (moveUnit(battle,plan.key)) {
        await playChanges();
        if (disposed) return;
        inspectedKey = plan.key; draw();
      }
      if (plan.i === null || !useAbility(battle,plan.i,plan.target)) guard(battle);
      void endAction();
    }, delay / playbackSpeed);
  }
  function finish() {
    if (disposed || !resolution || playback) return;
    cleanup(); onFinish(resolution);
  }
  async function chooseCell(key) {
    const u = unitAt(battle,key);
    inspectedKey = key; focusKey = key;
    if (!isPlayer() || retreat) { draw(); return; }
    if (mode === "move") {
      if (moveUnit(battle,key)) {
        await playChanges();
        if (disposed) return;
        const actor = activeUnit(battle);
        mode = actor.abilities.findIndex(a => a.kind === "attack");
        note = "Choose an action. Numbers on marked opponents show damage.";
      } else {
        note = u?.team === "wild" ? "Choose an ability or Capture to target "+nameOf(u)+"." : terrainInfo(battle,battle.tiles[key]).join(". ");
      }
    } else if (mode === "capture") {
      if (attemptCapture(battle,u)) { void endAction(); return; }
      note = "Choose a wild Critter within three hexes.";
    } else if (mode?.id) {
      const item = getSupplies().find(item => item.id === mode.id);
      if (useBattleSupply(battle,item,u,spendSupply)) { void endAction(); return; }
      if (!item) {
        mode = "move";
        note = "This supply is no longer in your bag.";
      } else {
        note = item.kind === "support" ? actorHint(item) :
          "Choose " + (item.kind === "heal" ? "a wounded ally" : "a wild Critter") + " within three hexes.";
      }
    } else if (typeof mode === "number") {
      if (useAbility(battle,mode,u)) { void endAction(); return; }
      note = actorHint(activeUnit(battle).abilities[mode]);
    }
    draw();
  }
  function actorHint(skill) {
    return "Choose "+targetPrompt(skill)+(skill.range ? " within "+hexes(skill.range) : "")+".";
  }
  function hover(event) {
    const cell = event.target.closest?.("[data-cell]");
    if (!cell || disposed || playback || retreat || battle.result) return;
    const key = Number(cell.dataset.cell);
    if (event.type === "focusin") {
      focusKey = key;
      for (const button of root.querySelectorAll("[data-cell]")) button.tabIndex = button === cell ? 0 : -1;
    }
    if (inspectedKey === key) return;
    inspectedKey = key;
    for (const tile of root.querySelectorAll(".cb-path")) tile.classList.remove("cb-path");
    if (isPlayer() && mode === "move") {
      for (const step of previewAction(battle, mode, key)?.path.slice(1) || []) {
        root.querySelector('[data-cell="'+step+'"]')?.classList.add("cb-path");
      }
    }
    const panel = root.querySelector(".cb-inspect");
    if (panel) panel.outerHTML = inspectPanel(key);
    const zone = auraZone(key, activeUnit(battle));
    for (const tile of root.querySelectorAll("[data-cell]")) {
      const id = zoneAttribute(zone, Number(tile.dataset.cell));
      if (id) tile.dataset.auraZone = id;
      else delete tile.dataset.auraZone;
    }
    root.querySelector(".cb-selected")?.classList.remove("cb-selected");
    cell.classList.add("cb-selected");
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button || !root.contains(button) || button.disabled || disposed) return;
    const act = button.dataset.act;
    if (act === "skipfx") { playback?.abort(); return; }
    if (act === "sound") {
      void sound.toggle().then(() => {
        const current = root.querySelector('[data-act="sound"]');
        if (disposed || !current) return;
        current.setAttribute("aria-pressed",String(sound.enabled));
        current.title = sound.enabled ? "Mute effects" : "Enable sound effects";
        current.innerHTML = icon(sound.enabled ? "sound-on" : "sound-off")+'<span>'+(sound.enabled ? "Sound on" : "Sound off")+'</span>';
      });
      return;
    }
    if (playback) return;
    if (act === "return") { finish(); return; }
    if (act === "pace") { playbackSpeed = playbackSpeed === 1 ? 2 : 1; draw(); return; }
    if (battle.result) return;
    if (act === "retreat" || act === "stay") {
      retreat = act === "retreat"; clearTimeout(timer); draw(); if (!retreat) scheduleEnemy(); return;
    }
    if (act === "flee" && retreat) { retreat = false; retreatBattle(battle); void endAction(); return; }
    if (button.dataset.cell !== undefined) { void chooseCell(Number(button.dataset.cell)); return; }
    if (!isPlayer() || retreat) return;
    if (act === "guard" || act === "wait") {
      if (act === "guard" ? guard(battle) : waitTurn(battle)) void endAction();
      return;
    }
    if (act === "move" || act === "capture") mode = act;
    else if (act?.startsWith("skill-")) mode = Number(act.slice(6));
    else if (act?.startsWith("supply-")) {
      const item = getSupplies().find(item => item.id === act.slice(7));
      if (!item) { draw(); return; }
      mode = item;
      packOpen = true;
    }
    else return;
    note = "";
    if (mode !== "move") {
      const actor = activeUnit(battle);
      if (!battle.units.some(u => living(u) && previewAction(battle,mode,u.key))) {
        const ability = typeof mode === "number" ? actor.abilities[mode] : mode;
        if (ability?.kind === "heal") note = "No wounded allies in reach.";
        else if (ability?.kind === "support") note = "No allies in reach can benefit from " + ability.name + ".";
        else note = actor.moved ? "No target in reach. Guard to end the turn." : "No target in reach. Move closer first.";
      }
    }
    draw();
  }
  function onToggle(event) {
    if (event.target.matches?.(".cb-log")) logOpen = event.target.open;
    if (event.target.matches?.(".cb-key")) keyOpen = event.target.open;
    if (event.target.matches?.(".cb-pack")) packOpen = event.target.open;
  }
  function keys(event) {
    if (document.querySelector("dialog[open]") || disposed || playback) return;
    const cell = event.target.closest("[data-cell]");
    if (!cell) return;
    const {x,y} = xy(Number(cell.dataset.cell));
    const offsets = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const d = offsets[event.key];
    if (!d) return;
    event.preventDefault();
    const next = keyOf(Math.max(0,Math.min(COLS-1,x+d[0])),Math.max(0,Math.min(ROWS-1,y+d[1])));
    root.querySelector('[data-cell="'+next+'"]')?.focus({preventScroll:true});
  }
  function cleanup() {
    disposed = true;
    clearTimeout(timer); playback?.abort(); sound.dispose();
    root.removeEventListener("click",click); root.removeEventListener("keydown",keys);
    root.removeEventListener("pointerover",hover); root.removeEventListener("focusin",hover);
    root.removeEventListener("toggle",onToggle,true);
  }
  root.addEventListener("click",click); root.addEventListener("keydown",keys);
  root.addEventListener("pointerover",hover); root.addEventListener("focusin",hover);
  root.addEventListener("toggle",onToggle,true);
  draw();
  scheduleEnemy(animateArrival ? 1150 : 330);
  return cleanup;
}
