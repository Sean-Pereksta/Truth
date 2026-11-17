import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDesktopActivity} from '../hosting/activity.mjs';

test('host desktop heartbeats keep single-player alive and guest traffic cannot renew the lease',()=>{
  let time=0;const activity=createDesktopActivity({now:()=>time});
  for(let beat=0;beat<100;beat++){time+=15000;activity.touch();assert.equal(activity.expired(),false);}
  // Guests may keep polling during these three minutes; they hold no desktop
  // capability and therefore cannot call touch().
  time+=179999;assert.equal(activity.expired(),false);time++;assert.equal(activity.expired(),true);
});
test('installed bridge starts immediately, survives refresh/back-cache, and stops on pagehide',async()=>{
  const listeners=new Map(),intervals=new Map(),saved=new Map();let requests=0,nextId=1;
  const context={URLSearchParams,location:{hash:'#desktop=private-desktop-capability-123456789',origin:'http://127.0.0.1:4174',pathname:'/',search:''},history:{replaceState(){}},sessionStorage:{setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)},window:{addEventListener:(type,handler)=>listeners.set(type,handler)},fetch:async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer private-desktop-capability-123456789');requests++;return {ok:true,json:async()=>({ok:true})};},setInterval:(fn,delay)=>{assert.equal(delay,15000);const id=nextId++;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)};
  vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../../multiplayer/desktop-bridge.js',import.meta.url),'utf8').replace('export function','function')+'\ninitializeDesktopBridge();',context);
  assert.equal(requests,1);assert.equal(intervals.size,1);[...intervals.values()][0]();assert.equal(requests,2);listeners.get('pagehide')();assert.equal(intervals.size,0);listeners.get('pageshow')();assert.equal(intervals.size,1);assert.equal(requests,3);
});
