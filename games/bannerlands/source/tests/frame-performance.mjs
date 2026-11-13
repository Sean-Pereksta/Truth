import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8');
const start=source.indexOf('function frame(now){'),end=source.indexOf('\nasync function boot()',start);
assert.ok(start>=0&&end>start,'The production frame function must be available.');
const frameSource=source.slice(start,end),helperStart=source.indexOf('function setHudHTML(');
const helperSource=source.slice(helperStart,source.indexOf('\n',helperStart));
const countsStart=source.indexOf('const knownSoldiers='),countsSource=source.slice(countsStart,source.indexOf('\n',countsStart));
assert.ok(helperStart>=0,'The production HUD cache helper must be available.');
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};

function fixture({speed=1,tickCost=0}={}){
  const elements=new Map(),calls={ticks:[],draws:0,minimaps:0,hud:0,frames:0};
  const context={
    console,Math,Map,Set,WeakMap,performance:{now:()=>context.clock},clock:0,tickCost,
    lastNow:0,frameMs:16.7,fps:60,ui:{quality:'auto'},menuOpen:false,started:true,
    speed,accumulator:0,view:{x:0,y:0,w:1000,h:700,zoom:1},keys:new Set(),edgeMouse:null,
    lastBattle:0,lastSfx:0,lastEvent:0,lastHud:0,lastMini:0,toastUntil:0,
    game:{paused:false,winner:null,time:0,stats:{battles:0},units:[],events:[],teams:[{alive:true}],
      update(dt){calls.ticks.push(dt);this.time+=dt;context.clock+=context.tickCost;},allied:()=>true},
    renderer:{draw:()=>calls.draws++,drawMinimap:()=>calls.minimaps++},
    mousePan:()=>({x:0,y:0}),boundCamera:()=>{},screenToWorld:()=>({x:0,y:0}),
    tone:()=>{},toast:()=>{},checkResult:()=>{},updateHud:()=>calls.hud++,
    requestAnimationFrame:()=>calls.frames++,
    $:id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:id==='commandPanel',dataset:{pane:'map'},classList:{remove(){}}});return elements.get(id);}
  };
  vm.createContext(context);vm.runInContext(frameSource,context,{filename:'app.js:frame'});
  return {context,calls,frame(now){context.clock=now;context.frame(now);}};
}

test('Ordinary 60 FPS frames maintain fixed 30 Hz simulation at 1x and 2x speed',()=>{
  for(const speed of [1,2]){
    const f=fixture({speed});for(let i=1;i<=360;i++)f.frame(i*1000/60);
    assert.ok(f.calls.ticks.every(dt=>dt===1/30),'Every simulation step retains the fixed duration.');
    assert.ok(Math.abs(f.context.game.time-6*speed)<=1/30+1e-9,'No simulation time is lost under ordinary load.');
    assert.equal(f.calls.draws,360);assert.equal(f.calls.frames,360);
  }
});

test('An expensive simulation tick yields to drawing instead of six-tick catch-up',()=>{
  const f=fixture({speed:2,tickCost:12});f.frame(200);
  assert.equal(f.calls.ticks.length,1);assert.equal(f.calls.draws,1);assert.equal(f.calls.frames,1);
  assert.ok(f.context.accumulator<=1/30+1e-9,'A stall cannot retain an unbounded catch-up debt.');
});

test('Repeated overload keeps input frames moving and clears debt after recovery',()=>{
  const f=fixture({speed:2,tickCost:20});
  for(let i=1;i<=20;i++){
    const before=f.calls.ticks.length;f.frame(i*200);assert.equal(f.calls.ticks.length-before,1);
    assert.ok(f.context.accumulator<=1/30+1e-9);
  }
  assert.equal(f.calls.draws,20);f.context.tickCost=0;
  for(let i=1;i<=120;i++){
    const before=f.calls.ticks.length;f.frame(4000+i*1000/60);
    assert.ok(f.calls.ticks.length-before<=2,'Recovery has no large deferred catch-up burst.');
  }
  assert.ok(f.context.accumulator<1/30+1e-9);assert.equal(f.calls.draws,140);
});

test('Paused, menu, unstarted and finished games never advance the simulation',()=>{
  for(const state of ['paused','menu','unstarted','finished']){
    const f=fixture({speed:2});
    if(state==='paused')f.context.game.paused=true;
    else if(state==='menu')f.context.menuOpen=true;
    else if(state==='unstarted')f.context.started=false;
    else f.context.game.winner=1;
    for(let i=1;i<=20;i++)f.frame(i*100);
    assert.equal(f.calls.ticks.length,0,state);assert.equal(f.context.game.time,0,state);assert.equal(f.calls.draws,state==='menu'?1:20,state);
  }
});

test('The covered menu background redraws only for camera changes and resumes immediately',()=>{
  const f=fixture();f.context.menuOpen=true;
  for(let i=1;i<=60;i++)f.frame(i*1000/60);
  assert.equal(f.calls.draws,1);assert.equal(f.calls.minimaps,0);assert.equal(f.calls.frames,60);
  f.context.view.w=1200;f.frame(1020);assert.equal(f.calls.draws,2);
  f.context.view.zoom=.6;f.frame(1040);assert.equal(f.calls.draws,3);
  f.context.menuOpen=false;f.frame(1060);f.frame(1080);assert.equal(f.calls.draws,5);assert.equal(f.calls.minimaps,0);
  f.context.$('commandPanel').hidden=false;f.frame(1100);assert.ok(f.calls.minimaps>0);
});

