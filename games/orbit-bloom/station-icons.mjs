const iconInk = '#241f34';

const art = {
  seed: {
    colors: { o: iconInk, e: '#845347', h: '#f6e4b5', p: '#d79a65', l: '#fff4d1', c: '#f49283', g: '#4e7e59' },
    rows: [
      '..oooooooo..', '..olhlhloo..', '..ohhhheeo..', '..ohlllepo..', '..ohlclepo..', '..ohcccepo..',
      '..ohgclepo..', '..ohgglepo..', '..ohhhhppo..', '..oeppeppo..', '..oooooooo..', '............',
    ],
  },
  clay: {
    colors: { o: iconInk, m: '#623c48', r: '#eea275', a: '#d77957', h: '#ffcc92', l: '#9b4e43' },
    rows: [
      '............', '..oooooooo..', '.ohrrrrrrao.', 'orommmlmraoo', 'ohmmmmmmraoo', '.orrrrrrrao.',
      '..orhaaaro..', '..orharlro..', '...ohrlro...', '...oaaalo...', '....oooo....', '............',
    ],
  },
  silver: {
    colors: { o: iconInk, m: '#465471', r: '#b8d1df', a: '#8297b7', h: '#e6f3f6', l: '#596e94' },
    rows: [
      '............', '..oooooooo..', '.ohrrrrrrao.', 'orommmmmraoo', 'ohrmmmmmraoo', '.orrrrrrrao.',
      '..ohhraaro..', '..orharlro..', '...ohrrro...', '...oaaalo...', '....oooo....', '............',
    ],
  },
  glass: {
    colors: { o: iconInk, m: '#234c62', r: '#64b4b5', a: '#3e8594', h: '#dbffed', l: '#9cdbcb' },
    rows: [
      '............', '...oooooo...', '..ohlrrrlo..', '..orrmmrao..', '..olrrrrro..', '..ohlmllro..',
      '..ohlaalro..', '..orhaalro..', '..orrarrro..', '..orllllro..', '...oooooo...', '............',
    ],
  },
  sunstone: {
    colors: { o: '#503442', e: '#b16153', a: '#f59e58', y: '#ffc967', l: '#fff4af', w: '#fffbd3' },
    rows: [
      '.........w..', '....oo..www.', '...oylo..w..', '..oyyloo....', '.oaylyyo....', 'oaylyyyao...',
      'oaylywayao..', '.oayyyayao..', '.oaeayaoo...', '..oaeaoo....', '...ooo......', '............',
    ],
  },
  moonsoil: {
    colors: { o: iconInk, m: '#625781', a: '#9689af', h: '#d0bcda', b: '#465576', s: '#a6d2e1' },
    rows: [
      '....oooo....', '...ohahho...', '...oamamo...', '....oooo....', '...ohamoo...', '..ohaahbao..',
      '.ohaaabasmo.', '.ohaambssmo.', '.ohaaabssmo.', '.oamhammmao.', '..oooooooo..', '............',
    ],
  },
  stardust: {
    colors: { o: iconInk, h: '#fff1e8', c: '#e3c7ef', m: '#a986c5', p: '#80569e', b: '#b5e1ed', t: '#af755f' },
    rows: [
      '....oooo..h.', '....otto.hhh', '....ocoo..h.', '...ohcmo....', '..ohhcmpo...', '..ohcmhpo...',
      '..ohmhhpo...', '..ocbhhpo...', '..ocmmpoo...', '...ooooo....', '............', '............',
    ],
  },
  shower: {
    colors: { o: iconInk, b: '#396d89', w: '#b8ecf4', s: '#77c5db', h: '#f1fff3' },
    rows: [
      '..oooo......', '.obwsoo.....', 'obwso.oooo..', 'obs..obwso..', 'obs..owwsso.', 'obs..oooooo.',
      'obs...s.s.s.', 'obs..w.s.w..', 'obs..w.s.w..', 'obs.s.w.s...', 'ooo.s.w.s...', '............',
    ],
  },
  water: {
    colors: { o: '#28465e', b: '#407ba5', s: '#69c7de', w: '#b8f6f2', h: '#f2ffff' },
    rows: [
      '.....oo.....', '.....oo.....', '....osbo....', '....osbo....', '...owssbo...', '..owswssbo..',
      '..owhwssbo..', '.obwhwsssbo.', '.obwwsssbbo.', '..obsssboo..', '...oooooo...', '............',
    ],
  },
  prune: {
    colors: { o: iconInk, s: '#c8d9dc', b: '#789bad', h: '#f1ffed', r: '#c57978', t: '#ebaa86' },
    rows: [
      '.oo......oo.', '.ohbo..obho.', '..ohbobbho..', '...ohbbho...', '....ohbo....', '...obosoo...',
      '..otroorto..', '.otro..orto.', '.oto....oto.', '.otro..orto.', '..ooo..ooo..', '............',
    ],
  },
  sun: {
    colors: { o: '#683f4c', a: '#ef9a52', c: '#ffcc65', h: '#fff0aa', y: '#f7b954' },
    rows: [
      '.....aa.....', '.a...ac...a.', '..a.oooo.a..', '...oyccyo...', '..oyhcccyo..', 'aoyhcccyyoa.',
      'aoyhcccyyoa.', '..oycccyo...', '...oyyyo....', '..a.ooo.a...', '.a...ac..a..', '.....aa.....',
    ],
  },
  moon: {
    colors: { o: '#3e466f', s: '#83b0d2', h: '#e9f8f5', c: '#b8d9e7', a: '#ebe5b3' },
    rows: [
      '....oooo....', '...ochho....', '..ochho..a..', '.ochho..aaa.', '.ochho...a..', '.ochho......',
      '.ochhco...o.', '.occhhco.oo.', '..occhhcoo..', '...osccoo...', '....oooo....', '............',
    ],
  },
  prism: {
    colors: { o: '#45345d', s: '#e0a1d4', h: '#fff0cc', c: '#86d9c9', a: '#a89ad8', l: '#f8c78c' },
    rows: [
      '.....oo.....', '....ohso....', '...ohshso...', '..ohhhssao..', '.ohhshssaco.', '.ohshhsacco.',
      '..olhsaaco..', '...olacco...', '....oaco....', '.....oo.....', '.l........h.', '............',
    ],
  },
  truck: {
    colors: { o: iconInk, h: '#f7e1a1', b: '#91d5dc', g: '#4e9d84', p: '#508075', a: '#dcab72', w: '#7d788d' },
    rows: [
      '............', '............', '.ooooooo....', '.ohahahooo..', '.oapappogho.', '.oapappobbo.',
      '.oagggggbggo', '.oaggaggaaho', '.ooooooooooo', '..owwo..owo.', '..oooo..ooo.', '............',
    ],
  },
  shelf: {
    colors: { o: iconInk, h: '#f0c793', a: '#b9855c', m: '#8e5960', t: '#ac6b60' },
    rows: [
      '............', '.oooooooooo.', '.ohhhhhhhho.', '.oammmmmtao.', '.oa......ao.', '.oahhhhhhao.',
      '.otmmmmmmto.', '.oa......ao.', '.oahhhhhhao.', '.otmmmmmmto.', '.oo......oo.', '............',
    ],
  },
  compost: {
    colors: { o: iconInk, h: '#b0cf92', a: '#76a27a', m: '#4b746a', t: '#8b7266', c: '#e8d395' },
    rows: [
      '............', '....oooo....', '..oohhhoo...', '.ohhhhhhhho.', '.oooooooooo.', '..ohatamoo..',
      '..oahhamoo..', '..oahchmoo..', '..oamammo...', '..oaaaaao...', '...ooooo....', '............',
    ],
  },
  remove: {
    colors: { o: '#4b3446', h: '#ffe5b2', a: '#f6bd7a', c: '#d59476', m: '#74a6ac' },
    rows: [
      '....ooooo...', '...ohhhao...', '...ohhhao...', '..oohhhao...', '.ooahahao...', '.ohhahahao..',
      '..oahaaao...', '...occcco...', '...occcco...', '...ommmmo...', '...oooooo...', '............',
    ],
  },
};

