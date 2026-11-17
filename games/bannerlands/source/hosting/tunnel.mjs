import {spawn} from 'node:child_process';

// Quick Tunnels are temporary test connections. The application owns exactly
// this child handle; stopping a match never kills unrelated cloudflared tasks.
export class TemporaryTunnel {
  constructor({executable,spawnProcess=spawn,fetchPublic=fetch,timeoutMs=90000,probeTimeoutMs=75000,onStatus=()=>{}}={}){
    this.executable=executable;this.spawnProcess=spawnProcess;this.fetchPublic=fetchPublic;this.timeoutMs=timeoutMs;this.probeTimeoutMs=probeTimeoutMs;this.onStatus=onStatus;this.child=null;this.publicUrl=null;this.current={stage:'idle',message:'Ready to host.'};this.startPromise=null;this.stopping=false;
  }
  status(){return {...this.current,publicUrl:this.publicUrl,candidateUrl:this.candidateUrl||null};}
  report(stage,message){this.current={stage,message};this.onStatus(this.status());}
  async start(localUrl,expectedId=null){
    if(this.publicUrl&&this.child)return this.publicUrl;if(this.startPromise)return this.startPromise;
    this.startPromise=this.open(localUrl,expectedId).finally(()=>{this.startPromise=null;});return this.startPromise;
  }
  async open(localUrl,expectedId){
    if(!this.executable)throw new Error('The bundled internet connection component is missing. Reinstall Bannerlands.');
    const origin=new URL(localUrl);if(origin.hostname!=='127.0.0.1'||origin.protocol!=='http:')throw new Error('The match must listen on the private local game service.');
    const startupDeadline=Date.now()+this.timeoutMs;
    this.stopping=false;this.publicUrl=null;this.candidateUrl=null;this.report('connecting','Starting the temporary internet connection…');
    const child=this.child=this.spawnProcess(this.executable,['tunnel','--url',origin.origin,'--no-autoupdate','--protocol','http2'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let pending='',settled=false,timer;
    const address=await new Promise((resolve,reject)=>{
      const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
      const output=chunk=>{pending=(pending+chunk.toString()).slice(-32768);const match=pending.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);if(match)finish(null,match[0]);};
      child.stdout?.on('data',output);child.stderr?.on('data',output);
      child.once('error',()=>finish(new Error('The connection component could not start. Reinstall Bannerlands or check antivirus quarantine.')));
      child.once('exit',(code)=>{if(this.child===child)this.child=null;if(!this.stopping){this.publicUrl=null;this.report('failed','The temporary connection stopped. Retry hosting to create a new invitation.');}finish(new Error('The temporary connection stopped before it was ready (exit '+code+'). Check internet access and try again.'));});
      timer=setTimeout(()=>finish(new Error('The internet connection did not become ready within '+Math.ceil(this.timeoutMs/1000)+' seconds. Check your connection, firewall, or VPN, then retry.')),this.timeoutMs);timer.unref?.();
    }).catch(async error=>{await this.stop();this.report('failed',error.message);throw error;});
    this.candidateUrl=address;this.report('verifying','Checking that players can reach the match…');
    try{
      // Quick Tunnel DNS can take a moment to propagate. Every individual
      // request and the whole startup are bounded; no endless progress screen.
      const deadline=Math.min(startupDeadline,Date.now()+this.probeTimeoutMs);let verified=false,lastProblem='no successful response';
      while(Date.now()<deadline&&!verified){
        try{const response=await this.fetchPublic(address+'/api/lobby',{signal:AbortSignal.timeout(Math.max(1,Math.min(3500,deadline-Date.now()))),headers:{'Accept':'application/json'}});lastProblem='HTTP '+response.status;const payload=await response.json();verified=response.ok&&payload.ok===true&&typeof payload.lobby?.id==='string'&&(!expectedId||payload.lobby.id===expectedId);if(response.ok&&!verified)lastProblem='the expected match was not returned';}catch(error){lastProblem=error.cause?.code||error.code||(error.name==='TimeoutError'?'connection timed out':'public connection failed');}
        if(!verified&&lastProblem==='ENOTFOUND'&&!this.current.message.includes('activate'))this.report('verifying','Waiting for the public address to activate. Keep this laptop connected; hosting will stop automatically if verification fails.');
        if(!verified&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,Math.min(300,deadline-Date.now())));
      }
      if(!verified)throw new Error('The connection started, but the match could not be reached ('+lastProblem+'). Retry hosting; check whether your network blocks temporary tunnels.');
      if(this.child!==child)throw new Error('The temporary connection closed during verification. Retry hosting.');
      this.publicUrl=address;this.report('ready','Match reachable. Keep this laptop awake and connected.');return address;
    }catch(error){await this.stop();this.report('failed',error.message);throw error;}
  }
  async stop(){
    this.stopping=true;const child=this.child;this.child=null;this.publicUrl=null;
    if(child&&child.exitCode===null){await new Promise(resolve=>{const timeout=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}resolve();},2000);timeout.unref?.();child.once('exit',()=>{clearTimeout(timeout);resolve();});try{child.kill();}catch{clearTimeout(timeout);resolve();}});}
    this.report('idle','Hosting connection closed.');
  }
}
