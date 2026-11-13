import assert from 'node:assert/strict';
import {createBattleHud} from '../../hud.js';

class Element{
 constructor(dataset={}){this.dataset=dataset;this.hidden=false;this.attributes=new Map();this.listeners=new Map();this.classes=new Set();this.focused=0;this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 addEventListener(type,listener){this.listeners.set(type,listener);}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key);}
 click(){this.listeners.get('click')?.();}
 focus(){this.focused++;}
}
function fixture(){
 const ids=new Map(),element=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
 const panes=['build','army','orders','map','council','realm','settings','realm','orders'].map(hudPane=>new Element({hudPane}));
 const dock=['build','army','orders','map','council'].map(drawer=>new Element({drawer}));
 const sections=['council','realm','settings'].map(drawerSection=>new Element({drawerSection}));
 const body=new Element(),navigation=[];let closed=0,hud;
 element('commandPanel').querySelectorAll=()=>panes;
 globalThis.document={body,getElementById:element,querySelectorAll:selector=>selector==='[data-drawer]'?dock:sections,querySelector:selector=>dock.find(button=>selector===`[data-drawer="${button.dataset.drawer}"]`)||null};
 hud=createBattleHud({navigate:name=>{navigation.push(name);hud.open(name);},onClose:()=>closed++});
 return {hud,element,panes,dock,sections,body,navigation,get closed(){return closed;}};
}
let cases=0;
const test=(name,fn)=>{try{fn();cases++;console.log('PASS '+name);}finally{delete globalThis.document;}};

test('HUD starts closed and each drawer exposes only its own controls',()=>{
 const f=fixture();assert.equal(f.hud.isOpen,false);assert.equal(f.element('commandPanel').hidden,true);assert.ok(f.panes.every(p=>p.hidden));
 for(const button of f.dock){
  button.click();assert.equal(f.hud.isOpen,true);assert.equal(f.element('commandPanel').dataset.pane,button.dataset.drawer);
  assert.ok(f.panes.every(p=>p.hidden===(p.dataset.hudPane!==button.dataset.drawer)));
  assert.equal(f.dock.filter(b=>b.getAttribute('aria-expanded')==='true').length,1);
  assert.equal(f.element('closeDrawer').focused,f.navigation.length);
  button.click();assert.equal(f.hud.isOpen,false);assert.equal(button.getAttribute('aria-expanded'),'false');
 }
});

test('More subpanels retain their navigation and restore focus to More when dismissed',()=>{
 const f=fixture(),more=f.dock.find(b=>b.dataset.drawer==='council');more.click();
 for(const button of f.sections){
  f.element('commandScroll').scrollTop=900;button.click();
  assert.equal(f.element('drawerNav').hidden,false);assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(more.getAttribute('aria-expanded'),'true');assert.equal(f.element('commandScroll').scrollTop,0);
 }
 f.element('closeDrawer').click();assert.equal(f.hud.isOpen,false);assert.equal(more.focused,1);assert.equal(f.closed,1);
 more.click();f.sections.find(button=>button.dataset.drawerSection==='realm').click();more.click();assert.equal(f.hud.isOpen,false,'The active More dock button dismisses its subpanels too.');
});

test('Selection state distinguishes rally controls and disappears when nothing is selected',()=>{
 const f=fixture();f.hud.syncSelection('building',1);
 assert.equal(f.body.dataset.hasSelection,'true');assert.equal(f.body.dataset.selectionKind,'building');assert.equal(f.element('selectionCommands').textContent,'Rally / upgrade');
 f.hud.open('orders');f.hud.syncSelection('army',40);
 assert.equal(f.element('selectionCommands').textContent,'Commands');assert.equal(f.element('selectionCommands').getAttribute('aria-expanded'),'true');
 f.hud.close();f.hud.syncSelection('army',0);assert.equal(f.body.dataset.hasSelection,'false');assert.equal(f.element('selectionCommands').getAttribute('aria-expanded'),'false');
});

test('Pan is the default and touch selection requires an explicit toggle',()=>{
 const f=fixture();assert.equal(f.hud.touchSelect,false);
 f.element('touchModeButton').click();assert.equal(f.hud.touchSelect,true);assert.equal(f.element('touchModeButton').getAttribute('aria-pressed'),'true');
 f.hud.open('build');f.hud.close();assert.equal(f.hud.touchSelect,true,'Opening or closing a drawer preserves the chosen drag mode.');
 f.element('touchModeButton').click();assert.equal(f.hud.touchSelect,false);assert.equal(f.element('touchModeButton').textContent,'Drag: Pan');
});

console.log(`${cases} HUD state checks passed.`);
