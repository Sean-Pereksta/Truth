import {Game,UNIT_DEFS,BUILD_DEFS,GAME_MODES,AI_DIFFICULTIES} from '../core.js';
import {LAND_MAPS} from '../lands.js';
import {placeFormation} from '../formation-placement.js';
import {PROTOCOL_VERSION,MAX_HUMANS,MAX_COMMAND_IDS,protocolError} from './protocol.js';
import {snapshotWorld,prepareSnapshotProjection} from './snapshot.js';
import {randomInt} from 'node:crypto';

const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const FORMATIONS=['line','spread','wedge','pike','shield','loose'];
const MODES=['move','attack','hold'];
const allowedMethods=new Set(['command','idle','advance','setFacingLock','attackNearest','attackTarget','hold','retreat','patrol','expand','setTrebuchetDeployment','setRally','clearRally','recruit','build','upgrade','useHousePower','upgradeTownHall','upgradeTower','callTeamOrder','plantStandard','retrieveStandard','refitStandard','reforgeStandard','cancelStandard','placeFormation']);

export function createPrivateHomePermutation(config,randomIndex=randomInt){
  const count=config.enemies+1,paired=!!GAME_MODES[config.mode]?.teams;
  const groups=Array.from({length:paired?count/2:count},(_,index)=>paired?[index*2,index*2+1]:[index]);
  for(let index=groups.length-1;index>0;index--){const chosen=randomIndex(index+1);[groups[index],groups[chosen]]=[groups[chosen],groups[index]];}
  if(paired)for(const group of groups)if(randomIndex(2))group.reverse();
  return groups.flat();
}

export function validateCampaignConfig(value={}){
  if(!isObject(value))throw new Error('Campaign settings must be an object.');
  const config={house:0,enemies:3,difficulty:'standard',scale:'epic',seed:44277,mode:'conquest',landscape:'crownlands',fogOfWar:false};
  for(const key of Object.keys(config))if(own(value,key))config[key]=value[key];
  if(!Number.isInteger(config.house)||config.house<0||config.house>=16)throw new Error('Choose a valid house.');
  if(!Number.isInteger(config.enemies)||config.enemies<1||config.enemies>15)throw new Error('Campaigns support two to sixteen houses.');
  if(!own(GAME_MODES,config.mode)||!own(AI_DIFFICULTIES,config.difficulty)||!['standard','epic','continent'].includes(config.scale)||!LAND_MAPS.some(map=>map.id===config.landscape))throw new Error('Unsupported campaign mode, difficulty, size or landscape.');
  if(!Number.isInteger(config.seed)||config.seed<0||config.seed>0xffffffff||typeof config.fogOfWar!=='boolean')throw new Error('Invalid campaign seed or fog setting.');
  if(Array.isArray(value.houses)){
    if(value.houses.length<2||value.houses.length>16||new Set(value.houses).size!==value.houses.length||value.houses.some(id=>!Number.isInteger(id)||id<0||id>=16))throw new Error('Participating houses must be a unique list of valid house IDs.');
    config.houses=[...value.houses];config.house=config.houses[0];config.enemies=config.houses.length-1;
  }
  const mode=GAME_MODES[config.mode];
  if(mode.fixedArmies)config.enemies=mode.fixedArmies-1;
  if(mode.teams)config.enemies=Math.max(3,Math.min(15,config.enemies%2?config.enemies:config.enemies+1));
  if(config.houses&&config.houses.length!==config.enemies+1)throw new Error('The selected mode requires a different number of participating houses.');
  return config;
}

