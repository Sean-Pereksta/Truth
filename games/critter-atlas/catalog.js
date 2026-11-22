import { FRONTIER_SPECIES } from './frontier-species.js';

// Region, species, and combat definitions shared by the trail, party, and arena.
const regionRows = [
  ['Mossbell Wood', 'forest', 2, 'Mossbell Foragers', 'Bramble Ring', 'Thorns', '#79b977'],
  ['Lantern Fen', 'marsh', 5, 'Lantern Waders', 'Reedlight Crossing', 'Bog', '#75b7a4'],
  ['Prism Hollows', 'cave', 8, 'Echo Borers', 'Quartz Gallery', 'Shards', '#aa99d1'],
  ['Tidemark Coast', 'coast', 11, 'Foamrunners', 'Coral Shelf', 'Surf', '#73c4ce'],
  ['Galehorn Peaks', 'mountains', 14, 'Galehorn Climbers', 'Windcut Pass', 'Ice', '#a7cbe0'],
  ['Cinder Basin', 'volcanic', 17, 'Cinder Walkers', 'Obsidian Bowl', 'Embers', '#e28b68'],
  ['Sunken Court', 'ruins', 20, 'Mosaic Keepers', 'Broken Sundial', 'Sunseal', '#d6b677'],
  ['Starfall Reach', 'astral', 24, 'Nightgliders', 'Meteor Garden', 'Starfall', '#a69dda']
];
export const REGIONS = regionRows.map(([name, biome, minLevel, tribe, arena, hazard, color], id) =>
  ({ id, name, biome, minLevel, tribe, arena, hazard, color }));

