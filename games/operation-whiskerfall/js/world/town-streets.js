(function () {
  'use strict';
  const W=window.OW, C=W.Content, R=W.Renderer.prototype, G=W.Game.prototype, U=W.UI.prototype;
  const plans=C.townStreets, images=new Map(), patterns=new WeakMap(), plaques=new WeakMap();
  const towns=Object.values(plans);
  const asset=key=>(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/fieldwork/'+key+'.webp';
  function image(key){
    if(!images.has(key)){const im=new Image();images.set(key,im);im.src=asset(key);}
    const im=images.get(key);return im?.complete&&im.naturalWidth?im:null;
  }
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  const active=(g,d)=>!d.small&&(g.world.opened?.has('restored_'+d.id)||g.completedQuests?.has(d.quest)||g.reconDossier?.filed.includes(d.report));
  const home=(g,d)=>!!(g.completedQuests?.has(d.quest)||g.reconDossier?.filed.includes(d.report));
  const local=(g,p)=>!g.world.isDungeon&&g.world.safeZoneAt(p.x,p.y);
  function work(g,p){
    const town=local(g,p);if(!town)return null;
    const l=g.world.getLocation('work_'+town.id);return l&&dist(l,p)<55?l:null;
  }
  function silhouette(r,o,key,width,anchor=.92){
    const im=image(key);if(!im)return false;
    const height=width*im.height/im.width,base=o.y+(o.solid?o.h*.25:2);
    const obscured = r.game.players.some(p=>Math.abs(p.x-o.x)<width*.45&&p.y>=base-height*.92&&p.y<base+5);
    const c=r.ctx;c.save();if(obscured)c.globalAlpha*=.36;
    c.drawImage(im,o.x-width/2,base-height*anchor,width,height);c.restore();return true;
  }
  const drawObject=R.drawObject;
  R.drawObject=function(o,w){
    if(!w.isDungeon&&!o.hidden&&!o.destroyed){
      const d=plans[o.townId];
      if(o.townPainting&&d&&silhouette(this,o,o.townPainting,d.small?180:255))return;
      if(o.type==='townAftermath'){if(home(this.game,d))silhouette(this,o,'home-'+d.key,137);return;}
      if(o.type==='townWork'){
        const lit=active(this.game,d),c=this.ctx;
        this.drawSettlementProp({...o,type:'signpost',label:''});
        c.save();c.translate(o.x,o.y-55);c.fillStyle=lit?'#f8d777':'#5c6b61';c.strokeStyle='#483527';c.lineWidth=3;
        c.beginPath();c.moveTo(0,-9);c.lineTo(8,-2);c.lineTo(5,8);c.lineTo(-5,8);c.lineTo(-8,-2);c.closePath();c.fill();c.stroke();
        if(lit){c.fillStyle='#fff0a1';c.beginPath();c.arc(0,0,3+Math.sin(this.clock*3)*.5,0,Math.PI*2);c.fill();}c.restore();return;
      }
    }
    return drawObject.apply(this,arguments);
  };
  const ground=R.drawGroundDetail;
  R.drawGroundDetail=function(detail){
    const d=plans[detail.townId];if(!d)return ground.apply(this,arguments);
    const c=this.ctx,texture=image('street-'+d.index);
    const key=d.id,signature=!!texture;
    let atlas=plaques.get(this);if(!atlas){atlas=new Map();plaques.set(this,atlas);}
    let tile=atlas.get(key);
    if(!tile||tile.ready!==signature){
      const canvas=document.createElement('canvas'),width=detail.w+60,height=detail.h+50;
      canvas.width=width;canvas.height=height;
      const p=canvas.getContext('2d');p.translate(width/2,height/2);p.lineCap='round';p.lineJoin='round';
      let mat=d.tint;
      if(texture){if(!patterns.has(texture))patterns.set(texture,p.createPattern(texture,'repeat'));mat=patterns.get(texture);}
      p.save();p.globalAlpha=.73;p.fillStyle=mat;p.beginPath();p.roundRect(-detail.w*.46,-detail.h*.43,detail.w*.92,detail.h*.89,74);p.fill();p.restore();
      const lane=(points,size,color)=>{p.strokeStyle=color;p.lineWidth=size;p.beginPath();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.stroke();};
      const paths=C.townLanes[d.layout],scale=d.small?.72:1;
      p.scale(scale,scale);
      for(const pts of paths){lane(pts,d.small?70:90,'#5d624e');lane(pts,d.small?62:82,mat);}
      p.globalAlpha=.72;p.fillStyle=mat;p.beginPath();p.ellipse(0,5,d.small?75:111,d.small?47:67,0,0,Math.PI*2);p.fill();
      if(['rails','bridge','stilts','switchback'].includes(d.layout)){
        p.globalAlpha=.75;
        for(const path of paths)for(const off of [-33,33])lane(path.map(([x,y])=>[x,y+off]),3,d.layout==='rails'?'#4a4b4b':'#c8ad7b');
      }else if(d.layout==='circle'||d.layout==='crescents'){
        p.strokeStyle='#e2c797';p.lineWidth=4;p.beginPath();p.ellipse(0,4,87,48,0,0,Math.PI*2);p.stroke();
      }
      tile={canvas,ready:signature};atlas.set(key,tile);
    }
    c.drawImage(tile.canvas,detail.x-tile.canvas.width/2,detail.y-tile.canvas.height/2);
  };
  const townTerrain=R.drawTerrain;
  R.drawTerrain=function(w){
    const result=townTerrain.apply(this,arguments);
    if(w.isDungeon||!this.view)return result;
    const c=this.ctx,v=this.view;
    // Paint the harbor above the crossing road, with the deck at the actual traversable gap.
    for(const s of w.streetWater||[]){
      const x=s.tx+s.x,y=s.ty+s.y;if(x+s.rx<v.x||y+s.ry<v.y||x-s.rx>v.x+v.w||y-s.ry>v.y+v.h)continue;
      c.save();c.translate(x,y);c.fillStyle='#8d816a';c.beginPath();c.ellipse(0,0,s.rx+7,s.ry+7,0,0,Math.PI*2);c.fill();
      c.beginPath();c.ellipse(0,0,s.rx,s.ry,0,0,Math.PI*2);c.clip();
      const water=c.createLinearGradient(0,-s.ry,0,s.ry);water.addColorStop(0,'#294e59');water.addColorStop(.6,s.key==='boughhall'?'#385757':'#417b84');water.addColorStop(1,'#72a291');c.fillStyle=water;c.fillRect(-s.rx,-s.ry,s.rx*2,s.ry*2);
      c.strokeStyle='#bed4bc80';c.lineWidth=1.4;
      for(let i=0;i<18;i++){const xx=-s.rx+((i*47+this.clock*6)%(s.rx*2)),yy=-s.ry+((i*17)%(s.ry*2));c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+6,yy+2,xx+14,yy);c.stroke();}
      c.restore();c.save();const left=s.tx+s.deck-s.width/2,top=y-s.ry-9;c.fillStyle='#56483f';c.fillRect(left-2,top,s.width+4,2*s.ry+18);
      for(let i=0;i<2*s.ry+18;i+=8){c.fillStyle=i%16?'#b48e65':'#bc9c75';c.fillRect(left,top+i,s.width,7);}
      c.fillStyle='#604b36';for(const j of [0,s.width-5])for(const k of [5,s.ry,2*s.ry+5])c.fillRect(left+j,top+k-6,5,10);c.restore();
    }
    return result;
  };
  const labels=R.drawLocationLabels;
  R.drawLocationLabels=function(w){
    const result=labels.apply(this,arguments);if(w.isDungeon)return result;
    const seen=new Set();
    for(const p of this.game.players){
      const t=local(this.game,p);if(!t||seen.has(t.id))continue;seen.add(t.id);
      const d=plans[t.id],l=w.getLocation('work_'+t.id);
      if(l&&dist(l,p)<135)this.worldLabel(active(this.game,d)?d.lane:d.action,l.x,l.y+24,'#fff0b8',13);
    }
    return result;
  };
  function arrival(g,t){
    if(!t||g.ui.isOpen||!plans[t.id])return;
    const d=plans[t.id],el=document.createElement('div');el.className='town-arrival';
    const im=document.createElement('img');im.alt='';im.src=asset(d.small?d.key:'arrival-'+d.key);el.append(im);
    const info=document.createElement('div');for(const [tag,value] of [['small',g.world.regions[t.region]?.name||'Resistance network'],['strong',t.name],['span',d.landmark]]){const n=document.createElement(tag);n.textContent=value;info.append(n);}
    el.append(info);document.querySelector('.town-arrival')?.remove();document.body.append(el);
    setTimeout(()=>el.remove(),3600);
    const a=g.audio;
    if(a?.ready&&a.enabled&&a.context.state==='running'&&a.volumes.sfx>0){
      const base=[330,494,220,370,294,185,392,247,311,440,262,294][d.index];
      a._tone(base,.28,.07,'sine',undefined,0,a.sfxBus);
      a._tone(base*1.5,.34,.055,'sine',a.context.currentTime+.16,0,a.sfxBus);
    }
  }
  const update=G.updateMissions;
  G.updateMissions=function(dt){
    const result=update.apply(this,arguments);if(this.world.isDungeon||!this.players.length)return result;
    const p=this.players[0],t=local(this,p);
    if(this.lastStreetTown!==t?.id){this.lastStreetTown=t?.id;if(t)arrival(this,t);}
    for(const [i,hero] of this.players.entries()){if(hero.downed)continue;const l=work(this,hero);if(l){const d=plans[l.townId];this.interactionPrompt=(this.input.actionLabel?.(i,'interact')||'Interact')+' · '+(active(this,d)?'Read town notices':d.action);break;}}
    return result;
  };
  const interact=G.interact;
  G.interact=function(p){
    const l=!this.paused&&!p.downed&&work(this,p);
    if(!l||this.players.some(q=>q!==p&&q.downed&&dist(q,p)<110))return interact.apply(this,arguments);
    const d=plans[l.townId];if(!active(this,d)){this.world.opened.add('restored_'+d.id);this.save(false);this.audio.play('quest');this.ui.toast(d.first,'quest');}
    this.ui.streetTown=l.townId;this.ui.showMenu('townGuide',p.id);return true;
  };
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,id,label)=>'<button data-action="'+action+'" data-value="'+escape(id)+'">'+escape(label)+'</button>';
  U.townGuideMenu=function(){
    const g=this.game,t=g.world.getLocation(this.streetTown),d=plans[t?.id];if(!d)return '';
    const points=g.world.locations.filter(l=>l.townId===t.id&&['forge','npc','townWork','cityTram'].includes(l.type)&&dist(l,t)<550);
    const venue=W.TownActivities?.venues.find(v=>'town_'+v.town===t.id);
    if(venue){const l=g.world.getLocation('activity_'+venue.id);if(l)points.unshift(l);}
    if(t.id==='town_9'){const l=g.world.getLocation('tavern_copper_minnow');if(l)points.unshift(l);}
    points.push(t);
    return '<article class="street-guide"><img src="'+asset(d.small?d.key:'arrival-'+d.key)+'" alt=""><section><small>'+escape(d.lane)+'</small><h3>'+escape(t.name)+'</h3><p>'+escape(d.small?t.description:home(g,d)?d.second:active(g,d)?d.first:d.clue)+'</p><div class="street-pins">'+points.map(l=>button('street-pin',l.id,l.id===t.id?'Checkpoint and quartermaster':'Pin '+l.name)).join('')+'</div></section></article>';
  };
  const coachStops=()=>[...(W.TownActivities?.venues||[]),{id:'copper_minnow',town:9,name:'The Copper Minnow',place:'the Copper Minnow',host:'Poker, darts & conversation',time:'3 tables',tavern:true}];
  U.venueRoutesMenu=function(){
    const g=this.game,partyReady=!g.world.isDungeon&&g.players.every(p=>!p.downed&&local(g,p));
    return '<div class="venue-routes">'+coachStops().map(v=>{
      const t=(g.overworld||g.world).getLocation('town_'+v.town);
      const art=v.tavern?'tavern/taproom':'activities/'+v.id,stop=v.tavern?'tavern_copper_minnow':'activity_'+v.id;
      return '<article><img alt="" src="'+(W.config.assetBaseURL||'assets')+'/'+art+'.webp"><div><small>'+escape(t?.name)+'</small><h3>'+escape(v.name)+'</h3><p>'+escape(v.time)+' · '+escape(v.host)+'</p>'+button(partyReady?'street-coach':'street-pin',partyReady?v.id:stop,partyReady?'Ride to '+v.place:'Pin venue on map')+'</div></article>';
    }).join('')+'</div>';
  };
  const inventoryMenu=U.inventoryMenu;
  U.inventoryMenu=function(shop){const content=inventoryMenu.apply(this,arguments);const t=this.game.shopLocation;
    return shop&&plans[t?.id]?button('street-guide',t.id,t.name+' · local guide')+content:content;
  };
  const pause=U.pauseMenu;
  U.pauseMenu=function(){return pause.apply(this,arguments)+'<div class="street-camp-link">'+button('menu','venueRoutes','Town activities & coach routes')+'</div>';};
  const click=U.click;
  U.click=function(e){
    const b=e.target.closest?.('button[data-action]'),action=b?.dataset.action;
    if(!action?.startsWith('street-'))return click.apply(this,arguments);
    const g=this.game,w=g.world,id=b.dataset.value;
    if(action==='street-guide'){this.streetTown=id;this.showMenu('townGuide',this.playerIndex);return;}
    if(action==='street-pin'){
      if(w.isDungeon){this.toast('Return outside to place a town waypoint.');return;}
      const l=w.getLocation(id);if(!l)return;g.setMarker(l.x,l.y);this.hideMenu();this.toast('Waypoint · '+l.name);return;
    }
    const venue=coachStops().find(v=>v.id===id);
    if(!venue||w.isDungeon||!g.players.every(p=>!p.downed&&local(g,p)))return;
    if(Object.values(g.missionRuns||{}).some(r=>r.type==='escort'&&r.state==='active')){this.toast('Finish the active escort before boarding the coach.');return;}
    const dest='town_'+venue.town,l=w.getLocation(venue.tavern?'tavern_copper_minnow':'activity_'+id);if(!l)return;
    g.venueCoachDestination=dest;
    try {if(!g.fastTravel(dest))return;}finally{delete g.venueCoachDestination;}
    for(const [i,p] of g.players.entries()){
      p.x=l.x+(i?28:-16);p.y=l.y+8;g.restorePlayerPosition(p);
    }
    g.camera.x=l.x;g.camera.y=l.y;g.setMarker(l.x,l.y);g.travelInteractUntil=g.time+.35;g.input.clear?.();g.save(false);
    this.toast(venue.place+' · Interact at the painted sign.','quest');
  };
  W.TownStreets={active,home,work,asset,image,towns};
}());
