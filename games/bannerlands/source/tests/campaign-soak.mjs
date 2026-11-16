// Natural campaign playthrough: no teleports, injected units, bonus resources,
// clock jumps or repeated order resets. Timing is workload metadata, not a
// before/after performance claim. Use --seconds, --seeds, --difficulties,
// --modes, --scale, --landscape, --fog and --output to repeat a scenario.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';

const args=process.argv.slice(2),option=(key,fallback)=>{const index=args.indexOf('--'+key);return index<0?fallback:args[index+1];};
const seconds=Math.max(1,Number(option('seconds',120))),dt=1/30,seeds=option('seeds','44277').split(',').map(Number),difficulties=option('difficulties','standard,veteran,warlord').split(','),modes=option('modes','conquest').split(',');
const scale=option('scale','continent'),landscape=option('landscape','riverlands'),fogOfWar=option('fog','false')==='true';
assert.ok(Number.isFinite(seconds)&&seeds.every(Number.isFinite),'Duration and seeds must be finite.');
const offensiveTasks=new Set(['assault','raid','objective','team','counter','pressure','kingHunt','royalFlag']);
const distance2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const results=[];
for(const seed of seeds)for(const mode of modes)for(const difficulty of difficulties){
  const g=new Game({seed,mode,difficulty,scale,landscape,enemies:15,fogOfWar}),started=performance.now(),roles=new Set(),phases=new Set(),launches=[],roleChanges=[],snapshots=[],lastRoles=new Map();
  const baseAI=g.ai.bind(g);g.ai=function(s){
    const before=s.aiPlan&&{phase:s.aiPlan.phase,at:s.aiPlan.startedAt,goal:s.aiPlan.targetId??s.aiPlan.objectiveId,secondary:s.aiPlan.secondary?.targetId};
    const out=baseAI(s),p=s.aiPlan;
    if(p){
      roles.add(p.role);phases.add(p.phase);
      if(lastRoles.get(s.id)!==p.role){roleChanges.push({at:+g.time.toFixed(2),team:s.id,role:p.role,reason:p.roleReason});lastRoles.set(s.id,p.role);}
      if(['advance','objective','coordinate','counter'].includes(p.phase)&&(!before||before.phase!==p.phase||before.at!==p.startedAt||before.goal!==(p.targetId??p.objectiveId)))launches.push({at:+g.time.toFixed(2),team:s.id,phase:p.phase,role:p.role,targetTeam:p.targetTeam??null,target:p.targetId??p.objectiveId??null,troops:p.cohort?.length||0});
      if(p.secondary&&p.secondary.targetId!==before?.secondary)launches.push({at:+g.time.toFixed(2),team:s.id,phase:'secondary',role:p.role,target:p.secondary.targetId,troops:p.secondary.cohort.length});
    }
    return out;
  };
  let offensiveTroopSeconds=0,objectiveTroopSeconds=0,homeDefenseTroopSeconds=0,undefendedHouseSeconds=0,scoutTroopSeconds=0,samples=0,nextSample=0,peakOffensive=0,finalState=null;
  const sample=interval=>{
    const armies=Array.from({length:g.teams.length},()=>[]);for(const u of g.units)if(u.hp>0)armies[u.team].push(u);
    let offensive=0,objective=0,defenders=0,undefended=0,scouts=0;
    for(const s of g.teams){
      if(s.id===0||!s.alive)continue;const army=armies[s.id],homeKeeps=g.buildings.filter(b=>b.team===s.id&&b.hp>0&&b.type==='keep');
      for(const u of army){const task=g.aiTaskOf(u);if(offensiveTasks.has(task))offensive++;if(task==='scout')scouts++;if(['objective','royalFlag','objectiveDefense'].includes(task))objective++;}
      const atHome=army.filter(u=>homeKeeps.some(keep=>distance2(keep,u)<13**2)&&!['assault','raid','pressure'].includes(g.aiTaskOf(u))).length;
      defenders+=atHome;if(homeKeeps.length&&army.length>=20&&atHome<5)undefended++;
    }
    offensiveTroopSeconds+=offensive*interval;objectiveTroopSeconds+=objective*interval;homeDefenseTroopSeconds+=defenders*interval;undefendedHouseSeconds+=undefended*interval;scoutTroopSeconds+=scouts*interval;peakOffensive=Math.max(peakOffensive,offensive);samples++;
    finalState={at:+g.time.toFixed(1),livingHouses:g.teams.filter(s=>s.alive).length,livingTroops:armies.reduce((n,a)=>n+a.length,0),offensiveTroops:offensive,objectiveTroops:objective,homeDefenders:defenders,scouts,objectiveScores:[...g.objectiveScores],castles:g.castles.filter(site=>!site.ruined).length};
    if(g.time+1e-7>=nextSample){snapshots.push(finalState);nextSample+=30;}
  };
  let lastSample=0;
  for(let frame=0;frame<Math.ceil(seconds/dt)&&g.winner===null;frame++){
    g.update(dt);
    if(g.time-lastSample>=1-1e-7){sample(g.time-lastSample);lastSample=g.time;}
  }
  if(g.time>lastSample)sample(g.time-lastSample);
  for(const u of g.units)assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp)&&g.isWalkable(u.x,u.y),'Campaign soldiers retain finite positions on legal terrain.');
  const actualSeconds=g.time,launchTeams=new Set(launches.map(launch=>launch.team));
  const result={seed,mode,difficulty,scale,landscape,fogOfWar,rivals:g.teams.length-1,requestedSeconds:seconds,actualSeconds:+actualSeconds.toFixed(3),dt,wallSeconds:+((performance.now()-started)/1000).toFixed(2),winner:g.winner,victoryReason:g.victoryReason,launches:launches.length,launchingHouses:launchTeams.size,peakOffensiveTroops:peakOffensive,meanOffensiveTroops:+(offensiveTroopSeconds/Math.max(1,actualSeconds)).toFixed(2),meanObjectiveTroops:+(objectiveTroopSeconds/Math.max(1,actualSeconds)).toFixed(2),meanHomeDefenders:+(homeDefenseTroopSeconds/Math.max(1,actualSeconds)).toFixed(2),meanScoutTroops:+(scoutTroopSeconds/Math.max(1,actualSeconds)).toFixed(2),undefendedHouseSeconds:+undefendedHouseSeconds.toFixed(2),roles:[...roles].filter(Boolean).sort(),phases:[...phases].filter(Boolean).sort(),kills:g.teams.reduce((n,s)=>n+s.kills,0),objectiveScores:[...g.objectiveScores],controlScores:[...g.controlScores],finalState,snapshots,launchEvents:launches,roleChanges};
  results.push(result);console.log(JSON.stringify({seed,mode,difficulty,seconds:result.actualSeconds,launches:result.launches,meanOffensiveTroops:result.meanOffensiveTroops,meanObjectiveTroops:result.meanObjectiveTroops,meanHomeDefenders:result.meanHomeDefenders,roles:result.roles,wallSeconds:result.wallSeconds}));
}
const report={description:'Natural seeded campaigns with an idle player and no injected advantages. Pressure metrics describe activity; they do not establish win rate or full late-campaign strength.',results};
const output=option('output',null);if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}
