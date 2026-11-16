// Equipment and authored pose geometry are shared by combat and complete-frame art.
// World distances are grid cells; direction indexes are the atlas camera directions.
const PI2=Math.PI*2;
const pole=(kind,reach,plantedLoss,directions=16)=>Object.freeze({kind,reach,plantedLoss,movingLoss:.3,directions,shieldClass:null});
export const EQUIPMENT=Object.freeze({
  winter_pikeman:pole('pike',2.25,.9),thornwall_pikeman:pole('pike',2.25,.9),
  dread_pike:pole('pike',2.1,.9),bridge_warden:pole('spear',1.6,.8),
  crannog_spearhand:pole('spear',1.4,.5),hornhill_halberdier:pole('halberd',1.7,.6),
  cavalry:pole('lance',1.3,0,8),lance_champion:pole('lance',1.65,0,8),
  storm_rider:pole('lance',1.45,0,8),thorn_lancer:pole('lance',1.55,0,8),
  dune_skirmisher:Object.freeze({kind:'javelin',reach:1.1,directions:8,shieldClass:null}),
  shield_bearer:Object.freeze({kind:'sword',reach:.7,directions:8,shieldClass:'heavy'}),
  winter_guard:Object.freeze({kind:'sword',reach:.7,directions:8,shieldClass:'small'}),
  infantry:Object.freeze({kind:'sword',reach:.64,directions:8,shieldClass:'small'}),
  gilded_crossbow:Object.freeze({kind:'crossbow',directions:8,reloadStyle:'belt',shieldClass:null}),
  tollhouse_crossbow:Object.freeze({kind:'crossbow',directions:8,reloadStyle:'lever',shieldClass:null}),
  sharpshooter:Object.freeze({kind:'crossbow',directions:8,reloadStyle:'windlass',shieldClass:null}),
  vale_sentinel:Object.freeze({kind:'crossbow',directions:8,reloadStyle:'compact_lever',shieldClass:null})
});
const DEFAULT=Object.freeze({kind:'ordinary',directions:8,shieldClass:null});
export const RELOAD_STAGES=Object.freeze([
  Object.freeze({name:'lower',fraction:.12,label:'Spanning'}),
  Object.freeze({name:'span',fraction:.48,label:'Spanning'}),
  Object.freeze({name:'take_bolt',fraction:.12,label:'Loading Bolt'}),
  Object.freeze({name:'seat_bolt',fraction:.16,label:'Loading Bolt'}),
  Object.freeze({name:'raise',fraction:.12,label:'Ready'})
]);
export function equipmentFor(type){return EQUIPMENT[typeof type==='string'?type:type?.type]||DEFAULT;}
export function weaponDirection(u){
  const directions=equipmentFor(u).directions,angle=Math.atan2(u.facingY||0,u.facingX??1);
  const index=((Math.round(angle/PI2*directions)%directions)+directions)%directions,a=index*PI2/directions;
  return {x:Math.cos(a),y:Math.sin(a),angle:a,index,directions};
}
export function poseForUnit(u){
  const e=equipmentFor(u),dir=weaponDirection(u),speed=Math.hypot(u.vx||0,u.vy||0),polearm=e.plantedLoss>0;
  let action=u.hp<=0?'death':u.knockT>0||u.hit>0?'hit':u.reload&&u.reloading?u.reload.stage:u.pendingShot?'aiming':u.attackAnim>.42?'thrust':u.attackAnim>0?'recovery':u.readyState==='Turning'?'turn':u.readyState==='Lowering'?'lower':u.readyState==='Braced'?'brace':speed>.03?(u.backpedaling?'backward':'march'):'ready';
  if(e.kind==='crossbow'&&u.releaseFrame>0)action='release';
  if(e.shieldClass&&u.hit>0&&u.hitVisual?.blocked)action='block';
  const loweringProgress=action==='lower'?Math.floor(Math.max(0,Math.min(1,(u.braceTime||0)/.5))*7)/7:1;
  const presented=!['hit','death','turn'].includes(action)&&!!(polearm&&u.hp>0&&!(u.knockT>0)&&(['Lowering','Braced'].includes(u.readyState)&&loweringProgress>.2)||polearm&&u.hp>0&&!(u.knockT>0)&&(u.order?.mode==='advance'||u.backpedaling)&&u.readyState!=='Turning');
  const thrustExtension=polearm?(u.attackAnim>.42?.16:u.attackAnim>0?.06:0):0;
  const point=distance=>({x:u.x+dir.x*distance,y:u.y+dir.y*distance});
  const shieldPresented=!!(e.shieldClass&&u.hp>0&&!(u.knockT>0)&&u.readyState!=='Disrupted'&&speed<.15&&u.attackAnim<.35&&!['hit','turn','lower','march','backward','thrust','death'].includes(action));
  return {action,directionIndex:dir.index,directions:dir.directions,angle:dir.angle,direction:{x:dir.x,y:dir.y},grip:point(.12),tip:point(((e.reach||.5)+thrustExtension)*loweringProgress),release:point(.28),releaseHeight:u.type==='vale_sentinel'?11:['cavalry','lance_champion','storm_rider','thorn_lancer','sun_horse_archer'].includes(u.type)?38:15,shieldFacing:{x:dir.x,y:dir.y},shieldPresented,presented,loweringProgress,contactPhase:.42};
}
// Earliest intersection between the horse's swept disc and the forward shaft.
// The line segment, including its tip, remains bounded by the authored weapon.
export function sweptWeaponContact(from,to,grip,tip,radius){
  const dx=to.x-from.x,dy=to.y-from.y,wx=tip.x-grip.x,wy=tip.y-grip.y,len=wx*wx+wy*wy;
  const distance=t=>{const x=from.x+dx*t,y=from.y+dy*t,q=len?Math.max(0,Math.min(1,((x-grip.x)*wx+(y-grip.y)*wy)/len)):0;return Math.hypot(x-grip.x-wx*q,y-grip.y-wy*q);};
  // Squared distance to a segment is convex along a segment. Locate its minimum
  // then bisect the first capsule entry; this also catches a fast tip crossing.
  let lo=0,hi=1;for(let i=0;i<18;i++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(distance(a)<distance(b))hi=b;else lo=a;}
  const closest=(lo+hi)/2;if(distance(closest)>radius&&distance(0)>radius&&distance(1)>radius)return null;
  if(distance(0)<=radius)return {t:0,x:from.x,y:from.y};
  lo=0;hi=distance(closest)<=radius?closest:1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(distance(m)<=radius)hi=m;else lo=m;}
  return {t:hi,x:from.x+dx*hi,y:from.y+dy*hi};
}
export function migrateRegimentState(state){
  // Mutate records in place: IDs, command groups, orders, upgrades and references survive.
  const teams=state.teams||[];
  for(const u of state.units||[]){const sigil=teams[u.team]?.sigil;if(u.type!=='shield_bearer'||!['wolf','rose'].includes(sigil))continue;u.type=sigil==='wolf'?'winter_pikeman':'thornwall_pikeman';u.shieldBearer=false;u.shieldClass=null;u.regimentMigrationVersion=1;}
  for(const b of state.buildings||[]){if(b.type==='winter_shield_hall')b.type='winter_pike_hall';else if(b.type==='rose_guard_pavilion')b.type='thornwall_drill_hall';}
  return state;
}
