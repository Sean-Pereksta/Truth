import {PROTOCOL_VERSION,GAME_VERSION,ASSET_VERSION} from './protocol.js';
import {createRemoteGame,applySnapshot} from './snapshot.js';
import {applySnapshotDelta} from './transport-delta.js';
import {projectileDrawPose} from '../projectile-flight.js';

const COMMANDS=new Set(['command','setFacingLock','idle','advance','placeFormation','attackNearest','attackTarget','hold','retreat','patrol','expand','setTrebuchetDeployment','setRally','clearRally','recruit','build','upgrade','upgradeTownHall','upgradeTower','useHousePower','callTeamOrder','plantStandard','retrieveStandard','refitStandard','reforgeStandard','cancelStandard']);
const finiteFields=['x','y','motionVX','motionVY','vx','vy','facingX','facingY','faceX','faceY','angle','attackAnim','hit','life','t','flightHeight','flightAngle'];
const presentationKeys=['units','buildings','projectiles','effects','standards','placedFormations','formationAdvances'];
const items=value=>value instanceof Map?value.values():value||[];
const cloneArgs=value=>JSON.parse(JSON.stringify(value,(_key,v)=>v instanceof Set?[...v]:v));
const clock=()=>globalThis.performance?.now()??Date.now();
export class ConnectionError extends Error{constructor(message,status=0,data=null){super(message);this.status=status;this.data=data;}}

// Interpolation only touches the presentation during a synchronous draw. UI
// queries and commands always read the latest authoritative coordinates.
export class PresentationBuffer{
 constructor({delay=.15}={}){this.baseDelay=delay;this.delay=delay;this.interval=.1;this.renderTime=-Infinity;this.samples=[];this.frame=null;}
 push(snapshot,receivedAt=clock()){
  const last=this.samples.at(-1);if(last&&snapshot.sequence<=last.sequence)return;
  if(last){const interval=Math.max(snapshot.time-last.time,(receivedAt-last.receivedAt)/1000);this.interval=this.interval*.8+Math.min(1,interval)*.2;this.delay=Math.max(this.baseDelay,Math.min(.75,this.interval*1.25));}
  const entities={};
  for(const key of presentationKeys){
   const group=entities[key]=new Map();
   for(const item of items(snapshot[key])){
    const pose={};for(const field of finiteFields)if(Number.isFinite(item[field]))pose[field]=item[field];
    if(key==='projectiles'){
     const {height,angle}=projectileDrawPose(item);
     pose.flightHeight=height;pose.flightAngle=angle;
    }
    group.set(item.id,pose);
   }
  }
  this.frame=null;
  this.samples.push({time:snapshot.time,sequence:snapshot.sequence,receivedAt,entities});
  while(this.samples.length>20||this.samples.length>2&&this.samples[1].time<snapshot.time-1)this.samples.shift();
 }
 prepareFrame(game,before,after){
  // Several display frames share the same pair of network ticks. Match the
  // entities once, and only touch fields which differ from the live snapshot.
  const changes=[];
  for(const key of presentationKeys){
   const first=before.entities[key],second=after.entities[key];
   for(const entity of items(game[key])){
    const a=first.get(entity.id),b=second.get(entity.id);
    if(!a||!b)continue;
    for(const field in a){
     const start=a[field],end=b[field];
     if(!Number.isFinite(end)||(start===end&&start===entity[field]))continue;
     const difference=end-start;
     const delta=field==='angle'||field==='flightAngle'?Math.atan2(Math.sin(difference),Math.cos(difference)):difference;
     changes.push({entity,field,start,delta,original:entity[field]});
    }
   }
  }
  return {game,before,after,changes,active:false};
 }
 draw(game,now,callback){
  const last=this.samples.at(-1);if(!last)return callback();
  const target=this.renderTime=Math.max(this.renderTime,Math.min(last.time,last.time+Math.max(0,now-last.receivedAt)/1000-this.delay));
  let before=this.samples[0],after=last;
  for(const sample of this.samples){if(sample.time<=target)before=sample;else{after=sample;break;}}
  const mix=after.time>before.time?Math.max(0,Math.min(1,(target-before.time)/(after.time-before.time))):1;
  let frame=this.frame;
  if(frame?.active)frame=this.prepareFrame(game,before,after);
  else if(frame?.game!==game||frame.before!==before||frame.after!==after)frame=this.frame=this.prepareFrame(game,before,after);
  const oldTime=game.time;
  frame.active=true;
  for(const change of frame.changes){
   const {entity,field,start,delta}=change;
   change.original=entity[field];
   entity[field]=start+delta*mix;
  }
  game.time=Math.max(before.time,Math.min(last.time,target));
  try{return callback();}finally{
   game.time=oldTime;
   for(const change of frame.changes)change.entity[change.field]=change.original;
   frame.active=false;
  }
 }
}

