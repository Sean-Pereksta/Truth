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
  constructor(id=''){this.id=id;this.attributes=new Map();this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.tabIndex=0;this.focusCount=0;this.listeners=new Map();this.classes=new Set();this.classList={toggle:(name,force)=>{const active=force===undefined?!this.classes.has(name):!!force;if(active)this.classes.add(name);else this.classes.delete(name);return active;},contains:name=>this.classes.has(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  focus(){this.focusCount++;}
  scrollIntoView(){}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
  dispatch(type,event={}){for(const listener of this.listeners.get(type)||[])listener(event);}
}
function fixture(){
  const elements=new Map(),buttons=[];
  const element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const context={console,Math,Map,Set,String,Array,HOUSES,UNIT_DEFS,BUILD_DEFS,HOUSE_CONTENT,
    chosenHouse:0,started:false,menuOpen:true,wasPaused:false,edgeMouse:null,
    ui:{selected:new Set(),selectedBuildings:new Set(),quality:'auto'},groups:new Map(),keys:new Set(),
    allSelected:false,allBuildingsSelected:false,lastResult:null,lastEvent:0,lastBattle:0,accumulator:0,speed:1,
    $:element,document:{querySelectorAll:selector=>selector==='.house-choice'?buttons:[],querySelector:()=>element('crestUse'),documentElement:{style:{setProperty(){}}}},
    canvas:element('battleCanvas'),powerData:h=>h.power,houseAdvantages:h=>h.advantages||[],houseWeaknesses:h=>h.weaknesses||[],
    icon:name=>`<svg data-icon="${name}"></svg>`,short:name=>name.replace('House ',''),escapeHTML:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    labelMenuHotkeys(){},paintHousePreview(){},clearBuildingSelection(){context.ui.selectedBuildings.clear();},cancelBuild(){},
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
  for(const name of ['chooseHouse','chooseMenuTab','renderHouseGuide','openMenu','resume','start'])vm.runInContext(extract(name),context,{filename:'app.js:'+name});
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
