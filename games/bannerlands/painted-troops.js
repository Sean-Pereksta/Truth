import {PAINTED_FRAME_BOUNDS} from './painted-frame-bounds.js';
// Authored raster actions, with the game's original screen-right + mirror facings.
// Logical facing, reach and guard calculations never select an extra art direction.
const walk=[0,1,2,3],death=[13,14,15];
const bow={walk,ready:4,aim:5,fire:6,recovery:7,support:[8,9,10,11],hit:12,death};
const hunt={...bow,aim:6,fire:7,recovery:8,backward:11};
const crossbow={walk,ready:4,aim:5,fire:6,lower:7,span:8,retrieve:9,seat:10,raise:11,hit:12,death};
const polearm={walk,ready:4,backward:5,lower:6,brace:7,thrust:8,swing:9,recovery:10,hit:11,death:[12,13,14,15]};
const mounted={walk,ready:4,backward:5,lower:6,brace:7,thrust:8,recovery:9,guard:10,block:11,hit:12,death};
const shield={walk,ready:4,raise:5,guard:6,block:7,lower:8,thrust:9,recovery:10,turn:11,hit:12,death};
const troop=(type,house,kind,actions,extra={})=>({type,house,kind,columns:4,rows:4,bodyHeight:kind==='mounted'?48:35,bodyHeightRatio:kind==='polearm'?.56:.88,actions,...extra});
export const PAINTED_TROOPS=Object.freeze(Object.fromEntries(Object.entries({
  river_ranger:troop('river_ranger','fish','bow',bow),
  hill_huntsman:troop('hill_huntsman','huntsman','bow',hunt),
  sharpshooter:troop('sharpshooter','fish','crossbow',crossbow,{rowColumns:[4,4,5,4],actions:{...crossbow,span:[8,9],retrieve:10,seat:11,raise:12,hit:13,death:[14,15,16]}}),
  tollhouse_crossbow:troop('tollhouse_crossbow','bridge','crossbow',crossbow),
  vale_sentinel:troop('vale_sentinel','falcon','crossbow',crossbow),
  gilded_crossbow:troop('gilded_crossbow','lion','crossbow',crossbow,{rowColumns:[4,4,5,4],actions:{...crossbow,span:[8,9],retrieve:10,seat:11,raise:12,hit:13,death:[14,15,16]}}),
  winter_pikeman:troop('winter_pikeman','wolf','polearm',polearm,{weaponHeights:2.7,reach:2.1}),
  thornwall_pikeman:troop('thornwall_pikeman','rose','polearm',polearm,{weaponHeights:2.7,reach:2.1}),
  hornhill_halberdier:troop('hornhill_halberdier','huntsman','polearm',polearm,{weaponHeights:2,reach:1.6}),
  bridge_warden:troop('bridge_warden','bridge','polearm',{...polearm,guard:9,block:9},{weaponHeights:2.1,reach:1.65}),
  dread_pike:troop('dread_pike','flayed','polearm',polearm,{weaponHeights:2.7,reach:2.1}),
  crannog_spearhand:troop('crannog_spearhand','frog','polearm',polearm,{weaponHeights:1.8,reach:1.35}),
  dune_skirmisher:troop('dune_skirmisher','sun','polearm',{...polearm,aim:6,fire:8},{weaponHeights:1.5}),
  cavalry:troop('cavalry',null,'mounted',mounted),
  storm_rider:troop('storm_rider','stag','mounted',mounted),
  thorn_lancer:troop('thorn_lancer','rose','mounted',mounted),
  bear_lance_champion:troop('lance_champion','bear','mounted',mounted),
  sun_lance_champion:troop('lance_champion','sun','mounted',mounted),
  falcon_lance_champion:troop('lance_champion','falcon','mounted',mounted),
  infantry:troop('infantry',null,'shield',shield),
  winter_guard:troop('winter_guard','wolf','shield',shield),
  lion_shield_bearer:troop('shield_bearer','lion','shield',shield),
  dragon_shield_bearer:troop('shield_bearer','dragon','shield',shield)
}).map(([id,definition])=>[id,Object.freeze({...definition,...PAINTED_FRAME_BOUNDS[id],id,file:'assets/overhaul/'+id+'.png',facing:'screen-right-mirrored',projectileRelease:{action:'fire',point:[.76,.40]},grip:[.46,.55],contactAction:'thrust',guardActions:definition.actions.guard!=null?['guard','block']:[]})])));

const troopIndex=new Map(Object.values(PAINTED_TROOPS).map(d=>[d.type+'|'+(d.house||''),d]));
export function paintedTroopDefinition(type,house){return troopIndex.get(type+'|'+(house||''))||troopIndex.get(type+'|')||null;}
const actionFrame=(actions,name,phase=0)=>{const v=actions[name];return Array.isArray(v)?v[Math.min(v.length-1,Math.max(0,Math.floor(phase*v.length)))]:v;};
export function selectPaintedFrame(u,g,definition,moving=false){
  const a=definition.actions,now=g.time||0;
  if(u.hp<=0){const age=Math.max(0,now-(u.bornAt??now));return actionFrame(a,'death',Math.min(.999,age/.65));}
  if(u.hitVisual&&now-u.hitVisual.at<.15&&now>=u.hitVisual.at)return u.hitVisual.blocked&&u.shieldGuard==='guard'?(a.block??a.hit??a.ready):(a.hit??a.ready);
  const strike=u.attackVisual,age=strike?(strike.elapsed??now-strike.at):Infinity;
  if(age>=0&&age<(definition.kind==='crossbow'?.10:.32))return age<.10?(a.fire??(strike.action==='swing'?a.swing:a.thrust)??a.thrust??a.ready):(a.recovery??a.ready);
  if(u.reloading&&u.reload&&!moving){
    const stage=u.reload.stage||'span',p=(u.reload.progress||0)/(u.reload.duration||1);
    return actionFrame(a,stage,p)??a.lower??a.ready;
  }
  if(u.crossbowAim||u.aiming||u.pendingShot)return a.aim??a.ready;
  if((u.shieldLowerUntil||0)>now&&a.lower!=null)return a.lower;
  // Readiness is authoritative even during harmless collision adjustments.
  // Real travel orders clear these states immediately in the simulation.
  if(u.spearState==='braced')return a.brace??a.ready;
  if(u.spearState==='lowering')return a.lower??a.ready;
  if(!moving&&a.turn!=null&&Number.isFinite(u.order?.facingX)&&u.facingX*u.order.facingX+u.facingY*u.order.facingY<.985)return a.turn;
  if(u.shieldGuard==='guard')return a.guard??a.ready;
  if(u.shieldGuard==='raising')return a.raise??a.ready;
  if(moving){
    if(u.backpedaling&&a.backward!=null)return a.backward;
    if(u.charging&&a.brace!=null)return a.brace;
    if(u.order?.mode==='advance'&&a.lower!=null)return a.lower;
    const phase=(((u.phase||0)/(Math.PI*2))%1+1)%1;
    return actionFrame(a,'walk',phase);
  }
  if(u.supportVisual&&now-u.supportVisual.at<.8&&now>=u.supportVisual.at)return actionFrame(a,'support',(now-u.supportVisual.at)/.8)??a.ready;
  if(u.healing||u.supportTarget||u.healTarget)return actionFrame(a,'support',(now%1))??a.ready;
  return a.ready??0;
}
