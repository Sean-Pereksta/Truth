(() => {
  'use strict';

  // The score is sequenced against the audio clock so its pulse stays even during crowded battles.
  let audio, master, score, effects, noise, nextBeat = 0, step = 0;
  let lastScreen = '', lastSector = 0;
  const gates = new Map();
  const roots = [38, 38, 34, 36, 38, 41, 34, 36];
  const lead = [0, 7, 10, 14, 7, 3, 10, 7, 0, 7, 12, 10, 7, 3, 5, 7];
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);

  function unlock() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!audio) {
        audio = new Context();
        master = audio.createGain();
        const limiter = audio.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.ratio.value = 5;
        master.connect(limiter).connect(audio.destination);
        score = audio.createGain(); score.connect(master);
        effects = audio.createGain(); effects.connect(master);
        noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        nextBeat = audio.currentTime + .08;
      }
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch { /* Gameplay also works on devices without audio output. */ }
  }

  function env(bus, at, duration, level, attack = .006) {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), at + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.connect(bus);
    return gain;
  }
  function tone(freq, end, len, wave, level, bus = effects, at = audio.currentTime, attack = .006) {
    const osc = audio.createOscillator(), gain = env(bus, at, len, level, attack);
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(15, freq), at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(15, end), at + len);
    osc.connect(gain); osc.start(at); osc.stop(at + len + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  function hiss(freq, len, level, type = 'bandpass', bus = effects, at = audio.currentTime) {
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = env(bus, at, len, level);
    source.buffer = noise; source.loop = true;
    filter.type = type; filter.frequency.value = freq; filter.Q.value = .9;
    source.connect(filter).connect(gain); source.start(at, Math.random() * .8); source.stop(at + len);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  const bossCalls=[
    [185,277,.10,'square'],[470,350,.18,'sine'],[116,175,.13,'sawtooth'],
    [554,740,.09,'sine'],[370,554,.16,'triangle'],[147,220,.07,'square'],[330,247,.20,'triangle']
  ];
  function play(name, variant = 0) {
    if (!audio || audio.state !== 'running' || effects.gain.value < .001) return;
    const now = audio.currentTime, s = String(name).toLowerCase();
    const kind = typeof variant === 'number' ? variant : 0;
    const wait = s==='god-beam' ? .17 : s.endsWith('-blast') ? .12 : /hit|spark|impact|shot|rifle|fire/.test(s) ? .038 : .064;
    if (now - (gates.get(s) ?? -100) < wait) return;
    gates.set(s, now);
    if(s==='god-beam'){
      tone(122,61,.32,'sawtooth',.085,effects,now,.055);
      tone(384,192,.24,'sine',.12,effects,now,.022);
      hiss(1380,.26,.13);
    } else if (/gun|shoot|shot|fire|rifle|scatter|ordnance|emitter|fabricator|precision|assault/.test(s)) {
      const family = /scatter/.test(s) ? 1 : /precision/.test(s) ? 2 : /ordnance/.test(s) ? 3 : /emitter/.test(s) ? 4 : /fabricator/.test(s) ? 5 : Math.min(5, Math.floor(kind / 6));
      const pitch = 1 + (kind % 6) * .075;
      tone([165,104,760,75,460,610][family]*pitch, [42,32,105,27,215,280][family], [.09,.19,.17,.33,.075,.083][family],
        ['sawtooth','triangle','square','sine','sine','triangle'][family], [.062,.17,.036,.24,.07,.064][family]);
      hiss([1700,980,3400,690,2400,3100][family]*pitch, [.07,.14,.1,.21,.05,.055][family], [.19,.33,.16,.26,.09,.08][family]);
    } else if (s==='boss-death') {
      tone(132,27,.58,'sine',.29);hiss(880,.40,.32,'lowpass');
      tone(75,30,.38,'triangle',.14,effects,now+.19);
      hiss(1650,.22,.12,'bandpass',effects,now+.34);
    } else if (s.endsWith('-blast')) {
      if(s==='ion-blast'||s==='cryo-blast'){
        const icy=s==='cryo-blast';
        tone(icy?880:580,icy?330:49,icy?.24:.31,'sine',.13);
        tone(118,34,.24,'triangle',.17);hiss(icy?3250:2040,.20,.19);
      }else if(s==='spore-blast'){
        tone(220,49,.22,'sine',.16);hiss(1480,.25,.17);
        tone(135,77,.12,'triangle',.09,effects,now+.09);
      }else{
        const quake=s==='quake-blast';
        tone(quake?96:150,28,quake?.32:.27,'sine',.27);
        hiss(quake?620:990,.23,.29,'lowpass');
        hiss(2400,.065,.10,'highpass',effects,now+.02);
      }
    } else if (/dead|kill|explod|blast|break|death/.test(s)) {
      tone(112,26,.19,'triangle',.15); hiss(720,.21,.24,'lowpass');
    } else if (/hurt|damage/.test(s)) {
      tone(180,42,.26,'sawtooth',.11); hiss(1200,.14,.19);
    } else if (/dash|sweep|cast|active|ability|warp/.test(s)) {
      tone(128+kind*12,650,.22,'triangle',.12); hiss(1700,.24,.14,'highpass');
    } else if (s==='boss-windup') {
      const [lo,hi,spacing,wave]=bossCalls[kind]||bossCalls[0];
      tone(lo,lo*.98,spacing*.86,wave,.070);
      tone(hi,hi*1.04,.14,'triangle',.105,effects,now+spacing);
    } else if (s==='boss-phase') {
      const base=kind>=3?233:185;
      [1,1.25,1.5].forEach((ratio,i)=>tone(base*ratio,base*ratio,.14,'triangle',.11,effects,now+i*.11));
    } else if (/boss|alarm|windup|lock|portal|warn/.test(s)) {
      tone(312,312,.13,'square',.037); tone(415,400,.19,'triangle',.089,effects,now+.14);
    } else if (/reward|cache|level|gate|clear|equip|pick|heal|unlock/.test(s)) {
      [62,69,74].forEach((m,i)=>tone(hz(m),hz(m),.22,'sine',.12,effects,now+i*.065));
    } else if (/empty|reload|swap/.test(s)) {
      hiss(3000,.047,.2); tone(440,210,.08,'triangle',.08,effects,now+.055);
    } else if (/hit|impact/.test(s)) {
      hiss(1450,.045,.1);
    } else {
      tone(560,720,.065,'sine',.055);
    }
  }
  function update(g) {
    if (!audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    master.gain.setTargetAtTime(.78, now, .04);
    score.gain.setTargetAtTime(g.settings.music * .47, now, .08);
    effects.gain.setTargetAtTime(g.settings.volume, now, .045);
    const live = g.screen === 'play', boss = live&&g.map?.bossEntity?.hp>0 ? g.map.bossEntity : null;
    if (lastScreen !== g.screen || lastSector !== g.stage) {
      lastScreen = g.screen; lastSector = g.stage;
      nextBeat = now + .045; step = 0;
    }
    if (nextBeat < now - .2) nextBeat = now;
    const eighth = boss ? .219-.012*(boss.phase||1) : live ? .258 : .36;
    while (nextBeat < now + .12) {
      const at = nextBeat, beat = step % 16, root = roots[Math.floor(step/16) % roots.length] + [0,2,-2,5,0][((g.stage || 1)-1)%5];
      if (g.settings.music > 0 && !document.hidden) {
        if (beat === 0 || beat === 8) {
          [0,7,14].forEach((n,i)=>tone(hz(root+n+12),hz(root+n+12)*.997,eighth*7,'sine',.055-i*.008,score,at,.19));
        }
        if (live && (beat % 4 === 0 || boss && beat === 11)) {
          tone(105,32,.22,'sine',.31,score,at);
          tone(hz(root),hz(root)*.996,eighth*1.6,'triangle',.18,score,at);
        }
        if (live && beat % 4 === 2) hiss(6200,.054,.09,'highpass',score,at);
        if (live && (beat === 4 || beat === 12)) hiss(1550,.13,.16,'bandpass',score,at);
        if (beat % (live ? 2 : 4) === 1 || !live && beat % 4 === 0) {
          const note = hz(root+24+lead[(beat + Math.floor(step/32))%16]);
          tone(note,note*.998,eighth*1.85,'triangle',.072,score,at);
        }
      }
      step++; nextBeat += eighth;
    }
  }
  window.RelayAudio = { unlock, play, update };
})();
