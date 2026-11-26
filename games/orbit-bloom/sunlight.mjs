// Bright light, reflected color, shade, strength, window position, ray lean, reach.
const LIGHT = {
  dawn:        ['#fff0c4', '#edb078', '#352a42', .86, .70, -.52, .69],
  moon:        ['#c1e9ff', '#729fcc', '#182743', .34, .42, .42, .49],
  comet:       ['#f3dafa', '#b88bc3', '#2d2548', .47, .28, .49, .57],
  dune:        ['#ffe0aa', '#ed9e65', '#503245', .82, .70, -.53, .72],
  meteor:      ['#ffdbb7', '#cc8b82', '#392647', .65, .29, .57, .63],
  nebula:      ['#f8cdf2', '#bb82ca', '#372449', .44, .68, -.42, .51],
  frost:       ['#dff8ff', '#a5cce0', '#304563', .52, .23, .42, .57],
  aurora:      ['#c0fbe2', '#8ac4bd', '#213344', .45, .72, -.49, .60],
  eclipse:     ['#edc9f6', '#a989c4', '#332445', .32, .33, .45, .49],
  midnight:    ['#d8ddff', '#8f97cf', '#1c294e', .24, .72, -.43, .43],
  pollenworks: ['#fff2cc', '#e5b57e', '#433847', .79, .25, .43, .65],
  tidalglass:  ['#ddffe9', '#91cbbb', '#244b52', .68, .22, .37, .63],
  switchyard:  ['#ffe5ba', '#df9a80', '#422c46', .74, .73, -.39, .68],
  drawbridge:  ['#d9e2ff', '#989ed0', '#26324f', .35, .44, .29, .53],
  saturn:      ['#f4dfc6', '#c7a2b6', '#362948', .48, .61, -.46, .54],
};

function canvasLayer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  return canvas;
}

function linear(ctx, x0, y0, x1, y1, stops) {
  const paint = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) paint.addColorStop(at, color);
  return paint;
}

function glow(ctx, x, y, width, height, stops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);
  const paint = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, color] of stops) paint.addColorStop(at, color);
  ctx.fillStyle = paint;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function shaftTexture(light, reflection) {
  const layer = canvasLayer(132, 256);
  const ctx = layer.getContext('2d');
  ctx.fillStyle = linear(ctx, 0, 0, 0, layer.height, [
    [0, `${light}ed`], [.26, `${light}d8`], [.61, `${reflection}91`], [.91, `${reflection}2c`], [1, `${reflection}00`],
  ]);
  const center = layer.width / 2;
  for (let edge = 0; edge < 9; edge++) {
    const top = 14 - edge * .75;
    const bottom = 63 - edge * 5.2;
    ctx.globalAlpha = .04 + edge * .015;
    ctx.beginPath();
    ctx.moveTo(center - top, 0);
    ctx.bezierCurveTo(center - top * 1.3, 70, center - bottom * .72, 174, center - bottom, 256);
    ctx.lineTo(center + bottom, 256);
    ctx.bezierCurveTo(center + bottom * .72, 174, center + top * 1.3, 70, center + top, 0);
    ctx.closePath();
    ctx.fill();
  }
  return layer;
}

function floorPool(ctx, x, y, width, height, slope, light, reflected) {
  glow(ctx, x, y - height * .1, width * .8, height * .88,
    [[0, `${light}b4`], [.35, `${light}6c`], [.72, `${reflected}34`], [1, `${reflected}00`]]);
  ctx.save();
  ctx.transform(1, 0, slope * .42, 1, x, y - height * .44);
  ctx.fillStyle = linear(ctx, 0, 0, 0, height, [[0, `${light}00`], [.18, `${light}43`], [.63, `${light}24`], [1, `${reflected}00`]]);
  const paneWidth = width * .21;
  const paneHeight = height * .6;
  for (const offset of [-paneWidth - 2, 2]) {
    for (const rise of [0, paneHeight + 3]) {
      ctx.beginPath();
      ctx.roundRect(offset, rise, paneWidth, paneHeight, 3);
      ctx.fill();
    }
  }
  ctx.restore();
}

function roomClip(ctx, level, tile, padding) {
  ctx.beginPath();
  ctx.rect(0, -padding, level.width * tile, padding);
  for (const [y, row] of level.layout.entries()) {
    for (const [x, cell] of [...row].entries()) {
      if (cell !== '#') ctx.rect(x * tile, y * tile, tile, tile);
    }
  }
  ctx.clip();
}

function windowsFor(level, tile, preference, strength) {
  const eligible = Array.from({ length: level.width - 2 }, (_, index) => index + 1)
    .filter(x => level.layout[0][x] !== '#');
  const source = preference * level.width;
  return eligible.sort((a, b) => Math.abs(a + .5 - source) - Math.abs(b + .5 - source))
    .slice(0, strength >= .65 ? 3 : 2).map(x => (x + .5) * tile);
}

