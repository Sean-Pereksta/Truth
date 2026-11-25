'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Readable, PassThrough } = require('node:stream');
const { createRallyServer } = require('../server/host.cjs');
const WebSocket = require('../server/vendor/ws');
const { socketPair } = require('./test-support/socket-pair.cjs');
const hostGrid = '1'.repeat(16);
const rivalGrid = '2'.repeat(16);
const refreshedGrid = '3'.repeat(16);

function fixture(visibility, name) {
  const host = createRallyServer({ singleRoom: true, automatic: false, name, visibility,
    hostId: name, community: { getCode: () => '0042' } });
  async function request(path, { data, key, origin = 'https://race.example' } = {}) {
    const req = Readable.from(data ? [Buffer.from(JSON.stringify(data))] : []);
    Object.assign(req, { url: '/api/rooms/' + path, method: data ? 'POST' : 'GET',
      headers: { host: 'race.example', origin, ...(data && { 'content-type': 'application/json' }), ...(key && { authorization: 'Bearer ' + key }) },
      socket: { remoteAddress: '192.168.1.33', setNoDelay() {} } });
    return new Promise(resolve => {
      let text = ''; const headers = {}; const res = new PassThrough();
      res.setHeader = (key, value) => { headers[key] = value; };
      res.writeHead = code => { res.status = code; res.headersSent = true; };
      res.on('data', chunk => { text += chunk.toString(); });
      res.on('end', () => resolve({ status: res.status, headers, body: JSON.parse(text) }));
      host.server.emit('request', req, res);
    });
  }
  return { host, request };
}

