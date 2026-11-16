import {heroProfile,STANDARD_RULES} from './heroes.js';

const distance2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const definition=(g,u)=>g.unitDefinition?.(u)||{};
const kind=(g,u)=>g.unitClass(u);
const troop=(g,u)=>!!u&&u.hp>0&&['infantry','archer','cavalry','siege'].includes(kind(g,u));
const stationary=u=>Math.hypot(u.vx||0,u.vy||0)<.04&&!(u.knockT>0);
const ranged=(g,u)=>!!g.isRanged(u)||kind(g,u)==='archer';
const bowOrJavelin=(g,u)=>{const d=definition(g,u);return ranged(g,u)&&!d.crossbow&&d.projectile!=='bolt';};
const trainingCache=new WeakMap();

// This reads exactly one standard belonging to this army. Allied sources never stack.
export function activeHeroBenefit(g,team,point){
  if(!g.teams[team]?.alive)return null;
  const standard=g.standardFor?.(team)||(g.standards||[]).find(s=>s.team===team);
  if(!standard||standard.hp<=0||standard.dormant||!['carrying','planted'].includes(standard.state))return null;
  const hero=g.byId.get(standard.heroId??standard.carrierId);
  if(!hero||hero.hp<=0||hero.team!==team||hero.standardAction?.phase==='handling')return null;
  const carrying=standard.state==='carrying';
  if(carrying&&standard.carrierId!==hero.id)return null;
  const center=carrying?hero:standard,radius=carrying?STANDARD_RULES.carriedRadius:STANDARD_RULES.plantedRadius;
  if(point&&distance2(point,center)>radius*radius+1e-9)return null;
  return {standard,hero,profile:heroProfile(g.teams[team].sigil),mode:carrying?'carried':'planted',center,radius};
}

export function heroMovementMultiplier(g,u){
  if(!['dragon','stag','sun','kraken','bridge','bear','huntsman','bone'].includes(g.teams[u?.team]?.sigil))return 1;
  if(!troop(g,u))return 1;
  const a=activeHeroBenefit(g,u.team,u);if(a?.mode!=='carried')return 1;
  const k=kind(g,u),mode=u.order?.mode,tile=g.tileAt(u.x,u.y);
  switch(a.profile.sigil){
    case 'dragon':return (k==='siege'||u.type==='dragonfire_acolyte')&&mode==='move'?1.06:1;
    case 'stag':return k==='cavalry'&&!u.charging&&(u.championRegroup||u.order?.regroup||u.order?.retreat||u.order?.placementId||u.order?.advanceId)?1.08:1;
    case 'sun':{
      const target=u.target,dx=target?target.x-u.x:0,dy=target?target.y-u.y:0;
      const goalX=(u.order?.x??u.x)-u.x,goalY=(u.order?.y??u.y)-u.y,goalLength=Math.hypot(goalX,goalY);
      const sideStep=Number.isFinite(u.order?.facingX)&&goalLength>.16&&(goalX*(u.facingX||0)+goalY*(u.facingY||0))/goalLength<.5;
      const withdrawing=u.backpedaling||u.order?.retreat||sideStep||mode==='retreat'||target&&dx*(u.vx||0)+dy*(u.vy||0)<=0&&Math.hypot(u.vx||0,u.vy||0)>.04;
      return bowOrJavelin(g,u)&&withdrawing?1.06:1;
    }
    case 'kraken':return ['infantry','archer'].includes(k)&&tile?.owner>=0&&g.hostile(tile.owner,u.team)?1.06:1;
    case 'bridge':return tile?.owner===u.team?1.06:1;
    case 'bear':return k==='infantry'?1.06:1;
    case 'huntsman':return (k==='infantry'||ranged(g,u))&&u.order?.formation==='line'?1.05:1;
    case 'bone':return k==='infantry'&&['attack','charge'].includes(mode)?1.06:1;
    default:return 1;
  }
}

// A rate changes remaining physical work, never grants a completed action.
export function heroActionRate(g,u,action){
  // Most houses have no benefit for this physical action. Reject those pairs
  // before looking up the standard, hero, radius and profile for every soldier.
  const house=g.teams[u?.team]?.sigil;
  if(!(action==='turn'&&house==='falcon'||action==='setup'&&house==='beacon'||action==='charge-recovery'&&house==='stag'||action==='aim'&&house==='falcon'||action==='reload'&&(house==='beacon'||house==='huntsman')||action==='recovery'&&house==='bear'))return 1;
  if(!troop(g,u))return 1;
  const a=activeHeroBenefit(g,u.team,u);if(!a)return 1;
  const sigil=a.profile.sigil,k=kind(g,u);
  if(a.mode==='carried'){
    if(sigil==='falcon'&&action==='turn'&&ranged(g,u)&&u.target)return 1.08;
    if(sigil==='beacon'&&action==='setup'&&k==='siege'&&stationary(u))return 1.08;
  }else{
    if(sigil==='stag'&&action==='charge-recovery'&&k==='cavalry')return 1.15;
    if(sigil==='falcon'&&action==='aim'&&ranged(g,u)&&stationary(u))return 1.12;
    if(sigil==='beacon'&&action==='reload'&&k==='siege'&&stationary(u))return 1.1;
    if(sigil==='huntsman'&&action==='reload'&&ranged(g,u)&&u.order?.mode==='hold')return 1.08;
    if(sigil==='bear'&&action==='recovery'&&k==='infantry')return 1.2;
  }
  return 1;
}

