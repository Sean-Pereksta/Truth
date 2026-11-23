import { pointInTerrainZone } from './terrain-shapes.mjs';

export const UNIT_TYPES = Object.freeze({
  rifle: { name: 'Gray Riflemen', color: 'Gray', role: 'Line infantry', maxSoldiers: 30, hp: 32, damage: 4.5, range: 145, speed: 63, interval: 0.86 },
  heavy: { name: 'Gray Heavy Gunners', color: 'Gray', role: 'Suppression', maxSoldiers: 20, hp: 39, damage: 6.1, range: 170, speed: 48, interval: 0.88 },
  marksman: { name: 'Gray Marksmen', color: 'Gray', role: 'Precision fire', maxSoldiers: 16, hp: 34, damage: 10.4, range: 225, speed: 54, interval: 1.28 },
  raider: { name: 'Obsidian Raiders', color: 'Obsidian', role: 'Flanking assault', maxSoldiers: 16, hp: 66, damage: 13.5, range: 34, speed: 102, interval: 0.8 },
  obsidian: { name: 'Obsidian Heavy Warriors', color: 'Obsidian', role: 'Heavy breach', maxSoldiers: 12, hp: 100, damage: 24, range: 36, speed: 69, interval: 1.05 },
  razor: { name: 'Gold Razor Knights', color: 'Gold', role: 'Elite strike', maxSoldiers: 5, hp: 174, damage: 39, range: 37, speed: 88, interval: 0.83 },
  commander: { name: 'Gold Commander', color: 'Gold', role: 'Command and morale', maxSoldiers: 1, hp: 405, damage: 103, range: 40, speed: 83, interval: 0.96 },
  engineer: { name: 'Orange Combat Engineers', color: 'Orange', role: 'Repairs and demolition', maxSoldiers: 12, hp: 45, damage: 4.8, range: 106, speed: 55, interval: 0.92 },
  electronic: { name: 'Green Warfare Teams', color: 'Green', role: 'Electronic disruption', maxSoldiers: 8, hp: 48, damage: 5.5, range: 128, speed: 62, interval: 0.98 },
  medic: { name: 'Yellow Medical Teams', color: 'Yellow', role: 'Casualty recovery', maxSoldiers: 10, hp: 40, damage: 2.7, range: 91, speed: 65, interval: 0.94 },
  transport: { name: 'Armored Transports', color: 'Orange', role: 'Armored mobility', maxSoldiers: 3, hp: 265, damage: 23, range: 123, speed: 94, interval: 0.9 },
  tank: { name: 'Heavy Assault Vehicles', color: 'Orange', role: 'Siege and armor', maxSoldiers: 3, hp: 340, damage: 57, range: 176, speed: 46, interval: 1.24 },
});

export const FORMATIONS = Object.freeze(['line', 'column', 'wedge', 'defensive', 'loose']);

const BATTLE_MOVEMENT = 0.84;
const VOLLEY_INTERVAL = 1.85;
const VOLLEY_DAMAGE = 0.55;
const DEPLOYMENT_INSET = 76;
const backupWeapons = {
  rifle: { range: 31, damage: 4.7, interval: 0.81 },
  heavy: { range: 31, damage: 5.1, interval: 0.96 },
  marksman: { range: 29, damage: 4.2, interval: 0.96 },
  raider: { range: 102, damage: 5.2, interval: 1.02 },
  obsidian: { range: 94, damage: 7.0, interval: 1.25 },
  razor: { range: 110, damage: 16, interval: 1.08 },
  commander: { range: 117, damage: 42, interval: 1.15 },
  engineer: { range: 33, damage: 6, interval: 0.91 },
  electronic: { range: 29, damage: 3.3, interval: 0.96 },
  medic: { range: 28, damage: 2.9, interval: 0.95 },
};

function tunedWeapon({ range, damage, interval }) {
  return Object.freeze({ range, damage: damage * VOLLEY_DAMAGE, interval: interval * VOLLEY_INTERVAL });
}

export const ATTACK_PROFILES = Object.freeze(Object.fromEntries(Object.entries(UNIT_TYPES).map(([type, primary]) => {
  const mode = primary.range < 50 ? 'melee' : 'ranged';
  const weapons = { [mode]: tunedWeapon(primary) };
  if (backupWeapons[type]) weapons[mode === 'ranged' ? 'melee' : 'ranged'] = tunedWeapon(backupWeapons[type]);
  return [type, Object.freeze(weapons)];
})));

const WIDTH = 960;
const HEIGHT = 576;
const CELL = 24;
const COLS = WIDTH / CELL;
const ROWS = HEIGHT / CELL;
const PADDING = 8;
const HOLD_MORALE = 17;
const ARMOR = new Set(['transport', 'tank']);
const ATTACK_MODES = new Set(['auto', 'melee', 'ranged']);
const COMMANDS = new Set(['move', 'attack', 'attackMove', 'hold', 'stop', 'formation', 'ability', 'attackMode', 'face']);
const GRID_CACHE = new WeakMap();
const NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

