/* Standard-layout Xbox, PlayStation and compatible controllers; no dependencies. */
export function createMallController({
  getState = () => ({mode: 'title', settingsOpen: false}),
  onAction = () => {}, onConnection = () => {},
  document: dom = globalThis.document, navigator: nav = globalThis.navigator
} = {}) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let selectedIndex = null, connected = false, active = false, previous = [];
  let signature = '', needsNeutral = false, repeatDirection = '', repeatAge = 0;
  let focusElement = null, disposed = false;
  const eventTarget = dom?.defaultView || globalThis;
  const blank = () => ({moveX: 0, moveY: 0, lookX: 0, lookY: 0, sprint: false, connected, active});
  const pressed = button => !!(typeof button === 'number' ? button > .5 : button?.pressed || button?.value > .5);
  function stick(x = 0, y = 0, dead = .19) {
    x = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
    y = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
    const length = Math.hypot(x, y);
    if (length <= dead) return {x: 0, y: 0};
    const amount = clamp((length - dead) / (1 - dead), 0, 1);
    return {x: x / length * amount, y: y / length * amount};
  }
  function clearFocus() {
    focusElement?.classList?.remove('controller-focus');
    focusElement = null;
  }
  function markKeyboard() {active = false; clearFocus();}
  function suspend() {needsNeutral = true; previous = []; repeatDirection = ''; repeatAge = 0;}
  const onVisibility = () => {if (dom?.hidden) suspend();};
  eventTarget.addEventListener?.('blur', suspend);
  dom?.addEventListener?.('visibilitychange', onVisibility);

  function menuRoot(state) {
    const id = state.settingsOpen ? 'settingsScreen' : state.mode === 'title' ? 'title' :
      state.mode === 'paused' ? 'pause' : ['won', 'dead'].includes(state.mode) ? 'end' : '';
    return id ? dom?.getElementById?.(id) : null;
  }
  function isVisible(el) {
    if (!el || el.disabled || el.hidden || el.getAttribute?.('aria-hidden') === 'true') return false;
    if (el.closest?.('.hidden,[hidden]')) return false;
    // client rectangles also exclude controls inside closed disclosure panels.
    return !el.getClientRects || el.getClientRects().length > 0;
  }
  function controls(root) {
    return Array.from(root?.querySelectorAll?.('button,select,input:not([type="hidden"]),summary,a[href]') || []).filter(isVisible);
  }
  function focus(el) {
    if (!el) return;
    if (focusElement !== el) clearFocus();
    focusElement = el;
    el.classList?.add('controller-focus');
    try {el.focus?.({preventScroll: true});} catch {el.focus?.();}
    el.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
  }
  function changed(el) {
    const EventClass = dom?.defaultView?.Event || globalThis.Event;
    if (!EventClass) return;
    el.dispatchEvent?.(new EventClass('input', {bubbles: true}));
    el.dispatchEvent?.(new EventClass('change', {bubbles: true}));
  }
  function adjust(el, direction) {
    if (el?.tagName === 'SELECT') {
      const options = Array.from(el.options || []), enabled = options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
      const at = enabled.indexOf(el.selectedIndex), next = enabled[clamp(at + direction, 0, enabled.length - 1)];
      if (next !== undefined && next !== el.selectedIndex) {el.selectedIndex = next; changed(el);}
      return true;
    }
    if (el?.type === 'range' || el?.type === 'number') {
      const min = el.min === '' ? 0 : Number(el.min), max = el.max === '' ? 100 : Number(el.max);
      const step = Number(el.step) > 0 ? Number(el.step) : 1;
      el.value = String(Number(clamp(Number(el.value) + direction * step, min, max).toFixed(6)));
      changed(el);return true;
    }
    return false;
  }
  function navigate(state, direction, confirm) {
    const root = menuRoot(state), list = controls(root);
    if (!list.length) {clearFocus();return;}
    let el = list.includes(dom?.activeElement) ? dom.activeElement : list.includes(focusElement) ? focusElement : list[0];
    let at = list.indexOf(el);
    if (direction === 'up' || direction === 'down') {
      at = (at + (direction === 'down' ? 1 : -1) + list.length) % list.length;
      el = list[at];
    } else if (direction === 'left' || direction === 'right') {
      const step = direction === 'right' ? 1 : -1;
      if (!adjust(el, step)) el = list[(at + step + list.length) % list.length];
    }
    focus(el);
    if (confirm) {
      if (el.tagName === 'SELECT') adjust(el, 1);
      else if (el.type === 'range' || el.type === 'number') adjust(el, 1);
      else el.click?.();
    }
  }

  function update(dt = 0) {
    if (disposed) return blank();
    dt = clamp(Number(dt) || 0, 0, .1);
    let pads = [];
    try {pads = Array.from(nav?.getGamepads?.() || []).filter(p => p && p.connected !== false);} catch {}
    const pad = pads.find(p => p.index === selectedIndex) || pads.find(p => p.mapping === 'standard') || pads[0];
    if (!pad) {
      if (connected) {
        connected = false;active = false;selectedIndex = null;previous = [];needsNeutral = true;clearFocus();
        onConnection({connected: false, id: '', mapping: ''});
        if (getState().mode === 'playing') onAction('pause');
      }
      return blank();
    }
    if (!connected || selectedIndex !== pad.index) {
      if (selectedIndex !== null && selectedIndex !== pad.index) needsNeutral = true;
      connected = true;selectedIndex = pad.index;previous = [];
      onConnection({connected: true, id: pad.id || 'Controller', mapping: pad.mapping || ''});
    }
    const buttons = Array.from(pad.buttons || [], pressed);
    const left = stick(pad.axes?.[0], pad.axes?.[1]), right = stick(pad.axes?.[2], pad.axes?.[3], .16);
    const neutral = !buttons.some(Boolean) && !left.x && !left.y && !right.x && !right.y;
    const state = getState(), nextSignature = `${state.mode}/${!!state.settingsOpen}`;
    if (signature && nextSignature !== signature) {needsNeutral = true;repeatDirection = '';repeatAge = 0;clearFocus();}
    signature = nextSignature;
    if (dom?.hidden || dom?.hasFocus?.() === false) {suspend();return blank();}
    if (needsNeutral) {
      previous = buttons;
      if (neutral) needsNeutral = false;
      return blank();
    }
    if (!neutral) active = true;
    const edge = index => buttons[index] && !previous[index];
    // Save before callbacks, which may immediately change the menu or game mode.
    const edges = buttons.map((_, index) => edge(index));previous = buttons;
    if (edges[9] && (state.mode === 'playing' || state.mode === 'paused' || state.settingsOpen)) {
      onAction(state.settingsOpen ? 'back' : 'pause');return blank();
    }
    if (state.mode === 'playing' && !state.settingsOpen) {
      clearFocus();
      const actions = [[0, 'use'], [1, 'crouch'], [2, 'stun'], [3, 'light'], [8, 'map']];
      for (const [index, action] of actions) if (edges[index]) onAction(action);
      return {moveX: left.x, moveY: left.y, lookX: right.x, lookY: right.y, sprint: !!(buttons[5] || buttons[10]), connected, active};
    }
    if (state.mode === 'captured') {clearFocus();return blank();}
    if (edges[1]) {onAction('back');return blank();}
    const direction = buttons[12] || left.y < -.55 ? 'up' : buttons[13] || left.y > .55 ? 'down' :
      buttons[14] || left.x < -.55 ? 'left' : buttons[15] || left.x > .55 ? 'right' : '';
    let repeat = false;
    if (direction !== repeatDirection) {repeatDirection = direction;repeatAge = 0;repeat = !!direction;}
    else if (direction) {const before = repeatAge;repeatAge += dt;repeat = repeatAge >= .42 && Math.floor((repeatAge - .42) / .13) !== Math.floor((before - .42) / .13);}
    else repeatAge = 0;
    if (active) navigate(state, repeat ? direction : '', !!edges[0]);
    return blank();
  }
  return {update, markKeyboard, suspend,
    get connected() {return connected;}, get active() {return active;},
    dispose() {disposed = true;clearFocus();eventTarget.removeEventListener?.('blur', suspend);dom?.removeEventListener?.('visibilitychange', onVisibility);}
  };
}
