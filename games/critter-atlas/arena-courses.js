import { EXPANSION_REGIONS } from './expansion-regions.js';

// A–D and 1–4 mark the two teams' starting positions, in party order.
// Each course's lineup names established locals so gated habitat species stay wild.
export const ARENA_COURSES = [
  {
    trial: {
      terrain: ['.B.c.2.', 'D.#.#..', 'A.c.c.1', 'C.#.#..', '...h.3.'],
      lineup: [1, 3],
      tactic: 'Pineplate holds the center while Bramblit shoots from the north. The ferns shelter your approach.'
    },
    warden: {
      terrain: ['B..c..2', '.ch#h..', 'A..c.13', '..h#hc.', 'C.D...4'],
      lineup: [0, 5, 2],
      tactic: 'Two thorn beds guard the center. Send a fast companion around a flank to reach the healer.'
    }
  },
  {
    trial: {
      terrain: ['B.c.h.2', '.h.#c..', 'A.h..1.', '.c.#h..', 'CD..h.3'],
      lineup: [7, 10, 8],
      tactic: 'The safe crossing bends through the reeds. Leave the bog before ending a turn.'
    },
    warden: {
      terrain: ['B..c.2.', 'D.hh..4', 'A.c#c.1', '.c.hh..', 'C....3.'],
      lineup: [8, 9, 10],
      tactic: 'The central pillar splits the board. Reach the lantern newt on the north bank before it mends its allies.'
    }
  },
  {
    trial: {
      terrain: ['.B.#.2.', 'C.c.c..', 'A..h..1', 'D...#..', '..c..3.'],
      lineup: [14, 15, 17],
      tactic: 'Loose shale exposes the middle. Work around the crystal shelves to surround the mole.'
    },
    warden: {
      terrain: ['B.#.c.2', '.c.h#..', 'A..#..1', 'D.#h.c3', 'C.c..4.'],
      lineup: [17, 15, 14],
      tactic: 'Crystal ribs divide the court into two galleries. The bat can strike across the ribs.'
    }
  },
  {
    trial: {
      terrain: ['.B..c2.', '.chh#..', 'A.c..1.', 'D..h.c.', '.C...3.'],
      lineup: [21, 24, 22],
      tactic: 'The hermit crab anchors the near lane. Tidegrass blunts the otter’s stones.'
    },
    warden: {
      terrain: ['.Bcc..2', 'D...h#.', 'A.hh..1', '.#h..c3', 'C.c...4'],
      lineup: [22, 26, 21, 23],
      tactic: 'The low approach avoids the central riptides. Use it to flank the warden’s shell guard.'
    }
  },
  {
    trial: {
      terrain: ['.B.#.2.', '..c.h..', 'A.#c..1', 'D.h.#..', 'C.c..3.'],
      lineup: [28, 29, 32],
      tactic: 'The snowbanks break up the falcon’s shots. Black ice slows a companion for its next turn.'
    },
    warden: {
      terrain: ['B.h#..2', 'D..c.h.', '.A.h..1', '.#..c3.', 'C.c#..4'],
      lineup: [33, 29, 32, 31],
      tactic: 'The ibex holds the pass while the falcon fires from behind. A snowbank can shelter a ranged ally.'
    }
  },
  {
    trial: {
      terrain: ['B....2.', '.h#.#h.', 'A.c.c.1', 'D.h.h..', 'C..#..3'],
      lineup: [35, 36, 37],
      tactic: 'A clear central aisle separates the lava vents. Push through it before the swift sets up.'
    },
    warden: {
      terrain: ['Bch..c2', 'D..#h..', 'A.h..1.', '.hc#.3.', 'C..h..4'],
      lineup: [37, 38, 40, 39],
      tactic: 'Fight from the vent rims. A turn ended on molten ground costs eighteen percent of maximum health.'
    }
  },
  {
    trial: {
      terrain: ['.B.#.2.', '..ch...', 'A.#.#.1', '.h..c3.', 'CD.#...'],
      lineup: [43, 45, 47],
      tactic: 'Pillars force melee companions around the stairs. The gecko’s beam can cross the central divide.'
    },
    warden: {
      terrain: ['B.c#..2', '.#h..c4', 'A..c..1', 'C..h#.3', '.D.#c..'],
      lineup: [42, 46, 47, 44],
      tactic: 'Stand in pillar shade for cover and avoid the rune traps. Exposed Critters take heavier hits.'
    }
  },
  {
    trial: {
      terrain: ['B..h.2.', '..c#c..', '.A.h..1', 'D..#c3.', 'C..h...'],
      lineup: [51, 53, 49],
      tactic: 'The starfall marks a hazardous center line. Enter from either side behind the star mist.'
    },
    warden: {
      terrain: ['.B.c..2', 'D.#hh.4', 'A.c#c.1', '.hh#..3', 'C..c...'],
      lineup: [49, 53, 51, 50],
      tactic: 'Two banks of starfall split the orrery. Reach the jellyfish before it restores the front line.'
    }
  }, ...EXPANSION_REGIONS.map(region => region.courses)
];

export function arenaCourse(encounter) {
  const arena = ARENA_COURSES[encounter.region];
  if (encounter.kind === 'warden' || encounter.kind === 'arena') {
    return (encounter.arenaId || encounter.kind) === 'warden' ? arena?.warden : arena?.trial;
  }
}

// Panel numbers follow the painted lair atlas. The lead appears on hex 1.
const lairs = {
  0: { panel:0, omen:'Silver dust falls from a cocoon. Two moonlit wings open under the trees.',
    terrain:['B.c.c.2', '.ch#...', 'A..c.1.', 'D.#.hc.', 'C..c...'] },
  2: { panel:1, omen:'A note rises from the water. The crystal forks answer in harmony.',
    terrain:['B..#.2.', 'D.c.c..', 'A.h#..1', '..c.h..', 'C...c..'] },
  3: { panel:2, omen:'Mist slips through the wreck. A ragged sail turns against the wind.',
    terrain:['.B.c.2.', '..#h...', 'A.c..1.', 'D.h.#..', 'C..c...'] },
  5: { panel:3, omen:'One glass bell rings. Sparks tumble from a pair of glowing horns.',
    terrain:['B.h.c.2', '.c#..h.', 'A..c.1.', 'D.h.#..', 'C...h..'] },
  7: { panel:4, omen:'The orrery clicks into eclipse. A dark wing crosses the star dial.',
    terrain:['.B.c..2', 'D.h.#..', 'A.c..1.', '..#h.c.', 'C..c...'] }
};

export function huntLair(encounter, lead) {
  if (encounter.kind === 'wonder' && encounter.habitatId === 'wonder' &&
      lead?.hyperRare && lead.region === encounter.region && lead.id === encounter.leadSpeciesId) {
    return lairs[encounter.region];
  }
}
