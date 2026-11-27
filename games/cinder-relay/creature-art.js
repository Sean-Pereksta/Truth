/* Shared Canvas silhouettes for creature gear and its combat effects. */
(() => {
  'use strict';

  const cat = {
    ink: '#200e1c', dark: '#412137', mid: '#70384b', light: '#f59c57',
    pale: '#ffe9b0', hot: '#ff749f', seam: '#c95e72', glow: '#ffbd78'
  };
  const prism = {
    ink: '#14152b', dark: '#32325a', mid: '#656b9f', light: '#b9c6f0',
    pale: '#f5f3ff', hot: '#93f4ed', seam: '#ac7bea', glow: '#fff0b5'
  };
  const rainbow = ['#ff698f', '#ffb771', '#f5e985', '#79f0bf', '#77d5ff', '#bf9dff'];

  function polygon(ctx, fill, ...points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function outline(ctx, fill, stroke, ...points) {
    polygon(ctx, fill, ...points);
    ctx.lineWidth = 1.35;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function box(ctx, fill, x, y, width, height) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
  }

  function oval(ctx, fill, x, y, horizontal, vertical) {
    ctx.beginPath();
    ctx.ellipse(x, y, horizontal, vertical, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function line(ctx, stroke, width, ...points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function paw(ctx, x, y, r, fill) {
    oval(ctx, fill, x, y + r * .27, r * .55, r * .43);
    oval(ctx, fill, x - r * .59, y - r * .16, r * .21, r * .27);
    oval(ctx, fill, x - r * .23, y - r * .48, r * .21, r * .28);
    oval(ctx, fill, x + r * .23, y - r * .48, r * .21, r * .28);
    oval(ctx, fill, x + r * .59, y - r * .16, r * .21, r * .27);
  }

  function star(ctx, x, y, radius, fill) {
    const edge = radius * .23;
    polygon(ctx, fill, x, y - radius, x + edge, y - edge, x + radius, y,
      x + edge, y + edge, x, y + radius, x - edge, y + edge, x - radius, y, x - edge, y - edge);
  }

  function stripeRail(ctx, x, y, length, gap) {
    for (let i = 0; i < rainbow.length; i++) {
      box(ctx, rainbow[i], x + gap * i, y, gap * .74, length);
    }
  }

  function grip(ctx, colors, x, y) {
    outline(ctx, colors.dark, colors.ink, x, y, x + 9, y, x + 4, y + 11, x - 3, y + 11, x - 4, y + 8);
    line(ctx, colors.mid, 1.2, x - 1, y + 7, x + 4, y + 7, x + 6.5, y + 2);
    line(ctx, colors.ink, 1, x, y + 4, x + 5, y + 4);
    box(ctx, colors.light, x - 3, y + 9, 6, 1.5);
  }

  function drawSpawner(ctx) {
    outline(ctx, cat.dark, cat.ink, -25, -6, -21, -11, -14, -12, -13, -17, -7, -14,
      8, -14, 13, -17, 16, -11, 21, -10, 26, -5, 26, 8, 20, 12, -21, 12, -25, 7);
    polygon(ctx, cat.mid, -23, -5, -18, -9, 20, -9, 24, -5, 24, 5, -23, 5);
    outline(ctx, cat.ink, cat.seam, -15, -8, -10, -11, 10, -11, 15, -8, 15, 4, 11, 7, -11, 7, -15, 4);
    paw(ctx, 0, -2, 7.6, cat.hot);
    line(ctx, cat.light, 2, -18, -7, -18, 5, -14, 8, 14, 8, 18, 5, 18, -7);
    line(ctx, cat.pale, 1, -11, -13, 8, -13);
    box(ctx, cat.glow, -22, -3, 2, 5);
    box(ctx, cat.glow, 20, -3, 2, 5);
    box(ctx, cat.mid, -20, 11, 8, 3);
    box(ctx, cat.mid, 12, 11, 8, 3);
  }

  function drawLauncher(ctx) {
    grip(ctx, cat, -5, 2);
    outline(ctx, cat.dark, cat.ink, -28, -5, -21, -9, -13, -9, -11, -13, -5, -13,
      0, -11, 21, -10, 28, -7, 28, 7, 21, 11, 0, 9, -13, 6, -20, 7, -27, 4);
    polygon(ctx, cat.mid, -19, -6, -12, -8, 18, -8, 24, -6, 24, 5, 17, 8, -10, 5, -19, 4);
    polygon(ctx, cat.seam, -9, -6, 17, -6, 21, -3, 20, 3, -9, 1);
    outline(ctx, cat.light, cat.ink, 20, -10, 27, -9, 30, -6, 30, 7, 27, 10, 20, 11, 23, 5, 23, -5);
    box(ctx, cat.ink, 27, -6, 3, 13);
    box(ctx, cat.pale, 25, -7, 4, 2);
    box(ctx, cat.hot, 23, 4, 4, 2.7);
    outline(ctx, cat.light, cat.ink, -9, -8, -8, -12, -5, -9, 0, -9, 3, -12, 6, -8, 6, 1, 2, 4, -5, 4, -9, 1);
    paw(ctx, -1, -3, 4.3, cat.ink);
    line(ctx, cat.light, 1, -22, -5, -16, -5, -16, 2, -22, 3);
    line(ctx, cat.pale, 1, 8, -7, 18, -7);
    box(ctx, cat.hot, -24, -2, 2, 2);
  }

  function drawCatana(ctx) {
    outline(ctx, cat.dark, cat.ink, -28, 1, -12, -1, -12, 5, -27, 8, -31, 5);
    polygon(ctx, cat.light, -28, 2, -24, 2, -26, 6, -29, 6);
    for (let i = 0; i < 4; i++) polygon(ctx, cat.seam, -24 + i * 3, 2, -22 + i * 3, 2, -24 + i * 3, 6, -26 + i * 3, 6);
    outline(ctx, '#ba97a6', cat.ink, -8, -1, 9, -3, 23, -7, 31, -12, 29, -5, 20, 1, 8, 4, -8, 6);
    polygon(ctx, '#fff1ed', -8, -1, 9, -3, 23, -7, 31, -12, 28, -7, 21, -3, 9, 1, -8, 3);
    line(ctx, cat.hot, 1.45, -7, 5, 9, 3, 20, 0, 28, -5);
    outline(ctx, cat.light, cat.ink, -13, -3, -12, -8, -9, -5, -6, -7, -5, -1, -7, 7, -11, 9, -14, 6);
    paw(ctx, -9.6, 1, 3.1, cat.ink);
  }

  function drawSniper(ctx) {
    grip(ctx, prism, -12, 3);
    outline(ctx, prism.dark, prism.ink, -34, -7, -27, -9, -19, -6, 10, -6, 14, -4, 31, -3,
      36, -1, 31, 1, 15, 3, 8, 6, -20, 6, -23, 9, -33, 8);
    polygon(ctx, prism.mid, -31, -5, -24, -7, -18, -4, 8, -4, 8, 3, -22, 3, -26, 6, -31, 6);
    polygon(ctx, prism.light, -16, -4, 7, -4, 11, -1, 5, 2, -14, 2);
    polygon(ctx, prism.glow, 8, -4, 20, -4, 36, -1, 22, 1, 10, 4, 13, 0);
    line(ctx, prism.pale, 1, 15, -3, 21, -2, 33, -1);
    for (let i = 0; i < 5; i++) line(ctx, prism.mid, 1, 16 + 2.8 * i, -3.4 + i * .38, 18 + 2.8 * i, 2.7 - i * .38);
    outline(ctx, prism.ink, prism.mid, -19, -11, -15, -14, -3, -14, 1, -12, 1, -8, -4, -7, -17, -7, -19, -9);
    oval(ctx, prism.hot, -4, -10.5, 3.4, 2.15);
    oval(ctx, prism.pale, -3.25, -11, 1.25, .75);
    box(ctx, prism.seam, -25, -3, 2, 4);
    stripeRail(ctx, -12, 2, 1.6, 2);
  }

  function drawStream(ctx) {
    grip(ctx, prism, -10, 4);
    outline(ctx, prism.dark, prism.ink, -26, -5, -19, -10, -9, -8, -5, -10, 18, -11,
      27, -16, 29, -9, 26, -4, 19, -1, 27, 1, 29, 5, 27, 10, 14, 8, -7, 9, -16, 5, -23, 5);
    polygon(ctx, prism.mid, -22, -4, -17, -7, -6, -4, 9, -5, 16, -2, 9, 4, -7, 6, -17, 3, -21, 3);
    outline(ctx, prism.light, prism.ink, 0, -9, 17, -11, 27, -15, 26, -9, 21, -6, 0, -3);
    outline(ctx, prism.light, prism.ink, 0, 1, 18, 1, 27, 4, 27, 9, 19, 8, 0, 7);
    line(ctx, prism.hot, 2.5, 3, -6, 18, -8, 26, -12);
    line(ctx, '#dc93f8', 2.5, 3, 4, 18, 4, 26, 7);
    line(ctx, prism.pale, 1, 4, -8, 16, -9);
    outline(ctx, prism.ink, prism.mid, -15, -4, -10, -8, -5, -4, -5, 1, -11, 5, -15, 1);
    star(ctx, -10.5, -1, 3.3, prism.glow);
  }

  function drawLaser(ctx) {
    grip(ctx, prism, -12, 4);
    outline(ctx, prism.dark, prism.ink, -29, -7, -21, -11, 2, -11, 10, -7, 25, -7, 29, -4, 29, 4, 23, 7, 9, 7, 3, 11, -21, 10, -29, 6);
    polygon(ctx, prism.mid, -27, -5, -19, -8, 1, -8, 8, -4, 8, 5, 2, 8, -20, 7, -27, 4);
    polygon(ctx, prism.ink, -19, -5, 0, -5, 5, 0, -1, 5, -19, 5);
    stripeRail(ctx, -17, -4, 8, 2.35);
    outline(ctx, prism.light, prism.ink, 12, -9, 27, -8, 30, -4, 30, 4, 27, 8, 12, 9, 16, 4, 16, -4);
    line(ctx, prism.hot, 1, 18, -5, 26, -5, 28, -3, 28, 3, 26, 5, 18, 5);
    polygon(ctx, '#bba3ff', -1, -1, 9, -10, 24, -1, 14, 10);
    polygon(ctx, '#f2eaff', -1, -1, 9, -10, 13, -1, 7, 4);
    polygon(ctx, '#92f7ec', 9, -10, 24, -1, 13, -1);
    polygon(ctx, '#ff83ce', 13, -1, 24, -1, 14, 10, 7, 4);
    star(ctx, 13, -1, 3.65, '#fff8fc');
  }

  function drawExploder(ctx) {
    grip(ctx, prism, -13, 5);
    grip(ctx, prism, 3, 5);
    outline(ctx, prism.dark, prism.ink, -28, -9, -20, -13, 13, -13, 27, -10, 31, -6,
      31, 7, 26, 11, -18, 11, -24, 8, -28, 3);
    polygon(ctx, prism.mid, -26, -7, -19, -10, 16, -10, 25, -7, 28, -3, 28, 6, 24, 8, -20, 8, -26, 4);
    outline(ctx, prism.ink, prism.light, -18, -7, 10, -7, 19, -4, 19, 5, -18, 5, -22, 1);
    for (let i = 0; i < rainbow.length; i++) line(ctx, rainbow[i], 2.9, -16 + i * 4.9, -6, -12 + i * 4.9, 4);
    outline(ctx, prism.light, prism.ink, 19, -13, 28, -12, 33, -7, 33, 8, 26, 12, 19, 12, 23, 6, 23, -6);
    polygon(ctx, prism.ink, 29, -8, 33, -6, 33, 7, 29, 8);
    line(ctx, prism.glow, 2, 25, -9, 28, -8, 29, -5, 29, 6, 26, 9);
    box(ctx, prism.hot, -24, -4, 2, 6);
    box(ctx, prism.pale, -16, -10, 22, 1.5);
  }

  function drawArmor(ctx, colors, unicorn) {
    outline(ctx, colors.dark, colors.ink, -11, 8, -1, 8, -2, 24, -11, 24, -13, 21);
    outline(ctx, colors.dark, colors.ink, 1, 8, 11, 8, 13, 21, 11, 24, 2, 24);
    box(ctx, colors.light, -11, 18, 7, 3);
    box(ctx, colors.light, 4, 18, 7, 3);
    line(ctx, colors.pale, 1, -10, 20, -5, 20);
    line(ctx, colors.pale, 1, 5, 20, 10, 20);
    outline(ctx, colors.mid, colors.ink, -16, -4, -9, -9, 8, -9, 16, -4, 14, 11, 9, 14, -9, 14, -14, 11);
    polygon(ctx, colors.dark, -8, -6, 8, -6, 12, 2, 7, 9, -7, 9, -12, 2);
    polygon(ctx, colors.light, -13, -5, -8, -8, -6, -5, -10, 0, -17, 1, -19, -1);
    polygon(ctx, colors.light, 13, -5, 8, -8, 6, -5, 10, 0, 17, 1, 19, -1);
    outline(ctx, colors.mid, colors.ink, -18, 0, -12, 0, -13, 10, -16, 13, -21, 11, -21, 6);
    outline(ctx, colors.mid, colors.ink, 18, 0, 12, 0, 13, 10, 16, 13, 21, 11, 21, 6);
    line(ctx, colors.seam, 1.7, -19, 6, -16, 6);
    line(ctx, colors.seam, 1.7, 16, 6, 19, 6);
    line(ctx, colors.light, 1.4, -8, 11, 8, 11);
    if (unicorn) {
      outline(ctx, colors.light, colors.ink, -12, -14, -9, -24, -5, -22, 4, -22, 9, -24, 12, -16, 10, -8, 6, -5, -6, -5, -10, -8);
      outline(ctx, colors.glow, colors.mid, -3, -20, -1, -32, 4, -21, 3, -18, -1, -17);
      line(ctx, colors.pale, 1.1, 0, -28, 1, -21);
      polygon(ctx, colors.ink, -9, -16, -4, -18, 5, -18, 9, -15, 7, -10, -6, -10);
      line(ctx, colors.hot, 1.6, -7, -14, -2, -14, 0, -12, 2, -14, 7, -14);
      stripeRail(ctx, -6, 1, 4, 2.1);
      star(ctx, 0, 2, 3.7, '#fff6dc');
    } else {
      outline(ctx, colors.light, colors.ink, -12, -20, -11, -29, -4, -23, 5, -23, 11, -29,
        13, -19, 11, -10, 7, -6, -7, -6, -11, -10);
      polygon(ctx, colors.seam, -10, -25, -6, -22, -10, -20);
      polygon(ctx, colors.seam, 10, -25, 6, -22, 10, -20);
      polygon(ctx, colors.ink, -10, -16, -4, -20, 4, -20, 10, -16, 8, -10, -8, -10);
      line(ctx, colors.hot, 1.5, -7, -15, -3, -14);
      line(ctx, colors.hot, 1.5, 3, -14, 7, -15);
      box(ctx, colors.pale, -1, -12, 2, 1.5);
      paw(ctx, 0, 2, 6, colors.hot);
      box(ctx, colors.pale, -2, 10, 4, 2);
    }
  }

  const silhouettes = {
    catSpawner: drawSpawner,
    catLauncher: drawLauncher,
    catana: drawCatana,
    unicornSniper: drawSniper,
    unicornStream: drawStream,
    rainbowLaser: drawLaser,
    rainbowExploder: drawExploder,
    catArmor: (ctx) => drawArmor(ctx, cat, false),
    unicornArmor: (ctx) => drawArmor(ctx, prism, true)
  };
  const gearSprites = new Map();
  const creatureSprites = new Map();
  const framesPerStride = 8;
  const aliases = Object.freeze({
    'cat-spawner': 'catSpawner', 'cat-launcher': 'catLauncher', 'cat-armor': 'catArmor',
    'unicorn-sniper': 'unicornSniper', 'unicorn-stream': 'unicornStream',
    'unicorn-armor': 'unicornArmor', 'rainbow-laser': 'rainbowLaser',
    'rainbow-exploder': 'rainbowExploder'
  });

  function artId(id) {
    return Object.hasOwn(aliases, id) ? aliases[id] : id;
  }

  function renderSprite(canvas, radius, draw, phase) {
    const art = canvas.getContext('2d');
    if (!art) return false;
    art.translate(radius * 4, radius * 4);
    art.scale(4, 4);
    draw(art, phase);
    return true;
  }

  function sprite(ctx, cache, key, radius, draw, phase) {
    if (typeof OffscreenCanvas !== 'function') {
      draw(ctx, phase);
      return;
    }
    if (!cache.has(key)) {
      const canvas = new OffscreenCanvas(radius * 8, radius * 8);
      cache.set(key, renderSprite(canvas, radius, draw, phase) ? canvas : null);
    }
    const canvas = cache.get(key);
    if (canvas) ctx.drawImage(canvas, -radius, -radius, radius * 2, radius * 2);
    else draw(ctx, phase);
  }

  function drawGear(ctx, id, x, y, scale = 1, angle = 0) {
    id = artId(id);
    if (!Object.hasOwn(silhouettes, id)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, Math.cos(angle) < 0 ? -scale : scale);
    sprite(ctx, gearSprites, id, 38, silhouettes[id]);
    ctx.restore();
    return true;
  }

  function drawCreature(ctx, id, draw, x, y, scale, angle, phase) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, Math.cos(angle) < 0 ? -scale : scale);
    const frame = Math.floor((phase - Math.floor(phase)) * framesPerStride);
    sprite(ctx, creatureSprites, id + frame, 23, draw, frame / framesPerStride);
    ctx.restore();
  }

  function drawCat(ctx, x, y, scale = 1, angle = 0, phase = 0) {
    drawCreature(ctx, 'cat', drawCatFrame, x, y, scale, angle, phase);
  }

  function drawCatFrame(ctx, phase) {
    const stride = Math.sin(phase * Math.PI * 2) * 3;
    const tail = Math.cos(phase * Math.PI * 2) * 1.5;
    line(ctx, cat.ink, 3.6, -9, 1, -14, -2, -16, -7 + tail, -13, -9 + tail);
    line(ctx, cat.light, 1.7, -9, 1, -14, -2, -16, -7 + tail, -13, -9 + tail);
    line(ctx, cat.ink, 3.6, -8, 4, -10 + stride, 8, -12 + stride, 8, -8, 5, 3, 4, 5 - stride, 8, 8 - stride, 8);
    line(ctx, cat.seam, 1.8, -8, 4, -10 + stride, 8, -12 + stride, 8, -8, 5, 3, 4, 5 - stride, 8, 8 - stride, 8);
    outline(ctx, cat.light, cat.ink, -12, 0, -8, -4, 3, -5, 6, -1, 4, 4, -1, 6, -9, 5);
    polygon(ctx, cat.pale, -8, 2, 2, 1, 4, -1, 5, 2, 1, 5, -6, 5);
    line(ctx, cat.mid, 1.45, -7, -3, -6, 0);
    line(ctx, cat.mid, 1.45, -3, -4, -2, -1);
    outline(ctx, cat.light, cat.ink, 2, -5, 3, -11, 7, -8, 10, -8, 13, -11, 14, -5, 16, -1, 14, 3, 8, 4, 3, 1);
    polygon(ctx, cat.seam, 4, -9, 6, -7, 4, -6);
    polygon(ctx, cat.seam, 12, -9, 13, -6, 10.8, -7);
    box(ctx, cat.ink, 10, -4.5, 2, 2);
    box(ctx, '#fbffe9', 10.4, -4.4, .9, .9);
    polygon(ctx, cat.pale, 8, -.8, 14, -2, 15, 0, 13, 2, 9, 2.3);
    box(ctx, cat.hot, 13.5, -.9, 1.7, 1);
    line(ctx, cat.ink, .85, 12, .8, 14, 1.3, 15.8, .9);
  }

  function drawUnicorn(ctx, x, y, scale = 1, angle = 0, phase = 0) {
    drawCreature(ctx, 'unicorn', drawUnicornFrame, x, y, scale, angle, phase);
  }

  function drawUnicornFrame(ctx, phase) {
    const stride = Math.sin(phase * Math.PI * 2) * 3;
    const tail = Math.cos(phase * Math.PI * 2) * 1.5;
    line(ctx, prism.ink, 3.7, -7, 3, -9 + stride, 8, -13 + stride, 9, -8, 5, 4, 3, 5 - stride, 8, 9 - stride, 8);
    line(ctx, prism.light, 1.9, -7, 3, -9 + stride, 8, -13 + stride, 9, -8, 5, 4, 3, 5 - stride, 8, 9 - stride, 8);
    outline(ctx, '#aa92f0', prism.ink, -11, -3, -16, -4, -18, -1 + tail, -21, 1 + tail, -18, 3 + tail, -14, 2, -10, 0);
    line(ctx, '#f9a1e1', 1.4, -11, -1, -16, 0, -19, 2 + tail);
    outline(ctx, prism.pale, prism.ink, -13, -1, -9, -4, 2, -4, 6, -8, 13, -7, 17, -4, 15, 1, 9, 1, 6, 5, -9, 6);
    polygon(ctx, prism.light, -12, 2, -6, 2, 2, 1, 6, -1, 6, 4, -1, 5, -8, 5);
    polygon(ctx, '#b48dff', 2, -2, 4, -7, 8, -11, 12, -9, 11, -7, 7, -7, 6, -3, 4, 0);
    line(ctx, '#f3a0de', 1.2, 3, -2, 5, -7, 9, -10, 11, -9);
    outline(ctx, prism.glow, prism.ink, 12, -8, 21, -13, 17, -6, 14, -5);
    line(ctx, prism.seam, .9, 14.6, -8.5, 16.3, -6.5);
    line(ctx, prism.seam, .9, 17, -10, 18.3, -8.7);
    box(ctx, prism.ink, 12, -5, 1.9, 1.9);
    box(ctx, prism.hot, 12.5, -4.7, .7, .7);
    box(ctx, prism.mid, 15.2, -1.8, 1.6, .9);
  }

  function drawCatSpawner(ctx, x, y, scale = 1, phase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    oval(ctx, '#211423', 0, 2, 23, 16);
    ctx.strokeStyle = '#f7aa68';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * (.40 + .30 * Math.sin(phase * Math.PI * 2));
    oval(ctx, cat.hot, 0, 3, 19, 12);
    ctx.globalAlpha = alpha;
    drawGear(ctx, 'catSpawner', 0, -4, .73);
    star(ctx, -18, -10, 2.5, cat.pale);
    star(ctx, 18, -10, 2.5, cat.pale);
    ctx.restore();
  }

  function drawBeam(ctx, x1, y1, x2, y2, width, strength = 1) {
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    const length = Math.hypot(x2 - x1, y2 - y1);
    const alpha = ctx.globalAlpha * strength;
    ctx.globalAlpha = alpha * .24;
    box(ctx, '#aa87ff', 0, -width * 1.15, length, width * 2.3);
    ctx.globalAlpha = alpha * .44;
    box(ctx, '#cfa6ff', 0, -width * .76, length, width * 1.52);
    ctx.globalAlpha = alpha;
    const band = width / rainbow.length;
    for (let i = 0; i < rainbow.length; i++) box(ctx, rainbow[i], 0, -.5 * width + i * band, length, band + .23);
    ctx.globalAlpha = alpha * .72;
    box(ctx, '#fff9fb', 0, -width * .11, length, width * .22);
    star(ctx, length, 0, width * .89, '#fff6e8');
    ctx.restore();
  }

  function sweepBand(ctx, radius, backRadius, start, finish, fill) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, start, finish);
    ctx.arc(0, 0, backRadius, finish, start, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawSweep(ctx, x, y, angle, radius, halfAngle, progress) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const alpha = ctx.globalAlpha * (1 - Math.min(.92, progress));
    const tip = -halfAngle + halfAngle * 2 * Math.min(1, .58 + progress);
    ctx.globalAlpha = alpha * .42;
    sweepBand(ctx, radius, radius * .48, -halfAngle, tip, '#f056aa');
    ctx.globalAlpha = alpha * .78;
    sweepBand(ctx, radius * .97, radius * .80, -halfAngle * .92, tip, '#ff91c1');
    ctx.globalAlpha = alpha;
    sweepBand(ctx, radius * .98, radius * .93, -halfAngle * .66, tip, '#fff4c8');
    line(ctx, '#ffb9d2', 1.5, Math.cos(tip) * radius * .63, Math.sin(tip) * radius * .63,
      Math.cos(tip) * radius, Math.sin(tip) * radius);
    star(ctx, Math.cos(tip) * radius * .94, Math.sin(tip) * radius * .94, radius * .135, '#fff4ea');
    ctx.restore();
  }

  function drawBlast(ctx, x, y, radius, progress) {
    ctx.save();
    ctx.translate(x, y);
    const alpha = ctx.globalAlpha * (1 - progress);
    const size = radius * (.16 + Math.sqrt(progress) * .84);
    ctx.globalAlpha = alpha * .28;
    oval(ctx, '#d4a9ff', 0, 0, size * .95, size * .95);
    ctx.globalAlpha = alpha;
    for (let i = 0; i < rainbow.length; i++) {
      const start = i * Math.PI / 3 + progress;
      sweepBand(ctx, size, size * .78, start, start + Math.PI / 3 + .035, rainbow[i]);
      const spark = start + .22;
      const distance = size * (1.05 + (i % 2) * .13);
      star(ctx, Math.cos(spark) * distance, Math.sin(spark) * distance, size * .13, rainbow[i]);
      star(ctx, Math.cos(spark + .48) * size * .56, Math.sin(spark + .48) * size * .56, size * .09, '#fff4ec');
    }
    ctx.globalAlpha = alpha * alpha;
    star(ctx, 0, 0, size * .51, '#fffbe5');
    ctx.restore();
  }

  function drawSniperBolt(ctx, x, y, angle, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(radius / 4, radius / 4);
    polygon(ctx, '#a29aff', -31, 0, -9, -3, 6, -4, 12, 0, 4, 4, -9, 3);
    polygon(ctx, '#bdfcfd', -24, 0, -8, -1.5, 5, -3, 12, 0, 3, 2.7);
    outline(ctx, '#fff3b2', '#b67dbd', -3, -3, 13, 0, -3, 3, 0, 0);
    line(ctx, '#fffef4', 1.05, -2, -1.4, 9, -.2);
    ctx.restore();
  }

  function drawRainbowShell(ctx, x, y, angle, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(radius / 5, radius / 5);
    polygon(ctx, '#a299ff', -18, 0, -7, -3, -.5, -4, -.5, 4, -7, 3);
    outline(ctx, prism.dark, prism.ink, -7, -4, -3, -6, 2, -6, 7, -3, 8, 0, 6, 4, 2, 6, -5, 6, -8, 3);
    stripeRail(ctx, -5.5, -4.2, 8.4, 1.6);
    polygon(ctx, prism.glow, 4, -4, 7, -2, 8, 0, 6, 3, 4, 3);
    line(ctx, '#fff', .9, -5, -4, 2, -4, 5, -2.7);
    ctx.restore();
  }

  globalThis.CinderCreatureArt = Object.freeze({
    artId, drawGear, drawCat, drawUnicorn, drawCatSpawner, drawBeam, drawSweep, drawBlast,
    drawSniperBolt, drawRainbowShell
  });
})();
