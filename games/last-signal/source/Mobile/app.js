import { ArenaRenderer } from "./render.js";

const $ = (id) => document.getElementById(id);
const room = $("room");
const arena = $("arena");
const status = $("status");
const join = $("join");
const nameInput = $("name");
const joinButton = join.querySelector("button");
const readyButton = $("ready");
const controls = $("controls");
const stick = $("stick");
const thumb = $("stick-thumb");
const look = $("look");
const attack = $("attack");
const guard = $("guard");
const reticle = document.querySelector(".reticle");
const impact = $("impact");
const backdrop = $("drawer-backdrop");
const roster = $("roster");
const key = location.hash.slice(1);
const validKey = /^[a-zA-Z0-9_-]{24}$/.test(key);
const storageKey = "last-signal:seat:" + key;
const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const holdStops = new Set();
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const compressed = typeof DecompressionStream === "function";
const weaponNames = {
  fists: "Unarmed",
  knife: "Knife",
  spear: "Spear",
  sling: "Sling",
  bow: "Field bow",
  hatchet: "Hatchet",
  sword: "Sword",
  crossbow: "Crossbow"
};

let socket;
let renderer;
let phase = "join";
let playerName = "";
let resume = "";
let seat = -1;
let ready = false;
let round = 0;
let worldRound = -1;
let sequence = 0;
let retry = null;
let retryUntil = 0;
let frameAt = 0;
let renderedFrameAt = 0;
let binaryEpoch = 0;
let pendingBinary = [];
let decodingBinary = false;
let frame = null;
let drawer = "";
let tab = "pack";
let drawerKey = "";
let closeFocus = null;
let extra = false;
let yaw = 0;
let pitch = 0;
let right = 0;
let forward = 0;
let sprint = false;
let crouch = false;
let stickPointer = null;
let lookPointer = null;
let lastLook = null;
let actions = [];

try {
  if (validKey) {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    if (/^[a-zA-Z0-9_-]{24}$/.test(saved.resume)) resume = saved.resume;
    nameInput.value = saved.name || "";
  }
} catch {
  // Private browsing can disable storage. In-page reconnection still works.
}

function rememberSeat() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ name: playerName, resume }));
  } catch {}
}

function clearSeat() {
  resume = "";
  seat = -1;
  try { sessionStorage.removeItem(storageKey); } catch {}
}

function setText(element, value) {
  const text = value == null ? "" : String(value);
  if (element.textContent !== text) element.textContent = text;
}

function setStatus(message, error = false) {
  setText(status, message);
  status.dataset.error = String(error);
}

function setMode(next, message, error = false) {
  phase = next;
  if (next !== "playing") {
    closeDrawer(false);
    arena.hidden = true;
    room.hidden = false;
  }
  join.hidden = !validKey || next === "lobby" || next === "playing";
  nameInput.disabled = next === "connecting";
  joinButton.disabled = next === "connecting";
  joinButton.textContent = resume ? "Reconnect" : "Join room";
  $("lobby").hidden = next !== "lobby";
  if (message !== undefined) setStatus(message, error);
}

function socketSend(data) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(data);
  return true;
}

function clearBinary() {
  binaryEpoch++;
  pendingBinary = [];
}

function leave() {
  if (retry !== null) clearTimeout(retry);
  retry = null;
  retryUntil = 0;
  socketSend("LEAVE");
  const previous = socket;
  socket = null;
  previous?.close();
  clearSeat();
  clearBinary();
  resetRound();
  setMode("join", "You left the room.");
}

function fail(message) {
  if (retry !== null) clearTimeout(retry);
  retry = null;
  retryUntil = 0;
  const previous = socket;
  socket = null;
  previous?.close();
  clearSeat();
  clearBinary();
  resetRound();
  setMode("join", message, true);
}

function connectionLost() {
  clearBinary();
  resetRound();
  if (!resume) {
    fail("The host could not be reached. Check the invite and try again.");
    return;
  }
  if (!retryUntil) retryUntil = performance.now() + 14000;
  const remaining = retryUntil - performance.now();
  if (remaining <= 0) {
    fail("Connection lost. Check with the host and join the lobby again.");
    return;
  }
  setMode("connecting", "Reconnecting to your seat…");
  retry = setTimeout(connect, Math.min(1300, remaining));
}

