const SKIES = {
  dawn:        ['#1d193c', '#483453', '#ba6a69', '#fac092', '#a280ba', '#523d70'],
  moon:        ['#111833', '#253451', '#476889', '#afdce9', '#779ec5', '#3b4c78'],
  comet:       ['#1b1639', '#372956', '#805987', '#ffd3dd', '#b493d4', '#61477c'],
  dune:        ['#33203c', '#634054', '#b56a59', '#ffd39e', '#cf947e', '#805875'],
  meteor:      ['#28182f', '#583047', '#a35465', '#ffc596', '#be7a91', '#774763'],
  nebula:      ['#211632', '#493152', '#a25992', '#ffd3ee', '#c78bbd', '#754575'],
  frost:       ['#13203a', '#2a4967', '#5c8dac', '#d4f0f6', '#8cbfd8', '#526b97'],
  aurora:      ['#121f32', '#244653', '#4c7c80', '#bcf3dd', '#79c3bc', '#436f8a'],
  eclipse:     ['#241732', '#4e304c', '#895586', '#f1c2ee', '#b77bc4', '#694776'],
  midnight:    ['#111631', '#292a55', '#6060a2', '#cfceff', '#8f95d5', '#414b84'],
  pollenworks: ['#2d2239', '#613d56', '#b27566', '#ffe1a8', '#ce9b8b', '#77587a'],
  tidalglass:  ['#13283b', '#25546a', '#439090', '#c0f4df', '#76b9ce', '#405f8c'],
  switchyard:  ['#2d1d39', '#634157', '#b96361', '#ffd09f', '#c990a0', '#774f76'],
  drawbridge:  ['#131835', '#323758', '#646595', '#d3dbff', '#949fdd', '#4c5889'],
  saturn:      ['#211930', '#423050', '#956562', '#ffe2ae', '#c49ba5', '#755b85'],
};

const BANKS = [
  {
    top:    [16,14,13,13,10,9,8,8,9,8,6,5,4,4,5,2,1,1,2,3,4,5,7,7,6,6,7,9,10,11,11,12,14,14,16,17],
    bottom: [17,19,19,20,21,22,22,22,23,23,25,25,25,25,25,25,26,26,26,26,25,25,24,24,24,23,23,22,22,22,21,21,20,19,19,18],
  },
  {
    top:    [14,13,12,10,10,9,10,9,7,6,6,7,8,7,7,6,6,4,4,3,3,4,4,7,8,8,9,9,10,11,12,12,15,15,16,17],
    bottom: [15,16,18,18,18,19,19,21,21,21,22,22,22,23,23,24,24,24,24,24,24,25,25,25,24,24,23,23,22,21,21,20,20,19,19,18],
  },
  {
    top:    [17,16,14,13,13,14,12,10,9,9,8,8,9,11,11,9,8,7,7,5,5,4,5,5,6,8,8,9,9,8,9,10,12,13,15,16],
    bottom: [18,18,19,19,20,21,22,22,22,22,22,23,23,23,24,24,24,25,25,25,25,26,26,26,26,24,24,24,23,23,22,22,21,20,20,18],
  },
];

const mod = (value, size) => (value % size + size) % size;
const box = (ctx, color, x, y, width, height) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
};

