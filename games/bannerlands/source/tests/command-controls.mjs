import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {isPassableTile} from '../../lands.js';
import {worldToScreen,screenToWorld} from '../../render.js';
import {regimentForHouse,regimentBuildingForHouse,regimentsForHouse,regimentBuildingsForHouse,regimentRequiredBuilding,houseCanBuild,houseCanRecruit} from '../../regiments.js';

const source=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8');
let cases=0;
const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
const testAsync=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
const extract=name=>{
  let start=source.indexOf('function '+name+'(');assert.ok(start>=0,'Missing production function '+name);if(source.slice(start-6,start)==='async ')start-=6;
  const lineEnd=source.indexOf('\n',start),line=source.slice(start,lineEnd);
  if(line.trimEnd().endsWith('}'))return line;
  const end=source.indexOf('\n}',start);assert.ok(end>start,'Incomplete production function '+name);return source.slice(start,end+2);
};
const listener=(target,type)=>{
  const start=source.indexOf(target+".addEventListener('"+type+"',e=>{");assert.ok(start>=0,'Missing production '+type+' listener');
  const end=source.indexOf('\n});',start);assert.ok(end>start,'Incomplete production '+type+' listener');return source.slice(start,end+4);
};
class Element{
  constructor(id=''){this.id=id;this.hidden=false;this.open=false;this.disabled=false;this.dataset={};this.title='';this.innerHTML='';this.children=[];this.firstChild={textContent:''};this.listeners=new Map();this.attributes=new Map();this.clicks=0;this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  dispatch(type,event){for(const fn of this.listeners.get(type)||[])fn(event);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  click(){this.clicks++;}
  querySelector(selector){return selector==='.menu-hotkey'?this.children.find(child=>child.className==='menu-hotkey')||null:selector==='.action-title'?this:null;}
  append(child){this.children.push(child);}
  focus(){}
  scrollIntoView(){}
  setPointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}
}
function fixture({house=0,realMenu=false}={}){
  const game=new Game({landscape:'open',scale:'standard',enemies:1,house,seed:44277});game.units=[];game.buildings=[];game.byId.clear();
  for(const tile of game.tiles){tile.terrain='grass';tile.feature=null;tile.owner=0;}
  for(const team of game.teams){team.count=0;team.alive=true;team.cap=1000;}
  game.navigation.invalidate();
  const elements=new Map(),actions=new Map(),tabs=['army','build','council'].map(name=>{const tab=new Element();tab.dataset.tab=name;return tab;}),messages=[],effects=[],commands=[];
  const element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const canvas=element('battleCanvas'),win=new Element('window'),ui={selected:new Set(),selectedBuildings:new Set(),formation:'line',buildMode:null,rallyMode:false,teamOrderMode:null,facingMode:false,facingPreview:null,drag:null,hover:null};
  element('resultOverlay').hidden=true;
  const context={console,Math,Map,Set,String,Array,HOUSES,UNIT_DEFS,BUILD_DEFS,isPassableTile,worldToScreen,screenToWorld,regimentForHouse,regimentBuildingForHouse,regimentsForHouse,regimentBuildingsForHouse,regimentRequiredBuilding,houseCanBuild,houseCanRecruit,game,canvas,window:win,
    ui,view:{x:0,y:840,w:800,h:600,zoom:1},battleHud:{open(){},close(){},isOpen:false,touchSelect:false,syncSelection(){}},started:true,menuOpen:false,orderMode:'attack',tab:'army',allSelected:false,allBuildingsSelected:false,
    pointers:new Map(),keys:new Set(),groups:new Map(),gesture:null,pinch:null,edgeMouse:null,
    $:element,document:{body:{classList:{add(){},remove(){}}},createElement:()=>new Element(),querySelector:selector=>{if(realMenu)return selector?.startsWith('#')?element(selector.slice(1)):actions.get(selector)||null;if(!actions.has(selector))actions.set(selector,new Element(selector));return actions.get(selector);},querySelectorAll:selector=>selector==='[data-tab]'?tabs:[]},
    updateHud(){},toast:message=>messages.push(message),tone(){},initAudio(){},minZoom:()=>.05,boundCamera(){},buildingAt:()=>null,
    placeTeamOrder:()=>effects.push('teamOrder'),terrainDescription:()=>'',
    togglePause:()=>effects.push('pause'),attackNearest:()=>effects.push('attackNearest'),expandNearby:()=>effects.push('expand'),useHousePower:()=>effects.push('power'),
    selectArmy:()=>effects.push('army'),findHero:()=>effects.push('hero'),hold:()=>effects.push('hold'),selectAllBuildings:()=>effects.push('buildings'),retreat:()=>effects.push('retreat'),toggleGrid:()=>effects.push('grid'),fitMap:()=>effects.push('fit'),home:()=>effects.push('home'),zoomAt:()=>effects.push('zoom'),setMode:()=>effects.push('mode')
  };
  const actualCommand=game.command;game.command=function(...args){commands.push(args);return actualCommand.apply(this,args);};
  vm.createContext(context);
  for(const prefix of ['const MENU_TAB_KEYS=','const BUILD_HOTKEYS=','const TYPE_HOTKEYS=','const selected=','const selectedBuildings=','const clamp=','const iso=','const icons=','const icon=','const escapeHTML=']){
    const line=source.split('\n').find(line=>line.startsWith(prefix));assert.ok(line,prefix);vm.runInContext(line,context);
  }
  const actionsStart=source.indexOf('const MENU_ACTIONS='),actionsEnd=source.indexOf('\n};',actionsStart);vm.runInContext(source.slice(actionsStart,actionsEnd+3),context);
  for(const name of ['clearBuildingSelection','selectTroopType','commandGroup','cancelBuild','showTab','activateMenuAction','handleMenuHotkey','beginFacing','patrolBorder','issue','setSelectedRally','pointerPos','rememberMouse','finishPointer','bonusText','upgradeSummary','specialistTooltip','labelMenuHotkeys','buildActionLists'])vm.runInContext(extract(name),context);
  vm.runInContext(listener('canvas','pointerdown'),context);vm.runInContext(listener('canvas','pointermove'),context);vm.runInContext(listener('window','keydown'),context);
  const cancelLine=source.split('\n').find(line=>line.startsWith("canvas.addEventListener('pointerup'"));vm.runInContext(cancelLine,context);
  const blurLine=source.split('\n').find(line=>line.startsWith("window.addEventListener('keyup'"));vm.runInContext(blurLine,context);
  const patrolLine=source.split('\n').find(line=>line.startsWith("$('patrolButton').onclick="));assert.ok(patrolLine);vm.runInContext(patrolLine,context);
  for(const id of ['recruitList','buildList']){const line=source.split('\n').find(line=>line.startsWith("$('"+id+"').addEventListener('click'"));assert.ok(line);vm.runInContext(line,context);}
  const refreshMenu=()=>{
    actions.clear();const rows={};
    for(const [id,kind]of [['recruitList','recruit'],['buildList','build']]){
      rows[kind]=[];
      for(const match of element(id).innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
        const button=new Element();button.innerHTML=match[2];
        for(const attribute of match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){
          const [name,value]=[attribute[1],attribute[2]??''];button.setAttribute(name,value);if(name==='title')button.title=value;if(name.startsWith('data-'))button.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;
        }
        for(const attribute of ['data-recruit','data-build','data-special-recruit','data-special-build','data-regiment-recruit','data-regiment-build','data-horse-recruit','data-horse-build'])if(button.attributes.has(attribute)){const value=button.getAttribute(attribute);actions.set(value?'['+attribute+'="'+value+'"]':'['+attribute+']',button);}
        button.click=()=>{button.clicks++;element(id).dispatch('click',{target:{closest:()=>button}});};rows[kind].push(button);
      }
    }
    context.labelMenuHotkeys();return rows;
  };
  const event=(overrides={})=>({pointerId:1,button:2,pointerType:'mouse',clientX:400,clientY:300,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,repeat:false,isComposing:false,defaultPrevented:false,target:{tagName:'CANVAS'},preventDefault(){this.defaultPrevented=true;},...overrides});
  return {game,ui,context,canvas,win,element,actions,messages,effects,commands,event,refreshMenu};
}
const ids=value=>[...value].sort((a,b)=>a-b);

test('Right-drag issues one order at the pressed destination with normalized world-space facing',()=>{
  const f=fixture(),u=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(u.id);
  f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:342}));
  assert.ok(f.ui.facingPreview);assert.equal(f.ui.facingPreview.x,30);assert.equal(f.ui.facingPreview.y,30);assert.ok(Math.abs(f.ui.facingPreview.faceX-1)<1e-9);assert.ok(Math.abs(f.ui.facingPreview.faceY)<1e-9);assert.equal(f.commands.length,0);
  assert.equal(f.context.view.x,0);assert.equal(f.context.view.y,840,'A formation-facing drag must not pan the camera.');
  f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:342}));assert.equal(f.commands.length,1);
  const [,x,y,mode,formation,facing]=f.commands[0];assert.equal(x,30);assert.equal(y,30);assert.equal(mode,'move');assert.equal(formation,'line');assert.ok(Math.abs(facing.x-1)<1e-9);assert.ok(Math.abs(facing.y)<1e-9);
  assert.equal(u.order.groupX,30);assert.equal(u.order.groupY,30);assert.ok(Math.abs(u.order.facingX-1)<1e-9);assert.equal(f.ui.facingPreview,null);
});

