import { FLOWERS, NEEDS, POTS } from './levels.mjs';
import { canReachTarget, getPlantNeed, getTruckWindow } from './sim.mjs';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toStation(station) {
  return { type: 'target', stationId: station.id };
}

function available(station, state) {
  return !station.busyBy && !station.plantId && station.cooldownUntilMs <= state.elapsedMs;
}

function compareDeadlines(a, b) {
  const left = a ?? Infinity;
  const right = b ?? Infinity;
  return left === right ? 0 : left - right;
}

function marker({ command, kind, label, actionLabel, flowerId }) {
  return { stationId: command.stationId ?? null, kind, label, primary: true, flowerId, command, actionLabel };
}

function beltGuide(state, player, plant, stations) {
  const choices = state.conveyors.flatMap(belt => {
    const command = { type: 'target', conveyorId: belt.id };
    if (state.plants.some(pot => pot.beltId === belt.id) || !canReachTarget(state, player.id, command)) return [];
    const end = belt.path.at(-1);
    const exitState = { ...state, players: [{ id: player.id, ...end }] };
    const reachable = stations.find(station => canReachTarget(exitState, player.id, toStation(station)));
    if (!reachable) return [];
    return [{ command, cost: distance(player, belt.path[0]) + distance(end, reachable) }];
  }).sort((a, b) => a.cost - b.cost);
  if (!choices.length) return null;
  return marker({
    command: choices[0].command, kind: 'belt', label: 'Belt handoff', actionLabel: 'Send pot', flowerId: plant.flowerId,
  });
}

function carriedGuide(state, player, plant, orders) {
  const need = getPlantNeed(plant, state);
  if (need.kind === 'truck' &&
      (!getTruckWindow(state).open || !orders.some(order => order.flowerId === plant.flowerId))) return null;
  const stationType = NEEDS[need.kind]?.station;
  if (!stationType) return null;
  const stations = state.stations.filter(station => station.type === stationType &&
    (!need.variant || station.variant === need.variant)).sort((a, b) => distance(player, a) - distance(player, b));
  const reachable = stations.filter(station => canReachTarget(state, player.id, toStation(station)));
  const station = reachable.find(candidate => available(candidate, state));
  if (station) {
    return marker({
      command: toStation(station), kind: need.kind, label: need.kind === 'repot' ? POTS[need.variant] : need.label,
      actionLabel: need.label, flowerId: plant.flowerId,
    });
  }
  return reachable.length || !stations.length ? null : beltGuide(state, player, plant, stations);
}

function pickupGuide(state, player, orderedFlowers, matchesOrder) {
  const ready = state.plants.flatMap(plant => {
    if (plant.holderId || plant.beltId || orderedFlowers.has(plant.flowerId) !== matchesOrder) return [];
    const station = state.stations.find(item => item.id === plant.stationId);
    const need = getPlantNeed(plant, state);
    if (station && (station.busyBy || (station.type !== 'shelf' && need.kind !== 'remove'))) return [];
    return [{
      command: station ? toStation(station) : { type: 'target', plantId: plant.id },
      deadline: plant.rootDeadlineMs ?? plant.heatDeadlineMs,
      distance: distance(player, station ?? plant), plant, need,
    }];
  }).sort((a, b) => compareDeadlines(a.deadline, b.deadline) || a.distance - b.distance);
  const choice = ready.find(option => canReachTarget(state, player.id, option.command));
  if (!choice) return null;
  return marker({
    command: choice.command, kind: 'pickup', label: choice.need.kind === 'remove' ? choice.need.label : 'Pick up pot',
    actionLabel: 'Pick up', flowerId: choice.plant.flowerId,
  });
}

function seedGuide(state, player, orders) {
  const stock = new Map();
  function count(flowerId) {
    stock.set(flowerId, (stock.get(flowerId) ?? 0) + 1);
  }
  for (const plant of state.plants) count(plant.flowerId);
  for (const gardener of state.players) {
    if (gardener.action?.kind !== 'sow') continue;
    const tray = state.stations.find(station => station.id === gardener.action.stationId);
    if (tray) count(tray.variant);
  }
  for (const { flowerId } of orders) {
    const remaining = stock.get(flowerId) ?? 0;
    if (remaining > 0) {
      stock.set(flowerId, remaining - 1);
      continue;
    }
    const trays = state.stations.filter(station => station.type === 'seed' && station.variant === flowerId &&
      available(station, state)).sort((a, b) => distance(player, a) - distance(player, b));
    const tray = trays.find(station => canReachTarget(state, player.id, toStation(station)));
    if (tray) {
      return marker({ command: toStation(tray), kind: 'seed', label: 'Empty pot + seed', actionLabel: 'Sow', flowerId });
    }
  }
  return null;
}

export function getStationGuide(state, playerId) {
  if (state?.phase !== 'playing') return [];
  const player = state.players.find(gardener => gardener.id === playerId);
  if (!player || player.action) return [];
  const orders = state.orders.filter(order => order.status === 'open').sort((a, b) =>
    compareDeadlines(a.deadlineMs, b.deadlineMs));
  const plant = state.plants.find(pot => pot.id === player.carryId);
  if (plant && !FLOWERS[plant.flowerId]) return [];
  const orderedFlowers = new Set(orders.map(order => order.flowerId));
  const next = plant ? carriedGuide(state, player, plant, orders) :
    pickupGuide(state, player, orderedFlowers, true) ??
    seedGuide(state, player, orders) ??
    pickupGuide(state, player, orderedFlowers, false);
  return next ? [next] : [];
}
