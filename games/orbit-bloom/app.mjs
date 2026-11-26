import { FLOWERS, LEVELS, NEEDS, POTS, getLevel } from './levels.mjs';
import { applyCommand, canReachTarget, createMatch, getPlantNeed, getTruckWindow, getWeather, stepMatch } from './sim.mjs';
import { createRoomClient, listPublicRooms, probeRoom, resolveRoomCode, roomJoinUrl } from './network.mjs';
import { drawPaintedPlant, loadPaintedWorld } from './painted-world.mjs';
import { createBoardRenderer, drawMenuArt, THEME_COLORS } from './render.mjs';

const $ = id => document.getElementById(id);
const canvas = $('board');
const renderer = createBoardRenderer(canvas);
const views = ['menu', 'levels', 'directory', 'room', 'play', 'results'];
const controlledDirections = new Map([
  ['arrowleft', [-1, 0]], ['a', [-1, 0]], ['arrowright', [1, 0]], ['d', [1, 0]],
  ['arrowup', [0, -1]], ['w', [0, -1]], ['arrowdown', [0, 1]], ['s', [0, 1]],
]);
const taskLabels = { sow: 'Sowing', water: 'Watering', repot: 'Repotting', prune: 'Pruning', deliver: 'Loading the truck',
  sunstone: 'Adding sunstone', moonsoil: 'Mixing moonsoil', stardust: 'Dusting with stardust', compost: 'Composting',
};
const held = new Set();
const orderCards = new Map();
const managed = new URLSearchParams(location.hash.slice(1)).has('managed');
const playerName = new URL(location.href).searchParams.get('name')?.slice(0, 24) || '';
let view;
let state;
let level;
let localId = 'local';
let network;
let roomSnapshot;
let practice = false;
let target;
let localRound = 0;
let playingRound;
let lastFrame = performance.now();
let lastHud = 0;
let lastMenuPaint = 0;
let directoryRequest = 0;

void loadPaintedWorld().then(() => { lastMenuPaint = 0; });

function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const medals = readPreference('orbit-bloom-medals', {});
$('effects').checked = readPreference('orbit-bloom-reduced-effects', matchMedia('(prefers-reduced-motion: reduce)').matches);
$('effects').addEventListener('change', () => {
  writePreference('orbit-bloom-reduced-effects', $('effects').checked);
  lastMenuPaint = 0;
});
$('directory-name').value = playerName || readPreference('orbit-bloom-name', '');
$('room-name').value = $('directory-name').value;

function show(next) {
  if (view === next) return;
  view = next;
  for (const id of views) $(id).hidden = id !== next;
  $('back').hidden = next === 'menu' || (next === 'room' && managed && !network?.playerId);
  if (next === 'menu') lastMenuPaint = 0;
  if (next === 'play') canvas.focus({ preventScroll: true });
}

function difficultyText(value) {
  return '★'.repeat(value) + '☆'.repeat(5 - value);
}

function fillLevels(untimed = false) {
  practice = untimed;
  $('levels-heading').textContent = untimed ? 'Choose a practice greenhouse' : 'Choose a greenhouse';
  const buttons = LEVELS.map(map => {
    const button = document.createElement('button');
    button.className = 'level-button';
    button.style.setProperty('--level-color', THEME_COLORS[map.theme]);
    const title = document.createElement('strong');
    title.textContent = map.name;
    const rating = document.createElement('span');
    rating.className = 'rating';
    const earned = medals[map.id] || 0;
    rating.textContent = `${difficultyText(map.difficulty)} difficulty${earned ? ` · ${earned}/3 shift stars` : ''}`;
    const description = document.createElement('small');
    description.textContent = map.description;
    button.append(title, rating, description);
    if (map.platforms?.length || map.conveyors?.length) {
      const terrain = document.createElement('small');
      terrain.className = 'level-terrain';
      terrain.textContent = [map.platforms?.length && 'Moving platforms', map.conveyors?.length && 'Conveyor handoffs'].filter(Boolean).join(' · ');
      button.append(terrain);
    }
    button.addEventListener('click', () => startLocal(map.id));
    return button;
  });
  $('level-list').replaceChildren(...buttons);
  show('levels');
}