const terrains = {
  desert: [
    [331, 114, 72, 42, 'rock'], [551, 388, 74, 49, 'rock'], [453, 233, 60, 88, 'rock'],
    [284, 244, 104, 89, 'high'], [556, 213, 101, 99, 'cover'], [429, 378, 80, 72, 'cover'],
  ],
  mountain: [
    [366, 0, 96, 190, 'rock'], [475, 367, 91, 209, 'rock'], [511, 102, 61, 68, 'rock'],
    [317, 192, 109, 58, 'high'], [524, 298, 118, 59, 'high'], [431, 262, 83, 56, 'cover'],
  ],
  urban: [
    [330, 106, 83, 98, 'building', 580], [542, 112, 76, 104, 'building', 530],
    [429, 248, 102, 71, 'building', 690], [330, 392, 83, 79, 'building', 520],
    [543, 383, 77, 90, 'building', 560], [350, 219, 61, 145, 'cover'], [549, 232, 64, 123, 'cover'],
  ],
  fortress: [
    [485, 44, 32, 137, 'wall', 850], [485, 220, 32, 136, 'wall', 850],
    [485, 398, 32, 135, 'wall', 850], [576, 78, 68, 65, 'building', 490],
    [576, 433, 68, 65, 'building', 490], [531, 194, 136, 180, 'cover'], [344, 173, 90, 91, 'high'],
  ],
  industrial: [
    [322, 71, 76, 162, 'building', 570], [561, 337, 76, 162, 'building', 570],
    [437, 238, 83, 92, 'building', 680], [514, 133, 130, 69, 'cover'], [321, 376, 130, 69, 'cover'],
  ],
  mine: [
    [345, 0, 41, 174, 'rock'], [416, 205, 133, 172, 'rock'], [579, 404, 41, 172, 'rock'],
    [570, 188, 75, 92, 'cover'], [322, 305, 77, 82, 'cover'], [429, 91, 118, 60, 'high'],
  ],
  spaceport: [
    [346, 141, 109, 53, 'building', 510], [505, 379, 109, 53, 'building', 510],
    [419, 253, 46, 69, 'wall', 415], [496, 254, 45, 65, 'wall', 415],
    [386, 82, 158, 37, 'high'], [414, 456, 157, 37, 'high'],
  ],
  ice: [
    [339, 69, 67, 83, 'rock'], [549, 419, 71, 82, 'rock'], [451, 199, 58, 177, 'rock'],
    [298, 335, 101, 115, 'cover'], [560, 132, 106, 106, 'cover'], [536, 276, 110, 83, 'high'],
  ],
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const active = squad => squad.soldiers > 0 && !squad.withdrawn;
const fighting = squad => active(squad) && !squad.routing;
const vehicle = squad => ARMOR.has(squad.type);
const bearing = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const headingOf = (squad) => Number.isFinite(squad.heading) ? squad.heading : squad.side === 0 ? 0 : Math.PI;
const stationary = (squad) => squad.locked || squad.orders[0]?.type === 'hold' || squad.orders[0]?.type === 'face';
const inRect = (x, y, rect, pad = 0) => x >= rect.x - pad && x <= rect.x + rect.w + pad &&
  y >= rect.y - pad && y <= rect.y + rect.h + pad;

export function createSquad(type, id) {
  const definition = UNIT_TYPES[type];
  if (!definition) throw new RangeError(`Unknown squad type: ${type}`);
  return { id, type, soldiers: definition.maxSoldiers, xp: 0, wounds: 0 };
}

function terrainName(value) {
  const name = String(value?.kind ?? value ?? '').toLowerCase();
  if (name.includes('fort')) return 'fortress';
  if (name.includes('port') || name.includes('orbital')) return 'spaceport';
  if (/cold|cryo|ice|frozen|rim|glacier/.test(name)) return 'ice';
  if (/mine|mining|under|cavern/.test(name)) return 'mine';
  if (/city|urban|metropolis/.test(name)) return 'urban';
  if (/industr|forge/.test(name)) return 'industrial';
  if (/mountain|pass|ridge|highland/.test(name)) return 'mountain';
  return 'desert';
}

function nextRandom(battle) {
  let state = battle.randomState;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  battle.randomState = state >>> 0;
  return battle.randomState / 4294967296;
}

function seedFrom(value) {
  const seed = Number(value);
  if (Number.isFinite(seed) && (seed >>> 0) !== 0) return seed >>> 0;
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) || 1;
}

export function createBattle({ id, planetId = null, regionId = null, name = id, armies, terrain, seed }) {
  const biome = terrainName(terrain);
  const initialSeed = seedFrom(seed ?? id);
  const zones = [];
  const obstacles = [];
  for (const [x, y, w, h, kind, health] of terrains[biome]) {
    if (kind === 'high' || kind === 'cover') zones.push({ x, y, w, h, kind });
    else obstacles.push({ id: `obstacle-${obstacles.length}`, x, y, w, h, kind, health: health ?? null, maxHealth: health ?? null });
  }
  const battle = {
    id, planetId, regionId, name, terrain: biome, width: WIDTH, height: HEIGHT, zones, obstacles,
    squads: [], armies: [], effects: [], winner: null, elapsed: 0, seed: initialSeed, randomState: initialSeed,
    pendingTime: 0, leaderLosses: 0,
  };
  for (const army of armies) addReinforcements(battle, army);
  return battle;
}

export function addReinforcements(battle, army) {
  if (battle.winner !== null) return false;
  const existing = battle.armies.find(entry => entry.id === army.id);
  const ideas = army.commander ?? {};
  const sameHouse = battle.armies.find(entry => entry.houseId === army.houseId);
  const side = sameHouse?.side ?? (battle.armies.length === 0 ? 0 : 1);
  const entry = existing ?? {
    id: army.id, houseId: army.houseId, side, doctrine: army.doctrine ?? 'balanced',
    supplied: army.supplied !== false, defense: clamp(Number(army.defense) || 0, 0, 3),
    leadership: clamp(Number(ideas.leadership) || 50, 0, 100),
    tactical: clamp(Number(ideas.tactical ?? ideas.intelligence ?? ideas.tactics) || 50, 0, 100),
    discipline: clamp(Number(ideas.discipline) || 50, 0, 100),
    aggression: clamp(Number(ideas.aggression) || 50, 0, 100),
    loyalty: clamp(Number(ideas.loyalty) || 50, 0, 100),
    experience: clamp(Number(ideas.experience) || 0, 0, 100),
  };
  if (!existing) battle.armies.push(entry);
  const firstIndex = battle.squads.filter(squad => squad.houseId === army.houseId).length;
  const ids = new Set(battle.squads.map(squad => squad.id));
  let deployed = 0;
  for (const input of army.squads) {
    if (ids.has(input.id) || !UNIT_TYPES[input.type] || input.soldiers <= 0) continue;
    ids.add(input.id);
    const definition = UNIT_TYPES[input.type];
    const soldiers = clamp(Math.floor(input.soldiers ?? definition.maxSoldiers), 1, definition.maxSoldiers);
    const wounds = clamp(Number(input.wounds) || 0, 0, definition.hp - 1);
    const index = firstIndex + deployed++;
    const column = Math.floor(index / 9);
    const row = index % 9;
    const x = clamp(side === 0 ? DEPLOYMENT_INSET - column * 31 : WIDTH - DEPLOYMENT_INSET + column * 31, 25, WIDTH - 25);
    const y = HEIGHT / 2 + (row % 2 === 0 ? 1 : -1) * Math.ceil(row / 2) * 49;
    battle.squads.push({
      id: input.id, armyId: army.id, houseId: army.houseId, type: input.type, x, y,
      name: input.name ?? (input.type === 'commander' ? ideas.name : null) ?? definition.name,
      heading: side === 0 ? 0 : Math.PI, soldiers, deployedSoldiers: soldiers, maxSoldiers: definition.maxSoldiers,
      hp: soldiers * definition.hp - wounds, maxHp: definition.maxSoldiers * definition.hp,
      morale: clamp(89 + entry.leadership / 5 - (entry.supplied ? 0 : 15) + entry.defense * 3, 0, 100),
      xp: clamp(Number(input.xp) || 0, 0, 20), formation: 'line', orders: [],
      path: [], pathTarget: null, repath: 0, targetId: null, cooldown: 0,
      attackMode: 'auto', lastAttackMode: null, facingLocked: false, aimTargetId: null, aimMode: null, aimRemaining: 0,
      abilityCooldown: 0, fireFlash: 0, suppression: 0, jammed: 0, boost: 0,
      supplied: entry.supplied, defense: entry.defense, side, recovering: 0,
      routing: false, withdrawn: false, locked: false, aiTime: 0, stuckTime: 0,
    });
  }
  return deployed > 0;
}

