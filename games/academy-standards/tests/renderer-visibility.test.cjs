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
  if(painted)vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets.js'),'utf8'),world);
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

test('light leather and heavy plate use distinct painted armor cells',()=>{
  for(const [armor,row] of [['Light',0],['Heavy',1]]){
    const s=scene({painted:true});s.show(true);s.game.students=[student({armor})];s.draw();
    const overlays=s.drawCalls.filter(args=>args[0]?.src==='armor-overlays.png');
    assert.equal(overlays.length,1);assert.equal(overlays[0][2],row*overlays[0][0].naturalHeight/2);
  }
});

test('champions use their original house sheet and keep bows and horses visible',()=>{
  const melee=scene({painted:true});melee.show(true);melee.game.students=[student({origHouse:'mars',armor:'Champion_mars'})];melee.draw();
  assert.ok(melee.drawCalls.some(args=>args[0]?.src==='champions/mars-champion.png'));
  assert.ok(!melee.drawCalls.some(args=>args[0]?.src==='factions/mars.png'),'champion melee still drew ordinary infantry');
  for(const overrides of [{weapon:'Longbow'},{mount:true}]){
    const s=scene({painted:true});s.show(true);s.game.students=[student({armor:'Champion_player',...overrides})];s.draw();
    assert.ok(s.drawCalls.some(args=>args[0]?.src==='factions/player.png'),'functional horse/bow pose disappeared');
    assert.ok(s.drawCalls.some(args=>args[0]?.src==='champions/player-champion.png'),'champion armor artwork disappeared');
  }
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
