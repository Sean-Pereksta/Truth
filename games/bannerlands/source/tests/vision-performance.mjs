import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {WarVision} from '../../vision.js';

let checks=0;
const test=(name,fn)=>{if(process.argv.includes('--benchmark-only'))return;fn();checks++;console.log('PASS '+name);};
const fixture=(count=3000,clustered=true)=>{
  const W=224,H=176,teams=Array.from({length:16},(_,id)=>({id,alliance:id,alive:true}));
  const g={W,H,teams,time:0,config:{fogOfWar:true},tiles:Array.from({length:W*H},(_,i)=>({owner:i%23-1})),units:[],buildings:[],castles:[],
    allied:(a,b)=>a>=0&&b>=0&&teams[a]?.alliance===teams[b]?.alliance,
    unitClass:u=>u.type==='crossbow'?'archer':u.type};
  for(let i=0;i<count;i++){
    const team=i%16,rank=Math.floor(i/16),x=clustered?24+(team%4)*52+(rank%20)*.43:2+(i*17.371)%(W-4),y=clustered?20+Math.floor(team/4)*40+Math.floor(rank/20)*.43:2+(i*11.173)%(H-4);
    g.units.push({id:i+1,type:i%5?'infantry':'cavalry',team,x,y,hp:100,maxHp:100});
  }
  for(let team=0;team<16;team++)g.buildings.push({id:count+team+1,type:'keep',team,x:15+(team%4)*52,y:12+Math.floor(team/4)*40,hp:2500,maxHp:2500,level:1});
  return g;
};
function referenceGrid(g,entities,team){
  const grid=new Uint8Array(g.W*g.H),v=new WarVision(g);
  for(const entity of entities){if(entity.hp<=0||!g.teams[entity.team]?.alive||!g.allied(team,entity.team))continue;
    const r=v.sightRadius(entity),rr=r*r;
    for(let y=Math.max(0,Math.floor(entity.y-r));y<=Math.min(g.H-1,Math.floor(entity.y+r));y++)for(let x=Math.max(0,Math.floor(entity.x-r));x<=Math.min(g.W-1,Math.floor(entity.x+r));x++)
      if((x+.5-entity.x)**2+(y+.5-entity.y)**2<=rr)grid[y*g.W+x]=1;
  }
  return grid;
}

test('Large overlapping sight circles retain exact reference cell boundaries',()=>{
  const g=fixture(3000),v=new WarVision(g);v.update(true);
  for(const team of [0,3,7,15])assert.deepEqual(v.gridFor(team),referenceGrid(g,[...g.units,...g.buildings],team));
  for(const offset of [.5,.00000001,.4999999999,.9999999999]){
    g.units=[{id:9000,type:'infantry',team:0,x:80+offset,y:80+offset,hp:100}];g.buildings=[];v.update(true);
    assert.deepEqual(v.gridFor(0),referenceGrid(g,g.units,0));
  }
});

test('Movement, deaths, replacements, alliance changes and upgraded towers update exact shared sight',()=>{
  const g=fixture(100),v=new WarVision(g);v.update(true);
  for(let frame=0;frame<8;frame++){
    g.time+=.21;for(const u of g.units){u.x+=.11;u.y-=.07;}
    if(frame===1)g.units[0].hp=0;
    if(frame===2)g.units.splice(1,3);
    if(frame===3)g.units.push({id:9999,type:'hero',team:2,x:100.999999,y:80.5,hp:100});
    if(frame===4){g.teams[1].alliance=0;g.buildings[0].type='tower';g.buildings[0].level=3;}
    if(frame===5)g.teams[2].alive=false;
    if(frame===6)g.units=[];
    v.update(true);
    for(const team of [0,1,2,3])assert.deepEqual(v.gridFor(team),referenceGrid(g,[...g.units,...g.buildings],team));
  }
});

