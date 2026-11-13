import assert from 'node:assert/strict';
import {Game,UNIT_DEFS} from '../../core.js';
import {LAND_MAPS,isPassableTile} from '../../lands.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const fogSettings=[false,true];
function fixture(mode='defend-king',fogOfWar=false,extra={}){
  const g=new Game({landscape:'open',scale:'standard',enemies:3,seed:44277,mode,fogOfWar,...extra});
  // Preserve actual kings and their lookup IDs; deleting all troops would end
  // Defend the King before an isolated objective check could exercise it.
  const retained=g.units.filter(u=>u.isKing||g.unitClass(u)==='hero');
  g.units=retained;g.byId=new Map([...g.buildings,...retained].map(e=>[e.id,e]));
  for(const s of g.teams){s.count=retained.filter(u=>u.team===s.id).length;s.gold=0;s.aiClock=1e9;s.powerReadyAt=1e9;s.heroTimer=0;}
  for(const b of g.buildings){b.spawnTimer=-1e9;b.cooldown=1e9;}
  for(const u of retained){g.hold([u.id]);u.cooldown=1e9;}
  g.projectiles=[];g.fireZones=[];g.hash.rebuild(g.units);g.vision.update(true);return g;
}
function occupy(g,flag,team,n=1){
  const troops=Array.from({length:n},(_,i)=>g.addUnit(team,'infantry',flag.x+(i%3)*.12,flag.y+Math.floor(i/3)*.12));
  g.hold(troops.map(u=>u.id));g.hash.rebuild(g.units);g.vision.update(true);return troops;
}
function leave(g,troops){for(const u of troops)if(u.hp>0){u.hp=0;g.teams[u.team].count--;}g.hash.rebuild(g.units);g.vision.update(true);}
function firstWave(g){g.time=15;g.updateObjectives(0);assert.equal(g.objectives.length,3);return g.objectives[0];}
function keepFor(g,team){return g.buildings.find(b=>b.team===team&&b.type==='keep'&&b.hp>0);}

test('Defend the King always starts four independent living kings with 1200 health',()=>{
  for(const fogOfWar of fogSettings)for(const enemies of [1,15]){
    const g=fixture('defend-king',fogOfWar,{enemies});
    assert.equal(g.teams.length,4);assert.equal(g.config.enemies,3);assert.equal(new Set(g.teams.map(s=>s.alliance)).size,4);
    for(const s of g.teams){const king=g.kingFor(s.id);assert.ok(king);assert.equal(king.id,s.kingId);assert.equal(king.type,'hero');assert.equal(king.hp,1200);assert.equal(king.maxHp,1200);assert.equal(g.units.filter(u=>u.team===s.id&&u.isKing).length,1);}
    assert.equal(g.objectives.length,0);assert.equal(g.winner,null);
  }
});

test('A king death immediately eliminates its entire faction despite a living castle and prevents respawn',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('defend-king',fogOfWar),king=g.kingFor(1),keep=keepFor(g,1),guard=g.addUnit(1,'infantry',king.x+1,king.y);
    assert.ok(keep.hp>0);g.projectiles.push({team:1});g.addFireZone(1,king.x,king.y,2,5,10);
    g.damage(king,king.maxHp+1,{team:0});
    assert.equal(g.kingFor(1),null);assert.equal(g.teams[1].alive,false);assert.equal(g.group(1).length,0);assert.equal(guard.hp,0);assert.equal(keep.hp,0);
    assert.equal(g.teams[1].heroTimer,0);assert.ok(g.buildings.filter(b=>b.team===1).every(b=>b.hp<=0));assert.ok(g.tiles.every(t=>t.owner!==1));
    assert.ok(g.projectiles.every(p=>p.team!==1));assert.ok(g.fireZones.every(z=>z.team!==1));
    const heroCount=g.units.filter(u=>u.team===1&&u.type==='hero').length;g.time+=40;g.update(.06);
    assert.equal(g.units.filter(u=>u.team===1&&u.type==='hero'&&u.hp>0).length,0);assert.equal(g.units.filter(u=>u.team===1&&u.type==='hero').length<=heroCount,true);assert.equal(g.teams[1].heroTimer,0);
    assert.equal(g.winner,null,'Other living kings must keep the match running.');
  }
});

