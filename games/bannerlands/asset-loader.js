const requests=[];
const decodes=[];
let activeRequests=0;
let activeDecodes=0;
const timings={loaded:0,requestMs:0,decodeMs:0};
const localArtworkSession=Date.now().toString(36);
let lastFailure=null;

export function artworkTimings(){return {...timings};}
export function lastArtworkFailure(){return lastFailure;}

function requestSource(source){
  const page=globalThis.location;
  const worker=globalThis.navigator?.serviceWorker?.controller;
  if(!globalThis.bannerlandsHost||!page||worker?.scriptURL!==new URL('./sw.js',page.href).href)return source;
  const url=new URL(source,page.href);
  if(url.origin!==page.origin||!url.pathname.startsWith('/assets/'))return source;
  // An unregistered worker still controls the current page. Give that worker
  // a fresh asset URL until the next load can use the pack without a cache.
  url.searchParams.set('local-pack',localArtworkSession);
  return url.href;
}

function failureFor(source,error){
  const name=source.startsWith('data:')?'embedded artwork':source.split(/[?#]/,1)[0].slice(0,160);
  return {source:name,reason:String(error?.message||'The image request failed.').slice(0,160)};
}

function drain(){
  while(activeDecodes<2&&decodes.length){
    activeDecodes++;
    decodes.shift()();
  }
  // Keep backpressure on downloads while decoded frames are being prepared.
  while(activeRequests+activeDecodes+decodes.length<8&&requests.length){
    activeRequests++;
    requests.shift()();
  }
}

export function queueArtwork(image,source){
  const loaded=image.onload,failed=image.onerror;
  let attempts=0;
  function finish(callback,event){
    image.onload=loaded;
    image.onerror=failed;
    try{callback?.call(image,event);}finally{drain();}
  }
  function retry(error){
    if(attempts>=3){
      lastFailure=failureFor(source,error);
      finish(failed,error);
      return;
    }
    setTimeout(()=>{requests.push(request);drain();},attempts*500);
    drain();
  }
  function request(){
    attempts++;
    const start=performance.now();
    let pending=true;
    const timer=setTimeout(()=>onError(new Error('Artwork request timed out.')),30000);
    function endRequest(){
      if(!pending)return false;
      pending=false;
      clearTimeout(timer);
      image.onload=null;
      image.onerror=null;
      activeRequests--;
      timings.requestMs+=performance.now()-start;
      return true;
    }
    function onError(error){
      if(endRequest())retry(error);
    }
    image.onerror=onError;
    image.onload=event=>{
      if(!endRequest())return;
      decodes.push(async()=>{
        const startDecode=performance.now();
        let error;
        try{await image.decode?.();}catch(reason){error=reason;}
        timings.decodeMs+=performance.now()-startDecode;
        activeDecodes--;
        if(error){retry(error);return;}
        timings.loaded++;
        finish(loaded,event);
      });
      drain();
    };
    try{image.src=requestSource(source);}catch(error){onError(error);}
  }
  requests.push(request);
  drain();
}
