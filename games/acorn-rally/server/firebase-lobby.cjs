'use strict';

const { randomUUID } = require('node:crypto');

const heartbeatMs = 30_000;
const expiryMs = 90_000;
const onlinePhases = new Set(['waiting', 'racing', 'finished']);
const namedHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const localOrTemporary = /(?:^|\.)(?:localhost|local|lan|home|home\.arpa|internal|test|invalid|example|trycloudflare\.com)$/;

function stableOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.port && url.href === url.origin + '/' &&
        namedHost.test(url.hostname) && !localOrTemporary.test(url.hostname)) return url.origin;
  } catch { /* An invalid URL disables publication. */ }
  return null;
}

function createFirebaseLobbyPublisher({ getStatus = () => ({}), env = process.env, logger = console } = {}) {
  const off = { refresh() {}, close() {} };
  const configuredOrigin = env.ACORN_RALLY_PUBLIC_ORIGIN?.trim();
  if (!configuredOrigin) return off;

  const origin = stableOrigin(configuredOrigin);
  if (!origin) {
    logger.warn('Acorn Rally Firebase listing needs a stable public HTTPS origin.');
    return off;
  }

  let adminApp, firestore, app, listing;
  try {
    adminApp = require('firebase-admin/app');
    firestore = require('firebase-admin/firestore');
    app = adminApp.initializeApp({ credential: adminApp.applicationDefault() }, 'acorn-rally-' + randomUUID());
    listing = firestore.getFirestore(app).doc('acornRallyService/public');
  } catch {
    if (app) void adminApp.deleteApp(app).catch(() => {});
    logger.warn('Acorn Rally Firebase listing is unavailable. Check the Firebase Admin SDK and application default credentials.');
    return off;
  }

  let closed = false, writing = false, queued = false, warned = false;
  async function refresh() {
    if (closed) return;
    if (writing) {
      queued = true;
      return;
    }

    writing = true;
    do {
      queued = false;
      try {
        const { phase, players, capacity, queueEnabled, waiting } = getStatus() || {};
        const record = {
          origin,
          joinUrl: origin + '/?room=join',
          updatedAt: firestore.FieldValue.serverTimestamp(),
          expiresAt: firestore.Timestamp.fromMillis(Date.now() + expiryMs)
        };
        if (onlinePhases.has(phase)) record.phase = phase;
        if (queueEnabled === true) record.queueEnabled = true;
        if (Number.isInteger(waiting) && waiting >= 0 && waiting <= 128) record.waiting = waiting;
        if (Number.isInteger(capacity) && capacity >= 2 && capacity <= 8) record.capacity = capacity;
        if (Number.isInteger(players) && players >= 0 && players <= (record.capacity ?? 8)) record.players = players;
        await listing.set(record);
        warned = false;
      } catch {
        if (!closed && !warned) logger.warn('Acorn Rally could not refresh its Firebase listing. Local play is available.');
        warned = true;
      }
    } while (!closed && queued);
    writing = false;
  }

  const heartbeat = setInterval(refresh, heartbeatMs);
  heartbeat.unref();
  void refresh();

  return { refresh, close() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    // Let the listing expire so a late shutdown never deletes a replacement host's record.
    void adminApp.deleteApp(app).catch(() => {});
  } };
}

module.exports = { createFirebaseLobbyPublisher };
