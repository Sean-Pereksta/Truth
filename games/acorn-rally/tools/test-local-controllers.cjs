// Run with node games/acorn-rally/tools/test-local-controllers.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'local-grid.js'), 'utf8');
const pad = (index, id = 'Xbox Identical Model') => ({ index, id, connected: true });
const indices = seats => Array.from(seats, seat => seat?.keyboard ? 'keyboard' : seat?.index ?? null);

function setup() {
  let devices = [];
  const game = {
    players: 2,
    navigator: { getGamepads: () => devices },
    document: { addEventListener() {} },
    one: () => null,
  };
  game.window = game;
  vm.runInNewContext(source, game);
  return {
    connect(...pads) {
      devices = [];
      for (const device of pads) devices[device.index] = device;
    },
    seats: () => game.initialPadSeats(2, game.AcornLocalPads.read()),
    assign: (seat, value) => game.changeLocalDevice(seat, value),
    grid() {
      const grid = { count: 2 };
      game.openLocalGrid(grid);
      return grid;
    },
    match: slots => game.AcornLocalPads.match(slots, game.AcornLocalPads.read()),
  };
}

test('a second controller joining setup preserves the first controller’s displayed seat', () => {
  const lobby = setup();
  lobby.connect(pad(2));
  assert.deepEqual(indices(lobby.seats()), [null, 2]);
  lobby.connect(pad(2), pad(4));
  assert.deepEqual(indices(lobby.seats()), [4, 2]);
  assert.deepEqual(indices(lobby.grid().padMap), [4, 2]);
});

test('identical controllers keep manually swapped seats through picker, race and reconnect', () => {
  const lobby = setup();
  lobby.connect(pad(2), pad(4));
  assert.deepEqual(indices(lobby.seats()), [2, 4]);
  lobby.assign(0, 'p4');
  const grid = lobby.grid();
  assert.deepEqual(indices(grid.padMap), [4, 2]);
  const raceSeats = Array.from(grid.padSeats, slot => ({ ...slot }));
  lobby.connect(pad(2));
  assert.deepEqual(indices(lobby.match(raceSeats)), [null, 2]);
  lobby.connect(pad(2), pad(0));
  assert.deepEqual(indices(lobby.match(raceSeats)), [0, 2]);
});

test('an explicit keyboard seat stays available and an automatic seat accepts a replacement', () => {
  const lobby = setup();
  lobby.connect(pad(0), pad(1));
  lobby.assign(0, 'keys');
  assert.deepEqual(indices(lobby.seats()), ['keyboard', 1]);
  lobby.connect(pad(4, 'Replacement Controller'));
  assert.deepEqual(indices(lobby.seats()), ['keyboard', 4]);
});
