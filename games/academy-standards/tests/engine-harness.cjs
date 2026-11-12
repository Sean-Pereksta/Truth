const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadGame(seed=12345){
  const elements=new Map(),noop=()=>{},drawing=new Proxy({},{get:()=>noop});
  const random=Object.create(Math);random.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function element(id){
    if(!elements.has(id))elements.set(id,{style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>drawing,getBoundingClientRect:()=>({width:1200,height:720,left:0,top:0}),addEventListener:noop,setAttribute:noop,querySelectorAll:()=>[],click(){this.onclick?.();}});
    return elements.get(id);
  }
  const context={console,Math:random,Date,Set,Map,WeakMap,Uint8Array,devicePixelRatio:1,addEventListener:noop,requestAnimationFrame:noop,document:{getElementById:element,querySelectorAll:()=>[]},AcademyUI:noop};
  context.window=context;vm.createContext(context);
  for(const file of ['equipment.js','strategy.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  return {A:context.Academy,T:context.AcademyTest,S:context.AcademyStrategy,context};
}
module.exports={loadGame};
