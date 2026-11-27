import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';
import {snapshotWorld,createRemoteGame,applySnapshot} from '../../multiplayer/snapshot.js';
import {PresentationBuffer} from '../../multiplayer/client.js';

// Isolate guest interpolation from simulation, network transit and canvas drawing.
// Optional argument: the path to multiplayer/client.js in a baseline checkout.
const houses=16,seed=44277;
const game=new Game({house:0,enemies:houses-1,mode:'conquest',difficulty:'veteran',
  scale:'continent',landscape:'four-rivers',seed,fogOfWar:false,humanTeams:[0,1,2,3]});
const destination=game.navigation.nearestPassable({x:game.W/2,y:game.H/2});
for(const team of game.teams){
  const types=['infantry','archer','cavalry'];
  for(let i=0;team.count<team.cap;i++){
    const angle=i*2.399963,radius=Math.sqrt(i)*.55;
    game.addUnit(team.id,types[i%3],team.home.x+Math.cos(angle)*radius,team.home.y+Math.sin(angle)*radius);
  }
  game.command(game.group(team.id).map(u=>u.id),destination.x,destination.y,'move','line');
}
game.recount();game.hash.rebuild(game.units);
const snapshots=[];
for(let i=0;i<15;i++){
  for(let tick=0;tick<3;tick++)game.update(1/30);
  snapshots.push(snapshotWorld(game,1,{initial:i===0,sequence:i+1}));
}
function measure(BufferType){
  const times=[];
  let checksum=0;
  for(let trial=0;trial<4;trial++){
    const buffer=new BufferType(),view=createRemoteGame(snapshots[0]);
    for(const [i,snapshot] of snapshots.entries()){
      if(i)applySnapshot(view,snapshot);
      const receivedAt=1000+snapshot.time*1000;
      buffer.push(snapshot,receivedAt);
      for(let frame=0;frame<6;frame++){
        const unit=view.units[view.units.length>>>1],original=unit.x,start=performance.now();
        buffer.draw(view,receivedAt+frame*1000/60,()=>{checksum+=unit.x+unit.y+view.time;});
        const ms=performance.now()-start;
        assert.equal(unit.x,original);
        if(i>2)times.push(ms);
      }
    }
  }
  times.sort((a,b)=>a-b);
  return {frames:times.length,medianMs:times[times.length>>1],p95Ms:times[Math.floor(times.length*.95)],
    meanMs:times.reduce((a,b)=>a+b,0)/times.length,checksum};
}
const result={seed,houses,units:snapshots[0].units.length,cpu:os.cpus()[0].model,node:process.version};
if(process.argv[2]){
  const baseline=await import(pathToFileURL(path.resolve(process.argv[2])).href);
  result.baseline=measure(baseline.PresentationBuffer);
}
result.current=measure(PresentationBuffer);
if(result.baseline)assert.equal(result.current.checksum,result.baseline.checksum);
console.log(JSON.stringify(result,null,2));
