(function () {
  'use strict';
  const W=window.OW;
  if(typeof W.UI?.prototype?.render!=='function')return;
  const U=W.UI.prototype;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors=['#bdc2af','#96c183','#7fbcd1','#bb9bdf','#e9bc60','#ed9c85'];
  const tabs=[['all','All gear'],['weapon','Firearms'],['melee','Blades'],['armor','Armor'],['helmet','Headwear'],['accessory','Accessories'],['ability','Abilities']];
  const categories=['Movement','Defense','Control','Offense','Support'];
  const originalArtwork=U.abilityArtwork,originalClick=U.click,originalFocus=U.defaultControllerFocus;

  U.abilityArtwork=function(a){
    return W.AbilityArt?.markup(a,{className:'ability-art illustrated-ability-art',variant:'card'})||originalArtwork.call(this,a);
  };
  U.abilityLoadout=function(){
    const p=this.player(),bindings=this.game.input?.bindings||{},pad=this.game.input?.padBindings||{};
    return `<div class="ability-loadout modern-ability-loadout" aria-label="Equipped active abilities">${[['ability','Primary'],['ability2','Secondary']].map(([slot,label])=>{
      const index=p[slot],a=W.Content.abilities[index]||{},key=W.Input?.keyName?W.Input.keyName(bindings[(this.playerIndex?'p2':'')+slot]):this.playerIndex?(slot==='ability'?'Num 4':'Num 5'):(slot==='ability'?'Q':'F'),button=W.Input?.padName?W.Input.padName(pad[slot]):slot==='ability'?'Y':'LT';
      const art=W.AbilityArt?.markup(a,{className:'loadout-ability-art',variant:'thumbnail'})||this.abilityGlyph(a);
      return `<button class="ability-loadout-slot" data-action="ability-loadout-inspect" data-value="${index}" aria-label="Inspect equipped ${label.toLowerCase()} ability: ${escape(a.name||'None')}">${art}<span class="loadout-text"><span class="section-label">${label} · <kbd>${escape(key)}</kbd> / <kbd>${escape(button)}</kbd></span><strong>${escape(a.name||'Choose an ability')}</strong><small>${a.cooldown||0}s cooldown · View ability</small></span><span class="loadout-mark" aria-label="Equipped">✓</span></button>`;
    }).join('')}</div>`;
  };
  U.skillsCatalog=function(includeTraining=true){
    let selected=this.skillsCategory||'all';if(!includeTraining&&selected==='training')selected='all';
    const groups=categories.filter(category=>W.Content.abilities.some(a=>this.abilityCategory(a)===category));
    return `<nav class="skill-category-tabs" data-nav-group="skill-categories" aria-label="Ability categories">${[['all','All abilities'],...groups.map(c=>[c,c]),...(includeTraining?[['training','Passive training']]:[])].map(([id,label])=>`<button data-action="skill-category" data-value="${id}" class="${selected===id?'selected':''}" aria-pressed="${selected===id}">${label}</button>`).join('')}</nav>${selected!=='training'?`<div class="active-ability-catalog" data-nav-group="active-abilities">${groups.filter(c=>selected==='all'||selected===c).map(category=>{const abilities=W.Content.abilities.map((a,i)=>({a,i})).filter(({a})=>this.abilityCategory(a)===category);return `<section class="ability-category-section"><div class="skills-section-heading"><h3>${escape(category)}</h3><span>${abilities.filter(({i})=>this.abilityStatus(this.player(),i).unlocked).length} / ${abilities.length} learned</span></div><div class="skill-ability-grid">${abilities.map(({a,i})=>this.abilityCard(a,i)).join('')}</div></section>`;}).join('')}</div>`:this.passiveTraining()}`;
  };

  // A recovered treasure only needs its equip requirements. Purchase restrictions
  // such as commander cores and reward-only sourcing apply to the shop alone.
  U.equipRequirement=function(item){
    const p=this.player();if(!p)return 'Begin a campaign first';
    if((p.level||1)<(item.level||1))return 'Requires hero level '+item.level;
    if(item.ability!==undefined){const status=this.abilityStatus(p,item.ability);if(!status.unlocked)return status.reason;}
    return '';
  };
  U.gearSlots=function(item){
    const p=this.player(),slots=[];
    if(item.weapon!==undefined){if(p.weapon===item.weapon)slots.push('Primary');if(p.secondary===item.weapon)slots.push('Backup');}
    else if(item.ability!==undefined){if(p.ability===item.ability)slots.push('Primary');if(p.ability2===item.ability)slots.push('Secondary');}
    else if(this.isEquipped(item))slots.push(item.melee!==undefined?'Equipped blade':'Worn');
    return slots;
  };
  U.gearStats=function(item){
    const weapon=item.weapon!==undefined?W.Content.weapons[item.weapon]:item.melee!==undefined?W.Content.melee[item.melee]:null,stats=[];
    if(weapon){stats.push(['Damage',weapon.damage]);if(weapon.fireRate)stats.push(['Shots / sec',Number(weapon.fireRate).toFixed(1)]);if(weapon.magazine)stats.push(['Magazine',weapon.magazine]);}
    if(item.armor)stats.push(['Protection','+'+Math.round(item.armor*100)+'%']);
    if(item.health)stats.push(['Health','+'+item.health]);
    if(item.damage)stats.push(['Damage','+'+Math.round(item.damage*100)+'%']);
    if(item.ability!==undefined){const a=W.Content.abilities[item.ability];if(a){stats.push(['Cooldown',a.cooldown+'s']);if(a.damage)stats.push(['Power',a.damage]);}}
    return stats;
  };
  U.gearLoadout=function(){
    const p=this.player(),owned=(p.inventory||[]).map(v=>this.item(typeof v==='string'?v:v.id)).filter(Boolean);
    const slots=[['Primary',owned.find(i=>i.weapon===p.weapon)],['Backup',owned.find(i=>i.weapon===p.secondary)],['Blade',owned.find(i=>i.melee===p.melee)],['Armor',p.equipment?.armor&&this.item(p.equipment.armor.id)],['Headwear',p.equipment?.helmet&&this.item(p.equipment.helmet.id)],['Accessory',p.equipment?.accessory&&this.item(p.equipment.accessory.id)]];
    return `<div class="gear-loadout" data-nav-group="gear-loadout" aria-label="Your equipped gear">${slots.map(([label,item])=>item?`<button data-action="gear-loadout-inspect" data-value="${escape(item.id)}" aria-label="Inspect ${label.toLowerCase()}: ${escape(item.name)}">${this.icon(item)}<span><small>${label}</small><strong>${escape(item.name)}</strong></span></button>`:`<div class="empty-slot"><span><small>${label}</small><strong>Empty slot</strong></span></div>`).join('')}</div>`;
  };
  U.gearCard=function(item,shop=false,quantity=1){
    const p=this.player(),slots=this.gearSlots(item),selected=item.id===this.itemId,requirement=shop?this.requirement(item):this.equipRequirement(item),owned=this.owned(item),primary=item.weapon!==undefined?p.weapon===item.weapon:item.ability!==undefined?p.ability===item.ability:this.isEquipped(item),secondary=item.weapon!==undefined?p.secondary===item.weapon:item.ability!==undefined?p.ability2===item.ability:false;
    const price=this.price(item),cores=this.coreCost(item),cost=`${price} gold${cores?' + '+cores+' cores':''}`,insufficient=shop&&(p.gold<price||(p.cores||0)<cores),reason=requirement||(insufficient?(p.gold<price?'Need '+Math.max(0,price-p.gold)+' more gold':'Need '+Math.max(0,cores-(p.cores||0))+' more cores'):'');
    const art=item.ability!==undefined?this.abilityArtwork(W.Content.abilities[item.ability]):this.icon(item),stats=this.gearStats(item).slice(0,3);
    return `<article class="gear-card ${selected?'selected':''} ${slots.length?'in-loadout':''}" style="--rarity:${colors[this.rarity(item)]}" aria-label="${escape(item.name)}"><button class="gear-inspect" data-action="item" data-value="${escape(item.id)}" aria-pressed="${selected}" aria-label="Inspect ${escape(item.name)}"><span class="gear-art">${art}</span><span class="gear-title"><small>${this.rarityName(item)} · Level ${item.level||1}</small><strong>${escape(item.name)}${quantity>1?' ×'+quantity:''}</strong><span>${escape(item.slot==='weapon'?'Firearm':item.slot==='melee'?'Blade':item.slot)}</span></span></button><div class="gear-state ${slots.length?'equipped-state':''}">${slots.length?'✓ '+slots.join(' + '):shop&&owned&&item.slot!=='consumable'?'Owned':shop?'Available at this supply post':requirement?'Requirement not met':'Ready to equip'}</div>${stats.length?`<dl class="gear-card-stats">${stats.map(([name,value])=>`<div><dt>${name}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`:'<p class="gear-utility">'+escape(item.slot==='consumable'?'Add this item to your supplies for use in the field.':item.description||'Resistance field equipment.')+'</p>'}${reason?`<p class="gear-requirement" id="gear-requirement-${escape(item.id)}">${escape(reason)}</p>`:''}<div class="gear-actions">${shop?`<button class="primary" data-action="buy" data-value="${escape(item.id)}" aria-label="Buy ${escape(item.name)} for ${cost}" ${reason?'aria-describedby="gear-requirement-'+escape(item.id)+'"':''} ${reason||owned&&item.slot!=='consumable'?'disabled':''}>${owned&&item.slot!=='consumable'?'✓ Owned':'Buy · '+cost}</button>`:`<button class="${primary?'selected':'primary'}" data-action="equip" data-value="${escape(item.id)}" aria-label="${primary?'Equipped: ':item.slot==='consumable'?'Use ':item.weapon!==undefined||item.ability!==undefined?'Equip primary: ':'Equip '}${escape(item.name)}" ${reason?'aria-describedby="gear-requirement-'+escape(item.id)+'"':''} ${primary||reason?'disabled':''}>${primary?'✓ '+(item.weapon!==undefined||item.ability!==undefined?'Primary equipped':'Equipped'):item.slot==='consumable'?'Use item':item.weapon!==undefined||item.ability!==undefined?'Equip primary':'Equip'}</button>${item.weapon!==undefined||item.ability!==undefined?`<button data-action="${item.weapon!==undefined?'equip-secondary-firearm':'equip-secondary'}" data-value="${escape(item.id)}" aria-label="${secondary?'Equipped: ':'Equip '+(item.weapon!==undefined?'backup firearm: ':'secondary ability: ')}${escape(item.name)}" ${secondary||reason?'disabled':''}>${secondary?'✓ ':''}${item.weapon!==undefined?(secondary?'Backup equipped':'Equip backup'):(secondary?'Secondary equipped':'Equip secondary')}</button>`:''}`}</div></article>`;
  };
  U.inventoryMenu=function(shop){
    const p=this.player();if(!p)return '<p class="empty-state">Begin a campaign to prepare your equipment.</p>';if(this.filter==='ability'&&!shop)return this.abilitiesMenu();
    const source=shop?(this.game.shopInventory?.(this.game.shopLocation)||(W.Content.equipment||[]).filter(item=>!item.rewardOnly&&this.rarity(item)<2).slice(0,8)):(p.inventory||[]).map(v=>this.item(typeof v==='string'?v:v.id)).filter(Boolean),quantities=new Map();
    for(const item of source)quantities.set(item.id,(quantities.get(item.id)||0)+1);
    let items=source.filter((item,index)=>source.findIndex(i=>i.id===item.id)===index);
    if(this.filter!=='all')items=items.filter(it=>this.filter==='weapon'?['weapon','firearm','secondary'].includes(it.slot):it.slot===this.filter);
    const current=items.find(item=>item.id===this.itemId)||items[0];this.itemId=current?.id||null;
    return `<div class="modern-equipment">${this.playerTabs()}<div class="gear-screen-heading"><div><h3>${shop?escape(this.game.shopLocation?.name||'Resistance supply'):'Pack for the next adventure'}</h3><p>${shop?'Compare local stock and buy directly from each card.':'Equip from any card. Select its name for a closer look.'}</p></div><span>${items.length} ${items.length===1?'item':'items'}</span></div>${shop?'':this.gearLoadout()}<nav class="catalog-filter" data-nav-group="gear-categories" aria-label="Equipment categories">${tabs.map(([id,name])=>`<button class="${this.filter===id?'selected':''}" data-action="filter" data-value="${id}" aria-pressed="${this.filter===id}">${name}</button>`).join('')}</nav><div class="inventory-layout modern-inventory-layout"><div class="inventory-grid modern-inventory-grid" data-nav-group="gear-cards">${items.length?items.map(item=>this.gearCard(item,shop,quantities.get(item.id))).join(''):'<p class="empty-state">No gear in this category yet. Explore, complete quests, and recover treasure.</p>'}</div><aside class="item-detail modern-item-detail" aria-label="Selected equipment details">${current?this.modernItemDetail(current,shop):'<p class="empty-state">Your next discovery belongs here.</p>'}</aside></div><p class="small-note">${shop?'Rare gear is earned through adventures. Purchasing leaves your current equipment in place.':'Primary and backup firearms can be swapped in combat. Each hero keeps their own equipment.'}</p></div>`;
  };
  U.modernItemDetail=function(item,shop){
    const stats=this.gearStats(item),weapon=item.weapon!==undefined?W.Content.weapons[item.weapon]:item.melee!==undefined?W.Content.melee[item.melee]:null,requirement=shop?this.requirement(item):this.equipRequirement(item),p=this.player(),entry=p.inventory.find(v=>(typeof v==='string'?v:v.id)===item.id),rank=item.weapon!==undefined?(p.weaponUpgrades?.[item.weapon]||0):typeof entry==='object'?entry.upgrade||0:0;
    return `<div class="gear-detail-art">${item.ability!==undefined?this.abilityArtwork(W.Content.abilities[item.ability]):this.icon(item,true)}</div><div class="rarity" style="color:${colors[this.rarity(item)]}">${this.rarityName(item)} · Level ${item.level||1}</div><h3>${escape(item.name)}${rank?' +'+rank:''}</h3><p>${escape(item.description||'Resistance field equipment. Built for the long road home.')}</p>${weapon?.mechanicName?`<div class="weapon-mechanic"><strong>${escape(weapon.mechanicName)}</strong><p>${escape(weapon.mechanicDescription||'')}</p></div>`:''}${this.comparison(item)}<div class="stats-list">${stats.map(([name,value])=>`<div><span>${name}</span><b>${escape(value)}</b></div>`).join('')}</div>${requirement?`<p class="requirement">${escape(requirement)}</p>`:''}${item.rewardSource?`<p class="reward-source"><strong>Adventure treasure</strong>${escape(item.rewardSource)}</p>`:''}<p class="small-note">${shop?'Use Buy on the item card to purchase.':'Use Equip on the item card to change your loadout.'}</p>`;
  };
  U.defaultControllerFocus=function(controls){
    if(['inventory','shop'].includes(this.menu)&&this.filter!=='ability')return controls.find(c=>c.dataset.action==='item'&&c.dataset.value===this.itemId)||controls.find(c=>c.dataset.action==='item')||originalFocus.call(this,controls);
    return originalFocus.call(this,controls);
  };
  U.click=function(e){
    const b=e.target.closest?.('button[data-action]'),action=b?.dataset.action,value=b?.dataset.value;
    if(!b||b.disabled)return originalClick.call(this,e);
    if(action==='ability-loadout-inspect'){
      this.sound();this.skillsCategory=this.abilityCategory(W.Content.abilities[Number(value)]||{});this.refreshAbilityCard(Number(value));
      if(this.lastNavigation!=='pad')this.host.querySelector?.('.field-ability-card.inspected')?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
      return;
    }
    if(action==='gear-loadout-inspect'){
      this.sound();this.filter='all';this.itemId=value;this.render();const target=this.focusableControls().find(c=>c.dataset.action==='item'&&c.dataset.value===value);if(target)this.setControllerFocus(target,this.activeController||0);return;
    }
    const inventory=['inventory','shop'].includes(this.menu),preserve=inventory&&['equip','equip-secondary-firearm','equip-secondary','buy','item'].includes(action),menu=this.menu,scroll=this.host.querySelector?.('.panel-content'),grid=this.host.querySelector?.('.modern-inventory-grid'),top=scroll?.scrollTop||0,gridTop=grid?.scrollTop||0;
    const cards=preserve?this.focusableControls().filter(c=>c.dataset.action==='item'):[],cardIndex=cards.findIndex(c=>c.dataset.value===value),neighbor=(cards[cardIndex+1]||cards[cardIndex-1])?.dataset.value;
    if(preserve){
      this.itemId=value;
      if(action.startsWith('equip')){const item=this.item(value),reason=item&&this.equipRequirement(item);if(reason){this.toast(reason,'error');return;}}
    }
    const result=originalClick.call(this,e);
    if(preserve&&this.menu===menu&&this.isOpen){
      // When the last supply in a stack is used, keep the player's place in the
      // list by selecting its neighbor instead of jumping back to the first card.
      if(neighbor&&!this.focusableControls().some(c=>c.dataset.action==='item'&&c.dataset.value===value)&&this.focusableControls().some(c=>c.dataset.action==='item'&&c.dataset.value===neighbor)){this.itemId=neighbor;this.render();}
      const newScroll=this.host.querySelector?.('.panel-content'),newGrid=this.host.querySelector?.('.modern-inventory-grid');if(newScroll)newScroll.scrollTop=top;if(newGrid)newGrid.scrollTop=gridTop;
      const controls=this.focusableControls(),target=controls.find(c=>c.dataset.action===action&&c.dataset.value===value)||controls.find(c=>c.dataset.action==='item'&&c.dataset.value===value)||controls.find(c=>c.dataset.action==='item'&&c.dataset.value===this.itemId)||controls.find(c=>c.dataset.action==='item');
      if(target){if(this.lastNavigation==='pad')this.setControllerFocus(target,this.activeController||0);else if(e.detail===0)target.focus?.({preventScroll:true});}
    }
    return result;
  };
}());
