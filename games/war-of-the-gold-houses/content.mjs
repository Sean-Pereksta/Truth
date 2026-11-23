export const RESOURCE_LABELS = {
  credits: 'Credits',
  materials: 'Materials',
  supplies: 'Supplies',
  influence: 'Influence',
};

export const RESOURCE_KEYS = Object.keys(RESOURCE_LABELS);

export const CAMPAIGN_MODES = {
  grand: 'Grand Conquest',
  planetary: 'Planetary Conquest',
  skirmish: 'Skirmish',
};

export const DOCTRINES = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Press weak formations, close distance quickly, and keep up the pursuit.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Engage within favorable range and keep the support squads in formation.',
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    description: 'Use protected ground and preserve wounded formations.',
  },
};

function commander(name, leadership, tactical, aggression, discipline, loyalty) {
  return { name, leadership, tactical, aggression, discipline, loyalty, experience: 0 };
}

export const HOUSES = {
  augustus: {
    id: 'augustus',
    name: 'House Augustus',
    color: '#e5ad53',
    accent: '#ffdf89',
    emblem: 'eagle',
    commander: commander('Tiber au Augustus', 82, 72, 59, 76, 90),
    doctrine: 'balanced',
    description: 'Build up the Martian frontier, then finance a war on several worlds.',
    bonus: { production: { credits: 1.2, materials: 1.1 }, construction: 0.88 },
    personality: 'economic',
    preferredRecruit: 'rifle',
  },
  bellona: {
    id: 'bellona',
    name: 'House Bellona',
    color: '#d96568',
    accent: '#ffb394',
    emblem: 'blade',
    commander: commander('Valeria au Bellona', 88, 76, 76, 92, 84),
    doctrine: 'aggressive',
    description: 'Disciplined Gray regiments and confident officers drive early ground offensives.',
    bonus: { morale: 1.12, recruit: { rifle: 0.82, heavy: 0.88 } },
    personality: 'offensive',
    preferredRecruit: 'heavy',
  },
  grimmus: {
    id: 'grimmus',
    name: 'House Grimmus',
    color: '#b27bdb',
    accent: '#e7b7ff',
    emblem: 'fist',
    commander: commander('Drusus au Grimmus', 79, 78, 93, 70, 81),
    doctrine: 'aggressive',
    description: 'Take command of orbital lanes and bring heavy armor through defended landings.',
    bonus: { fleetPower: 1.18, landing: 1.2, recruit: { tank: 0.88 } },
    personality: 'siege',
    preferredRecruit: 'tank',
  },
  raa: {
    id: 'raa',
    name: 'House Raa',
    color: '#5bb8d1',
    accent: '#c1edfb',
    emblem: 'crescent',
    commander: commander('Nerissa au Raa', 84, 87, 48, 95, 92),
    doctrine: 'cautious',
    description: 'Hold ground efficiently while faster fleets reposition across the system.',
    bonus: { travelDuration: 0.84, fortress: 1.24 },
    personality: 'defensive',
    preferredRecruit: 'marksman',
  },
  'valii-rath': {
    id: 'valii-rath',
    name: 'House Valii-Rath',
    color: '#79b989',
    accent: '#bde486',
    emblem: 'eye',
    commander: commander('Caelia au Valii-Rath', 72, 91, 62, 76, 74),
    doctrine: 'balanced',
    description: 'Learn where rivals are vulnerable and force political concessions early.',
    bonus: { diplomacyCost: 0.78, intelCost: 0.72, production: { influence: 1.18 } },
    personality: 'political',
    preferredRecruit: 'electronic',
  },
};

function color(id, name, swatch, role, layer, mechanic) {
  return { id, name, color: swatch, role, layer, mechanic };
}

export const COLORS = {
  gold: color('gold', 'Gold', '#e5be64', 'Command', 'Battlefield', 'Gold commanders lead armies and rally nearby squads.'),
  gray: color('gray', 'Gray', '#a2aeba', 'Professional infantry', 'Battlefield', 'Gray riflemen, heavy gunners, and marksmen hold ranged fire lines.'),
  obsidian: color('obsidian', 'Obsidian', '#8992ad', 'Shock assaults', 'Battlefield', 'Obsidian raiders and heavies close the distance and break stalled lines.'),
  red: color('red', 'Red', '#e26461', 'Mining and excavation', 'Territory', 'Red excavation crews open short approaches to contested terrain.'),
  orange: color('orange', 'Orange', '#df8a4b', 'Engineering', 'Battlefield', 'Orange combat engineers repair armor and keep vehicles operational.'),
  blue: color('blue', 'Blue', '#6b9de2', 'Navigation and piloting', 'Solar system', 'Blue crews run spaceports and take transports into orbit.'),
  green: color('green', 'Green', '#7fca81', 'Electronic warfare', 'Territory', 'Green specialists disrupt regional defenses and suppress hostile electronics in battle.'),
  yellow: color('yellow', 'Yellow', '#e2d278', 'Medicine', 'Battlefield', 'Yellow medics treat damaged squads and help preserve experienced soldiers.'),
  silver: color('silver', 'Silver', '#c5d3e5', 'Trade and finance', 'Territory', 'Silver brokers can sell a materials reserve for credits.'),
  copper: color('copper', 'Copper', '#bd885f', 'Administration', 'Territory', 'Copper administrators establish depots and keep a regional force supplied.'),
  white: color('white', 'White', '#f0e8df', 'Arbitration', 'Solar system', 'White mediators negotiate truces and help settle rival claims.'),
  violet: color('violet', 'Violet', '#a880d5', 'Specialist equipment', 'Territory', 'Violet artisans refit veteran formations.'),
  brown: color('brown', 'Brown', '#a88467', 'Agriculture and supply', 'Territory', 'Brown supply crews lay caches at the front.'),
  pink: color('pink', 'Pink', '#e69db8', 'Court intelligence', 'Territory', 'Pink intelligence networks reveal rival positions and movements.'),
};

export const OPERATIONS = {
  red: {
    name: 'Excavate Approach',
    description: 'Prepare an underground approach from this region into an adjacent rival territory.',
    cost: { materials: 24, supplies: 12 },
    duration: 75,
    target: 'hostile',
  },
  green: {
    name: 'Disrupt Defenses',
    description: 'Disable an adjacent rival territory’s defenses for a limited time.',
    cost: { credits: 30, influence: 9 },
    duration: 65,
    target: 'hostile',
  },
  silver: {
    name: 'Broker Contract',
    description: 'Sell surplus materials to raise credits.',
    cost: { materials: 34 },
    target: 'friendly',
  },
  copper: {
    name: 'Establish Depot',
    description: 'Open a regional depot and extend local supply.',
    cost: { materials: 24, influence: 10 },
    duration: 115,
    target: 'friendly',
  },
  white: {
    name: 'Parley',
    description: 'Negotiate a temporary truce with a rival House.',
    cost: { influence: 24 },
    duration: 90,
    target: 'rival',
  },
  violet: {
    name: 'Refit Formation',
    description: 'Upgrade surviving troops in a friendly formation stationed here.',
    cost: { materials: 34, credits: 36 },
    target: 'friendly',
  },
  brown: {
    name: 'Lay Supply Cache',
    description: 'Stockpile supplies for a force at or passing through the region.',
    cost: { credits: 22 },
    target: 'friendly',
  },
  pink: {
    name: 'Scout Rival',
    description: 'Reveal force composition and planned routes around a selected rival territory.',
    cost: { credits: 22, influence: 12 },
    duration: 95,
    target: 'hostile',
  },
};

