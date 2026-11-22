// IDs double as saved roster references. Each wonder has one resident family.
const residents = [
  {
    id: 76, region: 0, forms: ['Veilkit', 'Gloamruff', 'Lunavelour', 'Vesper Lynarch'],
    animal: 'luna-moth lynx', role: 'ranged', color: '#a5d4ac', captureRate: .020,
    signature: 'Moondust Volley', effect: 'slow', technique: { kind: 'attack', power: 1.22, range: 4 },
    lore: 'Two moon-shaped eyespots shine on its folded wings. Forest moths settle on the tracks it leaves behind.'
  },
  {
    id: 77, region: 2, forms: ['Chordcoil', 'Bellbranch', 'Choralume', 'Glass Cantor'],
    animal: 'crystal-forked olm', role: 'healer', color: '#d8b4df', captureRate: .019,
    signature: 'Resonant Mending', effect: null, technique: { kind: 'heal', power: 1.72, range: 4 },
    lore: 'Its forked crystal crest finds the note inside a cracked geode. Injured cave creatures gather in the pools where it sings.'
  },
  {
    id: 78, region: 3, forms: ['Keelwisp', 'Brinesail', 'Wakegalleon', 'Phantom Admiral'],
    animal: 'spectral sail-backed seadragon', role: 'striker', color: '#8cd6c4', captureRate: .018,
    signature: 'Phantom Broadside', effect: 'exposed', technique: { kind: 'attack', power: 1.42, range: 2 },
    lore: 'On still nights its leafy fins rise above the waves like torn sails. The little ship then turns straight into the wind.'
  },
  {
    id: 79, region: 5, forms: ['Crucibex', 'Glasshorn', 'Kiln Regent', 'Crucible Sovereign'],
    animal: 'obsidian glassblower ram', role: 'defender', color: '#e59961', captureRate: .017,
    signature: 'Molten Peal', effect: 'stun', technique: { kind: 'attack', power: 1.25, range: 2 },
    lore: 'Its breath runs through hollow horns like a glassblower’s pipe. Each dawn it leaves a tiny spiral of warm glass on the black rock.'
  },
  {
    id: 80, region: 7, forms: ['Prismarch', 'Veylcrest', 'Umbraquill', 'Astral Coronant'],
    animal: 'six-winged eclipse secretarybird', role: 'ranged', color: '#c4abe4', captureRate: .016,
    signature: 'Eclipse Cascade', effect: 'exposed', technique: { kind: 'attack', power: 1.31, range: 4 },
    lore: 'One pair of wings catches starlight, one splits it into colors, and the last casts a perfectly round shadow over its nest.'
  }
];

export const HYPER_SPECIES = residents.map(family => ({
  ...family, name: family.forms[0], rarity: 'Hyper Rare', hyperRare: true, legendary: false, habitatId: 'wonder'
}));