test('Losing a last castle leaves its king and army alive while king deaths decide victory',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('defend-king',fogOfWar),king=g.kingFor(0),guard=g.addUnit(0,'infantry',king.x+1,king.y),keep=keepFor(g,0);
    g.damage(keep,1e6,{team:1});g.checkVictory();
    assert.equal(g.teams[0].alive,true);assert.equal(g.kingFor(0),king);assert.ok(guard.hp>0);assert.equal(g.winner,null);assert.equal(keepFor(g,0),undefined);
    for(const team of [1,2,3])g.damage(g.kingFor(team),1e6,{team:0});
    assert.equal(g.winner,0);assert.match(g.victoryReason,/rival kings defeated/i);
    const loss=fixture('defend-king',fogOfWar);loss.damage(loss.kingFor(0),1e6,{team:1});
    assert.equal(loss.teams[0].alive,false);assert.ok(loss.hostile(loss.winner,0));assert.match(loss.victoryReason,/king was slain/i);
  }
});

test('Three central reinforcement flags arrive at 15 seconds and rotate every 45 seconds',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('defend-king',fogOfWar);g.time=14.99;g.updateObjectives(0);assert.equal(g.objectives.length,0);assert.equal(g.flagWave,0);
    firstWave(g);const first=[...g.objectives],firstLocations=first.map(f=>[f.x,f.y]);
    assert.equal(g.flagWave,1);assert.equal(g.nextFlagWaveAt,60);assert.equal(new Set(first.map(f=>f.id)).size,3);
    for(const f of first){assert.equal(f.expiresAt,60);assert.equal(f.required,12);assert.ok(Math.abs(f.x-g.W/2)<=g.W*.22);assert.ok(Math.abs(f.y-g.H/2)<=g.H*.22);}
    occupy(g,first[0],0);g.updateObjectives(5);assert.equal(first[0].progress[0],5);
    g.time=59.99;g.updateObjectives(0);assert.deepEqual(g.objectives.map(f=>f.id),first.map(f=>f.id));
    g.time=60;g.updateObjectives(0);assert.equal(g.flagWave,2);assert.equal(g.objectives.length,3);assert.equal(g.nextFlagWaveAt,105);
    assert.ok(g.objectives.every(f=>!first.some(old=>old.id===f.id)));assert.notDeepEqual(g.objectives.map(f=>[f.x,f.y]),firstLocations);
    assert.ok(g.objectives.every(f=>f.progress.every(p=>p===0)&&f.expiresAt===105),'Expired partial captures must not carry into a new wave.');
    g.time=105;g.updateObjectives(0);assert.equal(g.flagWave,3);assert.equal(g.objectives.length,3);assert.equal(g.nextFlagWaveAt,150);
  }
});

test('Royal captures require 12 seconds at 90 percent dominance and grant 12 ordinary troops even without a castle or free supply',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('defend-king',fogOfWar),flag=firstWave(g),king=g.kingFor(0);occupy(g,flag,0,9);g.updateObjectives(5);
    const rivals=occupy(g,flag,1,2);g.updateObjectives(6);assert.equal(flag.progress[0],5);assert.equal(flag.contested,true);
    leave(g,[rivals[0]]);g.updateObjectives(6.9);assert.ok(Math.abs(flag.progress[0]-11.9)<1e-7);assert.equal(flag.controller,0);assert.equal(g.objectiveScores[0],0);
    g.damage(keepFor(g,0),1e6,{team:1});assert.equal(g.teams[0].alive,true);assert.equal(keepFor(g,0),undefined);
    g.teams[0].cap=g.group(0).length;const before=g.group(0).length;g.updateObjectives(.1);
    const reinforcements=g.units.filter(u=>u.team===0&&u.royalReinforcement);
    assert.equal(g.objectiveScores[0],1);assert.equal(reinforcements.length,12);assert.equal(g.group(0).length,before+12);assert.ok(g.group(0).length>g.teams[0].cap);
    assert.deepEqual(Object.fromEntries(['infantry','archer','cavalry'].map(type=>[type,reinforcements.filter(u=>u.type===type).length])),{infantry:6,archer:3,cavalry:3});
    for(const u of reinforcements){assert.ok(!u.elite);assert.equal(u.maxHp,UNIT_DEFS[u.type].hp);assert.ok(Math.hypot(u.x-king.x,u.y-king.y)<2.5);assert.equal(u.order.mode,'idle');}
    assert.equal(flag.consumed,true);assert.ok(!g.objectives.includes(flag));
    g.awardObjective(flag,0);g.awardObjective(flag,0);g.updateObjectives(30);assert.equal(g.objectiveScores[0],1);assert.equal(g.units.filter(u=>u.royalReinforcement).length,12);
  }
});

