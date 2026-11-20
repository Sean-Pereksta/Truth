const RADIUS = 205;
const ORIGIN = -210;
const STEP = 3;
const SIZE = 141;
const TAU = Math.PI * 2;
const CELL = 8;
const { sin, cos, abs, min, max, hypot, floor } = Math;

export const soloArenas = ["Crownwood Basin", "Redstone Gorge", "Frostveil Pass"];

const zones = [
  ["Cornucopia Plaza", "Forest Ridge", "Reed Basin", "Stone Terraces", "Outer Groves"],
  ["Cornucopia Plaza", "Needle Canyon", "Copperwash Oasis", "The Step Mesas", "Juniper Shelf"],
  ["Cornucopia Plaza", "Firline Ridge", "Meltwater Basin", "Blueglass Cirque", "The High Saddle"]
];

const dimensions = {
  cornucopia: [14, 7.5, 15], platform: [2.56, 0.27, 2.56], cache: [1.65, 0.77, 0.88],
  weapon_table: [2.4, 0.80, 1.05], stove: [1.22, 1.28, 1.22], spring: [1.9, 0.8, 1.5],
  watchtower: [3.7, 10.3, 3.7], ruin: [4.18, 2.71, 1.06], aqueduct: [11.42, 4.9, 1.65],
  floodgate: [8.65, 3.4, 1.02], bridge: [3, 0.1, 5], sand_arch: [9.6, 5.9, 2.6],
  signal_lodge: [6.3, 5.5, 4.5], oak: [0.79, 7.3, 0.79], birch: [0.37, 6.4, 0.37],
  pine: [0.62, 9.2, 0.62], pinon: [0.56, 5.2, 0.56], snow_fir: [0.62, 9.2, 0.62],
  rock: [3.45, 2.1, 3.23], boulder: [4.2, 3.65, 4.15], mesa_rock: [4.35, 3.9, 3.5],
  sand_hoodoo: [2.82, 6.8, 2.56], snow_boulder: [3.9, 2.05, 3.2], ice_teeth: [4.6, 5.9, 3.5],
  bush: [2.4, 1.45, 2.4], reed: [1.7, 1.7, 1.7], grass: [1.7, 0.6, 1.7],
  yucca: [2.14, 1.2, 2.14], snow_heath: [2.14, 1.2, 2.14], rushes: [1.42, 1.08, 1.42]
};

const resourceTypes = {
  oak: "tree", birch: "tree", pine: "tree", pinon: "tree", snow_fir: "tree",
  rock: "stone", boulder: "stone", mesa_rock: "stone", sand_hoodoo: "stone",
  snow_boulder: "stone", ice_teeth: "stone", bush: "berry", reed: "fiber", grass: "fiber",
  yucca: "fiber", snow_heath: "berry", rushes: "fiber"
};

const regionalModels = [
  ["pine pine pine birch boulder rock bush", "birch birch reed reed bush rock",
    "rock rock boulder pine birch grass", "oak oak oak birch bush grass rock"],
  ["mesa_rock mesa_rock sand_hoodoo yucca yucca pinon", "pinon pinon rushes yucca bush mesa_rock",
    "mesa_rock mesa_rock sand_hoodoo sand_hoodoo yucca pinon", "pinon pinon pinon yucca yucca mesa_rock"],
  ["snow_fir snow_fir snow_fir snow_fir snow_heath snow_boulder", "snow_fir snow_fir snow_heath rushes snow_boulder ice_teeth",
    "ice_teeth ice_teeth snow_boulder snow_boulder snow_heath snow_fir", "snow_fir snow_fir snow_fir snow_heath snow_heath snow_boulder"]
].map(arena => arena.map(list => list.split(" ")));

