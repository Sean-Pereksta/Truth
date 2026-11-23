import {
  createGame, advance, command, saveGame, loadGame, getSaveSlots, previewRoute, getSupplyStatus,
  getPlanetControl, getGroupControl, getControlBonusStatus, getRecruitmentOptions, getPurchaseQuote,
} from './game.mjs';
import {
  HOUSES, PLANETS, REGIONS, BUILDINGS, SHIPS, COLORS, OPERATIONS, DOCTRINES, SKIRMISHES,
  CAMPAIGN_MODES, RESOURCE_KEYS, RESOURCE_LABELS, WORLD_ECONOMIES, PLANET_GROUPS, HOUSE_HOMEWORLDS,
} from './content.mjs';
import { UNIT_TYPES } from './battle.mjs';
import { fleetCapacity, fleetPower } from './fleets.mjs';
import {
  MAP_WIDTH, MAP_HEIGHT, mapPoint, planetAtPoint, regionAtPoint, armyPoint, fleetAtPoint, battlePoint, battleWorldPoint,
  drawSolar, drawPlanet, drawBattle, drawBattleMinimap,
} from './art.mjs';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const map = elements.map;
const ctx = map.getContext('2d');
const mini = elements.minimap.getContext('2d');
const defaultKeys = { attack: 'a', hold: 'h', stop: 's', formation: 'f', ability: 'e', pause: ' ' };
const keyLabels = { attack: 'Attack-move', hold: 'Hold', stop: 'Stop', formation: 'Formation', ability: 'Ability', pause: 'Pause' };
const formations = ['line', 'column', 'wedge', 'defensive', 'loose'];
const actionIcons = {
  planet: 'planet', 'inspect-world': 'planet', control: 'politics', battle: 'tactical', fleet: 'fleet', supply: 'supplies',
  'attack-mode': 'attack', 'select-all': 'formation', retreat: 'withdraw',
  'fleet-order': 'tactical', intercept: 'attack', blockade: 'hold',
  transport: 'fleet', sail: 'solar', ship: 'fleet', build: 'materials',
  doctrine: 'command', 'recruit-area': 'command', 'recruit-squad': 'formation', home: 'planet',
  'plan-invasion': 'fleet', replenish: 'supplies', dispatch: 'formation',
  rally: 'rally', combine: 'formation', split: 'formation',
  diplomacy: 'politics', operation: 'ability', start: 'command',
};
const orderIcons = { hold: 'hold', stop: 'stop', ability: 'ability', formation: 'formation' };
const layerIcons = { solar: 'solar', planet: 'planet', battle: 'tactical' };
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
const homeworld = () => HOUSE_HOMEWORLDS[state.houseId];
const localForces = regionId => Object.values(state.armies).filter(army =>
  army.regionId === regionId && !army.fleetId && !army.destroyed);
const stationary = army => !army.garrison && !army.battleId && !army.transit && !army.orders?.length;

