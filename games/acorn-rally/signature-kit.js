(function(root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AcornSignatures=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const names=['Needle Turn','Shoulder Through','Springstep','Berm Burst','Quill Fan','Slipstream Dash','Ground Pound','Tunnel Dash'];
  const durations=[1.1,3,.86,2.7,1.05,1.25,1.15,1.12];
  const colors=['#90e6ed','#f0ac59','#d5a2ff','#65eab5','#ffe16c','#ff775e','#b3df6d','#69d9ff'];
  const cap=(v,low,high)=>Math.max(low,Math.min(high,v));
  function gap(from,to,length){const n=(to-from+length*.5)%length;return (n<0?n+length:n)-length*.5;}
  function selectBoost(r){
    let best=null;
    for(const source of r.boostSources)if(!best||source.power>best.power||source.power===best.power&&source.time>best.time)best=source;
    r.boost=best?.time||0;r.boostPower=best?.power||0;r.boostStyle=best?.style||'';
  }
  function boost(r,time,power,style='signature'){
    // A quick launch can temporarily overtake a long gust without inheriting its duration.
    if(!r.boostSources)r.boostSources=r.boost>0?[{time:r.boost,power:r.boostPower,style:r.boostStyle}]:[];
    r.boostSources=r.boostSources.filter(s=>s.style!==style||s.time>time||s.power>power);
    r.boostSources.push({time,power,style});selectBoost(r);
  }
  function advanceBoost(r,dt){
    if(!r.boostSources?.length){r.boost=Math.max(0,(r.boost||0)-dt);if(!r.boost){r.boostPower=0;r.boostStyle='';}return;}
    for(let i=r.boostSources.length-1;i>=0;i--){const s=r.boostSources[i];s.time-=dt;if(s.time<=0)r.boostSources.splice(i,1);}
    selectBoost(r);
  }
  function tell(r,text){r.notice=text;r.noticeTime=1.45;}
  function beat(r,st,label,stage){Object.assign(r.signature,{stage,label,beat:st.time});tell(r,label);}
  function grounded(r){return !r.finish&&!r.ghost&&r.air<.14&&!(r.driverIndex===7&&r.active>0);}
  function nearby(st,r,s,x,branch,length,radius){
    return st.racers.filter(a=>a!==r&&a.branch===branch&&grounded(a)&&Math.hypot(gap(s,a.s,length),a.x-x)<=radius);
  }
  function impact(st,source,victim,power,time,slow,sourceX=source.x){
    if(victim.protect>0)return false;
    const side=Math.sign(victim.x-sourceX)||((source.seat+victim.seat)%2?1:-1);
    victim.signatureHit={id:source.driverIndex,at:st.time,side,blocked:!!victim.guard};
    if(victim.guard>0){victim.guard=0;victim.protect=.72;tell(victim,'Bark guard absorbed the impact');return false;}
    victim.protect=time;victim.hit=.31;victim.vx+=side*power;victim.x+=side*Math.min(.28,power*.034);
    victim.slow=Math.max(victim.slow,slow);
    if(slow)victim.v*=.84;
    tell(victim,({1:'Shoulder checked',4:'Caught by quills',6:'Shockwave impact',7:'Tunnel eruption'})[source.driverIndex]||'Hit');
    return true;
  }
  function wave(st,r,length,radius,power,time,slow,inner=0){
    const sig=r.signature;
    for(const rival of nearby(st,r,sig.s,sig.x,sig.branch,length,radius)){
      const bit=1<<rival.seat;if(sig.mask&bit||Math.hypot(gap(sig.s,rival.s,length),rival.x-sig.x)<inner)continue;
      sig.mask|=bit;
      if(impact(st,r,rival,power,time,slow,sig.x))sig.hits++;
    }
  }
  function anchor(r){Object.assign(r.signature,{s:r.s,x:r.x,branch:r.branch});}
  function start(st,r,length){
    const id=r.driverIndex, duration=durations[id];
    if(id===3&&r.bank<.15){tell(r,'Hold a turn to arm');return;}
    const sig=r.signature={stage:'active',label:names[id],since:st.time,until:st.time+duration,beat:st.time,s:r.s,x:r.x,branch:r.branch,mask:0,hits:0,charge:0,side:Math.abs(r.steer)>.22?Math.sign(r.steer):0,target:-1};
    r.meter=0;r.active=duration;r.fx=duration;tell(r,names[id]);
    if(id===0){sig.label='Reverse your turn';r.slip=0;r.burr=0;}
    if(id===1){sig.label='Bumpers braced';}
    if(id===2){r.air=duration;sig.label='Level for landing';}
    if(id===3){sig.charge=cap(r.bank*.48,.17,.48);sig.label='Banking boost';}
    if(id===4){sig.label='Quills away';const pack=nearby(st,r,r.s,r.x,r.branch,length,7);wave(st,r,length,2.65,7.7,.95,.19);if(!pack.length)boost(r,.48,4.1);}
    if(id===5){
      let nearest=18;
      for(const rival of st.racers){
        if(rival===r||rival.finish||rival.ghost||rival.branch!==r.branch||Math.abs(rival.x-r.x)>2.55)continue;
        const ds=gap(r.s,rival.s,length);if(ds>.5&&ds<nearest){nearest=ds;sig.target=rival.seat;}
      }
      if(sig.target>=0){sig.label='Draft locked';boost(r,1.34,9.1);tell(r,'Draft locked · pass for a slingshot');}
      else {sig.label='Foxfire dash';boost(r,.79,5.8);}
    }
    if(id===6){r.air=.29;r.stomp=true;sig.label='Brace for impact';}
    if(id===7){r.slip=0;r.burr=0;r.slow=0;r.sap=0;sig.label='Below the track';boost(r,1.08,6.4);}
  }
  function tick(st,r,dt,length,road,input){
    if(r.signatureHit&&st.time-r.signatureHit.at>.56)delete r.signatureHit;
    const sig=r.signature;if(!sig)return;
    const age=st.time-sig.since, sinceBeat=st.time-sig.beat, id=r.driverIndex;
    if(st.time>sig.until+1.25){delete r.signature;return;}
    if(id===0&&r.active>0&&sig.stage==='active'){
      if(Math.abs(r.steer)>.34){
        if(!sig.side)sig.side=Math.sign(r.steer);
        else if(r.steer*sig.side<-.4&&age>.13){beat(r,st,'Switchback boost','release');boost(r,.58,5.3);}
      }
    }
    if(id===2&&sig.stage==='active'&&r.air<=0){
      anchor(r);
      if(Math.abs(r.steer)<.52&&Math.abs(r.x)<road.w-.35&&input.gas>.1){beat(r,st,'Clean landing','release');boost(r,.72,6.4);}
      else beat(r,st,'Touchdown','land');
    }
    if(id===3&&sig.stage==='active'){
      if(Math.abs(r.steer)>.27)sig.charge=cap(sig.charge+dt*(.58+Math.abs(r.steer)*.30),0,1);
      if(age>.20&&(Math.abs(r.steer)<.25||r.active<=0)){
        beat(r,st,sig.charge>.78?'Perfect berm exit':'Berm release','release');
        boost(r,.47+sig.charge*.88,4.2+sig.charge*5.1);r.active=0;r.fx=.72;
      }
    }
    if(id===4&&age<=.25){const rad=2.65+Math.min(1,age/.215)*4.35;wave(st,r,length,rad,7.7,.95,.19,Math.max(0,rad-1.1));}
    if(id===5&&r.active>0&&sig.stage==='active'&&sig.target>=0){
      const rival=st.racers[sig.target];
      if(rival&&rival.branch===r.branch&&gap(r.s,rival.s,length)<-.35){
        beat(r,st,'Slingshot pass','release');boost(r,1.18,10.3);r.v=Math.max(r.v,21.3);
      }
    }
    if(id===6&&r.stomp&&r.air<=0){
      anchor(r);r.slip=0;r.burr=0;r.slow=0;r.sap=0;r.vx*=.32;r.stomp=false;
      beat(r,st,'Seismic impact','wave');wave(st,r,length,3.35,4.5,1.35,.86);
    }else if(id===6&&sig.stage==='wave'&&sinceBeat<.27){
      const rad=3.35+Math.min(1,sinceBeat/.23)*5;wave(st,r,length,rad,4.5,1.35,.86,Math.max(0,rad-1.2));
    }
    if(id===7&&sig.stage==='active'&&r.active<=0){
      anchor(r);beat(r,st,'Tunnel breach','breach');wave(st,r,length,3.6,6.8,.88,.12);
      if(sig.hits)boost(r,.49,5.6);
    }
  }
  function brace(st,a,b){
    const r=a.driverIndex===1&&a.active>0?a:b.driverIndex===1&&b.active>0?b:null;
    if(!r||!r.signature)return false;
    const rival=r===a?b:a;r.active=0;r.fx=.70;
    beat(r,st,'Shoulder check','release');impact(st,r,rival,7.3,.9,.15);boost(r,.59,5.8);return true;
  }
  return {names,durations,colors,gap,start,tick,brace,boost,advanceBoost};
});