// No method name from a client is called dynamically. Every supported action
// passes through this dispatcher, including keyboard and contextual actions.
export function executePlayerCommand(game,team,type,args){
  if(!game.teams[team]?.alive||!game.isHuman(team))return protocolError('This house cannot issue commands.','forbidden');
  if(game.winner!==null)return protocolError('This match has ended. Return to the lobby.','match-ended');
  if(game.paused)return protocolError('The host has paused the match.','paused');
  if(!allowedMethods.has(type)||!Array.isArray(args)||args.length>8)return protocolError('Unsupported player action.');
  const invalid=message=>{throw new Error(message);};
  const ids=(value,{buildings=false,empty=false}={})=>{
    if(!Array.isArray(value)||value.length>MAX_COMMAND_IDS||!empty&&!value.length||value.some(id=>!Number.isSafeInteger(id)))invalid('Select valid owned entities.');
    const list=[...new Set(value)];
    for(const id of list){const entity=game.byId.get(id);if(!entity||entity.hp<=0||entity.team!==team||(buildings?!BUILD_DEFS[entity.type]:!UNIT_DEFS[entity.type]))invalid('You can command only your own living units and buildings.');}
    return list;
  };
  const hero=value=>{const list=ids([value]);if(game.byId.get(list[0]).type!=='hero')invalid('Select your own living hero.');return list[0];};
  const point=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=game.W||y>=game.H)invalid('Choose finite coordinates inside the battlefield.');return {x,y};};
  const formation=value=>{if(value===undefined)return 'line';if(!FORMATIONS.includes(value))invalid('Unknown formation.');return value;};
  const settings=(value={})=>{
    if(!isObject(value))invalid('Invalid formation settings.');
    const output={};
    for(const key of Object.keys(value)){
      if(['x','y','angle','width','ranks'].includes(key)){if(!Number.isFinite(value[key])||Math.abs(value[key])>10000)invalid('Invalid formation geometry.');output[key]=value[key];}
      else if(['lockFacing','faceInPlace'].includes(key)){if(typeof value[key]!=='boolean')invalid('Invalid facing option.');output[key]=value[key];}
      else if(key==='preset'){if(!FORMATIONS.includes(value.preset))invalid('Unknown formation preset.');output.preset=value.preset;}
      else if(key==='standardAnchor'){
        if(value[key]===null){output[key]=null;continue;}
        // The anchor must be the house's actual planted standard. A client may
        // request its visual gap, but cannot invent an authoritative obstacle.
        const standard=game.standardFor(team);if(!standard||standard.carrierId!==null||standard.hp<=0)invalid('No planted standard is available.');
        output.standardAnchor={x:standard.x,y:standard.y,clearance:1};
      }else invalid('Unsupported formation setting.');
    }
    if(output.width!==undefined&&(output.width<0||output.width>game.W))invalid('Invalid formation width.');
    if(output.ranks!==undefined&&(!Number.isInteger(output.ranks)||output.ranks<1||output.ranks>4))invalid('Choose one to four ranks.');
    return output;
  };
  try{
    let response;
    switch(type){
      case 'command':{
        const list=ids(args[0]),p=point(args[1],args[2]),mode=args[3]??'attack',f=formation(args[4]);if(!MODES.includes(mode))invalid('Unknown order.');
        let facing=null;if(args[5]!=null){if(!isObject(args[5])||!Number.isFinite(args[5].x)||!Number.isFinite(args[5].y)||Math.hypot(args[5].x,args[5].y)<.001||Math.abs(args[5].x)>10000||Math.abs(args[5].y)>10000)invalid('Invalid facing.');facing={x:args[5].x,y:args[5].y};}
        response=game.command(list,p.x,p.y,mode,f,facing);break;
      }
      case 'idle':response=game.idle(ids(args[0]));break;
      case 'hold':response=game.hold(ids(args[0]));break;
      case 'retreat':response=game.retreat(ids(args[0]));break;
      case 'expand':response=game.expand(ids(args[0]));break;
      case 'setTrebuchetDeployment':response=game.setTrebuchetDeployment(ids(args[0]),args[1],args[2]);break;
      case 'patrol':response=game.patrol(ids(args[0]),team);break;
      case 'advance':{
        const destination=args[3];
        if(args.length>3&&!isObject(destination))invalid('Choose a point for the advance.');
        response=game.advance(ids(args[0]),formation(args[1]),settings(args[2]),destination&&point(destination.x,destination.y));break;
      }
      case 'setFacingLock':if(typeof args[1]!=='boolean')invalid('Invalid facing lock.');response=game.setFacingLock(ids(args[0]),args[1]);break;
      case 'attackNearest':response=game.attackNearest(ids(args[0]),formation(args[1]));break;
      case 'attackTarget':{
        const list=ids(args[0]),target=game.byId.get(args[1]);if(!Number.isSafeInteger(args[1])||!target||target.hp<=0||!game.hostile(team,target.team)||!game.isVisibleTo(team,target))invalid('Choose a visible enemy target.');
        response=game.attackTarget(list,target.id,formation(args[2]));break;
      }
      case 'setRally':{const p=point(args[0],args[1]),posts=args[3]==null?null:ids(args[3],{buildings:true});response=game.setRally(p.x,p.y,team,posts);break;}
      case 'clearRally':response=game.clearRally(team,args[1]==null?null:ids(args[1],{buildings:true}));break;
      case 'recruit':if(typeof args[0]!=='string'||!own(UNIT_DEFS,args[0]))invalid('Unknown regiment.');response=game.recruit(args[0],team);break;
      case 'build':{if(typeof args[0]!=='string'||!own(BUILD_DEFS,args[0]))invalid('Unknown building.');const p=point(args[1],args[2]);response=game.build(args[0],p.x,p.y,team);break;}
      case 'upgrade':if(!['weapons','armor','economy'].includes(args[0]))invalid('Unknown upgrade.');response=game.upgrade(args[0],team);break;
      case 'useHousePower':response=game.useHousePower(ids(args[0]??[],{empty:true}),team);break;
      case 'upgradeTownHall':response=game.upgradeTownHall(team);break;
      case 'upgradeTower':{const [id]=ids([args[0]],{buildings:true});if(game.byId.get(id).type!=='tower')invalid('Select a watchtower.');response=game.upgradeTower(id,team);break;}
      case 'callTeamOrder':{const p=point(args[1],args[2]);if(!['assault','defend'].includes(args[0]))invalid('Unknown alliance order.');response=game.callTeamOrder(args[0],p.x,p.y,team);break;}
      case 'plantStandard':{const id=hero(args[0]),p=point(args[1],args[2]);response=game.plantStandard(id,p.x,p.y);break;}
      case 'retrieveStandard':response=game.retrieveStandard(hero(args[0]));break;
      case 'refitStandard':response=game.refitStandard(hero(args[0]));break;
      case 'reforgeStandard':response=game.reforgeStandard(hero(args[0]));break;
      case 'cancelStandard':response=game.cancelStandard(hero(args[0]));break;
      case 'placeFormation':{const list=ids(args[0]),options=settings(args[1]);point(options.x,options.y);response=placeFormation(game,list,options,UNIT_DEFS);break;}
    }
    // Geometry returned by placeFormation is rendering state rather than an
    // acknowledgement. It arrives through the subsequent world snapshot.
    return {ok:response?.ok!==false,message:response?.message||'Order accepted.',...(Number.isFinite(response?.count)?{count:response.count}:{})};
  }catch(error){return protocolError(error.message||'Invalid player action.');}
}

