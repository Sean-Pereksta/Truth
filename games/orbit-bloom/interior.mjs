const materials = {
  walnut: ['#e2ae7a', '#af795d', '#785267', '#47384e', '#9e6454', '#edc68c'],
  ash: ['#bbc2b3', '#8f999c', '#626d86', '#3e425c', '#707f94', '#ddd9bb'],
  copper: ['#edb37b', '#b87968', '#7b5064', '#432f4b', '#a8685b', '#ffd2a3'],
  jade: ['#bbd1a5', '#87a391', '#527c82', '#344a60', '#66958c', '#deecb2'],
  heather: ['#d2aab7', '#a27b9a', '#775c87', '#4b405f', '#896d96', '#eac5c3'],
};
const roomMaterial = {
  dawn: 'walnut', moon: 'ash', comet: 'heather', dune: 'walnut', meteor: 'copper',
  nebula: 'heather', frost: 'ash', aurora: 'jade', eclipse: 'copper', midnight: 'heather',
  pollenworks: 'walnut', tidalglass: 'jade', switchyard: 'copper', drawbridge: 'ash', saturn: 'jade',
};
const roomLeaves = {
  dawn: ['#496a65', '#699b75', '#93ad74'], moon: ['#465d7b', '#6f91a0', '#a1b5b2'],
  comet: ['#4c6273', '#6a9b88', '#a8c499'], dune: ['#62685b', '#8f9c68', '#bbc07d'],
  meteor: ['#5e536c', '#886a82', '#c28c95'], nebula: ['#585b80', '#856eab', '#b897c1'],
  frost: ['#4d7787', '#78a9ad', '#a7c9c1'], aurora: ['#496f78', '#649d92', '#a4d2ac'],
  eclipse: ['#5b506d', '#89698a', '#bd879c'], midnight: ['#555e80', '#777db1', '#a8a8c9'],
  pollenworks: ['#63705b', '#93a46c', '#c2c67f'], tidalglass: ['#497585', '#629b9d', '#a0c9b7'],
  switchyard: ['#5c5473', '#8a7197', '#bd9aaf'], drawbridge: ['#546181', '#7a85a6', '#aeb9cc'],
  saturn: ['#4d6679', '#6b949c', '#9cccc0'],
};
const materialFor = theme => materials[roomMaterial[theme]] ?? materials.walnut;
const textures = { worktop: 0, cabinet: 1, wall: 2, trim: 3, dock: 4, stone: 5 };
const materialAtlas = typeof Image === 'undefined' ? null : new Image();
if (materialAtlas) materialAtlas.src = new URL('./assets/interior-materials.webp', import.meta.url).href;

export function interiorArtReady() {
  const width = materialAtlas?.naturalWidth ?? 0;
  const height = materialAtlas?.naturalHeight ?? 0;
  return width > 0 && height > 0 && width % 3 === 0 && height % 2 === 0;
}

export function texture(ctx, kind, x, y, width, height, { radius = 0, opacity = .83, fragment, vertical = false } = {}) {
  if (!interiorArtReady() || width <= 0 || height <= 0) return false;
  const frame = textures[kind];
  const cellWidth = materialAtlas.naturalWidth / 3;
  const cellHeight = materialAtlas.naturalHeight / 2;
  const column = frame % 3;
  const row = Math.floor(frame / 3);
  const crop = 2;
  const start = cellWidth * column + crop;
  const top = cellHeight * row + crop;
  const sourceWidth = cellWidth - crop * 2;
  const sourceHeight = cellHeight - crop * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
  ctx.globalAlpha *= opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (vertical) {
    ctx.translate(x + width, y);
    ctx.rotate(Math.PI * .5);
    ctx.drawImage(materialAtlas, start, top, sourceWidth, sourceHeight, 0, 0, height, width);
  } else if (Number.isFinite(fragment)) {
    const fraction = sourceWidth / 3;
    ctx.drawImage(materialAtlas, start + fraction * fragment, top, fraction, sourceHeight, x, y, width, height);
  } else {
    ctx.drawImage(materialAtlas, start, top, sourceWidth, sourceHeight, x, y, width, height);
  }
  ctx.restore();
  return true;
}

