import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {TemporaryTunnel} from '../hosting/tunnel.mjs';

class Child extends EventEmitter{
  constructor(){super();this.stdout=new PassThrough();this.stderr=new PassThrough();this.exitCode=null;this.killed=0;}
  kill(){this.killed++;this.exitCode=0;setImmediate(()=>this.emit('exit',0));return true;}
}
const success=async()=>({ok:true,json:async()=>({ok:true,lobby:{id:'expected-match'}})});
function fixture({output=true,fetchPublic=success,...options}={}){
  const children=[],calls=[];
  const tunnel=new TemporaryTunnel({executable:'bundled-cloudflared.exe',fetchPublic,timeoutMs:100,probeTimeoutMs:30,spawnProcess:(...args)=>{calls.push(args);const child=new Child();children.push(child);if(output)setImmediate(()=>child.stderr.write('Temporary connection https://quiet-castle.trycloudflare.com is ready\n'));return child;},...options});
  return {tunnel,children,calls};
}
test('connection is verified before ready and one owned child is stopped',async()=>{
  const f=fixture();const address=await f.tunnel.start('http://127.0.0.1:4174','expected-match');assert.equal(address,'https://quiet-castle.trycloudflare.com');assert.equal(f.tunnel.status().stage,'ready');
  assert.equal(f.calls[0][2].windowsHide,true);assert.equal(f.calls[0][1].includes('--no-autoupdate'),true);
  await f.tunnel.stop();assert.equal(f.children[0].killed,1);assert.equal(f.tunnel.status().stage,'idle');assert.equal(f.tunnel.publicUrl,null);
});
test('simultaneous host clicks start only one connection',async()=>{
  const f=fixture();const addresses=await Promise.all([f.tunnel.start('http://127.0.0.1:4174'),f.tunnel.start('http://127.0.0.1:4174')]);assert.equal(f.children.length,1);assert.equal(addresses[0],addresses[1]);await f.tunnel.stop();
});
test('unreachable or wrong match address fails with recovery guidance and cleanup',async()=>{
  const f=fixture({fetchPublic:async()=>({ok:true,json:async()=>({ok:true,lobby:{id:'wrong-match'}})})});await assert.rejects(f.tunnel.start('http://127.0.0.1:4174','expected-match'),/could not be reached/);assert.equal(f.children[0].killed,1);assert.equal(f.tunnel.status().stage,'failed');
});
test('address discovery and startup failures are bounded',async()=>{
  const f=fixture({output:false,timeoutMs:10});const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(f.tunnel.start('http://127.0.0.1:4174'),/did not become ready/);assert.equal(f.children[0].killed,1);}finally{clearTimeout(keepAlive);}
  const g=fixture({output:false});const result=g.tunnel.start('http://127.0.0.1:4174');setImmediate(()=>g.children[0].emit('error',new Error('missing executable')));await assert.rejects(result,/could not start/);assert.equal(g.children[0].killed,1);
});
test('exited tunnel is marked failed; external network origins cannot be exposed',async()=>{
  const f=fixture();await assert.rejects(f.tunnel.start('https://example.com'),/private local/);assert.equal(f.children.length,0);await f.tunnel.start('http://127.0.0.1:4174');f.children[0].exitCode=1;f.children[0].emit('exit',1);assert.equal(f.tunnel.status().stage,'failed');assert.equal(f.tunnel.publicUrl,null);assert.equal(f.children[0].killed,0);
});
