import { UNIT_DEFS, BUILDING_DEFS } from './engine.js';

const TILE = 32;
export const BUILDING_SPRITES = { nest: 0, refuge: 1, tower: 2, well: 3, lair: 4, watch: 5, spike: 6, construction: 7 };
const C = {
  background: '#070b15', floor: '#182531', wall: '#16233b', wallTop: '#253b5c',
  pac: '#ffd952', pacSoft: '#fff1ab', ghost: '#ff6c81', ghostSoft: '#ffc2d0',
  teal: '#70f0d3', blue: '#83c7ff', purple: '#bca7ff', white: '#e9f3ff',
  dim: '#7c91aa', line: '#3b526c', green: '#89efb0', red: '#ff6a78',
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, y) => ((Math.imul(x + 71, 73856093) ^ Math.imul(y + 39, 19349663)) >>> 0) / 4294967295;
const alive = entity => entity.hp > 0;
const TEAM_COLORS = { pac: '#ffd552', pac2: '#7de5cc', pac3: '#ff9e87', ghost: '#a48bfa' };
const rgba = (hex, alpha) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;

function surface(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function rect(ctx, x, y, w, h, radius = .12) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function ring(ctx, x, y, radius, color, width = .045, alpha = 1) {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function loadImage(path) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = new URL(path, import.meta.url).href;
  });
}

/** Canvas renderer. All positions exposed to the UI are in tile coordinates. */
export class Renderer {
  constructor(canvas, game, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.options = options;
    this.camera = { x: 0, y: 0, zoom: options.zoom ?? 1 };
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.clock = 0;
    this.assets = { units: null, terrain: null, buildings: null };
    this.spriteAtlas = null;
    this.buildingAtlas = null;
    this.teamSpriteAtlases = new Map();
    this.teamBuildingAtlases = new Map();
    this.rememberedBuildings = new Map();
    this._spellAreaCache = new Map();
    this._fogTick = -1;
    this._destroyed = false;
    this._resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this._resizeObserver?.observe(canvas.parentElement || canvas);
    this.setGame(game);
    this.resize();
    this.assetReady = Promise.all([loadImage('./assets/units.png'), loadImage('./assets/terrain.png'), loadImage('./assets/buildings.png')]).then(([units, terrain, buildings]) => {
      this.assets = { units, terrain, buildings };
      this.spriteAtlas = units ? this._normalizeSprites(units) : null;
      this.buildingAtlas = buildings ? this._normalizeBuildingSprites(buildings) : null;
      this._buildTeamAtlases();
      this._buildTerrain();
      return { units: !!units, terrain: !!terrain, buildings: !!buildings };
    });
  }

