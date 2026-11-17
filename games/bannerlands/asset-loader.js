// Bound simultaneous artwork requests so several guests loading together stay
// comfortably below the temporary tunnel's in-flight request limit.
const waiting=[];
let active=0;
const limit=8;
function drain(){
 while(active<limit&&waiting.length){active++;const {image,source}=waiting.shift();load(image,source);}
}
function load(image,source){
 const loaded=image.onload,failed=image.onerror;let attempt=0,timer=null,finished=false;
 function finish(callback,event){
  if(finished)return;finished=true;clearTimeout(timer);image.onload=loaded;image.onerror=failed;active--;
  try{callback?.call(image,event);}finally{drain();}
 }
 function retry(event){
  clearTimeout(timer);if(attempt>=3){finish(failed,event);return;}
  timer=setTimeout(begin,attempt*500);
 }
 function begin(){
  attempt++;image.onload=event=>finish(loaded,event);image.onerror=retry;
  timer=setTimeout(()=>retry(new Error('Artwork request timed out.')),30000);
  try{image.src=source;}catch(error){retry(error);}
 }
 begin();
}
export function queueArtwork(image,source){waiting.push({image,source});drain();}
