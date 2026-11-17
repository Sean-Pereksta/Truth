// This bridge is present only in the installed launcher. The private launcher
// capability is local to its origin and never appears in a guest invitation.
export function initializeDesktopBridge(){
  if(window.bannerlandsHost||!/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin))return;
  const fragment=new URLSearchParams(location.hash.slice(1)),key='bannerlands.desktop';
  let capability=fragment.get('desktop');
  if(capability){sessionStorage.setItem(key,capability);fragment.delete('desktop');history.replaceState(null,'',location.pathname+location.search+(fragment.size?'#'+fragment:''));}
  else capability=sessionStorage.getItem(key);
  if(!capability)return;
  const request=async(path,body)=>{
    const response=await fetch('/api/desktop/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+capability,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'The hosting service could not complete this action.');return result;
  };
  Object.defineProperty(window,'bannerlandsHost',{value:Object.freeze({host:(config,lobby)=>request('host',{config,lobby}),stop:()=>request('stop',{}),status:()=>request('status')}),writable:false,configurable:false});
  let heartbeat=null;
  const begin=()=>{if(heartbeat!==null)return;void request('status').catch(()=>{});heartbeat=setInterval(()=>request('status').catch(()=>{}),15000);};
  const stop=()=>{if(heartbeat!==null)clearInterval(heartbeat);heartbeat=null;};
  window.addEventListener('pagehide',stop);window.addEventListener('pageshow',begin);begin();
}
