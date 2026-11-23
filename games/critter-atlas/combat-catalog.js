const affinityRows = {
  forest: ['Woodland', '#a1cf72', ['marsh', 'cave']],
  marsh: ['Wetland', '#86cbb4', ['ruins', 'astral']],
  cave: ['Crystal', '#c8afea', ['mountains', 'astral']],
  coast: ['Tidal', '#8bd9e3', ['volcanic', 'cave']],
  mountains: ['Alpine', '#b6daec', ['forest', 'marsh']],
  volcanic: ['Cinder', '#ffab87', ['forest', 'mountains']],
  ruins: ['Ancient', '#e5c282', ['coast', 'volcanic']],
  astral: ['Astral', '#b8b1ee', ['ruins', 'coast']]
};

export const AFFINITIES = Object.fromEntries(Object.entries(affinityRows).map(([id, [name, color, strongAgainst]]) => {
  const resistedBy = [id, ...Object.keys(affinityRows).filter(other => affinityRows[other][2].includes(id))];
  return [id, { name, color, strongAgainst, resistedBy }];
}));

export const AFFINITY_DAMAGE = Object.freeze({ effective: 1.5, resisted: .65, neutral: 1 });

export function affinityMultiplier(attackAffinity, defendAffinity) {
  const affinity = AFFINITIES[attackAffinity];
  if (affinity?.strongAgainst?.includes(defendAffinity)) return AFFINITY_DAMAGE.effective;
  if (affinity?.resistedBy?.includes(defendAffinity)) return AFFINITY_DAMAGE.resisted;
  return AFFINITY_DAMAGE.neutral;
}

const regionalAffinities = Object.keys(AFFINITIES);
const familyAffinities = {
  2: 'astral', 4: 'cave', 9: 'volcanic', 11: 'forest', 13: 'astral',
  17: 'ruins', 18: 'coast', 25: 'mountains', 27: 'astral',
  31: 'forest', 33: 'volcanic', 34: 'astral', 39: 'coast',
  43: 'cave', 45: 'volcanic', 54: 'coast', 62: 'coast', 76: 'astral',
  81: 'forest', 82: 'forest', 83: 'forest', 84: 'mountains', 85: 'mountains',
  86: 'volcanic', 87: 'ruins', 88: 'mountains', 89: 'mountains',
  90: 'coast', 91: 'cave', 92: 'marsh', 93: 'coast', 94: 'cave',
  95: 'ruins', 96: 'cave', 97: 'coast', 98: 'astral',
  99: 'mountains', 100: 'astral', 101: 'mountains', 102: 'astral', 103: 'mountains',
  104: 'mountains', 105: 'astral', 106: 'cave', 107: 'astral'
};

export function getSpeciesAffinity(species) {
  return species.affinity ?? familyAffinities[species.id] ?? regionalAffinities[species.region];
}

export const BUFFS = {
  power: { name: 'Might', tip: 'Deals 35% more attack damage.', duration: 2, amount: .35 },
  ward: { name: 'Ward', tip: 'Takes 35% less attack damage.', duration: 2, amount: .35 },
  haste: { name: 'Haste', tip: 'Can move one extra hex per turn.', duration: 2, amount: 1 },
  cleanse: { name: 'Cleanse', tip: 'Removes Slow, Exposure, and Stun.', duration: 0, amount: 0 },
  regen: { name: 'Regeneration', tip: 'Restores 12% of maximum HP at the end of each turn.', duration: 2, amount: .12 }
};

export const AURAS = {
  rally: { id: 'rally', name: 'Rally Aura', tip: 'Nearby allies deal 20% more attack damage.', radius: 2, amount: .2, target: 'ally' },
  bulwark: { id: 'bulwark', name: 'Bulwark Aura', tip: 'Nearby allies take 20% less attack damage.', radius: 2, amount: .2, target: 'ally' },
  tailwind: { id: 'tailwind', name: 'Tailwind Aura', tip: 'Nearby allies can move one extra hex.', radius: 2, amount: 1, target: 'ally' },
  renewal: { id: 'renewal', name: 'Renewal Aura', tip: 'Nearby allies restore 8% of maximum HP when their turn ends.', radius: 2, amount: .08, target: 'ally' },
  dread: { id: 'dread', name: 'Dread Aura', tip: 'Nearby foes deal 15% less attack damage.', radius: 2, amount: .15, target: 'enemy' }
};

