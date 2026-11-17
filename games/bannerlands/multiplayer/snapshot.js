import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS,GAME_MODES} from '../core.js';
import {LandsNavigation} from '../navigation.js';
import {CombatTerrain} from '../cover.js';
import {WarVision} from '../vision.js';
import {PROTOCOL_VERSION,GAME_VERSION,ASSET_VERSION,compatible} from './protocol.js';

// Replication is an allowlist, never a JSON clone of the simulation. New AI,
// navigation or economy fields cannot become visible by accident.
const fields=text=>text.split(' ');
const TILE=fields('x y terrain feature featureAxis height value variation');
const IDENTITY=fields('id name motto sigil color dark trait houseColor alliance teamColor teamName house castleName playstyle advantages weaknesses specialist production power');
const PRIVATE_TEAM=fields('gold income count cap tiles alive kills upgrades home rally heroTimer powerReadyAt buffs kingId keeps value banners heroStandardIssued');
const UNIT=fields('id team type x y radius hp maxHp vx vy motionVX motionVY facingX facingY backpedaling attackAnim phase cooldown charging chargeSpeed chargeRunup chargeTravel chargeCooldown chargeElapsed chargeBlockedUntil momentum knockT spawn hit shieldType shieldGuard shieldGuardTime shieldLowerUntil spearState spearReadiness braceTime elite isKing royalReinforcement setupProgress berserkUntil poisonUntil crippledUntil shockUntil snaredUntil stunUntil resolveUntil venomUntil specialGuardUntil stormUntil rushUntil harvestUntil bearUntil pathsUntil disciplineUntil heroProfile heroMode standardId standardBlocked crossbowState reloading aiming');
const BUILDING=fields('id team type x y radius hp maxHp level castleId restoredCastle remembered lastSeen hit progress spawnTimer cooldown musterCooldown');
const STANDARD=fields('id type team owner heroId carrierId x y facingX facingY hp maxHp radius state dormant handlingHeroId bornAt destroyedAt plantedAt');
const ORDER=fields('x y mode formation facingX facingY groupX groupY retreat regroup placementId formationPreset lockFacing slotIndex slotSide slotBack slotBlocked advanceId advanceIndex marchSide marchBack advanceStatus');
const VISUAL=fields('at elapsed cycle dx dy distance action blocked');
const RELOAD=fields('stage progress duration total completed');
const STANDARD_ACTION=fields('kind phase progress duration targetId standardId keepId x y fallen startedAt');
const STANDARD_VISUAL=fields('kind phase fromProgress progress duration until fallen x y');
const PROJECTILE=fields('sx sy x y tx ty t duration type team sourceType crossbow');
const EFFECT=fields('type kind x y dx dy life maxLife team radius strength');
const ZONE=fields('team x y radius life');
const SITE=fields('id name x y radius required progress controller contested team buildingId ruined captures remembered lastSeen');
const OBJECTIVE=fields('id name x y radius required progress controller contested cooldownUntil captures expiresAt wave consumed');
const OBJECTIVE_PUBLIC=fields('id name x y radius required expiresAt wave');
const BODY=fields('id team type kind x y facingX facingY heroMode standardId bornAt pose variant isKing color dark trim sigil skin armor');
const LANDMARK=fields('id name kind x y axis width length');
const CONFIG=fields('house houses humanTeams enemies difficulty scale mode landscape fogOfWar multiplayer');
const MATCH_MODE=fields('id label teams objectiveGoal kingSurvival fixedArmies flagWaves flagRequired flagReinforcements flagInterval controlGoal flagPriority flagCooldown');
const ORDER_FIELDS=fields('id alliance kind x y issuer createdAt launchAt expiresAt');
const COHORT=fields('id x y angle faceX faceY width depth spacing columns ranks preset lockFacing faceInPlace members count radius team status');
const SLOT=fields('index x y side back rank blocked unitId');
const PUBLIC_ORDER=fields('mode formation facingX facingY lockFacing formationPreset');
const PUBLIC_STANDARD_ACTION=fields('kind phase progress duration');
const PUBLIC_STANDARD_VISUAL=fields('kind phase fromProgress progress duration until fallen');
const QUANTIZED=new Set(fields('x y sx sy tx ty groupX groupY facingX facingY vx vy motionVX motionVY phase attackAnim hit life maxLife t dx dy at elapsed cycle distance progress fromProgress duration cooldown setupProgress braceTime shieldGuardTime chargeElapsed chargeSpeed chargeTravel chargeRunup chargeCooldown momentum berserkUntil poisonUntil crippledUntil shockUntil snaredUntil stunUntil resolveUntil venomUntil specialGuardUntil stormUntil rushUntil harvestUntil bearUntil pathsUntil disciplineUntil'));
const transientIds=new WeakMap();
const renderNumber=value=>Math.round(value*1000)/1000;

