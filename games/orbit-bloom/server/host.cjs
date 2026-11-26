'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '..');
const api = '/api/orbit-bloom/';
const capacity = 4;
const timeoutMs = 15_000;
const maxBodyBytes = 1024;
const entityId = /^[a-zA-Z0-9_-]{1,48}$/;
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};
const rules = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "connect-src 'self' https://firestore.googleapis.com https://*.trycloudflare.com; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': rules,
};

function json(res, status, body) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readBody(req) {
  if (!/^application\/json(?:$|;)/i.test(req.headers['content-type'] || '')) {
    throw requestError(415, 'Send a JSON request.');
  }
  if (Number(req.headers['content-length']) > maxBodyBytes) {
    req.resume();
    throw requestError(413, 'The request is too large.');
  }
  const parts = [];
  let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    if (bytes > maxBodyBytes) throw requestError(413, 'The request is too large.');
    parts.push(part);
  }
  try {
    const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {}
  throw requestError(400, 'The request is incomplete.');
}

function cleanName(value, fallback) {
  return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 24) || fallback : fallback;
}

function validateCommand(command) {
  if (!command || typeof command !== 'object') return false;
  switch (command.type) {
    case 'move':
      return Number.isFinite(command.x) && Number.isFinite(command.y) && Math.abs(command.x) <= 1 && Math.abs(command.y) <= 1;
    case 'target':
      if (typeof command.stationId === 'string') return entityId.test(command.stationId);
      if (typeof command.conveyorId === 'string') return entityId.test(command.conveyorId);
      if (typeof command.plantId === 'string') return entityId.test(command.plantId);
      return Number.isFinite(command.x) && Number.isFinite(command.y) &&
        command.x >= 0 && command.x < 64 && command.y >= 0 && command.y < 64;
    case 'interact':
      return command.stationId === undefined || typeof command.stationId === 'string' && entityId.test(command.stationId);
    case 'drop':
      return true;
    default:
      return false;
  }
}

async function serveFile(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const names = relative.split('/');
  const type = mime[path.extname(relative)];
  if (!type || !names.every(name => /^[a-z0-9_-][a-z0-9_.-]*$/i.test(name)) ||
      ['server', 'tests', 'tools', 'node_modules'].includes(names[0].toLowerCase())) {
    throw requestError(404, 'That file is unavailable.');
  }
  try {
    const data = await fs.readFile(path.join(root, ...names));
    res.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) throw requestError(404, 'That file is unavailable.');
    throw error;
  }
}