function newLayer(ctx, width, height) {
  const doc = ctx.canvas.ownerDocument;
  const canvas = doc ? doc.createElement('canvas') : new OffscreenCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function veil(ctx, { width, height, board }, colors) {
  const [zenith, sky, horizon, glow] = colors;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, zenith);
  gradient.addColorStop(.53, sky);
  gradient.addColorStop(1, horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glowX = Math.round(board.x + board.width * .17);
  const glowY = Math.round(board.y + board.height * .62);
  const halo = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, height * .68);
  halo.addColorStop(0, `${glow}7a`);
  halo.addColorStop(.44, `${glow}32`);
  halo.addColorStop(1, `${glow}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
}

function skyline(ctx, { width, height, board }, colors) {
  const [, sky, , light, , shade] = colors;
  const base = board.y + board.height;
  const deckGap = Math.max(8, height - base);
  const horizon = base + deckGap * .62;
  ctx.save();
  ctx.globalAlpha *= .33;
  for (let i = 0; i < 28; i++) {
    const x = Math.round(width * i / 27);
    const crest = horizon - mod(i * 19 + i * i * 5, 18) - 4;
    const span = Math.max(6, Math.ceil(width / 27));
    box(ctx, shade, x, crest, span, height - crest);
    box(ctx, light, x, crest, span - 2, 1);
  }
  ctx.globalAlpha *= .55;
  for (let i = 0; i < 12; i++) {
    const x = Math.round(width * (i + .22) / 12);
    const towerHeight = 4 + mod(i * 7, 13);
    box(ctx, sky, x, horizon + 4 - towerHeight, 7 + i % 3 * 4, towerHeight + 3);
    box(ctx, light, x + 2, horizon + 8 - towerHeight, 2, 1);
  }
  ctx.restore();
}

function stars(ctx, { width, height, board }, colors) {
  const [, , , light, cloud] = colors;
  ctx.save();
  for (let i = 0; i < 94; i++) {
    const x = mod(i * 89 + i * i * 7 + 12, width);
    const y = mod(i * 53 + i * i * 9 + 6, height);
    if (x >= board.x && x < board.x + board.width && y >= board.y && y < board.y + board.height) continue;
    const bright = i % 8 === 0;
    ctx.globalAlpha = bright ? .68 : .28 + (i % 3) * .1;
    box(ctx, bright ? light : cloud, x, y, bright ? 2 : 1, bright ? 2 : 1);
    if (bright) {
      box(ctx, cloud, x - 2, y, 6, 1);
      box(ctx, cloud, x, y - 2, 1, 6);
    }
  }
  ctx.restore();
}

function foundation(ctx, board, colors) {
  const [ink, , , light, , shade] = colors;
  const end = board.y + board.height;
  const depth = Math.max(10, Math.round(board.height * .06));
  const gradient = ctx.createLinearGradient(0, end - 2, 0, end + depth);
  gradient.addColorStop(0, `${ink}e8`);
  gradient.addColorStop(.35, `${ink}a3`);
  gradient.addColorStop(1, `${ink}00`);
  for (let i = 0; i < 4; i++) {
    const inset = i * 6;
    const y = end - 1 + i * (depth / 5);
    box(ctx, gradient, board.x + inset - 2, y, board.width - 2 * inset + 4, depth / 2);
  }
  ctx.save();
  ctx.globalAlpha *= .55;
  box(ctx, shade, board.x - 3, board.y + 7, 3, board.height - 7);
  box(ctx, ink, board.x + board.width, board.y + 7, 3, board.height - 7);
  box(ctx, light, board.x - 2, board.y - 2, board.width + 4, 2);
  ctx.restore();
}

function paintBank(ctx, profile, colors) {
  const [ink, , , light, fill, shade] = colors;
  const canvas = newLayer(ctx, profile.top.length, 27);
  const art = canvas.getContext('2d');
  for (const [x, top] of profile.top.entries()) {
    const bottom = profile.bottom[x];
    const edge = x < 2 || x > profile.top.length - 4;
    box(art, shade, x, top, 1, bottom - top + 1);
    box(art, fill, x, top + 1, 1, Math.max(1, bottom - top - (edge ? 1 : 4)));
    art.globalAlpha = edge ? .6 : .85;
    box(art, light, x, top, 1, Math.min(3 + x % 3, bottom - top));
    art.globalAlpha = .3;
    if (x > 4 && x < profile.top.length - 4 && bottom - top > 7) {
      box(art, light, x, top + 7 + Math.floor(x / 8) % 2, 1, 1);
      box(art, ink, x, bottom - 2, 1, 1);
    }
    art.globalAlpha = 1;
  }
  return canvas;
}

function cloudBanks(ctx, layout, sprites) {
  const { width, height, board, time } = layout;
  const bottomGap = Math.max(12, height - (board.y + board.height));
  const side = Math.max(12, board.x);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  function cloud(index, x, y, w, h, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites[index % sprites.length], Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // A slow lower layer moves behind the greenhouse’s footprint.
  for (let i = 0; i < 8; i++) {
    const size = width * (.2 + i % 3 * .032);
    const x = mod(width * (i * .164 + .03) - time * (3.2 + i % 2 * .55), width + size) - size;
    cloud(i, x, height - bottomGap * (1.25 + i % 3 * .16), size, bottomGap * 1.46, .32 + i % 3 * .055);
  }

  // Tall cropped banks frame both shores without competing with planting tiles.
  for (let i = 0; i < 3; i++) {
    const drift = mod(time * (3.8 + i * .35) + 27 + i * 61, height + 45) - 34;
    const size = side * (2.4 + i % 2 * .63);
    cloud(i + 1, -size + side * (1.02 + i % 2 * .24), drift, size, side * 2.04, .35 + i * .085);
    cloud(i, width - side * (1.08 + i % 2 * .31), height - drift - side * 1.7, size, side * 2.14, .38 + i * .09);
  }

  // Near banks shift a little faster, most visibly against the lower skyline.
  for (let i = 0; i < 4; i++) {
    const size = width * (.21 + i % 2 * .035);
    const x = mod(width * (i * .267 + .13) - time * 8.2, width + size) - size;
    cloud(i + 2, x, height - bottomGap * (.98 + i % 2 * .3) + Math.sin(time * .5 + i) * 2,
      size, bottomGap * 1.58, .62 + i % 2 * .11);
  }
  ctx.restore();
}

export function createAtmosphere() {
  let key;
  let backdrop;
  let sprites;
  return {
    draw(ctx, { width, height, board, theme, time = 0, effects = true }) {
      const next = `${theme}:${width}:${height}:${board.x}:${board.y}:${board.width}:${board.height}`;
      const colors = SKIES[theme] ?? SKIES.dawn;
      if (key !== next) {
        key = next;
        backdrop = newLayer(ctx, width, height);
        const sky = backdrop.getContext('2d');
        const layout = { width, height, board };
        veil(sky, layout, colors);
        stars(sky, layout, colors);
        skyline(sky, layout, colors);
        sprites = BANKS.map(profile => paintBank(sky, profile, colors));
      }
      ctx.drawImage(backdrop, 0, 0);
      cloudBanks(ctx, { width, height, board, time: effects ? time : 0 }, sprites);
      foundation(ctx, board, colors);
    },
  };
}
