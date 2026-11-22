import { SPECIES } from './catalog.js';

const REGION_SHEETS = ['forest', 'marsh', 'caves', 'coast', 'mountains', 'volcano', 'ruins', 'astral'];

/** Every column is a Critter family. Its four painted forms run from top to bottom. */
export function sprite(speciesId, stage = 0) {
  const species = SPECIES[speciesId];
  if (!species || !Number.isInteger(speciesId)) return '';
  const form = Number.isInteger(stage) ? Math.max(0, Math.min(3, stage)) : 0;
  const sheet = REGION_SHEETS[species.region];
  const x = (speciesId % 7) * 100 / 6;
  const y = form * 100 / 3;
  const name = species.forms[form].replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<span class="critter-sprite sprite-${sheet}" role="img" aria-label="${name}" style="--sprite-x:${x}%;--sprite-y:${y}%"></span>`;
}