test('Simple right-click moves, while the directional button and D never turn left-drag selection into an order',()=>{
  const f=fixture(),u=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(u.id);
  f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointerup',f.event());assert.equal(f.commands.length,1);assert.equal(f.commands[0][3],'move');assert.equal(f.commands[0][5],null);assert.equal(u.order.facingX,undefined);
  for(const explain of [()=>f.context.beginFacing(),()=>f.win.dispatch('keydown',f.event({key:'d',code:'KeyD'}))]){
    explain();f.canvas.dispatch('pointerdown',f.event({button:0}));f.canvas.dispatch('pointermove',f.event({button:0,clientX:300,clientY:260}));assert.ok(f.ui.drag);assert.equal(f.ui.facingPreview,null);f.canvas.dispatch('pointerup',f.event({button:0,clientX:300,clientY:260}));
    assert.equal(f.commands.length,1);assert.deepEqual(ids(f.ui.selected),[u.id]);
  }
});

test('Right-click orders every selected troop even when it also closes the command drawer',()=>{
  const f=fixture(),troops=Array.from({length:480},(_,i)=>f.game.addUnit(0,'infantry',20+i%20*.3,22+Math.floor(i/20)*.3));
  f.ui.selected=new Set(troops.map(u=>u.id));f.context.battleHud.isOpen=true;
  f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointerup',f.event());
  assert.equal(f.commands.length,1);assert.equal(f.commands[0][3],'move');
  for(const u of troops){assert.equal(u.order.mode,'move');assert.equal(u.order.groupX,30);assert.equal(u.order.groupY,30);}
  f.canvas.dispatch('pointerdown',f.event({button:0}));f.canvas.dispatch('pointerup',f.event({button:0}));
  assert.equal(f.ui.selected.size,troops.length,'A primary click may still just close the drawer.');assert.equal(f.commands.length,1);
});

