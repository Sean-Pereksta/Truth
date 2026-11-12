import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Game} from '../../core.js';
import {isPassableTile} from '../../lands.js';

// The Lands Update full-scan capture algorithm from commit4023000 is a behavior
// oracle. Sparse capture must preserve connected tile order, rewards and RNG.
function fullScanCapture(dt){
  const len=this.tiles.length,power=this.capturePower;power.fill(0);
  for(const u of this.units){if(u.hp<=0)continue;const x=Math.floor(u.x),y=Math.floor(u.y);for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){if(xx<1||yy<1||xx>=this.W-1||yy>=this.H-1)continue;const dd=(u.x-(xx+.5))**2+(u.y-(yy+.5))**2;if(dd<1.3){const i=yy*this.W+xx;power[u.team*len+i]+=(this.unitClass(u)==='hero'?1.7:1)*Math.max(.15,1-dd*.65);}}}
  const alliancePower=Array(this.objectiveScores.length).fill(0);
  for(let i=0;i<len;i++){const tile=this.tiles[i];if(!isPassableTile(tile))continue;alliancePower.fill(0);let best=-1,max=0,second=0,strongest=0;
    for(let t=0;t<this.teams.length;t++)if(this.teams[t].alive)alliancePower[this.teams[t].alliance]+=power[t*len+i];
    let leading=-1;for(let a=0;a<alliancePower.length;a++){const v=alliancePower[a];if(v>max){second=max;max=v;leading=a;}else if(v>second)second=v;}
    for(let t=0;t<this.teams.length;t++)if(this.teams[t].alive&&this.teams[t].alliance===leading&&power[t*len+i]>strongest){best=t;strongest=power[t*len+i];}
    if(best<0||max<.12||max<=second*1.15||best===tile.owner||!this.canCapture(tile,best)){tile.capture=Math.max(0,tile.capture-dt*.16);if(tile.capture===0)tile.claim=-1;continue;}
    if(tile.claim!==best){tile.capture=Math.max(0,tile.capture-dt*.55);if(tile.capture>0)continue;tile.claim=best;}
    const rate=(tile.owner===-1?.39:.24)*Math.min(2.1,Math.sqrt(Math.max(.1,max-second*.75)));tile.capture+=dt*rate;
    if(tile.capture>=1){const previous=tile.owner;if(previous>=0&&previous!==best&&this.teams[best].sigil==='kraken'&&!((tile.raidMask||0)&(1<<best))){tile.raidMask=(tile.raidMask||0)|(1<<best);this.teams[best].gold+=6;}tile.owner=best;tile.capture=0;tile.claim=-1;if(best===0)this.stats.captured++;if(this.random()<.08&&this.effects.length<180)this.effects.push({x:tile.x+.5,y:tile.y+.5,type:'capture',life:.6,maxLife:.6,team:best});}
  }
}

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const at=(g,x,y)=>g.tiles[y*g.W+x];
function make(config={}){
  const g=new Game({landscape:'open',enemies:15,scale:'standard',seed:44277,...config});
  g.units=[];g.byId=new Map(g.buildings.map(b=>[b.id,b]));g.effects=[];
  for(const s of g.teams)s.count=0;
  for(const t of g.tiles){t.terrain=t.x===0||t.y===0||t.x===g.W-1||t.y===g.H-1?'water':'grass';t.feature=null;t.owner=-1;t.claim=-1;t.capture=0;delete t.raidMask;}
  return g;
}
function pair(config={}){const a=make(config),b=make(config);b.capture=fullScanCapture;return [a,b];}
function same(a,b,label=''){
  assert.deepEqual(a.tiles.map(t=>[t.owner,t.claim,t.capture,t.raidMask||0]),b.tiles.map(t=>[t.owner,t.claim,t.capture,t.raidMask||0]),label+' tile state');
  assert.deepEqual(a.teams.map(s=>[s.alive,s.gold,s.count]),b.teams.map(s=>[s.alive,s.gold,s.count]),label+' faction state');
  assert.equal(a.seed,b.seed,label+' random stream');assert.deepEqual(a.effects,b.effects,label+' effects');assert.deepEqual(a.stats,b.stats,label+' statistics');
}

test('Connected captures retain ascending tile order and seeded rewards',()=>{
  const games=pair();
  for(const g of games){at(g,19,20).owner=0;for(let x=20;x<=22;x++){at(g,x,20).capture=.999;at(g,x,20).claim=0;g.addUnit(0,'infantry',x+.5,20.5);}}
  for(const g of games)g.capture(1);same(...games);
  for(let x=20;x<=22;x++)assert.equal(at(games[0],x,20).owner,0);
});

