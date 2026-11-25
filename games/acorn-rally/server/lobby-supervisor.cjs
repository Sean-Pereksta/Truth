'use strict';

const { spawn } = require('node:child_process');
const { join } = require('node:path');

const host = join(__dirname, 'host.cjs');
const maxBackoff = 30_000;
const stableAfter = 60_000;
let openOnLaunch = process.argv.includes('--open');
let child, restartTimer, stopTimer;
let backoff = 1000;
let stopping = false;

function finish(code) {
  stopping = true;
  clearTimeout(stopTimer);
  process.exitCode = code;
  if (process.connected) process.disconnect();
}

function launch() {
  const startedAt = Date.now();
  const args = [host, '--single-room'];
  if (openOnLaunch) args.push('--open');
  openOnLaunch = false;
  const current = spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'pipe', 'ipc'], windowsHide: true });
  child = current;
  current.on('message', update => {
    if (!stopping && child === current && process.connected &&
        ['rally-host-status', 'rally-host-diagnostics'].includes(update?.type)) {
      process.send(update, () => {});
    }
  });
  let spawnError;
  let recentError = '';
  current.stderr.on('data', chunk => {
    recentError = (recentError + chunk.toString()).slice(-4096);
    process.stderr.write(chunk);
  });
  current.once('error', error => { spawnError = error; });
  current.once('close', (code, signal) => {
    child = null;
    if (process.connected) process.send({ type: 'rally-host-status', status: 'offline' }, () => {});
    if (stopping) return finish(0);
    if (code === 98 || /\blisten EADDRINUSE\b/.test(recentError)) {
      console.error('The lobby port is already in use. Close the other host or set ACORN_RALLY_PORT to an available port.');
      return finish(98);
    }
    if (spawnError) {
      console.error('Could not launch the lobby server:', spawnError.message);
      return finish(1);
    }
    if (Date.now() - startedAt >= stableAfter) backoff = 1000;
    console.error('The Acorn Rally lobby server stopped (' + (signal || 'exit ' + code) + '). Restarting in ' + backoff / 1000 + 's.');
    restartTimer = setTimeout(launch, backoff);
    backoff = Math.min(backoff * 2, maxBackoff);
  });
}

function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  const current = child;
  if (!current) return finish(0);
  stopTimer = setTimeout(() => current.kill(), 5000).unref();
  if (current.connected) {
    current.send({ type: 'stop' }, error => { if (error) current.kill(); });
  } else current.kill();
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
if (process.connected) {
  process.on('message', message => { if (message?.type === 'stop') stop(); });
  process.once('disconnect', stop);
}
console.log('Acorn Rally Lobby Host is running. Keep this window open. Press Ctrl+C to stop.');
launch();
