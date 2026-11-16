import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,HOUSES,UNIT_DEFS,BUILD_DEFS} from '../../core.js';
import {isPassableTile} from '../../lands.js';
import {worldToScreen,screenToWorld} from '../../render.js';
import {regimentForHouse,regimentBuildingForHouse,regimentsForHouse,regimentBuildingsForHouse,regimentRequiredBuilding,houseCanBuild,houseCanRecruit} from '../../regiments.js';
import {formationPreview,formationRole,placeFormation} from '../../formation-placement.js';
import {HERO_PROFILES,heroProfile} from '../../heroes.js';

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
  constructor(id=''){this.id=id;this.hidden=false;this.open=false;this.disabled=false;this.dataset={};this.style={};this.title='';this.innerHTML='';this.children=[];this.firstChild={textContent:''};this.listeners=new Map();this.attributes=new Map();this.clicks=0;this.classList={add(){},remove(){},toggle(){}};}
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
  const canvas=element('battleCanvas'),win=new Element('window'),ui={selected:new Set(),selectedBuildings:new Set(),formation:'line',formationOptions:{ranks:2,width:null,lockFacing:false},formMode:false,formPreview:null,buildMode:null,rallyMode:false,teamOrderMode:null,facingMode:false,facingPreview:null,drag:null,hover:null};
  element('resultOverlay').hidden=true;
  const context={console,Math,Map,Set,String,Array,HOUSES,HERO_PROFILES,heroProfile,UNIT_DEFS,BUILD_DEFS,isPassableTile,worldToScreen,screenToWorld,regimentForHouse,regimentBuildingForHouse,regimentsForHouse,regimentBuildingsForHouse,regimentRequiredBuilding,houseCanBuild,houseCanRecruit,formationPreview,formationRole,placeFormation,game,canvas,window:win,performance:{now:()=>100},standardTapBlock:null,
    ui,view:{x:0,y:840,w:800,h:600,zoom:1},battleHud:{open(){},close(){},isOpen:false,touchSelect:false,syncSelection(){}},started:true,menuOpen:false,orderMode:'attack',tab:'army',allSelected:false,allBuildingsSelected:false,
    pointers:new Map(),keys:new Set(),groups:new Map(),gesture:null,pinch:null,edgeMouse:null,
    $:element,document:{body:{classList:{add(){},remove(){}}},createElement:()=>new Element(),querySelector:selector=>{if(realMenu)return selector?.startsWith('#')?element(selector.slice(1)):actions.get(selector)||null;if(!actions.has(selector))actions.set(selector,new Element(selector));return actions.get(selector);},querySelectorAll:selector=>selector==='[data-tab]'?tabs:[]},
    updateHud(){},toast:message=>messages.push(message),tone(){},initAudio(){},minZoom:()=>.05,boundCamera(){},renderer:{campaignArtReady:true,getStructureFrame:()=>({drawWidth:60,drawHeight:70})},
    placeTeamOrder:()=>effects.push('teamOrder'),terrainDescription:()=>'',
    togglePause:()=>effects.push('pause'),attackNearest:()=>effects.push('attackNearest'),advanceAttack:()=>effects.push('advance'),expandNearby:()=>effects.push('expand'),useHousePower:()=>effects.push('power'),
    selectArmy:()=>effects.push('army'),findHero:()=>effects.push('hero'),hold:()=>effects.push('hold'),selectAllBuildings:()=>effects.push('buildings'),retreat:()=>effects.push('retreat'),toggleGrid:()=>effects.push('grid'),fitMap:()=>effects.push('fit'),home:()=>effects.push('home'),zoomAt:()=>effects.push('zoom'),setMode:()=>effects.push('mode')
  };
  const actualCommand=game.command;game.command=function(...args){commands.push(args);return actualCommand.apply(this,args);};
  vm.createContext(context);
  for(const prefix of ['const MENU_TAB_KEYS=','const BUILD_HOTKEYS=','const TYPE_HOTKEYS=','const selected=','const selectedBuildings=','const clamp=','const iso=','const icons=','const icon=','const escapeHTML=']){
    const line=source.split('\n').find(line=>line.startsWith(prefix));assert.ok(line,prefix);vm.runInContext(line,context);
  }
  const actionsStart=source.indexOf('const MENU_ACTIONS='),actionsEnd=source.indexOf('\n};',actionsStart);vm.runInContext(source.slice(actionsStart,actionsEnd+3),context);
  for(const name of ['clearBuildingSelection','selectTroopType','commandGroup','cancelBuild','showTab','activateMenuAction','handleMenuHotkey','beginFacing','beginForm','refreshFormationPreview','confirmFormation','formPointer','patrolBorder','issue','issueTarget','buildingAt','standardAt','selectedHero','standardCommand','performStandardAction','placeStandard','cancelStandardInteraction','beginFormAtStandard','setSelectedRally','pointerPos','rememberMouse','finishPointer','bonusText','upgradeSummary','specialistTooltip','labelMenuHotkeys','buildActionLists'])vm.runInContext(extract(name),context);
  vm.runInContext(listener('canvas','pointerdown'),context);vm.runInContext(listener('canvas','pointermove'),context);vm.runInContext(listener('window','keydown'),context);
  const cancelLine=source.split('\n').find(line=>line.startsWith("canvas.addEventListener('pointerup'"));vm.runInContext(cancelLine,context);
  const blurLine=source.split('\n').find(line=>line.startsWith("window.addEventListener('keyup'"));vm.runInContext(blurLine,context);
  const patrolLine=source.split('\n').find(line=>line.startsWith("$('patrolButton').onclick="));assert.ok(patrolLine);vm.runInContext(patrolLine,context);
  const advanceLine=source.split('\n').find(line=>line.startsWith("$('advanceButton').onclick="));assert.ok(advanceLine);vm.runInContext(advanceLine,context);
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

