import test from "node:test";
import assert from "node:assert/strict";
import {
  advance, command, createGame, getSaveSlots, getSupplyStatus, loadGame,
  previewRoute, saveGame,
} from "./game.mjs";
import { COLORS, HOUSES, PLANETS, REGIONS, STARTING_ARMIES } from "./content.mjs";
import { UNIT_TYPES, createBattle, createSquad, issueOrder, tickBattle } from "./battle.mjs";

const seed = 314159;

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
  for (const army of Object.values(STARTING_ARMIES)) {
    assert.ok(HOUSES[army.houseId]);
    assert.ok(REGIONS[army.regionId]);
    assert.ok(army.squads.every((type) => UNIT_TYPES[type]));
  }
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
      !fleet.transit && (fleet.ships.transport ?? 0) > 0,
    ) && state.planets[candidate.planetId].regions[candidate.regionId].buildings.spaceport,
  );
  assert.ok(army, "A starting army and an orbital transport fleet need a common friendly port");
  const fleet = Object.values(state.fleets).find((candidate) =>
    candidate.houseId === state.houseId && candidate.planetId === army.planetId &&
    !candidate.transit && (candidate.ships.transport ?? 0) > 0,
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

  issue(state, action);
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

test("a Mars ground battle continues during a Luna fleet transfer", () => {
  const state = createGame({ mode: "grand", houseId: "augustus", seed });
  const marsArmy = state.armies["augustus-mars"];
  const lunaArmy = state.armies["augustus-luna"];
  const front = "mars-elysium";
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
    type: "transport", armyId: lunaArmy.id, planetId: "mars", regionId: "mars-arsia-port",
    landing: "spaceport",
  });
  const carrier = Object.values(state.fleets).find((fleet) => fleet.armyId === lunaArmy.id);
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
