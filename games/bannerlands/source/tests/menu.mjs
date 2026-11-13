import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS,HOUSE_CONTENT} from '../../core.js';
import {LAND_MAPS} from '../../lands.js';

const source=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const extract=name=>{
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,`${name} must exist in the production app.`);
  const lineEnd=source.indexOf('\n',start),line=source.slice(start,lineEnd);
  if(line.trimEnd().endsWith('}'))return line;
  const end=source.indexOf('\n}',start);assert.ok(end>start,`${name} must have a complete body.`);
  return source.slice(start,end+2);
};
class Element{
  constructor(id=''){this.id=id;this.attributes=new Map();this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.children=[];this.tabIndex=0;this.focusCount=0;this.listeners=new Map();this.classes=new Set();this.classList={toggle:(name,force)=>{const active=force===undefined?!this.classes.has(name):!!force;if(active)this.classes.add(name);else this.classes.delete(name);return active;},contains:name=>this.classes.has(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  focus(){this.focusCount++;}
  scrollIntoView(){}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
  dispatch(type,event={}){for(const listener of this.listeners.get(type)||[])listener(event);}
  querySelectorAll(){return [];}
}
function fixture(){
  const elements=new Map(),buttons=[];
  const element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const context={console,Math,Map,Set,String,Array,HOUSES,UNIT_DEFS,BUILD_DEFS,HOUSE_CONTENT,
    chosenHouse:0,started:false,menuOpen:true,wasPaused:false,edgeMouse:null,battleHud:{open(){},close(){}},
    ui:{selected:new Set(),selectedBuildings:new Set(),quality:'auto'},groups:new Map(),keys:new Set(),
    allSelected:false,allBuildingsSelected:false,lastResult:null,lastEvent:0,lastBattle:0,accumulator:0,speed:1,
    $:element,document:{querySelectorAll:selector=>selector==='.house-choice'?buttons:[],querySelector:()=>element('crestUse'),documentElement:{style:{setProperty(){}}}},
    canvas:element('battleCanvas'),powerData:h=>h.power,houseAdvantages:h=>h.advantages||[],houseWeaknesses:h=>h.weaknesses||[],
    icon:name=>`<svg data-icon="${name}"></svg>`,short:name=>name.replace('House ',''),escapeHTML:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    labelMenuHotkeys(){},paintHousePreview(){},clearBuildingSelection(){context.ui.selectedBuildings.clear();},cancelBuild(){},setHudHTML:(element,value)=>{element.innerHTML=value;},num:Math.round,
    buildActionLists(){},paintBuildingIcons(){},showTab(){},home(){},updatePause(){},updateHud(){},initAudio(){},tone(){},toast(){},
    houseData:team=>HOUSES[context.game.teams[team].house],game:{paused:false,winner:null,teams:[{alive:true}],time:0}
  };
  vm.createContext(context);
  const emblemLine=source.split('\n').find(line=>line.startsWith('const houseEmblem='));assert.ok(emblemLine,'House choices must use the painted house emblem helper.');
  vm.runInContext(emblemLine,context);
  const buttonLine=source.split('\n').find(line=>line.startsWith("$('houseChoices').innerHTML="));assert.ok(buttonLine,'The production house choices must be rendered.');
  vm.runInContext(buttonLine,context);
  for(const match of element('houseChoices').innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
    const button=new Element();for(const attribute of match[1].matchAll(/([\w-]+)="([^"]*)"/g)){button.setAttribute(attribute[1],attribute[2]);if(attribute[1]==='data-house')button.dataset.house=attribute[2];if(attribute[1]==='class')for(const name of attribute[2].split(' '))button.classes.add(name);}
    button.innerHTML=match[2];buttons.push(button);
  }
  vm.runInContext(source.split('\n').find(line=>line.startsWith('const modeDescriptions=')),context);
  for(const name of ['chooseHouse','chooseMenuTab','renderHouseGuide','openMenu','resume','campaignObjectiveText','updateModeDescription','updateKingHud','updateObjectivesHud','findHero','start'])vm.runInContext(extract(name),context,{filename:'app.js:'+name});
  const listenersStart=source.indexOf("\nfor(const [name,id]of [['house','menuHouseTab'],['campaign','menuCampaignTab']]){"),listenersEnd=source.indexOf("\nchooseMenuTab('house');",listenersStart);
  assert.ok(listenersStart>=0&&listenersEnd>listenersStart,'The production menu tab listeners must be wired.');
  vm.runInContext(source.slice(listenersStart,listenersEnd),context,{filename:'app.js:menu-tab-listeners'});
  return {context,element,buttons,elements};
}

test('The redesigned menu preserves unique IDs and all referenced static controls',()=>{
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'HTML IDs must be unique.');
  const present=new Set(ids);
  for(const match of source.matchAll(/\$\(['"]([^'"]+)['"]\)/g))assert.ok(present.has(match[1]),`Missing app control: ${match[1]}`);
  for(const id of ['modeSelect','enemySelect','difficultySelect','scaleSelect','landscapeSelect','qualitySelect','fogSelect'])assert.match(html,new RegExp('<select\\b[^>]*\\bid="'+id+'"'));
  for(const id of ['menuHouseTab','menuCampaignTab','menuHousePanel','menuCampaignPanel','chosenHouseName','chosenHouseEmblem','startButton','resumeButton'])assert.ok(present.has(id),id);
});

test('Fog of War is an explicit campaign setting with visible instructions and distinct On and Off choices',()=>{
  const campaign=html.match(/<section id="menuCampaignPanel"[\s\S]*?<\/section>/)?.[0];assert.ok(campaign);
  const label=campaign.match(/<label for="fogSelect"[^>]*>([\s\S]*?)<\/label>/)?.[1];assert.ok(label,'Fog must be labeled in the campaign setup, outside optional details.');
  assert.match(label,/<strong>Fog of War<\/strong>/);
  assert.match(label,/<option value="off" selected>Off · full map<\/option>/);
  assert.match(label,/<option value="on">On · scouting<\/option>/);
  assert.match(label,/aria-describedby="fogHelp"/);
  assert.match(label,/<small id="fogHelp">[^<]*enemy armies[^<]*last-seen buildings[^<]*rivals use the same rules\./);
  assert.doesNotMatch(label,/\bhidden\b/);
});

test('Defend the King fixes four armies and restores the prior rival count when changing modes',()=>{
  const f=fixture();f.element('enemySelect').value='11';f.element('modeSelect').value='defend-king';
  f.context.updateModeDescription();
  assert.equal(f.element('enemySelect').value,'3');assert.equal(f.element('enemySelect').disabled,true);assert.match(f.element('enemySelect').innerHTML,/4 armies · 1 king each/);assert.match(f.element('modeDescription').textContent,/Kings have one life/);
  f.context.updateModeDescription();f.element('modeSelect').value='crown-control';f.context.updateModeDescription();
  assert.equal(f.element('enemySelect').value,'11');assert.equal(f.element('enemySelect').disabled,false);assert.match(f.element('modeDescription').textContent,/120 cumulative uncontested seconds/);
  f.element('modeSelect').value='blitz-flags';f.context.updateModeDescription();assert.match(f.element('modeDescription').textContent,/10 seconds/);assert.match(f.element('modeDescription').textContent,/12 seconds/);
  for(const mode of ['defend-king','crown-control','blitz-flags'])assert.match(html,new RegExp('<option value="'+mode+'">'));
  assert.ok(html.indexOf('id="modeDescription"')<html.indexOf('<details class="campaign-note-details"'),'Mode rules are visible before optional difficulty details.');
});

test('King HUD shows friendly vitality and reveals enemy vitality only inside current sight',()=>{
  const f=fixture(),teams=[{id:0,alliance:0,name:'House Stark',color:'#aaa'},{id:1,alliance:1,name:'House Bolton',color:'#bbb'}],kings=[{id:12,hp:250,maxHp:500},{id:13,hp:111,maxHp:999}];let visible=false;
  f.context.game={mode:{kingSurvival:true},teams,config:{fogOfWar:true},kingFor:team=>kings[team],allied:(a,b)=>a===b,isVisibleTo:()=>visible};
  f.context.updateKingHud();assert.equal(f.element('kingSection').hidden,false);assert.match(f.element('heroButton').innerHTML,/Find king/);assert.match(f.element('kingList').innerHTML,/250 \/ 500 HP/);assert.match(f.element('kingList').innerHTML,/Unseen/);assert.doesNotMatch(f.element('kingList').innerHTML,/111|999/);
  visible=true;f.context.updateKingHud();assert.match(f.element('kingList').innerHTML,/111 \/ 999 HP/);
  kings[0]=null;f.context.updateKingHud();assert.match(f.element('kingList').innerHTML,/Fallen · army defeated/);
  f.context.game.mode={};f.context.updateKingHud();assert.equal(f.element('kingSection').hidden,true);assert.match(f.element('heroButton').innerHTML,/Commander/);
});

test('Find king selects the living king and never promises a respawn after king death',()=>{
  const f=fixture();let king={id:91,x:22,y:30,hp:500},focused,message;
  f.context.game={mode:{kingSurvival:true},kingFor:()=>king};f.context.focusPoint=(...point)=>{focused=point;};f.context.toast=text=>{message=text;};
  f.context.findHero();assert.deepEqual([...f.context.ui.selected],[91]);assert.deepEqual(focused,[22,30,1.7]);
  king=null;f.context.findHero();assert.match(message,/Kings have one life/);assert.doesNotMatch(message,/return/);
});

test('Flag-wave HUD remains available between waves and control scores use seconds',()=>{
  const f=fixture(),teams=[{id:0,alliance:0,name:'House Stark',color:'#aaa'},{id:1,alliance:1,name:'House Bolton',color:'#bbb'}];
  f.context.game={mode:{flagWaves:true,flagRequired:12,flagReinforcements:12},teams,objectives:[],objectiveScores:[2,1],time:20,nextFlagWaveAt:60};
  f.context.updateObjectivesHud();assert.equal(f.element('objectiveSection').hidden,false);assert.match(f.element('flagWaveStatus').textContent,/40s · 0 active/);assert.match(f.element('objectiveRule').textContent,/12s/);assert.match(f.element('objectiveRule').textContent,/12 troops beside your king/);assert.equal(f.element('objectiveList').innerHTML,'');
  f.context.game.mode={controlGoal:120};f.context.game.controlScores=[26.75,81.25];f.context.updateObjectivesHud();assert.equal(f.element('flagWaveStatus').hidden,true);assert.match(f.element('objectiveScore').innerHTML,/26.8 \/ 120s/);assert.match(f.element('objectiveScore').innerHTML,/81.3 \/ 120s/);
  f.context.game.mode={objectiveGoal:3,flagRequired:10,flagCooldown:12,flagReinforcements:8};f.context.updateObjectivesHud();assert.match(f.element('objectiveGoal').textContent,/FIRST TO 3/);assert.match(f.element('objectiveRule').textContent,/10s/);assert.match(f.element('objectiveRule').textContent,/12s/);
});

test('Objective cards use each mode’s timer and remove captured flags from the list',()=>{
  const f=fixture(),list=f.element('objectiveList'),card=new Element(),parts=new Map();card.dataset.objective='41';card.querySelector=selector=>{if(!parts.has(selector))parts.set(selector,new Element());return parts.get(selector);};list.children=[card];list.querySelectorAll=()=>list.children;
  f.context.game={mode:{flagWaves:true,flagRequired:12,flagReinforcements:12},teams:[{id:0,alliance:0,name:'House Stark',color:'#aaa'}],objectives:[{id:41,name:'Central Standard',required:12,progress:[3],controller:0}],time:20,nextFlagWaveAt:60};
  f.context.updateObjectivesHud();assert.equal(parts.get('.objective-heading>span').textContent,'3.0 / 12s');assert.equal(parts.get('.objective-progress i').style.width,'25%');
  f.context.game.objectives=[];f.context.updateObjectivesHud();assert.equal(list.innerHTML,'');assert.match(f.element('flagWaveStatus').textContent,/0 active/);
});

test('All sixteen painted house choices update the selected profile and accessible state',()=>{
  const f=fixture();assert.equal(f.buttons.length,16);assert.equal(new Set(f.buttons.map(b=>b.dataset.house)).size,16);
  assert.equal(new Set(f.buttons.map(b=>b.innerHTML.match(/background-position:([^\"]+)/)?.[1])).size,16,'Each house uses its own cell in the shared painted atlas.');
  for(let i=0;i<HOUSES.length;i++){
    f.context.chooseHouse(i);assert.equal(f.context.chosenHouse,i);assert.equal(f.element('chosenHouseName').textContent,HOUSES[i].name);
    assert.equal(f.element('menuSelectedHouse').textContent,HOUSES[i].name);
    assert.equal(f.element('chosenHouseEmblem').style.backgroundPosition,`${i%4*100/3}% ${Math.floor(i/4)*100/3}%`);
    for(let j=0;j<f.buttons.length;j++){assert.equal(f.buttons[j].classList.contains('active'),j===i);assert.equal(f.buttons[j].getAttribute('aria-pressed'),String(j===i));}
    assert.ok(f.element('chosenPlaystyle').textContent);assert.ok(f.element('chosenTrait').textContent.includes(HOUSES[i].motto));
  }
});

test('Compact house profiles retain complete bonuses, weaknesses and powers in the house guide',()=>{
  const f=fixture();f.context.renderHouseGuide();const guide=f.element('houseGuideGrid').innerHTML;
  assert.equal((guide.match(/data-house-guide=/g)||[]).length,HOUSES.length);
  for(const house of HOUSES){assert.ok(guide.includes(f.context.escapeHTML(house.name)));assert.ok(guide.includes(f.context.escapeHTML(house.power.name)));for(const detail of [...house.advantages||[],...house.weaknesses||[]])assert.ok(guide.includes(f.context.escapeHTML(detail)));}
});

test('Small-screen menu tabs preserve choices and expose one keyboard tab stop',()=>{
  const f=fixture();f.element('modeSelect').value='team-bannerfall';f.element('landscapeSelect').value='highlands';f.element('fogSelect').value='on';f.context.chosenHouse=12;
  for(const tab of ['campaign','house','campaign']){
    f.context.chooseMenuTab(tab);assert.equal(f.element('menuOverlay').dataset.menuTab,tab);
    for(const [name,id]of [['house','menuHouseTab'],['campaign','menuCampaignTab']]){assert.equal(f.element(id).getAttribute('aria-selected'),String(name===tab));assert.equal(f.element(id).tabIndex,name===tab?0:-1);}
  }
  f.context.chooseMenuTab('house',true);assert.equal(f.element('menuHouseTab').focusCount,1);
  assert.equal(f.context.chosenHouse,12);assert.equal(f.element('modeSelect').value,'team-bannerfall');assert.equal(f.element('landscapeSelect').value,'highlands');assert.equal(f.element('fogSelect').value,'on');
});

test('Menu tab clicks and arrow, Home and End keys select and focus the expected panel',()=>{
  const f=fixture();
  for(const [name,id]of [['house','menuHouseTab'],['campaign','menuCampaignTab']]){
    const button=f.element(id);button.dispatch('click');assert.equal(f.element('menuOverlay').dataset.menuTab,name);
    for(const key of ['ArrowLeft','ArrowRight','Home','End']){
      let prevented=false;const expected=key==='Home'?'house':key==='End'?'campaign':name==='house'?'campaign':'house',target=f.element(expected==='house'?'menuHouseTab':'menuCampaignTab'),priorFocus=target.focusCount;
      button.dispatch('keydown',{key,preventDefault(){prevented=true;}});
      assert.equal(prevented,true);assert.equal(f.element('menuOverlay').dataset.menuTab,expected);assert.equal(target.focusCount,priorFocus+1);
    }
    let prevented=false;button.dispatch('keydown',{key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,false,'Native activation keys must retain normal button behavior.');
  }
});

test('Revisiting a landscape reuses its raster preview without constructing another game',()=>{
  const f=fixture(),preview=f.element('landscapePreview');let constructions=0,rasterId=0,lastRestored=null;
  preview.width=20;preview.height=10;
  preview.getContext=()=>({fillRect(){},beginPath(){},arc(){},fill(){},stroke(){},getImageData:()=>({id:++rasterId,width:preview.width,height:preview.height}),putImageData:value=>{lastRestored=value;}});
  f.context.LAND_MAPS=LAND_MAPS;f.context.landscapePreviewCache=new Map();
  f.context.Game=class{constructor(){constructions++;this.W=2;this.H=2;this.tiles=[{x:0,y:0,terrain:'grass'}];this.teams=[{home:{x:.5,y:.5}}];}};
  vm.runInContext(extract('updateLandscapeDescription'),f.context);
  const draw=id=>{f.element('landscapeSelect').value=id;f.context.updateLandscapeDescription();};
  draw('crownlands');assert.equal(constructions,1);const first=f.context.landscapePreviewCache.values().next().value;
  draw('riverlands');assert.equal(constructions,2);
  draw('crownlands');assert.equal(constructions,2);assert.equal(lastRestored,first);
  assert.equal(f.element('landscapePreviewName').textContent,LAND_MAPS[0].label);assert.equal(f.element('landscapeDescription').textContent,LAND_MAPS[0].description);
  preview.width=24;draw('crownlands');assert.equal(constructions,3,'Resized previews must not reuse an incompatible raster.');
  assert.ok([...f.context.landscapePreviewCache.values()].every(value=>!('tiles' in value)),'The cache retains only raster images.');
});

test('Starting a campaign passes every selected setting to the actual simulation',()=>{
  const f=fixture();let captured;
  f.context.Game=class extends Game{constructor(config){captured={...config};super(config);}};
  f.context.chosenHouse=14;
  const values={modeSelect:'team-dominion',enemySelect:'7',difficultySelect:'veteran',scaleSelect:'standard',landscapeSelect:'highlands',qualitySelect:'high',fogSelect:'on'};
  for(const [id,value]of Object.entries(values))f.element(id).value=value;
  f.context.start();
  assert.equal(captured.house,14);assert.equal(captured.mode,values.modeSelect);assert.equal(captured.enemies,7);assert.equal(captured.difficulty,values.difficultySelect);assert.equal(captured.scale,values.scaleSelect);assert.equal(captured.landscape,values.landscapeSelect);
  assert.equal(captured.fogOfWar,true);assert.equal(f.context.game.config.fogOfWar,true);
  assert.equal(f.context.ui.quality,'high');assert.equal(f.context.started,true);assert.equal(f.context.menuOpen,false);assert.equal(f.element('menuOverlay').hidden,true);assert.equal(f.context.game.teams[0].house,14);
  for(const [id,value]of Object.entries(values))assert.equal(f.element(id).value,value,`Starting must not reset ${id}.`);
});

test('Each new mode starts the real simulation with its announced rules',()=>{
  for(const mode of ['defend-king','crown-control','blitz-flags']){
    const f=fixture();for(const [id,value]of Object.entries({modeSelect:mode,enemySelect:'7',difficultySelect:'standard',scaleSelect:'standard',landscapeSelect:'open',qualitySelect:'auto',fogSelect:'off'}))f.element(id).value=value;
    f.context.Game=Game;f.context.updateModeDescription();f.context.start();const g=f.context.game;
    assert.equal(g.mode.id,mode);
    if(mode==='defend-king'){
      assert.equal(g.teams.length,4);assert.equal(g.mode.kingSurvival,true);assert.ok(g.teams.every(t=>g.kingFor(t.id)?.isKing));assert.equal(g.objectives.length,0);assert.equal(g.nextFlagWaveAt,15);assert.match(f.element('objective').textContent,/Protect your king/);
    }else if(mode==='crown-control'){assert.equal(g.mode.controlGoal,120);assert.equal(g.objectives.length,1);assert.match(f.element('objective').textContent,/120 cumulative/);}
    else{assert.equal(g.mode.objectiveGoal,3);assert.equal(g.mode.flagRequired,10);assert.equal(g.mode.flagCooldown,12);assert.match(f.element('objective').textContent,/3 flag captures/);}
  }
});

test('Opening and resuming the menu preserves the running campaign and pause state',()=>{
  for(const paused of [false,true]){
    const f=fixture(),campaign={paused,winner:null,time:123,teams:[{alive:true}]};f.context.game=campaign;f.context.started=true;f.context.menuOpen=false;
    f.element('landscapeSelect').value='coast';f.context.chosenHouse=9;
    f.context.openMenu();assert.equal(f.context.game,campaign);assert.equal(campaign.paused,true);assert.equal(f.element('resumeButton').hidden,false);
    f.context.resume();assert.equal(f.context.game,campaign);assert.equal(campaign.paused,paused);assert.equal(campaign.time,123);assert.equal(f.context.menuOpen,false);assert.equal(f.element('menuOverlay').hidden,true);
    assert.equal(f.element('landscapeSelect').value,'coast');assert.equal(f.context.chosenHouse,9);
  }
});

test('Choosing Fog of War Off starts a new campaign with full battlefield knowledge',()=>{
  const f=fixture();
  for(const [id,value]of Object.entries({modeSelect:'conquest',enemySelect:'1',difficultySelect:'standard',scaleSelect:'standard',landscapeSelect:'open',qualitySelect:'auto',fogSelect:'off'}))f.element(id).value=value;
  f.context.Game=Game;f.context.start();
  assert.equal(f.context.game.config.fogOfWar,false);
  const enemy=f.context.game.units.find(u=>u.team===1);assert.ok(enemy);assert.equal(f.context.game.isVisibleTo(0,enemy),true);
});

console.log(`${cases} campaign menu checks passed.`);
