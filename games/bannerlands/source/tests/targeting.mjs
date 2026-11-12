import assert from 'node:assert/strict';
import {Game} from '../../core.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log(`PASS ${name}`);};
const fixture=(config={})=>{
  const g=new Game({house:0,enemies:3,scale:'standard',seed:44277,...config});
  g.units=[];g.buildings=[];g.byId=new Map();g.time=100;
  for(const t of g.tiles){t.owner=-1;t.claim=-1;t.capture=0;}
  for(const s of g.teams){s.tiles=0;s.count=0;s.aiPlan=null;s.alive=true;}
  const s=g.teams[1];s.home={x:30.5,y:45.5};s.strategy='mass';
  g.addBuilding(s.id,'keep',s.home.x,s.home.y);
  const player=g.addBuilding(0,'keep',70.5,45.5),rival=g.addBuilding(2,'keep',30.5,85.5);
  g.teams[0].home={x:player.x,y:player.y};g.teams[2].home={x:rival.x,y:rival.y};g.teams[3].home={x:100.5,y:10.5};
  g.hash.rebuild(g.units);
  return {g,s,p:g.aiPlanFor(s),player,rival};
};
const ownRect=(g,team,x0,y0,x1,y1)=>{
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)g.tileAt(x+.5,y+.5).owner=team;
};
const closeRival=({player,rival})=>{player.x=100.5;player.y=45.5;rival.x=30.5;rival.y=75.5;};
const invasion=(g,target,{allied=false,stale=false,dead=false}={})=>{
  const other=g.teams[3];if(allied)other.alliance=g.teams[1].alliance;
  const cohort=[];
  for(let i=0;i<12;i++){
    const u=g.addUnit(other.id,'infantry',100.5+(i%2)*.1,10.5+Math.floor(i/2)*.1);
    u.order={x:target.x,y:target.y,mode:'attack',aiTask:'assault',aiTarget:target.id};
    if(dead)u.hp=0;cohort.push(u.id);
  }
  other.aiPlan={phase:'advance',targetId:target.id,targetTeam:target.team,cohort,startedAt:stale?0:g.time,timeout:stale?1:200};
  g.hash.rebuild(g.units);
};

test('A nearby rival capital beats a distant mildly damaged player capital',()=>{
  const f=fixture();closeRival(f);f.player.hp=f.player.maxHp*.8;
  assert.equal(f.g.aiTarget(f.s,f.p),f.rival);
});

test('Clear geographic preference follows the location when player and rival ownership swap',()=>{
  const f=fixture();closeRival(f);
  assert.equal(f.g.aiTarget(f.s,f.p),f.rival);
  [f.player.team,f.rival.team]=[f.rival.team,f.player.team];
  assert.equal(f.g.aiTarget(f.s,f.p),f.rival);
});

test('Owned frontier and a shared border favor a reachable neighboring rival',()=>{
  const {g,s,p,player}=fixture();
  ownRect(g,s.id,30,44,66,46);ownRect(g,player.team,67,44,72,46);
  assert.equal(g.aiTarget(s,p),player);
});

test('A distant foothold does not erase the cost of marching the invasion from home',()=>{
  const f=fixture();closeRival(f);
  ownRect(f.g,f.s.id,30,44,96,46);ownRect(f.g,f.player.team,97,44,102,46);
  assert.equal(f.g.aiTarget(f.s,f.p),f.rival);
});

test('An approach through another hostile house is less attractive than an equal clear route',()=>{
  const {g,s,p,player,rival}=fixture(),before=g.aiTarget(s,p),other=before===player?rival:player;
  // Paint a broad section of the preferred route, leaving its endpoints neutral.
  for(const t of g.tiles){
    const x=t.x+.5,y=t.y+.5,dx=before.x-s.home.x,dy=before.y-s.home.y,length2=dx*dx+dy*dy;
    const along=((x-s.home.x)*dx+(y-s.home.y)*dy)/length2;
    const offset=Math.abs((x-s.home.x)*dy-(y-s.home.y)*dx)/Math.sqrt(length2);
    if(along>.2&&along<.8&&offset<3)t.owner=3;
  }
  assert.equal(g.aiTarget(s,p),other);
});

test('An unrelated hostile fort along the approach can redirect an invasion',()=>{
  const {g,s,p,player,rival}=fixture(),before=g.aiTarget(s,p),other=before===player?rival:player;
  g.addBuilding(3,'tower',(before.x+s.home.x)/2,(before.y+s.home.y)/2);
  assert.equal(g.aiTarget(s,p),other);
});

test('Retaliation cannot make a remote capital irresistible as attackers accumulate at home',()=>{
  const f=fixture();closeRival(f);
  for(let i=0;i<100;i++)f.g.addUnit(f.player.team,'infantry',f.s.home.x+2+(i%5)*.1,f.s.home.y+Math.floor(i/5)*.1);
  f.g.hash.rebuild(f.g.units);
  assert.equal(f.g.aiTarget(f.s,f.p),f.rival);
});

test('An independent rival invasion makes another equally viable enemy more attractive',()=>{
  const {g,s,p,player,rival}=fixture(),before=g.aiTarget(s,p),other=before===player?rival:player;
  invasion(g,before);
  assert.equal(g.aiTarget(s,p),other);
});

test('Expired, dead and allied invasion waves do not count as independent target pressure',()=>{
  for(const options of [{stale:true},{dead:true},{allied:true}]){
    const {g,s,p}=fixture(),before=g.aiTarget(s,p);
    invasion(g,before,options);
    assert.equal(g.aiTarget(s,p),before,JSON.stringify(options));
  }
});

test('Equal targets use a stable tie choice independent of building array order',()=>{
  const {g,s,p}=fixture(),before=g.aiTarget(s,p);
  g.buildings.reverse();
  assert.equal(g.aiTarget(s,p),before);
  for(let i=0;i<20;i++)g.random();
  assert.equal(g.aiTarget(s,p),before);
});

test('Symmetric targets do not always resolve to the first player-owned building',()=>{
  const choices=new Set();
  for(let seed=1;seed<=16;seed++){
    const {g,s,p}=fixture({seed});choices.add(g.aiTarget(s,p).team);
  }
  assert.ok(choices.has(0),'The player remains a valid strategic target.');
  assert.ok(choices.has(2),'A rival can win an otherwise equal target comparison.');
});

test('Allied, eliminated and destroyed holdings cannot become strategic targets',()=>{
  const {g,s,p,player,rival}=fixture();
  player.team=s.id;assert.equal(g.aiTarget(s,p),rival);
  player.team=0;g.teams[0].alive=false;assert.equal(g.aiTarget(s,p),rival);
  g.teams[0].alive=true;player.hp=0;assert.equal(g.aiTarget(s,p),rival);
  rival.hp=0;assert.equal(g.aiTarget(s,p),null);
});

console.log(`${cases} strategic targeting tests passed.`);
