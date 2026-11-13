// Commands open above a persistent corner minimap; the battlefield stays full size.
export function createBattleHud({navigate,onClose=()=>{}}){
 const $=id=>document.getElementById(id),panel=$('commandPanel');
 const titles={build:'Build (B)',army:'Muster (U)',orders:'Orders (O)',map:'Map (M)',council:'Council (C)',realm:'Realm & objectives',settings:'Settings'};
 let pane=null,touchSelect=false;
 function sync(){
  panel.hidden=pane===null;
  document.body.classList.toggle('drawer-open',pane!==null);
  if(pane){panel.dataset.pane=pane;$('drawerTitle').textContent=titles[pane];}
  for(const section of panel.querySelectorAll('[data-hud-pane]'))section.hidden=section.dataset.hudPane!==pane;
  $('drawerNav').hidden=!['council','realm','settings'].includes(pane);
  for(const button of document.querySelectorAll('[data-drawer]')){
   const active=button.dataset.drawer===pane||button.dataset.drawer==='council'&&['realm','settings'].includes(pane);
   button.classList.toggle('active',active);button.setAttribute('aria-expanded',String(active));
  }
  for(const button of document.querySelectorAll('[data-drawer-section]')){
   const active=button.dataset.drawerSection===pane;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
 }
 function close(restoreFocus=false){
  const previous=pane;pane=null;sync();onClose();
  if(restoreFocus){const key=['realm','settings'].includes(previous)?'council':previous;document.querySelector(`[data-drawer="${key}"]`)?.focus({preventScroll:true});}
 }
 function open(name){
  if(!titles[name])return;
  pane=name;sync();$('commandScroll').scrollTop=0;$('closeDrawer').focus({preventScroll:true});
 }
 for(const button of document.querySelectorAll('[data-drawer]'))button.addEventListener('click',()=>{
  const active=pane===button.dataset.drawer||button.dataset.drawer==='council'&&['realm','settings'].includes(pane);
  if(active)close(true);else navigate(button.dataset.drawer);
 });
 for(const button of document.querySelectorAll('[data-drawer-section]'))button.addEventListener('click',()=>navigate(button.dataset.drawerSection));
 $('closeDrawer').addEventListener('click',()=>close(true));
 $('touchModeButton').addEventListener('click',()=>{
  touchSelect=!touchSelect;$('touchModeButton').textContent=touchSelect?'Drag: Select':'Drag: Pan';
  $('touchModeButton').setAttribute('aria-pressed',String(touchSelect));
 });
 sync();
 return {open,close,get isOpen(){return pane!==null;},get touchSelect(){return touchSelect;},syncSelection(kind,count){
  document.body.dataset.hasSelection=String(count>0);document.body.dataset.selectionKind=kind;
  $('selectionCommands').textContent=kind==='building'?'Rally / upgrade (O)':'Commands (O)';
  $('selectionCommands').setAttribute('aria-expanded',String(pane==='orders'));
 }};
}
