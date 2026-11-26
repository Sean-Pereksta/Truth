import { FLOWERS, NEEDS, POTS, getLevel } from './levels.mjs';

const SPEED = 3.85;
const INTERACT_REACH = 1.24;
const TAP_REACH = 0.83;
const MAX_EVENTS = 24;
const ACTIVE_BOOTH_TYPES = new Set(['sun', 'moon', 'prism']);
const ROOT_WARNING_MS = 4000;
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function stageFor(plant) {
    return FLOWERS[plant.flowerId].stages[plant.step];
}

function plantById(state, id) {
    return state.plants.find(plant => plant.id === id);
}

function stationById(state, id) {
    return state.stations.find(station => station.id === id);
}

function emit(state, kind, point, playerId = null, stationId = null, text = '') {
    state.events.push({ id: ++state.lastEventId, kind, x: point.x, y: point.y, playerId, stationId, text });
    if (state.events.length > MAX_EVENTS) state.events.shift();
}

function notice(state, player, text) {
    player.notice = { text, untilMs: state.elapsedMs + 1500 };
}

export function getTruckWindow(state) {
    const schedule = getLevel(state.levelId).ships;
    if (!schedule || state.practice) return { open: true, remainingMs: null };
    const timeInCycle = state.elapsedMs % schedule.cycleMs;
    const open = timeInCycle < schedule.openMs;
    return {
        open,
        remainingMs: (open ? schedule.openMs : schedule.cycleMs) - timeInCycle,
    };
}

export function getWeather(state) {
    const weather = getLevel(state.levelId).weather;
    if (!weather) return null;
    const timeInCycle = state.elapsedMs % weather.cycleMs;
    const active = timeInCycle < weather.durationMs;
    return {
        label: weather.label,
        kind: weather.kind,
        active,
        multiplier: active ? 1.25 : 1,
        remainingMs: (active ? weather.durationMs : weather.cycleMs) - timeInCycle,
    };
}

export function getPlantNeed(plant, state) {
    const stage = stageFor(plant);
    const inBooth = plant.stationId && ACTIVE_BOOTH_TYPES.has(stationById(state, plant.stationId)?.type);
    const removing = inBooth && plant.readyAtMs !== null;
    const kind = removing ? 'remove' : stage?.kind ?? 'truck';
    const deadline = plant.heatDeadlineMs ?? plant.rootDeadlineMs;
    const urgent = !state.practice && deadline !== null && deadline - state.elapsedMs <= ROOT_WARNING_MS;
    const variant = kind === 'repot'
        ? FLOWERS[plant.flowerId].pot
        : NEEDS[kind].station === 'ingredient' ? kind : null;
    const progress = removing ? 1 : stage ? clamp(plant.progressMs / stage.durationMs, 0, 1) : 1;
    const label = removing && plant.phase === 'bloom' ? 'Lift bloom' : NEEDS[kind].label;
    return { kind, label, variant, progress, urgent };
}

export function createMatch({ levelId, players = [{ id: 'local', name: 'Gardener' }], practice = false } = {}) {
    const level = getLevel(levelId);
    const state = {
        levelId: level.id,
        practice: Boolean(practice),
        phase: 'playing',
        elapsedMs: 0,
        durationMs: level.durationMs,
        players: [],
        stations: level.stations.map(station => ({ ...station, plantId: null, busyBy: null, cooldownUntilMs: 0 })),
        plants: [],
        orders: [],
        stats: { delivered: 0, premium: 0, missed: 0, score: 0 },
        goals: level.goals.slice(),
        premiumGoal: 0,
        results: null,
        nextPlantId: 1,
        nextOrderId: 1,
        nextOrderMs: 0,
        lastEventId: 0,
        events: [],
    };
    for (const player of players.slice(0, 4)) addPlayer(state, player);
    const extraGardeners = Math.max(0, state.players.length - 1);
    state.goals = state.goals.map((goal, index) => goal + extraGardeners * (index === 2 ? 2 : 1));
    state.premiumGoal = Math.ceil(state.goals[2] * 0.45);
    updateOrders(state, level);
    return state;
}

export function addPlayer(state, { id, name }) {
    if (state.phase !== 'playing' || typeof id !== 'string' || !id || state.players.length >= 4) return false;
    if (state.players.some(player => player.id === id)) return false;
    const seat = [0, 1, 2, 3].find(index => !state.players.some(player => player.seat === index));
    const { x, y } = getLevel(state.levelId).spawns[seat];
    state.players.push({
        id,
        name: String(name || 'Gardener').slice(0, 24),
        seat,
        x,
        y,
        facing: 1,
        carryId: null,
        target: null,
        route: [],
        moveX: 0,
        moveY: 0,
        action: null,
        pending: null,
        notice: null,
    });
    return true;
}

