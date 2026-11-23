import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advance, command, createGame, getControlBonusStatus, getGroupControl, getPlanetControl,
  getPurchaseQuote, getRecruitmentOptions, getSaveSlots, getSupplyStatus, loadGame, previewRoute, saveGame,
} from "./game.mjs";
import {
  BUILDINGS, COLORS, FLEET_ROUTES, GRAND_STARTING_ARMIES, HOUSES, HOUSE_HOMEWORLDS, PLANET_GROUPS,
  PLANETS, REGIONS, RESOURCE_KEYS, SHIPS, STARTING_ARMIES, WORLD_ECONOMIES,
} from "./content.mjs";
import { UNIT_TYPES, createBattle, createSquad, issueOrder, tickBattle } from "./battle.mjs";
import { transportSupplyCost } from "./fleets.mjs";

const seed = 314159;
const legacyWorldIds = ["mercury", "luna", "mars", "io"];
const planetIds = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
const moonIds = ["luna", "io", "titan"];

function webpSize(path) {
  const bytes = readFileSync(new URL(`./assets/${path}.webp`, import.meta.url));
  assert.ok(bytes.length >= 20, `${path} is too short to be WebP`);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF", path);
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP", path);
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `${path} is truncated`);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const format = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    assert.ok(data + length <= bytes.length, `${path} has an incomplete ${format} chunk`);
    if (format === "VP8X" && length >= 10) {
      return { width: bytes.readUIntLE(data + 4, 3) + 1, height: bytes.readUIntLE(data + 7, 3) + 1 };
    }
    if (format === "VP8L" && length >= 5 && bytes[data] === 0x2f) {
      const size = bytes.readUInt32LE(data + 1);
      return { width: (size & 0x3fff) + 1, height: ((size >>> 14) & 0x3fff) + 1 };
    }
    if (format === "VP8 " && length >= 10 && bytes.readUIntLE(data + 3, 3) === 0x2a019d) {
      return { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
    }
    offset = data + length + (length % 2);
  }
  assert.fail(`${path} has no recognized WebP image header`);
}

test("painted units have an idle portrait and six equally sized horizontal sprite frames", () => {
  for (const type of Object.keys(UNIT_TYPES)) {
    const idle = webpSize(`units/${type}`);
    assert.ok(idle.width >= 32 && idle.height >= 32, type);
    assert.deepEqual(webpSize(`units/${type}-sheet`), { width: idle.width * 6, height: idle.height }, type);
  }
});

test("painted solar, terrain, fleet, and interface artwork is present", () => {
  const terrains = new Set(Object.values(REGIONS).map(({ terrain }) => terrain));
  const plates = [
    "space/system",
    ...Object.keys(PLANETS).map((id) => `planets/${id}`),
    ...[...terrains].map((id) => `terrain/${id}`),
    ...Object.keys(SHIPS).map((id) => `ships/${id}`),
    "ui/command-icons", "ui/console-frame", "ui/panel-texture", "ui/command-cover",
  ];
  for (const path of plates) {
    const { width, height } = webpSize(path);
    assert.ok(width >= 32 && height >= 32, `${path} is too small to render`);
  }
  const iconAtlas = webpSize("ui/command-icons");
  assert.equal(iconAtlas.width / 5, iconAtlas.height / 4, "Command icon atlas should have square cells");
});

function storageFixture() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
}

function issue(state, action) {
  const outcome = command(state, action);
  assert.equal(outcome.ok, true, outcome.message);
  return outcome;
}

function activeBattle(state) {
  return Object.values(state.battles).find((battle) => battle.winner === null);
}

function advanceUntil(state, condition, limit, step = 0.5) {
  for (let waited = 0; waited < limit; waited += step) {
    if (condition()) return;
    advance(state, step);
  }
  assert.ok(condition(), `Condition did not become true after ${limit} world seconds`);
}

function friendlyRegion(state, regionId) {
  return state.planets[REGIONS[regionId].planetId]?.regions[regionId]?.owner === state.houseId;
}

function playerArmies(state) {
  return Object.values(state.armies).filter(
    (army) => army.houseId === state.houseId && army.planetId && army.regionId,
  );
}

function fieldArmiesAt(state, regionId) {
  return playerArmies(state).filter((army) => army.regionId === regionId && !army.destroyed);
}

function isolatedControl(ownedWorlds = []) {
  const state = createGame({ mode: "grand", seed });
  state.armies = {};
  state.fleets = {};
  for (const planet of Object.values(state.planets)) {
    for (const region of Object.values(planet.regions)) {
      region.owner = ownedWorlds.includes(planet.id) ? state.houseId : null;
    }
  }
  return state;
}

function squadCounts(state) {
  const counts = {};
  for (const army of playerArmies(state).filter((army) => !army.destroyed)) {
    for (const squad of army.squads) counts[squad.type] = (counts[squad.type] ?? 0) + 1;
  }
  return counts;
}

function expectedRewards(definitions) {
  const resources = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));
  const squads = {};
  for (const { reward } of definitions) {
    for (const key of RESOURCE_KEYS) resources[key] += reward.resources?.[key] ?? 0;
    for (const [type, count] of Object.entries(reward.squads ?? {})) {
      squads[type] = (squads[type] ?? 0) + count;
    }
  }
  return { resources, squads };
}