function building(id, name, cost, role, production = {}) {
  return { id, name, cost, role, production, maxLevel: 3 };
}

export const BUILDINGS = {
  mine: building('mine', 'Mine', { credits: 54, materials: 25 }, 'Extract materials.', { materials: 5 }),
  barracks: building('barracks', 'Barracks', { credits: 62, materials: 32 }, 'Recruit infantry and battlefield specialists.'),
  fortress: building('fortress', 'Fortress', { credits: 72, materials: 54 }, 'Reinforce the garrison and support friendly forces.'),
  workshop: building('workshop', 'Workshop', { credits: 74, materials: 46 }, 'Train engineers and build armored units.', { materials: 2 }),
  spaceport: building('spaceport', 'Spaceport', { credits: 102, materials: 75, influence: 12 }, 'Build ships and dispatch fleets.', { credits: 2 }),
};

function ship(id, name, cost, capacity, power, role, travelModifier = 1, assault = 0, level = 1) {
  return { id, name, cost, capacity, power, role, travelModifier, assault, level };
}

export const SHIPS = {
  transport: ship('transport', 'Transport', { credits: 75, materials: 46 }, 8, 4, 'Carries up to eight ground squads.'),
  corvette: ship('corvette', 'Corvette', { credits: 55, materials: 34 }, 0, 24, 'Fast escort and interception.', 0.85),
  destroyer: ship('destroyer', 'Destroyer', { credits: 93, materials: 68 }, 0, 42, 'Main fleet combat ship.'),
  battleship: ship('battleship', 'Battleship', { credits: 156, materials: 116 }, 0, 77, 'Heavy engagements and orbital support.', 1.2, 0, 2),
  carrier: ship('carrier', 'Carrier', { credits: 128, materials: 95 }, 2, 52, 'Fighter cover and limited squad transport.', 1.1, 1, 2),
  assault: ship('assault', 'Assault Ship', { credits: 115, materials: 86 }, 6, 31, 'Drops up to six squads onto defended worlds.', 1.04, 3),
};

function recruiting(name, buildingId, level, colorId, cost) {
  return { name, buildingId, level, colorId, cost };
}

export const RECRUITMENT = {
  rifle: recruiting('Gray Riflemen', 'barracks', 1, 'gray', { credits: 32, supplies: 12 }),
  heavy: recruiting('Gray Heavy Gunners', 'barracks', 1, 'gray', { credits: 45, materials: 12, supplies: 14 }),
  marksman: recruiting('Gray Marksmen', 'barracks', 1, 'gray', { credits: 43, materials: 10, supplies: 10 }),
  raider: recruiting('Obsidian Raiders', 'barracks', 1, 'obsidian', { credits: 42, supplies: 15 }),
  obsidian: recruiting('Obsidian Heavy Warriors', 'barracks', 2, 'obsidian', { credits: 61, materials: 15, supplies: 18 }),
  razor: recruiting('Gold Razor Knights', 'barracks', 2, 'gold', { credits: 76, materials: 18, influence: 10 }),
  commander: recruiting('Gold Commander', 'fortress', 2, 'gold', { credits: 90, influence: 25 }),
  engineer: recruiting('Orange Combat Engineers', 'workshop', 1, 'orange', { credits: 39, materials: 20 }),
  electronic: recruiting('Green Electronic Warfare Team', 'workshop', 1, 'green', { credits: 47, materials: 15, influence: 5 }),
  medic: recruiting('Yellow Medical Team', 'barracks', 1, 'yellow', { credits: 42, supplies: 12 }),
  transport: recruiting('Armored Transport', 'workshop', 1, 'orange', { credits: 61, materials: 32, supplies: 10 }),
  tank: recruiting('Heavy Assault Vehicle', 'workshop', 2, 'orange', { credits: 90, materials: 57, supplies: 18 }),
};

const planetDefinitions = {
  mercury: {
    name: 'Mercury', x: 0.14, y: 0.52, radius: 23, style: 'rocky',
    palette: ['#382a38', '#794e47', '#b48258', '#e6b983'],
    description: 'Smelter settlements share the narrow band between burning day and frozen night.',
  },
  venus: {
    name: 'Venus', x: 0.24, y: 0.28, radius: 27, style: 'earth-like',
    palette: ['#243e4b', '#466056', '#9c9157', '#ccc38a'],
    description: 'Floating ports and silver exchanges carry the trade of the inner worlds above the cloud deck.',
  },
  earth: {
    name: 'Earth', x: 0.30, y: 0.60, radius: 34, style: 'earth-like',
    palette: ['#152a53', '#276081', '#599b6c', '#bccdc0'],
    description: 'Old population centers command fertile belts, ocean freight routes, and the Core food supply.',
  },
  luna: {
    name: 'Luna', x: 0.39, y: 0.78, radius: 19, style: 'moon', parentId: 'earth',
    palette: ['#353348', '#646278', '#999ab0', '#c9cdd6'],
    description: 'Rival spaceports surround a network of crater cities and assembly halls.',
  },
  mars: {
    name: 'Mars', x: 0.43, y: 0.34, radius: 31, style: 'rocky',
    palette: ['#4a2939', '#87464a', '#b9604d', '#eb9669'],
    description: 'Control the canyon crossings, foundries, and rival fortress cities of the red world.',
  },
  jupiter: {
    name: 'Jupiter', x: 0.59, y: 0.48, radius: 47, style: 'gas',
    palette: ['#4f3a4c', '#976761', '#ce9b79', '#eac6a2'],
    description: 'Atmospheric platforms and orbital fortresses anchor Rim shipping around the banded giant.',
  },
  io: {
    name: 'Io', x: 0.58, y: 0.73, radius: 18, style: 'rocky', parentId: 'jupiter',
    palette: ['#473244', '#7e543c', '#b68a45', '#dec469'],
    description: 'Industrial enclaves compete for secure routes between volcanic fields.',
  },
  saturn: {
    name: 'Saturn', x: 0.72, y: 0.28, radius: 34, style: 'rings',
    palette: ['#4c414e', '#827463', '#b29e76', '#e1cd9b'],
    description: 'Ring stations broker fleet commerce between Jupiter and the distant ice giants.',
  },
  titan: {
    name: 'Titan', x: 0.73, y: 0.53, radius: 19, style: 'ice', parentId: 'saturn',
    palette: ['#302944', '#69514d', '#a8755b', '#dba47a'],
    description: 'Settlements along the methane shores process fuel and stores for Saturnian fleets.',
  },
  uranus: {
    name: 'Uranus', x: 0.84, y: 0.72, radius: 30, style: 'ice',
    palette: ['#183044', '#3e757d', '#79b9b9', '#c8ded3'],
    description: 'Pale rings shelter dispersed survey stations and volatile refineries around the tilted ice giant.',
  },
  neptune: {
    name: 'Neptune', x: 0.90, y: 0.37, radius: 32, style: 'gas',
    palette: ['#111e48', '#263d82', '#5378c5', '#8da9e8'],
    description: 'Storm-tracking stations and long-range relays guard the last fleet lanes in the system.',
  },
};

