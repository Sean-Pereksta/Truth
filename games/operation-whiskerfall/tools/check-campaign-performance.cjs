'use strict';
// node tools/check-campaign-performance.cjs BASE_GAME CANDIDATE_GAME OUTPUT.json [pairs=3]
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const [base,candidate,output]=process.argv.slice(2);
const pairs=Number(process.argv[5])||3;
if(!base||!candidate||!output||!Number.isInteger(pairs)||pairs<3)throw Error('Expected base and candidate game folders, an output file, and at least three pairs');
const run=(script,args)=>execFileSync(process.execPath,[path.join(__dirname,script),...args],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'meowquest-profile-'));
const results={base:{runs:[],combat:[]},candidate:{runs:[],combat:[]}};
const median=a=>{const sorted=a.slice().sort((a,b)=>a-b),half=Math.floor(sorted.length/2);return sorted.length%2?sorted[half]:(sorted[half-1]+sorted[half])/2;};
try{
  for(let i=0;i<pairs;i++){
    for(const label of i%2?['candidate','base']:['base','candidate']){
      const game=label==='base'?base:candidate;
      const perf=JSON.parse(run('profile-combat.cjs',[game,'1280','fixed']));
      results[label].combat.push(perf);
      const file=path.join(folder,label+'-'+i+'.json');
      run('profile-campaign.cjs',[game,file,'1',...(label==='candidate'?['--stress']:[])]);
      const result=JSON.parse(fs.readFileSync(file,'utf8'));
      for(const key of ['device','platform','viewport','settings']){
        if(results[key]!==undefined&&JSON.stringify(results[key])!==JSON.stringify(result[key]))throw Error('Changed environment: '+key);
        results[key]=result[key];
      }
      results[label].runs.push(result.records[0]);
      fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');
      console.log('Pair '+(i+1)+' '+label+': '+result.records[0].scenes.map(s=>s.scene+' '+s.over33+'/'+s.frames+' >33ms').join(', '));
    }
  }
  const report=(group)=>{
    const rs=group.runs,summary={
      browser:rs[0].browser,readyMs:median(rs.map(r=>r.cold.readyMs)),coverMs:median(rs.map(r=>r.cold.coverMs)),
      campaignStartMs:median(rs.map(r=>r.journeys[0].campaignStartMs)),surfaceReturnMs:median(rs.flatMap(r=>r.surfaceReturns)),
      coldYardExitMs:rs[0].journeys[0].exitMs===null?null:median(rs.map(r=>r.journeys[0].exitMs)),
      warmYardExitMs:rs[0].journeys[0].exitMs===null?null:median(rs.flatMap(r=>r.journeys.slice(1).map(j=>j.exitMs))),
      heapMiB:[0,1,2,3].map(i=>median(rs.map(r=>r.heapMiB[i]))),
      privateMiB:[0,1,2,3].map(i=>rs[0].privateMiB[i]===null?null:median(rs.map(r=>r.privateMiB[i])))};
    const combat=group.combat.map(r=>r.sample);
    summary.combat={p95:median(combat.map(s=>s.elapsedFrameMs.p95)),p99:median(combat.map(s=>s.elapsedFrameMs.p99)),over33:median(combat.map(s=>s.over33ms)),cpuP95:median(combat.map(s=>s.submissionMs.p95))};
    for(const scene of rs[0].scenes.map(s=>s.scene)){
      const frames=rs.map(r=>r.scenes.find(s=>s.scene===scene));
      summary[scene]={p95:median(frames.map(s=>s.p95Ms)),p99:median(frames.map(s=>s.p99Ms)),over33:median(frames.map(s=>s.over33)),peak:median(frames.map(s=>s.peakEnemies))};
    }
    return summary;
  };
  const a=report(results.base),b=report(results.candidate);
  const checks={
    sameBrowser:results.base.runs.concat(results.candidate.runs).every(r=>r.browser===a.browser),
    matchingCoop:results.base.runs.concat(results.candidate.runs).every(r=>{
      const s=r.scenes.find(s=>s.scene==='coop');
      return s.frames===180&&s.peakEnemies===6&&s.maxProjectiles>0&&s.attackFrames>0&&s.end.every(p=>p.hp>0);
    }),
    fewerBusyHitches:b.coop.over33<a.coop.over33,
    busyTail:b.coop.p95<=a.coop.p95+1 && b.coop.p99<=a.coop.p99+1,
    startup:b.readyMs<a.readyMs,
    stress:results.candidate.runs.every(r=>{const s=r.scenes.find(s=>s.scene==='stress');return s?.peakEnemies>=8&&s.frames===180&&s.maxProjectiles>0&&s.attackFrames>0;}),
    boundedRetainedHeap:results.candidate.runs.every(r=>r.heapMiB[3]<=r.heapMiB[0]+2)
  };
  results.summary={base:a,candidate:b,checks,passed:Object.values(checks).every(Boolean)};
  fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results.summary,null,2));
  if(!results.summary.passed)process.exitCode=1;
}finally{for(const file of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,file));fs.rmdirSync(folder);}
