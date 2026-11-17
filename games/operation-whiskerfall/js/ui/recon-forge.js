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
function station(ui,tab,active,pending){
    const icon='assets/recon/station-'+tab.toLowerCase()+'.webp';
    return '<button data-action="rf-tab" data-value="'+tab+'" aria-pressed="'+active+'" class="'+(active?'selected':'')+'" '+(pending?'disabled':'')+'><img src="'+escape(W.HeroArmorArt?.assetURL(icon)||icon)+'" width="40" height="40" alt="">'+tab+'</button>';
  }
  function status(q){
    if(q.gate==='Equipped'||q.gate==='Installed')return q.gate;
    if(q.owned)return 'Owned';
    if(q.reason)return q.reason.startsWith('More supplies')?'Need supplies':'Locked';
    return '';
  }
  function itemArt(ui,p,q,large){
    if(q.item){
      const art=ui.icon(q.item,large);
      return q.item.reconArt==null&&W.clipGearPreview?W.clipGearPreview(art):art;
    }
    return ui.forgePortrait(p,q.id.startsWith('outfit.')?Number(q.id.slice(-1)):p.armorSet||0,q.name);
  }
  function comparison(q){
    return '<dl class="rf-comparison"><div><dt>Now</dt><dd>'+escape(q.before)+'</dd></div><div><dt>After</dt><dd>'+escape(q.after)+'</dd></div></dl>';
  }
  U.forgeMenu=function(){
    const p=this.player();
    if(!p)return '<p>Visit a resistance forge to work on your loadout.</p>';
    const v=view(p),g=this.game,tab=v.tab;
    const records=F.choices(g,p,tab).map(key=>F.quote(g,this.playerIndex,tab,key));
    const q=records.find(r=>r.id===v.recipe[tab])||records[0];
    v.recipe[tab]=q.id;
    const pending=v.pending,inspect=v.inspect===q.id&&!pending,craft=tab==='Craft';
    const verb=craft?(q.owned?'Equip':'Craft'):tab==='Tune'?'Install':'Upgrade';
    const art=itemArt(this,p,q,true),hero=p.skin%2?'Ash':'Clover';
    const stationBar='<header class="rf-workshop"><nav aria-label="Forge stations" class="rf-tabs" data-nav-group="forge-stations">'+tabs.map(t=>station(this,t,tab===t,!!pending)).join('')+'</nav><div class="rf-hero" aria-label="Acting hero">'+g.players.map((h,i)=>g.players.length===1?'<b>'+hero+'</b>':'<button class="'+(i===this.playerIndex?'selected':'')+'" data-action="player" data-value="'+i+'" aria-pressed="'+(i===this.playerIndex)+'" '+(pending?'disabled':'')+'>'+escape(h.skin%2?'Ash':'Clover')+' · P'+(i+1)+'</button>').join('')+'</div></header>';
    const cards=records.map(r=>{
      const state=status(r);
      return '<button class="rf-recipe '+(q===r?'selected':'')+'" aria-pressed="'+(q===r)+'" aria-label="'+escape(r.name+(state?' · '+state:''))+'" data-action="rf-select" data-value="'+escape(r.id)+'"><span class="rf-thumbnail">'+itemArt(this,p,r,false)+'</span><b>'+escape(r.name)+'</b>'+(state?'<small>'+state+'</small>':'')+'</button>';
    }).join('');
    const costs=Object.values(q.cost).some(n=>n>0)?'<div class="rf-cost"><span>Cost / held</span>'+price(p,q.cost)+'</div>':'';
    const caption=q.item?.reconSuit?q.item.role+' suit':q.item?.reconFamily||q.item?.slot||'Outfit';
    const heading='<header class="rf-caption"><small>'+escape(caption)+'</small><h3>'+escape(q.name)+'</h3></header>';
    let details;
    if(pending){
      details='<section class="rf-confirm" role="group" aria-label="Confirm forge work"><h3>'+escape(verb+' '+q.name)+'?</h3><p>'+escape(hero)+'</p>'+comparison(q)+costs+'<div class="rf-controls">'+(craft&&!q.owned?control('commit','equip','Craft & equip','class="primary"')+control('commit','store','Store in pack'):control('commit','equip','Confirm '+verb.toLowerCase(),'class="primary"'))+control('cancel',q.id,'Back')+'</div></section>';
    }else{
      const preview=inspect?'<div class="rf-inspection">'+comparison(q)+'<p>'+escape(q.description)+'</p><p class="rf-source">'+escape(q.source)+'</p></div>':'<div class="rf-art">'+art+'</div><p class="rf-effect">'+escape(q.description)+'</p>';
      const unavailable=q.gate==='Equipped'||q.gate==='Installed'?q.gate:q.reason;
      details='<article class="rf-selected">'+heading+preview+costs+(unavailable?'<p class="rf-status" role="status">'+escape(unavailable)+'</p>':'')+'<div class="rf-controls">'+control('review',q.id,verb,'class="primary" '+(q.reason?'disabled':''))+control('inspect',q.id,inspect?'Close details':'Compare','aria-expanded="'+inspect+'"')+'</div></article>';
    }
    return '<section class="recon-forge">'+stationBar+'<div class="rf-layout '+(records.length<7?'rf-short':'')+'"><div class="rf-recipes" data-nav-group="forge-recipes" '+(pending?'inert':'')+'>'+cards+'</div>'+details+'</div></section>';
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
    if(action==='rf-tab'&&tabs.includes(id)){v.tab=id;v.inspect=null;v.message='';repaint(this,v,'tab',id);}
    else if(action==='rf-select'){v.recipe[tab]=id;v.inspect=null;v.message='';repaint(this,v,'select',id);}
    else if(action==='rf-inspect'&&id===key){v.inspect=v.inspect===id?null:id;repaint(this,v,'inspect',id);}
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
      if(v.inspect&&!v.pending&&action==='back'){v.inspect=null;repaint(this,v,'inspect',v.recipe[v.tab]);return;}
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
