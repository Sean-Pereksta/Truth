import {
  SPECIES, MAX_LEVEL, getForm, getStats, getAbilities, xpToNext, captureChance, rollEncounter
} from "./catalog.js";

import { playFightEffects, warmFightEffects } from "./fight-effects.js";
import { createFightSound } from "./fight-sound.js";
import { FIGHT_ICONS, fightIcon, abilityIconKey, hazardIconKey } from "./fight-icons.js";

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
  { cover: "Star mist", hazard: "Starfall", effect: "burn", pattern: ["...c...", "..h.#..", ".c.h.c.", "..#.h..", "...c..."] }
];
const GROUND = { c: "cover", h: "hazard", "#": "rock" };
const STATUS = { slow: "Slowed", exposed: "Exposed", stun: "Stunned" };
const STATUS_TIP = { slow: "Moves one fewer hex next turn.", exposed: "Takes 25% more damage until its next turn ends.", stun: "Misses its next turn." };
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

export function reachable(battle, unit = activeUnit(battle), parents) {
  const visited = new Map([[unit.key, 0]]);
  const queue = [unit.key];
  const limit = Math.max(1, unit.stats.move - (unit.status.slow ? 1 : 0));
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
    stats, hp: stats.maxHp, abilities: getAbilities(member), status: {},
    guarded: false, moved: false, caught: false, waitRound: 0, recovery: { heal: 0, stun: 0 }
  };
}

