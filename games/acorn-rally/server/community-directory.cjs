'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, randomInt } = require('node:crypto');

const listingFirebase = {
  apiKey: 'AIzaSyC_Pf_pwVsBKhX0hxJimSqOj_HYCM-fi0w',
  projectId: 'magic-servers-1ca0c'
};
const queueFirebase = {
  apiKey: 'AIzaSyB7twY7z31ucB6pGA8JC_HrVMZhA8lNaJA',
  projectId: 'bible-game-246c0'
};
const leaseMs = 90_000;
const queueCollection = 'acornRallyHostQueues';
const lobbyCollection = 'acornRallyLobbies';
const uidPattern = /^[A-Za-z0-9_-]{1,100}$/;

class FirebaseError extends Error {
  constructor(responseStatus, code) {
    super('Firebase rejected the lobby operation.');
    this.status = responseStatus;
    this.code = code;
  }
}

function createStore({ dataDir, fetchImpl, config, now, timeoutMs }) {
  // Keep the original queue owner's identity when an existing host upgrades.
  const identityFile = config.projectId === queueFirebase.projectId ? 'community-firebase.json' :
    'community-firebase.' + config.projectId + '.json';
  const identityPath = path.join(dataDir, identityFile);
  const database = 'projects/' + config.projectId + '/databases/(default)/documents';
  const firestore = 'https://firestore.googleapis.com/v1/' + database;
  const apiKey = encodeURIComponent(config.apiKey);
  let auth, authenticating;

  async function request(url, { method = 'GET', body, token } = {}) {
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const form = body instanceof URLSearchParams;
    if (body) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
    const response = await fetchImpl(url, {
      method, headers, body: form ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error', cache: 'no-store'
    });
    if (Number(response.headers.get('content-length')) > 131_072) throw new Error('Firebase response was too large.');
    const raw = await response.text();
    if (raw.length > 131_072) throw new Error('Firebase response was too large.');
    const data = raw && JSON.parse(raw);
    if (!response.ok) throw new FirebaseError(response.status, data?.error?.status);
    return data;
  }

  function parseIdentity(value, uid) {
    if (typeof value?.uid !== 'string' || !uidPattern.test(value.uid) || (uid && uid !== value.uid) ||
        typeof value.refreshToken !== 'string' || !value.refreshToken ||
        typeof value.token !== 'string' || !value.token ||
        !Number.isFinite(value.ttl) || value.ttl <= 0) {
      throw new Error('Firebase returned an invalid host identity.');
    }
    return { uid: value.uid, refreshToken: value.refreshToken, token: value.token, expiresAt: now() + value.ttl * 1000 };
  }

  async function loadIdentity() {
    let value;
    try { value = JSON.parse(await fs.readFile(identityPath, 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return null; throw err; }
    if (typeof value?.uid !== 'string' || !uidPattern.test(value.uid) ||
        typeof value.refreshToken !== 'string' || !value.refreshToken) {
      throw new Error('The saved host identity could not be read.');
    }
    return value;
  }

  async function saveIdentity(value) {
    const temporary = identityPath + '.' + randomUUID() + '.tmp';
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.writeFile(temporary, JSON.stringify({ uid: value.uid, refreshToken: value.refreshToken }), {
        encoding: 'utf8', mode: 0o600, flag: 'wx'
      });
      await fs.rename(temporary, identityPath);
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
  }

  async function signIn() {
    const saved = auth || await loadIdentity();
    if (saved) {
      try {
        const data = await request('https://securetoken.googleapis.com/v1/token?key=' + apiKey, {
          method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refreshToken })
        });
        const next = parseIdentity({
          uid: data.user_id, token: data.id_token, refreshToken: data.refresh_token, ttl: Number(data.expires_in)
        }, saved.uid);
        if (next.refreshToken !== saved.refreshToken) await saveIdentity(next);
        return next;
      } catch (err) {
        if (!(err instanceof FirebaseError) || ![400, 401].includes(err.status)) throw err;
      }
    }
    const data = await request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + apiKey, {
      method: 'POST', body: { returnSecureToken: true }
    });
    const next = parseIdentity({
      uid: data.localId, token: data.idToken, refreshToken: data.refreshToken, ttl: Number(data.expiresIn)
    });
    await saveIdentity(next);
    return next;
  }

  async function authorize() {
    if (auth?.expiresAt > now() + 60_000) return auth;
    if (!authenticating) authenticating = signIn().then(value => auth = value).finally(() => authenticating = null);
    return authenticating;
  }

  async function withAuth(action) {
    let identity = await authorize();
    try { return await action(identity); }
    catch (err) {
      if (!(err instanceof FirebaseError) || err.status !== 401) throw err;
      identity.expiresAt = 0;
      identity = await authorize();
      return action(identity);
    }
  }

  async function read(doc, identity) {
    try { return await request(firestore + '/' + doc, { token: identity.token }); }
    catch (err) { if (err instanceof FirebaseError && err.status === 404) return null; throw err; }
  }

  async function write(doc, fields, identity, currentDocument) {
    const change = {
      update: { name: database + '/' + doc, fields },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
    };
    if (currentDocument) change.currentDocument = currentDocument;
    const data = await request(firestore + ':commit', { method: 'POST', body: { writes: [change] }, token: identity.token });
    const updateTime = data?.writeResults?.[0]?.updateTime;
    if (typeof updateTime !== 'string' || !Number.isFinite(Date.parse(updateTime))) {
      throw new Error('Firebase returned an invalid lobby write result.');
    }
    return updateTime;
  }

  function remove(doc, updateTime, identity) {
    return request(firestore + ':commit', {
      method: 'POST',
      body: { writes: [{ delete: database + '/' + doc, currentDocument: { updateTime } }] },
      token: identity.token
    });
  }

  return { withAuth, read, write, remove };
}

