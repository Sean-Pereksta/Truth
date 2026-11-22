import { REGIONS, getForm } from './catalog.js';

export { REGIONS };

const SITE_IDS = ['camp', 'grove', 'ford', 'ridge', 'lookout', 'warden', 'hollow'];
const LINKS = [
  ['camp', 'grove'], ['camp', 'ford'], ['grove', 'ford'], ['grove', 'ridge'],
  ['ford', 'warden'], ['ridge', 'lookout'], ['ridge', 'warden'], ['lookout', 'warden'],
  ['grove', 'hollow'], ['lookout', 'hollow'],
];
const LAND = [
  { names: ['Mossbell Camp', 'Bramble Run', 'Old Stump', 'Fern Crossing', 'Honeycomb Oak', 'The Green Ring', 'Moonroot Hollow'],
    signs: ['A spiral of luminous pollen points deeper into the wood.', 'Three amber claw marks shine on the old oak.'],
    points: [[12,65],[34,48],[40,77],[60,55],[67,26],[85,60],[36,20]] },
  { names: ['Stilt Camp', 'Rushwater', 'Wisp Pools', 'Reed Islands', 'Silt Lantern', 'The Lantern Ring', 'Glimmermere'],
    signs: ['Something heavy left a trail of unbroken reeds.', 'A blue light moves against the current.'],
    points: [[13,61],[32,36],[39,76],[57,52],[76,26],[84,70],[49,18]] },
  { names: ['Prospector Camp', 'Glint Tunnel', 'Echo Well', 'Quartz Steps', 'Singing Geode', 'The Prism Vault', 'Opal Deep'],
    signs: ['One echo in the well returns as a low growl.', 'The geode hums a second note when you turn east.'],
    points: [[13,69],[31,46],[40,73],[53,41],[74,30],[85,65],[48,17]] },
  { names: ['Drift Camp', 'Shellbank', 'Tide Bell', 'Saltgrass Bluff', 'Drift Beacon', 'The Breakwater', 'Pearl Grotto'],
    signs: ['One set of silver tracks survives every incoming wave.', 'A pearl scale flashes beneath the old signal fire.'],
    points: [[13,62],[31,37],[40,75],[58,44],[78,27],[85,65],[49,20]] },
  { names: ['Cloud Camp', 'Scree Run', 'Wind Cairn', 'Horn Pass', 'Eagle Spire', 'The Gale Crown', 'Storm Nest'],
    signs: ['A ribbon of frost curls around the sheltered side of the cairn.', 'A huge down feather floats upward past the spire.'],
    points: [[13,73],[31,50],[39,78],[58,46],[69,21],[86,59],[37,23]] },
  { names: ['Cinder Camp', 'Ember Shelf', 'Glass Crater', 'Ash Ravine', 'The Coal Eye', 'The Furnace', 'Sunless Forge'],
    signs: ['A trail of glass footprints ends at the crater.', 'The coal burns violet when you face the old forge.'],
    points: [[13,66],[30,43],[42,76],[58,45],[77,27],[83,68],[48,16]] },
  { names: ['Mosaic Camp', 'Lion Gate', 'Moss Dial', 'Broken Gallery', 'The Empty Throne', 'The Sunken Dais', 'Ivory Crypt'],
    signs: ['A fourth shadow crosses the sundial at midday.', 'Wet steps lead away from the empty throne.'],
    points: [[13,62],[31,41],[41,74],[58,53],[73,24],[86,64],[39,17]] },
  { names: ['Astral Camp', 'Comet Trail', 'Star Glass', 'The Blue Orbit', 'Moon Mirror', 'The Zenith Ring', 'The Last Star'],
    signs: ['A single constellation moves across the glass.', 'The mirror reflects a star hidden beneath your feet.'],
    points: [[13,67],[32,48],[40,79],[61,48],[76,24],[85,67],[42,20]] },
];

export function freshWorld() {
  return { region: 0, unlocked: 0, node: 'camp', cleared: [], clues: [], hunts: [], visits: 0, sightings: {}, patrols: {} };
}

function regionIndex(n) {
  return Number.isInteger(n) && n >= 0 && n < REGIONS.length ? n : 0;
}