export function createAuthority(config={},options={}){
  const normalized=validateCampaignConfig(config),humans=options.humanTeams??config.humanTeams??[0];
  if(!Array.isArray(humans)||!humans.length||humans.length>MAX_HUMANS||new Set(humans).size!==humans.length||humans.some(team=>!Number.isInteger(team)||team<0||team>normalized.enemies))throw new Error(`Choose one to ${MAX_HUMANS} unique participating human houses; remaining houses use AI.`);
  // Test harnesses may inject a fixed private permutation for exact replay.
  // Untrusted campaign config is deliberately unable to provide this runtime
  // option. Production starts obtain independent entropy from the OS.
  const homePermutation=options.privateHomePermutation??createPrivateHomePermutation(normalized);
  const game=new Game({...normalized,multiplayer:true,humanTeams:[...humans]},{homePermutation}),sequences=new Map();let sequence=0,revision=0,cachedProjection=null;
  const authority={
    game,
    command(team,envelope){
      if(!game.isHuman(team)||!game.teams[team])return protocolError('This session does not control a human house.','forbidden');
      if(!isObject(envelope)||envelope.v!==PROTOCOL_VERSION)return protocolError('Incompatible command protocol.','incompatible');
      if(!Number.isSafeInteger(envelope.seq)||envelope.seq<1)return protocolError('A positive command sequence is required.','sequence');
      let state=sequences.get(team);if(!state){state={last:0,results:new Map()};sequences.set(team,state);}
      const cached=state.results.get(envelope.seq);if(cached)return {...cached,duplicate:true};
      if(envelope.seq!==state.last+1)return {...protocolError('Commands must arrive in order. Resynchronize this session.','sequence'),expectedSeq:state.last+1};
      const result={...executePlayerCommand(game,team,envelope.type,envelope.args),seq:envelope.seq,expectedSeq:envelope.seq+1};revision++;
      state.last=envelope.seq;state.results.set(envelope.seq,result);if(state.results.size>128)state.results.delete(state.results.keys().next().value);
      return result;
    },
    step(dt=1/30){if(!Number.isFinite(dt)||dt<=0||dt>.06)throw new Error('Simulation steps must be between zero and 60 milliseconds.');game.update(dt);sequence++;revision++;},
    projection(){if(!cachedProjection||cachedProjection.revision!==revision)cachedProjection={...prepareSnapshotProjection(game),revision};return cachedProjection;},
    snapshot(team,settings={}){if(!game.teams[team]||!game.isHuman(team))throw new Error('Invalid viewing house.');return {...snapshotWorld(game,team,{...settings,sequence:settings.sequence??sequence}),commandSeq:sequences.get(team)?.last??0};}
  };
  return authority;
}
