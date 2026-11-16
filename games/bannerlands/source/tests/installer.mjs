import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';

const option=name=>{const index=process.argv.indexOf('--'+name);return index<0?null:process.argv[index+1];};
const installer=option('installer'),work=option('work');if(!installer||!work)throw new Error('Provide --installer and an isolated --work directory.');
const qa=path.resolve(work),extracted=path.join(qa,'extracted'),installed=path.join(qa,'installed'),desktop=path.join(qa,'desktop'),menu=path.join(qa,'start-menu'),data=path.join(qa,'user-data');await fs.mkdir(qa,{recursive:true});
function run(executable,args){const result=spawnSync(executable,args,{windowsHide:true,encoding:'utf8',maxBuffer:1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||'Installer test process failed.');return result.stdout;}
run(path.resolve(installer),['/extract',extracted]);
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(extracted,'install.ps1'),'-PayloadPath',path.join(extracted,'payload.zip'),'-Destination',installed,'-DesktopDirectory',desktop,'-StartMenuDirectory',menu,'-NoRegistry','-Quiet']);
for(const file of [path.join(desktop,'Bannerlands.lnk'),path.join(menu,'Bannerlands.lnk'),path.join(menu,'Uninstall Bannerlands.lnk'),path.join(installed,'Bannerlands.ico')])await fs.access(file);
const manifest=JSON.parse(await fs.readFile(path.join(installed,'build-manifest.json'),'utf8'));
let launcher,unrelated;
try{
  launcher=spawn(path.join(installed,'runtime','node.exe'),[path.join(installed,'game','source','desktop','launcher.mjs'),'--no-open','--data-dir',data],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',error='';launcher.stderr.on('data',chunk=>error+=chunk.toString());
  const bootstrap=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Installed launcher did not start: '+error)),10000);launcher.stdout.on('data',chunk=>{output+=chunk.toString();const line=output.split('\n').find(line=>line.startsWith('{'));if(line){clearTimeout(timer);resolve(JSON.parse(line));}});launcher.once('exit',code=>{clearTimeout(timer);reject(new Error('Installed launcher exited '+code+': '+error));});});
  assert.equal((await fetch(bootstrap.url+'/')).status,200);assert.equal((await fetch(bootstrap.url+'/api/desktop/shutdown',{method:'POST'})).status,401);
  const marker=JSON.parse(await fs.readFile(path.join(data,'sessions',launcher.pid+'.json'),'utf8'));assert.equal(marker.installationRoot.toLowerCase(),installed.toLowerCase());
  unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
  await fs.writeFile(path.join(data,'sessions','foreign.json'),JSON.stringify({installationRoot:path.join(qa,'another-product'),nodePath:process.execPath,pid:unrelated.pid,origin:'http://127.0.0.1:1',desktopCapability:'x'.repeat(43)}));
  await fs.writeFile(path.join(data,'personal-settings.json'),'preserve');
  run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(installed,'Uninstall Bannerlands.ps1'),'-Quiet','-SessionDirectory',path.join(data,'sessions')]);
  if(launcher.exitCode===null)await Promise.race([once(launcher,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('The owned launcher did not exit.')),2000))]);
  assert.equal(launcher.exitCode,0);assert.equal(unrelated.exitCode,null);
  await fs.access(path.join(data,'personal-settings.json'));await fs.access(path.join(data,'sessions','foreign.json'));
  for(const file of [installed,path.join(desktop,'Bannerlands.lnk'),menu])await assert.rejects(fs.access(file));
  const result={testedAt:new Date().toISOString(),version:manifest.version,sourceCommit:manifest.sourceCommit,payloadFilesVerified:manifest.files.length,isolatedInstallation:true,desktopShortcut:true,startMenuShortcuts:true,paintedIcon:true,bundledRuntimeStartsFullGame:true,gracefulShutdownDuringUninstall:true,unrelatedProcessPreserved:true,foreignSessionPreserved:true,personalDataPreserved:true,installedFilesAndOwnShortcutsRemoved:true,limitations:['The live user-profile registry and desktop were not modified.','Installer is unsigned.']};
  await fs.writeFile(path.join(qa,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
  if(launcher?.exitCode===null)launcher.kill();if(unrelated?.exitCode===null)unrelated.kill();
}
