import assert from 'node:assert/strict';
import {Game,GAME_MODES,UNIT_DEFS} from '../../core.js';
import {createAuthority,validateCampaignConfig,createPrivateHomePermutation} from '../../multiplayer/authority.js';
import {snapshotWorld,createRemoteGame,applySnapshot,decodeRuns} from '../../multiplayer/snapshot.js';
import {PROTOCOL_VERSION,GAME_VERSION,ASSET_VERSION,MAX_HUMANS,compatible} from '../../multiplayer/protocol.js';
import {formationPreview} from '../../formation-placement.js';
import {createSnapshotDelta,applySnapshotDelta} from '../../multiplayer/transport-delta.js';

let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const config={scale:'standard',landscape:'crownlands',seed:44277,enemies:3};
const authority=createAuthority(config,{humanTeams:[0,1]});
const game=authority.game;
const sequence=new Map();
const command=(team,type,args=[])=>{const seq=(sequence.get(team)||0)+1;sequence.set(team,seq);return authority.command(team,{v:PROTOCOL_VERSION,seq,type,args});};

test('every human house bypasses ordinary strategic AI',()=>{
  const called=[],original=game.ai;game.ai=value=>called.push(value.id);for(const team of game.teams)team.aiClock=-1;
  authority.step();game.ai=original;assert.deepEqual(called,[2,3]);assert.ok(game.humanTeams.has(1));
});
test('house one commands its own troops through the existing movement rules',()=>{
  const hero=game.heroFor(1),other=game.heroFor(0),oldOrder=other.order;
  const result=command(1,'command',[[hero.id],hero.x+2,hero.y,'move','line',{x:0,y:1}]);
  assert.equal(result.ok,true);assert.equal(hero.order.mode,'move');assert.equal(hero.order.facingY,1);assert.equal(other.order,oldOrder);
});
test('foreign, allied and mixed ownership cannot be commanded',()=>{
  const other=game.heroFor(0),own=game.heroFor(1),old=own.order;
  for(const type of ['hold','retreat','idle','advance','expand','patrol','attackNearest','useHousePower'])assert.equal(command(1,type,[[own.id,other.id]]).ok,false,type);
  assert.equal(own.order,old);
  assert.equal(command(1,'upgradeTower',[game.buildings.find(value=>value.team===0).id]).ok,false);
  assert.equal(command(1,'retrieveStandard',[other.id]).ok,false);
});
test('coordinates, enums and unexposed mutation methods are rejected',()=>{
  const ids=[game.heroFor(1).id];
  for(const coordinate of [NaN,Infinity,-1,game.W])assert.equal(command(1,'command',[ids,coordinate,4]).ok,false);
  assert.equal(command(1,'command',[ids,4,4,'teleport']).ok,false);
  assert.equal(command(1,'command',[ids,4,4,'move','bad']).ok,false);
  assert.equal(command(1,'damage',[ids[0],999999]).ok,false);
  assert.equal(command(1,'addUnit',[1,'hero',4,4]).ok,false);
  assert.equal(command(1,'build',['__proto__',4,4]).ok,false);
  assert.equal(command(1,'recruit',['constructor']).ok,false);
});
test('server forces the session house despite client team arguments',()=>{
  const before=game.teams.map(value=>value.gold);
  const response=command(1,'upgrade',['weapons',0]);assert.equal(response.ok,true);
  assert.equal(game.teams[0].gold,before[0]);assert.ok(game.teams[1].gold<before[1]);assert.equal(game.teams[1].upgrades.weapons,1);
});
test('in-order duplicate commands never spend twice or replace a newer order',()=>{
  const next=(sequence.get(1)||0)+1,envelope={v:1,seq:next,type:'recruit',args:['infantry',1]};
  const first=authority.command(1,envelope);assert.equal(first.ok,true);const gold=game.teams[1].gold,count=game.teams[1].count;
  const second=authority.command(1,envelope);assert.equal(second.duplicate,true);assert.equal(game.teams[1].gold,gold);assert.equal(game.teams[1].count,count);
  sequence.set(1,next);command(1,'hold',[[game.heroFor(1).id]]);
  authority.command(1,{...envelope,type:'command',args:[[game.heroFor(1).id],4,4]});assert.equal(game.heroFor(1).order.mode,'hold');
  const wrong=authority.command(1,{v:1,seq:next+3,type:'hold',args:[[game.heroFor(1).id]]});assert.equal(wrong.code,'sequence');assert.equal(wrong.expectedSeq,next+2);
});
test('failed paid actions consume sequence but do not alter resources or supply',()=>{
  game.teams[1].gold=0;const count=game.teams[1].count,response=command(1,'recruit',['cavalry']);assert.equal(response.ok,false);assert.equal(response.expectedSeq,response.seq+1);assert.equal(game.teams[1].count,count);assert.equal(game.teams[1].gold,0);
  const retry=authority.command(1,{v:1,seq:response.seq,type:'recruit',args:['cavalry']});assert.equal(retry.duplicate,true);
  assert.equal(command(1,'upgradeTownHall').ok,false);
});
test('rally, hero standard, formation and alliance actions share validation',()=>{
  const hero=game.heroFor(1),home=game.teams[1].home,building=game.buildings.find(value=>value.team===1);
  assert.equal(command(1,'setRally',[hero.x,hero.y,0,[building.id]]).ok,true);assert.deepEqual(building.rally,{x:hero.x,y:hero.y});
  assert.equal(command(1,'clearRally',[0,[building.id]]).ok,true);assert.equal(building.rally,null);
  assert.equal(command(1,'placeFormation',[[hero.id],{x:hero.x,y:hero.y,preset:'line',ranks:1,angle:0}]).ok,true);
  assert.equal(command(1,'advance',[[hero.id],'line',{ranks:1,lockFacing:true}]).ok,true);
  assert.equal(command(1,'setFacingLock',[[hero.id],false]).ok,true);assert.equal(hero.order.lockFacing,false);
  assert.equal(command(1,'plantStandard',[hero.id,home.x,home.y]).ok,false,'a keep blocks planting');
  assert.equal(command(1,'plantStandard',[hero.id,hero.x,hero.y]).ok,true);
  assert.equal(command(1,'cancelStandard',[hero.id]).ok,true);
  assert.equal(command(1,'callTeamOrder',['defend',hero.x,hero.y]).ok,false,'solo mode has no team commands');
});
test('all existing modes continue after original team zero falls',()=>{
  for(const mode of Object.keys(GAME_MODES)){
    const match=createAuthority({...config,mode},{humanTeams:[0,1]});match.game.eliminate(0);assert.equal(match.game.winner,null,mode);
    match.game.eliminate(2);match.game.eliminate(3);assert.equal(match.game.winner,1,mode);
  }
  const offline=new Game(config);offline.eliminate(0);assert.notEqual(offline.winner,null,'single-player still reports defeat');
});
test('four human seats and twelve AI houses preserve sixteen-house capacity',()=>{
  const match=createAuthority({...config,enemies:15,scale:'continent'},{humanTeams:Array.from({length:MAX_HUMANS},(_,i)=>i)});
  assert.equal(match.game.teams.length,16);assert.equal(new Set(match.game.units.map(value=>value.id)).size,match.game.units.length);
  let calls=0;match.game.ai=()=>calls++;for(const team of match.game.teams)team.aiClock=-1;match.step();assert.equal(calls,12);
  assert.ok(match.game.teams.every(value=>value.cap===280));assert.equal(match.game.units.length,16*70);
  assert.throws(()=>createAuthority({...config,enemies:15},{humanTeams:[0,1,2,3,4]}),'a fifth human seat is unsupported');
});
test('campaign settings preserve mode army counts and participating houses',()=>{
  assert.equal(validateCampaignConfig({...config,mode:'defend-king',enemies:15}).enemies,3);
  assert.equal(validateCampaignConfig({...config,mode:'team-conquest',enemies:4}).enemies,5);
  const match=createAuthority({...config,houses:[15,7,6,2]},{humanTeams:[0,1]});assert.deepEqual(match.game.teams.map(value=>value.house),[15,7,6,2]);
  assert.throws(()=>createAuthority({...config,houses:[0,0]}));assert.throws(()=>createAuthority(config,{humanTeams:[0,4]}));assert.throws(()=>createAuthority({...config,mode:'unsupported'}));
});

