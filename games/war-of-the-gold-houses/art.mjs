import { HOUSES, PLANETS, PLANET_GROUPS, REGIONS } from './content.mjs';
import { getPlanetControl, getSupplyStatus } from './game.mjs';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 540;
const TAU = Math.PI * 2;
const TERRAIN = {
  desert: { ground: '#9d654a', shade: '#875541', light: '#b97c52', rock: '#684738', detail: '#d89b58' },
  mountain: { ground: '#59636a', shade: '#4a505b', light: '#687881', rock: '#353e4e', detail: '#a3b2ae' },
  urban: { ground: '#546169', shade: '#454e57', light: '#637178', rock: '#263b45', detail: '#9c9274' },
  fortress: { ground: '#64534f', shade: '#554348', light: '#736153', rock: '#372d37', detail: '#bc9466' },
  industrial: { ground: '#655b4b', shade: '#514c48', light: '#75675a', rock: '#3a3a45', detail: '#c58e52' },
  mine: { ground: '#655048', shade: '#4b3c42', light: '#785955', rock: '#302a3a', detail: '#cf8966' },
  spaceport: { ground: '#515a65', shade: '#424957', light: '#5b6e7b', rock: '#283448', detail: '#90aab1' },
  ice: { ground: '#8195a2', shade: '#6c8697', light: '#9eb1b5', rock: '#3b576c', detail: '#d6ddd1' },
};
const EMBLEMS = {
  eagle: ['#...#', '##.##', '.###.', '..#.', '.#.#.'],
  blade: ['....#', '...##', '.###.', '..##.', '.#...'],
  fist: ['.###.', '#####', '####.', '.###.', '.##..'],
  crescent: ['..###', '.##..', '##...', '.##..', '..###'],
  eye: ['..#..', '.#.#.', '#####', '.#.#.', '..#..'],
};
const FALLBACK_HOUSE = { color: '#687c83', accent: '#d9dfc7', emblem: 'eye' };
const GROUND_STEP = 8;
const planetSprites = new Map();
const sectorLayouts = new Map();
const sectorBackdrops = new Map();
const tacticalBackdrops = new Map();
const soldierSprites = new Map();
const paintedAssets = new Map();
const squadMotion = new WeakMap();
const UNIT_FRAME_COUNT = 6;
const ATTACK_FRAME = 5;
const ATMOSPHERES = new Set(['earth', 'venus', 'jupiter', 'saturn', 'titan', 'uranus', 'neptune']);
const FORMATION_TYPES = ['assault', 'transport', 'battleship', 'carrier', 'destroyer', 'corvette'];
let stars;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const wrap = (value, size) => ((value % size) + size) % size;
const includes = (selection, id) => selection?.has?.(id) ?? selection?.includes?.(id) ?? false;
const house = (id) => HOUSES[id] ?? FALLBACK_HOUSE;
const simTime = (state, ui) => ui.time ?? state.elapsed ?? 0;

function hash(value) {
  let number = 2166136261;
  for (const char of String(value)) number = Math.imul(number ^ char.charCodeAt(0), 16777619);
  return number >>> 0;
}

function noise(x, y, seed) {
  let number = Math.imul(x + 183, 0x159733) ^ Math.imul(y + 97, 0x1781a7) ^ seed;
  number = Math.imul(number ^ (number >>> 12), 0x27d4eb2d);
  return ((number ^ (number >>> 15)) >>> 0) / 4294967296;
}

function paint(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function pixelPattern(ctx, rows, x, y, color, size = 1) {
  ctx.fillStyle = color;
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      if (row[dx] === '#') ctx.fillRect(Math.round(x) + dx * size, Math.round(y) + dy * size, size, size);
    }
  });
}

function surface(ctx, width, height) {
  const canvas = ctx.canvas?.ownerDocument?.createElement('canvas') ??
    (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : null);
  if (!canvas) return null;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawCached(ctx, cache, key, width, height, render, x = 0, y = 0, capacity = 20) {
  if (!cache.has(key)) {
    const canvas = surface(ctx, width, height);
    if (!canvas) {
      ctx.save();
      ctx.translate(x, y);
      render(ctx);
      ctx.restore();
      return;
    }
    render(canvas.getContext('2d'));
    if (cache.size >= capacity) cache.delete(cache.keys().next().value);
    cache.set(key, canvas);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cache.get(key), x, y);
}

function paintedAsset(path) {
  if (typeof Image !== 'function') return null;
  if (!paintedAssets.has(path)) {
    const request = { image: null };
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { request.image = image; };
    paintedAssets.set(path, request);
    image.src = new URL(`./assets/${path}.webp`, import.meta.url).href;
  }
  return paintedAssets.get(path).image;
}

function drawPainting(ctx, image, x, y, width, height, source) {
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  if (source) ctx.drawImage(image, source.x, 0, source.width, source.height, x, y, width, height);
  else ctx.drawImage(image, x, y, width, height);
  ctx.imageSmoothingEnabled = smoothing;
}

function fitPainting(ctx, image, bounds, flip = false, source) {
  const naturalWidth = source?.width ?? image.naturalWidth;
  const naturalHeight = source?.height ?? image.naturalHeight;
  const ratio = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight);
  const width = Math.max(1, Math.round(naturalWidth * ratio));
  const height = Math.max(1, Math.round(naturalHeight * ratio));
  ctx.save();
  ctx.translate(Math.round(bounds.x), Math.round(bounds.y));
  if (flip) ctx.scale(-1, 1);
  drawPainting(ctx, image, -Math.round(width / 2), -height + Math.round(height * (bounds.foot ?? .2)), width, height, source);
  ctx.restore();
}

