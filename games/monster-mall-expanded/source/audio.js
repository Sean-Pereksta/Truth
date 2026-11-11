// Entire soundscape is synthesized locally. Audio starts only after a gesture.
export function createAudio() {
  let context, master, compressor, ambient, rumble, airFilter, pulse;
  let active = true, volume = 0.72, ready = false;
  let stepClock = 0, breathClock = 0, heartClock = 0, elapsed = 0;
  const voices = [];
  const beastStepTimes = new Map();
  const cooldowns = Object.create(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function noiseBuffer(seconds = 2) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    // A mixture of white and damped noise gives texture without harsh hiss.
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.025) / 1.025;
      data[i] = white * 0.35 + brown * 2.1;
    }
    return buffer;
  }

  let noise;
  async function start() {
    try {
      if (!context) {
        const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioCtor) return false;
        context = new AudioCtor();
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -19;
        compressor.knee.value = 14;
        compressor.ratio.value = 7;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.22;
        master = context.createGain();
        master.gain.value = 0;
        master.connect(compressor).connect(context.destination);
        noise = noiseBuffer();
        ambient = context.createGain();
        ambient.gain.value = 0.075;
        ambient.connect(master);

        // Detuned, very low machinery under a thin electrical hum.
        for (const [frequency, level, type] of [[43.65, 0.22, 'sine'], [55.15, 0.12, 'sine'], [109.6, 0.035, 'triangle'], [60, 0.025, 'sine']]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = type;
          oscillator.frequency.value = frequency;
          gain.gain.value = level;
          oscillator.connect(gain).connect(ambient);
          oscillator.start();
        }
        const air = context.createBufferSource();
        air.buffer = noise;
        air.loop = true;
        airFilter = context.createBiquadFilter();
        airFilter.type = 'lowpass';
        airFilter.frequency.value = 480;
        const airGain = context.createGain();
        airGain.gain.value = 0.045;
        air.connect(airFilter).connect(airGain).connect(ambient);
        air.start();

        rumble = context.createOscillator();
        rumble.type = 'sine';
        rumble.frequency.value = 36.7;
        pulse = context.createGain();
        pulse.gain.value = 0;
        rumble.connect(pulse).connect(master);
        rumble.start();
      }
      await context.resume();
      master.gain.setTargetAtTime(active ? volume : 0, context.currentTime, 0.12);
      ready = true;
      return true;
    } catch {
      return false;
    }
  }

  function prune() {
    if (!context) return;
    const now = context.currentTime;
    for (let i = voices.length - 1; i >= 0; i--) {
      if (voices[i].end < now) {
        for (const node of voices[i].nodes) {
          try { node.disconnect(); } catch { /* Already released. */ }
        }
        voices.splice(i, 1);
      }
    }
  }

  function voice(duration, level, pan = 0) {
    if (!ready || !active || context.state !== 'running') return null;
    prune();
    if (voices.length >= 20) return null;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), now + Math.min(0.025, duration * 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    if (panner.pan) panner.pan.value = clamp(pan, -0.95, 0.95);
    gain.connect(panner).connect(master);
    const item = { now, end: now + duration + 0.08, duration, gain, nodes: [gain, panner] };
    voices.push(item);
    return item;
  }

  function oscillator(v, frequency, type = 'sine', endFrequency = frequency, level = 1, delay = 0) {
    if (!v) return;
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(Math.max(8, frequency), v.now + delay);
    source.frequency.exponentialRampToValueAtTime(Math.max(8, endFrequency), v.now + v.duration);
    const gain = context.createGain();
    gain.gain.value = level;
    source.connect(gain).connect(v.gain);
    source.start(v.now + delay);
    source.stop(v.now + v.duration + 0.02);
    v.nodes.push(source, gain);
    return source;
  }

  function filteredNoise(v, frequency, q = 0.7, type = 'lowpass', level = 1) {
    if (!v) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.value = level;
    source.connect(filter).connect(gain).connect(v.gain);
    source.start(v.now, rnd(0, 1));
    source.stop(v.now + v.duration + 0.02);
    v.nodes.push(source, filter, gain);
    return { source, filter };
  }

  function position(x, z, player) {
    if (!player || !Number.isFinite(x) || !Number.isFinite(z)) return { pan: 0, distance: 0, gain: 1 };
    const dx = x - player.x, dz = z - player.z;
    const distance = Math.hypot(dx, dz);
    const yaw = Number.isFinite(player.yaw) ? player.yaw : 0;
    return {
      pan: distance > 0.1 ? (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / distance : 0,
      distance,
      gain: clamp(1 / (1 + distance * 0.12), 0.07, 1)
    };
  }

  function event(type, x, z, player) {
    if (!context || !ready || !active) return;
    if (type === 'beaststep') { beastStep({ id: 'event-step', x, z, scale: 1 }, player); return; }
    const now = context.currentTime;
    const minimumGap = ({ scream: 0.8, roar: 1.25, eat: 0.45, attack: 0.32, step: 0.13, power: 0.3 })[type] || 0.07;
    if (now - (cooldowns[type] ?? -100) < minimumGap) return;
    cooldowns[type] = now;
    const p = position(x, z, player);
    let v;
    if (type === 'scream') {
      // Vibrating vocal fold source through two formants, with a breath layer.
      v = voice(rnd(0.75, 1.15), 0.18 * p.gain, p.pan);
      if (!v) return;
      const source = context.createOscillator();
      source.type = 'sawtooth';
      const base = rnd(460, 650);
      source.frequency.setValueAtTime(base * 0.7, now);
      source.frequency.exponentialRampToValueAtTime(base, now + 0.12);
      source.frequency.exponentialRampToValueAtTime(base * 0.58, now + v.duration);
      const vibrato = context.createOscillator();
      const depth = context.createGain();
      vibrato.frequency.value = rnd(5.5, 7.5);
      depth.gain.value = 18;
      vibrato.connect(depth).connect(source.frequency);
      for (const [frequency, level] of [[850, 0.35], [1650, 0.2]]) {
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 5;
        gain.gain.value = level;
        source.connect(filter).connect(gain).connect(v.gain);
        v.nodes.push(filter, gain);
      }
      source.start(now);
      vibrato.start(now);
      source.stop(now + v.duration);
      vibrato.stop(now + v.duration);
      filteredNoise(v, 2100, 1, 'bandpass', 0.055);
      v.nodes.push(source, vibrato, depth);
    } else if (type === 'roar') {
      v = voice(1.6, 0.31 * p.gain, p.pan);
      oscillator(v, rnd(80, 110), 'sawtooth', 31, 0.3);
      oscillator(v, 49, 'sine', 24, 0.6);
      const layer = filteredNoise(v, 370, 1.2, 'lowpass', 1.1);
      if (layer) layer.filter.frequency.exponentialRampToValueAtTime(110, now + 1.6);
    } else if (type === 'eat') {
      v = voice(0.5, 0.3 * p.gain, p.pan);
      filteredNoise(v, 520, 0.8, 'lowpass', 0.9);
      oscillator(v, 84, 'triangle', 29, 0.75);
    } else if (type === 'attack' || type === 'hurt') {
      v = voice(0.38, 0.34 * p.gain, p.pan);
      filteredNoise(v, 900, 0.6, 'lowpass', 0.8);
      oscillator(v, 115, 'sine', 36, 1);
    } else if (type === 'flash' || type === 'stun') {
      v = voice(0.7, 0.22, 0);
      filteredNoise(v, 1400, 0.5, 'highpass', 0.5);
      oscillator(v, 1300, 'sine', 240, 0.13);
      oscillator(v, 70, 'sine', 30, 1);
    } else if (type === 'power') {
      v = voice(1.45, 0.19, p.pan);
      oscillator(v, 45, 'sawtooth', 180, 0.18);
      oscillator(v, 90, 'sine', 240, 0.25);
      filteredNoise(v, 1800, 0.7, 'lowpass', 0.6);
    } else if (type === 'collect' || type === 'escape') {
      v = voice(0.62, type === 'collect' ? 0.075 : 0.045, p.pan);
      oscillator(v, 330, 'sine', 440, 0.65);
      oscillator(v, 660, 'sine', 880, 0.2, 0.08);
    } else if (type === 'win') {
      v = voice(3, 0.11);
      oscillator(v, 130.81, 'sine', 130.81, 0.7);
      oscillator(v, 196, 'sine', 196, 0.45);
      oscillator(v, 261.63, 'triangle', 261.63, 0.18, 0.15);
    } else if (type === 'lose' || type === 'death') {
      v = voice(2, 0.2);
      oscillator(v, 70, 'sawtooth', 20, 0.4);
      filteredNoise(v, 350, 1, 'lowpass', 0.8);
    } else if (type === 'door') {
      v = voice(0.75, 0.12 * p.gain, p.pan);
      filteredNoise(v, 1200, 5, 'bandpass', 0.3);
      oscillator(v, 120, 'triangle', 45, 0.45);
    } else if (type === 'click') {
      v = voice(0.08, 0.1);
      filteredNoise(v, 1800, 0.5, 'lowpass', 0.4);
    }
  }

  function beastStep(monster, player) {
    if (!context || !ready || !active || context.state !== 'running' || !monster) return false;
    const now = context.currentTime, id = monster.id ?? monster.type ?? 'beast';
    if (now - (beastStepTimes.get(id) ?? -100) < 0.24) return false;
    const p = position(monster.x, monster.z, player);
    const heightGap = Number.isFinite(monster.y) && Number.isFinite(player?.y) ? Math.abs(monster.y - player.y) : 0;
    const distance = Math.hypot(p.distance, heightGap * 1.2);
    if (distance > 44) return false;
    const size = clamp(Number.isFinite(monster.scale) ? monster.scale : 1, 0.65, 4);
    const pitch = (monster.type === 'brute' ? 0.86 : monster.type === 'crawler' ? 1.14 : 1) / Math.sqrt(size);
    // Low frequencies carry through the concourse. The brighter stone/metal
    // detail rolls off sooner, leaving an unmistakable distant footfall.
    const distanceGain = 1 / (1 + (distance / 10) ** 1.5);
    const farFade = clamp((44 - distance) / 12, 0, 1);
    const level = Math.min(0.56, 0.34 + (size - 1) * 0.075) * distanceGain * farFade / (1 + heightGap * 0.08);
    const v = voice(1.05, level, p.pan);
    if (!v) return false;
    beastStepTimes.set(id, now);
    // Heel hits first, then weight rolls onto the forefoot: two connected
    // impacts with a resonating floor below, rather than a rapid click.
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(0.0001, now);
    v.gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), now + 0.009);
    v.gain.gain.exponentialRampToValueAtTime(Math.max(0.00015, level * 0.09), now + 0.10);
    v.gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.52), now + 0.135);
    v.gain.gain.exponentialRampToValueAtTime(Math.max(0.00015, level * 0.055), now + 0.32);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    oscillator(v, 92 * pitch, 'sine', 28 * pitch, 1.05);
    oscillator(v, 51 * pitch, 'triangle', 23 * pitch, distance < 9 ? 0.52 : 0.34);
    oscillator(v, 127 * pitch, 'sine', 62 * pitch, 0.28, 0.112);
    const crack = filteredNoise(v, 950 / (1 + distance * 0.045), 0.8, 'lowpass', 0.92);
    if (crack) crack.filter.frequency.exponentialRampToValueAtTime(145, now + 0.46);
    filteredNoise(v, 1300, 1.5, 'bandpass', 0.11 / (1 + distance * 0.13));
    // Nearby fixtures answer each heavy step with a brief metallic tremor.
    for (const [frequency, strength] of [[187, 0.055], [311, 0.034], [487, 0.022]]) {
      oscillator(v, frequency * pitch, 'sine', frequency * pitch * 0.97, strength / (1 + distance * 0.1), 0.035);
    }
    return true;
  }

  function update(dt, state = {}) {
    if (!context || !ready) return;
    prune();
    if (!active || context.state !== 'running') return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    elapsed += dt;
    const danger = clamp(state.danger || 0, 0, 1);
    const stamina = clamp(Number.isFinite(state.stamina) ? state.stamina : 1, 0, 1);
    const now = context.currentTime;
    ambient.gain.setTargetAtTime(0.18 + danger * 0.28 + Math.sin(elapsed * 0.23) * 0.025, now, 0.8);
    airFilter.frequency.setTargetAtTime(260 + danger * 450, now, 1);
    pulse.gain.setTargetAtTime(0.014 + danger * 0.06, now, 0.2);
    rumble.frequency.setTargetAtTime(34 + danger * 11, now, 0.5);

    stepClock -= dt;
    if (state.moving && stepClock <= 0) {
      stepClock = state.sprinting ? 0.31 : 0.49;
      const v = voice(0.17, state.sprinting ? 0.095 : 0.048, Math.sin(elapsed * 14) * 0.18);
      filteredNoise(v, rnd(550, 950), 0.65, 'lowpass', 0.75);
      oscillator(v, rnd(100, 150), 'sine', 45, 0.35);
    }
    if (!state.moving) stepClock = Math.min(stepClock, 0.09);

    breathClock -= dt;
    if (breathClock <= 0 && (state.sprinting || stamina < 0.6 || danger > 0.7)) {
      breathClock = 0.8 + stamina * 0.8;
      const v = voice(0.55, 0.035 + (1 - stamina) * 0.06);
      const layer = filteredNoise(v, 850, 1.5, 'bandpass', 1.6);
      if (layer) layer.filter.frequency.linearRampToValueAtTime(450, now + 0.55);
    }

    heartClock -= dt;
    if (danger > 0.2 && heartClock <= 0) {
      heartClock = 0.95 - danger * 0.48;
      const v = voice(0.27, danger * 0.12);
      oscillator(v, 70, 'sine', 38, 1);
      oscillator(v, 90, 'sine', 42, 0.45, 0.13);
    }
  }

  function setVolume(value) {
    volume = clamp(Number.isFinite(value) ? value : 0.72, 0, 1);
    if (master) master.gain.setTargetAtTime(active ? volume : 0, context.currentTime, 0.06);
  }

  function toggle() {
    active = !active;
    if (master) master.gain.setTargetAtTime(active ? volume : 0, context.currentTime, 0.08);
    if (active) void start();
    return active;
  }

  return { start, setVolume, update, event, beastStep, toggle, get enabled() { return active; } };
}
