import {
  HOUSES, PLANETS, REGIONS, BUILDINGS, SHIPS, COLORS, OPERATIONS, DOCTRINES,
  STARTING_ARMIES, STARTING_RESOURCES, RESOURCE_KEYS, RESOURCE_LABELS, SKIRMISHES, WORLD_ECONOMIES, PLANET_GROUPS,
} from "./content.mjs";
import { UNIT_TYPES, createSquad, createBattle, tickBattle, issueOrder, addReinforcements } from "./battle.mjs";
import { fleetPower, transport, sail, fleetOrder, blockade, tickFleets } from "./fleets.mjs";

export { fleetPower };

const STEP = 0.1;
const SAVE_VERSION = 2;
const SAVE_SLOTS = ["auto", 1, 2, 3];
const CONTROL_INTERVAL = 30;
const CONTROL_TICKS = CONTROL_INTERVAL / STEP;
const ARMY_SQUAD_LIMIT = 16;
const HOUSE_IDS = Object.keys(HOUSES);
const CAMPAIGN_DEFAULTS = { credits: 480, materials: 325, supplies: 235, influence: 150 };
const ADVANCED_UNITS = new Set(["raider", "obsidian", "razor", "commander", "engineer", "electronic", "medic", "transport", "tank"]);
const ok = (message) => ({ ok: true, message });
const fail = (message) => ({ ok: false, message });
const nextId = (state, prefix) => `${prefix}-${++state.serial}`;
const population = (army) => army.squads.reduce((sum, squad) => sum + squad.soldiers, 0);
const regionAt = (state, regionId) => state.planets[REGIONS[regionId]?.planetId]?.regions[regionId];
const contact = (state, a, b) => state.relations[[a, b].sort().join(":")];
const hostile = (state, a, b) => Boolean(a && b && a !== b && contact(state, a, b)?.stance === "war");
const friendly = (state, a, b) => a === b || ["alliance", "vassal"].includes(contact(state, a, b)?.stance);
const hasAccess = (state, a, b) => !b || friendly(state, a, b) || contact(state, a, b)?.access;

function notify(state, message) {
  if (state.alerts[0]?.message === message) return;
  state.alerts.unshift({ time: state.elapsed, message });
  if (state.alerts.length > 24) state.alerts.pop();
}

function newArmy(state, template) {
  const def = HOUSES[template.houseId];
  const id = template.id ?? nextId(state, "army");
  const army = {
    id, name: template.name ?? `${def.name} Cohort`, houseId: def.id,
    planetId: REGIONS[template.regionId]?.planetId ?? null, regionId: template.regionId ?? null,
    commander: { ...def.commander, ...template.commander }, doctrine: template.doctrine ?? def.doctrine,
    squads: template.squads.map((type) => typeof type === "string" ? createSquad(type, nextId(state, "squad")) : type),
    orders: [], transit: null, battleId: null, fleetId: null, destroyed: false,
    previousRegionId: null, localSupply: 1, railBlockUntil: 0, peakStrength: 0,
  };
  army.peakStrength = population(army);
  state.armies[army.id] = army;
  return army;
}

function newFleet(state, houseId, regionId, ships) {
  const fleet = {
    id: nextId(state, "fleet"), name: `${HOUSES[houseId].name} Flotilla`, houseId, regionId,
    planetId: REGIONS[regionId].planetId, ships: { ...ships }, armyId: null,
    engagement: null, transit: null, landing: null, blockading: false,
  };
  state.fleets[fleet.id] = fleet;
  return fleet;
}

function addWorlds(state) {
  const added = new Set();
  for (const definition of Object.values(PLANETS)) {
    const { id, regionIds } = definition;
    if (!regionIds.length || state.planets[id] || (state.mode === "planetary" && id !== state.planetId)) continue;
    const regions = Object.fromEntries(regionIds.map((regionId) => {
      const region = REGIONS[regionId];
      return [regionId, { id: regionId, owner: region.houseId ?? null, buildings: { ...region.buildings }, operations: {}, rally: null }];
    }));
    state.planets[id] = { id, regions };
    added.add(id);
  }
  for (const template of Object.values(STARTING_ARMIES)) {
    if (added.has(REGIONS[template.regionId].planetId) && !state.armies[template.id]) newArmy(state, template);
  }
  return added;
}

function giveStartingFleets(state, worlds) {
  for (const houseId of HOUSE_IDS) {
    const fleets = Object.values(state.fleets).filter((fleet) => fleet.houseId === houseId);
    const ports = Object.values(state.armies).filter((army) => army.houseId === houseId
      && worlds.has(army.planetId) && regionAt(state, army.regionId)?.buildings.spaceport);
    const luna = ports.find((army) => army.planetId === "luna");
    if (luna && !fleets.some((fleet) => fleet.planetId === "luna")) {
      newFleet(state, houseId, luna.regionId, { transport: 2, corvette: 1, assault: 1 });
    }
    const expedition = ports.find((army) => army.planetId !== "luna"
      && !["mars", "mercury", "io"].includes(army.planetId)) ?? (!fleets.length ? ports.find((army) => army !== luna) : null);
    if (expedition && !fleets.some((fleet) => fleet.planetId === expedition.planetId)) {
      newFleet(state, houseId, expedition.regionId, { transport: 1, corvette: 1, assault: 1 });
    }
  }
}

export function createGame({
  houseId = "augustus", mode = "grand", planetId = "mars", terrain, enemyHouseId, difficulty = "standard", seed = 2718,
} = {}) {
  houseId = HOUSES[houseId] ? houseId : HOUSE_IDS[0];
  mode = ["grand", "planetary", "skirmish"].includes(mode) ? mode : "grand";
  planetId = PLANETS[planetId]?.regionIds?.length ? planetId : "mars";
  const state = {
    version: SAVE_VERSION, houseId, mode, difficulty, seed: Number.isFinite(seed) ? seed : 2718,
    planetId, elapsed: 0, tick: 0, carry: 0, serial: 0, speed: 1,
    planets: {}, armies: {}, fleets: {}, battles: {}, alerts: [], projects: [],
    resources: {}, relations: {}, victory: null, aiTurn: 0,
  };
  for (const [i, a] of HOUSE_IDS.entries()) {
    const initialResources = STARTING_RESOURCES[a]?.credits != null ? STARTING_RESOURCES[a] : STARTING_RESOURCES;
    state.resources[a] = { ...CAMPAIGN_DEFAULTS, ...initialResources };
    for (const b of HOUSE_IDS.slice(i + 1)) {
      state.relations[[a, b].sort().join(":")] = {
        stance: "war", trade: false, access: false, marriage: false, trust: 30,
        liege: null, truceUntil: 0, scoutedUntil: 0,
      };
    }
  }
  if (mode === "skirmish") {
    const preset = SKIRMISHES[terrain] ?? Object.values(SKIRMISHES).find((entry) => entry.terrain === terrain) ?? Object.values(SKIRMISHES)[0];
    const opponent = HOUSES[enemyHouseId] && enemyHouseId !== houseId ? enemyHouseId : HOUSE_IDS.find((id) => id !== houseId);
    const a = newArmy(state, { houseId, squads: preset.squads, id: "player-skirmish" });
    const b = newArmy(state, { houseId: opponent, squads: preset.opponents, id: "rival-skirmish" });
    startBattle(state, null, a, b, preset.terrain, preset.name);
    return state;
  }
  const added = addWorlds(state);
  if (mode === "planetary" && !Object.values(state.armies).some((army) => army.houseId === houseId)) {
    const regions = Object.values(state.planets[planetId].regions);
    const base = regions.find((r) => r.owner === houseId) ?? regions.find((r) => !r.owner) ?? regions[0];
    base.owner = houseId;
    base.buildings.barracks = Math.max(base.buildings.barracks ?? 0, 1);
    for (const army of Object.values(state.armies)) {
      if (army.regionId !== base.id || army.houseId === houseId) continue;
      const alternative = regions.find((r) => r.owner === army.houseId && r.id !== base.id);
      if (alternative) army.regionId = alternative.id;
      else delete state.armies[army.id];
    }
    newArmy(state, { houseId, regionId: base.id, squads: ["commander", "rifle", "rifle", "raider", "engineer", "medic"] });
  }
  if (mode === "grand") giveStartingFleets(state, added);
  notify(state, `${HOUSES[houseId].name} is ready to march.`);
  return state;
}

