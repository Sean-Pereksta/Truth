'use strict';

const path = require('node:path');

exports.start = async function start({ packRoot, name, signal, onFailure }) {
  signal?.throwIfAborted();
  const { createRoomServer } = require(path.join(packRoot, 'game', 'server', 'host.cjs'));
  const room = await createRoomServer({ name, onFailure });
  if (signal?.aborted) {
    await room.close();
    signal.throwIfAborted();
  }
  return {
    origin: room.origin,
    getStatus: room.getStatus,
    joinPath() {
      if (!room.getStatus().joinable) throw new Error('This greenhouse is full or the shift has ended.');
      return '/#managed=orbit-bloom';
    },
    close: room.close,
  };
};
