const ink = '#172335';

const themes = {
  dawn:     { floor: ['#263d42', '#2d4747', '#37544d'], mortar: '#202f39', leaf: ['#266b61', '#3f9377', '#74be87'], flower: '#ffc26c', sky: '#d98767', metal: '#6b8c9f' },
  moon:     { floor: ['#28334f', '#303d5a', '#3b4d6a'], mortar: '#202743', leaf: ['#345f7a', '#4d87a3', '#75bfc4'], flower: '#c7edff', sky: '#6b79ae', metal: '#88a9cb' },
  comet:    { floor: ['#33364d', '#403b56', '#4e465f'], mortar: '#292b44', leaf: ['#246a6d', '#418b88', '#7ad5a6'], flower: '#ffa7aa', sky: '#b97ca5', metal: '#a590b3' },
  dune:     { floor: ['#514351', '#5e4c53', '#775e55'], mortar: '#382f44', leaf: ['#54715f', '#728b64', '#b0b36c'], flower: '#ffe3a0', sky: '#d3a161', metal: '#c6a087' },
  meteor:   { floor: ['#463a4b', '#513e4c', '#745457'], mortar: '#342c3e', leaf: ['#6c4f72', '#9f6589', '#c4838d'], flower: '#ffad88', sky: '#e4887b', metal: '#cc9383' },
  frost:    { floor: ['#2a4660', '#345469', '#456377'], mortar: '#22364f', leaf: ['#327181', '#55a8af', '#9ce1d2'], flower: '#c6f7ff', sky: '#96cbd8', metal: '#99b4ce' },
  nebula:   { floor: ['#3f3155', '#493862', '#614670'], mortar: '#302640', leaf: ['#535181', '#6e66a4', '#a19fe0'], flower: '#ffb7df', sky: '#cb7ec4', metal: '#ac88b9' },
  eclipse:  { floor: ['#342e43', '#41364f', '#50455b'], mortar: '#292538', leaf: ['#62597c', '#9781a2', '#d79ece'], flower: '#ffe093', sky: '#d39a71', metal: '#a99aaf' },
  aurora:   { floor: ['#273c46', '#314b53', '#3e5961'], mortar: '#1d303c', leaf: ['#356974', '#428f8c', '#8bd8ac'], flower: '#a4ffe3', sky: '#67c2bb', metal: '#71aeb6' },
  midnight: { floor: ['#252948', '#2c3158', '#41456c'], mortar: '#1d223c', leaf: ['#515381', '#626fa5', '#9bafce'], flower: '#f7e5ab', sky: '#868dd4', metal: '#9697bd' },
  pollenworks: { floor: ['#51434e', '#62504f', '#806450'], mortar: '#382e43', leaf: ['#665755', '#9f8957', '#e1bd67'], flower: '#ffe391', sky: '#c8926c', metal: '#c59abd' },
  tidalglass:  { floor: ['#25505a', '#295a65', '#3c757a'], mortar: '#1e374e', leaf: ['#356b80', '#5894a2', '#87d8cb'], flower: '#f8b9ee', sky: '#8bd3cb', metal: '#afd7cd' },
  switchyard:  { floor: ['#45384f', '#524358', '#67516a'], mortar: '#30293f', leaf: ['#513d69', '#765177', '#bc7b92'], flower: '#ffcb80', sky: '#df8b74', metal: '#8394b7' },
  drawbridge:  { floor: ['#344469', '#435478', '#59688b'], mortar: '#25304d', leaf: ['#4d577e', '#776a9b', '#b79dca'], flower: '#f6e5c5', sky: '#8eabca', metal: '#b3bdd0' },
  saturn:      { floor: ['#29284c', '#353458', '#494767'], mortar: '#211f3c', leaf: ['#3e5d77', '#4d8590', '#83c6bd'], flower: '#f6ba96', sky: '#c98091', metal: '#6ab8b2' },
  solstice:    { floor: ['#43394a', '#554657', '#695769'], mortar: '#332e3c', leaf: ['#676349', '#8b9257', '#c0c66b'], flower: '#fff2ab', sky: '#eda877', metal: '#c5a7a4' },
};

// Dark trim, midtone, reflection, painted detail, and the water or night beneath each floor.
const environments = {
  dawn:        ['#172f39', '#4c7773', '#8caf89', '#e6a96e', '#24474d'],
  moon:        ['#232b47', '#627f9e', '#a6bed1', '#d4d4e6', '#273653'],
  comet:       ['#2b2844', '#726380', '#a285a6', '#eaacaa', '#323450'],
  dune:        ['#352b45', '#916c66', '#bf9a78', '#f2d096', '#385064'],
  meteor:      ['#35263e', '#9a646b', '#c78d81', '#ffd29a', '#3e364c'],
  frost:       ['#233b55', '#5b90a7', '#9ec2cd', '#e3f5e3', '#253b58'],
  nebula:      ['#352741', '#8566a1', '#bd91bf', '#f3bfe2', '#342c53'],
  eclipse:     ['#30253d', '#956574', '#bd8380', '#ffce9b', '#382c49'],
  aurora:      ['#223640', '#52878a', '#8ebcb2', '#a1eac9', '#223848'],
  midnight:    ['#201b3d', '#666c9d', '#909ac7', '#e7ddbe', '#242746'],
  pollenworks: ['#3b2e41', '#a27755', '#daa66c', '#f1bc9f', '#48354b'],
  tidalglass:  ['#1c394c', '#508f99', '#9acbc1', '#d2f3de', '#214459'],
  switchyard:  ['#322541', '#6c668c', '#a08ca6', '#f4b275', '#2d2847'],
  drawbridge:  ['#263451', '#687ca6', '#a6aac4', '#d9c7db', '#263557'],
  saturn:      ['#201938', '#4a7f8b', '#79b9b4', '#f0b39d', '#221b3c'],
};

const speciesColors = {
  sunflare:     { dark: '#ca5a48', mid: '#ef8956', light: '#ffc457', shine: '#fff097', heart: '#9f584d', spark: '#fff6c1' },
  moonbell:     { dark: '#5379b8', mid: '#82b5e7', light: '#b8e9f9', shine: '#effeff', heart: '#575ca4', spark: '#d8f9ff' },
  cometvine:    { dark: '#377d83', mid: '#56bca5', light: '#a2f4d7', shine: '#ffebbf', heart: '#d67888', spark: '#c8ffdf' },
  nebulalily:   { dark: '#7856ac', mid: '#b680e5', light: '#f1aeea', shine: '#ffe3f2', heart: '#604bb8', spark: '#e6c6ff' },
  eclipseorchid:{ dark: '#5247a7', mid: '#8c6de5', light: '#d7a8fb', shine: '#fff1b9', heart: '#482f68', spark: '#ffdc90' },
};

