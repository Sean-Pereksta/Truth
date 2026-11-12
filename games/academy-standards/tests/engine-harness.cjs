const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadGame(seed=12345){
  const elements=new Map(),listeners=new Map(),noop=()=>{},drawing=new Proxy({},{get:()=>noop});
  const listen=(target,type,fn)=>{const key=target+':'+type;if(!listeners.has(key))listeners.set(key,[]);listeners.get(key).push(fn);};
  const dispatch=(target,type,props={})=>{const event={key:'',code:'',target:{tagName:'CANVAS'},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...props};for(const fn of listeners.get(target+':'+type)||[])fn(event);return event;};
  const random=Object.create(Math);random.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function element(id){
    if(!elements.has(id))elements.set(id,{style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>drawing,getBoundingClientRect:()=>({width:1200,height:720,left:0,top:0}),addEventListener:(type,fn)=>listen(id,type,fn),setAttribute:noop,querySelectorAll:()=>[],click(){this.onclick?.();}});
    return elements.get(id);
  }
  const context={console,Math:random,Date,Set,Map,WeakMap,Uint8Array,devicePixelRatio:1,addEventListener:(type,fn)=>listen('window',type,fn),requestAnimationFrame:noop,document:{getElementById:element,querySelectorAll:()=>[]},AcademyUI:noop};
  context.window=context;vm.createContext(context);
  for(const file of ['champions.js','equipment.js','strategy.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  return {A:context.Academy,T:context.AcademyTest,S:context.AcademyStrategy,context,dispatch,elements};
}
module.exports={loadGame};
