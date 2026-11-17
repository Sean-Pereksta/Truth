/* The title uses a single painted scene. Only its light and airborne embers move. */
(function () {
  'use strict';
  const W=window.OW, U=W.UI.prototype;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const embers='<div class="camp-air" aria-hidden="true"><i class="camp-glow"></i>'+
    Array.from({length:9},(_,i)=>'<i class="camp-ember" style="--start:'+((i%4)*4-6)+'px;--drift:'+(8+i*3)+'px;--rise:'+(-21-i*5)+'px;--delay:'+(-.66*i)+'s"></i>').join('')+'</div>';
  function scene() {
    return '<div class="camp-painting"><img class="camp-cover" src="'+esc(W.ReconArt.url('courier-camp'))+'" alt="" decoding="async" fetchpriority="high">'+embers+'</div>';
  }
  const tabs=[
    ['pause','Camp'],['inventory','Gear'],['map','Map'],['journal','Journal'],
    ['bounty','Bounties'],['skills','Skills'],['controls','Controls'],['settings','Settings']
  ];
  function emblem(id){
    return '<img class="menu-emblem" alt="" src="'+esc(W.ReconArt.url('menu-'+id))+'">';
  }
  U.fieldLegend=function(){
    const input=this.game.input,index=this.activeController||0;
    const useKeyboard=!input?.connectedPads?.().length || (input.lastKeyboard||0)>(input.lastPadUse||0);
    if(useKeyboard)return '<kbd>↑ ↓ ← →</kbd> Move &nbsp; <kbd>Enter</kbd> Select &nbsp; <kbd>Esc</kbd> Back';
    const standard={0:'A',1:'B',4:'LB',5:'RB'};
    const name=n=>esc(input.glyph?.(index,n)||W.Input?.padName?.(n)||standard[n]);
    return '<kbd>'+name(0)+'</kbd> Select &nbsp; <kbd>'+name(1)+'</kbd> Back &nbsp; <kbd>'+name(4)+' / '+name(5)+'</kbd> Tabs';
  };
  U.nav=function(){
    return '<nav class="panel-nav illustrated-tabs" aria-label="Field menus">'+tabs.map(([id,label])=>
      '<button data-action="menu" data-value="'+id+'" class="'+(this.menu===id?'selected':'')+'" aria-label="'+label+'" aria-pressed="'+(this.menu===id)+'">'+emblem(id)+'<span>'+label+'</span></button>'
    ).join('')+'</nav>';
  };
  U.mainMenu=function(){
    const slots=W.Save.slots(),selected=slots[this.slot],continuing=this.mainTab==='continue';
    const data=continuing&&!selected.empty?W.Save.read(this.slot):null;
    const book=W.Content.reconCampaign,op=book.ops.find(o=>!data?.reconDossier?.filed?.includes(o.id));
    const chapter=data?.campaignWon?'After Berlin':book.acts[(op?.act||1)-1];
    const pressed=(on)=>' class="'+(on?'selected':'')+'" aria-pressed="'+on+'"';
    const choose=(action,value,label,on)=>'<button data-action="'+action+'" data-value="'+value+'"'+pressed(on)+'>'+label+'</button>';
    const cards=slots.map(s=>{
      const label=s.empty?(s.state==='error'?'Save unavailable':'Empty'):'Level '+s.level;
      const minutes=Math.floor(s.playTime/60);
      const detail=s.empty?'':(s.coop?'Two heroes':'Solo')+' · '+(minutes?minutes+' min':'Just started');
      return '<button class="slot '+(this.slot===s.slot?'selected':'')+'" data-action="slot" data-value="'+s.slot+'" aria-label="Slot '+(s.slot+1)+' · '+esc(label)+(detail?' · '+esc(detail):'')+'" aria-pressed="'+(this.slot===s.slot)+'"><span class="slot-number">0'+(s.slot+1)+'</span><strong>'+esc(label)+'</strong>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</button>';
    }).join('');
    const heroes=['Clover','Ash'].map((name,i)=>'<button data-action="character" data-value="'+i+'" class="character '+(this.character===i?'selected':'')+'" aria-pressed="'+(this.character===i)+'"><span class="hero-portrait" aria-hidden="true" style="background-position:0 '+(i?'42.8571':'14.2857')+'%"></span>'+name+'</button>').join('');
    const setup=continuing?'':'<div class="title-heroes" aria-label="Choose your hero">'+heroes+'</div><div class="mode-line">'+choose('mode','solo','Solo',!this.coop)+choose('mode','coop','Local co-op',this.coop)+'</div>';
    const overwrite=this.confirmOverwrite?'<div class="overwrite-confirm" role="alert">Replace the adventure in slot 0'+(this.slot+1)+'?<button class="danger" data-action="confirm-new">Replace and begin</button><button data-action="cancel-new">Keep adventure</button></div>':'';
    return '<div class="menu-layer main living-title'+(this.game.settings.menuMotion===false?' still-camp':'')+'"><div class="main-art" aria-hidden="true">'+scene()+'</div><div class="main-content"><section class="brand"><h1 id="game-title">MeowQuest <span>the Purr’d Reich</span></h1><p class="camp-chapter">'+esc(chapter)+'</p></section><section class="dispatch title-ledger" aria-label="Campaign setup"><h2>Choose a save</h2><div class="tabs">'+choose('main-tab','continue','Continue',continuing)+choose('main-tab','new','New game',!continuing)+'</div><div class="save-slots">'+cards+'</div>'+setup+'<button class="launch primary" data-action="launch" '+(continuing&&selected.empty?'disabled':'')+'>'+(continuing?'Return to the field':'Begin investigation')+' →</button>'+overwrite+(selected.empty&&selected.state!=='error'?'':'<p class="small-note" role="status">'+esc(this.saveStatusText(this.slot,false))+'</p>')+'<div class="dispatch-foot"><button data-action="menu" data-value="controls">'+emblem('controls')+'Controls</button><button data-action="menu" data-value="settings">'+emblem('settings')+'Settings</button>'+this.fullscreenButton('subtle')+'</div></section></div><footer class="title-footer"><span>'+this.fieldLegend()+'</span><span id="controller-count">'+(this.game.input?.connectedPads().length||0)+' CONTROLLERS CONNECTED</span></footer></div>';
  };
  const pause=U.pauseMenu;
  U.pauseMenu=function(){
    const g=this.game,d=g.reconDossier;if(!d)return pause.call(this);
    const p=g.players[0],op=W.Recon.next(g);
    const location=(g.world.isDungeon?g.world.entry?.name:g.world.regionAt(p.x,p.y)?.name)||'Willow camp';
    const objective=op&&d.evidence[op.id]?'Evidence confirmed. Send your debrief.':op?.lead||(g.campaignWon?'Choose a field exercise in the journal.':'Reach the Berlin courtyard.');
    const party=g.players.map(p=>esc(p.skin%2?'Ash':'Clover')+' · '+Math.ceil(p.hp)+' / '+p.maxHp+' HP').join(' &nbsp; · &nbsp; ');
    const warning=this.saveStatus(g.slot).state==='temporary'?'<p class="save-warning" role="alert">Only in this tab. Export your campaign before closing. <button data-action="export">Export campaign</button></p>':'';
    return '<div class="camp-book"><section class="camp-where '+(g.settings.menuMotion===false?'still-camp':'')+'"><div class="camp-window">'+scene()+'</div><div class="camp-notes"><span>'+esc(location)+'</span><h3>'+esc(op?.title||(g.campaignWon?'After Berlin':'The Berlin approach'))+'</h3><p>'+esc(objective)+'</p><p class="camp-party">'+party+'</p></div></section><div class="camp-destinations"><nav class="panel-nav camp-tiles" aria-label="Field menus">'+tabs.filter(([id])=>id!=='pause').map(([id,label])=>'<button data-action="menu" data-value="'+id+'">'+emblem(id)+'<span>'+label+'</span></button>').join('')+'<button data-action="coop">'+emblem('pause')+'<span>'+(g.players.length>1?'Rest Player 2':'Add Player 2')+'</span></button></nav><div class="camp-save"><button data-action="save">Save campaign</button><button data-action="exit">Save &amp; return to title</button></div><p class="camp-save-status" role="status">Slot 0'+(g.slot+1)+' · '+esc(this.saveStatusText(g.slot))+'</p>'+warning+'</div></div>';
  };
  const settings=U.settingsMenu;
  U.settingsMenu=function(){
    return settings.call(this)+'<label class="setting"><span>Living camp animation<small>Campfire glow and drifting embers in menus</small></span><input type="checkbox" data-setting="menuMotion" '+(this.game.settings.menuMotion===false?'':'checked')+'></label>';
  };
})();
