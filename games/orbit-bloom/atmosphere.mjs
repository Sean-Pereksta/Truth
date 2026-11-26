const SKY_ATLAS = new URL('./assets/painted-skies.webp', import.meta.url);
let skyAtlas;
let skyRequested = false;

// Atlas panels are dawn, afternoon, twilight, lunar blue, storm, and deep space.
const SKIES = {
  dawn:        [0, '#302647', '#905470', '#e79e79', '#ffd6a2', '#ca9aba', '#635678', 1],
  moon:        [3, '#131d39', '#324e73', '#667fb2', '#c8f0ff', '#94a9d6', '#475582', -1],
  comet:       [2, '#251e41', '#554174', '#b77589', '#ffe0dd', '#c6a0d9', '#655182', 1],
  dune:        [0, '#433048', '#9c6358', '#e4a76b', '#ffdfaa', '#d19baa', '#795774', -1],
  meteor:      [2, '#392742', '#76475f', '#b96a69', '#ffd8ad', '#ce909c', '#774d76', 1],
  nebula:      [4, '#221d40', '#563b75', '#a4649d', '#fce2f1', '#c894d4', '#6b4f8f', -1],
  frost:       [3, '#192a45', '#426789', '#8ab9cd', '#dcf5fa', '#a6c9dd', '#5b709e', 1],
  aurora:      [3, '#112537', '#325e69', '#85a990', '#c1f3d7', '#8ababd', '#426a87', -1],
  eclipse:     [4, '#2b1d3e', '#634571', '#a1659b', '#ffd5ee', '#bf95d0', '#694e8a', 1],
  midnight:    [5, '#131935', '#303667', '#6965aa', '#dedaff', '#9d9ad7', '#50558f', -1],
  pollenworks: [1, '#404c5b', '#7d8784', '#e5b17e', '#ffedae', '#d0afa2', '#756b82', 1],
  tidalglass:  [1, '#193a53', '#47898b', '#a7c5ab', '#e1ffe4', '#a0ccd5', '#557b98', -1],
  switchyard:  [2, '#38233f', '#884d63', '#d98773', '#ffd3a9', '#ce9caa', '#7c587a', 1],
  drawbridge:  [3, '#172244', '#4c5982', '#8b80b8', '#dfe7ff', '#a7abd6', '#586493', -1],
  saturn:      [5, '#2d2442', '#645075', '#ae7780', '#ffe2b8', '#cfadc0', '#766084', 1],
};

const SWELLS = [
  [[.11,.66,.15,.20], [.26,.56,.17,.25], [.42,.44,.20,.30], [.59,.32,.19,.30], [.76,.50,.19,.24], [.9,.66,.13,.17]],
  [[.10,.60,.15,.13], [.27,.51,.20,.18], [.44,.49,.21,.22], [.62,.47,.23,.22], [.79,.52,.20,.17], [.92,.61,.13,.13]],
  [[.12,.62,.16,.20], [.28,.51,.19,.22], [.41,.36,.16,.29], [.55,.42,.16,.25], [.70,.47,.16,.22], [.87,.54,.16,.19]],
  [[.10,.65,.16,.14], [.22,.57,.16,.18], [.39,.47,.22,.22], [.56,.50,.23,.23], [.71,.38,.17,.28], [.85,.50,.15,.22]],
];

const mod = (value, size) => (value % size + size) % size;
const mixNoise = seed => ((Math.imul(seed, 1664525) + 1013904223) >>> 8) / 16777216;

function layer(ctx, width, height) {
  const doc = ctx.canvas.ownerDocument;
  const canvas = doc ? doc.createElement('canvas') : new OffscreenCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadSky() {
  if (skyRequested || typeof Image === 'undefined') return;
  skyRequested = true;
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => { skyAtlas = img; }, { once: true });
  img.src = SKY_ATLAS.href;
}

function fill(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function gradient(ctx, stops, x0, y0, x1, y1) {
  const wash = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [position, color] of stops) wash.addColorStop(position, color);
  return wash;
}

function mist(ctx, x, y, width, height, stops, lightX = 0, lightY = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);
  const paint = ctx.createRadialGradient(lightX, lightY, 0, 0, 0, 1);
  for (const [position, color] of stops) paint.addColorStop(position, color);
  fill(ctx, paint, -1, -1, 2, 2);
  ctx.restore();
}

function panelSource(image, index) {
  const panelWidth = image.naturalWidth / 3;
  const panelHeight = image.naturalHeight / 2;
  return { x: index % 3 * panelWidth, y: Math.floor(index / 3) * panelHeight, panelWidth, panelHeight };
}

function atlasPanel(ctx, image, index, width, height) {
  const { x, y, panelWidth, panelHeight } = panelSource(image, index);
  const border = 4;
  const sourceWidth = panelWidth - 2 * border;
  const sourceHeight = panelHeight - 2 * border;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  ctx.drawImage(image, x + border, y + border, sourceWidth, sourceHeight,
    (width - sourceWidth * scale) / 2, (height - sourceHeight * scale) / 2, sourceWidth * scale, sourceHeight * scale);
}