function safeValue(value,depth=0){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(depth>5)return undefined;
  if(Array.isArray(value))return value.slice(0,16000).map(item=>safeValue(item,depth+1));
  if(value&&Object.getPrototypeOf(value)===Object.prototype){const out={};for(const [key,item]of Object.entries(value))if(!['__proto__','constructor','prototype'].includes(key)){const clean=safeValue(item,depth+1);if(clean!==undefined)out[key]=clean;}return out;}
  return undefined;
}
function pick(value,keys,quantize=false){
  const out={};if(!value)return out;
  for(let index=0;index<keys.length;index++){
    const key=keys[index],item=value[key];if(item===undefined)continue;
    if(typeof item==='number'){out[key]=Number.isFinite(item)?quantize&&QUANTIZED.has(key)?renderNumber(item):item:null;continue;}
    if(item===null||typeof item==='string'||typeof item==='boolean'){out[key]=item;continue;}
    const clean=safeValue(item);if(clean!==undefined)out[key]=clean;
  }
  return out;
}
function point(value){return value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?{x:renderNumber(value.x),y:renderNumber(value.y)}:null;}
function transientId(game,value){let state=transientIds.get(game);if(!state){state={ids:new WeakMap(),next:1};transientIds.set(game,state);}let id=state.ids.get(value);if(!id){id=state.next++;state.ids.set(value,id);}return id;}
export function encodeRuns(values){const result=[];let previous,count=0;for(const value of values){if(count&&value===previous)count++;else{if(count)result.push(previous,count);previous=value;count=1;}}if(count)result.push(previous,count);return result;}
export function decodeRuns(values,length,ArrayType=Int16Array){
  if(!Array.isArray(values)||values.length%2||values.length>length*2)throw new Error('Invalid replicated grid.');
  const result=new ArrayType(length);let index=0;
  for(let i=0;i<values.length;i+=2){const value=values[i],count=values[i+1];if(!Number.isInteger(value)||!Number.isInteger(count)||count<1||index+count>length)throw new Error('Invalid replicated grid run.');result.fill(value,index,index+count);index+=count;}
  if(index!==length)throw new Error('Incomplete replicated grid.');return result;
}

function knownObjectives(game,team,fog){
  const values=fog?game.knownObjectives(team):game.objectives;
  return values.map(value=>!fog||game.isVisibleTo(team,value)?pick(value,OBJECTIVE):{...pick(value,OBJECTIVE_PUBLIC),progress:[],controller:null,contested:false,cooldownUntil:0,unseen:true});
}

function publicUnit(value){
  const out=pick(value,UNIT,true);
  if(value.chargeDir)out.chargeDir=point(value.chargeDir);if(value.braceDir)out.braceDir=point(value.braceDir);
  if(value.attackVisual)out.attackVisual=pick(value.attackVisual,VISUAL,true);if(value.hitVisual)out.hitVisual=pick(value.hitVisual,VISUAL,true);
  if(value.reload)out.reload=pick(value.reload,RELOAD,true);
  if(value.supportVisual)out.supportVisual=pick(value.supportVisual,['at'],true);
  if(value.crannogPoison)out.crannogPoison=pick(value.crannogPoison,['until'],true);
  if(value.healing)out.healing=true;if(value.supportTarget)out.supportTarget=true;if(value.healTarget)out.healTarget=true;
  out.crossbowAim=!!value.crossbowAim;out.pendingShot=!!value.pendingShot;
  return out;
}
// This cache stays on the trusted host and is never part of a wire message.
// Its caller supplies an authority revision so commands made between ticks
// invalidate it as well. Fog filtering and private orders are applied later.
export function prepareSnapshotProjection(game){
  return {game,unitViews:new Map(),unitPatchCache:new WeakMap(),buildings:new Map(game.buildings.map(value=>[value.id,pick(value,BUILDING,true)])),teams:new Map(game.teams.map(value=>[value.id,pick(value,IDENTITY)]))};
}