export function getPlanetControl(state, planetId) {
  const regions = {};
  const counts = {};
  for (const region of Object.values(state.planets[planetId]?.regions ?? {})) {
    regions[region.id] = region.owner;
    if (region.owner) counts[region.owner] = (counts[region.owner] ?? 0) + 1;
  }
  const total = Object.keys(regions).length;
  const disputed = Object.values(state.battles).some((battle) => battle.planetId === planetId && battle.winner === null);
  const owner = total && !disputed ? Object.keys(counts).find((id) => counts[id] === total) ?? null : null;
  return { owner, regions, total, counts };
}

export function getGroupControl(state, groupId) {
  const memberIds = PLANET_GROUPS[groupId]?.worldIds ?? [];
  const counts = {};
  const worlds = Object.fromEntries(memberIds.map((planetId) => {
    const { owner } = getPlanetControl(state, planetId);
    if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
    return [planetId, owner];
  }));
  const total = memberIds.length;
  const owner = total ? Object.keys(counts).find((id) => counts[id] === total) ?? null : null;
  return { owner, total, counts, worlds };
}

export function getControlBonusStatus(state, houseId = state.houseId) {
  const cycle = Math.floor(state.tick / CONTROL_TICKS);
  return {
    interval: CONTROL_INTERVAL, cycle,
    secondsRemaining: ((cycle + 1) * CONTROL_TICKS - state.tick) * STEP,
    worlds: Object.keys(state.planets).filter((id) => getPlanetControl(state, id).owner === houseId),
    groups: Object.keys(PLANET_GROUPS).filter((id) => getGroupControl(state, id).owner === houseId),
  };
}

function pathStep(origin, destination) {
  return 2.1 + Math.hypot(REGIONS[origin].x - REGIONS[destination].x, REGIONS[origin].y - REGIONS[destination].y) * 11;
}

export function previewRoute(state, armyId, regionId, originId) {
  const army = state.armies[armyId];
  const start = originId ?? army?.transit?.to ?? army?.regionId;
  if (!army || !start || !regionAt(state, regionId) || REGIONS[start].planetId !== REGIONS[regionId].planetId) return null;
  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const candidates = new Set([start]);
  while (candidates.size) {
    const current = [...candidates].reduce((a, b) => distances.get(a) <= distances.get(b) ? a : b);
    if (current === regionId) break;
    candidates.delete(current);
    for (const next of REGIONS[current].neighbors) {
      const owner = regionAt(state, next)?.owner;
      const enemy = hostile(state, army.houseId, owner);
      if ((!hasAccess(state, army.houseId, owner) && !enemy) || (enemy && next !== regionId)) continue;
      const distance = distances.get(current) + pathStep(current, next);
      if (distance >= (distances.get(next) ?? Infinity)) continue;
      previous.set(next, current);
      distances.set(next, distance);
      candidates.add(next);
    }
  }
  if (!distances.has(regionId)) return null;
  const path = [];
  for (let id = regionId; id !== start; id = previous.get(id)) path.unshift(id);
  return { path, eta: distances.get(regionId) + (army.transit && !originId ? army.transit.duration - army.transit.elapsed : 0), danger: path.some((id) => hostile(state, army.houseId, regionAt(state, id).owner)) };
}

export function getSupplyStatus(state, armyId) {
  const army = state.armies[armyId];
  if (!army || army.destroyed) return { supplied: false, status: "Inactive", source: null };
  if (army.fleetId) return { supplied: true, status: "Fleet stores", source: army.fleetId };
  if (!army.regionId) return { supplied: state.mode === "skirmish", status: "Field stores", source: null };
  if (state.resources[army.houseId].supplies < 1) return { supplied: false, status: "House supplies exhausted", source: null };
  const starts = [army.regionId];
  if (army.battleId && army.previousRegionId) starts.push(army.previousRegionId);
  const seen = new Set(starts);
  const queue = [...starts];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const region = regionAt(state, id);
    if (!region || !friendly(state, army.houseId, region.owner)) continue;
    const besieged = Object.values(state.fleets).some((f) => f.planetId === army.planetId && f.blockading && !f.engagement && hostile(state, army.houseId, f.houseId));
    if (region.buildings.fortress || (region.buildings.spaceport && !besieged) || REGIONS[id].colors.includes("brown")
        || region.operations.brown > state.elapsed || region.operations.copper > state.elapsed) {
      return { supplied: true, status: "Supplied", source: id };
    }
    for (const next of REGIONS[id].neighbors) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { supplied: false, status: "Supply line cut", source: null };
}

function queueMove(state, houseId, action) {
  const ids = action.armyIds?.length ? [...new Set(action.armyIds)] : [action.armyId];
  let accepted = 0;
  for (const id of ids) {
    const army = state.armies[id];
    if (!army || army.houseId !== houseId || army.destroyed || army.battleId || army.fleetId) continue;
    const origin = action.queue && army.orders.length ? army.orders.at(-1) : army.transit?.to ?? army.regionId;
    const route = previewRoute(state, id, action.regionId, origin);
    if (!route?.path.length) continue;
    if (!action.queue) army.orders = [];
    army.orders.push(...route.path);
    accepted++;
  }
  return accepted ? ok(`March ordered to ${REGIONS[action.regionId].name}.`) : fail("No eligible army has a route to that territory.");
}

