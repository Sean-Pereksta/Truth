import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import {createAuthority} from '../../multiplayer/authority.js';
import {createSnapshotDelta} from '../../multiplayer/transport-delta.js';
import {HOUSE_CONTENT,BUILD_DEFS,UNIT_DEFS} from '../../core.js';
import {houseCanRecruit} from '../../regiments.js';

const argument=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const simulationHz=30,snapshotHz=10,dt=1/simulationHz;
const ticks=Number(argument('ticks',900)),warmup=Number(argument('warmup',300)),sampleEvery=simulationHz/snapshotHz;
if(!Number.isInteger(ticks)||ticks<20||ticks>24000||!Number.isInteger(warmup)||warmup<0||warmup>10000)throw new Error('Choose valid benchmark tick counts.');
const output=argument('output','docs/multiplayer-evidence/authoritative-benchmark.json');
const only=argument('only','');
const scenarios=[
  {id:'four-houses-two-humans',houses:4,humans:2,fog:false,full:false,scale:'standard'},
  {id:'sixteen-houses-four-humans-fog',houses:16,humans:4,fog:true,full:false,scale:'continent'},
  {id:'sixteen-houses-four-humans-full-capacity',houses:16,humans:4,fog:false,full:true,scale:'continent'},
  {id:'sixteen-houses-two-humans-full-capacity-fog',houses:16,humans:2,fog:true,full:true,scale:'continent'}
].filter(value=>!only||value.id===only);
const percentile=(values,fraction)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))]??0;};
const summary=values=>({samples:values.length,mean:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),p50:percentile(values,.5),p95:percentile(values,.95),p99:percentile(values,.99),max:Math.max(0,...values)});

