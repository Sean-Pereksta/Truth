const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// A deliberately small DOM fixture: tests application state and event wiring,
// not browser layout, drawing or the browser's native focus implementation.
function createApp() {
  const winListeners = new Map();
  let doc;
  const decode = s => String(s).replace(/&(?:amp|lt|gt|quot|#39);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[x]));
  const context2d = new Proxy({measureText:t=>({width:String(t).length*7})}, {get:(obj,key)=>obj[key]||(obj[key]=()=>{})});
  class Element {
    constructor(tag='div') {
      this.tagName=tag.toUpperCase(); this.children=[]; this.parentElement=null;
      this.attributes={}; this.style={}; this.dataset={}; this.events=new Map();
      this._text=''; this._html=''; this.inert=false; this.disabled=false;
      this.classList={
        contains:c=>(this.attributes.class||'').split(/\s+/).includes(c),
        add:(...cs)=>{this.attributes.class=[...new Set([...(this.attributes.class||'').split(/\s+/).filter(Boolean),...cs])].join(' ');},
        remove:(...cs)=>{this.attributes.class=(this.attributes.class||'').split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},
        toggle:(c,force)=>{const yes=force===undefined?!this.classList.contains(c):!!force;this.classList[yes?'add':'remove'](c);return yes;}
      };
    }
    setAttribute(name,value) {
      this.attributes[name]=String(value);
      if(name==='id')this.id=String(value);
      if(name==='disabled')this.disabled=true;if(name==='checked')this.checked=true;if(name==='open')this.open=true;
      if(name==='hidden')this.hidden=true;
      if(name==='inert')this.inert=true;
      if(name==='tabindex')this.tabIndex=Number(value);
      if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
    }
    getAttribute(name){return this.attributes[name]??null;}
    hasAttribute(name){return Object.hasOwn(this.attributes,name);}
    removeAttribute(name){delete this.attributes[name];if(name==='disabled')this.disabled=false;if(name==='inert')this.inert=false;}
    appendChild(child){child.parentElement=this;this.children.push(child);return child;}
    append(...children){children.forEach(c=>this.appendChild(c));}
    get lastElementChild(){return [...this.children].reverse().find(c=>c.tagName!=='#TEXT')||null;}
    get firstElementChild(){return this.children.find(c=>c.tagName!=='#TEXT')||null;}
    get parentNode(){return this.parentElement;}
    get className(){return this.attributes.class||'';}
    set className(v){this.attributes.class=String(v);}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    set textContent(v){this._text=String(v);this.children=[];this._html=String(v);}
    get innerHTML(){return this._html;}
    set innerHTML(v){this._html=String(v);this.children=[];this._text='';parseInto(this,String(v));}
    insertAdjacentHTML(position,value){assert.equal(position,'beforeend');this._html+=value;parseInto(this,value);}
    addEventListener(type,fn,options){const capture=options===true||options?.capture;const list=this.events.get(type)||[];list.push({fn,capture});this.events.set(type,list);}
    removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(x=>x.fn!==fn));}
    contains(el){return this===el||this.children.some(c=>c.contains(el));}
    matches(selector){
      selector=selector.trim();
      if(selector.includes(','))return selector.split(',').some(s=>this.matches(s));
      const nots=[...selector.matchAll(/:not\(([^)]+)\)/g)].map(x=>x[1]);
      if(nots.some(s=>this.matches(s)))return false;
      selector=selector.replace(/:not\([^)]+\)/g,'');
      if(selector==='*')return true;
      const tag=selector.match(/^[a-zA-Z][\w-]*/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
      const id=selector.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
      for(const [,c] of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(c))return false;
      for(const [,name,,value] of selector.matchAll(/\[([\w-]+)(?:([~^$*|]?=)["']?([^\]"']*)["']?)?\]/g)){
        if(!this.hasAttribute(name))return false;
        if(value!==undefined&&this.getAttribute(name)!==value)return false;
      }
      return !!(tag||id||selector.includes('.')||selector.includes('['));
    }
    querySelectorAll(selector){
      const results=[];
      const branches=selector.split(',').map(x=>x.trim());
      const hit=(el,branch)=>{
        const bits=branch.split(/\s+/);if(!el.matches(bits.pop()))return false;
        let ancestor=el.parentElement;
        while(bits.length){const s=bits.pop();while(ancestor&&!ancestor.matches(s))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}
        return true;
      };
      const walk=el=>{for(const c of el.children){if(branches.some(s=>hit(c,s)))results.push(c);walk(c);}};
      walk(this);return results;
    }
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    closest(s){for(let e=this;e;e=e.parentElement)if(e.matches(s))return e;return null;}
    focus(){doc.activeElement=this;}
    blur(){if(doc.activeElement===this)doc.activeElement=doc.body;}
    getClientRects(){return this.hidden||this.classList.contains('hidden')?[]:[this.getBoundingClientRect()];}
    get offsetParent(){return this.hidden||this.classList.contains('hidden')?null:this.parentElement;}
    get offsetWidth(){return this.getBoundingClientRect().width;}
    get offsetHeight(){return this.getBoundingClientRect().height;}
    getBoundingClientRect(){return {left:0,top:0,width:this.id==='minimap'?130:1360,height:this.id==='minimap'?130:800};}
    getContext(){return context2d;}
    click(extra={}){if(this.disabled)return;if(this.tagName==='INPUT'&&this.getAttribute('type')==='checkbox')this.checked=!this.checked;return dispatch('click',this,extra);}
  }
  function parseInto(root,html){
    const stack=[root],voids=new Set(['META','LINK','INPUT','IMG','BR','HR','SOURCE','WBR','AREA','BASE','EMBED']);
    for(const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g)||[]){
      if(token.startsWith('<!'))continue;
      if(token.startsWith('</')){const name=token.match(/^<\/\s*([\w-]+)/)?.[1]?.toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===name){stack.length=i;break;}continue;}
      if(token[0]==='<'){
        const tag=token.match(/^<\s*([\w-]+)/)?.[1];if(!tag)continue;
        const el=new Element(tag),attr=token.slice(token.indexOf(tag)+tag.length).replace(/\/?\s*>$/,'');
        for(const m of attr.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(m[1],decode(m[2]??m[3]??m[4]??''));
        stack.at(-1).appendChild(el);if(!voids.has(el.tagName)&&!token.endsWith('/>'))stack.push(el);
      }else{const el=new Element('#text');el._text=decode(token);stack.at(-1).appendChild(el);}
    }
  }
  const root=new Element('document');
  parseInto(root,fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'));
  doc={body:root.querySelector('body'),documentElement:root.querySelector('html'),activeElement:null,readyState:'complete',
    getElementById:id=>root.querySelector('#'+id),querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),
    createElement:tag=>new Element(tag),addEventListener:(...args)=>addWindowListener(...args)};
  doc.activeElement=doc.body;
  function addWindowListener(type,fn,options){const capture=options===true||options?.capture;const list=winListeners.get(type)||[];list.push({fn,capture});winListeners.set(type,list);}
  function dispatch(type,target,extra={}){
    const e={type,target,currentTarget:null,defaultPrevented:false,cancelBubble:false,immediate:false,key:'',code:'',ctrlKey:false,metaKey:false,shiftKey:false,repeat:false,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;},stopImmediatePropagation(){this.cancelBubble=true;this.immediate=true;},...extra};
    const invoke=(owner,list)=>{e.currentTarget=owner;for(const {fn}of list){fn(e);if(e.immediate)break;}};
    invoke(host,(winListeners.get(type)||[]).filter(x=>x.capture));
    if(!e.cancelBubble){for(let el=target;el;el=el.parentElement){invoke(el,el.events.get(type)||[]);if(!e.immediate&&type==='click'&&el.onclick)el.onclick(e);if(e.cancelBubble)break;}}
    if(!e.cancelBubble)invoke(host,(winListeners.get(type)||[]).filter(x=>!x.capture));
    return e;
  }
  const memory=new Map();
  const host={document:doc,console,Math:Object.create(Math),devicePixelRatio:1,innerWidth:1360,innerHeight:800,
    requestAnimationFrame(){},cancelAnimationFrame(){},performance:{now:()=>1000},setTimeout,clearTimeout,
    getComputedStyle:el=>({display:el.hidden||el.classList.contains('hidden')?'none':'block',visibility:'visible'}),
    addEventListener:addWindowListener,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
    Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},AcademyDraw(){}};
  host.window=host;host.globalThis=host;vm.createContext(host);
  for(const name of ['champions.js','equipment.js','armory.js','strategy.js','shell.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),host,{filename:name});
  dispatch('load',doc.body);
  return {host,doc,$:doc.getElementById,a:host.Academy,s:host.AcademyShell,g:host.Academy.game,
    key:(key,extra={})=>dispatch('keydown',doc.activeElement,{key,code:key===' '?'Space':key,...extra}),dispatch};
}

module.exports={createApp};