function solid(obstacle) {
  return obstacle.health === null || obstacle.health > 0;
}

function segmentHits(a, b, rect, padding = 0) {
  let near = 0;
  let far = 1;
  for (const [start, end, low, high] of [
    [a.x, b.x, rect.x - padding, rect.x + rect.w + padding],
    [a.y, b.y, rect.y - padding, rect.y + rect.h + padding],
  ]) {
    const delta = end - start;
    if (Math.abs(delta) < 0.0001) {
      if (start < low || start > high) return false;
      continue;
    }
    const f1 = (low - start) / delta;
    const f2 = (high - start) / delta;
    near = Math.max(near, Math.min(f1, f2));
    far = Math.min(far, Math.max(f1, f2));
    if (near > far) return false;
  }
  return true;
}

function unobstructed(battle, a, b, padding = 0, excluded = null) {
  return !battle.obstacles.some(obstacle => obstacle !== excluded && solid(obstacle) && segmentHits(a, b, obstacle, padding));
}

function walkable(battle, x, y) {
  return x >= PADDING && y >= PADDING && x <= WIDTH - PADDING && y <= HEIGHT - PADDING &&
    !battle.obstacles.some(obstacle => solid(obstacle) && inRect(x, y, obstacle, PADDING));
}

function point(cell) {
  return { x: (cell % COLS + 0.5) * CELL, y: (Math.floor(cell / COLS) + 0.5) * CELL };
}

function toCell(position) {
  return clamp(Math.floor(position.y / CELL), 0, ROWS - 1) * COLS +
    clamp(Math.floor(position.x / CELL), 0, COLS - 1);
}

function navigationGrid(battle) {
  const key = battle.obstacles.map(obstacle => Number(solid(obstacle))).join('');
  const cached = GRID_CACHE.get(battle);
  if (cached?.key === key) return cached.cells;
  const cells = new Uint8Array(COLS * ROWS);
  for (let cell = 0; cell < cells.length; cell++) {
    const { x, y } = point(cell);
    cells[cell] = Number(walkable(battle, x, y));
  }
  GRID_CACHE.set(battle, { key, cells });
  return cells;
}

function closestCell(battle, cells, position, mustConnect = false) {
  const center = toCell(position);
  if (cells[center] && (!mustConnect || unobstructed(battle, position, point(center), PADDING - 1))) return center;
  const col = center % COLS;
  const row = Math.floor(center / COLS);
  let best = -1;
  let bestDistance = Infinity;
  for (let radius = 1; radius <= 7 && best === -1; radius++) {
    for (let y = Math.max(0, row - radius); y <= Math.min(ROWS - 1, row + radius); y++) {
      for (let x = Math.max(0, col - radius); x <= Math.min(COLS - 1, col + radius); x++) {
        const cell = y * COLS + x;
        if (!cells[cell]) continue;
        const middle = point(cell);
        if (mustConnect && !unobstructed(battle, position, middle, PADDING - 1)) continue;
        const separation = distance(position, middle);
        if (separation >= bestDistance) continue;
        best = cell;
        bestDistance = separation;
      }
    }
  }
  return best;
}

function minimizer(a, b) {
  return a.score - b.score || a.cell - b.cell;
}

function pushOpen(queue, item) {
  let index = queue.length;
  queue.push(item);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (minimizer(queue[parent], item) <= 0) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = item;
}

function popOpen(queue) {
  const result = queue[0];
  const last = queue.pop();
  if (queue.length === 0) return result;
  let index = 0;
  while (index * 2 + 1 < queue.length) {
    const left = index * 2 + 1;
    const right = left + 1;
    const next = right < queue.length && minimizer(queue[right], queue[left]) < 0 ? right : left;
    if (minimizer(last, queue[next]) <= 0) break;
    queue[index] = queue[next];
    index = next;
  }
  queue[index] = last;
  return result;
}

function findPath(battle, start, requested) {
  const target = { x: clamp(requested.x, PADDING, WIDTH - PADDING), y: clamp(requested.y, PADDING, HEIGHT - PADDING) };
  if (walkable(battle, target.x, target.y) && unobstructed(battle, start, target, PADDING - 1)) return [target];
  const cells = navigationGrid(battle);
  const source = closestCell(battle, cells, start, true);
  const goal = closestCell(battle, cells, target, walkable(battle, target.x, target.y));
  if (source < 0 || goal < 0) return [];
  const goalPoint = point(goal);
  const costs = new Float64Array(cells.length).fill(Infinity);
  const links = new Int16Array(cells.length).fill(-1);
  const seen = new Uint8Array(cells.length);
  const open = [];
  costs[source] = 0;
  pushOpen(open, { cell: source, score: distance(point(source), goalPoint) });
  while (open.length) {
    const { cell } = popOpen(open);
    if (cell === goal) break;
    if (seen[cell]) continue;
    seen[cell] = 1;
    const col = cell % COLS;
    const row = Math.floor(cell / COLS);
    const current = point(cell);
    for (const [dx, dy] of NEIGHBORS) {
      const x = col + dx;
      const y = row + dy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const next = y * COLS + x;
      if (!cells[next] || seen[next]) continue;
      if (dx && dy && (!cells[row * COLS + x] || !cells[y * COLS + col])) continue;
      const neighbor = point(next);
      if (!unobstructed(battle, current, neighbor, PADDING - 1)) continue;
      const cost = costs[cell] + CELL * (dx && dy ? Math.SQRT2 : 1);
      if (cost >= costs[next]) continue;
      costs[next] = cost;
      links[next] = cell;
      pushOpen(open, { cell: next, score: cost + distance(neighbor, goalPoint) });
    }
  }
  if (!Number.isFinite(costs[goal])) return [];
  const route = [];
  for (let cell = goal; cell !== source; cell = links[cell]) route.push(point(cell));
  route.push(point(source));
  route.reverse();
  if (walkable(battle, target.x, target.y) && unobstructed(battle, goalPoint, target, PADDING - 1)) route.push(target);
  const waypoints = [];
  let previous = start;
  for (let index = 0; index < route.length;) {
    let next = route.length - 1;
    while (next > index && !unobstructed(battle, previous, route[next], PADDING - 1)) next--;
    previous = route[next];
    waypoints.push(previous);
    index = next + 1;
  }
  return waypoints;
}

