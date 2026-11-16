import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../..',import.meta.url));
const output=fs.mkdtempSync(path.join(os.tmpdir(),'bannerlands-build-'));
try{
  execFileSync(process.execPath,['source/build-standalone.mjs',output],{cwd:root,stdio:'pipe'});
  const html=fs.readFileSync(path.join(output,'Bannerlands.html'),'utf8');
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'The standalone game includes its executable module.');
  assert.doesNotMatch(script,/^import\s/m,'The offline build cannot import external modules.');
  for(const name of ['equipmentFor','poseForUnit','formationLayout','placeFormation'])assert.ok(script.includes(name),`${name} belongs in the offline game.`);
  const file=path.join(output,'compiled.mjs');fs.writeFileSync(file,script);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  assert.doesNotMatch(html,/<link[^>]+href="(?:style|hud)\.css"/);
  assert.match(html,/data:image\/png;base64,/);
  console.log('PASS Standalone build embeds the equipment, complete-frame renderer, formations and artwork without syntax collisions.');
}finally{fs.rmSync(output,{recursive:true,force:true});}