// Evolution names follow each animal's silhouette and habitat. The signature move,
// temperament and native color are specific to the species across its four forms.
const lineages = [
  // Mossbell Wood
  ['Fernip|Brackenbuck|Thorncrown|Verdantler', 'moss-antlered fawn', 'striker', '#a1cf72', 'Briar Feint', 'slow', 'Its velvet antlers snag burrs that seed the trail behind it.'],
  ['Pineplate|Conescale|Barkbulwark|Grandarbore', 'pinecone pangolin', 'defender', '#c09565', 'Splinter Roll', 'exposed', 'Each winter adds a resin-dark ring to its wooden scales.'],
  ['Petalune|Silkglow|Bloombrocade|Lunaflora', 'ivory blossom moth', 'healer', '#efd4a2', 'Pollen Veil', 'slow', 'It dusts bruised leaves with pollen beneath a full moon.'],
  ['Bramblit|Pipcache|Rubytail|Bramblevault', 'berry squirrel', 'ranged', '#da8072', 'Burr Volley', 'slow', 'It sorts its berry stones by how far they fly.'],
  ['Waxling|Combhelm|Hiveshield|Apiarch', 'honeycomb beetle', 'defender', '#efbf67', 'Honey Snare', 'slow', 'A hollow in its honeycomb shell shelters smaller insects.'],
  ['Acrowl|Cupuleye|Oakwatch|Crownoculus', 'acorn-capped owl', 'ranged', '#c5a77a', 'Cupule Crack', 'exposed', 'It knows a tree’s age from the sound of a falling acorn.'],
  ['Mayhart|Camellorn|Grove Regent|Thousandbloom', 'flowering stag', 'healer', '#edb4bd', 'Blossomfall', 'exposed', 'A clearing flowers overnight wherever it lowers its crown.'],
  // Lantern Fen
  ['Padplip|Raftcroak|Lotuslanter|Lilythrone', 'lily-pad frog', 'defender', '#99c37d', 'Raftslam', 'slow', 'Tiny fish gather beneath the leaf it balances on its head.'],
  ['Reedlet|Stiltreed|Rainjavelin|Fenlancer', 'reed heron', 'striker', '#c2b78b', 'Reed Thrust', 'exposed', 'It waits so still that nesting birds sometimes bring it reeds.'],
  ['Wickeft|Boglantern|Candlecrest|Marshfire', 'lantern newt', 'healer', '#75d5d0', 'Wick Flash', 'stun', 'Blue light in its throat draws lost foragers home.'],
  ['Siltwhisk|Flatskip|Mirevault|Skipmarsh', 'mudskipper', 'ranged', '#a6b794', 'Silt Spit', 'exposed', 'A tail flick sends it skidding over three pools of mud.'],
  ['Tuftvole|Reedlass|Rushweaver|Fenwarden', 'cattail vole', 'defender', '#c99671', 'Rush Bind', 'slow', 'It ties reeds into floating nests before every heavy rain.'],
  ['Veilwing|Duskneedle|Gloamlance|Vesperfoil', 'violet dragonfly', 'striker', '#b39ed8', 'Needle Rush', 'exposed', 'Its four wings beat out of time to confuse hungry frogs.'],
  ['Hushplume|Veilcrane|Mistprocession|Wraithwader', 'phantom crane', 'ranged', '#d0e1d8', 'Mist Toll', 'stun', 'Watch the ripples; its reflection arrives one step ahead.'],
  // Prism Hollows
  ['Quartlet|Shardclaw|Crystunnel|Vaultbreaker', 'crystal mole', 'striker', '#a0c9e6', 'Quartz Rake', 'exposed', 'It taps the cave wall to hear where the crystals grow.'],
  ['Timbat|Bellwing|Chimecloak|Carillonox', 'echo bat', 'ranged', '#b299d3', 'Overtone', 'stun', 'The folds of its ears collect echoes from far passages.'],
  ['Resinrit|Ambersong|Pitchfiddle|Resonarch', 'amber cave cricket', 'healer', '#e2a360', 'Resin Rattle', 'slow', 'Its amber legs hum at the pitch of a resting heartbeat.'],
  ['Knobback|Cairnback|Spireplate|Cathedrake', 'stalagmite tortoise', 'defender', '#c0b3ab', 'Spire Press', 'slow', 'A family sleeps in one place until its shell grows a spire.'],
  ['Blindell|Paleslick|Pearlrift|Alabasterol', 'white cave salamander', 'healer', '#ecded1', 'Ripple Sense', 'exposed', 'It reads footsteps with the pearl ridges along its jaw.'],
  ['Druslet|Gemgorger|Geoderm|Drusemaw', 'geode grub', 'defender', '#a8acd9', 'Geode Snap', 'exposed', 'Cracking its empty molt reveals a pocket of crystals.'],
  ['Prismcoil|Chromaspire|Spectraconda|Iridescythe', 'prismatic serpent', 'ranged', '#bf9ee2', 'Spectrum Ray', 'stun', 'Its scales split lantern light into colors unseen above ground.'],
  // Tidemark Coast
  ['Reeflet|Coralock|Atollguard|Reefbastion', 'coral hermit crab', 'defender', '#ef9f89', 'Coral Clamp', 'slow', 'Small corals survive low tide in the water it carries.'],
  ['Skimfinch|Foamknife|Breakerbill|Surfshear', 'saltwater skimmer', 'striker', '#a9c7c9', 'Wake Slice', 'exposed', 'Its lower bill leaves a straight silver line across the tide.'],
  ['Nudisprig|Rosetide|Florabranch|Petalcurrent', 'pink sea slug', 'healer', '#eaa9cd', 'Rosy Plume', 'slow', 'Its pink gills sway toward injured creatures in the pools.'],
  ['Pebblot|Shellsling|Riptotter|Tidewright', 'tidal otter', 'ranged', '#b58d70', 'Shell Skip', 'exposed', 'It keeps a flat stone under one arm for skipping at prey.'],
  ['Kitefry|Foamglide|Gustsail|Tradewing', 'flying fish', 'striker', '#7bc7dd', 'Skimming Rush', 'slow', 'A school gliding together sounds like a single sail snapping.'],
  ['Puffpin|Bristlebuoy|Thornballast|Urchinfleet', 'spiny pufferfish', 'ranged', '#c9bf82', 'Spine Shower', 'exposed', 'It rattles its blunted quills against the rocks at dusk.'],
  ['Glowray|Satinwake|Aurorayle|Beaconmantle', 'luminous manta', 'healer', '#9ae4de', 'Beacon Pulse', 'stun', 'Sailors once followed its glowing fins for an entire night.'],
  // Galehorn Peaks
  ['Woolhorn|Frostfleece|Craghammer|Ramparth', 'woolly ram', 'defender', '#d8d2bb', 'Avalanche Butt', 'slow', 'Packed snow slides harmlessly from the curls at its brow.'],
  ['Gustpin|Squallclaw|Tempestry|Thunderstoop', 'storm falcon', 'ranged', '#86aac9', 'Squall Feather', 'slow', 'It drops one feather before each storm and rides the updraft.'],
  ['Tundrip|Snowbounder|Fleetfrost|Snowshiver', 'snowshoe hare', 'striker', '#dbdcd1', 'Snow Feint', 'exposed', 'It can turn on powdered snow without leaving a deep print.'],
  ['Bellpika|Chimetail|Belltender|Campanulark', 'bellflower pika', 'healer', '#d5b3ce', 'Alpine Peal', 'stun', 'It dries bellflowers on sunlit rocks and carries them in winter.'],
  ['Cragkit|Slatepad|Ridgefang|Scarpshadow', 'crag lynx', 'striker', '#bba589', 'Ledge Pounce', 'exposed', 'Its long ear tufts tilt toward falling stones.'],
  ['Glasskid|Blackhorn|Obsidar|Cliffcrown', 'obsidian ibex', 'defender', '#898da0', 'Glasshorn', 'slow', 'The oldest horns gleam like polished volcanic glass.'],
  ['Halocub|Aurorapelt|Borealion|Polarveil', 'aurora snow leopard', 'striker', '#c2d8f4', 'Aurora Step', 'stun', 'Its shifting rosettes match the lights beyond the ridgeline.'],
  // Cinder Basin
  ['Coalstripe|Kilnburrow|Smokemantle|Forgebadger', 'coal badger', 'defender', '#ad8d80', 'Charcoal Rush', 'exposed', 'Its burrow walls harden into brick in the summer heat.'],
  ['Ashfletch|Sootwing|Flarequill|Pyroswift', 'ashwing swift', 'ranged', '#d98d72', 'Cinder Quill', 'exposed', 'A flick of its tail scatters the soot from its feathers.'],
  ['Sparksnout|Kilntusk|Magmahide|Calderaboar', 'lava-snouted boar', 'striker', '#d27563', 'Furnace Charge', 'slow', 'It flips cooling lava stones to find what hides beneath.'],
  ['Smoltick|Coalclasp|Brandsting|Crucistail', 'smoldering scorpion', 'ranged', '#cc8b70', 'Brand Needle', 'stun', 'Its tail glows brightest moments before it strikes.'],
  ['Steamgill|Spaeft|Ventbloom|Thermalotl', 'hot-spring axolotl', 'healer', '#eca7ac', 'Steam Screen', 'slow', 'Travelers recognize safe springs by the frills breaking the surface.'],
  ['Cinderoll|Brazershell|Ashbarrel|Kilnarmour', 'cinder armadillo', 'defender', '#c0916f', 'Clinker Roll', 'exposed', 'It packs ash into the grooves of its fireproof plates.'],
  ['Glasswyrm|Crownember|Obsidian Rex|Calderacrown', 'crowned obsidian drake', 'defender', '#be8185', 'Crown Fracture', 'stun', 'Each eruption leaves another point on its volcanic crown.'],
  // Sunken Court
  ['Tesslet|Tilewing|Mosaicrest|Opuscarab', 'tiled scarab', 'defender', '#74b7a1', 'Tile Scatter', 'exposed', 'It collects fallen blue tiles to repair its patterned shell.'],
  ['Eavekit|Rainspout|Vaultwatch|Eldergoyle', 'stone gargoyle', 'defender', '#a7a3aa', 'Cornice Drop', 'slow', 'In a downpour, it channels water away from its sleeping kin.'],
  ['Giltbill|Scribeplume|Aureoquill|Solarchivist', 'golden ibis', 'healer', '#e5c477', 'Scribe Seal', 'slow', 'It writes tide marks into the silt with one golden toe.'],
  ['Dawngeck|Sunfrill|Heliodisk|Zeniguan', 'sun-disk gecko', 'ranged', '#d8ae63', 'Sundisk Beam', 'stun', 'The disk at its neck tilts east long before sunrise.'],
  ['Glazecoil|Mosaiviper|Tilehood|Ceramamba', 'mosaic cobra', 'ranged', '#9ac0a7', 'Glaze Spit', 'exposed', 'When it spreads its hood, a lost mural briefly looks whole.'],
  ['Ochrepup|Brickstrider|Kilnjackal|Terrawarden', 'terracotta jackal', 'striker', '#cc886d', 'Potshard Dash', 'exposed', 'A hollow echo follows its paws across the buried courtyards.'],
  ['Gildkit|Riddlepelt|Oraclesphinx|Sovereign Riddle', 'gilded sphinx', 'healer', '#e9c477', 'Riddle Seal', 'stun', 'It sleeps beside a different doorway each time the moon vanishes.'],
  // Starfall Reach
  ['Cometkit|Bolttail|Flarevulp|Perihelion', 'comet fox', 'striker', '#efa87e', 'Comet Cut', 'exposed', 'Its tail burns a little brighter when it changes direction.'],
  ['Dewstar|Bellaster|Stellabloom|Cosmomedusa', 'starlight jellyfish', 'healer', '#c5b4e5', 'Starlit Drift', 'slow', 'Clouds of tiny lights gather inside its transparent bell.'],
  ['Crescarab|Lunaclamp|Moonguard|Eclipsehorn', 'crescent beetle', 'defender', '#b6c1d3', 'Crescent Vice', 'slow', 'Its silver horn is thinnest on the night of a new moon.'],
  ['Orbbit|Loopfoot|Apsispring|Keplerhare', 'orbit rabbit', 'striker', '#b4a1cc', 'Orbital Kick', 'exposed', 'Loose stones orbit its feet for an instant when it lands.'],
  ['Moonrook|Duskmantle|Nightquill|Lunarchivist', 'moon-feather raven', 'ranged', '#9598cb', 'Umbra Quill', 'exposed', 'It keeps one moonlit feather hidden even at noon.'],
  ['Nebulip|Spiralume|Galaxicoil|Deeporrery', 'nebula nautilus', 'defender', '#9badcd', 'Gravity Well', 'slow', 'Its shell adds a luminous chamber after every meteor shower.'],
  ['Starcalf|Chartfin|Astral Leviathan|Heavensong', 'constellation whale', 'healer', '#a2bff0', 'Celestial Chord', 'stun', 'The stars on its back return to the same place once a century.']
];

