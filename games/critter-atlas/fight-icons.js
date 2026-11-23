import { AURAS, BUFFS, SPECIES } from './catalog.js';
import { EXPANSION_BIOMES } from './expansion-regions.js';

// Atlas cells run left to right. Semantic names keep the same glyph in the
// arena, action bar, combat log and field guide.
const glyphs = [
  ['move', 'Move', 'Walk along an open path to a reachable hex.'],
  ['melee', 'Melee attack', 'Strike an adjacent opponent.'],
  ['ranged', 'Ranged attack', 'Attack a foe within the ability’s range.'],
  ['heal', 'Heal', 'Restore health to a wounded companion in range.'],
  ['guard', 'Guard', 'Reduce damage taken until this Critter’s next turn.'],
  ['capture', 'Capture', 'Try to recruit a wild Critter within three hexes.'],
  ['wait', 'Wait', 'Before moving, delay this Critter’s turn until the end of the round. Usable once per round.'],
  ['retreat', 'Retreat', 'Leave this encounter and return to the trail.'],

  ['damage', 'Damage', 'The target loses health.'],
  ['hp', 'Health', 'Current and maximum hit points.'],
  ['faint', 'Fainted', 'The Critter has no health left and leaves the fight.'],
  ['caught', 'Captured', 'The wild Critter joins your party or reserve.'],
  ['escaped', 'Broke free', 'The capture failed and the wild Critter remains in battle.'],
  ['victory', 'Victory', 'Every wild opponent has been captured or defeated.'],
  ['defeat', 'Defeat', 'Your party has run out of fighting Critters.'],
  ['target', 'Target', 'A Critter that the selected action can reach.'],

  ['slow', 'Slowed', 'The Critter can move one fewer hex on its next turn.'],
  ['exposed', 'Exposed', 'The Critter takes 25% more attack damage until the effect wears off.'],
  ['stun', 'Stunned', 'The Critter misses its next turn.'],
  ['burn', 'Scorch damage', 'Ending a turn on this hazard removes 18% of maximum health.'],
  ['hurt', 'Bog damage', 'Ending a turn in the bog removes 12% of maximum health.'],
  ['apply', 'Effect applied', 'The Critter gains the indicated condition.'],
  ['clear', 'Effect ended', 'The indicated condition has worn off.'],
  ['cooldown', 'Recovering', 'This ability needs another turn before it can be used again.'],

  ['flank', 'Flank', 'A melee attack gains 20% damage when another ally is beside the target.'],
  ['cover', 'Cover', 'Ranged attacks against an occupant deal 28% less damage.'],
  ['plain', 'Open ground', 'This hex is clear to walk across.'],
  ['rock', 'Impassable', 'This obstacle blocks movement.'],
  ['hazard', 'Terrain hazard', 'The terrain takes effect when a Critter finishes its turn here.'],
  ['range', 'Range', 'Maximum distance in hexes to a target.'],
  ['speed', 'Speed', 'Faster Critters act earlier in each round.'],
  ['turn', 'Current turn', 'This Critter is acting now.'],

  ['striker', 'Fast striker', 'A mobile close-range attacker.'],
  ['defender', 'Defender', 'A tough frontliner with a strong guard.'],
  ['healer', 'Healer', 'A support Critter that restores allies’ health.'],
  ['xp', 'Experience', 'XP from battle helps Critters level up and evolve.'],
  ['forecast', 'Forecast', 'Shows the expected result of the selected action.'],
  ['status', 'Status effect', 'A temporary condition affecting a Critter.'],
  ['skip', 'Turn skipped', 'This Critter missed its turn.'],
  ['heal-strong', 'Greater Mend', 'Restore more health from up to four hexes away.'],

  ['shell-check', 'Shell Check', 'An adjacent foe takes a hit from the defender.'],
  ['quick-shot', 'Quick Shot', 'A quick ranged attack.'],
  ['spark', 'Spark', 'A healer’s ranged spark attack.'],
  ['swipe', 'Quick Swipe', 'A swift close-range strike.'],
  ['pinning-shot', 'Pinning Shot', 'A light ranged hit slows its target.'],
  ['feint', 'Feint', 'A light melee strike exposes the target.'],
  ['faultline', 'Faultline', 'A ground fracture strikes and slows a nearby foe.'],
  ['sightline', 'Sightline', 'A powerful long-range shot.'],

  ['crosscut', 'Crosscut', 'A powerful close-range attack.'],
  ['archer', 'Ranged attacker', 'An attacker that fights from a distance.'],
  ['wild', 'Wild Critter', 'A member of the opposing tribe.'],
  ['ally', 'Ally', 'A member of your fighting party.'],
  ['initiative', 'Turn order', 'Upcoming turns in the current round.'],
  ['warden', 'Warden', 'The guardian of a regional arena.'],
  ['legendary', 'Legendary', 'An exceptionally rare regional Critter.'],
  ['tribe', 'Wild tribe', 'Wild Critters encountered together.'],

  ['hazard-forest', 'Hookbriar', 'Thorny vines slow a Critter that ends its turn here.'],
  ['hazard-marsh', 'Sour bog', 'Bog water damages a Critter that ends its turn here.'],
  ['hazard-cave', 'Loose shale', 'Shifting stone leaves a Critter exposed.'],
  ['hazard-coast', 'Riptide', 'The current slows a Critter that ends its turn here.'],
  ['hazard-mountains', 'Black ice', 'Slippery footing slows a Critter that ends its turn here.'],
  ['hazard-volcanic', 'Lava vent', 'Hot lava damages a Critter that ends its turn here.'],
  ['hazard-ruins', 'Rune trap', 'The rune leaves a Critter exposed.'],
  ['hazard-astral', 'Starfall', 'Falling star fragments damage the occupant.'],

  ['affinity-forest', 'Woodland', 'The wild magic of Mossbell Wood.'],
  ['affinity-marsh', 'Wetland', 'The wild magic of Lantern Fen.'],
  ['affinity-cave', 'Crystal', 'The wild magic of Prism Hollows.'],
  ['affinity-coast', 'Tidal', 'The wild magic of Tidemark Coast.'],
  ['affinity-mountains', 'Alpine', 'The wild magic of Galehorn Peaks.'],
  ['affinity-volcanic', 'Cinder', 'The wild magic of Cinder Basin.'],
  ['affinity-ruins', 'Ancient', 'The wild magic of the Sunken Court.'],
  ['affinity-astral', 'Astral', 'The wild magic of Starfall Reach.']
];

