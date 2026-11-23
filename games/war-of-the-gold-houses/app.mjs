import { createGame, advance, command, saveGame, loadGame, getSaveSlots, previewRoute, getSupplyStatus } from './game.mjs';
import { HOUSES, PLANETS, REGIONS, BUILDINGS, SHIPS, COLORS, OPERATIONS, DOCTRINES, SKIRMISHES, CAMPAIGN_MODES, RESOURCE_KEYS, RESOURCE_LABELS } from './content.mjs';
import { UNIT_TYPES } from './battle.mjs';
import { fleetCapacity, fleetPower } from './fleets.mjs';
import {
  MAP_WIDTH, MAP_HEIGHT, mapPoint, regionAtPoint, armyPoint, fleetPoint, battlePoint, battleWorldPoint,
  drawSolar, drawPlanet, drawBattle, drawBattleMinimap,
} from './art.mjs';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const map = elements.map;
const ctx = map.getContext('2d');
const mini = elements.minimap.getContext('2d');
const defaultKeys = { attack: 'a', hold: 'h', stop: 's', formation: 'f', ability: 'e', pause: ' ' };
const keyLabels = { attack: 'Attack-move', hold: 'Hold', stop: 'Stop', formation: 'Formation', ability: 'Ability', pause: 'Pause' };
const resourceIcons = { credits: '¢', materials: '◆', supplies: '▦', influence: '✶' };
const formations = ['line', 'column', 'wedge', 'defensive', 'loose'];
const deals = {
  ceasefire: 'Ceasefire', trade: 'Trade', alliance: 'Alliance', access: 'Military access',
  marriage: 'House marriage', concession: 'Demand territory', vassal: 'Demand submission',
  war: 'Declare war', betray: 'Betray pact',
};
const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();

function savedKeys() {
  try { return { ...defaultKeys, ...JSON.parse(storage?.getItem('gold-houses-keys') ?? '{}') }; }
  catch { return { ...defaultKeys }; }
}