const bloomShapes = {
  sunflare: [
    '.....m.....', '....mlm....', '.mm.mlmm.m.', '.mllmmlmllm', '..lmslssl..', 'dmmlshslmmd',
    'mllshhhsllm', 'dmmlshslmmd', '..lssslsm..', '.mllmmlllm.', '..m.mlm.m..', '....mdm....',
  ],
  moonbell: [
    '....dd.....', '...dmmm....', '..dmllmd...', '.dmllsld...', '.dmllssmd..', 'dmllslsmmd.',
    'dmllslshlmd', '.dmlsshslmd', '..dmdsmddm.', '...d.s...d.',
  ],
  cometvine: [
    '..d...dd...', '..md.dlld..', '.dllmlsld..', 'dmllsslmd.d', '.mllshsdmdl', '..dlshslmdl',
    '...dllssld.', '..mllmldd..', '.dlmd.d....', 'dmdd.......',
  ],
  nebulalily: [
    '...m..m....', '..dsmdsl...', '..dlslmd...', 'dmmdlldmmmd', 'dlslllslld.', 'dllshhslld.',
    '.dslslsld..', '.mldshdlm..', '.dmdssdmd..', '...dssd....', '....dd.....',
  ],
  eclipseorchid: [
    '..d.....d..', '.dmmd.dmd..', '.mllmdlld..', '..dllsld...', '.dmllslmmd.', 'dmllhslmld.',
    '.dslslsld..', '..dsslsd...', '..dsdsd....', '...d.d.....',
  ],
};

const glyphs = {
  water:     ['....b....', '...bwb...', '..bwwbb..', '..bwwbb..', '.bwswwwb.', '.bwsswwb.', '.bwsswwb.', '..bbbbb..'],
  sun:       ['....l....', '.m..l..m.', '..mlllm..', '...lsll..', 'lllslslll', '...llll..', '..mlllm..', '.m..l..m.', '....l....'],
  moon:      ['...mll...', '..mll....', '.mll.....', '.mll.....', '.mll....l', '.mlll..ll', '..mlllll.', '...mmmm..'],
  prism:     ['....s....', '...sns...', '..snsps..', '.snpslps.', '..pslps..', '...lps...', '....s....'],
  repot:     ['..lllll..', '...lll...', '....l....', '.hhhhhhh.', '..hshsh..', '..hmmsmh.', '...hmmh..', '...hhhh..'],
  repotclay: ['....l....', '...lll...', '....l....', '.hhhhhhh.', '..hlhhh..', '..hlmmh..', '...hmm...', '...hhh...'],
  repotsilver:['....b....', '...bbb...', '....b....', '.mwwwwwm.', '..mwmwm..', '..mwmmw..', '...mwm...', '...mmm...'],
  repotglass:['....l....', '...lll...', '....l....', '..nnnnn..', '..nnsnn..', '..nwsnn..', '..nwwnn..', '..nnnnn..'],
  prune:     ['.m.....m.', '..ml.lm..', '...mlm...', '....s....', '..nn.nn..', '.n..n..n.', '.n..n..n.', '..nn.nn..'],
  sunstone:  ['....s....', '...lsl...', '..lsllh..', '.hllmllh.', '.hllllmh.', '..hllmh..', '...hhh...'],
  moonsoil:  ['....n....', '...nmn...', '..mwwnn..', '.mwwwnnm.', '.mwwnnmm.', '..nmmmm..', '...mmm...'],
  stardust:  ['....p....', '.s..p....', '...psp...', '..pswsp..', '.pswwwsp.', '..pswsp..', '...psp..s', '....p....'],
  remove:    ['...hhh...', '..hlllh..', '..hlslh..', '.hllslh..', '.hllslh..', '..hlllh..', '...hhh...', '...bnb...'],
  truck:     ['.bbbbbb..', '.bsssbb..', '.bsssblb.', '.bbbbblbb', '.bbbbbbbb', '..d.d.d..', '..ddd.d..'],
  seed:      ['......s..', '....ssm..', '...smm...', '...mmm...', '..hhlh...', '.hlllh...', '.hllh....', '..hh.....'],
  shelf:     ['.hhhhhhh.', '.h.....h.', '.hlllllh.', '.hhhhhhh.', '.h.....h.', '.hhhhhhh.', '.h.....h.'],
  compost:   ['..nnnnn..', '.nnnnnnn.', '..nmmmn..', '..nmsmn..', '..nmmmn..', '..nnnnn..'],
};

const iconColors = { b: '#458fca', w: '#a6e7ff', s: '#fff1c5', m: '#9f89cd', l: '#ffbf60', n: '#5cac9b', p: '#c775d4', h: '#b26150', d: '#344261' };

const gardenerColors = [
  ['#19696f', '#3ba096', '#81ccaa', '#f7b75a'],
  ['#744266', '#b76b92', '#ed99b2', '#a9c5ee'],
  ['#5e5b9a', '#8872bb', '#b3a3ed', '#fc8a78'],
  ['#8a5a3e', '#c7874f', '#edb56d', '#8ee2cd'],
];

const normalized = value => String(value ?? '').toLowerCase().replace(/[-_\s]/g, '');
const speciesAliases = { sunflower: 'sunflare', sunflaredaisy: 'sunflare', comet: 'cometvine', nebula: 'nebulalily', eclipse: 'eclipseorchid' };
const themeAliases = { nursery: 'dawn', terrace: 'moon', moonlit: 'moon', conservatory: 'comet', glacier: 'frost', winter: 'frost', greenhouse: 'dawn', solar: 'solstice' };
const needAliases = { shower: 'water', thermal: 'sun', bloom: 'remove', deliver: 'truck', pot: 'repot', trim: 'prune', ready: 'remove', pick: 'remove' };
const themeFor = variant => themes[variant] ?? themes[themeAliases[variant]] ?? themes.dawn;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function blocks(ctx, list) {
  for (const [color, x, y, w, h] of list) rect(ctx, color, x, y, w, h);
}

function paint(ctx, map, colors, x, y) {
  for (let row = 0; row < map.length; row++) {
    const line = map[row];
    for (let col = 0; col < line.length; col++) {
      const key = line[col];
      if (colors[key]) {
        let span = 1;
        while (line[col + span] === key) span++;
        rect(ctx, colors[key], x + col, y + row, span, 1);
        col += span - 1;
      }
    }
  }
}

function at(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale, scale);
}

function groundShadow(ctx, w = 17) {
  ctx.save();
  ctx.globalAlpha *= 0.34;
  blocks(ctx, [[ink, -w / 2, -2, w, 4], [ink, -w / 2 + 2, -3, w - 4, 6]]);
  ctx.restore();
}

function spark(ctx, x, y, color, size = 1) {
  rect(ctx, color, x - size, y, size * 3, size);
  rect(ctx, color, x, y - size, size, size * 3);
}

function icon(ctx, name, x, y) {
  const key = normalized(name);
  const map = glyphs[needAliases[key] ?? key] ?? glyphs.seed;
  paint(ctx, map, iconColors, x, y);
}

export function drawNeedIcon(ctx, need, x, y, size = 16) {
  at(ctx, x, y, size / 9);
  icon(ctx, need, -4, -4);
  ctx.restore();
}

