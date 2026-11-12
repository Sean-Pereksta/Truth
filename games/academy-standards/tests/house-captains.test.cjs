const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./engine-harness.cjs');

const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-8,`${message}: expected ${expected}, received ${actual}`);
const stats=s=>({damage:s.atkDmg,speed:s.moveSpeed,hp:s.maxHp,defense:s.defense,range:s.atkRange});
function ordinary(A,s){
 Object.assign(s,{weapon:'Sword',weaponLevel:1,armor:'None',item:'None',mount:false,carryingStandard:null});
 A.applyLoadout(s);s.hp=s.maxHp;return s;
}
const troop=(g,id)=>g.students.find(s=>s.id===id);

test('all ten original houses have one derived captain without extra armor or combat stats',()=>{
 const {A}=loadGame(),g=A.game;
 assert.equal(A.CAPTAIN_MORALE_DURATION,20);
 assert.equal(g.students.filter(A.isHouseCaptain).length,10);
 for(const h of g.houses){
  const captain=troop(g,h.id+'_0'),peer=troop(g,h.id+'_1');
  assert(A.isHouseCaptain(captain));assert(!A.isHouseCaptain(peer));
  assert(!A.isChampionArmor(captain.armor),'captain rank must not automatically award a relic');
  assert(A.isHouseCaptain({...captain,isCaptain:false}),'identity follows the original house and student id');
  assert(!A.isHouseCaptain({...peer,isCaptain:true}),'a flag on an ordinary student cannot promote a captain');
  ordinary(A,captain);ordinary(A,peer);assert.deepEqual(stats(captain),stats(peer));
  const status=A.captainStatus(peer);assert.equal(status.captainId,captain.id);assert.equal(status.shaken,false);
 }
});

test('a captain knockout shakes only its original house and applies the stated penalties once',()=>{
 const {A,T}=loadGame(),g=A.game;g.time=10;
 for(const h of g.houses){
  const captain=troop(g,h.id+'_0'),peer=ordinary(A,troop(g,h.id+'_1'));
  const other=ordinary(A,g.students.find(s=>s.origHouse!==h.id&&s.id.endsWith('_1')));
  const before=stats(peer),otherBefore=stats(other);
  T.knockOut(captain,{controller:h.id==='player'?'mars':'player'});
  assert(A.isHouseShaken(peer),h.id+' should be shaken');
  close(A.captainStatus(peer).remaining,20,'morale starts at twenty seconds');
  close(peer.atkDmg,before.damage*.85,'shaken damage');close(peer.moveSpeed,before.speed*.90,'shaken movement');
  assert.deepEqual(stats(other),otherBefore,'a different original house keeps its own morale');
  for(let i=0;i<5;i++)A.applyLoadout(peer);
  close(peer.atkDmg,before.damage*.85,'recalculating equipment does not stack morale damage');
  close(peer.moveSpeed,before.speed*.90,'recalculating equipment does not stack morale movement');
 }
});

test('ordinary student knockouts do not shake their house',()=>{
 const {A,T}=loadGame(),g=A.game,peer=ordinary(A,troop(g,'mars_2')),before=stats(peer);
 T.knockOut(troop(g,'mars_1'),{controller:'player'});
 assert.equal(A.isHouseShaken(peer),false);assert.deepEqual(stats(peer),before);
});

test('morale expires after twenty seconds and restores effective stats',()=>{
 const {A,T}=loadGame(),g=A.game,peer=ordinary(A,troop(g,'mars_1')),captain=troop(g,'mars_0'),before=stats(peer);
 g.time=10;T.knockOut(captain,{controller:'player'});captain.koUntil=1000;
 g.time=29.99;T.updateCaptainMorale();assert(A.isHouseShaken(peer));
 g.time=30;T.updateCaptainMorale();assert.equal(A.isHouseShaken(peer),false);assert.equal(A.captainStatus(peer).remaining,0);
 assert.deepEqual(stats(peer),before,'expiry must restore already-computed movement and damage');
});

test('captain recovery rallies early and repeated knockout calls do not extend or stack shock',()=>{
 const {A,T}=loadGame(),g=A.game,peer=ordinary(A,troop(g,'mars_1')),captain=troop(g,'mars_0'),before=stats(peer);
 g.time=10;T.knockOut(captain,{controller:'player'});const until=A.getHouse('mars').captainShakenUntil;
 g.time=13;T.knockOut(captain,{controller:'player'});assert.equal(A.getHouse('mars').captainShakenUntil,until);
 close(peer.atkDmg,before.damage*.85,'repeated knockout damage');close(peer.moveSpeed,before.speed*.90,'repeated knockout movement');
 T.respawnStudent(captain);assert.equal(A.isHouseShaken(peer),false);assert.deepEqual(stats(peer),before);
});

test('recruited students keep one 23 percent penalty through further captures and recover at home',()=>{
 const {A,T}=loadGame(),g=A.game,recruit=ordinary(A,troop(g,'mars_1')),before=stats(recruit);
 T.transferHouse('mars','minerva');
 for(let i=0;i<8;i++)A.applyLoadout(recruit);
 close(recruit.atkDmg,before.damage*.77,'first recruitment damage');close(recruit.moveSpeed,before.speed*.77,'first recruitment movement');
 T.transferHouse('minerva','player');assert.equal(recruit.controller,'player','a captured ruling house brings its vassal students');
 close(recruit.atkDmg,before.damage*.77,'vassal recruitment must not stack damage penalties');close(recruit.moveSpeed,before.speed*.77,'vassal recruitment must not stack movement penalties');
 T.transferHouse('mars','mars');assert.equal(recruit.controller,'mars');assert.equal(recruit.slaveDebuff,false);assert.deepEqual(stats(recruit),before);
});

