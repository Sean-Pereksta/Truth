import { FLOWERS } from './levels.mjs';
import { drawNeedIcon, drawPlant, drawScenery, drawStation } from './pixel-art.mjs';

const stationOrder = ['seed', 'shower', 'sun', 'moon', 'prism', 'repot', 'prune', 'ingredient', 'shelf', 'truck', 'compost', 'planter'];
const plantColumns = ['sunflare', 'moonbell', 'cometvine', 'nebulalily', 'eclipseorchid'];
const celestialColumns = ['emberhibiscus', 'aurorairis', 'starjasmine'];
const plantRows = ['seed', 'sprout', 'bud', 'bloom'];
const celestialFallbacks = { emberhibiscus: 'sunflare', aurorairis: 'nebulalily', starjasmine: 'moonbell' };
const flowerGlints = { emberhibiscus: '#ffe0a5', aurorairis: '#caffed', starjasmine: '#fff5d2' };

const stationSizes = {
  seed: [1.02, .83], shower: [.99, 1.07], sun: [.96, 1.07], moon: [.96, 1.07], prism: [.96, 1.07],
  repot: [1, .78], prune: [1, .78], ingredient: [.93, .87], shelf: [1, .67], truck: [1.34, .91],
  compost: [.9, .76], planter: [.88, .83],
};
const stageHeights = { seed: .54, sprout: .75, bud: .97, bloom: 1.12 };
const thermalColors = { sun: '#fff0ab', moon: '#c5eeff', prism: '#f4caff' };
const potColors = { starter: '#d0a484', clay: '#ed9b77', silver: '#d4e4f1', glass: '#a5e6d6' };
const ceramicPaint = { silver: [156, 169, 194], glass: [98, 172, 167] };
const stationsUrl = new URL('./assets/painted-stations.webp', import.meta.url);
const plantsUrl = new URL('./assets/painted-plants.webp', import.meta.url);
const celestialUrl = new URL('./assets/celestial-blooms.webp', import.meta.url);

let stations;
let plants;
let celestialBlooms;
let loading;

function cellBounds(source, width, left, top, cellWidth, cellHeight) {
  let x0 = cellWidth;
  let y0 = cellHeight;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < cellHeight; y++) {
    const rowOffset = ((top + y) * width + left) * 4;
    for (let x = 0; x < cellWidth; x++) {
      if (source[rowOffset + x * 4 + 3] < 22) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x0 > x1 || y0 > y1) return undefined;
  const margin = 2;
  const safeLeft = Math.max(0, x0 - margin);
  const safeTop = Math.max(0, y0 - margin);
  return {
    x: left + safeLeft,
    y: top + safeTop,
    width: Math.min(cellWidth, x1 + margin + 1) - safeLeft,
    height: Math.min(cellHeight, y1 + margin + 1) - safeTop,
  };
}

function paintCeramic(source, width, height, frames, glaze) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const painted = ctx.createImageData(width, height);
  painted.data.set(source);
  for (const frame of frames) {
    if (!frame) continue;
    const firstRow = Math.floor(frame.height * .59);
    const blendRows = Math.max(1, Math.floor(frame.height * .13));
    for (let row = firstRow; row < frame.height; row++) {
      const depth = Math.min(1, (row - firstRow) / blendRows);
      for (let col = 0; col < frame.width; col++) {
        const offset = ((frame.y + row) * width + frame.x + col) * 4;
        const red = source[offset];
        const green = source[offset + 1];
        const blue = source[offset + 2];
        const alpha = source[offset + 3];
        if (alpha < 12 || red < green + 8 || red < blue + 14) continue;
        const warmth = Math.min(1, (red - blue - 14) / 38) * depth;
        const light = (.22 * red + .69 * green + .09 * blue - 147) * 1.08;
        for (let channel = 0; channel < 3; channel++) {
          const original = source[offset + channel];
          painted.data[offset + channel] = original + (glaze[channel] + light - original) * warmth;
        }
      }
    }
  }
  ctx.putImageData(painted, 0, 0);
  return canvas;
}