function changeArmies(state, houseId, action) {
  const army = state.armies[action.armyId];
  if (!army || army.houseId !== houseId || army.destroyed || army.transit || army.fleetId || army.battleId) return fail("The army must be stationary and available.");
  if (action.type === "combine") {
    const target = state.armies[action.targetId];
    if (!target || target.id === army.id || target.regionId !== army.regionId || target.houseId !== houseId
        || target.destroyed || target.transit || target.fleetId || target.battleId) return fail("Select another friendly army in the same territory.");
    target.squads.push(...army.squads);
    target.peakStrength = Math.max(target.peakStrength, population(target));
    for (const project of state.projects) if (project.armyId === army.id) project.armyId = target.id;
    delete state.armies[army.id];
    return ok(`Combined into ${target.name}.`);
  }
  const selected = action.squadIds?.length ? army.squads.filter((s) => action.squadIds.includes(s.id)) : army.squads.slice(Math.ceil(army.squads.length / 2));
  if (!selected.length || selected.length === army.squads.length) return fail("A split must leave at least one squad in each army.");
  army.squads = army.squads.filter((s) => !selected.includes(s));
  newArmy(state, { houseId, regionId: army.regionId, squads: selected, doctrine: army.doctrine, name: `${army.name} Detachment` });
  return ok("Detachment formed.");
}

function startBattle(state, regionId, defender, attacker, terrain, name) {
  const id = nextId(state, "battle");
  const location = REGIONS[regionId];
  const region = regionAt(state, regionId);
  const armies = [defender, attacker].map((army, index) => ({
    ...army, commander: { ...army.commander }, defense: index === 0 ? (region?.buildings.fortress ?? 0) * (HOUSES[army.houseId].bonus.fortress ?? 1) : 0,
    supplied: getSupplyStatus(state, army.id).supplied,
  }));
  const battle = createBattle({
    id, planetId: location?.planetId ?? null, regionId,
    name: name ?? location?.name ?? "Skirmish", armies, terrain: terrain ?? location?.terrain,
    seed: state.seed + state.serial,
  });
  const weakened = region?.operations.green > state.elapsed;
  const flank = region?.operations.red > state.elapsed;
  for (const squad of battle.squads) {
    if (squad.armyId === defender.id && weakened) squad.morale = Math.max(25, squad.morale * 0.77);
    if (squad.armyId === attacker.id && flank) squad.y = Math.max(40, squad.y * 0.62);
  }
  state.battles[id] = battle;
  for (const army of [defender, attacker]) {
    army.battleId = id;
    army.transit = null;
  }
  if (armies.some((a) => a.houseId === state.houseId)) notify(state, `${battle.name}: ${HOUSES[attacker.houseId].name} engaged ${HOUSES[defender.houseId].name}.`);
  return battle;
}

function enterRegion(state, army, regionId) {
  const region = regionAt(state, regionId);
  if (!region) return false;
  const active = Object.values(state.battles).find((b) => b.regionId === regionId && b.winner === null);
  const participants = active ? new Set(active.squads.map((s) => s.houseId)) : null;
  if (active && !participants.has(army.houseId)) return false;
  const from = army.regionId;
  army.planetId = REGIONS[regionId].planetId;
  army.regionId = regionId;
  if (from && from !== regionId) army.previousRegionId = from;
  if (active) {
    army.battleId = active.id;
    addReinforcements(active, { ...army, supplied: getSupplyStatus(state, army.id).supplied });
    if (army.houseId === state.houseId) notify(state, `${active.name}: ${army.name} reinforced the battle.`);
    return true;
  }
  const defender = Object.values(state.armies).find((other) => !other.destroyed && !other.fleetId && !other.transit && !other.battleId
    && other.regionId === regionId && hostile(state, army.houseId, other.houseId));
  if (defender) {
    startBattle(state, regionId, defender, army);
    return true;
  }
  if (hostile(state, army.houseId, region.owner) && region.buildings.fortress && (region.garrisonReadyAt ?? 0) <= state.elapsed) {
    const level = region.buildings.fortress;
    region.garrisonReadyAt = state.elapsed + 100;
    const garrison = newArmy(state, { houseId: region.owner, regionId, name: `${REGIONS[regionId].name} Garrison`,
      squads: ["rifle", "heavy", ...Array.from({ length: level - 1 }, () => "rifle")] });
    garrison.garrison = true;
    startBattle(state, regionId, garrison, army);
    return true;
  }
  if (!region.owner || hostile(state, army.houseId, region.owner)) captureRegion(state, region, army.houseId);
  return true;
}

function captureRegion(state, region, houseId) {
  const old = region.owner;
  region.owner = houseId;
  region.rally = null;
  region.operations = {};
  if (houseId === state.houseId || old === state.houseId) notify(state, `${REGIONS[region.id].name} now answers to ${HOUSES[houseId].name}.`);
}

function finishBattle(state, battle) {
  const region = regionAt(state, battle.regionId);
  if (region && HOUSES[battle.winner] && region.owner !== battle.winner) captureRegion(state, region, battle.winner);
  const ids = new Set(battle.squads.map((s) => s.armyId));
  for (const id of ids) {
    const army = state.armies[id];
    if (!army) continue;
    const survivors = new Map(battle.squads.filter((s) => s.armyId === id && s.soldiers > 0).map((s) => [s.id, s]));
    const won = army.houseId === battle.winner;
    if (army.squads.some((s) => s.type === "commander" && !survivors.has(s.id))) {
      army.commander.wounded = true;
      army.commander.leadership = Math.max(20, army.commander.leadership - 14);
    }
    if (won) army.commander.experience += 18;
    army.squads = army.squads.filter((s) => survivors.has(s.id)).map((s) => ({
      ...s, soldiers: survivors.get(s.id).soldiers,
      xp: Math.max(s.xp, survivors.get(s.id).xp) + (won ? 8 : 3),
      wounds: Math.max(0, survivors.get(s.id).soldiers * UNIT_TYPES[s.type].hp - survivors.get(s.id).hp),
    }));
    army.battleId = null;
    if (!won && region) {
      army.orders = [];
      const escape = [army.previousRegionId, ...REGIONS[region.id].neighbors].find((candidate) => {
        const safe = regionAt(state, candidate);
        return safe && !hostile(state, army.houseId, safe.owner) && hasAccess(state, army.houseId, safe.owner);
      });
      if (escape) army.regionId = escape;
      else if (battle.winner !== "draw") army.squads = [];
    }
    if (!army.squads.length || army.garrison) {
      army.destroyed = true;
      army.orders = [];
      army.regionId = null;
    }
  }
  if (state.mode === "skirmish") {
    state.victory = { houseId: battle.winner, reason: battle.winner === "draw" ? "Stalemate" : "Field victory" };
  }
  if (state.mode === "skirmish" || battle.squads.some((s) => s.houseId === state.houseId)) {
    notify(state, `${battle.name}: ${HOUSES[battle.winner]?.name ?? "Neither House"} prevailed.`);
  }
  battle.finishedAt = state.elapsed;
}

