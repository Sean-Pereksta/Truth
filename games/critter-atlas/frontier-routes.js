// The three sheets meet at pass/entry and highpass/farpost. Site IDs also appear
// in expedition journals; keep the seven original IDs stable across releases.
export const DISTRICTS = [
  ['camp','town','grove','ford','outpost','pass'],
  ['entry','ridge','lookout','habitat','trial','highpass','rookery'],
  ['farpost','warden','hollow','sentinel','vault','den']
];
export const SITE_IDS = DISTRICTS.flat();
const LOCATIONS = [
  [12,65],[30,34],[50,57],[58,22],[79,74],[87,36],
  [10,60],[30,35],[26,77],[51,17],[62,53],[87,36],[68,82],
  [12,60],[54,52],[44,17],[77,68],[87,31],[35,80]
];
const LAND = [
  {
    districts:['Mossbell Commons','Amber Thicket','Crownwood'],
    names:['Mossbell Camp','Mossbell Village','Bramble Run','Old Stump','Sawyer’s Bridge','Eastwood Arch',
      'Amber Steps','Fern Crossing','Honeycomb Oak','Lichen Beds','Sapcup Bowl','Crownwood Stair','Paperleaf Copse',
      'Elderroot Landing','The Green Ring','Moonroot Hollow','Burlkeep Watch','Heartwood Den','Briar Ramparts'],
    signs:['A spiral of luminous pollen points deeper into the wood.','Three amber claw marks shine on the old oak.'],
    travel:['Willow footbridges cross the stream beside the seed market.','A canopy road leads from the bridge to an earthen tournament bowl.','Ancient roots enclose the warden’s ring and the sleeping heartwood.']
  }, {
    districts:['Lantern Banks','Sedgewater','Wickmere Deep'],
    names:['Stilt Camp','Lantern Quay','Rushwater','Wisp Pools','Puntkeeper’s Ford','Reed Ferry',
      'Float Landing','Reed Islands','Silt Lantern','Peatwick Mudflats','Rushlight Pits','Wickmere Weir','Egret Reeds',
      'Sluice Landing','The Lantern Ring','Glimmermere','Crownmire Watch','Peat Crown','Bogtooth Levee'],
    signs:['Something heavy left a trail of unbroken reeds.','A blue light moves against the current.'],
    travel:['Punts carry traders between houses built on stilts.','Narrow boardwalks split around a floodlit competition pit.','The old weir opens into a blackwater basin ringed by half-sunken towers.']
  }, {
    districts:['Lamplight Quarry','The Glass Veins','Deep Prism'],
    names:['Prospector Camp','Geode Arcade','Glint Tunnel','Echo Well','Copper Tap','Lampway Lift',
      'Glazier’s Halt','Quartz Steps','Singing Geode','Verdigris Seam','The Echo Kiln','Prism Descent','Glasswhip Fissure',
      'Deep Rail','The Prism Vault','Opal Deep','Vault Bell','Spindle Geode','Shardfault'],
    signs:['One echo in the well returns as a low growl.','The geode hums a second note when you turn east.'],
    travel:['The quarry market stands where three ore carts meet.','Copper rails lead past the kiln into glass-lined galleries.','Colossal geodes form the walls of the underground stadium.']
  }, {
    districts:['Driftwood Strand','The Outer Reefs','King Tide'],
    names:['Drift Camp','Driftwood Wharf','Shellbank','Tide Bell','Saltbar Crossing','Cliffside Slip',
      'Tern Landing','Saltgrass Bluff','Drift Beacon','Chimesail Shoal','Shellback Court','Moonwake Narrows','Cormorant Rock',
      'Breakwater Gate','The Breakwater','Pearl Grotto','Tuskreef Watch','Crown Tidemouth','Sharkfin Shelf'],
    signs:['One set of silver tracks survives every incoming wave.','A pearl scale flashes beneath the old signal fire.'],
    travel:['Fishing boats unload their catches at the edge of the sandbar.','The reef path winds between a beacon and a beach court.','Waves break over stone steps leading to an arena carved into the headland.']
  }, {
    districts:['Shepherd’s Vale','Kitewind Pass','The High Cirque'],
    names:['Cloud Camp','High Pass','Scree Run','Wind Cairn','Shepherd’s Span','Kitewind Gate',
      'Lower Ledge','Horn Pass','Eagle Spire','Cloudruff Shelf','Cairnfall Circle','Glacier Ladder','Soarpip Eyrie',
      'Snowcap Saddle','The Gale Crown','Storm Nest','Whitehorn Watch','Rime Crown','Windscar Ledge'],
    signs:['A ribbon of frost curls around the sheltered side of the cairn.','A huge down feather floats upward past the spire.'],
    travel:['Supply sheds hug the last sheltered switchback.','Narrow ridges fan out beneath the mountain’s sky arena.','A wind-polished ice bowl holds the highest seats of the Gale Crown.']
  }, {
    districts:['Emberkiln Road','The Glass Rivers','Ashen Caldera'],
    names:['Cinder Camp','Emberkiln','Ember Shelf','Glass Crater','Kilnkeeper’s Ford','Coal Tram',
      'Smelter Stop','Ash Ravine','The Coal Eye','Kilnclaw Fumarole','Glassblower Ring','Caldera Lift','Sulfur Nests',
      'Crater Station','The Furnace','Sunless Forge','Cinder Crown Watch','Ashflower Heart','Magma Teeth'],
    signs:['A trail of glass footprints ends at the crater.','The coal burns violet when you face the old forge.'],
    travel:['A tram rolls past pottery stalls beside a cooling lava flow.','Pumice bridges link the hot springs to a ring of obsidian seats.','The caldera floor glows below the warden’s forge.']
  }, {
    districts:['Mosaic Ward','The Sunken Gardens','Palace Undercroft'],
    names:['Mosaic Camp','Mosaic Bazaar','Lion Gate','Moss Dial','Watchman’s Arch','Procession Gate',
      'Heron Stairs','Broken Gallery','The Empty Throne','Henge Courtyard','Serpent Steps','Palace Descent','Papyrus Terrace',
      'Undercroft Arch','The Sunken Dais','Ivory Crypt','Ivory Gatekeeper','Obelisk Tomb','Lionbone Vault'],
    signs:['A fourth shadow crosses the sundial at midday.','Wet steps lead away from the empty throne.'],
    travel:['Traders hang woven awnings between the fallen pillars.','Walled gardens lead through a half-flooded ceremonial arena.','The drowned palace keeps its last arena beneath a cracked dome.']
  }, {
    districts:['Comet Landing','The Tilted Orbits','Starfall Core'],
    names:['Astral Camp','Comet Landing','Comet Trail','Star Glass','Harbor Watch','Silver Transit',
      'Orbit Dock','The Blue Orbit','Moon Mirror','Vesper Drift','Orbital Court','Zenith Causeway','Moonray Shoal',
      'Zenith Port','The Zenith Ring','The Last Star','Starlock Watch','Aster Crucible','Meteor Teeth'],
    signs:['A single constellation moves across the glass.','The mirror reflects a star hidden beneath your feet.'],
    travel:['Trade caravans tether their wagons to slabs of moonstone.','Floating causeways orbit a court suspended between meteors.','Bridges of fallen starlight connect the ring to the last observatory.']
  }
];
const TYPES = {
  camp:'camp',town:'town',grove:'tribe',ford:'sign',outpost:'guardian',pass:'pass',
  entry:'pass',ridge:'tribe',lookout:'sign',habitat:'habitat',trial:'arena',highpass:'pass',rookery:'habitat',
  farpost:'pass',warden:'warden',hollow:'hollow',sentinel:'guardian',vault:'vault',den:'guardian'
};
export const siteType = site => TYPES[site];
export const districtOf = site => DISTRICTS.findIndex(sites => sites.includes(site));
export const districtName = (region, district) => LAND[region].districts[district];
export const districtDescription = (region, district) => LAND[region].travel[district];
export const siteName = (region, site) => LAND[region].names[SITE_IDS.indexOf(site)];
export const signText = (region, site) => LAND[region].signs[site === 'ford' ? 0 : 1];
export function point(region, site) {
  const [x,y] = LOCATIONS[SITE_IDS.indexOf(site)];
  return {x,y};
}
export const keyFor = (region,site) => region+'/'+site;
export const has = (list,region,site) => list.includes(keyFor(region,site));
export function mark(list,region,site) {
  if (!has(list,region,site)) list.push(keyFor(region,site));
}
const LINKS = [
  ['camp','town'],['camp','grove'],['town','ford'],['grove','outpost'],['grove','pass'],
  ['pass','entry'],['entry','ridge'],['entry','lookout'],['ridge','habitat'],['ridge','trial'],
  ['trial','highpass'],['trial','rookery'],['lookout','rookery'],['highpass','farpost'],
  ['farpost','warden'],['warden','hollow'],['warden','den'],['den','sentinel'],['sentinel','vault']
];
// Different terrain provides junctions, loops, or a shorter return route.
const SHORTCUTS = [
  [['town','grove'],['ford','pass'],['habitat','highpass'],['farpost','den'],['hollow','vault']],
  [['camp','outpost'],['ford','grove'],['lookout','trial'],['rookery','highpass'],['warden','sentinel']],
  [['ford','pass'],['outpost','pass'],['entry','trial'],['habitat','highpass'],['farpost','hollow']],
  [['town','outpost'],['grove','ford'],['lookout','trial'],['ridge','lookout'],['den','vault']],
  [['town','grove'],['outpost','pass'],['ridge','lookout'],['habitat','trial'],['warden','sentinel']],
  [['ford','grove'],['outpost','pass'],['lookout','trial'],['habitat','highpass'],['farpost','den']],
  [['town','grove'],['ford','pass'],['entry','trial'],['ridge','lookout'],['hollow','vault']],
  [['camp','outpost'],['town','grove'],['lookout','trial'],['rookery','highpass'],['farpost','hollow']]
];
export function linksFor(region) { return [...LINKS,...SHORTCUTS[region]]; }