function region(id, name, x, y, terrain, houseId, buildings, colors, description) {
  const [planetId] = id.split('-');
  return { id, planetId, name, x, y, terrain, houseId, buildings, colors, description, neighbors: [] };
}

const territories = [
  region('mars-arsia-port', 'Arsia Port', 0.13, 0.30, 'spaceport', 'augustus',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'silver', 'copper'],
    'An industrial spaceport with established Inner routes.'),
  region('mars-olympus', 'Olympus Crown', 0.24, 0.15, 'fortress', 'augustus',
    { fortress: 2, mine: 1 }, ['gold', 'red', 'copper', 'yellow'],
    'A bastion dominates the upper slope above the freight elevators.'),
  region('mars-elysium', 'Elysium', 0.41, 0.26, 'urban', 'bellona',
    { barracks: 2, fortress: 1 }, ['gold', 'gray', 'obsidian', 'yellow'],
    'The Elysian academy has turned its avenues into defensive lanes.'),
  region('mars-utopia', 'Utopia Borealis', 0.67, 0.14, 'desert', 'bellona',
    { mine: 1, spaceport: 1 }, ['blue', 'red', 'gray', 'silver'],
    'An exposed launch strip sits beside deep extraction shafts.'),
  region('mars-tharsis', 'Tharsis Foundries', 0.19, 0.49, 'industrial', 'augustus',
    { mine: 2, workshop: 1 }, ['red', 'orange', 'green', 'violet'],
    'Glassworks and ore processors supply the western war effort.'),
  region('mars-valles', 'Valles Crossing', 0.37, 0.48, 'mountain', null,
    { fortress: 1 }, ['gray', 'red', 'copper', 'brown'],
    'Two bridges carry heavy traffic over a steep canyon.'),
  region('mars-isidis', 'Isidis Asamblea', 0.58, 0.36, 'urban', 'valii-rath',
    { barracks: 1, workshop: 1 }, ['pink', 'white', 'green', 'silver', 'gray'],
    'Court offices and communications relays line the inner roads.'),
  region('mars-hellas', 'Hellas Gate', 0.77, 0.43, 'fortress', 'grimmus',
    { fortress: 2, workshop: 2 }, ['gold', 'obsidian', 'orange', 'violet'],
    'Armored formations gather inside the basin’s fortified approaches.'),
  region('mars-sirenum', 'Sirenum Belt', 0.19, 0.69, 'mine', 'raa',
    { mine: 2, fortress: 1 }, ['red', 'copper', 'green', 'obsidian'],
    'Cargo tunnels cut under a string of basalt gullies.'),
  region('mars-argyre', 'Argyre Basin', 0.39, 0.78, 'ice', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'brown', 'yellow'],
    'A cold landing basin makes a reliable Rim staging point.'),
  region('mars-noachis', 'Noachis Reach', 0.57, 0.65, 'desert', 'valii-rath',
    { spaceport: 1, mine: 1 }, ['blue', 'pink', 'brown', 'white'],
    'Water storage, a launch field, and relay towers serve the southern estates.'),
  region('mars-aeolis', 'Aeolis Redoubt', 0.83, 0.73, 'spaceport', 'grimmus',
    { spaceport: 1, barracks: 1, fortress: 1 }, ['blue', 'obsidian', 'gray', 'orange'],
    'A defended military shipyard overlooks the eastern road.'),
  region('luna-dawn-port', 'Dawn Port', 0.20, 0.28, 'spaceport', 'augustus',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'silver', 'copper'],
    'Long transports depart from the sunward rim of the crater.'),
  region('luna-tranquility', 'Tranquility', 0.31, 0.15, 'urban', 'augustus',
    { mine: 1, workshop: 1 }, ['yellow', 'brown', 'red', 'orange'],
    'Regolith works support residential domes along the old basin.'),
  region('luna-cassini-port', 'Cassini Port', 0.53, 0.20, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1 }, ['blue', 'gold', 'gray', 'yellow'],
    'A busy port defended by academy-trained infantry.'),
  region('luna-aristarchus', 'Aristarchus Ridge', 0.71, 0.23, 'mountain', 'bellona',
    { fortress: 1, mine: 1 }, ['red', 'gray', 'gold', 'obsidian'],
    'A developed crater lip offers two narrow approaches.'),
  region('luna-black-glass', 'Black Glass Port', 0.80, 0.42, 'industrial', 'grimmus',
    { spaceport: 1, barracks: 1, workshop: 1 }, ['blue', 'obsidian', 'orange', 'green'],
    'A moon-dark shipyard strips and rebuilds armored hulls.'),
  region('luna-procellarum', 'Procellarum', 0.69, 0.56, 'fortress', 'grimmus',
    { fortress: 2, workshop: 1 }, ['gold', 'gray', 'orange', 'violet'],
    'A fortified equipment depot protects the southern freight junction.'),
  region('luna-coldwater', 'Coldwater Port', 0.55, 0.77, 'ice', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'green', 'brown'],
    'A shadowward port sustains long passages into the Rim.'),
  region('luna-shackleton', 'Shackleton Vaults', 0.35, 0.68, 'mine', 'raa',
    { mine: 2, fortress: 1 }, ['red', 'orange', 'copper', 'obsidian'],
    'The ice vaults supply nearby ports and defended shelters.'),
  region('luna-silk-docks', 'Silk Docks', 0.19, 0.58, 'spaceport', 'valii-rath',
    { spaceport: 1, barracks: 1 }, ['blue', 'pink', 'silver', 'white'],
    'Private docks and quiet courtyards sit above the western road.'),
  region('luna-concord', 'Concord Assembly', 0.43, 0.43, 'urban', 'valii-rath',
    { barracks: 1, workshop: 1, fortress: 1 }, ['white', 'pink', 'green', 'violet'],
    'Judicial halls, archives, and an exchange occupy the central dome.'),
  region('mercury-terminator', 'Terminator Port', 0.24, 0.29, 'spaceport', 'grimmus',
    { spaceport: 1, workshop: 1 }, ['blue', 'orange', 'gray', 'green'],
    'A heavily worked shipyard at the edge of permanent daylight.'),
  region('mercury-solar-anvil', 'Solar Anvil', 0.68, 0.24, 'industrial', 'grimmus',
    { mine: 2, workshop: 2, fortress: 1 }, ['red', 'orange', 'violet', 'obsidian'],
    'High-temperature foundries fuel the great yards.'),
  region('mercury-coldwall', 'Coldwall', 0.26, 0.65, 'ice', 'augustus',
    { spaceport: 1, fortress: 1 }, ['blue', 'brown', 'copper', 'yellow'],
    'Insulated passages lead to a defensible night-side dock.'),
  region('mercury-apollo', 'Apollo Wells', 0.68, 0.65, 'desert', null,
    { mine: 1 }, ['red', 'brown', 'silver', 'pink'],
    'An oasis of buried stores astride the nightside approach.'),
  region('io-ember-port', 'Ember Port', 0.23, 0.26, 'spaceport', 'raa',
    { spaceport: 1, fortress: 1 }, ['blue', 'gray', 'orange', 'copper'],
    'A rimward relay port at the head of a narrow lava plain.'),
  region('io-patera', 'Patera Works', 0.66, 0.26, 'industrial', 'bellona',
    { workshop: 1, barracks: 1 }, ['gray', 'orange', 'green', 'violet'],
    'Furnaces and gantries shelter a mobile defense force.'),
  region('io-peles', 'Pele’s Stair', 0.33, 0.65, 'mountain', 'raa',
    { fortress: 2, mine: 1 }, ['red', 'obsidian', 'yellow', 'gold'],
    'Tiered ridges control ground movement along the caldera.'),
  region('io-amber-port', 'Amber Port', 0.72, 0.62, 'spaceport', 'valii-rath',
    { spaceport: 1, barracks: 1 }, ['blue', 'white', 'silver', 'pink'],
    'An independent docking corridor serves the lower sulphur road.'),
  region('venus-aurelia', 'Aurelia Exchange', 0.23, 0.29, 'urban', 'valii-rath',
    { spaceport: 1, barracks: 1 }, ['silver', 'white', 'pink', 'blue'],
    'A floating silver exchange controls staple freight contracts.'),
  region('venus-ishtar', 'Ishtar Anchorage', 0.49, 0.21, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1, fortress: 1 }, ['blue', 'gray', 'yellow', 'copper'],
    'Docking bridges carry customs troops between stratostats.'),
  region('venus-maat', 'Maat Works', 0.76, 0.35, 'industrial', 'grimmus',
    { spaceport: 1, workshop: 1, mine: 1 }, ['red', 'orange', 'green', 'blue'],
    'Suspended acid scrubbers recover industrial compounds from cloud condensate.'),
  region('venus-aphrodite', 'Aphrodite Quay', 0.24, 0.65, 'urban', 'valii-rath',
    { spaceport: 1, workshop: 1 }, ['blue', 'silver', 'brown', 'violet'],
    'Garden barges and covered markets supply the western platform belt.'),
  region('venus-cloudharbor', 'Cloudharbor', 0.52, 0.58, 'spaceport', 'augustus',
    { spaceport: 1, barracks: 1 }, ['blue', 'silver', 'gray', 'orange'],
    'Freighters queue around a launch deck tethered to three neighboring cities.'),
  region('venus-brightwalk', 'Brightwalk', 0.77, 0.69, 'fortress', null,
    { fortress: 1 }, ['copper', 'green', 'white', 'obsidian'],
    'A decommissioned storm defense platform overlooks the eastern trade cables.'),
  region('earth-pacific', 'Pacific Gardens', 0.21, 0.34, 'spaceport', 'augustus',
    { spaceport: 1, barracks: 1 }, ['brown', 'yellow', 'blue', 'silver'],
    'Floating granaries load produce into Core freighters.'),
  region('earth-orion', 'Orion Uplift', 0.46, 0.24, 'industrial', 'bellona',
    { spaceport: 1, workshop: 1 }, ['blue', 'orange', 'green', 'gray'],
    'A cargo elevator links the northern cities to orbital trade.'),
  region('earth-atlantic', 'Atlantic Citadel', 0.68, 0.34, 'fortress', 'bellona',
    { spaceport: 1, barracks: 1, fortress: 1 }, ['blue', 'gold', 'gray', 'copper'],
    'The walled center administers the major ocean freight corridor.'),
  region('earth-andean', 'Andean Causeway', 0.27, 0.67, 'mountain', 'augustus',
    { mine: 1, fortress: 1 }, ['red', 'copper', 'brown', 'yellow'],
    'Supply trains follow a raised pass above deep reservoirs.'),
  region('earth-equator', 'Equatorial Belt', 0.54, 0.62, 'desert', null,
    { spaceport: 1 }, ['blue', 'brown', 'yellow', 'white'],
    'Independent farms surround a customs-free launch field.'),
  region('earth-bosporus', 'Bosporus Court', 0.79, 0.62, 'urban', 'valii-rath',
    { barracks: 1, fortress: 1 }, ['pink', 'white', 'silver', 'brown'],
    'Legislatures and crop exchanges overlook the eastern strait.'),
  region('jupiter-zephyr', 'Zephyr Gate', 0.19, 0.37, 'spaceport', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'obsidian', 'brown', 'copper'],
    'The primary atmospheric gate links Io to the cloud platform network.'),
  region('jupiter-saffron', 'Saffron Float', 0.36, 0.17, 'industrial', 'raa',
    { mine: 1, workshop: 1 }, ['red', 'orange', 'brown', 'green'],
    'Helium collectors drift along the edge of the pale northern band.'),
  region('jupiter-stormwatch', 'Stormwatch', 0.60, 0.22, 'fortress', 'grimmus',
    { fortress: 1, barracks: 1 }, ['gold', 'obsidian', 'gray', 'copper'],
    'An orbital fortress watches the weather bands and main shipping gates.'),
  region('jupiter-red-eye', 'Red Eye Foundry', 0.79, 0.44, 'industrial', 'grimmus',
    { spaceport: 1, workshop: 1, mine: 1 }, ['blue', 'red', 'orange', 'obsidian'],
    'The foundry exports armor plate from above the long-lived storm.'),
  region('jupiter-shearline', 'Shearline Deck', 0.56, 0.70, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'yellow', 'obsidian'],
    'A transfer deck trains crews to fight along exposed landing gantries.'),
  region('jupiter-cyclone', 'Cyclone Relay', 0.26, 0.67, 'fortress', null,
    { fortress: 1 }, ['green', 'white', 'copper', 'violet'],
    'An independent platform routes cargo around bands of violent storms.'),
  region('saturn-ringstead', 'Ringstead Port', 0.22, 0.27, 'spaceport', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'silver', 'obsidian', 'copper'],
    'A deep ring dock resupplies ships before their voyage into the outer dark.'),
  region('saturn-shepherd', 'Shepherd Array', 0.52, 0.19, 'industrial', 'raa',
    { workshop: 1, mine: 1 }, ['red', 'orange', 'green', 'violet'],
    'A shepherd station clears approach lanes through the dusty outer rings.'),
  region('saturn-gilt', 'Gilt Exchange', 0.78, 0.32, 'urban', 'valii-rath',
    { spaceport: 1, barracks: 1 }, ['blue', 'silver', 'white', 'pink'],
    'A rotating commerce station settles contracts from across the Rim.'),
  region('saturn-glassward', 'Glassward', 0.29, 0.63, 'industrial', 'augustus',
    { spaceport: 1, workshop: 1, mine: 1 }, ['blue', 'red', 'orange', 'silver'],
    'Ice refineries sweep the thin rings and offer an alternate fleet lane.'),
  region('saturn-hexagon', 'Hexagon Watch', 0.54, 0.50, 'fortress', null,
    { fortress: 1 }, ['gold', 'green', 'white', 'copper'],
    'A fortified relay holds station high over a sharp-sided polar storm.'),
  region('saturn-umbra', 'Umbra Court', 0.75, 0.69, 'fortress', 'valii-rath',
    { fortress: 1, workshop: 1 }, ['obsidian', 'violet', 'yellow', 'pink'],
    'A court station watches the shadowed ascent from Titan.'),
  region('titan-kraken', 'Kraken Shore', 0.22, 0.28, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1 }, ['blue', 'brown', 'gray', 'obsidian'],
    'Methane tankers berth under the armored piers.'),
  region('titan-huygens', 'Huygens Works', 0.50, 0.24, 'industrial', 'bellona',
    { workshop: 1, mine: 1 }, ['brown', 'red', 'orange', 'gray'],
    'Processing halls turn marine cargo into stable interplanetary fuel.'),
  region('titan-frostbank', 'Frostbank', 0.77, 0.31, 'ice', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'brown', 'green', 'yellow'],
    'Supply domes occupy an ice shelf at a junction of two fueling roads.'),
  region('titan-selk', 'Selk Anchorage', 0.27, 0.67, 'fortress', 'grimmus',
    { spaceport: 1, fortress: 1 }, ['blue', 'obsidian', 'orange', 'gray'],
    'A military tank farm controls the road to the western shore.'),
  region('titan-shangri', 'Shangri Relay', 0.55, 0.61, 'desert', null,
    { fortress: 1 }, ['brown', 'green', 'yellow', 'white'],
    'A signal station surveys dark dunes for the next convoy passage.'),
  region('titan-cassandria', 'Cassandria', 0.77, 0.68, 'urban', 'valii-rath',
    { barracks: 1, spaceport: 1 }, ['blue', 'silver', 'pink', 'white'],
    'An amber-lit customs hub brokers the eastern methane trade.'),
  region('uranus-oblique', 'Oblique Port', 0.21, 0.30, 'spaceport', 'augustus',
    { spaceport: 1, barracks: 1 }, ['blue', 'orange', 'brown', 'copper'],
    'Orbit adjustments through the tilted ring plane begin here.'),
  region('uranus-cryocrown', 'Cryocrown', 0.45, 0.19, 'industrial', 'raa',
    { spaceport: 1, mine: 1 }, ['blue', 'red', 'obsidian', 'orange'],
    'Workers separate valuable volatiles in a ring-mounted refinery.'),
  region('uranus-tiltward', 'Tiltward Lock', 0.75, 0.29, 'fortress', 'grimmus',
    { spaceport: 1, fortress: 1, workshop: 1 }, ['blue', 'gold', 'obsidian', 'green'],
    'An armored platform guards the passage through the inner rings.'),
  region('uranus-longnight', 'Longnight Array', 0.26, 0.67, 'industrial', 'valii-rath',
    { spaceport: 1, workshop: 1 }, ['blue', 'green', 'violet', 'pink'],
    'Teams chart navigable gaps between slow-moving slabs of ring debris.'),
  region('uranus-rimice', 'Rimice Stores', 0.53, 0.57, 'ice', null,
    { mine: 1, fortress: 1 }, ['red', 'brown', 'yellow', 'copper'],
    'Shielded station decks carry emergency stores for distant survey missions.'),
  region('uranus-miranda', 'Miranda Lift', 0.77, 0.69, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'obsidian', 'yellow'],
    'Dedicated ferries service this garrison and transfer platform in outer orbit.'),
  region('neptune-farwatch', 'Farwatch Port', 0.20, 0.27, 'spaceport', 'grimmus',
    { spaceport: 1, barracks: 1 }, ['blue', 'obsidian', 'gray', 'copper'],
    'An exposed orbital port is the first stop for reinforcements beyond Uranus.'),
  region('neptune-darkspot', 'Darkspot Guard', 0.47, 0.17, 'fortress', 'grimmus',
    { fortress: 1, workshop: 1 }, ['gold', 'obsidian', 'green', 'orange'],
    'A guard platform tracks rapid atmospheric changes from above the cloud tops.'),
  region('neptune-azurelift', 'Azure Lift', 0.75, 0.32, 'spaceport', 'bellona',
    { spaceport: 1, barracks: 1 }, ['blue', 'gray', 'yellow', 'orange'],
    'The blue approach lights mark a heavily drilled military landing deck.'),
  region('neptune-outer-arc', 'Outer Arc', 0.24, 0.63, 'industrial', 'augustus',
    { spaceport: 1, mine: 1 }, ['blue', 'red', 'brown', 'copper'],
    'A freight ring serves remote ice and gas collection platforms.'),
  region('neptune-blueveil', 'Blueveil Station', 0.54, 0.55, 'urban', 'valii-rath',
    { spaceport: 1, workshop: 1 }, ['blue', 'white', 'pink', 'green'],
    'Long-baseline receivers feed a tightly guarded espionage network.'),
  region('neptune-triton-gate', 'Triton Gate', 0.78, 0.69, 'industrial', 'raa',
    { spaceport: 1, barracks: 1 }, ['blue', 'orange', 'brown', 'obsidian'],
    'This station relays freight to the moonward passage and distant picket fleets.'),
];

