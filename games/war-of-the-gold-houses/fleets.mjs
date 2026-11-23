import { HOUSES, PLANETS, REGIONS, SHIPS } from './content.mjs';

const LANDING_TIME = { spaceport: 2.4, rain: 4.6 };
const SHIP_HULL = { transport: 11, corvette: 10, destroyer: 19, battleship: 42, carrier: 25, assault: 20 };
const SCREEN_ORDER = ['corvette', 'destroyer', 'battleship', 'assault', 'carrier', 'transport'];
const LINE_ORDER = ['destroyer', 'battleship', 'corvette', 'assault', 'carrier', 'transport'];
const EXPOSED_ORDER = ['transport', 'carrier', 'assault', 'corvette', 'destroyer', 'battleship'];
const result = (ok, message) => ({ ok, message });
const hasEscort = (fleet) => Object.entries(fleet.ships).some(([type, count]) => type !== 'transport' && count > 0);

export function fleetCapacity(fleet) {
  return Object.entries(fleet.ships).reduce((total, [type, count]) => total + (SHIPS[type]?.capacity ?? 0) * count, 0);
}

export function fleetPower(fleet, state) {
  const raw = Object.entries(fleet.ships).reduce((total, [type, count]) => total + (SHIPS[type]?.power ?? 0) * count, 0);
  const port = state && fleet.regionId ? regionAt(state, fleet.regionId) : null;
  const crew = fleet.blueCrew || (port?.operations?.blue ?? 0) > (state?.elapsed ?? 0) ? 1.22 : 1;
  return raw * (HOUSES[fleet.houseId]?.bonus.fleetPower ?? 1) * crew;
}

function operationalWorld(state, planetId) {
  return Object.keys(state.planets[planetId]?.regions ?? {}).length > 0;
}

function regionAt(state, regionId) {
  return state.planets[REGIONS[regionId]?.planetId]?.regions[regionId];
}

function validPort(region) {
  return Boolean(region && (region.buildings.spaceport ?? 0) > 0);
}

function hostilePort(state, houseId, region, helpers) {
  return Boolean(region?.owner && helpers.hostile(state, houseId, region.owner));
}

function dockablePort(state, planetId, houseId, helpers) {
  const regions = Object.values(state.planets[planetId]?.regions ?? {});
  return regions.find(region => validPort(region) && region.owner === houseId)
    ?? regions.find(region => validPort(region) && helpers.friendly?.(state, houseId, region.owner))
    ?? null;
}

function routeTime(fleet, to) {
  const start = PLANETS[fleet.planetId];
  const end = PLANETS[to];
  const distance = Math.hypot(start.x - end.x, start.y - end.y);
  const factor = Math.max(0.8, ...Object.entries(fleet.ships)
    .filter(([, count]) => count > 0)
    .map(([type]) => SHIPS[type]?.travelModifier ?? 1));
  const house = HOUSES[fleet.houseId]?.bonus.travelDuration ?? 1;
  return Math.max(5, (7 + distance * 31) * factor * house * (fleet.blueCrew ? 0.82 : 1));
}

function visibleNotice(state, fleet, other, message, helpers) {
  if (fleet.houseId === state.houseId || other?.houseId === state.houseId || !state.houseId) {
    helpers.notify(state, message);
  }
}

function launch(state, fleet, to, regionId, direction) {
  if (fleet.regionId) {
    fleet.lastPort = { planetId: fleet.planetId, regionId: fleet.regionId };
    const source = regionAt(state, fleet.regionId);
    fleet.blueCrew = (source?.operations?.blue ?? 0) > state.elapsed;
  }
  fleet.transit = {
    from: fleet.planetId,
    to,
    elapsed: 0,
    duration: routeTime(fleet, to),
    landing: direction,
    regionId,
  };
  fleet.regionId = null;
  fleet.landing = null;
  fleet.blockading = false;
  fleet.lastArrival = null;
}

export function transportSupplyCost(state, army, landing) {
  const size = army.squads.filter(squad => squad.soldiers > 0).length;
  const port = regionAt(state, army.regionId);
  const blueCrew = (port?.operations?.blue ?? 0) > state.elapsed;
  return Math.max(1, Math.ceil(2 + size / 2 + (landing === 'rain' ? 3 : 0) - (blueCrew ? 2 : 0)));
}

