import { FRONTIER_SPECIES } from './frontier-species.js';
import { HYPER_SPECIES } from './hyper-species.js';
import { EXPANSION_REGIONS } from './expansion-regions.js';
import { expansionSpecies } from './expansion-species.js';
import { trailSpecies } from './trail-species.js';
import { AFFINITIES, AURAS, BUFFS, BATTLE_KITS, getSpeciesAffinity, getSpeciesAura } from './combat-catalog.js';

export { AFFINITIES, AFFINITY_DAMAGE, AURAS, BUFFS, affinityMultiplier } from './combat-catalog.js';

// Region, species, and combat definitions shared by the trail, party, and arena.
const regionRows = [
  ['Mossbell Wood', 'forest', 2, 'Mossbell Foragers', 'Bramble Ring', 'Thorns', '#79b977'],
  ['Lantern Fen', 'marsh', 10, 'Lantern Waders', 'Reedlight Crossing', 'Bog', '#75b7a4'],
  ['Prism Hollows', 'cave', 16, 'Echo Borers', 'Quartz Gallery', 'Shards', '#aa99d1'],
  ['Tidemark Coast', 'coast', 22, 'Foamrunners', 'Coral Shelf', 'Surf', '#73c4ce'],
  ['Galehorn Peaks', 'mountains', 28, 'Galehorn Climbers', 'Windcut Pass', 'Ice', '#a7cbe0'],
  ['Cinder Basin', 'volcanic', 33, 'Cinder Walkers', 'Obsidian Bowl', 'Embers', '#e28b68'],
  ['Sunken Court', 'ruins', 38, 'Mosaic Keepers', 'Broken Sundial', 'Sunseal', '#d6b677'],
  ['Starfall Reach', 'astral', 43, 'Nightgliders', 'Meteor Garden', 'Starfall', '#a69dda']
];
export const REGIONS = regionRows.concat(EXPANSION_REGIONS.map(region => region.catalog))
  .map(([name, biome, minLevel, tribe, arena, hazard, color, artRegion, artFilter = 'none'], id) =>
    ({ id, name, biome, minLevel, tribe, arena, hazard, color, artRegion:artRegion ?? id, artFilter }));

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
const establishedSpecies = lineages.map(([names, animal, role, color, signature, effect, lore], id) => {
  const forms = names.split('|');
  const region = Math.floor(id / 7);
  const slot = id % 7;
  const captureRate = Number((captureSlots[slot] - region * (slot === 6 ? .002 : .008)).toFixed(3));
  return { id, name: forms[0], forms, region, role, animal, color, signature, effect, lore,
    rarity: raritySlots[slot], legendary: slot === 6, captureRate };
}).concat(FRONTIER_SPECIES, HYPER_SPECIES);
const frontierFamilies = establishedSpecies.concat(expansionSpecies(establishedSpecies));
export const SPECIES = frontierFamilies.concat(trailSpecies(frontierFamilies)).map(species => ({
  ...species, affinity: getSpeciesAffinity(species), aura: getSpeciesAura(species)
}));