test('Empty royal flags freeze capture progress and cannot reward an eliminated king',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('defend-king',fogOfWar),flag=firstWave(g),troops=occupy(g,flag,1,3);g.updateObjectives(4);leave(g,troops);g.updateObjectives(7);
    assert.equal(flag.progress[1],4);assert.equal(flag.controller,null);assert.equal(flag.contested,false);
    g.damage(g.kingFor(1),1e6,{team:0});const before=g.units.length;g.awardObjective(flag,1);
    assert.equal(g.objectiveScores[1],0);assert.equal(g.units.length,before);assert.ok(!flag.consumed);
  }
});

test('Crown Control accumulates independent hold time and freezes during contested or empty intervals',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('crown-control',fogOfWar);assert.equal(g.objectives.length,1);const flag=g.objectives[0];
    assert.ok(Math.hypot(flag.x-g.W/2,flag.y-g.H/2)<3);assert.equal(flag.required,120);
    const ours=occupy(g,flag,0,9);g.updateObjectives(50);assert.equal(g.controlScores[0],50);
    const rivals=occupy(g,flag,1,2);g.updateObjectives(30);assert.equal(g.controlScores[0],50);assert.equal(flag.contested,true);
    leave(g,[rivals[0]]);g.updateObjectives(10);assert.equal(g.controlScores[0],60,'Exactly 90 percent dominance must count.');
    leave(g,ours);g.updateObjectives(35);assert.equal(g.controlScores[1],35);assert.equal(g.controlScores[0],60);
    leave(g,[rivals[1]]);g.updateObjectives(90);assert.equal(g.controlScores[0],60);assert.equal(g.controlScores[1],35);assert.equal(g.winner,null);
    occupy(g,flag,0);g.updateObjectives(59.5);assert.equal(g.controlScores[0],119.5);assert.equal(g.winner,null);g.updateObjectives(.5);
    assert.equal(g.controlScores[0],120);assert.equal(g.winner,0);assert.equal(g.objectiveScores[0],0);assert.equal(g.units.filter(u=>u.elite||u.royalReinforcement).length,0);
    const rival=fixture('crown-control',fogOfWar);occupy(rival,rival.objectives[0],1);rival.updateObjectives(120);assert.equal(rival.winner,1);
  }
});

test('Blitz Flags captures in ten seconds, gives eight elite rewards, rests twelve seconds and wins on three captures',()=>{
  for(const fogOfWar of fogSettings){
    const g=fixture('blitz-flags',fogOfWar),flag=g.objectives[0];assert.equal(g.objectives.length,3);assert.equal(flag.required,10);occupy(g,flag,0);
    g.updateObjectives(9.99);assert.equal(g.objectiveScores[0],0);g.updateObjectives(.01);assert.equal(g.objectiveScores[0],1);assert.equal(flag.cooldownUntil,12);
    const first=g.units.filter(u=>u.elite);assert.equal(first.length,8);for(const u of first)assert.equal(u.maxHp,UNIT_DEFS[u.type].hp*1.5);
    g.time=11.99;g.updateObjectives(10);assert.equal(g.objectiveScores[0],1);assert.equal(flag.progress[0],0);
    g.time=12;g.updateObjectives(10);assert.equal(g.objectiveScores[0],2);assert.equal(g.winner,null);assert.equal(flag.cooldownUntil,24);
    g.time=24;g.updateObjectives(10);assert.equal(g.objectiveScores[0],3);assert.equal(g.winner,0);assert.equal(g.units.filter(u=>u.elite).length,24);assert.equal(flag.captures,3);
  }
});

