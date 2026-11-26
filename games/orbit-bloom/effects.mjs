const effectsByEvent = {
  sow: { motion: 'leaf', colors: ['#6ab991', '#b2e6a6', '#e1ffc6'], count: 5, life: .47 },
  water: { motion: 'drop', colors: ['#63bef5', '#9de5ff', '#d8fbff'], count: 10, life: .65 },
  repot: { motion: 'soil', colors: ['#b66c69', '#e59877', '#ffd2a0'], count: 10, life: .60 },
  prune: { motion: 'leaf', colors: ['#4fbb8f', '#8ff0bc', '#d8ffc6'], count: 7, life: .54 },
  roots: { motion: 'leaf', colors: ['#7bc495', '#c3f5ab', '#f1ffc5'], count: 10, life: .78 },
  bloom: { motion: 'star', colors: ['#ec9ce9', '#ffccee', '#fffae7'], count: 13, life: 1.08 },
  deliver: { motion: 'confetti', colors: ['#ffb675', '#ffee9d', '#8cebcf', '#d6b6ff'], count: 16, life: 1.05 },
  sunstone: { motion: 'star', colors: ['#da866a', '#ffc47a', '#fff2a1'], count: 6, life: .60 },
  moonsoil: { motion: 'soil', colors: ['#9c94cc', '#a5dbf3', '#e3f8ff'], count: 6, life: .60 },
  stardust: { motion: 'star', colors: ['#b491ec', '#f1bef4', '#faecff'], count: 7, life: .65 },
};

const themes = {
  dawn: ['#f8bd83', '#f6e9a6'], moon: ['#94d3e8', '#c6e7f0'], comet: ['#7cebd3', '#cba1eb'],
  dune: ['#ffac79', '#f9da96'], meteor: ['#fa9b86', '#ffc997'], nebula: ['#ee9bd2', '#c7a9f4'],
  frost: ['#b4e7f8', '#dff7ff'], aurora: ['#9aeac8', '#cbb1ff'], eclipse: ['#e397d8', '#f8ca91'],
  midnight: ['#a99ce9', '#9bd5ef'], pollenworks: ['#f6bf81', '#ffe6a3'], tidalglass: ['#86e5cf', '#adecf4'],
  switchyard: ['#f7a785', '#f4d59a'], drawbridge: ['#a7b9f7', '#cfb0ed'], saturn: ['#ecc081', '#c0a8f2'],
};

const bloomColors = {
  sunflare: ['#ffbd6b', '#fff4a5', '#fff7cf'], moonbell: ['#80bbef', '#a9e7ff', '#eefcff'],
  cometvine: ['#70e4b6', '#bafbd1', '#e2fee4'], nebulalily: ['#e990d9', '#f8bdf1', '#ffe9f7'],
  eclipseorchid: ['#b98aec', '#d8b6f4', '#f4e1fc'],
};

