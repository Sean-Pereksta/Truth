import {
  SPECIES, MAX_LEVEL, getForm, getStats, getAbilities, xpToNext, captureChance, rollEncounter
} from "./catalog.js";

const COLS = 7;
const ROWS = 5;
const CAPTURE_RANGE = 3;
const BIOMES = [
  { cover: "Fern cover", hazard: "Hookbriar", effect: "slow", pattern: ["..c.h..", "...#...", "..h.c..", ".c.#...", "...h..."] },
  { cover: "Reed bed", hazard: "Sour bog", effect: "hurt", pattern: ["...c...", "..h.c..", "...h...", "..#.#..", ".c.h..."] },
  { cover: "Crystal veil", hazard: "Loose shale", effect: "exposed", pattern: ["..#....", "..c.#..", "...h...", ".h.#.c.", "...c..."] },
  { cover: "Tidegrass", hazard: "Riptide", effect: "slow", pattern: ["..h.h..", "...c...", "..#.#..", ".c..h..", "...c..."] },
  { cover: "Snowbank", hazard: "Black ice", effect: "slow", pattern: ["..c.#..", "...h...", "..#..c.", ".h..#..", "...c..."] },
  { cover: "Ash plume", hazard: "Lava vent", effect: "burn", pattern: ["..#....", "...hc..", "..h.h..", ".c.h...", "....#.."] },
  { cover: "Pillar shade", hazard: "Rune trap", effect: "exposed", pattern: ["..c.h..", "..#.#..", "...c...", "..#.#..", "..h.c.."] },
  { cover: "Star mist", hazard: "Starfall", effect: "burn", pattern: ["...c...", "..h.#..", ".c.h.c.", "..#.h..", "...c..."] }
];
const GROUND = { c: "cover", h: "hazard", "#": "rock" };
const STATUS = { slow: "Slowed", exposed: "Exposed", stun: "Stunned" };
const STATUS_TIP = { slow: "Moves one fewer hex next turn.", exposed: "Takes 25% more damage until its next turn ends.", stun: "Misses its next turn." };
const ROLE_NAME = { defender: "Defender", ranged: "Ranged attacker", striker: "Fast striker", healer: "Healer" };
const keyOf = (x, y) => y * COLS + x;
const xy = key => ({ x: key % COLS, y: Math.floor(key / COLS) });
const nameOf = unit => getForm(unit.member).name;
const living = unit => unit.hp > 0 && !unit.caught;
const activeUnit = battle => battle.units[battle.order[battle.cursor]];
const unitAt = (battle, key) => battle.units.find(u => living(u) && u.key === key);
const log = (battle, line) => { battle.log.push(line); if (battle.log.length > 45) battle.log.shift(); };
const percent = rate => Math.round(rate * 100);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function hexDistance(a, b) {
  const p = xy(a), q = xy(b);
  const dx = (p.x - Math.floor(p.y / 2)) - (q.x - Math.floor(q.y / 2));
  const dy = p.y - q.y;
  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}

function adjacent(key) {
  const { x, y } = xy(key);
  const side = y % 2 ? 1 : -1;
  return [[x-1,y],[x+1,y],[x,y-1],[x+side,y-1],[x,y+1],[x+side,y+1]]
    .filter(([a,b]) => a >= 0 && a < COLS && b >= 0 && b < ROWS)
    .map(([a,b]) => keyOf(a,b));
}

export function reachable(battle, unit = activeUnit(battle)) {
  const visited = new Map([[unit.key, 0]]);
  const queue = [unit.key];
  const limit = Math.max(1, unit.stats.move - (unit.status.slow ? 1 : 0));
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], steps = visited.get(key);
    if (steps >= limit || unit.moved) continue;
    for (const next of adjacent(key)) {
      if (visited.has(next) || battle.tiles[next] === "rock" || unitAt(battle, next)) continue;
      visited.set(next, steps + 1);
      queue.push(next);
    }
  }
  return visited;
}

function buildUnit(member, team, slot, id) {
  const stats = getStats(member);
  const lane = [2, 1, 3, 0, 4][slot % ROWS];
  const edge = Math.floor(slot / ROWS);
  return {
    id, member: {...member}, team, key: keyOf(team === "you" ? edge : COLS-1-edge, lane),
    stats, hp: stats.maxHp, abilities: getAbilities(member), status: {},
    guarded: false, moved: false, caught: false, recovery: { heal: 0, stun: 0 }
  };
}

