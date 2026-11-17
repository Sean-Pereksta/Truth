/* Rules shared by the venue, computer opponents and the regression suite. */
(function () {
  'use strict';
  const W = window.OW;
  const venues = [
    {id:'lantern',town:1,name:'Lantern Lines',place:'Bellkeeper’s Tea Room',host:'Bellkeeper Nettle',icon:'♜',color:'#eab866',time:'4–8 min',rule:'Hold two of the three lanterns at the start of your turn to score. First to four Signals, or highest after twelve rounds, wins after equal turns.'},
    {id:'quarry',town:2,name:'Quarry Ring',place:'Quarry amphitheater',host:'Announcer Flint',icon:'⚒',color:'#edb192',time:'1–3 min per bout',rule:'Enter the chalk ring. Move around cover, strike within reach and dodge the painted attack marks. Stand near a fallen partner to revive them.'},
    {id:'bay',town:9,name:'Shellbreak Bay',place:'Shellbreak fishing pier',host:'Netmaker Lark',icon:'≈',color:'#85ddd7',time:'2–4 min',rule:'Aim along the water, cast, then hook when the float dives. Reel to bring fish in and ease off while they pull. Lark buys catches and posts a three-species commission.'},
    {id:'yard',town:6,name:'Switchyard Dispatch',place:'Copper rail spur',host:'Dispatcher Soot',icon:'⇄',color:'#9cd7ac',time:'3–5 min',rule:'Deliver leaf, wheel and star cargo to their matching platforms. Set switches and releases, read the next-beat preview, then dispatch. One rewind per shift.'},
    {id:'wind',town:11,name:'Windpost Trial',place:'Sheltered launch',host:'Kitemaker Pip',icon:'◇',color:'#afc5fa',time:'2–4 min',rule:'Steer through six numbered rings. Hold the line through gusts and ease it before tension peaks. Cliff strikes restart at your last ring and add five seconds.'}
  ];
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const lamps=[10,12,14], kinds=['scout','warden','runner','scout'];
  const adjacent=[[0,1],[1,0],[0,-1],[-1,0]], diagonal=[...adjacent,[1,1],[1,-1],[-1,1],[-1,-1]];
  const inside=(x,y)=>x>=0&&x<5&&y>=0&&y<5;
  const coord=n=>'ABCDE'[n%5]+(1+Math.floor(n/5));
  const controller=(s,who)=>lamps.filter(pos=>s.pieces.some(p=>p.side===who&&p.at===pos)).length;
  function board(first=0,puzzle='') {
    const pieces=[];
    for(let side=0;side<2;side++)[0,1,3,4].forEach((at,i)=>pieces.push({side,kind:kinds[i],at:side?24-at:at}));
    const s={pieces,side:first,first,turns:[0,0],score:[0,0],over:false,winner:null,puzzle};
    if(puzzle==='deny'||puzzle==='secure'){
      const pos=puzzle==='deny'?[8,11,20,9,10,24,12,23]:[6,11,14,4,12,23,21,24];
      s.pieces.forEach((p,i)=>p.at=pos[i]);
    }
    return s;
  }
  function moves(s){
    const legal=[];
    if(s.over)return legal;
    const occupied=new Map(s.pieces.map((p,i)=>[p.at,i]).filter(([at])=>at>=0));
    s.pieces.forEach((p,i)=>{
      if(p.side!==s.side)return;
      if(p.at<0){
        for(let col=0;col<5;col++){const to=p.side?24-col:col;if(!occupied.has(to))legal.push({i,to});}
        return;
      }
      for(const [baseX,baseY] of p.kind==='scout'?diagonal:adjacent){
        const dx=p.side?-baseX:baseX,dy=p.side?-baseY:baseY;
        for(let n=1;n<=(p.kind==='runner'?2:1);n++){
          const x=p.at%5+dx*n,y=Math.floor(p.at/5)+dy*n;
          if(!inside(x,y))break;
          const at=y*5+x,target=occupied.get(at);
          if(target===undefined){legal.push({i,to:at});continue;}
          if(p.kind==='warden'&&s.pieces[target].side!==p.side){
            const far=inside(x+dx,y+dy)?(y+dy)*5+x+dx:-1;
            if(far<0||!occupied.has(far))legal.push({i,to:at,target,far});
          }
          break;
        }
      }
    });
    return legal.length?legal:[{i:-1,to:-1}];
  }
  function after(s,m){
    const next={...s,pieces:s.pieces.map(p=>({...p})),turns:[...s.turns],score:[...s.score]};
    if(m.i>=0){next.pieces[m.i].at=m.to;if(m.target!=null)next.pieces[m.target].at=m.far;}
    next.turns[next.side]++;
    if(s.puzzle){
      next.over=true;
      const solved=s.puzzle==='deny'?controller(next,1)<2:controller(next,0)>=2&&m.target!=null;
      next.winner=solved?0:1;
      return next;
    }
    if(next.turns[0]===next.turns[1]&&(Math.max(...next.score)>=4||next.turns[0]>=12)){
      next.over=true;next.winner=next.score[0]===next.score[1]?-1:Number(next.score[1]>next.score[0]);
    }else{
      next.side=1-next.side;
      if(controller(next,next.side)>=2)next.score[next.side]++;
    }
    return next;
  }
  function play(s,i,to){
    const m=moves(s).find(v=>v.i===i&&v.to===to);
    return m?after(s,m):null;
  }
  function evaluate(s,side){
    if(s.over)return s.winner===-1?0:s.winner===side?1000:-1000;
    let n=(s.score[side]-s.score[1-side])*35;
    for(const p of s.pieces){
      const sign=p.side===side?1:-1;
      if(p.at<0){n-=sign*4;continue;}
      const d=Math.min(...lamps.map(l=>Math.abs(l%5-p.at%5)+Math.abs(2-Math.floor(p.at/5))));
      n+=sign*((lamps.includes(p.at)?13:0)-d*1.2);
    }
    return n+10*(Number(controller(s,side)>=2)-Number(controller(s,1-side)>=2));
  }
  function choose(s,level=1){
    const side=s.side,depth=clamp(level,1,3);
    function search(pos,n,alpha,beta){
      if(!n||pos.over)return evaluate(pos,side);
      const max=pos.side===side;let best=max?-Infinity:Infinity;
      for(const move of moves(pos)){
        const score=search(after(pos,move),n-1,alpha,beta);
        best=max?Math.max(best,score):Math.min(best,score);
        if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
        if(beta<=alpha)break;
      }
      return best;
    }
    let best=-Infinity,pick;
    for(const m of moves(s)){
      const value=search(after(s,m),depth-1,best,Infinity);
      if(value>best){best=value;pick=m;}
    }
    return pick;
  }
  const nodes=[[9,22],[9,50],[9,78],[30,22],[30,50],[30,78],[50,50],[68,22],[68,50],[68,78],[90,22],[90,50],[90,78],[51,12],[51,88]];
  const stamps=['Leaf','Wheel','Star'];
  function yard(level=1,coop=false){
    return {level,coop,beat:0,cars:[0,1,2].map((id)=>({id,at:id,arrival:level===3?id*2:0,held:true,done:false})),switches:[0,0,0,0],ready:[false,false],rewind:true,history:null,crashes:0,over:false};
  }
  function nextNode(s,c){
    if(c.done||c.held||s.beat<c.arrival)return c.at;
    const n=c.at;
    if(n<3)return n+3;
    if(n<=5){
      if(!s.switches[n-3])return n+4;
      if(s.level===3&&n!==4)return n===3?13:14;
      return 6;
    }
    if(n===6)return 7+s.switches[3];
    if(n===13||n===14)return 6;
    if(n>=7&&n<=9)return n+3;
    return n-7;
  }
  function forecast(s){
    const dest=s.cars.map(c=>nextNode(s,c)),danger=new Set();
    s.cars.forEach((a,i)=>s.cars.slice(i+1).forEach((b,j)=>{
      const k=i+j+1;if(a.done||b.done||a.arrival>s.beat||b.arrival>s.beat)return;
      if(dest[i]===dest[k]||dest[i]===b.at&&dest[k]===a.at){danger.add(i);danger.add(k);}
    }));
    // A stopped cart keeps its segment. A third cart in the queue must wait
    // too, even if its own first-choice destination was unique.
    let changed=true;
    while(changed){
      changed=false;
      for(const [i,c] of s.cars.entries())if(!c.done&&c.arrival<=s.beat&&!danger.has(i)&&dest[i]!==c.at&&
        [...danger].some(j=>s.cars[j].at===dest[i])){danger.add(i);changed=true;}
    }
    return {dest,danger:[...danger]};
  }
  function bankAllowed(s,seat,bank){return !s.coop||seat===bank;}
  function switchYard(s,seat,control){
    if(s.over)return false;
    const bank=control<3?0:1;
    if(!bankAllowed(s,seat,bank))return false;
    if(control<4)s.switches[control]=(s.switches[control]+1)%(control===3?3:2);
    else if(control<=6){const c=s.cars[control-4];if(c.done)return false;c.held=!c.held;}
    else return false;
    s.ready=[false,false];return true;
  }
  function dispatch(s,seat){
    if(s.over||s.ready[seat])return false;
    s.ready[seat]=true;if(s.coop&&!s.ready.every(Boolean))return false;
    s.history={cars:s.cars.map(c=>({...c})),switches:[...s.switches],beat:s.beat,crashes:s.crashes};
    const {dest,danger}=forecast(s);s.beat++;s.ready=[false,false];
    s.cars.forEach((c,i)=>{
      if(danger.includes(i)){c.held=true;return;}
      c.at=dest[i];
      const target=(c.id+(s.level-1))%3;
      if(c.at===10+target){c.done=true;c.held=true;}
    });
    if(danger.length)s.crashes++;
    s.over=s.cars.every(c=>c.done);return true;
  }
  function rewind(s){
    if(!s.history||!s.rewind||s.over)return false;
    Object.assign(s,s.history,{rewind:false,history:null,ready:[false,false]});return true;
  }
  const species=[
    ['Copper minnow','Short dart',.65,4,0],['Bell bream','Long pull',1.15,8,1],['Striped wrasse','Switchback',1.9,12,2],
    ['Lantern sailfin','Long pull',3.2,19,3],['Silver sprat','Switchback',.8,6,0],['Breakwater pike','Short dart',2.4,15,2]
  ];
  const docks=['Beginner dock','Rocky inlet','Outer pier'],stocks=[[0,1,4],[1,2,5],[2,3,5]];
  function line(){return {state:'ready',aim:1,casts:0,age:0,tension:0,progress:0,bag:[],notice:'Aim and cast'};}
  function fishing(mode,coop,seed=1){
    const contest=mode==='fish'||mode==='weigh';
    return {mode,coop,seed,vsAI:mode==='fish'&&!coop,lines:Array.from({length:coop||contest?2:1},line),time:0,limit:contest?105:0,assist:false,over:false};
  }
  function school(s,l){
    // Each bank has its own copy of the same population and identical tide.
    return Array.from({length:9},(_,i)=>{
      const zone=Math.floor(i/3),cycle=s.time*(.44+.035*(i%3))+i*2.17+s.seed;
      let x=(zone+.50)/3+Math.sin(cycle)*.112,y=.38+(i%3)*.17+Math.cos(cycle*.86)*.050;
      if(l.target===i&&['wait','bite','reel'].includes(l.state)){
        const u=l.state==='wait'?clamp(l.age/l.wait,0,1):1;
        x+=(l.hook-x)*u;y+=((l.state==='reel'?.40-.21*l.progress:.32)-y)*u;
        if(l.state==='reel')x+=Math.sin(l.age*3)*.06*(1-l.progress);
      }
      return {i,id:stocks[zone][i%3],x,y,flip:Math.cos(cycle)<0};
    });
  }
  function cast(s,seat){
    const l=s.lines[seat];if(!l||s.over)return;
    if(l.state==='ready'){
      const n=l.casts++ + s.seed,hook=(l.aim+.5)/3+Math.sin(n*2)*.065;
      const fish=school(s,l).filter(f=>Math.floor(f.i/3)===l.aim).sort((a,b)=>Math.abs(a.x-hook)-Math.abs(b.x-hook))[0];
      Object.assign(l,{state:'cast',age:0,fish:fish.id,target:fish.i,hook,weight:Math.round(species[fish.id][2]*(1+.15*(n%5))*100)/100,wait:1.15+(n%4)*.35,notice:'Casting…'});
    }else if(l.state==='bite'){Object.assign(l,{state:'reel',age:0,tension:.24,progress:0,notice:species[l.fish][1]});}
  }
  function fishTick(s,dt,holds){
    if(s.over)return [];
    s.time+=dt;const caught=[];
    for(const [seat,l] of s.lines.entries()){
      const ai=s.vsAI&&seat===1;l.age+=dt;
      if(ai&&l.state==='ready'&&l.age>1.05){l.aim=(l.casts+s.seed)%3;cast(s,1);}
      if(ai&&l.state==='bite'&&l.age>.57)cast(s,1);
      if(l.state==='cast'&&l.age>=.62)Object.assign(l,{state:'wait',age:0,notice:'Float steady'});
      else if(l.state==='wait'&&l.age>=l.wait)Object.assign(l,{state:'bite',age:0,notice:'Float dives! Hook now'});
      else if(l.state==='bite'&&l.age>3.6)Object.assign(l,{state:'ready',age:0,notice:'Bait slipped · cast again'});
      else if(l.state==='reel'){
        const hz=[3,1.4,2.1][['Short dart','Long pull','Switchback'].indexOf(species[l.fish][1])];
        const pull=Math.sin(l.age*hz+(l.fish%4))>.15;
        const held=ai?l.tension<.57&&(!pull||l.age%2<.68):!!holds[seat]&&(!s.assist||l.tension<.68);
        l.pull=pull;
        l.tension=clamp(l.tension+dt*(held?(pull?.37:.07):-.32),0,1);
        l.progress=clamp(l.progress+dt*(held?(pull?.09:.2):-.014),0,1);
        if(l.tension>=1)Object.assign(l,{state:'ready',age:0,notice:'Line broke · ease off during pulls'});
        else if(l.progress>=1){
          const fish={id:l.fish,weight:l.weight};l.bag.push(fish);caught.push({seat,...fish});Object.assign(l,{state:'land',age:0,notice:species[l.fish][0]+' · '+l.weight.toFixed(2)+' kg'});
        }
      }else if(l.state==='land'&&l.age>1)Object.assign(l,{state:'ready',age:0});
    }
    if(s.limit&&s.time>=s.limit)s.over=true;
    return caught;
  }
  const bestThree=bag=>bag.map(f=>f.weight).sort((a,b)=>b-a).slice(0,3).reduce((a,b)=>a+b,0);
  const rings=[-.40,.38,-.53,.13,.55,-.18];
  function kite(practice=false){return {x:0,y:0,time:0,stage:0,tension:.34,penalty:0,finished:false,practice,last:'Sheltered launch',trail:[]};}
  function fly(s,dt,steer,hold){
    if(s.finished)return;
    s.time+=dt;
    // The wind is tied to course position. Restarts and both heats see identical gusts.
    s.gust=s.y<.2?0:Math.sin(s.y*8)*.7+Math.sin(s.y*16+.8)*.28;
    s.tension=clamp(s.tension+dt*(hold?.07+Math.abs(s.gust)*.06:-.09),0,1);
    s.x+=dt*(clamp(steer,-1,1)*.58+s.gust*(hold?.09:.28));
    s.y+=dt*(s.practice?.23:.055)*(hold?1.17:.94);
    if(Math.abs(s.x)>1||s.tension>=1||s.y>=s.stage+1&&Math.abs(s.x-rings[s.stage])>.30){
      s.x=s.stage?rings[s.stage-1]:0;s.y=s.stage;s.tension=.28;s.penalty+=5;s.last='Checkpoint recovery · +5 s';
    }else if(s.y>=s.stage+1){
      s.stage++;s.last='Ring '+s.stage+' clear';
      if(s.stage===(s.practice?1:6))s.finished=true;
    }
    if(!s.trail.length||s.time-s.trail[s.trail.length-1][0]>=.33)s.trail.push([s.time,s.x,s.y]);
  }
  W.TownActivities={venues,clamp,lantern:{board,moves,play,choose,coord,controller,lamps},rail:{yard,switchYard,forecast,dispatch,rewind,nodes,stamps},
    bay:{fishing,cast,fishTick,bestThree,species,docks,school},wind:{kite,fly,rings}};
}());
(function () {
  'use strict';
  const A=window.OW.TownActivities,{clamp}=A;
  const bouts=[
    {name:'Chalk lesson',roster:['duelist'],pay:35,tip:'A stripe locks the duelist’s charge. Step aside, then strike.'},
    {name:'Split the screen',roster:['guard','shooter'],pay:70,tip:'The guard blocks frontal hits. Circle its shield while the sharpshot commits.'},
    {name:'The quarry pack',roster:['flanker','shooter','guard'],pay:115,tip:'The flanker marks its landing. Draw the shots into a stone barricade.'},
    {name:'Champion Slate-Ear',roster:['champion','flanker','shooter'],pay:180,tip:'Slate-Ear alternates a locked charge with a stamped shock ring. Punish the recovery.'}
  ];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function circle(s,x,y,r){
    if(x<r||x>100-r||y<r||y>61-r)return false;
    return !s.blocks.some(b=>Math.hypot(x-b.x,y-b.y)<r+b.r);
  }
  function walk(s,p,dx,dy,r){if(circle(s,p.x+dx,p.y,r))p.x+=dx;if(circle(s,p.x,p.y+dy,r))p.y+=dy;}
  function duel(tier,heroes,practice=false){
    const card=bouts[tier],roles=[...card.roster];if(heroes.length===2)roles.push(tier<2?'duelist':'flanker');
    const fighters=heroes.map((gear,i)=>({x:16,y:28+i*8,hp:gear.hp,max:gear.hp,power:gear.power,reach:gear.reach,cadence:gear.cadence,cd:0,dodge:0,roll:0,revive:0,attack:null,aim:[1,0]}));
    const foes=roles.map((role,i)=>({role,x:68+i%2*14,y:12+i*10,cool:1.2+i*.55,phase:'approach',hp:(role==='champion'?105:role==='guard'?56:38)*(heroes.length===2?1.12:1),count:0,recover:0}));
    return {tier,practice,fighters,foes,time:0,blocks:tier>0?[{x:47,y:17,r:4},{x:55,y:43,r:tier>1?5:3}]:[],over:false,won:false};
  }
  function clearShot(s,a,b){return !s.blocks.some(c=>segment(a,b,c)<c.r);}
  function segment(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,k=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-k*dx,p.y-a.y-k*dy);}
  function prepare(s,e,p){
    const dx=p.x-e.x,dy=p.y-e.y,len=Math.hypot(dx,dy)||1;
    const kind=e.role==='guard'?'sweep':e.role==='flanker'?'stamp':e.role==='champion'&&e.count%2?'stamp':'lane';
    const reach=e.role==='shooter'?90:clamp(len+6,10,30);
    e.mark={kind,x:kind==='stamp'?p.x:e.x,y:kind==='stamp'?p.y:e.y,tx:e.x+dx/len*reach,ty:e.y+dy/len*reach,dx:dx/len,dy:dy/len,r:kind==='stamp'?8:kind==='sweep'?12:2.4};
    e.phase='warning';e.duration=e.role==='champion'?.94:e.role==='shooter'?.84:.64;e.left=e.duration;e.count++;
  }
  function footprint(e,p){
    const m=e.mark;
    if(m.kind==='stamp')return distance(m,p)<=m.r+1.4;
    if(m.kind==='sweep')return distance(m,p)<=m.r+1.4&&(p.x-m.x)*m.dx+(p.y-m.y)*m.dy>=-1;
    return segment(m,{x:m.tx,y:m.ty},p)<=m.r+1.4;
  }
  function tick(s,dt,controls){
    if(s.over)return;
    s.time+=dt;
    for(const [i,p] of s.fighters.entries()){
      if(p.hp<=0)continue;
      const a=controls[i]||{},n=Math.hypot(a.x||0,a.y||0),dx=(a.x||0)/Math.max(1,n),dy=(a.y||0)/Math.max(1,n);
      if(n>.1)p.aim=[dx,dy];
      p.dodge=Math.max(0,p.dodge-dt);p.roll=Math.max(0,p.roll-dt);p.cd=Math.max(0,p.cd-dt);
      if(a.evade&&p.dodge<=0){p.dodge=.95;p.roll=.25;}
      walk(s,p,dx*dt*(p.roll>0?44:16),dy*dt*(p.roll>0?44:16),1.7);
      if(a.hit&&p.cd<=0){
        const target=s.foes.filter(e=>e.hp>0&&distance(p,e)<=p.reach&&clearShot(s,p,e)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
        if(target){
          const screened=target.role==='guard'&&target.phase!=='recovery'&&(target.mark?.dx??-1)*(p.x-target.x)+(target.mark?.dy??0)*(p.y-target.y)>0;
          target.hp-=p.power*(screened?.25:1);p.cd=p.cadence;p.attack={x:target.x,y:target.y,until:s.time+.14};
        }
      }
      const ally=s.fighters.find(q=>q.hp<=0&&distance(p,q)<7);
      if(ally){ally.revive+=dt;if(ally.revive>=1.7){ally.hp=ally.max*.42;ally.revive=0;ally.roll=.4;}}
    }
    for(const [i,e] of s.foes.entries()){
      if(e.hp<=0)continue;
      const active=s.fighters.filter(p=>p.hp>0);
      if(!active.length)break;
      const p=active.reduce((best,p)=>distance(p,e)<distance(best,e)?p:best,active[i%active.length]);
      if(e.phase==='warning'){
        if((e.left-=dt)>0)continue;
        for(const hero of active)if(!hero.roll&&footprint(e,hero)&&clearShot(s,e,hero))hero.hp=Math.max(0,hero.hp-(e.role==='champion'?28:16));
        if(e.role==='flanker'&&circle(s,e.mark.x,e.mark.y,2)){e.x=e.mark.x;e.y=e.mark.y;}
        e.phase='recovery';e.left=.72;continue;
      }
      if(e.phase==='recovery'){if((e.left-=dt)<=0){e.phase='approach';e.cool=.62;}continue;}
      const d=distance(e,p)||1,preferred=e.role==='shooter'?43:e.role==='flanker'?19:10;
      const dx=(p.x-e.x)/d,dy=(p.y-e.y)/d;
      if(d>preferred||!clearShot(s,e,p)){
        const x=e.x,y=e.y;walk(s,e,dx*dt*9,dy*dt*9,2);
        if(Math.hypot(x-e.x,y-e.y)<dt*3)walk(s,e,-dy*dt*10,dx*dt*10,2);
      }
      if((e.cool-=dt)<=0&&d<preferred+6&&clearShot(s,e,p)&&s.foes.filter(q=>q.hp>0&&q.phase==='warning').length<(s.fighters.length===2?2:1))prepare(s,e,p);
    }
    s.won=s.foes.every(e=>e.hp<=0);s.over=s.won||s.fighters.every(p=>p.hp<=0);
  }
  A.quarry={bouts,duel,tick,footprint};
}());

