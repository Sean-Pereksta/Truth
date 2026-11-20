import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

export async function start({ packRoot, signal, onFailure }) {
  signal?.throwIfAborted();
  const child = spawn(path.join(packRoot, 'Last Signal.exe'), ['--managed-server'], {
    cwd: packRoot, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
  });
  const lines = createInterface({ input: child.stdout });
  let ready, rejectReady, bootstrap, detail = '', closed = false, stopping = false;
  let status = { phase: 'waiting', players: 0, capacity: 8, queued: 0 };
  const initialized = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
  const closedPromise = new Promise(resolve => child.once('close', resolve));
  child.stdin.on('error', () => {}); // A process that just exited can race the shutdown pipe.
  child.stderr.on('data', bytes => { detail = (detail + bytes.toString()).slice(-250); });
  child.on('error', error => rejectReady(error));
  child.once('close', () => {
    closed = true;
    lines.close();
    signal?.removeEventListener('abort', abort);
    const error = new Error(detail.trim() || 'Last Signal server stopped.');
    if (!bootstrap) rejectReady(error);
    else if (!stopping) onFailure?.(error);
  });
  function abort() { void close(); }
  async function close() {
    if (!closed && !stopping) {
      stopping = true;
      child.stdin.end('stop\n');
      const timer = setTimeout(() => { if (!closed) child.kill(); }, 3000);
      timer.unref();
      closedPromise.then(() => clearTimeout(timer));
    }
    await closedPromise;
  }
  lines.on('line', line => {
    let event;
    try { event = JSON.parse(line); } catch { return; }
    if (!bootstrap && event.type === 'ready' && Number.isInteger(event.port) && event.port > 0 &&
        event.port < 65536 && /^[A-Za-z0-9_-]{24}$/.test(event.key)) {
      bootstrap = { origin: 'http://127.0.0.1:' + event.port, path: '/mobile/?managed=1#' + event.key };
      ready();
    } else if (event.type === 'status' && ['waiting', 'playing', 'finished'].includes(event.phase) &&
               Number.isInteger(event.players) && event.players >= 0 && event.players <= 8) {
      status = { ...status, phase: event.phase, players: event.players };
    }
  });
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(() => rejectReady(new Error('The installed Last Signal game did not start a managed arena. Update its hosting pack.')), 20000);
  try {
    await initialized;
    signal?.throwIfAborted();
    return {
      origin: bootstrap.origin,
      getStatus: async () => ({ ...status, joinable: !closed && status.phase === 'waiting' && status.players < status.capacity }),
      joinPath: async () => bootstrap.path,
      close
    };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
