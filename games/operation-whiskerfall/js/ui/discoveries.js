(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,U=W.UI.prototype,R=W.Renderer.prototype;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors=['#c7d3c0','#a8dc8e','#8ed7ef','#d4aeef','#ffd179','#ffb99b'],rarities=['Common','Uncommon','Rare','Epic','Legendary','Mythic'];
  const itemById=id=>W.Content.equipment.find(item=>item.id===id),celebrate=item=>!!item&&(item.weapon!==undefined||item.slot==='armor');
  const heroes=g=>[...(g.players||[]),...(g.reservePlayer?[g.reservePlayer]:[])];
  const owns=(p,id)=>!!p?.inventory?.some(entry=>(typeof entry==='string'?entry:entry.id)===id),key=(p,id)=>p.id+':'+id;
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const rank=item=>W.clamp(typeof item.rarity==='number'?item.rarity:Math.max(0,rarities.findIndex(r=>r.toLowerCase()===String(item.rarity).toLowerCase())),0,5);
  const state=g=>g.discoveryState||(g.discoveryState={version:1,seen:[],queue:[]});
  const activeReceipt=g=>state(g).queue.find(r=>g.players.some(p=>p.id===r.playerId&&!p.downed&&p.hp>0));

  G.initializeDiscoveries=function(saved,baseline=false){
    const known=heroes(this),validKeys=new Set(known.flatMap(p=>(p.inventory||[]).map(entry=>key(p,typeof entry==='string'?entry:entry.id))));
    const seen=new Set(Array.isArray(saved?.seen)?saved.seen.filter(id=>typeof id==='string'&&validKeys.has(id)):[]),queue=[],unique=new Set();
    if(baseline)for(const id of validKeys)seen.add(id);
    for(const receipt of Array.isArray(saved?.queue)?saved.queue.slice(0,1000):[]){
      const p=known.find(p=>p.id===receipt?.playerId),item=itemById(receipt?.itemId),id=p&&item?key(p,item.id):null;
      if(!id||!celebrate(item)||!owns(p,item.id)||unique.has(id))continue;
      queue.push({id,itemId:item.id,playerId:p.id,source:String(receipt.source||'Adventure treasure').slice(0,180)});unique.add(id);seen.add(id);
    }
    this.discoveryState={version:1,seen:[...seen],queue};return this.discoveryState;
  };
  const reveal=G.revealItem;
  G.revealItem=function(item,source){
    const result=reveal.call(this,item,source);
    if(!celebrate(item)||this._discoveryLoading)return result;
    const s=state(this);
    for(const p of heroes(this)){
      const id=key(p,item.id);if(!owns(p,item.id)||s.seen.includes(id))continue;
      s.seen.push(id);s.queue.push({id,itemId:item.id,playerId:p.id,source:String(source||'Recovered equipment').slice(0,180)});
      this._discoverySavePending=true;
    }
    return result;
  };
  const snapshot=G.snapshot;
  G.snapshot=function(){const s=state(this);return{...snapshot.call(this),discoveries:{version:1,seen:[...s.seen],queue:s.queue.map(r=>({...r}))}};};
  const start=G.start;
  G.start=function(options={}){
    // Continue delegates restoration to load; a failed request must not clear
    // the active campaign or create a replacement save.
    if(options.load)return start.call(this,options);
    this.discoveryState={version:1,seen:[],queue:[]};this._discoveryLoadedSlot=null;this._discoveryLoading=true;
    if(this.ui)this.ui.activeDiscoveryId=null;
    let result;try{result=start.call(this,options);}finally{this._discoveryLoading=false;}
    if(!(options.load&&this._discoveryLoadedSlot===this.slot)){this.initializeDiscoveries(null,true);this.save(false);}
    this._discoveryNextAt=(this.time||0)+.6;return result;
  };
  const load=G.load;
  G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;
    const previous=this.discoveryState,loading=this._discoveryLoading,active=this.ui?.activeDiscoveryId;this.discoveryState=data.discoveries?{version:1,seen:Array.isArray(data.discoveries.seen)?[...data.discoveries.seen]:[],queue:Array.isArray(data.discoveries.queue)?[...data.discoveries.queue]:[]}:{version:1,seen:[],queue:[]};
    this._discoveryLoading=true;if(this.ui)this.ui.activeDiscoveryId=null;
    let result;try{result=load.call(this,slot);}finally{this._discoveryLoading=loading;if(!result){this.discoveryState=previous;if(this.ui)this.ui.activeDiscoveryId=active;}}
    if(result){this.initializeDiscoveries(data.discoveries,!data.discoveries);this._discoveryLoadedSlot=slot;this._discoveryNextAt=(this.time||0)+.6;}
    return result;
  };
  const drops=G.updateDrops;
  G.updateDrops=function(dt){const result=drops.call(this,dt);if(this._discoverySavePending){this._discoverySavePending=false;this.save(false);}return result;};
  G.discoverySafe=function(){
    if(this.state!=='playing'||this.paused||this.ui?.isOpen||this._discoveryLoading||(this.time||0)<(this._discoveryNextAt||0))return false;
    const players=this.players||[];if(!players.length||players.some(p=>p.downed||p.hp<=0||p.harpoonPull||(this.time||0)-(p.lastHit??-100)<2))return false;
    if(Object.values(this.encounterRuns||{}).some(run=>run.state==='active'&&['fighting','between'].includes(run.phase)))return false;
    if(this.world.isDungeon&&!this.world.state?.solved&&['fighting','between'].includes(this.world.state?.survival?.phase))return false;
    const near=(o,r)=>players.some(p=>W.dist(o,p)<r),refuge=players.every(p=>this.safeZoneAt?.(p.x,p.y));
    if(!this.world.isDungeon&&Object.values(this.missionRuns||{}).some(run=>run.state==='active'&&run.type==='defend'&&near(run,650)))return false;
    if(!refuge&&(this.world.activeEnemies||[]).some(e=>e.hp>0&&!e.dead&&(near(e,650)||near(e,1250)&&(e.alert>0||['attack','chase','flank'].includes(e.state)))))return false;
    if(!refuge&&(this.projectiles||[]).some(b=>b.alive&&b.owner<0&&near(b,600)))return false;
    if(!refuge&&(this.effects||[]).some(f=>f.alive&&(f.owner<0||f.type==='hazard')&&near(f,(f.radius||0)+350)&&(f.damage>0||f.blackglassOwnerId||f.cinderOwnerId)))return false;
    return true;
  };
  G.updateDiscoveries=function(){
    if(!this.ui?.showDiscovery||!this.discoverySafe())return;
    const s=state(this);s.queue=s.queue.filter(r=>owns(heroes(this).find(p=>p.id===r.playerId),r.itemId)&&celebrate(itemById(r.itemId)));
    const receipt=activeReceipt(this);if(receipt)this.ui.showDiscovery(receipt);
  };
  const updatePlayer=G.updatePlayer;
  G.updatePlayer=function(p,input,dt){
    if((this.time||0)<(this.discoveryResumeUntil||0)){input={...input};for(const action of ['shoot','melee','dodge','interact','ability','ability2','grenade','reload','consumable'])input[action]=false;}
    return updatePlayer.call(this,p,input,dt);
  };
  const interact=G.interact;
  G.interact=function(...args){if((this.time||0)<(this.discoveryResumeUntil||0))return false;return interact.apply(this,args);};

  U.discoveryArtwork=function(item,p){
    const armor=W.HeroArmorArt?.markup(item,{className:'discovery-art discovery-armor-art',variant:'card',skin:p?.skin||0});if(armor)return armor;
    const index=this.iconIndex(item),width=1774,height=887,cellW=width/8,cellH=height/4,x=index%8*cellW,y=Math.floor(index/8)*cellH;
    const path=W.config.assetBaseURL?W.config.assetBaseURL.replace(/\/$/,'')+'/weapons/items.png':'assets/weapons/items.png';
    return `<svg class="discovery-art" viewBox="${x} ${y} ${cellW} ${cellH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escape(item.name)} illustration"><image href="${escape(path)}" width="${width}" height="${height}"/></svg>`;
  };
  U.showDiscovery=function(receipt){
    const p=this.game.players.find(p=>p.id===receipt.playerId);if(!p||!owns(p,receipt.itemId)||!state(this.game).queue.some(r=>r.id===receipt.id))return false;
    this.activeDiscoveryId=receipt.id;this._discoveryInputUntil=now()+250;this.game.input?.clear();
    this.showMenu('discovery',this.game.players.indexOf(p));this.game.audio?.play('level');this.game.audio?.vocal?.('cat_happy',p,this.game,{allowMenu:true});return true;
  };
  U.discoveryHTML=function(){
    const receipt=state(this.game).queue.find(r=>r.id===this.activeDiscoveryId),item=receipt&&itemById(receipt.itemId),p=receipt&&this.game.players.find(p=>p.id===receipt.playerId);if(!item||!p)return '';
    this.playerIndex=this.game.players.indexOf(p);
    const rating=rank(item),weapon=item.weapon!==undefined?W.Content.weapons[item.weapon]:null,stats=this.gearStats?.(item)||[],requirement=this.equipRequirement?.(item)||((p.level||1)<(item.level||1)?'Requires hero level '+item.level:''),equipped=weapon?p.weapon===item.weapon:p.equipment?.[item.slot]?.id===item.id;
    const label=weapon?'A NEW FIREARM':'A NEW SUIT OF ARMOR',headline=rating===5?'A mythic treasure.':rating===4?'A legendary find.':rating>=2?'Now that’s a treasure.':'Your next adventure starts here.';
    const styles={stormrunner:['Stay on the move','A nimble field suit for quick repositioning and bold attacks.'],bastion:['Hold your ground','Heavy protection for facing dangerous enemies at close range.'],spellweaver:['Make every spell count','Arcane fieldwear for a hero who fights with abilities.']},style=styles[item.armorStyle],mechanicTitle=weapon?.mechanicName||item.playstyle||item.playstyleName||style?.[0]||'Ready for the road',mechanic=weapon?.mechanicDescription||item.playstyleDescription||item.description||style?.[1]||'A new option for your next adventure.';
    const button=(action,text,disabled=false,css='')=>`<button class="${css}" data-action="${action}" data-value="${escape(receipt.id)}" ${disabled?'disabled':''}>${text}</button>`;
    return `<div class="menu-layer discovery-layer"><section class="discovery-window" style="--discovery-color:${colors[rating]}" role="dialog" aria-modal="true" aria-labelledby="discovery-title" aria-describedby="discovery-source"><div class="discovery-sparkles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--spark:${i}"></i>`).join('')}</div><header class="discovery-header"><span>${label}</span><span>PLAYER ${p.id+1} · ${state(this.game).queue.length>1?state(this.game).queue.length+' discoveries':'Added to your pack'}</span></header><div class="discovery-layout"><div class="discovery-showcase"><div class="discovery-halo" aria-hidden="true"></div>${this.discoveryArtwork(item,p)}<span class="discovery-rarity">${rarities[rating]} · Level ${item.level||1}</span><p>${headline}</p></div><div class="discovery-details"><p class="discovery-eyebrow">TREASURE SECURED</p><h2 id="discovery-title">${escape(item.name)}</h2><p id="discovery-source" class="discovery-source">${escape(receipt.source)}</p><div class="discovery-playstyle"><strong>${escape(mechanicTitle)}</strong><p>${escape(mechanic)}</p></div><dl class="discovery-stats">${stats.slice(0,4).map(([name,value])=>`<div><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><div class="discovery-comparison">${this.comparison?.(item)||''}</div>${requirement?`<p class="discovery-requirement">${escape(requirement)}. It stays safely in your pack.</p>`:''}<div class="discovery-actions" data-nav-group="discovery-actions">${button('discovery-equip',equipped?'✓ Equipped':weapon?'Equip primary':'Equip now',!!requirement||equipped,'primary')}${weapon?button('discovery-backup',p.secondary===item.weapon?'✓ Backup equipped':'Equip backup',!!requirement||p.secondary===item.weapon):''}${button('discovery-keep','Keep in pack',false,'discovery-keep')}</div><p class="discovery-note">Already yours. Choose how to use it.<br><kbd>A / Enter</kbd> Select · <kbd>B / Esc</kbd> Keep in pack</p></div></div></section></div>`;
  };
  U.finishDiscovery=function(id,action='keep'){
    if(this.menu!=='discovery'||id!==this.activeDiscoveryId||now()<(this._discoveryInputUntil||0))return false;
    const s=state(this.game),receipt=s.queue.find(r=>r.id===id),p=receipt&&this.game.players.find(p=>p.id===receipt.playerId);if(!receipt||!p)return false;
    const item=itemById(receipt.itemId);if(!owns(p,item?.id))return false;
    if(action!=='keep'&&this.game.equip(this.game.players.indexOf(p),item.id,action==='backup'?'secondary':undefined)===false){this.render();return false;}
    s.queue=s.queue.filter(r=>r.id!==id);this.game.itemReveals=(this.game.itemReveals||[]).filter(r=>r.id!==receipt.itemId);this.activeDiscoveryId=null;this.game._discoveryNextAt=(this.game.time||0)+.65;this.game.discoveryResumeUntil=(this.game.time||0)+.25;
    this.game.input?.clear();this.game.save(false);this._closingDiscovery=true;try{this.hideMenu();}finally{this._closingDiscovery=false;}return true;
  };
  const hide=U.hideMenu;
  U.hideMenu=function(){
    if(this.menu==='discovery'&&this.activeDiscoveryId&&!this._closingDiscovery&&!this.game._discoveryLoading)return this.finishDiscovery(this.activeDiscoveryId,'keep');
    return hide.apply(this,arguments);
  };
  const show=U.showMenu;
  U.showMenu=function(name,...args){if(name!=='discovery'&&this.menu==='discovery')this.activeDiscoveryId=null;return show.call(this,name,...args);};
  const defaultFocus=U.defaultControllerFocus;
  U.defaultControllerFocus=function(controls){if(this.menu==='discovery')return controls.find(c=>c.dataset.action==='discovery-equip'&&!c.disabled)||controls.find(c=>c.dataset.action==='discovery-keep')||controls[0];return defaultFocus.call(this,controls);};
  const render=U.render;
  U.render=function(){
    if(!this.isOpen||this.menu!=='discovery')return render.apply(this,arguments);
    const remembered=(this.controllerFocus||[]).map(c=>this.focusKey(c));this.host.innerHTML=this.discoveryHTML();this.restoreFocus(remembered);
    const focused=this.controllerFocus[this.activeController||0]||this.defaultControllerFocus(this.focusableControls());if(focused)this.setControllerFocus(focused,this.activeController||0);
    if(this._discoveryKeyboardBound||!this.host.addEventListener)return;this._discoveryKeyboardBound=true;
    this.host.addEventListener('keydown',event=>{
      if(!this.isOpen||this.menu!=='discovery'||!['Tab','Enter','Escape'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();if(event.repeat)return;
      const controls=this.focusableControls(),index=controls.indexOf(document.activeElement);if(!controls.length)return;
      if(event.key==='Tab')this.setControllerFocus(controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length],this.activeController||0);
      else if(event.key==='Escape')this.finishDiscovery(this.activeDiscoveryId,'keep');
      else{if(index>=0)this.controllerFocus[this.activeController||0]=controls[index];this.handlePad('confirm',this.activeController||0);}
    });
  };
  const pad=U.handlePad;
  U.handlePad=function(action,playerIndex){if(this.menu==='discovery'&&this.isOpen){if(now()<(this._discoveryInputUntil||0))return;if(action==='back')return this.finishDiscovery(this.activeDiscoveryId,'keep');if(['previous','next'].includes(action))return;}return pad.call(this,action,playerIndex);};
  const click=U.click;
  U.click=function(event){
    const button=event.target.closest?.('button[data-action]'),action=button?.dataset.action;if(!button||button.disabled||!['discovery-equip','discovery-backup','discovery-keep'].includes(action))return click.apply(this,arguments);
    return this.finishDiscovery(button.dataset.value,action==='discovery-equip'?'equip':action==='discovery-backup'?'backup':'keep');
  };
  const update=U.update;
  U.update=function(){const result=update.apply(this,arguments);this.game?.updateDiscoveries?.();return result;};
  const banner=R.drawItemReveal;
  R.drawItemReveal=function(){
    const g=this.game,receipt=activeReceipt(g),item=receipt&&itemById(receipt.itemId);if(!receipt||!item)return banner?.apply(this,arguments);if(g.ui?.isOpen)return;
    const c=this.ctx,rating=rank(item),color=colors[rating],width=Math.min(440,this.width-28),x=(this.width-width)/2,y=Math.min(154,this.height*.22),p=g.players.find(p=>p.id===receipt.playerId);
    c.save();c.fillStyle='rgba(13,31,35,.94)';c.shadowColor='#0008';c.shadowBlur=18;c.fillRect(x,y,width,104);c.shadowBlur=0;c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x,y,width,104);c.fillStyle=color;c.fillRect(x,y,5,104);
    if(!W.HeroArmorArt?.draw(this,item,x+52,y+54,78,78,{skin:p?.skin||0})){const icon=g.ui.iconIndex(item);this.sprite('items',icon%8,Math.floor(icon/8),8,4,x+53,y+52,74,74);}
    c.textAlign='left';c.fillStyle=color;c.font='800 10px system-ui';c.fillText('TREASURE SECURED · '+rarities[rating].toUpperCase(),x+103,y+23,width-115);c.fillStyle='#fff1d7';c.font='700 19px Georgia';c.fillText(item.name,x+103,y+49,width-115);c.fillStyle='#bfd0c5';c.font='11px system-ui';c.fillText('Player '+(receipt.playerId+1)+' · waiting safely in your pack',x+103,y+70,width-115);c.fillText('A closer look when the area is clear',x+103,y+87,width-115);c.restore();
  };
})();