test('W advances once and A charges, while Shift+W remains the siege-works shortcut',()=>{
  const f=fixture();
  const advance=f.event({key:'w',code:'KeyW'});f.win.dispatch('keydown',advance);
  assert.equal(advance.defaultPrevented,true);assert.deepEqual(f.effects,['advance']);
  f.win.dispatch('keydown',f.event({key:'w',code:'KeyW',repeat:true}));assert.deepEqual(f.effects,['advance']);
  f.element('advanceButton').onclick();assert.deepEqual(f.effects,['advance','advance']);
  f.win.dispatch('keydown',f.event({key:'a',code:'KeyA'}));assert.equal(f.effects.at(-1),'attackNearest');
  f.win.dispatch('keydown',f.event({key:'W',code:'KeyW',shiftKey:true}));
  assert.equal(f.actions.get('[data-build="workshop"]').clicks,1);assert.equal(f.effects.filter(x=>x==='advance').length,2);
  for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'DIV',isContentEditable:true}])f.win.dispatch('keydown',f.event({key:'w',code:'KeyW',target}));
  assert.equal(f.effects.filter(x=>x==='advance').length,2);
});

test('Formation advance uses only the selected living owned troops and does not change the click order mode',()=>{
  const f=fixture(),a=f.game.addUnit(0,'infantry',20,20),b=f.game.addUnit(0,'archer',21,20),enemy=f.game.addUnit(1,'infantry',25,20),dead=f.game.addUnit(0,'infantry',22,20);dead.hp=0;
  f.ui.selected=new Set([a.id,b.id,enemy.id,dead.id]);f.ui.formation='wedge';f.context.orderMode='move';f.ui.buildMode='barracks';f.ui.orderMarker={x:0,y:0};
  const calls=[];f.game.advance=(...args)=>{calls.push(args);return {ok:true,message:'Advance together.'};};
  vm.runInContext(extract('advanceAttack'),f.context);f.context.advanceAttack();
  assert.equal(calls.length,1);assert.deepEqual(ids(calls[0][0]),ids([a.id,b.id]));assert.equal(calls[0][1],'wedge');
  assert.equal(f.context.orderMode,'move');assert.equal(f.ui.buildMode,null);assert.equal(f.ui.orderMarker,null);assert.equal(f.messages.at(-1),'Advance together.');
  f.ui.selected.clear();f.context.advanceAttack();assert.equal(calls.length,1);assert.ok(f.messages.at(-1).includes('Select soldiers'));
  f.ui.selected.add(a.id);f.context.menuOpen=true;f.context.advanceAttack();assert.equal(calls.length,1);
});

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