function atlasFrames(image, columns, rows, hasPots) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || width % columns || height % rows) return undefined;

  const cellWidth = width / columns;
  const cellHeight = height / rows;
  if (cellWidth < 24 || cellHeight < 24) return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const frames = Array.from({ length: columns * rows }, (_, index) => cellBounds(
    data, width, index % columns * cellWidth, Math.floor(index / columns) * cellHeight,
    cellWidth, cellHeight,
  ));
  if (!frames.some(Boolean)) return undefined;
  const glazes = {};
  if (hasPots && typeof ctx.createImageData === 'function') {
    for (const [key, color] of Object.entries(ceramicPaint)) glazes[key] = paintCeramic(data, width, height, frames, color);
  }
  return { image, frames, glazes };
}

function loadAtlas(url, columns, rows, hasPots = false) {
  return new Promise(resolve => {
    const image = new Image();
    image.addEventListener('load', () => {
      try {
        resolve(atlasFrames(image, columns, rows, hasPots));
      } catch {
        resolve(undefined);
      }
    }, { once: true });
    image.addEventListener('error', () => resolve(undefined), { once: true });
    image.src = url.href;
  });
}

export function loadPaintedWorld() {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ stations: false, plants: false, celestialBlooms: false });
  }
  loading ??= Promise.all([
    loadAtlas(stationsUrl, 4, 3).then(atlas => { stations = atlas; }),
    loadAtlas(plantsUrl, plantColumns.length, plantRows.length, true).then(atlas => { plants = atlas; }),
    loadAtlas(celestialUrl, celestialColumns.length, plantRows.length, true).then(atlas => { celestialBlooms = atlas; }),
  ]).then(() => ({ stations: Boolean(stations), plants: Boolean(plants), celestialBlooms: Boolean(celestialBlooms) }));
  return loading;
}

void loadPaintedWorld();

function paintSprite(ctx, atlas, index, x, y, maxWidth, maxHeight, { lift = 0, shadow = true, pot, sway = 0 } = {}) {
  const frame = atlas?.frames[index];
  if (!frame) return undefined;
  const scale = Math.min(maxWidth / frame.width, maxHeight / frame.height);
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const left = Math.round(x - width / 2);
  const top = Math.round(y - height - lift);

  ctx.save();
  if (shadow) {
    ctx.fillStyle = '#1b182b59';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, width * .37, Math.max(2, width * .074), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const source = atlas.glazes[pot] ?? atlas.image;
  if (sway) {
    ctx.translate(x, y - lift);
    ctx.transform(1, 0, sway, 1, 0, 0);
    ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, -width / 2, -height, width, height);
  } else {
    ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, left, top, width, height);
  }
  ctx.restore();
  return { left, top, width, height };
}

function cornerEmblem(ctx, sprite, key, variant, size) {
  const color = key === 'seed' ? FLOWERS[variant]?.color : potColors[variant];
  if (!color && key !== 'ingredient' && key !== 'repot') return;
  const width = Math.max(8, Math.round(size * .18));
  const x = sprite.left + sprite.width * .76;
  const y = sprite.top + sprite.height * .75;
  ctx.save();
  ctx.fillStyle = '#28243b';
  ctx.fillRect(Math.round(x), Math.round(y), width + 2, width + 2);
  ctx.fillStyle = '#f6ebd6';
  ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, width, width);
  if (color && key === 'seed') {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + width * .26), Math.round(y + width * .27), Math.round(width * .65), Math.round(width * .65));
  } else {
    const need = key === 'repot' && variant ? `repot${variant}` : variant;
    drawNeedIcon(ctx, need, x + width * .46, y + width * .52, width * .84);
  }
  ctx.restore();
}

function stationMotion(ctx, kind, sprite, time) {
  const { left, top, width, height } = sprite;
  const color = thermalColors[kind];
  ctx.save();
  const opacity = ctx.globalAlpha;
  if (kind === 'shower') {
    for (let index = 0; index < 6; index++) {
      const fall = (time * 2.7 + index * .21) % 1;
      ctx.globalAlpha = opacity * (.3 + (1 - fall) * .53);
      ctx.fillStyle = index % 2 ? '#c8f6f4' : '#e9fff8';
      ctx.fillRect(Math.round(left + width * (.32 + index * .06)), Math.round(top + height * (.33 + fall * .37)), 1, 3);
    }
  } else if (color) {
    ctx.globalAlpha = opacity * (.3 + (1 + Math.sin(time * 6)) * .25);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(left + width * .18), Math.round(top + height * .25), Math.max(2, Math.round(width * .08)), 2);
  } else if (kind === 'truck') {
    ctx.globalAlpha = opacity * (.35 + (1 + Math.sin(time * 7)) * .24);
    ctx.fillStyle = '#ffedab';
    ctx.fillRect(Math.round(left + width * .84), Math.round(top + height * .6), 3, 2);
  }
  ctx.restore();
}

