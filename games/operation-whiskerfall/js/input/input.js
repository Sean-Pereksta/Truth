(function () {
  'use strict';
  window.OW = window.OW || {};
  const defaults = {
    up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',shoot:'Mouse0',melee:'Mouse2',heavy:'ShiftLeft',dodge:'Space',interact:'KeyE',ability:'KeyQ',ability2:'KeyF',grenade:'KeyG',reload:'KeyR',switchWeapon:'Tab',consumable:'KeyC',inventory:'KeyI',map:'KeyM',journal:'KeyJ',skills:'KeyK',pause:'Escape',
    p2up:'ArrowUp',p2down:'ArrowDown',p2left:'ArrowLeft',p2right:'ArrowRight',p2shoot:'Numpad0',p2melee:'Numpad1',p2heavy:'NumpadAdd',p2dodge:'Numpad2',p2interact:'Numpad3',p2ability:'Numpad4',p2ability2:'Numpad5',p2grenade:'Numpad6',p2reload:'Numpad7',p2switchWeapon:'Numpad8',p2consumable:'Numpad9',p2inventory:'NumpadDivide',p2skills:'NumpadMultiply'
  };
  const padDefaults = { shoot:7,melee:2,dodge:0,interact:1,ability:3,ability2:6,grenade:5,switchWeapon:4,reload:13,consumable:12,selectAbility:14,selectSecondaryAbility:15,inventory:8,pause:9,swapSticks:false };
  const actions = ['shoot','melee','dodge','interact','ability','ability2','grenade','reload','switchWeapon','consumable'];
  class Input {
    constructor(canvas) {
      this.canvas=canvas;this.keys=new Set();this.pressed=new Set();this.mouse={x:0,y:0,seen:false,lastMove:0};this.padAssignments=new Map();this.padPrevious=new Map();this.padEdges=new Map();this.padMenuRepeat=new Map();this.padBlockedButtons=new Map();this.padMeleeStart=new Map();this.padLastUse=new Map();this.padHasAimed=new Map();this.padAimDistance=[180,180];this.padAim=[{x:1,y:0},{x:1,y:0}];this.keyboardAim=[{x:1,y:0},{x:1,y:0}];this.lastKeyboard=0;this.lastPadUse=0;this.capture=null;this.snapshot=new Set();
      try {const data=JSON.parse(localStorage.getItem('whiskerfall.controls')||'{}');this.bindings={...defaults,...data.keys};this.padBindings={...padDefaults,...data.pad};}catch(_){this.bindings={...defaults};this.padBindings={...padDefaults};}
      window.addEventListener('keydown',e=>{
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !this.capture) return;
        if(this.capture&&e.code==='Escape'){e.preventDefault();this.capture.callback(null);this.capture=null;this.clear();return;}
        if(this.capture&&this.capture.type==='key'){e.preventDefault();if(e.code==='Escape')this.capture.callback(null);else{this.bindings[this.capture.action]=e.code;this.persist();this.capture.callback(e.code);}this.capture=null;this.clear();return;}
        if(!this.keys.has(e.code))this.pressed.add(e.code);this.keys.add(e.code);this.lastKeyboard=performance.now();
        if(Object.values(this.bindings).includes(e.code)||['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)||OW.game?.ui?.personalKeyboardConsumes?.(e.code))e.preventDefault();
      });
      window.addEventListener('keyup',e=>this.keys.delete(e.code));
      window.addEventListener('pointerdown',e=>{if(!this.capture||this.capture.type!=='key')return;e.preventDefault();e.stopPropagation();const binding='Mouse'+e.button;this.bindings[this.capture.action]=binding;this.persist();const callback=this.capture.callback;this.capture=null;this.clear();callback(binding);},true);
      canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();this.mouse.x=e.clientX-r.left;this.mouse.y=e.clientY-r.top;this.mouse.seen=true;this.mouse.lastMove=performance.now();});
      canvas.addEventListener('pointerdown',e=>{if(this.capture&&this.capture.type==='key'){const c='Mouse'+e.button;this.bindings[this.capture.action]=c;this.persist();this.capture.callback(c);this.capture=null;return;}const key='Mouse'+e.button;if(!this.keys.has(key))this.pressed.add(key);this.keys.add(key);this.lastKeyboard=performance.now();canvas.focus();});
      window.addEventListener('pointerup',e=>this.keys.delete('Mouse'+e.button));
      canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();if(OW.game&&OW.game.state==='playing'&&!OW.game.ui.isOpen)OW.game.ui.showMenu('pause');}});
      window.addEventListener('gamepaddisconnected',e=>{this.padAssignments.delete(e.gamepad.index);this.padPrevious.delete(e.gamepad.index);if(OW.game&&OW.game.ui)OW.game.ui.toast('Controller disconnected. Keyboard controls remain available.');});
    }
    clear(){this.keys.clear();this.pressed.clear();this.snapshot.clear();}
    persist(){try{localStorage.setItem('whiskerfall.controls',JSON.stringify({keys:this.bindings,pad:this.padBindings}));}catch(_) {}}
    resetBindings(){this.bindings={...defaults};this.padBindings={...padDefaults};this.persist();}
    remap(action,type,callback){this.capture={action,type,callback};this.clear();}
    connectedPads(){try{return Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(p=>p&&p.connected);}catch(_){return [];}}
    update(game){
      this.snapshot=new Set(this.pressed);this.pressed.clear();this.pads=this.connectedPads();this.padEdges.clear();
      const ui=game.ui,menuWasOpen=!!ui?.isOpen;
      for(const pad of this.pads){
        const previous=this.padPrevious.get(pad.index)||[];const held=pad.buttons.map(b=>b.pressed||b.value>.5);const edge=held.map((v,i)=>v&&!previous[i]);this.padEdges.set(pad.index,edge);this.padPrevious.set(pad.index,held);if(held[this.padBindings.melee]){if(!this.padMeleeStart.has(pad.index))this.padMeleeStart.set(pad.index,performance.now());}else this.padMeleeStart.delete(pad.index);
        const blocked=this.padBlockedButtons.get(pad.index)||new Set();for(const button of blocked)if(!held[button])blocked.delete(button);if(menuWasOpen||ui?.isOpen)held.forEach((pressed,button)=>{if(pressed)blocked.add(button);});this.padBlockedButtons.set(pad.index,blocked);
        if(this.capture&&this.capture.type==='pad'){const b=edge.findIndex(Boolean);if(b>=0){this.padBindings[this.capture.action]=b;this.persist();this.capture.callback(b);this.capture=null;}continue;}
        if(!this.padAssignments.has(pad.index)){
          const taken=new Set(this.padAssignments.values());const assign=taken.has(0)?1:0;this.padAssignments.set(pad.index,assign);
        }
        let playerIndex=this.padAssignments.get(pad.index);
        const moving=pad.axes.slice(0,4).some(axis=>Math.abs(axis||0)>.2)||held.some((v,i)=>v&&i!==9);
        if(moving){this.lastPadUse=performance.now();this.padLastUse.set(pad.index,this.lastPadUse);}
        if(ui?.handleCoopPadInput?.(this,pad,edge,held,playerIndex,blocked))continue;
        if(edge[this.padBindings.pause]){
          if(ui){
            held.forEach((pressed,button)=>{if(pressed)blocked.add(button);});
            if(game.state==='playing'){if(ui.isOpen)ui.hideMenu();else ui.showMenu('pause',Math.min(playerIndex,game.players.length-1));}
            else if(ui.isOpen&&ui.menu!=='main')ui.handlePad('back',playerIndex);
          }continue;
        }
        if(ui&&ui.isOpen){
          const t=performance.now(),repeat=this.padMenuRepeat.get(pad.index)||{next:0,dir:''};let dir='';
          if(held[12]||(pad.axes[1]||0)<-.55)dir='up';else if(held[13]||(pad.axes[1]||0)>.55)dir='down';else if(held[14]||(pad.axes[0]||0)<-.55)dir='left';else if(held[15]||(pad.axes[0]||0)>.55)dir='right';
          if(dir&&(dir!==repeat.dir||t>repeat.next)){ui.handlePad(dir,playerIndex);repeat.next=t+(dir!==repeat.dir?330:150);}repeat.dir=dir;this.padMenuRepeat.set(pad.index,repeat);
          if(edge[0])ui.handlePad('confirm',playerIndex);if(edge[1])ui.handlePad('back',playerIndex);if(edge[4])ui.handlePad('previous',playerIndex);if(edge[5])ui.handlePad('next',playerIndex);
        }else {
          if(edge[this.padBindings.inventory]&&ui)ui.showMenu('inventory',playerIndex);
          if(edge[this.padBindings.selectAbility])this.cycleAbility(game,playerIndex,'ability');
          if(edge[this.padBindings.selectSecondaryAbility])this.cycleAbility(game,playerIndex,'ability2');
        }
      }
      if(this.capture)return;
      if(ui?.handleCoopKeyboardInput?.(this))return;
      if(ui&&this.snapshot.has(this.bindings.pause)){if(ui.isOpen&&game.state!=='menu')ui.hideMenu();else if(ui.isOpen&&game.state==='menu'&&ui.menu!=='main'){ui.menu='main';ui.render();}else if(game.state==='playing')ui.showMenu('pause');}
      if(ui&&game.state==='playing')for(const name of ['inventory','map','journal','skills'])if(this.snapshot.has(this.bindings[name])){if(ui.isOpen&&ui.menu===name)ui.hideMenu();else ui.showMenu(name);}
      if(ui&&ui.isOpen){if(this.snapshot.has('Enter'))ui.handlePad('confirm',0);if(this.snapshot.has('ArrowUp'))ui.handlePad('up',0);if(this.snapshot.has('ArrowDown'))ui.handlePad('down',0);if(this.snapshot.has('ArrowLeft'))ui.handlePad('left',0);if(this.snapshot.has('ArrowRight'))ui.handlePad('right',0);}
    }
    cycleAbility(game,index,slot){const p=game.players[index];if(!p||!game.equipAbility)return;if(game.cycleAbility){game.cycleAbility(p,slot);return;}const choices=OW.Content.abilities.map((a,i)=>({a,i})).filter(v=>p.level>=(v.a.level||1));if(!choices.length)return;const current=choices.findIndex(v=>v.i===p[slot]),next=choices[(current+1)%choices.length];game.equipAbility(index,next.i,slot);}
    forPlayer(index,game){
      const result={mx:0,my:0,aimX:0,aimY:0,usingController:false,aimDistance:180,aiming:false,shoot:false,melee:false,heavy:false,dodge:false,interact:false,ability:false,ability2:false,grenade:false,reload:false,switchWeapon:false,consumable:false};
      if((game.ui&&game.ui.isOpen)||game.paused||this.capture)return result;
      const prefix=index?'p2':'';const key=action=>this.bindings[prefix+action];
      result.mx=(this.keys.has(key('right'))?1:0)-(this.keys.has(key('left'))?1:0);result.my=(this.keys.has(key('down'))?1:0)-(this.keys.has(key('up'))?1:0);
      for(const action of actions){const binding=key(action),held=action==='shoot'||action==='melee';result[action]=this.snapshot.has(binding)||(held&&this.keys.has(binding));}
      result.heavy=this.keys.has(key('heavy'))||(!index&&this.keys.has('ShiftRight'));
      if(index===0&&this.mouse.seen){const p=game.players[0];const r=this.canvas.getBoundingClientRect();const camera=game.camera;let ax=(this.mouse.x-r.width/2)/(camera.zoom||1)+camera.x-p.x,ay=(this.mouse.y-r.height/2)/(camera.zoom||1)+camera.y-p.y;const length=Math.hypot(ax,ay);if(length>1){result.aimX=ax/length;result.aimY=ay/length;this.keyboardAim[0]={x:result.aimX,y:result.aimY};}}
      else if(result.mx||result.my){const d=Math.hypot(result.mx,result.my);result.aimX=result.mx/d;result.aimY=result.my/d;this.keyboardAim[index]={x:result.aimX,y:result.aimY};}
      else {result.aimX=this.keyboardAim[index].x;result.aimY=this.keyboardAim[index].y;}
      for(const pad of this.pads||[]){if(this.padAssignments.get(pad.index)!==index)continue;const edge=this.padEdges.get(pad.index)||[];const axis=v=>Math.abs(v||0)>.18?v:0;const moveOffset=this.padBindings.swapSticks?2:0,aimOffset=this.padBindings.swapSticks?0:2;const mx=axis(pad.axes[moveOffset]),my=axis(pad.axes[moveOffset+1]);if(mx||my){result.mx=mx;result.my=my;}const ax=axis(pad.axes[aimOffset]),ay=axis(pad.axes[aimOffset+1]);result.usingController=true;if(Math.hypot(ax,ay)>.2){const d=Math.hypot(ax,ay);this.padAim[index]={x:ax/d,y:ay/d};this.padHasAimed.set(pad.index,true);this.padAimDistance[index]=100+Math.min(1,d)*160;result.aiming=true;}else if((mx||my)&&!result.shoot&&!this.padHasAimed.get(pad.index)){const d=Math.hypot(mx,my);this.padAim[index]={x:mx/d,y:my/d};}if(index||(this.padLastUse.get(pad.index)||0)>=Math.max(this.lastKeyboard,this.mouse.lastMove)){result.aimX=this.padAim[index].x;result.aimY=this.padAim[index].y;}result.aimDistance=this.padAimDistance[index];if(this.padMeleeStart.has(pad.index)&&performance.now()-this.padMeleeStart.get(pad.index)>450)result.heavy=true;
        for(const action of actions){const b=this.padBindings[action];if(b===undefined||this.padBlockedButtons.get(pad.index)?.has(b))continue;const held=pad.buttons[b]&&(pad.buttons[b].pressed||pad.buttons[b].value>.4);result[action]=result[action]||(action==='shoot'||action==='melee'?held:!!edge[b]);}
      }
      const d=Math.hypot(result.mx,result.my);if(d>1){result.mx/=d;result.my/=d;}return result;
    }
    static keyName(code){if(!code)return'Unbound';return String(code).replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ').replace('Mouse0','Left mouse').replace('Mouse1','Middle mouse').replace('Mouse2','Right mouse').replace('Arrow','').replace('Space','Spacebar');}
    static padName(button){return ['A / Cross','B / Circle','X / Square','Y / Triangle','LB / L1','RB / R1','LT / L2','RT / R2','View / Select','Start / Menu','L3','R3','D-pad up','D-pad down','D-pad left','D-pad right','Home'][button]||('Button '+button);}
  }
  OW.Input=Input;
})();
