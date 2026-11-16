import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';

const scenarios=[{houses:4,full:false,fog:false},{houses:16,full:true,fog:false},{houses:16,full:true,fog:true}];
const state=game=>JSON.stringify({config:game.config,W:game.W,H:game.H,time:game.time,seed:game.seed,nextId:game.nextId,nextStandardId:game.nextStandardId,nextFlagId:game.nextFlagId,eventId:game.eventId,winner:game.winner,victoryReason:game.victoryReason,units:game.units,buildings:game.buildings,tiles:game.tiles,teams:game.teams,projectiles:game.projectiles,effects:game.effects,fireZones:game.fireZones,standards:game.standards,standardRemains:game.standardRemains,objectives:game.objectives,objectiveScores:game.objectiveScores,controlScores:game.controlScores,castles:game.castles,teamOrders:game.teamOrders,events:game.events,stats:game.stats,aftermath:game.aftermath,placedFormations:game.placedFormations,formationAdvances:game.formationAdvances,captureClock:game.captureClock,economyClock:game.economyClock,cleanClock:game.cleanClock,capturePower:game.capturePower,captureTouched:game.captureTouched,vision:game.vision.alliances},(key,value)=>{
  if(key==='target'&&value&&typeof value==='object'&&value.id!==undefined)return {id:value.id};
  if(value instanceof Map)return [...value];if(value instanceof Set)return [...value];if(ArrayBuffer.isView(value))return Array.from(value);return value;
});
const percentile=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length*.95)];
function fixture(settings,naive){
  const humans=Array.from({length:Math.min(4,settings.houses)},(_,index)=>index),game=new Game({multiplayer:true,humanTeams:humans,scale:settings.houses===16?'continent':'standard',enemies:settings.houses-1,landscape:'four-rivers',difficulty:'veteran',fogOfWar:settings.fog,seed:44277});
  if(settings.full)for(const team of game.teams){let index=0;while(team.count<team.cap){const type=index%5===0?'cavalry':index%3===0?'archer':'infantry',unit=game.addUnit(team.id,type,team.home.x+(index%20-10)*.5,team.home.y+(Math.floor(index/20)-5)*.5);game.idle([unit.id]);index++;}}
  for(const team of game.teams){team.gold=100000;game.upgradeTownHall(team.id);game.upgradeTownHall(team.id);}
  for(const team of humans)game.command(game.group(team).map(value=>value.id),game.W/2,game.H/2,'attack','line');
  // Independent reference enumerates the full original building list on every
  // troop, retaining exactly the pre-optimization collision candidate behavior.
  if(naive)game.buildingCollisionGrid=()=>({size:4,stride:Math.ceil(game.W/4)+2,bins:{get:()=>game.buildings}});
  return game;
}
function mutate(game,tick){
  if(tick===15){const building=game.buildings.find(value=>value.type==='barracks'&&value.team===0);game.damage(building,10000,{team:1,type:'siege'});}
  if(tick===30){const unit=game.group(1)[1],tower=game.addBuilding(1,'tower',unit.x,unit.y);game.upgradeTower(tower.id,1);game.upgradeTower(tower.id,1);}
  if(tick===60){const unit=game.group(2)[1];game.addBuilding(2,'keep',unit.x,unit.y);game.recount();}
}
const results=[];
for(const settings of scenarios){
  const reference=fixture(settings,true),optimized=fixture(settings,false),before=[],after=[];assert.equal(state(reference),state(optimized));
  for(let tick=0;tick<180;tick++){
    mutate(reference,tick);mutate(optimized,tick);
    let start=performance.now();reference.update(1/30);before.push(performance.now()-start);start=performance.now();optimized.update(1/30);after.push(performance.now()-start);
    if(tick%30===29){const expected=state(reference),actual=state(optimized);if(expected!==actual){let index=0;while(index<expected.length&&expected[index]===actual[index])index++;assert.fail('Collision parity differs at tick '+tick+', byte '+index+': '+expected.slice(index,index+100)+' != '+actual.slice(index,index+100));}}
  }
  const final=state(optimized),row={...settings,seed:44277,simulationHz:30,ticks:180,units:optimized.units.length,capacities:optimized.teams.map(value=>value.cap),exactStateParity:true,sha256:createHash('sha256').update(final).digest('hex'),referenceP95Ms:percentile(before),optimizedP95Ms:percentile(after)};results.push(row);console.log('PASS '+JSON.stringify(row));
}
fs.mkdirSync(new URL('../../docs/multiplayer-evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../../docs/multiplayer-evidence/collision-parity.json',import.meta.url),JSON.stringify({method:'Exact full gameplay state compared every thirty ticks against the original all-buildings collision enumeration. Includes full armies, every force, RNG, commands, private AI state, resources, fog, construction, destruction and upgraded variable radii. Timing is a paired correctness run, not isolated hardware qualification.',results},null,2)+'\n');
