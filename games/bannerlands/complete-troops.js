// Image-generated, painted PNG animation atlases. This module draws no soldiers,
// body parts or equipment. It selects complete source frames and their anchors.
import {equipmentFor,poseForUnit} from './equipment.js';
export const TROOP_CELL={bodyHeight:31};
export const TROOP_ACTIONS=['ready','march','backward','advance','turn','lower','brace','thrust','recovery','hit','death','aiming','release','span','take_bolt','seat_bolt','raise','support','guard','block','attack'];
export const TROOP_PHASE_MINIMUMS=Object.freeze({ready:1,march:4,backward:4,advance:4,turn:4,attack:3,thrust:3,aiming:3,release:1,recovery:2,hit:2,death:4,lower:4,span:4,take_bolt:4,seat_bolt:4,raise:4,support:4,couch:4,setup:4,guard:1,brace:1,block:2,packed:1,deployed:1});
export const COMPLETE_TROOP_TYPES=[];
const MOUNTED=new Set(['cavalry','lance_champion','storm_rider','thorn_lancer','sun_horse_archer']);
const BOWS=new Set(['archer','river_ranger','hill_huntsman','crannog_hunter','sun_horse_archer']);
const POLEARMS=new Set(['winter_pikeman','thornwall_pikeman','bridge_warden','dread_pike','crannog_spearhand','hornhill_halberdier']);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const authoredActions=new Set(TROOP_ACTIONS),records=new Map(),recordGroups=new Map(),buildings=new Map(),frameCache=new Map(),missing=new Set();
let cacheHits=0,cacheMisses=0,atlasBytes=0,lastManifest=null;
export const hasCompleteTroopArt=(type,house=null)=>{const group=recordGroups.get(type);return !!group&&(house?group.has(house)||group.has('*'):group.size>0);};
const dimensions=image=>({width:image.naturalWidth||image.width,height:image.naturalHeight||image.height});
const imageLookup=(images,type,sheet,src)=>images instanceof Map?(images.get(type+':'+sheet)||images.get(src)||images.get(sheet)):(images[type+':'+sheet]||images[src]||images[sheet]);
function gridRectangle(image,sheet,frame){
 const size=dimensions(image),columns=sheet.columns||1,rows=sheet.rows||1;
 if(frame.rect)return {sx:frame.rect[0],sy:frame.rect[1],sw:frame.rect[2],sh:frame.rect[3]};
 const index=frame.cell??0,col=index%columns,row=Math.floor(index/columns);if(!Number.isInteger(index)||index<0||row>=rows)throw Error('Painted frame lies outside its declared PNG grid.');
 const sx=Math.floor(col*size.width/columns),sy=Math.floor(row*size.height/rows);return {sx,sy,sw:Math.floor((col+1)*size.width/columns)-sx,sh:Math.floor((row+1)*size.height/rows)-sy};
}
function resolveFrame(type,record,descriptor){
 const sheetName=descriptor.sheet||'main',sheet=record.definition.sheets?.[sheetName],image=record.images[sheetName];if(!sheet||!image)throw Error('Missing painted PNG sheet '+type+':'+sheetName);
 const rect=gridRectangle(image,sheet,descriptor),sourceBodyHeight=descriptor.sourceBodyHeight||sheet.sourceBodyHeight||record.definition.sourceBodyHeight;
 if(!(sourceBodyHeight>0))throw Error('A measured source body height is required for '+type+'; long weapons cannot set body scale.');
 const scale=(record.definition.bodyHeight||31)/sourceBodyHeight,anchor=descriptor.anchor||sheet.anchor||[.5,.88],anchorPixels=descriptor.anchorPixels||sheet.anchorPixels;
 return {image,...rect,width:rect.sw*scale,height:rect.sh*scale,anchorX:(anchorPixels?.[0]??anchor[0]*rect.sw)*scale,anchorY:(anchorPixels?.[1]??anchor[1]*rect.sh)*scale,bodyHeight:record.definition.bodyHeight||31,sourceBodyHeight,scale,painted:true,pose:descriptor.pose||descriptor,sheet:sheetName,source:sheet.src};
}
export function setPaintedTroopAtlases(manifest,images){
 if(manifest?.version!==1||!manifest.troops)throw Error('Unsupported painted troop manifest.');
 records.clear();recordGroups.clear();buildings.clear();frameCache.clear();missing.clear();COMPLETE_TROOP_TYPES.length=0;atlasBytes=0;cacheHits=0;cacheMisses=0;lastManifest=manifest;
 const counted=new Set();
 for(const [key,rawDefinition]of Object.entries(manifest.troops)){
  if(rawDefinition.referenceOnly)continue;
  const type=rawDefinition.type||key.split(':')[0],definition={...rawDefinition,type,key,draft:rawDefinition.draft??manifest.draft??false};
  if(['winter_pikeman','thornwall_pikeman'].includes(type)&&definition.clips?.ready&&!definition.fallbackAction){definition.fallbackAction='ready';definition.draft=true;}
  if(!Number.isInteger(definition.directions)||definition.directions<1||!definition.clips)throw Error('Painted troop '+type+' needs explicit directions and animation clips.');
  const loaded={definition,images:{},key};
  for(const [key,sheet]of Object.entries(definition.sheets||{})){const image=imageLookup(images,type,key,sheet.src);if(!image)throw Error('The generated PNG for '+type+':'+key+' was not loaded.');loaded.images[key]=image;if(!counted.has(image)){const size=dimensions(image);atlasBytes+=size.width*size.height*4;counted.add(image);}}
  for(const [action,directions]of Object.entries(definition.clips)){
   if(!Array.isArray(directions)||directions.length!==definition.directions)throw Error(type+' '+action+' must declare all '+definition.directions+' image directions.');
   for(const [direction,phases]of directions.entries()){if(!Array.isArray(phases)||!phases.length)throw Error(type+' '+action+' direction '+direction+' has no painted frame.');for(const descriptor of phases)resolveFrame(type,loaded,descriptor);}
  }
  for(const [action,target]of Object.entries(definition.aliases||{}))if(!definition.clips[target])throw Error(type+' alias '+action+' targets missing painted clip '+target);
  records.set(key,loaded);if(!recordGroups.has(type)){recordGroups.set(type,new Map());COMPLETE_TROOP_TYPES.push(type);}recordGroups.get(type).set(definition.house||'*',loaded);
 }
 for(const [type,definition]of Object.entries(manifest.buildings||{})){
  const image=imageLookup(images,'building',type,definition.src);if(!image)throw Error('Missing painted production building '+type);const rect=gridRectangle(image,definition,definition),scale=Math.min((definition.drawWidth||100)/rect.sw,(definition.drawHeight||100)/rect.sh);
  buildings.set(type,{image,left:rect.sx,top:rect.sy,width:rect.sw,height:rect.sh,scale,drawWidth:rect.sw*scale,drawHeight:rect.sh*scale,house:definition.house,regimentBuilding:true,paintedPikeHall:true});
 }
 return paintedTroopCoverage();
}
export const loadPaintedTroopAtlases=async(manifestOrURL)=>{
 const manifest=typeof manifestOrURL==='string'?await fetch(manifestOrURL).then(response=>{if(!response.ok)throw Error('Painted troop manifest could not load: '+response.status);return response.json();}):manifestOrURL;
 const sources=new Set();for(const definition of Object.values(manifest.troops||{}).filter(d=>!d.referenceOnly))for(const sheet of Object.values(definition.sheets||{}))sources.add(sheet.src);for(const building of Object.values(manifest.buildings||{}))sources.add(building.src);
 const entries=await Promise.all([...sources].map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([src,image]);image.onerror=()=>reject(Error('Generated painted troop PNG could not load: '+(src.startsWith('data:')?'embedded PNG':src)));image.src=src;})));
 return setPaintedTroopAtlases(manifest,new Map(entries));
};
function clipNameForState(definition,state){
 const base=state.action||'ready',variants=[];
 if(['march','backward','advance'].includes(base)&&(equipmentFor(definition.type||'').reloadStyle||state.equipment?.reloadStyle)&&state.loaded===false){const variant=base+(state.boltSeated?'_bolt_seated':state.cocked?'_spanned':'_empty');variants.push(variant);if(!definition.clips[variant])missing.add((definition.key||definition.type)+':'+variant);}
 if(state.isKing){variants.push(base+'_king');if(!definition.clips[base+'_king'])missing.add((definition.key||definition.type)+':'+base+'_king');}
 variants.push(base);for(const action of variants)if(definition.clips[action])return action;
 const alias=definition.aliases?.[base];if(alias&&definition.clips[alias]){if(!definition.qa?.approvedAliases?.includes(base))missing.add((definition.key||definition.type)+':'+base);return alias;}
 missing.add((definition.key||definition.type||'troop')+':'+base);return definition.fallbackAction&&definition.clips[definition.fallbackAction]?definition.fallbackAction:null;
}
export function completeTroopFrame(type,team,state){
 const group=recordGroups.get(type),record=group?.get(team.sigil)||group?.get('*')||(!team.sigil&&group?.size===1?[...group.values()][0]:null);if(!record)return null;
 const definition=record.definition,action=clipNameForState(definition,state);if(!action)return null;
 const directions=definition.directions,index=((Math.round((state.directionIndex||0)/(state.directions||directions)*directions)%directions)+directions)%directions,clip=definition.clips[action][index],phase=Math.min(clip.length-1,Math.floor((state.phase??((state.frame||0)/7))*clip.length)),key=[record.key,state.action,state.isKing?'king':'',state.loaded===false?(state.boltSeated?'bolt':state.cocked?'spanned':'empty'):'loaded',action,index,phase].join('|');
 if(frameCache.has(key)){cacheHits++;return frameCache.get(key);}cacheMisses++;
 const requestedAction=state.action||'ready',requestedClip=state.isKing?requestedAction+'_king':['march','backward','advance'].includes(requestedAction)&&state.loaded===false&&state.equipment?.reloadStyle?requestedAction+(state.boltSeated?'_bolt_seated':state.cocked?'_spanned':'_empty'):requestedAction,cel={...resolveFrame(type,record,clip[phase]),action,requestedAction,requestedClip,draftFallback:action!==requestedClip&&!definition.qa?.approvedAliases?.includes(requestedClip),directionIndex:index,directions,frame:phase};frameCache.set(key,cel);return cel;
}
export function pikeProductionFrame(type,house){const frame=buildings.get(type);return frame&&(!frame.house||house===frame.house)?frame:null;}
export function paintedTroopCoverage(){
 const troops={};for(const [key,{definition}]of records){
  const e=equipmentFor(definition.type),required=e.plantedLoss>0?16:8,qa=definition.qa||{},ranged=BOWS.has(definition.type)||['dune_skirmisher','saltwind_axethrower','dragonfire_acolyte','beacon_engineer','siege'].includes(definition.type),requiredActions=definition.requiredActions||['ready','march','backward','turn','hit','death',...(e.plantedLoss>0?['advance','lower','brace','thrust','recovery']:e.reloadStyle?['aiming','release','lower','span','take_bolt','seat_bolt','raise']:ranged?['aiming','release','recovery']:['attack','recovery'])],phaseCounts={};
  const verified=requiredActions.filter(action=>{const alias=definition.aliases?.[action],source=definition.clips[action]?action:qa.approvedAliases?.includes(action)?alias:null,clip=source&&definition.clips[source],minimum=TROOP_PHASE_MINIMUMS[action]||4,unique=clip?.length?Math.min(...clip.map(phases=>new Set(phases.map(frame=>[frame.sheet,frame.cell,...(frame.rect||[])].join('|'))).size)):0;phaseCounts[action]={minimum,uniquePerDirection:unique,verifiedPerDirection:qa.verifiedPhasesByAction?.[source]||0};return source&&(qa.verifiedDirectionsByAction?.[source]||0)>=required&&unique>=minimum&&(qa.verifiedPhasesByAction?.[source]||0)>=minimum;});
  troops[key]={directions:definition.directions,requiredDirections:required,actions:Object.keys(definition.clips),aliases:definition.aliases||{},phaseCounts,missingDirections:Math.max(0,required-definition.directions),missingVerifiedActions:requiredActions.filter(action=>!verified.includes(action)),draftFallback:definition.fallbackAction||null,complete:!definition.draft&&definition.directions>=required&&verified.length===requiredActions.length&&qa.alphaVerified===true&&(e.kind!=='pike'||qa.weaponProportionsVerified===true)};
 }
 return {version:1,source:'painted PNG atlases',troops,referenceOnly:Object.entries(lastManifest?.troops||{}).filter(([,d])=>d.referenceOnly).map(([key])=>key),buildings:[...buildings.keys()],missingFrames:[...missing],atlasBytes};
}
export function completeArtCacheInfo(){return {frames:frameCache.size,bytes:atlasBytes,maxBytes:atlasBytes,maxFrames:Infinity,hits:cacheHits,misses:cacheMisses,source:'painted PNG atlases'};}