export function quoteTransport(state, houseId, action, helpers) {
  const army = state.armies[action.armyId];
  const landing = action.landing ?? 'spaceport';
  const cost = army ? { supplies: transportSupplyCost(state, army, landing) } : {};
  const unavailable = (reason) => ({ eligible: false, reason, cost });
  if (state.mode !== 'grand') return unavailable('Orbital transfers are available in Grand Conquest.');
  if (!army || army.houseId !== houseId || army.destroyed) return unavailable('Select an available army.');
  if (army.fleetId || army.transit || army.battleId) return unavailable('That army is already deployed.');
  const from = regionAt(state, army.regionId);
  if (!validPort(from) || (from.owner !== houseId && !helpers.friendly?.(state, houseId, from.owner))) {
    return unavailable('March the army to a friendly spaceport to embark.');
  }

  const { planetId, regionId } = action;
  const target = regionAt(state, regionId);
  if (!operationalWorld(state, planetId) || REGIONS[regionId]?.planetId !== planetId || planetId === army.planetId || !target) {
    return unavailable('Choose a landing region on another world.');
  }
  if (!Object.hasOwn(LANDING_TIME, landing)) return unavailable('Choose a spaceport landing or an Iron Rain.');
  if (landing === 'spaceport' && (!validPort(target) || hostilePort(state, houseId, target, helpers))) {
    return unavailable('A conventional landing requires a nonhostile spaceport.');
  }

  const size = army.squads.filter(squad => squad.soldiers > 0).length;
  if (!size) return unavailable('That army has no squads to embark.');
  const available = Object.values(state.fleets).filter(fleet => fleet.houseId === houseId
    && fleet.planetId === army.planetId && fleet.regionId === army.regionId && !fleet.armyId
    && !fleet.transit && !fleet.engagement && !fleet.landing && (!action.fleetId || fleet.id === action.fleetId));
  if (!available.length) return unavailable('Dock a fleet at this spaceport to embark the army.');
  const capacious = available.filter(fleet => fleetCapacity(fleet) >= size);
  if (!capacious.length) {
    const capacity = Math.max(...available.map(fleetCapacity));
    return unavailable(`Transport capacity ${capacity}/${size} squads. Build transports or split the army.`);
  }
  const fleet = capacious.find(candidate => landing === 'spaceport' || candidate.ships.assault > 0);
  if (!fleet) return unavailable('Iron Rain requires an assault ship.');

  if ((state.resources[houseId]?.supplies ?? 0) < cost.supplies) return unavailable(`Embarkation needs ${cost.supplies} Supplies.`);
  return { eligible: true, reason: '', cost, army, fleet, landing };
}

export function transport(state, houseId, action, helpers) {
  const { eligible, reason, cost, army, fleet, landing } = quoteTransport(state, houseId, action, helpers);
  if (!eligible) return result(false, reason);
  const { planetId, regionId } = action;
  state.resources[houseId].supplies -= cost.supplies;
  fleet.armyId = army.id;
  army.fleetId = fleet.id;
  army.regionId = null;
  army.orders = [];
  launch(state, fleet, planetId, regionId, landing);
  visibleNotice(state, fleet, null, `${fleet.name} launched for ${PLANETS[planetId].name}.`, helpers);
  return result(true, `${army.name} embarked aboard ${fleet.name}.`);
}

export function sail(state, houseId, action, helpers) {
  if (state.mode !== 'grand') return result(false, 'Fleet travel is available in Grand Conquest.');
  const fleet = state.fleets[action.fleetId];
  if (!fleet || fleet.houseId !== houseId) return result(false, 'Select one of your fleets.');
  if (fleet.transit || fleet.engagement) return result(false, 'The fleet is underway or engaged.');
  const { planetId } = action;
  if (!operationalWorld(state, planetId)) return result(false, 'Select a reachable world.');
  const port = dockablePort(state, planetId, houseId, helpers);
  if (fleet.armyId && !port) return result(false, 'Divert an embarked army to a friendly spaceport.');
  if (planetId === fleet.planetId) {
    if (!port || fleet.regionId === port.id) return result(false, 'The fleet is already at this world.');
    fleet.regionId = null;
    fleet.blockading = false;
    beginLanding(fleet, port.id, 'spaceport');
  } else {
    launch(state, fleet, planetId, port?.id ?? null, port ? 'spaceport' : null);
  }
  return result(true, `${fleet.name} set course for ${PLANETS[planetId].name}.`);
}

function near(a, b) {
  if (!a.transit && !b.transit) return a.planetId === b.planetId;
  if (!a.transit || !b.transit) return false;
  const left = a.transit;
  const right = b.transit;
  const progress = left.elapsed / left.duration;
  const otherProgress = right.elapsed / right.duration;
  if (left.from === right.to && left.to === right.from) return Math.abs(progress + otherProgress - 1) <= 0.055;
  return left.from === right.from && left.to === right.to && Math.abs(progress - otherProgress) <= 0.04;
}