// The earlier trails mix common and rare carriers. Later auras unlock on evolved forms.
const familyAuras = {
  4: ['bulwark', 6, 1], 5: ['rally', 12], 6: ['renewal', 20],
  8: ['tailwind', 6], 9: ['renewal', 12], 13: ['dread', 12, 1],
  16: ['rally', 6], 17: ['bulwark', 12], 20: ['dread', 12],
  21: ['bulwark', 12], 25: ['tailwind', 6], 27: ['renewal', 12],
  28: ['bulwark', 6], 29: ['tailwind', 6], 34: ['dread', 12, 1],
  35: ['bulwark', 6], 36: ['rally', 6], 39: ['renewal', 12],
  42: ['bulwark', 6], 44: ['renewal', 12], 45: ['rally', 12],
  48: ['dread', 12], 51: ['bulwark', 12], 52: ['tailwind', 12],
  55: ['renewal', 20], 58: ['bulwark', 12], 60: ['rally', 12], 65: ['tailwind', 12],
  68: ['bulwark', 12], 70: ['rally', 20], 73: ['dread', 20], 75: ['tailwind', 20],
  76: ['tailwind', 12], 77: ['rally', 12], 78: ['dread', 12], 79: ['bulwark', 12], 80: ['renewal', 12],
  82: ['renewal', 12], 85: ['bulwark', 12], 89: ['tailwind', 20],
  92: ['renewal', 12], 94: ['bulwark', 12], 96: ['dread', 20],
  102: ['renewal', 12], 103: ['tailwind', 12], 104: ['bulwark', 20]
};

export function getSpeciesAura(species) {
  if (species.aura) return species.aura;
  const entry = familyAuras[species.id];
  if (!entry) return undefined;
  const [id, unlockLevel, radius] = entry;
  return { id, unlockLevel, radius };
}

const support = (name, buff, range, area = 0) => ({ name, kind: 'support', buff, range, area });
const typedAttack = (name, affinity, power, range, status = null) => ({ name, kind: 'attack', affinity, power, range, status });

