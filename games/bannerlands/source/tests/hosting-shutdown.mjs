import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';

const index=process.argv.indexOf('--work');if(index<0)throw new Error('Provide an isolated --work folder.');
const work=path.resolve(process.argv[index+1]),installed=path.join(work,'installed'),data=path.join(work,'data'),root=fileURLToPath(new URL('../../',import.meta.url));
await fs.mkdir(path.join(installed,'runtime'),{recursive:true});await fs.copyFile(process.execPath,path.join(installed,'runtime','node.exe'));await fs.mkdir(path.join(installed,'game','source'),{recursive:true});
for(const entry of await fs.readdir(root,{withFileTypes:true}))if(entry.isFile()&&/\.(js|html|css)$/.test(entry.name))await fs.copyFile(path.join(root,entry.name),path.join(installed,'game',entry.name));
for(const relative of ['multiplayer','source/hosting','source/desktop'])await fs.cp(path.join(root,relative),path.join(installed,'game',relative),{recursive:true});
await fs.copyFile(path.join(root,'source','multiplayer-server.mjs'),path.join(installed,'game','source','multiplayer-server.mjs'));await fs.copyFile(path.join(root,'source','desktop','uninstall.ps1'),path.join(installed,'Uninstall Bannerlands.ps1'));
await fs.writeFile(path.join(installed,'game','package.json'),'{"type":"module"}');await fs.writeFile(path.join(installed,'build-manifest.json'),'{"version":"shutdown-test-fixture"}');await fs.writeFile(path.join(installed,'installation.json'),JSON.stringify({installRoot:installed,desktopShortcut:path.join(work,'desktop','Bannerlands.lnk'),startMenu:path.join(work,'menu'),registry:false}));
let child,unrelated;
try{
  child=spawn(path.join(installed,'runtime','node.exe'),[path.join(installed,'game','source','desktop','launcher.mjs'),'--no-open','--data-dir',data],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',error='';child.stderr.on('data',chunk=>error+=chunk.toString());
  const bootstrap=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture launcher did not start: '+error)),10000);child.stdout.on('data',chunk=>{output+=chunk.toString();const line=output.split('\n').find(line=>line.startsWith('{'));if(line){clearTimeout(timer);resolve(JSON.parse(line));}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Fixture exited '+code+': '+error));});});
  assert.equal((await fetch(bootstrap.url+'/')).status,200);assert.equal((await fetch(bootstrap.url+'/api/desktop/shutdown',{method:'POST'})).status,401);
  unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
  await fs.writeFile(path.join(data,'sessions','foreign.json'),JSON.stringify({installationRoot:path.join(work,'foreign-installation'),nodePath:process.execPath,pid:unrelated.pid,origin:'http://127.0.0.1:1',desktopCapability:'x'.repeat(43)}));await fs.writeFile(path.join(data,'personal-settings.json'),'preserved');
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(installed,'Uninstall Bannerlands.ps1'),'-Quiet','-SessionDirectory',path.join(data,'sessions')],{windowsHide:true,encoding:'utf8',maxBuffer:1024*1024});assert.equal(result.status,0,result.stderr||result.stdout);
  if(child.exitCode===null)await once(child,'exit');assert.equal(child.exitCode,0);assert.equal(unrelated.exitCode,null);await assert.rejects(fs.access(installed));await fs.access(path.join(data,'sessions','foreign.json'));await fs.access(path.join(data,'personal-settings.json'));
  const report={testedAt:new Date().toISOString(),gracefulOwnedServiceShutdown:true,privateCapabilityRequired:true,installedFilesRemoved:true,unrelatedProcessPreserved:true,foreignSessionRecordPreserved:true,personalDataPreserved:true};await fs.writeFile(path.join(work,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(child?.exitCode===null)child.kill();if(unrelated?.exitCode===null)unrelated.kill();}