test('Right-drag that returns to its anchor still issues a move order',()=>{
  const f=fixture(),u=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(u.id);
  f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:420,clientY:310}));f.canvas.dispatch('pointermove',f.event());f.canvas.dispatch('pointerup',f.event());
  assert.equal(f.commands.length,1);assert.equal(f.commands[0][3],'move');assert.equal(f.commands[0][5],null);assert.equal(u.order.groupX,30);assert.equal(u.order.groupY,30);assert.equal(u.order.facingX,undefined);
});

test('Cancel, Escape and lost focus discard a facing preview without issuing an order',()=>{
  for(const interruption of ['pointercancel','Escape','blur']){
    const f=fixture(),u=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(u.id);
    f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:342}));
    if(interruption==='pointercancel')f.canvas.dispatch('pointercancel',f.event());else if(interruption==='Escape')f.win.dispatch('keydown',f.event({key:'Escape',code:'Escape'}));else f.win.dispatch('blur',f.event());
    f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:342}));assert.equal(f.commands.length,0,interruption);assert.equal(f.ui.facingPreview,null,interruption);
  }
});

test('Building-only right-click sets its rally, while right-drag never pans or changes a rally',()=>{
  const f=fixture(),building=f.game.addBuilding(0,'barracks',25.5,25.5);f.ui.selectedBuildings.add(building.id);f.context.battleHud.isOpen=true;
  f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointerup',f.event());assert.equal(f.commands.length,0);assert.equal(building.rally.x,30);assert.equal(building.rally.y,30);
  const before={...building.rally},camera={...f.context.view};f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:342}));assert.ok(f.ui.facingPreview);assert.equal(f.ui.facingPreview.count,0);f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:342}));
  assert.deepEqual(building.rally,before);assert.equal(f.commands.length,0);assert.equal(f.ui.facingPreview,null);assert.deepEqual(f.context.view,camera);
});