function tickArmies(state) {
  for (const army of Object.values(state.armies)) {
    if (army.destroyed || army.battleId || army.fleetId || !army.regionId) continue;
    if (!army.transit && army.orders.length) {
      const to = army.orders.shift();
      const target = regionAt(state, to);
      if (!target || !REGIONS[army.regionId].neighbors.includes(to)
          || (!hasAccess(state, army.houseId, target.owner) && !hostile(state, army.houseId, target.owner))) {
        army.orders = [];
        continue;
      }
      army.transit = { from: army.regionId, to, elapsed: 0, duration: pathStep(army.regionId, to) };
    }
    const transit = army.transit;
    if (!transit) continue;
    transit.elapsed = Math.min(transit.duration, transit.elapsed + STEP);
    const occupied = Object.values(state.battles).some((battle) => battle.regionId === transit.to && battle.winner === null);
    const crossing = !occupied && Object.values(state.armies).find((other) => other.transit && hostile(state, army.houseId, other.houseId)
      && other.transit.to === transit.from && other.transit.from === transit.to
      && transit.elapsed / transit.duration + other.transit.elapsed / other.transit.duration >= 1);
    if (crossing) {
      const regionId = transit.to;
      army.previousRegionId = army.regionId;
      army.regionId = regionId;
      army.orders = [];
      crossing.orders = [];
      startBattle(state, regionId, crossing, army);
      continue;
    }
    if (transit.elapsed >= transit.duration && enterRegion(state, army, transit.to)) army.transit = null;
  }
}

function spend(state, houseId, cost, multiplier = 1) {
  const resources = state.resources[houseId];
  const entries = Object.entries(cost).map(([key, value]) => [key, Math.ceil(value * multiplier)]);
  if (entries.some(([key, amount]) => resources[key] < amount)) return false;
  for (const [key, amount] of entries) resources[key] -= amount;
  return true;
}

function queueProject(state, houseId, { type, regionId, armyId, buildingId, unitType, shipType }) {
  const army = state.armies[armyId];
  const targetRegion = type === "recruit" || type === "replenish" ? army?.regionId : regionId;
  const region = regionAt(state, targetRegion);
  if (!region || region.owner !== houseId) return fail("Choose a territory you control.");
  if (army && (army.houseId !== houseId || army.transit || army.battleId || army.fleetId || army.destroyed)) return fail("The army must be stationary and available.");
  if (state.projects.filter((p) => p.regionId === targetRegion).length >= 5) return fail("This territory has five projects queued.");
  let item;
  let cost;
  let duration;
  if (type === "build") {
    item = buildingId;
    const building = BUILDINGS[item];
    if (!building) return fail("Unknown building.");
    const level = (region.buildings[item] ?? 0) + state.projects.filter((p) => p.regionId === targetRegion && p.type === type && p.item === item).length;
    if (level >= building.maxLevel) return fail(`${building.name} has reached its final tier.`);
    if (state.mode !== "grand" && item === "spaceport") return fail("Shipyards operate in Grand Conquest.");
    cost = Object.fromEntries(Object.entries(building.cost).map(([k, v]) => [k, v * (level + 1)]));
    duration = (5 + level * 3) * (HOUSES[houseId].bonus.construction ?? 1);
    if (REGIONS[targetRegion].colors.includes("orange")) duration *= 0.72;
  } else if (type === "buildShip") {
    item = shipType;
    if (!SHIPS[item] || !region.buildings.spaceport || state.mode !== "grand") return fail("A spaceport is required to build that ship.");
    if (["battleship", "carrier"].includes(item) && region.buildings.spaceport < 2) return fail("This ship requires a tier 2 spaceport.");
    cost = SHIPS[item].cost;
    duration = 6 + SHIPS[item].power * 0.1;
    if (REGIONS[targetRegion].colors.includes("blue")) duration *= 0.78;
  } else if (type === "replenish") {
    if (!army || !region.buildings.barracks) return fail("Move the army to a friendly barracks.");
    const missing = army.squads.reduce((total, s) => total + Math.max(0, UNIT_TYPES[s.type].maxSoldiers - s.soldiers), 0);
    if (!missing && !army.squads.some((s) => s.wounds > 0)) return fail("This force is already at full strength.");
    if (state.projects.some((p) => p.type === type && p.armyId === armyId)) return fail("Recovery is already queued.");
    item = "Squad recovery";
    cost = { credits: 10 + missing, supplies: 6 + Math.ceil(missing / 2) };
    duration = REGIONS[targetRegion].colors.includes("yellow") ? 4 : 8;
  } else {
    item = unitType;
    const unit = UNIT_TYPES[item];
    if (!unit || !region.buildings.barracks) return fail("A barracks is required to recruit this squad.");
    if (type === "dispatch" && !region.rally) return fail("Set a rally point before dispatching squads.");
    if (ADVANCED_UNITS.has(item) && !(region.buildings.workshop || REGIONS[targetRegion].colors.includes(String(unit.color).toLowerCase()))) {
      return fail("This specialist requires a workshop or its matching Color population.");
    }
    if ((army?.squads.length ?? 0) + state.projects.filter((p) => p.armyId === armyId && armyId).length >= 16) return fail("An army holds up to 16 squads.");
    cost = { credits: Math.ceil(17 + unit.maxSoldiers * 0.7 + unit.hp * 0.27), supplies: 6, materials: ["tank", "transport"].includes(item) ? 28 : 3 };
    const discount = HOUSES[houseId].bonus.recruit?.[item] ?? 1;
    cost.credits *= discount;
    duration = (ADVANCED_UNITS.has(item) ? 6 : 4) / Math.sqrt(region.buildings.barracks);
  }
  if (!spend(state, houseId, cost)) return fail("Insufficient resources for this project.");
  state.projects.push({ id: nextId(state, "project"), houseId, regionId: targetRegion, armyId: armyId ?? null, type, item, duration, remaining: duration });
  return ok(`${BUILDINGS[item]?.name ?? SHIPS[item]?.name ?? UNIT_TYPES[item]?.name ?? item} queued.`);
}