export function removePlayer(state, playerId) {
    const player = state.players.find(gardener => gardener.id === playerId);
    if (!player) return false;
    if (player.action) {
        const station = stationById(state, player.action.stationId);
        if (station?.busyBy === playerId) station.busyBy = null;
    }
    const plant = plantById(state, player.carryId);
    if (plant) {
        plant.repotting = false;
        putDown(state, player, plant);
    }
    state.players = state.players.filter(gardener => gardener.id !== playerId);
    return true;
}

function createPlant(state, player, flowerId) {
    const plant = {
        id: `plant-${state.nextPlantId++}`,
        flowerId,
        step: 0,
        phase: 'seed',
        pot: 'starter',
        quality: 'premium',
        stationId: null,
        holderId: player.id,
        x: player.x,
        y: player.y,
        progressMs: 0,
        readyAtMs: null,
        rootDeadlineMs: null,
        heatDeadlineMs: null,
        rootbound: false,
        heatScorched: false,
        repotting: false,
    };
    state.plants.push(plant);
    player.carryId = plant.id;
    return plant;
}

function advancePlant(plant, level) {
    const stage = stageFor(plant);
    if (stage?.phase) plant.phase = stage.phase;
    plant.step += 1;
    while (level.skipNeeds.includes(stageFor(plant)?.kind)) plant.step += 1;
    plant.progressMs = 0;
}

function takePlant(state, player, plant, station) {
    if (station) {
        station.plantId = null;
        if (ACTIVE_BOOTH_TYPES.has(station.type)) {
            station.cooldownUntilMs = state.elapsedMs + getLevel(state.levelId).cooldownMs;
        }
    }
    player.carryId = plant.id;
    plant.holderId = player.id;
    plant.stationId = null;
    plant.readyAtMs = null;
    plant.heatDeadlineMs = null;
    plant.x = player.x;
    plant.y = player.y;
    emit(state, 'pickup', station ?? player, player.id, station?.id);
}

function putDown(state, player, plant, station = null) {
    if (station) station.plantId = plant.id;
    plant.x = station?.x ?? Math.round(player.x);
    plant.y = station?.y ?? Math.round(player.y);
    plant.stationId = station?.id ?? null;
    plant.holderId = null;
    plant.readyAtMs = null;
    player.carryId = null;
    emit(state, 'place', station ?? plant, player.id, station?.id);
}

function compatibleStage(plant, station) {
    const stage = stageFor(plant);
    if (!stage || NEEDS[stage.kind].station !== station.type) return null;
    if (station.type === 'repot' && station.variant !== FLOWERS[plant.flowerId].pot) return null;
    if (station.type === 'ingredient' && station.variant !== stage.kind) return null;
    return stage;
}

function activeOrder(state, flowerId) {
    return state.orders.find(order => order.status === 'open' && order.flowerId === flowerId);
}

function interactionFor(state, player, station, explicit) {
    if (station.busyBy) return null;
    const carried = plantById(state, player.carryId);
    if (!carried) {
        if (station.plantId) return { kind: 'pickup', plantId: station.plantId };
        if (station.type === 'seed') return { kind: 'sow', durationMs: 520 };
        return null;
    }
    if (station.type === 'shelf' && !station.plantId) return { kind: 'place' };
    if (station.type === 'compost' && explicit) return { kind: 'compost', durationMs: 600 };
    if (station.type === 'truck') {
        if (stageFor(carried) || !getTruckWindow(state).open || !activeOrder(state, carried.flowerId)) return null;
        return { kind: 'deliver', durationMs: 550 };
    }
    const stage = compatibleStage(carried, station);
    if (!stage || station.plantId || state.elapsedMs < station.cooldownUntilMs) return null;
    if (stage.growth) return { kind: 'place' };
    return { kind: stage.kind, durationMs: stage.durationMs };
}