test('public and code servers operate independently and handle polling through retirement', async t => {
  const pub = fixture('public', 'Walnut Cup');
  const locked = fixture('code', 'Kitchen GP');
  t.after(() => Promise.all([pub.host.close(), locked.host.close()]));
  const token = 'b'.repeat(64);
  const q = data => ({ data: { token, name: 'Sean', ...data } });
  const version = await locked.request('version');
  assert.equal(version.body.transport, 'poll');
  assert.equal(version.body.socketTransport, true);
  assert.equal(version.body.visibility, 'code');
  assert.equal(JSON.stringify(version.body).includes('0042'), false);
  const probe = await pub.request('status', { origin: 'https://sean-pereksta.github.io' });
  assert.equal(probe.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(probe.body.name, 'Walnut Cup');
  const denied = await locked.request('queue', q({}));
  assert.equal(denied.status, 403);
  const allowed = await locked.request('queue', q({ code: '0042' }));
  assert.equal(allowed.body.admission.seat, 0);
  const admitted = await pub.request('queue', q({}));
  const rival = await pub.request('queue', { data: { token: 'c'.repeat(64), name: 'Racer Two' } });
  assert.equal(admitted.body.admission.seat, 0);
  assert.equal(rival.body.admission.seat, 1);
  const { room, token: key } = admitted.body.admission;
  const action = (path, options) => pub.request(room.code + '/' + path, options);
  const rivalKey = rival.body.admission.token;
  const poll = (after, seatKey = key, grid = seatKey === key ? hostGrid : rivalGrid) =>
    action('poll?after=' + after + '&grid=' + grid, { key: seatKey });
  const first = await poll(-1);
  assert.equal(first.body.room.seats[0].connected, true);
  await poll(-1, rivalKey, '');
  const oldClient = await action('start', { data: {}, key });
  assert.equal(oldClient.status, 409);
  assert.match(oldClient.body.error, /Refresh Acorn Rally.*Racer Two/);
  await poll(-1, rivalKey);
  const current = await poll(-1);
  const pending = poll(current.body.revision);
  const started = await action('start', { data: {}, key });
  assert.equal(started.body.room.phase, 'loading');
  assert.equal(started.body.room.loading.expected, 2);
  assert.equal(started.body.room.loading.ready, 0);
  const update = await pending;
  assert.equal(update.body.snapshot.state.racers[0].human, true);
  assert.equal(update.body.snapshot.state.racers[1].name, 'Racer Two');
  const live = pub.host.rooms.get(room.code);
  const report = (key, grid, round = live.round) => action('loaded', { data: { round, grid, loadMs: 88 }, key });
  for (let i = 0; i < 300; i++) pub.host.tick();
  assert.equal(live.tick, 0);
  assert.equal(live.state.countdown, 3);
  assert.equal(live.state.time, 0);
  assert.equal((await report(key, hostGrid, live.round - 1)).body.accepted, false);
  assert.equal((await report(key, hostGrid)).body.accepted, true);
  assert.equal((await report(key, hostGrid)).body.accepted, true);
  assert.equal((await poll(-1)).body.room.loading.ready, 1);
  const refreshed = await poll(-1, key, refreshedGrid);
  assert.equal(refreshed.body.room.loading.ready, 0);
  assert.equal((await report(key, hostGrid)).body.accepted, false);
  assert.equal((await report(rivalKey, rivalGrid)).body.accepted, true);
  assert.equal(live.phase, 'loading');
  assert.equal((await report(key, refreshedGrid)).body.accepted, true);
  assert.equal(live.phase, 'racing');
  assert.equal(live.state.countdown, 3);
  pub.host.tick();
  assert.ok(live.state.countdown < 3);
  live.state.racers[0].finish = live.state.racers[1].finish = 10;
  pub.host.tick();
  assert.equal(pub.host.rooms.size, 0);
  assert.equal(locked.host.rooms.size, 1);
  const final = await poll(-1);
  assert.equal(final.body.retired.code, room.code);
  assert.equal(final.body.room.phase, 'finished');
  assert.equal(final.body.snapshot.state.done, true);
  assert.equal((await poll(-1, 'expired')).status, 403);
  assert.equal((await action('resume', { key, data: {} })).status, 404);
});

async function prepare(host) {
  const hostSeat = (await host.request('queue', { data: { token: 'e'.repeat(64), name: 'Host' } })).body.admission;
  const rivalSeat = (await host.request('queue', { data: { token: 'f'.repeat(64), name: 'Rival' } })).body.admission;
  const action = (path, { key = hostSeat.token, ...options } = {}) =>
    host.request(hostSeat.room.code + '/' + path, { key, ...options });
  await action('poll?after=-1&grid=' + hostGrid);
  await action('poll?after=-1&grid=' + rivalGrid, { key: rivalSeat.token });
  const started = await action('start', { data: {} });
  assert.equal(started.body.room.phase, 'loading');
  const live = host.host.rooms.get(hostSeat.room.code);
  const loaded = (key = hostSeat.token, grid = hostGrid) => action('loaded', { key, data: { grid, round: live.round } });
  return { live, action, loaded, rivalSeat };
}

test('diagnostics report capacity, queue, uptime and only current connected-player latency', async t => {
  const pub = fixture('public', 'Live diagnostics');
  t.after(() => pub.host.close());
  const empty = pub.host.diagnostics();
  assert.equal(empty.playerCount, 0);
  assert.equal(empty.connectedPlayers, 0);
  assert.equal(empty.maxPlayers, 8);
  assert.equal(empty.queuedPlayers, 0);
  assert.ok(Number.isFinite(empty.uptimeSeconds) && empty.uptimeSeconds >= 0);
  assert.deepEqual(empty.players, []);

  const { live, action } = await prepare(pub);
  await action('metrics', { data: { transport: 'poll', rttMs: 65, jitterMs: 8, fps: 55 } });
  const ticket = 'a'.repeat(64);
  const waiting = await pub.request('queue', { data: { token: ticket, name: 'Next racer' } });
  assert.equal(waiting.body.position, 1);
  const active = pub.host.diagnostics();
  assert.equal(active.phase, 'loading');
  assert.equal(active.playerCount, 2);
  assert.equal(active.connectedPlayers, 2);
  assert.equal(active.maxPlayers, 8);
  assert.equal(active.queuedPlayers, 1);
  assert.ok(active.uptimeSeconds >= empty.uptimeSeconds);
  assert.equal(active.players[0].connected, true);
  assert.equal(active.players[0].rttMs, 65);
  assert.equal(active.players[0].jitterMs, 8);
  assert.ok(active.players[0].latencyAgeMs >= 0 && active.players[0].latencyAgeMs < 10_000);
  assert.equal(active.players[1].rttMs, undefined, 'No fabricated zero latency before measurement');

  const seat = live.seats[0];
  seat.metrics.at = Date.now() - 10_001;
  let sampled = pub.host.diagnostics().players[0];
  assert.equal(sampled.rttMs, undefined, 'Old client metrics expire even while the connection stays open');
  assert.equal(sampled.latencyAgeMs, undefined);
  seat.socket = { isOpen: () => true, rttMs: 42, rttAgeMs: 100, close() {} };
  sampled = pub.host.diagnostics().players[0];
  assert.equal(sampled.rttMs, 42);
  assert.equal(sampled.latencyAgeMs, 100);
  seat.socket.rttAgeMs = 30_000;
  assert.equal(pub.host.diagnostics().players[0].rttMs, undefined, 'Old socket heartbeat measurements expire too');

  seat.socket = null;
  seat.metrics.at = Date.now();
  seat.lastPoll = Date.now() - 13_000;
  const disconnected = pub.host.diagnostics();
  assert.equal(disconnected.playerCount, 2, 'Reconnecting seats still occupy server capacity');
  assert.equal(disconnected.connectedPlayers, 1);
  assert.equal(disconnected.players[0].connected, false);
  assert.equal(disconnected.players[0].transport, null);
  assert.equal(disconnected.players[0].rttMs, undefined);
  assert.equal(disconnected.players[0].loadState, 'reconnecting');
  await pub.request('queue/leave', { data: { token: ticket } });
  assert.equal(pub.host.diagnostics().queuedPlayers, 0);
});

test('a load timeout returns everyone to the lobby with a retryable grid', async t => {
  const pub = fixture('public', 'Load timeout');
  t.after(() => pub.host.close());
  const { live, action, loaded, rivalSeat } = await prepare(pub);
  assert.equal((await loaded()).body.accepted, true);
  live.load.deadline = Date.now() - 1;
  pub.host.tick();
  assert.equal(live.phase, 'lobby');
  assert.match(live.startNotice, /Rival/);
  assert.equal(live.state, null);
  assert.equal(pub.host.status().phase, 'waiting');
  assert.equal((await action('poll?after=-1&grid=' + hostGrid)).body.snapshot, undefined);
  assert.equal((await loaded(rivalSeat.token, rivalGrid)).body.accepted, false);
  const retry = await action('start', { data: {} });
  assert.equal(retry.body.room.phase, 'loading');
  assert.equal(retry.body.room.loading.ready, 0);
  assert.equal((await loaded()).body.accepted, true);
  assert.equal((await loaded(rivalSeat.token, rivalGrid)).body.accepted, true);
  assert.equal(live.phase, 'racing');
});

test('leaving the race retires only the empty room and reopens the server queue', async t => {
  const pub = fixture('public', 'Player departures');
  t.after(() => pub.host.close());
  const { live, action, loaded, rivalSeat } = await prepare(pub);
  await loaded();
  await loaded(rivalSeat.token, rivalGrid);
  assert.equal((await action('leave', { data: {} })).body.left, true);
  assert.equal(live.phase, 'racing');
  assert.equal(pub.host.status().players, 1);
  assert.equal((await action('leave', { key: rivalSeat.token, data: {} })).body.left, true);
  assert.equal(pub.host.rooms.size, 0);
  assert.equal(pub.host.status().phase, 'waiting');
  const next = (await pub.request('queue', { data: { token: 'd'.repeat(64), name: 'Next host' } })).body.admission;
  assert.equal(next.room.phase, 'lobby');
  assert.notEqual(next.room.code, live.code);
});

test('a vanished grid pauses briefly for reconnect and expires when everyone is gone', async t => {
  const pub = fixture('public', 'Lost connection');
  t.after(() => pub.host.close());
  const { live, action, loaded, rivalSeat } = await prepare(pub);
  await loaded();
  await loaded(rivalSeat.token, rivalGrid);
  for (const seat of live.seats) seat.lastPoll = 0;
  pub.host.tick();
  assert.equal(live.tick, 0);
  assert.ok(live.emptySince);
  await action('poll?after=-1&grid=' + hostGrid);
  pub.host.tick();
  assert.equal(live.tick, 1);
  assert.equal(live.emptySince, null);
  live.seats[0].lastPoll = 0;
  pub.host.tick();
  live.emptySince = Date.now() - 21_000;
  pub.host.tick();
  assert.equal(pub.host.rooms.size, 0);
  assert.equal(pub.host.status().phase, 'waiting');
  const retired = await action('poll?after=-1&grid=' + hostGrid);
  assert.equal(retired.body.retired.reason, 'abandoned');
});

test('catch-up publishes one latest frame and polling preserves the snapshot for its tick', async t => {
  const pub = fixture('public', 'Timing recovery');
  t.after(() => pub.host.close());
  const { live, action, loaded, rivalSeat } = await prepare(pub);
  await loaded();
  await loaded(rivalSeat.token, rivalGrid);
  const poll = () => action('poll?after=-1&grid=' + hostGrid);
  const before = (await poll()).body;

  pub.host.tick(11);
  const caughtUp = (await poll()).body;
  assert.equal(caughtUp.revision, before.revision + 1);
  assert.equal(caughtUp.snapshot.tick, 11);
  assert.equal(caughtUp.snapshot.state.countdown, live.state.countdown);

  pub.host.tick();
  const published = (await poll()).body.snapshot;
  pub.host.tick(2);
  const cached = (await poll()).body.snapshot;
  assert.equal(published.tick, 12);
  assert.ok(live.state.countdown < published.state.countdown);
  assert.deepEqual(cached, published);
});

test('a finish during catch-up publishes its terminal snapshot before retirement', async t => {
  const pub = fixture('public', 'Catch-up finish');
  t.after(() => pub.host.close());
  const { live, action, loaded, rivalSeat } = await prepare(pub);
  await loaded();
  await loaded(rivalSeat.token, rivalGrid);
  const revision = live.revision;
  live.state.countdown = 0;
  live.state.time = 12 * 60 - .075;

  pub.host.tick(10);
  assert.equal(pub.host.rooms.size, 0);
  const final = (await action('poll?after=-1&grid=' + hostGrid)).body;
  assert.equal(final.revision, revision + 2);
  assert.equal(final.snapshot.tick, 5);
  assert.equal(final.snapshot.state.done, true);
  assert.equal(final.retired.reason, 'finished');
});

test('a streamed player and a polling player share the same loading barrier and inputs', { timeout: 5000 }, async t => {
  const pub = fixture('public', 'Mixed connections');
  t.after(() => pub.host.close());
  const add = async (token, name) => (await pub.request('queue', { data: { token, name } })).body.admission;
  const driver = await add('a'.repeat(64), 'Stream racer');
  const rival = await add('b'.repeat(64), 'Poll racer');
  const action = (path, key, data) => pub.request(driver.room.code + '/' + path, { key, data });
  const pair = socketPair();
  const ws = new WebSocket('ws://race.example/api/rooms/' + driver.room.code + '/socket', {
    origin: 'http://race.example', closeTimeout: 100, createConnection: () => pair.client
  });
  ws.on('error', () => {});
  pub.host.server.emit('connection', pair.server);
  const messages = [];
  ws.on('message', data => messages.push(JSON.parse(data)));
  const nextMessage = async (type, matches = () => true) => {
    let found;
    while (!(found = messages.find(message => message.type === type && matches(message.value)))) await once(ws, 'message');
    return found.value;
  };
  const send = (type, data) => ws.send(JSON.stringify({ type, ...data }));
  await once(ws, 'open');
  send('hello', { token: driver.token, grid: hostGrid });
  await nextMessage('room');
  await action('poll?after=-1&grid=' + rivalGrid, rival.token);
  const started = await action('start', driver.token, {});
  const round = started.body.room.round;
  await nextMessage('snapshot', snapshot => snapshot.round === round);
  await action('loaded', driver.token, { round, grid: hostGrid, loadMs: 80 });
  assert.equal(pub.host.diagnostics().readyPlayers, 1);
  assert.equal(pub.host.diagnostics().expectedPlayers, 2);
  await action('loaded', rival.token, { round, grid: rivalGrid });
  await nextMessage('room', room => room.phase === 'racing');
  pub.host.tick(7);
  const streamed = await nextMessage('snapshot', snapshot => snapshot.tick === 7);
  const polled = (await action('poll?after=-1&grid=' + rivalGrid, rival.token)).body.snapshot;
  assert.deepEqual(streamed, polled);
  send('input', { round, seq: 1, input: { gas: 1 } });
  assert.equal((await nextMessage('input')).accepted, true);
  const live = pub.host.rooms.get(driver.room.code);
  assert.equal(live.seats[driver.seat].input.gas, 1);
  send('metrics', { rttMs: 145, jitterMs: 12, snapshotGapPct: 5, fps: 55 });
  send('ping', { id: 123 });
  await nextMessage('pong', pong => pong.id === 123);
  const sample = pub.host.diagnostics().players.find(player => player.name === 'Stream racer');
  assert.equal(sample.transport, 'websocket');
  assert.equal(sample.rttMs, 145);
  assert.equal(sample.snapshotGapPct, 5);
  assert.equal(sample.loadMs, 80);
  await action('leave', driver.token, {});
  await action('leave', rival.token, {});
  assert.equal(pub.host.status().phase, 'waiting');
});
