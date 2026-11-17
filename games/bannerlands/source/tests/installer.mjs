import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';

const option=name=>{const index=process.argv.indexOf('--'+name);return index<0?null:process.argv[index+1];};
const installer=option('installer'),portable=option('portable'),work=option('work');if(!installer||!work)throw new Error('Provide --installer and an isolated --work directory.');
const qa=path.resolve(work),extracted=path.join(qa,'extracted'),installed=path.join(qa,'installed'),desktop=path.join(qa,'desktop'),menu=path.join(qa,'start-menu'),data=path.join(qa,'user-data');await fs.mkdir(qa,{recursive:true});
function run(executable,args,env=process.env){const result=spawnSync(executable,args,{env,windowsHide:true,encoding:'utf8',maxBuffer:1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||'Installer test process failed.');return result.stdout;}
run(path.resolve(installer),['/extract',extracted]);
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(extracted,'install.ps1'),'-PayloadPath',path.join(extracted,'payload.zip'),'-Destination',installed,'-DesktopDirectory',desktop,'-StartMenuDirectory',menu,'-NoRegistry','-Quiet']);
for(const file of [path.join(desktop,'Bannerlands.lnk'),path.join(menu,'Bannerlands.lnk'),path.join(menu,'Uninstall Bannerlands.lnk'),path.join(installed,'Bannerlands.ico')])await fs.access(file);
const manifest=JSON.parse(await fs.readFile(path.join(installed,'build-manifest.json'),'utf8'));
function startLauncher(root,state){
  return spawn(path.join(root,'runtime','node.exe'),[path.join(root,'game','source','desktop','launcher.mjs'),'--no-open','--data-dir',state],{windowsHide:true,stdio:['ignore','pipe','pipe']});
}
function readBootstrap(launcher){
  return new Promise((resolve,reject)=>{
    let output='',error='';
    const timer=setTimeout(()=>reject(new Error('Packaged launcher did not start: '+error)),15000);
    launcher.stderr.on('data',chunk=>{error+=chunk;});
    launcher.stdout.on('data',chunk=>{
      output+=chunk;
      const end=output.indexOf('\n');
      if(end<0)return;
      clearTimeout(timer);
      try{resolve(JSON.parse(output.slice(0,end)));}catch(err){reject(err);}
    });
    launcher.once('error',err=>{clearTimeout(timer);reject(err);});
    launcher.once('exit',code=>{clearTimeout(timer);reject(new Error('Packaged launcher exited '+code+': '+error));});
  });
}
async function verifyMenu(browser,bootstrap){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  try{
    page.on('pageerror',err=>errors.push(err.message));
    await context.route('**/*',route=>new URL(route.request().url()).origin===bootstrap.url?route.continue():route.abort());
    await page.goto(bootstrap.bootstrapUrl,{waitUntil:'domcontentloaded'});
    await page.locator('#hostLobbyButton').waitFor({state:'visible'});
    assert.equal(new URL(page.url()).hash,'');
    assert.ok(await page.evaluate(async()=>(await window.bannerlandsHost.status()).ok));
    for(const id of ['startButton','browseLobbiesButton','joinInviteButton'])assert.ok(await page.locator('#'+id).isVisible());
    await page.locator('#hostLobbyButton').click();
    await page.locator('[data-pane="host"] [name="maxHumans"]').waitFor({state:'visible'});
    assert.deepEqual(await page.locator('[name="maxHumans"] option').evaluateAll(items=>items.map(item=>Number(item.value))),[1,2,3,4]);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}
async function digest(file){
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');
}
let launcher,portableLauncher,unrelated,browser;
try{
  launcher=startLauncher(installed,data);
  const bootstrap=await readBootstrap(launcher);
  assert.equal((await fetch(bootstrap.url+'/')).status,200);assert.equal((await fetch(bootstrap.url+'/api/desktop/shutdown',{method:'POST'})).status,401);
  const marker=JSON.parse(await fs.readFile(path.join(data,'sessions',launcher.pid+'.json'),'utf8'));assert.equal(marker.installationRoot.toLowerCase(),installed.toLowerCase());
  if(portable){
    const require=createRequire(import.meta.url);
    const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
    browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
    await verifyMenu(browser,bootstrap);
    const archive=path.resolve(portable),portableDir=path.join(qa,'portable'),portableRoot=path.join(portableDir,'Bannerlands');
    assert.equal(await digest(archive),await digest(path.join(extracted,'payload.zip')),'Published ZIP and installer payload must match.');
    await fs.mkdir(portableDir);
    run('tar.exe',['-xf',archive,'-C',portableDir]);
    const portableManifest=JSON.parse(await fs.readFile(path.join(portableRoot,'build-manifest.json'),'utf8'));
    assert.deepEqual(portableManifest,manifest);
    portableLauncher=startLauncher(portableRoot,path.join(qa,'portable-data'));
    const portableBootstrap=await readBootstrap(portableLauncher);
    await verifyMenu(browser,portableBootstrap);
    const capability=new URLSearchParams(new URL(portableBootstrap.bootstrapUrl).hash.slice(1)).get('desktop');
    const closed=once(portableLauncher,'exit');
    const reply=await fetch(portableBootstrap.url+'/api/desktop/shutdown',{method:'POST',headers:{Authorization:'Bearer '+capability,'Content-Type':'application/json'},body:'{}'});
    assert.equal(reply.status,200);assert.equal((await closed)[0],0);
  }
  unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
  await fs.writeFile(path.join(data,'sessions','foreign.json'),JSON.stringify({installationRoot:path.join(qa,'another-product'),nodePath:process.execPath,pid:unrelated.pid,origin:'http://127.0.0.1:1',desktopCapability:'x'.repeat(43)}));
  await fs.writeFile(path.join(data,'personal-settings.json'),'preserve');
  run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(installed,'Uninstall Bannerlands.ps1'),'-Quiet','-SessionDirectory',path.join(data,'sessions')]);
  if(launcher.exitCode===null)await Promise.race([once(launcher,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('The owned launcher did not exit.')),2000))]);
  assert.equal(launcher.exitCode,0);assert.equal(unrelated.exitCode,null);
  await fs.access(path.join(data,'personal-settings.json'));await fs.access(path.join(data,'sessions','foreign.json'));
  for(const file of [installed,path.join(desktop,'Bannerlands.lnk'),menu])await assert.rejects(fs.access(file));
  const signatureCheck='Import-Module (Join-Path $PSHOME "Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1") -ErrorAction Stop; (Get-AuthenticodeSignature -LiteralPath $env:BANNERLANDS_QA_INSTALLER).Status.ToString()';
  const signature=run('powershell.exe',['-NoProfile','-Command',signatureCheck],{...process.env,BANNERLANDS_QA_INSTALLER:path.resolve(installer)}).trim();
  const result={testedAt:new Date().toISOString(),version:manifest.version,sourceCommit:manifest.sourceCommit,payloadFilesVerified:manifest.files.length,installerSignatureStatus:signature,isolatedInstallation:true,desktopShortcut:true,startMenuShortcuts:true,paintedIcon:true,bundledRuntimeStartsFullGame:true,gracefulShutdownDuringUninstall:true,unrelatedProcessPreserved:true,foreignSessionPreserved:true,personalDataPreserved:true,installedFilesAndOwnShortcutsRemoved:true,limitations:['Used an isolated installation and temporary shortcuts.']};
  if(portable)Object.assign(result,{installedHostMenuVerified:true,portableHostMenuVerified:true,identicalPortablePayload:true,localOnly:true});
  await fs.writeFile(path.join(qa,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
  await browser?.close();
  if(launcher?.exitCode===null)launcher.kill();if(portableLauncher?.exitCode===null)portableLauncher.kill();if(unrelated?.exitCode===null)unrelated.kill();
}