const ui = {
  view: 'solar', tab: 'command', houseId: null, planetId: null, regionId: null, battleId: null,
  selectedArmyIds: new Set(), selectedSquadIds: new Set(), selectedFleetId: null,
  showSupply: false, attackMode: false, camera: null, time: 0, orderMarker: null, drag: null,
  selectionBox: null, routePreview: null, details: new Set(), picks: {}, battleViews: {},
  keys: savedKeys(), keyCapture: null, lastGroup: null,
  setup: { mode: 'grand', houseId: 'augustus', planetId: 'mars', terrain: 'basin', enemyHouseId: 'bellona', difficulty: 'standard' },
};
let state = null;
let lastFrame = performance.now();
let lastHud = 0;
let lastAutosave = 0;
let lastClick = null;
let storageUnavailable = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const text = (id, value) => {
  if (elements[id].textContent !== value) elements[id].textContent = value;
};
const html = (id, value) => {
  const element = elements[id];
  if (element.dataset.markup === value) return;
  if (element.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const focus = element.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'
    ? { ...document.activeElement.dataset } : null;
  element.dataset.markup = value;
  element.innerHTML = value;
  if (focus) {
    [...element.querySelectorAll('button')].find(node => Object.keys(focus).every(key => node.dataset[key] === focus[key]))?.focus({ preventScroll: true });
  }
};
const title = value => String(value ?? '').replace(/(^|[-_ ])\w/g, part => part.toUpperCase());
const pct = value => `${Math.max(0, Math.round(value))}%`;
const currentBattle = () => state?.battles[ui.battleId];
const currentRegion = () => state?.planets[ui.planetId]?.regions[ui.regionId];
const selectedArmies = () => [...ui.selectedArmyIds].map(id => state.armies[id]).filter(Boolean);
const selectedFleet = () => state?.fleets[ui.selectedFleetId];
const tacticalRoster = () => (currentBattle()?.squads ?? []).filter(squad => squad.houseId === state.houseId && squad.soldiers > 0 && !squad.withdrawn);
const activeBattles = () => Object.values(state.battles).filter(battle => battle.winner == null);
const living = squads => squads.reduce((count, squad) => count + squad.soldiers, 0);
const keyName = value => value === ' ' ? 'Space' : value.toUpperCase();
const relationsWith = id => state.relations[[state.houseId, id].sort().join(':')];
const atWar = id => relationsWith(id)?.stance === 'war';
const reachableWorlds = planetId => Object.keys(state.planets).filter(id => id !== planetId && PLANETS[id]?.regionIds?.length);
const slotId = id => id === 'auto' ? id : Number(id);

function formatTime(seconds) {
  const rounded = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function button(label, action, id = '', options = {}) {
  const { disabled = false, pressed, data = {}, title: tooltip, className } = options;
  const attributes = Object.entries(data).map(([key, value]) => ` data-${key}="${esc(value)}"`).join('');
  return `<button type="button" data-action="${esc(action)}"${id ? ` data-id="${esc(id)}"` : ''}${attributes}${disabled ? ' disabled' : ''}${pressed == null ? '' : ` aria-pressed="${Boolean(pressed)}"`}${tooltip ? ` title="${esc(tooltip)}"` : ''}${className ? ` class="${esc(className)}"` : ''}>${label}</button>`;
}

function select(id, choices, value, label, { setup = false } = {}) {
  return `<select ${setup ? 'data-setup' : 'data-pick'}="${esc(id)}" aria-label="${esc(label)}">${choices.map(([key, name]) =>
    `<option value="${esc(key)}"${key === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
}

function details(id, summary, content) {
  return `<details class="panel-details" data-detail="${esc(id)}"${ui.details.has(id) ? ' open' : ''}><summary>${esc(summary)}</summary>${content}</details>`;
}

function row(content, action) { return `<div class="row">${content}${action ?? ''}</div>`; }
function stats(entries) { return `<dl class="stats">${entries.map(([name, value]) => `<dt>${esc(name)}</dt><dd>${value}</dd>`).join('')}</dl>`; }
function houseLabel(id) { return id && HOUSES[id] ? `<span class="house-dot" style="--house-color:${esc(HOUSES[id].color)}"></span>${esc(HOUSES[id].name)}` : 'Unaligned'; }
function unitName(type) { return UNIT_TYPES[type]?.name ?? title(type); }
function namedChoices(entries) { return Object.values(entries).map(entry => [entry.id, entry.name]); }
function resourceCost(cost) { return Object.entries(cost ?? {}).map(([key, quantity]) => `${quantity} ${RESOURCE_LABELS[key] ?? key}`).join(', '); }
function showStatus(message, ok = true) {
  text('status', message || '');
  elements.status.classList.toggle('error', !ok);
  if (elements.menu.open) {
    text('menu-status', message || '');
    elements['menu-status'].classList.toggle('error', !ok);
  }
}

function issue(action, { quiet = false } = {}) {
  const result = command(state, action);
  if (!quiet || !result.ok) showStatus(result.message, result.ok);
  refreshHud();
  return result.ok;
}

function rosterDetails(army) {
  const key = `army-${army.id}`;
  const chosen = ui.picks[key] ?? [];
  const roster = army.squads.filter(squad => squad.soldiers > 0);
  return details('roster', `Army roster (${roster.length})`, `
    <div class="roster">${roster.map(squad => button(`${esc(unitName(squad.type))} · ${squad.soldiers}`, 'roster', squad.id, {
      pressed: chosen.includes(squad.id), data: { army: army.id }, title: `${squad.xp ?? 0} experience`,
    })).join('')}</div>
    ${row('', button(chosen.length ? 'Split selected' : 'Split in half', 'split', army.id, { disabled: roster.length < 2 }))}`);
}

function armyPanel(army) {
  const region = REGIONS[army.regionId];
  const supply = getSupplyStatus(state, army.id);
  const supplyLabel = supply.status;
  const combine = Object.values(state.armies).filter(other => other.id !== army.id && other.houseId === state.houseId && other.regionId && other.regionId === army.regionId && !other.battleId && !other.transit && !other.destroyed && !other.fleetId);
  const chosenCombine = ui.picks.combine ?? combine[0]?.id;
  return `<h2>${esc(army.name)}</h2><p class="muted">${houseLabel(army.houseId)}</p>${stats([
    ['Location', esc(army.fleetId ? 'Embarked' : region?.name ?? 'In transit')],
    ['Strength', `${living(army.squads)} troops`], ['Supply', esc(supplyLabel)],
    ['Commander', esc(army.commander?.name ?? 'Field command')],
  ])}${row(select('doctrine', namedChoices(DOCTRINES), army.doctrine, 'Commander doctrine'), button('Assign', 'doctrine', army.id))}
  ${rosterDetails(army)}
  ${combine.length ? row(select('combine', combine.map(other => [other.id, other.name]), chosenCombine, 'Army to combine with'), button('Combine', 'combine', army.id)) : ''}
  ${army.battleId ? row(button('Enter battle', 'battle', army.battleId)) : ''}`;
}

function regionPanel(region) {
  const definition = REGIONS[region.id];
  const friendly = region.owner === state.houseId;
  const allies = Object.values(state.armies).filter(army => army.regionId === region.id && !army.fleetId && !army.destroyed);
  const projects = (state.projects ?? []).filter(project => project.regionId === region.id && project.houseId === state.houseId);
  const active = activeBattles().find(battle => battle.regionId === region.id);
  const recruitTo = selectedArmies().find(army => army.regionId === region.id && army.houseId === state.houseId && !army.battleId && !army.transit)
    ?? allies.find(army => army.houseId === state.houseId && !army.battleId && !army.transit);
  const recruitChoices = Object.entries(UNIT_TYPES).filter(([id, unit]) => ['rifle', 'heavy', 'marksman'].includes(id) || region.buildings.workshop || definition.colors.includes(unit.color.toLowerCase())).map(([id, unit]) => [id, unit.name]);
  const buildingLevel = id => typeof region.buildings[id] === 'number' ? region.buildings[id] : region.buildings[id]?.level ?? 0;
  const rallyChoices = [['', 'Clear rally point'], ...Object.values(state.planets[definition.planetId].regions)
    .filter(other => other.owner === state.houseId && other.id !== region.id).map(other => [other.id, REGIONS[other.id].name])];
  return `<h2>${esc(definition.name)}</h2><p class="muted">${houseLabel(region.owner)} · ${esc(title(definition.terrain))}</p>
    ${definition.description ? `<p class="hint">${esc(definition.description)}</p>` : ''}
    ${active ? row(button('Enter battle', 'battle', active.id, { className: 'primary' })) : ''}
    ${allies.map(army => row(`<span class="hint">${houseLabel(army.houseId)} · ${living(army.squads)} troops</span>`, button(esc(army.name), 'army', army.id))).join('')}
    ${friendly ? details('development', 'Develop territory', Object.values(BUILDINGS).filter(building => state.mode === 'grand' || building.id !== 'spaceport').map(building => {
      const level = buildingLevel(building.id);
      return row(`<span class="hint">${esc(building.name)} · ${level}</span>`, button(level ? 'Upgrade' : 'Build', 'build', building.id, {
        disabled: level >= building.maxLevel, data: { region: region.id }, title: `${building.role} (${resourceCost(Object.fromEntries(Object.entries(building.cost).map(([key, value]) => [key, value * (level + 1)])))})`,
      }));
    }).join('')) : ''}
    ${friendly && buildingLevel('barracks') ? details('recruitment', 'Recruitment and rally', `
      ${recruitTo ? row(select('recruit', recruitChoices, ui.picks.recruit ?? 'rifle', 'Unit to recruit'), button('Recruit', 'recruit', recruitTo.id)) : ''}
      ${recruitTo ? row(button('Replenish squads', 'replenish', recruitTo.id, { disabled: recruitTo.squads.every(squad => squad.soldiers >= UNIT_TYPES[squad.type].maxSoldiers && !squad.wounds) })) : ''}
      ${row(select('rally', rallyChoices, ui.picks.rally ?? region.rally ?? '', 'Rally destination'), button('Set rally', 'rally', region.id))}
      ${row(select('dispatch', recruitChoices, ui.picks.dispatch ?? 'rifle', 'Unit to dispatch'), button('Dispatch', 'dispatch', region.id, { disabled: !region.rally, title: 'Recruit and send to the assigned rally point' }))}
    `) : ''}
    ${friendly && buildingLevel('spaceport') && state.mode === 'grand' ? details('shipyard', 'Shipyard', Object.values(SHIPS).map(ship => row(
      `<span class="hint">${esc(ship.name)}</span>`, button('Build', 'ship', ship.id, { disabled: buildingLevel('spaceport') < ship.level, data: { region: region.id }, title: `${ship.role} (${resourceCost(ship.cost)})` }),
    )).join('')) : ''}
    ${projects.length ? `<h3>In progress</h3>${stats(projects.map(project => [BUILDINGS[project.item]?.name ?? SHIPS[project.item]?.name ?? unitName(project.item), formatTime(Math.ceil(project.remaining))]))}` : ''}`;
}

function solarPanel() {
  const planet = PLANETS[ui.planetId];
  const record = state.planets[ui.planetId];
  const fleet = selectedFleet();
  const strategicArmies = Object.values(state.armies).filter(army => army.houseId === state.houseId && !army.fleetId && !army.battleId && !army.transit && !army.destroyed && army.regionId);
  const chosenArmy = strategicArmies.find(army => army.id === ui.picks.transportArmy) ?? selectedArmies().find(army => strategicArmies.includes(army)) ?? strategicArmies[0];
  const destinations = chosenArmy ? reachableWorlds(chosenArmy.planetId) : [];
  const destination = destinations.includes(ui.picks.transportPlanet) ? ui.picks.transportPlanet : destinations[0];
  const landingMethod = ui.picks.transportLanding ?? 'spaceport';
  const dropSites = Object.values(state.planets[destination]?.regions ?? {}).filter(region => landingMethod === 'rain' || (region.buildings.spaceport && !atWar(region.owner)));
  const drop = dropSites.find(region => region.id === ui.picks.transportSite)?.id ?? dropSites[0]?.id;
  const availableFleets = Object.values(state.fleets).filter(ship => (ship.transit?.to ?? ship.planetId) === planet?.id);
  return `${planet ? `<h2>${esc(planet.name)}</h2><p class="hint">${esc(planet.description)}</p>` : '<h2>Solar System</h2>'}
    ${record && planet.regionIds.length ? row(button('Open territories', 'planet', planet.id, { className: 'primary' })) : ''}
    ${record && planet.regionIds.length ? stats([
      ['Territories', Object.keys(record.regions).length],
      ['Our territories', Object.values(record.regions).filter(region => region.owner === state.houseId).length],
      ['Active battles', activeBattles().filter(battle => battle.planetId === planet.id).length],
    ]) : ''}
    ${availableFleets.length ? `<h3>Fleets</h3>${availableFleets.map(ship => row(button(`${houseLabel(ship.houseId)} ${esc(ship.name ?? title(ship.id))}`, 'fleet', ship.id, { pressed: ship.id === ui.selectedFleetId }))).join('')}` : ''}
    ${fleet ? fleetPanel(fleet) : ''}
    ${chosenArmy && destinations.length ? details('transport', 'Transport an army', `
      ${row(select('transportArmy', strategicArmies.map(army => [army.id, army.name]), chosenArmy.id, 'Army for transport'))}
      ${row(select('transportPlanet', destinations.map(id => [id, PLANETS[id].name]), destination, 'Destination world'))}
      ${row(select('transportSite', dropSites.map(region => [region.id, REGIONS[region.id].name]), drop, 'Landing site'))}
      ${row(select('transportLanding', [['spaceport', 'Spaceport landing'], ['rain', 'Iron Rain']], landingMethod, 'Landing method'),
        button('Launch', 'transport', chosenArmy.id, { disabled: !drop, data: { planet: destination, region: drop } }))}
      <p class="hint">Move the army to a friendly spaceport before launch. Iron Rain can reach hostile territory.</p>
    `) : ''}`;
}

function fleetPanel(fleet) {
  const own = fleet.houseId === state.houseId;
  const target = fleet.engagement && state.fleets[fleet.engagement.opponentId];
  const trip = fleet.transit;
  const landing = fleet.landing;
  const berth = trip ? `${PLANETS[trip.from]?.name ?? 'Orbit'} ${trip.returning ? '←' : '→'} ${PLANETS[trip.to]?.name ?? 'Orbit'}` : PLANETS[fleet.planetId]?.name ?? 'Deep space';
  const destinationChoices = reachableWorlds(fleet.planetId).map(id => [id, PLANETS[id].name]);
  const localPort = Object.values(state.planets[fleet.planetId]?.regions ?? {}).find(region => region.buildings.spaceport && (region.owner === state.houseId || ['alliance', 'vassal'].includes(relationsWith(region.owner)?.stance)));
  if (!fleet.regionId && localPort) destinationChoices.unshift([fleet.planetId, `Dock at ${REGIONS[localPort.id].name}`]);
  const targets = Object.values(state.fleets).filter(other => atWar(other.houseId) && !other.regionId && !other.transit && !other.engagement && other.planetId === fleet.planetId);
  return `<hr><h2>${esc(fleet.name ?? title(fleet.id))}</h2>${stats([
    ['House', houseLabel(fleet.houseId)], ['Location', esc(berth)],
    ['Hull power', `${Math.round(fleetPower(fleet, state))}`], ['Capacity', `${fleetCapacity(fleet)} squads`],
    ['Passengers', esc(state.armies[fleet.armyId]?.name ?? 'None')],
    ...Object.entries(fleet.ships).filter(([, count]) => count > 0).map(([id, count]) => [SHIPS[id]?.name ?? title(id), count]),
    ...(trip ? [['Arrival', formatTime(Math.ceil(trip.returning ? trip.elapsed : trip.duration - trip.elapsed))]] : []),
    ...(landing ? [['Landing', `${landing.type === 'rain' ? 'Iron Rain' : 'Spaceport'} · ${formatTime(Math.ceil(landing.duration - landing.elapsed))}`]] : []),
    ...(target ? [['Engaged', esc(target.name ?? target.id)], ['Enemy hull power', `${Math.round(fleetPower(target, state))}`]] : []),
  ])}${own && target ? `<div class="toolbar">${[
    ['advance', 'Press attack'], ['screen', 'Screen'], ['withdraw', 'Withdraw'],
  ].map(([stance, label]) => button(label, 'fleet-order', fleet.id, { data: { stance }, pressed: fleet.engagement.stance === stance })).join('')}</div>` : ''}
  ${own && !trip && !landing && !target && destinationChoices.length ? row(select('sail', destinationChoices, ui.picks.sail ?? destinationChoices[0][0], 'Fleet destination'), button('Set course', 'sail', fleet.id)) : ''}
  ${own && !trip && !landing && !target && targets.length ? row(select('intercept', targets.map(other => [other.id, other.name ?? other.id]), ui.picks.intercept ?? targets[0].id, 'Fleet to intercept'), button('Intercept', 'intercept', fleet.id)) : ''}
  ${own && !trip && !landing && !target && !fleet.armyId ? row(button(fleet.blockading ? 'End blockade' : 'Blockade orbit', 'blockade', fleet.id, { pressed: Boolean(fleet.blockading) })) : ''}`;
}

function politicsPanel() {
  const houses = Object.values(HOUSES).filter(house => house.id !== state.houseId);
  const active = HOUSES[ui.picks.politicalHouse] ?? houses[0];
  const relation = relationsWith(active.id);
  const territoryChoices = Object.values(state.planets).flatMap(planet => Object.values(planet.regions))
    .filter(region => region.owner === active.id).map(region => [region.id, REGIONS[region.id].name]);
  const stateLabel = title(relation?.stance ?? 'Neutral');
  return `<h2>House politics</h2>${row(select('politicalHouse', namedChoices(Object.fromEntries(houses.map(house => [house.id, house]))), active.id, 'House'))}
    <p class="hint">${esc(active.description)}</p>${stats([['Relations', esc(stateLabel)], ['Trust', pct(relation?.trust ?? 0)], ['Pacts', esc(['trade', 'access', 'marriage'].filter(id => relation?.[id]).map(title).join(' · ') || 'None')], ['Doctrine', esc(title(active.doctrine))]])}
    ${row(select('deal', Object.entries(deals), ui.picks.deal ?? 'ceasefire', 'Agreement'), button('Propose', 'diplomacy', active.id))}
    ${ui.picks.deal === 'concession' && territoryChoices.length ? row(select('concession', territoryChoices, ui.picks.concession ?? territoryChoices[0][0], 'Territory concession')) : ''}`;
}

function colorsPanel() {
  const region = currentRegion();
  const colors = region && REGIONS[region.id]?.colors;
  return `<h2>Color specialists</h2><p class="hint">${region?.owner === state.houseId ? `Available operations in ${esc(REGIONS[region.id].name)} depend on its specialists.` : 'Select one of your territories to use its Color specialists.'}</p>
    ${Object.values(COLORS).map(color => {
      const present = Array.isArray(colors) ? colors.includes(color.id) : Number(colors?.[color.id]) > 0;
      const operation = OPERATIONS[color.id];
      const ready = region?.owner === state.houseId && present && operation;
      let targets = null;
      if (ready && operation.target === 'hostile') {
        const ids = color.id === 'pink' ? Object.values(state.planets).flatMap(planet => Object.keys(planet.regions)) : REGIONS[region.id].neighbors;
        targets = ids.filter(id => {
          const owner = state.planets[REGIONS[id].planetId]?.regions[id]?.owner;
          return atWar(owner) || (owner === null && color.id === 'red');
        }).map(id => [id, REGIONS[id].name]);
      }
      if (ready && operation.target === 'rival') targets = Object.values(HOUSES).filter(house => house.id !== state.houseId).map(house => [house.id, house.name]);
      return details(`color-${color.id}`, `${color.name} · ${color.role}`, `<p class="hint">${esc(color.mechanic)}</p>
        ${ready ? `<p class="hint">${esc(operation.description)} ${esc(resourceCost(operation.cost))}${operation.duration ? ` · ${formatTime(operation.duration)}` : ''}</p>
          ${targets?.length ? row(select(`operation-${color.id}`, targets, ui.picks[`operation-${color.id}`] ?? targets[0][0], 'Operation target')) : ''}
          ${row(button(esc(operation.name), 'operation', color.id, { disabled: targets?.length === 0, data: { region: region.id } }))}` : ''}`);
    }).join('')}`;
}

function battleSituation(battle) {
  const strength = {};
  for (const squad of battle.squads.filter(squad => !squad.withdrawn)) {
    strength[squad.houseId] = (strength[squad.houseId] ?? 0) + squad.soldiers;
  }
  return Object.entries(strength);
}

function battlePanel(battle) {
  const selected = battle.squads.filter(squad => ui.selectedSquadIds.has(squad.id));
  return `<h2>${esc(battle.name)}</h2><p class="muted">${esc(PLANETS[battle.planetId]?.name ?? 'Skirmish')} · ${formatTime(battle.elapsed)}</p>
    ${stats(battleSituation(battle).map(([id, strength]) => [HOUSES[id]?.name ?? id, `${strength} troops`]))}
    ${battle.winner != null ? `<p class="hint">${battle.winner === 'draw' ? 'Battle ended in a draw.' : `${houseLabel(battle.winner)} won.`}</p>` : ''}
    ${selected.map(squad => `<h3>${esc(unitName(squad.type))}</h3>${stats([
      ['Soldiers', `${squad.soldiers} / ${squad.maxSoldiers}`], ['Morale', pct(squad.morale ?? 100)],
      ['Health', pct(100 * squad.hp / (squad.maxHp || 1))],
      ['Experience', String(squad.xp ?? 0)], ['Formation', esc(title(squad.formation))],
      ['Order', esc(title(squad.orders?.[0]?.type ?? 'Ready'))],
    ])}`).join('')}
    ${battle.winner == null && tacticalRoster().length ? row(button('Order retreat', 'retreat', battle.id, { title: 'Withdraw your remaining squads from this battle' })) : ''}`;
}

function theaterPanel() {
  const selected = selectedArmies();
  const region = currentRegion();
  const world = PLANETS[ui.planetId];
  if (selected.length === 1 && selected[0].regionId === region?.id) return `${armyPanel(selected[0])}<hr>${regionPanel(region)}`;
  if (selected.length > 1) return `<h2>${selected.length} armies selected</h2><p class="hint">Right-click a destination to march together. Hold Shift to queue waypoints.</p>
    ${selected.map(army => row(button(esc(army.name), 'army', army.id))).join('')}${region ? `<hr>${regionPanel(region)}` : ''}`;
  if (region) return regionPanel(region);
  const own = Object.values(state.armies).filter(army => army.houseId === state.houseId && army.planetId === ui.planetId && !army.fleetId && !army.destroyed);
  return `<h2>${esc(world?.name ?? 'Planetary map')}</h2><p class="hint">Select a territory to inspect it, or choose an army to issue orders.</p>
    ${own.map(army => row(button(esc(army.name), 'army', army.id))).join('')}`;
}

function ordersPanel() {
  if (ui.view === 'solar') return '<span class="toolbar-title">Solar command</span><span class="toolbar-help">Select a fleet or world. Double-click a world to open its territory map.</span>';
  if (ui.view === 'planet') {
    const armies = selectedArmies();
    return `<span class="toolbar-title">${armies.length ? `${armies.length} ${armies.length === 1 ? 'army' : 'armies'} · ${armies.reduce((total, army) => total + living(army.squads), 0)} troops` : 'Territory command'}</span>
      <span class="toolbar-help">Select an army. Right-click a territory to march. Hold <kbd>Shift</kbd> to queue.</span>`;
  }
  const roster = tacticalRoster();
  const chosen = roster.filter(squad => ui.selectedSquadIds.has(squad.id));
  const disabled = !chosen.length || currentBattle()?.winner != null;
  return `<span class="toolbar-title">${chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'squad' : 'squads'} · ${living(chosen)} troops` : 'Tactical command'}</span>
    <span class="toolbar-help">Drag to select squads. Right-click to move or attack.</span>
    <div class="toolbar">
      ${button('Select all', 'select-all', '', { disabled: !roster.length })}
      ${button(`Attack-move <kbd>${esc(keyName(ui.keys.attack))}</kbd>`, 'attack-mode', '', { disabled, pressed: ui.attackMode, title: 'Attack enemies encountered on the way to your next click' })}
      ${button(`Hold <kbd>${esc(keyName(ui.keys.hold))}</kbd>`, 'direct-order', 'hold', { disabled })}
      ${button(`Stop <kbd>${esc(keyName(ui.keys.stop))}</kbd>`, 'direct-order', 'stop', { disabled })}
      ${button(`Ability <kbd>${esc(keyName(ui.keys.ability))}</kbd>`, 'direct-order', 'ability', { disabled })}
      ${button(`Formation <kbd>${esc(keyName(ui.keys.formation))}</kbd>`, 'direct-order', 'formation', { disabled })}
      ${select('formation', formations.map(id => [id, title(id)]), ui.picks.formation ?? 'line', 'Squad formation')}
    </div>`;
}

function livePanel() {
  const battles = activeBattles();
  const fleets = Object.values(state.fleets).filter(fleet => fleet.houseId === state.houseId && fleet.engagement);
  text('battle-count', `${battles.length + fleets.length}`);
  const markup = battles.map(battle => {
    const summary = battleSituation(battle).map(([id, strength]) => `${HOUSES[id]?.name ?? title(id)} · ${strength}`).join(' / ');
    return button(`<strong>${esc(battle.name)}</strong><span>${esc(PLANETS[battle.planetId]?.name ?? 'Skirmish')} · ${esc(summary)}</span>`, 'battle', battle.id,
      { className: 'battle-card', pressed: ui.view === 'battle' && ui.battleId === battle.id });
  }).concat(fleets.map(fleet => button(`<strong>${esc(fleet.name ?? 'Fleet engagement')}</strong><span>${esc(PLANETS[fleet.planetId]?.name ?? 'Deep space')} · Fleet engagement</span>`, 'fleet', fleet.id, { className: 'battle-card' })));
  return markup.join('') || '<p class="hint">No active engagements.</p>';
}

function refreshHud() {
  if (!state) return;
  if (ui.battleId && !currentBattle()) {
    ui.battleId = null;
    if (ui.view === 'battle') setView('planet');
  }
  const { speed, elapsed, mode, houseId } = state;
  const resources = state.resources[houseId] ?? {};
  html('resources', RESOURCE_KEYS.map(key => `<span class="resource"><span class="resource-mark">${resourceIcons[key]}</span>${esc(RESOURCE_LABELS[key])}<strong>${Math.floor(resources[key] ?? 0)}</strong></span>`).join(''));
  html('time-controls', `<span class="clock" title="Campaign time">${formatTime(elapsed)}</span>${[
    [0, 'Ⅱ', 'Pause'], [1, '1×', 'Normal speed'], [2, '2×', 'Fast speed'], [4, '4×', 'Maximum speed'],
  ].map(([id, label, tooltip]) => button(label, 'speed', String(id), { pressed: speed === id, title: tooltip })).join('')}`);
  html('layers', `${mode === 'grand' ? button('Solar system', 'layer', 'solar', { pressed: ui.view === 'solar' }) : ''}
    ${mode !== 'skirmish' ? button(esc(PLANETS[ui.planetId]?.name ?? 'Territories'), 'layer', 'planet', { pressed: ui.view === 'planet', disabled: !state.planets[ui.planetId] }) : ''}
    ${ui.battleId ? button('Battlefield', 'layer', 'battle', { pressed: ui.view === 'battle' }) : ''}`);
  html('map-controls', ui.view === 'planet' ? button('Supply', 'supply', '', { pressed: ui.showSupply, title: 'Toggle supply overlay' })
    : ui.view === 'battle' ? `${button('−', 'zoom', 'out', { title: 'Zoom out' })}${button('Fit', 'zoom', 'fit', { title: 'Center the battlefield' })}${button('+', 'zoom', 'in', { title: 'Zoom in' })}` : '');
  for (const tab of document.querySelectorAll('.rail-tabs button')) tab.setAttribute('aria-pressed', String(tab.dataset.id === ui.tab));
  const battle = currentBattle();
  html('inspector', ui.tab === 'politics' && mode !== 'skirmish' ? politicsPanel() : ui.tab === 'colors' && mode !== 'skirmish' ? colorsPanel() :
    ui.view === 'solar' ? solarPanel() : ui.view === 'battle' && battle ? battlePanel(battle) : theaterPanel());
  html('live-battles', livePanel());
  html('dispatches', state.alerts.slice(0, 8).map(event => `<li><time>${formatTime(event.time)}</time>${esc(event.message)}</li>`).join('') || '<li class="muted">No dispatches yet.</li>');
  html('orders', ordersPanel());
  elements.minimap.hidden = ui.view !== 'battle' || !battle;
  for (const tab of document.querySelectorAll('.rail-tabs button')) tab.hidden = mode === 'skirmish' && tab.dataset.id !== 'command';
  const info = [];
  if (speed === 0) info.push('PAUSED');
  if (ui.attackMode && ui.view === 'battle') info.push('CLICK TO ATTACK-MOVE');
  if (state.victory) info.push(victoryLabel(state.victory));
  if (ui.routePreview?.eta) info.push(`ETA ${formatTime(Math.ceil(ui.routePreview.eta))}${ui.routePreview.danger ? ' · Enemy territory' : ''}`);
  text('map-info', info.join(' · '));
  text('map-title', ui.view === 'solar' ? 'SOLAR SYSTEM' : ui.view === 'planet' ? (PLANETS[ui.planetId]?.name ?? '').toUpperCase() : (battle?.name ?? '').toUpperCase());
  map.setAttribute('aria-label', ui.view === 'battle' ? 'Tactical battlefield' : ui.view === 'planet' ? 'Planetary territory map' : 'Solar system map');
}

function victoryLabel(victory) {
  if (typeof victory === 'string') return victory === 'draw' ? 'Draw' : `${HOUSES[victory]?.name ?? victory} wins`;
  const winner = victory.houseId ?? victory.winner;
  return victory.message ?? (winner === 'draw' ? 'Draw' : winner ? `${HOUSES[winner]?.name ?? winner} wins` : title(victory.type ?? 'Campaign complete'));
}

function slotList() {
  try { return storage ? getSaveSlots(storage) : {}; } catch { return {}; }
}

function renderMenu() {
  const setup = ui.setup;
  const planets = Object.values(PLANETS).filter(planet => planet.regionIds.length);
  const slots = slotList();
  const house = HOUSES[setup.houseId];
  const skirmish = setup.mode === 'skirmish';
  const menuSelect = (id, choices, label) => `<label>${label}${select(id, choices, setup[id], label, { setup: true })}</label>`;
  const menuSlots = ['auto', '1', '2', '3'].map((id, index) => {
    const slot = Array.isArray(slots) ? slots.find(item => String(item.slot ?? item.id) === id) : slots?.[id];
    const summary = slot?.houseId ? `${HOUSES[slot.houseId]?.name ?? slot.houseId}, ${CAMPAIGN_MODES[slot.mode] ?? ''} ${formatTime(slot.elapsed)}` : 'Empty';
    return `<div class="save-row"><span>${index === 0 ? 'Autosave' : `Slot ${index}`} · ${esc(summary)}</span>${index === 0 ? '<span></span>' : button('Save', 'save', id, { disabled: !state || !storage })}${button('Load', 'load', id, { disabled: !slot?.houseId || !storage })}</div>`;
  }).join('');
  html('menu-content', `<section class="menu-section"><h2>${state ? 'New campaign' : 'Start campaign'}</h2><div class="menu-grid">
    ${menuSelect('mode', Object.entries(CAMPAIGN_MODES), 'Mode')}
    ${menuSelect('houseId', namedChoices(HOUSES), 'Your House')}
    ${skirmish ? menuSelect('enemyHouseId', namedChoices(HOUSES).filter(([id]) => id !== setup.houseId), 'Enemy House') : menuSelect('planetId', planets.map(planet => [planet.id, planet.name]), 'Starting world')}
    ${skirmish ? menuSelect('terrain', namedChoices(SKIRMISHES), 'Battlefield') : ''}
    ${menuSelect('difficulty', [['standard', 'Standard'], ['hard', 'Veteran']], 'Difficulty')}
    </div><p class="hint menu-line">${esc(house?.description)}</p><div class="menu-line">${button(skirmish ? 'Start battle' : 'Begin campaign', 'start', '', { className: 'primary' })}</div></section>
    <section class="menu-section"><h2>Saved campaigns</h2>${menuSlots}${storage ? '' : '<p class="hint">Campaign storage is unavailable in this browser session.</p>'}</section>
    <section class="menu-section"><details data-detail="shortcuts"${ui.details.has('shortcuts') ? ' open' : ''}><summary>Controls and key bindings</summary>
      <ul class="shortcuts"><li>Left-drag to select squads</li><li>Right-click to move or attack</li><li>Shift queues orders</li><li>Ctrl + 1–9 assigns control groups</li><li>1–9 recalls a group. Double-tap to center it.</li><li>Scroll to zoom. Middle-drag to pan.</li></ul>
      <div class="toolbar">${Object.entries(ui.keys).map(([id, value]) => button(`${esc(keyLabels[id])} <kbd>${ui.keyCapture === id ? 'Press key' : esc(keyName(value))}</kbd>`, 'key', id, { pressed: ui.keyCapture === id })).join('')}
      ${button('Reset keys', 'reset-keys')}</div></details></section>`);
  elements.menu.querySelector('[data-action="resume"]').hidden = !state;
}

function manualSave(slot, quiet = false) {
  if (!storage || !state) return;
  try {
    const result = saveGame(state, storage, slotId(slot));
    if (result?.ok === false) throw new Error(result.message);
    if (!quiet) showStatus('Campaign saved.');
  } catch (error) {
    if (!quiet || !storageUnavailable) showStatus(error.message || 'Campaign could not be saved.', false);
    storageUnavailable = true;
  }
}

function setState(next) {
  state = next;
  ui.houseId = state.houseId;
  ui.planetId = state.planets[state.planetId] ? state.planetId : Object.keys(state.planets)[0] ?? null;
  ui.selectedPlanetId = ui.planetId;
  ui.regionId = null;
  ui.selectedRegionId = null;
  ui.battleId = null;
  ui.tab = 'command';
  ui.view = state.mode === 'grand' ? 'solar' : 'planet';
  ui.selectedArmyIds.clear();
  ui.selectedSquadIds.clear();
  ui.selectedFleetId = null;
  ui.battleViews = {};
  ui.picks = {};
  ui.routePreview = null;
  lastAutosave = state.elapsed;
  storageUnavailable = false;
  elements['game-shell'].hidden = false;
  if (state.mode === 'skirmish') enterBattle(activeBattles()[0]?.id ?? Object.keys(state.battles)[0]);
  if (elements.menu.open) elements.menu.close();
  showStatus('');
  refreshHud();
  map.focus({ preventScroll: true });
}

function stashBattle() {
  if (ui.view !== 'battle' || !ui.battleId) return;
  const existing = ui.battleViews[ui.battleId] ?? {};
  ui.battleViews[ui.battleId] = { ...existing, selection: [...ui.selectedSquadIds], camera: ui.camera ? { ...ui.camera } : null };
}

function setView(view) {
  if (ui.view === view) return;
  stashBattle();
  ui.view = view;
  ui.attackMode = false;
  ui.orderMarker = null;
  ui.routePreview = null;
  ui.drag = null;
  ui.selectionBox = null;
  const frame = elements['map-frame'];
  frame.classList.remove('layer-change');
  requestAnimationFrame(() => frame.classList.add('layer-change'));
}

function enterBattle(id) {
  const battle = state.battles[id];
  if (!battle) return;
  stashBattle();
  setView('battle');
  ui.battleId = id;
  if (battle.planetId) ui.planetId = battle.planetId;
  if (battle.regionId) ui.regionId = battle.regionId;
  ui.selectedPlanetId = ui.planetId;
  ui.selectedRegionId = ui.regionId;
  ui.camera = ui.battleViews[id]?.camera ?? { x: battle.width / 2, y: battle.height / 2, zoom: 1 };
  ui.selectedSquadIds = new Set(ui.battleViews[id]?.selection ?? []);
  ui.tab = 'command';
  map.focus({ preventScroll: true });
}

function enterPlanet(id) {
  if (!state.planets[id]) return;
  const changed = id !== ui.planetId;
  setView('planet');
  ui.planetId = id;
  ui.selectedPlanetId = id;
  if (changed) { ui.regionId = null; ui.selectedRegionId = null; }
  ui.tab = 'command';
  map.focus({ preventScroll: true });
}

function chooseArmy(id, extend = false) {
  const army = state.armies[id];
  if (!army) return;
  if (!extend) ui.selectedArmyIds.clear();
  if (extend && ui.selectedArmyIds.has(id)) {
    ui.selectedArmyIds.delete(id);
    return;
  }
  if (army.planetId && army.planetId !== ui.planetId) ui.planetId = army.planetId;
  ui.regionId = army.regionId;
  ui.selectedRegionId = army.regionId;
  ui.selectedArmyIds.add(id);
  ui.details.add('roster');
  ui.picks.doctrine = null;
  ui.picks.combine = null;
  ui.tab = 'command';
}

function chooseFleet(id) {
  const fleet = state.fleets[id];
  if (!fleet) return;
  setView('solar');
  ui.planetId = fleet.transit?.to ?? fleet.planetId ?? ui.planetId;
  ui.selectedPlanetId = ui.planetId;
  ui.selectedFleetId = id;
  ui.picks.sail = null;
  ui.picks.intercept = null;
  ui.tab = 'command';
}

function actionForClick(event) {
  const node = event.target.closest('button[data-action]');
  if (!node) return;
  const { action, id, army, region, planet, stance } = node.dataset;
  if (action === 'menu') {
    text('menu-status', '');
    renderMenu();
    if (!elements.menu.open) elements.menu.showModal();
    return;
  }
  if (action === 'resume') { if (state) elements.menu.close(); return; }
  if (action === 'start') { setState(createGame(ui.setup)); return; }
  if (action === 'save') { manualSave(id); renderMenu(); return; }
  if (action === 'load') {
    try {
      const saved = loadGame(storage, slotId(id));
      if (saved?.ok === false) throw new Error(saved.message);
      if (!(saved?.state ?? saved)) throw new Error('This campaign slot is empty.');
      setState(saved?.state ?? saved);
      showStatus('Campaign restored.');
    } catch (error) { showStatus(error.message, false); }
    return;
  }
  if (action === 'key') { ui.keyCapture = id; renderMenu(); return; }
  if (action === 'reset-keys') { ui.keys = { ...defaultKeys }; ui.keyCapture = null; persistKeys(); renderMenu(); return; }
  if (!state) return;
  switch (action) {
    case 'tab': ui.tab = id; break;
    case 'speed': issue({ type: 'speed', speed: Number(id) }); break;
    case 'layer':
      if (id === 'planet') enterPlanet(ui.planetId);
      else if (id === 'battle') enterBattle(ui.battleId);
      else setView('solar');
      break;
    case 'planet': enterPlanet(id); break;
    case 'battle': enterBattle(id); break;
    case 'army': chooseArmy(id, event.shiftKey); break;
    case 'fleet': chooseFleet(id); break;
    case 'supply': ui.showSupply = !ui.showSupply; break;
    case 'zoom': zoom(id === 'fit' ? null : id === 'in' ? 1.25 : 0.8); break;
    case 'roster': {
      const key = `army-${army}`;
      const ids = new Set(ui.picks[key] ?? []);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      ui.picks[key] = [...ids];
      break;
    }
    case 'doctrine': issue({ type: 'doctrine', armyId: id, doctrine: pick('doctrine') }); break;
    case 'combine': issue({ type: 'combine', armyId: id, targetId: pick('combine') }); break;
    case 'split': {
      const squads = ui.picks[`army-${id}`];
      if (issue({ type: 'split', armyId: id, squadIds: squads?.length ? squads : undefined })) ui.picks[`army-${id}`] = [];
      break;
    }
    case 'build': issue({ type: 'build', regionId: region, buildingId: id }); break;
    case 'recruit': issue({ type: 'recruit', armyId: id, unitType: pick('recruit') }); break;
    case 'replenish': issue({ type: 'replenish', armyId: id }); break;
    case 'rally': issue({ type: 'rally', regionId: id, targetId: pick('rally') || null }); break;
    case 'dispatch': issue({ type: 'dispatch', regionId: id, unitType: pick('dispatch') }); break;
    case 'ship': issue({ type: 'buildShip', regionId: region, shipType: id }); break;
    case 'transport': issue({ type: 'transport', armyId: id, planetId: planet, regionId: region, landing: pick('transportLanding') }); break;
    case 'sail': issue({ type: 'sail', fleetId: id, planetId: pick('sail') }); break;
    case 'blockade': issue({ type: 'blockade', fleetId: id }); break;
    case 'fleet-order': issue({ type: 'fleetOrder', fleetId: id, stance }); break;
    case 'intercept': issue({ type: 'fleetOrder', fleetId: id, stance: 'advance', targetId: pick('intercept') }); break;
    case 'diplomacy': issue({ type: 'diplomacy', houseId: id, deal: pick('deal'), regionId: pick('concession') }); break;
    case 'operation': issue({ type: 'operation', regionId: region, colorId: id, targetId: pick(`operation-${id}`) }); break;
    case 'select-all': ui.selectedSquadIds = new Set(tacticalRoster().map(squad => squad.id)); break;
    case 'attack-mode': ui.attackMode = !ui.attackMode; map.focus({ preventScroll: true }); break;
    case 'direct-order': tacticalOrder(id, null, event.shiftKey); map.focus({ preventScroll: true }); break;
    case 'retreat': issue({ type: 'retreat', battleId: id }); break;
  }
  refreshHud();
}

function pick(id) { return document.querySelector(`[data-pick="${id}"]`)?.value || undefined; }

function fieldChanged(event) {
  const { setup, pick: key } = event.target.dataset;
  if (setup) {
    ui.setup[setup] = event.target.value;
    if (ui.setup.enemyHouseId === ui.setup.houseId) ui.setup.enemyHouseId = Object.keys(HOUSES).find(id => id !== ui.setup.houseId);
    event.target.blur();
    renderMenu();
    elements['menu-content'].querySelector(`[data-setup="${setup}"]`)?.focus({ preventScroll: true });
  } else if (key) {
    ui.picks[key] = event.target.value;
    if (key === 'transportPlanet' || key === 'transportLanding' || key === 'transportArmy') ui.picks.transportSite = null;
    if (key === 'politicalHouse') ui.picks.concession = null;
    event.target.blur();
    refreshHud();
    document.querySelector(`[data-pick="${key}"]`)?.focus({ preventScroll: true });
  }
}

function pointFrom(event, canvas = map) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}

function getNearest(items, point, position, threshold) {
  let nearest = null;
  let minimum = Infinity;
  for (const item of items) {
    const location = position(item);
    if (!location) continue;
    const distance = Math.hypot(location.x - point.x, location.y - point.y);
    if (distance < minimum && distance <= (typeof threshold === 'function' ? threshold(item) : threshold)) {
      nearest = item;
      minimum = distance;
    }
  }
  return nearest;
}

function nearestRegion(point) {
  const territories = state.planets[ui.planetId]?.regions ?? {};
  return REGIONS[regionAtPoint(ui.planetId, point)] ?? getNearest(Object.keys(territories).map(id => REGIONS[id]), point, mapPoint, 32);
}

function isDouble(key) {
  const now = performance.now();
  const doubled = lastClick?.key === key && now - lastClick.time < 360;
  lastClick = doubled ? null : { key, time: now };
  return doubled;
}

function strategicLeft(point, extended) {
  if (ui.view === 'solar') {
    const fleet = getNearest(Object.values(state.fleets), point, item => fleetPoint(state, item), 19);
    if (fleet) { chooseFleet(fleet.id); return; }
    const planet = getNearest(Object.values(PLANETS), point, mapPoint, item => (item.radius ?? 16) + 12);
    if (planet) {
      ui.planetId = planet.id;
      ui.selectedPlanetId = planet.id;
      ui.selectedFleetId = null;
      ui.tab = 'command';
      if (isDouble(`planet-${planet.id}`)) enterPlanet(planet.id);
    }
    return;
  }
  const troops = Object.values(state.armies).filter(army => army.planetId === ui.planetId && !army.destroyed && !army.fleetId);
  const army = getNearest(troops, point, item => armyPoint(state, item), 16);
  if (army?.houseId === state.houseId) {
    chooseArmy(army.id, extended);
    if (army.battleId && isDouble(`army-${army.id}`)) enterBattle(army.battleId);
    return;
  }
  const region = nearestRegion(point);
  if (!region) return;
  ui.regionId = region.id;
  ui.selectedRegionId = region.id;
  ui.picks.rally = null;
  if (!extended) ui.selectedArmyIds.clear();
  const battle = activeBattles().find(item => item.regionId === region.id);
  if (battle && isDouble(`region-${region.id}`)) enterBattle(battle.id);
}

function strategicRight(point, queue) {
  if (ui.view !== 'planet' || !ui.selectedArmyIds.size) return;
  const region = nearestRegion(point);
  if (!region) return;
  const armyIds = selectedArmies().filter(army => army.houseId === state.houseId && !army.destroyed && army.planetId === ui.planetId).map(army => army.id);
  if (armyIds.length) issue({ type: 'move', armyIds, regionId: region.id, queue });
}

function squadAt(point, enemy = false) {
  const battle = currentBattle();
  if (!battle) return null;
  const candidates = enemy ? battle.squads.filter(squad => squad.houseId !== state.houseId && squad.soldiers > 0 && !squad.withdrawn) : tacticalRoster();
  return getNearest(candidates, point, squad => battlePoint(battle, squad, ui.camera), 24);
}

function obstacleAt(point) {
  const battle = currentBattle();
  const world = battleWorldPoint(battle, point, ui.camera);
  return battle.obstacles.find(obstacle => obstacle.health > 0 && world.x >= obstacle.x && world.x <= obstacle.x + obstacle.w && world.y >= obstacle.y && world.y <= obstacle.y + obstacle.h);
}

function updateSquadSelection(ids, extend, toggle = false) {
  if (!extend) ui.selectedSquadIds.clear();
  for (const id of ids) {
    if (toggle && extend && ui.selectedSquadIds.has(id)) ui.selectedSquadIds.delete(id);
    else ui.selectedSquadIds.add(id);
  }
}

function tacticalLeft(point, extended, box) {
  if (ui.attackMode) { tacticalOrder('attackMove', point, extended); ui.attackMode = false; return; }
  const battle = currentBattle();
  if (box) {
    const squads = tacticalRoster().filter(squad => {
      const location = battlePoint(battle, squad, ui.camera);
      return location.x >= box.x && location.y >= box.y && location.x <= box.x + box.w && location.y <= box.y + box.h;
    });
    updateSquadSelection(squads.map(squad => squad.id), extended);
    return;
  }
  const squad = squadAt(point);
  if (!squad) { if (!extended) ui.selectedSquadIds.clear(); return; }
  if (isDouble(`unit-${squad.id}`)) updateSquadSelection(tacticalRoster().filter(item => item.type === squad.type).map(item => item.id), extended);
  else updateSquadSelection([squad.id], extended, true);
}

function tacticalOrder(type, point, queue = false, facing) {
  const battle = currentBattle();
  if (!battle || battle.winner != null || !ui.selectedSquadIds.size) return;
  const order = { type };
  if (point) {
    const world = battleWorldPoint(battle, point, ui.camera);
    order.x = world.x;
    order.y = world.y;
    if (facing) {
      const end = battleWorldPoint(battle, facing, ui.camera);
      order.heading = Math.atan2(end.y - world.y, end.x - world.x);
    }
  }
  if (type === 'attack') order.targetId = (squadAt(point, true) ?? obstacleAt(point))?.id;
  if (type === 'formation') order.formation = ui.picks.formation ?? 'line';
  if (issue({ type: 'orderSquads', battleId: battle.id, squadIds: [...ui.selectedSquadIds], order, queue }, { quiet: true }) && point) {
    ui.orderMarker = { ...order, time: ui.time, until: ui.time + 1.35 };
  }
}

function tacticalRight(point, queue, facing) {
  const target = !facing && (squadAt(point, true) || obstacleAt(point));
  tacticalOrder(target ? 'attack' : 'move', point, queue, facing);
  ui.attackMode = false;
}

function adjustCamera() {
  const battle = currentBattle();
  const camera = ui.camera;
  if (!battle || !camera) return;
  const halfWidth = battle.width / (camera.zoom * 2);
  const halfHeight = battle.height / (camera.zoom * 2);
  camera.x = Math.min(battle.width - halfWidth, Math.max(halfWidth, camera.x));
  camera.y = Math.min(battle.height - halfHeight, Math.max(halfHeight, camera.y));
}

function zoom(factor, point) {
  const battle = currentBattle();
  if (!battle) return;
  if (factor == null) { ui.camera = { x: battle.width / 2, y: battle.height / 2, zoom: 1 }; return; }
  const origin = point ? battleWorldPoint(battle, point, ui.camera) : null;
  ui.camera.zoom = Math.max(1, Math.min(2.75, ui.camera.zoom * factor));
  if (origin) {
    const updated = battleWorldPoint(battle, point, ui.camera);
    ui.camera.x += origin.x - updated.x;
    ui.camera.y += origin.y - updated.y;
  }
  adjustCamera();
}

function pointerDown(event) {
  if (!state || elements.menu.open || event.button > 2) return;
  event.preventDefault();
  const point = pointFrom(event);
  map.focus({ preventScroll: true });
  map.setPointerCapture(event.pointerId);
  ui.drag = { start: point, last: point, button: event.button, shift: event.shiftKey };
}

function pointerMove(event) {
  if (!state || elements.menu.open) return;
  const point = pointFrom(event);
  const drag = ui.drag;
  if (ui.view === 'planet') {
    const army = selectedArmies().find(item => item.houseId === state.houseId && item.planetId === ui.planetId && !item.fleetId && !item.battleId);
    const region = nearestRegion(point);
    if (army && region) {
      const route = previewRoute(state, army.id, region.id);
      ui.routePreview = route && { ...route, from: army.transit?.to ?? army.regionId };
    } else ui.routePreview = null;
  }
  if (ui.view !== 'battle' || !drag) return;
  if (drag.button === 1) {
    const battle = currentBattle();
    const last = battleWorldPoint(battle, drag.last, ui.camera);
    const next = battleWorldPoint(battle, point, ui.camera);
    ui.camera.x -= next.x - last.x;
    ui.camera.y -= next.y - last.y;
    adjustCamera();
  } else if (drag.button === 0 && !ui.attackMode && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 6) {
    ui.selectionBox = { x: Math.min(point.x, drag.start.x), y: Math.min(point.y, drag.start.y), w: Math.abs(point.x - drag.start.x), h: Math.abs(point.y - drag.start.y) };
  }
  drag.last = point;
}

function pointerUp(event) {
  const drag = ui.drag;
  if (!drag) return;
  const point = pointFrom(event);
  const queue = drag.shift || event.shiftKey;
  if (ui.view === 'battle') {
    if (drag.button === 0) tacticalLeft(point, queue, ui.selectionBox);
    if (drag.button === 2) {
      const hasFacing = Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 15;
      tacticalRight(hasFacing ? drag.start : point, queue, hasFacing ? point : undefined);
    }
  } else {
    if (drag.button === 0) strategicLeft(point, queue);
    if (drag.button === 2) strategicRight(point, queue);
  }
  ui.drag = null;
  ui.selectionBox = null;
  if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
  refreshHud();
}

function persistKeys() {
  try { storage?.setItem('gold-houses-keys', JSON.stringify(ui.keys)); } catch { /* Controls continue to work for this session. */ }
}

function handleKeys(event) {
  const key = event.key.toLowerCase();
  if (ui.keyCapture && elements.menu.open) {
    if (key === 'escape') ui.keyCapture = null;
    else if (/^[a-z ]$/.test(key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const binding = ui.keyCapture;
      const previous = ui.keys[binding];
      const conflict = Object.keys(ui.keys).find(id => ui.keys[id] === key && id !== binding);
      if (conflict) ui.keys[conflict] = previous;
      ui.keys[binding] = key;
      ui.keyCapture = null;
      persistKeys();
    }
    event.preventDefault();
    renderMenu();
    return;
  }
  if (!state || elements.menu.open || event.target.matches('select,input,textarea') || event.repeat) return;
  if (key === 'escape') {
    if (ui.attackMode) { ui.attackMode = false; refreshHud(); }
    else { text('menu-status', ''); renderMenu(); elements.menu.showModal(); }
    event.preventDefault();
    return;
  }
  if (key === ui.keys.pause && !event.ctrlKey && !event.altKey && !event.metaKey && event.target.tagName !== 'BUTTON') {
    issue({ type: 'speed', speed: state.speed === 0 ? 1 : 0 });
    event.preventDefault();
    return;
  }
  if (ui.view !== 'battle' || event.altKey || event.metaKey) return;
  if (/^[1-9]$/.test(key)) {
    event.preventDefault();
    const view = ui.battleViews[ui.battleId] ??= {};
    const groups = view.groups ??= {};
    if (event.ctrlKey) {
      groups[key] = [...ui.selectedSquadIds];
      showStatus(`Control group ${key} assigned.`);
    } else {
      const squads = tacticalRoster().filter(squad => groups[key]?.includes(squad.id));
      updateSquadSelection(squads.map(squad => squad.id), event.shiftKey);
      const now = performance.now();
      if (ui.lastGroup?.key === key && ui.lastGroup.battle === ui.battleId && now - ui.lastGroup.time < 380 && squads.length) {
        ui.camera.zoom = Math.max(1.4, ui.camera.zoom);
        ui.camera.x = squads.reduce((sum, squad) => sum + squad.x, 0) / squads.length;
        ui.camera.y = squads.reduce((sum, squad) => sum + squad.y, 0) / squads.length;
        adjustCamera();
      }
      ui.lastGroup = { key, battle: ui.battleId, time: now };
    }
    refreshHud();
    return;
  }
  if (event.ctrlKey) return;
  const binding = Object.keys(ui.keys).find(id => ui.keys[id] === key);
  if (!binding || binding === 'pause') return;
  event.preventDefault();
  if (binding === 'attack') { if (ui.selectedSquadIds.size) ui.attackMode = !ui.attackMode; }
  else if (binding === 'formation') {
    const current = ui.picks.formation ?? 'line';
    ui.picks.formation = formations[(formations.indexOf(current) + 1) % formations.length];
    tacticalOrder('formation', null, event.shiftKey);
  } else tacticalOrder(binding, null, event.shiftKey);
  refreshHud();
}

function minimapClick(event) {
  const battle = currentBattle();
  if (!battle) return;
  const point = pointFrom(event, elements.minimap);
  ui.camera.x = point.x / elements.minimap.width * battle.width;
  ui.camera.y = point.y / elements.minimap.height * battle.height;
  ui.camera.zoom = Math.max(1.5, ui.camera.zoom);
  adjustCamera();
}

function tick(now) {
  const dt = Math.min(0.15, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  ui.time += dt;
  if (state) {
    if (!elements.menu.open) advance(state, dt * state.speed);
    if (storage && !storageUnavailable && state.elapsed - lastAutosave >= 75) {
      manualSave('auto', true);
      lastAutosave = state.elapsed;
    }
    if (ui.orderMarker && ui.orderMarker.until <= ui.time) ui.orderMarker = null;
    ctx.imageSmoothingEnabled = false;
    const battle = currentBattle();
    if (ui.view === 'solar') drawSolar(ctx, state, ui);
    else if (ui.view === 'planet') drawPlanet(ctx, state, ui);
    else if (battle) {
      drawBattle(ctx, battle, ui);
      drawBattleMinimap(mini, battle, ui);
    }
    if (now - lastHud > 220) { refreshHud(); lastHud = now; }
  }
  requestAnimationFrame(tick);
}

map.width = MAP_WIDTH;
map.height = MAP_HEIGHT;
document.addEventListener('click', actionForClick);
document.addEventListener('change', fieldChanged);
document.addEventListener('keydown', handleKeys);
document.addEventListener('toggle', event => {
  const id = event.target.dataset?.detail;
  if (id) { if (event.target.open) ui.details.add(id); else ui.details.delete(id); }
}, true);
map.addEventListener('pointerdown', pointerDown);
map.addEventListener('pointermove', pointerMove);
map.addEventListener('pointerup', pointerUp);
map.addEventListener('pointercancel', () => { ui.drag = null; ui.selectionBox = null; });
map.addEventListener('pointerleave', () => { ui.routePreview = null; });
map.addEventListener('contextmenu', event => event.preventDefault());
map.addEventListener('wheel', event => {
  if (ui.view !== 'battle') return;
  event.preventDefault();
  zoom(event.deltaY > 0 ? 0.88 : 1.14, pointFrom(event));
}, { passive: false });
elements.minimap.addEventListener('pointerdown', minimapClick);
elements.menu.addEventListener('cancel', event => {
  if (!state || ui.keyCapture) { event.preventDefault(); ui.keyCapture = null; renderMenu(); }
});
elements.menu.addEventListener('close', () => { refreshHud(); if (state) map.focus({ preventScroll: true }); });
renderMenu();
elements.menu.showModal();
requestAnimationFrame(tick);