export function drawNeedBubble(ctx, need, x, y, size, time, { urgent = false, progress, variant } = {}) {
  const bob = Math.floor(time * 3) % 3 === 1 ? 1 : 0;
  at(ctx, x, y - bob, size / 24);
  const edge = urgent ? '#d66c70' : '#405778';
  const paper = urgent ? (Math.floor(time * 5) % 2 ? '#fff3d8' : '#fae4da') : '#fff9df';
  blocks(ctx, [
    [ink, -8, -16, 16, 13], [ink, -10, -14, 20, 9], [ink, -3, -3, 6, 3],
    [edge, -8, -15, 16, 11], [edge, -9, -13, 18, 8], [paper, -7, -14, 14, 10],
    [paper, -8, -12, 16, 6], [paper, -2, -5, 4, 2], [edge, -1, -3, 2, 2],
  ]);
  const potNeed = `repot${normalized(variant)}`;
  icon(ctx, need === 'repot' && glyphs[potNeed] ? potNeed : need, -4, -13);
  if (Number.isFinite(progress)) {
    rect(ctx, ink, -7, -2, 14, 2);
    rect(ctx, urgent ? '#f6ab68' : '#7ee0bd', -6, -2, Math.round(Math.max(0, Math.min(1, progress)) * 12), 1);
  }
  ctx.restore();
}

function potSprite(ctx, pot, y) {
  const pottery = {
    starter: ['#674c50', '#93675b', '#b6856a', '#d5ac7d'],
    clay: ['#773d4c', '#a84f49', '#d26a50', '#ef9766'],
    silver: ['#455579', '#778ba8', '#a6bdd2', '#d6e7ef'],
    glass: ['#315e72', '#3b8f9d', '#79c6c9', '#c8f2dd'],
  };
  const key = normalized(pot);
  const [dark, middle, main, rim] = pottery[key === 'terracotta' ? 'clay' : key] ?? pottery.starter;
  const wide = key === 'starter' ? 5 : 6;
  blocks(ctx, [
    [ink, -wide - 1, y - 7, wide * 2 + 2, 4], [ink, -wide, y - 3, wide * 2, 4],
    [dark, -wide, y - 5, wide * 2, 3], [middle, -wide + 1, y - 4, wide * 2 - 2, 4],
    [main, -wide + 2, y - 4, wide - 1, 3], [rim, -wide + 2, y - 4, 1, 2],
    [rim, -wide, y - 6, wide * 2, 2], [dark, -wide + 1, y - 6, wide * 2 - 2, 1],
    ['#523849', -wide + 2, y - 6, wide * 2 - 4, 1], [main, wide - 3, y - 2, 2, 1],
  ]);
  if (key === 'silver') blocks(ctx, [[rim, 0, y - 4, 1, 3], [rim, 1, y - 2, 2, 1]]);
  if (key === 'glass') blocks(ctx, [[dark, 4, y - 9, 2, 9], [dark, -6, y - 9, 2, 9], [main, -5, y - 8, 1, 7], [rim, 4, y - 8, 1, 6], [rim, -4, y - 9, 8, 1], ['#53998d', -3, y - 2, 4, 1]]);
}

function flowerLeaves(ctx, height, time, tint = 'green') {
  const [dark, mid, light] = tint === 'blue' ? ['#275667', '#4197a0', '#93d5bd'] : ['#2b565c', '#43846a', '#8abe73'];
  blocks(ctx, [
    [dark, -1, -height - 1, 3, height - 5], [mid, 0, -height, 1, height - 5],
    [dark, -7, -12, 7, 2], [dark, -5, -10, 5, 2], [mid, -7, -12, 4, 1],
    [mid, -5, -11, 4, 1], [light, -6, -12, 2, 1], [dark, 1, -13, 6, 2],
    [mid, 2, -12, 4, 1], [mid, 3, -14, 4, 1], [light, 5, -14, 2, 1],
    [mid, -2, -9, 2, 2],
  ]);
  if (Math.floor(time * 3) % 4 === 1) rect(ctx, light, 7, -14, 1, 1);
}

export function drawPlant(ctx, species, phase, x, y, size, time, { pot = 'starter', quality, progress = 0 } = {}) {
  const namedSpecies = normalized(species);
  const key = speciesAliases[namedSpecies] ?? namedSpecies;
  const colors = speciesColors[key] ?? speciesColors.sunflare;
  const state = normalized(phase) || 'seed';
  const flowering = ['bloom', 'bloomed', 'complete', 'ready', 'ripe'].includes(state);
  const budding = flowering || state === 'bud' || state === 'flower';
  const sprouted = budding || state !== 'seed';
  const plantHeight = state === 'sprout' ? 13 : key === 'cometvine' ? 22 : 19;
  const sway = Math.round(Math.sin(time * 2.5 + x * 0.11) * (flowering ? 1 : 0.5));
  const leafTint = key === 'moonbell' || key === 'nebulalily' ? 'blue' : 'green';
  at(ctx, x, y, size / 24);
  groundShadow(ctx, 13);
  if (sprouted) flowerLeaves(ctx, plantHeight, time, leafTint);
  if (budding) {
    const top = -plantHeight - (flowering ? 7 : 4);
    if (flowering) {
      ctx.save();
      ctx.globalAlpha *= 0.12 + Math.sin(time * 2 + x) * 0.04;
      blocks(ctx, [[colors.spark, sway - 9, top + 1, 18, 9], [colors.spark, sway - 7, top - 1, 14, 13]]);
      ctx.restore();
      paint(ctx, bloomShapes[key] ?? bloomShapes.sunflare,
        { d: colors.dark, m: colors.mid, l: colors.light, s: colors.shine, h: colors.heart }, sway - 5, top);
      if (key === 'cometvine') blocks(ctx, [[colors.mid, -7, -17, 2, 2], [colors.shine, -6, -18, 2, 1], [colors.dark, 5, -9, 2, 2]]);
      if (key === 'moonbell') blocks(ctx, [[colors.shine, sway + 1, top + 9, 1, 2], [colors.light, sway + 4, top + 10, 1, 1]]);
      for (let i = 0; i < 4; i++) {
        const life = (time * (0.5 + i * 0.05) + i * 0.26 + x * 0.014) % 1;
        const px = Math.round(Math.cos(i * 2.5 + time * 1.25) * (7 + i % 2));
        const py = Math.round(top + 11 - life * 17);
        if (life < 0.74) {
          ctx.save();
          ctx.globalAlpha *= 1 - life;
          if (i % 2 === 0) spark(ctx, px, py, colors.spark);
          else rect(ctx, colors.spark, px, py, 1, 1);
          ctx.restore();
        }
      }
    } else {
      blocks(ctx, [[colors.dark, sway - 3, top + 1, 7, 5], [colors.mid, sway - 2, top, 5, 5], [colors.light, sway - 1, top + 1, 3, 3], ['#53896f', sway - 2, top + 5, 5, 2]]);
      if (progress > 0.5) rect(ctx, colors.shine, sway, top + 1, 2, 1);
    }
  }
  potSprite(ctx, pot, 0);
  if (quality === 'standard' || quality === 'rootbound' || quality === false) {
    blocks(ctx, [['#793f45', 4, -4, 1, 3], ['#c7895d', 5, -2, 2, 1]]);
  }
  ctx.restore();
}