function formatTime(seconds) {
  const rounded = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function icon(name, className = '') {
  return name ? `<span class="ui-icon${className ? ` ${className}` : ''}" data-icon="${esc(name)}" aria-hidden="true"></span>` : '';
}

function illustration(kind, id, className = '') {
  return `<img class="painted-art ${className}" src="./assets/${kind}/${esc(id)}.webp" width="64" height="64" alt="" decoding="async">`;
}

function button(label, action, id = '', options = {}) {
  const { disabled = false, pressed, data = {}, title: tooltip, className, portrait, accessibleLabel } = options;
  const symbol = action === 'layer' ? layerIcons[id] : action === 'direct-order' ? orderIcons[id] : actionIcons[action];
  const image = portrait ? illustration('units', portrait, 'unit-icon') : icon(symbol);
  const attributes = Object.entries(data).map(([key, value]) => ` data-${key}="${esc(value)}"`).join('');
  return `<button type="button" data-action="${esc(action)}"${id ? ` data-id="${esc(id)}"` : ''}${attributes}${disabled ? ' disabled' : ''}${pressed == null ? '' : ` aria-pressed="${Boolean(pressed)}"`}${tooltip ? ` title="${esc(tooltip)}"` : ''}${className ? ` class="${esc(className)}"` : ''}${accessibleLabel ? ` aria-label="${esc(accessibleLabel)}"` : ''}>${image}${label}</button>`;
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
function purchaseRow(name, label, action, id, quote, options = {}) {
  const price = resourceCost(quote.cost) || (quote.eligible ? 'No cost' : '');
  return row(
    `<div class="purchase-item"><strong>${esc(name)}</strong>${price ? `<span>${esc(price)}</span>` : ''}${quote.reason ? `<small>${esc(quote.reason)}</small>` : ''}</div>`,
    button(label, action, id, { ...options, disabled: !quote.eligible, title: quote.reason || options.title }),
  );
}
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
      pressed: chosen.includes(squad.id), data: { army: army.id }, title: `${squad.xp ?? 0} experience`, portrait: squad.type,
    })).join('')}</div>
    ${row('', button(chosen.length ? 'Split selected' : 'Split in half', 'split', army.id, { disabled: roster.length < 2 }))}`);
}

function armyPanel(army) {
  const region = REGIONS[army.regionId];
  const supply = getSupplyStatus(state, army.id);
  const supplyLabel = supply.status;
  const combine = Object.values(state.armies).filter(other => other.id !== army.id && other.houseId === state.houseId && other.regionId && other.regionId === army.regionId && !other.battleId && !other.transit && !other.destroyed && !other.fleetId);
  const chosenCombine = ui.picks.combine ?? combine[0]?.id;
  return `<div class="subject-heading">${illustration('units', 'commander', 'subject-art unit-art')}<div><h2>${esc(army.name)}</h2><p class="muted">${houseLabel(army.houseId)}</p></div></div>${stats([
    ['Location', esc(army.fleetId ? 'Embarked' : region?.name ?? 'In transit')],
    ['Strength', `${living(army.squads)} troops`], ['Supply', esc(supplyLabel)],
    ['Commander', esc(army.commander?.name ?? 'Field command')],
  ])}${row(select('doctrine', namedChoices(DOCTRINES), army.doctrine, 'Commander doctrine'), button('Assign', 'doctrine', army.id))}
  ${rosterDetails(army)}
  ${combine.length ? row(select('combine', combine.map(other => [other.id, other.name]), chosenCombine, 'Army to combine with'), button('Combine', 'combine', army.id)) : ''}
  ${army.battleId ? row(button('Enter battle', 'battle', army.battleId)) : ''}`;
}

function recruitmentPanel(region, { recruitTo, projects, own }) {
  const definition = REGIONS[region.id];
  const key = `recruit-${region.id}`;
  const recruitment = getRecruitmentOptions(state, region.id);
  const shown = recruitment.options.find(option => option.id === ui.picks[key])
    ?? recruitment.options.find(option => option.eligible)
    ?? recruitment.options[0];
  const hasBarracks = Boolean(region.buildings.barracks);
  const buildingProject = projects.find(project => project.type === 'build' && project.item === 'barracks');
  const barracksQuote = getPurchaseQuote(state, { type: 'build', regionId: region.id, buildingId: 'barracks' });
  const training = projects.filter(project => project.type !== 'build' && project.type !== 'buildShip');
  let eta = 0;
  return `<section class="recruit-card" data-recruitment="${esc(region.id)}" tabindex="-1">
    <div class="recruit-heading"><h3>Recruit troops</h3><span>${own.reduce((sum, army) => sum + living(army.squads), 0)} troops here</span></div>
    ${hasBarracks && shown ? `
      <div class="recruit-picker">
        ${illustration('units', shown.id, 'recruit-portrait')}
        <div>${select(key, recruitment.options.map(option => [option.id, `${option.name}${option.eligible ? '' : ' (unavailable)'}`]), shown.id, 'Squad to recruit')}
          <p class="recruit-cost">${esc(resourceCost(shown.cost))}</p>
          <p class="hint">${formatTime(Math.ceil(shown.duration))} training${recruitment.queuedSeconds > 0 ? ` · ready in ${formatTime(Math.ceil(recruitment.queuedSeconds + shown.duration))}` : ''}</p></div>
      </div>
      ${shown.reason ? `<p class="hint recruit-unavailable">${esc(shown.reason)}</p>` : ''}
      ${recruitment.reason && recruitment.reason !== shown.reason ? `<p class="hint recruit-unavailable">${esc(recruitment.reason)}</p>` : ''}
      ${row(button('Recruit squad', 'recruit-squad', shown.id, {
        className: 'primary', disabled: !recruitment.eligible || !shown.eligible,
        data: { region: region.id, ...(recruitTo ? { army: recruitTo.id } : {}) },
      }))}
      <p class="hint">${recruitTo ? `Joins ${esc(recruitTo.name)} if it stays here.` : 'Recruits join a local army or form a new reserve army.'}</p>
    ` : hasBarracks ? `<p class="hint">${esc(recruitment.reason ?? 'Recruiting unavailable.')}</p>`
      : buildingProject ? `<p class="hint">Barracks under construction. Recruiting opens when it is ready.</p>` : `
      <p class="hint">Build a barracks to train squads in ${esc(definition.name)}.</p>
      ${purchaseRow('Barracks', 'Build barracks', 'build', 'barracks', barracksQuote, {
        className: 'primary', data: { region: region.id },
      })}
    `}
    ${training.length ? `<div class="recruit-queue-heading"><strong>Training queue</strong><span>${training.length} queued</span></div>
      <ol class="recruit-queue">${training.map((project, index) => {
        eta += project.remaining;
        return `<li><span>${esc(unitName(project.item))}</span><span>${index ? 'Queued' : 'Training'} · ${formatTime(Math.ceil(eta))}</span></li>`;
      }).join('')}</ol>` : ''}
  </section>`;
}

function regionPanel(region, selectedArmy = null) {
  const definition = REGIONS[region.id];
  const friendly = region.owner === state.houseId;
  const stationed = localForces(region.id);
  const own = stationed.filter(army => army.houseId === state.houseId);
  const projects = (state.projects ?? []).filter(project => project.regionId === region.id && project.houseId === state.houseId);
  const otherProjects = projects.filter(project => project.type === 'build' || project.type === 'buildShip');
  const active = activeBattles().find(battle => battle.regionId === region.id);
  const recruitTo = own.includes(selectedArmy) && stationary(selectedArmy) ? selectedArmy : null;
  const replenish = recruitTo ?? own.find(stationary);
  const needsReplenishment = replenish?.squads.some(squad => squad.soldiers < UNIT_TYPES[squad.type].maxSoldiers || squad.wounds);
  const launchArmy = region.buildings.spaceport && (recruitTo ?? own.find(stationary));
  const dockedFleet = launchArmy && Object.values(state.fleets).some(fleet => fleet.houseId === state.houseId
    && fleet.regionId === region.id && !fleet.transit && !fleet.armyId && !fleet.engagement && !fleet.landing);
  const dispatchChoices = Object.entries(UNIT_TYPES)
    .filter(([id, unit]) => ['rifle', 'heavy', 'marksman'].includes(id) || region.buildings.workshop || definition.colors.includes(unit.color.toLowerCase()))
    .map(([id, unit]) => [id, unit.name]);
  const dispatchType = dispatchChoices.find(([id]) => id === ui.picks.dispatch)?.[0] ?? 'rifle';
  const dispatchQuote = getPurchaseQuote(state, { type: 'dispatch', regionId: region.id, unitType: dispatchType });
  const buildingLevel = id => typeof region.buildings[id] === 'number' ? region.buildings[id] : region.buildings[id]?.level ?? 0;
  const rallyChoices = [['', 'Clear rally point'], ...Object.values(state.planets[definition.planetId].regions)
    .filter(other => other.owner === state.houseId && other.id !== region.id).map(other => [other.id, REGIONS[other.id].name])];
  return `<div class="subject-heading">${illustration('terrain', definition.terrain, 'subject-art terrain-art')}<div><h2>${esc(definition.name)}</h2><p class="muted">${houseLabel(region.owner)} · ${esc(title(definition.terrain))}</p>${state.mode === 'grand' && homeworld().regionId === region.id ? '<span class="home-tag">Home capital</span>' : ''}</div></div>
    ${active ? row(button('Enter battle', 'battle', active.id, { className: 'primary' })) : ''}
    ${friendly ? recruitmentPanel(region, { recruitTo, projects, own }) : ''}
    ${friendly && region.buildings.barracks && needsReplenishment ? purchaseRow(`Replenish ${replenish.name}`, 'Replenish', 'replenish', replenish.id,
      getPurchaseQuote(state, { type: 'replenish', armyId: replenish.id })) : ''}
    ${state.mode === 'grand' && friendly && dockedFleet ? row(button('Plan invasion', 'plan-invasion', launchArmy.id)) : ''}
    ${stationed.length ? `<h3>Local armies</h3>${stationed.map(army => row(`<span class="hint">${houseLabel(army.houseId)} · ${living(army.squads)} troops</span>`, button(esc(army.name), 'army', army.id, { pressed: ui.selectedArmyIds.has(army.id) }))).join('')}` : ''}
    ${selectedArmy ? `<hr>${armyPanel(selectedArmy)}` : ''}
    ${definition.description ? `<p class="hint">${esc(definition.description)}</p>` : ''}
    ${friendly ? details('development', 'Develop territory', Object.values(BUILDINGS).filter(building => state.mode === 'grand' || building.id !== 'spaceport').map(building => {
      const level = buildingLevel(building.id);
      const quote = getPurchaseQuote(state, { type: 'build', regionId: region.id, buildingId: building.id });
      return purchaseRow(`${building.name} · ${level}`, level ? 'Upgrade' : 'Build', 'build', building.id, quote,
        { data: { region: region.id }, title: building.role });
    }).join('')) : ''}
    ${friendly && buildingLevel('barracks') ? details('recruitment-logistics', 'Rally point', `
      ${row(select('rally', rallyChoices, ui.picks.rally ?? region.rally ?? '', 'Rally destination'), button('Set rally', 'rally', region.id))}
      ${row(select('dispatch', dispatchChoices, dispatchType, 'Unit to dispatch'))}
      ${purchaseRow(unitName(dispatchType), 'Dispatch', 'dispatch', region.id, dispatchQuote, { title: 'Recruit and send to the assigned rally point' })}
    `) : ''}
    ${friendly && buildingLevel('spaceport') && state.mode === 'grand' ? details('shipyard', 'Shipyard', Object.values(SHIPS).map(ship => purchaseRow(
      ship.name, 'Build', 'ship', ship.id, getPurchaseQuote(state, { type: 'buildShip', regionId: region.id, shipType: ship.id }),
      { data: { region: region.id }, title: ship.role },
    )).join('')) : ''}
    ${otherProjects.length ? `<h3>Construction queue</h3>${stats(otherProjects.map(project => [BUILDINGS[project.item]?.name ?? SHIPS[project.item]?.name ?? unitName(project.item), formatTime(Math.ceil(project.remaining))]))}` : ''}`;
}

function rewardMarkup(reward) {
  const resources = RESOURCE_KEYS.filter(key => reward.resources?.[key] > 0).map(key =>
    `<span class="control-reward">${icon(key)}<strong>+${reward.resources[key]}</strong> ${esc(RESOURCE_LABELS[key])}</span>`);
  const recruits = Object.entries(reward.squads ?? {}).filter(([, amount]) => amount > 0).map(([id, amount]) =>
    `<span class="control-reward control-squad">${illustration('units', id, 'unit-icon')}<strong>+${amount}</strong> ${esc(unitName(id))} ${amount === 1 ? 'squad' : 'squads'}</span>`);
  return `<div class="control-rewards">${[...resources, ...recruits].join('')}</div>`;
}

function controlClaims(control, measure) {
  const claims = Object.entries(control.counts).sort((a, b) => b[1] - a[1]);
  const open = control.total - claims.reduce((sum, [, count]) => sum + count, 0);
  const width = count => Math.min(100, count / control.total * 100);
  const parts = claims.map(([id, count]) =>
    `<span style="--claim-color:${esc(HOUSES[id]?.color)};width:${width(count)}%"></span>`);
  if (open > 0) parts.push(`<span class="control-unclaimed" style="width:${width(open)}%"></span>`);
  return `<div class="control-meter" aria-hidden="true">${parts.join('')}</div>
    <ul class="control-claims">
      ${claims.map(([id, count]) => `<li>${houseLabel(id)} <strong>${count}</strong></li>`).join('')}
      ${open > 0 ? `<li>${esc(measure)} <strong>${open}</strong></li>` : ''}
    </ul>`;
}

function worldControlPanel(id) {
  const economy = WORLD_ECONOMIES[id];
  const control = getPlanetControl(state, id);
  if (!economy || !control?.total) return '';
  const progress = control.counts[state.houseId] ?? 0;
  const owner = control.owner ? houseLabel(control.owner)
    : Object.keys(control.counts).length > 1 || activeBattles().some(battle => battle.planetId === id) ? 'Contested'
      : Object.keys(control.counts).length ? 'Partially held' : 'Unclaimed';
  const production = RESOURCE_KEYS.filter(key => (economy.multipliers[key] ?? 1) !== 1).map(key => {
    const percent = Math.round((economy.multipliers[key] - 1) * 100);
    return `<span class="production-rate${percent < 0 ? ' production-low' : ''}">${icon(key)}${percent > 0 ? '+' : ''}${percent}% ${esc(RESOURCE_LABELS[key])}</span>`;
  }).join('');
  const muster = Object.keys(economy.reward.squads ?? {}).length ? REGIONS[economy.musterRegionId] : null;
  return `<section class="control-card" data-world-control="${esc(id)}">
    <div class="control-card-heading"><h3>${owner}</h3><span>${progress}/${control.total} yours</span></div>
    ${controlClaims(control, 'Unclaimed')}
    <h3>${esc(economy.name)}</h3><p class="hint">${esc(economy.description)}</p>
    <div class="control-rewards" aria-label="Local production modifiers">${production}</div>
    <div class="control-card-heading reward-heading"><h3>Control reward per cycle</h3>${control.owner ? '<span class="control-active">Active</span>' : ''}</div>
    ${rewardMarkup(economy.reward)}
    ${muster ? `<p class="hint">Reinforcements muster at ${esc(muster.name)}.</p>` : ''}
  </section>`;
}

function controlPanel() {
  const status = getControlBonusStatus(state);
  const groups = Object.values(PLANET_GROUPS).filter(group => group.worldIds.every(id => state.planets[id]));
  return `<div class="control-card-heading control-header">
    <h2>Control ledger</h2><span class="control-countdown" title="Campaign time until control rewards pay">Payout in ${formatTime(Math.ceil(status.secondsRemaining))}</span>
  </div>
    <p class="hint">Hold every territory and clear active battles to earn a world reward every ${status.interval} seconds.${groups.length ? ' Holding every world in a group earns its extra reward.' : ''}</p>
    ${stats([['Worlds controlled', `${status.worlds.length} / ${Object.keys(state.planets).length}`],
      ...(groups.length ? [['Groups controlled', `${status.groups.length} / ${groups.length}`]] : [])])}
    ${groups.map(group => {
      const control = getGroupControl(state, group.id);
      const owned = control.counts[state.houseId] ?? 0;
      const musterWorld = group.musterWorldId ?? group.worldIds[0];
      const muster = Object.keys(group.reward.squads ?? {}).length ? REGIONS[WORLD_ECONOMIES[musterWorld].musterRegionId] : null;
      return `<section class="control-card" data-control-group="${esc(group.id)}">
        <div class="control-card-heading"><h3>${esc(group.name)}</h3><span>${owned}/${control.total} worlds yours</span></div>
        <p class="hint">${esc(group.description)}</p>
        ${controlClaims(control, 'Open or contested')}
        ${control.owner ? `<p class="control-active">Reward active for ${houseLabel(control.owner)}</p>` : ''}
        ${rewardMarkup(group.reward)}
        ${muster ? `<p class="hint">Reinforcements muster at ${esc(muster.name)} on ${esc(PLANETS[musterWorld].name)}.</p>` : ''}
        <div class="control-worlds" aria-label="${esc(group.name)} worlds">${group.worldIds.map(id => {
          const holder = control.worlds[id];
          const world = PLANETS[id];
          return button(`<strong>${esc(world.name)}</strong><span>${holder ? houseLabel(holder) : 'No full control'}</span>`, 'inspect-world', id, {
            className: 'control-world', title: `Inspect ${world.name}'s economy and territories`,
          });
        }).join('')}</div>
      </section>`;
    }).join('')}
    ${ui.planetId ? worldControlPanel(ui.planetId) : ''}`;
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
  const launchQuote = chosenArmy ? getPurchaseQuote(state, {
    type: 'transport', armyId: chosenArmy.id, planetId: destination, regionId: drop, landing: landingMethod,
  }) : null;
  const availableFleets = Object.values(state.fleets).filter(ship => (ship.transit?.to ?? ship.planetId) === planet?.id);
  const invasions = Object.values(state.fleets).filter(ship => ship.armyId && (ship.transit || ship.landing));
  const worldChoices = Object.keys(state.planets).map(id => [id, id === homeworld().planetId ? `${PLANETS[id].name} (Homeworld)` : PLANETS[id].name]);
  const active = activeBattles().filter(battle => battle.planetId === planet?.id).length;
  return `${planet ? `<div class="subject-heading">${illustration('planets', planet.id, 'subject-art planet-art')}<div><h2>${esc(planet.name)}</h2>${planet.id === homeworld().planetId ? '<span class="home-tag">Homeworld</span>' : ''}<p class="hint">${esc(planet.description)}</p></div></div>` : '<h2>Solar System</h2>'}
    ${row(select('focusWorld', worldChoices, ui.planetId, 'Inspect world'), record ? button('Open territories', 'planet', planet.id, { className: 'primary', accessibleLabel: `Open ${planet.name} territories` }) : '')}
    ${invasions.length ? `<h3>Invasion fleets</h3>${invasions.map(invasionCard).join('')}` : ''}
    ${fleet ? fleetPanel(fleet) : ''}
    ${active ? stats([['Active battles', active]]) : ''}
    ${record ? worldControlPanel(planet.id) : ''}
    ${chosenArmy && destinations.length ? details('transport', 'Transport an army', `
      ${row(select('transportArmy', strategicArmies.map(army => [army.id, army.name]), chosenArmy.id, 'Army for transport'))}
      ${row(select('transportPlanet', destinations.map(id => [id, PLANETS[id].name]), destination, 'Destination world'))}
      ${row(select('transportSite', dropSites.map(region => [region.id, REGIONS[region.id].name]), drop, 'Landing site'))}
      ${row(select('transportLanding', [['spaceport', 'Spaceport landing'], ['rain', 'Iron Rain']], landingMethod, 'Landing method'))}
      ${purchaseRow('Fleet launch', 'Launch', 'transport', chosenArmy.id, launchQuote,
        { className: 'primary', data: { planet: destination, region: drop } })}
      <p class="hint">Move the army to a friendly spaceport before launch. Iron Rain can reach hostile territory.</p>
    `) : ''}
    ${availableFleets.length ? `<h3>Local fleets</h3>${availableFleets.map(ship => row(button(`${houseLabel(ship.houseId)} ${esc(ship.name ?? title(ship.id))}`, 'fleet', ship.id, { pressed: ship.id === ui.selectedFleetId }))).join('')}` : ''}`;
}

