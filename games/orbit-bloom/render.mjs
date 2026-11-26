import { drawFloorTile, drawGardener, drawNeedBubble, drawPlant, drawScenery, drawStation } from './pixel-art.mjs';
import { getPlantNeed, getTruckWindow } from './sim.mjs';

const tile = 48;
const boothTypes = new Set(['sun', 'moon', 'prism']);
export const THEME_COLORS = {
  dawn: '#ffc280', moon: '#9adfff', comet: '#bd9cff', dune: '#f9aa73', meteor: '#ff8d79',
  nebula: '#f4a0d9', frost: '#a9eefb', aurora: '#91f4c5', eclipse: '#e1a7ff', midnight: '#a9a8ff',
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

export function createBoardRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  const floor = background.getContext('2d');
  const actors = new Map();
  const bursts = [];
  let targets = [];
  let lastEvent;
  let level;

  function prepare(map) {
    level = map;
    actors.clear();
    bursts.length = 0;
    targets = [];
    lastEvent = undefined;
    canvas.width = background.width = map.width * tile;
    canvas.height = background.height = map.height * tile;
    ctx.imageSmoothingEnabled = false;
    floor.imageSmoothingEnabled = false;
    for (const [y, row] of map.layout.entries()) {
      for (const [x, cell] of [...row].entries()) {
        const left = x * tile;
        const top = y * tile;
        drawFloorTile(floor, left, top, tile, map.theme);
        if (cell === '#') {
          block(floor, '#20192f', left + 1, top + 3, tile - 2, tile - 4);
          block(floor, '#584867', left + 2, top + 3, tile - 4, 5);
          block(floor, '#322845', left + 4, top + 8, tile - 8, tile - 12);
          block(floor, '#3c3154', left + 4, top + 36, tile - 8, 2);
        } else if (cell === '~') {
          block(floor, '#2b4a63', left + 3, top + 3, tile - 6, tile - 6);
          block(floor, '#497188', left + 8, top + 14, 15, 2);
          block(floor, '#41697f', left + 21, top + 28, 17, 2);
        } else if (cell === '+') {
          block(floor, '#646059', left + 3, top + 19, tile - 6, 10);
          block(floor, '#95886b', left + 5, top + 20, 10, 2);
          block(floor, '#95886b', left + 26, top + 20, 10, 2);
        }
      }
    }
  }

  function draw(state, myId, time, effects, selected) {
    ctx.drawImage(background, 0, 0);
    const visualTime = effects ? time : 0;
    const plants = new Map(state.plants.map(plant => [plant.id, plant]));
    const players = new Map(state.players.map(player => [player.id, player]));
    const truck = getTruckWindow(state);
    const bubbles = [];
    const scene = [];
    const occupied = new Set(level.stations.map(station => `${station.x}:${station.y}`));

    for (const [x, y] of [[0, 0], [level.width - 1, 0], [0, level.height - 1], [level.width - 1, level.height - 1]]) {
      if (!occupied.has(`${x}:${y}`) && level.layout[y][x] === '.') {
        scene.push({ y: y - .1, paint: () => drawScenery(ctx, (x + .5) * tile, (y + .87) * tile, tile * 1.06, level.theme, visualTime, x + y + 3) });
      }
    }

    for (const [y, row] of level.layout.entries()) {
      for (const [x, cell] of [...row].entries()) {
        if (cell === '#') scene.push({ y, paint: () => drawScenery(ctx, (x + .5) * tile, (y + .87) * tile, tile * 1.06, level.theme, visualTime, x + y * 11) });
      }
    }

    for (const station of state.stations) {
      const x = (station.x + .5) * tile;
      const y = (station.y + .91) * tile;
      const plant = plants.get(station.plantId);
      const active = station.type === 'truck' ? truck.open : Boolean(plant) || state.players.some(player => player.action?.stationId === station.id);
      const large = station.type === 'truck' ? 1.22 : 1.06;
      scene.push({ y: station.y, paint() {
        block(ctx, selected?.stationId === station.id ? '#fff2b4' : stationColor(station), x - 17, y + 1, 34, selected?.stationId === station.id ? 3 : 2);
        drawStation(ctx, station.type, x, y, tile * large, visualTime, { active, variant: station.variant, palette: level.theme });
        if (plant) {
          const need = getPlantNeed(plant, state);
          drawPlant(ctx, plant.flowerId, plant.phase, x, y - tile * .13, tile * .75, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress });
          if (need) bubbles.push({ need, x: x + (boothTypes.has(station.type) ? 15 : 9), y: y - 38, stationId: station.id });
        }
      } });
    }

    for (const [index, player] of state.players.entries()) {
      const last = actors.get(player.id);
      const view = last ?? { x: player.x, y: player.y, facing: 1 };
      const dx = player.x - view.x;
      const dy = player.y - view.y;
      if (Math.abs(dx) > .015) view.facing = dx > 0 ? 1 : -1;
      const moving = Math.abs(dx) + Math.abs(dy) > .015;
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
        drawGardener(ctx, x, y, tile * .92, visualTime, { index: player.seat ?? index, moving, facing: view.facing, carrying: Boolean(plant) });
        if (plant) {
          const need = getPlantNeed(plant, state);
          drawPlant(ctx, plant.flowerId, plant.phase, x + view.facing * 10, y - 10, tile * .63, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress });
          if (need) bubbles.push({ need, x: x + 13, y: y - 34 });
        }
      } });
    }

    for (const plant of state.plants) {
      if (plant.stationId || players.has(plant.holderId) || !Number.isFinite(plant.x) || !Number.isFinite(plant.y)) continue;
      const x = (plant.x + .5) * tile;
      const y = (plant.y + .87) * tile;
      scene.push({ y: plant.y, paint() {
        const need = getPlantNeed(plant, state);
        drawPlant(ctx, plant.flowerId, plant.phase, x, y, tile * .79, visualTime, { pot: plant.pot, quality: plant.quality, progress: need?.progress });
        if (need) bubbles.push({ need, x, y: y - 36, plantId: plant.id });
      } });
    }

    for (const entry of scene.sort((a, b) => a.y - b.y)) entry.paint();
    const impactColors = { deliver: '#fff2aa', bloom: '#ffd3f1', roots: '#c8ffc7', repot: '#efb18e', water: '#98e7ff' };
    if (effects && lastEvent !== undefined) {
      for (const event of state.events) {
        if (event.id > lastEvent && impactColors[event.kind]) bursts.push({ ...event, start: time, color: impactColors[event.kind] });
      }
    }
    lastEvent = state.lastEventId;
    while (bursts.length && time - bursts[0].start > .7) bursts.shift();
    if (effects) {
      for (const burst of bursts) {
        const age = time - burst.start;
        const x = (burst.x + .5) * tile;
        const y = (burst.y + .45) * tile;
        ctx.globalAlpha = 1 - age / .7;
        for (let fleck = 0; fleck < 8; fleck++) {
          const angle = fleck * Math.PI / 4 + burst.id;
          const reach = 5 + age * 31;
          block(ctx, burst.color, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach - age * 8, fleck % 3 + 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    targets = [];
    for (const { need, x, y, stationId, plantId } of bubbles) {
      const left = Math.min(canvas.width - 14, Math.max(14, x));
      const top = Math.max(21, y);
      drawNeedBubble(ctx, need.kind, left, top, 22, visualTime, need);
      if (plantId || stationId) targets.push({ x: left, y: top, target: plantId ? { plantId } : { stationId } });
    }
  }

  function bubbleAt(x, y) {
    return targets.findLast(item => Math.abs(x - item.x) <= 10 && y >= item.y - 17 && y <= item.y + 2)?.target;
  }

  return { prepare, draw, bubbleAt };
}

export function drawMenuArt(canvas, t) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.imageSmoothingEnabled = false;
  block(ctx, '#25173b', 0, 0, width, height);
  block(ctx, '#30244e', 0, 64, width, 115);
  for (let i = 0; i < 72; i++) {
    const x = (i * 77 + 36) % width;
    const y = (i * 39 + 13) % (height - 42);
    const bright = Math.sin(t * 2 + i) > .37;
    block(ctx, bright ? '#ffe7c4' : '#666399', x, y, i % 6 ? 2 : 3, i % 6 ? 2 : 3);
    if (bright && i % 9 === 0) block(ctx, '#d6b6e0', x - 3, y + 1, 8, 1);
  }
  for (let x = 0; x < width; x += 48) drawFloorTile(ctx, x, height - 28, 48, 'dawn');
  for (const [index, x] of [18, 118, 407, 511].entries()) drawScenery(ctx, x, height - 15, 70, 'aurora', t, index);
  drawStation(ctx, 'truck', 64, height - 15, 108, t, { active: true, palette: 'dawn' });
  drawStation(ctx, 'moon', 256, height - 31, 145, t, { active: true, palette: 'moon' });
  drawGardener(ctx, 169, height - 12, 91, t, { index: 0, facing: 1, carrying: true });
  drawPlant(ctx, 'sunflare', 'bloom', 197, height - 31, 92, t, { pot: 'clay' });
  drawPlant(ctx, 'moonbell', 'bloom', 262, height - 47, 86, t, { pot: 'silver' });
  drawGardener(ctx, 367, height - 9, 91, t, { index: 1, facing: -1, carrying: true });
  drawPlant(ctx, 'cometvine', 'bloom', 341, height - 29, 104, t, { pot: 'glass' });
  drawStation(ctx, 'shower', 460, height - 17, 115, t, { active: true, palette: 'aurora' });
}