function clearPath(squad) {
  squad.path = [];
  squad.pathTarget = null;
  squad.repath = 0;
  squad.stuckTime = 0;
}

function clearAim(squad) {
  squad.aimTargetId = null;
  squad.aimMode = null;
  squad.aimRemaining = 0;
}

function turnToward(squad, heading, dt) {
  const current = headingOf(squad);
  const difference = normalizeAngle(heading - current);
  const rate = vehicle(squad) ? 2.05 : 3.3;
  const maxTurn = rate * dt;
  squad.heading = normalizeAngle(current + clamp(difference, -maxTurn, maxTurn));
  return Math.abs(difference) <= maxTurn + 1e-7;
}

function advance(battle, squad, destination, dt) {
  if (distance(squad, destination) <= 5) return true;
  if (!squad.pathTarget || (squad.repath <= 0 && distance(squad.pathTarget, destination) > 26)) {
    squad.path = findPath(battle, squad, destination);
    squad.pathTarget = { x: destination.x, y: destination.y };
    squad.repath = 0.65;
    if (squad.path.length === 0) return true;
  }
  const next = squad.path[0];
  if (!next) return true;
  const dx = next.x - squad.x;
  const dy = next.y - squad.y;
  const gap = Math.hypot(dx, dy);
  const formationSpeed = squad.formation === 'column' ? 1.16 : squad.formation === 'defensive' ? 0.86 : 1;
  const speed = UNIT_TYPES[squad.type].speed * BATTLE_MOVEMENT * formationSpeed * (squad.routing ? 1.22 : 1) *
    (squad.suppression > 0 ? 0.61 : 1) * (squad.boost > 0 ? 1.33 : 1);
  const step = Math.min(gap, speed * dt);
  if (gap > 1) turnToward(squad, Math.atan2(dy, dx), dt);
  if (gap <= 1 || step >= gap - 0.15) {
    if (walkable(battle, next.x, next.y) && unobstructed(battle, squad, next, PADDING - 1)) {
      squad.x = next.x;
      squad.y = next.y;
    }
    squad.path.shift();
    return squad.path.length === 0;
  }
  const x = squad.x + dx * step / gap;
  const y = squad.y + dy * step / gap;
  if (walkable(battle, x, y) && unobstructed(battle, squad, { x, y }, PADDING - 1)) {
    squad.x = x;
    squad.y = y;
    squad.stuckTime = 0;
    return false;
  }
  squad.stuckTime += dt;
  if (squad.stuckTime > 0.24) {
    clearPath(squad);
    squad.path = findPath(battle, squad, destination);
    squad.pathTarget = { x: destination.x, y: destination.y };
    if (squad.path.length === 0 || distance(squad, squad.path[0]) < 1) return true;
  }
  return false;
}

function spacedDestinations(squads, order) {
  const center = squads.reduce((sum, squad) => ({ x: sum.x + squad.x, y: sum.y + squad.y }), { x: 0, y: 0 });
  const facing = Number.isFinite(order.heading) ? order.heading :
    Math.atan2(order.y - center.y / squads.length, order.x - center.x / squads.length);
  const sine = Math.sin(facing);
  const cosine = Math.cos(facing);
  const ordered = [...squads].sort((a, b) => (-a.x * sine + a.y * cosine) - (-b.x * sine + b.y * cosine));
  const offsets = new Map();
  ordered.forEach((squad, index) => {
    const rank = index - (ordered.length - 1) / 2;
    const formation = squad.formation;
    const sideways = formation === 'column' ? (index % 2 ? 10 : -10) : rank * (formation === 'loose' ? 54 : 38);
    const backwards = formation === 'wedge' ? Math.abs(rank) * 18 : formation === 'column' ? rank * 24 : 0;
    offsets.set(squad.id, { x: order.x - sideways * sine - backwards * cosine, y: order.y + sideways * cosine - backwards * sine });
  });
  return offsets;
}

export function issueOrder(battle, houseId, ids, order, queue = false) {
  if (battle.winner !== null || !COMMANDS.has(order?.type)) return 0;
  const selection = new Set(ids);
  const squads = battle.squads.filter(squad => squad.houseId === houseId && selection.has(squad.id) && fighting(squad));
  if (squads.length === 0) return 0;
  const destination = order.type === 'move' || order.type === 'attackMove';
  if (destination && (!Number.isFinite(order.x) || !Number.isFinite(order.y))) return 0;
  const directed = Number.isFinite(order.heading);
  if (order.type === 'face' && !directed && (!Number.isFinite(order.x) || !Number.isFinite(order.y))) return 0;
  if (order.type === 'formation' && !FORMATIONS.includes(order.formation)) return 0;
  if ((order.mode !== undefined || order.type === 'attackMode') && !ATTACK_MODES.has(order.mode)) return 0;
  if (order.type === 'attack') {
    const hostile = battle.squads.some(squad => squad.id === order.targetId && squad.houseId !== houseId && active(squad));
    const structure = battle.obstacles.some(obstacle => obstacle.id === order.targetId && obstacle.health > 0);
    if (!hostile && !structure) return 0;
  }
  const offsets = destination && squads.length > 1 ? spacedDestinations(squads, order) : null;
  let accepted = 0;
  for (const squad of squads) {
    if (order.mode && order.mode !== 'auto' && !ATTACK_PROFILES[squad.type][order.mode]) continue;
    if (order.type === 'attackMode') {
      squad.attackMode = order.mode;
      clearAim(squad);
    } else if (order.type === 'formation') {
      squad.formation = order.formation;
      if (directed) squad.heading = normalizeAngle(order.heading);
    } else if (order.type === 'ability') {
      if (!useAbility(battle, squad, order)) continue;
    } else {
      if (!queue || order.type === 'stop') {
        squad.orders = [];
        squad.facingLocked = false;
        clearPath(squad);
        clearAim(squad);
      }
      if (queue && squad.orders.length === 1 && ['hold', 'face'].includes(squad.orders[0].type)) squad.orders.shift();
      const command = { type: order.type, ...(offsets?.get(squad.id) ?? (destination ? { x: order.x, y: order.y } : {})) };
      if (directed) command.heading = normalizeAngle(order.heading);
      if (order.type === 'face' && !directed) command.heading = bearing(squad, order);
      if (order.type === 'attack') command.targetId = order.targetId;
      if (order.mode) command.mode = order.mode;
      if (order.type !== 'stop') squad.orders.push(command);
      squad.locked = order.type === 'stop';
      squad.targetId = null;
    }
    accepted++;
  }
  return accepted;
}

