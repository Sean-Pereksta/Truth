(function(){
  'use strict';
  const W=window.OW,U=W.UI?.prototype,G=W.Game?.prototype;if(!G||typeof U?.render!=='function'||typeof U?.inventoryMenu!=='function')return;
  const old={show:U.showMenu,hide:U.hideMenu,render:U.render,click:U.click,pad:U.handlePad,focus:U.setControllerFocus,player:U.player,tabs:U.playerTabs,controls:U.controlsMenu};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const personal=name=>name==='inventory'||name==='skills';
  const rootOf=ui=>ui.coopRoot||ui;
  const openPanes=ui=>(ui.personalMenus||[]).filter(p=>p?.isOpen&&ui.game.players[p.personalOwner]===p.personalHero);
  const eligible=ui=>ui.game.state==='playing'&&(ui.game.players.length>1||openPanes(ui).length>0);
  const title=menu=>menu==='skills'?'Skills & abilities':'Inventory & equipment';
  const heroLabel=(ui,index)=>'Player '+(index+1)+' · '+(ui.game.players[index]?.skin?'Ash':'Clover');
  const key=(ui,owner,action)=>W.Input.keyName(ui.game.input?.bindings?.[(owner?'p2':'')+action]);
  const personalActions=new Set(['close','menu','filter','item','equip','equip-secondary-firearm','equip-secondary','gear-loadout-inspect','ability-loadout-inspect','abilities','ability-primary','ability-secondary','ability-inspect','ability-unlock','ability-upgrade','ability-ranks-reset','skill-category','training-inspect','skill']);
  function paneValid(pane){const root=pane.coopRoot;return root&&pane.isOpen&&!root.personalSuspended&&root.menu==='coop-personal'&&root.personalMenus?.[pane.personalOwner]===pane&&root.game.players[pane.personalOwner]===pane.personalHero;}
  function scopedIds(html,owner){
    const prefix='coop-p'+owner+'-';
    return html.replace(/\sid="([^"]+)"/g,(_,id)=>' id="'+prefix+id+'"').replace(/\s(aria-describedby|aria-labelledby|for)="([^"]+)"/g,(_,attr,value)=>' '+attr+'="'+value.split(/\s+/).map(id=>prefix+id).join(' ')+'"');
  }
  function makePane(root,owner){
    const pane=Object.create(U);
    Object.assign(pane,{game:root.game,root:root.root,hud:root.hud,host:root.personalHosts[owner],coopRoot:root,personalOwner:owner,personalHero:root.game.players[owner],isOpen:false,menu:'inventory',filter:'all',itemId:null,skillsCategory:'all',selectedAbility:null,selectedTraining:null,controllerFocus:[null,null],activeController:owner,lastNavigation:'mouse'});
    // Existing handlers all use playerIndex. It cannot be retargeted by another
    // controller, a forged player-tab event, or a shared global menu selection.
    Object.defineProperty(pane,'playerIndex',{get:()=>owner,set:()=>{},enumerable:true});
    pane.sound=()=>root.sound();pane.toast=(...args)=>root.toast(...args);
    return pane;
  }
  U.personalMenuFor=function(owner){return rootOf(this).personalMenus?.[owner]||null;};
  U.ensurePersonalShell=function(){
    const root=rootOf(this);if(root.personalShell)return;
    root.personalMenus=[null,null];
    const shell=document.createElement('div');shell.className='coop-menu-shell';shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Personal equipment menus · gameplay paused');
    shell.innerHTML='<div class="coop-menu-banner"><span><strong>Prepare together</strong> Gameplay is paused until both personal menus are closed.</span><button data-action="menu" data-value="pause">Camp & settings <kbd>Esc</kbd></button></div><div class="coop-menu-columns"><div class="coop-player-host" data-coop-owner="0"></div><div class="coop-player-host" data-coop-owner="1"></div></div>';
    root.personalShell=shell;root.personalHosts=[shell.querySelector('[data-coop-owner="0"]'),shell.querySelector('[data-coop-owner="1"]')];
  };
  U.renderPersonalMenus=function(){
    const root=rootOf(this);root.ensurePersonalShell();
    root.menu='coop-personal';root.isOpen=true;root.personalSuspended=false;root.game.paused=true;
    root.personalShell.classList.toggle('one-hero',root.game.players.length<2);
    for(let owner=0;owner<2;owner++){
      const host=root.personalHosts[owner],p=root.game.players[owner],pane=root.personalMenus[owner];host.hidden=!p;
      if(!p){if(pane){pane.isOpen=false;pane.controllerFocus=[null,null];}root.personalMenus[owner]=null;host.innerHTML='';continue;}
      if(pane?.isOpen&&pane.personalHero===p){if(!host.firstElementChild)pane.render();continue;}
      host.innerHTML=`<section class="coop-waiting" aria-label="${escape(heroLabel(root,owner))} menu closed"><span class="eyebrow">${escape(heroLabel(root,owner))}</span><h2>Your field kit</h2><p>Open your own inventory or skills while your teammate prepares.</p><button data-action="coop-open" data-owner="${owner}" data-value="inventory">Open inventory <kbd>${escape(key(root,owner,'inventory'))}</kbd></button><button data-action="coop-open" data-owner="${owner}" data-value="skills">Open skills <kbd>${escape(key(root,owner,'skills'))}</kbd></button><small>Controller: View / Select opens your inventory. Y opens skills while these personal menus are on screen.</small></section>`;
    }
    if(root.host.firstElementChild!==root.personalShell)root.host.replaceChildren(root.personalShell);
  };
  U.openPersonalMenu=function(owner=0,name='inventory'){
    const root=rootOf(this);owner=Number(owner);if(!personal(name)||!Number.isInteger(owner)||!root.game.players[owner]||root.game.state!=='playing')return false;
    // Personal panels bypass the shared showMenu wrappers. Defer an active
    // discovery with the same cleanup while leaving its earned receipt queued.
    if(root.menu==='discovery')root.activeDiscoveryId=null;
    root.ensurePersonalShell();let pane=root.personalMenus[owner];
    if(!pane||pane.personalHero!==root.game.players[owner])pane=root.personalMenus[owner]=makePane(root,owner);
    const changed=pane.menu!==name;pane.menu=name;pane.isOpen=true;if(changed)pane.controllerFocus=[null,null];
    root.sound();root.renderPersonalMenus();pane.render();return true;
  };
  U.closePersonalMenu=function(owner){
    const root=rootOf(this),pane=root.personalMenus?.[owner];if(!pane)return;
    pane.isOpen=false;pane.controllerFocus=[null,null];root.sound();
    if(root.personalSuspended)return;
    if(openPanes(root).length)root.renderPersonalMenus();
    else{root.isOpen=false;root.menu='inventory';root.game.paused=false;root.host.replaceChildren();root.game.input?.clear();document.getElementById('game')?.focus();}
  };
  U.clearPersonalMenus=function(){
    const root=rootOf(this);for(const pane of root.personalMenus||[])if(pane){pane.isOpen=false;pane.controllerFocus=[null,null];}
    root.personalMenus=null;root.personalShell=null;root.personalHosts=null;root.personalSuspended=false;
  };
  U.player=function(){return this.coopRoot?this.game.players[this.personalOwner]||null:old.player.call(this);};
  U.playerTabs=function(){
    if(!this.coopRoot)return old.tabs.call(this);
    const p=this.player();if(!p)return'';
    return `<div class="player-tabs coop-owner-summary"><strong>${escape(heroLabel(this,this.personalOwner))} · Level ${p.level}</strong><span class="wallet">${Math.floor(p.gold||0)} gold · ${Math.floor(p.materials||0)} scrap · ${p.cores||0} cores</span></div>`;
  };
  U.showMenu=function(name='pause',owner){
    const root=rootOf(this);if(this.coopRoot)owner=this.personalOwner;
    if(personal(name)&&eligible(root))return root.openPersonalMenu(owner??root.playerIndex??0,name);
    if(openPanes(root).length)root.personalSuspended=true;
    return old.show.call(root,name,owner);
  };
  U.hideMenu=function(){
    const root=rootOf(this);
    if(this.coopRoot)return root.closePersonalMenu(this.personalOwner);
    if(root._coopTransition||root.game.state!=='playing'){root.clearPersonalMenus();return old.hide.call(root);}
    if(openPanes(root).length){root.renderPersonalMenus();return;}
    return old.hide.call(root);
  };
  U.render=function(){
    if(this.coopRoot){
      if(!this.isOpen||this.game.players[this.personalOwner]!==this.personalHero)return;
      const remembered=this.controllerFocus.map(control=>this.focusKey(control)),owner=this.personalOwner;
      const html=`<section class="panel coop-personal-panel" role="region" aria-label="${escape(heroLabel(this,owner)+' '+title(this.menu))}"><header class="panel-header"><div><div class="eyebrow">${escape(heroLabel(this,owner))}</div><h2>${title(this.menu)}</h2></div><button class="close" data-action="close" aria-label="Close Player ${owner+1} menu">Done</button></header><nav class="panel-nav" aria-label="Player ${owner+1} personal menus">${[['inventory','Inventory'],['skills','Skills']].map(([id,label])=>`<button data-action="menu" data-value="${id}" class="${this.menu===id?'selected':''}" aria-pressed="${this.menu===id}">${label}</button>`).join('')}</nav><div class="panel-content">${this.menu==='skills'?this.skillsMenu():this.inventoryMenu(false)}</div><footer class="panel-footer"><span>${owner?'Arrows · Num Enter select · Num − close':'WASD · Enter select · Backspace close'}</span><span>A select · B / Start close · Y skills · LB / RB tabs</span></footer></section>`;
      this.host.innerHTML=scopedIds(html,owner);this.restoreFocus(remembered);return;
    }
    if(this.game.state!=='playing'&&this.personalShell)this.clearPersonalMenus();
    if(this.menu==='coop-personal'&&openPanes(this).length)return this.renderPersonalMenus();
    return old.render.call(this);
  };
  U.setControllerFocus=function(control,index=0){return old.focus.call(this,control,this.coopRoot?this.personalOwner:index);};
  U.handlePad=function(action,owner=0){
    if(this.coopRoot){if(!paneValid(this)||owner!==this.personalOwner)return;return old.pad.call(this,action,owner);}
    if(this.menu==='coop-personal')return this.personalMenus?.[owner]?.handlePad(action,owner);
    // Global menus are shared; their personal-menu link belongs to the player
    // operating it. This never changes an already-open personal pane's owner.
    if(this.game.state==='playing'&&this.game.players[owner]&&this.playerIndex!==owner){
      this.playerIndex=owner;
      if(['shop','forge','dialogue','bounty'].includes(this.menu))this.render();
    }
    return old.pad.call(this,action,owner);
  };
  U.click=function(event){
    const button=event.target?.closest?.('button[data-action]');
    if(this.coopRoot){
      if(!paneValid(this)||!this.host.contains(event.target)||!button||button.disabled||!personalActions.has(button.dataset.action))return;
      if(button.dataset.action==='menu'&&!personal(button.dataset.value))return;
      return old.click.call(this,event);
    }
    const ownerHost=event.target?.closest?.('[data-coop-owner]');
    if(ownerHost&&this.menu==='coop-personal'){
      if(button?.dataset.action==='coop-open'&&!button.disabled)return this.openPersonalMenu(Number(button.dataset.owner),button.dataset.value);
      return this.personalMenus?.[Number(ownerHost.dataset.coopOwner)]?.click(event);
    }
    return old.click.call(this,event);
  };
  U.handleCoopPadInput=function(input,pad,edge,held,owner,blocked){
    if(!eligible(this)||input.capture)return false;
    const personalView=this.menu==='coop-personal'&&this.isOpen;
    if(edge[input.padBindings.inventory]){
      if(!this.game.players[owner])return true;
      held.forEach((down,i)=>{if(down)blocked.add(i);});
      const pane=this.personalMenus?.[owner];if(personalView&&pane?.isOpen&&pane.menu==='inventory')this.closePersonalMenu(owner);else this.openPersonalMenu(owner,'inventory');return true;
    }
    if(!personalView)return false;
    held.forEach((down,i)=>{if(down)blocked.add(i);});
    if(!this.game.players[owner])return true;
    if(edge[input.padBindings.pause]){if(this.personalMenus?.[owner]?.isOpen)this.closePersonalMenu(owner);else this.showMenu('pause',owner);return true;}
    if(edge[3]){this.openPersonalMenu(owner,'skills');return true;}
    const pane=this.personalMenus?.[owner];if(!pane?.isOpen)return true;
    const t=performance.now(),repeat=input.padMenuRepeat.get(pad.index)||{next:0,dir:''};let dir='';
    if(held[12]||(pad.axes[1]||0)<-.55)dir='up';else if(held[13]||(pad.axes[1]||0)>.55)dir='down';else if(held[14]||(pad.axes[0]||0)<-.55)dir='left';else if(held[15]||(pad.axes[0]||0)>.55)dir='right';
    if(dir&&(dir!==repeat.dir||t>repeat.next)){this.handlePad(dir,owner);repeat.next=t+(dir!==repeat.dir?330:150);}repeat.dir=dir;input.padMenuRepeat.set(pad.index,repeat);
    if(edge[0])this.handlePad('confirm',owner);if(edge[1])this.handlePad('back',owner);if(edge[4])this.handlePad('previous',owner);if(edge[5])this.handlePad('next',owner);return true;
  };
  U.handleCoopKeyboardInput=function(input){
    if(!eligible(this)||input.capture)return false;
    const snapshot=new Set(input.snapshot),pressed=code=>!!code&&snapshot.has(code),personalView=()=>this.isOpen&&this.menu==='coop-personal';
    if(pressed(input.bindings.pause)){if(personalView()||!this.isOpen)this.showMenu('pause',0);else this.hideMenu();return true;}
    for(let owner=0;owner<2;owner++)for(const name of ['inventory','skills'])if(this.game.players[owner]&&pressed(input.bindings[(owner?'p2':'')+name])){
      const pane=this.personalMenus?.[owner];if(personalView()&&pane?.isOpen&&pane.menu===name)this.closePersonalMenu(owner);else this.openPersonalMenu(owner,name);
    }
    for(const name of ['map','journal'])if(pressed(input.bindings[name])){if(this.isOpen&&this.menu===name)this.hideMenu();else this.showMenu(name,0);}
    if(personalView()){
      for(let owner=0;owner<2;owner++)if(this.personalMenus?.[owner]?.isOpen){
        for(const action of ['up','down','left','right'])if(pressed(input.bindings[(owner?'p2':'')+action]))this.handlePad(action,owner);
        if(pressed(owner?'NumpadEnter':'Enter'))this.handlePad('confirm',owner);
        if(pressed(owner?'NumpadSubtract':'Backspace'))this.handlePad('back',owner);
      }
    }else if(this.isOpen){for(let owner=0;owner<2;owner++)if(this.game.players[owner]){for(const action of ['up','down','left','right'])if(pressed(input.bindings[(owner?'p2':'')+action]))this.handlePad(action,owner);if(pressed(owner?'NumpadEnter':'Enter'))this.handlePad('confirm',owner);}}
    return true;
  };
  U.personalKeyboardConsumes=function(code){return this.isOpen&&eligible(this)&&['Enter','NumpadEnter','Backspace','NumpadSubtract'].includes(code);};
  U.controlsMenu=function(){
    let html=old.controls.call(this);
    html=html.replace('Select the Player 1 / Player 2 buttons to inspect each hero. Keyboard: arrow keys and Enter.','In co-op, Inventory and Skills open separate player-owned panels. P1: I / K, WASD, Enter, Backspace. P2: Num / / Num *, arrows, Num Enter, Num −. View opens your inventory; Y switches to skills while personal menus are visible. B or Start closes only your own panel. Gameplay resumes after both close. Escape opens shared Camp; returning restores open panels. The same player controls apply in shared menus. Solo menus use arrows and Enter.');
    if(this.controlPlayer===1)html+='<section class="coop-menu-bindings"><h3>Player 2 personal menus</h3>'+[['p2inventory','Inventory'],['p2skills','Skills']].map(([id,label])=>'<div class="control-row"><span>'+label+'</span><button data-action="remap-key" data-value="'+id+'" aria-label="Remap Player 2 '+label+'">'+escape(W.Input.keyName(this.game.input?.bindings[id]))+'</button></div>').join('')+'</section>';
    return html;
  };
  // No UI state is stored on heroes or serialized. Failed loads retain the
  // current UI; a successful load/start drops detached views and their focus.
  for(const name of ['start','load']){const original=G[name];if(!original)continue;G[name]=function(...args){const ui=this.ui,previous=ui?._coopTransition;if(ui)ui._coopTransition=true;try{return original.apply(this,args);}finally{if(ui)ui._coopTransition=previous;}};}
  const toggle=G.toggleCoop;G.toggleCoop=function(...args){const result=toggle.apply(this,args),ui=this.ui;if(ui?.personalMenus){for(let owner=0;owner<2;owner++)if(ui.personalMenus[owner]?.personalHero!==this.players[owner]){const pane=ui.personalMenus[owner];if(pane){pane.isOpen=false;pane.controllerFocus=[null,null];}ui.personalMenus[owner]=null;}if(ui.menu==='coop-personal'){if(openPanes(ui).length)ui.renderPersonalMenus();else{ui.clearPersonalMenus();old.hide.call(ui);}}}return result;};
  W.CoopMenus={personal,openPanes};
}());