test('Only middle-drag pans; an empty-selection right-drag remains a facing preview without commanding anything',()=>{
  const f=fixture(),camera={...f.context.view};f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:342}));assert.ok(f.ui.facingPreview);assert.equal(f.ui.facingPreview.count,0);f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:342}));assert.deepEqual(f.context.view,camera);assert.equal(f.commands.length,0);
  f.canvas.dispatch('pointerdown',f.event({button:1}));f.canvas.dispatch('pointermove',f.event({button:1,clientX:484,clientY:342}));f.canvas.dispatch('pointerup',f.event({button:1,clientX:484,clientY:342}));assert.equal(f.context.view.x,camera.x-84);assert.equal(f.context.view.y,camera.y-42);assert.equal(f.commands.length,0);
});

test('Left-drag always selects and right-drag always faces, including during placement and rally modes',()=>{
  for(const mode of ['buildMode','rallyMode','teamOrderMode']){
    const f=fixture(),u=f.game.addUnit(0,'infantry',28.5,30.5);f.ui[mode]=mode==='buildMode'?'barracks':mode==='teamOrderMode'?'assault':true;
    f.canvas.dispatch('pointerdown',f.event({button:0}));f.canvas.dispatch('pointermove',f.event({button:0,clientX:300,clientY:260}));assert.ok(f.ui.drag,mode);assert.equal(f.ui.facingPreview,null);f.canvas.dispatch('pointerup',f.event({button:0,clientX:300,clientY:260}));assert.deepEqual(ids(f.ui.selected),[u.id],mode);assert.equal(f.commands.length,0);assert.equal(f.effects.includes('teamOrder'),false);assert.equal(f.game.buildings.length,0);
    f.canvas.dispatch('pointerdown',f.event());f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:342}));assert.ok(f.ui.facingPreview,mode);f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:342}));assert.equal(f.commands.length,1,mode);assert.ok(Math.abs(f.commands[0][5].x-1)<1e-9);assert.equal(f.ui[mode],mode==='buildMode'||mode==='teamOrderMode'?null:false);assert.equal(f.game.buildings.length,0);
  }
});

test('Patrol N and the patrol button command only selected cavalry and preserve ordinary infantry orders',()=>{
  for(const trigger of [f=>f.win.dispatch('keydown',f.event({key:'n',code:'KeyN'})),f=>f.element('patrolButton').onclick()]){
    const f=fixture(),horse=f.game.addUnit(0,'cavalry',28.5,30.5),foot=f.game.addUnit(0,'infantry',29,31);f.game.hold([foot.id]);const old=foot.order;f.ui.selected=new Set([horse.id,foot.id]);trigger(f);assert.equal(horse.order.mode,'patrol');assert.equal(foot.order,old);assert.equal(f.commands.length,0);
  }
  const f=fixture(),foot=f.game.addUnit(0,'infantry',29,31);f.ui.selected.add(foot.id);f.context.patrolBorder();assert.ok(f.messages.at(-1).includes('Select cavalry'));assert.equal(foot.order,null);
});

