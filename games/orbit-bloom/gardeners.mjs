import { drawGardener } from './pixel-art.mjs';

const atlas = new Image();
atlas.src = new URL('./assets/gardeners-painted.webp', import.meta.url).href;
const cellWidth = 96;
const cellHeight = 128;
const stride = [1, 0, 2, 0];

export function drawPaintedGardener(ctx, x, y, height, time, options = {}) {
  if (atlas.naturalWidth !== cellWidth * 6 || atlas.naturalHeight !== cellHeight * 4) {
    drawGardener(ctx, x, y, height, time, options);
    return;
  }
  const { index = 0, moving = false, facing = 1, carrying = false, effects = true } = options;
  const step = effects && moving ? Math.floor(time * 10 + index * .8) % stride.length : 0;
  const frame = (effects && moving ? stride[step] : 0) + (carrying ? 3 : 0);
  const width = height * cellWidth / cellHeight;
  const lift = effects && moving && (step === 0 || step === 2) ? 1.4 : 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing < 0 ? -1 : 1, 1);
  ctx.fillStyle = '#16142680';
  ctx.beginPath();
  ctx.ellipse(0, -2, height * .24, height * .075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(atlas, frame * cellWidth, index % 4 * cellHeight, cellWidth, cellHeight,
    -width / 2, -height - lift, width, height);
  ctx.restore();
}