export function snapshotWorld(game,team,{initial=false,sequence=0,projection=null}={}){
  if(!game.teams[team])throw new Error('Invalid viewing house.');
  const fog=!!game.config.fogOfWar;game.vision?.update();
  const visible=value=>!fog||game.isVisibleTo(team,value);
  const allied=value=>game.allied(team,value.team);
  const units=game.units.filter(value=>value.hp>0&&(allied(value)||visible(value)));
  const buildings=(fog?game.knownBuildings(team):game.buildings).filter(value=>value.hp>0);
  const standards=game.standards.filter(value=>allied(value)||visible(value));
  const knownIds=new Set([...units,...buildings,...standards].map(value=>value.id));
  const ownEntity=value=>allied(value);
  const serializeUnit=value=>{
    // The only seat-specific decisions on a visible soldier are allied orders
    // and visibility of its target. Cache the exact view for this revision.
    const own=ownEntity(value),targetKnown=!!value.target&&knownIds.has(value.target.id);
    const visibility=(own?2:0)+(targetKnown?1:0);
    let views;
    if(projection?.game===game){
      views=projection.unitViews.get(value.id);
      if(views?.[visibility])return views[visibility];
      if(!views){views=[];projection.unitViews.set(value.id,views);}
    }
    const out=publicUnit(value);
    // Aiming animations use a boolean; the simulation's crossbowAim embeds a
    // private target reference and must never be serialized wholesale.
    if(value.order)out.order=pick(value.order,own?ORDER:PUBLIC_ORDER,true);
    if(targetKnown)out.targetId=value.target.id;
    if(value.standardAction&&(own||value.standardAction.phase==='handling'))out.standardAction=pick(value.standardAction,own?STANDARD_ACTION:PUBLIC_STANDARD_ACTION,true);
    if(value.standardVisual)out.standardVisual=pick(value.standardVisual,own?STANDARD_VISUAL:PUBLIC_STANDARD_VISUAL,true);
    if(views)views[visibility]=out;
    return out;
  };
  const data=fog?game.vision.dataFor(team):null,len=game.W*game.H;
  const owners=fog?data.owners:Int16Array.from(game.tiles,value=>value.owner);
  const captures=[];for(let i=0;i<len;i++){const value=game.tiles[i];if(value.capture>0&&(!fog||data.current[i]))captures.push([i,value.claim,value.capture]);}
  const objectives=knownObjectives(game,team,fog),alliance=game.teams[team].alliance;
  // Existing Bannerlands rules publish earned flag scores and cumulative crown
  // control to every council, including AI councils (rival-intelligence.js).
  // A hidden ring's controller, contested state and unfinished capture progress
  // remain private; the public match scoreboard is not that hidden ring state.
  const score=value=>[...value];
  const snapshot={
    v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION,sequence,team,time:game.time,W:game.W,H:game.H,mapName:game.mapName,
    config:pick(game.config,CONFIG),mode:pick(game.mode,MATCH_MODE),winner:game.winner,victoryReason:game.winner!==null?game.victoryReason:'',paused:!!game.paused,
    teams:game.teams.map(value=>{
      const known=!fog||game.allied(team,value.id),out={...(projection?.game===game?projection.teams.get(value.id):pick(value,IDENTITY)),intelKnown:known,alive:true};
      if(known){
        Object.assign(out,pick(value,PRIVATE_TEAM));
        if(value.aiPlan){out.aiPlan=pick(value.aiPlan,fields('role label phase roleReason'));if(value.aiPlan.production)out.aiPlan.production=pick(value.aiPlan.production,fields('status label reason'));}
      }
      else{const king=units.find(unit=>unit.team===value.id&&unit.isKing);if(king)out.kingId=king.id;}
      // Match completion is public. Before then an unobserved faction's hidden
      // defeat, economic activity and relocated home cannot update this view.
      if(game.winner!==null)out.alive=value.alive;
      return out;
    }),
    units:units.map(serializeUnit),
    buildings:buildings.map(value=>({...(!value.remembered&&projection?.game===game?projection.buildings.get(value.id):pick(value,BUILDING,true)),...(ownEntity(value)?{rally:point(value.rally)}:{})})),
    standards:standards.map(value=>{const out=pick(value,STANDARD,true);for(const key of ['heroId','carrierId','handlingHeroId'])if(out[key]!=null&&!knownIds.has(out[key]))out[key]=null;return out;}),
    standardRemains:(game.standardRemains||[]).filter(value=>allied(value)||visible(value)).map(value=>({...pick(value,STANDARD),inert:true})),
    placedFormations:[...(game.placedFormations?.values()||[])].filter(value=>value.members?.some(id=>game.allied(team,game.byId.get(id)?.team))).map(value=>({...pick(value,COHORT),slots:(value.slots||[]).map(slot=>pick(slot,SLOT)),standardAnchor:point(value.standardAnchor)})),
    formationAdvances:[...(game.formationAdvances?.values()||[])].filter(value=>game.allied(team,value.team)).map(value=>({...pick(value,COHORT),slots:(value.slots||[]).map(slot=>pick(slot,SLOT))})),
    projectiles:game.projectiles.filter(value=>visible({x:value.x,y:value.y})).map(value=>{
      const out={...pick(value,PROJECTILE,true),id:transientId(game,value)};
      // Seeing a projectile does not disclose a shooter or destination outside
      // sight. Use its local tangent to retain the authored projectile heading.
      if(fog&&(!visible({x:out.sx,y:out.sy})||!visible({x:out.tx,y:out.ty}))){const dx=out.tx-out.sx,dy=out.ty-out.sy,length=Math.hypot(dx,dy)||1;out.sx=out.x-dx/length*.1;out.sy=out.y-dy/length*.1;out.tx=out.x+dx/length*.1;out.ty=out.y+dy/length*.1;out.duration=1;out.t=.5;}
      return out;
    }),
    effects:game.effects.filter(value=>visible({x:value.x,y:value.y})).map(value=>({...pick(value,EFFECT,true),id:transientId(game,value)})),
    fireZones:(game.fireZones||[]).filter(value=>visible({x:value.x,y:value.y})).map(value=>({...pick(value,ZONE,true),id:transientId(game,value)})),
    castles:(fog?game.knownCastleSites(team):game.castles).map(value=>pick(value,SITE)),objectives,
    objectiveScores:score(game.objectiveScores),controlScores:score(game.controlScores),
    teamOrders:game.teamOrders.filter(value=>value.alliance===alliance).map(value=>pick(value,ORDER_FIELDS)),
    events:game.events.filter(value=>value.team===-1||game.allied(team,value.team)).map(value=>pick(value,fields('id text team time x y'))),
    aftermath:{time:game.aftermath.time,bodies:game.aftermath.bodies.filter(value=>visible({x:value.x,y:value.y})).map(value=>pick(value,BODY))},
    territory:{owners:encodeRuns(owners),captures},
    fog:fog?{visible:encodeRuns(data.current),explored:encodeRuns(data.explored)}:null,
    stats:{battles:units.filter(value=>value.attackAnim>.7).length},nextFlagWaveAt:game.nextFlagWaveAt,flagWave:game.flagWave
  };
  if(initial)snapshot.terrain={tiles:game.tiles.map(value=>pick(value,TILE)),landmarks:(game.landmarks||[]).map(value=>pick(value,LANDMARK)),landscape:pick(game.landscape,fields('id label description')),landsStats:pick(game.landsStats,fields('roads bridges fords passes water mountains')),playable:game.playable};
  return snapshot;
}

