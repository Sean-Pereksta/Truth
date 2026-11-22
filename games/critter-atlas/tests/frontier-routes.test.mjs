import assert from 'node:assert/strict';
import test from 'node:test';
import { REGIONS, SPECIES, rollEncounter } from '../catalog.js';
import { freshWorld, ensureWorld, completeEncounter, encounterAt, wonderProgress, restoreWonderTrails } from '../world.js';
import { DISTRICTS, SITE_IDS, linksFor, routeTo, unlockedSites, siteName, districtName, sitesFor, WONDERS } from '../frontier-routes.js';

function walk(world, node) {
  const route = routeTo(world,node);
  assert.equal(route[0],world.node, 'Path begins at the player');
  assert.equal(route.at(-1),node, 'Path reaches '+node);
  world.node = node;
  return route;
}
function win(world,node) {
  walk(world,node);
  const encounter = encounterAt(world,node);
  assert.ok(encounter,'Playable encounter at '+node);
  completeEncounter(world,encounter,true);
  return encounter;
}

test('all eight regions have connected districts with distinct branches and enforce their regional gates', () => {
  const layouts = new Set(), districtNames = new Set();
  for (const {id} of REGIONS) {
    const world = {...freshWorld(),region:id,unlocked:id};
    layouts.add(JSON.stringify(linksFor(id)));
    for (let i=0;i<3;i++) districtNames.add(districtName(id,i));
    const regionalSites = sitesFor(id);
    assert.equal(new Set(regionalSites.map(site => siteName(id,site))).size,regionalSites.length);
    assert.equal(DISTRICTS.length,3);
    const checkReachable = () => {
      const passable = unlockedSites(world);
      for (const node of SITE_IDS) {
        assert.equal(routeTo(world,node).length>0,passable.includes(node),id+' closure of '+node);
      }
    };
    checkReachable();
    walk(world,'town');
    assert.deepEqual(routeTo(world,'trial'),[]);
    assert.deepEqual(routeTo(world,'vault'),[]);
    assert.equal(encounterAt({...world,node:'vault'},'vault'),null);
    win(world,'grove');
    assert.equal(unlockedSites(world).includes('ridge'),true);
    assert.equal(unlockedSites(world).includes('habitat'),false);
    checkReachable();
    win(world,'outpost');
    assert.equal(unlockedSites(world).includes('habitat'),true);
    checkReachable();
    win(world,'ridge');
    assert.equal(unlockedSites(world).includes('trial'),true);
    assert.equal(unlockedSites(world).includes('warden'),false);
    checkReachable();
    assert.equal(win(world,'trial').arenaId,'trial');
    assert.equal(world.unlocked,id);
    checkReachable();
    assert.equal(win(world,'warden').arenaId,'warden');
    assert.equal(world.unlocked,Math.min(id+1,7));
    assert.deepEqual(routeTo(world,'vault'),[]);
    checkReachable();
    win(world,'den'); checkReachable();
    win(world,'sentinel'); checkReachable();
    win(world,'vault'); assert.equal(encounterAt(world,'vault'),null);
    win(world,'sentinel'); assert.ok(encounterAt({...world,node:'vault'},'vault'));
    assert.deepEqual(routeTo(world,'hollow'),[]);
    world.clues.push(id+'/ford',id+'/lookout');
    walk(world,'hollow'); checkReachable();
    assert.equal(unlockedSites(world).length,regionalSites.length);
  }
  assert.equal(layouts.size,8);
  assert.equal(districtNames.size,24);
  assert.equal(REGIONS.reduce((total,{id})=>total+sitesFor(id).length,0),157);
});

test('Five Hyper Rare hunts respect regional gates, local alternating patrols and a twelve-win limit', () => {
  let found = 0;
  for (const {id} of REGIONS) {
    const world = {...freshWorld(),region:id,unlocked:id};
    const wonder = WONDERS[id];
    assert.equal(sitesFor(id,2).includes('wonder'),!!wonder);
    assert.deepEqual(routeTo(world,'wonder'),[]);
    assert.equal(encounterAt({...world,node:'wonder'},'wonder'),null);
    if (!wonder) {
      assert.equal(wonderProgress(world),null);
      assert.ok(linksFor(id).every(link=>!link.includes('wonder')));
      assert.equal(ensureWorld({...world,node:'wonder'}).node,'camp');
      continue;
    }
    function resolve(site, won, roll) {
      walk(world,site);
      const encounter = encounterAt(world,site);
      assert.ok(encounter);
      completeEncounter(world,encounter,won,[],() => roll);
    }
    for (const site of ['grove','outpost','ridge','trial','warden','den','sentinel']) {
      win(world,site);
      assert.equal(wonderProgress(world).open,false);
      assert.deepEqual(world.wonders,{});
    }
    win(world,'vault');
    walk(world,'wonder');
    assert.equal(wonderProgress(world).open,true);
    assert.equal(wonderProgress(world).chance,.04);
    assert.equal(encounterAt(world,'wonder'),null);
    const [a,b] = wonder.patrols;
    resolve('grove',true,0);
    resolve(a,false,0);
    assert.equal(wonderProgress(world).progress,0);
    for (let i=0;i<12;i++) {
      const site = i%2 ? b : a;
      resolve(site,true,1);
      assert.equal(wonderProgress(world).progress,i+1);
      assert.equal(wonderProgress(world).ready,i===11);
      resolve(site,true,1);
      assert.equal(wonderProgress(world).progress,i+1,'same patrol does not roll again');
    }
    walk(world,'wonder');
    const adult = encounterAt(world,'wonder');
    const young = encounterAt(world,'wonder',{youngling:true});
    assert.equal(young.youngling,true); assert.equal(adult.youngling,false);
    assert.equal(adult.leadSpeciesId,76+found);
    assert.equal(adult.kind,'wonder');
    assert.equal(adult.habitatId,'wonder');
    assert.equal(young.level,adult.level);
    assert.deepEqual(restoreWonderTrails(JSON.parse(JSON.stringify(world.wonders))),world.wonders);
    completeEncounter(world,adult,false,[]);
    assert.equal(wonderProgress(world).ready,true,'untouched target remains after retreat');
    completeEncounter(world,young,false,[{speciesId:young.leadSpeciesId}]);
    assert.equal(wonderProgress(world).ready,false,'capturing then retreating consumes the sighting');
    assert.ok(world.hunts.includes(id+'/wonder'));
    resolve(a,true,.03);
    assert.equal(wonderProgress(world).ready,true,'a new hunt can succeed on its first patrol');
    walk(world,'wonder');
    completeEncounter(world,encounterAt(world,'wonder'),true);
    assert.equal(wonderProgress(world).progress,0,'winning the confrontation starts a new hunt');
    found++;
  }
  assert.equal(found,5);
});