function completeProject(state, p, region) {
  if (p.type === "build") {
    region.buildings[p.item] = (region.buildings[p.item] ?? 0) + 1;
  } else if (p.type === "buildShip") {
    const fleet = Object.values(state.fleets).find((f) => f.houseId === p.houseId && f.regionId === region.id
      && !f.armyId && !f.transit && !f.engagement && !f.landing) ?? newFleet(state, p.houseId, region.id, {});
    fleet.ships[p.item] = (fleet.ships[p.item] ?? 0) + 1;
  } else {
    let army = state.armies[p.armyId];
    if (p.type === "replenish") {
      if (!army || army.destroyed || army.regionId !== region.id || army.fleetId || army.transit || army.battleId) return;
      for (const squad of army.squads) {
        squad.soldiers = UNIT_TYPES[squad.type].maxSoldiers;
        squad.wounds = 0;
      }
      army.commander.wounded = false;
      army.peakStrength = Math.max(army.peakStrength, population(army));
    } else {
      const squad = createSquad(p.item, nextId(state, "squad"));
      if (!army || army.destroyed || army.regionId !== region.id || army.fleetId || army.transit || army.battleId || army.squads.length >= 16) {
        if (p.type === "dispatch" && region.rally) {
          army = Object.values(state.armies).find((a) => a.houseId === p.houseId && a.regionId === region.id
            && !a.destroyed && !a.battleId && !a.fleetId && !a.transit && a.orders.at(-1) === region.rally && a.squads.length < 16);
        } else {
          army = Object.values(state.armies).find((a) => a.houseId === p.houseId && a.regionId === region.id
            && !a.destroyed && !a.battleId && !a.fleetId && !a.transit && !a.orders.length && a.squads.length < 16);
        }
      }
      if (army) army.squads.push(squad);
      else army = newArmy(state, { houseId: p.houseId, regionId: region.id, squads: [squad] });
      army.peakStrength = Math.max(army.peakStrength, population(army));
      if (p.type === "dispatch" && region.rally) queueMove(state, p.houseId, { armyId: army.id, regionId: region.rally });
    }
  }
  if (p.houseId === state.houseId) notify(state, `${REGIONS[region.id].name}: ${BUILDINGS[p.item]?.name ?? SHIPS[p.item]?.name ?? UNIT_TYPES[p.item]?.name ?? p.item} ready.`);
}

function tickProjects(state) {
  const worked = new Set();
  const pending = [];
  for (const p of state.projects) {
    const region = regionAt(state, p.regionId);
    if (!region || region.owner !== p.houseId) continue;
    const queue = `${p.regionId}:${p.type === "build" ? "construction" : p.type === "buildShip" ? "shipyard" : "barracks"}`;
    if (worked.has(queue)) {
      pending.push(p);
      continue;
    }
    worked.add(queue);
    p.remaining -= STEP;
    if (p.remaining <= 1e-6) completeProject(state, p, region);
    else pending.push(p);
  }
  state.projects = pending;
}

function economy(state) {
  const income = Object.fromEntries(HOUSE_IDS.map((id) => [id, { credits: 0, materials: 0, supplies: 0, influence: 0 }]));
  for (const planet of Object.values(state.planets)) {
    const rates = WORLD_ECONOMIES[planet.id].multipliers;
    for (const region of Object.values(planet.regions)) {
      if (!region.owner) continue;
      const colors = REGIONS[region.id].colors;
      const earnings = income[region.owner];
      const trade = (colors.includes("silver") ? 2 : 0) + (colors.includes("copper") ? 1 : 0);
      const contract = region.operations.silver > state.elapsed ? 5 : 0;
      const cache = region.operations.brown > state.elapsed ? 3 : 0;
      earnings.credits += (1.2 + trade + contract) * rates.credits;
      earnings.materials += (region.buildings.mine ?? 0) * (colors.includes("red") ? 3 : 1.7) * rates.materials;
      earnings.supplies += ((colors.includes("brown") ? 3.5 : 1) + cache) * rates.supplies;
      earnings.influence += (colors.includes("white") ? 1.6 : 0.4) * rates.influence;
      for (const colorId of Object.keys(region.operations)) if (region.operations[colorId] <= state.elapsed) delete region.operations[colorId];
    }
  }
  for (const [pair, terms] of Object.entries(state.relations)) {
    const [a, b] = pair.split(":");
    if (terms.trade && terms.stance !== "war") {
      income[a].credits += 4;
      income[b].credits += 4;
    }
    if (terms.liege && terms.stance === "vassal") income[terms.liege].influence += 2;
    if (terms.truceUntil && terms.truceUntil <= state.elapsed) {
      terms.truceUntil = 0;
      if (terms.stance === "truce") terms.stance = "neutral";
    }
  }
  for (const houseId of HOUSE_IDS) {
    const resource = state.resources[houseId];
    const bonus = HOUSES[houseId].bonus.production ?? {};
    for (const key of RESOURCE_KEYS) resource[key] += income[houseId][key] * (bonus[key] ?? 1);
  }
  for (const army of Object.values(state.armies)) {
    if (army.destroyed || army.fleetId || army.garrison) continue;
    const resource = state.resources[army.houseId];
    const supplied = getSupplyStatus(state, army.id).supplied;
    resource.supplies = Math.max(0, resource.supplies - (0.24 + population(army) * 0.012) * (army.transit || army.battleId ? 1.85 : 1));
    army.localSupply = Math.min(1, Math.max(0, army.localSupply + (supplied ? 0.16 : -0.1)));
    if (army.battleId) {
      const battle = state.battles[army.battleId];
      const entry = battle.armies.find((a) => a.id === army.id);
      if (entry) entry.supplied = army.localSupply >= 0.5;
      if (army.localSupply < 0.5) {
        for (const squad of battle.squads) if (squad.armyId === army.id && squad.soldiers) squad.morale = Math.max(0, squad.morale - 3);
      }
    }
    if (supplied && !army.battleId && !army.transit && REGIONS[army.regionId]?.colors.includes("yellow")) {
      for (const squad of army.squads) squad.wounds = Math.max(0, (squad.wounds ?? 0) - UNIT_TYPES[squad.type].hp * 0.05);
    }
  }
}

function musterControlSquads(state, houseId, worldId, squads) {
  const regionId = WORLD_ECONOMIES[worldId].musterRegionId;
  // A depleted or deployed army can never receive strategic reinforcements mid-battle or in orbit.
  let army = Object.values(state.armies).find((candidate) => candidate.houseId === houseId
    && candidate.regionId === regionId && !candidate.destroyed && !candidate.transit && !candidate.fleetId
    && !candidate.battleId && !candidate.orders.length && candidate.squads.length < ARMY_SQUAD_LIMIT);
  for (const [type, amount] of Object.entries(squads)) {
    for (let i = 0; i < amount; i++) {
      const squad = createSquad(type, nextId(state, "squad"));
      if (!army || army.squads.length >= ARMY_SQUAD_LIMIT) {
        army = newArmy(state, { houseId, regionId, squads: [squad], name: `${PLANETS[worldId].name} Reserves` });
      } else {
        army.squads.push(squad);
        army.peakStrength = Math.max(army.peakStrength, population(army));
      }
    }
  }
}

