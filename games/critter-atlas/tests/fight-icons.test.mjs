import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { REGIONS, SPECIES, MAX_LEVEL, getAbilities } from '../catalog.js';
import { FIGHT_ICONS, fightIcon, abilityIconKey, hazardIconKey } from '../fight-icons.js';
import { sprite, spriteAtlas } from '../art.js';
import { warmFightEffects } from '../fight-effects.js';

test('frontier forms use matching idle and action sheets independently of habitat', () => {
  const css = readFileSync(new URL('../art.css', import.meta.url), 'utf8');
  for (const family of SPECIES.slice(56)) {
    const { sheet, columns, column } = spriteAtlas(family.id);
    assert.equal(columns, 4);
    assert.equal(column, (family.id - 56) % 4);
    assert.equal(sheet, 'frontier-' + (1 + Math.floor((family.id - 56) / 4)));
    for (const type of ['creatures', 'poses']) {
      const filename = type + '-' + sheet + '.webp';
      assert.ok(css.includes(filename));
      const bytes = readFileSync(new URL('../assets/' + filename, import.meta.url));
      assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8X');
      assert.equal(bytes.readUIntLE(24, 3) + 1, 512);
      assert.equal(bytes.readUIntLE(27, 3) + 1, 512);
    }
    family.forms.forEach((name, stage) => {
      assert.ok(sprite(family.id, stage).includes('sprite-' + sheet));
      assert.ok(sprite(family.id, stage).includes('aria-label="' + name + '"'));
    });
  }
  const assets = [];
  const OriginalImage = globalThis.Image;
  try {
    globalThis.Image = class { set src(url) { assets.push(url.split('/').at(-1)); } };
    const mixedParty = [0, 56, 57, 75].map(speciesId => ({member: {speciesId}}));
    warmFightEffects(mixedParty);
    warmFightEffects(mixedParty);
    assert.deepEqual(assets.filter(name => name.startsWith('poses-')).sort(),
      ['poses-forest.webp', 'poses-frontier-1.webp', 'poses-frontier-5.webp']);
  } finally {
    if (OriginalImage === undefined) delete globalThis.Image;
    else globalThis.Image = OriginalImage;
  }
});

test('all region hazards and learned abilities have labeled icons, including each signature and apex', () => {
  const signatures = new Set();
  for (const species of SPECIES) {
    for (const ability of getAbilities({ speciesId: species.id, level: MAX_LEVEL })) {
      const key = abilityIconKey(ability, species);
      assert.ok(FIGHT_ICONS[key]?.description, ability.name);
      assert.match(fightIcon(key), /role="img" aria-label="[^"]+"/);
      assert.match(fightIcon(key, ''), /aria-hidden="true"/);
      if (ability.id === 'signature' || ability.id === 'apex') signatures.add(key);
      if (ability.status) assert.ok(FIGHT_ICONS[ability.status], ability.status);
    }
  }
  assert.equal(signatures.size, SPECIES.length * 2);
  assert.deepEqual(REGIONS.map(r => FIGHT_ICONS[hazardIconKey(r.id)].label),
    ['Hookbriar','Sour bog','Loose shale','Riptide','Black ice','Lava vent','Rune trap','Starfall']);
  assert.match(fightIcon('capture','Aim at "Bramblit"'), /Aim at &quot;Bramblit&quot;/);
});

// The original atlas is an 8-bit RGBA PNG. Decode each scanline filter to
// check the actual transparent artwork in every named cell using just Node.
function readAtlas(file) {
  const bytes = readFileSync(file);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.deepEqual([...bytes.subarray(24, 29)], [8, 6, 0, 0, 0]);
  const parts = [];
  for (let i = 8; i < bytes.length; ) {
    const size = bytes.readUInt32BE(i);
    if (bytes.toString('ascii', i+4, i+8) === 'IDAT') parts.push(bytes.subarray(i+8, i+8+size));
    i += size + 12;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= 4 ? pixels[i-4] : 0;
      const up = y ? pixels[i-stride] : 0;
      const corner = y && x >= 4 ? pixels[i-stride-4] : 0;
      const prediction = left + up - corner;
      const a = Math.abs(prediction - left), b = Math.abs(prediction - up), c = Math.abs(prediction - corner);
      const paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const correction = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[i] = raw[offset++] + correction;
    }
  }
  return { width, height, pixels };
}

test('every named symbol maps to a distinct painted, nonempty atlas cell', () => {
  const { width, height, pixels } = readAtlas(new URL('../assets/fight-icons-frontier.png', import.meta.url));
  const cell = 20, columns = 8;
  const entries = Object.entries(FIGHT_ICONS);
  assert.equal(width, columns * cell);
  assert.equal(height, Math.ceil(entries.length / columns) * cell);
  const fingerprints = new Set();
  for (const [key, icon] of entries) {
    const x = (icon.index % columns) * cell, y = Math.floor(icon.index / columns) * cell;
    const lines = [];
    for (let row = y; row < y + cell; row++) {
      const start = (row * width + x) * 4;
      lines.push(pixels.subarray(start, start + cell * 4));
    }
    const rgba = Buffer.concat(lines);
    assert.ok(rgba.some((v, i) => i % 4 === 3 && v > 0), key);
    const hash = createHash('sha256').update(rgba).digest('hex');
    assert.ok(!fingerprints.has(hash), 'Duplicated graphic: ' + key);
    fingerprints.add(hash);
  }
});
