(function () {
  'use strict';
  const W=window.OW, U=W.UI.prototype, rules=W.ChamberRules;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function button(action,label,options='',value=''){
    return '<button data-action="chamber-'+action+'" data-value="'+value+'" '+options+'>'+escape(label)+'</button>';
  }
  const facsimiles={echo:'echo',mirrors:'mirrors',conduit:'conduit',constellation:'constellation'};
  const expeditionPlates={cave_rimeglass:'15',cave_cindercoil:'15',cave_zephyr:'13',cave_kraken:'14'};
  function plate(w){
    const p=w.vaultSpec?'assets/fieldwork/evidence-'+expeditionPlates[w.entry.id]+'.webp':'assets/chambers/'+facsimiles[w.config.puzzle]+'.webp';
    return W.HeroArmorArt?.assetURL(p)||p;
  }
  function status(w){
    const c=w.config,s=w.state;
    if(s.solved)return 'The guardian seal is open.';
    if(w.vaultSpec)return s.vaultNodes.filter(Boolean).length+' / '+s.vaultNodes.length+' mechanisms secured';
    if(c.puzzle==='echo')return c.sequence.slice(0,s.sequenceIndex).map(i=>rules.symbols[i]).join('  ')+'   '+s.sequenceIndex+' / 4 seals';
    if(c.puzzle==='constellation')return 'Chart  '+rules.target(c,s).map((v,i)=>(i+1)+(v?' ●':' ○')).join('    ');
    if(c.puzzle==='mirrors')return rules.advanced(c,s)?(s.shutterOpen?'Crescent latch open · eastern sun waiting':'Crescent latch shut · sun shaded'):'Eastern sun waiting';
    return rules.advanced(c,s)?(s.headerCharged?'Pressure stored · wheel waiting':'Header empty · wheel waiting'):'Wheel waiting';
  }
  U.openChamberNotes=function(p){
    if(this.isOpen)return false;
    this.chamberSelection=0;this.chamberHelp=0;
    this.showMenu('chamber',Math.max(0,this.game.players.indexOf(p)));return true;
  };
  U.chamberMenu=function(){
    const w=this.game.world,c=w.config,s=w.state;
    const trial=W.Encounters.plan(w);
    if(trial){
      const waves=trial.waves.map((wave,i)=>'<li>'+escape(wave[0])+' · '+escape(wave.slice(1).map(id=>W.Content.enemies.find(e=>e.id===id)?.name).join(', '))+'</li>').join('');
      return '<article class="chamber-notes"><figure><img src="'+escape(plate(w))+'" alt="Chamber study"></figure><section><h3>'+escape(trial.name)+'</h3><p>'+escape(trial.brief)+'</p><ol>'+waves+'</ol><p>Ring the central altar when ready. Each cleared wave creates a checkpoint.</p><button data-action="close">Return to chamber</button></section></article>';
    }
    const notes=w.vaultSpec?W.VaultRoutes.notes(w):rules.evidence(c,s);
    const chosen=this.chamberSelection||0,step=this.chamberHelp||0;
    let controls='',detail='';
    if(!w.vaultSpec&&!s.solved){
      const nodes=W.Dungeons.currentNodes(w),graph=c.puzzle==='constellation'?rules.graph(c,s):null;
      const names=nodes.map((_,i)=>rules.nodeName(c,i));
      const nodeState=i=>c.puzzle==='constellation'?(s.stars[i]?' ●':' ○'):c.puzzle==='mirrors'?(s.mirrors[i]?' ＼':' ／'):c.puzzle==='conduit'?' '+W.Dungeons.pipePorts(i,s.rotations[i]).map(v=>['→','↓','←','↑'][v]).join(''):'';
      controls='<div class="chamber-nodes" data-nav-group="mechanisms">'+nodes.map((_,i)=>button('node',names[i]+nodeState(i),'aria-pressed="'+(i===chosen)+'" class="'+(i===chosen?'selected':'')+'"',i)).join('')+'</div>';
      if(graph)detail='Selecting '+names[chosen]+' changes '+rules.affected(c,s,chosen).map(i=>String(i+1)).join(', ')+'.';
      else if(c.puzzle==='echo')detail='Selected seal · '+names[chosen];
      else if(c.puzzle==='conduit')detail='Wet joints: '+(W.Dungeons.conduitTrace(s).lit.map(i=>String(i+1)).join(', ')||'none')+'.';
      else detail='The light follows the face shown on each mirror.';
      controls+='<p class="chamber-detail">'+escape(detail)+'</p><div class="chamber-actions">'+button('apply',(c.puzzle==='echo'?'Sound ':c.puzzle==='constellation'?'Flip ':'Turn ')+names[chosen],'class="primary"')+
        (graph?button('undo','Undo last star',s.starUndo?.length?'':'disabled'):'')+button('reset','Reset room')+'</div>';
    }
    const fragments=!w.vaultSpec&&c.puzzle==='echo'?'<div class="mural-fragments"><span><small>Inlet notch</small>'+c.sequence.slice(0,2).map(i=>rules.symbols[i]).join(' → ')+'</span><span><small>Bell edge</small>'+c.sequence.slice(2).map(i=>rules.symbols[i]).join(' → ')+'</span></div>':'';
    const message=step?(w.vaultSpec?notes[Math.min(step,3)]:rules.hint(c,s,step)):'';
    return '<article class="chamber-notes"><figure><img src="'+escape(plate(w))+'" alt="Painted '+escape(w.vaultSpec?.name||c.puzzle)+' study">'+fragments+'<figcaption>'+escape(w.entry.name)+'</figcaption></figure><section><small>FIELD NOTES · PLAYER '+(this.playerIndex+1)+'</small><h3>'+escape(w.vaultSpec?.name||c.title)+'</h3><p>'+escape(notes[0])+'</p><p class="chamber-status" aria-live="polite">'+escape(status(w))+'</p>'+controls+
    (s.solved?'':('<div class="chamber-hints">'+button('hint',['Review clue','Show relationship','Show next move','Refresh next move'][step])+(message?'<p role="status">'+escape(message)+'</p>':'')+'</div>'))+'<button data-action="close">Return to chamber</button></section></article>';
  };
  const click=U.click;
  U.click=function(event){
    const b=event.target?.closest?.('button[data-action]'),action=b?.dataset.action;
    if(this.menu!=='chamber'||!action?.startsWith('chamber-'))return click.apply(this,arguments);
    if(b.disabled||!this.host.contains(b))return;
    const w=this.game.world;if(!w.isDungeon||w.reconSite||w.state.solved)return;
    if(action==='chamber-node')this.chamberSelection=Number(b.dataset.value);
    if(action==='chamber-hint')this.chamberHelp=Math.min(3,(this.chamberHelp||0)+1);
    if(action==='chamber-apply')this.game.puzzleAction(this.chamberSelection);
    if(action==='chamber-undo')this.game.undoChamberStar();
    if(action==='chamber-reset'){this.game.puzzleAction(0,true);this.chamberHelp=0;}
    this.render();
  };
  const pad=U.handlePad;
  U.handlePad=function(action,owner=0){if(this.menu==='chamber'&&owner!==this.playerIndex)return;return pad.call(this,action,owner);};
}());