function bakeFloor(level, tile, swatch, windows, padding) {
  const [light, reflected, shade, strength, , lean, reach] = swatch;
  const width = level.width * tile;
  const height = level.height * tile;
  const shadow = canvasLayer(width, height + padding);
  const floor = canvasLayer(width, height + padding);
  const dark = shadow.getContext('2d');
  const ctx = floor.getContext('2d');
  const beam = shaftTexture(light, reflected);
  paintShade(dark, width, height, shade, lean, padding);
  ctx.translate(0, padding);
  roomClip(ctx, level, tile, padding);
  for (const [i, x] of windows.entries()) {
    const length = height * reach * (1 - i * .14);
    const spread = tile * (2.54 + i * .23);
    const sourceY = 4 - tile * .43;
    ctx.globalAlpha = strength * (1 - i * .19);
    ctx.save();
    ctx.transform(1, 0, lean - i * .038, 1, x, sourceY);
    ctx.drawImage(beam, -spread / 2, 0, spread, length);
    ctx.restore();
    ctx.globalAlpha *= .47;
    floorPool(ctx, x + (lean - i * .038) * length * .58, sourceY + length * .58,
      tile * 1.64, tile * .9, lean, light, reflected);
    ctx.globalAlpha *= .75;
    glow(ctx, x, 3 - tile * .44, tile * .46, tile * .36,
      [[0, `${light}8e`], [.57, `${reflected}49`], [1, `${reflected}00`]]);
  }
  return { shadow, floor };
}

function paintShade(ctx, width, height, shade, lean, padding) {
  const far = lean > 0 ? width : 0;
  ctx.fillStyle = linear(ctx, width - far, padding, far, height + padding, [
    [0, `${shade}00`], [.42, `${shade}03`], [.78, `${shade}16`], [1, `${shade}2a`],
  ]);
  ctx.fillRect(0, padding, width, height);
}

function lensTextures(light, reflected) {
  const source = canvasLayer(112, 68);
  const ctx = source.getContext('2d');
  glow(ctx, 56, 34, 50, 31, [[0, `${light}c0`], [.22, `${light}61`], [.48, `${reflected}35`], [1, `${reflected}00`]]);
  glow(ctx, 56, 34, 54, 5, [[0, `${light}e2`], [.24, `${light}83`], [1, `${reflected}00`]]);
  glow(ctx, 56, 34, 3, 15, [[0, `${light}de`], [.38, `${light}6e`], [1, `${reflected}00`]]);
  const ghost = canvasLayer(60, 60);
  const ring = ghost.getContext('2d');
  glow(ring, 30, 30, 30, 30, [[0, `${light}13`], [.59, `${reflected}2a`], [.83, `${light}62`], [1, `${light}00`]]);
  ring.strokeStyle = `${light}42`;
  ring.lineWidth = .8;
  ring.beginPath();
  for (let point = 0; point < 6; point++) {
    const angle = Math.PI * (point / 3 + .1);
    ring.lineTo(30 + Math.cos(angle) * 20, 30 + Math.sin(angle) * 20);
  }
  ring.closePath();
  ring.stroke();
  return { source, ghost };
}

export function createSunlight() {
  let prepared;
  return {
    prepare(level, tile) {
      const swatch = LIGHT[level.theme] ?? LIGHT.dawn;
      const [light, reflected, , strength, preference] = swatch;
      const windows = windowsFor(level, tile, preference, strength);
      const padding = tile;
      prepared = { ...bakeFloor(level, tile, swatch, windows, padding), ...lensTextures(light, reflected),
        tile, swatch, padding, anchor: windows[0], width: tile * level.width };
    },

    drawFloor(ctx, time, effects) {
      if (!prepared) return;
      const { floor, shadow, padding } = prepared;
      ctx.save();
      ctx.drawImage(shadow, 0, -padding);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(floor, 0, -padding);
      ctx.restore();
    },

    drawLens(ctx, time, effects) {
      if (!prepared || !effects || prepared.anchor === undefined) return;
      const { tile, anchor, width, source, ghost, swatch } = prepared;
      const [, , , strength, , lean] = swatch;
      const breathe = Math.sin(time * .39) * .05;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = strength * (.43 + breathe);
      ctx.drawImage(source, anchor - 40, -tile * .85, 80, tile * 1.03);
      ctx.globalAlpha = strength * (.16 + breathe * .5);
      for (const [i, travel] of [tile * .78, tile * 1.51].entries()) {
        const x = anchor + travel * lean;
        const size = 19 - i * 5;
        if (x - size / 2 >= 8 && x + size / 2 <= width - 8) {
          ctx.drawImage(ghost, x - size / 2, travel - size / 2 - tile * .19, size, size);
        }
      }
      ctx.restore();
    },
  };
}