function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: expected ${expected}, received ${actual}`);
}

function assertFirstCycleRewards(state, definitions) {
  const expected = expectedRewards(definitions);
  const { interval } = getControlBonusStatus(state);
  advance(state, interval - 4);
  const baseline = { ...state.resources[state.houseId] };
  advance(state, 2);
  const before = { ...state.resources[state.houseId] };
  advance(state, 1.9);
  assert.deepEqual(state.resources[state.houseId], before);
  assert.deepEqual(squadCounts(state), {});
  advance(state, 0.1);
  const after = state.resources[state.houseId];
  for (const key of RESOURCE_KEYS) {
    const regularIncome = before[key] - baseline[key];
    assertClose(after[key] - before[key] - regularIncome, expected.resources[key], key);
  }
  assert.deepEqual(squadCounts(state), expected.squads);
}

function liveSquads(battle, houseId) {
  return battle.squads.filter(
    (squad) => squad.houseId === houseId && squad.soldiers > 0 && !squad.withdrawn,
  );
}

function position(squad) {
  return [squad.x, squad.y];
}

function openPoint(battle, squad, radius = 120) {
  for (const [dx, dy] of [[0, radius], [0, -radius], [radius, 0], [-radius, 0]]) {
    const x = Math.round(squad.x + dx);
    const y = Math.round(squad.y + dy);
    const inside = x > 15 && y > 15 && x < battle.width - 15 && y < battle.height - 15;
    const blocked = battle.obstacles.some(
      (obstacle) => x >= obstacle.x - 20 && x <= obstacle.x + obstacle.w + 20 &&
        y >= obstacle.y - 20 && y <= obstacle.y + obstacle.h + 20,
    );
    if (inside && !blocked) return { x, y };
  }
  assert.fail("The test squad has no nearby walkable destination");
}

test("campaign roads connect each world and starting rosters reference valid definitions", () => {
  assert.equal(Object.keys(HOUSES).length, 5);
  assert.equal(Object.keys(COLORS).length, 14);
  for (const planet of Object.values(PLANETS)) {
    if (!planet.regionIds.length) continue;
    const visited = new Set();
    const walk = [planet.regionIds[0]];
    while (walk.length) {
      const id = walk.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const region = REGIONS[id];
      assert.equal(region.planetId, planet.id);
      assert.ok(region.colors.every((colorId) => COLORS[colorId]));
      for (const neighbor of region.neighbors) {
        assert.ok(REGIONS[neighbor]?.neighbors.includes(id), `Road ${id}–${neighbor} is not bidirectional`);
        if (!visited.has(neighbor)) walk.push(neighbor);
      }
    }
    assert.deepEqual([...visited].sort(), [...planet.regionIds].sort());
  }
  for (const army of [...STARTING_ARMIES, ...GRAND_STARTING_ARMIES]) {
    assert.ok(HOUSES[army.houseId]);
    assert.ok(REGIONS[army.regionId]);
    assert.ok(army.squads.every((type) => UNIT_TYPES[type]));
  }
});

test("each House starts Grand Conquest with troops and a transport fleet on its homeworld", () => {
  assert.equal(new Set(Object.values(HOUSE_HOMEWORLDS).map(({ planetId }) => planetId)).size, Object.keys(HOUSES).length);
  for (const houseId of Object.keys(HOUSES)) {
    const state = createGame({ mode: "grand", houseId, planetId: "neptune", seed });
    const { planetId, regionId } = HOUSE_HOMEWORLDS[houseId];
    assert.equal(state.planetId, planetId, houseId);
    const allArmies = playerArmies(state);
    const localArmies = allArmies.filter((army) => army.planetId === planetId);
    const soldiers = (armies) => armies.flatMap((army) => army.squads).reduce((count, squad) => count + squad.soldiers, 0);
    assert.ok(localArmies.length >= 2, houseId);
    assert.ok(soldiers(localArmies) >= soldiers(allArmies) * 0.75, houseId);
    assert.ok(localArmies.every((army) => friendlyRegion(state, army.regionId)), houseId);
    assert.ok(friendlyRegion(state, regionId), houseId);
    assert.ok(state.planets[planetId].regions[regionId].buildings.barracks, houseId);
    assert.ok(state.planets[planetId].regions[regionId].buildings.spaceport, houseId);
    assert.ok(localArmies.some((army) => army.regionId === regionId), houseId);
    const homeFleet = Object.values(state.fleets).find((fleet) =>
      fleet.houseId === houseId && fleet.planetId === planetId && fleet.regionId === regionId,
    );
    assert.ok(homeFleet?.ships.transport > 0 && homeFleet?.ships.assault > 0, houseId);
  }
});

function musterFixture() {
  const state = isolatedControl();
  const regionId = HOUSE_HOMEWORLDS[state.houseId].regionId;
  const region = state.planets[REGIONS[regionId].planetId].regions[regionId];
  region.owner = state.houseId;
  region.buildings.barracks = 1;
  return { state, region, regionId };
}

function rifleOption(state, regionId) {
  return getRecruitmentOptions(state, regionId).options.find(({ id }) => id === "rifle");
}

function assertPaid(after, before, cost) {
  for (const key of RESOURCE_KEYS) assertClose(after[key], before[key] - (cost[key] ?? 0), key);
}

test("recruitment at an empty territory charges the displayed price and musters a local army", () => {
  const { state, regionId } = musterFixture();
  const options = getRecruitmentOptions(state, regionId);
  const entry = rifleOption(state, regionId);
  assert.ok(options.eligible && entry?.eligible);
  assert.ok(entry.duration > 0);
  assert.deepEqual(fieldArmiesAt(state, regionId), []);
  const resources = { ...state.resources[state.houseId] };
  issue(state, { type: "recruitAt", regionId, unitType: entry.id });
  assertPaid(state.resources[state.houseId], resources, entry.cost);
  const [project] = state.projects;
  assert.equal(project.regionId, regionId);
  assert.equal(project.item, entry.id);
  assertClose(project.remaining, entry.duration, "displayed duration");
  assert.deepEqual(fieldArmiesAt(state, regionId), []);
  advanceUntil(state, () => fieldArmiesAt(state, regionId).length > 0, entry.duration + 2);
  const [army] = fieldArmiesAt(state, regionId);
  assert.equal(army.planetId, REGIONS[regionId].planetId);
  const rifle = army.squads.find(({ type }) => type === "rifle");
  assert.equal(rifle?.soldiers, UNIT_TYPES.rifle.maxSoldiers);
  assert.equal(state.projects.some(({ id }) => id === project.id), false);
});

test("territory recruitment explains unmet ownership, barracks, and resource requirements before charging", () => {
  const { state, region, regionId } = musterFixture();
  const action = { type: "recruitAt", regionId, unitType: "rifle" };
  const wallet = state.resources[state.houseId];
  const original = { ...wallet };
  region.owner = "bellona";
  assert.equal(getRecruitmentOptions(state, regionId).eligible, false);
  assert.equal(command(state, action).ok, false);
  region.owner = state.houseId;
  region.buildings.barracks = 0;
  const withoutBarracks = getRecruitmentOptions(state, regionId);
  assert.equal(withoutBarracks.eligible, false);
  assert.match(withoutBarracks.reason, /barracks/i);
  assert.equal(command(state, action).ok, false);
  assert.deepEqual(wallet, original);
  issue(state, { type: "build", regionId, buildingId: "barracks" });
  advanceUntil(state, () => region.buildings.barracks > 0, 20);
  assert.equal(rifleOption(state, regionId)?.eligible, true);
  const expense = rifleOption(state, regionId).cost;
  const key = RESOURCE_KEYS.find((resource) => expense[resource] > 0);
  assert.ok(key);
  wallet[key] = 0;
  const balance = { ...wallet };
  const unaffordable = rifleOption(state, regionId);
  assert.equal(unaffordable.eligible, false);
  assert.ok(unaffordable.reason);
  assert.equal(command(state, action).ok, false);
  assert.deepEqual(wallet, balance);
  assert.deepEqual(state.projects, []);
});

test("construction and ship quotes match the charge, including the next queued building tier", () => {
  const { state, region, regionId } = musterFixture();
  const wallet = state.resources[state.houseId];
  const construction = { type: "build", regionId, buildingId: "barracks" };
  const upgrade = getPurchaseQuote(state, construction);
  const tierCost = (tier) => Object.fromEntries(Object.entries(BUILDINGS.barracks.cost).map(([key, amount]) => [key, amount * tier]));
  assert.ok(upgrade.eligible && upgrade.duration > 0);
  assert.deepEqual(upgrade.cost, tierCost(2));
  const initial = { ...wallet };
  issue(state, construction);
  assertPaid(wallet, initial, upgrade.cost);
  const next = getPurchaseQuote(state, construction);
  assert.deepEqual(next.cost, tierCost(3));
  assert.ok(next.duration > upgrade.duration);

  const shipbuilding = { type: "buildShip", regionId, shipType: "corvette" };
  const ship = getPurchaseQuote(state, shipbuilding);
  assert.ok(ship.eligible && ship.duration > 0);
  assert.deepEqual(ship.cost, SHIPS.corvette.cost);
  const remaining = { ...wallet };
  issue(state, shipbuilding);
  assertPaid(wallet, remaining, ship.cost);
  assertClose(state.projects.find(({ item }) => item === "corvette").duration, ship.duration, "ship quote duration");
  advanceUntil(state, () => state.projects.length === 0, Math.max(upgrade.duration, ship.duration) + 2);
  assert.equal(region.buildings.barracks, 2);
  assert.equal(Object.values(state.fleets).find((fleet) => fleet.regionId === regionId)?.ships.corvette, 1);
});

test("a queued squad joins a stationary local army after save and reload", () => {
  const { state, regionId } = musterFixture();
  const action = { type: "recruitAt", regionId, unitType: "rifle" };
  issue(state, action);
  advanceUntil(state, () => fieldArmiesAt(state, regionId).length > 0, 15);
  const [army] = fieldArmiesAt(state, regionId);
  const squadCount = army.squads.length;
  issue(state, { ...action, armyId: army.id });
  advance(state, 0.5);
  const [pending] = state.projects;
  assert.ok(pending.remaining > 0);
  const storage = storageFixture();
  assert.equal(saveGame(state, storage).ok, true);
  const restored = loadGame(storage);
  assert.deepEqual(restored.projects, state.projects);
  advance(restored, pending.remaining + 0.5);
  advance(state, pending.remaining + 0.5);
  assert.deepEqual(restored.armies, state.armies);
  assert.deepEqual(restored.resources, state.resources);
  assert.equal(fieldArmiesAt(restored, regionId).length, 1);
  assert.equal(restored.armies[army.id].squads.length, squadCount + 1);
  assert.deepEqual(restored.projects, []);
});

test("the advertised queue time includes earlier squads at the same barracks", () => {
  const { state, regionId } = musterFixture();
  const option = rifleOption(state, regionId);
  const action = { type: "recruitAt", regionId, unitType: option.id };
  assert.equal(getRecruitmentOptions(state, regionId).queuedSeconds, 0);
  issue(state, action);
  advance(state, 0.4);
  issue(state, action);
  const [first, second] = state.projects;
  assertClose(getRecruitmentOptions(state, regionId).queuedSeconds, first.remaining + second.remaining, "queued time");
  const waiting = second.remaining;
  advance(state, 0.1);
  assertClose(second.remaining, waiting, "second squad waits its turn");
  advanceUntil(state, () => state.projects.length === 0, option.duration * 2 + 2);
  assert.equal(fieldArmiesAt(state, regionId).length, 1);
  assert.equal(fieldArmiesAt(state, regionId)[0].squads.filter(({ type }) => type === option.id).length, 2);
});

test("recruits stay at their territory if their assigned army marches away", () => {
  const { state, regionId } = musterFixture();
  const action = { type: "recruitAt", regionId, unitType: "rifle" };
  issue(state, action);
  advanceUntil(state, () => fieldArmiesAt(state, regionId).length > 0, 15);
  const [army] = fieldArmiesAt(state, regionId);
  const roster = structuredClone(army.squads);
  const destinationId = REGIONS[regionId].neighbors[0];
  const world = state.planets[REGIONS[regionId].planetId];
  world.regions[destinationId].owner = state.houseId;
  issue(state, { ...action, armyId: army.id });
  issue(state, { type: "move", armyId: army.id, regionId: destinationId });
  advanceUntil(state, () => army.regionId === destinationId && state.projects.length === 0, 15);
  assert.deepEqual(army.squads, roster);
  const replacements = fieldArmiesAt(state, regionId);
  assert.equal(replacements.length, 1);
  assert.notEqual(replacements[0].id, army.id);
  assert.ok(replacements[0].squads.some(({ type }) => type === "rifle"));
});

test("losing a territory cancels its recruitment even if the former owner recaptures it", () => {
  const { state, region, regionId } = musterFixture();
  issue(state, { type: "recruitAt", regionId, unitType: "rifle" });
  advance(state, 0.5);
  region.owner = "bellona";
  advance(state, 0.1);
  assert.deepEqual(state.projects, []);
  assert.ok(state.alerts.some(({ message }) => message.includes("Training lost after enemy capture")));
  region.owner = state.houseId;
  advance(state, 9);
  assert.deepEqual(fieldArmiesAt(state, regionId), []);
});

test("a live battle pauses a territory's queued recruits until control is secure", () => {
  const { state, regionId } = musterFixture();
  issue(state, { type: "recruitAt", regionId, unitType: "rifle" });
  advance(state, 0.4);
  const workRemaining = state.projects[0].remaining;
  const battle = createBattle({
    id: "muster-siege", planetId: REGIONS[regionId].planetId, regionId, terrain: REGIONS[regionId].terrain, seed,
    armies: [
      { id: "defenders", houseId: state.houseId, squads: [createSquad("rifle", "defending-rifle")] },
      { id: "attackers", houseId: "bellona", squads: [createSquad("rifle", "attacking-rifle")] },
    ],
  });
  state.battles[battle.id] = battle;
  advance(state, 0.8);
  assert.equal(battle.winner, null);
  assertClose(state.projects[0].remaining, workRemaining, "paused training");
  battle.winner = state.houseId;
  advanceUntil(state, () => fieldArmiesAt(state, regionId).length > 0, workRemaining + 2);
});

test("campaign, planetary, and skirmish modes initialize distinct playable states", () => {
  const grand = createGame({ mode: "grand", seed });
  const planetary = createGame({ mode: "planetary", planetId: "mars", seed });
  const skirmish = createGame({ mode: "skirmish", seed });

  assert.equal(grand.mode, "grand");
  assert.ok(grand.planets.mars && grand.planets.luna);
  assert.ok(playerArmies(grand).length);
  assert.equal(planetary.mode, "planetary");
  assert.ok(planetary.planets.mars);
  assert.ok(playerArmies(planetary).every((army) => army.planetId === "mars"));
  assert.equal(skirmish.mode, "skirmish");
  const battle = activeBattle(skirmish);
  assert.ok(battle);
  assert.ok(liveSquads(battle, skirmish.houseId).length);
  assert.ok(battle.squads.some((squad) => squad.houseId !== skirmish.houseId && squad.soldiers > 0));
});

test("all eight planets and three moons offer conquest maps, spaceports, and fleet links", () => {
  const grand = createGame({ mode: "grand", seed });
  const worldIds = [...planetIds, ...moonIds];
  for (const planetId of worldIds) {
    const world = grand.planets[planetId];
    assert.ok(world, `${planetId} is missing from Grand Conquest`);
    assert.ok(PLANETS[planetId].regionIds.length > 1, `${planetId} needs playable territories`);
    assert.ok(Object.values(world.regions).some((region) => region.buildings.spaceport > 0), planetId);
    const planetary = createGame({ mode: "planetary", planetId, seed });
    assert.deepEqual(Object.keys(planetary.planets), [planetId]);
    assert.ok(playerArmies(planetary).some((army) => army.planetId === planetId), planetId);
  }
  const reachable = new Set();
  const queued = [planetIds[0]];
  for (const worldId of queued) {
    if (reachable.has(worldId)) continue;
    reachable.add(worldId);
    for (const [from, to] of FLEET_ROUTES) {
      assert.ok(grand.planets[from] && grand.planets[to], `${from}-${to} has an inoperable endpoint`);
      if (worldId === from) queued.push(to);
      else if (worldId === to) queued.push(from);
    }
  }
  assert.ok(worldIds.every((worldId) => reachable.has(worldId)), "Fleet lanes should reach every playable world");
});

test("a planet's economy multiplies actual income from held territories", () => {
  const economyProfiles = new Set();
  for (const planetId of [...planetIds, ...moonIds]) {
    const state = isolatedControl();
    const world = WORLD_ECONOMIES[planetId];
    assert.ok(world?.name && world.description && world.reward, planetId);
    assert.ok(state.planets[planetId].regions[world.musterRegionId], `${planetId} needs a valid muster region`);
    const profile = RESOURCE_KEYS.map((key) => world.multipliers[key] ?? 1);
    assert.ok(profile.every((value) => Number.isFinite(value) && value > 0), planetId);
    economyProfiles.add(profile.join(","));

    const region = state.planets[planetId].regions[world.musterRegionId];
    const { colors } = REGIONS[region.id];
    region.owner = state.houseId;
    region.buildings.mine = 2;
    const base = {
      credits: 1.2 + (colors.includes("silver") ? 2 : 0) + (colors.includes("copper") ? 1 : 0),
      materials: region.buildings.mine * (colors.includes("red") ? 3 : 1.7),
      supplies: colors.includes("brown") ? 3.5 : 1,
      influence: colors.includes("white") ? 1.6 : 0.4,
    };
    const houseBonus = HOUSES[state.houseId].bonus.production ?? {};
    const before = { ...state.resources[state.houseId] };
    advance(state, 2);
    for (const key of RESOURCE_KEYS) {
      const income = base[key] * (world.multipliers[key] ?? 1) * (houseBonus[key] ?? 1);
      assertClose(state.resources[state.houseId][key] - before[key], income, `${planetId} ${key}`);
    }
  }
  assert.equal(economyProfiles.size, planetIds.length + moonIds.length);
});

test("world control pays at the campaign cycle and survives reload without double payment", () => {
  const rim = PLANET_GROUPS.rim;
  const worldId = rim.worldIds.find((id) => WORLD_ECONOMIES[id].reward.squads?.obsidian > 0);
  assert.ok(worldId, "A single Rim world should be able to muster Obsidian troops");
  const state = isolatedControl([worldId]);
  const economy = WORLD_ECONOMIES[worldId];
  const planet = getPlanetControl(state, worldId);
  assert.equal(planet.owner, state.houseId);
  assert.equal(planet.counts[state.houseId], planet.total);
  const { interval, cycle, secondsRemaining, worlds, groups } = getControlBonusStatus(state);
  assert.equal(interval, 30);
  assert.equal(cycle, 0);
  assert.equal(secondsRemaining, 30);
  assert.deepEqual(worlds, [worldId]);
  assert.deepEqual(groups, []);
  assertFirstCycleRewards(state, [economy]);
  assert.ok(playerArmies(state).every((army) => army.regionId === economy.musterRegionId));

  const storage = storageFixture();
  assert.equal(saveGame(state, storage).ok, true);
  const restored = loadGame(storage);
  assert.equal(getControlBonusStatus(restored).cycle, 1);
  const firstPayout = { ...state.resources[state.houseId] };
  advance(restored, 0.1);
  assert.deepEqual(restored.resources[state.houseId], firstPayout);
  assert.deepEqual(squadCounts(restored), economy.reward.squads);
  advance(restored, 29.9);
  advance(state, 30);
  assert.deepEqual(restored.resources, state.resources);
  assert.deepEqual(restored.armies, state.armies);
  assert.deepEqual(squadCounts(restored), expectedRewards([economy, economy]).squads);
  assert.equal(getControlBonusStatus(restored).cycle, 2);
});

test("full Core and Rim groups pay alongside their member worlds", () => {
  const core = PLANET_GROUPS.core;
  const rim = PLANET_GROUPS.rim;
  assert.ok(core && rim);
  assert.deepEqual([...core.worldIds].sort(), ["earth", "luna", "mars", "mercury", "venus"]);
  assert.deepEqual([...rim.worldIds].sort(), ["io", "jupiter", "neptune", "saturn", "titan", "uranus"]);
  assert.ok(rim.reward.squads.obsidian > Math.max(...rim.worldIds.map((id) => WORLD_ECONOMIES[id].reward.squads?.obsidian ?? 0)));

  for (const group of [core, rim]) {
    const state = isolatedControl(group.worldIds);
    const control = getGroupControl(state, group.id);
    assert.equal(control.owner, state.houseId);
    assert.equal(control.counts[state.houseId], group.worldIds.length);
    assert.ok(group.worldIds.every((id) => control.worlds[id] === state.houseId));
    const ownedGroups = Object.values(PLANET_GROUPS).filter(
      (candidate) => candidate.worldIds.every((id) => group.worldIds.includes(id)),
    );
    assert.deepEqual(new Set(getControlBonusStatus(state).groups), new Set(ownedGroups.map(({ id }) => id)));
    assertFirstCycleRewards(state, [...group.worldIds.map((id) => WORLD_ECONOMIES[id]), ...ownedGroups]);
  }
});

test("neutral and contested territories block world and group rewards", () => {
  for (const outsider of [null, "bellona"]) {
    const rim = PLANET_GROUPS.rim;
    const disputedWorld = rim.worldIds.find((id) => WORLD_ECONOMIES[id].reward.squads?.obsidian);
    const state = isolatedControl(rim.worldIds);
    const world = state.planets[disputedWorld];
    world.regions[WORLD_ECONOMIES[disputedWorld].musterRegionId].owner = outsider;
    const control = getPlanetControl(state, disputedWorld);
    assert.equal(control.owner, null);
    assert.equal(control.counts[state.houseId], control.total - 1);
    assert.equal(getGroupControl(state, rim.id).owner, null);
    const next = getControlBonusStatus(state);
    assert.ok(!next.worlds.includes(disputedWorld));
    assert.ok(!next.groups.includes(rim.id));
    assertFirstCycleRewards(state, [
      ...next.worlds.map((id) => WORLD_ECONOMIES[id]),
      ...next.groups.map((id) => PLANET_GROUPS[id]),
    ]);
  }
});

test("a live battle disputes control even before a territory changes owners", () => {
  const group = PLANET_GROUPS.rim;
  const state = isolatedControl(group.worldIds);
  const planetId = "neptune";
  const regionId = WORLD_ECONOMIES[planetId].musterRegionId;
  const battle = createBattle({
    id: "control-dispute", planetId, regionId, terrain: REGIONS[regionId].terrain, seed,
    armies: [
      { id: "home", houseId: state.houseId, squads: [createSquad("rifle", "home-squad")] },
      { id: "invasion", houseId: "bellona", squads: [createSquad("rifle", "invader-squad")] },
    ],
  });
  state.battles[battle.id] = battle;
  const contested = getPlanetControl(state, planetId);
  assert.equal(contested.counts[state.houseId], contested.total);
  assert.equal(contested.owner, null);
  assert.equal(getGroupControl(state, group.id).owner, null);
  battle.winner = state.houseId;
  assert.equal(getPlanetControl(state, planetId).owner, state.houseId);
  assert.equal(getGroupControl(state, group.id).owner, state.houseId);
});

test("pre-expansion Grand Conquest saves gain new worlds and preserve active transports", () => {
  const state = createGame({ mode: "grand", seed });
  const { army, fleet } = launchFixture(state);
  const oldPort = "luna-dawn-port";
  delete state.armies[army.id];
  army.id = "augustus-luna";
  state.armies[army.id] = army;
  army.planetId = fleet.planetId = "luna";
  army.regionId = fleet.regionId = oldPort;
  state.planets.luna.regions[oldPort].owner = state.houseId;
  issue(state, {
    type: "transport", armyId: army.id, fleetId: fleet.id,
    planetId: "mars", regionId: "mars-arsia-port", landing: "spaceport",
  });
  advance(state, 0.6);
  const carrier = state.fleets[fleet.id];
  assert.ok(carrier);
  const legacy = Object.fromEntries([
    "version", "houseId", "mode", "difficulty", "seed", "planetId", "elapsed", "tick", "carry", "serial", "speed",
    "planets", "armies", "fleets", "battles", "alerts", "projects", "resources", "relations", "victory", "aiTurn",
  ].map((key) => [key, structuredClone(state[key])]));
  legacy.version = 1;
  legacy.elapsed = 45.2;
  legacy.tick = 452;
  legacy.planets = Object.fromEntries(legacyWorldIds.map((id) => [id, legacy.planets[id]]));
  legacy.armies = Object.fromEntries(Object.entries(legacy.armies).filter(([, army]) => legacyWorldIds.includes(army.planetId) || army.id === carrier.armyId));
  legacy.fleets = Object.fromEntries(Object.entries(legacy.fleets).filter(([, fleet]) => legacyWorldIds.includes(fleet.planetId) || fleet.id === carrier.id));
  legacy.planets.mars.regions["mars-arsia-port"].buildings.mine = 3;
  for (const region of Object.values(legacy.planets.io.regions)) region.owner = state.houseId;

  const storage = storageFixture();
  storage.setItem("war-of-the-gold-houses:2", JSON.stringify({ savedAt: 45_200, state: legacy }));
  const restored = loadGame(storage, 2);
  assert.ok(restored, "A version 1 campaign should remain visible and loadable");
  assert.ok(getSaveSlots(storage).some((entry) => entry.slot === 2 && entry.mode === "grand"));
  assert.ok([...planetIds, ...moonIds].every((id) => restored.planets[id]?.regions));
  assert.equal(restored.planets.mars.regions["mars-arsia-port"].buildings.mine, 3);
  assert.deepEqual(restored.fleets[carrier.id], legacy.fleets[carrier.id]);
  assert.deepEqual(restored.armies[carrier.armyId], legacy.armies[carrier.armyId]);
  assert.deepEqual(restored.resources, legacy.resources);
  assert.equal(getControlBonusStatus(restored).cycle, 1);
  assertClose(getControlBonusStatus(restored).secondsRemaining, 14.8, "migrated cycle clock");
  advance(restored, 0.1);
  assert.deepEqual(restored.resources, legacy.resources, "Migration must not replay the first control payout");
  assert.ok(restored.fleets[carrier.id].transit.elapsed > carrier.transit.elapsed);
});

test("tactical commands preserve identity and ordering while squads move", () => {
  const state = createGame({ mode: "skirmish", seed });
  const battle = activeBattle(state);
  const squad = liveSquads(battle, state.houseId)[0];
  const initialPosition = position(squad);
  const destination = openPoint(battle, squad);
  const order = (value, queue = false) => issue(state, {
    type: "orderSquads", battleId: battle.id, squadIds: [squad.id], order: value, queue,
  });

  order({ type: "formation", formation: "column" });
  assert.equal(squad.formation, "column");
  order({ type: "move", ...destination });
  order({ type: "hold" }, true);
  assert.deepEqual(squad.orders.map((item) => item.type), ["move", "hold"]);
  advance(state, 0.6);
  assert.notDeepEqual(position(squad), initialPosition);
  assert.equal(battle.squads.find((candidate) => candidate.id === squad.id), squad);
  advanceUntil(state, () => squad.orders[0]?.type !== "move", 15);
  assert.ok(Math.hypot(squad.x - destination.x, squad.y - destination.y) < 35);
  assert.ok(squad.soldiers > 0);
});

test("tactical pathfinding detours around an obstacle and reaches the ordered destination", () => {
  const battle = createBattle({
    id: "pathfinding", terrain: "desert", seed,
    armies: [
      { id: "scouts", houseId: "augustus", squads: [createSquad("rifle", "pathfinder")] },
      { id: "guards", houseId: "bellona", squads: [createSquad("rifle", "sentinel")] },
    ],
  });
  const [scouts, guards] = battle.squads;
  const destination = { x: 590, y: scouts.y };
  assert.ok(battle.obstacles.some((obstacle) =>
    obstacle.x > scouts.x && obstacle.x + obstacle.w < destination.x &&
    destination.y > obstacle.y && destination.y < obstacle.y + obstacle.h,
  ));
  assert.equal(issueOrder(battle, guards.houseId, [guards.id], { type: "hold" }), 1);
  assert.equal(issueOrder(battle, scouts.houseId, [scouts.id], { type: "move", ...destination }), 1);
  let deflection = 0;
  for (let tick = 0; tick < 240; tick += 1) {
    tickBattle(battle, 0.05);
    deflection = Math.max(deflection, Math.abs(scouts.y - destination.y));
    assert.ok(battle.obstacles.every((obstacle) =>
      scouts.x < obstacle.x || scouts.x > obstacle.x + obstacle.w ||
      scouts.y < obstacle.y || scouts.y > obstacle.y + obstacle.h,
    ));
  }
  assert.ok(deflection > 30);
  assert.ok(Math.hypot(scouts.x - destination.x, scouts.y - destination.y) < 10);
});

test("camera-independent battle simulation is reproducible across clock updates", () => {
  const foreground = createGame({ mode: "skirmish", seed });
  const background = createGame({ mode: "skirmish", seed });
  const battle = activeBattle(foreground);
  const squad = liveSquads(battle, foreground.houseId)[0];
  const destination = openPoint(battle, squad);
  const action = {
    type: "orderSquads", battleId: battle.id, squadIds: [squad.id],
    order: { type: "move", ...destination },
  };
  issue(foreground, action);
  issue(background, action);
  for (let update = 0; update < 50; update += 1) {
    const inspected = activeBattle(foreground);
    assert.ok(inspected.squads.length > 1);
    advance(foreground, 0.1);
  }
  advance(background, 5);
  assert.deepEqual(foreground.battles, background.battles);
  assert.equal(foreground.elapsed, background.elapsed);
});

test("planetary route preview matches delayed army travel", () => {
  const state = createGame({ mode: "grand", seed });
  const candidate = playerArmies(state).find(
    (army) => REGIONS[army.regionId].neighbors.some((id) => friendlyRegion(state, id)),
  );
  assert.ok(candidate, "A starting army needs an adjacent friendly territory");
  const originId = candidate.regionId;
  const destination = REGIONS[originId].neighbors.find((id) => friendlyRegion(state, id));
  const route = previewRoute(state, candidate.id, destination);
  assert.ok(route?.eta > 0);
  assert.deepEqual(route.path, [destination]);
  assert.ok(getSupplyStatus(state, candidate.id));
  issue(state, { type: "move", armyId: candidate.id, regionId: destination });
  assert.equal(candidate.regionId, originId);
  advance(state, 0.1);
  assert.equal(candidate.regionId, originId);
  advanceUntil(state, () => candidate.regionId === destination, route.eta + 2);
  assert.equal(candidate.planetId, REGIONS[destination].planetId);
});

function launchFixture(state) {
  const army = playerArmies(state).find((candidate) =>
    Object.values(state.fleets).some((fleet) =>
      fleet.houseId === state.houseId && fleet.planetId === candidate.planetId &&
      fleet.regionId === candidate.regionId && !fleet.transit && (fleet.ships.transport ?? 0) > 0,
    ) && state.planets[candidate.planetId].regions[candidate.regionId].buildings.spaceport,
  );
  assert.ok(army, "A starting army and an orbital transport fleet need a common friendly port");
  const fleet = Object.values(state.fleets).find((candidate) =>
    candidate.houseId === state.houseId && candidate.planetId === army.planetId &&
    candidate.regionId === army.regionId && !candidate.transit && (candidate.ships.transport ?? 0) > 0,
  );
  const friendlyPort = Object.values(state.planets)
    .filter((planet) => planet.id !== army.planetId)
    .flatMap((planet) => Object.values(planet.regions))
    .find((region) => region.owner === state.houseId && region.buildings.spaceport);
  if (friendlyPort) return { army, fleet, destination: friendlyPort.id, landing: "spaceport" };

  const otherWorld = Object.values(PLANETS).find(
    (planet) => planet.id !== army.planetId && state.planets[planet.id]?.regions && planet.regionIds.length,
  );
  assert.ok(otherWorld);
  return { army, fleet, destination: otherWorld.regionIds[0], landing: "rain" };
}

test("a fleet can land a ground force at a Neptune spaceport and the army can continue overland", () => {
  const state = createGame({ mode: "grand", seed });
  const { army, fleet } = launchFixture(state);
  state.fleets = { [fleet.id]: fleet };
  state.armies = { [army.id]: army };
  for (const world of Object.values(state.planets)) {
    for (const region of Object.values(world.regions)) {
      if (region.owner !== state.houseId) region.owner = null;
    }
  }
  const port = Object.values(state.planets.neptune.regions).find((region) => region.buildings.spaceport > 0);
  port.owner = state.houseId;
  issue(state, {
    type: "transport", armyId: army.id, fleetId: fleet.id, planetId: "neptune", regionId: port.id,
    landing: "spaceport",
  });
  assert.ok(fleet.transit && fleet.transit.duration > 0);
  const eta = fleet.transit.duration;
  advanceUntil(state, () => army.regionId === port.id, eta + 15);
  assert.equal(army.planetId, "neptune");
  assert.equal(army.fleetId, null);

  const destination = REGIONS[port.id].neighbors[0];
  const route = previewRoute(state, army.id, destination);
  assert.deepEqual(route.path, [destination]);
  issue(state, { type: "move", armyId: army.id, regionId: destination });
  advanceUntil(state, () => army.regionId === destination, route.eta + 2);
  assert.equal(state.planets.neptune.regions[destination].owner, state.houseId);
});

test("ships enforce capacity and transports resume their recorded position on reload", () => {
  const state = createGame({ mode: "grand", seed });
  const { army, fleet, destination, landing } = launchFixture(state);
  const origin = army.planetId;
  const action = {
    type: "transport", armyId: army.id, fleetId: fleet.id, planetId: REGIONS[destination].planetId,
    regionId: destination, landing,
  };

  const originalShips = fleet.ships;
  const startingResources = { ...state.resources[state.houseId] };
  fleet.ships = { corvette: 1 };
  assert.equal(command(state, action).ok, false);
  assert.equal(army.planetId, origin);
  assert.ok(!fleet.transit);
  assert.deepEqual(state.resources[state.houseId], startingResources);
  fleet.ships = originalShips;

  const quotedSupplies = transportSupplyCost(state, army, landing);
  issue(state, action);
  assert.equal(state.resources[state.houseId].supplies, startingResources.supplies - quotedSupplies);
  assert.ok(fleet.transit);
  assert.notEqual(army.planetId, action.planetId);
  advance(state, 0.6);
  assert.ok(fleet.transit.elapsed > 0);
  assert.ok(fleet.transit.elapsed < fleet.transit.duration);
  const storage = storageFixture();
  assert.equal(saveGame(state, storage, 2).ok, true);
  assert.ok(getSaveSlots(storage).some((entry) => entry.slot === 2 && entry.mode === "grand"));
  assert.equal(loadGame(storage, 1), null);
  const restored = loadGame(storage, 2);
  assert.deepEqual(restored.fleets[fleet.id], fleet);
  assert.deepEqual(restored.armies[army.id], army);
  advance(state, 1);
  advance(restored, 1);
  assert.deepEqual(restored.fleets[fleet.id], state.fleets[fleet.id]);
  assert.deepEqual(restored.armies[army.id], state.armies[army.id]);
  const travelTime = fleet.transit.duration;
  advanceUntil(restored, () => restored.armies[army.id]?.regionId === destination, travelTime + 15);
  assert.equal(restored.armies[army.id].planetId, action.planetId);
  assert.ok(!restored.armies[army.id].fleetId);
  assert.ok(!restored.fleets[fleet.id].armyId);
});

test("a Mars ground battle continues while a fleet carries another army to Luna", () => {
  const state = createGame({ mode: "grand", houseId: "augustus", seed });
  const { army: invasionArmy, fleet } = launchFixture(state);
  const marsArmy = playerArmies(state).find((army) => army.id !== invasionArmy.id && army.planetId === "mars");
  assert.ok(marsArmy);
  const front = "mars-elysium";
  state.planets.mars.regions[front].owner = "bellona";
  const route = previewRoute(state, marsArmy.id, front);
  assert.ok(route?.eta > 0);
  issue(state, { type: "move", armyId: marsArmy.id, regionId: front });
  advanceUntil(state, () => Boolean(marsArmy.battleId), route.eta + 8);
  const battle = state.battles[marsArmy.battleId];
  assert.equal(battle.regionId, front);
  assert.equal(battle.winner, null);
  issue(state, { type: "doctrine", armyId: marsArmy.id, doctrine: "cautious" });
  assert.equal(battle.armies.find((army) => army.id === marsArmy.id).doctrine, "cautious");

  const order = { type: "hold" };
  const squad = liveSquads(battle, state.houseId)[0];
  issue(state, { type: "orderSquads", battleId: battle.id, squadIds: [squad.id], order });
  const battleTime = battle.elapsed;
  issue(state, {
    type: "transport", armyId: invasionArmy.id, fleetId: fleet.id, planetId: "luna",
    regionId: "luna-dawn-port", landing: "spaceport",
  });
  const carrier = state.fleets[fleet.id];
  assert.ok(carrier?.transit);
  assert.equal(battle.elapsed, battleTime);
  advance(state, 0.8);
  assert.ok(carrier.transit.elapsed > 0);
  assert.ok(battle.elapsed > battleTime);
  assert.equal(battle.squads.find((candidate) => candidate.id === squad.id), squad);

  const storage = storageFixture();
  assert.equal(saveGame(state, storage, "auto").ok, true);
  const restored = loadGame(storage, "auto");
  assert.deepEqual(restored.battles[battle.id], battle);
  assert.deepEqual(restored.fleets[carrier.id], carrier);
});

test("live battle save restores commands, casualties, positions, and deterministic progress", () => {
  const state = createGame({ mode: "skirmish", seed });
  const battle = activeBattle(state);
  const squad = liveSquads(battle, state.houseId)[0];
  const enemy = battle.squads.find((candidate) => candidate.houseId !== state.houseId);
  issue(state, {
    type: "orderSquads", battleId: battle.id, squadIds: [squad.id],
    order: { type: "attack", targetId: enemy.id },
  });
  advanceUntil(state, () => battle.squads.some((candidate) => candidate.soldiers < candidate.maxSoldiers), 25);
  assert.equal(battle.winner, null);
  const storage = storageFixture();
  assert.equal(saveGame(state, storage, 3).ok, true);
  const restored = loadGame(storage, 3);
  assert.deepEqual(restored.battles[battle.id], battle);
  assert.deepEqual(restored.armies, state.armies);
  advance(state, 12);
  advance(restored, 12);
  assert.deepEqual(restored.battles[battle.id], state.battles[battle.id]);
  assert.deepEqual(restored.armies, state.armies);
});

test("a skirmish resolves once and preserves surviving soldiers, wounds, and experience", () => {
  const state = createGame({ mode: "skirmish", seed });
  const battle = activeBattle(state);
  const survivor = liveSquads(battle, state.houseId).find((squad) => squad.soldiers > 1);
  const remaining = survivor.soldiers - 1;
  const damage = 7;
  const remainingHp = remaining * UNIT_TYPES[survivor.type].hp - damage;
  survivor.soldiers = remaining;
  survivor.hp = remainingHp;
  for (const squad of battle.squads) {
    if (squad.houseId !== state.houseId) {
      squad.soldiers = 0;
      squad.hp = 0;
    }
  }
  assert.equal(state.victory, null);
  advanceUntil(state, () => state.victory, 3);
  assert.equal(battle.winner, state.houseId);
  assert.equal(state.victory.houseId, state.houseId);

  const army = state.armies[survivor.armyId];
  const rosterEntry = army.squads.find((squad) => squad.id === survivor.id);
  assert.equal(rosterEntry.soldiers, remaining);
  assert.ok(rosterEntry.xp > 0);
  const redeployment = createBattle({
    id: "redeployment", terrain: "desert", seed,
    armies: [army, { id: "fresh-rival", houseId: "bellona", squads: [createSquad("rifle", "fresh-rifle")] }],
  });
  const redeployed = redeployment.squads.find((squad) => squad.id === survivor.id);
  assert.equal(redeployed.soldiers, remaining);
  assert.equal(redeployed.hp, remainingHp);

  const result = structuredClone(state.victory);
  advance(state, 2);
  assert.deepEqual(state.victory, result);
});