test('Pausing freezes royal wave timers and both new flag progress systems',()=>{
  for(const fogOfWar of fogSettings)for(const mode of ['defend-king','crown-control','blitz-flags']){
    const g=fixture(mode,fogOfWar);let flag;
    if(mode==='defend-king')g.time=14.98;
    else{flag=g.objectives[0];occupy(g,flag,0);g.updateObjectives(3);}
    const time=g.time,score=[...g.controlScores],progress=flag?.progress[0];g.paused=true;
    for(let i=0;i<100;i++)g.update(.06);
    assert.equal(g.time,time);assert.deepEqual(g.controlScores,score);if(flag)assert.equal(flag.progress[0],progress);else assert.equal(g.objectives.length,0);
    g.paused=false;g.update(.04);
    assert.ok(g.time>time);if(flag)assert.ok(flag.progress[0]>progress);else{assert.equal(g.objectives.length,3);assert.equal(g.flagWave,1);}
  }
});

function royalArmy(fogOfWar){
  const g=fixture('defend-king',fogOfWar),s=g.teams[1],king=g.kingFor(1);king.x=50;king.y=40;king.order.x=50;king.order.y=40;
  const soldiers=Array.from({length:40},(_,i)=>g.addUnit(1,i%5?'infantry':'archer',king.x+(i%8-3.5)*.45,king.y+(Math.floor(i/8)-2)*.45));
  const p=g.aiPlanFor(s);p.economyAt=1e9;p.frontierAt=1e9;s.gold=0;firstWave(g);g.hash.rebuild(g.units);g.vision.update(true);
  return {g,s,king,soldiers};
}

test('Rival royal commanders keep a king guard and send a separate company toward reinforcement flags',()=>{
  for(const fogOfWar of fogSettings){
    const {g,s,king,soldiers}=royalArmy(fogOfWar);g.ai(s);
    const guards=soldiers.filter(u=>u.order?.aiTask==='kingGuard'),expedition=soldiers.filter(u=>u.order?.aiTask==='royalFlag'),scouts=soldiers.filter(u=>u.order?.aiTask==='scout');
    assert.ok(guards.length>=10);assert.ok(expedition.length>=10);assert.equal(guards.length+expedition.length+scouts.length,soldiers.length);
    if(fogOfWar)assert.ok(scouts.length>0);else assert.equal(scouts.length,0);
    assert.equal(king.order.mode,'hold');assert.ok(!['royalFlag','kingHunt'].includes(king.order.aiTask));
    for(const u of guards)assert.ok(Math.hypot(u.order.groupX-king.x,u.order.groupY-king.y)<4);
    for(const u of expedition)assert.ok(g.objectives.some(f=>f.id===u.order.aiFlagId));
  }
});

