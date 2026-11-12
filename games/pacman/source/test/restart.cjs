const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const project=path.resolve(__dirname,'..','..');

async function main(){
  const engine=await import(pathToFileURL(path.join(project,'engine.js')));
  const {AIController}=await import(pathToFileURL(path.join(project,'ai.js')));
  const html=fs.readFileSync(path.join(project,'index.html'),'utf8');
  const all=[],ids=new Map();
  class Element{
    constructor(tag='div',id=''){
      this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this.listeners={};this.hidden=false;this.value='';this.disabled=false;this.className='';this.textContent='';this.parentElement=null;
      this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));if(on===undefined)on=!set.has(name);on?set.add(name):set.delete(name);this.className=[...set].join(' ');return on;},add:(...names)=>names.forEach(n=>this.classList.toggle(n,true)),remove:(...names)=>names.forEach(n=>this.classList.toggle(n,false)),contains:name=>this.className.split(/\s+/).includes(name)};
      all.push(this);
    }
    markRemoved(value){this.removed=value;for(const child of this.children)child.markRemoved(value);}
    append(...nodes){for(const node of nodes){node.markRemoved(false);node.parentElement=this;this.children.push(node);}}
    insertBefore(node,before){if(node.parentElement)node.remove();const index=this.children.indexOf(before);node.markRemoved(false);node.parentElement=this;if(index<0)this.children.push(node);else this.children.splice(index,0,node);}
    remove(){if(this.parentElement){const index=this.parentElement.children.indexOf(this);if(index>=0)this.parentElement.children.splice(index,1);this.parentElement=null;}this.markRemoved(true);}
    replaceChildren(...nodes){for(const child of this.children){child.parentElement=null;child.markRemoved(true);}this.children=[];this.append(...nodes);}
    setAttribute(k,v){this.attributes[k]=String(v);}
    getAttribute(k){return this.attributes[k]??null;}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
    fire(name){for(const fn of this.listeners[name]||[])fn({target:this,preventDefault(){},stopPropagation(){}});}
    click(){this.fire('click');}
    querySelector(selector){
      const match=this.querySelectorAll(selector)[0];
      if(match)return match;
      if(selector==='span'){const span=new Element('span');this.append(span);return span;}
      return null;
    }
    querySelectorAll(selector){const descendants=[];const visit=n=>{for(const c of n.children){descendants.push(c);visit(c);}};visit(this);return descendants.filter(e=>matches(e,selector));}
    getBoundingClientRect(){return{left:0,top:50,width:this.id==='minimap'?160:796,height:this.id==='minimap'?110:618};}
    setPointerCapture(){}
  }
  function matches(e,s){
    if(s.startsWith('.'))return e.className.split(/\s+/).includes(s.slice(1));
    if(s.startsWith('#'))return e.id===s.slice(1);
    const data=s.match(/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/);if(data){const key=data[1].replace(/-([a-z])/g,(_,a)=>a.toUpperCase());return key in e.dataset&&(data[2]===undefined||e.dataset[key]===data[2]);}
    return e.tagName.toLowerCase()===s;
  }
  for(const tag of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
    const el=new Element(tag[1],tag[3]);el.hidden=/\bhidden\b/.test(tag[2]);el.value=tag[2].match(/\bvalue="([^"]*)"/)?.[1]||'';ids.set(el.id,el);
  }
  const documentElement=new Element('html');
  for(const el of [...ids.values()]){const parent=new Element('section'),grandparent=new Element('section');grandparent.append(parent);parent.append(el);}
  ids.get('map-select').value='catacombs';ids.get('seed-input').value='1975';
  for(const action of ['move','attack','harvest','snare','stop']){
    const el=action==='harvest'?ids.get('harvest-order'):action==='snare'?ids.get('snare-order'):new Element('button');el.dataset.order=action;
  }
  for(const side of ['pac','ghost']){const el=new Element('button');el.dataset.side=side;}
  for(const teamId of ['pac','pac2','pac3']){const el=new Element('button');el.dataset.team=teamId;}
  for(const difficulty of ['easy','normal','hard','nightmare']){const el=new Element('button');el.dataset.difficulty=difficulty;}
  const documentListeners={};
  const document={documentElement,fullscreenEnabled:false,fullscreenElement:null,hidden:false,getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),querySelector:s=>all.find(e=>!e.removed&&matches(e,s))||null,querySelectorAll:s=>all.filter(e=>!e.removed&&matches(e,s)),addEventListener(name,fn){(documentListeners[name]??=[]).push(fn);}};
  class Renderer{
    constructor(canvas,game){this.camera={x:0,y:0,zoom:.9};this.game=game;this.assetReady=Promise.resolve({units:true,terrain:true,buildings:true});}
    setGame(game){if(Renderer.failNext){Renderer.failNext=false;throw new Error('Fixture: renderer restart failed');}this.game=game;}
    centerOn(x,y){this.camera.x=x;this.camera.y=y;}
    resize(){}drawMinimap(){}render(){}pan(){}zoomAt(){}
    screenToWorld(x,y){return{x,y};}worldToScreen(x,y){return{x,y};}
  }
  const storage=new Map(),frames=[];let fixtureTime=0;
  const window={addEventListener(){}};
  const reportedErrors=[];
  const context={...engine,AIController,Renderer,document,window,console:{...console,error:(...args)=>reportedErrors.push(args)},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},performance:{now:()=>fixtureTime},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},setTimeout:()=>1,clearTimeout(){}};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(project,'main.js'),'utf8').replace(/^import[^\n]*\n/gm,'');
  vm.runInContext(source+`\n globalThis.__restartTest={startGame,openMenu,closeMenu,endMatch,frame,settings,updateHUD,ownUnits,entityAt,setSelection:ids=>{selected=new Set(ids);updateSelection();},getState:()=>({game,ai,started,ended,selected,keys,pointer,panPointer,mouseCanvas,buildType,orderMode,productionTab,speed,controlGroups}),seedTransient:()=>{keys.add('arrowright');pointer={id:9};panPointer={id:10,x:4,y:4};mouseCanvas={x:795,y:200};buildType='tower';orderMode='attack';productionTab='buildings';speed=2;}};`,context);
  const api=context.__restartTest;
  const press=(key,options={})=>{
    const event={key,code:/^[1-9]$/.test(key)?'Digit'+key:'Key'+key.toUpperCase(),target:documentElement,repeat:false,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...options};
    for(const listener of documentListeners.keydown||[]){listener(event);if(event.stopped)break;}
    return event;
  };
  const hidden=id=>ids.get(id).hidden;
  const assertPlaying=side=>{
    const {game,started,ended}=api.getState();
    assert.equal(game.side,side);assert.equal(game.time,0);assert.equal(game.status,'playing');assert.equal(game.paused,false);assert.equal(started,true);assert.equal(ended,false);assert.ok(game.getHero());
    for(const id of ['setup-screen','result-screen','help-screen','pause-label'])assert.equal(hidden(id),true,id+' must not cover a new match');
  };
  ids.get('launch-btn').click();assertPlaying('pac');
  const controlGame=api.getState().game,hero=controlGame.getHero(),miner=api.ownUnits().find(unit=>unit.type==='miner'),nest=controlGame.buildings.find(building=>building.teamId===controlGame.playerTeam&&building.type==='nest'),ally=controlGame.getHero('pac2');
  api.setSelection([hero.id,nest.id,ally.id]);
  assert.equal(press('1',{ctrlKey:true}).prevented,true,'Assign must suppress the browser shortcut');
  assert.deepEqual([...api.getState().controlGroups[0]].sort(),[hero.id,nest.id].sort(),'Groups include owned structures and exclude allies');
  api.setSelection([miner.id]);press('1',{shiftKey:true});assert.equal(api.getState().controlGroups[0].size,3,'Shift adds selected members');
  press('1');assert.equal(api.getState().selected.size,3,'A bare number recalls instead of training');
  fixtureTime=100;press('1');assert.equal(context.window.blackout.renderer.camera.x,(hero.x+miner.x+nest.x)/3,'Double recall focuses the group');
  api.setSelection([miner.id]);press('9',{metaKey:true});api.setSelection([]);press('9',{code:'Numpad9'});assert.deepEqual([...api.getState().selected],[miner.id],'Command assigns and numpad recalls');
  miner.hp=0;api.updateHUD();assert.equal(api.getState().controlGroups[8].size,0,'Dead members disappear from groups');
  api.setSelection([]);press('1',{ctrlKey:true});assert.equal(api.getState().controlGroups[0].size,0,'Assigning an empty selection clears a group');
  api.setSelection([hero.id]);press('2',{ctrlKey:true,target:ids.get('seed-input')});assert.equal(api.getState().controlGroups[1].size,0,'Typing in fields must not change groups');
  press('2',{ctrlKey:true});press('2',{repeat:true});assert.equal(api.getState().controlGroups[1].size,1);
  press('t');controlGame.resources.pac=1000;const queued=nest.queue.length;press('z');assert.equal(nest.queue.length,queued+1,'T then Z queues the first troop');
  press('b');press('z');assert.equal(api.getState().buildType,'nest','B then Z selects the first structure');
  const sanctuaryKey=Object.keys(engine.BUILDING_DEFS).filter(type=>engine.BUILDING_DEFS[type].side==='pac').indexOf('sanctuary');
  if(sanctuaryKey>=0){press(['z','c','v','n','g'][sanctuaryKey]);assert.equal(api.getState().buildType,'sanctuary','The fifth building has a usable visible shortcut');}
  press('e');assert.equal(controlGame.powerCharges,0,'E retains Power even while the build tab is open');
  api.startGame();assertPlaying('pac');assert.ok(api.getState().controlGroups.every(group=>group.size===0),'Restart clears all stale group IDs');
  console.log('Control-group and production checks passed: owned troops/structures, Ctrl/Command assignment, Shift addition, number/numpad recall, double focus, dead-member cleanup, clear, field guards, restart reset, production keys and reserved Power.');
  assert.equal(api.getState().ai.length,3,'Exactly the three non-human teams receive controllers');
  assert.ok(api.getState().ai.every(controller=>controller.teamId!==api.getState().game.playerTeam));
  const original=api.getState().game;original.update(.1);api.openMenu();assert.equal(hidden('setup-screen'),false);assert.equal(original.paused,true);
  api.startGame();assertPlaying('pac');assert.notEqual(api.getState().game,original);
  const dying=api.getState().game;dying.status='ghost-won';dying.winnerReason='Pac-Man was caught.';api.endMatch();assert.equal(hidden('result-screen'),false);
  api.openMenu();assert.equal(hidden('setup-screen'),false);assert.equal(hidden('result-screen'),true,'Command menu after defeat must dismiss the defeat overlay');
  const chooseSide=side=>all.find(el=>el.dataset.side===side).click(),chooseDifficulty=difficulty=>all.find(el=>el.dataset.difficulty===difficulty).click();
  ids.get('map-select').value='ruins';ids.get('seed-input').value='4567';chooseSide('ghost');chooseDifficulty('hard');api.startGame();assertPlaying('ghost');assert.equal(api.getState().game.difficulty,'hard');assert.equal(api.getState().game.map.kind,'ruins');assert.equal(api.getState().game.seed,4567);
  api.openMenu();chooseSide('pac');ids.get('map-select').value='crossroads';ids.get('seed-input').value='2027';chooseDifficulty('nightmare');
  assert.equal(ids.get('map-select').value,'crossroads','Changing difficulty must preserve the selected battlefield');assert.equal(ids.get('seed-input').value,'2027','Changing difficulty must preserve the typed seed');
  chooseSide('ghost');chooseSide('pac');assert.equal(ids.get('map-select').value,'crossroads');assert.equal(ids.get('seed-input').value,'2027');
  ids.get('launch-btn').click();assertPlaying('pac');assert.equal(api.getState().game.map.kind,'crossroads');assert.equal(api.getState().game.seed,2027);assert.equal(api.getState().game.difficulty,'nightmare');
  api.openMenu();ids.get('map-select').value='catacombs';ids.get('map-select').fire('change');assert.equal(api.settings.map,'catacombs');ids.get('seed-input').value='9876';ids.get('seed-input').fire('input');assert.equal(api.settings.seed,9876);
  ids.get('seed-input').value='';ids.get('seed-input').fire('input');chooseDifficulty('easy');assert.equal(ids.get('seed-input').value,'','Faction/difficulty refresh must not overwrite in-progress seed input');assert.equal(api.settings.seed,9876);
  ids.get('seed-random').click();const randomSeed=Number(ids.get('seed-input').value);assert.equal(api.settings.seed,randomSeed);chooseSide('ghost');chooseDifficulty('normal');assert.equal(Number(ids.get('seed-input').value),randomSeed);
  ids.get('launch-btn').click();assertPlaying('ghost');assert.equal(api.getState().game.seed,randomSeed);
  const won=api.getState().game;won.status='ghost-won';won.winnerReason='Pac-Man was caught.';api.endMatch();ids.get('rematch-btn').click();assertPlaying('ghost');
  for(let n=0;n<4;n++){api.openMenu();api.settings.side=n%2?'ghost':'pac';ids.get('seed-input').value=String(5000+n);api.startGame();assertPlaying(api.settings.side);}
  const running=api.getState().game;running.paused=false;api.openMenu();api.openMenu();api.closeMenu();assert.equal(running.paused,false,'Repeated menu opening must preserve running resume state');
  running.paused=true;api.openMenu();api.closeMenu();assert.equal(running.paused,true,'A paused match remains paused after returning from menu');
  for(const outcome of ['pac-won','ghost-won']){
    api.getState().game.status=outcome;api.getState().game.winnerReason=outcome==='pac-won'?'The Ghost Citadel has been destroyed.':'Pac-Man was caught.';api.endMatch();
    ids.get('menu-btn').click();assert.equal(hidden('result-screen'),true);assert.equal(hidden('setup-screen'),false);
    ids.get('launch-btn').click();assertPlaying(api.settings.side);
  }
  api.seedTransient();ids.get('help-screen').hidden=false;ids.get('result-screen').hidden=false;api.startGame();assertPlaying(api.settings.side);
  const clean=api.getState();assert.equal(clean.keys.size,0);for(const field of ['pointer','panPointer','mouseCanvas','buildType','orderMode'])assert.equal(clean[field],null,field+' must reset');assert.equal(clean.productionTab,'troops');assert.equal(clean.speed,1);
  api.openMenu();Renderer.failNext=true;ids.get('launch-btn').click();assert.equal(hidden('setup-screen'),false);assert.equal(ids.get('launch-btn').disabled,false);assert.match(ids.get('loading-status').textContent,/could not start/);assert.equal(reportedErrors.length,1);
  ids.get('launch-btn').click();assertPlaying(api.settings.side);
  api.openMenu();chooseSide('pac');
  for(const teamId of ['pac','pac2','pac3'])for(const difficulty of ['easy','normal','hard','nightmare']){
    all.find(el=>el.dataset.team===teamId).click();chooseDifficulty(difficulty);api.startGame();assertPlaying('pac');
    const state=api.getState(),current=state.game,matchup=engine.DIFFICULTIES[difficulty];
    assert.equal(current.playerTeam,teamId);assert.ok(state.selected.has(current.getHero(teamId).id));
    assert.ok(api.ownUnits().every(u=>u.teamId===teamId));
    assert.equal(state.ai.length,3);
    for(const controller of state.ai)assert.equal(controller.difficulty,controller.side==='pac'?matchup.allyDifficulty:matchup.enemyDifficulty);
    const allyId=engine.PAC_TEAMS.find(id=>id!==teamId),ally=current.getHero(allyId);
    assert.equal(api.entityAt({x:ally.x,y:ally.y}),null,'Clicking an allied commander cannot select their army');
    assert.equal(current.train('miner',null,allyId),true);assert.equal(current.train('miner'),true);api.updateHUD();
    assert.equal(ids.get('training-queue-count').textContent,'1','The human queue excludes AI partners');
    const balance=current.resources[teamId],allyBalance=current.resources[allyId];
    ids.get('training-queue-orders').children[0].click();
    assert.equal(current.resources[teamId],balance+engine.UNIT_DEFS.miner.cost);assert.equal(current.resources[allyId],allyBalance);
    assert.equal(ids.get('training-queue').hidden,true);api.openMenu();
  }
  chooseSide('ghost');chooseDifficulty('hard');api.startGame();assertPlaying('ghost');
  assert.equal(api.getState().game.playerTeam,'ghost');assert.ok(api.getState().ai.every(controller=>controller.side==='pac'&&controller.difficulty==='hard'));
  const sourceGuard=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(code=>code.includes('sourceLaunchButton'));
  assert.ok(sourceGuard,'Raw source must tell file-open users which packaged game to open');
  function checkSourceGuard(protocol,hasModule){
    const launchText={textContent:'ENTER THE MAZE'},launch={disabled:false,querySelector:()=>launchText},status={textContent:'Ready'};
    vm.runInNewContext(sourceGuard,{location:{protocol},document:{querySelector:()=>hasModule?{}:null,getElementById:id=>id==='launch-btn'?launch:status}});
    return{launch,launchText,status};
  }
  const rawFile=checkSourceGuard('file:',true);assert.equal(rawFile.launch.disabled,true);assert.match(rawFile.status.textContent,/PLAY PACMAN/);
  const bundledFile=checkSourceGuard('file:',false);assert.equal(bundledFile.launch.disabled,false,'Packaged standalone must keep its start button enabled');
  const servedSource=checkSourceGuard('http:',true);assert.equal(servedSource.launch.disabled,false,'Source preview server must remain playable');
  console.log('Restart controller checks passed: button launch, running/paused resume, defeat/victory menu dismissal, faction/map/seed changes, rematch, repeated fresh matches, stale-input reset, visible failure and retry.');
  console.log('Setup-choice checks passed: faction/difficulty buttons preserve battlefield and seed, direct edits synchronize, partial input remains intact, and randomized seeds survive later choices.');
  console.log('Team controller checks passed: every player slot, all difficulty pairings, allied selection boundaries, own-only queues/refunds, and ghost control.');
  console.log('Source-entry guidance checks passed: raw file explains PLAY PACMAN, standalone and server launch remain enabled.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
