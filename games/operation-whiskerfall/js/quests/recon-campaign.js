(function () {
  'use strict';
  const W=window.OW, C=W.Content, book=C.reconCampaign, G=W.Game.prototype;
  const {ops,sites,challenges}=book, tile=160, origin=64;
  const siteById=id=>sites.find(s=>s.id===id);
  const surface=g=>g.world.isDungeon?g.overworld:g.world;
  const living=p=>p&&!p.downed&&p.hp>0;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const fresh=()=>({version:1,evidence:{},filed:[],pinned:true,route:'observed',scores:{},runSerial:0});
  const next=g=>ops.find(o=>!g.reconDossier?.filed.includes(o.id));
  const commanders=(g,op)=>(op?.bosses||[]).map(i=>surface(g).getLocation('boss_'+i)).filter(l=>l&&!surface(g).dead.has(l.id+'_commander')&&!surface(g).liberated.has(l.id));
  const currentChallenge=g=>challenges.find(c=>c.id===g.reconDossier?.run?.id);
  const optional=g=>!!currentChallenge(g);
  function cell(site,key) {
    for(const [row,line] of site.map.entries()){
      const col=line.indexOf(key);
      if(col>=0)return {x:origin+(col+.5)*tile,y:origin+(row+.5)*tile};
    }
  }
  function symbol(w,x,y){return w.reconSite.map[Math.floor((y-origin)/tile)]?.[Math.floor((x-origin)/tile)]||'#';}
  function crossingOpen(w){return !!w.state.reconSwitch&&!w.state.reconSearch&&(w.reconSite.id!=='recon_cistern'||w.state.reconSwitch===2);}
  function walkable(w,key){return key!=='#'&&(key!=='A'||crossingOpen(w))&&(key!=='K'||w.state.claimed);}
  function isBlocked(x,y,r=16){
    return [[0,0],[r,0],[0,r],[-r,0],[0,-r],[r*.71,r*.71],[-r*.71,r*.71],[r*.71,-r*.71],[-r*.71,-r*.71]].some(([dx,dy])=>!walkable(this,symbol(this,x+dx,y+dy)));
  }
  function safePoint(w,point,r=19){
    for(let ring=0;ring<14;ring++)for(let i=0;i<(ring?16:1);i++){
      const angle=i*Math.PI/8,x=point.x+Math.cos(angle)*ring*23,y=point.y+Math.sin(angle)*ring*23;
      if(!w.isBlocked(x,y,r)&&(!w.isPointLocked||!w.isPointLocked(x,y)))return {x,y};
    }
    return null;
  }
  function spaces(site){return site.map.flatMap((line,row)=>Array.from(line,(key,col)=>({x:origin+col*tile,y:origin+row*tile,w:tile,h:tile,key})).filter(t=>t.key!=='#'));}
  function observeSpot(g,op){
    const w=g.world;
    if(!op.site){
      const p=w.getLocation(op.id+'_perch');
      if(op.id==='convoy_marks'&&p){
        const wanted={x:p.x+Math.sin(g.time*.36)*100,y:p.y};
        return w.isBlocked(wanted.x,wanted.y,20)?p:wanted;
      }
      return p;
    }
    const site=w.reconSite;if(!site)return null;
    const p=cell(site,'O'),cycle=(g.time%6)/6;
    if(site.id==='recon_court')p.x+=165+Math.sin(cycle*2*Math.PI)*205;
    if(site.id==='recon_depot')p.x+=Math.sin((w.state.reconBrake?g.time%12/12:cycle)*2*Math.PI)*195;
    return p;
  }
  function points(g,op){
    if(!op)return {};
    if(g.world.isDungeon&&(!op.site||g.world.reconSite?.id!==op.site))return {};
    if(op.site&&!g.world.isDungeon)return {};
    return {observed:observeSpot(g,op),recovered:op.site?cell(g.world.reconSite,'R'):g.world.getLocation(op.id+'_cache')};
  }
  function attach(g,site,positions){
    const w=g.world;w.reconSite=site;w.width=origin*2+site.map[0].length*tile;w.height=origin*2+site.map.length*tile;
    w.rooms=spaces(site);w.start=cell(site,'S');w.isBlocked=isBlocked;
    w.state.solved=true;w.state.bossDead=true;w.state.reconSwitch=w.state.reconSwitch||0;
    if(g.reconDossier?.evidence[ops.find(o=>o.site===site.id)?.id])w.state.claimed=true;
    w.locations=[{...w.start,id:site.id+'_exit',type:'dungeonExit',name:'Return to surface',region:site.region},
      {...cell(site,'R'),id:site.id+'_order',type:'reconLead',name:'Contested recovery',region:site.region},
      {...cell(site,'T'),id:site.id+'_machine',type:'reconLead',name:site.machine,region:site.region}];
    w._locationMap=new Map(w.locations.map(l=>[l.id,l]));w.activeEnemies=[];w._active.clear();w._dormant.clear();
    for(const saved of w.state.enemies||[])if(saved.id.startsWith('recon_watch_')&&!w.dead.has(saved.id)&&saved.hp>0){
      const point=safePoint(w,saved)||w.start;
      w.addEnemy({...saved,...point,combatAction:null,prismAction:null,specialMove:null,fireTimer:1,attackTimer:1});
    }
    for(const [i,p] of g.players.entries()){
      const point=positions?.[i]||{x:w.start.x+i*48,y:w.start.y};Object.assign(p,safePoint(w,point)||w.start);
    }
    g.camera.x=g.players[0].x;g.camera.y=g.players[0].y;w._rebuildEnemyGrid();
  }
  function guardKeys(g,op){
    const run=g.reconDossier.run;
    const prefix='recon_watch_'+op.id+(run?'_practice_'+g.reconDossier.runSerial:'');
    const hasDecoy=!run&&op.site==='recon_court'&&surface(g).opened.has('survey_recon_court');
    return Array.from({length:run?3:hasDecoy?1:2},(_,i)=>prefix+'_'+i);
  }
  function guards(g,op,p){
    const w=g.world,keys=guardKeys(g,op),types=C.reconEnemyTypes||{};
    const mixes=[
      ['hookclaw_skirmisher','rivet_guard'],['sluice_warden','signal_sergeant'],
      ['glasswind_sharpshot','rivet_guard'],['lantern_stalker','hookclaw_skirmisher'],
      ['signal_sergeant','rivet_guard'],['glasswind_sharpshot','hookclaw_skirmisher']
    ];
    const mix=mixes[op.site?(sites.findIndex(s=>s.id===op.site)+1)%mixes.length:ops.indexOf(op)%mixes.length];
    for(const [i,id] of keys.entries()){
      if(w.dead.has(id)||w._active.has(id)||w._dormant.has(id))continue;
      const point=safePoint(w,{x:p.x+(i===0?110:i===1?-100:0),y:p.y+(i===2?-125:48)});
      if(!point)continue;
      const type=types[mix[i%2]]??[24,36][i%2],spec=C.enemies[type],level=Math.max(1,(op.site?siteById(op.site).level:surface(g).regions[op.region].level)||1);
      const e={...point,id,type,homeX:point.x,homeY:point.y,region:op.region,level,regionScaleApplied:true,speed:spec.speed,damage:spec.damage*(1+level*.04),range:spec.range,fireRate:spec.fireRate,name:spec.name,angle:0,state:'investigate',investigateX:p.x,investigateY:p.y,alert:5,anim:'idle',animTime:0,fireTimer:1.2,attackTimer:1.2,specialTimer:1.3};
      e.maxHp=e.hp=Math.round(spec.hp*(1+level*.08)*(g.players.length>1?1.22:1));w.addEnemy(e);
      g.effect('reinforcement',e.x,e.y,38,.6);
    }
    return keys.filter(id=>!w.dead.has(id)).length;
  }
  function operation(g){return optional(g)?ops.find(o=>o.site===currentChallenge(g).site):next(g);}
  function sourceName(op,route){
    if(!op.site)return op[route==='observed'?'a':'b'][2];
    const sources={
      recon_archive:['Upper ledger catwalk','Duplicate intake book'],
      recon_spire:['West signal perch','Eastern strip chart'],
      recon_court:['Lantern courier','Low signet press'],
      recon_depot:['Freight cart','Guarded control booth'],
      recon_cistern:['Projected vault seal','Hand-cranked override'],
      recon_vault:['Document relay','Eastern gatehouse order']
    };
    return sources[op.site][route==='observed'?0:1];
  }
  function confirm(g,op,route){
    const d=g.reconDossier,run=d.run;
    if(run){
      const c=currentChallenge(g),key=route==='observed'?'O':'R';
      if(c.route[run.stage]!==key)return false;
      run.stage++;run.carrierHealth=g.players.map(p=>p.hp);g.reconWatch=null;
      g.ui.toast('Field exercise · '+run.stage+' / '+c.route.length+' objectives. '+(run.stage===c.route.length?'Extract at the surface exit.':'Next mark pinned.'),'quest');g.save(false);return true;
    }
    if(op!==next(g)||commanders(g,op).length||d.evidence[op.id])return false;
    d.evidence[op.id]={route,source:sourceName(op,route)};g.reconWatch=null;
    if(op.site){g.world.state.claimed=true;surface(g).opened.add(op.site);}
    g.ui.toast(op.clue+' Open the journal to send your debrief.','quest');g.audio.play('quest');g.save(false);return true;
  }
  G.reconEvidenceCount=function(){return Object.keys(this.reconDossier?.evidence||{}).length;};
  G.fileReconDebrief=function(){
    const d=this.reconDossier,op=next(this);if(!op||!d.evidence[op.id]||d.filed.includes(op.id)||optional(this))return false;
    d.filed.push(op.id);d.pinned=true;d.route='observed';
    for(const p of [...this.players,this.reservePlayer].filter(Boolean)){p.gold+=160;p.materials=(p.materials||0)+12;p.cores=(p.cores||0)+1;}
    this.ui.toast(op.contact+' · '+op.result,'quest');this.audio.play('quest');this.pinRecon();this.save(false);return true;
  };
  G.reconTarget=function(){
    const w=this.world,op=operation(this),run=this.reconDossier?.run,c=currentChallenge(this);
    if(!op){
      if(w.reconSite?.id==='recon_vault')return {...cell(w.reconSite,'K'),label:'Take the courtyard hatch'};
      if(w.isDungeon)return {...w.locations[0],label:'Return to the surface'};
      if(!w.opened.has('recon_berlin_clearance'))return {...w.getLocation('recon_vault'),label:'Reach the shared courtyard hatch'};
      return {...w.getLocation(this.campaignWon?'town_0':'boss_berlin'),label:this.campaignWon?'Return to Willow':'Confront Adolph Whisker'};
    }
    const gate=commanders(this,op)[0];
    if(!run&&gate&&!w.isDungeon)return {...gate,label:'Liberate '+gate.name};
    if(w.isDungeon&&(!op.site||w.reconSite?.id!==op.site))return {...w.locations[0],label:'Return to the surface'};
    if(op.site&&!w.isDungeon){
      const east=op.site==='recon_vault'&&this.reconDossier.route==='recovered';
      return {...w.getLocation(east?'recon_vault_east':op.site),label:east?'Enter the southern gatehouse':op.site==='recon_vault'?'Enter the western document lift':'Enter '+siteById(op.site).name};
    }
    if(!run&&this.reconDossier.evidence[op.id])return {x:this.players[0].x,y:this.players[0].y,label:'Journal · send field debrief'};
    const target=run?c?.route[run.stage]:this.reconDossier?.route==='recovered'?'R':'O';
    if(w.reconSite){
      if(!target)return {...w.start,label:'Extract at the field station'};
      if(target==='O'&&!crossingOpen(w))return {...cell(w.reconSite,'T'),label:'Use '+w.reconSite.machine};
      if(target==='K')return {...cell(w.reconSite,'K'),label:w.reconSite.shortcut};
    }
    const route=target==='R'?'recovered':'observed',p=points(this,op)[route];
    return p?{...p,label:(route==='observed'?'Observe · ':'Recover · ')+sourceName(op,route)}:null;
  };
  G.pinRecon=function(route){if(!this.reconDossier)return null;this.reconDossier.pinned=true;if(route)this.reconDossier.route=route;
    const t=this.reconTarget();if(t)this.marker={x:t.x,y:t.y};return t;};
  const originalObjective=G.questObjectiveText;
  G.questObjectiveText=function(q){
    const id=typeof q==='string'?q:q?.id;
    if(id==='main_berlin_final'&&this.reconDossier&&!surface(this).berlinUnlocked()){
      const remaining=surface(this).remainingMajorBosses().length;
      return 'Berlin approach · '+remaining+' commanders remaining and '+(12-this.reconDossier.filed.length)+' field reports to file. Open the dossier for the next lead.';
    }
    return originalObjective.apply(this,arguments);
  };
  const track=G.trackQuest;G.trackQuest=function(){const result=track.apply(this,arguments);if(result&&this.reconDossier)this.reconDossier.pinned=false;return result;};
  const setMarker=G.setMarker;G.setMarker=function(){
    const result=setMarker.apply(this,arguments);if(this.reconDossier)this.reconDossier.pinned=false;return result;
  };
  const enter=G.enterDungeon;
  G.enterDungeon=function(entry,restoring=false,positions){
    const east=entry?.id==='recon_vault_east',s=siteById(east?'recon_vault':entry?.id);if(!s)return enter.apply(this,arguments);
    const op=ops.find(o=>o.site===s.id),d=this.reconDossier||fresh();
    if(!restoring&&(this.world.isDungeon||this.players.some(p=>!living(p)||dist(p,entry)>230))){this.ui.toast('Bring both heroes to the entrance.');return false;}
    if(!restoring&&!d.filed.includes(op.id)&&(op!==operation(this)||commanders(this,op).length)){this.ui.toast('No safe entry yet. Follow the pinned dossier lead.','quest');return false;}
    const save=this.save,w=this.world,canonical=east?w.getLocation(s.id):entry;
    let ok;this.save=()=>false;
    try{ok=enter.call(this,canonical,true,positions);}finally{this.save=save;}
    if(!ok)return false;
    const state=this.world.state;
    if(s.id==='recon_vault'&&!restoring)state.vaultEntrance=east?'east':'west';
    if(s.id==='recon_vault'&&state.vaultEntrance==='east'){
      const entrance=w.getLocation('recon_vault_east'),inside=cell(s,'X');
      this.dungeonReturn=this.players.map((p,i)=>safePoint(w,{x:entrance.x+i*48,y:entrance.y+85})||{x:entrance.x,y:entrance.y});
      positions=positions||this.players.map((p,i)=>({x:inside.x+i*40,y:inside.y}));
    }
    attach(this,s,positions);this.reconWatch=null;if(this.reconDossier?.pinned)this.pinRecon();
    if(!restoring){this.ui.toast(s.lesson,'quest');this.save(false);}return true;
  };
  const leave=G.leaveDungeon;
  G.leaveDungeon=function(){
    const s=this.world.reconSite,result=leave.apply(this,arguments);
    if(result&&s){this.reconWatch=null;if(this.reconDossier?.pinned)this.pinRecon();}return result;
  };
  function reachCourtyard(g){
    const w=surface(g),l=w.getLocation('recon_courtyard');
    w.opened.add('recon_berlin_clearance');w.liberated.add(l.id);
    if(g.world.isDungeon)g.leaveDungeon(false);
    for(const [i,p] of g.players.entries())Object.assign(p,safePoint(w,{x:l.x+i*45,y:l.y})||{x:l.x,y:l.y},{invuln:3});
    w.discovered.add(l.id);w.liberated.add(l.id);g.activateCheckpoint(l,false);
    g.camera.x=l.x;g.camera.y=l.y;g.pinRecon();g.save(false);
  }
  const interact=G.interact;
  G.interact=function(p){
    const w=this.world,d=this.reconDossier;
    if(!d||this.paused||!living(p)||this.players.some(q=>q!==p&&!living(q)&&dist(q,p)<110))return interact.apply(this,arguments);
    const op=operation(this),s=w.reconSite,run=d.run,c=currentChallenge(this);
    if(w.isDungeon&&!s)return interact.apply(this,arguments);
    const east=!w.isDungeon&&w.getLocation('recon_vault_east');
    if(east&&dist(p,east)<130)return this.time<(this.travelInteractUntil||0)?false:this.enterDungeon(east);
    if(s){
      if(this.time<(this.travelInteractUntil||0))return false;
      const eastExit=s.id==='recon_vault'&&cell(s,'X');
      const exit=eastExit&&dist(p,eastExit)<90?eastExit:w.start;
      if(dist(p,exit)<90){
        if(this.players.some(q=>!living(q)||dist(q,exit)>190)){this.ui.toast('Bring both heroes to the exit.');return false;}
        if(run&&c.site===s.id&&run.stage===c.route.length){d.scores[c.id]=(d.scores[c.id]||0)+1;d.run=null;this.ui.toast('Exercise complete · result recorded in the dossier.','loot');}
        if(s.id==='recon_vault'&&d.filed.includes('command_vault')){this.ui.toast('The command courtyard is through the inside hatch.','quest');}
        return this.leaveDungeon();
      }
      if(dist(p,cell(s,'T'))<92){
        const prev=w.state.reconSwitch||0,limit=s.id==='recon_cistern'?3:2;
        if(w.state.reconSearch){w.state.reconSearch=false;w.state.reconSwitch=1;}else w.state.reconSwitch=(prev+1)%limit;
        if(!crossingOpen(w)&&this.players.some(q=>w.isBlocked(q.x,q.y,20))){w.state.reconSwitch=prev;this.ui.toast('Move both heroes off the crossing before changing it.');return false;}
        this.ui.toast(s.machine+' · '+(crossingOpen(w)?s.crossing+' open':s.id==='recon_cistern'?'Rotate again to align the seal':'crossing closed')+'.','quest');this.audio.play('ui');this.save(false);return true;
      }
      if(dist(p,cell(s,'K'))<100&&w.state.claimed){
        if(run&&c.route[run.stage]==='K'){run.stage++;this.save(false);}
        if(this.players.some(q=>!living(q)||dist(q,p)>190)){this.ui.toast('Gather both heroes at the shortcut.');return false;}
        if(s.id==='recon_vault'&&d.filed.includes('command_vault')){reachCourtyard(this);return true;}
        for(const [i,q] of this.players.entries())Object.assign(q,{x:w.start.x+i*42,y:w.start.y,invuln:2});
        this.travelInteractUntil=this.time+.6;this.ui.toast('Shortcut · '+s.shortcut+' to the entrance.');return true;
      }
    }
    if(op&&(!s||op.site===s.id)&&!commanders(this,op).length&&(!d.evidence[op.id]||run)){
      const pts=points(this,op);
      for(const route of ['observed','recovered']){
        const point=pts[route];if(!point||dist(p,point)>105)continue;
        if(run&&c.route[run.stage]!== (route==='observed'?'O':'R')){this.ui.toast('Current objective · '+this.reconTarget().label);return true;}
        if(route==='observed'){
          if(s&&!crossingOpen(w)){this.ui.toast('Use '+s.machine+' to expose the evidence.');return false;}
          if(this.reconWatch?.op!==op.id||this.reconWatch.hero!==p.id)this.reconWatch={op:op.id,hero:p.id,hp:p.hp,elapsed:0};
          this.ui.toast('Observe from cover. Stay close until the exchange ends.');return true;
        }
        if(run&&c.quiet){
          if(this.time%8<4&&w.activeEnemies.some(e=>e.hp>0&&dist(e,p)<260&&this.lineOfSight(e,p))){this.ui.toast('The patrol lantern is lit. Wait under cover for the dark interval.');return false;}
          return confirm(this,op,route);
        }
        if(guards(this,op,point)){d.alarm=op.id;this.ui.toast('Search party alerted. Defeat the marked guards and collect the duplicate, or return to the observation route.','event');this.save(false);return true;}
        return confirm(this,op,route);
      }
    }
    if(s){this.ui.toast(s.lesson);return false;}return interact.apply(this,arguments);
  };
  function updateMechanism(g,dt){
    const w=g.world,s=w.reconSite;if(!s)return;
    if(s.id==='recon_spire'&&g.time%5>3.65){
      for(const p of g.players)if(living(p)&&symbol(w,p.x,p.y)==='A')g.move(p,(w.state.reconWindbreak?42:95)*dt,0,19);
    }
    const beam=mirrorBeam(w,g.time);
    if(beam?.active){
      for(const p of g.players){
        if(!living(p)||w.beamHits?.[p.id]===beam.cycle)continue;
        const dx=p.x-beam.x,dy=p.y-beam.y,t=Math.max(0,Math.min(beam.length,dx*beam.dx+dy*beam.dy));
        if(Math.hypot(dx-t*beam.dx,dy-t*beam.dy)<=22){
          g.damagePlayer(p,14,beam);(w.beamHits||={})[p.id]=beam.cycle;
        }
      }
    }
  }
  function mirrorBeam(w,time){
    if(w.reconSite?.id!=='recon_cistern')return null;
    const phase=time%6,cycle=Math.floor(time/6),t=cell(w.reconSite,'T');
    if(phase<3.2||phase>5)return null;
    // A full second of stippled warning shows the exact sweep before impact.
    const start=(cycle%4)*Math.PI/2-Math.PI/5,arc=Math.PI/2.5;
    const a=start+arc*Math.max(0,Math.min(1,(phase-4.3)/.7)),dx=Math.cos(a),dy=Math.sin(a);
    let length=18;while(length<255&&!w.isBlocked(t.x+dx*length,t.y+dy*length,4))length+=10;
    return {...t,dx,dy,length,cycle,start,arc,active:phase>=4.3};
  }
  const missions=G.updateMissions;
  G.updateMissions=function(dt){
    const result=missions.apply(this,arguments),d=this.reconDossier;if(!d||this.paused)return result;
    const op=operation(this),w=this.world,run=d.run,c=currentChallenge(this);
    if(w.reconSite){
      const site=w.reconSite,near=p=>this.players.some(hero=>living(hero)&&dist(hero,p)<96);
      this.interactionPrompt=near(cell(site,'T'))?'E / B · '+site.machine:
        near(w.start)||site.id==='recon_vault'&&near(cell(site,'X'))?'E / B · return to the surface':
        near(cell(site,'K'))&&w.state.claimed?'E / B · '+site.shortcut:'';
    }
    updateMechanism(this,dt);
    if(run&&c.intact&&run.stage===1&&this.players.some((p,i)=>p.hp<(run.carrierHealth?.[i]||0))){run.stage=0;this.reconWatch=null;this.ui.toast('Wax seal cracked. Recover a fresh copy at the booth.');}
    if(!op||(!run&&d.evidence[op.id])||commanders(this,op).length)return result;
    if(!w.isDungeon&&op.site==='recon_vault'){
      const entrance=w.getLocation('recon_vault_east');
      if(this.players.some(p=>living(p)&&dist(p,entrance)<130))this.interactionPrompt='E / B · enter the southern gatehouse';
    }
    const pts=points(this,op);if(!pts.observed)return result;
    if(w.reconSite&&run&&c.quiet&&!w.reconPatrolPosted){
      w.reconPatrolPosted=true;guards(this,op,{x:pts.recovered.x,y:pts.recovered.y+215});
    }
    if(pts.recovered&&(!run||!c.quiet)&&this.players.some(p=>living(p)&&dist(p,pts.recovered)<355))guards(this,op,pts.recovered);
    const watch=this.reconWatch;
    if(watch){
      const observer=this.players.find(p=>p.id===watch.hero);
      if(w.reconSite?.id==='recon_depot'&&observer&&watch.cartX!=null)this.move(observer,pts.observed.x-watch.cartX,0,19);
      watch.cartX=pts.observed.x;
      const danger=observer&&w.activeEnemies.some(e=>e.hp>0&&e.state!=='patrol'&&dist(e,observer)<155&&this.lineOfSight(e,observer));
      if(watch.op!==op.id||!living(observer)||dist(observer,pts.observed)>128||observer.hp<watch.hp||danger){
        if(danger){
          d.alarm=op.id;guards(this,op,pts.recovered);
          if(w.reconSite?.id==='recon_court'&&!this.players.some(q=>symbol(w,q.x,q.y)==='A'))w.state.reconSearch=true;
          this.save(false);
        }
        this.reconWatch=null;this.ui.toast('Contact lost. Find cover and restart the observation, or recover the duplicate.');
      }else{
        watch.elapsed+=dt;this.interactionPrompt='Observing · '+Math.max(0,Math.ceil(4-watch.elapsed))+' s';
        if(watch.elapsed>=4)confirm(this,op,'observed');
      }
    }else if(this.players.some(p=>living(p)&&dist(p,pts.observed)<105))this.interactionPrompt='E / B · watch from cover';
    else if(this.players.some(p=>living(p)&&dist(p,pts.recovered)<105))this.interactionPrompt='E / B · recover the dispatch';
    return result;
  };
  const normalBerlin=G.berlinUnlocked;
  G.berlinUnlocked=function(){return this.world?.isDungeon?surface(this).berlinUnlocked():normalBerlin.call(this)&&this.world.berlinUnlocked();};
  function persistFlags(g){
    const w=surface(g);w.opened.add('recon_network_active');
    if(g.reconDossier.evidence.command_vault?.route==='archive'){w.opened.add('recon_berlin_clearance');w.liberated.add('recon_courtyard');}
  }
  function migrate(data){
    const d=fresh(),dead=new Set(data.world?.dead||[]),lib=new Set(data.world?.liberated||[]),done=new Set(data.completedQuests||[]);
    const hasBoss=i=>lib.has('boss_'+i)||dead.has('boss_'+i+'_commander');
    const clearance=data.campaignWon||lib.has('boss_berlin')||dead.has('boss_berlin_commander')||Array.from({length:8},(_,i)=>hasBoss(i)).every(Boolean)||data.acceptedQuests?.includes('main_berlin_final');
    const credit=clearance?ops.length:done.has('infiltration_0')?2:done.has('escort_0')?1:0;
    for(const op of ops.slice(0,credit)){d.evidence[op.id]={route:'archive',source:'Resistance archive · prior campaign'};d.filed.push(op.id);}
    d.pinned=!data.trackedQuest||!!clearance;return d;
  }
  const snapshot=G.snapshot;G.snapshot=function(){const data=snapshot.apply(this,arguments);data.reconDossier=clone(this.reconDossier||fresh());return data;};
  const load=G.load;G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;const before=this.reconDossier;
    this.reconDossier=data.reconDossier?clone(data.reconDossier):migrate(data);this.reconWatch=null;
    let ok;try{ok=load.apply(this,arguments);}finally{if(!ok)this.reconDossier=before;}
    if(ok){persistFlags(this);if(!data.reconDossier){this.ui.toast(this.reconDossier.filed.length===12?'Berlin clearance restored from the resistance archive. The command courtyard is open.':'Field journal restored. Your active assignments remain available.','quest');this.save(false);}}
    return ok;
  };
  const start=G.start;G.start=function(opts={}){
    if(!opts.load){this.reconDossier=fresh();this.reconWatch=null;}
    const ok=start.apply(this,arguments);if(ok&&!opts.load){persistFlags(this);this.pinRecon();this.ui.toast('Saffron · '+ops[0].lead,'quest');this.save(false);}return ok;
  };
  G.startReconExercise=function(id){
    const c=challenges.find(c=>c.id===id),d=this.reconDossier;if(!c||!this.campaignWon||this.world.isDungeon||this.players.some(p=>!living(p)))return false;
    if(d.run){this.ui.toast('Finish the current exercise or abandon it in the dossier.');return false;}
    d.runSerial++;d.run={id,stage:0};d.pinned=true;
    const w=this.world,entry=w.getLocation(c.site);
    for(const [i,p] of this.players.entries())Object.assign(p,safePoint(w,{x:entry.x+i*48,y:entry.y+85})||{x:entry.x,y:entry.y});
    this.ui.hideMenu();const ok=this.enterDungeon(entry);if(!ok)d.run=null;return ok;
  };
  G.startReconPractice=function(){
    if(!this.campaignWon||this.world.isDungeon||this.players.some(p=>!living(p))||this.world.activeEnemies.some(e=>e.reconPractice&&e.hp>0))return false;
    this.ui.hideMenu();reachCourtyard(this);
    const w=this.world,def=w._spawns.get('boss_berlin_commander');if(!def)return false;
    const e=w._createEnemy({...def,id:'recon_practice_whisker',locationId:null,reconPractice:true});
    w.dead.delete(e.id);w.addEnemy(e);this.ui.toast('Whisker practice · defeat the commander or leave the arena.','quest');return true;
  };
  const kill=G.killEnemy;G.killEnemy=function(e){
    if(!e.reconPractice)return kill.apply(this,arguments);
    if(e.dead)return;e.dead=true;e.hp=0;this.reconDossier.scores.whisker=(this.reconDossier.scores.whisker||0)+1;
    this.effect('defeat',e.x,e.y,105,1);this.ui.toast('Practice completed · return to the dossier to fight again.','quest');this.save(false);
  };
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const validData=W.Save.validData;
  W.Save.validData=function(data){
    if(!validData.call(this,data))return false;
    const d=data.reconDossier;if(d===undefined)return true;
    if(!plain(d)||d.version!==1||!plain(d.evidence)||!Array.isArray(d.filed)||!plain(d.scores)||!Number.isSafeInteger(d.runSerial)||d.runSerial<0)return false;
    if(typeof d.pinned!=='boolean'||!['observed','recovered'].includes(d.route))return false;
    if(d.filed.some((id,i)=>ops[i]?.id!==id||!Object.hasOwn(d.evidence,id)))return false;
    if(!Object.entries(d.evidence).every(([id,v])=>ops.some((o,i)=>o.id===id&&i<=d.filed.length)&&plain(v)&&['observed','recovered','archive'].includes(v.route)&&typeof v.source==='string'&&v.source.length<120))return false;
    if(!Object.entries(d.scores).every(([id,n])=>(id==='whisker'||challenges.some(c=>c.id===id))&&Number.isSafeInteger(n)&&n>=0))return false;
    for(const s of sites){
      const state=data.dungeonStates?.[s.id];
      if(state===undefined)continue;
      if(!plain(state)||!Number.isInteger(state.reconSwitch)||state.reconSwitch<0||state.reconSwitch>(s.id==='recon_cistern'?2:1))return false;
      if(!['solved','claimed','bossDead'].every(key=>typeof state[key]==='boolean'))return false;
      if(!['surveyApplied','reconWindbreak','reconBrake','reconSearch'].every(key=>state[key]===undefined||typeof state[key]==='boolean'))return false;
      if(!Array.isArray(state.enemies)||state.enemies.length>160||!state.enemies.every(e=>W.ExpeditionSave.enemy(e)&&e.id.startsWith('recon_watch_')))return false;
    }
    const s=siteById(data.activeDungeon?.id);
    if(s&&(!data.dungeonStates?.[s.id]||!Array.isArray(data.activeDungeon.players)||data.activeDungeon.players.length!==data.players.length||!data.activeDungeon.players.every(p=>p&&Number.isFinite(p.x)&&p.x>=0&&p.x<origin*2+tile*s.map[0].length&&Number.isFinite(p.y)&&p.y>=0&&p.y<origin*2+tile*s.map.length)))return false;
    if(d.run){const c=challenges.find(c=>c.id===d.run.id);if(!c||!data.campaignWon||!Number.isInteger(d.run.stage)||d.run.stage<0||d.run.stage>c.route.length)return false;}
    return true;
  };
  W.Recon={book,operation,next,commanders,points,cell,spaces,walkable,crossingOpen,mirrorBeam,symbol,surface,optional,currentChallenge,migrate,origin,tile,sourceName,reachCourtyard};
}());
