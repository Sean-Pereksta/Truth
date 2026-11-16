import assert from 'node:assert/strict';
import {HERO_PROFILES} from '../../heroes.js';
import {activeHeroBenefit,heroMovementMultiplier,heroActionRate,heroSettleDuration,heroKnockbackMultiplier,heroCaptureMultiplier,heroWeaponMultiplier,heroRangeBonus,heroDamageTakenMultiplier,heroBurnMultiplier,heroTrainingMultiplier,heroRecruitmentMultiplier,heroKillReward,heroSightMultiplier} from '../../hero-benefits.js';

let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function fixture(sigil,mode='carrying'){
  const hero={id:1,team:0,type:'hero',hp:800,x:10,y:10};
  const u={id:2,team:0,type:'infantry',hp:100,maxHp:100,x:11,y:10,order:{mode:'move',formation:'line'}};
  const standard={id:3,team:0,heroId:1,carrierId:mode==='carrying'?1:null,x:10,y:10,state:mode,hp:300,dormant:false};
  const g={teams:[{alive:true,sigil},{alive:true,sigil:'wolf'}],standards:[standard],byId:new Map([[1,hero],[2,u]]),buildings:[],
    standardFor:team=>team===0?standard:null,unitClass:v=>typeof v==='string'?v:v.kind||v.type,
    unitDefinition:v=>v.definition||{},isRanged:v=>v.kind==='archer'||v.type==='archer'||v.definition?.ranged,
    tileAt:()=>({owner:0,terrain:'grass'}),hostile:(a,b)=>a!==b&&a>=0&&b>=0,sourceUnit:s=>g.byId.get(s.sourceId)};
  return {g,hero,u,standard};
}
test('Sixteen original profiles have distinct identities, two facings and explicit mutually exclusive benefits',()=>{
  const values=Object.values(HERO_PROFILES);assert.equal(values.length,16);assert.equal(new Set(values.map(p=>p.name)).size,16);
  for(const p of values){assert.equal(p.facings,2);assert.equal(p.otherFacing,'horizontal-mirror');assert.ok(p.carried.name&&p.planted.name);assert.ok(p.signature.damage>0);}
});
test('Source follows the carrier, respects foot-radius boundaries and never stacks with an ally',()=>{
  const {g,hero,u,standard}=fixture('bear');u.x=13;assert.ok(activeHeroBenefit(g,0,u));u.x=13.001;assert.equal(activeHeroBenefit(g,0,u),null);
  standard.x=90;hero.x=11;assert.ok(activeHeroBenefit(g,0,u));u.team=1;assert.equal(heroMovementMultiplier(g,u),1);
});
test('Death, dormant standards, handling and all inactive states suppress every benefit immediately',()=>{
  const {g,hero,u,standard}=fixture('bear');assert.equal(heroMovementMultiplier(g,u),1.06);
  for(const state of ['planting','picking-up','fallen','destroyed']){standard.state=state;assert.equal(heroMovementMultiplier(g,u),1);}
  standard.state='carrying';standard.dormant=true;assert.equal(heroMovementMultiplier(g,u),1);standard.dormant=false;
  hero.standardAction={phase:'handling'};assert.equal(heroMovementMultiplier(g,u),1);delete hero.standardAction;
  hero.hp=0;assert.equal(heroMovementMultiplier(g,u),1);hero.hp=800;g.teams[0].alive=false;assert.equal(heroMovementMultiplier(g,u),1);
});
test('Stark changes real settling duration with a minimum and protects only frontal already-braced infantry',()=>{
  const {g,u,standard}=fixture('wolf');assert.equal(heroSettleDuration(g,u,.5),.45);assert.equal(heroSettleDuration(g,u,.2),.35);
  assert.equal(heroKnockbackMultiplier(g,u,true),1);standard.state='planted';u.spearState='braced';assert.equal(heroKnockbackMultiplier(g,u,true),.85);assert.equal(heroKnockbackMultiplier(g,u,false),1);
});
test('Lannister rewards one real nearby soldier kill and discounts only eligible paid recruitment origins',()=>{
  const {g,u,standard}=fixture('lion'),victim={team:1,type:'archer',hp:0};assert.equal(heroKillReward(g,victim,{sourceId:u.id}),1);
  assert.equal(heroKillReward(g,{...victim,team:0},{sourceId:u.id}),0);u.x=20;assert.equal(heroKillReward(g,victim,{sourceId:u.id}),0);
  standard.state='planted';assert.equal(heroRecruitmentMultiplier(g,0,{x:10,y:10}),.92);assert.equal(heroRecruitmentMultiplier(g,0,{x:20,y:10}),1);
});
test('Targaryen grants only Move siege escort and once-only burning-ground scaling at the damaged point',()=>{
  const {g,u,standard}=fixture('dragon');assert.equal(heroMovementMultiplier(g,u),1);u.kind='siege';assert.equal(heroMovementMultiplier(g,u),1.06);u.order.mode='attack';assert.equal(heroMovementMultiplier(g,u),1);
  standard.state='planted';assert.equal(heroBurnMultiplier(g,0,u),1.1);assert.equal(heroBurnMultiplier(g,0,{x:30,y:30}),1);
});
test('Baratheon grants regroup speed without charging and advances only actual charge recovery',()=>{
  const {g,u,standard}=fixture('stag');u.kind='cavalry';assert.equal(heroMovementMultiplier(g,u),1);u.championRegroup={};assert.equal(heroMovementMultiplier(g,u),1.08);u.charging=true;assert.equal(heroMovementMultiplier(g,u),1);
  standard.state='planted';assert.equal(heroActionRate(g,u,'charge-recovery'),1.15);assert.equal(heroActionRate(g,u,'reload'),1);
});
test('Tyrell affects ordinary capture and only actual braced contact damage',()=>{
  const {g,u,standard}=fixture('rose');assert.equal(heroCaptureMultiplier(g,u),1.08);standard.state='planted';assert.equal(heroCaptureMultiplier(g,u),1);
  assert.equal(heroWeaponMultiplier(g,u,null,{brace:true}),1);u.spearState='braced';assert.equal(heroWeaponMultiplier(g,u,null,{brace:true}),1.1);assert.equal(heroWeaponMultiplier(g,u,null),1);
});
test('Martell excludes crossbows from bow/javelin withdrawal speed and extra range',()=>{
  const {g,u,standard}=fixture('sun');u.kind='archer';u.order.mode='retreat';assert.equal(heroMovementMultiplier(g,u),1.06);u.definition={crossbow:true};assert.equal(heroMovementMultiplier(g,u),1);
  standard.state='planted';assert.equal(heroRangeBonus(g,u),0);u.definition={};assert.equal(heroRangeBonus(g,u),.35);
});
test('Greyjoy requires enemy ground for march and direct infantry damage to an enemy building',()=>{
  const {g,u,standard}=fixture('kraken');assert.equal(heroMovementMultiplier(g,u),1);g.tileAt=()=>({owner:1});assert.equal(heroMovementMultiplier(g,u),1.06);
  standard.state='planted';const post={type:'barracks'};g.buildings.push(post);assert.equal(heroWeaponMultiplier(g,u,post),1.12);assert.equal(heroWeaponMultiplier(g,u,{type:'archer'}),1);
});
test('Arryn accelerates actual tracking and stationary aim without touching reload stages',()=>{
  const {g,u,standard}=fixture('falcon');u.kind='archer';assert.equal(heroActionRate(g,u,'turn'),1);u.target={};assert.equal(heroActionRate(g,u,'turn'),1.08);
  standard.state='planted';assert.equal(heroActionRate(g,u,'aim'),1.12);assert.equal(heroActionRate(g,u,'reload'),1);u.vx=1;assert.equal(heroActionRate(g,u,'aim'),1);
});
test('Bolton uses total 12 percent finishing damage and excludes projectile benefits',()=>{
  const {g,u,standard}=fixture('flayed'),target={hp:20,maxHp:100};assert.equal(heroWeaponMultiplier(g,u,target),1.05);standard.state='planted';assert.equal(heroWeaponMultiplier(g,u,target),1.12);target.hp=50;assert.equal(heroWeaponMultiplier(g,u,target),1.08);assert.equal(heroWeaponMultiplier(g,u,target,{projectile:true}),1);
});
test('Frey buffs exactly the nearest two living owned production posts inside the radius',()=>{
  const {g,u,standard}=fixture('bridge');assert.equal(heroMovementMultiplier(g,u),1.06);standard.state='planted';
  const posts=[1,2,3].map((d,i)=>({id:20+i,team:0,type:'barracks',hp:100,x:10+d,y:10}));g.buildings.push(...posts,{id:40,team:0,type:'tower',hp:100,x:10,y:10});const defs={barracks:{unit:'infantry'},tower:{}};
  assert.deepEqual(posts.map(b=>heroTrainingMultiplier(g,b,defs)),[1.1,1.1,1]);posts[0].hp=0;assert.equal(heroTrainingMultiplier(g,posts[2],defs),1.1);
});
test('Mormont recovery is a rate modifier; no hero is a recipient',()=>{
  const {g,u,hero,standard}=fixture('bear');assert.equal(heroMovementMultiplier(g,u),1.06);assert.equal(heroMovementMultiplier(g,hero),1);standard.state='planted';assert.equal(heroActionRate(g,u,'recovery'),1.2);assert.equal(heroActionRate(g,hero,'recovery'),1);
});
test('Tully distinguishes carried projectile defense and planted building siege defense',()=>{
  const {g,u,standard}=fixture('fish'),source={impactKind:'weapon',projectileType:'bolt'};assert.equal(heroDamageTakenMultiplier(g,u,source),.95);assert.equal(heroDamageTakenMultiplier(g,u,{impactKind:'weapon'}),1);
  const post={type:'keep',team:0,x:12,y:10};g.buildings.push(post);standard.state='planted';assert.equal(heroDamageTakenMultiplier(g,post,{impactKind:'siege'}),.9);assert.equal(heroDamageTakenMultiplier(g,post,source),1);
});
test('Reed sight follows ordinary visibility and projectile bonus requires woodland',()=>{
  const {g,u,hero,standard}=fixture('frog');assert.equal(heroSightMultiplier(g,u),1.1);assert.equal(heroSightMultiplier(g,hero),1);standard.state='planted';u.kind='archer';assert.equal(heroWeaponMultiplier(g,u,null,{projectile:true}),1);g.tileAt=()=>({terrain:'forest'});assert.equal(heroWeaponMultiplier(g,u,null,{projectile:true}),1.1);assert.equal(heroSightMultiplier(g,u),1);
});
test('Hightower speeds stationary setup and stationary siege reload, never moving work',()=>{
  const {g,u,standard}=fixture('beacon');u.kind='siege';assert.equal(heroActionRate(g,u,'setup'),1.08);u.vx=1;assert.equal(heroActionRate(g,u,'setup'),1);u.vx=0;standard.state='planted';assert.equal(heroActionRate(g,u,'reload'),1.1);assert.equal(heroActionRate(g,u,'setup'),1);
});
test('Tarly needs Line for carried march and Hold for planted ranged recovery',()=>{
  const {g,u,standard}=fixture('huntsman');assert.equal(heroMovementMultiplier(g,u),1.05);u.order.formation='spread';assert.equal(heroMovementMultiplier(g,u),1);standard.state='planted';u.kind='archer';assert.equal(heroActionRate(g,u,'reload'),1);u.order.mode='hold';assert.equal(heroActionRate(g,u,'reload'),1.08);
});
test('Free Folk requires attack approach or low-health planted direct weapon damage',()=>{
  const {g,u,standard}=fixture('bone');assert.equal(heroMovementMultiplier(g,u),1);u.order.mode='attack';assert.equal(heroMovementMultiplier(g,u),1.06);standard.state='planted';assert.equal(heroWeaponMultiplier(g,u,null),1);u.hp=49;assert.equal(heroWeaponMultiplier(g,u,null),1.1);assert.equal(heroWeaponMultiplier(g,u,null,{projectile:true}),1.1);
});
console.log(`${checks} hero benefit checks passed.`);
