// Region IDs follow the original eight, so existing atlas and journal keys stay valid.
export const EXPANSION_REGIONS = [
  {
    catalog: ['Amberwind Steppe', 'steppe', 36, 'Goldenrun Herds', 'Kitewheel Course', 'Bristlegrass', '#d6ac61', 0, 'sepia(.58) saturate(1.25) hue-rotate(-16deg)'],
    land: {
      districts: ['Kitewheel Downs', 'The Gallopways', 'Thunder Crown'],
      names: ['Tassel Camp', 'Kitewheel Exchange', 'Goldenrun Pasture', 'Storm Pennants', 'Grainspan Watch', 'The Windbreak',
        'Windbreak Landing', 'Kestrel Run', 'Lightning Post', 'Burrgrass Nursery', 'Kitewheel Sprint', 'Splitrail Gap', 'Pollenbluff',
        'Highgrass Station', 'Thunder Crown Circuit', 'The Still Eye', 'Bellhorn Watch', 'The Cloudbreak', 'Brassmane Range'],
      signs: ['The pennants point into the wind when the silver herd passes under them.', 'A single hoofprint rings like a brass bell when the air goes still.'],
      travel: ['Grain wagons circle the windmills below the open pastures.', 'Shelter belts split into long running lanes and supply paths to the racecourt.', 'The warden rides the rim of a vast thunder basin. The far slope ends in untouched grass.']
    },
    points: [[15,70],[29,48],[48,65],[48,22],[75,72],[84,34], [13,62],[31,48],[27,77],[50,17],[61,58],[85,32],[72,80], [13,60],[48,53],[37,19],[75,70],[85,29],[54,81]],
    shortcuts: [['camp','outpost'], ['ford','grove'], ['entry','habitat'], ['habitat','trial'], ['farpost','den']],
    levels: {trial:39, warden:43, den:46, sentinel:48, vault:50},
    battle: {cover:'Hay ridge', hazard:'Bristlegrass', effect:'slow', pattern:['..c....', '.h..#..', '..#..c.', '..ch...', '...h.c.']},
    courses: {
      trial: {
        terrain: ['B..h..2', 'D.c.#..', 'A.ch..1', '..#c.3.', 'C.h..4.'],
        lineup: [81, 84, 83, 82],
        tactic: 'The herd races up the open lanes. Fight from hay ridges and watch for the pollen moth supporting their charge.'
      },
      warden: {
        terrain: ['.B.c..2', '.hh#.c4', 'A..c..1', 'D.#.h..', 'C.c..3.'],
        lineup: [85, 82, 84, 86],
        tactic: 'The ram and jackal advance through the center. Keep a companion on either flank to reach their ranged support.'
      }
    }
  }, {
    catalog: ['Mirror Saltflats', 'saltflats', 42, 'Glasspan Wanderers', 'Mirage Forum', 'Salt glare', '#dfcbaf', 6, 'saturate(.46) brightness(1.19) hue-rotate(9deg)'],
    land: {
      districts: ['Whitepan Market', 'Shiverglass Flats', 'The Drowned Mirror'],
      names: ['Saltwick Camp', 'Whitepan Caravanserai', 'Mirage Tracks', 'Tide Posts', 'Brineshell Causeway', 'Saltgate',
        'Shard Landing', 'Whiteglass Rise', 'Broken Compass', 'Brine Lace Pools', 'Aster Saltcourt', 'Sun Mirror Drop', 'Prismflint Roost',
        'Cistern Mouth', 'Mirage Forum', 'The False Sky', 'Looking Glass Watch', 'Mirrorheart Vault', 'Pale Crystal Den'],
      signs: ['The tallest tide post casts the shape of a serpent, regardless of the hour.', 'The compass needle swings only when facing its reflection.'],
      travel: ['Caravans cross the salt crust between shadecloth stalls and ruined wells.', 'Unmarked dry lanes curl between shining pools and the old square.', 'The salt caves reflect the ruins above. Bridges span a mirror-smooth underground lake.']
    },
    points: [[14,67],[28,29],[44,55],[65,19],[74,73],[86,45], [12,58],[38,34],[27,78],[52,20],[63,56],[89,35],[76,81], [12,58],[54,50],[43,20],[76,70],[84,30],[47,80]],
    shortcuts: [['town','outpost'], ['ford','pass'], ['ridge','lookout'], ['rookery','highpass'], ['hollow','vault']],
    levels: {trial:45, warden:49, den:52, sentinel:54, vault:56},
    battle: {cover:'Salt columns', hazard:'Salt glare', effect:'exposed', pattern:['....#..', '.c.h...', '..h..c.', '...#.h.', '..c....']},
    courses: {
      trial: {
        terrain: ['B.h.c.2', '..#..h.', 'A.c..13', 'D.hc#..', 'C..h..4'],
        lineup: [91, 93, 94, 95],
        tactic: 'The tortoise uses salt columns to cover the shooters. End turns out of the glare before their ranged attacks.'
      },
      warden: {
        terrain: ['B..#..2', 'D.ch.c4', '.A..#.1', 'c.h..3.', 'C...h..'],
        lineup: [94, 92, 95, 90],
        tactic: 'The salt ibis heals from behind the western column. Close in through the shaded path north of the glare.'
      }
    }
  }, {
    catalog: ['Northlight Expanse', 'tundra', 48, 'Polar Beacon Clans', 'Aurora Bastion', 'Cold vent', '#90d7e3', 4, 'hue-rotate(23deg) saturate(1.18) brightness(.89)'],
    land: {
      districts: ['Beacon Sound', 'The Aurora Steps', 'Stillnight Crown'],
      names: ['Northlight Camp', 'Beacon Sound Storehouse', 'Floe Tracks', 'Polaris Cairn', 'Driftglass Bridge', 'The Blue March',
        'Glaze Landing', 'Rimewatch Ridge', 'Greenfire Mast', 'Boreal Nursery', 'Aurora Steps Court', 'Midnight Ladder', 'Whiteplume Roost',
        'Polar Station', 'Aurora Bastion', 'The Winter Lantern', 'Stillnight Gate', 'The Poleheart', 'Blue Ice Den'],
      signs: ['A green light moves under the ice in the opposite direction to the lights overhead.', 'The mast chimes without wind. One answering note comes from beneath the crown.'],
      travel: ['Lantern stakes mark a safe path between drifting floes and the supply storehouse.', 'Ice stairs climb toward the northern arena under curtains of green light.', 'Sunless ridges ring the final bastion. Beyond the keeper stands the oldest ice in the Atlas.']
    },
    points: [[14,74],[26,32],[46,57],[58,20],[78,72],[87,39], [12,61],[30,38],[27,78],[57,16],[65,57],[87,37],[72,83], [13,58],[48,49],[39,17],[76,69],[88,30],[49,80]],
    shortcuts: [['camp','outpost'], ['town','grove'], ['lookout','trial'], ['habitat','highpass'], ['warden','sentinel'], ['den','vault']],
    levels: {trial:51, warden:55, den:57, sentinel:59, vault:60},
    battle: {cover:'Blue ice ridge', hazard:'Cold vent', effect:'hurt', pattern:['..h..c.', '.c..#..', '...h...', '..#..c.', '.h..#..']},
    courses: {
      trial: {
        terrain: ['.B.h.2.', 'D..#..4', 'A.cc..1', 'c.h.#..', 'C..h.3.'],
        lineup: [99, 100, 102, 103],
        tactic: 'Use the double ridge for cover. Two northern shooters can force a slow team into the vents.'
      },
      warden: {
        terrain: ['B.#c..2', '.h..h.4', 'A.ch..1', 'D.#.c3.', '.C..h..'],
        lineup: [104, 102, 103, 101],
        tactic: 'The musk ox shields an aurora healer. Rotate through the side lanes and prioritize the back line.'
      }
    }
  }
];

export const EXPANSION_BIOMES = EXPANSION_REGIONS.map(region => region.battle);