test('Unoccupied claims decay, zero claims reset and blocked ground stays unchanged',()=>{
  const games=pair();
  for(const g of games){for(let x=10;x<40;x++){const t=at(g,x,30);t.claim=x%16;t.capture=x%3?.17:0;}at(g,12,30).terrain='water';at(g,13,30).terrain='mountain';}
  for(let step=0;step<8;step++){for(const g of games)g.capture(.2);same(...games,'decay '+step);}
  assert.equal(at(games[0],10,30).claim,-1);assert.equal(at(games[0],12,30).claim,12);
});

test('Allied pressure combines without stealing friendly tiles and ties remain contested',()=>{
  const games=pair({mode:'team-conquest'});
  for(const g of games){at(g,39,40).owner=0;at(g,40,40).owner=1;at(g,41,40).owner=2;
    for(const team of [0,1])for(let i=0;i<5;i++)g.addUnit(team,'infantry',40.5+i*.01,40.5);
    for(const team of [2,4])for(let i=0;i<5;i++)g.addUnit(team,'infantry',60.5+i*.01,40.5);
    at(g,59,40).owner=2;
  }
  for(let step=0;step<12;step++){for(const g of games)g.capture(.3);same(...games,'allied '+step);}
  assert.equal(at(games[0],40,40).owner,1);assert.equal(at(games[0],60,40).owner,-1);
});

test('Bridge and pass claims behave like land while water and mountains cannot be captured',()=>{
  const games=pair();for(const g of games){
    for(let x=21;x<=24;x++){at(g,x,34).owner=0;const t=at(g,x,35);t.terrain=x<23?'water':'mountain';t.feature=x===21?'bridge':x===23?'pass':null;g.addUnit(0,'infantry',x+.5,35.5);}
  }
  for(let step=0;step<20;step++){for(const g of games)g.capture(.3);same(...games,'crossing '+step);}
  assert.equal(at(games[0],21,35).owner,0);assert.equal(at(games[0],23,35).owner,0);assert.equal(at(games[0],22,35).owner,-1);assert.equal(at(games[0],24,35).owner,-1);
});

test('Raid rewards, saturated effect limits and elimination preserve state and RNG exactly',()=>{
  const games=pair();for(const g of games){
    g.teams[6].sigil='kraken';at(g,39,40).owner=6;at(g,40,40).owner=1;at(g,40,40).capture=.999;at(g,40,40).claim=6;g.addUnit(6,'infantry',40.5,40.5);
    at(g,49,50).owner=3;at(g,50,50).capture=.8;at(g,50,50).claim=3;g.addUnit(3,'hero',50.5,50.5);
    g.effects=Array.from({length:180},(_,i)=>({type:'capture',x:i,y:0,team:0,life:.6}));g.eliminate(3);
  }
  const before=games[0].teams[6].gold;
  for(let step=0;step<12;step++){for(const g of games)g.capture(.25);same(...games,'raid '+step);}
  assert.equal(games[0].teams[6].gold,before+6);assert.ok(at(games[0],40,40).raidMask&(1<<6));
});

test('Sixteen-faction scripted movement matches the full scan through captures and decay',()=>{
  const games=pair({mode:'team-conquest'});
  for(const g of games){
    for(const t of g.tiles)if(t.x>2&&t.y>2&&t.x<g.W-3&&t.y<g.H-3)t.owner=Math.floor(t.x/7)%16;
    for(let y=5;y<90;y++){const t=at(g,55,y);t.terrain='water';t.feature=y>=40&&y<=44?'bridge':null;}
    for(let team=0;team<16;team++)for(let i=0;i<12;i++)g.addUnit(team,i===0?'hero':'infantry',8.5+team*6,25.5+i*.25);
  }
  let seed=99841;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let step=0;step<90;step++){
    for(let i=0;i<games[0].units.length;i++){
      const x=3.5+random()*(games[0].W-7),y=3.5+random()*(games[0].H-7);
      for(const g of games){const u=g.units[i];u.x=x;u.y=y;if(step===35&&i%9===0)u.hp=0;}
    }
    if(step===55)for(const g of games)g.eliminate(5);
    const dt=.1+random()*.6;for(const g of games)g.capture(dt);same(...games,'script '+step);
  }
});

if(process.argv.includes('--benchmark')){
  const games=pair({scale:'continent'});for(const g of games)for(let team=0;team<16;team++)for(let i=0;i<70;i++)g.addUnit(team,'infantry',8.5+team*12,22.5+i*.01);
  const measure=g=>{for(let i=0;i<10;i++)g.capture(.2);const start=performance.now();for(let i=0;i<50;i++)g.capture(.2);return (performance.now()-start)/50;};
  const fullMs=measure(games[1]),sparseMs=measure(games[0]);same(...games,'benchmark');
  console.log(JSON.stringify({continentCaptureMeanMs:{fullScan:fullMs,sparse:sparseMs},speedup:fullMs/sparseMs}));
}
console.log(`${cases} capture equivalence tests passed.`);
