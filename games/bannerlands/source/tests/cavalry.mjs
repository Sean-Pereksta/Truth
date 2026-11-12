import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const modulePath=process.argv[2]||fileURLToPath(new URL('../../core.js',import.meta.url));
const {Game,HOUSES,UNIT_DEFS}=await import(pathToFileURL(modulePath));
function fixture({rider='thorn_lancer',enemy='infantry',held=false,rear=false,rows=5,terrain='grass',playerSpears=false}={}){
 const g=new Game({landscape:'open',house:4,enemies:1,scale:'standard',seed:1234});
 g.units=[];g.buildings=[];g.byId.clear();g.projectiles=[];g.effects=[];g.fireZones=[];
 for(const t of g.tiles){if(t.terrain!=='water')t.terrain=terrain;t.owner=0;}
 Object.assign(g.teams[1],HOUSES[1]);for(const s of g.teams){s.count=0;s.cap=1000;s.aiClock=1e9;s.heroTimer=0;}
 for(let team=0;team<2;team++){const b=g.addBuilding(team,'keep',team?100:3,team?80:3);b.spawnTimer=-1e9;b.cooldown=1e9;}
 const horse=g.addUnit(playerSpears?1:0,rider,rear?53:38,40);horse.cooldown=10;
 const foes=Array.from({length:rows},(_,i)=>g.addUnit(playerSpears?0:1,enemy,46+i*.68,40));
 for(const foe of foes){foe.cooldown=10;g.hold([foe.id]);foe.braceDir={x:-1,y:0};foe.braceTime=1;if(!held)foe.order={x:foe.x,y:foe.y,mode:'attack'};}
 g.command([horse.id],rear?40:56,40,'attack','line');
 const start=foes.map(u=>({x:u.x,y:u.y})),peak=foes.map(()=>0),hits=new Set();let peakHorseX=horse.x,minHorseX=horse.x,charging=false,blocked=false;
 return {g,horse,foes,start,peak,hits,step(seconds=5){for(let i=0;i<seconds*60;i++){
   g.update(1/60);charging||=horse.charging;blocked||=horse.chargeBlockedUntil>g.time;peakHorseX=Math.max(peakHorseX,horse.x);minHorseX=Math.min(minHorseX,horse.x);
   foes.forEach((u,j)=>{peak[j]=Math.max(peak[j],Math.hypot(u.x-start[j].x,u.y-start[j].y));if(horse.chargeHits?.has(u.id))hits.add(u.id);});
 }return {rider,enemy,held,rear,hits:hits.size,shove:Number(Math.max(...peak).toFixed(2)),x:Number(horse.x.toFixed(2)),peakX:Number(peakHorseX.toFixed(2)),minX:Number(minHorseX.toFixed(2)),hp:Number(horse.hp.toFixed(1)),charging,blocked,impacts:g.stats.chargeImpacts,foeHp:foes.map(u=>Math.round(u.hp))};}};
}
const ordinary=fixture().step(),regular=fixture({rider:'cavalry'}).step(),archers=fixture({enemy:'archer'}).step();
const pikes=fixture({enemy:'dread_pike',held:true}).step(),wardens=fixture({enemy:'bridge_warden',held:true}).step();
const rear=fixture({enemy:'dread_pike',held:true,rear:true}).step(),moving=fixture({enemy:'dread_pike',playerSpears:true}).step(),swords=fixture({held:true}).step(),aiSpears=fixture({enemy:'dread_pike'}).step();
console.log(JSON.stringify({ordinary,regular,archers,pikes,wardens,rear,moving,swords,aiSpears},null,2));
if(!process.argv.includes('--baseline')){
 assert(ordinary.charging&&ordinary.hits>=4,'Thorn Lancer must charge through at least four ranks');
 assert(ordinary.shove>1.2,'Unbraced troops must visibly scatter by more than a tile');
 assert(regular.hits>=3,'Regular cavalry must punch through multiple unbraced ranks');
 assert(archers.hits>=4,'Cavalry should break through exposed archers');
 assert(pikes.blocked&&pikes.hits<=2,'Frontal held Bolton pikes must stop the charge');
 assert(wardens.blocked&&wardens.hits<=2,'Frontal held Frey spearwall must stop the charge');
 assert(!rear.blocked&&rear.hits>=3,'Rear attacks bypass the spear brace');
 assert(!moving.blocked&&moving.hits>=3,'Moving pikes cannot stop a charge');
 assert(swords.hits>=3,'Ordinary sword formations cannot copy the hard spear counter');
 assert(aiSpears.blocked,'Rival spear factions should react to an incoming charge');
 const flank=fixture({enemy:'bridge_warden',held:true,rows:1});flank.horse.x=46;flank.horse.y=32;flank.g.command([flank.horse.id],46,48,'attack','line');const flankResult=flank.step(4);assert(!flankResult.blocked&&flankResult.hits===1,'A perpendicular charge bypasses the fixed spear facing');
 const noRunup=fixture({rows:1,held:true});noRunup.horse.x=45;noRunup.g.command([noRunup.horse.id],50,40,'attack','line');assert.equal(noRunup.step(2).impacts,0,'Point-blank orders cannot create an instant charge');
 const cancel=fixture();cancel.step(2.2);cancel.g.command([cancel.horse.id],35,40,'move','line');cancel.step(.5);assert(!cancel.horse.charging,'Move immediately cancels a charge');
 const activeCombat=fixture({held:true});for(const u of activeCombat.g.units)u.cooldown=0;assert(activeCombat.step(4.5).hits>=3,'Live weapon attacks must still allow a lancer to punch through ordinary ranks');
 const fallenSpear=fixture({enemy:'dread_pike',held:true,rows:1});fallenSpear.foes[0].hp=1;assert(!fallenSpear.step(4).blocked,'A spear killed by impact cannot stop the horse afterward');
 const company=fixture({enemy:'dread_pike',held:true,rows:1}),riders=[company.horse];for(const y of [39.5,40.5]){const u=company.g.addUnit(0,'thorn_lancer',37.5,y);u.cooldown=10;company.g.command([u.id],56,40,'attack','line');riders.push(u);}const blockedRiders=new Set();for(let frame=0;frame<390;frame++){company.g.update(1/60);for(const u of riders)if(u.chargeBlockedUntil>company.g.time)blockedRiders.add(u.id);}assert.equal(blockedRiders.size,3,'A surviving braced spear must stop successive riders, not stagger after blocking the first');assert(company.foes[0].hp>0&&company.foes[0].hp<198,'Spear wall absorbs real damage instead of becoming invulnerable');assert(riders.every(u=>u.x<46),'The stopped cavalry company must remain in front of the spear');
 assert.equal(UNIT_DEFS.infantry.spearBrace,undefined);
 // Charge history prevents repeated impact farming against the same unit in one pass.
 const dedup=fixture({rows:1});dedup.step(3.5);assert.equal(dedup.g.stats.chargeImpacts,1);
 console.log('PASS: actual run-up, multi-rank impacts, shoves, both faction counters, flank/rear, moving spears, and single-pass hit limits.');
}
