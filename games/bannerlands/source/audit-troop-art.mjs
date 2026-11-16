import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {UNIT_DEFS,HOUSES,HOUSE_CONTENT} from '../core.js';
import {equipmentFor} from '../equipment.js';
import {REGIMENT_BUILDINGS,CONQUEST_BUILDINGS,FRONTIER_BUILDINGS} from '../regiments.js';

// Coverage describes actual PNG evidence. A declared direction, mirrored view,
// aliased action or draft ready-frame fallback is never a verified new cel.
const root=fileURLToPath(new URL('..',import.meta.url));
const production=[...Object.values(REGIMENT_BUILDINGS),...Object.values(CONQUEST_BUILDINGS),...Object.values(FRONTIER_BUILDINGS)];
const common=['ready','march','backward','turn','hit','death'];
const generic=new Set(['infantry','archer','cavalry','siege','hero']);
export const ANIMATION_PHASE_TARGETS=Object.freeze({
 ready:{minimum:1,preferred:2},march:{minimum:4,preferred:8},backward:{minimum:4,preferred:8},advance:{minimum:4,preferred:8},
 attack:{minimum:3,preferred:4},thrust:{minimum:3,preferred:4},aiming:{minimum:3,preferred:4},release:{minimum:1,preferred:1},recovery:{minimum:2,preferred:4},
 hit:{minimum:2,preferred:4},death:{minimum:4,preferred:6},turn:{minimum:4,preferred:4},
 lower:{minimum:4,preferred:4},span:{minimum:4,preferred:8},take_bolt:{minimum:4,preferred:4},seat_bolt:{minimum:4,preferred:4},raise:{minimum:4,preferred:4},support:{minimum:4,preferred:4},couch:{minimum:4,preferred:4},setup:{minimum:4,preferred:4},
 guard:{minimum:1,preferred:2},brace:{minimum:1,preferred:2},block:{minimum:2,preferred:4},packed:{minimum:1,preferred:1},deployed:{minimum:1,preferred:1}
});
function phaseTarget(action){return ANIMATION_PHASE_TARGETS[action]||ANIMATION_PHASE_TARGETS[action.startsWith('backward_')?'backward':action.startsWith('march_')?'march':'turn'];}
function housesFor(type,definition){return [...new Set([definition.house,...production.filter(d=>d.unit===type).map(d=>d.house)].filter(Boolean))];}
function requiredActions(type,definition,equipment){
 const actions=new Set(common),kind=definition.class||type;
 if(equipment.plantedLoss>0)for(const action of ['advance','lower','brace','thrust','recovery'])actions.add(action);
 else if(equipment.kind==='lance')for(const action of ['couch','thrust','recovery'])actions.add(action);
 else if(definition.crossbow){for(const action of ['aiming','release','lower','span','take_bolt','seat_bolt','raise','march_empty','march_spanned','march_bolt_seated','backward_empty','backward_spanned','backward_bolt_seated'])actions.add(action);}
 else if(kind==='archer'||definition.ranged||kind==='siege'){for(const action of ['aiming','release','recovery'])actions.add(action);}
 else for(const action of ['attack','recovery'])actions.add(action);
 if(equipment.shieldClass)for(const action of ['guard','block','lower'])actions.add(action);
 if(type==='river_ranger')actions.add('support');
 if(type==='trebuchet')for(const action of ['packed','setup','deployed'])actions.add(action);
 return [...actions];
}
function legacySource(type,house){
 if(type==='winter_pikeman'||type==='thornwall_pikeman')return null;
 if(generic.has(type))return 'assets/troops-atlas.png';
 if(type==='shield_bearer'||type==='lance_champion')return `assets/regiments/${house}-${type.replaceAll('_','-')}.png`;
 const specialist=Object.entries(HOUSE_CONTENT).find(([,content])=>content.unit===type);if(specialist)return `assets/houses/${specialist[0]}-troops.png`;
 if(Object.values(FRONTIER_BUILDINGS).some(b=>b.unit===type))return `assets/reinforcements/${type}.png`;
 if(['trebuchet','giant','sharpshooter'].includes(type))return `assets/conquest/${type}.png`;
 return null;
}
function definitionFor(manifest,type,house,variant){
 return Object.entries(manifest.troops||{}).find(([key,d])=>(d.type||key.split(':')[0])===type&&(!d.house||d.house===house)&&(!d.variant||d.variant===variant)&&!(variant==='king'&&d.variant!=='king'&&!Object.keys(d.clips||{}).some(k=>k.endsWith('_king'))));
}
function sourceIdentity(frame){return [frame.sheet||'main',frame.cell??'',...(frame.rect||[])].join('|');}
export function buildTroopArtCoverage(manifest={},reviews={}){
 const targets=[];
 for(const [type,definition]of Object.entries(UNIT_DEFS)){
  const houses=housesFor(type,definition),variants=['shield_bearer','lance_champion'].includes(type)?houses.map(house=>({house,variant:'base'})):[{house:houses.length===1?houses[0]:null,variant:'base'}];
  if(type==='hero')variants.push({house:null,variant:'king'});
  for(const {house,variant}of variants){
   const id=type+(house?':'+house:'')+(variant==='king'?':king':''),equipment=equipmentFor(type),targetDirections=equipment.plantedLoss>0?16:8,actions=requiredActions(type,definition,equipment),record=definitionFor(manifest,type,house,variant),entry=record?.[1],review=reviews[id]||reviews[type]||{},qa=entry?.qa||{},aliases=entry?.aliases||{},actionCoverage=[];
   for(const action of actions){
    const clip=entry?.clips?.[action],alias=aliases[action],aliasClip=alias&&entry?.clips?.[alias],source=clip||aliasClip,declared=Array.isArray(source)?source.length:0,identities=new Set((source||[]).flatMap(phases=>(phases||[]).map(sourceIdentity))),direct=!!clip,phaseRule=phaseTarget(action),phaseCounts=(source||[]).map(phases=>phases?.length||0),uniquePhaseCounts=(source||[]).map(phases=>new Set((phases||[]).map(sourceIdentity)).size),minimumDeclaredPhases=phaseCounts.length?Math.min(...phaseCounts):0,minimumUniquePhases=uniquePhaseCounts.length?Math.min(...uniquePhaseCounts):0;
    const verifiedDirections=direct?Math.min(declared,qa.verifiedDirectionsByAction?.[action]||0):qa.approvedAliases?.includes(action)?Math.min(declared,qa.verifiedDirectionsByAction?.[alias]||0):0;
    const verifiedPhases=qa.verifiedPhasesByAction?.[direct?action:alias]||0,animationComplete=verifiedDirections>=targetDirections&&minimumUniquePhases>=phaseRule.minimum&&verifiedPhases>=phaseRule.minimum;
    actionCoverage.push({action,directPaintedClip:direct,alias:alias||null,declaredDirections:declared,uniqueSourceFrames:identities.size,minimumPhasesPerDirection:phaseRule.minimum,preferredPhasesPerDirection:phaseRule.preferred,declaredPhasesPerDirection:phaseCounts,minimumDeclaredPhases,minimumUniquePhases,verifiedPhasesPerDirection:verifiedPhases,missingPhasesPerDirection:Math.max(0,phaseRule.minimum-Math.min(minimumUniquePhases,verifiedPhases)),verifiedDirections,missingDirections:Math.max(0,targetDirections-verifiedDirections),animationComplete,draftFallback:!source&&!!entry?.fallbackAction});
   }
   const source=legacySource(type,house),missingActions=actionCoverage.filter(a=>!a.animationComplete).map(a=>a.action),sourcePNGs=[...new Set(Object.values(entry?.sheets||{}).map(s=>s.src))],candidateSources=review.candidates||[],referenceOnly=!!entry?.referenceOnly||!entry&&candidateSources.length>0&&candidateSources.every(c=>c.referenceOnly),proportionRequired=equipment.kind==='pike'?'approximately 2.5–3 standing body heights':equipment.kind==='spear'||equipment.kind==='halberd'?'complete long shaft at unchanged human body scale':null,proportionsVerified=!proportionRequired||qa.weaponProportionsVerified===true,alphaVerified=qa.alphaVerified===true,complete=!!entry&&!referenceOnly&&!missingActions.length&&proportionsVerified&&alphaVerified;
   targets.push({id,type,label:definition.label,house,variant,legalHouses:houses.length?houses:HOUSES.map(h=>h.sigil),class:definition.class||type,targetDirections,requiredActions:actions,referenceOnly,renderer:entry&&!referenceOnly?'painted-atlas-draft':source?'original-painted-PNG':'awaiting-painted-PNG',activeManifestKey:!referenceOnly?record?.[0]||null:null,referenceManifestKey:referenceOnly?record?.[0]||null:null,declaredDirections:entry?.directions||0,verifiedComplete:complete,status:complete?'verified-complete':referenceOnly?'reference-only':entry?'in-progress':candidateSources.length?'design-review':'pending',legacy:{source,authoredDirections:source?1:0,mirroredDisplayDirections:source?2:0},sourcePNGs,actions:actionCoverage,remainingActions:missingActions,quality:{alphaVerified,weaponProportionsRequired:proportionRequired,weaponProportionsVerified:proportionRequired?proportionsVerified:null,notes:review.issues||[]},candidates:candidateSources});
  }
 }
 return {version:1,policy:{visualSource:'Image-generated painted PNG figures only; no shape-drawn troop fallback.',directions:'At least 8 authored directions for every unit; 16 for foot polearms governing interception.',animation:'Full character animations are required: walk at least 4 phases, preferably 8; attack windup/contact/recovery; hit at least 2; death at least 4; applicable special actions at least 4 phases per direction. A heading sheet or single pose is reference-only.',completion:'Only explicit visually verified per-action direction AND phase counts, alpha, proportions and complete source figures count. Mirroring, repeated source cells, unreviewed aliases and draft ready-frame fallback do not count.',draftFallback:'A complete painted ready frame may keep a draft troop visible while missing actions remain reported; it does not certify readiness, reload or action artwork.'},phaseStandards:ANIMATION_PHASE_TARGETS,summary:{unitTypes:Object.keys(UNIT_DEFS).length,variantTargets:targets.length,targetDirection8:targets.filter(t=>t.targetDirections===8).length,targetDirection16:targets.filter(t=>t.targetDirections===16).length,activePaintedTargets:targets.filter(t=>t.activeManifestKey).length,referenceOnlyTargets:targets.filter(t=>t.referenceOnly).length,declaredWalkAnimationTargets:targets.filter(t=>t.activeManifestKey&&t.actions.some(a=>a.action==='march'&&a.declaredDirections>=t.targetDirections&&a.minimumUniquePhases>=4)).length,verifiedWalkAnimationTargets:targets.filter(t=>t.actions.some(a=>a.action==='march'&&a.animationComplete)).length,verifiedCompleteTargets:targets.filter(t=>t.verifiedComplete).length,incompleteTargets:targets.filter(t=>!t.verifiedComplete).length},targets};
}
export function writeTroopArtCoverage(manifestFile=path.join(root,'assets/painted-troops/manifest.json'),output=path.join(root,'assets/painted-troops/coverage.json')){
 const notesFile=path.join(root,'assets/painted-troops/coverage-notes.json'),manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{},reviews=fs.existsSync(notesFile)?JSON.parse(fs.readFileSync(notesFile,'utf8')):{},report=buildTroopArtCoverage(manifest,reviews);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const report=writeTroopArtCoverage(process.argv[2]?path.resolve(process.argv[2]):undefined,process.argv[3]?path.resolve(process.argv[3]):undefined);console.log(JSON.stringify(report.summary));}