const raritySlots = ['Common', 'Common', 'Uncommon', 'Uncommon', 'Scarce', 'Rare', 'Legendary'];
const captureSlots = [.57, .54, .44, .41, .32, .24, .055];
export const SPECIES = lineages.map(([names, animal, role, color, signature, effect, lore], id) => {
  const forms = names.split('|');
  const region = Math.floor(id / 7);
  const slot = id % 7;
  const captureRate = Number((captureSlots[slot] - region * (slot === 6 ? .002 : .008)).toFixed(3));
  return { id, name: forms[0], forms, region, role, animal, color, signature, effect, lore,
    rarity: raritySlots[slot], legendary: slot === 6, captureRate };
}).concat(FRONTIER_SPECIES);

export const MAX_LEVEL = 45;
export const EVOLUTION_LEVELS = [6, 12, 20];
export const PARTY_LIMIT = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
export function makeMember(speciesId, level = 1) {
  if (!Number.isInteger(speciesId) || !SPECIES[speciesId]) throw new RangeError('Unknown Critter species');
  const uid = globalThis.crypto?.randomUUID?.() ??
    ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  return { uid, speciesId, level: clamp(Math.floor(Number(level) || 1), 1, MAX_LEVEL), xp: 0 };
}

export function getForm(member) {
  const stage = EVOLUTION_LEVELS.filter(level => member.level >= level).length;
  return { stage, name: SPECIES[member.speciesId].forms[stage] };
}
export function xpToNext(level) {
  return 12 + 4 * level;
}