function stationFeedback(state, player, station) {
    if (station.busyBy) return 'In use';
    if (station.plantId && player.carryId) return 'This spot is full';
    if (state.elapsedMs < station.cooldownUntilMs) return 'Booth is venting';
    const plant = plantById(state, player.carryId);
    if (!plant) return 'Pick up a pot first';
    if (station.type === 'seed') return 'Hands full';
    if (station.type === 'truck' && !stageFor(plant)) {
        return getTruckWindow(state).open ? 'No matching order' : 'Truck is away';
    }
    const need = getPlantNeed(plant, state);
    return need.kind === 'repot' ? `Needs ${POTS[need.variant]}` : `Needs ${need.label.toLowerCase()}`;
}

function triggerStation(state, player, station, explicit = true) {
    const interaction = interactionFor(state, player, station, explicit);
    if (!interaction) {
        if (explicit) notice(state, player, stationFeedback(state, player, station));
        return false;
    }
    if (interaction.kind === 'pickup') {
        const plant = plantById(state, interaction.plantId);
        if (plant) takePlant(state, player, plant, station);
        return Boolean(plant);
    }
    const carried = plantById(state, player.carryId);
    if (interaction.kind === 'place') {
        putDown(state, player, carried, station);
        return true;
    }
    if (interaction.kind === 'repot') carried.repotting = true;
    station.busyBy = player.id;
    player.action = {
        kind: interaction.kind,
        stationId: station.id,
        durationMs: interaction.durationMs,
        remainingMs: interaction.durationMs,
    };
    return true;
}

function finishAction(state, level, player) {
    const { kind, stationId } = player.action;
    const station = stationById(state, stationId);
    station.busyBy = null;
    player.action = null;
    if (kind === 'sow') {
        createPlant(state, player, station.variant);
        emit(state, 'sow', station, player.id, station.id);
        return;
    }
    const plant = plantById(state, player.carryId);
    if (!plant) return;
    if (kind === 'deliver') {
        const order = activeOrder(state, plant.flowerId);
        if (!order) {
            notice(state, player, 'No matching order');
            return;
        }
        order.status = 'delivered';
        order.premium = plant.quality === 'premium';
        state.stats.delivered += 1;
        state.stats.premium += Number(order.premium);
        state.stats.score += order.premium ? 140 : 100;
        emit(state, 'deliver', station, player.id, station.id, order.premium ? '+140' : '+100');
    }
    if (kind === 'compost' || kind === 'deliver') {
        if (kind === 'compost') emit(state, 'compost', station, player.id, station.id);
        state.plants = state.plants.filter(item => item.id !== plant.id);
        player.carryId = null;
        return;
    }
    if (kind === 'repot') {
        plant.pot = station.variant;
        plant.repotting = false;
        plant.rootDeadlineMs = null;
        plant.phase = 'bud';
    }
    advancePlant(plant, level);
    emit(state, kind, station, player.id, station.id);
}

function cellIsOpen(level, x, y) {
    return x >= 0 && x < level.width && y >= 0 && y < level.height && level.layout[y][x] !== '#';
}

function routeTo(level, player, destination) {
    const start = { x: Math.round(player.x), y: Math.round(player.y) };
    const end = { x: Math.round(destination.x), y: Math.round(destination.y) };
    if (start.x === end.x && start.y === end.y) return [end];
    const key = ({ x, y }) => y * level.width + x;
    const startKey = key(start);
    const endKey = key(end);
    const queue = [start];
    const cameFrom = new Map([[startKey, null]]);
    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        if (key(current) === endKey) {
            const route = [];
            for (let point = current; point && key(point) !== startKey; point = cameFrom.get(key(point))) {
                route.push(point);
            }
            return route.reverse();
        }
        for (const [dx, dy] of DIRECTIONS) {
            const next = { x: current.x + dx, y: current.y + dy };
            const nextKey = key(next);
            if (!cellIsOpen(level, next.x, next.y) || cameFrom.has(nextKey)) continue;
            cameFrom.set(nextKey, current);
            queue.push(next);
        }
    }
    return null;
}

function clearTarget(player) {
    player.target = null;
    player.route = [];
}

function targetPoint(state, target) {
    if (target.stationId) return stationById(state, target.stationId);
    if (target.plantId) {
        const plant = plantById(state, target.plantId);
        return plant && !plant.holderId && !plant.stationId ? plant : null;
    }
    return target;
}

function targetIsReached(player, location, target) {
    const reach = target.stationId || target.plantId ? TAP_REACH : 0.075;
    return distance(player, location) <= reach;
}

function triggerTarget(state, player, target, location) {
    clearTarget(player);
    if (target.stationId) return triggerStation(state, player, location);
    if (target.plantId && !player.carryId) {
        takePlant(state, player, location);
        return true;
    }
    return !target.plantId;
}

