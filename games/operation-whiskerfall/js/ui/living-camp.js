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
  const main=U.mainMenu;
  U.mainMenu=function(){
    const title=main.call(this), data=this.mainTab==='continue'?W.Save.read(this.slot):null;
    const book=W.Content.reconCampaign;
    const op=book.ops.find(o=>!data?.reconDossier?.filed?.includes(o.id));
    const act=data?.campaignWon?3:op?.act||1;
    const caption=data?.campaignWon?'After Berlin':book.acts[act-1];
    return title
      .replace('<div class="menu-layer main">','<div class="menu-layer main living-title'+(this.game.settings.menuMotion===false?' still-camp':'')+'">')
      .replace(/<img class="title-cover"[^>]+>/,scene())
      .replace(/<p class="intro">[^<]*<\/p>/,'<p class="camp-chapter">'+esc(caption)+'</p>')
      .replace('Resistance dispatch</div><h2>Your next adventure</h2><p>Choose a campaign and prepare for the field.</p>','Field journal</div><h2>Campaign ledger</h2>')
      .replace('Begin the resistance','Begin the investigation');
  };
  const pause=U.pauseMenu;
  U.pauseMenu=function(){
    const text=pause.call(this),g=this.game,d=g.reconDossier;
    if(!d)return text;
    const op=W.Recon.next(g),act=op?.act||3;
    const location=(g.world.isDungeon?g.world.entry?.name:g.world.regionAt(g.players[0].x,g.players[0].y)?.name)||'Willow camp';
    const source=op&&d.evidence[op.id];
    const party=g.players.map(p=>esc(p.skin%2?'Ash':'Clover')+' · '+Math.ceil(p.hp)+' / '+p.maxHp+' HP').join(' &nbsp;/&nbsp; ');
    const head='<div class="camp-brief"><span>'+esc(location)+'</span><h3>'+esc(op?.title||(g.campaignWon?'The couriers are home':'The Berlin approach'))+'</h3><p>'+esc(source?'Evidence confirmed. Send the debrief from your field journal.':op?.lead||(g.campaignWon?'Choose a field exercise from the dossier.':'Reach the command courtyard.'))+'</p><button data-action="menu" data-value="journal">Open dossier →</button></div>';
    const panel='<div class="operation-report live-report'+(g.settings.menuMotion===false?' still-camp':'')+'"><div class="camp-window" aria-hidden="true">'+scene()+'</div>'+head+'<p class="camp-roster">'+party+'</p><p>Act '+act+' · '+d.filed.length+' / 12 debriefs filed · Slot 0'+(g.slot+1)+'</p><p class="small-note" role="status">'+esc(this.saveStatusText(g.slot))+'</p></div>';
    return text.slice(0,text.indexOf('<div class="operation-report">'))+panel+'</div>';
  };
  const settings=U.settingsMenu;
  U.settingsMenu=function(){
    return settings.call(this)+'<label class="setting"><span>Living camp animation<small>Campfire glow and drifting embers in menus</small></span><input type="checkbox" data-setting="menuMotion" '+(this.game.settings.menuMotion===false?'':'checked')+'></label>';
  };
})();
