import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {GAME_VERSION,ASSET_VERSION,PROTOCOL_VERSION} from '../multiplayer/protocol.js';

// Build one review set. Extract the browser ZIP beside the three downloads
// to serve the browser edition and its matching download page together.
const root=fileURLToPath(new URL('../',import.meta.url));
const option=name=>{const index=process.argv.indexOf('--'+name);return index<0?null:process.argv[index+1];};
if(!option('output')||!option('cloudflared'))throw new Error('Supply --output <directory> and --cloudflared <pinned Windows executable>.');
const output=path.resolve(option('output')),temp=await fs.mkdtemp(path.join(os.tmpdir(),'bannerlands-build-'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const manifest={version:GAME_VERSION,assetVersion:ASSET_VERSION,protocolVersion:PROTOCOL_VERSION,sourceCommit:commit,files:[]};
const run=(program,args,cwd=root)=>execFileSync(program,args,{cwd,windowsHide:true,stdio:'inherit'});
async function record(name){
  const file=path.join(output,name),hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  manifest.files.push({path:name,sha256:hash.digest('hex'),bytes:(await fs.stat(file)).size});
}
async function writeManifest(directory){
  await fs.writeFile(path.join(directory,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
try{
  await fs.mkdir(output,{recursive:true});
  const windows=path.join(temp,'windows'),standalone=path.join(temp,'offline'),web=path.join(temp,'browser');
  run(process.execPath,['source/build-host.mjs','--output',windows,'--node',option('node')||process.execPath,
    '--cloudflared',path.resolve(option('cloudflared')),'--cloudflared-licenses',path.join(root,'source/hosting/licenses/cloudflared-dependencies'),'--source-commit',commit]);
  run(process.execPath,['source/build-standalone.mjs',standalone]);
  for(const [directory,name] of [[windows,'Bannerlands-Setup.exe'],[windows,'Bannerlands-Windows-x64.zip'],[standalone,'Bannerlands.html']]){
    await fs.copyFile(path.join(directory,name),path.join(output,name));await record(name);
  }
  await fs.mkdir(web);
  const game=path.join(windows,'installer-source','Bannerlands','game');
  for(const entry of await fs.readdir(game,{withFileTypes:true})){
    if((entry.isFile()&&/\.(html|css|js)$/.test(entry.name))||['assets','multiplayer'].includes(entry.name))
      await fs.cp(path.join(game,entry.name),path.join(web,entry.name),{recursive:true});
  }
  await writeManifest(web);
  run('tar.exe',['-a','-cf',path.join(output,'Bannerlands-browser.zip'),'.'],web);
  await record('Bannerlands-browser.zip');
  await writeManifest(output);
  await fs.writeFile(path.join(output,'SHA256SUMS.txt'),manifest.files.map(file=>file.sha256+'  '+file.path).join('\n')+'\n');
}finally{
  await fs.rm(temp,{recursive:true,force:true});
}