function canEngage(state, fleet, opponent, helpers, manual = false) {
  return fleet !== opponent && fleet.houseId !== opponent.houseId && !fleet.engagement && !opponent.engagement
    && (fleet.evasionUntil ?? 0) <= state.elapsed && (opponent.evasionUntil ?? 0) <= state.elapsed
    && helpers.hostile(state, fleet.houseId, opponent.houseId) && near(fleet, opponent)
    && (!fleet.regionId || manual) && !opponent.regionId
    && (hasEscort(fleet) || hasEscort(opponent));
}

function openCombat(state, fleet, opponent, helpers) {
  if (fleet.regionId) fleet.lastPort = { planetId: fleet.planetId, regionId: fleet.regionId };
  fleet.regionId = null;
  opponent.regionId = null;
  for (const [acting, reacting] of [[fleet, opponent], [opponent, fleet]]) {
    acting.engagement = {
      opponentId: reacting.id,
      elapsed: 0,
      stance: acting.armyId ? 'screen' : 'advance',
      ordered: false,
    };
  }
  const location = fleet.transit ? `${PLANETS[fleet.transit.from].name} lane` : `${PLANETS[fleet.planetId].name} orbit`;
  visibleNotice(state, fleet, opponent, `${location}: ${fleet.name} engaged ${opponent.name}.`, helpers);
}

export function fleetOrder(state, houseId, action, helpers) {
  const fleet = state.fleets[action.fleetId];
  if (!fleet || fleet.houseId !== houseId) return result(false, 'Select one of your fleets.');
  if (!['advance', 'screen', 'withdraw'].includes(action.stance)) return result(false, 'Select a fleet command.');
  if (action.targetId && !fleet.engagement) {
    const opponent = state.fleets[action.targetId];
    if (!opponent || !canEngage(state, fleet, opponent, helpers, true)) {
      return result(false, 'That fleet is outside interception range.');
    }
    openCombat(state, fleet, opponent, helpers);
  }
  if (!fleet.engagement) return result(false, 'This fleet has no active engagement.');
  if (fleet.engagement.stance !== action.stance) fleet.engagement.withdrawTime = 0;
  fleet.engagement.stance = action.stance;
  fleet.engagement.ordered = true;
  return result(true, `${fleet.name}: ${action.stance}.`);
}

export function blockade(state, houseId, action, helpers) {
  const fleet = state.fleets[action.fleetId];
  if (!fleet || fleet.houseId !== houseId || fleet.transit || fleet.landing || fleet.armyId || fleet.engagement) {
    return result(false, 'Use an idle fleet in orbit to set up a blockade.');
  }
  if (!hasEscort(fleet)) return result(false, 'A blockade requires combat ships.');
  if (fleet.blockading) {
    fleet.blockading = false;
    const port = dockablePort(state, fleet.planetId, houseId, helpers);
    if (port) beginLanding(fleet, port.id, 'spaceport');
    return result(true, `${fleet.name} lifted the blockade.`);
  }
  if (fleet.regionId) {
    fleet.lastPort = { planetId: fleet.planetId, regionId: fleet.regionId };
    fleet.regionId = null;
  }
  fleet.blockading = true;
  return result(true, `${fleet.name} is blockading ${PLANETS[fleet.planetId].name}.`);
}

function takeDamage(fleet, incoming, ownPower) {
  const stance = fleet.engagement.stance;
  const priority = ownPower <= 0 || !hasEscort(fleet) ? EXPOSED_ORDER : stance === 'screen' ? SCREEN_ORDER : LINE_ORDER;
  const defenses = stance === 'screen' ? 0.67 : stance === 'withdraw' ? 1.04 : 1;
  let damage = incoming * defenses;
  fleet.hullDamage ??= {};
  for (const type of priority) {
    if ((fleet.ships[type] ?? 0) <= 0) continue;
    const hull = SHIP_HULL[type];
    const accumulated = (fleet.hullDamage[type] ?? 0) + damage;
    const lost = Math.min(Math.floor(accumulated / hull), fleet.ships[type]);
    fleet.ships[type] -= lost;
    if (fleet.ships[type] > 0) {
      fleet.hullDamage[type] = accumulated - lost * hull;
      break;
    }
    delete fleet.hullDamage[type];
    damage = accumulated - lost * hull;
    if (damage <= 0) break;
  }
}