function payControlBonuses(state) {
  const control = Object.fromEntries(Object.keys(state.planets).map((id) => [id, getPlanetControl(state, id).owner]));
  const awards = [];
  for (const [id, houseId] of Object.entries(control)) {
    if (houseId) awards.push({ houseId, name: PLANETS[id].name, reward: WORLD_ECONOMIES[id].reward, musterWorldId: id });
  }
  for (const group of Object.values(PLANET_GROUPS)) {
    const houseId = control[group.worldIds[0]];
    if (houseId && group.worldIds.every((id) => control[id] === houseId)) {
      awards.push({ houseId, name: group.name, reward: group.reward, musterWorldId: group.musterWorldId ?? group.worldIds[0] });
    }
  }
  const claimed = [];
  const resources = {};
  const reinforcements = {};
  for (const { houseId, name, reward, musterWorldId } of awards) {
    const { resources: payment, squads } = reward;
    for (const [key, amount] of Object.entries(payment)) {
      state.resources[houseId][key] += amount;
      if (houseId === state.houseId) resources[key] = (resources[key] ?? 0) + amount;
    }
    if (squads) musterControlSquads(state, houseId, musterWorldId, squads);
    if (houseId !== state.houseId) continue;
    claimed.push(name);
    for (const [type, amount] of Object.entries(squads ?? {})) reinforcements[type] = (reinforcements[type] ?? 0) + amount;
  }
  if (!claimed.length) return;
  const values = [
    ...Object.entries(resources).map(([key, amount]) => `+${amount} ${RESOURCE_LABELS[key]}`),
    ...Object.entries(reinforcements).map(([type, amount]) => `+${amount} ${UNIT_TYPES[type].name} squads`),
  ];
  notify(state, `Control cycle ${state.tick / CONTROL_TICKS} • ${claimed.join(", ")} awarded ${values.join(", ")}.`);
}

const strength = (state, houseId) => Object.values(state.armies).filter((a) => a.houseId === houseId && !a.destroyed)
  .reduce((total, a) => total + population(a), 0);

function diplomacy(state, a, { houseId: b, deal, regionId }) {
  const terms = contact(state, a, b);
  if (!terms || !["war", "truce", "trade", "alliance", "access", "vassal", "marriage", "ceasefire", "concession", "betray"].includes(deal)) return fail("Choose a rival House and a valid agreement.");
  if (state.mode === "skirmish") return fail("Diplomacy is available during campaigns.");
  const fighting = Object.values(state.battles).some((battle) => battle.winner === null
    && battle.squads.some((s) => s.houseId === a) && battle.squads.some((s) => s.houseId === b));
  const fleetFighting = Object.values(state.fleets).some((f) => f.houseId === a && state.fleets[f.engagement?.opponentId]?.houseId === b);
  if (fighting || fleetFighting) return fail("Resolve the active engagements between these Houses first.");
  if (["war", "betray"].includes(deal)) {
    if (terms.stance === "war") return fail("The Houses are already at war.");
    Object.assign(terms, { stance: "war", trade: false, access: false, marriage: false, trust: Math.max(0, terms.trust - 25), liege: null, truceUntil: 0 });
    notify(state, `${HOUSES[a].name} declared war on ${HOUSES[b].name}.`);
    return ok("War declared.");
  }
  if (["truce", "ceasefire"].includes(deal)) {
    if (terms.stance !== "war") return fail("A ceasefire requires an ongoing war.");
    if (!spend(state, a, { influence: 13 }, HOUSES[a].bonus.diplomacyCost)) return fail("Insufficient influence to sign a ceasefire.");
    Object.assign(terms, { stance: "truce", truceUntil: state.elapsed + 75, trust: Math.max(35, terms.trust) });
  } else if (deal === "vassal") {
    if (terms.stance === "vassal" || strength(state, a) < Math.max(1, strength(state, b)) * 1.55) return fail("Submission requires a decisive military advantage over the rival.");
    if (!spend(state, a, { influence: 40 }, HOUSES[a].bonus.diplomacyCost)) return fail("Insufficient influence for a submission treaty.");
    Object.assign(terms, { stance: "vassal", liege: a, access: true, trade: true, trust: 85, truceUntil: 0 });
  } else if (deal === "concession") {
    const region = regionAt(state, regionId);
    if (!region || region.owner !== b || terms.stance === "war" || strength(state, a) < strength(state, b) * 1.25) return fail("Select a rival territory while at peace and establish a military advantage.");
    if (Object.values(state.armies).some((army) => !army.destroyed && army.regionId === regionId && army.houseId === b)) return fail("The rival has troops stationed in that territory.");
    if (!spend(state, a, { influence: 32, credits: 40 }, HOUSES[a].bonus.diplomacyCost)) return fail("Insufficient resources for a territory concession.");
    captureRegion(state, region, a);
  } else {
    if (terms.stance === "war") return fail("Negotiate a ceasefire before proposing that agreement.");
    const price = { trade: 10, alliance: 30, access: 12, marriage: 22 }[deal];
    if ((deal === "alliance" && ["alliance", "vassal"].includes(terms.stance)) || terms[deal] === true) return fail("That agreement is already in effect.");
    if (deal === "alliance" && terms.trust < 50) return fail("Build trust with other agreements before requesting an alliance.");
    if (!spend(state, a, { influence: price }, HOUSES[a].bonus.diplomacyCost)) return fail("Insufficient influence for that agreement.");
    if (deal === "alliance") Object.assign(terms, { stance: "alliance", truceUntil: 0, access: true });
    else terms[deal] = true;
    terms.trust = Math.min(100, terms.trust + (deal === "marriage" ? 22 : 12));
  }
  const message = `${HOUSES[a].name} and ${HOUSES[b].name}: ${deal} agreement signed.`;
  if (a === state.houseId || b === state.houseId) notify(state, message);
  return ok(message);
}

function operation(state, houseId, { regionId, colorId, targetId }) {
  const origin = regionAt(state, regionId);
  const def = OPERATIONS[colorId];
  if (!origin || origin.owner !== houseId || !def || !REGIONS[regionId].colors.includes(colorId)) return fail("Select a friendly territory with the required Color population.");
  let target = origin;
  let terms;
  if (["red", "green", "pink"].includes(colorId)) {
    const candidates = colorId === "pink" ? Object.values(state.planets).flatMap((p) => Object.keys(p.regions)) : REGIONS[regionId].neighbors;
    const valid = candidates.filter((id) => {
      const owner = regionAt(state, id)?.owner;
      return hostile(state, houseId, owner) || (!owner && colorId === "red");
    });
    target = regionAt(state, targetId ?? valid[0]);
    if (!target || !valid.includes(target.id)) return fail("Choose a reachable enemy territory.");
  }
  if (colorId === "pink" || colorId === "white") {
    const rival = colorId === "white" ? (HOUSES[targetId] ? targetId : regionAt(state, targetId)?.owner ?? HOUSE_IDS.find((id) => hostile(state, houseId, id))) : target.owner;
    terms = contact(state, houseId, rival);
    if (!terms) return fail("Choose a rival House.");
  }
  const army = colorId === "violet" ? Object.values(state.armies).find((a) => a.houseId === houseId && a.regionId === regionId
    && !a.destroyed && !a.battleId && !a.fleetId && !a.transit) : null;
  if (colorId === "violet" && !army) return fail("Station a friendly army here before refitting.");
  if (target.operations[colorId] > state.elapsed) return fail("This operation is already active.");
  const cost = HOUSES[houseId].bonus.intelCost && colorId === "pink" ? HOUSES[houseId].bonus.intelCost : 1;
  if (!spend(state, houseId, def.cost, cost)) return fail("Insufficient resources for this operation.");
  target.operations[colorId] = state.elapsed + (def.duration ?? 35);
  if (colorId === "pink") {
    terms.scoutedUntil = target.operations[colorId];
    const count = Object.values(state.armies).filter((a) => a.regionId === target.id && !a.destroyed && !a.fleetId).reduce((n, a) => n + population(a), 0);
    notify(state, `${REGIONS[target.id].name}: ${count} enemy soldiers and fortress tier ${target.buildings.fortress ?? 0} reported.`);
  }
  if (colorId === "white") terms.trust = Math.min(100, terms.trust + 18);
  if (colorId === "violet") {
    for (const squad of army.squads) {
      squad.xp += 12;
      squad.wounds = Math.max(0, (squad.wounds ?? 0) - UNIT_TYPES[squad.type].hp * 0.24);
    }
  }
  return ok(`${def.name} activated at ${REGIONS[target.id].name}.`);
}