const roleStats = {
  defender: { hp: 30, attack: 8, defense: 8, speed: 4, move: 2, range: 1 },
  ranged: { hp: 21, attack: 11, defense: 3, speed: 6, move: 2, range: 3 },
  healer: { hp: 23, attack: 9, defense: 4, speed: 5, move: 3, range: 2 },
  striker: { hp: 23, attack: 10, defense: 4, speed: 9, move: 4, range: 1 }
};

export function getStats(member) {
  const species = SPECIES[member.speciesId];
  const base = roleStats[species.role];
  const { stage } = getForm(member);
  const weight = species.legendary ? 1.13 : 1;
  const level = member.level;
  return {
    maxHp: Math.round((base.hp + level * 3.5 + stage * 6 + member.speciesId % 3) * weight),
    attack: Math.round((base.attack + level * 1.4 + stage * 2 + member.speciesId % 2) * weight),
    defense: Math.round((base.defense + level * .7 + stage * 2) * weight),
    speed: base.speed + Math.floor(level / 3) + stage + member.speciesId % 2,
    move: base.move + (stage >= 2 && species.role === 'defender' ? 1 : 0),
    range: base.range
  };
}

function ability(id, name, kind, power, range, status, description, learnLevel) {
  return { id, name, kind, power, range, status, description, learnLevel };
}
const roleBasics = {
  defender: ['Shell Check', 'Brace', 'guard', 0, 0, null, 'Brace against incoming attacks.'],
  ranged: ['Quick Shot', 'Pinning Shot', 'attack', .7, 3, 'slow', 'A light shot that slows its target.'],
  healer: ['Spark', 'Mend', 'heal', 1.25, 3, null, 'Restore health to a nearby ally.'],
  striker: ['Quick Swipe', 'Feint', 'attack', .75, 1, 'exposed', 'A light strike that leaves the target exposed.']
};
const statusDescriptions = { slow: 'slows the target', exposed: 'exposes the target', stun: 'stuns the target' };