const fogAuthority=createAuthority({...config,fogOfWar:true},{humanTeams:[0,1]});const fog=fogAuthority.game;
test('fog snapshots omit hidden entities, economy, private orders and notifications',()=>{
  const own=fog.heroFor(1),hidden=fog.heroFor(2);own.debugSecret='never replicate';own.target=hidden;hidden.debugSecret='enemy secret';fog.teams[2].secret='economy secret';fog.event('secret enemy activity',2);
  fog.effects.push({type:'explosion',x:hidden.x,y:hidden.y,team:2,life:1});
  const snapshot=fogAuthority.snapshot(1,{initial:true});
  assert.ok(!snapshot.units.some(value=>value.id===hidden.id));assert.ok(!snapshot.buildings.some(value=>value.team===2));assert.ok(!snapshot.standards.some(value=>value.team===2));
  assert.equal(snapshot.units.find(value=>value.id===own.id).targetId,undefined);assert.equal(snapshot.units.find(value=>value.id===own.id).debugSecret,undefined);
  for(const field of ['gold','income','count','upgrades','home','rally','kills'])assert.equal(snapshot.teams[2][field],undefined,field);
  assert.equal(snapshot.teams[2].intelKnown,false);assert.equal(snapshot.objectiveScores[2],fog.objectiveScores[2]);assert.equal(snapshot.controlScores[2],fog.controlScores[2]);assert.ok(!JSON.stringify(snapshot).includes('secret'));assert.equal(snapshot.effects.length,0);
  const owners=decodeRuns(snapshot.territory.owners,fog.W*fog.H);assert.equal(owners[Math.floor(hidden.y)*fog.W+Math.floor(hidden.x)],-1);
});
test('visible enemy artwork has combat state without private destinations',()=>{
  const own=fog.heroFor(1),enemy=fog.heroFor(2);Object.assign(enemy,{x:own.x+1,y:own.y});enemy.order={mode:'move',x:77,y:66,groupX:77,groupY:66,formation:'line'};enemy.standardAction={kind:'refit',phase:'travel',x:77,y:66,keepId:123,progress:0,duration:8};fog.vision.update(true);
  const snapshot=fogAuthority.snapshot(1),entity=snapshot.units.find(value=>value.id===enemy.id);assert.ok(entity);assert.equal(entity.order.mode,'move');assert.equal(entity.order.x,undefined);assert.equal(entity.standardAction,undefined,'an unseen travel job is private');
  enemy.standardAction.phase='handling';const handling=fogAuthority.snapshot(1).units.find(value=>value.id===enemy.id).standardAction;assert.equal(handling.kind,'refit');assert.equal(handling.x,undefined);assert.equal(handling.keepId,undefined);
});
test('last-seen buildings retain observed state rather than hidden changes',()=>{
  const scout=fog.addUnit(1,'infantry',55.5,40.5),building=fog.buildings.find(value=>value.team===3);Object.assign(building,{x:56,y:41,hp:123});fog.vision.update(true);
  let snapshot=fogAuthority.snapshot(1);assert.equal(snapshot.buildings.find(value=>value.id===building.id).hp,123);
  Object.assign(scout,{x:100,y:85});building.hp=999;fog.vision.update(true);snapshot=fogAuthority.snapshot(1);
  const remembered=snapshot.buildings.find(value=>value.id===building.id);assert.equal(remembered.hp,123);assert.equal(remembered.remembered,true);
});
test('view hydration keeps stable identities and never generates hidden simulation state',()=>{
  const snapshot=fogAuthority.snapshot(1,{initial:true,sequence:10}),view=createRemoteGame(snapshot),hero=view.heroFor(),identity=hero;
  assert.equal(view.playerTeam,1);assert.equal(hero.team,1);assert.ok(view.units.length<fog.units.length);assert.equal(view.teams[2].gold,undefined);assert.equal(view.teams[2].home,undefined);
  const before=view.time;view.update(.05);assert.equal(view.time,before);
  fog.heroFor(1).x+=.5;const newer=fogAuthority.snapshot(1,{sequence:11});assert.equal(applySnapshot(view,newer),true);assert.equal(view.heroFor(),identity);assert.ok(Math.abs(hero.x-fog.heroFor(1).x)<=.000501);assert.equal(view.byId.get(hero.id),hero);
  assert.equal(applySnapshot(view,snapshot),false);assert.equal(view.sequence,11);
  assert.throws(()=>createRemoteGame({...snapshot,assetVersion:'old'}));assert.throws(()=>createRemoteGame({...snapshot,terrain:null}));
});
test('effects and projectiles have stable presentation IDs without changing gameplay IDs',()=>{
  const before=fog.nextId,hero=fog.heroFor(1);fog.effects.push({type:'hit',x:hero.x,y:hero.y,team:1,life:.2});fog.projectiles.push({sx:hero.x,sy:hero.y,x:hero.x,y:hero.y,tx:hero.x+1,ty:hero.y,t:0,duration:.34,type:'arrow',team:1});
  const first=snapshotWorld(fog,1),second=snapshotWorld(fog,1);assert.equal(first.effects.at(-1).id,second.effects.at(-1).id);assert.equal(first.projectiles.at(-1).id,second.projectiles.at(-1).id);assert.equal(fog.nextId,before);
});
test('compatibility is exact during the preview',()=>{
  assert.equal(compatible({v:PROTOCOL_VERSION,gameVersion:GAME_VERSION,assetVersion:ASSET_VERSION}),true);assert.equal(compatible({v:PROTOCOL_VERSION,gameVersion:'old',assetVersion:ASSET_VERSION}),false);
});
test('shared host projections preserve fog filtering and refresh after commands',()=>{
  const match=createAuthority({...config,fogOfWar:true},{humanTeams:[0,1]}),projection=match.projection(),snapshot=match.snapshot(1,{projection});
  assert.equal(match.projection(),projection);assert.ok(!snapshot.units.some(value=>value.team===2));
  const hero=match.game.heroFor(1),exactX=hero.x;assert.ok(Math.abs(snapshot.units.find(value=>value.id===hero.id).x-exactX)<=.000501);assert.equal(match.game.heroFor(1).x,exactX);
  assert.equal(match.command(1,{v:1,seq:1,type:'useHousePower',args:[]}).ok,true);assert.notEqual(match.projection(),projection);match.step();assert.notEqual(match.projection(),projection);
});
test('shared unit views and patches exactly match independently filtered guest snapshots',()=>{
  for(const fogOfWar of [false,true]){
    const seats=[0,1,2,3],match=createAuthority({...config,fogOfWar},{humanTeams:seats,privateHomePermutation:seats});
    const seen=seats.map(team=>match.snapshot(team)),previous=seen.slice();
    const hero=match.game.heroFor(1),target=match.game.heroFor(3);
    hero.target=target;
    // Two enemies can see the same hero but only one sees the distant target.
    const visible=match.game.isVisibleTo.bind(match.game);
    match.game.isVisibleTo=(team,entity)=>entity===hero?true:entity===target?team>=2:visible(team,entity);
    match.game.vision.update(true);
    for(let tick=0;tick<5;tick++){
      if(tick)match.step();
      const projection=match.projection();
      for(const team of [2,1,0,3]){
        const exact=match.snapshot(team),view=match.snapshot(team,{projection});
        assert.deepEqual(view,exact);
        if(fogOfWar&&!tick&&(team===0||team===2))assert.equal(view.units.find(u=>u.id===hero.id).targetId,team===2?target.id:undefined);
        for(const base of [previous[team],seen[team]]){
          const delta=createSnapshotDelta(base,view,base.sequence,view.sequence,projection.unitPatchCache);
          assert.deepEqual(delta,createSnapshotDelta(base,exact,base.sequence,exact.sequence));
          assert.deepEqual(applySnapshotDelta(base,delta),exact);
        }
        previous[team]=view;
      }
    }
  }
});
test('hidden objective cooldown and disappearance are unknown to AI and guests alike',()=>{
  const match=createAuthority({...config,fogOfWar:true,mode:'defend-king'},{humanTeams:[0,1]}),world=match.game;world.time=15;world.updateObjectives(0);world.vision.update(true);
  const hidden=world.objectives.find(value=>!world.isVisibleTo(1,value));assert.ok(hidden);
  const initial=world.knownObjectives(1).find(value=>value.id===hidden.id);assert.ok(initial);assert.equal(initial.cooldownUntil,0);
  hidden.cooldownUntil=world.time+100;hidden.controller=2;hidden.progress[2]=11;
  assert.equal(world.knownObjectives(1).find(value=>value.id===hidden.id).cooldownUntil,0);
  world.objectives=world.objectives.filter(value=>value.id!==hidden.id);
  assert.ok(world.knownObjectives(1).some(value=>value.id===hidden.id));assert.ok(match.snapshot(1).objectives.some(value=>value.id===hidden.id));
  world.time=hidden.expiresAt+.1;world.vision.update(true);assert.ok(!world.knownObjectives(1).some(value=>value.id===hidden.id));
});
test('snapshot polling never changes an allied AI objective memory',()=>{
  const match=createAuthority({...config,fogOfWar:true,mode:'team-conquest'},{humanTeams:[0]}),world=match.game,team=world.teams[0],tile=world.tiles.find(value=>value.x>20&&value.y>20&&world.isWalkable(value.x+.5,value.y+.5)&&!world.isVisibleTo(0,{x:value.x+.5,y:value.y+.5})),flag=world.objectives[0];
  Object.assign(flag,{x:tile.x+.5,y:tile.y+.5});const scout=world.addUnit(0,'cavalry',flag.x,flag.y);world.vision.update(true);const data=world.vision.dataFor(1),before=[...data.objectives];world.objectives=world.objectives.filter(value=>value.id!==flag.id);
  for(let i=0;i<10;i++)match.snapshot(0);assert.deepEqual([...data.objectives],before);scout.x=team.home.x;scout.y=team.home.y;world.time+=.01;world.vision.update(true);assert.ok(world.knownObjectives(1).some(value=>value.id===flag.id));
});
test('visible kings and support animations replicate without hidden poison sources',()=>{
  const match=createAuthority({...config,fogOfWar:true,mode:'defend-king'},{humanTeams:[0,1]}),world=match.game,own=world.heroFor(1),enemy=world.kingFor(2);Object.assign(enemy,{x:own.x+1,y:own.y});own.crannogPoison={until:99,dps:3,team:3,sourceId:123456789};own.supportVisual={at:world.time,targetId:123456789};world.vision.update(true);
  const snapshot=match.snapshot(1,{initial:true}),view=createRemoteGame(snapshot),unit=snapshot.units.find(value=>value.id===own.id);assert.equal(view.kingFor(2).id,enemy.id);assert.equal(unit.crannogPoison.sourceId,undefined);assert.equal(unit.crannogPoison.team,undefined);assert.equal(unit.supportVisual.targetId,undefined);assert.equal(unit.supportVisual.at,world.time);
});
test('formation footprints cannot discover unobserved enemy buildings',()=>{
  const match=createAuthority({...config,fogOfWar:true},{humanTeams:[0,1]}),world=match.game,troop=world.heroFor(1),tile=world.tiles.find(value=>value.x>20&&value.y>20&&world.isWalkable(value.x+.5,value.y+.5)&&!world.isVisibleTo(1,{x:value.x+.5,y:value.y+.5}));
  const options={x:tile.x+.5,y:tile.y+.5,preset:'line',ranks:1,angle:0},before=formationPreview(world,[troop],options,UNIT_DEFS);const building=world.addBuilding(2,'tower',options.x,options.y);world.vision.update(true);
  assert.equal(world.isVisibleTo(1,building),false);assert.deepEqual(formationPreview(world,[troop],options,UNIT_DEFS),before);
  world.addUnit(1,'cavalry',building.x+2,building.y);world.vision.update(true);assert.equal(formationPreview(world,[troop],options,UNIT_DEFS).blocked,1);
});
test('recovering the public terrain LCG does not recover private house starts',()=>{
  const settings={...config,fogOfWar:true,seed:44277},permutation=[2,3,0,1],match=createAuthority(settings,{humanTeams:[0,1],privateHomePermutation:permutation}),snapshot=match.snapshot(1,{initial:true});
  // Deliberately perform the actual recovery rather than assuming a removed
  // config.seed conceals the public terrain generator.
  const firstState=Math.round(snapshot.terrain.tiles[0].variation*2**32)>>>0,recoveredSeed=Math.imul(4276115653,(firstState-1013904223)>>>0)>>>0;assert.equal(recoveredSeed,44277);
  const predicted=new Game({...settings,seed:recoveredSeed,multiplayer:true,humanTeams:[0,1]});
  for(const team of [0,2,3]){assert.notDeepEqual(match.game.teams[team].home,predicted.teams[team].home);const actual=match.game.heroFor(team),guessed=predicted.heroFor(team);assert.ok(Math.hypot(actual.x-guessed.x,actual.y-guessed.y)>10);}
  assert.equal(snapshot.config.seed,undefined);assert.equal(snapshot.config.homePermutation,undefined);assert.equal(snapshot.config.privateHomePermutation,undefined);assert.equal(match.game.config.homePermutation,undefined);
  const alternate=createAuthority(settings,{humanTeams:[0,1],privateHomePermutation:[1,0,3,2]}).snapshot(1,{initial:true});assert.deepEqual(snapshot.terrain,alternate.terrain,'all original painted terrain metadata is public and unchanged');
  assert.notDeepEqual(snapshot.teams[1].home,alternate.teams[1].home);
});
test('private starts retain house identities, alliance pairs and validated permutations',()=>{
  const settings=validateCampaignConfig({...config,enemies:15,mode:'team-conquest'}),permutation=createPrivateHomePermutation(settings,()=>0),match=createAuthority(settings,{humanTeams:[0,1,2,3],privateHomePermutation:permutation});
  assert.equal(new Set(permutation).size,16);for(let team=0;team<16;team+=2)assert.equal(Math.floor(permutation[team]/2),Math.floor(permutation[team+1]/2));
  assert.deepEqual(match.game.teams.map(value=>value.house),Array.from({length:16},(_,index)=>index));assert.ok(match.game.teams.every(value=>value.cap===280));assert.equal(match.game.units.length,1120);
  assert.throws(()=>createAuthority({...config,mode:'team-conquest'},{privateHomePermutation:[0,2,1,3]}));assert.throws(()=>createAuthority(config,{privateHomePermutation:[0,0,1,2]}));
});
test('fixed private starts reproduce exact simulation regardless of guest reads',()=>{
  const settings={...config,enemies:15,mode:'team-conquest',fogOfWar:true,scale:'continent'},permutation=Array.from({length:16},(_,index)=>(index+8)%16),options={humanTeams:[0,1,2,3],privateHomePermutation:permutation},left=createAuthority(settings,options),right=createAuthority(settings,options);
  for(let tick=0;tick<60;tick++){
    for(const match of [left,right]){if(tick===0)for(const team of options.humanTeams){const hero=match.game.heroFor(team);match.command(team,{v:1,seq:1,type:'command',args:[[hero.id],match.game.W/2,match.game.H/2,'move','line']});}match.step();}
    if(tick%3===2){const projection=right.projection();for(const team of options.humanTeams)right.snapshot(team,{projection});}
  }
  const signature=world=>JSON.stringify({time:world.time,seed:world.seed,nextId:world.nextId,units:world.units,buildings:world.buildings,teams:world.teams,tiles:world.tiles,objectives:world.objectives,scores:world.objectiveScores,castles:world.castles,standards:world.standards,effects:world.effects,projectiles:world.projectiles,events:world.events},(key,value)=>key==='target'&&value&&typeof value==='object'?{id:value.id}:value instanceof Map?[...value]:value instanceof Set?[...value]:value);
  assert.equal(signature(left.game),signature(right.game));
});
console.log(`\n${cases} authoritative multiplayer checks passed. Four-human/sixteen-house testing is headless correctness, not an advertised hardware or internet-performance qualification.`);
