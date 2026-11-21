'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createInputScheduler } = require('../network.js');

function fixture(transport = 'websocket') {
  let clock = 0, nextTimer = 0, writable = true;
  const timers = new Map(), sent = [];
  const scheduler = createInputScheduler({
    getTransport: () => transport,
    write(input) {
      if (!writable) return false;
      const packet = { at: clock, input };
      sent.push(packet);
      if (transport === 'websocket') return true;
      return new Promise(resolve => { packet.resolve = resolve; });
    },
    now: () => clock,
    schedule(run, delay) {
      const id = ++nextTimer;
      timers.set(id, { due: clock + delay, run });
      return id;
    },
    cancel: id => timers.delete(id)
  });
  function advance(time) {
    while (true) {
      const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > time) break;
      timers.delete(next[0]);
      clock = next[1].due;
      next[1].run();
    }
    clock = time;
  }
  return {
    scheduler, sent, advance,
    setTransport(value) { transport = value; },
    setWritable(value) { writable = value; },
    submit(at, input) { advance(at); scheduler.submit(input); }
  };
}

test('sends immediately, coalesces analog changes, and keeps one idle heartbeat', () => {
  const { submit, sent, advance } = fixture();
  submit(0, { gas: 1 });
  submit(6, { gas: 1, steer: .1 });
  submit(27, { gas: 1, steer: .3501 });
  advance(34);
  submit(40, { gas: 1, steer: .3502 });
  assert.deepEqual(sent.map(({ at, input }) => [at, input.steer]), [[0, 0], [34, .35]]);
  advance(253);
  assert.equal(sent.length, 2);
  advance(254);
  assert.equal(sent.length, 3);
  assert.deepEqual(sent[2].input, sent[1].input);
});

test('prioritizes WebSocket brake edges and preserves a tap between sends', () => {
  const { submit, sent, advance } = fixture();
  submit(0, { gas: 1 });
  submit(2, { gas: 1, item: true });
  submit(7, { gas: 1 });
  advance(34);
  assert.deepEqual(sent.map(({ at, input }) => [at, input.item]), [[0, false], [17, true], [34, false]]);
  submit(41, { brake: 1 });
  advance(51);
  assert.equal(sent.at(-1).input.brake, 1);
  submit(56, { gas: 1 });
  advance(68);
  assert.deepEqual(sent.slice(-2).map(({ at, input }) => [at, input.brake]), [[51, 1], [68, 0]]);
});

test('recovers from a blocked WebSocket and drops expired action taps on reconnect', () => {
  const { scheduler, submit, sent, advance, setTransport, setWritable } = fixture();
  submit(0, { gas: 1 });
  setWritable(false);
  submit(17, { gas: 1, ability: true });
  submit(23, { gas: 1, steer: -.7 });
  advance(50);
  assert.equal(sent.length, 1);
  setWritable(true);
  advance(51);
  assert.equal(sent.at(-1).input.ability, true);
  assert.equal(sent.at(-1).input.steer, -.7);

  setTransport(null);
  scheduler.pause();
  submit(76, { item: true });
  submit(90, { steer: .9 });
  advance(800);
  assert.equal(sent.length, 2);
  setTransport('websocket');
  scheduler.wake();
  assert.equal(sent.at(-1).input.item, false);
  assert.equal(sent.at(-1).input.steer, .9);
});

test('bounds HTTP concurrency and keeps a short tap present despite response reordering', async () => {
  const { scheduler, submit, sent, advance } = fixture('poll');
  submit(0, { gas: 1 });
  submit(4, { gas: 1, item: true });
  submit(10, { gas: 1 });
  advance(34);
  submit(41, { gas: 1, steer: .8 });
  advance(70);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].input.item, true);
  sent[0].resolve(true);
  await Promise.resolve();
  assert.equal(sent[2].input.steer, .8);
  assert.equal(sent[2].input.item, true);
  sent[2].resolve(true);
  await Promise.resolve();
  advance(104);
  assert.equal(sent[3].input.item, false);
  sent[1].resolve(false);
  await Promise.resolve();
  assert.equal(sent.length, 4);
  scheduler.reset();
  sent[3].resolve(true);
  await Promise.resolve();
  advance(3000);
  assert.equal(sent.length, 4);
});