function connect() {
  retry = null;
  setMode("connecting", retryUntil ? "Reconnecting to your seat…" : "Joining room…");
  const endpoint = new URL("/mobile/ws", location.origin);
  endpoint.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  endpoint.hash = "";
  endpoint.search = compressed ? "?gzip=1" : "";
  const client = new WebSocket(endpoint);
  socket = client;
  client.binaryType = "arraybuffer";
  const timeout = setTimeout(() => {
    if (socket === client && phase === "connecting") client.close();
  }, retryUntil ? Math.max(1, Math.min(4000, retryUntil - performance.now())) : 16000);
  client.addEventListener("open", () => {
    if (socket === client) socketSend(["JOIN", "LS2", key, playerName, resume].join("|"));
  });
  client.addEventListener("message", (event) => {
    if (socket !== client) return;
    if (typeof event.data === "string") handleText(event.data);
    else queueBinary(event.data);
  });
  client.addEventListener("close", () => {
    clearTimeout(timeout);
    if (socket !== client) return;
    socket = null;
    connectionLost();
  });
}

function renderRoster(parts) {
  const members = [];
  for (const part of parts) {
    const [index, hint, name] = part.split(",");
    if (hint && name) members.push({ index: Number(index), hint, name });
  }
  const rows = members.map((member) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    const state = document.createElement("span");
    label.textContent = member.name;
    state.textContent = member.hint;
    if (member.hint === "Ready" || member.hint === "Host") state.classList.add("ready-state");
    row.append(label, state);
    return row;
  });
  roster.replaceChildren(...rows);
  setText($("human-count"), members.length + "/8 players");
  setText($("bot-count"), (24 - members.length) + " bots fill the arena.");
  ready = members.find((member) => member.index === seat)?.hint === "Ready";
  readyButton.disabled = false;
  readyButton.setAttribute("aria-pressed", String(ready));
  setText(readyButton, ready ? "Unready" : "Ready");
}

function handleText(text) {
  const [type, ...values] = text.split("|");
  if (type === "ERROR") {
    fail(values[0] || "The room rejected your connection.");
    return;
  }
  if (type === "SEAT") {
    seat = Number(values[0]);
    if (!(seat >= 1 && seat <= 7 && /^[a-zA-Z0-9_-]{24}$/.test(values[1]))) {
      fail("The host returned an invalid seat.");
      return;
    }
    resume = values[1];
    rememberSeat();
    retryUntil = 0;
    sequence = 0;
    return;
  }
  if (seat < 1) return;
  if (type === "LOBBY") {
    if (phase !== "lobby") {
      clearBinary();
      resetRound();
    }
    renderRoster(values);
    setMode("lobby", ready ? "Waiting for the host to start." : "Tap Ready when you’re set.");
  } else if (type === "ROUND") {
    const next = Number(values[0]);
    if (!Number.isInteger(next) || next < 1) return;
    clearBinary();
    resetRound();
    round = next;
    frameAt = performance.now();
    setMode("playing", "Entering the arena…");
  }
}

async function decodePacket(data) {
  let bytes = new Uint8Array(data);
  if (bytes[0] === 31 && bytes[1] === 139) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(decoder.decode(bytes));
}

function queueBinary(data) {
  if (phase !== "playing") return;
  pendingBinary.push({ data, epoch: binaryEpoch });
  if (pendingBinary.length > 4) pendingBinary.splice(1, pendingBinary.length - 3);
  if (!decodingBinary) void drainBinary();
}

async function drainBinary() {
  decodingBinary = true;
  while (pendingBinary.length) {
    const { data, epoch } = pendingBinary.shift();
    try {
      const packet = await decodePacket(data);
      if (epoch === binaryEpoch) handleFrame(packet);
    } catch (error) {
      if (epoch === binaryEpoch) {
        console.error(error);
        fail("The arena view could not load.");
      }
    }
  }
  decodingBinary = false;
}

function resetRound() {
  neutralize(false);
  round = 0;
  worldRound = -1;
  frame = null;
  closeDrawer(false);
  extra = false;
  $("more").setAttribute("aria-expanded", "false");
  renderer?.clearLook();
}