function label(ctx, value, x, y, { color = '#f1e8c9', size = 12, align = 'center' } = {}) {
  ctx.font = `bold ${size}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#10141d';
  ctx.fillText(value, px + 1, py + 2);
  ctx.fillStyle = color;
  ctx.fillText(value, px, py);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, color, width = 1, fill = false) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function brackets(ctx, x, y, rx, ry, color, length = 8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = Math.round(x + sx * rx);
      const py = Math.round(y + sy * ry);
      ctx.moveTo(px - sx * length, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py - sy * length);
    }
  }
  ctx.stroke();
}

export function mapPoint(node) {
  return { x: 40 + (node?.x ?? .5) * 880, y: 40 + (node?.y ?? .5) * 460 };
}

export function planetAtPoint(state, point, exact = false) {
  let nearest = null;
  let minimum = Infinity;
  for (const planet of Object.values(PLANETS)) {
    if (!state.planets[planet.id]) continue;
    const center = mapPoint(planet);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    const radius = planet.radius ?? 26;
    const onLabel = !exact && Math.abs(point.y - (center.y + radius + 17)) <= 7 &&
      Math.abs(point.x - center.x) <= planet.name.length * 4;
    if ((distance <= radius + (exact ? 0 : 12) || onLabel) && distance < minimum) {
      nearest = planet;
      minimum = distance;
    }
  }
  return nearest;
}

export function battlePoint(battle, node, camera = {}) {
  const zoom = camera?.zoom ?? 1;
  const x = camera?.x ?? battle.width / 2;
  const y = camera?.y ?? battle.height / 2;
  return { x: MAP_WIDTH / 2 + (node.x - x) * MAP_WIDTH / battle.width * zoom,
    y: MAP_HEIGHT / 2 + (node.y - y) * MAP_HEIGHT / battle.height * zoom };
}

export function battleWorldPoint(battle, node, camera = {}) {
  const zoom = camera?.zoom ?? 1;
  const x = camera?.x ?? battle.width / 2;
  const y = camera?.y ?? battle.height / 2;
  return { x: x + (node.x - MAP_WIDTH / 2) * battle.width / MAP_WIDTH / zoom,
    y: y + (node.y - MAP_HEIGHT / 2) * battle.height / MAP_HEIGHT / zoom };
}

function progress(transit) {
  return clamp((transit.elapsed ?? 0) / Math.max(transit.duration ?? 1, .001), 0, 1);
}

function fleetTrack(fleet, fromId = fleet.transit.from, toId = fleet.transit.to) {
  const departure = PLANETS[fromId];
  const arrival = PLANETS[toId];
  const origin = mapPoint(departure);
  const destination = mapPoint(arrival);
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = clamp(distance * .2, 20, 94);
  const tilt = hash(fleet.id) % 2 ? 1 : -1;
  const control = { x: (origin.x + destination.x) / 2 + dy / distance * bend * tilt,
    y: clamp((origin.y + destination.y) / 2 - dx / distance * bend * tilt, 36, MAP_HEIGHT - 36) };
  const anchor = (point, planet) => {
    const length = Math.hypot(control.x - point.x, control.y - point.y) || 1;
    const offset = Math.min((planet?.radius ?? 24) + 20, length * .85);
    return { x: point.x + (control.x - point.x) * offset / length, y: point.y + (control.y - point.y) * offset / length };
  };
  const from = anchor(origin, departure);
  const to = anchor(destination, arrival);
  return { from, to, control };
}

function onTrack({ from, to, control }, amount) {
  return { x: lerp(lerp(from.x, control.x, amount), lerp(control.x, to.x, amount), amount),
    y: lerp(lerp(from.y, control.y, amount), lerp(control.y, to.y, amount), amount) };
}

function flightProgress(state, fleet) {
  const { transit } = fleet;
  const carry = fleet.engagement ? 0 : state.carry ?? 0;
  const delta = transit.returning ? -carry : carry;
  return clamp((transit.elapsed + delta) / Math.max(transit.duration, .001), 0, 1);
}

export function fleetPoint(state, fleet) {
  if (fleet.transit) return onTrack(fleetTrack(fleet), flightProgress(state, fleet));
  const previous = fleet.lastPort?.planetId;
  if (fleet.landing && previous && previous !== fleet.planetId) return fleetTrack(fleet, previous, fleet.planetId).to;
  const planet = PLANETS[fleet.planetId];
  const center = mapPoint(planet);
  const peers = Object.values(state.fleets).filter((candidate) => !candidate.transit &&
    candidate.planetId === fleet.planetId);
  const slot = peers.findIndex((candidate) => candidate.id === fleet.id);
  const angle = .36 + Math.max(slot, 0) * .76;
  const radius = (planet?.radius ?? 22) + 23 + Math.floor(slot / 7) * 9;
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * .88 };
}

export function armyPoint(state, army) {
  if (army.transit) {
    const from = mapPoint(REGIONS[army.transit.from]);
    const to = mapPoint(REGIONS[army.transit.to]);
    const amount = progress(army.transit);
    return { x: lerp(from.x, to.x, amount), y: lerp(from.y, to.y, amount) };
  }
  const centre = mapPoint(REGIONS[army.regionId]);
  const peers = Object.values(state.armies).filter((candidate) => candidate.regionId === army.regionId &&
    candidate.planetId === army.planetId && !candidate.transit && !candidate.fleetId && !candidate.destroyed);
  const slot = Math.max(0, peers.findIndex((candidate) => candidate.id === army.id));
  const side = slot % 2 ? -1 : 1;
  return { x: centre.x + side * (22 + Math.floor(slot / 2) * 8), y: centre.y - 15 - (slot % 3) * 7 };
}

function flag(ctx, x, y, houseId, time, size = 1) {
  const faction = house(houseId);
  const flutter = Math.floor(time * 5) % 2;
  paint(ctx, '#18212d', x, y, 2 * size, 14 * size);
  paint(ctx, '#e2c886', x, y, size, 12 * size);
  paint(ctx, '#131b2a', x + size, y - size, 12 * size, 9 * size);
  paint(ctx, faction.color, x + 2 * size, y, 9 * size, 7 * size);
  paint(ctx, faction.color, x + 11 * size, y + (1 + flutter) * size, 2 * size, 4 * size);
  pixelPattern(ctx, EMBLEMS[faction.emblem] ?? EMBLEMS.eye, x + 4 * size, y + size, faction.accent, size);
}

function starField(ctx) {
  const painting = paintedAsset('space/system');
  if (painting) {
    drawPainting(ctx, painting, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    return;
  }
  if (!stars) {
    stars = surface(ctx, MAP_WIDTH, MAP_HEIGHT);
    if (stars) paintStars(stars.getContext('2d'));
  }
  if (stars) ctx.drawImage(stars, 0, 0);
  else paintStars(ctx);
}

function paintStars(ctx) {
  paint(ctx, '#090d19', 0, 0, MAP_WIDTH, MAP_HEIGHT);
  for (let y = 0; y < MAP_HEIGHT; y += 4) {
    for (let x = 0; x < MAP_WIDTH; x += 4) {
      const ridge = 333 - x * .13 + Math.sin(x / 136) * 39;
      const density = Math.max(0, 1 - Math.abs(y - ridge) / 132);
      const n = noise(x, y, 1129) * density;
      if (n > .25) paint(ctx, n > .61 ? '#18182c' : '#111628', x, y, 4, 4);
    }
  }
  for (let index = 0; index < 410; index += 1) {
    const x = noise(index, 12, 392) * MAP_WIDTH;
    const y = noise(index, 8, 618) * MAP_HEIGHT;
    const glow = noise(index, 6, 1051);
    const width = glow > .89 ? 2 : 1;
    const color = glow > .97 ? '#e4bd8d' : glow > .87 ? '#899fb2' : glow > .6 ? '#526780' : '#273947';
    paint(ctx, color, x, y, width, width);
    if (glow > .97) {
      paint(ctx, '#6d6275', x - 2, y, 2, 1);
      paint(ctx, '#6d6275', x + 2, y, 2, 1);
      paint(ctx, '#6d6275', x, y - 2, 1, 2);
    }
  }
}

function drawPlanetSprite(ctx, planet, x, y, time) {
  const radius = planet.radius ?? 26;
  const painting = paintedAsset(`planets/${planet.id}`);
  const seed = hash(planet.id);
  const phase = time * (planet.style === 'gas' ? .72 : .36) + (seed % 628) / 100;
  const rings = planet.style === 'rings';
  if (rings && !painting) planetRing(ctx, { x, y }, radius, '#998d73', true);
  ctx.save();
  ctx.translate(x, y);
  if (!rings) ctx.rotate(Math.sin(phase) * (ATMOSPHERES.has(planet.id) ? .15 : .19));
  if (painting) {
    drawPainting(ctx, painting, -radius, -radius, radius * 2, radius * 2);
  } else {
    drawProceduralPlanet(ctx, planet, radius, seed);
  }
  ctx.restore();
  if (ATMOSPHERES.has(planet.id)) drawAtmosphericBands(ctx, x, y, radius * (rings ? .59 : .87), time, seed, planet);
  if (rings && !painting) planetRing(ctx, { x, y }, radius, '#bbaa81', false);
}

function drawProceduralPlanet(ctx, planet, radius, seed) {
  const size = radius * 2 + 6;
  drawCached(ctx, planetSprites, planet.id, size, size, (canvas) => {
    const colors = planet.palette ?? ['#3c5568', '#648297', '#a0b5b2'];
    const styles = ['gas', 'rings'];
    const center = radius + 3;
    for (let py = 0; py < size; py += 2) {
      for (let px = 0; px < size; px += 2) {
        const dx = (px - center) / radius;
        const dy = (py - center) / radius;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const z = Math.sqrt(1 - d);
        const coarse = noise(Math.floor(px / 6), Math.floor(py / 5), seed);
        const textured = noise(px, py, seed);
        const bands = Math.sin((dy + Math.sin(dx * 4) * .04) * 24) * .26;
        const variation = styles.includes(planet.style) ? bands + coarse * .14 : coarse * .28 + textured * .08;
        const brightness = z * .51 - dx * .29 - dy * .23 + variation;
        let color = colors[clamp(Math.floor(brightness * (colors.length + 1)), 0, colors.length - 1)];
        if (brightness < .07) color = '#18243a';
        if (d > .87 && dx + dy < -.54) color = colors.at(-1);
        if (planet.style === 'earth-like' && coarse > .48 && brightness > .26) {
          color = brightness > .52 ? '#9fae79' : '#506d54';
        }
        paint(canvas, color, px, py, 2, 2);
      }
    }
  }, -Math.round(size / 2), -Math.round(size / 2));
}

function drawAtmosphericBands(ctx, x, y, globe, time, seed, planet) {
  const bandCount = planet.style === 'gas' || planet.style === 'rings' ? 4 : 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(planet.style === 'rings' ? -.39 : -.17);
  ctx.beginPath();
  ctx.ellipse(0, 0, globe, globe, 0, 0, TAU);
  ctx.clip();
  for (let band = 0; band < bandCount; band += 1) {
    const latitude = -.64 + band * .35;
    const width = Math.sqrt(1 - latitude * latitude) * globe;
    const drift = wrap(time * (.27 + band * .035) + noise(band, 14, seed) * 3.1, 3.1) - 1.55;
    ctx.beginPath();
    ctx.ellipse(drift * width, latitude * globe, width * (.33 + band * .033), globe * .08, .06, Math.PI * .12, Math.PI * .95);
    ctx.strokeStyle = '#fff4df';
    ctx.globalAlpha = .14 + ((band + seed) % 3) * .035;
    ctx.lineWidth = bandCount === 4 ? 1.6 : 1.1;
    ctx.stroke();
  }
  ctx.restore();
}

function planetRing(ctx, point, radius, color, back) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(-.2);
  for (const width of [2, 6, 10]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width === 6 ? 2 : 1;
    ctx.globalAlpha = width === 6 ? .85 : .48;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.45 + width, radius * .35 + width / 3, 0,
      back ? Math.PI : 0, back ? TAU : Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function fleetIcon(ctx, x, y, heading, houseId, type, time, scale = 1, thrust = true) {
  const faction = house(houseId);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(heading);
  ctx.scale(scale, scale);
  const transport = type === 'transport';
  const span = transport ? 4 : type === 'battleship' || type === 'carrier' ? 6 : 3;
  const length = transport || type === 'battleship' ? 16 : 13;
  if (thrust) {
    const exhaust = 9 + Math.floor(wrap(time * 18 + x, 8));
    paint(ctx, '#284651', -length - exhaust - 5, -2, exhaust + 5, 4);
    paint(ctx, '#468e9b', -length - exhaust, -2, exhaust, 4);
    paint(ctx, '#c1f0ec', -length - Math.floor(exhaust / 2), -1, exhaust / 2 + 3, 2);
  }
  const painting = type && paintedAsset(`ships/${type}`);
  if (painting) {
    fitPainting(ctx, painting, { x: 0, y: 0, width: length * 2 + 9, height: span * 2 + 13, foot: .5 });
    paint(ctx, '#202b3d', -3, -1, 7, 3);
    paint(ctx, faction.color, -2, 0, 5, 1);
    ctx.restore();
    return;
  }
  paint(ctx, '#101723', -length, -span - 1, length + span, span * 2 + 2);
  paint(ctx, '#8c9eaa', -length + 2, -span, length - 1, span * 2);
  paint(ctx, faction.color, -length + 3, -span + 1, length + 3, Math.max(2, span * 2 - 2));
  paint(ctx, '#bcd9cf', -length + 2, -1, length + 6, 2);
  paint(ctx, '#273649', -1, -span, 3, span * 2);
  paint(ctx, faction.accent, 1, -1, 4, 2);
  if (transport) {
    paint(ctx, '#192232', -length + 2, -span + 2, 3, 2);
    paint(ctx, '#192232', -length + 6, -span + 2, 3, 2);
  }
  ctx.restore();
}

function saveLineStyle(ctx) {
  ctx.save();
  ctx.setLineDash([4, 6]);
}

function fleetLayout(state, fleet, selected = false) {
  const track = fleet.transit ? fleetTrack(fleet) : null;
  const amount = track ? flightProgress(state, fleet) : 0;
  const point = track ? onTrack(track, amount) : fleetPoint(state, fleet);
  const direction = fleet.transit?.returning ? -1 : 1;
  const active = Boolean(track || fleet.landing || fleet.engagement);
  let heading = -.2;
  if (track) {
    const { x, y } = trackTangent(track, amount);
    heading = Math.atan2(y * direction, x * direction);
  } else if (fleet.landing) {
    const target = mapPoint(PLANETS[fleet.planetId]);
    heading = Math.atan2(target.y - point.y, target.x - point.x);
  }
  const roster = FORMATION_TYPES.map((type) => ({ type, count: fleet.ships?.[type] ?? 0 })).filter((ship) => ship.count > 0);
  const assault = fleet.armyId && (fleet.transit?.landing ?? fleet.landing?.type) === 'rain';
  const flagship = (fleet.armyId && roster.find(({ type }) => type === (assault ? 'assault' : 'transport'))) || roster[0];
  const ships = [];
  if (flagship) {
    ships.push({ ...point, type: flagship.type, scale: active ? 1.23 : .82 });
    flagship.count -= 1;
    if (active || selected) {
      while (ships.length < 7 && roster.some(({ count }) => count > 0)) {
        for (const ship of roster) {
          if (ship.count <= 0 || ships.length >= 7) continue;
          const slot = ships.length - 1;
          const row = Math.floor(slot / 2);
          const across = (slot % 2 ? -1 : 1) * (16 + row * 7);
          const behind = 21 + row * 12;
          ships.push({ x: point.x - Math.cos(heading) * behind - Math.sin(heading) * across,
            y: point.y - Math.sin(heading) * behind + Math.cos(heading) * across, type: ship.type, scale: .78 });
          ship.count -= 1;
        }
      }
    }
  }
  let badge = null;
  if (active && (fleet.armyId || selected)) {
    const target = PLANETS[fleet.transit ? (direction === 1 ? fleet.transit.to : fleet.transit.from) : fleet.planetId];
    const operation = fleet.engagement ? 'ENGAGED' : direction < 0 ? 'RETURNING' : assault ? 'INVASION'
      : fleet.landing ? 'LANDING' : fleet.armyId ? 'TROOP CONVOY' : 'IN FLIGHT';
    const title = `${operation} · ${target?.name.toUpperCase() ?? 'ORBIT'}`;
    const width = title.length * 6 + 21;
    badge = { title, width, x: clamp(point.x, width / 2 + 5, MAP_WIDTH - width / 2 - 5),
      y: Math.max(22, point.y - 33), color: assault ? '#ffad72' : house(fleet.houseId).accent };
  }
  return { point, heading, ships, track, amount, direction, active, assault, badge };
}

export function fleetAtPoint(state, point, includeRoutes = false, selectedId = null) {
  let closest = null;
  let minimum = Infinity;
  const lanes = [];
  for (const fleet of Object.values(state.fleets)) {
    const layout = fleetLayout(state, fleet, fleet.id === selectedId);
    const { ships, heading, badge, track, active } = layout;
    const along = Math.cos(heading);
    const across = Math.sin(heading);
    for (const ship of ships) {
      const dx = point.x - ship.x;
      const dy = point.y - ship.y;
      const forward = Math.abs(dx * along + dy * across);
      const sideways = Math.abs(-dx * across + dy * along);
      const distance = Math.hypot(dx, dy);
      if (forward > 24 * ship.scale + 3 || sideways > 12 * ship.scale + 3 || distance >= minimum) continue;
      minimum = distance;
      closest = fleet;
    }
    if (badge && Math.abs(point.x - badge.x) <= badge.width / 2 && Math.abs(point.y - badge.y) <= 9) {
      const distance = Math.hypot(point.x - badge.x, point.y - badge.y) + 10;
      if (distance < minimum) {
        minimum = distance;
        closest = fleet;
      }
    }
    if (includeRoutes && active && track) lanes.push({ fleet, layout });
  }
  if (closest || !includeRoutes) return closest;
  minimum = 8;
  for (const { fleet, layout: { track, amount, direction } } of lanes) {
    const destination = direction === 1 ? 1 : 0;
    let before = onTrack(track, amount);
    for (let step = 1; step <= 16; step += 1) {
      const after = onTrack(track, lerp(amount, destination, step / 16));
      const distance = segmentDistance(point, before, after);
      if (distance < minimum) {
        closest = fleet;
        minimum = distance;
      }
      before = after;
    }
  }
  return closest;
}

function segmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const along = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - (a.x + dx * along), point.y - (a.y + dy * along));
}

function trackTangent({ from, to, control }, at) {
  return { x: lerp(control.x - from.x, to.x - control.x, at), y: lerp(control.y - from.y, to.y - control.y, at) };
}

function trackSegment(ctx, track, start, end) {
  const first = onTrack(track, start);
  const last = onTrack(track, end);
  const tangent = trackTangent(track, start);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  ctx.quadraticCurveTo(first.x + tangent.x * (end - start), first.y + tangent.y * (end - start), last.x, last.y);
  ctx.stroke();
}

function drawFleetTrack(ctx, fleet, visual, selected, time) {
  const { track, amount, direction, assault } = visual;
  if (!track) return;
  const faction = house(fleet.houseId);
  ctx.save();
  ctx.strokeStyle = '#142539';
  ctx.lineWidth = selected || assault ? 4 : 3;
  trackSegment(ctx, track, 0, 1);
  ctx.setLineDash(assault ? [7, 5] : [4, 5]);
  ctx.lineDashOffset = -time * 16 * direction;
  ctx.strokeStyle = selected ? '#f4dc98' : assault ? '#f59862' : faction.accent;
  ctx.globalAlpha = selected || assault ? .89 : .66;
  ctx.lineWidth = selected || assault ? 2 : 1.4;
  trackSegment(ctx, track, amount, direction === 1 ? 1 : 0);
  ctx.restore();
}

function drawFleet(ctx, fleet, visual, selected, time) {
  const { point, heading, ships, active, badge, assault } = visual;
  for (const ship of [...ships].reverse()) {
    fleetIcon(ctx, ship.x, ship.y, heading, fleet.houseId, ship.type, time, ship.scale, active && !fleet.engagement);
  }
  if (selected || assault) brackets(ctx, point.x, point.y, 27, 17, selected ? '#f6e8a8' : '#eea069');
  if (fleet.engagement) brackets(ctx, point.x, point.y, 30, 20, '#fe7b5d', 5);
  if (fleet.blockading) ellipse(ctx, point.x, point.y, 18, 12, '#e89164', 2);
  if (fleet.landing) drawOrbitalLanding(ctx, fleet, point, time);
  if (badge) {
    const { title, x, y, width, color } = badge;
    line(ctx, x, y + 8, point.x, point.y - 14, color);
    paint(ctx, '#1b2839', x - width / 2, y - 9, width, 17);
    paint(ctx, '#101a2b', x - width / 2 + 1, y - 8, width - 2, 15);
    paint(ctx, color, x - width / 2 + 1, y - 8, 2, 15);
    label(ctx, title, x, y, { size: 10, color });
  }
}

function drawOrbitalLanding(ctx, fleet, origin, time) {
  const target = mapPoint(PLANETS[fleet.planetId]);
  const amount = progress(fleet.landing);
  if (fleet.landing.type !== 'rain') {
    const point = { x: lerp(origin.x, target.x, amount), y: lerp(origin.y, target.y, amount) };
    fleetIcon(ctx, point.x, point.y, Math.atan2(target.y - origin.y, target.x - origin.x), fleet.houseId, 'transport', time, .52);
    return;
  }
  for (let slot = 0; slot < 8; slot += 1) {
    const fraction = amount * 1.95 - slot * .12;
    if (fraction < 0 || fraction >= 1) continue;
    const drop = { x: target.x + Math.sin(slot * 9) * 17, y: target.y + Math.cos(slot * 12) * 11 };
    const x = lerp(origin.x, drop.x, fraction);
    const y = lerp(origin.y, drop.y, fraction);
    const trail = Math.max(0, fraction - .3);
    line(ctx, lerp(origin.x, drop.x, trail), lerp(origin.y, drop.y, trail), x, y, '#b96448', 3);
    paint(ctx, '#ff9e64', x - 2, y - 2, 5, 5);
    paint(ctx, '#fff0af', x - 1, y - 1, 2, 2);
  }
}

function drawControlRing(ctx, point, radius, control) {
  ellipse(ctx, point.x, point.y, radius, radius, '#405161');
  if (control.owner) {
    ellipse(ctx, point.x, point.y, radius, radius, house(control.owner).accent, 2);
    return;
  }
  const claims = Object.entries(control.counts);
  if (!claims.length) return;
  const circumference = TAU / control.total;
  let angle = -Math.PI / 2;
  ctx.lineWidth = 2;
  for (const [houseId, regions] of claims) {
    const next = angle + regions * circumference;
    ctx.strokeStyle = house(houseId).accent;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, angle + .08, next - .08);
    ctx.stroke();
    angle = next;
  }
}

function drawSolarGroups(ctx, state, controls, time) {
  const fronts = [[PLANET_GROUPS.core, 62], [PLANET_GROUPS.rim, 504]];
  for (const [group, x] of fronts) {
    if (!group) continue;
    const owners = group.worldIds.map((id) => controls.get(id)?.owner);
    const controlled = owners.filter((id) => id === state.houseId).length;
    const owner = owners.every((id) => id && id === owners[0]) ? owners[0] : null;
    const y = 102;
    const width = 148;
    label(ctx, group.name.toUpperCase(), x, y, { color: '#d6c5a6', align: 'left' });
    label(ctx, `${controlled}/${owners.length}`, x + width, y, { color: '#c5d7df', align: 'right' });
    const step = width / owners.length;
    owners.forEach((id, index) => {
      const left = x + index * step;
      paint(ctx, '#152134', left, y + 12, step - 3, 6);
      paint(ctx, id ? house(id).accent : '#445466', left, y + 12, step - 3, 2);
    });
    if (owner) flag(ctx, x + width + 12, y - 6, owner, time);
  }
}

function drawMoonLinks(ctx, planets) {
  ctx.save();
  ctx.setLineDash([3, 5]);
  for (const moon of planets) {
    const parent = PLANETS[moon.parentId];
    if (!parent) continue;
    const from = mapPoint(parent);
    const to = mapPoint(moon);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const start = parent.radius + 9;
    const end = moon.radius + 9;
    line(ctx, from.x + Math.cos(angle) * start, from.y + Math.sin(angle) * start,
      to.x - Math.cos(angle) * end, to.y - Math.sin(angle) * end, '#637b8b');
  }
  ctx.restore();
}

function drawSolarLegend(ctx, hasFlight) {
  ellipse(ctx, 60, 501, 5, 5, '#d6c5a6', 2);
  label(ctx, 'SECURED WORLD', 72, 501, { color: '#b6c9cc', size: 11, align: 'left' });
  ctx.save();
  ctx.setLineDash([3, 3]);
  ellipse(ctx, 193, 501, 5, 5, '#a3afbc', 2);
  ctx.restore();
  label(ctx, 'DIVIDED CONTROL', 205, 501, { color: '#b6c9cc', size: 11, align: 'left' });
  if (hasFlight) {
    const x = 340;
    line(ctx, x, 501, x + 11, 501, '#e89c67', 2);
    label(ctx, 'FLEET ROUTE', x + 17, 501, { color: '#b6c9cc', size: 11, align: 'left' });
  }
}

export function drawSolar(ctx, state, ui = {}) {
  starField(ctx);
  const time = (state.elapsed ?? 0) + (state.carry ?? 0);
  const selectedPlanet = ui.selectedPlanetId ?? ui.planetId;
  const planets = Object.values(PLANETS).filter(({ id }) => state.planets[id]);
  const fleets = Object.values(state.fleets).map((fleet) => {
    const selected = ui.selectedFleetId === fleet.id;
    return { fleet, selected, visual: fleetLayout(state, fleet, selected) };
  });
  const priority = ({ visual, selected }) => selected ? 3 : visual.assault ? 2 : Number(visual.active);
  fleets.sort((a, b) => priority(a) - priority(b));
  const controls = new Map(planets.map(({ id }) => [id, getPlanetControl(state, id)]));
  drawMoonLinks(ctx, planets);
  for (const { fleet, selected, visual } of fleets) drawFleetTrack(ctx, fleet, visual, selected, time);
  for (const planet of planets) {
    const point = mapPoint(planet);
    const radius = planet.radius ?? 26;
    const active = Object.values(state.battles).filter((battle) => battle.planetId === planet.id && !battle.winner);
    const control = controls.get(planet.id);
    drawPlanetSprite(ctx, planet, point.x, point.y, time);
    drawControlRing(ctx, point, radius + 5, control);
    if (active.length) {
      const pulse = .5 + Math.sin(time * 5) * .25;
      ctx.globalAlpha = pulse;
      ellipse(ctx, point.x, point.y, radius + 10, radius + 10, '#f28d53', 2);
      ctx.globalAlpha = 1;
    }
    if (selectedPlanet === planet.id) brackets(ctx, point.x, point.y, radius + 10, radius + 9, '#f2d88f');
    const { owner } = control;
    if (owner) flag(ctx, point.x + radius - 5, point.y - radius - 4, owner, time);
    label(ctx, planet.name.toUpperCase(), point.x, point.y + radius + 17, { color: '#eae1c4', size: 12 });
  }
  for (const { fleet, selected, visual } of fleets) drawFleet(ctx, fleet, visual, selected, time);
  drawSolarGroups(ctx, state, controls, time);
  drawSolarLegend(ctx, fleets.some(({ visual }) => visual.track));
}

function sectorLayout(planet, regions) {
  if (sectorLayouts.has(planet.id)) return sectorLayouts.get(planet.id);
  const points = regions.map((region) => ({ ...mapPoint(region), id: region.id }));
  const gridWidth = Math.ceil(MAP_WIDTH / GROUND_STEP);
  const gridHeight = Math.ceil(MAP_HEIGHT / GROUND_STEP);
  const assigned = new Int16Array(gridWidth * gridHeight).fill(-1);
  const seed = hash(planet.id);
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = (maxX - minX) * .61 + 100;
  const radiusY = (maxY - minY) * .65 + 67;
  for (let row = 0; row < gridHeight; row += 1) {
    for (let col = 0; col < gridWidth; col += 1) {
      const x = col * GROUND_STEP;
      const y = row * GROUND_STEP;
      const edge = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
      if (edge + Math.sin(col / 9) * .055 + noise(col >> 2, row >> 2, seed) * .11 > 1) continue;
      let best = -1;
      let bestDistance = Infinity;
      points.forEach((point, index) => {
        const distance = Math.hypot(x - point.x, y - point.y) + noise(col >> 2, row >> 2, seed + index) * 21;
        if (distance >= bestDistance) return;
        best = index;
        bestDistance = distance;
      });
      assigned[row * gridWidth + col] = best;
    }
  }
  const layout = { assigned, gridWidth, gridHeight, seed };
  sectorLayouts.set(planet.id, layout);
  return layout;
}

export function regionAtPoint(planetId, point) {
  const planet = PLANETS[planetId];
  if (!planet?.regionIds?.length || point.x < 0 || point.y < 0 ||
      point.x >= MAP_WIDTH || point.y >= MAP_HEIGHT) return null;
  const regions = planet.regionIds.map((id) => REGIONS[id]).filter(Boolean);
  const { assigned, gridWidth } = sectorLayout(planet, regions);
  const index = Math.floor(point.y / GROUND_STEP) * gridWidth + Math.floor(point.x / GROUND_STEP);
  return regions[assigned[index]]?.id ?? null;
}

function paintSectorTerrain(ctx, planet, regions, state, showSupply, paintings) {
  const { assigned, gridWidth, gridHeight, seed } = sectorLayout(planet, regions);
  const ocean = planet.style === 'ice' || planet.style === 'moon' ? '#172635' : '#282634';
  paint(ctx, ocean, 0, 0, MAP_WIDTH, MAP_HEIGHT);
  for (let row = 0; row < gridHeight; row += 1) {
    for (let col = 0; col < gridWidth; col += 1) {
      const index = row * gridWidth + col;
      const regionIndex = assigned[index];
      const x = col * GROUND_STEP;
      const y = row * GROUND_STEP;
      const grain = noise(col, row, seed);
      if (regionIndex < 0) {
        if (grain > .78) paint(ctx, '#35414b', x + 1, y + 2, 4, 1);
        continue;
      }
      const region = regions[regionIndex];
      const terrain = TERRAIN[region.terrain] ?? TERRAIN.desert;
      const edge = assigned[index - 1] !== regionIndex || assigned[index - gridWidth] !== regionIndex;
      const elevation = noise(col >> 2, row >> 2, seed + regionIndex);
      const tone = elevation > .72 ? terrain.light : elevation > .33 ? terrain.ground : terrain.shade;
      paint(ctx, edge ? terrain.rock : tone, x, y, GROUND_STEP, GROUND_STEP);
      if (grain > .87 && !edge) {
        paint(ctx, terrain.rock, x + 1, y + 1, 5, 3);
        paint(ctx, terrain.detail, x + 2, y + 1, 2, 1);
      }
    }
  }
  for (const [kind, painting] of Object.entries(paintings)) {
    if (!painting) continue;
    ctx.save();
    ctx.beginPath();
    for (let row = 0; row < gridHeight; row += 1) {
      let segment = -1;
      for (let col = 0; col <= gridWidth; col += 1) {
        const region = col < gridWidth ? regions[assigned[row * gridWidth + col]] : null;
        if (region?.terrain === kind) {
          if (segment < 0) segment = col;
        } else if (segment >= 0) {
          ctx.rect(segment * GROUND_STEP, row * GROUND_STEP, (col - segment) * GROUND_STEP, GROUND_STEP);
          segment = -1;
        }
      }
    }
    ctx.clip();
    ctx.globalAlpha = .73;
    drawPainting(ctx, painting, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();
  }
  for (let row = 0; row < gridHeight; row += 1) {
    for (let col = 0; col < gridWidth; col += 1) {
      const index = row * gridWidth + col;
      const regionIndex = assigned[index];
      if (regionIndex < 0) continue;
      const owner = state.planets[planet.id]?.regions[regions[regionIndex].id]?.owner;
      const edge = assigned[index - 1] !== regionIndex || assigned[index - gridWidth] !== regionIndex;
      const faction = house(owner);
      const overlay = showSupply ? (owner === state.houseId ? '#86af82' : '#725d69') : faction.color;
      const x = col * GROUND_STEP;
      const y = row * GROUND_STEP;
      ctx.globalAlpha = edge ? .57 : .25 + noise(col, row, seed) * .08;
      paint(ctx, overlay, x, y, GROUND_STEP, GROUND_STEP);
      if (edge) {
        ctx.globalAlpha = .58;
        paint(ctx, '#222630', x, y, GROUND_STEP, 2);
      }
    }
  }
  ctx.globalAlpha = 1;
  for (const region of regions) {
    const origin = mapPoint(region);
    for (const neighbor of region.neighbors ?? []) {
      if (region.id > neighbor || !REGIONS[neighbor]) continue;
      const end = mapPoint(REGIONS[neighbor]);
      line(ctx, origin.x, origin.y, end.x, end.y, '#2e3035', 5);
      line(ctx, origin.x, origin.y, end.x, end.y, '#92917a', 2);
    }
  }
}

function districtIcon(ctx, point, region, faction, buildings) {
  const { x, y } = point;
  const building = buildings?.spaceport ? 'spaceport' : buildings?.fortress ? 'fortress' : region.terrain;
  paint(ctx, '#222936', x - 12, y - 8, 24, 18);
  paint(ctx, '#515967', x - 10, y - 6, 20, 14);
  paint(ctx, faction.color, x - 8, y + 3, 16, 3);
  switch (building) {
    case 'spaceport':
      paint(ctx, '#9cabb2', x - 6, y - 3, 12, 5);
      paint(ctx, '#36617b', x - 5, y - 1, 10, 2);
      paint(ctx, faction.accent, x - 1, y - 5, 2, 8);
      break;
    case 'fortress':
      paint(ctx, '#ac9985', x - 8, y - 3, 16, 6);
      paint(ctx, '#debf90', x - 8, y - 5, 4, 3);
      paint(ctx, '#debf90', x + 4, y - 5, 4, 3);
      paint(ctx, '#28313e', x - 2, y - 1, 4, 4);
      break;
    case 'urban':
    case 'industrial':
      paint(ctx, '#898d87', x - 8, y - 2, 5, 7);
      paint(ctx, '#aab2a8', x - 2, y - 6, 5, 11);
      paint(ctx, '#c4ad8a', x + 4, y - 4, 4, 9);
      paint(ctx, '#343740', x, y - 4, 1, 6);
      break;
    default:
      paint(ctx, '#81756a', x - 8, y - 1, 16, 5);
      paint(ctx, '#ad9d85', x - 4, y - 4, 9, 3);
      paint(ctx, '#38434a', x - 2, y, 4, 4);
  }
}

function drawRoute(ctx, path, color, time, origin) {
  const nodes = path.filter((id) => REGIONS[id]).map((id) => mapPoint(REGIONS[id]));
  if (origin) nodes.unshift(origin);
  if (nodes.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#242938';
  ctx.lineWidth = 6;
  ctx.beginPath();
  nodes.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.setLineDash([8, 5]);
  ctx.lineDashOffset = -time * 13;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  const end = nodes.at(-1);
  brackets(ctx, end.x, end.y, 15, 12, color, 5);
}

function drawArmy(ctx, state, army, ui, time) {
  const point = armyPoint(state, army);
  const faction = house(army.houseId);
  const selected = includes(ui.selectedArmyIds, army.id);
  if (selected) {
    const path = army.transit ? [army.transit.to, ...army.orders] : army.orders;
    if (path.length) drawRoute(ctx, path, faction.accent, time, point);
  }
  const bob = army.transit ? Math.floor(wrap(time * 5, 2)) : 0;
  const { x, y } = point;
  ellipse(ctx, x, y + 5, 12, 5, '#27303a', 1, true);
  const vanguard = army.squads.find((squad) => squad.type !== 'commander')?.type ?? 'commander';
  const miniature = paintedAsset(`units/${vanguard}`);
  const left = army.transit && mapPoint(REGIONS[army.transit.to]).x < mapPoint(REGIONS[army.transit.from]).x;
  for (const [dx, dy] of [[-9, 1], [-5, 4], [0, 0], [5, 3]]) {
    if (miniature) {
      fitPainting(ctx, miniature, { x: x + dx + 1, y: y + dy + 3 - bob, width: 14, height: 12 }, left);
    } else {
      paint(ctx, '#131c29', x + dx, y + dy - 3 - bob, 5, 8);
      paint(ctx, faction.color, x + dx + 1, y + dy - 1 - bob, 3, 5);
      paint(ctx, '#b7a99a', x + dx + 1, y + dy - 4 - bob, 3, 3);
    }
  }
  flag(ctx, x - 4, y - 16 - bob, army.houseId, time);
  if (selected) {
    brackets(ctx, x, y - 4, 16, 16, '#f5dc90', 6);
    const total = army.squads.reduce((count, squad) => count + (squad.soldiers ?? 0), 0);
    label(ctx, String(total), x, y - 24, { color: '#fff0ba', size: 11 });
  }
  if (ui.showSupply && army.houseId === state.houseId) {
    const supply = getSupplyStatus(state, army.id);
    const color = supply.supplied ? '#b0cc85' : '#ffc18f';
    pixelPattern(ctx, supply.supplied ? ['....#', '...#.', '#.#..', '.#...'] : ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
      x - 14, y + 1, color);
  }
}

export function drawPlanet(ctx, state, ui = {}) {
  const planet = PLANETS[ui.planetId ?? ui.selectedPlanetId];
  if (!planet?.regionIds?.length) {
    starField(ctx);
    return;
  }
  const regions = planet.regionIds.map((id) => REGIONS[id]).filter(Boolean);
  const time = simTime(state, ui);
  const selected = ui.selectedRegionId ?? ui.regionId;
  const signatures = regions.map(({ id }) => state.planets[planet.id]?.regions[id]?.owner ?? '');
  const biomes = [...new Set(regions.map((region) => region.terrain))];
  const paintings = Object.fromEntries(biomes.map((kind) => [kind, paintedAsset(`terrain/${kind}`)]));
  const loaded = biomes.filter((kind) => paintings[kind]);
  const cacheKey = [planet.id, ui.showSupply ? state.houseId : '', loaded.join(','), ...signatures].join('|');
  drawCached(ctx, sectorBackdrops, cacheKey, MAP_WIDTH, MAP_HEIGHT, (canvas) => {
    paintSectorTerrain(canvas, planet, regions, state, ui.showSupply, paintings);
  });
  if (ui.routePreview?.path?.length) {
    const army = Object.values(state.armies).find((item) => includes(ui.selectedArmyIds, item.id));
    const start = ui.routePreview.from ?? army?.transit?.to ?? army?.regionId;
    drawRoute(ctx, ui.routePreview.path, ui.routePreview.danger ? '#ffc291' : '#ffe49c', time,
      start && ui.routePreview.path[0] !== start && REGIONS[start] ? mapPoint(REGIONS[start]) : null);
  }
  const contested = new Set(Object.values(state.battles)
    .filter((battle) => !battle.winner && battle.planetId === planet.id).map((battle) => battle.regionId));
  for (const region of regions) {
    const point = mapPoint(region);
    const dynamic = state.planets[planet.id]?.regions[region.id];
    districtIcon(ctx, point, region, house(dynamic?.owner), dynamic?.buildings);
    label(ctx, region.name, point.x, point.y + 17, { size: 12 });
    const supplyNode = dynamic?.buildings?.fortress || dynamic?.buildings?.spaceport || region.colors?.includes('brown');
    if (ui.showSupply && supplyNode) {
      paint(ctx, '#324c47', point.x - 20, point.y - 6, 7, 7);
      pixelPattern(ctx, ['.#.', '###', '.#.'], point.x - 18, point.y - 4, '#c8db9e');
    }
    if (region.id === selected) brackets(ctx, point.x, point.y, 17, 12, '#fff0b2', 6);
    if (contested.has(region.id)) {
      const pulse = Math.floor(time * 7) % 4;
      ellipse(ctx, point.x, point.y, 19 + pulse, 13 + pulse, '#f59362', 2);
      pixelPattern(ctx, ['..#..', '#.#.#', '.###.', '#####', '.###.'], point.x - 2, point.y - 25, '#ffbd6c');
    }
  }
  for (const army of Object.values(state.armies)) {
    if (army.planetId === planet.id && army.regionId && !army.fleetId && !army.destroyed) drawArmy(ctx, state, army, ui, time);
  }
  for (const fleet of Object.values(state.fleets)) {
    if (fleet.landing?.planetId !== planet.id || fleet.landing.type !== 'rain') continue;
    drawGroundLanding(ctx, mapPoint(REGIONS[fleet.landing.regionId]), time);
  }
}

function drawGroundLanding(ctx, point, time) {
  for (let index = 0; index < 8; index += 1) {
    const fraction = wrap(time * 1.3 + index / 8, 1);
    const x = point.x + (index - 4) * 6 - (1 - fraction) * 57;
    const y = point.y - (1 - fraction) * 91 + Math.sin(index * 6) * 11;
    line(ctx, x - 8, y - 13, x, y, '#bf5f46', 2);
    line(ctx, x - 4, y - 7, x, y, '#ffd280', 2);
    paint(ctx, '#ffe8a3', x, y, 3, 4);
    if (fraction > .85) ellipse(ctx, x + 2, y + 5, fraction * 7, fraction * 3, '#ba855f');
  }
}

function paintBattleTerrain(ctx, battle, terrain, painting) {
  const { width, height } = battle;
  const seed = hash(battle.seed ?? battle.terrain);
  if (painting) {
    drawPainting(ctx, painting, 0, 0, width, height);
    ctx.globalAlpha = .22;
    paint(ctx, '#202935', 0, 0, width, height);
    ctx.globalAlpha = 1;
  } else {
    paint(ctx, terrain.ground, 0, 0, width, height);
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < width; x += 8) {
        const sx = x >> 3;
        const sy = y >> 3;
        const octave = noise(sx >> 3, sy >> 3, seed) * .56 + noise(sx >> 1, sy >> 1, seed) * .27 +
          noise(sx, sy, seed) * .17;
        const dune = Math.sin(x / 98 + Math.sin(y / 98) * 3) * .14;
        if (octave + dune > .64) paint(ctx, terrain.light, x, y, 8, 8);
        else if (octave + dune < .39) paint(ctx, terrain.shade, x, y, 8, 8);
        const dither = noise(sx + 60, sy + 18, seed);
        if (dither > .9) paint(ctx, terrain.rock, x + 2, y + 6, 2, 1);
        if (dither < .11) paint(ctx, terrain.detail, x + 5, y + 1, 2, 1);
      }
    }
  }
  if (!painting && ['urban', 'industrial', 'spaceport', 'fortress'].includes(battle.terrain)) {
    const strip = Math.floor(height * .43);
    ctx.globalAlpha = .28;
    paint(ctx, terrain.rock, 0, strip, width, 74);
    paint(ctx, terrain.ground, 0, strip + 5, width, 64);
    for (let x = 0; x < width; x += 32) paint(ctx, terrain.detail, x, strip + 36, 16, 2);
    ctx.globalAlpha = 1;
  }
  for (const zone of battle.zones ?? []) {
    const high = zone.kind === 'high';
    ctx.globalAlpha = high ? .39 : .32;
    paint(ctx, high ? terrain.light : terrain.shade, zone.x, zone.y, zone.w, zone.h);
    for (let y = 3; y < zone.h; y += 7) {
      for (let x = 3; x < zone.w; x += 10) {
        if (noise(x, y, seed) < .47) continue;
        paint(ctx, high ? terrain.detail : '#354e43', zone.x + x, zone.y + y, high ? 7 : 4, high ? 1 : 2);
      }
    }
    ctx.globalAlpha = 1;
    for (let x = 0; x < zone.w - 3; x += 8) {
      const tone = high ? terrain.detail : '#677869';
      paint(ctx, tone, zone.x + x, zone.y, 3, 1);
      paint(ctx, tone, zone.x + x, zone.y + zone.h, 3, 1);
    }
  }
}

function obstacle(ctx, block, terrain) {
  const { x, y, w, h, kind } = block;
  if (block.maxHealth > 0 && block.health <= 0) {
    for (let dx = 3; dx < w; dx += 8) {
      const dy = noise(dx, Math.round(y), 176) * Math.max(2, h - 5);
      paint(ctx, terrain.rock, x + dx, y + dy, 4, 3);
      paint(ctx, terrain.light, x + dx, y + dy, 2, 1);
    }
    return;
  }
  const metallic = ['building', 'wall', 'fortification', 'crate', 'bunker', 'depot', 'gantry'].includes(kind);
  paint(ctx, '#35404a', x + 4, y + 6, w, h);
  paint(ctx, terrain.rock, x, y, w, h);
  paint(ctx, metallic ? '#515e64' : terrain.shade, x + 2, y + 2, w - 4, h - 5);
  paint(ctx, metallic ? '#85958e' : terrain.light, x + 2, y + 1, w - 5, 3);
  paint(ctx, metallic ? '#293740' : terrain.rock, x + 2, y + h - 4, w - 4, 3);
  const step = metallic ? 13 : 9;
  for (let dx = 5; dx < w - 5; dx += step) {
    const height = Math.min(h - 10, 5 + noise(dx, Math.round(x), 119) * 8);
    paint(ctx, metallic ? '#3b4753' : terrain.rock, x + dx, y + 6, metallic ? 8 : 4, Math.max(2, height));
    if (metallic) paint(ctx, '#b19867', x + dx + 1, y + 5, 4, 1);
  }
  if (block.maxHealth > 0 && block.health < block.maxHealth) {
    paint(ctx, '#2e3541', x + w / 4, y - 5, Math.max(w / 2, 6), 2);
    paint(ctx, '#e8af60', x + w / 4, y - 5, Math.max(w / 2, 6) * block.health / block.maxHealth, 2);
  }
}

const UNITS = {
  rifle: { body: '#8e999d', light: '#b7c5bd', dark: '#364756', kit: 'rifle' },
  heavy: { body: '#697b89', light: '#9da5a6', dark: '#283646', kit: 'heavy' },
  marksman: { body: '#758c87', light: '#afc4a1', dark: '#344b4b', kit: 'marksman' },
  raider: { body: '#494e5b', light: '#aaaeb0', dark: '#212c41', kit: 'axe' },
  obsidian: { body: '#414659', light: '#8e929b', dark: '#1d293d', kit: 'shield' },
  razor: { body: '#af8846', light: '#f4d079', dark: '#5d492e', kit: 'razor' },
  commander: { body: '#cba74f', light: '#ffe4a0', dark: '#735130', kit: 'command' },
  engineer: { body: '#b18255', light: '#f5c17e', dark: '#674842', kit: 'tool' },
  electronic: { body: '#709374', light: '#afc190', dark: '#385f64', kit: 'dish' },
  medic: { body: '#b0a16b', light: '#f1dfa5', dark: '#635853', kit: 'medic' },
  transport: { body: '#537388', light: '#b6bec4', dark: '#2c4158', kit: 'transport' },
  tank: { body: '#7e7867', light: '#aab1a3', dark: '#3a414f', kit: 'tank' },
};

function unitPainting(type, frame) {
  const sheet = paintedAsset(`units/${type}-sheet`);
  if (sheet?.naturalWidth >= UNIT_FRAME_COUNT && sheet.naturalWidth % UNIT_FRAME_COUNT === 0) {
    const width = sheet.naturalWidth / UNIT_FRAME_COUNT;
    return { image: sheet, source: { x: frame * width, width, height: sheet.naturalHeight } };
  }
  const image = paintedAsset(`units/${type}`);
  return image ? { image } : null;
}

function movementFrame(squad, time) {
  const previous = squadMotion.get(squad);
  if (!previous || time - previous.seen > .35 || time < previous.seen) {
    squadMotion.set(squad, { x: squad.x, y: squad.y, phase: 0, seen: time, moved: -Infinity });
    return 0;
  }
  const distance = Math.hypot(squad.x - previous.x, squad.y - previous.y);
  previous.x = squad.x;
  previous.y = squad.y;
  previous.seen = time;
  if (distance > .12) {
    previous.phase = wrap(previous.phase + distance / 5, 4);
    previous.moved = time;
  }
  return time - previous.moved < .15 ? 1 + Math.floor(previous.phase) : 0;
}

function getFormation(squad, count, index) {
  const cols = squad.formation === 'column' ? Math.min(count, 3) : Math.min(count, 7);
  const rows = Math.ceil(count / cols);
  const row = Math.floor(index / cols);
  const perRow = Math.min(cols, count - row * cols);
  const col = index % cols;
  const spacing = squad.formation === 'loose' ? 8 : squad.formation === 'defensive' ? 5 : 6;
  const across = (col - (perRow - 1) / 2) * spacing;
  let ahead = ((rows - 1) / 2 - row) * spacing;
  if (squad.formation === 'wedge') ahead += Math.abs(across) * -.38;
  return { ahead, across };
}

function soldier(ctx, x, y, angle, type, faction, gait, firing) {
  const unit = UNITS[type] ?? UNITS.rifle;
  const big = ['axe', 'shield', 'razor'].includes(unit.kit);
  const facing = Math.cos(angle) >= 0 ? 1 : -1;
  const forward = Math.sin(angle) >= 0 ? 1 : -1;
  paint(ctx, '#3d3942', x - 3, y + 4, big ? 8 : 7, 2);
  paint(ctx, unit.dark, x - 2, y + 1 + gait, 2, 4);
  paint(ctx, unit.dark, x + 1, y + 2 - gait, 2, 4);
  paint(ctx, '#202935', x - (big ? 4 : 3), y - 3, big ? 8 : 6, 6);
  paint(ctx, unit.body, x - 2, y - 2, 5, 5);
  paint(ctx, faction.color, x - 2, y, 4, 2);
  paint(ctx, unit.light, x - 2, y - 6, 5, 3);
  paint(ctx, faction.accent, x - 1, y - 6, 2, 1);
  paint(ctx, unit.dark, x - 1 + facing, y - 4, 2, 1);
  const side = x + facing * 3;
  switch (unit.kit) {
    case 'rifle':
    case 'heavy':
    case 'marksman': {
      const reach = unit.kit === 'rifle' ? 6 : 8;
      line(ctx, side, y, side + facing * reach, y + forward * 2, '#303740', unit.kit === 'heavy' ? 3 : 2);
      if (firing) paint(ctx, '#ffeab0', side + facing * reach - 1, y + forward * 2 - 1, 3, 2);
      break;
    }
    case 'axe':
      line(ctx, side - facing, y + 2, side + facing * 2, y - 6, '#b7bbba', 2);
      paint(ctx, '#d2cbc0', side + facing * 2 - 2, y - 7, 5, 3);
      break;
    case 'shield':
      paint(ctx, '#8d919a', side - 1, y - 3, 4, 7);
      paint(ctx, faction.color, side, y - 1, 2, 4);
      break;
    case 'razor':
      line(ctx, side, y + 1, side + facing * 6, y - 7, '#fff3a0', 2);
      break;
    case 'tool':
      paint(ctx, '#ebba65', side - 1, y - 2, 3, 5);
      break;
    case 'dish':
      paint(ctx, '#96d4b6', side, y - 4, 4, 2);
      paint(ctx, '#374c56', side + 1, y - 2, 2, 4);
      break;
    case 'medic':
      paint(ctx, '#c26055', x - 1, y, 3, 1);
      paint(ctx, '#c26055', x, y - 1, 1, 3);
  }
}

function drawSoldier(ctx, squad, faction, x, y, angle, gait, firing, painting) {
  const facing = Math.cos(angle) >= 0 ? 1 : -1;
  const forward = Math.sin(angle) >= 0 ? 1 : -1;
  if (painting) {
    const larger = ['obsidian', 'razor', 'raider'].includes(squad.type);
    ellipse(ctx, x, y + 3, larger ? 5 : 4, 2, '#252933', 1, true);
    fitPainting(ctx, painting.image, { x, y: y + 3, width: larger ? 19 : 15, height: larger ? 15 : 13 }, facing < 0, painting.source);
    paint(ctx, faction.color, x - 2, y + 4, 4, 1);
    return;
  }
  const key = `${squad.type}|${squad.houseId}|${facing}|${forward}|${gait}|${firing}`;
  drawCached(ctx, soldierSprites, key, 30, 22, (canvas) => {
    soldier(canvas, 15, 11, angle, squad.type, faction, gait, firing);
  }, Math.round(x) - 15, Math.round(y) - 11, 400);
}

function vehicle(ctx, x, y, squad, faction, painting) {
  const transport = squad.type === 'transport';
  const length = transport ? 14 : 13;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(squad.heading ?? 0);
  if (painting) {
    ellipse(ctx, 0, 2, 15, 8, '#292e39', 1, true);
    fitPainting(ctx, painting.image, { x: 0, y: 0, width: 35, height: 23, foot: .5 }, false, painting.source);
    paint(ctx, faction.color, -11, 5, 7, 2);
    ctx.restore();
    return;
  }
  paint(ctx, '#333842', -length, -7, length * 2 + 2, 16);
  paint(ctx, '#263549', -length, -7, length * 2, 4);
  paint(ctx, '#263549', -length, 4, length * 2, 4);
  for (let step = -length + 2; step < length; step += 4) {
    paint(ctx, '#566267', step, -7, 2, 3);
    paint(ctx, '#566267', step, 4, 2, 3);
  }
  paint(ctx, UNITS[squad.type].body, -length + 1, -4, length * 2 - 2, 8);
  paint(ctx, faction.color, -length + 2, -3, 5, 6);
  paint(ctx, '#a8b6b3', length - 5, -3, 3, 6);
  if (transport) {
    paint(ctx, '#43576b', -5, -3, 9, 6);
    paint(ctx, '#b3c8c9', 3, -3, 2, 6);
  } else {
    paint(ctx, '#485563', -4, -4, 8, 8);
    paint(ctx, '#adb4aa', 0, -2, 19, 3);
    if (squad.fireFlash > 0) paint(ctx, '#ffecad', 19, -2, 5, 4);
  }
  ctx.restore();
}

function commander(ctx, squad, faction, gait, painting) {
  const x = squad.x;
  const y = squad.y;
  const facing = Math.cos(squad.heading ?? 0) >= 0 ? 1 : -1;
  if (painting) {
    ellipse(ctx, x, y + 4, 10, 4, '#2b2c39', 1, true);
    fitPainting(ctx, painting.image, { x, y: y + 5, width: 31, height: 29, foot: .15 }, facing < 0, painting.source);
    paint(ctx, faction.color, x - 3, y + 6, 6, 2);
    return;
  }
  paint(ctx, '#34303c', x - 7, y + 5, 14, 3);
  paint(ctx, '#272d3c', x - 6, y - 4, 12, 11);
  paint(ctx, faction.color, x - 5, y - 4, 10, 10);
  paint(ctx, '#c39c52', x - 4, y - 5, 8, 9);
  paint(ctx, '#f4db93', x - 3, y - 10, 6, 5);
  paint(ctx, '#7a583e', x - 1, y - 7, 4, 1);
  paint(ctx, '#e8c266', x - 6, y - 4, 3, 3);
  paint(ctx, '#e8c266', x + 3, y - 4, 3, 3);
  paint(ctx, '#6d5743', x - 4, y + 4 + gait, 3, 4);
  paint(ctx, '#6d5743', x + 2, y + 4 - gait, 3, 4);
  line(ctx, x + facing * 5, y + 2, x + facing * 11, y - 8, '#fff0a9', 2);
}

function drawSquad(ctx, squad, selected, time) {
  const faction = house(squad.houseId);
  const frame = movementFrame(squad, time);
  const firing = squad.fireFlash > 0;
  const painting = unitPainting(squad.type, firing ? ATTACK_FRAME : frame);
  const gait = [0, -1, 0, 1, 0][frame];
  const radius = clamp(12 + Math.sqrt(squad.soldiers) * 3, 16, 32);
  if (selected) ellipse(ctx, squad.x, squad.y + 3, radius, radius * .65, '#ffed9c', 2);
  if (['transport', 'tank'].includes(squad.type)) vehicle(ctx, squad.x, squad.y, squad, faction, painting);
  else if (squad.type === 'commander') commander(ctx, squad, faction, gait, painting);
  else {
    const angle = squad.heading ?? 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let index = squad.soldiers - 1; index >= 0; index -= 1) {
      const { ahead, across } = getFormation(squad, squad.soldiers, index);
      const x = squad.x + ahead * cos - across * sin;
      const y = squad.y + ahead * sin + across * cos;
      drawSoldier(ctx, squad, faction, x, y, angle, (index % 2 ? -1 : 1) * gait,
        firing && (index + Math.floor(time * 15)) % 4 === 0, painting);
    }
  }
  if (selected || squad.routing || squad.hp < squad.maxHp * .6) {
    const width = 26;
    const x = squad.x - width / 2;
    const y = squad.y - radius * .65 - 10;
    const remaining = clamp(squad.hp / Math.max(squad.maxHp, 1), 0, 1);
    paint(ctx, '#212a39', x - 1, y - 1, width + 2, 7);
    paint(ctx, '#59626e', x, y, width, 3);
    paint(ctx, squad.routing ? '#df8b68' : '#a8c98a', x, y, width * remaining, 3);
    paint(ctx, faction.color, x, y + 4, width, 1);
    if (selected) label(ctx, String(squad.soldiers), squad.x, y - 7, { size: 10 });
  }
}

function drawEffect(ctx, effect, terrain) {
  const { kind, x, y, toX, toY } = effect;
  const fade = clamp(effect.life / (effect.duration ?? 1), 0, 1);
  ctx.save();
  ctx.globalAlpha = fade;
  if (kind === 'shot' || kind === 'heavy') {
    const to = { x: toX ?? x, y: toY ?? y };
    const tail = kind === 'heavy' ? .57 : .83;
    line(ctx, lerp(x, to.x, tail), lerp(y, to.y, tail), to.x, to.y,
      kind === 'heavy' ? '#ffd07d' : '#ffedb1', kind === 'heavy' ? 3 : 1);
    paint(ctx, '#fff1b4', to.x - 1, to.y - 1, 3, 3);
  } else if (kind === 'melee') {
    const dx = toX ?? x;
    const dy = toY ?? y;
    line(ctx, dx - 6, dy + 4, dx + 6, dy - 6, '#ffeab3', 2);
    paint(ctx, '#faa264', dx, dy - 1, 3, 2);
  } else if (kind === 'explosion' || kind === 'dust') {
    const size = 7 + (1 - fade) * 21;
    ellipse(ctx, x, y, size, size * .7, kind === 'explosion' ? '#302e37' : terrain.rock, 1, true);
    if (kind === 'explosion') {
      paint(ctx, '#ce7350', x - size / 2, y - size / 3, size, size * .68);
      paint(ctx, '#f8c878', x - size / 3, y - size / 5, size * .66, size * .4);
    }
  } else {
    const shades = { heal: '#9fd691', repair: '#f9bc73', jam: '#8fd8d4', rally: '#fce397' };
    const shade = shades[kind] ?? '#f2eed0';
    const size = (1 - fade) * 19 + 5;
    ellipse(ctx, toX ?? x, toY ?? y, size, size * .62, shade, kind === 'jam' ? 3 : 2);
    if (kind === 'heal') pixelPattern(ctx, ['.#.', '###', '.#.'], (toX ?? x) - 3, (toY ?? y) - 12, shade, 2);
  }
  ctx.restore();
}

function tacticalRoute(ctx, squad, battle) {
  let from = squad;
  for (const order of squad.orders ?? []) {
    const obstacle = order.targetId && battle.obstacles?.find((item) => item.id === order.targetId);
    const point = obstacle ? { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 } :
      order.targetId ? battle.squads.find((item) => item.id === order.targetId) : order;
    if (!point || !Number.isFinite(point.x + point.y)) continue;
    const color = order.type === 'attack' ? '#ff9b78' : '#f9dfa0';
    saveLineStyle(ctx);
    ctx.globalAlpha = .73;
    line(ctx, from.x, from.y, point.x, point.y, color, 1);
    ctx.restore();
    brackets(ctx, point.x, point.y, 6, 5, color, 3);
    from = point;
  }
}

export function drawBattle(ctx, battle, ui = {}) {
  const time = simTime(battle, ui);
  const terrain = TERRAIN[battle.terrain] ?? TERRAIN.desert;
  const painting = paintedAsset(`terrain/${battle.terrain ?? 'desert'}`);
  const origin = battlePoint(battle, { x: 0, y: 0 }, ui.camera);
  const extent = battlePoint(battle, { x: battle.width, y: battle.height }, ui.camera);
  paint(ctx, '#1d2736', 0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.scale((extent.x - origin.x) / battle.width, (extent.y - origin.y) / battle.height);
  const key = [battle.terrain, battle.width, battle.height, battle.seed, Boolean(painting), JSON.stringify(battle.zones)].join('|');
  drawCached(ctx, tacticalBackdrops, key, battle.width, battle.height, (canvas) => {
    paintBattleTerrain(canvas, battle, terrain, painting);
  });
  for (const item of battle.obstacles ?? []) obstacle(ctx, item, terrain);
  for (const squad of battle.squads) {
    if (squad.soldiers <= 0 || squad.withdrawn) continue;
    if (includes(ui.selectedSquadIds, squad.id)) tacticalRoute(ctx, squad, battle);
  }
  const topLeft = battleWorldPoint(battle, { x: -64, y: -64 }, ui.camera);
  const bottomRight = battleWorldPoint(battle, { x: MAP_WIDTH + 64, y: MAP_HEIGHT + 64 }, ui.camera);
  const alive = battle.squads.filter((squad) => squad.soldiers > 0 && !squad.withdrawn &&
    squad.x >= topLeft.x && squad.y >= topLeft.y && squad.x <= bottomRight.x && squad.y <= bottomRight.y)
    .sort((a, b) => a.y - b.y);
  for (const squad of alive) drawSquad(ctx, squad, includes(ui.selectedSquadIds, squad.id), time);
  for (const effect of battle.effects ?? []) drawEffect(ctx, effect, terrain);
  if (ui.orderMarker) {
    const { x, y, type } = ui.orderMarker;
    brackets(ctx, x, y, 10, 8, type === 'attack' ? '#ff9b79' : '#f6e095', 5);
  }
  ctx.restore();
  const selection = ui.selectionBox;
  if (selection) {
    ctx.strokeStyle = '#f6e095';
    ctx.lineWidth = 1;
    ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
    ctx.globalAlpha = .14;
    paint(ctx, '#f6e095', selection.x, selection.y, selection.w, selection.h);
    ctx.globalAlpha = 1;
  }
}

export function drawBattleMinimap(ctx, battle, ui = {}) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const terrain = TERRAIN[battle.terrain] ?? TERRAIN.desert;
  const sx = width / battle.width;
  const sy = height / battle.height;
  paint(ctx, terrain.shade, 0, 0, width, height);
  const painting = paintedAsset(`terrain/${battle.terrain ?? 'desert'}`);
  if (painting) {
    ctx.globalAlpha = .52;
    drawPainting(ctx, painting, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  for (const block of battle.obstacles ?? []) {
    if (block.maxHealth > 0 && block.health <= 0) continue;
    paint(ctx, terrain.rock, block.x * sx, block.y * sy, block.w * sx, block.h * sy);
  }
  for (const squad of battle.squads) {
    if (squad.soldiers <= 0 || squad.withdrawn) continue;
    paint(ctx, house(squad.houseId).accent, squad.x * sx - 1, squad.y * sy - 1, 3, 3);
  }
  const tl = battleWorldPoint(battle, { x: 0, y: 0 }, ui.camera);
  const br = battleWorldPoint(battle, { x: MAP_WIDTH, y: MAP_HEIGHT }, ui.camera);
  ctx.strokeStyle = '#f8e9b6';
  ctx.lineWidth = 1;
  ctx.strokeRect(tl.x * sx + .5, tl.y * sy + .5, (br.x - tl.x) * sx - 1, (br.y - tl.y) * sy - 1);
}
