/* Cinder Relay | launch bay, field instruments and quartermaster. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const ui = {g:null,screen:'home',kit:0,contract:null,layout:'keyboard-pad',guide:'gun',guidePage:0,inventory:'gun',parent:'home',replacing:null,reforge:null,lastFocus:null,signature:''};
  const escape = value => String(value ?? '').replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtTime = seconds => {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return [Math.floor(n / 60), n % 60].map(v => String(v).padStart(2,'0')).join(':');
  };
  const pct = (x,max) => Math.min(100,Math.max(0,(Number(x)||0) / (max||1) * 100)) + '%';
  const act = (op,label,cls='secondary',value='',disabled=false) => '<button class="'+cls+'" data-op="'+escape(op)+'" data-value="'+escape(value)+'"'+(disabled?' disabled':'')+'>'+escape(label)+'</button>';
  const iconMaps = {
    settings:['00011000','01011010','01111110','11100111','11100111','01111110','01011010','00011000'],
    flag:['01000000','01111110','01111100','01111000','01000000','01000000','11100000'],
    data:['00011000','00111100','01100110','11000011','01100110','00111100','00011000'],
    hull:['001100','001100','111111','111111','001100','001100'],
    shield:['1111111','1100011','1100011','0100010','0110110','0011100','0001000'],
    pause:['110011','110011','110011','110011','110011','110011'],
    dash:['11001100','01100110','00110011','01100110','11001100'],
    pack:['00111100','01100110','11111111','11000011','11011011','11111111','01111110']
  };
  function paintIcons(scope=document) {
    for (const node of scope.querySelectorAll('[data-icon]')) {
      if (node.firstChild) continue;
      const pat=iconMaps[node.dataset.icon];
      if (!pat) continue;
      const c=document.createElement('canvas'); c.width=pat[0].length; c.height=pat.length; c.className='icon-art'; c.setAttribute('aria-hidden','true');
      const ctx=c.getContext('2d'); ctx.fillStyle=getComputedStyle(node).color;
      pat.forEach((row,y)=>[...row].forEach((p,x)=>{if (p==='1') ctx.fillRect(x,y,1,1)}));
      node.append(c);
    }
  }
  function paintTitle() {
    const font={
      C:['0111110','1111111','1100000','1100000','1100000','1100000','1100000','1111111','0111110'],
      I:['111','111','111','111','111','111','111','111','111'],
      N:['1100011','1110011','1110011','1111011','1101111','1100111','1100111','1100011','1100011'],
      D:['1111100','1111110','1100111','1100011','1100011','1100011','1100111','1111110','1111100'],
      E:['1111111','1111111','1100000','1100000','1111110','1100000','1100000','1111111','1111111'],
      R:['1111110','1111111','1100011','1100011','1111110','1111100','1101110','1100111','1100011'],
      L:['1100000','1100000','1100000','1100000','1100000','1100000','1100000','1111111','1111111'],
      A:['0011100','0111110','1110111','1100011','1100011','1111111','1111111','1100011','1100011'],
      Y:['1100011','1100011','0110110','0111110','0011100','0011100','0011100','0011100','0011100']
    };
    const c=document.createElement('canvas'); c.width=276;c.height=135; const ctx=c.getContext('2d');
    ['CINDER','RELAY'].forEach((word,line)=>{
      let dx=1; ctx.fillStyle=line?'#ff884d':'#f5efdc';
      for(const ch of word){
        const grid=font[ch];
        grid.forEach((row,y)=>Array.from(row).forEach((cell,x)=>{if(cell==='1')ctx.fillRect(dx+x*6,2+line*69+y*7,6,7)}));
        dx+=(grid[0].length+1)*6;
      }
    });
    const h=document.querySelector('h1'); h.setAttribute('aria-label','Cinder Relay'); c.setAttribute('aria-hidden','true');h.replaceChildren(c);
  }
  function portrait(c,kind,id,time=0) {
    if(!c)return;
    const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height); ctx.imageSmoothingEnabled=false;
    if(kind==='effect'){
      if(!ChassisArt.draw(ctx,id)&&!MechanicArt.draw(ctx,id))FieldArt.draw(ctx,id);
      return;
    }
    if(id == null || id<0){ctx.fillStyle='#536260';ctx.fillRect(c.width/2-4,c.height/2,8,2);return}
    Art.portrait(ctx,kind,Number(id),c.width/2,c.height/2,Math.min(c.width,c.height)*.91,time);
  }
  function art(kind,id,cls='') {return '<canvas aria-hidden="true" class="'+cls+'" width="'+(cls?'140':'53')+'" height="'+(cls?'60':'48')+'" data-art="'+escape(kind||'')+'" data-id="'+escape(id??0)+'"></canvas>'}
  function effectTile(key,cls){
    return '<canvas aria-hidden="true" class="effect-art '+cls+'" width="84" height="40" data-art="effect" data-id="'+escape(key)+'"></canvas>';
  }
  function rewardArt(card){
    if(card.kind==='augment')return effectTile('augment/'+card.id+'/'+card.branch,'card-art');
    if(card.artKind)return art(card.artKind,card.artId,'card-art');
    return effectTile(card.name,'card-art');
  }
  function vista(id,cls='vista'){return '<canvas aria-hidden="true" class="'+cls+'" width="400" height="76" data-vista="'+Number(id)+'"></canvas>'}
  function paintPanel(){
    for(const cv of byId('panel').querySelectorAll('canvas[data-art]'))portrait(cv,cv.dataset.art,cv.dataset.id);
    if(window.Art?.landscape)for(const cv of byId('panel').querySelectorAll('canvas[data-vista]'))Art.landscape(cv.getContext('2d'),Number(cv.dataset.vista),0,0,cv.width,cv.height);
  }
  function titled(kicker,title,body,{close=true,narrow=false}={}){
    const panel=byId('panel');const opening=byId('scrim').hidden;
    const oldTitle=panel.getAttribute('aria-label'), previous=panel.contains(document.activeElement)?document.activeElement:null;
    const oldControl=previous?.dataset?.op, oldValue=previous?.dataset?.value, setting=previous?.dataset?.setting;
    if(opening)ui.lastFocus=document.activeElement;
    panel.className=narrow?'narrow':'';panel.setAttribute('aria-label',title);
    panel.innerHTML='<header class="panel-head"><div><div class="kicker">'+escape(kicker)+'</div><h2>'+escape(title)+'</h2></div>'+(close?'<button class="icon-btn" data-op="back" aria-label="Back" title="Back (Esc)">×</button>':'')+'</header><div class="panel-body">'+body+'</div>';
    byId('scrim').hidden=false;byId('app').inert=true;paintPanel();
    if(opening||oldTitle!==title)panel.scrollTop=0;
    if(document.body.classList.contains('pad-nav')||previous){
      const buttons=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      const same=oldTitle===title&&buttons.find(b=>(oldControl&&b.dataset.op===oldControl&&b.dataset.value===oldValue)||(setting&&b.dataset.setting===setting));
      const target=same||panel.querySelector('[data-op=choice],[data-op=route],.primary:enabled,.gear-card.selected:enabled,.filter.on:enabled')||panel.querySelector('.panel-body button:enabled,.panel-body input:enabled')||buttons[0];
      (target||panel).focus({preventScroll:!!same});
    }else if(opening)panel.focus({preventScroll:true});
  }
  function closePanel(){
    const hadPanel=!byId('scrim').hidden;
    byId('scrim').hidden=true;byId('app').inert=false;
    if(hadPanel&&ui.screen==='home'&&ui.lastFocus?.isConnected)ui.lastFocus.focus({preventScroll:true});
    if(ui.screen==='play'&&document.activeElement instanceof HTMLElement)document.activeElement.blur();
  }
  function metric(label,value){return '<div class="metric"><small>'+escape(label)+'</small><strong>'+escape(value)+'</strong></div>'}
  function kitOwned(g,id){return id===0||(g.meta.unlockedKits||g.meta.unlocked||[]).includes(id)}
  function updateBay(g){
    const kit=Progress.kits[ui.kit]||Progress.kits[0];
    byId('bay-kit-name').textContent=kit.name;byId('bay-record').textContent=String(g.meta.best||g.meta.deepest||0).padStart(2,'0');
    byId('bay-data').textContent=g.meta.data||0;portrait(byId('bay-kit'),'suit',kit.suit);
    const endless=Progress.endlessUnlocked(g.meta)?act('endless-setup','Endless expedition','secondary'):'';
    byId('launch-actions').innerHTML=(g.saved?act('resumeSave','Resume expedition','primary big')+act('newrun','New solo run','secondary'):act('deploy','Deploy solo','primary big'))+act('coop-setup','2-player co-op','secondary')+endless;
    const saved=g.saveInfo, checkpoint=byId('checkpoint-summary');
    checkpoint.hidden=!saved;
    if(saved){
      const location=World.maps[saved.mapId]?.name||'Expedition';
      const position=saved.screen==='routes'?'Beacon':saved.screen==='junction'?'Refit junction':saved.screen==='lab'?(saved.labName||'Labyrinth checkpoint'):'Room '+(saved.room+1)+'/4';
      const crew=saved.coopLayout==='dual-pad'?'2 controllers':saved.coopLayout==='keyboard-pad'?'Keyboard + controller':'Solo';
      checkpoint.textContent=(saved.mode==='endless'?'Endless · ':'')+crew+' · '+location+' · Gate '+saved.stage+' · '+position+' · Lv '+saved.level;
    }
  }
  const bindings=[
    ['Move','WASD / Arrows','Left stick','Drag the left half of the arena'],
    ['Aim and fire','Mouse / Left click','Point the right stick to swivel the crosshair. Release to hold that direction. RT fires.','Drag the right half to aim and fire'],
    ['Dash','Space','LT','Dash'],
    ['Active abilities','Q / E · hold to aim, release to cast directional skills','LB / RB · hold to aim directional skills','Tap a fitted ability'],
    ['Swap weapon','Tab / Wheel','Y','Tap the other weapon or Swap'],
    ['Reload','R','X','Reload'],
    ['Interact','F','A','Tap the prompt or Interact'],
    ['Equipment','I','View / Back button','Pack icon'],
    ['Pause / back','Esc','Start to pause / B to return','Pause icon'],
    ['Navigate menus','Tab / Shift+Tab, Enter','D-pad or left stick to move, A to select. Left/right adjusts a focused slider.','Tap an option']
  ];
  function coopSetup(g){
    const layouts=[['keyboard-pad','Keyboard + controller','P1 uses keyboard and mouse or touch. P2 uses the first controller.'],['dual-pad','Two controllers','P1 uses the first controller. P2 uses the second.']];
    const options=layouts.map(([id,name,desc])=>'<button class="gear-card'+(id===ui.layout?' selected':'')+'" data-op="coop-layout" data-value="'+id+'" aria-pressed="'+(id===ui.layout)+'"><h3>'+name+'</h3><p>'+desc+'</p></button>').join('');
    const warning=g.saved?'<p class="msg">Deploying replaces your current checkpoint.</p>':'';
    titled('LOCAL CO-OP',ui.endlessCrew?'Two-player endless expedition':'Two-player expedition','<div class="card-grid">'+options+'</div><p class="msg" id="pad-connection" aria-live="polite"></p><p class="detail-text">Press a button on each controller to connect. Use the D-pad or left stick to move through menus and A to select.</p><p class="detail-text">Each pilot drafts their own gear. If one pilot falls, stand beside them for two seconds to revive them.</p>'+warning+'<div class="panel-actions">'+act('deploy-coop','Deploy together','primary')+act('back',ui.endlessCrew?'Back':'Return to bay')+'</div>',{narrow:true});
    updatePadConnection();
  }
  function updatePadConnection(){
    const el=byId('pad-connection');
    if(!el)return;
    const count=window.CrewInput?.count()||0, required=ui.layout==='dual-pad'?2:1;
    const launch=byId('panel').querySelector('[data-op="deploy-coop"]');
    launch.disabled=count<required;
    el.textContent=count+' controller'+(count===1?'':'s')+' connected · '+(count<required?'Connect '+(required-count)+(count===0?'':' more')+' to deploy':'Ready to deploy ('+required+' required)');
  }
  let controlMode=0;
  function controls(){
    const modes=['Keyboard & mouse','Controller','Touch'];
    const tools='<div class="toolbar">'+modes.map((v,i)=>act('control-mode',v,'filter'+(controlMode===i?' on':''),i)).join('')+'</div>';
    titled('FIELD MANUAL','Controls',tools+bindings.map(r=>'<div class="control-row"><strong>'+r[0]+'</strong><span>'+escape(r[1+controlMode])+'</span></div>').join(''),{narrow:true});
  }
  function kitPanel(g){
    const kits=Progress.kits.map((v,i)=>{
      const owned=kitOwned(g,i);const can=owned||g.meta.data>=v.cost;
      return '<button data-op="kit" data-value="'+i+'" class="gear-card'+(ui.kit===i?' selected':'')+'"'+(!can?' disabled':'')+'>'+art('suit',v.suit,'card-art')+'<span class="eyeline">'+(owned?'STARTER KIT':'LOCKED KIT')+'</span><h3>'+escape(v.name)+'</h3><p>'+escape(v.desc)+'</p><span class="card-action">'+(ui.kit===i?'Selected':owned?'Select kit →':'Unlock · '+v.cost+' data')+'</span></button>';
    }).join('');
    const contract=Progress.contracts.find(c=>c.id===ui.contract);
    const content='<div class="card-grid">'+kits+'</div><div class="panel-actions">'+act('back','Return to bay','primary')+act('contracts',contract?contract.name:'Contracts','secondary')+'<span class="item-meta">'+escape(g.meta.data||0)+' Relay Data</span></div>';
    titled('LAUNCH BAY','Starter kits',content);
  }
  function contractPanel(g){
    const items=[{id:'',name:'Standard expedition',desc:'Deploy with the standard gate rewards.',cost:0},...(Progress.contracts||[])];
    const cards=items.map(v=>{
      const owned=!v.id||(g.meta.unlockedContracts||g.meta.contracts||[]).includes(v.id);
      return '<button class="gear-card'+((ui.contract||'')===v.id?' selected':'')+'" data-op="contract" data-value="'+escape(v.id)+'"'+(!owned&&g.meta.data<v.cost?' disabled':'')+'><h3>'+escape(v.name)+'</h3><p>'+escape(v.desc)+'</p><span class="card-action">'+(!owned?'Unlock · '+v.cost+' data':(ui.contract||'')===v.id?'Selected':'Select contract →')+'</span></button>';
    }).join('');
    titled('LAUNCH BAY','Contracts','<div class="card-grid">'+cards+'</div><div class="panel-actions">'+act('kits','Starter kits','primary')+'</div>');
  }
  function records(g){
    const m=g.meta;
    const fields=[['DEEPEST GATE',m.best||m.deepest||0],['FIRST CLEAR',m.firstClearTime?fmtTime(m.firstClearTime):'—'],['EXPEDITIONS',m.runs||0],['CLEARS',m.clears||0],['RELAY DATA',m.data||0],['CONTRACT GATES',m.contractedStages||0]];
    const last=m.lastRun||m.last;
    const detail=last?'<h3 class="subhead">Last expedition</h3><p>'+escape((last.extracted?'Extracted':'Run ended')+' · Gate '+(last.depth??0)+' · '+fmtTime(last.elapsed))+'</p>':'';
    titled('LAUNCH BAY','Expedition record','<div class="metrics">'+fields.map(f=>metric(...f)).join('')+'</div>'+detail+pilotLoadouts(last),{narrow:true});
  }
  const settingsList=[
    ['volume','Effects volume','range'],['music','Music volume','range'],['friendly','Friendly effect opacity','range'],['assist','Controller aim assist','range'],
    ['flashes','Impact flashes','checkbox'],['shake','Screen shake','checkbox'],['outline','Hostile projectile outlines','checkbox'],
    ['adaptiveResolution','Adaptive resolution in crowded fights','checkbox']
  ];
  function settings(g){
    const body=settingsList.map(([key,name,type])=>{
      const id='setting-'+key;const value=g.settings[key];
      return '<div class="settings-row"><label for="'+id+'">'+name+'</label><input id="'+id+'" data-setting="'+key+'" type="'+type+'" '+(type==='range'?'min="0" max="100" value="'+Math.round(100*(value??1))+'"':value?'checked':'')+'>'+(type==='range'?'<output for="'+id+'">'+Math.round(100*(value??1))+'%</output>':'')+'</div>';
    }).join('');
    titled('OPTIONS','Settings',body+'<div class="panel-actions">'+act('back','Done','primary')+act('controls','Controls','secondary')+'</div>',{narrow:true});
  }
  const guideTabs={gun:'Weapons',ability:'Actives',suit:'Armor',enemy:'Enemies',boss:'Bosses',map:'Sectors'};
  const collections=()=>({gun:Combat.guns,ability:Combat.abilities,suit:Progress.suits,enemy:Foes.defs,boss:Foes.bosses,map:World.maps});
  const guidePageSize=4;
  function guide(){
    const tab=ui.guide;const coll=collections()[tab];
    const pages=Math.ceil(coll.length/guidePageSize);
    ui.guidePage=Math.min(Math.max(ui.guidePage,0),pages-1);
    const start=ui.guidePage*guidePageSize;
    const list=coll.slice(start,start+guidePageSize).map((v,offset)=>{
      const i=start+offset;
      const tag=v.family||v.role||v.faction||(tab==='ability'?'Cooldown '+v.cooldown+'s':tab==='map'?(i<5?'Opening sector':'Endless sector'):'Major encounter');
      const notes=[v.desc||v.description||'',tab==='ability'&&v.augments?'Augments · '+v.augments.join(' / '):'',tab==='boss'&&v.phases?'Phases · '+v.phases.join(' / '):''].filter(Boolean).join(' ');
      const inspect=tab==='boss'?act('boss-intel','Attack patterns','small-btn',i):'';
      return '<article class="entry"'+(inspect?'':' tabindex="0"')+'>'+(tab==='map'?vista(i,'map-thumb'):art(tab,i))+'<div class="entry-copy"><div class="eyeline">'+escape(String(tag).toUpperCase())+'</div><h3>'+escape(v.name)+'</h3><p>'+escape(notes)+'</p></div>'+inspect+'</article>';
    }).join('');
    const pager='<nav class="guide-pager" aria-label="Field guide pages">'+act('guide-page','Previous','small-btn','prev',ui.guidePage===0)+'<span aria-live="polite">Page '+(ui.guidePage+1)+' of '+pages+'</span>'+act('guide-page','Next','small-btn','next',ui.guidePage===pages-1)+'</nav>';
    const odds=tab==='gun'?'<div class="rarity-odds" aria-label="Drop chance and base power by rarity">'+Combat.rarityOdds.map(tier=>
      '<div data-rarity="'+escape(tier.name)+'"><strong>'+escape(tier.name)+'</strong><span>'+tier.chance+'% drop</span><span>'+Number((1+tier.damageBonus).toFixed(2))+'× hit damage</span></div>').join('')+'</div>':'';
    titled('FIELD MANUAL','Field guide','<div class="toolbar">'+Object.entries(guideTabs).map(([key,label])=>act('guide-tab',label,'filter'+(key===tab?' on':''),key)).join('')+'<span class="catalog-total">'+coll.length+' ENTRIES</span></div>'+odds+pager+'<div class="entry-list">'+list+'</div>');
  }
  function bossIntel(id){
    const boss=Foes.bosses[id];
    const patterns=window.BossPatterns[id].moves.map(move=>
      '<section class="entry" tabindex="0"><div class="entry-copy"><div class="eyeline">FROM PHASE '+(move.minPhase||1)+'</div>'+
      '<h3>'+escape(move.name)+'</h3><p>'+escape(move.counter)+'</p></div></section>').join('');
    titled('FIELD GUIDE / ATTACK PATTERNS',boss.name,'<p>Holding position or flying a steady course lets this boss mark your route. Once the floor lights up, the mark stays put. Change direction to leave it behind.</p><div class="entry-list">'+patterns+'</div>'+
      '<div class="panel-actions">'+act('back',ui.parent==='pause'?'Back to pause':'Back to bosses','primary')+'</div>');
    byId('panel').querySelector('.entry')?.focus();
  }
  function pause(g){
    const mapButton=g.map?.lab?act('survey','Exploration map'):'';
    const boss=g.map?.bossEntity;
    const bossButton=boss?.hp>0?act('boss-intel','Boss attack patterns','secondary',boss.id):'';
    titled('EXPEDITION','Paused','<div class="pause-list">'+act('resume','Resume expedition','primary')+bossButton+mapButton+act('inventory','Equipment')+act('settings','Settings')+act('controls','Controls')+act('leave','Return to launch bay','quiet')+'</div>',{narrow:true});
  }
  function survey(g){
    const lab=g.map.lab;
    const visited=lab.rooms.filter(r=>r.visited).length;
    const objective=g.objective||Labyrinth.goal(lab);
    const keyState=lab.key.taken?'Key recovered':'Key missing';
    const lockState=lab.door.open?'Bulkhead open':'Bulkhead locked';
    const crew=g.players.length>1?' · P2 in orange':'';
    const legend='<div class="survey-legend">'+(g.map.side?'<span><b class="map-cache">▣</b> Supply cache</span>':'')+
      (g.map.task?'<span><b class="map-objective">◆</b> Mission objective</span>':'')+
      (g.map.bossRoom?'<span><b class="map-boss">⌃</b> Boss vault</span>':'')+'</div>';
    titled('EXPLORATION MAP',lab.layoutName,
      '<div class="survey-status"><strong>'+escape(objective)+'</strong><span>'+visited+'/'+lab.rooms.length+' rooms charted</span></div>'+
      '<canvas id="survey-chart" width="640" height="320" aria-label="Discovered passages and pilot positions"></canvas>'+
      '<div class="survey-status"><span>P1 in mint'+crew+'</span><span>'+keyState+' · '+lockState+'</span></div>'+legend+
      '<div class="panel-actions">'+act('back','Back to pause','primary')+'</div>');
    const chart=byId('survey-chart');
    Sight.drawMap(chart.getContext('2d'),g,{x:0,y:0,width:chart.width,height:chart.height,labels:true});
  }
  function isFull(card,p){
    const types={gun:['guns',4],active:['abilities',4],armor:['suits',2]};
    const item=types[card.kind];
    return item&&p[item[0]].length>=item[1];
  }
  function gunMeta(item,location=''){
    const rarity=Combat.rarityOf(item),rank=Combat.rankOf(item);
    return '<span class="gun-meta" data-rarity="'+escape(rarity)+'"><strong>'+escape(rarity)+'</strong>'+
      (location?'<span>'+escape(location)+'</span>':'')+'<span>Tune '+rank+'/3</span></span>';
  }
  function weaponTuning(g){
    const p=g.player,view=g.forPilot(p);
    const options=p.guns.map((gun,i)=>{
      const rank=Combat.rankOf(gun),def=Combat.guns[gun.id],slot=p.ready.indexOf(i);
      const location=slot<0?'Reserve':'Ready '+(slot+1);
      const next={...gun,upgradeLevel:rank+1};
      const stat=(get,unit)=>get(view,gun).toFixed(2)+' → '+get(view,next).toFixed(2)+unit;
      const body=rank>=3?'<span class="tune-max">Fully upgraded</span>':
        '<span class="tune-stats"><span><small>Hit damage</small><b>'+stat(Combat.damageFor,'')+'</b></span>'+
        '<span><small>Fire rate</small><b>'+stat(Combat.rateFor,'/s')+'</b></span></span>';
      return '<button class="tune-option" data-op="tune-apply" data-value="'+i+'"'+(rank>=3?' disabled':'')+'>'+
        art('gun',gun.id)+'<span class="tune-copy">'+gunMeta(gun,location)+'<strong>'+escape(gunName(gun))+'</strong>'+
        '<small>'+escape(def.family)+(rank<3?' · Upgrade to '+(rank+1)+'/3':'')+'</small></span>'+body+'</button>';
    }).join('');
    const owner=g.players?.length>1?'PLAYER '+((g.rewardOwner||0)+1)+'  /  ':'';
    titled(owner+'LEVEL '+(g.draftLevel||p.level)+'  /  FIELD REQUISITION','Choose a weapon to upgrade',
      '<div class="tune-options">'+options+'</div><div class="panel-actions">'+act('tune-back','Back to upgrades')+'</div>',{close:false});
  }
  function leaveTuning(g){
    show('draft',g);
    const index=g.choices.findIndex(c=>c.kind==='tuneGun');
    byId('panel').querySelector('[data-op="choice"][data-value="'+index+'"]')?.focus();
  }
  function draft(g){
    const cards=g.choices||[];const type=g.draftKind||cards[0]?.kind;
    const title={gun:'Weapon cache',active:'Active cache',armor:'Armor locker',chip:'Weapon chip',level:'Choose an upgrade',overclock:'Overclock'}[type]||'Choose an upgrade';
    const list=cards.map((v,i)=>{
      const tag=v.kind==='gun'?gunMeta(v.item,Combat.guns[v.id].family):'<span class="eyeline">'+escape(String(v.tag||v.kind||'').toUpperCase())+'</span>';
      const tier=v.kind==='gun'?' data-rarity="'+escape(Combat.rarityOf(v.item))+'"':'';
      return '<button class="gear-card" data-op="choice" data-value="'+i+'"'+tier+'>'+rewardArt(v)+tag+'<h3>'+escape(v.name)+'</h3><p>'+escape(v.desc)+'</p>'+(v.detail?'<span class="item-meta">'+escape(v.detail)+'</span>':'')+(v.traits?.length?'<p>'+escape(v.traits.join(' '))+'</p>':'')+'<span class="card-action">'+(v.kind==='tuneGun'?'Choose weapon':'Select')+' →</span></button>';
    }).join('');
    const tools=act('reroll','Reroll · '+(g.rerolls??0),'secondary','',!(g.rerolls>0))+act('inventory','Inspect equipment','quiet');
    const owner=g.players?.length>1?'PLAYER '+((g.rewardOwner||0)+1)+'  /  ':'';
    titled(owner+'GATE '+String(g.stage).padStart(2,'0')+'  /  FIELD REQUISITION',title,'<div class="card-grid">'+list+'</div><div class="panel-actions">'+tools+'</div>',{close:false});
  }
  const gunName=w=>Combat.gunName?Combat.gunName(w):[w.prefix,Combat.guns[w.id]?.name,w.suffix].filter(Boolean).join(' ');
  function armorDetail(g,id,roll){
    const p=g.player;
    const preview={...p,suit:id,suitRolls:{...p.suitRolls,[id]:roll||{}}};
    Progress.recalc({...g,player:preview});
    const stats=preview.stats;
    const handling=[['reload','reload speed'],['cooling','cooling'],['swapSpeed','swap speed']]
      .filter(([key])=>Math.abs(stats[key]||0)>.001)
      .map(([key,label])=>Math.round(100*(1+stats[key]))+'% '+label);
    return [preview.maxHp+' max hull',preview.maxShield+' shield',
      Math.round(100*(1+stats.move))+'% move speed',...handling,
      Progress.armorPrefixes[roll?.prefix]?.desc,Progress.armorSuffixes[roll?.suffix]].filter(Boolean).join(' · ');
  }
  function storageInfo(g,kind) {
    const p=g.player;
    if(kind==='gun')return p.guns.map(w=>({name:gunName(w),id:w.id,item:w,desc:Combat.guns[w.id].desc,detail:Progress.weaponDetail(g.forPilot(p),w),artKind:'gun'}));
    if(kind==='armor')return p.suits.map((id,i)=>({name:Progress.equippedName(g,i),id,desc:Progress.suits[id].desc,detail:armorDetail(g,id,p.suitRolls?.[id]),artKind:'suit'}));
    return p.abilities.map(w=>{
      const def=Combat.abilities[w.id];
      return {name:def.name,id:w.id,desc:def.desc,detail:'Base cooldown '+def.cooldown+'s · '+(def.augments[w.augment-1]||'Base ability'),artKind:'ability'};
    });
  }
  function exchange(g){
    const card=ui.replacing;if(!card)return;
    const items=storageInfo(g,card.kind);
    const p=g.player;
    const detail=card.kind==='armor'?armorDetail(g,card.id,card.roll):card.detail;
    const incomingTag=card.kind==='gun'?gunMeta(card.item,'Incoming '+Combat.guns[card.id].family):'<span class="eyeline">INCOMING · '+escape(card.tag)+'</span>';
    const incoming='<article class="entry incoming-item">'+art(card.artKind,card.id)+'<div class="entry-copy">'+incomingTag+'<h3>'+escape(card.name)+'</h3><p>'+escape(card.desc)+'</p><div class="item-meta">'+escape([detail,...(card.traits||[])].filter(Boolean).join(' · '))+'</div></div></article>';
    const list=items.map((v,i)=>{
      const index=(card.kind==='gun'?p.ready:p.activeSlots).indexOf(i);
      const status=card.kind==='armor'?(v.id===p.suit?'Worn':'Spare'):index<0?'Reserve':(card.kind==='gun'?'Ready ':'Active ')+(index+1);
      const header=v.item?gunMeta(v.item,status):'<span class="eyeline">'+status+'</span>';
      return '<article class="entry">'+art(v.artKind,v.id)+'<div class="entry-copy">'+header+'<h3>'+escape(v.name)+'</h3><p>'+escape(v.desc)+'</p><div class="item-meta">'+escape(v.detail)+'</div></div>'+act('replace','Replace','small-btn',i)+'</article>';
    }).join('');
    const owner=g.players?.length>1?'PLAYER '+((g.rewardOwner||0)+1)+'  /  ':'';
    titled(owner+'INVENTORY FULL','Choose a trade',incoming+'<h3 class="subhead">Choose a carried item to replace</h3><div class="entry-list">'+list+'</div><div class="panel-actions">'+act('draft-back','Choose another','secondary')+act('salvage','Salvage new item','secondary')+'</div>',{close:false});
  }
  function inventory(g){
    const p=g.player;if(!p)return;
    const safe=!!g.safeRefit;const tab=ui.inventory;
    const labels={gun:'Weapons',active:'Actives',armor:'Armor',passive:'Upgrades',shop:'Workshop'};
    const tabs=Object.entries(labels).filter(([key])=>key!=='shop'||safe).map(([key,label])=>act('inv-tab',label,'filter'+(key===tab?' on':''),key)).join('');
    const owners=g.players?.length>1?'<div class="toolbar pilot-tabs" aria-label="Pilot loadout">'+g.players.map((pilot,i)=>act('inspect-pilot','P'+(i+1)+' Loadout','filter'+(pilot===p?' on':''),i,pilot===p||!g.canInspectOther)).join('')+'</div>':'';
    let body='';
    if(tab==='passive'){
      const upgrades=Object.entries(p.upgrades||{}).filter(([name,rank])=>rank>0&&!p.keystones?.includes(name));
      body=upgrades.length?'<div class="owned-upgrades">'+upgrades.map(([name,rank])=>{
        const def=Progress.passives.find(d=>d.name===name);
        const badge=def?.cap>1?' <small>×'+rank+'</small>':'';
        return '<article class="entry owned-effect" tabindex="0">'+(def?effectTile(name,'loadout-art'):'')+
          '<div class="entry-copy"><h3>'+escape(name)+badge+'</h3><p>'+escape(def?.desc||'')+'</p></div></article>';
      }).join('')+'</div>':p.keystones?.length?'':'<p class="detail-text">Earn XP to draft your first upgrade.</p>';
      if(p.overclock)body+='<h3 class="subhead">Overclock</h3><article class="entry owned-effect" tabindex="0">'+
        effectTile(p.overclock,'loadout-art')+'<div class="entry-copy"><h3>'+escape(p.overclock)+'</h3><p>'+
        escape(Progress.overclocks.find(d=>d.name===p.overclock)?.desc||'')+'</p></div></article>';
      if(safe&&p.overclocks?.length)body+='<div class="tool-row">'+p.overclocks.map((name,i)=>act('fit-overclock',name,'small-btn',i,p.overclock===name)).join('')+act('fit-overclock','Unequip','small-btn',-1,!p.overclock)+'</div>';
      if(p.keystones?.length)body+='<h3 class="subhead">Keystones</h3><div class="entry-list">'+p.keystones.map((key,i)=>'<div class="entry">'+effectTile(key,'loadout-art')+'<div class="entry-copy"><h3>'+escape(key)+'</h3><p>'+((p.keystoneSlots||[]).includes(key)?'Equipped':'In reserve')+'</p></div>'+(safe?act('fit-keystone','Slot 1','small-btn',i+',0')+act('fit-keystone','Slot 2','small-btn',i+',1'):'')+'</div>').join('')+'</div>';
    }else if(tab==='shop'&&safe){
      body=workshop(g);
    }else{
      const kind=['gun','active','armor'].includes(tab)?tab:'gun';
      const items=storageInfo(g,kind);
      body='<div class="entry-list">'+items.map((v,i)=>{
        const slots=kind==='gun'?p.ready:p.activeSlots;const idx=kind==='armor'?-1:slots.indexOf(i);
        const tag=kind==='armor'?(p.suit===v.id?'WORN':'SPARE'):idx>=0?(kind==='gun'?'READY ':'ACTIVE ')+(idx+1):'RESERVE';
        let buttons='';
        if(safe){
          buttons=kind==='armor'?act('fit-armor','Wear','small-btn',i,p.suit===v.id):[0,1].map(slot=>act('fit-'+kind,(kind==='gun'?'Ready ':'Slot ')+(slot+1),'small-btn',i+','+slot,idx===slot)).join('');
          if(kind==='active'&&p.abilities[i].learned?.length){
            const item=p.abilities[i];
            buttons+=[0,...item.learned].map(n=>act('fit-augment',Combat.abilities[item.id].augments[n-1]||'Base','small-btn',i+','+n,item.augment===n)).join('');
          }
        }
        const header=v.item?gunMeta(v.item,tag):'<div class="eyeline">'+tag+'</div>';
        return '<article class="entry">'+art(v.artKind,v.id)+'<div class="entry-copy">'+header+'<h3>'+escape(v.name)+'</h3><p>'+escape(v.desc)+'</p><div class="item-meta">'+escape(v.detail)+'</div></div><div class="entry-actions">'+buttons+'</div></article>';
      }).join('')+'</div>';
      if(!safe)body+='<p class="msg">Refit at a junction or reward cache.</p>';
      if(safe&&kind==='armor')body+='<div class="panel-actions">'+act('appearance','Armor appearance')+'</div>';
    }
    titled('FIELD EQUIPMENT  /  '+Math.floor(p.scrap||0)+' SCRAP','Loadout',owners+'<div class="toolbar">'+tabs+'</div>'+body);
  }
  function workshop(g){
    const p=g.player;
    const items=p.guns.map((w,i)=>{
      const chips=(p.chips||[]).filter((chip,j,all)=>all.indexOf(chip)===j&&(!Combat.compatibleChips||Combat.compatibleChips(w.id).includes(chip)));
      let extra='';
      if(ui.reforge?.index===i){
        extra='<div class="entry-list">'+ui.reforge.options.map((name,n)=>'<div>'+act('buy-affix',name,'small-btn',n)+'<p>'+escape(Progress.affixInfo?.[name]||'')+'</p></div>').join('')+act('cancel-affix','Cancel','small-btn')+'</div>';
      }
      return '<section class="gear-card">'+art('gun',w.id,'card-art')+gunMeta(w)+'<h3>'+escape(gunName(w))+'</h3><div class="item-meta">'+escape(w.chip||'Empty chip socket')+'</div><div class="tool-row">'+(w.chip?act('install-chip','Remove chip','small-btn',i+'|'):'')+chips.map(ch=>act('install-chip','Fit '+ch,'small-btn',i+'|'+ch)).join('')+'</div><div class="tool-row">'+['prefix','suffix'].map(s=>act('roll-affix','Reforge '+s,'small-btn',i+'|'+s,p.scrap<18)).join('')+'</div>'+extra+'</section>';
    }).join('');
    return '<p class="detail-text">Fit a compatible chip or reforge one affix for 18 scrap.</p><div class="card-grid">'+items+'</div>';
  }
  function appearance(g) {
    const cards=Progress.suits.map((s,i)=>{
      const owned=g.meta.cosmetics?.includes(i), wearing=g.player.skin===i;
      return '<button data-op="skin" data-value="'+i+'" class="gear-card'+(wearing?' selected':'')+'"'+(!owned&&g.meta.data<6?' disabled':'')+'>'+art('suit',i,'card-art')+'<h3>'+escape(s.name)+'</h3><span class="card-action">'+(wearing?'Worn':owned?'Use appearance →':'Unlock · 6 data')+'</span></button>';
    }).join('');
    titled('FIELD EQUIPMENT  /  '+g.meta.data+' RELAY DATA','Armor appearance','<p>Choose how your trooper looks. Armor stats come from the suit in your loadout.</p><div class="toolbar">'+act('skin','Use equipped suit','filter','default',g.player.skin==null)+'</div><div class="card-grid">'+cards+'</div>');
  }
  function junction(g){
    const p=g.player;const cost=Progress.repairCost?.(g)??12;
    const body=vista(g.mapId)+'<p>'+escape(g.encounter||World.maps[g.mapId].name)+' secured. Refit your equipment before the next engagement.</p><div class="metrics">'+metric('HULL',Math.ceil(p.hp)+' / '+p.maxHp)+metric('SCRAP',p.scrap)+metric('LEVEL',p.level)+'</div><div class="panel-actions">'+act('next','Continue →','primary')+act('inventory','Refit equipment')+act('repair','Repair +30 hull · '+cost+' scrap','secondary','',p.hp>=p.maxHp||p.scrap<cost)+'</div>';
    const owner=g.players?.length>1?'PLAYER '+((g.rewardOwner||0)+1)+'  /  ':'';
    titled(owner+'GATE '+String(g.stage).padStart(2,'0')+'  /  SAFE JUNCTION','Field refit',body+checkpointExit(g),{close:false});
  }
  function routes(g){
    const choices=g.routeOptions||[];
    const options=choices.map((route,i)=>{
      const arrival=Labyrinth.preview({...g,stage:g.stage+1,room:0,mapId:route.mapId,route});
      return '<button class="gear-card" data-op="route" data-value="'+i+'">'+vista(route.mapId)+
        '<span class="eyeline">'+escape(route.objective)+'</span><h3>'+escape(route.name)+'</h3>'+
        '<p>'+escape(arrival.name)+' · '+arrival.rooms+' chambers on entry</p>'+
        '<div class="item-meta">'+escape(route.modifier)+' · '+escape(route.reward)+' reward</div>'+
        '<p>'+escape(route.threat||route.desc)+'</p><span class="card-action">Enter sector →</span></button>';
    }).join('');
    const unlock=g.stage===5&&g.expeditionMode!=='endless';
    const body='<p>'+(unlock?'Endless expeditions are now available in the launch bay. ':'')+'Keep your loadout and choose the next gate, or extract here.</p>'+(options?'<div class="card-grid">'+options+'</div>':'')+'<div class="panel-actions">'+act('inventory','Refit equipment')+act('extract','Extract and bank','secondary')+'</div>';
    titled('GATE '+String(g.stage).padStart(2,'0')+'  /  BEACON',unlock?'Aperture cleared':'Choose a destination',body+checkpointExit(g),{close:false});
  }
  function checkpointExit(g){
    return '<footer class="checkpoint-actions"><span>'+escape(g.saveIssue?'Checkpoint held for this session':'Checkpoint saved')+'</span>'+act('home','Return to launch bay','quiet')+'</footer>';
  }
  function pilotLoadouts(result){
    return result?.loadouts?.length>1?result.loadouts.map((load,i)=>loadoutSummary(load,'P'+(i+1)+' loadout')).join(''):loadoutSummary(result?.loadout);
  }
  function loadoutSummary(load,heading='Final loadout'){
    if(!load)return '';
    const fields=[['Armor',load.armor],['Weapons',(load.guns||[]).join(' · ')],
      ['Actives',(load.abilities||[]).join(' · ')],['Overclock',load.overclock],
      ['Keystones',(load.keystones||[]).filter(Boolean).join(' · ')]];
    return '<h3 class="subhead">'+heading+(load.level?' · Level '+escape(load.level):'')+'</h3><dl class="loadout-summary">'+fields.filter(([,val])=>val).map(([label,val])=>'<dt>'+label+'</dt><dd>'+escape(val)+'</dd>').join('')+'</dl>';
  }
  function result(g){
    const r=g.result||g.meta.last||{};
    const content=(r.reason?'<p>'+escape(r.reason)+'</p>':'')+'<div class="metrics">'+metric('GATES CLEARED',r.depth??g.cleared??0)+metric('TIME',fmtTime(r.elapsed??g.elapsed))+metric('ELIMINATIONS',r.kills??g.kills??0)+metric('RELAY DATA','+'+(r.data||0))+'</div>'+
      pilotLoadouts(r.loadout||r.loadouts?r:g.meta.last)+
      '<div class="panel-actions">'+act('restart','Deploy again','primary')+act('home','Launch bay')+'</div>';
    titled('EXPEDITION RECORD',r.extracted?'Extraction successful':'Signal lost',content,{close:false});
  }
  function renderLocal(screen,g){
    ui.screen=screen;
    if(screen==='coop-setup')coopSetup(g);
    else if(screen==='boss-intel')bossIntel(ui.bossId);
    else if(screen==='endless-setup')titled('LAUNCH BAY','Endless expedition',
      '<p>Take your starter kit into a random sector. Clear each gate to choose another route or extract. The gates keep coming for as long as you survive.</p>'+
      (g.saved?'<p class="msg">Deploying replaces your current checkpoint.</p>':'')+
      '<div class="panel-actions">'+act('endless-solo','Deploy solo','primary')+act('endless-coop','2-player co-op')+act('back','Return to bay','quiet')+'</div>',{narrow:true});
    else if(screen==='controls')controls();
    else if(screen==='survey')survey(g);
    else if(screen==='kits')kitPanel(g);
    else if(screen==='contracts')contractPanel(g);
    else if(screen==='records')records(g);
    else if(screen==='appearance')appearance(g);
    else if(screen==='exchange')exchange(g);
    else if(screen==='tune-weapon')weaponTuning(g);
    else if(screen==='confirm-new')titled('LAUNCH BAY','Start a new run?','<p>Deploying a new trooper replaces your saved expedition.</p><div class="btn-row">'+act('deploy','Deploy','primary')+act('back','Keep checkpoint')+'</div>',{narrow:true});
    else if(screen==='leave')titled('EXPEDITION','Return to launch bay?','<p>Resume later from your last checkpoint. Progress saves when you enter a sector, secure a labyrinth chamber or passage, or reach a refit.</p><div class="btn-row">'+act('home','Return to bay','primary')+act('back','Stay here')+'</div>',{narrow:true});
  }
  function show(screen,g,data={}){
    ui.g=g;
    document.querySelectorAll('.touch-pads i').forEach(knob=>{knob.style.transform=''});
    const previous=ui.screen;ui.screen=screen;
    if(screen!=='draft')ui.replacing=null;
    if(screen!=='inventory')ui.reforge=null;
    if(screen==='home'||screen==='play'){
      byId('bay').hidden=screen!=='home';byId('flight').hidden=screen!=='play';
      closePanel();
      if(screen==='home')updateBay(g);
      else {ui.signature='';hud(g)}
      return;
    }
    const homeBackdrop=screen==='guide'||screen==='settings'? !byId('bay').hidden:screen==='kits'||screen==='records';
    if(!homeBackdrop){byId('flight').hidden=!g.player;byId('bay').hidden=!!g.player}
    if(screen==='settings')settings(g);
    else if(screen==='guide')guide();
    else if(screen==='pause')pause(g);
    else if(screen==='inventory'){if(previous!=='inventory'){ui.inventory='gun';ui.reforge=null}inventory(g)}
    else if(screen==='draft'){ui.replacing=null;draft(g)}
    else if(screen==='junction')junction(g);
    else if(screen==='routes')routes(g);
    else if(screen==='result')result(g);
    else renderLocal(screen,g);
  }
  function setText(id,value){const node=byId(id);const text=String(value??'');if(node.textContent!==text)node.textContent=text}
  function hud(g){
    if(!g?.player||byId('flight').hidden)return;
    const p=g.players?.[0]||g.player, partner=g.players?.[1];
    byId('flight').classList.toggle('co-op',!!partner);
    byId('pilot-label').hidden=!partner;
    byId('partner-hud').hidden=!partner;
    if(partner){
      setText('pilot-label',p.downed?'P1 · '+(p.revive>0?Math.min(100,Math.floor(50*p.revive))+'%':'DOWN'):'P1');
      const gun=partner.guns[partner.ready[partner.selected]], gunDef=gun&&Combat.guns[gun.id];
      setText('partner-name',partner.downed?'P2 · '+(partner.revive>0?'REVIVING '+Math.min(100,Math.floor(50*partner.revive))+'%':'DOWN'):'P2');
      setText('partner-vitals',Math.ceil(Math.max(0,partner.hp))+'/'+Math.round(partner.maxHp)+' · '+Math.ceil(partner.shield)+'/'+Math.round(partner.maxShield));
      const weaponState=!gun?'':gun.reload>0?' · '+gun.reload.toFixed(1)+'s':gunDef.heat?' · '+Math.round(gun.heat*100)+'%':' · '+Math.ceil(gun.ammo);
      const partnerGun=byId('partner-weapon'),partnerRarity=gun?Combat.rarityOf(gun):'';
      if(partnerGun.dataset.rarity!==partnerRarity){
        partnerGun.dataset.rarity=partnerRarity;
        partnerGun.previousElementSibling.textContent=gun?partnerRarity.toUpperCase()+' WEAPON':'WEAPON';
      }
      const partnerRank=gun?Combat.rankOf(gun):0;
      setText('partner-weapon',(gunDef?.name||'Empty')+(partnerRank?' +'+partnerRank:'')+weaponState);
      setText('partner-actives',partner.activeSlots.map((slot,i)=>{
        const active=partner.abilities[slot];
        return (i?'RB ':'LB ')+(active?Combat.abilities[active.id].name+' '+(active.cd>0?Math.ceil(active.cd)+'s':'✓'):'—');
      }).join(' · '));
      setText('partner-dash',(partner.dashCharges??0)+' / '+(partner.maxDashCharges||2)+' · Lv '+partner.level);
    }
    setText('mission-sector',(g.expeditionMode==='endless'?'ENDLESS ':'GATE ')+String(g.stage).padStart(2,'0')+'  /  FLOOR '+((g.room||0)+1)+'/4');
    setText('mission-loc',g.map?.lab?.layoutName||World.maps[g.mapId]?.name||g.encounter);
    setText('mission-goal',g.objective||g.encounter||'');setText('mission-clock',fmtTime(g.elapsed));
    const b=g.enemies?.find(e=>e.boss&&!e.dead&&e.hp>0);
    byId('boss-readout').hidden=!b;
    if(b){
      setText('boss-name',Foes.bosses[b.id]?.name||b.name||'Major encounter');
      setText('boss-phase','PHASE '+(b.phase||1));
      byId('boss-bar').style.width=pct(b.hp,b.maxHp);
      const windingUp=b.windup>0&&!!b.attackName;
      byId('boss-intent').hidden=!windingUp;
      if(windingUp){
        setText('boss-attack',b.attackName);
        const target=g.players.indexOf(b.attackTarget);
        setText('boss-target',g.players.length>1&&target>=0?'TARGET P'+(target+1):'');
      }
    }
    const second=!!partner&&!g.prompts?.[0]&&!!g.prompts?.[1];
    const binding=second?'P2 · A':g.coopLayout==='dual-pad'?'P1 · A':partner?'P1 · F':'F';
    const cue=second?g.prompts[1]:(g.prompts?.[0]||g.prompt);
    const prompt=byId('interact-prompt');prompt.hidden=!cue||ui.screen!=='play';prompt.disabled=second;
    if(cue&&prompt.dataset.copy!==binding+cue){prompt.dataset.copy=binding+cue;prompt.innerHTML='<kbd>'+binding+'</kbd>'+escape(cue)}
    setText('hull-value',Math.ceil(Math.max(0,p.hp))+'/'+Math.round(p.maxHp));setText('shield-value',Math.ceil(Math.max(0,p.shield))+'/'+Math.round(p.maxShield));
    byId('hull-bar').style.width=pct(p.hp,p.maxHp);byId('shield-bar').style.width=pct(p.shield,p.maxShield);
    setText('level-value','LV '+p.level);byId('level-bar').style.width=pct(p.xp,Progress.levelXP(p.level));setText('scrap-value',(p.scrap||0)+' SCRAP');
    const slots=[p.guns[p.ready[0]],p.guns[p.ready[1]],p.abilities[p.activeSlots[0]],p.abilities[p.activeSlots[1]]];
    const suit=p.skin??p.suit;const key=suit+':'+slots.map(w=>w?.id??'-').join(',');
    if(key!==ui.signature){
      ui.signature=key;portrait(byId('pilot-icon'),'suit',suit);
      ['weapon-a','weapon-b','act-a','act-b'].forEach((name,i)=>portrait(byId(name).querySelector('canvas'),i<2?'gun':'ability',slots[i]?.id??-1));
    }
    ['weapon-a','weapon-b','act-a','act-b'].forEach((name,i)=>{
      const el=byId(name),item=slots[i],def=item?(i<2?Combat.guns:Combat.abilities)[item.id]:null;
      let line='Empty';let title=i<2?'Ready '+(i+1):'Active '+(i-1);
      const rarity=i<2&&def?Combat.rarityOf(item):'';
      const rank=rarity?Combat.rankOf(item):0;
      if(def){
        title=def.name+(rank?' +'+rank:'');
        if(i<2){
          if(item.reload>0)line=(def.heat?'Vent ':'Load ')+item.reload.toFixed(1)+'s';
          else if(def.heat)line=Math.round(Math.min(1,item.heat||0)*100)+'% heat';
          else if(def.charged&&item.charge>0)line='Charging';
          else line=Math.ceil(item.ammo)+' / '+Combat.capacity(g.forPilot(p),item);
        }else line=(g.coopLayout==='dual-pad'?(i===2?'LB':'RB'):(i===2?'Q':'E'))+' · '+(item.cd>.05?Math.ceil(item.cd)+'s':'Ready');
      }
      const signature=title+'|'+line+'|'+rarity;
      if(el.dataset.state!==signature){
        el.dataset.state=signature;
        if(i<2)el.dataset.rarity=rarity;
        el.querySelector('span').innerHTML='<b>'+escape(title)+'</b><small>'+escape(line)+'</small>'+
          (rarity?'<em class="hud-rarity">'+escape(rarity)+'</em>':'');
      }
      if(i<2){el.dataset.op='weapon';el.dataset.value=i;el.title=def?'Equip '+gunName(item)+' · '+rarity+' · Tune '+rank+'/3':'Empty weapon slot';}
      el.disabled=!def;
      el.classList.toggle('equipped',i<2&&p.selected===i);el.classList.toggle('ready',i>=2&&!!def&&item.cd<=.05);
    });
    const count=Math.floor(p.dashCharges??2),max=p.maxDashCharges||2,keyDash=count+'/'+max;
    if(byId('dash-pips').dataset.state!==keyDash){byId('dash-pips').dataset.state=keyDash;byId('dash-pips').innerHTML=Array.from({length:max},(_,i)=>'<b'+(i<count?' class="full"':'')+'></b>').join('')}
  }
  function local(screen){
    const current=ui.screen;
    if(!['kits','contracts','appearance','controls','records','confirm-new','leave','exchange','tune-weapon','coop-setup','endless-setup'].includes(current))ui.parent=current;
    renderLocal(screen,ui.g);
  }
  function back(){
    const screen=ui.screen,g=ui.g;
    if(screen==='boss-intel'){
      show(ui.parent==='pause'?'pause':'guide',g);
      byId('panel').querySelector('[data-op="boss-intel"][data-value="'+ui.bossId+'"]')?.focus();
      return;
    }
    if(screen==='exchange'){ui.replacing=null;show('draft',g);return}
    if(screen==='tune-weapon'){leaveTuning(g);return}
    if(screen==='contracts'){renderLocal('kits',g);return}
    if(screen==='coop-setup'&&ui.endlessCrew){renderLocal('endless-setup',g);return}
    if(['kits','controls','records','appearance','confirm-new','leave','coop-setup','survey','endless-setup'].includes(screen)){show(ui.parent||'home',g);return}
    if(['junction','routes','draft','result'].includes(screen))return;
    Game.back();
  }
  function handle(op,v=''){
    const g=ui.g,p=g?.player;
    switch(op){
      case 'bay': return;
      case 'guide': case 'settings': return Game.open(op);
      case 'boss-intel':ui.bossId=Number(v);return local(op);
      case 'kits': case 'contracts':case 'records':case 'controls':case 'appearance':case 'leave':case 'survey':return local(op);
      case 'newrun':return local('confirm-new');
      case 'endless-setup':return local(op);
      case 'endless-solo':return Game.start(ui.kit,ui.contract,'solo','endless');
      case 'endless-coop':ui.endlessCrew=true;return local('coop-setup');
      case 'coop-setup':ui.endlessCrew=false;return local(op);
      case 'coop-layout':ui.layout=v;return coopSetup(g);
      case 'deploy-coop':
        if(CrewInput.count()<(ui.layout==='dual-pad'?2:1))return updatePadConnection();
        return Game.startCoop(ui.kit,ui.contract,ui.layout,ui.endlessCrew?'endless':'campaign');
      case 'deploy': return Game.start(ui.kit,ui.contract);
      case 'resumeSave':return Game.resumeSave();
      case 'restart':return Game.restart();
      case 'home':return Game.home();
      case 'back':return back();
      case 'resume':return Game.resume();
      case 'next':return Game.next();
      case 'repair':return Game.repair();
      case 'extract':return Game.extract();
      case 'route':return Game.route(Number(v));
      case 'weapon':if(p&&p.selected!==Number(v)&&p.guns[p.ready[Number(v)]])return Game.action('swap');return;
      case 'reroll':return Game.reroll();
      case 'inventory':return ui.screen==='play'?Game.action('inventory'):Game.open('inventory');
      case 'pause':case 'interact':case 'swap':case 'dash':case 'active1':case 'active2':case 'reload':return Game.action(op);
      case 'control-mode':controlMode=Number(v);return controls();
      case 'guide-tab':ui.guide=v;ui.guidePage=0;byId('panel').scrollTop=0;return guide();
      case 'guide-page':{
        ui.guidePage+=v==='next'?1:-1;
        guide();
        const available=byId('panel').querySelector('[data-op="guide-page"][data-value="'+v+'"]:enabled')||byId('panel').querySelector('.entry[tabindex]');
        if(document.body.classList.contains('pad-nav'))available?.focus();
        return;
      }
      case 'kit':{
        const id=Number(v);
        if(!kitOwned(g,id))Game.buyKit(id);
        if(kitOwned(g,id))ui.kit=id;
        updateBay(g);return renderLocal('kits',g);
      }
      case 'contract':{
        if(v&&!g.meta.contracts.includes(v))Game.buyContract(v);
        if(!v||g.meta.contracts.includes(v))ui.contract=v||null;
        return renderLocal('contracts',g);
      }
      case 'skin':{
        const id=v==='default'?null:Number(v);
        if(id!=null&&!g.meta.cosmetics.includes(id))Game.buySkin(id);
        if(id==null||g.meta.cosmetics.includes(id))Game.setSkin(id);
        return renderLocal('appearance',g);
      }
      case 'choice':{
        const card=g.choices[Number(v)];if(!card)return;
        if(card.kind==='tuneGun')return local('tune-weapon');
        if(isFull(card,p)){ui.replacing=card;return local('exchange')}
        return Game.choose(card);
      }
      case 'tune-apply':{
        const card=g.choices.find(c=>c.kind==='tuneGun');
        if(ui.screen==='tune-weapon'&&card)return Game.choose(card,Number(v));
        return;
      }
      case 'tune-back':return leaveTuning(g);
      case 'replace':return Game.choose(ui.replacing,Number(v));
      case 'salvage':return Game.salvage(ui.replacing);
      case 'draft-back':return show('draft',g);
      case 'inv-tab':ui.inventory=v;ui.reforge=null;return inventory(g);
      case 'inspect-pilot':ui.reforge=null;return Game.inspectPilot(Number(v));
      case 'fit-gun':case 'fit-active':case 'fit-armor':case 'fit-augment':case 'fit-keystone':case 'fit-overclock':{
        const [index,slot]=v.split(',').map(Number);
        Game.refit(op.slice(4),index,slot??0);return inventory(g);
      }
      case 'install-chip':{const [index,name]=v.split('|');Game.installChip(Number(index),name);return inventory(g)}
      case 'roll-affix':{
        const [idx,slot]=v.split('|'), index=Number(idx);
        const options=Game.rollAffix(index,slot);
        ui.reforge=options?.length?{index,slot,options}:null;return inventory(g);
      }
      case 'cancel-affix':ui.reforge=null;return inventory(g);
      case 'buy-affix':{
        const r=ui.reforge;if(!r)return;Game.buyAffix(r.index,r.slot,r.options[Number(v)]);ui.reforge=null;return inventory(g);
      }
    }
  }
  function init(){
    paintTitle();paintIcons();
    window.addEventListener('gamepadconnected',updatePadConnection);
    window.addEventListener('gamepaddisconnected',updatePadConnection);
    document.addEventListener('pointerdown',()=>document.body.classList.remove('pad-nav'),true);
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-op]');if(!b||b.disabled)return;
      handle(b.dataset.op,b.dataset.value??'');
      if(ui.screen==='play'&&b.isConnected)b.blur();
    });
    document.addEventListener('input',e=>{
      const el=e.target;if(!el.matches('[data-setting]'))return;
      const val=el.type==='checkbox'?el.checked:Number(el.value)/100;
      if(el.type==='range'){const output=el.parentElement.querySelector('output');if(output)output.textContent=el.value+'%'}
      Game.setSetting(el.dataset.setting,val);
    });
    document.addEventListener('keydown',e=>{
      if(byId('scrim').hidden)return;
      if(e.key==='Escape'){
        e.preventDefault();e.stopImmediatePropagation();back();return;
      }
      if(e.key==='Tab'){
        const focusable=[...byId('panel').querySelectorAll('button:not(:disabled),input:not(:disabled),select,[tabindex="0"]')];if(!focusable.length)return;
        const i=focusable.indexOf(document.activeElement);
        e.preventDefault();e.stopImmediatePropagation();
        focusable[(i+(e.shiftKey?-1:1)+focusable.length)%focusable.length].focus();
      }
    },true);
  }
  window.UI={init,show,hud,back,get current(){return ui.screen}};
})();
