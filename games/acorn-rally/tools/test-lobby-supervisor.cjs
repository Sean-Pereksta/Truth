'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('the supervised host forwards initial and live diagnostics to the launcher over real IPC', { timeout: 5000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-diagnostics-'));
  fs.copyFileSync(path.join(__dirname, '../server/lobby-supervisor.cjs'), path.join(root, 'lobby-supervisor.cjs'));
  const status = { type: 'rally-host-status', status: 'lan-only' };
  const first = { type: 'rally-host-diagnostics', diagnostics: { playerCount: 0, maxPlayers: 8, players: [] } };
  const next = { type: 'rally-host-diagnostics', diagnostics: {
    playerCount: 1, maxPlayers: 8, connectedPlayers: 1, tunnelRttMs: 83,
    players: [{ name: 'Racer', connected: true, rttMs: 45 }]
  } };
  fs.writeFileSync(path.join(root, 'host.cjs'), `
    process.send(${JSON.stringify(status)});
    process.send(${JSON.stringify(first)});
    process.send({ type: 'unrelated-internal-packet' });
    setTimeout(() => process.send(${JSON.stringify(next)}), 20);
    process.on('message', message => {
      if (message.type === 'stop') {
        process.send({ type: 'rally-host-diagnostics', diagnostics: { playerCount: 8 } }, () => process.disconnect());
      }
    });
    process.on('disconnect', () => process.exit(0));
  `);
  const child = spawn(process.execPath, [path.join(root, 'lobby-supervisor.cjs')], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true
  });
  const closed = once(child, 'close');
  const messages = [];
  child.on('message', message => messages.push(message));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      if (child.connected) child.send({ type: 'stop' }, () => {});
      else child.kill();
      const deadline = setTimeout(() => child.kill(), 1000);
      await closed;
      clearTimeout(deadline);
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    child.on('message', message => {
      if (message.type === 'rally-host-diagnostics' && message.diagnostics?.playerCount === 1) resolve();
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('The supervisor stopped before relaying diagnostics.')));
  });
  assert.deepEqual(messages, [status, first, next]);
  child.send({ type: 'stop' });
  assert.deepEqual(await closed, [0, null]);
  assert.deepEqual(messages, [status, first, next, { type: 'rally-host-status', status: 'offline' }],
    'No late diagnostics or unrelated host messages leak through shutdown');
});