function handleFrame(packet) {
  if (!packet || phase !== "playing" || packet.round !== round) return;
  if (packet.type === "world") {
    renderer.setWorld(packet);
    worldRound = round;
    return;
  }
  if (packet.type !== "frame" || !packet.player || worldRound !== round) return;
  const first = frame === null;
  const wasAlive = frame?.player.alive && !frame.winner;
  frame = packet;
  renderedFrameAt = frameAt = performance.now();
  if (first) {
    yaw = frame.player.yaw;
    pitch = frame.player.pitch;
    arena.hidden = false;
    room.hidden = true;
  }
  if (wasAlive && (!frame.player.alive || frame.winner)) {
    neutralize(false);
    if (drawer !== "menu") closeDrawer();
  }
  if (frame.player.alive && !frame.winner) renderer.setLook(yaw, pitch);
  else renderer.clearLook();
  renderer.setFrame(frame);
  renderHud();
}

function renderHud() {
  const { player, hud, storm } = frame;
  for (const stat of ["health", "stamina", "hunger", "hydration"]) $(stat).value = player[stat];
  setText($("zone"), hud.zone);
  setText($("alive"), frame.alive + " alive");
  arena.dataset.hurt = String(player.hurt > 0.12);
  const outside = storm.active && Math.hypot(frame.camera.x - storm.x, frame.camera.z - storm.z) > storm.radius;
  const stormText = outside ? "Outside the safe zone" : storm.moving ? "Storm moving" :
    storm.warning ? "Storm moves in " + Math.max(0, Math.ceil(storm.seconds)) + "s" : "";
  setText($("storm"), stormText);
  $("storm").dataset.danger = String(outside);
  setText($("event"), hud.event);
  setText($("feed"), hud.feed);
  setText($("notice"), hud.notice);
  const touchHint = (hud.hint || "")
    .replace(/\s*\[[^\]]+\]\s*(?:Next action|Place|Rotate|Cancel)\b/g, "")
    .replace(/\[[^\]]+\]\s*/g, "").trim();
  setText($("hint"), touchHint || hud.buildProblem);
  const crossbow = player.weapon === "crossbow";
  const reload = crossbow ? player.reload || 0 : 0;
  const currentProgress = Math.max(hud.progress || 0, hud.charge || 0, reload);
  $("progress").hidden = currentProgress <= 0;
  $("progress").value = currentProgress;

  const building = Boolean(hud.buildId);
  const playing = player.alive && !frame.winner;
  const countdown = frame.countdown > 0;
  controls.hidden = !playing;
  $("aim").hidden = !playing || countdown || Boolean(drawer);
  $("countdown").hidden = !playing || !countdown;
  setText($("countdown-seconds"), Math.ceil(frame.countdown));
  $("place-tools").hidden = !building;
  $("extra-actions").hidden = !extra || building;
  $("more").disabled = building;
  $("throw").hidden = player.weapon !== "spear";
  $("cycle").hidden = !Array.isArray(hud.focusOptions) || hud.focusOptions.length < 2 || building;
  $("use").hidden = building;
  const ammoId = crossbow ? "bolts" : player.weapon === "bow" ? "arrows" : player.weapon === "sling" ? "stone" : "";
  const ammo = ammoId ? frame.pack.find(([id]) => id === ammoId)?.[2] || 0 : null;
  setText(attack, building ? "Place" : !crossbow ? "Attack" : !player.crossbowLoaded && ammo ? "Loading…" : "Fire");
  attack.disabled = countdown || (building && !frame.ghostFits) || (!building && crossbow && !player.crossbowLoaded && !ammo);
  const ranged = crossbow || player.weapon === "bow" || player.weapon === "sling";
  guard.hidden = building || !(player.shield || ranged || extra);
  setText(guard, player.shield ? "Shield" : ranged ? "Aim" : "Guard");
  guard.setAttribute("aria-pressed", String(player.guard || player.aim || false));
  let gear = "";
  if (reload > 0) gear = reload < 0.22 ? "Lowering crossbow" : reload < 0.54 ? "Cocking string" :
    reload < 0.79 ? "Seating bolt" : "Setting crossbow";
  else if (crossbow && !player.crossbowLoaded && !ammo) gear = "Out of bolts";
  else if (player.shieldRaised) gear = "Shield raised";
  setText($("gear-status"), gear);
  const weapon = weaponNames[player.weapon] || player.weapon;
  setText($("weapon"), (ammo === null ? weapon : weapon + " · " + ammo) + " ↻");
  $("outcome").hidden = playing;
  setText($("outcome-title"), frame.winner && player.alive ? "Last survivor" :
    !player.alive ? "Eliminated" : "");
  setText($("outcome-detail"), frame.winner ? (frame.winner + " won the round.") :
    player.placement ? "Placed #" + player.placement + ". Waiting for a winner." : "Waiting for a winner.");
  renderDrawer();
}