// Routes pass through the same checks as direct clicks, cross-district walks,
// keyboard movement and encounter creation. A prior warden crest honors the
// campaign achievements that predate the qualification arenas.
export function requirements(world, region, site) {
  const district = districtOf(site);
  if (district < 0) return [];
  const secured = has(world.cleared,region,'warden');
  const wins = [];
  if (district >= 1 && !secured) wins.push('grove');
  if (district === 2 && !secured) wins.push('ridge','trial');
  if (site === 'trial' && !secured) wins.push('ridge');
  if (site === 'habitat') wins.push('outpost');
  if ((site === 'rookery' || site === 'highpass') && !secured) wins.push('trial');
  if (site === 'den' || site === 'hollow' || site === 'sentinel' || site === 'vault') wins.push('warden');
  if (site === 'sentinel' || site === 'vault') wins.push('den');
  if (site === 'vault') wins.push('sentinel');
  const missing = wins.filter(id => !has(world.cleared,region,id));
  if (site === 'hollow') {
    for (const id of ['ford','lookout']) if (!has(world.clues,region,id)) missing.push(id);
  }
  return missing;
}
export function unlockedSites(world, region = world.region) {
  if (region > world.unlocked) return [];
  return SITE_IDS.filter(site => !requirements(world,region,site).length);
}
export function routeHint(region, site) {
  const name = key => siteName(region,key);
  if (site === 'habitat') return 'Defeat the guardian at '+name('outpost')+' and the tribe at '+name('grove')+' to reach '+name(site)+'.';
  if (site === 'rookery') return 'Beat the '+name('trial')+' qualifier to open '+name(site)+'.';
  if (site === 'vault') return 'Earn the warden’s crest, clear '+name('den')+' and defeat '+name('sentinel')+' to enter '+name(site)+'.';
  if (site === 'hollow') return 'Read the signs at '+name('ford')+' and '+name('lookout')+' and earn the warden’s crest.';
  return 'Explore the trails of '+districtName(region, Math.max(0,districtOf(site)))+'.';
}
export function adjacent(world,site) {
  const region = world.region;
  return linksFor(region).filter(pair => pair.includes(site)).map(([a,b]) => a === site ? b : a)
    .filter(next => !requirements(world,region,next).length);
}
export function routeTo(world,target) {
  if (!SITE_IDS.includes(target) || requirements(world,world.region,target).length) return [];
  const queue = [[world.node]], seen = new Set([world.node]);
  for (const path of queue) {
    const current = path.at(-1);
    if (current === target) return path;
    for (const next of adjacent(world,current)) if (!seen.has(next)) {
      seen.add(next);
      queue.push([...path,next]);
    }
  }
  return [];
}
