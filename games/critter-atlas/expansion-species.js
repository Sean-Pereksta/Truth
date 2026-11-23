// Regional forms share a silhouette and four action poses with the parent family.
// The first six families roam in patrols, followed by each region's hollow,
// rare habitat and vault residents. Keep their IDs in this order for journals.
const variants = [
  [0, 'Tasselfawn|Bristlebuck|Graincrown|Saffrontler', 'Tassel Break', '#d2b961', 'Its antlers catch ripe seeds and carry them across the pasture.'],
  [2, 'Haymoth|Strawsilk|Amberlace|Harvestmantle', 'Amber Pollen', '#dfbb7c', 'Settlers leave out dried grass for the moths that mend their injured herds.'],
  [1, 'Burrscale|Tasselspine|Goldplate|Drawshield', 'Burr Brace', '#c5a36d', 'A growing Burrscale knots its burs into rings tough enough to catch an arrow.'],
  [29, 'Kestrelit|Haywhistle|Loftscreech|Wheatgale', 'Kitewheel Cut', '#e6b383', 'It circles a windmill three times before diving into the long grass.'],
  [28, 'Fallowram|Windwool|Brassfleece|Thunderwether', 'Fleece Brace', '#d7bd97', 'Its wool crackles when a herd gathers beneath a storm.'],
  [47, 'Prairiepup|Tawnyjack|Goldstrider|Longrun Jackal', 'Sunline Dash', '#d3a56f', 'It memorizes every gap in the splitrail fence before joining the hunt.'],
  [6, 'Bramblehorn|Stormhart|Brass Monarch|Stillwind Stag', 'Stormheart Bloom', '#eeb96a', 'The whole basin goes quiet when this stag raises its brass antlers.'],
  [67, 'Burrowglide|Drygrass Sail|Meadowparasol|Foilwhistler', 'Prairie Swoop', '#c8ac72', 'It sails above the burrs by catching the warm air rising off the pasture.'],
  [75, 'Gildwing|Stormtalon|Kitecrown|Cloudbreak Roc', 'Cloudbreak Dive', '#ecc283', 'When a storm strikes the prairie, it opens its wings to take the first bolt.'],

  [47, 'Flakepup|Saltmuzzle|Whitestrider|Mirage Jackal', 'Whitepan Chase', '#d2c4b4', 'It scatters three convincing sets of footprints across the dry surface.'],
  [17, 'Chalkback|Saltcairn|Crustplate|Panfort', 'Brineshell Press', '#dcd2c0', 'It settles into a shallow well and waits for salt to harden around its shell.'],
  [44, 'Saltscribe|Brineplume|Mirrorscribe|Silver Cartographer', 'Salt Script', '#e7dbba', 'It redraws the caravan route after every flood.'],
  [24, 'Panpup|Crystalskip|Flakesling|Brineotter', 'Crystalskip', '#bcaa99', 'It skips salt pebbles until the whole pool rings.'],
  [46, 'Saltcoil|Calcifang|Brinehood|Panmamba', 'Salt Spit', '#c7d3c1', 'Salt traces a different pattern across the hood of every member of its brood.'],
  [45, 'Palegeck|Shardfrill|Saltmirror|Glarecrest', 'Glare Beam', '#ebd6a0', 'Its frill dims just before the bright glare washes across the flats.'],
  [20, 'Miragecoil|Mirrorfang|Glassasp|Falsesky Serpent', 'Mirror Refraction', '#e4c9e5', 'Caravans recognize the real serpent by the ripples its reflection never makes.'],
  [18, 'Brinely|Saltwhisk|Whitefrill|Lacemander', 'Brine Sense', '#c7dacf', 'Its gills untangle fine salt crystals without disturbing the still pool.'],
  [48, 'Duskidol|Shadekit|Salt Oracle|Mirrorheart Sovereign', 'Cistern Seal', '#d4c4df', 'Its reflection turns to face any traveler who opens the sealed gallery.'],

  [28, 'Driftram|Icecurler|Floehammer|Snowfort', 'Drift Ram', '#afcedf', 'Its thick fleece catches blue ice and forms an extra layer of armor.'],
  [53, 'Polrook|Spinquill|Northfeather|Beaconwing', 'Boreal Quill', '#a2c8e3', 'Lost caravans follow the one green feather on its tail.'],
  [30, 'Floelet|Rimefoot|Driftbounder|Stillnight Hare', 'Blackice Feint', '#c6e7e5', 'It runs across thin ice without leaving a ripple.'],
  [50, 'Frostdrop|Icebell|Borealbloom|Winter Medusa', 'Aurora Drift', '#91d7de', 'Its bell stores a little of the aurora through the longest winter night.'],
  [29, 'Borealpin|Iceclaw|Crosswind|Glazefalcon', 'Coldstream Quill', '#b0d3ed', 'Its flight slips below the strongest gust before rising above the ridge.'],
  [68, 'Frostyoke|Bluehump|Polar Yoke|Glazehoof', 'Blue Ice Rampart', '#94c5db', 'It breaks open the ice cap so smaller Critters can drink.'],
  [34, 'Lanterncub|Borealpelt|Glacier Cat|Winter Lantern', 'Greenfire Step', '#b5e8df', 'Old herders say the moving lights under the ice come from its eyes.'],
  [31, 'Coldchime|Glazetender|Frostbell|Pole Peal', 'Polar Peal', '#bac9e8', 'Its hollow bells mark the paths that stay open through winter storms.'],
  [55, 'Polaris Calf|Polefin|Stillnight Leviathan|Aurora Crown', 'Stillnight Chord', '#a1dce9', 'The brightest point in the northern lights moves to the rhythm of its calls.']
];

const slots = [
  ['Common', .511], ['Common', .476], ['Uncommon', .379], ['Uncommon', .346],
  ['Scarce', .256], ['Rare', .176], ['Legendary', .035, 'hollow'], ['Rare', .152, 'habitat'],
  ['Legendary', .034, 'vault']
];

export function expansionSpecies(established) {
  return variants.map(([baseSpeciesId, names, signature, color, lore], offset) => {
    const forms = names.split('|');
    const group = Math.floor(offset / slots.length);
    const slot = offset % slots.length;
    const [rarity, rate, habitatId] = slots[slot];
    const { animal, role, effect, technique } = established[baseSpeciesId];
    const captureRate = Number((rate - group * (rarity === 'Legendary' ? .002 : .007)).toFixed(3));
    return { id:established.length + offset, region:8 + group, baseSpeciesId, name:forms[0], forms,
      animal, role, signature, effect, technique, color, lore, rarity, captureRate, habitatId, legendary:rarity === 'Legendary' };
  });
}
