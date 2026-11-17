'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.window = global;
// Consume the same append order as file:// boot, including future data modules.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [,src] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  if (src === 'config.js' || src.startsWith('data/') ||
      ['js/world/world.js','js/world/resistance-camps.js','js/world/deep-enemies.js','js/world/resistance-fronts.js'].includes(src)) {
    require(path.join(root,src));
  }
}
const C = OW.Content;
C.installDistantVaultSites(OW.World);
OW.World.prepareContentCoordinates();
function write(file, value) {
  fs.writeFileSync(path.join(root,file), JSON.stringify(value,null,2)+'\n');
}
for (const key of ['regions','sectors','bossPosters','enemies','bosses','weapons','melee','abilities','equipment','quests','rarities','characters','npcs']) {
  write('data/'+key+'.json', C[key]);
}
const w = new OW.World(OW.config.seed);
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const worldFile='maps/world/world.json', world=read(worldFile);
for (const k of ['seed','width','height','chunkSize','start','regions','locations','roads','rivers','bridges']) world[k]=w[k];
world.sectors=C.sectors; world.enemySpawnCount=w._spawns.size; world.objectCount=w.objects.length;
world.cityDistricts=(w.cityZones||[]).map(({id,name,region,left,right,top,bottom,quarters,avenues,tram})=>({id,name,region,left,right,top,bottom,quarters,avenues,tram}));
write(worldFile,world);
for (const region of w.regions) {
  const inRegion = e=>e.region===region.index;
  write('maps/regions/'+region.slug+'.json',{region,locations:w.locations.filter(inRegion),enemySpawns:[...w._spawns.values()].filter(inRegion),objects:w.objects.filter(inRegion)});
}
const caveFile='maps/interiors/cave-sites.json', caves=read(caveFile);
Object.assign(caves,{description:'Expedition and reconnaissance interiors, entrances and guardian rewards.',sites:w.locations.filter(l=>l.type==='cave'),dungeons:C.dungeons,reconnaissance:C.reconCampaign.sites});
write(caveFile,caves);
write('data/recon-operations.json',C.reconCampaign);