export const MAX_LEVEL = 60;
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
export function getAura(member) {
  const ability = SPECIES[member.speciesId]?.aura;
  if (!ability || member.level < ability.unlockLevel) return null;
  const aura = AURAS[ability.id];
  return ability.radius === undefined || ability.radius === aura.radius ? aura : { ...aura, radius: ability.radius };
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
  const weight = species.hyperRare ? 1.19 : species.legendary ? 1.13 : 1;
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

const roleBasics = {
  defender: ['Shell Check', { name: 'Brace', kind: 'guard', range: 0 }],
  ranged: ['Quick Shot', { name: 'Pinning Shot', kind: 'attack', power: .7, range: 3, status: 'slow' }],
  healer: ['Spark', { name: 'Mend', kind: 'heal', power: 1.25, range: 3 }],
  striker: ['Quick Swipe', { name: 'Feint', kind: 'attack', power: .75, range: 1, status: 'exposed' }]
};
const roleSpecialties = {
  defender: { name: 'Faultline', kind: 'attack', power: 1.35, range: 2, status: 'slow' },
  ranged: { name: 'Sightline', kind: 'attack', power: 1.3, range: 4 },
  healer: { name: 'Greater Mend', kind: 'heal', power: 1.8, range: 4 },
  striker: { name: 'Crosscut', kind: 'attack', power: 1.5, range: 1 }
};
const statusDescriptions = { slow: 'slows the target', exposed: 'exposes the target', stun: 'stuns the target' };

function ability(id, learnLevel, { name, kind, range, power = 0, status = null, ...details }) {
  const distance = `${range} ${range === 1 ? 'hex' : 'hexes'}`;
  let description;
  if (kind === 'support') {
    const effect = BUFFS[details.buff];
    const duration = details.duration ?? effect.duration;
    const target = range === 0 ? 'Target yourself.' : `Target an ally within ${distance}.`;
    const area = details.area ? ' Also affects allies within one hex of the target.' : '';
    description = `${effect.tip}${duration ? ` Lasts ${duration} turns.` : ''} ${target}${area}`;
  } else if (kind === 'heal') {
    description = `Restore health to an ally within ${distance}.`;
  } else if (kind === 'guard') {
    description = 'Brace against incoming attacks.';
  } else {
    const type = details.affinity ? `${AFFINITIES[details.affinity].name} ` : '';
    const condition = status ? ` This move ${statusDescriptions[status]}.` : '';
    description = `Deal ${type}damage within ${distance}.${condition}`;
  }
  return { id, name, kind, power, range, status, description, learnLevel, ...details };
}

// Basic strikes offer a reliable neutral attack. Typed techniques and support
// moves expand the choices as each family evolves.
export function getAbilities(member) {
  const species = SPECIES[member.speciesId];
  const { range } = roleStats[species.role];
  const [strike, utility] = roleBasics[species.role];
  const kit = BATTLE_KITS[species.id] ?? {};
  const technique = kit.signature ?? {
    ...(species.technique ?? { kind: 'attack', power: 1.12, range: species.role === 'striker' ? 2 : range }),
    status: species.effect
  };
  const signature = { ...technique, name: species.signature };
  const specialty = kit.specialty ?? roleSpecialties[species.role];
  const apex = { ...signature, name: `${signature.name} II`, range: signature.range + 1 };
  if (signature.kind !== 'support') {
    apex.power = Number((signature.power + .43).toFixed(2));
  } else if (!signature.area) {
    apex.area = 1;
  } else if (BUFFS[signature.buff].duration) {
    apex.duration = BUFFS[signature.buff].duration + 1;
  }
  const withAffinity = move => move.kind === 'attack' ? { affinity: species.affinity, ...move } : move;
  return [
    ability('strike', 1, { name: strike, kind: 'attack', power: 1, range }),
    ability('utility', 1, kit.utility ?? utility),
    ability('signature', 6, withAffinity(signature)),
    ability('specialty', 12, withAffinity(specialty)),
    ability('apex', 20, withAffinity(apex))
  ].filter(move => move.learnLevel <= member.level);
}

export function captureChance(member, hpFraction, hasStatus = false) {
  const species = SPECIES[member.speciesId];
  const missingHealth = 1 - clamp(Number.isFinite(hpFraction) ? hpFraction : 1, 0, 1);
  const levelFactor = 1 / (1 + Math.max(0, member.level - 1) * .012);
  const base = Math.max(species.hyperRare ? .01 : 0, species.captureRate * levelFactor);
  // Boost odds (p / (1 - p)) so status always helps, even on a weakened common.
  const odds = base / (1 - base) * (1 + 2.1 * missingHealth + (hasStatus ? .85 : 0));
  return odds / (1 + odds);
}

const regionalFamilies = REGIONS.map(({id}) => SPECIES.filter(species =>
  species.region === id && (!species.habitatId || species.habitatId === 'hollow')));
export const localFamilies = region => regionalFamilies[region];

// Ordinary patrols draw from six local families. Only a tracked
// sighting can add a rare, legendary, or hyper-rare leader from its exact habitat.
const encounterWeights = [8, 8, 6, 5, 3, 2];
export function rollEncounter(region, { legendary = false, challenge = false, level, habitatId, leadSpeciesId, patrolSize, rng = Math.random } = {}) {
  const area = REGIONS[region];
  if (!area) throw new RangeError('Unknown region');
  const strongest = clamp(Math.floor(Number(level) || area.minLevel), 1, MAX_LEVEL);
  const sighted = SPECIES[leadSpeciesId];
  const habitatMatch = sighted?.habitatId && sighted.habitatId === habitatId && sighted.region === region;
  const legacyLegend = legendary && (!habitatId || habitatId === 'hollow');
  const specialPair = legacyLegend || (habitatMatch && (sighted.legendary || sighted.hyperRare));
  const packSize = specialPair ? 2 : patrolSize ?? (challenge ? (region > 2 ? 4 : 3) : (region > 0 && rng() < .65 ? 3 : 2));
  const local = localFamilies(region);
  const available = encounterWeights.map((weight, slot) => ({ id: local[slot].id, weight }));
  const pack = [];
  const leadIndex = available.findIndex(item => item.id === leadSpeciesId);
  if (habitatMatch) {
    pack.push(makeMember(sighted.id, strongest));
  } else if (legacyLegend) {
    pack.push(makeMember(local[6].id, strongest));
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