function addEffect(battle, kind, unit, target = null, duration = 0.32) {
  battle.effects.push({
    kind, x: unit.x, y: unit.y, ...(target ? { toX: target.x, toY: target.y } : {}),
    houseId: unit.houseId, life: duration, duration,
  });
}

function recoveryCap(squad) {
  const reserves = vehicle(squad) ? 0 : Math.floor(squad.recovering);
  return Math.min(squad.maxHp, (squad.soldiers + reserves) * UNIT_TYPES[squad.type].hp);
}

function recover(squad, amount) {
  const definition = UNIT_TYPES[squad.type];
  const before = squad.soldiers;
  squad.hp = Math.min(recoveryCap(squad), squad.hp + amount);
  squad.soldiers = Math.ceil(squad.hp / definition.hp);
  squad.recovering = Math.max(0, squad.recovering - (squad.soldiers - before));
}

function useAbility(battle, squad, order = {}) {
  if (squad.abilityCooldown > 0 || squad.jammed > 0 || !fighting(squad)) return false;
  const allies = battle.squads.filter(unit => unit.houseId === squad.houseId && active(unit) && distance(unit, squad) <= 126);
  const enemies = battle.squads.filter(unit => unit.houseId !== squad.houseId && active(unit) && distance(unit, squad) <= 145);
  let target;
  switch (squad.type) {
    case 'commander':
      for (const ally of allies) {
        ally.morale = Math.min(100, ally.morale + 27);
        ally.suppression = 0;
        if (ally.routing && ally.morale > 30) {
          ally.routing = false;
          clearPath(ally);
        }
      }
      squad.abilityCooldown = 16;
      addEffect(battle, 'rally', squad, null, 0.9);
      return true;
    case 'medic':
    case 'engineer': {
      const valid = allies.filter(unit => unit.hp < recoveryCap(unit) && (squad.type === 'engineer') === vehicle(unit));
      target = valid.find(unit => unit.id === order.targetId) ??
        valid.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (target) {
        recover(target, squad.type === 'medic' ? 78 + squad.soldiers * 6 : 90 + squad.soldiers * 8);
        target.morale = Math.min(100, target.morale + 6);
        squad.abilityCooldown = 15;
        addEffect(battle, squad.type === 'medic' ? 'heal' : 'repair', squad, target, 0.62);
        return true;
      }
      if (squad.type !== 'engineer') return false;
      const obstacle = battle.obstacles.find(item => item.id === order.targetId && item.health > 0);
      if (!obstacle) return false;
      const position = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 };
      if (distance(squad, position) > 115) return false;
      obstacle.health = Math.max(0, obstacle.health - 280);
      squad.abilityCooldown = 14;
      addEffect(battle, 'explosion', { ...position, houseId: squad.houseId }, null, 0.76);
      return true;
    }
    case 'electronic':
      target = enemies.find(unit => unit.id === order.targetId) ?? enemies.sort((a, b) => distance(a, squad) - distance(b, squad))[0];
      if (!target || !unobstructed(battle, squad, target)) return false;
      target.jammed = 6;
      target.suppression = 2;
      squad.abilityCooldown = 14;
      addEffect(battle, 'jam', squad, target, 0.8);
      return true;
    case 'transport':
      for (const ally of allies) ally.boost = 6;
      squad.abilityCooldown = 15;
      addEffect(battle, 'dust', squad, null, 0.7);
      return true;
    case 'raider':
    case 'obsidian':
    case 'razor':
      squad.boost = 4;
      squad.abilityCooldown = 12;
      addEffect(battle, 'dust', squad, null, 0.7);
      return true;
    case 'heavy':
    case 'tank':
      target = enemies.find(unit => unit.id === order.targetId) ?? enemies.filter(unit =>
        withinArc(squad, unit, 'ranged') && unobstructed(battle, squad, unit)).sort((a, b) => distance(a, squad) - distance(b, squad))[0];
      if (!target || !withinArc(squad, target, 'ranged') || !unobstructed(battle, squad, target)) return false;
      hurt(battle, squad, target, squad.type === 'tank' ? 150 : 70);
      target.suppression = 4;
      squad.abilityCooldown = 18;
      addEffect(battle, 'heavy', squad, target, 0.56);
      return true;
    default:
      return false;
  }
}

function hurt(battle, squad, target, amount, moralePressure = 1) {
  const previous = target.soldiers;
  const hp = UNIT_TYPES[target.type].hp;
  target.hp = Math.max(0, target.hp - amount);
  target.soldiers = Math.ceil(target.hp / hp);
  const lost = previous - target.soldiers;
  if (!vehicle(target)) target.recovering += lost * 0.45;
  target.morale = Math.max(0, target.morale - ((amount / target.maxHp) * 19 + lost / previous * 15) * moralePressure);
  squad.xp = Math.min(20, squad.xp + amount / 910 + lost * 0.04);
  if (target.soldiers > 0) return;
  target.orders = [];
  clearPath(target);
  if (target.type === 'commander') {
    battle.leaderLosses++;
    for (const ally of battle.squads) {
      if (ally.armyId === target.armyId && active(ally)) ally.morale = Math.max(0, ally.morale - 20);
    }
  }
  if (vehicle(target)) addEffect(battle, 'explosion', target, null, 1.05);
}