function cargoLoss(state, fleet, helpers) {
  if (!fleet.armyId) return;
  const army = state.armies[fleet.armyId];
  if (!army) return;
  const survivors = army.squads.filter(squad => squad.soldiers > 0);
  const capacity = fleetCapacity(fleet);
  if (survivors.length <= capacity) return;
  army.squads = survivors.slice(0, capacity);
  const losses = survivors.length - army.squads.length;
  visibleNotice(state, fleet, null, `${army.name} lost ${losses} embarked ${losses === 1 ? 'squad' : 'squads'}.`, helpers);
  if (army.squads.length === 0) abandonArmy(state, fleet);
}

function abandonArmy(state, fleet) {
  const army = state.armies[fleet.armyId];
  if (army) {
    army.squads = [];
    army.fleetId = null;
    army.planetId = null;
    army.regionId = null;
    army.destroyed = true;
  }
  fleet.armyId = null;
}

function destroyFleet(state, fleet, opponent, helpers) {
  if (fleet.armyId) abandonArmy(state, fleet);
  delete state.fleets[fleet.id];
  visibleNotice(state, fleet, opponent, `${fleet.name} was destroyed in orbit.`, helpers);
}

function retreat(state, fleet, helpers) {
  fleet.evasionUntil = state.elapsed + 8;
  fleet.engagement = null;
  if (fleet.transit) {
    const port = fleet.lastPort?.planetId === fleet.transit.from ? fleet.lastPort : null;
    fleet.transit.returning = true;
    fleet.transit.landing = port ? 'spaceport' : null;
    fleet.transit.regionId = port?.regionId ?? null;
    return;
  }

  const fallback = fleet.lastPort && validPort(regionAt(state, fleet.lastPort.regionId))
    && !hostilePort(state, fleet.houseId, regionAt(state, fleet.lastPort.regionId), helpers) ? fleet.lastPort : null;
  if (fallback && fallback.planetId !== fleet.planetId) {
    launch(state, fleet, fallback.planetId, fallback.regionId, 'spaceport');
    return;
  }
  const local = dockablePort(state, fleet.planetId, fleet.houseId, helpers);
  fleet.blockading = false;
  fleet.landing = null;
  if (local) beginLanding(fleet, local.id, 'spaceport');
}

function combat(state, fleet, opponent, dt, helpers) {
  if (!helpers.hostile(state, fleet.houseId, opponent.houseId)) {
    fleet.engagement = opponent.engagement = null;
    return;
  }
  const basePower = fleetPower(fleet, state);
  const enemyPower = fleetPower(opponent, state);
  for (const [side, power, rival] of [[fleet, basePower, enemyPower], [opponent, enemyPower, basePower]]) {
    const engagement = side.engagement;
    engagement.elapsed += dt;
    if (!engagement.ordered && engagement.elapsed > 1.8 && power * 2.1 + 0.1 < rival) engagement.stance = 'withdraw';
    if (engagement.stance === 'withdraw') engagement.withdrawTime = (engagement.withdrawTime ?? 0) + dt;
  }
  const attack = { advance: 1.12, screen: 0.72, withdraw: 0.25 };
  takeDamage(fleet, enemyPower * attack[opponent.engagement.stance] * dt * 0.14, basePower);
  takeDamage(opponent, basePower * attack[fleet.engagement.stance] * dt * 0.14, enemyPower);
  for (const [side, enemy] of [[fleet, opponent], [opponent, fleet]]) {
    cargoLoss(state, side, helpers);
    if (!hasEscort(side)) side.blockading = false;
    if (!Object.values(side.ships).some(count => count > 0)) destroyFleet(state, side, enemy, helpers);
  }
  if (!state.fleets[fleet.id] || !state.fleets[opponent.id]) {
    fleet.engagement = opponent.engagement = null;
    return;
  }
  const retreating = [fleet, opponent].filter(side => (side.engagement.withdrawTime ?? 0) >= 1.8);
  for (const side of retreating) {
    retreat(state, side, helpers);
    visibleNotice(state, side, side === fleet ? opponent : fleet, `${side.name} withdrew from the engagement.`, helpers);
  }
  if (retreating.length) fleet.engagement = opponent.engagement = null;
}

function beginLanding(fleet, regionId, type) {
  fleet.landing = { planetId: fleet.planetId, regionId, type, elapsed: 0, duration: LANDING_TIME[type] };
}

function flight(fleet, dt) {
  const transit = fleet.transit;
  transit.elapsed += transit.returning ? -dt : dt;
  if (transit.returning ? transit.elapsed > 0.000001 : transit.elapsed + 0.000001 < transit.duration) return;
  fleet.planetId = transit.returning ? transit.from : transit.to;
  fleet.transit = null;
  if (transit.regionId && transit.landing) beginLanding(fleet, transit.regionId, transit.landing);
}

