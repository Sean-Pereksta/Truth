const api = '/api/orbit-bloom/';
const storageKey = 'orbit-bloom-online-seat-v1';
const requestTimeout = 6000;

export function createRoomClient({
  origin = globalThis.location?.origin,
  fetchImpl = globalThis.fetch,
  storage = sessionStorageOrNull(),
  onSnapshot = () => {},
  onError = () => {},
} = {}) {
  const controllers = new Set();
  const queue = [];
  let timer, movementTimer, movement, token, playerId, snapshot, sequence;
  let generation = 0;
  let sending = false;
  let pollFailed = false;

  async function request(action, data, auth = token) {
    const url = new URL(api + action, origin);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
    controllers.add(controller);
    const headers = { Accept: 'application/json' };
    if (auth) headers.Authorization = 'Bearer ' + auth;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const response = await fetchImpl(url.href, {
        method: data === undefined ? 'GET' : 'POST', headers,
        body: data === undefined ? undefined : JSON.stringify(data),
        cache: 'no-store', credentials: 'same-origin', redirect: 'error',
        signal: controller.signal,
      });
      let answer;
      try { answer = await response.json(); } catch {}
      if (!response.ok || !answer || typeof answer !== 'object') {
        throw Object.assign(new Error(answer?.error || 'The greenhouse could not be reached.'), { status: response.status });
      }
      return answer;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  function display(next) {
    if (snapshot && next.revision < snapshot.revision) return;
    if (snapshot && (next.round !== snapshot.round || next.phase !== 'playing')) clearMovement();
    snapshot = next;
    onSnapshot(next);
  }

  async function poll(active) {
    try {
      const next = await request('state');
      if (generation !== active) return;
      pollFailed = false;
      display(next);
    } catch (error) {
      if (generation !== active) return;
      if (error.status === 401) {
        forgetSeat();
        close();
        onError(error);
        return;
      }
      if (!pollFailed) onError(error);
      pollFailed = true;
    }
    if (generation === active) {
      const pause = pollFailed ? 1000 : snapshot?.phase === 'playing' ? 90 : 420;
      timer = setTimeout(() => void poll(active), pause);
    }
  }

  function recoverSeat() {
    try { return storage?.getItem(storageKey) || ''; } catch { return ''; }
  }

  function rememberSeat() {
    try { storage?.setItem(storageKey, token); } catch {}
  }

  function forgetSeat() {
    try { storage?.removeItem(storageKey); } catch {}
  }

  function close() {
    generation++;
    clearTimeout(timer);
    clearMovement();
    for (const controller of controllers) controller.abort();
    queue.length = 0;
    token = null;
    playerId = null;
    snapshot = null;
    pollFailed = false;
  }

  async function join(name) {
    close();
    const active = generation;
    const joined = await request('join', { name }, recoverSeat());
    if (active !== generation) return null;
    token = joined.token;
    playerId = joined.playerId;
    sequence = joined.sequence;
    rememberSeat();
    display(joined.snapshot);
    if (active === generation) void poll(active);
    return snapshot;
  }

  async function leave() {
    const auth = token;
    forgetSeat();
    close();
    if (auth) await request('leave', {}, auth);
  }

  async function change(action, data) {
    if (!token) throw new Error('Join the greenhouse first.');
    const active = generation;
    const updated = await request(action, data);
    if (generation === active) display(updated);
    return updated;
  }

  async function sendQueue() {
    if (sending) return;
    sending = true;
    try {
      while (token && queue.length) {
        const active = generation;
        const input = queue.shift();
        if (input.round !== snapshot.round) continue;
        try { await request('command', input); }
        catch (error) { if (generation === active && !pollFailed) onError(error); }
      }
    } finally { sending = false; }
  }

  function enqueue(input) {
    if (!token || snapshot?.phase !== 'playing') return;
    const entry = { round: snapshot.round, sequence: ++sequence, command: input };
    const prior = queue.at(-1);
    if (input.type === 'move' && prior?.command.type === 'move') queue[queue.length - 1] = entry;
    else if (queue.length < 24) queue.push(entry);
    else return;
    void sendQueue();
  }

  function clearMovement() {
    clearTimeout(movementTimer);
    movement = null;
  }

  function keepMoving() {
    if (!movement) return;
    enqueue(movement);
    movementTimer = setTimeout(keepMoving, 450);
  }

  function command(input) {
    if (input.type === 'target' || input.type === 'move') clearMovement();
    if (snapshot?.phase === 'playing' && input.type === 'move' && (input.x || input.y)) {
      movement = input;
      keepMoving();
    } else enqueue(input);
  }

  return {
    join, leave, close, command,
    ready: (ready = true) => change('ready', { ready }),
    start: levelId => change('start', { levelId }),
    get playerId() { return playerId; },
    get snapshot() { return snapshot; },
  };
}

function sessionStorageOrNull() {
  try { return globalThis.sessionStorage; } catch { return null; }
}

const documents = 'projects/magic-servers-1ca0c/databases/(default)/documents';
const listing = '/managedGameDirectories/orbitbloom';
const firestore = 'https://firestore.googleapis.com/v1/' + documents + listing;
const tunnel = /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/;
const codePattern = /^\d{4}$/;
const phases = new Set(['waiting', 'playing', 'finished']);

async function directoryRequest(url, options = {}, timeout = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options, cache: 'no-store', redirect: 'error', credentials: 'omit',
      referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error('The Orbit Bloom server list is unavailable.'), { status: response.status });
    return await response.json();
  } finally { clearTimeout(timer); }
}