function beginTarget(state, player, target) {
    const point = targetPoint(state, target);
    if (!point) return false;
    player.moveX = 0;
    player.moveY = 0;
    if (targetIsReached(player, point, target)) return triggerTarget(state, player, target, point);
    const route = routeTo(getLevel(state.levelId), player, point);
    if (!route) {
        notice(state, player, 'Path is blocked');
        return false;
    }
    player.target = target;
    player.route = route;
    return true;
}

function nearbyInteraction(state, player) {
    const nearby = state.stations.filter(station => distance(player, station) <= INTERACT_REACH)
        .sort((a, b) => distance(player, a) - distance(player, b));
    const loose = !player.carryId && state.plants.find(plant =>
        !plant.holderId && !plant.stationId && distance(player, plant) <= TAP_REACH,
    );
    if (loose) {
        takePlant(state, player, loose);
        return true;
    }
    const station = nearby.find(item => interactionFor(state, player, item, false));
    if (station) return triggerStation(state, player, station, false);
    if (nearby.length) notice(state, player, stationFeedback(state, player, nearby[0]));
    return false;
}

export function applyCommand(state, playerId, command) {
    const player = state.players.find(gardener => gardener.id === playerId);
    if (!player || state.phase !== 'playing' || !command || typeof command !== 'object') return false;
    if (command.type === 'move' && Number.isFinite(command.x) && Number.isFinite(command.y)) {
        player.moveX = clamp(command.x, -1, 1);
        player.moveY = clamp(command.y, -1, 1);
        clearTarget(player);
        player.pending = null;
        return true;
    }
    if (command.type === 'target') {
        const level = getLevel(state.levelId);
        let target;
        if (typeof command.stationId === 'string') target = { stationId: command.stationId };
        else if (typeof command.plantId === 'string') target = { plantId: command.plantId };
        else if (Number.isFinite(command.x) && Number.isFinite(command.y)) {
            const x = Math.round(command.x);
            const y = Math.round(command.y);
            if (cellIsOpen(level, x, y)) target = { x, y };
        }
        if (!target || !targetPoint(state, target)) return false;
        if (player.action) {
            player.pending = { type: 'target', ...target };
            return true;
        }
        return beginTarget(state, player, target);
    }
    if (player.action) return false;
    if (command.type === 'interact') {
        const station = stationById(state, command.stationId);
        if (command.stationId && (!station || distance(player, station) > INTERACT_REACH)) return false;
        clearTarget(player);
        return station ? triggerStation(state, player, station) : nearbyInteraction(state, player);
    }
    if (command.type === 'drop' && player.carryId) {
        const plant = plantById(state, player.carryId);
        putDown(state, player, plant);
        clearTarget(player);
        return true;
    }
    return false;
}

function movePlayer(state, level, player, deltaMs) {
    const terrain = level.layout[Math.round(player.y)][Math.round(player.x)];
    const terrainMultiplier = terrain === '~' ? 0.66 : terrain === '+' ? 1.21 : 1;
    const travel = SPEED * terrainMultiplier * deltaMs / 1000;
    if (player.target) {
        const location = targetPoint(state, player.target);
        if (!location) {
            clearTarget(player);
            notice(state, player, 'Already taken');
            return;
        }
        if (targetIsReached(player, location, player.target)) {
            triggerTarget(state, player, player.target, location);
            return;
        }
        let budget = travel;
        while (budget > 0 && player.route.length) {
            const point = player.route[0];
            const gap = distance(player, point);
            if (Math.abs(point.x - player.x) > 0.08) player.facing = point.x > player.x ? 1 : -1;
            if (gap <= budget) {
                player.x = point.x;
                player.y = point.y;
                player.route.shift();
                budget -= gap;
            } else {
                player.x += (point.x - player.x) * budget / gap;
                player.y += (point.y - player.y) * budget / gap;
                budget = 0;
            }
        }
    } else {
        const magnitude = Math.max(1, Math.hypot(player.moveX, player.moveY));
        const nextX = clamp(player.x + player.moveX * travel / magnitude, 0, level.width - 1);
        const nextY = clamp(player.y + player.moveY * travel / magnitude, 0, level.height - 1);
        if (player.moveX) player.facing = Math.sign(player.moveX);
        if (cellIsOpen(level, Math.round(nextX), Math.round(player.y))) player.x = nextX;
        if (cellIsOpen(level, Math.round(player.x), Math.round(nextY))) player.y = nextY;
    }
}