function beginShift(nextState, round) {
  playingRound = round;
  state = nextState;
  level = getLevel(state.levelId);
  renderer.prepare(level);
  orderCards.clear();
  $('orders').replaceChildren();
  $('map-name').textContent = level.name;
  $('map-hint').textContent = level.hint || '';
  target = undefined;
  held.clear();
  lastFrame = performance.now();
  lastHud = 0;
  const buttons = state.stations.map(station => {
    const button = document.createElement('button');
    button.textContent = station.label;
    button.addEventListener('click', () => send({ type: 'target', stationId: station.id }));
    return button;
  });
  $('station-list').replaceChildren(...buttons);
  show('play');
  updateHud();
}

function startLocal(levelId) {
  localId = 'local';
  beginShift(createMatch({ levelId, practice }), `solo-${++localRound}`);
}

function finishShift() {
  if (view === 'results' || !state?.results) return;
  const { stars, delivered, premium, missed, score } = state.results;
  if (!network?.playerId && !state.practice && stars > (medals[level.id] || 0)) {
    medals[level.id] = stars;
    writePreference('orbit-bloom-medals', medals);
  }
  const starsEl = $('result-stars');
  starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  starsEl.setAttribute('aria-label', `${stars} of 3 shift stars`);
  $('result-summary').textContent = `${delivered} shipped · ${premium} premium · ${missed} missed · ${score} points`;
  $('replay').textContent = network?.playerId ? 'Return to lobby' : 'Play again';
  $('next').hidden = Boolean(network?.playerId) || LEVELS.at(-1).id === level.id;
  show('results');
}

