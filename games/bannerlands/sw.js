import {GAME_VERSION,ASSET_VERSION} from './multiplayer/protocol.js';
const cacheName='bannerlands-art-'+GAME_VERSION+'-'+ASSET_VERSION;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('bannerlands-art-')&&name!==cacheName)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.includes('/assets/')||!(/\.(png|webp)$/i).test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheName),saved=await cache.match(event.request);if(saved)return saved;
  const response=await fetch(event.request,{cache:'reload'});if(response.ok)try{await cache.put(event.request,response.clone());}catch{}return response;
 })());
});