test('Type selection filters living owned classes including house specialists and existing spear factions',()=>{
  const f=fixture(),types=['infantry','winter_guard','dread_pike','bridge_warden','archer','gilded_crossbow','cavalry','thorn_lancer','siege','beacon_engineer','hero'],own=types.map((type,i)=>f.game.addUnit(0,type,20+i,30)),foreign=f.game.addUnit(1,'dread_pike',20,31),dead=f.game.addUnit(0,'infantry',21,31);dead.hp=0;
  const building=f.game.addBuilding(0,'barracks',20,20);building.rally={x:40,y:40};f.ui.selectedBuildings.add(building.id);const orders=own.map(u=>u.order);
  f.context.selectTroopType('infantry');assert.deepEqual(ids(f.ui.selected),ids(own.filter(u=>f.game.unitClass(u)==='infantry').map(u=>u.id)));assert.equal(f.ui.selectedBuildings.size,0);
  f.context.selectTroopType('spears');assert.deepEqual(ids(f.ui.selected),ids(own.filter(u=>UNIT_DEFS[u.type].spearBrace).map(u=>u.id)));assert.ok(!f.ui.selected.has(foreign.id)&&!f.ui.selected.has(dead.id));
  f.context.selectTroopType('archer',true);assert.deepEqual(ids(f.ui.selected),ids(own.filter(u=>UNIT_DEFS[u.type].spearBrace||f.game.unitClass(u)==='archer').map(u=>u.id)));
  for(let i=0;i<own.length;i++)assert.equal(own[i].order,orders[i]);assert.deepEqual(building.rally,{x:40,y:40});
});

test('Nine command groups store, add and recall only living owned soldiers without changing orders or rallies',()=>{
  const f=fixture(),a=f.game.addUnit(0,'infantry',20,30),b=f.game.addUnit(0,'cavalry',21,30),foreign=f.game.addUnit(1,'archer',22,30),dead=f.game.addUnit(0,'infantry',23,30),building=f.game.addBuilding(0,'barracks',20,20);dead.hp=0;building.rally={x:40,y:40};a.order={x:45,y:45,mode:'move'};b.order={x:46,y:45,mode:'hold'};const orders=[a.order,b.order];
  for(let number=1;number<=9;number++){
    f.ui.selected=new Set([a.id,foreign.id,dead.id,building.id]);f.context.commandGroup(number,true);assert.deepEqual(ids(f.context.groups.get(String(number))),[a.id]);
    f.ui.selected=new Set([b.id]);f.context.commandGroup(number,true,true);assert.deepEqual(ids(f.context.groups.get(String(number))),ids([a.id,b.id]));
    f.ui.selected.clear();f.ui.selectedBuildings.add(building.id);f.context.commandGroup(number);assert.deepEqual(ids(f.ui.selected),ids([a.id,b.id]));assert.equal(f.ui.selectedBuildings.size,0);
  }
  b.hp=0;f.ui.selected.clear();f.context.commandGroup(9);assert.deepEqual(ids(f.ui.selected),[a.id]);assert.equal(a.order,orders[0]);assert.equal(b.order,orders[1]);assert.deepEqual(building.rally,{x:40,y:40});assert.equal(f.commands.length,0);
});

test('Shift-letter building shortcuts select the correct building while numeric build shortcuts cannot place one',()=>{
  const f=fixture(),mapping={b:'[data-build="barracks"]',a:'[data-build="range"]',s:'[data-build="stables"]',t:'[data-build="tower"]',w:'[data-build="workshop"]',h:'[data-special-build]'};
  for(const [letter,selector]of Object.entries(mapping)){
    const e=f.event({key:letter.toUpperCase(),code:'Key'+letter.toUpperCase(),shiftKey:true});assert.equal(f.context.handleMenuHotkey(e),true);assert.equal(f.context.tab,'build');assert.equal(f.actions.get(selector).clicks,1);assert.equal(e.defaultPrevented,true);
  }
  const clicks=[...f.actions.values()].reduce((sum,b)=>sum+b.clicks,0);f.context.handleMenuHotkey(f.event({key:'!',code:'Digit1',shiftKey:true}));assert.equal([...f.actions.values()].reduce((sum,b)=>sum+b.clicks,0),clicks);assert.ok(f.messages.at(-1).includes('Shift + B'));
});

