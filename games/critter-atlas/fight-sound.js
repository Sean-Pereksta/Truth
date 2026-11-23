// Each note is [pitch in Hz, ending pitch, duration in ms, gap after note].
// Short envelopes leave room for the next hex action and for the player's own audio.
const cues = {
  move:    { wave: 'triangle', notes: [[145,90,35,22],[185,110,32,0]] },
  melee:   { wave: 'sawtooth', notes: [[270,73,47,5],[112,48,56,0]] },
  ranged:  { wave: 'triangle', notes: [[460,1150,62,8],[940,250,62,0]] },
  heal:    { wave: 'sine', notes: [[523,540,74,12],[659,675,76,12],[784,815,104,0]] },
  power:   { wave: 'triangle', notes: [[330,392,54,9],[494,590,65,8],[698,790,90,0]] },
  ward:    { wave: 'square', notes: [[252,182,38,14],[380,355,82,0]] },
  haste:   { wave: 'sine', notes: [[625,915,47,5],[910,1260,47,0]] },
  cleanse: { wave: 'sine', notes: [[840,740,60,8],[650,570,56,8],[500,520,76,0]] },
  regen:   { wave: 'sine', notes: [[392,420,60,12],[581,625,78,0]] },
  effective: { wave: 'triangle', notes: [[520,920,54,7],[780,1040,76,0]] },
  resisted:  { wave: 'triangle', notes: [[429,180,68,10],[280,170,58,0]] },
  guard:   { wave: 'square', notes: [[235,192,35,15],[352,294,105,0]] },
  wait:    { wave: 'triangle', notes: [[760,680,29,55],[760,680,29,0]] },
  caught:  { wave: 'triangle', notes: [[392,440,55,7],[523,554,64,8],[784,830,120,0]] },
  escaped: { wave: 'square', notes: [[555,495,45,16],[370,208,105,0]] },
  slow:    { wave: 'triangle', notes: [[392,260,65,18],[290,196,74,0]] },
  exposed: { wave: 'square', notes: [[740,650,38,16],[880,745,50,0]] },
  stun:    { wave: 'sawtooth', notes: [[260,390,33,14],[220,355,36,15],[185,146,48,0]] },
  skip:    { wave: 'triangle', notes: [[300,210,75,17],[200,150,60,0]] },
  clear:   { wave: 'sine', notes: [[575,705,59,0]] },
  hurt:    { wave: 'triangle', notes: [[160,63,85,11],[114,57,55,0]] },
  burn:    { wave: 'sawtooth', notes: [[175,85,41,9],[255,105,47,9],[330,110,54,0]] },
  faint:   { wave: 'triangle', notes: [[392,332,70,9],[294,247,78,8],[196,98,120,0]] },
  won:     { wave: 'triangle', notes: [[392,392,80,13],[523,523,82,11],[659,659,90,9],[784,784,170,0]] },
  lost:    { wave: 'triangle', notes: [[392,370,93,12],[330,294,107,15],[220,165,165,0]] },
  fled:    { wave: 'triangle', notes: [[440,390,54,8],[330,290,58,8],[262,215,60,0]] }
};

function cueFor(event) {
  switch (event.type) {
    case 'attack': return event.modifiers?.find(modifier => modifier === 'effective' || modifier === 'resisted') ?? event.style;
    case 'support': return event.buff;
    case 'heal': return event.aura ? 'regen' : event.buff ?? 'heal';
    case 'capture': return event.success ? 'caught' : 'escaped';
    case 'hazard': return event.effect;
    case 'status': return event.phase === 'expire' ? 'clear' : event.phase === 'skip' ? 'skip' : event.effect;
    case 'recovery': return event.phase === 'expire' ? 'clear' : null;
    case 'outcome': return event.result;
    default: return event.type;
  }
}

export function createFightSound() {
  const host = globalThis.window ?? globalThis;
  const Audio = host.AudioContext ?? host.webkitAudioContext;
  const key = 'catnmice.critter-atlas.fight-sound';
  let enabled = false;
  try { enabled = !!Audio && host.localStorage?.getItem(key) === 'on'; } catch { /* Storage is optional. */ }
  let context, output, disposed = false, playingUntil = 0;
  const voices = new Set();

  function remember(value) {
    enabled = value;
    try { host.localStorage?.setItem(key, value ? 'on' : 'off'); } catch { /* Still applies to this battle. */ }
  }

  function silence() {
    if (!context) return;
    const now = context.currentTime;
    for (const {oscillator, gain} of voices) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(.0001, now, .004);
      oscillator.stop(now + .02);
    }
    playingUntil = 0;
  }

  async function activate() {
    if (!enabled || !Audio || disposed) return false;
    try {
      if (!context) {
        context = new Audio();
        output = context.createGain();
        output.gain.value = .26;
        output.connect(context.destination);
      }
      if (context.state !== 'running') await context.resume();
      return enabled && !disposed && context.state === 'running';
    } catch {
      return false;
    }
  }

  // A new battle can begin with a wild turn. The next genuine input resumes a
  // remembered sound preference on browsers that require a fresh gesture.
  function onGesture() {
    if (enabled && context?.state !== 'running') void activate();
  }
  host.addEventListener?.('pointerdown', onGesture, true);
  host.addEventListener?.('keydown', onGesture, true);
  if (enabled && host.navigator?.userActivation?.isActive) void activate();

  function tone(wave, start, length, from, to) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const end = start + length;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, end);
    const peak = wave === 'square' || wave === 'sawtooth' ? .08 : .23;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(gain);
    gain.connect(output);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      voices.delete(voice);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end + .002);
  }

  function play(event) {
    if (!enabled || disposed || context?.state !== 'running') return;
    const cue = cues[cueFor(event)];
    if (!cue) return;
    const now = context.currentTime;
    if (playingUntil > now) {
      // A status tick accompanying an impact does not pile a second tune on top.
      if (event.type === 'status' || event.type === 'recovery') return;
      silence();
    }
    try {
      let at = now + .008;
      for (const [from, to, length, gap] of cue.notes) {
        tone(cue.wave, at, length / 1000, from, to);
        at += (length + gap) / 1000;
      }
      playingUntil = at;
    } catch {
      // Device changes can interrupt a context mid-cue. Combat has already resolved.
      remember(false);
    }
  }

  async function toggle() {
    if (disposed || !Audio) return false;
    remember(!enabled);
    if (!enabled) {
      silence();
      return false;
    }
    const ready = await activate();
    if (!ready && !disposed) remember(false);
    return ready;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    host.removeEventListener?.('pointerdown', onGesture, true);
    host.removeEventListener?.('keydown', onGesture, true);
    silence();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
  return { get enabled() { return enabled; }, toggle, play, dispose };
}
