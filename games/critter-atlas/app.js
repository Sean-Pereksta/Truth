import { SPECIES, REGIONS, EVOLUTION_LEVELS, MAX_LEVEL, PARTY_LIMIT, getStats, getAbilities, getForm, xpToNext } from './catalog.js';
import { newJournal, loadJournal, saveJournal, getParty, setParty, addCapture, awardXP } from './journal.js';
import { sprite } from './art.js';
import { FIGHT_ICONS, fightIcon, abilityIconKey } from './fight-icons.js';
import { mountWorld, completeEncounter, routeHint, siteName, unlockedSites, wonderProgress } from './world.js';
import { awardCoins, battleSupplies, spendSupply } from './economy.js';
import { mountMarket, mountBag } from './market.js';
import { mountBattle } from './battle.js';

const game = document.querySelector('#game');
const dialog = document.querySelector('#info-dialog');
const roleNames = { striker: 'Fast striker', defender: 'Defender', healer: 'Healer', ranged: 'Ranged attacker' };
let state = loadJournal();
let view = state ? 'map' : 'start';
let starter = 0;
let cleanup = null;
let notices = [];
let regionFilter = '';
let rarityFilter = '';
let search = '';
let pendingSwap = null;

function showDialog(title, body) {
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-body').innerHTML = body;
  if (!dialog.open) dialog.showModal();
}
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) {
  const b = dialog.getBoundingClientRect();
  if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close();
}});
document.querySelector('#help-button').addEventListener('click', () => showDialog('How to play', `
  <ol class="help-list">
    <li><b>Explore.</b> Tap a landmark to walk there. Each region has three districts. Select a locked destination to learn which victory opens the route.</li>
    <li><b>Trade.</b> Visit the local market to buy supplies or Critters, or sell one from your roster. Each settlement carries its own stock and pays extra for different Critters. Use training food from your Bag and combat supplies during a fight.</li>
    <li><b>Battle.</b> Pick a lit hex to move, then choose an ability. The number over each target shows the expected damage or healing. Guard to brace against incoming attacks.</li>
    <li><b>Time your attack.</b> ${fightIcon('wait','')} Wait lets a Critter act later in the same round. Use it before moving to let a companion get beside a foe. A melee hit with both allies beside the target gains a flank bonus.</li>
    <li><b>Read the terrain.</b> Cover reduces ranged damage. A hazard triggers when a Critter ends its turn there. The battle’s effects key explains the symbols.</li>
    <li><b>Capture.</b> Move within three hexes, choose Capture, then select a wild Critter. Lower its health or apply a status to improve the displayed odds. A capture attempt uses the turn.</li>
    <li><b>Build your party.</b> Take up to four companions. Captures fill spare slots and then go to your reserve. Switch companions in Party between battles. Everyone recovers their health after a fight.</li>
    <li><b>Open new paths.</b> Beat the trail tribes, win the local arena trial, then take on the warden to enter the next region. Optional guardians open rare habitats. Each new family’s Field guide entry names its habitat and the victory that opens it.</li>
    <li><b>Track a Hyper Rare.</b> In five regions, a vault victory uncovers a clue. Alternate between the named patrols to find tracks, then follow them to the lair. The Field guide records the trail and all four forms.</li>
  </ol><p class="field-note">Your trail and completed encounters save on this browser. The Field guide records all ${SPECIES.length} families and their evolutions.</p>`));

function persist() {
  state.region = state.world.region;
  state.unlocked = state.world.unlocked;
  const wallet = game.querySelector('[data-wallet]');
  if (wallet) wallet.textContent = state.economy.coins;
  const saved = saveJournal(state);
  const note = document.querySelector('#storage-note');
  note.hidden = saved;
  if (!saved) note.textContent = 'Browser storage is unavailable. Your adventure will last until this tab closes.';
}