const landmarkSites = [
  [["floodgate", 85.5, -17, 1, 0.17, "Basin floodgate"], ["watchtower", -126, 29, 1, 0.2, "Ridge watchtower"],
    ["watchtower", 126, 35, 1, 0.15, "Basin watchtower"], ["aqueduct", -26, -102, 1, 1, "Old aqueduct"]],
  [["sand_arch", -52, -12, 1.36, 0.92, "Needle Canyon arch"], ["sand_arch", 41, -81, 1.48, 0.14, "Mesa arch"],
    ["sand_arch", -112, 63, 1.15, -0.62, "Juniper arch"], ["watchtower", 62, 80, 0.93, 0.55, "Shelf watchtower"],
    ["aqueduct", -52, -144, 0.92, 0.72, "Old aqueduct"]],
  [["signal_lodge", -27, -47, 1.05, 0.56, "Cirque signal lodge"], ["signal_lodge", 33, 114, 0.98, -0.82, "Saddle signal lodge"],
    ["watchtower", -110, 83, 1.02, 0.32, "Firline watchtower"], ["aqueduct", -53, -62, 1.1, 1.2, "Old aqueduct"]]
];

// The three arena profiles use the same regional gradients, rings, channels and
// district names as Terrain.cs and Terrain.Variants.cs in the Windows game.
function smooth(start, end, value) {
  const t = max(0, min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function sector(x, z) {
  if (abs(x) > abs(z)) return x < 0 ? 1 : 2;
  return z < 0 ? 3 : 4;
}

function polar(district, forward, side) {
  if (district === 1) return [-forward, side];
  if (district === 2) return [forward, side];
  return [side, district === 3 ? -forward : forward];
}

function routeCenter(arena, f, district) {
  if (arena === 1) return (14.5 * sin(f * 0.057 + district * 0.61) + 5.5 * sin(f * 0.103 - district)) * smooth(17, 53, f);
  if (arena === 2) return (21 * sin(f * 0.032 + district * 1.35) + 6.5 * cos(f * 0.081 - district)) * smooth(19, 68, f);
  return (4.9 * sin(f * 0.072 + district * 0.72) + 2.2 * sin(f * 0.157 - district)) * smooth(16, 43, f);
}

function pathAt(arena, x, z, r, f, side, district) {
  if (r < 20) return 0;
  const center = routeCenter(arena, f, district);
  const near = abs(side - center);
  if (arena) {
    const alternate = center + (arena === 1 ? -1 : 1) * (16 + 5 * sin(f * 0.065 + district));
    const ring = arena === 1 ? 78 + 14 * sin(x * 0.034) + 9 * cos(z * 0.031) : 98 + 18 * sin(x * 0.024 - z * 0.032);
    const outer = 169 + 10 * sin(x * 0.032 + z * 0.019);
    return max(1 - smooth(2, 5.5, near), 0.88 * (1 - smooth(1, 2.95, abs(side - alternate))),
      0.84 * (1 - smooth(1.4, 4, abs(r - ring))), 0.67 * (1 - smooth(1.15, 3.8, abs(r - outer))));
  }
  const alternate = center + 12 + 3 * sin(f * 0.102 + district);
  const ring = 60 + 3 * sin(x * 0.055) + 2 * cos(z * 0.081);
  const outer = 94 + 3.5 * sin(z * 0.063);
  const far = 173 + 6 * sin(x * 0.036) + 3 * cos(z * 0.043);
  return max(1 - smooth(2.5, 5.9, near), 0.75 * (1 - smooth(0.85, 2.4, abs(side - alternate))),
    0.90 * (1 - smooth(1.1, 3.1, abs(r - ring))), 0.66 * (1 - smooth(1, 2.7, abs(r - outer))),
    0.78 * (1 - smooth(1.3, 4, abs(r - far))));
}

function basin(arena, x) {
  if (arena === 1) return [8 + 18 * sin(x * 0.038 - 0.95) + 6 * sin(x * 0.087),
    3.2 + 5.7 * (1 - smooth(2, 29, abs(x - 112))), -0.92 - 0.012 * (x - 65)];
  return [-8 + 18 * sin(x * 0.032 + 0.45) - 7 * cos(x * 0.075),
    4.4 + 7.2 * (1 - smooth(1, 31, abs(x - 147))), 1.82 - 0.012 * (x - 65)];
}

function stream(arena, district, side) {
  const v = max(-96, min(96, side));
  const depth = 0.17 + (0.99 + 0.30 * sin(side * 0.076 + district)) * smooth(2.5, 8, min(abs(side - 38), abs(side + 46)));
  if (arena === 1) return [(district === 1 ? 127 : district === 3 ? 164 : 143) + 11 * sin(v * 0.044 + district * 0.9) + 4.2 * cos(v * 0.088),
    2.4 + 0.90 * (0.5 + 0.5 * sin(side * 0.085)), (district === 1 ? 2.9 : district === 3 ? 7.7 : 3.4) - 0.013 * v, depth * 1.13];
  if (arena === 2) return [(district === 1 ? 164 : district === 3 ? 123 : 155) + 8 * sin(v * 0.058 - district * 0.7) + 3.6 * sin(v * 0.104 + district),
    3.2 + 0.66 * cos(side * 0.09 + district), (district === 1 ? 7.8 : district === 3 ? 3.4 : 6.1) - 0.014 * v, depth * 0.92];
  const phase = district * 0.78;
  const reach = district === 1 ? 148 : district === 3 ? 140 : 154;
  return [reach + 8.4 * sin(v * 0.034 + phase) + 4.7 * sin(v * 0.084 - phase) + 1.5 * cos(v * 0.136),
    3.1 + 0.54 * sin(v * 0.127 + district) + 0.28 * cos(v * 0.047 + district),
    (district === 1 ? 3.8 : district === 3 ? 5.4 : 1.08) + v * (district === 4 ? 0.0065 : -0.008), depth];
}

function crownwoodHeight(x, z, r, path) {
  const rough = (sin(x * 0.085 + z * 0.031) * cos(z * 0.092) + 0.5 * sin(x * 0.173 - z * 0.072)) * (1.25 - 0.5 * path);
  const ridge = smooth(18, 68, -x) * smooth(-22, 19, -x - abs(z) * 0.66);
  const terrace = smooth(15, 69, -z) * smooth(-19, 15, -z - abs(x) * 0.58);
  const grove = smooth(17, 64, z) * smooth(-22, 21, z - abs(x) * 0.68);
  const lowland = smooth(20, 58, x) * smooth(-15, 20, x - abs(z) * 0.70);
  const channel = z - (3 + sin(x * 0.058) * 9);
  const bank = 1 - smooth(4, 16, abs(channel));
  const steps = 1.55 * smooth(42, 47, -z) + 1.82 * smooth(62, 69, -z) + 2.15 * smooth(83, 89, -z);
  const hills = ridge * (4 + 4.8 * sin(z * 0.051 + x * 0.032) + 2.25 * cos(x * 0.088));
  const ground = rough + hills + terrace * (steps + 1) + grove * (1.9 + 1.7 * sin(x * 0.055))
    + lowland * (-1.5 - 2.25 * bank + 0.54 * cos(z * 0.15));
  return smooth(22, 41, r) * ground + smooth(202, 225, r) * (6 + 3.2 * sin(x * 0.071 + z * 0.039));
}

function variantHeight(arena, x, z, r, f, side, district, path) {
  const rim = smooth(188, 230, r);
  const rough = sin(x * 0.091 + z * 0.031) * cos(z * 0.101 - x * 0.021) + 0.5 * sin(x * 0.151 - z * 0.079);
  const off = abs(side - routeCenter(arena, f, district));
  const profile = (cx, cz, w, d) => hypot((x - cx) / w, (z - cz) / d);
  if (arena === 1) {
    const shelf = smooth(12, 24, off) * smooth(34, 76, f);
    const mesas = 3 - smooth(0.57, 1.08, profile(-91, 59, 43, 35)) - smooth(0.55, 1.06, profile(62, -119, 43, 36))
      - smooth(0.58, 1.10, profile(37, 131, 33, 48));
    const levels = 2.6 * smooth(0, 0.37, mesas) + 4.2 * smooth(0.38, 0.62, mesas) + 4.1 * smooth(0.66, 0.94, mesas);
    return 0.8 + rough * (1.55 - 0.62 * path) + levels + shelf * (4.1 * (district === 1 ? 1 : 0.46) + 2.4 * (district === 3 ? 1 : 0.42))
      + smooth(65, 144, f) * (district === 3 ? 2.6 : 1.3) + rim * (8 + 5 * sin(x * 0.057 + z * 0.019));
  }
  const mountain = smooth(8, 45, off) * smooth(30, 96, f);
  const notch = 1 - smooth(10, 32, abs(r - (104 + 14 * sin(x * 0.027 - z * 0.041))));
  const peaks = 9 * (1 - smooth(0.08, 1.10, profile(-86, -73, 37, 49)))
    + 16 * (1 - smooth(0.1, 1.12, profile(73, -126, 45, 48))) + 13 * (1 - smooth(0.12, 1.14, profile(-73, 132, 40, 42)));
  const bowl = district === 3 ? 3.1 * smooth(62, 115, f) * (1 - smooth(12, 40, abs(side + 9))) : 0;
  return 2.35 + 0.99 * rough + smooth(32, 166, r) * 4 + mountain * (9.5 - 5.2 * notch)
    + peaks - bowl + rim * (12 + 6 * cos(x * 0.043 - z * 0.03));
}

function terrainSample(arena, x, z) {
  const r = hypot(x, z);
  const district = sector(x, z);
  const f = district < 3 ? abs(x) : abs(z);
  const side = district < 3 ? z : x;
  const path = pathAt(arena, x, z, r, f, side, district);
  let height = arena ? variantHeight(arena, x, z, r, f, side, district, path) : crownwoodHeight(x, z, r, path);
  let level = -Infinity;
  let flood = -Infinity;
  if (district === 2 && arena && x > 33) {
    const [line, width, basinLevel] = basin(arena, x);
    const distance = abs(z - line);
    const margin = distance - width;
    const depth = 0.17 + 1.12 * smooth(2, 9, min(abs(x - 91), abs(x - 156)));
    const bed = margin < 0 ? basinLevel - depth * (1 - smooth(0.18, 1, distance / width)) : basinLevel + min(2.2, margin * 0.31);
    height += (bed - height) * (1 - smooth(4, 20, margin)) * smooth(33, 46, x);
    if (x >= 38 && margin < 6) {
      level = basinLevel;
      flood = level + 0.85;
    }
  } else if (district === 2 && x >= 35 && abs(z) <= x * 0.84) {
    level = -2.26;
    flood = -1.41;
  } else if (district !== 2 && f >= 105 && f <= 197 && abs(side) <= 117) {
    const [center, width, streamLevel, depth] = stream(arena, district, side);
    const distance = hypot(f - center, max(0, abs(side) - 96));
    const margin = distance - width;
    if (abs(side) < 117 && (arena ? f > 105 && f < 197 : r > 111 && f > 106 && f < 195)) {
      const bed = margin < 0 ? streamLevel - depth * (1 - smooth(0.18, 1, distance / width))
        : streamLevel + min(arena ? 1.9 : 1.95, margin * (arena ? 0.28 : 0.30));
      height += (bed - height) * (1 - smooth(arena ? 4.1 : 4, arena ? 19 : 16, margin));
    }
    if (f >= 106 && f <= 195 && margin < 4.1) level = flood = streamLevel;
  }
  if (arena) height *= smooth(22, 46, r);
  return { height, path, level, flood };
}

const terrainByArena = new Map();

function makeTerrain(arena) {
  if (terrainByArena.has(arena)) return terrainByArena.get(arena);
  const terrain = { originX: ORIGIN, originZ: ORIGIN, step: STEP, size: SIZE,
    heights: new Float32Array(SIZE ** 2), paths: new Float32Array(SIZE ** 2), waters: [], floodWaters: [] };
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const { height, path, level, flood } = terrainSample(arena, ORIGIN + STEP * i, ORIGIN + STEP * j);
      const index = j * SIZE + i;
      terrain.heights[index] = height;
      terrain.paths[index] = path;
      terrain.waters[index] = level > height + 0.025 ? level : null;
      terrain.floodWaters[index] = flood > height + 0.025 ? flood : null;
    }
  }
  terrainByArena.set(arena, terrain);
  return terrain;
}

