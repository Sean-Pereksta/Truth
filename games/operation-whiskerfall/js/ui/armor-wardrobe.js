(function(){
  'use strict';
  const W=window.OW,U=W.UI?.prototype;
  if(typeof U?.inventoryMenu!=='function')return;
  const inventoryMenu=U.inventoryMenu;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories=[['all','All gear'],['weapon','Firearms'],['melee','Blades'],['armor','Armor'],['helmet','Headwear'],['accessory','Accessories'],['ability','Abilities']];
  const questSources={
    armor_lastwatch:{questId:'hidden_lastwatch',label:'The Last Watch',detail:'Find Warden Tallow at the ruined Stonecrest watchtower near Crystal Pass. Repair the signal, hold the broadcast, defeat the assault leader, and return to Tallow.'},
    armor_blackglass:{questId:'hidden_blackglass',label:'The Blackglass Trail',detail:'Follow the violet survey ribbons beyond Ember Rest to Scout Vesper. Read both trail signs, defeat the elite patrol, and return its route book to Vesper.'}
  };
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const percent=value=>Math.round(value*1000)/10;
  const delta=value=>(value>0?'+':'')+value;
  const outfitName=p=>['Scout','Ranger','Vanguard'][p.armorSet||0]||'Scout';
  const wornId=p=>typeof p.equipment?.armor==='string'?p.equipment.armor:p.equipment?.armor?.id;
  const canonical=(ui,value)=>typeof value==='string'?ui.item(value):ui.item(value?.id)||value;

  // Discovery is an inspection list. It never adds an item to the hero's pack.
  U.armorWardrobeItems=function(){
    const p=this.player();if(!p)return[];
    const ids=[...(p.inventory||[]).map(v=>typeof v==='string'?v:v.id),wornId(p),...Object.keys(questSources),...W.Content.equipment.filter(v=>v.slot==='armor'&&v.questId).map(v=>v.id),...(W.Content.heroArmorPatterns||[]).map(v=>v.id)];
    return [...new Set(ids)].map(id=>this.item(id)).filter(item=>item?.slot==='armor');
  };
  U.armorWardrobeSource=function(item){
    const source=questSources[item.id]||(item.questId?{questId:item.questId,label:item.rewardSource||'Rare expedition',detail:item.discoveryClue||item.rewardSource||'Find the expedition contact to earn this suit.'}:null);
    if(source){const quest=W.Content.quests?.find(q=>q.id===source.questId);return{kind:'quest',...source,label:quest?.title||source.label,level:quest?.recommendedLevel||item.level||1};}
    const pattern=W.Content.heroArmorPatterns?.find(v=>v.id===item.id);
    if(pattern){const cost=pattern.cost||{};return{kind:'forge',label:'Resistance forge',detail:`Defeat ${pattern.commanders} commanders, then craft this pattern at a resistance forge for ${cost.gold||0} gold, ${cost.materials||0} scrap and ${cost.cores||0} commander cores.`,commanders:pattern.commanders};}
    return{kind:'field',label:'Field equipment',detail:item.rewardSource||'Recovered equipment from your adventures and local supply posts.'};
  };
  U.armorWardrobeArt=function(item,large=false){
    const skin=Math.abs(Math.floor(this.player()?.skin||0))%2;
    const art=(item.expeditionArt&&W.ExpeditionArt?.markup(item,{skin}))||(item.resistanceArt&&W.ResistanceArt?.markup(item,skin))||W.HeroArmorArt?.markup(item,{skin,pose:0,className:'wardrobe-suit-art',variant:'card'})||this.icon(item,true);
    return `<span class="wardrobe-art ${large?'wardrobe-art-large':'wardrobe-art-card'}" data-preview-skin="${skin}">${art}</span>`;
  };
  // Match recalculate without mutating the player or invoking combat hooks.
  // All armor shares the hero's outfit and reinforcement rank; cap protection
  // after adding the rest of the loadout so comparisons remain honest at 72%.
  U.armorWardrobeStats=function(item){
    const p=this.player(),rank=number(p.armorRank),set=number(p.armorSet);
    const active=Object.entries(p.equipment||{}).filter(([slot])=>slot!=='armor').map(([,entry])=>canonical(this,entry)).filter(Boolean);
    if(item)active.push(item);
    active.push(W.Content.equipment.find(v=>v.weapon!==undefined&&v.weapon===p.weapon),W.Content.equipment.find(v=>v.melee!==undefined&&v.melee===p.melee));
    const armor=set*.08+rank*.022+active.reduce((sum,entry)=>sum+number(entry?.armor),0);
    const health=140+(Math.max(1,number(p.level))-1)*14+set*34+rank*12+active.reduce((sum,entry)=>sum+number(entry?.health),0);
    return{protection:percent(Math.max(0,Math.min(.72,armor))),health:Math.round(health)};
  };
  U.armorWardrobeCard=function(item){
    const owned=!!this.owned(item),worn=wornId(this.player())===item.id,selected=this.itemId===item.id,source=this.armorWardrobeSource(item),requirement=owned?this.equipRequirement(item):'';
    const state=worn?'Currently worn':owned?'Owned':source.kind==='quest'?'Locked · side quest reward':'Locked · forge pattern';
    return `<article class="wardrobe-card ${selected?'selected':''} ${worn?'is-worn':''} ${owned?'is-owned':'is-locked'}" data-armor-id="${escape(item.id)}"><button class="wardrobe-inspect" data-action="item" data-value="${escape(item.id)}" aria-pressed="${selected}" aria-label="Inspect ${escape(item.name)} · ${escape(state)}">${this.armorWardrobeArt(item)}<span class="wardrobe-card-copy"><span class="wardrobe-state">${worn?'✓ ':''}${escape(state)}</span><strong>${escape(item.name)}</strong><small>${escape(source.kind==='quest'?source.label:source.kind==='forge'?'Resistance forge pattern':'Field equipment')} · Level ${item.level||1}</small><span class="wardrobe-base-stats">${percent(number(item.armor))}% protection · +${number(item.health)} health</span></span></button>${owned?`<button class="wardrobe-card-equip ${worn?'selected':'primary'}" data-action="equip" data-value="${escape(item.id)}" aria-label="${worn?'Currently worn: ':'Equip '}${escape(item.name)}" ${worn||requirement?'disabled':''}>${worn?'✓ Currently worn':requirement?escape(requirement):'Equip armor'}</button>`:`<p class="wardrobe-card-hint">${source.kind==='quest'?'Complete this side quest to earn the whole suit.':'Inspect for the pattern and crafting requirements.'}</p>`}</article>`;
  };
  U.armorWardrobeDetail=function(item){
    const p=this.player(),source=this.armorWardrobeSource(item),owned=!!this.owned(item),worn=wornId(p)===item.id,current=canonical(this,p.equipment?.armor),requirement=owned?this.equipRequirement(item):'',stats=this.armorWardrobeStats(item),previous=this.armorWardrobeStats(current);
    const difference=(a,b,suffix='')=>{const change=Math.round((a-b)*10)/10;return `<span class="wardrobe-delta ${change<0?'negative':change>0?'positive':'neutral'}">${change===0?'No change':delta(change)+suffix}</span>`;};
    const status=worn?'Currently worn':owned?(requirement?'Owned · '+requirement:'Owned · ready to equip'):source.kind==='quest'?'Locked · earned from a side quest':'Locked · craft at a resistance forge';
    const acquisition=source.kind==='quest'?`<span class="wardrobe-source-kind">Exclusive side quest reward</span><strong>${escape(source.label)}</strong><p>${escape(source.detail)}</p><small>Recommended quest level ${source.level}. Earned by completing this quest; unavailable from shops, random loot or the forge.</small>`:source.kind==='forge'?`<span class="wardrobe-source-kind">Forge pattern</span><strong>${escape(source.label)}</strong><p>${escape(source.detail)}</p>`:`<span class="wardrobe-source-kind">Equipment source</span><strong>${escape(source.label)}</strong><p>${escape(source.detail)}</p>`;
    return `<div class="wardrobe-preview-stage">${this.armorWardrobeArt(item,true)}<span class="wardrobe-preview-caption">Player ${this.playerIndex+1} · Suit preview</span></div><div class="wardrobe-detail-copy"><p class="wardrobe-selected-state" role="status" aria-live="polite">${escape(status)}</p><span class="rarity">${escape(this.rarityName(item))} · Level ${item.level||1}</span><h3>${escape(item.name)}</h3><p class="wardrobe-description">${escape(item.description||'Resistance field armor for the long road home.')}</p><div class="wardrobe-comparison"><h4>${worn?'Your current loadout':'Compare with '+escape(current?.name||outfitName(p)+' outfit')}</h4><p>Loadout totals · outfit and reinforcement included</p><dl><div><dt>Protection</dt><dd><span class="wardrobe-old">${previous.protection}%</span><span aria-hidden="true"> → </span><strong>${stats.protection}%</strong>${difference(stats.protection,previous.protection,' percentage points')}</dd></div><div><dt>Maximum health</dt><dd><span class="wardrobe-old">${previous.health}</span><span aria-hidden="true"> → </span><strong>${stats.health}</strong>${difference(stats.health,previous.health,' health')}</dd></div></dl><small>Protection caps at 72%. Temporary wards and conditional bonuses are described above.</small></div><div class="wardrobe-source" data-source-kind="${source.kind}" ${source.questId?'data-quest-id="'+escape(source.questId)+'"':''}>${acquisition}</div>${owned?`<button class="wardrobe-detail-equip ${worn?'selected':'primary'}" data-action="equip" data-value="${escape(item.id)}" aria-label="${worn?'Currently worn: ':'Equip '}${escape(item.name)}" ${worn||requirement?'disabled':''}>${worn?'✓ Currently worn':requirement?escape(requirement):'Equip '+escape(item.name)}</button>`:'<p class="wardrobe-locked-note">'+(source.kind==='quest'?'Follow the clue above to earn this suit.':'Visit a resistance forge when the pattern requirements are met.')+'</p>'}</div>`;
  };
  U.armorWardrobeMenu=function(){
    const p=this.player();if(!p)return'<p class="empty-state">Begin a campaign to prepare your armor.</p>';
    const items=this.armorWardrobeItems(),owned=items.filter(item=>this.owned(item)),discover=items.filter(item=>!this.owned(item));
    const current=items.find(item=>item.id===this.itemId)||items.find(item=>item.id===wornId(p))||owned[0]||items[0];this.itemId=current?.id||null;
    const worn=canonical(this,p.equipment?.armor);
    return `<div class="modern-equipment armor-wardrobe">${this.playerTabs()}<div class="gear-screen-heading"><div><span class="wardrobe-eyebrow">Resistance wardrobe</span><h3>Choose how you face the fight</h3><p>Compare armor, try its look, and follow clues to your next suit.</p></div><span>${owned.length} owned · ${discover.length} to discover</span></div><div class="wardrobe-worn-summary"><span><small>Currently worn</small><strong>${escape(worn?.name||outfitName(p)+' outfit')}</strong></span><span>${escape(outfitName(p))} outfit · Reinforcement +${p.armorRank||0}<small>Your outfit and reinforcement carry across every suit.</small></span></div><nav class="catalog-filter" data-nav-group="gear-categories" aria-label="Equipment categories">${categories.map(([id,label])=>`<button class="${id==='armor'?'selected':''}" data-action="filter" data-value="${id}" aria-pressed="${id==='armor'}">${label}</button>`).join('')}</nav><div class="wardrobe-layout"><div class="inventory-grid modern-inventory-grid wardrobe-catalog" data-nav-group="gear-cards"><section class="wardrobe-group"><div class="wardrobe-group-heading"><h4>Your armor</h4><span>${owned.length}</span></div><div class="wardrobe-cards">${owned.length?owned.map(item=>this.armorWardrobeCard(item)).join(''):'<p class="empty-state">Your '+escape(outfitName(p))+' outfit is ready for the road. Recover armor or follow a suit’s clue to add it here.</p>'}</div></section>${discover.length?`<section class="wardrobe-group"><div class="wardrobe-group-heading"><h4>Suits to discover</h4><span>${discover.length}</span></div><div class="wardrobe-cards">${discover.map(item=>this.armorWardrobeCard(item)).join('')}</div></section>`:''}</div><aside class="wardrobe-detail" aria-label="Selected armor preview and comparison">${current?this.armorWardrobeDetail(current):'<p class="empty-state">Explore to discover your first suit.</p>'}</aside></div><p class="small-note wardrobe-footer">Select a suit to preview it. Each hero keeps their own armor; inspecting a locked suit never equips it.</p></div>`;
  };
  U.inventoryMenu=function(shop){return !shop&&this.filter==='armor'?this.armorWardrobeMenu():inventoryMenu.apply(this,arguments);};
  const click=U.click;
  U.click=function(event){
    const button=event.target?.closest?.('button[data-action]'),action=button?.dataset.action,id=button?.dataset.value;
    const preserve=this.menu==='inventory'&&this.filter==='armor'&&id===this.itemId&&['item','equip'].includes(action),top=preserve?this.host.querySelector?.('.wardrobe-detail')?.scrollTop||0:0;
    const result=click.call(this,event);
    if(preserve&&this.menu==='inventory'&&this.filter==='armor'&&this.itemId===id){const detail=this.host.querySelector?.('.wardrobe-detail');if(detail)detail.scrollTop=top;}
    return result;
  };
}());
