/* Pirates: Crown of the Tides — standalone game engine. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const length = Math.hypot;
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const dist = (a, b) => length(a.x - b.x, a.y - b.y);
  const approach = (v, target, dt, rate) => v + (target - v) * (1 - Math.exp(-rate * dt));
  const allied = (a, b) => a === b || (['player', 'ally'].includes(a) && ['player', 'ally'].includes(b));
  const SAVE_KEY = 'pirates.crown-of-the-tides.v2';
  const BOARDING_ZONES = [
    { id: 'helm', label: 'Helm', x: -.26 },
    { id: 'guns', label: 'Gun deck', x: 0 },
    { id: 'bow', label: 'Bow', x: .26 }
  ];
  const AMMO = {
    normal: { damage: 1, name: 'Round shot' },
    fire: { damage: .82, name: 'Fire shot' },
    chain: { damage: .68, name: 'Chain shot' },
    grape: { damage: .38, name: 'Grapeshot' }
  };
  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      this.renderer = new window.PirateRenderer(this.canvas);
      this.keys = new Set();
      this.id = 1;
      this.audio = null;
      this.saveClock = 0;
      this.hudClock = 0;
      this.state = this.makeState(193771);
      this.ui = new window.PirateUI(this);
      this.ui.show('title', this.state);
      this.ui.update(this.state, true);
      this.bindInput();
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    }
    makeState(seed) {
      const world = window.PirateWorld.create(seed);
      this.enemyFleetAlerts = new Map();
      this.nextEncounterCheck = 0;
      const S = {
        w: world.w || 52000, h: world.h || 44000, seed, t: 0, mode: 'title',
        islands: world.islands, regions: world.regions || window.PirateWorld.regions,
        ships: [], projectiles: [], effects: [], loot: [], gold: 180, deepFleets: world.deepFleets || [], defeatedEncounters: [], pendingEncounters: [],
        camera: { x: world.start.x, y: world.start.y, zoom: .42, userZoom: .42, shake: 0 },
        command: 'battle', deckMode: false, captain: null,
        crewPlan: { gunners: 8, rowers: 4, repairers: 4, boarders: 7 },
        waypoint: null, target: null, grapple: null, nearPort: null, prize: null, boardingFocus: false,
        quests: window.PirateWorld.quests(world.islands), questIndex: 0, tutorialStep: 0,
        stats: { sunk: 0, captured: 0, goldEarned: 0, shots: 0, hits: 0, crewLost: 0, portsVisited: 0, playTime: 0 },
        upgrades: { speed: 0, cannons: 0, hull: 0, slot: 0 },
        ammoUnlocked: ['normal'], sound: true, weather: { kind: 'clear', intensity: .25 },
        toastQueue: [], fleetOrder: 'follow', visitedPorts: [], journal: [], reserveCrew: [], aimTimer: 0, aimAssistVisible: false, originalShipRestored: false,
        kills: {}, captures: 0, sailDistance: 0, start: world.start,
        hasSave: this.hasSave(), version: 1
      };
      this.state = S;
      const p = this.createShip('brig', 'player', world.start.x, world.start.y, 'The Wayward Crown', 1);
      p.hpMax = Math.max(p.hpMax, 1400); p.hp = p.hpMax;
      p.a = world.start.a || .15; p.anchor = true; p.throttle = 0;
      p.speed = Math.max(p.speed, 245);
      p.crew = [];
      this.addCrew(p, 24, true);
      S.player = p;
      p.upgradeLevels = { ...S.upgrades };
      S.captain = p.crew[0];
      S.captain.role = 'captain';
      S.captain.lx = -p.L * .30; S.captain.ly = 0;
      this.assignCrew();
      for (const e of world.encounters) this.spawnEncounter(e);
      const firstPort = S.islands.find(i => i.id === world.start.portId) || S.islands.find(i => i.port);
      if (firstPort) { firstPort.discovered = true; S.visitedPorts.push(firstPort.id); }
      this.setQuestWaypoint();
      this.updateReadiness();
      return S;
    }
    spawnEncounter(e) {
      const s = this.createShip(e.kind, e.team || 'enemy', e.x, e.y, e.name, e.level || 1);
      s.questTag = e.questTag || e.tag || null; s.group = e.group || s.id;
      s.encounterKey = e.encounterKey || 'encounter:' + (e.name || e.group || s.id);
      s.deepFleetId = e.deepFleetId || null; s.fleetLeader = !!e.fleetLeader; s.fleetSlot = e.fleetSlot || 0;
      s.fleetOffsetX = e.fleetOffsetX || 0; s.fleetOffsetY = e.fleetOffsetY || 0;
      s.skeleton = !!e.skeleton || s.kind === 'ghost';
      if (s.skeleton) { s.flagColor = '#9be6b4'; s.ammo = 'fire'; for (const c of s.crew) c.skeleton = true; }
      if (e.flagColor) s.flagColor = e.flagColor;
      if (e.a !== undefined) s.a = e.a;
      s.homeX = e.x; s.homeY = e.y;
      if (s.questTag === 'tutorial') { s.hpMax = 460; s.hp = 460; s.damage = 20; s.crew = s.crew.slice(0, 10); }
      return s;
    }
    encounterSpec(ship) {
      const spec = {};
      for (const key of ['kind', 'team', 'x', 'y', 'name', 'level', 'questTag', 'group', 'encounterKey', 'deepFleetId', 'fleetLeader', 'fleetSlot', 'fleetOffsetX', 'fleetOffsetY', 'skeleton', 'flagColor', 'a']) spec[key] = ship[key];
      return spec;
    }
    updatePendingEncounters() {
      const S = this.state;
      if (!S.pendingEncounters.length || S.t < this.nextEncounterCheck) return;
      this.nextEncounterCheck = S.t + 2;
      const owned = S.ships.filter(s => s.hp > 0 && allied(s.team, 'player'));
      let added = false;
      for (const id of new Set(S.pendingEncounters.map(e => e.deepFleetId))) {
        const formation = S.pendingEncounters.filter(e => e.deepFleetId === id);
        // Older voyages keep their safe anchorage: new armadas arrive only after
        // every owned ship has sailed well clear of the whole formation.
        if (owned.some(s => formation.some(e => dist(s, e) < 4500))) continue;
        for (const e of formation) if (!S.defeatedEncounters.includes(e.encounterKey) && !S.ships.some(s => s.encounterKey === e.encounterKey)) this.spawnEncounter(e);
        S.pendingEncounters = S.pendingEncounters.filter(e => e.deepFleetId !== id); added = true;
      }
      if (added) this.save(false);
    }
    createShip(kind, team, x, y, name, level = 1) {
      const d = window.PirateWorld.shipDef(kind);
      const S = this.state;
      const s = {
        id: this.id++, kind, team, x, y, a: (this.id * 2.13) % TAU, vx: 0, vy: 0,
        L: d.L, W: d.W, hp: d.hp, hpMax: d.hp, speed: d.speed, turn: d.turn,
        cannons: d.cannons, reload: [0, 0], reloadMax: d.reload,
        damage: d.damage, range: d.range || 1450, crewCap: d.crewCap,
        armor: d.armor ?? 1, weapon: d.weapon || 'cannon', splashRadius: d.splashRadius || 0,
        rowBonus: d.rowBonus || 13, boardParty: d.boardParty || 8, meleeDamage: d.meleeDamage || 18,
        crew: [], flash: [0, 0], gold: d.gold || Math.round(((d.goldMin || 70) + (d.goldMax || 130)) / 2),
        level, ammo: 'normal', burn: 0, slow: 0, sinking: 0, anchor: false,
        grapple: null, grappleInitiatorId: null, ramCD: 0, throttle: team === 'player' ? 0 : .7,
        name: name || d.name || ({ sloop: 'Corsair Sloop', brig: 'Scarlet Brig', galleon: 'Iron Galleon', warship: 'Royal Man-of-War', boss: 'The Dread Sovereign', merchant: 'Eastwind Merchant', ghost: 'The Restless Mariner' }[kind]),
        skeleton: !!d.skeleton || kind === 'ghost',
        flagColor: team === 'player' ? '#e3bd70' : team === 'ally' ? '#60d3c7' : team === 'neutral' ? '#f2e5c5' : '#e05e59',
        ai: { phase: (this.id * .7) % TAU, fire: 1 + (this.id % 4), board: 6, roam: this.id },
        targetId: null, homeX: x, homeY: y, alerted: false
      };
      if (team === 'enemy' && level > 1) { s.hpMax *= 1 + (level - 1) * .12; s.hp = s.hpMax; s.damage *= 1 + (level - 1) * .07; }
      S.ships.push(s);
      this.addCrew(s, team === 'player' ? 0 : Math.min(d.crewCap, kind === 'boss' ? 40 : Math.round(d.crewCap * .70)), false);
      return s;
    }
    addCrew(ship, count, captain = false) {
      for (let n = 0; n < count; n++) {
        const c = { id: this.id++, team: ship.team, hp: 100, hpMax: 100, role: n < ship.cannons * 2 ? 'gunner' : 'boarder', lx: (Math.random() - .5) * ship.L * .6, ly: (Math.random() - .5) * ship.W * .62, tx: 0, ty: 0, isCaptain: captain && n === 0, cd: 0, side: n % 2, boarding: null, skeleton: !!ship.skeleton || ship.kind === 'ghost', meleeDamage: ship.meleeDamage || 18 };
        ship.crew.push(c);
      }
      if (ship.team !== 'player') this.assignNpcCrew(ship);
    }
    assignNpcCrew(s) {
      let gun = 0;
      for (const c of s.crew) {
        if (c.team !== s.team) continue;
        if (gun < s.cannons * 2) {
          c.role = 'gunner'; c.side = gun % 2;
          c.tx = s.L * (.26 - Math.floor(gun / 2) / Math.max(1, s.cannons - 1) * .48);
          c.ty = (c.side ? 1 : -1) * s.W * .37; gun++;
        } else { c.role = 'boarder'; c.tx = -s.L * .25 + (c.id % 5) * 18; c.ty = (c.id % 3 - 1) * 20; }
      }
    }
    assignCrew() {
      const S = this.state, p = S.player || S.ships.find(s => s.team === 'player');
      if (!p) return;
      const available = p.crew.filter(c => c.hp > 0 && c.team === 'player' && !c.isCaptain && !c.boarding);
      const plan = S.crewPlan;
      let cursor = 0;
      const definitions = [['gunners', 'gunner'], ['rowers', 'rower'], ['repairers', 'repairer'], ['boarders', 'boarder']];
      for (const [key, role] of definitions) {
        let taken = 0;
        for (let n = 0; n < plan[key] && cursor < available.length; n++) {
          const c = available[cursor++]; c.role = role; c.side = n % 2;
          if (role === 'gunner') { c.tx = p.L * (.26 - Math.floor(n / 2) / Math.max(1, p.cannons - 1) * .48); c.ty = (c.side ? 1 : -1) * p.W * .37; }
          if (role === 'rower') { c.tx = p.L * (.25 - Math.floor(n / 2) * .085); c.ty = (c.side ? 1 : -1) * p.W * .28; }
          if (role === 'repairer') { c.tx = Math.sin(n * 2.4) * p.L * .23; c.ty = Math.cos(n * 2.4) * p.W * .20; }
          if (role === 'boarder') { c.tx = -p.L * .27 + (n % 4) * 20; c.ty = (Math.floor(n / 4) - .5) * 28; }
          taken++;
        }
        plan[key] = taken;
      }
      while (cursor < available.length) { const c = available[cursor++]; c.role = 'boarder'; c.tx = -p.L * .2; c.ty = (c.id % 5 - 2) * 15; plan.boarders++; }
    }
    hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; } }
    notify(message, type = 'info') { if (this.ui) this.ui.toast(message, type); }
    setMode(mode) {
      if (['help', 'crew', 'map'].includes(mode) && mode !== this.state.mode) {
        this.panelReturns ||= {}; this.panelReturns[mode] = this.state.mode;
      }
      this.state.mode = mode; this.keys.clear();
      if (mode !== 'play') this.state.boardingFocus = false;
      if (this.ui) { this.ui.show(mode, this.state); this.ui.update(this.state, true); }
    }
    action(name, payload) {
      const S = this.state, p = S.player;
      if (name === 'input') { payload.down ? this.keys.add(payload.key) : this.keys.delete(payload.key); return; }
      if (name === 'new' || name === 'restart') {
        this.unlockAudio(); this.id = 1; this.makeState(193771 + (name === 'restart' ? 0 : Math.floor(Math.random() * 200)));
        this.setMode('play'); this.save(false);
        this.notify('Welcome aboard. Hold W to set sail. A/D steer; S slows; X stops.', 'gold'); return;
      }
      if (name === 'continue') { this.unlockAudio(); this.load(); return; }
      if (name === 'toggleSound') { S.sound = !S.sound; this.unlockAudio(); this.ui.update(S, true); return; }
      if (name === 'save') { this.save(true); return; }
      if (name === 'resume' || name === 'close') { this.setMode(this.panelReturns?.[S.mode] || 'play'); return; }
      if (name === 'pause') { if (S.mode === 'play') { this.save(false); this.setMode('pause'); } else if (['pause', 'help', 'map', 'crew'].includes(S.mode)) this.action('close'); return; }
      if (name === 'help') { this.setMode('help'); return; }
      if (name === 'map' || name === 'crew') { if (S.mode === name) this.action('close'); else this.setMode(name); return; }
      if (name === 'zoomIn' || name === 'zoomOut') { S.camera.userZoom = clamp((S.camera.userZoom || .42) + (name === 'zoomIn' ? .08 : -.08), .12, .95); return; }
      if (name === 'waypoint') { S.waypoint = { x: clamp(payload.x, 250, S.w - 250), y: clamp(payload.y, 250, S.h - 250), name: payload.name || 'Charted course' }; this.notify('Course marked on the chart.'); this.ui.update(S, true); return; }
      if (name === 'clearWaypoint') { this.setQuestWaypoint(); return; }
      if (name === 'dock') { this.dock(); return; }
      if (name === 'undock') { this.setMode('play'); this.notify('Hold W to set sail. A/D steer; S slows; X stops.'); this.save(false); return; }
      if (name === 'travel') { this.travel(payload); return; }
      if (name === 'buy') { this.buy(payload); return; }
      if (name === 'takeHelm') { this.takeHelm(Number(payload)); return; }
      if (name === 'preset') { this.preset(payload); this.ui.update(S, true); return; }
      if (name === 'allocate') { this.allocate(payload); return; }
      if (name === 'fleet') { S.fleetOrder = payload; this.notify('Fleet order: ' + payload); this.ui.update(S, true); return; }
      if (name === 'ammo') {
        if (!S.ammoUnlocked.includes(payload)) { this.notify('Unlock this ammunition at an island shop.'); return; }
        p.ammo = payload; this.notify(AMMO[payload].name + ' loaded.'); this.ui.update(S, true); return;
      }
      if (name === 'prize') { this.resolvePrize(payload); return; }
      if (S.mode !== 'play' || p.hp <= 0) return;
      if (name === 'boardingFocus') {
        const open = payload === undefined ? !S.boardingFocus : payload === true || payload === 'true';
        if (open && (!S.grapple || S.grapple.hp <= 0)) { this.notify('Attach a grapple first, then plan your boarding attack.'); return; }
        if (open) this.ensureBoardingBattle(S.grapple);
        S.boardingFocus = open; this.keys.clear(); this.ui.update(S, true); return;
      }
      if (name === 'boardingZone') { this.orderBoardingZone(payload); this.ui.update(S, true); return; }
      if (name === 'boardingStance') {
        if (S.grapple?.hp > 0 && ['assault', 'guard'].includes(payload)) {
          const b = this.ensureBoardingBattle(S.grapple); b.stance = payload;
          b.message = payload === 'guard' ? 'Guard: hold your ground and reduce incoming damage.' : 'Assault: strike harder, with less protection.';
        }
        this.ui.update(S, true); return;
      }
      if (name === 'boardingAbility') { this.boardingAbility(payload); this.ui.update(S, true); return; }
      if (name === 'sail') { p.anchor = false; p.throttle = Math.max(p.throttle, .65); S.deckMode = false; this.notify('Underway. A/D steer, W faster, S slower, X stops.'); }
      if (name === 'anchor') { p.anchor = !p.anchor; if (p.anchor) p.throttle = 0; this.notify(p.anchor ? 'Anchored. Hold W whenever you are ready to sail.' : 'Anchor raised — hold W to sail.'); this.sound('bell'); }
      if (name === 'stop') { this.keys.delete('KeyW'); this.keys.delete('ArrowUp'); p.throttle = 0; p.anchor = true; this.notify('Stopped. Hold W to set sail again.'); }
      if (name === 'helm') { S.deckMode = !S.deckMode; if (!S.deckMode && S.captain) { S.captain.lx = -p.L * .30; S.captain.ly = 0; } this.notify(S.deckMode ? 'On deck: WASD to walk; Space to swing; F returns to the helm.' : 'At the helm: A/D steer, W/S sails.'); }
      if (name === 'firePort') this.fire(p, 0, true);
      if (name === 'fireStarboard') this.fire(p, 1, true);
      if (name === 'fireBoth') { if (S.deckMode) this.sabre(); else { const fired = this.fire(p, 0, true) | this.fire(p, 1, true); if (!fired) this.notify('Gunners are moving into position or reloading.'); } }
      if (name === 'grapple') this.toggleGrapple();
      if (name === 'board') this.board();
      if (name === 'recall') this.recall();
      if (name === 'capture') this.capture();
      this.ui.update(S, true);
    }
    preset(type) {
      const S = this.state, n = S.player.crew.filter(c => c.hp > 0 && c.team === 'player' && !c.isCaptain && !c.boarding).length;
      const maxG = S.player.cannons * 2;
      let gun = 0, row = 0, repair = 0;
      if (type === 'battle') { gun = Math.min(maxG, n); row = Math.min(4, Math.max(0, n - gun)); repair = Math.min(4, Math.max(0, n - gun - row)); }
      if (type === 'pursuit') { row = Math.min(10, n); gun = Math.min(maxG, Math.max(0, n - row - 2)); repair = Math.min(2, Math.max(0, n - row - gun)); }
      if (type === 'repair') { repair = Math.min(12, n); gun = Math.min(maxG, Math.max(0, n - repair)); row = Math.min(4, Math.max(0, n - repair - gun)); }
      S.command = type; S.crewPlan = { gunners: gun, rowers: row, repairers: repair, boarders: Math.max(0, n - gun - row - repair) };
      this.assignCrew(); this.notify('Crew stations: ' + type + '.');
    }
    allocate({ role, delta }) {
      const S = this.state, plan = S.crewPlan;
      if (!Object.hasOwn(plan, role) || !Number.isFinite(delta)) return;
      delta = Math.sign(delta);
      const caps = { gunners: S.player.cannons * 2, rowers: 10, repairers: 12, boarders: 99 };
      if (delta > 0 && plan[role] < caps[role]) {
        const donor = ['boarders', 'repairers', 'rowers', 'gunners'].find(r => r !== role && plan[r] > 0);
        if (!donor) return; plan[donor]--; plan[role]++;
      } else if (delta < 0 && plan[role] > 0 && role !== 'boarders') { plan[role]--; plan.boarders++; }
      S.command = 'custom'; this.assignCrew(); this.ui.update(S, true);
    }
    portInventory(port = this.state.nearPort) {
      const source = typeof port === 'string' ? this.state.islands.find(i => i.id === port && i.port) : port;
      const fallback = { tier: 1, specialty: 'Local provisions', grandPort: false, stock: { ships: ['cutter', 'galley'], items: ['repair', 'hire', 'speed', 'hull', 'cannons'] }, refitCaps: { speed: 1, hull: 1, cannons: 1, slot: 0 } };
      const stock = window.PirateWorld.portDef?.(source?.id) || fallback;
      return { ...stock, id: source?.id || 'port-tortuga', name: source?.name || 'Tortuga Anchorage', region: source?.region || 'Calm Sea', grandPort: !!(stock.grandPort || stock.grand) };
    }
    shopItems() {
      const S = this.state, p = S.player, u = S.upgrades, port = this.portInventory();
      const shipOffers = (window.PirateWorld.shipCatalog || []).filter(profile => port.stock.ships.includes(profile.kind)).map(profile => {
        const d = window.PirateWorld.shipDef(profile.kind);
        return { id: profile.kind, title: 'Commission ' + profile.name, description: profile.role + '. ' + profile.strength + ' ' + profile.weakness,
          cost: profile.cost, enabled: true, ownedCount: S.ships.filter(s => allied(s.team, 'player') && s.hp > 0 && s.kind === profile.kind).length,
          shipProfile: { ...profile, hp: d.playerHp || d.hp + 600, speed: d.speed,
            turn: d.turn, damage: d.damage, cannons: d.cannons,
            range: d.range, reload: d.reload, armor: d.armor || 1,
            crewCap: d.crewCap, weapon: d.weapon || 'cannon' } };
      });
      return [
        { id: 'repair', title: 'Careen & repair', description: 'Restore the entire hull and heal your crew.', cost: Math.max(25, Math.ceil((p.hpMax - p.hp) * .10)), enabled: p.hp < p.hpMax || p.crew.some(c => c.hp > 0 && c.hp < c.hpMax) },
        { id: 'hire', title: S.reserveCrew.length ? 'Recall a sailor from shore' : 'Recruit a sailor', description: (S.reserveCrew.length ? S.reserveCrew.length + ' crew waiting safely ashore. ' : 'One healthy sailor. ') + 'Capacity ' + p.crew.filter(c => c.hp > 0).length + '/' + p.crewCap + '.', cost: S.reserveCrew.length ? 0 : 24, enabled: p.crew.filter(c => c.hp > 0).length < p.crewCap },
        { id: 'speed', title: 'Sailmaker · tier ' + (u.speed + 1), description: '+22 sailing speed, with every rowing station useful.', cost: 110 + u.speed * 85, enabled: u.speed < 5 },
        { id: 'cannons', title: 'Foundry · tier ' + (u.cannons + 1), description: '+16% cannon damage, +100 range, faster reload.', cost: 150 + u.cannons * 120, enabled: u.cannons < 5 },
        { id: 'hull', title: 'Shipwright · tier ' + (u.hull + 1), description: '+250 maximum hull and +4 crew capacity.', cost: 160 + u.hull * 110, enabled: u.hull < 5 },
        { id: 'slot', title: 'Broadside battery', description: 'Add a cannon on each side. More gunners required.', cost: 240 + u.slot * 180, enabled: u.slot < 2 },
        ...shipOffers,
        { id: 'fire', title: 'Unlock fire shot', description: 'Incendiary shells burn enemy hulls. Permanent unlock.', cost: 100, enabled: !S.ammoUnlocked.includes('fire') },
        { id: 'chain', title: 'Unlock chain shot', description: 'Tear sails and slow a ship for boarding.', cost: 90, enabled: !S.ammoUnlocked.includes('chain') },
        { id: 'grape', title: 'Unlock grapeshot', description: 'Devastate exposed crew; preserve the prize hull.', cost: 110, enabled: !S.ammoUnlocked.includes('grape') }
      ].filter(item => item.shipProfile || port.stock.items.includes(item.id)).map(item => {
        if (Object.hasOwn(u, item.id)) {
          item.maxTier = port.refitCaps[item.id] ?? 0;
          if (u[item.id] >= item.maxTier) {
            item.enabled = false;
            item.disabledReason = u[item.id] >= (item.id === 'slot' ? 2 : 5) ? 'Fully upgraded.' : 'This port offers up to tier ' + item.maxTier + '. Visit a larger specialist shipyard for the next tier.';
          }
        }
        return item;
      });
    }
    buy(id) {
      const S = this.state, p = S.player;
      if (S.mode !== 'port' || !S.nearPort) return;
      const item = this.shopItems().find(i => i.id === id);
      if (!item || !item.enabled) { this.notify(item?.disabledReason || 'This harbor does not stock that item.'); return; }
      if (S.gold < item.cost) { this.notify('You need ' + (item.cost - S.gold) + ' more gold.'); return; }
      S.gold -= item.cost;
      if (id === 'repair') { p.hp = p.hpMax; for (const c of p.crew) if (c.hp > 0) c.hp = c.hpMax; }
      if (id === 'hire') { if (S.reserveCrew.length) { const c = S.reserveCrew.shift(); c.meleeDamage = p.meleeDamage || 18; p.crew.push(c); } else this.addCrew(p, 1); S.crewPlan.boarders++; this.assignCrew(); }
      if (id === 'speed') { S.upgrades.speed++; p.speed += 22; }
      if (id === 'cannons') { S.upgrades.cannons++; p.damage += window.PirateWorld.shipDef(p.kind).damage * .16; p.range += 100; p.reloadMax *= .94; }
      if (id === 'hull') { S.upgrades.hull++; p.hpMax += 250; p.hp += 250; p.crewCap += 4; }
      if (id === 'slot') { S.upgrades.slot++; p.cannons++; this.preset('battle'); }
      if (item.shipProfile) this.addFleetShip(id);
      p.upgradeLevels = { ...S.upgrades };
      if (AMMO[id] && id !== 'normal') { S.ammoUnlocked.push(id); p.ammo = id; }
      this.sound('coin'); this.notify(item.shipProfile ? item.shipProfile.name + ' joined your fleet and will follow your flagship.' : item.title + ' ready.', 'gold'); this.save(false); this.ui.show('port', S); this.ui.update(S, true);
    }
    addFleetShip(kind, name) {
      const S = this.state, p = S.player, d = window.PirateWorld.shipDef(kind);
      const count = S.ships.filter(s => allied(s.team, 'player') && s.hp > 0 && s.kind === kind).length + 1;
      const s = this.createShip(kind, 'ally', p.x, p.y, name || `${d.name || kind} ${count}`);
      s.hpMax = d.playerHp || d.hp + 600; s.hp = s.hpMax;
      s.upgradeLevels = { speed: 0, cannons: 0, hull: 0, slot: 0 };
      s.anchor = false; s.throttle = .7; s.flagColor = '#60d3c7';
      let placed = false;
      for (let n = 0; n < 80; n++) {
        const a = p.a + Math.PI / 2 + n * 2.3999632297, r = (p.L + s.L) * .8 + 200 + Math.floor(n / 12) * 250;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (x < s.L || x > S.w - s.L || y < s.L || y > S.h - s.L) continue;
        if (S.islands.some(i => length(x - i.x, y - i.y) < i.r + s.L * .72)) continue;
        s.x = x; s.y = y; s.a = p.a;
        if (S.ships.some(other => other !== s && other.hp > 0 && this.shipContact(s, other))) continue;
        placed = true; break;
      }
      if (!placed) { s.x = p.x + p.L + s.L + 250; s.y = p.y; }
      s.homeX = s.x; s.homeY = s.y;
      S.fleetOrder = 'follow'; this.resolveShipCollisions();
      return s;
    }
    takeHelm(id) {
      const S = this.state, old = S.player, next = S.ships.find(s => s.id === id);
      if (!next || next === old || next.hp <= 0 || !allied(next.team, 'player')) return false;
      if (S.grapple || old.crew.some(c => c.hp > 0 && c.team === 'enemy') || next.crew.some(c => c.hp > 0 && c.team === 'enemy')) { this.notify('Clear enemy boarders and cut grapple lines before changing flagships.'); return false; }
      const captain = S.captain?.hp > 0 ? S.captain : old.crew.find(c => c.hp > 0 && allied(c.team, 'player'));
      if (!captain) return false;
      old.upgradeLevels = { ...S.upgrades };
      old.crew = old.crew.filter(c => c.id !== captain.id);
      if (next.crew.filter(c => c.hp > 0).length >= next.crewCap) {
        const hand = next.crew.find(c => c.hp > 0 && !c.isCaptain && allied(c.team, 'player'));
        if (hand) { next.crew = next.crew.filter(c => c.id !== hand.id); hand.team = 'ally'; hand.isCaptain = false; old.crew.push(hand); }
      }
      old.team = 'ally'; old.flagColor = '#60d3c7'; old.anchor = false; old.throttle = .7;
      for (const c of old.crew) if (allied(c.team, 'player')) { c.team = 'ally'; c.isCaptain = false; }
      this.assignNpcCrew(old);
      next.team = 'player'; next.flagColor = '#e3bd70'; next.anchor = true; next.throttle = 0; next.vx = 0; next.vy = 0;
      for (const c of next.crew) if (allied(c.team, 'player')) { c.team = 'player'; c.isCaptain = false; }
      captain.team = 'player'; captain.isCaptain = true; captain.role = 'captain'; captain.boarding = null;
      captain.lx = -next.L * .30; captain.ly = 0; captain.meleeDamage = next.meleeDamage || 18; next.crew.push(captain);
      S.player = next; S.captain = captain; S.upgrades = { speed: 0, cannons: 0, hull: 0, slot: 0, ...next.upgradeLevels };
      next.upgradeLevels = { ...S.upgrades }; S.deckMode = false; S.enemyOnDeck = 0; S.takeover = 0; S.target = null; S.selectedTargetId = null; S.fleetOrder = 'follow';
      S.nearPort = S.islands.find(i => i.port && dist({ x: i.x + i.r + 180, y: i.y }, next) < 950) || null;
      if (!S.nearPort && this.panelReturns?.crew === 'port') this.panelReturns.crew = 'play';
      S.camera.x = next.x; S.camera.y = next.y;
      this.preset('battle'); this.updateReadiness();
      this.notify(`You now control ${next.name}. Your other ships follow.`, 'gold');
      this.save(false); this.ui.show(S.mode, S); this.ui.update(S, true);
      return true;
    }
    commissionShip(kind) {
      const S = this.state, p = S.player, d = window.PirateWorld.shipDef(kind), u = S.upgrades;
      p.kind = kind; p.L = d.L; p.W = d.W;
      p.hpMax = (d.playerHp || d.hp + 600) + u.hull * 250; p.hp = p.hpMax;
      p.cannons = d.cannons + u.slot; p.crewCap = d.crewCap + u.hull * 4;
      p.damage = d.damage * (1 + u.cannons * .16); p.range = d.range + u.cannons * 100;
      p.reloadMax = d.reload * .94 ** u.cannons; p.reload = [0, 0]; p.turn = d.turn; p.speed = d.speed + u.speed * 22;
      p.armor = d.armor ?? 1; p.weapon = d.weapon || 'cannon'; p.splashRadius = d.splashRadius || 0;
      p.rowBonus = d.rowBonus || 13; p.boardParty = d.boardParty || 8; p.meleeDamage = d.meleeDamage || 18;
      p.burn = 0; p.slow = 0; p.vx = 0; p.vy = 0; p.anchor = true; p.throttle = 0;
      const alive = p.crew.filter(c => c.hp > 0 && c.team === 'player');
      const captain = alive.find(c => c.isCaptain);
      const hands = alive.filter(c => !c.isCaptain);
      p.crew = [captain, ...hands.slice(0, Math.max(0, p.crewCap - 1))].filter(Boolean);
      S.reserveCrew.push(...hands.slice(Math.max(0, p.crewCap - 1)));
      while (p.crew.length < p.crewCap && S.reserveCrew.length) p.crew.push(S.reserveCrew.shift());
      this.addCrew(p, Math.min(8, Math.max(0, p.crewCap - p.crew.length)));
      for (const c of p.crew) { c.meleeDamage = p.meleeDamage; c.lx = clamp(c.lx, -p.L * .4, p.L * .38); c.ly = clamp(c.ly, -p.W * .4, p.W * .4); }
      if (captain) { captain.lx = -p.L * .30; captain.ly = 0; }
      S.captain = captain || S.captain; S.deckMode = false;
      this.preset('battle'); this.updateReadiness();
      this.resolveShipCollisions();
    }
    dock() {
      const S = this.state, p = S.player;
      if (S.mode === 'port') { this.action('undock'); return; }
      if (S.mode !== 'play' || !S.nearPort) { this.notify('Sail to a harbor beacon, then press H to dock.'); return; }
      if (S.ships.some(s => s.team === 'enemy' && s.hp > 0 && dist(s, p) < 1350)) { this.notify('Drive off nearby enemies before docking.'); return; }
      if (S.grapple) { this.notify('Cut the grapple before docking.'); return; }
      p.anchor = true; p.throttle = 0; p.vx = 0; p.vy = 0;
      const port = S.nearPort;
      port.discovered = true;
      if (!S.visitedPorts.includes(port.id)) { S.visitedPorts.push(port.id); S.stats.portsVisited++; this.reward(45, 'New harbor discovered'); }
      this.checkQuest('port', port);
      this.sound('bell'); this.setMode('port'); this.save(false);
    }
    travel(id) {
      const S = this.state;
      if (S.mode !== 'port') return;
      const port = S.islands.find(i => i.id === id && i.port && i.discovered);
      if (!port || port.id === S.nearPort?.id) return;
      const cost = Math.round(35 + dist(S.player, port) / 350);
      if (S.gold < cost) { this.notify('Passage costs ' + cost + ' gold.'); return; }
      S.gold -= cost;
      const ox = S.player.x, oy = S.player.y;
      S.player.x = port.x + port.r + 380; S.player.y = port.y; S.player.vx = 0; S.player.vy = 0;
      for (const a of S.ships.filter(s => s.team === 'ally' && s.hp > 0)) { a.x += S.player.x - ox; a.y += S.player.y - oy; }
      S.camera.x = S.player.x; S.camera.y = S.player.y; S.nearPort = port;
      this.checkQuest('port', port); this.notify('Arrived at ' + port.name + '.'); this.save(false); this.ui.show('port', S);
    }
    stationCount(s, role, side = null) {
      return s.crew.filter(c => c.hp > 0 && !c.isCaptain && allied(c.team, s.team) && c.role === role && !c.boarding && (side === null || c.side === side) && length(c.lx - c.tx, c.ly - c.ty) < 24).length;
    }
    updateReadiness() {
      const S = this.state, p = S.player;
      const crew = p.crew.filter(c => c.hp > 0 && c.team === 'player');
      const ready = crew.filter(c => !c.boarding && (c.isCaptain || c.role === 'boarder' || c.role === 'idle' || length(c.lx - c.tx, c.ly - c.ty) < 24)).length;
      const intruders = p.crew.filter(c => c.hp > 0 && c.team === 'enemy').length;
      const canSail = p.hp > 0 && crew.some(c => c.isCaptain);
      const sailing = !p.anchor && (p.throttle > .01 || length(p.vx, p.vy) > 20);
      const status = intruders ? 'danger' : sailing ? 'sailing' : ready === crew.length ? 'ready' : 'preparing';
      const label = { danger: 'Enemy boarders aboard', sailing: 'Underway', ready: 'Crew ready to sail', preparing: 'Crew taking stations' }[status];
      const detail = intruders ? `${intruders} invaders on deck. F walks the deck; Space swings your sabre.` : sailing ? 'A/D steer · W faster · S slower · X stops' : `${ready}/${crew.length} sailors ready · Hold W to set sail`;
      S.readiness = { status, label, detail, ready, total: crew.length, canSail };
    }
    fire(ship, side, playerRequest = false) {
      const S = this.state;
      if (ship.hp <= 0 || ship.reload[side] > 0 || ship.cannons <= 0) return false;
      const available = Math.min(ship.cannons, this.stationCount(ship, 'gunner', side));
      if (!available) return false;
      let direction = ship.a + (side ? Math.PI / 2 : -Math.PI / 2);
      const target = ship.team === 'player' ? S.target : S.ships.find(s => s.id === ship.targetId);
      const mortar = ship.weapon === 'mortar';
      const velocity = mortar ? 850 : 1220;
      let shotDistance = ship.range;
      if (target && target.hp > 0 && dist(ship, target) < ship.range + 150) {
        const flight = dist(ship, target) / velocity;
        const aim = Math.atan2(target.y + target.vy * flight * .70 - ship.y, target.x + target.vx * flight * .70 - ship.x);
        if (Math.abs(angle(aim - direction)) < .56) { direction = aim; if (mortar) shotDistance = Math.min(ship.range, dist(ship, target)); }
      }
      const ammo = AMMO[ship.ammo] || AMMO.normal;
      for (let n = 0; n < available; n++) {
        const lx = ship.L * (.27 - n / Math.max(1, available - 1) * .50), ly = (side ? 1 : -1) * ship.W * .42;
        const pos = this.localWorld(ship, lx, ly);
        const a = direction + (Math.random() - .5) * .024;
        const flightTotal = shotDistance / velocity;
        S.projectiles.push({ x: pos.x, y: pos.y, px: pos.x, py: pos.y, vx: Math.cos(a) * velocity + (mortar ? 0 : ship.vx * .25), vy: Math.sin(a) * velocity + (mortar ? 0 : ship.vy * .25), life: flightTotal, dmg: ship.damage * ammo.damage, team: ship.team, from: ship.id, ammo: ship.ammo, size: mortar ? 9 : ship.kind === 'boss' ? 7 : 5, weapon: ship.weapon || 'cannon', splashRadius: ship.splashRadius || 0, flightAge: 0, flightTotal });
        this.fx('smoke', pos.x, pos.y, 5, '#d3d3c5', 16);
        this.fx('spark', pos.x, pos.y, 5, '#ffca71', 8);
      }
      ship.reload[side] = ship.reloadMax; ship.flash[side] = .22;
      if (ship.team === 'player') { S.stats.shots += available; S.camera.shake = mortar ? 6 : 4; S.aimTimer = 1.25; }
      if (dist(ship, S.player) < 2500) this.sound('cannon', .45 + available * .07);
      return true;
    }
    localWorld(s, lx, ly) { const c = Math.cos(s.a), n = Math.sin(s.a); return { x: s.x + lx * c - ly * n, y: s.y + lx * n + ly * c }; }
    boardingGap(a, b) {
      const ac = Math.cos(a.a), as = Math.sin(a.a), bc = Math.cos(b.a), bs = Math.sin(b.a);
      const dx = b.x + bc * b.L * .035 - a.x - ac * a.L * .035, dy = b.y + bs * b.L * .035 - a.y - as * a.L * .035;
      const ahx = a.L * .705 + 10, ahy = a.W * (a.kind === 'galley' ? 1.36 : .92) + 10;
      const bhx = b.L * .705 + 10, bhy = b.W * (b.kind === 'galley' ? 1.36 : .92) + 10;
      let gap = 0;
      for (const [x, y] of [[ac, as], [-as, ac], [bc, bs], [-bs, bc]]) {
        const ar = ahx * Math.abs(ac * x + as * y) + ahy * Math.abs(-as * x + ac * y);
        const br = bhx * Math.abs(bc * x + bs * y) + bhy * Math.abs(-bs * x + bc * y);
        gap = Math.max(gap, Math.abs(dx * x + dy * y) - ar - br);
      }
      return gap;
    }
    inBoardingRange(a, b, padding = 85) { return dist(a, b) <= 460 || this.boardingGap(a, b) <= padding; }
    inGrappleRange(a, b) { return dist(a, b) <= 720 || this.boardingGap(a, b) <= 280; }
    selectTarget() {
      const S = this.state, p = S.player;
      let target = S.ships.find(s => s.id === S.selectedTargetId && s.hp > 0 && !allied(s.team, p.team) && dist(s, p) < 4200);
      if (!target) {
        let best = 2700;
        for (const s of S.ships) if (s.team === 'enemy' && s.hp > 0) { const d = dist(s, p); if (d < best) { best = d; target = s; } }
      }
      S.target = target || null;
      if (S.target) S.target.dist = dist(S.target, p);
    }
    toggleGrapple() {
      const S = this.state, p = S.player;
      if (S.grapple) { const stranded = S.grapple.crew.filter(c => c.hp > 0 && allied(c.team, 'player')).length; S.grapple.grapple = null; S.grapple.grappleInitiatorId = null; p.grapple = null; p.grappleInitiatorId = null; S.grapple = null; S.boardingFocus = false; this.notify(stranded ? 'Line cut. ' + stranded + ' boarders remain aboard—grapple again to recall them.' : 'Grapple cut.'); return; }
      const target = S.target;
      if (!target || target.hp <= 0 || !this.inGrappleRange(p, target)) { this.notify('Get closer to the selected ship, then press G to attach a grapple.'); return; }
      S.grapple = target; p.grapple = target.id; target.grapple = p.id;
      p.grappleInitiatorId = p.id; target.grappleInitiatorId = p.id;
      target.alerted = true;
      if (target.team === 'neutral') { target.team = 'enemy'; target.flagColor = '#e05e59'; for (const c of target.crew) c.team = 'enemy'; }
      this.ensureBoardingBattle(target);
      p.throttle = .15; this.notify('Grapple attached. The winch pulls automatically. Press B to send crew once alongside.'); this.sound('rope');
    }
    boardingCandidates() {
      return this.state.player.crew.filter(c => c.hp > 0 && c.team === 'player' && !c.isCaptain && !c.boarding)
        .sort((a, b) => (a.role === 'boarder' ? -1 : 1) - (b.role === 'boarder' ? -1 : 1));
    }
    boardingStatus() {
      const S = this.state, p = S.player;
      const target = S.grapple?.hp > 0 ? S.grapple : S.target?.hp > 0 ? S.target : null;
      const totalPlayer = p.crew.filter(c => c.hp > 0 && c.team === 'player').length;
      const sendable = Math.min(p.boardParty || 8, Math.max(0, this.boardingCandidates().length - 4));
      const distance = target ? dist(target, p) : Infinity;
      const gap = target ? this.boardingGap(p, target) : Infinity;
      const grappled = !!target && S.grapple === target;
      const initiatorId = grappled ? p.grappleInitiatorId ?? target.grappleInitiatorId ?? p.id : null;
      const isAttacker = grappled && initiatorId === p.id;
      const enemyDefenders = target ? target.crew.filter(c => c.hp > 0 && !allied(c.team, 'player')).length : 0;
      const ownBoardersOnTarget = target ? target.crew.filter(c => c.hp > 0 && allied(c.team, 'player') && !c.boarding).length : 0;
      const ownBoardersEnRoute = target ? target.crew.filter(c => c.hp > 0 && allied(c.team, 'player') && c.boarding).length : 0;
      const advantage = (sendable + ownBoardersOnTarget + ownBoardersEnRoute) / Math.max(1, enemyDefenders);
      const label = !target ? 'Choose a target' : !enemyDefenders ? 'Undefended' : advantage >= 1.25 ? 'Favorable' : advantage >= .85 ? 'Close fight' : 'Outnumbered';
      const canGrapple = !!target && !allied(target.team, 'player') && this.inGrappleRange(p, target) && !grappled;
      const inRange = !!target && this.inBoardingRange(p, target);
      const canSend = isAttacker && inRange && sendable > 0;
      const canRecall = grappled && this.inBoardingRange(p, target, 160) && ownBoardersOnTarget + ownBoardersEnRoute > 0;
      const surrenderReady = !!target && (target.hp <= target.hpMax * .30 || enemyDefenders === 0 || !!target.boardingCombat?.surrendered) && target.questTag !== 'admiral';
      const canCapture = grappled && inRange && surrenderReady;
      const stage = !target || (!grappled && !canGrapple) ? 'approach' : !grappled ? 'grapple' : !inRange ? 'haul' : canCapture ? 'claim' : ownBoardersOnTarget + ownBoardersEnRoute > 0 ? 'fighting' : 'board';
      const summary = !target ? 'Select a ship to compare its crew.' : stage === 'approach' ? 'Sail closer until Grapple becomes available.' : stage === 'grapple' ? 'Attach the line. The winch then pulls both ships close automatically.' : stage === 'haul' ? 'Winch pulling. Send crew when the boarding button lights up; S slows your ship.' : stage === 'claim' ? 'The ship will surrender. Claim it with C.' : ownBoardersEnRoute > 0 ? ownBoardersEnRoute + ' sailors are crossing the lines.' : stage === 'fighting' ? 'Your boarders are fighting. Reinforce with B or recall with N.' : 'Send ' + sendable + ' boarders against ' + enemyDefenders + ' defenders. Four hands stay aboard.';
      return { target, totalPlayer, sendable, enemyDefenders, ownBoardersOnTarget, ownBoardersEnRoute, distance, gap, inRange, grappled, initiatorId, isAttacker, canGrapple, canSend, canRecall, canCapture, surrenderReady, advantage, label, stage, summary, pullProgress: inRange ? 1 : clamp(1 - gap / 280, 0, 1) };
    }
    board() {
      const S = this.state, p = S.player, target = S.grapple;
      if (!target || target.hp <= 0 || !this.inBoardingRange(p, target)) { this.notify(target ? 'The winch is pulling the ships closer. Send crew when the boarding button lights up.' : 'Grapple the target first with G. The winch pulls it into boarding range.'); return; }
      if (!this.boardingStatus().isAttacker) { this.notify('The grappling side sends the boarding party. Defenders stay on their own deck.'); return; }
      const available = this.boardingCandidates();
      const n = Math.min(p.boardParty || 8, Math.max(0, available.length - 4));
      if (!n) { this.notify('Keep at least four sailors aboard before sending boarders.'); return; }
      const b = this.ensureBoardingBattle(target);
      for (const c of available.slice(0, n)) {
        this.transferCrew(c, p, target);
        const zone = BOARDING_ZONES.find(z => z.id === b.landing);
        c.lx = zone.x * target.L + ((c.id % 4) - 1.5) * Math.min(15, target.L * .025);
        c.ly = ((c.id % 3) - 1) * target.W * .26; c.tx = c.lx; c.ty = c.ly;
      }
      S.boardingFocus = true; this.keys.clear();
      b.message = n + ' sailors crossing at the ' + BOARDING_ZONES.find(z => z.id === b.landing).label.toLowerCase() + '. Choose a deck objective and lead them.';
      this.assignCrew(); this.notify(n + ' boarders away! Command your party or N to recall survivors.'); this.sound('bell');
    }
    ensureBoardingBattle(target) {
      if (!target.boardingCombat) target.boardingCombat = { version: 1, zone: 'guns', landing: 'guns', stance: 'assault', morale: 100, control: { helm: 0, guns: 0, bow: 0 }, cooldowns: { volley: 0, rally: 0, brace: 0 }, rushIn: 14, braceTimer: 0, rallyTimer: 0, stagger: 0, lastDefenders: target.crew.filter(c => c.hp > 0 && !allied(c.team, 'player')).length, surrendered: false, message: 'Choose a landing point, then send your boarding party. Hold two deck objectives and break enemy resolve.' };
      return target.boardingCombat;
    }
    boardingZoneOf(c, ship) { return c.lx < -ship.L * .13 ? 'helm' : c.lx > ship.L * .13 ? 'bow' : 'guns'; }
    boardingBattleStatus() {
      const status = this.boardingStatus(), target = status.target, b = target?.boardingCombat;
      const party = target ? target.crew.filter(c => c.hp > 0 && allied(c.team, 'player') && !c.boarding) : [];
      const defenders = target ? target.crew.filter(c => c.hp > 0 && !allied(c.team, 'player') && !c.boarding) : [];
      const zone = b?.zone || 'guns', cooldowns = { volley: 0, rally: 0, brace: 0, ...b?.cooldowns };
      const zones = BOARDING_ZONES.map(z => ({ ...z, control: b?.control[z.id] || 0, own: party.filter(c => this.boardingZoneOf(c, target) === z.id).length, enemies: defenders.filter(c => this.boardingZoneOf(c, target) === z.id).length }));
      const active = status.grappled && !!target && !allied(target.team, 'player');
      const canAct = active && this.state.mode === 'play' && party.length > 0 && defenders.length > 0 && !b?.surrendered;
      return { ...status, active, battle: b || null, zones, zone, stance: b?.stance || 'assault', morale: b?.morale ?? 100, controlled: zones.filter(z => z.control >= .98).length, rushIn: b?.rushIn ?? 14, message: b?.message || 'Attach a grapple to plan a boarding attack.', cooldowns,
        canVolley: canAct && cooldowns.volley <= 0 && zones.some(z => z.id === zone && z.own > 0 && z.enemies > 0),
        canRally: canAct && cooldowns.rally <= 0, canBrace: canAct && cooldowns.brace <= 0 };
    }
    orderBoardingZone(id) {
      const S = this.state, target = S.grapple;
      if (!target || target.hp <= 0 || !BOARDING_ZONES.some(z => z.id === id)) return;
      const b = this.ensureBoardingBattle(target); b.zone = id;
      if (!target.crew.some(c => c.hp > 0 && allied(c.team, 'player'))) b.landing = id;
      b.message = (target.crew.some(c => c.hp > 0 && allied(c.team, 'player')) ? 'Party ordered to the ' : 'Landing point: ') + BOARDING_ZONES.find(z => z.id === id).label.toLowerCase() + '.';
    }
    boardingAbility(kind) {
      const S = this.state, view = this.boardingBattleStatus(), ship = view.target, b = view.battle;
      if (S.mode !== 'play' || !b || !view.active || !['volley', 'rally', 'brace'].includes(kind)) return false;
      if (!view[{ volley: 'canVolley', rally: 'canRally', brace: 'canBrace' }[kind]]) return false;
      const party = ship.crew.filter(c => c.hp > 0 && allied(c.team, 'player') && !c.boarding);
      const foes = ship.crew.filter(c => c.hp > 0 && !allied(c.team, 'player') && !c.boarding);
      if (kind === 'volley') {
        const targets = foes.filter(c => this.boardingZoneOf(c, ship) === b.zone).sort((a, c) => a.hp - c.hp).slice(0, Math.min(3, party.length));
        for (const c of targets) { c.hp = Math.max(0, c.hp - 40); const pos = this.localWorld(ship, c.lx, c.ly); this.fx('spark', pos.x, pos.y, 3, '#ffd18a', 12); }
        b.cooldowns.volley = 12; b.message = 'Pistol volley! ' + targets.length + ' defenders hit in the ' + BOARDING_ZONES.find(z => z.id === b.zone).label.toLowerCase() + '.'; this.sound('hit', .6);
      }
      if (kind === 'rally') {
        for (const c of party) c.hp = Math.min(c.hpMax, c.hp + 12);
        b.rallyTimer = 6; b.cooldowns.rally = 18; b.message = 'Rallied: wounded boarders recover 12 health and fight harder for six seconds.'; this.sound('bell', .5);
      }
      if (kind === 'brace') {
        b.braceTimer = 2; b.cooldowns.brace = 8;
        if (b.rushIn <= 2.5) { b.rushIn = 12; b.stagger = 2.5; b.morale = Math.max(0, b.morale - 10); b.message = 'Rush countered! Defenders stagger and lose resolve.'; this.sound('hit', .7); }
        else b.message = 'Braced for two seconds. Time your next brace just before an enemy rush.';
      }
      b.lastAbility = { kind, zone: b.zone, t: S.t };
      return true;
    }
    updateBoardingBattle(ship, dt) {
      const b = ship.boardingCombat;
      if (!b || ship.hp <= 0 || allied(ship.team, 'player')) return;
      for (const key of ['volley', 'rally', 'brace']) b.cooldowns[key] = Math.max(0, b.cooldowns[key] - dt);
      for (const key of ['braceTimer', 'rallyTimer', 'stagger']) b[key] = Math.max(0, b[key] - dt);
      const party = ship.crew.filter(c => c.hp > 0 && allied(c.team, 'player') && !c.boarding);
      const foes = ship.crew.filter(c => c.hp > 0 && !allied(c.team, 'player') && !c.boarding);
      const losses = Math.max(0, b.lastDefenders - foes.length); b.lastDefenders = foes.length;
      b.morale = Math.max(0, b.morale - losses * 7);
      if (b.surrendered) return;
      let controlled = 0;
      for (const zone of BOARDING_ZONES) {
        const own = party.filter(c => this.boardingZoneOf(c, ship) === zone.id).reduce((n, c) => n + (.35 + .65 * c.hp / c.hpMax), 0);
        const enemy = foes.filter(c => this.boardingZoneOf(c, ship) === zone.id).reduce((n, c) => n + (.35 + .65 * c.hp / c.hpMax), 0);
        const pressure = own - enemy * .85;
        if (own > 0 && pressure > 0) b.control[zone.id] = Math.min(1, b.control[zone.id] + dt * pressure / (9 + ship.L / 130));
        else if (enemy > 0) b.control[zone.id] = Math.max(0, b.control[zone.id] - dt * enemy / 20);
        if (b.control[zone.id] >= .98) controlled++;
      }
      if (!party.length) { b.morale = Math.min(100, b.morale + dt * 2); return; }
      b.morale = Math.max(0, b.morale - controlled * dt * (ship.skeleton ? 2.3 : 3.2));
      if (foes.length) {
        b.rushIn = Math.max(0, b.rushIn - dt);
        if (b.rushIn <= 0) {
          const protectedParty = b.braceTimer > 0;
          for (const c of party.slice(0, 3)) {
            const before = c.hp; c.hp = Math.max(0, c.hp - 35 * (b.stance === 'guard' ? .6 : 1.15) * (protectedParty ? .25 : 1));
            if (before > 0 && c.hp <= 0 && c.team === 'player') this.state.stats.crewLost++;
          }
          b.rushIn = 12; b.lastAbility = { kind: 'rush', zone: b.zone, t: this.state.t };
          b.message = protectedParty ? 'Your brace blunted the enemy rush.' : 'Enemy rush hit your party! Watch for the next warning and brace in time.';
        }
      }
      if (controlled >= 2 && b.morale <= 0 && ship.questTag !== 'admiral') { b.surrendered = true; b.message = ship.skeleton ? 'Their cursed command is broken. Claim the ship!' : 'Their command has collapsed. The defenders surrender—claim the ship!'; this.notify(b.message, 'gold'); }
    }
    transferCrew(c, from, to, direction = 'assault') {
      if (!c || c.hp <= 0 || from === to || !from.crew.includes(c) || to.crew.some(member => member.id === c.id) || (direction === 'assault' && (c.boarding || !allied(c.team, from.team)))) return false;
      const pos = this.localWorld(from, c.lx, c.ly);
      from.crew = from.crew.filter(i => i.id !== c.id);
      c.lx = -to.L * .3 + Math.random() * 50; c.ly = (Math.random() - .5) * to.W * .55;
      c.tx = c.lx; c.ty = c.ly; c.role = 'boarder';
      c.boarding = { fromX: pos.x, fromY: pos.y, fromShipId: from.id, toShipId: to.id, direction, team: c.team, t: 0 };
      to.crew.push(c);
      return true;
    }
    recall() {
      const S = this.state, other = S.grapple, p = S.player;
      if (!other || !this.inBoardingRange(p, other, 160)) { this.notify('Keep the grapple attached and close to recall boarders.'); return; }
      const list = other.crew.filter(c => c.hp > 0 && c.team === 'player');
      for (const c of list) this.transferCrew(c, other, p, 'recall');
      S.crewPlan.boarders += list.length;
      this.notify(list.length ? list.length + ' sailors recalled.' : 'No surviving boarders to recall.');
    }
    capture() {
      const S = this.state, p = S.player, other = S.grapple;
      if (!other || other.hp <= 0 || !this.inBoardingRange(p, other)) { this.notify('Grapple a weakened ship and let the winch pull it into boarding range first.'); return; }
      const defenders = other.crew.filter(c => c.hp > 0 && !allied(c.team, p.team)).length;
      if (other.hp > other.hpMax * .30 && defenders > 0 && !other.boardingCombat?.surrendered) { this.notify('Break their resolve while holding two deck objectives, reduce hull below 30%, or defeat the defenders.'); return; }
      if (other.questTag === 'admiral') { this.notify('The admiral refuses surrender. Sink the Dread Sovereign!'); return; }
      S.prize = other; this.setMode('prize');
    }
    resolvePrize(choice) {
      const S = this.state, other = S.prize, p = S.player;
      if (S.mode !== 'prize' || !other || !['escort', 'salvage', 'recruit'].includes(choice)) return;
      this.markEncounterDefeated(other);
      const survivors = other.crew.filter(c => c.hp > 0 && c.team === 'player');
      for (const c of survivors) { this.transferCrew(c, other, p, 'rescue'); c.boarding = null; }
      const enemyCount = other.crew.filter(c => c.hp > 0).length;
      other.grapple = null; other.grappleInitiatorId = null; p.grapple = null; p.grappleInitiatorId = null; S.grapple = null;
      S.boardingFocus = false; delete other.boardingCombat;
      S.stats.captured++; S.captures++;
      this.reward(Math.max(45, other.gold), 'Prize secured'); other.gold = 0;
      if (choice === 'escort') {
        other.team = 'ally'; other.flagColor = '#5fd9c6'; other.hp = Math.max(other.hp, other.hpMax * .55);
        other.crew = []; this.addCrew(other, Math.max(other.cannons * 2 + 2, Math.min(18, enemyCount + 4)));
        other.burn = 0; other.targetId = null; other.name = 'Prize · ' + other.name;
        this.notify('Your prize joins the fleet. Surviving defenders have surrendered.', 'gold');
      } else {
        if (choice === 'salvage') this.reward(Math.round(other.hpMax * .14), 'Ship salvaged');
        if (choice === 'recruit') { const room = p.crewCap - p.crew.filter(c => c.hp > 0).length; const n = Math.min(8, Math.max(0, room)); this.addCrew(p, n); S.crewPlan.boarders += n; this.notify(n + ' sailors recruited.'); }
        other.crew = []; other.hp = 0; other.sinking = .01;
      }
      this.assignCrew(); this.checkQuest('capture', other); S.prize = null; this.setMode('play'); this.save(false);
    }
    sabre() {
      const S = this.state, c = S.captain;
      if (!c || c.hp <= 0 || c.cd > 0) return;
      const foe = S.player.crew.filter(i => i.hp > 0 && !allied(i.team, 'player')).sort((a, b) => length(a.lx - c.lx, a.ly - c.ly) - length(b.lx - c.lx, b.ly - c.ly))[0];
      c.cd = .45; const pos = this.localWorld(S.player, c.lx, c.ly); this.fx('slash', pos.x, pos.y, 1, '#fff4d1', 22);
      if (foe && length(foe.lx - c.lx, foe.ly - c.ly) < 55) { foe.hp = Math.max(0, foe.hp - 45); this.sound('hit', .4); }
    }
    damage(ship, amount, from) {
      if (ship.hp <= 0) return;
      const S = this.state;
      if (ship.team === 'neutral' && from && ['player', 'ally'].includes(from.team)) { ship.team = 'enemy'; ship.alerted = true; for (const c of ship.crew) c.team = 'enemy'; ship.flagColor = '#e05e59'; this.notify('The merchant raises the alarm!'); }
      ship.hp = Math.max(0, ship.hp - amount * (ship.armor ?? 1)); ship.alerted = true;
      if (ship === S.player) S.camera.shake = Math.min(12, S.camera.shake + 3);
      if (ship.hp === 0) {
        this.markEncounterDefeated(ship);
        ship.sinking = .01; ship.grapple = null; ship.grappleInitiatorId = null;
        if (S.grapple === ship) { S.player.grapple = null; S.player.grappleInitiatorId = null; S.grapple = null; S.boardingFocus = false; }
        this.fx('explosion', ship.x, ship.y, 16, '#ffb765', 24);
        if (ship !== S.player) {
          if (from && ['player', 'ally'].includes(from.team)) { S.stats.sunk++; if (ship.questTag) S.kills[ship.questTag] = (S.kills[ship.questTag] || 0) + 1; this.checkQuest('sink', ship); }
          S.loot.push({ x: ship.x, y: ship.y, gold: ship.gold, life: 90, kind: 'gold' }); ship.gold = 0;
          // Boarders are rescued to the flagship rather than stranded on a destroyed ship.
          for (const c of ship.crew.filter(c => c.hp > 0 && c.team === 'player')) { this.transferCrew(c, ship, S.player, 'rescue'); c.hp = Math.max(1, c.hp - 20); }
        }
        if (dist(ship, S.player) < 2700) this.sound('explosion');
      }
    }
    markEncounterDefeated(ship) {
      const keys = this.state.defeatedEncounters;
      if (ship.encounterKey && !keys.includes(ship.encounterKey)) keys.push(ship.encounterKey);
    }
    fx(kind, x, y, count = 1, color = '#fff', size = 8, text = '') {
      const S = this.state;
      if (S.effects.length > 1100 || dist({ x, y }, S.player || S.camera) > 3400) return;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, velocity = kind === 'smoke' ? 18 + Math.random() * 35 : 30 + Math.random() * 150;
        const life = kind === 'smoke' ? 1.4 + Math.random() : kind === 'text' ? 1.8 : .4 + Math.random() * .7;
        S.effects.push({ kind, x, y, vx: Math.cos(a) * velocity, vy: Math.sin(a) * velocity, life, maxLife: life, color, size: size * (.6 + Math.random() * .8), text });
      }
    }
    reward(amount, label) { const S = this.state; S.gold += amount; S.stats.goldEarned += amount; this.notify(label + ' · +' + amount + ' gold', 'gold'); this.sound('coin'); }
    setQuestWaypoint() {
      const S = this.state, q = S.quests[S.questIndex];
      S.waypoint = q ? { x: q.targetX, y: q.targetY, name: q.title, quest: true } : null;
    }
    checkQuest(event, object) {
      const S = this.state;
      // Completion is evaluated repeatedly so an admiral defeated early still counts.
      for (let pass = 0; pass < S.quests.length; pass++) {
        const q = S.quests[S.questIndex]; if (!q) return;
        let complete = false;
        if (q.kind === 'sail') complete = dist(S.player, { x: q.targetX, y: q.targetY }) < (q.targetRadius || 500);
        if (q.kind === 'sink') complete = q.targetTag ? (S.kills[q.targetTag] || 0) >= q.goal : S.stats.sunk >= q.goal;
        if (q.kind === 'port') complete = S.visitedPorts.includes(q.portId) || (event === 'port' && object?.id === q.portId);
        if (q.kind === 'capture') complete = S.captures >= q.goal;
        if (q.kind === 'boss') complete = (S.kills[q.targetTag || 'admiral'] || 0) >= q.goal;
        q.progress = complete ? q.goal : q.kind === 'capture' ? Math.min(S.captures, q.goal) : q.kind === 'sink' ? Math.min(S.kills[q.targetTag] || 0, q.goal) : 0;
        if (!complete) return;
        q.progress = q.goal; S.journal.push(q.title); S.questIndex++;
        this.reward(q.reward, 'Contract complete: ' + q.title); this.setQuestWaypoint();
        if (S.questIndex === S.quests.length) { this.save(false); this.setMode('win'); return; }
      }
    }
    bindInput() {
      const map = { Escape: 'pause', KeyM: 'map', Tab: 'crew', KeyF: 'helm', KeyR: 'anchor', KeyX: 'stop', KeyH: 'dock', KeyG: 'grapple', KeyB: 'board', KeyN: 'recall', KeyC: 'capture', KeyQ: 'firePort', KeyE: 'fireStarboard', Space: 'fireBoth', Equal: 'zoomIn', Minus: 'zoomOut' };
      window.addEventListener('keydown', e => {
        if (/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)) return;
        if (e.target?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
        if (this.state.mode === 'play' && this.state.boardingFocus) {
          const commands = { Escape: ['boardingFocus', false], Digit1: ['boardingZone', 'helm'], Digit2: ['boardingZone', 'guns'], Digit3: ['boardingZone', 'bow'], KeyZ: ['boardingStance', 'assault'], KeyX: ['boardingStance', 'guard'], KeyQ: ['boardingAbility', 'volley'], KeyE: ['boardingAbility', 'rally'], Space: ['boardingAbility', 'brace'], KeyB: ['board'], KeyN: ['recall'], KeyC: ['capture'], KeyG: ['grapple'] };
          if (commands[e.code]) { e.preventDefault(); if (!e.repeat) this.action(...commands[e.code]); }
          return;
        }
        if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code);
        if (map[e.code]) this.action(map[e.code]);
        if (e.code === 'Digit1') this.action('preset', 'battle');
        if (e.code === 'Digit2') this.action('preset', 'pursuit');
        if (e.code === 'Digit3') this.action('preset', 'repair');
      });
      window.addEventListener('keyup', e => this.keys.delete(e.code));
      window.addEventListener('blur', () => { this.keys.clear(); if (this.state.mode === 'play') this.action('pause'); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); if (this.state.mode === 'play') this.action('pause'); } });
      window.addEventListener('pagehide', () => this.save(false));
      window.addEventListener('resize', () => this.renderer.resize());
      this.canvas.addEventListener('wheel', e => { e.preventDefault(); const c = this.state.camera; c.userZoom = clamp((c.userZoom || .42) - Math.sign(e.deltaY) * .06, .12, .95); }, { passive: false });
      this.canvas.addEventListener('pointerdown', e => {
        if (this.state.mode !== 'play') return;
        this.unlockAudio();
        const rect = this.canvas.getBoundingClientRect(), S = this.state;
        const world = { x: (e.clientX - rect.left - rect.width / 2) / S.camera.zoom + S.camera.x, y: (e.clientY - rect.top - rect.height / 2) / S.camera.zoom + S.camera.y };
        let best = null, d = 250;
        for (const s of S.ships) if (s.hp > 0 && !allied(s.team, 'player')) { const n = dist(s, world); if (n < d) { best = s; d = n; } }
        if (best) { S.selectedTargetId = best.id; this.selectTarget(); this.ui.update(S, true); }
      });
    }
    updateCrew(s, dt) {
      const S = this.state;
      const active = s.crew.filter(c => c.hp > 0);
      const battle = s.boardingCombat;
      for (const c of active) {
        if (c.hp <= 0) continue;
        c.cd = Math.max(0, (c.cd || 0) - dt);
        if (c.boarding) { c.boarding.t += dt; if (c.boarding.t >= .9) c.boarding = null; else continue; }
        if (battle?.surrendered) continue;
        const boarder = !!battle && allied(c.team, 'player') && !allied(s.team, 'player');
        const defender = !!battle && !allied(c.team, 'player');
        if (defender && battle.stagger > 0) continue;
        const foes = active.filter(f => f !== c && f.hp > 0 && !f.boarding && !allied(f.team, c.team));
        let tx = c.tx, ty = c.ty;
        let orderX = 0, orderY = 0;
        if (boarder) {
          const zone = BOARDING_ZONES.find(z => z.id === battle.zone) || BOARDING_ZONES[1];
          orderX = zone.x * s.L + ((c.id % 4) - 1.5) * Math.min(15, s.L * .025);
          orderY = ((c.id % 3) - 1) * Math.min(20, s.W * .18);
          tx = orderX; ty = orderY;
        }
        if (foes.length) {
          const f = foes.reduce((a, b) => length(a.lx - c.lx, a.ly - c.ly) < length(b.lx - c.lx, b.ly - c.ly) ? a : b);
          const d = length(f.lx - c.lx, f.ly - c.ly);
          if (d < 32 && c.cd <= 0 && (!c.isCaptain || !S.deckMode)) {
            c.cd = c.skeleton ? .85 : .75;
            let hit = c.skeleton ? 21 : c.meleeDamage || 18;
            if (battle) hit *= .4;
            if (boarder) hit *= (battle.stance === 'guard' ? .78 : 1.3) * (battle.rallyTimer > 0 ? 1.18 : 1);
            if (defender && allied(f.team, 'player')) hit *= (battle.stance === 'guard' ? .6 : 1.15) * (battle.braceTimer > 0 ? .25 : 1);
            f.hp = Math.max(0, f.hp - hit);
            const wp = this.localWorld(s, c.lx, c.ly); this.fx('slash', wp.x, wp.y, 1, '#fff2cb', 16);
            if (f.hp <= 0 && f.team === 'player') S.stats.crewLost++;
          }
          if (!c.isCaptain && (!boarder || length(f.lx - orderX, f.ly - orderY) < (battle.stance === 'guard' ? 62 : 115))) {
            tx = battle && d < 21 ? c.lx : f.lx; ty = battle && d < 21 ? c.ly : f.ly;
          }
        }
        if (boarder) { c.tx = tx; c.ty = ty; }
        if (c.isCaptain) {
          if (!S.deckMode) { c.lx = -s.L * .30; c.ly = 0; }
          continue;
        }
        const dx = tx - c.lx, dy = ty - c.ly, d = length(dx, dy);
        const step = Math.min(d, (foes.length ? 68 : 80) * (boarder && battle.rallyTimer > 0 ? 1.15 : 1) * dt);
        if (d > 1) { c.lx += dx / d * step; c.ly += dy / d * step; }
        c.lx = clamp(c.lx, -s.L * .4, s.L * .38); c.ly = clamp(c.ly, -s.W * .40, s.W * .40);
      }
      if (battle && !battle.surrendered) this.separateBoardingCrew(s);
      if (s === S.player) {
        if (!S.captain || S.captain.hp <= 0) {
          const next = active.find(c => c.team === 'player');
          if (next) { for (const c of s.crew) c.isCaptain = false; next.isCaptain = true; next.role = 'captain'; S.captain = next; S.deckMode = false; this.assignCrew(); this.notify('Your first mate takes the helm. The voyage continues.'); }
        }
        const invaders = active.filter(c => c.team === 'enemy').length;
        S.enemyOnDeck = invaders;
        S.takeover = invaders ? clamp((S.takeover || 0) + (invaders > active.length - invaders ? .10 : -.08) * dt, 0, 1) : Math.max(0, (S.takeover || 0) - dt * .3);
        if (S.takeover >= 1) this.defeat('Your deck was overrun', 'Enemy boarders seized the helm.');
      }
    }
    separateBoardingCrew(ship) {
      const crew = ship.crew.filter(c => c.hp > 0 && !c.boarding);
      // Keep individual fighters visible instead of collapsing a whole melee
      // into one point. This uses the same deck positions as hits and objectives.
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < crew.length; i++) for (let j = i + 1; j < crew.length; j++) {
        const a = crew[i], b = crew[j], dx = b.lx - a.lx, dy = b.ly - a.ly;
        if (Math.abs(dx) >= 12 || Math.abs(dy) >= 12) continue;
        const d = length(dx, dy); if (d >= 12) continue;
        const phase = (a.id + b.id) * 2.399963, nx = d > .001 ? dx / d : Math.cos(phase), ny = d > .001 ? dy / d : Math.sin(phase), push = (12 - d) * .5;
        a.lx -= nx * push; a.ly -= ny * push; b.lx += nx * push; b.ly += ny * push;
      }
      for (const c of crew) { c.lx = clamp(c.lx, -ship.L * .4, ship.L * .38); c.ly = clamp(c.ly, -ship.W * .4, ship.W * .4); }
    }
    enemyFleetContext(ship) {
      const S = this.state;
      if (ship.team !== 'enemy' || !ship.deepFleetId) return null;
      if (this.fleetContextTime !== S.t || this.fleetContextState !== S) {
        this.fleetContextTime = S.t; this.fleetContextState = S; this.enemyFleetCache = new Map();
      }
      if (this.enemyFleetCache.has(ship.deepFleetId)) return this.enemyFleetCache.get(ship.deepFleetId);
      const members = S.ships.filter(s => s.hp > 0 && s.team === 'enemy' && s.deepFleetId === ship.deepFleetId);
      const leader = members.find(s => s.fleetLeader) || members.reduce((a, b) => a.fleetSlot < b.fleetSlot ? a : b);
      const definition = S.deepFleets.find(f => f.id === ship.deepFleetId) || { cx: leader.homeX, cy: leader.homeY, patrolRadius: 850, name: 'Deep-water fleet' };
      this.enemyFleetAlerts ||= new Map();
      let alert = this.enemyFleetAlerts.get(ship.deepFleetId), target = null, closest = 3000;
      const opponents = S.ships.filter(s => s.hp > 0 && ['player', 'ally'].includes(s.team));
      for (const opponent of opponents) for (const member of members) {
        const d = dist(member, opponent);
        if (d < closest) { closest = d; target = opponent; }
      }
      if (target) {
        alert = { targetId: target.id, lastSeen: S.t }; this.enemyFleetAlerts.set(ship.deepFleetId, alert);
      } else if (alert && S.t - alert.lastSeen < 14) {
        const previous = opponents.find(s => s.id === alert.targetId);
        if (previous && members.some(s => dist(s, previous) < 6500)) target = previous;
      }
      if (!target) this.enemyFleetAlerts.delete(ship.deepFleetId);
      if (!definition.discovered && members.some(s => dist(s, S.player) < 4200)) {
        definition.discovered = true;
        this.notify('Spotted ' + definition.name + ' · ' + members.length + ' enemy ships.');
      }
      const context = { members, leader, definition, target };
      this.enemyFleetCache.set(ship.deepFleetId, context);
      return context;
    }
    updateAI(s, dt) {
      const S = this.state, p = S.player;
      if (s.boardingCombat?.surrendered) { s.targetId = null; return 0; }
      if (s.questTag === 'tutorial' && S.questIndex === 0) { s.targetId = null; return 0; }
      const distanceToFlagship = dist(s, p);
      const returningToFleet = s.team === 'ally' && S.fleetOrder !== 'attack' && distanceToFlagship > 1450;
      const fleet = this.enemyFleetContext(s);
      const candidates = fleet ? [] : S.ships.filter(other => other !== s && other.hp > 0 && !allied(other.team, s.team) && other.team !== 'neutral' && s.team !== 'neutral' && !returningToFleet && (s.team !== 'ally' || S.fleetOrder === 'attack' || dist(other, p) < (S.fleetOrder === 'defend' ? 1500 : 2300)));
      let target = fleet?.target || null, nearest = target ? dist(s, target) : s.team === 'ally' && S.fleetOrder === 'attack' ? 4000 : 2800;
      for (const other of candidates) { const d = dist(s, other); if (d < nearest) { target = other; nearest = d; } }
      s.targetId = target?.id || null;
      let desired = s.a, throttle = .45, escortSpeed = null;
      if (s.team === 'neutral') { desired = angle(s.ai.roam + Math.sin(S.t * .018 + s.id) * .7); throttle = .45; }
      else if (target) {
        const to = Math.atan2(target.y - s.y, target.x - s.x), d = nearest;
        if (s.kind === 'merchant') { desired = to + Math.PI; throttle = 1; }
        else if ((s.skeleton || s.kind === 'galley') && s.ai.board < 3) { desired = to; throttle = d > 440 ? 1.1 : .2; }
        else if (s.kind === 'sloop' && s.ai.board < 0 && d < 550) { desired = to; throttle = .8; }
        else if (d > s.range * .80) { desired = to - .22; throttle = 1; }
        else if (d < s.range * .36) { desired = to + Math.PI * .72; throttle = .8; }
        else { desired = to - Math.PI / 2; throttle = .52; }
        const rel = angle(to - s.a), side = rel > 0 ? 1 : 0;
        const broadsideAngle = s.a + (side ? Math.PI / 2 : -Math.PI / 2);
        s.ai.fire -= dt;
        if (d < s.range && Math.abs(angle(to - broadsideAngle)) < .65 && s.ai.fire <= 0) { this.fire(s, side); s.ai.fire = .5; }
        s.ai.board -= dt;
        const canLaunchBoarders = (!s.grapple || s.grappleInitiatorId === s.id) && (!target.grapple || target.grappleInitiatorId === s.id) && !s.crew.some(c => c.hp > 0 && !allied(c.team, s.team));
        if (s.team === 'enemy' && canLaunchBoarders && (d < (s.skeleton ? 680 : 430) || this.inBoardingRange(s, target, s.skeleton ? 175 : 60)) && s.ai.board <= 0 && ['player', 'ally'].includes(target.team) && s.crew.filter(c => c.hp > 0).length > 7) {
          const crew = s.crew.filter(c => c.hp > 0 && c.team === 'enemy' && !c.boarding).slice(-(s.skeleton ? 6 : s.kind === 'galley' ? s.boardParty || 10 : 4));
          for (const c of crew) this.transferCrew(c, s, target);
          s.ai.board = s.skeleton ? 14 : 18; this.assignNpcCrew(s); this.notify(s.skeleton ? 'Skeleton raiders are climbing aboard! Defend the living.' : 'Enemy boarders! Defend the deck.');
        }
      } else if (s.team === 'ally') {
        const escorts = S.ships.filter(i => i.team === 'ally' && i.hp > 0), idx = escorts.indexOf(s);
        const rowSpacing = Math.max(800, ...escorts.map(i => i.L * 1.5 + 160));
        const behind = Math.max(650, (p.L + s.L) * .75 + 160) + Math.floor(idx / 3) * rowSpacing;
        const lateral = [-1, 1, 0][idx % 3] * Math.max(480, s.W * 3);
        const tx = p.x - Math.cos(p.a) * behind - Math.sin(p.a) * lateral;
        const ty = p.y - Math.sin(p.a) * behind + Math.cos(p.a) * lateral;
        const d = length(tx - s.x, ty - s.y), flagshipSpeed = length(p.vx, p.vy);
        desired = Math.atan2(ty - s.y, tx - s.x); throttle = clamp(d / 600, 0, 1);
        if (flagshipSpeed > 25) escortSpeed = Math.min(Math.max(s.speed * 4, flagshipSpeed * 1.55), flagshipSpeed + (d - 70) * .75);
        else escortSpeed = Math.min(s.speed * 1.3, Math.max(0, d - 45) * 1.4);
        if (d < 65 && flagshipSpeed < 25) escortSpeed = 0;
        s.fullSail = p.fullSail && !target;
      } else if (fleet) {
        const leader = fleet.leader, def = fleet.definition;
        let tx, ty;
        if (leader === s) {
          // A slow circuit keeps the battle line inside its authored deep-water patrol.
          const phase = S.t * .016 + (def.heading || 0);
          const radius = (def.patrolRadius || 1000) * .72;
          tx = def.cx + Math.cos(phase) * radius;
          ty = def.cy + Math.sin(phase) * radius;
          escortSpeed = Math.min(s.speed * .48, Math.max(0, length(tx - s.x, ty - s.y) - 60) * .5);
        } else {
          // Surviving escorts form around the next officer if the flagship falls.
          const ox = (s.fleetOffsetX || 0) - (leader.fleetOffsetX || 0);
          const oy = (s.fleetOffsetY || 0) - (leader.fleetOffsetY || 0);
          tx = leader.x + Math.cos(leader.a) * ox - Math.sin(leader.a) * oy;
          ty = leader.y + Math.sin(leader.a) * ox + Math.cos(leader.a) * oy;
          const gap = length(tx - s.x, ty - s.y);
          escortSpeed = Math.min(s.speed, Math.max(0, gap - 70) * .75 + length(leader.vx, leader.vy) * .9);
          if (gap < 95 && length(leader.vx, leader.vy) < 20) escortSpeed = 0;
        }
        desired = Math.atan2(ty - s.y, tx - s.x);
      } else {
        const roam = s.ai.roam + Math.sin(S.t * .045 + s.id) * .75;
        const homeDistance = length(s.x - s.homeX, s.y - s.homeY);
        desired = homeDistance > 2000 ? Math.atan2(s.homeY - s.y, s.homeX - s.x) : roam;
        throttle = .30;
      }
      // Steering away from solid land prevents routine harbor pile-ups.
      let avoidX = 0, avoidY = 0;
      for (const i of S.islands) { const dx = s.x - i.x, dy = s.y - i.y, d = length(dx, dy), safe = i.r + s.L * .42 + 380; if (d < safe) { const force = (safe - d) / safe; avoidX += dx / (d || 1) * force * 3; avoidY += dy / (d || 1) * force * 3; } }
      if (avoidX || avoidY) desired = Math.atan2(Math.sin(desired) + avoidY, Math.cos(desired) + avoidX);
      s.a += clamp(angle(desired - s.a), -s.turn * dt, s.turn * dt);
      const headingScale = escortSpeed === null ? 1 : clamp(Math.cos(angle(desired - s.a)), .12, 1);
      return Math.max(0, escortSpeed === null ? s.speed * throttle : escortSpeed * headingScale) * (s.slow > 0 ? .55 : 1);
    }
    update(dt) {
      const S = this.state, p = S.player;
      S.t += dt;
      if (S.mode !== 'play') return;
      if (S.boardingFocus && (!S.grapple || S.grapple.hp <= 0 || allied(S.grapple.team, 'player'))) S.boardingFocus = false;
      this.updatePendingEncounters();
      S.stats.playTime += dt;
      this.selectTarget();
      S.aimTimer = Math.max(0, (S.aimTimer || 0) - dt);
      S.aimAssistVisible = S.aimTimer > 0 && !!S.target && S.target.dist < p.range + 100;
      if (S.boardingFocus) {
        // Deck orders use their own shortcuts; the unattended helm holds course.
      } else if (S.deckMode && S.captain?.hp > 0) {
        let dx = +(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - +(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
        let dy = +(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - +(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
        const d = length(dx, dy) || 1, c = S.captain, ca = Math.cos(-p.a), sa = Math.sin(-p.a);
        c.lx = clamp(c.lx + (dx * ca - dy * sa) / d * 145 * dt, -p.L * .40, p.L * .38);
        c.ly = clamp(c.ly + (dx * sa + dy * ca) / d * 145 * dt, -p.W * .38, p.W * .38);
      } else {
        const steer = +(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - +(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
        p.a += steer * p.turn * dt * (p.anchor ? .30 : 1);
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) { p.anchor = false; p.throttle = clamp(p.throttle + dt * .7, 0, 1); }
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) { p.throttle = clamp(p.throttle - dt * 1.2, 0, 1); if (p.throttle === 0) p.anchor = true; }
        if (this.keys.has('Space')) { this.fire(p, 0); this.fire(p, 1); }
        if (this.keys.has('KeyQ')) this.fire(p, 0);
        if (this.keys.has('KeyE')) this.fire(p, 1);
      }
      let battleNear = false;
      for (const s of S.ships) if (s.team === 'enemy' && s.hp > 0 && dist(s, p) < 2600) { battleNear = true; break; }
      p.fullSail = !battleNear && !S.grapple && p.throttle > .9 && !p.anchor;
      const oldX = p.x, oldY = p.y;
      const activeFleet = S.ships.filter(s => s.hp > 0 && allied(s.team, 'player'));
      for (const s of S.ships) {
        if (s.hp <= 0) { if (s.sinking) s.sinking += dt; continue; }
        s.ramCD = Math.max(0, s.ramCD - dt);
        s.reload = s.reload.map(t => Math.max(0, t - dt)); s.flash = s.flash.map(t => Math.max(0, t - dt));
        s.slow = Math.max(0, s.slow - dt);
        if (s.burn > 0) { s.burn -= dt; this.damage(s, 7 * dt, S.ships.find(i => i.id === s.burnFrom)); if (Math.random() < dt * 6) this.fx('fire', s.x + (Math.random() - .5) * s.L * .6, s.y + (Math.random() - .5) * s.W, 1, '#ff9e48', 14); }
        let speed;
        if (s === p) {
          const rowers = this.stationCount(s, 'rower');
          speed = (s.speed + rowers * (s.rowBonus || 13)) * s.throttle * (s.slow > 0 ? .55 : 1) * (s.fullSail ? 3.5 : 1);
          const repair = this.stationCount(s, 'repairer');
          S.repairRate = S.enemyOnDeck ? 0 : repair * (battleNear ? .13 : .65);
          s.hp = Math.min(s.hpMax, s.hp + S.repairRate * dt);
        } else if (s.team !== 'ally' && activeFleet.every(owned => dist(s, owned) > 6500) && !s.crew.some(c => c.hp > 0 && allied(c.team, 'player'))) {
          // Distant vessels retain their encounters without spending per-crew simulation work.
          continue;
        } else { speed = this.updateAI(s, dt); if (s.kind === 'galley' && s.targetId) speed += Math.min(8, s.crew.filter(c => c.hp > 0 && c.team === s.team && c.role !== 'gunner').length) * 9; }
        if (s.anchor) speed = 0;
        s.vx = approach(s.vx, Math.cos(s.a) * speed, dt, s.anchor ? 4 : 1.5);
        s.vy = approach(s.vy, Math.sin(s.a) * speed, dt, s.anchor ? 4 : 1.5);
        if (s === p && S.grapple?.hp > 0) {
          const other = S.grapple, dx = other.x - p.x, dy = other.y - p.y, d = length(dx, dy) || 1;
          if (d > 350) { const pull = Math.min(360, (d - 350) * 1.6); s.vx += dx / d * pull * dt * 4; s.vy += dy / d * pull * dt * 4; other.vx -= dx / d * pull * dt * 4; other.vy -= dy / d * pull * dt * 4; }
          if (d > 1500 && this.boardingGap(p, other) > 850) { other.grapple = null; other.grappleInitiatorId = null; p.grapple = null; p.grappleInitiatorId = null; S.grapple = null; S.boardingFocus = false; this.notify('The grapple line snapped. Grapple again to recover surviving boarders.'); }
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        const edge = s.L * .6 + 120;
        s.x = clamp(s.x, edge, S.w - edge); s.y = clamp(s.y, edge, S.h - edge);
        if (s.x <= edge + 2 || s.x >= S.w - edge - 2 || s.y <= edge + 2 || s.y >= S.h - edge - 2) { s.a += dt * .8; s.vx *= .97; s.vy *= .97; }
        for (const i of S.islands) this.resolveIslandCollision(s, i);
        this.updateCrew(s, dt);
        this.updateBoardingBattle(s, dt);
        if (length(s.vx, s.vy) > 60 && Math.random() < dt * 14) { const pos = this.localWorld(s, -s.L * .48, 0); this.fx('wake', pos.x, pos.y, 1, '#c1f2e8', s.W * .45); }
      }
      this.landWarn = Math.max(0, (this.landWarn || 0) - dt);
      S.sailDistance += length(p.x - oldX, p.y - oldY);
      this.resolveShipCollisions();
      this.updateProjectiles(dt);
      for (let i = S.effects.length - 1; i >= 0; i--) { const e = S.effects[i]; e.life -= dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-dt * 1.5); e.vy *= Math.exp(-dt * 1.5); if (e.life <= 0) S.effects.splice(i, 1); }
      for (let i = S.loot.length - 1; i >= 0; i--) {
        const l = S.loot[i]; l.life -= dt; const d = dist(l, p);
        if (d < 650) { l.x += (p.x - l.x) * dt * 2.5; l.y += (p.y - l.y) * dt * 2.5; }
        if (d < 170) { this.reward(l.gold, l.kind === 'treasure' ? 'Buried treasure recovered' : 'Spoils recovered'); S.loot.splice(i, 1); }
        else if (l.life <= 0) S.loot.splice(i, 1);
      }
      S.nearPort = null;
      for (const i of S.islands) {
        const d = dist(i, p);
        if (!i.discovered && d < i.r + 1800) { i.discovered = true; if (!i.port) { this.reward(i.type === 'ruins' ? 60 : 20, 'Discovered ' + i.name); if (i.type === 'ruins') S.loot.push({ x: i.x + i.r + 140, y: i.y + 100, gold: 160, life: 120, kind: 'treasure' }); } }
        if (i.port) { const dock = { x: i.x + i.r + 180, y: i.y }; if (dist(dock, p) < 950) S.nearPort = i; }
      }
      this.updateReadiness();
      this.checkQuest('update');
      if (p.hp <= 0) this.defeat('The Crown has sunk', 'Your ship went down fighting. A new voyage awaits.');
      else if (!p.crew.some(c => c.hp > 0 && c.team === 'player')) this.defeat('No hands left aboard', 'Your crew fell in battle and the ship was taken.');
      const region = window.PirateWorld.regionFor(p.x, p.y);
      S.weather.kind = region.id === 'bone' || /bone|haunt/i.test(region.id) ? 'haunted' : /frost|ice/i.test(region.id) ? 'snow' : /storm|crimson/i.test(region.id) ? 'storm' : 'clear';
      S.weather.intensity = approach(S.weather.intensity, S.weather.kind === 'clear' ? .1 : .75, dt, .3);
      const activeTarget = S.questIndex > 0 && S.target?.hp > 0 && S.target.dist < 2300 ? S.target : null;
      const viewW = this.renderer.width || 1280, viewH = this.renderer.height || 720;
      const baseZoom = S.camera.userZoom || .42;
      const fit = activeTarget ? Math.min(baseZoom, (viewW - 170) / (Math.abs(activeTarget.x - p.x) + activeTarget.L + p.L + 380), (viewH - 240) / (Math.abs(activeTarget.y - p.y) + activeTarget.L + p.L + 380)) : Math.min(baseZoom, p.fullSail ? .34 : baseZoom, (viewW - 170) / (p.L * 2.4), (viewH - 180) / (p.L * 1.6));
      const fitFloor = p.L > 700 || activeTarget?.L > 700 ? .10 : .22;
      S.camera.zoom = approach(S.camera.zoom, clamp(fit, Math.min(baseZoom, fitFloor), baseZoom), dt, 1.8);
      S.camera.x = approach(S.camera.x, activeTarget ? p.x + (activeTarget.x - p.x) * .36 : p.x + p.vx * .20, dt, 3);
      S.camera.y = approach(S.camera.y, activeTarget ? p.y + (activeTarget.y - p.y) * .30 : p.y + p.vy * .20, dt, 3);
      S.camera.shake = Math.max(0, S.camera.shake - dt * 18);
      S.ships = S.ships.filter(s => s === p || s.hp > 0 || s.sinking < 4.5);
      this.saveClock += dt;
      if (this.saveClock >= 25) { this.saveClock = 0; this.save(false); }
    }
    shipIslandContact(s, island) {
      const radius = island.r * .90;
      const hx = s.L * .705 + 10, hy = s.W * (s.kind === 'galley' ? 1.36 : .92) + 10;
      if (dist(s, island) > radius + hx + hy) return null;
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      const dx = island.x - s.x - ca * s.L * .035, dy = island.y - s.y - sa * s.L * .035;
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      const qx = clamp(lx, -hx, hx), qy = clamp(ly, -hy, hy);
      const cx = qx - lx, cy = qy - ly, separation = length(cx, cy);
      if (separation >= radius) return null;
      let nx, ny, depth;
      if (separation > .001) { nx = cx / separation; ny = cy / separation; depth = radius - separation; }
      else if (hx - Math.abs(lx) < hy - Math.abs(ly)) { nx = lx >= 0 ? -1 : 1; ny = 0; depth = radius + hx - Math.abs(lx); }
      else { nx = 0; ny = ly >= 0 ? -1 : 1; depth = radius + hy - Math.abs(ly); }
      return { nx: nx * ca - ny * sa, ny: nx * sa + ny * ca, depth };
    }
    resolveIslandCollision(s, island) {
      const contact = this.shipIslandContact(s, island);
      if (!contact) return false;
      const { nx, ny, depth } = contact, speed = length(s.vx, s.vy);
      s.x += nx * (depth + .2); s.y += ny * (depth + .2);
      const inward = s.vx * nx + s.vy * ny;
      if (inward < 0) { s.vx -= inward * nx; s.vy -= inward * ny; }
      if (s === this.state.player && speed > 120 && !(this.landWarn > 0)) { this.notify('Shallows! Steer clear of the shoreline.'); this.landWarn = 6; }
      return true;
    }
    shipContact(a, b) {
      // Oriented envelopes include bowsprits, cloth and oars, not just hull centers.
      const ac = Math.cos(a.a), as = Math.sin(a.a), bc = Math.cos(b.a), bs = Math.sin(b.a);
      const ax = a.x + ac * a.L * .035, ay = a.y + as * a.L * .035;
      const bx = b.x + bc * b.L * .035, by = b.y + bs * b.L * .035;
      const dx = bx - ax, dy = by - ay;
      const ahx = a.L * .705 + 10, ahy = a.W * (a.kind === 'galley' ? 1.36 : .92) + 10;
      const bhx = b.L * .705 + 10, bhy = b.W * (b.kind === 'galley' ? 1.36 : .92) + 10;
      let penetration = Infinity, nx = 0, ny = 0;
      for (const [x, y] of [[ac, as], [-as, ac], [bc, bs], [-bs, bc]]) {
        const ar = ahx * Math.abs(ac * x + as * y) + ahy * Math.abs(-as * x + ac * y);
        const br = bhx * Math.abs(bc * x + bs * y) + bhy * Math.abs(-bs * x + bc * y);
        const separation = dx * x + dy * y;
        const overlap = ar + br - Math.abs(separation);
        if (overlap <= 0) return null;
        if (overlap < penetration) { penetration = overlap; const sign = separation >= 0 ? 1 : -1; nx = x * sign; ny = y * sign; }
      }
      return { depth: penetration, nx, ny };
    }
    resolveShipCollisions() {
      const S = this.state, ships = S.ships.filter(s => s.hp > 0);
      for (let pass = 0; pass < 10; pass++) {
        let deepest = 0;
        for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
          const a = ships[i], b = ships[j];
          if (Math.abs(a.x - b.x) > a.L + b.L || Math.abs(a.y - b.y) > a.L + b.L) continue;
          const contact = this.shipContact(a, b);
          if (!contact) continue;
          const { nx, ny, depth } = contact;
          deepest = Math.max(deepest, depth);
          const aMass = a.L * a.W, bMass = b.L * b.W, total = aMass + bMass;
          const aShare = bMass / total, bShare = aMass / total;
          a.x -= nx * (depth + .35) * aShare; a.y -= ny * (depth + .35) * aShare;
          b.x += nx * (depth + .35) * bShare; b.y += ny * (depth + .35) * bShare;
          const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (pass === 0 && closing > 90 && a.ramCD <= 0 && b.ramCD <= 0) {
            const severity = Math.min(150, (closing - 50) * .26);
            const friendly = allied(a.team, b.team);
            this.damage(a, severity * (friendly ? .18 : bMass / total + .3), b);
            this.damage(b, severity * (friendly ? .18 : aMass / total + .3), a);
            a.ramCD = b.ramCD = 2.5;
            this.fx('splash', (a.x + b.x) / 2, (a.y + b.y) / 2, 16, '#d8f9ed', 18);
            if (a === S.player || b === S.player) { S.camera.shake = 8; this.notify('Collision! The hull took an impact.'); this.sound('hit', .9); }
          }
          if (closing > 0) { a.vx -= nx * closing * aShare * 1.05; a.vy -= ny * closing * aShare * 1.05; b.vx += nx * closing * bShare * 1.05; b.vy += ny * closing * bShare * 1.05; }
        }
        if (deepest < .2) break;
      }
    }
    detonateMortar(b) {
      const S = this.state, source = S.ships.find(s => s.id === b.from) || { team: b.team };
      const radius = b.splashRadius || 150;
      let struck = false;
      this.fx('explosion', b.x, b.y, 20, '#ffbf75', 32);
      this.fx('smoke', b.x, b.y, 12, '#b4b0a3', 25);
      this.fx('splash', b.x, b.y, 15, '#dbf7ee', 20);
      for (const s of S.ships) {
        if (s.hp <= 0 || s.id === b.from || allied(s.team, b.team)) continue;
        const ca = Math.cos(-s.a), sa = Math.sin(-s.a), dx = b.x - s.x, dy = b.y - s.y;
        const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
        const edgeDistance = length(Math.max(0, Math.abs(lx) - s.L * .43), Math.max(0, Math.abs(ly) - s.W * .48));
        if (edgeDistance > radius) continue;
        this.damage(s, b.dmg * (1 - .6 * edgeDistance / radius), source);
        if (b.ammo === 'fire') { s.burn = Math.min(12, s.burn + 5); s.burnFrom = b.from; }
        if (b.ammo === 'chain') s.slow = 7;
        if (b.ammo === 'grape') for (const c of s.crew.filter(c => c.hp > 0 && !allied(c.team, b.team)).slice(0, 5)) { const old = c.hp; c.hp = Math.max(0, c.hp - 42); if (old > 0 && c.hp === 0 && c.team === 'player') S.stats.crewLost++; }
        struck = true;
      }
      if (struck && b.team === 'player') S.stats.hits++;
      if (dist(b, S.player) < 3000) { this.sound('explosion', .65); S.camera.shake = Math.max(S.camera.shake, 4); }
    }
    updateProjectiles(dt) {
      const S = this.state;
      for (let i = S.projectiles.length - 1; i >= 0; i--) {
        const b = S.projectiles[i]; b.px = b.x; b.py = b.y;
        const step = b.weapon === 'mortar' ? Math.min(dt, Math.max(0, b.life)) : dt;
        b.x += b.vx * step; b.y += b.vy * step; b.life -= dt; b.flightAge = (b.flightAge || 0) + dt;
        if (b.weapon === 'mortar') {
          // The shell flies over intervening hulls, then explodes at its aimed landing point.
          if (b.life <= 0) { this.detonateMortar(b); S.projectiles.splice(i, 1); }
          continue;
        }
        let hit = false;
        const source = S.ships.find(s => s.id === b.from);
        for (const s of S.ships) {
          if (s.hp <= 0 || s.id === b.from || allied(s.team, b.team)) continue;
          // Swept segment transformed into each ship's local ellipse avoids tunneling.
          const ca = Math.cos(-s.a), sa = Math.sin(-s.a);
          const dx = b.px - s.x, dy = b.py - s.y, ex = b.x - s.x, ey = b.y - s.y;
          const ax = (dx * ca - dy * sa) / (s.L * .43), ay = (dx * sa + dy * ca) / (s.W * .48);
          const bx = (ex * ca - ey * sa) / (s.L * .43), by = (ex * sa + ey * ca) / (s.W * .48);
          const vx = bx - ax, vy = by - ay, t = clamp(-(ax * vx + ay * vy) / (vx * vx + vy * vy || 1), 0, 1);
          if ((ax + vx * t) ** 2 + (ay + vy * t) ** 2 > 1) continue;
          this.damage(s, b.dmg, source); this.fx('explosion', b.x, b.y, 4, '#ffbb68', 14); this.fx('smoke', b.x, b.y, 3, '#9d9c8f', 15);
          if (b.ammo === 'fire') { s.burn = Math.min(12, s.burn + 5); s.burnFrom = b.from; }
          if (b.ammo === 'chain') s.slow = 7;
          if (b.ammo === 'grape') {
            const living = s.crew.filter(c => c.hp > 0 && !allied(c.team, b.team));
            const count = Math.min(5, living.length);
            for (let n = 0; n < count; n++) { const c = living[n]; const old = c.hp; c.hp = Math.max(0, c.hp - 42); if (old > 0 && c.hp === 0 && c.team === 'player') S.stats.crewLost++; }
          }
          if (b.team === 'player') S.stats.hits++;
          if (dist(s, S.player) < 2200) this.sound('hit', .35);
          hit = true; break;
        }
        if (!hit) for (const island of S.islands) if (dist(island, b) < island.r * .85) { hit = true; this.fx('splash', b.x, b.y, 3, '#d4eee5', 8); break; }
        if (hit || b.life <= 0) { if (!hit) this.fx('splash', b.x, b.y, 2, '#d4eee5', 10); S.projectiles.splice(i, 1); }
      }
    }
    defeat(title, description) { if (this.state.mode === 'over') return; this.state.endTitle = title; this.state.endDescription = description; this.setMode('over'); this.sound('bell'); }
    save(show = false) {
      const S = this.state;
      if (!S.player || ['title', 'over'].includes(S.mode)) return;
      try {
        S.player.upgradeLevels = { ...S.upgrades };
        const data = { version: 1, rosterVersion: 3, worldContentVersion: 4, defeatedEncounters: S.defeatedEncounters, pendingEncounters: S.pendingEncounters, deepFleets: S.deepFleets.map(f => ({ id: f.id, discovered: !!f.discovered })), fleetPurchaseVersion: 1, originalShipRestored: S.originalShipRestored, id: this.id, seed: S.seed, t: S.t, ships: S.ships.filter(s => s.hp > 0), gold: S.gold, questIndex: S.questIndex, quests: S.quests, discovered: S.islands.filter(i => i.discovered).map(i => i.id), visitedPorts: S.visitedPorts, upgrades: S.upgrades, ammoUnlocked: S.ammoUnlocked, stats: S.stats, crewPlan: S.crewPlan, reserveCrew: S.reserveCrew, command: S.command, sound: S.sound, kills: S.kills, captures: S.captures, journal: S.journal, fleetOrder: S.fleetOrder, waypoint: S.waypoint, zoom: S.camera.userZoom || .42 };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data)); S.hasSave = true;
        if (show) this.notify('Voyage saved on this device.', 'gold');
      } catch (_) { if (show) this.notify('Saving is unavailable in this browser. Keep this tab open.'); }
    }
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!data || data.version !== 1 || !Array.isArray(data.ships) || !data.ships.some(s => s.team === 'player' && s.hp > 0)) throw Error('Invalid save');
        this.id = 1; const S = this.makeState(data.seed), freshRoster = S.ships;
        for (const key of ['t', 'ships', 'gold', 'questIndex', 'visitedPorts', 'upgrades', 'ammoUnlocked', 'stats', 'crewPlan', 'reserveCrew', 'command', 'sound', 'kills', 'captures', 'journal', 'fleetOrder', 'waypoint', 'originalShipRestored', 'defeatedEncounters', 'pendingEncounters']) if (data[key] !== undefined) S[key] = data[key];
        for (const f of S.deepFleets) f.discovered = !!data.deepFleets?.find(old => old.id === f.id)?.discovered;
        const newKinds = ['cutter', 'frigate', 'ironclad', 'bombard', 'galley'];
        const encounterAliases = { 'Needlewind · Wraith Scout': 'Wraith Escort I', 'The Gilded Talon': 'Wraith Escort II', 'Chainbreaker · Boarding Galley': 'Chainbreaker', 'Nightglass · Siege Bombard': 'Nightglass' };
        if (data.rosterVersion !== 3) for (const template of freshRoster.filter(s => newKinds.includes(s.kind))) {
          const old = S.ships.find(s => s.team === 'enemy' && (s.name === template.name || s.name === encounterAliases[template.name]) && s.hp > 0 && s.kind !== template.kind);
          if (!old) continue;
          const hpRatio = old.hp / old.hpMax;
          for (const key of ['kind', 'L', 'W', 'hpMax', 'speed', 'turn', 'cannons', 'reloadMax', 'damage', 'range', 'crewCap', 'armor', 'weapon', 'splashRadius', 'rowBonus', 'boardParty', 'meleeDamage']) old[key] = template[key];
          old.hp = old.hpMax * hpRatio; this.assignNpcCrew(old);
          old.name = template.name;
          for (const c of old.crew) if (c.team === old.team) c.meleeDamage = old.meleeDamage || 18;
        }
        for (const ship of S.ships) {
          const template = freshRoster.find(s => s.name === ship.name || s.name === ship.name.replace(/^Prize · /, '') || encounterAliases[s.name] === ship.name);
          if (template) for (const key of ['encounterKey', 'deepFleetId', 'fleetLeader', 'fleetSlot', 'fleetOffsetX', 'fleetOffsetY']) ship[key] ??= template[key];
          const d = window.PirateWorld.shipDef(ship.kind);
          ship.armor ??= d.armor ?? 1; ship.weapon ||= d.weapon || 'cannon'; ship.splashRadius ??= d.splashRadius || 0;
          ship.rowBonus ??= d.rowBonus || 13; ship.boardParty ??= d.boardParty || 8; ship.meleeDamage ??= d.meleeDamage || 18;
          for (const c of ship.crew) c.meleeDamage ??= c.team === ship.team ? ship.meleeDamage : 18;
        }
        S.quests.forEach((q, i) => { q.progress = data.quests?.[i]?.progress || 0; });
        this.id = Math.max(data.id || 10000, ...S.ships.flatMap(s => [s.id + 1, ...s.crew.map(c => c.id + 1)]));
        const contentMigrated = data.worldContentVersion !== 4;
        if (contentMigrated) for (const template of freshRoster.filter(s => s.deepFleetId)) {
          if (S.defeatedEncounters.includes(template.encounterKey) || S.pendingEncounters.some(e => e.encounterKey === template.encounterKey) || S.ships.some(s => s.encounterKey === template.encounterKey || s.name === template.name || s.name === 'Prize · ' + template.name)) continue;
          S.pendingEncounters.push(this.encounterSpec(template));
        }
        S.player = S.ships.find(s => s.team === 'player'); S.captain = S.player.crew.find(c => c.isCaptain && c.hp > 0) || S.player.crew.find(c => c.hp > 0 && c.team === 'player');
        this.updatePendingEncounters();
        if (S.captain) S.captain.isCaptain = true;
        S.player.upgradeLevels ||= { ...S.upgrades }; S.upgrades = { ...S.player.upgradeLevels };
        for (const ship of S.ships) if (ship.team === 'ally') ship.upgradeLevels ||= { speed: 0, cannons: 0, hull: 0, slot: 0 };
        let restoredStarter = false;
        if (data.fleetPurchaseVersion !== 1 && S.player.kind !== 'brig' && !S.originalShipRestored) {
          // Earlier versions overwrote the starting hull on a ship purchase. Keep the
          // purchased flagship and compensate with a clearly named fresh starter brig.
          const brig = this.addFleetShip('brig', 'Restored Starter Brig');
          brig.hpMax = 1400; brig.hp = 1400; brig.speed = 245;
          if (brig.crew.length < 24) this.addCrew(brig, 24 - brig.crew.length);
          brig.restoredStarter = true; S.originalShipRestored = true; restoredStarter = true;
        }
        for (const i of S.islands) i.discovered = (data.discovered || []).includes(i.id);
        S.camera.x = S.player.x; S.camera.y = S.player.y; S.camera.zoom = data.zoom || .42; S.camera.userZoom = S.camera.zoom;
        // Restoring to a safe stopped state prevents surprise collisions on load.
        S.player.anchor = true; S.player.throttle = 0; S.player.vx = 0; S.player.vy = 0;
        for (const s of S.ships) { s.grapple = null; s.grappleInitiatorId = null; s.crew.forEach(c => c.boarding = null); }
        S.grapple = null; S.boardingFocus = false; this.assignCrew(); this.updateReadiness(); this.setMode('play');
        this.notify(restoredStarter ? 'Your purchased ship is preserved. A fresh starter brig has been restored to your fleet.' : 'Voyage restored. Hold W when you are ready to set sail.');
        if (restoredStarter || contentMigrated) this.save(false);
      } catch (_) { this.notify('No usable saved voyage yet. Start a new voyage.'); this.setMode('title'); }
    }
    unlockAudio() {
      if (this.audio) { if (this.audio.state === 'suspended') this.audio.resume().catch(() => {}); return; }
      try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) this.audio = new Audio(); } catch (_) {}
    }
    sound(type, volume = .6) {
      if (!this.state.sound || !this.audio || this.audio.state !== 'running') return;
      try {
        const a = this.audio, now = a.currentTime, gain = a.createGain(); gain.connect(a.destination);
        if (['cannon', 'explosion', 'hit', 'rope'].includes(type)) {
          const duration = type === 'cannon' ? .65 : type === 'explosion' ? 1.2 : .2;
          const buffer = a.createBuffer(1, Math.floor(a.sampleRate * duration), a.sampleRate), values = buffer.getChannelData(0);
          for (let i = 0; i < values.length; i++) values[i] = (Math.random() * 2 - 1) * Math.exp(-i / values.length * 5);
          const node = a.createBufferSource(), filter = a.createBiquadFilter(); node.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = type === 'hit' ? 1600 : 320; node.connect(filter); filter.connect(gain); gain.gain.setValueAtTime(volume * .35, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration); node.start(); node.stop(now + duration);
        } else {
          const osc = a.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(type === 'coin' ? 740 : 420, now); osc.frequency.exponentialRampToValueAtTime(type === 'coin' ? 1100 : 280, now + .22); gain.gain.setValueAtTime(.08 * volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + .5); osc.connect(gain); osc.start(); osc.stop(now + .5);
        }
      } catch (_) {}
    }
    frame(now) {
      const delta = Math.min(.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
      // Small bounded simulation steps keep cannon collisions and impacts consistent.
      let remain = delta * (this.state.boardingFocus && this.state.mode === 'play' ? .65 : 1);
      while (remain > 0) { const dt = Math.min(remain, 1 / 60); this.update(dt); remain -= dt; }
      this.renderer.render(this.state);
      this.hudClock += delta;
      if (this.hudClock >= .1) { this.ui.update(this.state); this.hudClock = 0; }
      requestAnimationFrame(t => this.frame(t));
    }
  }
  window.PiratesGame = Game;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { window.pirateGame = new Game(); });
  else window.pirateGame = new Game();
})();
