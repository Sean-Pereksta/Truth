'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '..');
const raceSim = require('../race-sim.js');
const { createRaceQueue } = require('./race-queue.cjs');
const { createRacePolling } = require('./community-poll.cjs');
const { createRaceSockets } = require('./community-socket.cjs');
const names = raceSim.drivers;
const earnedDrivers = new Set([names.indexOf('Astra'), names.indexOf('Aurel'), names.indexOf('Grimoire the Vile')]);
const neutral = Object.freeze({ steer: 0, gas: 0, brake: 0, drift: false, item: false, ability: false, lookBack: false });
const idleLimit = 15 * 60 * 1000;
const lobbyIdleLimit = 2 * 60 * 1000;
const admissionTimeout = 25_000;
const gridLoadTimeout = 60_000;
const emptyRaceGrace = 20_000;
const queueTokenPattern = /^[0-9a-f]{64}$/;
const gridClientPattern = /^[0-9a-f]{16}$/;
const capacity = 8;
const stepSeconds = 1 / 60;
const snapshotIntervalTicks = 3;
const transports = new Set(['websocket', 'events', 'poll']);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.zip': 'application/zip', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8'
};

function integer(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function scalar(value, lower) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(lower, n)) : 0;
}

function displayName(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 22);
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function readJson(req) {
  let bytes = 0;
  const parts = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) fail(413, 'The room request was too large.');
    parts.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(parts).toString() || '{}'); }
  catch { fail(400, 'The host could not read that room request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid room request.');
  return body;
}

function newSeat(index, body, occupied = []) {
  const reserved = new Set(occupied.map(s => s.driverIndex));
  const preferred = integer(body.driverIndex, 0, names.length - 1, index);
  const driverIndex = reserved.has(preferred) ? names.findIndex((_, id) => !earnedDrivers.has(id) && !reserved.has(id)) : preferred;
  if (driverIndex < 0) fail(409, 'Every racer is already on this grid.');
  return { index, driverIndex, name: displayName(body.name) || names[driverIndex], token: crypto.randomBytes(24).toString('hex'),
    kartIndex: index, driving: true, ready: false, stream: null, touched: Date.now(), seq: -1, inputAt: 0, input: { ...neutral }, pulses: {} };
}

