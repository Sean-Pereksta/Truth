const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function scene({painted=false}={}){
  const texts=[],houseLookups=[],drawCalls=[];
  const gradient={addColorStop(){}};
  const context=new Proxy({drawImage:(...args)=>drawCalls.push(args),measureText:s=>({width:String(s).length*7}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,fillText:s=>texts.push(String(s))},{get:(obj,key)=>key in obj?obj[key]:()=>{},set:(obj,key,value)=>(obj[key]=value,true)});
  const canvas={width:800,height:600,getContext:()=>context,getBoundingClientRect:()=>({width:800,height:600})};
  const world={window:{},document:{createElement:()=>({...canvas})},Image:class{complete=false;naturalWidth=0;set src(value){this._src=value;if(painted){const png=fs.readFileSync(path.join(__dirname,'..',value));this.naturalWidth=png.readUInt32BE(16);this.naturalHeight=png.readUInt32BE(20);this.complete=true;}}get src(){return this._src;}},Math,Map,WeakMap};
  if(painted)for(const file of ['assets.js','armor-troops.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),world);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8'),world);
  const game={time:1,cam:{x:0,y:0},terrain:{dirt:[],waters:[],rivers:[],forestRects:[],hills:[],stones:[],marshes:[],ridges:[],ruins:[],roads:[]},houses:[],objectives:[],blacksmiths:[],students:[],lootBoxes:[],groundLoot:[],barricades:[],traps:[],standards:[],projectiles:[],particles:[],hitEffects:[],combatEvents:[],selected:new Set()};
  let visible=false;
  const api={game,ctx:context,canvas,canSee:()=>visible,isVisibleTo:()=>visible,isExplored:()=>true,getSelectedUnits:()=>[],getHouse:id=>{houseLookups.push(id);return {id,name:id,color:'#dddddd'};}};
  return {game,api,texts,houseLookups,drawCalls,draw:()=>world.window.AcademyDraw(api),show:v=>visible=v};
}
function forbidden(object,key){Object.defineProperty(object,key,{get(){throw new Error('Hidden '+key+' was rendered');}});return object;}

test('fog hides enemy soldiers, carriers, labels, particles, flags and supplies',()=>{
  const s=scene(),point={x:300,y:300,controller:'mars'};
  s.game.students=[forbidden({...point,id:'secret',carryingStandard:'player'},'attackAction')];
  s.game.standards=[forbidden({...point},'houseId')];
  s.game.hitEffects=[forbidden({...point},'text')];
  s.game.combatEvents=[forbidden({...point},'text')];
  s.game.particles=[forbidden({...point},'r')];
  s.game.lootBoxes=[forbidden({...point,alive:true},'hp')];
  assert.doesNotThrow(s.draw);
  assert.deepEqual(s.texts,[]);
});

test('a friendly flag dropped beyond sight is not rendered through explored fog',()=>{
  const s=scene();
  s.game.standards=[forbidden({x:300,y:300,houseId:'player',controller:'player',carriedBy:null,dropped:true},'captureStudentId')];
  s.game.visibility={player:{visible:new Uint8Array([0,0,0,0]),explored:new Uint8Array([1,1,1,1])}};
  Object.assign(s.api,{VISION_TILE:200,VISION_COLS:2,VISION_ROWS:2});
  assert.doesNotThrow(s.draw,'friendly ownership must not bypass banner visibility');
  assert.deepEqual(s.texts,[]);
});

test('explored castles keep the last observed ownership until scouted again',()=>{
  const s=scene();s.game.houses=[{id:'mars',name:'House Mars',controller:'mars',color:'#dd7777',castle:{x:300,y:300}}];
  s.show(true);s.draw();
  s.show(false);s.game.time=2;s.game.houses[0].controller='diana';s.houseLookups.length=0;s.draw();
  assert.ok(s.houseLookups.includes('mars'));
  assert.ok(!s.houseLookups.includes('diana'),'unseen ownership change leaked through remembered castle');
  s.show(true);s.game.time=3;s.houseLookups.length=0;s.draw();
  assert.ok(s.houseLookups.includes('diana'));
});

test('all new terrain is backed by a production painted atlas',()=>{
  const assets=fs.readFileSync(path.join(__dirname,'../assets.js'),'utf8');
  assert.match(assets,/"terrain":"terrain-atlas-v2.png"/);
  const png=fs.readFileSync(path.join(__dirname,'../terrain-atlas-v2.png'));
  assert.equal(png.readUInt32BE(16),1254);assert.equal(png.readUInt32BE(20),1254);
  assert.ok(png.length>500000);
});

test('fog shading reads its cached grid without exact line-of-sight queries',()=>{
  const s=scene();
  s.game.visibility={player:{visible:new Uint8Array([1,0,0,0]),explored:new Uint8Array([1,1,0,0])}};
  Object.assign(s.api,{VISION_TILE:80,VISION_COLS:2,VISION_ROWS:2,canSee:()=>{throw new Error('Fog shading queried exact LOS');}});
  assert.doesNotThrow(s.draw);
});

const student=overrides=>({id:'student_player_0',name:'Student',origHouse:'player',controller:'player',x:300,y:300,state:'idle',facingDir:'right',weapon:'Sword',weaponLevel:1,armor:'None',item:'None',mount:false,hp:100,maxHp:100,path:[],pathIndex:0,attackAction:null,smithTimer:0,swing:0,draw:0,burnUntil:0,...overrides});

test('all houses render complete armor troops for every foot role and facing',()=>{
  const manifest=require('../armor-troops/frames.json');
  const ids=Object.keys(manifest.sheets).filter(k=>k.endsWith('-light')).map(k=>k.slice(0,-6));
  assert.equal(ids.length,10);
  for(const id of ids){
    const s=scene({painted:true});s.show(true);
    for(const [tier,armor] of [['light','Light'],['heavy','Heavy'],['champion','Champion_'+id]])for(const [role,extra] of [[0,{weapon:'Sword'}],[2,{weapon:'Spear'}],[4,{item:'Medkit'}]])for(const back of [false,true]){
      s.drawCalls.length=0;s.game.students=[student({origHouse:id,armor,...extra,facingDir:back?'up':'left'})];s.draw();
      const key=id+'-'+tier,calls=s.drawCalls.filter(a=>a[0]?.src===manifest.sheets[key]);
      assert.equal(calls.length,1,`${key}: expected one complete troop draw`);
      const cell=manifest.frames[key].frames[((manifest.offsets[key]||0)+role+Number(back))*8];
      assert.deepEqual(calls[0].slice(1,5),[cell.x,cell.y,cell.w,cell.h]);
      assert(!s.drawCalls.some(a=>a[0]?.src==='armor-overlays.png'||a[0]?.src===`champions/${id}-champion.png`));
    }
  }
});

test('archers and horsemen use exactly one house design across every armor tier',()=>{
  for(const id of ['player','mars','minerva','diana','apollo','juno','neptune','vulcan','venus','saturn']){
    const s=scene({painted:true});s.show(true);const rectangles=new Map();
    for(const armor of ['None','Light','Heavy','Champion_'+id])for(const [role,extra] of [['archer',{weapon:'Bow',item:'Medkit'}],['longbow',{weapon:'Longbow'}],['horseman',{mount:true}],['mounted bow',{mount:true,weapon:'Bow'}]]){
      s.drawCalls.length=0;s.game.students=[student({origHouse:id,armor,...extra})];s.draw();
      const calls=s.drawCalls.filter(a=>a[0]?.src===`factions/${id}.png`);assert.equal(calls.length,1);
      assert(!s.drawCalls.some(a=>a[0]?.src?.startsWith('armor-troops/')||a[0]?.src?.startsWith('champions/')||a[0]?.src==='armor-overlays.png'));
      const rect=calls[0].slice(1,5);if(rectangles.has(role))assert.deepEqual(rect,rectangles.get(role));else rectangles.set(role,rect);
    }
  }
});

test('whole armor troops change frames when walking, winding up and striking',()=>{
  const manifest=require('../armor-troops/frames.json'),key='mars-heavy',meta=manifest.frames[key],offset=manifest.offsets[key]||0;
  const s=scene({painted:true});s.show(true);
  for(const [extra,column] of [[{},0],[{attackAction:{phase:'windup',progress:.5}},6],[{attackAction:{phase:'recovery',progress:.5}},7]]){
    s.drawCalls.length=0;s.game.students=[student({origHouse:'mars',armor:'Heavy',weapon:'Spear',...extra})];s.draw();
    const call=s.drawCalls.find(a=>a[0]?.src===manifest.sheets[key]),cell=meta.frames[(offset+2)*8+column];assert.deepEqual(call.slice(1,5),[cell.x,cell.y,cell.w,cell.h]);
  }
  const positions=new Set();for(let i=0;i<8;i++){s.game.time=i/9;s.drawCalls.length=0;s.game.students=[student({origHouse:'mars',armor:'Heavy',state:'move'})];s.draw();positions.add(s.drawCalls.find(a=>a[0]?.src===manifest.sheets[key])[1]);}
  assert.equal(positions.size,5,'five separate full-body walking poses are used');
});

test('every house has its own complete sixteen-frame champion atlas',()=>{
  const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets.js'),'utf8'),scope);
  const {champions,championFrames}=scope.window.AcademyAssets;
  assert.equal(Object.keys(champions).length,10);
  for(const [id,file] of Object.entries(champions)){
    assert.ok(fs.statSync(path.join(__dirname,'..',file)).size>300000);
    const meta=championFrames[id];assert.equal(meta.frames.length,16);assert.equal(meta.columns,8);assert.equal(meta.rows,2);
    for(const frame of meta.frames){assert.ok(frame.w>40&&frame.h>80);assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=meta.width&&frame.y+frame.h<=meta.height);}
  }
});
