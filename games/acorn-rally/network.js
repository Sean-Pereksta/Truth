'use strict';
(() => {
  function createInputScheduler({ getTransport, write, now = () => performance.now(),
    schedule = setTimeout, cancel = clearTimeout }) {
    const intervalMs = 34, edgeIntervalMs = 17, keepAliveMs = 220, actionLifetimeMs = 700;
    const same = (a, b) => b && a.steer === b.steer && a.gas === b.gas && a.brake === b.brake &&
      a.drift === b.drift && a.item === b.item && a.ability === b.ability && a.lookBack === b.lookBack;
    const axis = (value, minimum = 0) => Math.round(Math.max(minimum, Math.min(1, Number(value) || 0)) * 100) / 100;
    let latest, sent, sentAt = -Infinity, retryAt = -Infinity, pendingItem, pendingAbility;
    let timer = null, timerAt = Infinity, httpPending = 0, generation = 0;

    function clearTimer() {
      if (timer !== null) cancel(timer);
      timer = null;
      timerAt = Infinity;
    }
    function arm(due) {
      if (timerAt <= due) return;
      clearTimer();
      timerAt = due;
      timer = schedule(() => {
        timer = null;
        timerAt = Infinity;
        flush();
      }, Math.max(0, Math.ceil(due - now())));
    }
    function reset() {
      clearTimer();
      generation++;
      latest = sent = pendingItem = pendingAbility = undefined;
      sentAt = retryAt = -Infinity;
      httpPending = 0;
    }
    function pause() {
      clearTimer();
      sent = undefined;
    }
    function flush() {
      const transport = getTransport();
      if (!transport || !latest) { clearTimer(); return; }
      const timestamp = now();
      if (pendingItem && timestamp - pendingItem.at >= actionLifetimeMs) pendingItem = undefined;
      if (pendingAbility && timestamp - pendingAbility.at >= actionLifetimeMs) pendingAbility = undefined;
      const packet = { ...latest, item: latest.item || Boolean(pendingItem), ability: latest.ability || Boolean(pendingAbility) };
      const changed = !same(packet, sent);
      const socket = transport === 'websocket';
      const edge = sent && (packet.item !== sent.item || packet.ability !== sent.ability ||
        (packet.brake === 0) !== (sent.brake === 0));
      const interval = socket && edge ? edgeIntervalMs : intervalMs;
      const due = Math.max(retryAt, sentAt + (changed ? interval : keepAliveMs));
      if (timestamp < due) { arm(due); return; }
      if (!socket && httpPending >= 2) { clearTimer(); return; }

      clearTimer();
      const item = pendingItem, ability = pendingAbility, version = generation;
      const delivered = write(packet, transport);
      if (delivered === false) {
        retryAt = timestamp + intervalMs;
        arm(retryAt);
        return;
      }
      sent = packet;
      sentAt = timestamp;
      function acknowledge() {
        if (pendingItem === item) pendingItem = undefined;
        if (pendingAbility === ability) pendingAbility = undefined;
      }
      if (socket) {
        acknowledge();
      } else {
        httpPending++;
        const settle = accepted => {
          if (version !== generation) return;
          httpPending--;
          // Repeat unacknowledged edges on newer HTTP inputs. The host can
          // see newer sequence numbers first when its requests are in flight.
          if (accepted) acknowledge();
          else if (sent === packet) sent = undefined;
          flush();
        };
        delivered.then(settle, () => settle(false));
      }
      // Follow a short tap with its release, even without another frame.
      const released = socket && !same(packet, latest);
      arm(timestamp + (released ? edgeIntervalMs : keepAliveMs));
    }
    function submit(input) {
      const item = Boolean(input.item), ability = Boolean(input.ability);
      if (item && !latest?.item) pendingItem = { at: now() };
      if (ability && !latest?.ability) pendingAbility = { at: now() };
      latest = { steer: axis(input.steer, -1), gas: axis(input.gas), brake: axis(input.brake),
        drift: Boolean(input.drift), item, ability, lookBack: Boolean(input.lookBack) };
      flush();
    }
    return { submit, wake: flush, pause, reset };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { createInputScheduler };
    return;
  }

  const drivers = window.RallyData.drivers;
  const tracks = window.RallyData.tracks;
  const roomPattern = /^[A-Z2-9]{5}$/;
  const storageKey = 'acorn-rally-room-v1';
  const queueStorageKey = 'acorn-rally-queue-v1';
  const playerNameStorageKey = 'acorn-rally-player-name';
  const serverCodeStorageKey = 'acorn-rally-server-code';
  const serverCodePattern = /^[0-9]{4}$/;
  const maxPlayerName = 22;
  const queuePollMs = 2500;
  const cleanCode = value => String(value || '').trim().toUpperCase();
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + window.RallyData.icons[name] + '</svg>';
  let active = null;

  function stored() {
    try { return JSON.parse(sessionStorage.getItem(storageKey)); } catch { return null; }
  }
  function remember(value) {
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Storage may be disabled in private browsing. */ }
  }
  function storedQueueToken() {
    try {
      const token = sessionStorage.getItem(queueStorageKey);
      return /^[a-f0-9]{64}$/.test(token || '') ? token : '';
    } catch { return ''; }
  }
  function rememberQueueToken(token) {
    try {
      if (token) sessionStorage.setItem(queueStorageKey, token);
      else sessionStorage.removeItem(queueStorageKey);
    } catch { /* The current tab can still queue without storage. */ }
  }
  function storedPlayerName() {
    try { return (sessionStorage.getItem(playerNameStorageKey) || '').slice(0, maxPlayerName); }
    catch { return ''; }
  }
  function rememberPlayerName(name) {
    try { sessionStorage.setItem(playerNameStorageKey, name); }
    catch { /* The name is still available while this page stays open. */ }
  }
  function createQueueToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function saveServerCode(code) {
    try {
      if (code) sessionStorage.setItem(serverCodeStorageKey, code);
      else sessionStorage.removeItem(serverCodeStorageKey);
    } catch { /* The code is still available for this page. */ }
  }
  function readJoinLink() {
    const url = new URL(location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    const autoJoin = params.get('join') === '1';
    const code = params.get('code');
    const name = autoJoin ? params.get('name') : null;
    if (params.has('join') || params.has('name') || code !== null) {
      for (const field of ['join', 'name', 'code']) params.delete(field);
      url.hash = params.toString();
      try { history.replaceState(null, '', url); }
      catch { /* Some browsers restrict replacing history. */ }
    }
    return { autoJoin, code, name };
  }
  function readServerCode(fragmentCode) {
    if (fragmentCode !== null) {
      const code = serverCodePattern.test(fragmentCode) ? fragmentCode : '';
      saveServerCode(code);
      return code;
    }
    try {
      const code = sessionStorage.getItem(serverCodeStorageKey) || '';
      return serverCodePattern.test(code) ? code : '';
    } catch { return ''; }
  }
  function urlCode(value) {
    try {
      const url = new URL(location.href);
      if (value) url.searchParams.set('room', value); else url.searchParams.delete('room');
      history.replaceState(null, '', url);
    } catch { /* File previews can restrict history changes. */ }
  }
  async function request(url, body, token, controller = new AbortController()) {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const resp = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body),
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!resp.headers.get('content-type')?.includes('application/json')) throw Error('This copy of the game needs a PC host for private rooms.');
      const value = await resp.json();
      if (!resp.ok) {
        const error = new Error(value.error || 'The room host was unavailable.');
        error.status = resp.status;
        throw error;
      }
      return value;
    } catch (err) {
      if (err.name === 'AbortError') throw Error('The host took too long to answer. Check its address and try again.');
      throw err;
    } finally { clearTimeout(timeout); }
  }

  function open(opts) {
    if (active?.room) { active.showLobby(); return; }
    if (active?.isQueued()) { active.showQueue(); return; }
    if (active) active.destroy();
    const container = opts.container;
    const context = { room: null, destroy, showLobby, showQueue: setup, isQueued: () => Boolean(queueToken) };
    active = context;
    const root = document.createElement('section');
    root.className = 'rr-room';
    container.replaceChildren(root);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const staticPages = location.hostname === 'sean-pereksta.github.io' && location.pathname.startsWith('/Truth/games/acorn-rally/');
    const gridClient = createQueueToken().slice(0, 16);
    let seat = -1, key = '', source = null, support = staticPages || location.protocol === 'file:' ? false : null;
    let inRace = false, playedRound = -1, snapshot = null, snapTick = -1, lastRoomRound = -1;
    const motionSnapshots = [];
    let gridReportTimer = 0;
    let seq = Date.now() * 8;
    let busy = false, connecting = false, disconnected = false;
    let telemetryTimer = 0, telemetryPending = false;
    const connection = { rtt: null, jitter: null, lastSnapshot: null, expected: 0, skipped: 0, fps: null };
    let queueToken = '', queueTimer = 0, playerName = storedPlayerName(), serverCode = '';
    let discoveryCleanup, liveJoin = opts.liveJoin === true;
    let statusText = '', statusError = false, connectionNote = null;
    const getRoom = () => context.room;
    const target = action => '/api/rooms/' + getRoom().code + '/' + action;
    const inputScheduler = createInputScheduler({
      getTransport: () => active === context && inRace && !disconnected && getRoom()?.phase === 'racing'
        ? source?.transport : null,
      write(input, transport) {
        if (transport === 'websocket' && !source.canSend()) return false;
        const payload = { round: getRoom().round, seq: ++seq, input };
        if (transport === 'websocket') return source.send('input', payload);
        return request(target('input'), payload, key).then(result => result.accepted === true);
      }
    });
    const field = name => root.querySelector('[name="' + name + '"]');
    const dialog = container.closest('dialog');
    let dialogGuard = false;
    function onCancel(event) { if (!inRace) { event.preventDefault(); void leave(); } }
    if (dialog) { dialog.addEventListener('cancel', onCancel); dialogGuard = true; }
    function top(title, code) {
      return '<header class="rr-head"><p>' + icon('globe') + ' MULTIPLAYER</p><button type="button" class="rr-x" data-rr="close" aria-label="' + (support?.queueEnabled ? 'Close race queue' : 'Close private rooms') + '">' + icon('close') + '</button><h2>' + title + '</h2>' + (code || '') + '</header>';
    }
    function status(message, error = false) {
      statusText = message; statusError = error;
      const box = root.querySelector('.rr-status');
      if (box) { box.textContent = message; box.classList.toggle('rr-error', error); }
    }
    function statusBox() { return '<p role="status" class="rr-status' + (statusError ? ' rr-error' : '') + '">' + escape(statusText) + '</p>'; }
    function attach() {
      if (!root.isConnected) container.replaceChildren(root);
      if (dialog && !dialog.open) dialog.showModal();
    }
    function shareLinks(links, label) {
      return links.map((link, i) => {
        const name = links.length > 1 ? label + ' ' + (i + 1) : label;
        return '<div class="rr-share-link"><input aria-label="' + name + '" type="text" readonly value="' +
          escape(link) + '"><button type="button" class="rr-secondary" data-rr="copy" aria-label="Copy ' +
          name.toLowerCase() + '">Copy link</button></div>';
      }).join('');
    }
    function phoneSetup() {
      if (!localHost) return '';
      const addresses = support.addresses || [];
      const instructions = support.queueEnabled ? 'On each phone, tap Join race queue.'
        : support.singleRoom ? 'On each phone, tap Join lobby.' : 'One phone creates a room and shares its invite.';
      const details = addresses.length
        ? '<p>Open a phone lobby address in each phone’s browser on the same Wi-Fi as this computer. ' + instructions + '</p>' +
          shareLinks(addresses.map(address => new URL('/?room=join', address).href), 'Phone lobby address')
        : '<p>Connect this computer to your local network and reopen Private Rooms to see its phone lobby address.</p>';
      return '<section class="rr-callout"><h3>Play on phones</h3>' + details + '</section>';
    }
    function setup() {
      if (active !== context) return;
      attach();
      unmountDiscovery();
      const invite = cleanCode(new URLSearchParams(location.search).get('room'));
      const code = roomPattern.test(invite) ? invite : '';
      const listing = '<section data-community-servers></section>';
      if (support === null) {
        root.innerHTML = top('PRIVATE ROOMS') + '<p class="rr-explain">Connecting to the race host…</p>' + statusBox();
      } else if (!support) {
        root.innerHTML = top('PRIVATE ROOMS') + listing + '<div class="rr-callout"><strong>Host a race on your PC</strong><p>Download the PC edition and run <b>Start Acorn Rally</b>. Phones on the same Wi-Fi can open the host address and create or join a room in their browsers.</p><a class="rr-primary" href="?download=pc">' + icon('download') + 'Download PC edition</a></div>' +
          '<form data-form="remote"><h3>Join a host</h3><label>Host address or invite link<input name="remote" inputmode="url" autocapitalize="none" placeholder="http://192.168.1.20:8791" required spellcheck="false" autocomplete="off"></label><button type="submit" class="rr-secondary">Open host ' + icon('arrow') + '</button></form>' + statusBox();
      } else if (support.queueEnabled) {
        const codeField = support.visibility === 'code'
          ? '<label>Server code<input name="serverCode" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required value="' + escape(serverCode) + '"></label>'
          : '';
        const queuePanel = queueToken
          ? '<div class="rr-callout"><strong>Waiting for a seat</strong><p>Keep this tab open. Seats open as each race ends.</p><button type="button" class="rr-secondary" data-rr="queue-leave">Leave queue</button></div>'
          : '<div class="rr-callout"><strong>Race with other players</strong><p>Seats are offered in queue order. Every race closes its room so the next group can join.</p>' +
            '<form data-form="queue"><label>Player name (optional)<input name="playerName" type="text" maxlength="' + maxPlayerName + '" autocomplete="nickname" value="' +
            escape(playerName) + '"></label>' + codeField + '<button type="submit" class="rr-primary">' + icon('flag') + 'Join race queue</button></form></div>';
        root.innerHTML = top('RACE QUEUE') + (queueToken ? '' : phoneSetup()) + queuePanel + statusBox() + (queueToken ? '' : listing);
      } else {
        const create = support.singleRoom
          ? '<div class="rr-callout"><strong>Acorn Rally lobby</strong><p>The first player picks the race. Up to eight players can join.</p><button type="button" class="rr-primary" data-rr="enter">' + icon('flag') + 'Join lobby</button></div>'
          : '<div class="rr-callout"><strong>Start a private race</strong><p>Invite up to seven friends and fill the remaining grid with AI racers.</p><button type="button" class="rr-primary" data-rr="create">' + icon('flag') + 'Create room</button></div>';
        const join = '<form data-form="join"><h3>' + (code ? 'Join race ' + code : 'Join a room') +
          '</h3><label>Room code<input class="rr-input-code" name="code" value="' + code +
          '" placeholder="ABCDE" minlength="5" maxlength="5" required autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
          '<div class="rr-code-actions"><button type="submit" class="' + (code ? 'rr-primary' : 'rr-secondary') +
          '">Join room ' + icon('arrow') + '</button><button type="button" class="rr-text" data-rr="keypad" aria-expanded="false">' +
          icon('gamepad') + 'Code keypad</button></div><div class="rr-keypad" hidden></div></form>';
        root.innerHTML = top('PRIVATE ROOMS') + phoneSetup() +
          (code ? join + create : create + (support.singleRoom ? '' : join)) + statusBox() + listing;
      }
      const panel = root.querySelector('[data-community-servers]');
      if (panel && window.AcornCommunityServers) {
        discoveryCleanup = window.AcornCommunityServers.mount(panel, { liveJoin });
        liveJoin = false;
      }
    }
    function unmountDiscovery() {
      if (typeof discoveryCleanup === 'function') discoveryCleanup();
      discoveryCleanup = null;
    }
    function queueOptions() {
      return { trackIndex: opts.trackIndex, driverIndex: opts.driverIndex, cc: opts.cc, difficulty: opts.difficulty, botFill: true };
    }
    function stopQueue(cancel) {
      clearTimeout(queueTimer);
      const token = queueToken;
      queueToken = '';
      if (!token) return;
      rememberQueueToken('');
      if (cancel) void request('/api/rooms/queue/leave', { token }).catch(() => {});
    }
    function startQueue(token = createQueueToken()) {
      if (queueToken || !support?.queueEnabled || getRoom()) return;
      if (support.visibility === 'code' && !serverCodePattern.test(serverCode)) {
        status('Enter the four-digit server code.', true);
        return;
      }
      queueToken = token;
      rememberQueueToken(token);
      urlCode('join');
      status('Joining the race queue…');
      setup();
      root.querySelector('[data-rr="queue-leave"]')?.focus();
      void pollQueue(token);
      opts.preloadRaceGraphics?.();
    }
    async function pollQueue(token) {
      try {
        const code = support.visibility === 'code' ? serverCode : undefined;
        const value = await request('/api/rooms/queue', { token, code, name: playerName.trim(), ...queueOptions() });
        if (active !== context || token !== queueToken) {
          const admission = value.admission;
          if (admission) void request('/api/rooms/' + admission.room.code + '/leave', {}, admission.token).catch(() => {});
          return;
        }
        if (value.admission) {
          stopQueue(false);
          connect(value.admission);
          return;
        }
        const message = value.phase === 'racing' ? 'A race is underway. ' : '';
        const position = message + 'Queue position ' + value.position + ' of ' + value.waiting + '.';
        if (statusText !== position || statusError) status(position);
      } catch (error) {
        if (active !== context || token !== queueToken) return;
        if (support.visibility === 'code' && [401, 403].includes(error.status)) {
          stopQueue(true);
          serverCode = '';
          saveServerCode('');
          status(error.message, true);
          setup();
          field('serverCode')?.focus();
          return;
        }
        status(error.message + ' Retrying…', true);
      }
      if (active === context && token === queueToken) queueTimer = setTimeout(() => pollQueue(token), queuePollMs);
    }
    function optionList(data, selected) {
      return data.map((entry, i) => '<option value="' + i + '"' + (i === selected ? ' selected' : '') +
        '>' + escape(entry.name) + '</option>').join('');
    }
    function showLobby() {
      if (active !== context || !getRoom()) return;
      unmountDiscovery();
      if (inRace && ['loading', 'racing'].includes(getRoom().phase))
        void request(target('control'), { driving: false }, key).catch(() => {});
      inRace = false; connectionNote?.remove(); connectionNote = null; attach();
      const focused = root.contains(document.activeElement) ? document.activeElement : null;
      const refocus = focused?.dataset.driverId !== undefined ? '[data-driver-id="' + focused.dataset.driverId + '"]' : focused?.name ? '[name="' + focused.name + '"]' :
        focused?.dataset.rr ? '[data-rr="' + focused.dataset.rr + '"]' : null;
      const room = getRoom(), me = room.seats.find(s => s.index === seat);
      if (!me) return;
      const owner = seat === room.host, preparing = room.phase === 'loading', locked = preparing || room.phase === 'racing';
      const reserved = new Set(room.seats.filter(s => s.index !== seat).map(s => s.driverIndex));
      const portraits = drivers.map((driver,i) => {
        if(!window.AcornChampionship.isDriverAvailable(i))
          return '<button type="button" class="rr-pick" disabled title="'+escape(window.AcornChampionship.rewardRequirement(i))+'"><img src="art/driver-'+i+'.webp" alt=""><b>'+escape(driver.name)+'</b><small>Locked</small></button>';
        const taken=reserved.has(i), selected=me.driverIndex===i;
        return '<button type="button" class="rr-pick" data-rr="pick" data-driver-id="'+i+'" aria-pressed="'+selected+'" aria-label="'+escape(driver.name+' the '+driver.species.toLowerCase()+(taken?' · Taken':''))+'" '+(locked||taken?'disabled':'')+'><img src="art/driver-'+i+'.webp" alt=""><b>'+escape(driver.name)+'</b>'+(selected?'<span>✓</span>':'')+'</button>';
      }).join('');
      const canStart = support.queueEnabled || room.seats.every(s => s.connected && (s.ready || s.index === room.host));
      const track = tracks[room.trackIndex];
      const grid = room.seats.map(s => '<li><img src="art/driver-' + s.driverIndex + '.webp" alt=""><span><strong>' + escape(s.name) +
        (s.index === seat ? ' <small>YOU</small>' : '') + '</strong><em>' + escape(drivers[s.driverIndex].species) + '</em></span><b class="' +
        (s.connected && (s.ready || s.index === room.host) ? 'rr-ready' : '') + '">' +
        (preparing ? ({ ready: 'Grid ready', loading: 'Loading course', reconnecting: 'Reconnecting', reserve: 'Rejoining' })[s.loadState] :
          !s.connected ? 'Reconnecting' : s.index === room.host ? 'Host' : s.ready ? 'Ready' : 'In garage') + '</b></li>').join('');
      const cc=window.AcornSim.normalizeCC(room.cc), difficulty=window.AcornSim.normalizeDifficulty(room.difficulty);
      const sharedSelect=(name,label,values,current,toLabel)=>'<label>'+label+'<select name="'+name+'"'+(locked?' disabled':'')+'>'+values.map(v=>'<option value="'+v+'"'+(current===v?' selected':'')+'>'+toLabel(v)+'</option>').join('')+'</select></label>';
      const skillLabel=value=>value[0].toUpperCase()+value.slice(1);
      const hostControls = owner ? '<label>Course<select name="track"' + (locked ? ' disabled' : '') + '>' + optionList(tracks, room.trackIndex) + '</select></label>' +
        sharedSelect('cc','Engine class',window.AcornSim.engineClasses,cc,v=>v+' cc')+sharedSelect('difficulty','AI difficulty',window.AcornSim.difficulties,difficulty,skillLabel)+
        '<label class="rr-toggle"><input name="fill" type="checkbox"' + (room.botFill ? ' checked' : '') + (locked ? ' disabled' : '') + '>Fill empty seats with AI</label>' :
        '<p class="rr-track-readout">' + icon('track') + escape(track.name) + ' · ' + room.laps + ' laps · '+cc+' cc · '+skillLabel(difficulty)+' AI</p>';
      const action = preparing ? '<button class="rr-primary" data-rr="rejoin">Return to starting grid ' + icon('arrow') + '</button>' :
        locked ? '<button class="rr-primary" data-rr="rejoin">Return to race ' + icon('arrow') + '</button>' :
        owner ? '<button class="rr-primary" data-rr="start"' + (!canStart ? ' disabled' : '') + '>' + icon('flag') + (room.phase === 'finished' ? 'Start rematch' : 'Start race') + '</button>' :
          '<button class="' + (me.ready ? 'rr-secondary' : 'rr-primary') + '" data-rr="ready">' + (me.ready ? 'Cancel ready' : 'Ready to race') + '</button>';
      const invite = new URL(location.href);
      invite.search = '?room=' + (support.queueEnabled ? 'join' : room.code);
      invite.hash = '';
      const invitePaths = localHost && support.addresses?.length ? support.addresses.map(address => {
        const localInvite = new URL(invite);
        localInvite.host = new URL(address).host;
        return localInvite.href;
      }) : [invite.href];
      const inviteHeading = support.queueEnabled ? '<span>SHARE QUEUE</span>' : '<span>INVITE CODE<b>' + escape(room.code) + '</b></span>';
      root.innerHTML = top('RACE ROOM') + '<div class="rr-invite">' + inviteHeading +
        shareLinks(invitePaths, support.queueEnabled ? 'Race queue link' : 'Race invite') + '</div>' +
        '<div class="rr-lobby-cols"><div><h3>Starting grid <small>' + room.seats.length + ' / 8</small></h3><ul class="rr-seats">' + grid + '</ul></div>' +
        '<div class="rr-lobby-config">' + hostControls + '</div></div><section class="rr-characters"><h3>Choose your driver</h3><div class="rr-grid-picks">' + portraits + '</div></section>' +
        '<div class="rr-actions">' + action + '<button class="rr-text" data-rr="close">Leave room</button></div>' + statusBox();
      if (refocus) root.querySelector(refocus)?.focus({ preventScroll: true });
    }
    function connectedNote(show) {
      if (!show) { connectionNote?.remove(); connectionNote = null; return; }
      if (!inRace || connectionNote) return;
      connectionNote = document.createElement('div'); connectionNote.className = 'rr-connection';
      connectionNote.textContent = 'Reconnecting to race host…'; document.body.append(connectionNote);
    }
    function receiveRoom(room) {
      if (active !== context) return;
      const prior = getRoom();
      if (room.round !== lastRoomRound) {
        snapshot = null; snapTick = -1; lastRoomRound = room.round;
        motionSnapshots.length = 0;
        connection.lastSnapshot = null; connection.expected = 0; connection.skipped = 0;
      }
      context.room = room;
      if (room.startNotice && room.startNotice !== prior?.startNotice) {
        status(room.startNotice, true);
        if (inRace && room.phase === 'lobby') {
          inRace = false;
          inputScheduler.reset();
          snapshot = null;
          snapTick = -1;
          motionSnapshots.length = 0;
          connection.lastSnapshot = null; connection.expected = 0; connection.skipped = 0;
          clearTimeout(gridReportTimer);
          opts.onStartCancelled?.();
        }
      }
      inputScheduler.wake();
      if (!inRace) showLobby();
    }
    function reportGridReady(round, loadMs) {
      const room = getRoom();
      if (active !== context || !inRace || room?.round !== round || room.phase !== 'loading' ||
          room.seats.find(s => s.index === seat)?.loadState === 'reserve') return;
      void request(target('loaded'), { round, grid: gridClient, loadMs }, key).catch(() => {
        if (active !== context || !inRace || getRoom()?.round !== round || getRoom().phase !== 'loading') return;
        gridReportTimer = setTimeout(() => reportGridReady(round, loadMs), 600);
      });
    }
    function beginRace(force = false, terminal = false) {
      const room = getRoom();
      if (!snapshot || !room || (!terminal && room.phase !== 'racing' && room.phase !== 'loading') ||
          (!force && playedRound === room.round)) return;
      const me = room.seats.find(s => s.index === seat);
      if (!me) return;
      playedRound = room.round; inRace = true;
      inputScheduler.reset();
      const raceSeat = me.kartIndex;
      if (!terminal) void request(target('control'), { driving: true }, key).catch(() => {});
      const startedLoading = performance.now();
      const network = { seat: raceSeat, sendInput, getState: () => snapshot, returnToLobby, leave,
        getMotionSnapshots: () => motionSnapshots,
        gridStatus: () => getRoom()?.round === room.round ? getRoom().loading : null,
        gridReady: () => reportGridReady(room.round, Math.round(performance.now() - startedLoading)),
        queueMode: support.queueEnabled === true, isConnected: () => !disconnected, reportFps };
      if (dialog?.open) dialog.close();
      opts.startRace({ trackIndex: room.trackIndex, driverIndex: me.driverIndex,
        driverIndices: snapshot.racers.map(r => r.driverIndex),
        mode: 'single', laps: room.laps, cc: room.cc, difficulty: room.difficulty, players: 1, settings: opts.settings, network });
    }
    function sendInput(input) {
      if (!input || !inRace || active !== context) return;
      inputScheduler.submit(input);
    }
    function clearRoom() {
      source?.close();
      source = null;
      inputScheduler.reset();
      clearInterval(telemetryTimer);
      clearTimeout(gridReportTimer);
      connectedNote(false);
      remember(null);
      urlCode(null);
      context.room = null;
      key = '';
      inRace = false;
    }
    function returnToLobby() {
      if (!support.queueEnabled || !getRoom() || !inRace) { showLobby(); return; }
      void request(target('leave'), {}, key).catch(() => {});
      clearRoom();
      status('You left the race. Join the queue for another.');
      setup();
      attach();
    }
    function retireRoom() {
      if (active !== context) return;
      const racing = inRace;
      clearRoom();
      if (racing) {
        destroy();
        opts.onRetired?.(snapshot?.done === true);
      } else {
        status(support.queueEnabled ? 'This room has closed. Join the queue for another race.' : 'This room has closed.');
        setup();
      }
    }
    function markConnected() {
      const reconnecting = disconnected;
      disconnected = false; connectedNote(false);
      if (statusText === 'Reconnecting to the host…') status('');
      if (reconnecting) inputScheduler.wake();
    }
    function markDisconnected() {
      disconnected = true; connectedNote(true); status('Reconnecting to the host…');
      inputScheduler.pause();
    }
    function receiveSnapshot(data, terminal = false) {
      const room = getRoom();
      if (!room || data.round !== room.round || room.phase === 'lobby' || data.tick <= snapTick) return;
      if (snapTick >= 0) {
        const interval = data.intervalTicks || 3;
        const steps = Math.max(1, Math.floor(data.tick / interval) - Math.floor(snapTick / interval));
        connection.expected += steps;
        connection.skipped += steps - 1;
      }
      connection.lastSnapshot = performance.now();
      snapshot = data.state; snapTick = data.tick;
      motionSnapshots.push({ tick: snapTick, receivedAt: connection.lastSnapshot, state: snapshot });
      if (motionSnapshots.length > 12) motionSnapshots.shift();
      beginRace(false, terminal && snapshot.done);
    }
    function reportFps(fps) { connection.fps = fps; }
    function recordRtt(rtt) {
      if (connection.rtt !== null) {
        const change = Math.abs(rtt - connection.rtt);
        connection.jitter = (connection.jitter ?? change) * .75 + change * .25;
      }
      connection.rtt = rtt;
    }
    function connectionMetrics(transport) {
      return { transport, rttMs: connection.rtt, jitterMs: connection.jitter, fps: connection.fps,
        snapshotAgeMs: connection.lastSnapshot === null ? null : performance.now() - connection.lastSnapshot,
        snapshotGapPct: connection.expected ? 100 * connection.skipped / connection.expected : null };
    }
    async function reportConnection() {
      const currentSource = source;
      if (!getRoom() || !currentSource || disconnected || !support.connectionMetrics) return;
      if (currentSource.transport === 'websocket') {
        currentSource.ping();
        currentSource.send('metrics', connectionMetrics('websocket'));
        return;
      }
      if (telemetryPending) return;
      telemetryPending = true;
      const started = performance.now();
      try {
        await request('/api/rooms/version');
        if (source !== currentSource || !getRoom()) return;
        recordRtt(performance.now() - started);
        await request(target('metrics'), connectionMetrics(currentSource.transport), key);
      } catch { /* Diagnostics are independent of the game connection. */ }
      finally { telemetryPending = false; }
    }
    function subscribeSocket() {
      const address = new URL(target('socket'), location.href);
      address.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let socket;
      try { socket = new WebSocket(address); }
      catch { subscribePoll(); return; }
      let timeout;
      let pendingPing = null, lastMessage = performance.now();
      const subscription = {
        transport: 'websocket',
        canSend: () => socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 16 * 1024,
        send(type, data) {
          if (!this.canSend()) return false;
          socket.send(JSON.stringify({ ...data, type }));
          return true;
        },
        ping() {
          if (performance.now() - lastMessage > 9000) { fallback(); return; }
          const id = Math.round(performance.now());
          if (this.send('ping', { id })) pendingPing = id;
        },
        close() { clearTimeout(timeout); socket.close(); }
      };
      const current = () => active === context && source === subscription;
      function fallback() {
        if (!current()) return;
        source = null;
        subscription.close();
        markDisconnected();
        subscribePoll();
      }
      source = subscription;
      timeout = setTimeout(fallback, 2800);
      socket.onopen = () => {
        if (current()) subscription.send('hello', { token: key, grid: gridClient });
      };
      socket.onmessage = event => {
        if (!current()) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        lastMessage = performance.now();
        if (message.type === 'room') {
          clearTimeout(timeout);
          markConnected();
          receiveRoom(message.value);
        } else if (message.type === 'snapshot') {
          receiveSnapshot(message.value);
        } else if (message.type === 'retired') {
          retireRoom();
        } else if (message.type === 'pong' && pendingPing !== null && message.value?.id === pendingPing) {
          recordRtt(performance.now() - pendingPing);
          pendingPing = null;
        }
      };
      socket.onclose = fallback;
    }
    function subscribeEvents() {
      const stream = new EventSource(target('events') + '?seatKey=' + encodeURIComponent(key) + '&grid=' + gridClient);
      stream.transport = 'events';
      source = stream;
      stream.addEventListener('room', event => {
        if (source !== stream) return;
        markConnected();
        receiveRoom(JSON.parse(event.data));
      });
      stream.addEventListener('snapshot', event => {
        if (active === context && source === stream) receiveSnapshot(JSON.parse(event.data));
      });
      stream.addEventListener('retired', () => { if (source === stream) retireRoom(); });
      stream.onerror = () => {
        if (active !== context || source !== stream) return;
        if (stream.readyState === EventSource.CLOSED || (support.queueEnabled && snapshot?.done)) return retireRoom();
        markDisconnected();
      };
    }
    function subscribePoll() {
      let revision = 0, retryMs = 400, timer = 0, pending;
      const path = target('poll'), token = key;
      const subscription = { transport: 'poll', close() { clearTimeout(timer); pending?.abort(); } };
      const current = () => active === context && source === subscription;
      source = subscription;
      async function poll() {
        pending = new AbortController();
        try {
          const update = await request(path + '?after=' + revision + '&grid=' + gridClient, undefined, token, pending);
          if (!current()) return;
          markConnected();
          if (update.room) receiveRoom(update.room);
          if (update.snapshot) receiveSnapshot(update.snapshot, Boolean(update.retired));
          if (update.retired) { retireRoom(); return; }
          const advanced = Number.isSafeInteger(update.revision) && update.revision > revision;
          if (advanced) revision = update.revision;
          retryMs = 400;
          timer = setTimeout(poll, advanced ? 0 : 75);
        } catch (error) {
          if (!current()) return;
          if ([401, 403, 404, 410].includes(error.status)) { retireRoom(); return; }
          markDisconnected();
          timer = setTimeout(poll, retryMs);
          retryMs = Math.min(retryMs * 2, 2000);
        }
      }
      void poll();
    }
    function connect(value) {
      if (active !== context) return;
      inputScheduler.reset();
      seat = value.seat; key = value.token; context.room = value.room; lastRoomRound = value.room.round;
      snapshot = null; snapTick = -1; playedRound = -1;
      motionSnapshots.length = 0;
      Object.assign(connection, { rtt: null, jitter: null, lastSnapshot: null, expected: 0, skipped: 0, fps: null });
      remember({ code: value.room.code, key }); urlCode(value.room.code); status(value.assignment || '');
      showLobby();
      source?.close();
      if (support.socketTransport === true) subscribeSocket();
      else if (support.transport === 'poll') subscribePoll();
      else subscribeEvents();
      clearInterval(telemetryTimer); telemetryTimer = setInterval(reportConnection, 3000);
      opts.preloadRaceGraphics?.();
    }
    function destroy() {
      unmountDiscovery();
      stopQueue(true);
      if (dialogGuard) dialog.removeEventListener('cancel', onCancel);
      source?.close(); inputScheduler.reset(); clearInterval(telemetryTimer); clearTimeout(gridReportTimer);
      connectionNote?.remove(); root.remove();
      if (active === context) active = null;
    }
    async function leave() {
      if (connecting) return;
      connecting = true; 
      if (getRoom() && key) {
        const leaving = target('leave');
        source?.close(); void request(leaving, {}, key).catch(() => {});
      }
      destroy(); remember(null); urlCode(null); opts.onClose?.();
    }
    async function action(fn) {
      if (busy) return;
      busy = true; status('');
      try { await fn(); } catch (err) {
        status(err.message || 'Could not reach the host.', true);
        if (getRoom() && !inRace) showLobby();
      }
      finally { busy = false; }
    }
    async function copyLink(input) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(input.value);
          status('Link copied.');
          return;
        } catch { /* The link remains selectable when clipboard access is denied. */ }
      }
      input.focus();
      input.select();
      try {
        if (document.execCommand('copy')) {
          status('Link copied.');
          return;
        }
      } catch { /* The browser may allow manual copying only. */ }
      status('Copy the selected link using your browser’s copy command.');
    }
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-rr]');
      if (!button) return;
      const cmd = button.dataset.rr;
      if (cmd === 'close') return void leave();
      if (cmd === 'queue-leave') {
        stopQueue(true);
        status('You left the race queue.');
        setup();
        field('playerName')?.focus();
        return;
      }
      if (cmd === 'keypad') {
        const grid = root.querySelector('.rr-keypad');
        grid.hidden = !grid.hidden;
        button.setAttribute('aria-expanded', String(!grid.hidden));
        if (!grid.hidden) {
          grid.innerHTML = [...'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'].map(c => '<button type="button" data-rr="key" data-char="' + c + '">' + c + '</button>').join('') + '<button type="button" data-rr="backspace" aria-label="Delete last character">⌫</button>';
          grid.querySelector('button').focus();
        }
        return;
      }
      if (cmd === 'key' || cmd === 'backspace') {
        const code = field('code');
        code.value = cmd === 'key' ? (cleanCode(code.value) + button.dataset.char).slice(0, 5) : code.value.slice(0,-1);
        if (code.value.length === 5) root.querySelector('button[type="submit"]').focus();
        return;
      }
      void action(async () => {
        if (cmd === 'create' || cmd === 'enter') {
          connect(await request('/api/rooms/' + cmd, queueOptions()));
        }
        if (cmd === 'copy') await copyLink(button.parentElement.querySelector('input'));
        if (cmd === 'rejoin') beginRace(true);
        if (cmd === 'pick') await request(target('driver'), { driverIndex: Number(button.dataset.driverId) }, key);
        if (cmd === 'start') await request(target('start'), {}, key);
        if (cmd === 'ready') await request(target('ready'), { ready: !getRoom().seats.find(s => s.index === seat).ready }, key);
      });
    });
    function savePlayerName(value) {
      playerName = value.slice(0, maxPlayerName);
      rememberPlayerName(playerName);
    }
    root.addEventListener('input', event => {
      if (event.target.name === 'playerName') savePlayerName(event.target.value);
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (event.target.dataset.form === 'queue') {
        savePlayerName(field('playerName').value);
        if (support.visibility === 'code') {
          serverCode = field('serverCode').value.trim();
          if (serverCodePattern.test(serverCode)) saveServerCode(serverCode);
        }
        startQueue();
        return;
      }
      void action(async () => {
        if (event.target.dataset.form === 'join') {
          const code = cleanCode(field('code').value);
          if (!roomPattern.test(code)) throw Error('Enter a five-character room code.');
          connect(await request('/api/rooms/' + code + '/join', { driverIndex: opts.driverIndex }));
        } else {
          const raw = field('remote').value.trim();
          let address;
          try { address = new URL(raw.includes('://') ? raw : 'http://' + raw); }
          catch { throw Error('Enter the host address printed in the PC host window.'); }
          if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password)
            throw Error('Use an http or https host address.');
          if (!address.searchParams.has('room')) address.searchParams.set('room', 'join');
          location.assign(address.href);
        }
      });
    });
    root.addEventListener('change', event => {
      if (!getRoom()) return;
      void action(async () => {
        if (event.target.name === 'track') await request(target('config'), { trackIndex: Number(event.target.value) }, key);
        if (event.target.name === 'cc') await request(target('config'), { cc: Number(event.target.value) }, key);
        if (event.target.name === 'difficulty') await request(target('config'), { difficulty: event.target.value }, key);
        if (event.target.name === 'fill') await request(target('config'), { botFill: event.target.checked }, key);
      });
    });
    setup();
    (async () => {
      if (support === false) return;
      try {
        if (!['http:', 'https:'].includes(location.protocol)) throw Error('No local host.');
        const data = await request('/api/rooms/version');
        support = data.game === 'acorn-rally' && data.version === 1 ? data : false;
      } catch { support = false; }
      if (active !== context) return;
      const link = readJoinLink();
      if (support?.visibility === 'code') serverCode = readServerCode(link.code);
      if (support?.queueEnabled && link.name !== null) savePlayerName(link.name.replace(/[\x00-\x1f\x7f]/g, '').trim());
      const prior = stored(), code = cleanCode(new URLSearchParams(location.search).get('room'));
      if (support && prior && (!roomPattern.test(code) || prior.code === code)) {
        try { connect(await request('/api/rooms/' + prior.code + '/resume', {}, prior.key)); return; }
        catch {
          remember(null);
          if (support.queueEnabled && roomPattern.test(code)) urlCode('join');
        }
      }
      if (support?.queueEnabled && (support.visibility !== 'code' || serverCode)) {
        const queued = storedQueueToken();
        if (queued || link.autoJoin) {
          startQueue(queued || undefined);
          return;
        }
      }
      setup();
    })();
  }
  window.RallyRooms = { open };
})();