function displayTime(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function makeOrder(order) {
  const flower = FLOWERS[order.flowerId];
  const card = document.createElement('div');
  card.className = 'order';
  card.style.setProperty('--flower', flower.color);
  const art = document.createElement('canvas');
  art.width = art.height = 32;
  art.setAttribute('aria-hidden', 'true');
  const paintIcon = () => {
    const context = art.getContext('2d');
    context.clearRect(0, 0, 32, 32);
    drawPaintedPlant(context, flower.id, 'bloom', 16, 31, 28, 0, { pot: flower.pot, effects: false });
  };
  paintIcon();
  void loadPaintedWorld().then(() => { if (card.isConnected) paintIcon(); });
  const copy = document.createElement('div');
  copy.className = 'order-text';
  const title = document.createElement('strong');
  title.textContent = flower.name;
  const time = document.createElement('span');
  copy.append(title, time);
  const progress = document.createElement('div');
  progress.className = 'order-progress';
  card.append(art, copy, progress);
  $('orders').append(card);
  const detail = { card, time, progress };
  orderCards.set(order.id, detail);
  return detail;
}

function updateHud() {
  const open = state.orders.filter(order => order.status === 'open');
  const openIds = new Set(open.map(order => order.id));
  for (const [id, entry] of orderCards) {
    if (!openIds.has(id)) {
      entry.card.remove();
      orderCards.delete(id);
    }
  }
  const empty = $('orders').querySelector('.empty-order');
  if (open.length) empty?.remove();
  else if (!empty) {
    const copy = document.createElement('span');
    copy.className = 'empty-order';
    copy.textContent = 'Waiting for courier orders';
    $('orders').append(copy);
  }
  for (const order of open) {
    const detail = orderCards.get(order.id) ?? makeOrder(order);
    const untimed = order.deadlineMs === null;
    const remaining = untimed ? 1 : Math.max(0, order.deadlineMs - state.elapsedMs);
    detail.time.textContent = untimed ? 'Practice' : displayTime(remaining);
    detail.progress.style.transform = `scaleX(${untimed ? 1 : remaining / Math.max(1, order.deadlineMs - order.createdMs)})`;
  }
  $('clock').textContent = state.practice ? 'Practice' : displayTime(state.durationMs - state.elapsedMs);
  $('deliveries').textContent = state.practice ? `${state.stats.delivered} shipped` : `${state.stats.delivered} / ${state.goals[0]} shipped`;
  const truck = getTruckWindow(state);
  const sky = getWeather(state);
  const doors = truck.remainingMs === null ? '' : `${truck.open ? 'Truck leaves' : 'Truck arrives'} in ${Math.ceil(truck.remainingMs / 1000)}s`;
  const transport = level.platforms?.length ? 'Platform docks marked +' : level.conveyors?.length ? 'Load pots at gold belt ends' : '';
  $('map-event').textContent = [doors, sky ? `${sky.label}${sky.active ? ' active' : ` in ${Math.ceil(sky.remainingMs / 1000)}s`}` : '', transport].filter(Boolean).join(' · ');

  const gardener = currentGardener();
  const plant = state.plants.find(item => item.id === gardener?.carryId);
  const need = plant ? getPlantNeed(plant, state) : null;
  const notice = gardener?.notice?.untilMs > state.elapsedMs ? gardener.notice.text : '';
  const current = FLOWERS[plant?.flowerId];
  const task = gardener?.action;
  const progress = $('task-progress');
  progress.hidden = !task;
  if (task) progress.value = 1 - Math.max(0, task.remainingMs / task.durationMs);
  $('carried').textContent = current?.name ?? 'Empty hands';
  const nextAction = need ? `${need.label}${need.kind === 'repot' ? ` · ${POTS[need.variant]}` : ''}` : 'Tap a seed tray or pick up a pot';
  const prompt = (task && taskLabels[task.kind]) || (gardener?.platformId ? 'Riding the platform' : '') || notice || nextAction;
  if ($('prompt').textContent !== prompt) $('prompt').textContent = prompt;
  $('drop').disabled = !plant;
  const shortcut = findShortcut(gardener, plant, need);
  $('action').disabled = !gardener;
  $('drop').textContent = plant && beltAt(Math.round(gardener.x), Math.round(gardener.y)) ? 'Send pot' : 'Set down';
  $('action').textContent = shortcut?.label ?? 'Act';
}

function currentGardener() {
  return state?.players.find(player => player.id === localId);
}

function availableBelt(gardener, station) {
  const belts = (level.conveyors ?? []).filter(belt => !state.plants.some(plant => plant.beltId === belt.id));
  const score = belt => {
    const from = belt.path[0];
    const end = belt.path.at(-1);
    return Math.hypot(from.x - gardener.x, from.y - gardener.y) + (station ? Math.hypot(end.x - station.x, end.y - station.y) : 0);
  };
  const candidate = belts.sort((a, b) => score(a) - score(b)).find(belt => canReachTarget(state, localId, { type: 'target', conveyorId: belt.id }));
  return candidate ? { command: { type: 'target', conveyorId: candidate.id }, label: 'Send pot' } : null;
}

function findShortcut(gardener, plant, need) {
  if (!gardener) return null;
  const distance = station => Math.hypot(station.x - gardener.x, station.y - gardener.y);
  const reachable = command => canReachTarget(state, localId, command);
  const toStation = value => ({ type: 'target', stationId: value.id });
  if (plant && need) {
    const stationType = NEEDS[need.kind]?.station;
    const options = state.stations.filter(station => station.type === stationType &&
      (!need.variant || station.variant === need.variant)).sort((a, b) => distance(a) - distance(b));
    const reachableStations = options.filter(station => reachable(toStation(station)));
    const candidate = reachableStations.find(station => !station.plantId && !station.busyBy && station.cooldownUntilMs <= state.elapsedMs);
    if (candidate) return { command: toStation(candidate), label: need.kind === 'repot' ? 'Repot' : need.label };
    return options.length && !reachableStations.length ? availableBelt(gardener, options[0]) : null;
  }
  const ready = state.plants.flatMap(staged => {
    if (staged.holderId || staged.beltId) return [];
    const station = staged.stationId && state.stations.find(item => item.id === staged.stationId);
    if (station && station.type !== 'shelf' && getPlantNeed(staged, state).kind !== 'remove') return [];
    return [{ item: station || staged, command: station ? toStation(station) : { type: 'target', plantId: staged.id } }];
  }).sort((a, b) => distance(a.item) - distance(b.item)).find(option => reachable(option.command));
  return ready ? { command: ready.command, label: 'Pick up' } : null;
}

function beltAt(x, y) {
  return level.conveyors?.find(({ path: [point] }) => point.x === x && point.y === y);
}

function send(command) {
  if (view !== 'play' || !state) return;
  if (command.type === 'target') target = command;
  if (command.type === 'move' || command.type === 'drop') target = undefined;
  if (network?.playerId) network.command(command);
  else applyCommand(state, localId, command);
}

function movement() {
  let x = 0;
  let y = 0;
  for (const key of held) {
    const [dx, dy] = controlledDirections.get(key);
    x += dx;
    y += dy;
  }
  send({ type: 'move', x: Math.sign(x), y: Math.sign(y) });
}

function stopMovement() {
  if (!held.size) return;
  held.clear();
  movement();
}

addEventListener('keydown', event => {
  if (view !== 'play' || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A)$/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (controlledDirections.has(key)) {
    event.preventDefault();
    if (!held.has(key)) { held.add(key); movement(); }
  } else if (key === ' ' || key === 'e' || key === 'q') {
    event.preventDefault();
    if (!event.repeat) send({ type: key === 'q' ? 'drop' : 'interact' });
  }
});

addEventListener('keyup', event => {
  if (held.delete(event.key.toLowerCase())) movement();
});
addEventListener('blur', stopMovement);
document.addEventListener('visibilitychange', stopMovement);

canvas.addEventListener('pointerdown', event => {
  if (view !== 'play' || !event.isPrimary || event.button > 0) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  stopMovement();
  const rect = canvas.getBoundingClientRect();
  const { bubble, cell } = renderer.hitTest((event.clientX - rect.left) / rect.width * canvas.width,
    (event.clientY - rect.top) / rect.height * canvas.height);
  if (bubble && (!bubble.plantId || !currentGardener()?.carryId)) {
    send({ type: 'target', ...bubble });
    return;
  }
  if (!cell) return;
  const { x, y } = cell;
  const plant = state.plants.find(item => !item.holderId && !item.stationId && !item.beltId && Math.round(item.x) === x && Math.round(item.y) === y);
  const station = state.stations.find(item => item.x === x && item.y === y);
  const carried = currentGardener()?.carryId;
  const belt = beltAt(x, y);
  if (plant && !carried) send({ type: 'target', plantId: plant.id });
  else if (belt && carried) send({ type: 'target', conveyorId: belt.id });
  else if (station) send({ type: 'target', stationId: station.id });
  else send({ type: 'target', x, y });
});

$('action').addEventListener('click', () => {
  const gardener = currentGardener();
  const plant = state.plants.find(item => item.id === gardener?.carryId);
  const shortcut = findShortcut(gardener, plant, plant && getPlantNeed(plant, state));
  send(shortcut?.command ?? { type: 'interact' });
  canvas.focus({ preventScroll: true });
});
$('drop').addEventListener('click', () => {
  send({ type: 'drop' });
  canvas.focus({ preventScroll: true });
});

async function openListing(room) {
  const name = $('directory-name').value.trim();
  writePreference('orbit-bloom-name', name);
  $('directory-status').textContent = 'Checking the greenhouse…';
  const live = await probeRoom(room);
  if (view !== 'directory') return;
  if (!live) {
    $('directory-status').textContent = 'This greenhouse is full or offline. Refresh to find another room.';
    return;
  }
  const url = roomJoinUrl(live, name);
  if (url) location.assign(url);
}

async function refreshRooms() {
  const request = ++directoryRequest;
  $('directory-status').textContent = 'Looking for live lobbies…';
  $('refresh').disabled = true;
  try {
    const rooms = await listPublicRooms();
    if (request !== directoryRequest) return;
    $('directory-status').textContent = rooms.length ? '' : 'No public lobbies are visible. You can join a private room by code.';
    $('rooms').replaceChildren(...rooms.map(room => {
      const card = document.createElement('div');
      card.className = 'room-card';
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = room.name;
      const details = document.createElement('div');
      details.className = 'message';
      details.textContent = `${room.players} / 4 · ${room.phase === 'playing' ? 'Shift in progress' : room.phase === 'finished' ? 'Shift complete' : 'Waiting'}`;
      info.append(name, details);
      const join = document.createElement('button');
      join.textContent = 'Join';
      join.disabled = !room.joinable;
      join.addEventListener('click', () => void openListing(room));
      card.append(info, join);
      return card;
    }));
  } catch (error) {
    if (request === directoryRequest) $('directory-status').textContent = error.message;
  } finally {
    if (request === directoryRequest) $('refresh').disabled = false;
  }
}

function showRoom() {
  show('room');
  updateRoom();
}

function updateRoom() {
  const joined = Boolean(network?.playerId);
  $('enter-room').hidden = joined;
  $('room-controls').hidden = !joined;
  $('back').hidden = managed && !joined;
  if (!joined || !roomSnapshot) return;
  const host = roomSnapshot.hostId === localId;
  const me = roomSnapshot.players.find(player => player.id === localId);
  $('room-heading').textContent = roomSnapshot.name || 'Orbit Bloom lobby';
  $('host-level').hidden = !host;
  $('start').hidden = !host;
  $('ready').textContent = me?.ready ? 'Unready' : 'Ready';
  $('players').replaceChildren(...roomSnapshot.players.map(player => {
    const card = document.createElement('div');
    card.className = 'room-card';
    const name = document.createElement('strong');
    name.textContent = player.id === localId ? `${player.name} (you)` : player.name;
    const status = document.createElement('span');
    status.textContent = player.id === roomSnapshot.hostId ? 'Host' : player.ready ? 'Ready' : 'In lobby';
    card.append(name, status);
    return card;
  }));
  $('room-status').textContent = `${roomSnapshot.players.length} / 4 gardeners${host ? '' : ' · waiting for the host to start a shift'}`;
}

function receiveRoom(snapshot) {
  roomSnapshot = snapshot;
  localId = network.playerId;
  if (snapshot.phase === 'playing' && snapshot.state) {
    const round = `room-${snapshot.round}`;
    if (playingRound !== round || view !== 'play') beginShift(snapshot.state, round);
    else state = snapshot.state;
  } else if (snapshot.phase === 'finished' && snapshot.state && view === 'play') {
    state = snapshot.state;
    finishShift();
  } else if (view === 'room') updateRoom();
}

function roomError(error) {
  if (view === 'play' && network?.playerId) {
    $('prompt').textContent = 'Reconnecting to the greenhouse…';
  } else {
    showRoom();
    $('room-status').textContent = error.message;
  }
}

async function quitRoom() {
  const client = network;
  network = null;
  roomSnapshot = null;
  state = null;
  playingRound = null;
  await client?.leave().catch(() => {});
}

for (const map of LEVELS) {
  const option = document.createElement('option');
  option.value = map.id;
  option.textContent = `${map.name} · ${map.difficulty}★`;
  $('room-level').append(option);
}

$('campaign').addEventListener('click', () => fillLevels(false));
$('practice').addEventListener('click', () => fillLevels(true));
$('live').addEventListener('click', () => { show('directory'); void refreshRooms(); });
$('refresh').addEventListener('click', () => void refreshRooms());
$('join-by-code').addEventListener('submit', async event => {
  event.preventDefault();
  $('directory-status').textContent = 'Looking up room code…';
  try {
    const room = await resolveRoomCode($('room-code').value.trim().toUpperCase());
    if (view !== 'directory') return;
    if (room) await openListing(room);
    else $('directory-status').textContent = 'That room code is unavailable. Check it and try again.';
  } catch (error) { $('directory-status').textContent = error.message; }
});

$('enter-room').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('room-name').value.trim();
  if (!name) { $('room-status').textContent = 'Enter a gardener name.'; return; }
  const button = $('enter-room').querySelector('button');
  button.disabled = true;
  writePreference('orbit-bloom-name', name);
  $('room-status').textContent = 'Joining the greenhouse…';
  network ??= createRoomClient({ onSnapshot: receiveRoom, onError: roomError });
  try { await network.join(name); }
  catch (error) { roomError(error); }
  finally { button.disabled = false; }
});