export const REGIONS = Object.fromEntries(territories.map(item => [item.id, item]));

const roads = {
  mars: [
    ['arsia-port', 'olympus'], ['arsia-port', 'elysium'], ['arsia-port', 'tharsis'],
    ['olympus', 'elysium'], ['elysium', 'utopia'], ['elysium', 'isidis'], ['elysium', 'valles'],
    ['utopia', 'isidis'], ['utopia', 'hellas'], ['tharsis', 'valles'], ['tharsis', 'sirenum'],
    ['valles', 'isidis'], ['valles', 'argyre'], ['valles', 'noachis'], ['isidis', 'hellas'],
    ['isidis', 'noachis'], ['hellas', 'aeolis'], ['sirenum', 'argyre'], ['argyre', 'noachis'],
    ['noachis', 'aeolis'],
  ],
  luna: [
    ['dawn-port', 'tranquility'], ['dawn-port', 'silk-docks'], ['dawn-port', 'concord'],
    ['tranquility', 'cassini-port'], ['tranquility', 'concord'], ['cassini-port', 'concord'],
    ['cassini-port', 'aristarchus'], ['aristarchus', 'black-glass'], ['black-glass', 'procellarum'],
    ['black-glass', 'concord'], ['procellarum', 'concord'], ['procellarum', 'coldwater'],
    ['coldwater', 'shackleton'], ['shackleton', 'concord'], ['shackleton', 'silk-docks'],
    ['silk-docks', 'concord'],
  ],
  mercury: [
    ['terminator', 'solar-anvil'], ['terminator', 'coldwall'], ['coldwall', 'apollo'],
    ['solar-anvil', 'apollo'], ['coldwall', 'solar-anvil'],
  ],
  io: [
    ['ember-port', 'patera'], ['ember-port', 'peles'], ['patera', 'amber-port'], ['peles', 'amber-port'],
  ],
  venus: [
    ['aurelia', 'ishtar'], ['aurelia', 'aphrodite'], ['aphrodite', 'cloudharbor'],
    ['ishtar', 'cloudharbor'], ['ishtar', 'maat'], ['maat', 'cloudharbor'],
    ['maat', 'brightwalk'], ['cloudharbor', 'brightwalk'],
  ],
  earth: [
    ['pacific', 'orion'], ['orion', 'atlantic'], ['atlantic', 'bosporus'],
    ['bosporus', 'equator'], ['equator', 'andean'], ['andean', 'pacific'],
    ['atlantic', 'equator'], ['orion', 'equator'],
  ],
  jupiter: [
    ['zephyr', 'saffron'], ['saffron', 'stormwatch'], ['stormwatch', 'red-eye'],
    ['red-eye', 'shearline'], ['shearline', 'cyclone'], ['cyclone', 'zephyr'],
    ['zephyr', 'red-eye'], ['saffron', 'cyclone'],
  ],
  saturn: [
    ['ringstead', 'shepherd'], ['ringstead', 'glassward'], ['shepherd', 'gilt'],
    ['shepherd', 'hexagon'], ['glassward', 'hexagon'], ['hexagon', 'gilt'],
    ['hexagon', 'umbra'], ['gilt', 'umbra'],
  ],
  titan: [
    ['kraken', 'huygens'], ['huygens', 'frostbank'], ['kraken', 'selk'],
    ['selk', 'shangri'], ['shangri', 'cassandria'], ['cassandria', 'frostbank'],
    ['huygens', 'shangri'],
  ],
  uranus: [
    ['oblique', 'cryocrown'], ['oblique', 'longnight'], ['cryocrown', 'tiltward'],
    ['cryocrown', 'rimice'], ['tiltward', 'miranda'], ['miranda', 'rimice'],
    ['rimice', 'longnight'], ['tiltward', 'rimice'],
  ],
  neptune: [
    ['farwatch', 'darkspot'], ['farwatch', 'outer-arc'], ['darkspot', 'azurelift'],
    ['outer-arc', 'blueveil'], ['blueveil', 'darkspot'], ['blueveil', 'azurelift'],
    ['blueveil', 'triton-gate'], ['azurelift', 'triton-gate'],
  ],
};