test('Royal hunts target visible enemy kings and fog prevents tracking a king after it disappears',()=>{
  for(const fogOfWar of fogSettings){
    const {g,s,king,soldiers}=royalArmy(fogOfWar);g.time=90;g.updateObjectives(0);g.vision.update(true);g.ai(s);
    if(fogOfWar)assert.equal(soldiers.some(u=>u.order?.aiTask==='kingHunt'),false,'Unseen starting kings cannot receive hunt orders.');
    else assert.ok(soldiers.some(u=>u.order?.aiTask==='kingHunt'));
    const rival=g.kingFor(0);rival.x=60;rival.y=40;rival.order.x=60;rival.order.y=40;
    const scout=g.addUnit(1,'cavalry',58,40);g.hold([scout.id]);g.hash.rebuild(g.units);g.vision.update(true);assert.equal(g.isVisibleTo(1,rival),true);
    g.ai(s);const hunters=g.group(1).filter(u=>u.order?.aiTask==='kingHunt');assert.ok(hunters.length>0);
    for(const u of hunters){assert.equal(u.order.aiTarget,rival.id);assert.equal(u.order.groupX,rival.x);assert.equal(u.order.groupY,rival.y);}
    if(fogOfWar){
      const tile=g.tiles.find(t=>isPassableTile(t)&&Math.hypot(t.x+.5-king.x,t.y+.5-king.y)>20&&!g.isVisibleTo(1,{x:t.x+.5,y:t.y+.5}));assert.ok(tile);
      rival.x=tile.x+.5;rival.y=tile.y+.5;rival.order.x=rival.x;rival.order.y=rival.y;scout.x=50;scout.order.x=50;g.hash.rebuild(g.units);g.vision.update(true);assert.equal(g.isVisibleTo(1,rival),false);
      g.ai(s);assert.ok(hunters.some(u=>u.order?.aiTask==='kingHunt'),'A last-seen king position may still be investigated.');
      for(const u of hunters)if(u.order?.aiTask==='kingHunt'){assert.equal(u.order.groupX,60);assert.equal(u.order.groupY,40);}
      assert.ok(g.group(1).every(u=>u.order?.aiTarget!==rival.id||u.order.groupX!==rival.x||u.order.groupY!==rival.y),'Hidden king motion cannot update any hunt or guard destination.');
    }
    assert.equal(g.kingFor(1),king);assert.ok(!['royalFlag','kingHunt'].includes(king.order.aiTask));
  }
});

test('Defensive royal houses scout unknown land without consuming the king guard or flag company',()=>{
  const {g,s,king,soldiers}=royalArmy(true),plan=g.aiPlanFor(s);plan.style='defensive';g.ai(s);
  const scouts=soldiers.filter(u=>u.order?.aiTask==='scout'),guardIds=new Set(soldiers.filter(u=>u.order?.aiTask==='kingGuard').map(u=>u.id));
  assert.ok(scouts.length>=2);assert.equal(plan.scoutStyle,'royal reconnaissance');
  for(const u of scouts){assert.equal(u.order.mode,'move');assert.ok(!guardIds.has(u.id));assert.notEqual(u.id,king.id);assert.notEqual(g.tileAt(u.order.x,u.order.y).owner,s.id);assert.ok(g.navigation.route(u,u.order,g.unitClass(u)).reachable);}
  assert.ok(soldiers.some(u=>u.order?.aiTask==='royalFlag'));g.time+=3;g.ai(s);assert.ok(scouts.every(u=>u.order?.aiTask==='scout'));
});

test('Royal starts and central flags remain separated on the previously crowded campaign seeds',()=>{
  for(const seed of [10,16])for(const {id:landscape} of LAND_MAPS){
    const g=new Game({landscape,seed,mode:'defend-king',scale:'standard',enemies:3});g.time=15;g.updateObjectives(0);
    const quadrants=new Set(g.teams.map(s=>`${s.home.x<g.W/2?'west':'east'}-${s.home.y<g.H/2?'north':'south'}`));assert.equal(quadrants.size,4,`${landscape} seed ${seed}: four separated corner starts`);
    assert.equal(g.objectives.length,3,`${landscape} seed ${seed}`);
    for(const flag of g.objectives)for(const s of g.teams)assert.ok(Math.hypot(flag.x-s.home.x,flag.y-s.home.y)>=14,`${landscape} seed ${seed}: central standards cannot overlap a starting kingdom`);
  }
});

test('Every new mode places reachable central flags on all nine landscapes',()=>{
  for(const {id:landscape} of LAND_MAPS)for(const mode of ['defend-king','crown-control','blitz-flags']){
    const g=new Game({landscape,mode,scale:'standard',enemies:3,seed:44277});
    if(mode==='defend-king'){g.time=15;g.updateObjectives(0);}
    assert.equal(g.objectives.length,mode==='crown-control'?1:3,`${landscape} ${mode}`);
    for(const flag of g.objectives){
      assert.ok(isPassableTile(g.tileAt(flag.x,flag.y)),`${landscape} ${mode}: legal flag ground`);
      for(const s of g.teams)assert.ok(g.navigation.route(s.home,flag,'infantry').reachable,`${landscape} ${mode}: ${s.name} must reach every flag`);
    }
  }
});

console.log(`${cases} royal and flag mode checks passed.`);
