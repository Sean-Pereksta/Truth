import assert from 'node:assert/strict';
import {queueArtwork} from '../../asset-loader.js';
let current=0,peak=0;
const attempts=new Map();
class ImageStub{
 set src(value){
  const attempt=(attempts.get(value)||0)+1;attempts.set(value,attempt);current++;peak=Math.max(peak,current);
  setTimeout(()=>{current--;if(value==='retry'&&attempt===1)this.onerror(new Error('Temporary network failure'));else this.onload();},5);
 }
}
const loaded=Array.from({length:24},(_,i)=>new Promise((resolve,reject)=>{const image=new ImageStub();image.onload=resolve;image.onerror=reject;queueArtwork(image,i===7?'retry':'image-'+i);}));
await Promise.all(loaded);
assert.ok(peak<=8,'Concurrent artwork requests stay bounded for several guests sharing a tunnel.');assert.equal(attempts.get('retry'),2);assert.equal(current,0);
console.log('PASS full artwork queue bounds simultaneous requests and recovers a temporary image failure.');
