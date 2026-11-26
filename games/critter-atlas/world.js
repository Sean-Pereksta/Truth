import { MAX_LEVEL, REGIONS, SPECIES, getForm, localFamilies } from './catalog.js';
import { EXPANSION_REGIONS } from './expansion-regions.js';
import { TRAIL_HABITATS } from './trail-species.js';
import { DISTRICTS, SITE_IDS, WONDERS, sitesFor, hasSite, siteName, siteType, districtName, districtOf, districtDescription, signText,
  keyFor, mark, has, point, requirements, routeHint, unlockedSites, adjacent, linksFor, routeTo } from './frontier-routes.js';

export { REGIONS, siteName, routeHint, unlockedSites };

export function freshWorld() {
  return { region: 0, unlocked: 0, node: 'camp', cleared: [], clues: [], hunts: [], visits: 0, sightings: {}, patrols: {}, wonders: {} };
}

function regionIndex(n) {
  return Number.isInteger(n) && n >= 0 && n < REGIONS.length ? n : 0;
}

export function ensureWorld(world) {
  world.unlocked = regionIndex(world.unlocked);
  for (const key of ['cleared', 'clues', 'hunts']) if (!Array.isArray(world[key])) world[key] = [];
  while (world.unlocked < REGIONS.length - 1 && has(world.cleared,world.unlocked,'warden')) world.unlocked++;
  world.region = regionIndex(world.region);
  if (!hasSite(world.region,world.node)) world.node = 'camp';
  if (!world.sightings || typeof world.sightings !== 'object') world.sightings = {};
  if (!world.patrols || typeof world.patrols !== 'object') world.patrols = {};
  if (!world.wonders || typeof world.wonders !== 'object') world.wonders = {};
  if (!Number.isInteger(world.visits) || world.visits < 0) world.visits = 0;
  // An old expedition can be parked beyond a gate introduced by the expansion.
  // Return it to the nearest open district entrance without fabricating victories.
  if (requirements(world,world.region,world.node).length) {
    const entrances = ['camp','entry','farpost'].slice(0,districtOf(world.node)+1);
    world.node = entrances.reverse().find(site => !requirements(world,world.region,site).length);
  }
  return world;
}

export function travelToRegion(world, region) {
  if (regionIndex(region) !== region || world.region === region) return false;
  world.region = region;
  world.node = 'camp';
  return true;
}

function hasTrail(world, region = world.region) {
  return requirements(world,region,'hollow').length === 0;
}