function canPlay() {
  return phase === "playing" && frame?.player.alive && !frame.winner && frame.countdown <= 0 && !drawer;
}

function queue(action) {
  if (phase === "playing" && frame && frame.player.alive && !frame.winner && actions.length < 24) {
    actions.push(action);
  }
}

function sendInput() {
  if (phase !== "playing" || !frame || !frame.player.alive || frame.winner || socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 2048) return;
  const fragments = actions.map((action) => encoder.encode(action));
  const bytes = new Uint8Array(31 + fragments.reduce((size, part) => size + 1 + part.length, 0));
  const header = new DataView(bytes.buffer);
  header.setUint8(0, 1);
  header.setInt32(1, round, true);
  header.setInt32(5, ++sequence, true);
  header.setFloat32(9, right, true);
  header.setFloat32(13, forward, true);
  header.setFloat32(17, 0, true);
  header.setFloat32(21, yaw, true);
  header.setFloat32(25, pitch, true);
  header.setUint8(29, (sprint ? 1 : 0) | (crouch ? 2 : 0));
  header.setUint8(30, fragments.length);
  let offset = 31;
  for (const part of fragments) {
    bytes[offset++] = part.length;
    bytes.set(part, offset);
    offset += part.length;
  }
  if (socketSend(bytes)) actions = [];
}

function neutralize(transmit) {
  const moving = stickPointer;
  const looking = lookPointer;
  stickPointer = lookPointer = null;
  lastLook = null;
  if (moving !== null && stick.hasPointerCapture(moving)) stick.releasePointerCapture(moving);
  if (looking !== null && look.hasPointerCapture(looking)) look.releasePointerCapture(looking);
  for (const stop of holdStops) stop();
  right = forward = 0;
  sprint = crouch = false;
  $("sprint").setAttribute("aria-pressed", "false");
  $("crouch").setAttribute("aria-pressed", "false");
  thumb.style.transform = "";
  actions = [];
  if (transmit) {
    queue("unfocus");
    sendInput();
  }
}

function stickMove(event) {
  const bounds = stick.getBoundingClientRect();
  const radius = bounds.width * 0.31;
  const x = (event.clientX - bounds.left - bounds.width / 2) / radius;
  const y = (event.clientY - bounds.top - bounds.height / 2) / radius;
  const scale = Math.max(1, Math.hypot(x, y));
  right = x / scale;
  forward = -y / scale;
  if (Math.hypot(right, forward) < 0.09) right = forward = 0;
  thumb.style.transform = "translate(" + (right * radius) + "px," + (-forward * radius) + "px)";
}

stick.addEventListener("pointerdown", (event) => {
  if (!canPlay() || stickPointer !== null || event.button !== 0) return;
  stickPointer = event.pointerId;
  stick.setPointerCapture(stickPointer);
  stickMove(event);
});
stick.addEventListener("pointermove", (event) => {
  if (event.pointerId === stickPointer) stickMove(event);
});
function releaseStick(event) {
  if (event.pointerId !== stickPointer) return;
  stickPointer = null;
  right = forward = 0;
  thumb.style.transform = "";
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) stick.addEventListener(type, releaseStick);

look.addEventListener("pointerdown", (event) => {
  if (!canPlay() || lookPointer !== null || event.button !== 0) return;
  lookPointer = event.pointerId;
  look.setPointerCapture(lookPointer);
  lastLook = [event.clientX, event.clientY];
});
look.addEventListener("pointermove", (event) => {
  if (event.pointerId !== lookPointer) return;
  const sensitivity = frame.player.aim ? 0.0047 : 0.0069;
  const nextYaw = yaw + (event.clientX - lastLook[0]) * sensitivity;
  yaw = Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw));
  pitch = Math.max(-1.46, Math.min(1.46, pitch - (event.clientY - lastLook[1]) * sensitivity));
  lastLook = [event.clientX, event.clientY];
  renderer.setLook(yaw, pitch);
});
function releaseLook(event) {
  if (event.pointerId !== lookPointer) return;
  lookPointer = null;
  lastLook = null;
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) look.addEventListener(type, releaseLook);