function flecks(ctx, width, height, board, light, celestials) {
  for (let i = 0; i < 320; i++) {
    const x = Math.floor(mixNoise(7137 + i * 11257) * width);
    const y = Math.floor(mixNoise(31831 + i * 53771) * height);
    if (x > board.x && x < board.x + board.width && y > board.y && y < board.y + board.height) continue;
    const bright = celestials && i % 7 === 0;
    fill(ctx, `${light}${bright ? '8c' : '23'}`, x, y, bright ? 1.5 : 1, bright ? 1.5 : 1);
    if (bright && i % 4 === 0) {
      fill(ctx, `${light}37`, x - 2, y + .4, 6, .7);
      fill(ctx, `${light}37`, x + .4, y - 2, .7, 6);
    }
  }
}

function proceduralHorizon(ctx, width, height, board, swatch) {
  const [, top, mid, bottom, light, , deep] = swatch;
  const edge = board.y + board.height;
  const depth = height - edge;
  for (let z = 0; z < 3; z++) {
    const y = edge + depth * (.82 - z * .23);
    const paint = gradient(ctx, [[0, `${deep}90`], [.56, `${mid}48`], [1, `${top}70`]], 0, y - 25, 0, height);
    ctx.fillStyle = paint;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, y);
    for (let i = 1; i < 14; i++) {
      const x = width * i / 13;
      const crest = mixNoise(i * 31337 + z * 173999) * (15 + z * 4);
      ctx.quadraticCurveTo(x - width / 22, y - crest, x, y - crest * .55);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }
  mist(ctx, width * .18, edge + depth * .16, width * .72, height * .28,
    [[0, `${light}43`], [.43, `${bottom}21`], [1, `${bottom}00`]]);
}

function paintSky(ctx, width, height, board, swatch, image) {
  const [scene, top, mid, bottom, light] = swatch;
  fill(ctx, gradient(ctx, [[0, top], [.53, mid], [1, bottom]], 0, 0, 0, height), 0, 0, width, height);
  if (image) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    atlasPanel(ctx, image, scene, width, height);
    ctx.restore();
    const grade = gradient(ctx, [[0, `${top}66`], [.48, `${mid}29`], [1, `${bottom}52`]], 0, 0, width * .24, height);
    fill(ctx, grade, 0, 0, width, height);
  } else {
    proceduralHorizon(ctx, width, height, board, swatch);
  }
  mist(ctx, board.x * .25, board.y + board.height * .73, width * .64, height * .54,
    [[0, `${light}24`], [.36, `${bottom}17`], [1, `${bottom}00`]]);
  flecks(ctx, width, height, board, light, scene > 2);
}

function cloudBrush(ctx, swatch, variant, image) {
  const width = 300;
  const height = 130;
  const canvas = layer(ctx, width, height);
  const art = canvas.getContext('2d');
  const [scene, , , , light, cloud, deep] = swatch;
  const lightWash = [[0, `${light}df`], [.35, `${light}a5`], [.69, `${cloud}85`], [.9, `${deep}39`], [1, `${deep}00`]];
  const shadeWash = [[0, `${deep}b4`], [.63, `${cloud}79`], [1, `${cloud}00`]];
  mist(art, width * .5, height * .74, width * .5, height * .27, shadeWash);
  for (const [x, y, w, h] of SWELLS[variant % SWELLS.length]) {
    mist(art, width * x, height * y, width * w, height * h, lightWash, -.16, -.20);
  }
  for (let i = 0; i < 8; i++) {
    const x = .1 + i * .112;
    const y = .66 + mixNoise(4717 + (variant + i) * 41957) * .11;
    mist(art, width * x, height * y, width * (.14 + i % 2 * .02), height * .095, shadeWash);
  }
  art.globalCompositeOperation = 'source-atop';
  if (image) {
    // Reuse real brushwork from the atlas inside an alpha mask. The outline stays
    // feathery even as a brightly painted cloud slides into a darker part of the sky.
    const { x, y, panelWidth, panelHeight } = panelSource(image, scene);
    art.imageSmoothingQuality = 'high';
    art.globalAlpha = .49;
    art.drawImage(image, x + panelWidth * [.035, .37, .13, .44][variant],
      y + panelHeight * (.59 + (variant % 3) * .051), panelWidth * .51,
      panelHeight * .285, 0, 0, width, height);
    art.globalAlpha = 1;
    fill(art, gradient(art, [[0, `${light}13`], [.53, `${cloud}0d`], [1, `${deep}32`]], 0, 0, 0, height),
      0, 0, width, height);
  }
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(mixNoise(12167 + i * 15631) * width);
    const y = Math.floor(mixNoise(20227 + i * 48733) * height);
    fill(art, i % 3 ? `${light}1e` : `${deep}30`, x, y, i % 7 ? 1.2 : 2.1, i % 7 ? 1 : 1.5);
  }
  return canvas;
}

