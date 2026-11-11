(function () {
  'use strict';
  const W=window.OW,U=W.UI.prototype;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,label,value='',classes='')=>`<button class="${classes}" data-action="${action}" data-value="${esc(value)}">${label}</button>`;
  const questById=id=>(W.Content.quests||[]).find(q=>q.id===id);
  const catName=npc=>typeof npc?.npc==='object'?npc.npc.name||npc.name:npc?.name||npc?.npc||'A friendly cat';
  const medal=`<svg viewBox="0 0 160 144" aria-hidden="true"><path d="m42 88-8 51 26-12 17 17 8-46m34-10 8 51-26-12-17 17-8-46" fill="#73bcb0" stroke="#173d3a" stroke-width="4"/><circle cx="80" cy="65" r="55" fill="#f0c66b" stroke="#9e713e" stroke-width="5"/><circle cx="80" cy="65" r="44" fill="#173d3a" stroke="#ffe6a0" stroke-width="2"/><path d="m55 66-3-27 20 12a29 29 0 0 1 16 0l20-12-3 27c8 31-58 31-50 0" fill="#ffe3a0"/><path d="m65 65 6 2m18 0 6-2m-18 9 3 3 3-3m-3 3v5m-18-6-12-2m12 8-12 2m48-8 12-2m-12 8 12 2" fill="none" stroke="#173d3a" stroke-width="3" stroke-linecap="round"/><path d="m17 33 3-8 3 8 8 3-8 3-3 8-3-8-8-3m118 20 3-8 3 8 8 3-8 3-3 8-3-8-8-3" fill="#ffe6a0"/></svg>`;

  U.dialogueIdentity=function(){
    const npc=this.game.npcLocation||{},profile=typeof npc.npc==='object'?npc.npc:npc;
    const region=this.game.world?.regions?.find(r=>r.id===npc.region)||this.game.world?.regions?.[npc.region];
    return{npc,profile,name:catName(npc),region:region?.name||'The animal kingdoms'};
  };
  U.dialogueQuests=function(){
    const {npc}=this.dialogueIdentity(),g=this.game;
    return(g.questsForNpc?.(npc)||[]).filter(q=>{const s=this.questState(q);return s.available&&!s.complete;});
  };
  U.dialogueReadyQuests=function(){return this.game.questsReadyForNpc?.(this.game.npcLocation)||[];};
  U.dialogueRewardSummary=function(q){
    return [[q.rewardGold,'gold'],[q.rewardXp,'XP'],[q.rewardMaterials,'scrap'],[q.rewardCores,'cores']].filter(([n])=>n>0).map(([n,label])=>`${n} ${label}`).join(' · ')+(q.rewardChoices?.length?' · rare equipment choice':'');
  };
  U.dialogueHome=function(){
    const {name}=this.dialogueIdentity(),g=this.game,ready=this.dialogueReadyQuests(),quests=this.dialogueQuests(),offers=quests.filter(q=>!g.acceptedQuests?.has(q.id)),active=quests.filter(q=>g.acceptedQuests?.has(q.id)&&!this.questState(q).readyForTurnIn);
    const conversation=this.conversation(),greeting=ready.length?'You made it back! Tell me how it went.':conversation?.recall||conversation?.lines?.[0]||'Good to see a friendly face. What can I do for you?';
    return `<div class="dialogue-speech" aria-live="polite"><p>${esc(greeting)}</p></div><div class="dialogue-response-list" data-nav-group="dialogue-home" aria-label="Replies to ${esc(name)}">${ready.map(q=>button('finish-quest',`<span class="dialogue-choice-mark">✓</span><span><strong>Finish quest</strong><small>${esc(q.title)} · collect rewards</small></span>`,q.id,'dialogue-finish')).join('')}${offers.length?button('dialogue-work',`<span class="dialogue-choice-mark">!</span><span><strong>${offers.length===1?'You have a job for me?':'Who needs our help?'}</strong><small>${offers.length===1?esc(offers[0].title):offers.length+' available requests'}</small></span>`):''}${button('dialogue-talk','Let’s talk.')}${active.length?button('dialogue-active','About the work I’m doing…'):''}${button('dialogue-services','Supplies, equipment and local services…')}${button('dialogue-leave','See you soon.','','dialogue-subtle')}</div>`;
  };
  U.dialogueWork=function(){
    const quests=this.dialogueQuests(),active=this.modernDialogueView==='active',entries=quests.filter(q=>!!this.game.acceptedQuests?.has(q.id)===active&&!this.questState(q).readyForTurnIn);
    return `<div class="dialogue-speech"><p>${active?'You’re helping with these requests. What would you like to check?':entries.length?'There’s something you could help us with. Which request would you like to hear about?':'Everything here is taken care of for now. Try speaking with another friendly cat.'}</p></div><div class="dialogue-response-list" data-nav-group="dialogue-jobs">${entries.map(q=>button('dialogue-offer',`<span class="dialogue-choice-mark">${active?'→':'!'}</span><span><strong>${esc(q.title)}</strong><small>${esc(active?this.objectiveText(q):this.questTypeLabel(q))}</small></span>`,q.id)).join('')}${button('dialogue-home','Let’s talk about something else.','','dialogue-subtle')}</div>`;
  };
  U.dialogueOffer=function(){
    const q=questById(this.modernDialogueQuest),s=q&&this.questState(q);
    if(!q||!s.available||s.complete)return this.dialogueHome();
    const accepted=s.accepted||this.game.acceptedQuests?.has(q.id);
    return `<article class="dialogue-offer"><div class="dialogue-offer-label">${accepted?'Your current assignment':'A request for your help'}</div><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><div class="dialogue-offer-objective"><small>${accepted?'NEXT STEP':'THE TASK'}</small><p>${esc(this.objectiveText(q))}</p></div><div class="dialogue-offer-rewards"><small>YOUR REWARD</small><p>${esc(this.dialogueRewardSummary(q))}</p></div></article><div class="dialogue-response-list" data-nav-group="dialogue-offer">${button(accepted?'dialogue-track':'accept-quest',accepted?'Mark my next objective.':'I’m in. Let’s help them.',q.id,'primary')}${button('dialogue-back',accepted?'Back to the other requests.':'Let me think about it.','','dialogue-subtle')}</div>`;
  };
  U.modernDialogueHTML=function(){
    const view=this.modernDialogueView||'greeting';
    if(view==='offer')return this.dialogueOffer();
    if(view==='work'||view==='active')return this.dialogueWork();
    if(view==='services')return `<div class="dialogue-speech"><p>We look after one another here. What do you need?</p></div><div class="dialogue-response-list" data-nav-group="dialogue-services">${button('npc-shop','I need supplies.')}${button('npc-forge','Show me the nearest forge.')}${button('npc-bounties','Tell me about the commanders.')}${button('dialogue-home','Back to our conversation.','','dialogue-subtle')}</div>`;
    if(view==='talk')return `<div class="dialogue-topic-tabs" data-nav-group="dialogue-topics">${[['story','Your story'],['local','This place'],['advice','Advice']].map(([id,label])=>button('dialogue-topic',label,id,this.dialogueTopic===id?'selected':'')).join('')}</div><div class="dialogue-story">${this.conversationHTML()}</div><div class="dialogue-response-list">${button('dialogue-home','There was something else…','','dialogue-subtle')}</div>`;
    if(view==='accepted'){
      const q=questById(this.modernDialogueQuest);return `<div class="dialogue-speech"><p>Thank you. I’ve marked the next step on your map.</p>${q?`<div class="dialogue-accepted"><span>QUEST ACCEPTED</span><strong>${esc(q.title)}</strong><p>${esc(this.objectiveText(q))}</p></div>`:''}</div><div class="dialogue-response-list">${button('dialogue-leave','I’ll get started.','','primary')}${button('dialogue-home','One more thing…','','dialogue-subtle')}</div>`;
    }
    return this.dialogueHome();
  };
  const render=U.render;
  U.focusModernDialogue=function(remembered){
    this.restoreFocus(remembered);
    if(this.lastNavigation!=='pad')this.setControllerFocus(this.controllerFocus[this.activeController||0],this.activeController||0);
    if(this._modernDialogueKeyboardBound||!this.host.addEventListener)return;
    this._modernDialogueKeyboardBound=true;
    this.host.addEventListener('keydown',event=>{
      if(!this.isOpen||!['dialogue','quest-celebration'].includes(this.menu)||!['Tab','Enter'].includes(event.key))return;
      // Consume native Enter here so it cannot also become an input snapshot
      // that activates a second button after this view has changed.
      event.preventDefault();event.stopPropagation();if(event.repeat)return;
      const controls=this.focusableControls();if(!controls.length)return;
      const current=controls.indexOf(document.activeElement);
      if(event.key==='Tab'){this.lastNavigation='keyboard';const next=(current+(event.shiftKey?-1:1)+controls.length)%controls.length;this.setControllerFocus(controls[next],this.activeController||0);}
      else{if(current>=0)this.controllerFocus[this.activeController||0]=controls[current];this.handlePad('confirm',this.activeController||0);}
    });
  };
  U.render=function(){
    if(!this.isOpen||!['dialogue','quest-celebration'].includes(this.menu))return render.apply(this,arguments);
    const remembered=(this.controllerFocus||[]).map(c=>this.focusKey(c));
    if(this.menu==='quest-celebration'){
      this.host.innerHTML=this.questCelebrationHTML();this.focusModernDialogue(remembered);return;
    }
    const {npc,profile,name,region}=this.dialogueIdentity();
    this.host.innerHTML=`<div class="menu-layer dialogue-layer"><section class="dialogue-window" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker"><header class="dialogue-header">${this.npcPortrait({...npc,role:profile.role||npc.role},name)}<div><span>${esc(profile.role||'A friendly face')} · ${esc(region)}</span><h2 id="dialogue-speaker">${esc(name)}</h2></div>${button('dialogue-leave','×','','dialogue-close')}</header><div class="dialogue-content">${this.modernDialogueHTML()}</div><footer class="dialogue-footer"><span><kbd>A / Enter</kbd> Reply <kbd>B</kbd> Back</span><span><kbd>Esc / Start</kbd> Leave conversation</span></footer></section></div>`;
    const close=this.host.querySelector?.('.dialogue-close');close?.setAttribute?.('aria-label','Leave conversation');
    this.focusModernDialogue(remembered);
  };
  const show=U.showMenu;
  U.showMenu=function(name='pause',playerIndex){
    if(name==='dialogue'){
      if(this.activeQuestCelebration){this.menu='quest-celebration';this.isOpen=true;this.game.paused=true;this.render();return;}
      this.modernDialogueView='greeting';this.modernDialogueQuest=null;
    }
    return show.call(this,name,playerIndex);
  };
  U.setDialogueView=function(view,questId){this.modernDialogueView=view;if(questId)this.modernDialogueQuest=questId;this.controllerFocus=[null,null];this.render();};
  U.dialogueBack=function(){
    const view=this.modernDialogueView||'greeting';
    if(view==='greeting'){this.hideMenu();return;}
    if(view==='talk'&&this.dialogueNode&&this.dialogueNode!=='start'){this.dialogueNode='start';this.dialogueLastReply='';this.controllerFocus=[null,null];this.render();return;}
    if(view==='offer'){this.setDialogueView(this.game.acceptedQuests?.has(this.modernDialogueQuest)?'active':'work');return;}
    this.setDialogueView('greeting');
  };
  const focus=U.defaultControllerFocus;
  U.defaultControllerFocus=function(controls){
    if(this.menu==='dialogue'){
      const actions=['finish-quest','accept-quest','dialogue-track','dialogue-work','dialogue-reply','dialogue-offer','dialogue-talk','npc-shop','dialogue-leave'];
      for(const action of actions){const found=controls.find(c=>c.dataset?.action===action);if(found)return found;}
    }
    if(this.menu==='quest-celebration')return controls.find(c=>c.dataset?.action==='quest-celebration-continue')||controls[0];
    return focus.call(this,controls);
  };
  const pad=U.handlePad;
  U.handlePad=function(action,playerIndex=0){
    if(this.isOpen&&action==='back'&&['dialogue','quest-celebration'].includes(this.menu)){
      this.activeController=playerIndex;this.lastNavigation='pad';
      if(this.menu==='quest-celebration')this.continueQuestCelebration(false);else this.dialogueBack();return;
    }
    return pad.call(this,action,playerIndex);
  };
  // The backend owns payout and duplication checks. This queue only presents
  // receipts, including several talk objectives completed by one conversation.
  U.showQuestCelebration=function(q,details={}){
    if(!q)return;
    this.questCelebrationQueue=this.questCelebrationQueue||[];
    if(this.activeQuestCelebration?.quest.id===q.id||this.questCelebrationQueue.some(r=>r.quest.id===q.id))return;
    const receipt={quest:q,...details,rewards:details.rewards||{gold:q.rewardGold||0,xp:q.rewardXp||0,materials:q.rewardMaterials||0,cores:q.rewardCores||0,choices:q.rewardChoices||[]},nextContact:details.nextContact||this.game.questNextContact?.(q)};
    if(this.activeQuestCelebration)this.questCelebrationQueue.push(receipt);else this.activeQuestCelebration=receipt;
    this.menu='quest-celebration';this.isOpen=true;this.game.paused=true;this.controllerFocus=[null,null];this.render();
  };
  U.questCelebrationHTML=function(){
    const r=this.activeQuestCelebration;if(!r)return '';
    const rewards=r.rewards||{},next=r.nextContact,npc=next?.npc,drop=(this.game.drops||[]).find(d=>d.id===r.rewardDropId),choose=!!drop?.choices?.length;
    const cells=[[rewards.gold,'Gold','coin'],[rewards.xp,'Experience','xp'],[rewards.materials,'Scrap','scrap'],[rewards.cores,'Rare cores','core']].filter(([n])=>n>0);
    return `<div class="menu-layer quest-celebration-layer"><section class="quest-celebration" role="dialog" aria-modal="true" aria-labelledby="quest-celebration-title"><div class="quest-confetti" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--confetti-index:${i}"></i>`).join('')}</div><div class="quest-medal">${medal}</div><div class="quest-celebration-kicker">${r.automatic?'A conversation that counts':'A promise kept'}</div><h2 id="quest-celebration-title">Quest complete!</h2><h3>${esc(r.quest.title)}</h3><p class="quest-celebration-thanks">${esc(catName(this.game.npcLocation))} thanks you. Your rewards are in your pack.</p><div class="quest-reward-grid">${cells.map(([n,label,kind])=>`<div class="quest-reward-cell"><span class="quest-currency quest-currency-${kind}" aria-hidden="true"></span><strong>+${n.toLocaleString?.()||n}</strong><small>${label}</small></div>`).join('')}</div>${choose?'<p class="quest-equipment-earned">A rare equipment cache is yours. Choose one reward next.</p>':''}${next?`<div class="quest-next-contact"><span>YOUR NEXT ADVENTURE</span><strong>${npc?'Speak with '+esc(catName(npc)):esc(next.text)}</strong><p>${esc(next.quest?.title||next.text||'Your next contact is marked on the map.')}</p></div>`:''}<div class="quest-celebration-actions" data-nav-group="quest-celebration">${button('quest-celebration-continue',choose?'Choose my equipment':this.questCelebrationQueue?.length?'Next completed quest':'Keep adventuring','','primary')}${npc?button('quest-celebration-route','Mark '+esc(catName(npc))+' on my map.','','dialogue-subtle'):''}</div><p class="quest-reward-note">${this.game.players?.length>1?'Both heroes receive the reward. ':''}Rewards collected · <kbd>B / Esc</kbd> close</p></section></div>`;
  };
  U.continueQuestCelebration=function(openEquipment=true){
    const receipt=this.activeQuestCelebration;if(!receipt)return this.hideMenu();
    const drop=(this.game.drops||[]).find(d=>d.id===receipt.rewardDropId);
    this.activeQuestCelebration=null;
    if(openEquipment&&drop?.choices?.length){this.questCelebrationAfterChoice=true;if(this.game.openReward(drop,this.player())!==false)return;this.questCelebrationAfterChoice=false;}
    if(this.questCelebrationQueue?.length){const next=this.questCelebrationQueue.shift();this.showQuestCelebration(next.quest,next);return;}
    this.modernDialogueView='greeting';this.menu='dialogue';this.controllerFocus=[null,null];this.render();
  };
  const hide=U.hideMenu;
  U.hideMenu=function(){
    if(this.menu==='quest-celebration'){this.activeQuestCelebration=null;this.questCelebrationQueue=[];}
    this.questCelebrationAfterChoice=false;return hide.apply(this,arguments);
  };
  const click=U.click;
  U.click=function(event){
    const control=event.target.closest?.('button[data-action]');if(!control||control.disabled)return click.apply(this,arguments);
    const action=control.dataset.action,value=control.dataset.value;
    if(action==='dialogue-topic'){this.modernDialogueView='talk';return click.apply(this,arguments);}
    if(action==='choose-reward'&&this.questCelebrationAfterChoice){
      this.sound();if(this.game.claimReward?.(value)!==false){this.questCelebrationAfterChoice=false;if(this.questCelebrationQueue?.length){const next=this.questCelebrationQueue.shift();this.showQuestCelebration(next.quest,next);}else{this.menu='dialogue';this.modernDialogueView='greeting';this.controllerFocus=[null,null];this.render();}}else this.render();return;
    }
    if(action==='accept-quest'&&this.menu==='dialogue'){
      this.sound();const ok=this.game.acceptQuestFromNpc?.(value);if(ok!==false&&this.game.acceptedQuests?.has(value)&&this.menu!=='quest-celebration'){this.modernDialogueQuest=value;this.setDialogueView('accepted');}else this.render();return;
    }
    const own=['dialogue-home','dialogue-back','dialogue-work','dialogue-active','dialogue-services','dialogue-talk','dialogue-offer','dialogue-track','dialogue-leave','finish-quest','quest-celebration-continue','quest-celebration-route'];
    if(!own.includes(action))return click.apply(this,arguments);
    if(event.isTrusted&&event.detail>0){this.lastNavigation='mouse';if(this.game.input)this.game.input.lastKeyboard=performance.now();}this.sound();
    switch(action){
      case 'dialogue-home':this.setDialogueView('greeting');break;
      case 'dialogue-back':this.dialogueBack();break;
      case 'dialogue-work':{const offers=this.dialogueQuests().filter(q=>!this.game.acceptedQuests?.has(q.id));if(offers.length===1)this.setDialogueView('offer',offers[0].id);else this.setDialogueView('work');break;}
      case 'dialogue-active':this.setDialogueView('active');break;
      case 'dialogue-services':this.setDialogueView('services');break;
      case 'dialogue-talk':this.dialogueTopic='story';this.dialogueNode='start';this.dialogueLastReply='';this.setDialogueView('talk');break;
      case 'dialogue-offer':this.setDialogueView('offer',value);break;
      case 'dialogue-track':this.game.trackQuest(value);this.modernDialogueQuest=value;this.setDialogueView('accepted');break;
      case 'dialogue-leave':this.hideMenu();break;
      case 'finish-quest':{const result=this.game.finishQuestFromNpc?.(value);if(result&&this.menu!=='quest-celebration')this.showQuestCelebration(result.quest||questById(value),result);else this.render();break;}
      case 'quest-celebration-continue':this.continueQuestCelebration();break;
      case 'quest-celebration-route':{const next=this.activeQuestCelebration?.nextContact,npc=next?.npc;if(npc){this.game.world.discovered.add(npc.id);this.game.setMarker(npc.x,npc.y);if(next.quest)this.game.trackQuest(next.quest.id);this.toast('Next stop: '+catName(npc),'success');}this.continueQuestCelebration();break;}
    }
  };
  const status=U.questStatus,detail=U.questDetail;
  U.questStatus=function(q){return this.questState(q).readyForTurnIn?'<span class="quest-status ready-turn-in">✓ Ready to turn in</span>':status.call(this,q);};
  U.questDetail=function(q){
    if(!this.questState(q).readyForTurnIn)return detail.call(this,q);
    const npc=this.game.questTurnInContact?.(q),name=catName(npc);
    return `<div class="eyebrow">${esc(this.questTypeLabel(q))}</div>${this.questStatus(q)}<h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><div class="quest-turn-in-callout"><span>OBJECTIVE COMPLETE</span><h4>Speak with ${esc(name)}</h4><p>Your arrow now leads to the cat who will thank you and hand over your reward. Choose <strong>Finish quest</strong> in the conversation.</p></div><div class="rewards"><span>${esc(this.dialogueRewardSummary(q))}</span></div><div class="mission-actions">${button('track','Track return to '+esc(name),q.id,'primary')}${button('quest-map','Show turn-in on map',q.id)}</div>`;
  };
  U.journalMenu=function(){
    const mode=this.journalFilter||'open',quests=(W.Content.quests||[]).filter(q=>{const s=this.questState(q);return(s.available||s.complete)&&(mode==='completed'?s.complete:mode==='accepted'?this.game.acceptedQuests?.has(q.id)&&!s.complete:mode==='story'?q.main&&!s.complete:mode==='side'?!q.main&&!s.complete:!s.complete);});
    quests.sort((a,b)=>Number(this.questState(b).readyForTurnIn)-Number(this.questState(a).readyForTurnIn));
    const current=quests.find(q=>q.id===this.questId)||quests.find(q=>q.id===this.game.trackedQuest)||quests[0];if(current)this.questId=current.id;
    return `${this.campaignStatus()}<div class="catalog-filter">${[['open','Open missions'],['accepted','Accepted'],['story','Story'],['side','Side quests'],['completed','Completed']].map(([id,label])=>button('journal-filter',label,id,mode===id?'selected':'')).join('')}</div><div class="journal-layout"><div class="quest-list">${quests.map(q=>{const s=this.questState(q),progress=s.complete?'Rewards collected':s.readyForTurnIn?'Return to '+catName(this.game.questTurnInContact?.(q)):`${Math.min(s.current||0,s.required||1)} / ${s.required||1}`;return `<button class="quest ${q.id===current?.id?'selected':''} ${s.complete?'completed':''}" data-action="quest" data-value="${esc(q.id)}"><small>${s.complete?'COMPLETED':s.readyForTurnIn?'READY TO FINISH':q.main?'STORY MISSION':esc(this.questTypeLabel(q).toUpperCase())}</small><strong>${this.questStatus(q)} ${esc(q.title)}</strong><small>${esc(progress)} ${q.id===this.game.trackedQuest?'· TRACKING':''}</small></button>`;}).join('')}</div><article class="quest-detail">${current?this.questDetail(current):'<p class="empty-state">Speak with a friendly cat marked with a golden exclamation point to receive an assignment.</p>'}</article></div>`;
  };
  const missionRun=U.missionRunHTML;
  U.missionRunHTML=function(q){return this.questState(q).readyForTurnIn?'':missionRun.call(this,q);};
  // Reuse the established quest halo, while giving turn-in contacts a distinct
  // check-mark crest. Scope the flag to one NPC draw so other markers stay !.
  const R=W.Renderer?.prototype;
  if(R){
    const friendly=R.drawFriendly,available=R.npcHasAvailableQuest,marker=R.drawQuestAvailable,label=R.worldLabel;
    R.drawFriendly=function(o,pos){
      const previous=this._drawingQuestTurnIn;
      this._drawingQuestTurnIn=o.type==='npc'&&!!this.game.questsReadyForNpc?.(o).length;
      try{return friendly.call(this,o,pos);}finally{this._drawingQuestTurnIn=previous;}
    };
    R.npcHasAvailableQuest=function(o){return this._drawingQuestTurnIn||available.call(this,o);};
    R.worldLabel=function(text,x,y,color,size){return label.call(this,this._drawingQuestTurnIn&&text==='E / B · Talk'?'E / B · Finish quest':text,x,y,color,size);};
    R.drawQuestAvailable=function(x,y){
      if(!this._drawingQuestTurnIn)return marker.call(this,x,y);
      const c=this.ctx,cy=y-112+Math.sin(this.clock*3)*4;c.save();c.translate(x,cy);c.shadowColor='#b7f0a2';c.shadowBlur=13;c.fillStyle='#17392df2';c.strokeStyle='#e9cf83';c.lineWidth=2.5;c.beginPath();c.moveTo(0,-28);c.lineTo(25,-10);c.lineTo(20,17);c.lineTo(0,29);c.lineTo(-20,17);c.lineTo(-25,-10);c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.font='900 33px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#d4f2b3';c.fillText('✓',0,0);c.restore();
    };
  }
})();