for (const [planetId, entries] of Object.entries(roads)) {
  for (const [from, to] of entries) {
    const fromId = `${planetId}-${from}`;
    const toId = `${planetId}-${to}`;
    REGIONS[fromId].neighbors.push(toId);
    REGIONS[toId].neighbors.push(fromId);
  }
}

export const PLANETS = Object.fromEntries(Object.entries(planetDefinitions).map(([id, definition]) => [
  id,
  { id, ...definition, regionIds: territories.filter(item => item.planetId === id).map(item => item.id) },
]));

export const FLEET_ROUTES = [
  ['mercury', 'venus'],
  ['venus', 'earth'],
  ['earth', 'luna'],
  ['earth', 'mars'],
  ['mercury', 'luna'],
  ['mercury', 'mars'],
  ['luna', 'mars'],
  ['luna', 'io'],
  ['mars', 'io'],
  ['mars', 'jupiter'],
  ['jupiter', 'io'],
  ['jupiter', 'saturn'],
  ['saturn', 'titan'],
  ['saturn', 'uranus'],
  ['titan', 'uranus'],
  ['saturn', 'neptune'],
  ['uranus', 'neptune'],
];

function economy(name, description, musterRegionId, multipliers, resources, squads = {}) {
  return {
    name, description, musterRegionId,
    multipliers: { credits: 1, materials: 1, supplies: 1, influence: 1, ...multipliers },
    reward: { resources, squads },
  };
}

