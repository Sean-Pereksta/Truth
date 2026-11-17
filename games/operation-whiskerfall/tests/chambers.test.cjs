'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const W={Game:class{},World:class{},Renderer:class{},Content:{regions:Array.from({length:10},(_,i)=>({name:'region '+i,level:i+1})),quests:[],npcs:[]}};
const ctx=vm.createContext({window:{OW:W}});
for(const src of ['data/dungeons.js','data/chamber-rules.js','js/world/dungeons.js'])vm.runInContext(fs.readFileSync(path.join(root,src),'utf8'),ctx,{filename:src});
const D=W.Dungeons,rules=W.ChamberRules;
let rooms=0,turns=0;
for(const cfg of W.Content.dungeons)for(const revision of [1,2]){
  const s=D.initialState();s.chamberRevision=revision;
  const g=new W.Game();
  Object.assign(g,{world:{config:cfg,state:s,isDungeon:true},ui:{toast(){}},audio:{play(){}},save(){},solveDungeon(){s.solved=true;}});
  assert.equal(g.puzzleAction(99),false);
  const start=JSON.stringify(s.stars);
  if(cfg.puzzle==='constellation'){
    assert.equal(g.puzzleAction(0),true);assert.equal(g.undoChamberStar(),true);assert.equal(JSON.stringify(s.stars),start);
    assert.equal(g.undoChamberStar(),false);
  }
  g.puzzleAction(1,true);
  for(let count=0;!s.solved&&count<35;count++){
    const move=rules.solution(cfg,s)?.[0];
    assert.ok(Number.isInteger(move),cfg.id+' needs a solution after '+count+' moves · '+JSON.stringify(s));
    assert.ok(rules.hint(cfg,s,1)&&rules.hint(cfg,s,2)&&rules.hint(cfg,s,3).includes(rules.nodeName(cfg,move)));
    assert.equal(g.puzzleAction(move),true);turns++;
  }
  assert.equal(s.solved,true,cfg.id);
  assert.equal(g.puzzleAction(0,true),false);
  if(revision===2&&cfg.region>=2&&cfg.puzzle==='mirrors')assert.equal(s.shutterOpen,true);
  if(revision===2&&cfg.region>=2&&cfg.puzzle==='conduit')assert.equal(s.headerCharged,true);
  rooms++;
}
console.log('PASS · '+rooms+' current and legacy chamber solutions, '+turns+' checked hint moves, invalid commands, undo, reset and permanent open seals.');
