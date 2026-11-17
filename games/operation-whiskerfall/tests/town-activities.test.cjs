'use strict';
const assert=require('node:assert/strict');
global.window={OW:{Content:{}}};
require('../data/town-activities.js');
const {lantern:L,rail:R,bay:F,wind:K,quarry:Q}=window.OW.TownActivities;
let count=0;
function check(test,info){assert.ok(test,info);count++;}
function spotBoard(positions,side=0){
  const s=L.board(side);s.pieces.forEach((p,i)=>p.at=positions[i]??-1);return s;
}
const open=L.board();check(open.pieces.map(p=>p.at).join(',')==='0,1,3,4,24,23,21,20','180-degree setup');
check(!L.moves(open).some(m=>m.i===2&&m.to===1),'runner blocked by Warden');
const shove=spotBoard([0,11,4,3,10,24,19,18]);
const m=L.moves(shove).find(m=>m.i===1&&m.to===10);
check(m.far===-1,'edge shove benches');
const pushed=L.play(shove,m.i,m.to);
check(pushed.pieces[4].at===-1&&shove.pieces[4].at===10,'immutable shove');
check(L.moves(pushed).some(m=>m.i===4&&m.to===20),'benched piece returns to home row');
const blocked=spotBoard([0,11,4,3,12,13,19,18]);check(!L.play(blocked,1,12),'occupied landing blocks shove');
check(!L.moves(open).some(m=>m.i<0),'no voluntary pass');
const jailed=spotBoard([0,1,2,3,5,6,7,8]);jailed.pieces[0].kind='runner';
const noAction=spotBoard([]);noAction.pieces=[];check(L.moves(noAction)[0].i===-1,'forced pass when no action');
const startScore=spotBoard([10,12,0,4,18,19,24,23],1);const opponentMove=L.moves(startScore)[0];
const after=L.play(startScore,opponentMove.i,opponentMove.to);check(after.score[0]===1&&after.side===0,'score at start of next turn');
const equal=L.board();equal.turns=[11,11];equal.score=[3,3];
const a=L.moves(equal)[0],n=L.play(equal,a.i,a.to),b=L.moves(n)[0],end=L.play(n,b.i,b.to);check(!n.over&&end.over&&end.winner===-1,'equal turns at twelve complete rounds');
const lead=L.board();lead.turns=[3,3];lead.score=[4,2];
const firstMove=L.moves(lead)[0],late=L.play(lead,firstMove.i,firstMove.to);check(!late.over,'second side receives equal turns');
for(const puzzle of ['deny','secure']){
  const board=L.board(0,puzzle);check(L.moves(board).some(m=>L.play(board,m.i,m.to).winner===0),puzzle+' solvable');
}
for(let first=0;first<=1;first++){
  for(let tier=1;tier<=3;tier++){const s=L.board(first),pick=L.choose(s,tier);check(L.play(s,pick.i,pick.to),'tier '+tier+' legal for opening seat '+first);}
  let s=L.board(first);for(let i=0;i<24&&!s.over;i++){const m=L.choose(s,1);s=L.play(s,m.i,m.to);}
  check(s.over&&s.turns[0]===s.turns[1],'complete AI match from seat '+first);
}
const finishBoard=first=>{
  let s=L.board(first);
  for(let i=0;i<24&&!s.over;i++){const m=L.choose(s,2);s=L.play(s,m.i,m.to);}
  return s;
};
const mirrored0=finishBoard(0),mirrored1=finishBoard(1);
check(mirrored0.score[0]===mirrored1.score[1]&&mirrored0.score[1]===mirrored1.score[0],'rotated starting seats produce mirrored scores at equal AI strength');
const rail=R.yard(1,true);check(!R.switchYard(rail,0,4)&&!R.switchYard(rail,1,0),'switch ownership');
for(let i=4;i<7;i++)R.switchYard(rail,1,i);
check(!R.dispatch(rail,0)&&rail.beat===0&&!R.dispatch(rail,0),'same seat cannot double commit');
check(R.dispatch(rail,1)&&rail.beat===1,'both seats commit');
check(R.rewind(rail)&&rail.beat===0&&!R.rewind(rail),'one rewind');
while(!rail.over&&rail.beat<6){R.dispatch(rail,0);R.dispatch(rail,1);}
check(rail.over&&rail.crashes===0,'morning shift, all carts delivered');
const collision=R.yard(2,false);collision.cars.forEach((c,i)=>{c.at=3+i;c.held=false;});collision.switches=[1,1,1,0];
check(R.forecast(collision).danger.length===3,'collision preview');
R.dispatch(collision,0);check(collision.crashes===1&&collision.cars.every(c=>c.held),'conflicting signals stop before impact');
const queued=R.yard(2,false);
queued.cars.forEach((c,i)=>{c.at=[10,3,6][i];c.held=i===2;});queued.switches[0]=1;
check(R.forecast(queued).danger.length===3,'blocked hub propagates upstream onto approach');
R.dispatch(queued,0);check(new Set(queued.cars.map(c=>c.at)).size===3,'held carts cannot overlap a third cart on the same beat');
for(const level of [2,3]){
  const yard=R.yard(level);
  for(let i=0;i<3;i++){
    yard.switches[i]=1;yard.switches[3]=(i+level-1)%3;yard.cars[i].held=false;
    for(let n=0;!yard.cars[i].done&&n<12;n++)R.dispatch(yard,0);
  }
  check(yard.over&&yard.crashes===0,'full shift '+level+' has a clean route');
}
const race=F.fishing('fish',false,3);check(race.vsAI&&race.lines.length===2,'AI at opposite bank');
const early=F.school(race,race.lines[0])[0].x;F.fishTick(race,.1,[]);
check(F.school(race,race.lines[0])[0].x!==early,'school swims live');
F.cast(race,0);check(race.lines[0].state==='cast'&&race.lines[1].state==='ready','independent casts');
race.assist=true;
while(!race.over){
  const l=race.lines[0];if(l.state==='ready'||l.state==='bite')F.cast(race,0);
  F.fishTick(race,.05,[true,false]);
}
check(race.lines.every(l=>l.bag.length>0)&&race.time>=105,'AI and player land fish before clock expires');
check(F.bestThree([{weight:1},{weight:7},{weight:2},{weight:6}])===15,'best-three weigh-in');
const weigh=F.fishing('weigh',true),school=F.school(weigh,weigh.lines[0]);
check(!weigh.vsAI&&JSON.stringify(school)===JSON.stringify(F.school(weigh,weigh.lines[1])),'same tide, independent anglers');
const bad=K.kite();for(let i=0;i<150;i++)K.fly(bad,.05,1,false);
check(bad.penalty>0&&bad.stage===0,'cliff resets to last ring');
function heat(){const s=K.kite();for(let i=0;i<3000&&!s.finished;i++){const dir=Math.sign(K.rings[s.stage]-s.x),dx=Math.abs(K.rings[s.stage]-s.x);K.fly(s,.05,dx<.03?0:dir,s.tension<.65);}return s;}
const h1=heat(),h2=heat();check(h1.finished&&h1.stage===6&&h1.time<120&&h1.penalty===0,'valid clean six-ring race');
check(h1.time===h2.time&&h1.x===h2.x,'same wind and time for two heats');
for(let tier=0;tier<4;tier++){
  const heroes=[{hp:140,power:22,reach:52,cadence:.24}],solo=Q.duel(tier,heroes),coop=Q.duel(tier,[...heroes,...heroes]);
  check(coop.foes.length===solo.foes.length+1,'co-op placement tier '+tier);
  for(let i=0;i<3000&&!solo.over;i++){
    const p=solo.fighters[0],foe=solo.foes.find(e=>e.hp>0);
    const dx=foe.x-p.x,dy=foe.y-p.y,d=Math.hypot(dx,dy);
    Q.tick(solo,.04,[{x:d>30?dx/d:Math.cos(i*.06),y:d>30?dy/d:Math.sin(i*.06),hit:true,evade:i%34===0}]);
  }
  check(solo.over&&solo.won,'solo bout tier '+tier+' has a viable fight');
}
console.log(count+' town activity rule checks passed');
