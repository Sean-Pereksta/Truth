import { drawFloorTile, drawNeedBubble } from './pixel-art.mjs';
import { createAtmosphere } from './atmosphere.mjs';
import { createGreenhouseEffects, drawBloomHalo, drawStationEffect } from './effects.mjs';
import { drawPaintedGardener } from './gardeners.mjs';
import { drawCounters, drawDispatchApron, drawInterior, drawInteriorWindows, interiorArtReady, texture as paintMaterial } from './interior.mjs';
import { drawPaintedFloor, drawWaterChannel, paintedFloorReady } from './painted-floor.mjs';
import { drawPaintedPlant, drawPaintedScenery, drawPaintedStation } from './painted-world.mjs';
import { getPlantNeed, getTruckWindow } from './sim.mjs';

const tile = 48;
const boothTypes = new Set(['sun', 'moon', 'prism']);
const menuSky = createAtmosphere();
export const THEME_COLORS = {
  dawn: '#ffc280', moon: '#9adfff', comet: '#bd9cff', dune: '#f9aa73', meteor: '#ff8d79',
  nebula: '#f4a0d9', frost: '#a9eefb', aurora: '#91f4c5', eclipse: '#e1a7ff', midnight: '#a9a8ff',
  pollenworks: '#ffd781', tidalglass: '#72e4d6', switchyard: '#ffad79', drawbridge: '#c1cafd', saturn: '#f4cb89',
};