function createRallyServer({ sim = raceSim, automatic = true, singleRoom = false,
  community = null, visibility = 'public', name = 'Acorn Rally', hostId = '', operatorOrigin = '',
  raceQueue = singleRoom ? createRaceQueue(community ? { community: true, store: community.queueStore } : {}) : null } = {}) {
  const polling = createRacePolling(lobby);
  function connected(seat) { return Boolean(seat.socket?.isOpen()) || polling.connected(seat); }
  const privateCodes = new Map();
  const rooms = new Map();
  const loopDelay = community && automatic ? monitorEventLoopDelay({ resolution: 20 }) : null;
  loopDelay?.enable();
  const startedAt = performance.now();
  let snapshotCount = 0, snapshotBytes, diagnosticsAt = startedAt;
  function members(room) { return room.seats.filter(Boolean); }
  function inProgress(room) { return room?.phase === 'loading' || room?.phase === 'racing'; }
  function activeRoom() {
    const room = rooms.values().next().value;
    if (room && !members(room).some(connected) && Date.now() - room.touched > lobbyIdleLimit) {
      rooms.delete(room.code);
      return null;
    }
    return room || null;
  }
  function status() {
    const room = activeRoom();
    return { phase: inProgress(room) ? 'racing' : room?.phase === 'finished' ? 'finished' : 'waiting',
      players: room ? members(room).length : 0, capacity,
      ...(raceQueue && { queueEnabled: true, waiting: raceQueue.size() }) };
  }
  function authenticate(room, token) {
    const seat = members(room).find(s => s.token === token);
    if (!seat) fail(403, singleRoom ? 'This seat has expired. Join the race queue again.'
      : 'This seat has expired. Join again with the room code.');
    seat.touched = room.touched = Date.now();
    return seat;
  }
  function lobby(room) {
    const loading = room.phase === 'loading' ? loadDrivers(room) : null;
    return { code: room.code, host: room.host, trackIndex: room.trackIndex, botFill: room.botFill,
      laps: room.laps, cc: room.cc, difficulty: room.difficulty, phase: room.phase, round: room.round, tick: room.tick,
      ...(room.startNotice && { startNotice: room.startNotice }),
      ...(loading && { loading: { ready: loading.filter(seat => seat.loadedAt && connected(seat)).length,
        expected: loading.length, timeoutMs: Math.max(0, room.load.deadline - Date.now()) } }),
      seats: members(room).map(s => ({ index: s.index, kartIndex: s.kartIndex, name: s.name, driverIndex: s.driverIndex,
        ready: s.ready, connected: connected(s),
        ...(loading && { loadState: !loading.includes(s) ? 'reserve' :
          !connected(s) ? 'reconnecting' : s.loadedAt ? 'ready' : 'loading' }) })) };
  }
  function emit(seat, event, json) {
    const stream = seat.stream;
    if (!stream || stream.destroyed || stream.writableEnded) return;
    if (stream.writableLength > 512 * 1024) return stream.destroy();
    stream.write('event: ' + event + '\ndata: ' + json + '\n\n');
  }
  function publish(room, event, value) {
    const json = JSON.stringify(value);
    if (community && event === 'snapshot') {
      snapshotCount++;
      if (snapshotBytes === undefined || snapshotCount % 12 === 0) {
        snapshotBytes = Buffer.byteLength(json);
      }
    }
    if (community) polling.changed(room, event, value, json);
    raceSockets?.publish(room, event, value, json);
    for (const seat of members(room)) emit(seat, event, json);
  }
  function raceSnapshot(room) {
    return { round: room.round, tick: room.tick, intervalTicks: snapshotIntervalTicks, state: room.state };
  }
  function announce(room) { publish(room, 'room', lobby(room)); }
  function gridDrivers(occupied, gridSize) {
    const grid = Array(gridSize).fill(null);
    for (const seat of occupied) grid[seat.kartIndex] = seat.driverIndex;
    const spare = names.map((_, id) => id).filter(id => !earnedDrivers.has(id) && !grid.includes(id));
    let next = 0;
    return grid.map(driver => driver === null ? spare[next++] : driver);
  }
  function setHuman(room, seat, flag) {
    const kart = inProgress(room) && room.state?.racers?.[seat.kartIndex];
    if (kart) kart.human = flag;
  }
  function loadDrivers(room) {
    return members(room).filter(seat => seat.driving && room.load.participants.has(seat.index));
  }
  function setGridClient(room, seat, client) {
    if (typeof client !== 'string' || !gridClientPattern.test(client) || client === seat.loadBarrier) return false;
    seat.loadBarrier = client;
    if (room.phase !== 'loading' || !seat.loadedAt) return false;
    seat.loadedAt = null;
    seat.clientLoadMs = null;
    return true;
  }
  function returnToGrid(room, message) {
    room.phase = 'lobby';
    room.state = null;
    room.pollSnapshot = null;
    room.load = null;
    room.emptySince = null;
    room.startNotice = message;
    announce(room);
  }
  function advanceGrid(room, now) {
    const expected = loadDrivers(room);
    const pending = expected.filter(seat => !seat.loadedAt || !connected(seat));
    if (!expected.length) {
      returnToGrid(room, 'The starting grid emptied. Start another race when ready.');
    } else if (now >= room.load.deadline && pending.length) {
      const names = pending.map(seat => seat.name).join(', ');
      returnToGrid(room, 'Race start canceled. Still loading or reconnecting: ' + names + '.');
    } else if (!pending.length) {
      room.phase = 'racing';
      room.load.finishedAt = now;
      announce(room);
    }
  }
  function removeSeat(room, seat) {
    seat.finishPoll?.();
    setHuman(room, seat, false);
    const stream = seat.stream;
    seat.stream = null;
    if (stream) stream.end();
    const socket = seat.socket;
    seat.socket = null;
    socket?.close();
    room.seats[seat.index] = null;
    const remaining = members(room);
    if (!remaining.length) {
      if (inProgress(room)) retireRoom(room, 'abandoned');
      else rooms.delete(room.code);
      return;
    }
    if (room.host === seat.index) {
      room.host = (remaining.find(connected) || remaining[0]).index;
      room.seats[room.host].ready = true;
    }
    announce(room);
  }
  function begin(room) {
    if (inProgress(room)) fail(409, 'The race has already started preparing.');
    const occupied = members(room);
    if (!singleRoom && !occupied.every(s => s.stream && (s.index === room.host || s.ready)))
      fail(409, 'Every driver must be connected and ready.');
    const participants = occupied.filter(connected);
    if (!participants.length) fail(409, 'Wait for a driver to connect before starting.');
    const outdated = participants.filter(seat => !seat.loadBarrier);
    if (outdated.length) fail(409, 'Refresh Acorn Rally before starting: ' + outdated.map(seat => seat.name).join(', ') + '.');
    // Lobby identities survive rematches. Empty slots collapse when AI filling is disabled.
    occupied.forEach((s, i) => { s.kartIndex = room.botFill ? s.index : i; });
    const humanSeats = participants.map(s => s.kartIndex);
    const gridSize = room.botFill ? capacity : occupied.length;
    const drivers = gridDrivers(occupied, gridSize);
    const state = sim.create({ trackIndex: room.trackIndex, mode: 'single', players: 1,
      laps: room.laps, cc: room.cc, difficulty: room.difficulty, driverIndices: drivers, humanSeats, gridSize,
      seed: crypto.randomInt(1, 2147483646) });
    if (!room.botFill && state.racers.length > gridSize) state.racers.length = gridSize;
    for (const s of occupied) {
      if (singleRoom) state.racers[s.kartIndex].name = s.name;
      s.seq = -1; s.driving = true; s.input = { ...neutral }; s.pulses = {}; s.inputAt = 0;
      s.loadedAt = null; s.clientLoadMs = null;
    }
    const startedAt = Date.now();
    room.load = { startedAt, deadline: startedAt + gridLoadTimeout,
      participants: new Set(participants.map(seat => seat.index)) };
    room.state = state; room.tick = 0; room.phase = 'loading'; room.round += 1;
    room.emptySince = null; room.startNotice = null;
    announce(room);
    publish(room, 'snapshot', raceSnapshot(room));
  }
  function retireRoom(room, reason = 'finished') {
    rooms.delete(room.code);
    publish(room, 'retired', { code: room.code, round: room.round, reason });
    for (const seat of members(room)) {
      const stream = seat.stream;
      seat.stream = null;
      stream?.end();
      const socket = seat.socket;
      seat.socket = null;
      socket?.close();
    }
  }
  function stepRooms(now, pendingSnapshots) {
    for (const room of rooms.values()) {
      if (!inProgress(room)) continue;
      const driving = members(room).filter(seat => seat.driving);
      if (driving.some(connected)) room.emptySince = null;
      else {
        room.emptySince ??= now;
        if (now - room.emptySince >= emptyRaceGrace) retireRoom(room, 'abandoned');
        continue;
      }
      if (room.phase === 'loading') {
        advanceGrid(room, now);
        continue;
      }
      const inputs = {};
      for (const seat of members(room)) {
        if (!connected(seat)) {
          setHuman(room, seat, false);
          continue;
        }
        inputs[seat.kartIndex] = now - seat.inputAt > 800 ? neutral : { ...seat.input, ...seat.pulses };
        seat.pulses = {};
      }
      sim.step(room.state, stepSeconds, inputs);
      if (singleRoom) {
        const finishes = members(room).map(seat => room.state.racers[seat.kartIndex].finish);
        const cutoff = Math.min(12 * 60, ...finishes.filter(Boolean).map(time => time + 90));
        room.state.done = finishes.every(Boolean) || room.state.time >= cutoff;
      } else if (room.state.done) {
        room.state.done = room.state.racers.every(racer => racer.finish > 0);
      }
      room.tick += 1;
      if (room.state.done) {
        room.phase = 'finished';
        for (const s of members(room)) s.ready = s.index === room.host;
        pendingSnapshots.delete(room);
        publish(room, 'snapshot', raceSnapshot(room));
        if (singleRoom) retireRoom(room);
        else announce(room);
      } else if (room.tick % snapshotIntervalTicks === 0) {
        pendingSnapshots.add(room);
      }
    }
  }
  function tick(steps = 1) {
    const now = Date.now(), pendingSnapshots = new Set();
    for (let step = 0; step < steps; step++) stepRooms(now, pendingSnapshots);
    // A late timer may run several simulation steps at once. Publish only the
    // newest periodic snapshot from that batch, with its matching simulation tick.
    for (const room of pendingSnapshots) {
      if (rooms.get(room.code) === room && room.phase === 'racing') publish(room, 'snapshot', raceSnapshot(room));
    }
  }
  function collect() {
    const now = Date.now();
    polling.prune();
    for (const [key, attempt] of privateCodes) if (attempt.until <= now) privateCodes.delete(key);
    const disconnectLimit = singleRoom ? lobbyIdleLimit : idleLimit;
    for (const room of rooms.values()) {
      if (members(room).some(connected)) {
        for (const s of members(room)) {
          const timeout = s.queueKey && !s.joinedStream ? admissionTimeout : disconnectLimit;
          if (!connected(s) && now - s.touched > timeout) removeSeat(room, s);
          else if (s.stream) s.stream.write(': heartbeat\n\n');
        }
      } else if (now - room.touched > disconnectLimit) rooms.delete(room.code);
    }
  }
  let last = performance.now(), accumulator = 0;
  const timer = automatic && setInterval(() => {
    const current = performance.now();
    accumulator += Math.min((current - last) / 1000, 0.25); last = current;
    const steps = Math.floor(accumulator / stepSeconds);
    if (steps === 0) return;
    accumulator -= steps * stepSeconds;
    tick(steps);
  }, 8);
  const cleanup = setInterval(collect, 15000);
  function returnEncodedJson(res, json, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(json);
  }
  function returnJson(res, value, status = 200) { returnEncodedJson(res, JSON.stringify(value), status); }
  function acceptInput(room, seat, body) {
    if (room.phase !== 'racing' || body.round !== room.round) return { accepted: false };
    const seq = integer(body.seq, 0, Number.MAX_SAFE_INTEGER, -1);
    if (seq > seat.seq) {
      const raw = body.input || {};
      seat.seq = seq; seat.inputAt = Date.now();
      seat.input = { steer: scalar(raw.steer, -1), gas: scalar(raw.gas, 0), brake: scalar(raw.brake, 0),
        drift: Boolean(raw.drift), item: Boolean(raw.item), ability: Boolean(raw.ability), lookBack: Boolean(raw.lookBack) };
      if (seat.input.item) seat.pulses.item = true;
      if (seat.input.ability) seat.pulses.ability = true;
    }
    return { accepted: true, tick: room.tick };
  }
  function recordMetrics(room, seat, body, transport) {
    const now = Date.now();
    if (seat.metrics && room.round === seat.metrics.round && now - seat.metrics.at < 1000) return;
    const metric = (name, max) => Number.isFinite(body[name]) ? Math.min(max, Math.max(0, body[name])) : null;
    seat.metrics = { at: now, round: room.round, transport, rttMs: metric('rttMs', 15000),
      jitterMs: metric('jitterMs', 15000), snapshotAgeMs: metric('snapshotAgeMs', 60000),
      snapshotGapPct: metric('snapshotGapPct', 100), fps: metric('fps', 240) };
  }
  function diagnostics() {
    const room = activeRoom(), now = performance.now(), wallTime = Date.now();
    const snapshotRateHz = snapshotCount * 1000 / Math.max(1, now - diagnosticsAt);
    diagnosticsAt = now; snapshotCount = 0;
    const eventLoopLagMs = loopDelay?.count ? Math.max(0, loopDelay.percentile(95) / 1e6 - 20) : null;
    loopDelay?.reset();
    const publicRoom = room && lobby(room);
    const players = room ? members(room).map(seat => {
      const info = publicRoom.seats.find(player => player.index === seat.index);
      const socketOpen = Boolean(seat.socket?.isOpen());
      const transport = !info.connected ? null : socketOpen ? 'websocket' : seat.stream ? 'events' : 'poll';
      const metricsAgeMs = seat.metrics ? Math.max(0, wallTime - seat.metrics.at) : null;
      const metrics = info.connected && seat.metrics?.round === room.round && seat.metrics.transport === transport &&
        metricsAgeMs < 10_000 ? seat.metrics : {};
      const socketAgeMs = socketOpen ? seat.socket.rttAgeMs : null;
      const socketRttMs = Number.isFinite(socketAgeMs) && socketAgeMs < 30_000 ? seat.socket.rttMs : undefined;
      return { name: seat.name, transport, connected: info.connected,
        rttMs: metrics.rttMs ?? socketRttMs,
        latencyAgeMs: Number.isFinite(metrics.rttMs) ? metricsAgeMs : Number.isFinite(socketRttMs) ? socketAgeMs : undefined,
        jitterMs: metrics.jitterMs, snapshotAgeMs: metrics.snapshotAgeMs,
        snapshotGapPct: metrics.snapshotGapPct, fps: metrics.fps, snapshotBacklog: socketOpen ? seat.socket.bufferedAmount : undefined,
        loadState: info.connected ? info.loadState || publicRoom.phase : 'reconnecting',
        loadMs: seat.clientLoadMs };
    }) : [];
    return { phase: publicRoom?.phase || 'waiting', playerCount: players.length, players, eventLoopLagMs,
      connectedPlayers: players.filter(player => player.connected).length, maxPlayers: capacity,
      queuedPlayers: raceQueue?.size() || 0, uptimeSeconds: Math.max(0, now - startedAt) / 1000,
      readyPlayers: publicRoom?.loading?.ready, expectedPlayers: publicRoom?.loading?.expected,
      snapshotRateHz, snapshotBytes,
      skippedSnapshots: room ? members(room).reduce((total, seat) => total + (seat.socket?.skippedSnapshots || 0), 0) : 0 };
  }
  function createRoom(body) {
    if (rooms.size >= 64) fail(503, 'The host is full. Try again later.');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do { code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); }
    while (rooms.has(code) || polling.results(code));
    const seat = newSeat(0, body); seat.ready = true;
    const room = { code, host: 0, phase: 'lobby', round: 0, tick: 0, touched: Date.now(), seats: [seat],
      trackIndex: integer(body.trackIndex, 0, sim.trackCount - 1, 0), cc: sim.normalizeCC(body.cc), difficulty: sim.normalizeDifficulty(body.difficulty),
      botFill: body.botFill !== false, laps: 3, state: null };
    rooms.set(code, room);
    return { seat: seat.index, token: seat.token, room: lobby(room) };
  }
  function joinRoom(room, body) {
    if (inProgress(room)) fail(409, 'A race is underway. Join after it finishes.');
    const index = Array.from({ length: capacity }, (_, i) => i).find(i => !room.seats[i]);
    if (index === undefined) fail(409, 'All eight seats are taken.');
    const seat = newSeat(index, body, members(room)); room.seats[index] = seat; room.touched = Date.now();
    announce(room);
    const preferred = integer(body.driverIndex, 0, names.length - 1, seat.driverIndex);
    const assignment = preferred === seat.driverIndex ? '' : names[preferred] + ' is already on the grid. You joined as ' + names[seat.driverIndex] + '.';
    return { seat: index, token: seat.token, room: lobby(room), assignment };
  }
  function checkAccessCode(req, value) {
    if (!community || visibility !== 'code') return;
    const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const client = (localProxy && req.headers['cf-connecting-ip']) || req.socket.remoteAddress;
    const now = Date.now();
    const recent = privateCodes.get(client);
    if (recent && recent.until > now && recent.count >= 12) fail(429, 'Too many code attempts. Try again in a minute.');
    const expected = community.getCode();
    if (typeof expected === 'string' && /^\d{4}$/.test(expected) && value === expected) return;
    const attempt = recent && recent.until > now ? recent : { count: 0, until: now + 60_000 };
    attempt.count++;
    privateCodes.set(client, attempt);
    fail(403, 'Enter the four-digit code shown on the host laptop.');
  }
  function queueRequest(body, leaving = false) {
    const token = body.token;
    if (typeof token !== 'string' || token.length !== 64 || !queueTokenPattern.test(token))
      fail(400, 'Invalid race queue ticket.');
    const queueKey = crypto.createHash('sha256').update(token).digest('hex');
    let room = activeRoom();
    if (room?.phase === 'lobby') {
      for (const seat of members(room)) {
        if (seat.queueKey && !seat.joinedStream && Date.now() - seat.touched > admissionTimeout) {
          removeSeat(room, seat);
        }
      }
      room = activeRoom();
    }
    const seat = room && members(room).find(player => player.queueKey === queueKey);
    if (leaving) {
      raceQueue.remove(token);
      if (seat && !seat.joinedStream) removeSeat(room, seat);
      return { left: true };
    }
    if (seat) return { admission: { seat: seat.index, token: seat.token, room: lobby(room) } };
    const place = raceQueue.enter(token);
    if (!place) fail(503, 'The race queue is full. Try joining again in a moment.');
    const phase = inProgress(room) ? 'racing' : 'waiting';
    if (place.position !== 1 || phase === 'racing' || (room && members(room).length >= capacity))
      return { ...place, phase };
    const name = typeof body.name === 'string' ? displayName(body.name) : '';
    const options = { ...body, name };
    const admission = room ? joinRoom(room, options) : createRoom(options);
    const admitted = rooms.get(admission.room.code).seats[admission.seat];
    admitted.queueKey = queueKey;
    admitted.customName = name;
    raceQueue.remove(token);
    return { admission };
  }
  function localUrls(port) {
    const addresses = Object.values(os.networkInterfaces()).flat().filter(record =>
      record && !record.internal && record.family === 'IPv4');
    return [...new Set(addresses.map(record => 'http://' + record.address + ':' + port))];
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://rally.local');
      if (!url.pathname.startsWith('/api/rooms/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method unavailable.');
        const requestPath = decodeURIComponent(url.pathname);
        const file = path.resolve(root, '.' + (requestPath === '/' ? '/index.html' : requestPath));
        if (!file.startsWith(root + path.sep) || file.startsWith(path.join(root, 'server') + path.sep))
          fail(404, 'File unavailable.');
        const stat = await fs.promises.stat(file).catch(() => null);
        if (!stat?.isFile()) fail(404, 'File unavailable.');
        res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Length': stat.size, 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
        return;
      }
      const discoverable = singleRoom && (community || operatorOrigin === 'https://rally.catnmice.com');
      if (discoverable && url.pathname === '/api/rooms/status' && req.method === 'GET') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return returnJson(res, { game: 'acorn-rally', name, visibility, hostId, ...status() });
      }
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403, 'Open the game on this host to join.'); }
        if (origin.host !== req.headers.host) fail(403, 'Open the game on this host to join.');
      }
      if (url.pathname === '/api/rooms/version' && req.method === 'GET') {
        const localSocket = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || '');
        return returnJson(res, { game: 'acorn-rally', version: 1, singleRoom, queueEnabled: singleRoom,
          connectionMetrics: true,
          ...(community && { transport: 'poll', socketTransport: raceSockets?.available === true, hostId, name, visibility }),
          addresses: localSocket && localHost ? localUrls(server.address().port) : [] });
      }
      if (singleRoom && url.pathname === '/api/rooms/status' && req.method === 'GET')
        return returnJson(res, status());
      if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json'))
        fail(415, 'Send a JSON room request.');
      const body = req.method === 'POST' ? await readJson(req) : {};
      if (req.method === 'POST') {
        if (singleRoom && ['/api/rooms/queue', '/api/rooms/queue/leave'].includes(url.pathname)) {
          if (url.pathname === '/api/rooms/queue') checkAccessCode(req, body.code);
          await raceQueue.ready();
          return returnJson(res, queueRequest(body, url.pathname.endsWith('/leave')));
        }
        if (url.pathname === '/api/rooms/enter' && singleRoom) fail(409, 'Join the race queue to get a seat.');
        if (url.pathname === '/api/rooms/create') {
          if (singleRoom) fail(409, 'Join the race queue to get a seat.');
          return returnJson(res, createRoom(body), 201);
        }
      }
      const match = /^\/api\/rooms\/([A-Z2-9]{5})\/(join|events|poll|resume|control|input|metrics|ready|driver|config|start|loaded|leave)$/.exec(url.pathname);
      const room = match && (rooms.get(match[1]) || (community && match[2] === 'poll' && polling.results(match[1])));
      if (!room) fail(404, 'No room on this host matches that code.');
      const action = match[2];
      if (action === 'join' && req.method === 'POST') {
        if (singleRoom) fail(409, 'Join the race queue to get a seat.');
        return returnJson(res, joinRoom(room, body), 201);
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '') ||
        (action === 'events' ? url.searchParams.get('seatKey') : null);
      const seat = authenticate(room, token);
      if (action === 'poll' && req.method === 'GET' && community) {
        if (!room.retired) {
          const wasConnected = connected(seat);
          seat.lastPoll = Date.now(); seat.joinedStream = true;
          const newGridClient = setGridClient(room, seat, url.searchParams.get('grid'));
          setHuman(room, seat, seat.driving);
          if (!wasConnected || newGridClient) announce(room);
        }
        return polling.poll(res, room, seat, url.searchParams.get('after'), returnEncodedJson);
      }
      if (action === 'events' && req.method === 'GET') {
        const previous = seat.stream;
        seat.stream = res; seat.joinedStream = true;
        setGridClient(room, seat, url.searchParams.get('grid'));
        if (previous && previous !== res) previous.end();
        req.socket.setNoDelay(true);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform',
          Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' });
        res.write('retry: 700\n\n'); setHuman(room, seat, seat.driving);
        announce(room);
        if (room.state) emit(seat, 'snapshot', JSON.stringify(raceSnapshot(room)));
        res.on('close', () => {
          if (seat.stream !== res) return;
          seat.stream = null; seat.touched = room.touched = Date.now(); seat.input = { ...neutral }; seat.pulses = {};
          setHuman(room, seat, seat.driving && connected(seat));
          announce(room);
        });
        return;
      }
      if (req.method !== 'POST') fail(405, 'Method unavailable.');
      if (action === 'resume') return returnJson(res, { token: seat.token, seat: seat.index, room: lobby(room) });
      if (action === 'control') {
        seat.driving = Boolean(body.driving);
        setHuman(room, seat, seat.driving && connected(seat));
        seat.input = { ...neutral }; seat.pulses = {};
        if (inProgress(room) && !members(room).some(s => s.driving)) {
          if (singleRoom) retireRoom(room, 'abandoned');
          else returnToGrid(room, 'Everyone left the race. The grid is open for another.');
        }
        else if (room.phase === 'loading') {
          announce(room);
          advanceGrid(room, Date.now());
        }
        return returnJson(res, { driving: seat.driving });
      }
      if (action === 'input') return returnJson(res, acceptInput(room, seat, body));
      if (action === 'metrics') {
        if (transports.has(body.transport)) recordMetrics(room, seat, body, body.transport);
        return returnJson(res, { ok: true });
      }
      if (action === 'loaded') {
        const now = Date.now();
        if (!seat.loadBarrier || body.grid !== seat.loadBarrier || body.round !== room.round ||
            !room.load?.participants.has(seat.index))
          return returnJson(res, { accepted: false });
        if (seat.loadedAt) return returnJson(res, { accepted: true });
        if (room.phase !== 'loading') return returnJson(res, { accepted: false });
        if (now >= room.load.deadline) {
          advanceGrid(room, now);
          return returnJson(res, { accepted: false });
        }
        seat.loadedAt = now;
        seat.clientLoadMs = integer(body.loadMs, 0, gridLoadTimeout, null);
        announce(room);
        advanceGrid(room, now);
        return returnJson(res, { accepted: true });
      }
      if (action === 'leave') { removeSeat(room, seat); return returnJson(res, { left: true }); }
      if (inProgress(room)) fail(409, 'Finish the race before changing the grid.');
      if (action === 'ready') seat.ready = body.ready !== false || seat.index === room.host;
      if (action === 'driver') {
        const wanted = integer(body.driverIndex, 0, names.length - 1, -1);
        if (wanted < 0) fail(400, 'Choose one of the eight racers.');
        if (members(room).some(s => s !== seat && s.driverIndex === wanted))
          fail(409, names[wanted] + ' has already been selected. Choose another racer.');
        if (wanted !== seat.driverIndex) seat.ready = seat.index === room.host;
        seat.driverIndex = wanted;
        seat.name = (singleRoom ? seat.customName : displayName(body.name)) || names[wanted];
      }
      if (action === 'config' || action === 'start') {
        if (seat.index !== room.host) fail(403, 'Only the host can start or change this race.');
        if (action === 'config') {
          room.trackIndex = integer(body.trackIndex, 0, sim.trackCount - 1, room.trackIndex);
          if (sim.engineClasses.includes(Number(body.cc))) room.cc = Number(body.cc);
          if (sim.difficulties.includes(body.difficulty)) room.difficulty = body.difficulty;
          if (typeof body.botFill === 'boolean') room.botFill = body.botFill;
          for (const s of members(room)) s.ready = s.index === room.host;
        } else begin(room);
      }
      announce(room);
      return returnJson(res, { room: lobby(room) });
    } catch (err) {
      if (res.headersSent) res.destroy();
      else returnJson(res, { error: err.status ? err.message : 'The host could not process this request.' }, err.status || 500);
    }
  });
  const raceSockets = community ? createRaceSockets({
    server,
    onHello(code, token, peer, hello) {
      const room = rooms.get(code);
      if (!room) fail(404, 'No room on this host matches that code.');
      const seat = authenticate(room, token);
      const previous = seat.socket;
      seat.socket = peer; seat.joinedStream = true;
      setGridClient(room, seat, hello.grid);
      previous?.close();
      setHuman(room, seat, seat.driving);
      peer.send('room', lobby(room));
      if (room.state) peer.send('snapshot', raceSnapshot(room));
      announce(room);
      return { room, seat };
    },
    onInput: acceptInput,
    onMetrics: (room, seat, body) => recordMetrics(room, seat, body, 'websocket'),
    onClose(room, seat, peer) {
      if (seat.socket !== peer) return;
      seat.socket = null; seat.touched = room.touched = Date.now();
      seat.input = { ...neutral }; seat.pulses = {};
      setHuman(room, seat, seat.driving && connected(seat));
      if (rooms.get(room.code) === room) announce(room);
    }
  }) : null;
  return { server, rooms, tick, localUrls, status, diagnostics, close() {
    if (timer) clearInterval(timer);
    clearInterval(cleanup);
    loopDelay?.disable();
    raceSockets?.close();
    raceQueue?.close();
    polling.close();
    for (const room of rooms.values()) for (const seat of members(room)) {
      seat.finishPoll?.();
      seat.stream?.end();
    }
    server.closeAllConnections?.();
    return new Promise(resolve => server.close(resolve));
  } };
}