function validSeats(players, capacity) {
  return capacity === 4 && Number.isInteger(players) && players >= 0 && players <= capacity;
}

function parseListing(document) {
  const prefix = documents + listing + '/lobbies/';
  if (typeof document?.name !== 'string' || !document.name.startsWith(prefix)) return null;
  const code = document.name.slice(prefix.length), f = document.fields;
  if (!codePattern.test(code) || !f) return null;
  const origin = f.origin?.stringValue, url = f.joinUrl?.stringValue;
  const hostId = f.hostId?.stringValue, name = f.name?.stringValue;
  const players = Number(f.players?.integerValue), capacity = Number(f.capacity?.integerValue);
  const phase = f.phase?.stringValue, visibility = f.visibility?.stringValue;
  const expires = Date.parse(f.expiresAt?.timestampValue), updated = Date.parse(f.updatedAt?.timestampValue);
  const now = Date.now();
  if (!tunnel.test(origin) || url !== origin + '/__catnmice/join' || typeof name !== 'string' ||
      !name.trim() || name.length > 40 || !/^[a-f0-9-]{36}$/.test(hostId) ||
      !['code', 'public'].includes(visibility) || !phases.has(phase) || !validSeats(players, capacity) ||
      !Number.isFinite(expires) || !Number.isFinite(updated) || expires <= now || expires <= updated ||
      updated > now + 30000 || expires > now + 180000) return null;
  const joinable = f.joinable?.booleanValue === true && phase !== 'finished' && players < capacity;
  return { code, name, origin, url, hostId, players, capacity, phase, visibility, expires, joinable };
}

export async function listPublicRooms() {
  const rooms = [];
  let cursor;
  const deadline = Date.now() + 7500;
  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('The Orbit Bloom server list took too long to load.');
    const structuredQuery = {
      from: [{ collectionId: 'lobbies' }], limit: 25,
      where: { fieldFilter: { field: { fieldPath: 'visibility' }, op: 'EQUAL', value: { stringValue: 'public' } } },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
    };
    if (cursor) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false };
    const rows = await directoryRequest(firestore + ':runQuery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery }),
    }, remaining);
    if (!Array.isArray(rows)) throw new Error('The Orbit Bloom server list is unavailable.');
    const documents = rows.map(row => row.document).filter(Boolean);
    for (const doc of documents) {
      const room = parseListing(doc);
      if (room?.visibility === 'public') rooms.push(room);
    }
    if (documents.length < 25) break;
    const last = documents.at(-1).name;
    if (typeof last !== 'string' || cursor && last <= cursor) throw new Error('The Orbit Bloom server list is unavailable.');
    cursor = last;
  }
  return rooms.sort((a, b) => Number(b.joinable) - Number(a.joinable) || a.name.localeCompare(b.name));
}

export async function resolveRoomCode(code) {
  if (typeof code !== 'string' || !codePattern.test(code)) return null;
  try {
    const room = parseListing(await directoryRequest(firestore + '/lobbies/' + code));
    return room?.code === code ? room : null;
  } catch (error) {
    if ([403, 404].includes(error.status)) return null;
    throw error;
  }
}

export async function probeRoom(room) {
  if (!room?.joinable || room.expires <= Date.now() || !tunnel.test(room.origin)) return null;
  try {
    const live = await directoryRequest(room.origin + '/__catnmice/status', {}, 3500);
    if (live.game !== 'orbitbloom' || live.hostId !== room.hostId || live.visibility !== room.visibility ||
        !phases.has(live.phase) || !validSeats(live.players, live.capacity) || live.phase === 'finished' ||
        live.joinable !== true || live.players >= live.capacity || room.expires <= Date.now()) return null;
    return { ...room, phase: live.phase, players: live.players };
  } catch { return null; }
}

export function roomJoinUrl(room, name = '') {
  if (!tunnel.test(room?.origin) || room.url !== room.origin + '/__catnmice/join' ||
      !['code', 'public'].includes(room.visibility) || !codePattern.test(room.code)) {
    throw new Error('Choose a valid Orbit Bloom server.');
  }
  const url = new URL(room.url);
  const displayName = name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 24);
  if (displayName) url.searchParams.set('name', displayName);
  if (room.visibility === 'code') url.hash = 'code=' + room.code;
  return url.href;
}
