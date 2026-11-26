const floorStyles = {
  dawn: [0, '#28433d'], moon: [3, '#36395e'], comet: [3, '#463b5e'], dune: [2, '#62443b'],
  meteor: [2, '#533937'], nebula: [5, '#533e63'], frost: [1, '#344e62'], aurora: [1, '#28534c'],
  eclipse: [4, '#49405a'], midnight: [4, '#313652'], pollenworks: [0, '#554842'],
  tidalglass: [1, '#245055'], switchyard: [2, '#523e4d'], drawbridge: [3, '#373b62'], saturn: [4, '#383256'],
};

let sheet;
if (typeof Image !== 'undefined') {
  sheet = new Image();
  sheet.src = new URL('./assets/painted-floors.webp', import.meta.url).href;
}

export function paintedFloorReady() {
  return Boolean(sheet?.naturalWidth && sheet?.naturalHeight);
}

export function drawPaintedFloor(ctx, map, tile) {
  if (!paintedFloorReady()) return;
  const [index, tint] = floorStyles[map.theme] ?? floorStyles.dawn;
  const w = sheet.naturalWidth / 3;
  const h = sheet.naturalHeight / 2;
  const width = map.width * tile;
  const height = map.height * tile;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sheet, index % 3 * w + 1, Math.floor(index / 3) * h + 1, w - 2, h - 2, 0, 0, width, height);
  ctx.fillStyle = `${tint}93`;
  ctx.fillRect(0, 0, width, height);
  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, '#fff4d02a');
  edge.addColorStop(.43, '#ffe6c103');
  edge.addColorStop(1, '#17172f64');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawWaterChannel(ctx, map, tile, time, effects) {
  if (!['tidalglass', 'drawbridge', 'saturn', 'switchyard'].includes(map.theme)) return;
  const width = map.width * tile;
  const height = map.height * tile;
  const stone = map.theme === 'switchyard';
  const space = map.theme === 'saturn';
  ctx.save();
  ctx.beginPath();
  for (const [y, row] of map.layout.entries()) {
    for (const [x, cell] of [...row].entries()) {
      const channel = stone ? x === 5 : space ? x === 3 || x === 7 : x >= 4 && x <= 6;
      if (cell === '#' && channel) ctx.rect(x * tile, y * tile, tile, tile);
    }
  }
  ctx.clip();
  const water = ctx.createLinearGradient(width * .42, 0, width * .62, height);
  water.addColorStop(0, stone ? '#412f49' : space ? '#262040' : '#22465c');
  water.addColorStop(.36, stone ? '#6c4d61' : space ? '#4c3968' : '#3b7282');
  water.addColorStop(1, stone ? '#342b49' : space ? '#22243e' : '#263c5a');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);
  const tick = effects ? time : 0;
  for (let n = 0; n < 84; n++) {
    const x = (n * 79 + n * n * 7) % width;
    const y = ((n * 47 + n * n * 5) % height + tick * (stone ? 0 : 2.8)) % height;
    ctx.strokeStyle = stone ? '#cda08b26' : space ? '#d9cbee59' : '#b4f0eb43';
    ctx.lineWidth = n % 4 ? .8 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3, y + (space ? 0 : 2.5), x + (space ? 1.5 : 7 + n % 9), y);
    ctx.stroke();
  }
  ctx.restore();
}