test('Right-clicking enemy building artwork targets that building even when it also closes the drawer',()=>{
  for(const type of ['barracks','keep','tower']){
    const f=fixture(),u=f.game.addUnit(0,'infantry',26,30),building=f.game.addBuilding(1,type,30,30);f.ui.selected.add(u.id);f.context.battleHud.isOpen=true;
    // Click the top of the building sprite, several world cells above its ground tile.
    const click=f.event({clientX:400,clientY:250});f.canvas.dispatch('pointerdown',click);f.canvas.dispatch('pointerup',click);
    assert.equal(f.commands.length,1,type);assert.equal(u.order.mode,'attack',type);assert.equal(u.order.targetId,building.id,type);assert.equal(u.target,building,type);
    assert.equal(f.ui.orderMarker.x,building.x);assert.equal(f.ui.orderMarker.y,building.y);assert.equal(f.ui.orderMarker.mode,'attack');assert.deepEqual(ids(f.ui.selected),[u.id]);
  }
});

test('Right-click ignores allied, hidden, destroyed and eliminated buildings as attack targets',()=>{
  for(const state of ['own','allied','hidden','destroyed','eliminated']){
    const f=fixture(),u=f.game.addUnit(0,'infantry',26,30),building=f.game.addBuilding(state==='own'?0:1,'barracks',30,30);f.ui.selected.add(u.id);
    if(state==='allied')f.game.teams[1].alliance=f.game.teams[0].alliance;
    if(state==='hidden'){f.game.config.fogOfWar=true;f.game.isVisibleTo=()=>false;}
    if(state==='destroyed')building.hp=0;
    if(state==='eliminated')f.game.teams[1].alive=false;
    const click=f.event({clientX:400,clientY:250});f.canvas.dispatch('pointerdown',click);f.canvas.dispatch('pointerup',click);
    assert.equal(f.commands.length,1,state);assert.equal(u.order.mode,'move',state);assert.equal(u.order.targetId,undefined,state);assert.equal(u.target,null,state);
  }
});

test('Right-drag from enemy building artwork remains a facing move and building selection still sets rally',()=>{
  const f=fixture(),u=f.game.addUnit(0,'infantry',26,30),enemy=f.game.addBuilding(1,'barracks',30,30);f.ui.selected.add(u.id);
  const click=f.event({clientX:400,clientY:250});f.canvas.dispatch('pointerdown',click);f.canvas.dispatch('pointermove',f.event({clientX:484,clientY:292}));f.canvas.dispatch('pointerup',f.event({clientX:484,clientY:292}));
  assert.equal(f.commands.length,1);assert.equal(u.order.mode,'move');assert.equal(u.order.targetId,undefined);assert.ok(Number.isFinite(u.order.facingX));
  const own=f.game.addBuilding(0,'barracks',20,20);f.ui.selected.clear();f.ui.selectedBuildings.add(own.id);
  f.canvas.dispatch('pointerdown',click);f.canvas.dispatch('pointerup',click);assert.equal(f.commands.length,1);assert.ok(own.rally);assert.notEqual(own.rally.y,enemy.y);
});