function block(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function stationColor(station) {
  return { seed: '#99e7a7', shower: '#8bdcff', sun: '#ffcb6e', moon: '#a6d4fd', prism: '#f3aaf9',
    ingredient: '#bce7a2', truck: '#ffb07d', repot: '#f7b18d', prune: '#b9eebb', shelf: '#ddbb9c', compost: '#b8cf9f',
  }[station.type] || '#fcdfb1';
}

function center(point) {
  return { x: (point.x + .5) * tile, y: (point.y + .5) * tile };
}

function rounded(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawBelt(ctx, belt, time) {
  const route = belt.path.map(center);
  for (const [i, point] of route.entries()) {
    const next = route[i + 1];
    if (!next) break;
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.atan2(dy, dx));
    const length = Math.hypot(dx, dy);
    rounded(ctx, -3, -10, length + 6, 22, 4, '#352839', '#2a2134');
    const track = ctx.createLinearGradient(0, -10, 0, 10);
    track.addColorStop(0, '#d2a47e');
    track.addColorStop(.24, '#7d6260');
    track.addColorStop(.31, '#353147');
    track.addColorStop(.74, '#3c394b');
    track.addColorStop(.83, '#8d6257');
    track.addColorStop(1, '#ddb08c');
    rounded(ctx, 0, -10, length, 20, 2, track);
    paintMaterial(ctx, 'trim', 0, -10, length, 3.8, { radius: 1, opacity: .83 });
    paintMaterial(ctx, 'trim', 0, 6.2, length, 3.8, { radius: 1, opacity: .83 });
    for (let p = Math.floor(time * 20) % 8; p < length; p += 8) {
      rounded(ctx, p, -6, 2.4, 12, .8, '#78698175');
    }
    for (let p = 8; p < length - 4; p += 16) {
      ctx.strokeStyle = '#f6d492';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p, -3);
      ctx.lineTo(p + 4, 0);
      ctx.lineTo(p, 3);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const [i, point] of [route[0], route.at(-1)].entries()) {
    const accent = i ? '#abd7d1' : '#f9bb72';
    rounded(ctx, point.x - 14, point.y - 12, 28, 24, 5, '#3d3148', '#201d30');
    rounded(ctx, point.x - 11, point.y - 9, 22, 18, 4, '#625167', accent);
    rounded(ctx, point.x - 8, point.y + 8, 16, 2, 1, accent);
  }
}

function drawPlatformRoute(ctx, layout, boat) {
  const [a, b] = layout.stops.map(center);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  for (let t = 10; t < distance; t += 13) {
    const x = a.x + (b.x - a.x) * t / distance;
    const y = a.y + (b.y - a.y) * t / distance;
    block(ctx, '#8394c0', x - 2, y - 1, 5, 2);
  }
  for (const [index, point] of [a, b].entries()) {
    const arrived = boat?.mode === 'docked' && boat.stopIndex === index;
    rounded(ctx, point.x - 20, point.y - 15, 40, 30, 5, '#334157', '#25293d');
    rounded(ctx, point.x - 15, point.y - 10, 30, 20, 4, '#566779', '#abc8b7');
    paintMaterial(ctx, 'dock', point.x - 14, point.y - 9, 28, 18, { radius: 3, opacity: .56 });
    rounded(ctx, point.x - 13, point.y + 8, 26, 2, 1, arrived ? '#93f4c9' : '#f6bf7d');
    block(ctx, '#dce9f5', point.x - 1, point.y - 5, 2, 10);
    block(ctx, '#dce9f5', point.x - 5, point.y - 1, 10, 2);
  }
}

function drawPlatform(ctx, boat) {
  const { x, y } = center(boat);
  ctx.save();
  const deck = ctx.createLinearGradient(x, y - 16, x, y + 16);
  deck.addColorStop(0, '#c88c69');
  deck.addColorStop(.32, '#f4cf97');
  deck.addColorStop(.92, '#a76360');
  deck.addColorStop(1, '#634158');
  ctx.beginPath();
  ctx.roundRect(x - 21, y - 15, 42, 31, 5);
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#49384f';
  ctx.stroke();
  paintMaterial(ctx, 'dock', x - 19, y - 13, 38, 27, { radius: 4, opacity: .82 });
  ctx.lineWidth = .7;
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = i % 2 ? '#fff0b280' : '#5c395d72';
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 9 + i * 4.5);
    ctx.quadraticCurveTo(x, y - 8 + i * 4.5, x + 17, y - 9 + i * 4.5);
    ctx.stroke();
  }
  for (const sign of [-1, 1]) {
    ctx.fillStyle = '#cef4d3';
    ctx.beginPath();
    ctx.arc(x + sign * 15, y - 11, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spotlight(station) {
  const size = 88;
  const layer = document.createElement('canvas');
  layer.width = layer.height = size;
  const ctx = layer.getContext('2d');
  const color = stationColor(station);
  const mid = size / 2;
  const light = ctx.createRadialGradient(mid, mid, 1, mid, mid, mid);
  light.addColorStop(0, `${color}ae`);
  light.addColorStop(.26, `${color}6b`);
  light.addColorStop(.58, `${color}29`);
  light.addColorStop(1, `${color}00`);
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  return layer;
}

export function createBoardRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  const floor = background.getContext('2d');
  const actors = new Map();
  const atmosphere = createAtmosphere();
  const greenhouseEffects = createGreenhouseEffects(tile);
  const lights = new Map();
  let targets = [];
  let level;
  let board;
  let textured;
  let furnished;

  function prepare(map) {
    level = map;
    actors.clear();
    targets = [];
    greenhouseEffects.reset(map);
    board = { x: 34, y: 42, width: map.width * tile, height: map.height * tile };
    background.width = board.width;
    background.height = board.height + board.y;
    canvas.width = board.width + board.x * 2;
    canvas.height = board.height + board.y + 44;
    ctx.imageSmoothingEnabled = false;
    floor.imageSmoothingEnabled = false;
    paintGround();
    lights.clear();
    for (const station of map.stations) {
      if (!boothTypes.has(station.type) && station.type !== 'shower') continue;
      if (!lights.has(station.type)) lights.set(station.type, spotlight(station));
    }
  }

  function paintGround() {
    const map = level;
    textured = paintedFloorReady();
    furnished = interiorArtReady();
    floor.clearRect(0, 0, background.width, background.height);
    floor.save();
    floor.translate(0, board.y);
    drawPaintedFloor(floor, map, tile);
    drawInterior(floor, map, tile, THEME_COLORS[map.theme]);
    drawCounters(floor, map, tile, THEME_COLORS[map.theme]);
    floor.restore();
  }

  function draw(state, myId, time, effects, selected) {
    atmosphere.draw(ctx, { width: canvas.width, height: canvas.height, board, theme: level.theme, time, effects });
    ctx.save();
    ctx.translate(board.x, board.y);
    if ((!textured && paintedFloorReady()) || (!furnished && interiorArtReady())) paintGround();
    ctx.drawImage(background, 0, -board.y);
    drawWaterChannel(ctx, level, tile, time, effects);
    drawDispatchApron(ctx, level, tile, THEME_COLORS[level.theme]);
    drawInteriorWindows(ctx, level, tile, atmosphere);
    greenhouseEffects.update(state, time, effects);
    greenhouseEffects.drawAmbient(ctx, time);
    const visualTime = effects ? time : 0;
    const plants = new Map(state.plants.map(plant => [plant.id, plant]));
    const players = new Map(state.players.map(player => [player.id, player]));
    const tasks = new Map(state.players.filter(player => player.action).map(player => [player.action.stationId, player.action]));
    const truck = getTruckWindow(state);
    const bubbles = [];
    const scene = [];
    const platformStates = new Map((state.platforms ?? []).map(boat => [boat.id, boat]));

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const station of state.stations) {
      const glow = lights.get(station.type);
      if (!glow) continue;
      const { x, y } = center(station);
      const active = station.plantId || tasks.has(station.id);
      const pulse = effects && active ? .09 * Math.sin(time * 3.5 + station.x + station.y) : 0;
      ctx.globalAlpha = (active ? .62 : .23) + pulse;
      ctx.drawImage(glow, x - glow.width / 2, y - glow.height / 2 + 6);
    }
    ctx.restore();

    for (const [y, row] of level.layout.entries()) {
      for (const [x, cell] of [...row].entries()) {
        if (cell !== '=') continue;
        const at = center({ x, y });
        block(ctx, '#1a2037', at.x - 24, at.y - 24, 48, 48);
        if (state.solo) {
          block(ctx, '#4f695f', at.x - 24, at.y - 16, 48, 32);
          paintMaterial(ctx, 'dock', at.x - 24, at.y - 16, 48, 32, { radius: 2, opacity: .82 });
          for (let slat = -23; slat < 24; slat += 8) block(ctx, '#8bc2a2', at.x + slat, at.y - 13, 2, 26);
          block(ctx, '#b0d8b3', at.x - 24, at.y - 16, 48, 2);
          block(ctx, '#759680', at.x - 24, at.y + 13, 48, 2);
        } else {
          block(ctx, '#5f5d77', at.x - 10, at.y - 12, 20, 24);
          paintMaterial(ctx, 'trim', at.x - 10, at.y - 12, 20, 24, { radius: 2, opacity: .68 });
          for (let bar = -8; bar < 10; bar += 5) block(ctx, '#9391a7', at.x + bar, at.y - 11, 2, 22);
        }
      }
    }
    for (const belt of level.conveyors ?? []) drawBelt(ctx, belt, visualTime);
    for (const platform of level.platforms ?? []) {
      const boat = platformStates.get(platform.id);
      drawPlatformRoute(ctx, platform, boat);
      if (boat) drawPlatform(ctx, boat);
    }
    if (Number.isFinite(selected?.x) && Number.isFinite(selected?.y)) {
      const at = center(selected);
      block(ctx, '#9bf1cc', at.x - 7, at.y - 1, 15, 2);
      block(ctx, '#9bf1cc', at.x - 1, at.y - 7, 2, 15);
    }

    for (const station of state.stations) {
      const x = (station.x + .5) * tile;
      const appliance = boothTypes.has(station.type) || station.type === 'shower';
      const courier = station.type === 'truck';
      const y = (station.y + (courier ? .91 : appliance ? .77 : .73)) * tile;
      const plant = plants.get(station.plantId);
      const task = tasks.get(station.id);
      const active = station.type === 'truck' ? truck.open : Boolean(plant || task);
      const large = courier ? 1.13 : appliance ? .88 : .8;
      scene.push({ y: station.y, paint() {
        const selectedHere = selected?.stationId === station.id;
        const indicatorY = courier ? y + 2 : (station.y + .94) * tile;
        if (selectedHere) rounded(ctx, x - 16, indicatorY, 32, 2.5, 1.1, '#fff2b4');
        const size = tile * large;
        drawPaintedStation(ctx, station.type, x, y, size, visualTime, { active, variant: station.variant, palette: level.theme, effects });
        drawStationEffect(ctx, { type: station.type, x, y, size, time, active, effects });
        if (plant) {
          const need = getPlantNeed(plant, state);
          if (plant.phase === 'bloom') drawBloomHalo(ctx, x, y - tile * .13, tile * .75, plant.flowerId, visualTime, effects);
          drawPaintedPlant(ctx, plant.flowerId, plant.phase, x, y - tile * .13, tile * .75, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress, effects });
          if (need) bubbles.push({ need, x: x + (boothTypes.has(station.type) ? 15 : 9), y: y - 38, stationId: station.id });
        }
      } });
      if (task) {
        bubbles.push({ task, x, y: y + 1 });
      }
    }

    for (const [index, player] of state.players.entries()) {
      const last = actors.get(player.id);
      const view = last ?? { x: player.x, y: player.y, facing: player.facing || 1 };
      const dx = player.x - view.x;
      const dy = player.y - view.y;
      if (Math.abs(dx) > .015) view.facing = dx > 0 ? 1 : -1;
      const moving = !player.platformId && Math.abs(dx) + Math.abs(dy) > .015;
      if (Math.abs(dx) + Math.abs(dy) > 3) Object.assign(view, { x: player.x, y: player.y });
      else { view.x += dx * .6; view.y += dy * .6; }
      actors.set(player.id, view);
      const x = (view.x + .5) * tile;
      const y = (view.y + .87) * tile;
      const plant = plants.get(player.carryId);
      scene.push({ y: view.y + .02, paint() {
        if (player.id === myId) {
          block(ctx, '#1d2935', x - 14, y + 2, 28, 4);
          block(ctx, '#b3ffdc', x - 10, y + 3, 20, 2);
        }
        const height = tile * 1.13;
        drawPaintedGardener(ctx, x, y, height, visualTime, { index: player.seat ?? index, moving, facing: view.facing, carrying: Boolean(plant), effects });
        if (plant) {
          const need = getPlantNeed(plant, state);
          const potX = x + view.facing * 9;
          const potY = y - height * .42;
          if (plant.phase === 'bloom') drawBloomHalo(ctx, potX, potY, tile * .58, plant.flowerId, visualTime, effects);
          drawPaintedPlant(ctx, plant.flowerId, plant.phase, potX, potY, tile * .58, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress, effects, shadow: false });
          if (need) bubbles.push({ need, x: x + 18, y: y - 39 });
        }
      } });
    }

    for (const plant of state.plants) {
      if (plant.stationId || players.has(plant.holderId) || !Number.isFinite(plant.x) || !Number.isFinite(plant.y)) continue;
      const x = (plant.x + .5) * tile;
      const y = (plant.y + .87) * tile;
      scene.push({ y: plant.y, paint() {
        const need = getPlantNeed(plant, state);
        if (plant.phase === 'bloom') drawBloomHalo(ctx, x, y, tile * .79, plant.flowerId, visualTime, effects);
        drawPaintedPlant(ctx, plant.flowerId, plant.phase, x, y, tile * .79, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress, effects });
        if (need) bubbles.push({ need, x, y: y - 36, plantId: plant.beltId ? undefined : plant.id });
      } });
    }

    for (const entry of scene.sort((a, b) => a.y - b.y)) entry.paint();
    greenhouseEffects.drawBursts(ctx, time);
    targets = [];
    for (const { need, x, y, stationId, plantId, task } of bubbles) {
      if (task) {
        const progress = 1 - Math.max(0, task.remainingMs / task.durationMs);
        block(ctx, '#20182e', x - 18, y - 5, 36, 7);
        block(ctx, '#7c6e92', x - 16, y - 3, 32, 3);
        block(ctx, '#abffdc', x - 16, y - 3, Math.round(32 * progress), 3);
        continue;
      }
      const left = Math.min(board.width + 7, Math.max(-7, x));
      const top = Math.max(3, y);
      drawNeedBubble(ctx, need.kind, left, top, 22, visualTime, need);
      if (plantId || stationId) targets.push({ x: left, y: top, target: plantId ? { plantId } : { stationId } });
    }
    ctx.restore();
  }

  function hitTest(x, y) {
    const relativeX = x - board.x;
    const relativeY = y - board.y;
    const bubble = targets.findLast(item => Math.abs(relativeX - item.x) <= 10 && relativeY >= item.y - 17 && relativeY <= item.y + 2)?.target;
    const column = Math.floor(relativeX / tile);
    const row = Math.floor(relativeY / tile);
    const cell = column >= 0 && column < level.width && row >= 0 && row < level.height ? { x: column, y: row } : null;
    return { bubble, cell };
  }

  return { prepare, draw, hitTest };
}

