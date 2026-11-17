(function () {
  'use strict';
  const W = window.OW;
  const marks = ['Diamond', 'Peak', 'Moon', 'Star'];
  const symbols = ['◆', '▲', '●', '✦'];
  const ring = [[1,4],[0,2],[1,3],[2,4],[0,3]];
  const graphs = [
    [[1],[0,2],[1]],
    [[1,2],[0,3],[0,4],[1,4],[2,3]],
    [[1,3],[0,2,4],[1,3],[0,2,4],[1,3]]
  ];
  const advanced = (config,state) => state.chamberRevision === 2 && config.region >= 2;
  function graph(config,state) {
    if (state.chamberRevision !== 2) return ring;
    return graphs[config.region <= 2 ? 0 : config.region < 6 ? 1 : 2];
  }
  function affected(config,state,index) { return [index,...graph(config,state)[index]]; }
  function target(config,state) {
    if (state.chamberRevision !== 2) return Array.from({length:5},(_,i)=>(i+config.region+config.variant)%2===0);
    const result=graph(config,state).map(()=>false);
    const keys=result.length===3?[0,1]:[0,2,...(config.region>=6?[4]:[])];
    for (const key of keys) for (const i of affected(config,state,key)) result[i]=!result[i];
    return result;
  }
  function toggleSolution(current, desired, move) {
    let best=null;
    for (let mask=0;mask<(1<<desired.length);mask++) {
      const state=current.slice(),steps=[];
      for (let i=0;i<desired.length;i++) if (mask & (1<<i)) {
        steps.push(i);
        for (const j of move(i)) state[j]=!state[j];
      }
      if (desired.every((v,i)=>v===state[i]) && (!best || steps.length<best.length)) best=steps;
    }
    return best;
  }
  function conduitSolution(state,header) {
    const end=header?0:5,exit=header?2:0;
    let best=null;
    function visit(i,entry,visited,moves) {
      if (visited.includes(i)) return;
      for(let rot=0;rot<4;rot++) {
        const ports=W.Dungeons.pipePorts(i,rot);
        if (!ports.includes(entry)) continue;
        const out=ports.find(p=>p!==entry),turns=(rot-state.rotations[i]+4)%4;
        const steps=moves.concat(Array(turns).fill(i));
        if(best && steps.length>=best.length) continue;
        if(i===end&&out===exit){best=steps;continue;}
        const x=i%3+[1,0,-1,0][out],y=Math.floor(i/3)+[0,1,0,-1][out];
        if(x>=0&&x<3&&y>=0&&y<3)visit(y*3+x,(out+2)%4,[...visited,i],steps);
      }
    }
    visit(3,2,[],[]);
    return best;
  }
  function solution(config,state) {
    switch(config.puzzle){
      case 'echo':return config.sequence.slice(state.sequenceIndex);
      case 'constellation':return toggleSolution(state.stars,target(config,state),i=>affected(config,state,i));
      case 'conduit':return conduitSolution(state,advanced(config,state)&&!state.headerCharged);
      case 'mirrors':{
        let best=null;
        const shutter=advanced(config,state)&&!state.shutterOpen;
        for(let mask=0;mask<64;mask++){
          const steps=[],mirrors=state.mirrors.map((v,i)=>{if(mask&(1<<i)){steps.push(i);return 1-v;}return v;});
          if(best&&steps.length>=best.length) continue;
          const t=W.Dungeons.mirrorTrace({...state,mirrors});
          if(shutter?t.moon:t.solved)best=steps;
        }
        return best;
      }
      default:return [];
    }
  }
  function evidence(c,s) {
    const a=advanced(c,s);
    switch(c.puzzle) {
      case 'echo':{
        const order=c.sequence.map(i=>marks[i]);
        return ['The relief broke into two strips. The left strip has the inlet notch. The right strip ends in a bell.',
          'Inlet strip: '+order[0]+' before '+order[1]+'. Bell strip: '+order[2]+' before '+order[3]+'.',
          'Join the matching broken edges. Play the inlet pair, then the bell pair.'];
      }
      case 'mirrors':return [
        a?'The sun door has a crescent shutter. Two different receivers share the same light.':'Guide the lamp into the eastern sun receiver.',
        'A slash turns light coming from the west north. A backslash turns it south.',
        a?(s.shutterOpen?'The crescent latch holds. Turn the northeast mirror toward the sun.':'Route light to the crescent above the northeast mirror before aiming for the sun.'):'Trace from the lamp. Correct the first reflection that leads away from the sun.'];
      case 'conduit':return [
        a?'The upper header feeds the seal piston, and the east wheel lifts the gate. Both need water.':'Carry spring water to the east wheel through connected elbows.',
        'Water enters the middle-left joint from the west. Follow its arrow to the first dry joint.',
        a?(s.headerCharged?'Pressure is stored. Reconnect the spring to the east wheel.':'Connect the middle-left elbow to the top-left elbow and turn its outlet west to fill the header.'):'Direct the spring around a corner. The wheel accepts flow from the west.'];
      default:return ['Match the lit stars to the marks on the chart.',
        'Touching one star reverses it and each star connected by a line. Unconnected stars stay as they were.',
        'Inspect a star to preview its neighbors. Changing the same star twice restores the pattern.'];
    }
  }
  function nodeName(config,index) {
    return config.puzzle==='echo'?marks[index]+' '+symbols[index]:({mirrors:'Mirror',conduit:'Joint',constellation:'Star'}[config.puzzle]||'Device')+' '+(index+1);
  }
  function hint(config,state,level){
    const clues=evidence(config,state);
    if(level<3)return clues[level===1?1:2];
    const next=solution(config,state)?.[0];
    return next==null?'The mechanism is aligned.':('Next move · '+nodeName(config,next)+'.');
  }
  W.ChamberRules={advanced,marks,symbols,graph,affected,target,solution,evidence,hint,nodeName};
}());
