'use strict';
(() => {
  const drivers = window.RallyData.drivers;
  const tracks = window.RallyData.tracks;
  const roomPattern = /^[A-Z2-9]{5}$/;
  const storageKey = 'acorn-rally-room-v1';
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
  function urlCode(value) {
    try {
      const url = new URL(location.href);
      if (value) url.searchParams.set('room', value); else url.searchParams.delete('room');
      history.replaceState(null, '', url);
    } catch { /* File previews can restrict history changes. */ }
  }
  async function request(url, body, token) {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const resp = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body),
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!resp.headers.get('content-type')?.includes('application/json')) throw Error('This copy of the game needs a PC host for private rooms.');
      const value = await resp.json();
      if (!resp.ok) throw Error(value.error || 'The room host was unavailable.');
      return value;
    } catch (err) {
      if (err.name === 'AbortError') throw Error('The host took too long to answer. Check its address and try again.');
      throw err;
    } finally { clearTimeout(timeout); }
  }

  function open(opts) {
    if (active?.room) { active.showLobby(); return; }
    if (active) active.destroy();
    const container = opts.container;
    const context = { room: null, destroy, showLobby };
    active = context;
    const root = document.createElement('section');
    root.className = 'rr-room';
    container.replaceChildren(root);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const staticPages = location.hostname === 'sean-pereksta.github.io' && location.pathname.startsWith('/Truth/games/acorn-rally/');
    let seat = -1, key = '', source = null, support = staticPages || location.protocol === 'file:' ? false : null;
    let inRace = false, playedRound = -1, snapshot = null, snapTick = -1, lastRoomRound = -1;
    let seq = Date.now() * 8, latest = {}, pulses = {}, lastSent = 0, lastSerial = '';
    let sender = 0, busy = false, connecting = false, disconnected = false, outbound = 0;
    let statusText = '', statusError = false, connectionNote = null;
    const getRoom = () => context.room;
    const target = action => '/api/rooms/' + getRoom().code + '/' + action;
    const field = name => root.querySelector('[name="' + name + '"]');
    const dialog = container.closest('dialog');
    let dialogGuard = false;
    function onCancel(event) { if (!inRace) { event.preventDefault(); void leave(); } }
    if (dialog) { dialog.addEventListener('cancel', onCancel); dialogGuard = true; }
    function top(title, code) {
      return '<header class="rr-head"><p>' + icon('globe') + ' MULTIPLAYER</p><button type="button" class="rr-x" data-rr="close" aria-label="Close private rooms">' + icon('close') + '</button><h2>' + title + '</h2>' + (code || '') + '</header>';
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
      const instructions = support.singleRoom ? 'On each phone, tap Join lobby.' : 'One phone creates a room and shares its invite.';
      const details = addresses.length
        ? '<p>Open a phone lobby address in each phone’s browser on the same Wi-Fi as this computer. ' + instructions + '</p>' +
          shareLinks(addresses.map(address => new URL('/?room=join', address).href), 'Phone lobby address')
        : '<p>Connect this computer to your local network and reopen Private Rooms to see its phone lobby address.</p>';
      return '<section class="rr-callout"><h3>Play on phones</h3>' + details + '</section>';
    }
    function setup() {
      if (active !== context) return;
      attach();
      const invite = cleanCode(new URLSearchParams(location.search).get('room'));
      const code = roomPattern.test(invite) ? invite : '';
      if (support === null) {
        root.innerHTML = top('PRIVATE ROOMS') + '<p class="rr-explain">Connecting to the race host…</p>' + statusBox();
      } else if (!support) {
        root.innerHTML = top('PRIVATE ROOMS') + '<div class="rr-callout"><strong>Host a race on your PC</strong><p>Download the PC edition and run <b>Start Acorn Rally</b>. Phones on the same Wi-Fi can open the host address and create or join a room in their browsers.</p><a class="rr-primary" href="?download=pc">' + icon('download') + 'Download PC edition</a></div>' +
          '<form data-form="remote"><h3>Join a host</h3><label>Host address or invite link<input name="remote" inputmode="url" autocapitalize="none" placeholder="http://192.168.1.20:8791" required spellcheck="false" autocomplete="off"></label><button type="submit" class="rr-secondary">Open host ' + icon('arrow') + '</button></form>' + statusBox();
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
          (code ? join + create : create + (support.singleRoom ? '' : join)) + statusBox();
      }
    }
    function optionList(data, selected) {
      return data.map((entry, i) => '<option value="' + i + '"' + (i === selected ? ' selected' : '') +
        '>' + escape(entry.name) + '</option>').join('');
    }
    function showLobby() {
      if (active !== context || !getRoom()) return;
      if (inRace && getRoom().phase === 'racing') void request(target('control'), { driving: false }, key).catch(() => {});
      inRace = false; connectionNote?.remove(); connectionNote = null; attach();
      const focused = root.contains(document.activeElement) ? document.activeElement : null;
      const refocus = focused?.dataset.driverId !== undefined ? '[data-driver-id="' + focused.dataset.driverId + '"]' : focused?.name ? '[name="' + focused.name + '"]' :
        focused?.dataset.rr ? '[data-rr="' + focused.dataset.rr + '"]' : null;
      const room = getRoom(), me = room.seats.find(s => s.index === seat);
      if (!me) return;
      const owner = seat === room.host, locked = room.phase === 'racing';
      const reserved = new Set(room.seats.filter(s => s.index !== seat).map(s => s.driverIndex));
      const portraits = drivers.map((driver,i) => {
        if(!window.AcornChampionship.isDriverAvailable(i))
          return '<button type="button" class="rr-pick" disabled title="'+escape(window.AcornChampionship.rewardRequirement(i))+'"><img src="art/driver-'+i+'.webp" alt=""><b>'+escape(driver.name)+'</b><small>Locked</small></button>';
        const taken=reserved.has(i), selected=me.driverIndex===i;
        return '<button type="button" class="rr-pick" data-rr="pick" data-driver-id="'+i+'" aria-pressed="'+selected+'" aria-label="'+escape(driver.name+' the '+driver.species.toLowerCase()+(taken?' · Taken':''))+'" '+(locked||taken?'disabled':'')+'><img src="art/driver-'+i+'.webp" alt=""><b>'+escape(driver.name)+'</b>'+(selected?'<span>✓</span>':'')+'</button>';
      }).join('');
      const allReady = room.seats.every(s => s.connected && (s.ready || s.index === room.host));
      const track = tracks[room.trackIndex];
      const grid = room.seats.map(s => '<li><img src="art/driver-' + s.driverIndex + '.webp" alt=""><span><strong>' + escape(s.name) +
        (s.index === seat ? ' <small>YOU</small>' : '') + '</strong><em>' + escape(drivers[s.driverIndex].species) + '</em></span><b class="' +
        (s.connected && (s.ready || s.index === room.host) ? 'rr-ready' : '') + '">' +
        (!s.connected ? 'Reconnecting' : s.index === room.host ? 'Host' : s.ready ? 'Ready' : 'In garage') + '</b></li>').join('');
      const cc=window.AcornSim.normalizeCC(room.cc), difficulty=window.AcornSim.normalizeDifficulty(room.difficulty);
      const sharedSelect=(name,label,values,current,toLabel)=>'<label>'+label+'<select name="'+name+'"'+(locked?' disabled':'')+'>'+values.map(v=>'<option value="'+v+'"'+(current===v?' selected':'')+'>'+toLabel(v)+'</option>').join('')+'</select></label>';
      const skillLabel=value=>value[0].toUpperCase()+value.slice(1);
      const hostControls = owner ? '<label>Course<select name="track"' + (locked ? ' disabled' : '') + '>' + optionList(tracks, room.trackIndex) + '</select></label>' +
        sharedSelect('cc','Engine class',window.AcornSim.engineClasses,cc,v=>v+' cc')+sharedSelect('difficulty','AI difficulty',window.AcornSim.difficulties,difficulty,skillLabel)+
        '<label class="rr-toggle"><input name="fill" type="checkbox"' + (room.botFill ? ' checked' : '') + (locked ? ' disabled' : '') + '>Fill empty seats with AI</label>' :
        '<p class="rr-track-readout">' + icon('track') + escape(track.name) + ' · ' + room.laps + ' laps · '+cc+' cc · '+skillLabel(difficulty)+' AI</p>';
      const action = locked ? '<button class="rr-primary" data-rr="rejoin">Return to race ' + icon('arrow') + '</button>' :
        owner ? '<button class="rr-primary" data-rr="start"' + (!allReady ? ' disabled' : '') + '>' + icon('flag') + (room.phase === 'finished' ? 'Start rematch' : 'Start race') + '</button>' :
          '<button class="' + (me.ready ? 'rr-secondary' : 'rr-primary') + '" data-rr="ready">' + (me.ready ? 'Cancel ready' : 'Ready to race') + '</button>';
      const invite = new URL(location.href);
      invite.search = '?room=' + room.code;
      invite.hash = '';
      const invitePaths = localHost && support.addresses?.length ? support.addresses.map(address => {
        const localInvite = new URL(invite);
        localInvite.host = new URL(address).host;
        return localInvite.href;
      }) : [invite.href];
      root.innerHTML = top('RACE ROOM') + '<div class="rr-invite"><span>INVITE CODE<b>' + escape(room.code) +
        '</b></span>' + shareLinks(invitePaths, 'Race invite') + '</div>' +
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
      if (room.round !== lastRoomRound) {
        snapshot = null; snapTick = -1; lastRoomRound = room.round;
      }
      context.room = room;
      if (!inRace) showLobby();
    }
    function beginRace(force = false) {
      const room = getRoom();
      if (!snapshot || !room || room.phase !== 'racing' || (!force && playedRound === room.round)) return;
      playedRound = room.round; inRace = true; latest = {}; pulses = {}; lastSerial = ''; lastSent = 0;
      const me = room.seats.find(s => s.index === seat);
      if (!me) return;
      const raceSeat = me.kartIndex;
      void request(target('control'), { driving: true }, key).catch(() => {});
      const network = { seat: raceSeat, sendInput, getState: () => snapshot, returnToLobby: showLobby, leave,
        isConnected: () => !disconnected };
      if (dialog?.open) dialog.close();
      opts.startRace({ trackIndex: room.trackIndex, driverIndex: me.driverIndex,
        driverIndices: snapshot.racers.map(r => r.driverIndex),
        mode: 'single', laps: room.laps, cc: room.cc, difficulty: room.difficulty, players: 1, settings: opts.settings, network });
    }
    function sendInput(input) {
      if (!input || !inRace || active !== context) return;
      latest = { ...input };
      if (input.item) pulses.item = true;
      if (input.ability) pulses.ability = true;
    }
    async function pump() {
      const room = getRoom();
      if (active !== context || !inRace || disconnected || room?.phase !== 'racing' || outbound >= 3) return;
      const input = { steer: Number(latest.steer) || 0, gas: Number(latest.gas) || 0, brake: Number(latest.brake) || 0,
        drift: Boolean(latest.drift), item: Boolean(latest.item || pulses.item),
        ability: Boolean(latest.ability || pulses.ability), lookBack: Boolean(latest.lookBack) };
      const serial = JSON.stringify(input), now = performance.now();
      if (serial === lastSerial && now - lastSent < 220) return;
      lastSerial = serial; lastSent = now; pulses = {}; outbound++;
      try { await request(target('input'), { round: room.round, seq: ++seq, input }, key); }
      catch { lastSerial = ''; } finally { outbound--; }
    }
    function connect(value) {
      if (active !== context) return;
      seat = value.seat; key = value.token; context.room = value.room; lastRoomRound = value.room.round;
      remember({ code: value.room.code, key }); urlCode(value.room.code); status(value.assignment || '');
      showLobby();
      source?.close();
      source = new EventSource(target('events') + '?seatKey=' + encodeURIComponent(key));
      source.addEventListener('room', event => {
        disconnected = false; connectedNote(false);
        if (statusText === 'Reconnecting to the host…') status('');
        receiveRoom(JSON.parse(event.data));
      });
      source.addEventListener('snapshot', event => {
        if (active !== context) return;
        const data = JSON.parse(event.data);
        if (data.round !== getRoom().round || data.tick <= snapTick) return;
        snapshot = data.state; snapTick = data.tick;
        beginRace();
      });
      source.onerror = () => {
        if (active !== context) return;
        disconnected = true; connectedNote(true); status('Reconnecting to the host…');
      };
      clearInterval(sender); sender = setInterval(pump, 40);
    }
    function destroy() {
      if (dialogGuard) dialog.removeEventListener('cancel', onCancel);
      source?.close(); clearInterval(sender); connectionNote?.remove(); root.remove();
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
          connect(await request('/api/rooms/' + cmd, {
            trackIndex: opts.trackIndex, driverIndex: opts.driverIndex, cc: opts.cc, difficulty: opts.difficulty, botFill: true
          }));
        }
        if (cmd === 'copy') await copyLink(button.parentElement.querySelector('input'));
        if (cmd === 'rejoin') beginRace(true);
        if (cmd === 'pick') await request(target('driver'), { driverIndex: Number(button.dataset.driverId) }, key);
        if (cmd === 'start') await request(target('start'), {}, key);
        if (cmd === 'ready') await request(target('ready'), { ready: !getRoom().seats.find(s => s.index === seat).ready }, key);
      });
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
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
      const prior = stored(), code = cleanCode(new URLSearchParams(location.search).get('room'));
      if (support && prior && (!roomPattern.test(code) || prior.code === code)) {
        try { connect(await request('/api/rooms/' + prior.code + '/resume', {}, prior.key)); return; }
        catch { remember(null); }
      }
      setup();
    })();
  }
  window.RallyRooms = { open };
})();
