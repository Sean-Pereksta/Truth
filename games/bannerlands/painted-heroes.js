import {HERO_PROFILES,heroProfile} from './heroes.js';

// Artwork keeps the same two facings as painted troops. World-facing vectors
// remain in the simulation; no compass direction selects another art row.
export const HERO_ART_GRID=Object.freeze({columns:8,rows:8,frames:64,facings:2,facing:'screen-right-mirrored'});
export const HERO_ACTIONS=Object.freeze({
  carryIdle:0,carryWalk:[0,1,2,3],carryAttack:[4,5,6],carryFatigue:7,
  plant:[8,9,10,11,12,13,14,15],
  ready:16,guard:17,walk:[18,19,20,19],attack:[21,22,23],
  pickup:[24,25,26,27,28,29,30,31],
  abortPlant:[32,33],abortPickup:[34,35],fallenPickup:[36,37,38,39],
  lower:40,span:41,retrieve:42,seat:43,raise:44,aim:45,fire:46,recovery:47,
  hit:49,carryHit:48,carryDeath:[50,51,52],death:[53,54,55],
  standard:[56,57],dormant:58,fallen:59,broken:60,collapse:61,aftermath:62,portrait:63
});
export const PAINTED_HEROES=Object.freeze(Object.fromEntries(Object.keys(HERO_PROFILES).map(sigil=>[sigil,Object.freeze({
  ...HERO_ART_GRID,id:'hero-'+sigil,type:'hero',house:sigil,bodyHeight:35,
  file:heroProfile(sigil).artwork,actions:HERO_ACTIONS
})])));
const frameAt=(frames,progress=0)=>frames[Math.min(frames.length-1,Math.max(0,Math.floor(progress*frames.length)))];

export function selectHeroFrame(hero,game,moving=false){
  const now=game.time||0,a=HERO_ACTIONS,carrying=hero.heroMode!=='signature';
  if(hero.hp<=0){const age=Math.max(0,now-(hero.bornAt??now));return frameAt(carrying?a.carryDeath:a.death,Math.min(.999,age/.65));}
  const action=hero.standardAction,visual=hero.standardVisual;
  if(visual?.phase==='abort'&&now<visual.until){
    return frameAt(visual.kind==='plant'?a.abortPlant:a.abortPickup,(visual.progress||0)/(visual.duration||.22));
  }
  if(action?.phase==='handling'){
    const progress=(action.progress||0)/(action.duration||1);
    if(action.kind==='plant')return frameAt(a.plant,progress);
    if(action.kind==='pickup')return frameAt(action.fallen?a.fallenPickup:a.pickup,progress);
    // Refit/replacement uses complete work poses and finishes with a visible
    // received standard, rather than a procedurally attached pole.
    if(progress>.78)return frameAt(a.pickup,(progress-.78)/.22);
    return frameAt([40,41,42,43,44,45],progress/.78);
  }
  if(hero.hitVisual&&now-hero.hitVisual.at>=0&&now-hero.hitVisual.at<.15)return carrying?a.carryHit:a.hit;
  const strike=hero.attackVisual,age=strike?(strike.elapsed??now-strike.at):Infinity;
  if(!carrying&&strike?.action==='fire'&&age>=0&&age<.2)return age<.1?a.fire:a.recovery;
  if(!carrying&&hero.reload&&!moving){const stages={lower:a.lower,span:a.span,retrieve:a.retrieve,seat:a.seat,raise:a.raise};return stages[hero.reload.stage]??a.lower;}
  if(!carrying&&(hero.crossbowAim||hero.aiming||hero.pendingShot))return a.aim;
  if(age>=0&&age<.36)return frameAt(carrying?a.carryAttack:a.attack,age/.36);
  if(moving){let p=(((hero.phase||0)/(Math.PI*2))%1+1)%1;if(hero.backpedaling)p=1-p;return frameAt(carrying?a.carryWalk:a.walk,p);}
  if(carrying)return hero.hp<hero.maxHp*.35?a.carryFatigue:a.carryIdle;
  if(hero.shieldGuard==='guard'||hero.spearState==='braced'||hero.order?.mode==='hold')return a.guard;
  // Brief equipment adjustments belong only to idle moments. Selection and
  // command processing never wait for this cosmetic action.
  if(hero.order?.mode==='idle'&&((now+(hero.id||0)*.17)%9)>.0&&((now+(hero.id||0)*.17)%9)<.38)return a.recovery;
  return a.ready;
}

export function heroOwnsVisibleStandard(hero,game){
  const action=hero?.standardAction,visual=hero?.standardVisual;
  return !!(action?.phase==='handling'||visual?.phase==='abort'&&(game.time||0)<visual.until);
}
export function selectStandardFrame(standard,game){
  const a=HERO_ACTIONS;
  if(standard.state==='destroyed')return game.time-(standard.destroyedAt??-Infinity)<.28?a.collapse:a.aftermath;
  if(standard.state==='fallen')return a.fallen;
  if(standard.dormant)return a.dormant;
  return frameAt(a.standard,((game.time||0)*1.6+(standard.id||0)*.13)%1);
}