export class MultiplayerClient{
 constructor({origin=globalThis.location?.origin,fetchImpl=globalThis.fetch?.bind(globalThis),storage=globalThis.sessionStorage,onState=()=>{},onStatus=()=>{},onCommand=()=>{},onPending=()=>{},now=clock}={}){
  this.origin=new URL(origin).origin;this.fetchImpl=fetchImpl;this.storage=storage;this.onState=onState;this.onStatus=onStatus;this.onCommand=onCommand;this.onPending=onPending;this.now=now;
  this.session=null;this.game=null;this.lobby=null;this.sequence=0;this.queue=[];this.sending=false;this.running=false;this.timer=null;this.lastGood=0;this.etag=null;this.presentation=new PresentationBuffer();
  this.metrics={requests:0,receivedBytes:0,commands:0,commandRoundTrips:[],resyncs:0,pollFailures:0};
  this.generation=0;this.commandEpoch=0;this.pollPromise=null;this.controllers=new Set();this.commandControllers=new Set();
 }
 async request(route,{method='GET',body,hostToken,token=hostToken||this.session?.token,timeout=8000,etag,keepalive=false}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),headers={};
  this.controllers.add(controller);if(route==='/api/command')this.commandControllers.add(controller);
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';if(etag)headers['If-None-Match']=etag;
  try{
   this.metrics.requests++;const response=await this.fetchImpl(this.origin+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store',credentials:'same-origin',referrerPolicy:'no-referrer',keepalive});
   if(response.status===304)return {unchanged:true};
   const content=await response.text();this.metrics.receivedBytes+=new TextEncoder().encode(content).byteLength;
   if(content.length>16*1024*1024)throw new ConnectionError('The host sent an oversized update.');
   let data;try{data=JSON.parse(content);}catch{throw new ConnectionError('The host returned an unreadable response.',response.status);}
   if(!response.ok)throw new ConnectionError(data.message||data.error||'The host refused the request.',response.status,data);
   return {...data,_etag:response.headers.get('ETag')};
  }catch(error){if(error.name==='AbortError')throw new ConnectionError('The host did not respond in time.');throw error;}finally{clearTimeout(timer);this.controllers.delete(controller);this.commandControllers.delete(controller);}
 }
 remember(){try{this.storage?.setItem('bannerlands-session:'+this.origin,JSON.stringify(this.session));}catch{}}
 forget(){
  try{this.storage?.removeItem('bannerlands-session:'+this.origin);}catch{}
  this.session=null;this.game=null;this.lobby=null;this.snapshot=null;this.etag=null;this.sequence=0;this.presentation=new PresentationBuffer();
 }
 async join({name='Guest',invite,hostToken,lobbyId}={}){
  this.close();this.forget();const generation=this.generation;
  this.onStatus('connecting','Reserving your house…');
  const data=await this.request(hostToken?'/api/host/session':'/api/join',{method:'POST',hostToken,body:{v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION,name,invite,lobbyId}});
  if(generation!==this.generation)throw new ConnectionError('This join request was cancelled.');
  this.session={token:data.token,team:data.team,sessionId:data.sessionId,host:!!hostToken||data.host===true};this.sequence=data.lastSeq||0;this.lobby=data.lobby;this.remember();this.running=true;
  await this.poll(true).catch(error=>{if(!this.session)throw error;});
  if(generation!==this.generation||!this.session)throw new ConnectionError('This join request was cancelled.');
  return data;
 }
 async restore(){
  this.close();const generation=this.generation;
  let saved;try{saved=JSON.parse(this.storage?.getItem('bannerlands-session:'+this.origin)||'null');}catch{return false;}
  if(!saved?.token)return false;this.session=saved;this.running=true;
  try{await this.poll(true);return generation===this.generation&&!!this.session;}catch(error){if(generation!==this.generation)return false;this.running=false;this.forget();if(error.status!==401&&error.status!==410)throw error;return false;}
 }
 attachCommands(game){
  game.remote=true;
  for(const type of COMMANDS)Object.defineProperty(game,type,{configurable:true,value:(...args)=>{
   const result=this.send(type,args);
   return type==='placeFormation'&&result.ok?{...result,formation:args[1]}:result;
  }});
  // No command or browser menu can run a second simulation.
  game.update=()=>{};game.updateAftermath=()=>{};
 }
 send(type,args){
  if(!this.running||!this.session||this.lobby?.status!=='in-progress')return {ok:false,message:'Commands are available after the match starts.'};
  if(this.now()-this.lastGood>5000)return {ok:false,message:'Connection lost. Reconnecting to your house…'};
  if(this.queue.length>=32)return {ok:false,message:'Too many pending commands. Wait for the host.'};
  const envelope={v:PROTOCOL_VERSION,matchId:this.lobby.matchId,seq:++this.sequence,type,args:cloneArgs(args)};
  this.game.lastPendingCommand=envelope.seq;
  this.queue.push(envelope);this.onPending(envelope);this.flushCommands();return {ok:true,pending:true,seq:envelope.seq,message:'Order sent · awaiting host confirmation.'};
 }
 async flushCommands(){
  if(this.sending)return;this.sending=true;const epoch=this.commandEpoch,generation=this.generation;
  try{
   while(this.running&&this.queue.length&&epoch===this.commandEpoch&&generation===this.generation){
    const envelope=this.queue[0],start=this.now();let result;
    // A retry always carries the identical sequence and body. An uncertain
    // purchase/order cannot be executed twice after a lost response.
    try{result=await this.request('/api/command',{method:'POST',body:envelope});}
    catch(error){
     if(epoch!==this.commandEpoch||generation!==this.generation)return;
     if(error.status===401||error.status===410){this.running=false;this.forget();this.onStatus('closed',error.message);break;}
     if(error.data?.code==='match'){this.queue.length=0;this.onCommand({ok:false,message:'The match changed. Issue this order again after synchronization.'},envelope);break;}
     if(error.data?.seq===envelope.seq){this.queue.shift();this.onCommand(error.data,envelope);continue;}
     if(error.data?.expectedSeq){this.queue.length=0;this.sequence=error.data.expectedSeq-1;this.onCommand({ok:false,message:'Command order was interrupted. Issue your next order again.'},envelope);break;}
     if(error.status&&![429,502,503,504].includes(error.status)){this.queue.length=0;this.sequence=envelope.seq-1;this.onCommand({ok:false,message:error.message},envelope);break;}
     this.onStatus('reconnecting','Connection interrupted. Recovering your session…');
     await new Promise(resolve=>setTimeout(resolve,700));continue;
    }
    if(epoch!==this.commandEpoch||generation!==this.generation)return;
    this.queue.shift();this.metrics.commands++;this.metrics.commandRoundTrips.push(this.now()-start);if(this.metrics.commandRoundTrips.length>256)this.metrics.commandRoundTrips.shift();
    this.onCommand(result.result||result,envelope);
   }
  }finally{if(epoch===this.commandEpoch&&generation===this.generation)this.sending=false;}
 }
 poll(throwOnError=false){
  if(!this.running)return Promise.resolve();
  if(!this.pollPromise){const task=this.pollOnce(this.generation);this.pollPromise=task;const clear=()=>{if(this.pollPromise===task)this.pollPromise=null;};task.then(clear,clear);}
  return throwOnError?this.pollPromise:this.pollPromise.catch(()=>{});
 }
 async pollOnce(generation){
  if(!this.running)return;
  try{
   const data=await this.request('/api/state'+(!this.snapshot?'?initial=1':'?since='+this.snapshot.sequence),{etag:this.etag});if(!this.running||generation!==this.generation)return;this.lastGood=this.now();
   if(!data.unchanged){
    const nextLobby=data.lobby||this.lobby;
    if(this.lobby?.matchId!==nextLobby?.matchId){this.game=null;this.snapshot=null;this.etag=null;this.presentation=new PresentationBuffer();this.queue.length=0;this.sequence=0;this.commandEpoch++;this.sending=false;for(const controller of this.commandControllers)controller.abort();}
    this.lobby=nextLobby;if(data.session){Object.assign(this.session,data.session);this.sequence=Math.max(this.sequence,data.session.lastSeq||0);this.remember();}
    if(data.delta){
     try{data.snapshot=applySnapshotDelta(this.snapshot,data.delta);}catch{this.snapshot=null;this.etag=null;this.metrics.resyncs++;return;}
    }
    if(data.snapshot){
     if(data.snapshot.v!==PROTOCOL_VERSION||data.snapshot.gameVersion!==GAME_VERSION||data.snapshot.assetVersion!==ASSET_VERSION)throw new ConnectionError('This host uses a different game version. Download the matching update.',409);
     if(!this.game){this.game=createRemoteGame(data.snapshot);this.attachCommands(this.game);}
     else applySnapshot(this.game,data.snapshot);
     this.snapshot=data.snapshot;
     this.presentation.push(data.snapshot,this.now());
    }
    this.etag=data._etag;this.onState({game:this.game,lobby:this.lobby,session:this.session});
   }
   this.onStatus('connected',this.lobby?.status==='in-progress'?'Connected · host runs the battle':'Connected · waiting in the lobby');
  }catch(error){
   if(generation!==this.generation||!this.running)return;
   this.lastError=error.message;this.metrics.pollFailures++;
   if(error.status===401||error.status===410||error.status===409){this.running=false;this.forget();this.onStatus('closed',error.message);}
   else this.onStatus('reconnecting','Reconnecting to the host. Your house remains reserved; the battle continues.');
   throw error;
  }finally{if(this.running&&generation===this.generation){clearTimeout(this.timer);this.timer=setTimeout(()=>this.poll(),this.now()-this.lastGood>5000?1000:100);}}
 }
 ready(ready,revision,assetsReady){return this.request('/api/ready',{method:'POST',body:{ready,revision,assetsReady}});}
 chooseHouse(team){return this.request('/api/house',{method:'POST',body:{team}});}
 start(revision){return this.request('/api/start',{method:'POST',body:{revision}});}
 synchronize(){
  if(!this.running||!this.game||!this.snapshot||this.lobby?.status!=='starting')return Promise.resolve();
  const matchId=this.lobby.matchId,generation=this.generation;
  if(this.synchronizedMatch===matchId)return Promise.resolve();
  if(this.synchronizingMatch===matchId&&this.syncPromise)return this.syncPromise;
  this.synchronizingMatch=matchId;
  const task=this.request('/api/synchronized',{method:'POST',body:{matchId,sequence:this.snapshot.sequence}}).then(data=>{
   if(this.running&&this.generation===generation&&this.lobby?.matchId===matchId)this.synchronizedMatch=matchId;
   return data;
  });
  this.syncPromise=task;const clear=()=>{if(this.syncPromise===task)this.syncPromise=null;};task.then(clear,clear);return task;
 }
 async leave(){
  const token=this.session?.token;this.close();this.forget();
  if(token)await this.request('/api/leave',{method:'POST',body:{},token,keepalive:true});
 }
 close(){this.running=false;this.generation++;this.commandEpoch++;clearTimeout(this.timer);this.queue.length=0;this.sending=false;this.pollPromise=null;for(const controller of this.controllers)controller.abort();}
}
