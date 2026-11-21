'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const { createFirebaseDirectory } = require('./community-directory.cjs');
const { startQuickTunnel, wait } = require('./community-tunnel.cjs');

const heartbeatMs = 30_000;
const directoryRetryMs = 8000;
const phases = new Set(['waiting', 'racing', 'finished']);
const count = (value, min, max, fallback) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;

function createCommunityHost({
  port, probeId, getStatus = () => ({}), env = process.env, onStatus = () => {},
  tunnelFactory = startQuickTunnel, directoryFactory = createFirebaseDirectory
} = {}) {
  if (env.ACORN_RALLY_COMMUNITY !== '1') return { start() {}, close() {}, getCode: () => null };

  const name = (env.ACORN_RALLY_SERVER_NAME || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) || 'Acorn Rally';
  const visibility = env.ACORN_RALLY_VISIBILITY === 'code' ? 'code' : 'public';
  const dataDir = path.resolve(env.ACORN_RALLY_DATA_DIR || path.join(env.LOCALAPPDATA || os.homedir(), 'Acorn Rally'));
  const platformFile = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const executable = env.ACORN_RALLY_CLOUDFLARED || path.join(__dirname, '..', 'runtime', platformFile);
  const directory = directoryFactory({ dataDir });
  const lifecycle = new AbortController();
  let localCode = String(randomInt(10_000)).padStart(4, '0');
  let started = false, tunnel, lease, last, tunnelStatus = 'starting', directoryStatus = 'pending';

  function diagnostics() {
    return { tunnelStatus, directoryStatus, ...tunnel?.diagnostics?.() };
  }

  function report(status, extra = {}) {
    const next = { status, name, visibility, ...extra };
    if (visibility === 'code') next.code = localCode;
    const signature = JSON.stringify(next);
    if (signature === last) return;
    last = signature;
    onStatus(next);
  }

  function record(origin) {
    const snapshot = getStatus() || {};
    const capacity = count(snapshot.capacity, 2, 8, 4);
    return {
      name, visibility, origin, capacity,
      phase: phases.has(snapshot.phase) ? snapshot.phase : 'waiting',
      players: count(snapshot.players, 0, capacity, 0),
      queued: count(snapshot.waiting, 0, 1000, 0)
    };
  }

  async function advertise(origin, signal) {
    while (!signal.aborted && !lifecycle.signal.aborted) {
      let nextDelay = heartbeatMs;
      try {
        const state = record(origin);
        if (lease) lease = await directory.renew(state, lease);
        if (!lease && !signal.aborted) lease = await directory.reserve(state, localCode);
        if (signal.aborted || lifecycle.signal.aborted) return;
        localCode = lease.code;
        directoryStatus = 'listed';
        report('online', { origin });
      } catch {
        if (signal.aborted || lifecycle.signal.aborted) return;
        directoryStatus = 'unavailable';
        report('lan-only', { message: 'The lobby directory is unavailable. Same-Wi-Fi play is available.' });
        nextDelay = directoryRetryMs;
      }
      await wait(nextDelay, signal);
    }
  }

  async function serve() {
    let retryMs = 1000;
    while (!lifecycle.signal.aborted) {
      tunnelStatus = 'starting';
      directoryStatus = 'pending';
      report('starting', { message: 'Opening the public game connection.' });
      try {
        tunnel = tunnelFactory({ executable, port, probeId });
        const origin = await tunnel.ready;
        tunnelStatus = 'ready';
        retryMs = 1000;
        await advertise(origin, tunnel.signal);
      } catch { /* Keep the local game available while the public connection recovers. */ }
      finally {
        tunnel?.close();
        tunnel = undefined;
        if (lease) {
          void directory.release(lease);
          lease = undefined;
        }
      }
      if (lifecycle.signal.aborted) return;
      tunnelStatus = 'reconnecting';
      directoryStatus = 'pending';
      report('lan-only', { message: 'The public connection is unavailable. Same-Wi-Fi play is available while it reconnects.' });
      await wait(retryMs, lifecycle.signal).catch(() => {});
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  }

  function start() {
    if (started || lifecycle.signal.aborted) return;
    started = true;
    if (typeof probeId !== 'string' || !probeId || !path.isAbsolute(executable) || !fs.existsSync(executable)) {
      tunnelStatus = 'unavailable';
      directoryStatus = 'disabled';
      report('lan-only', { message: 'The public tunnel is unavailable. Same-Wi-Fi play is available.' });
      return;
    }
    void serve();
  }

  function close() {
    if (lifecycle.signal.aborted) return;
    lifecycle.abort(new Error('Hosting stopped.'));
    tunnel?.close();
    report('offline');
  }

  return { start, close, diagnostics, getCode: () => localCode, queueStore: directory.queueStore };
}

module.exports = { createCommunityHost };
