import { ArenaRenderer } from "./render.js";

const $ = (id) => document.getElementById(id);
const room = $("room");
const arena = $("arena");
const status = $("status");
const join = $("join");
const nameInput = $("name");
const joinButton = join.querySelector("button");
const readyButton = $("ready");
const startButton = $("managed-start");
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
const soloMode = !validKey && new URLSearchParams(location.search).get("mode") === "solo";
const storageKey = "last-signal:seat:" + key;
const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const holdStops = new Set();
const mouseLayout = matchMedia("(hover: hover) and (pointer: fine)");
const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyZ", "KeyX"]);
const desktopActions = {
  Space: "+Jump", KeyE: "+Use", KeyQ: "+Dodge", KeyV: "+Shove", KeyF: "cycle:1",
  KeyR: "rotate:1", KeyH: "+Dismiss", BracketLeft: "weapon:-1", BracketRight: "weapon:1", Backspace: "cancel"
};
const desktopGearTabs = { KeyI: "pack", KeyC: "craft", KeyB: "build" };
const desktopKeys = new Set();
const mouseActions = new Map();
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
const materialInfo = {
  branch: ["Wood", "Chop a tree with a hatchet or check supply caches."],
  fiber: ["Fiber", "Gather plants or harvest a tree by hand."],
  stone: ["Stone", "Mine rock with a hatchet or check supply caches."],
  scrap: ["Scrap", "Search supply chests and abandoned packs."],
  cloth: ["Cloth", "Search supply chests and abandoned packs."],
  tinder: ["Tinder", "Gather dry plants or check supply caches."]
};
const recipeGroups = {
  craft: { essentials: ["Essentials", ["fire", "firekit", "bandage", "waterskin", "hatchet"]],
    gear: ["Weapons & Armor", ["sling", "spear", "bow", "sword", "shield", "woven_vest", "scrap_cuirass"]],
    ammo: ["Ammo", ["arrows", "bolts"]] },
  build: { cover: ["Cover", ["barricade", "wall", "gate"]], camp: ["Camp", ["lean_to", "fire", "rain_barrel"]],
    levels: ["Levels", ["ramp", "floor"]], blueprints: ["Blueprints", []] }
};
const gearSymbols = {
  spear: "↑", knife: "†", sword: "†", bow: ")", crossbow: "⋈", sling: "⌁", hatchet: "⚒",
  arrows: "➶", bolts: "➳", shield: "⬟", woven_vest: "▧", scrap_cuirass: "▩",
  bandage: "+", meal: "◒", meat: "◒", waterskin: "♦", fire: "♨", firekit: "♨",
  barricade: "≋", wall: "▥", gate: "⊓", lean_to: "◩", ramp: "◢", rain_barrel: "⊙", floor: "▰", blueprint: "▤"
};

let socket;
let solo;
let soloFrameAt = 0;
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
let workAudio;
let woodSample;
let sampleLoading = false;
let lastWorkSoundAt = -Infinity;
let binaryEpoch = 0;
let pendingBinary = [];
let decodingBinary = false;
let frame = null;
let drawer = "";
let tab = "pack";
let drawerKey = "";
let readyOnly = false;
let materialFilter = "";
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
let mouseLocked = false;
let desktopThrow = false;
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
  $("managed-rooms").hidden = next !== "join";
  join.hidden = (!validKey && !soloMode) || next === "lobby" || next === "playing";
  nameInput.disabled = next === "connecting";
  joinButton.disabled = next === "connecting";
  joinButton.textContent = soloMode ? "Start solo match" : resume ? "Reconnect" : "Join room";
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
  if (soloMode) {
    solo = null;
    resetRound();
    setMode("join", "Play a new match against 23 bots.");
    return;
  }
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

