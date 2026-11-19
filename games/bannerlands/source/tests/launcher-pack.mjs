import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {COMPATIBILITY} from '../../multiplayer/protocol.js';

const pack=process.argv[2];
if(!pack)throw new Error('Pass the staged Bannerlands launcher pack directory.');
const root=path.resolve(pack);
const runtime=path.join(root,'runtime','node.exe');
const launcher=path.join(root,'game','source','desktop','launcher.mjs');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const data=await fs.mkdtemp(path.join(os.tmpdir(),'bannerlands-hub-'));
let child,exited,browser,origin;

async function start(port){
  child=spawn(runtime,[launcher,'--no-open','--data-dir',data,'--port',String(port)],{windowsHide:true,stdio:['ignore','pipe','inherit','ipc']});
  exited=new Promise(resolve=>{
    child.once('exit',resolve);
    child.once('error',resolve);
  });
  const lines=createInterface({input:child.stdout});
  try{
    const firstLine=lines[Symbol.asyncIterator]().next().then(result=>{
      if(result.done)throw new Error('The installed Bannerlands host exited before reporting its address.');
      return JSON.parse(result.value);
    });
    const bootstrap=await Promise.race([firstLine,delay(15000,undefined,{ref:false}).then(()=>{
      throw new Error('The installed Bannerlands host took too long to start.');
    })]);
    origin=bootstrap.url;
    const local=new URL(bootstrap.bootstrapUrl);
    assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(local.origin,origin);
    assert.ok(new URLSearchParams(local.hash.slice(1)).get('desktop'));
    return local;
  }finally{lines.close();}
}

async function expectShutdown(){
  assert.equal(await Promise.race([exited,delay(10000,undefined,{ref:false})]),0);
  await assert.rejects(fetch(origin+'/api/lobby',{signal:AbortSignal.timeout(5000)}));
  assert.deepEqual(await fs.readdir(path.join(data,'sessions')),[]);
}

try{
  const local=await start(0);
  const response=await fetch(origin+'/api/lobby');
  assert.equal(response.status,200);
  const {lobby}=await response.json();
  for(const [key,value] of Object.entries(COMPATIBILITY))assert.equal(lobby[key],value);
  assert.equal((await fetch(origin+'/api/desktop/status')).status,401);

  browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
  const host=await browser.newPage({viewport:{width:1440,height:960}});
  local.searchParams.set('host','1');
  await host.goto(local.href);
  await host.locator('[data-pane="host"] button[type="submit"]').waitFor({timeout:120000});
  const bridge=await host.evaluate(async()=>({
    stage:(await window.bannerlandsHost.status()).stage,
    privateFragmentRemoved:!location.hash.includes('desktop=')
  }));
  assert.deepEqual(bridge,{stage:'idle',privateFragmentRemoved:true});
  assert.ok(await host.locator('[data-pane="host"] button[type="submit"]').isEnabled());
  assert.equal(await host.locator('.online-download').isVisible(),false);

  const guest=await browser.newPage({viewport:{width:1440,height:960}});
  await guest.goto(origin);
  await guest.waitForFunction(()=>window.__bannerlands,undefined,{timeout:120000});
  assert.equal(await guest.evaluate(()=>!!window.bannerlandsHost),false);
  await guest.locator('#hostLobbyButton').click();
  await guest.locator('[data-pane="host-required"]').waitFor();

  child.send({type:'stop'});
  await expectShutdown();
  const restarted=await start(Number(local.port));
  assert.equal(restarted.origin,local.origin);
  child.disconnect();
  await expectShutdown();
  console.log('Installed Bannerlands pack serves the current game, opens local hosting, and shuts down with its launcher.');
}finally{
  await browser?.close().catch(()=>{});
  if(child&&child.exitCode===null){
    if(child.connected)child.disconnect();
    if(await Promise.race([exited,delay(3000,undefined,{ref:false})])===undefined)child.kill();
    await exited;
  }
  await fs.rm(data,{recursive:true,force:true});
}