export const WORLD_ECONOMIES = {
  mercury: economy('Solar Smelters', 'Heat-driven foundries turn extracted ore into ship and fortification materials.',
    'mercury-terminator', { materials: 1.32, supplies: 0.88 }, { materials: 30 }, { engineer: 1 }),
  venus: economy('Cloud Exchange', 'Private freight contracts and floating markets raise credits and political influence.',
    'venus-aurelia', { credits: 1.28, materials: 0.90, influence: 1.12 }, { credits: 38, influence: 8 }),
  earth: economy('Breadbasket', 'Mature farms and medical hubs supply Core armies.',
    'earth-pacific', { credits: 1.10, supplies: 1.33 }, { supplies: 36, influence: 12 }, { medic: 1 }),
  luna: economy('Orbital Administration', 'Port fees and court levies make the moon a steady source of influence.',
    'luna-dawn-port', { credits: 1.12, influence: 1.25 }, { credits: 18, influence: 18 }, { engineer: 1 }),
  mars: economy('Frontier Industry', 'Mining settlements draw raw materials while the fortress cities maintain infantry reserves.',
    'mars-arsia-port', { materials: 1.21, supplies: 1.06 }, { materials: 25, supplies: 10 }, { rifle: 1 }),
  jupiter: economy('Storm Harvest', 'Helium collectors feed industrial platforms and support Obsidian formations.',
    'jupiter-zephyr', { materials: 1.18, supplies: 1.15 }, { materials: 21, supplies: 20 }, { obsidian: 1 }),
  io: economy('Sulphur Forges', 'Volcanic mines yield industrial materials and sustain fast-moving Obsidian forces.',
    'io-ember-port', { materials: 1.29, influence: 0.90 }, { materials: 27, supplies: 9 }, { raider: 1 }),
  saturn: economy('Ring Commerce', 'Ship chandleries and rotating exchanges draw income from Rim trade traffic.',
    'saturn-ringstead', { credits: 1.23, supplies: 1.08, influence: 1.12 }, { credits: 29, influence: 15 }, { heavy: 1 }),
  titan: economy('Methane Reserves', 'Lake refineries supply fuel and durable stores to expeditionary armies.',
    'titan-kraken', { materials: 1.07, supplies: 1.29 }, { materials: 12, supplies: 38 }, { raider: 1 }),
  uranus: economy('Cryogenic Extraction', 'Ring refineries supply rare materials and preserve reserves on remote stations.',
    'uranus-oblique', { materials: 1.24, supplies: 1.15, influence: 0.92 }, { materials: 24, supplies: 21 }, { obsidian: 1 }),
  neptune: economy('Long-Range Patrols', 'Frontier listening stations track fleet activity while patrol garrisons train Obsidian troops.',
    'neptune-farwatch', { credits: 0.91, supplies: 1.21, influence: 1.20 }, { supplies: 23, influence: 20 }, { obsidian: 1 }),
};