async function startSolo() {
  setMode("connecting", "Loading the solo arena…");
  $("replay").disabled = true;
  solo = null;
  resetRound();
  try {
    const { SoloArena } = await import("./solo.js");
    round = 1;
    solo = new SoloArena({ name: playerName, round, arena: Number($("solo-map").value),
      difficulty: Number($("solo-difficulty")?.value ?? 1) });
    soloFrameAt = performance.now();
    setMode("playing");
    handleFrame(solo.world);
    handleFrame(solo.frame());
  } catch (error) {
    console.error(error);
    solo = null;
    resetRound();
    setMode("join", "The solo arena could not load. Try starting a new match.", true);
  } finally {
    $("replay").disabled = false;
  }
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
  const role = members.find((member) => member.index === seat)?.hint;
  startButton.hidden = role !== "Captain";
  readyButton.hidden = role === "Captain";
  ready = role === "Ready";
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
    if (!(Number.isInteger(seat) && seat >= 0 && seat <= 7 && /^[a-zA-Z0-9_-]{24}$/.test(values[1]))) {
      fail("The host returned an invalid seat.");
      return;
    }
    resume = values[1];
    rememberSeat();
    retryUntil = 0;
    sequence = 0;
    return;
  }
  if (seat < 0) return;
  if (type === "LOBBY") {
    if (phase !== "lobby") {
      clearBinary();
      resetRound();
    }
    renderRoster(values);
    setMode("lobby", !startButton.hidden ? "Start the match when your group is ready." : ready ? "Waiting for the host to start." : "Choose Ready when you’re set.");
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

function enableWorkAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    workAudio ||= new Audio();
    if (workAudio.state !== "running") void workAudio.resume().catch(() => {});
    if (woodSample || sampleLoading) return;
    sampleLoading = true;
    const clip = soloMode ? "../../browser-assets/wood.wav" : "./assets/Audio/wood.wav";
    fetch(new URL(clip, import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error("Wood audio unavailable");
        return response.arrayBuffer();
      })
      .then(bytes => workAudio.decodeAudioData(bytes))
      .then(sample => { woodSample = sample; })
      .catch(() => {})
      .finally(() => { sampleLoading = false; });
  } catch { /* Audio may be disabled by the browser. */ }
}

function playWorkSound(cue) {
  if (!cue || !Number.isFinite(cue.at) || cue.at <= lastWorkSoundAt) return;
  lastWorkSoundAt = cue.at;
  if (!woodSample || workAudio?.state !== "running" || document.hidden) return;
  const gain = workAudio.createGain();
  gain.gain.value = 0.7 * Math.max(0, Math.min(1, cue.volume));
  const source = workAudio.createBufferSource();
  source.buffer = woodSample;
  source.playbackRate.value = cue.kind === "build" ? 0.78 : 1;
  source.connect(gain);
  if (workAudio.createStereoPanner) {
    const position = workAudio.createStereoPanner();
    position.pan.value = Math.max(-1, Math.min(1, cue.pan));
    gain.connect(position).connect(workAudio.destination);
  } else gain.connect(workAudio.destination);
  source.start();
}

