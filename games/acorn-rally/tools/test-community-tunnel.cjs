'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { startQuickTunnel } = require('../server/community-tunnel.cjs');

test('tunnel latency expires after failed probes and recovers only on a new measurement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let clock = 1000, reachable = true;
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => { child.killed = true; child.exitCode = 0; };
  const tunnel = startQuickTunnel({
    executable: 'cloudflared', port: 8791, probeId: 'diagnostic-host',
    now: () => clock,
    spawnProcess: () => child,
    fetchImpl: async () => {
      clock += 40;
      return { ok: reachable, json: async () => ({ game: 'acorn-rally', version: 1, hostId: 'diagnostic-host' }) };
    },
  });
  t.after(() => { tunnel.close(); t.mock.timers.reset(); });
  assert.equal(tunnel.diagnostics().tunnelRttMs, null);
  assert.equal(tunnel.diagnostics().tunnelLatencyAgeMs, null);
  child.stdout.write('https://diagnostic-host.trycloudflare.com\n');
  assert.equal(await tunnel.ready, 'https://diagnostic-host.trycloudflare.com');
  assert.deepEqual(tunnel.diagnostics(), {
    tunnelRttMs: 40, tunnelJitterMs: null, tunnelLatencyAgeMs: 0,
    tunnelProbeSamples: 1, tunnelProbeFailures: 0,
  });

  async function monitorProbe(elapsedMs) {
    clock += elapsedMs;
    t.mock.timers.tick(10_000);
    // Let the monitor complete both fetch and JSON promises before inspecting it.
    await new Promise(setImmediate);
  }
  reachable = false;
  await monitorProbe(10_000);
  assert.equal(tunnel.diagnostics().tunnelProbeFailures, 1);
  assert.equal(tunnel.diagnostics().tunnelRttMs, 40, 'A recent successful measurement remains usable briefly');
  assert.equal(tunnel.diagnostics().tunnelLatencyAgeMs, 10_040);

  await monitorProbe(20_000);
  const stale = tunnel.diagnostics();
  assert.equal(stale.tunnelLatencyAgeMs, 30_080);
  assert.equal(stale.tunnelProbeFailures, 2);
  assert.equal(stale.tunnelRttMs, null, 'Fresh host packets must not make old tunnel latency appear current');
  assert.equal(stale.tunnelJitterMs, null);

  reachable = true;
  await monitorProbe(10_000);
  assert.equal(tunnel.diagnostics().tunnelRttMs, 40);
  assert.equal(tunnel.diagnostics().tunnelLatencyAgeMs, 0);
  assert.equal(tunnel.diagnostics().tunnelJitterMs, null, 'Jitter restarts after a stale interval');
  assert.equal(tunnel.diagnostics().tunnelProbeSamples, 4);
  assert.equal(tunnel.diagnostics().tunnelProbeFailures, 2);

  tunnel.close();
  assert.equal(child.killed, true);
  assert.equal(tunnel.diagnostics().tunnelRttMs, null, 'Stopping suppresses even a recent latency measurement');
  assert.equal(tunnel.diagnostics().tunnelJitterMs, null);
});