function advect(ctx, width, height, board, time, sprites, direction) {
  const lower = height - board.y - board.height;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  const draw = (index, x, y, width, height, opacity) => {
    ctx.globalAlpha = opacity;
    ctx.drawImage(sprites[index % sprites.length], x, y, width, height);
  };
  for (let i = 0; i < 7; i++) {
    const size = width * (.27 + i % 3 * .05);
    const x = mod(width * (i * .211 + .11) + time * direction * (3.25 + i % 2), width + size) - size;
    draw(i, x, height - lower * (1.58 + i % 3 * .13) + Math.sin(time * .13 + i) * 3, size, lower * 1.92, .37 + i % 3 * .08);
  }
  for (let i = 0; i < 5; i++) {
    const size = width * (.24 + i % 3 * .039);
    const x = mod(width * (i * .283 + .23) + time * direction * 7.1, width + size) - size;
    draw(i + 2, x, height - lower * (.97 + i % 2 * .21) + Math.sin(time * .22 + i) * 3, size, lower * 1.75, .56 + i % 2 * .12);
  }
  for (let i = 0; i < 3; i++) {
    const span = height + 160;
    const y = mod(i * height / 3 + time * (2.05 + i * .3), span) - 95;
    const size = 104 + i * 16;
    const swing = Math.sin(time * .18 + i) * 10;
    draw(i, board.x - size * .76 + swing, y, size, 72 + i * 8, .42 + i * .09);
    draw(i + 2, width - board.x - size * .27 - swing, height - y - 55, size, 69 + i * 7, .42 + i * .08);
  }
  ctx.restore();
}

function paintFoundation(ctx, rect, swatch) {
  const [, top, mid, , light, , deep] = swatch;
  const { x, y, width, height } = rect;
  const edge = y + height;
  mist(ctx, x + width * .51, edge + 6, width * .68, 35,
    [[0, `${top}e3`], [.6, `${top}a5`], [.83, `${mid}36`], [1, `${mid}00`]]);
  fill(ctx, gradient(ctx, [[0, `${top}da`], [.5, `${deep}59`], [1, `${deep}00`]], 0, edge, 0, edge + 25),
    x - 1, edge, width + 2, 25);
  const edgeLight = gradient(ctx, [[0, `${light}22`], [.34, `${light}95`], [1, `${deep}33`]], x, y, x + width, y);
  fill(ctx, edgeLight, x - 2, y - 1.75, width + 4, 2);
}

function paintWindowBand(ctx, width, swatch, image) {
  const height = 42;
  const canvas = layer(ctx, width, height);
  const art = canvas.getContext('2d');
  const [scene, top, mid, , light] = swatch;
  const { x, y, panelWidth, panelHeight } = panelSource(image, scene);
  const elevation = [.56, .64, .61, .20, .35, .37][scene];
  art.imageSmoothingQuality = 'high';
  art.drawImage(image, x + panelWidth * .026, y + panelHeight * (elevation - .09),
    panelWidth * .948, panelHeight * .18, 0, 0, width, height);
  fill(art, gradient(art, [[0, `${top}42`], [.45, `${mid}24`], [1, `${light}37`]], 0, 0, 0, height),
    0, 0, width, height);
  return canvas;
}

export function createAtmosphere() {
  let key;
  let backdrop;
  let foundation;
  let clouds;
  let windowBand;
  return {
    draw(ctx, { width, height, board, theme, time = 0, effects = true }) {
      loadSky();
      const next = `${Boolean(skyAtlas)}:${theme}:${width}:${height}:${board.x}:${board.y}:${board.width}:${board.height}`;
      const swatch = SKIES[theme] ?? SKIES.dawn;
      if (next !== key) {
        key = next;
        backdrop = layer(ctx, width, height);
        paintSky(backdrop.getContext('2d'), width, height, board, swatch, skyAtlas);
        clouds = SWELLS.map((_, index) => cloudBrush(ctx, swatch, index, skyAtlas));
        foundation = layer(ctx, width, height);
        paintFoundation(foundation.getContext('2d'), board, swatch);
        windowBand = skyAtlas ? paintWindowBand(ctx, board.width, swatch, skyAtlas) : null;
      }
      ctx.drawImage(backdrop, 0, 0);
      advect(ctx, width, height, board, effects ? time : 0, clouds, swatch.at(-1));
      ctx.drawImage(foundation, 0, 0);
    },
    drawWindowView(ctx, { x, y, width, height, position, span }) {
      if (!windowBand) return false;
      const sourceX = Math.max(0, position * windowBand.width);
      const sourceWidth = Math.min(windowBand.width - sourceX, span * windowBand.width);
      if (sourceWidth <= 0) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(windowBand, sourceX, 0, sourceWidth, windowBand.height, x, y, width, height);
      ctx.restore();
      return true;
    },
  };
}