function rect(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function rounded(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function blend(ctx, from, to, colors) {
  const gradient = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
  for (const [stop, color] of colors) gradient.addColorStop(stop, color);
  return gradient;
}

function stroke(ctx, color, width, fromX, fromY, toX, toY) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function forWindows(map, tile, crossing, paint) {
  for (let x = 1; x < map.width - 1; x++) {
    if (channelAt(map.theme, x) || map.layout[0][x] === '#' || crossing?.has(`${x}:0`)) continue;
    paint(3 + x * tile, 5 - tile * .83, tile - 6, tile * .54);
  }
}

function windowFrame(ctx, x, y, width, height, material, paintedTrim = false) {
  const [light, mid, dark, inset, , metal] = material;
  const center = x + width * .5;
  ctx.save();
  ctx.lineWidth = 2;
  rounded(ctx, x - 1, y - 1, width + 2, height + 2, 4, undefined, inset);
  ctx.lineWidth = 1;
  rounded(ctx, x, y, width, height, 3, undefined, mid);
  stroke(ctx, inset, 2.8, center, y, center, y + height);
  stroke(ctx, light, .7, center - .7, y + 1, center - .7, y + height - 1);
  stroke(ctx, dark, 1.4, x + 1, y + height * .6, x + width - 1, y + height * .6);
  rounded(ctx, x - 1, y + height - .5, width + 2, 3.4, 1, light, dark);
  if (paintedTrim) texture(ctx, 'trim', x - .3, y + height + .3, width + .6, 2.2, { radius: 1, opacity: .86 });
  stroke(ctx, metal, .6, x + 1, y + height - .1, x + width - 1, y + height - .1);
  ctx.fillStyle = '#e9eee324';
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + width * .4, y + 3);
  ctx.lineTo(x + 3, y + height * .78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function wallPillar(ctx, x, y, height, width, material) {
  const [light, mid, dark, inset, , metal] = material;
  const face = blend(ctx, [x, y], [x + width, y], [[0, inset], [.32, mid], [.7, dark], [1, inset]]);
  rect(ctx, face, x, y, width, height);
  texture(ctx, 'stone', x, y, width, height, { opacity: .82 });
  rect(ctx, `${light}ad`, x + width * .3, y + 1, 1, height - 1);
  for (const capY of [y, y + height - 4]) {
    rounded(ctx, x - .5, capY, width + 1, 4, 1.5, dark, inset);
    texture(ctx, 'trim', x + .2, capY + .3, width - .4, 3, { radius: 1, opacity: .55 });
    rect(ctx, metal, x + 1, capY + .6, width - 2, .7);
  }
}

function integratedBed(ctx, x, y, length, sides, material, theme, accent, seed) {
  const [light, mid, dark, inset, , metal] = material;
  const [plantDark, leaf, fresh] = roomLeaves[theme] ?? roomLeaves.dawn;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sides, 1);
  rounded(ctx, 0, 4, 11, length + 2, 3, '#24233572');
  rounded(ctx, 0, 0, 9, length, 3, dark, inset);
  rounded(ctx, 2, 2, 6, length - 5, 2, '#322d42', mid);
  stroke(ctx, light, .7, .7, 3, .7, length - 4);
  stroke(ctx, metal, .65, 7.8, 4, 7.8, length - 5);
  for (let pos = 5; pos < length - 2; pos += 5.5) {
    const posKey = Math.round(pos * 2) + seed;
    const spread = 4 + posKey % 3;
    stroke(ctx, plantDark, 1.3, 3, pos, 7 + spread, pos - 2.4);
    for (const [cx, cy, width, angle, color] of [
      [4.5, pos - 2.5, 3.8, -.77, plantDark],
      [6.5, pos + 1, 4.8, .55, leaf],
      [spread + 3.5, pos - 3.2, 4.2, -.43, fresh],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, width, 1.6, angle, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (posKey % 5 === 0) {
      ctx.beginPath();
      ctx.arc(9, pos, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }
  }
  ctx.restore();
}

function dispatchBay(ctx, map, station, tile, material, accent) {
  const [light, mid, dark, inset, door, metal] = material;
  const x = (station.x + .5) * tile;
  const y = station.y * tile;
  const row = map.layout[station.y];
  const spareLeft = row[station.x - 1] === '.' ? tile * .48 : tile * .04;
  const spareRight = row[station.x + 1] === '.' ? tile * .48 : tile * .04;
  const left = x - tile * .46 - spareLeft;
  const width = tile * .92 + spareLeft + spareRight;
  const lane = blend(ctx, [left, y], [left + width, y], [[0, dark], [.24, mid], [.54, light], [.87, mid], [1, dark]]);
  ctx.save();
  ctx.lineWidth = 2;
  rounded(ctx, left - 1, y + 3, width + 2, tile - 3, 6, inset, '#272237');
  rounded(ctx, left + 2, y + 6, width - 4, tile - 9, 5, lane, mid);
  texture(ctx, 'dock', left + 2, y + 6, width - 4, tile - 9, { radius: 5, opacity: .87 });
  for (let plank = 0; plank < 5; plank++) {
    const edge = left + 8 + plank * (width - 16) / 4;
    stroke(ctx, `${inset}72`, .8, edge, y + 8, edge, y + tile - 6);
    stroke(ctx, `${light}83`, .55, edge + 1, y + 9, edge + 1, y + tile - 7);
  }
  for (const post of [left + 3.5, left + width - 3.5]) {
    rounded(ctx, post - 2, y + 8, 4, tile - 11, 2, dark, inset);
    texture(ctx, 'trim', post - 1.7, y + 9, 3.4, tile - 13, { radius: 1.6, opacity: .76, vertical: true });
    rect(ctx, `${light}b0`, post - .8, y + 10, .8, tile - 18);
    rounded(ctx, post - 3, y + 7, 6, 5, 1.7, door, inset);
    rect(ctx, accent, post - 1.2, y + 8.6, 2.4, 1);
  }
  rounded(ctx, x - 12, y + 4, 24, 8, 2.2, dark, inset);
  stroke(ctx, metal, 1.15, x - 8, y + 8, x + 6, y + 8);
  stroke(ctx, metal, 1.15, x + 2, y + 5.8, x + 6, y + 8);
  stroke(ctx, metal, 1.15, x + 2, y + 10.2, x + 6, y + 8);
  ctx.restore();
}

function approachTile(ctx, x, y, tile, material, end) {
  const [, mid, dark, inset] = material;
  const left = x - tile * .28;
  const right = x + tile * .28;
  rect(ctx, `${inset}3a`, left, y, right - left, tile);
  const up = end ? 4 : 0;
  for (const side of [-1, 1]) {
    const edge = x + side * tile * .27;
    stroke(ctx, `${dark}b5`, 1.1, edge, y + up, edge, y + tile);
    stroke(ctx, `${mid}86`, .65, edge - side * 2, y + up, edge - side * 2, y + tile);
  }
  const middle = y + tile * .51;
  stroke(ctx, `${mid}75`, 1.4, x - 5, middle - 2, x, middle + 2);
  stroke(ctx, `${mid}75`, 1.4, x, middle + 2, x + 5, middle - 2);
}

export function drawDispatchApron(ctx, map, tile, themeColor = '#ead4ad') {
  const material = materialFor(map.theme);
  const [light, mid, dark, inset, , metal] = material;
  ctx.save();
  for (const station of map.stations) {
    if (station.type !== 'truck' || station.y !== map.height - 1) continue;
    const x = (station.x + .5) * tile;
    const y = map.height * tile;
    const width = tile * 1.56;
    const height = tile * .57;
    const left = Math.max(2, Math.min(x - width / 2, map.width * tile - width - 2));
    const finish = blend(ctx, [left, y], [left, y + height], [[0, mid], [.25, light], [.8, dark], [1, inset]]);
    ctx.lineWidth = 1.3;
    rounded(ctx, left - 3, y - 3, width + 6, height + 8, [0, 0, 8, 8], '#28213970');
    rounded(ctx, left, y - 4, width, height + 4, [0, 0, 6, 6], finish, inset);
    texture(ctx, 'dock', left + 2, y - 3, width - 4, height + 2, { radius: [0, 0, 5, 5], opacity: .93 });
    for (const rail of [left + 4, left + width - 6]) {
      rect(ctx, dark, rail, y - 2, 3, height - 2);
      texture(ctx, 'trim', rail, y - 2, 3, height - 2, { opacity: .82, vertical: true });
      rounded(ctx, rail - .75, y + height - 8, 4.5, 5.5, 1, dark, inset);
      rect(ctx, themeColor, rail + .2, y + height - 6.5, 2.6, 1);
    }
    stroke(ctx, metal, 1.15, left + 6, y + height - 1, left + width - 6, y + height - 1);
    stroke(ctx, `${metal}b0`, 1, left + 7, y + .2, left + width - 7, y + .2);
  }
  ctx.restore();
}

function channelAt(theme, x) {
  if (theme === 'tidalglass' || theme === 'drawbridge') return x >= 4 && x <= 6;
  if (theme === 'saturn') return x === 3 || x === 7;
  return theme === 'switchyard' && x === 5;
}

function wallPartition(ctx, x, y, tile, material, joined, accent) {
  const [light, mid, dark, inset, door, metal] = material;
  const top = joined.north ? y : y + 5;
  const bottom = y + tile - (joined.south ? 0 : 3);
  const face = blend(ctx, [x, top], [x + tile, top], [[0, inset], [.13, dark], [.5, mid], [.86, dark], [1, inset]]);
  ctx.save();
  ctx.lineWidth = 1.3;
  rounded(ctx, x + 3, top, tile - 6, bottom - top, [joined.north ? 0 : 4, joined.north ? 0 : 4, joined.south ? 0 : 4, joined.south ? 0 : 4], face);
  texture(ctx, 'stone', x + 4, top + 1, tile - 8, bottom - top - 2, { radius: 3, opacity: .88 });
  rounded(ctx, x + 7, top + 4, tile - 14, bottom - top - 8, 3, door, inset);
  rounded(ctx, x + 9, top + 6, tile - 18, bottom - top - 12, 2, dark, mid);
  texture(ctx, 'cabinet', x + 10, top + 7, tile - 20, bottom - top - 14, { radius: 2, opacity: .82 });
  for (const gx of [x + 11, x + tile - 11]) rect(ctx, `${light}75`, gx, top + 7, 1, bottom - top - 14);
  if (!joined.north) {
    rounded(ctx, x + 3, top, tile - 6, 6, [3, 3, 1, 1], mid, inset);
    rect(ctx, light, x + 6, top + 1.1, tile - 12, .85);
  }
  if (!joined.south) {
    rect(ctx, inset, x + 3, bottom - 4, tile - 6, 4);
    rect(ctx, light, x + 5, bottom - 4.5, tile - 10, .8);
  }
  rounded(ctx, x + tile * .39, top + (bottom - top) * .49, tile * .22, 3, 1.5, metal, inset);
  rect(ctx, accent, x + tile * .48, top + (bottom - top) * .49 + 1, tile * .04, 1);
  ctx.restore();
}

export function drawInterior(ctx, map, tile, themeColor = '#ead4ad', crossing) {
  const material = materialFor(map.theme);
  const [light, mid, dark, inset] = material;
  const width = map.width * tile;
  const height = map.height * tile;
  const sill = tile * .77;
  const back = -tile * .83;
  const wall = blend(ctx, [0, 0], [0, sill + 6], [[0, inset], [.16, dark], [.66, mid], [.84, dark], [1, inset]]);
  const glass = blend(ctx, [0, back + 5], [0, back + 5 + tile * .54], [[0, '#536479'], [.48, '#8796ab'], [1, '#a49b9e']]);
  ctx.save();
  const sides = new Set();
  for (let column = 0; column < map.width;) {
    if (channelAt(map.theme, column)) { column++; continue; }
    const start = column++;
    while (column < map.width && !channelAt(map.theme, column)) column++;
    const x = start * tile;
    const span = (column - start) * tile;
    sides.add(x + 1);
    sides.add(x + span - 8);
    ctx.save();
    ctx.translate(x, back);
    rounded(ctx, 0, 0, span, sill + 9, 5, '#24233658');
    rounded(ctx, 0, 0, span, sill + 3, 5, wall);
    for (let left = 0; left < span; left += tile) {
      texture(ctx, 'wall', left, 0, tile, sill + 2, { opacity: .86, fragment: Math.round(left / tile) % 3 });
    }
    rect(ctx, `${light}75`, 0, sill - 1, span, 1);
    rect(ctx, inset, 0, sill + 2, span, 1.5);
    ctx.restore();
  }
  const base = blend(ctx, [0, 0], [11, 0], [[0, inset], [.42, dark], [.56, mid], [1, inset]]);
  rect(ctx, base, 0, 0, 9, height);
  texture(ctx, 'trim', 1, 0, 6, height, { opacity: .85, vertical: true });
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  rect(ctx, base, 0, 0, 9, height);
  texture(ctx, 'trim', 1, 0, 6, height, { opacity: .85, vertical: true });
  ctx.restore();
  rect(ctx, inset, 0, height - 5, width, 5);
  texture(ctx, 'trim', 1, height - 4, width - 2, 3, { opacity: .78 });
  rect(ctx, `${light}75`, 0, height - 5, width, 1);
  forWindows(map, tile, crossing, (x, y, w, h) => {
    rounded(ctx, x, y, w, h, 3, glass);
    windowFrame(ctx, x, y, w, h, material, true);
  });
  for (const x of sides) wallPillar(ctx, x, back + 2, sill + 3, 7, material);
  for (let row = 1; row < map.height - 1; row++) {
    const y = row * tile + tile * .1;
    if (row % 2 === 1) {
      if (map.layout[row][0] === '.' && !crossing?.has(`0:${row}`)) {
        integratedBed(ctx, 5, y, tile * .62, 1, material, map.theme, themeColor, row);
      }
      if (map.layout[row][map.width - 1] === '.' && !crossing?.has(`${map.width - 1}:${row}`)) {
        integratedBed(ctx, width - 5, y, tile * .62, -1, material, map.theme, themeColor, row + 4);
      }
    } else {
      for (const x of [2, width - 7]) wallPillar(ctx, x, y + 4, tile * .38, 5, material);
    }
  }
  for (const [y, row] of map.layout.entries()) {
    for (const [x, cell] of [...row].entries()) {
      if (cell !== '#' || channelAt(map.theme, x) || crossing?.has(`${x}:${y}`)) continue;
      wallPartition(ctx, x * tile, y * tile, tile, material,
        { north: map.layout[y - 1]?.[x] === '#', south: map.layout[y + 1]?.[x] === '#' }, themeColor);
    }
  }
  for (const station of map.stations) {
    if (station.type !== 'truck') continue;
    for (let offset = 1; offset <= 2; offset++) {
      const y = station.y - offset;
      if (map.layout[y]?.[station.x] !== '.' || crossing?.has(`${station.x}:${y}`)) break;
      approachTile(ctx, (station.x + .5) * tile, y * tile, tile, material, offset === 2);
    }
    dispatchBay(ctx, map, station, tile, material, themeColor);
  }
  ctx.restore();
}

export function drawInteriorWindows(ctx, map, tile, atmosphere, crossing) {
  const material = materialFor(map.theme);
  const roomWidth = map.width * tile;
  forWindows(map, tile, crossing, (x, y, width, height) => {
    const filled = atmosphere.drawWindowView(ctx, { x, y, width, height, position: x / roomWidth, span: width / roomWidth });
    if (filled) windowFrame(ctx, x, y, width, height, material);
  });
}

function gatherCounters(map, tile) {
  const cells = new Map();
  for (const station of map.stations) {
    if (station.type !== 'truck') cells.set(`${station.x}:${station.y}`, station);
  }
  for (const [y, row] of map.layout.entries()) {
    for (const [x, cell] of [...row].entries()) if (cell === '-') cells.set(`${x}:${y}`, { x, y, type: 'worktop' });
  }
  return [...cells.values()].map(({ x, y, type }) => {
    const west = cells.has(`${x - 1}:${y}`);
    const east = cells.has(`${x + 1}:${y}`);
    const north = cells.has(`${x}:${y - 1}`);
    const south = cells.has(`${x}:${y + 1}`);
    return { x, y, type, west, east, north, south,
      left: x * tile + (west ? 0 : 3), right: (x + 1) * tile - (east ? 0 : 3),
      back: y * tile + (north ? 0 : tile * .22), front: y * tile + tile * (south ? 1 : .93),
      edge: y * tile + tile * (south ? 1 : .73),
    };
  });
}

function counterJoinery(ctx, cell, material, accent) {
  const [light, mid, dark, inset, wood, metal] = material;
  const { left, right, back, front, edge, north, south, east, west, x, y, type } = cell;
  const width = right - left;
  const upperCorners = [north || west ? 0 : 4, north || east ? 0 : 4, south || east ? 0 : 3, south || west ? 0 : 3];
  const top = blend(ctx, [left, back], [left, edge], [[0, mid], [.12, light], [.78, mid], [1, dark]]);
  rounded(ctx, left, back, width, front - back, upperCorners, dark);
  rounded(ctx, left, back, width, edge - back, upperCorners, top);
  const painted = texture(ctx, 'worktop', left, back, width, edge - back, {
    radius: upperCorners, opacity: .9, fragment: x % 3,
  });

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, back, width, edge - back, upperCorners);
  ctx.clip();
  for (let grain = 0; grain < (painted ? 0 : 4); grain++) {
    const grainY = back + 4.5 + grain * (edge - back - 8) / 3;
    const drift = .65 * Math.sin((grain + 3) * (x + 7) + y);
    ctx.strokeStyle = grain % 2 ? `${dark}40` : `${light}77`;
    ctx.lineWidth = grain % 2 ? .62 : .7;
    ctx.beginPath();
    ctx.moveTo(left - 1, grainY);
    ctx.bezierCurveTo(left + width * .32, grainY + drift, right - width * .35, grainY - drift, right + 1, grainY);
    ctx.stroke();
  }
  if (type === 'worktop' && !painted && (x + y) % 3 === 0) {
    const center = left + width * .55;
    const middle = back + (edge - back) * .53;
    rounded(ctx, center - 8, middle - 3, 16, 6, 2, `${dark}51`);
    stroke(ctx, `${light}7d`, .65, center - 6, middle + 2.5, center + 6, middle + 2.5);
  }
  ctx.restore();

  if (!north) stroke(ctx, light, 1.1, left + (west ? 0 : 3), back + 1.1, right - (east ? 0 : 3), back + 1.1);
  if (!west) stroke(ctx, inset, 1.35, left + .4, back + (north ? 0 : 3), left + .4, front - (south ? 0 : 3));
  if (!east) stroke(ctx, inset, 1.35, right - .4, back + (north ? 0 : 3), right - .4, front - (south ? 0 : 3));
  if (south) return;

  const body = blend(ctx, [left, edge], [left, front], [[0, dark], [.2, wood], [.82, dark], [1, inset]]);
  rounded(ctx, left + .8, edge - 1, width - 1.6, front - edge + 1, [0, 0, east ? 0 : 3, west ? 0 : 3], body);
  const paintedFace = texture(ctx, 'cabinet', left + .8, edge, width - 1.6, front - edge, {
    radius: [0, 0, east ? 0 : 2, west ? 0 : 2], opacity: .9, fragment: x % 3,
  });
  texture(ctx, 'trim', left + .8, edge - 1, width - 1.6, 2.4, { radius: 1, opacity: .8, fragment: x % 3 });
  ctx.lineWidth = .55;
  rounded(ctx, left + 5, edge + 2, width - 10, front - edge - 4, 2, `${wood}${paintedFace ? '23' : 'c9'}`, inset);
  stroke(ctx, `${light}76`, .7, left + 7, edge + 3.1, right - 7, edge + 3.1);
  stroke(ctx, metal, 1.1, left + width * .46, edge + 4.9, left + width * .54, edge + 4.9);
  stroke(ctx, accent, .55, left + width * .47, edge + 4.55, left + width * .53, edge + 4.55);
  stroke(ctx, inset, 1.1, left + .5, front - .4, right - .5, front - .4);
  stroke(ctx, light, 1.25, left + (west ? 0 : 2), edge - .2, right - (east ? 0 : 2), edge - .2);
}

export function drawCounters(ctx, map, tile, themeColor = '#ead4ad') {
  const material = materialFor(map.theme);
  const counters = gatherCounters(map, tile);
  ctx.save();
  ctx.fillStyle = '#1a1a305e';
  ctx.beginPath();
  for (const { left, right, back, front } of counters) {
    ctx.roundRect(left, back + 2, right - left + 1, front - back + 1, 3);
  }
  ctx.fill();
  for (const cell of counters) counterJoinery(ctx, cell, material, themeColor);
  ctx.restore();
}