function zoneOf(battle, squad, kind) {
  return battle.zones.find(zone => zone.kind === kind && pointInTerrainZone(squad.x, squad.y, zone));
}

function withinArc(squad, target, mode) {
  const arc = mode === 'melee' ? 1.6 : vehicle(squad) ? 0.68 : 1.12;
  return Math.abs(normalizeAngle(bearing(squad, target) - headingOf(squad))) <= arc;
}

function availableAttack(battle, squad, target, order, fixedFacing = false, obstacle = null) {
  const profiles = ATTACK_PROFILES[squad.type];
  const requested = order?.mode ?? squad.attackMode ?? 'auto';
  const separation = distance(squad, target);
  const melee = profiles.melee && separation <= profiles.melee.range;
  const range = profiles.ranged?.range ?? 0;
  const ranged = profiles.ranged && (separation <= range ||
    (separation <= range + 17 && zoneOf(battle, squad, 'high')));
  let mode;
  if (requested === 'melee' && profiles.melee) mode = melee ? 'melee' : null;
  else if (requested === 'ranged' && profiles.ranged) mode = ranged ? 'ranged' : null;
  else if (melee && (!fixedFacing || withinArc(squad, target, 'melee'))) mode = 'melee';
  else if (ranged && (UNIT_TYPES[squad.type].range >= 50 || fixedFacing || squad.locked)) mode = 'ranged';
  if (!mode || (fixedFacing && !withinArc(squad, target, mode))) return null;
  return unobstructed(battle, squad, target, 0, obstacle) ? mode : null;
}

function readyToStrike(squad, target, mode, dt, fixedFacing) {
  if (!fixedFacing && !turnToward(squad, bearing(squad, target), dt)) return false;
  if (squad.aimTargetId !== target.id || squad.aimMode !== mode) {
    squad.aimTargetId = target.id;
    squad.aimMode = mode;
    const windup = mode === 'melee' ? 0.38 : vehicle(squad) ? 1.02 : squad.type === 'marksman' ? 1.06 : 0.85;
    squad.aimRemaining = fixedFacing ? windup * 0.82 : windup;
  }
  squad.aimRemaining = Math.max(0, (squad.aimRemaining ?? 0) - dt);
  return squad.aimRemaining <= 1e-7 && squad.cooldown <= 1e-7;
}

function markAttack(squad, mode) {
  squad.cooldown = ATTACK_PROFILES[squad.type][mode].interval * (squad.supplied ? 1 : 1.18);
  squad.lastAttackMode = mode;
  squad.fireFlash = mode === 'melee' ? 0.32 : 0.25;
}

function attack(battle, squad, target, mode, dt, fixedFacing = false) {
  if (!readyToStrike(squad, target, mode, dt, fixedFacing)) return;
  const profile = ATTACK_PROFILES[squad.type][mode];
  const melee = mode === 'melee';
  const angle = Math.abs(normalizeAngle(bearing(target, squad) - headingOf(target)));
  const rear = angle >= 2.18;
  const flank = angle > 1.05 && !rear;
  let damage = profile.damage * squad.soldiers * (0.92 + nextRandom(battle) * 0.16) * (1 + squad.xp / 85);
  if (!melee && zoneOf(battle, target, 'cover')) damage *= 0.72;
  if (!melee && zoneOf(battle, squad, 'high')) damage *= 1.12;
  if (!melee && target.formation === 'loose') damage *= 0.81;
  if (!melee && squad.formation === 'line') damage *= 1.08;
  if (melee && squad.formation === 'wedge') damage *= 1.19;
  if (target.formation === 'defensive' && !rear) damage *= flank ? 0.94 : 0.77;
  const inHomeHalf = target.side === 0 ? target.x < WIDTH / 2 : target.x > WIDTH / 2;
  if (!melee && inHomeHalf && !rear) damage *= 1 - target.defense * (flank ? 0.027 : 0.05);
  if (rear) damage *= melee ? 1.34 : 1.21;
  if (flank) damage *= melee ? 1.14 : 1.08;
  if (!melee) {
    const separation = distance(squad, target);
    const longRange = clamp((separation / profile.range - 0.62) / 0.38, 0, 1);
    const falloff = squad.type === 'marksman' ? 0.17 : vehicle(squad) ? 0.24 : 0.36;
    damage *= 1 - longRange * falloff;
    if (separation <= (ATTACK_PROFILES[squad.type].melee?.range ?? 0)) damage *= 0.82;
  }
  if (vehicle(target) && (squad.type === 'rifle' || squad.type === 'marksman' || squad.type === 'medic')) damage *= 0.54;
  if (squad.suppression > 0) damage *= 0.83;
  if (squad.jammed > 0) damage *= vehicle(squad) ? 0.52 : 0.86;
  if (squad.morale < 50) damage *= 0.74 + squad.morale / 194;
  markAttack(squad, mode);
  if (!melee && (squad.type === 'heavy' || squad.type === 'tank')) target.suppression = Math.max(target.suppression, 1.2);
  hurt(battle, squad, target, damage, rear ? 1.32 : flank ? 1.15 : 1);
  addEffect(battle, melee ? 'melee' : squad.type === 'tank' ? 'heavy' : 'shot', squad, target,
    melee ? 0.4 : squad.type === 'tank' ? 0.42 : 0.31);
}

function bestEnemy(battle, squad, localOnly, order = null, fixedFacing = false) {
  let target = null;
  let minimum = Infinity;
  for (const unit of battle.squads) {
    if (squad.houseId === unit.houseId || !active(unit) || (localOnly && !availableAttack(battle, squad, unit, order, fixedFacing))) continue;
    let score = distance(squad, unit);
    if (unit.routing) score += 93;
    if (localOnly && unit.id === squad.aimTargetId) score *= 0.86;
    if (squad.type === 'marksman' && unit.type === 'commander') score *= 0.68;
    if (squad.type === 'tank' && vehicle(unit)) score *= 0.72;
    if (score >= minimum) continue;
    minimum = score;
    target = unit;
  }
  return target;
}

