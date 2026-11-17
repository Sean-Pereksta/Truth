(function(){
  'use strict';
  const W=window.OW,E=W.TavernRules,G=W.Game.prototype,U=W.UI.prototype;
  const tavernId='tavern_copper_minnow',clamp=W.TownActivities.clamp,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const abs=id=>((W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/tavern/'+id+'.webp');
  const pics=new Map();function pic(id){if(!pics.has(id)){const im=new Image();im.src=abs(id);pics.set(id,im);}const im=pics.get(id);return im.complete&&im.naturalWidth?im:null;}
  const bodies=[
    {id:'barkeep',name:'Mae · barkeep',x:44,y:31,art:'barkeep'},
    {id:'angler',name:'Netmaker Lark',x:18,y:42,art:'angler'},
    {id:'mouse',name:'Pipkin · visiting mouse',x:71,y:38,art:'mouse'},
    {id:'easy',name:'Lark · easy draw',x:22,y:65,art:'table-easy'},
    {id:'regular',name:'Magpie · regular draw',x:48,y:64,art:'table-regular'},
    {id:'expert',name:'Pipkin · expert draw',x:69,y:61,art:'table-expert'},
    {id:'darts',name:'Darts oche',x:82,y:68,art:'darts'},
    {id:'exit',name:'Harbor door',x:51,y:90,art:null}
  ];
  const conversations={
    barkeep:{name:'Mae Saltpaw',hello:'“Tie your coat to the brass hook, friend. The tide has claimed three this week.”',choices:[
      ['Who built this inn?','“My father set that first beam with a shipwright’s adze. On bad nights the whole house creaks like his trawler. I still sleep through it.”'],
      ['What travels through the harbor?','“Look at the wax on the delivery slips. The dock crews stamp fish in blue and relief grain in green. The wrong color means someone changed the load.”'],
      ['What’s on tonight?','“Magpie deals five-card draw. Pipkin keeps a straight oche for darts. Lark will talk your whiskers off about fishing.”']]},
    angler:{name:'Netmaker Lark',hello:'“The bay’s quiet tonight. That doesn’t mean the fish are asleep.”',choices:[
      ['Ask about the rocky inlet','“A wrasse turns back on itself. Hold the line tight as it turns and it’ll snap. Let the fish pull against loose water.”'],
      ['Ask about the outer pier','“The sailfin likes deep water under the lanterns. Watch the float, not the reflection.”'],
      ['Ask about the missing couriers','“One used to bring my mother letters. I saved a chair by the window for the next one who comes in.”']]},
    mouse:{name:'Pipkin',hello:'“I win with my ears, not my elbow. Listen when a dart lands just outside the wire.”',choices:[
      ['Learn the board','“The triple ring is halfway out. The double is the lip. A clean twenty there pays forty points. The inner bull pays fifty.”'],
      ['Talk strategy','“In Mossbell, sit opposite the cream Warden and pretend to leave A3 open. Everyone sees a free lantern. Fewer see the shove.”'],
      ['Ask about Magpie','“She doesn’t bluff with the same face twice. Watch how many cards she throws away.”']]}
  };
  const empty=()=>({serial:0,hand:null,dartsBest:[0,0],talked:[],inside:false});
  const ledger=g=>g.tavernBook||(g.tavernBook=empty());
  const clone=o=>JSON.parse(JSON.stringify(o));
  function entrance(g){return g.world?.isDungeon?null:g.world?.getLocation(tavernId);}
  function door(g){
    const l=entrance(g),t=g.world?.getLocation('town_9');if(!l||!t)return;
    g.players.forEach((p,i)=>Object.assign(p,W.TownActivities.safe(g.world,t,{x:l.x+(i?19:-19),y:l.y+18})));
    g.camera.x=g.players[0].x;g.camera.y=g.players[0].y;g.travelInteractUntil=g.time+.65;
  }
  const snap=G.snapshot;G.snapshot=function(){const s=snap.apply(this,arguments);s.copperMinnow=clone(ledger(this));return s;};
  const load=G.load;G.load=function(slot=0){const data=W.Save.read(slot);if(!data)return false;
    const old=this.tavernBook,previous=this.tavernVisit;this.tavernVisit=null;this.tavernBook=Object.assign(empty(),data.copperMinnow||{});
    let ok=false;try{ok=load.apply(this,arguments);}finally{if(!ok){this.tavernBook=old;this.tavernVisit=previous;}}
    if(ok&&ledger(this).inside){door(this);ledger(this).inside=false;this.ui.toast(ledger(this).hand?.phase!=='done'&&ledger(this).hand?'Back at the Copper Minnow. Your poker hand and table stakes are waiting inside.':'Back at the Copper Minnow’s harbor door.');this.save(false);}return ok;
  };
  const start=G.start;G.start=function(opts={}){if(!opts.load){this.tavernBook=empty();this.tavernVisit=null;}return start.apply(this,arguments);};
  const interact=G.interact;G.interact=function(p){const l=entrance(this);
    if(l&&!this.paused&&!p.downed&&dist(l,p)<76&&!this.players.some(q=>q!==p&&q.downed&&dist(p,q)<100))return this.openTavern(p.id);
    return interact.apply(this,arguments);
  };
  const missions=G.updateMissions;G.updateMissions=function(dt){const res=missions.apply(this,arguments),l=entrance(this);
    if(l){const p=this.players.find(p=>!p.downed&&dist(p,l)<76);if(p)this.interactionPrompt=(this.input.actionLabel(p.id,'interact')||'Interact')+' · Enter the Copper Minnow';}return res;
  };
  G.openTavern=function(owner=0){
    const l=entrance(this),p=this.players[owner];if(!l||!p||dist(l,p)>=76||this.players.some(p=>p.downed))return false;
    const needed=this.input.connectedPads().map(p=>this.input.padAssignments.get(p.index)).filter(s=>this.players[s]);
    this.tavernVisit={scene:'room',owner,cursor:0,actors:this.players.map((p,i)=>({id:p.id,x:48+i*5,y:81})),axes:[{},{}],pads:needed,now:performance.now(),lastPanel:'',note:'',revealed:null,discards:[]};
    ledger(this).inside=true;this.ui.showMenu('copper-minnow',owner);this.save(false);return true;
  };
  function close(ui){const g=ui.game;door(g);ledger(g).inside=false;g.tavernVisit=null;ui.hideMenu();g.input.clear();g.save(false);}
  function change(ui,scene){const a=ui.game.tavernVisit;a.scene=scene;a.cursor=0;a.note='';a.discards=[];a.revealed=null;a.aiWait=.72;a.effectAt=performance.now();a.effect=scene==='poker'?'deal':'';ui.render();}
  function persist(g,action){
    const old=clone(ledger(g)),heroes=[...g.players,...(g.reservePlayer?[g.reservePlayer]:[])],gold=heroes.map(p=>p.gold);
    action();
    if(g.save(false))return true;
    g.tavernBook=old;heroes.forEach((p,i)=>p.gold=gold[i]);return false;
  }
  function sit(ui,ids){
    const g=ui.game,a=g.tavernVisit,b=ledger(g);
    if(b.hand&&b.hand.phase!=='done')return;
    const stake=5*E.tables[a.table].unit;if(ids.some(id=>!g.players[id]||g.players[id].gold<stake)){a.note='Each sitting hero needs '+stake+' coins to cover the full hand.';return ui.render();}
    if(!persist(g,()=>{for(const id of ids)g.players[id].gold-=stake;b.serial++;b.hand=E.deal(ids,b.serial,Math.random,a.table);})){a.note='The stakes could not be saved. Your wallet kept its coins.';return ui.render();}
    change(ui,'poker');
  }
  function pokerMove(ui,id,action,discard=[]){
    const g=ui.game,a=g.tavernVisit,b=ledger(g),next=E.act(b.hand,id,action,discard);
    if(!next)return;
    const saved=persist(g,()=>{
      b.hand=next;
      if(next.phase==='done'&&!next.paid){
        next.seats.forEach((seat,i)=>{if(seat.id===2)return;const p=g.players.find(p=>p.id===seat.id)||(g.reservePlayer?.id===seat.id?g.reservePlayer:null);
          if(p)p.gold+=5*next.unit-seat.paid+next.payout[i];});next.paid=true;
      }
    });
    if(!saved){a.note='Could not save this move. The cards and coins are back where they were.';a.aiWait=2;return ui.render();}
    a.discards=[];a.revealed=null;a.cursor=0;a.aiWait=.85;a.effectAt=performance.now();a.effect=action;a.effectSeat=id;a.note='';ui.render();
  }
  function nearest(a,who){const player=a.actors[who];return bodies.reduce((best,b)=>!best||dist(player,b)<dist(player,best)?b:best,null);}
  function approach(ui,id,owner){
    const g=ui.game,a=g.tavernVisit,l=bodies.find(b=>b.id===id);if(!l)return;
    a.owner=owner;
    if(id==='exit')return close(ui);
    const table=E.tables.findIndex(t=>t.id===id);if(table>=0){a.table=table;return change(ui,'table');}
    if(id==='darts')return change(ui,'oche');
    const b=ledger(g);if(!b.talked.includes(id)){b.talked.push(id);g.save(false);}
    a.contact=id;change(ui,'chat');a.note=conversations[id].hello;ui.render();
  }
  function startDarts(ui,two){
    const a=ui.game.tavernVisit;a.scene='darts';a.cursor=0;a.note='';
    a.darts={two,turn:0,aim:[0,-.4],elapsed:0,count:[0,0],score:[0,0],marks:[],message:'Aim with the stick. Hold, then release to throw.',held:false,waitRelease:true,power:0,aiWait:1.05,finish:false,banked:false};
    ui.render();
  }
  function castDart(ui,ai=false){
    const a=ui.game.tavernVisit,d=a.darts,who=d.turn;
    if(d.finish)return;
    const t=d.power;let [x,y]=d.aim;
    if(ai){const idx=d.count[1];x=Math.sin(idx*2.9+1)*.4;y=-.57+Math.cos(idx*2.7)*.19;}
    else {const drift=Math.abs(t-.57)*.37;x+=Math.sin(d.elapsed*8)*drift;y+=Math.cos(d.elapsed*7)*drift;}
    const hit=E.dartScore(x,y);d.marks.push({x,y,who});d.count[who]++;d.score[who]+=hit.points;d.message=(who?(d.two?'P2':'Pipkin'):(d.two?'P1':'P'+(a.owner+1)))+' · '+hit.label+' · '+hit.points+' points';
    ui.game.audio.play('impact');d.held=false;d.power=0;
    if(d.count.every(n=>n===3)){d.finish=true;storeDarts(ui);}
    else {d.turn=1-d.turn;d.aim=[0,-.4];d.aiWait=1.15;}ui.render();
  }
  function storeDarts(ui){
    const g=ui.game,d=g.tavernVisit.darts;if(d.banked)return;
    const b=ledger(g);d.banked=persist(g,()=>{
      if(d.two){for(let i=0;i<2;i++)b.dartsBest[i]=Math.max(b.dartsBest[i],d.score[i]);}
      else b.dartsBest[g.tavernVisit.owner]=Math.max(b.dartsBest[g.tavernVisit.owner],d.score[0]);
    });
  }
  function options(ui){
    const g=ui.game,a=g.tavernVisit,b=ledger(g),h=b.hand,d=a.darts;
    if(a.scene==='chat')return [...conversations[a.contact].choices.map(([q],i)=>['talk'+i,q]),['room','Back to the bar']];
    if(a.scene==='table'){
      if(h&&h.phase!=='done')return [...(h.table===a.table?[['resume','Resume the reserved hand']]:[]),['room','Return to '+E.tables[h.table].name+' for your reserved hand']];
      const table=E.tables[a.table],stake=5*table.unit;return [['solo','Sit with '+table.player+' · reserve '+stake+' coins'],...(g.players.length===2?[['local','P1 + P2 + '+table.player+' · '+stake+' each']]:[]),['room','Back to the bar']];
    }
    if(a.scene==='oche')return [['dsolo','Three darts against Pipkin'],...(g.players.length===2?[['dlocal','P1 vs P2 · three darts each']]:[]),['room','Back to the bar']];
    if(a.scene==='darts'&&d?.finish)return [...(!d.banked?[['bank','Retry saving record']]:[]),['rematch','Rematch'],['room','Back to the bar']];
    if(a.scene==='poker'){
      if(h.phase==='done')return [['table','Play another hand'],['room','Back to the bar']];
      const p=h.seats[h.turn];if(p.id===2)return [];
      if(h.seats.length===3&&a.revealed!==p.id)return [['reveal','P'+(p.id+1)+' · reveal my cards']];
      if(h.phase==='draw')return [...p.cards.map((card,i)=>['card'+i,(a.discards.includes(i)?'Replace ':'Keep ')+E.face(card)]),['draw',a.discards.length?'Draw '+a.discards.length+' cards':'Stand pat']];
      return E.legal(h).map(kind=>[kind,({check:'Check',fold:'Fold',call:'Call '+(h.price-p.street),bet:'Bet '+h.unit,raise:'Raise to '+(h.price+h.unit)})[kind]]);
    }
    return [];
  }
  function ownerOf(ui){const g=ui.game,a=g.tavernVisit;
    if(a.scene==='poker'&&ledger(g).hand?.phase!=='done')return ledger(g).hand.seats[ledger(g).hand.turn].id;
    if(a.scene==='darts'&&!a.darts?.finish)return a.darts?.two?a.darts.turn:a.darts?.turn?2:a.owner;
    return a.owner;
  }
  function choose(ui,id,seat){
    const g=ui.game,a=g.tavernVisit,b=ledger(g);if(!a)return;
    if(id==='room')return change(ui,'room');if(id==='leave')return close(ui);
    if(id==='solo'||id==='local')return sit(ui,id==='solo'?[a.owner]:[0,1]);
    if(id==='resume'){
      if(b.hand.seats.some(p=>p.id<2&&!g.players[p.id])){a.note='Rejoin the second hero at camp to resume their reserved hand.';return ui.render();}
      return change(ui,'poker');
    }
    if(id==='table')return change(ui,'table');
    if(id==='dsolo'||id==='dlocal')return startDarts(ui,id==='dlocal');
    if(id==='bank'){storeDarts(ui);return ui.render();}
    if(id==='rematch')return startDarts(ui,a.darts.two);
    if(a.scene==='chat'&&id.startsWith('talk')){a.note=conversations[a.contact].choices[+id.slice(4)][1];return ui.render();}
    if(a.scene==='poker'&&seat===ownerOf(ui)&&seat<2){
      if(id==='reveal'){a.revealed=seat;a.cursor=b.hand.phase==='draw'?5:0;return ui.render();}
      if(id.startsWith('card')){const card=+id.slice(4),chosen=a.discards.indexOf(card);if(chosen>=0)a.discards.splice(chosen,1);else if(a.discards.length<3)a.discards.push(card);else a.note='Choose up to three cards to replace.';return ui.render();}
      return pokerMove(ui,seat,id,a.discards);
    }
  }
  function input(ui,seat,key){
    const a=ui.game.tavernVisit;if(!a||a.missing||document.hidden||!a.actors[seat])return;
    if(a.scene==='room'){
      const body=nearest(a,seat);
      if(key==='back')return close(ui);
      if(key==='confirm'&&body&&dist(body,a.actors[seat])<=14)return approach(ui,body.id,seat);
      if(key==='next'||key==='prev'){const i=bodies.indexOf(body),target=bodies[(i+(key==='next'?1:bodies.length-1))%bodies.length];a.actors[seat].goal=target;}
      return;
    }
    if(key==='back'){if(seat===a.owner||seat===ownerOf(ui))change(ui,'room');return;}
    if(seat!==ownerOf(ui))return;
    const list=options(ui);
    if(!list.length)return;
    if(key==='confirm')return choose(ui,list[a.cursor]?.[0],seat);
    if(['up','left','down','right'].includes(key)){a.cursor=(a.cursor+(['up','left'].includes(key)?-1:1)+list.length)%list.length;ui.render();}
  }
  function tick(ui,dt){
    const g=ui.game,a=g.tavernVisit;
    if(a.scene==='room'){
      a.actors.forEach((p,i)=>{
        let {x=0,y=0}=a.axes[i],len=Math.hypot(x,y);
        if(len>.15){p.goal=null;p.interactGoal=null;}
        if(p.goal){x=p.goal.x-p.x;y=p.goal.y-p.y;len=Math.hypot(x,y);if(len<3){p.goal=null;return;}}
        if(len>.1){
          const nx=clamp(p.x+x/Math.max(1,len)*dt*23,8,93),ny=clamp(p.y+y/Math.max(1,len)*dt*31,29,91);
          const blocked=(x,y)=>[[22,53],[48,52],[69,49]].some(([cx,cy])=>((x-cx)/6.4)**2+((y-cy)/4.2)**2<1);
          if(!blocked(nx,p.y))p.x=nx;if(!blocked(p.x,ny))p.y=ny;
          // A focused walk follows the clear aisle around a table corner.
          if(p.goal&&blocked(nx,ny))p.x=clamp(p.x+(p.x>=p.goal.x?1:-1)*dt*14,8,93);
        }
      });
    }else if(a.scene==='poker'){const h=ledger(g).hand;if(h?.phase!=='done'&&h?.seats[h.turn].id===2&&(a.aiWait-=dt)<=0){const m=E.computer(h);pokerMove(ui,2,m.action,m.cards);}}
    else if(a.scene==='darts'&&!a.darts.finish){
      const d=a.darts;d.elapsed+=dt;
      if(d.turn===1&&!d.two){if((d.aiWait-=dt)<=0)castDart(ui,true);return;}
      const c=a.axes[ownerOf(ui)]||{};if(d.waitRelease){if(!c.hit)d.waitRelease=false;return;}d.aim[0]=clamp(d.aim[0]+(c.x||0)*dt*.98,-1.07,1.07);d.aim[1]=clamp(d.aim[1]+(c.y||0)*dt*.98,-1.07,1.07);
      if(c.hit){d.held=true;d.power=(d.power+dt*.72)%1;}else if(d.held)castDart(ui);
    }
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function label(c,s,x,y,size=18,color='#ffebc4',align='center'){
    c.save();c.font='600 '+size+'px Georgia';c.textAlign=align;c.lineJoin='round';c.lineWidth=3;c.strokeStyle='#211e19';c.strokeText(s,x,y);c.fillStyle=color;c.fillText(s,x,y);c.restore();
  }
  function thumb(c,key,x,y,w,h){const im=pic(key);if(im)c.drawImage(im,x,y,w,h);}
  function frame(c,key,row,col,x,y,w,h){
    const rect=W.TavernFrames?.[key]?.[row]?.[col],im=rect&&pic(key);if(!rect||!im)return false;
    c.drawImage(im,...rect,x,y,w,h);return true;
  }
  function room(c,a,g){
    const im=pic('room');if(im)c.drawImage(im,0,0,900,480);
    const t=performance.now()/1000;
    const renderables=[];
    const u=x=>x*9,v=y=>y*4.8;
    for(const b of bodies){
      const ix=E.tables.findIndex(q=>q.id===b.id),x=u(b.x),y=v(b.y);
      if(ix>=0){const table=E.tables[ix],row=table.row,breath=Math.sin(t*2+row)*1.2;
        renderables.push([b.y-10,()=>{frame(c,'walk',row,Math.floor(t*.95+ix)%7===0?3:0,x-33,y-124+breath,66,82)||thumb(c,['angler','dealer','mouse'][ix],x-30,y-118,60,74);thumb(c,b.art,x-63,y-78,126,73);label(c,table.name.replace(' table',''),x,y-3,14);label(c,['Easy','Regular','Expert'][ix]+' · '+table.unit+' coin'+(ix?'s':''),x,y+10,11,'#f7d29b');}]);continue;}
      if(b.id==='darts'){renderables.push([b.y-5,()=>{thumb(c,'target',x-33,y-67,66,58);label(c,'Darts',x,y-3,15);}]);continue;}
      if(b.id==='exit')continue;
      if(b.id==='angler'||b.id==='mouse'){
        renderables.push([b.y-1,()=>label(c,b.id==='angler'?'Lark':'Pipkin',x,y-18,13)]);
        continue;
      }
      const row={barkeep:0,angler:1,mouse:3}[b.id],sway=Math.sin(t*1.2+row)*3;
      renderables.push([b.y,()=>{frame(c,'walk',row,Math.floor(t*.9+row)%6===1?3:0,x-21+sway,y-57,42,59)||thumb(c,b.art,x-20+sway,y-54,40,54);label(c,b.name.split(' ·')[0],x,y+13,12);}]);
    }
    for(const p of a.actors){renderables.push([p.y,()=>{
      const hero=g.players[p.id],r=g.renderer,vel=a.axes[p.id]||{};
      const f=r.actorFrame({...hero,moveTime:t,velocityX:p.goal?20:(vel.x||0)*30,velocityY:(vel.y||0)*30,anim:p.goal||Math.hypot(vel.x||0,vel.y||0)>.1?'walk':'idle'},true);
      const img=r.images[f.key],x=u(p.x),y=v(p.y);
      if(img){const cw=(img.naturalWidth||img.width)/f.cols,ch=(img.naturalHeight||img.height)/f.rows;c.save();if(vel.x<0){c.translate(x,0);c.scale(-1,1);c.drawImage(img,f.col*cw,f.row*ch,cw,ch,-24,y-53,48,54);}else c.drawImage(img,f.col*cw,f.row*ch,cw,ch,x-24,y-53,48,54);c.restore();}
      label(c,'P'+(p.id+1),x,y+12,12,p.id?'#b0ddff':'#ffcd82');
    }]);}
    renderables.sort((a,b)=>a[0]-b[0]).forEach(r=>r[1]());
    const near=a.actors.flatMap(p=>{const b=nearest(a,p.id);return dist(p,b)<14?['P'+(p.id+1)+' · '+b.name]:[];});
    label(c,near.length?near.join('     /     '):'Walk to a table, patron or harbor door',450,465,19);
  }
  function poker(c,a,g){
    const h=ledger(g).hand,table=E.tables[h.table],t=performance.now()/1000,done=h.phase==='done',id=h.seats[h.turn].id,current=h.seats[h.turn];
    const bg=pic('taproom')||pic('room');if(bg)c.drawImage(bg,0,0,900,480);c.fillStyle='#172927cf';c.fillRect(0,0,900,480);
    c.fillStyle=['#5d643c','#3a6051','#4e5260'][h.table];c.beginPath();c.ellipse(450,268,385,181,0,0,Math.PI*2);c.fill();c.strokeStyle='#ab8657';c.lineWidth=8;c.stroke();
    const elapsed=(performance.now()-(a.effectAt||0))/1000,reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||g.settings?.reducedMotion;
    const reaction=done?(h.winners.includes(2)?5:3):a.effect==='fold'&&a.effectSeat===2?3:h.tell.frame;
    const subtle=h.table===2&&reaction!==5&&t%3.8>.64;const f=Math.floor(t*2)%11===0?1:subtle?0:reaction,y=28+(reduce?0:Math.sin(t*2)*1.5+(done&&elapsed<.6?-Math.sin(elapsed*8)*4:0));
    if(!frame(c,'faces',table.row,f,25,y,106,108))thumb(c,['angler','dealer','mouse'][h.table],25,y,106,108);
    label(c,table.player,78,154,17);label(c,done?(h.winners.includes(2)?'Wins the hand':'Concedes the pot'):subtle?'Studies the felt.':h.tell.caption,155,50,17,'#ffde9d','left');
    label(c,'Pot · '+h.pot+' coins',722,53,24);thumb(c,'chips',697,61,61,45);
    if(!reduce&&elapsed<.52&&['bet','raise','call'].includes(a.effect)){
      const p=Math.min(1,elapsed/.52);thumb(c,'chips',452+250*p,350-272*p-Math.sin(p*Math.PI)*33,32,25);
    }
    const phase={opening:'Opening bets',draw:'Draw up to three',closing:'Final bets',done:'Showdown'};
    label(c,phase[h.phase],450,111,23);label(c,h.log,450,140,17);
    function cards(p,i,y,visible,cardW){
      const spacing=cardW+8,start=450-(spacing*5-8)/2,cardH=cardW*1.33;
      p.cards.forEach((n,j)=>{let x=start+j*spacing,cy=y-(id===p.id&&a.discards.includes(j)?9:0);
        const deal=!reduce&&['deal','draw'].includes(a.effect)&&elapsed<.75;
        if(deal){const u=clamp((elapsed-j*.055)/.40,0,1);x+=(1-u)*(660-x);cy+=(1-u)*(93-cy);}
        if(!visible){const im=pic('card-back');if(im)c.drawImage(im,x,cy,cardW,cardH);else{c.fillStyle='#614e47';c.fillRect(x,cy,cardW,cardH);}return;}
        const value=2+n%13,suit=E.face(n).slice(-1),number=E.face(n).slice(0,-1),red=[1,2].includes(E.suit(n)),ink=red?'#9b3634':'#273d38';
        const paper=c.createLinearGradient(x,cy,x+cardW,cy+cardH);paper.addColorStop(0,'#fff9e7');paper.addColorStop(1,'#e8d9b5');
        c.save();c.shadowColor='#151f1c80';c.shadowBlur=4;c.shadowOffsetY=3;c.fillStyle=paper;c.strokeStyle=a.discards.includes(j)&&id===p.id?'#ce764d':'#cbb692';c.lineWidth=2;c.beginPath();c.roundRect(x,cy,cardW,cardH,6);c.fill();c.stroke();c.restore();
        c.strokeStyle='#cbb998';c.lineWidth=.8;c.strokeRect(x+4,cy+4,cardW-8,cardH-8);
        c.fillStyle=ink;c.font='bold '+Math.round(cardW*.22)+'px Georgia';c.textAlign='left';c.fillText(number,x+7,cy+cardW*.26);
        c.textAlign='right';c.fillText(number,x+cardW-7,cy+cardH-7);
        c.textAlign='center';
        if(cardW<57||value>10||value===14){c.font='bold '+Math.round(cardW*.50)+'px Georgia';c.fillText(suit,x+cardW/2,cy+cardH*.63);}
        else{
          const spots=value%2?[[.5,.5]]:[],pairs=Math.floor(value/2);
          for(let k=0;k<pairs;k++){const py=.26+(pairs===1?.22:k/(pairs-1)*.48);spots.push([.35,py],[.65,py]);}
          c.font='bold '+Math.round(cardW*(value>7?.17:.20))+'px Georgia';
          for(const [px,py] of spots)c.fillText(suit,x+cardW*px,cy+cardH*py+cardW*.07);
        }
      });
      const rankText=visible?E.ranks[E.rank(p.cards)[0]]:'Face down';
      label(c,p.name+(p.folded?' · folded':' · '+rankText)+' · '+p.paid+' in pot',450,y+cardH+20,16,p.folded?'#d8a999':'#fff0c6');
    }
    if(done){const w=h.seats.length===3?41:54;let cy=155;h.seats.forEach((p,i)=>{cards(p,i,cy,!p.folded,w);cy+=w*1.33+39;});}
    else{const single=h.seats.length===2,display=single?h.seats.find(p=>p.id!==2):current;
      const show=single||id!==2&&a.revealed===id;cards(display,0,199,show,83);
      label(c,id===2?table.player+' is considering the bet.':current.name+' to act',450,395,22);
      if(!show&&id!==2)label(c,'Pass control to '+current.name+' to reveal their cards.',450,428,17);
    }
  }
  function darts(c,a){
    const d=a.darts,bg=pic('room');if(bg)c.drawImage(bg,0,0,900,480);c.fillStyle='#172526cb';c.fillRect(0,0,900,480);
    const cx=450,cy=240,r=181;
    for(let i=0;i<20;i++)for(const [outer,inner,col] of [[1,.92,i%2?'#b98452':'#bf6350'],[.92,.63,i%2?'#dcc78e':'#314b48'],[.63,.55,i%2?'#739a72':'#b75c48'],[.55,0,i%2?'#d6c694':'#334744']]){
      const angle=(i-.5)*Math.PI/10-Math.PI/2;c.beginPath();c.arc(cx,cy,r*outer,angle,angle+Math.PI/10);c.arc(cx,cy,r*inner,angle+Math.PI/10,angle,true);c.closePath();c.fillStyle=col;c.fill();
    }
    for(const [rad,col] of [[.12,'#6e9c81'],[.05,'#bb6555']]){c.beginPath();c.arc(cx,cy,r*rad,0,Math.PI*2);c.fillStyle=col;c.fill();}
    E.sequence.forEach((n,i)=>{const angle=i*Math.PI/10-Math.PI/2;label(c,String(n),cx+Math.cos(angle)*(r+13),cy+Math.sin(angle)*(r+13)+5,13);});
    for(const mark of d.marks){const x=cx+r*mark.x,y=cy+r*mark.y;c.strokeStyle=mark.who?'#b8dbf6':'#ffd087';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+8,y-11);c.stroke();}
    const x=cx+d.aim[0]*r,y=cy+d.aim[1]*r;c.strokeStyle='white';c.lineWidth=2;c.beginPath();c.arc(x,y,10,0,Math.PI*2);c.moveTo(x-15,y);c.lineTo(x+15,y);c.moveTo(x,y-15);c.lineTo(x,y+15);c.stroke();
    label(c,(d.two?'P1':'P'+(a.owner+1))+' · '+d.score[0],112,108,25);label(c,(d.two?'P2':'Pipkin')+' · '+d.score[1],786,108,25);
    label(c,d.count[0]+' / 3 throws',112,140,16);label(c,d.count[1]+' / 3 throws',786,140,16);
    if(d.held){c.fillStyle='#4d625b';c.fillRect(50,240,135,12);c.fillStyle='#d5a950';c.fillRect(50,240,d.power*135,12);c.fillStyle='white';c.fillRect(50+.57*135,236,2,20);label(c,'Release at the mark',118,275,15);}
    label(c,d.finish?(d.score[0]===d.score[1]?'Draw':(d.score[0]>d.score[1]?(d.two?'P1':'P'+(a.owner+1)):d.two?'P2':'Pipkin')+' wins')+' · '+d.score.join(' to '):d.message,450,460,19);
  }
  function paint(ui){
    const g=ui.game,a=g.tavernVisit,canvas=ui.host.querySelector('.tavern-canvas');if(!canvas||!a)return;const c=canvas.getContext('2d');c.clearRect(0,0,900,480);
    if(a.scene==='room')room(c,a,g);else if(a.scene==='poker')poker(c,a,g);else if(a.scene==='darts')darts(c,a);
    else if(a.scene==='chat'){const row={barkeep:0,angler:1,mouse:3}[a.contact],fr=Math.floor(performance.now()/350)%9,p=conversations[a.contact];thumb(c,'room',0,0,900,480);c.fillStyle='#172925ba';c.fillRect(0,0,900,480);
      if(!frame(c,'faces',row,fr===0?1:fr<3?2:0,300,55,300,305))thumb(c,a.contact,300,55,300,305);label(c,p.name,450,419,30);
    }else{thumb(c,'room',0,0,900,480);c.fillStyle='#18282186';c.fillRect(0,0,900,480);const table=E.tables[a.table||0];thumb(c,a.scene==='table'?'table-'+table.id:'target',251,75,398,295);label(c,a.scene==='table'?table.name:'Pipkin’s darts oche',450,411,30);}
  }
  const render=U.render;
  U.render=function(){
    const g=this.game,a=g.tavernVisit;if(!a||this.menu!=='copper-minnow'||!this.isOpen)return render.apply(this,arguments);
    const table=E.tables[a.table||0],h=ledger(g).hand,who=ownerOf(this),items=options(this);
    const subtitle={room:'Crownrest Harbor',chat:'Conversation',table:['Easy','Regular','Expert'][a.table||0]+' draw · '+table.unit+' coin unit',poker:'Five-card draw',oche:'Three darts',darts:'Three darts'};
    let note=a.note;
    if(!note&&a.scene==='table')note=(['Lark wears each hand on his whiskers. ','Magpie sometimes looks past a strong hand. ','Pipkin’s tells are brief and occasionally deceptive. '][a.table||0])+'A hand reserves '+5*table.unit+' coins per hero. Ante '+table.unit+', then two betting rounds with one raise each. Replace up to three cards. Unused stakes return at showdown. A tie splits the pot.';
    if(!note&&a.scene==='oche')note='Aim at the triple ring or bull. Hold Confirm and release at the meter mark. Each player throws three times. No stake.';
    if(!note&&a.scene==='chat')note=conversations[a.contact].hello;
    if(!note&&a.scene==='poker'&&h?.phase==='done')note=h.log;
    if(a.missing)note='Controller disconnected. The same seat will resume when it reconnects.';
    const prompt=a.scene==='room'?'Move · stick or movement keys   /   A/Cross or Enter · speak or sit   /   LB–RB · walk to next stop   /   B/Circle · leave':a.scene==='darts'?'Aim · stick   /   Hold and release A/Cross · throw   /   B/Circle · back to bar':'D-pad · choose   /   A/Cross · confirm   /   B/Circle · back to bar';
    this.host.innerHTML='<div class="menu-layer tavern-layer"><section class="tavern-panel" role="dialog" aria-label="The Copper Minnow"><header><div><small>'+esc(subtitle[a.scene])+'</small><h2>The Copper Minnow</h2></div><button data-tavern="'+(a.scene==='room'?'leave':'room')+'">'+(a.scene==='room'?'Harbor door':'Back to bar')+'</button></header><canvas class="tavern-canvas" width="900" height="480" aria-label="Tavern floor and tables"></canvas>'+
      (note?'<p role="status">'+esc(note)+'</p>':'')+(items.length?'<div class="tavern-options" aria-label="P'+(who+1)+' choices">'+items.map(([id,txt],i)=>'<button data-tavern="'+id+'" class="'+(i===a.cursor?'is-current':'')+'">'+esc(txt)+'</button>').join('')+'</div>':'')+'<footer>'+esc(prompt)+'</footer></section></div>';paint(this);
  };
  const click=U.click;U.click=function(e){
    const g=this.game,a=g.tavernVisit;if(!a||this.menu!=='copper-minnow')return click.apply(this,arguments);
    const button=e.target.closest?.('[data-tavern]');if(button){if(!a.missing||button.dataset.tavern==='leave')choose(this,button.dataset.tavern,ownerOf(this));return;}
    if(!e.target.matches('canvas')||a.missing)return;
    const b=e.target.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*100,y=(e.clientY-b.top)/b.height*100;
    if(a.scene==='room'){const actor=a.actors[a.owner],nearest=bodies.reduce((best,v)=>dist(v,{x,y})<dist(best,{x,y})?v:best,bodies[0]);if(dist(nearest,{x,y})<13){if(dist(actor,nearest)<14)approach(this,nearest.id,a.owner);else{actor.goal=nearest;actor.interactGoal=nearest.id;}}else{actor.goal={x,y};actor.interactGoal=null;}}
    else if(a.scene==='darts'&&!a.darts.finish&&ownerOf(this)<2){a.darts.aim=[clamp((x*9-450)/181,-1.1,1.1),clamp((y*4.8-240)/181,-1.1,1.1)];a.darts.power=.45;castDart(this);}
  };
  const pad=U.handleCoopPadInput;U.handleCoopPadInput=function(inputDevice,device,edge,held,seat){
    const a=this.game.tavernVisit;if(!a||this.menu!=='copper-minnow')return pad?.apply(this,arguments);
    if(!a.actors[seat])return true;
    if(held.some(Boolean)&&!a.pads.includes(seat))a.pads.push(seat);
    const profile=inputDevice.padProfile?.(seat),sw=profile?.sticks==='swap'||profile?.sticks==='inherit'&&inputDevice.padBindings.swapSticks,off=sw?2:0;
    const axis=n=>Math.abs(n||0)>(profile?.deadzone||.18)?n:0;
    const x=held[14]?-1:held[15]?1:axis(device.axes[off]),y=held[12]?-1:held[13]?1:axis(device.axes[off+1]);
    a.axes[seat].pad={x,y,hit:held[0]};
    const d=y<-.5?'up':y>.5?'down':x<-.5?'left':x>.5?'right':'',t=performance.now(),rep=inputDevice.padMenuRepeat.get(device.index)||{dir:'',next:0};
    if(d&&(d!==rep.dir||t>=rep.next)){input(this,seat,d);rep.next=t+(d===rep.dir?160:330);}rep.dir=d;inputDevice.padMenuRepeat.set(device.index,rep);
    if(edge[0])input(this,seat,'confirm');else if(edge[1]||edge[9])input(this,seat,'back');else if(edge[4])input(this,seat,'prev');else if(edge[5])input(this,seat,'next');return true;
  };
  const keyboard=U.handleCoopKeyboardInput;U.handleCoopKeyboardInput=function(dev){
    const a=this.game.tavernVisit;if(!a||this.menu!=='copper-minnow')return keyboard?.apply(this,arguments);
    for(let seat=0;seat<a.actors.length;seat++){
      const bindings=d=>dev.bindings[(seat?'p2':'')+d],down=d=>dev.keys.has(bindings(d))||a.actors.length===1&&dev.keys.has('Arrow'+d[0].toUpperCase()+d.slice(1)),key=seat?'NumpadEnter':'Enter';
      const c=a.axes[seat],p=c.pad||{};c.x=p.x||Number(down('right'))-Number(down('left'));c.y=p.y||Number(down('down'))-Number(down('up'));c.hit=p.hit||dev.keys.has(key);c.pad=null;
      for(const d of ['left','right','up','down'])if(dev.snapshot.has(bindings(d))||a.actors.length===1&&dev.snapshot.has('Arrow'+d[0].toUpperCase()+d.slice(1)))input(this,seat,d);
      if(dev.snapshot.has(key)||a.scene==='room'&&dev.snapshot.has(bindings('interact')))input(this,seat,'confirm');
      if(dev.snapshot.has(seat?'NumpadSubtract':'Backspace'))input(this,seat,'back');if(dev.snapshot.has(seat?'Numpad0':'Tab'))input(this,seat,'next');
    }
    if(dev.snapshot.has('Escape'))input(this,a.owner,'back');return true;
  };
  const update=U.update;U.update=function(){
    const g=this.game,a=g.tavernVisit;if(!a||this.menu!=='copper-minnow'||!this.isOpen)return update.apply(this,arguments);
    const now=performance.now(),dt=Math.min(.08,(now-a.now)/1000);a.now=now;
    const connected=new Set(g.input.connectedPads().map(p=>g.input.padAssignments.get(p.index))),missing=a.pads.some(i=>!connected.has(i));
    if(Boolean(a.missing)!==missing){a.missing=missing;this.render();}
    if(!missing&&!document.hidden){
      tick(this,dt);
      if(a.scene==='room')for(const p of a.actors)if(p.interactGoal&&!p.goal){const body=bodies.find(b=>b.id===p.interactGoal);p.interactGoal=null;if(body&&dist(body,p)<14)approach(this,body.id,p.id);}
    }
    paint(this);
  };
  W.CopperMinnow={bodies,conversations};
}());