const string = stringValue => ({ stringValue });
const count = integerValue => ({ integerValue: String(integerValue) });

function createFirebaseDirectory({
  dataDir, fetchImpl = globalThis.fetch, config = listingFirebase, queueConfig = queueFirebase,
  now = Date.now, timeoutMs = 4000,
  listingCollection = lobbyCollection, joinPath = '/?room=join', listingExtras = () => ({})
}) {
  const listings = createStore({ dataDir, fetchImpl, config, now, timeoutMs });
  const queue = createStore({ dataDir, fetchImpl, config: queueConfig, now, timeoutMs });

  function lobbyFields(record, uid) {
    const { name, visibility, origin, phase, players, capacity, queued } = record;
    return {
      ownerUid: string(uid), name: string(name), visibility: string(visibility), origin: string(origin),
      ...listingExtras(record), joinUrl: string(origin + joinPath), phase: string(phase), players: count(players),
      capacity: count(capacity), queued: count(queued),
      expiresAt: { timestampValue: new Date(now() + leaseMs).toISOString() }
    };
  }
  const allocateCode = () => String(randomInt(10_000)).padStart(4, '0');
  const conflict = err => err instanceof FirebaseError &&
    (err.status === 409 || err.status === 412 || err.code === 'FAILED_PRECONDITION' || err.code === 'ALREADY_EXISTS');

  async function reserve(record, preferred) {
    return listings.withAuth(async identity => {
      const tried = new Set();
      let code = preferred;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (!code || tried.has(code)) code = allocateCode();
        if (tried.has(code)) continue;
        tried.add(code);
        const doc = listingCollection + '/' + code;
        const previous = await listings.read(doc, identity);
        if (previous && previous.fields?.ownerUid?.stringValue !== identity.uid &&
            !(Date.parse(previous.fields?.expiresAt?.timestampValue) <= now())) continue;
        try {
          const updateTime = await listings.write(doc, lobbyFields(record, identity.uid), identity,
            previous ? { updateTime: previous.updateTime } : { exists: false });
          return { code, uid: identity.uid, updateTime };
        } catch (err) { if (!conflict(err)) throw err; }
      }
      throw new Error('A four-digit lobby code could not be reserved.');
    });
  }

  async function renew(record, lease) {
    return listings.withAuth(async identity => {
      if (identity.uid !== lease.uid) return null;
      try {
        const updateTime = await listings.write(listingCollection + '/' + lease.code, lobbyFields(record, identity.uid), identity,
          { updateTime: lease.updateTime });
        return { ...lease, updateTime };
      } catch (err) {
        if (conflict(err) || err instanceof FirebaseError && [403, 404].includes(err.status)) return null;
        throw err;
      }
    });
  }

  async function release(lease) {
    return listings.withAuth(identity => {
      if (identity.uid !== lease.uid) return;
      return listings.remove(listingCollection + '/' + lease.code, lease.updateTime, identity);
    }).catch(() => {});
  }

  function validTickets(tickets) {
    return Array.isArray(tickets) && tickets.length <= 128 && tickets.every(ticket =>
      ticket && typeof ticket.id === 'string' && /^[a-f0-9]{64}$/.test(ticket.id) &&
      Number.isSafeInteger(ticket.seen) && ticket.seen >= 0 &&
      Object.keys(ticket).length === 2
    );
  }

  const queueStore = {
    load: () => queue.withAuth(async identity => {
      const doc = await queue.read(queueCollection + '/' + identity.uid, identity);
      if (!doc) return [];
      const payload = doc.fields?.payload?.stringValue;
      if (typeof payload !== 'string' || payload.length > 32_768) throw new Error('Stored race queue is invalid.');
      const tickets = JSON.parse(payload);
      if (!validTickets(tickets)) throw new Error('Stored race queue is invalid.');
      return tickets;
    }),
    save: tickets => queue.withAuth(async identity => {
      if (!validTickets(tickets)) throw new Error('Race queue cannot be saved.');
      await queue.write(queueCollection + '/' + identity.uid, { payload: string(JSON.stringify(tickets)) }, identity);
    })
  };

  return { reserve, renew, release, queueStore };
}

module.exports = { createFirebaseDirectory, lobbyCollection, queueCollection };