function resetRound() {
  neutralize(false);
  lastWorkSoundAt = -Infinity;
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
  playWorkSound(frame.workSound);
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

function shieldCondition(player) {
  const max = Number(player.shieldMaxHealth);
  if (!(max > 0)) return null;
  return { max: Math.ceil(max), current: Math.max(0, Math.min(Math.ceil(max), Math.ceil(Number(player.shieldHealth) || 0))) };
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
  const showKeyHints = mouseLayout.matches && arena.dataset.input !== "touch";
  const repairInfo = hud.repair;
  const repairHint = repairInfo && (repairInfo.enabled ? (showKeyHints ? "[Y] Repair" : "Repair") +
    (repairInfo.target ? " " + repairInfo.target : "") : repairInfo.reason);
  const fort = frame.fortGuide;
  setText($("hint"), hud.buildProblem || fort?.error || (showKeyHints ? hud.hint : touchHint) || repairHint || "");
  const copies = fort?.copies ?? frame.build.find(([id]) => id === hud.buildId)?.[4]?.copies;
  const template = hud.buildId?.startsWith("blueprint_");
  const fortNotes = fort ? [
    template ? fort.placed + "/" + fort.total + " placed" : Number.isFinite(copies) ? copies + " affordable" : "",
    fort.support ? "Support highlighted" : "",
    fort.ramp ? "Arrow shows uphill" : ""
  ].filter(Boolean) : [];
  $("fort-guide").hidden = !fortNotes.length;
  setText($("fort-guide"), fortNotes.join(" · "));
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
  $("rotate-build").disabled = Boolean(fort?.anchored);
  $("extra-actions").hidden = !extra || building;
  $("more").disabled = building;
  $("throw").hidden = player.weapon !== "spear";
  $("cycle").hidden = !Array.isArray(hud.focusOptions) || hud.focusOptions.length < 2 || building;
  $("use").hidden = building || hud.useAction === "repair";
  const repair = $("repair");
  repair.hidden = building || !repairInfo || repairInfo.reason === "At full health";
  repair.disabled = countdown || !repairInfo?.enabled || Boolean(repairInfo?.active);
  setText(repair, repairInfo?.active ? "Repairing" : "Repair");
  repair.title = repairInfo?.reason || (repairInfo?.woodNeeded ? repairInfo.woodNeeded + " wood" : "Repair structure");
  const ammoId = crossbow ? "bolts" : player.weapon === "bow" ? "arrows" : player.weapon === "sling" ? "stone" : "";
  const ammo = ammoId ? frame.pack.find(([id]) => id === ammoId)?.[2] || 0 : null;
  setText(attack, building ? "Place" : !crossbow ? "Attack" : !player.crossbowLoaded && ammo ? "Loading…" : "Fire");
  attack.disabled = countdown || (building && !frame.ghostFits) || (!building && crossbow && !player.crossbowLoaded && !ammo);
  const ranged = crossbow || player.weapon === "bow" || player.weapon === "sling";
  const shield = shieldCondition(player);
  guard.hidden = building || !(player.shield || ranged || extra);
  const guardLabel = player.shield ? "Shield" : ranged ? "Aim" : "Guard";
  setText(guard, player.shield && shield ? "Shield " + shield.current : guardLabel);
  guard.setAttribute("aria-label", player.shield && shield ? "Hold to raise shield. Durability " + shield.current + " of " + shield.max : guardLabel);
  guard.dataset.worn = String(Boolean(player.shield && shield && shield.current <= shield.max / 3));
  guard.setAttribute("aria-pressed", String(player.guard || player.aim || false));
  let gear = "";
  if (reload > 0) gear = reload < 0.22 ? "Lowering crossbow" : reload < 0.54 ? "Cocking string" :
    reload < 0.79 ? "Seating bolt" : "Setting crossbow";
  else if (crossbow && !player.crossbowLoaded && !ammo) gear = "Out of bolts";
  else if (player.shieldRaised) gear = shield ? "Shield raised · " + shield.current + "/" + shield.max : "Shield raised";
  else if (player.shield && shield) gear = "Shield " + shield.current + "/" + shield.max;
  setText($("gear-status"), gear);
  const weapon = weaponNames[player.weapon] || player.weapon;
  setText($("weapon"), (ammo === null ? weapon : weapon + " · " + ammo) + " ↻");
  $("outcome").hidden = playing;
  setText($("outcome-title"), frame.winner && player.alive ? "Last survivor" :
    !player.alive ? "Eliminated" : "");
  setText($("outcome-detail"), frame.winner ? (frame.winner + " won the round.") :
    soloMode ? "Placed #" + player.placement + " of 24." :
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
  if (phase !== "playing" || !frame || !frame.player.alive || frame.winner) return;
  if (!solo && (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 2048)) return;
  const keyRight = Number(desktopKeys.has("KeyD")) - Number(desktopKeys.has("KeyA"));
  const keyForward = Number(desktopKeys.has("KeyW")) - Number(desktopKeys.has("KeyS"));
  const keyScale = Math.max(1, Math.hypot(keyRight, keyForward));
  const moveRight = stickPointer === null ? keyRight / keyScale : right;
  const moveForward = stickPointer === null ? keyForward / keyScale : forward;
  const lean = Number(desktopKeys.has("KeyX")) - Number(desktopKeys.has("KeyZ"));
  const running = sprint || desktopKeys.has("ShiftLeft") || desktopKeys.has("ShiftRight");
  const crouching = crouch || desktopKeys.has("ControlLeft") || desktopKeys.has("ControlRight");
  if (solo) {
    solo.setInput({ right: moveRight, forward: moveForward, lean, yaw, pitch, sprint: running, crouch: crouching, actions });
    actions = [];
    return;
  }
  const fragments = actions.map((action) => encoder.encode(action));
  const bytes = new Uint8Array(31 + fragments.reduce((size, part) => size + 1 + part.length, 0));
  const header = new DataView(bytes.buffer);
  header.setUint8(0, 1);
  header.setInt32(1, round, true);
  header.setInt32(5, ++sequence, true);
  header.setFloat32(9, moveRight, true);
  header.setFloat32(13, moveForward, true);
  header.setFloat32(17, lean, true);
  header.setFloat32(21, yaw, true);
  header.setFloat32(25, pitch, true);
  header.setUint8(29, (running ? 1 : 0) | (crouching ? 2 : 0));
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
  desktopKeys.clear();
  mouseActions.clear();
  desktopThrow = false;
  if (document.pointerLockElement === look) {
    mouseLocked = false;
    document.exitPointerLock();
  }
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

function updateLook(dx, dy) {
  const sensitivity = frame.player.aim ? 0.0047 : 0.0069;
  const nextYaw = yaw + dx * sensitivity;
  yaw = Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw));
  pitch = Math.max(-1.46, Math.min(1.46, pitch - dy * sensitivity));
  renderer.setLook(yaw, pitch);
}

look.addEventListener("pointerdown", (event) => {
  if (!canPlay() || document.pointerLockElement === look || lookPointer !== null || event.button !== 0) return;
  if (event.pointerType === "mouse" && look.requestPointerLock) {
    try { Promise.resolve(look.requestPointerLock()).catch(() => {}); } catch {}
  }
  lookPointer = event.pointerId;
  look.setPointerCapture(lookPointer);
  lastLook = [event.clientX, event.clientY];
});
look.addEventListener("pointermove", (event) => {
  if (event.pointerId !== lookPointer || document.pointerLockElement === look) return;
  updateLook(event.clientX - lastLook[0], event.clientY - lastLook[1]);
  lastLook = [event.clientX, event.clientY];
});
function releaseLook(event) {
  if (event.pointerId !== lookPointer) return;
  lookPointer = null;
  lastLook = null;
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) look.addEventListener(type, releaseLook);
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === look) {
    mouseLocked = true;
    const id = lookPointer;
    lookPointer = null;
    lastLook = null;
    if (id !== null && look.hasPointerCapture(id)) look.releasePointerCapture(id);
  } else if (mouseLocked) {
    mouseLocked = false;
    neutralize(true);
  }
});
document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === look && canPlay()) updateLook(event.movementX, event.movementY);
});
look.addEventListener("mousedown", (event) => {
  if (document.pointerLockElement !== look || !canPlay() || mouseActions.has(event.button)) return;
  const action = event.button === 0 ? attackCommand(event.shiftKey) :
    event.button === 2 && !frame.hud.buildId ? "+Guard" : "";
  if (action.startsWith("+")) mouseActions.set(event.button, action.slice(1));
  if (action) queue(action);
});
document.addEventListener("mouseup", (event) => {
  const action = mouseActions.get(event.button);
  if (action) {
    mouseActions.delete(event.button);
    queue("-" + action);
  }
});
look.addEventListener("wheel", (event) => {
  if (document.pointerLockElement !== look || !canPlay() || !event.deltaY) return;
  event.preventDefault();
  queue(event.deltaY > 0 ? "weapon:1" : "weapon:-1");
}, { passive: false });

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
function attackCommand(repeat = false) {
  if (attack.disabled) return "";
  if (frame.hud.buildId) return repeat ? "repeat" : "place";
  return frame.player.weapon === "crossbow" && !frame.player.crossbowLoaded ? "" : "+Attack";
}
bindHold(attack, attackCommand);
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