export function drawGardener(ctx, x, y, size, time, { index = 0, moving = false, facing = 1, carrying = false } = {}) {
  const [dark, body, accent, strap] = gardenerColors[index % gardenerColors.length] ?? gardenerColors[0];
  const skins = [['#b47060', '#e2a075', '#ffd1a0'], ['#87504d', '#b7745d', '#e6a77b'], ['#6b474b', '#97584d', '#c17b5b'], ['#ad6961', '#dd9884', '#ffd2ae']];
  const [skinShadow, skin, skinLight] = skins[index % skins.length] ?? skins[0];
  const walk = moving ? Math.floor(time * 12) % 4 : 0;
  const bob = moving && walk % 2 === 1 ? -1 : 0;
  at(ctx, x, y, size / 24);
  groundShadow(ctx, 13);
  ctx.translate(0, bob);
  ctx.scale(facing < 0 ? -1 : 1, 1);
  blocks(ctx, [
    [ink, -5, -10, 10, 7], [ink, -6, -8, 4, 6], [dark, -4, -9, 8, 6],
    [body, -3, -9, 6, 5], [accent, -2, -8, 3, 1], [strap, 1, -9, 1, 5],
    [strap, -2, -6, 2, 2], [ink, -4, walk === 1 ? -3 : -2, 4, 3],
    [ink, 1, walk === 3 ? -3 : -2, 4, 3], [accent, -3, walk === 1 ? -3 : -2, 2, 1],
    [accent, 2, walk === 3 ? -3 : -2, 2, 1], [ink, -6, -17, 12, 8],
    [skinShadow, -4, -14, 9, 4], [skin, -4, -15, 9, 4], [skinLight, -2, -15, 7, 3],
    [ink, 1, -14, 1, 2], [ink, 4, -14, 1, 1], ['#d88676', 2, -12, 2, 1],
    [ink, -6, -19, 12, 4], [ink, -4, -21, 8, 2], [dark, -5, -19, 10, 3],
    [body, -3, -20, 6, 4], [accent, -2, -20, 4, 1], [strap, -4, -17, 8, 1],
    [ink, -7, -16, 14, 2], [body, -6, -16, 12, 1], [strap, -1, -18, 2, 2],
    [ink, 3, carrying ? -10 : -8, 5, 4], [accent, 4, carrying ? -10 : -8, 3, 2],
    [skin, 5, carrying ? -8 : -6, 2, 1],
  ]);
  if (walk === 2) rect(ctx, '#ffe2b2', 4, -13, 1, 1);
  ctx.restore();
}

function table(ctx, motif) {
  blocks(ctx, [
    [ink, -10, -13, 20, 13], ['#7d4b50', -9, -9, 18, 8], ['#533b50', -7, -6, 14, 5],
    ['#a56555', -9, -13, 18, 6], ['#d08d68', -8, -13, 16, 3], ['#f0b982', -8, -13, 16, 1],
    ['#8e5c56', -8, -8, 16, 1], ['#d08d68', -8, -6, 2, 5], ['#d08d68', 6, -6, 2, 5],
    [motif, -2, -7, 4, 2],
  ]);
}

function booth(ctx, kind, time, active, trim) {
  const tones = {
    sun: ['#804e53', '#a86c58', '#e5a263', '#ffd887', '#fff4c2', '#514054'],
    moon: ['#424969', '#58749b', '#88bbd9', '#bceaef', '#efffff', '#333f60'],
    prism: ['#604673', '#8964a0', '#c292cb', '#eeaee7', '#fff0e0', '#46385e'],
  };
  const [low, shade, edge, light, lamp, back] = tones[kind];
  blocks(ctx, [
    [ink, -10, -19, 20, 19], [ink, -8, -23, 16, 5], [low, -9, -19, 18, 19],
    [shade, -8, -21, 16, 5], [edge, -7, -22, 14, 3], [light, -6, -22, 12, 1],
    [back, -6, -16, 12, 13], [shade, -5, -15, 10, 8], [low, -5, -13, 10, 6],
    [edge, -8, -17, 2, 16], [edge, 6, -17, 2, 16], [light, -8, -16, 1, 13],
    [light, 7, -16, 1, 13], [light, -4, -19, 8, 2], [lamp, -3, -19, 6, 1],
    [trim, -9, -5, 18, 4], [edge, -8, -5, 16, 1], [low, -8, -3, 16, 2],
    [lamp, -7, -2, 1, 1], [lamp, 6, -2, 1, 1],
  ]);
  if (kind === 'sun') spark(ctx, 0, -21, '#fff4c2');
  if (kind === 'moon') blocks(ctx, [[lamp, -1, -22, 2, 3], [lamp, 0, -20, 3, 1], [edge, 1, -22, 1, 1]]);
  if (kind === 'prism') blocks(ctx, [['#9cebd0', -3, -21, 2, 2], [lamp, -1, -22, 2, 3], ['#e28eca', 1, -21, 2, 2]]);
  ctx.save();
  ctx.globalAlpha *= active ? 0.32 + Math.sin(time * 6) * 0.07 : 0.13;
  blocks(ctx, [[light, -3, -17, 6, 3], [light, -4, -14, 8, 5], [light, -5, -9, 10, 5]]);
  ctx.restore();
  if (active) {
    for (let i = 0; i < 4; i++) {
      const offset = Math.floor((time * 13 + i * 7) % 13);
      rect(ctx, i % 2 ? light : lamp, -4 + i * 2, -16 + offset, 1, 1);
    }
  }
}

function shower(ctx, time, active) {
  blocks(ctx, [
    [ink, -10, -6, 20, 6], ['#456978', -9, -6, 18, 5], ['#83bab3', -9, -6, 18, 2],
    ['#6ca6af', -7, -5, 14, 1], ['#2a4e69', -6, -4, 12, 2], [ink, -9, -21, 4, 17],
    [ink, 5, -21, 4, 17], ['#558195', -8, -20, 2, 15], ['#77b5b9', 6, -20, 2, 15],
    [ink, -8, -24, 16, 5], ['#5799aa', -7, -23, 14, 4], ['#99dcd0', -6, -23, 12, 1],
    ['#e0f6e1', -4, -22, 8, 1], ['#348aa4', -5, -20, 10, 2], ['#a5e5e8', -4, -19, 8, 1],
  ]);
  for (let i = 0; i < (active ? 7 : 2); i++) {
    const drop = Math.floor((time * (active ? 27 : 8) + i * 4) % 13);
    rect(ctx, i % 2 ? '#89e8eb' : '#d3ffff', -5 + i * 2, -18 + drop, 1, active ? 2 : 1);
  }
  if (active && Math.floor(time * 12) % 2) {
    spark(ctx, -5, -6, '#c7ffeb');
    spark(ctx, 5, -5, '#8fe4e0');
  }
}