export function createBattle(encounter, party, opponents, rng = Math.random) {
  const region = Math.max(0, Math.min(BIOMES.length-1, Number(encounter.region) || 0));
  const biome = BIOMES[region];
  const mirror = [...String(encounter.node ?? "")].reduce((n, c) => n + c.charCodeAt(0), 0) % 2;
  const tiles = biome.pattern.flatMap(row => (mirror ? [...row].reverse() : [...row]).map(t => GROUND[t] || "plain"));
  const units = [...party.map((m,i) => buildUnit(m,"you",i,i)), ...opponents.map((m,i) => buildUnit(m,"wild",i,party.length+i))];
  units.forEach(u => { tiles[u.key] = "plain"; });
  const battle = { encounter, region, biome, tiles, units, rng, order: [], round: 0, cursor: -1,
    result: null, log: [], logIcons: [], events: [] };
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

function finishTile(battle, unit) {
  for (const status of Object.keys(unit.status)) {
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

function finishTurn(battle, actor) {
  if (!checkOutcome(battle)) finishTile(battle, actor);
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
  return captureChance(unit.member, unit.hp / unit.stats.maxHp, Object.values(unit.status).some(Boolean));
}

function flank(battle, actor, target, from) {
  return hexDistance(from, target.key) === 1 && battle.units.some(other =>
    other !== actor && other.team === actor.team && living(other) && hexDistance(other.key, target.key) === 1
  );
}

function damageFor(battle, actor, target, skill, from, modifiers) {
  const distance = hexDistance(from, target.key);
  let amount = Math.max(3, actor.stats.attack * skill.power - target.stats.defense * 0.42);
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
  return skill.status === "stun" ? "stun" : null;
}
function recovering(actor, skill) {
  return actor.recovery[recoveryGroup(skill)] > 0;
}
function validTarget(actor, target, skill, from = actor.key) {
  if (recovering(actor, skill)) return false;
  if (!target || !living(target) || hexDistance(from, target.key) > skill.range) return false;
  if (skill.kind === "guard") return target === actor;
  return skill.kind === "heal" ? target.team === actor.team && target.hp < target.stats.maxHp : target.team !== actor.team;
}

function skillPreview(battle, actor, target, skill) {
  if (!skill || !validTarget(actor, target, skill)) return null;
  const move = { skillId: skill.id, skillName: skill.name };
  if (skill.kind === "guard") return { type: "guard", ...move };
  if (skill.kind === "heal") {
    const amount = Math.min(healingFor(actor, skill), target.stats.maxHp - target.hp);
    return { type: "heal", ...move, amount, hpAfter: target.hp + amount };
  }
  const modifiers = [];
  const amount = damageFor(battle, actor, target, skill, actor.key, modifiers);
  const hpAfter = Math.max(0, target.hp - amount);
  return { type: "attack", ...move, style: skill.range > 1 ? "ranged" : "melee",
    amount, hpAfter, modifiers, effect: hpAfter ? skill.status : null };
}

function capturePreview(actor, target) {
  if (actor.team !== "you" || !target || target.team !== "wild" || !living(target) ||
      hexDistance(actor.key, target.key) > CAPTURE_RANGE) return null;
  return { type: "capture", chance: captureOdds(target) };
}

export function previewAction(battle, mode, key) {
  if (battle.result || !Number.isInteger(key) || key < 0 || key >= battle.tiles.length) return null;
  const actor = activeUnit(battle);
  if (mode === "move") {
    const path = movementPath(battle, actor, key);
    return path ? { type: "move", path, hazard: hazardAt(battle, actor, key) } : null;
  }
  const target = unitAt(battle, key);
  if (mode === "guard") return actor === target ? { type: "guard" } : null;
  if (mode === "capture") return capturePreview(actor, target);
  return Number.isInteger(mode) ? skillPreview(battle, actor, target, actor.abilities[mode]) : null;
}

export function useAbility(battle, index, target) {
  if (battle.result) return false;
  const actor = activeUnit(battle);
  const skill = actor.abilities[index];
  const preview = skillPreview(battle, actor, target, skill);
  if (!preview) return false;
  if (skill.kind === "guard") return guard(battle);
  const recovery = recoveryGroup(skill);
  record(battle, preview.type, actor, target, preview);
  if (skill.kind === "heal") {
    target.hp = preview.hpAfter;
    log(battle, nameOf(actor) + " used " + skill.name + " and restored " + preview.amount + " HP to " + nameOf(target) + ".", "heal");
  } else {
    const bonus = preview.modifiers.length ? " (" + preview.modifiers.join(", ") + ")" : "";
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
  finishTurn(battle, actor);
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
  target.caught = battle.rng() < preview.chance;
  record(battle, "capture", actor, target, { chance: preview.chance, success: target.caught });
  log(battle, target.caught ? nameOf(target) + " joined your force!" : nameOf(target) + " escaped the capture (" + percent(preview.chance) + "% chance).",
    target.caught ? "caught" : "escaped");
  finishTurn(battle, actor);
  return true;
}

function enemyPlan(battle) {
  const actor = activeUnit(battle), options = reachable(battle, actor);
  const friends = battle.units.filter(u => u.team !== actor.team && living(u));
  const reach = Math.max(1, ...actor.abilities.filter(s => s.kind === "attack").map(s => s.range));
  let best = { score: -Infinity };
  for (const [key, steps] of options) {
    const distance = Math.min(...friends.map(e => hexDistance(key, e.key)));
    const tile = battle.tiles[key];
    const ground = (tile === "cover" ? 1.6 : tile === "hazard" ? -6 : 0);
    // Ranged species seek firing distance. A tiny movement cost keeps equivalent choices stable.
    const position = ground - Math.abs(distance-reach)*1.7 - steps*0.06;
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
        } else {
          const dmg = damageFor(battle,actor,target,skill,key);
          const finisher = target.hp <= dmg ? 14 : 0;
          const status = skill.status && !target.status[skill.status] ? (skill.status === "stun" ? 7 : 3) : 0;
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
const turns = count => count + (count === 1 ? " turn" : " turns");
const hexes = count => count + (count === 1 ? " hex" : " hexes");

export function mountBattle(root, { encounter, party, sprite, onFinish, onResolved }) {
  const opponents = rollEncounter(encounter.region, {
    level: encounter.level, leadSpeciesId: encounter.leadSpeciesId,
    legendary: encounter.kind === "legendary", challenge: encounter.kind === "warden"
  });
  const battle = createBattle(encounter, party, opponents);
  const regionHazard = hazardIconKey(battle.region);
  warmFightEffects(battle.units);
  const sound = createFightSound();
  const face = unit => sprite(unit.member.speciesId, getForm(unit.member).stage);
  const isPlayer = () => !battle.result && activeUnit(battle).team === "you";
  let mode = "move", inspectedKey = null, note = "", focusKey = activeUnit(battle).key;
  let logOpen = false, keyOpen = false, retreat = false, disposed = false, timer = 0;
  let playback = null, resolution = null;
  function saveResult() {
    if (battle.result && !resolution) {
      resolution = outcome(battle);
      onResolved?.(resolution);
    }
  }
  function terrainIcon(tile) { return tile === "hazard" ? regionHazard : tile; }
  function activeEffects(unit, compact = false) {
    const effects = effectsOn(unit).map(effect => ({
      key: effect, label: STATUS[effect] + " · " + turns(unit.status[effect]), tip: STATUS_TIP[effect]
    }));
    if (unit.guarded) effects.push({key:"guard", label:"Guarding", tip:"Reduces damage until this Critter’s next turn."});
    if (!effects.length) return "";
    return '<span class="'+(compact ? "cb-pips" : "cb-effects")+'">'+effects.map(e =>
      '<span class="cb-effect" title="'+escape(e.label + ". " + e.tip)+'">'+icon(e.key)+(compact ? "" : escape(e.label))+'</span>'
    ).join("")+'</span>';
  }
  function forecastText(prediction) {
    if (!prediction) return "";
    if (prediction.type === "capture") return percent(prediction.chance) + "% capture";
    if (prediction.type === "heal") return "+" + prediction.amount + " HP";
    if (prediction.type === "attack") return "−" + prediction.amount + " HP";
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
        for (const modifier of prediction.modifiers || []) extras.push(icon(modifier) + escape(FIGHT_ICONS[modifier].label));
        if (prediction.effect) extras.push(icon(prediction.effect) + escape(STATUS[prediction.effect] || prediction.effect));
      } else if (prediction.type === "capture") {
        extras.push(percent(captureChance(u.member, 1, false)) + "% at full HP");
        if (u.hp < u.stats.maxHp) extras.push(icon("damage") + "Weakened");
        if (effectsOn(u).length) extras.push(icon("status") + "Status bonus");
      } else if (prediction.type === "move" && prediction.hazard) {
        extras.push(icon(regionHazard) + escape(prediction.hazard.name));
        if (prediction.hazard.amount) extras.push("−" + prediction.hazard.amount + " HP at turn end");
        else extras.push(escape(tip));
      }
      forecast = '<div class="cb-forecast">'+icon("forecast")+'<div><b>'+escape(forecastText(prediction))+'</b>'+
        (extras.length ? '<small>'+extras.join(' · ')+'</small>' : '')+'</div></div>';
    }
    const terrainLine = '<div class="cb-ground-tip">'+icon(terrainIcon(tile))+'<div><b>'+escape(terrain)+'</b>'+
      (tile === "plain" && u ? "" : '<small>'+escape(tip)+'</small>')+'</div></div>';
    if (!u) return '<div class="cb-inspect">'+terrainLine+forecast+'</div>';
    const species = SPECIES[u.member.speciesId], isWild = u.team === "wild";
    return '<div class="cb-inspect"><div class="cb-ident"><span class="cb-portrait">'+face(u)+'</span><div><small>'+
      (isWild ? "WILD" : "ALLY")+' · LV '+u.member.level+'</small><strong>'+escape(nameOf(u))+'</strong><span>'+
      icon(species.role === "ranged" ? "archer" : species.role)+escape(ROLE_NAME[species.role])+'</span></div></div>'+
      '<div class="cb-stat"><span>'+icon("hp")+'Health</span><b>'+u.hp+' / '+u.stats.maxHp+'</b></div>'+
      '<div class="cb-meter"><i style="width:'+100*u.hp/u.stats.maxHp+'%"></i></div>'+
      (isWild ? '<div class="cb-stat cb-odds"><span>'+icon("capture")+'Capture</span><b>'+percent(captureOdds(u))+'%</b></div>' :
        '<div class="cb-stat"><span>'+icon("xp")+'XP</span><b>'+(u.member.level >= MAX_LEVEL ? "MAX" : u.member.xp+' / '+xpToNext(u.member.level))+'</b></div>')+
      activeEffects(u)+(tile !== "plain" ? terrainLine : "")+forecast+'</div>';
  }
  function cellMarkup(key, actor) {
    const tile = battle.tiles[key], u = unitAt(battle,key), {x,y} = xy(key);
    const [terrain, terrainTip] = terrainInfo(battle,tile);
    const forecast = isPlayer() && !retreat ? previewAction(battle, mode, key) : null;
    const moving = forecast?.type === "move", targeting = forecast && !moving;
    const active = !battle.result && u === actor;
    const hint = (forecast ? forecastText(forecast) + ". " : "") + terrainTip;
    const cellName = String.fromCharCode(65+x)+(y+1);
    const parts = ["cb-cell","cb-"+tile];
    if (u) parts.push("cb-occupied","cb-"+u.team);
    if (active) parts.push("cb-active");
    if (moving) parts.push("cb-reach");
    if (targeting) parts.push("cb-target","cb-target-"+forecast.type);
    if (inspectedKey === key) parts.push("cb-selected");
    const occupant = u ? [nameOf(u), u.team === "you" ? "Ally" : "Wild", u.hp+"/"+u.stats.maxHp+" HP",
      ...effectsOn(u).map(effect => STATUS[effect]+" "+turns(u.status[effect])), ...(u.guarded ? ["Guarding"] : [])].join(" · ")+". " : "";
    const title = cellName+". "+occupant+terrain+". "+hint;
    const ground = tile === "plain" ? "" : '<span class="cb-terrain-art" aria-hidden="true"></span><span class="cb-terrain-mark">'+icon(terrainIcon(tile))+'</span>';
    let content = '<span class="cb-floor"></span>'+ground+(moving ? '<span class="cb-step"></span>' : '');
    if (u) {
      content += '<span class="cb-creature" aria-hidden="true">'+face(u)+'</span>'+
        '<i class="cb-hp"><b style="width:'+Math.ceil(100*u.hp/u.stats.maxHp)+'%"></b></i>'+activeEffects(u,true);
      if (active) content += '<span class="cb-cursor">'+icon("turn")+'</span>';
      if (targeting) {
        const amount = forecast.type === "capture" ? percent(forecast.chance)+"%" : (forecast.type === "heal" ? "+" : "−")+forecast.amount;
        content += '<b class="cb-amount cb-amount-'+forecast.type+'">'+amount+'</b>';
      }
    }
    return '<button type="button" data-cell="'+key+'" '+(u ? 'data-unit-id="'+u.id+'" ' : '')+'class="'+parts.join(" ")+'" tabindex="'+
      (key === focusKey ? 0 : -1)+'" style="--x:'+((x+(y%2)*.5)/7.5*100)+'%;--y:'+(y*18.75)+'%" title="'+escape(title)+'" aria-label="'+escape(title)+'">'+content+'</button>';
  }
  function command(action, glyph, label, caption, selected, disabled, tip, effect = null) {
    const pressed = ["guard", "wait"].includes(action) ? "" : ' aria-pressed="'+Boolean(selected)+'"';
    return '<button type="button" data-act="'+action+'" class="cb-command'+(selected ? ' chosen' : '')+'"'+pressed+
      (disabled ? ' disabled' : '')+(tip ? ' title="'+escape(tip)+'"' : '')+'><span class="cb-command-art">'+icon(glyph)+'</span>'+
      '<span class="cb-command-text"><b>'+escape(label)+'</b><small>'+escape(caption)+(effect ? ' '+icon(effect) : '')+'</small></span></button>';
  }
  function commands(actor, interactive) {
    if (!actor || battle.result) return "";
    const skills = actor.abilities.flatMap((a,i) => {
      if (a.kind === "guard") return [];
      const resting = recovering(actor,a);
      return command('skill-'+i,resting ? "cooldown" : abilityIconKey(a,SPECIES[actor.member.speciesId]),a.name,
        resting ? "Rest · 1 turn" : hexes(a.range),mode === i,!interactive || resting,a.description,a.status);
    });
    return [
      command("move","move","Move",actor.moved ? "Already moved" : hexes(Math.max(1,actor.stats.move-(actor.status.slow ? 1 : 0))),
        mode === "move",!interactive || actor.moved,"Move along a lit path before acting."),
      ...skills,
      command("capture","capture","Capture","3 hexes",mode === "capture",!interactive,"Select a marked wild Critter to attempt capture."),
      command("guard","guard",actor.abilities.find(a => a.kind === "guard")?.name || "Guard","End turn",false,!interactive,"Reduce incoming damage until your next turn."),
      command("wait","wait","Wait","Act later",false,!interactive || !canWait(battle),"Before moving, act after the remaining Critters this round. Once per round.")
    ].join("");
  }
  function legendList(keys) {
    return [...new Set(keys)].filter(key => FIGHT_ICONS[key]).map(key => '<div>'+icon(key)+'<div><b>'+
      escape(FIGHT_ICONS[key].label)+'</b><small>'+escape(FIGHT_ICONS[key].description)+'</small></div></div>').join("");
  }
  const arenaKeys = battle.units.flatMap(u => u.abilities.map(a => abilityIconKey(a, SPECIES[u.member.speciesId])));
  const glossary = legendList(["move","wait","melee","ranged","heal","guard","capture","caught","escaped","faint","flank","cover","rock",regionHazard,
    battle.biome.effect,"slow","stun","exposed","clear","cooldown","skip",...arenaKeys]);
  function keyMarkup() {
    return '<details class="cb-key"'+(keyOpen ? ' open' : '')+'><summary><b>Effect key</b><span>'+
      icon("cover")+'Cover</span><span>'+icon(regionHazard)+escape(battle.biome.hazard)+'</span><span>'+icon("rock")+'Blocked</span></summary><div class="cb-glossary">'+glossary+'</div></details>';
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
  function draw() {
    if (disposed) return;
    const focus = root.contains(document.activeElement) ? document.activeElement.dataset : {};
    const actor = activeUnit(battle), interactive = isPlayer() && !retreat;
    const selectedSkill = typeof mode === "number" && actor ? actor.abilities[mode] : null;
    const cells = battle.tiles.map((_,key) => cellMarkup(key,actor)).join("");
    const turnOrder = battle.order.slice(battle.cursor).map(id => battle.units[id]).filter(living);
    let hint = "Move on a lit hex, then choose an action.";
    if (mode === "capture") hint = "Tap a marked Critter to attempt capture at the displayed chance.";
    if (selectedSkill) hint = selectedSkill.description + " Tap a marked "+(selectedSkill.kind === "heal" ? "ally." : "opponent.");
    if (!interactive) hint = retreat ? "Confirm or cancel retreat." : "The wild tribe is taking its turn.";
    if (note) hint = note;
    const end = resolution;
    const resultName = {won:"Victory", lost:"Party exhausted", fled:"Retreated"};
    const outcomeGlyph = {won:"victory", lost:"defeat", fled:"retreat"};
    const outcomeBody = end ? '<section class="cb-outcome" aria-live="polite"><div><span class="cb-outcome-seal">'+icon(outcomeGlyph[end.result])+'</span><h3>'+resultName[end.result]+'</h3>'+
      (end.xp ? '<p>'+icon("xp")+'+'+end.xp+' XP for each party member.</p>' : '')+
      (end.captured.length ? '<p>'+icon("caught")+'Captured '+end.captured.map(m => escape(getForm(m).name)).join(", ")+'.</p>' : '')+
      (!end.xp && !end.captured.length ? '<p>Your party regroups on the trail.</p>' : '')+
      '<button type="button" data-act="return">Return to trail</button></div></section>' : "";
    const orders = turnOrder.map((u,index) => {
      const title = (index === 0 ? "Acting now" : "Upcoming") + " · " + nameOf(u) + (u.team === "you" ? " · Ally" : " · Wild");
      return '<span class="cb-order-token cb-order-'+u.team+'" title="'+escape(title)+'" aria-label="'+escape(title)+'" role="img"><span aria-hidden="true">'+face(u)+'</span></span>';
    }).join("");
    const logLines = battle.log.slice(-12).reverse().map((line,i) => '<li>'+icon(battle.logIcons?.[battle.log.length-1-i] || "turn")+'<span>'+escape(line)+'</span></li>').join("");
    root.innerHTML = '<section class="cb-shell" aria-busy="false" aria-label="Tactical encounter"><header class="cb-heading"><div><small>'+
      icon(encounter.kind || "tribe")+({tribe:"WILD TRIBE",warden:"WARDEN ARENA",legendary:"LEGENDARY ENCOUNTER"}[encounter.kind] || "ENCOUNTER")+
      '</small><h2>'+escape(encounter.name || "Wild tribe")+'</h2></div><div class="cb-toolbar">'+soundControl()+
      '<button type="button" data-act="pace" aria-label="Animation speed '+playbackSpeed+' times" title="Change animation speed">'+icon("speed")+playbackSpeed+'×</button>'+
      '<button type="button" data-act="retreat" '+(end ? 'disabled' : '')+'>'+icon("retreat")+'Retreat</button></div></header>'+
      (retreat && !end ? '<div class="cb-retreat" role="group" aria-label="Confirm retreat"><span>Leave this encounter?</span><button data-act="flee">Leave</button><button data-act="stay">Stay</button></div>' : '')+
      '<div class="cb-layout"><div class="cb-main"><div class="cb-turnline"><span>Round <b>'+battle.round+'</b></span><span>'+icon("initiative")+'Turn order</span><div class="cb-order">'+orders+'</div></div>'+
      '<div class="cb-arena" data-region="'+battle.region+'" style="--atlas-x:'+(battle.region%2*100)+'%;--atlas-y:'+(Math.floor(battle.region/2)*100/3)+'%">'+
      '<div class="cb-board" role="group" aria-label="Tactical hex grid">'+cells+'</div>'+outcomeBody+'</div>'+
      '<div class="cb-news"><p class="cb-latest" role="status">'+icon(battle.logIcons?.at(-1) || "flank")+escape(battle.log.at(-1) || "Two allies beside one opponent deal 20% more melee damage.")+'</p>'+
      '<button type="button" data-act="skipfx" hidden>'+icon("skip")+'Skip animation</button></div>'+keyMarkup()+'</div>'+
      '<aside class="cb-panel"><div class="cb-panel-title"><small>'+(end ? "ENCOUNTER COMPLETE" : isPlayer() ? "YOUR TURN" : "WILD TURN")+'</small><strong>'+escape(end ? resultName[end.result] : nameOf(actor))+'</strong></div>'+
      '<div class="cb-commands">'+commands(actor,interactive)+'</div><p class="cb-hint" aria-live="polite">'+escape(end ? "Encounter complete." : hint)+'</p>'+
      inspectPanel(inspectedKey ?? actor.key)+'<details class="cb-log"'+(logOpen ? ' open' : '')+'><summary>Battle log</summary><ol>'+logLines+'</ol></details></aside></div></section>';
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
  function scheduleEnemy() {
    clearTimeout(timer);
    if (disposed || battle.result || isPlayer() || retreat || playback) return;
    timer = setTimeout(async () => {
      if (disposed || retreat || playback) return;
      const plan = enemyPlan(battle);
      if (moveUnit(battle,plan.key)) {
        await playChanges();
        if (disposed) return;
        inspectedKey = plan.key; draw();
      }
      if (plan.i === null || !useAbility(battle,plan.i,plan.target)) guard(battle);
      void endAction();
    }, 330 / playbackSpeed);
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
    } else if (typeof mode === "number") {
      if (useAbility(battle,mode,u)) { void endAction(); return; }
      note = actorHint(activeUnit(battle).abilities[mode]);
    }
    draw();
  }
  function actorHint(skill) {
    return "Choose "+(skill.kind === "heal" ? "a wounded ally" : "an opponent")+" within "+hexes(skill.range)+".";
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
    else return;
    note = "";
    if (mode !== "move") {
      const actor = activeUnit(battle);
      if (!battle.units.some(u => living(u) && previewAction(battle,mode,u.key))) note = typeof mode === "number" && actor.abilities[mode].kind === "heal" ?
        "No wounded allies in reach." : actor.moved ? "No target in reach. Guard to end the turn." : "No target in reach. Move closer first.";
    }
    draw();
  }
  function onToggle(event) {
    if (event.target.matches?.(".cb-log")) logOpen = event.target.open;
    if (event.target.matches?.(".cb-key")) keyOpen = event.target.open;
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
  draw(); scheduleEnemy();
  return cleanup;
}