function openDrawer(section, trigger, gearTab = "pack") {
  if (drawer) return;
  neutralize(true);
  drawer = section;
  if (section === "gear") {
    tab = gearTab;
    materialFilter = "";
    $("gear-list").scrollTop = 0;
  }
  closeFocus = trigger;
  backdrop.hidden = false;
  setText($("drawer-title"), section === "menu" ? "Room menu" : "Pack");
  $("gear-tabs").hidden = section === "menu";
  $("gear-options").hidden = true;
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

function gearAction(text, action, available = true, keepOpen = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.disabled = !available;
  button.dataset.gearKey = action;
  button.addEventListener("click", () => {
    queue(action);
    if (keepOpen) sendInput();
    else closeDrawer();
  });
  return button;
}

function gearIcon(id) {
  const icon = document.createElement("span");
  icon.className = "gear-icon";
  icon.setAttribute("aria-hidden", "true");
  if (materialInfo[id]) icon.dataset.material = id;
  else icon.dataset.symbol = gearSymbols[id] || (id.startsWith("blueprint_") ? gearSymbols.blueprint : "·");
  return icon;
}

function gearRow(id, title, description) {
  const row = document.createElement("div");
  row.className = "gear-item";
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  copy.append(heading);
  if (description) addRecipeNote(copy, description);
  const actions = document.createElement("div");
  actions.className = "gear-item-actions";
  row.append(gearIcon(id), copy, actions);
  return { row, copy, actions };
}

function addRecipeNote(parent, text) {
  const detail = document.createElement("small");
  detail.textContent = text;
  parent.append(detail);
  return detail;
}

function packRow([id, name, count], player, usable) {
  const selected = id === player.weapon;
  const water = id === "waterskin" ? Math.floor(player.water || 0) + " water" : "";
  const shield = id === "shield" ? shieldCondition(player) : null;
  const shieldHint = id === "shield" ? (player.shield ? "Hold Shield to raise" : "Equip a sword or spear") : "";
  const detail = [shield ? "Durability " + shield.current + "/" + shield.max : "", shieldHint].filter(Boolean).join(" · ");
  const { row, copy, actions } = gearRow(id, name + (count > 1 ? " ×" + count : ""), water || detail || (selected ? "Equipped" : ""));
  if (shield) {
    const meter = document.createElement("progress");
    meter.className = "gear-shield-meter";
    meter.max = shield.max;
    meter.value = shield.current;
    meter.setAttribute("aria-label", "Shield durability");
    copy.append(meter);
  }
  let action = "";
  if (id in weaponNames && id !== "fists" && !selected) action = "Equip";
  if (id === "bandage") action = "Apply";
  if (id === "meal") action = "Eat";
  if (id === "firekit") action = "Place";
  if (id === "waterskin" && player.water > 0.5) action = "Drink";
  if (id === "woven_vest" || id === "scrap_cuirass") action = id === player.armor ? "Remove" : "Wear";
  if (action) actions.append(gearAction(action, "pack:" + id, usable));
  const drop = gearAction("Drop", "drop:" + id, usable, true);
  drop.classList.add("drop");
  drop.setAttribute("aria-label", "Drop one " + name);
  actions.append(drop);
  return row;
}

function gearGroup(title, rows) {
  const group = document.createElement("div");
  group.className = "gear-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.append(heading, ...rows);
  return group;
}

function recipeInfo(entry, section) {
  const [id, name, cost, affordable, details = {}] = entry;
  const groups = recipeGroups[section];
  const category = id.startsWith("blueprint_") ? "blueprints" :
    Object.entries(groups).find(([, [title, ids]]) => title === details.category || ids.includes(id))?.[0] ||
    (Object.hasOwn(groups, details.category) ? details.category : Object.keys(groups)[0]);
  return { ...details, id, name, cost, affordable, category, needs: details.needs || [] };
}

function materialName(id) {
  return materialInfo[id]?.[0] || id.replaceAll("_", " ");
}

function selectGearTab(section, keepMaterial = false) {
  tab = section;
  if (!keepMaterial) materialFilter = "";
  $("gear-list").scrollTop = 0;
  renderDrawer();
}

function showMaterial(id) {
  if (!materialInfo[id]) return;
  materialFilter = id;
  selectGearTab("pack", true);
  $("material-back")?.focus();
}

function ingredientChips(recipe, section) {
  const row = document.createElement("div");
  row.className = "gear-needs";
  for (const need of recipe.needs) {
    const name = need.name || materialName(need.id);
    const inspectable = Boolean(materialInfo[need.id]);
    const chip = document.createElement(inspectable ? "button" : "span");
    chip.className = "gear-need";
    chip.dataset.missing = String(need.held < need.required);
    const tally = document.createElement("b");
    tally.textContent = need.held + "/" + need.required;
    chip.append(gearIcon(need.id), name, tally);
    if (inspectable) {
      chip.type = "button";
      chip.dataset.gearKey = section + ":" + recipe.id + ":material:" + need.id;
      chip.setAttribute("aria-label", name + ": have " + need.held + " of " + need.required + ". View uses.");
      chip.title = need.source || materialInfo[need.id][1];
      chip.addEventListener("click", () => showMaterial(need.id));
    }
    row.append(chip);
  }
  return row;
}

function recipeRow(recipe, section, usable) {
  const { id, name, description, needs } = recipe;
  const building = section === "build";
  const batch = !building && recipe.category === "ammo" && recipe.yield > 1;
  const { row, copy, actions } = gearRow(id, name, description);
  row.classList.add("gear-item--recipe");
  row.dataset.ready = String(recipe.affordable);
  if (needs.length) {
    copy.append(ingredientChips(recipe, section));
    const missing = needs.filter(need => need.required > need.held);
    if (missing.length) {
      const quantities = missing.map(need => (need.required - need.held) + " " + (need.name || materialName(need.id)).toLowerCase());
      const summary = addRecipeNote(copy, "Need " + quantities.join(", ") + (recipe.blueprint ? " for the full blueprint" : ""));
      summary.dataset.missing = "true";
      for (const need of missing) {
        const source = need.source || materialInfo[need.id]?.[1];
        if (source) addRecipeNote(copy, (need.name || materialName(need.id)) + " · " + source);
      }
    }
  } else if (recipe.cost) {
    addRecipeNote(copy, recipe.cost);
  }
  if (building && Number.isFinite(recipe.copies)) {
    addRecipeNote(copy, "Can afford " + recipe.copies).className = "gear-count";
  }
  if (recipe.kit) addRecipeNote(copy, "Uses a Campfire Kit from your pack.");
  const action = building ? recipe.saved ? "Resume" : recipe.blueprint ? "Preview" : "Select" : batch ? "Make " + recipe.yield : "Make";
  actions.append(gearAction(action, section + ":" + id, usable && (recipe.affordable || Boolean(recipe.blueprint)), !building));
  if (recipe.saved && recipe.blueprint) {
    const reset = gearAction("Start over", "abandon-blueprint:" + id, usable, true);
    reset.title = "Forget this plan and leave the pieces already built.";
    actions.append(reset);
  }
  if (batch) {
    const multiple = gearAction("Make " + recipe.yield * 3, section + ":" + id + ":3", usable && recipe.copies >= 3, true);
    if (recipe.copies < 3) multiple.title = "Requires materials for three batches";
    actions.append(multiple);
  }
  return row;
}

function materialUses(id, usable) {
  const detail = document.createElement("div");
  detail.className = "gear-detail";
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  const [name, source] = materialInfo[id];
  const held = frame.pack.find(([item]) => item === id)?.[2] || 0;
  title.textContent = name + " · " + held + " in pack";
  copy.append(title);
  addRecipeNote(copy, source);
  const back = document.createElement("button");
  back.type = "button";
  back.id = "material-back";
  back.textContent = "All pack items";
  back.addEventListener("click", () => {
    selectGearTab("pack");
    $("gear-list").querySelector('[data-gear-key="material:' + id + '"]')?.focus();
  });
  detail.append(copy, back);
  if (held > 0) detail.append(gearAction("Drop one", "drop:" + id, usable, true));
  const groups = [detail];
  for (const section of ["craft", "build"]) {
    const recipes = frame[section].map(entry => recipeInfo(entry, section)).filter(recipe => recipe.needs.some(need => need.id === id));
    if (recipes.length) groups.push(gearGroup(section === "craft" ? "Craft with " + name : "Build with " + name,
      recipes.map(recipe => recipeRow(recipe, section, usable))));
  }
  return groups;
}

function packContents(usable) {
  if (materialFilter) return materialUses(materialFilter, usable);
  const strip = document.createElement("div");
  strip.className = "gear-materials";
  for (const [id, [name, source]] of Object.entries(materialInfo)) {
    const held = frame.pack.find(([item]) => item === id)?.[2] || 0;
    const material = document.createElement("button");
    material.type = "button";
    material.title = source;
    material.dataset.gearKey = "material:" + id;
    material.append(gearIcon(id), name + " " + held);
    material.addEventListener("click", () => showMaterial(id));
    strip.append(material);
  }
  const rows = frame.pack.filter(([id]) => !materialInfo[id]).map(entry => packRow(entry, frame.player, usable));
  if (frame.player.weapon !== "fists") {
    const { row, actions } = gearRow("fists", "Unarmed");
    actions.append(gearAction("Equip", "equip:fists", usable));
    rows.unshift(row);
  }
  return [gearGroup("Materials", [strip]), ...(rows.length ? [gearGroup("Equipment and supplies", rows)] : [])];
}

function recipeContents(usable) {
  const recipes = frame[tab].map(entry => recipeInfo(entry, tab)).filter(recipe =>
    (!readyOnly || recipe.affordable) && (!materialFilter || recipe.needs.some(need => need.id === materialFilter)));
  return Object.entries(recipeGroups[tab]).flatMap(([category, [title]]) => {
    const rows = recipes.filter(recipe => recipe.category === category).map(recipe => recipeRow(recipe, tab, usable));
    return rows.length ? [gearGroup(title, rows)] : [];
  });
}

function renderDrawer() {
  if (drawer !== "gear" || !frame) return;
  const guide = tab === "pack" ? [frame.player.weapon, frame.player.armor, frame.player.shield,
    Math.floor(frame.player.water || 0), shieldCondition(frame.player)] : [];
  const usable = frame.countdown <= 0;
  const entries = tab === "pack" && materialFilter ? [frame.pack, frame.craft, frame.build] : frame[tab];
  const refresh = JSON.stringify([tab, usable, guide, entries, readyOnly, materialFilter]);
  if (drawerKey === refresh) return;
  drawerKey = refresh;
  setText($("drawer-title"), tab === "pack" ? "Pack" : tab === "craft" ? "Craft" : "Build");
  for (const item of $("gear-tabs").children) item.setAttribute("aria-pressed", String(item.dataset.section === tab));
  $("gear-options").hidden = tab === "pack";
  $("gear-ready").checked = readyOnly;
  const filter = $("gear-material-filter");
  filter.hidden = !materialFilter;
  if (materialFilter) setText(filter, "Clear " + materialName(materialFilter) + " filter");
  const list = $("gear-list");
  const scroll = list.scrollTop;
  const active = document.activeElement;
  const activeKey = list.contains(active) ? active?.dataset.gearKey : "";
  const rows = tab === "pack" ? packContents(usable) : recipeContents(usable);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = readyOnly ? "No recipes are ready with your current supplies." : "No matching recipes.";
    rows.push(empty);
  }
  list.replaceChildren(...rows);
  if (activeKey) {
    const activeButton = Array.from(list.querySelectorAll("[data-gear-key]")).find(button => button.dataset.gearKey === activeKey);
    if (activeButton && !activeButton.disabled) activeButton.focus({ preventScroll: true });
    else if (tab !== "pack") $("gear-ready").focus({ preventScroll: true });
  } else if (active?.id === "material-back" && materialFilter && tab === "pack") {
    $("material-back")?.focus({ preventScroll: true });
  }
  list.scrollTop = scroll;
}

