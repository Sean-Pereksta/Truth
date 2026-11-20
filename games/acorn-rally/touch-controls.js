(function(root){
  'use strict';
  const actions={left:'Steer left',right:'Steer right',brake:'Brake',drift:'Drift',item:'Item',ability:'Skill'};
  const marks={left:'◀',right:'▶',brake:'Brake',drift:'Drift',item:'Item',ability:'Skill'};
  const key='acorn-rally-touch-layout-v1', sizes={min:36,max:88};
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const orientation=()=>window.innerWidth>=window.innerHeight?'landscape':'portrait';
  const nativeTouch=()=>matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints>0 && matchMedia('(hover: none)').matches);
  const show=()=>nativeTouch()||matchMedia('(any-pointer: coarse), (max-width: 650px)').matches;
  let saved={},editor=null;
  function read(){
    try{const stored=JSON.parse(localStorage.getItem(key));if(stored&&typeof stored==='object')saved=stored;}catch{}
    return saved;
  }
  function button(action){
    const b=document.createElement('button');b.type='button';b.className='rally-touch-button';
    b.dataset.touchAction=action;b.setAttribute('aria-label',actions[action]);b.textContent=marks[action];return b;
  }
  function frame(plane,layout,action){
    const w=plane.clientWidth,h=plane.clientHeight;
    const base=w>=530?52:48, gap=8, pitch=base+gap;
    const stored=layout?.[action],size=clamp(Number.isFinite(stored?.size)?stored.size:base,sizes.min,Math.min(sizes.max,w||sizes.max,h||sizes.max));
    const spanX=Math.max(0,w-size),spanY=Math.max(0,h-size);
    const rightSide=['brake','drift','item','ability'].indexOf(action);
    const columns=w>=530?4:2;
    const initialX=rightSide<0?(action==='left'?0:pitch):spanX-(rightSide%columns)*pitch;
    const initialY=spanY-(rightSide>=columns?pitch:0);
    return {size,w,h,x:Number.isFinite(stored?.x)?clamp(stored.x,0,1)*spanX:clamp(initialX,0,spanX),
      y:Number.isFinite(stored?.y)?clamp(stored.y,0,1)*spanY:clamp(initialY,0,spanY)};
  }
  function position(plane,layout){
    for(const b of plane.querySelectorAll('[data-touch-action]')){
      const {x,y,size}=frame(plane,layout,b.dataset.touchAction);
      Object.assign(b.style,{left:x+'px',top:y+'px',width:size+'px',height:size+'px',fontSize:clamp(size*.245,11,20)+'px'});
    }
  }
  function mount(plane,{single,press,release}){
    const pointers=new Map();
    plane.classList.add('rally-live-pad','rally-touch-plane');
    function update(){plane.hidden=!(single&&show());if(!plane.hidden)position(plane,read()[orientation()]);}
    function off(e){
      const b=pointers.get(e.pointerId);if(!b)return;
      pointers.delete(e.pointerId);
      if(!Array.from(pointers.values()).includes(b)){b.classList.remove('on');release(b.dataset.touchAction);}
    }
    for(const action of Object.keys(actions)){
      const b=button(action);plane.append(b);
      b.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b);
        b.classList.add('on');press(action);
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,off);
    }
    function clear(){for(const b of pointers.values()){b.classList.remove('on');release(b.dataset.touchAction);}pointers.clear();}
    const observer=new ResizeObserver(update);observer.observe(plane.parentElement);
    window.addEventListener('resize',update);update();
    return {clear,update,dispose(){clear();observer.disconnect();window.removeEventListener('resize',update);}};
  }
  function edit(onClose){
    if(editor)return;
    const source=read(),draft={portrait:{...source.portrait},landscape:{...source.landscape}};
    let selected='brake',drag=null,profile=orientation();
    const dialog=document.createElement('dialog');editor=dialog;dialog.className='rally-touch-editor';
    dialog.setAttribute('aria-labelledby','rally-layout-title');
    dialog.innerHTML='<div class="rally-editor-head"><h2 id="rally-layout-title">Touch controls</h2><div><button type="button" data-reset>Reset</button><button type="button" data-cancel>Cancel</button><button type="button" data-save>Save</button></div></div><div class="rally-editor-tools"><label>Button <select aria-label="Choose a button"></select></label><label>Size <input type="range" min="36" max="88" step="2" aria-label="Button size"><output></output></label></div><div class="rally-touch-plane rally-editor-plane"></div><p class="rally-editor-tip"></p>';
    document.body.append(dialog);
    const plane=dialog.querySelector('.rally-editor-plane'),select=dialog.querySelector('select'),slider=dialog.querySelector('input');
    const output=dialog.querySelector('output'),tip=dialog.querySelector('.rally-editor-tip');
    function paint(){
      const next=orientation();if(next!==profile){drag=null;profile=next;}
      position(plane,draft[profile]);const metrics=frame(plane,draft[profile],selected);
      for(const b of plane.children)b.setAttribute('aria-pressed',String(b.dataset.touchAction===selected));
      select.value=selected;slider.value=metrics.size;output.value=metrics.size+' px';
      tip.textContent=(profile==='landscape'?'Landscape':'Portrait')+' · Drag a button to move it.';
    }
    function move(b,x,y){
      const action=b.dataset.touchAction,m=frame(plane,draft[profile],action);
      draft[profile][action]={size:m.size,x:clamp(x/Math.max(1,m.w-m.size),0,1),y:clamp(y/Math.max(1,m.h-m.size),0,1)};paint();
    }
    for(const [action,name] of Object.entries(actions)){
      select.add(new Option(name,action));const b=button(action);plane.append(b);
      b.addEventListener('pointerdown',e=>{
        if(drag||e.button!==0)return;e.preventDefault();b.focus({preventScroll:true});selected=action;paint();
        const box=b.getBoundingClientRect();drag={b,id:e.pointerId,dx:e.clientX-box.left,dy:e.clientY-box.top};b.setPointerCapture(e.pointerId);
      });
      b.addEventListener('pointermove',e=>{
        if(drag?.id!==e.pointerId||drag.b!==b)return;
        const box=plane.getBoundingClientRect();move(b,e.clientX-box.left-drag.dx,e.clientY-box.top-drag.dy);
      });
      const end=e=>{if(drag?.id===e.pointerId)drag=null;};
      for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,end);
      b.addEventListener('keydown',e=>{
        const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},dir=deltas[e.key];
        if(!dir)return;e.preventDefault();selected=action;
        const m=frame(plane,draft[profile],action),step=e.shiftKey?12:3;move(b,m.x+dir[0]*step,m.y+dir[1]*step);
      });
      b.addEventListener('click',()=>{selected=action;paint();});
    }
    select.addEventListener('change',()=>{selected=select.value;paint();});
    slider.addEventListener('input',()=>{draft[profile][selected]={...draft[profile][selected],size:Number(slider.value)};paint();});
    dialog.querySelector('[data-reset]').onclick=()=>{draft[profile]={};paint();};
    function close(commit){
      if(commit){saved=draft;try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
      observer.disconnect();window.removeEventListener('resize',paint);dialog.close();dialog.remove();editor=null;onClose?.();
    }
    dialog.querySelector('[data-cancel]').onclick=()=>close(false);dialog.querySelector('[data-save]').onclick=()=>close(true);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
    dialog.addEventListener('click',e=>e.stopPropagation());
    dialog.showModal();
    const observer=new ResizeObserver(paint);observer.observe(plane);window.addEventListener('resize',paint);paint();select.focus();
  }
  root.AcornTouch={nativeTouch,show,mount,edit,get editing(){return !!editor;}};
})(window);