const fleetHelpers = { friendly: hasAccess, hostile, notify, arrive: enterRegion, nextId };

function tickAI(state) {
  const rapid = ["hard", "expert", "veteran"].includes(state.difficulty);
  const relaxed = ["easy", "cadet"].includes(state.difficulty);
  const cadence = rapid ? 38 : relaxed ? 96 : 60;
  if (state.tick % cadence || state.elapsed < (rapid ? 8 : 12)) return;
  const rivals = HOUSE_IDS.filter((id) => id !== state.houseId);
  const houseId = rivals[state.aiTurn++ % rivals.length];
  const personality = HOUSES[houseId];
  const armies = Object.values(state.armies).filter((a) => a.houseId === houseId && !a.garrison && !a.destroyed && !a.transit && !a.battleId && !a.fleetId && !a.orders.length);
  // Rotate through fronts so new expeditions have a chance to act while older armies are still active.
  const front = armies.length ? Math.floor((state.aiTurn - 1) / rivals.length) % armies.length : 0;
  const activeFronts = [...armies.slice(front), ...armies.slice(0, front)];
  const home = Object.values(state.planets).flatMap((p) => Object.values(p.regions)).filter((r) => r.owner === houseId);
  const buildAt = home.find((r) => !r.buildings.mine && !state.projects.some((p) => p.regionId === r.id && p.item === "mine"));
  if (buildAt && state.resources[houseId].materials > 100) queueProject(state, houseId, { type: "build", regionId: buildAt.id, buildingId: "mine" });
  const military = armies.find((a) => regionAt(state, a.regionId)?.buildings.barracks && a.squads.length < (rapid ? 9 : 7));
  if (military && state.resources[houseId].credits > 95) {
    const choices = [personality.preferredRecruit, "rifle", "medic", "engineer", "raider", "heavy"];
    for (const item of choices) {
      if (!item || military.squads.filter((s) => s.type === item).length > 1) continue;
      if (queueProject(state, houseId, { type: "recruit", armyId: military.id, unitType: item }).ok) break;
    }
  }
  if (!armies.length && !Object.values(state.armies).some((a) => a.houseId === houseId && !a.destroyed && !a.garrison)) {
    const barracks = home.find((r) => r.buildings.barracks && !state.projects.some((p) => p.regionId === r.id && p.type === "train"));
    if (barracks && state.resources[houseId].credits > 65) queueProject(state, houseId, { type: "train", regionId: barracks.id, unitType: "rifle" });
  }
  if (state.elapsed > 22 && state.aiTurn % 5 === 0) {
    const dominant = HOUSE_IDS.find((id) => id !== houseId && strength(state, id) > strength(state, houseId) * 1.65);
    const partner = HOUSE_IDS.find((id) => id !== houseId && id !== dominant && id !== state.houseId && hostile(state, id, dominant));
    if (partner && hostile(state, houseId, dominant)) {
      const terms = contact(state, houseId, partner);
      if (terms.stance === "war") diplomacy(state, houseId, { houseId: partner, deal: "truce" });
      else if (terms.trust < 50) diplomacy(state, houseId, { houseId: partner, deal: terms.trade ? "marriage" : "trade" });
      else diplomacy(state, houseId, { houseId: partner, deal: "alliance" });
    }
  }
  let started = 0;
  for (const army of activeFronts) {
    if (started >= (rapid ? 3 : 2)) break;
    const local = regionAt(state, army.regionId);
    const nearby = REGIONS[army.regionId].neighbors.map((id) => regionAt(state, id)).filter(Boolean);
    const houseDoctrine = army.doctrine === "aggressive" ? 1.38 : army.doctrine === "cautious" ? 0.78 : 1;
    const force = population(army) * houseDoctrine;
    const targets = Object.values(state.planets[army.planetId].regions).flatMap((r) => {
      if ((r.owner && !hostile(state, houseId, r.owner)) || r.id === army.regionId) return [];
      const route = previewRoute(state, army.id, r.id);
      if (!route || Object.values(state.battles).some((b) => b.regionId === r.id && b.winner === null)) return [];
      const defenses = (r.buildings.fortress ?? 0) * 16 + Object.values(state.armies).filter((a) => a.regionId === r.id && !a.destroyed && hostile(state, houseId, a.houseId)).reduce((n, a) => n + population(a), 0);
      if (defenses > force * (rapid ? 1.26 : relaxed ? 0.75 : 1.02)) return [];
      const value = (r.buildings.spaceport ?? 0) * 16 + (r.buildings.mine ?? 0) * 8 + (r.owner ? 33 : 40);
      return [{ id: r.id, score: value - route.eta - defenses * 0.27 }];
    }).sort((a, b) => b.score - a.score);
    const threatened = nearby.find((r) => r.owner === houseId && Object.values(state.battles).some((b) => b.regionId === r.id
      && b.winner === null && b.squads.some((s) => s.houseId === houseId)));
    if (threatened && force > 35 && queueMove(state, houseId, { armyId: army.id, regionId: threatened.id }).ok) started++;
    else if (targets[0] && force >= (local?.owner === houseId ? 34 : 25) && queueMove(state, houseId, { armyId: army.id, regionId: targets[0].id }).ok) started++;
    else if (state.mode === "grand" && state.elapsed > 32 && local?.buildings.spaceport && force > 45) {
      const source = PLANETS[army.planetId];
      const landingSites = Object.values(state.planets).filter((p) => p.id !== army.planetId).flatMap((p) => {
        const world = PLANETS[p.id];
        const regions = Object.values(p.regions);
        const distance = Math.hypot(source.x - world.x, source.y - world.y);
        const foothold = regions.some((r) => r.owner === houseId) ? 7 : 0;
        return regions.filter((r) => !r.owner || hostile(state, houseId, r.owner)).map((r) => ({
          region: r, planetId: p.id,
          score: (r.buildings.spaceport ?? 0) * 5 - (r.buildings.fortress ?? 0) * 11 - distance * 19 + foothold,
        }));
      });
      const destination = landingSites.sort((a, b) => b.score - a.score)[0];
      if (destination && transport(state, houseId, {
        armyId: army.id, planetId: destination.planetId, regionId: destination.region.id,
        landing: !destination.region.owner && destination.region.buildings.spaceport ? "spaceport" : "rain",
      }, fleetHelpers).ok) started++;
    }
  }
  if (state.mode === "grand" && state.elapsed > 45) {
    const port = home.find((r) => r.buildings.spaceport && !state.projects.some((p) => p.regionId === r.id && p.type === "buildShip"));
    if (port && state.resources[houseId].materials > 130) queueProject(state, houseId, { type: "buildShip", regionId: port.id, shipType: "corvette" });
  }
}