const scoreGlyphs = { '+': ['000', '010', '111', '010', '000'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  4: ['101', '101', '111', '001', '001'],
};

const fraction = value => value - Math.floor(value);
const unit = seed => fraction(Math.sin(seed * 83.5528 + 12.9898) * 43758.5453);
const lerp = (a, b, progress) => a + (b - a) * progress;

function block(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function star(ctx, color, x, y, size) {
  const mid = Math.floor(size / 2);
  block(ctx, color, x - size, y - mid, size * 2 + 1, mid * 2 + 1);
  block(ctx, color, x - mid, y - size, mid * 2 + 1, size * 2 + 1);
}

function patch(ctx, color, x, y, radius) {
  block(ctx, color, x - radius, y - radius / 2, radius * 2 + 1, radius + 1);
  block(ctx, color, x - radius * .72, y - radius * .7, Math.round(radius * 1.44) + 1, Math.round(radius * 1.4) + 1);
}

function scatter(ctx, particle, x, y, scale) {
  const size = Math.max(1, Math.round(particle.size * scale));
  const { motion, color } = particle;
  if (motion === 'star') {
    star(ctx, color, x, y, size);
  } else if (motion === 'drop') {
    block(ctx, color, x, y - size, size, size * 2 + 1);
    block(ctx, '#e4f6ff', x, y - size, 1, size);
  } else if (motion === 'leaf') {
    block(ctx, color, x - size, y + 1, size * 2 + 1, size);
    block(ctx, color, x, y, size + 1, size);
  } else {
    block(ctx, color, x, y, size + 1, size + (motion === 'confetti' ? 2 : 0));
  }
}

function drawScore(ctx, score, x, y) {
  if (score !== '+100' && score !== '+140') return;
  const colors = ['#34223d', '#fff3a5'];
  for (const [layer, color] of colors.entries()) {
    for (const [index, digit] of [...score].entries()) {
      for (const [row, line] of scoreGlyphs[digit].entries()) {
        for (const [column, bit] of [...line].entries()) {
          if (bit === '1') block(ctx, color, x - 15 + index * 8 + column * 2, y + row * 2 + 1 - layer, 2, 2);
        }
      }
    }
  }
}

function createBurst(event, preset, time, tileSize, colors = preset.colors) {
  const particles = Array.from({ length: preset.count }, (_, index) => {
    const seed = event.id * 111 + index;
    const angle = index * Math.PI * 2 / preset.count + unit(seed + 41) * .5;
    const velocity = lerp(.23, .65, unit(seed + 91)) * tileSize;
    return { motion: preset.motion, color: colors[index % colors.length], size: 1 + index % 3,
      vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity * .48,
    };
  });
  return { kind: event.kind, text: event.text, time, life: preset.life, particles, color: colors[0],
    x: (event.x + .5) * tileSize, y: (event.y + (event.kind === 'deliver' ? .6 : .48)) * tileSize,
  };
}

export function drawBloomHalo(ctx, x, y, size, flowerId, time, effects) {
  if (!effects) return;
  const colors = bloomColors[flowerId] ?? bloomColors.sunflare;
  const crown = y - size * (flowerId === 'cometvine' ? 1.02 : .92);
  ctx.save();
  ctx.globalAlpha *= .10;
  patch(ctx, colors[0], x, crown, Math.round(size * .43));
  ctx.globalAlpha *= 1.65;
  patch(ctx, colors[1], x, crown, Math.round(size * .30));
  ctx.restore();
  ctx.save();
  for (let index = 0; index < 3; index++) {
    const progress = fraction(time * (.27 + index * .03) + index / 3 + x / 113);
    const px = x + Math.cos(time + index * 2.6) * size * (.38 + index * .05);
    const py = crown + size * (.47 - progress * .92);
    ctx.globalAlpha = Math.sin(progress * Math.PI) * .57;
    star(ctx, colors[2], px, py, index ? 1 : 2);
  }
  ctx.restore();
}

export function createGreenhouseEffects(tileSize = 48) {
  let active = false;
  let lastEvent;
  let motes = [];
  let bursts = [];

  function reset(level) {
    active = false;
    lastEvent = undefined;
    bursts = [];
    const colors = themes[level.theme] ?? themes.dawn;
    const perimeter = level.layout.flatMap((row, y) => [...row].map((cell, x) => ({ cell, x, y })))
      .filter(({ cell, x, y }) => cell === '.' && (x === 0 || x === level.width - 1 || y === 0 || y === level.height - 1));
    motes = perimeter.filter(({ x, y }) => (x * 5 + y * 3) % 4 === 1).slice(0, 12)
      .map(({ x, y }, seed) => ({ x: (x + lerp(.24, .77, unit(seed))) * tileSize,
        y: (y + lerp(.28, .86, unit(seed + 16))) * tileSize,
        speed: lerp(.14, .28, unit(seed + 53)), offset: unit(seed + 81), color: colors[seed % colors.length],
      }));
  }

  function update(state, time, effects) {
    const since = lastEvent;
    lastEvent = state.lastEventId;
    if (!effects || since === undefined || lastEvent < since) {
      bursts = [];
      active = effects;
      return;
    }
    if (bursts.some(burst => time - burst.time >= burst.life)) {
      bursts = bursts.filter(burst => time - burst.time < burst.life);
    }
    if (active && lastEvent > since) {
      for (const event of state.events) {
        const preset = effectsByEvent[event.kind];
        if (event.id <= since || !preset || !Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
        const boothPlant = event.kind === 'bloom' && state.plants?.find(plant => plant.stationId === event.stationId);
        bursts.push(createBurst(event, preset, time, tileSize, bloomColors[boothPlant?.flowerId]));
      }
      if (bursts.length > 16) bursts = bursts.slice(-16);
    }
    active = effects;
  }

  function drawAmbient(ctx, time) {
    if (!active) return;
    ctx.save();
    for (const mote of motes) {
      const drift = fraction(time * mote.speed + mote.offset);
      ctx.globalAlpha = Math.sin(drift * Math.PI) * .31;
      star(ctx, mote.color, mote.x + Math.sin(time + mote.offset * 6) * 5, mote.y - drift * 10, 1);
    }
    ctx.restore();
  }

  function drawBursts(ctx, time) {
    if (!active || !bursts.length) return;
    const scale = tileSize / 48;
    ctx.save();
    for (const burst of bursts) {
      const progress = Math.min(1, Math.max(0, (time - burst.time) / burst.life));
      if (progress === 0 || progress === 1) continue;
      const travel = 1 - (1 - progress) ** 2;
      const opacity = Math.min(1, progress * 9) * (1 - progress);
      const { x, y } = burst;
      if (burst.kind === 'bloom' || burst.kind === 'water' || burst.kind === 'roots') {
        ctx.globalAlpha = opacity * .19;
        patch(ctx, burst.color, x, y, Math.max(2, Math.round((5 + travel * 18) * scale)));
      }
      ctx.globalAlpha = opacity;
      for (const particle of burst.particles) {
        const lift = particle.motion === 'drop' ? 24 : particle.motion === 'soil' ? 19 : 23;
        const gravity = particle.motion === 'drop' || particle.motion === 'soil' ? 29 : 6;
        scatter(ctx, particle, x + particle.vx * travel,
          y + particle.vy * travel + (-progress * lift + gravity * progress ** 2) * scale, scale);
      }
      if (burst.kind === 'deliver') {
        const labelX = Math.max(19, Math.min(ctx.canvas.width - 19, x));
        const labelY = Math.max(4, y - (21 + progress * 15) * scale);
        ctx.globalAlpha = Math.min(1, progress * 9, (1 - progress) * 3.5);
        drawScore(ctx, burst.text, labelX, labelY);
      }
    }
    ctx.restore();
  }

  return { reset, update, drawAmbient, drawBursts };
}
