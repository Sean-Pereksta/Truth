'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, PassThrough } = require('node:stream');
const { createRallyServer } = require('../server/host.cjs');

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
  const poll = (after, seatKey = key) => action('poll?after=' + after, { key: seatKey });
  const first = await poll(-1);
  assert.equal(first.body.room.seats[0].connected, true);
  await poll(-1, rival.body.admission.token);
  const current = await poll(-1);
  const pending = poll(current.body.revision);
  const started = await action('start', { data: {}, key });
  assert.equal(started.body.room.phase, 'racing');
  const update = await pending;
  assert.equal(update.body.snapshot.state.racers[0].human, true);
  assert.equal(update.body.snapshot.state.racers[1].name, 'Racer Two');
  const live = pub.host.rooms.get(room.code);
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
