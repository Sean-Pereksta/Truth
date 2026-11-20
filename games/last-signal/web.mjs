const project = 'bible-game-246c0';
const firebaseApiKey = 'AIzaSyB7twY7z31ucB6pGA8JC_HrVMZhA8lNaJA';
const tunnelHost = /^[a-z0-9-]+\.trycloudflare\.com$/;
const roomCode = /^[A-Za-z0-9_-]{24}$/;
const directoryId = /^[A-Za-z0-9_-]{1,100}$/;
const entryPaths = new Set(['/', '/mobile', '/mobile/', '/ws']);
const lifetime = 90_000;

export function guestUrl(input) {
  const value = input.trim();
  if (value.length > 2048) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !tunnelHost.test(url.hostname) || url.port ||
      url.username || url.password || url.search || !entryPaths.has(url.pathname) ||
      !roomCode.test(url.hash.slice(1))) return null;
  return url.origin + '/mobile/' + url.hash;
}

export function publicArena(document, now) {
  const fields = document?.fields;
  if (fields?.gameType?.stringValue !== 'lastsignal-arena-v1') return null;
  const origin = fields.origin?.stringValue;
  const code = fields.publicRoom?.stringValue;
  const owner = fields.ownerUid?.stringValue;
  const stamp = Date.parse(fields.lastSignalListedAt?.timestampValue);
  const humans = Number(fields.humans?.integerValue);
  if (typeof document.name !== 'string' || typeof owner !== 'string' || !directoryId.test(owner) ||
      !document.name.endsWith('/lobbies/lastsignal-' + owner) ||
      typeof code !== 'string' || !roomCode.test(code) ||
      typeof origin !== 'string' || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) ||
      !Number.isFinite(stamp) || stamp <= now - lifetime || stamp > now + 30_000 ||
      !Number.isInteger(humans) || humans < 1 || humans >= 8) return null;
  const label = (value, fallback) => typeof value === 'string' ? value.slice(0, 40).trim() || fallback : fallback;
  return {
    name: label(fields.hostName?.stringValue, 'Host'),
    arena: label(fields.arena?.stringValue, 'Arena'),
    humans,
    until: stamp + lifetime,
    url: guestUrl(origin + '/#' + code),
  };
}

async function postJson(url, payload, token) {
  const headers = {'Content-Type': 'application/json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 6500);
  const maxBytes = 512 * 1024;
  try {
    const response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(payload),
      redirect: 'error', signal: controller.signal,
    });
    if (!response.ok || !response.body || Number(response.headers.get('Content-Length')) > maxBytes) {
      throw new Error('Public arena directory unavailable.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let text = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (done) return JSON.parse(text + decoder.decode());
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Public arena directory response too large.');
      }
      text += decoder.decode(value, {stream: true});
    }
  } finally {
    clearTimeout(deadline);
  }
}

async function signIn() {
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + firebaseApiKey;
  const account = await postJson(url, {returnSecureToken: true});
  if (typeof account.idToken !== 'string' || !account.idToken) {
    throw new Error('Could not open the arena directory.');
  }
  return {token: account.idToken, expires: Date.now() + 50 * 60_000};
}

let identity;
async function listPublicArenas() {
  if (!identity || identity.expires <= Date.now()) identity = await signIn();
  const field = {fieldPath: 'lastSignalListedAt'};
  const timestampValue = new Date(Date.now() - lifetime).toISOString();
  const query = {structuredQuery: {
    from: [{collectionId: 'lobbies'}],
    where: {fieldFilter: {field, op: 'GREATER_THAN', value: {timestampValue}}},
    orderBy: [{field, direction: 'DESCENDING'}],
    limit: 50,
  }};
  const url = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents:runQuery';
  const results = await postJson(url, query, identity.token);
  if (!Array.isArray(results)) throw new Error('Invalid arena directory response.');
  const now = Date.now();
  return results.slice(0, 50).map(row => publicArena(row?.document, now)).filter(Boolean);
}

function init() {
  for (const link of document.querySelectorAll('[data-managed]')) {
    link.addEventListener('click', event => {
      if (!window.CatnmiceServers || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.CatnmiceServers.open('lastsignal', { live: link.dataset.managed === 'live' });
    });
  }
  const form = document.querySelector('#invite');
  const inviteInput = document.querySelector('#invite-link');
  const inviteError = document.querySelector('#invite-error');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = guestUrl(inviteInput.value);
    if (url) location.assign(url);
    else {
      inviteError.textContent = 'Paste the complete HTTPS invite, including the room code after #.';
      inviteError.hidden = false;
      inviteInput.setAttribute('aria-invalid', 'true');
      inviteInput.focus();
    }
  });
  inviteInput.addEventListener('input', () => {
    inviteError.hidden = true;
    inviteInput.removeAttribute('aria-invalid');
  });

  const refresh = document.querySelector('#refresh');
  const status = document.querySelector('#directory-status');
  const rooms = document.querySelector('#rooms');
  let results = [];
  let nextRefresh = 0;
  const render = () => {
    const now = Date.now();
    results = results.filter(room => room.until > now);
    rooms.replaceChildren(...results.map(room => {
      const row = document.createElement('li');
      const info = document.createElement('div');
      const name = document.createElement('strong');
      const details = document.createElement('small');
      const join = document.createElement('a');
      info.className = 'room-info';
      name.textContent = room.name;
      details.textContent = room.arena + ' · ' + room.humans + ' / 8 players';
      join.className = 'room-join';
      join.href = room.url;
      join.textContent = 'Join arena';
      join.setAttribute('aria-label', 'Join ' + room.name + ' in ' + room.arena);
      info.append(name, details);
      row.append(info, join);
      return row;
    }));
    rooms.hidden = !results.length;
    status.textContent = results.length ? 'Choose an arena to join.' : 'No public arenas are waiting.';
  };

  async function load() {
    if (refresh.disabled) return;
    if (Date.now() < nextRefresh) {
      render();
      return;
    }
    refresh.disabled = true;
    status.textContent = 'Looking for public arenas…';
    try {
      results = await listPublicArenas();
      nextRefresh = Date.now() + 15_000;
      render();
    } catch {
      rooms.replaceChildren();
      rooms.hidden = true;
      status.textContent = 'Could not load public arenas. Retry or use an invite.';
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', load);
  rooms.addEventListener('click', event => {
    const join = event.target.closest('a');
    if (join && !results.some(room => room.url === join.href && room.until > Date.now())) {
      event.preventDefault();
      render();
    }
  });
  function loadOnlineSection() {
    if (location.hash === '#lobbies') void load();
  }

  window.addEventListener('hashchange', loadOnlineSection);
  window.addEventListener('pageshow', event => {
    if (event.persisted) loadOnlineSection();
  });
  loadOnlineSection();
}

if (typeof document !== 'undefined') init();
