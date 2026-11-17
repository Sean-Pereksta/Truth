(function () {
  'use strict';
  const W=window.OW, U=W.UI.prototype,R=W.Renderer.prototype, Q=W.Recon;
  const {book,cell,operation,next,points,commanders,currentChallenge}=Q;
  const esc=t=>String(t??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  const button=(action,text,value='',primary=false)=>'<button class="'+(primary?'primary':'')+'" data-action="'+action+'" data-value="'+esc(value)+'">'+esc(text)+'</button>';
  function activePrompt(g){
    const d=g.reconDossier,op=operation(g),c=currentChallenge(g);
    if(c)return c.route[d.run.stage]==='K'?'Take the inside shortcut.':d.run.stage===c.route.length?'Extract with your partner.':c.brief;
    if(!op)return g.campaignWon?'Depart Dawnbridge for a field exercise, or visit an unfinished assignment.':'Face Adolph Whisker in the Berlin Sector.';
    if(d.evidence[op.id])return 'Send the field debrief from your journal.';
    const gated=commanders(g,op);return gated.length?'Free the witness at '+gated[0].name+'.':op.lead;
  }
  function archive(g,selected){
    const d=g.reconDossier;
    const art=[1,3,0,3,11,0,13,6,3,10,12,1];
    return '<ol class="recon-archive">'+book.ops.filter(o=>d.evidence[o.id]).slice().reverse().map(o=>{
      const witness=d.evidence[o.id],place=book.sites.find(s=>s.id===o.site)?.name||Q.surface(g).regions[o.region]?.name||'Field archive';
      const url=(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/fieldwork/evidence-'+art[book.ops.indexOf(o)]+'.webp';
      return '<li>'+button('recon-inspect',o.title,o.id)+'<span>'+esc(witness.source)+'</span>'+(selected===o.id?'<aside class="field-file"><img src="'+esc(url)+'" alt=""><div><small>'+esc(place+' · '+o.contact)+'</small><p>'+esc(o.clue)+'</p><p>'+esc(o.result)+'</p></div></aside>':'')+'</li>';
    }).join('')+'</ol>';
  }
  const journal=U.journalMenu;
  function assignments(ui){
    const g=ui.game,accepted=W.Content.quests.filter(q=>g.acceptedQuests.has(q.id)&&!g.completedQuests.has(q.id));
    const ready=accepted.filter(q=>g.questProgress(q).readyForTurnIn);
    return '<div class="recon-assignment-nav">'+button('recon-assignments','Assignments, contacts & expeditions'+(accepted.length?' · '+accepted.length+' active':''))+
      (ready.length?'<section><small>READY TO FINISH</small>'+ready.map(q=>{
        const npc=g.questTurnInContact(q),town=npc&&Q.surface(g).getLocation(npc.townId);
        const destination=npc?[npc.name,town?.name].filter(Boolean).join(' · '):'Mission contact';
        return button('recon-assignment',q.title+' → '+destination,q.id);
      }).join('')+'</section>':'')+'</div>';
  }
  U.journalMenu=function(){
    const g=this.game,d=g.reconDossier;if(!d)return journal.call(this);
    if(this.reconArchiveOpen)return button('recon-dossier','← Field dossier')+journal.call(this);
    const op=operation(g),last=book.ops.find(o=>o.id===d.filed.at(-1)),c=currentChallenge(g),act=op?.act||3,ev=op&&d.evidence[op.id],w=Q.surface(g);
    const missing=w.remainingMajorBosses().map(b=>b.name),site=book.sites.find(s=>s.id===op?.site),img=W.ReconArt?.chapterURL(act);
    const target=g.reconTarget(),p=g.players[0],gap=target&&p?Math.round(Math.hypot(target.x-p.x,target.y-p.y)):0;
    let actions='';
    if(c)actions=button('recon-abandon','Abandon exercise');
    else if(ev)actions=button('recon-file','Send field debrief',op.id,true);
    else if(op)actions=button('recon-pin','Pin observation route','observed',d.route==='observed')+button('recon-pin','Pin recovery route','recovered',d.route==='recovered');
    if(target&&!ev)actions+=button('recon-map','View waypoint');
    if(op&&!ev&&!c)actions+=button('recon-area','Search the area myself')+button('recon-precise','Request an exact pin');
    const exercise=g.campaignWon?'<section class="recon-drills"><h3>Field exercises</h3>'+book.challenges.map(v=>'<article><strong>'+esc(v.title)+'</strong><p>'+esc(v.brief)+'</p>'+button('recon-exercise',d.scores[v.id]?'Deploy again · '+d.scores[v.id]+' clears':'Deploy',v.id)+'</article>').join('')+button('recon-practice','Practice the Whisker encounter · '+(d.scores.whisker||0)+' clears')+'</section>':'';
    return '<div class="recon-journal"><header class="recon-chapter">'+(img?'<img src="'+esc(img)+'" alt="">':'')+'<div><span>ACT '+act+'</span><h3>'+esc(book.acts[act-1])+'</h3></div></header>'+
      assignments(this)+'<div class="recon-pages"><article><small>'+(c?'FIELD EXERCISE':'WHAT TO VERIFY')+'</small><h3>'+esc(c?.title||op?.title||'The Berlin relay')+'</h3>'+
      (op?'<blockquote><img class="recon-portrait" alt="" src="'+esc(W.ReconArt.url('contact-'+(book.ops.indexOf(op)+1)))+'">'+esc(op.brief)+'<cite>'+esc(op.contact)+'</cite></blockquote>':'')+'<p><strong>'+esc(activePrompt(g))+'</strong></p>'+
      (site?'<p>'+esc(site.lesson)+'</p>':'')+(ev?'<p>'+esc(ev.source)+' · '+esc(op.clue)+'</p><p>'+esc(op.result)+'</p><p>Debrief supplies per hero · 160 gold, 12 scrap, 1 core</p>':'')+
      '<div class="recon-actions">'+actions+'</div></article><aside><small>WHERE TO GO NEXT</small><h4>'+esc(target?.label||'Willow Resistance Camp')+'</h4><p>'+esc(site?.name||w.regions[op?.region??7]?.name||'Berlin Sector')+' · '+(gap?gap.toLocaleString()+' m':'On site')+'</p><hr><small>BERLIN APPROACH</small><p>'+d.filed.length+' of 12 reports filed<br>'+(8-missing.length)+' of 8 commanders defeated</p><button data-action="recon-milestones" aria-expanded="'+!!this.reconShowMilestones+'">'+(this.reconShowMilestones?'Hide checklist':'See checklist')+'</button>'+(this.reconShowMilestones?'<p>'+esc(missing.join(' · ')||'All regional commanders defeated.')+'</p>':'')+'</aside></div>'+
      '<section class="recon-known"><small>WHAT WE KNOW</small><h3>'+esc(last?last.title:'The couriers are missing')+'</h3><p>'+esc(last?last.result:'Willow received signed receipts for dispatches that never arrived. Saffron marked the last handoff.')+'</p>'+
      (g.reconEvidenceCount()?button('recon-evidence',this.reconShowEvidence?'Close evidence index':'Read evidence index · '+g.reconEvidenceCount()):'')+(this.reconShowEvidence?archive(g,this.reconInspected):'')+'</section>'+
      exercise+'</div>';
  };
  const campaignStatus=U.campaignStatus;U.campaignStatus=function(){
    const d=this.game.reconDossier;if(!d)return campaignStatus.call(this);
    return '<div class="campaign-objective"><div><strong>Berlin dossier · '+d.filed.length+' / 12 reports</strong><p>'+esc(activePrompt(this.game))+'</p></div>'+button('recon-dossier','Open field dossier')+'</div>';
  };
  const tabs=U.controllerTabs;
  U.controllerTabs=function(){
    if(this.menu!=='journal'||!this.game.reconDossier)return tabs.apply(this,arguments);
    const actions=this.reconArchiveOpen?['recon-dossier','journal-filter']:['recon-pin','recon-file','recon-assignments'];
    return Array.from(this.host.querySelectorAll('button')).filter(b=>actions.includes(b.dataset.action)&&!b.disabled&&b.offsetWidth>0);
  };
  const victory=U.victory;
  U.victory=function(){
    if(!this.game.reconDossier)return victory.call(this);
    const credits=this.reconCredits;
    return '<div class="menu-layer"><section class="panel game-over recon-ending"><small>'+(credits?'FIELD JOURNAL · CREDITS':'EPILOGUE · DAWNBRIDGE')+'</small><h2>'+(credits?'The resistance archive':'The last delivery')+'</h2><p>'+(credits?'MeowQuest the Purr’d Reich · Sean-Pereksta / Truth. Illustrated expedition environments, characters and equipment are bundled with the game. The field recordings use CC0 animal audio.':'At the Dawnbridge relay, Saffron unfolds the last dispatch. Her sister’s signature is uneven this time. The missing couriers are coming home. By morning the relay carries their names across every liberated valley.')+'</p><div class="victory-actions">'+(credits?button('recon-home','Depart from Dawnbridge', '',true):button('recon-credits','Read credits','',true))+button('export','Export adventure')+'</div></section></div>';
  };
  const click=U.click;U.click=function(e){
    const b=e.target.closest?.('button[data-action]'),action=b?.dataset.action,g=this.game,d=g.reconDossier;
    if(!d||!action?.startsWith('recon-'))return click.apply(this,arguments);
    this.sound();
    switch(action){
      case 'recon-dossier':this.reconArchiveOpen=false;if(this.menu!=='journal')return this.showMenu('journal',this.playerIndex);break;
      case 'recon-assignments':this.reconArchiveOpen=true;break;
      case 'recon-assignment':this.reconArchiveOpen=true;this.journalFilter='accepted';this.questId=b.dataset.value;break;
      case 'recon-milestones':this.reconShowMilestones=!this.reconShowMilestones;break;
      case 'recon-evidence':this.reconShowEvidence=!this.reconShowEvidence;break;
      case 'recon-inspect':this.reconInspected=this.reconInspected===b.dataset.value?null:b.dataset.value;break;
      case 'recon-area':d.searchArea=operation(g)?.id;g.pinRecon();g.save(false);return this.showMenu('map',this.playerIndex);
      case 'recon-precise':delete d.searchArea;g.pinRecon();g.save(false);this.toast('Exact lead · '+g.reconTarget().label);break;
      case 'recon-file':if(next(g)?.id===b.dataset.value)g.fileReconDebrief();break;
      case 'recon-pin':delete d.searchArea;g.pinRecon(b.dataset.value);g.save(false);this.toast('Pinned · '+g.reconTarget().label);break;
      case 'recon-map':g.pinRecon();return this.showMenu('map',this.playerIndex);
      case 'recon-exercise':if(g.startReconExercise(b.dataset.value))return;break;
      case 'recon-practice':if(g.startReconPractice())return;break;
      case 'recon-abandon':if(d.run&&g.world.isDungeon)g.leaveDungeon(false);d.run=null;g.reconWatch=null;g.save(false);break;
      case 'recon-credits':this.reconCredits=true;break;
      case 'recon-home':{
        const town=g.world.getLocation('town_7');for(const [i,p] of g.players.entries()){p.x=town.x+i*46;p.y=town.y+100;p.invuln=3;p.hp=p.maxHp;p.downed=false;g.restorePlayerPosition(p);}
        g.camera.x=town.x;g.camera.y=town.y;g.state='playing';this.reconCredits=false;d.pinned=false;g.activateCheckpoint(town,false);this.hideMenu();g.save(false);return;
      }
    }
    this.render();
  };
  const update=U.update,questTarget=U.questTarget;
  U.questTarget=function(q){if(q?.id==='current_recon_pin')return this.game.reconTarget();return questTarget.apply(this,arguments);};
  U.update=function(){
    const prev=this.lastUpdate,result=update.apply(this,arguments),g=this.game;
    if(prev===this.lastUpdate||this.isOpen||!g.players[0]||!g.reconDossier?.pinned||g.campaignWon&&!currentChallenge(g))return result;
    const op=operation(g),c=currentChallenge(g),target=g.reconTarget();
    if(target)g.marker={x:target.x,y:target.y};
    const set=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
    set('hud-mission',c?.title||op?.title||'Berlin command relay');set('hud-mission-kind',c?'Field exercise':'Field dossier · Act '+(op?.act||3));
    set('hud-mission-progress',activePrompt(g));set('hud-mission-target',target?.label||'');set('hud-mission-run','');
    this.updateQuestIndicator({id:'current_recon_pin',title:target?.label||'Field lead'});return result;
  };
  function label(renderer,txt,p,color='#fff2bf',size=13){renderer.worldLabel(txt,p.x,p.y,color,size);}
  function marker(c,p,color,elapsed=0){
    c.save();c.strokeStyle=color;c.lineWidth=3;c.setLineDash([9,5]);c.beginPath();c.ellipse(p.x,p.y,39,22,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(elapsed){c.strokeStyle='#fffbd3';c.lineWidth=5;c.beginPath();c.arc(p.x,p.y-37,22,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,elapsed/4));c.stroke();}c.restore();
  }
  function clues(r,w){
    const g=r.game,op=operation(g);if(!op||Q.commanders(g,op).length||g.reconDossier.evidence[op.id]&&!currentChallenge(g))return;
    const pts=points(g,op),clock=g.time;
    for(const route of ['observed','recovered']){
      const p=pts[route];if(!p||Math.hypot(p.x-g.camera.x,p.y-g.camera.y)>1600)continue;
      const observed=route==='observed',color=observed?'#c0eddb':'#f5bb80';
      if(observed){
        if(!op.site||op.site==='recon_court'){
          const ax=p.x+55+Math.sin(clock*.8)*36,ay=p.y-32;
          r.drawFriendly({role:'scout',skin:1,variant:2,phase:0},{x:ax,y:ay,flip:Math.cos(clock*.8)<0,walk:true});
        }else W.Art?.draw(r,'dungeonProps',2,0,p.x,p.y,90,75);
      }else W.Art?.draw(r,'dungeonProps',0,2,p.x,p.y,95,83);
      marker(r.ctx,p,color,observed?g.reconWatch?.elapsed:0);label(r,observed?'OBSERVE':'RECOVER',{x:p.x,y:p.y+45},color);
      if(!observed&&currentChallenge(g)?.quiet)label(r,clock%8<4?'LANTERN LIT · WAIT':'DARK INTERVAL · COLLECT',{x:p.x,y:p.y+64},'#fff4c2',11);
    }
  }
  const terrain=R.drawTerrain;
  function ground(r,w){
    const s=w.reconSite,plate=W.ReconArt?.dungeonPlate(s.id),floor=W.ReconArt?.floor(s.id),wall=W.ReconArt?.wall(s.id),c=r.ctx;
    if(!w.reconGround||w.reconGround.wall!==wall||w.reconGround.floor!==floor||w.reconGround.plate!==plate||w.reconGround.open!==Q.crossingOpen(w)||w.reconGround.shortcut!==w.state.claimed){
      const canvas=document.createElement('canvas');canvas.width=w.width;canvas.height=w.height;const b=canvas.getContext('2d');
      b.fillStyle='#14212a';b.fillRect(0,0,w.width,w.height);
      if(plate){b.drawImage(plate,0,0,w.width,w.height);b.fillStyle='rgba(13,24,35,.48)';b.fillRect(0,0,w.width,w.height);}
      const masonry=W.DistantVaultScenery,theme=masonry?.themes?.[{'recon_archive':'cave_kraken','recon_spire':'cave_zephyr','recon_court':'cave_zephyr','recon_depot':'cave_foundry','recon_cistern':'cave_foundry','recon_vault':'cave_kraken'}[s.id]];
      if(theme)masonry.walls(b,w.rooms,theme,r.images?.vault_dungeon_walls);
      b.fillStyle='#203039';for(const room of w.rooms)b.fillRect(room.x-10,room.y-10,room.w+20,room.h+20);
      b.fillStyle=s.palette;for(const room of w.rooms)b.fillRect(room.x-4,room.y-4,room.w+8,room.h+8);
      const paint=floor&&b.createPattern(floor,'repeat');if(paint&&typeof DOMMatrix==='function')paint.setTransform(new DOMMatrix().scale(180/floor.width));
      for(const t of w.rooms){
        b.fillStyle=paint||'#475853';b.fillRect(t.x,t.y,t.w,t.h);
        if(!Q.walkable(w,t.key)){
          b.fillStyle=t.key==='K'?'rgba(38,31,29,.48)':'rgba(14,43,62,.55)';b.fillRect(t.x,t.y,t.w,t.h);
          if(wall){b.save();b.translate(t.x+t.w/2,t.y+t.h*.48);b.drawImage(wall,-t.w/2,-19,t.w,38);b.restore();}
          b.strokeStyle='#bec5ac';b.lineWidth=3;for(let i=14;i<t.w;i+=32){b.beginPath();b.moveTo(t.x+i,t.y+5);b.lineTo(t.x+i-7,t.y+24);b.stroke();}
        }
      }
      if(wall)for(const room of w.rooms){
        // Paint exposed masonry on the non-walkable side of each cell.
        const cx=room.x+room.w/2,cy=room.y+room.h/2;
        for(const [dx,dy,angle] of [[0,-1,0],[1,0,Math.PI/2],[0,1,Math.PI],[-1,0,-Math.PI/2]]){
          if(Q.symbol(w,cx+dx*Q.tile,cy+dy*Q.tile)!=='#')continue;
          b.save();b.translate(cx+dx*Q.tile/2,cy+dy*Q.tile/2);b.rotate(angle);
          b.drawImage(wall,-Q.tile/2,-28,Q.tile,28);b.restore();
        }
      }
      w.reconGround={canvas,plate,floor,wall,open:Q.crossingOpen(w),shortcut:w.state.claimed};
    }
    c.drawImage(w.reconGround.canvas,0,0);
  }
  R.drawTerrain=function(w){
    if(!w.reconSite)return terrain.apply(this,arguments);
    const s=w.reconSite,c=this.ctx;ground(this,w);
    const m=cell(s,'T'),exit=w.start,gate=cell(s,'A'),hatch=cell(s,'K');
    const machine=W.ReconArt?.mechanism(s.id);
    if(machine)c.drawImage(machine,m.x-69,m.y-85,138,110);else W.Art?.draw(this,'dungeonProps',2,0,m.x,m.y,100,90);
    if(s.id==='recon_vault'){
      for(const [key,kind,caption] of [['S','hatch','WEST DOCUMENT LIFT'],['X','gatehouse','SOUTH GATEHOUSE'],['K','courtyard','COURTYARD CHECKPOINT']]){
        const p=cell(s,key),im=W.ReconArt?.landmark?.(kind);
        if(im){const h=110,width=h*im.width/im.height;c.drawImage(im,p.x-width/2,p.y-h,width,h);}
        else W.Art?.draw(this,'dungeonProps',key==='X'?1:3,0,p.x,p.y,110,95);
        label(this,caption,{x:p.x,y:p.y+45});
      }
    }else W.Art?.draw(this,'dungeonProps',3,0,exit.x,exit.y,110,100);
    label(this,s.machine.toUpperCase(),{x:m.x,y:m.y+45});if(s.id!=='recon_vault')label(this,'SURFACE EXIT',{x:exit.x,y:exit.y+44});
    const beam=Q.mirrorBeam(w,this.game.time);
    if(beam){
      c.save();c.beginPath();for(const room of w.rooms)c.rect(room.x,room.y,room.w,room.h);c.clip();
      c.translate(beam.x,beam.y);c.fillStyle='rgba(252,194,101,.17)';c.strokeStyle='#ffe0a4';c.lineWidth=3;c.setLineDash([8,6]);
      c.beginPath();c.moveTo(0,0);c.arc(0,0,255,beam.start,beam.start+beam.arc);c.closePath();c.fill();c.stroke();
      c.setLineDash(beam.active?[]:[6,9]);c.lineWidth=beam.active?12:4;c.beginPath();c.moveTo(0,0);c.lineTo(beam.dx*beam.length,beam.dy*beam.length);c.stroke();c.restore();
    }
    if(Q.crossingOpen(w)&&s.id==='recon_spire'){
      const cycle=this.game.time%5;
      if(cycle>2.5){
        const x=gate.x-Q.tile/2,y=gate.y-Q.tile/2;c.save();c.beginPath();c.rect(x,y,Q.tile,Q.tile);c.clip();c.fillStyle=cycle>4.45?'#ffb05b80':'#eebd6c32';c.fillRect(x,y,Q.tile,Q.tile);
        c.strokeStyle='#d6f4ff';c.lineWidth=cycle>4.45?6:2;
        for(let n=-160;n<330;n+=32){const a=n+(this.game.time*45)%32;c.beginPath();c.moveTo(x+a,y);c.lineTo(x+a-80,y+160);c.stroke();}
        c.restore();
      }
    }
    label(this,Q.crossingOpen(w)?s.crossing.toUpperCase():'CROSSING SEALED',gate,s.palette,11);
    if(s.id!=='recon_vault')label(this,w.state.claimed?s.shortcut.toUpperCase():'INSIDE LATCH',hatch,w.state.claimed?'#c4f0cc':'#ccc0a4',11);
    clues(this,w);
  };
  const labels=R.drawLocationLabels;R.drawLocationLabels=function(w){const result=labels.apply(this,arguments);if(!w.isDungeon&&this.game.reconDossier)clues(this,w);return result;};
  const drawLabels=U.drawMapLabels;U.drawMapLabels=function(ctx,sx,sy){
    const g=this.game;if(g.world.reconSite)return;
    drawLabels.apply(this,arguments);
    const target=g.reconDossier?.pinned&&g.reconTarget();if(!target)return;
    ctx.save();ctx.strokeStyle='#fff3b0';ctx.lineWidth=2;ctx.beginPath();
    if(target.radius){ctx.setLineDash([4,3]);ctx.ellipse(target.x*sx,target.y*sy,Math.max(9,target.radius*sx),Math.max(9,target.radius*sy),0,0,2*Math.PI);}
    else ctx.arc(target.x*sx,target.y*sy,8,0,2*Math.PI);
    ctx.stroke();ctx.restore();
  };
  const map=R.drawMap;
  R.drawMap=function(c,width,height){
    const w=this.game.world;if(!w.reconSite)return map.apply(this,arguments);
    c.save();c.fillStyle='#18262c';c.fillRect(0,0,width,height);c.scale(width/w.width,height/w.height);
    for(const t of w.rooms){c.fillStyle=!Q.walkable(w,t.key)?'#403f42':t.key==='T'?'#b79360':t.key==='R'?'#ac7864':t.key==='O'?'#9cbaa4':'#66807b';c.fillRect(t.x,t.y,t.w,t.h);}
    const target=this.game.reconTarget();if(target){c.strokeStyle='#ffe8a6';c.lineWidth=10;c.beginPath();c.arc(target.x,target.y,42,0,2*Math.PI);c.stroke();}
    for(const [i,p] of this.game.players.entries()){c.fillStyle=i?'#a8daff':'#fff5d0';c.beginPath();c.arc(p.x,p.y,27,0,Math.PI*2);c.fill();}
    c.restore();
  };
  const minimap=U.drawDungeonMinimap;U.drawDungeonMinimap=function(canvas){
    if(!this.game.world.reconSite)return minimap.apply(this,arguments);
    this.game.renderer.drawMap(canvas.getContext('2d'),canvas.width,canvas.height);
    canvas.setAttribute('aria-label',this.game.world.reconSite.name+' · both routes and party position');
  };
}());
