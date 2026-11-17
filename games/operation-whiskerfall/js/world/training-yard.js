/* The gate yard uses the field's actual player, projectile and dodge simulation.
   Surface quests, patrols, loot and clocks never tick inside the yard. */
(function () {
  'use strict';
  const W=window.OW, G=W.Game.prototype, U=W.UI.prototype, R=W.Renderer.prototype;
  const steps=['movement','attack','reload','dodge','interact','journal','exit'];
  const names={movement:'Reach the chalk circle.',attack:'Hit the clockwork rat.',reload:'Reload your firearm.',dodge:'Dodge the red practice strike.',interact:'Collect the torn dispatch.',journal:'Find the orchard lead in your Journal or map.',exit:'Take the green gate to Willow.'};
  const panels=[
    ['At dusk, a courier took the short way through Willow’s orchard. At roll call, her lantern was still burning.','A courier disappears among the apple trees.'],
    ['Saffron found a scrap of dispatch in the thorns. The handwriting was her sister’s.','Saffron retrieves a torn dispatch beneath the branches.'],
    ['“Orchard stile. Last light.” Someone had pressed violet wax over the Willow seal. The stile was worth a look.','A torn map and seal point to the orchard stile.'],
    ['“First, the gate yard,” Saffron said. “Learn the alarm drill. Then meet me at Willow and we’ll follow her trail.”','The resistance opens its training gate.']
  ].map(([caption,alt],i)=>({caption,alt,art:'comics/orchard-dispatch.webp',crop:{cols:2,rows:2,col:i%2,row:Math.floor(i/2)}}));
  const fresh=()=>({phase:'comic',panel:0,step:'movement'});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const towards=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const yardRegion={name:'Resistance gate yard',biome:'grassland',color:'#7c865d',level:1};
  class Yard {
    constructor(){
      this.isTutorial=true;this.width=900;this.height=530;this.start={x:240,y:310};
      this.circle={x:360,y:310};this.desk={x:560,y:255};this.exit={x:740,y:205};
      this.sparringRat={id:'training_clockrat',type:2,x:552,y:310,hp:100,maxHp:100,angle:Math.PI,anim:'idle',animTime:0,training:true,name:'Clockwork rat'};
      this.activeEnemies=[];this.locations=[];this.liberated=new Set();this.dead=new Set();this.opened=new Set();this.discovered=new Set();
    }
    isBlocked(x,y,r=0){return x-r<65||y-r<145||x+r>835||y+r>448;}
    regionAt(){return yardRegion;}
    terrainAt(){return {type:'grass',biome:'grassland',region:0};}
    reveal(){}
    getLocation(){return null;}
    safeZoneAt(){return null;}
    isPointLocked(){return false;}
    nearbyEnemies(x,y,r){return this.activeEnemies.filter(e=>Math.hypot(e.x-x,e.y-y)<=r);}
  }
  function clearField(g){
    g.bulletPool.reset();g.effectPool.reset();g.particlePool.reset();g.grid.clear();g.audio.resetAnimals?.();
    for(const p of g.players){p.dodgeTime=0;p.invuln=0;p.shootWasDown=false;p.meleeStrike=null;p.meleeCommit=0;p.burstQueue=[];}
  }
  function setupStep(g){
    const w=g.world,step=g.opening.step,rat=w.sparringRat;
    w.activeEnemies=['attack','reload','dodge'].includes(step)?[rat]:[];
    if(step==='dodge'){w.strike=null;w.retry=.65;w.feedback='';}
    if(step==='reload'){
      // A partner can complete this drill even when only one fighter shot.
      for(const p of g.players){p.ammo=Math.min(p.ammo,p.magSize-1);p.reserve=Math.max(p.reserve,p.magSize);}
    }
    g.yardHudTime=0;
  }
  function nextStep(g,step){
    g.opening.step=step;setupStep(g);g.audio.play('ui');g.save(false);
  }
  function enterYard(g,positions){
    const field=g.world;g.yardSurface=field;g.world=new Yard();g.opening.phase='training';
    clearField(g);g.marker=null;
    for(const [i,p] of g.players.entries()){
      const pos=positions?.[i];
      Object.assign(p,pos&&!g.world.isBlocked(pos.x,pos.y,19)?pos:{x:g.world.start.x+i*42,y:g.world.start.y+i*24});
      p.angle=0;p.anim='idle';p.hp=p.maxHp;p.downed=false;
    }
    g.camera.x=450;g.camera.y=265;g.camera.shake=0;setupStep(g);
    g.renderer.prepareSurface?.(field);g.save(false);
  }
  function showOpening(g){
    W.Comics.show(g,{title:'The missing courier',panels,index:g.opening.panel,
      onPage:i=>{g.opening.panel=i;g.save(false);},onEnd:()=>enterYard(g)});
  }
  function clearYardUi(g){g.yardHud?.remove();g.yardHud=null;}
  function leaveYard(g){
    clearField(g);g.world=g.yardSurface;g.yardSurface=null;clearYardUi(g);
    for(const [i,p] of g.players.entries()){
      Object.assign(p,{x:g.world.start.x+i*48,y:g.world.start.y,invuln:3,hp:p.maxHp,ammo:p.magSize,reserve:240,reloading:0,fireTimer:0,anim:'idle',velocityX:0,velocityY:0});
      p.cooldowns.dodge=0;g.restorePlayerPosition(p);
    }
    g.camera.x=g.players[0].x;g.camera.y=g.players[0].y;g.camera.zoom=1;
    g.opening.phase='complete';g.world.reveal(g.camera.x,g.camera.y);g.world.updateActive(g.players,0,g);
    g.pinRecon('observed');g.travelInteractUntil=g.time+.55;
    g.ui.toast('Saffron · Meet me at the orchard stile. I’ve marked our first lead.','quest');g.save(false);return true;
  }
  const start=G.start;
  G.start=function(opts={}){
    if(!opts.load){
      W.Comics.reset(this);clearYardUi(this);this.yardSurface=null;
      this.opening=opts.opening?fresh():null;
    }
    return start.apply(this,arguments);
  };
  G.beginCampaign=function(opts={}){
    const ok=this.start({...opts,opening:true,load:false});
    if(ok)showOpening(this);
    return ok;
  };
  const toast=U.toast;
  U.toast=function(message,kind){
    if(this.game.opening?.phase==='comic'&&kind==='quest')return;
    return toast.apply(this,arguments);
  };
  const snapshot=G.snapshot;
  G.snapshot=function(){
    let data;
    if(this.world.isTutorial){
      // All campaign extension serializers expect surface coordinates for flags,
      // checkpoints and quests. Keep yard coordinates in the opening record.
      const world=this.world,players=this.players;
      this.world=this.yardSurface;
      this.players=players.map((p,i)=>({...p,x:this.world.start.x+i*48,y:this.world.start.y}));
      try{data=snapshot.call(this);}finally{this.players=players;this.world=world;}
      data.opening={...this.opening,positions:players.map(({x,y})=>({x,y}))};
      data.region=yardRegion.name;
    }else{
      data=snapshot.call(this);if(this.opening)data.opening={...this.opening};
    }
    return data;
  };
  const valid=W.Save.validData;
  W.Save.validData=function(data){
    if(!valid.call(this,data))return false;
    const o=data.opening;if(o===undefined)return true;
    return !!o&&['comic','training','complete'].includes(o.phase)&&steps.includes(o.step)&&Number.isInteger(o.panel)&&o.panel>=0&&o.panel<panels.length&&
      (o.positions===undefined||Array.isArray(o.positions)&&o.positions.length<=2&&o.positions.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
  };
  const load=G.load;
  G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;
    const previous=this.opening;this.opening=data.opening?{phase:data.opening.phase,panel:data.opening.panel,step:data.opening.step}:null;
    let ok;try{ok=load.call(this,slot);}finally{if(!ok)this.opening=previous;}
    if(!ok)return false;
    W.Comics.reset(this);clearYardUi(this);this.yardSurface=null;this.paused=this.ui.isOpen;
    if(this.opening?.phase==='comic')showOpening(this);
    if(this.opening?.phase==='training')enterYard(this,data.opening.positions);
    return true;
  };
  const damage=G.damageEnemy;
  G.damageEnemy=function(enemy,amount,player){
    if(!enemy.training)return damage.apply(this,arguments);
    if(this.world.isTutorial&&this.opening.step==='attack'&&amount>0&&player){
      enemy.hit=.25;this.effect('spark',enemy.x,enemy.y-20,18,.22);nextStep(this,'reload');
    }
  };
  function tickStrike(g,dt){
    const w=g.world,rat=w.sparringRat;
    if(!w.strike){
      w.retry-=dt;if(w.retry>0)return;
      const p=g.players.reduce((near,v)=>distance(v,rat)<distance(near,rat)?v:near);
      rat.angle=towards(rat,p);rat.anim='windup';w.strike={x:p.x,y:p.y,owner:p.id,time:1.05,radius:68,dodged:false};
      g.audio.play('alert');return;
    }
    const s=w.strike,p=g.players.find(v=>v.id===s.owner);
    if(!p){w.strike=null;w.retry=.2;return;}
    if(p.dodgeTime>0&&distance(p,s)<s.radius+25)s.dodged=true;
    s.time-=dt;if(s.time>0)return;
    rat.anim='shoot';g.effect('shockwave',s.x,s.y,s.radius,.22,{color:'#f5b58a'});
    const hit=distance(p,s)<=s.radius&&p.invuln<=0;
    if(s.dodged&&!hit){nextStep(g,'interact');return;}
    if(hit){g.damagePlayer(p,8,rat);p.hp=Math.max(p.hp,p.maxHp*.75);}
    w.feedback=hit?'Tagged. Roll as the ring closes.':'Roll from inside the next warning circle.';
    w.strike=null;w.retry=1.15;g.yardHudTime=0;
  }
  const update=G.update;
  G.update=function(dt){
    if(this.comic)return;
    if(!this.world.isTutorial)return update.call(this,dt);
    const w=this.world;this.time+=dt;this.playTime+=dt;this.enemyFrame++;
    this.grid.clear();for(const e of w.activeEnemies)this.grid.insert(e);
    w.sparringRat.animTime+=dt;w.sparringRat.hit=Math.max(0,(w.sparringRat.hit||0)-dt);
    for(const [i,p] of this.players.entries()){
      const input=this.input.forPlayer(i,this),step=this.opening.step,wasReloading=p.reloading>0;
      // Equipment and consumables stay in the kit until the dispatch is signed.
      for(const action of ['grenade','ability','ability2','consumable','switchWeapon','melee','heavy'])input[action]=false;
      if(step!=='attack')input.shoot=false;
      if(step!=='dodge')input.dodge=false;
      if(step!=='reload')input.reload=false;
      this.updatePlayer(p,input,dt);
      if(this.world!==w)return;
      if(step==='movement'&&distance(p,w.circle)<34)nextStep(this,'attack');
      if(step==='reload'&&wasReloading&&p.reloading===0&&p.ammo===p.magSize)nextStep(this,'dodge');
    }
    this.updateProjectiles(dt);this.updateEffects(dt);
    if(this.opening.step==='dodge')tickStrike(this,dt);
    // A fixed shared camera keeps the chalk circle, sparring line and gate in sight.
    this.camera.x=450;this.camera.y=265;
    this.camera.zoom=Math.min(this.renderer.width/900,this.renderer.height/540,1.45);
  };
  const interact=G.interact;
  G.interact=function(p){
    if(!this.world.isTutorial)return interact.apply(this,arguments);
    if(this.opening.step==='interact'&&distance(p,this.world.desk)<95){nextStep(this,'journal');return true;}
    if(this.opening.step==='exit'&&distance(p,this.world.exit)<100)return leaveYard(this);
    return false;
  };
  const travel=G.fastTravel;
  G.fastTravel=function(){return this.world.isTutorial?false:travel.apply(this,arguments);};
  const showMenu=U.showMenu;
  U.showMenu=function(name,owner){
    if(this.game.comic)return;
    if(this.game.state==='playing'&&this.game.world.isTutorial){
      if(!['main','pause','map','journal','settings','controls'].includes(name))name='pause';
      if((name==='map'||name==='journal')&&this.game.opening.step==='journal')nextStep(this.game,'exit');
    }
    return showMenu.call(this,name,owner);
  };
  function dispatchNotes(g,isMap){
    const op=W.Content.reconCampaign.ops[0],surface=g.yardSurface,stile=surface.getLocation(op.id+'_perch');
    let art='<img alt="Willow Resistance Camp" src="'+W.Comics.asset('fieldwork/arrival-willow.webp')+'">';
    if(isMap&&stile){
      const willow=surface.start,pad=210,minX=Math.min(willow.x,stile.x)-pad,minY=Math.min(willow.y,stile.y)-pad;
      const width=Math.abs(stile.x-willow.x)+pad*2,height=Math.abs(stile.y-willow.y)+pad*2;
      const road=surface.roads.filter(r=>Math.min(r.x1,r.x2)<minX+width&&Math.max(r.x1,r.x2)>minX&&Math.min(r.y1,r.y2)<minY+height&&Math.max(r.y1,r.y2)>minY)
        .map(r=>'<path d="M '+r.x1+' '+r.y1+' L '+r.x2+' '+r.y2+'" fill="none" stroke="#919979" stroke-width="'+Math.min(18,r.width||12)+'"/>').join('');
      const marker=(p,color,label)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="16" fill="'+color+'" stroke="#192e28" stroke-width="5"/><text x="'+p.x+'" y="'+(p.y-33)+'" text-anchor="middle" fill="#fff1cd" stroke="#23372d" stroke-width="6" paint-order="stroke" font-size="30">'+label+'</text>';
      art='<svg class="yard-route" role="img" aria-label="The route from Willow to the orchard stile" viewBox="'+[minX,minY,width,height].join(' ')+'">'+road+marker(willow,'#b1e3b3','Willow')+marker(stile,'#ffd075','Orchard stile')+'</svg>';
    }
    return '<article class="yard-notes">'+art+'<h3>'+op.title+'</h3><p>Saffron’s dispatch puts the last handoff at the orchard stile. '+op.lead+'</p><p>Return to the yard. The east gate leads to Willow.</p></article>';
  }
  for(const name of ['journalMenu','mapMenu']){
    const method=U[name];U[name]=function(){return this.game.world.isTutorial?dispatchNotes(this.game,name==='mapMenu'):method.apply(this,arguments);};
  }
  const drawMap=U.drawMap;
  U.drawMap=function(){if(!this.game.world.isTutorial)return drawMap.apply(this,arguments);};
  const pauseMenu=U.pauseMenu;
  U.pauseMenu=function(){
    if(!this.game.world.isTutorial)return pauseMenu.apply(this,arguments);
    const warning=this.saveStatus(this.game.slot).state==='temporary'?'<p class="save-warning" role="alert">Only in this tab. Export your campaign before closing. <button data-action="export">Export campaign</button></p>':'';
    return '<div class="pause-links"><button data-action="menu" data-value="journal">Field journal</button><button data-action="menu" data-value="map">Map</button><button data-action="save">Save</button><button data-action="coop">'+(this.game.players.length===2?'Let Player 2 rest':'Welcome Player 2')+'</button><button data-action="menu" data-value="controls">Controls</button><button data-action="menu" data-value="settings">Settings</button><button data-action="exit">Save &amp; return to title</button></div>'+warning;
  };
  function hint(g,i){
    const t=g.opening.step,input=g.input,pad=input.pads?.find(p=>input.padAssignments.get(p.index)===i);
    const usingPad=pad&&(input.padLastUse.get(pad.index)||0)>=Math.max(input.lastKeyboard,i?0:input.mouse.lastMove);
    const pref=input.padProfile(i).sticks,swap=pref==='swap'||pref==='inherit'&&input.padBindings.swapSticks;
    const key=a=>W.Input.keyName(input.bindings[(i?'p2':'')+a]),action=a=>usingPad?input.glyph(i,input.padBindings[a]):key(a);
    const movement=usingPad?(swap?'Right stick':'Left stick'):['up','left','down','right'].map(key).join(' / ');
    switch(t){
      case 'movement':return movement+' · Move into the gold ring.';
      case 'attack':return (usingPad?(swap?'Left stick':'Right stick'):i?'Face the rat with movement':'Aim with the mouse')+' · '+action('shoot')+' to fire.';
      case 'reload':return action('reload')+' · Wait for the magazine to fill.';
      case 'dodge':return (g.world.feedback||'Let the ring lock on.')+' '+action('dodge')+' · Roll.';
      case 'interact':return action('interact')+' at the marked dispatch table.';
      case 'journal':return usingPad?input.glyph(i,input.padBindings.pause)+' → Field journal or Map':W.Input.keyName(input.bindings.journal)+' · Journal　'+W.Input.keyName(input.bindings.map)+' · Map';
      default:return action('interact')+' at the open gate. Both fighters travel together.';
    }
  }
  const uiUpdate=U.update;
  U.update=function(){
    const g=this.game;
    if(g.comic){this.hud.classList.add('hidden');return;}
    if(g.state!=='playing'||!g.world.isTutorial){clearYardUi(g);return uiUpdate.apply(this,arguments);}
    this.hud.classList.add('hidden');
    if(!g.yardHud){
      const node=document.createElement('aside');node.className='yard-hud';node.setAttribute('aria-live','polite');
      node.innerHTML='<section><small>Resistance gate yard</small><strong></strong><p></p></section>';g.yardHud=node;document.body.append(node);
    }
    g.yardHud.hidden=this.isOpen;if(this.isOpen||performance.now()<g.yardHudTime)return;
    g.yardHudTime=performance.now()+160;
    const text=g.players.map((p,i)=>(g.players.length>1?'P'+(i+1)+' · ':'')+hint(g,i)).join('\n');
    const title=g.yardHud.querySelector('strong'),instructions=g.yardHud.querySelector('p');
    if(title.textContent!==names[g.opening.step])title.textContent=names[g.opening.step];
    if(instructions.textContent!==text){instructions.textContent=text;instructions.style.whiteSpace='pre-line';}
  };
  const draw=R.draw;
  R.draw=function(dt){
    const g=this.game;if(g.comic)return;
    if(!g.world.isTutorial)return draw.call(this,dt);
    const c=this.ctx,w=g.world;this.clock+=dt;this.frame++;
    const zoom=g.camera.zoom=Math.min(this.width/900,this.height/540,1.45);
    g.camera.x=450;g.camera.y=265;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#192c25';c.fillRect(0,0,this.width,this.height);
    c.save();c.translate(this.width/2,this.height/2);c.scale(zoom,zoom);c.translate(-450,-265);
    c.fillStyle=this.patterns[0]||'#778659';c.fillRect(0,0,900,530);
    c.fillStyle='#303b278c';c.fillRect(0,0,900,530);
    c.fillStyle=this.patterns[2]||'#9a926d';c.fillRect(60,138,780,316);
    // Timber posts define the practice lane and leave the gate unobstructed.
    c.strokeStyle='#524c38';c.lineWidth=7;c.strokeRect(60,138,780,316);
    for(let x=60;x<=840;x+=52){c.fillStyle='#665941';c.fillRect(x-4,123,8,20);c.fillRect(x-4,439,8,20);}
    for(const [x,y] of [[50,125],[170,106],[270,117],[420,104],[635,107],[866,142],[32,477],[864,470]])
      this.sprite('scenery',0,0,6,4,x,y,118,108,{py:.88});
    const gateOpen=g.opening.step==='exit',gate=w.exit;
    c.fillStyle=gateOpen?'#afc88a':'#565e4a';c.fillRect(gate.x-40,gate.y-62,80,62);
    c.fillStyle='#374233';c.fillRect(gate.x-46,gate.y-69,9,76);c.fillRect(gate.x+38,gate.y-69,9,76);
    c.fillStyle='#6e6547';c.fillRect(gate.x-49,gate.y-74,99,11);
    if(!gateOpen){c.strokeStyle='#333e2c';c.lineWidth=5;for(let i=-32;i<40;i+=16){c.beginPath();c.moveTo(gate.x+i,gate.y-61);c.lineTo(gate.x+i,gate.y);c.stroke();}}
    this.worldLabel(gateOpen?'OPEN · TO WILLOW':'WILLOW GATE',gate.x,gate.y-83,gateOpen?'#c4f6aa':'#efe2b5',13);
    c.fillStyle='#493b2d';c.fillRect(w.desk.x-25,w.desk.y-2,50,9);c.fillStyle='#947452';c.fillRect(w.desk.x-32,w.desk.y-16,64,17);c.fillStyle='#f1d7a5';c.fillRect(w.desk.x-9,w.desk.y-17,18,11);
    const target={movement:w.circle,attack:w.sparringRat,interact:w.desk,exit:w.exit}[g.opening.step];
    if(target){c.strokeStyle=gateOpen?'#b8f38d':'#ffe3a3';c.lineWidth=3;c.beginPath();c.ellipse(target.x,target.y+3,38,18,0,0,Math.PI*2);c.stroke();}
    if(w.strike){
      const s=w.strike;c.fillStyle='#a7343259';c.strokeStyle='#ffb88a';c.lineWidth=3;c.beginPath();c.arc(s.x,s.y,s.radius,0,Math.PI*2);c.fill();c.stroke();
      c.beginPath();c.arc(s.x,s.y,Math.max(1,s.radius*s.time/1.05),0,Math.PI*2);c.stroke();
      c.setLineDash([7,8]);c.beginPath();c.moveTo(w.sparringRat.x,w.sparringRat.y-20);c.lineTo(s.x,s.y);c.stroke();c.setLineDash([]);
    }
    if(w.activeEnemies.length)this.drawActor(w.sparringRat,false);
    for(const [i,p] of g.players.entries())this.drawActor(p,true,i);
    for(const b of g.projectiles)if(b.alive)this.drawProjectile(b);
    for(const f of g.effects)if(f.alive)this.drawEffect(f,true);
    c.restore();
  };
})();
