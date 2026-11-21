'use strict';

const presenceMs = 12_000;
const finalResultsMs = 60_000;

function createRacePolling(lobby) {
  const retiredRooms = new Map();
  function connected(seat) {
    return Boolean(seat.stream) || (seat.lastPoll || 0) > Date.now() - presenceMs;
  }
  function changed(room, event, value, encodedValue) {
    room.revision = (room.revision || 0) + 1;
    if (event === 'room') room.roomRevision = room.revision;
    if (event === 'snapshot') {
      room.snapshotRevision = room.revision;
      room.pollSnapshot = encodedValue;
    }
    if (event === 'retired') {
      room.retired = value;
      room.resultExpires = Date.now() + finalResultsMs;
      retiredRooms.set(room.code, room);
    }
    if (!room.waking) {
      room.waking = true;
      queueMicrotask(() => {
        room.waking = false;
        for (const seat of room.seats) seat?.finishPoll?.();
      });
    }
  }
  function results(code) {
    const room = retiredRooms.get(code);
    if (room && room.resultExpires <= Date.now()) retiredRooms.delete(code);
    return retiredRooms.get(code);
  }
  function prune() {
    for (const code of retiredRooms.keys()) results(code);
  }
  function poll(res, room, seat, rawAfter, sendEncodedJson) {
    const parsed = Number(rawAfter);
    const after = rawAfter !== null && Number.isSafeInteger(parsed) && parsed <= room.revision ? parsed : -1;
    seat.finishPoll?.();
    let timer;
    function clear() {
      clearTimeout(timer);
      if (seat.finishPoll === finish) seat.finishPoll = null;
      res.removeListener('close', clear);
    }
    function finish() {
      clear();
      if (res.destroyed || res.writableEnded) return;
      const response = { revision: room.revision || 0 };
      if (after < 0 || room.retired || room.roomRevision > after) response.room = lobby(room);
      if (room.retired) response.retired = room.retired;
      const json = JSON.stringify(response);
      // The snapshot already contains serialized JSON with the exact state for
      // its tick. Appending it keeps every poll from re-encoding the race state.
      const snapshot = room.pollSnapshot && (after < 0 || room.retired || room.snapshotRevision > after);
      sendEncodedJson(res, snapshot ? json.slice(0, -1) + ',"snapshot":' + room.pollSnapshot + '}' : json);
    }
    if (room.retired || after !== (room.revision || 0)) return finish();
    seat.finishPoll = finish;
    res.once('close', clear);
    timer = setTimeout(finish, 900);
  }
  function close() { retiredRooms.clear(); }
  return { connected, changed, results, prune, poll, close };
}

module.exports = { createRacePolling };
