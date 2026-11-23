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
  return familyAffinities[species.id] ?? regionalAffinities[species.region];
}

export const BUFFS = {
  power: { name: 'Might', tip: 'Deals 35% more attack damage.', duration: 2, amount: .35 },
  ward: { name: 'Ward', tip: 'Takes 35% less attack damage.', duration: 2, amount: .35 },
  haste: { name: 'Haste', tip: 'Can move one extra hex per turn.', duration: 2, amount: 1 },
  cleanse: { name: 'Cleanse', tip: 'Removes Slow, Exposure, and Stun.', duration: 0, amount: 0 },
  regen: { name: 'Regeneration', tip: 'Restores 12% of maximum HP at the end of each turn.', duration: 2, amount: .12 }
};

const support = (name, buff, range, area = 0) => ({ name, kind: 'support', buff, range, area });
const typedAttack = (name, affinity, power, range, status = null) => ({ name, kind: 'attack', affinity, power, range, status });

// Learnsets retain each family's signature name and specialize along its role.
// The early utility, learned signature, and evolved specialty can vary independently.
export const BATTLE_KITS = {
  0: { specialty: support('Grove Call', 'power', 2) },
  1: { specialty: support('Timber Shield', 'ward', 2) },
  2: { signature: support(null, 'regen', 3), specialty: typedAttack('Moonlit Thread', 'astral', 1.25, 3) },
  3: { utility: typedAttack('Thorn Pellet', 'forest', .8, 3, 'slow') },
  4: { signature: support(null, 'ward', 2) },
  5: { specialty: support('Perch Signal', 'power', 4) },
  6: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Petal Spiral', 'forest', 1.3, 3, 'exposed') },
  7: { specialty: support('Lily Cover', 'ward', 2, 1) },
  8: { utility: support('Stride High', 'haste', 0) },
  9: { specialty: support('Wicklight Remedy', 'cleanse', 3) },
  10: { utility: typedAttack('Mud Jet', 'marsh', .8, 3, 'slow') },
  11: { specialty: support('Reed Shelter', 'ward', 3) },
  12: { utility: support('Slipstream', 'haste', 2) },
  13: { specialty: typedAttack('Bog Mirage', 'marsh', 1.22, 4, 'exposed') },
  14: { utility: support('Hone Claws', 'power', 0) },
  15: { specialty: support('Echo Signal', 'power', 3) },
  16: { signature: support(null, 'power', 3), specialty: typedAttack('Amber Resonance', 'cave', 1.3, 3) },
  17: { specialty: support('Stone Aegis', 'ward', 2) },
  18: { signature: support(null, 'cleanse', 3), specialty: typedAttack('Pearl Current', 'coast', 1.25, 3) },
  19: { utility: support('Laminate', 'ward', 0) },
  20: { specialty: typedAttack('Stellar Refraction', 'astral', 1.25, 4) },
  21: { utility: support('Pass the Shell', 'ward', 2) },
  22: { specialty: typedAttack('Frozen Wake', 'mountains', 1.35, 2, 'slow') },
  23: { signature: support(null, 'regen', 3), specialty: typedAttack('Coral Dart', 'coast', 1.28, 3) },
  24: { specialty: support('Rallying Whistle', 'haste', 3) },
  25: { utility: support('Trade Winds', 'haste', 2) },
  26: { specialty: support('Bristle Mantle', 'ward', 3) },
  27: { signature: support(null, 'cleanse', 3, 1), specialty: typedAttack('Beacon Ray', 'astral', 1.3, 4) },
  28: { specialty: support('Fleece Wall', 'ward', 2, 1) },
  29: { utility: support('Tailwind', 'haste', 3) },
  30: { utility: support('Snow Sprint', 'haste', 0) },
  31: { specialty: support('Bellflower Ring', 'cleanse', 3) },
  32: { utility: support('Ridge Stalk', 'power', 0) },
  33: { specialty: typedAttack('Obsidian Splinter', 'cave', 1.28, 3, 'exposed') },
  34: { specialty: support('Aurora Charge', 'power', 2) },
  35: { specialty: support('Bank the Ember', 'ward', 2) },
  36: { utility: support('Ash Signal', 'power', 3) },
  37: { utility: support('Stoke', 'power', 0) },
  38: { specialty: typedAttack('Glass Stinger', 'cave', 1.25, 4, 'exposed') },
  39: { signature: support(null, 'ward', 3), specialty: typedAttack('Scalding Jet', 'volcanic', 1.3, 3) },
  40: { specialty: support('Kiln Mantle', 'ward', 2) },
  41: { specialty: support('Crown Edict', 'power', 2, 1) },
  42: { utility: support('Mosaic Shield', 'ward', 2) },
  43: { specialty: typedAttack('Rainspout Burst', 'coast', 1.3, 3, 'slow') },
  44: { signature: support(null, 'cleanse', 3), specialty: typedAttack('Golden Inscription', 'ruins', 1.28, 3) },
  45: { specialty: support('Sun Pennant', 'power', 4) },
  46: { specialty: support('Glaze Coat', 'ward', 3) },
  47: { utility: support('Courtyard Dash', 'haste', 0) },
  48: { specialty: support('Royal Council', 'power', 3, 1) },
  49: { utility: support('Burn Brighter', 'power', 0) },
  50: { signature: support(null, 'regen', 3), specialty: typedAttack('Stellar Ripple', 'astral', 1.3, 3) },
  51: { specialty: support('Crescent Halo', 'ward', 3) },
  52: { specialty: support('Slingshot', 'haste', 2) },
  53: { specialty: typedAttack('Night Ice', 'mountains', 1.22, 4, 'slow') },
  54: { utility: support('Gravity Shell', 'ward', 2) },
  55: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Falling Stars', 'astral', 1.34, 4, 'slow') },
  56: { specialty: typedAttack('Lichen Spore', 'forest', 1.25, 3, 'slow') },
  57: { utility: support('Frond Focus', 'power', 0) },
  58: { specialty: support('Heartwood Ward', 'ward', 3, 1) },
  59: { specialty: support('Deepwater Prep', 'regen', 3) },
  60: { specialty: support('Crown of Reeds', 'power', 2) },
  61: { specialty: support('Copper Shell', 'ward', 2) },
  62: { utility: support('Jetstream', 'haste', 0) },
  63: { specialty: typedAttack('Amber Web', 'forest', 1.23, 4, 'slow') },
  64: { specialty: typedAttack('Bell Tide', 'coast', 1.28, 4) },
  65: { specialty: support('Gyre Draft', 'haste', 2, 1) },
  66: { utility: support('Flight Call', 'haste', 3) },
  67: { utility: support('Open Sails', 'haste', 2) },
  68: { specialty: support('Rime Bastion', 'ward', 3, 1) },
  69: { utility: support('Molten Claw', 'power', 0) },
  70: { specialty: support('Stand in the Sun', 'power', 3, 1) },
  71: { specialty: support('Cairn Wall', 'ward', 2) },
  72: { specialty: support('Writ of Relief', 'cleanse', 4) },
  73: { specialty: typedAttack('Obelisk Shock', 'ruins', 1.32, 3, 'exposed') },
  74: { specialty: support('Night Signal', 'cleanse', 3) },
  75: { specialty: support('Meridian Lift', 'haste', 3, 1) },
  76: { specialty: support('Luna Dust', 'haste', 3, 1) },
  77: { specialty: typedAttack('Cantor’s Resonance', 'cave', 1.38, 4) },
  78: { specialty: support('Wake Rally', 'power', 3, 1) },
  79: { specialty: support('Obsidian Screen', 'ward', 3, 1) },
  80: { specialty: typedAttack('Dawn Prism', 'cave', 1.35, 4, 'exposed') },

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
  96: { specialty: typedAttack('False Sky Beam', 'astral', 1.35, 4, 'exposed') },
  97: { signature: support(null, 'regen', 3), specialty: typedAttack('Salt Ripple', 'coast', 1.32, 3) },
  98: { specialty: support('Mirror Seal', 'ward', 3, 1) },
  99: { specialty: support('Driftwall', 'ward', 2, 1) },
  100: { specialty: typedAttack('Beacon Hail', 'mountains', 1.32, 4, 'slow') },
  101: { utility: support('Floe Sprint', 'haste', 0), specialty: typedAttack('Icebreaker Kick', 'coast', 1.3, 2, 'exposed') },
  102: { signature: support(null, 'regen', 3), specialty: typedAttack('Night Chime', 'astral', 1.32, 3) },
  103: { utility: support('Crosswind', 'haste', 3) },
  104: { signature: support(null, 'ward', 3, 1), specialty: typedAttack('Glaze Break', 'cave', 1.34, 3, 'exposed') },
  105: { specialty: support('Greenfire Rally', 'power', 2) },
  106: { specialty: support('Passage Bell', 'cleanse', 3, 1) },
  107: { signature: support(null, 'regen', 3, 1), specialty: typedAttack('Polar Current', 'coast', 1.4, 4) }
};
