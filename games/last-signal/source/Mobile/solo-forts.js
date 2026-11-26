const TILE = 3;
const STORY = 2.3;
const DECK = 0.16;
const QUARTER = Math.PI / 2;
const BUILD_REACH = 3.45;
export const FORT_STEP_HEIGHT = 0.43;

export const fortSizes = {
  wall: [TILE, STORY, 0.27], gate: [TILE, STORY, 0.29],
  floor: [TILE, DECK, TILE], ramp: [2.4, STORY, TILE]
};

// Locations are offsets in the fort's local grid. A raised panel can remain
// on either of its support walls. The lookout rail depends on the panel.
const blueprints = {
  hide: [
    ["wall", 0, 1.5], ["wall", 1.5, 0, 1]
  ],
  camp: [
    ["wall", 0, 4.5], ["wall", -1.5, 3, 1],
    ["wall", 0, -1.5], ["wall", 1.5, 0, 1]
  ],
  lookout: [
    ["wall", -1.5, 0, 1], ["wall", 1.5, 0, 1],
    ["floor", 0, 0, 0, STORY - DECK, [0, 1]],
    ["ramp", 0, -3], ["barricade", 0, 1.5, 0, STORY, [2]]
  ],
  stronghold: [
    ["wall", -1.5, 0, 1], ["ramp", 3, 3, 3], ["wall", 1.5, 0, 1],
    ["wall", -1.5, 3, 1], ["wall", 1.5, 3, 1], ["gate", 0, 4.5],
    ["floor", 0, 0, 0, STORY - DECK, [0, 2]], ["floor", 0, 3, 0, STORY - DECK, [3, 4]]
  ]
};

const blueprintDescriptions = {
  hide: ["Trail Hide", "Two timber walls form a corner for quick cover."],
  camp: ["Field Camp", "Four walls cover a two-tile camp with two exits."],
  lookout: ["Raised Lookout", "Build a supported deck, uphill ramp and low railing."],
  stronghold: ["Stronghold", "Two roof decks above a gated camp with a rear exit and outside ramp."]
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const top = piece => piece.y + piece.h;
const active = (arena, piece) => !arena.removed.has(piece.propIndex);

function offset(origin, u, v, angle = origin.angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: origin.x + u * c + v * s, z: origin.z - u * s + v * c };
}

function local(piece, x, z) {
  const c = Math.cos(piece.angle), s = Math.sin(piece.angle);
  return [c * (x - piece.x) - s * (z - piece.z), s * (x - piece.x) + c * (z - piece.z)];
}

export function fortFootprint(piece, x, z, padding = 0) {
  const [u, v] = local(piece, x, z);
  return Math.abs(u) <= piece.w / 2 + padding && Math.abs(v) <= piece.d / 2 + padding;
}

function rampSurface(piece, x, z) {
  const [, v] = local(piece, x, z);
  return piece.y + piece.h * Math.max(0, Math.min(1, v / piece.d + 0.5));
}

export function fortGround(arena, x, z, ceiling, padding = 0.045) {
  let floor = arena.map.heightAt(x, z);
  for (const piece of arena.pieces) {
    if ((piece.id !== "floor" && piece.id !== "ramp") || !active(arena, piece) ||
        !fortFootprint(piece, x, z, padding)) continue;
    const height = piece.id === "ramp" ? rampSurface(piece, x, z) : top(piece);
    if (height <= ceiling) floor = Math.max(floor, height);
  }
  return floor;
}

export function fortBlocksActor(piece, x, z, padding, feet, head) {
  if (piece.open || !fortFootprint(piece, x, z, piece.id === "floor" ? 0 : padding)) return false;
  if (feet === undefined) return piece.id !== "floor" && piece.id !== "ramp" && piece.h >= 0.65;
  if (piece.id === "floor") return head > piece.y + 0.06 && feet < top(piece) - 0.17;
  if (piece.id === "ramp") {
    const rise = rampSurface(piece, x, z);
    return feet < rise - 0.24 && head > rise - 0.2;
  }
  return piece.h >= 0.65 && head > piece.y + 0.04 && feet < top(piece) - 0.37;
}