// All forms retain their basic utility. Learned skills add a species signature,
// a role specialty, and a stronger long-reach version of the signature.
export function getAbilities(member) {
  const species = SPECIES[member.speciesId];
  const { range } = roleStats[species.role];
  const [strike, utility, kind, power, reach, status, description] = roleBasics[species.role];
  const basic = ability('strike', strike, 'attack', 1, range, null, 'Deal damage within ' + range + (range === 1 ? ' space.' : ' spaces.'), 1);
  const support = ability('utility', utility, kind, power, reach, status, description, 1);
  const technique = species.technique ?? { kind: 'attack', power: 1.12, range: species.role === 'striker' ? 2 : range };
  const healing = technique.kind === 'heal';
  const signature = ability('signature', species.signature, technique.kind, technique.power, technique.range, species.effect,
    healing ? 'Restore health to an ally within ' + technique.range + ' spaces.' :
      'A signature attack that ' + statusDescriptions[species.effect] + '.', 6);
  let specialty;
  if (species.role === 'healer') {
    specialty = ability('specialty', 'Greater Mend', 'heal', 1.8, 4, null, 'Restore more health from up to four spaces.', 12);
  } else if (species.role === 'defender') {
    specialty = ability('specialty', 'Faultline', 'attack', 1.35, 2, 'slow', 'Fracture the ground to slow a foe up to two spaces away.', 12);
  } else if (species.role === 'ranged') {
    specialty = ability('specialty', 'Sightline', 'attack', 1.3, 4, null, 'Make a powerful shot from up to four spaces.', 12);
  } else {
    specialty = ability('specialty', 'Crosscut', 'attack', 1.5, 1, null, 'A powerful close-range strike.', 12);
  }
  const apexPower = Number((technique.power + .43).toFixed(2));
  const apex = ability('apex', species.signature + ' II', technique.kind, apexPower, technique.range + 1, species.effect,
    healing ? 'Restore more health to an ally within ' + (technique.range + 1) + ' spaces.' :
      'An evolved signature with extra reach that ' + statusDescriptions[species.effect] + '.', 20);
  return [basic, support, signature, specialty, apex].filter(move => move.learnLevel <= member.level);
}

