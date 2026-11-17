/* Occupied-city investigations. The notebook and physical contacts share the
   same confirmation path. Evidence and earned payments use questCounters. */
(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,U=W.UI.prototype,R=W.Renderer.prototype;
  const cases=[
    {id:'ironveil',title:'The Night Shift That Never Ends',city:'Ironveil City',contact:'Timekeeper Vela',art:'ironveil',reward:360,
      brief:'My brother punches out at midnight. His bunk stays cold. Someone is using the factory clocks to move workers through a city under curfew.',
      result:'Vela reads the missing shift roster at the depot gate. Families meet a train that had run empty on paper for six months.',
      clues:[
        {subject:'Find which shift is being diverted.',a:['witness','Watch the factory bell exchange','Two yellow lunch tins stay on the hook when the midnight bell rings. The day shift carries green tins.'],b:['archive','Recover the punch-card carbon','Green cards have two punches. The yellow midnight cards have only an entrance punch.'],options:['The morning repair crew','The midnight yellow shift','The entire foundry'],answer:1,fact:'Someone removed the yellow shift after it clocked in.'},
        {subject:'Find the route past the city patrol.',a:['roof','Watch the hoist signals','White lamps flash in order from the laundry roof toward the freight arch. The gatehouse lamp stays dark.'],b:['relay','Read the switchbox register','Only the laundry and freight-arch circuits draw current together. The gatehouse is disconnected.'],options:['The laundry to the freight arch','The gatehouse to the canal','The public bridge'],answer:0,fact:'The lamp chain moves workers under the freight arch, outside the wagons’ inspection lane.'},
        {subject:'Find the train the families can intercept.',a:['relay','Listen for the departure call','A porter repeats “six empty”. Six cars roll out. Only the third sags on its springs.'],b:['archive','Lift the freight inspector’s rubbing','The third axle alone tipped the weighbridge. All six cars were entered as empty.'],options:['The fifth passenger carriage','The first coal hopper','The third empty freight car'],answer:2,fact:'Car three is carrying the missing shift. The families can meet it at the extraction siding.'}
      ]},
    {id:'blackglass',title:'The Silence Between Bells',city:'Blackglass Borough',contact:'Choirmaster Ivo',art:'blackglass',reward:480,
      brief:'The borough clock tolls for people who are still alive. My choir heard a voice between the bells. Find who is ordering these disappearances before we risk answering.',
      result:'Ivo sends the witnesses’ own voices over the civic relay. Behind shuttered windows, the borough answers the old choir roll one voice at a time.',
      clues:[
        {subject:'Separate the real bell from its double.',a:['roof','Watch the shadow of the bell','The west bell swings with the first note. During the second, its shadow stands still.'],b:['archive','Recover the bell keeper’s tracing','The first trace records a vibrating bell. A flat line accompanies the second toll, stamped RELAY.'],options:['Both notes come from the west tower','A hidden relay plays the second note','The bell is cracked'],answer:1,fact:'The second toll is a relay transmission, timed to sound like the west bell.'},
        {subject:'Identify the relay operator.',a:['witness','Listen from behind the choir screen','A street singer hums the old alto part. The voice in the wall answers with her conductor’s four-note rest.'],b:['relay','Recover the relay cue strip','The cue strip bears the conductor’s four empty measures. An officer crossed out his name.'],options:['The bridge ferryman','The gate marshal','The missing choir conductor'],answer:2,fact:'The choir conductor is alive and sending a count of the prisoners.'},
        {subject:'Find the safe gap in the street search.',a:['roof','Count the lanterns on the return patrol','Two ranks turn toward the glassworks. One unlit court stays hidden until the third lantern returns.'],b:['archive','Check the curfew revisions','The revised roster leaves the choir court unstaffed between the second and third lantern rounds.'],options:['Choir court between rounds two and three','The market during the first bell','The glassworks at noon'],answer:0,fact:'The choir court stays open long enough to carry the witness list to the resistance.'}
      ]}
  ];
  const byId=new Map(cases.map(c=>[c.id,c]));
  const ckey=(c,suffix)=>'city-case:'+c.id+':'+suffix;
  const step=(g,c)=>g.questCounters?.[ckey(c,'stage')]||0;
  const surface=g=>g.world.isDungeon?g.overworld:g.world;
  const site=(g,c,key)=>surface(g).getLocation('city_'+c.id+(key?'_'+key:''));
  const at=(a,b,r=115)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<r;
  const living=p=>p&&p.hp>0&&!p.downed;
  const selected=g=>cases.find(c=>g.questCounters?.[ckey(c,'pinned')]);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,text,value='')=>'<button data-action="city-case-'+action+'" data-value="'+esc(value)+'">'+esc(text)+'</button>';
  const url=c=>(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/fieldwork/city-'+c.art+'.webp';
  const direction=(p,t)=>{const a=Math.atan2(t.y-p.y,t.x-p.x);return ['east','southeast','south','southwest','west','northwest','north','northeast'][(Math.round(a/(Math.PI/4))+8)%8];};
  const current=(g,c)=>c.clues[step(g,c)-1];
  const clearance=(g,c)=>c.id==='ironveil'?surface(g).opened.has('ironveil_rail_pass')||g.reconDossier?.filed.includes('cinder_manifest'):surface(g).berlinUnlocked();
  const requirement=c=>c.id==='ironveil'?'File “Last Car on the Siding” from Cinder Rail Depot to earn the Ironveil rail pass.':'Defeat the eight regional commanders and establish the Blackglass courtyard checkpoint to earn Berlin clearance.';
  function target(g,c){
    if(g.world.isDungeon)return g.world.locations[0];
    const zone=g.world.cityZones?.find(z=>z.key===c.id),p=g.players[0];
    if(zone&&p&&(p.x<zone.left||p.x>zone.right||p.y<zone.top||p.y>zone.bottom))return site(g,c,'tram');
    const n=step(g,c);if(!n)return site(g,c);
    if(n>=4)return site(g,c,'exit');
    const side=g.questCounters[ckey(c,'route')]===2?'b':'a';
    return site(g,c,c.clues[n-1][side][0]);
  }
  function pin(g,c,side){
    for(const other of cases)delete g.questCounters[ckey(other,'pinned')];
    g.questCounters[ckey(c,'pinned')]=1;
    if(side)g.questCounters[ckey(c,'route')]=side==='b'?2:1;
    if(g.reconDossier)g.reconDossier.pinned=false;
    const t=target(g,c);if(t)g.marker={x:t.x,y:t.y};
  }
  function open(g,c,p){
    const ui=g.ui;ui.cityFile=c.id;ui.cityReader=null;ui.cityResponse='';ui.showMenu('journal',p?.id??ui.playerIndex??0);
  }
  function start(g,c,p){
    if(step(g,c)||g.world.isDungeon||!living(p)||!clearance(g,c)||!at(p,site(g,c),140))return false;
    g.questCounters[ckey(c,'stage')]=1;pin(g,c,'a');g.audio.play('quest');g.save(false);
    g.ui.toast(c.contact+' · '+c.clues[0].subject,'quest');return true;
  }
  function finish(g,c,p){
    if(step(g,c)!==4||g.world.isDungeon||!living(p)||!at(p,site(g,c,'exit')))return false;
    g.questCounters[ckey(c,'stage')]=5;delete g.questCounters[ckey(c,'pinned')];
    for(const hero of [...g.players,g.reservePlayer].filter(Boolean)){hero.gold+=c.reward;hero.materials=(hero.materials||0)+18;}
    g.marker=null;g.save(false);g.audio.play('quest');g.ui.toast(c.result,'quest');open(g,c,p);return true;
  }
  function shortcut(g,c,p){
    if(step(g,c)!==5||g.world.isDungeon||!living(p))return false;
    const hub=site(g,c),exit=site(g,c,'exit'),from=at(p,hub)?hub:at(p,exit)?exit:null;
    if(!from)return false;
    if(!g.players.every(h=>living(h)&&at(h,from,190))){g.ui.toast('Bring both heroes to the reclaimed passage.');return false;}
    const to=from===hub?exit:hub;
    for(const [i,hero] of g.players.entries()){
      Object.assign(hero,{x:to.x+i*36,y:to.y+42,invuln:2});g.restorePlayerPosition(hero);
    }
    g.camera.x=p.x;g.camera.y=p.y;g.travelInteractUntil=g.time+.6;g.ui.hideMenu();g.input.clear?.();g.save(false);return true;
  }
  function evidence(g,c,side,p){
    const n=step(g,c),clue=current(g,c);
    if(!clue||g.world.isDungeon||!living(p)||!at(p,site(g,c,clue[side][0])))return false;
    open(g,c,p);g.ui.cityReader={id:c.id,n,side,hero:p.id};g.ui.render();return true;
  }
  function confirm(ui,c,index){
    const g=ui.game,r=ui.cityReader,p=r&&g.players.find(p=>p.id===r.hero),clue=current(g,c);
    if(!r||r.id!==c.id||!clue||r.n!==step(g,c)||!living(p)||!at(p,site(g,c,clue[r.side][0])))return false;
    if(index!==clue.answer){ui.cityResponse='That reading conflicts with the source. Compare the two details again, or try the other location.';return false;}
    // The duplicate record has no remaining value to its guards. Their retreat
    // clears the old posting without granting kills, equipment or combat XP.
    const prefix='city_watch_'+c.id+'_'+r.n+'_',w=g.world;
    for(const id of w._active.keys())if(id.startsWith(prefix))w._active.delete(id);
    for(const id of w._dormant.keys())if(id.startsWith(prefix))w._dormant.delete(id);
    w.activeEnemies=w.activeEnemies.filter(e=>!e.id.startsWith(prefix));w._rebuildEnemyGrid();
    g.questCounters[ckey(c,'proof'+r.n)]=r.side==='a'?1:2;
    g.questCounters[ckey(c,'stage')]=r.n+1;pin(g,c,'a');ui.cityReader=null;ui.cityResponse='';
    g.audio.play('quest');g.save(false);g.ui.toast(clue.fact,'quest');return true;
  }
  function posts(g,c,clue){
    const w=g.world,source=site(g,c,clue.b[0]),n=step(g,c),count=1+(c.id==='blackglass'||g.players.length>1?1:0),ids=[];
    if(!source)return ids;
    for(let i=0;i<count;i++){
      const id='city_watch_'+c.id+'_'+n+'_'+i;ids.push(id);
      if(w.dead.has(id)||w._active.has(id))continue;
      let e=w._dormant.get(id);
      if(!e){
        const type=(W.Content.reconEnemyTypes||{})[i?'signal_sergeant':c.id==='ironveil'?'rivet_guard':'lantern_stalker']??24;
        let point=null;
        for(let j=0;j<20;j++){const angle=i*2.4+j*Math.PI/10,x=source.x+Math.cos(angle)*105,y=source.y+Math.sin(angle)*105;if(!w.isBlocked(x,y,21)){point={x,y};break;}}
        point=point||{x:source.x,y:source.y};const level=Math.max(1,w.regions[source.region]?.level||12);
        e=w._createEnemy({id,type,...point,homeX:point.x,homeY:point.y,level,region:source.region,patrol:i,boss:false});
      }
      w._dormant.delete(id);w.addEnemy(e);
    }
    return ids;
  }
  const interact=G.interact;
  G.interact=function(p){
    if(this.paused||this.world.isDungeon||!living(p)||this.players.some(h=>h!==p&&h.downed&&at(p,h,100)))return interact.apply(this,arguments);
    for(const c of cases){
      const n=step(this,c),stage=current(this,c);
      if(n===4&&at(p,site(this,c,'exit'))){finish(this,c,p);return true;}
      if(n===5&&at(p,site(this,c,'exit'))){open(this,c,p);return true;}
      if(stage)for(const side of ['a','b']){
        const here=site(this,c,stage[side][0]);if(!at(p,here))continue;
        if(side==='a'){
          if(!this.cityWatch)this.cityWatch={id:c.id,n,hero:p.id,hp:p.hp,elapsed:0};
          this.ui.toast('Stay close to the lookout for three seconds. The recovered record confirms the same clue.','quest');
        }else{
          const guards=posts(this,c,stage);
          if(guards.some(id=>!this.world.dead.has(id)))this.ui.toast('The records keeper has called the watch. Defeat the marked guards or use the observation route.','quest');
          else evidence(this,c,side,p);
        }
        return true;
      }
      if(at(p,site(this,c))){open(this,c,p);return true;}
    }
    return interact.apply(this,arguments);
  };
  const update=G.updateMissions;
  G.updateMissions=function(dt){
    const result=update.apply(this,arguments);
    if(this.paused||this.world.isDungeon)return result;
    for(const c of cases){
      const clue=current(this,c),p=this.players.find(living);
      if(!p)continue;
      if(clue){
        if(this.players.some(h=>living(h)&&at(h,site(this,c,clue.b[0]),230)))posts(this,c,clue);
        for(const side of ['a','b'])if(this.players.some(h=>living(h)&&at(h,site(this,c,clue[side][0]))))this.interactionPrompt=clue[side][1];
      }
      if(this.players.some(h=>living(h)&&at(h,site(this,c))))this.interactionPrompt='Meet '+c.contact;
    }
    const watch=this.cityWatch;
    if(watch){
      const c=byId.get(watch.id),clue=current(this,c),p=this.players.find(h=>h.id===watch.hero);
      const spotted=p&&this.world.activeEnemies.some(e=>e.hp>0&&!e.dead&&(e.cityWatch&&W.CityWatch?.sees?
        e.watchMode==='alarm'&&W.CityWatch.sees(this.world,e,p):e.state==='chase'&&at(e,p,155)&&this.lineOfSight(e,p)));
      if(!living(p)||!clue||step(this,c)!==watch.n||!at(p,site(this,c,clue.a[0]),130)||p.hp<watch.hp||spotted){
        this.cityWatch=null;this.ui.toast('Observation interrupted. Return to cover and inspect again, or recover the duplicate. Confirmed evidence is in your notebook.','quest');
      }else{
        watch.elapsed+=dt;this.interactionPrompt='Observing · '+Math.max(0,3-Math.floor(watch.elapsed))+' s';
        if(watch.elapsed>=3){this.cityWatch=null;evidence(this,c,'a',p);}
      }
    }
    return result;
  };
  const startGame=G.start;G.start=function(){const ok=startGame.apply(this,arguments);if(ok){this.cityWatch=null;this.ui.cityFile=null;this.ui.cityReader=null;}return ok;};
  const track=G.trackQuest;G.trackQuest=function(){const ok=track.apply(this,arguments);if(ok)for(const c of cases)delete this.questCounters[ckey(c,'pinned')];return ok;};
  const pinRecon=G.pinRecon;G.pinRecon=function(){for(const c of cases)if(this.questCounters)delete this.questCounters[ckey(c,'pinned')];return pinRecon.apply(this,arguments);};
  const journal=U.journalMenu;
  U.journalMenu=function(){
    const g=this.game,c=byId.get(this.cityFile);
    if(!c)return journal.apply(this,arguments)+'<section class="city-dispatches"><h3>Occupied-city investigations</h3>'+cases.map(c=>button('open',c.title+' · '+c.city,c.id)).join(' ')+'</section>';
    const n=step(g,c),clue=current(g,c),read=this.cityReader?.id===c.id&&this.cityReader.n===n?this.cityReader:null;
    const known=c.clues.slice(0,Math.min(3,Math.max(0,n-1))).map((clue,i)=>{const side=g.questCounters[ckey(c,'proof'+(i+1))]===2?'b':'a';return '<li><strong>'+esc(clue.fact)+'</strong><small>'+esc(site(g,c,clue[side][0])?.name||clue[side][1])+'</small></li>';}).join('');
    const intro='<div class="city-file"><header><img src="'+esc(url(c))+'" alt=""><div><small>'+esc(c.city.toUpperCase())+'</small><h3>'+esc(c.title)+'</h3><p>'+esc(c.contact)+'</p></div></header>';
    if(read)return intro+'<article><small>SOURCE · '+esc(site(g,c,clue[read.side][0]).name)+'</small><h3>'+esc(clue.subject)+'</h3><blockquote>'+esc(clue[read.side][2])+'</blockquote><p>Which conclusion does this evidence support?</p>'+clue.options.map((o,i)=>button('answer',o,String(i))).join(' ')+(this.cityResponse?'<p role="status">'+esc(this.cityResponse)+'</p>':'')+'<p>'+button('return','Return to the street')+'</p></article></div>';
    const p=g.players[this.playerIndex||0],dest=target(g,c),town=site(g,c);
    let action='';
    if(!n){
      const tram=site(g,c,'tram'),cleared=clearance(g,c);
      action='<p>'+esc(c.brief)+'</p><p>'+esc(requirement(c))+'</p><p>Take the '+esc(tram?.name)+' from '+(c.id==='ironveil'?'Ashford Refuge.':'Dawnbridge.')+' Meet '+esc(c.contact)+' at '+esc(town?.description||town?.name)+'.</p><p>Three confirmations · '+c.reward+' coins and 18 scrap per hero.</p>'+
        (!cleared?button('lead','Pin the next campaign milestone'):living(p)&&!g.world.isDungeon&&at(p,town,140)?button('start','Accept the investigation'):button('pin','Mark the city briefing'));
    }
    else if(clue)action='<h3>'+esc(clue.subject)+'</h3>'+['a','b'].map(side=>{const loc=site(g,c,clue[side][0]);return '<div><strong>'+esc(clue[side][1])+'</strong><p>'+esc(loc?.name||'City contact')+' · '+(side==='a'?'Three seconds of uninterrupted observation':'Defeat the records guard and inspect the duplicate')+'</p>'+button('pin','Pin this lead',side)+'</div>';}).join('');
    else if(n===4)action='<p>Carry the three confirmations to '+esc(dest?.name)+' and use Interact to send your report.</p>'+button('pin','Mark extraction');
    else {
      const passage=c.id==='ironveil'?'workers’ freight lift':'choir’s undercroft';
      action='<p>'+esc(c.result)+'</p><p>Reported · '+c.reward+' coins and 18 scrap per hero.</p><p>The '+passage+' now connects the briefing shelter and extraction point.</p>'+
        (living(p)&&!g.world.isDungeon&&(at(p,town)||at(p,site(g,c,'exit')))?button('shortcut','Take the '+passage):'');
    }
    const landmark=dest&&p&&!at(p,dest,100)?'<p>'+esc(dest.name)+' · '+Math.round(Math.hypot(dest.x-p.x,dest.y-p.y))+' m '+direction(p,dest)+'</p>':'';
    return intro+'<article>'+action+landmark+(n<5?button('map','Show district map'):'')+'</article>'+(known?'<article><small>CONFIRMED EVIDENCE</small><ol>'+known+'</ol></article>':'')+'<p>'+button('close','Return to field journal')+'</p></div>';
  };
  const click=U.click;U.click=function(e){
    const b=e.target.closest?.('button[data-action]'),action=b?.dataset.action;
    if(!action?.startsWith('city-case-'))return click.apply(this,arguments);
    const g=this.game,value=b.dataset.value,c=byId.get(this.cityFile),p=g.players[this.playerIndex||0];
    this.sound();
    switch(action){
      case 'city-case-open':this.cityFile=byId.has(value)?value:null;this.cityReader=null;break;
      case 'city-case-start':if(c)start(g,c,p);break;
      case 'city-case-lead':this.cityFile=null;this.reconArchiveOpen=false;g.pinRecon();g.save(false);break;
      case 'city-case-pin':if(c){pin(g,c,value==='a'||value==='b'?value:null);g.save(false);this.toast('Pinned · '+target(g,c)?.name);}break;
      case 'city-case-map':if(c){pin(g,c);g.save(false);return this.showMenu('map',this.playerIndex);}break;
      case 'city-case-answer':if(c)confirm(this,c,Number(value));break;
      case 'city-case-shortcut':if(c&&shortcut(g,c,p))return;break;
      case 'city-case-return':this.cityReader=null;return this.hideMenu();
      case 'city-case-close':this.cityFile=null;this.cityReader=null;break;
    }
    this.render();
  };
  const pad=U.handlePad;U.handlePad=function(action,owner=0){
    if(this.menu==='journal'&&this.cityReader&&owner!==this.cityReader.hero)return;
    return pad.apply(this,arguments);
  };
  const hide=U.hideMenu;U.hideMenu=function(){
    const result=hide.apply(this,arguments);this.cityReader=null;this.cityFile=null;this.cityResponse='';return result;
  };
  const hud=U.update;U.update=function(){
    const stamp=this.lastUpdate,result=hud.apply(this,arguments),g=this.game,c=selected(g);
    if(stamp===this.lastUpdate||this.isOpen||!c)return result;
    const dest=target(g,c);if(!dest)return result;
    g.marker={x:dest.x,y:dest.y};
    const fields={'hud-mission':c.title,'hud-mission-kind':c.city,'hud-mission-progress':current(g,c)?.subject||(step(g,c)?'Report at the extraction point.':'Meet '+c.contact+'.'),'hud-mission-target':dest.name};
    for(const [id,text] of Object.entries(fields)){const el=document.getElementById(id);if(el)el.textContent=text;}
    this.updateQuestIndicator({id:'city_case_pin',title:dest.name});return result;
  };
  const uiTarget=U.questTarget;U.questTarget=function(q){const c=selected(this.game);return c&&q?.id==='city_case_pin'?target(this.game,c):uiTarget.apply(this,arguments);};
  const labels=R.drawLocationLabels;R.drawLocationLabels=function(w){
    const result=labels.apply(this,arguments);if(w.isDungeon)return result;
    for(const c of cases){
      const stage=current(this.game,c);
      const cleared=step(this.game,c)===5;
      const sites=stage?[[stage.a[0],stage.a[1]],[stage.b[0],stage.b[1]]]:step(this.game,c)===4?[['exit','Report · '+c.contact]]:cleared?[['',c.contact],['exit',c.id==='ironveil'?'Workers’ freight lift':'Choir’s undercroft']]:[['',c.contact]];
      for(const [key,caption] of sites){
        const loc=site(this.game,c,key);if(!loc||!this.visible(loc.x,loc.y,100))continue;
        if(cleared&&key==='exit')for(const i of [0,1,2])this.drawFriendly({role:c.id==='ironveil'?'engineer':'civilian',skin:i},{x:loc.x-45+i*42,y:loc.y+18+Math.sin(this.clock+i)*3,walk:false,flip:i===1});
        this.worldLabel(caption,loc.x,loc.y-65,'#ffe8af',14);
      }
    }
    return result;
  };
  const drawMap=U.drawMapLabels;U.drawMapLabels=function(ctx,sx,sy){
    const result=drawMap.apply(this,arguments),g=this.game;if(g.world.isDungeon)return result;
    ctx.save();ctx.font='bold 12px system-ui';ctx.textAlign='center';
    for(const c of cases){
      const center=site(g,c);if(!center)continue;const clue=current(g,c),keys=clue?[clue.a[0],clue.b[0]]:step(g,c)===4?['exit']:[''];
      for(const [i,key] of keys.entries()){const p=site(g,c,key);if(!p)continue;ctx.fillStyle=i?'#f9bb6a':'#abe4ce';ctx.strokeStyle='#22292b';ctx.lineWidth=3;const tag=clue?(i?'◆':'◎'):'✉';ctx.strokeText(tag,p.x*sx,p.y*sy);ctx.fillText(tag,p.x*sx,p.y*sy);}
    }
    ctx.restore();return result;
  };
  const validate=W.Save.validData;
  W.Save.validData=function(data){
    if(!validate.call(this,data))return false;
    const marks=data.questCounters||{};
    for(const c of cases){
      const n=marks[ckey(c,'stage')]??0;
      if(!Number.isInteger(n)||n<0||n>5)return false;
      for(let i=1;i<=3;i++){
        const proof=marks[ckey(c,'proof'+i)];
        if(i<n?![1,2].includes(proof):proof!==undefined)return false;
      }
    }
    return true;
  };
  W.CityInvestigations={cases,step,site,target};
}());
