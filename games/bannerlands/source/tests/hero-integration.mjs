import assert from 'node:assert/strict';
import {Game,HOUSES,UNIT_DEFS} from '../../core.js';
import {heroProfile} from '../../heroes.js';
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function fixture(sigil,state='carrying'){
  const g=new Game({house:HOUSES.findIndex(h=>h.sigil===sigil),enemies:1,landscape:'open',seed:44277});
  g.units=g.units.filter(u=>u.type==='hero');g.byId=new Map([...g.units,...g.buildings,...g.standards].map(u=>[u.id,u]));
  for(const team of g.teams){team.aiClock=1e9;team.heroTimer=0;team.count=1;team.gold=1000;}
  for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
  for(let y=25;y<65;y++)for(let x=25;x<65;x++){const tile=g.tileAt(x,y);tile.terrain='grass';tile.feature=null;tile.owner=0;tile.capture=0;tile.claim=-1;}
  const h=g.heroFor(0);h.x=40;h.y=40;g.hold([h.id]);h.cooldown=1e9;
  const enemy=g.heroFor(1);enemy.x=70;enemy.y=70;g.hold([enemy.id]);enemy.cooldown=1e9;
  const s=g.standardFor(0);Object.assign(s,{state,x:40,y:40,carrierId:state==='carrying'?h.id:null,dormant:false});h.heroMode=state==='carrying'?'carrying':'signature';
  g.navigation.invalidate();g.hash.rebuild(g.units);return {g,h,s};
}
function pair(g,type='infantry',enemy='archer'){
  const u=g.addUnit(0,type,41,40),v=g.addUnit(1,enemy,43,40);g.hold([u.id,v.id]);u.order.formation=v.order.formation='spread';u.facingX=1;u.facingY=0;v.facingX=-1;v.facingY=0;g.hash.rebuild(g.units);return {u,v};
}
test('Every faction hero equips its own signature only with free hands',()=>{
  for(const house of HOUSES){const {g,h,s}=fixture(house.sigil),p=heroProfile(house);close(g.unitDefinition(h).damage,p.sidearm.damage);assert.equal(g.isRanged(h),false);assert.equal(g.unitDefinition(h).shieldType,undefined);s.state='planted';s.carrierId=null;h.heroMode='signature';close(g.unitDefinition(h).damage,p.signature.damage);close(g.unitRange(h),p.signature.range);}
});
test('Consolidated movement removes superseded Commander copies and effects exclude their own hero',()=>{
  const {g,h,s}=fixture('bear'),{u}=pair(g);close(g.movementMultiplier(u),1.06);close(g.movementMultiplier(h),1);u.x=45;close(g.movementMultiplier(u),1);s.state='planted';u.x=41;close(g.recoveryRate(u,'hold'),.0035*1.2);
  const dragon=fixture('dragon'),siege=dragon.g.addUnit(0,'siege',41,40);dragon.g.command([siege.id],44,40,'move','spread');close(dragon.g.movementMultiplier(siege),1.06);siege.x=48;close(dragon.g.movementMultiplier(siege),1);
});
test('Martell withdrawal bonus applies to the real V retreat and facing-locked backward orders',()=>{
  const {g}=fixture('sun'),{u}=pair(g,'archer');const base=g.houseMovementMultiplier(u);g.retreat([u.id]);assert.equal(u.order.retreat,true);close(g.movementMultiplier(u),base*1.06);g.command([u.id],38,40,'move','line',{x:1,y:0});u.facingX=1;u.facingY=0;close(g.movementMultiplier(u),base*1.06);g.command([u.id],44,40,'move','line',{x:1,y:0});close(g.movementMultiplier(u),base);
});
test('Tyrell increases eligible capture progress by exactly eight percent without changing capture power or dominance',()=>{
  const trial=enabled=>{const {g,s}=fixture('rose');if(!enabled)s.dormant=true;const u=g.addUnit(0,'infantry',43,40);const tile=g.tileAt(43,40);tile.owner=-1;tile.capture=0;tile.claim=-1;g.capture(.2);return {progress:tile.capture,power:g.capturePower[40*g.W+43]};};
  const ordinary=trial(false),buffed=trial(true);close(buffed.power,ordinary.power);assert.ok(ordinary.progress>0);close(buffed.progress/ordinary.progress,1.08);
});
test('Lannister kill gold is credited once per real hostile soldier and paid discount is checked at the recruitment origin',()=>{
  const {g,s}=fixture('lion'),{u,v}=pair(g);const gold=g.teams[0].gold;g.damage(v,1000,g.unitSource(u));assert.equal(g.teams[0].gold,gold+1);g.damage(v,1000,g.unitSource(u));assert.equal(g.teams[0].gold,gold+1);
  const post=g.addBuilding(0,'barracks',42,40);g.teams[0].rally={x:42,y:40};const cost=g.recruitDetails('infantry').cost;s.state='planted';s.carrierId=null;assert.equal(g.recruitmentOrigin(0,'infantry'),post);assert.equal(g.recruitDetails('infantry').cost,Math.ceil(cost*.92));
});
test('Melee benefit is evaluated at hit and Bolton finishing damage is twelve percent total',()=>{
  const {g,s}=fixture('flayed'),{u,v}=pair(g);v.maxHp=1000;v.hp=1000;g.damage(v,100,g.unitSource(u));close(v.hp,895);s.state='planted';s.carrierId=null;v.hp=400;g.damage(v,100,g.unitSource(u));close(v.hp,288);s.dormant=true;g.damage(v,100,g.unitSource(u));close(v.hp,188);
});
test('Reed projectile damage snapshots the release bonus and does not recalculate it after the standard goes dormant',()=>{
  const {g,s}=fixture('frog','planted'),{u,v}=pair(g,'archer');g.tileAt(u.x,u.y).terrain='forest';u.cooldown=0;g.attack(u,v);assert.equal(g.projectiles.length,1);close(g.projectiles[0].damage,UNIT_DEFS.archer.damage*1.1);s.dormant=true;const before=v.hp;g.updateProjectiles(2);close(before-v.hp,UNIT_DEFS.archer.damage*1.1);
});
test('Tarly changes remaining reload work continuously without skipping physical stages',()=>{
  const {g,s}=fixture('huntsman','planted'),{u}=pair(g,'gilded_crossbow');u.reload={duration:3,progress:1,stage:'span'};u.reloadX=u.x;u.reloadY=u.y;u.vx=u.vy=0;g.updateCrossbowReload(u,.1);close(u.reload.progress,1.108);assert.equal(u.reload.stage,'span');s.dormant=true;g.updateCrossbowReload(u,.1);close(u.reload.progress,1.208);assert.equal(u.reload.stage,'span');
});
test('Arryn aiming benefits cannot fire an unlocked crossbow at a rear target before actual turning and aim work',()=>{
  const {g}=fixture('falcon','planted'),{u,v}=pair(g,'gilded_crossbow');u.facingX=-1;u.facingY=0;u.order={mode:'idle',x:u.x,y:u.y};g.attack(u,v);g.updateCrossbowAim(u,.2);assert.equal(g.projectiles.length,0);assert.equal(u.crossbowAim.elapsed,0);g.turnFacing(u,1,0,1);g.updateCrossbowAim(u,.17);assert.equal(g.projectiles.length,1);assert.equal(u.crossbowAim,null);
});
test('Tully building protection applies at actual siege impact, with no carried siege immunity',()=>{
  const {g,s}=fixture('fish','planted');const post=g.addBuilding(0,'barracks',42,40),before=post.hp;g.siegeImpact({team:1,sourceType:'siege',tx:42,ty:40,siegeBaseDamage:100,splash:1});close(before-post.hp,270);post.hp=before;s.state='carrying';s.carrierId=g.heroFor(0).id;g.siegeImpact({team:1,sourceType:'siege',tx:42,ty:40,siegeBaseDamage:100,splash:1});close(before-post.hp,300);
});
test('Frey nearest production and Hightower setup advance the existing physical clocks',()=>{
  const {g}=fixture('bridge','planted');const post=g.addBuilding(0,'barracks',42,40);close(g.trainingRate(post),1.1);post.x=46;close(g.trainingRate(post),1);
  const beacon=fixture('beacon'),engine=beacon.g.addUnit(0,'trebuchet',41,40);beacon.g.hold([engine.id]);engine.cooldown=1e9;beacon.g.setTrebuchetDeployment([engine.id],true);beacon.g.updateUnits(.025);close(engine.trebuchetRemaining,10-.027);
});
console.log(`${checks} live hero integration checks passed.`);
