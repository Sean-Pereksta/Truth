// Additional regiments share the ordinary infantry/cavalry movement rules,
// while their equipment and recruitment restrictions remain explicit.
export const SHIELD_HOUSES=Object.freeze(['wolf','lion','dragon','rose']);
export const CHAMPION_HOUSES=Object.freeze(['bear','sun','falcon']);
export const CHAMPION_TRAINING_SECONDS=90;
export const REGIMENT_UNITS=Object.freeze({
  shield_bearer:{label:'Shield Bearers',class:'infantry',regiment:true,shieldBearer:true,cost:250,batch:4,hp:260,damage:9,range:.7,speed:1.12,rate:1.15,radius:.17,role:'Heavy shield infantry · strong front, exposed rear',impactName:'Greatshield Front',impact:'Facing the attacker, blocks 75% of arrows and bolts, 65% of melee weapon damage and 55% of charge damage. Rear attacks bypass the shield.'},
  lance_champion:{label:'Lance Champions',class:'cavalry',regiment:true,lanceChampion:true,cost:300,batch:1,hp:265,damage:9,range:1.35,speed:2.05,rate:2.3,radius:.21,role:'Mounted lance champion · powerful first charge, weak follow-up',impactName:'First Lance',impact:'A real charge strikes ahead with a long lance. Its first impact deals 80% extra damage and strong knockback; later impacts and slow follow-up attacks are much weaker. Braced frontal spears can still stop it.'}
});
export const REGIMENT_BUILDINGS=Object.freeze(Object.fromEntries([
  ['wolf','winter_shield_hall','Winter Shield Hall'],
  ['lion','gilded_guard_hall','Gilded Guard Hall'],
  ['dragon','dragonshield_foundry','Dragonshield Foundry'],
  ['rose','rose_guard_pavilion','Roseguard Pavilion'],
  ['bear','bear_lance_lodge','Bear Lance Lodge'],
  ['sun','sun_lance_court','Sun Lance Court'],
  ['falcon','sky_lance_stable','Sky Lance Stable']
].map(([house,type,label])=>{
  const shield=SHIELD_HOUSES.includes(house);
  return [house,{type,label,house,regimentBuilding:true,cost:shield?360:450,hp:shield?1150:1100,interval:shield?32:45,batch:shield?2:1,unit:shield?'shield_bearer':'lance_champion',trainingFactor:.5,radius:.62,role:shield?'Trains 2 shield bearers every 64 seconds before house bonuses':'Trains 1 lance champion every 90 seconds before house bonuses'}];
})));
export function registerRegiments(definitions,buildings=null){
  for(const [type,definition]of Object.entries(REGIMENT_UNITS))definitions[type]={...definition};
  if(buildings)for(const {type,...definition}of Object.values(REGIMENT_BUILDINGS))buildings[type]={...definition};
  // Use the original base values so registration stays safe to repeat in tests
  // and cannot accidentally compound a faction's speed bonus.
  for(const [type,speed]of [['river_ranger',1.52],['freefolk_berserker',1.58],['ironborn_reaver',1.65]])if(definitions[type])definitions[type].speed=Math.round(speed*1.1*1000)/1000;
}
export function regimentForHouse(sigil){return SHIELD_HOUSES.includes(sigil)?'shield_bearer':CHAMPION_HOUSES.includes(sigil)?'lance_champion':null;}
export function regimentAllowed(type,sigil){return type==='shield_bearer'?SHIELD_HOUSES.includes(sigil):type==='lance_champion'?CHAMPION_HOUSES.includes(sigil):false;}
export function regimentBuildingForHouse(sigil){return REGIMENT_BUILDINGS[sigil]?.type||null;}
export function regimentRequiredBuilding(type,sigil){return regimentAllowed(type,sigil)?regimentBuildingForHouse(sigil):null;}
export function shieldFacingMultiplier(target,source){
  if(target?.type!=='shield_bearer'||!source||source.secondary||!['weapon','charge','bolt'].includes(source.impactKind)||source.projectileType==='rock'||!Number.isFinite(source.originX)||!Number.isFinite(source.originY))return 1;
  const dx=source.originX-target.x,dy=source.originY-target.y,length=Math.hypot(dx,dy),fx=target.facingX,fy=target.facingY,facingLength=Math.hypot(fx,fy);
  if(length<.001||!Number.isFinite(facingLength)||facingLength<.5)return 1;
  const dot=(dx*fx+dy*fy)/(length*facingLength);
  if(dot>.5)return source.impactKind==='charge'?.45:source.projectileType==='arrow'||source.projectileType==='bolt'?.25:.35;
  return Math.abs(dot)<.35?.85:1;
}