export function drawMenuArt(canvas, t) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.imageSmoothingEnabled = false;
  const board = { x: 14, y: height - 49, width: width - 28, height: 29 };
  menuSky.draw(ctx, { width, height, board, theme: 'comet', time: t, effects: Boolean(t) });
  for (let i = 0; i < 72; i++) {
    const x = (i * 77 + 36) % width;
    const y = (i * 39 + 13) % (height - 42);
    const bright = Math.sin(t * 2 + i) > .37;
    block(ctx, bright ? '#ffe7c4' : '#666399', x, y, i % 6 ? 2 : 3, i % 6 ? 2 : 3);
    if (bright && i % 9 === 0) block(ctx, '#d6b6e0', x - 3, y + 1, 8, 1);
  }
  for (let x = 0; x < width; x += 48) drawFloorTile(ctx, x, height - 28, 48, 'dawn');
  for (const [index, x] of [18, 118, 407, 511].entries()) drawPaintedScenery(ctx, x, height - 15, 70, 'aurora', t, index);
  drawPaintedStation(ctx, 'truck', 64, height - 15, 108, t, { active: true, palette: 'dawn', effects: Boolean(t) });
  drawPaintedStation(ctx, 'moon', 256, height - 31, 145, t, { active: true, palette: 'moon', effects: Boolean(t) });
  drawPaintedGardener(ctx, 169, height - 12, 111, t, { index: 0, facing: 1, carrying: true });
  drawPaintedPlant(ctx, 'sunflare', 'bloom', 188, height - 54, 76, t, { pot: 'clay', effects: Boolean(t), shadow: false });
  drawPaintedPlant(ctx, 'moonbell', 'bloom', 262, height - 47, 86, t, { pot: 'silver', effects: Boolean(t) });
  drawPaintedGardener(ctx, 367, height - 9, 111, t, { index: 1, facing: -1, carrying: true });
  drawPaintedPlant(ctx, 'cometvine', 'bloom', 348, height - 51, 80, t, { pot: 'glass', effects: Boolean(t), shadow: false });
  drawPaintedStation(ctx, 'shower', 460, height - 17, 115, t, { active: true, palette: 'aurora', effects: Boolean(t) });
}