function footprintsOverlap(a, b) {
  const difference = a.angle - b.angle;
  const c = Math.abs(Math.cos(difference)), s = Math.abs(Math.sin(difference));
  const [u, v] = local(a, b.x, b.z);
  return Math.abs(u) < (a.w + b.w * c + b.d * s) / 2 - 0.15 &&
    Math.abs(v) < (a.d + b.w * s + b.d * c) / 2 - 0.15;
}

function groundProblem(arena, piece) {
  for (const [u, v] of [[0, 0], [-0.45, -0.45], [-0.45, 0.45], [0.45, -0.45], [0.45, 0.45]]) {
    const { x, z } = offset(piece, u * piece.w, v * piece.d);
    const ground = arena.map.heightAt(x, z);
    if (arena.map.surfaceAt(x, z) > ground + 0.22) return "The footprint is in water.";
    if (!arena.map.canOccupy(x, z, arena.removed)) return "Terrain or a prop blocks the footprint.";
    if (!piece.supports?.length && Math.abs(piece.y - ground) > (piece.id === "wall" ? 0.54 : 0.43)) {
      return "The ground is too steep.";
    }
  }
  return "";
}

function actorOverlaps(piece, actor) {
  return actor.alive && actor.y + 1.55 > piece.y + 0.04 && actor.y < top(piece) - 0.24 &&
    fortFootprint(piece, actor.x, actor.z, 0.32);
}

function placementProblem(arena, piece, earlier = [], actor = null) {
  const ground = groundProblem(arena, piece);
  if (ground) return ground;
  if (arena.actors.some(other => other !== actor && actorOverlaps(piece, other))) return "A contestant blocks the footprint.";
  const overlap = [...arena.pieces, ...earlier].some(other => {
    if (!active(arena, other) || piece.supports?.includes(other) || other.supports?.includes(piece) ||
        piece.y >= top(other) - 0.055 || other.y >= top(piece) - 0.055) return false;
    // The upper ramp lip may meet a timber wall at deck height.
    if ((piece.id === "ramp" && other.id === "wall" || other.id === "ramp" && piece.id === "wall") &&
        Math.abs(top(piece) - top(other)) < 0.13) {
      const [ramp, wall] = piece.id === "ramp" ? [piece, other] : [other, piece];
      if (distance(offset(ramp, 0, ramp.d / 2), wall) < 0.18) return false;
    }
    return footprintsOverlap(piece, other) && footprintsOverlap(other, piece);
  });
  return overlap ? "Another structure occupies the footprint." : "";
}

export function playerFortPiece(arena, actor, draft, pitch) {
  let piece = draft, nearest = 1.65;
  // Snap to a visible upper surface if the aim is raised or the builder is
  // already standing above ground. Ground pieces remain freely placeable.
  const raised = pitch > 0.16 || actor.y > arena.map.heightAt(actor.x, actor.z) + 0.7;
  if (raised) {
    for (const support of arena.pieces) {
      if (!active(arena, support) || (support.id !== "floor" && support.id !== "wall")) continue;
      if (Math.abs(top(support) - actor.y) > 3.25) continue;
      const turns = support.id === "wall" ? [0, Math.PI] : [0, QUARTER, Math.PI, 3 * QUARTER];
      for (const turn of turns) {
        if (support.id === "wall" && draft.id !== "floor" && draft.id !== "ramp") continue;
        const fromSupport = support.angle + turn;
        const spacing = support.id === "floor" && (draft.id === "floor" || draft.id === "ramp") ? TILE : TILE / 2;
        const position = offset(support, 0, spacing, fromSupport);
        const angle = draft.id === "ramp" ? fromSupport + Math.PI : fromSupport;
        const error = distance(draft, position) + (draft.id === "ramp" ?
          (1 - Math.cos(draft.angle - angle)) * 0.6 : 0);
        if (distance(actor, position) > BUILD_REACH + 0.55) continue;
        const depth = draft.id === "floor" ? DECK : draft.id === "ramp" ? draft.h : 0;
        const y = top(support) - depth;
        if (draft.id === "floor" && piece.support && distance(piece, position) < 0.1 && Math.abs(piece.y - y) < 0.09) {
          if (!piece.supports.includes(support)) piece.supports.push(support);
          continue;
        }
        if (error >= nearest) continue;
        nearest = error;
        const groundedRamp = draft.id === "ramp" && y <= arena.map.heightAt(position.x, position.z) + 0.43;
        piece = { ...draft, ...position, angle, y, support, supports: groundedRamp ? [] : [support] };
      }
    }
  }
  const error = livePlacementProblem(arena, actor, piece, false) ||
    (draft.id === "floor" && raised && !piece.support ? "Aim at the top of a wall or the edge of a platform for support." : "");
  return { ...piece, fits: !error, error };
}