test('wonder trail migration rejects foreign regions, bad counters and invalid patrols', () => {
  assert.deepEqual(restoreWonderTrails(undefined),{});
  assert.deepEqual(restoreWonderTrails({0:{progress:-3,ready:'yes',lastSite:'town'},1:{ready:true},7:{progress:18,lastSite:'ridge'}}),{
    0:{progress:0,ready:false,lastSite:null},7:{progress:12,ready:true,lastSite:'ridge'}
  });
});

test('each frontier family leads a real battle only inside its unlocked habitat', () => {
  const found = new Set();
  for (const {id} of REGIONS) {
    const world = {...freshWorld(),region:id,unlocked:id};
    for (const site of ['grove','outpost','ridge','trial','warden','den','sentinel']) win(world,site);
    for (const site of ['habitat','rookery','vault']) {
      walk(world,site);
      const encounter = encounterAt(world,site);
      const party = rollEncounter(id,{...encounter,legendary:encounter.kind==='legendary',rng:() => .5});
      assert.equal(party[0].speciesId,encounter.leadSpeciesId);
      const species = SPECIES[party[0].speciesId];
      if (species.id >= 56) {
        assert.equal(species.habitatId,site);
        assert.equal(species.region,id);
        found.add(species.id);
      }
    }
  }
  assert.equal(found.size,20);
});

test('legacy crests keep previously explored warden and legendary routes open', () => {
  const world = {...freshWorld(),node:'hollow',cleared:['0/warden'],clues:['0/ford','0/lookout'],sightings:{0:-1}};
  assert.equal(ensureWorld(world).node,'hollow');
  assert.ok(encounterAt(world,'hollow'));
  assert.equal(encounterAt(world,'hollow').leadSpeciesId,6);
  walk(world,'town');
  walk(world,'warden');
  assert.equal(encounterAt(world,'warden').kind,'warden');
  assert.deepEqual(routeTo(world,'vault'),[]);
  assert.deepEqual(routeTo(world,'habitat'),[]);
});

test('returning expeditions on newly gated routes start at their closest open district entrance', () => {
  const oldSave = (node, cleared = []) => ({region:0,unlocked:0,node,cleared});
  assert.equal(ensureWorld(oldSave('ridge')).node,'camp');
  assert.equal(ensureWorld(oldSave('warden',['0/grove','0/ridge'])).node,'entry');
  assert.equal(ensureWorld(oldSave('hollow',['0/warden'])).node,'farpost');
  assert.equal(ensureWorld(oldSave('ridge',['0/grove'])).node,'ridge');
});

test('fixed venue levels rise through each region and culminate in a level-45 vault', () => {
  const venues = ['trial', 'warden', 'den', 'sentinel', 'vault'];
  let previous = [];
  for (const {id} of REGIONS) {
    const world = {...freshWorld(), region:id, unlocked:id};
    const grove = win(world, 'grove');
    if (id === 0) assert.equal(grove.level, 1);
    win(world, 'ridge');
    const ranks = venues.map(site => win(world, site).level);
    for (let i = 0; i < ranks.length; i++) {
      if (i) assert.ok(ranks[i] > ranks[i - 1], venues[i] + ' exceeds the previous gate');
      if (id) assert.ok(ranks[i] > previous[i], venues[i] + ' exceeds its previous regional rank');
      assert.ok(ranks[i] <= 45);
    }
    assert.equal(win(world, 'warden').level, ranks[1], 'rematches retain the same rank');
    if (id === 0) assert.deepEqual(ranks, [4, 5, 6, 7, 8]);
    if (id === REGIONS.length - 1) assert.deepEqual(ranks, [35, 38, 41, 43, 45]);
    previous = ranks;
  }
});