test('Alt-type hotkeys and Ctrl command groups avoid menu and battle key conflicts',()=>{
  const f=fixture(),archer=f.game.addUnit(0,'gilded_crossbow',20,30),horse=f.game.addUnit(0,'thorn_lancer',21,30),spear=f.game.addUnit(0,'dread_pike',22,30);
  f.win.dispatch('keydown',f.event({key:'a',code:'KeyA',altKey:true}));assert.deepEqual(ids(f.ui.selected),[archer.id]);assert.equal(f.effects.length,0);assert.equal(f.context.tab,'army');
  f.win.dispatch('keydown',f.event({key:'c',code:'KeyC',altKey:true,shiftKey:true}));assert.deepEqual(ids(f.ui.selected),ids([archer.id,horse.id]));assert.equal(f.context.tab,'army');
  f.win.dispatch('keydown',f.event({key:'9',code:'Digit9',ctrlKey:true}));assert.deepEqual(ids(f.context.groups.get('9')),ids([archer.id,horse.id]));
  f.ui.selected=new Set([spear.id]);f.win.dispatch('keydown',f.event({key:'9',code:'Digit9',ctrlKey:true,shiftKey:true}));assert.deepEqual(ids(f.context.groups.get('9')),ids([archer.id,horse.id,spear.id]));
  f.ui.selected.clear();f.win.dispatch('keydown',f.event({key:'9',code:'Digit9'}));assert.deepEqual(ids(f.ui.selected),ids([archer.id,horse.id,spear.id]));assert.equal(f.effects.length,0);assert.equal(f.commands.length,0);
});