function livePlacementProblem(arena, actor, piece, checkReach = true) {
  if (actorOverlaps(piece, actor)) return "Step out of the footprint.";
  const problem = placementProblem(arena, piece, [], actor);
  if (problem) return problem;
  if (piece.supports?.length && !piece.supports.some(support => support.propIndex != null && active(arena, support))) {
    return "Build a supporting wall or platform first.";
  }
  if (checkReach && distance(actor, piece) > BUILD_REACH) return "Move closer to the highlighted piece.";
  if ((checkReach || piece.support) && !placementVisible(arena, actor, piece)) return "The placement is out of sight. Move to a clear angle.";
  return "";
}

function layout(arena, kind, site) {
  const groundCover = kind === "hide" || kind === "camp";
  const pieces = [];
  for (const [id, x, z, quarter = 0, height = 0, supports = []] of blueprints[kind]) {
    const [w, h, d] = fortSizes[id] ?? [TILE, 1, 0.26];
    const point = offset(site, x, z);
    pieces.push({ id, ...point, y: groundCover ? arena.map.heightAt(point.x, point.z) : site.y + height,
      w, h, d, angle: site.angle + quarter * QUARTER, fortKind: kind, supports: supports.map(index => pieces[index]) });
  }
  return pieces;
}

function blueprintBill(arena, pieces) {
  const materials = {};
  for (const piece of pieces) {
    const id = Array.isArray(piece) ? piece[0] : piece.id;
    for (const [material, quantity] of Object.entries(arena.fortRecipe(id)[2])) {
      materials[material] = (materials[material] || 0) + quantity;
    }
  }
  return materials;
}

function installed(arena, piece) {
  return piece.propIndex != null && active(arena, piece);
}

export function playerFortRecipes(arena) {
  return Object.entries(blueprints).map(([kind, dimensions]) => {
    const [title, description] = blueprintDescriptions[kind];
    const saved = arena.playerFortPlans.get(kind);
    const remaining = saved?.pieces.filter(piece => !installed(arena, piece));
    const continuing = Boolean(remaining?.length && saved.pieces.some(piece => piece.propIndex != null));
    const bill = blueprintBill(arena, continuing ? remaining : dimensions);
    const next = continuing ? remaining[0] : dimensions[0];
    const startCost = arena.fortRecipe(Array.isArray(next) ? next[0] : next.id)[2];
    const recipe = [`blueprint_${kind}`, 1, bill, { title, description, blueprint: true, kind, startCost, saved: continuing }];
    if (continuing) {
      recipe[3].description = `Resume the existing ${title.toLowerCase()}. ${remaining.length} ${remaining.length === 1 ? "piece" : "pieces"} remaining.`;
    }
    return recipe;
  });
}

export function startPlayerFort(arena, kind, actor, rotation) {
  const saved = arena.playerFortPlans.get(kind);
  if (saved?.pieces.some(piece => piece.propIndex != null) &&
      saved.pieces.some(piece => !installed(arena, piece))) return saved;
  const [title] = blueprintDescriptions[kind];
  const reach = 3.15;
  const point = offset(actor, 0, reach, actor.yaw);
  point.x = Math.round(point.x * 2) / 2;
  point.z = Math.round(point.z * 2) / 2;
  const angle = Math.round(actor.yaw / QUARTER) * QUARTER + rotation;
  const [, u, v] = blueprints[kind][0];
  const anchor = offset(point, -u, -v, angle);
  const site = { ...anchor, angle, y: arena.map.heightAt(anchor.x, anchor.z) };
  return { kind, title, site, pieces: layout(arena, kind, site) };
}