// Learnsets retain each family's signature name and specialize along its role.
// The early utility, learned signature, and evolved specialty can vary independently.
export const BATTLE_KITS = {
  0: { specialty: support('Grove Call', 'power', 2) },
  1: { specialty: support('Timber Shield', 'ward', 2) },
  2: { signature: support(null, 'regen', 3), specialty: typedAttack('Moonlit Thread', 'astral', 1.25, 3) },
  3: { utility: typedAttack('Thorn Pellet', 'forest', .8, 3, 'slow'), specialty: support('Forager’s Rally', 'power', 3) },
  4: { utility: support('Wax Patch', 'ward', 2), signature: support(null, 'ward', 2) },
  5: { specialty: support('Perch Signal', 'power', 4) },
  6: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Petal Spiral', 'forest', 1.3, 3, 'exposed') },
  7: { specialty: support('Lily Cover', 'ward', 2, 1) },
  8: { utility: support('Stride High', 'haste', 0) },
  9: { utility: support('Lamplight Balm', 'regen', 3), specialty: support('Wicklight Remedy', 'cleanse', 3) },
  10: { utility: typedAttack('Mud Jet', 'marsh', .8, 3, 'slow'), specialty: support('Pathfinder Splash', 'haste', 2, 1) },
  11: { specialty: support('Reed Shelter', 'ward', 3) },
  12: { utility: support('Slipstream', 'haste', 2) },
  13: { utility: support('Wader’s Signal', 'ward', 3), specialty: typedAttack('Bog Mirage', 'marsh', 1.22, 4, 'exposed') },
  14: { utility: support('Hone Claws', 'power', 0) },
  15: { utility: support('Cave Chart', 'haste', 3), specialty: support('Echo Signal', 'power', 3) },
  16: { signature: support(null, 'power', 3), specialty: typedAttack('Amber Resonance', 'cave', 1.3, 3) },
  17: { specialty: support('Stone Aegis', 'ward', 2) },
  18: { signature: support(null, 'cleanse', 3), specialty: typedAttack('Pearl Current', 'coast', 1.25, 3) },
  19: { utility: support('Laminate', 'ward', 0) },
  20: { utility: support('Prism Shield', 'ward', 2), specialty: typedAttack('Stellar Refraction', 'astral', 1.25, 4) },
  21: { utility: support('Pass the Shell', 'ward', 2) },
  22: { utility: support('Breaker’s Lead', 'haste', 2), specialty: typedAttack('Frozen Wake', 'mountains', 1.35, 2, 'slow') },
  23: { signature: support(null, 'regen', 3), specialty: typedAttack('Coral Dart', 'coast', 1.28, 3) },
  24: { utility: support('Otter Signal', 'power', 2), specialty: support('Rallying Whistle', 'haste', 3) },
  25: { utility: support('Trade Winds', 'haste', 2) },
  26: { specialty: support('Bristle Mantle', 'ward', 3) },
  27: { signature: support(null, 'cleanse', 3, 1), specialty: typedAttack('Beacon Ray', 'astral', 1.3, 4) },
  28: { specialty: support('Fleece Wall', 'ward', 2, 1) },
  29: { utility: support('Tailwind', 'haste', 3) },
  30: { utility: support('Snow Sprint', 'haste', 0) },
  31: { specialty: support('Bellflower Ring', 'cleanse', 3) },
  32: { utility: support('Ridge Stalk', 'power', 0) },
  33: { utility: support('Crag Cover', 'ward', 2), specialty: typedAttack('Obsidian Splinter', 'cave', 1.28, 3, 'exposed') },
  34: { specialty: support('Aurora Charge', 'power', 2) },
  35: { specialty: support('Bank the Ember', 'ward', 2) },
  36: { utility: support('Ash Signal', 'power', 3) },
  37: { utility: support('Stoke', 'power', 0) },
  38: { utility: support('Singe Away', 'cleanse', 2), specialty: typedAttack('Glass Stinger', 'cave', 1.25, 4, 'exposed') },
  39: { signature: support(null, 'ward', 3), specialty: typedAttack('Scalding Jet', 'volcanic', 1.3, 3) },
  40: { specialty: support('Kiln Mantle', 'ward', 2) },
  41: { specialty: support('Crown Edict', 'power', 2, 1) },
  42: { utility: support('Mosaic Shield', 'ward', 2) },
  43: { utility: support('Gargoyle Perch', 'ward', 2), specialty: typedAttack('Rainspout Burst', 'coast', 1.3, 3, 'slow') },
  44: { signature: support(null, 'cleanse', 3), specialty: typedAttack('Golden Inscription', 'ruins', 1.28, 3) },
  45: { specialty: support('Sun Pennant', 'power', 4) },
  46: { specialty: support('Glaze Coat', 'ward', 3) },
  47: { utility: support('Courtyard Dash', 'haste', 0) },
  48: { specialty: support('Royal Council', 'power', 3, 1) },
  49: { utility: support('Burn Brighter', 'power', 0) },
  50: { signature: support(null, 'regen', 3), specialty: typedAttack('Stellar Ripple', 'astral', 1.3, 3) },
  51: { specialty: support('Crescent Halo', 'ward', 3) },
  52: { specialty: support('Slingshot', 'haste', 2) },
  53: { utility: support('Moonlit Flight', 'haste', 3), specialty: typedAttack('Night Ice', 'mountains', 1.22, 4, 'slow') },
  54: { utility: support('Gravity Shell', 'ward', 2) },
  55: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Falling Stars', 'astral', 1.34, 4, 'slow') },
  56: { utility: support('Spore Shelter', 'regen', 2), specialty: typedAttack('Lichen Spore', 'forest', 1.25, 3, 'slow') },
  57: { utility: support('Frond Focus', 'power', 0) },
  58: { specialty: support('Heartwood Ward', 'ward', 3, 1) },
  59: { specialty: support('Deepwater Prep', 'regen', 3) },
  60: { specialty: support('Crown of Reeds', 'power', 2) },
  61: { specialty: support('Copper Shell', 'ward', 2) },
  62: { utility: support('Jetstream', 'haste', 0) },
  63: { utility: support('Silk Tether', 'ward', 2), specialty: typedAttack('Amber Web', 'forest', 1.23, 4, 'slow') },
  64: { utility: support('Shoal Bell', 'cleanse', 3), specialty: typedAttack('Bell Tide', 'coast', 1.28, 4) },
  65: { specialty: support('Gyre Draft', 'haste', 2, 1) },
  66: { utility: support('Flight Call', 'haste', 3) },
  67: { utility: support('Open Sails', 'haste', 2) },
  68: { specialty: support('Rime Bastion', 'ward', 3, 1) },
  69: { utility: support('Molten Claw', 'power', 0) },
  70: { specialty: support('Stand in the Sun', 'power', 3, 1) },
  71: { specialty: support('Cairn Wall', 'ward', 2) },
  72: { specialty: support('Writ of Relief', 'cleanse', 4) },
  73: { utility: support('Stone Circle', 'ward', 2), specialty: typedAttack('Obelisk Shock', 'ruins', 1.32, 3, 'exposed') },
  74: { specialty: support('Night Signal', 'cleanse', 3) },
  75: { specialty: support('Meridian Lift', 'haste', 3, 1) },
  76: { specialty: support('Luna Dust', 'haste', 3, 1) },
  77: { utility: support('Siphon Cadence', 'power', 3), specialty: typedAttack('Cantor’s Resonance', 'cave', 1.38, 4) },
  78: { specialty: support('Wake Rally', 'power', 3, 1) },
  79: { specialty: support('Obsidian Screen', 'ward', 3, 1) },
  80: { utility: support('Polychrome Veil', 'ward', 3), specialty: typedAttack('Dawn Prism', 'cave', 1.35, 4, 'exposed') },

  81: { specialty: support('Rally the Herd', 'power', 2) },
  82: { signature: support(null, 'regen', 3), specialty: typedAttack('Chaff Spiral', 'forest', 1.3, 3) },
  83: { signature: support(null, 'ward', 2) },
  84: { utility: support('Kestrel Draft', 'haste', 3) },
  85: { signature: support(null, 'ward', 2, 1), specialty: typedAttack('Thunder Fleece', 'volcanic', 1.32, 2, 'slow') },
  86: { utility: support('Longrun', 'haste', 0) },
  87: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Brass Blossom', 'ruins', 1.35, 3, 'exposed') },
  88: { utility: support('Meadow Lift', 'haste', 2), specialty: typedAttack('Foil Sweep', 'forest', 1.28, 2, 'slow') },
  89: { specialty: support('Thunder Orders', 'power', 3, 1) },
  90: { utility: support('Mirage Stride', 'haste', 0) },
  91: { specialty: support('Salt Bulwark', 'ward', 2, 1) },
  92: { signature: support(null, 'cleanse', 3), specialty: typedAttack('Brine Ink', 'marsh', 1.32, 3, 'slow') },
  93: { specialty: support('Crossing Signal', 'haste', 3) },
  94: { specialty: support('Salt Hood', 'ward', 3) },
  95: { specialty: support('Glare Signal', 'power', 4) },
  96: { utility: support('Marshalled Reflection', 'power', 3), specialty: typedAttack('False Sky Beam', 'astral', 1.35, 4, 'exposed') },
  97: { signature: support(null, 'regen', 3), specialty: typedAttack('Salt Ripple', 'coast', 1.32, 3) },
  98: { specialty: support('Mirror Seal', 'ward', 3, 1) },
  99: { specialty: support('Driftwall', 'ward', 2, 1) },
  100: { utility: support('Polar Beacon', 'haste', 3), specialty: typedAttack('Beacon Hail', 'mountains', 1.32, 4, 'slow') },
  101: { utility: support('Floe Sprint', 'haste', 0), specialty: typedAttack('Icebreaker Kick', 'coast', 1.3, 2, 'exposed') },
  102: { signature: support(null, 'regen', 3), specialty: typedAttack('Night Chime', 'astral', 1.32, 3) },
  103: { utility: support('Crosswind', 'haste', 3) },
  104: { signature: support(null, 'ward', 3, 1), specialty: typedAttack('Glaze Break', 'cave', 1.34, 3, 'exposed') },
  105: { specialty: support('Greenfire Rally', 'power', 2) },
  106: { specialty: support('Passage Bell', 'cleanse', 3, 1) },
  107: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Polar Current', 'coast', 1.4, 4) },

  108: { utility: support('Spore Mend', 'regen', 2), specialty: support('Pollen Wash', 'cleanse', 3, 1) },
  109: { utility: support('Cast Resin', 'ward', 2), specialty: support('Set the Sap', 'ward', 3, 1) },
  110: { utility: support('Punt Tow', 'haste', 3), specialty: support('Skiff Signals', 'power', 3, 1) },
  111: { utility: support('Fog Rally', 'power', 2), specialty: typedAttack('Wickshadow Rake', 'astral', 1.28, 2, 'exposed') },
  112: { utility: support('Ore Call', 'power', 3), specialty: support('Resonant Sweep', 'cleanse', 2, 1) },
  113: { utility: support('Ring the Guard', 'ward', 2), specialty: support('Bellfound Shelter', 'regen', 2, 1) },
  114: { utility: support('Wave Route', 'haste', 3), specialty: support('Spindrift Shield', 'ward', 2) },
  115: { signature: support(null, 'regen', 3), specialty: typedAttack('Beacon Frill', 'coast', 1.3, 3) },
  116: { utility: support('Slip Under', 'haste', 2, 1), specialty: support('Snow Mask', 'ward', 3) },
  117: { utility: support('Knit Needles', 'ward', 2), specialty: support('Pine Shelter', 'regen', 2, 1) },
  118: { utility: support('Marching Cadence', 'power', 3), specialty: support('Kiln Refrain', 'cleanse', 3) },
  119: { utility: support('Smoke Screen', 'ward', 3), specialty: typedAttack('Furnace Toll', 'volcanic', 1.34, 4, 'slow') },
  120: { signature: support(null, 'cleanse', 3, 1), specialty: typedAttack('Cartouche Ray', 'ruins', 1.32, 3, 'exposed') },
  121: { utility: support('Court Signals', 'power', 4), specialty: support('Terrace Cover', 'ward', 3) },
  122: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Orbital Spore', 'astral', 1.24, 3, 'slow') },
  123: { utility: support('Gravitate', 'power', 2), specialty: support('Gravity Tow', 'haste', 2, 1) },
  124: { utility: support('Clear the Grass', 'haste', 3), specialty: support('Sling Signal', 'power', 4) },
  125: { utility: support('Windbreak', 'ward', 3), specialty: support('Thunder Call', 'power', 2, 1) },
  126: { utility: support('Alkali Cover', 'ward', 2), specialty: support('Brackish Bath', 'cleanse', 2, 1) },
  127: { utility: support('Chalk Outline', 'ward', 3), specialty: typedAttack('False Crown', 'astral', 1.28, 4, 'exposed') },
  128: { utility: support('Light the Way', 'power', 3), specialty: support('Wings Together', 'haste', 3, 1) },
  129: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Lotus Shieldbreak', 'mountains', 1.33, 3, 'exposed') }
};
