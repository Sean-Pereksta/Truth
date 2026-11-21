'use strict';

const { performance } = require('node:perf_hooks');

const socketPath = /^\/api\/rooms\/([A-Z2-9]{5})\/socket$/;
const seatToken = /^[a-f0-9]{48}$/;
const handshakeMs = 5_000;
const heartbeatMs = 15_000;
const pendingLimit = 32;
const snapshotBacklog = 32 * 1024;
const sendBacklog = 128 * 1024;
const messagesPerSecond = 100;

function bundledWebSocket() {
  try { return require('./vendor/ws'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return null;
  }
}

function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const host = req.headers.host;
    if (!host || /[\s\/\\?#@]/.test(host)) return false;
    return (origin.protocol === 'http:' || origin.protocol === 'https:')
      && origin.origin === req.headers.origin
      && origin.origin === new URL(origin.protocol + '//' + host).origin;
  } catch { return false; }
}

function rejectUpgrade(socket, response) {
  socket.once('error', () => socket.destroy());
  socket.end('HTTP/1.1 ' + response + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
}

function createRaceSockets({ server, onHello, onInput, onMetrics, onClose, runtime = bundledWebSocket() }) {
  if (!runtime) return { available: false, publish() {}, close() {} };
  const { WebSocket, WebSocketServer } = runtime;
  const sockets = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: 4096,
    closeTimeout: 1_000,
    perMessageDeflate: {
      // A dropped snapshot stays independent of compression history. Limit CPU
      // contention with the simulation and skip compression of small replies.
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      concurrencyLimit: 3,
      threshold: 512,
      zlibDeflateOptions: { level: 2 }
    }
  });
  const clients = new Set();
  const rooms = new Map();
  const activeSeats = new WeakMap();
  let pending = 0, closed = false;

  function send(record, json, discardable) {
    const { socket } = record;
    if (socket.readyState !== WebSocket.OPEN) return false;
    if (discardable && socket.bufferedAmount > snapshotBacklog) {
      record.skippedSnapshots++;
      return false;
    }
    if (socket.bufferedAmount > sendBacklog) {
      socket.terminate();
      return false;
    }
    socket.send(json, error => { if (error) socket.terminate(); });
    return true;
  }

  function discardable(type, value) {
    return type === 'snapshot' && !value.state?.done;
  }

  function encode(type, value) { return JSON.stringify({ type, value }); }

  function clearHandshake(record) {
    if (!record.awaitingHello) return;
    record.awaitingHello = false;
    clearTimeout(record.timeout);
    pending--;
  }

  function attach(socket, code) {
    const record = {
      socket, room: null, seat: null, awaitingHello: true, seenHeartbeat: true,
      pingAt: 0, rttMs: null, skippedSnapshots: 0, intervalAt: performance.now(), messages: 0
    };
    const peer = {
      get bufferedAmount() { return socket.bufferedAmount; },
      get skippedSnapshots() { return record.skippedSnapshots; },
      get rttMs() { return record.rttMs; },
      isOpen() { return socket.readyState === WebSocket.OPEN; },
      send(type, value) { return send(record, encode(type, value), discardable(type, value)); },
      close() { socket.close(1000); }
    };
    clients.add(record);
    pending++;
    record.timeout = setTimeout(() => socket.close(1008, 'Seat authentication timed out.'), handshakeMs);
    record.timeout.unref();
    socket.on('error', () => socket.terminate());
    socket.on('pong', () => {
      record.seenHeartbeat = true;
      if (record.pingAt) record.rttMs = Math.round(performance.now() - record.pingAt);
    });
    socket.on('close', () => {
      clearHandshake(record);
      clients.delete(record);
      if (!record.room) return;
      const members = rooms.get(record.room);
      members.delete(record);
      if (!members.size) rooms.delete(record.room);
      if (activeSeats.get(record.seat) !== record) return;
      activeSeats.delete(record.seat);
      onClose?.(record.room, record.seat, peer);
    });
    socket.on('message', (data, binary) => {
      if (binary) return socket.close(1003, 'Send JSON messages.');
      const now = performance.now();
      if (now - record.intervalAt >= 1000) {
        record.intervalAt = now;
        record.messages = 0;
      }
      if (++record.messages > messagesPerSecond) return socket.close(1008, 'Too many messages.');
      try {
        const body = JSON.parse(data.toString());
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        if (record.awaitingHello) {
          if (body.type !== 'hello' || typeof body.token !== 'string' || !seatToken.test(body.token)) throw new Error();
          const joined = onHello(code, body.token, peer, body);
          if (!joined?.room || !joined?.seat) throw new Error();
          clearHandshake(record);
          record.room = joined.room;
          record.seat = joined.seat;
          const previous = activeSeats.get(record.seat);
          activeSeats.set(record.seat, record);
          previous?.socket.close(1000, 'Seat reconnected.');
          if (!rooms.has(record.room)) rooms.set(record.room, new Set());
          rooms.get(record.room).add(record);
          return;
        }
        if (activeSeats.get(record.seat) !== record) return;
        if (body.type === 'ping') {
          if (!Number.isSafeInteger(body.id)) throw new Error();
          peer.send('pong', { id: body.id });
        } else if (body.type === 'input') {
          const result = onInput(record.room, record.seat, body, peer);
          peer.send('input', { ...result, seq: body.seq });
        } else if (body.type === 'metrics') {
          onMetrics?.(record.room, record.seat, body, peer);
        } else {
          throw new Error();
        }
      } catch { socket.close(1008, 'Room request rejected.'); }
    });
  }

  function upgrade(req, socket, head) {
    const match = socketPath.exec(req.url);
    if (!match) return rejectUpgrade(socket, '404 Not Found');
    if (!sameOrigin(req)) return rejectUpgrade(socket, '403 Forbidden');
    if (pending >= pendingLimit) return rejectUpgrade(socket, '503 Service Unavailable');
    sockets.handleUpgrade(req, socket, head, upgraded => attach(upgraded, match[1]));
  }

  const heartbeat = setInterval(() => {
    for (const record of clients) {
      if (!record.seenHeartbeat) {
        record.socket.terminate();
        continue;
      }
      if (record.socket.readyState !== WebSocket.OPEN) continue;
      record.seenHeartbeat = false;
      record.pingAt = performance.now();
      record.socket.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();
  server.on('upgrade', upgrade);
  server.once('close', close);

  function publish(room, type, value) {
    const members = rooms.get(room);
    if (!members?.size) return;
    const json = encode(type, value);
    const maySkip = discardable(type, value);
    for (const record of members) {
      if (activeSeats.get(record.seat) === record) send(record, json, maySkip);
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    server.removeListener('upgrade', upgrade);
    server.removeListener('close', close);
    for (const record of clients) record.socket.terminate();
    sockets.close();
  }

  return { available: true, publish, close };
}

module.exports = { createRaceSockets };