export function authoredAnimationState(u,g,definition={}){
 const equipment=equipmentFor(u.type),pose=poseForUnit(u),speed=Math.hypot(u.motionVX??u.vx??0,u.motionVY??u.vy??0);
 let action=pose.action||'ready',phase=0;
 const event=u.attackVisual,age=event?(g.time||0)-event.at:Infinity;
 if(u.hp<=0){action='death';phase=clamp(((g.time??g.aftermath?.time??0)-(u.bornAt??-.45))/.45,0,1);}
 else if(u.hitVisual&&g.time-u.hitVisual.at<.18){action=u.hitVisual.blocked?'block':'hit';phase=clamp((g.time-u.hitVisual.at)/.18,0,1);}
 else if((u.releaseFrame||0)>0){action='release';phase=1-clamp(u.releaseFrame/.1,0,1);}
 else if(u.reloading&&u.reload){
   const stage=u.reload.stage;action=stage||crossbowStage((u.reload.progress||0)/(u.reload.duration||1));
   phase=stage?clamp((u.reload.stageProgress||0)/(u.reload.stageDuration||1),0,1):clamp((u.reload.progress||0)/(u.reload.duration||1),0,1);
 }else if(u.pendingShot){action='aiming';phase=clamp((u.pendingShot.aimProgress||0)/(u.pendingShot.aimDuration||(definition.crossbow?.24:.2)),0,1);}
 else if(age>=0&&age<.34){action=equipment.reloadStyle||definition.crossbow||BOWS.has(u.type)||equipment.kind==='javelin'||u.type==='saltwind_axethrower'?age<.1?'release':'recovery':POLEARMS.has(u.type)||MOUNTED.has(u.type)?age<.16?'thrust':'recovery':'attack';phase=clamp(age/.34,0,1);}
 else if((u.supportUntil||0)>g.time){action='support';phase=1-clamp((u.supportUntil-g.time)/.65,0,1);}
 else if(speed>.07){action=u.backpedaling?'backward':u.order?.mode==='advance'?'advance':'march';phase=((u.phase||0)/(Math.PI*2)%1+1)%1;}
 else if(pose.action==='lower')phase=clamp((u.braceTime||0)/.5,0,1);
 const directions=equipment.directions||((POLEARMS.has(u.type)||MOUNTED.has(u.type))?16:8),directionIndex=Number.isFinite(pose.directionIndex)?pose.directionIndex:((Math.round(Math.atan2(u.facingY||0,u.facingX??1)/(Math.PI*2)*directions)%directions)+directions)%directions;
 const frame=action==='lower'?Math.floor(phase*7):Math.min(7,Math.floor(phase*8)),tipReach=pose.tip?Math.hypot(pose.tip.x-u.x,pose.tip.y-u.y):equipment.reach;
 return {action:authoredActions.has(action)?action:'ready',frame,directionIndex,directions,phase,equipment,shieldPresented:pose.shieldPresented,tipReach,isKing:!!u.isKing,loaded:!u.reload,cocked:!u.reload||(u.reload.stageIndex||0)>=2,boltSeated:!u.reload||(u.reload.stageIndex||0)>=4};
}
function crossbowStage(t){return t<.12?'lower':t<.65?'span':t<.76?'take_bolt':t<.9?'seat_bolt':'raise';}