function sampleHeight(terrain, x, z) {
  const i = max(0, min(SIZE - 1.001, (x - ORIGIN) / STEP));
  const j = max(0, min(SIZE - 1.001, (z - ORIGIN) / STEP));
  const ic = floor(i);
  const jc = floor(j);
  const a = jc * SIZE + ic;
  const u = i - ic;
  const v = j - jc;
  const { heights } = terrain;
  // Interpolate the same diagonal used for the rendered triangles.
  if (u > v) return heights[a] * (1 - u) + heights[a + 1] * (u - v) + heights[a + SIZE + 1] * v;
  return heights[a] * (1 - v) + heights[a + SIZE] * (v - u) + heights[a + SIZE + 1] * u;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSoloWorld(seed, arena = 0) {
  if (!Number.isInteger(arena) || !soloArenas[arena]) arena = 0;
  const random = seededRandom(seed);
  const range = (low, high) => low + (high - low) * random();
  const terrain = makeTerrain(arena);
  const props = [];
  const nodes = [];
  const caches = [];
  const waterSources = [];
  const wildlife = [];
  const landmarks = [];
  const spawns = [];
  const collisions = new Map();
  const bridges = [];
  const terrainHeight = (x, z) => sampleHeight(terrain, x, z);
  const heightAt = (x, z) => {
    let height = terrainHeight(x, z);
    for (const bridge of bridges) {
      const dx = x - bridge[1];
      const dz = z - bridge[3];
      const angle = bridge[5];
      if (abs(cos(angle) * dx - sin(angle) * dz) <= bridge[6] / 2
          && abs(sin(angle) * dx + cos(angle) * dz) <= bridge[8] / 2) height = max(height, bridge[2] + bridge[7]);
    }
    return height;
  };
  const surfaceAt = (x, z, flood = false) => {
    const sample = terrainSample(arena, x, z);
    const surface = flood ? sample.flood : sample.level;
    return surface > heightAt(x, z) + 0.025 ? surface : -Infinity;
  };
  const zoneAt = (x, z) => zones[arena][hypot(x, z) < 22 ? 0 : sector(x, z)];
  const cellKey = (x, z) => `${floor(x / CELL)},${floor(z / CELL)}`;
  const block = (index, x, z, rad) => {
    const lowX = floor((x - rad) / CELL);
    const highX = floor((x + rad) / CELL);
    const lowZ = floor((z - rad) / CELL);
    const highZ = floor((z + rad) / CELL);
    for (let cx = lowX; cx <= highX; cx++) {
      for (let cz = lowZ; cz <= highZ; cz++) {
        const key = `${cx},${cz}`;
        if (!collisions.has(key)) collisions.set(key, []);
        collisions.get(key).push({ index, x, z, radius: rad });
      }
    }
  };
  const canOccupy = (x, z, removed) => hypot(x, z) < RADIUS && !(collisions.get(cellKey(x, z)) ?? [])
    .some(body => !removed?.has(body.index) && hypot(x - body.x, z - body.z) < body.radius);

  function clearSight(from, to, eye, end, removed) {
    const dx = to.x - from.x, dz = to.z - from.z, lengthSq = dx * dx + dz * dz;
    if (lengthSq < 0.0001) return true;
    const steps = Math.ceil(Math.sqrt(lengthSq) / 1.5);
    let lastCell;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = from.x + dx * t, z = from.z + dz * t;
      if (i && i < steps && terrainHeight(x, z) > eye + (end - eye) * t) return false;
      const key = cellKey(x, z);
      if (key === lastCell) continue;
      lastCell = key;
      for (const body of collisions.get(key) || []) {
        if (removed.has(body.index)) continue;
        const along = max(0, min(1, ((body.x - from.x) * dx + (body.z - from.z) * dz) / lengthSq));
        const height = eye + (end - eye) * along, prop = props[body.index];
        if (height < prop[2] || height > prop[2] + prop[7]) continue;
        const offsetX = from.x + dx * along - body.x, offsetZ = from.z + dz * along - body.z;
        if (offsetX * offsetX + offsetZ * offsetZ < body.radius * body.radius) return false;
      }
    }
    return true;
  }

  function add(model, x, z, { scale = 1, yaw = 0, y = terrainHeight(x, z), kind = "decor", lit = false, solid = 0 } = {}) {
    const [w, h, d] = dimensions[model] ?? [0.62, 0.35, 0.57];
    const index = props.length;
    const record = [model, x, y, z, scale, yaw, w * scale, h * scale, d * scale, kind, lit, -1, 0, false, model];
    props.push(record);
    if (solid) block(index, x, z, solid);
    if (model === "bridge") bridges.push(record);
    return index;
  }

  function addCache(model, x, z, items) {
    const kind = model === "cache" ? "cache" : "pickup";
    const propIndex = add(model, x, z, { kind, yaw: random() * TAU, y: heightAt(x, z) + 0.035 });
    caches.push({ x, z, propIndex, items });
  }

  const horn = add("cornucopia", 0, 0);
  block(horn, -5.3, -3, 1.1);
  block(horn, 5.3, -3, 1.1);
  block(horn, 0.7, -8.5, 2.1);
  landmarks.push({ x: 0, z: 0, name: "Bronze Cornucopia" });
  for (let i = 0; i < 24; i++) {
    const angle = i * TAU / 24;
    const x = sin(angle) * 18;
    const z = cos(angle) * 18;
    spawns.push({ x, z, yaw: angle + Math.PI });
    add("platform", x, z, { yaw: angle + Math.PI });
  }

  for (const [x, z, weapon, ammo, supply] of [
    [-4.9, 8.65, "spear", {}, { stone: 4, bandage: 1 }], [4.9, 8.65, "hatchet", {}, { arrows: 4, cloth: 2 }],
    [-9.15, -1.75, "shield", {}, { fiber: 3, bandage: 1 }], [9.15, -1.75, "sling", { stone: 5 }, { tinder: 2 }],
    [-3.38, 3, "sword", {}, { cloth: 2, branch: 2 }], [3.10, 3.72, "spear", {}, { fiber: 2, scrap: 2 }],
    [-2.18, -4.06, "bow", { arrows: 8 }, { bandage: 2 }], [2.65, -6.3, "knife", {}, { meal: 2 }],
    [-7.95, -8.82, "sword", {}, { shield: 1, bandage: 1 }], [7.95, -8.82, "bow", { arrows: 3 }, { fiber: 2 }],
    [-4.72, -13.38, "sling", { stone: 5 }, { cloth: 1 }], [4.72, -13.38, "hatchet", {}, { tinder: 2, bandage: 1 }]
  ]) {
    if (hypot(x, z) < 11) add("weapon_table", x, z - 0.6);
    addCache(weapon, x, z, { [weapon]: 1, ...ammo });
    addCache("cache", x + 0.65, z + 1.3, supply);
  }

  for (const [id, x, z, scale, yaw, name] of landmarkSites[arena]) {
    add(id, x, z, { scale, yaw, solid: id === "signal_lodge" ? 1.9 : 0 });
    landmarks.push({ x, z, name });
  }

  function crossStream(x, z, level, yaw, segments) {
    for (let i = 0; i < segments; i++) {
      const offset = (i - (segments - 1) / 2) * 4.92;
      add("bridge", x + sin(yaw) * offset, z + cos(yaw) * offset, { y: level + 0.34, yaw });
    }
  }

  if (arena) {
    const x = arena === 1 ? 75 : 94;
    const [z, , level] = basin(arena, x);
    crossStream(x, z, level, 0, arena === 1 ? 3 : 4);
  } else {
    crossStream(74, -5.75, -1.68, 0, 6);
    for (let i = 0; i < 10; i++) {
      add("ruin", (i % 2 ? 1 : -1) * (9 + (i % 3) * 4.1), -43 - floor(i / 2) * 10.5,
        { scale: range(0.84, 1.25), yaw: range(-0.5, 0.5) });
    }
  }

  const springs = [[-37, 6], [41, -13], [3, -44], [-5, 38]];
  const stoves = [[-31, 16], [40, 19], [-9, -52], [24, 62]];
  for (let district = 1; district <= 4; district++) {
    const near = routeCenter(arena, 48, district);
    const [x, z] = arena ? polar(district, 42 + 2 * district, near + (district % 2 ? 7 : -7)) : springs[district - 1];
    const propIndex = add("spring", x, z, { kind: "water", yaw: district * 0.92 });
    waterSources.push({ x, z, propIndex, name: "Freshwater spring" });
    const [fx, fz] = arena ? polar(district, 33 + 5 * district, near + (district % 2 ? -8 : 7)) : stoves[district - 1];
    add("stove", fx, fz, { kind: "stove", lit: true, yaw: district * 0.65, solid: 0.62 });
    if (district !== 2) {
      const side = arena === 1 ? 11 : arena === 2 ? -13 : 0;
      const [center, , level] = stream(arena, district, side);
      const [bx, bz] = polar(district, center, side);
      crossStream(bx, bz, level, district === 1 ? Math.PI / 2 : 0, 2);
    }
  }

  const open = (x, z, dryLimit = 0.26) => hypot(x, z) > 22 && hypot(x, z) < RADIUS - 3 && canOccupy(x, z)
    && surfaceAt(x, z) - heightAt(x, z) < dryLimit;

  for (let district = 1; district <= 4; district++) {
    const cacheSide = routeCenter(arena, 28, district) + (district % 2 ? 2.5 : -2.5);
    const [cacheX, cacheZ] = polar(district, 28, cacheSide);
    const startingItems = [{ spear: 1, fiber: 2 }, { hatchet: 1, bandage: 1 },
      { spear: 1, cloth: 1 }, { hatchet: 1, bandage: 1 }][district - 1];
    addCache("cache", cacheX, cacheZ, startingItems);
    const models = regionalModels[arena][district - 1];
    for (let i = 0; i < 250; i++) {
      const f = range(25, 201);
      const [x, z] = polar(district, f, range(-f, f));
      if (hypot(x - cacheX, z - cacheZ) < 2.6 || !open(x, z)
          || pathAt(arena, x, z, hypot(x, z), f, district < 3 ? z : x, district) > 0.61) continue;
      const model = models[floor(random() * models.length)];
      const type = resourceTypes[model];
      const plant = type === "berry" || type === "fiber";
      const scale = range(0.68, 1.31);
      const solid = type === "tree" ? scale * 0.65 : type === "stone" ? scale * 1.45 : 0;
      const propIndex = add(model, x, z, { scale, kind: plant ? "vegetation" : "decor", yaw: random() * TAU, solid });
      if (type && (!plant || i % 3 === 0)) nodes.push({ x, z, propIndex, type });
    }
    for (let i = 0; i < 12; i++) {
      const f = i === 0 ? 25 : i === 1 ? 32 : range(34, 184);
      const side = i < 2 ? routeCenter(arena, f, district) + (i ? -3 : 3) : range(-0.56 * f, 0.56 * f);
      const [cx, cz] = polar(district, f, side);
      const supplies = [["branch", 4], ["stone", 4], ["fiber", 3], ["tinder", 2], ["cloth", 2], ["scrap", 2]];
      for (const [item, count] of supplies) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const x = cx + range(-3.6, 3.6);
          const z = cz + range(-3.6, 3.6);
          if (!open(x, z)) continue;
          addCache(item, x, z, { [item]: count });
          break;
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const f = range(32, 176);
      const [x, z] = polar(district, f, range(-0.42 * f, 0.42 * f));
      if (!open(x, z)) continue;
      const model = ["hare", "hen", "grazer"][i % 3];
      wildlife.push({ model, x, z, yaw: random() * TAU, health: [17, 16, 52][i % 3] });
    }
  }

  const rare = seededRandom((seed >>> 0) ^ (arena * 1009) ^ 0x43bc27);
  const fieldSites = caches.filter(cache => cache.items.scrap && hypot(cache.x, cache.z) >= 42 && hypot(cache.x, cache.z) <= 118);
  if (rare() < 1 / 3 && fieldSites.length) {
    const site = fieldSites[floor(rare() * fieldSites.length)];
    site.items = { crossbow: 1, bolts: 4 };
    props[site.propIndex][14] = props[site.propIndex][0] = "crossbow";
  }

  return { arena, radius: RADIUS, terrain, props, landmarks, caches, nodes, waterSources, wildlife,
    spawns, heightAt, surfaceAt, zoneAt, canOccupy, clearSight, random };
}
