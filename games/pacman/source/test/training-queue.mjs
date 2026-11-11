import assert from 'node:assert/strict';
import { Game, UNIT_DEFS } from '../../engine.js';

let groups=0;
function check(name,run){run();groups++;console.log('✓ '+name);}
function fixture(side='pac'){
  const game=new Game({side,seed:1975});
  game.resources[side]=10000;
  const producer=game.buildings.find(b=>b.side===side&&(side==='pac'?b.type==='nest':b.type==='lair'));
  return{game,producer,type:side==='pac'?'miner':'hunter',nextType:side==='pac'?'guardian':'binder'};
}
function tickBuildings(game,seconds){
  // Exercise actual production timing while keeping unrelated combat and
  // income out of exact cancellation/refund assertions.
  for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.05)game._updateBuildings(Math.min(.05,seconds-elapsed));
}

check('Training entries have stable unique IDs and remember the paid cost',()=>{
  for(const side of ['pac','ghost']){
    const{game,producer,type}=fixture(side);
    assert.equal(game.train(type,producer.id),true);
    assert.equal(game.train(type,producer.id),true);
    const [first,second]=producer.queue;
    assert.match(first.id,/^q\d+$/);assert.notEqual(first.id,second.id);
    assert.equal(first.paidCost,UNIT_DEFS[type].cost);
    assert.equal(first.remaining,UNIT_DEFS[type].trainTime);assert.equal(first.total,UNIT_DEFS[type].trainTime);
    tickBuildings(game,.5);
    assert.equal(producer.queue[0].id,first.id);assert.equal(producer.queue[1].id,second.id);
  }
});

check('Cancelling the active troop refunds it once and does not transfer progress',()=>{
  for(const side of ['pac','ghost']){
    const{game,producer,type,nextType}=fixture(side),initial=game.resources[side];
    game.train(type,producer.id);game.train(nextType,producer.id);
    const first=producer.queue[0],next=producer.queue[1],cost=first.paidCost;
    tickBuildings(game,1);
    assert.ok(first.remaining<first.total);assert.equal(next.remaining,next.total);
    assert.equal(game.cancelTraining(producer.id,first.id),true);
    assert.equal(game.resources[side],initial-UNIT_DEFS[nextType].cost);
    assert.equal(producer.queue.length,1);assert.equal(producer.queue[0].id,next.id);
    assert.equal(next.remaining,next.total);
    assert.equal(game.cancelTraining(producer.id,first.id),false);
    assert.equal(game.resources[side],initial-UNIT_DEFS[nextType].cost,'Repeated clicks cannot refund twice');
    const beforeCount=game.units.length;
    tickBuildings(game,next.total-.1);assert.equal(game.units.length,beforeCount);
    tickBuildings(game,.15);assert.equal(game.units.length,beforeCount+1);
    assert.equal(producer.queue.length,0);
    assert.equal(game.cancelTraining(producer.id,next.id),false,'Completed troops cannot be refunded');
    assert.ok(cost>0);
  }
});

check('Cancelling a waiting box removes that exact ID and preserves the active timer',()=>{
  for(const side of ['pac','ghost']){
    const{game,producer,type,nextType}=fixture(side);
    game.train(type,producer.id);game.train(nextType,producer.id);game.train(type,producer.id);
    tickBuildings(game,.5);
    const [active,waiting,last]=producer.queue,remaining=active.remaining,resources=game.resources[side];
    assert.equal(game.cancelTraining(producer.id,waiting.id),true);
    assert.deepEqual(producer.queue.map(q=>q.id),[active.id,last.id]);
    assert.equal(active.remaining,remaining);
    assert.equal(game.resources[side],resources+waiting.paidCost);
    assert.equal(game.cancelTraining(producer.id,waiting.id),false,'Stale IDs do not hit the next box');
    assert.deepEqual(producer.queue.map(q=>q.id),[active.id,last.id]);
  }
});

check('Queue cancellation rejects enemy, wrong, dead, stale, and finished-match entries',()=>{
  const{game,producer,type}=fixture('pac');
  game.train(type,producer.id);const own=producer.queue[0];
  const enemy=game.buildings.find(b=>b.side==='ghost'&&b.type==='lair');
  game.resources.ghost=1000;game.train('hunter',enemy.id,'ghost');const hostile=enemy.queue[0];
  const money={...game.resources};
  assert.equal(game.cancelTraining(enemy.id,hostile.id),false);
  assert.equal(game.cancelTraining(producer.id,hostile.id),false);
  assert.equal(game.cancelTraining('missing',own.id),false);
  assert.equal(game.cancelTraining(producer.id,'missing'),false);
  assert.equal(game.cancelTraining(producer.id,undefined),false);
  producer.hp=0;assert.equal(game.cancelTraining(producer.id,own.id),false);producer.hp=producer.maxHp;
  game.status='pac-won';assert.equal(game.cancelTraining(producer.id,own.id),false);
  assert.deepEqual(game.resources,money);
  assert.equal(producer.queue.length,1);assert.equal(enemy.queue.length,1);
});

check('Cancelling while paused keeps the match paused and refunds the original payment',()=>{
  const{game,producer,type}=fixture();
  game.train(type,producer.id);const queued=producer.queue[0],before=game.resources.pac,originalCost=UNIT_DEFS[type].cost;
  game.paused=true;
  try{
    UNIT_DEFS[type].cost=originalCost+17;
    assert.equal(game.cancelTraining(producer.id,queued.id),true);
    assert.equal(game.resources.pac,before+originalCost);
    assert.equal(game.paused,true);
  }finally{UNIT_DEFS[type].cost=originalCost;}
});

check('Cancelling frees army capacity immediately and works across production buildings',()=>{
  for(const side of ['pac','ghost']){
    const{game,producer,type}=fixture(side);
    const second=game._spawnBuilding(side==='pac'?'refuge':'lair',producer.x+4,producer.y+4,true);
    while(game.units.filter(u=>u.teamId===side).length<game.unitCap(side)-1)game.spawnUnit(type,producer.x,producer.y);
    assert.equal(game.train(type,producer.id),true);
    assert.equal(game.train(type,second.id),false);
    const queueId=producer.queue[0].id;
    assert.equal(game.cancelTraining(second.id,queueId),false);
    assert.equal(game.cancelTraining(producer.id,queueId),true);
    assert.equal(game.train(type,second.id),true);
    assert.equal(producer.queue.length,0);assert.equal(second.queue.length,1);
    assert.notEqual(second.queue[0].id,queueId);
  }
});

check('Fresh matches start with empty queues and retain faction-specific cancellation',()=>{
  for(const side of ['pac','ghost']){
    const{game,producer,type}=fixture(side);game.train(type,producer.id);
    assert.equal(producer.queue.length,1);
    const replacement=new Game({side,seed:4567,map:'ruins'});
    assert.ok(replacement.buildings.every(b=>b.queue.length===0));
    assert.equal(replacement.cancelTraining(producer.id,producer.queue[0].id),false);
  }
});

console.log(groups+' training queue regression groups passed.');
