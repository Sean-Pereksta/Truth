(() => {
  'use strict';

  let bindings = [null, null];
  let lastLayout = '', lastScreen = '', lastRun = null, lastMissing = '';
  let soloUsedPad = null;
  const history = new Map();
  const controls = [[6, 'dash'], [3, 'swap'], [2, 'reload'], [0, 'interact']];

  function connectedPads() {
    try {
      return Array.from(navigator.getGamepads?.() || []).flatMap((pad, position) =>
        pad && pad.connected !== false ? [{pad, index: Number.isInteger(pad.index) ? pad.index : position, id: pad.id || ''}] : []
      );
    } catch {
      return [];
    }
  }

  function layoutOf(g) {
    const mode = g.coopLayout || g.crewMode;
    return mode === 'keyboard-pad' || mode === 'dual-pad' ? mode : 'solo';
  }

  function pilotsFor(layout) {
    if (layout === 'keyboard-pad') return [1];
    return layout === 'dual-pad' ? [0, 1] : [0];
  }

  function samePad(a, b) {
    return !!a && !!b && a.index === b.index && a.id === b.id;
  }

  function assign(pads, layout) {
    const pilots = pilotsFor(layout), assigned = [null, null];
    const used = new Set();
    // Reserve every surviving binding before filling vacancies so a remaining P2 never becomes P1.
    for (const pilot of pilots) {
      const previous = layout === lastLayout && bindings[pilot];
      const match = previous && pads.find(device => samePad(device, previous));
      if (match) { assigned[pilot] = match; used.add(match.index); }
    }
    for (const pilot of pilots) {
      if (assigned[pilot]) continue;
      const next = pads.find(device => !used.has(device.index));
      if (next) { assigned[pilot] = next; used.add(next.index); }
    }
    return assigned;
  }

  function status(g) {
    const layout = layoutOf(g), pads = connectedPads(), assigned = assign(pads, layout);
    const required = layout === 'solo' ? [] : pilotsFor(layout);
    return {required:required.length, connected:pads.length, missing:required.filter(p => !assigned[p]),
      assignments:assigned.map(device => device?.index ?? null)};
  }

  function stick(pad, start) {
    const x = pad.axes?.[start] || 0, y = pad.axes?.[start + 1] || 0;
    const length = Math.hypot(x, y), dead = .17;
    if (length <= dead) return [0, 0];
    const scale = Math.min(1, (length - dead) / (1 - dead)) / length;
    return [x * scale, y * scale];
  }

  function direction(buttons, move) {
    let x = +!!buttons[15] - +!!buttons[14], y = +!!buttons[13] - +!!buttons[12];
    if (!x && !y) {
      [x, y] = move;
      if (Math.max(Math.abs(x), Math.abs(y)) < .47) return [0, 0];
    }
    return Math.abs(x) > Math.abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)];
  }

  function sample(device, boundary, now) {
    const {pad, index, id} = device;
    let prev = history.get(index);
    const fresh = !prev || prev.id !== id;
    if (fresh) prev = {id, raw:[], held:[], blocked:new Set(), dir:'', repeatAt:0, neutral:false};
    const raw = Array.from(pad.buttons || [], b => typeof b === 'number' ? b > .5 : !!(b?.pressed || b?.value > .5));
    const move = stick(pad, 0), aim = stick(pad, 2);
    const [dx, dy] = direction(raw, move);
    const dir = dx || dy ? dx + '/' + dy : '';
    if (fresh || boundary) {
      raw.forEach((down, i) => { if (down && (fresh || prev.raw[i])) prev.blocked.add(i); });
      prev.held = [];
      if (dir && (fresh || prev.dir === dir)) prev.neutral = true;
    }
    for (const i of prev.blocked) if (!raw[i]) prev.blocked.delete(i);
    const held = raw.map((down, i) => down && !prev.blocked.has(i));
    const before = prev.held;
    if (!dir) prev.neutral = false;
    const navigate = dir && !prev.neutral && (dir !== prev.dir || now >= prev.repeatAt);
    if (navigate) prev.repeatAt = now + (dir === prev.dir ? 115 : 355);
    Object.assign(prev, {id, raw, held, dir});
    history.set(index, prev);
    return {move, aim, held, edge:i => !!held[i] && !before[i], up:i => !held[i] && !!before[i],
      nav:navigate ? [dx,dy] : null};
  }

  function adjustMenu(dx) {
    const el = document.activeElement;
    if (!dx || !el || el.disabled) return false;
    if (el.matches('input[type="range"]')) {
      if (dx > 0) el.stepUp(); else el.stepDown();
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
      return true;
    }
    if (el.matches('select')) {
      let next = el.selectedIndex + dx;
      while (el.options[next]?.disabled) next += dx;
      if (el.options[next]) {
        el.selectedIndex = next;
        el.dispatchEvent(new Event('change', {bubbles:true}));
      }
      return true;
    }
    return false;
  }

  function quiet() {
    return {moveX:0,moveY:0,aimX:0,aimY:0,fire:false,firePressed:false,fireReleased:false,active:false};
  }

  function poll(g, hooks) {
    const pads = connectedPads(), layout = layoutOf(g), screen = g.screen;
    const boundary = screen !== lastScreen || layout !== lastLayout || lastRun !== g.runId;
    const assigned = assign(pads, layout);
    const lost = [];
    for (const pilot of pilotsFor(layout)) {
      const before = bindings[pilot];
      if (before && layout === lastLayout && !pads.some(p => samePad(p, before)) &&
          (layout !== 'solo' || soloUsedPad === before.index)) lost.push(pilot);
    }
    if (layout !== lastLayout || lastRun !== g.runId || lost.length) soloUsedPad = null;
    const samples = new Map(), now = performance.now();
    for (const device of pads) samples.set(device.index, sample(device, boundary, now));
    for (const index of history.keys()) if (!samples.has(index)) history.delete(index);
    bindings = assigned; lastLayout = layout; lastScreen = screen; lastRun = g.runId;
    if (screen === 'play') {
      const missing = layout === 'solo' ? [] : pilotsFor(layout).filter(p => !assigned[p]);
      const issue = [...new Set([...lost, ...missing])];
      if (issue.length) {
        hooks.input(0, quiet()); hooks.input(1, quiet());
        const key = issue.join(',');
        if (boundary || key !== lastMissing || lost.length) hooks.disconnect(issue[0]);
        lastMissing = key;
        return;
      }
      lastMissing = '';
      const states = assigned.map(device => device && samples.get(device.index));
      for (let pilot = 0; pilot < 2; pilot++) {
        const state = states[pilot];
        if (!state) { hooks.input(pilot, quiet()); continue; }
        const [moveX, moveY] = state.move, [aimX, aimY] = state.aim;
        const active = !!(moveX || moveY || aimX || aimY || state.held.some(Boolean));
        if (active && layout === 'solo') soloUsedPad = assigned[pilot].index;
        hooks.input(pilot,{moveX,moveY,aimX,aimY,fire:!!state.held[7],
          firePressed:state.edge(7),fireReleased:state.up(7),active});
      }
      // Menu commands win this frame. Opening a menu cannot also dash, cast, or interact.
      for (let pilot = 0; pilot < 2; pilot++) {
        const s = states[pilot];
        if (s?.edge(9) || s?.edge(8)) {
          hooks.action(pilot, s.edge(9) ? 'pause' : 'inventory'); return;
        }
      }
      for (let pilot = 0; pilot < 2 && g.screen === 'play'; pilot++) {
        const s = states[pilot];
        if (!s) continue;
        for (let slot = 0; slot < 2; slot++) {
          if (s.edge(4 + slot)) hooks.ability(pilot, slot, true);
          if (s.up(4 + slot)) hooks.ability(pilot, slot, false);
        }
        for (const [button, action] of controls) if (s.edge(button) && g.screen === 'play') hooks.action(pilot, action);
      }
      return;
    }
    lastMissing = '';
    hooks.input(0, quiet()); hooks.input(1, quiet());
    // All pads may navigate. Resolve at most one shared menu command in a single frame.
    const all = [...samples.values()];
    if (all.some(s => s.edge(1))) { hooks.menuBack(); return; }
    if (all.some(s => s.edge(9))) {
      if (screen === 'home') hooks.menuAccept(); else hooks.menuBack();
      return;
    }
    if (all.some(s => s.edge(0))) { hooks.menuAccept(); return; }
    const nav = all.find(s => s.nav)?.nav;
    if (nav && !adjustMenu(nav[0])) hooks.menuMove(...nav);
  }

  window.CrewInput = {poll, count:() => connectedPads().length, status};
})();
