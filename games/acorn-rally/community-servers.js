'use strict';
(() => {
  const documents = 'projects/magic-servers-1ca0c/databases/(default)/documents';
  const officialDocuments = 'projects/bible-game-246c0/databases/(default)/documents';
  const firestore = 'https://firestore.googleapis.com/v1/';
  const api = firestore + documents;
  const collection = 'acornRallyLobbies';
  const phases = new Set(['waiting', 'racing', 'finished']);
  const ticketLimit = 128;
  const pageSize = 25;

  async function json(url, options, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error('Request failed.');
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function validOccupancy(players, capacity, queued) {
    return Number.isInteger(capacity) && capacity >= 2 && capacity <= 8 &&
      Number.isInteger(players) && players >= 0 && players <= capacity &&
      Number.isInteger(queued) && queued >= 0 && queued <= 1000;
  }

  function parseListing(doc, now = Date.now()) {
    const prefix = documents + '/' + collection + '/';
    if (typeof doc?.name !== 'string' || !doc.name.startsWith(prefix)) return null;
    const code = doc.name.slice(prefix.length);
    const f = doc.fields;
    if (!/^\d{4}$/.test(code) || !f) return null;
    const visibility = f.visibility?.stringValue, phase = f.phase?.stringValue;
    const owner = f.ownerUid?.stringValue, name = f.name?.stringValue, origin = f.origin?.stringValue;
    const joinUrl = f.joinUrl?.stringValue;
    if (!['public', 'code'].includes(visibility) || !phases.has(phase) ||
        typeof name !== 'string' || !name.trim() || name.length > 40 ||
        typeof owner !== 'string' || !owner || owner.length > 128 ||
        typeof origin !== 'string' || !/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(origin) ||
        joinUrl !== origin + '/?room=join') return null;
    const updated = Date.parse(f.updatedAt?.timestampValue), expires = Date.parse(f.expiresAt?.timestampValue);
    if (!Number.isFinite(updated) || !Number.isFinite(expires) || expires <= now || updated > now + 30_000 ||
        now - updated > 120_000 || expires <= updated || expires > now + 180_000) return null;
    const players = Number(f.players?.integerValue), capacity = Number(f.capacity?.integerValue);
    const queued = Number(f.queued?.integerValue);
    if (!validOccupancy(players, capacity, queued)) return null;
    return { code, owner, name, origin, joinUrl, visibility, phase, players, capacity, queued, expires };
  }

  function rank(a, b) {
    const tier = s => s.phase === 'racing' ? 2 : s.players + s.queued < s.capacity ? 0 : 1;
    const available = s => s.capacity - (s.phase === 'racing' ? 0 : s.players) - s.queued;
    return tier(a) - tier(b) || available(b) - available(a) || a.queued - b.queued ||
      a.name.localeCompare(b.name) || a.code.localeCompare(b.code);
  }

  async function publicServers() {
    const result = [], deadline = Date.now() + 8000;
    let lastName = '';
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('The server directory timed out.');
      const query = {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: 'visibility' }, op: 'EQUAL', value: { stringValue: 'public' } } },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: pageSize
      };
      if (lastName) query.startAt = { values: [{ referenceValue: lastName }], before: false };
      const rows = await json(api + ':runQuery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: query })
      }, remaining);
      if (!Array.isArray(rows)) throw new Error('The server directory could not be read.');
      const docs = rows.map(row => row.document).filter(Boolean);
      for (const doc of docs) {
        const listing = parseListing(doc);
        if (listing?.visibility === 'public') result.push(listing);
      }
      if (docs.length < pageSize) return result.sort(rank);
      const nextName = docs[docs.length - 1].name;
      if (typeof nextName !== 'string' || nextName <= lastName) throw new Error('Invalid directory page.');
      lastName = nextName;
    }
  }

  async function officialServer() {
    const doc = await json(firestore + officialDocuments + '/acornRallyService/public', {}, 1600);
    const f = doc?.fields;
    const origin = 'https://rally.catnmice.com';
    if (doc?.name !== officialDocuments + '/acornRallyService/public' || f?.origin?.stringValue !== origin ||
        f.joinUrl?.stringValue !== origin + '/?room=join' || f.queueEnabled?.booleanValue !== true) return null;
    const now = Date.now(), updated = Date.parse(f.updatedAt?.timestampValue), expires = Date.parse(f.expiresAt?.timestampValue);
    const phase = f.phase?.stringValue, players = Number(f.players?.integerValue);
    const capacity = Number(f.capacity?.integerValue), queued = Number(f.waiting?.integerValue ?? 0);
    if (!Number.isFinite(updated) || !Number.isFinite(expires) || expires <= now || expires <= updated ||
        updated > now + 30_000 || now - updated > 120_000 || expires > now + 180_000 ||
        !phases.has(phase) || !validOccupancy(players, capacity, queued)) return null;
    return { code: 'official', name: 'Acorn Rally official', origin, joinUrl: origin + '/?room=join',
      visibility: 'public', phase, players, capacity, queued, expires };
  }

  async function directory() {
    const [community, official] = await Promise.allSettled([publicServers(), officialServer()]);
    const hasOfficial = official.status === 'fulfilled' && official.value;
    if (community.status === 'rejected' && !hasOfficial) throw community.reason;
    const servers = community.status === 'fulfilled' ? community.value : [];
    if (hasOfficial) servers.push(official.value);
    return servers.sort(rank);
  }

  async function probe(server, timeout) {
    if (server.expires <= Date.now()) return null;
    try {
      const data = await json(server.origin + '/api/rooms/status', {}, timeout);
      if (data.game !== 'acorn-rally' || data.queueEnabled !== true || data.visibility !== server.visibility ||
          !phases.has(data.phase) || !validOccupancy(data.players, data.capacity, data.waiting) ||
          data.waiting >= ticketLimit) return null;
      return { ...server, phase: data.phase, players: data.players, capacity: data.capacity, queued: data.waiting };
    } catch { return null; }
  }

  async function bestPublicServer(servers) {
    const deadline = Date.now() + 8000;
    const verified = [];
    for (let i = 0; i < servers.length && Date.now() < deadline; i += 4) {
      const timeout = Math.min(2300, deadline - Date.now());
      const batch = await Promise.all(servers.slice(i, i + 4).map(server => probe(server, timeout)));
      verified.push(...batch.filter(Boolean));
      verified.sort(rank);
      if (verified.length && verified[0].phase !== 'racing' &&
          verified[0].players + verified[0].queued < verified[0].capacity) break;
    }
    return verified[0];
  }

  function mount(panel, { liveJoin = false } = {}) {
    if (!panel) return;
    panel.classList.add('rr-directory');
    panel.innerHTML = '<div class="rr-directory-head"><h3>Online servers</h3>' +
      '<button type="button" class="rr-secondary" data-directory-live>Live Join</button></div>' +
      '<label data-directory-name>Player name (optional)<input name="directoryPlayerName" maxlength="22" autocomplete="nickname" type="text"></label>' +
      '<div class="rr-directory-head"><h4>Public servers</h4><button type="button" class="rr-text" data-directory-refresh>Refresh</button></div>' +
      '<ul class="rr-directory-list"></ul><form data-directory-code><label>Private server code' +
      '<input name="serverCode" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required autocomplete="off" placeholder="0000"></label>' +
      '<button type="submit" class="rr-secondary">Join by code</button></form><p role="status" class="rr-directory-status"></p>';
    const list = panel.querySelector('ul'), status = panel.querySelector('[role="status"]');
    const refresh = panel.querySelector('[data-directory-refresh]'), form = panel.querySelector('form');
    const nameLabel = panel.querySelector('[data-directory-name]');
    const localName = panel.closest('.rr-room')?.querySelector('[name="playerName"]');
    const nameInput = localName || nameLabel.querySelector('input');
    if (localName) nameLabel.hidden = true;
    else {
      try { nameInput.value = (sessionStorage.getItem('acorn-rally-player-name') || '').slice(0, 22); } catch { /* In-memory entry still works. */ }
    }
    nameInput.addEventListener('input', () => {
      try { sessionStorage.setItem('acorn-rally-player-name', nameInput.value.slice(0, 22)); } catch { /* Storage can be disabled. */ }
    });
    let request = 0;

    function feedback(text) { status.textContent = text; }
    function current(id) { return id === request && panel.isConnected; }
    function draw(servers) {
      list.replaceChildren();
      for (const server of servers) {
        const row = document.createElement('li'), info = document.createElement('div');
        const name = document.createElement('strong'), detail = document.createElement('small');
        name.textContent = server.name;
        const phase = server.phase === 'racing' ? 'Racing' : 'In lobby';
        detail.textContent = phase + ' · ' + server.players + '/' + server.capacity + ' players' +
          (server.queued ? ' · ' + server.queued + ' queued' : '');
        info.append(name, detail);
        const join = document.createElement('button');
        join.type = 'button'; join.className = 'rr-secondary'; join.textContent = 'Join';
        join.setAttribute('aria-label', 'Join ' + server.name);
        join.addEventListener('click', () => void connect(server));
        row.append(info, join); list.append(row);
      }
    }

    function enter(server) {
      const destination = new URL(server.joinUrl);
      const handoff = new URLSearchParams({ join: '1' });
      const name = nameInput.value.trim().slice(0, 22);
      if (name) handoff.set('name', name);
      if (server.visibility === 'code') handoff.set('code', server.code);
      destination.hash = handoff.toString();
      location.assign(destination.href);
    }

    async function connect(server, id = ++request) {
      feedback('Connecting to ' + server.name + '…');
      const available = await probe(server, 3000);
      if (!current(id)) return;
      if (available) enter(available);
      else feedback('This server is unavailable. Refresh the list or choose another server.');
    }

    async function load(autoJoin) {
      const id = ++request;
      feedback(autoJoin ? 'Finding an available public server…' : 'Loading public servers…');
      try {
        const servers = await directory();
        if (!current(id)) return;
        draw(servers);
        if (!servers.length) { feedback('No public servers are online.'); return; }
        if (!autoJoin) { feedback(''); return; }
        const best = await bestPublicServer(servers);
        if (!current(id)) return;
        if (best) enter(best);
        else feedback('No public server is accepting players right now.');
      } catch {
        if (current(id)) feedback('The public server list could not load. Try Refresh.');
      }
    }

    refresh.addEventListener('click', () => void load(false));
    panel.querySelector('[data-directory-live]').addEventListener('click', () => void load(true));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopPropagation();
      const code = form.elements.serverCode.value.trim();
      if (!/^\d{4}$/.test(code)) { feedback('Enter four digits.'); return; }
      const id = ++request;
      feedback('Looking up the server…');
      try {
        const doc = await json(api + '/' + collection + '/' + code, {}, 5000);
        const server = parseListing(doc);
        if (!current(id)) return;
        if (!server || server.code !== code) { feedback('No active server has that code.'); return; }
        await connect(server, id);
      } catch (error) {
        if (current(id)) feedback([403, 404].includes(error.status) ? 'No active server has that code.' : 'Could not look up that code. Try again.');
      }
    });
    void load(liveJoin);
    return () => { request++; };
  }

  window.AcornCommunityServers = { mount };
})();
