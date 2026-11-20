'use strict';

const { spawn } = require('node:child_process');

const quickOrigin = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const outputAddress = /https:\/\/[a-z0-9-]+\.trycloudflare\.com(?=[\s|"'\x1b]|$)/i;

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    function cancel() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', cancel, { once: true });
  });
}

function startQuickTunnel({
  executable, port, probeId, spawnProcess = spawn, fetchImpl = globalThis.fetch,
  startupMs = 90_000, probeDelayMs = 1200, probeTimeoutMs = 3500,
  probePath = '/api/rooms/version', matchesProbe = info =>
    info?.game === 'acorn-rally' && info.version === 1 && info.hostId === probeId
}) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const child = spawnProcess(executable, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + port], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const deadline = setTimeout(() => {
    lifetime.abort(new Error('The public tunnel did not become reachable in time.'));
  }, startupMs);
  child.once('error', () => lifetime.abort(new Error('Cloudflare could not start.')));
  child.once('exit', () => lifetime.abort(new Error('The public tunnel stopped.')));
  signal.addEventListener('abort', () => {
    clearTimeout(deadline);
    if (child.exitCode === null && !child.killed) child.kill();
  }, { once: true });

  const address = new Promise((resolve, reject) => {
    let output = '';
    function cleanup() {
      child.stdout?.removeListener('data', read);
      child.stderr?.removeListener('data', read);
      signal.removeEventListener('abort', cancel);
    }
    function cancel() {
      cleanup();
      reject(signal.reason);
    }
    function read(chunk) {
      output = (output + chunk.toString()).slice(-4096);
      const origin = output.match(outputAddress)?.[0].toLowerCase();
      if (!origin || !quickOrigin.test(origin)) return;
      cleanup();
      child.stdout?.resume();
      child.stderr?.resume();
      resolve(origin);
    }
    child.stdout?.on('data', read);
    child.stderr?.on('data', read);
    signal.addEventListener('abort', cancel, { once: true });
  });

  const ready = (async () => {
    const origin = await address;
    while (!signal.aborted) {
      let response;
      const controller = new AbortController();
      const cancel = () => controller.abort(signal.reason);
      const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);
      signal.addEventListener('abort', cancel, { once: true });
      try {
        response = await fetchImpl(origin + probePath, {
          redirect: 'error', signal: controller.signal, cache: 'no-store'
        });
        if (response.ok) {
          const info = await response.json();
          if (matchesProbe(info)) {
            clearTimeout(deadline);
            return origin;
          }
        }
      } catch { /* Wait for the public address to reach this game instance. */ }
      finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
      await wait(probeDelayMs, signal);
    }
    throw signal.reason;
  })();

  return {
    ready, signal,
    close() { lifetime.abort(new Error('Hosting stopped.')); }
  };
}

module.exports = { quickOrigin, startQuickTunnel, wait };
