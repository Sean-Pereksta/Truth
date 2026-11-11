(function(){
  'use strict';
  const W=window.OW,U=W.UI?.prototype;if(!U?.forgeMenu)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  U.heroArmorForge=function(){
    const p=this.player();if(!p)return '';
    return '<section class="hero-armor-forge"><div class="section-label">Signature armor · choose a fighting style</div><p>Craft each pattern once for this hero. Each suit changes your appearance and your tactics. Your ordinary outfit and reinforcement ranks still apply.</p><div class="armor-sets" data-nav-group="hero-armor-patterns">'+W.Content.heroArmorPatterns.map(pattern=>{
      const s=this.game.heroArmorStatus(this.playerIndex,pattern.id),item=W.Content.equipment.find(item=>item.id===pattern.id),art=W.HeroArmorArt?.markup(item,{className:'hero-armor-forge-art',variant:'card',skin:p.skin})||this.icon(item,true),cost=pattern.cost;
      return '<article class="skill-card armor-set" style="border-color:'+pattern.color+'">'+art+'<div class="rarity">'+(s.equipped?'EQUIPPED':s.owned?'CRAFTED':s.bosses<pattern.commanders?'PATTERN LOCKED':'RARE FORGE PATTERN')+'</div><h3>'+escape(pattern.name)+'</h3><strong>'+escape(pattern.playstyle)+'</strong><p>'+escape(pattern.benefit)+'</p><p class="small-note"><strong>Tradeoff:</strong> '+escape(pattern.tradeoff)+'</p><p class="forge-cost">'+Math.round(pattern.armor*100)+'% armor · +'+pattern.health+' health</p>'+(!s.owned?'<p class="forge-cost">'+pattern.commanders+' commanders · '+cost.cores+' rare cores · '+cost.materials+' scrap · '+cost.gold+' gold</p>':'')+(s.reason&&!s.owned?'<p class="requirement">'+escape(s.reason)+'</p>':'')+'<button class="primary" data-action="'+(s.owned?'hero-armor-equip':'hero-armor-craft')+'" data-value="'+pattern.id+'" '+(s.equipped||!s.available?'disabled':'')+'>'+(s.equipped?'Currently equipped':s.owned?'Equip this armor':'Craft & equip')+'</button>'+(s.owned?'<button data-action="hero-armor-inspect" data-value="'+pattern.id+'">View in inventory</button>':'')+'</article>';
    }).join('')+'</div></section>';
  };
  const forge=U.forgeMenu;U.forgeMenu=function(){const base=forge.call(this),marker='<p class="forge-intro">';return base.includes(marker)?base.replace(marker,this.heroArmorForge()+marker):base+this.heroArmorForge();};
  const click=U.click;U.click=function(event){
    const button=event.target?.closest?.('button[data-action]'),action=button?.dataset?.action,id=button?.dataset?.value;
    if(!['hero-armor-craft','hero-armor-equip','hero-armor-inspect'].includes(action)||button.disabled)return click.call(this,event);
    this.sound();
    if(action==='hero-armor-inspect'){this.menu='inventory';this.filter='armor';this.itemId=id;this.render();const target=this.focusableControls().find(control=>control.dataset.action==='item'&&control.dataset.value===id);if(target)this.setControllerFocus(target,this.activeController||0);return;}
    const scroll=this.host.querySelector?.('.panel-content')?.scrollTop||0;
    if(action==='hero-armor-craft')this.game.craftHeroArmor(this.playerIndex,id);else this.game.equip(this.playerIndex,id);
    this.render();const panel=this.host.querySelector?.('.panel-content');if(panel)panel.scrollTop=scroll;
    const controls=this.focusableControls(),target=controls.find(control=>control.dataset.value===id&&['hero-armor-craft','hero-armor-equip'].includes(control.dataset.action))||controls.find(control=>control.dataset.value===id&&control.dataset.action==='hero-armor-inspect');
    if(target){if(this.lastNavigation==='pad')this.setControllerFocus(target,this.activeController||0);else target.focus?.({preventScroll:true});}
  };
})();
