(function () {
  'use strict';
  const W=window.OW,A=W.TownActivities,{venues,lantern:L,rail:Y,quarry:Q,bay:F,wind:K,clamp}=A;
  const G=W.Game.prototype,U=W.UI.prototype,R=W.Renderer.prototype;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const imageCache=new Map(),prefix=()=>((W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/activities/');
  const url=id=>prefix()+id+'.webp';
  function image(id){if(!imageCache.has(id)){const img=new Image();img.src=url(id);imageCache.set(id,img);}const im=imageCache.get(id);return im.complete&&im.naturalWidth?im:null;}
  const fresh=()=>({version:1,starts:0,tier:0,yard:1,trophies:[],journal:{},stock:[[],[]],commission:false,
    catchRecords:[0,0],weightRecords:[0,0],boardWins:[0,0],kiteBest:0,railBest:0,rounds:0,interrupted:null});
  function record(g){return g.activityBook||(g.activityBook=fresh());}
  const {safe,venuesIn}=A;
  const near=(g,p)=>venuesIn(g.world).find(l=>dist(p,l)<78);
  const interact=G.interact;
  G.interact=function(p){
    const l=!this.paused&&!p.downed&&near(this,p);
    if(l&&!this.players.some(q=>q!==p&&q.downed&&dist(p,q)<100)){return this.openTownActivity(l.activity,p.id);}
    return interact.apply(this,arguments);
  };
  const missions=G.updateMissions;G.updateMissions=function(dt){
    const result=missions.call(this,dt);
    for(const p of this.players){const l=near(this,p);if(l){this.interactionPrompt=(this.input?.actionLabel?.(p.id,'interact')||'Interact')+' · '+l.name;break;}}
    return result;
  };
  const terrain=R.drawTerrain;
  R.drawTerrain=function(w){
    const result=terrain.apply(this,arguments);
    for(const l of venuesIn(w)){
      if(!this.visible(l.x,l.y,150))continue;
      const v=venues.find(v=>v.id===l.activity),c=this.ctx,im=image(v.id),x=l.x,y=l.y;
      c.save();c.shadowColor='#18322c';c.shadowBlur=4;c.fillStyle='#623d2b';c.fillRect(x-3,y-48,7,51);
      c.fillStyle='#63503c';c.strokeStyle=v.color;c.lineWidth=2;c.fillRect(x-37,y-63,74,44);c.strokeRect(x-37,y-63,74,44);
      if(im)c.drawImage(im,x-34,y-60,68,38);
      c.font='bold 20px Georgia';c.textAlign='center';c.strokeStyle='#172d31';c.lineWidth=4;c.strokeText(v.icon,x,y-24);c.fillStyle='#fff1cb';c.fillText(v.icon,x,y-24);
      c.restore();if(this.game.players.some(p=>dist(p,l)<205))this.worldLabel(v.name,x,y+18,v.color,13);
    }
    return result;
  };
  const map=U.drawMapLabels;U.drawMapLabels=function(c,sx,sy){
    const result=map.apply(this,arguments),w=this.game.world;
    for(const l of venuesIn(w)){
      const v=venues.find(v=>v.id===l.activity),t=w.getLocation('town_'+v.town);
      if(!this.locationKnown(t)&&!this.locationKnown(l))continue;
      const x=l.x*sx,y=l.y*sy;c.save();c.fillStyle='#172a2d';c.fillRect(x-7,y-8,14,15);c.fillStyle=v.color;c.textAlign='center';c.font='bold 13px Georgia';c.fillText(v.icon,x,y+4);c.restore();
    }return result;
  };
  function returnPoint(g,id){
    const l=venuesIn(g.world).find(l=>l.activity===id);if(!l)return;
    const t=g.world.getLocation('town_'+venues.find(v=>v.id===id).town);
    g.players.forEach((p,i)=>{const q=safe(g.world,t,{x:l.x+(i?21:-21),y:l.y+24});p.x=q.x;p.y=q.y;});
    g.camera.x=g.players[0].x;g.camera.y=g.players[0].y;
    g.travelInteractUntil=(g.time||0)+.7;
  }
  const snap=G.snapshot;G.snapshot=function(){const s=snap.apply(this,arguments);s.townActivities=JSON.parse(JSON.stringify(record(this)));return s;};
  const load=G.load;G.load=function(slot=0){
    const data=W.Save.read(slot);if(!data)return false;
    const prev=this.activityBook,session=this.activity;this.activity=null;
    this.activityBook=Object.assign(fresh(),data.townActivities||{});
    let ok=false;try{ok=load.apply(this,arguments);}finally{if(!ok){this.activityBook=prev;this.activity=session;}}
    if(ok&&record(this).interrupted){
      const id=record(this).interrupted;returnPoint(this,id);record(this).interrupted=null;
      this.ui.toast('Back at the venue entrance. Completed catches, payouts and records are in your book.');this.save(false);
    }return ok;
  };
  const start=G.start;G.start=function(opts={}){
    if(!opts.load){this.activityBook=fresh();this.activity=null;}
    return start.apply(this,arguments);
  };
  G.openTownActivity=function(id,owner=0){
    const venue=venues.find(v=>v.id===id),l=venuesIn(this.world).find(l=>l.activity===id);
    if(!venue||!l||!this.players[owner]||dist(this.players[owner],l)>=78||this.players.some(p=>p.downed))return false;
    const a=this.activity={id,venue,owner,phase:'lobby',cursor:0,selected:null,boardCursor:[0,24],railCursor:[0,3],seatCount:this.players.length,controls:[{},{}],requiredPads:[],mode:'',choice:'',heat:0,lastTick:performance.now()};
    for(const pad of this.input.connectedPads()){const seat=this.input.padAssignments.get(pad.index);if(seat!=null&&seat<this.players.length)a.requiredPads.push(seat);}
    this.world.discovered.add(l.id);
    this.ui.showMenu('town-activity',owner);return true;
  };
  function quit(ui){
    const g=ui.game,a=g.activity;if(!a)return;
    returnPoint(g,a.id);record(g).interrupted=null;g.activity=null;ui.hideMenu();g.input.clear();g.save(false);
  }
  function lobby(ui){
    const a=ui.game.activity;a.phase='lobby';a.state=null;a.cursor=0;a.selected=null;a.controls=[{},{}];a.paused=false;
    record(ui.game).interrupted=null;ui.game.save(false);ui.render();
  }
  function settle(ui){
    const g=ui.game,a=g.activity,s=a.state,r=record(g),copy=v=>JSON.parse(JSON.stringify(v));
    if(a.banked)return;
    const previous=copy(r),heroes=[...g.players,...(g.reservePlayer?[g.reservePlayer]:[])];
    const balances=heroes.map(p=>({gold:p.gold,inventory:copy(p.inventory)}));
    const metrics={mode:a.mode,practice:a.mode==='practice'},eligible=g.players.map(p=>p.id);
    let participants=eligible;
    if(!metrics.practice){
      r.rounds++;
      if(a.id==='lantern'){
        const boardSeat=seat=>a.solo?(seat===0?a.owner:null):seat;
        metrics.signals=[0,0];for(let seat=0;seat<2;seat++){const hero=boardSeat(seat);if(hero!=null)metrics.signals[hero]=s.score[seat];}
        metrics.winner=s.winner<0?null:boardSeat(s.winner);participants=metrics.winner==null?[]:[metrics.winner];
        if(metrics.winner!=null&&['ai1','ai2','ai3','versus'].includes(a.mode))r.boardWins[metrics.winner]++;
      }else if(a.id==='quarry'){
        Object.assign(metrics,{tier:s.tier,won:s.won});
        if(s.won){r.tier=Math.max(r.tier,Math.min(3,s.tier+1));if(!r.trophies.includes(s.tier))r.trophies.push(s.tier);g.players.forEach(p=>p.gold+=Q.bouts[s.tier].pay);}
        else participants=[];
      }else if(a.id==='bay'){
        metrics.lines=s.lines.map(l=>({count:l.bag.length,bestThree:F.bestThree(l.bag)}));
        if(s.limit)metrics.winner=s.winner;participants=s.vsAI?[0]:eligible;
        for(const seat of participants){
          const line=metrics.lines[seat];if(!line)continue;
          if(a.mode==='fish')r.catchRecords[seat]=Math.max(r.catchRecords[seat],line.count);
          r.weightRecords[seat]=Math.max(r.weightRecords[seat],line.bestThree);
        }
      }else if(a.id==='yard'){
        Object.assign(metrics,{level:s.level,deliveries:s.cars.filter(c=>c.done).length,crashes:s.crashes,beats:s.beat});
        r.yard=Math.max(r.yard,Math.min(3,s.level+1));r.railBest=Math.max(r.railBest,150-s.beat*2-s.crashes*15);
      }else if(a.id==='wind'){
        metrics.heats=[];metrics.heats[a.mode==='heats'?1:a.owner]={rings:s.stage,penalty:s.penalty,time:s.time+s.penalty};
        if(a.firstRun)metrics.heats[0]=a.firstRun;
        const t=s.time+s.penalty;r.kiteBest=Math.min(r.kiteBest||Infinity,t,a.firstHeat||Infinity);
        participants=a.mode==='heats'?(Math.abs(a.firstHeat-t)<.01?[]:[a.firstHeat<t?0:1]):[a.owner];
      }
    }
    const rewards=W.ActivityMastery?.settle(g,a.id,metrics,participants)||[];
    if(g.save(false)){a.banked=true;a.detail=a.baseDetail+(rewards.length?' '+rewards.join(' · ')+'.':'');}
    else {
      g.activityBook=previous;heroes.forEach((p,i)=>Object.assign(p,balances[i]));
      a.detail='Could not bank the result. Retry saving to collect this round’s rewards.';a.cursor=0;
    }
  }
  function finish(ui,title,detail){
    const a=ui.game.activity;if(a.phase!=='play')return;
    a.phase='result';a.title=title;a.baseDetail=detail;a.detail=detail;a.cursor=0;a.banked=false;
    settle(ui);ui.render();
  }
  const names=['Bellkeeper Nettle','Carver Briar','Mouse tactician Pipkin'];
  function choices(ui){
    const g=ui.game,a=g.activity,r=record(g),two=a.seatCount===2;
    if(a.phase==='pause')return [['resume','Continue round'],['lobby','End round at venue'],['leave','Return to town']];
    if(a.phase==='result'&&!a.banked)return [['bank','Retry saving result'],['leave','Leave unbanked result']];
    if(a.phase==='result')return [['rematch',a.id==='lantern'?'Rematch · switch first seat':'Replay'],['lobby','Visit venue board'],['leave','Return to town']];
    const base=[['practice','Practice · no stakes']];
    if(a.id==='lantern')base.push(...names.map((n,i)=>['ai'+(i+1),n]),['deny','Opening study · deny the Signal'],['secure','Opening study · shove to hold two'],...(two?[['versus','Local head-to-head']]:[]));
    if(a.id==='quarry'){
      base.push(...Q.bouts.slice(0,Math.min(4,r.tier+1)).map((b,i)=>['bout'+i,b.name+' · '+b.pay+' coins per hero · '+b.roster.join(' + ')]));
      base.push(['gear','Visit equipment'],['trophies','Trophy wall · '+r.trophies.length+' / 4']);
    }
    if(a.id==='bay'){
      base.push(['fish',two?'Catch challenge · P1 vs P2':'Catch challenge · race Lark'],['commission-fish',two?'Fish together for Lark':'Fish for Lark'],...(two?[['weigh','Local best-three weigh-in']]:[]),['assist','Hold-to-reel assist · '+(r.assist?'on':'off')],['market','Sell all landed fish'],['commission',r.commission?'Lark’s commission · delivered':'Lark’s commission · 3 species'],['journal','Catch journal']);
    }
    if(a.id==='yard')base.push(...['Morning parcels','Cross-platform shift','Night freight'].slice(0,r.yard).map((n,i)=>['rail'+(i+1),n+(two?' · two switch banks':'')]));
    if(a.id==='wind')base.push(['race','Six-ring time trial'],...(two?[['heats','Two equal heats']]:[]),['ghost','First heat ghost · '+(r.ghost===false?'off':'on')]);
    return [...base,['leave','Return to town']];
  }
  function gear(g,p){
    const weapon=g.weapon(p)||{};return {hp:clamp((p.maxHp||140)*.5,64,150),power:clamp(6+(weapon.damage||10)*.21+(p.upgrade||0)*1.3,8,24),
      cadence:clamp((weapon.fireRate||.4),.22,.64),reach:clamp((weapon.range||600)/17,18,52)};
  }
  function begin(ui,key){
    const g=ui.game,a=g.activity,r=record(g),practice=key==='practice';
    if(key==='bank'){settle(ui);return ui.render();}
    if(key==='leave')return quit(ui);
    if(key==='lobby')return lobby(ui);
    if(key==='resume'){a.phase='play';a.controls=[{},{}];a.lastTick=performance.now();return ui.render();}
    if(key==='rematch'){return begin(ui,a.choice);}
    if(key==='gear'){quit(ui);ui.showMenu('inventory',a.owner);return;}
    if(key==='ghost'||key==='assist'){r[key]=key==='ghost'?r.ghost===false:!r.assist;g.save(false);return ui.render();}
    if(key==='market'){
      const bags=r.stock.map(b=>[...b]),balances=g.players.map(p=>p.gold);let total=0;
      g.players.forEach((hero,i)=>{const pay=r.stock[i].reduce((n,f)=>n+Math.round(f.weight*F.species[f.id][3]),0);total+=pay;hero.gold+=pay;r.stock[i]=[];});
      a.note=total?'Fish sold for '+total+' coins, paid to each angler.':'Bring a catch to the fish market.';
      if(total&&!g.save(false)){r.stock=bags;g.players.forEach((p,i)=>p.gold=balances[i]);a.note='Could not save the sale. Your fish are still in their baskets.';}return ui.render();
    }
    if(key==='commission'){
      const count=Object.keys(r.journal).length;
      if(!r.commission&&count>=3){r.commission=true;g.players.forEach(p=>p.gold+=60);if(!g.save(false)){r.commission=false;g.players.forEach(p=>p.gold-=60);a.note='Could not bank your commission. Return to Lark to try again.';return ui.render();}a.note='Lark hangs three painted floats on the market rack. Each hero earns 60 coins.';}
      else a.note=r.commission?'Lark’s marked floats are on display.':'Show Lark three different species. '+count+' / 3 discovered. The inlet holds striped wrasse.';return ui.render();
    }
    if(key==='journal'){
      const catches=Object.entries(r.journal).map(([id,w])=>F.species[id][0]+' · '+w.toFixed(2)+' kg');
      const records=g.players.map(p=>'P'+(p.id+1)+' best race '+r.catchRecords[p.id]+' fish · best three '+r.weightRecords[p.id].toFixed(2)+' kg');
      a.note=[catches.join(' / ')||'Empty catch journal. Try the beginner dock.',...records].join('　|　');return ui.render();
    }
    if(key==='trophies'){a.note=r.trophies.map(i=>Q.bouts[i].name).join(' / ')||'The trophy shelf awaits its first chalk crest.';return ui.render();}
    Object.assign(a,{phase:'play',choice:key,mode:practice?'practice':key,selected:null,seatCount:g.players.length,controls:[{},{}],note:'',heat:0,firstHeat:null,firstRun:null,ghostTrail:null,aiWait:.48,moveFlash:null,lastTick:performance.now()});
    if(a.id==='lantern'){
      const puzzle=practice?'deny':['deny','secure'].includes(key)?key:'';
      const first=puzzle||practice?0:r.starts%2;if(!puzzle&&!practice)r.starts++;
      a.state=L.board(first,puzzle);a.boardCursor=[0,24];a.solo=key!=='versus';a.level=Number(key.slice(2))||1;
      a.zoomUntil=performance.now()+650;a.shatters=[];a.boardFinal=0;a.note=puzzle==='deny'?'Pipkin holds two lanterns. Remove a rival from one before the turn ends.':puzzle?'Shove a rival and secure two lanterns in a single turn.':'Select a piece, then a marked destination.';
    }else if(a.id==='quarry'){
      const tier=practice?0:Number(key.slice(4));a.state=Q.duel(tier,g.players.map(p=>gear(g,p)),practice);
    }else if(a.id==='bay'){a.state=F.fishing(key,g.players.length===2,1);a.state.assist=!!r.assist||practice;}
    else if(a.id==='yard'){a.state=Y.yard(practice?1:Number(key.slice(4)),g.players.length===2);a.railCursor=[0,3];}
    else a.state=K.kite(practice);
    r.interrupted=a.id;g.save(false);ui.render();
  }
  function boardMove(ui,m){
    const a=ui.game.activity,s=a.state;
    const after=L.play(s,m.i,m.to);if(!after)return;
    if(m.target!=null&&m.far<0){a.shatters.push({pos:s.pieces[m.target].at,side:s.pieces[m.target].side,at:performance.now()});}
    a.zoomUntil=0;
    a.state=after;a.selected=null;a.aiWait=.52;ui.game.audio.play('ui');
    a.note=m.i<0?'Forced pass.':(s.pieces[m.i].at<0?'Benched piece returns':s.pieces[m.i].kind)+' → '+L.coord(m.to)+(m.target!=null?' · shove '+(m.far<0?'to bench':L.coord(m.far)):'');
    if(after.over&&a.shatters.length){a.boardFinal=performance.now()+565;ui.render();}
    else if(after.over)finish(ui,s.puzzle?(after.winner===0?'Opening solved':'Try the opening again'):after.winner<0?'Draw':'Seat '+(after.winner+1)+' wins',s.puzzle?(after.winner===0?'The position meets the challenge.':'Look for a Warden beside a contested lantern.'):'Signals '+after.score.join(' – ')+' · '+after.turns[0]+' full rounds');
    else ui.render();
  }
  function boardSelect(ui,pos){
    const a=ui.game.activity,s=a.state,legal=L.moves(s),target=legal.find(m=>m.i===a.selected&&m.to===pos);
    if(target)return boardMove(ui,target);
    const index=s.pieces.findIndex(p=>p.side===s.side&&p.at===pos);
    a.selected=index>=0&&legal.some(m=>m.i===index)?index:null;ui.render();
  }
  function yardStep(ui,owner){
    const g=ui.game,a=g.activity,s=a.state;
    if(Y.dispatch(s,owner))a.cartMoved=performance.now();
    if(s.over){
      const score=Math.max(0,150-s.beat*2-s.crashes*15);
      return finish(ui,'Shift delivered','Three matching deliveries · '+s.beat+' beats · '+s.crashes+' conflicts · '+score+' points.');
    }
    ui.render();
  }
  const railLabels=['Leaf turnout','Wheel turnout','Star turnout','Platform router','Leaf stop','Wheel stop','Star stop'];
  function controls(ui,owner,act){
    const g=ui.game,a=g.activity;if(!a||a.disconnected||document.hidden)return;
    if(a.phase!=='play'){
      if(owner!==a.owner)return;
      const items=choices(ui);
      if(act==='back')return a.phase==='pause'?begin(ui,'resume'):a.phase==='result'?lobby(ui):quit(ui);
      if(act==='confirm')return begin(ui,items[a.cursor][0]);
      const dir=['up','left'].includes(act)?-1:['down','right'].includes(act)?1:0;
      if(dir){a.cursor=(a.cursor+dir+items.length)%items.length;ui.render();}return;
    }
    const s=a.state;
    if(act==='pause'){a.phase='pause';a.cursor=0;return ui.render();}
    if(act==='back'){
      if(a.id==='lantern'&&a.selected!=null&&(a.solo?owner===a.owner:owner===s.side)){a.selected=null;return ui.render();}
      if(owner===a.owner){a.phase='pause';a.cursor=0;ui.render();}return;
    }
    if(a.id==='lantern'){
      if(a.solo?(owner!==a.owner||s.side===1):owner!==s.side)return;
      const seat=s.side,pos=a.boardCursor[seat],x=pos%5,y=Math.floor(pos/5);
      if(act==='confirm')return boardSelect(ui,pos);
      if(act==='extra'){
        const bench=s.pieces.flatMap((p,i)=>p.side===seat&&p.at<0?[i]:[]);
        if(bench.length){a.selected=bench[(bench.indexOf(a.selected)+1)%bench.length];a.boardCursor[seat]=seat?20:0;a.note='Return '+s.pieces[a.selected].kind+' to an empty home square.';}
        else if(L.moves(s)[0]?.i===-1)return boardMove(ui,{i:-1,to:-1});
      }else a.boardCursor[seat]=clamp(x+Number(act==='right')-Number(act==='left'),0,4)+5*clamp(y+Number(act==='down')-Number(act==='up'),0,4);
      return ui.render();
    }
    if(a.id==='yard'){
      if(!s.coop&&owner!==a.owner)return;
      const bank=s.coop?owner:0,min=s.coop&&bank?3:0,max=s.coop&&!bank?2:6;
      if(act==='confirm')Y.switchYard(s,bank,a.railCursor[bank]);
      if(['left','up','right','down'].includes(act))a.railCursor[bank]=min+((a.railCursor[bank]-min+(act==='left'||act==='up'?-1:1)+max-min+1)%(max-min+1));
      if(act==='extra')return yardStep(ui,bank);
      if(act==='rewind')Y.rewind(s);
      return ui.render();
    }
    if(a.id==='bay'){
      const l=s.lines[owner];if(!l||s.vsAI&&owner===1)return;
      if(l.state==='ready'&&(act==='left'||act==='right'))l.aim=clamp(l.aim+(act==='right'?1:-1),0,2);
      if(act==='confirm')F.cast(s,owner);
      if(act==='extra'&&owner===a.owner&&!s.limit)return finish(ui,'Back at the fish market','Landed fish are ready to sell. Visit the catch journal to see personal bests.');
    }
    if(a.id==='quarry'&&act==='extra')a.controls[owner].evade=true;
  }
  function advance(ui,dt){
    const g=ui.game,a=g.activity,s=a.state;
    if(a.id==='lantern'&&a.boardFinal){if(performance.now()>=a.boardFinal){a.boardFinal=0;finish(ui,s.winner<0?'Draw':'Seat '+(s.winner+1)+' wins','Signals '+s.score.join(' – ')+' · '+s.turns[0]+' full rounds');}return;}
    if(a.id==='lantern'&&a.solo&&s.side===1&&(a.aiWait-=dt)<=0){
      const m=L.choose(s,a.level);if(m)boardMove(ui,m);
    }else if(a.id==='bay'){
      const before=s.lines.map(l=>l.state),caught=F.fishTick(s,dt,a.controls.map(c=>c.hit));
      s.lines.forEach((l,seat)=>{if(before[seat]!=='bite'&&l.state==='bite'&&!(s.vsAI&&seat===1)){
        g.audio.play('ui');if(g.settings?.vibration!==false){const pad=g.input.connectedPads().find(p=>g.input.padAssignments.get(p.index)===seat);pad?.vibrationActuator?.playEffect?.('dual-rumble',{duration:85,strongMagnitude:.12,weakMagnitude:.18})?.catch?.(()=>{});}
      }});
      for(const fish of caught){
        g.audio.play('pickup');if(a.mode==='practice'||s.vsAI&&fish.seat===1)continue;
        const r=record(g);r.journal[fish.id]=Math.max(r.journal[fish.id]||0,fish.weight);r.stock[fish.seat].push({id:fish.id,weight:fish.weight});
      }
      if(caught.some(f=>!s.vsAI||f.seat===0)&&a.mode!=='practice')g.save(false);
      if(caught.length&&a.mode==='practice')return finish(ui,'First fish landed','Lark records your practice cast. Enter the catch challenge or visit the bay to keep your fish.');
      if(s.over){
        const weigh=s.mode==='weigh',values=s.lines.map(l=>weigh?Math.round(F.bestThree(l.bag)*100):l.bag.length),[p,q]=values;
        s.winner=p===q?-1:p>q?0:1;
        const other=s.vsAI?'Lark':'Player 2',name=s.winner===0?'Player 1':other;
        finish(ui,s.winner<0?'Fishing draw':name+' wins',weigh?'Best three per angler · '+values.map(n=>(n/100).toFixed(2)+' kg').join(' / '):'Player 1 caught '+p+' · '+other+' caught '+q+'. Landed fish are ready at the market.');
      }
    }else if(a.id==='quarry'){
      Q.tick(s,dt,a.controls);a.controls.forEach(c=>c.evade=false);
      if(s.over){
        const b=Q.bouts[s.tier];
        finish(ui,s.won?'Bout won':'Back at the gate',s.won?(s.practice?'Chalk lesson complete.':b.pay+' coins banked for each hero · '+b.name+' crest earned.'):'Your earlier earnings are banked. Enter again from the gate.');
      }
    }else if(a.id==='wind'){
      const seat=a.mode==='heats'?a.heat:a.owner,c=a.controls[seat];
      K.fly(s,dt,c.x||0,c.hit);
      if(s.finished){
        const t=s.time+s.penalty,r=record(g);
        if(a.mode==='heats'&&!a.heat){a.firstHeat=t;a.firstRun={rings:s.stage,penalty:s.penalty,time:t};a.ghostTrail=s.trail;a.heat=1;a.state=K.kite();a.phase='handoff';a.cursor=0;ui.render();return;}
        finish(ui,a.mode==='heats'?(Math.abs(a.firstHeat-t)<.01?'Dead heat':'Player '+(a.firstHeat<t?1:2)+' wins'):'Finish pennant reached',a.mode==='heats'?'P1 '+a.firstHeat.toFixed(1)+' s · P2 '+t.toFixed(1)+' s':t.toFixed(1)+' s · '+s.penalty+' s in penalties');
      }
    }
  }
  function line(c,x,y,tx,ty,color,width=2){
    c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function circle(c,x,y,r,color,stroke=false){
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(stroke){c.strokeStyle=color;c.lineWidth=2;c.stroke();}else{c.fillStyle=color;c.fill();}
  }
  function text(c,txt,x,y,size=19,color='#f8ecd3',align='left'){
    c.save();c.font='600 '+size+'px Georgia';c.textAlign=align;c.fillStyle=color;c.shadowColor='#102223';c.shadowBlur=3;c.fillText(txt,x,y);c.restore();
  }
  function frameSprite(c,kind,row,col,x,y,w,h,flip=false){
    const atlas=W.ActivityFrames,rect=atlas?.[kind]?.[row]?.[col];
    if(!rect)return false;const im=image({fish:'fish-swim',shatter:'board-shatter',anglers:'anglers'}[kind]);if(!im)return false;
    c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}
    c.drawImage(im,...rect,x,y,w,h);c.restore();return true;
  }
  function piece(c,index,x,y,w,h=w){
    const im=image('venue-pieces');if(!im)return;
    const sw=im.width/4,sh=im.height/4;c.drawImage(im,index%4*sw,Math.floor(index/4)*sh,sw,sh,x,y,w,h);
  }
  function prop(c,index,x,y,w,h=w){const im=image('prop-'+index);if(im)c.drawImage(im,x,y,w,h);}
  function paintBoard(c,a){
    const s=a.state,ox=250,oy=28,size=79,legal=L.moves(s);
    text(c,'Cream · sun',28,62,23,'#f5d194');text(c,String(s.score[0]),52,119,50);text(c,'Indigo · diamond',690,62,22,'#afd0f7');text(c,String(s.score[1]),721,119,50);
    text(c,'Signals',33,146,17);text(c,'Signals',705,146,17);
    if(a.solo)piece(c,a.level===3?7:0,683,160,96);
    for(let i=0;i<5;i++){text(c,'ABCDE'[i],ox+i*size+size/2,oy-6,16,'#ffe1a5','center');text(c,String(i+1),ox-12,oy+i*size+size*.6,18,'#ffe1a5','right');}
    for(let p=0;p<25;p++){
      const x=ox+p%5*size,y=oy+Math.floor(p/5)*size,idx=s.pieces.findIndex(q=>q.at===p),unit=s.pieces[idx];
      box(c,x,y,size-2,size-2,(p%5+Math.floor(p/5))%2?'#573525df':'#ad805adf');
      if(L.lamps.includes(p)){
        box(c,x+2,y+2,size-6,size-6,unit?(unit.side?'#435878':'#b79759'):'#62705a');
        piece(c,3,x+size*.18,y+size*.1,size*.65);
        text(c,unit?(unit.side?'◆':'☀'):'○',x+8,y+21,17);
      }
      const move=legal.find(m=>m.i===a.selected&&m.to===p);
      if(move){c.strokeStyle='#b8f8d0';c.lineWidth=4;c.strokeRect(x+5,y+5,size-12,size-12);text(c,move.target!=null?'⇢':'•',x+size-14,y+19,17,'#e7ffbe','center');}
      if(unit){const shape={scout:0,warden:1,runner:2}[unit.kind];piece(c,shape+unit.side*4,x+9,y+6,size-18,size-13);}
      if(idx>=0&&idx===a.selected){c.strokeStyle='#efcf74';c.lineWidth=4;c.strokeRect(x+4,y+4,size-10,size-10);}
      if(p===a.boardCursor[s.side]){c.strokeStyle='white';c.lineWidth=3;c.setLineDash([6,4]);c.strokeRect(x+1.5,y+1.5,size-5,size-5);c.setLineDash([]);}
    }
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||W.game?.settings?.reducedMotion;
    a.shatters=a.shatters.filter(f=>performance.now()-f.at<560);
    for(const f of a.shatters){
      const frame=Math.min(5,Math.floor((performance.now()-f.at)/90)),x=ox+f.pos%5*size,y=oy+Math.floor(f.pos/5)*size;
      if(reduced){text(c,'Bench',x+size/2,y+size-7,15,'#ffdc92','center');continue;}
      if(!frameSprite(c,'shatter',f.side,frame,x-6,y-6,size+12,size+12)){
        c.save();c.globalAlpha=1-frame/6;for(let i=0;i<8;i++){const t=i*Math.PI/4;box(c,x+size/2+Math.cos(t)*frame*5,y+size/2+Math.sin(t)*frame*5,6,4,'#f3d5ab');}c.restore();
      }
    }
    const shove=legal.find(m=>m.i===a.selected&&m.to===a.boardCursor[s.side]&&m.target!=null);
    for(let seat=0;seat<2;seat++){text(c,'Bench',seat?693:32,300,18);const bench=s.pieces.filter(p=>p.side===seat&&p.at<0);if(!bench.length)text(c,'Empty',seat?693:32,329,16,'#c3c6ad');bench.forEach((p,i)=>piece(c,{scout:0,warden:1,runner:2}[p.kind]+seat*4,(seat?690:30)+(i%3)*41,309+Math.floor(i/3)*42,42));}
    text(c,shove?'Shove → '+(shove.far<0?'bench':L.coord(shove.far)):'Round '+(Math.min(...s.turns)+1)+' of 12',450,454,20,'#f9d78f','center');
  }
  function paintRail(c,a){
    const s=a.state,{dest,danger}=Y.forecast(s),xy=n=>[32+Y.nodes[n][0]*8.2,38+Y.nodes[n][1]*3.15];
    const segment=(n,to,color='#92896d',w=5)=>line(c,...xy(n),...xy(to),color,w);
    for(let i=0;i<3;i++){segment(i,i+3);segment(i+3,i+7);if(s.level===3&&i!==1){segment(i+3,i===0?13:14);segment(i===0?13:14,6);}else segment(i+3,6);segment(6,7+i);segment(7+i,10+i);}
    for(let i=0;i<3;i++){const [x,y]=xy(i+10),id=(i-(s.level-1)+3)%3;text(c,Y.stamps[id],x,y-24,20,'#ffe89e','center');}
    for(const [i,cart] of s.cars.entries()){
      let [x,y]=xy(cart.at);const prev=s.history?.cars[i];
      if(prev&&a.cartMoved){const f=clamp((performance.now()-a.cartMoved)/390,0,1),[px,py]=xy(prev.at);x=px+(x-px)*f;y=py+(y-py)*f;}
      if(cart.arrival>s.beat){text(c,'Due '+cart.arrival,x,y,16);continue;}
      const color=danger.includes(i)?'#ff8d78':'#afeeca';if(!cart.done&&dest[i]!==cart.at){c.setLineDash([9,5]);segment(cart.at,dest[i],color,4);c.setLineDash([]);}
      prop(c,8+i,x-24,y-25,48,44);
      if(cart.done){circle(c,x+18,y+5,4,'#d8ba85');line(c,x+18,y+9,x+18,y+19,'#b6c4a7',3);line(c,x+18,y+11,x+10,y+9,'#d0bc99',2);}text(c,cart.done?'✓':cart.held?'Ⅱ':'→',x,y+24,17,color,'center');
    }
    text(c,'Beat '+(s.beat+1)+'   ·   '+s.cars.filter(c=>c.done).length+' / 3 delivered',32,34,21);
    text(c,danger.length?'Collision forecast · hold one cart':'Routes clear',862,34,20,danger.length?'#ffad95':'#a6edd1','right');
    for(let i=0;i<7;i++){const x=26+i*122,focused=a.railCursor.slice(0,s.coop?2:1).includes(i),label=i<3?(s.switches[i]?'Via hub':'Direct'):i===3?['Upper','Middle','Lower'][s.switches[3]]:s.cars[i-4].held?'Hold':'Release';
      box(c,x,360,116,62,focused?'#886f41':'#263b34');text(c,railLabels[i],x+58,384,15,'#fff3cf','center');text(c,label,x+58,407,18,'#bdedd0','center');}
    text(c,s.coop?'West turnouts · P1 '+(s.ready[0]?'ready':'setting')+'     |     East platform and stops · P2 '+(s.ready[1]?'ready':'setting'):'Set turnouts and releases, then dispatch one beat.',450,452,17,'#e5d9be','center');
  }
  function paintFish(c,a){
    const s=a.state,count=s.lines.length,w=852/count;
    for(const [i,l] of s.lines.entries()){
      const left=24+i*w,margin=18,usable=w-2*margin,bank=left+(i?w-73:73),rodY=136;
      const point=f=>({x:left+margin+f.x*usable,y:108+f.y*315});
      const facing=i===1,angler=facing&&s.vsAI?2:i===0?0:1;
      const pose=l.state==='cast'?(l.age<.23?1:2):l.state==='reel'||l.state==='land'?3:0;
      frameSprite(c,'anglers',angler,pose,bank-(facing?13:67),78,80,83,facing);
      const water=F.school(s,l),fish=water.find(f=>f.i===l.target),bobX=left+margin+(l.hook??(l.aim+.5)/3)*usable;
      const normalY=153+Math.sin(s.time*(l.state==='bite'?18:3))*(l.state==='bite'?9:2);
      const amount=l.state==='cast'?clamp(l.age/.62,0,1):1;
      const bx=bank+(bobX-bank)*amount,by=rodY+(normalY-rodY)*amount-Math.sin(Math.PI*amount)*78;
      if(i){line(c,left-1,91,left-1,360,'#c1dfcf88',1);}
      const name=s.vsAI&&i?'Lark · AI fisherman':'Player '+(i+1);
      box(c,left,8,w-5,66,'#10292de6');text(c,name,left+12,32,20,i?'#add7ff':'#ffe1a1');
      text(c,l.bag.length+' caught',left+w-15,32,21,'#fff2cf','right');
      text(c,F.docks[l.aim],left+12,57,16,'#d7e9db');
      text(c,s.mode==='weigh'?F.bestThree(l.bag).toFixed(2)+' kg':'',left+w-14,57,16,'#cfe4df','right');
      for(const f of water){
        const p=point(f),dep=F.species[f.id][4],fw=28+dep*9,fh=fw*.66;
        if(l.state==='land'&&f.i===l.target)continue;
        const fr=Math.floor(s.time*(5+dep)+f.i)%6;
        if(!frameSprite(c,'fish',dep,fr,p.x-fw/2,p.y-fh/2,fw,fh,f.flip))piece(c,8+dep,p.x-fw/2,p.y-fh/2,fw,fh);
      }
      if(l.state==='land'&&fish){
        const v=clamp(l.age,0,1),p=point(fish),fx=bobX+(bank-bobX)*v,fy=normalY-Math.sin(v*Math.PI)*81;
        const row=F.species[l.fish][4];if(!frameSprite(c,'fish',row,Math.min(5,Math.floor(v*6)),fx-24,fy-19,48,32,i===1))piece(c,8+row,fx-24,fy-19,48,32);
      }
      if(l.state==='ready'||l.state==='land'){
        const x=left+margin+(l.aim+.50)*usable/3;c.save();c.strokeStyle='#ffe9ad';c.setLineDash([4,4]);c.lineWidth=2;c.beginPath();c.ellipse(x,normalY,21,6,0,0,Math.PI*2);c.stroke();c.restore();
      }else{
        c.beginPath();c.moveTo(bank,rodY);c.quadraticCurveTo((bx+bank)/2,Math.min(rodY,by)-7+(l.state==='reel'?16*(1-l.tension):14),bx,by);c.lineWidth=1.7;c.strokeStyle=i?'#cde7ff':'#ffdfad';c.stroke();
        circle(c,bx,by,5,'#e36546');box(c,bx-3,by+1,6,4,'#fff4c9');
        c.save();c.translate(bx,by+5);c.scale(1,.28);circle(c,0,0,12+(s.time*10%9),'#c5ebe3',true);c.restore();
        if(l.state==='reel'&&fish){const p=point(fish);line(c,bx,by+4,p.x,p.y,'#f4efcf',1.5);}
      }
      box(c,left,368,w-5,75,'#0c262bed');text(c,l.state==='reel'?(l.pull?'▲ Heavy pull · ease off':'≈ Slack · reel now'):l.notice,left+12,391,17,l.pull&&l.state==='reel'?'#ffd397':'#ddf2dd');
      text(c,'Tension',left+12,411,14);box(c,left+82,401,w-107,8,'#506862');box(c,left+82,401,(w-107)*l.tension,8,l.tension>.72?'#fc9b71':'#93cba8');
      text(c,'Reeled in',left+12,431,14);box(c,left+82,422,w-107,7,'#506862');box(c,left+82,422,(w-107)*l.progress,7,'#f4c986');
    }
    text(c,s.limit?(s.mode==='weigh'?'Three heaviest fish':'Most fish wins')+'  ·  '+Math.ceil(Math.max(0,s.limit-s.time))+' s remaining':'Shellbreak fish market · landed catches go into each angler’s basket.',450,464,18,'#fff0c6','center');
  }
  function paintKite(c,a,g){
    const s=a.state,stage=Math.min(s.stage,5),cx=450,scale=330;
    box(c,45,28,810,391,'#24303972');
    c.save();c.strokeStyle='#e4bb8d';c.lineWidth=2;c.setLineDash([7,7]);for(const x of [cx-scale,cx+scale]){c.beginPath();c.moveTo(x,105);c.lineTo(x,412);c.stroke();}c.restore();
    for(let i=0;i<6;i++){const x=140+i*115,y=140+i%3*35;line(c,x,y,x+(s.gust||0)*26,y+Math.sin(s.time*3+i)*3,'#b7d8dfa5',2);}
    for(let k=stage;k<Math.min(stage+2,K.rings.length);k++){
      const gap=k+1-s.y,x=cx+K.rings[k]*scale,y=335-210*gap,rad=58;
      if(y<12)continue;c.save();c.translate(x,y);c.scale(1,.77);circle(c,0,0,rad,'#f0bc68',true);c.restore();text(c,String(k+1),x,y-43,23,'#fff1cf','center');
    }
    if(a.ghostTrail&&record(g).ghost!==false){const ghost=a.ghostTrail[Math.min(a.ghostTrail.length-1,Math.floor(s.time/.33))];if(ghost){c.save();c.globalAlpha=.4;prop(c,12,cx+ghost[1]*scale-28,310-(ghost[2]-s.y)*210,56,72);c.restore();}}
    const kx=cx+s.x*scale;prop(c,a.heat?13:12,kx-35,302,70,86);
    text(c,'Heat '+(a.heat+1)+'   ·   Ring '+(stage+1)+' / '+(s.practice?'1':'6'),54,57,22);
    text(c,(s.time+s.penalty).toFixed(1)+' s',840,57,24,'#ffe3a7','right');
    const wind=s.gust||0;text(c,Math.abs(wind)<.15?'Streamers hang still':wind<0?'◀ ◀   West gust':'East gust   ▶ ▶',450,95,21,'#d4eee8','center');
    text(c,s.last,58,440,19);text(c,'Line',600,440,16);box(c,652,427,176,12,'#4e5b57');box(c,652,427,176*s.tension,12,s.tension>.7?'#f6a368':'#a4d7ad');
  }
  function paintRing(c,a){
    const s=a.state,sx=7.8,sy=6.3,x0=60,y0=46;
    box(c,x0,y0,100*sx,61*sy,'#453b2bca');c.strokeStyle='#e0c695';c.lineWidth=3;c.strokeRect(x0,y0,100*sx,61*sy);
    c.save();c.translate(x0,y0);c.scale(sx,sy);
    for(const b of s.blocks){circle(c,b.x,b.y,b.r,'#78827b');}
    for(const e of s.foes.filter(e=>e.hp>0&&e.phase==='warning')){
      const m=e.mark,ink='#f9b877',fill='rgba(248,135,70,'+(.17+.3*(1-e.left/e.duration))+')';
      c.fillStyle=fill;c.strokeStyle=ink;c.lineWidth=.46;c.beginPath();
      if(m.kind==='stamp')c.arc(m.x,m.y,m.r,0,Math.PI*2);
      else if(m.kind==='sweep'){const theta=Math.atan2(m.dy,m.dx);c.moveTo(m.x,m.y);c.arc(m.x,m.y,m.r,theta-Math.PI/2,theta+Math.PI/2);c.closePath();}
      else{const px=-m.dy*m.r,py=m.dx*m.r;c.moveTo(m.x+px,m.y+py);c.lineTo(m.tx+px,m.ty+py);c.lineTo(m.tx-px,m.ty-py);c.lineTo(m.x-px,m.y-py);c.closePath();}
      c.fill();c.stroke();
    }
    for(const [i,p] of s.fighters.entries()){
      if(p.attack?.until>s.time)line(c,p.x,p.y,p.attack.x,p.attack.y,'#ffe49a',.3);
      circle(c,p.x,p.y,2.2,p.hp<=0?'#585750':i?'#9eccef':'#f3d397');
      piece(c,i?4:0,p.x-3,p.y-5,6,6);box(c,p.x-3,p.y+2.8,6,.6,'#566361');box(c,p.x-3,p.y+2.8,6*p.hp/p.max,.6,'#a8edba');
    }
    for(const e of s.foes.filter(e=>e.hp>0)){
      circle(c,e.x,e.y,e.role==='champion'?3.4:2.4,e.phase==='recovery'?'#95c6a4':'#bd785b');piece(c,e.role==='champion'?12:e.role==='guard'?5:e.role==='flanker'?6:7,e.x-3,e.y-5,6,6);
    }
    c.restore();for(const e of s.foes.filter(e=>e.hp>0))text(c,e.phase==='recovery'?'Opening':e.role==='champion'?'Slate-Ear':e.role,x0+e.x*sx,y0+e.y*sy-29,13,e.phase==='warning'?'#ffcf91':'#e5dcc6','center');
    text(c,Q.bouts[s.tier].name,63,34,22);text(c,s.foes.filter(e=>e.hp>0).length+' rivals in the ring',838,34,20,'#f8d4a2','right');
    text(c,'P1 '+Math.ceil(s.fighters[0].hp)+' HP'+(s.fighters[1]?'    ·    P2 '+Math.ceil(s.fighters[1].hp)+' HP':''),60,456,19);
  }
  function paint(ui){
    const a=ui.game.activity,canvas=ui.host.querySelector('canvas.activity-surface');if(!canvas||!a.state)return;
    const c=canvas.getContext('2d');c.clearRect(0,0,900,470);
    const im=image(a.id==='bay'?'fishing-water':a.id==='lantern'?'board-table':a.id)||image(a.id);if(im){const scale=Math.max(900/im.width,470/im.height),w=im.width*scale,h=im.height*scale;c.drawImage(im,(900-w)/2,(470-h)/2,w,h);}
    box(c,0,0,900,470,a.id==='bay'?'#12272818':a.id==='lantern'?'#12272854':'#12272886');
    if(a.id==='lantern')paintBoard(c,a);else if(a.id==='yard')paintRail(c,a);else if(a.id==='bay')paintFish(c,a);else if(a.id==='wind')paintKite(c,a,ui.game);else paintRing(c,a);
  }
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function instruction(a){
    if(a.id==='lantern')return 'Scout moves one in any direction. Runner goes one or two straight through empty cells. Warden steps or shoves one straight. A blocked shove fails. Shove off an edge to bench. Return one piece to your home row as a move.';
    if(a.id==='quarry')return Q.bouts[a.state?.tier||0].tip+' Hold strike to attack the nearest exposed opponent in range. The amber footprint locks before impact.';
    if(a.id==='bay')return (a.state?.mode==='fish'?'Catch the most fish before time expires. ':'')+'Left / right selects a dock. Cast and hook with Confirm. Hold Confirm to reel in slack water and release during pulls.';
    if(a.id==='yard')return 'Select a control and toggle it. Each cart keeps moving until held. A wrong platform loops back. Dotted tracks preview the next beat. In a shared yard both dispatchers must commit.';
    return 'Steer left and right. Hold Confirm to brace against gusts, release to ease tension. Line up the cloth kite inside each gold ring.';
  }
  function legend(ui,a){
    const pad=ui.game.input,usesPad=pad.connectedPads().length>0&&(pad.lastPadUse||0)>=(pad.lastKeyboard||0);
    const glyph=n=>usesPad?(pad.glyph?.(a.owner,n)||['A','B','X','Y'][n]):['Enter','Backspace','Space','R'][n];
    if(a.phase!=='play')return 'Direction · browse   /   '+glyph(0)+' · choose   /   '+glyph(1)+' · back';
    if(a.id==='lantern')return 'Direction · cursor   /   '+glyph(0)+' · select or move   /   '+glyph(2)+' · bench or forced pass   /   '+glyph(1)+' · cancel';
    if(a.id==='yard')return 'Direction · select   /   '+glyph(0)+' · set   /   '+glyph(2)+' · commit beat   /   '+glyph(3)+' · rewind';
    if(a.id==='bay')return 'Left / right · aim   /   '+glyph(0)+' · cast, hook or hold to reel   /   '+glyph(2)+' · finish free fishing';
    if(a.id==='quarry')return 'Stick / movement keys · move   /   '+glyph(0)+' · hold strike   /   '+glyph(2)+' · dodge';
    return 'Stick / left–right · steer   /   '+glyph(0)+' · brace line   /   '+glyph(1)+' · pause';
  }
  const render=U.render;
  U.render=function(){
    const g=this.game,a=g.activity;if(this.menu!=='town-activity'||!a||!this.isOpen)return render.apply(this,arguments);
    const play=a.phase==='play',disconnected=a.disconnected,hand=a.phase==='handoff',v=a.venue;
    const title=disconnected?'Controller disconnected':hand?'Pass the kite to Player 2':a.phase==='result'?a.title:a.phase==='pause'?'Round paused':v.name;
    const s=a.state,side=play&&a.id==='lantern'?(s.side===0?'Cream · sun':'Indigo · diamond')+' to move'+(a.solo&&s.side===1?' · '+names[a.level-1]:' · P'+((a.solo?a.owner:s.side)+1)):null;
    let desc=disconnected?'The round is paused. Reconnect the missing controller to restore its seat.':hand?'Same wind, same gates. Player 2 starts when ready.':a.phase==='result'?a.detail:a.phase==='pause'?'Return to the same position or finish your visit.':play?instruction(a):v.rule;
    const items=hand?[['second','P2 · launch second heat']]:choices(this);
    const buttons=items.map(([id,name],i)=>'<button type="button" data-venue-choice="'+id+'" class="'+(i===a.cursor?'is-current':'')+'">'+escape(name)+'</button>').join('');
    const mastery=W.ActivityMastery?.description(a.id)||'';
    const rack=a.id==='quarry'&&record(g).trophies.length?'<aside class="venue-trophies" aria-label="First-clear crests">'+record(g).trophies.map(i=>'<img src="'+escape(url('prop-15'))+'" alt="'+escape(Q.bouts[i].name)+' crest">').join('')+'</aside>':'';
    const painted='<div class="activity-postcard"><img alt="'+escape(v.place)+'" src="'+escape(url(a.id))+'"><div><small>'+escape(v.place)+'</small><strong>'+escape(v.host)+'</strong></div>'+rack+'</div>';
    const book=record(g);
    const boardRecord=a.id==='lantern'&&a.phase==='lobby'&&book.boardWins.some(Boolean)?g.players.map(p=>'P'+(p.id+1)+' · '+book.boardWins[p.id]+' match wins').join(' / '):'';
    const note=a.note||boardRecord||((a.id==='wind'&&book.kiteBest)?'Course best · '+book.kiteBest.toFixed(1)+' s':a.id==='yard'&&book.railBest?'Best shift · '+book.railBest+' points':'');
    this.host.innerHTML='<div class="menu-layer venue-layer"><section role="dialog" aria-modal="true" aria-label="'+escape(v.name)+'" class="activity-panel'+(a.zoomUntil>performance.now()&&!g.settings?.reducedMotion?' activity-zoom':'')+'" style="--venue-color:'+v.color+'"><header><div><small>'+escape(v.place)+'　/　'+escape(v.time)+'</small><h2>'+escape(title)+'</h2></div><button data-venue-choice="'+(play?'pause':'leave')+'">'+(play?'Pause':'Return to town')+'</button></header>'+
      (play&&!disconnected?'<div class="activity-turn">'+escape(side||((a.seatCount===2?'P1 + P2':'P'+(a.owner+1))+' · '+(a.mode==='practice'?'Practice':v.name)))+'</div><canvas class="activity-surface" width="900" height="470" aria-label="'+escape(v.name)+' play area"></canvas>':
        '<div class="activity-lobby">'+painted+'<div class="activity-choices"><p>'+escape(desc)+'</p>'+(!disconnected&&!hand&&a.phase==='lobby'&&mastery?'<p class="activity-note">'+escape(mastery)+'</p>':'')+(disconnected?'':buttons)+'</div></div>')+
      (play&&!disconnected?'<div class="activity-guide">'+escape(desc)+'</div>'+pointerButtons(a):'')+
      (note&&!disconnected?'<div class="activity-note">'+escape(note)+'</div>':'')+
      '<footer>'+escape(legend(this,a))+(a.seatCount===2?' <span>Keyboard · P1 WASD / Enter / Space　 P2 arrows / Num Enter / Num 0</span>':'')+'</footer></section></div>';
    if(play)paint(this);else this.host.querySelector('.is-current')?.scrollIntoView?.({block:'nearest'});
  };
  function pointerButtons(a){
    const seats=a.id==='lantern'?[a.solo?a.owner:a.state.side]:a.id==='wind'?[a.mode==='heats'?a.heat:a.owner]:Array.from({length:a.seatCount},(_,i)=>i);
    const labels=a.id==='yard'?[['left','Previous'],['right','Next'],['confirm','Set'],['extra','Dispatch'],['rewind','Rewind']]:a.id==='lantern'?[['extra','Bench / pass'],['back','Cancel']]:a.id==='quarry'?[['left','←'],['up','↑'],['down','↓'],['right','→'],['confirm','Strike'],['extra','Dodge']]:a.id==='bay'?[['left','← Dock'],['right','Dock →'],['confirm','Cast / reel'],...(a.state.limit?[]:[['extra','Finish']])]:[['left','←'],['right','→'],['confirm','Brace']];
    return '<div class="activity-actions">'+seats.map(n=>'<div><b>P'+(n+1)+'</b>'+labels.map(([id,label])=>'<button data-venue-input="'+id+'" data-seat="'+n+'">'+label+'</button>').join('')+'</div>').join('')+'</div>';
  }
  const click=U.click;
  U.click=function(e){
    const a=this.game.activity;if(this.menu!=='town-activity'||!a)return click.apply(this,arguments);
    const button=e.target.closest('button'),key=button?.dataset.venueChoice;
    if(a.disconnected&&key!=='leave')return;
    if(a.phase==='handoff'&&key==='second'){a.phase='play';a.lastTick=performance.now();return this.render();}
    if(key==='pause')return controls(this,a.owner,'pause');
    if(key)return begin(this,key);
    if(button?.dataset.venueInput){controls(this,Number(button.dataset.seat),button.dataset.venueInput);return;}
    if(a.phase==='play'&&a.id==='lantern'&&e.target.matches('canvas')&&(!a.solo||a.state.side===0)){
      const bounds=e.target.getBoundingClientRect(),x=Math.floor(((e.clientX-bounds.left)*900/bounds.width-250)/79),y=Math.floor(((e.clientY-bounds.top)*470/bounds.height-28)/79);
      if(x>=0&&x<5&&y>=0&&y<5){a.boardCursor[a.state.side]=y*5+x;boardSelect(this,y*5+x);}
    }
  };
  function pointer(e,down){
    const g=W.game,a=g?.activity;if(!a||g.ui.menu!=='town-activity')return;
    const b=e.target.closest?.('[data-venue-input]');
    if(!down){a.pointer={};return;}
    if(!b||a.phase!=='play')return;a.pointer={seat:Number(b.dataset.seat),act:b.dataset.venueInput};b.setPointerCapture?.(e.pointerId);
  }
  window.addEventListener('pointerdown',e=>pointer(e,true));window.addEventListener('pointerup',e=>pointer(e,false));window.addEventListener('pointercancel',e=>pointer(e,false));
  function dir(input,index,held,pad){
    const profile=input.padProfile?.(index),swapped=profile?.sticks==='swap'||profile?.sticks==='inherit'&&input.padBindings.swapSticks,offset=swapped?2:0;
    const x=pad.axes[offset]||0,y=pad.axes[offset+1]||0,dz=profile?.deadzone||.18;
    return {x:held[14]?-1:held[15]?1:Math.abs(x)>dz?x:0,y:held[12]?-1:held[13]?1:Math.abs(y)>dz?y:0};
  }
  function feed(ui,a,owner,act){
    if(a.phase==='handoff'){if(owner===1&&act==='confirm'){a.phase='play';a.lastTick=performance.now();ui.render();}return;}
    controls(ui,owner,act);
  }
  const oldPad=U.handleCoopPadInput;
  U.handleCoopPadInput=function(input,pad,edge,held,owner,blocked){
    const a=this.game.activity;if(!a||this.menu!=='town-activity')return oldPad?.apply(this,arguments);
    if(owner>=a.seatCount)return true;
    if(!a.requiredPads.includes(owner)&&held.some(Boolean))a.requiredPads.push(owner);
    const axis=dir(input,owner,held,pad);
    a.controls[owner].pad={...axis,hit:held[0]};
    const d=axis.y<-.5?'up':axis.y>.5?'down':axis.x<-.5?'left':axis.x>.5?'right':'';
    const t=performance.now(),repeat=input.padMenuRepeat.get(pad.index)||{dir:'',next:0};
    if(d&&(repeat.dir!==d||t>repeat.next)){feed(this,a,owner,d);repeat.next=t+(d===repeat.dir?145:310);}repeat.dir=d;input.padMenuRepeat.set(pad.index,repeat);
    const keys=[[0,'confirm'],[1,'back'],[2,'extra'],[3,'rewind'],[9,'pause']];
    for(const [n,act] of keys)if(edge[n]){feed(this,a,owner,act);break;}
    return true;
  };
  const oldKeyboard=U.handleCoopKeyboardInput;
  U.handleCoopKeyboardInput=function(input){
    const a=this.game.activity;if(!a||this.menu!=='town-activity')return oldKeyboard?.apply(this,arguments);
    const keys=input.keys,snapshot=input.snapshot;
    for(let seat=0;seat<a.seatCount;seat++){
      const code=d=>input.bindings[(seat?'p2':'')+d],extra=seat?'Numpad0':'Space',ok=seat?'NumpadEnter':'Enter',back=seat?'NumpadSubtract':'Backspace';
      const key=(d,k)=>keys.has(code(d))||a.seatCount===1&&keys.has(k);
      const c=a.controls[seat],p=c.pad||{},pointer=a.pointer?.seat===seat?a.pointer.act:'';
      c.x=p.x||Number(key('right','ArrowRight')||pointer==='right')-Number(key('left','ArrowLeft')||pointer==='left');c.y=p.y||Number(key('down','ArrowDown')||pointer==='down')-Number(key('up','ArrowUp')||pointer==='up');
      c.hit=!!(p.hit||keys.has(ok)||pointer==='confirm');c.pad=null;
      for(const d of ['left','right','up','down'])if(snapshot.has(code(d))||a.seatCount===1&&snapshot.has('Arrow'+d[0].toUpperCase()+d.slice(1)))feed(this,a,seat,d);
      for(const [k,action] of [[ok,'confirm'],[back,'back'],[extra,'extra'],[seat?'NumpadDecimal':'KeyR','rewind']])if(snapshot.has(k))feed(this,a,seat,action);
    }
    if(snapshot.has('Escape'))feed(this,a,a.owner,a.phase==='play'?'pause':'back');
    return true;
  };
  const oldUpdate=U.update;
  U.update=function(){
    const a=this.game.activity;if(this.menu!=='town-activity'||!this.isOpen||!a)return oldUpdate.apply(this,arguments);
    const input=this.game.input,connected=new Set(input.connectedPads().map(p=>input.padAssignments.get(p.index))),missing=a.requiredPads.some(seat=>!connected.has(seat));
    const now=performance.now(),dt=clamp((now-a.lastTick)/1000,0,.07);a.lastTick=now;
    if(Boolean(a.disconnected)!==missing){a.disconnected=missing;a.controls=[{},{}];this.render();}
    if(a.phase==='play'&&!missing&&!document.hidden){advance(this,dt);if(a.phase==='play')paint(this);}
  };
  W.ActivityVenues={venuesIn,open:(g,id,owner=0)=>g.openTownActivity(id,owner)};
}());
