import { REGIONS, SPECIES } from './catalog.js';

const REGION_SHEETS = ['forest', 'marsh', 'caves', 'coast', 'mountains', 'volcano', 'ruins', 'astral'];
const ORIGINAL_FAMILIES = 56;
const FIRST_WONDER = 76;

// The first paintings keep their original seven-column regional sheets. Frontier
// families span habitats, so their paired idle and strike sheets use four columns.
export function spriteAtlas(speciesId) {
  if (!Number.isInteger(speciesId) || !SPECIES[speciesId]) return null;
  const sourceId = SPECIES[speciesId].baseSpeciesId ?? speciesId;
  if (sourceId < ORIGINAL_FAMILIES) {
    return { sheet: REGION_SHEETS[Math.floor(sourceId / 7)], columns: 7, column: sourceId % 7 };
  }
  if (sourceId >= FIRST_WONDER) {
    return { sheet: 'wonders', columns: 5, column: sourceId - FIRST_WONDER };
  }
  const offset = sourceId - ORIGINAL_FAMILIES;
  return { sheet: 'frontier-' + (Math.floor(offset / 4) + 1), columns: 4, column: offset % 4 };
}

/** Every column is a Critter family. Its four painted forms run from top to bottom. */
export function sprite(speciesId, stage = 0) {
  const atlas = spriteAtlas(speciesId);
  if (!atlas) return '';
  const species = SPECIES[speciesId];
  const form = Number.isInteger(stage) ? Math.max(0, Math.min(3, stage)) : 0;
  const x = atlas.column * 100 / (atlas.columns - 1);
  const y = form * 100 / 3;
  const name = species.forms[form].replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const tint = species.baseSpeciesId === undefined ? '' : `;--sprite-filter:${REGIONS[species.region].artFilter}`;
  return `<span class="critter-sprite sprite-${atlas.sheet}" role="img" aria-label="${name}" style="--sprite-width:${atlas.columns * 100}%;--sprite-x:${x}%;--sprite-y:${y}%${tint}"></span>`;
}