  setGame(game) {
    this.game = game;
    this.rememberedBuildings.clear();
    this._spellAreaCache.clear();
    this._fogTick = -1;
    const { width, height } = game.map;
    this.fogCanvas = surface(width * 4, height * 4);
    this.fogCtx = this.fogCanvas.getContext('2d');
    this._buildTerrain();
    const own = game.units.find(u => alive(u) && this._owns(u) && (u.type === 'hero' || u.type === 'scout'))
      || game.buildings.find(b => alive(b) && this._owns(b));
    this.centerOn(own?.x ?? width / 2, own?.y ?? height / 2);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || this.canvas.parentElement?.clientWidth || 960));
    const height = Math.max(1, Math.round(bounds.height || this.canvas.parentElement?.clientHeight || 600));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (width !== this.width || height !== this.height || dpr !== this.dpr) {
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this._clampCamera();
    }
  }

  _clampCamera() {
    if (!this.game) return;
    const margin = 1.5;
    const w = this.width / (TILE * this.camera.zoom), h = this.height / (TILE * this.camera.zoom);
    this.camera.x = w >= this.game.map.width + margin * 2 ? this.game.map.width / 2 : clamp(this.camera.x, w / 2 - margin, this.game.map.width - w / 2 + margin);
    this.camera.y = h >= this.game.map.height + margin * 2 ? this.game.map.height / 2 : clamp(this.camera.y, h / 2 - margin, this.game.map.height - h / 2 + margin);
  }

  centerOn(x, y) {
    this.camera.x = x;
    this.camera.y = y;
    this._clampCamera();
  }

  pan(dx, dy) {
    this.camera.x += dx / (TILE * this.camera.zoom);
    this.camera.y += dy / (TILE * this.camera.zoom);
    this._clampCamera();
  }

  zoomAt(factor, clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX ?? rect.left + this.width / 2;
    const py = clientY ?? rect.top + this.height / 2;
    const before = this.screenToWorld(px, py);
    this.camera.zoom = clamp(this.camera.zoom * factor, .26, 2.4);
    const after = this.screenToWorld(px, py);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this._clampCamera();
  }

  screenToWorld(clientX, clientY) {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - this.width / 2) / (TILE * this.camera.zoom) + this.camera.x,
      y: (clientY - bounds.top - this.height / 2) / (TILE * this.camera.zoom) + this.camera.y,
    };
  }

  worldToScreen(x, y) {
    return { x: (x - this.camera.x) * TILE * this.camera.zoom + this.width / 2, y: (y - this.camera.y) * TILE * this.camera.zoom + this.height / 2 };
  }

  _buildTerrain() {
    if (!this.game) return;
    const { width: w, height: h, tiles } = this.game.map;
    const maze = this.game.map.mazeBounds || { x: 0, y: 0, w, h };
    const biome = this.game.map.biome;
    const zoneAt = (x, y) => biome?.[y * w + x] ?? (x < maze.x || y < maze.y || x >= maze.x + maze.w || y >= maze.y + maze.h ? 1 : 0);
    const centerDistance = (x, y) => Math.hypot((x - maze.x - maze.w / 2) / Math.max(1, maze.w / 2), (y - maze.y - maze.h / 2) / Math.max(1, maze.h / 2));
    this.terrainCanvas = surface(w * TILE, h * TILE);
    const t = this.terrainCanvas.getContext('2d', { alpha: false });
    t.imageSmoothingEnabled = false;
    const atlas = this.assets.terrain;
    const aw = atlas ? atlas.naturalWidth / 2 : 0, ah = atlas ? atlas.naturalHeight / 2 : 0;
    const patterns = [];
    if (atlas) {
      // Preserve readable stone scale and continuous mortar across world tiles.
      // Sampling a whole 627px quadrant into every 32px tile makes it too fine.
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const texture = surface(160, 160), tc = texture.getContext('2d');
        tc.imageSmoothingEnabled = true;
        tc.drawImage(atlas, (quadrant % 2) * aw, Math.floor(quadrant / 2) * ah, aw, ah, 0, 0, 160, 160);
        patterns[quadrant] = t.createPattern(texture, 'repeat');
      }
    }
    const floor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] === 1;
    t.fillStyle = C.background;
    t.fillRect(0, 0, w * TILE, h * TILE);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x * TILE, py = y * TILE, n = hash(x, y), zone = zoneAt(x, y), exterior = zone === 1;
      if (floor(x, y)) {
        t.fillStyle = exterior ? n > .5 ? '#30382a' : '#273a2d' : zone === 2 ? '#30293c' : n > .8 ? '#1a302f' : '#1a2733';
        t.fillRect(px, py, TILE, TILE);
        if (atlas) {
          const quadrant = exterior || n > .77 ? 1 : 0;
          t.globalAlpha = exterior ? .35 : .62;
          if (patterns[quadrant]) { t.fillStyle = patterns[quadrant]; t.fillRect(px, py, TILE, TILE); }
          else t.drawImage(atlas, quadrant * aw, 0, aw, ah, px, py, TILE, TILE);
          t.globalAlpha = 1;
          t.fillStyle = exterior ? 'rgba(11,22,14,.12)' : zone === 2 ? 'rgba(33,13,46,.18)' : 'rgba(7,15,25,.25)';
          t.fillRect(px, py, TILE, TILE);
        }
        t.strokeStyle = exterior ? 'rgba(113,130,87,.035)' : zone === 2 ? 'rgba(173,126,189,.14)' : 'rgba(95,130,151,.10)';
        t.lineWidth = 1;
        t.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
        if (!exterior && n > .81) {
          t.strokeStyle = 'rgba(120,151,154,.12)';
          t.beginPath(); t.moveTo(px + 5, py + 10); t.lineTo(px + 14, py + 13); t.lineTo(px + 20, py + 9); t.stroke();
        }
        if (n < .15) {
          t.fillStyle = exterior ? 'rgba(106,147,77,.22)' : 'rgba(104,166,120,.12)';
          t.fillRect(px + 2, py + 21, 7, 3); t.fillRect(px + 7, py + 24, 5, 2);
        }
        if (exterior && n < .12) {
          // Sparse low grass and old shallow masonry remain decorative floor.
          t.strokeStyle = 'rgba(113,152,82,.38)'; t.lineWidth = 1;
          t.beginPath(); t.moveTo(px + 20, py + 25); t.lineTo(px + 17, py + 18); t.moveTo(px + 22, py + 26); t.lineTo(px + 24, py + 17); t.moveTo(px + 21, py + 25); t.lineTo(px + 21, py + 16); t.stroke();
        } else if (exterior && n > .93) {
          t.save(); t.translate(px + 16, py + 16); t.rotate((n - .93) * 8 - .28);
          t.fillStyle = 'rgba(7,14,10,.28)'; t.fillRect(-10, -4, 19, 6); t.fillRect(-5, 4, 14, 5);
          t.fillStyle = 'rgba(114,126,100,.22)'; t.fillRect(-11, -6, 18, 5); t.fillRect(-6, 2, 14, 5);
          t.fillStyle = 'rgba(173,181,149,.12)'; t.fillRect(-11, -6, 18, 1); t.fillRect(-6, 2, 14, 1); t.restore();
        } else if (exterior && n > .79 && n < .84) {
          t.fillStyle = 'rgba(120,97,57,.10)'; t.beginPath(); t.ellipse(px + 19, py + 17, 11, 7, -.4, 0, Math.PI * 2); t.fill();
        }
      } else {
        const violet = !exterior && centerDistance(x, y) < .5;
        t.fillStyle = exterior ? '#26322c' : violet ? '#211b35' : '#15263d';
        t.fillRect(px, py, TILE, TILE);
        if (atlas) {
          t.globalAlpha = exterior ? .4 : .61;
          const quadrant = exterior ? 1 : violet ? 3 : 2;
          if (patterns[quadrant]) { t.fillStyle = patterns[quadrant]; t.fillRect(px, py, TILE, TILE); }
          else t.drawImage(atlas, (quadrant % 2) * aw, Math.floor(quadrant / 2) * ah, aw, ah, px, py, TILE, TILE);
          t.globalAlpha = 1;
          t.fillStyle = exterior ? 'rgba(9,22,14,.25)' : 'rgba(8,15,28,.28)'; t.fillRect(px, py, TILE, TILE);
        }
        t.strokeStyle = 'rgba(112,148,197,.12)'; t.lineWidth = 1;
        t.beginPath(); t.moveTo(px, py + 12); t.lineTo(px + TILE, py + 12); t.moveTo(px + (y % 2 ? 12 : 22), py); t.lineTo(px + (y % 2 ? 12 : 22), py + 12); t.stroke();
        if (floor(x, y + 1)) {
          const gradient = t.createLinearGradient(0, py + 16, 0, py + TILE);
          gradient.addColorStop(0, 'rgba(40,68,102,.1)'); gradient.addColorStop(1, 'rgba(5,10,20,.9)');
          t.fillStyle = gradient; t.fillRect(px, py + 16, TILE, TILE - 16);
          t.fillStyle = exterior ? '#4a5e44' : violet ? '#4c3d68' : '#38516f'; t.fillRect(px, py + 1, TILE, 2);
        }
        if (floor(x, y - 1)) { t.fillStyle = 'rgba(5,10,21,.55)'; t.fillRect(px, py, TILE, 4); }
        if (floor(x - 1, y)) { t.fillStyle = 'rgba(102,146,188,.22)'; t.fillRect(px, py, 2, TILE); }
        if (floor(x + 1, y)) { t.fillStyle = 'rgba(3,8,18,.6)'; t.fillRect(px + TILE - 3, py, 3, TILE); }
      }
    }
    this.miniTerrain = surface(w * 3, h * 3);
    const m = this.miniTerrain.getContext('2d', { alpha: false });
    m.fillStyle = C.background; m.fillRect(0, 0, w * 3, h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const zone = zoneAt(x, y);
      m.fillStyle = tiles[y * w + x] ? zone === 1 ? '#3d4c38' : zone === 2 ? '#4b3656' : '#344254' : zone === 1 ? '#1d2a21' : centerDistance(x, y) < .5 ? '#211b35' : '#111a2b';
      m.fillRect(x * 3, y * 3, 3, 3);
    }
  }

  _normalizeSprites(image) {
    // Generated sheets can contain generous transparent margins. Trim each row
    // consistently, preserving animation alignment and a shared ground baseline.
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (!width || !height) return image;
    const source = surface(width, height), sourceCtx = source.getContext('2d');
    sourceCtx.drawImage(image, 0, 0);
    let pixels;
    try { pixels = sourceCtx.getImageData(0, 0, width, height).data; } catch { return image; }
    const sw = width / 8, sh = height / 8, normalized = surface(512, 512), out = normalized.getContext('2d');
    out.imageSmoothingEnabled = false;
    for (let row = 0; row < 8; row++) {
      let left = Math.ceil(sw), top = Math.ceil(sh), right = 0, bottom = 0, found = false;
      for (let frame = 0; frame < 8; frame++) {
        const sx = Math.floor(frame * sw), sy = Math.floor(row * sh);
        for (let y = 1; y < Math.floor(sh) - 1; y++) for (let x = 1; x < Math.floor(sw) - 1; x++) {
          if (pixels[((sy + y) * width + sx + x) * 4 + 3] > 24) {
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); found = true;
          }
        }
      }
      if (!found) { left = 0; top = 0; right = sw - 1; bottom = sh - 1; }
      left = Math.max(0, left - 1); top = Math.max(0, top - 1); right = Math.min(sw - 1, right + 1); bottom = Math.min(sh - 1, bottom + 1);
      const cropW = right - left + 1, cropH = bottom - top + 1, scale = 58 / Math.max(cropW, cropH);
      const dw = cropW * scale, dh = cropH * scale;
      for (let frame = 0; frame < 8; frame++) out.drawImage(image, frame * sw + left, row * sh + top, cropW, cropH, frame * 64 + (64 - dw) / 2, row * 64 + 60 - dh, dw, dh);
    }
    return normalized;
  }

  _normalizeBuildingSprites(image) {
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (!width || !height) return image;
    const source = surface(width, height), sourceCtx = source.getContext('2d');
    sourceCtx.drawImage(image, 0, 0);
    let pixels;
    try { pixels = sourceCtx.getImageData(0, 0, width, height).data; } catch { return image; }
    const sw = width / 4, sh = height / 2, normalized = surface(1024, 512), out = normalized.getContext('2d');
    out.imageSmoothingEnabled = false;
    for (let index = 0; index < 8; index++) {
      const column = index % 4, row = Math.floor(index / 4), sx = Math.floor(column * sw), sy = Math.floor(row * sh);
      let left = Math.ceil(sw), top = Math.ceil(sh), right = 0, bottom = 0, found = false;
      for (let y = 1; y < Math.floor(sh) - 1; y++) for (let x = 1; x < Math.floor(sw) - 1; x++) {
        if (pixels[((sy + y) * width + sx + x) * 4 + 3] > 24) {
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); found = true;
        }
      }
      if (!found) { left = 0; top = 0; right = sw - 1; bottom = sh - 1; }
      left = Math.max(0, left - 2); top = Math.max(0, top - 2); right = Math.min(sw - 1, right + 2); bottom = Math.min(sh - 1, bottom + 2);
      const cropW = right - left + 1, cropH = bottom - top + 1, scale = 238 / Math.max(cropW, cropH);
      const dw = cropW * scale, dh = cropH * scale;
      out.drawImage(image, column * sw + left, row * sh + top, cropW, cropH, column * 256 + (256 - dw) / 2, row * 256 + 248 - dh, dw, dh);
    }
    return normalized;
  }

  _recolorPacAtlas(atlas, color) {
    const width = atlas.naturalWidth || atlas.width, height = atlas.naturalHeight || atlas.height;
    const output = surface(width, height), ctx = output.getContext('2d');
    ctx.drawImage(atlas, 0, 0);
    let frame;
    try { frame = ctx.getImageData(0, 0, width, height); } catch { return atlas; }
    const pixels = frame.data;
    const red=parseInt(color.slice(1,3),16)/255, green=parseInt(color.slice(3,5),16)/255, blue=parseInt(color.slice(5,7),16)/255;
    const targetLuminance=.2126*red+.7152*green+.0722*blue;
    // Only Pac rows occupy the upper half. Neutral armor, dark outlines and
    // transparent pixels retain their original values; colored cloth and the
    // commander's golden body retain their light/shadow pattern in team colors.
    for(let i=0;i<width*Math.floor(height/2)*4;i+=4){
      if(pixels[i+3]<8)continue;
      const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
      if(delta<.08)continue;
      let hue=max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
      if(hue<.28||hue>1.4)continue;
      const light=(max+min)/2, originalSat=delta/(1-Math.abs(2*light-1));
      if(originalSat<.24)continue;
      const brightness=(.2126*r+.7152*g+.0722*b)/targetLuminance;
      pixels[i]=Math.round(Math.min(1,red*brightness)*255);pixels[i+1]=Math.round(Math.min(1,green*brightness)*255);pixels[i+2]=Math.round(Math.min(1,blue*brightness)*255);
    }
    ctx.putImageData(frame,0,0);
    return output;
  }

  _buildTeamAtlases() {
    this.teamSpriteAtlases.clear();this.teamBuildingAtlases.clear();
    for(const teamId of ['pac2','pac3']){
      const color=this.game.teams?.[teamId]?.color||TEAM_COLORS[teamId];
      if(this.spriteAtlas)this.teamSpriteAtlases.set(teamId,this._recolorPacAtlas(this.spriteAtlas,color));
      if(this.buildingAtlas)this.teamBuildingAtlases.set(teamId,this._recolorPacAtlas(this.buildingAtlas,color));
    }
  }

  _visible(x, y, side = this.game.side) {
    const { width, height } = this.game.map;
    const ix = Math.floor(x), iy = Math.floor(y);
    return ix >= 0 && iy >= 0 && ix < width && iy < height && !!this.game.visible[side]?.[iy * width + ix];
  }

  _owns(entity) {
    return (entity.teamId || entity.side) === (this.game.playerTeam || this.game.side);
  }

  _teamColor(entity) {
    const id = entity?.teamId || entity?.side || this.game.playerTeam || this.game.side;
    return this.game.teams?.[id]?.color || TEAM_COLORS[id] || (entity?.side === 'ghost' ? C.ghost : C.pac);
  }

  _teamPennant(ctx, b) {
    if (b.side !== 'pac') return;
    const w = b.w || BUILDING_DEFS[b.type]?.w || 3, h = b.h || BUILDING_DEFS[b.type]?.h || 3;
    const x = b.x - w * .47, y = b.y - h * .42, color = this._teamColor(b);
    ctx.save();
    ctx.strokeStyle = '#adbac7'; ctx.lineWidth = .055;
    ctx.beginPath(); ctx.moveTo(x, y + .55); ctx.lineTo(x, y - .56); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = '#08101c'; ctx.lineWidth = .045;
    ctx.beginPath(); ctx.moveTo(x, y - .56); ctx.lineTo(x + .66, y - .47); ctx.lineTo(x + .52, y - .15); ctx.lineTo(x, y - .22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = 'bold .26px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111c27';
    ctx.fillText(b.teamId === 'pac2' ? '2' : b.teamId === 'pac3' ? '3' : '1', x + .27, y - .36);
    ctx.restore();
  }

  _inView(x, y, margin = 3) {
    return x >= this.bounds.left - margin && x <= this.bounds.right + margin && y >= this.bounds.top - margin && y <= this.bounds.bottom + margin;
  }

  _spellCells(x, y, radius, cacheKey = null) {
    if (cacheKey && this._spellAreaCache.has(cacheKey)) return this._spellAreaCache.get(cacheKey);
    const cells = [], { width, height, tiles } = this.game.map;
    for (let ty = Math.max(0, Math.floor(y - radius - 1)); ty <= Math.min(height - 1, Math.ceil(y + radius + 1)); ty++) {
      for (let tx = Math.max(0, Math.floor(x - radius - 1)); tx <= Math.min(width - 1, Math.ceil(x + radius + 1)); tx++) {
        if (!tiles[ty * width + tx] || Math.hypot(tx + .5 - x, ty + .5 - y) > radius + .71) continue;
        if (this.game.hasLineOfSight?.(x, y, tx + .5, ty + .5) === false) continue;
        cells.push({ x: tx, y: ty, k: ty * width + tx });
      }
    }
    if (cacheKey) {
      if (this._spellAreaCache.size > 80) this._spellAreaCache.clear();
      this._spellAreaCache.set(cacheKey, cells);
    }
    return cells;
  }

  _clipSpell(ctx, cells) {
    ctx.beginPath();
    for (const cell of cells) ctx.rect(cell.x, cell.y, 1, 1);
    ctx.clip();
  }

  _knowsSpell(caster, cast, cells) {
    if (caster?.side === this.game.side || (caster && this._visible(caster.x, caster.y))) return true;
    return cells.some(cell => !!this.game.visible[this.game.side]?.[cell.k]);
  }

  _worldLabel(ctx, text, x, y, color, pixels = 11) {
    ctx.save();
    ctx.font = `500 ${pixels / (TILE * this.camera.zoom)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
    ctx.lineWidth = .075 / this.camera.zoom; ctx.strokeStyle = 'rgba(3,7,15,.94)';
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.restore();
  }

  _drawCastTelegraphs(ctx, front = false) {
    for (const caster of this.game.units) {
      const cast = caster.cast;
      if (!alive(caster) || !cast || !this._inView(cast.x, cast.y, (cast.radius || 2.1) + 2)) continue;
      const radius = cast.radius || 2.1, cells = this._spellCells(cast.x, cast.y, radius, cast.id || `cast-${caster.id}-${cast.x}-${cast.y}`);
      if (!this._knowsSpell(caster, cast, cells)) continue;
      const progress = clamp(1 - cast.remaining / (cast.total || 1.25), 0, 1);
      const pink = '#f48cfa';
      ctx.save();
      this._clipSpell(ctx, cells);
      if (!front) {
        const glow = ctx.createRadialGradient(cast.x, cast.y, .1, cast.x, cast.y, radius);
        glow.addColorStop(0, `rgba(211,63,229,${.08 + progress * .12})`);
        glow.addColorStop(.82, `rgba(229,72,231,${.12 + progress * .15})`);
        glow.addColorStop(1, 'rgba(244,140,250,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cast.x, cast.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(244,140,250,.4)'; ctx.lineWidth = .035;
        for (const cell of cells) {
          const x = cell.x + .5, y = cell.y + .5;
          if (Math.hypot(x - cast.x, y - cast.y) > radius * .8) continue;
          ctx.beginPath(); ctx.moveTo(x, y - .15); ctx.lineTo(x + .13, y); ctx.lineTo(x, y + .15); ctx.lineTo(x - .13, y); ctx.closePath(); ctx.stroke();
        }
        ring(ctx, cast.x, cast.y, radius * .54, pink, .035, .35 + progress * .25);
      } else {
        ctx.strokeStyle = 'rgba(244,140,250,.65)'; ctx.lineWidth = .045;
        ctx.setLineDash([.14, .10]); ctx.beginPath(); ctx.arc(cast.x, cast.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = pink; ctx.lineWidth = .10;
        ctx.beginPath(); ctx.arc(cast.x, cast.y, radius * .94, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
        const spin = this.clock * .65;
        for (let n = 0; n < 6; n++) {
          const a = spin + n * Math.PI / 3, x = cast.x + Math.cos(a) * radius * .64, y = cast.y + Math.sin(a) * radius * .64;
          ctx.strokeStyle = rgba(pink, .75); ctx.lineWidth = .045;
          ctx.beginPath(); ctx.moveTo(x - .09, y - .09); ctx.lineTo(x + .09, y + .09); ctx.moveTo(x + .09, y - .09); ctx.lineTo(x - .09, y + .09); ctx.stroke();
        }
      }
      ctx.restore();
      if (front) {
        this._worldLabel(ctx, `SNARE ${Math.max(0, cast.remaining).toFixed(1)}s`, cast.x, cast.y - radius - .18, '#ffc1ff', 11);
      } else if (this._visible(caster.x, caster.y)) {
        ctx.save(); ctx.strokeStyle = 'rgba(227,125,245,.34)'; ctx.lineWidth = .035; ctx.setLineDash([.1, .12]);
        ctx.beginPath(); ctx.moveTo(caster.x, caster.y - .25); ctx.lineTo(cast.x, cast.y); ctx.stroke(); ctx.restore();
      }
    }
  }

  _drawSnarePreview(ctx, world, selected) {
    if (!world) return;
    const binders = this.game.units.filter(u => alive(u) && this._owns(u) && u.type === 'binder' && selected.has(u.id));
    if (!binders.length) return;
    const valid = binders.some(u => Math.hypot(u.x - world.x, u.y - world.y) <= 5.5 && this.game.hasLineOfSight?.(u.x, u.y, world.x, world.y) !== false);
    const color = valid ? '#f48cfa' : C.red, radius = 2.1;
    ctx.save(); ctx.strokeStyle = rgba(color, .24); ctx.lineWidth = .035; ctx.setLineDash([.1, .14]);
    for (const binder of binders) { ctx.beginPath(); ctx.arc(binder.x, binder.y, 5.5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    const cells = this._spellCells(world.x, world.y, radius);
    ctx.save(); this._clipSpell(ctx, cells);
    ctx.fillStyle = rgba(color, .08); ctx.beginPath(); ctx.arc(world.x, world.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(color, .9); ctx.lineWidth = .045;
    ctx.beginPath(); ctx.arc(world.x, world.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = .045;
    ctx.beginPath(); ctx.moveTo(world.x - .22, world.y); ctx.lineTo(world.x + .22, world.y); ctx.moveTo(world.x, world.y - .22); ctx.lineTo(world.x, world.y + .22); ctx.stroke(); ctx.restore();
  }

  _drawPellets(ctx) {
    const game = this.game, w = game.map.width;
    const draw = (x, y, type, confirmed = true) => {
      if (!this._inView(x, y, .5)) return;
      const large = type === 'large';
      const pulse = .92 + Math.sin(this.clock * 3 + x * .3) * .08;
      if (large) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, .65);
        glow.addColorStop(0, 'rgba(255,215,78,.2)'); glow.addColorStop(1, 'rgba(255,215,78,0)');
        ctx.fillStyle = glow; ctx.fillRect(x - .65, y - .65, 1.3, 1.3);
        ring(ctx, x, y, .27 * pulse, C.pac, .034, confirmed ? .55 : .19);
      }
      ctx.globalAlpha = confirmed ? 1 : .32;
      ctx.fillStyle = large ? '#ffe7a2' : '#f5d56a';
      ctx.shadowColor = C.pac; ctx.shadowBlur = large ? .3 : 0;
      ctx.beginPath(); ctx.arc(x, y, large ? .165 * pulse : .064, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (game.side === 'ghost' && confirmed) {
        // Every surviving pellet is a local sensor. No powered sectors or tuning.
        ctx.strokeStyle = 'rgba(255,108,129,.15)'; ctx.lineWidth = .019;
        ctx.beginPath(); ctx.arc(x, y, large ? .34 : .18, -.7, .7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    if (game.side === 'ghost' && game.knownPelletsGhost) {
      const x1 = Math.max(0, Math.floor(this.bounds.left)), x2 = Math.min(w, Math.ceil(this.bounds.right));
      const y1 = Math.max(0, Math.floor(this.bounds.top)), y2 = Math.min(game.map.height, Math.ceil(this.bounds.bottom));
      for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
        const type = game.knownPelletsGhost[y * w + x];
        if (type) draw(x + .5, y + .5, type === 2 ? 'large' : 'small', this._visible(x + .5, y + .5));
      }
    } else {
      for (const pellet of game.pellets.values()) draw(pellet.x, pellet.y, pellet.type);
    }
  }

  _drawBuilding(ctx, b, selected, remembered = false) {
    // The Sanctuary has a medical silhouette; the original atlas has no healer frame.
    if (b.type !== 'sanctuary' && (this.buildingAtlas || this.assets.buildings)) {
      this._drawBuildingSprite(ctx, b, selected, remembered);
      return;
    }
    const pac = b.side === 'pac', color = this._teamColor(b);
    const w = b.w || BUILDING_DEFS[b.type]?.w || 3, h = b.h || BUILDING_DEFS[b.type]?.h || 3;
    const x = b.x - w / 2, y = b.y - h / 2;
    ctx.save();
    if (remembered) ctx.globalAlpha = .22;
    ctx.fillStyle = 'rgba(1,5,12,.58)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + h * .28, w * .53, h * .4, 0, 0, Math.PI * 2); ctx.fill();
    if (selected) {
      ctx.strokeStyle = color; ctx.lineWidth = .055; ctx.setLineDash([.17, .12]);
      ctx.strokeRect(x - .15, y - .15, w + .3, h + .3); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#101b2c'; ctx.strokeStyle = '#526378'; ctx.lineWidth = .075;
    rect(ctx, x + .12, y + .22, w - .24, h - .32, .24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#25364b';
    rect(ctx, x + .25, y + .1, w - .5, h - .48, .2); ctx.fill();
    ctx.strokeStyle = rgba(color, .4); ctx.lineWidth = .045;
    rect(ctx, x + .36, y + .2, w - .72, h - .68, .16); ctx.stroke();
    for (const [ox, oy] of [[.38, .38], [w - .38, .38], [.38, h - .38], [w - .38, h - .38]]) {
      ctx.fillStyle = '#7b8a9d'; ctx.fillRect(x + ox - .045, y + oy - .045, .09, .09);
    }
    const cy = b.y - .12;
    if (b.type === 'nest') {
      const glow = ctx.createRadialGradient(b.x, cy, .1, b.x, cy, 1.55);
      glow.addColorStop(0, 'rgba(255,215,78,.22)'); glow.addColorStop(1, 'rgba(255,215,78,0)');
      ctx.fillStyle = glow; ctx.fillRect(b.x - 1.6, cy - 1.6, 3.2, 3.2);
      ring(ctx, b.x, cy, .9, color, .07, .8);
      ring(ctx, b.x, cy, .7, '#0d1521', .18);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(b.x, cy); ctx.arc(b.x, cy, .56, .58, Math.PI * 2 - .58); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#514321'; ctx.fillRect(b.x - .06, cy - .33, .09, .09);
      for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; ctx.fillStyle = C.pacSoft; ctx.fillRect(b.x + Math.cos(a) * 1.05 - .065, cy + Math.sin(a) * 1.05 - .065, .13, .13); }
    } else if (b.type === 'lair') {
      const pulse = .84 + Math.sin(this.clock * 2) * .05;
      const glow = ctx.createRadialGradient(b.x, cy, .2, b.x, cy, 1.5);
      glow.addColorStop(0, 'rgba(186,104,239,.30)'); glow.addColorStop(1, 'rgba(255,108,129,0)');
      ctx.fillStyle = glow; ctx.fillRect(b.x - 1.5, cy - 1.5, 3, 3);
      ctx.fillStyle = '#120d27'; ctx.beginPath(); ctx.ellipse(b.x, cy, .73, .9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.ghost; ctx.lineWidth = .1; ctx.beginPath(); ctx.ellipse(b.x, cy, .73, .9, 0, 0, Math.PI * 2); ctx.stroke();
      ring(ctx, b.x, cy, .45 * pulse, C.purple, .09, .7);
      ctx.fillStyle = '#ffa5bd'; ctx.fillRect(b.x - .24, cy - .1, .12, .23); ctx.fillRect(b.x + .12, cy - .1, .12, .23);
    } else if (b.type === 'well') {
      ctx.fillStyle = '#0a1b29'; ctx.beginPath(); ctx.ellipse(b.x, cy, .8, .66, 0, 0, Math.PI * 2); ctx.fill();
      ring(ctx, b.x, cy, .7, C.teal, .09, .8);
      ctx.fillStyle = rgba(C.teal, .35 + Math.sin(this.clock * 2) * .08); ctx.beginPath(); ctx.ellipse(b.x, cy, .55, .44, 0, 0, Math.PI * 2); ctx.fill();
      for (let n = 0; n < 3; n++) { const a = this.clock + n * Math.PI * 2 / 3; ctx.fillStyle = C.pacSoft; ctx.fillRect(b.x + Math.cos(a) * .45 - .06, cy + Math.sin(a) * .3 - .06, .12, .12); }
      ctx.fillStyle = C.teal; ctx.fillRect(x + .45, y + h - .48, w - .9, .09);
    } else if (b.type === 'sanctuary') {
      const glow = ctx.createRadialGradient(b.x, cy, .1, b.x, cy, 1.5);
      glow.addColorStop(0, rgba(C.green, b.healingCount > 0 ? .32 : .15)); glow.addColorStop(1, rgba(C.green, 0));
      ctx.fillStyle = glow; ctx.fillRect(b.x - 1.5, cy - 1.5, 3, 3);
      ctx.fillStyle = '#163f3b'; ctx.strokeStyle = '#91f3cf'; ctx.lineWidth = .075;
      ctx.beginPath(); ctx.ellipse(b.x, cy + .05, .98, .75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#21584d'; ctx.beginPath(); ctx.ellipse(b.x, cy - .19, .82, .63, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c2ffe1'; ctx.fillRect(b.x - .16, cy - .70, .32, 1.02); ctx.fillRect(b.x - .51, cy - .35, 1.02, .32);
      for (const ox of [-.98, .98]) {
        ctx.fillStyle = '#446b60'; rect(ctx, b.x + ox - .13, cy - .32, .26, .94, .07); ctx.fill();
        ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(b.x + ox, cy - .40, .16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = this._teamColor(b); ctx.fillRect(b.x - .62, cy + .82, 1.24, .10);
      if (b.healingCount > 0) ring(ctx, b.x, cy, 1.1 + Math.sin(this.clock * 4) * .05, C.green, .04, .65);
    } else if (b.type === 'watch') {
      ctx.fillStyle = '#3b3049'; rect(ctx, b.x - .38, cy - .38, .76, .95, .12); ctx.fill();
      ctx.strokeStyle = '#c58cbd'; ctx.lineWidth = .12; ctx.beginPath(); ctx.moveTo(b.x, cy + .15); ctx.lineTo(b.x, cy - .95); ctx.stroke();
      ring(ctx, b.x, cy - .83, .43, color, .085, .85);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(b.x, cy - .83, .16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(color, .25); ctx.lineWidth = .045;
      ctx.beginPath(); ctx.moveTo(b.x - .65, cy - .45); ctx.lineTo(b.x, cy - .9); ctx.lineTo(b.x + .65, cy - .45); ctx.stroke();
    } else if (b.type === 'tower' || b.type === 'spike') {
      ctx.fillStyle = pac ? '#4c4b37' : '#4d2d40';
      ctx.beginPath();
      for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3; const px = b.x + Math.cos(a) * .62, py = cy + Math.sin(a) * .62; n ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(color, .7); ctx.lineWidth = .07; ctx.stroke();
      const angle = this.clock * .25;
      ctx.strokeStyle = '#607285'; ctx.lineWidth = .22; ctx.beginPath(); ctx.moveTo(b.x, cy); ctx.lineTo(b.x + Math.cos(angle) * .64, cy + Math.sin(angle) * .64); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(b.x, cy, .23, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#142538'; rect(ctx, b.x - .82, cy - .68, 1.64, 1.25, .1); ctx.fill();
      ctx.strokeStyle = rgba(color, .6); ctx.lineWidth = .06; rect(ctx, b.x - .68, cy - .57, 1.36, 1.02, .07); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(b.x - .44, cy - .19, .88, .11); ctx.fillRect(b.x - .055, cy - .57, .11, .88);
      ctx.fillStyle = '#526477'; ctx.fillRect(b.x - .75, cy + .56, 1.5, .18);
    }
    const progress = Number.isFinite(b.progress) ? b.progress : 1;
    if (progress < 1) {
      ctx.fillStyle = 'rgba(6,13,23,.56)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = rgba(color, .75); ctx.lineWidth = .05; ctx.setLineDash([.12, .12]); ctx.strokeRect(x + .15, y + .15, w - .3, h - .3); ctx.setLineDash([]);
      ctx.fillStyle = '#0c1523'; ctx.fillRect(x + .25, b.y + .1, w - .5, .15);
      ctx.fillStyle = color; ctx.fillRect(x + .25, b.y + .1, (w - .5) * clamp(progress, 0, 1), .15);
    }
    ctx.restore();
    if (!remembered) this._teamPennant(ctx, b);
    if (!remembered && (selected || b.hp < b.maxHp)) this._bar(ctx, b.x, y - .22, Math.max(1.4, w * .7), b.hp / b.maxHp, color, .12);
  }

  _drawBuildingSprite(ctx, b, selected, remembered = false) {
    const atlas = this.teamBuildingAtlases.get(b.teamId) || this.buildingAtlas || this.assets.buildings;
    const sw = (atlas.naturalWidth || atlas.width) / 4, sh = (atlas.naturalHeight || atlas.height) / 2;
    const color = this._teamColor(b);
    const w = b.w || BUILDING_DEFS[b.type]?.w || 3, h = b.h || BUILDING_DEFS[b.type]?.h || 3;
    const progress = Number.isFinite(b.progress) ? b.progress : 1;
    const dw = w + (b.isHQ ? 1.9 : 1.1), dh = h + (b.isHQ ? 2.1 : 1.2);
    const dx = b.x - dw / 2, dy = b.y + h / 2 + .08 - dh;
    ctx.save();
    if (remembered) ctx.globalAlpha = .25;
    ctx.fillStyle = 'rgba(1,5,12,.62)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + h * .18, w * .56, h * .36, 0, 0, Math.PI * 2); ctx.fill();
    const glow = ctx.createRadialGradient(b.x, b.y + .15, .2, b.x, b.y + .15, w * .75);
    glow.addColorStop(0, rgba(b.type === 'well' ? C.teal : color, b.isHQ ? .16 : b.forge > 0 ? .18 : .065));
    glow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = glow; ctx.fillRect(b.x - w, b.y - h, w * 2, h * 2);
    if (selected) {
      ctx.strokeStyle = color; ctx.lineWidth = .055; ctx.setLineDash([.17, .12]);
      ctx.strokeRect(b.x - w / 2 - .12, b.y - h / 2 - .12, w + .24, h + .24); ctx.setLineDash([]);
    }
    const drawFrame = (index, opacity = 1) => {
      ctx.save(); ctx.globalAlpha *= opacity; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas, (index % 4) * sw, Math.floor(index / 4) * sh, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    };
    const frame = BUILDING_SPRITES[b.type] ?? 0;
    if (progress < 1) {
      drawFrame(frame, .25);
      drawFrame(BUILDING_SPRITES.construction, .95);
      ctx.strokeStyle = rgba(color, .52); ctx.lineWidth = .035; ctx.setLineDash([.12, .12]);
      ctx.strokeRect(b.x - w / 2, b.y - h / 2, w, h); ctx.setLineDash([]);
    } else drawFrame(frame);
    if (b.isHQ) {
      // Keep the generated fortress art, with a unique crown and heraldic flags.
      ctx.save(); ctx.translate(b.x, dy + .30);
      ctx.fillStyle = '#21132d'; ctx.strokeStyle = '#ffb2dd'; ctx.lineWidth = .045;
      ctx.beginPath(); ctx.moveTo(-.36, .1); ctx.lineTo(-.44, -.25); ctx.lineTo(-.19, -.10); ctx.lineTo(0, -.40); ctx.lineTo(.19, -.10); ctx.lineTo(.44, -.25); ctx.lineTo(.36, .1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd5ee'; ctx.fillRect(-.035, -.15, .07, .10); ctx.restore();
      for (const direction of [-1, 1]) {
        const x = b.x + direction * (w / 2 + .22), y = b.y + .5;
        ctx.strokeStyle = '#9585ad'; ctx.lineWidth = .055; ctx.beginPath(); ctx.moveTo(x, y + .3); ctx.lineTo(x, y - 1.1); ctx.stroke();
        ctx.fillStyle = '#983d73'; ctx.strokeStyle = '#e989bb'; ctx.lineWidth = .025;
        ctx.beginPath(); ctx.moveTo(x, y - 1.06); ctx.lineTo(x + direction * .48, y - .88); ctx.lineTo(x + direction * .39, y - .48); ctx.lineTo(x, y - .64); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd2e5'; ctx.beginPath(); ctx.arc(x + direction * .20, y - .80, .055, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (b.type === 'well' && b.forge > 0) {
      const a = this.clock * 2;
      ctx.strokeStyle = rgba(C.teal, .75); ctx.lineWidth = .055;
      ctx.beginPath(); ctx.arc(b.x, b.y, w * .4, a, a + Math.PI * 1.4); ctx.stroke();
    }
    ctx.restore();
    if (!remembered) {
      this._teamPennant(ctx, b);
      if (!b.isHQ && (selected || b.hp < b.maxHp)) this._bar(ctx, b.x, dy - .12, Math.max(1.4, w * .7), b.hp / b.maxHp, color, .12);
      if (progress < 1) this._bar(ctx, b.x, b.y + h / 2 + .2, w * .85, progress, C.teal, .11);
      else if (selected && b.queue?.length) {
        const first = b.queue[0], total = first.total || first.remaining || 1;
        this._bar(ctx, b.x, b.y + h / 2 + .2, w * .85, 1 - (first.remaining || 0) / total, C.teal, .075);
      }
    }
  }

  _drawHealingRanges(ctx, selected) {
    for (const b of this.game.buildings) {
      const def = BUILDING_DEFS[b.type];
      if (!alive(b) || !this._owns(b) || !selected.has(b.id) || b.progress < 1 || !def?.healRange || !this._inView(b.x, b.y, def.healRange)) continue;
      const cells = this._spellCells(b.x, b.y, def.healRange, `heal-${b.id}`);
      ctx.save(); this._clipSpell(ctx, cells);
      ctx.fillStyle = 'rgba(137,239,176,.065)';
      ctx.beginPath(); ctx.arc(b.x, b.y, def.healRange, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([.17, .14]); ring(ctx, b.x, b.y, def.healRange, C.green, .045, .6); ctx.setLineDash([]);
      for (const cell of cells) if (Math.hypot(cell.x + .5 - b.x, cell.y + .5 - b.y) < def.healRange - .8) {
        ctx.fillStyle = 'rgba(137,239,176,.25)'; ctx.fillRect(cell.x + .46, cell.y + .33, .08, .34); ctx.fillRect(cell.x + .33, cell.y + .46, .34, .08);
      }
      ctx.restore();
    }
  }

  _drawBuildingLabels(ctx, selected) {
    const types = Object.keys(BUILDING_DEFS).filter(type => BUILDING_DEFS[type].side === this.game.side);
    const keys = ['Z', 'C', 'V', 'N', 'G'];
    for (const b of this.game.buildings) {
      if (!alive(b) || !this._owns(b) || b.isHQ || !this._inView(b.x, b.y, 5) || (this.camera.zoom < .60 && !selected.has(b.id))) continue;
      const def = BUILDING_DEFS[b.type]; if (!def) continue;
      const h = b.h || def.h || 3, sprite = b.type !== 'sanctuary' && !!(this.buildingAtlas || this.assets.buildings);
      const y = b.y - h / 2 - (sprite ? 1.33 : .68), key = keys[types.indexOf(b.type)];
      this._worldLabel(ctx, `${key ? 'B ' + key + '  ' : ''}${def.name.toUpperCase()}`, b.x, y, this._teamColor(b), selected.has(b.id) ? 11 : 10);
      const state = b.progress < 1 ? 'UNDER CONSTRUCTION' : b.type === 'sanctuary' ? (b.healingCount > 0 ? `HEALING ${b.healingCount} ALLIES` : `HEALING · ${def.healRate} HP/s`) : def.role || '';
      if (state && (this.camera.zoom >= .78 || selected.has(b.id))) this._worldLabel(ctx, state, b.x, y + 14 / (TILE * this.camera.zoom), b.type === 'sanctuary' ? C.green : C.white, 9);
    }
  }

  _drawHidingPlaces(ctx) {
    if (this.camera.zoom < .6) return;
    for (const place of this.game.map.hidingPlaces || []) {
      if (!this._inView(place.x, place.y, 4) || !this._visible(place.x, place.y)) continue;
      const halfW = (place.w || 7) / 2 - .45, halfH = (place.h || 7) / 2 - .45;
      ctx.save(); ctx.strokeStyle = 'rgba(157,192,133,.50)'; ctx.lineWidth = .045;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const x = place.x + dx * halfW, y = place.y + dy * halfH;
        ctx.beginPath(); ctx.moveTo(x - dx * .55, y); ctx.lineTo(x, y); ctx.lineTo(x, y - dy * .55); ctx.stroke();
      }
      ctx.restore();
      this._worldLabel(ctx, 'RUIN COVER', place.x, place.y + halfH + .4, '#bdd89d', 10);
    }
  }

  _drawHQOverlay(ctx, selected) {
    for (const b of this.game.buildings) {
      if (!alive(b) || !b.isHQ || !this._inView(b.x, b.y, 6) || (b.side !== this.game.side && !this._visible(b.x, b.y))) continue;
      const w = b.w || 3, h = b.h || 3, dy = b.y + h / 2 + .08 - h - 2.1;
      this._bar(ctx, b.x, dy - .12, Math.max(2.8, w * .95, 44 / (TILE * this.camera.zoom)), b.hp / b.maxHp, C.ghost, .13 / this.camera.zoom);
      this._worldLabel(ctx, selected.has(b.id) ? `CITADEL  ${Math.ceil(b.hp).toLocaleString()} / ${b.maxHp.toLocaleString()}` : 'GHOST CITADEL', b.x, dy - .28, '#ffd0e8', 11);
    }
  }

  _bar(ctx, x, y, width, fraction, color, height = .085) {
    ctx.fillStyle = 'rgba(2,7,15,.85)'; rect(ctx, x - width / 2 - .035, y - .035, width + .07, height + .07, .03); ctx.fill();
    ctx.fillStyle = '#283344'; ctx.fillRect(x - width / 2, y, width, height);
    ctx.fillStyle = fraction < .3 ? C.red : color; ctx.fillRect(x - width / 2, y, width * clamp(fraction, 0, 1), height);
  }

  _fallbackUnit(ctx, unit, frame, size) {
    ctx.save(); ctx.scale(size / 16, size / 16); ctx.translate(-8, -8);
    const ghost = unit.side === 'ghost', colors = { hunter: '#f47c8d', scout: '#77dce8', binder: '#f0a0d8', brute: '#b59bf0' };
    if (unit.type === 'hero') {
      ctx.fillStyle = this._teamColor(unit); ctx.fillRect(5, 1, 6, 1); ctx.fillRect(3, 2, 10, 2); ctx.fillRect(2, 4, 12, 8); ctx.fillRect(3, 12, 10, 2); ctx.fillRect(5, 14, 6, 1);
      ctx.fillStyle = '#17212d'; ctx.fillRect(8, 3, 2, 2);
      ctx.fillStyle = C.floor; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(16, frame % 3 ? 3 : 6); ctx.lineTo(16, frame % 3 ? 13 : 10); ctx.closePath(); ctx.fill();
    } else if (ghost) {
      ctx.fillStyle = colors[unit.type] || C.ghost; ctx.fillRect(5, 1, 6, 1); ctx.fillRect(3, 2, 10, 2); ctx.fillRect(2, 4, 12, 9);
      for (let n = 0; n < 3; n++) ctx.fillRect(2 + n * 5 + frame % 2, 12, 3, 3);
      ctx.fillStyle = '#f1f3f7'; ctx.fillRect(4, 5, 3, 4); ctx.fillRect(10, 5, 3, 4);
      ctx.fillStyle = '#27354c'; ctx.fillRect(6, 6, 1, 2); ctx.fillRect(12, 6, 1, 2);
    } else {
      const color = this._teamColor(unit);
      ctx.fillStyle = '#111d2a'; ctx.fillRect(3, 5, 10, 8); ctx.fillRect(4, 13, 3, 2); ctx.fillRect(10, 13, 3, 2);
      ctx.fillStyle = color; ctx.fillRect(4, 2, 8, 2); ctx.fillRect(2, 4, 12, 5); ctx.fillRect(4, 9, 8, 3);
      ctx.fillStyle = '#1a2731'; ctx.fillRect(6, 6, 6, 2); ctx.fillStyle = C.white; ctx.fillRect(8, 6, 2, 1);
      ctx.fillStyle = '#9aa8b9'; ctx.fillRect(13, 7, 2, 6); ctx.fillRect(11, 7, 5, 2);
    }
    ctx.restore();
  }

  _drawUnit(ctx, unit, selected, ui) {
    const hero = unit.type === 'hero', pac = unit.side === 'pac', color = this._teamColor(unit);
    const moving = !!unit.path?.length || unit.order?.type === 'move';
    const frame = moving ? Math.floor(this.clock * (hero ? 11 : 8) + Number(String(unit.id).replace(/\D/g, '') || 0)) % 8 : Math.floor(this.clock * 2) % 2;
    const size = hero ? 1.48 : unit.type === 'brute' ? 1.54 : unit.type === 'extractor' ? 1.37 : 1.23;
    const bob = moving ? Math.sin(this.clock * 13 + frame) * .025 : Math.sin(this.clock * 2) * .012;
    ctx.fillStyle = 'rgba(1,5,12,.58)'; ctx.beginPath(); ctx.ellipse(unit.x, unit.y + .22, size * .36, size * .18, 0, 0, Math.PI * 2); ctx.fill();
    // Ownership remains readable while every army keeps its generated sprites.
    ctx.strokeStyle = rgba(color, hero ? .9 : .65); ctx.lineWidth = hero ? .06 : .035;
    ctx.beginPath(); ctx.ellipse(unit.x, unit.y + .17, size * .43, size * .25, 0, 0, Math.PI * 2); ctx.stroke();
    if (unit.powered > 0 || (pac && this.game.powerActive > 0)) {
      const glow = ctx.createRadialGradient(unit.x, unit.y, .15, unit.x, unit.y, 1.1);
      glow.addColorStop(0, 'rgba(112,240,211,.22)'); glow.addColorStop(1, 'rgba(112,240,211,0)');
      ctx.fillStyle = glow; ctx.fillRect(unit.x - 1.1, unit.y - 1.1, 2.2, 2.2);
      ring(ctx, unit.x, unit.y + .08, .62 + Math.sin(this.clock * 7) * .04, C.teal, .045, .75);
    }
    if (selected) {
      ctx.strokeStyle = color; ctx.lineWidth = .055;
      ctx.beginPath(); ctx.ellipse(unit.x, unit.y + .13, size * .48, size * .29, 0, 0, Math.PI * 2); ctx.stroke();
      ring(ctx, unit.x, unit.y, size * .6, color, .025, .15);
      if (ui.showRanges) ring(ctx, unit.x, unit.y, unit.range || UNIT_DEFS[unit.type]?.range || 1, color, .035, .3);
    }
    ctx.save(); ctx.translate(unit.x, unit.y - .13 + bob);
    const facing = Number.isFinite(unit.facing) ? unit.facing : 0;
    if (hero) ctx.rotate(facing);
    else if (Math.cos(facing) < 0) ctx.scale(-1, 1);
    const atlas = this.teamSpriteAtlases.get(unit.teamId) || this.spriteAtlas || this.assets.units;
    if (atlas) {
      const rows = { hero: 0, miner: 1, guardian: 2, engineer: 3, extractor: 3, hunter: 4, scout: 5, binder: 6, brute: 7 };
      const sw = (atlas.naturalWidth || atlas.width) / 8, sh = (atlas.naturalHeight || atlas.height) / 8;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas, frame * sw, (rows[unit.type] ?? 1) * sh, sw, sh, -size / 2, -size / 2, size, size);
    } else this._fallbackUnit(ctx, unit, frame, size);
    ctx.restore();
    if (unit.type === 'extractor') { ctx.fillStyle = C.teal; ctx.fillRect(unit.x - .48, unit.y + .26, .96, .11); }
    if (hero || selected || unit.hp < unit.maxHp) this._bar(ctx, unit.x, unit.y - size * .64, hero ? 1.25 : .95, unit.hp / unit.maxHp, color, hero ? .12 : .085);
    if (hero) this._worldLabel(ctx, 'PAC ' + (unit.teamId === 'pac2' ? '2' : unit.teamId === 'pac3' ? '3' : '1') + (this._owns(unit) ? ' · YOU' : ''), unit.x, unit.y - 1.06, color, 10);
    if (hero && selected) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(unit.x - .12, unit.y + .58); ctx.lineTo(unit.x + .12, unit.y + .58); ctx.lineTo(unit.x, unit.y + .43); ctx.closePath(); ctx.fill();
    }
    this._drawMining(ctx, unit);
    if (unit.cast) {
      const progress = clamp(1 - unit.cast.remaining / (unit.cast.total || 1.25), 0, 1);
      ring(ctx, unit.x, unit.y + .1, .54, '#f48cfa', .04, .65);
      this._bar(ctx, unit.x, unit.y + .67, .85, progress, '#f48cfa', .065);
    }
    this._drawRootStatus(ctx, unit);
  }

  _drawRootStatus(ctx, unit) {
    if (unit.rooted > 0) {
      const color = '#d49dff';
      ctx.save();
      ctx.strokeStyle = rgba(color, .88); ctx.lineWidth = .045;
      ctx.beginPath(); ctx.ellipse(unit.x, unit.y + .25, .58, .30, 0, 0, Math.PI * 2); ctx.stroke();
      for (const angle of [-.42, .42]) {
        ctx.save(); ctx.translate(unit.x, unit.y + .08); ctx.rotate(angle);
        for (let n = 0; n < 5; n++) { ctx.beginPath(); ctx.ellipse(-.48 + n * .24, 0, .13, .065, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
      for (const direction of [-1, 1]) {
        const x = unit.x + direction * .55, y = unit.y + .32;
        ctx.fillStyle = '#aa70dd'; ctx.beginPath(); ctx.moveTo(x, y - .1); ctx.lineTo(x + .08, y); ctx.lineTo(x, y + .1); ctx.lineTo(x - .08, y); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      this._worldLabel(ctx, `${unit.rooted.toFixed(1)}s`, unit.x, unit.y + .96, '#e8c8ff', 11);
    } else if (unit.slow > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(177,148,239,.6)'; ctx.lineWidth = .035;
      for (const direction of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(unit.x + direction * .37, unit.y + .1); ctx.quadraticCurveTo(unit.x + direction * .65, unit.y + .28, unit.x + direction * .35, unit.y + .5); ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawMining(ctx, unit) {
    const order = unit.order;
    if (!order || unit.type === 'hero') return;
    const progress = unit.mineProgress ?? order.progress ?? 0;
    const targetId = unit.mineTarget ?? unit.miningTarget ?? order.pelletId ?? order.targetId;
    const pellet = this.game.pellets.get(Number(targetId));
    const target = pellet || (progress > 0 && Number.isFinite(order.x) && Number.isFinite(order.y) ? order : null);
    if (!target || progress <= 0 || Math.hypot(target.x - unit.x, target.y - unit.y) > (unit.type === 'extractor' ? 6.5 : 2)) return;
    ctx.strokeStyle = rgba(unit.type === 'extractor' ? C.teal : C.pacSoft, .75);
    ctx.lineWidth = unit.type === 'extractor' ? .055 : .035;
    ctx.setLineDash([.07, .07]); ctx.lineDashOffset = -this.clock;
    ctx.beginPath(); ctx.moveTo(unit.x + .2, unit.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    const spin = this.clock * 5;
    ctx.strokeStyle = C.pac; ctx.lineWidth = .04;
    ctx.beginPath(); ctx.arc(target.x, target.y, .3, spin, spin + 1.7); ctx.stroke();
    const fraction = order.duration ? progress / order.duration : progress > 1 ? Math.min(.95, progress / (pellet?.type === 'large' ? 7 : 1.2)) : progress;
    this._bar(ctx, unit.x, unit.y + .64, .75, fraction, C.teal, .055);
  }

  _drawOrders(ctx, selected) {
    for (const unit of this.game.units) {
      if (!alive(unit) || !this._owns(unit) || !selected.has(unit.id)) continue;
      const points = unit.path || [];
      if (!points.length) continue;
      ctx.strokeStyle = rgba(this._teamColor(unit), .34); ctx.lineWidth = .035; ctx.setLineDash([.13, .13]);
      ctx.beginPath(); ctx.moveTo(unit.x, unit.y);
      for (const point of points) { const x = Array.isArray(point) ? point[0] : point.x, y = Array.isArray(point) ? point[1] : point.y; ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
      const last = points[points.length - 1], x = Array.isArray(last) ? last[0] : last.x, y = Array.isArray(last) ? last[1] : last.y;
      ring(ctx, x, y, .23, this._teamColor(unit), .04, .7);
      ctx.strokeStyle = rgba(this._teamColor(unit), .7); ctx.lineWidth = .035;
      ctx.beginPath(); ctx.moveTo(x - .35, y); ctx.lineTo(x - .15, y); ctx.moveTo(x + .15, y); ctx.lineTo(x + .35, y); ctx.moveTo(x, y - .35); ctx.lineTo(x, y - .15); ctx.moveTo(x, y + .15); ctx.lineTo(x, y + .35); ctx.stroke();
    }
  }

  _drawEffects(ctx) {
    for (const effect of this.game.effects || []) {
      if (effect.type === 'binder-windup') continue;
      if (!this._inView(effect.x, effect.y, 3)) continue;
      const snareCells = effect.type === 'snare' ? this._spellCells(effect.x, effect.y, effect.radius || 2.1, effect.castId || effect.id || null) : null;
      if (snareCells ? !this._knowsSpell({ side: effect.side }, effect, snareCells) : !this._visible(effect.x, effect.y)) continue;
      if (effect.type === 'bounty' && effect.side !== this.game.side) continue;
      const max = effect.maxLife || .8, ratio = clamp((effect.life ?? max) / max, 0, 1), age = 1 - ratio;
      const color = effect.side === 'ghost' ? C.ghost : effect.type === 'power' ? C.teal : C.pac;
      ctx.save(); ctx.globalAlpha = ratio;
      if (effect.type === 'snare') {
        this._clipSpell(ctx, snareCells);
        const radius = effect.radius || 2.1;
        ctx.fillStyle = `rgba(220,107,248,${ratio * .14})`;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.fill();
        ring(ctx, effect.x, effect.y, radius * (.55 + age * .45), '#efabff', .10, ratio);
        ring(ctx, effect.x, effect.y, radius * (1 - age * .65), '#bc87ff', .055, ratio * .8);
      } else if (effect.type === 'bounty') {
        const fontSize = 12 / (TILE * this.camera.zoom);
        ctx.font = `500 ${fontSize}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineJoin = 'round'; ctx.lineWidth = .08 / this.camera.zoom;
        const text = effect.text || `+${effect.amount || 0} Dread`, y = effect.y - .45 - age * .9;
        ctx.strokeStyle = 'rgba(3,7,15,.95)'; ctx.strokeText(text, effect.x, y);
        ctx.fillStyle = C.ghostSoft; ctx.fillText(text, effect.x, y);
      } else if (effect.type === 'heal') {
        const y = effect.y - .55 - age * .6;
        ring(ctx, effect.x, effect.y + .15, .4 + age * .28, C.green, .045, ratio * .6);
        ctx.fillStyle = C.green; ctx.fillRect(effect.x - .04, y - .15, .08, .3); ctx.fillRect(effect.x - .15, y - .04, .3, .08);
      } else if (effect.type === 'power' || effect.type === 'surge') {
        ring(ctx, effect.x, effect.y, .5 + age * 4, C.teal, .08, ratio);
        ring(ctx, effect.x, effect.y, .2 + age * 3.3, C.pacSoft, .04, ratio * .65);
      } else if (effect.type === 'shot' || effect.type === 'projectile' || effect.type === 'attack' || effect.type === 'bolt') {
        const tx = effect.targetX ?? effect.tx ?? effect.x, ty = effect.targetY ?? effect.ty ?? effect.y;
        ctx.strokeStyle = color; ctx.lineWidth = .055;
        ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(tx, ty); ctx.stroke();
        ring(ctx, tx, ty, .1 + age * .28, color, .045, ratio);
      } else if (effect.type === 'death') {
        for (let n = 0; n < 7; n++) { const a = n * Math.PI * 2 / 7, distance = .15 + age * .8; ctx.fillStyle = color; ctx.fillRect(effect.x + Math.cos(a) * distance - .05, effect.y + Math.sin(a) * distance - .05, .1, .1); }
      } else {
        ring(ctx, effect.x, effect.y, .08 + age * .46, color, .04, ratio);
        if (effect.type === 'harvest' || effect.type === 'pellet') { ctx.fillStyle = C.pacSoft; ctx.fillRect(effect.x - .035, effect.y - age * .7, .07, .1); }
      }
      ctx.restore();
    }
  }

  _updateFog() {
    const tick = Math.floor(this.clock * 12);
    if (tick === this._fogTick) return;
    this._fogTick = tick;
    const { width, height, tiles } = this.game.map;
    const visible = this.game.visible[this.game.side], explored = this.game.explored[this.game.side];
    const ctx = this.fogCtx;
    ctx.clearRect(0, 0, width * 4, height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const k = y * width + x;
      if (visible?.[k]) continue;
      const alpha = explored?.[k] ? .63 : tiles[k] ? .88 : .65;
      ctx.fillStyle = `rgba(3,7,17,${alpha})`; ctx.fillRect(x * 4, y * 4, 4, 4);
    }
  }

  _drawBuild(ctx, type, world) {
    if (!type || !world || !BUILDING_DEFS[type]) return;
    const def = BUILDING_DEFS[type];
    const w = def.w || 3, h = def.h || 3;
    let x = Math.floor(world.x - w / 2) + w / 2, y = Math.floor(world.y - h / 2) + h / 2;
    let valid = false;
    try { const result = this.game.canBuild(type, world.x, world.y); valid = !!result?.ok; x = result?.x ?? x; y = result?.y ?? y; } catch {}
    const color = valid ? C.green : C.red;
    ctx.fillStyle = rgba(color, .17); ctx.strokeStyle = color; ctx.lineWidth = .065;
    rect(ctx, x - w / 2, y - h / 2, w, h, .08); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba(color, .25); ctx.lineWidth = .025;
    for (let n = 1; n < w; n++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + n, y - h / 2); ctx.lineTo(x - w / 2 + n, y + h / 2); ctx.stroke(); }
    for (let n = 1; n < h; n++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2 + n); ctx.lineTo(x + w / 2, y - h / 2 + n); ctx.stroke(); }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, .12, 0, Math.PI * 2); ctx.fill();
  }

  render(dt = 0, ui = {}) {
    if (this._destroyed || !this.game) return;
    this.clock += Math.max(0, Math.min(dt, .1));
    this.resize();
    const ctx = this.ctx, game = this.game, selected = ui.selected instanceof Set ? ui.selected : new Set(ui.selected || []);
    const scale = TILE * this.camera.zoom;
    this.bounds = { left: this.camera.x - this.width / scale / 2, right: this.camera.x + this.width / scale / 2, top: this.camera.y - this.height / scale / 2, bottom: this.camera.y + this.height / scale / 2 };
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.background; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(this.width / 2, this.height / 2); ctx.scale(scale, scale); ctx.translate(-this.camera.x, -this.camera.y);
    ctx.imageSmoothingEnabled = this.camera.zoom < .65;
    ctx.drawImage(this.terrainCanvas, 0, 0, game.map.width, game.map.height);
    this._drawHidingPlaces(ctx);
    this._drawPellets(ctx);
    this._drawHealingRanges(ctx, selected);
    this._drawCastTelegraphs(ctx, false);
    const currentBuildings = new Set();
    for (const b of game.buildings) {
      if (!alive(b)) continue;
      currentBuildings.add(b.id);
      if (b.side === game.side || this._visible(b.x, b.y)) {
        if (b.side !== game.side) this.rememberedBuildings.set(b.id, { ...b });
        if (this._inView(b.x, b.y, Math.max(b.w || 3, b.h || 3))) this._drawBuilding(ctx, b, selected.has(b.id));
      }
    }
    for (const [id, b] of this.rememberedBuildings) {
      if (this._visible(b.x, b.y)) { if (!currentBuildings.has(id)) this.rememberedBuildings.delete(id); continue; }
      if (this._inView(b.x, b.y, 4)) this._drawBuilding(ctx, b, false, true);
    }
    const units = game.units.filter(u => alive(u) && this._inView(u.x, u.y, 2) && (u.side === game.side || this._visible(u.x, u.y))).sort((a, b) => a.y - b.y);
    for (const unit of units) this._drawUnit(ctx, unit, selected.has(unit.id), ui);
    this._drawEffects(ctx);
    this._updateFog();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, game.map.width, game.map.height);
    this._drawHQOverlay(ctx, selected);
    this._drawBuildingLabels(ctx, selected);
    this._drawCastTelegraphs(ctx, true);
    this._drawOrders(ctx, selected);
    this._drawBuild(ctx, ui.buildType, ui.mouseWorld);
    if (ui.snarePreview) this._drawSnarePreview(ctx, ui.mouseWorld, selected);
    ctx.restore();
    if (ui.drag) {
      const d = ui.drag;
      const playerColor=this._teamColor({teamId:game.playerTeam,side:game.side});
      ctx.fillStyle = rgba(playerColor, .17); ctx.strokeStyle = rgba(playerColor, 1); ctx.lineWidth = 2;
      ctx.fillRect(Math.min(d.x1, d.x2), Math.min(d.y1, d.y2), Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1));
      ctx.strokeRect(Math.min(d.x1, d.x2) + .5, Math.min(d.y1, d.y2) + .5, Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1));
      const label=(d.count||0)+' troops',lx=Math.min(d.x1,d.x2),ly=Math.max(20,Math.min(d.y1,d.y2)-7);
      ctx.font='500 12px Segoe UI, sans-serif';ctx.fillStyle='rgba(8,16,27,.94)';ctx.fillRect(lx,ly-15,67,20);ctx.fillStyle=playerColor;ctx.fillText(label,lx+6,ly);
    }
    // A quiet vignette adds depth while keeping the center of the battlefield clear.
    const vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .22, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .68);
    vignette.addColorStop(0, 'rgba(2,5,13,0)'); vignette.addColorStop(1, 'rgba(2,5,13,.30)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.width, this.height);
  }

  drawMinimap(canvas, ui = {}) {
    if (!canvas || !this.game || this._destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || 220)), height = Math.max(1, Math.round(bounds.height || 165));
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    const ctx = canvas.getContext('2d', { alpha: false }), game = this.game, w = game.map.width, h = game.map.height;
    const scale = Math.min(width / w, height / h), ox = (width - w * scale) / 2, oy = (height - h * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.background; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.miniTerrain, 0, 0, w, h);
    ctx.globalAlpha = .42;
    if (game.side === 'ghost') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (game.knownPelletsGhost?.[y * w + x]) { ctx.fillStyle = C.pac; ctx.fillRect(x + .25, y + .25, .5, .5); }
    } else {
      ctx.fillStyle = C.pac;
      for (const p of game.pellets.values()) ctx.fillRect(p.x - .2, p.y - .2, .4, .4);
    }
    ctx.globalAlpha = 1; this._updateFog(); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.fogCanvas, 0, 0, w, h);
    for (const b of game.buildings) if (alive(b) && (b.side === game.side || this._visible(b.x, b.y))) {
      ctx.fillStyle = this._teamColor(b); ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      if (b.isHQ) { ctx.strokeStyle = '#ffd0e8'; ctx.lineWidth = .4; ctx.strokeRect(b.x - 1.7, b.y - 1.7, 3.4, 3.4); }
    }
    for (const u of game.units) if (alive(u) && (u.side === game.side || this._visible(u.x, u.y))) {
      ctx.fillStyle = this._teamColor(u);
      ctx.beginPath(); ctx.arc(u.x, u.y, u.type === 'hero' ? 1.15 : .65, 0, Math.PI * 2); ctx.fill();
      if (u.type === 'hero') { ctx.strokeStyle = C.white; ctx.lineWidth = .4; ctx.stroke(); }
    }
    const viewportW = this.width / (TILE * this.camera.zoom), viewportH = this.height / (TILE * this.camera.zoom);
    ctx.strokeStyle = 'rgba(226,240,255,.9)'; ctx.lineWidth = Math.max(.32, 1 / scale);
    ctx.strokeRect(this.camera.x - viewportW / 2, this.camera.y - viewportH / 2, viewportW, viewportH);
    ctx.restore();
  }

  destroy() {
    this._destroyed = true;
    this._resizeObserver?.disconnect();
    this.rememberedBuildings.clear();
    this._spellAreaCache.clear();
  }
}
