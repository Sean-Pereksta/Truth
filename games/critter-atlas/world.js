import { REGIONS, SPECIES, getForm } from './catalog.js';
import { DISTRICTS, SITE_IDS, siteName, siteType, districtName, districtOf, districtDescription, signText,
  keyFor, mark, has, point, requirements, routeHint, unlockedSites, adjacent, linksFor, routeTo } from './frontier-routes.js';

export { REGIONS, siteName, routeHint, unlockedSites };

export function freshWorld() {
  return { region: 0, unlocked: 0, node: 'camp', cleared: [], clues: [], hunts: [], visits: 0, sightings: {}, patrols: {} };
}

function regionIndex(n) {
  return Number.isInteger(n) && n >= 0 && n < REGIONS.length ? n : 0;
}

export function ensureWorld(world) {
  world.unlocked = regionIndex(world.unlocked);
  world.region = Math.min(regionIndex(world.region), world.unlocked);
  if (!SITE_IDS.includes(world.node)) world.node = 'camp';
  for (const key of ['cleared', 'clues', 'hunts']) if (!Array.isArray(world[key])) world[key] = [];
  if (!world.sightings || typeof world.sightings !== 'object') world.sightings = {};
  if (!world.patrols || typeof world.patrols !== 'object') world.patrols = {};
  if (!Number.isInteger(world.visits) || world.visits < 0) world.visits = 0;
  // An old expedition can be parked beyond a gate introduced by the expansion.
  // Return it to the nearest open district entrance without fabricating victories.
  if (requirements(world,world.region,world.node).length) {
    const entrances = ['camp','entry','farpost'].slice(0,districtOf(world.node)+1);
    world.node = entrances.reverse().find(site => !requirements(world,world.region,site).length);
  }
  return world;
}