export function captureChance(member, hpFraction, hasStatus = false) {
  const species = SPECIES[member.speciesId];
  const missingHealth = 1 - clamp(Number.isFinite(hpFraction) ? hpFraction : 1, 0, 1);
  const levelFactor = 1 / (1 + Math.max(0, member.level - 1) * .012);
  const base = species.captureRate * levelFactor;
  // Boost odds (p / (1 - p)) so status always helps, even on a weakened common.
  const odds = base / (1 - base) * (1 + 2.1 * missingHealth + (hasStatus ? .85 : 0));
  return odds / (1 + odds);
}

// Ordinary patrols draw from the original six local families. Only a tracked
// frontier sighting can add a rare or legendary leader from its exact habitat.
const encounterWeights = [8, 8, 6, 5, 3, 2];
export function rollEncounter(region, { legendary = false, challenge = false, level, habitatId, leadSpeciesId, rng = Math.random } = {}) {
  const area = REGIONS[region];
  if (!area) throw new RangeError('Unknown region');
  const strongest = clamp(Math.floor(Number(level) || area.minLevel), 1, MAX_LEVEL);
  const sighted = SPECIES[leadSpeciesId];
  const habitatMatch = sighted?.habitatId && sighted.habitatId === habitatId && sighted.region === region;
  const legacyLegend = legendary && (!habitatId || habitatId === 'hollow');
  const legendaryPack = legacyLegend || (habitatMatch && sighted.legendary);
  const packSize = legendaryPack ? 2 : challenge ? (region > 2 ? 4 : 3) : (region > 0 && rng() < .65 ? 3 : 2);
  const available = encounterWeights.map((weight, slot) => ({ id: region * 7 + slot, weight }));
  const pack = [];
  const leadIndex = available.findIndex(item => item.id === leadSpeciesId);
  if (habitatMatch) {
    pack.push(makeMember(sighted.id, strongest));
  } else if (legacyLegend) {
    pack.push(makeMember(region * 7 + 6, strongest));
  } else if (leadIndex >= 0) {
    available.splice(leadIndex, 1);
    pack.push(makeMember(leadSpeciesId, strongest));
  }
  while (pack.length < packSize) {
    const total = available.reduce((sum, item) => sum + item.weight, 0);
    let value = rng() * total;
    let pick = available.findIndex(item => (value -= item.weight) < 0);
    if (pick < 0) pick = available.length - 1;
    const [{ id }] = available.splice(pick, 1);
    const spread = pack.length === 0 ? 0 : 1 + Math.floor(rng() * 2);
    pack.push(makeMember(id, Math.max(1, strongest - spread)));
  }
  return pack;
}
