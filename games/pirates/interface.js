/* Pirates — Crown of the Tides. Accessible, dependency-free interface. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => Math.round(Number(value) || 0).toLocaleString('en-US');
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const living = ship => (ship?.crew || []).filter(member => member.hp > 0);
  const ownCrew = ship => living(ship).filter(member => !member.team || member.team === 'player');
  const duration = seconds => `${Math.floor((seconds || 0) / 60)}m ${Math.floor((seconds || 0) % 60)}s`;
  const icons = {
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
    muted: '<path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 8v13M7 10h10M3 14v3c0 2 4 4 9 4s9-2 9-4v-3M3 14l-2 3M3 14l3 2M21 14l2 3M21 14l-3 2"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
    crew: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3M12 17h.01"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
    port: '<path d="M12 3v18M7 8h10M4 21h16M6 17l6-6 6 6M8 3h8"/>',
    rope: '<path d="M8 4c-3 0-5 3-5 6s2 6 5 6h8c3 0 5-2 5-5s-2-5-5-5H9c-2 0-3 1-3 3s1 3 3 3h6M10 16v5m4-5v5"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    shrink: '<path d="M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.help}</svg>`;
  const closeButton = '<button class="icon-button" data-action="close" data-focus="close" aria-label="Close panel" title="Close · Escape">×</button>';
  const button = (label, action, payload, classes = '', disabled = false, focus = '') => `<button class="${classes}" data-action="${esc(action)}"${payload === undefined ? '' : ` data-payload="${esc(typeof payload === 'object' ? JSON.stringify(payload) : payload)}"`}${disabled ? ' disabled' : ''}${focus ? ` data-focus="${esc(focus)}"` : ''}>${label}</button>`;

  class PirateUI {
    constructor(game) {
      this.game = game;
      this.mode = null;
      this.lastTick = -Infinity;
      this.modalKey = '';
      this.titleUnderlay = false;
      this.previousFocus = null;
      this.touchKeys = new Map();
      this.chartCanvas = null;
      this.portCategory = 'shipyard';
      this.portScroll = Object.create(null);
      this.drawerOpen = false;
      this.boardingOpen = false;
      this.selectedCommission = null;
      this.lastTargetId = null;
      this.onboardingDismissed = false;
      this.refitsOpen = false;
      this.otherShipyardsOpen = false;
      this.boardingFocused = false;
      this.boardingPreviousFocus = null;
      document.querySelectorAll('[data-icon]').forEach(element => element.insertAdjacentHTML('afterbegin', icon(element.dataset.icon)));
      this.onClick = this.handleClick.bind(this);
      this.onKey = this.handleKey.bind(this);
      this.onPointerDown = this.handlePointerDown.bind(this);
      this.onPointerUp = this.handlePointerUp.bind(this);
      document.addEventListener('click', this.onClick);
      document.addEventListener('keydown', this.onKey, true);
      document.addEventListener('pointerdown', this.onPointerDown);
      document.addEventListener('pointerup', this.onPointerUp);
      document.addEventListener('pointercancel', this.onPointerUp);
      window.addEventListener('blur', () => this.releaseTouch());
      document.addEventListener('fullscreenchange', () => this.update(this.game.state, true));
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseTouch(); });
      this.update(game.state, true);
    }

    act(name, payload) {
      this.game.action(name, payload);
      // Actions are synchronous; defer UI refresh until the engine completes its action.
      queueMicrotask(() => this.update(this.game.state, true));
    }

    handleClick(event) {
      const toggle = event.target.closest('button[data-ui-toggle]');
      if (toggle) {
        if (toggle.dataset.uiToggle === 'other-shipyards') {
          this.otherShipyardsOpen = !this.otherShipyardsOpen;
          this.renderModal(this.game.state);
          $('modal-panel').querySelector('[data-ui-toggle="other-shipyards"]')?.focus({ preventScroll: true });
          return;
        }
        if (toggle.dataset.uiToggle === 'refits') {
          this.refitsOpen = !this.refitsOpen;
          this.renderModal(this.game.state);
          $('modal-panel').querySelector('[data-ui-toggle="refits"]')?.focus({ preventScroll: true });
          return;
        }
        if (toggle.dataset.uiToggle === 'advanced') this.drawerOpen = !this.drawerOpen;
        if (toggle.dataset.uiToggle === 'boarding') this.boardingOpen = !this.boardingOpen;
        this.syncOverlays(this.game.state);
        this.restoreSailingFocus(event);
        return;
      }
      const commission = event.target.closest('button[data-commission]');
      if (commission && this.game.state.mode === 'port') {
        this.selectedCommission = commission.dataset.commission;
        this.renderModal(this.game.state);
        $('modal-panel').querySelector(`[data-commission="${CSS.escape(this.selectedCommission)}"]`)?.focus({ preventScroll: true });
        return;
      }
      const category = event.target.closest('button[data-shop-tab]');
      if (category && this.game.state.mode === 'port') {
        this.portCategory = category.dataset.shopTab;
        this.renderModal(this.game.state);
        $('modal-panel').querySelector(`[data-shop-tab="${this.portCategory}"]`)?.focus({ preventScroll: true });
        return;
      }
      const control = event.target.closest('button[data-action]');
      if (control && !control.disabled) {
        if (control.dataset.action === 'fullscreen') { this.toggleFullscreen(); this.restoreSailingFocus(event); return; }
        if (['new','restart'].includes(control.dataset.action)) this.onboardingDismissed = false;
        let payload = control.dataset.payload;
        if (payload && (payload[0] === '{' || payload[0] === '[')) {
          try { payload = JSON.parse(payload); } catch { return; }
        }
        if (control.dataset.action === 'takeHelm') payload = (this.game.state.ships || []).find(ship => String(ship.id) === String(payload))?.id ?? payload;
        if (control.dataset.action === 'boardingFocus') payload = payload === 'true';
        this.act(control.dataset.action, payload);
        if (['sail','stop'].includes(control.dataset.action)) this.onboardingDismissed = true;
        this.restoreSailingFocus(event);
        return;
      }
      if (event.target.id === 'full-chart') this.setChartWaypoint(event);
      if (event.target.id === 'boarding-arena' && this.game.state.boardingFocus) {
        const rect = event.target.getBoundingClientRect();
        const fraction = clamp((event.clientX - rect.left) / Math.max(1,rect.width),0,.9999);
        this.act('boardingZone', ['helm','guns','bow'][Math.floor(fraction * 3)]);
        this.restoreSailingFocus(event);
        return;
      }
      if (!event.target.closest('#advanced-controls,#more-controls')) this.drawerOpen = false;
      if (!event.target.closest('#boarding-panel,#target-interact')) this.boardingOpen = false;
      this.syncOverlays(this.game.state);
    }

    handleKey(event) {
      const boardingDialog = !$('boarding-command').hidden;
      if (event.code === 'Escape' && boardingDialog) {
        this.act('boardingFocus', false);
        event.preventDefault(); event.stopImmediatePropagation();
        return;
      }
      if (event.code === 'Escape' && this.game.state.mode === 'play' && (this.drawerOpen || this.boardingOpen)) {
        this.drawerOpen = false; this.boardingOpen = false;
        this.syncOverlays(this.game.state);
        event.preventDefault(); event.stopImmediatePropagation();
        return;
      }
      if (event.target.matches?.('[data-shop-tab]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.code)) {
        const tabs = [...$('modal-panel').querySelectorAll('[data-shop-tab]')];
        const index = tabs.indexOf(event.target);
        const next = event.code === 'Home' ? 0 : event.code === 'End' ? tabs.length - 1 : (index + (event.code === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        tabs[next].click();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const modalOpen = !$('modal').hidden;
      const titleOpen = !$('title-screen').hidden && !modalOpen;
      const popup = this.drawerOpen ? $('advanced-controls') : this.boardingOpen ? $('boarding-panel') : null;
      if (event.code !== 'Tab' || (!modalOpen && !titleOpen && !popup && !boardingDialog)) return;
      const scope = modalOpen ? $('modal-panel') : boardingDialog ? $('boarding-command') : titleOpen ? $('title-screen') : popup;
      const controls = [...scope.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(element => element.tabIndex >= 0 && element.getClientRects().length);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement);
      const nextIndex = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index < 0 || index === controls.length - 1 ? 0 : index + 1);
      controls[nextIndex].focus();
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    restoreSailingFocus(event) {
      if (event.detail > 0 && this.game.state.mode === 'play') $(this.game.state.boardingFocus ? 'boarding-arena' : 'game').focus({ preventScroll: true });
    }

    handlePointerDown(event) {
      const control = event.target.closest('[data-input]');
      if (!control || this.game.state.mode !== 'play' || this.game.state.boardingFocus) return;
      event.preventDefault();
      control.setPointerCapture?.(event.pointerId);
      this.touchKeys.set(event.pointerId, { key: control.dataset.input, element: control });
      control.classList.add('is-pressed');
      this.game.action('input', { key: control.dataset.input, down: true });
    }

    handlePointerUp(event) {
      const pressed = this.touchKeys.get(event.pointerId);
      if (!pressed) return;
      this.touchKeys.delete(event.pointerId);
      pressed.element.classList.remove('is-pressed');
      if (![...this.touchKeys.values()].some(other => other.key === pressed.key)) this.game.action('input', { key: pressed.key, down: false });
    }

    releaseTouch() {
      for (const pressed of this.touchKeys.values()) {
        pressed.element.classList.remove('is-pressed');
        this.game.action('input', { key: pressed.key, down: false });
      }
      this.touchKeys.clear();
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (typeof document.documentElement.requestFullscreen === 'function') await document.documentElement.requestFullscreen();
        else throw new Error('Fullscreen unavailable');
        this.update(this.game.state, true);
      } catch {
        this.toast('Fullscreen is unavailable here. Open the game in a regular browser to use it.');
      }
    }

    setChartWaypoint(event) {
      const canvas = event.target;
      const rect = canvas.getBoundingClientRect();
      const S = this.game.state;
      const mapX = Number(canvas.dataset.mapX) || 0;
      const mapY = Number(canvas.dataset.mapY) || 0;
      const mapW = Number(canvas.dataset.mapW) || rect.width;
      const mapH = Number(canvas.dataset.mapH) || rect.height;
      const px = event.clientX - rect.left - mapX;
      const py = event.clientY - rect.top - mapY;
      if (px < 0 || py < 0 || px > mapW || py > mapH) return;
      const x = clamp(px / mapW * S.w, 0, S.w);
      const y = clamp(py / mapH * S.h, 0, S.h);
      const near = (S.islands || []).filter(island => island.discovered).find(island => Math.hypot(x - island.x, y - island.y) < Math.max(island.r + 300, S.w / mapW * 15));
      this.act('waypoint', { x: near ? near.x + (near.port ? near.r + 180 : 0) : x, y: near ? near.y : y, name: near?.name || 'Charted waypoint' });
    }

    toast(message, type = 'info') {
      if (!message) return;
      const element = document.createElement('div');
      element.className = `toast ${['error','success','info'].includes(type) ? type : 'info'}`;
      element.textContent = String(message);
      $('toasts').append(element);
      while ($('toasts').children.length > 4) $('toasts').firstElementChild.remove();
      setTimeout(() => { element.classList.add('leaving'); setTimeout(() => element.remove(), 220); }, type === 'error' ? 4300 : 3200);
    }

    text(id, value) {
      const node = $(id);
      if (node && node.textContent !== String(value)) node.textContent = value;
    }

    fill(id, value, color) {
      const node = $(id);
      if (!node) return;
      node.style.width = `${clamp(value, 0, 1) * 100}%`;
      if (color) node.style.background = color;
    }

    update(S, force = false) {
      if (!S) return;
      const now = performance.now();
      if (!force && now - this.lastTick < 100) return;
      this.lastTick = now;
      if (this.mode !== S.mode) this.show(S.mode, S);
      const ship = S.player;
      const sound = S.sound !== false;
      const soundButton = $('sound-button');
      soundButton.setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
      if (soundButton.dataset.state !== String(sound)) {
        soundButton.innerHTML = icon(sound ? 'sound' : 'muted');
        soundButton.dataset.state = String(sound);
      }
      this.text('title-sound', sound ? 'Sound on' : 'Sound off');
      const fullscreen = !!document.fullscreenElement;
      const fullscreenButton = $('fullscreen-button');
      fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
      fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
      fullscreenButton.title = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
      if (fullscreenButton.dataset.state !== String(fullscreen)) { fullscreenButton.innerHTML = icon(fullscreen ? 'shrink' : 'expand'); fullscreenButton.dataset.state = String(fullscreen); }
      this.text('title-fullscreen', fullscreen ? 'Exit fullscreen ↙' : 'Fullscreen ↗');
      if (S.mode === 'title') {
        let hasSave = true;
        try { if (typeof this.game.hasSave === 'function') hasSave = this.game.hasSave(); else if (S.hasSave !== undefined) hasSave = S.hasSave; } catch { hasSave = false; }
        $('continue-button').disabled = !hasSave;
      }
      if (!ship) return;
      const alive = ownCrew(ship);
      const plan = S.crewPlan || {};
      const hullRatio = ship.hp / Math.max(1, ship.hpMax);
      this.text('hull-number', `${number(Math.max(0, ship.hp))} / ${number(ship.hpMax)}`);
      this.fill('hull-fill', hullRatio, hullRatio < .28 ? 'var(--red)' : hullRatio < .55 ? 'var(--gold)' : 'var(--green)');
      this.text('gold-number', number(S.gold));
      this.text('fleet-number', this.ownedShips(S).length);
      const crewHTML = `${alive.length} <small>aboard</small>`;
      if ($('crew-number').innerHTML !== crewHTML) $('crew-number').innerHTML = crewHTML;
      this.text('speed-number', (Math.hypot(ship.vx || 0, ship.vy || 0) / 22).toFixed(1));
      const throttle = clamp(ship.throttle ?? S.throttle ?? 0, 0, 1);
      this.text('throttle-number', `${Math.round(throttle * 100)}%`);
      this.fill('throttle-fill', throttle);
      this.text('helm-mode', S.deckMode ? 'ON THE DECK' : ship.fullSail ? 'FAIR WIND · FULL SAIL' : 'AT THE HELM');
      const readiness = this.readiness(S);
      const readinessPanel = $('sail-readiness');
      if (readinessPanel) {
        readinessPanel.dataset.status = readiness.status;
        readinessPanel.hidden = !ship.anchor && !['preparing','danger'].includes(readiness.status);
        this.text('crew-readiness-label', ship.anchor ? readiness.status === 'danger' ? readiness.label : readiness.status === 'preparing' ? 'CREW GETTING READY' : 'CREW READY' : readiness.label || 'UNDERWAY');
        this.text('crew-readiness-count', `${readiness.ready} / ${readiness.total}`);
        let readinessDetail = readiness.detail || (ship.anchor ? 'Hold W to set sail. The anchor lifts automatically.' : 'Crew at work. Your next heading awaits.');
        if (ship.anchor && readiness.canSail && !/hold\s+w|set sail/i.test(readinessDetail)) readinessDetail += ' Hold W to set sail.';
        this.text('crew-readiness-detail', readinessDetail);
        readinessPanel.title = readinessDetail;
        if (throttle > .05) this.onboardingDismissed = true;
        $('first-sail-hint').hidden = this.onboardingDismissed || !ship.anchor;
        const sailButton = $('set-sail-button');
        sailButton.hidden = !ship.anchor && throttle > .05;
        sailButton.disabled = readiness.canSail === false;
        sailButton.title = readiness.canSail === false ? readiness.detail : 'Set sail now. Crew keep moving to their stations.';
      }
      this.text('anchor-label', ship.anchor ? 'Anchored' : 'Anchor');
      $('anchor-button').classList.toggle('is-active', !!ship.anchor);
      $('anchor-button').setAttribute('aria-pressed', String(!!ship.anchor));
      const helmLabel = `${S.deckMode ? 'Return to helm' : 'Walk the deck'} <kbd>F</kbd>`;
      if ($('helm-toggle').innerHTML !== helmLabel) $('helm-toggle').innerHTML = helmLabel;
      ['port', 'starboard'].forEach((side, index) => {
        const reload = Math.max(0, Number(ship.reload?.[index]) || 0);
        const max = Array.isArray(ship.reloadMax) ? ship.reloadMax[index] : ship.reloadMax;
        this.fill(`${side}-fill`, 1 - reload / Math.max(.1, max || 1));
        this.text(`${side}-ready`, reload < .05 ? 'READY' : `${reload.toFixed(1)}s`);
        $(`${side}-fill`).closest('button').classList.toggle('is-reloading', reload >= .05);
      });
      const unlocked = S.ammoUnlocked || ['normal'];
      document.querySelectorAll('.ammo-strip [data-action="ammo"]').forEach(control => {
        const ammo = control.dataset.payload;
        const available = ammo === 'normal' || (Array.isArray(unlocked) ? unlocked.includes(ammo) : !!unlocked[ammo]);
        control.disabled = !available;
        control.classList.toggle('active', ship.ammo === ammo);
        control.setAttribute('aria-pressed', String(ship.ammo === ammo));
        control.title = available ? `${ammo === 'normal' ? 'Round' : ammo.charAt(0).toUpperCase() + ammo.slice(1)} shot` : 'Unlock at a port';
      });
      document.querySelectorAll('.drawer-presets [data-action="preset"]').forEach(control => control.classList.toggle('active', S.command === control.dataset.payload));
      this.text('crew-plan-summary', `${plan.gunners || 0} guns · ${plan.rowers || 0} oars · ${plan.repairers || 0} repair · ${plan.boarders || 0} boarding`);
      $('port-prompt').hidden = !S.nearPort || S.mode !== 'play';
      if (S.nearPort) this.text('near-port-name', S.nearPort.name || 'Safe harbor');
      this.updateQuest(S);
      this.updateTarget(S);
      this.updateBoardingBattle(S);
      this.syncOverlays(S);
      this.drawChart($('minimap'), S, false);
      const nearestIsland = (S.islands || []).filter(island => island.discovered).reduce((nearest, island) => !nearest || Math.hypot(island.x - ship.x, island.y - ship.y) < Math.hypot(nearest.x - ship.x, nearest.y - ship.y) ? island : nearest, null);
      this.text('position-text', nearestIsland?.region?.name || (typeof nearestIsland?.region === 'string' ? nearestIsland.region : '') || `${Math.round(ship.x / 100)}° E  ${Math.round(ship.y / 100)}° S`);
      if (!['play', 'title'].includes(S.mode)) {
        const signature = this.getModalKey(S);
        if (force || signature !== this.modalKey) this.renderModal(S);
        if (S.mode === 'map') this.drawChart($('full-chart'), S, true);
      }
    }

    readiness(S) {
      const ship = S.player;
      const sailors = ownCrew(ship).filter(member => !member.isCaptain && !member.boarding);
      const fallbackReady = sailors.filter(member => Math.hypot((member.tx || 0) - (member.lx || 0), (member.ty || 0) - (member.ly || 0)) <= 22).length;
      const blocked = !ship || ship.hp <= 0 || !ownCrew(ship).some(member => member.isCaptain) || living(ship).some(member => member.team && !['player','ally'].includes(member.team));
      const supplied = S.readiness || {};
      const ready = Math.max(0, Math.round(Number.isFinite(supplied.ready) ? supplied.ready : fallbackReady));
      const total = Math.max(ready, Math.round(Number.isFinite(supplied.total) ? supplied.total : sailors.length));
      const status = ['preparing','ready','sailing','danger'].includes(supplied.status) ? supplied.status : blocked ? 'danger' : !ship.anchor ? 'sailing' : ready < total ? 'preparing' : 'ready';
      return {
        status, ready, total,
        label: supplied.label || (status === 'danger' ? 'DECK UNDER THREAT' : status === 'sailing' ? 'UNDERWAY' : status === 'ready' ? 'CREW READY' : 'CREW GETTING READY'),
        detail: supplied.detail || (blocked ? 'Secure the deck before setting sail.' : ship.anchor ? ready < total ? 'Crew moving to stations. Hold W to sail now.' : 'Hold W to set sail. The anchor lifts automatically.' : 'Your crew is at work. Follow the gold objective marker.'),
        canSail: supplied.canSail === undefined ? !blocked : supplied.canSail,
      };
    }

    updateQuest(S) {
      const quest = S.quests?.[S.questIndex || 0];
      if (!quest) {
        this.text('quest-chapter', 'FREE SAILING');
        this.text('quest-title', 'The sea is yours');
        this.text('quest-description', 'Explore the archipelago, command your fleet, and seek your fortune.');
        this.text('quest-reward', '');
        this.text('quest-progress', 'Choose your own heading');
        this.fill('quest-fill', 1);
        return;
      }
      this.text('quest-chapter', `CHAPTER ${Math.min((S.questIndex || 0) + 1, S.quests.length)} / ${S.quests.length}`);
      this.text('quest-title', quest.title);
      this.text('quest-description', quest.description);
      this.text('quest-reward', quest.reward ? `+${number(quest.reward)} GOLD` : '');
      this.text('quest-progress', quest.goal > 1 ? `${Math.min(quest.progress || 0, quest.goal)} / ${quest.goal} complete` : quest.progress >= quest.goal ? 'Objective complete' : 'Follow the gold marker');
      this.fill('quest-fill', (quest.progress || 0) / Math.max(1, quest.goal || 1));
    }

    boardingStatus(S) {
      const supplied = typeof this.game.boardingStatus === 'function' ? this.game.boardingStatus() : null;
      const target = supplied?.target || S.grapple || S.target;
      if (!target) return { target: null };
      const distance = Math.hypot(target.x - S.player.x, target.y - S.player.y);
      const grappled = S.grapple?.id === target.id || S.grapple === target || S.player.grapple === target.id;
      const totalPlayer = ownCrew(S.player).length;
      const available = ownCrew(S.player).filter(member => !member.isCaptain && !member.boarding).length;
      const sendable = Math.min(S.player.boardParty || 8, Math.max(0, available - 4));
      const enemyDefenders = living(target).filter(member => !['player','ally'].includes(member.team)).length;
      const ownBoardersOnTarget = ownCrew(target).length;
      const canGrapple = !grappled && distance <= 720;
      const canSend = grappled && distance <= 460 && sendable > 0;
      const canCapture = grappled && distance <= 460 && (target.hp <= target.hpMax * .3 || enemyDefenders === 0);
      const force = sendable + ownBoardersOnTarget;
      const label = enemyDefenders === 0 ? 'Undefended' : force > enemyDefenders * 1.2 ? 'Favorable' : force >= enemyDefenders * .8 ? 'Close fight' : 'Outnumbered';
      const stage = canCapture ? 'claim' : !grappled ? canGrapple ? 'grapple' : 'approach' : distance > 460 ? 'haul' : ownBoardersOnTarget ? 'fighting' : 'board';
      const summary = stage === 'haul' ? 'The winch pulls both ships together automatically.' : stage === 'approach' ? 'Close to 720 fathoms to attach a line.' : stage === 'claim' ? 'The prize is ready. Claim it while the line is secured.' : ownBoardersOnTarget ? 'Your party is fighting aboard. Reinforce or recall survivors.' : 'Compare your boarding party with their defenders before sending sailors.';
      return { target, totalPlayer, sendable, enemyDefenders, ownBoardersOnTarget, distance, grappled, canGrapple, canSend, canCapture, label, stage, summary, ...supplied, target };
    }

    updateTarget(S) {
      const status = this.boardingStatus(S);
      const target = status.target;
      const visible = target && target.hp > 0 && !target.sinking && S.mode === 'play';
      $('target-panel').hidden = !visible;
      document.body.classList.toggle('has-target', !!visible);
      if (!visible) return;
      if (this.lastTargetId !== target.id) { this.lastTargetId = target.id; this.boardingOpen = false; }
      const distance = status.distance;
      this.text('target-kind', target.team === 'neutral' ? 'MERCHANT VESSEL' : `${target.kind || 'enemy'} · ENEMY VESSEL`);
      this.text('target-range', `${number(distance)} fm`);
      this.text('target-name', target.name || 'Unknown vessel');
      this.fill('target-fill', target.hp / Math.max(1, target.hpMax));
      this.text('target-health-text', `${Math.ceil(target.hp / target.hpMax * 100)}%`);
      this.text('target-crew-count', `Theirs ${number(status.enemyDefenders)} · Yours ${number(status.totalPlayer)}`);
      $('target-crew-count').title = 'Living crew totals. Open the boarding guide to compare the actual boarding force.';
      this.text('target-readiness', status.summary);
      $('target-interact').classList.toggle('in-range', status.canGrapple || status.grappled);
      this.updateBoardingControls(status);
    }

    updateBoardingControls(status) {
      const primary = $('target-primary');
      const deployed = status.ownBoardersOnTarget + (status.ownBoardersEnRoute || 0);
      let action = null;
      let label = 'Boarding';
      let key = '';
      let disabled = false;
      if (status.canCapture) { action = 'capture'; label = 'Claim'; key = 'C'; }
      else if (!status.grappled && status.canGrapple) { action = 'grapple'; label = 'Grapple'; key = 'G'; }
      else if (status.grappled && status.stage === 'haul') { label = 'Pulling in…'; disabled = true; }
      else if (status.canSend) { action = 'board'; label = deployed ? `Reinforce ${status.sendable}` : `Send ${status.sendable} crew`; key = 'B'; }
      if (action) { primary.dataset.action = action; delete primary.dataset.uiToggle; }
      else { delete primary.dataset.action; primary.dataset.uiToggle = 'boarding'; }
      if (!action && !disabled) primary.setAttribute('aria-expanded', String(this.boardingOpen));
      else primary.removeAttribute('aria-expanded');
      const primaryHTML = `${esc(label)}${key ? ` <kbd>${key}</kbd>` : ''}`;
      if (primary.innerHTML !== primaryHTML) primary.innerHTML = primaryHTML;
      primary.disabled = disabled;
      primary.classList.toggle('ready-to-claim', !!status.canCapture);
      primary.title = status.stage === 'haul' ? 'The line pulls you alongside automatically. No extra key needed.' : status.summary || 'Open boarding guide';
      this.text('boarding-force-number', number(status.sendable + deployed));
      this.text('boarding-force-detail', `${number(status.sendable)} ready + ${number(status.ownBoardersOnTarget)} aboard${status.ownBoardersEnRoute ? ` + ${number(status.ownBoardersEnRoute)} crossing` : ''}`);
      this.text('boarding-enemy-number', number(status.enemyDefenders));
      this.text('boarding-risk', status.label || 'Compare boarding strength');
      const risk = (status.label || '').toLowerCase().replace(/\s/g,'');
      $('boarding-risk').dataset.risk = risk === 'favorable' || risk === 'undefended' ? 'favorable' : risk === 'outnumbered' ? 'outnumbered' : 'close';
      const activeStep = { approach:1, grapple:1, haul:2, board:3, fighting:3, claim:4 }[status.stage] || 1;
      for (let step = 1; step <= 4; step++) {
        $(`boarding-step-${step}`).classList.toggle('active', step === activeStep);
        $(`boarding-step-${step}`).classList.toggle('complete', step < activeStep);
      }
      const sendStepHTML = status.canCapture && !deployed ? 'Boarding is not required' : status.sendable > 0 ? `${deployed ? 'Reinforce with' : 'Send'} ${number(status.sendable)} sailors <kbd>B</kbd>` : deployed ? 'Your party is fighting aboard' : 'More sailors needed aboard';
      if ($('boarding-send-step').innerHTML !== sendStepHTML) $('boarding-send-step').innerHTML = sendStepHTML;
      if (status.canCapture && !deployed) $('boarding-step-3').classList.remove('complete');
      const setAction = (id, text, key, disabled) => {
        const node = $(id);
        const html = `${esc(text)} <kbd>${key}</kbd>`;
        if (node.innerHTML !== html) node.innerHTML = html;
        node.disabled = disabled;
      };
      setAction('boarding-grapple', status.grappled ? 'Cut line' : 'Grapple', 'G', !status.grappled && !status.canGrapple);
      setAction('boarding-send', status.sendable > 0 ? deployed ? `Reinforce ${status.sendable}` : `Send ${status.sendable}` : 'No party ready', 'B', !status.canSend);
      setAction('boarding-recall', `Recall ${deployed}`, 'N', status.canRecall === false || !status.grappled || !deployed);
      setAction('boarding-capture', 'Claim', 'C', !status.canCapture);
      $('boarding-capture').classList.toggle('capture-ready', !!status.canCapture);
      const focusButton = $('boarding-open-focus');
      focusButton.disabled = !status.grappled;
      const focusLabel = `${deployed ? 'Command party' : 'Plan boarding'} <span>→</span>`;
      if (focusButton.innerHTML !== focusLabel) focusButton.innerHTML = focusLabel;
      this.text('boarding-focus-hint', status.grappled ? 'Choose a landing zone, stance, and timed orders.' : 'Attach a grapple first with G.');
    }

    updateBoardingBattle(S) {
      const status = typeof this.game.boardingBattleStatus === 'function' ? this.game.boardingBattleStatus() : { ...this.boardingStatus(S), active:!!S.grapple, zones:[] };
      const visible = !!S.boardingFocus && S.mode === 'play' && status.active && status.target?.hp > 0;
      $('boarding-command').hidden = !visible;
      $('hud').hidden = visible || S.mode === 'title' || this.titleUnderlay;
      $('hud').inert = visible;
      document.body.classList.toggle('boarding-focused', visible);
      if (visible !== this.boardingFocused) {
        this.boardingFocused = visible;
        if (visible) {
          this.boardingPreviousFocus = document.activeElement;
          this.drawerOpen = false; this.boardingOpen = false; this.releaseTouch();
          requestAnimationFrame(() => { if (this.boardingFocused) $('boarding-arena').focus({preventScroll:true}); });
        } else if (S.mode === 'play') {
          requestAnimationFrame(() => { if (!this.boardingFocused && this.game.state.mode === 'play') $('game').focus({preventScroll:true}); });
        }
      }
      if (!visible) return;
      const arrived = Math.max(0,status.ownBoardersOnTarget || 0);
      const crossing = Math.max(0,status.ownBoardersEnRoute || 0);
      const deployed = arrived + crossing;
      const ready = Math.max(0,status.sendable || 0);
      const morale = clamp(Number.isFinite(status.morale) ? status.morale : 100,0,100);
      const controlled = Math.max(0,status.controlled || 0);
      const selectedZone = status.zone || status.battle?.zone || 'helm';
      const stance = status.stance || status.battle?.stance || 'assault';
      const admiral = status.target.questTag === 'admiral';
      const secured = status.enemyDefenders === 0 || !!status.battle?.surrendered;
      this.text('boarding-battle-title', status.target.name || 'Across the gunwale');
      this.text('boarding-battle-description', admiral ? 'The admiral refuses surrender. Boarding can weaken his crew, but his flagship must be sunk.' : secured ? 'Deck secured. Claim your prize while the line is secured.' : status.canCapture ? 'This ship is ready to surrender. Claim your prize while the line is secured.' : 'Hold two deck zones and break enemy resolve to demand surrender.');
      this.text('battle-own-count', deployed);
      this.text('battle-own-detail', `${arrived} on deck · ${crossing} crossing · ${ready} ready`);
      this.text('battle-enemy-count', status.enemyDefenders || 0);
      this.text('battle-control-goal', secured ? 'DECK SECURED' : `${Math.min(2,controlled)} / 2 ZONES`);
      this.text('battle-goal-detail', admiral ? 'Admiral refuses surrender' : status.canCapture ? 'Ship ready to claim' : secured ? 'Stay linked and close to claim' : controlled >= 2 ? 'Zones secured · break their resolve' : 'Hold two zones to force surrender');
      this.text('battle-landing-hint', secured ? admiral ? 'The enemy crew is defeated. Recall your sailors and finish his flagship at sea.' : 'Your party has secured the deck. Claim the ship or recall your sailors.' : deployed ? 'Your teal crew fights on this deck. Click a zone or use 1 / 2 / 3 to direct your squad.' : status.isAttacker === false ? 'Teal is your crew. Red is the opposing crew on this deck.' : 'Your crew crosses from your flagship; enemy crew defends this deck. Choose a landing zone, then launch.');
      this.text('battle-morale-number', `${Math.round(morale)}%`);
      this.fill('battle-morale-fill',morale / 100,morale < 30 ? 'var(--green)' : 'var(--red)');
      for (const id of ['helm','guns','bow']) {
        const zone = (status.zones || []).find(entry => entry.id === id) || {control:0,own:0,enemies:0};
        const control = clamp(zone.control || 0,0,1);
        const button = $(`battle-zone-${id}`);
        button.classList.toggle('selected',selectedZone === id);
        button.setAttribute('aria-pressed',String(selectedZone === id));
        this.text(`battle-zone-percent-${id}`,`${Math.round(control * 100)}%`);
        this.fill(`battle-zone-fill-${id}`,control);
        this.text(`battle-zone-count-${id}`,`${number(zone.own || 0)} yours · ${number(zone.enemies || 0)} enemies`);
      }
      for (const name of ['assault','guard']) {
        const button = $(`battle-stance-${name}`);
        button.classList.toggle('selected',stance === name);
        button.setAttribute('aria-pressed',String(stance === name));
      }
      const rush = Math.max(0,Number(status.rushIn ?? status.battle?.rushIn ?? 10));
      const imminent = !secured && arrived > 0 && rush > 0 && rush <= 2.5;
      $('battle-rush').dataset.imminent = String(imminent);
      this.text('battle-rush-label', secured ? 'Deck secured' : imminent ? 'Enemy rush incoming' : deployed ? 'Next enemy rush' : 'Watch for their rush');
      this.text('battle-rush-countdown',secured ? 'No further rushes' : deployed ? `${rush.toFixed(1)} seconds` : 'Launch your party to begin');
      this.text('battle-rush-hint',secured ? admiral ? 'The admiral still refuses surrender.' : status.canCapture ? 'Claim your prize · C' : 'Stay linked and close to claim.' : imminent ? 'Brace now to counter · Space' : 'A well-timed brace counters the rush.');
      const abilityInfo = {
        volley:{max:12,enabled:status.canVolley,description:'Strike enemies in the selected zone'},
        rally:{max:18,enabled:status.canRally,description:'Heal living crew · boost attack'},
        brace:{max:8,enabled:status.canBrace,description:imminent ? 'Counter their rush now' : 'Time it to counter their rush'},
      };
      for (const [name,info] of Object.entries(abilityInfo)) {
        const cooldown = Math.max(0,status.cooldowns?.[name] || 0);
        const button = $(`battle-ability-${name}`);
        button.disabled = !info.enabled;
        button.classList.toggle('rush-window',name === 'brace' && imminent && !!info.enabled);
        button.title = cooldown > .05 ? `Ready in ${cooldown.toFixed(1)} seconds` : !arrived ? 'Requires your sailors to reach the enemy deck.' : info.description;
        this.text(`battle-${name}-cooldown`,cooldown > .05 ? `${cooldown.toFixed(1)}s` : info.enabled ? 'Ready' : '—');
        this.text(`battle-${name}-detail`,!arrived ? 'Needs sailors on deck' : info.description);
        $(`battle-${name}-progress`).style.width = `${clamp(1 - cooldown / info.max,0,1) * 100}%`;
      }
      const setButton = (id,label,key,enabled) => {
        const node = $(id);
        const html = `${esc(label)} <kbd>${key}</kbd>`;
        if (node.innerHTML !== html) node.innerHTML = html;
        node.disabled = !enabled;
      };
      setButton('battle-launch-button',deployed ? `Reinforce ${ready}` : `Send your ${ready}`, 'B',status.canSend);
      setButton('battle-recall-button',`Recall ${deployed}`, 'N',status.canRecall);
      setButton('battle-claim-button','Claim ship','C',status.canCapture);
      $('battle-claim-button').classList.toggle('capture-ready',!!status.canCapture);
      this.text('battle-message',admiral && secured ? 'Deck secured. The admiral refuses surrender. Sink his flagship.' : secured ? status.canCapture ? 'Deck secured. Claim your prize with C.' : 'Deck secured. Stay linked and close alongside to claim.' : status.canCapture ? 'The ship is ready to claim. Press C to take the prize.' : status.message || status.summary || 'Choose your landing zone and lead the party.');
    }

    syncOverlays(S) {
      const inPlay = S.mode === 'play' && !S.boardingFocus;
      $('advanced-controls').hidden = !inPlay || !this.drawerOpen;
      if (this.drawerOpen) $('sail-readiness').hidden = true;
      $('more-controls').setAttribute('aria-expanded', String(inPlay && this.drawerOpen));
      const boardingVisible = inPlay && this.boardingOpen && !$('target-panel').hidden;
      $('boarding-panel').hidden = !boardingVisible;
      $('target-interact').setAttribute('aria-expanded', String(boardingVisible));
      if ($('target-primary').dataset.uiToggle === 'boarding' && !$('target-primary').disabled) $('target-primary').setAttribute('aria-expanded', String(boardingVisible));
      $('port-prompt').hidden = !inPlay || !S.nearPort || boardingVisible || this.drawerOpen;
    }

    show(mode, S) {
      const previous = this.mode;
      this.mode = mode;
      if (previous === 'title' && mode === 'help') this.titleUnderlay = true;
      else if (mode === 'play' || mode === 'title') this.titleUnderlay = false;
      const modalOpen = !['play', 'title'].includes(mode);
      $('title-screen').hidden = mode !== 'title' && !this.titleUnderlay;
      $('hud').hidden = mode === 'title' || this.titleUnderlay;
      $('modal').hidden = !modalOpen;
      if (mode !== 'play') this.releaseTouch();
      if (mode !== 'play') { this.drawerOpen = false; this.boardingOpen = false; }
      this.syncOverlays(S);
      if (modalOpen) {
        if (previous === 'play' || previous === 'title' || previous === null) this.previousFocus = document.activeElement;
        this.renderModal(S);
        if (previous !== mode) $('modal-panel').scrollTop = 0;
        if (previous !== mode) requestAnimationFrame(() => { const first = $('modal-panel').querySelector('[data-autofocus],button:not(:disabled)'); (first || $('modal-panel')).focus({ preventScroll: true }); });
      } else {
        this.modalKey = '';
        this.chartCanvas = null;
        if (previous && previous !== 'title' && this.previousFocus?.isConnected && mode === 'play') this.previousFocus.focus({ preventScroll: true });
      }
    }

    getModalKey(S) {
      const ship = S.player;
      if (S.mode === 'crew') return JSON.stringify([S.mode, ship?.id, S.command, S.crewPlan, this.ownedShips(S).map(vessel => [vessel.id,vessel.kind,Math.ceil(vessel.hp),living(vessel).length])]);
      if (S.mode === 'port') return JSON.stringify([S.mode, this.portCategory, this.selectedCommission, this.refitsOpen, this.otherShipyardsOpen, S.gold, Math.ceil(ship?.hp || 0), ship?.kind, ship?.hpMax, ship?.crewCap, ship?.cannons, living(ship).length, S.reserveCrew?.length, S.readiness, S.upgrades, S.ammoUnlocked, S.nearPort?.id]);
      if (S.mode === 'map') return JSON.stringify([S.mode, S.waypoint, (S.islands || []).map(island => island.discovered ? island.id : null)]);
      return JSON.stringify([S.mode, S.sound, S.prize?.id, S.stats, S.endTitle, S.endDescription]);
    }

    renderModal(S) {
      const panel = $('modal-panel');
      const focused = panel.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
      const focusedIndex = focused ? [...panel.querySelectorAll('button')].indexOf(document.activeElement) : -1;
      const scroll = panel.scrollTop;
      const oldPortBody = panel.querySelector('.port-body');
      if (oldPortBody) this.portScroll[oldPortBody.dataset.category] = oldPortBody.scrollTop;
      const content = {
        map: () => this.mapView(S),
        pause: () => this.pauseView(S),
        help: () => this.helpView(S),
        port: () => this.portView(S),
        crew: () => this.crewView(S),
        prize: () => this.prizeView(S),
        over: () => this.resultView(S, false),
        win: () => this.resultView(S, true),
      }[S.mode];
      panel.innerHTML = content ? content() : this.pauseView(S);
      const heading = panel.querySelector('h2');
      if (heading) { heading.id = 'modal-title'; panel.setAttribute('aria-labelledby', 'modal-title'); }
      panel.dataset.mode = S.mode;
      panel.scrollTop = scroll;
      const portBody = panel.querySelector('.port-body');
      if (portBody) portBody.scrollTop = this.portScroll[portBody.dataset.category] || 0;
      this.modalKey = this.getModalKey(S);
      if (focused) {
        const replacement = panel.querySelector(`[data-focus="${CSS.escape(focused)}"]`);
        const controls = [...panel.querySelectorAll('button')];
        const next = replacement && !replacement.disabled ? replacement : controls.slice(Math.max(0, focusedIndex)).find(control => !control.disabled) || controls.find(control => !control.disabled);
        next?.focus({ preventScroll: true });
      }
      if (S.mode === 'map') requestAnimationFrame(() => this.drawChart($('full-chart'), this.game.state, true));
    }

    head(kicker, title, subtitle = '', closable = true) {
      return `<header class="modal-head"><div><span class="eyebrow">${esc(kicker)}</span><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${closable ? closeButton : ''}</header>`;
    }

    pauseView(S) {
      return `${this.head('A MOMENT IN THE HARBOR', 'Voyage paused', 'Your ship and crew await your command.')}<p class="pause-lead">“No wind is favorable to the sailor<br>who has no port in mind.”</p><div class="menu-grid">${button('Resume voyage<span>Return to the open sea</span>', 'resume', undefined, 'gold-button', false, 'resume')}${button('Save voyage<span>Keep your ship, crew, and discoveries</span>', 'save', undefined, '', false, 'save')}${button("Captain’s guide<span>Controls, combat, and the art of boarding</span>", 'help', undefined, '', false, 'help')}${button(`Sound ${S.sound === false ? 'off' : 'on'}<span>Toggle cannon and battle sounds</span>`, 'toggleSound', undefined, '', false, 'sound')}${button(`${document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}<span>Use the whole screen for your voyage</span>`, 'fullscreen', undefined, '', false, 'fullscreen')}${button('Sea chart<span>Plan your next destination</span>', 'map', undefined, '', false, 'map')}${button('Crew & fleet<span>Change assignments and escort orders</span>', 'crew', undefined, '', false, 'crew')}</div><div class="modal-footer"><span>Progress saves automatically at ports and major milestones.</span>${button('New voyage', 'restart', undefined, 'text-button', false, 'restart')}</div>`;
    }

    helpView() {
      const row = (label, keys) => `<div class="control-row"><span>${label}</span><kbd>${keys}</kbd></div>`;
      return `${this.head('THE CAPTAIN’S GUIDE', 'Make the sea your own', 'Sail, fight, trade, and turn rival ships into a fleet.')}<div class="guide-grid"><section class="guide-block"><h3>Take the helm</h3><p>Hold W to set sail—the anchor lifts automatically. A/D steers, S slows down, and X stops the ship. Your crew can finish preparing while you sail. At full sail, a fair wind speeds long journeys while enemies are distant.</p>${row('Set sail / speed up', 'W')}${row('Steer left / right', 'A / D')}${row('Slow down', 'S')}${row('Stop the ship', 'X')}${row('Manual anchor · advanced', 'R')}${row('Helm / walk the deck', 'F')}${row('Chart / crew / pause', 'M / TAB / ESC')}${row('Zoom', '+ / −')}</section><section class="guide-block"><h3>Master the broadside</h3><p>Cannons fire from your sides. Turn alongside the enemy, line up a broadside, and watch each side’s reload. Fire and chain shot add different tactical effects.</p>${row('Port / starboard volley', 'Q / E')}${row('Both broadsides', 'SPACE')}${row('Battle / pursuit / repair', '1 / 2 / 3')}${row('Enter a nearby port', 'H')}${row('Walk while on deck', 'W A S D')}${row('Sabre while on deck', 'SPACE')}</section><section class="guide-block"><h3>Board & claim</h3><p>Attach a grapple with G; the winch pulls the ships together. Open Plan boarding to choose a landing zone and stance, or press B to launch a party and enter command view. B reinforces, N recalls, and C claims a surrendered ship.</p>${row('Grapple / cut lines', 'G')}${row('Send / recall boarders', 'B / N')}${row('Claim a weakened ship', 'C')}<p>In command, 1/2/3 directs the party to Helm/Guns/Bow. Z chooses Assault; X chooses Guard. Q fires a pistol volley, E rallies living boarders, and Space braces. Brace during the rush warning to counter it. Hold two zones and break enemy resolve to demand surrender. The 30% hull and no-defender routes still work. The admiral refuses all surrender; sink his flagship. Escape returns to sea without recalling your party.</p></section><section class="guide-block"><h3>Build your fortune</h3><p>Gold markers lead to your current objective. Visit ports to repair, recruit, and buy permanent upgrades. Click the chart to set a personal waypoint.</p><p>Gunners man each cannon. Rowers add speed. Repairers patch the hull. Boarders take the fight to the enemy. Find the balance that fits your next encounter.</p><p>Keep the fleet together using Follow, Defend, or Attack orders in the crew panel.</p><p><strong>Haunted waters:</strong> cursed islands hide skeleton pirate crews and spectral sails. Upgrade your flagship and recruit healthy sailors before you challenge them.</p></section></div><div class="guide-tip"><strong>Your first heading:</strong> hold W to leave harbor, steer with A/D, and follow the gold objective marker. Crew readiness is a status, so you can sail while sailors reach their stations. Practice a broadside in open water. Avoid the largest warships until your crew and guns are ready.</div><div class="modal-footer"><span>Touchscreen: use the directional pad to steer and adjust sails.</span>${button('Back to voyage', 'close', undefined, 'gold-button', false, 'close-footer')}</div>`;
    }

    mapView(S) {
      const ports = (S.islands || []).filter(island => island.port && island.discovered);
      const portButtons = ports.map(port => {
        const inventory = this.portInventory(port);
        const count = inventory.stock?.ships?.length || 0;
        return button(`${esc(port.name)}<small>${esc(inventory.specialty || 'Harbor')} · Tier ${number(inventory.tier || 1)}${inventory.grandPort ? ' · Grand shipyard' : ''}<br>${count} ${count === 1 ? 'ship' : 'ships'} for sale · Set course →</small>`, 'waypoint', { x: port.x + port.r + 180, y: port.y, name: port.name }, 'port-destination', false, `waypoint-${port.id}`);
      }).join('');
      return `${this.head('THE ARCHIPELAGO', 'Chart your course', 'Click anywhere on the chart to place a waypoint. Gold marks your current objective.')}<div class="chart-layout"><div class="full-chart-wrap"><canvas id="full-chart" tabindex="0" aria-label="Sea chart. Click to set a waypoint; named harbor buttons are available alongside."></canvas><div class="map-legend"><span><i class="legend-dot player-dot"></i>Your ship</span><span><i class="legend-dot"></i>Objective</span><span><i class="legend-dot enemy-dot"></i>Hostile</span></div></div><aside class="chart-ports"><h3>DISCOVERED HARBORS</h3><div class="port-list">${portButtons || '<p class="modal-note">Sail close to islands to reveal harbors.</p>'}</div>${S.waypoint ? `<div class="waypoint-box">COURSE SET<br><strong>${esc(S.waypoint.name || 'Charted waypoint')}</strong>${button('Clear waypoint', 'clearWaypoint', undefined, 'text-button', false, 'clear-waypoint')}</div>` : ''}<p class="chart-side-note">A harbor marker sets your heading. You remain at the helm for the journey. Explore the pale waters to discover more of the archipelago.</p></aside></div><div class="modal-footer"><span>Unknown islands reveal themselves as you sail nearby.</span><div class="footer-buttons">${button('Resume sailing', 'close', undefined, 'gold-button', false, 'close-footer')}</div></div>`;
    }

    portInventory(port = this.game.state.nearPort) {
      const inventory = typeof this.game.portInventory === 'function' ? this.game.portInventory(port) : window.PirateWorld?.portDef?.(port?.id);
      return inventory || { id:port?.id, name:port?.name || 'Harbor', tier:1, specialty:'Local shipyard', grandPort:false, stock:{ships:[],items:[]}, refitCaps:{} };
    }

    otherShipyardsView(S) {
      const catalog = window.PirateWorld?.shipCatalog || [];
      const fantastic = catalog.filter(ship => ['leviathan','stormark','ghost'].includes(ship.kind) || ship.fantastic);
      const locations = (S.islands || []).filter(port => port.port && port.id !== S.nearPort?.id).map(port => {
        const inventory = this.portInventory(port);
        const names = fantastic.filter(ship => (inventory.stock?.ships || []).includes(ship.kind)).map(ship => ship.name);
        if (!names.length) return '';
        const destination = { x:port.x + port.r + 180, y:port.y, name:port.name };
        return `<div class="other-shipyard"><div><strong>${esc(port.name)}</strong><small>${esc(names.join(' · '))}</small></div>${button('Set course', 'waypoint', destination, '', false, `shipyard-course-${port.id}`)}</div>`;
      }).filter(Boolean).join('');
      if (!locations) return '';
      return `<section class="other-shipyards"><button class="refit-toggle" data-ui-toggle="other-shipyards" data-focus="other-shipyards-toggle" aria-expanded="${this.otherShipyardsOpen}" aria-controls="other-shipyard-list"><span>Other shipyards <small>Find fantastic vessels</small></span><strong>${this.otherShipyardsOpen ? '−' : '+'}</strong></button><div id="other-shipyard-list"${this.otherShipyardsOpen ? '' : ' hidden'}><p class="modal-note">Mark a heading, then sail there. These routes do not move your fleet.</p>${locations}</div></section>`;
    }

    portView(S) {
      const port = S.nearPort;
      const ship = S.player;
      const inventory = this.portInventory(port);
      const items = typeof this.game.shopItems === 'function' ? this.game.shopItems() || [] : [];
      const itemById = new Map(items.map(item => [item.id, item]));
      const shipNames = { brig: 'Brig', galleon: 'Grand galleon', warship: 'Man-of-war', sloop: 'Sloop' };
      const category = ['shipyard','arsenal','crew','passage'].includes(this.portCategory) ? this.portCategory : 'shipyard';
      const categories = [['shipyard','Shipyard','ship'],['arsenal','Arsenal','crosshair'],['crew','Crew & repairs','crew'],['passage','Passage','map']];
      const tabs = categories.map(([id,label,symbol]) => `<button class="port-tab${category === id ? ' selected' : ''}" type="button" role="tab" id="port-tab-${id}" aria-controls="port-category-content" aria-selected="${category === id}" tabindex="${category === id ? 0 : -1}" data-shop-tab="${id}" data-focus="port-tab-${id}">${symbol === 'ship' ? this.shipGlyph('brig') : icon(symbol)}<span>${label}</span></button>`).join('');
      const card = (id, featured = false) => {
        const item = itemById.get(id);
        if (!item) return '';
        const affordable = S.gold >= item.cost;
        const unlocked = ['fire','chain','grape'].includes(id) && S.ammoUnlocked?.includes(id);
        const tierKey = { speed:'speed', hull:'hull', cannons:'cannons', slot:'slot' }[id];
        const currentTier = tierKey ? Number(S.upgrades?.[tierKey]) || 0 : 0;
        const maxTier = Number.isFinite(item.maxTier) ? item.maxTier : null;
        const localCapped = !!tierKey && maxTier !== null && currentTier >= maxTier;
        const canBuy = item.enabled && !localCapped;
        const status = item.disabledReason || (!canBuy ? unlocked ? 'Already unlocked' : id === 'repair' ? 'Ship and crew ready' : id === 'hire' ? 'All berths filled' : localCapped ? 'A grand shipyard can provide higher tiers.' : 'Maximum tier reached' : affordable ? 'Ready to purchase' : `${number(item.cost - S.gold)} more gold needed`);
        const tag = featured ? 'COMMISSION A FLAGSHIP' : ['fire','chain','grape'].includes(id) ? 'PERMANENT AMMO UNLOCK' : id === 'repair' ? 'RESTORE HULL & CREW' : id === 'hire' ? 'ADD ONE SAILOR' : 'PERMANENT UPGRADE';
        const title = id === 'hire' && S.reserveCrew?.length ? 'Recall a shore sailor' : ({ galleon:'Grand galleon', warship:'Man-of-war', speed:'Sails & rigging', hull:'Reinforced hull', cannons:'Cannon foundry', slot:'Broadside battery', fire:'Fire shot', chain:'Chain shot', grape:'Grapeshot', repair:'Careen & repair', hire:'Recruit a sailor' })[id] || item.title;
        const tier = tierKey ? `<span class="port-card-tier">${localCapped ? `LOCAL LIMIT · TIER ${maxTier}` : `TIER ${currentTier + 1}${maxTier === null ? '' : ` / ${maxTier}`}`}</span>` : '';
        const art = featured ? `<div class="commission-art">${this.shipGlyph(id)}</div>` : '';
        return `<article class="port-card${featured ? ' commission-card' : ''}${!canBuy ? ' completed' : ''}">${art}<div class="port-card-top"><span class="eyebrow">${tag}</span>${tier}</div><h3>${esc(title)}</h3><p>${esc(item.description)}</p><div class="port-card-purchase"><div class="port-card-price">${canBuy ? `<strong>${number(item.cost)}</strong><span>GOLD</span>` : `<span class="port-item-owned">${esc(localCapped ? 'Local maximum reached' : status)}</span>`}</div>${canBuy ? button(affordable ? 'Purchase' : 'Need gold', 'buy', item.id, affordable ? 'gold-button' : '', !affordable, `buy-${item.id}`) : ''}</div>${canBuy || localCapped ? `<div class="port-card-status${canBuy && affordable ? ' affordable' : ''}">${esc(status)}</div>` : ''}</article>`;
      };
      const section = (title, description, cards, empty = 'This service is not stocked at this harbor. Try another specialist or a grand shipyard.') => `<section class="port-section"><div class="port-section-heading"><h3>${title}</h3><p>${description}</p></div>${cards ? `<div class="port-card-grid">${cards}</div>` : `<p class="port-stock-empty">${esc(empty)}</p>`}</section>`;
      const destinations = (S.islands || []).filter(island => island.port && island.discovered && island.id !== port?.id);
      const passage = destinations.map(destination => {
        const cost = Math.round(35 + Math.hypot(S.player.x - destination.x, S.player.y - destination.y) / 350);
        return `<article class="passage-card"><div class="passage-emblem">${icon('port')}</div><div><h3>${esc(destination.name)}</h3><p>Safe passage for your ship and escorts.</p></div><strong>${number(cost)} <small>GOLD</small></strong>${button('Book passage', 'travel', destination.id, S.gold >= cost ? 'gold-button' : '', S.gold < cost, `travel-${destination.id}`)}</article>`;
      }).join('');
      const commissions = items.filter(item => item.shipProfile || ['galleon','warship'].includes(item.id));
      if (!commissions.some(item => item.id === this.selectedCommission)) this.selectedCommission = commissions.find(item => item.enabled)?.id || commissions[0]?.id;
      const selectedShip = commissions.find(item => item.id === this.selectedCommission);
      const roster = commissions.map(item => {
        const ownedCount = item.ownedCount ?? this.ownedShips(S).filter(vessel => vessel.kind === item.id).length;
        return `<button data-commission="${esc(item.id)}" data-focus="commission-${esc(item.id)}" aria-pressed="${item.id === this.selectedCommission}" class="roster-choice${item.id === this.selectedCommission ? ' selected' : ''}"><span>${esc(item.shipProfile?.name || item.title.replace(/^Commission (?:a |an )?/i,''))}</span><small>${number(item.cost)} gold${ownedCount ? ` · ${number(ownedCount)} owned` : ''}</small></button>`;
      }).join('');
      const commissionSelector = `<section class="port-section"><div class="port-section-heading"><h3>Add a ship to your fleet</h3><p>New ships join as escorts. Choose your flagship in Fleet.</p></div>${selectedShip ? `<div class="commission-browser"><nav class="commission-roster" aria-label="Ships stocked at this harbor">${roster}</nav>${this.shipProfileView(selectedShip,S)}</div>` : '<p class="port-stock-empty">This harbor does not sell ships. Visit another shipyard to expand your fleet.</p>'}</section>`;
      const refitCards = card('hull') + card('speed');
      const refits = refitCards ? `<div class="shipyard-refits"><button class="refit-toggle" data-ui-toggle="refits" data-focus="refits-toggle" aria-expanded="${this.refitsOpen}" aria-controls="refit-content"><span>Refit the active flagship <small>Hull & sails</small></span><strong>${this.refitsOpen ? '−' : '+'}</strong></button><div id="refit-content" class="port-card-grid"${this.refitsOpen ? '' : ' hidden'}>${refitCards}</div></div>` : '<p class="port-stock-note">Hull and sail refits are not offered at this harbor.</p>';
      const gunCards = card('cannons') + card('slot');
      const ammoCards = card('fire') + card('chain') + card('grape');
      const arsenal = gunCards || ammoCards ? (gunCards ? section('Guns & batteries', 'Refits for the active flagship, within this port’s workshop limits.', gunCards) : '<p class="port-stock-note">This harbor has no cannon foundry or battery workshop.</p>') + (ammoCards ? section('Special ammunition', 'Unlock once. Switch freely at the helm.', ammoCards) : '<p class="port-stock-note">Special ammunition is not stocked here.</p>') : section('Arsenal', 'Harbor stock', '', 'No cannon refits or special ammunition are stocked here. A specialist port or grand shipyard carries more equipment.');
      const content = category === 'shipyard' ? commissionSelector + refits + this.otherShipyardsView(S)
        : category === 'arsenal' ? arsenal
        : category === 'crew' ? section('Ready for the next voyage', 'Restore your ship, heal the living crew, and fill empty berths.', card('repair') + card('hire')) + `<div class="port-crew-banner"><div>${icon('crew')}<span><strong>A station for every sailor</strong><small>Balance gunners, rowers, repairers, and boarders.</small></span></div>${button('Manage crew & fleet', 'crew', undefined, '', false, 'port-manage-crew')}</div>`
        : `<section class="port-section"><div class="port-section-heading"><h3>Book safe passage</h3><p>A local pilot guides your ship and escorts straight to a discovered harbor.</p></div><div class="passage-list">${passage || '<div class="port-empty">'+icon('map')+'<h3>More harbors await</h3><p>Sail close to new islands to discover their ports. Return here to arrange safe passage.</p></div>'}</div></section>`;
      const alive = ownCrew(ship).length;
      const readiness = this.readiness(S);
      const className = window.PirateWorld?.shipCatalog?.find(profile => profile.kind === ship.kind)?.name || items.find(item => item.id === ship.kind)?.shipProfile?.name || shipNames[ship.kind] || ship.kind;
      const serviceCount = items.filter(item => !item.shipProfile && !['galleon','warship'].includes(item.id)).length;
      const identity = `<div class="harbor-identity"><span class="harbor-specialty">${esc(inventory.specialty || 'Local shipyard')}</span>${inventory.grandPort ? '<span class="grand-shipyard-badge">Grand Shipyard</span>' : ''}<small>Tier ${number(inventory.tier || 1)} · ${commissions.length} ${commissions.length === 1 ? 'ship' : 'ships'} · ${serviceCount} services</small></div>`;
      return `<div class="harbor-shell"><header class="harbor-header"><div><span class="eyebrow">SAFE HARBOR · WORLD PAUSED</span><h2>${esc(port?.name || 'Harbor')}</h2>${identity}</div><div class="harbor-gold"><span class="eyebrow">YOUR GOLD</span><strong>${number(S.gold)}</strong></div>${button('Leave harbor <span>→</span>', 'undock', undefined, 'gold-button harbor-leave', false, 'undock')}</header><nav class="port-tabs" role="tablist" aria-label="Harbor services">${tabs}</nav><div class="port-ship-strip"><div class="port-ship-name">${this.shipGlyph(ship.kind)}<span><strong>${esc(ship.name || 'Your flagship')}</strong><small>${esc(className)} · your current flagship</small></span></div><div class="port-ship-stats"><span><small>HULL</small><strong>${number(Math.max(0,ship.hp))}<em> / ${number(ship.hpMax)}</em></strong></span><span><small>CREW</small><strong>${alive}<em> / ${number(ship.crewCap)}</em></strong></span><span><small>GUNS / SIDE</small><strong>${number(ship.cannons)}</strong></span><span class="port-readiness" data-status="${readiness.status}"><small>STATIONS READY</small><strong>${readiness.ready}<em> / ${readiness.total}</em></strong></span></div></div><div class="port-body" data-category="${category}" id="port-category-content" role="tabpanel" aria-labelledby="port-tab-${category}" tabindex="0">${content}</div><footer class="harbor-footer"><span>${category === 'arsenal' ? 'Special ammo stays unlocked for the entire voyage.' : category === 'crew' ? 'Heal and recruit here. Assign stations in Crew & Fleet.' : category === 'passage' ? 'Passage moves your flagship and escorts together.' : 'New ships join your fleet. Refits apply to the active flagship.'}</span>${button('Save voyage', 'save', undefined, 'text-button', false, 'port-save')}</footer></div>`;
    }

    shipGlyph(kind = 'brig') {
      const large = ['galleon','warship'].includes(kind);
      return `<svg class="ship-glyph" viewBox="0 0 180 90" fill="none" aria-hidden="true"><path d="M17 63h145l-17 16H41L17 63Z" fill="currentColor" opacity=".28"/><path d="M17 63h145l-17 16H41L17 63ZM81 13v50M118 19v44${large ? 'M48 26v37' : ''}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M77 17 53 51h24V17ZM86 17l26 34H86V17ZM115 25 98 53h17V25ZM123 25l19 28h-19V25Z" fill="currentColor" opacity=".6"/>${large ? '<path d="m46 30-15 24h15V30Z" fill="currentColor" opacity=".5"/>' : ''}<path d="M18 84c10-4 17 4 27 0s17 4 27 0 17 4 27 0 17 4 27 0 17 4 27 0M81 13l15 4-15 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    }

    ownedShips(S) {
      return (S.ships || [S.player]).filter(ship => ship && ship.hp > 0 && !ship.sinking && ['player','ally'].includes(ship.team)).sort((a,b) => Number(b.id === S.player?.id) - Number(a.id === S.player?.id));
    }

    ownedFleetView(S) {
      const vessels = this.ownedShips(S);
      const rows = vessels.map(ship => {
        const flagship = ship.id === S.player.id;
        const definition = window.PirateWorld?.shipDef?.(ship.kind);
        const className = definition?.name || ship.kind.charAt(0).toUpperCase() + ship.kind.slice(1);
        const crew = living(ship).filter(member => !member.team || ['player','ally'].includes(member.team)).length;
        return `<article class="fleet-vessel${flagship ? ' is-flagship' : ''}">${this.shipGlyph(ship.kind)}<div class="fleet-vessel-copy"><strong>${esc(ship.name || className)}</strong><small>${esc(className)} · ${number(Math.max(0,ship.hp))}/${number(ship.hpMax)} hull · ${crew} crew</small></div>${flagship ? '<span class="flagship-badge">Flagship</span>' : button('Take helm', 'takeHelm', ship.id, '', false, `take-helm-${ship.id}`)}</article>`;
      }).join('');
      return `<section class="owned-fleet" id="owned-fleet"><div class="owned-fleet-heading"><h3>Your fleet <span>${vessels.length} ${vessels.length === 1 ? 'ship' : 'ships'}</span></h3><p>Take helm to control a ship. Your other vessels stay in the fleet.</p></div><div class="owned-fleet-list">${rows}</div></section>`;
    }

    shipProfileView(item, S) {
      let profile = item.shipProfile;
      if (!profile) {
        const definition = window.PirateWorld?.shipDef?.(item.id) || {};
        profile = { ...definition, name: item.title.replace(/^Commission (?:a |an )?/i,''), role: 'Heavy flagship', strength: 'More guns, hull, and crew space.', weakness: 'A larger hull needs room to turn.' };
      }
      const ship = S.player;
      const affordable = S.gold >= item.cost;
      const ownedCount = item.ownedCount ?? this.ownedShips(S).filter(vessel => vessel.kind === item.id).length;
      const purchaseStatus = affordable ? `Joins as an escort${ownedCount ? ` · ${ownedCount} already owned` : ''}` : `${number(item.cost - S.gold)} more gold needed`;
      const title = profile.name || item.title;
      const specs = [
        ['Hull', profile.hp, ship.hpMax, value => number(value), false],
        ['Speed', profile.speed, ship.speed, value => `${(value / 22).toFixed(1)} kn`, false],
        ['Handling', profile.turn, ship.turn, value => `${Math.round(Number(value || 0) * 180 / Math.PI)}°/s`, false],
        ['Guns / side', profile.cannons, ship.cannons, value => number(value), false],
        ['Shot damage', profile.damage, ship.damage, value => number(value), false],
        ['Range', profile.range, ship.range, value => `${number(value)} fm`, false],
        ['Reload', profile.reload, ship.reloadMax, value => `${Number(value || 0).toFixed(1)}s`, true],
        ['Crew berths', profile.crewCap, ship.crewCap, value => number(value), false],
        ['Hull protection', 1 - (profile.armor ?? 1), 1 - (ship.armor ?? 1), value => `${Math.round(value * 100)}%`, false],
      ];
      const stats = specs.map(([label,value,current,format,lowerBetter]) => {
        const delta = Number(value || 0) - Number(current || 0);
        const better = lowerBetter ? delta < 0 : delta > 0;
        const change = Math.abs(delta) > .01 ? `<span class="spec-change${better ? ' better' : ' worse'}" title="Compared with your current upgraded ship">${delta > 0 ? '↑' : '↓'}</span>` : '<span class="spec-change">=</span>';
        return `<div><small>${label}</small><strong>${esc(format(value || 0))}${change}</strong></div>`;
      }).join('');
      return `<article class="selected-ship-profile"><div class="profile-heading"><div><span class="eyebrow">${esc(profile.role || 'FLAGSHIP')}${profile.weapon === 'mortar' ? ' · MORTAR BATTERY' : ''}</span><h3>${esc(title)}</h3></div>${this.shipGlyph(item.id)}</div><div class="ship-specs">${stats}</div><div class="ship-tradeoffs"><p><strong>Strength</strong> ${esc(profile.strength || 'A capable vessel for your fleet.')}</p><p><strong>Trade-off</strong> ${esc(profile.weakness || 'Requires a healthy crew to reach its potential.')}</p></div><div class="profile-purchase"><div><strong>${number(item.cost)}</strong><small> GOLD</small><span>${esc(purchaseStatus)}</span></div>${button(affordable ? 'Add to fleet' : 'Need gold', 'buy', item.id, affordable ? 'gold-button' : '', !affordable, `buy-${item.id}`)}</div><p class="profile-note">Projected new escort stats. Arrows compare with your active flagship.</p></article>`;
    }

    crewView(S) {
      const alive = ownCrew(S.player);
      const plan = S.crewPlan || {};
      const assigned = ['gunners','rowers','repairers','boarders'].reduce((sum, role) => sum + (Number(plan[role]) || 0), 0);
      const available = Math.max(0, alive.length - (alive.some(member => member.isCaptain) ? 1 : 0));
      const reserve = Number(plan.boarders) || 0;
      const caps = { gunners: (S.player.cannons || 4) * 2, rowers: 10, repairers: 12, boarders: 99 };
      const roles = [
        ['gunners','Gunners','Keep your broadsides loaded and ready.'],
        ['rowers','Rowers','Gain speed for a chase or a quick escape.'],
        ['repairers','Repairers','Restore damaged hull while the deck is secure.'],
        ['boarders','Boarders','Prepare a boarding party to seize enemy decks.'],
      ];
      const rows = roles.map(([role, title, description]) => `<div class="allocation-row"><div><h3>${title}</h3><p>${description}</p></div><div class="allocation-stepper">${button('−', 'allocate', { role, delta: -1 }, '', !(plan[role] > 0) || role === 'boarders', `${role}-minus`)}<strong aria-label="${esc(title)} assigned">${number(plan[role])}</strong>${button('+', 'allocate', { role, delta: 1 }, '', (plan[role] || 0) >= Math.min(available, caps[role]), `${role}-plus`)}</div></div>`).join('');
      const allies = (S.ships || []).filter(ship => ship.team === 'ally' && ship.hp > 0 && !ship.sinking);
      const fleetOrders = `<div class="fleet-buttons owned-fleet-orders">${button('Follow flagship', 'fleet', 'follow', '', !allies.length, 'fleet-follow')}${button('Defend flagship', 'fleet', 'defend', '', !allies.length, 'fleet-defend')}${button('Attack enemies', 'fleet', 'attack', '', !allies.length, 'fleet-attack')}</div>`;
      const presets = ['battle','pursuit','repair'].map(preset => button(preset.charAt(0).toUpperCase() + preset.slice(1), 'preset', preset, S.command === preset ? 'active' : '', false, `preset-${preset}`)).join('');
      return `${this.head('YOUR SHIPS · YOUR COMMAND', 'Crew & fleet', 'Purchased ships and captured prizes remain in your fleet.')}${this.ownedFleetView(S)}${fleetOrders}<section class="active-flagship-crew"><h3 class="modal-section-title">ACTIVE FLAGSHIP CREW · ${esc(S.player.name || 'Your ship')}</h3><div class="crew-summary"><div><strong>${alive.length}</strong><span>LIVING CREW</span></div><div><strong>${assigned - reserve}</strong><span>ON STATIONS</span></div><div><strong>${reserve}</strong><span>BOARDING RESERVE</span></div><div><strong>${allies.length}</strong><span>ESCORTS</span></div></div><div class="preset-row">${presets}</div>${rows}<p class="modal-note" style="margin-top:12px">Adding a station transfers a sailor from another role. Reducing a station returns a sailor to the boarding reserve.</p></section><div class="modal-footer"><span>Each ship keeps its own hull and crew. Refits affect the active flagship.</span>${button('Return to command', 'close', undefined, 'gold-button', false, 'close-footer')}</div>`;
    }

    prizeView(S) {
      const prize = S.prize;
      const title = prize?.name || 'A ship under your flag';
      return `${this.head('THEIR COLORS HAVE FALLEN', title, 'Your boarding party has secured the prize. Decide its fate.', false)}<div class="prize-options">${button('<span class="prize-symbol">⚑</span><h3>Keep as escort</h3><p>Add the vessel to your fleet. It will follow and fight under your command.</p><span>GROW YOUR FLEET →</span>', 'prize', 'escort', 'prize-choice', false, 'prize-escort')}${button('<span class="prize-symbol">◇</span><h3>Salvage the ship</h3><p>Take its valuables and sell the hull. Turn your victory into immediate gold.</p><span>CLAIM THE DOUBLOONS →</span>', 'prize', 'salvage', 'prize-choice', false, 'prize-salvage')}${button('<span class="prize-symbol">♧</span><h3>Recruit survivors</h3><p>Offer the surviving sailors a place aboard your ship and replenish your crew.</p><span>STRENGTHEN YOUR CREW →</span>', 'prize', 'recruit', 'prize-choice', false, 'prize-recruit')}</div><div class="modal-footer"><span>A prize can be claimed once. Your own boarders return safely.</span></div>`;
    }

    resultView(S, won) {
      const stats = S.stats || {};
      const accuracy = stats.shots ? Math.round((stats.hits || 0) / stats.shots * 100) : 0;
      const cards = [
        [stats.sunk || 0, 'SHIPS SUNK'],[stats.captured || 0, 'PRIZES CLAIMED'],[number(stats.goldEarned || 0), 'GOLD EARNED'],
        [Array.isArray(S.visitedPorts) ? S.visitedPorts.length : stats.portsVisited || 0, 'HARBORS VISITED'],[`${accuracy}%`, 'SHOT ACCURACY'],[duration(stats.playTime), 'TIME AT SEA'],
      ].map(([value,label]) => `<div class="result-stat"><strong>${esc(value)}</strong><span>${label}</span></div>`).join('');
      const reason = S.endDescription || 'Your voyage ends here, but the sea always offers another beginning.';
      return `<div class="result-layout"><div class="result-seal">${won ? '♔' : '⚑'}</div><span class="eyebrow">${won ? 'THE LEGEND IS YOURS' : 'A CAPTAIN’S LAST CHAPTER'}</span><h2>${esc(S.endTitle || (won ? 'Crown of the Tides' : 'Lost to the sea'))}</h2><p>${won ? 'The rival fleet has fallen. Your colors fly over the archipelago, and your name belongs to the tides.' : esc(reason)}</p><div class="result-stats">${cards}</div><div class="result-actions">${won ? button('Continue exploring', 'resume', undefined, '', false, 'resume') : ''}${button('Begin a new voyage', 'restart', undefined, 'gold-button', false, 'restart')}</div></div>`;
    }

    drawChart(canvas, S, full) {
      if (!canvas || canvas.clientWidth < 1 || canvas.clientHeight < 1) return;
      if (this.game.renderer?.drawChart) {
        this.game.renderer.drawChart(canvas, S, full);
        return;
      }
      // Standalone fallback keeps the interface usable if a chart renderer is unavailable.
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#123e48'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(185,214,199,.07)'; ctx.lineWidth = 1;
      for (let x = 0; x < width; x += width / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y < height; y += height / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      for (const island of S.islands || []) {
        if (!island.discovered) continue;
        ctx.beginPath(); ctx.arc(island.x / S.w * width, island.y / S.h * height, Math.max(2, island.r / S.w * width), 0, Math.PI * 2);
        ctx.fillStyle = island.port ? '#dfca8a' : '#7baf88'; ctx.fill();
      }
      if (S.waypoint) {
        ctx.strokeStyle = '#ecc575'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(S.player.x / S.w * width, S.player.y / S.h * height); ctx.lineTo(S.waypoint.x / S.w * width, S.waypoint.y / S.h * height); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(S.waypoint.x / S.w * width, S.waypoint.y / S.h * height, 4, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save(); ctx.translate(S.player.x / S.w * width, S.player.y / S.h * height); ctx.rotate(S.player.a);
      ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,-3); ctx.lineTo(-2,0); ctx.lineTo(-4,3); ctx.closePath(); ctx.fill(); ctx.restore();
      canvas.dataset.mapX = '0'; canvas.dataset.mapY = '0'; canvas.dataset.mapW = String(width); canvas.dataset.mapH = String(height);
    }
  }
  window.PirateUI = PirateUI;
})();
