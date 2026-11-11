import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const source=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(source,name),'utf8');
const modules=[
 'audio.js','monster-texture-assets.js','creature.js','humans.js',
 'real-human-tools.js','real-human-assets.js','real-humans.js',
 'difficulties.js','controller.js','simulation.js','main.js'
];
const game=modules.map(name=>read(name).replace(/^export /gm,'')).join('\n');
const html=read('shell.html')
 .replace('/*THREE*/',()=>read('three.min.js').replace(/<\/script/gi,'<\\/script'))
 .replace('/*GAME*/',()=>game);
const output=path.join(source,'..','index.html');
fs.writeFileSync(output,html);
console.log('Rebuilt '+output);