export function previewPlayerFort(arena, actor, kind, rotation) {
  const plan = startPlayerFort(arena, kind, actor, rotation);
  const pending = plan.pieces.filter(piece => !installed(arena, piece));
  const piece = pending[0];
  const placed = plan.pieces.length - pending.length;
  const anchored = plan.pieces.some(item => item.propIndex != null);
  let layoutError = "";
  const ghosts = pending.map((item, index) => {
    const problem = placementProblem(arena, item, pending.slice(0, index), actor);
    layoutError ||= problem;
    return { piece: item, status: problem ? "blocked" : "pending" };
  });
  const recipe = piece && arena.fortRecipe(piece.id);
  const missing = recipe && Object.entries(recipe[2]).filter(([id, n]) => (actor.bag[id] || 0) < n);
  const placement = piece && livePlacementProblem(arena, actor, piece);
  const missingText = missing?.map(([id, n]) => `${n - (actor.bag[id] || 0)} ${id === "branch" ? "wood" : id}`).join(", ");
  const error = (placed ? "" : layoutError) || placement || (missingText ? `Need ${missingText} for this piece.` : "");
  if (ghosts.length) ghosts[0].status = error ? "blocked" : "ready";
  const supports = piece?.supports ?? [];
  const support = supports.find(item => item.propIndex != null && active(arena, item)) || supports[0];
  const ramp = piece?.id === "ramp" ? piece : pending.find(item => item.id === "ramp");
  return { plan, piece, recipe, placed, remaining: pending.length, total: plan.pieces.length, ghosts, error, support, ramp, anchored };
}

export function updatePlayerFort(arena, preview) {
  const { plan, piece, recipe } = preview;
  const restored = { ...piece };
  const index = plan.pieces.indexOf(piece);
  plan.pieces[index] = restored;
  for (const dependent of plan.pieces) {
    const slot = dependent.supports.indexOf(piece);
    if (slot >= 0) dependent.supports[slot] = restored;
  }
  arena.installPiece(arena.player, recipe, restored);
  arena.playerFortPlans.set(plan.kind, plan);
}

export function collapseFort(arena, struck) {
  const unsupported = [struck];
  while (unsupported.length) {
    const support = unsupported.pop();
    for (const piece of arena.pieces) {
      if (!active(arena, piece) || !piece.supports?.includes(support) || piece.supports.some(other => active(arena, other))) continue;
      arena.removed.add(piece.propIndex);
      arena.changes.set(piece.propIndex, null);
      unsupported.push(piece);
    }
  }
}

function siteIsSafe(arena, site, seconds) {
  const storm = arena.storm;
  const closing = Math.max(0, seconds - (storm.active ? 0 : storm.seconds));
  return distance(site, storm) + 7 < storm.radius - closing * 0.87;
}

function fortPreference(arena, actor) {
  return actor.buildBias ?? ((actor.id * 17 + (arena.world.seed >>> 0)) % 23) / 22;
}

function constructionSite(arena, actor, kind) {
  const dimensions = blueprints[kind];
  const bearing = Math.round(actor.yaw / QUARTER) * QUARTER;
  for (const [u, v] of [[0, 0], [-3, 1], [3, 1], [0, 4], [0, -4], [-5, -3], [5, -3]]) {
    const point = offset(actor, u, v, bearing);
    if (!siteIsSafe(arena, point, dimensions.length * 2.5 + 13)) continue;
    for (const turn of [0, QUARTER, -QUARTER, Math.PI]) {
      const site = { ...point, angle: bearing + turn, y: arena.map.heightAt(point.x, point.z) };
      const pieces = layout(arena, kind, site);
      if (pieces.every((piece, index) => !placementProblem(arena, piece, pieces.slice(0, index), actor) && siteIsSafe(arena, piece, 14))) {
        return { kind, site, pieces, next: 0 };
      }
    }
  }
  return null;
}

function missingMaterial(arena, actor, piece) {
  const recipe = arena.fortRecipe(piece.id);
  return Object.keys(recipe[2]).find(id => (actor.bag[id] || 0) < recipe[2][id]);
}