function checkVictory(state) {
  const regions = Object.values(state.planets).flatMap((p) => Object.values(p.regions));
  if (!regions.length) return;
  for (const houseId of HOUSE_IDS) {
    const accountable = (other) => other === houseId || contact(state, houseId, other)?.liege === houseId;
    if (regions.every((r) => r.owner && accountable(r.owner))) {
      state.victory = { houseId, reason: regions.every((r) => r.owner === houseId) ? "Territorial domination" : "Recognized supremacy" };
      notify(state, `${HOUSES[houseId].name} won the campaign.`);
      return;
    }
  }
}

export function advance(state, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.victory) return state;
  const total = state.carry + seconds;
  const steps = Math.floor((total + 1e-9) / STEP);
  state.carry = Math.max(0, Math.round((total - steps * STEP) * 1e9) / 1e9);
  for (let i = 0; i < steps && !state.victory; i++) {
    state.elapsed = ++state.tick / 10;
    if (state.mode !== "skirmish") {
      tickArmies(state);
      if (state.mode === "grand") tickFleets(state, STEP, fleetHelpers);
      tickProjects(state);
      if (state.tick % 20 === 0) economy(state);
    }
    for (const battle of Object.values(state.battles)) {
      if (battle.winner !== null) continue;
      tickBattle(battle, STEP);
      if (battle.winner !== null) finishBattle(state, battle);
    }
    if (state.mode === "skirmish") continue;
    if (state.tick % CONTROL_TICKS === 0) payControlBonuses(state);
    tickAI(state);
    if (state.tick % 10 === 0) checkVictory(state);
    if (state.tick % 100 === 0) {
      for (const battle of Object.values(state.battles)) {
        if (battle.finishedAt != null && state.elapsed - battle.finishedAt > 80) delete state.battles[battle.id];
      }
    }
  }
  return state;
}

export function command(state, action) {
  if (!action || typeof action.type !== "string") return fail("Unknown order.");
  if (action.type === "speed") {
    if (![0, 1, 2, 4].includes(action.speed)) return fail("Choose a valid campaign speed.");
    state.speed = action.speed;
    return ok(state.speed ? `Campaign speed ×${state.speed}.` : "Campaign paused.");
  }
  if (state.victory) return fail("This campaign has ended.");
  const houseId = state.houseId;
  switch (action.type) {
    case "move": return queueMove(state, houseId, action);
    case "combine":
    case "split": return changeArmies(state, houseId, action);
    case "doctrine": {
      const army = state.armies[action.armyId];
      if (!army || army.houseId !== houseId || army.destroyed || !DOCTRINES[action.doctrine]) return fail("Choose a friendly army and a valid doctrine.");
      army.doctrine = action.doctrine;
      const battle = state.battles[army.battleId];
      const entry = battle?.armies.find((a) => a.id === army.id);
      if (entry) entry.doctrine = action.doctrine;
      return ok("Doctrine updated.");
    }
    case "recruit":
    case "train":
    case "replenish":
    case "dispatch":
    case "build":
    case "buildShip": return queueProject(state, houseId, action);
    case "rally": {
      const origin = regionAt(state, action.regionId);
      const target = regionAt(state, action.targetId);
      if (!origin || origin.owner !== houseId || !origin.buildings.barracks) return fail("Select a friendly barracks.");
      if (action.targetId && (target?.owner !== houseId || REGIONS[target.id].planetId !== REGIONS[origin.id].planetId)) return fail("The rally point must be on the same world and under your control.");
      origin.rally = action.targetId ?? null;
      return ok(origin.rally ? `Rally point set at ${REGIONS[origin.rally].name}.` : "Rally point cleared.");
    }
    case "transport": return transport(state, houseId, action, fleetHelpers);
    case "sail": return sail(state, houseId, action, fleetHelpers);
    case "fleetOrder": return fleetOrder(state, houseId, action, fleetHelpers);
    case "blockade": return blockade(state, houseId, action, fleetHelpers);
    case "diplomacy": return diplomacy(state, houseId, action);
    case "operation": return operation(state, houseId, action);
    case "orderSquads": {
      const battle = state.battles[action.battleId];
      if (!battle || battle.winner !== null || !action.order || !Array.isArray(action.squadIds)) return fail("No active battle or eligible squads.");
      const result = issueOrder(battle, houseId, action.squadIds, action.order, action.queue);
      if (!result || result.ok === false) return fail(result?.message ?? "No eligible squads can take that order.");
      return ok(result.message ?? "Order issued.");
    }
    case "retreat": {
      const battle = state.battles[action.battleId];
      const squads = battle?.winner === null ? battle.squads.filter((s) => s.houseId === houseId && s.soldiers > 0 && !s.withdrawn) : [];
      if (!squads.length) return fail("There is no active friendly force to withdraw.");
      for (const squad of squads) {
        squad.withdrawn = true;
        squad.orders = [];
      }
      return ok("The army is withdrawing.");
    }
    default: return fail("Unknown order.");
  }
}

const saveKey = (slot) => `war-of-the-gold-houses:${slot}`;

export function saveGame(state, storage, slot = 1) {
  if (!SAVE_SLOTS.includes(slot) || !storage?.setItem) return fail("Choose an available save slot.");
  try {
    storage.setItem(saveKey(slot), JSON.stringify({ savedAt: Date.now(), state }));
    return ok(slot === "auto" ? "Campaign autosaved." : `Campaign saved in slot ${slot}.`);
  } catch {
    return fail("The campaign could not be saved. Check browser storage availability.");
  }
}

function readSlot(storage, slot) {
  if (!SAVE_SLOTS.includes(slot) || !storage?.getItem) return null;
  try {
    const record = JSON.parse(storage.getItem(saveKey(slot)));
    const state = record?.state;
    return [1, SAVE_VERSION].includes(state?.version) && HOUSES[state.houseId] && state.armies && state.battles ? record : null;
  } catch {
    return null;
  }
}

export function loadGame(storage, slot = 1) {
  const state = readSlot(storage, slot)?.state;
  if (!state) return null;
  if (state.version === 1) {
    if (state.mode === "grand") giveStartingFleets(state, addWorlds(state));
    state.version = SAVE_VERSION;
  }
  return state;
}

export function getSaveSlots(storage) {
  return SAVE_SLOTS.map((slot) => {
    const record = readSlot(storage, slot);
    if (!record) return { slot };
    const { mode, houseId, elapsed } = record.state;
    return { slot, mode, houseId, elapsed, savedAt: record.savedAt };
  });
}
