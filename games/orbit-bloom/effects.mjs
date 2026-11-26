const effectsByEvent = {
  sow: { motion: 'leaf', colors: ['#6ab991', '#b2e6a6', '#e1ffc6'], count: 5, life: .47 },
  water: { motion: 'drop', colors: ['#62c5df', '#9ee8ef', '#dcfff6'], count: 12, life: .74 },
  repot: { motion: 'soil', colors: ['#b66c69', '#e59877', '#ffd2a0'], count: 10, life: .60 },
  prune: { motion: 'leaf', colors: ['#4fbb8f', '#8ff0bc', '#d8ffc6'], count: 7, life: .54 },
  roots: { motion: 'leaf', colors: ['#6ab796', '#bbe6a6', '#edffd0'], count: 12, life: .89 },
  bloom: { motion: 'petal', colors: ['#ec9ce9', '#ffccee', '#fffae7'], count: 15, life: 1.18 },
  deliver: { motion: 'confetti', colors: ['#ffb675', '#ffee9d', '#8cebcf', '#d6b6ff'], count: 18, life: 1.13 },
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

const thermalColors = {
  sun: ['#ed8251', '#ffc67b', '#ffedb5'],
  moon: ['#668ac0', '#a2d9ef', '#e3fbf4'],
  prism: ['#a271c2', '#edadeb', '#c0ffe3'],
};

const showerColors = ['#469aba', '#8cdbdc', '#e0fff0'];
const finishRings = {
  water: { spread: 18, height: .26, dy: 11 },
  roots: { spread: 20, height: .35, dy: 7 },
  bloom: { spread: 24, height: .68, dy: -10 },
  deliver: { spread: 31, height: .29, dy: 9 },
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

function glow(ctx, color, x, y, width, height, opacity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);
  ctx.globalAlpha *= opacity;
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  light.addColorStop(0, color);
  light.addColorStop(.44, color + 'a2');
  light.addColorStop(1, color + '00');
  ctx.fillStyle = light;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function ellipse(ctx, x, y, width, height, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, angle, 0, Math.PI * 2);
}

function drawReflection(ctx, colors, time, phase, y, active) {
  const drift = Math.sin(time * .82 + phase) * 2.6;
  // The two soft, offset patches read as light reflected in glass or water.
  glow(ctx, colors[1], drift - 3.5, y, 9, 1.6, active ? .31 : .16);
  glow(ctx, colors[2], drift + 2.5, y - .73, 5.9, 1, active ? .32 : .10);
  if (!active) return;
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = .22;
  ctx.globalAlpha = .22 + Math.sin(time * 1.7 + phase) * .08;
  ctx.beginPath();
  ctx.moveTo(drift - 4.6, y - .6);
  ctx.quadraticCurveTo(drift, y - 1.2, drift + 4.9, y - .6);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawShowerFlow(ctx, time, phase) {
  glow(ctx, showerColors[0], 0, -11, 8, 8, .34);
  for (let stream = 0; stream < 7; stream++) {
    const lane = stream - 3;
    for (let bead = 0; bead < 2; bead++) {
      const fall = fraction(time * 2.05 + stream * .21 + bead * .5 + phase);
      const x = lane * (1.04 + fall * .65) + Math.sin(phase + fall * 3 + stream) * .31;
      const y = -18.5 + fall ** 1.22 * 13.8;
      ctx.strokeStyle = showerColors[stream % 2 ? 1 : 2];
      ctx.lineWidth = stream % 3 ? .36 : .55;
      ctx.lineCap = 'round';
      ctx.globalAlpha = Math.min(1, fall * 7, (1 - fall) * 14) * (.46 + .21 * fall);
      ctx.beginPath();
      ctx.moveTo(x - lane * .095, y - .9 - fall * .85);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 3; i++) {
    const spread = fraction(time * 1.85 + i / 3 + phase);
    ellipse(ctx, (i - 1) * 3.2, -4.9, .6 + 2.4 * spread, .26 + .58 * spread);
    ctx.lineWidth = .25;
    ctx.strokeStyle = showerColors[2];
    ctx.globalAlpha = Math.sin(spread * Math.PI) * .47;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSolarFlames(ctx, colors, time, phase) {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 3.3;
    const sway = Math.sin(time * 4.2 + phase + i * 1.6);
    const tip = -10.2 - Math.sin(time * 4.8 + i * 1.8 + phase) * 1.5 - (i === 1 ? 1.6 : 0);
    ctx.fillStyle = colors[i === 1 ? 1 : 0];
    ctx.globalAlpha = .28 + i % 2 * .09;
    ctx.beginPath();
    ctx.moveTo(x - 1.7, -5.4);
    ctx.quadraticCurveTo(x - 2.3, tip + 4.8, x + sway, tip);
    ctx.quadraticCurveTo(x + .65, tip + 3.6, x + 1.8, -5.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawThermalWisps(ctx, type, colors, time, phase) {
  for (let i = 0; i < 3; i++) {
    const cycle = fraction(time * (type === 'sun' ? .67 : .43) + i / 3 + phase);
    const start = (i - 1) * 4.2;
    const drift = Math.sin(time * 2.2 + i * 1.8 + phase) * 1.7;
    const y = -6.4 - cycle * 10.9;
    ctx.strokeStyle = colors[(i % 2) + 1];
    ctx.lineWidth = type === 'sun' ? .56 : .42;
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.sin(cycle * Math.PI) * .55;
    ctx.beginPath();
    ctx.moveTo(start + drift * .4, y + 2.2);
    ctx.bezierCurveTo(start + drift - 1.7, y + 1.55, start + drift + 2.6, y - .55, start + drift, y - 1.1);
    ctx.stroke();
    ctx.fillStyle = colors[2];
    ellipse(ctx, start + drift * .74 + .4, y - 1.4, .37, type === 'sun' ? .61 : .42);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawStationEffect(ctx, { type, x, y, size, time, active, effects }) {
  const colors = type === 'shower' ? showerColors : thermalColors[type];
  if (!effects || !colors) return;
  const phase = (x + y) * .037;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  if (type === 'shower') {
    drawReflection(ctx, colors, time, phase, -4.5, active);
    if (active) drawShowerFlow(ctx, time, phase);
  } else {
    glow(ctx, colors[0], 0, -12.1, 10, 9.4, active ? .41 : .13);
    glow(ctx, colors[2], 0, -17.5, 5.1, 4.7, active ? .47 : .19);
    drawReflection(ctx, colors, time, phase, -6.2, active);
    if (active && type === 'sun') drawSolarFlames(ctx, colors, time, phase);
    if (active) drawThermalWisps(ctx, type, colors, time, phase);
  }
  ctx.restore();
}

function scatter(ctx, particle, x, y, scale) {
  const size = Math.max(1, Math.round(particle.size * scale));
  const { motion, color } = particle;
  if (motion === 'star') {
    star(ctx, color, x, y, size);
  } else if (motion === 'petal') {
    ctx.fillStyle = color;
    ellipse(ctx, x, y, size * 1.08, size * .56, Math.atan2(particle.vy, particle.vx));
    ctx.fill();
    if (particle.size === 1) star(ctx, color, x, y, 1);
  } else if (motion === 'drop') {
    block(ctx, color, x, y - size, size, size * 2 + 1);
    block(ctx, '#e4f6ff', x, y - size, 1, size);
  } else if (motion === 'leaf') {
    block(ctx, color, x - size, y + 1, size * 2 + 1, size);
    block(ctx, color, x, y, size + 1, size);
  } else if (motion === 'confetti') {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * .65;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size, y + size);
    ctx.quadraticCurveTo(x, y - size, x + size, y - size * .45);
    ctx.stroke();
  } else {
    block(ctx, color, x, y, size + 1, size);
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
  glow(ctx, colors[0], x, crown, size * .54, size * .45, .44);
  glow(ctx, colors[1], x, crown + size * .05, size * .32, size * .31, .40);
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
      const ring = finishRings[burst.kind];
      if (ring) {
        const radius = (4 + travel * ring.spread) * scale;
        const level = y + ring.dy * scale;
        ctx.globalAlpha = opacity * .47;
        glow(ctx, burst.color, x, level, radius, radius * (ring.height + .2), .78);
        ctx.globalAlpha = opacity * .44;
        ctx.lineWidth = 1.3 * scale;
        ctx.strokeStyle = burst.color;
        ellipse(ctx, x, level, radius, radius * ring.height);
        ctx.stroke();
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