function bindHold(button, command) {
  let pointer = null;
  let held = "";
  const clear = () => {
    const released = pointer;
    pointer = null;
    held = "";
    button.removeAttribute("data-held");
    if (released !== null && button.hasPointerCapture(released)) button.releasePointerCapture(released);
  };
  holdStops.add(clear);
  button.addEventListener("pointerdown", (event) => {
    if (!canPlay() || button.disabled || pointer !== null || event.button !== 0) return;
    const action = command();
    if (!action) return;
    pointer = event.pointerId;
    button.setPointerCapture(pointer);
    if (action.startsWith("+")) {
      held = action.slice(1);
      button.dataset.held = "true";
    }
    queue(action);
  });
  function release(event) {
    if (event.pointerId !== pointer) return;
    if (held) queue(event.type === "pointerup" ? "-" + held : "unfocus");
    clear();
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, release);
  button.addEventListener("click", (event) => {
    if (event.detail === 0 && !event.pointerType && canPlay()) {
      const action = command();
      if (!action) return;
      queue(action);
      if (action.startsWith("+")) queue("-" + action.slice(1));
    }
  });
}
bindHold(attack, () => {
  if (frame.hud.buildId) return "place";
  return frame.player.weapon === "crossbow" && !frame.player.crossbowLoaded ? "" : "+Attack";
});
for (const button of document.querySelectorAll("[data-hold]")) bindHold(button, () => "+" + button.dataset.hold);

controls.addEventListener("click", (event) => {
  const command = event.target.closest("[data-command]")?.dataset.command;
  if (command && canPlay()) queue(command);
});

$("sprint").addEventListener("click", () => {
  if (!canPlay()) return;
  sprint = !sprint;
  if (sprint) crouch = false;
  $("sprint").setAttribute("aria-pressed", String(sprint));
  $("crouch").setAttribute("aria-pressed", String(crouch));
});
$("crouch").addEventListener("click", () => {
  if (!canPlay()) return;
  crouch = !crouch;
  if (crouch) sprint = false;
  $("sprint").setAttribute("aria-pressed", String(sprint));
  $("crouch").setAttribute("aria-pressed", String(crouch));
});
$("more").addEventListener("click", () => {
  extra = !extra;
  $("extra-actions").hidden = !extra;
  $("more").setAttribute("aria-expanded", String(extra));
  if (frame) renderHud();
});

function openDrawer(section, trigger) {
  if (drawer) return;
  neutralize(true);
  drawer = section;
  closeFocus = trigger;
  backdrop.hidden = false;
  setText($("drawer-title"), section === "menu" ? "Room menu" : "Gear");
  $("gear-tabs").hidden = section === "menu";
  $("gear-list").hidden = section === "menu";
  $("menu-actions").hidden = section !== "menu";
  $("aim").hidden = true;
  $("drawer-close").focus();
  renderDrawer();
}

function closeDrawer(restoreFocus = true) {
  if (!drawer) return;
  backdrop.hidden = true;
  drawer = "";
  drawerKey = "";
  if (frame) $("aim").hidden = !frame.player.alive || Boolean(frame.winner) || frame.countdown > 0;
  if (restoreFocus && closeFocus) closeFocus.focus();
  closeFocus = null;
}

function gearAction(text, action, available = true) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.disabled = !available;
  button.addEventListener("click", () => {
    queue(action);
    closeDrawer();
  });
  return button;
}

function gearRow(title, description) {
  const row = document.createElement("div");
  row.className = "gear-item";
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  copy.append(heading);
  if (description) {
    const detail = document.createElement("small");
    detail.textContent = description;
    copy.append(detail);
  }
  row.append(copy);
  return row;
}

function packRow([id, name, count], player, usable) {
  const selected = id === player.weapon;
  const water = id === "waterskin" ? Math.floor(player.water || 0) + " water" : "";
  const detail = id === "shield" ? (player.shield ? "Off hand · hold Shield to raise" : "Off hand · equip a sword or spear") : "";
  const row = gearRow(name + (count > 1 ? " ×" + count : ""), water || detail || (selected ? "Equipped" : ""));
  let action = "";
  if (id in weaponNames && id !== "fists" && !selected) action = "Equip";
  if (id === "bandage") action = "Apply";
  if (id === "meal") action = "Eat";
  if (id === "firekit") action = "Place";
  if (id === "waterskin" && player.water > 0.5) action = "Drink";
  if (id === "woven_vest" || id === "scrap_cuirass") action = id === player.armor ? "Remove" : "Wear";
  if (action) row.append(gearAction(action, "pack:" + id, usable));
  const drop = gearAction("Drop", "drop:" + id, usable);
  drop.classList.add("drop");
  drop.setAttribute("aria-label", "Drop one " + name);
  row.append(drop);
  return row;
}