function invasionCard(fleet) {
  const trip = fleet.transit;
  const from = PLANETS[trip?.from]?.name;
  const destination = PLANETS[trip?.to ?? fleet.planetId]?.name;
  const route = trip ? `${trip.returning ? destination : from} → ${trip.returning ? from : destination}` : `Landing on ${destination}`;
  const remaining = trip ? (trip.returning ? trip.elapsed : trip.duration - trip.elapsed) : fleet.landing.duration - fleet.landing.elapsed;
  const label = `${route} · ${formatTime(Math.ceil(remaining))}`;
  return button(`<strong>${houseLabel(fleet.houseId)} · ${esc(fleet.name)}</strong><span>${esc(label)}</span>`, 'fleet', fleet.id, {
    className: 'battle-card invasion-card', pressed: fleet.id === ui.selectedFleetId,
  });
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
  const flagship = Object.values(SHIPS).filter(ship => fleet.ships[ship.id] > 0).sort((a, b) => b.power - a.power)[0];
  return `<hr><div class="subject-heading">${illustration('ships', flagship?.id ?? 'transport', 'subject-art')}<div><h2>${esc(fleet.name ?? title(fleet.id))}</h2><p class="muted">${houseLabel(fleet.houseId)}</p></div></div>${stats([
    ['Location', esc(berth)],
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
  const deal = ui.picks.deal ?? 'ceasefire';
  return `<h2>House politics</h2>${row(select('politicalHouse', namedChoices(Object.fromEntries(houses.map(house => [house.id, house]))), active.id, 'House'))}
    <p class="hint">${esc(active.description)}</p>${stats([['Relations', esc(stateLabel)], ['Trust', pct(relation?.trust ?? 0)], ['Pacts', esc(['trade', 'access', 'marriage'].filter(id => relation?.[id]).map(title).join(' · ') || 'None')], ['Doctrine', esc(title(active.doctrine))]])}
    ${row(select('deal', Object.entries(deals), deal, 'Agreement'))}
    ${purchaseRow(deals[deal], 'Propose', 'diplomacy', active.id, getPurchaseQuote(state, { type: 'diplomacy', deal }))}
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
      const quote = ready ? getPurchaseQuote(state, { type: 'operation', colorId: color.id }) : null;
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
        ${ready ? `<p class="hint">${esc(operation.description)}${operation.duration ? ` · ${formatTime(operation.duration)}` : ''}</p>
          ${targets?.length ? row(select(`operation-${color.id}`, targets, ui.picks[`operation-${color.id}`] ?? targets[0][0], 'Operation target')) : ''}
          ${purchaseRow(operation.name, 'Activate', 'operation', color.id,
      targets?.length === 0 ? { ...quote, eligible: false, reason: 'No available target.' } : quote, { data: { region: region.id } })}` : ''}`);
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
  return `<div class="subject-heading">${illustration('terrain', battle.terrain, 'subject-art terrain-art')}<div><h2>${esc(battle.name)}</h2><p class="muted">${esc(PLANETS[battle.planetId]?.name ?? 'Skirmish')} · ${formatTime(battle.elapsed)}</p></div></div>
    ${stats(battleSituation(battle).map(([id, strength]) => [HOUSES[id]?.name ?? id, `${strength} troops`]))}
    ${battle.winner != null ? `<p class="hint">${battle.winner === 'draw' ? 'Battle ended in a draw.' : `${houseLabel(battle.winner)} won.`}</p>` : ''}
    ${selected.map(squad => `<div class="squad-heading">${illustration('units', squad.type, 'squad-art')}<div><h3>${esc(squad.name ?? unitName(squad.type))}</h3><p class="hint">${esc(UNIT_TYPES[squad.type]?.role)}</p></div></div>${stats([
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
  if (region && selected.length === 1 && selected[0].regionId === region.id) return regionPanel(region, selected[0]);
  if (selected.length > 1) return `${region ? `${regionPanel(region)}<hr>` : ''}<h2>${selected.length} armies selected</h2><p class="hint">Right-click a destination to march together. Hold Shift to queue waypoints.</p>
    ${selected.map(army => row(button(esc(army.name), 'army', army.id))).join('')}`;
  if (region) return regionPanel(region);
  const own = Object.values(state.armies).filter(army => army.houseId === state.houseId && army.planetId === ui.planetId && !army.fleetId && !army.destroyed);
  return `<h2>${esc(world?.name ?? 'Planetary map')}</h2>${state.mode === 'grand' && world?.id === homeworld().planetId ? '<span class="home-tag">Homeworld</span>' : ''}
    <p class="hint">Select a territory to recruit troops, or select an army to move it.</p>
    ${own.map(army => row(button(esc(army.name), 'army', army.id))).join('')}
    ${world ? worldControlPanel(world.id) : ''}`;
}

function ordersPanel() {
  if (ui.view === 'solar') return '<span class="toolbar-title">Solar command</span><span class="toolbar-help">Select a moving fleet to inspect its invasion. Double-click a world to open its territories.</span>';
  if (ui.view === 'planet') {
    const armies = selectedArmies();
    return `<span class="toolbar-title">${armies.length ? `${armies.length} ${armies.length === 1 ? 'army' : 'armies'} · ${armies.reduce((total, army) => total + living(army.squads), 0)} troops` : 'Territory command'}</span>
      <span class="toolbar-help">Select a territory to recruit. Select an army and right-click to march.</span>`;
  }
  const roster = tacticalRoster();
  const chosen = roster.filter(squad => ui.selectedSquadIds.has(squad.id));
  const disabled = !chosen.length || currentBattle()?.winner != null;
  const cards = roster.map(squad => {
    const label = `${squad.name ?? unitName(squad.type)}, ${squad.soldiers} soldiers`;
    return button(`<span>${squad.soldiers}</span>`, 'select-squad', squad.id, {
      className: 'squad-card', portrait: squad.type, pressed: ui.selectedSquadIds.has(squad.id), accessibleLabel: label, title: label,
    });
  }).join('');
  return `<span class="toolbar-title">${chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'squad' : 'squads'} · ${living(chosen)} troops` : 'Tactical command'}</span>
    <span class="toolbar-help">Drag to select squads. Right-click to move or attack.</span>
    ${cards ? `<div class="squad-strip" aria-label="Squads on this battlefield">${cards}</div>` : ''}
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
  html('resources', RESOURCE_KEYS.map(key => `<span class="resource">${icon(key, 'resource-mark')}<span>${esc(RESOURCE_LABELS[key])}</span><strong>${Math.floor(resources[key] ?? 0)}</strong></span>`).join(''));
  html('time-controls', `<span class="clock" title="Campaign time">${formatTime(elapsed)}</span>${[
    [0, icon('pause'), 'Pause'], [1, '1×', 'Normal speed'], [2, '2×', 'Fast speed'], [4, '4×', 'Maximum speed'],
  ].map(([id, label, tooltip]) => button(label, 'speed', String(id), { pressed: speed === id, title: tooltip, accessibleLabel: tooltip })).join('')}`);
  html('layers', `${mode === 'grand' ? button('Solar system', 'layer', 'solar', { pressed: ui.view === 'solar' }) : ''}
    ${mode !== 'skirmish' ? button(esc(PLANETS[ui.planetId]?.name ?? 'Territories'), 'layer', 'planet', { pressed: ui.view === 'planet', disabled: !state.planets[ui.planetId] }) : ''}
    ${mode === 'grand' ? button('Homeworld', 'home', '', { title: `Go to ${PLANETS[homeworld().planetId].name}` }) : ''}
    ${ui.battleId ? button('Battlefield', 'layer', 'battle', { pressed: ui.view === 'battle' }) : ''}`);
  const controlToggle = button('Control', 'control', '', { pressed: ui.tab === 'control', title: 'World and group control rewards' });
  const recruitRegion = ui.view !== 'battle' && findRecruitmentRegion();
  const recruitControl = recruitRegion ? button('Recruit troops', 'recruit-area', recruitRegion.id, { className: 'primary', title: `Recruit at ${REGIONS[recruitRegion.id].name}` }) : '';
  html('map-controls', ui.view === 'planet' ? `${recruitControl}${button('Supply', 'supply', '', { pressed: ui.showSupply, title: 'Toggle supply overlay' })}${controlToggle}`
    : ui.view === 'battle' ? `${button('-', 'zoom', 'out', { title: 'Zoom out' })}${button('Fit', 'zoom', 'fit', { title: 'Center the battlefield' })}${button('+', 'zoom', 'in', { title: 'Zoom in' })}` : `${recruitControl}${controlToggle}`);
  for (const tab of document.querySelectorAll('.rail-tabs button')) tab.setAttribute('aria-pressed', String(tab.dataset.id === ui.tab));
  const battle = currentBattle();
  let inspector;
  if (ui.tab === 'control' && ui.view !== 'battle') inspector = controlPanel();
  else if (ui.tab === 'politics' && mode !== 'skirmish') inspector = politicsPanel();
  else if (ui.tab === 'colors' && mode !== 'skirmish') inspector = colorsPanel();
  else if (ui.view === 'solar') inspector = solarPanel();
  else if (ui.view === 'battle' && battle) inspector = battlePanel(battle);
  else inspector = theaterPanel();
  html('inspector', inspector);
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
  const home = HOUSE_HOMEWORLDS[setup.houseId];
  const menuSelect = (id, choices, label) => `<label>${label}${select(id, choices, setup[id], label, { setup: true })}</label>`;
  const menuSlots = ['auto', '1', '2', '3'].map((id, index) => {
    const slot = Array.isArray(slots) ? slots.find(item => String(item.slot ?? item.id) === id) : slots?.[id];
    const summary = slot?.houseId ? `${HOUSES[slot.houseId]?.name ?? slot.houseId}, ${CAMPAIGN_MODES[slot.mode] ?? ''} ${formatTime(slot.elapsed)}` : 'Empty';
    return `<div class="save-row"><span>${index === 0 ? 'Autosave' : `Slot ${index}`} · ${esc(summary)}</span>${index === 0 ? '<span></span>' : button('Save', 'save', id, { disabled: !state || !storage })}${button('Load', 'load', id, { disabled: !slot?.houseId || !storage })}</div>`;
  }).join('');
  html('menu-content', `<section class="menu-section"><h2>${state ? 'New campaign' : 'Start campaign'}</h2><div class="menu-grid">
    ${menuSelect('mode', Object.entries(CAMPAIGN_MODES), 'Mode')}
    ${menuSelect('houseId', namedChoices(HOUSES), 'Your House')}
    ${skirmish ? menuSelect('enemyHouseId', namedChoices(HOUSES).filter(([id]) => id !== setup.houseId), 'Enemy House')
      : setup.mode === 'planetary' ? menuSelect('planetId', planets.map(planet => [planet.id, planet.name]), 'Starting world')
        : `<div class="menu-home"><span>Homeworld</span><strong>${esc(PLANETS[home.planetId].name)}</strong><small>${esc(REGIONS[home.regionId].name)}</small></div>`}
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

function setState(next, freshCampaign = false) {
  state = next;
  ui.houseId = state.houseId;
  const home = freshCampaign && state.mode === 'grand' ? homeworld() : null;
  const start = home?.planetId ?? state.planetId;
  ui.planetId = state.planets[start] ? start : Object.keys(state.planets)[0] ?? null;
  ui.selectedPlanetId = ui.planetId;
  ui.regionId = state.planets[ui.planetId]?.regions[home?.regionId]?.id ?? null;
  ui.selectedRegionId = ui.regionId;
  ui.battleId = null;
  ui.tab = 'command';
  ui.view = state.mode === 'grand' && !home ? 'solar' : 'planet';
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

function focusTerritory(planetId, regionId) {
  enterPlanet(planetId);
  if (!state.planets[planetId]?.regions[regionId]) return;
  ui.regionId = regionId;
  ui.selectedRegionId = regionId;
  ui.selectedArmyIds.clear();
  ui.picks.rally = null;
}

function findRecruitmentRegion() {
  const region = currentRegion();
  if (region?.owner === state.houseId) return region;
  const own = world => Object.values(world?.regions ?? {}).filter(candidate => candidate.owner === state.houseId);
  const local = own(state.planets[ui.planetId]);
  if (local.length) return local.find(candidate => candidate.buildings.barracks) ?? local[0];
  const home = homeworld();
  const homeRegion = state.planets[home.planetId]?.regions[home.regionId];
  if (homeRegion?.owner === state.houseId) return homeRegion;
  const territories = Object.values(state.planets).flatMap(own);
  return territories.find(candidate => candidate.buildings.barracks) ?? territories[0];
}

function focusWorld(id) {
  if (!state.planets[id]) return;
  if (ui.planetId !== id) {
    ui.regionId = null;
    ui.selectedRegionId = null;
    ui.selectedArmyIds.clear();
  }
  ui.planetId = id;
  ui.selectedPlanetId = id;
  ui.selectedFleetId = null;
  ui.tab = 'command';
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
  if (action === 'start') { setState(createGame(ui.setup), true); return; }
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
    case 'control': ui.tab = ui.tab === 'control' ? 'command' : 'control'; break;
    case 'speed': issue({ type: 'speed', speed: Number(id) }); break;
    case 'layer':
      if (id === 'planet') enterPlanet(ui.planetId);
      else if (id === 'battle') enterBattle(ui.battleId);
      else setView('solar');
      break;
    case 'planet': enterPlanet(id); break;
    case 'home': {
      const home = homeworld();
      focusTerritory(home.planetId, home.regionId);
      break;
    }
    case 'recruit-area': {
      const territory = REGIONS[id] ?? REGIONS[findRecruitmentRegion()?.id];
      if (!territory) break;
      focusTerritory(territory.planetId, territory.id);
      refreshHud();
      const panel = elements.inspector.querySelector('[data-recruitment]');
      panel?.scrollIntoView?.({ block: 'nearest' });
      (panel?.querySelector('select, button:not(:disabled)') ?? panel)?.focus?.({ preventScroll: true });
      return;
    }
    case 'plan-invasion': {
      const expedition = state.armies[id];
      if (!expedition) break;
      setView('solar');
      focusWorld(expedition.planetId);
      ui.picks.transportArmy = id;
      ui.picks.transportPlanet = null;
      ui.picks.transportSite = null;
      ui.picks.transportLanding = 'rain';
      ui.details.add('transport');
      refreshHud();
      const transport = elements.inspector.querySelector('[data-detail="transport"]');
      transport?.scrollIntoView?.({ block: 'nearest' });
      transport?.querySelector('[data-pick="transportPlanet"]')?.focus({ preventScroll: true });
      return;
    }
    case 'inspect-world':
      setView('solar');
      focusWorld(id);
      refreshHud();
      elements.inspector.querySelector('[data-pick="focusWorld"]')?.focus({ preventScroll: true });
      return;
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
    case 'recruit-squad': issue({ type: 'recruitAt', regionId: region, unitType: id, armyId: army }); break;
    case 'replenish': issue({ type: 'replenish', armyId: id }); break;
    case 'rally': issue({ type: 'rally', regionId: id, targetId: pick('rally') || null }); break;
    case 'dispatch': issue({ type: 'dispatch', regionId: id, unitType: pick('dispatch') }); break;
    case 'ship': issue({ type: 'buildShip', regionId: region, shipType: id }); break;
    case 'transport':
      if (issue({ type: 'transport', armyId: id, planetId: planet, regionId: region, landing: pick('transportLanding') })) {
        const fleetId = state.armies[id]?.fleetId;
        if (fleetId) chooseFleet(fleetId);
      }
      break;
    case 'sail': issue({ type: 'sail', fleetId: id, planetId: pick('sail') }); break;
    case 'blockade': issue({ type: 'blockade', fleetId: id }); break;
    case 'fleet-order': issue({ type: 'fleetOrder', fleetId: id, stance }); break;
    case 'intercept': issue({ type: 'fleetOrder', fleetId: id, stance: 'advance', targetId: pick('intercept') }); break;
    case 'diplomacy': issue({ type: 'diplomacy', houseId: id, deal: pick('deal'), regionId: pick('concession') }); break;
    case 'operation': issue({ type: 'operation', regionId: region, colorId: id, targetId: pick(`operation-${id}`) }); break;
    case 'select-all': ui.selectedSquadIds = new Set(tacticalRoster().map(squad => squad.id)); break;
    case 'select-squad': updateSquadSelection([id], event.shiftKey, true); map.focus({ preventScroll: true }); break;
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
    if (key === 'focusWorld') focusWorld(event.target.value);
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
    const exact = planetAtPoint(state, point, true);
    const fleet = fleetAtPoint(state, point, false, ui.selectedFleetId);
    if (fleet && (!exact || fleet.transit || fleet.landing)) {
      chooseFleet(fleet.id);
      return;
    }
    const world = exact ?? planetAtPoint(state, point);
    if (world) {
      focusWorld(world.id);
      if (isDouble(`planet-${world.id}`)) enterPlanet(world.id);
      return;
    }
    const lane = fleetAtPoint(state, point, true, ui.selectedFleetId);
    if (lane) chooseFleet(lane.id);
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
  ui.tab = 'command';
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