function materialNear(arena, actor, material, site) {
  let nearest = 23, result = null;
  for (const source of [...arena.map.nodes, ...arena.map.caches, ...arena.dropped]) {
    if (!active(arena, source) || distance(site, source) > 27) continue;
    const canHarvest = (source.type === "tree" && actor.bag.hatchet && (material === "branch" || material === "fiber")) ||
      (source.type === "fiber" && material === "fiber");
    if (!canHarvest && !source.items?.[material]) continue;
    const range = distance(actor, source);
    if (range >= nearest || !siteIsSafe(arena, source, 12)) continue;
    const margin = canHarvest ? Math.min(2, range) : 0;
    const stand = offset(source, 0, -margin, heading(actor, source));
    const point = { ...stand, y: arena.map.heightAt(stand.x, stand.z) };
    if (!arena.lineClear(actor, point) || !arena.map.canOccupy(point.x, point.z, arena.removed)) continue;
    nearest = range;
    result = { source, point };
  }
  return result;
}

export function rivalFortCandidate(arena, actor, { enemy, sound }) {
  const rivalRange = enemy ? distance(actor, enemy) : Infinity;
  if (arena.alive <= 3 || actor.health < 48 || actor.hunger < 36 || actor.hydration < 36 || actor.stamina < 23 ||
      actor.weapon === "fists" || rivalRange < 20 || arena.clock < (actor.nextFortAt || 0) ||
      (sound && ["strike", "shot"].includes(sound.kind) && distance(actor, sound) < 18) ||
      arena.clock - actor.woundedAt < 3 || distance(actor, arena.storm) < 17) return null;

  const inclination = fortPreference(arena, actor);
  let work = actor.fortWork;
  if (work && (!siteIsSafe(arena, work.site, 12) || (!work.next && distance(actor, work.site) > 14))) {
    work = actor.fortWork = null;
  }
  if (actor.campFrame && active(arena, actor.campFrame)) return null;
  const post = !enemy && fortPost(arena, actor);
  if (post && (!work || work.next >= work.pieces.length)) return post;
  if (work && (work.next >= work.pieces.length || distance(actor, work.site) > 29)) return null;
  if (!work) {
    if (inclination < 0.69 && (actor.health > 72 || inclination < 0.36)) return null;
    const ranged = ["bow", "sling", "crossbow"].includes(actor.weapon);
    const plans = inclination > 0.94 && actor.bag.scrap && (actor.bag.branch ?? 0) >= 5 ? ["stronghold"] : [];
    if (inclination > 0.8 && ranged && ((actor.bag.branch ?? 0) >= 3 || actor.bag.hatchet)) plans.push("lookout");
    if (inclination > 0.77 && ((actor.bag.branch ?? 0) >= 2 || actor.bag.hatchet)) plans.push("camp");
    plans.push("hide");
    for (const kind of plans) {
      work = constructionSite(arena, actor, kind);
      if (work) break;
    }
    if (!work) {
      actor.nextFortAt = arena.clock + 8;
      return null;
    }
    actor.fortWork = work;
  }

  const piece = work.pieces[work.next];
  if (piece.supports.length && !piece.supports.some(support => active(arena, support))) return null;
  const material = missingMaterial(arena, actor, piece);
  const gathering = material ? materialNear(arena, actor, material, work.site) : null;
  if (material && !gathering) {
    if (!work.next) {
      actor.fortWork = null;
      actor.nextFortAt = arena.clock + 4;
    }
    return null;
  }
  const point = gathering?.point || work.stand || work.site;
  const score = 31 + inclination * 13 + (work.next ? 5 : 0) + (actor.health < 72 ? 4 : 0) -
    (gathering ? 3 : 0) - (enemy ? 5 : 0);
  return { target: { ...point, fortWork: work, gathering }, score };
}

