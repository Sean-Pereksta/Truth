import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createMatchServer} from '../multiplayer-server.mjs';
import {TemporaryTunnel} from '../hosting/tunnel.mjs';
import {createHostDirectoryPublisher} from '../hosting/firebase-directory.mjs';
import {createDesktopActivity} from '../hosting/activity.mjs';

const installedRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const argument=name=>{const i=process.argv.indexOf('--'+name);return i<0?null:process.argv[i+1];};
const port=argument('port')??(process.argv.includes('--port')?'':'0');
if(!/^\d{1,5}$/.test(port)||Number(port)>65535)throw new Error('Choose a local port from 0 through 65535.');
const stateDirectory=argument('data-dir')?path.resolve(argument('data-dir')):path.join(process.env.LOCALAPPDATA||process.env.TEMP||installedRoot,'Bannerlands');
await fs.mkdir(stateDirectory,{recursive:true});
const sessionDirectory=path.join(stateDirectory,'sessions');await fs.mkdir(sessionDirectory,{recursive:true});
const sessionFile=path.join(sessionDirectory,process.pid+'.json');
const logFile=path.join(stateDirectory,'hosting.log');
const log=message=>fs.appendFile(logFile,new Date().toISOString()+' '+message+'\n').catch(()=>{});
const capability=randomBytes(32).toString('base64url');let match,idle=null,stopping=false;
const activity=createDesktopActivity();
const tunnel=new TemporaryTunnel({executable:argument('cloudflared')||path.join(installedRoot,'runtime','cloudflared.exe'),onStatus:status=>{log(status.stage+': '+status.message+(status.candidateUrl?' '+status.candidateUrl:''));if(status.stage==='failed')match?.setReachable(false);}});
const desktop={secret:capability,touch:()=>activity.touch(),status:()=>tunnel.status(),async host(instance){
  const publicUrl=await tunnel.start(instance.url,instance.getLobby().id);await instance.setPublicAddress(publicUrl);
  return {url:instance.url,publicUrl,hostToken:instance.hostToken,invite:instance.invite,inviteUrl:publicUrl+'/#invite='+encodeURIComponent(instance.invite)};
},async stop(instance){await tunnel.stop();await instance.setReachable(false);},shutdown:()=>shutdown()};
try{
  match=await createMatchServer({desktop,port:Number(port),publisher:createHostDirectoryPublisher(),config:{enemies:3},lobby:{public:false,maxHumans:2}});
  await fs.writeFile(sessionFile,JSON.stringify({protocol:1,installationRoot:installedRoot,nodePath:process.execPath,origin:match.url,desktopCapability:capability,pid:process.pid,createdAt:new Date().toISOString()}),{mode:0o600});
  await log('Bannerlands '+match.url+' started.');
}catch(error){await log('Startup failed: '+error.message);throw error;}
// An explicit Stop Hosting closes only the tunnel. Closing the browser stops
// the local service after a grace period, while browser refresh stays safe.
idle=setInterval(async()=>{
  if(activity.expired())await shutdown();
},15000);idle.unref();
async function shutdown(){if(stopping)return;stopping=true;clearInterval(idle);await match?.close();await fs.unlink(sessionFile).catch(()=>{});process.exit(0);}
if(typeof process.send==='function'){
  process.on('message',message=>{if(message?.type==='stop')void shutdown();});
  process.once('disconnect',shutdown);
  if(!process.connected)await shutdown();
}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);process.once('uncaughtException',async error=>{await log('Fatal error: '+error.message);await shutdown();});
const url=match.url+'/#desktop='+capability;
if(process.platform==='win32'&&!process.argv.includes('--no-open'))spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'}).unref();
else console.log(JSON.stringify({url:match.url,bootstrapUrl:url}));