$("gear-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (button) selectGearTab(button.dataset.section, Boolean(materialFilter));
});
$("gear-ready").addEventListener("change", (event) => {
  readyOnly = event.currentTarget.checked;
  $("gear-list").scrollTop = 0;
  renderDrawer();
});
$("gear-material-filter").addEventListener("click", () => selectGearTab(tab));

join.addEventListener("submit", (event) => {
  event.preventDefault();
  if ((!validKey && !soloMode) || phase !== "join") return;
  try {
    renderer ||= new ArenaRenderer($("view"), soloMode);
  } catch (error) {
    console.error(error);
    setStatus("This browser couldn’t start the 3D arena. Try an updated browser.", true);
    return;
  }
  playerName = nameInput.value.replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 20) || "Contestant";
  nameInput.value = playerName;
  enableWorkAudio();
  if (soloMode) void startSolo();
  else connect();
});

$("replay").addEventListener("click", () => {
  if (solo && (!frame?.player.alive || frame.winner)) {
    enableWorkAudio();
    void startSolo();
  }
});
startButton.addEventListener("click", () => { if (!startButton.hidden) socketSend("START"); });
readyButton.addEventListener("click", () => {
  enableWorkAudio();
  if (socketSend(ready ? "READY|0" : "READY|1")) readyButton.disabled = true;
});
$("lobby-leave").addEventListener("click", leave);
$("menu").addEventListener("click", (event) => openDrawer("menu", event.currentTarget));
$("pack").addEventListener("click", (event) => openDrawer("gear", event.currentTarget));
$("craft-shortcut").addEventListener("click", (event) => openDrawer("gear", event.currentTarget, "craft"));
$("build-shortcut").addEventListener("click", (event) => openDrawer("gear", event.currentTarget, "build"));
$("drawer-close").addEventListener("click", () => closeDrawer());
$("leave").addEventListener("click", leave);
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeDrawer(); });
window.addEventListener("contextmenu", (event) => { if (arena.contains(event.target)) event.preventDefault(); });
window.addEventListener("blur", () => neutralize(true));
window.addEventListener("orientationchange", () => neutralize(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) neutralize(true); });
arena.addEventListener("pointerdown", (event) => {
  if (workAudio && workAudio.state !== "running") enableWorkAudio();
  if (event.pointerType === "mouse" || event.pointerType === "touch") arena.dataset.input = event.pointerType;
}, { capture: true });
document.addEventListener("keydown", (event) => {
  const { code } = event;
  if (!canPlay() || event.altKey || event.metaKey || event.target?.matches?.("input, textarea, select, [contenteditable]")) return;
  if (movementKeys.has(code)) {
    event.preventDefault();
    arena.dataset.input = "mouse";
    desktopKeys.add(code);
    return;
  }
  if (event.ctrlKey && document.pointerLockElement !== look) return;
  const gearTab = desktopGearTabs[code] || (code === "Tab" && document.pointerLockElement === look ? "pack" : null);
  const action = code === "KeyY" && frame.hud.repair?.enabled ? "repair" : desktopActions[code];
  if (!(gearTab || action || code === "KeyT")) return;
  if (code === "Space" && document.pointerLockElement !== look && event.target?.matches?.("button")) return;
  event.preventDefault();
  if (event.repeat) return;
  if (gearTab) {
    const shortcut = gearTab === "pack" ? $("pack") : $(gearTab + "-shortcut");
    openDrawer("gear", shortcut, gearTab);
  } else if (action) {
    queue(action);
  } else if (frame.player.weapon === "spear") {
    desktopThrow = true;
    queue("+Throw");
  }
});
document.addEventListener("keyup", (event) => {
  desktopKeys.delete(event.code);
  if (event.code === "KeyT" && desktopThrow) {
    desktopThrow = false;
    queue("-Throw");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer) closeDrawer();
  if (event.key !== "Tab" || !drawer) return;
  const focusable = [...$("drawer").querySelectorAll("button:not(:disabled), input:not(:disabled)")]
    .filter(control => control.getClientRects().length);
  const next = event.shiftKey ? focusable.at(-1) : focusable[0];
  const end = event.shiftKey ? focusable[0] : focusable.at(-1);
  if (document.activeElement === end && next) {
    event.preventDefault();
    next.focus();
  }
});

setInterval(() => {
  if (solo) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - soloFrameAt) / 1000);
    soloFrameAt = now;
    if (document.hidden || !frame?.player.alive || frame.winner) return;
    sendInput();
    solo.step(dt);
    handleFrame(solo.frame());
  } else if (phase === "playing" && performance.now() - frameAt > 12000) socket?.close();
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
if (soloMode) {
  $("solo-settings").hidden = false;
  $("browse-rooms").hidden = false;
  $("replay").hidden = false;
  $("leave").textContent = "End solo match";
}
const suggestedName = new URLSearchParams(location.search).get("name");
if (validKey && suggestedName && !resume) nameInput.value = suggestedName.slice(0, 20);
setMode("join", soloMode ? "Play against 23 bots." : validKey ? "Join the host’s arena." :
  "Open the full room invite from the host.", !soloMode && !validKey);
if (validKey && new URLSearchParams(location.search).get("managed") === "1") {
  join.requestSubmit();
}
