const cachedOutlines = new WeakMap();

const outlines = {
  high: [[0, .44], [.11, .19], [.29, .11], [.46, 0], [.69, .06], [.91, .23], [1, .48],
    [.89, .72], [.72, .85], [.54, 1], [.31, .91], [.15, .78], [.05, .66]],
  cover: [[0, .53], [.06, .29], [.23, .13], [.39, .18], [.52, 0], [.69, .11], [.87, .1],
    [.97, .31], [.89, .45], [1, .66], [.88, .84], [.65, .86], [.48, 1], [.28, .91], [.13, .95], [.05, .75]],
  rock: [[0, .49], [.08, .22], [.26, .07], [.49, 0], [.72, .09], [.95, .21], [1, .5],
    [.89, .79], [.74, .95], [.42, 1], [.23, .91], [.06, .77]],
  built: [[0, .14], [.09, 0], [.81, 0], [1, .15], [1, .82], [.91, 1], [.2, 1], [0, .84]],
};

export function terrainOutline(feature) {
  if (cachedOutlines.has(feature)) return cachedOutlines.get(feature);
  const { x, y, w, h, kind } = feature;
  const shape = outlines[kind] ?? outlines.built;
  const mirror = Math.round(x * 7 + y * 11) % 3 === 0 ? -1 : 1;
  const points = shape.map(([across, down]) => ({
    x: x + (mirror < 0 ? 1 - across : across) * w,
    y: y + down * h,
  }));
  cachedOutlines.set(feature, points);
  return points;
}

export function pointInTerrainZone(x, y, zone) {
  if (x < zone.x || x > zone.x + zone.w || y < zone.y || y > zone.y + zone.h) return false;
  const points = terrainOutline(zone);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