function fillArmies(game){
  for(const team of game.teams){
    const types=['infantry','archer','cavalry',HOUSE_CONTENT[team.sigil].unit].filter(type=>UNIT_DEFS[type]&&houseCanRecruit(type,team.sigil)),existing=game.group(team.id),home=team.home;
    const candidates=[];for(let y=-17;y<=17;y++)for(let x=-17;x<=17;x++){
      const point={x:home.x+x*.6,y:home.y+y*.6},distance=(point.x-home.x)**2+(point.y-home.y)**2;
      if(distance>9.7**2||!game.isWalkable(point.x,point.y)||point.x<1.5||point.y<1.5||point.x>game.W-1.5||point.y>game.H-1.5||game.buildings.some(value=>value.hp>0&&(point.x-value.x)**2+(point.y-value.y)**2<(game.buildingRadius(value)+.5)**2)||existing.some(value=>(value.x-point.x)**2+(value.y-point.y)**2<.5**2))continue;
      candidates.push({...point,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
    let index=0;while(team.count<team.cap){const point=candidates[index];if(!point)throw new Error('Not enough legal full-capacity fixture positions.');const unit=game.addUnit(team.id,types[index%types.length],point.x,point.y);game.idle([unit.id]);index++;}
  }
  game.recount();game.hash.rebuild(game.units);game.vision.update(true);
}

function createScenario(settings){
  const humans=Array.from({length:settings.humans},(_,index)=>index),privateHomePermutation=Array.from({length:settings.houses},(_,index)=>index),authority=createAuthority({house:0,enemies:settings.houses-1,mode:'conquest',difficulty:'veteran',scale:settings.scale,landscape:'four-rivers',seed:44277,fogOfWar:settings.fog},{humanTeams:humans,privateHomePermutation});
  if(settings.full)fillArmies(authority.game);return {authority,humans,game:authority.game};
}
function checksum(game){return {time:game.time,seed:game.seed,units:game.units.length,positions:game.units.reduce((sum,value)=>sum+value.id*(value.x+value.y*.137+value.hp*.001),0),gold:game.teams.map(value=>value.gold),counts:game.teams.map(value=>value.count),winner:game.winner};}
const results={measuredAt:new Date().toISOString(),hardware:{cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,memoryGiB:os.totalmem()/2**30,os:os.platform()+' '+os.release(),arch:os.arch(),node:process.version},method:{seed:44277,landscape:'four-rivers',difficulty:'veteran',simulationHz,snapshotHz,sampleTicks:ticks,warmupTicks:warmup,measuredGameSeconds:ticks/simulationHz,warmupGameSeconds:warmup/simulationHz,compression:'gzip level 3, independent response per guest (matches host server)',transport:'property deltas with exact sequence baseline; static terrain initial only',scope:'Synthetic authoritative CPU, replication, compressed bandwidth and heap. No GPU/browser FPS, physical network, Firebase, thermal soak, or real-world latency measurement. Other task browser/build/test workloads were paused for the final run.',baseline:'The same game, seed, human/AI split, full-capacity positions and human commands run first with simulation only. Gameplay checksums must match the replication run; protocol projection cannot change combat outcomes. Full-update raw byte comparisons are sampled once per guest before the timed loop.',fullCapacity:'Every participating house keeps its normal 280 starting troop capacity; full fixtures fill all houses to capacity without changing combat or AI rules.'},scenarios:[]};
results.method.privateStartFixture='Fixed identity [0..houseCount-1] start permutation supplied privately by the benchmark, preserving the measured scenario layout. Production hosting uses an independent OS-crypto permutation after terrain generation; this fixture is never read from lobby/config or published.';
for(const settings of scenarios){
  const baseline=createScenario(settings);for(const team of baseline.humans)baseline.game.command(baseline.game.group(team).map(value=>value.id),baseline.game.W/2,baseline.game.H/2,'attack','line');for(let tick=0;tick<warmup;tick++)baseline.authority.step(dt);
  const baselineTimes=[],baselineAt=performance.now();for(let tick=0;tick<ticks;tick++){const start=performance.now();baseline.authority.step(dt);baselineTimes.push(performance.now()-start);}const baselineWallMs=performance.now()-baselineAt,baselineChecksum=checksum(baseline.game);
  const constructionAt=performance.now(),{authority,humans,game}=createScenario(settings);
  const startupMs=performance.now()-constructionAt,initialUnits=game.units.length,initialAt=performance.now(),initial=humans.map(team=>authority.snapshot(team,{initial:true})),initialMs=performance.now()-initialAt;
  const initialRaw=initial.map(value=>Buffer.byteLength(JSON.stringify(value))),initialCompressed=initial.map(value=>gzipSync(JSON.stringify(value),{level:3}).length);
  // Moving human armies and naturally active bots exercise routing without
  // bypassing a single combat rule or reducing the army count.
  for(const team of humans)game.command(game.group(team).map(value=>value.id),game.W/2,game.H/2,'attack','line');
  for(let tick=0;tick<warmup;tick++)authority.step(dt);
  let previous=humans.map(team=>authority.snapshot(team));
  const fullBytes=previous.map(value=>Buffer.byteLength(JSON.stringify(value)));
  if(global.gc)global.gc();const heapBefore=process.memoryUsage().heapUsed,startedAt=performance.now();
  const simTimes=[],snapshotTimes=[],deltaTimes=[],compressionTimes=[],cycleTimes=[],deltaBytes=[],gzipBytes=[];
  let processedSnapshots=0,peakUnits=game.units.length,peakHeap=heapBefore;
  for(let tick=0;tick<ticks;tick++){
    const cycleAt=performance.now(),simAt=performance.now();authority.step(dt);simTimes.push(performance.now()-simAt);peakUnits=Math.max(peakUnits,game.units.length);
    if(tick%sampleEvery===sampleEvery-1){
      const projectionAt=performance.now(),projection=authority.projection();let sharedProjectionMs=performance.now()-projectionAt;
      for(let index=0;index<humans.length;index++){
        const snapshotAt=performance.now(),snapshot=authority.snapshot(humans[index],{projection});snapshotTimes.push(performance.now()-snapshotAt+sharedProjectionMs);sharedProjectionMs=0;
        const deltaAt=performance.now(),delta=createSnapshotDelta(previous[index],snapshot,previous[index].sequence,snapshot.sequence),json=JSON.stringify(delta);deltaTimes.push(performance.now()-deltaAt);
        const compressionAt=performance.now(),compressed=gzipSync(json,{level:3});compressionTimes.push(performance.now()-compressionAt);
        deltaBytes.push(Buffer.byteLength(json));gzipBytes.push(compressed.length);previous[index]=snapshot;processedSnapshots++;
      }
    }
    cycleTimes.push(performance.now()-cycleAt);peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);
  }
  const wallMs=performance.now()-startedAt,heapAfter=process.memoryUsage().heapUsed;
  const finalChecksum=checksum(game),gameplayParity=JSON.stringify(finalChecksum)===JSON.stringify(baselineChecksum);if(!gameplayParity)throw new Error('Replication changed the authoritative gameplay checksum.');
  const row={...settings,humanTeams:humans,aiHouses:settings.houses-settings.humans,baseline:{wallMs:baselineWallMs,simulationMs:summary(baselineTimes),checksum:baselineChecksum},gameplayParity,checksum:finalChecksum,startupMs,initialSync:{allGuestsSnapshotMs:initialMs,rawBytesPerGuest:summary(initialRaw),gzipBytesPerGuest:summary(initialCompressed)},initialUnits,peakUnits,remainingUnits:game.units.length,normalCapacities:game.teams.map(value=>value.cap),gameTime:game.time,winner:game.winner,wallMs,simulatedSecondsPerWallSecond:(ticks/simulationHz)/(wallMs/1000),simulationMs:summary(simTimes),snapshotPerGuestMs:summary(snapshotTimes),deltaAndSerializePerGuestMs:summary(deltaTimes),gzipPerGuestMs:summary(compressionTimes),combinedHostTickMs:summary(cycleTimes),fullUpdateRawBytes:summary(fullBytes),deltaRawBytes:summary(deltaBytes),deltaGzipBytes:summary(gzipBytes),aggregateOutboundGzipBytesPerGameSecond:gzipBytes.reduce((a,b)=>a+b,0)/(ticks/simulationHz),heap:{before:heapBefore,after:heapAfter,peak:peakHeap,garbageCollectedBefore:!!global.gc},processedSnapshots};
  results.scenarios.push(row);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({scenario:row.id,simulationP95Ms:row.simulationMs.p95,snapshotP95Ms:row.snapshotPerGuestMs.p95,combinedHostTickP95Ms:row.combinedHostTickMs.p95,compressedBytesPerSecond:row.aggregateOutboundGzipBytesPerGameSecond,peakUnits:row.peakUnits,wallSeconds:wallMs/1000}));
}
console.log('Saved '+path.resolve(output));
