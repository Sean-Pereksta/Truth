import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Game} from '../core.js';
import {createAuthority,validateCampaignConfig} from '../multiplayer/authority.js';
import {PROTOCOL_VERSION,GAME_VERSION,ASSET_VERSION,MAX_HUMANS} from '../multiplayer/protocol.js';
import {createSnapshotDelta} from '../multiplayer/transport-delta.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const secret=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cleanName=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,60):fallback;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const stateHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Referrer-Policy':'no-referrer'};
class RequestError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function validVersion(data){if(data?.v!==PROTOCOL_VERSION||data.gameVersion!==GAME_VERSION||data.assetVersion!==ASSET_VERSION)throw new RequestError(409,'version','This game version is incompatible. Refresh or update Bannerlands before joining.');}
async function readBody(req,max=32768){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new RequestError(415,'content-type','Send a JSON request.');
  if(Number(req.headers['content-length'])>max)throw new RequestError(413,'size','This request is too large.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>max)throw new RequestError(413,'size','This request is too large.');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new RequestError(400,'json','This request is not valid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError(400,'body','This request must be an object.');return body;
}
function json(req,res,status,body,extra={}){
  const started=performance.now();let bytes=Buffer.from(JSON.stringify(body));const uncompressedBytes=bytes.length,encoded=performance.now();const headers={...stateHeaders,'Content-Type':'application/json; charset=utf-8',...extra};
  if(bytes.length>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){bytes=gzipSync(bytes,{level:3});headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
  headers['Content-Length']=bytes.length;res.writeHead(status,headers);res.end(bytes);return {uncompressedBytes,wireBytes:bytes.length,encodeMs:encoded-started,gzipMs:performance.now()-encoded};
}

// The match server evolved from the tested two-seat prototype. Seats and
// credentials now live separately, and all views come from the maintained game.
export async function createMatchServer({config={},lobby={},hostToken=secret(),invite=secret(),port=0,publisher=null,clock=Date.now,desktop=null,reservationMs=90000,disconnectMs=15000,heartbeatMs=20000,synchronizationMs=45000,simulation=true}={}){
  let validatedGame=new Game(validateCampaignConfig(config)),campaign={...validatedGame.config};
  if(lobby.maxHumans!==undefined&&(!Number.isInteger(lobby.maxHumans)||lobby.maxHumans<1||lobby.maxHumans>MAX_HUMANS))throw new Error(`Choose one to ${MAX_HUMANS} human players.`);
  if(lobby.maxHumans>validatedGame.teams.length)throw new Error('The selected campaign has fewer houses than human slots.');
  let maxHumans=Math.min(MAX_HUMANS,validatedGame.teams.length,Math.max(1,Number.isInteger(lobby.maxHumans)?lobby.maxHumans:2));
  let name=cleanName(lobby.name,'Bannerlands lobby'),hostName=cleanName(lobby.hostName,'Host'),publicLobby=!!lobby.public;
  let revision=1,status=desktop?'closed':'waiting',origin='',reachable=false,authority=null,sequence=0,closed=false,lastPublished=0,latestSnapshotAt=0,fatalError=null,matchId=null,synchronizationDeadline=0;
  let directoryError=null,publication=Promise.resolve();
  let id=randomBytes(12).toString('hex'),hostSession=null,hostRequest=null,lobbyCleanup=null,stopRevision=0;
  const sessions=new Map(),snapshots=new Map(),rate=new Map();
  function seatHost(){
    hostSession={id:randomBytes(12).toString('hex'),token:secret(),team:0,name:hostName,host:true,ready:false,assetsReady:false,synchronized:false,lastSeen:clock(),lastSeq:0,history:new Map()};
    sessions.set(hostSession.token,hostSession);
  }
  if(!desktop)seatHost();
  const metrics={requests:0,stateBytes:0,stateWireBytes:0,stateResponses:0,stateEncodeMs:0,stateGzipMs:0,commands:0,simulationSteps:0,simulationMs:0,maxSimulationMs:0,directoryOperations:0};
  const record=()=>{
    const players=[...sessions.values()].map(s=>({id:s.id,name:s.name,team:s.team,host:s.host,ready:s.ready,assetsReady:s.assetsReady,synchronized:s.synchronized,connected:clock()-s.lastSeen<disconnectMs}));
    const houses=validatedGame.teams.map(team=>({team:team.id,name:team.name,house:team.house,alliance:team.alliance,color:team.color}));
    const publicConfig={};for(const key of ['house','enemies','difficulty','scale','mode','landscape','fogOfWar','houses'])if(Object.hasOwn(campaign,key))publicConfig[key]=Array.isArray(campaign[key])?[...campaign[key]]:campaign[key];
    return {id,matchId,v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION,name,hostName,hostIdentity:'unverified display name',origin,public:publicLobby,directoryManaged:!!publisher,mode:campaign.mode,map:campaign.landscape,config:publicConfig,houses,status:closed?'closed':status==='waiting'&&players.length>=maxHumans?'full':status,phase:status,synchronizationDeadline,revision,players,maxHumans,humanSlots:maxHumans,humans:players.length,availableSeats:status==='waiting'?Math.max(0,maxHumans-players.length):0,aiHouses:validatedGame.teams.length-maxHumans,expiresAt:clock()+heartbeatMs*3,reachable,directoryError,error:fatalError,disconnectPolicy:'Battle continues. Your house stays reserved during the match; reconnect with this browser to recover it.'};
  };
  function queuePublish(remove=false){
    if(!publisher)return;
    publication=publication.catch(()=>{}).then(async()=>{
      try{
        if(remove||closed||!publicLobby||!reachable||status!=='waiting'||sessions.size>=maxHumans){lastPublished=0;await publisher.remove(id);metrics.directoryOperations++;}
        else {const entry=record();if(lastPublished){await publisher.heartbeat(entry);}else await publisher.publish(entry);lastPublished=clock();metrics.directoryOperations++;}directoryError=null;
      }catch(error){directoryError='Lobby discovery is unavailable. Invite links can still be used.';}
    });
  }
  function changed(){revision++;for(const s of sessions.values()){s.ready=false;s.synchronized=false;s.history.clear();}snapshots.clear();queuePublish();}
  function checkSynchronization(){
    if(status!=='starting')return;
    if(clock()>=synchronizationDeadline){
      status='waiting';authority=null;matchId=null;sequence=0;synchronizationDeadline=0;fatalError='World synchronization did not finish within '+Math.round(synchronizationMs/1000)+' seconds. Check each player\'s connection, let everyone finish loading, then mark ready and try again.';changed();return;
    }
    if([...sessions.values()].every(s=>s.synchronized&&s.ready&&s.assetsReady&&clock()-s.lastSeen<disconnectMs)){status='in-progress';synchronizationDeadline=0;queuePublish(true);}
  }
  function retireLobby(){
    status='closed';authority=null;matchId=null;sequence=0;synchronizationDeadline=0;fatalError=null;
    reachable=false;origin='';publicLobby=false;hostSession=null;hostToken=secret();invite=secret();lastPublished=0;
    sessions.clear();snapshots.clear();revision++;queuePublish(true);
  }
  function closeInstalledLobby(){
    if(lobbyCleanup)return lobbyCleanup;
    if(status==='closed')return Promise.resolve();
    retireLobby();
    lobbyCleanup=(async()=>{
      try{await desktop.stop(instance);}finally{await publication;}
    })().finally(()=>{lobbyCleanup=null;});
    return lobbyCleanup;
  }
  async function openInstalledLobby(body,requestedAt){
    await closeInstalledLobby();
    if(closed||requestedAt!==stopRevision)throw new RequestError(409,'closed','Hosting was cancelled. Create a new lobby to try again.');
    id=randomBytes(12).toString('hex');status='waiting';seatHost();
    try{
      updateConfig({...body.lobby,config:body.config});
      let result;
      try{result=await desktop.host(instance);}catch(error){throw new RequestError(503,'hosting',error.message||'The temporary connection could not start. Check your internet connection and retry hosting.');}
      if(status==='closed'||closed)throw new RequestError(409,'closed','Hosting was cancelled. Create a new lobby to try again.');
      return result;
    }catch(error){
      await closeInstalledLobby().catch(()=>{});
      throw error;
    }
  }
  function prune(){checkSynchronization();if(status!=='waiting')return;let removed=false;for(const [key,s]of sessions)if(!s.host&&clock()-s.lastSeen>reservationMs){sessions.delete(key);removed=true;}if(removed)changed();}
  function sessionFor(req,hostOnly=false){
    const value=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)?.[1];
    const isHost=equal(value,hostToken);const found=isHost?hostSession:sessions.get(value);
    if(!found)throw new RequestError(401,'session','This private session is invalid or expired. Rejoin the lobby.');
    if(hostOnly&&!found.host)throw new RequestError(403,'host','Only the host may do this.');
    found.lastSeen=clock();return found;
  }
  function checkWaiting(){
    if(status==='closed'||closed)throw new RequestError(410,'closed','The host closed this lobby.');
    if(status!=='waiting')throw new RequestError(409,'started','The lobby is no longer accepting changes.');
  }
  function updateConfig(data){
    checkWaiting();const allowed=['house','houses','enemies','difficulty','scale','seed','mode','landscape','fogOfWar'];const next={...campaign};
    for(const key of allowed)if(Object.hasOwn(data.config||{},key))next[key]=data.config[key];
    if(data.maxHumans!==undefined&&(!Number.isInteger(data.maxHumans)||data.maxHumans<1||data.maxHumans>MAX_HUMANS))throw new RequestError(400,'human-limit',`Choose one to ${MAX_HUMANS} human players; remaining houses are AI opponents.`);
    let trial;try{trial=new Game(validateCampaignConfig(next));}catch(error){throw new RequestError(400,'config',error.message);}const capacity=Math.min(MAX_HUMANS,trial.teams.length,Number.isInteger(data.maxHumans)?data.maxHumans:maxHumans);
    if((data.maxHumans??maxHumans)>trial.teams.length)throw new RequestError(400,'human-slots','Add enough participating houses for the configured human slots.');
    if(capacity<1||capacity<sessions.size||[...sessions.values()].some(s=>s.team>=trial.teams.length))throw new RequestError(409,'seats','These settings would remove an occupied house. Ask the affected players to leave first.');
    validatedGame=trial;campaign={...trial.config};maxHumans=capacity;
    if(Object.hasOwn(data,'name'))name=cleanName(data.name,'Bannerlands lobby');
    if(Object.hasOwn(data,'hostName'))hostName=hostSession.name=cleanName(data.hostName,'Host');
    if(Object.hasOwn(data,'public'))publicLobby=!!data.public;fatalError=null;changed();
  }
  async function snapshotFor(session,initial,since){
    if(!authority)return null;const key=session.team;let cached=snapshots.get(key);
    if(!cached||cached.sequence!==sequence||initial){const snapshot=authority.snapshot(key,{initial,sequence,projection:authority.projection()});cached={sequence,snapshot};if(!initial)snapshots.set(key,cached);}
    const snapshot=cached.snapshot;
    const previous=session.history.get(since);
    const remember=value=>{session.history.set(sequence,value);while(session.history.size>4)session.history.delete(session.history.keys().next().value);};
    if(initial||!previous){const full=initial?snapshot:authority.snapshot(key,{initial:true,sequence,projection:authority.projection()});remember(full);return {snapshot:full};}
    const delta=createSnapshotDelta(previous,snapshot,since,sequence,authority.projection().unitPatchCache);remember(snapshot);return {delta};
  }
  const api=async(req,res,url)=>{
    metrics.requests++;prune();
    const provided=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)?.[1];
    const known=provided&&(sessions.has(provided)||equal(provided,hostToken)||desktop&&equal(provided,desktop.secret));
    const address=known?'session:'+provided:'address:'+(req.socket.remoteAddress||'local'),now=clock();
    if(rate.size>1024)for(const [key,value]of rate)if(now-value.start>=1000)rate.delete(key);
    let bucket=rate.get(address);if(!bucket||now-bucket.start>=1000){bucket={start:now,count:0};rate.set(address,bucket);}if(++bucket.count>45)throw new RequestError(429,'rate','Too many requests. Wait a moment and try again.');
    if(req.method==='OPTIONS'){res.writeHead(204,{...stateHeaders,'Access-Control-Allow-Headers':'Authorization,Content-Type,If-None-Match','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Max-Age':'600'});res.end();return;}
    if(url.pathname==='/api/lobby'&&req.method==='GET')return json(req,res,200,{ok:true,lobby:record(),versions:{v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION}});
    if(url.pathname.startsWith('/api/desktop/')){
      if(!desktop||!equal((req.headers.authorization||'').replace(/^Bearer /,''),desktop.secret))throw new RequestError(401,'desktop','Start Bannerlands from its installed shortcut.');
      desktop.touch?.();
      if(url.pathname==='/api/desktop/status'&&req.method==='GET'){if(hostSession)hostSession.lastSeen=clock();return json(req,res,200,{ok:true,...desktop.status()});}
      if(url.pathname==='/api/desktop/host'&&req.method==='POST'){
        const body=await readBody(req);
        if(hostRequest)throw new RequestError(409,'hosting','A hosting request is already in progress.');
        hostRequest=openInstalledLobby(body,stopRevision).finally(()=>{hostRequest=null;});
        const result=await hostRequest;
        return json(req,res,200,{ok:true,...result});
      }
      if(url.pathname==='/api/desktop/stop'&&req.method==='POST'){
        const body=await readBody(req);
        if(body.hostToken===undefined||equal(body.hostToken,hostToken)||equal(body.hostToken,hostSession?.token)){
          const pending=hostRequest;
          stopRevision++;
          await closeInstalledLobby();
          await pending?.catch(()=>{});
        }
        return json(req,res,200,{ok:true});
      }
      if(url.pathname==='/api/desktop/shutdown'&&req.method==='POST'&&desktop.shutdown){json(req,res,200,{ok:true,message:'Bannerlands is closing.'});setTimeout(()=>desktop.shutdown(),25).unref();return;}
      throw new RequestError(404,'not-found','Not found.');
    }
    if(url.pathname==='/api/join'&&req.method==='POST'){
      const body=await readBody(req);validVersion(body);checkWaiting();
      if(body.lobbyId!==undefined&&body.lobbyId!==id)throw new RequestError(409,'lobby','This lobby has closed. Browse for the host’s current lobby.');
      if(body.invite==null&&!publicLobby)throw new RequestError(403,'invite','This private lobby requires its invitation link.');
      if(body.invite!=null&&!equal(body.invite,invite))throw new RequestError(403,'invite','This invitation has expired. Ask the host for the current link.');
      // No await separates checking and inserting a seat: concurrent final-seat
      // requests cannot both succeed in the single authoritative process.
      if(sessions.size>=maxHumans)throw new RequestError(409,'full','This lobby is full.');
      const occupied=new Set([...sessions.values()].map(s=>s.team));const team=validatedGame.teams.find(t=>!occupied.has(t.id))?.id;
      if(team===undefined)throw new RequestError(409,'full','No house is available.');
      const s={id:randomBytes(12).toString('hex'),token:secret(),team,name:cleanName(body.name,'Guest'),host:false,ready:false,assetsReady:false,synchronized:false,lastSeen:clock(),lastSeq:0,history:new Map()};sessions.set(s.token,s);changed();
      return json(req,res,201,{ok:true,token:s.token,sessionId:s.id,team:s.team,reconnectUntil:clock()+reservationMs,lobby:record()});
    }
    const session=sessionFor(req,['/api/config','/api/start','/api/close','/api/end','/api/visibility','/api/metrics','/api/host/session'].includes(url.pathname));
    if(url.pathname==='/api/host/session'&&req.method==='POST')return json(req,res,200,{ok:true,token:hostSession.token,sessionId:hostSession.id,team:hostSession.team,lobby:record()});
    if(url.pathname==='/api/state'&&req.method==='GET'){
      const initial=url.searchParams.get('initial')==='1',since=Number(url.searchParams.get('since'));
      const presence=[...sessions.values()].map(s=>`${s.id}:${s.ready}:${s.assetsReady}:${s.synchronized}:${clock()-s.lastSeen<disconnectMs}`).join(',');
      const metadata=JSON.stringify([publicLobby,reachable,origin,directoryError,fatalError,synchronizationDeadline]);
      const etag='"'+(matchId||'lobby')+'-'+status+'-'+sequence+'-'+revision+'-'+session.team+'-'+createHash('sha256').update(presence+'|'+metadata).digest('hex').slice(0,12)+'"';
      if(!initial&&req.headers['if-none-match']===etag){res.writeHead(304,{...stateHeaders,ETag:etag});return res.end();}
      const payload={ok:true,lobby:record(),session:{id:session.id,team:session.team,lastSeq:session.lastSeq},...(await snapshotFor(session,initial,since)||{snapshot:null})};
      const sizes=json(req,res,200,payload,{ETag:etag,'Access-Control-Expose-Headers':'ETag'});metrics.stateResponses++;metrics.stateBytes+=sizes.uncompressedBytes;metrics.stateWireBytes+=sizes.wireBytes;metrics.stateEncodeMs+=sizes.encodeMs;metrics.stateGzipMs+=sizes.gzipMs;return;
    }
    if(url.pathname==='/api/metrics'&&req.method==='GET')return json(req,res,200,{ok:true,metrics:{...metrics},directoryUsage:publisher?.usage?.()||null,sessions:sessions.size,sequence});
    if(req.method!=='POST')throw new RequestError(405,'method','Method not allowed.');
    const body=await readBody(req);
    if(!sessions.has(session.token))throw new RequestError(401,'session','This private session is invalid or expired. Rejoin the lobby.');
    if(url.pathname==='/api/heartbeat')return json(req,res,200,{ok:true,lobby:record(),session:{id:session.id,team:session.team,lastSeq:session.lastSeq}});
    if(url.pathname==='/api/config'){updateConfig(body);return json(req,res,200,{ok:true,lobby:record()});}
    if(url.pathname==='/api/visibility'){if(typeof body.public!=='boolean')throw new RequestError(400,'visibility','Choose public or private.');publicLobby=body.public;changed();return json(req,res,200,{ok:true,lobby:record()});}
    if(url.pathname==='/api/house'){
      checkWaiting();if(!Number.isInteger(body.team)||!validatedGame.teams[body.team])throw new RequestError(400,'house','Choose an available house.');
      if([...sessions.values()].some(s=>s!==session&&s.team===body.team))throw new RequestError(409,'occupied','This house is already occupied.');session.team=body.team;changed();return json(req,res,200,{ok:true,lobby:record(),team:session.team});
    }
    if(url.pathname==='/api/ready'){
      checkWaiting();if(body.revision!==revision)throw new RequestError(409,'revision','The lobby settings changed. Review them before marking ready.');
      if(typeof body.ready!=='boolean'||body.ready&&body.assetsReady!==true)throw new RequestError(409,'assets','Finish loading the artwork before marking ready.');session.ready=body.ready;session.assetsReady=body.assetsReady===true;return json(req,res,200,{ok:true,lobby:record()});
    }
    if(url.pathname==='/api/start'){
      checkWaiting();if(body.revision!==revision)throw new RequestError(409,'revision','The lobby changed. Review the current settings.');
      if(sessions.size<maxHumans)throw new RequestError(409,'empty-seats','Every configured human seat must be occupied. Reduce the human seat count to start with fewer people.');
      if([...sessions.values()].some(s=>!s.ready||!s.assetsReady||clock()-s.lastSeen>=disconnectMs))throw new RequestError(409,'not-ready','Every player must be connected, fully loaded, and ready.');
      authority=createAuthority(campaign,{humanTeams:[...sessions.values()].map(s=>s.team)});status='starting';matchId=randomBytes(12).toString('hex');synchronizationDeadline=clock()+synchronizationMs;fatalError=null;sequence=1;snapshots.clear();for(const s of sessions.values()){s.history.clear();s.lastSeq=0;s.synchronized=false;}queuePublish(true);return json(req,res,200,{ok:true,lobby:record()});
    }
    if(url.pathname==='/api/synchronized'){
      if(!matchId||body.matchId!==matchId||!['starting','in-progress'].includes(status))throw new RequestError(409,'match','This synchronization belongs to a different match. Return to the current lobby.');
      if(!session.synchronized&&(!Number.isSafeInteger(body.sequence)||!session.history.has(body.sequence)))throw new RequestError(409,'synchronization','Receive and apply the initial world before confirming synchronization.');
      session.synchronized=true;checkSynchronization();return json(req,res,200,{ok:true,lobby:record()});
    }
    if(url.pathname==='/api/command'){
      if(status!=='in-progress'||!authority)throw new RequestError(409,'not-started','The host has not started this match.');
      if(body.matchId!==matchId)throw new RequestError(409,'match','This order belongs to a different match. Synchronize the current battle before issuing another order.');
      const result=authority.command(session.team,body);if(Number.isSafeInteger(result.seq))session.lastSeq=Math.max(session.lastSeq,result.seq);if(result.ok&&!result.duplicate){metrics.commands++;snapshots.clear();sequence++;}return json(req,res,result.ok?200:result.code==='sequence'?409:400,result);
    }
    if(url.pathname==='/api/leave'){
      if(session.host){if(desktop)await closeInstalledLobby();else await close();return json(req,res,200,{ok:true});}
      sessions.delete(session.token);
      if(status==='starting'){
        status='waiting';authority=null;matchId=null;sequence=0;synchronizationDeadline=0;
        fatalError='A commander left during synchronization. Fill the open seat and mark ready to start again.';
      }
      if(status==='waiting')changed();
      return json(req,res,200,{ok:true});
    }
    if(url.pathname==='/api/end'){
      if(!['starting','in-progress','error'].includes(status))throw new RequestError(409,'not-started','There is no active match.');status='waiting';authority=null;matchId=null;sequence=0;synchronizationDeadline=0;fatalError=null;for(const s of sessions.values()){s.history.clear();s.lastSeq=0;}changed();return json(req,res,200,{ok:true,lobby:record()});
    }
    if(url.pathname==='/api/close'){if(desktop)await closeInstalledLobby();else await close();return json(req,res,200,{ok:true});}
    throw new RequestError(404,'not-found','Not found.');
  };
  const server=http.createServer({requestTimeout:10000,headersTimeout:10000,connectionsCheckingInterval:1000,maxHeaderSize:8192},async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');if(closed&&!['/api/lobby','/api/desktop/status'].includes(url.pathname))throw new RequestError(410,'closed','The host closed this lobby.');
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      if(req.method!=='GET'&&req.method!=='HEAD')throw new RequestError(405,'method','Method not allowed.');
      const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),ext=path.extname(pathname).toLowerCase();
      const candidate=path.resolve(root,'.'+pathname),relative=path.relative(root,candidate);
      const page=!relative.includes(path.sep)&&['.html','.js','.css'].includes(ext)&&relative!=='package.json';
      const asset=relative.startsWith('assets'+path.sep)&&['.png','.jpg','.webp','.svg','.ico'].includes(ext);
      const module=relative.startsWith('multiplayer'+path.sep)&&['.js','.css'].includes(ext)&&!relative.includes('test');
      if(relative.startsWith('..')||path.isAbsolute(relative)||(!page&&!asset&&!module))throw new RequestError(404,'not-found','Not found.');
      const real=await fs.realpath(candidate);if(!real.startsWith(root+path.sep))throw new RequestError(404,'not-found','Not found.');
      let data=await fs.readFile(real);
      const etag='"'+createHash('sha256').update(data).digest('hex').slice(0,24)+'"';
      const headers={'Content-Type':mime[ext],'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',ETag:etag,'Cache-Control':asset?'public, max-age=0, must-revalidate':'no-cache'};
      if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
      res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:data);
    }catch(error){if(!res.headersSent)json(req,res,error.status||error.code==='ENOENT'?error.status||404:500,{ok:false,code:error.code||'internal',message:error.status?error.message:'The host could not complete this request.'});else res.end();}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;
  let last=performance.now(),accumulator=0;
  const tick=setInterval(()=>{
    prune();const now=performance.now(),elapsed=Math.min(.2,(now-last)/1000);last=now;
    if(!simulation||status!=='in-progress'||!authority){accumulator=0;return;}
    accumulator=Math.min(.25,accumulator+elapsed);
    try{while(accumulator>=1/30){const start=performance.now();authority.step(1/30);const ms=performance.now()-start;metrics.simulationSteps++;metrics.simulationMs+=ms;metrics.maxSimulationMs=Math.max(metrics.maxSimulationMs,ms);accumulator-=1/30;}
      if(now-latestSnapshotAt>=100){sequence++;snapshots.clear();latestSnapshotAt=now;}
    }catch(error){status='error';fatalError='The match simulation stopped. The host must return to the lobby.';queuePublish(true);}
  },16);tick.unref();
  const heartbeat=setInterval(()=>{prune();if(status!=='closed')queuePublish();if(rate.size>1024)rate.clear();},heartbeatMs);heartbeat.unref();
  async function close(){
    if(closed)return;closed=true;clearInterval(tick);clearInterval(heartbeat);
    try{
      if(desktop){await closeInstalledLobby();await hostRequest?.catch(()=>{});}
      else {retireLobby();await publication;}
    }finally{server.closeIdleConnections();setTimeout(()=>server.close(),20).unref();}
  }
  const instance={server,get hostToken(){return hostToken;},get invite(){return invite;},get url(){return `http://127.0.0.1:${server.address()?.port}`;},get game(){return authority?.game||validatedGame;},get metrics(){return {...metrics};},getLobby:record,close,async setPublicAddress(value){const parsed=new URL(value);if(parsed.protocol!=='https:')throw new Error('The public game address must use HTTPS.');if(closed||status==='closed')throw new Error('This lobby is closed.');origin=parsed.origin;reachable=true;queuePublish();await publication;},async setReachable(value){reachable=!!value&&status!=='closed';if(!reachable)queuePublish(true);await publication;},async flushDirectory(){await publication;}};
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return instance;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const match=await createMatchServer({port:Number(process.env.BANNERLANDS_PORT)||4174});console.log('Local Bannerlands: '+match.url+'/#host='+match.hostToken);process.once('SIGINT',()=>match.close());process.once('SIGTERM',()=>match.close());
}