function attackStructure(battle, squad, obstacle, order, dt) {
  const center = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 };
  const target = { id: obstacle.id, x: clamp(squad.x, obstacle.x, obstacle.x + obstacle.w), y: clamp(squad.y, obstacle.y, obstacle.y + obstacle.h) };
  const mode = availableAttack(battle, squad, target, order, false, obstacle);
  if (!mode) {
    clearAim(squad);
    const dx = squad.x - center.x;
    const dy = squad.y - center.y;
    const offset = Math.atan2(dy, dx);
    const points = [
      { x: obstacle.x - 20, y: center.y }, { x: obstacle.x + obstacle.w + 20, y: center.y },
      { x: center.x, y: obstacle.y - 20 }, { x: center.x, y: obstacle.y + obstacle.h + 20 },
    ];
    const approach = points.filter(position => walkable(battle, position.x, position.y))
      .sort((a, b) => distance(squad, a) - distance(squad, b))[0] ??
      { x: target.x + Math.cos(offset) * 20, y: target.y + Math.sin(offset) * 20 };
    advance(battle, squad, approach, dt);
    return;
  }
  if (!readyToStrike(squad, target, mode, dt, false)) return;
  const profile = ATTACK_PROFILES[squad.type][mode];
  const damage = profile.damage * squad.soldiers * (squad.type === 'obsidian' || squad.type === 'engineer' || squad.type === 'tank' ? 1.25 : 0.42);
  obstacle.health = Math.max(0, obstacle.health - damage);
  markAttack(squad, mode);
  addEffect(battle, obstacle.health === 0 ? 'explosion' : mode === 'melee' ? 'melee' : 'heavy',
    squad, target, obstacle.health === 0 ? 0.8 : 0.33);
}

function autoAbility(battle, squad, nearby) {
  if (squad.abilityCooldown > 0 || squad.jammed > 0) return;
  if (squad.type === 'commander') {
    const wavering = battle.squads.some(unit => unit.houseId === squad.houseId && active(unit) && unit.morale < 60 && distance(unit, squad) <= 126);
    if (wavering) useAbility(battle, squad);
    return;
  }
  if (squad.type === 'engineer' || squad.type === 'medic') {
    const wounded = battle.squads.some(unit => unit.houseId === squad.houseId && active(unit) && recoveryCap(unit) - unit.hp >= 15 &&
      distance(unit, squad) <= 126 && (squad.type === 'engineer') === vehicle(unit));
    if (wounded) useAbility(battle, squad);
    return;
  }
  if (nearby && distance(nearby, squad) < 115) useAbility(battle, squad, { targetId: nearby.id });
}

function autonomous(battle, squad, army, dt) {
  const close = bestEnemy(battle, squad, true);
  if (squad.aiTime <= 0) {
    squad.aiTime = 0.6 + (100 - army.tactical) * 0.004 - army.experience * 0.0015;
    squad.targetId = bestEnemy(battle, squad, false)?.id ?? null;
    autoAbility(battle, squad, close);
  }
  if (close) {
    const mode = availableAttack(battle, squad, close);
    if (mode) attack(battle, squad, close, mode, dt);
    return;
  }
  if (squad.aimTargetId != null) clearAim(squad);
  const target = battle.squads.find(unit => unit.id === squad.targetId && active(unit));
  if (!target) return;
  const cautious = army.doctrine === 'cautious' || (army.doctrine === 'balanced' && army.aggression < 32);
  const aggressive = army.doctrine === 'aggressive' || (army.doctrine === 'balanced' && army.aggression > 72);
  if (cautious && squad.soldiers <= Math.max(1, squad.maxSoldiers * 0.22) && squad.hp < squad.maxHp * 0.16 &&
      squad.morale < 39 && squad.type !== 'commander') {
    squad.morale = 0;
    squad.routing = true;
    clearPath(squad);
    return;
  }
  if (squad.type === 'medic' || squad.type === 'engineer' || (squad.type === 'commander' && !aggressive)) {
    let escort = null;
    for (const unit of battle.squads) {
      if (unit.armyId !== squad.armyId || !fighting(unit) || unit === squad ||
          unit.type === 'medic' || unit.type === 'engineer' || unit.type === 'commander') continue;
      if (!escort || distance(unit, target) < distance(escort, target)) escort = unit;
    }
    if (escort) {
      const supportX = escort.x + (army.side === 0 ? -1 : 1) * (squad.type === 'commander' ? 42 : 53);
      const supportY = escort.y + (squad.type === 'medic' ? 36 : -28);
      if (distance(squad, { x: supportX, y: supportY }) > 30) advance(battle, squad, { x: supportX, y: supportY }, dt);
      return;
    }
  }
  if (cautious && battle.elapsed < 24 && UNIT_TYPES[squad.type].range > 60) {
    const safeZones = battle.zones.filter(zone => army.side === 0 ? zone.x < WIDTH / 2 : zone.x + zone.w > WIDTH / 2);
    const nearest = safeZones.sort((a, b) => Math.abs(a.y + a.h / 2 - squad.y) - Math.abs(b.y + b.h / 2 - squad.y))[0];
    if (nearest) {
      advance(battle, squad, { x: nearest.x + nearest.w / 2, y: nearest.y + nearest.h / 2 }, dt);
      return;
    }
  }
  const flanking = squad.type === 'raider' && battle.elapsed < 34 && distance(squad, target) > 125;
  const offsetY = flanking ? (squad.y < HEIGHT / 2 ? -83 : 83) : 0;
  advance(battle, squad, { x: target.x, y: target.y + offsetY }, dt);
}

function manual(battle, squad, order, dt) {
  if (order.type === 'move') {
    return advance(battle, squad, order, dt) && (!Number.isFinite(order.heading) || turnToward(squad, order.heading, dt));
  }
  if (order.type === 'attack') {
    const target = battle.squads.find(unit => unit.id === order.targetId && active(unit));
    if (target) {
      const mode = availableAttack(battle, squad, target, order);
      if (mode) attack(battle, squad, target, mode, dt);
      else {
        if (squad.aimTargetId != null) clearAim(squad);
        advance(battle, squad, target, dt);
      }
      return false;
    }
    const obstacle = battle.obstacles.find(item => item.id === order.targetId && item.health > 0);
    if (!obstacle) return true;
    attackStructure(battle, squad, obstacle, order, dt);
    return false;
  }
  const fixedFacing = order.type === 'hold' || order.type === 'face';
  if (fixedFacing && Number.isFinite(order.heading) && !turnToward(squad, order.heading, dt)) return false;
  const enemy = bestEnemy(battle, squad, true, order, fixedFacing);
  if (enemy) {
    const mode = availableAttack(battle, squad, enemy, order, fixedFacing);
    if (mode) attack(battle, squad, enemy, mode, dt, fixedFacing);
    return false;
  }
  if (fixedFacing) return squad.orders.length > 1;
  if (squad.aimTargetId != null) clearAim(squad);
  return advance(battle, squad, order, dt) && (!Number.isFinite(order.heading) || turnToward(squad, order.heading, dt));
}

