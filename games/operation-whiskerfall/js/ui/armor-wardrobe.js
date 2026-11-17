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
  const outfitName=p=>['Scout','Ranger','Vanguard'][p.armorSet||0]||'Scout';
  const wornId=p=>typeof p.equipment?.armor==='string'?p.equipment.armor:p.equipment?.armor?.id;
  const canonical=(ui,value)=>typeof value==='string'?ui.item(value):ui.item(value?.id)||value;
  // The outer viewport can be much wider than the atlas crop. Clip the
  // embedded sheet to the actual frame before centering it in that viewport.
  W.clipGearPreview=function(html){
    return html.replace(/<svg viewBox="([\d. -]+)"([^>]*)>([\s\S]*?)<\/svg>/g,(tag,view,attrs,body)=>{
      if(!body.includes('<image')||body.includes('<svg'))return tag;
      const [x,y,w,h]=view.split(/\s+/).map(Number);
      if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return tag;
      return '<svg viewBox="0 0 '+w+' '+h+'"'+attrs+'><svg width="'+w+'" height="'+h+'" overflow="hidden" viewBox="'+view+'">'+body+'</svg></svg>';
    });
  };

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
    return `<span class="wardrobe-art ${large?'wardrobe-art-large':'wardrobe-art-card'}" data-preview-skin="${skin}">${item.reconArt==null?W.clipGearPreview(art):art}</span>`;
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
    const p=this.player(),owned=!!this.owned(item),worn=wornId(p)===item.id,selected=this.itemId===item.id;
    const state=worn?'Equipped':owned?'Owned':'Locked';
    return '<article class="wardrobe-card '+(selected?'selected':'')+' '+(worn?'is-worn':'')+'" data-armor-id="'+escape(item.id)+'"><button class="wardrobe-inspect" data-action="item" data-value="'+escape(item.id)+'" aria-pressed="'+selected+'" aria-label="'+escape(item.name+' · '+state)+'">'+this.armorWardrobeArt(item)+'<strong>'+escape(item.name)+'</strong><small>'+state+'</small></button></article>';
  };
  U.armorWardrobeDetail=function(item){
    const p=this.player(),source=this.armorWardrobeSource(item),owned=!!this.owned(item),worn=wornId(p)===item.id;
    const compare=this.wardrobeCompare===item.id,current=canonical(this,p.equipment?.armor);
    const stats=this.armorWardrobeStats(item),now=this.armorWardrobeStats(current),requirement=owned?this.equipRequirement(item):'';
    const label=current?.name||outfitName(p)+' outfit';
    const numbers='<dl class="wardrobe-numbers"><div><dt>Protection</dt><dd>'+stats.protection+'%</dd></div><div><dt>Health</dt><dd>'+stats.health+'</dd></div></dl>';
    const shown=compare?'<div class="wardrobe-more"><h4>Compared with '+escape(label)+'</h4><p>Protection '+now.protection+'% → '+stats.protection+'% · Health '+now.health+' → '+stats.health+'</p><p>'+escape(item.description||'Resistance field armor.')+'</p><h4>'+escape(source.label)+'</h4><p>'+escape(source.detail)+'</p></div>':
      this.armorWardrobeArt(item,true)+numbers+'<p class="wardrobe-brief">'+escape((item.benefit||item.description||'Resistance field armor.').split(/(?<=[.!?])\s/)[0])+'</p>';
    return '<div class="wardrobe-selected"><small>'+escape(worn?'Equipped':owned?'Owned':source.kind==='quest'?'Expedition reward':'Forge pattern')+'</small><h3>'+escape(item.name)+'</h3>'+shown+'<div class="wardrobe-actions">'+(owned?'<button class="primary" data-action="equip" data-value="'+escape(item.id)+'" '+(worn||requirement?'disabled':'')+'>'+escape(worn?'Equipped':requirement||'Equip')+'</button>':'')+'<button data-action="wardrobe-compare" data-value="'+escape(item.id)+'" aria-expanded="'+compare+'">'+(compare?'Close details':owned?'Compare':'Inspect pattern')+'</button></div></div>';
  };
  U.armorWardrobeMenu=function(){
    const p=this.player();if(!p)return '<p>Begin a campaign to open your wardrobe.</p>';
    const items=this.armorWardrobeItems(),owned=items.filter(item=>this.owned(item)),discover=items.filter(item=>!this.owned(item));
    const current=items.find(item=>item.id===this.itemId)||items.find(item=>item.id===wornId(p))||owned[0]||items[0];this.itemId=current?.id||null;
    const categoriesNav='<nav class="catalog-filter" data-nav-group="gear-categories" aria-label="Equipment categories">'+categories.map(([id,label])=>'<button class="'+(id==='armor'?'selected':'')+'" data-action="filter" data-value="'+id+'" aria-pressed="'+(id==='armor')+'">'+label+'</button>').join('')+'</nav>';
    const collection=(label,group)=>group.length?'<section class="wardrobe-group"><h4>'+label+'</h4><div class="wardrobe-cards">'+group.map(item=>this.armorWardrobeCard(item)).join('')+'</div></section>':'';
    return '<div class="modern-equipment armor-wardrobe">'+this.playerTabs()+categoriesNav+'<div class="wardrobe-layout"><div class="inventory-grid modern-inventory-grid wardrobe-catalog" data-nav-group="gear-cards">'+collection('Your suits',owned)+collection('To discover',discover)+'</div><aside class="wardrobe-detail" aria-label="Selected suit">'+(current?this.armorWardrobeDetail(current):'')+'</aside></div></div>';
  };


  U.inventoryMenu=function(shop){return !shop&&this.filter==='armor'?this.armorWardrobeMenu():inventoryMenu.apply(this,arguments);};
  const click=U.click;
  U.click=function(event){
    const button=event.target?.closest?.('button[data-action]'),action=button?.dataset.action,id=button?.dataset.value;
    if(this.menu==='inventory'&&this.filter==='armor'&&action==='wardrobe-compare'&&id===this.itemId){
      this.wardrobeCompare=this.wardrobeCompare===id?null:id;
      this.sound();this.render();
      const target=this.focusableControls().find(b=>b.dataset.action==='wardrobe-compare'&&b.dataset.value===id);
      if(target)this.setControllerFocus(target,this.activeController||0);
      return;
    }
    if(this.menu==='inventory'&&(action==='filter'||action==='item'&&id!==this.itemId))this.wardrobeCompare=null;
    const preserve=this.menu==='inventory'&&this.filter==='armor'&&id===this.itemId&&['item','equip'].includes(action),top=preserve?this.host.querySelector?.('.wardrobe-detail')?.scrollTop||0:0;
    const result=click.call(this,event);
    if(preserve&&this.menu==='inventory'&&this.filter==='armor'&&this.itemId===id){const detail=this.host.querySelector?.('.wardrobe-detail');if(detail)detail.scrollTop=top;}
    return result;
  };
  const handlePad=U.handlePad;
  U.handlePad=function(action,owner){
    if(this.menu==='inventory'&&this.filter==='armor'&&this.wardrobeCompare&&action==='back'){
      this.wardrobeCompare=null;this.render();
      this.setControllerFocus(this.focusableControls().find(b=>b.dataset.action==='wardrobe-compare'),owner||0);
      return;
    }
    return handlePad.apply(this,arguments);
  };
}());