const aliases = {
  seeds: 'seed', seedpacket: 'seed', starter: 'clay', pot: 'clay', emptypot: 'clay', repot: 'clay',
  repotclay: 'clay', repotsilver: 'silver', repotglass: 'glass', terracotta: 'clay', silverpot: 'silver', glasspot: 'glass',
  solar: 'sun', lunar: 'moon', thermal: 'sun', booth: 'sun', solarbooth: 'sun', lunarbooth: 'moon', prismbooth: 'prism',
  watering: 'water', drop: 'water', watershower: 'shower', shears: 'prune', pruning: 'prune', dispatch: 'truck',
  courier: 'truck', delivery: 'truck', deliver: 'truck', ingredient: 'sunstone', lift: 'remove',
};
const accentPixels = { seed: 'c', sun: 'a', moon: 'a', prism: 'l' };
const grid = 12;

function compile(rows) {
  return rows.flatMap((row, y) => {
    const runs = [];
    for (let x = 0; x < row.length;) {
      const color = row[x];
      let end = x + 1;
      while (row[end] === color) end++;
      if (color !== '.') runs.push([color, x, end, y]);
      x = end;
    }
    return runs;
  });
}

for (const entry of Object.values(art)) entry.runs = compile(entry.rows);

export function drawStationIcon(ctx, key, x, y, size = 18, accent) {
  const requested = typeof key === 'string' ? key.toLowerCase().replace(/[\s_-]/g, '') : '';
  const name = aliases[requested] ?? requested;
  if (!Object.hasOwn(art, name) || !Number.isFinite(size) || size <= 0) return false;
  const entry = art[name];
  const pixels = Math.max(1, Math.round(size));
  const left = Math.round(x - pixels / 2);
  const top = Math.round(y - pixels / 2);
  const at = value => Math.round(value * pixels / grid);
  ctx.save();
  for (const [color, start, end, row] of entry.runs) {
    const width = at(end) - at(start);
    const height = at(row + 1) - at(row);
    if (!width || !height) continue;
    ctx.fillStyle = color === accentPixels[name] && accent ? accent : entry.colors[color];
    ctx.fillRect(left + at(start), top + at(row), width, height);
  }
  ctx.restore();
  return true;
}