function truck(ctx, time, active) {
  const bounce = active && Math.floor(time * 12) % 2 === 1 ? -1 : 0;
  ctx.translate(0, bounce);
  blocks(ctx, [
    [ink, -15, -15, 19, 12], [ink, 2, -13, 10, 10], [ink, 11, -8, 5, 5],
    ['#326e68', -14, -14, 17, 11], ['#4ca08d', -13, -13, 15, 8], ['#85c2a0', -13, -13, 15, 1],
    ['#276056', -12, -11, 13, 6], ['#d3ad6d', -12, -6, 14, 2], ['#f2c98b', -12, -6, 14, 1],
    ['#449080', 3, -12, 8, 9], ['#78bf9f', 4, -12, 6, 2], ['#4d8094', 5, -10, 6, 3],
    ['#aadbd7', 6, -10, 4, 1], ['#449080', 10, -7, 5, 4], ['#e4ce8b', 13, -6, 2, 2],
    ['#ef8b7e', -14, -6, 2, 1], [ink, -11, -5, 6, 6], [ink, 6, -5, 6, 6],
    ['#5b6173', -10, -4, 4, 4], ['#5b6173', 7, -4, 4, 4], ['#a7acaf', -9, -3, 2, 2],
    ['#a7acaf', 8, -3, 2, 2], ['#e2b86d', -13, -15, 16, 1],
    ['#e9cf92', -2, -10, 2, 2], ['#e9cf92', -4, -9, 6, 1], ['#e9cf92', -3, -8, 4, 1],
  ]);
  if (active) spark(ctx, 14, -7, '#fff4b7');
}

export function drawStation(ctx, kind, x, y, size, time, { active = false, variant, palette } = {}) {
  const key = normalized(kind);
  const theme = typeof palette === 'object' && palette ? { ...themes.dawn, ...palette } : themeFor(normalized(palette));
  at(ctx, x, y, size / 24);
  groundShadow(ctx, key === 'truck' ? 25 : 19);
  if (key === 'shower' || key === 'water') {
    shower(ctx, time, active);
  } else if (key === 'sun' || key === 'moon' || key === 'prism') {
    booth(ctx, key, time, active, theme.metal);
  } else if (key === 'truck' || key === 'delivery') {
    truck(ctx, time, active);
  } else {
    table(ctx, theme.metal);
    if (key === 'repot') {
      potSprite(ctx, variant ?? 'clay', -10);
      blocks(ctx, [['#e9b77c', 4, -14, 4, 2], ['#d69367', 5, -15, 2, 4], ['#4d404e', 5, -16, 1, 2]]);
    } else if (key === 'seed' || key === 'ingredient') {
      const seed = speciesColors[normalized(variant)] ?? speciesColors.sunflare;
      blocks(ctx, [[ink, -7, -18, 14, 8], ['#9f6663', -6, -17, 12, 6], ['#d89270', -5, -17, 10, 1], ['#6d484e', -5, -16, 10, 4], ['#e7ac75', -6, -12, 12, 2]]);
      if (key === 'ingredient') icon(ctx, variant, -4, -21);
      else blocks(ctx, [[seed.light, -4, -16, 3, 2], [seed.mid, 0, -16, 3, 2], [seed.shine, 3, -15, 2, 2], [seed.spark, -4, -15, 1, 1]]);
    } else if (key === 'prune') {
      icon(ctx, 'prune', -5, -18);
      blocks(ctx, [['#457e62', -7, -14, 2, 2], ['#7eae7b', 5, -14, 2, 1], ['#376658', 6, -13, 2, 1]]);
    } else if (key === 'shelf') {
      blocks(ctx, [['#694a57', -8, -13, 16, 3], ['#b78979', -7, -12, 14, 1], ['#ecb98b', -7, -13, 14, 1], [theme.metal, -5, -13, 1, 3], [theme.metal, 4, -13, 1, 3]]);
    } else if (key === 'compost') {
      icon(ctx, 'compost', -4, -17);
    }
    if (active) spark(ctx, 8, -13 - Math.floor(time * 5) % 4, '#fff0b9');
  }
  ctx.restore();
}

export function drawFloorTile(ctx, x, y, size, variant, time = 0) {
  const key = normalized(variant);
  const theme = themeFor(key);
  const n = Math.abs(Math.floor(x / size) * 47 + Math.floor(y / size) * 89);
  at(ctx, x, y, size / 24);
  blocks(ctx, [[theme.mortar, 0, 0, 24, 24], [theme.floor[n % 2], 0, 0, 23, 23], [theme.floor[1], 1, 1, 21, 1], [theme.floor[1], 1, 1, 1, 21]]);
  if (n % 6 === 0) {
    blocks(ctx, [[theme.floor[2], 3, 7, 4, 1], [theme.floor[2], 16, 18, 2, 1], [theme.mortar, 15, 19, 4, 1]]);
  } else if (n % 7 === 0) {
    rect(ctx, theme.floor[2], 9, 13, 2, 1);
  } else if (n % 13 === 0) {
    ctx.save();
    ctx.globalAlpha *= 0.15 + (1 + Math.sin(time + n)) * 0.1;
    spark(ctx, 14, 9, theme.sky);
    ctx.restore();
  }
  if (n % 4 === 0) floorMotif(ctx, key, theme, n, time);
  ctx.restore();
}

function floorMotif(ctx, key, theme, seed, time) {
  const seam = theme.mortar;
  const glint = theme.floor[2];
  const wash = theme.floor[1];
  const x = seed % 7 + 6;
  const y = seed % 5 + 7;
  const markings = {
    dawn: [[glint, x, y, 2, 1], [glint, x + 1, y - 1, 1, 3], [seam, x - 1, y + 2, 4, 1]],
    moon: [[glint, x, y - 2, 1, 4], [glint, x + 1, y + 1, 3, 1], [wash, x + 1, y - 2, 1, 2]],
    comet: [[seam, x - 1, y + 3, 5, 1], [glint, x + 1, y + 1, 5, 1], [glint, x + 5, y, 2, 3]],
    dune: [[glint, x - 2, y + 2, 8, 1], [glint, x + 3, y + 1, 6, 1], [seam, x - 3, y + 3, 8, 1]],
    meteor: [[seam, x - 3, y, 7, 4], [glint, x - 2, y - 1, 3, 2], [wash, x + 2, y - 1, 2, 1], [glint, x - 2, y + 4, 6, 1]],
    nebula: [[glint, x - 2, y + 2, 6, 1], [glint, x - 2, y, 1, 2], [wash, x, y - 1, 3, 1], [glint, x + 5, y - 3, 2, 2]],
    frost: [[glint, x - 2, y, 7, 1], [glint, x + 1, y - 3, 1, 7], [glint, x - 1, y - 2, 1, 1], [glint, x + 3, y + 2, 1, 1]],
    aurora: [[glint, x - 1, y + 2, 5, 1], [wash, x + 4, y + 1, 6, 2], [glint, x + 5, y, 4, 1]],
    eclipse: [[seam, x - 2, y - 2, 7, 1], [seam, x - 2, y, 7, 1], [seam, x - 2, y + 2, 7, 1], [glint, x + 6, y - 2, 1, 5]],
    midnight: [[seam, x - 1, y + 1, 6, 1], [glint, x - 2, y, 2, 2], [glint, x + 4, y - 2, 2, 3], [glint, x + 6, y - 3, 2, 1]],
    pollenworks: [[glint, x - 1, y, 5, 1], [glint, x - 2, y + 1, 2, 3], [seam, x + 3, y + 1, 2, 3], [seam, x - 1, y + 4, 5, 1]],
    tidalglass: [[glint, x - 3, y + 3, 8, 1], [glint, x + 5, y + 1, 2, 2], [seam, x + 3, y + 5, 7, 1]],
    switchyard: [[seam, x - 2, y - 2, 8, 6], [glint, x - 1, y - 1, 6, 1], [wash, x - 1, y + 1, 6, 1], [wash, x - 1, y + 3, 6, 1]],
    drawbridge: [[glint, x - 2, y - 2, 7, 1], [glint, x + 4, y - 1, 1, 4], [seam, x - 2, y + 3, 6, 1]],
    saturn: [[glint, x - 2, y, 4, 1], [glint, x + 1, y - 1, 1, 3], [seam, x + 5, y - 2, 5, 1]],
  };
  if (markings[key]) blocks(ctx, markings[key]);
  if ((key === 'aurora' || key === 'midnight') && Math.floor(time * 2 + seed) % 5 === 0) {
    ctx.globalAlpha *= 0.39;
    rect(ctx, theme.sky, x + 4, y - 1, 1, 1);
  }
}