function resetView(next) {
  cleanup?.();
  cleanup = null;
  view = next;
  game.replaceChildren();
}
function focusGame() {
  game.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function showStart() {
  resetView('start');
  game.innerHTML = `
    <section aria-labelledby="title-name">
      <div class="title-art"><img src="./assets/cover.webp" alt="" fetchpriority="high"><div class="title-copy">
        <h1 id="title-name">Critter Atlas</h1><p>Follow wild tribes through frontier towns, gated passes, and regional arenas.</p>
      </div></div>
      <div class="title-stats"><span>${REGIONS.length} regions</span><span>${SPECIES.length} Critter families</span><span>Turn-based tactics</span></div>
    </section>
    <section aria-labelledby="choose-title"><div class="section-heading"><h2 id="choose-title">Choose your lead Critter</h2></div>
      <div class="starter-grid">${[0, 1, 2].map(id => {
        const s = SPECIES[id];
        return `<button class="starter-card" data-starter="${id}" aria-pressed="${id === starter}"><span class="starter-portrait">${sprite(id, 0)}</span><span><b class="starter-name">${s.name}</b><small class="starter-role">${roleNames[s.role]}</small></span></button>`;
      }).join('')}</div>
      <div class="start-actions"><p id="starter-partner" aria-live="polite"></p><button class="primary-action" id="begin">Begin expedition <span aria-hidden="true">→</span></button></div>
    </section>`;
  setStarter(starter);
}
function setStarter(id) {
  starter = id;
  game.querySelectorAll('[data-starter]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.starter) === id)));
  game.querySelector('#starter-partner').textContent = `${SPECIES[(id + 1) % 3].name} joins ${SPECIES[id].name} on the trail.`;
}
function startExpedition() {
  state = newJournal(starter);
  persist();
  showMap();
  focusGame();
}
function shell(next) {
  resetView(next);
  const here = state.world.region;
  game.innerHTML = `<nav class="game-tabs" aria-label="Expedition">${[['map', 'Trail map'], ['party', 'Party'], ['bag', 'Bag'], ['guide', 'Field guide']].map(([key, label]) =>
    `<button class="game-tab" data-view="${key}" ${key === next ? 'aria-current="page"' : ''}>${label}</button>`).join('')}
    <span class="expedition-stats"><span class="trail-progress">Region ${here + 1} / ${REGIONS.length}</span><span class="coin-balance"><i aria-hidden="true"></i><span data-wallet>${state.economy.coins}</span> coins</span></span></nav><div class="feedback"></div><div class="view-content"></div>`;
  if (notices.length) {
    const box = game.querySelector('.feedback');
    box.innerHTML = '<div class="notice" role="status"><div class="notice-content"></div><button aria-label="Dismiss news" data-dismiss>×</button></div>';
    for (const line of notices) {
      const p = document.createElement('p'); p.textContent = line;
      box.querySelector('.notice-content').append(p);
    }
  }
  return game.querySelector('.view-content');
}
function meter(m) {
  const need = xpToNext(m.level);
  const pct = m.level >= MAX_LEVEL ? 100 : Math.min(100, m.xp / need * 100);
  return `<span class="meter" aria-hidden="true"><i style="width:${pct}%"></i></span><small>${m.level >= MAX_LEVEL ? 'Max level' : `${m.xp} / ${need} XP`}</small>`;
}
function companionTile(m) {
  const f = getForm(m);
  return `<button class="companion-tile" data-member="${state.roster.indexOf(m)}"><span class="line-portrait">${sprite(m.speciesId, f.stage)}</span><span class="companion-text"><strong>${f.name}</strong><small>Lv. ${m.level} · ${roleNames[SPECIES[m.speciesId].role]} · ${getStats(m).maxHp} HP</small>${meter(m)}</span></button>`;
}
function showMap(inspectSite) {
  const main = shell('map');
  main.innerHTML = `<div id="map-panel"></div><section class="explore-party"><div class="subhead"><h2>Traveling party</h2><button class="link-action" data-view="party">Manage party →</button></div><div class="companion-strip">${getParty(state).map(companionTile).join('')}</div></section>`;
  cleanup = mountWorld(main.querySelector('#map-panel'), {
    world: state.world, sprite, inspectSite, onChange: persist, onCamp: () => showParty(), onEncounter: beginBattle, onMarket: showMarket,
    onRegion(id) { game.querySelector('.trail-progress').textContent = `Region ${id + 1} / ${REGIONS.length}`; }
  });
}
function showMarket(region) {
  if (state.world.region !== region || state.world.node !== 'town') return;
  const main = shell('market');
  cleanup = mountMarket(main, { state, region, sprite, onChange:persist, onExit() { showMap(); focusGame(); } });
  focusGame();
}
function showBag() {
  const main = shell('bag');
  cleanup = mountBag(main, {state, sprite, onChange:persist});
}
function beginBattle(encounter) {
  const party = getParty(state);
  const participants = party.map(m => m.uid);
  resetView('battle');
  notices = [];
  cleanup = mountBattle(game, { encounter, party, sprite,
    getSupplies:() => battleSupplies(state),
    spendSupply(id) {
      if (!spendSupply(state,id)) return false;
      persist();
      return true;
    }, onResolved(outcome) {
    const won = outcome.result === 'won';
    const prior = state.world.unlocked;
    const firstClear = won && !state.world.cleared.includes(encounter.region+'/'+encounter.node);
    const oldSites = firstClear ? new Set(unlockedSites(state.world, encounter.region)) : null;
    const oldTrail = wonderProgress(state.world,encounter.region);
    completeEncounter(state.world, encounter, won, outcome.captured);
    let coins = 0;
    if (won) {
      state.wins[encounter.region]++;
      coins = awardCoins(state, encounter, firstClear);
      if (coins > 0) notices.push(`Earned ${coins} coins.`);
    }
    if (oldSites) {
      const opened = unlockedSites(state.world, encounter.region).filter(id => !oldSites.has(id));
      const names = opened.map(id => siteName(encounter.region, id));
      if (names.length) notices.push(`Route opened to ${names.join(', ')}.`);
    }
    const trail = wonderProgress(state.world,encounter.region);
    if (trail?.open && !oldTrail?.open) notices.push(trail.clue);
    if (trail?.ready && !oldTrail?.ready) notices.push(`Fresh tracks lead to ${trail.name}. The Hyper Rare is there now.`);
    if (outcome.xp > 0) {
      notices.push(`Traveling party earned ${outcome.xp} XP each.`, ...awardXP(state, outcome.xp, participants));
    }
    for (const member of outcome.captured) {
      const stored = addCapture(state, member);
      notices.push(`${getForm(stored).name} joined your ${state.party.includes(stored.uid) ? 'party' : 'reserve'}.`);
    }
    if (state.world.unlocked > prior) notices.push(`The trail to ${REGIONS[state.world.unlocked].name} is open. Choose it in the region menu.`);
    if (won && encounter.kind === 'warden' && encounter.region === REGIONS.length - 1) notices.push('All eight regions are open. Return to their hidden trails to complete your collection.');
    if (outcome.result === 'lost') notices.push('Your party regrouped at full health. You can revisit earlier tribes to train.');
    persist();
    return {coins};
  }, onFinish() {
    showMap();
    focusGame();
  }});
  focusGame();
}
function rosterCard(m, active) {
  const s = SPECIES[m.speciesId], f = getForm(m), index = state.roster.indexOf(m);
  return `<article class="roster-card"><span class="slot-portrait">${sprite(s.id, f.stage)}</span><div class="companion-text"><strong class="roster-name">${f.name}</strong><small>Lv. ${m.level} · ${roleNames[s.role]} · ${getStats(m).maxHp} HP</small>${meter(m)}</div>
    <div class="roster-tools"><button class="small-action" data-member="${index}">Details</button>
    <button class="small-action" data-roster="${index}" ${active && state.party.length === 1 ? 'disabled' : ''}>${active ? 'Send to reserve' : state.party.length >= PARTY_LIMIT ? 'Swap into party' : 'Add to party'}</button></div></article>`;
}
function showParty() {
  const main = shell('party');
  const party = getParty(state), reserve = state.roster.filter(m => !state.party.includes(m.uid));
  main.innerHTML = `<div class="party-intro"><h1>Your party</h1><p>${party.length} / ${PARTY_LIMIT} traveling companions</p></div>
    <div class="roster-list">${party.map(m => rosterCard(m, true)).join('')}</div>
    <div class="section-heading"><h2>Reserve</h2><p>${reserve.length} at camp</p></div>
    ${reserve.length ? `<div class="roster-list">${reserve.map(m => rosterCard(m, false)).join('')}</div>` : '<p class="empty-reserve">When your traveling party is full, new captures stay here.</p>'}`;
}
function editRoster(index) {
  const member = state.roster[index];
  if (state.party.includes(member.uid)) setParty(state, state.party.filter(uid => uid !== member.uid));
  else if (state.party.length < PARTY_LIMIT) setParty(state, [...state.party, member.uid]);
  else {
    pendingSwap = member.uid;
    showDialog(`Make room for ${getForm(member).name}`, `<p class="field-note">Choose the companion to send to your reserve.</p><div class="roster-list">${getParty(state).map((m, i) => `<button class="companion-tile" data-swap="${i}"><span class="line-portrait">${sprite(m.speciesId, getForm(m).stage)}</span><span>${getForm(m).name} · Lv. ${m.level}</span></button>`).join('')}</div>`);
    return;
  }
  persist(); showParty();
}
dialog.addEventListener('click', event => {
  const formChoice = event.target.closest('[data-show-form]');
  const poseChoice = event.target.closest('[data-show-pose]');
  if (formChoice || poseChoice) {
    const portrait = dialog.querySelector('[data-wonder-family]');
    const family = SPECIES[Number(portrait.dataset.wonderFamily)];
    if (formChoice) {
      const stage = Number(formChoice.dataset.showForm);
      portrait.querySelector('.wonder-specimen').innerHTML = sprite(family.id,stage);
      portrait.querySelector('.wonder-form-name').textContent = family.forms[stage];
      dialog.querySelectorAll('[data-show-form]').forEach(b => b.setAttribute('aria-pressed',String(b === formChoice)));
    } else {
      const attacking = portrait.classList.toggle('show-action-pose');
      poseChoice.setAttribute('aria-pressed', String(attacking));
      poseChoice.textContent = attacking ? 'Show idle pose' : 'Show battle pose';
    }
    return;
  }
  const locate = event.target.closest('[data-locate]');
  if (locate) {
    dialog.close();
    showMap(locate.dataset.locate);
    focusGame();
    return;
  }
  const item = event.target.closest('[data-swap]');
  if (!item || !pendingSwap) return;
  const ids = [...state.party];
  ids[Number(item.dataset.swap)] = pendingSwap;
  setParty(state, ids);
  pendingSwap = null;
  dialog.close();
  persist(); showParty();
});
function showGuide() {
  const main = shell('guide');
  main.innerHTML = `<div class="guide-intro"><h1>Field guide</h1><p>${new Set(state.seen).size} / ${SPECIES.length} families collected</p></div>
    <div class="guide-tools"><label>Search families<input type="search" id="guide-search" placeholder="Name or role"></label>
    <label>Region<select id="guide-region"><option value="">All regions</option>${REGIONS.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
    <label>Rarity<select id="guide-rarity"><option value="">Any rarity</option>${[...new Set(SPECIES.map(s => s.rarity))].map(r => `<option>${r}</option>`).join('')}</select></label></div>
    <div class="guide-grid"></div>`;
  main.querySelector('#guide-search').value = search;
  main.querySelector('#guide-region').value = regionFilter;
  const rarity = main.querySelector('#guide-rarity');
  rarity.value = rarityFilter;
  rarity.addEventListener('change', e => {rarityFilter = e.target.value; updateGuide();});
  main.querySelector('#guide-search').addEventListener('input', e => {search = e.target.value; updateGuide();});
  main.querySelector('#guide-region').addEventListener('change', e => {regionFilter = e.target.value; updateGuide();});
  updateGuide();
}
function updateGuide() {
  const term = search.trim().toLowerCase();
  const filtered = SPECIES.filter(s => (regionFilter === '' || s.region === Number(regionFilter)) && (!rarityFilter || s.rarity === rarityFilter) &&
    [...s.forms, roleNames[s.role], s.rarity].some(value => value.toLowerCase().includes(term)));
  const collected = new Set(state.seen);
  game.querySelector('.guide-grid').innerHTML = filtered.length ? filtered.map(s => `<button class="guide-entry${s.hyperRare ? ' guide-wonder' : ''}" data-species="${s.id}">
    ${collected.has(s.id) ? '<span class="owned-symbol" aria-label="Collected">✓</span>' : ''}<span class="guide-portrait">${sprite(s.id, 0)}</span><strong>${s.name}</strong><small>${s.rarity} · ${roleNames[s.role]}</small></button>`).join('') : '<p class="field-note">No matching families.</p>';
}
function showDetail(s, member) {
  const sample = member ?? {speciesId:s.id, level:1, xp:0};
  const form = getForm(sample), stats = getStats(sample);
  const abilities = getAbilities({ ...sample, level:MAX_LEVEL });
  const habitat = s.habitatId || (s.legendary ? 'hollow' : null);
  const trail = s.hyperRare ? wonderProgress(state.world,s.region) : null;
  const plate = s.hyperRare ? [0,2,3,5,7].indexOf(s.region) : -1;
  const artwork = plate >= 0 ? `<div class="wonder-portrait" data-wonder-family="${s.id}" style="--lair-y:${plate*25}%">
    <div class="wonder-rarity"><span aria-hidden="true">✧</span> Hyper Rare</div>
    <span class="wonder-specimen">${sprite(s.id,form.stage)}</span>
    <b class="wonder-form-name" aria-live="polite">${form.name}</b><button type="button" class="wonder-pose" data-show-pose aria-pressed="false">Show battle pose</button></div>` : '';
  const trailStatus = trail?.open ? (trail.ready ? 'Fresh tracks are waiting at the lair.' :
    `${trail.clue} · ${trail.progress} / 12 patrol victories recorded.`) : '';
  const locate = habitat && s.region === state.world.region
    ? `<button class="link-action" data-locate="${habitat}">Locate on trail map →</button>` : '';
  showDialog(form.name, `${artwork}<div class="detail-head">${artwork ? '' : `<span class="detail-sprite">${sprite(s.id, form.stage)}</span>`}<div>
      <span class="micro">${fightIcon(s.role,'')} ${roleNames[s.role]} · ${s.rarity}</span><p class="field-note">${REGIONS[s.region].name}<br>${s.lore}</p></div></div>
    ${habitat ? `<div class="habitat-note"><b>Habitat · ${siteName(s.region,habitat)}</b><span>${routeHint(s.region,habitat)}</span>${s.hyperRare ? '<span>Track a level 3 youngling at an active lair to raise it through all three evolutions. A local escort protects it.</span>' : ''}${trailStatus ? `<span class="wonder-tracks">${trailStatus}</span>` : ''}${locate}</div>` : ''}
    <div class="detail-stats"><span>Lv. ${sample.level}</span><span>${fightIcon('hp','')} ${stats.maxHp} HP</span><span>${fightIcon('melee','')} ${stats.attack} attack</span><span>${fightIcon('guard','')} ${stats.defense} defense</span><span>${fightIcon('move','')} ${stats.move} move</span></div>
    ${member ? `<div class="companion-text">${meter(member)}</div>` : ''}
    <h3 class="dialog-section">Evolution</h3><div class="evolution-row">${s.forms.map((name, stage) => {
      const content = `<span class="evo-sprite">${sprite(s.id, stage)}</span><b>${name}</b>Lv. ${[1,...EVOLUTION_LEVELS][stage]}`;
      return s.hyperRare ? `<button type="button" class="evolution-step" data-show-form="${stage}" aria-label="Show ${name}" aria-pressed="${stage === form.stage}">${content}</button>` :
        `<div class="evolution-step">${content}</div>`;
    }).join('')}</div>
    <h3 class="dialog-section">Abilities</h3><ul class="ability-list">${abilities.map(a => {
      const condition = a.status ? `<span class="ability-condition">${fightIcon(a.status,'')} ${FIGHT_ICONS[a.status].label}</span>` : '';
      return `<li><span class="ability-glyph">${fightIcon(abilityIconKey(a,s),'')}</span><div><b>${a.name}</b> · Lv. ${a.learnLevel}<small>${a.description}</small>${condition}</div></li>`;
    }).join('')}</ul>`);
}
game.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const d = button.dataset;
  if (d.starter !== undefined) setStarter(Number(d.starter));
  else if (button.id === 'begin') startExpedition();
  else if (d.view) {
    ({ map:showMap, party:showParty, bag:showBag, guide:showGuide })[d.view]();
    focusGame();
  } else if (d.roster !== undefined) editRoster(Number(d.roster));
  else if (d.member !== undefined) {
    const m = state.roster[Number(d.member)];
    showDetail(SPECIES[m.speciesId], m);
  } else if (d.species !== undefined) showDetail(SPECIES[Number(d.species)]);
  else if (d.dismiss !== undefined) { notices = []; game.querySelector('.feedback').replaceChildren(); }
});
if (state) showMap(); else showStart();
