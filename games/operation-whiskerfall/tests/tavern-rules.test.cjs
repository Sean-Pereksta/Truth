'use strict';
const assert=require('node:assert/strict');
global.window={OW:{Content:{}}};require('../data/tavern.js');
const T=window.OW.TavernRules;
let checks=0;
const ok=(v,name)=>{assert.ok(v,name);checks++;};
const card=(rank,suit)=>suit*13+(rank-2);
const hand=spec=>spec.map(([v,s])=>card(v,s));
const cases=[
 [[14,0],[11,1],[9,3],[7,2],[2,0]],
 [[14,0],[14,1],[8,2],[6,3],[5,0]],
 [[9,0],[9,1],[7,2],[7,3],[3,0]],
 [[8,0],[8,1],[8,2],[14,3],[5,0]],
 [[5,0],[4,1],[3,2],[2,3],[14,0]],
 [[2,1],[4,1],[7,1],[9,1],[13,1]],
 [[9,0],[9,1],[9,2],[5,0],[5,1]],
 [[8,0],[8,1],[8,2],[8,3],[10,2]],
 [[10,0],[11,0],[12,0],[13,0],[14,0]]
];
cases.forEach((spec,i)=>ok(T.rank(hand(spec))[0]===i,'rank category '+i));
ok(T.rank(hand(cases[4]))[1]===5,'wheel straight ace-low');
ok(T.compare([1,14,12,11,9],[1,14,12,10,9])===1,'pair kicker breaks tie');
ok(T.compare([2,14,9,5],[2,14,9,5])===0,'equal two pair and kicker tie');
function random(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
for(let level=0;level<3;level++){
  const h=T.deal([0,1],1,random(48119),level),unit=T.tables[level].unit;
  ok(h.pot===unit*3,'all seats ante for tier '+level);
  ok(new Set(h.seats.flatMap(p=>p.cards).concat(h.deck)).size===52,'deck unique');
  const seat=h.seats[h.turn].id;ok(T.act(h,(seat+1)%3,'bet')===null,'wrong player refused');
  const bet=T.act(h,seat,'bet'),raised=T.act(bet,bet.seats[bet.turn].id,'raise');
  ok(raised.price===2*unit&&!T.legal(raised).includes('raise'),'only one raise per street');
  let s=raised;while(s.phase==='opening')s=T.act(s,s.seats[s.turn].id,'call');
  ok(s.phase==='draw'&&s.pot===9*unit,'equal contributions close the opening');
  ok(!T.act(s,s.seats[s.turn].id,'draw',[1,1])&&!T.act(s,s.seats[s.turn].id,'draw',[1,2,3,4]),'draw indices unique, limit three');
  const deckCount=s.deck.length,who=s.seats[s.turn].id,old=s.seats[s.turn].cards;
  s=T.act(s,who,'draw',[0,1,4]);const newCards=s.seats.find(p=>p.id===who).cards;ok(s.deck.length===deckCount-3&&newCards[2]===old[2]&&newCards[3]===old[3],'draw precisely requested cards');
  while(s.phase==='draw')s=T.act(s,s.seats[s.turn].id,'draw',[]);
  while(s.phase!=='done')s=T.act(s,s.seats[s.turn].id,'check');
  ok(s.payout.reduce((a,b)=>a+b,0)===s.pot&&s.seats.every(p=>p.paid<=5*unit),'showdown conserves pot and table limit');
}
const single=T.deal([0],1,random(5),0),sitting=single.seats[single.turn].id,fold=T.act(single,sitting,'fold');ok(fold.phase==='done'&&fold.winners.length===1&&fold.winners[0]!==sitting,'fold ends heads-up hand');
const tied=T.deal([0,1],1,random(77),0);tied.phase='closing';tied.pot=15;tied.seats[2].folded=true;
tied.seats[0].cards=hand([[14,0],[14,1],[13,0],[11,0],[8,0]]);tied.seats[1].cards=hand([[14,2],[14,3],[13,1],[11,1],[8,1]]);
tied.turn=0;
let split=T.act(tied,0,'check');split=T.act(split,1,'check');
ok(split.winners.length===2&&split.payout.join(',')==='7,8,0','tied pot splits clockwise odd coin');
for(let level=0;level<3;level++){
  let games=0;
  for(let i=1;i<=50;i++){
    let h=T.deal([0],i,random(i*815),level),turns=0;
    while(h.phase!=='done'&&turns++<30){
      const m=T.computer(h);h=T.act(h,h.seats[h.turn].id,m.action,m.cards);assert.ok(h);
    }
    if(h.phase==='done')games++;assert.deepEqual(T.tell(h),T.tell(JSON.parse(JSON.stringify(h))));
  }
  ok(games===50,'computer plays 50 complete legal hands at level '+level);
}
const faceRates=T.tables.map((t,level)=>Array.from({length:200},(_,i)=>T.deal([0],i+1,random(i*13+8),level)).filter(h=>h.tell.frame!==0).length);
ok(faceRates[0]>faceRates[1]&&faceRates[1]>faceRates[2],'easy gives more frequent tells than regular or expert');
ok(T.dartScore(0,0).points===50&&T.dartScore(.08,0).points===25,'dart bull regions');
ok(T.dartScore(0,-.58).points===60&&T.dartScore(0,-.96).points===40,'triple and double twenty');
ok(T.dartScore(1.2,0).points===0&&T.dartScore(0,.4).points===3,'outside and bottom single');
console.log(checks+' tavern rules checks passed; 150 complete computer games');
