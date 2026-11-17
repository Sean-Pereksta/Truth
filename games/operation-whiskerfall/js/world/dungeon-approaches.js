(function () {
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype;
  const biomeArt=['burrow','moss','quarry','glacier','dune','delta','furnace','bastion','quarry','delta'];
  const details={
    archive:{dx:-210,dy:125,kind:'gauge',title:'Ferryman’s tide gauge',act:'Read the low-water notch',hint:'Watch the ripples on the ferry gauge. At low water you can prime the archive pump.',reward:'The pump is primed. The lower ledger intake will be dry on entry.',tint:'#8dd6c5'},
    spire:{dx:200,dy:150,kind:'vane',title:'Leeward mooring',act:'Secure the lee cable',hint:'The cable snaps tight in a gust. Clip it to the mooring during a lull.',reward:'Lee cable secured. Inside the spire, the crosswind pushes both heroes less than half as far.',tint:'#bed9e7'},
    court:{dx:-200,dy:175,kind:'lantern',title:'Lamplighter’s decoy',act:'Set the guide lantern',hint:'Follow the low fireflies to the spare courier lantern. Light it to draw a guard off the signet press.',reward:'A lantern now shines on the false trail. One guard has left the press.',tint:'#e7bbff'},
    depot:{dx:235,dy:150,kind:'switch',title:'Freight brake siding',act:'Break the brake lock',hint:'A two-cat patrol guards the yard brake. Release its lock and clear the patrol to slow the freight cart.',reward:'The shunting brake is engaged. The archive cart takes twice as long to cross the depot.',tint:'#f0b174',guards:['rivet_guard','signal_sergeant']},
    cistern:{dx:-208,dy:150,kind:'lens',title:'Sun survey tripod',act:'Catch the reflection',hint:'A mirror sweeps light over the survey tripod. Align the lens when the reflection reaches the brass notch.',reward:'The solar bearing is set. One turn of the heliostat will open the projected seal.',tint:'#f9dc86'},
    vault:{dx:-170,dy:210,kind:'radio',title:'Abandoned signal wagon',act:'Lift the radio handset',hint:'Calling the abandoned wagon draws a two-cat response. Clear it to recover a dressing for each hero before Berlin.',reward:'One field dressing recovered per hero. The western document lift carries the relay code.',tint:'#bcd8ce',guards:['hookclaw_skirmisher','glasswind_sharpshot']}
  };
  const kinds={
    echo:'The scratched notes show a four-part call. Read the order on the mural before striking the seals.',
    mirrors:'The old beacon keeper chalked arrows around the entrance. Follow the light from mirror to mirror inside.',
    conduit:'A broken copper pipe lies by the trail. Turn each pipe until its openings join the next one.',
    constellation:'The surveyor marked a ring of stars. Inside, each switch changes its neighboring stars too.'
  };
  const records=new WeakMap();
  const aprons=new WeakMap();
  const key=s=>'survey_'+s.id, living=p=>p&&p.hp>0&&!p.downed&&!p.dead,range=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function spotted(w,site,dx,dy,keepClear=false) {
    const theta=Math.atan2(dy,dx),radius=Math.hypot(dx,dy);
    for(const length of [radius,radius+70,170,345,425])for(let n=0;n<16;n++){
      const angle=theta+Math.ceil(n/2)*(n%2?1:-1)*Math.PI/8;
      const p={x:site.x+length*Math.cos(angle),y:site.y+length*Math.sin(angle)};
      if(keepClear&&w.locations.some(l=>l!==site&&range(l,p)<(l.type==='town'?245:l.type==='forge'?180:142)))continue;
      if(!w.isBlocked(p.x,p.y,21)&&!w.gateAt(p.x,p.y,22)&&w._navigationRay(site.x,site.y,p.x,p.y,18))return p;
    }
    return null;
  }
  function sites(w){
    if(!w||w.isDungeon||!Array.isArray(w.locations)||typeof w._navigationRay!=='function')return [];
    if(records.has(w))return records.get(w);
    const all=[];
    for(const l of w.locations.filter(l=>l.type==='cave')){
      const config=W.Content.dungeons.find(s=>s.id===l.id);if(!config)continue;
      const id=l.id,art=id.replace('recon_',''),custom=details[art],keyed=W.Content.distantVaults?.find(s=>s.id===id);
      const title=custom?.title||(config.encounter==='survival'?'Veteran’s watch cairn':keyed?'Last expedition camp':'Worn trail carving');
      const hint=custom?.hint||keyed?.instruction||(config.encounter==='survival'?'Boot tracks circle the old watchpost. Wake the altar inside when both heroes are ready for the next wave.':kinds[config.puzzle])||'An expedition marked this entrance. Inspect the inscription before crossing the chamber.';
      let pad;
      all.push({id,loc:l,config,custom,art:custom?art:biomeArt[l.region]||'bastion',title,hint,
        get pad(){if(pad===undefined)pad=spotted(w,l,custom?.dx??(l.region%2?180:-180),custom?.dy??125,true);return pad;}
      });
    }
    records.set(w,all);return all;
  }
  function station(g,p){return sites(g.world).find(s=>range(p,s.loc)<495&&range(p,s.loc)>133&&s.pad&&range(p,s.pad)<62);}
  function onCamera(r,p,margin){
    const v=r.view;if(!v)return false;
    return p.x>=v.x-margin&&p.x<=v.x+v.w+margin&&p.y>=v.y-margin&&p.y<=v.y+v.h+margin;
  }
  function paintApron(r,key,center){
    const art=W.ReconArt?.approachGround?.(key);if(!art)return;
    let canvas=aprons.get(art);
    if(!canvas){
      canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;const c=canvas.getContext('2d');
      c.drawImage(art,0,0,384,384);c.globalCompositeOperation='destination-in';
      const fade=c.createRadialGradient(192,192,58,192,192,192);
      fade.addColorStop(0,'rgba(255,255,255,.93)');fade.addColorStop(.52,'rgba(255,255,255,.79)');fade.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=fade;c.fillRect(0,0,384,384);aprons.set(art,canvas);
    }
    r.ctx.drawImage(canvas,center.x-340,center.y-173,680,410);
  }
  function windowOpen(site,time){
    switch(site.custom?.kind){
      case 'gauge':return time%6>=2.4;
      case 'vane':return time%5<3.25;
      case 'lens':return time%5>=1.5&&time%5<=3.5;
      default:return true;
    }
  }
  function windowText(s,open){
    if(s.custom?.kind==='gauge')return open?'LOW WATER':'WATER RISING';
    if(s.custom?.kind==='vane')return open?'WIND LULL':'GUST';
    if(s.custom?.kind==='lens')return open?'LENS ALIGNED':'LIGHT SWEEP';
    return '';
  }
  function patrol(g,s){
    const w=g.world,alive=[];
    for(const [i,role] of s.custom.guards.entries()){
      const id=s.id+'_approach_watch_'+i;
      if(w.dead.has(id))continue;
      alive.push(id);if(w._active.has(id))continue;
      // Post guards on the far side of the station from the cave. The original
      // entrance and every existing patrol stay available while this job is open.
      const dx=s.pad.x-s.loc.x,dy=s.pad.y-s.loc.y;
      const spawn=spotted(w,s.pad,dx*.75+(i?75:-60),dy*.75+(i?-70:55));if(!spawn)continue;
      const type=W.Content.reconEnemyTypes?.[role]??24;
      w.addEnemy(w._createEnemy({id,type,...spawn,homeX:spawn.x,homeY:spawn.y,region:s.loc.region,level:s.config.level||6,locationId:null,boss:false,patrol:i*2.5}));
    }
    return alive;
  }
  const interact=G.interact;
  G.interact=function(p){
    if(this.paused||!living(p)||this.players.some(q=>q!==p&&!living(q)&&range(q,p)<110))return interact.apply(this,arguments);
    const s=station(this,p);if(!s)return interact.apply(this,arguments);
    const w=this.world;
    if(w.opened.has(key(s))){this.ui.toast(s.custom?.reward||s.hint,'quest');return true;}
    if(!windowOpen(s,this.time)){this.ui.toast(s.hint,'quest');return true;}
    if(s.custom?.guards){
      const alarm=key(s)+'_alarm',armed=w.opened.has(alarm);
      const remaining=patrol(this,s).length;
      if(!armed){w.opened.add(alarm);this.save(false);}
      if(remaining){this.ui.toast(remaining+' outer patrol guards remain. Defeat them and return here, or use the dungeon entrance at any time.','event');return true;}
    }
    w.opened.add(key(s));
    if(s.custom?.kind==='radio')for(const hero of [...this.players,this.reservePlayer].filter(Boolean))hero.medkits=(hero.medkits||0)+1;
    this.audio.play('quest');this.effect('shockwave',s.pad.x,s.pad.y,65,.6,{color:s.custom?.tint||'#c6cdb2'});
    this.ui.toast(s.custom?.reward||s.hint,'quest');this.save(false);return true;
  };
  const update=G.updateMissions;
  G.updateMissions=function(dt){
    const result=update.apply(this,arguments);
    if(this.world.isDungeon||this.paused)return result;
    for(const p of this.players){
      if(!living(p))continue;
      const s=station(this,p);
      if(s){
        const read=this.world.opened.has(key(s));
        this.interactionPrompt='E / B · '+(read?'Review field note':s.custom?.act||'Read trail carving');
        break;
      }
    }
    return result;
  };
  const enter=G.enterDungeon;
  G.enterDungeon=function(entry,restoring=false){
    const w=this.world,id=entry?.id==='recon_vault_east'?'recon_vault':entry?.id;
    const surveyed=!w.isDungeon&&w.opened?.has('survey_'+id);
    const ok=enter.apply(this,arguments);
    if(ok&&surveyed&&this.world.reconSite){
      const state=this.world.state;
      if(!state.surveyApplied){
        if(id==='recon_archive'||id==='recon_cistern')state.reconSwitch=state.reconSwitch||1;
        if(id==='recon_spire')state.reconWindbreak=true;
        if(id==='recon_depot')state.reconBrake=true;
        state.surveyApplied=true;
        if(!restoring)this.save(false);
      }
    }
    return ok;
  };
  function lamp(c,x,y,color,alpha,radius){
    c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();c.restore();
  }
  function marks(r,s){
    const c=r.ctx,t=r.game.time,p=s.pad,l=s.loc;if(!p)return;
    const a=Math.atan2(l.y-p.y,l.x-p.x),n=Math.ceil(range(l,p)/38),kind=s.custom?.kind,color=s.custom?.tint||'#dfd3ab';
    c.save();
    // Narrow marks on the ground trace the return journey to the entrance.
    c.translate(p.x,p.y);c.rotate(a);
    for(let i=1;i<n;i++){
      const x=i*range(l,p)/n;c.strokeStyle=color;c.globalAlpha=.38;c.lineWidth=2;
      c.beginPath();if(kind==='switch'){c.moveTo(x,-10);c.lineTo(x,10);}else if(kind==='gauge'){c.ellipse(x,0,8,3,0,0,Math.PI*2);}else{c.moveTo(x-4,-3);c.lineTo(x+4,0);c.lineTo(x-4,3);}c.stroke();
    }c.restore();
    if(kind==='lantern'){
      for(let i=0;i<7;i++){const u=(t*.09+i/7)%1;lamp(c,p.x+(l.x-p.x)*u+Math.sin(i+t)*11,p.y+(l.y-p.y)*u-16+Math.cos(i+t*.6)*9,color,.6,2.5);}
    }else if(kind==='gauge'){
      for(let i=0;i<3;i++){const f=(t*.47+i/3)%1;c.save();c.globalAlpha=.6*(1-f);c.lineWidth=2;c.strokeStyle=color;c.beginPath();c.ellipse(l.x+57,l.y+13,8+f*45,3+f*14,0,0,Math.PI*2);c.stroke();c.restore();}
    }else if(kind==='radio'||kind==='vane'){
      const high=kind==='radio'?Math.floor(t*2)%3===0:windowOpen(s,t);lamp(c,p.x,p.y-48,color,high?.95:.32,high?4:2);
      if(kind==='vane'&&!high){
        c.save();c.strokeStyle=color;c.globalAlpha=.5;c.lineWidth=1.5;
        for(let i=0;i<3;i++){const x=l.x-125+(t*80+i*76)%240,y=l.y-109-i*22;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+16,y-6,x+29,y-2);c.stroke();}
        c.restore();
      }
    }else if(kind==='lens'){
      const a=t*Math.PI*.4;c.save();c.globalAlpha=.42;c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.moveTo(p.x,p.y-15);c.lineTo(p.x+Math.cos(a)*64,p.y-15+Math.sin(a)*22);c.stroke();c.restore();
    }else if(kind==='switch'){
      for(let i=0;i<3;i++){const f=(t*.33+i/3)%1;lamp(c,l.x-86+f*16,l.y-164-f*50,'#b6b6a9',.4*(1-f),3+f*10);}
    }
  }
  const draw=R.drawObject;
  R.drawObject=function(o,w){
    if(w.isDungeon||o.type!=='cave')return draw.apply(this,arguments);
    if(!onCamera(this,o,350))return;
    const s=sites(w).find(s=>s.id===o.locationId),im=s&&W.ReconArt?.approach(s.art);
    if(!im)return draw.apply(this,arguments);
    const c=this.ctx,width=s.custom?(s.art==='spire'?260:300):198,h=width*im.height/im.width;
    const x=o.x+(s.art==='vault'?-130:0),y=o.y+35;
    // The actor sort already draws heroes south of the object's ground anchor
    // in front. Fade only when the landmark would actually paint over them.
    const obscures=this.game.players.some(p=>Math.abs(p.x-x)<width*.46&&p.y<o.y&&p.y>y-h);
    c.save();c.globalAlpha*=obscures?.45:1;c.drawImage(im,x-width/2,y-h*.92,width,h);c.restore();
    if(s.art==='vault')draw.apply(this,arguments);
  };
  const ground=R.drawTerrain;
  R.drawTerrain=function(w){
    const result=ground.apply(this,arguments);
    if(!w.isDungeon)for(const s of sites(w)){
      if(!onCamera(this,s.loc,495))continue;
      if(s.custom)paintApron(this,s.art,s.loc);
      marks(this,s);
      if(s.pad){
        const p=s.pad,device=s.custom&&W.ReconArt?.mechanism('recon_'+s.art);
        if(device){
          const width=62,height=width*device.height/device.width;this.ctx.drawImage(device,p.x-width/2,p.y-height,width,height);
        }else W.Art?.draw(this,'dungeonProps',2,0,p.x,p.y,47,46);
      }
    }
    const gate=!w.isDungeon&&w.getLocation?.('recon_vault_east');
    if(gate&&onCamera(this,gate,350)){
      paintApron(this,'vault',gate);
      for(let i=0;i<4;i++)lamp(this.ctx,gate.x-53+i*36,gate.y+27,'#f9cc83',.45+.28*Math.sin(this.game.time*3-i),2.5);
    }
    return result;
  };
  const labels=R.drawLocationLabels;
  R.drawLocationLabels=function(w){
    const result=labels.apply(this,arguments);
    if(w.isDungeon)return result;
    for(const s of sites(w)){
      if(!onCamera(this,s.loc,495)||!s.pad||!this.game.players.some(p=>range(p,s.pad)<500))continue;
      const p=s.pad,done=w.opened.has(key(s));
      const close=this.game.players.some(hero=>range(hero,p)<135);
      if(close){
        const timer=done?'SURVEYED':windowText(s,windowOpen(s,this.game.time));
        this.worldLabel(s.title,p.x,p.y+18,done?'#aee1b9':'#f4d49a',13);
        if(timer)this.worldLabel(timer,p.x,p.y+35,'#f6edd5',11);
      }
    }return result;
  };
  W.DungeonApproaches={sites,station,windowOpen,onCamera};
}());