export function drawPaintedStation(ctx, kind, x, y, size, time, options = {}) {
  const [width, height] = stationSizes[kind] ?? [1, 1];
  const { active = false, variant, effects = true } = options;
  const sprite = paintSprite(ctx, stations, stationOrder.indexOf(kind), x, y, size * width, size * height);
  if (!sprite) {
    drawStation(ctx, kind, x, y, size, time, options);
    return;
  }
  if (active && effects) stationMotion(ctx, kind, sprite, time);
  if (variant) cornerEmblem(ctx, sprite, kind, variant, size);
}

function bloomGleam(ctx, sprite, color, time, phase) {
  const brightness = .5 + Math.sin(time * 2 + phase) * .5;
  if (brightness < .4) return;
  const x = sprite.left + sprite.width * (.38 + Math.sin(phase) * .12);
  const y = sprite.top + sprite.height * .2;
  ctx.globalAlpha *= brightness * .68;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, .85, 1.35, Math.PI * .17, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPaintedPlant(ctx, species, phase, x, y, size, time, options = {}) {
  const celestialColumn = celestialColumns.indexOf(species);
  const isCelestial = celestialColumn >= 0;
  const columns = isCelestial ? celestialColumns : plantColumns;
  const column = isCelestial ? celestialColumn : plantColumns.indexOf(species);
  const row = plantRows.indexOf(phase);
  const { pot = 'starter', quality, effects = true, shadow = true } = options;
  const blooming = phase === 'bloom';
  const petalPhase = x * .065 + column * .82;
  const drift = effects && blooming ? Math.sin(time * 2.8 + petalPhase) : 0;
  const lift = effects && blooming ? .6 + drift * .5 : 0;
  const index = row >= 0 && column >= 0 ? row * columns.length + column : -1;
  const sprite = paintSprite(ctx, isCelestial ? celestialBlooms : plants, index, x, y, size * 1.04,
    size * (stageHeights[phase] ?? 1), { lift, shadow, pot, sway: drift * .034 });
  if (!sprite) {
    drawPlant(ctx, celestialFallbacks[species] ?? species, phase, x, y, size, effects ? time : 0, options);
    return;
  }
  ctx.save();
  if (pot !== 'starter' && potColors[pot]) {
    const band = Math.max(3, Math.round(sprite.width * .19));
    ctx.fillStyle = potColors[pot];
    ctx.fillRect(Math.round(x - band / 2), Math.round(y - Math.max(2, size * .11) - lift), band, 1);
  }
  if (quality === 'standard' || quality === 'rootbound') {
    ctx.fillStyle = '#b7756d';
    ctx.fillRect(Math.round(x + sprite.width * .14), Math.round(y - size * .12 - lift), 2, 2);
  }
  if (effects && blooming && size >= 22) bloomGleam(ctx, sprite, flowerGlints[species] ?? FLOWERS[species]?.color ?? '#fff5d2', time, petalPhase);
  ctx.restore();
}

export function drawPaintedScenery(ctx, x, y, size, theme, time, seed = 0) {
  if (!stations) {
    drawScenery(ctx, x, y, size, theme, time, seed);
    return;
  }
  const softMotion = time ? Math.sin(time * 1.2 + seed * 1.9) * .3 : 0;
  if (seed % 3 === 1) {
    const species = theme === 'dawn' ? 'sunflare' : theme === 'moon' || theme === 'frost' ? 'moonbell'
      : theme === 'aurora' || theme === 'tidalglass' ? 'cometvine' : theme === 'saturn' || theme === 'eclipse' ? 'eclipseorchid' : 'nebulalily';
    drawPaintedPlant(ctx, species, 'bloom', x, y, size * .76, time, { pot: 'clay', effects: Boolean(time) });
    return;
  }
  const [width, height] = stationSizes.planter;
  if (!paintSprite(ctx, stations, stationOrder.indexOf('planter'), x, y, size * width, size * height, { lift: softMotion })) {
    drawScenery(ctx, x, y, size, theme, time, seed);
  }
}