function updateOrders(state, level) {
    let open = 0;
    for (const order of state.orders) {
        if (order.status !== 'open') continue;
        if (order.deadlineMs !== null && order.deadlineMs <= state.elapsedMs) {
            order.status = 'expired';
            state.stats.missed += 1;
        } else {
            open += 1;
        }
    }
    if (state.elapsedMs < state.nextOrderMs || (!state.practice && state.elapsedMs > level.cutoffMs)) return;
    const capacity = Math.min(6, state.players.length + 2);
    if (open >= capacity) return;
    const id = state.nextOrderId++;
    state.orders.push({
        id: `order-${id}`,
        flowerId: level.flowers[(id - 1) % level.flowers.length],
        status: 'open',
        createdMs: state.elapsedMs,
        deadlineMs: state.practice ? null : Math.min(state.durationMs, state.elapsedMs + level.patienceMs),
    });
    if (state.practice && state.orders.length > 24) state.orders = state.orders.filter(order => order.status === 'open');
    const interval = Math.max(8800, level.orderIntervalMs - Math.max(0, state.players.length - 1) * 2550);
    state.nextOrderMs = state.elapsedMs + interval;
}

function updatePlant(state, level, plant, weather, deltaMs) {
    if (!state.practice && !plant.repotting && plant.rootDeadlineMs !== null && state.elapsedMs >= plant.rootDeadlineMs) {
        plant.rootbound = true;
        plant.quality = 'standard';
        plant.rootDeadlineMs = null;
        emit(state, 'rootbound', plant, plant.holderId, plant.stationId, 'Rootbound');
    }
    if (!state.practice && plant.heatDeadlineMs !== null && state.elapsedMs >= plant.heatDeadlineMs) {
        plant.heatScorched = true;
        plant.quality = 'standard';
        plant.heatDeadlineMs = null;
        emit(state, 'scorch', plant, plant.holderId, plant.stationId, 'Overheated');
    }
    const owner = state.players.find(player => player.id === plant.holderId);
    if (owner) {
        plant.x = owner.x;
        plant.y = owner.y;
    }
    if (!plant.stationId || plant.readyAtMs !== null) return;
    const station = stationById(state, plant.stationId);
    const stage = stageFor(plant);
    if (!stage?.growth || stage.kind !== station.type) return;
    const boost = weather?.kind === station.type ? weather.multiplier : 1;
    plant.progressMs += deltaMs * boost;
    if (plant.progressMs < stage.durationMs) return;
    advancePlant(plant, level);
    plant.readyAtMs = state.elapsedMs;
    if (stage.phase === 'sprout') {
        plant.rootDeadlineMs = state.elapsedMs + level.rootGraceMs;
        emit(state, 'roots', station, null, station.id);
    } else {
        plant.heatDeadlineMs = state.elapsedMs + level.bloomGraceMs;
        emit(state, 'bloom', station, null, station.id);
    }
}

function stepSlice(state, level, deltaMs) {
    state.elapsedMs += deltaMs;
    updateOrders(state, level);
    for (const player of state.players) {
        if (player.action) {
            player.action.remainingMs -= deltaMs;
            if (player.action.remainingMs > 0) continue;
            finishAction(state, level, player);
            const pending = player.pending;
            player.pending = null;
            if (pending) applyCommand(state, player.id, pending);
        } else {
            movePlayer(state, level, player, deltaMs);
        }
    }
    const weather = getWeather(state);
    for (const plant of state.plants) updatePlant(state, level, plant, weather, deltaMs);
}

export function stepMatch(state, deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || state.phase !== 'playing') return state;
    const level = getLevel(state.levelId);
    let remaining = state.practice ? deltaMs : Math.min(deltaMs, state.durationMs - state.elapsedMs);
    while (remaining > 0) {
        const slice = Math.min(remaining, 50);
        stepSlice(state, level, slice);
        remaining -= slice;
    }
    if (!state.practice && state.elapsedMs >= state.durationMs) {
        const { delivered, premium } = state.stats;
        let stars = 0;
        if (delivered >= state.goals[0]) stars = 1;
        if (delivered >= state.goals[1]) stars = 2;
        if (delivered >= state.goals[2] && premium >= state.premiumGoal) stars = 3;
        state.phase = 'finished';
        state.results = { stars, ...state.stats };
    }
    return state;
}
