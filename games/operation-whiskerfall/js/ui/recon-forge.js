(function () {
  'use strict';
  const W=window.OW,U=W.UI.prototype,F=W.ReconGear;
  const tabs=['Upgrade','Tune','Craft'];
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const views=new WeakMap();
  function view(p){
    if(!views.has(p))views.set(p,{tab:'Upgrade',recipe:{},scroll:{},pending:null,message:''});
    return views.get(p);
  }
  const fields=[['gold','Gold'],['materials','Scrap'],['cores','Cores']];
  function price(p,cost){
    return '<dl class="rf-price">'+fields.map(([id,label])=>{
      const path='assets/recon/resource-'+id+'.webp',url=W.HeroArmorArt?.assetURL(path)||path;
      return '<div class="'+((p[id]||0)<cost[id]?'short':'')+'"><dt><img alt="" width="21" height="21" src="'+escape(url)+'">'+label+'</dt><dd>'+cost[id]+' <small>/ '+Math.floor(p[id]||0)+' held</small></dd></div>';
    }).join('')+'</dl>';
  }
  const control=(cmd,id,label,options='')=>'<button data-action="rf-'+cmd+'" data-value="'+escape(id)+'" '+options+'>'+escape(label)+'</button>';
  function focus(ui,action,value){
    const button=ui.focusableControls().find(b=>b.dataset.action==='rf-'+action&&(value==null||b.dataset.value===value));
    if(button)ui.setControllerFocus(button,ui.activeController||0);
  }
  function repaint(ui,v,action,id){
    ui.render();
    const list=ui.host.querySelector('.rf-recipes');
    if(list)list.scrollTop=v.scroll[v.tab]||0;
    if(action)focus(ui,action,id);
  }
  U.forgeMenu=function(){
    const p=this.player();
    if(!p)return '<p>Visit a resistance forge to work on your loadout.</p>';
    const v=view(p),tab=v.tab,g=this.game;
    const records=F.choices(g,p,tab).map(key=>F.quote(g,this.playerIndex,tab,key));
    const q=records.find(r=>r.id===v.recipe[tab])||records[0];
    v.recipe[tab]=q.id;
    const pending=v.pending,art=q.item?this.icon(q.item,true):this.forgePortrait(p,p.armorSet||0,q.name);
    const state=q.gate==='Equipped'?'Equipped':q.gate==='Installed'?'Installed':q.owned?'Owned':q.reason?'Locked':'Available';
    const craft=tab==='Craft',verb=craft?(q.owned?'Equip':'Craft'):tab==='Tune'?'Install tuning':'Reinforce';
    const review=control('review',q.id,verb+'…','class="primary" '+(q.reason?'disabled':''));
    const cost=price(p,q.cost);
    const list=records.map(r=>'<button class="rf-recipe '+(q===r?'selected':'')+'" aria-pressed="'+(q===r)+'" data-action="rf-select" data-value="'+escape(r.id)+'"><b>'+escape(r.name)+'</b><small>'+escape(r.gate==='Equipped'||r.gate==='Installed'?r.gate:r.owned?'Owned':r.reason?'Locked':tab==='Craft'?r.item?.role||r.item?.reconFamily||'Pattern':'Ready')+'</small></button>').join('');
    const hero=(p.skin%2?'Ash':'Clover')+' · Player '+(this.playerIndex+1);
    const detail=pending?
      '<section class="rf-confirm" role="group" aria-label="Confirm forge work"><h3>'+escape(verb+' '+q.name)+'?</h3><p>'+escape(hero)+' · '+escape(q.after)+'</p>'+cost+'<div class="rf-controls">'+(craft&&!q.owned?control('commit','store','Craft and store','class="primary"')+control('commit','equip','Craft and equip'):control('commit','equip','Confirm '+verb.toLowerCase(),'class="primary"'))+control('cancel',q.id,'Back')+'</div></section>':
      '<aside class="rf-compare"><h4>Loadout comparison</h4><dl><dt>Current</dt><dd>'+escape(q.before)+'</dd><dt>Proposed</dt><dd>'+escape(q.after)+'</dd></dl><h4>Bench cost</h4>'+cost+'<p class="rf-status" role="status">'+escape(q.reason||v.message||'Ready at the bench.')+'</p><div class="rf-controls">'+review+'</div></aside>';
    return this.playerTabs()+'<section class="recon-forge"><header class="rf-scene"><div><small>Resistance workshop</small><h3>Quartermaster’s forge</h3><p>'+escape(hero)+' · '+(g.reconEvidenceCount?.()||0)+' confirmed leads</p></div></header><nav aria-label="Forge stations" class="rf-tabs" data-nav-group="forge-stations">'+tabs.map(t=>control('tab',t,t,'class="'+(tab===t?'selected':'')+'" aria-pressed="'+(tab===t)+'" '+(pending?'disabled':''))).join('')+'</nav><div class="rf-layout"><div class="rf-recipes" data-nav-group="forge-recipes" '+(pending?'inert':'')+'>'+list+'</div><article class="rf-item"><div class="rf-art">'+art+'</div><small>'+escape(state)+' · '+escape(q.source)+'</small><h3>'+escape(q.name)+'</h3><p>'+escape(q.description)+'</p></article>'+detail+'</div></section>';
  };
  const click=U.click;
  U.click=function(event){
    const b=event.target?.closest?.('button[data-action]'),action=b?.dataset.action,id=b?.dataset.value;
    if(this.menu!=='forge'||!b||!action?.startsWith('rf-'))return click.call(this,event);
    if(b.disabled||!this.host.contains(b))return;
    const p=this.player(),v=view(p),tab=v.tab,key=v.recipe[tab];
    v.scroll[tab]=this.host.querySelector('.rf-recipes')?.scrollTop||0;
    if(v.pending&&!['rf-commit','rf-cancel'].includes(action))return;
    this.sound();
    if(action==='rf-tab'&&tabs.includes(id)){v.tab=id;v.message='';repaint(this,v,'tab',id);}
    else if(action==='rf-select'){v.recipe[tab]=id;v.message='';repaint(this,v,'select',id);}
    else if(action==='rf-review'&&id===key){
      const q=F.quote(this.game,this.playerIndex,tab,id);
      if(!q||q.reason)return;
      v.pending=q;repaint(this,v,'cancel',id);
    }else if(action==='rf-cancel'){v.pending=null;repaint(this,v,'review',key);}
    else if(action==='rf-commit'&&v.pending){
      const offer=v.pending;v.pending=null;
      const ok=F.commit(this.game,offer,id==='equip');
      v.message=ok?(tab==='Craft'&&id==='store'?'Stored in '+(p.skin%2?'Ash':'Clover')+'’s pack.':'Bench work complete.'):'Supplies or save status changed. Review this recipe again.';
      this.toast(v.message,ok?'loot':'error');repaint(this,v,'select',key);
    }
  };
  const hide=U.hideMenu;
  U.hideMenu=function(){if(this.menu==='forge'&&this.player())view(this.player()).pending=null;return hide.apply(this,arguments);};
  const show=U.showMenu;
  U.showMenu=function(name,owner){
    if(this.menu==='forge'&&this.player())view(this.player()).pending=null;
    return show.apply(this,arguments);
  };
  const pad=U.handlePad;
  U.handlePad=function(action,owner=0){
    if(this.menu==='forge'){
      // A different controller starts with its own selection. Its confirm
      // edge can never accept the other hero's open quote.
      if(this.game.players[owner]&&this.playerIndex!==owner){
        view(this.player()).pending=null;this.playerIndex=owner;this.activeController=owner;this.render();
        if(action==='confirm')return;
      }
      const v=view(this.player());
      if(v.pending&&action==='back'){v.pending=null;repaint(this,v,'review',v.recipe[v.tab]);return;}
      if(v.pending&&['next','previous'].includes(action))return;
    }
    return pad.call(this,action,owner);
  };
  const controllerTabs=U.controllerTabs;
  U.controllerTabs=function(){return this.menu==='forge'?[...this.host.querySelectorAll('.rf-tabs button:not([disabled])')]:controllerTabs.apply(this,arguments);};
  const focusables=U.focusableControls,defaultFocus=U.defaultControllerFocus;
  U.focusableControls=function(){
    const controls=focusables.apply(this,arguments);
    return this.menu==='forge'&&this.player()&&view(this.player()).pending?
      controls.filter(b=>['rf-commit','rf-cancel'].includes(b.dataset.action)):controls;
  };
  U.defaultControllerFocus=function(controls){
    if(this.menu==='forge'){
      const target=controls.find(b=>b.dataset.action==='rf-cancel')||controls.find(b=>b.dataset.action==='rf-select'&&b.getAttribute('aria-pressed')==='true');
      if(target)return target;
    }
    return defaultFocus.apply(this,arguments);
  };
  const wardrobe=U.armorWardrobeItems;
  if(wardrobe)U.armorWardrobeItems=function(){
    const existing=wardrobe.call(this),seen=new Set(existing.map(i=>i.id));
    return existing.concat(W.Content.reconGear.patterns.filter(i=>i.reconSuit&&!seen.has(i.id)));
  };
  const source=U.armorWardrobeSource;
  if(source)U.armorWardrobeSource=function(item){return item.reconSuit?{kind:'forge',label:'Resistance forge',detail:item.rewardSource+' · '+fields.map(([k,l])=>item.cost[k]+' '+l.toLowerCase()).join(', ')}:source.apply(this,arguments);};
  const hud=U.mechanicStatus;
  if(hud)U.mechanicStatus=function(p,spec){
    if(!spec.reconFamily)return hud.apply(this,arguments);
    const gun=this.game.weapon(p),ready=p.overheat>0?'VENTING':gun.chargeTime?'Charge '+Math.round((p.charge||0)/gun.chargeTime*100)+'%':gun.heatPerShot?'Heat '+Math.round((p.heat||0)*100)+'%':gun.burstCount?gun.burstCount+'-shot burst':gun.guardBreak?'Guard-breaking slug':'Stagger volley';
    return '<div class="rf-hud" title="'+escape(F.describe(gun)+' · '+gun.mechanicDescription)+'">'+escape(ready)+' · '+gun.range+' range · '+Number(gun.fireRate.toFixed(1))+'/s · '+Number(gun.reload.toFixed(1))+'s reload</div>';
  };
}());