test('All sixteen houses retain their original menus while eligible houses gain the sixth regiment and seventh building shortcuts',()=>{
  const expectedRegiments={wolf:'shield_bearer',lion:'shield_bearer',dragon:'shield_bearer',rose:'shield_bearer',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion',flayed:'trebuchet',beacon:'trebuchet',bone:'giant',fish:'sharpshooter',stag:'stormbreaker',kraken:'saltwind_axethrower',bridge:'tollhouse_crossbow',frog:'crannog_spearhand',huntsman:'hornhill_halberdier'};
  for(let house=0;house<HOUSES.length;house++){
    const f=fixture({house,realMenu:true}),sigil=HOUSES[house].sigil,regiment=expectedRegiments[sigil]||null,building=regimentBuildingForHouse(sigil),original=f.game.houseContent(0);
    assert.equal(regimentForHouse(sigil),regiment);f.context.buildActionLists();const rows=f.refreshMenu();
    assert.deepEqual(rows.recruit.map(button=>button.dataset.recruit),['infantry','archer','cavalry',sigil==='sun'?'sun_horse_archer':'siege',original.unit,...regimentsForHouse(sigil).filter(type=>type!=='sun_horse_archer')].filter(type=>houseCanRecruit(type,sigil)));
    assert.deepEqual(rows.build.map(button=>button.dataset.build),['barracks','range','stables','tower',sigil==='sun'?'sunbow_corral':'workshop',original.building,...regimentBuildingsForHouse(sigil).filter(type=>type!=='sunbow_corral')].filter(type=>houseCanBuild(type,sigil)));
    assert.equal(rows.recruit.length,regiment?6:5);assert.equal(rows.build.length,regiment?7:6);
    assert.equal(rows.recruit[4].attributes.has('data-special-recruit'),true);assert.equal(rows.build[5].attributes.has('data-special-build'),true);
    assert.equal(rows.recruit[4].getAttribute('aria-keyshortcuts'),'Shift+5');assert.equal(rows.build[5].getAttribute('aria-keyshortcuts'),'Shift+H');
    f.context.showTab('army');assert.ok(f.element('menuShortcutHint').textContent.startsWith('Shift+1–'+(regiment?6:5)));
    if(regiment){
      assert.equal(rows.recruit[5].dataset.recruit,regiment);assert.equal(rows.recruit[5].attributes.has('data-regiment-recruit'),true);assert.equal(rows.recruit[5].getAttribute('aria-keyshortcuts'),'Shift+6');
      assert.equal(rows.build[6].dataset.build,building);assert.equal(rows.build[6].attributes.has('data-regiment-build'),true);assert.equal(rows.build[6].getAttribute('aria-keyshortcuts'),'Shift+J');
      assert.ok(rows.recruit[5].innerHTML.includes('Requires '+BUILD_DEFS[building].label));assert.equal(BUILD_DEFS[building].house,sigil);
      f.game.teams[0].gold=100000;f.game.addBuilding(0,building,40.5,40.5);
    }else{assert.equal(f.actions.has('[data-regiment-recruit]'),false);assert.equal(f.actions.has('[data-regiment-build]'),false);}
    f.win.dispatch('keydown',f.event({key:'^',code:'Digit6',shiftKey:true}));
    assert.equal(f.game.units.length,regiment?UNIT_DEFS[regiment].batch:0);assert.ok(f.game.units.every(unit=>unit.type===regiment&&unit.team===0));
    if(regiment)assert.equal(rows.recruit[5].clicks,1);
    f.win.dispatch('keydown',f.event({key:'J',code:'KeyJ',shiftKey:true}));assert.equal(f.context.tab,'build');assert.equal(f.ui.buildMode,building);
    if(regiment)assert.equal(rows.build[6].clicks,1);else assert.ok(f.messages.at(-1).includes('No item'));
  }
});

await testAsync('Boot waits for regiment and conquest art, and failed new art keeps Start disabled',async()=>{
  for(const failed of [null,'loadRegimentArt','loadRegimentBuildings','loadConquestArt','loadReinforcementArt','loadHouseEmblems','loadBridgeArt']){
    const f=fixture({realMenu:true}),loads=[],errors=[],effects=[];
    f.context.console={warn(){},error:(...args)=>errors.push(args)};f.context.renderer={};
    for(const method of ['loadTroops','loadStructures','loadCampaignArt','loadTerrain','loadHouseArt','loadRegimentArt','loadRegimentBuildings','loadConquestArt','loadReinforcementArt','loadHouseEmblems','loadBridgeArt','loadLandsArt','loadLandsGround'])f.context.renderer[method]=(...args)=>{loads.push({method,args});return method===failed?Promise.reject(new Error('Missing test artwork')):Promise.resolve();};
    for(const name of ['paintBuildingIcons','paintHousePreview','paintTownHall','fitMap','updateHud'])f.context[name]=()=>effects.push(name);
    f.context.frame=()=>{};f.context.requestAnimationFrame=()=>effects.push('frame');
    for(const prefix of ['const HOUSE_ART_SOURCES=','const REGIMENT_ART_SOURCES=','const CONQUEST_ART_SOURCES=','const REINFORCEMENT_ART_SOURCES=']){const line=source.split('\n').find(line=>line.startsWith(prefix));assert.ok(line);vm.runInContext(line,f.context);}
    vm.runInContext(extract('boot'),f.context);const boot=f.context.boot();assert.equal(f.element('startButton').disabled,true);assert.ok(f.element('startButton').innerHTML.includes('PREPARING'));
    await boot;
    const sheets=loads.find(load=>load.method==='loadRegimentArt')?.args[0];assert.ok(sheets);assert.deepEqual(Object.keys(sheets).sort(),['bear','dragon','falcon','lion','rose','sun','wolf']);assert.equal(new Set(Object.values(sheets)).size,7);
    assert.equal(loads.find(load=>load.method==='loadRegimentBuildings')?.args[0],'assets/regiments/production-buildings.png');
    if(failed){assert.equal(f.element('startButton').disabled,true);assert.equal(f.element('startButton').innerHTML,'ARTWORK COULD NOT LOAD');assert.equal(errors.length,1);assert.equal(effects.includes('frame'),false);}
    else{assert.equal(f.element('startButton').disabled,false);assert.ok(f.element('startButton').innerHTML.includes('RAISE THE BANNERS'));assert.equal(errors.length,0);assert.equal(effects.includes('frame'),true);}
  }
});

test('Default one-finger pan preserves construction, rally targeting and the current army selection',()=>{
  for(const mode of ['build','rally']){
    const f=fixture(),unit=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(unit.id);
    if(mode==='build')f.ui.buildMode='barracks';else f.ui.rallyMode=true;
    const event=f.event({button:0,pointerType:'touch'});
    f.canvas.dispatch('pointerdown',event);f.canvas.dispatch('pointermove',f.event({button:0,pointerType:'touch',clientX:470,clientY:330}));
    assert.equal(f.ui.drag,null);assert.equal(f.context.view.x,-70);assert.equal(f.context.view.y,810);
    f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',clientX:470,clientY:330}));
    assert.deepEqual(ids(f.ui.selected),[unit.id]);assert.equal(f.commands.length,0);
    assert.equal(mode==='build'?f.ui.buildMode:f.ui.rallyMode,mode==='build'?'barracks':true);
  }
});

test('Touch Select explicitly box-selects troops while touch facing issues a directional movement order',()=>{
  const f=fixture(),unit=f.game.addUnit(0,'infantry',30,30);f.context.battleHud.touchSelect=true;
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',clientX:360,clientY:260}));
  f.canvas.dispatch('pointermove',f.event({button:0,pointerType:'touch',clientX:450,clientY:340}));
  assert.ok(f.ui.drag);f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',clientX:450,clientY:340}));
  assert.deepEqual(ids(f.ui.selected),[unit.id]);assert.equal(f.context.view.x,0);assert.equal(f.context.view.y,840);
  f.context.battleHud.touchSelect=false;f.ui.facingMode=true;
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch'}));
  f.canvas.dispatch('pointermove',f.event({button:0,pointerType:'touch',clientX:484,clientY:342}));
  f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',clientX:484,clientY:342}));
  assert.equal(f.commands.length,1);assert.equal(f.commands[0][3],'move');assert.ok(f.commands[0][5]);assert.equal(f.ui.facingMode,false);
});

test('Touch construction repeats only when requested and invalid placements keep targeting active',()=>{
  const f=fixture();f.ui.buildMode='barracks';f.element('repeatBuild').checked=true;
  const tap=(x=400,y=300)=>{f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',clientX:x,clientY:y}));f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',clientX:x,clientY:y}));};
  tap();assert.equal(f.game.buildings.length,1);assert.equal(f.ui.buildMode,'barracks');
  tap();assert.equal(f.game.buildings.length,1);assert.equal(f.ui.buildMode,'barracks','Blocked ground keeps the chosen building active.');
  f.element('repeatBuild').checked=false;tap(600,300);assert.equal(f.game.buildings.length,2);assert.equal(f.ui.buildMode,null);
});

