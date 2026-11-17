/* Resistance witnesses, chapter breaks and encounters at the strongholds. */
(function(){
  'use strict';
  const W=window.OW, G=W.Game.prototype, U=W.UI.prototype;
  const panel=(art,caption,alt)=>({art,caption,alt});
  const painted=(key,caption,alt)=>panel('recon/'+key+'.webp',caption,alt);
  const living=p=>p && p.hp>0 && !p.downed && !p.dead;
  const reports=[
    ['burrow','At the orchard gate, the colonel weighed each family’s flour. Anyone a handful short had to surrender a name.','Ironwhisker lowers his bayonet before he charges. Step across his line. Once his health falls, wait for the return thrust before you close in.'],
    ['moss','Bramble cut the rope bridge after the last prison cart crossed. He left the families on the bank so they could hear the locks close.','The leaves give him away. Stay out of his sightline for both shots. When he changes nests, watch the second line from his landing.'],
    ['quarry','Flintfang made the miners widen the battery. When the work was finished, he sealed the lift with the night shift still below.','His range stakes mark the next shell. Move away from them. At the battery itself, step back from the impact and then in behind the outer shockwave.'],
    ['glacier','Whiteclaw sold places beside the last stove. The families who could not pay heard his skates circle their shelter all night.','His ice blooms strike the same patch twice, sometimes three times. Leave the patch entirely. Cross his skate track before the ice fan follows.'],
    ['dune','At each dry well Sirocco put up a sign for water. Every arrow sent the caravans farther from the last working pump.','A flash in his goggles marks the first sprint. His second track cuts across it. Step off both lines and fire when he stops.'],
    ['delta','Miretooth waited until the ferry was full before he opened the poisoned sluice. The empty oars still knock against the quay.','His broadside lands on either side first. Pass between the marks, then leave the center before the last shell.'],
    ['furnace','Geargnash chained the furnace doors from the outside. On the wall, an apprentice scratched the names of everyone on her shift.','His igniter glows while he primes the mines. Shoot him to break the circuit. When the boiler vents, shelter inside its ring, then leave the core.'],
    ['bastion','Vex had the witness rolls recopied in purple ink. Beside each name he left room for a single word. Removed.','Watch the opening in the encirclement. The second mark lands where you stood. After his double volley, keep moving until the shell falls.'],
    ['vault','In the vault, Saffron finds her sister’s name on the final transmission list. The order bears the same cut-glass seal as Whisker’s collar.','Whisker fights through his command relay. Break it or find the gap in its sweep. His last volley conceals a second, marked landing.']
  ];
  const guardianReports=[
    ['ironrat','Gravelback rolled a wagon across the miners’ only exit. When they tried to lift it, the sound of turning plates began again.','Cross the charge sideways. His plates turn shots away while he rolls. Strike when the plates unfold.'],
    ['gloamwing','The last rescue crew tied lanterns to their packs. One by one the Gloamwing carried the lights up into the dark.','Move across the shadow of its swoop. Keep a gap between the falling ice and strike while its wings fold.'],
    ['motherbriar','A boot hangs from a strand at the mouth of the nursery. The rescue team followed the strands. None came back out.','Leave the venom bloom before it opens. The gaps in the web are wide enough for a fighter. Clear the brood before closing on its mother.'],
    ['hollowking','The Hollow King stole the names from the memorial stones. In the chamber below, he set them around his throne.','Wait for his violet seal to lock, then cross it. Strike after he emerges and keep a route out of his fan.'],
    ['kraken','At the harbor memorial, the final boat has no name. Nacremaw dragged it under before the painter could finish the stern.','Leave each tentacle’s marked lane. Face the opening in the tide ring, then punish the exposed shell after the water settles.']
  ];
  function commanderStrip(i){
    const name=W.Content.bosses[i].name,[place,harm,hint]=reports[i];
    return {title:name,panels:[painted('approach-'+place,harm,'The approach to the occupied stronghold'),
      painted('commander-'+i,hint,'Resistance portrait of '+name)]};
  }
  function guardianStrip(e,w){
    const i=e.kraken||e.id==='cave_kraken_guardian'?4:e.guardian;
    const [art,harm,hint]=guardianReports[i],region=w.config?.region||0;
    const first=i===4?panel('cases/rare_kraken.webp',harm,'The flooded sea cavern'):
      painted('approach-'+reports[Math.min(region,7)][0],harm,'The sealed cavern approach');
    const portrait=i===4?panel('cases/rare_kraken.webp',hint,'Nacremaw’s flooded lair'):
      {...panel('enemies/'+art+'.png',hint,e.name),crop:{cols:4,rows:2,col:3,row:0}};
    return {title:i===4?'Nacremaw, the Great Kraken':e.name,panels:[first,portrait]};
  }
  const acts={
    2:[painted('chapter-1','Juniper plays the last minute of tape. No birds. No wheels. Then, in the silence, three taps.','The dispatch trail'),
      painted('chapter-2','Saffron taps the pattern on a freight bill. “That’s when the empty wagons leave.” Crag is waiting at the quarry switchback.','The hidden freight network')],
    3:[painted('plate-depot','An apprentice opens the last crate. The mirrors inside have travelled farther than any train on the manifest.','Cinder Rail Depot'),
      painted('chapter-3','Sol holds one shard to the sun. A missing street appears in the reflection. Someone has taken Berlin off the map.','The Berlin dossier')]
  };
  const enemyStories={
    gallows_bell:{title:'The bell on the trail',panels:[
      painted('courier-camp','“We thought someone had hung a bell for lost travelers,” the courier says. “Then the bell turned around.”','A courier’s camp at dusk'),
      panel('enemies/gallows-bell.webp','A Gallows Bell Rat carries the clapper on its back. When it swings, stay in the hollow center or outside the rim.','The bell harness of a Gallows Bell Rat')]},
    seam_ripper:{title:'A seam in the dust',panels:[
      painted('approach-quarry','“Two furrows in the dirt, straight as a hem. I stepped over them. The cart behind me lost both wheels.”','The quarry trail'),
      panel('enemies/seam-ripper.webp','The Seam Ripper sets its scissor jaws on one line. Step sideways as they lock and strike when it stumbles past.','The scissor jaws of a Seam Ripper')]}
  };
  G.playActBreak=function(){
    const act=this.questCounters?.['comic:pending-act'];
    if(!acts[act]||this.comic||!W.Comics)return false;
    const ledger=this.questCounters;
    return W.Comics.show(this,{title:'Act '+(act===2?'II':'III')+' · '+W.Content.reconCampaign.acts[act-1],panels:acts[act],
      onEnd:()=>{if(this.questCounters===ledger){delete ledger['comic:pending-act'];this.save(false);}}});
  };
  // The same key lives in the ordinary campaign save, so returning from a
  // checkpoint or re-entering a cleared cavern never repeats an introduction.
  function encounterKey(e){
    if(e.dungeonBoss)return 'comic:guardian:'+(e.kraken||e.id==='cave_kraken_guardian'?'kraken':e.guardian);
    return 'comic:commander:'+e.bossIndex;
  }
  function atStronghold(g,e,p){
    if(!living(p))return false;
    if(e.dungeonBoss)return g.world.state.solved && p.x>1120 && p.x<1760 && p.y>220 && p.y<1040;
    if(e.bossIndex===8)return g.world.isFinalArena(p.x,p.y) && g.world.berlinUnlocked();
    const fort=g.world.getLocation(e.locationId);
    return !!fort && Math.hypot(p.x-fort.x,p.y-fort.y)<=fort.radius;
  }
  G.awaitBossIntroduction=function(e){
    if(!W.Comics || !this.questCounters || !e.boss || e.reconPractice)return false;
    if(this.questCounters[encounterKey(e)])return false;
    if(this.comic||this.paused||this.world.isTutorial||!this.players.some(p=>atStronghold(this,e,p)))return true;
    const ledger=this.questCounters,key=encounterKey(e),world=this.world;
    const strip=e.dungeonBoss?guardianStrip(e,world):commanderStrip(e.bossIndex);
    W.Comics.show(this,{...strip,onEnd:()=>{
      if(this.world===world && this.questCounters===ledger){ledger[key]=1;this.save(false);}
    }});
    return true;
  };
  const hit=G.damageEnemy;
  G.damageEnemy=function(e,...args){
    if(e.boss && this.awaitBossIntroduction(e)){
      if(!this.comic && !this.world.isDungeon && this.time>=(e.fortHintAfter||0)){
        e.fortHintAfter=this.time+5;
        const fort=this.world.getLocation(e.locationId);
        if(fort)this.ui.toast('Enter '+fort.name+' to face '+e.name+'.','quest');
      }
      return;
    }
    return hit.call(this,e,...args);
  };
  const status=G.applyEnemyStatus;
  G.applyEnemyStatus=function(e,...args){
    if(e.boss && this.awaitBossIntroduction(e))return;
    return status.call(this,e,...args);
  };
  const update=G.update;
  G.update=function(dt){
    if(this.questCounters?.['comic:pending-act'] && this.playActBreak())return;
    if(this.world.isDungeon && this.world.state?.solved && !this.world.state.bossDead){
      const guardian=this.world.activeEnemies.find(e=>e.dungeonBoss && living(e));
      if(guardian && !this.questCounters?.[encounterKey(guardian)] && this.players.some(p=>atStronghold(this,guardian,p)) &&
        this.awaitBossIntroduction(guardian))return;
    }
    return update.call(this,dt);
  };
  const home=U.dialogueHome;
  U.dialogueHome=function(){
    const index=this.game.npcLocation?.region,buttons=[];
    if(reports[index])buttons.push('<button data-action="hear-commander">Who gives the orders here?</button>');
    buttons.push('<button data-action="hear-enemy" data-value="gallows_bell">What rings the bell on the trails?</button>',
      '<button data-action="hear-enemy" data-value="seam_ripper">What cut those marks in the road?</button>');
    return home.call(this).replace(/<button[^>]* data-action="dialogue-leave"/,match=>buttons.join('')+match);
  };
  const click=U.click;
  U.click=function(event){
    const button=event.target.closest?.('button[data-action]'), action=button?.dataset.action;
    if(this.menu==='dialogue' && (action==='hear-commander'||action==='hear-enemy')){
      const i=this.game.npcLocation?.region;
      const strip=action==='hear-enemy'?enemyStories[button.dataset.value]:reports[i]&&commanderStrip(i);
      if(strip && W.Comics){this.sound();W.Comics.show(this.game,strip);}
      return;
    }
    return click.apply(this,arguments);
  };
})();