test('a recruited captain affects its own recruits without weakening the captor or another recruited house',()=>{
 const {A,T}=loadGame(),g=A.game,mars=ordinary(A,troop(g,'mars_1')),minerva=ordinary(A,troop(g,'minerva_1')),native=ordinary(A,troop(g,'player_1'));
 const marsBase=stats(mars),nativeBase=stats(native);
 T.transferHouse('mars','player');T.transferHouse('minerva','player');const minervaRecruited=stats(minerva);
 T.knockOut(troop(g,'mars_0'),{controller:'neptune'});
 close(mars.atkDmg,marsBase.damage*.77*.85,'recruited shaken damage');close(mars.moveSpeed,marsBase.speed*.77*.90,'recruited shaken movement');
 assert.equal(A.isHouseShaken(native),false);assert.deepEqual(stats(native),nativeBase);
 assert.equal(A.isHouseShaken(minerva),false);assert.deepEqual(stats(minerva),minervaRecruited);
 T.transferHouse('mars','neptune');assert.equal(A.isHouseShaken(mars),false,'changing allegiance clears the old controller morale event');
 close(mars.atkDmg,marsBase.damage*.77,'transfer clears shock while preserving one recruitment penalty');
 close(mars.moveSpeed,marsBase.speed*.77,'transfer movement after shock');
});

test('active captain morale survives a save round trip and older saves derive safe captain state',()=>{
 const {A,T}=loadGame(),g=A.game;g.time=10;T.knockOut(troop(g,'mars_0'),{controller:'player'});
 const snapshot=A.exportSave();assert.equal(A.importSave(snapshot).ok,true);
 const restored=troop(g,'mars_1');assert(A.isHouseShaken(restored));close(A.captainStatus(restored).remaining,20,'restored morale duration');
 assert.equal(g.students.filter(A.isHouseCaptain).length,10);
 const legacy=A.exportSave();
 for(const h of legacy.game.houses){delete h.captainShakenUntil;delete h.captainShakenController;}
 for(const s of legacy.game.students)delete s.isCaptain;
 assert.equal(A.importSave(legacy).ok,true);assert.equal(g.students.filter(A.isHouseCaptain).length,10);
 assert(g.students.every(s=>!A.isHouseShaken(s)),'old saves do not invent morale events');
 const forged=A.exportSave();for(const s of forged.game.students)s.isCaptain=!s.id.endsWith('_0');
 assert.equal(A.importSave(forged).ok,true);assert.equal(g.students.filter(A.isHouseCaptain).length,10,'serialized rank flags cannot change captain identity');
});

test('invalid morale saves are rejected before changing the current trial',()=>{
 const {A}=loadGame(),g=A.game;
 const cases=[
  h=>{h.captainShakenUntil=-1;},
  h=>{h.captainShakenUntil=NaN;},
  h=>{h.captainShakenUntil=Infinity;},
  h=>{h.captainShakenUntil='20';},
  (h,save)=>{h.captainShakenUntil=save.game.time+21;h.captainShakenController='mars';},
  (h,save)=>{h.captainShakenUntil=save.game.time+10;h.captainShakenController='unknown';},
  (h,save)=>{h.captainShakenUntil=save.game.time+10;h.captainShakenController='player';},
  (h,save)=>{h.captainShakenUntil=save.game.time+10;h.captainShakenController='mars';}
 ];
 for(const mutate of cases){
  const snapshot=A.exportSave(),h=snapshot.game.houses.find(h=>h.id==='mars');mutate(h,snapshot);
  const current=troop(g,'player_0'),before=A.exportSave();
  assert.equal(A.importSave(snapshot).ok,false,'malformed timers, allegiance, and shock without a knocked captain must fail');
  assert.equal(troop(g,'player_0'),current,'rejected save must not replace live students');assert.deepEqual(A.exportSave().game,before.game);
 }
});

test('a new trial clears captain morale and recruitment penalties',()=>{
 const {A,T}=loadGame(),g=A.game;T.transferHouse('mars','player');T.knockOut(troop(g,'mars_0'),{controller:'neptune'});
 assert(A.isHouseShaken(troop(g,'mars_1')));A.init();
 assert.equal(g.students.filter(A.isHouseCaptain).length,10);
 assert(g.students.every(s=>s.controller===s.origHouse&&!s.slaveDebuff&&!A.isHouseShaken(s)));
});

test('an unseen enemy captain knockout does not leak into the player event log',()=>{
 const {A,T}=loadGame(),g=A.game,captain=troop(g,'mars_0');
 captain.x=A.WORLD_W-200;captain.y=A.WORLD_H-200;A.refreshVisibility(true);
 assert.equal(A.isVisibleTo('player',captain),false);const before=[...g.logs];
 T.knockOut(captain,{controller:'diana'});assert.deepEqual(Array.from(g.logs),before);
});