test('Canceled touch navigation and a dismissed drawer do not issue unintended orders',()=>{
  const f=fixture(),unit=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(unit.id);f.ui.buildMode='barracks';
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch'}));
  f.canvas.dispatch('pointercancel',f.event({button:0,pointerType:'touch'}));assert.equal(f.ui.buildMode,'barracks');assert.equal(f.game.buildings.length,0);
  f.ui.buildMode=null;f.context.battleHud.isOpen=true;
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch'}));f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch'}));
  assert.equal(f.commands.length,0);assert.deepEqual(ids(f.ui.selected),[unit.id]);
});

test('Pinch navigation preserves targeting and releasing either finger cannot place or command',()=>{
  const f=fixture(),unit=f.game.addUnit(0,'infantry',28.5,30.5);f.ui.selected.add(unit.id);f.ui.buildMode='barracks';
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',pointerId:1,clientX:330,clientY:300}));
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',pointerId:2,clientX:470,clientY:300}));
  assert.ok(f.context.pinch);assert.equal(f.context.gesture,null);
  f.canvas.dispatch('pointermove',f.event({button:0,pointerType:'touch',pointerId:2,clientX:510,clientY:300}));
  assert.ok(f.context.view.zoom>1);
  f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',pointerId:1,clientX:330,clientY:300}));
  f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',pointerId:2,clientX:510,clientY:300}));
  assert.equal(f.ui.buildMode,'barracks');assert.equal(f.game.buildings.length,0);assert.equal(f.commands.length,0);assert.deepEqual(ids(f.ui.selected),[unit.id]);
});

console.log(`${cases} command control checks passed.`);