function rainLosses(state, fleet, army, region, helpers) {
  if (!hostilePort(state, fleet.houseId, region, helpers)) return;
  const defenses = (region.buildings.fortress ?? 0) * 0.12 + (region.buildings.spaceport ?? 0) * 0.045;
  const escort = fleetPower(fleet, state) * 0.004;
  const leader = (army.commander?.tactical ?? 50) * 0.0009;
  const profile = HOUSES[fleet.houseId]?.bonus.landing ?? 1;
  const risk = Math.min(0.54, Math.max(0.03, (0.13 + defenses - escort - leader) / profile));
  let casualties = 0;
  for (const squad of army.squads) {
    const lost = Math.floor(squad.soldiers * risk);
    squad.soldiers -= lost;
    casualties += lost;
  }
  if (casualties) {
    visibleNotice(state, fleet, null, `${army.name} lost ${casualties} soldiers during the Iron Rain.`, helpers);
  }
}

function land(state, fleet, dt, helpers) {
  const landing = fleet.landing;
  landing.elapsed = Math.min(landing.elapsed + dt, landing.duration);
  if (landing.elapsed + 0.000001 < landing.duration || (landing.retryAt ?? 0) > state.elapsed) return;
  const target = regionAt(state, landing.regionId);
  const closedPort = landing.type === 'spaceport' && (!validPort(target) || hostilePort(state, fleet.houseId, target, helpers));
  const lostAssault = landing.type === 'rain' && (!target || (!(fleet.ships.assault > 0) && !landing.lossesApplied));
  if (closedPort || lostAssault) {
    const port = dockablePort(state, fleet.planetId, fleet.houseId, helpers);
    if (port) beginLanding(fleet, port.id, 'spaceport');
    else {
      fleet.landing = null;
      const reason = lostAssault ? 'No assault ship remains for the Iron Rain.' : 'The landing port is closed.';
      visibleNotice(state, fleet, null, `${fleet.name} is holding in orbit. ${reason}`, helpers);
    }
    return;
  }
  const army = state.armies[fleet.armyId];
  if (army) {
    if (landing.type === 'rain' && !landing.lossesApplied) {
      rainLosses(state, fleet, army, target, helpers);
      landing.lossesApplied = true;
    }
    if (helpers.arrive(state, army, landing.regionId, landing.type) === false) {
      landing.retryAt = state.elapsed + 1;
      return;
    }
    army.fleetId = null;
  }
  fleet.armyId = null;
  fleet.landing = null;
  fleet.regionId = validPort(target) && !hostilePort(state, fleet.houseId, target, helpers) ? landing.regionId : null;
  if (fleet.regionId) fleet.lastPort = { planetId: fleet.planetId, regionId: fleet.regionId };
  fleet.lastArrival = { regionId: landing.regionId, type: landing.type, time: state.elapsed };
  const arrival = landing.type === 'rain' ? 'completed an Iron Rain' : 'landed';
  visibleNotice(state, fleet, null, `${army?.name ?? fleet.name} ${arrival} at ${REGIONS[landing.regionId].name}.`, helpers);
}

export function tickFleets(state, dt, helpers) {
  const fleets = Object.values(state.fleets);
  if (!fleets.length) return;

  for (const fleet of fleets) {
    if (fleet.engagement || !fleet.transit) continue;
    flight(fleet, dt);
  }

  const unengaged = fleets.filter(fleet => !fleet.engagement && !fleet.regionId);
  for (let i = 0; i < unengaged.length; i++) {
    const fleet = unengaged[i];
    if (fleet.engagement) continue;
    for (let j = i + 1; j < unengaged.length; j++) {
      if (!canEngage(state, fleet, unengaged[j], helpers)) continue;
      openCombat(state, fleet, unengaged[j], helpers);
      break;
    }
  }

  const processed = new Set();
  for (const fleet of fleets) {
    if (!fleet.engagement || processed.has(fleet.id) || !state.fleets[fleet.id]) continue;
    const opponent = state.fleets[fleet.engagement.opponentId];
    if (opponent?.engagement?.opponentId !== fleet.id) {
      fleet.engagement = null;
      continue;
    }
    processed.add(fleet.id);
    processed.add(opponent.id);
    combat(state, fleet, opponent, dt, helpers);
  }

  for (const fleet of fleets) {
    if (state.fleets[fleet.id] && !fleet.engagement && fleet.landing && !processed.has(fleet.id)) {
      land(state, fleet, dt, helpers);
    }
  }
}