export function heroSettleDuration(g,u,seconds){
  if(g.teams[u?.team]?.sigil!=='wolf')return seconds;
  const a=troop(g,u)?activeHeroBenefit(g,u.team,u):null;
  return a?.profile.sigil==='wolf'&&a.mode==='carried'&&kind(g,u)==='infantry'?Math.max(.35,seconds*.9):seconds;
}
export function heroKnockbackMultiplier(g,u,frontal){
  if(g.teams[u?.team]?.sigil!=='wolf')return 1;
  const a=troop(g,u)?activeHeroBenefit(g,u.team,u):null;
  return a?.profile.sigil==='wolf'&&a.mode==='planted'&&kind(g,u)==='infantry'&&frontal&&u.spearState==='braced'? .85:1;
}
export function heroCaptureMultiplier(g,u){
  if(g.teams[u?.team]?.sigil!=='rose')return 1;
  const a=troop(g,u)?activeHeroBenefit(g,u.team,u):null;
  return a?.profile.sigil==='rose'&&a.mode==='carried'?1.08:1;
}

// Call for projectile damage at release; melee and brace damage at their actual hit.
export function heroWeaponMultiplier(g,u,target,{projectile=false,brace=false}={}){
  if(!['flayed','kraken','rose','frog','bone'].includes(g.teams[u?.team]?.sigil))return 1;
  if(!troop(g,u))return 1;
  const a=activeHeroBenefit(g,u.team,u);if(!a)return 1;
  const sigil=a.profile.sigil,k=kind(g,u),melee=!projectile&&!ranged(g,u)&&k!=='siege';
  if(sigil==='flayed'&&melee)return a.mode==='carried'?1.05:target?.hp<target?.maxHp*.5?1.12:1.08;
  if(a.mode!=='planted')return 1;
  if(sigil==='kraken'&&k==='infantry'&&melee&&target?.type!=='standard'&&g.buildings.some(b=>b===target))return 1.12;
  if(sigil==='rose'&&brace&&k==='infantry'&&u.spearState==='braced')return 1.1;
  if(sigil==='frog'&&projectile&&ranged(g,u)&&g.tileAt(u.x,u.y)?.terrain==='forest')return 1.1;
  if(sigil==='bone'&&u.hp<u.maxHp*.5)return 1.1;
  return 1;
}
export function heroRangeBonus(g,u){
  if(g.teams[u?.team]?.sigil!=='sun')return 0;
  const a=troop(g,u)?activeHeroBenefit(g,u.team,u):null;
  return a?.profile.sigil==='sun'&&a.mode==='planted'&&bowOrJavelin(g,u) ? .35 : 0;
}
export function heroDamageTakenMultiplier(g,target,source){
  if(g.teams[target?.team]?.sigil!=='fish')return 1;
  if(!target||!source||source.secondary)return 1;
  const a=activeHeroBenefit(g,target.team,target);if(!a)return 1;
  if(a.profile.sigil!=='fish')return 1;
  if(a.mode==='carried'&&troop(g,target)&&source.impactKind==='weapon'&&['arrow','bolt','axe','javelin'].includes(source.projectileType))return .95;
  if(a.mode==='planted'&&g.buildings.some(b=>b===target)&&(source.impactKind==='siege'||source.projectileType==='rock'))return .9;
  return 1;
}
export function heroBurnMultiplier(g,team,point){
  if(g.teams[team]?.sigil!=='dragon')return 1;
  const a=activeHeroBenefit(g,team,point);
  return a?.profile.sigil==='dragon'&&a.mode==='planted'?1.1:1;
}
export function heroTrainingMultiplier(g,building,buildDefinitions){
  if(g.teams[building?.team]?.sigil!=='bridge')return 1;
  const a=activeHeroBenefit(g,building.team,building);
  if(a?.profile.sigil!=='bridge'||a.mode!=='planted')return 1;
  let cache=trainingCache.get(g);
  if(Number.isFinite(g.time)&&cache?.time===g.time&&cache.count===g.buildings.length&&cache.team===building.team&&cache.standardId===a.standard.id)return cache.ids.has(building.id)?1.1:1;
  const nearest=g.buildings.filter(b=>b.team===building.team&&b.hp>0&&buildDefinitions[b.type]?.unit&&distance2(b,a.center)<=a.radius*a.radius)
    .sort((b,c)=>distance2(b,a.center)-distance2(c,a.center)||b.id-c.id).slice(0,2);
  if(Number.isFinite(g.time))trainingCache.set(g,{time:g.time,count:g.buildings.length,team:building.team,standardId:a.standard.id,ids:new Set(nearest.map(b=>b.id))});
  return nearest.includes(building)?1.1:1;
}
export function heroRecruitmentMultiplier(g,team,origin){
  if(g.teams[team]?.sigil!=='lion')return 1;
  const a=origin&&activeHeroBenefit(g,team,origin);
  return a?.profile.sigil==='lion'&&a.mode==='planted'? .92:1;
}
export function heroKillReward(g,target,source){
  const killer=g.sourceUnit(source);
  if(g.teams[killer?.team]?.sigil!=='lion')return 0;
  if(!killer||!troop(g,killer)||!g.hostile(killer.team,target.team)||target.type==='hero'||!['infantry','archer','cavalry','siege'].includes(kind(g,target)))return 0;
  const a=activeHeroBenefit(g,killer.team,killer);
  return a?.profile.sigil==='lion'&&a.mode==='carried'?1:0;
}
export function heroSightMultiplier(g,u){
  if(g.teams[u?.team]?.sigil!=='frog')return 1;
  const a=troop(g,u)?activeHeroBenefit(g,u.team,u):null;
  return a?.profile.sigil==='frog'&&a.mode==='carried'?1.1:1;
}

