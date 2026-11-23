export const TRAIL_HABITATS = {
  glade: { district: 1, approach: 'lookout', gate: 'outpost', point: [13, 19], levelOffset: 2 },
  refuge: { district: 2, approach: 'warden', gate: 'warden', point: [87, 81], levelOffset: 5 }
};

export const TRAIL_SITE_NAMES = [
  ['Fernbell Glade', 'Lanternroot Refuge'],
  ['Rushbloom Backwater', 'Wickmere Refuge'],
  ['Rainbow Ore Pocket', 'Chimerglass Refuge'],
  ['Ribbonkelp Cove', 'Lighthouse Refuge'],
  ['Heathwind Shelf', 'Hoarfrost Refuge'],
  ['Ashpetal Gardens', 'Warmstone Refuge'],
  ['Marblegrass Court', 'Incense Refuge'],
  ['Silver Dusk Garden', 'Lost Orbit Refuge'],
  ['Ryegrass Rise', 'Rainchime Refuge'],
  ['Stripecross Lagoon', 'Milkglass Refuge'],
  ['Ternlight Shelf', 'Midwinter Refuge']
];

// The journal stores IDs. Keep this order when adding subsequent families.
// Each pair belongs to the current region's side glade and warden refuge.
const families = [
  [50, 'Pollenbob|Fernswing|Lanternpuff|Thicket Lantern', 'Pollen Swing', 'forest', 'hue-rotate(92deg) saturate(1.1)', 'Its bell drifts beneath the leaves and shakes loose clouds of healing pollen.', 'renewal', 4],
  [42, 'Ambercarapace|Sapshell|Resinrest|Lanternroot Shield', 'Resin Buckle', 'forest', 'sepia(.5) saturate(1.5)', 'Its resin shell seals with a click when a companion shelters beneath it.', 'bulwark', 6],
  [67, 'Breezelet|Puntwing|Windskiff|Reedwake Glider', 'Puntwake', 'marsh', 'hue-rotate(-35deg) saturate(1.3)', 'The breeze under its soft fins can pull a stranded punt out of the reeds.', 'tailwind', 6],
  [34, 'Fogcub|Fenstalk|Wickshadow|Drowsemane', 'Fogbound Step', 'marsh', 'saturate(.55) hue-rotate(-36deg)', 'Its soft footfalls make the marsh fall quiet before the sun goes down.', 'dread', 9],
  [3, 'Chipmote|Flickershard|Gemcache|Lodestar Cache', 'Cutterstone', 'cave', 'saturate(.8) hue-rotate(215deg)', 'It taps a rhythm on crystals to tell the other foragers where it found food.', 'rally', 6],
  [51, 'Chimeclamp|Opalhook|Carillobeetle|Prism Carillon', 'Velvet Chime', 'cave', 'hue-rotate(70deg) saturate(1.45)', 'Its shell rings like struck glass when it locks into a defensive stance.', 'bulwark', 12],
  [12, 'Saildart|Spindriftwing|Chimefin|Teal Sails', 'Foam Whirl', 'coast', 'hue-rotate(-68deg) saturate(1.3)', 'It rides the shape of a breaking wave, leaving a smooth course for the rest of its shoal.', 'tailwind', 10],
  [18, 'Foamfrill|Splaycrest|Beaconfrill|Littoral Beacon', 'Tidelight Lilt', 'coast', 'hue-rotate(155deg) saturate(1.45)', 'As it settles into a tidepool, battered reef creatures gather beside its glowing gills.', 'renewal', 12],
  [25, 'Hailfin|Flutterhull|Runnelwing|Rime Sails', 'Thawstream', 'mountains', 'hue-rotate(23deg) saturate(.9) brightness(1.2)', 'Its flat fins guide crosswinds under the wings of slower travelers.', 'tailwind', 12],
  [1, 'Firknob|Hoarfletch|Pinebastion|Glacier Bark', 'Winter Bark', 'mountains', 'saturate(.5) hue-rotate(191deg)', 'It nests in snow-dusted pines until old needles knit a second skin over its scales.', 'bulwark', 16],
  [16, 'Sootfiddle|Coalstrum|Kilnchord|Ember Orchestra', 'Cinder Cadence', 'volcanic', 'hue-rotate(-17deg) saturate(1.65)', 'Its tune is loud enough to bring a scattered pack back together over a rushing vent.', 'rally', 12],
  [13, 'Cindergloom|Furnace Wisp|Cinder Procession|Smoke Marshal', 'Ashen Warning', 'volcanic', 'sepia(.78) saturate(1.7) brightness(.88)', 'The flock keeps distance from it when strange shapes appear in its wake of smoke.', 'dread', 18],
  [44, 'Quillreed|Reedinscriber|Archscribe|Reed Cartouche', 'Marble Verse', 'ruins', 'hue-rotate(49deg) saturate(.86)', 'Its song reminds young Critters to rest in dry corners when the low gardens flood.', 'renewal', 16],
  [5, 'Mosaiclet|Stoneseer|Orielguard|Terrace Watcher', 'Old Court Watch', 'ruins', 'saturate(.55) hue-rotate(170deg)', 'While its brood sleeps, it watches from a broken arch and calls out approaching threats.', 'rally', 20],
  [23, 'Orbitbud|Silverslug|Moonbranched|Crescentnerve', 'Moonlit Braid', 'astral', 'hue-rotate(-67deg) saturate(1.2)', 'Its growth rings glow in sequence, and each light helps another member of the colony recover.', 'renewal', 18],
  [38, 'Dusthook|Nightclasp|Nullstinger|Blackorbit', 'Empty Orbit', 'astral', 'hue-rotate(194deg) saturate(.8)', 'A silent ring of moon dust traces the edge of its territory.', 'dread', 24],
  [24, 'Ryeskip|Haysling|Galeotter|Pasture Skipper', 'Dryland Skip', 'forest', 'sepia(.4) saturate(1.15) hue-rotate(20deg)', 'Its stones whistle through the stalks, warning the herds which way to run.', 'tailwind', 20],
  [28, 'Tasselamb|Stormwether|Rainhorn|Herd Nimbus', 'Prairie Drum', 'mountains', 'sepia(.68) saturate(1.4) hue-rotate(-12deg)', 'When a storm rolls over the flats, its hooves drum a steady marching beat.', 'rally', 24],
  [7, 'Brineplip|Saltfloat|Brackencroak|Alkali Guard', 'Whitewater Brace', 'marsh', 'saturate(.55) brightness(1.14)', 'The pale salt that cakes its back hardens until its brood can cross on it.', 'bulwark', 24],
  [20, 'Milkasp|Gypscoil|Marblewinder|Chalk Crown', 'Salt Mirage', 'cave', 'saturate(.41) brightness(1.24)', 'Its empty shed is so lifelike, traveling packs turn aside rather than step over it.', 'dread', 26],
  [15, 'Aurorabat|Rimecloak|Skysong|Pale Carillon', 'Ternlight Chorus', 'astral', 'hue-rotate(105deg) saturate(.85)', 'Marks of green light ripple along its wings when its flock gathers at dusk.', 'rally', 26],
  [39, 'Midgill|Snowmender|Borealfrill|Permafrost Lotus', 'Stillnight Bouquet', 'mountains', 'hue-rotate(189deg) saturate(.9)', 'Small creatures gather over its warming breath during the longest night of winter.', 'renewal', 28]
];

export function trailSpecies(previous) {
  return families.map(([baseSpeciesId, names, signature, affinity, spriteFilter, lore, aura, unlockLevel], offset) => {
    const region = Math.floor(offset / 2);
    const refuge = offset % 2 === 1;
    const forms = names.split('|');
    const { animal, role, color, effect } = previous[baseSpeciesId];
    const rate = refuge ? .1621 - region * .003 : .3181 - region * .005;
    return { id: previous.length + offset, name: forms[0], forms, region, animal, role, color,
      signature, affinity, effect, lore, baseSpeciesId, spriteFilter, rarity: refuge ? 'Rare' : 'Scarce',
      captureRate: Number(rate.toFixed(4)), habitatId: refuge ? 'refuge' : 'glade',
      aura: { id: aura, unlockLevel, radius: aura === 'dread' && region < 5 ? 1 : 2 } };
  });
}
