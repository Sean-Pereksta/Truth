// These families live beyond the regular patrol routes. IDs are part of saved
// rosters; keep each entry at its assigned index when extending the field guide.
const families = [
  // region, habitat, forms, animal, role, coat, base catch rate
  // signature, status (null for healing), power, reach, natural history
  [0, 'habitat', 'Lichenluff|Feltmoss|Canopurl|Elderbough', 'lichen-backed sloth', 'healer', '#a8bb8a', .213,
    'Moss Poultice', null, 1.48, 3, 'It combs the soft lichen from its shoulders and presses it against cuts with a single curved claw.'],
  [0, 'rookery', 'Twigfoil|Leafrapier|Frondfencer|Foliarch', 'walking-leaf mantis', 'striker', '#a5be67', .198,
    'Leaf Parry', 'exposed', 1.25, 2, 'One foreleg mimics a curled leaf; the other waits beneath it for anything that nibbles.'],
  [0, 'vault', 'Burlursa|Knothide|Honeyburl|Heartwood Ursa', 'fungus-backed moon bear', 'defender', '#bd9a5a', .052,
    'Heartwood Crash', 'stun', 1.26, 1, 'A fallen tree takes root wherever this bear sleeps through three winters. The oldest ones carry tiny forests on their backs.'],
  [1, 'habitat', 'Peatpurl|Siltdiver|Spadedam|Deepbill', 'peat-brown platypus', 'ranged', '#769b92', .206,
    'Silt Fountain', 'slow', 1.04, 4, 'It stamps one webbed foot on the mud to drive a jet of silt through the reeds.'],
  [1, 'vault', 'Crownmire|Reedmaw|Sceptergator|Marshmonarch', 'reed-antlered alligator', 'defender', '#92ae79', .048,
    'Fen Crown', 'slow', 1.4, 2, 'Every reed on its brow belongs to a different pool; when it dives the pools drain a little.'],
  [2, 'habitat', 'Verdigrub|Copperwhorl|Patinacrest|Bronzebastion', 'copper-shelled spiral snail', 'defender', '#63ab9f', .202,
    'Copper Rebound', 'exposed', 1.18, 2, 'Miners follow its green trail to copper. Its polished shell rings when struck with a pebble.'],
  [2, 'rookery', 'Glasswhip|Needlefin|Vitreolash|Siliclash', 'glass cave shrimp', 'striker', '#cfb1cd', .188,
    'Prism Lash', 'slow', 1.17, 2, 'Its transparent tail disappears against still water until the instant it snaps forward.'],
  [2, 'vault', 'Spindergem|Drusilk|Garnetweaver|Lapidary Queen', 'faceted crystal tarantula', 'ranged', '#b188c8', .046,
    'Garnet Web', 'slow', 1.18, 4, 'A web stretched between two quartz veins hums a different note for each approaching footstep.'],
  [3, 'habitat', 'Chimesail|Carillonsail|Coralcantor|Belfryfin', 'chime-crested seahorse', 'healer', '#79c5b9', .193,
    'Coral Chime', null, 1.3, 4, 'Hollow buds in its coral crest chime at high tide. A hurt school gathers around the quietest notes.'],
  [3, 'vault', 'Ringtusk|Gyralhorn|Gyrewake|Spiral Regent', 'ring-horned narwhal', 'striker', '#95bbd5', .044,
    'Spiral Surge', 'exposed', 1.33, 2, 'The silver rings in its tusk match an ocean current that circles the entire coast.'],
  [4, 'habitat', 'Cloudruff|Screeplume|Cairnsoar|Aerie Herald', 'alpine ruff vulture', 'ranged', '#cbba99', .183,
    'Scree Gust', 'exposed', 1.12, 4, 'It starts a miniature avalanche with its wingtips, then follows the insects shaken loose.'],
  [4, 'rookery', 'Soarpip|Sailsqueak|Cragglider|Ridgeparasol', 'gliding marmot', 'striker', '#b78d73', .178,
    'Cliff Swoop', 'slow', 1.23, 2, 'Its sky-blue gliding membranes fold away under two rows of coarse chestnut fur.'],
  [4, 'vault', 'Rimeox|Tundratread|Glacial Yoke|Permafrost Rex', 'ice-bearded musk ox', 'defender', '#91b6ca', .042,
    'Rime Rampart', 'slow', 1.34, 2, 'An avalanche split around a forgotten ice shelf. When spring came, the shelf stood up.'],
  [5, 'habitat', 'Kilnclaw|Coalcrimp|Slaglobber|Furnacegrip', 'basalt crayfish', 'defender', '#c97f58', .174,
    'Magma Pincer', 'exposed', 1.31, 1, 'It slips iron-rich pebbles into its claws, holding them there until they glow orange.'],
  [5, 'vault', 'Ashfloret|Cindertrain|Emberocell|Pyric Pavon', 'fire-fanned peacock', 'ranged', '#de965d', .04,
    'Cinder Fan', 'stun', 1.13, 3, 'When it fans its tail the dark eye on each feather becomes a small, burning sun.'],
  [6, 'habitat', 'Hengehog|Menhirling|Dolmenback|Cairn Citadel', 'menhir-spined hedgehog', 'defender', '#b5ab84', .168,
    'Lintel Roll', 'slow', 1.29, 1, 'Masons once mistook its sleeping family for the stones of a miniature temple.'],
  [6, 'rookery', 'Papyrkite|Inksail|Quillfolio|Vellumwing', 'papyrus-winged kite', 'ranged', '#cfb273', .164,
    'Ink Gust', 'exposed', 1.08, 4, 'When it molts, tiny maps in dried ink appear on the underside of its papery feathers.'],
  [6, 'vault', 'Tuskobel|Lapisstride|Obeliphant|Dynastodon', 'obelisk-tusked elephant', 'healer', '#a8afcb', .038,
    'Glyph Resonance', null, 1.65, 3, 'Each footfall sounds a buried stone. The herd follows their echoes through the courts lost under the sand.'],
  [7, 'habitat', 'Vespermidge|Wickcomet|Nightsignal|Vesper Beacon', 'comet-tailed firefly', 'healer', '#c1cb71', .158,
    'Orbit Flare', 'stun', 1.02, 3, 'Two dots of light orbit the end of its tail. Lost travelers count their flashes to find the path.'],
  [7, 'vault', 'Asterlock|Dialtalon|Sidereal Crest|Meridiarch', 'astrolabe gryphon', 'striker', '#c2b4dc', .036,
    'Meridian Dive', 'exposed', 1.37, 2, 'A brass ring turns freely around each wing. Both rings stop for one breath before it dives.']
];

export const FRONTIER_SPECIES = families.map(([region, habitatId, names, animal, role, color, captureRate,
    signature, effect, power, range, lore], index) => {
  const forms = names.split('|');
  const legendary = habitatId === 'vault';
  return {
    id: 56 + index, region, habitatId, name: forms[0], forms, animal, role, color, captureRate,
    signature, effect, technique: { kind: effect === null ? 'heal' : 'attack', power, range },
    lore, legendary, rarity: legendary ? 'Legendary' : 'Rare'
  };
});