test('Enemy building hit testing uses the owning house artwork and follows camera zoom',()=>{
  const f=fixture(),enemy=f.game.addBuilding(1,'barracks',30,30);f.context.view.zoom=2;
  let house=null;f.context.renderer.getStructureFrame=(type,sigil)=>{house=sigil;return{drawWidth:120,drawHeight:100};};
  assert.equal(f.context.buildingAt({x:510,y:150},true),enemy);assert.equal(house,f.game.teams[1].sigil);
  assert.equal(f.context.buildingAt({x:530,y:150},true),null);assert.equal(f.context.buildingAt({x:400,y:250}),null);
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
  const expectedRegiments={wolf:'winter_pikeman',lion:'shield_bearer',dragon:'shield_bearer',rose:'thornwall_pikeman',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion',flayed:'trebuchet',beacon:'trebuchet',bone:'giant',fish:'sharpshooter',stag:'stormbreaker',kraken:'saltwind_axethrower',bridge:'tollhouse_crossbow',frog:'crannog_spearhand',huntsman:'hornhill_halberdier'};
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
  for(const failed of [null,'loadRegimentArt','loadRegimentBuildings','loadConquestArt','loadReinforcementArt','loadHouseEmblems','loadBridgeArt','loadPaintedTroops','loadPikeBuildings','loadPaintedHeroes']){
    const f=fixture({realMenu:true}),loads=[],errors=[],effects=[];
    f.context.console={warn(){},error:(...args)=>errors.push(args)};f.context.renderer={};
    for(const method of ['loadTroops','loadStructures','loadCampaignArt','loadTerrain','loadHouseArt','loadRegimentArt','loadRegimentBuildings','loadConquestArt','loadReinforcementArt','loadHouseEmblems','loadBridgeArt','loadPaintedTroops','loadPikeBuildings','loadPaintedHeroes','loadLandsArt','loadLandsGround'])f.context.renderer[method]=(...args)=>{loads.push({method,args});return method===failed?Promise.reject(new Error('Missing test artwork')):Promise.resolve();};
    for(const name of ['paintBuildingIcons','paintHousePreview','paintTownHall','fitMap','updateHud'])f.context[name]=()=>effects.push(name);
    f.context.frame=()=>{};f.context.requestAnimationFrame=()=>effects.push('frame');
    for(const prefix of ['const HOUSE_ART_SOURCES=','const REGIMENT_ART_SOURCES=','const CONQUEST_ART_SOURCES=','const REINFORCEMENT_ART_SOURCES=','const PAINTED_TROOP_SOURCES=','const HERO_ART_SOURCES=']){const line=source.split('\n').find(line=>line.startsWith(prefix));assert.ok(line);vm.runInContext(line,f.context);}
    vm.runInContext(extract('boot'),f.context);const boot=f.context.boot();assert.equal(f.element('startButton').disabled,true);assert.ok(f.element('startButton').innerHTML.includes('PREPARING'));
    await boot;
    const sheets=loads.find(load=>load.method==='loadRegimentArt')?.args[0];assert.ok(sheets);assert.deepEqual(Object.keys(sheets).sort(),['bear','dragon','falcon','lion','rose','sun','wolf']);assert.equal(new Set(Object.values(sheets)).size,7);
    assert.equal(loads.find(load=>load.method==='loadRegimentBuildings')?.args[0],'assets/regiments/production-buildings.png');
    assert.equal(Object.keys(loads.find(load=>load.method==='loadPaintedHeroes')?.args[0]||{}).length,16);
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

test('Z and Shift+D preview without ordering, Enter confirms from a focused control, and Escape cancels',()=>{
  const f=fixture(),troops=Array.from({length:12},(_,i)=>f.game.addUnit(0,i<8?'winter_pikeman':'river_ranger',30,30+i*.1));f.ui.selected=new Set(troops.map(u=>u.id));
  f.win.dispatch('keydown',f.event({key:'z',code:'KeyZ'}));assert.equal(f.ui.formMode,true);assert.equal(f.element('formationSheet').hidden,false);assert.equal(f.ui.formPreview.slots.length,12);assert.equal(f.commands.length,0);
  f.win.dispatch('keydown',f.event({key:'3',code:'Digit3'}));assert.equal(f.ui.formPreview.ranks,3);
  f.win.dispatch('keydown',f.event({key:'Enter',code:'Enter',target:{tagName:'SELECT'}}));assert.equal(f.ui.formMode,false);assert.equal(f.commands.length,1);assert.ok(troops.every(u=>u.order.placementId));
  const orders=troops.map(u=>u.order);f.win.dispatch('keydown',f.event({key:'D',code:'KeyD',shiftKey:true}));assert.equal(f.ui.formMode,true);assert.equal(f.ui.faceInPlace,true);
  f.win.dispatch('keydown',f.event({key:'Escape',code:'Escape',target:{tagName:'INPUT'}}));assert.equal(f.ui.formMode,false);assert.equal(f.commands.length,1);troops.forEach((u,i)=>assert.equal(u.order,orders[i]));
});

test('Formation touch placement and pinch do not pan or issue an accidental order',()=>{
  const f=fixture(),u=f.game.addUnit(0,'winter_pikeman',30,30);f.ui.selected.add(u.id);f.context.beginForm();
  const initial={x:f.ui.formPreview.x,y:f.ui.formPreview.y};
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',pointerId:1,clientX:500,clientY:300}));
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',pointerId:2,clientX:600,clientY:300}));assert.deepEqual({x:f.ui.formPreview.x,y:f.ui.formPreview.y},initial,'Beginning a pinch leaves the chosen formation center alone.');
  f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',pointerId:1}));f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',pointerId:2}));assert.equal(f.commands.length,0);
  const camera={x:f.context.view.x,y:f.context.view.y};
  f.canvas.dispatch('pointerdown',f.event({button:0,pointerType:'touch',clientX:550,clientY:350}));f.canvas.dispatch('pointerup',f.event({button:0,pointerType:'touch',clientX:550,clientY:350}));
  assert.deepEqual({x:f.context.view.x,y:f.context.view.y},camera);assert.notDeepEqual({x:f.ui.formPreview.x,y:f.ui.formPreview.y},initial);assert.equal(f.commands.length,0);
});

test('Command group recall restores preset, dimensions and facing-lock preference without issuing orders',()=>{
  const f=fixture(),u=f.game.addUnit(0,'winter_pikeman',30,30);f.ui.selected.add(u.id);f.ui.formation='pike';f.ui.formationOptions={ranks:4,width:3.36,lockFacing:true};f.context.commandGroup(2,true);
  f.ui.formation='loose';f.ui.formationOptions={ranks:1,width:8,lockFacing:false};f.context.commandGroup(2);
  assert.equal(f.ui.formation,'pike');assert.equal(f.ui.formationOptions.ranks,4);assert.equal(f.ui.formationOptions.width,3.36);assert.equal(f.ui.formationOptions.lockFacing,true);assert.equal(f.commands.length,0);
});

test('Plain J opens hero planting without changing mixed-selection soldier orders, while Shift+J remains construction',()=>{
  const f=fixture(),hero=f.game.addUnit(0,'hero',30,30),soldier=f.game.addUnit(0,'infantry',31,30),order=soldier.order;
  f.game.standardFor=()=>({id:9901,hp:300,state:'carrying',carrierId:hero.id});f.ui.selected=new Set([hero.id,soldier.id]);
  f.win.dispatch('keydown',f.event({key:'j',code:'KeyJ'}));assert.equal(f.ui.standardMode.heroId,hero.id);assert.equal(f.commands.length,0);assert.equal(soldier.order,order);
  f.win.dispatch('keydown',f.event({key:'J',code:'KeyJ',shiftKey:true}));assert.equal(f.actions.get('[data-regiment-build]').clicks,1);
  f.win.dispatch('keydown',f.event({key:'Escape',code:'Escape'}));assert.equal(f.ui.standardMode,null);assert.equal(f.commands.length,0);
});

test('A planting click validates through the hero API, preserves invalid placement, and never moves ordinary troops',()=>{
  const f=fixture(),hero=f.game.addUnit(0,'hero',30,30),soldier=f.game.addUnit(0,'infantry',31,30),calls=[];
  f.ui.selected=new Set([hero.id,soldier.id]);f.ui.standardMode={heroId:hero.id};let valid=false;
  f.game.plantStandard=(...args)=>{calls.push(args);return {ok:valid,message:valid?'Planting':'Blocked ground'};};
  const point=worldToScreen(35,35,f.context.view),event=f.event({button:0,clientX:point.x,clientY:point.y,pointerType:'touch'}),camera={...f.context.view};
  f.canvas.dispatch('pointerdown',event);f.canvas.dispatch('pointerup',event);assert.equal(f.ui.standardMode.heroId,hero.id);assert.equal(f.commands.length,0);
  valid=true;f.canvas.dispatch('pointerdown',event);f.canvas.dispatch('pointerup',event);assert.equal(f.ui.standardMode,null);assert.equal(calls.length,2);assert.equal(calls[1][0],hero.id);assert.ok(Math.abs(calls[1][1]-35)<1e-9);assert.ok(Math.abs(calls[1][2]-35)<1e-9);assert.equal(f.commands.length,0);assert.deepEqual(f.context.view,camera);
});

test('J retrieves the existing standard or reforges an absent one, and Escape cancels only the selected hero action',()=>{
  const f=fixture(),hero=f.game.addUnit(0,'hero',30,30),soldier=f.game.addUnit(0,'infantry',31,30),order=soldier.order,calls=[];f.ui.selected=new Set([hero.id,soldier.id]);
  let standard={id:9902,hp:250,state:'planted',carrierId:null};f.game.standardFor=()=>standard;
  f.game.retrieveStandard=id=>{calls.push(['pickup',id]);return {ok:true,message:'Retrieve'};};f.game.reforgeStandard=id=>{calls.push(['reforge',id]);return {ok:true,message:'Reforge'};};
  f.win.dispatch('keydown',f.event({key:'j',code:'KeyJ'}));assert.deepEqual(calls,[['pickup',hero.id]]);
  standard=null;f.win.dispatch('keydown',f.event({key:'j',code:'KeyJ'}));assert.deepEqual(calls.at(-1),['reforge',hero.id]);
  hero.standardAction={kind:'pickup',phase:'handling',progress:1.9,duration:2};f.game.cancelStandard=id=>{calls.push(['cancel',id]);delete hero.standardAction;return {ok:true,message:'Cancelled'};};
  f.win.dispatch('keydown',f.event({key:'Escape',code:'Escape'}));assert.deepEqual(calls.at(-1),['cancel',hero.id]);assert.equal(soldier.order,order);assert.deepEqual(ids(f.ui.selected),[hero.id,soldier.id].sort((a,b)=>a-b));assert.equal(f.commands.length,0);
});

test('Only visible hostile ground standards accept a deliberate target click',()=>{
  const f=fixture(),unit=f.game.addUnit(0,'infantry',30,30);f.ui.selected.add(unit.id);
  const flag={id:9903,type:'standard',team:1,hp:300,state:'planted',carrierId:null,x:34,y:30};f.game.standards=[flag];let visible=false;f.game.isVisibleTo=()=>visible;
  const foot=worldToScreen(flag.x,flag.y,f.context.view),point={x:foot.x,y:foot.y-23};assert.equal(f.context.standardAt(point),null);
  visible=true;assert.equal(f.context.standardAt(point),flag);flag.team=0;assert.equal(f.context.standardAt(point),null);flag.team=1;flag.carrierId=unit.id;assert.equal(f.context.standardAt(point),null);flag.carrierId=null;flag.hp=0;assert.equal(f.context.standardAt(point),null);
});

test('Form at Standard previews around the real pole, preserves preferences, and leaves the hero order untouched',()=>{
  const f=fixture(),hero=f.game.addUnit(0,'hero',40,40),troops=Array.from({length:12},(_,i)=>f.game.addUnit(0,'winter_pikeman',30,30+i*.1)),order=hero.order;
  f.game.standardFor=()=>({id:9904,hp:300,state:'planted',carrierId:null,x:40,y:40});f.ui.selected=new Set([hero.id,...troops.map(u=>u.id)]);f.ui.formation='pike';f.ui.formationOptions={ranks:3,width:1.44,lockFacing:true};
  f.context.beginFormAtStandard();assert.equal(f.ui.formPreview.x,40);assert.equal(f.ui.formPreview.y,40);assert.equal(f.ui.formPreview.slots.length,troops.length);assert.equal(f.ui.formationOptions.width,1.44);assert.equal(f.ui.formationOptions.ranks,3);assert.ok(f.ui.formPreview.slots.every(s=>Math.hypot(s.x-40,s.y-40)>=1.1));
  f.context.confirmFormation();assert.equal(hero.order,order);assert.ok(troops.every(u=>u.order.placementId));assert.equal(f.commands.length,1);assert.ok(!f.commands[0][0].includes(hero.id));
});

test('The persistent hero portrait reports health, return countdown and irreplaceable king death without requiring selection',()=>{
  const f=fixture(),hero=f.game.addUnit(0,'hero',30,30);f.ui.selected.clear();f.context.heroHudPortraitKey='';f.context.renderer.drawHeroPortrait=()=>{};
  vm.runInContext(extract('updateHeroBeacon'),f.context);hero.hp=hero.maxHp/2;f.context.updateHeroBeacon();assert.equal(f.element('heroHudButton').hidden,false);assert.equal(f.element('heroHudHealthFill').style.width,'50%');assert.match(f.element('heroHudHealth').textContent,/HP/);assert.match(f.element('heroHudButton').getAttribute('aria-label'),/Winter Marshal/);
  hero.hp=0;f.game.teams[0].heroTimer=23.2;f.context.updateHeroBeacon();assert.equal(f.element('heroHudHealth').textContent,'Returns in 24s');assert.equal(f.element('heroHudHealthFill').style.width,'0%');
  f.game.mode={kingSurvival:true};f.context.updateHeroBeacon();assert.equal(f.element('heroHudHealth').textContent,'Fallen · one life');assert.doesNotMatch(f.element('heroHudHealth').textContent,/return/i);
});

console.log(`${cases} command control checks passed.`);
