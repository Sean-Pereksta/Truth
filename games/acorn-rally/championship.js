(function (root) {
  'use strict';

  const cups = [
    { id: 'forest', name: 'Forest Cup', theme: 'Follow the water from the forest floor to the treetops.', tracks: [0, 1, 2, 6] },
    { id: 'horizon', name: 'Horizon Cup', theme: 'Race across exposed sandstone, salt flats, chalk ridges and black sand.', tracks: [3, 4, 5, 7] },
    { id: 'expedition', name: 'Expedition Cup', theme: 'Four precision circuits through crystal caverns, open sky, orbit and lava.', tracks: [8, 9, 10, 11] },
    { id: 'spectrum', name: 'Spectrum Cup', theme: 'Race through the spillway, marsh and storm canopy, then finish on Prism Parade.', tracks: [13, 14, 15, 12] },
    { id: 'mythos', name: 'Mythos Cup', theme: 'Master difficulty. Cross cloud gaps, thread the fairy court, escape the Maw and climb to the summit of Olympus.', tracks: [16, 17, 18, 19] }
  ];
  const points = [12, 9, 7, 5, 4, 3, 2, 1];
  const levels = ['easy', 'normal', 'hard', 'ultimate'];
  const rewardDriver = 8;
  const spectrumDriver = 9;
  const angelDriver = 10;
  const wolfDriver = 11;
  const darknessCircuit = 20;
  const circuits = cups.flatMap(cup => cup.tracks);
  const spectrumCup = cups.findIndex(cup => cup.id === 'spectrum');
  const prefix = 'acorn-rally-championship-v1-';
  // Keep a playable session when the browser disables storage.
  const session = new Map();
  function read(key) {
    try {
      const value = root.localStorage.getItem(prefix + key);
      if (value !== null) return JSON.parse(value);
    } catch {}
    return session.get(key) ?? null;
  }
  function save(key, value) {
    session.set(key, value);
    try { root.localStorage.setItem(prefix + key, JSON.stringify(value)); } catch {}
  }
  function goldLevel(index) {
    return levels.slice().reverse().find(level => read(cups[index].id + '-gold-' + level) === true) || null;
  }
  function qualifyingWins() {
    return cups.slice(0, spectrumCup).filter((cup, i) => levels.indexOf(goldLevel(i)) >= levels.indexOf('hard')).length;
  }
  function hasUltimateWin(track) {
    return read('ultimate-first-' + track) === true;
  }
  function creditTrack(track) {
    const firstWin = !hasUltimateWin(track);
    if (firstWin) save('ultimate-first-' + track, true);
    if (track === darknessCircuit) return firstWin;
    if (!isDriverAvailable(angelDriver) && circuits.every(hasUltimateWin)) {
      save('angel-bear-unlocked', true);
      return true;
    }
    return false;
  }
  function recordUltimate(result, sharedGrid = false) {
    if (result.difficulty !== 'ultimate' || !['race','single','cup'].includes(result.mode) ||
        (result.trackIndex !== darknessCircuit && !circuits.includes(result.trackIndex)) || !Array.isArray(result.standings) ||
        !result.standings.some(row => !row.human)) return false;
    const winner = result.standings.find(row => row.position === 1);
    if (!winner?.human || !(winner.time > 0) || (!sharedGrid && winner.driverIndex !== result.driverIndex)) return false;
    return creditTrack(result.trackIndex);
  }
  function isDriverAvailable(index) {
    if (index === wolfDriver) return hasUltimateWin(darknessCircuit);
    if (index === angelDriver) return read('angel-bear-unlocked') === true;
    if (index === rewardDriver) return qualifyingWins() === spectrumCup;
    if (index === spectrumDriver) return goldLevel(spectrumCup) === 'ultimate';
    return true;
  }
  function rewardForCup(index) {
    if (cups[index]?.id === 'mythos') return angelDriver;
    return index === spectrumCup ? spectrumDriver : rewardDriver;
  }
  function rewardRequirement(index) {
    if (index === wolfDriver) return 'Win Realm of Darkness against Ultimate rivals';
    if (index === angelDriver) return 'Win all 20 cup circuits against Ultimate rivals';
    if (index === spectrumDriver) return 'Win Spectrum Cup on Ultimate';
    return 'Win Forest, Horizon and Expedition on Hard or Ultimate';
  }
  function rewardProgress(index) {
    if (index === wolfDriver) return 'Realm of Darkness on Ultimate';
    if (index === angelDriver) return circuits.filter(hasUltimateWin).length + '/' + circuits.length + ' Ultimate wins';
    return index === rewardDriver ? `${qualifyingWins()}/${spectrumCup} Hard cup wins` : 'Spectrum Cup on Ultimate';
  }
  function validGrid(ids, driver) {
    return Array.isArray(ids) && ids.length === points.length && new Set(ids).size === points.length &&
      ids.includes(driver) && ids.every(n => Number.isInteger(n) && n >= 0 && n <= wolfDriver);
  }
  function validRun(run, index) {
    return run && run.index === index && typeof run.id === 'string' && [50, 100, 150, 200].includes(run.cc) &&
      levels.includes(run.difficulty) && Number.isInteger(run.driver) && run.driver >= 0 && run.driver <= wolfDriver &&
      Array.isArray(run.rounds) && run.rounds.length < cups[index].tracks.length &&
      run.rounds.every(ids => validGrid(ids, run.driver) && ids.every(n => run.rounds[0].includes(n)));
  }
  function activeRun(index) {
    const run = read(cups[index].id + '-active');
    return validRun(run, index) ? run : null;
  }
  function start(index, driver, cc, difficulty) {
    const run = {id: Date.now().toString(36) + Math.random().toString(36).slice(2), index, driver, cc, difficulty, rounds: []};
    save(cups[index].id + '-active', run);
    return run;
  }
  function standings(run) {
    const racers = new Map();
    for (const round of run.rounds) {
      round.forEach((driver, place) => {
        const row = racers.get(driver) || {driver, total: 0, countbacks: Array(points.length).fill(0)};
        row.total += points[place];
        row.countbacks[place]++;
        row.last = place + 1;
        racers.set(driver, row);
      });
    }
    return Array.from(racers.values()).sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      for (let i = 0; i < points.length; i++) {
        if (a.countbacks[i] !== b.countbacks[i]) return b.countbacks[i] - a.countbacks[i];
      }
      return a.last - b.last;
    });
  }
  function record(run, result) {
    const cup = cups[run.index], roundIndex = run.rounds.length;
    if (result.trackIndex !== cup.tracks[roundIndex]) throw new Error('Cup result has the wrong circuit');
    const ranked = result.standings.slice().sort((a, b) => a.position - b.position);
    const ids = ranked.map(row => row.driverIndex);
    if (!validGrid(ids, run.driver) || ranked.some((row, i) => row.position !== i + 1) ||
        (roundIndex && ids.some(n => !run.rounds[0].includes(n)))) throw new Error('Cup result has an invalid grid');
    const next = {...run, rounds: [...run.rounds, ids]};
    const active = activeRun(run.index);
    const current = active?.id === run.id && active.rounds.length === roundIndex;
    const complete = next.rounds.length === cup.tracks.length;
    const won = complete && standings(next)[0].driver === next.driver;
    const reward = rewardForCup(run.index), hadReward = isDriverAvailable(reward);
    if (won) save(cup.id + '-gold-' + next.difficulty, true);
    if (current) save(cup.id + '-active', complete ? null : next);
    const unlocked = !hadReward && isDriverAvailable(reward);
    return {run: next, complete, won, unlocked, unlockedDriver: unlocked ? reward : null};
  }
  // Older in-progress cups retain finishing order for each completed round.
  cups.forEach((cup, index) => {
    const run = activeRun(index);
    if (run?.difficulty === 'ultimate') run.rounds.forEach((ids, round) => {
      if (ids[0] === run.driver) creditTrack(cup.tracks[round]);
    });
  });
  root.AcornChampionship = {cups, points, rewardDriver, spectrumDriver, angelDriver, wolfDriver, darknessCircuit, hasUltimateWin, recordUltimate, goldLevel, qualifyingWins,
    isDriverAvailable, rewardForCup, rewardRequirement, rewardProgress, activeRun, start, standings, record};
})(typeof window !== 'undefined' ? window : globalThis);