const paintedFamilies = SPECIES.filter(family => family.baseSpeciesId === undefined);
for (const family of paintedFamilies) {
  glyphs.push(['signature-' + family.id, family.signature,
    family.name + '’s signature ability.']);
}
for (const family of paintedFamilies) {
  glyphs.push(['apex-' + family.id, family.signature + ' II',
    'The evolved signature of ' + family.forms[3] + '.']);
}

glyphs.push(
  ['sound-on', 'Sound on', 'Battle sounds are enabled.'],
  ['sound-off', 'Sound off', 'Battle sounds are muted.']
);

const icons = Object.fromEntries(glyphs.map(([key, label, description], index) => [key, { label, description, index }]));

for (const family of SPECIES.filter(family => family.baseSpeciesId !== undefined)) {
  icons['signature-' + family.id] = {
    label: family.signature, description: family.name + '’s signature ability.', alias: 'signature-' + family.baseSpeciesId
  };
  icons['apex-' + family.id] = {
    label: family.signature + ' II', description: 'The evolved signature of ' + family.forms[3] + '.', alias: 'apex-' + family.baseSpeciesId
  };
}

for (const [id, symbol, color] of [
  ['power', '↑', '#ffe394'], ['ward', '◆', '#9bdbff'], ['haste', '»', '#fddba0'],
  ['cleanse', '✦', '#e2baff'], ['regen', '+', '#a0f6b3']
]) {
  icons[id] = { label: BUFFS[id].name, description: BUFFS[id].tip, symbol, color };
}