function ensureWorld(world) {
  world.unlocked = regionIndex(world.unlocked);
  world.region = Math.min(regionIndex(world.region), world.unlocked);
  if (!SITE_IDS.includes(world.node)) world.node = 'camp';
  for (const key of ['cleared', 'clues', 'hunts']) if (!Array.isArray(world[key])) world[key] = [];
  if (!world.sightings || typeof world.sightings !== 'object') world.sightings = {};
  if (!world.patrols || typeof world.patrols !== 'object') world.patrols = {};
  if (!Number.isInteger(world.visits) || world.visits < 0) world.visits = 0;
  if (world.node === 'hollow' && !hasTrail(world)) world.node = 'camp';
  return world;
}

const keyFor = (region, site) => `${region}/${site}`;
const has = (items, region, site) => items.includes(keyFor(region, site));
function mark(items, region, site) {
  if (!has(items, region, site)) items.push(keyFor(region, site));
}
function hasTrail(world, region = world.region) {
  return has(world.cleared, region, 'warden') && has(world.clues, region, 'ford') && has(world.clues, region, 'lookout');
}
function sigils(world, region = world.region) {
  return ['grove', 'ridge'].filter(site => has(world.cleared, region, site)).length;
}

export function completeEncounter(world, encounter, won) {
  ensureWorld(world);
  if (!won || !encounter || !SITE_IDS.includes(encounter.node)) return world;
  const region = regionIndex(encounter.region);
  mark(world.cleared, region, encounter.node);
  if (encounter.kind === 'tribe') {
    const key = keyFor(region, encounter.node);
    world.patrols[key] = (Number(world.patrols[key]) || 0) + 1;
  }
  if (encounter.kind === 'warden') world.unlocked = Math.max(world.unlocked, Math.min(REGIONS.length - 1, region + 1));
  if (encounter.kind === 'legendary') {
    mark(world.hunts, region, 'hollow');
    world.sightings[region] = 0;
  } else if (hasTrail(world, region)) {
    const prior = world.sightings[region] || 0;
    // Wild sightings are uncommon. Guarantee a fresh track after three successful patrols.
    if (prior !== -1) world.sightings[region] = prior >= 2 || Math.random() < 0.16 ? -1 : prior + 1;
  }
  return world;
}

const SYMBOLS = {
  camp: ['.......o.......','......oyt......','.....oyyyt.....','....oyyyyyt....','...oyyoyyyyt...','..oyyo.oyyyyt..','.oyyo...oyyyyt.','oyyo.....oyyyyt','ooooooooooooooo'],
  tribe: ['..tt...tt......','.tyyt.tyyt..tt.','.tyyt.tyyt.tyyt','..tt...tt..tyyt','............tt.','....ttttt......','...tyyyyyt...tt','..tyyyyyyyt.tyt','.tyyyyyyyyt..t.','.tyytttyyyt....','..tt...ttt.....'],
  sign: ['......o........','.....oyt.......','.....oyt.......','....oyyyt......','..ooyyyyytto...','oyyyyyyyyyyyt..','..ooyyyyytto...','....oyyyt......','.....oyt.......','.....oyt.......','......o........'],
  warden: ['.y.....y.....y.','.yo...oyt...oy.','.yyo.oyyyt.oyy.','.yyyoyyyyytyyyt','.yyyyyyyyyyyyyt','..yyyyyyyyyyyt.','..oooooooooooo.','..tyyyyyyyyyyt.','..tooooooooooo.'],
  hollow: ['.......y.......','......yyt......','.....yyyyt.....','....yyyoyyt....','...yyyo.oyyt...','..yyyo...oyyt..','...yyyo.oyyt...','....yyyoyyt....','.....yyyyt.....','......yyt......','.......t.......'],
};
const RANGER = [
  '......kkk......','.....kmmmkk....','.....kmgmgk....','....kmmmmmkk...','...kmmmgggggk..','.....kffftk....',
  '.....kfyffk....','....kktttkk....','...kccyyycck...','..kcccoyoccck..','..kcccoyocctk..','.kcccmoyomctk..',
  '.kccmmyyymmkk..','..kkksssskk....','....kssksk.....','....kbbkbk.....','...kbbkkbbk....',
];
const RANGER_PALETTE = { k:'#232733',m:'#b95937',g:'#ffbd58',f:'#e8a875',t:'#ae6f53',y:'#ffde94',c:'#287b76',o:'#79c4a2',s:'#51516a',b:'#85513e' };

