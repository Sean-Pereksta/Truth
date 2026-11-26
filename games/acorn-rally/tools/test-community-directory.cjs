'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFirebaseDirectory } = require('../server/community-directory.cjs');

test('community listings use Magic Servers while an upgrade preserves the race queue owner', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acorn-firebase-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const legacyIdentityPath = path.join(dataDir, 'community-firebase.json');
  const legacyIdentity = { uid: 'old-owner', refreshToken: 'legacy-refresh' };
  await fs.writeFile(legacyIdentityPath, JSON.stringify(legacyIdentity));

  const listings = 'projects/magic-servers-1ca0c/databases/(default)/documents';
  const queues = 'projects/bible-game-246c0/databases/(default)/documents';
  const firestore = 'https://firestore.googleapis.com/v1/';
  const listing = listings + '/acornRallyLobbies/0123';
  const queue = queues + '/acornRallyHostQueues/old-owner';
  const now = Date.parse('2026-11-26T00:00:00Z');
  const updateTime = new Date(now).toISOString();
  const tickets = [{ id: 'a'.repeat(64), seen: now }];
  const commits = [];
  const authRequests = [];

  const fetchImpl = async (url, options) => {
    const endpoint = new URL(url);
    if (endpoint.hostname === 'identitytoolkit.googleapis.com') {
      assert.equal(endpoint.pathname, '/v1/accounts:signUp');
      assert.notEqual(endpoint.searchParams.get('key'), null);
      authRequests.push(['sign-up', endpoint.searchParams.get('key')]);
      return Response.json({ localId: 'new-owner', idToken: 'new-id', refreshToken: 'listing-refresh', expiresIn: '3600' });
    }
    if (endpoint.hostname === 'securetoken.googleapis.com') {
      assert.equal(endpoint.pathname, '/v1/token');
      assert.equal(options.body.get('refresh_token'), 'legacy-refresh');
      authRequests.push(['refresh', endpoint.searchParams.get('key')]);
      return Response.json({ user_id: 'old-owner', id_token: 'old-id', refresh_token: 'legacy-refresh', expires_in: '3600' });
    }

    if (url === firestore + listing) {
      assert.equal(options.headers.Authorization, 'Bearer new-id');
      return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
    }
    if (url === firestore + queue) {
      assert.equal(options.headers.Authorization, 'Bearer old-id');
      return Response.json({ fields: { payload: { stringValue: JSON.stringify(tickets) } } });
    }
    const database = url === firestore + listings + ':commit' ? listings : queues;
    assert.equal(url, firestore + database + ':commit');
    assert.equal(options.headers.Authorization, database === listings ? 'Bearer new-id' : 'Bearer old-id');
    const [write] = JSON.parse(options.body).writes;
    commits.push(write);
    return Response.json({ writeResults: [{ updateTime }] });
  };

  const directory = createFirebaseDirectory({ dataDir, fetchImpl, now: () => now });
  const record = {
    name: 'Acorn Test', visibility: 'public', origin: 'https://acorn-test.trycloudflare.com',
    phase: 'waiting', players: 0, capacity: 8, queued: 1
  };

  const [lease, restored] = await Promise.all([directory.reserve(record, '0123'), directory.queueStore.load()]);
  assert.deepEqual(lease, { code: '0123', uid: 'new-owner', updateTime });
  assert.deepEqual(restored, tickets);
  const renewed = await directory.renew({ ...record, players: 1 }, lease);
  await directory.queueStore.save(tickets);
  await directory.release(renewed);

  assert.equal(authRequests.length, 2);
  const [signUp, refresh] = ['sign-up', 'refresh'].map(action => authRequests.find(([kind]) => kind === action)[1]);
  assert.notEqual(signUp, refresh);
  assert.equal(commits[0].update.name, listing);
  assert.equal(commits[0].update.fields.ownerUid.stringValue, 'new-owner');
  assert.deepEqual(commits[0].currentDocument, { exists: false });
  assert.deepEqual(commits[1].currentDocument, { updateTime });
  assert.equal(commits[1].update.fields.players.integerValue, '1');
  assert.equal(commits[2].update.name, queue);
  assert.equal(commits[2].update.fields.payload.stringValue, JSON.stringify(tickets));
  assert.deepEqual(commits[3], { delete: listing, currentDocument: { updateTime } });

  assert.deepEqual(JSON.parse(await fs.readFile(legacyIdentityPath, 'utf8')), legacyIdentity);
  const listingIdentityPath = path.join(dataDir, 'community-firebase.magic-servers-1ca0c.json');
  assert.deepEqual(JSON.parse(await fs.readFile(listingIdentityPath, 'utf8')), {
    uid: 'new-owner', refreshToken: 'listing-refresh'
  });
});

test('disabled anonymous sign-in reports a fixed diagnostics code', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acorn-firebase-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const directory = createFirebaseDirectory({
    dataDir,
    fetchImpl: async () => Response.json({
      error: { status: 'INVALID_ARGUMENT', message: 'OPERATION_NOT_ALLOWED' }
    }, { status: 400 })
  });

  await assert.rejects(directory.reserve({}, '0123'), {
    status: 400, code: 'OPERATION_NOT_ALLOWED', message: 'Firebase rejected the lobby operation.'
  });
});