const honeycomb = ['..mmmm..', '.m....m.', 'm......m', 'm......m', '.m....m.', '..mmmm..'];
const lilyPad = ['...mmmmm....', '..msllmm....', '.msllll..m..', 'mllllll.mm..', 'mllmlllllmm.', '.mlllllmmmm.', '..mmmmmmm...'];

function waterOrVoid(ctx, key, colors, seed, time) {
  const [dark, middle, light, accent, depth] = colors;
  blocks(ctx, [[depth, 0, 0, 24, 24], [dark, 0, 0, 24, 3], [dark, 0, 0, 2, 24], [middle, 2, 2, 22, 1]]);
  if (key === 'saturn') {
    for (let i = 0; i < 6; i++) {
      const x = (seed + i * 17) % 20 + 3;
      const y = (seed * 2 + i * 7) % 18 + 4;
      if (i === 0) spark(ctx, x, y, accent);
      else rect(ctx, i % 2 ? light : middle, x, y, 1, 1);
    }
    return;
  }
  if (key === 'switchyard') {
    blocks(ctx, [[dark, 4, 4, 16, 20], [middle, 4, 4, 2, 20], [middle, 18, 4, 2, 20], [depth, 6, 5, 12, 19]]);
    for (let y = 6; y < 24; y += 6) {
      blocks(ctx, [[middle, 7, y, 10, 2], [light, 8, y, 8, 1], [accent, (y + seed) % 2 ? 8 : 14, y, 2, 1]]);
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    const x = (seed + i * 11) % 11 + 3;
    const y = (seed + i * 7) % 16 + 5;
    rect(ctx, middle, x, y, i % 2 ? 7 : 5, 1);
    if (i % 2 === 0) rect(ctx, light, x + 1, y + 1, 2, 1);
  }
  if (key === 'tidalglass' && seed % 3 !== 2) {
    const x = 4 + seed % 6;
    const y = 8 + seed % 5 - Math.floor(time * 2) % 2;
    paint(ctx, lilyPad, { m: '#6f6092', l: '#9a83a9', s: '#c6b1d5' }, x, y);
    blocks(ctx, [['#ab769d', x + 4, y, 4, 2], [accent, x + 5, y, 2, 1]]);
  } else if (key === 'drawbridge' && seed % 2 === 0) {
    blocks(ctx, [[light, 12, 15, 4, 1], [middle, 11, 16, 6, 2], [middle, 17, 15, 2, 4], [accent, 12, 16, 1, 1]]);
  }
}

function terrainBlock(ctx, key, colors, seed) {
  const [dark, middle, light, accent] = colors;
  blocks(ctx, [[dark, 1, 1, 22, 22], [middle, 2, 2, 20, 5], [light, 3, 2, 18, 1], [middle, 3, 8, 18, 13], [dark, 4, 9, 16, 11], [middle, 5, 19, 14, 1]]);
  if (key === 'pollenworks') {
    paint(ctx, honeycomb, { m: middle }, 5, 10);
    paint(ctx, honeycomb, { m: light }, 11, 12);
  } else if (key === 'tidalglass') {
    blocks(ctx, [[light, 4, 9, 16, 10], [middle, 5, 10, 14, 8], [accent, 8, 10, 2, 5], [light, 13, 13, 4, 1]]);
  } else if (key === 'switchyard' || key === 'eclipse' || key === 'meteor') {
    blocks(ctx, [[middle, 5, 10, 14, 8], [dark, 6, 11, 12, 1], [dark, 6, 14, 12, 1], [dark, 6, 17, 12, 1], [accent, 3, 5, 2, 1], [accent, 19, 5, 2, 1]]);
  } else if (key === 'drawbridge' || key === 'dune') {
    blocks(ctx, [[middle, 5, 10, 7, 4], [middle, 13, 10, 6, 4], [light, 5, 10, 7, 1], [middle, 6, 15, 9, 4], [middle, 16, 15, 3, 4], [light, 6, 15, 9, 1]]);
  } else if (seed % 2) {
    spark(ctx, 12, 14, light);
  }
}

export function drawEnvironmentTile(ctx, x, y, size, terrain, variant, time = 0) {
  if (terrain !== '#' && terrain !== '~' && terrain !== '+' && terrain !== ':') return;
  const key = normalized(variant);
  const colors = environments[key] ?? environments.dawn;
  const seed = Math.abs(Math.floor(x / size) * 37 + Math.floor(y / size) * 57);
  at(ctx, x, y, size / 24);
  if (terrain === '~' || terrain === ':') {
    waterOrVoid(ctx, key, colors, seed, time);
  } else if (terrain === '#') {
    terrainBlock(ctx, key, colors, seed);
  } else {
    const [dark, middle, light, accent] = colors;
    blocks(ctx, [[dark, 0, 8, 24, 8], [middle, 0, 9, 24, 6], [light, 0, 9, 24, 1], [dark, 0, 14, 24, 1]]);
    for (let plank = 2; plank < 24; plank += 6) blocks(ctx, [[dark, plank, 10, 1, 4], [accent, plank + 2, 11, 2, 1]]);
  }
  ctx.restore();
}

export function drawBorderArt(ctx, width, height, tile, variant) {
  const key = normalized(variant);
  const [dark, middle, light, accent, depth] = environments[key] ?? environments.dawn;
  const unit = tile / 24;
  const across = width / unit;
  const down = height / unit;
  at(ctx, 0, 0, unit);
  blocks(ctx, [[dark, 0, 0, across, 5], [middle, 0, 1, across, 1], [dark, 0, 0, 2, down], [dark, across - 2, 0, 2, down], [dark, 0, down - 3, across, 3]]);
  for (let x = 5; x < across - 5; x += 24) {
    if (key === 'pollenworks') {
      paint(ctx, honeycomb, { m: light }, x, 1);
      paint(ctx, honeycomb, { m: middle }, x + 8, 3);
      rect(ctx, accent, x + 2, 3, 3, 1);
    } else if (key === 'tidalglass' || key === 'aurora') {
      blocks(ctx, [[middle, x, 2, 16, 4], [light, x + 1, 2, 14, 1], [depth, x + 2, 3, 12, 2], [light, x + 4, 3, 2, 1], [accent, x + 9, 4, 3, 1]]);
    } else if (key === 'saturn') {
      blocks(ctx, [[middle, x, 3, 18, 3], [dark, x + 2, 4, 14, 1], [light, x + 1, 5, 16, 1], [accent, x + 9, 3, 2, 1]]);
      if (x % 48 === 5) spark(ctx, x + 17, 8, accent);
    } else if (key === 'switchyard' || key === 'eclipse') {
      blocks(ctx, [[middle, x, 2, 16, 4], [depth, x + 2, 3, 12, 2], [accent, x + 2, 3, 3, 1], [accent, x + 7, 4, 3, 1], [accent, x + 12, 3, 3, 1]]);
    } else if (key === 'drawbridge' || key === 'dune') {
      blocks(ctx, [[middle, x, 2, 8, 4], [middle, x + 10, 2, 10, 4], [light, x + 1, 2, 6, 1], [light, x + 11, 2, 8, 1], [accent, x + 8, 4, 2, 3]]);
    } else {
      blocks(ctx, [[middle, x, 2, 14, 4], [light, x + 1, 2, 12, 1], [depth, x + 2, 3, 10, 2], [accent, x + 6, 4, 3, 1], [middle, x + 18, 3, 2, 2]]);
    }
  }
  for (let y = 7; y < down - 5; y += 24) blocks(ctx, [[middle, 1, y, 3, 5], [light, 2, y + 1, 1, 2], [middle, across - 4, y, 3, 5], [light, across - 3, y + 1, 1, 2]]);
  ctx.restore();
}

function vine(ctx, theme, time, seed) {
  const [dark, middle, leaf] = theme.leaf;
  const sway = Math.round(Math.sin(time * 1.9 + seed));
  const height = 17 + seed % 4;
  blocks(ctx, [[dark, -2, -height, 4, height - 3], [middle, 0, -height, 1, height - 3], [dark, -6, -5, 12, 3], [middle, -5, -6, 10, 3]]);
  for (let i = 0; i < 4; i++) {
    const px = (i + seed) % 2 ? 1 : -5;
    const py = -7 - i * 3;
    blocks(ctx, [[dark, px + sway, py, 5, 3], [middle, px + sway, py - 1, 4, 2], [leaf, px + sway + 1, py - 1, 2, 1]]);
  }
  spark(ctx, sway, -height, theme.flower);
}

function lantern(ctx, theme, time, seed) {
  blocks(ctx, [[ink, -5, -19, 10, 14], [theme.metal, -3, -20, 6, 2], [theme.metal, -4, -18, 8, 12], [theme.floor[0], -3, -17, 6, 10], [ink, -2, -5, 4, 5]]);
  ctx.save();
  ctx.globalAlpha *= 0.67 + Math.sin(time * 3 + seed) * 0.16;
  blocks(ctx, [[theme.sky, -3, -17, 6, 10], [theme.flower, -2, -15, 4, 7], ['#fff2c4', -1, -14, 2, 4]]);
  ctx.restore();
  spark(ctx, 5, -20 + (seed % 3), theme.flower);
}

function crystal(ctx, theme, time, seed) {
  const height = 13 + seed % 5;
  blocks(ctx, [[ink, -7, -4, 14, 4], [theme.floor[2], -6, -5, 12, 4], [theme.metal, -3, -height + 2, 7, height - 3], [theme.sky, -2, -height, 4, height - 2], [theme.flower, -1, -height + 1, 2, height - 4], [theme.metal, -6, -8, 4, 6], [theme.leaf[2], -5, -9, 2, 4], [theme.sky, 4, -7, 3, 5]]);
  if (Math.floor(time * 3 + seed) % 4 === 0) spark(ctx, 4, -height + 1, '#f9ffff');
}

function scope(ctx, theme, time) {
  blocks(ctx, [
    [ink, -6, -2, 12, 2], [theme.metal, -4, -4, 8, 2], [ink, -3, -14, 6, 10],
    [theme.floor[2], -2, -12, 4, 8], [ink, -7, -17, 13, 5], [theme.metal, -6, -16, 11, 3],
    [ink, 3, -20, 8, 5], [theme.sky, 4, -19, 6, 3], [theme.flower, 9, -19, 1, 3],
    [theme.flower, -5, -16, 7, 1], [theme.floor[0], -7, -16, 2, 4],
  ]);
  if (Math.floor(time * 4) % 5 < 2) spark(ctx, 11, -19, theme.flower);
}

function steamVent(ctx, theme, time, seed, heated) {
  blocks(ctx, [
    [ink, -9, -8, 18, 8], [theme.metal, -8, -7, 16, 6], [theme.mortar, -7, -6, 14, 4],
    [theme.floor[2], -6, -5, 11, 1], [theme.floor[2], -5, -3, 10, 1], [theme.sky, 6, -6, 1, 1],
  ]);
  for (let i = 0; i < 4; i++) {
    const rise = (time * (heated ? 0.85 : 0.5) + i * 0.25 + seed * 0.19) % 1;
    const x = Math.round(Math.cos(i * 3 + rise * 3) * (3 + rise * 4));
    const y = -7 - Math.floor(rise * 14);
    ctx.save();
    ctx.globalAlpha *= (1 - rise) * 0.8;
    if (heated) spark(ctx, x, y, i % 2 ? theme.flower : theme.sky);
    else blocks(ctx, [[theme.sky, x - 2, y - 1, 5, 3], [theme.flower, x - 1, y - 2, 3, 1], [theme.floor[2], x, y, 2, 2]]);
    ctx.restore();
  }
}

function snowTree(ctx, theme, time, seed) {
  const [dark, mid, pale] = theme.leaf;
  blocks(ctx, [[ink, -2, -11, 4, 11], [theme.metal, -1, -7, 2, 5]]);
  for (let i = 0; i < 3; i++) {
    const w = 4 + i * 2;
    const y = -22 + i * 5;
    blocks(ctx, [[dark, -w + 1, y, w * 2 - 2, 2], [dark, -w, y + 2, w * 2, 3], [mid, -w + 1, y + 1, w * 2 - 2, 2], [pale, -w + 2, y, w * 2 - 5, 1], ['#c8ecdf', -w + 3, y - 1, w, 1]]);
  }
  const fall = Math.floor((time * 8 + seed * 3) % 23);
  spark(ctx, fall % 2 ? -8 : 8, -24 + fall, theme.flower);
}

function cometPennants(ctx, theme, time) {
  blocks(ctx, [[ink, -7, -19, 3, 19], [ink, 5, -19, 3, 19], [theme.metal, -6, -19, 1, 18], [theme.metal, 6, -19, 1, 18], [theme.leaf[2], -5, -17, 11, 1]]);
  const swing = Math.floor(time * 5) % 2;
  for (const [i, color] of [theme.flower, theme.leaf[2], theme.sky].entries()) {
    const x = -5 + i * 4;
    blocks(ctx, [[color, x, -16, 3, 2 + (i + swing) % 2], [color, x + 1, -13, 1, 1]]);
  }
}

function hiveAwning(ctx, time, seed) {
  const shade = '#654358';
  const wood = '#b47959';
  const pollen = '#ffdd90';
  blocks(ctx, [
    [ink, -9, -19, 18, 19], [wood, -8, -17, 16, 15], ['#d39b6a', -7, -17, 14, 11],
    [shade, -7, -6, 14, 5], [ink, -8, -22, 16, 6], ['#9f74a0', -7, -23, 14, 5],
    ['#d4a4bf', -6, -23, 12, 1], ['#f1bfcb', -5, -20, 3, 3], ['#f1bfcb', 2, -20, 3, 3],
    [shade, -3, -10, 6, 3], ['#784c50', -2, -11, 4, 3], [pollen, -4, -13, 8, 1],
    [pollen, -3, -7, 6, 1], [wood, -6, -4, 2, 3], [wood, 4, -4, 2, 3],
  ]);
  const orbit = time * 3.5 + seed;
  const beeX = Math.round(Math.sin(orbit) * 10);
  const beeY = -10 + Math.round(Math.cos(orbit) * 5);
  const wing = Math.floor(time * 18) % 2;
  blocks(ctx, [[ink, beeX - 1, beeY, 5, 2], [pollen, beeX, beeY, 1, 2], [pollen, beeX + 2, beeY, 1, 2], ['#fff1cf', beeX + wing, beeY - 2, 2, 1]]);
}

function tidePlanter(ctx, time, seed) {
  const bob = Math.floor(time * 2 + seed) % 2;
  blocks(ctx, [[ink, -10, -8, 20, 8], ['#57909a', -9, -7, 18, 6], ['#9cd0be', -8, -7, 16, 1], ['#41687c', -8, -6, 16, 3], ['#7fb8b4', -7, -3, 14, 1]]);
  paint(ctx, lilyPad, { m: '#756693', l: '#a18ab7', s: '#cdbbe1' }, -7, -12 - bob);
  blocks(ctx, [['#6e647e', -2, -15 - bob, 5, 4], ['#cb7fa6', -1, -16 - bob, 3, 4], ['#ffd7d6', 0, -17 - bob, 1, 2]]);
  for (let i = 0; i < 3; i++) {
    const y = -11 - Math.floor((time * 4 + i * 4 + seed) % 12);
    const x = 4 + (i * 3 + seed) % 5;
    blocks(ctx, [['#65a1ae', x, y, 2, 2], ['#b1d8cb', x, y, 1, 1]]);
  }
}

function switchBeacon(ctx, time, seed) {
  const amber = Math.floor(time * 3 + seed) % 4 < 2;
  blocks(ctx, [
    [ink, -8, -4, 16, 4], ['#727697', -7, -4, 14, 2], [ink, -3, -15, 6, 12],
    ['#9e849c', -1, -15, 2, 10], [ink, -6, -21, 12, 9], ['#625878', -5, -20, 10, 7],
    ['#967f98', -5, -21, 10, 1], ['#372d4a', -4, -19, 8, 3], ['#372d4a', -4, -15, 8, 2],
    [amber ? '#ffcf81' : '#8b5a62', -3, -19, 6, 2], [amber ? '#51788a' : '#a7e0c5', -3, -15, 6, 2],
    ['#ea9c71', -7, -6, 3, 1], ['#a893a5', 4, -6, 3, 1],
  ]);
  if (amber) spark(ctx, 8, -20, '#f3a275');
}

function moonLock(ctx, time, seed) {
  const shutter = Math.floor(time * 2 + seed) % 3;
  blocks(ctx, [
    [ink, -8, -5, 16, 5], ['#7383a5', -7, -5, 14, 3], [ink, -6, -17, 12, 12],
    ['#8393b7', -5, -17, 10, 10], ['#a7b6d1', -5, -18, 10, 2], ['#ac9cbe', -4, -6, 8, 1],
    ['#45577f', -4, -15, 8, 7], ['#bcaad1', -3, -14, 6, 5], ['#645b94', -1, -15, 2, 5],
    ['#f1e0ce', -2, -13, 1, 3], ['#f1e0ce', -1, -11, 3, 1], ['#8e92b0', -2, -20, 4, 2],
  ]);
  if (shutter !== 1) spark(ctx, 7, -16, '#c4d7de');
}

const ringedPlanet = [
  '.......ss......', '.....sllm......', '...sslllmm.....', '..sllmmmmd.s...', '.mllmmmdd.slm..',
  'mllmmmdd.slm...', 'lllmmmd.slm....', 'mmmmdd.slm.....', '...dd.slm......', '....slm........',
];

function saturnSpire(ctx, time, seed) {
  blocks(ctx, [
    [ink, -8, -4, 16, 4], ['#538393', -7, -3, 14, 2], [ink, -3, -13, 6, 11],
    ['#78afa9', -2, -13, 4, 9], ['#37677f', 0, -11, 1, 6], ['#ba8ca8', -4, -12, 8, 2],
  ]);
  const bob = Math.floor(time * 2.5 + seed) % 2;
  paint(ctx, ringedPlanet, { s: '#ffe1bc', l: '#f3aa92', m: '#d07f96', d: '#8d5982' }, -7, -23 - bob);
  if (Math.floor(time * 4 + seed) % 6 < 2) spark(ctx, 9, -22, '#d3f6db');
}

export function drawScenery(ctx, x, y, size, variant, time, seed = 0) {
  const key = normalized(variant);
  const theme = themeFor(key);
  const choose = Math.abs(Math.floor(seed));
  at(ctx, x, y, size / 24);
  groundShadow(ctx, 15);
  if (key === 'pollenworks') hiveAwning(ctx, time, choose);
  else if (key === 'tidalglass') tidePlanter(ctx, time, choose);
  else if (key === 'switchyard') switchBeacon(ctx, time, choose);
  else if (key === 'drawbridge') moonLock(ctx, time, choose);
  else if (key === 'saturn') saturnSpire(ctx, time, choose);
  else if (key === 'dune' || (key === 'midnight' && choose % 2)) scope(ctx, theme, time);
  else if (key === 'comet' && choose % 2) cometPennants(ctx, theme, time);
  else if (key === 'nebula' || key === 'eclipse' || (key === 'meteor' && choose % 2)) steamVent(ctx, theme, time, choose, key !== 'nebula');
  else if (key === 'frost' && choose % 2) snowTree(ctx, theme, time, choose);
  else if (choose % 3 === 1 || key === 'moon') lantern(ctx, theme, time, choose);
  else if (['frost', 'meteor', 'aurora', 'midnight'].includes(key) || choose % 3 === 2) crystal(ctx, theme, time, choose);
  else vine(ctx, theme, time, choose);
  ctx.restore();
}
