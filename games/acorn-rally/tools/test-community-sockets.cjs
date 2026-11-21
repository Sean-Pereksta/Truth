'use strict';

const assert = require('node:assert/strict');
const { once, EventEmitter } = require('node:events');
const http = require('node:http');
const { test } = require('node:test');
const { createRaceSockets } = require('../server/community-socket.cjs');
const { WebSocket } = require('../server/vendor/ws');
const { socketPair } = require('./test-support/socket-pair.cjs');

const token = 'a'.repeat(48);
const code = 'ABC23';
const origin = 'http://rally.test';

function connect(server, { requestOrigin = origin, suffix = '' } = {}) {
  const pair = socketPair();
  const client = new WebSocket('ws://rally.test/api/rooms/' + code + '/socket' + suffix,
    { origin: requestOrigin, closeTimeout: 100, createConnection: () => pair.client });
  const messages = new EventEmitter();
  client.on('error', () => {});
  client.on('message', data => {
    const value = JSON.parse(data.toString());
    messages.emit(value.type, value.value);
  });
  server.emit('connection', pair.server);
  return { client, messages };
}

function fixture(context) {
  const server = http.createServer();
  const room = {}, seat = {}, received = [], closed = [];
  const adapter = createRaceSockets({
    server,
    onHello(requestedCode, presentedToken, peer, hello) {
      if (requestedCode !== code || presentedToken !== token) throw new Error('Invalid seat');
      assert.equal(hello.grid, 'ready-grid');
      peer.send('room', { phase: 'racing' });
      return { room, seat };
    },
    onInput(inputRoom, inputSeat, body) {
      received.push({ room: inputRoom, seat: inputSeat, input: body.input });
      return { accepted: true, tick: 45 };
    },
    onMetrics(_, __, body) { received.push(body.rttMs); },
    onClose(_, __, peer) { closed.push(peer); }
  });
  context.after(() => adapter.close());
  return { server, room, seat, received, closed, adapter };
}

async function join(server) {
  const { client, messages } = connect(server);
  await once(client, 'open');
  const notified = once(messages, 'room');
  client.send(JSON.stringify({ type: 'hello', token, grid: 'ready-grid' }));
  assert.deepEqual(await notified, [{ phase: 'racing' }]);
  return { client, messages };
}

test('streams authenticated race snapshots, accepts controls, and echoes round-trip probes', { timeout: 5000 }, async context => {
  const { server, room, seat, received, adapter } = fixture(context);
  const { client, messages } = await join(server);
  assert.equal(client.extensions, 'permessage-deflate');

  const snapshot = { round: 2, tick: 45, state: { payload: 'x'.repeat(8400) } };
  const snapshotEvent = once(messages, 'snapshot');
  adapter.publish(room, 'snapshot', snapshot);
  assert.deepEqual(await snapshotEvent, [snapshot]);

  const inputAck = once(messages, 'input');
  client.send(JSON.stringify({ type: 'input', round: 2, seq: 8, input: { gas: 1 } }));
  assert.deepEqual(await inputAck, [{ accepted: true, tick: 45, seq: 8 }]);
  assert.deepEqual(received, [{ room, seat, input: { gas: 1 } }]);

  const pong = once(messages, 'pong');
  client.send(JSON.stringify({ type: 'metrics', rttMs: 42 }));
  client.send(JSON.stringify({ type: 'ping', id: 12 }));
  assert.deepEqual(await pong, [{ id: 12 }]);
  assert.equal(received.at(-1), 42);
});

test('rejects cross-origin requests, query tokens and unverified seats', { timeout: 5000 }, async context => {
  const { server, received } = fixture(context);
  for (const [request, expected] of [[{ requestOrigin: 'http://other.test' }, 403], [{ suffix: '?token=' + token }, 404]]) {
    const { client } = connect(server, request);
    const [error] = await once(client, 'error');
    assert.match(error.message, new RegExp(String(expected)));
  }

  const { client } = connect(server);
  await once(client, 'open');
  const denied = once(client, 'close');
  client.send(JSON.stringify({ type: 'input', round: 2, seq: 8, input: { gas: 1 } }));
  const [closeCode] = await denied;
  assert.equal(closeCode, 1008);
  assert.equal(received.length, 0);
});

test('a resumed seat replaces its old socket without announcing a fresh disconnect', { timeout: 5000 }, async context => {
  const { server, room, closed, adapter } = fixture(context);
  const first = await join(server);
  const oldClosed = once(first.client, 'close');
  const second = await join(server);
  await oldClosed;
  assert.equal(closed.length, 0);

  const retired = once(second.messages, 'retired');
  adapter.publish(room, 'retired', { round: 2 });
  assert.deepEqual(await retired, [{ round: 2 }]);
  const disconnected = once(second.client, 'close');
  second.client.close();
  await disconnected;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed.length, 1);
});

test('a pack with no socket runtime leaves its existing HTTP listeners alone', () => {
  const server = http.createServer();
  const adapter = createRaceSockets({ server, runtime: null });
  assert.equal(adapter.available, false);
  assert.equal(server.listenerCount('upgrade'), 0);
  adapter.publish({}, 'room', {});
  adapter.close();
});
