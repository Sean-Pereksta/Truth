const floorStyles = {
  dawn: [0, '#87938a', '#9ca299', '#52726d'], moon: [4, '#777d9c', '#898eaa', '#626180'],
  comet: [4, '#85758d', '#9b889b', '#726683'], dune: [2, '#a99079', '#bda88d', '#8e7259'],
  meteor: [2, '#977a70', '#a6887a', '#835d53'], nebula: [5, '#92819d', '#ad96ad', '#786783'],
  frost: [0, '#889da8', '#a3b3b9', '#52727f'], aurora: [3, '#789988', '#91ab9e', '#4b7b73'],
  eclipse: [4, '#786d87', '#908299', '#665b76'], midnight: [4, '#676f8e', '#8087a2', '#5b6683'],
  pollenworks: [1, '#9a896e', '#a99a81', '#766858'], tidalglass: [3, '#659a99', '#83aaaa', '#4d7d87'],
  switchyard: [2, '#a08277', '#b29a8f', '#755e72'], drawbridge: [4, '#798ca7', '#8b9cb4', '#596e91'],
  saturn: [4, '#766f93', '#8d83a5', '#5e5680'],
};

let sheet;
if (typeof Image !== 'undefined') {
  sheet = new Image();
  sheet.src = new URL('./assets/interior-tiles.webp', import.meta.url).href;
}

export function paintedFloorReady() {
  return Boolean(sheet?.naturalWidth && sheet?.naturalHeight);
}

export function drawPaintedFloor(ctx, map, tile) {
  const [index, base, light, accent] = floorStyles[map.theme] ?? floorStyles.dawn;
  const texture = paintedFloorReady();
  const w = texture ? sheet.naturalWidth / 3 : 0;
  const h = texture ? sheet.naturalHeight / 2 : 0;
  const width = map.width * tile;
  const height = map.height * tile;
  const unit = tile / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#474650';
  ctx.fillRect(0, 0, width, height);
  for (let row = 0; row < map.height * 2; row++) {
    for (let column = 0; column < map.width * 2; column++) {
      const x = column * unit;
      const y = row * unit;
      const nearRim = row < 2 || column === 0 || column === map.width * 2 - 1;
      const ground = map.layout[Math.floor(row / 2)][Math.floor(column / 2)];
      const alternating = (row + column) % 2;
      const tileColor = ground === '~' ? '#527c93' : ground === '+' || nearRim ? accent : alternating ? base : light;
      if (texture) {
        const face = ground === '~' ? 3 : nearRim ? 4 : ground === '+' ? 1 : index;
        ctx.drawImage(sheet, face % 3 * w + 1, Math.floor(face / 3) * h + 1, w - 2, h - 2,
          x + .6, y + .6, unit - 1.2, unit - 1.2);
      }
      ctx.fillStyle = texture ? `${tileColor}${nearRim ? '48' : alternating ? '46' : '2e'}` : tileColor;
      ctx.fillRect(x + 1.3, y + 1.3, unit - 2.6, unit - 2.6);
      if (ground === '~') {
        ctx.fillStyle = '#d0e8ef6b';
        ctx.fillRect(x + 5, y + 7, 6, .8);
        ctx.fillRect(x + 11, y + 13, 8, .8);
      }
    }
  }
  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, '#382c4860');
  edge.addColorStop(.26, '#fff3cb16');
  edge.addColorStop(.73, '#2117290b');
  edge.addColorStop(1, '#24203444');
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
  if (paintedFloorReady()) {
    const w = sheet.naturalWidth / 3;
    const h = sheet.naturalHeight / 2;
    const source = stone ? 4 : space ? 4 : 3;
    ctx.globalAlpha = stone ? .33 : .2;
    ctx.drawImage(sheet, source % 3 * w + w * .12, Math.floor(source / 3) * h + h * .1,
      w * .76, h * .8, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
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