function planetGroup(id, name, description, worldIds, resources, squads) {
  return { id, name, description, worldIds, reward: { resources, squads } };
}

export const PLANET_GROUPS = {
  core: planetGroup('core', 'Core', 'Unify Mercury through Mars, including Luna, for a major revenue and logistics levy.',
    ['mercury', 'venus', 'earth', 'luna', 'mars'],
    { credits: 105, materials: 55, supplies: 64, influence: 44 }, { rifle: 2, medic: 1, engineer: 1 }),
  rim: planetGroup('rim', 'Outer Rim', 'Unify Jupiter through Neptune, including Io and Titan, to muster the Outer Rim Obsidian levy.',
    ['jupiter', 'io', 'saturn', 'titan', 'uranus', 'neptune'],
    { materials: 100, supplies: 94, influence: 35 }, { obsidian: 3, raider: 2 }),
  'earth-luna': planetGroup('earth-luna', 'Earth–Luna', 'Coordinate Earth’s farms with Luna’s courts and shipyards.',
    ['earth', 'luna'], { credits: 32, supplies: 48, influence: 24 }, { rifle: 1, medic: 1 }),
  jovian: planetGroup('jovian', 'Jovian System', 'Combine the output of Jupiter’s storm platforms and Io’s forges.',
    ['jupiter', 'io'], { materials: 52, supplies: 31 }, { obsidian: 1, raider: 1 }),
  saturnian: planetGroup('saturnian', 'Saturnian System', 'Fuel the major ring exchanges with Titan’s methane reserves.',
    ['saturn', 'titan'], { credits: 45, supplies: 54, influence: 14 }, { heavy: 1, raider: 1 }),
  'ice-giants': planetGroup('ice-giants', 'Ice Giants', 'Connect Uranus’s refineries to Neptune’s far patrol lanes.',
    ['uranus', 'neptune'], { materials: 48, supplies: 37, influence: 24 }, { obsidian: 2 }),
};

export const STARTING_RESOURCES = { credits: 275, materials: 205, supplies: 165, influence: 68 };

function army(id, name, houseId, regionId, squads, officer = HOUSES[houseId].commander) {
  return { id, name, houseId, regionId, squads, commander: officer, doctrine: HOUSES[houseId].doctrine };
}

export const STARTING_ARMIES = [
  army('augustus-mars', 'Arsia Standard', 'augustus', 'mars-arsia-port',
    ['commander', 'rifle', 'rifle', 'heavy', 'raider', 'medic']),
  army('bellona-mars', 'Elysium Guard', 'bellona', 'mars-elysium',
    ['commander', 'rifle', 'rifle', 'heavy', 'marksman', 'medic']),
  army('grimmus-mars', 'Hellas Spear', 'grimmus', 'mars-hellas',
    ['commander', 'rifle', 'obsidian', 'tank', 'engineer', 'raider']),
  army('raa-mars', 'Argyre Watch', 'raa', 'mars-argyre',
    ['commander', 'rifle', 'marksman', 'heavy', 'medic', 'obsidian']),
  army('valii-rath-mars', 'Isidis Veil', 'valii-rath', 'mars-isidis',
    ['commander', 'rifle', 'raider', 'electronic', 'marksman', 'medic']),
  army('augustus-luna', 'Dawn Expedition', 'augustus', 'luna-dawn-port',
    ['commander', 'rifle', 'engineer', 'transport'], commander('Cassia au Augustus', 74, 78, 62, 80, 94)),
  army('bellona-luna', 'Cassini Expedition', 'bellona', 'luna-cassini-port',
    ['commander', 'rifle', 'heavy', 'medic'], commander('Lucan au Bellona', 81, 76, 80, 88, 88)),
  army('grimmus-luna', 'Black Glass Expedition', 'grimmus', 'luna-black-glass',
    ['commander', 'obsidian', 'transport', 'engineer'], commander('Cyra au Grimmus', 76, 80, 91, 73, 84)),
  army('raa-luna', 'Coldwater Expedition', 'raa', 'luna-coldwater',
    ['commander', 'rifle', 'marksman', 'medic'], commander('Alaric au Raa', 78, 88, 46, 90, 93)),
  army('valii-rath-luna', 'Silk Expedition', 'valii-rath', 'luna-silk-docks',
    ['commander', 'rifle', 'electronic', 'raider'], commander('Tavia au Valii-Rath', 73, 91, 58, 74, 79)),
  army('valii-rath-venus', 'Aurelia Watch', 'valii-rath', 'venus-aurelia',
    ['commander', 'marksman', 'raider', 'electronic']),
  army('augustus-earth', 'Pacific Line', 'augustus', 'earth-pacific',
    ['commander', 'rifle', 'heavy', 'medic']),
  army('bellona-earth', 'Atlantic Guard', 'bellona', 'earth-atlantic',
    ['commander', 'rifle', 'marksman', 'heavy']),
  army('raa-jupiter', 'Zephyr Legion', 'raa', 'jupiter-zephyr',
    ['commander', 'rifle', 'obsidian', 'medic']),
  army('grimmus-jupiter', 'Red Eye Cohort', 'grimmus', 'jupiter-red-eye',
    ['commander', 'rifle', 'raider', 'engineer']),
  army('raa-saturn', 'Ringstead Guard', 'raa', 'saturn-ringstead',
    ['commander', 'marksman', 'rifle', 'obsidian']),
  army('valii-rath-saturn', 'Gilt Wardens', 'valii-rath', 'saturn-gilt',
    ['commander', 'rifle', 'heavy', 'electronic']),
  army('bellona-titan', 'Kraken Shield', 'bellona', 'titan-kraken',
    ['commander', 'rifle', 'raider', 'medic']),
  army('augustus-uranus', 'Oblique Survey', 'augustus', 'uranus-oblique',
    ['commander', 'rifle', 'engineer', 'obsidian']),
  army('grimmus-neptune', 'Farwatch Cohort', 'grimmus', 'neptune-farwatch',
    ['commander', 'heavy', 'raider', 'obsidian']),
];

export const HOUSE_HOMEWORLDS = {
  augustus: { planetId: 'mars', regionId: 'mars-arsia-port' },
  bellona: { planetId: 'earth', regionId: 'earth-atlantic' },
  grimmus: { planetId: 'jupiter', regionId: 'jupiter-red-eye' },
  raa: { planetId: 'saturn', regionId: 'saturn-ringstead' },
  'valii-rath': { planetId: 'venus', regionId: 'venus-aurelia' },
};

