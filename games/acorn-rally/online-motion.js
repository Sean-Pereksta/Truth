'use strict';

((root) => {
  const ticksPerMs = 60 / 1000;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const blend = (from, to, fraction) => from + (to - from) * fraction;
  const blendAngle = (from, to, fraction) => {
    const delta = to - from;
    return from + Math.atan2(Math.sin(delta), Math.cos(delta)) * fraction;
  };

  function create(sim) {
    let observed, cursor, lastFrame;
    let spacing = 3, jitter = 0, delay = 6;

    function bracket(history, now) {
      if (!history || history.length < 2) return null;
      for (const sample of history) {
        if (observed && sample.tick <= observed.tick) continue;
        if (observed) {
          const tickGap = sample.tick - observed.tick;
          const arrivalGap = (sample.receivedAt - observed.receivedAt) * ticksPerMs;
          spacing = blend(spacing, clamp(tickGap, 2, 24), .17);
          jitter = blend(jitter, clamp(Math.abs(arrivalGap - tickGap), 0, 24), .20);
          const targetDelay = clamp(spacing * 1.7 + jitter * 2.2, 6, 24);
          delay = blend(delay, targetDelay, targetDelay > delay ? .45 : .08);
        }
        observed = sample;
      }
      const first = history[0], latest = history.at(-1);
      const target = latest.tick + clamp((now - latest.receivedAt) * ticksPerMs, 0, spacing) - delay;
      if (cursor === undefined || cursor < first.tick) cursor = Math.max(first.tick, target);
      const frameTicks = clamp((now - (lastFrame ?? now)) * ticksPerMs, 0, 3);
      lastFrame = now;
      // Adjust the playback rate instead of rewinding when the buffer depth changes.
      const rate = clamp(1 + (target - cursor) * .045, .45, 1.25);
      cursor = Math.min(latest.tick + 3, cursor + frameTicks * rate);
      let after = history.findIndex(sample => sample.tick >= cursor);
      if (after === -1) after = history.length - 1;
      if (after === 0) after = 1;
      const a = history[after - 1], b = history[after];
      const span = b.tick - a.tick;
      if (span <= 0 || span > 24 || a.state.countdown > 0 || b.state.countdown > 0) return null;
      return { a: a.state, b: b.state, fraction: clamp((cursor - a.tick) / span, 0, 1 + 3 / span), span };
    }

    function view(state, localSeat, history, now) {
      if (state.done || state.countdown > 0) return state;
      const pair = bracket(history, now);
      if (!pair) return state;
      const { a, b, fraction, span } = pair;
      let adjusted = false;
      const racers = state.racers.map(racer => {
        if (racer.seat === localSeat || racer.finish || racer.hawk || racer.fall || racer.flight || sim.isFrozen(state, racer)) return racer;
        const previous = a.racers[racer.seat], next = b.racers[racer.seat];
        if (!previous || !next || previous.finish || next.finish || previous.hawk || next.hawk ||
            previous.fall || next.fall || previous.flight || next.flight ||
            previous.branch !== racer.branch || next.branch !== racer.branch ||
            sim.isFrozen(a, previous) || sim.isFrozen(b, next)) return racer;
        const distanceLimit = Math.max(Math.abs(previous.v), Math.abs(next.v)) * span / 60 + 3;
        if (Math.abs(next.s - previous.s) > distanceLimit || Math.abs(next.x - previous.x) > 5 ||
            Math.abs(racer.s - next.s) > Math.max(12, Math.abs(racer.v) * .5)) return racer;
        adjusted = true;
        return { ...racer, s: blend(previous.s, next.s, fraction), x: blend(previous.x, next.x, fraction),
          yaw: blendAngle(previous.yaw || 0, next.yaw || 0, Math.min(fraction, 1)),
          rampAngle: blend(previous.rampAngle || 0, next.rampAngle || 0, Math.min(fraction, 1)) };
      });
      return adjusted ? { ...state, racers } : state;
    }

    return { view };
  }

  if (typeof module === 'object' && module.exports) module.exports = { create };
  else root.AcornOnlineMotion = { create };
})(globalThis);