test('Knowledge queries read live entity changes within one sight refresh without exposing hidden troops',()=>{
  const g=fixture(0),v=new WarVision(g);g.units=[{id:1,type:'infantry',team:0,x:30.5,y:30.5,hp:100},{id:2,type:'infantry',team:1,x:35.5,y:30.5,hp:100}];g.buildings=[];v.update(true);
  assert.equal(v.knownUnits(0).length,2);g.units[1].x=100;assert.equal(v.knownUnits(0).length,1);
  g.units[1].x=35.5;g.units[1].hp=0;assert.equal(v.knownUnits(0).length,1);
  g.units.push({id:3,type:'cavalry',team:1,x:34.5,y:30.5,hp:100});assert.deepEqual(v.knownUnits(0).map(u=>u.id),[1,3]);
  const originalUpdate=v.update;let updates=0;v.update=function(...args){updates++;return originalUpdate.apply(this,args);};v.knownUnits(0);
  assert.equal(updates,1,'A knowledge query performs one freshness check, rather than one for each candidate.');
});

test('Stationary thousands reuse exact sight geometry and sparse owner work',()=>{
  const g=fixture(6000),v=new WarVision(g);v.update(true);g.time+=.21;v.update();
  assert.equal(v.stats.changedSources,0,'Stationary armies must not recompute the same circle geometry.');assert.equal(v.stats.changedCells,0,'Stationary armies retain the existing exact sight union.');
  assert.ok(v.stats.ownerReads<g.W*g.H*3,'Ownership work scales with one world scan and visible ground rather than sixteen world scans.');
  const previous=v.exploredFor(0).slice();g.units=[];g.buildings=[];v.update(true);
  assert.equal(v.sources.size,0,'Removed entities cannot retain sight or unbounded footprint records.');
  for(const data of v.alliances.values()){assert.equal(data.visibleCount,0);assert.ok(data.current.every(cell=>cell===0));assert.ok(data.counts.every(count=>count===0));}
  assert.deepEqual(v.exploredFor(0),previous,'Losing every scout preserves explored terrain.');
});

test('Disabled fog keeps every direct knowledge API complete',()=>{
  const g=fixture(10),v=new WarVision(g);g.castles=[{id:999,type:'ruin',team:-1,x:200,y:170}];g.config.fogOfWar=false;
  assert.deepEqual(v.knownUnits(0),g.units);assert.deepEqual(v.knownBuildings(0),g.buildings);assert.deepEqual(v.knownCastleSites(0),g.castles);
});

test('Edge circles and malformed distant coordinates cannot reveal extra map cells',()=>{
  const g=fixture(0),v=new WarVision(g);g.buildings=[];
  for(const [x,y]of [[0,0],[-3,1],[224,176],[1e15,20],[20,-1e15],[NaN,20],[20,Infinity]]){
    g.units=[{id:1,type:'cavalry',team:0,x,y,hp:100}];v.update(true);
    assert.deepEqual(v.gridFor(0),referenceGrid(g,g.units,0));
  }
  assert.ok(v.sources.size<=1,'Replacing an entity must retire its former contribution record.');
});

console.log(`${checks} fog scaling regression checks passed.`);
if(process.argv.includes('--benchmark')){
  const index=process.argv.indexOf('--baseline'),Baseline=index>=0?(await import(pathToFileURL(process.argv[index+1]))).WarVision:null;
  const rows=[];
  for(const count of [3000,6000])for(const clustered of [true,false])for(const moving of [false,true]){
    for(const [name,Vision]of [['baseline',Baseline],['current',WarVision]]){if(!Vision)continue;
      const g=fixture(count,clustered),v=new Vision(g),times=[],queries=[];
      for(let frame=-5;frame<25;frame++){
        g.time+=.21;if(moving)for(const u of g.units){u.x=Math.min(g.W-1.2,u.x+.21);u.y=Math.min(g.H-1.2,u.y+.07);}
        const at=performance.now();v.update(true);if(frame>=0)times.push(performance.now()-at);
        const qa=performance.now();for(let team=0;team<16;team++)v.knownUnits(team);if(frame>=0)queries.push(performance.now()-qa);
      }
      times.sort((a,b)=>a-b);queries.sort((a,b)=>a-b);rows.push({name,count,clustered,moving,refreshMedianMs:times[12],refreshP95Ms:times[23],sixteenQueriesMs:queries[12]});
    }
  }
  console.log(JSON.stringify(rows,null,2));
}