function hasTrail(world, region = world.region) {
  return requirements(world,region,'hollow').length === 0;
}
export function completeEncounter(world, encounter, won) {
  ensureWorld(world);
  if (!won || !encounter || !SITE_IDS.includes(encounter.node)) return world;
  const region = regionIndex(encounter.region), site = encounter.node;
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
  trial:    [4,  8, 12, 16, 21, 26, 31, 35],
  warden:   [5, 10, 14, 19, 24, 29, 32, 38],
  den:      [6, 12, 18, 24, 30, 35, 39, 41],
  sentinel: [7, 13, 20, 26, 32, 37, 41, 43],
  vault:    [8, 15, 22, 28, 34, 39, 43, 45]
};
const trailOffsets = { outpost: 1, ridge: 1, habitat: 2, rookery: 3, hollow: 3 };
function combatLevel(region, site) {
  if (region === 0 && site === 'grove') return 1;
  return venueLevels[site]?.[region] ?? REGIONS[region].minLevel + (trailOffsets[site] || 0);
}
function countWins(world,site) { return world.patrols[keyFor(world.region,site)] || 0; }
const newResident = (r,site) => SPECIES.find(s => s.region === r && s.habitatId === site);
function leadSpecies(world,site) {
  const r = world.region, wins = countWins(world,site), oldBase = r*7;
  if (site === 'hollow') return oldBase + 6;
  const resident = newResident(r,site);
  if (resident && (site === 'vault' || wins % 3 === 0)) return resident.id;
  if (['outpost','den','sentinel','rookery'].includes(site)) return oldBase + (wins % 2 ? 4 : 5);
  return oldBase + (r + (site === 'grove' ? 3 : 0) + wins) % 6;
}
function legendaryPresent(world,site) {
  return site === 'vault' ? countWins(world,'sentinel') > countWins(world,'vault') : world.sightings[world.region] === -1;
}
export function encounterAt(world,site) {
  if (site !== world.node || !unlockedSites(world).includes(site)) return null;
  const type = siteType(site), region = world.region;
  if (!['tribe','guardian','habitat','arena','warden','vault','hollow'].includes(type)) return null;
  const legendary = type === 'hollow' || type === 'vault';
  if (legendary && !legendaryPresent(world,site)) return null;
  const kind = legendary ? 'legendary' : type === 'warden' ? 'warden' : type === 'arena' ? 'arena' : 'tribe';
  return {region,kind,node:site,name:siteName(region,site),level:combatLevel(region,site),
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

export function mountWorld(root, { world = freshWorld(), inspectSite, onChange, onEncounter, onCamp, onMarket, onRegion, sprite } = {}) {
  ensureWorld(world);
  let dead = false, walking = false, frame = 0, atlasOpen = false, notice = '';
  let target = SITE_IDS.includes(inspectSite) ? inspectSite : world.node;
  let page = districtOf(target), primaryAction = null, dragStart = null;
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
  const stage = element('div','cw-stage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label','Trail map. Tap a landmark to walk, or use arrow keys and Enter.');
  const art = element('div','cw-art'), rails = element('canvas','cw-trails'), locations = element('div','cw-locations');
  rails.setAttribute('aria-hidden','true');
  const ranger = element('div','cw-ranger'); ranger.setAttribute('aria-hidden','true');
  const figure = element('canvas','cw-figure');
  stamp(figure,RANGER,RANGER_PALETTE,15,17); ranger.append(figure);
  const rose = element('span','cw-compass','N'); rose.setAttribute('aria-hidden','true');
  stage.append(art,rails,locations,ranger,rose);
  const detail = element('div','cw-detail'), summary = element('div','cw-summary');
  const kicker = element('span','cw-kicker'), name = element('h3','cw-site-title'), desc = element('p','cw-desc');
  summary.append(kicker,name,desc);
  const actions = element('div','cw-actions'); detail.append(summary,actions);
  const status = element('div','cw-status'); status.setAttribute('role','status');
  panel.append(heading,atlas,districtNav,stage,detail,status); root.replaceChildren(panel);
  const landmark = site => siteName(world.region,site);
  const did = site => has(world.cleared,world.region,site);
  const open = site => !requirements(world,world.region,site).length;
  const typeNames = {camp:'Trail camp',town:'Market town',tribe:'Tribal ground',guardian:'Route guardian',sign:'Trail sign',pass:'District crossing',habitat:'Wild habitat',arena:'Qualifier arena',warden:'Warden arena',hollow:'Legendary habitat',vault:'Legendary sanctuary'};

  function placeRanger(p) { ranger.style.left=p.x+'%'; ranger.style.top=p.y+'%'; }
  function paintRails() {
    const width=stage.clientWidth, height=stage.clientHeight;
    if (dead || !width || !height) return;
    const scale=Math.min(window.devicePixelRatio || 1,2);
    rails.width=Math.round(width*scale); rails.height=Math.round(height*scale);
    const ctx=rails.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale,scale); ctx.lineJoin='round'; ctx.lineCap='round';
    for (const [a,b] of linksFor(world.region)) {
      if (districtOf(a)!==page || districtOf(b)!==page) continue;
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
    DISTRICTS.forEach((sites,i) => {
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
    for (const site of DISTRICTS[page]) {
      const type=siteType(site), p=point(world.region,site), cleared=did(site)||has(world.clues,world.region,site), locked=!open(site);
      const label=landmark(site);
      const el=button('cw-node cw-node-'+type+(locked?' cw-locked':''),'',() => go(site));
      el.dataset.site=site;el.style.left=p.x+'%';el.style.top=p.y+'%';
      const inspecting=site===target && site!==world.node;
      el.classList.toggle('cw-inspecting',inspecting);
      el.title=label+' · '+typeNames[type]+(locked?' · Closed route':'');
      el.setAttribute('aria-label',el.title+(world.node===site?', current location':inspecting?', selected landmark':''));
      el.setAttribute('aria-current',world.node===site?'location':'false');
      const token=element('span','cw-token'), glyph=element('canvas','cw-node-glyph');
      const palette={y: type==='vault'||type==='hollow'?'#b8fae1':'#ffe3a6',t:'#d49763',o:'#8d6549'};
      stamp(glyph,SYMBOLS[type],palette,15,SYMBOLS[type].length);
      token.append(glyph);
      if (locked) { const lock=element('span','cw-lock');lock.setAttribute('aria-hidden','true');token.append(lock); }
      else if(cleared) token.append(element('span','cw-clear-mark','✓'));
      const caption=element('span','cw-node-name',label);
      el.append(token,caption);
      const isWild=['tribe','habitat','guardian'].includes(type) || (['hollow','vault'].includes(type) && legendaryPresent(world,site));
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
    page=districtOf(world.node);target=world.node;notice='';render();
  }
  function challenge() {
    const encounter=encounterAt(world,world.node);
    if(!dead && !walking && encounter) onEncounter?.(encounter);
  }
  function details() {
    actions.replaceChildren();primaryAction=null;
    const r=world.region,site=target,type=siteType(site);
    if(!open(site)) {inspectClosed(site);return;}
    name.textContent=landmark(site);kicker.textContent=typeNames[type];
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
      kicker.textContent+= ' · Lv. '+combatLevel(r,site);
      if(type==='habitat') desc.textContent=resident
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
    } else if(type==='sign') {
      const studied=has(world.clues,r,site);
      desc.textContent=studied?signText(r,site):'Unusual tracks point toward a hidden regional legend. Study the marks to record a clue.';
      if(!studied) addAction('Read the sign',() => {mark(world.clues,r,site);notice=signText(r,site);onChange?.(world);render();});
      else {
        const next=hasTrail(world)?'hollow':!has(world.clues,r,site==='ford'?'lookout':'ford')?(site==='ford'?'lookout':'ford'):'warden';
        addAction('Trace the legend',() => go(next));
      }
    } else if(type==='arena'||type==='warden') {
      const trial=type==='arena';
      kicker.textContent+=' · Lv. '+combatLevel(r,site);
      if(trial) desc.textContent='Win the qualifier in this regional stadium. Its pennant opens '+districtName(r,2)+' and '+landmark('rookery')+'.';
      else desc.textContent=did(site)?'Your crest opens the elite den'+(r<7?' and the next region.':'.'):'Defeat the warden in the stadium to open '+landmark('den')+(r<7?' and '+REGIONS[r+1].name+'.':'.');
      if(did(site) && !trial && r<7) {addAction('Next region',() => travel(r+1));addAction('Rematch warden',challenge,true);}
      else addAction(trial?(did(site)?'Rematch qualifier':'Enter qualifier'):(did(site)?'Rematch warden':'Challenge warden'),challenge);
      if(did(site)) addAction(trial?'Take the high pass':'Find elite den',() => go(trial?'farpost':'den'),true);
    } else {
      const found=legendaryPresent(world,site);
      kicker.textContent+=' · Lv. '+combatLevel(r,site);
      if(found) {
        const resident=getForm({speciesId:leadSpecies(world,site),level:combatLevel(r,site)});
        desc.textContent=resident.name+' waits in the sanctuary. Weaken it to improve your capture chance.';
        addAction('Approach legendary',challenge);
      } else {
        desc.textContent=site==='vault'?'The sanctuary is quiet. Defeat '+landmark('sentinel')+' again to draw out its guardian.':'The trail is quiet. Win a local battle to draw the legendary out. Fresh tracks appear within three victories.';
        addAction(site==='vault'?'Visit sentinel':'Patrol the trail',() => go(site==='vault'?'sentinel':'ridge'));
      }
    }
  }
  function updateAtlas() {
    atlas.replaceChildren();
    REGIONS.forEach((item,i) => {
      const allowed=i<=world.unlocked;
      const row=button('cw-region','',() => travel(i));row.disabled=!allowed;
      row.setAttribute('aria-current',i===world.region?'location':'false');
      const thumb=element('span','cw-region-thumb');thumb.style.backgroundPosition=(i%2*100)+'% '+(Math.floor(i/2)*100/3)+'%';
      const info=element('span','cw-region-info');
      info.append(element('b','',item.name),element('small','',allowed?(i===world.region?'Exploring':'Level '+combatLevel(i,'grove')+'+'):'Earn the '+REGIONS[i-1].name+' crest'));
      row.append(thumb,info);atlas.append(row);
    });
  }
  function toggleAtlas(opened) {
    if(walking) return;
    atlasOpen=opened;atlas.hidden=!opened;stage.hidden=opened;detail.hidden=opened;districtNav.hidden=opened;
    atlasButton.textContent=opened?'Back to trail':'Regions';atlasButton.setAttribute('aria-expanded',String(opened));
    if(opened) updateAtlas(); else {paintRails();atlasButton.focus({preventScroll:true});}
  }
  function render() {
    const r=world.region;
    eyebrow.textContent='Region '+String(r+1).padStart(2,'0')+' / 08 · Lv. '+combatLevel(r,'grove')+'+';
    title.textContent=REGIONS[r].name;
    art.style.backgroundImage='url("'+new URL('./assets/frontier-map-'+r+'.webp',import.meta.url).href+'")';
    art.style.backgroundPosition='center '+page*50+'%';
    stage.dataset.biome=String(r);stage.dataset.district=String(page);
    drawDistrictNav();fillLocations();paintRails();
    ranger.hidden=districtOf(world.node)!==page;
    if(!ranger.hidden) placeRanger(point(r,world.node));
    details();status.textContent=notice;
    if(atlasOpen) updateAtlas();
  }
  function travel(r) {
    if(dead || walking || regionIndex(r)!==r || r>world.unlocked) return;
    toggleAtlas(false);
    if(r===world.region) {viewHere();return;}
    world.region=r;world.node='camp';page=0;target='camp';notice='Arrived at '+REGIONS[r].name+'.';
    onRegion?.(r);onChange?.(world);if(!dead) render();
  }
  function go(site) {
    if(dead || walking || atlasOpen || !SITE_IDS.includes(site)) return;
    if(!open(site)) {page=districtOf(site);target=site;notice=missingText(site);render();return;}
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
          paintRails();ranger.hidden=false;placeRanger(q);
        }
      } else {
        placeRanger(trailPoint(r,a,b,t));figure.classList.toggle('cw-facing-left',q.x<p.x);
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
    const r=world.region,start=point(r,world.node),sx=stage.clientWidth/100,sy=stage.clientHeight/100;
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
    if(keys[e.key]) {e.preventDefault();if(!e.repeat || !walking) moveDirection(...keys[e.key]);}
    if((e.key==='Enter' || e.key===' ') && !e.target.closest?.('button,a')) {e.preventDefault();if(!e.repeat) primaryAction?.();}
  }
  stage.addEventListener('pointerdown',e => {if(!e.target.closest('button')) dragStart=[e.clientX,e.clientY];});
  stage.addEventListener('pointerup',e => {
    if(!dragStart) return;
    const x=e.clientX-dragStart[0],y=e.clientY-dragStart[1];dragStart=null;
    if(Math.hypot(x,y)>26) moveDirection(...(Math.abs(x)>Math.abs(y)?[Math.sign(x),0]:[0,Math.sign(y)]));
  });
  stage.addEventListener('pointercancel',() => {dragStart=null;});
  window.addEventListener('keydown',keydown);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(paintRails):null;
  observer?.observe(stage);window.addEventListener('resize',paintRails);
  render();
  return () => {
    dead=true;cancelAnimationFrame(frame);observer?.disconnect();
    window.removeEventListener('resize',paintRails);window.removeEventListener('keydown',keydown);
  };
}
