import fs from 'node:fs';
import path from 'node:path';
import {setPaintedTroopAtlases} from '../../complete-troops.js';
export async function loadRuntimePaintedArt(root,raster){
 const file=path.join(root,'assets/painted-troops/manifest.json');if(!fs.existsSync(file))return null;
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),sources=new Set();
 for(const definition of Object.values(manifest.troops||{})){if(definition.referenceOnly)continue;for(const sheet of Object.values(definition.sheets||{}))sources.add(sheet.src);}
 for(const building of Object.values(manifest.buildings||{}))sources.add(building.src);
 const images=new Map(await Promise.all([...sources].map(async src=>[src,await raster.loadImage(src.startsWith('data:')?src:path.resolve(root,src))])));
 setPaintedTroopAtlases(manifest,images);return manifest;
}
export function frameSourceKey(cel){return cel?[cel.source,cel.sx,cel.sy,cel.sw,cel.sh].join('|'):null;}