function fortPost(arena, actor) {
  const usingPost = actor.target?.post;
  if (!usingPost && arena.clock - (actor.lastFortWatch ?? -Infinity) < 32) return null;
  const ranged = actor.weapon === "bow" ? actor.bag.arrows : actor.weapon === "crossbow" ? actor.bag.bolts :
    actor.weapon === "sling" ? actor.bag.stone : 0;
  let nearest = 13, post = null;
  for (const piece of arena.pieces) {
    if (!piece.fortKind || !active(arena, piece) || !siteIsSafe(arena, piece, 15)) continue;
    if (usingPost && usingPost.piece !== piece) continue;
    let target;
    if (piece.id === "floor" && ranged) {
      target = { x: piece.x, y: top(piece), z: piece.z };
      if (rivalFortApproach(arena, actor, target) === target && Math.abs(actor.y - target.y) > 0.45) continue;
    } else if (piece.id === "wall" && actor.health < 72) {
      const side = local(piece, actor.x, actor.z)[1] <= 0 ? -1 : 1;
      target = { ...offset(piece, 0, side), y: piece.y };
      if (!arena.canOccupy(target.x, target.z) || !arena.lineClear(actor, target)) continue;
    } else continue;
    const range = distance(actor, target);
    if (range >= nearest || arena.actors.some(other => other !== actor && other.alive &&
        Math.abs(other.y - target.y) < 1 && distance(other, target) < 2.1)) continue;
    post = { ...target, post: { piece, face: piece.angle } };
    nearest = range;
  }
  return post ? { target: post, score: 43 - nearest * 0.3 } : null;
}

function placementVisible(arena, actor, piece) {
  const height = piece.id === "floor" || piece.id === "ramp" ? top(piece) : piece.y + piece.h * 0.7;
  const sightPoint = { ...piece, y: height - 0.55 };
  return arena.lineClear(actor, sightPoint, piece.supports);
}

function workStand(arena, actor, piece) {
  const facing = heading(piece, actor);
  let nearest = Infinity, best = null;
  for (const turn of [0, 0.6, -0.6, QUARTER, -QUARTER, Math.PI]) {
    const point = offset(piece, 0, 2.15, facing + turn);
    const y = arena.map.heightAt(point.x, point.z);
    const stand = { ...point, y };
    const range = distance(actor, stand);
    if (range >= nearest || !arena.canOccupy(point.x, point.z, undefined, { ...actor, ...stand }) ||
        fortFootprint(piece, point.x, point.z, 0.32) || !placementVisible(arena, stand, piece)) continue;
    nearest = range;
    best = stand;
  }
  return best;
}

function workMove(arena, actor, point, seconds) {
  const before = distance(actor, point);
  const yaw = heading(actor, point);
  for (const turn of [0, 0.55, -0.55, 1.1, -1.1]) {
    actor.yaw = yaw + turn;
    const probe = offset(actor, 0, 0.46, actor.yaw);
    if (!arena.canOccupy(probe.x, probe.z, undefined, actor)) continue;
    arena.move(actor, 0, 1, seconds, 2.8);
    break;
  }
  return before - distance(actor, point) > seconds * 0.45;
}

