'use strict';

const { createHash, randomUUID } = require('node:crypto');

const maxWaiting = 128;
const ticketLifetimeMs = 60_000;
const heartbeatWriteMs = 12_000;
const restoreTimeoutMs = 1_800;
const communityRestoreTimeoutMs = 9_000;
const retryWriteMs = 5_000;
const ticketPattern = /^[a-f0-9]{64}$/;
const validTicket = value => typeof value === 'string' && value.length === 64 && ticketPattern.test(value);

function firebaseQueueStore(env, logger) {
  if (!env.ACORN_RALLY_PUBLIC_ORIGIN?.trim()) return null;

  let admin, app;
  try {
    admin = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    app = admin.initializeApp({ credential: admin.applicationDefault() }, 'acorn-rally-queue-' + randomUUID());
    const document = getFirestore(app).doc('acornRallyService/queue');
    return {
      async load() {
        const snapshot = await document.get();
        return snapshot.exists ? snapshot.data()?.tickets : [];
      },
      save: tickets => document.set({ tickets }),
      close: () => admin.deleteApp(app)
    };
  } catch {
    if (app) void admin.deleteApp(app).catch(() => {});
    logger.warn('Acorn Rally is using an in-memory queue. Check the Firebase Admin SDK and application default credentials.');
    return null;
  }
}

async function restoreWithTimeout(load, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      load(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Queue restore timed out')), timeoutMs); })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function createRaceQueue({ env = process.env, logger = console, now = Date.now, community = false,
  store = community ? null : firebaseQueueStore(env, logger) } = {}) {
  const tickets = new Map();
  let usingCloud = false;
  let closed = false;
  let dirty = false;
  let inFlight = null;
  let retryTimer = null;
  let warned = false;

  const restored = store ? restore() : Promise.resolve();
  async function restore() {
    try {
      const records = await restoreWithTimeout(() => store.load(), community ? communityRestoreTimeoutMs : restoreTimeoutMs);
      const current = now();
      if (!Array.isArray(records)) throw new Error('Invalid saved queue');
      for (const record of records.slice(0, maxWaiting)) {
        if (!record || !validTicket(record.id) || !Number.isSafeInteger(record.seen) ||
            record.seen > current || current - record.seen >= ticketLifetimeMs || tickets.has(record.id)) continue;
        tickets.set(record.id, { seen: record.seen, savedSeen: record.seen });
      }
      usingCloud = true;
    } catch {
      if (!closed) logger.warn('Acorn Rally could not restore the Firebase queue. This host will use an in-memory queue until it restarts.');
    }
  }

  function snapshot() {
    return [...tickets].map(([id, ticket]) => ({ id, seen: ticket.savedSeen }));
  }

  function writeChanges() {
    if (!usingCloud || !dirty || inFlight || retryTimer || closed) return;
    dirty = false;
    const records = snapshot();
    let failed = false;
    inFlight = Promise.resolve().then(() => store.save(records)).then(() => {
      warned = false;
    }, () => {
      failed = dirty = true;
      if (!warned && !closed) logger.warn('Acorn Rally could not save the Firebase queue. The host will retry.');
      warned = true;
    }).finally(() => {
      inFlight = null;
      if (closed || !dirty) return;
      if (!failed) return writeChanges();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        writeChanges();
      }, retryWriteMs);
      retryTimer.unref();
    });
  }

  function changed() {
    dirty = true;
    writeChanges();
  }

  function prune(current) {
    let removed = false;
    for (const [id, ticket] of tickets) {
      if (current - ticket.seen >= ticketLifetimeMs) {
        tickets.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  function digest(token) {
    return validTicket(token) ? createHash('sha256').update(token).digest('hex') : null;
  }

  function enter(token) {
    const id = digest(token);
    if (!id || closed) return null;
    const current = now();
    let update = prune(current);
    const ticket = tickets.get(id);
    if (ticket) {
      ticket.seen = current;
      if (current - ticket.savedSeen >= heartbeatWriteMs) {
        ticket.savedSeen = current;
        update = true;
      }
    } else if (tickets.size < maxWaiting) {
      tickets.set(id, { seen: current, savedSeen: current });
      update = true;
    }
    if (update) changed();
    if (!tickets.has(id)) return null;
    let position = 1;
    for (const waitingId of tickets.keys()) {
      if (waitingId === id) break;
      position++;
    }
    return { position, waiting: tickets.size };
  }

  function remove(token) {
    const id = digest(token);
    if (!id || closed) return false;
    const expired = prune(now());
    const removed = tickets.delete(id);
    if (expired || removed) changed();
    return removed;
  }

  function size() {
    if (prune(now())) changed();
    return tickets.size;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(retryTimer);
    if (!store) return;
    void (async () => {
      await restored;
      await inFlight;
      try {
        if (usingCloud && dirty) await store.save(snapshot());
      } finally {
        await store.close?.();
      }
    })().catch(() => {});
  }

  return { ready: () => restored, enter, remove, size, close };
}

module.exports = { createRaceQueue };
