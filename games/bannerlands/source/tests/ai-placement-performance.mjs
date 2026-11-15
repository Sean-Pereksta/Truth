import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Game,BUILD_DEFS} from '../../core.js';
import {isPassableTile} from '../../lands.js';
const ds=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};

// Deliberately evaluate every legal candidate before scoring. This independent
// full scan retains the previous placement and strict row-order tie behavior.
function reference(g,s,type){
  const fog=g.config.fogOfWar,d=BUILD_DEFS[type],buildings=(fog?g.knownBuildings(s.id):g.buildings).filter(b=>b.hp>0),sites=fog?g.knownCastleSites(s.id):g.castles;
  const enemies=fog?g.knownUnits(s.id).filter(u=>u.hp>0&&g.hostile(s.id,u.team)):null,owners=fog?g.vision.ownersFor(s.id):null;
  const forts=buildings.filter(b=>g.hostile(s.id,b.team)&&['keep','tower'].includes(b.type));let best=null,score=Infinity;
  for(const tile of g.tiles){
    if((owners?.[tile.y*g.W+tile.x]??tile.owner)!==s.id||!isPassableTile(tile)||!g.buildingGround(type,tile.x+.5,tile.y+.5))continue;
    const p={x:tile.x+.5,y:tile.y+.5};
    if(buildings.some(b=>ds(b,p)<(g.buildingRadius(b)+d.radius+.45)**2)||sites.some(c=>c.ruined&&ds(c,p)<(BUILD_DEFS.keep.radius+d.radius+.45)**2))continue;
    if(forts.some(b=>{const range=fog?(b.type==='keep'?5.5+(b.level||1)*.5:4.6+(b.level||1)*.5):b.type==='keep'?g.townHallDetails(b.team).range:g.towerDetails(b.id,b.team).range;return ds(b,p)<(range+d.radius+1)**2;}))continue;
    if(fog){if(enemies.some(u=>ds(u,p)<(g.unitClass(u)==='siege'?8:6.5)**2))continue;}
    else{let unsafe=false;g.hash.visit(p.x,p.y,8,u=>{if(u.hp>0&&g.hostile(s.id,u.team)&&ds(u,p)<(g.unitClass(u)==='siege'?8:6.5)**2)unsafe=true;});if(unsafe)continue;}
    const value=ds(p,s.home)*.02+(tile.terrain==='forest'?.2:0)-(!fog&&type==='tower'&&tile.terrain==='hill'?.6:0);
    if(value<score){best=p;score=value;}
  }
  return best;
}
function fixture(fog,seed=44277){
  const g=new Game({scale:'continent',enemies:3,landscape:'riverlands',seed,fogOfWar:fog});
  for(const t of g.tiles)if(isPassableTile(t))t.owner=1;
  g.recount();g.hash.rebuild(g.units);g.vision.update(true);return g;
}
test('Cheap score rejection chooses exactly the same sites across large owned realms, terrain and fog',()=>{
  for(const fog of [false,true])for(const seed of [44277,62741]){
    const g=fixture(fog,seed),s=g.teams[1];
    for(const type of ['barracks','range','stables','workshop',...(!fog?['tower']:[])])assert.deepEqual(g.aiProductionSite(s,type),reference(g,s,type),`${fog}/${seed}/${type}`);
  }
});
test('Large-realm factory searches reject losing scores before expensive safety work',()=>{
  for(const fog of [false,true]){
    const g=fixture(fog),s=g.teams[1],ground=g.buildingGround;let calls=0;
    g.buildingGround=function(...args){calls++;return ground.apply(this,args);};
    const expected=reference(g,s,'barracks'),oldCalls=calls;calls=0;const actual=g.aiProductionSite(s,'barracks');
    assert.deepEqual(actual,expected);assert.ok(expected);assert.ok(calls<oldCalls*.25,`${fog}: ${calls} safety checks versus ${oldCalls}`);
  }
});
test('An occupied best position and its equal-distance alternatives keep exact fallback selection',()=>{
  const g=fixture(true),s=g.teams[1];
  for(let i=0;i<10;i++){
    const expected=reference(g,s,'barracks');assert.deepEqual(g.aiProductionSite(s,'barracks'),expected);assert.ok(expected);
    g.addBuilding(1,'barracks',expected.x,expected.y);g.vision.update(true);
  }
});
console.log(`${checks} late-game AI placement checks passed.`);
if(process.argv.includes('--benchmark'))for(const fog of [false,true]){
  const g=fixture(fog),s=g.teams[1],before=[],after=[];
  for(let i=0;i<8;i++){
    let t=performance.now();reference(g,s,'barracks');before.push(performance.now()-t);
    t=performance.now();g.aiProductionSite(s,'barracks');after.push(performance.now()-t);
  }
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  console.log(JSON.stringify({fog,scenario:'continent realm factory placement',beforeMs:median(before),afterMs:median(after),speedup:median(before)/median(after)}));
}