export function stepRivalFort(arena, actor, seconds) {
  if (actor.target?.post) {
    const target = actor.target;
    if (distance(actor, target) > 0.73 || Math.abs(actor.y - target.y) > 0.45) {
      const path = rivalFortApproach(arena, actor, target);
      actor.fortVisitStuck = workMove(arena, actor, path, seconds) ? 0 : (actor.fortVisitStuck || 0) + seconds;
      if (actor.fortVisitStuck < 2) return;
    } else {
      actor.fortVisitUntil ??= arena.clock + 4.5;
      actor.yaw = target.post.face + Math.sin(arena.clock * 1.4) * 1.3;
      actor.crouch = true;
      if (arena.clock < actor.fortVisitUntil) return;
    }
    actor.lastFortWatch = arena.clock;
    actor.fortVisitUntil = null;
    actor.fortVisitStuck = 0;
    actor.target = null;
    actor.decision = 0;
    return;
  }
  const work = actor.target?.fortWork;
  if (!work || actor.fortWork !== work || !siteIsSafe(arena, work.site, 10)) return;
  actor.speed = 0;
  const piece = work.pieces[work.next];
  const stop = () => { actor.target = null; actor.decision = 0; work.stand = null; work.blockedFor = 0; };
  const gathering = actor.target.gathering;
  if (gathering) {
    const { point, source } = gathering;
    if (!active(arena, source) || !missingMaterial(arena, actor, piece)) return stop();
    if (distance(actor, point) > 0.65) {
      work.blockedFor = workMove(arena, actor, point, seconds) ? 0 : (work.blockedFor || 0) + seconds;
      if (work.blockedFor > 2) { actor.nextFortAt = arena.clock + 6; stop(); }
      return;
    }
    if (arena.clock < (work.nextStroke || 0)) return;
    work.nextStroke = arena.clock + 1.05;
    actor.yaw = heading(actor, source);
    if (source.items) arena.loot(actor, source);
    else {
      if (source.type === "tree") arena.equipFortTool(actor);
      actor.swing = 0.42;
      arena.harvest(source, actor);
    }
    return stop();
  }

  if (arena.clock < (work.nextStroke || 0)) return;
  work.stand ??= workStand(arena, actor, piece);
  if (!work.stand) { actor.nextFortAt = arena.clock + 8; stop(); return; }
  const canPlace = distance(actor, piece) <= BUILD_REACH && !actorOverlaps(piece, actor) && placementVisible(arena, actor, piece);
  if (!canPlace && distance(actor, work.stand) > 0.35) {
    work.blockedFor = workMove(arena, actor, work.stand, seconds) ? 0 : (work.blockedFor || 0) + seconds;
    if (work.blockedFor > 2) { actor.nextFortAt = arena.clock + 8; stop(); }
    return;
  }
  if (!canPlace || missingMaterial(arena, actor, piece) || placementProblem(arena, piece, [], actor)) {
    actor.nextFortAt = arena.clock + 5;
    return stop();
  }
  actor.yaw = heading(actor, piece);
  actor.swing = 0.4;
  arena.installPiece(actor, arena.fortRecipe(piece.id), piece);
  work.next++;
  work.nextStroke = arena.clock + 1.15;
  stop();
}

export function rivalFortApproach(arena, actor, target) {
  if (target.y == null || target.y - actor.y < 0.45 || distance(actor, target) > 20) return target;
  let best = null, shortest = 18;
  for (const piece of arena.pieces) {
    if (piece.id !== "ramp" || !active(arena, piece) || Math.abs(top(piece) - target.y) > 0.85) continue;
    const lip = { ...offset(piece, 0, piece.d / 2 + 0.45), y: top(piece) };
    if (distance(lip, target) > 5.8) continue;
    const [u, v] = local(piece, actor.x, actor.z);
    if (Math.abs(u) < piece.w * 0.5 && v > -piece.d * 0.5 - 0.75 && v < piece.d * 0.5 + 0.45) return lip;
    const foot = { ...offset(piece, 0, -piece.d / 2 - 0.45), y: piece.y };
    const travel = distance(actor, foot);
    if (travel >= shortest || !arena.lineClear(actor, foot)) continue;
    shortest = travel;
    best = foot;
  }
  return best || target;
}

export function rivalFortDescent(arena, actor, target) {
  const ground = arena.map.heightAt(actor.x, actor.z);
  if (actor.y < ground + 0.45 || (target.y ?? arena.map.heightAt(target.x, target.z)) > actor.y - 0.45) return target;
  let closest = 5.8, route = target;
  for (const ramp of arena.pieces) {
    if (ramp.id !== "ramp" || !active(arena, ramp)) continue;
    const foot = offset(ramp, 0, -ramp.d / 2 - 0.55);
    const [u, v] = local(ramp, actor.x, actor.z);
    if (Math.abs(u) < ramp.w / 2 && v <= ramp.d / 2 + 0.15 && v >= -ramp.d / 2 - 0.15) return foot;
    const lip = { ...offset(ramp, 0, ramp.d / 2 - 0.09), y: top(ramp) };
    const range = distance(actor, lip);
    if (Math.abs(actor.y - top(ramp)) > 0.5 || range >= closest || !arena.lineClear(actor, lip, [ramp])) continue;
    route = lip;
    closest = range;
  }
  return route;
}