export function createBattle(encounter, party, opponents, rng = Math.random) {
  const region = Math.max(0, Math.min(BIOMES.length-1, Number(encounter.region) || 0));
  const biome = BIOMES[region];
  const mirror = [...String(encounter.node ?? "")].reduce((n, c) => n + c.charCodeAt(0), 0) % 2;
  const tiles = biome.pattern.flatMap(row => (mirror ? [...row].reverse() : [...row]).map(t => GROUND[t] || "plain"));
  const units = [...party.map((m,i) => buildUnit(m,"you",i,i)), ...opponents.map((m,i) => buildUnit(m,"wild",i,party.length+i))];
  units.forEach(u => { tiles[u.key] = "plain"; });
  const battle = { encounter, region, biome, tiles, units, rng, order: [], round: 0, cursor: -1, result: null, log: [] };
  nextTurn(battle);
  return battle;
}

function checkOutcome(battle) {
  if (!battle.units.some(u => u.team === "wild" && living(u))) battle.result = "won";
  else if (!battle.units.some(u => u.team === "you" && living(u))) battle.result = "lost";
  return battle.result;
}

function flash(battle, unit, label, tone) {
  battle.flash = { key: unit.key, label, tone, time: Date.now() };
}
function wound(battle, unit, amount) {
  flash(battle, unit, "−"+amount, "damage");
  unit.hp = Math.max(0, unit.hp - amount);
  if (!unit.hp) log(battle, nameOf(unit) + " fainted.");
}

function finishTile(battle, unit) {
  for (const status of Object.keys(unit.status)) {
    if (--unit.status[status] <= 0) delete unit.status[status];
  }
  if (!living(unit) || battle.tiles[unit.key] !== "hazard") return;
  const { hazard, effect } = battle.biome;
  if (effect === "burn" || effect === "hurt") {
    const damage = Math.max(2, Math.round(unit.stats.maxHp * (effect === "burn" ? 0.18 : 0.12)));
    log(battle, hazard + " dealt " + damage + " damage to " + nameOf(unit) + ".");
    wound(battle, unit, damage);
  } else {
    unit.status[effect] = 1;
    log(battle, hazard + " left " + nameOf(unit) + " " + STATUS[effect].toLowerCase() + ".");
  }
}

function nextTurn(battle) {
  while (!checkOutcome(battle)) {
    if (++battle.cursor >= battle.order.length) {
      battle.round++;
      battle.order = battle.units.filter(living).sort((a,b) => b.stats.speed - a.stats.speed || a.id - b.id).map(u => u.id);
      battle.cursor = 0;
    }
    const unit = activeUnit(battle);
    if (!living(unit)) continue;
    unit.guarded = false;
    unit.moved = false;
    for (const key of Object.keys(unit.recovery)) unit.recovery[key] = Math.max(0, unit.recovery[key] - 1);
    if (!unit.status.stun) return;
    log(battle, nameOf(unit) + " missed its turn while stunned.");
    finishTile(battle, unit);
  }
}

function finishTurn(battle, actor) {
  if (!checkOutcome(battle)) finishTile(battle, actor);
  if (!checkOutcome(battle)) nextTurn(battle);
}

export function moveUnit(battle, key) {
  if (battle.result) return false;
  const unit = activeUnit(battle);
  if (unit.moved || unit.key === key || !reachable(battle, unit).has(key)) return false;
  unit.key = key;
  unit.moved = true;
  return true;
}

function captureOdds(unit) {
  return captureChance(unit.member, unit.hp / unit.stats.maxHp, Object.values(unit.status).some(Boolean));
}

function flank(battle, actor, target, from) {
  return hexDistance(from, target.key) === 1 && battle.units.some(other =>
    other !== actor && other.team === actor.team && living(other) && hexDistance(other.key, target.key) === 1
  );
}