function updateSquad(battle, squad, army, dt, overwhelmed) {
  if (!active(squad)) return;
  squad.supplied = army.supplied;
  squad.cooldown = Math.max(0, squad.cooldown - dt);
  squad.abilityCooldown = Math.max(0, squad.abilityCooldown - dt);
  squad.fireFlash = Math.max(0, squad.fireFlash - dt);
  squad.suppression = Math.max(0, squad.suppression - dt);
  squad.jammed = Math.max(0, squad.jammed - dt);
  squad.boost = Math.max(0, squad.boost - dt);
  squad.repath = Math.max(0, squad.repath - dt);
  squad.aiTime = Math.max(0, squad.aiTime - dt);

  if (overwhelmed && !squad.orders.length && !squad.locked) squad.morale = Math.max(0, squad.morale - dt * 7.4);
  if (!squad.routing && squad.morale <= HOLD_MORALE - army.discipline * 0.085 - army.loyalty * 0.025) {
    squad.routing = true;
    squad.orders = [];
    squad.locked = false;
    squad.facingLocked = false;
    clearPath(squad);
    clearAim(squad);
  }
  if (squad.routing) {
    const escape = { x: army.side === 0 ? 14 : WIDTH - 14, y: squad.y };
    if (advance(battle, squad, escape, dt) && distance(squad, escape) <= 12) squad.withdrawn = true;
    return;
  }
  const moraleRate = squad.supplied ? 0.52 : 0.18;
  if (squad.morale < 100 && squad.suppression === 0) squad.morale = Math.min(100, squad.morale + dt * moraleRate);
  const order = squad.orders[0];
  if (order) {
    if (manual(battle, squad, order, dt)) {
      squad.orders.shift();
      squad.locked = squad.orders.length === 0 && (order.type === 'move' || order.type === 'attackMove');
      squad.facingLocked = squad.locked && Number.isFinite(order.heading);
      clearPath(squad);
      clearAim(squad);
    }
  } else if (squad.locked) {
    const facing = squad.facingLocked === true;
    const enemy = bestEnemy(battle, squad, true, null, facing);
    if (enemy) {
      const mode = availableAttack(battle, squad, enemy, null, facing);
      if (mode) attack(battle, squad, enemy, mode, dt, facing);
    }
  } else {
    autonomous(battle, squad, army, dt);
  }
}

function spreadSquads(battle, dt) {
  const units = battle.squads.filter(active);
  for (let left = 0; left < units.length; left++) {
    const a = units[left];
    for (let right = left + 1; right < units.length; right++) {
      const b = units[right];
      if (a.houseId !== b.houseId || a.routing || b.routing) continue;
      const gap = distance(a, b);
      const spacing = a.formation === 'column' || b.formation === 'column' ? 17 : 27;
      if (gap >= spacing) continue;
      const angle = gap > 0.001 ? Math.atan2(a.y - b.y, a.x - b.x) : 1.13 * (right + left);
      const push = Math.min((spacing - gap) * 0.5, 26 * dt);
      const dx = Math.cos(angle) * push;
      const dy = Math.sin(angle) * push;
      if (!stationary(a) && walkable(battle, a.x + dx, a.y + dy)) {
        a.x += dx;
        a.y += dy;
      }
      if (!stationary(b) && walkable(battle, b.x - dx, b.y - dy)) {
        b.x -= dx;
        b.y -= dy;
      }
    }
  }
}

function breakingHouses(squads) {
  const forces = new Map();
  let total = 0;
  for (const squad of squads) {
    let force = forces.get(squad.houseId);
    if (!force) {
      force = { deployed: 0, current: 0 };
      forces.set(squad.houseId, force);
    }
    force.deployed += (squad.deployedSoldiers ?? squad.maxSoldiers) * UNIT_TYPES[squad.type].hp;
    if (!fighting(squad)) continue;
    force.current += squad.hp;
    total += squad.hp;
  }
  const breaking = [...forces].filter(([, force]) => force.current < force.deployed * 0.25 && total - force.current > force.current * 1.9);
  return new Set(breaking.map(([houseId]) => houseId));
}

function battleStep(battle, dt) {
  battle.elapsed += dt;
  for (const effect of battle.effects) effect.life -= dt;
  battle.effects = battle.effects.filter(effect => effect.life > 0);
  const commanders = new Map(battle.armies.map(army => [army.id, army]));
  const breaking = breakingHouses(battle.squads);
  // Alternating team order gives both sides first action over successive steps.
  const even = Math.round(battle.elapsed * 20) % 2 === 0;
  const squads = even ? battle.squads : [...battle.squads].reverse();
  for (const squad of squads) updateSquad(battle, squad, commanders.get(squad.armyId), dt, breaking.has(squad.houseId));
  spreadSquads(battle, dt);
  const stillFighting = new Set(battle.squads.filter(fighting).map(squad => squad.houseId));
  if (stillFighting.size <= 1 || battle.elapsed >= 480) {
    for (const squad of battle.squads) if (squad.routing) squad.withdrawn = true;
    battle.winner = stillFighting.size === 1 ? stillFighting.values().next().value : 'draw';
    for (const squad of battle.squads) {
      if (squad.soldiers > 0) squad.xp = Math.min(20, squad.xp + (squad.houseId === battle.winner ? 1.9 : 0.75));
    }
  }
}

export function tickBattle(battle, dt) {
  if (!Number.isFinite(dt) || dt <= 0 || battle.winner !== null) return;
  const step = 0.05;
  const available = battle.pendingTime + dt;
  const steps = Math.floor((available + 1e-9) / step);
  battle.pendingTime = Math.max(0, available - steps * step);
  if (battle.pendingTime < 1e-9) battle.pendingTime = 0;
  for (let index = 0; index < steps && battle.winner === null; index++) {
    battleStep(battle, step);
  }
  if (battle.winner !== null) battle.pendingTime = 0;
}