$('ready').addEventListener('click', () => {
  const me = roomSnapshot?.players.find(player => player.id === localId);
  void network?.ready(!me?.ready).catch(roomError);
});
$('start').addEventListener('click', async () => {
  $('start').disabled = true;
  try { await network?.start($('room-level').value); }
  catch (error) { roomError(error); }
  finally { $('start').disabled = false; }
});

$('back').addEventListener('click', async () => {
  stopMovement();
  if (network) {
    await quitRoom();
    if (managed) showRoom();
    else show('menu');
  } else if (view === 'play' || view === 'results') {
    state = null;
    fillLevels(practice);
  } else show('menu');
});
$('replay').addEventListener('click', () => {
  if (network?.playerId) showRoom();
  else startLocal(level.id);
});
$('next').addEventListener('click', () => {
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  if (next) startLocal(next.id);
});

function frame(now) {
  const delta = Math.min(70, now - lastFrame);
  lastFrame = now;
  const effects = !$('effects').checked;
  if (view === 'play' && state) {
    if (!network?.playerId && !document.hidden) stepMatch(state, delta);
    if (state.phase === 'finished') finishShift();
    else {
      renderer.draw(state, localId, now / 1000, effects, target);
      if (now - lastHud > 120) { updateHud(); lastHud = now; }
    }
  } else if (view === 'menu' && (!lastMenuPaint || effects && now - lastMenuPaint > 50)) {
    drawMenuArt($('menu-art'), effects ? now / 1000 : 0);
    lastMenuPaint = now;
  }
  requestAnimationFrame(frame);
}

if (managed) showRoom();
else show('menu');
requestAnimationFrame(frame);