function renderDrawer() {
  if (drawer !== "gear" || !frame) return;
  const guide = tab === "pack" ? [frame.player.weapon, frame.player.armor, frame.player.shield, Math.floor(frame.player.water || 0)] : [];
  const usable = frame.countdown <= 0;
  const entries = frame[tab];
  const refresh = JSON.stringify([tab, usable, guide, entries]);
  if (drawerKey === refresh) return;
  drawerKey = refresh;
  const list = $("gear-list");
  const scroll = list.scrollTop;
  const rows = entries.map((entry) => {
    if (tab === "pack") return packRow(entry, frame.player, usable);
    const [id, name, cost, available] = entry;
    const row = gearRow(name, cost);
    row.classList.add("gear-item--recipe");
    row.append(gearAction(tab === "craft" ? "Make" : "Select", tab + ":" + id, usable && available));
    return row;
  });
  if (tab === "pack" && frame.player.weapon !== "fists") {
    const fists = gearRow("Unarmed");
    fists.append(gearAction("Equip", "equip:fists", usable));
    rows.unshift(fists);
  }
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = "Your pack is empty.";
    rows.push(empty);
  }
  list.replaceChildren(...rows);
  list.scrollTop = scroll;
}

$("gear-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  tab = button.dataset.section;
  $("gear-list").scrollTop = 0;
  for (const item of $("gear-tabs").children) item.setAttribute("aria-pressed", String(item === button));
  renderDrawer();
});

join.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validKey || phase !== "join") return;
  try {
    renderer ||= new ArenaRenderer($("view"));
  } catch (error) {
    console.error(error);
    setStatus("This browser couldn’t start the 3D arena. Try an updated browser.", true);
    return;
  }
  playerName = nameInput.value.replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 20) || "Contestant";
  nameInput.value = playerName;
  connect();
});

readyButton.addEventListener("click", () => {
  if (socketSend(ready ? "READY|0" : "READY|1")) readyButton.disabled = true;
});
$("lobby-leave").addEventListener("click", leave);
$("menu").addEventListener("click", (event) => openDrawer("menu", event.currentTarget));
$("pack").addEventListener("click", (event) => openDrawer("gear", event.currentTarget));
$("drawer-close").addEventListener("click", () => closeDrawer());
$("leave").addEventListener("click", leave);
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeDrawer(); });
window.addEventListener("contextmenu", (event) => { if (arena.contains(event.target)) event.preventDefault(); });
window.addEventListener("blur", () => neutralize(true));
window.addEventListener("orientationchange", () => neutralize(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) neutralize(true); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer) closeDrawer();
  if (event.key !== "Tab" || !drawer) return;
  const focusable = [...$("drawer").querySelectorAll("button:not(:disabled)")].filter((button) => button.getClientRects().length);
  const next = event.shiftKey ? focusable.at(-1) : focusable[0];
  const end = event.shiftKey ? focusable[0] : focusable.at(-1);
  if (document.activeElement === end && next) {
    event.preventDefault();
    next.focus();
  }
});

setInterval(() => {
  if (phase === "playing" && performance.now() - frameAt > 12000) socket?.close();
  else sendInput();
}, 40);

function draw(now) {
  if (!arena.hidden && frame) {
    const heading = frame.player.alive && !frame.winner ? yaw : frame.camera.yaw;
    const elapsed = (now - renderedFrameAt) / 1000;
    const incoming = Math.max(0, (frame.hud.impact || 0) - elapsed);
    impact.hidden = !incoming || Boolean(drawer);
    if (incoming) {
      const angle = frame.hud.impactAngle - heading;
      impact.style.transform = "translate(-50%,-50%) rotate(" + angle + "rad)";
      impact.style.opacity = String(Math.min(1, incoming / 0.36) * (frame.hud.impactStrength || 0.55));
    }
    const hit = (frame.hud.confirmed || 0) > elapsed;
    if (reticle && reticle.dataset.hit !== String(hit)) reticle.dataset.hit = String(hit);
    setText($("compass"), directions[((Math.round(heading * 4 / Math.PI) % 8) + 8) % 8]);
    renderer.render(now);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
setMode("join", validKey ? "Join the host’s arena." : "Open the full phone invite from the host.", !validKey);
