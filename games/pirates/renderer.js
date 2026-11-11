/* Crown of the Tides · illustrated, dependency-free canvas renderer. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const hash = (x, y = 0) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };
  const seeded = seed => {
    let n = (Number(seed) || 731) >>> 0;
    return () => {
      n += 0x6D2B79F5;
      let x = n;
      x = Math.imul(x ^ x >>> 15, x | 1);
      x ^= x + Math.imul(x ^ x >>> 7, x | 61);
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  };
  function rounded(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function hullPath(ctx, L, W, scale = 1, kind = '') {
    const l = L * scale, w = W * scale;
    ctx.beginPath();
    if (kind === 'ironclad') {
      ctx.moveTo(l * .54, 0); ctx.lineTo(l * .36, -w * .40); ctx.lineTo(-l * .34, -w * .48);
      ctx.lineTo(-l * .49, -w * .29); ctx.lineTo(-l * .49, w * .29); ctx.lineTo(-l * .34, w * .48);
      ctx.lineTo(l * .36, w * .40); ctx.closePath(); return;
    }
    if (kind === 'bombard') {
      ctx.moveTo(l * .52, 0); ctx.bezierCurveTo(l * .48, -w * .31, l * .29, -w * .51, l * .07, -w * .50);
      ctx.lineTo(-l * .43, -w * .46); ctx.quadraticCurveTo(-l * .52, -w * .43, -l * .51, -w * .24);
      ctx.lineTo(-l * .51, w * .24); ctx.quadraticCurveTo(-l * .52, w * .43, -l * .43, w * .46);
      ctx.lineTo(l * .07, w * .50); ctx.bezierCurveTo(l * .29, w * .51, l * .48, w * .31, l * .52, 0); ctx.closePath(); return;
    }
    if (kind === 'galley') {
      ctx.moveTo(l * .61, 0); ctx.bezierCurveTo(l * .43, -w * .15, l * .32, -w * .43, l * .02, -w * .46);
      ctx.bezierCurveTo(-l * .26, -w * .46, -l * .42, -w * .28, -l * .53, -w * .09);
      ctx.quadraticCurveTo(-l * .57, 0, -l * .53, w * .09); ctx.bezierCurveTo(-l * .42, w * .28, -l * .26, w * .46, l * .02, w * .46);
      ctx.bezierCurveTo(l * .32, w * .43, l * .43, w * .15, l * .61, 0); ctx.closePath(); return;
    }
    if (kind === 'cutter') {
      ctx.moveTo(l * .57, 0); ctx.bezierCurveTo(l * .34, -w * .23, l * .16, -w * .50, -l * .08, -w * .48);
      ctx.bezierCurveTo(-l * .27, -w * .47, -l * .42, -w * .31, -l * .48, -w * .21);
      ctx.quadraticCurveTo(-l * .52, 0, -l * .48, w * .21); ctx.bezierCurveTo(-l * .42, w * .31, -l * .27, w * .47, -l * .08, w * .48);
      ctx.bezierCurveTo(l * .16, w * .50, l * .34, w * .23, l * .57, 0); ctx.closePath(); return;
    }
    ctx.moveTo(l * .54, 0);
    ctx.bezierCurveTo(l * .41, -w * .30, l * .26, -w * .51, l * .04, -w * .50);
    ctx.bezierCurveTo(-l * .20, -w * .50, -l * .37, -w * .46, -l * .49, -w * .34);
    ctx.quadraticCurveTo(-l * .54, 0, -l * .49, w * .34);
    ctx.bezierCurveTo(-l * .37, w * .46, -l * .20, w * .50, l * .04, w * .50);
    ctx.bezierCurveTo(l * .26, w * .51, l * .41, w * .30, l * .54, 0);
    ctx.closePath();
  }
  function coastPath(ctx, points, scale = 1) {
    const n = points.length;
    ctx.beginPath();
    ctx.moveTo((points[n - 1].x + points[0].x) * scale / 2, (points[n - 1].y + points[0].y) * scale / 2);
    for (let i = 0; i < n; i++) {
      const p = points[i], next = points[(i + 1) % n];
      ctx.quadraticCurveTo(p.x * scale, p.y * scale, (p.x + next.x) * scale / 2, (p.y + next.y) * scale / 2);
    }
    ctx.closePath();
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  const faction = ship => ship.flagColor || ({ player: '#d8b55e', ally: '#68bfc1', enemy: '#cb5a46', neutral: '#e3d2a2' }[ship.team] || '#dcc48a');
  const tint = (hex, amount) => {
    if (!/^#[\da-f]{6}$/i.test(hex || '')) return '#0d6973';
    const n = parseInt(hex.slice(1), 16), channels = [n >> 16, n >> 8 & 255, n & 255];
    return `rgb(${channels.map(v => Math.round(clamp(v + amount, 0, 255))).join(',')})`;
  };

  class PirateRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.islandCache = new Map();
      this.lastWidth = 0; this.lastHeight = 0;
      this.zoom = .72;
      this.resize();
    }

    resize() {
      const width = Math.max(1, this.canvas.clientWidth || innerWidth || 1280);
      const height = Math.max(1, this.canvas.clientHeight || innerHeight || 720);
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      if (width !== this.lastWidth || height !== this.lastHeight || this.canvas.width !== Math.round(width * this.dpr)) {
        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.lastWidth = width; this.lastHeight = height;
      }
      this.width = width; this.height = height;
    }

    visible(x, y, radius = 0) {
      return x + radius > this.left && x - radius < this.right && y + radius > this.top && y - radius < this.bottom;
    }

    render(S) {
      this.resize();
      const ctx = this.ctx, w = this.width, h = this.height;
      const camera = S.camera || { x: S.player.x, y: S.player.y, zoom: .65 };
      this.zoom = clamp(camera.zoom || .65, .10, 2.4);
      this.time = S.mode === 'title' ? performance.now() / 1000 : S.t || 0; this.state = S;
      this.left = camera.x - w / this.zoom / 2 - 100;
      this.right = camera.x + w / this.zoom / 2 + 100;
      this.top = camera.y - h / this.zoom / 2 - 100;
      this.bottom = camera.y + h / this.zoom / 2 + 100;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawSeaBackground(S);
      const shake = Number(camera.shake) || 0;
      ctx.save();
      ctx.translate(w / 2 + Math.sin(this.time * 83) * shake, h / 2 + Math.cos(this.time * 71) * shake * .65);
      ctx.scale(this.zoom, this.zoom); ctx.translate(-camera.x, -camera.y);
      this.drawWaves(S);
      for (const island of S.islands || []) if (this.visible(island.x, island.y, island.grandPort || island.tier >= 3 ? island.r * 1.9 + 160 : island.r * 1.5)) this.drawIsland(island);
      this.drawNavigation(S);
      const vessels = (S.ships || []).filter(s => (s.hp > 0 || s.sinking) && this.visible(s.x, s.y, s.L));
      for (const ship of vessels) this.drawWake(ship);
      this.drawGrapples(S);
      for (const loot of S.loot || []) if (this.visible(loot.x, loot.y, 70)) this.drawLoot(loot);
      for (const ship of vessels.slice().sort((a, b) => a.y - b.y)) this.drawShip(ship);
      this.drawBoarders(S);
      for (const p of S.projectiles || []) if (this.visible(p.x, p.y, p.weapon === 'mortar' ? 650 : 100)) this.drawProjectile(p);
      for (const effect of S.effects || []) if (this.visible(effect.x, effect.y, (effect.size || 30) * 4 + 100)) this.drawEffect(effect);
      ctx.restore();
      this.drawWeather(S);
      this.drawCrewBadges(S, vessels);
      this.drawTargetBearing(S);
      this.drawCompass(S);
      const vignette = ctx.createRadialGradient(w * .5, h * .45, Math.min(w, h) * .18, w * .5, h * .5, Math.max(w, h) * .7);
      vignette.addColorStop(0, 'rgba(0,12,20,0)'); vignette.addColorStop(1, 'rgba(0,12,20,.32)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
      if (S.boardingFocus && S.mode === 'play') this.drawBoardingArena(S);
    }

    drawBoardingArena(S) {
      const canvas = document.getElementById('boarding-arena'), ship = S.grapple;
      if (!canvas?.getContext || !ship || ship.hp <= 0 || !ship.boardingCombat) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!(w > 0 && h > 0)) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const ctx = canvas.getContext('2d'), battle = ship.boardingCombat, t = S.t || 0;
      const own = member => ['player', 'ally'].includes(member.team);
      const skeleton = ship.skeleton || ship.kind === 'ghost';
      const pad = Math.max(10, Math.min(25, w * .035)), left = pad, right = w - pad;
      const center = h * .51, depth = Math.max(85, Math.min(h * .64, w * .42)), top = center - depth / 2, bottom = center + depth / 2;
      const span = right - left, innerLeft = left + span * .065, innerRight = right - span * .10;
      const map = (x, y) => ({ x: innerLeft + clamp((x / Math.max(1, ship.L) + .4) / .78, 0, 1) * (innerRight - innerLeft), y: center + y / Math.max(1, ship.W) * depth * .83 });
      const zoneX = { helm: w / 6, guns: w / 2, bow: w * 5 / 6 };
      const zones = [{ id:'helm', name:'HELM', mark:'I' }, { id:'guns', name:'GUN DECK', mark:'II' }, { id:'bow', name:'BOW', mark:'III' }];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sea = ctx.createLinearGradient(0, 0, w, h);
      sea.addColorStop(0, skeleton ? '#142f31' : '#0b2632'); sea.addColorStop(.6, skeleton ? '#23413e' : '#173c46'); sea.addColorStop(1, '#091f2b');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
      for (let n = 0; n < 15; n++) {
        const x = (n * 91 + t * 15) % (w + 80) - 40, y = (n * 53 + 13) % Math.max(1, h);
        line(ctx, x, y, x + 24, y - 3, 'rgba(163,218,207,.055)', 1);
      }
      // A low, cropped strip of the flagship and a timber gangway make arrival readable.
      const landing = zoneX[battle.landing || 'guns'] ?? zoneX.guns;
      rounded(ctx, landing - 76, h - 13, 152, 45, 12); ctx.fillStyle = '#573f2b'; ctx.fill();
      line(ctx, landing - 70, h - 10, landing + 70, h - 10, '#c2a66b', 4);
      const plankY = bottom - depth * .12, plankWidth = Math.max(17, Math.min(30, w * .04));
      ctx.fillStyle = '#8f6c43'; ctx.fillRect(landing - plankWidth / 2, plankY, plankWidth, h - plankY);
      for (let y = plankY + 6; y < h; y += 9) line(ctx, landing - plankWidth / 2, y, landing + plankWidth / 2, y, '#4a3829', 1.5);
      for (const side of [-1, 1]) { line(ctx, landing + side * plankWidth / 2, plankY, landing + side * (plankWidth / 2 + 8), h, '#bfa775', 2); }
      const deckPath = () => {
        ctx.beginPath(); ctx.moveTo(right, center);
        ctx.bezierCurveTo(right - span * .06, top + depth * .10, right - span * .20, top, right - span * .31, top);
        ctx.lineTo(left + span * .065, top + depth * .04);
        ctx.quadraticCurveTo(left - span * .015, center, left + span * .065, bottom - depth * .04);
        ctx.lineTo(right - span * .31, bottom);
        ctx.bezierCurveTo(right - span * .20, bottom, right - span * .06, bottom - depth * .10, right, center); ctx.closePath();
      };
      ctx.save(); ctx.translate(3, 9); deckPath(); ctx.fillStyle = 'rgba(1,13,18,.4)'; ctx.fill(); ctx.restore();
      deckPath(); ctx.fillStyle = '#493a2b'; ctx.fill(); ctx.strokeStyle = skeleton ? '#9caa7d' : '#c1a36b'; ctx.lineWidth = 8; ctx.stroke();
      ctx.save(); deckPath(); ctx.clip();
      const wood = ctx.createLinearGradient(0, top, 0, bottom);
      wood.addColorStop(0, skeleton ? '#79775a' : '#b08c56'); wood.addColorStop(.46, skeleton ? '#77745b' : '#aa8651'); wood.addColorStop(1, skeleton ? '#555e4d' : '#805e3f');
      ctx.fillStyle = wood; ctx.fillRect(left, top, span, depth);
      const plank = Math.max(10, Math.min(17, depth / 12));
      for (let y = top; y < bottom; y += plank) {
        line(ctx, left, y, right, y, '#5b4934', 1.3);
        const row = Math.floor((y - top) / plank);
        for (let x = left + (row % 2) * 36; x < right; x += 82) {
          line(ctx, x, y + 1, x, y + plank - 1, 'rgba(65,48,31,.34)', 1);
          line(ctx, x + 9, y + plank * .42, x + 47, y + plank * .42, 'rgba(230,206,146,.09)', .7);
          circle(ctx, x + 4, y + 4, .8, '#493b2d');
        }
      }
      for (let n = 1; n < 3; n++) line(ctx, w * n / 3, top, w * n / 3, bottom, 'rgba(37,42,34,.27)', 2);
      for (const zone of zones) {
        const controlled = clamp(Number(battle.control?.[zone.id]) || 0, 0, 1), x = zoneX[zone.id];
        const selected = battle.zone === zone.id;
        ctx.fillStyle = controlled > .98 ? 'rgba(70,183,158,.17)' : selected ? 'rgba(255,219,125,.12)' : 'rgba(14,32,33,.06)';
        ctx.fillRect(x - w / 6 + 3, top, w / 3 - 6, depth);
        if (selected) {
          ctx.strokeStyle = 'rgba(250,221,146,.62)'; ctx.lineWidth = 1.5; ctx.setLineDash([5,5]);
          rounded(ctx, x - w / 6 + 8, top + 7, w / 3 - 16, depth - 14, 10); ctx.stroke(); ctx.setLineDash([]);
        }
        circle(ctx, x, center, Math.min(26, depth * .15), 'rgba(28,48,41,.10)', controlled > .98 ? '#7ddabb' : 'rgba(239,211,145,.23)');
        ctx.font = `600 ${Math.max(11, Math.min(17, w / 47))}px Georgia,serif`; ctx.fillStyle = 'rgba(243,220,164,.25)'; ctx.textAlign = 'center'; ctx.fillText(zone.mark, x, center + 6);
      }
      // Brass deck fittings sit around the fighting lanes, never over the sailors.
      const cannonCount = Math.min(8, Math.max(2, ship.cannons || 3));
      for (const side of [-1, 1]) for (let n = 0; n < cannonCount; n++) {
        const x = left + span * (.19 + n / Math.max(1, cannonCount - 1) * .53), y = center + side * depth * .43;
        ctx.fillStyle = '#4c3c2c'; rounded(ctx, x - 9, y - 6, 18, 12, 2); ctx.fill();
        line(ctx, x, y, x, y + side * 17, '#26393a', 7); line(ctx, x - 2, y, x - 2, y + side * 16, '#71817a', 1.5);
        circle(ctx, x - 8, y + 4, 3, '#3b3025'); circle(ctx, x + 8, y + 4, 3, '#3b3025');
      }
      const mastCount = ship.L > 700 ? 3 : ship.L > 350 ? 2 : 1;
      for (let n = 0; n < mastCount; n++) {
        const x = left + span * (.30 + n * .35 / Math.max(1, mastCount - 1)), y = center - depth * .27;
        circle(ctx, x + 3, y + 5, 11, 'rgba(30,30,22,.22)'); circle(ctx, x, y, 9, '#66513a', '#d3b97b'); circle(ctx, x, y, 5, '#9c7746');
        line(ctx, x, y, x - 17, top + 10, 'rgba(74,66,42,.5)', 1); line(ctx, x, y, x + 18, bottom - 10, 'rgba(74,66,42,.35)', 1);
      }
      const wheelX = left + span * .10, wheelY = center;
      circle(ctx, wheelX, wheelY, 12, '#6f5335', '#d8ba75'); circle(ctx, wheelX, wheelY, 7, '#4f4935', '#bca66d');
      for (let n = 0; n < 8; n++) { const a = n / 8 * TAU; line(ctx, wheelX, wheelY, wheelX + Math.cos(a) * 16, wheelY + Math.sin(a) * 16, '#b79a5d', 2); }
      for (const [x,y] of [[left + span * .18,center + depth * .27],[left + span * .52,center + depth * .28],[left + span * .73,center - depth * .27]]) {
        rounded(ctx, x - 12, y - 8, 24, 16, 2); ctx.fillStyle = '#765b37'; ctx.fill(); ctx.strokeStyle = '#cfaf6b'; ctx.lineWidth = 1.3; ctx.stroke();
        line(ctx, x - 10, y - 6, x + 10, y + 6, '#a88b4f', 1); line(ctx, x - 10, y + 6, x + 10, y - 6, '#a88b4f', 1);
      }
      for (const c of ship.crew || []) if (c.hp <= 0) {
        const pos = map(c.lx || 0, c.ly || 0);
        line(ctx, pos.x - 4, pos.y - 3, pos.x + 4, pos.y + 3, 'rgba(40,36,29,.30)', 2); line(ctx, pos.x - 4, pos.y + 3, pos.x + 4, pos.y - 3, 'rgba(40,36,29,.30)', 2);
      }
      ctx.restore();
      // Decorative rail pins also show when defenders are preparing a counter-rush.
      const danger = battle.rushIn > 0 && battle.rushIn <= 2.5;
      const dangerAlpha = danger ? .25 + (Math.sin(t * 12) + 1) * .15 : 0;
      if (danger) { deckPath(); ctx.strokeStyle = `rgba(249,108,79,${dangerAlpha})`; ctx.lineWidth = 7; ctx.stroke(); }
      const members = (ship.crew || []).filter(c => c.hp > 0).sort((a,b) => (a.ly || 0) - (b.ly || 0));
      const friendly = members.filter(own), enemies = members.filter(c => !own(c));
      const rendered = new Map();
      const oldCtx = this.ctx;
      this.ctx = ctx;
      try {
        for (const c of members) {
          const pos = map(c.lx || 0, c.ly || 0), isOwn = own(c);
          if (c.boarding) { const phase = clamp((c.boarding.t || 0) / .9, 0, 1), ease = phase * phase * (3 - 2 * phase); pos.x = landing + (pos.x - landing) * ease; pos.y = h + 22 + (pos.y - h - 22) * ease; }
          rendered.set(c.id, pos);
          const size = clamp(w / 780, .85, 1.25), color = isOwn ? '#79e1c5' : '#f3747a';
          const foes = isOwn ? enemies : friendly;
          const foe = foes.filter(f => !f.boarding).reduce((a,b) => !a || Math.hypot(b.lx-c.lx,b.ly-c.ly)<Math.hypot(a.lx-c.lx,a.ly-c.ly)?b:a,null);
          const isFighting = !c.boarding && foe && Math.hypot(foe.lx-c.lx,foe.ly-c.ly)<52;
          if (isOwn && battle.rallyTimer > 0) {
            const pulse = 1 + Math.sin(t * 5 + c.id) * .12;
            circle(ctx, pos.x, pos.y, 16 * size * pulse, 'rgba(102,210,163,.10)', 'rgba(146,239,188,.45)');
          }
          circle(ctx, pos.x + 1, pos.y + 3, 9 * size, 'rgba(11,25,27,.27)');
          circle(ctx, pos.x, pos.y, 9 * size, isOwn ? 'rgba(68,158,139,.29)' : 'rgba(171,40,53,.25)', color);
          let facing = isFighting ? Math.atan2(foe.ly-c.ly,foe.lx-c.lx)+Math.PI/2 : Math.atan2((c.ty??c.ly)-c.ly,(c.tx??c.lx)-c.lx)+Math.PI/2;
          if (!Number.isFinite(facing)) facing = 0;
          ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(facing); ctx.scale(size, size);
          this.drawCrew({ ...c, lx:0, ly:0, tx: Math.hypot((c.tx??c.lx)-c.lx,(c.ty??c.ly)-c.ly)>3?10:0, ty:0 }, { ...ship, kind:c.skeleton?'ghost':'brig', skeleton:!!c.skeleton });
          if (isFighting) {
            const sweep = Math.sin(t * 9 + c.id * 2.3);
            ctx.strokeStyle = c.cd > .40 ? 'rgba(255,241,194,.86)' : 'rgba(215,223,199,.48)'; ctx.lineWidth = c.cd > .40 ? 2 : 1.2;
            ctx.beginPath(); ctx.arc(0,0,17,-Math.PI*.87+sweep*.3,-Math.PI*.24+sweep*.3);ctx.stroke();
            line(ctx,6,-7,12+sweep*3,-15,'#e2dfb7',1.8);
          }
          ctx.restore();
          if (isOwn && battle.braceTimer > 0) {
            ctx.strokeStyle = '#b4edf0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos.x,pos.y,14*size,Math.PI*1.05,Math.PI*1.95);ctx.stroke();
          }
          const health = clamp(c.hp / (c.hpMax || 100), 0, 1), bar = 19 * size;
          rounded(ctx,pos.x-bar/2,pos.y+12*size,bar,3.3,1.5);ctx.fillStyle='#253632';ctx.fill();
          if(health>0){rounded(ctx,pos.x-bar/2,pos.y+12*size,bar*health,3.3,1.5);ctx.fillStyle=color;ctx.fill();}
          if(!isOwn&&battle.stagger>0){ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe9a7';ctx.fillText('✧',pos.x+Math.sin(t*6+c.id)*7,pos.y-19);}
        }
      } finally { this.ctx = oldCtx; }
      const last = battle.lastAbility, age = last ? t - last.t : 10;
      if (last && age >= 0 && age < .85) {
        const alpha = 1 - age / .85, zx = zoneX[last.zone] ?? zoneX.guns;
        if(last.kind==='volley'){
          const targets=enemies.filter(c=>Math.abs((c.lx||0)/ship.L-({helm:-.26,guns:0,bow:.26}[last.zone]||0))<.24).slice(0,3);
          if(!targets.length)targets.push({id:-1});
          targets.forEach((foe,n)=>{
            const to=rendered.get(foe.id)||{x:zx,y:center}, hand=friendly[n%Math.max(1,friendly.length)],from=hand?rendered.get(hand.id):{x:zx,y:bottom-20};
            if(!from)return;line(ctx,from.x,from.y,to.x,to.y,`rgba(255,222,133,${alpha*.7})`,1.7);
            circle(ctx,from.x,from.y,7+age*13,`rgba(255,229,146,${alpha*.5})`);circle(ctx,to.x,to.y,4+age*18,`rgba(239,221,167,${alpha*.3})`);
          });
        } else if(last.kind==='brace'){
          circle(ctx,zx,center,depth*(.21+age*.18),null,`rgba(190,243,239,${alpha*.8})`);
        } else if(last.kind==='rally'){
          for(let n=0;n<7;n++){const a=n/7*TAU+t*1.2;circle(ctx,zx+Math.cos(a)*depth*(.2+age*.12),center+Math.sin(a)*depth*(.2+age*.12),2.5,`rgba(217,240,166,${alpha})`);}
        }
      }
      if (danger) {
        ctx.strokeStyle=`rgba(255,166,125,${dangerAlpha+.3})`;ctx.lineWidth=2;
        for(let n=0;n<3;n++){const x=zoneX[battle.zone]??zoneX.guns,y=top-11-n*8;ctx.beginPath();ctx.moveTo(x-8,y-4);ctx.lineTo(x,y+2);ctx.lineTo(x+8,y-4);ctx.stroke();}
      }
      for (const zone of zones) {
        const progress=clamp(Number(battle.control?.[zone.id])||0,0,1),x=zoneX[zone.id],selected=battle.zone===zone.id;
        const width=Math.min(112,w/3-18),y=Math.max(7,top-27);
        rounded(ctx,x-width/2,y,width,20,5);ctx.fillStyle=selected?'#253e3d':'rgba(7,25,33,.78)';ctx.fill();ctx.strokeStyle=progress>.98?'#7ddabb':selected?'#e3c786':'rgba(161,187,164,.22)';ctx.lineWidth=1;ctx.stroke();
        ctx.font=`600 ${w<450?8:9}px system-ui`;ctx.textAlign='center';ctx.fillStyle=progress>.98?'#a7edcc':selected?'#f1d58e':'#c8cdb7';ctx.fillText(zone.name+(progress>.98?'  ✓':''),x,y+13);
        if(progress>0){ctx.fillStyle='#78d7b7';ctx.fillRect(x-width/2+4,y+17,(width-8)*progress,2);}
      }
      const edgeShade=ctx.createLinearGradient(0,0,0,h);edgeShade.addColorStop(0,'rgba(3,18,27,.13)');edgeShade.addColorStop(.5,'rgba(3,18,27,0)');edgeShade.addColorStop(1,'rgba(3,18,27,.18)');ctx.fillStyle=edgeShade;ctx.fillRect(0,0,w,h);
    }

    drawSeaBackground(S) {
      const ctx = this.ctx, y = (S.camera?.y || 0) / (S.h || 44000);
      const weather = typeof S.weather === 'string' ? S.weather : S.weather?.kind;
      const storm = weather === 'storm';
      const region = (S.regions || []).slice().sort((a, b) => Math.hypot((S.camera?.x || 0) - a.cx, (S.camera?.y || 0) - a.cy) / a.r - Math.hypot((S.camera?.x || 0) - b.cx, (S.camera?.y || 0) - b.cy) / b.r)[0];
      const regionSea = region?.waterColor || '#126677';
      const regionName = `${region?.id || ''} ${region?.name || ''} ${region?.biome || ''} ${weather || ''}`;
      this.biome = /haunt|ghost|wraith|bone|spect|grave|dead|skeleton|cursed/i.test(regionName) ? 'haunted' : /ice|frost|frozen|glaci|polar|snow/i.test(regionName) ? 'ice' : '';
      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      gradient.addColorStop(0, storm ? '#102c3b' : tint(regionSea, -13));
      gradient.addColorStop(.48, storm ? '#173e4b' : tint(regionSea, 0));
      gradient.addColorStop(1, storm ? '#092936' : y > .68 ? tint(regionSea, -18) : tint(regionSea, -25));
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
      const caustic = ctx.createRadialGradient(this.width * .7, this.height * .2, 0, this.width * .7, this.height * .2, this.width * .8);
      caustic.addColorStop(0, storm ? 'rgba(115,152,154,.05)' : 'rgba(65,191,176,.12)'); caustic.addColorStop(1, 'rgba(20,80,95,0)');
      ctx.fillStyle = caustic; ctx.fillRect(0, 0, this.width, this.height);
    }

    drawWaves(S) {
      const ctx = this.ctx, t = this.time, spacing = this.zoom < .32 ? 380 : 245;
      ctx.lineCap = 'round';
      for (let gy = Math.floor(this.top / spacing); gy <= Math.ceil(this.bottom / spacing); gy++) {
        for (let gx = Math.floor(this.left / spacing); gx <= Math.ceil(this.right / spacing); gx++) {
          const seed = hash(gx, gy), phase = seed * TAU + t * .6;
          const x = gx * spacing + hash(gx + 46, gy) * spacing + Math.sin(phase * .31) * 16;
          const y = gy * spacing + hash(gx, gy + 82) * spacing + Math.cos(phase * .38) * 12;
          const length = 20 + seed * 75;
          ctx.strokeStyle = `${this.biome === 'haunted' ? 'rgba(146,218,166,' : this.biome === 'ice' ? 'rgba(202,232,241,' : 'rgba(160,232,221,'}${.075 + Math.sin(phase) * .035})`;
          ctx.lineWidth = 1.3 / Math.sqrt(this.zoom);
          ctx.beginPath(); ctx.moveTo(x - length / 2, y);
          ctx.bezierCurveTo(x - length * .15, y - 6, x + length * .15, y - 6, x + length / 2, y); ctx.stroke();
          if (seed > .48) {
            ctx.strokeStyle = 'rgba(4,36,49,.16)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(x + length * .2, y + 18, length * .65, 8, -.18, .15, 2.7); ctx.stroke();
          }
          if (seed > .83) {
            const sparkle = Math.pow(Math.max(0, Math.sin(phase * 1.7)), 8) * .5;
            line(ctx, x + 20, y - 25, x + 30, y - 25, `rgba(220,253,237,${sparkle})`, 2);
          }
        }
      }
    }

    getIslandArt(island) {
      const key = `${island.id}:${island.seed}:${island.r}:${island.type}:${island.port}:${island.tier || 1}:${!!island.grandPort}:${island.specialty || ''}`;
      if (this.islandCache.has(key)) return this.islandCache.get(key);
      const grand = !!island.grandPort || island.tier >= 3;
      const worldSize = island.r * (grand ? 3.6 : 3.05) + (grand ? 500 : 300);
      const size = Math.round(clamp(worldSize * .64, 640, grand ? 2300 : 1800));
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'), scale = size / worldSize, r = island.r;
      ctx.translate(size / 2, size / 2); ctx.scale(scale, scale);
      const rnd = seeded((island.seed || island.id * 71) + 913);
      const haunted = island.type === 'haunted', ice = island.type === 'ice' || island.type === 'frozen';
      const points = [], N = 38;
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU;
        const radius = r * (.89 + Math.sin(a * 3 + rnd()) * .045 + Math.sin(a * 7 + .8) * .045 + rnd() * .045);
        points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
      }
      // Colored shallows and reef shelves remain translucent over the moving ocean.
      const shore = haunted ? [[1.38, 'rgba(56,115,99,.10)'], [1.25, 'rgba(67,148,115,.16)'], [1.14, 'rgba(99,175,137,.25)'], [1.055, 'rgba(130,193,148,.36)']] : ice ? [[1.38, 'rgba(105,178,196,.12)'], [1.25, 'rgba(132,205,221,.19)'], [1.14, 'rgba(171,228,239,.33)'], [1.055, 'rgba(207,245,247,.66)']] : [[1.38, 'rgba(30,159,158,.10)'], [1.25, 'rgba(53,188,174,.16)'], [1.14, 'rgba(86,219,188,.28)'], [1.055, 'rgba(157,237,203,.50)']];
      for (const [factor, color] of shore) {
        coastPath(ctx, points, factor); ctx.fillStyle = color; ctx.fill();
      }
      for (let i = 0; i < 40; i++) {
        const a = rnd() * TAU, d = r * (1.02 + rnd() * .22), x = Math.cos(a) * d, y = Math.sin(a) * d;
        ctx.strokeStyle = 'rgba(205,255,222,.22)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(x, y, 12 + rnd() * 30, 4 + rnd() * 7, a, 0, Math.PI); ctx.stroke();
      }
      ctx.save(); ctx.translate(12, 18); coastPath(ctx, points, 1.008); ctx.fillStyle = 'rgba(3,56,58,.25)'; ctx.fill(); ctx.restore();
      coastPath(ctx, points); ctx.fillStyle = haunted ? '#858d72' : ice ? '#d7e6df' : island.type === 'volcanic' ? '#9f9270' : '#e6cc91'; ctx.fill();
      ctx.lineWidth = ice ? 14 : 9; ctx.strokeStyle = haunted ? 'rgba(183,204,157,.46)' : ice ? 'rgba(240,255,251,.92)' : 'rgba(255,250,203,.64)'; ctx.stroke();
      coastPath(ctx, points, .88);
      const ground = ctx.createLinearGradient(-r, -r, r, r);
      ground.addColorStop(0, haunted ? '#54654f' : ice ? '#e7f2e9' : island.type === 'volcanic' ? '#626f53' : '#6b9d54');
      ground.addColorStop(.55, haunted ? '#354d43' : ice ? '#b9d5d1' : island.type === 'volcanic' ? '#53594a' : '#457e49');
      ground.addColorStop(1, haunted ? '#243d36' : ice ? '#87b7bd' : island.type === 'volcanic' ? '#343f3b' : '#2c5d40');
      ctx.fillStyle = ground; ctx.fill();
      coastPath(ctx, points, .86); ctx.strokeStyle = 'rgba(195,190,116,.30)'; ctx.lineWidth = r * .035; ctx.stroke();
      // Meandering sandy footpaths bring villages and harbor together.
      if (island.port) {
        ctx.strokeStyle = '#c9af79'; ctx.lineWidth = Math.max(18, r * .042); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(r * .94, 0); ctx.bezierCurveTo(r * .5, r * .14, r * .28, -r * .14, -r * .08, -r * .04); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * .45, 0); ctx.quadraticCurveTo(r * .32, -r * .20, r * .11, -r * .3); ctx.stroke();
      }
      const treeCount = Math.round(island.trees || clamp(r / 6, 45, 170));
      for (let i = 0; i < treeCount; i++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * .77;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        if (island.port && x > -r * .12 && x < r && Math.abs(y) < r * .22) continue;
        if (island.type === 'volcanic' && d < r * .42) continue;
        if (ice) this.paintIceberg(ctx, x, y, 25 + rnd() * 55, rnd);
        else if (haunted) {
          if (rnd() < .35) this.paintGrave(ctx, x, y, 12 + rnd() * 12, rnd);
          else this.paintDeadTree(ctx, x, y, 32 + rnd() * 39, rnd);
        } else if (rnd() < .27) this.paintRock(ctx, x, y, 14 + rnd() * 27, rnd);
        else this.paintPalm(ctx, x, y, 25 + rnd() * 34, rnd);
      }
      // Warm beach detail, fallen timber, and solitary palms.
      for (let i = 0; i < 24; i++) {
        const a = rnd() * TAU, d = r * (.79 + rnd() * .09), x = Math.cos(a) * d, y = Math.sin(a) * d;
        if (island.port && x > r * .5 && Math.abs(y) < r * .26) continue;
        this.paintRock(ctx, x, y, 7 + rnd() * 11, rnd);
      }
      if (island.port) grand ? this.paintGrandHarbor(ctx, island, rnd) : this.paintHarbor(ctx, island, rnd);
      if (island.type === 'fort') this.paintFort(ctx, -r * .06, -r * .11, Math.min(180, r * .25), rnd);
      if (haunted) {
        this.paintHauntedRuins(ctx, -r * .07, -r * .1, r * .33, rnd);
        // A broken processional path leads through a fenced graveyard.
        ctx.strokeStyle = '#758375'; ctx.lineWidth = Math.max(9, r * .022);
        ctx.beginPath(); ctx.moveTo(r * .58, r * .4); ctx.quadraticCurveTo(r * .28, r * .38, -r * .07, r * .14); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const gx = r * .18 + (i % 4) * r * .10, gy = r * .12 + Math.floor(i / 4) * r * .10;
          this.paintGrave(ctx, gx, gy, r * .027, rnd);
        }
        for (let i = 0; i < 9; i++) {
          const x = r * (.12 + i * .065);
          line(ctx, x, r * .49, x, r * .55, '#718171', 3);
        }
        line(ctx, r * .1, r * .52, r * .67, r * .52, '#687a68', 3);
      }
      if (ice) {
        // Faceted glacier crown and hairline blue crevasses.
        this.paintIceberg(ctx, -r * .03, -r * .07, r * .46, rnd);
        for (let i = 0; i < 7; i++) {
          const a = rnd() * TAU, d = r * .50;
          ctx.strokeStyle = '#91bfc4'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          ctx.lineTo(Math.cos(a + .08) * r * .68, Math.sin(a + .08) * r * .68);
          ctx.lineTo(Math.cos(a - .05) * r * .78, Math.sin(a - .05) * r * .78); ctx.stroke();
        }
        for (let i = 0; i < 10; i++) { const a = rnd() * TAU; this.paintIceberg(ctx, Math.cos(a) * r * 1.14, Math.sin(a) * r * 1.14, 15 + rnd() * 36, rnd); }
      }
      if (island.type === 'ruins') {
        for (let i = 0; i < 8; i++) {
          const x = (rnd() - .5) * r * .65, y = (rnd() - .5) * r * .6;
          ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * .4);
          ctx.fillStyle = '#263f35'; ctx.fillRect(-12, -8, 47, 38);
          ctx.fillStyle = '#a2a48a'; ctx.fillRect(-18, -17, 34, 30);
          ctx.fillStyle = '#d2caa5'; ctx.fillRect(-18, -20, 34, 9);
          line(ctx, -9, -11, -9, 7, '#717e68', 3); line(ctx, 4, -11, 4, 7, '#717e68', 3);
          ctx.restore();
        }
      }
      if (island.type === 'volcanic') {
        const mountain = ctx.createRadialGradient(-r * .08, -r * .10, r * .03, 0, 0, r * .51);
        mountain.addColorStop(0, '#393d3c'); mountain.addColorStop(.6, '#55594c'); mountain.addColorStop(1, 'rgba(66,91,64,0)');
        circle(ctx, 0, 0, r * .53, mountain);
        circle(ctx, -r * .04, -r * .05, r * .13, '#222b2b', '#7d715b');
        circle(ctx, -r * .04, -r * .05, r * .073, '#a14a2d');
        ctx.strokeStyle = '#cc7941'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(30, 60, -20, 100, 60, r * .32); ctx.stroke();
      }
      const art = { canvas, worldSize, points };
      this.islandCache.set(key, art);
      // Limit cached memory on unusually large procedurally expanded worlds.
      if (this.islandCache.size > 20) this.islandCache.delete(this.islandCache.keys().next().value);
      return art;
    }

    paintPalm(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(6,35,34,.24)'; ctx.beginPath(); ctx.ellipse(size * .35, size * .56, size * .7, size * .34, -.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6b5236'; ctx.lineWidth = size * .13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(size * .10, size * .36); ctx.quadraticCurveTo(-size * .13, size * .11, 0, -size * .2); ctx.stroke();
      const rotation = rnd() * TAU;
      for (let n = 0; n < 7; n++) {
        const a = rotation + n / 7 * TAU, length = size * (.65 + rnd() * .34);
        ctx.save(); ctx.translate(0, -size * .17); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(length * .55, -length * .32, length, length * .10);
        ctx.quadraticCurveTo(length * .40, length * .03, 0, 0);
        ctx.fillStyle = n % 2 ? '#3b8e50' : '#589f55'; ctx.fill();
        line(ctx, 0, 0, length * .85, 0, '#8bb75a', Math.max(1, size * .025));
        ctx.restore();
      }
      circle(ctx, 0, -size * .17, size * .09, '#c3a263'); ctx.restore();
    }

    paintRock(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
      ctx.fillStyle = 'rgba(4,39,35,.22)'; ctx.beginPath(); ctx.ellipse(size * .25, size * .30, size, size * .68, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-size * .8, -size * .2); ctx.lineTo(-size * .4, -size * .7);
      ctx.lineTo(size * .48, -size * .6); ctx.lineTo(size * .86, size * .25); ctx.lineTo(size * .12, size * .7); ctx.lineTo(-size * .7, size * .4); ctx.closePath();
      ctx.fillStyle = '#8d9b8d'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-size * .8, -size * .2); ctx.lineTo(-size * .4, -size * .7); ctx.lineTo(size * .48, -size * .6); ctx.lineTo(0, size * .10); ctx.closePath();
      ctx.fillStyle = '#b2b9a1'; ctx.fill(); ctx.restore();
    }

    paintDeadTree(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - .5) * .7);
      ctx.strokeStyle = 'rgba(8,27,24,.25)'; ctx.lineWidth = size * .22;
      ctx.beginPath(); ctx.moveTo(10, 13); ctx.lineTo(size * .53, size * .5); ctx.stroke();
      ctx.strokeStyle = '#394b3d'; ctx.lineWidth = size * .16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, size * .24); ctx.bezierCurveTo(-size * .15, 0, size * .06, -size * .37, -size * .10, -size * .65); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1, by = -size * (.03 + i * .10), bx = side * size * (.25 + rnd() * .15);
        ctx.strokeStyle = i % 2 ? '#6e7c5e' : '#596950'; ctx.lineWidth = size * (.065 - i * .006);
        ctx.beginPath(); ctx.moveTo(-size * .03, by + size * .14); ctx.lineTo(bx * .5, by); ctx.lineTo(bx, by - size * .15); ctx.lineTo(bx * .91, by - size * .28); ctx.stroke();
        ctx.lineWidth = size * .027; ctx.beginPath(); ctx.moveTo(bx * .58, by); ctx.lineTo(bx * .87, by + size * .04); ctx.lineTo(bx * 1.10, by - size * .03); ctx.stroke();
      }
      line(ctx, -size * .07, size * .1, -size * .08, -size * .48, '#839075', Math.max(1, size * .022));
      ctx.restore();
    }

    paintGrave(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - .5) * .35);
      ctx.fillStyle = 'rgba(10,26,24,.29)'; ctx.beginPath(); ctx.ellipse(4, size * .67, size * .69, size * .42, .3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#788979'; rounded(ctx, -size * .38, -size * .63, size * .76, size * .93, size * .35); ctx.fill();
      ctx.strokeStyle = '#a3ad91'; ctx.lineWidth = 2; ctx.stroke();
      line(ctx, 0, -size * .43, 0, size * .08, '#485b4e', 2); line(ctx, -size * .18, -size * .25, size * .18, -size * .25, '#485b4e', 2);
      ctx.fillStyle = '#526f54'; ctx.beginPath(); ctx.ellipse(-size * .27, size * .23, size * .33, size * .14, -.2, 0, TAU); ctx.fill();
      ctx.restore();
    }

    paintHauntedRuins(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.15);
      ctx.fillStyle = 'rgba(6,26,23,.3)'; ctx.fillRect(-size * .48 + 14, -size * .40 + 18, size * .96, size * .82);
      ctx.fillStyle = '#4f6559'; ctx.fillRect(-size * .48, -size * .40, size * .96, size * .82);
      ctx.fillStyle = '#7e8f78'; ctx.fillRect(-size * .43, -size * .35, size * .86, size * .73);
      ctx.fillStyle = '#2e493c'; ctx.fillRect(-size * .28, -size * .27, size * .56, size * .55);
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#a0ab8d'; ctx.fillRect(side * size * .4 - size * .055, -size * .43, size * .11, size * .88);
        for (let n = 0; n < 6; n++) line(ctx, side * size * .4 - size * .055, (-.36 + n * .14) * size, side * size * .4 + size * .055, (-.36 + n * .14) * size, '#637560', 2);
      }
      // Broken chapel arch, with emerald glass remaining in its lancet window.
      ctx.strokeStyle = '#a7b190'; ctx.lineWidth = size * .075;
      ctx.beginPath(); ctx.moveTo(-size * .23, -size * .31); ctx.quadraticCurveTo(-size * .25, -size * .65, 0, -size * .70);
      ctx.quadraticCurveTo(size * .18, -size * .57, size * .21, -size * .38); ctx.stroke();
      ctx.fillStyle = '#294d3e'; ctx.beginPath(); ctx.moveTo(-size * .15, -size * .35); ctx.lineTo(0, -size * .60); ctx.lineTo(size * .14, -size * .35); ctx.closePath(); ctx.fill();
      line(ctx, 0, -size * .54, 0, -size * .36, '#75b190', 3);
      line(ctx, -size * .08, -size * .40, size * .08, -size * .40, '#75b190', 3);
      for (let i = 0; i < 9; i++) {
        const bx = (rnd() - .5) * size * 1.3, by = (rnd() - .5) * size;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(rnd() * 2); ctx.fillStyle = i % 2 ? '#83937c' : '#677d68';
        ctx.fillRect(-size * .05, -size * .04, size * .1, size * .08); ctx.restore();
      }
      ctx.strokeStyle = '#487d53'; ctx.lineWidth = Math.max(3, size * .02);
      ctx.beginPath(); ctx.moveTo(-size * .48, size * .34); ctx.bezierCurveTo(-size * .25, size * .18, -size * .51, -size * .1, -size * .32, -size * .35); ctx.stroke();
      ctx.restore();
    }

    paintIceberg(ctx, x, y, size, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
      ctx.beginPath(); ctx.moveTo(-size, size * .16); ctx.lineTo(-size * .55, -size * .59); ctx.lineTo(size * .22, -size * .77);
      ctx.lineTo(size * .86, -size * .25); ctx.lineTo(size * .93, size * .40); ctx.lineTo(-size * .18, size * .64); ctx.closePath();
      ctx.fillStyle = '#79b9c5'; ctx.fill(); ctx.strokeStyle = '#bce9ea'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size * .55, -size * .59); ctx.lineTo(size * .22, -size * .77); ctx.lineTo(size * .13, -size * .05); ctx.lineTo(-size * .40, size * .20); ctx.closePath(); ctx.fillStyle = '#edf8ed'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * .22, -size * .77); ctx.lineTo(size * .86, -size * .25); ctx.lineTo(size * .93, size * .40); ctx.lineTo(size * .13, -size * .05); ctx.closePath(); ctx.fillStyle = '#b9e2df'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-size, size * .16); ctx.lineTo(-size * .40, size * .20); ctx.lineTo(size * .13, -size * .05); ctx.lineTo(size * .93, size * .40); ctx.lineTo(-size * .18, size * .64); ctx.closePath(); ctx.fillStyle = '#a4d4d7'; ctx.fill();
      line(ctx, -size * .55, -size * .59, size * .13, -size * .05, '#fffdf0', 2);
      ctx.restore();
    }

    paintBuilding(ctx, x, y, w, h, angle, roof, rnd) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = 'rgba(15,37,31,.3)'; rounded(ctx, -w / 2 + 10, -h / 2 + 17, w, h, 4); ctx.fill();
      ctx.fillStyle = '#e3cf9b'; ctx.fillRect(-w / 2, -h / 2 + 6, w, h);
      ctx.fillStyle = '#a69066'; ctx.fillRect(-w / 2, h / 2 - 2, w, 10);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-w * .57, 0); ctx.lineTo(0, -h * .66); ctx.lineTo(w * .57, 0); ctx.lineTo(0, h * .59); ctx.closePath(); ctx.fill();
      line(ctx, -w * .57, 0, w * .57, 0, '#e5a377', 3);
      for (let k = -3; k <= 3; k++) line(ctx, k * w / 9, -h * .3, k * w / 9, h * .29, 'rgba(80,45,28,.16)', 1.3);
      ctx.fillStyle = '#3b4d4b'; ctx.fillRect(-8, h * .34, 16, 15);
      if (rnd() > .4) { ctx.fillStyle = '#d4ba85'; ctx.fillRect(w * .2, -h * .42, 10, 14); }
      ctx.restore();
    }

    paintFort(ctx, x, y, size) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(8,34,31,.34)'; ctx.fillRect(-size * .55 + 15, -size * .50 + 20, size * 1.1, size);
      ctx.fillStyle = '#7f8a7a'; ctx.fillRect(-size * .55, -size * .5, size * 1.1, size);
      ctx.fillStyle = '#b5b59a'; ctx.fillRect(-size * .48, -size * .44, size * .96, size * .88);
      ctx.fillStyle = '#79846e'; ctx.fillRect(-size * .32, -size * .29, size * .64, size * .58);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const bx = sx * size * .49, by = sy * size * .44;
        circle(ctx, bx + 4, by + 6, size * .16, '#5e6b61');
        circle(ctx, bx, by, size * .16, '#c0c1a2', '#777d68');
        circle(ctx, bx, by, size * .09, '#969d86');
        ctx.fillStyle = '#334440'; ctx.fillRect(bx - 4, by - size * .23, 8, size * .20);
      }
      for (let p = -.43; p <= .44; p += .14) {
        ctx.fillStyle = '#d1cbb0'; ctx.fillRect(p * size, -size * .53, size * .06, size * .10);
        ctx.fillRect(p * size, size * .44, size * .06, size * .10);
      }
      ctx.fillStyle = '#3a473d'; ctx.fillRect(size * .40, -size * .10, size * .18, size * .20);
      ctx.restore();
    }

    paintHarbor(ctx, island, rnd) {
      const r = island.r, dockLength = 280, dockX = r * .77;
      // Main pier deliberately reaches the engine's approach marker at r+180.
      ctx.fillStyle = 'rgba(10,55,56,.23)'; ctx.fillRect(dockX + 9, -39, r * .23 + dockLength, 91);
      ctx.fillStyle = '#725638'; ctx.fillRect(dockX, -37, r * .23 + dockLength, 74);
      ctx.fillStyle = '#aa8754'; ctx.fillRect(dockX, -31, r * .23 + dockLength, 62);
      for (let x = dockX + 5; x < r + dockLength; x += 16) line(ctx, x, -30, x, 30, '#725f42', 2);
      for (const y of [-36, 36]) {
        line(ctx, dockX, y, r + dockLength, y, '#554731', 4);
        for (let x = dockX; x < r + dockLength + 1; x += 82) {
          circle(ctx, x + 4, y + 5, 7, '#454d3c'); circle(ctx, x, y, 7, '#cfaa70', '#6a5136');
        }
      }
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#947447'; ctx.fillRect(r + 110, side < 0 ? -128 : 31, 44, 97);
        for (let y = 40; y < 123; y += 14) line(ctx, r + 112, y * side, r + 152, y * side, '#655a3f', 2);
      }
      for (let i = 0; i < 7; i++) {
        const x = r * (.18 + (i % 3) * .19), y = (i < 3 ? -.19 : .19) * r + (rnd() - .5) * r * .07;
        this.paintBuilding(ctx, x, y, 70 + rnd() * 30, 58 + rnd() * 22, (rnd() - .5) * .35, i === 0 ? '#446c72' : i % 2 ? '#aa6948' : '#9b7850', rnd);
      }
      // Quayside warehouse, crates, barrels, and striped trading awning.
      this.paintBuilding(ctx, r * .70, -r * .13, 105, 77, .05, '#7d5946', rnd);
      ctx.fillStyle = '#e9d6a4'; ctx.fillRect(r * .70 - 50, r * .12, 96, 48);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#bc6f53' : '#eee2bd'; ctx.fillRect(r * .70 - 50 + i * 16, r * .12, 16, 48); }
      for (let i = 0; i < 12; i++) {
        const x = r * .82 + rnd() * 70, y = (rnd() - .5) * 45;
        if (i % 3) {
          ctx.fillStyle = '#967146'; ctx.fillRect(x, y, 12, 12); ctx.strokeStyle = '#d2ad6c'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, 10, 10);
        } else circle(ctx, x, y, 7, '#674f36', '#b99b66');
      }
      // Harbor lighthouse.
      const lx = r * .93, ly = -r * .20;
      circle(ctx, lx + 6, ly + 12, 32, 'rgba(15,43,37,.24)');
      circle(ctx, lx, ly, 27, '#c6bfa0', '#6f806c'); circle(ctx, lx, ly, 21, '#f2e3b8');
      circle(ctx, lx, ly, 14, '#41565b'); circle(ctx, lx, ly, 10, '#f2c878');
      line(ctx, lx - 13, ly, lx + 13, ly, '#aa9f7d', 3); line(ctx, lx, ly - 13, lx, ly + 13, '#aa9f7d', 3);
    }

    harborPalette(island) {
      const name = String(island.specialty || '').toLowerCase();
      if (/ghost|haunt|spect|curs|bone|revenant|witchfire/.test(name)) return { roof: '#4b7863', accent: '#a5d29e', stone: '#94a38b', cloth: '#b6c7a0' };
      if (/storm|tempest|speed|sail|swift/.test(name)) return { roof: '#3d7780', accent: '#73c5bc', stone: '#b6baa0', cloth: '#dbe8c2' };
      if (/royal|capital/.test(name)) return { roof: '#354f68', accent: '#ddbd70', stone: '#c5c5a5', cloth: '#ead8a1' };
      if (/iron|armor|foundry|arsenal|gun|mortar|ordnance/.test(name)) return { roof: '#546972', accent: '#c4ac76', stone: '#9eaa9b', cloth: '#d2c69c' };
      if (/ice|frost|polar|north|rime/.test(name)) return { roof: '#657d8b', accent: '#badbd7', stone: '#cad6c6', cloth: '#edf0d8' };
      if (/royal|capital|leviathan|grand|naval|war/.test(name)) return { roof: '#354f68', accent: '#ddbd70', stone: '#c5c5a5', cloth: '#ead8a1' };
      return { roof: '#a16d4c', accent: '#d6b16c', stone: '#c9c4a2', cloth: '#e8d4a1' };
    }

    paintPier(ctx, x, y, length, width, stone = false) {
      ctx.fillStyle = 'rgba(7,43,43,.29)'; rounded(ctx, x + 10, y - width / 2 + 12, length, width, 6); ctx.fill();
      ctx.fillStyle = stone ? '#8e9d8d' : '#665338'; rounded(ctx, x, y - width / 2, length, width, 5); ctx.fill();
      ctx.fillStyle = stone ? '#c1bea0' : '#b28c54'; rounded(ctx, x + 4, y - width / 2 + 4, length - 8, width - 8, 3); ctx.fill();
      for (let px = x + 12; px < x + length - 5; px += stone ? 28 : 15) line(ctx, px, y - width / 2 + 5, px, y + width / 2 - 5, stone ? '#a5aa92' : '#80693f', stone ? 1.8 : 1.3);
      for (const side of [-1, 1]) {
        line(ctx, x, y + side * (width / 2 - 1), x + length, y + side * (width / 2 - 1), stone ? '#ded3a7' : '#574b32', 4);
        for (let px = x + 12; px < x + length; px += 85) { circle(ctx, px + 2, y + side * width / 2 + 2, 6, '#536255'); circle(ctx, px, y + side * width / 2, 6, '#d3b77a', '#655b3a'); }
      }
    }

    paintMooredShip(ctx, x, y, length, angle, accent, bare = false) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      const width = length * .25;
      ctx.save(); ctx.translate(5, 7); hullPath(ctx, length, width); ctx.fillStyle = 'rgba(2,38,42,.3)'; ctx.fill(); ctx.restore();
      hullPath(ctx, length, width); ctx.fillStyle = '#59462f'; ctx.fill(); ctx.strokeStyle = '#c49c5e'; ctx.lineWidth = 2; ctx.stroke();
      hullPath(ctx, length, width, .84); ctx.fillStyle = '#b5955e'; ctx.fill();
      for (let yy = -width * .3; yy <= width * .3; yy += 6) line(ctx, -length * .4, yy, length * .34, yy, '#8d7548', .8);
      for (const mx of [-length * .19, length * .18]) {
        line(ctx, mx, -width * .6, mx, width * .6, '#55452e', 3);
        if (!bare) { ctx.beginPath(); ctx.moveTo(mx, -width * .6); ctx.quadraticCurveTo(mx + length * .12, 0, mx, width * .6); ctx.closePath(); ctx.fillStyle = '#e1d5ab'; ctx.fill(); }
        circle(ctx, mx, 0, 3, '#ddc58c');
      }
      line(ctx, length * .34, 0, length * .64, 0, '#b7975d', 3);
      ctx.fillStyle = accent; ctx.fillRect(-length * .40, -width * .20, length * .10, width * .40);
      ctx.restore();
    }

    paintGrandHarbor(ctx, island, rnd) {
      const r = island.r, palette = this.harborPalette(island);
      // Broad avenues, plazas and a complete fortified waterfront city.
      ctx.lineCap = 'round'; ctx.strokeStyle = '#c2b181'; ctx.lineWidth = r * .07;
      ctx.beginPath(); ctx.moveTo(-r * .45, 0); ctx.lineTo(r * .86, 0); ctx.stroke();
      for (const xx of [-.20, .14, .45]) { ctx.beginPath(); ctx.moveTo(r * xx, -r * .53); ctx.lineTo(r * xx, r * .54); ctx.stroke(); }
      for (const yy of [-.32, .32]) { ctx.beginPath(); ctx.moveTo(-r * .35, r * yy); ctx.lineTo(r * .67, r * yy); ctx.stroke(); }
      ctx.strokeStyle = '#a29673'; ctx.lineWidth = 3;
      for (let x = -r * .43; x < r * .8; x += 23) line(ctx, x, -r * .025, x, r * .025, '#a7976c', 1);
      // Crescent seawall follows the inhabited eastern shore; bastions anchor each end.
      ctx.strokeStyle = '#677d6d'; ctx.lineWidth = 38;
      ctx.beginPath(); ctx.moveTo(-r * .22, -r * .63); ctx.bezierCurveTo(r * .37, -r * .75, r * .75, -r * .5, r * .78, 0);
      ctx.bezierCurveTo(r * .75, r * .49, r * .38, r * .73, -r * .22, r * .62); ctx.stroke();
      ctx.strokeStyle = palette.stone; ctx.lineWidth = 26; ctx.stroke();
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI * .63 + i / 25 * Math.PI * 1.26;
        const x = Math.cos(a) * r * .77, y = Math.sin(a) * r * .67;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#e0d6ac'; ctx.fillRect(-11, -9, 18, 18); ctx.restore();
      }
      // Dense, varied blocks are static cached art, so the grand port stays inexpensive.
      for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
        const x = r * (-.38 + col * .17) + (rnd() - .5) * 24, y = r * (-.46 + row * .23) + (rnd() - .5) * 20;
        if (Math.abs(y) < r * .07 || Math.hypot(x, y) > r * .74 || x > r * .48 && y > r * .15) continue;
        const width = r * (.075 + rnd() * .026), height = r * (.065 + rnd() * .022);
        this.paintBuilding(ctx, x, y, width, height, (rnd() - .5) * .08, (row + col) % 3 ? palette.roof : '#a38256', rnd);
        // Small green courtyards, cisterns and marble steps between town houses.
        if (rnd() > .55) { circle(ctx, x + width * .66, y, 12, '#64845a'); circle(ctx, x + width * .66 - 2, y - 2, 8, '#86a76a'); }
      }
      // Admiralty square and a domed guildhall give each city a recognizable center.
      const gx = -r * .17, gy = -r * .17;
      ctx.fillStyle = '#c7bd92'; rounded(ctx, gx - r * .11, gy - r * .09, r * .22, r * .18, 6); ctx.fill();
      this.paintBuilding(ctx, gx, gy, r * .15, r * .11, 0, palette.roof, rnd);
      circle(ctx, gx, gy, r * .042, palette.accent, '#6a775c'); circle(ctx, gx - 4, gy - 5, r * .023, '#e6d5a0');
      line(ctx, gx, gy - r * .045, gx, gy - r * .066, '#e5d2a0', 3);
      // Arsenal fortress on the north promontory overlooks all harbor approaches.
      this.paintFort(ctx, r * .27, -r * .48, r * .24, rnd);
      for (const side of [-1, 1]) {
        const bx = r * .70, by = side * r * .55;
        circle(ctx, bx + 8, by + 10, r * .065, '#557469'); circle(ctx, bx, by, r * .065, palette.stone, '#677f6b');
        circle(ctx, bx, by, r * .043, '#8f9d81');
        for (let n = 0; n < 3; n++) { const a = (n - 1) * .45; line(ctx, bx + Math.cos(a) * 20, by + Math.sin(a) * 20, bx + Math.cos(a) * 52, by + Math.sin(a) * 52, '#344b47', 7); }
      }
      // A substantial waterfront quay connects the separate berth piers.
      ctx.save(); ctx.translate(r * .72, 0); ctx.rotate(Math.PI / 2); this.paintPier(ctx, -r * .57, 0, r * 1.14, r * .075, true); ctx.restore();
      const rows = [-.46, -.23, 0, .23, .46];
      rows.forEach((value, n) => {
        const y = r * value, start = r * (Math.abs(value) > .4 ? .68 : .75), end = r + (n % 2 ? 590 : 440);
        this.paintPier(ctx, start, y, end - start, n === 2 ? 88 : 66, n === 2);
        // Warehouse groups line the landward end of each berth.
        if (n !== 2) {
          this.paintBuilding(ctx, start - r * .085, y, r * .13, r * .075, Math.PI / 2, palette.roof, rnd);
          for (let i = 0; i < 9; i++) {
            const x = start + 30 + i * 17, yy = y + (i % 2 ? -14 : 11);
            ctx.fillStyle = i % 3 ? '#9b7a48' : '#8e9b71'; ctx.fillRect(x, yy, 13, 13); ctx.strokeStyle = '#cbb27a'; ctx.lineWidth = 1; ctx.strokeRect(x, yy, 13, 13);
          }
          this.paintMooredShip(ctx, end - 125, y + (n % 2 ? 81 : -81), 180 + (n % 2) * 35, 0, palette.accent, n % 3 === 0);
        }
      });
      // Drydock: stone retaining walls, a curved ship cradle and timber slip rails.
      const dx = r * .53, dy = r * .39, dw = r * .67, dh = r * .18;
      ctx.fillStyle = '#647e71'; rounded(ctx, dx - 12, dy - dh / 2 - 12, dw + 24, dh + 24, 15); ctx.fill();
      ctx.fillStyle = '#203e42'; rounded(ctx, dx, dy - dh / 2, dw, dh, 10); ctx.fill();
      ctx.fillStyle = '#426566'; rounded(ctx, dx + 9, dy - dh / 2 + 8, dw - 18, dh - 16, 8); ctx.fill();
      for (let x = dx + 20; x < dx + dw - 10; x += 28) line(ctx, x, dy - dh * .44, x, dy + dh * .44, '#c9aa70', 4);
      this.paintMooredShip(ctx, dx + dw * .48, dy, dw * .73, 0, palette.accent, true);
      // High timber cranes and an open shipwright's shed flank the great slip.
      for (const xx of [dx + 30, dx + dw * .76]) {
        const yy = dy - dh * .7;
        ctx.fillStyle = '#78613e'; ctx.fillRect(xx - 7, yy - 25, 14, 50);
        line(ctx, xx, yy, xx + 43, yy + 40, '#5e5036', 7); line(ctx, xx, yy, xx + 55, yy + 4, '#a58a51', 7);
        line(ctx, xx + 55, yy + 4, xx + 54, yy + 55, '#524c38', 2); circle(ctx, xx + 54, yy + 55, 4, '#b1ab7b');
      }
      this.paintBuilding(ctx, dx + dw * .22, dy + dh * .92, dw * .38, dh * .62, 0, palette.roof, rnd);
      // Curving stone breakwaters frame a broad, visibly navigable central entrance.
      for (const side of [-1, 1]) {
        ctx.strokeStyle = '#527d72'; ctx.lineWidth = 42;
        ctx.beginPath(); ctx.moveTo(r * .59, side * r * .64); ctx.quadraticCurveTo(r + 240, side * r * .78, r + 620, side * r * .59); ctx.stroke();
        ctx.strokeStyle = palette.stone; ctx.lineWidth = 27; ctx.stroke();
        for (let n = 0; n < 7; n++) circle(ctx, r * .77 + n * 104, side * (r * .67 + Math.sin(n * .7) * 28), 12, '#adb59a', '#7b9480');
        const lx = r + 610, ly = side * r * .59;
        circle(ctx, lx + 8, ly + 10, 45, '#4f786e'); circle(ctx, lx, ly, 43, palette.stone, '#728e7a');
        circle(ctx, lx, ly, 32, '#ece1b7'); circle(ctx, lx, ly, 23, palette.roof, '#9b956d');
        circle(ctx, lx, ly, 14, '#edcb78');
        for (let n = 0; n < 4; n++) { const a = n / 4 * TAU; line(ctx, lx, ly, lx + Math.cos(a) * 27, ly + Math.sin(a) * 27, '#a9a57d', 3); }
      }
      // Specialty colors repeat across banners and awnings throughout the port.
      for (let n = 0; n < 6; n++) {
        const x = r * (-.10 + n * .14), y = r * .09;
        ctx.fillStyle = palette.cloth; ctx.fillRect(x - 26, y, 52, 32);
        for (let stripe = 0; stripe < 4; stripe++) { ctx.fillStyle = stripe % 2 ? palette.accent : palette.roof; ctx.fillRect(x - 26 + stripe * 13, y, 13, 32); }
      }
    }

    drawIsland(island) {
      const ctx = this.ctx, art = this.getIslandArt(island), r = island.r;
      const phaseSeed = (Number(island.seed) || String(island.id || '').length * 73) * .013;
      ctx.drawImage(art.canvas, island.x - art.worldSize / 2, island.y - art.worldSize / 2, art.worldSize, art.worldSize);
      ctx.save(); ctx.translate(island.x, island.y);
      // A traveling surf highlight animates the static, cached beach art.
      const swell = 1.02 + Math.sin(this.time * .7 + island.seed) * .012;
      coastPath(ctx, art.points, swell); ctx.strokeStyle = `rgba(229,255,234,${.18 + Math.sin(this.time + phaseSeed) * .07})`; ctx.lineWidth = 3; ctx.stroke();
      if (island.port) {
        const fx = r + 220, fy = -36;
        line(ctx, fx, fy - 65, fx, fy + 7, '#e4cc91', 4);
        this.paintFlag(ctx, fx, fy - 65, 42, island.type === 'haunted' ? '#6c9a7a' : '#d4b76b', this.time + phaseSeed, true);
        if (this.zoom > .30) {
          ctx.save(); ctx.translate(r * .65, -r * .38); ctx.scale(1 / this.zoom, 1 / this.zoom);
          ctx.font = '600 12px Georgia,serif'; ctx.textAlign = 'center';
          ctx.shadowColor = '#123e3c'; ctx.shadowBlur = 5; ctx.fillStyle = '#f3e3b3'; ctx.fillText(island.name || 'Freeport', 0, 0);
          ctx.font = '8px system-ui'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#c4d1ac'; ctx.fillText('H A R B O R', 0, 15); ctx.restore();
        }
        if (island.grandPort || island.tier >= 3) {
          const palette = this.harborPalette(island);
          for (let i = 0; i < 6; i++) {
            const fx = i < 4 ? r * (.12 + i * .16) : r + 430, fy = i < 4 ? -r * .49 : (i === 4 ? -1 : 1) * r * .46;
            line(ctx, fx, fy, fx, fy - 71, '#d4bf85', 4);
            this.paintFlag(ctx, fx, fy - 71, 46, palette.roof, this.time + phaseSeed + i * .7, true);
          }
          for (const side of [-1, 1]) {
            const lx = r + 610, ly = side * r * .59;
            const light = ctx.createRadialGradient(lx, ly, 2, lx, ly, 95);
            light.addColorStop(0, 'rgba(250,221,141,.27)'); light.addColorStop(1, 'rgba(250,221,141,0)'); circle(ctx, lx, ly, 95, light);
          }
        }
      }
      if (island.type === 'volcanic') {
        for (let i = 0; i < 5; i++) {
          const phase = (this.time * .12 + i / 5) % 1;
          circle(ctx, -r * .04 + Math.sin(phase * 4 + i) * 35, -r * .06 - phase * r * .30, 25 + phase * 65, `rgba(44,53,51,${(1 - phase) * .14})`);
        }
      }
      if (island.type === 'haunted') {
        for (let i = 0; i < 8; i++) {
          const a = hash(i, phaseSeed) * TAU, d = r * (.26 + hash(i + 3, phaseSeed) * .48);
          const x = Math.cos(a) * d, y = Math.sin(a) * d;
          this.drawGhostFlame(ctx, x, y + Math.sin(this.time * 1.7 + i) * 7, 10 + hash(i, phaseSeed + 1) * 12, i);
        }
        // Slow, low ground mist breaks into long, translucent wisps.
        for (let i = 0; i < 4; i++) {
          const cx = Math.sin(this.time * .07 + i * 3) * r * .30, cy = (i - 1.5) * r * .31;
          const fog = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * .8);
          fog.addColorStop(0, 'rgba(155,193,154,.07)'); fog.addColorStop(1, 'rgba(155,193,154,0)');
          ctx.save(); ctx.translate(cx, cy); ctx.scale(1.4, .26); circle(ctx, 0, 0, r * .8, fog); ctx.restore();
        }
      }
      ctx.restore();
    }

    drawWake(ship) {
      const ctx = this.ctx, speed = Math.hypot(ship.vx || 0, ship.vy || 0);
      if (speed < 7 || ship.sinking) return;
      const intensity = clamp(speed / 220, .12, 1), t = this.time;
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a || 0);
      const colossal = ship.kind === 'leviathan', stormark = ship.kind === 'stormark';
      const length = ship.L * (colossal ? 1.25 + intensity * 1.7 : .8 + intensity * 1.3), W = ship.W;
      const wake = ctx.createLinearGradient(-ship.L * .4, 0, -ship.L * .5 - length, 0);
      wake.addColorStop(0, `rgba(180,242,219,${intensity * (colossal ? .23 : .18)})`); wake.addColorStop(1, 'rgba(180,242,219,0)');
      ctx.beginPath(); ctx.moveTo(-ship.L * .37, -W * .30); ctx.quadraticCurveTo(-ship.L * .6 - length * .5, -W, -ship.L * .5 - length, -W * 1.1);
      ctx.quadraticCurveTo(-ship.L * .5 - length * 1.1, 0, -ship.L * .5 - length, W * 1.1);
      ctx.quadraticCurveTo(-ship.L * .6 - length * .5, W, -ship.L * .37, W * .30); ctx.closePath(); ctx.fillStyle = wake; ctx.fill();
      for (const side of [-1, 1]) {
        ctx.strokeStyle = `rgba(212,255,231,${intensity * .25})`; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.moveTo(ship.L * .39, side * W * .25);
        ctx.bezierCurveTo(ship.L * .15, side * W * .64, -ship.L * .3, side * W * .65, -ship.L * .72, side * W * .89); ctx.stroke();
        for (let n = 0; n < 10; n++) {
          const phase = (t * .7 + n / 10 + ship.id * .07) % 1;
          const x = -ship.L * .35 - phase * length;
          const y = side * W * (.23 + phase * .66), streak = 12 + phase * 35;
          ctx.strokeStyle = `rgba(208,252,226,${(1 - phase) * .23 * intensity})`; ctx.lineWidth = 1.2 + (1 - phase) * 1.6;
          ctx.beginPath(); ctx.moveTo(x + streak, y - side * 4);
          ctx.bezierCurveTo(x + streak * .55, y - side * 2, x - streak * .1, y + side * 2, x - streak, y + side * 5); ctx.stroke();
        }
      }
      // Narrow broken centerline foam dissipates with distance astern.
      for (let n = 0; n < 8; n++) {
        const phase = (t * .48 + n / 8) % 1, x = -ship.L * .50 - phase * length;
        const y = Math.sin(n * 2.9 + t * .8) * W * .06;
        line(ctx, x, y, x - 16 - phase * 24, y + Math.sin(n) * 3, `rgba(213,252,229,${(1 - phase) * .18 * intensity})`, 2.2 - phase);
      }
      if (colossal || stormark) for (const side of [-1, 1]) {
        const rows = colossal ? 3 : 2;
        for (let n = 0; n < rows; n++) {
          ctx.strokeStyle = `rgba(213,249,229,${intensity * (.20 - n * .045)})`; ctx.lineWidth = colossal ? 4.5 - n : 2.5 - n * .4;
          ctx.beginPath(); ctx.moveTo(ship.L * .40, side * W * (stormark ? .68 : .29));
          ctx.bezierCurveTo(ship.L * .05, side * W * (.77 + n * .12), -ship.L * .65, side * W * (.83 + n * .16), -ship.L * (1.1 + n * .25), side * W * (1.07 + n * .18)); ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawGhostFlame(ctx, x, y, size, seed) {
      const shimmer = Math.sin(this.time * 8 + seed * 3) * .15 + 1;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
      glow.addColorStop(0, 'rgba(119,231,154,.31)'); glow.addColorStop(.36, 'rgba(84,188,140,.10)'); glow.addColorStop(1, 'rgba(84,188,140,0)');
      circle(ctx, x, y, size * 4, glow);
      ctx.beginPath(); ctx.moveTo(x - size * .4, y + size * .3);
      ctx.bezierCurveTo(x - size * .75, y - size * .3, x + size * .45, y - size * .8, x + size * .06, y - size * 1.7 * shimmer);
      ctx.bezierCurveTo(x + size * .82, y - size * .70, x + size * .50, y + size * .5, x - size * .4, y + size * .3); ctx.closePath();
      ctx.fillStyle = '#6dd69c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - size * .15, y + size * .25); ctx.quadraticCurveTo(x - size * .20, y - size * .2, x + size * .15, y - size * .7 * shimmer);
      ctx.quadraticCurveTo(x + size * .4, y + size * .1, x - size * .15, y + size * .25); ctx.fillStyle = '#e0f5c6'; ctx.fill();
    }

    paintSkull(ctx, x, y, size, color = '#dfe8bc') {
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath(); ctx.moveTo(-size * .48, size * .03);
      ctx.bezierCurveTo(-size * .72, -size * .82, size * .67, -size * .87, size * .49, size * .02);
      ctx.lineTo(size * .24, size * .20); ctx.lineTo(size * .22, size * .47); ctx.lineTo(-size * .22, size * .47); ctx.lineTo(-size * .25, size * .20); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = '#304c3f';
      ctx.beginPath(); ctx.ellipse(-size * .23, -size * .09, size * .15, size * .19, -.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(size * .23, -size * .09, size * .15, size * .19, .2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, size * .03); ctx.lineTo(-size * .07, size * .17); ctx.lineTo(size * .07, size * .17); ctx.closePath(); ctx.fill();
      for (let n = -1; n <= 1; n++) line(ctx, n * size * .12, size * .29, n * size * .12, size * .46, '#52674e', Math.max(.65, size * .04));
      ctx.restore();
    }

    paintFlag(ctx, x, y, length, color, t, harbor = false, emblem = 'skull') {
      const height = length * .51, wave = Math.sin(t * 5) * length * .09;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + length * .32, y - wave, x + length * .7, y + wave, x + length, y + wave * .35);
      ctx.lineTo(x + length * .85, y + height * .48 + wave); ctx.lineTo(x + length, y + height + wave * .35);
      ctx.bezierCurveTo(x + length * .6, y + height + wave, x + length * .3, y + height - wave, x, y + height); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(17,34,32,.48)'; ctx.lineWidth = .8; ctx.stroke();
      if (harbor) {
        circle(ctx, x + length * .38, y + height * .51, height * .15, '#f6e5b3');
      } else if (emblem === 'crown') {
        this.paintCrown(ctx, x + length * .42, y + height * .50, height * .52, '#ead292');
      } else if (emblem === 'storm') {
        this.paintStormCrest(ctx, x + length * .42, y + height * .49, height * .52, '#d9e9c7');
      } else {
        this.paintSkull(ctx, x + length * .40, y + height * .37, height * .48, '#e9e7bd');
        line(ctx, x + length * .32, y + height * .60, x + length * .52, y + height * .79, '#f4e7bd', height * .075);
        line(ctx, x + length * .52, y + height * .60, x + length * .32, y + height * .79, '#f4e7bd', height * .075);
      }
    }

    paintCrown(ctx, x, y, size, color) {
      ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(-size * .52, -size * .32);
      ctx.lineTo(-size * .23, -size * .05); ctx.lineTo(0, -size * .56); ctx.lineTo(size * .23, -size * .05); ctx.lineTo(size * .52, -size * .32);
      ctx.lineTo(size * .39, size * .38); ctx.lineTo(-size * .39, size * .38); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      line(ctx, -size * .36, size * .22, size * .36, size * .22, '#826b43', Math.max(.7, size * .07));
      for (const xx of [-.27, 0, .27]) circle(ctx, xx * size, size * .09, size * .055, '#447577'); ctx.restore();
    }

    paintStormCrest(ctx, x, y, size, color = '#418d93') {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(size * .13, -size * .62); ctx.lineTo(-size * .31, size * .02); ctx.lineTo(-size * .02, -size * .01);
      ctx.lineTo(-size * .14, size * .52); ctx.lineTo(size * .35, -size * .18); ctx.lineTo(size * .07, -size * .13); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, size * .07);
      for (const yy of [.52, .72]) { ctx.beginPath(); ctx.moveTo(-size * .48, size * yy); ctx.quadraticCurveTo(-size * .24, size * (yy - .18), 0, size * yy); ctx.quadraticCurveTo(size * .24, size * (yy + .18), size * .48, size * yy); ctx.stroke(); }
      ctx.restore();
    }

    sailClothPath(ctx, mx, span, billow, flutter, torn, seed) {
      ctx.beginPath(); ctx.moveTo(mx - 6, -span);
      if (torn) {
        // A shredded leech and holes are actual transparent cut-outs in the sail.
        for (let i = 1; i <= 14; i++) {
          const f = i / 14, y = -span + f * span * 2;
          const belly = Math.sin(f * Math.PI) * (billow * .77 + flutter);
          ctx.lineTo(mx - 6 + belly - (i % 3 === 0 ? billow * .25 : 0), y - (i % 3 === 0 ? span * .045 : 0));
          if (i % 3 === 0) ctx.lineTo(mx - 6 + belly + 2, y + span * .015);
        }
        ctx.quadraticCurveTo(mx - billow * .21, 0, mx - 6, -span); ctx.closePath();
        for (let i = 0; i < 3; i++) {
          const y = (hash(seed, i) - .5) * span * 1.25, x = mx + billow * (.12 + hash(i, seed) * .17);
          const hole = 2.2 + hash(seed + 3, i) * 3.8;
          ctx.moveTo(x - hole, y - hole); ctx.lineTo(x + hole * .65, y - hole * 1.4); ctx.lineTo(x + hole, y + hole * .2);
          ctx.lineTo(x - hole * .25, y + hole * 1.7); ctx.closePath();
        }
      } else {
        ctx.bezierCurveTo(mx + billow * .72 + flutter, -span * .80, mx + billow * .87 + flutter, span * .80, mx - 6, span);
        ctx.quadraticCurveTo(mx - billow * .21, 0, mx - 6, -span); ctx.closePath();
      }
    }

    drawLateen(ctx, mx, L, W, phase, color = '#ebddb0') {
      const wave = Math.sin(this.time * 2.5 + phase) * 3;
      const ax = mx - L * .14, ay = -W * .77, bx = mx + L * .20, by = W * .63;
      ctx.save(); ctx.translate(4, 8); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.quadraticCurveTo(mx - L * .22, W * .55, mx - L * .23, -W * .05); ctx.closePath(); ctx.fillStyle = 'rgba(8,32,29,.2)'; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.bezierCurveTo(mx - L * .1 + wave, W * .73, mx - L * .30 + wave, W * .22, mx - L * .23, -W * .05); ctx.closePath();
      const cloth = ctx.createLinearGradient(mx - L * .22, 0, mx + L * .14, 0);
      cloth.addColorStop(0, '#c4ae78'); cloth.addColorStop(.45, color); cloth.addColorStop(1, '#d8c697');
      ctx.fillStyle = cloth; ctx.fill(); ctx.strokeStyle = '#8b754c'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.save(); ctx.clip();
      for (let n = 0; n < 6; n++) {
        const yy = -W * .6 + n * W * .24;
        line(ctx, mx - L * .26, yy, mx + L * .2, yy + W * .12, 'rgba(142,119,76,.24)', 1);
      }
      ctx.restore();
      line(ctx, ax, ay, bx, by, '#56442d', 5); line(ctx, ax, ay - 1, bx, by - 1, '#bb995e', 1.7);
      line(ctx, mx - L * .20, -W * .35, mx, 0, 'rgba(53,55,37,.75)', 1.4);
      line(ctx, mx, 0, mx + L * .25, W * .32, 'rgba(53,55,37,.75)', 1.4);
      circle(ctx, mx, 0, 7, '#be9e62', '#50422f');
    }

    drawCutterRig(ctx, ship) {
      const L = ship.L, W = ship.W, mast = L * .03, wave = Math.sin(this.time * 2.4 + ship.id) * 3;
      // A single gaff mainsail, visibly distinct from a square-rigged brig.
      ctx.save(); ctx.translate(4, 7); ctx.beginPath(); ctx.moveTo(mast, -W * .64); ctx.lineTo(-L * .29, -W * .36);
      ctx.quadraticCurveTo(-L * .38, W * .19, -L * .27, W * .61); ctx.lineTo(mast + L * .08, W * .48); ctx.closePath(); ctx.fillStyle = 'rgba(16,35,31,.18)'; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(mast, -W * .64); ctx.lineTo(-L * .29, -W * .36);
      ctx.bezierCurveTo(-L * .37 + wave, -W * .02, -L * .40 + wave, W * .37, -L * .27, W * .61);
      ctx.quadraticCurveTo(-L * .08, W * .67, mast + L * .08, W * .48); ctx.closePath();
      const sail = ctx.createLinearGradient(-L * .35, 0, L * .11, 0); sail.addColorStop(0, '#c7ad7b'); sail.addColorStop(.42, '#f3e5b7'); sail.addColorStop(1, '#dac792');
      ctx.fillStyle = sail; ctx.fill(); ctx.strokeStyle = '#907951'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.clip();
      for (let y = -W * .55; y < W * .60; y += 15) line(ctx, -L * .40, y, L * .1, y + 3, 'rgba(146,119,75,.23)', .8);
      ctx.restore();
      line(ctx, mast, -W * .69, mast + L * .08, W * .55, '#5f472d', 5);
      line(ctx, mast, -W * .64, -L * .31, -W * .37, '#765832', 4);
      line(ctx, -L * .29, W * .62, L * .12, W * .48, '#765832', 4);
      // Long overlapping jibs carry the cutter's characteristic narrow foretriangle.
      for (let n = 0; n < 2; n++) {
        ctx.beginPath(); ctx.moveTo(L * (.12 + n * .12), -W * (.47 - n * .14));
        ctx.lineTo(L * (.67 - n * .06), 0); ctx.quadraticCurveTo(L * (.37 + n * .06), W * .18, L * (.14 + n * .09), W * .32); ctx.closePath();
        ctx.fillStyle = n ? '#dfcd9d' : '#efe0b2'; ctx.fill(); ctx.strokeStyle = '#9e875a'; ctx.lineWidth = 1; ctx.stroke();
      }
      line(ctx, mast, -W * .65, L * .70, 0, '#4a4c35', 1.2);
      circle(ctx, mast, 0, 6, '#d3b57c', '#55462d');
    }

    drawIronclad(ctx, ship) {
      const L = ship.L, W = ship.W, t = this.time;
      // Sloped armor plates form a low central casemate rather than a sailing rig.
      ctx.beginPath(); ctx.moveTo(-L * .31, -W * .29); ctx.lineTo(L * .29, -W * .29); ctx.lineTo(L * .34, W * .25); ctx.lineTo(-L * .32, W * .25); ctx.closePath();
      ctx.fillStyle = '#263c40'; ctx.fill(); ctx.strokeStyle = '#8a9e98'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-L * .31, -W * .29); ctx.lineTo(-L * .24, -W * .16); ctx.lineTo(L * .22, -W * .16); ctx.lineTo(L * .29, -W * .29); ctx.closePath(); ctx.fillStyle = '#788b83'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-L * .32, W * .25); ctx.lineTo(-L * .24, W * .13); ctx.lineTo(L * .22, W * .13); ctx.lineTo(L * .34, W * .25); ctx.closePath(); ctx.fillStyle = '#3d5658'; ctx.fill();
      ctx.fillStyle = '#596e69'; rounded(ctx, -L * .24, -W * .16, L * .46, W * .29, 5); ctx.fill();
      for (let x = -L * .23; x < L * .22; x += 27) {
        line(ctx, x, -W * .16, x, W * .13, '#3a5553', 1.5);
        for (const y of [-W * .23, W * .20]) { circle(ctx, x + 7, y, 1.7, '#b0b5a0'); circle(ctx, x + 21, y, 1.7, '#9aa89a'); }
      }
      // Gun ports stay visible in the angled armor.
      for (const side of [-1, 1]) for (let n = 0; n < 5; n++) {
        const x = -L * .19 + n * L * .10, y = side * W * .23;
        ctx.fillStyle = '#142c30'; ctx.fillRect(x - 10, y - 6, 20, 12); line(ctx, x - 9, y - side * 6, x + 9, y - side * 6, '#9caa99', 1.7);
      }
      for (const x of [-L * .12, L * .11]) {
        ctx.fillStyle = '#2d4242'; rounded(ctx, x - 15, -W * .08, 30, W * .14, 3); ctx.fill();
        for (let yy = -W * .055; yy < W * .065; yy += 4) line(ctx, x - 11, yy, x + 11, yy, '#7e9186', 1.2);
      }
      // The copper-banded funnel breathes a broken plume aft, entirely decorative.
      const fx = -L * .025, fy = -W * .055;
      ctx.fillStyle = '#263a3d'; ctx.fillRect(fx - 14, fy - 19, 28, 42);
      ctx.fillStyle = '#6a7e73'; ctx.fillRect(fx - 10, fy - 19, 10, 40);
      ctx.fillStyle = '#b39361'; ctx.fillRect(fx - 15, fy - 10, 30, 5);
      ctx.beginPath(); ctx.ellipse(fx, fy - 19, 16, 9, 0, 0, TAU); ctx.fillStyle = '#182e32'; ctx.fill(); ctx.strokeStyle = '#83958a'; ctx.lineWidth = 2; ctx.stroke();
      for (let n = 0; n < 8; n++) {
        const phase = (t * .23 + n / 8) % 1, x = fx - phase * L * .43, y = fy - 26 + Math.sin(phase * 6 + n) * 10;
        const radius = 10 + phase * 24, smoke = ctx.createRadialGradient(x, y, 0, x, y, radius);
        smoke.addColorStop(0, `rgba(76,94,91,${(1 - phase) * .34})`); smoke.addColorStop(1, 'rgba(75,94,91,0)'); circle(ctx, x, y, radius, smoke);
      }
      // Short signal spars and a fortified pilothouse emphasize its low silhouette.
      for (const x of [-L * .36, L * .35]) { line(ctx, x, -W * .22, x, W * .23, '#5f746b', 3.5); circle(ctx, x, 0, 6, '#9dada0', '#3b5654'); }
      ctx.fillStyle = '#3d5654'; rounded(ctx, L * .24, -17, 33, 34, 4); ctx.fill();
      ctx.fillStyle = '#9aa99a'; ctx.fillRect(L * .24 + 4, -13, 25, 6);
      ctx.fillStyle = '#142f35'; ctx.fillRect(L * .24 + 6, -11, 6, 3); ctx.fillRect(L * .24 + 20, -11, 6, 3);
      // Copper ram blade is a visible part of the bow.
      ctx.beginPath(); ctx.moveTo(L * .40, -12); ctx.lineTo(L * .61, 0); ctx.lineTo(L * .40, 12); ctx.closePath(); ctx.fillStyle = '#a88d61'; ctx.fill();
    }

    drawBombard(ctx, ship) {
      const L = ship.L, W = ship.W;
      for (const x of [L * .23, -L * .065]) {
        ctx.fillStyle = '#705335'; rounded(ctx, x - 32, -34, 64, 68, 5); ctx.fill(); ctx.strokeStyle = '#ba965c'; ctx.lineWidth = 2; ctx.stroke();
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) circle(ctx, x + sx * 24, sy * 27, 4, '#3f4638', '#9d9b74');
        circle(ctx, x, 0, 28, '#48564c', '#b5a46d'); circle(ctx, x, 0, 22, '#72785b', '#303f39');
        // Oblique oval muzzle and a thick bronze barrel show the high firing angle.
        ctx.save(); ctx.translate(x, 0); ctx.rotate(-.35);
        ctx.fillStyle = '#65705b'; rounded(ctx, -15, -21, 30, 35, 8); ctx.fill();
        ctx.fillStyle = '#9b9a6c'; ctx.fillRect(-14, -16, 7, 22);
        ctx.beginPath(); ctx.ellipse(0, -21, 18, 12, 0, 0, TAU); ctx.fillStyle = '#c1b682'; ctx.fill(); ctx.strokeStyle = '#4b5847'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -21, 11, 7, 0, 0, TAU); ctx.fillStyle = '#142b2b'; ctx.fill();
        if (Math.max(...(ship.flash || [0])) > 0) {
          const glow = ctx.createRadialGradient(0, -23, 0, 0, -23, 49); glow.addColorStop(0, '#ffebae'); glow.addColorStop(.28, 'rgba(255,197,91,.8)'); glow.addColorStop(1, 'rgba(255,171,67,0)'); circle(ctx, 0, -23, 49, glow);
          ctx.beginPath(); ctx.moveTo(-10, -25); ctx.lineTo(-17, -53); ctx.lineTo(-5, -46); ctx.lineTo(0, -70); ctx.lineTo(7, -45); ctx.lineTo(18, -53); ctx.lineTo(10, -25); ctx.closePath(); ctx.fillStyle = '#ffe4a1'; ctx.fill();
        }
        ctx.restore();
      }
      // A small aft mizzen leaves both mortar beds unobstructed.
      this.drawLateen(ctx, -L * .34, L * .63, W * .68, ship.id, '#d8c797');
      for (let n = 0; n < 5; n++) {
        const x = -L * .34 + (n % 2) * 17, y = W * .23 + Math.floor(n / 2) * 10;
        circle(ctx, x, y, 6, '#283c37', '#819177'); line(ctx, x + 2, y - 5, x + 5, y - 9, '#c2a46d', 1.5);
      }
    }

    drawLeviathanOrnaments(ctx, ship) {
      const L = ship.L, W = ship.W;
      // A towering, triple-tiered navy transom is wrapped in carved gilded galleries.
      for (let tier = 0; tier < 3; tier++) {
        const x = -L * (.495 - tier * .032), width = L * .055, span = W * (.79 - tier * .10);
        ctx.fillStyle = tier % 2 ? '#284754' : '#1b3447'; rounded(ctx, x, -span / 2, width, span, 10); ctx.fill();
        ctx.strokeStyle = '#d1ad66'; ctx.lineWidth = 3.5; ctx.stroke();
        for (let yy = -span / 2 + 19; yy < span / 2 - 8; yy += 27) {
          ctx.fillStyle = '#9bb8b2'; rounded(ctx, x + width * .22, yy - 7, width * .55, 14, 3); ctx.fill();
          line(ctx, x + width * .49, yy - 7, x + width * .49, yy + 7, '#dec07d', 2);
          line(ctx, x + width * .23, yy, x + width * .77, yy, '#dec07d', 1.5);
        }
        line(ctx, x + width * .12, -span / 2 + 10, x + width * .12, span / 2 - 10, '#e1c77e', 2);
      }
      for (const side of [-1, 1]) {
        ctx.strokeStyle = '#b39356'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-L * .49, side * W * .37); ctx.bezierCurveTo(-L * .42, side * W * .50, -L * .28, side * W * .46, -L * .22, side * W * .32); ctx.stroke();
        for (let n = 0; n < 6; n++) circle(ctx, -L * .45 + n * L * .036, side * W * (.37 + Math.sin(n / 5 * Math.PI) * .05), 4, '#e9d392');
      }
      this.paintCrown(ctx, -L * .39, 0, W * .19, '#dfbf75');
      // Carved sea-dragon figurehead reaches the end of the monumental bowsprit.
      ctx.beginPath(); ctx.moveTo(L * .49, -W * .06);
      ctx.bezierCurveTo(L * .56, -W * .12, L * .60, -W * .10, L * .62, -W * .025);
      ctx.lineTo(L * .675, -W * .014); ctx.lineTo(L * .65, W * .035); ctx.lineTo(L * .60, W * .04);
      ctx.quadraticCurveTo(L * .56, W * .12, L * .50, W * .04); ctx.closePath(); ctx.fillStyle = '#c7a05a'; ctx.fill(); ctx.strokeStyle = '#765b37'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * .55, -W * .07); ctx.lineTo(L * .55, -W * .14); ctx.lineTo(L * .575, -W * .07); ctx.lineTo(L * .58, -W * .14); ctx.lineTo(L * .60, -W * .045); ctx.closePath(); ctx.fillStyle = '#e8c778'; ctx.fill();
      circle(ctx, L * .625, -W * .012, 4.5, '#276a6c');
      // Chained anchors sit along both forward shoulders, inside the collision envelope.
      for (const side of [-1, 1]) {
        const ax = L * .35, ay = side * W * .70;
        for (let n = 0; n < 10; n++) {
          const u = n / 9, x = L * (.24 + u * .11), y = side * W * (.38 + u * .32);
          ctx.strokeStyle = n % 2 ? '#8e9b87' : '#d0be84'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, n % 2 ? 3.5 : 6, n % 2 ? 6 : 3.5, .8 * side, 0, TAU); ctx.stroke();
        }
        line(ctx, ax, ay - side * 25, ax, ay + side * 18, '#283f44', 8);
        line(ctx, ax - 18, ay - side * 11, ax + 18, ay - side * 11, '#b8ab76', 6);
        ctx.strokeStyle = '#9b9f7c'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(ax - 25, ay + side * 4); ctx.quadraticCurveTo(ax, ay + side * 43, ax + 25, ay + side * 4); ctx.stroke();
        circle(ctx, ax, ay - side * 29, 7, null, '#bdaf79');
      }
    }

    drawStormarkFloats(ctx, ship) {
      const L = ship.L, W = ship.W;
      for (const side of [-1, 1]) {
        const y = side * W * .73;
        for (const x of [-L * .23, L * .22]) {
          ctx.strokeStyle = '#433d2b'; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(x, side * W * .31); ctx.quadraticCurveTo(x - 10, side * W * .57, x + 7, y); ctx.stroke();
          ctx.strokeStyle = '#d4b377'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.save(); ctx.translate(-L * .02, y);
        hullPath(ctx, L * .66, W * .18); ctx.fillStyle = '#4a5c4f'; ctx.fill(); ctx.strokeStyle = '#d7c28e'; ctx.lineWidth = 2.5; ctx.stroke();
        hullPath(ctx, L * .66, W * .18, .77); ctx.fillStyle = '#5dada7'; ctx.fill();
        line(ctx, -L * .27, 0, L * .28, 0, '#ece7be', 3);
        ctx.restore();
      }
    }

    drawShip(ship) {
      const ctx = this.ctx, L = ship.L || 330, W = ship.W || 110;
      const t = this.time, sinking = typeof ship.sinking === 'number' ? ship.sinking : ship.sinking ? 1 : 0;
      const sunk = clamp(sinking / 4, 0, .96), damaged = ship.hp / ship.hpMax < .35;
      const ghost = ship.kind === 'ghost' || ship.skeleton;
      const ironclad = ship.kind === 'ironclad', bombard = ship.kind === 'bombard' || ship.weapon === 'mortar';
      const galley = ship.kind === 'galley', cutter = ship.kind === 'cutter', frigate = ship.kind === 'frigate';
      const leviathan = ship.kind === 'leviathan', stormark = ship.kind === 'stormark';
      const specialRig = ironclad || bombard || galley || cutter;
      const shipHull = (scale = 1) => hullPath(ctx, L, W, scale, ship.kind);
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate((ship.a || 0) + sunk * .17);
      ctx.globalAlpha = 1 - sunk * .9;
      if (sunk) { ctx.scale(1 - sunk * .18, 1 - sunk * .26); ctx.translate(-sunk * L * .13, 0); }
      if (stormark) this.drawStormarkFloats(ctx, ship);
      if (ghost) {
        const aura = ctx.createRadialGradient(0, 0, W * .2, 0, 0, L * .74);
        aura.addColorStop(0, 'rgba(85,223,150,.21)'); aura.addColorStop(.6, 'rgba(78,183,129,.08)'); aura.addColorStop(1, 'rgba(78,183,129,0)');
        ctx.save(); ctx.scale(1, .57); circle(ctx, 0, 0, L * .74, aura); ctx.restore();
      }
      // Soft cast shadow is offset from the illustrated hull and rigging.
      ctx.save(); ctx.translate(9, 15); shipHull(1.06); ctx.fillStyle = 'rgba(0,24,31,.36)'; ctx.fill(); ctx.restore();
      const hull = ctx.createLinearGradient(0, -W * .6, 0, W * .6);
      hull.addColorStop(0, ghost ? '#203e36' : ironclad ? '#263c42' : leviathan ? '#142d43' : stormark ? '#304d45' : frigate ? '#202f32' : '#342d24'); hull.addColorStop(.18, ghost ? '#486254' : ironclad ? '#6a7d77' : leviathan ? '#40596a' : stormark ? '#5b7b60' : frigate ? '#475249' : '#725032'); hull.addColorStop(.75, ghost ? '#283e34' : ironclad ? '#354e50' : leviathan ? '#223e52' : stormark ? '#3d5e50' : frigate ? '#283b3a' : '#513a28'); hull.addColorStop(1, ghost ? '#152e29' : '#241f1c');
      shipHull(); ctx.fillStyle = hull; ctx.fill(); ctx.strokeStyle = '#172c2c'; ctx.lineWidth = 4; ctx.stroke();
      shipHull(.96); ctx.strokeStyle = ghost ? '#9ec99d' : ironclad ? '#a4b1a4' : '#c79956'; ctx.lineWidth = 3; ctx.stroke();
      shipHull(.88); ctx.fillStyle = ghost ? '#6e7b62' : '#ad8551'; ctx.fill();
      ctx.save(); shipHull(.875); ctx.clip();
      // Individual deck planks, staggered joins and grain.
      for (let y = -W * .46, row = 0; y < W * .47; y += 9, row++) {
        ctx.fillStyle = ghost ? (row % 3 === 0 ? '#7e8b70' : row % 3 === 1 ? '#8d9679' : '#6c7c63') : row % 3 === 0 ? '#b69360' : row % 3 === 1 ? '#c09c69' : '#ad8956';
        ctx.fillRect(-L * .6, y, L * 1.2, 8);
        line(ctx, -L * .6, y + 8, L * .6, y + 8, 'rgba(63,46,28,.44)', 1);
        for (let x = -L * .5 + (row % 2) * 32; x < L * .6; x += 65) {
          line(ctx, x, y, x, y + 8, '#87683e', .8);
          line(ctx, x + 7, y + 3, x + 42, y + 3, 'rgba(231,194,131,.20)', .7);
        }
      }
      if (damaged) {
        for (let i = 0; i < 7; i++) {
          const x = (hash(ship.id, i) - .5) * L * .65, y = (hash(i, ship.id + 1) - .5) * W * .66;
          ctx.save(); ctx.translate(x, y); ctx.rotate(hash(i + 3, ship.id) * TAU);
          ctx.fillStyle = 'rgba(44,34,27,.5)'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, TAU); ctx.fill();
          line(ctx, -20, -4, 18, 5, '#473d2c', 2); ctx.restore();
        }
      }
      ctx.restore();
      if (frigate) {
        for (const side of [-1, 1]) {
          line(ctx, -L * .39, side * W * .43, L * .27, side * W * .43, '#ddd4ab', 5);
          line(ctx, -L * .36, side * W * .47, L * .25, side * W * .47, '#bc8b50', 2);
          for (let n = 0; n < 9; n++) { ctx.fillStyle = '#193235'; ctx.fillRect(-L * .32 + n * L * .065, side * W * .44 - 4, 13, 8); }
        }
      }
      if (leviathan) {
        for (const side of [-1, 1]) for (let deck = 0; deck < 3; deck++) {
          const y = side * W * (.31 + deck * .075), start = -L * .35, end = L * (.29 - deck * .035);
          line(ctx, start, y, end, y, '#1a3347', 13); line(ctx, start, y - side * 8, end, y - side * 8, '#d0ac68', 2.8);
          for (let n = 0; n < 14; n++) {
            const x = start + 16 + n * (end - start - 32) / 13;
            ctx.fillStyle = '#101f29'; rounded(ctx, x - 9, y - 5, 18, 10, 2); ctx.fill();
            line(ctx, x - 8, y - side * 5, x + 8, y - side * 5, '#d9bd7b', 1.3);
          }
        }
      }
      // Structural beams, stern galleries, and raised forecastle.
      for (const x of [-L * .32, -L * .04, L * .25]) line(ctx, x, -W * .37, x, W * .37, '#7d603c', 5);
      ctx.fillStyle = '#685039'; rounded(ctx, -L * .47, -W * .32, L * .19, W * .64, 8); ctx.fill();
      ctx.fillStyle = '#bc975e'; rounded(ctx, -L * .46, -W * .31, L * .16, W * .62, 7); ctx.fill();
      for (let y = -W * .25; y < W * .28; y += W * .12) {
        ctx.fillStyle = '#2f4d50'; ctx.fillRect(-L * .474, y, 10, W * .075);
        line(ctx, -L * .478, y, -L * .458, y, '#e0bb70', 1.5);
      }
      for (let x = -L * .44; x < -L * .31; x += 9) line(ctx, x, -W * .29, x, W * .29, 'rgba(105,74,41,.5)', 1);
      ctx.fillStyle = '#9a754a'; ctx.beginPath(); ctx.moveTo(L * .29, -W * .25); ctx.lineTo(L * .47, 0); ctx.lineTo(L * .29, W * .25); ctx.closePath(); ctx.fill();
      line(ctx, L * .29, -W * .25, L * .29, W * .25, '#dcc38c', 3);
      // Hatches with dark lattice.
      for (const x of [-L * .12, L * .15]) {
        ctx.fillStyle = '#584a34'; rounded(ctx, x - 13, -W * .15, 28, W * .30, 2); ctx.fill();
        ctx.strokeStyle = '#bc9f62'; ctx.lineWidth = 1.2;
        for (let yy = -W * .12; yy <= W * .13; yy += 6) line(ctx, x - 11, yy, x + 13, yy, '#af915c', 1);
        for (let xx = x - 8; xx < x + 14; xx += 6) line(ctx, xx, -W * .13, xx, W * .13, '#af915c', 1);
      }
      // Bowsprit and anchor tackle.
      if (!ironclad && !bombard) {
        line(ctx, L * .37, 0, L * .69, 0, '#3e3729', galley ? 12 : 8); line(ctx, L * .38, -1, L * .68, -1, galley ? '#c4a568' : '#ba9763', galley ? 5 : 3);
        if (galley) { ctx.beginPath(); ctx.moveTo(L * .55, -9); ctx.lineTo(L * .72, 0); ctx.lineTo(L * .55, 9); ctx.closePath(); ctx.fillStyle = '#c1a06b'; ctx.fill(); }
        else { line(ctx, L * .42, -W * .13, L * .67, 0, 'rgba(52,47,34,.8)', 1.4); line(ctx, L * .42, W * .13, L * .67, 0, 'rgba(52,47,34,.8)', 1.4); }
      }
      // Oars pull through the water on both sides, synchronized by paired rowers.
      const rowing = (ship.crew || []).filter(c => c.hp > 0 && c.role === 'rower').length;
      if (galley || rowing > 0 && !ship.anchor) {
        const count = galley ? 16 : Math.min(7, Math.ceil(rowing / 2));
        for (let n = 0; n < count; n++) for (const side of [-1, 1]) {
          const x = -L * (galley ? .36 : .17) + n * L * (galley ? .76 : .40) / Math.max(1, count - 1), phase = ship.anchor ? .8 : t * (galley ? 3.7 : 4) + n * .18;
          const reach = W * (galley ? .95 + .30 * (1 + Math.sin(phase)) / 2 : .48 + .29 * (1 + Math.sin(phase)) / 2), sweep = Math.cos(phase) * W * (galley ? .30 : .22);
          line(ctx, x, side * W * .36, x + sweep, side * reach, '#73573a', 4);
          ctx.save(); ctx.translate(x + sweep, side * reach); ctx.rotate(-side * Math.cos(phase) * .35);
          ctx.fillStyle = '#b9955f'; rounded(ctx, -6, -side * 3 - 12, 12, 25, 3); ctx.fill(); ctx.restore();
          if (!ship.anchor && Math.sin(phase) < -.3) {
            ctx.strokeStyle = 'rgba(217,255,229,.35)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(x + sweep, side * reach, 16, 7, .2, 0, Math.PI); ctx.stroke();
          }
        }
      }
      // Bronze-rimmed iron cannon barrels seated in wooden carriages.
      const cannonCount = Array.isArray(ship.cannons) ? ship.cannons.length : ship.cannons == null ? 3 : Number(ship.cannons);
      const guns = bombard ? 0 : clamp(Math.round(cannonCount), 0, 18);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        for (let n = 0; n < guns; n++) {
          const x = L * .28 - n * L * .48 / Math.max(1, guns - 1), y = side * W * .40;
          ctx.fillStyle = ironclad ? '#455c57' : '#66462e'; rounded(ctx, x - 10, y - 10, 20, 20, 3); ctx.fill();
          for (const sx of [-1, 1]) circle(ctx, x + sx * 8, y - side * 4, 3, '#342e24', '#b98b50');
          ctx.save(); ctx.translate(x, y); ctx.rotate(side * Math.PI / 2);
          const barrel = ctx.createLinearGradient(0, -6, 0, 6); barrel.addColorStop(0, '#1b2829'); barrel.addColorStop(.4, '#647773'); barrel.addColorStop(1, '#243537');
          ctx.fillStyle = barrel; rounded(ctx, -7, -6, 26, 12, 3); ctx.fill();
          line(ctx, 14, -6, 14, 6, '#b9a56c', 3); circle(ctx, 20, 0, 4, '#17292a');
          ctx.restore();
          if ((ship.flash?.[sideIndex] || 0) > 0) this.drawMuzzle(ctx, x, y + side * 25, side, ship.flash[sideIndex], n + ship.id);
        }
      }
      // Crew keep walking between their actual engine-supplied deck positions.
      if (this.zoom > .31) for (const sailor of ship.crew || []) if (sailor.hp > 0 && !sailor.boarding) this.drawCrew(sailor, ship);
      if (leviathan) this.drawLeviathanOrnaments(ctx, ship);
      // Three masts on the larger ships; two on brigs and sloops.
      const masts = specialRig ? [] : leviathan ? [L * .35, L * .17, -L * .015, -L * .20, -L * .37] : stormark ? [L * .29, L * .07, -L * .16, -L * .36] : L >= 440 || frigate ? [L * .26, -L * .015, -L * .30] : [L * .20, -L * .24];
      const mastColors = ghost ? ['#d4e2b9', '#687f68'] : ship.team === 'enemy' && ship.kind === 'boss' ? ['#b59b76', '#74594b'] : ['#f5e7bc', '#d3bf8e'];
      for (let m = 0; m < masts.length; m++) {
        const mx = masts[m], span = W * (leviathan ? m === 2 ? .64 : m === 0 || m === 4 ? .47 : .57 : stormark ? m === 1 ? .56 : .45 : frigate ? m === 1 ? .69 : .55 : m === masts.length - 1 ? .57 : .72), billow = L * (leviathan ? .063 : stormark ? .075 : frigate ? .085 : .105);
        const flutter = Math.sin(t * 2.1 + m * 1.9 + ship.id) * 3;
        // Fine standing rigging to four deck cleats.
        for (const dx of [-L * .14, L * .15]) for (const side of [-1, 1]) line(ctx, mx, 0, clamp(mx + dx, -L * .42, L * .40), side * W * .39, 'rgba(45,44,32,.61)', 1);
        ctx.save(); ctx.translate(4, 9);
        ctx.beginPath(); ctx.moveTo(mx - 6, -span); ctx.bezierCurveTo(mx + billow * .8, -span * .8, mx + billow * .9, span * .75, mx - 6, span);
        ctx.quadraticCurveTo(mx - billow * .17, 0, mx - 6, -span); ctx.fillStyle = 'rgba(16,35,32,.18)'; ctx.fill(); ctx.restore();
        // Curved, full cloth belly, with distinct panel seams and shaded leech.
        this.sailClothPath(ctx, mx, span, billow, flutter, ghost, ship.id + m * 19);
        const cloth = ctx.createLinearGradient(mx - 7, 0, mx + billow, 0);
        cloth.addColorStop(0, mastColors[1]); cloth.addColorStop(.35, mastColors[0]); cloth.addColorStop(.75, ghost ? '#b7caa7' : '#eee1b8'); cloth.addColorStop(1, ghost ? '#65826c' : '#b8a780');
        ctx.fillStyle = cloth; ctx.fill('evenodd'); ctx.strokeStyle = ghost ? '#5b7863' : '#8b7b56'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.save(); ctx.clip('evenodd');
        for (let yy = -span + 18; yy < span; yy += 20) {
          ctx.strokeStyle = 'rgba(147,126,84,.24)'; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(mx - 15, yy); ctx.quadraticCurveTo(mx + billow * .45, yy + flutter * .35, mx + billow + 10, yy + 3); ctx.stroke();
        }
        if (leviathan && m === 2) {
          this.paintCrown(ctx, mx + billow * .30, 0, span * .37, '#a4874b');
        } else if (stormark && m === 1) {
          this.paintStormCrest(ctx, mx + billow * .31, 0, span * .36, '#3b8588');
        } else if (m === 1 && ghost) {
          const emblemX = mx + billow * .28;
          line(ctx, emblemX - span * .13, span * .20, emblemX + span * .15, span * .44, '#3e634c', 3);
          line(ctx, emblemX + span * .13, span * .20, emblemX - span * .15, span * .44, '#3e634c', 3);
          this.paintSkull(ctx, emblemX, -span * .02, span * .32, '#3c614a');
        } else if (m === 1 && ship.team === 'player') {
          ctx.save(); ctx.translate(mx + billow * .34, 0); ctx.strokeStyle = '#b7954c'; ctx.lineWidth = 2.5;
          circle(ctx, 0, 0, span * .21, null, '#b7954c');
          line(ctx, 0, -span * .31, 0, span * .27, '#b7954c', 2.7);
          ctx.beginPath(); ctx.arc(0, span * .02, span * .18, 0, Math.PI); ctx.stroke();
          for (const side of [-1, 1]) line(ctx, side * span * .18, span * .02, side * span * .15, -span * .05, '#b7954c', 3);
          ctx.restore();
        }
        ctx.restore();
        line(ctx, mx - 6, -span - 7, mx - 6, span + 7, '#57452d', 5);
        line(ctx, mx - 7, -span - 6, mx - 7, span + 5, '#be9b62', 1.6);
        line(ctx, mx, -W * .08, mx, W * .08, '#4a3c2b', 8);
        circle(ctx, mx, 0, 6, '#d6b87b', '#4c412f');
        if (leviathan || stormark) {
          const color = leviathan ? '#203d53' : '#3a8a8c';
          this.paintFlag(ctx, mx, -span + 6, W * (leviathan ? .20 : .18), color, t + ship.id + m, false, leviathan ? 'crown' : 'storm');
        }
      }
      if (cutter) this.drawCutterRig(ctx, ship);
      if (ironclad) this.drawIronclad(ctx, ship);
      if (bombard) this.drawBombard(ctx, ship);
      if (galley) {
        this.drawLateen(ctx, L * .20, L * .87, W, ship.id);
        this.drawLateen(ctx, -L * .24, L * .71, W * .88, ship.id + 2, '#e1d2a6');
        for (const side of [-1, 1]) line(ctx, -L * .38, side * W * .40, L * .35, side * W * .40, '#cfb476', 3);
      }
      // Triangular headsail, jib rigging, stern ensign, and gilded transom.
      if (masts.length) {
        const jibX = masts[0];
        ctx.beginPath(); ctx.moveTo(jibX + L * .045, -W * .35); ctx.quadraticCurveTo(L * .48, -W * .4, L * .62, -2); ctx.lineTo(jibX + L * .04, W * .05); ctx.closePath();
        ctx.fillStyle = ghost ? '#afc4a0' : '#e8d9ac'; ctx.fill(); ctx.strokeStyle = ghost ? '#617e63' : '#9e8b60'; ctx.lineWidth = 1; ctx.stroke();
        line(ctx, jibX, -W * .4, L * .67, 0, '#3e4939', 1.3);
      }
      line(ctx, -L * .45, -W * .02, -L * .58, -W * .27, '#674f32', 3);
      ctx.save(); ctx.translate(-L * .58, -W * .27); ctx.rotate(leviathan || stormark ? 0 : -(ship.a || 0) * .45 - .4);
      this.paintFlag(ctx, 0, 0, W * (leviathan ? .58 : .49), leviathan ? '#203b53' : stormark ? '#3c8a8e' : ghost ? '#28523e' : ship.team === 'enemy' ? '#282d2c' : faction(ship), t + ship.id, false, leviathan ? 'crown' : stormark ? 'storm' : 'skull'); ctx.restore();
      line(ctx, -L * .49, -W * .27, -L * .49, W * .27, '#d9b969', 3);
      // The wheel's spokes visibly turn while sailing.
      ctx.save(); ctx.translate(-L * .36, 0); ctx.rotate(Math.sin(t * .6) * .28);
      circle(ctx, 0, 0, 9, '#805b36', '#d5ae64');
      for (let n = 0; n < 8; n++) { const a = n / 8 * TAU; line(ctx, 0, 0, Math.cos(a) * 12, Math.sin(a) * 12, '#d6b370', 2); }
      circle(ctx, 0, 0, 3, '#e3c785'); ctx.restore();
      if (ship.team === 'player' && this.state.deckMode && this.state.captain?.hp > 0) {
        const captain = this.state.captain;
        circle(ctx, captain.lx, captain.ly, 13, 'rgba(240,216,140,.10)', '#f2d88c');
        this.drawCrew(captain, ship);
      }
      if (ship.burn > 0) for (let i = 0; i < 4; i++) this.drawDeckFire(ctx, (hash(ship.id, i) - .5) * L * .65, (hash(i, ship.id) - .5) * W * .48, 15 + i * 2, i);
      if (ghost) {
        this.drawGhostFlame(ctx, -L * .43, -W * .28, 11, ship.id);
        this.drawGhostFlame(ctx, -L * .43, W * .28, 11, ship.id + 1);
        ctx.strokeStyle = 'rgba(131,217,162,.30)'; ctx.lineWidth = 1.8;
        shipHull(1.025); ctx.stroke();
      }
      if (ship.anchor) {
        ctx.strokeStyle = 'rgba(53,51,37,.7)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(L * .32, W * .32); ctx.quadraticCurveTo(L * .5, W * .7, L * .30, W * .92); ctx.stroke();
      }
      ctx.restore();
      if (sunk) {
        for (let i = 0; i < 3; i++) {
          const phase = (this.time * .3 + i / 3) % 1;
          ctx.strokeStyle = `rgba(218,255,232,${(1 - phase) * .3})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(ship.x, ship.y, L * (.35 + phase * .35), W * (.7 + phase), ship.a || 0, 0, TAU); ctx.stroke();
        }
      }
      if (ship.hp > 0 && (ship.team !== 'neutral' || this.state.target?.id === ship.id)) this.drawShipLabel(ship);
    }

    drawCrew(crew, ship) {
      const ctx = this.ctx, t = this.time;
      const x = Number(crew.lx) || 0, y = Number(crew.ly) || 0;
      const moving = Math.hypot((crew.tx ?? x) - x, (crew.ty ?? y) - y) > 3;
      const walk = moving ? Math.sin(t * 13 + crew.id * 2) * 2 : Math.sin(t * 2 + crew.id) * .35;
      const team = crew.team || ship.team, enemy = team === 'enemy', friendly = ['player', 'ally'].includes(team);
      const accent = enemy ? '#f35d68' : friendly ? '#58ddc6' : '#cbbb8e';
      // A sailor keeps their identity when crossing onto a different faction's deck.
      const undead = crew.skeleton === true || crew.skeleton === undefined && team === ship.team && (ship.skeleton || ship.kind === 'ghost');
      ctx.save(); ctx.translate(x, y);
      if (enemy || friendly) { circle(ctx, 0, 2, 7.3, enemy ? 'rgba(175,38,58,.20)' : 'rgba(25,163,142,.18)', accent); }
      if (undead) {
        circle(ctx, 1.5, 4, 6, 'rgba(11,40,31,.28)');
        // Pelvis, articulated leg bones, spinal column and a visible rib cage.
        const bone = '#d9dfb4', shade = '#a7bc93';
        line(ctx, -2.2, 2.4, -3.2 + walk * .4, 7.5, bone, 1.8);
        line(ctx, -3.2 + walk * .4, 7.5, -5 + walk, 10, shade, 1.7);
        line(ctx, 2.2, 2.4, 3.2 - walk * .4, 7.5, bone, 1.8);
        line(ctx, 3.2 - walk * .4, 7.5, 4.5 - walk, 10, shade, 1.7);
        line(ctx, 0, -4, 0, 3.8, bone, 1.8);
        line(ctx, -2.5, 3.5, 2.5, 3.5, bone, 2);
        for (let n = 0; n < 3; n++) {
          ctx.strokeStyle = bone; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.ellipse(0, -3 + n * 2, 3.4 - n * .3, 1.5, 0, 0, Math.PI); ctx.stroke();
        }
        line(ctx, -3, -3, -6, 1 + walk, bone, 1.7); line(ctx, -6, 1 + walk, -5, 5, shade, 1.5);
        line(ctx, 3, -3, 6, 0 - walk, bone, 1.7); line(ctx, 6, -walk, 7, -4 - walk, shade, 1.5);
        this.paintSkull(ctx, 0, -7, 6, '#e0e3b9');
        // Faction cloth stays red for enemies and teal for friendly skeletons.
        line(ctx, -3.5, -9, 3.7, -9, accent, 2.3);
        line(ctx, -3, -9, -6, -7.5, accent, 1.8);
        line(ctx, -3.5, -1, 3, 3.5, accent, 2.2);
        ctx.strokeStyle = '#dcece0'; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(8, -5 - walk); ctx.quadraticCurveTo(13, -10 - walk, 12, -17 - walk); ctx.stroke();
        line(ctx, 5.5, -5.5 - walk, 10, -3.5 - walk, '#b8b473', 1.5);
        ctx.restore(); return;
      }
      circle(ctx, 1.5, 3, 5, 'rgba(35,37,27,.25)');
      line(ctx, -2, 3, -3 + walk, 7, '#3c3f35', 2.2); line(ctx, 2, 3, 3 - walk, 7, '#3c3f35', 2.2);
      circle(ctx, 0, 0, crew.isCaptain ? 5.3 : 4.6, enemy ? '#ba3849' : friendly ? crew.isCaptain ? '#236e6a' : '#369e8d' : '#b9b18b');
      line(ctx, -4, 0, -6, 3 + walk, '#d1ae7d', 2); line(ctx, 4, 0, 6, 3 - walk, '#d1ae7d', 2);
      circle(ctx, 0, -2, 3.1, '#d4b081');
      if (crew.isCaptain) {
        ctx.beginPath(); ctx.moveTo(-7, -2); ctx.quadraticCurveTo(-2, -10, 2, -6); ctx.lineTo(7, -2); ctx.quadraticCurveTo(0, 1, -7, -2); ctx.fillStyle = '#293d40'; ctx.fill();
        line(ctx, -5, -3, 4, -4, friendly || enemy ? accent : '#d8b565', 1.5);
      } else { ctx.fillStyle = accent; ctx.fillRect(-4, -4, 8, 2); }
      line(ctx, -3.2, 1.2, 3.2, 3, accent, 1.8);
      if (crew.role === 'repairer' && ship.hp < ship.hpMax) {
        line(ctx, 5, 0, 10, -5 + walk, '#735433', 2); line(ctx, 7, -6 + walk, 12, -3 + walk, '#a4aaa0', 3);
      }
      ctx.restore();
    }

    drawBoarders(S) {
      const ctx = this.ctx;
      for (const ship of S.ships || []) {
        if (ship.hp <= 0) continue;
        for (const sailor of ship.crew || []) {
          if (sailor.hp <= 0 || !sailor.boarding) continue;
          const b = sailor.boarding, t = clamp((b.t || 0) / .9, 0, 1), ease = t * t * (3 - 2 * t);
          const ca = Math.cos(ship.a), sa = Math.sin(ship.a);
          const toX = ship.x + sailor.lx * ca - sailor.ly * sa, toY = ship.y + sailor.lx * sa + sailor.ly * ca;
          const fromX = b.fromX ?? b.from?.x ?? toX, fromY = b.fromY ?? b.from?.y ?? toY;
          const x = fromX + (toX - fromX) * ease, y = fromY + (toY - fromY) * ease;
          if (!this.visible(x, y, 30)) continue;
          circle(ctx, x + 3, y + 8, 8, 'rgba(6,34,35,.2)');
          ctx.save(); ctx.translate(x, y - Math.sin(t * Math.PI) * 25); ctx.rotate(Math.atan2(toY - fromY, toX - fromX) - Math.PI / 2);
          this.drawCrew({ ...sailor, lx: 0, ly: 0, tx: 10, ty: 10 }, ship); ctx.restore();
        }
      }
    }

    drawMuzzle(ctx, x, y, side, flash, seed) {
      const strength = clamp(flash * 5, .3, 1), length = 45 + hash(seed, 6) * 25;
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * Math.PI / 2);
      const glow = ctx.createRadialGradient(6, 0, 0, 6, 0, 43); glow.addColorStop(0, `rgba(255,211,98,${strength * .8})`); glow.addColorStop(1, 'rgba(255,190,60,0)');
      circle(ctx, 6, 0, 43, glow);
      ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(length * .5, -13); ctx.lineTo(length * .40, -4); ctx.lineTo(length, 0); ctx.lineTo(length * .42, 5); ctx.lineTo(length * .58, 14); ctx.lineTo(-4, 7); ctx.closePath();
      ctx.fillStyle = `rgba(255,227,149,${strength})`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(length * .75, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fillStyle = '#fff3cc'; ctx.fill(); ctx.restore();
    }

    drawDeckFire(ctx, x, y, size, seed) {
      const wave = Math.sin(this.time * 12 + seed * 2), h = size * (1.4 + wave * .2);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 2.2); glow.addColorStop(0, 'rgba(252,139,41,.45)'); glow.addColorStop(1, 'rgba(252,139,41,0)');
      circle(ctx, x, y, size * 2.2, glow);
      ctx.beginPath(); ctx.moveTo(x - size * .55, y + size * .35); ctx.quadraticCurveTo(x - size * .7, y - size * .6, x + wave * 3, y - h);
      ctx.quadraticCurveTo(x + size * .1, y - size * .4, x + size * .5, y + size * .3); ctx.closePath(); ctx.fillStyle = '#e88b38'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - size * .23, y + size * .3); ctx.quadraticCurveTo(x - size * .4, y - size * .35, x + wave, y - h * .6);
      ctx.quadraticCurveTo(x + size * .15, y - size * .1, x + size * .26, y + size * .3); ctx.closePath(); ctx.fillStyle = '#ffdf83'; ctx.fill();
    }

    drawShipLabel(ship) {
      const ctx = this.ctx, z = this.zoom, selected = this.state.target?.id === ship.id;
      const show = selected || ship.team === 'player' && this.state.deckMode;
      if (!show || z < .28) return;
      ctx.save(); ctx.translate(ship.x, ship.y + ship.W * .85 + 26 / z); ctx.scale(1 / z, 1 / z);
      ctx.textAlign = 'center'; ctx.font = selected ? '600 11px system-ui' : '10px system-ui';
      ctx.shadowColor = 'rgba(3,24,31,.9)'; ctx.shadowBlur = 4;
      ctx.fillStyle = ship.team === 'enemy' ? '#efb2a0' : ship.team === 'ally' ? '#9ed8c9' : '#ecdfb4';
      ctx.fillText(ship.team === 'player' ? (this.state.deckMode ? 'CAPTAIN ON DECK' : ship.name || 'Your flagship') : ship.name || ship.kind, 0, 0);
      ctx.shadowBlur = 0;
      if (ship.team !== 'player') {
        rounded(ctx, -29, 6, 58, 3, 1.5); ctx.fillStyle = 'rgba(2,22,27,.65)'; ctx.fill();
        const pct = clamp(ship.hp / ship.hpMax, 0, 1);
        if (pct > 0) { rounded(ctx, -29, 6, 58 * pct, 3, 1.5); ctx.fillStyle = selected ? '#e6bd69' : faction(ship); ctx.fill(); }
      }
      ctx.restore();
    }

    drawCrewBadges(S, vessels) {
      if (S.mode === 'title' || !S.player) return;
      const ctx = this.ctx, player = S.player, z = this.zoom, camera = S.camera;
      const friendly = (a, b) => a === b || ['player', 'ally'].includes(a) && ['player', 'ally'].includes(b);
      const linked = ship => S.grapple?.id === ship.id || player.grapple === ship.id || ship.grapple === player.id;
      const playerLinked = !!S.grapple || !!player.grapple || (player.crew || []).some(c => c.hp > 0 && !friendly(c.team, player.team));
      const priority = ship => ship.id === S.target?.id ? 0 : linked(ship) ? 1 : ship === player ? 2 : 3;
      const ships = vessels.filter(ship => ship.hp > 0 && (ship === player ? playerLinked : ship.id === S.target?.id || linked(ship) || Math.hypot(ship.x - player.x, ship.y - player.y) <= 1000))
        .sort((a, b) => priority(a) - priority(b) || Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 8);
      const placed = [];
      ctx.save(); ctx.font = '600 11px system-ui'; ctx.textBaseline = 'middle';
      for (const ship of ships) {
        const selected = ship.id === S.target?.id, detailed = selected || linked(ship) || ship === player;
        const living = (ship.crew || []).filter(c => c.hp > 0);
        const defenders = living.filter(c => friendly(c.team, ship.team)).length;
        const attackers = living.length - defenders;
        let text = `${defenders} crew`;
        if (detailed && ship !== player && !friendly(ship.team, player.team)) text = `${defenders} defenders${attackers ? ` · ${attackers} boarding` : ''}`;
        else if (detailed && attackers) text += ` · ${attackers} invaders`;
        const width = Math.ceil(ctx.measureText(text).width) + 24, height = 24;
        const extentY = Math.abs(Math.sin(ship.a || 0)) * ship.L * .71 + Math.abs(Math.cos(ship.a || 0)) * ship.W * (ship.kind === 'galley' ? 1.28 : .84);
        const centerX = (ship.x - camera.x) * z + this.width / 2;
        const hullTop = (ship.y - camera.y) * z + this.height / 2 - extentY * z;
        // Offscreen vessels retain the existing bearing arrow instead of another badge.
        if (centerX < -20 || centerX > this.width + 20 || hullTop > this.height || hullTop < -height - 20) continue;
        const badge = { x: clamp(centerX - width / 2, 8, Math.max(8, this.width - width - 8)), y: Math.max(58, hullTop - height - 8), w: width, h: height };
        const overlaps = () => placed.some(p => badge.x < p.x + p.w + 5 && badge.x + badge.w + 5 > p.x && badge.y < p.y + p.h + 5 && badge.y + badge.h + 5 > p.y);
        for (let attempt = 0; overlaps() && attempt < 4; attempt++) {
          if (badge.y > 88) badge.y -= height + 5;
          else badge.x = clamp(badge.x + (attempt % 2 ? -1 : 1) * (width + 8), 8, Math.max(8, this.width - width - 8));
        }
        if (overlaps() && !detailed) continue;
        placed.push(badge);
        ctx.shadowColor = 'rgba(0,16,22,.34)'; ctx.shadowBlur = 5;
        rounded(ctx, badge.x, badge.y, width, height, 6); ctx.fillStyle = 'rgba(6,25,32,.94)'; ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = selected || linked(ship) ? 'rgba(229,198,126,.70)' : 'rgba(184,214,193,.34)'; ctx.lineWidth = 1; ctx.stroke();
        rounded(ctx, badge.x + 6, badge.y + 7, 3, 10, 1.5); ctx.fillStyle = ship === player ? '#e3c476' : ship.team === 'enemy' ? '#d68a74' : faction(ship); ctx.fill();
        ctx.fillStyle = '#f3ecd4'; ctx.textAlign = 'left'; ctx.fillText(text, badge.x + 15, badge.y + height / 2 + .5);
      }
      ctx.restore();
    }

    drawNavigation(S) {
      const ctx = this.ctx, t = this.time, p = S.player;
      if (!p) return;
      for (const island of S.islands || []) {
        if (!island.port || !this.visible(island.x + island.r + 180, island.y, 250)) continue;
        const x = island.x + island.r + 180, y = island.y, near = S.nearPort?.id === island.id;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = near ? '#efce80' : 'rgba(215,234,207,.28)'; ctx.lineWidth = near ? 2.5 : 1.5;
        ctx.strokeRect(-43, -43, 86, 86); ctx.restore();
        if (near && this.zoom > .3) this.worldText(x, y + 100, 'H · ENTER HARBOR', '#f3d998', 9);
      }
      if (S.waypoint) {
        const { x, y } = S.waypoint;
        if (Math.hypot(x - p.x, y - p.y) < 2300 && this.visible(x, y, 20)) {
          ctx.strokeStyle = 'rgba(231,206,141,.13)'; ctx.lineWidth = 1 / this.zoom;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x, y); ctx.stroke();
        }
        const r = 34 + Math.sin(t * 2) * 4;
        circle(ctx, x, y, r, 'rgba(226,195,119,.07)', '#dabe77');
        line(ctx, x - 11, y, x + 11, y, '#e3c986', 2); line(ctx, x, y - 11, x, y + 11, '#e3c986', 2);
        this.worldText(x, y + 65, S.waypoint.name || 'Your destination', '#ead59c', 10);
      }
      if (S.target?.hp > 0) {
        const target = S.target, r = Math.max(target.L * .64, target.W);
        const targetDistance = Math.hypot(target.x - p.x, target.y - p.y), targetAngle = Math.atan2(target.y - p.y, target.x - p.x);
        ctx.save(); ctx.translate(target.x, target.y); ctx.scale(1 / this.zoom, 1 / this.zoom);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          line(ctx, sx * 13, sy * 7, sx * 13, sy * 13, 'rgba(233,197,128,.72)', 1.3);
          line(ctx, sx * 13, sy * 13, sx * 7, sy * 13, 'rgba(233,197,128,.72)', 1.3);
        }
        ctx.restore();
        if (S.grapple?.id === target.id) this.worldText(target.x, target.y - r - 35, 'GRAPPLED', '#efcf86', 10);
        const range = p.range || 1320;
        const outOfRange = targetDistance > range;
        const showAim = !!S.aimAssistVisible && targetDistance < range * 1.25;
        if (showAim && this.visible(target.x, target.y, r)) this.worldText(target.x, target.y - r - 32, outOfRange ? `OUT OF RANGE · ${Math.round(targetDistance)} m` : p.weapon === 'mortar' ? 'MORTAR SOLUTION' : 'BROADSIDE SOLUTION', outOfRange ? '#c3b790' : '#e5cf90', 9);
        if (showAim && p.weapon === 'mortar') circle(ctx, target.x, target.y, 38, 'rgba(238,197,125,.04)', 'rgba(238,197,125,.35)');
        for (let side = 0; showAim && p.weapon !== 'mortar' && side < 2; side++) {
          const angle = p.a + (side === 0 ? -Math.PI / 2 : Math.PI / 2), ready = (p.reload?.[side] || 0) <= 0;
          const halfAngle = .56, difference = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
          const linedUp = !outOfRange && Math.abs(difference) < halfAngle;
          const gradient = ctx.createRadialGradient(p.x, p.y, 70, p.x, p.y, range);
          gradient.addColorStop(0, ready ? 'rgba(238,213,144,.07)' : 'rgba(185,205,193,.025)');
          gradient.addColorStop(1, 'rgba(239,218,158,0)');
          ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, range, angle - halfAngle, angle + halfAngle); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = ready ? 'rgba(233,205,135,.31)' : 'rgba(182,205,195,.13)'; ctx.lineWidth = 1 / this.zoom;
          for (const da of [-halfAngle, halfAngle]) line(ctx, p.x + Math.cos(angle + da) * p.W * .65, p.y + Math.sin(angle + da) * p.W * .65, p.x + Math.cos(angle + da) * range, p.y + Math.sin(angle + da) * range, ctx.strokeStyle, 1 / this.zoom);
          ctx.beginPath(); ctx.arc(p.x, p.y, range, angle - halfAngle, angle + halfAngle); ctx.stroke();
          if (linedUp) {
            line(ctx, p.x + Math.cos(targetAngle) * p.W, p.y + Math.sin(targetAngle) * p.W, target.x, target.y, ready ? 'rgba(236,209,139,.45)' : 'rgba(177,192,162,.22)', 1.2 / this.zoom);
            this.worldText(p.x + Math.cos(angle) * range * .56, p.y + Math.sin(angle) * range * .56, `${side === 0 ? 'Q · PORT' : 'E · STARBOARD'} ${ready ? 'READY' : 'RELOADING'}`, ready ? '#f0d494' : '#afc6b5', 9);
          }
        }
      }
    }

    worldText(x, y, text, color, size) {
      const ctx = this.ctx;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 / this.zoom, 1 / this.zoom);
      ctx.font = `600 ${size}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = color;
      ctx.shadowColor = '#0a343d'; ctx.shadowBlur = 5; ctx.fillText(text, 0, 0); ctx.restore();
    }

    drawGrapples(S) {
      const ctx = this.ctx, seen = new Set();
      for (const ship of S.ships || []) {
        let target = ship === S.player && S.grapple ? S.grapple : ship.grapple;
        if (target && typeof target !== 'object') target = (S.ships || []).find(x => x.id === target);
        if (target?.otherId) target = (S.ships || []).find(x => x.id === target.otherId);
        if (!target || !target.x || ship.hp <= 0 || target.hp <= 0) continue;
        const pair = [ship.id, target.id].sort().join(':'); if (seen.has(pair)) continue; seen.add(pair);
        const dx = target.x - ship.x, dy = target.y - ship.y, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        for (const offset of [-27, 27]) {
          ctx.strokeStyle = 'rgba(5,29,32,.4)'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(ship.x + nx * offset, ship.y + ny * offset + 3);
          ctx.quadraticCurveTo((ship.x + target.x) / 2 + nx * (offset + 12), (ship.y + target.y) / 2 + ny * (offset + 12) + 3, target.x + nx * offset, target.y + ny * offset + 3); ctx.stroke();
          ctx.strokeStyle = '#c4a372'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(ship.x + nx * offset, ship.y + ny * offset);
          ctx.quadraticCurveTo((ship.x + target.x) / 2 + nx * (offset + 12), (ship.y + target.y) / 2 + ny * (offset + 12), target.x + nx * offset, target.y + ny * offset); ctx.stroke();
          // Small rope bindings travel inward from each end, making tension readable.
          const ax = ship.x + nx * offset, ay = ship.y + ny * offset;
          const bx = target.x + nx * offset, by = target.y + ny * offset;
          const cx = (ship.x + target.x) / 2 + nx * (offset + 12), cy = (ship.y + target.y) / 2 + ny * (offset + 12);
          for (let n = 0; n < 3; n++) for (const end of [0, 1]) {
            const phase = (this.time * .58 + n / 3 + (offset > 0 ? .17 : 0)) % 1;
            const u = end ? 1 - (.07 + phase * .40) : .07 + phase * .40, v = 1 - u;
            const x = v * v * ax + 2 * v * u * cx + u * u * bx, y = v * v * ay + 2 * v * u * cy + u * u * by;
            const tx = 2 * (v * (cx - ax) + u * (bx - cx)), ty = 2 * (v * (cy - ay) + u * (by - cy)), length = Math.hypot(tx, ty) || 1;
            const across = 3.3 / Math.sqrt(this.zoom);
            line(ctx, x - ty / length * across, y + tx / length * across, x + ty / length * across, y - tx / length * across, 'rgba(246,225,177,.72)', 1.7 / Math.sqrt(this.zoom));
          }
        }
      }
    }

    drawLoot(loot) {
      const ctx = this.ctx, bob = Math.sin(this.time * 2 + loot.x) * 3;
      const glow = ctx.createRadialGradient(loot.x, loot.y, 0, loot.x, loot.y, 55);
      glow.addColorStop(0, 'rgba(243,196,78,.20)'); glow.addColorStop(1, 'rgba(243,196,78,0)');
      circle(ctx, loot.x, loot.y, 55, glow);
      ctx.save(); ctx.translate(loot.x, loot.y + bob); ctx.rotate(Math.sin(this.time + loot.y) * .07);
      ctx.fillStyle = '#684c30'; rounded(ctx, -17, -10, 34, 23, 4); ctx.fill();
      ctx.fillStyle = '#ad7e43'; rounded(ctx, -17, -12, 34, 15, 5); ctx.fill();
      for (const x of [-10, 8]) { ctx.fillStyle = '#d4b269'; ctx.fillRect(x, -11, 3, 22); }
      ctx.fillStyle = '#edd07a'; ctx.fillRect(-3, -1, 6, 7); ctx.restore();
      ctx.strokeStyle = 'rgba(203,244,219,.22)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(loot.x, loot.y + 10, 27, 10, 0, 0, TAU); ctx.stroke();
    }

    drawProjectile(p) {
      const ctx = this.ctx;
      if (p.weapon === 'mortar') {
        const flight = clamp((p.flightAge || 0) / Math.max(.1, p.flightTotal || 1.8), 0, 1);
        const lift = Math.sin(flight * Math.PI) * 90 / this.zoom, y = p.y - lift;
        const shellColor = p.ammo === 'fire' ? '#ffb56c' : p.ammo === 'chain' ? '#9cdbd4' : p.ammo === 'grape' ? '#ded5b5' : '#edca7c';
        const trailColor = p.ammo === 'fire' ? 'rgba(248,163,79,.42)' : p.ammo === 'chain' ? 'rgba(145,210,207,.37)' : p.ammo === 'grape' ? 'rgba(214,208,180,.34)' : 'rgba(232,197,122,.30)';
        // The sea shadow stays on the physical trajectory; the bomb rises above it.
        ctx.save(); ctx.globalAlpha = .20 + (1 - Math.sin(flight * Math.PI)) * .18;
        ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 7, 10 - Math.sin(flight * Math.PI) * 4, 4, 0, 0, TAU); ctx.fillStyle = '#102d31'; ctx.fill(); ctx.restore();
        const glow = ctx.createRadialGradient(p.x, y, 0, p.x, y, 20);
        glow.addColorStop(0, shellColor); glow.addColorStop(1, 'rgba(249,199,97,0)');
        ctx.save(); ctx.globalAlpha = .42; circle(ctx, p.x, y, 20, glow); ctx.restore();
        const dx = p.vx || 0, dy = p.vy || 0, speed = Math.hypot(dx, dy) || 1;
        const trailX = -dx / speed * 25, trailY = -dy / speed * 25 + (flight < .5 ? 10 : -10);
        line(ctx, p.x + trailX, y + trailY, p.x, y, trailColor, 3);
        circle(ctx, p.x, y, p.size || 7, '#263a37', shellColor);
        line(ctx, p.x + 2, y - 5, p.x + 5, y - 12, '#d5bb75', 2);
        circle(ctx, p.x + 5, y - 12, 2.5 + Math.sin(this.time * 31) * .7, shellColor);
        return;
      }
      const color = p.ammo === 'fire' ? '#f2b05d' : p.ammo === 'chain' ? '#a5d6d0' : p.ammo === 'grape' ? '#d2cdb5' : '#f6e5ad';
      const dx = p.vx || 0, dy = p.vy || 0, len = Math.hypot(dx, dy) || 1;
      line(ctx, p.x - dx / len * 38, p.y - dy / len * 38, p.x, p.y, p.ammo === 'fire' ? 'rgba(246,152,60,.55)' : 'rgba(237,231,196,.34)', p.size || 4);
      circle(ctx, p.x + 3, p.y + 7, 6, 'rgba(0,23,29,.3)');
      if (p.ammo === 'fire') {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 24); glow.addColorStop(0, 'rgba(255,180,68,.6)'); glow.addColorStop(1, 'rgba(255,180,68,0)'); circle(ctx, p.x, p.y, 24, glow);
      }
      circle(ctx, p.x, p.y, p.size || 4, '#263a3b', color);
      if (p.ammo === 'chain') { circle(ctx, p.x + 7, p.y - 7, 3, '#405756'); line(ctx, p.x, p.y, p.x + 7, p.y - 7, '#d6e6d1', 1); }
    }

    drawEffect(e) {
      const ctx = this.ctx, life = clamp((e.life || 0) / (e.maxLife || 1), 0, 1), size = e.size || 20;
      ctx.save(); ctx.globalAlpha = life;
      if (e.kind === 'smoke') {
        const r = size * (1.5 - life * .5);
        const gradient = ctx.createRadialGradient(e.x - r * .2, e.y - r * .2, 0, e.x, e.y, r);
        gradient.addColorStop(0, e.color || 'rgba(216,216,187,.62)'); gradient.addColorStop(.6, 'rgba(161,173,162,.23)'); gradient.addColorStop(1, 'rgba(161,173,162,0)');
        circle(ctx, e.x, e.y, r, gradient);
      } else if (e.kind === 'fire') {
        this.drawDeckFire(ctx, e.x, e.y, size, e.x);
      } else if (e.kind === 'explosion') {
        const r = size * (1.9 - life), gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        gradient.addColorStop(0, '#fff3bf'); gradient.addColorStop(.2, '#f8c46e'); gradient.addColorStop(.55, 'rgba(224,117,48,.7)'); gradient.addColorStop(1, 'rgba(214,111,43,0)');
        circle(ctx, e.x, e.y, r, gradient);
        ctx.strokeStyle = `rgba(251,224,155,${life * .6})`; ctx.lineWidth = 2;
        circle(ctx, e.x, e.y, r * 1.15, null, ctx.strokeStyle);
      } else if (e.kind === 'splash' || e.kind === 'wake') {
        ctx.strokeStyle = e.color || 'rgba(201,247,226,.8)'; ctx.lineWidth = Math.max(1, life * 3);
        ctx.beginPath(); ctx.ellipse(e.x, e.y, size * (2 - life), size * (.55 + (1 - life) * .5), .1, 0, TAU); ctx.stroke();
        if (e.kind === 'splash') for (let i = 0; i < 5; i++) {
          const a = i / 5 * TAU + hash(e.x, e.y) * 3, r = size * (1.2 - life * .5);
          circle(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r - (1 - life) * size * 1.2, 2.5 * life, '#e1f6dd');
        }
      } else if (e.kind === 'text') {
        ctx.translate(e.x, e.y); ctx.scale(1 / this.zoom, 1 / this.zoom);
        ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.shadowColor = '#132d30'; ctx.shadowBlur = 5;
        ctx.fillStyle = e.color || '#efcf83'; ctx.fillText(e.text || '', 0, 0);
      } else if (e.kind === 'slash') {
        ctx.strokeStyle = e.color || '#f7e9b9'; ctx.lineWidth = 4 * life;
        ctx.beginPath(); ctx.arc(e.x, e.y, size, -.8, 1.7); ctx.stroke();
      } else {
        circle(ctx, e.x, e.y, size * life, e.color || '#ffe5a1');
      }
      ctx.restore();
    }

    drawWeather(S) {
      const weather = typeof S.weather === 'string' ? S.weather : S.weather?.kind;
      const ctx = this.ctx, t = this.time;
      if (weather === 'haunted' || this.biome === 'haunted') {
        for (let n = 0; n < 5; n++) {
          const x = ((n * .261 + t * .003) % 1) * this.width, y = (hash(n, 39) * .85 + .08) * this.height;
          ctx.save(); ctx.translate(x, y); ctx.scale(1.8, .23);
          const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width * .23);
          fog.addColorStop(0, 'rgba(151,183,146,.055)'); fog.addColorStop(1, 'rgba(151,183,146,0)');
          circle(ctx, 0, 0, this.width * .23, fog); ctx.restore();
        }
        for (let i = 0; i < 9; i++) {
          const x = (hash(i, 91) * this.width + Math.sin(t * .13 + i) * 24 + this.width) % this.width;
          const y = (hash(i, 71) * this.height - t * (3 + i % 3) + this.height * 100) % this.height;
          const alpha = .06 + Math.sin(t * .9 + i) * .04;
          ctx.fillStyle = `rgba(177,239,177,${alpha})`; ctx.beginPath(); ctx.ellipse(x, y, 2.2, 5, Math.sin(t + i) * .2, 0, TAU); ctx.fill();
          line(ctx, x, y + 2, x + Math.sin(t + i) * 4, y + 12, `rgba(138,211,155,${alpha * .5})`, 1.3);
        }
      }
      if (weather === 'snow' || this.biome === 'ice') {
        ctx.fillStyle = 'rgba(196,228,236,.035)'; ctx.fillRect(0, 0, this.width, this.height);
        for (let i = 0; i < 65; i++) {
          const x = (hash(i, 89) * this.width + t * (7 + hash(i, 20) * 15) + Math.sin(t * .4 + i) * 16) % this.width;
          const y = (hash(i, 13) * this.height + t * (12 + hash(i, 25) * 24)) % this.height;
          circle(ctx, x, y, .6 + hash(i, 45) * 1.1, `rgba(225,246,242,${.2 + hash(i, 76) * .32})`);
        }
      }
      if (weather !== 'rain' && weather !== 'storm') return;
      const storm = weather === 'storm';
      ctx.fillStyle = storm ? 'rgba(18,27,42,.14)' : 'rgba(29,55,65,.06)'; ctx.fillRect(0, 0, this.width, this.height);
      ctx.lineWidth = 1; ctx.strokeStyle = storm ? 'rgba(187,214,217,.19)' : 'rgba(204,231,226,.12)';
      ctx.beginPath();
      for (let i = 0, n = storm ? 130 : 60; i < n; i++) {
        const x = (hash(i, 1) * (this.width + 150) - t * 115 * (1 + hash(i, 9)) % (this.width + 150) + this.width + 150) % (this.width + 150) - 50;
        const y = (hash(i, 3) * this.height + t * 410 * (1 + hash(i, 4))) % (this.height + 40) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 22);
      }
      ctx.stroke();
      if (storm && Math.sin(t * .23 + 6) > .998 && Math.sin(t * 36) > .3) { ctx.fillStyle = 'rgba(203,228,231,.10)'; ctx.fillRect(0, 0, this.width, this.height); }
    }

    drawTargetBearing(S) {
      const target = S.target, p = S.player;
      if (!target || !p || target.hp <= 0 || S.mode === 'title') return;
      const camera = S.camera, w = this.width, h = this.height;
      const tx = (target.x - camera.x) * this.zoom + w / 2, ty = (target.y - camera.y) * this.zoom + h / 2;
      if (tx >= 20 && tx <= w - 20 && ty >= 25 && ty <= h - 25) return;
      const cx = w / 2, cy = h / 2, dx = tx - cx, dy = ty - cy;
      const top = w < 650 ? 105 : 125, bottom = w < 650 ? h - 160 : h - 100;
      const horizontal = (w / 2 - 48) / Math.max(1, Math.abs(dx));
      const vertical = (dy < 0 ? cy - top : bottom - cy) / Math.max(1, Math.abs(dy));
      const ratio = Math.max(.05, Math.min(horizontal, vertical)), x = cx + dx * ratio, y = cy + dy * ratio;
      const angle = Math.atan2(dy, dx), distance = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
      const ctx = this.ctx;
      ctx.save(); ctx.translate(x, y);
      circle(ctx, 0, 0, 18, 'rgba(8,30,35,.87)', 'rgba(218,178,112,.55)');
      ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fillStyle = '#ebc781'; ctx.fill(); ctx.restore();
      const inwardX = -Math.cos(angle), inwardY = -Math.sin(angle), labelX = inwardX * 32, labelY = inwardY * 28;
      ctx.textAlign = Math.abs(inwardX) > .35 ? inwardX > 0 ? 'left' : 'right' : 'center';
      ctx.shadowColor = '#0b2932'; ctx.shadowBlur = 5; ctx.fillStyle = '#efd59e'; ctx.font = '600 11px system-ui';
      let name = target.name || 'Selected enemy'; if (name.length > 27) name = name.slice(0, 25) + '…';
      ctx.fillText(name, labelX, labelY - 3);
      ctx.fillStyle = '#b7cbbc'; ctx.font = '9px system-ui'; ctx.fillText(`${distance.toLocaleString()} m · ${distance > (p.range || 1320) ? 'OUT OF RANGE' : 'TURN TO BROADSIDE'}`, labelX, labelY + 11);
      ctx.restore();
    }

    drawCompass(S) {
      const ctx = this.ctx, x = this.width - 38, y = this.height - 45, r = 22;
      if (this.width < 650) return;
      ctx.save(); ctx.translate(x, y);
      circle(ctx, 0, 0, r + 5, 'rgba(7,29,38,.57)', 'rgba(225,205,154,.28)');
      circle(ctx, 0, 0, r - 1, null, 'rgba(225,205,154,.22)');
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU;
        line(ctx, Math.cos(a) * (i % 4 ? 18 : 15), Math.sin(a) * (i % 4 ? 18 : 15), Math.cos(a) * 21, Math.sin(a) * 21, 'rgba(220,201,154,.44)', 1);
      }
      ctx.font = '600 9px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#e4d09a'; ctx.fillText('N', 0, -32);
      ctx.rotate((S.player?.a || 0) + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, 7); ctx.lineTo(0, 4); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fillStyle = '#dec385'; ctx.fill();
      circle(ctx, 0, 0, 2, '#f4e9be'); ctx.restore();
    }

    drawChart(canvas, S, full = true) {
      const width = canvas.clientWidth || (full ? 900 : 220), height = canvas.clientHeight || (full ? 650 : 185);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
      const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = S.w || 52000, H = S.h || 44000, sx = width / W, sy = height / H;
      const x = n => n * sx, y = n => n * sy;
      const bg = ctx.createLinearGradient(0, 0, width, height); bg.addColorStop(0, '#173e49'); bg.addColorStop(1, '#0e2c38');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      // Quiet chart grid and southern waters make navigation readable at both sizes.
      ctx.fillStyle = 'rgba(127,92,83,.09)'; ctx.fillRect(0, height * .64, width, height * .36);
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 2000) line(ctx, x(gx), 0, x(gx), height, 'rgba(139,183,172,.09)', 1);
      for (let gy = 0; gy <= H; gy += 2000) line(ctx, 0, y(gy), width, y(gy), 'rgba(139,183,172,.09)', 1);
      if (full) {
        ctx.font = '10px Georgia'; ctx.textAlign = 'center';
        for (const region of S.regions || []) {
          ctx.save(); ctx.globalAlpha = .40; ctx.fillStyle = region.color || '#a9bfa9';
          const name = (region.name || '').toUpperCase();
          ctx.fillText(name, x(region.cx), y(region.cy)); ctx.restore();
        }
      }
      // Map has exactly world-to-canvas scaling; interface click coordinates match.
      for (const island of S.islands || []) {
        if (!island.discovered) continue;
        const cx = x(island.x), cy = y(island.y), rx = island.r * sx, ry = island.r * sy;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
        const rnd = seeded(island.seed || island.id * 71), points = [];
        for (let i = 0; i < 23; i++) { const a = i / 23 * TAU, r = .85 + rnd() * .17; points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
        coastPath(ctx, points, 1.24); ctx.fillStyle = '#2b6d6b'; ctx.fill();
        coastPath(ctx, points); ctx.fillStyle = island.type === 'haunted' ? '#879b79' : /ice|frozen/.test(island.type) ? '#dae9e0' : '#bfbb8a'; ctx.fill();
        coastPath(ctx, points, .80); ctx.fillStyle = island.type === 'haunted' ? '#3e6552' : /ice|frozen/.test(island.type) ? '#afcfcf' : island.type === 'volcanic' ? '#59685b' : '#6e946f'; ctx.fill(); ctx.restore();
        if (island.port) {
          const px = x(island.x + island.r + 180), py = y(island.y), size = full ? 5 : 3;
          ctx.fillStyle = '#e7cd8a'; ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillRect(-size, -size, size * 2, size * 2); ctx.restore();
        }
        if (full) {
          ctx.font = island.port ? '600 10px system-ui' : '10px Georgia'; ctx.textAlign = 'center';
          ctx.shadowColor = '#10313a'; ctx.shadowBlur = 4; ctx.fillStyle = island.port ? '#ead7a2' : '#adc7ad';
          ctx.fillText(island.name || '', cx, cy + ry + 13); ctx.shadowBlur = 0;
        }
      }
      const player = S.player;
      const quest = S.quests?.[S.questIndex || 0];
      if (quest && Number.isFinite(quest.targetX) && Number.isFinite(quest.targetY)) {
        const qx = x(quest.targetX), qy = y(quest.targetY), r = full ? 10 : 6;
        circle(ctx, qx, qy, r, 'rgba(217,169,89,.14)', '#d9aa61');
        line(ctx, qx, qy - r - 3, qx, qy - r + 2, '#efc679', 1.5); line(ctx, qx, qy + r - 2, qx, qy + r + 3, '#efc679', 1.5);
      }
      if (S.waypoint) {
        const wx = x(S.waypoint.x), wy = y(S.waypoint.y);
        ctx.setLineDash([4, 5]); line(ctx, x(player.x), y(player.y), wx, wy, 'rgba(232,210,148,.5)', 1); ctx.setLineDash([]);
        circle(ctx, wx, wy, full ? 7 : 4, null, '#e8d294');
        line(ctx, wx - 3, wy, wx + 3, wy, '#f0deb3', 1); line(ctx, wx, wy - 3, wx, wy + 3, '#f0deb3', 1);
      }
      // Discovered expedition fleets receive one restrained formation mark on the chart.
      for (const fleet of S.deepFleets || []) {
        const members = (S.ships || []).filter(s => s.deepFleetId === fleet.id && s.hp > 0);
        if (!members.length) continue;
        const leader = members.find(s => s.fleetLeader || s.deepFleetLeader) || members[0];
        const fx = Number.isFinite(leader.x) ? leader.x : fleet.cx, fy = Number.isFinite(leader.y) ? leader.y : fleet.cy;
        const close = player && Math.hypot(fx - player.x, fy - player.y) <= 4000;
        if (!fleet.discovered && !close) continue;
        const px = x(fx), py = y(fy), size = full ? 5 : 3;
        ctx.save(); ctx.translate(px, py); ctx.rotate(leader.a ?? fleet.heading ?? 0);
        ctx.fillStyle = fleet.skeleton || leader.skeleton ? '#9bc8a1' : fleet.ice ? '#a8d0d2' : '#d7a273';
        for (const [ox, oy, scale] of [[4, 0, 1], [-5, -7, .65], [-5, 7, .65]]) {
          ctx.beginPath(); ctx.moveTo(ox + size * scale, oy); ctx.lineTo(ox - size * .75 * scale, oy - size * .55 * scale); ctx.lineTo(ox - size * .45 * scale, oy); ctx.lineTo(ox - size * .75 * scale, oy + size * .55 * scale); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        if (full) {
          ctx.font = '9px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#cbb996'; ctx.shadowColor = '#112f37'; ctx.shadowBlur = 4;
          ctx.fillText(fleet.name || 'Deep-water fleet', px, py + 22); ctx.shadowBlur = 0;
        }
      }
      for (const ship of S.ships || []) {
        if (ship.hp <= 0 || ship === player) continue;
        if (ship.team === 'enemy' && Math.hypot(ship.x - player.x, ship.y - player.y) > 3400) continue;
        if (ship.team === 'neutral' && Math.hypot(ship.x - player.x, ship.y - player.y) > 2400) continue;
        ctx.save(); ctx.translate(x(ship.x), y(ship.y)); ctx.rotate(ship.a);
        ctx.fillStyle = ship.team === 'ally' ? '#6bbdae' : ship.team === 'enemy' ? '#d17b65' : '#bdc7a6';
        ctx.beginPath(); ctx.moveTo(full ? 6 : 3.5, 0); ctx.lineTo(-4, -2.5); ctx.lineTo(-2.7, 0); ctx.lineTo(-4, 2.5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (player) {
        const px = x(player.x), py = y(player.y);
        circle(ctx, px, py, full ? 13 : 8, 'rgba(242,218,151,.07)', 'rgba(242,218,151,.28)');
        ctx.save(); ctx.translate(px, py); ctx.rotate(player.a);
        ctx.beginPath(); ctx.moveTo(full ? 10 : 6, 0); ctx.lineTo(full ? -7 : -4, full ? -5 : -3); ctx.lineTo(full ? -4 : -2, 0); ctx.lineTo(full ? -7 : -4, full ? 5 : 3); ctx.closePath();
        ctx.fillStyle = '#f1dba0'; ctx.fill(); ctx.strokeStyle = '#1c474c'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      if (!full && S.camera) {
        const vw = this.width / this.zoom * sx, vh = this.height / this.zoom * sy;
        ctx.strokeStyle = 'rgba(225,213,165,.3)'; ctx.lineWidth = 1;
        ctx.strokeRect(x(S.camera.x) - vw / 2, y(S.camera.y) - vh / 2, vw, vh);
      }
      if (full) {
        // Compass rose and a compact legend leave the main chart unobstructed.
        const cx = width - 37, cy = 40;
        circle(ctx, cx, cy, 21, null, 'rgba(197,205,163,.24)');
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU - Math.PI / 2, r = i % 2 ? 12 : 20;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a + .5) * 4, cy + Math.sin(a + .5) * 4); ctx.lineTo(cx, cy); ctx.closePath();
          ctx.fillStyle = i % 2 ? '#668b83' : '#c4c39b'; ctx.fill();
        }
        ctx.font = '10px Georgia'; ctx.fillStyle = '#d7d4ab'; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 26);
        const items = [['#f1dba0', 'Flagship'], ['#6bbdae', 'Fleet'], ['#d17b65', 'Hostile'], ['#e7cd8a', 'Harbor'], ['#d9aa61', 'Objective']];
        const step = Math.min(98, (width - 35) / items.length), start = Math.max(18, width / 2 - step * items.length / 2);
        rounded(ctx, start - 12, height - 32, step * items.length + 10, 25, 5); ctx.fillStyle = 'rgba(6,28,36,.78)'; ctx.fill();
        items.forEach(([color, label], i) => { const lx = start + i * step; circle(ctx, lx, height - 20, 3, color); ctx.fillStyle = '#bbcbbb'; ctx.font = '9px system-ui'; ctx.textAlign = 'left'; ctx.fillText(label, lx + 8, height - 17); });
      }
      ctx.strokeStyle = 'rgba(214,206,159,.19)'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, width - 1, height - 1);
    }
  }
  window.PirateRenderer = PirateRenderer;
})();