const grandClaims = {
  augustus: [
    'mars-arsia-port', 'mars-olympus', 'mars-tharsis', 'mars-valles', 'mars-sirenum', 'mars-argyre',
    'luna-dawn-port', 'earth-andean',
  ],
  bellona: [
    'earth-atlantic', 'earth-orion', 'earth-equator', 'earth-bosporus',
    'luna-cassini-port', 'mars-elysium', 'jupiter-shearline', 'venus-maat',
  ],
  grimmus: [
    'jupiter-red-eye', 'jupiter-stormwatch', 'jupiter-zephyr', 'jupiter-saffron',
    'luna-black-glass', 'mars-hellas', 'io-ember-port', 'neptune-darkspot',
  ],
  raa: [
    'saturn-ringstead', 'saturn-shepherd', 'saturn-glassward', 'saturn-hexagon',
    'luna-coldwater', 'io-peles', 'titan-kraken', 'uranus-cryocrown',
  ],
  'valii-rath': [
    'venus-aurelia', 'venus-ishtar', 'venus-aphrodite', 'venus-cloudharbor',
    'luna-silk-docks', 'mars-isidis', 'saturn-gilt', 'luna-concord',
  ],
};

export const GRAND_STARTING_HOLDINGS = {
  ...Object.fromEntries(territories.map(({ id }) => [id, null])),
  ...Object.fromEntries(Object.entries(grandClaims)
    .flatMap(([houseId, regions]) => regions.map(regionId => [regionId, houseId]))),
};

export const GRAND_STARTING_BUILDINGS = {
  'mars-arsia-port': { barracks: 2 },
  'mars-olympus': { barracks: 1 },
  'earth-atlantic': { barracks: 2 },
  'earth-equator': { barracks: 1 },
  'jupiter-red-eye': { barracks: 2 },
  'jupiter-shearline': { fortress: 1 },
  'saturn-ringstead': { barracks: 2 },
  'saturn-glassward': { barracks: 1 },
  'saturn-gilt': { fortress: 1 },
  'venus-aurelia': { barracks: 2 },
  'venus-maat': { fortress: 1 },
};

export const GRAND_STARTING_ARMIES = [
  army('augustus-mars', 'Arsia Standard', 'augustus', 'mars-arsia-port',
    ['commander', 'rifle', 'rifle', 'heavy', 'raider', 'medic']),
  army('augustus-olympus', 'Olympus Watch', 'augustus', 'mars-olympus',
    ['commander', 'rifle', 'marksman', 'medic'], commander('Cassia au Augustus', 74, 78, 62, 80, 94)),
  army('augustus-tharsis', 'Tharsis Reserve', 'augustus', 'mars-tharsis',
    ['rifle', 'raider', 'engineer', 'transport']),
  army('bellona-earth', 'Atlantic Guard', 'bellona', 'earth-atlantic',
    ['commander', 'rifle', 'rifle', 'heavy', 'marksman', 'medic']),
  army('bellona-orion', 'Orion Regiment', 'bellona', 'earth-orion',
    ['commander', 'rifle', 'heavy', 'engineer'], commander('Lucan au Bellona', 81, 76, 80, 88, 88)),
  army('bellona-equator', 'Equatorial Line', 'bellona', 'earth-equator',
    ['rifle', 'marksman', 'medic', 'transport']),
  army('grimmus-jupiter', 'Red Eye Cohort', 'grimmus', 'jupiter-red-eye',
    ['commander', 'rifle', 'obsidian', 'heavy', 'engineer', 'tank']),
  army('grimmus-stormwatch', 'Stormwatch Guard', 'grimmus', 'jupiter-stormwatch',
    ['commander', 'rifle', 'raider', 'heavy'], commander('Cyra au Grimmus', 76, 80, 91, 73, 84)),
  army('grimmus-zephyr', 'Zephyr Landing Corps', 'grimmus', 'jupiter-zephyr',
    ['rifle', 'raider', 'medic', 'transport']),
  army('raa-saturn', 'Ringstead Guard', 'raa', 'saturn-ringstead',
    ['commander', 'rifle', 'marksman', 'obsidian', 'heavy', 'medic']),
  army('raa-shepherd', 'Shepherd Watch', 'raa', 'saturn-shepherd',
    ['commander', 'rifle', 'marksman', 'engineer'], commander('Alaric au Raa', 78, 88, 46, 90, 93)),
  army('raa-glassward', 'Glassward Reserve', 'raa', 'saturn-glassward',
    ['rifle', 'raider', 'medic', 'transport']),
  army('valii-rath-venus', 'Aurelia Watch', 'valii-rath', 'venus-aurelia',
    ['commander', 'rifle', 'marksman', 'raider', 'electronic', 'medic']),
  army('valii-rath-ishtar', 'Ishtar Veil', 'valii-rath', 'venus-ishtar',
    ['commander', 'rifle', 'heavy', 'electronic'], commander('Tavia au Valii-Rath', 73, 91, 58, 74, 79)),
  army('valii-rath-aphrodite', 'Aphrodite Reserve', 'valii-rath', 'venus-aphrodite',
    ['rifle', 'marksman', 'raider', 'transport']),
];

export const SKIRMISHES = {
  basin: {
    id: 'basin', name: 'Dust Basin', terrain: 'desert',
    description: 'An open battle with broken ridges and room to maneuver on both flanks.',
    squads: ['commander', 'rifle', 'rifle', 'heavy', 'raider', 'medic'],
    opponents: ['commander', 'rifle', 'rifle', 'marksman', 'obsidian', 'engineer'],
  },
  defile: {
    id: 'defile', name: 'Valles Defile', terrain: 'mountain',
    description: 'A narrow pass rewards formation changes and careful use of the high approaches.',
    squads: ['commander', 'rifle', 'raider', 'obsidian', 'marksman', 'medic'],
    opponents: ['commander', 'rifle', 'heavy', 'heavy', 'electronic', 'raider'],
  },
  spaceport: {
    id: 'spaceport', name: 'Landing Fire', terrain: 'spaceport',
    description: 'Cargo lanes give armored units cover before they reach the landing field.',
    squads: ['commander', 'rifle', 'rifle', 'tank', 'engineer', 'raider', 'medic'],
    opponents: ['commander', 'rifle', 'heavy', 'tank', 'obsidian', 'electronic', 'medic'],
  },
  rim: {
    id: 'rim', name: 'Coldwater Stand', terrain: 'ice',
    description: 'Fight around frozen ridges and cover the exposed crossing with marksmen.',
    squads: ['commander', 'rifle', 'marksman', 'heavy', 'raider', 'transport', 'medic'],
    opponents: ['commander', 'rifle', 'marksman', 'obsidian', 'razor', 'engineer', 'tank'],
  },
};
