import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {GAME_VERSION,ASSET_VERSION,PROTOCOL_VERSION} from '../multiplayer/protocol.js';

const gameRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),option=name=>{const i=args.indexOf('--'+name);return i<0?null:args[i+1];};
const output=path.resolve(option('output')||path.join(gameRoot,'source','outputs','windows'));
const buildRoot=path.join(output,'installer-source'),packageRoot=path.join(buildRoot,'Bannerlands');
const nodeBinary=path.resolve(option('node')||process.execPath),cloudflared=option('cloudflared'),dependencyLicenses=option('cloudflared-licenses');
if(process.platform!=='win32')throw new Error('The Windows package builder must run on Windows.');
if(!cloudflared)throw new Error('Provide --cloudflared <verified Windows amd64 executable>.');
if(!dependencyLicenses)throw new Error('Provide --cloudflared-licenses <collected dependency notices directory>.');
const components=JSON.parse((await fs.readFile(path.join(gameRoot,'source','hosting','licenses','components.json'),'utf8')).replace(/^\uFEFF/,''));
for(const [file,expected]of [[nodeBinary,components.nodeSHA256],[path.resolve(cloudflared),components.cloudflaredSHA256]]){
  const digest=createHash('sha256').update(await fs.readFile(file)).digest('hex');if(digest!==expected)throw new Error('The hosting component does not match its pinned official release checksum: '+path.basename(file));
}
await fs.mkdir(output,{recursive:true});
const actualOutput=await fs.realpath(output);
try{
  const actualBuild=await fs.realpath(buildRoot);
  if(!actualBuild.startsWith(actualOutput+path.sep)||path.basename(actualBuild)!=='installer-source')throw new Error('The installer staging directory resolves outside the requested output folder.');
  await fs.rm(actualBuild,{recursive:true,force:true});
}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.mkdir(packageRoot,{recursive:true});
const copy=async(source,target)=>{
  const stat=await fs.stat(source);
  if(stat.isDirectory()){await fs.mkdir(target,{recursive:true});for(const entry of await fs.readdir(source))await copy(path.join(source,entry),path.join(target,entry));}
  else {await fs.mkdir(path.dirname(target),{recursive:true});await fs.chmod(target,0o666).catch(()=>{});await fs.copyFile(source,target);await fs.chmod(target,0o644);}
};
await copy(nodeBinary,path.join(packageRoot,'runtime','node.exe'));await copy(path.resolve(cloudflared),path.join(packageRoot,'runtime','cloudflared.exe'));
for(const entry of await fs.readdir(gameRoot,{withFileTypes:true}))if(entry.isFile()&&/\.(js|css|html)$/.test(entry.name))await copy(path.join(gameRoot,entry.name),path.join(packageRoot,'game',entry.name));
await copy(path.join(gameRoot,'assets'),path.join(packageRoot,'game','assets'));
await copy(path.join(gameRoot,'multiplayer'),path.join(packageRoot,'game','multiplayer'));
for(const relative of ['multiplayer-server.mjs','hosting','desktop'])await copy(path.join(gameRoot,'source',relative),path.join(packageRoot,'game','source',relative));
await fs.writeFile(path.join(packageRoot,'game','package.json'),JSON.stringify({name:'bannerlands',private:true,type:'module',version:GAME_VERSION},null,2));
await copy(path.join(gameRoot,'source','hosting','licenses'),path.join(packageRoot,'notices'));
await copy(path.resolve(dependencyLicenses),path.join(packageRoot,'notices','cloudflared-dependencies'));
await fs.writeFile(path.join(packageRoot,'Launch Bannerlands.vbs'),`Option Explicit\nDim shell, fso, root, command\nSet shell = CreateObject("WScript.Shell")\nSet fso = CreateObject("Scripting.FileSystemObject")\nroot = fso.GetParentFolderName(WScript.ScriptFullName)\ncommand = Chr(34) & root & "\\runtime\\node.exe" & Chr(34) & " " & Chr(34) & root & "\\game\\source\\desktop\\launcher.mjs" & Chr(34)\nshell.CurrentDirectory = root\nshell.Run command, 0, False\n`);
await copy(path.join(gameRoot,'source','desktop','uninstall.ps1'),path.join(packageRoot,'Uninstall Bannerlands.ps1'));
await fs.writeFile(path.join(packageRoot,'README.txt'),`Bannerlands Multiplayer Preview ${GAME_VERSION}\r\n\r\nOpen Launch Bannerlands.vbs, or install using Bannerlands-Setup.exe. The installer creates a desktop icon and Start menu shortcuts. Hosting runs in your default browser, backed by the bundled local game server and connection software. No separate Node installation or terminal is required. Only the downloaded application can create lobbies; the browser edition can browse and join them. Windows x64 hosting; current Chrome and Edge browser guests are the initial test targets.\r\n\r\nKeep the hosting laptop awake and online. Guests can reconnect to their original private session; the battle continues during guest disconnections. A lost host ends the match. No host migration or authoritative save/resume is included in this preview. Single-player remains available without internet.\r\n\r\nTemporary Cloudflare Quick Tunnels are for testing/development, with no uptime guarantee and changing addresses. Production hosting needs a separately evaluated connection arrangement. https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/\r\n\r\nUpdates: close Bannerlands and run the newer installer. Only exact game/asset versions can join a match. Personal browser storage is retained by uninstall. This preview installer is unsigned; no supported performance or cross-location completion claim is made until the published test matrix is complete.\r\n\r\nNode.js, cloudflared and dependency license notices are included in notices/. The trusted host can modify its simulation; this design does not prevent host cheating.\r\n`);
await fs.writeFile(path.join(packageRoot,'START-HERE.txt'),`BANNERLANDS MULTIPLAYER PREVIEW\r\n\r\nInstall: run Bannerlands-Setup.exe from the download. The installer creates a Bannerlands desktop icon and Start menu entry. Open that icon to play. For the portable ZIP, extract the entire Bannerlands folder first, then double-click Launch Bannerlands.vbs.\r\n\r\nInitial test targets: Windows 11 x64 hosting with current Chrome or Edge; friends join in a compatible browser without installing Bannerlands. The local server, Node runtime, connection component and complete painted artwork are bundled. Only the downloaded application creates lobbies; the browser edition joins them.\r\n\r\nChoose one to four human slots. Other participating houses are bots, with up to sixteen total houses where the selected mode allows. Every configured human seat must be filled and ready before starting. Performance limits depend on map, army size and hardware; this is a preview and does not promise universal 60 FPS.\r\n\r\nKeep the host laptop awake and connected. The battle continues while a guest is disconnected, and that guest can recover its original private session in the same browser. Losing the host ends the match; automatic host migration and authoritative save/resume are not implemented. Single-player remains available offline.\r\n\r\nYour guest invitation is separate from private hosting controls. Temporary Cloudflare addresses change after reconnecting. Quick Tunnels have no uptime guarantee and are intended for testing/development: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/\r\n\r\nUpdates are manual: verify the newer download against its published SHA-256 file, close Bannerlands, and run the newer installer. Exact game and artwork versions must match. Uninstall keeps personal settings and browser data and local hosting logs.\r\n`);
const iconScript=path.join(buildRoot,'make-icon.ps1');
await fs.writeFile(iconScript,`param([string]$Source,[string]$Output)\nAdd-Type -AssemblyName System.Drawing\n$sourceImage=[Drawing.Image]::FromFile($Source)\n$iconImage=New-Object Drawing.Bitmap 256,256\n$graphics=[Drawing.Graphics]::FromImage($iconImage)\n$graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic\n$graphics.DrawImage($sourceImage,(New-Object Drawing.Rectangle 0,0,256,256),(New-Object Drawing.Rectangle 0,0,313,313),[Drawing.GraphicsUnit]::Pixel)\n$stream=New-Object IO.MemoryStream\n$iconImage.Save($stream,[Drawing.Imaging.ImageFormat]::Png)\n$bytes=$stream.ToArray()\n$outputStream=[IO.File]::Create($Output)\n$writer=New-Object IO.BinaryWriter $outputStream\n$writer.Write([UInt16]0);$writer.Write([UInt16]1);$writer.Write([UInt16]1)\n$writer.Write([Byte]0);$writer.Write([Byte]0);$writer.Write([Byte]0);$writer.Write([Byte]0)\n$writer.Write([UInt16]1);$writer.Write([UInt16]32);$writer.Write([UInt32]$bytes.Length);$writer.Write([UInt32]22);$writer.Write($bytes)\n$writer.Dispose();$stream.Dispose();$graphics.Dispose();$iconImage.Dispose();$sourceImage.Dispose()\n`);
function run(executable,parameters){const result=spawnSync(executable,parameters,{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});if(result.status!==0)throw new Error(result.stderr||result.stdout||'Windows packaging failed.');return result.stdout;}
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',iconScript,'-Source',path.join(gameRoot,'assets','house-emblems.png'),'-Output',path.join(packageRoot,'Bannerlands.ico')]);
await copy(path.join(packageRoot,'Bannerlands.ico'),path.join(gameRoot,'assets','bannerlands.ico'));
await copy(path.join(packageRoot,'Bannerlands.ico'),path.join(packageRoot,'game','assets','bannerlands.ico'));
const files=[];
async function inspect(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name);if(entry.isDirectory())await inspect(absolute);else if(entry.name!=='build-manifest.json'){const data=await fs.readFile(absolute);files.push({path:path.relative(packageRoot,absolute).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}}}
await inspect(packageRoot);const manifest={version:GAME_VERSION,assetVersion:ASSET_VERSION,protocolVersion:PROTOCOL_VERSION,sourceCommit:option('source-commit'),platform:'windows-x64',createdAt:new Date().toISOString(),runtime:run(nodeBinary,['--version']).trim(),cloudflared:run(path.resolve(cloudflared),['--version']).trim(),files};
await fs.writeFile(path.join(packageRoot,'build-manifest.json'),JSON.stringify(manifest,null,2));
await copy(path.join(gameRoot,'source','desktop','install.ps1'),path.join(buildRoot,'install.ps1'));
await fs.writeFile(path.join(buildRoot,'install.vbs'),`Option Explicit\nDim shell,fso,root,command,result\nSet shell=CreateObject("WScript.Shell")\nSet fso=CreateObject("Scripting.FileSystemObject")\nroot=fso.GetParentFolderName(WScript.ScriptFullName)\ncommand="powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & root & "\\install.ps1" & Chr(34)\nresult=shell.Run(command,0,True)\nWScript.Quit result\n`);
const zipScript=path.join(buildRoot,'archive.ps1');await fs.writeFile(zipScript,`param([string]$Source,[string]$Output)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\nif(Test-Path -LiteralPath $Output) {Remove-Item -LiteralPath $Output -Force}\n[IO.Compression.ZipFile]::CreateFromDirectory($Source,$Output,[IO.Compression.CompressionLevel]::Optimal,$true)\n`);
const payload=path.join(buildRoot,'payload.zip');run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',zipScript,'-Source',packageRoot,'-Output',payload]);
const portable=path.join(output,'Bannerlands-Windows-x64.zip');await copy(payload,portable);
const installer=path.join(output,'Bannerlands-Setup.exe');
const compiler=path.join(process.env.SystemRoot||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
run(compiler,['/nologo','/target:winexe','/optimize+','/codepage:65001','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/out:'+installer,'/win32icon:'+path.join(packageRoot,'Bannerlands.ico'),'/resource:'+payload+',Bannerlands.payload.zip','/resource:'+path.join(buildRoot,'install.ps1')+',Bannerlands.install.ps1',path.join(gameRoot,'source','desktop','installer.cs')]);
await fs.access(installer);
for(const deliverable of [installer,portable]){const data=await fs.readFile(deliverable);await fs.writeFile(deliverable+'.sha256',createHash('sha256').update(data).digest('hex')+'  '+path.basename(deliverable)+'\n');}
console.log(JSON.stringify({installer,portable,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),manifest:path.join(packageRoot,'build-manifest.json')},null,2));
