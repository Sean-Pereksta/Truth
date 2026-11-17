(function(){
  'use strict';
  const W=window.OW,C=W.Content;
  function installTavern(world){
    const town=world.getLocation('town_9');if(!town||world.getLocation('tavern_copper_minnow'))return;
    const candidates=[];
    for(const radius of [250,285,335,390,445])for(let i=0;i<32;i++){
      const a=i*Math.PI/16+Math.PI/5,x=town.x+Math.cos(a)*radius,y=town.y+Math.sin(a)*radius;
      if(world.isBlocked(x,y,23)||world.isPointLocked?.(x,y))continue;
      const clear=Math.min(...world.locations.filter(l=>l!==town).map(l=>Math.hypot(l.x-x,l.y-y)));
      if(clear>=148)candidates.push({x,y,clear});
    }
    const p=candidates[0]||W.TownActivities.safe(world,town,{x:town.x+240,y:town.y-180});
    world._addLocation({id:'tavern_copper_minnow',type:'tavern',region:town.region,x:p.x,y:p.y,radius:68,name:'The Copper Minnow',description:'Crownrest harborside tavern · conversations, five-card draw for coins and darts.'});
  }
  C.installTavern=installTavern;
  const value=c=>2+c%13,suit=c=>Math.floor(c/13),rankName=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],suitName=['♣','♦','♥','♠'];
  const face=c=>rankName[value(c)-2]+suitName[suit(c)];
  const ranks=['High card','One pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
  function rank(cards){
    const values=cards.map(value).sort((a,b)=>b-a),counts=new Map();
    for(const v of values)counts.set(v,(counts.get(v)||0)+1);
    const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),unique=counts.size;
    const flush=cards.every(c=>suit(c)===suit(cards[0]));
    const straight=unique===5?(values[0]-values[4]===4?values[0]:values.join(',')==='14,5,4,3,2'?5:0):0;
    if(flush&&straight)return [8,straight];
    if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
    if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
    if(flush)return [5,...values];if(straight)return [4,straight];
    if(groups[0][1]===3)return [3,...groups.map(g=>g[0])];
    if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.map(g=>g[0])];
    if(groups[0][1]===2)return [1,...groups.map(g=>g[0])];
    return [0,...values];
  }
  function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return Math.sign(d);}return 0;}
  function next(s,from,pred){for(let i=1;i<=s.seats.length;i++){const index=(from+i)%s.seats.length;if(pred(s.seats[index]))return index;}return -1;}
  function shuffled(random){
    const d=Array.from({length:52},(_,i)=>i);
    for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
    return d;
  }
  const clone=x=>JSON.parse(JSON.stringify(x));
  const tables=[
    {id:'easy',name:'Lark’s dock table',player:'Lark',unit:1,row:1},
    {id:'regular',name:'Magpie’s brass table',player:'Magpie',unit:3,row:2},
    {id:'expert',name:'Pipkin’s velvet table',player:'Pipkin',unit:5,row:3}
  ];
  // The shuffled cards provide a stable, private-hand-specific observation. No
  // per-frame randomness or rerender can change the face shown for a betting street.
  function tell(s){
    const p=s.seats.find(p=>p.id===2),tier=s.table||0,phase=s.phase==='closing'?2:s.phase==='draw'?1:0;
    const hash=p.cards.reduce((acc,v)=>(Math.imul(acc,1664525)+v+1013904223)>>>0,Math.imul(s.serial+phase,7919)>>>0);
    const roll=hash/4294967296,r=rank(p.cards),strong=r[0]>=2||r[0]===1&&r[1]>=10;
    const frequency=[.9,.56,.29][tier],honesty=[.97,.78,.64][tier];
    if(roll>frequency)return {frame:0,caption:'Studies the felt.'};
    const truthful=((hash>>>8)%100)/100<honesty;
    if(!truthful)return {frame:4,caption:tier===2?'One ear shifts.':'Glances past the chips.'};
    return strong?{frame:2,caption:tier===2?'A tiny smile.':'A pleased whisker twitch.'}:{frame:3,caption:tier===2?'A brief swallow.':'Ears droop over the cards.'};
  }
  function deal(heroes,serial,random=Math.random,table=0){
    const unit=tables[table].unit,deck=shuffled(random),people=[...heroes.map(id=>({id,name:'Player '+(id+1)})),{id:2,name:tables[table].player}];
    const seats=people.map(p=>({...p,cards:[],paid:unit,street:0,folded:false,acted:false}));
    for(let i=0;i<5;i++)for(const p of seats)p.cards.push(deck.pop());
    const button=(serial-1)%seats.length;
    const s={serial,table,unit,deck,seats,button,turn:next({seats},button,()=>true),phase:'opening',price:0,raises:0,pot:seats.length*unit,
      log:'Five cards each · each seat anted '+unit+' coins.',payout:[],winners:[],paid:false};s.tell=tell(s);return s;
  }
  function legal(s){
    if(!s||s.phase==='done')return [];
    if(s.phase==='draw')return ['draw'];
    const due=s.price-s.seats[s.turn].street;
    return [...(due?['call']:['check']),...(!s.price?['bet']:s.raises<1?['raise']:[]),'fold'];
  }
  function showdown(s){
    const live=s.seats.filter(p=>!p.folded);
    const best=live.reduce((best,p)=>compare(rank(p.cards),best)>0?rank(p.cards):best,[-1]);
    const winners=live.filter(p=>compare(rank(p.cards),best)===0);
    s.phase='done';s.winners=winners.map(p=>p.id);s.payout=s.seats.map(()=>0);
    const each=Math.floor(s.pot/winners.length);
    winners.forEach(p=>s.payout[s.seats.indexOf(p)]=each);
    let extra=s.pot-each*winners.length;
    for(let i=1;i<=s.seats.length&&extra;i++){const ix=(s.button+i)%s.seats.length;if(s.winners.includes(s.seats[ix].id)){s.payout[ix]++;extra--;}}
    s.log=winners.map(p=>p.name).join(' and ')+(winners.length===1?' wins ':' split ')+s.pot+' coins'+(live.length>1?' · '+ranks[best[0]]:' · remaining hand')+'.';
  }
  function act(original,id,action,discards=[]){
    if(!original||!legal(original).includes(action)||original.seats[original.turn].id!==id)return null;
    const s=clone(original),seat=s.seats[s.turn];
    if(action==='draw'){
      if(!Array.isArray(discards)||discards.length>3||new Set(discards).size!==discards.length||discards.some(n=>!Number.isInteger(n)||n<0||n>4))return null;
      discards.forEach(i=>seat.cards[i]=s.deck.pop());seat.acted=true;
      s.log=seat.name+(discards.length?' draws '+discards.length+'.':' stands pat.');
    }else{
      if(action==='fold')seat.folded=true;
      if(action==='bet'||action==='raise'){
        if(action==='raise')s.raises++;s.price+=s.unit;
        for(const other of s.seats)if(!other.folded)other.acted=false;
      }
      const delta=action==='fold'?0:s.price-seat.street;
      seat.street+=delta;seat.paid+=delta;s.pot+=delta;seat.acted=true;
      s.log=seat.name+' '+({fold:'folds',bet:'bets',raise:'raises',call:'calls',check:'checks'}[action])+(delta?' '+delta+' coins.':'.');
    }
    const live=s.seats.filter(p=>!p.folded);
    if(live.length===1){showdown(s);return s;}
    const pending=p=>!p.folded&&(!p.acted||s.phase!=='draw'&&p.street!==s.price);
    const n=next(s,s.turn,pending);
    if(n!==-1){s.turn=n;return s;}
    if(s.phase==='closing'){showdown(s);return s;}
    s.phase=s.phase==='opening'?'draw':'closing';s.price=0;s.raises=0;
    for(const p of live){p.acted=false;p.street=0;}
    s.turn=next(s,s.button,p=>!p.folded);s.tell=tell(s);return s;
  }
  function computer(s){
    const p=s.seats[s.turn],hand=p.cards,r=rank(hand);
    if(s.phase==='draw'){
      if(r[0]>=4)return {action:'draw',cards:[]};
      const counts=new Map(hand.map(c=>[value(c),hand.filter(q=>value(q)===value(c)).length]));
      const sorted=hand.map((c,i)=>[c,i]).filter(([c])=>counts.get(value(c))===1).sort((a,b)=>value(a[0])-value(b[0]));
      return {action:'draw',cards:sorted.filter(([c])=>value(c)<13).slice(0,Math.min(3,r[0]===0?3:5)).map(x=>x[1])};
    }
    const choices=legal(s),roll=((s.serial*17+p.cards[0]*23+p.cards[2]*7+s.phase.length)%100)/100;
    if(s.table===0&&roll<.64)return {action:choices.includes('call')?'call':'check'};
    if(s.table===2&&r[0]===0&&r[1]>=12&&roll<.23&&choices.includes('bet'))return {action:'bet'};
    const strong=r[0]>=2||r[0]===1&&r[1]>=11;
    if(strong&&choices.includes('raise'))return {action:'raise'};
    if(strong&&choices.includes('bet'))return {action:'bet'};
    if(choices.includes('call'))return {action:r[0]===0&&r[1]<11?'fold':'call'};
    return {action:'check'};
  }
  const sequence=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  function dartScore(x,y){
    const radius=Math.hypot(x,y);if(radius>1)return {points:0,label:'Miss'};
    if(radius<.05)return {points:50,label:'Bullseye'};
    if(radius<.12)return {points:25,label:'Outer bull'};
    let angle=(Math.atan2(x,-y)+Math.PI*2+Math.PI/20)%(Math.PI*2);
    const n=sequence[Math.floor(angle/(Math.PI/10))],mult=radius>.92?2:radius>.55&&radius<.63?3:1;
    return {points:n*mult,label:(mult===3?'Treble ':mult===2?'Double ':'')+n};
  }
  W.TavernRules={tables,tell,rank,face,suit,ranks,compare,deal,legal,act,computer,dartScore,sequence};
}());