async function createRoomServer({ port = 0, name = 'Orbit Bloom', onFailure } = {}) {
  const [{ createMatch, stepMatch, applyCommand, addPlayer, removePlayer }, { LEVELS }] = await Promise.all([
    import('../sim.mjs'), import('../levels.mjs'),
  ]);
  const levels = new Set(LEVELS.map(level => level.id));
  const players = new Map();
  const sockets = new Set();
  let state = null;
  let hostId = null;
  let levelId = LEVELS[0].id;
  let revision = 0;
  let round = 0;
  let previousTick = performance.now();
  let closing = false;
  const status = () => ({
    phase: state?.phase ?? 'waiting', players: players.size, capacity, queued: 0,
    joinable: state?.phase !== 'finished' && players.size < capacity,
  });

  function snapshot() {
    const { phase, joinable } = status();
    return { phase, joinable, capacity, name, revision, round, levelId, hostId, state,
      players: [...players.values()].map(({ id, name, ready }) => ({ id, name, ready })) };
  }

  function playerFor(req) {
    const key = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
    return players.get(key);
  }

  function publicPlayer(player) { return { id: player.id, name: player.name }; }

  function join(req, data) {
    const existing = playerFor(req);
    if (existing) {
      existing.lastSeen = performance.now();
      return existing;
    }
    if (!status().joinable) throw requestError(409, 'This greenhouse is full or the shift has ended.');
    const now = performance.now();
    const player = { token: randomBytes(32).toString('base64url'), id: randomUUID(),
      name: cleanName(data.name, 'Gardener ' + (players.size + 1)), ready: false,
      lastSeen: now, movementExpires: 0, inputWindow: now, inputs: 0, sequence: 0 };
    if (state && !addPlayer(state, publicPlayer(player))) throw requestError(409, 'This shift has no open seats.');
    players.set(player.token, player);
    hostId ??= player.id;
    revision++;
    return player;
  }

  function leave(player) {
    players.delete(player.token);
    if (state) removePlayer(state, player.id);
    if (hostId === player.id) hostId = players.values().next().value?.id ?? null;
    if (!players.size) state = null;
    revision++;
  }

  function tick() {
    const now = performance.now();
    const delta = Math.min(now - previousTick, 250);
    previousTick = now;
    for (const player of players.values()) {
      const timeOffline = now - player.lastSeen;
      if (timeOffline > timeoutMs) leave(player);
      else if (player.movementExpires && now >= player.movementExpires && state?.phase === 'playing') {
        applyCommand(state, player.id, { type: 'move', x: 0, y: 0 });
        player.movementExpires = 0;
      }
    }
    if (state?.phase === 'playing') {
      stepMatch(state, delta);
      revision++;
    }
  }

  async function handle(req, res) {
    if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) {
      throw requestError(400, 'Invalid request path.');
    }
    const { pathname } = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith(api)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') throw requestError(405, 'This request is unavailable.');
      return serveFile(req, res, pathname);
    }
    if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
      throw requestError(403, 'Open the greenhouse on this server.');
    }
    const action = pathname.slice(api.length);
    if (action === 'state' && req.method === 'GET') {
      const player = playerFor(req);
      if (!player) throw requestError(401, 'Your seat expired. Join the greenhouse again.');
      player.lastSeen = performance.now();
      return json(res, 200, snapshot());
    }
    if (req.method !== 'POST') throw requestError(405, 'This request is unavailable.');
    if (!['join', 'leave', 'ready', 'start', 'command'].includes(action)) throw requestError(404, 'This request is unavailable.');
    const data = await readBody(req);
    if (action === 'join') {
      const player = join(req, data);
      return json(res, 200, { playerId: player.id, token: player.token, sequence: player.sequence, snapshot: snapshot() });
    }
    const player = playerFor(req);
    if (!player) throw requestError(401, 'Your seat expired. Join the greenhouse again.');
    player.lastSeen = performance.now();
    if (action === 'leave') {
      leave(player);
      return json(res, 200, {});
    }
    if (action === 'ready') {
      if (typeof data.ready !== 'boolean') throw requestError(400, 'Set ready or waiting.');
      player.ready = data.ready;
      revision++;
      return json(res, 200, snapshot());
    }
    if (action === 'start') {
      if (player.id !== hostId) throw requestError(403, 'The greenhouse host starts the shift.');
      if (state?.phase === 'playing') throw requestError(409, 'The current shift is still running.');
      if (!levels.has(data.levelId)) throw requestError(400, 'Choose a greenhouse from the campaign.');
      levelId = data.levelId;
      state = createMatch({ levelId, players: [...players.values()].map(publicPlayer) });
      for (const member of players.values()) member.movementExpires = 0;
      round++;
      revision++;
      return json(res, 200, snapshot());
    }
    if (!validateCommand(data.command) || !Number.isSafeInteger(data.sequence) || data.sequence < 1) {
      throw requestError(400, 'That gardening action is unavailable.');
    }
    if (state?.phase === 'playing' && data.round === round && data.sequence > player.sequence) {
      const now = performance.now();
      if (now - player.inputWindow >= 1000) {
        player.inputs = 0;
        player.inputWindow = now;
      }
      if (++player.inputs > 60) throw requestError(429, 'Too many gardening actions. Try again shortly.');
      player.sequence = data.sequence;
      const accepted = applyCommand(state, player.id, data.command);
      if (data.command.type === 'move') {
        player.movementExpires = data.command.x || data.command.y ? now + 1500 : 0;
      } else if (data.command.type === 'target' && accepted) player.movementExpires = 0;
      revision++;
    }
    return json(res, 200, {});
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
      if (res.headersSent || res.destroyed) return;
      json(res, error.status ?? (error instanceof URIError ? 400 : 500),
        { error: error.status ? error.message : 'The greenhouse could not complete that request.' });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 8000;
  server.keepAliveTimeout = 5000;
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const timer = setInterval(() => {
    try { tick(); }
    catch (error) { void close(); onFailure?.(error); }
  }, 50);
  timer.unref();
  let closePromise;
  function close() {
    closing = true;
    clearInterval(timer);
    if (!closePromise) {
      for (const socket of sockets) socket.destroy();
      closePromise = new Promise(resolve => server.close(resolve));
    }
    return closePromise;
  }
  server.on('error', error => { if (!closing) { void close(); onFailure?.(error); } });
  server.on('close', () => {
    clearInterval(timer);
    if (!closing) onFailure?.(new Error('The Orbit Bloom greenhouse stopped.'));
  });
  return { server, origin: 'http://127.0.0.1:' + server.address().port, getStatus: status, close };
}

if (require.main === module) {
  createRoomServer({ port: Number(process.env.PORT || 8797), onFailure: error => {
    console.error(error.message);
    process.exitCode = 1;
  } }).then(room => {
    console.log('Open ' + room.origin + '/#managed=orbit-bloom to host a greenhouse.');
    const stop = () => { void room.close(); };
    process.once('SIGINT', stop).once('SIGTERM', stop);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { createRoomServer };