function damageFor(battle, actor, target, skill, from) {
  const distance = hexDistance(from, target.key);
  let amount = Math.max(3, actor.stats.attack * skill.power - target.stats.defense * 0.42);
  if (distance > 1 && battle.tiles[target.key] === "cover") amount *= 0.72;
  if (target.guarded) amount *= SPECIES[target.member.speciesId].role === "defender" ? 0.4 : 0.55;
  if (target.status.exposed) amount *= 1.25;
  if (flank(battle, actor, target, from)) amount *= 1.2;
  return Math.max(1, Math.round(amount));
}
function healingFor(actor, skill) {
  return Math.max(4, Math.round(actor.stats.attack * skill.power));
}
function recoveryGroup(skill) {
  if (skill.kind === "heal") return "heal";
  return skill.status === "stun" ? "stun" : null;
}
function recovering(actor, skill) {
  return actor.recovery[recoveryGroup(skill)] > 0;
}
function validTarget(actor, target, skill, from = actor.key) {
  if (recovering(actor, skill)) return false;
  if (!target || !living(target) || hexDistance(from, target.key) > skill.range) return false;
  if (skill.kind === "guard") return target === actor;
  return skill.kind === "heal" ? target.team === actor.team && target.hp < target.stats.maxHp : target.team !== actor.team;
}

export function useAbility(battle, index, target) {
  if (battle.result) return false;
  const actor = activeUnit(battle);
  const skill = actor.abilities[index];
  if (!skill || !validTarget(actor, target, skill)) return false;
  if (skill.kind === "guard") return guard(battle);
  const recovery = recoveryGroup(skill);
  if (recovery) actor.recovery[recovery] = 2;
  if (skill.kind === "heal") {
    const amount = Math.min(target.stats.maxHp-target.hp, healingFor(actor, skill));
    target.hp += amount;
    flash(battle, target, "+"+amount, "heal");
    log(battle, nameOf(actor) + " used " + skill.name + " and restored " + amount + " HP to " + nameOf(target) + ".");
  } else {
    const damage = damageFor(battle, actor, target, skill, actor.key);
    const bonus = flank(battle, actor, target, actor.key) ? " • flank bonus" : "";
    log(battle, nameOf(actor) + " used " + skill.name + " on " + nameOf(target) + " for " + damage + bonus + ".");
    wound(battle, target, damage);
    if (skill.status && living(target)) {
      target.status[skill.status] = 1;
      log(battle, nameOf(target) + " is " + STATUS[skill.status].toLowerCase() + ".");
    }
  }
  finishTurn(battle, actor);
  return true;
}

export function guard(battle) {
  if (battle.result) return false;
  const unit = activeUnit(battle);
  unit.guarded = true;
  log(battle, nameOf(unit) + " took guard.");
  finishTurn(battle, unit);
  return true;
}

export function attemptCapture(battle, target) {
  if (battle.result) return false;
  const actor = activeUnit(battle);
  if (actor.team !== "you" || !target || target.team !== "wild" || !living(target) || hexDistance(actor.key, target.key) > CAPTURE_RANGE) return false;
  const chance = captureOdds(target);
  target.caught = battle.rng() < chance;
  flash(battle, target, target.caught ? "Caught!" : "Escaped", "catch");
  log(battle, target.caught ? nameOf(target) + " joined your force!" : nameOf(target) + " escaped the capture (" + percent(chance) + "% chance).");
  finishTurn(battle, actor);
  return true;
}

function enemyPlan(battle) {
  const actor = activeUnit(battle), options = reachable(battle, actor);
  const friends = battle.units.filter(u => u.team !== actor.team && living(u));
  const reach = Math.max(1, ...actor.abilities.filter(s => s.kind === "attack").map(s => s.range));
  let best = { score: -Infinity };
  for (const [key, steps] of options) {
    const distance = Math.min(...friends.map(e => hexDistance(key, e.key)));
    const tile = battle.tiles[key];
    const ground = (tile === "cover" ? 1.6 : tile === "hazard" ? -6 : 0);
    // Ranged species seek firing distance. A tiny movement cost keeps equivalent choices stable.
    const position = ground - Math.abs(distance-reach)*1.7 - steps*0.06;
    const consider = (score, i, target) => { if (score > best.score) best = { score, key, i, target }; };
    consider(position, null, null);
    actor.abilities.forEach((skill,i) => {
      if (skill.kind === "guard") return;
      battle.units.forEach(target => {
        if (!validTarget(actor, target, skill, key)) return;
        if (skill.kind === "heal") {
          const restored = Math.min(healingFor(actor,skill), target.stats.maxHp-target.hp);
          const urgency = target.hp / target.stats.maxHp < 0.4 ? 1.65 : 0.9;
          consider(position + restored * urgency, i, target);
        } else {
          const dmg = damageFor(battle,actor,target,skill,key);
          const finisher = target.hp <= dmg ? 14 : 0;
          const status = skill.status && !target.status[skill.status] ? (skill.status === "stun" ? 7 : 3) : 0;
          consider(position + Math.min(dmg,target.hp) + finisher + status, i, target);
        }
      });
    });
  }
  return best;
}

