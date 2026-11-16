// Compatibility entry point: review actual image-generated PNG frames only.
// No body, limb, equipment or character geometry is authored by this script.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const gameRoot=fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(process.argv[2]||path.join(gameRoot,'source/outputs/painted-review'));
process.argv[2]=path.join(gameRoot,'assets/painted-troops/manifest.json');
process.argv[3]=output;
await import('./review-painted-atlases.mjs');