class ViewSpatialHash{
  constructor(){this.buckets=new Map();this.size=1.25;}
  rebuild(units){this.buckets.clear();for(const value of units){const key=Math.floor(value.x/this.size)+','+Math.floor(value.y/this.size);let bucket=this.buckets.get(key);if(!bucket)this.buckets.set(key,bucket=[]);bucket.push(value);}}
  visit(x,y,radius,fn){for(let yy=Math.floor((y-radius)/this.size);yy<=Math.floor((y+radius)/this.size);yy++)for(let xx=Math.floor((x-radius)/this.size);xx<=Math.floor((x+radius)/this.size);xx++)for(const value of this.buckets.get(xx+','+yy)||[])fn(value);}
}
function reconcile(previous,next){
  const objects=new Map((previous||[]).map(value=>[value.id,value]));
  return next.map(value=>{const object=objects.get(value.id)||{};for(const key of Object.keys(object))if(!key.startsWith('_')&&!Object.prototype.hasOwnProperty.call(value,key))delete object[key];Object.assign(object,value);return object;});
}
function validateSnapshot(snapshot,initial=false){
  if(!compatible(snapshot)||!Number.isSafeInteger(snapshot.sequence)||snapshot.sequence<0||!Number.isInteger(snapshot.W)||!Number.isInteger(snapshot.H)||snapshot.W<8||snapshot.H<8||snapshot.W>224||snapshot.H>176||!Number.isInteger(snapshot.team)||!Array.isArray(snapshot.teams)||snapshot.teams.length<2||snapshot.teams.length>16||!snapshot.teams[snapshot.team]||!Number.isFinite(snapshot.time))throw new Error('Incompatible or malformed world snapshot.');
  for(const key of ['units','buildings','standards','standardRemains','placedFormations','formationAdvances','projectiles','effects','fireZones','castles','objectives','teamOrders','events'])if(!Array.isArray(snapshot[key])||snapshot[key].length>30000)throw new Error('Invalid entity snapshot.');
  if(initial&&(!snapshot.terrain||!Array.isArray(snapshot.terrain.tiles)||snapshot.terrain.tiles.length!==snapshot.W*snapshot.H))throw new Error('Initial terrain synchronization is required.');
  if(typeof snapshot.mode?.id!=='string'||!Object.hasOwn(GAME_MODES,snapshot.mode.id)||snapshot.config?.mode!==snapshot.mode.id)throw new Error('Invalid campaign mode.');
  const numericTeam=fields('gold income count cap tiles kills heroTimer powerReadyAt keeps value banners');
  for(let id=0;id<snapshot.teams.length;id++){
    const team=snapshot.teams[id];if(team.id!==id||!Number.isInteger(team.house)||!HOUSES[team.house]||!Number.isInteger(team.alliance)||team.alliance<0||team.alliance>=snapshot.teams.length)throw new Error('Invalid house identity.');
    for(const key of numericTeam)if(team[key]!==undefined&&!Number.isFinite(team[key]))throw new Error('Invalid house counters.');
    if(team.upgrades)for(const key of ['weapons','armor','economy'])if(!Number.isInteger(team.upgrades[key])||team.upgrades[key]<0||team.upgrades[key]>500)throw new Error('Invalid upgrade counters.');
  }
  for(const key of ['objectiveScores','controlScores'])if(!Array.isArray(snapshot[key])||snapshot[key].length>16||snapshot[key].some(value=>value!==null&&!Number.isFinite(value)))throw new Error('Invalid objective scores.');
  for(const key of ['units','buildings']){
    const ids=new Set(),defs=key==='units'?UNIT_DEFS:BUILD_DEFS;
    for(const item of snapshot[key]){
      if(!Number.isSafeInteger(item.id)||ids.has(item.id)||!Object.hasOwn(defs,item.type)||!Number.isInteger(item.team)||!snapshot.teams[item.team]||!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(item.hp)||!Number.isFinite(item.maxHp))throw new Error('Invalid battlefield entity.');
      ids.add(item.id);
    }
  }
  for(const key of ['castles','objectives'])for(const item of snapshot[key])if(item.progress!==undefined&&(!Array.isArray(item.progress)||item.progress.length>16||item.progress.some(value=>!Number.isFinite(value))))throw new Error('Invalid objective progress.');
}
function displayTeam(value,mode){
  // House labels, artwork identifiers and descriptive content come from the
  // shipped game. A remote host supplies battle data, not executable UI markup.
  const house=HOUSES[value.house],out={...value,...house,id:value.id,house:value.house,alliance:value.alliance};
  for(const key of ['color','dark','teamColor','houseColor'])out[key]=typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key])?value[key]:key==='dark'?house.dark:house.color;
  out.teamName=mode.teams?'Team '+(value.alliance+1):house.name;
  return out;
}
export function createRemoteGame(snapshot){
  validateSnapshot(snapshot,true);
  // No Game constructor runs in a guest: it would generate hidden starting
  // enemies, resources and AI state locally. Only the filtered world exists.
  const game=Object.create(Game.prototype);
  Object.assign(game,{remote:true,networked:true,playerTeam:snapshot.team,tiles:snapshot.terrain.tiles.map(value=>({...value,owner:-1,claim:-1,capture:0})),landmarks:snapshot.terrain.landmarks||[],landscape:snapshot.terrain.landscape,landsStats:snapshot.terrain.landsStats,playable:snapshot.terrain.playable,W:snapshot.W,H:snapshot.H,byId:new Map(),units:[],buildings:[],standards:[],projectiles:[],effects:[],fireZones:[],castles:[],objectives:[],teamOrders:[],events:[],teams:[],placedFormations:new Map(),formationAdvances:new Map(),standardRemains:[],aftermath:{time:0,bodies:[]},stats:{battles:0},hash:new ViewSpatialHash()});
  game.navigation=new LandsNavigation(game);game.combatTerrain=new CombatTerrain(game);game.vision=new WarVision(game);game.vision.update=()=>{};
  game.update=()=>{};game.updateAftermath=()=>{};
  applySnapshot(game,snapshot);
  // Query defaults follow the assigned seat, while mutation methods are
  // replaced by the transport's command facade before input is enabled.
  for(const name of ['townHallDetails','houseContent','heroFor','standardFor','buildingStatus','incomeFor','powerStatus'])game[name]=(team=game.playerTeam)=>Game.prototype[name].call(game,team);
  for(const name of ['towerDetails','recruitDetails','upgradeDetails','recruitmentOrigin'])game[name]=(value,team=game.playerTeam)=>Game.prototype[name].call(game,value,team);
  return game;
}
export function applySnapshot(game,snapshot){
  validateSnapshot(snapshot);
  if(snapshot.team!==game.playerTeam||snapshot.W!==game.W||snapshot.H!==game.H)throw new Error('The world or assigned seat changed; reload the match.');
  if(game.sequence!==undefined&&snapshot.sequence<game.sequence)return false;
  const len=game.W*game.H,owners=decodeRuns(snapshot.territory?.owners,len),visible=snapshot.fog?decodeRuns(snapshot.fog.visible,len,Uint8Array):null,explored=snapshot.fog?decodeRuns(snapshot.fog.explored,len,Uint8Array):null;
  Object.assign(game,{sequence:snapshot.sequence,time:snapshot.time,commandSeq:snapshot.commandSeq??0,config:{...snapshot.config},mode:{...GAME_MODES[snapshot.mode.id]},mapName:snapshot.mapName,winner:snapshot.winner,victoryReason:snapshot.victoryReason,paused:snapshot.paused,stats:{...snapshot.stats},nextFlagWaveAt:snapshot.nextFlagWaveAt,flagWave:snapshot.flagWave});
  game.teams=snapshot.teams.map(value=>displayTeam(value,game.mode));game.humanTeams=new Set(game.config.humanTeams||[]);
  for(const key of ['units','buildings','standards','projectiles','effects','fireZones','castles','objectives','teamOrders','events'])game[key]=reconcile(game[key],snapshot[key]);
  game.standardRemains=reconcile(game.standardRemains,snapshot.standardRemains);
  for(const key of ['placedFormations','formationAdvances'])game[key]=new Map(reconcile([...(game[key]?.values()||[])],snapshot[key]).map(value=>[value.id,value]));
  game.objectiveScores=[...snapshot.objectiveScores];game.controlScores=[...snapshot.controlScores];game.aftermath={time:snapshot.aftermath?.time??game.time,bodies:reconcile(game.aftermath?.bodies,snapshot.aftermath?.bodies||[])};
  game.byId.clear();for(const entity of [...game.units,...game.buildings,...game.standards])game.byId.set(entity.id,entity);
  for(const value of game.units)value.target=value.targetId===undefined?null:game.byId.get(value.targetId)||null;
  for(let i=0;i<len;i++){const tile=game.tiles[i];tile.owner=owners[i];tile.claim=-1;tile.capture=0;}
  if(!Array.isArray(snapshot.territory.captures)||snapshot.territory.captures.length>len)throw new Error('Invalid capture grid.');
  for(const [index,claim,capture]of snapshot.territory.captures)if(Number.isInteger(index)&&index>=0&&index<len&&Number.isInteger(claim)&&claim>=0&&claim<game.teams.length&&Number.isFinite(capture)&&capture>=0&&capture<=1){game.tiles[index].claim=claim;game.tiles[index].capture=capture;}
  game.vision.revision++;
  if(visible){const data=game.vision.dataFor(game.playerTeam);data.current=visible;data.explored=explored;data.owners=owners;data.units=new Map();data.buildings=new Map(game.buildings.filter(value=>value.remembered).map(value=>[value.id,value]));data.castles=new Map(game.castles.filter(value=>value.remembered).map(value=>[value.id,value]));data.objectives=new Map(game.objectives.map(value=>[value.id,value]));data.territoryCounts=new Int32Array(game.teams.length);for(const owner of owners)if(owner>=0&&owner<game.teams.length)data.territoryCounts[owner]++;}
  game.hash.rebuild(game.units);
  return true;
}