function outcome(battle) {
  const wild = battle.units.filter(u => u.team === "wild");
  const xp = battle.result === "won" ? Math.round(10 + wild.reduce((total,u) => total+4+2*u.member.level,0)) : 0;
  return { result: battle.result, encounter: battle.encounter, xp,
    party: battle.units.filter(u => u.team === "you").map(u => ({...u.member,hp:u.hp})),
    captured: wild.filter(u => u.caught).map(u => ({...u.member})) };
}

const HAZARD_INFO = {
  slow: "End here: lose 1 move next turn.", exposed: "End here: take 25% more damage next turn.",
  hurt: "End here: lose 12% of max HP.", burn: "End here: lose 18% of max HP."
};
function terrainInfo(battle, tile) {
  return ({
    plain: ["Open ground", "Clear footing."],
    cover: [battle.biome.cover, "Reduces incoming ranged damage by 28%."],
    hazard: [battle.biome.hazard, HAZARD_INFO[battle.biome.effect]],
    rock: ["Stone", "Blocks movement."]
  })[tile];
}

export function mountBattle(root, { encounter, party, sprite, onFinish, onResolved }) {
  const opponents = rollEncounter(encounter.region, { level: encounter.level, leadSpeciesId: encounter.leadSpeciesId,
    legendary: encounter.kind === "legendary", challenge: encounter.kind === "warden" });
  const battle = createBattle(encounter, party, opponents);
  let resolution;
  let mode = "move", inspectedKey = null, note = "", timer = 0, disposed = false, retreat = false, details = false;
  const face = u => sprite(u.member.speciesId, getForm(u.member).stage);
  const isPlayer = () => !battle.result && activeUnit(battle).team === "you";
  const later = (fn,delay) => { timer = setTimeout(() => { if (!disposed) fn(); },delay); };

  function inspectPanel(uid, key) {
    if (!uid) {
      const [label, tip] = terrainInfo(battle,battle.tiles[key]);
      return '<div class="cb-inspect"><strong>'+escape(label)+'</strong><small>'+escape(tip)+'</small></div>';
    }
    const u = uid, def = SPECIES[u.member.speciesId];
    const statuses = Object.keys(u.status).filter(s => u.status[s]).map(s => '<abbr title="'+escape(STATUS_TIP[s])+'">'+escape(STATUS[s])+'</abbr>');
    if (u.guarded) statuses.push("Guarding");
    const hpWidth = Math.ceil(100*u.hp/u.stats.maxHp);
    return '<div class="cb-inspect"><div class="cb-ident"><span class="cb-portrait">'+face(u)+'</span><div><small>'+
      (u.team === "you" ? "YOUR FORCE" : "WILD CRITTER")+' · LV '+u.member.level+'</small><strong>'+escape(nameOf(u))+'</strong><span>'+
      escape(ROLE_NAME[def.role] || def.role)+(statuses.length ? ' · '+statuses.join(" · ") : '')+'</span></div></div>'+
      '<div class="cb-stat"><span>Health</span><b>'+u.hp+' / '+u.stats.maxHp+'</b></div>'+
      '<div class="cb-meter"><i style="width:'+hpWidth+'%"></i></div>'+
      (u.team === "wild" ? '<div class="cb-stat cb-odds"><span>Capture chance</span><b>'+percent(captureOdds(u))+'%</b></div>' :
        '<div class="cb-stat"><span>XP</span><b>'+(u.member.level >= MAX_LEVEL ? 'MAX' : u.member.xp+' / '+xpToNext(u.member.level))+'</b></div>')+
      '</div>';
  }

  function cellMarkup(key, actor, steps, skill) {
    const tile = battle.tiles[key], u = unitAt(battle,key), {x,y} = xy(key);
    const [terrain, info] = terrainInfo(battle,tile);
    const move = isPlayer() && mode === "move" && key !== actor.key && steps.has(key);
    const canTarget = isPlayer() && u && ((mode === "capture" && u.team === "wild" && hexDistance(actor.key,key) <= CAPTURE_RANGE) ||
      (skill && validTarget(actor,u,skill)));
    const active = !battle.result && u === actor;
    const title = (u ? nameOf(u)+' · '+(u.team === "you" ? 'Ally' : 'Wild')+' · '+u.hp+'/'+u.stats.maxHp+' HP'+(u.team === "wild" ? ' · Capture '+percent(captureOdds(u))+'%' : '')+' · ' : '')+terrain+'. '+info;
    const parts = ["cb-cell","cb-"+tile];
    if (u) parts.push("cb-occupied","cb-"+u.team);
    if (active) parts.push("cb-active");
    if (move) parts.push("cb-reach");
    if (canTarget) parts.push("cb-target");
    if (key === inspectedKey) parts.push("cb-selected");
    let content = '<span class="cb-floor"></span>';
    if (tile !== "plain") content += '<span class="cb-terrain-mark" aria-hidden="true">'+({ rock:"▲", cover:"≋", hazard:"!" })[tile]+'</span>';
    if (move) content += '<span class="cb-step" aria-hidden="true"></span>';
    if (u) {
      content += '<span class="cb-creature" aria-hidden="true">'+face(u)+'</span><i class="cb-hp"><b style="width:'+Math.ceil(100*u.hp/u.stats.maxHp)+'%"></b></i>';
      if (active) content += '<i class="cb-cursor">▼</i>';
      if (canTarget && mode === "capture") content += '<b class="cb-hex-odds">'+percent(captureOdds(u))+'%</b>';
    }
    if (battle.flash?.key === key) {
      const elapsed = Date.now() - battle.flash.time;
      if (elapsed < 1050) content += '<span class="cb-fx cb-fx-'+battle.flash.tone+'" aria-hidden="true" style="animation-delay:-'+elapsed+'ms">'+battle.flash.label+'</span>';
    }
    return '<button type="button" data-cell="'+key+'" class="'+parts.join(" ")+'" style="--x:'+((x+(y%2)*0.5)/7.5*100)+'%;--y:'+(y*18.75)+'%" title="'+escape(title)+'" aria-label="'+escape(title)+'">'+content+'</button>';
  }

  function cmd(action, label, caption, selected = false, disabled = false, title = "") {
    return '<button type="button" class="cb-command'+(selected ? ' chosen':'')+'" data-act="'+action+'"'+(disabled?' disabled':'')+
      (title ? ' title="'+escape(title)+'"':'')+'><b>'+escape(label)+'</b><small>'+escape(caption)+'</small></button>';
  }

  function draw() {
    const focus = root.contains(document.activeElement) ? document.activeElement.dataset : {};
    const actor = activeUnit(battle);
    const interactive = isPlayer();
    const skill = typeof mode === "number" ? actor.abilities[mode] : null;
    const steps = !battle.result ? reachable(battle,actor) : new Map();
    const cells = battle.tiles.map((_,i) => cellMarkup(i,actor,steps,skill)).join("");
    const name = escape(encounter.name || "Wild tribe");
    const current = inspectedKey === null ? actor : unitAt(battle,inspectedKey);
    const turnOrder = battle.order.slice(battle.cursor).map(id => battle.units[id]).filter(living);
    const commands = !actor ? "" : [
      cmd("move","Move",actor.moved ? "Moved this turn" : Math.max(1,actor.stats.move - (actor.status.slow ? 1:0))+" hexes",mode === "move",!interactive || actor.moved),
      ...actor.abilities.flatMap((a,i) => a.kind === "guard" ? [] : [cmd("skill-"+i, a.name, recovering(actor,a) ? "Resting · 1 turn" : (a.kind === "heal" ? "Heal" : "Attack")+" · "+a.range+" hex"+(a.range === 1 ? "" : "es"),mode === i,!interactive || recovering(actor,a),a.description + (recoveryGroup(a) ? " Rest one turn between uses." : ""))]),
      cmd("capture","Capture","3 hexes",mode === "capture",!interactive,"Weaken a wild Critter or apply a status to improve its chance."),
      cmd("guard", actor.abilities.find(a => a.kind === "guard")?.name || "Guard", "End turn", false, !interactive,
        "Reduce incoming damage by " + (SPECIES[actor.member.speciesId].role === "defender" ? "60" : "45") + "% until your next turn.")
    ].join("");
    let hint = "Choose a lit hex to move, then choose an action.";
    if (mode === "capture") hint = "Choose a marked wild Critter to attempt a capture.";
    if (skill) hint = skill.description + (recoveryGroup(skill) ? " Rest one turn between uses." : "") + " Choose a marked " + (skill.kind === "heal" ? "ally." : "opponent.");
    if (!interactive && !battle.result) hint = "The wild tribe is taking its turn.";
    if (note) hint = note;
    const heading = !battle.result && interactive ? "Your turn" : "Wild turn";
    const publishResult = battle.result && !resolution;
    if (publishResult) resolution = outcome(battle);
    const end = resolution;
    const resultName = { won: "Victory", lost: "Party exhausted", fled: "Retreated" };
    const outcomeBody = end ? '<section class="cb-outcome" aria-live="polite"><div><small>ENCOUNTER COMPLETE</small><h3>'+resultName[end.result]+'</h3>'+
      (end.xp ? '<p>+'+end.xp+' XP for each party member.</p>':'')+
      (end.captured.length ? '<p>Captured '+end.captured.map(m => escape(getForm(m).name)).join(", ")+'.</p>':'')+
      (!end.xp && !end.captured.length ? '<p>Your party regroups on the trail.</p>':'')+
      '<button type="button" data-act="return">Return to trail</button></div></section>' : "";
    const orders = turnOrder.slice(0,7).map((u,i) => '<span class="cb-order-token cb-order-'+u.team+'" title="'+escape(nameOf(u))+'"><span>'+
      face(u)+'</span>'+(i===0 ? '<i>◆</i>' : '')+'</span>').join("");
    root.innerHTML = '<section class="cb-shell" aria-label="Tactical encounter"><header class="cb-heading"><div><small>'+
      ({tribe:"WILD TRIBE",warden:"WARDEN ARENA",legendary:"LEGENDARY ENCOUNTER"}[encounter.kind] || "ENCOUNTER")+
      '</small><h2>'+name+'</h2></div><button type="button" data-act="retreat" '+(end?'disabled':'')+'>Retreat</button></header>'+
      (retreat && !end ? '<div class="cb-retreat" role="group" aria-label="Confirm retreat"><span>Leave this encounter?</span><button data-act="flee">Leave</button><button data-act="stay">Stay</button></div>' : '')+
      '<div class="cb-layout"><div class="cb-main"><div class="cb-turnline"><span>Round <b>'+battle.round+'</b></span><span>Turn order</span><div class="cb-order">'+orders+'</div></div>'+
      '<div class="cb-arena" style="--atlas-x:'+(battle.region%2*100)+'%;--atlas-y:'+(Math.floor(battle.region/2)*100/3)+'%">'+
      '<div class="cb-board" role="group" aria-label="Tactical hex grid">'+cells+'</div>'+outcomeBody+'</div>'+
      '<div class="cb-key"><span><i>≋</i> Cover</span><span><i>!</i> '+escape(battle.biome.hazard)+'</span><span><i>▲</i> Impassable</span><span><i>◆</i> Active</span></div>'+
      '<p class="cb-latest" role="status">'+escape(battle.log.at(-1) || "Allies start on the left. Two allies beside one opponent gain 20% melee damage.")+'</p>'+
      '</div><aside class="cb-panel"><div class="cb-panel-title"><small>'+ (end ? "ENCOUNTER COMPLETE" : heading.toUpperCase())+'</small><strong>'+escape(actor ? nameOf(actor) : "Encounter")+'</strong></div>'+
      '<div class="cb-commands">'+commands+'</div><p class="cb-hint" aria-live="polite">'+escape(end ? "Encounter complete." : hint)+'</p>'+
      (actor ? inspectPanel(current,inspectedKey ?? actor.key) : '')+
      '<details class="cb-log"'+(details?' open':'')+'><summary>Battle log</summary><ol>'+battle.log.slice(-8).reverse().map(s => '<li>'+escape(s)+'</li>').join("")+'</ol></details>'+
      '</aside></div></section>';
    if (focus.cell !== undefined || focus.act) {
      const element = focus.cell !== undefined ? root.querySelector('[data-cell="'+focus.cell+'"]') : root.querySelector('[data-act="'+focus.act+'"]');
      if (element && !element.disabled) element.focus({preventScroll:true});
    }
    if (publishResult) onResolved?.(resolution);
  }

  function resetTurn() {
    mode = "move"; note = ""; inspectedKey = null;
    draw(); scheduleEnemy();
  }
  function scheduleEnemy() {
    if (disposed || battle.result || isPlayer() || retreat) return;
    later(() => {
      if (retreat) return;
      const plan = enemyPlan(battle);
      const actor = activeUnit(battle);
      moveUnit(battle,plan.key);
      inspectedKey = actor.key; draw();
      later(() => {
        if (retreat) return;
        if (plan.i !== null && useAbility(battle,plan.i,plan.target)) { resetTurn(); return; }
        guard(battle); resetTurn();
      }, 430);
    }, 460);
  }

  function finish() {
    if (disposed || !battle.result) return;
    cleanup();
    onFinish(resolution);
  }
  function chooseCell(key) {
    const u = unitAt(battle,key);
    inspectedKey = key;
    if (!isPlayer() || retreat) { draw(); return; }
    if (mode === "move") {
      if (moveUnit(battle,key)) {
        const actor = activeUnit(battle);
        mode = actor.abilities.findIndex(a => a.kind === "attack");
        note = "Moved. Select an opponent for a basic attack, or choose another action.";
      } else if (u?.team === "wild") {
        note = "Choose an ability or Capture, then tap " + nameOf(u) + ".";
      } else {
        note = u ? nameOf(u) + " holds this hex." : terrainInfo(battle,battle.tiles[key]).join(". ");
      }
    } else if (mode === "capture") {
      if (attemptCapture(battle,u)) { resetTurn(); return; }
      note = "Choose a wild Critter within " + CAPTURE_RANGE + " hexes.";
    } else if (typeof mode === "number") {
      if (useAbility(battle,mode,u)) { resetTurn(); return; }
      const skill = activeUnit(battle).abilities[mode];
      note = skill.kind === "heal" ? "Choose a wounded ally within "+skill.range+" hexes." : "Choose an opponent within "+skill.range+" hexes.";
    }
    draw();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button || !root.contains(button) || button.disabled || disposed) return;
    if (button.dataset.cell !== undefined) { chooseCell(Number(button.dataset.cell)); return; }
    const act = button.dataset.act;
    if (act === "return") { finish(); return; }
    if (battle.result) return;
    if (act === "retreat" || act === "stay") {
      retreat = act === "retreat";
      clearTimeout(timer); draw(); if (!retreat) scheduleEnemy();
      return;
    }
    if (act === "flee" && retreat) { battle.result = "fled"; retreat = false; draw(); return; }
    if (!isPlayer() || retreat) return;
    if (act === "guard") { guard(battle); resetTurn(); return; }
    if (act === "move" || act === "capture") mode = act;
    else if (act?.startsWith("skill-")) mode = Number(act.slice(6));
    note = "";
    if (mode !== "move") {
      const actor = activeUnit(battle);
      const hasTarget = battle.units.some(u => living(u) && (mode === "capture" ? u.team !== actor.team && hexDistance(actor.key,u.key)<=CAPTURE_RANGE : validTarget(actor,u,actor.abilities[mode])));
      if (!hasTarget) note = (mode !== "capture" && actor.abilities[mode]?.kind === "heal") ? "No wounded allies in reach." :
        (actor.moved ? "No target in reach. Guard to end the turn." : "No target in reach. Move closer first.");
    }
    draw();
  }
  function onToggle(e) { if (e.target.matches?.(".cb-log")) details = e.target.open; }
  function keys(e) {
    if (document.querySelector("dialog[open]")) return;
    const cell = e.target.closest("[data-cell]");
    if (!cell) return;
    const { x, y } = xy(Number(cell.dataset.cell));
    const offsets = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
    const d = offsets[e.key];
    if (!d) return;
    e.preventDefault();
    const nx = Math.max(0,Math.min(COLS-1,x+d[0])), ny = Math.max(0,Math.min(ROWS-1,y+d[1]));
    root.querySelector('[data-cell="'+keyOf(nx,ny)+'"]')?.focus({preventScroll:true});
  }
  function cleanup() {
    disposed = true;
    clearTimeout(timer);
    root.removeEventListener("click",click);
    root.removeEventListener("keydown",keys);
    root.removeEventListener("toggle",onToggle,true);
  }
  root.addEventListener("click",click);
  root.addEventListener("keydown",keys);
  root.addEventListener("toggle",onToggle,true);
  draw(); scheduleEnemy();
  return cleanup;
}