test('The minimap only renders while its navigation drawer is visible',()=>{
  const f=fixture();for(let i=1;i<=60;i++)f.frame(i*1000/60);assert.equal(f.calls.minimaps,0);
  const panel=f.context.$('commandPanel');panel.hidden=false;panel.dataset.pane='build';f.frame(1200);assert.equal(f.calls.minimaps,0);
  panel.dataset.pane='map';f.frame(1400);assert.equal(f.calls.minimaps,1);
  panel.hidden=true;f.frame(1600);assert.equal(f.calls.minimaps,1);
});

function cachedElement(){
  let markup='',writes=0;const element={};
  Object.defineProperty(element,'innerHTML',{get:()=>markup,set:value=>{writes++;markup=value;}});
  return {element,get writes(){return writes;},get markup(){return markup;}};
}
test('Unchanged HUD markup avoids DOM writes while changes and new elements update',()=>{
  const context={hudMarkup:new WeakMap()};vm.createContext(context);vm.runInContext(helperSource,context,{filename:'app.js:setHudHTML'});
  const a=cachedElement(),b=cachedElement();
  for(let i=0;i<1000;i++)context.setHudHTML(a.element,'<b>House Stark</b>');
  assert.equal(a.writes,1);context.setHudHTML(a.element,'<b>House Tyrell</b>');assert.equal(a.writes,2);
  assert.equal(a.markup,'<b>House Tyrell</b>');context.setHudHTML(b.element,'<b>House Tyrell</b>');assert.equal(b.writes,1);
  context.setHudHTML(a.element,'');context.setHudHTML(a.element,'');assert.equal(a.writes,3);assert.equal(a.markup,'');
});

test('The actual cached roster expression renders all houses and refreshes changed counts',()=>{
  const marker="setHudHTML($('houseRoster'),game.teams.map(t=>{",rosterStart=source.indexOf(marker),closing="}).join(''));",rosterEnd=source.indexOf(closing,rosterStart)+closing.length;
  assert.ok(rosterStart>=0&&rosterEnd>rosterStart,'The cached roster must retain its complete map/join expression.');
  const roster=cachedElement(),teams=Array.from({length:16},(_,id)=>({id,house:id,name:'House '+id,count:70,tiles:49,alive:true,color:'#aabbcc'}));
  const context={hudMarkup:new WeakMap(),game:{teams,units:[],mode:{teams:false}},HOUSES:teams,
    $:id=>{assert.equal(id,'houseRoster');return roster.element;},houseAdvantages:()=>[],houseWeaknesses:()=>[],powerData:()=>({name:'Test power'}),short:name=>name.replace('House ',''),percent:()=>1,escapeHTML:value=>String(value)};
  vm.createContext(context);vm.runInContext(helperSource,context);const render=()=>vm.runInContext('{'+countsSource+source.slice(rosterStart,rosterEnd)+'}',context,{filename:'app.js:houseRoster'});
  render();render();assert.equal(roster.writes,1);assert.equal((roster.markup.match(/class="roster-row/g)||[]).length,16);
  teams[5].count=99;render();assert.equal(roster.writes,2);assert.ok(roster.markup.includes('class="army-total">99</span>'));
});

test('Fog rosters cannot reveal hidden army sizes, territory or production plans',()=>{
  const start=source.indexOf("setHudHTML($('houseRoster'),game.teams.map(t=>{"),end=source.indexOf("}).join(''));",start)+"}).join(''));".length,roster=cachedElement();
  const teams=[{id:0,house:0,name:'House Stark',count:70,tiles:49,alive:true,color:'#aabbcc'},{id:1,house:1,name:'House Lannister',count:991,tiles:5000,alive:true,color:'#ffeeee',aiPlan:{label:'Secret invasion',phase:'advance',production:{label:'Hidden factory'}}}];
  const context={hudMarkup:new WeakMap(),game:{teams,config:{fogOfWar:true},mode:{teams:false},allied:(a,b)=>a===b,knownUnits:()=>[]},HOUSES:teams,$:()=>roster.element,houseAdvantages:()=>[],houseWeaknesses:()=>[],powerData:()=>({name:'Power'}),short:name=>name.replace('House ',''),percent:()=>99,escapeHTML:value=>String(value)};
  vm.createContext(context);vm.runInContext(helperSource,context);let scans=0;const render=()=>{scans=0;const original=context.game.knownUnits;context.game.knownUnits=()=>{scans++;return original();};try{vm.runInContext('{'+countsSource+source.slice(start,end)+'}',context);assert.equal(scans,1,'The full fog roster reuses exactly one army scan.');}finally{context.game.knownUnits=original;}};
  render();const before=roster.markup;assert.ok(before.includes('Unknown'));assert.ok(!before.includes('991')&&!before.includes('Secret invasion')&&!before.includes('Hidden factory'));
  teams[1].count=500;teams[1].tiles=100;teams[1].alive=false;teams[1].aiPlan.label='Another secret';render();assert.equal(roster.markup,before);
  context.game.knownUnits=()=>[{team:1,hp:100},{team:1,hp:100}];render();assert.ok(roster.markup.includes('Spotted nearby'));assert.ok(roster.markup.includes('army-total">2</span>'));
});

console.log(`${cases} frame and HUD performance checks passed.`);
