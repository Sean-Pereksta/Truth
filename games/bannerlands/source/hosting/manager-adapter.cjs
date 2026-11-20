'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

exports.start = async function start({ packRoot, name, visibility, signal, onFailure }) {
  signal?.throwIfAborted();
  const entry = path.join(packRoot, 'game', 'source', 'multiplayer-server.mjs');
  const { createMatchServer } = await import(pathToFileURL(entry).href);
  const match = await createMatchServer({
    managed: true,
    port: 0,
    config: { enemies: 3 },
    lobby: { name, public: visibility === 'public', maxHumans: 4 },
  });
  let closing = false;
  function close() {
    closing = true;
    return match.close();
  }
  if (signal?.aborted) {
    await close();
    signal.throwIfAborted();
  }
  match.server.once('close', () => {
    if (!closing && !signal?.aborted) onFailure?.(new Error('The Bannerlands match server stopped.'));
  });
  return {
    origin: match.url,
    getStatus() {
      const lobby = match.getLobby();
      const phase = match.game.winner != null ? 'finished' : lobby.phase === 'waiting' ? 'waiting' : 'playing';
      return { phase, players: lobby.humans, capacity: lobby.maxHumans, queued: 0 };
    },
    joinPath() {
      const lobby = match.getLobby();
      if (!lobby.availableSeats) throw new Error('This campaign is full or already in progress.');
      return '/#managed=' + encodeURIComponent(lobby.id);
    },
    close,
  };
};

