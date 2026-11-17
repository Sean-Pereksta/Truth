'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const file=name=>path.join(root,name);
const read=name=>fs.readFileSync(file(name),'utf8');
const json=name=>JSON.parse(read(name));

const references=[...read('index.html').matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
for(const src of references){
  assert.ok(fs.existsSync(file(src)),src);
  if(src.endsWith('.js'))new vm.Script(read(src),{filename:src});
}
const atlas=json('assets/atlas.json').externalAtlases;
for(const manifest of Object.values(atlas))assert.ok(fs.existsSync(file(manifest)),manifest);
function inBounds(x,y,w,h,width,height,label){
  assert.ok([x,y,w,h,width,height].every(Number.isFinite)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,label);
}
const entrances=json(atlas.dungeonApproaches);
for(const entrance of entrances){
  assert.ok(fs.statSync(file(entrance.path)).size>0,entrance.path);
  inBounds(...entrance.sourceCrop,...entrance.sourceSize,entrance.key);
}
const paintings=json(atlas.reconPaintings);
for(const item of paintings){
  const [x,y,right,bottom]=item.sourceCrop;
  inBounds(x,y,right-x,bottom-y,...item.sourceSize,item.key);
  assert.ok(fs.statSync(file(item.path)).size>0,item.path);
}
const equipment=json(atlas.reconEquipment);
for(const station of equipment.forgeStations.frames)assert.ok(fs.existsSync(file(station.path)),station.path);
const gear=[equipment.weapons,equipment.suits,...Object.values(equipment.suitActions)];
const textures=json(atlas.reconCombat).textures;
for(const sheet of [...gear,...textures]){
  assert.ok(fs.existsSync(file(sheet.path)),sheet.path);
  for(const frame of sheet.frames){
    if(frame.crop)inBounds(...frame.crop,sheet.width,sheet.height,frame.key||sheet.path);
  }
}
console.log('PASS · '+references.length+' local entry references, '+references.filter(src=>src.endsWith('.js')).length+' scripts, '+paintings.length+' paintings, '+entrances.length+' exterior assets and '+(gear.length+textures.length)+' sheet records');
const tests=['tests/render-scale.test.cjs','tests/scenery-visibility.cjs','tests/recon-combat.test.cjs','tests/field-fencer.test.cjs','tools/test-recon-forge.cjs'];
if(process.argv.includes('--browser'))tests.push('tests/recon-campaign.cjs','tests/recon-pad-browser.cjs','tests/portable-saves.cjs','tests/dungeon-approaches.cjs','tests/berlin-loadouts.cjs');
for(const test of tests){
  const result=spawnSync(process.execPath,[file(test)],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