function stamp(canvas, pixels, palette, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  pixels.forEach((row, y) => [...row].forEach((ink, x) => {
    if (!palette[ink]) return;
    ctx.fillStyle = palette[ink];
    ctx.fillRect(x, y, 1, 1);
  }));
}

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
function button(className, label, onClick) {
  const el = element('button', className, label);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}
function point(region, site) {
  const [x, y] = LAND[region].points[SITE_IDS.indexOf(site)];
  return { x, y };
}
function siteName(region, site) { return LAND[region].names[SITE_IDS.indexOf(site)]; }
function siteType(site) {
  if (site === 'grove' || site === 'ridge') return 'tribe';
  if (site === 'ford' || site === 'lookout') return 'sign';
  return site;
}
function combatLevel(region, site) {
  if (region === 0 && site === 'grove') return 1;
  return REGIONS[region].minLevel + ({grove:0,ridge:1,warden:2,hollow:3}[site] || 0);
}
function leadSpecies(world, site) {
  if (site === 'hollow') return world.region * 7 + 6;
  const rotation = Number(world.patrols[keyFor(world.region, site)]) || 0;
  return world.region * 7 + (world.region + (site === 'grove' ? 3 : 0) + rotation) % 6;
}
function mapLinks(world) {
  return LINKS.filter(edge => !edge.includes('hollow') || hasTrail(world));
}
function adjacent(world, site) {
  return mapLinks(world).filter(edge => edge.includes(site)).map(([a,b]) => a === site ? b : a);
}
function routeTo(world, target) {
  const queue = [[world.node]];
  const seen = new Set([world.node]);
  for (let i=0; i<queue.length; i++) {
    const path = queue[i];
    const end = path[path.length-1];
    if (end === target) return path;
    for (const next of adjacent(world, end)) if (!seen.has(next)) {
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  return [];
}
function trailPoint(region, a, b, t) {
  // The curve is invariant when followed in reverse.
  if (SITE_IDS.indexOf(a) > SITE_IDS.indexOf(b)) return trailPoint(region, b, a, 1-t);
  const p = point(region, a), q = point(region, b);
  const bend = Math.sin(Math.PI * t) * ((SITE_IDS.indexOf(a) + SITE_IDS.indexOf(b)) % 2 ? 0.13 : -0.12);
  return { x:p.x+(q.x-p.x)*t - (q.y-p.y)*bend, y:p.y+(q.y-p.y)*t + (q.x-p.x)*bend };
}

export function mountWorld(root, { world = freshWorld(), onChange, onEncounter, onCamp, onRegion, sprite } = {}) {
  ensureWorld(world);
  let dead = false, walking = false, frame = 0, atlasOpen = false, notice = '';
  let primaryAction = null, dragStart = null;
  const region = () => REGIONS[world.region];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const panel = element('section','ca-world');
  panel.setAttribute('aria-label','Exploration map');
  const heading = element('div','cw-heading');
  const titleBlock = element('div','cw-title-block');
  const eyebrow = element('span','cw-eyebrow');
  const title = element('h2','cw-title');
  titleBlock.append(eyebrow, title);
  const atlasButton = button('cw-atlas-button','Regions', () => toggleAtlas(!atlasOpen));
  atlasButton.setAttribute('aria-expanded','false');
  heading.append(titleBlock, atlasButton);
  const atlas = element('div','cw-atlas');
  atlas.hidden = true;
  const stage = element('div','cw-stage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label','Region trail map. Tap a landmark to walk, or use the arrow keys and Enter.');
  const art = element('div', 'cw-art');
  const rails = element('canvas','cw-trails');
  rails.setAttribute('aria-hidden','true');
  const locations = element('div','cw-locations');
  const ranger = element('div','cw-ranger');
  ranger.setAttribute('aria-hidden','true');
  const figure = element('canvas','cw-figure');
  stamp(figure, RANGER, RANGER_PALETTE, 15, 17);
  ranger.append(figure);
  const rose = element('span','cw-compass','N');
  rose.setAttribute('aria-hidden','true');
  stage.append(art, rails, locations, ranger, rose);
  const detail = element('div','cw-detail');
  const summary = element('div','cw-summary');
  const kicker = element('span','cw-kicker');
  const name = element('h3','cw-site-title');
  const desc = element('p','cw-desc');
  summary.append(kicker,name,desc);
  const actions = element('div','cw-actions');
  detail.append(summary, actions);
  const status = element('div','cw-status');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  panel.append(heading, atlas, stage, detail, status);
  root.replaceChildren(panel);

  function persist() { onChange?.(world); }
  function placeRanger(p) { ranger.style.left = `${p.x}%`; ranger.style.top = `${p.y}%`; }
  function paintRails() {
    if (dead) return;
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    rails.width = Math.round(width*scale);
    rails.height = Math.round(height*scale);
    const ctx = rails.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale,scale);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [a,b] of mapLinks(world)) {
      ctx.beginPath();
      for (let j=0; j<=22; j++) {
        const p = trailPoint(world.region, a, b, j/22);
        ctx[j ? 'lineTo' : 'moveTo'](p.x * width/100,p.y * height/100);
      }
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(25,32,33,.7)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.setLineDash([2,5]); ctx.strokeStyle = a === 'hollow' || b === 'hollow' ? '#94fae0' : '#ffe1a0'; ctx.lineWidth = 2.4; ctx.stroke();
    }
  }
  function fillLocations() {
    locations.replaceChildren();
    for (const site of SITE_IDS) {
      if (site === 'hollow' && !hasTrail(world)) continue;
      const type = siteType(site), p = point(world.region, site);
      const cleared = has(world.cleared,world.region,site) || has(world.clues,world.region,site);
      const label = siteName(world.region,site);
      const node = button(`cw-node cw-node-${type}${cleared?' cw-cleared':''}`,'', () => go(site));
      node.dataset.site = site;
      node.style.left = `${p.x}%`; node.style.top = `${p.y}%`;
      node.title = `${label} · ${type === 'sign' ? 'trail sign' : type}`;
      node.setAttribute('aria-label', `${node.title}${cleared ? ', explored' : ''}${world.node === site ? ', current location' : ''}`);
      node.setAttribute('aria-current', world.node === site ? 'location' : 'false');
      const token = element('span','cw-token');
      const glyph = element('canvas','cw-node-glyph');
      const palette = { y: type === 'hollow' ? '#abffe7' : '#ffe3a6', t:'#d49763', o:'#8d6549' };
      stamp(glyph, SYMBOLS[type], palette, 15, SYMBOLS[type].length);
      token.append(glyph);
      if (cleared) token.append(element('span','cw-clear-mark','✓'));
      const caption = element('span','cw-node-name',label);
      node.append(token,caption);
      if (sprite && (type === 'tribe' || (type === 'hollow' && world.sightings[world.region] === -1))) {
        const creature = element('span','cw-roamer');
        creature.setAttribute('aria-hidden','true');
        const speciesId = leadSpecies(world, site);
        const form = getForm({speciesId, level:combatLevel(world.region,site)});
        creature.innerHTML = sprite(speciesId, form.stage);
        node.append(creature);
        node.title += ` · ${form.name}`;
        node.setAttribute('aria-label', `${node.getAttribute('aria-label')}, ${form.name} sighted`);
      }
      locations.append(node);
    }
  }
  function addAction(label, action, secondary=false) {
    if (!secondary) primaryAction = action;
    actions.append(button(secondary?'cw-secondary':'cw-primary',label,action));
  }
  function battle(site) {
    if (dead || walking) return;
    const kind = site === 'hollow' ? 'legendary' : site === 'warden' ? 'warden' : 'tribe';
    onEncounter?.({region:world.region, kind, node:site, level:combatLevel(world.region,site), name:siteName(world.region,site), leadSpeciesId:kind === 'tribe' ? leadSpecies(world, site) : undefined});
  }
  function investigate() {
    mark(world.clues,world.region,world.node);
    notice = LAND[world.region].signs[world.node === 'ford' ? 0 : 1];
    persist();
    if (!dead) render();
  }
  function details() {
    const r = world.region, site = world.node, type = siteType(site);
    const studied = has(world.clues,r,site);
    const won = has(world.cleared,r,site);
    const count = sigils(world), secured = has(world.cleared,r,'warden');
    actions.replaceChildren(); primaryAction = null;
    name.textContent = siteName(r,site);
    if (type === 'camp') {
      kicker.textContent = 'Trail camp';
      desc.textContent = secured ? 'The warden’s crest is yours. Revisit a trail or travel to an open region.' : 'Win at both tribal grounds to challenge the regional warden.';
      const next = !has(world.cleared,r,'grove') ? 'grove' : !has(world.cleared,r,'ridge') ? 'ridge' : 'warden';
      if (secured && r < REGIONS.length - 1) addAction('Next region', () => travel(r+1));
      else addAction(secured ? 'Explore trails' : count === 2 ? 'Visit warden' : 'Track a tribe', () => go(next));
      if (onCamp) addAction('Manage party', onCamp, true);
    } else if (type === 'tribe') {
      kicker.textContent = `Tribal ground · Lv. ${combatLevel(r,site)}`;
      const leader = getForm({speciesId:leadSpecies(world, site), level:combatLevel(r,site)}).name;
      desc.textContent = won ? `${leader} now leads the tribe here. Battle again to train or capture a Critter.` : `You spot ${leader} among the ${region().tribe}. Defeat or capture the tribe to earn a trail mark.`;
      addAction('Encounter tribe', () => battle(site));
    } else if (type === 'sign') {
      kicker.textContent = studied ? 'Trail sign recorded' : 'Unexplored trail sign';
      desc.textContent = studied ? LAND[r].signs[site === 'ford' ? 0 : 1] : 'An unusual mark has survived here. Investigate it to track a hidden Critter.';
      if (!studied) addAction('Read the sign', investigate);
      else if (hasTrail(world)) addAction('Follow the signs', () => go('hollow'));
      else addAction(has(world.clues,r,site === 'ford' ? 'lookout' : 'ford') ? 'Visit warden' : 'Find other sign', () => go(has(world.clues,r,site === 'ford' ? 'lookout' : 'ford') ? 'warden' : (site === 'ford' ? 'lookout' : 'ford')));
    } else if (type === 'warden') {
      kicker.textContent = `Warden arena · Lv. ${combatLevel(r,site)}`;
      desc.textContent = secured ? (r === 7 ? 'You have earned the last crest. Rare Critters still roam the eight regions.' : 'Your crest opens the trail to the next region.') : count === 2 ? 'Both tribal marks are yours. Defeat the warden’s force to earn this region’s crest.' : `Earn both tribal marks before you challenge this arena (${count}/2).`;
      if (secured && r < REGIONS.length - 1) { addAction('Next region', () => travel(r+1)); addAction('Rematch', () => battle(site), true); }
      else if (count === 2) addAction(secured ? 'Rematch warden' : 'Challenge warden', () => battle(site));
      else addAction('Find a tribe', () => go(has(world.cleared,r,'grove') ? 'ridge' : 'grove'));
    } else {
      kicker.textContent = 'Legendary habitat';
      const sighted = world.sightings[r] === -1;
      desc.textContent = sighted ? 'A rare Critter waits in the clearing. Weaken it and try a capture before it falls.' : 'The trail is quiet. Win a local battle to draw this elusive Critter out. A sighting is certain within three wins.';
      addAction(sighted ? 'Approach legendary' : 'Patrol the trail', () => sighted ? battle(site) : go('ridge'));
    }
    status.textContent = notice;
  }
  function updateAtlas() {
    atlas.replaceChildren();
    REGIONS.forEach((item,i) => {
      const allowed = i <= world.unlocked;
      const row = button('cw-region', '', () => travel(i));
      row.disabled = !allowed;
      row.setAttribute('aria-current', i === world.region ? 'location' : 'false');
      const thumb = element('span','cw-region-thumb');
      thumb.style.backgroundPosition = `${i%2*100}% ${Math.floor(i/2)*100/3}%`;
      const info = element('span','cw-region-info');
      info.append(element('b','',item.name), element('small','', allowed ? (i === world.region ? 'Exploring' : `Level ${combatLevel(i,'grove')}+`) : `Earn the ${REGIONS[i-1].name} crest`));
      row.append(thumb,info); atlas.append(row);
    });
  }
  function toggleAtlas(open) {
    if (walking) return;
    atlasOpen = open;
    atlas.hidden = !open; stage.hidden = open; detail.hidden = open;
    atlasButton.textContent = open ? 'Back to trail' : 'Regions';
    atlasButton.setAttribute('aria-expanded',String(open));
    if (open) updateAtlas(); else { paintRails(); atlasButton.focus({preventScroll:true}); }
  }
  function render() {
    const i = world.region;
    eyebrow.textContent = `Region ${String(i+1).padStart(2,'0')} / 08  ·  Lv. ${combatLevel(i,'grove')}+`;
    title.textContent = region().name;
    art.style.backgroundPosition = `${i%2*100}% ${Math.floor(i/2)*100/3}%`;
    stage.dataset.biome = String(i);
    fillLocations(); placeRanger(point(i,world.node)); paintRails(); details();
    if (atlasOpen) updateAtlas();
  }
  function travel(i) {
    if (walking || i > world.unlocked || regionIndex(i) !== i) return;
    toggleAtlas(false);
    if (world.region === i) return;
    world.region = i; world.node = 'camp'; notice = `Arrived at ${REGIONS[i].name}.`;
    onRegion?.(i); persist();
    if (!dead) render();
  }
  function go(site) {
    if (dead || walking || atlasOpen) return;
    if (site === world.node) { details(); return; }
    const path = routeTo(world, site);
    if (path.length < 2) return;
    walking = true; notice = ''; status.textContent = ''; primaryAction = null;
    stage.classList.add('cw-walking'); actions.replaceChildren();
    kicker.textContent = 'On the trail'; name.textContent = siteName(world.region,site); desc.textContent = 'Your party is on the move.';
    const i = world.region;
    let startTime, leg = 0;
    function step(now) {
      if (dead) return;
      if (startTime === undefined) startTime = now;
      const a = path[leg], b = path[leg+1];
      const p = point(i,a), q = point(i,b);
      const duration = Math.min(570,Math.max(290,Math.hypot(q.x-p.x,q.y-p.y)*11));
      const t = reducedMotion ? 1 : Math.min(1,(now-startTime)/duration);
      const pos = trailPoint(i,a,b,t);
      placeRanger(pos); figure.classList.toggle('cw-facing-left',q.x < p.x);
      if (t < 1) { frame = requestAnimationFrame(step); return; }
      leg++; startTime = now;
      if (leg < path.length-1) { frame = requestAnimationFrame(step); return; }
      walking = false; stage.classList.remove('cw-walking'); world.node = site; world.visits++;
      persist();
      if (!dead) { render(); status.textContent = `Reached ${siteName(i,site)}.`; }
    }
    frame = requestAnimationFrame(step);
  }
  function moveDirection(dx,dy) {
    if (walking || atlasOpen) return;
    const start = point(world.region,world.node);
    const scaleX = stage.clientWidth/100, scaleY = stage.clientHeight/100;
    const choices = adjacent(world,world.node).map(site => {
      const end = point(world.region,site), x = (end.x-start.x)*scaleX, y = (end.y-start.y)*scaleY;
      const length = Math.hypot(x,y);
      return {site,score:(x*dx+y*dy)/length - 0.00018*length};
    }).sort((a,b) => b.score-a.score);
    if (choices[0]?.score > 0.26) go(choices[0].site);
  }
  const keys = {ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
  function keydown(e) {
    if (dead || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || e.target.closest?.('input,textarea,select,[contenteditable=true],dialog,[role=dialog]')) return;
    if (document.querySelector('dialog[open], [aria-modal=true]:not([hidden])')) return;
    if (e.key === 'Escape' && atlasOpen) { e.preventDefault(); toggleAtlas(false); return; }
    if (atlasOpen) return;
    if (keys[e.key]) { e.preventDefault(); if (!e.repeat || !walking) moveDirection(...keys[e.key]); }
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest?.('button,a')) { e.preventDefault(); if (!e.repeat) primaryAction?.(); }
  }
  stage.addEventListener('pointerdown', e => { if (!e.target.closest('button')) dragStart=[e.clientX,e.clientY]; });
  stage.addEventListener('pointerup', e => {
    if (!dragStart) return;
    const x=e.clientX-dragStart[0], y=e.clientY-dragStart[1]; dragStart=null;
    if (Math.hypot(x,y)>26) moveDirection(...(Math.abs(x)>Math.abs(y) ? [Math.sign(x),0] : [0,Math.sign(y)]));
  });
  stage.addEventListener('pointercancel', () => { dragStart=null; });
  window.addEventListener('keydown',keydown);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(paintRails) : null;
  observer?.observe(stage);
  window.addEventListener('resize',paintRails);
  render();
  return () => {
    dead = true; cancelAnimationFrame(frame); observer?.disconnect();
    window.removeEventListener('resize',paintRails); window.removeEventListener('keydown',keydown);
  };
}