const SEARCH_LIMIT = 12;
export function restoreWonderTrails(data) {
  const trails = {};
  for (const [region,landmark] of Object.entries(WONDERS)) {
    const saved = data?.[region];
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) continue;
    const progress = Number.isSafeInteger(saved.progress) ? Math.min(SEARCH_LIMIT,Math.max(0,saved.progress)) : 0;
    trails[region] = {
      progress, ready: saved.ready === true || progress === SEARCH_LIMIT,
      lastSite: landmark.patrols.includes(saved.lastSite) ? saved.lastSite : null
    };
  }
  return trails;
}
export function wonderProgress(world,region = world.region) {
  const landmark = WONDERS[region];
  if (!landmark) return null;
  const trail = world.wonders?.[region];
  const progress = trail?.progress ?? 0;
  return {
    name:landmark.name, clue:landmark.clue, patrols:landmark.patrols,
    open:!requirements(world,region,'wonder').length,
    ready:trail?.ready === true, lastSite:trail?.lastSite ?? null, progress,
    chance:progress >= SEARCH_LIMIT-1 ? 1 : (4+progress*2)/100
  };
}
export function completeEncounter(world, encounter, won, captured = [], rng = Math.random) {
  ensureWorld(world);
  if (!encounter || !hasSite(encounter.region,encounter.node)) return world;
  const region = regionIndex(encounter.region), site = encounter.node;
  const trail = wonderProgress(world,region);
  if (site === 'wonder') {
    const secured = captured.some(member => member.speciesId === encounter.leadSpeciesId);
    if (!trail?.open || !trail.ready || (!won && !secured)) return world;
    delete world.wonders[region];
    mark(world.hunts,region,site);
  } else if (won && encounter.kind === 'tribe' && trail?.open && !trail.ready &&
      trail.patrols.includes(site) && trail.lastSite !== site) {
    const progress = trail.progress + 1;
    world.wonders[region] = {progress, lastSite:site, ready:progress >= SEARCH_LIMIT || rng() < trail.chance};
  }
  if (!won) return world;
  mark(world.cleared,region,site);
  const key = keyFor(region,site);
  world.patrols[key] = (Number(world.patrols[key]) || 0) + 1;
  if (encounter.kind === 'warden' && site === 'warden') world.unlocked = Math.max(world.unlocked,Math.min(REGIONS.length-1,region+1));
  if (encounter.kind === 'legendary') {
    mark(world.hunts,region,site);
    if (site === 'hollow') world.sightings[region] = 0;
  } else if (hasTrail(world,region)) {
    const prior = world.sightings[region] || 0;
    if (prior !== -1) world.sightings[region] = prior >= 2 || Math.random() < .16 ? -1 : prior + 1;
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
SYMBOLS.town = ['......yyy......','....yyyyyyy....','..yyyoyoyoyyy..','.yyyyyyyyyyyyy.','..tytytytytyt..','...ottttttto...','...oy..y..yo...','...oy..y..yo...','...ooooooooo...'];
SYMBOLS.guardian = ['...yyyyyyyyy...','...ytttootty...','...ytttootty...','...yyyyyyyyy...','....tyoooyt....','.....tyoyt.....','......tyt......','.......t.......'];
SYMBOLS.pass = ['..yyy.....yyy..','..yty.....yty..','..yyyyyyyyyyy..','..ytootoootty..','..yto.....oty..','..yto.....oty..','..yyo.....oyy..'];
SYMBOLS.arena = ['.yy....y....yy.','.tyy..yyy..yyt.','.tyyyyyyyyyyyt.','..tyyyyyyyyyt..','...tyoooyyyt...','....tyyyyyt....','......tyt......','.....yyyyy.....'];
SYMBOLS.habitat = SYMBOLS.tribe;
SYMBOLS.vault = SYMBOLS.hollow;
SYMBOLS.wonder = ['.....y...y.....','.....ty.yt.....','..y...yyy...y..','..tyyoyyyoyyt..','....oytytyo....','..yyyytotyyyy..','....oytytyo....','..tyyoyyyoyyt..','..y...yyy...y..','.....ty.yt.....','.....y...y.....'];
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
// A venue keeps its rank on rematches and when the player changes companions.
// The elite route opens after the warden and culminates at the level cap.
const venueLevels = {
  trial:    [7, 13, 19, 25, 31, 36, 41, 46],
  warden:   [9, 15, 21, 27, 33, 38, 43, 48],
  den:      [10, 16, 22, 28, 34, 39, 44, 49],
  sentinel: [11, 17, 23, 29, 35, 40, 45, 50],
  vault:    [12, 18, 24, 30, 36, 41, 46, 51]
};
const trailOffsets = { outpost: 2, ridge: 2, habitat: 2, rookery: 4 };
function combatLevel(region, site) {
  if (site === 'wonder') return Math.min(MAX_LEVEL,combatLevel(region,'vault') + 2);
  if (site === 'hollow') return combatLevel(region,'warden') + 1;
  const expansion = EXPANSION_REGIONS[region - venueLevels.trial.length];
  const offset = TRAIL_HABITATS[site]?.levelOffset ?? trailOffsets[site] ?? 0;
  const rank = expansion?.levels[site] ?? venueLevels[site]?.[region] ?? Math.min(MAX_LEVEL, REGIONS[region].minLevel + offset);
  return site === 'refuge' ? Math.max(rank,combatLevel(region,'warden')) : rank;
}
function countWins(world,site) { return world.patrols[keyFor(world.region,site)] || 0; }
const newResident = (r,site) => SPECIES.find(s => s.region === r && s.habitatId === site);
function leadSpecies(world,site) {
  const r = world.region, wins = countWins(world,site), local = localFamilies(r);
  if (site === 'hollow') return local[6].id;
  const resident = newResident(r,site);
  if (resident && (site === 'vault' || site === 'wonder' || TRAIL_HABITATS[site] || wins % 3 === 0)) return resident.id;
  if (['outpost','den','sentinel','rookery'].includes(site)) return local[wins % 2 ? 4 : 5].id;
  return local[(r + (site === 'grove' ? 3 : 0) + wins) % 6].id;
}
function legendaryPresent(world,site) {
  return site === 'vault' ? countWins(world,'sentinel') > countWins(world,'vault') : world.sightings[world.region] === -1;
}
export function encounterAt(world,site,{youngling=false} = {}) {
  if (site !== world.node || !unlockedSites(world).includes(site)) return null;
  const type = siteType(site), region = world.region;
  if (!['tribe','guardian','habitat','arena','warden','vault','hollow','wonder'].includes(type)) return null;
  const firstClear = !has(world.cleared,region,site);
  if (type === 'wonder') {
    const resident = newResident(region,site);
    if (!wonderProgress(world,region)?.ready || !resident) return null;
    return {region,kind:'wonder',node:site,name:siteName(region,site),level:combatLevel(region,site),firstClear,
      habitatId:site,leadSpeciesId:resident.id,youngling:youngling === true};
  }
  const legendary = type === 'hollow' || type === 'vault';
  if (legendary && !legendaryPresent(world,site)) return null;
  const kind = legendary ? 'legendary' : type === 'warden' ? 'warden' : type === 'arena' ? 'arena' : 'tribe';
  const deepPatrol = region >= 5 && (type === 'guardian' || ['rookery','refuge'].includes(site));
  const patrolSize = kind !== 'tribe' ? undefined : region === 0 ? 2 : deepPatrol ? 4 : 3;
  return {region,kind,node:site,name:siteName(region,site),level:combatLevel(region,site),firstClear,patrolSize,
    arenaId:type === 'arena' ? 'trial' : type === 'warden' ? 'warden' : undefined,
    habitatId:legendary || type === 'habitat' ? site : undefined,
    leadSpeciesId:kind === 'tribe' || legendary ? leadSpecies(world,site) : undefined};
}
const portals = {pass:'entry', entry:'pass', highpass:'farpost', farpost:'highpass'};
function trailPoint(region, a, b, t) {
  // The curve is invariant when followed in reverse.
  if (SITE_IDS.indexOf(a) > SITE_IDS.indexOf(b)) return trailPoint(region, b, a, 1-t);
  const p = point(region, a), q = point(region, b);
  const bend = Math.sin(Math.PI * t) * ((SITE_IDS.indexOf(a) + SITE_IDS.indexOf(b)) % 2 ? 0.13 : -0.12);
  return { x:p.x+(q.x-p.x)*t - (q.y-p.y)*bend, y:p.y+(q.y-p.y)*t + (q.x-p.x)*bend };
}

export function mountWorld(root, { world = freshWorld(), inspectSite, onChange, onEncounter, onCamp, onMarket, onRegion, sprite, getFind, onGather, partyLevel = 0 } = {}) {
  ensureWorld(world);
  let dead = false, walking = false, frame = 0, atlasOpen = false, notice = '';
  let target = hasSite(world.region,inspectSite) ? inspectSite : world.node;
  let page = districtOf(target), primaryAction = null;
  let camera = { x: 0, y: 0 }, cameraKey, fitMap = true, pointer = null, suppressClick = false, rangerPoint;
  const districtCameras = new Map();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const panel = element('section','ca-world');
  panel.setAttribute('aria-label','Exploration map');
  const heading = element('div','cw-heading'), titleBlock = element('div','cw-title-block');
  const eyebrow = element('span','cw-eyebrow'), title = element('h2','cw-title');
  titleBlock.append(eyebrow,title);
  const atlasButton = button('cw-atlas-button','Regions', () => toggleAtlas(!atlasOpen));
  atlasButton.setAttribute('aria-expanded','false');
  heading.append(titleBlock,atlasButton);
  const atlas = element('div','cw-atlas'); atlas.hidden = true;
  const districtNav = element('nav','cw-district-nav'); districtNav.setAttribute('aria-label','District maps');
  const mapControls = element('div','cw-map-controls');
  const mapHint = element('span','cw-map-hint','District overview');
  const findRanger = button('cw-map-action','Find ranger', () => {
    if (walking) revealCamera(rangerPoint, true);
    else viewHere();
  });
  const zoomButton = button('cw-map-action','Zoom in', () => {
    fitMap = !fitMap;
    stage.classList.toggle('cw-fit-map', fitMap);
    zoomButton.textContent = fitMap ? 'Zoom in' : 'Fit map';
    mapHint.textContent = fitMap ? 'District overview' : 'Drag to explore';
    if (fitMap) setCamera(0,0);
    else restoreDistrictCamera();
    paintRails();
  });
  mapControls.append(mapHint,zoomButton,findRanger);
  const stage = element('div','cw-stage cw-fit-map');
  stage.setAttribute('role','group');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label','Trail map. Drag or press Shift and an arrow key to pan. Select a landmark or use the arrow keys to walk.');
  const sheet = element('div','cw-map-sheet');
  const art = element('div','cw-art'), rails = element('canvas','cw-trails'), locations = element('div','cw-locations');
  rails.setAttribute('aria-hidden','true');
  const ranger = element('div','cw-ranger'); ranger.setAttribute('aria-hidden','true');
  const figure = element('canvas','cw-figure');
  stamp(figure,RANGER,RANGER_PALETTE,15,17); ranger.append(figure);
  const rose = element('span','cw-compass','N'); rose.setAttribute('aria-hidden','true');
  sheet.append(art,rails,locations,ranger);
  stage.append(sheet,rose);
  const detail = element('div','cw-detail'), summary = element('div','cw-summary');
  const wonderScene = element('div','cw-wonder-scene'); wonderScene.hidden=true; wonderScene.setAttribute('aria-hidden','true');
  const kicker = element('span','cw-kicker'), name = element('h3','cw-site-title'), desc = element('p','cw-desc');
  summary.append(kicker,name,desc);
  const actions = element('div','cw-actions'); detail.append(wonderScene,summary,actions);
  const status = element('div','cw-status'); status.setAttribute('role','status');
  panel.append(heading,atlas,districtNav,mapControls,stage,detail,status); root.replaceChildren(panel);
  const landmark = site => siteName(world.region,site);
  const threat = level => {
    if (!partyLevel || level - partyLevel < 4) return '';
    return level - partyLevel >= 9 ? 'Severe danger' : 'High danger';
  };
  const did = site => has(world.cleared,world.region,site);
  const open = site => !requirements(world,world.region,site).length;
  const typeNames = {camp:'Trail camp',town:'Market town',tribe:'Tribal ground',guardian:'Route guardian',sign:'Trail sign',pass:'District crossing',habitat:'Wild habitat',arena:'Qualifier arena',warden:'Warden arena',hollow:'Legendary habitat',vault:'Legendary sanctuary',wonder:'Hyper Rare lair'};

  function setCamera(x,y) {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    camera = {
      x: Math.max(0,Math.min(x,sheet.clientWidth-width)),
      y: Math.max(0,Math.min(y,sheet.clientHeight-height))
    };
    if (!fitMap) districtCameras.set(cameraKey,camera);
    sheet.style.translate = -camera.x+'px '+(-camera.y)+'px';
  }
  function revealCamera(p, center = false) {
    if (!p || fitMap) return;
    const width = stage.clientWidth, height = stage.clientHeight;
    const x = p.x * sheet.clientWidth / 100, y = p.y * sheet.clientHeight / 100;
    const padX = Math.min(68,width/4), padY = Math.min(58,height/4);
    const nextX = center ? x-width/2 : Math.min(x-padX,Math.max(x-width+padX,camera.x));
    const nextY = center ? y-height/2 : Math.min(y-padY,Math.max(y-height+padY,camera.y));
    setCamera(nextX,nextY);
  }
  function restoreDistrictCamera(focus) {
    const previous = districtCameras.get(cameraKey);
    setCamera(previous?.x ?? 0,previous?.y ?? 0);
    if (focus || !previous) {
      const site = [target,world.node].find(site => districtOf(site)===page) ?? sitesFor(world.region,page)[0];
      revealCamera(focus ?? point(world.region,site),true);
    }
  }
  function syncCamera(focus) {
    const key = world.region+'/'+page;
    if (key!==cameraKey || focus) {
      cameraKey=key;
      restoreDistrictCamera(focus);
    }
  }
  function placeRanger(p) { rangerPoint=p; ranger.style.left=p.x+'%'; ranger.style.top=p.y+'%'; }
  function paintRails() {
    const width=sheet.clientWidth, height=sheet.clientHeight;
    if (dead || !width || !height) return;
    const scale=Math.min(window.devicePixelRatio || 1,2);
    rails.width=Math.round(width*scale); rails.height=Math.round(height*scale);
    const ctx=rails.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale,scale); ctx.lineJoin='round'; ctx.lineCap='round';
    for (const [a,b] of linksFor(world.region)) {
      if (districtOf(a)!==page || districtOf(b)!==page) continue;
      if ((a==='wonder'||b==='wonder') && !open('wonder') && target!=='wonder') continue;
      const locked=!open(a)||!open(b);
      ctx.beginPath();
      for(let j=0;j<=22;j++){
        const p=trailPoint(world.region,a,b,j/22);
        ctx[j ? 'lineTo':'moveTo'](p.x*width/100,p.y*height/100);
      }
      ctx.setLineDash([]);ctx.strokeStyle=locked?'#222a2b70':'#26342ae0';ctx.lineWidth=5;ctx.stroke();
      ctx.setLineDash(locked?[3,7]:[2,5]);ctx.strokeStyle=locked?'#9faaa4':'#ffda91';ctx.lineWidth=2.4;ctx.stroke();
    }
  }
  function drawDistrictNav() {
    districtNav.replaceChildren();
    DISTRICTS.forEach((_,i) => {
      const sites = sitesFor(world.region,i);
      const accessible=sites.some(open), here=districtOf(world.node)===i;
      const item=button('cw-district','',() => {
        if (walking || page===i) return;
        page=i;
        target=here?world.node:sites[0];
        notice=''; render();
      });
      item.dataset.district=i;
      item.setAttribute('aria-current',page===i?'page':'false');
      const state = element('span','cw-district-state',here?'●':accessible?'◇':'⊘');
      state.setAttribute('aria-hidden','true');
      item.append(state,element('span','',districtName(world.region,i)));
      item.classList.toggle('cw-closed',!accessible);
      item.title=(here?'Current district · ':accessible?'Open district · ':'Sealed district · ')+districtName(world.region,i);
      item.setAttribute('aria-label',item.title);
      districtNav.append(item);
    });
  }
  function fillLocations() {
    locations.replaceChildren();
    for (const site of sitesFor(world.region,page)) {
      const type=siteType(site), p=point(world.region,site), cleared=did(site)||has(world.clues,world.region,site), locked=!open(site);
      if (site==='wonder' && locked && target!==site) continue;
      const label=landmark(site);
      const el=button('cw-node cw-node-'+type+(locked?' cw-locked':''),'',() => go(site));
      el.dataset.site=site;el.style.left=p.x+'%';el.style.top=p.y+'%';
      const inspecting=site===target && site!==world.node;
      el.classList.toggle('cw-inspecting',inspecting);
      el.title=label+' · '+typeNames[type]+(locked?' · Closed route':'');
      el.setAttribute('aria-label',el.title+(world.node===site?', current location':inspecting?', selected landmark':''));
      el.setAttribute('aria-current',world.node===site?'location':'false');
      const token=element('span','cw-token'), glyph=element('canvas','cw-node-glyph');
      const palette=type==='wonder' ? {y:'#fff2ab',t:'#72eff0',o:'#e194fa'} :
        {y: type==='vault'||type==='hollow'?'#b8fae1':'#ffe3a6',t:'#d49763',o:'#8d6549'};
      stamp(glyph,SYMBOLS[type],palette,15,SYMBOLS[type].length);
      token.append(glyph);
      if (locked) { const lock=element('span','cw-lock');lock.setAttribute('aria-hidden','true');token.append(lock); }
      else if(cleared) token.append(element('span','cw-clear-mark','✓'));
      const caption=element('span','cw-node-name',label);
      el.append(token,caption);
      const find=!locked && getFind?.(world.region,site);
      if (find) {
        const cache=element('span','cw-find');cache.setAttribute('aria-hidden','true');token.append(cache);
        el.title+=' · '+find.name+' available';
        el.setAttribute('aria-label',el.getAttribute('aria-label')+', '+find.name+' available');
      }
      const isWild=['tribe','habitat','guardian'].includes(type) || (['hollow','vault'].includes(type) && legendaryPresent(world,site)) ||
        (type==='wonder' && wonderProgress(world)?.ready);
      if(sprite && !locked && isWild) {
        const speciesId=leadSpecies(world,site), form=getForm({speciesId,level:combatLevel(world.region,site)});
        const creature=element('span','cw-roamer');creature.setAttribute('aria-hidden','true');
        creature.innerHTML=sprite(speciesId,form.stage); el.append(creature);
        el.title+=' · '+form.name;
        el.setAttribute('aria-label',el.getAttribute('aria-label')+', '+form.name+' sighted');
      }
      locations.append(el);
    }
  }
  function addAction(label,action,secondary=false) {
    if(!secondary) primaryAction=action;
    actions.append(button(secondary?'cw-secondary':'cw-primary',label,action));
  }
  function missingText(site) {
    const missing=requirements(world,world.region,site);
    return missing.map(id => (siteType(id)==='sign'?'Read the sign at ':'Win at ')+landmark(id)).join('. ')+'.';
  }
  function inspectClosed(site) {
    kicker.textContent='Closed route';name.textContent=landmark(site);desc.textContent=missingText(site);
    const first=requirements(world,world.region,site)[0];
    if(first) addAction('Find '+landmark(first),() => go(first));
    addAction('Your location',() => viewHere(),true);
  }
  function viewHere() {
    page=districtOf(world.node);target=world.node;notice='';render(point(world.region,world.node));
  }
  function challenge(options) {
    const encounter=encounterAt(world,world.node,options);
    if(!dead && !walking && encounter) onEncounter?.(encounter);
  }
  function details() {
    actions.replaceChildren();primaryAction=null;
    wonderScene.hidden=true;
    const r=world.region,site=target,type=siteType(site);
    if(!open(site)) {inspectClosed(site);return;}
    name.textContent=landmark(site);kicker.textContent=typeNames[type];
    if (['tribe','guardian','habitat','arena','warden','vault','hollow'].includes(type)) {
      const level = combatLevel(r,site), danger = threat(level);
      kicker.textContent += ' · Lv. '+level+(danger ? ' · '+danger : '');
    }
    if(type==='wonder') {
      const trail=wonderProgress(world), resident=newResident(r,site);
      wonderScene.hidden=false;
      wonderScene.style.backgroundPosition='center '+(Object.keys(WONDERS).indexOf(String(r))*25)+'%';
      if(trail.ready && resident) {
        kicker.textContent+=' · Fresh tracks';
        desc.textContent=resident.name+' is here. Track the local form at level '+combatLevel(r,site)+' or follow a level 3 youngling with a strong local escort.';
        if (site===world.node) {
          addAction('Track '+resident.name,challenge);
          addAction('Track a youngling · Lv. 3',() => challenge({youngling:true}),true);
        } else addAction('Travel here',() => go(site));
      } else {
        kicker.textContent+=' · Search '+trail.progress+' / '+SEARCH_LIMIT;
        desc.textContent=trail.clue+' Alternate between marked patrols. Your next victory there has a '+Math.round(trail.chance*100)+'% chance of revealing tracks. Tracks are certain by search '+SEARCH_LIMIT+'.';
        const available=trail.patrols.filter(id => id!==trail.lastSite && open(id));
        available.forEach((id,index) => addAction('Search '+landmark(id),() => go(id),index>0));
        if (site!==world.node) addAction('Travel here',() => go(site),true);
      }
      return;
    }
    if(site!==world.node) {
      desc.textContent=districtDescription(r,page);
      addAction('Travel here',() => go(site));addAction('Your location',viewHere,true);return;
    }
    if(type==='camp') {
      const easternTrail=open('entry');
      desc.textContent='The market is open at '+landmark('town')+'. '+(easternTrail
        ? 'Follow the eastern trail to '+districtName(r,1)+'.'
        : 'Win at '+landmark('grove')+' to open the '+districtName(r,1)+' trail.');
      addAction(easternTrail?'Explore next district':'Track a tribe',() => go(easternTrail?'entry':'grove'));
      addAction('Visit market town',() => go('town'),true);
      if(onCamp) addAction('Manage party',onCamp,true);
    } else if(type==='town') {
      desc.textContent='Trade supplies and Critters with the merchants at '+landmark(site)+'. Local buyers have their own stock and prices.';
      if(onMarket) addAction('Enter market',() => onMarket(r));
      addAction('Nearby tribe',() => go('grove'),true);
    } else if(type==='pass') {
      const next=portals[site], dest=districtName(r,districtOf(next));
      if(open(next)) { desc.textContent=districtDescription(r,districtOf(next)); addAction('Cross to '+dest,() => go(next)); }
      else {desc.textContent='The passage to '+dest+' is closed. '+missingText(next); const first=requirements(world,r,next)[0];addAction('Find '+landmark(first),() => go(first)); }
    } else if(type==='tribe' || type==='guardian' || type==='habitat') {
      const lid=leadSpecies(world,site), leader=getForm({speciesId:lid,level:combatLevel(r,site)}).name, resident=newResident(r,site);
      const unlock={grove:districtName(r,1),ridge:landmark('trial'),outpost:landmark('habitat'),den:landmark('sentinel'),sentinel:landmark('vault')};
      if(TRAIL_HABITATS[site]) desc.textContent=leader+' leads a patrol in this habitat. Return here to find another if it slips away.';
      else if(type==='habitat') desc.textContent=resident
        ? (lid===resident.id?'A rare '+resident.name+' is here. Encounter its group to try a capture.':'Tracks of '+resident.name+' lead through this habitat. Win local patrols to find it. '+leader+' is here now.')
        : leader+' is nesting here. These sheltered grounds attract scarce local families.';
      else if(unlock[site]) desc.textContent=leader+' leads this group. '+(did(site)?'The route to '+unlock[site]+' is open.':'Victory opens '+unlock[site]+'.');
      else desc.textContent=leader+' leads this group of '+REGIONS[r].tribe+'.';
      addAction(type==='guardian'?'Challenge guardian':type==='habitat'?'Encounter patrol':'Encounter tribe',challenge);
      if(did(site) && site==='grove') addAction('Take eastern trail',() => go('entry'),true);
      if(did(site) && site==='ridge') addAction('Visit arena',() => go('trial'),true);
      if(did(site) && site==='outpost' && open('habitat')) addAction('Visit habitat',() => go('habitat'),true);
      if(did(site) && site==='den') addAction('Find sentinel',() => go('sentinel'),true);
      if(did(site) && site==='sentinel') addAction('Visit sanctuary',() => go('vault'),true);
      const trail=wonderProgress(world,r);
      if (trail?.open && trail.patrols.includes(site)) {
        if (trail.ready) {
          desc.textContent+=' Fresh tracks lead to '+trail.name+'.';
          addAction('Follow fresh tracks',() => go('wonder'),true);
        } else if (trail.lastSite===site) {
          const next=trail.patrols.find(id => id!==site && open(id));
          desc.textContent+=' Search '+trail.progress+'/'+SEARCH_LIMIT+'. Pick up the trail at another marked patrol.';
          if (next) addAction('Search '+landmark(next),() => go(next),true);
        } else desc.textContent+=' A victory here advances the search at '+trail.name+'.';
      }
    } else if(type==='sign') {
      const studied=has(world.clues,r,site);
      desc.textContent=studied?signText(r,site):'Unusual tracks point toward a hidden regional legend. Study the marks to record a clue.';
      if(!studied) addAction('Read the sign',() => {mark(world.clues,r,site);notice=signText(r,site);onChange?.(world);render();});
      else {
        const next=hasTrail(world)?'hollow':!has(world.clues,r,site==='ford'?'lookout':'ford')?(site==='ford'?'lookout':'ford'):'warden';
        addAction('Trace the legend',() => go(next));
      }
      const find=getFind?.(r,site);
      if (find && onGather) addAction('Gather '+find.name,() => {
        if (dead || walking) return;
        const result=onGather(r,site);
        if (!result) return;
        notice=result.message;
        if (result.ok) onChange?.(world);
        render();
        actions.querySelector('button')?.focus({preventScroll:true});
      },true);
    } else if(type==='arena'||type==='warden') {
      const trial=type==='arena';
      if(trial) desc.textContent='Win the qualifier in this regional stadium. Its pennant opens '+districtName(r,2)+' and '+landmark('rookery')+'.';
      else desc.textContent=did(site)?'Your crest opens '+landmark('den')+'.':'Defeat the warden to earn the regional crest and open '+landmark('den')+'.';
      addAction(trial?(did(site)?'Rematch qualifier':'Enter qualifier'):(did(site)?'Rematch warden':'Challenge warden'),challenge);
      if(did(site) && !trial && REGIONS[r+1]) addAction('Next region',() => travel(r+1),true);
      if(did(site)) addAction(trial?'Take the high pass':'Find elite den',() => go(trial?'farpost':'den'),true);
    } else {
      const found=legendaryPresent(world,site);
      if(found) {
        const resident=getForm({speciesId:leadSpecies(world,site),level:combatLevel(r,site)});
        desc.textContent=resident.name+' waits in the sanctuary. Weaken it to improve your capture chance.';
        addAction('Approach legendary',challenge);
      } else {
        desc.textContent=site==='vault'?'The sanctuary is quiet. Defeat '+landmark('sentinel')+' again to draw out its guardian.':'The trail is quiet. Win a local battle to draw the legendary out. Fresh tracks appear within three victories.';
        addAction(site==='vault'?'Visit sentinel':'Patrol the trail',() => go(site==='vault'?'sentinel':'ridge'));
      }
      if(site==='vault' && wonderProgress(world,r)?.open) addAction('Explore '+landmark('wonder'),() => go('wonder'),true);
    }
  }
  function updateAtlas() {
    atlas.replaceChildren();
    REGIONS.forEach((item,i) => {
      const level = combatLevel(i,'grove'), danger = threat(level);
      const row=button('cw-region','',() => travel(i));
      row.setAttribute('aria-current',i===world.region?'location':'false');
      const thumb=element('span','cw-region-thumb'), source=item.artRegion;
      thumb.style.backgroundPosition=(source%2*100)+'% '+(Math.floor(source/2)*100/3)+'%';
      if(item.artFilter!=='none') thumb.style.setProperty('--region-filter',item.artFilter);
      const info=element('span','cw-region-info');
      const status = [i===world.region ? 'Here' : '', 'Lv. '+level+'+', danger].filter(Boolean).join(' · ');
      info.append(element('b','',item.name),element('small',danger ? 'cw-region-danger' : '',status));
      row.append(thumb,info);atlas.append(row);
    });
  }
  function toggleAtlas(opened) {
    if(walking) return;
    atlasOpen=opened;atlas.hidden=!opened;stage.hidden=opened;detail.hidden=opened;districtNav.hidden=opened;mapControls.hidden=opened;
    atlasButton.textContent=opened?'Back to trail':'Regions';atlasButton.setAttribute('aria-expanded',String(opened));
    if(opened) updateAtlas(); else {resizeMap();atlasButton.focus({preventScroll:true});}
  }
  function render(focus) {
    const r=world.region, area=REGIONS[r];
    const level = combatLevel(r,'grove'), danger = threat(level);
    eyebrow.textContent='Region '+String(r+1).padStart(2,'0')+' / '+REGIONS.length+' · Lv. '+level+'+'+(danger ? ' · '+danger : '');
    title.textContent=area.name;
    art.style.backgroundImage='url("'+new URL('./assets/frontier-map-'+area.artRegion+'.webp',import.meta.url).href+'")';
    art.style.backgroundPosition='center '+page*50+'%';
    art.style.filter=area.artFilter;
    art.classList.toggle('cw-art-variant',r!==area.artRegion);
    stage.dataset.biome=String(r);stage.dataset.district=String(page);
    syncCamera(focus);
    drawDistrictNav();fillLocations();paintRails();
    ranger.hidden=districtOf(world.node)!==page;
    if(!ranger.hidden) placeRanger(point(r,world.node));
    details();status.textContent=notice;
    if(atlasOpen) updateAtlas();
  }
  function travel(r) {
    if(dead || walking) return;
    toggleAtlas(false);
    if(!travelToRegion(world,r)) {viewHere();return;}
    page=0;target=world.node;notice='Arrived at '+REGIONS[r].name+'.';
    onRegion?.(r);onChange?.(world);if(!dead) render();
  }
  function go(site) {
    if(dead || walking || atlasOpen || !hasSite(world.region,site)) return;
    if(!open(site)) {page=districtOf(site);target=site;notice=missingText(site);render(point(world.region,site));return;}
    if(site===world.node) {viewHere();return;}
    const path=routeTo(world,site);
    if(path.length<2) {notice='This trail is closed.';status.textContent=notice;return;}
    walking=true;target=site;page=districtOf(world.node);render();
    stage.classList.add('cw-walking');actions.replaceChildren();primaryAction=null;
    kicker.textContent='On the trail';name.textContent=landmark(site);desc.textContent='Walking to '+districtName(world.region,districtOf(site))+'.';
    const r=world.region;let leg=0,startTime;
    function step(now) {
      if(dead) return;
      startTime??=now;
      const a=path[leg],b=path[leg+1],p=point(r,a),q=point(r,b),crossing=districtOf(a)!==districtOf(b);
      const duration=crossing?200:Math.min(460,Math.max(230,Math.hypot(q.x-p.x,q.y-p.y)*8));
      const t=reducedMotion?1:Math.min(1,(now-startTime)/duration);
      if(crossing) {
        if(page!==districtOf(b)) {
          page=districtOf(b);
          drawDistrictNav();fillLocations();
          art.style.backgroundPosition='center '+page*50+'%'; stage.dataset.district=String(page);
          syncCamera(q);paintRails();ranger.hidden=false;placeRanger(q);
        }
      } else {
        placeRanger(trailPoint(r,a,b,t));figure.classList.toggle('cw-facing-left',q.x<p.x);
        if(!pointer) revealCamera(rangerPoint);
      }
      if(t<1) {frame=requestAnimationFrame(step);return;}
      leg++;startTime=now;
      if(leg<path.length-1) {frame=requestAnimationFrame(step);return;}
      walking=false;stage.classList.remove('cw-walking');world.node=site;world.visits++;
      target=site;page=districtOf(site);notice='Reached '+landmark(site)+'.';onChange?.(world);
      if(!dead) render();
    }
    frame=requestAnimationFrame(step);
  }
  function moveDirection(dx,dy) {
    if(walking || atlasOpen) return;
    if(page!==districtOf(world.node)) {viewHere();return;}
    const r=world.region,start=point(r,world.node),sx=sheet.clientWidth/100,sy=sheet.clientHeight/100;
    const options=adjacent(world,world.node).map(site => {
      const destination=point(r,site),d=districtOf(site)-page;
      const x=(d ? Math.sign(d)*100 : destination.x-start.x)*sx, y=d ? 0 : (destination.y-start.y)*sy;
      const length=Math.hypot(x,y);
      return {site,score:(x*dx+y*dy)/length-.00018*length};
    }).sort((a,b) => b.score-a.score);
    if(options[0]?.score>.26) go(options[0].site);
  }
  const keys={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
  function keydown(e) {
    if(dead || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || e.target.closest?.('input,textarea,select,[contenteditable=true],dialog,[role=dialog]')) return;
    if(document.querySelector('dialog[open], [aria-modal=true]:not([hidden])')) return;
    if(e.key==='Escape' && atlasOpen) {e.preventDefault();toggleAtlas(false);return;}
    if(atlasOpen) return;
    const direction=keys[e.key];
    if(e.shiftKey && direction && e.key.startsWith('Arrow') && stage.contains(e.target)) {
      e.preventDefault();
      const [dx,dy]=direction;
      setCamera(camera.x+dx*64,camera.y+dy*64);
      return;
    }
    if(direction) {e.preventDefault();if(!e.repeat || !walking) moveDirection(...direction);}
    if((e.key==='Enter' || e.key===' ') && !e.target.closest?.('button,a')) {e.preventDefault();if(!e.repeat) primaryAction?.();}
  }
  stage.addEventListener('pointerdown',e => {
    if (e.button!==0 || pointer || !e.isPrimary) return;
    suppressClick=false;
    if (!fitMap) pointer={id:e.pointerId,x:e.clientX,y:e.clientY,camera,dragging:false};
  });
  stage.addEventListener('pointermove',e => {
    if (pointer?.id!==e.pointerId) return;
    const dx=e.clientX-pointer.x, dy=e.clientY-pointer.y;
    if (!pointer.dragging) {
      if (Math.hypot(dx,dy)<7) return;
      pointer.dragging=true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('cw-panning');
    }
    setCamera(pointer.camera.x-dx,pointer.camera.y-dy);
  });
  function stopPan(e) {
    if (pointer?.id!==e.pointerId) return;
    suppressClick=pointer.dragging;
    pointer=null;
    stage.classList.remove('cw-panning');
  }
  stage.addEventListener('pointerup',stopPan);
  stage.addEventListener('pointercancel',stopPan);
  stage.addEventListener('lostpointercapture',e => {if(e.target===stage) stopPan(e);});
  stage.addEventListener('pointerleave',e => {if(!pointer?.dragging) stopPan(e);});
  stage.addEventListener('click',e => {
    if (!suppressClick || !e.detail) return;
    suppressClick=false;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);
  stage.addEventListener('focusin',e => {
    const site=e.target.closest('[data-site]')?.dataset.site;
    if (site && !pointer) revealCamera(point(world.region,site));
  });
  function resizeMap() {
    setCamera(camera.x,camera.y);
    paintRails();
  }
  window.addEventListener('keydown',keydown);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resizeMap):null;
  observer?.observe(stage);window.addEventListener('resize',resizeMap);
  render();
  return () => {
    dead=true;cancelAnimationFrame(frame);observer?.disconnect();
    window.removeEventListener('resize',resizeMap);window.removeEventListener('keydown',keydown);
  };
}