(function(){
  'use strict';
  const W=window.OW,{venues}=W.TownActivities;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function safe(w,t,wanted){
    for(let n=0;n<120;n++){
      const r=22*Math.ceil(n/12),ang=n*Math.PI/6,x=wanted.x+Math.cos(ang)*r,y=wanted.y+Math.sin(ang)*r;
      if(!w.isBlocked(x,y,22)&&!w.isPointLocked?.(x,y)&&dist(t,{x,y})<550)return {x,y};
    }
    return {...t};
  }
  function venuesIn(w){
    if(!w||w.isDungeon)return [];
    if(w.activityLocations)return w.activityLocations;
    return w.activityLocations=venues.flatMap((v,i)=>{
      const t=w.getLocation('town_'+v.town);if(!t)return [];
      const paths=[[130,118],[-141,83],[128,106],[-138,94],[146,99]];
      let found;
      for(let j=0;j<36;j++){
        const a=j*Math.PI/9,r=165+Math.floor(j/18)*43;
        const desired=j?{x:t.x+Math.cos(a)*r,y:t.y+Math.sin(a)*r}:{x:t.x+paths[i][0],y:t.y+paths[i][1]};
        const p=safe(w,t,desired);
        if(w.locations.every(l=>l===t||dist(l,p)>103)){found=p;break;}
      }
      const p=found||safe(w,t,{x:t.x,y:t.y+155});
      return [w._addLocation({...p,id:'activity_'+v.id,type:'activity',name:v.name,description:v.place+' · '+v.rule,radius:66,region:t.region,activity:v.id})];
    });
  }
  W.Content.installActivityVenues=venuesIn;
  Object.assign(W.TownActivities,{venuesIn,safe});
}());