for (const [id, symbol, color] of [
  ['rally', '⬆', '#ffcb81'], ['bulwark', '⬟', '#a6c8ff'], ['tailwind', '≻', '#a0eee4'],
  ['renewal', '✚', '#abe7ac'], ['dread', '◈', '#f4a8dc']
]) {
  icons['aura-' + id] = { label: AURAS[id].name, description: AURAS[id].tip, symbol, color };
}

const symbols = [
  ['effective', 'Effective', 'This affinity deals 50% more attack damage.', '▲', '#a0f6b3'],
  ['resisted', 'Resisted', 'The target’s affinity reduces attack damage by 35%.', '▼', '#ffd0a1'],
  ['neutral', 'Neutral', 'This attack deals its normal damage against any affinity.', '•', '#dfdec3'],
  ...EXPANSION_BIOMES.map(({ hazard }, i) => [
    'hazard-expansion-' + i, hazard,
    ['Bristles slow Critters that end their turn here.', 'Bright glare leaves Critters exposed.', 'Frigid air damages Critters that end their turn here.'][i],
    ['≋', '✧', '❄'][i], ['#e9cc89', '#fff2d3', '#a9eaff'][i]
  ])
];
for (const [id, label, description, symbol, color] of symbols) icons[id] = { label, description, symbol, color };

export const FIGHT_ICONS = Object.freeze(Object.fromEntries(Object.entries(icons).map(([id, icon]) => [id, Object.freeze(icon)])));
const columns = 8;
const rows = Math.ceil(glyphs.length / columns);
const biomes = ['forest','marsh','cave','coast','mountains','volcanic','ruins','astral'];

export function hazardIconKey(region) {
  if (biomes[region]) return 'hazard-' + biomes[region];
  const expansion = 'hazard-expansion-' + (region - biomes.length);
  return FIGHT_ICONS[expansion] ? expansion : 'hazard';
}

export function affinityIconKey(affinity) {
  return biomes.includes(affinity) ? 'affinity-' + affinity : 'neutral';
}

export function auraIconKey(id) {
  return 'aura-' + id;
}

const namedSkills = {
  'Shell Check': 'shell-check', 'Quick Shot': 'quick-shot', Spark: 'spark', 'Quick Swipe': 'swipe',
  Brace: 'guard', 'Pinning Shot': 'pinning-shot', Mend: 'heal', Feint: 'feint',
  'Greater Mend': 'heal-strong', Faultline: 'faultline', Sightline: 'sightline', Crosscut: 'crosscut'
};

export function abilityIconKey(ability, species) {
  if (!ability) return 'melee';
  if (ability.id === 'signature' || ability.id === 'apex') {
    const id = typeof species === 'number' ? species : species?.id ?? species?.speciesId;
    if (Number.isInteger(id) && SPECIES[id]) return ability.id + '-' + id;
  }
  if (ability.kind === 'support') return ability.buff;
  return namedSkills[ability.name] ?? (ability.kind === 'attack' ? (ability.range > 1 ? 'ranged' : 'melee') : ability.kind);
}

const escapeAttr = text => String(text).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

/** Omit label to announce the symbol; pass an empty string beside equivalent visible text. */
export function fightIcon(key, label) {
  if (!Object.hasOwn(FIGHT_ICONS, key)) return '';
  const icon = FIGHT_ICONS[key];
  const semantics = label === '' ? 'aria-hidden="true"' :
    'role="img" aria-label="' + escapeAttr(label ?? icon.label) + '" title="' + escapeAttr(label ?? icon.label) + '"';
  if (icon.symbol) {
    return '<span class="fight-icon fight-symbol" data-fight-icon="' + key + '" ' + semantics +
      ' style="--fight-symbol-color:' + icon.color + '">' + icon.symbol + '</span>';
  }
  const index = icon.index ?? FIGHT_ICONS[icon.alias].index;
  const x = (index % columns) * 100 / (columns - 1);
  const y = Math.floor(index / columns) * 100 / (rows - 1);
  return '<span class="fight-icon" data-fight-icon="' + key + '" ' + semantics +
    ' style="--fight-icon-rows:' + (rows * 100) + '%;background-position:' + x + '% ' + y + '%"></span>';
}