if (require.main === module) {
  const port = integer(Number(process.env.ACORN_RALLY_PORT || 8791), 1, 65535, 8791);
  const singleRoom = process.argv.includes('--single-room');
  const visibility = process.env.ACORN_RALLY_VISIBILITY === 'code' ? 'code' : 'public';
  const name = String(process.env.ACORN_RALLY_SERVER_NAME || 'Acorn Rally').trim().slice(0, 40) || 'Acorn Rally';
  const hostId = crypto.randomUUID();
  const communityMode = singleRoom && process.env.ACORN_RALLY_COMMUNITY === '1';
  const onStatus = update => {
    if (process.connected) process.send({ ...update, type: 'rally-host-status' }, () => {});
    console.log('  ' + name + ' / ' + update.status + (update.code ? ' / code ' + update.code : '') +
      (update.origin ? ' / ' + update.origin : '') + (update.message ? ' / ' + update.message : ''));
  };
  const community = communityMode ? require('./community-host.cjs').createCommunityHost({
    port, probeId: hostId, env: process.env, getStatus: () => host.status(), onStatus
  }) : null;
  const host = createRallyServer({ singleRoom, community, visibility, name, hostId,
    operatorOrigin: process.env.ACORN_RALLY_PUBLIC_ORIGIN });
  let publisher;
  let diagnosticsTimer;
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    publisher?.close();
    clearInterval(diagnosticsTimer);
    await host.close();
    if (community) await community.close();
    if (process.connected) process.disconnect();
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  if (process.send) {
    process.on('message', message => { if (message?.type === 'stop') void shutdown(); });
    process.once('disconnect', shutdown);
  }
  host.server.once('error', err => {
    console.error('Acorn Rally could not open port', port, '—', err.code || err.message);
    process.exitCode = err.code === 'EADDRINUSE' ? 98 : 1;
    void shutdown();
  });
  host.server.listen(port, '0.0.0.0', () => {
    const local = 'http://localhost:' + port;
    console.log('\n  ACORN RALLY  /  ' + (singleRoom ? 'LOBBY SERVER' : 'PC HOST') + '\n\n  Play here: ' + local);
    for (const address of host.localUrls(port)) console.log('  Phone lobby: ' + address + '/?room=join');
    console.log('\n  On the same Wi-Fi, open a Phone lobby link in each phone’s browser.');
    console.log('  ' + (singleRoom ? 'Join the race queue to get the next available seat.' : 'One phone creates a room and shares its invite.'));
    console.log('  Keep this window open while racing.\n');
    if (community) void Promise.resolve(community.start()).catch(() => onStatus({
      status: 'lan-only', name, visibility, message: 'Internet listing unavailable. The local race server is running.'
    }));
    else if (singleRoom && process.env.ACORN_RALLY_PUBLIC_ORIGIN) {
      const { createFirebaseLobbyPublisher } = require('./firebase-lobby.cjs');
      publisher = createFirebaseLobbyPublisher({ getStatus: host.status });
    }
    if (community && process.connected) {
      const sendDiagnostics = () => {
        if (process.connected) process.send({ type: 'rally-host-diagnostics',
          diagnostics: { ...host.diagnostics(), ...community.diagnostics(), localStatus: 'ready' } }, () => {});
      };
      sendDiagnostics();
      diagnosticsTimer = setInterval(sendDiagnostics, 3000);
      diagnosticsTimer.unref();
    }
    if (process.argv.includes('--open') && process.platform === 'win32') {
      require('node:child_process').execFile('rundll32.exe', ['url.dll,FileProtocolHandler', local + '/?room=join'], () => {});
    }
  });
}

module.exports = { createRallyServer };
