(function(root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AcornSignatures=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const names=['Needle Turn','Shoulder Through','Springstep','Berm Burst','Quill Fan','Slipstream Dash','Ground Pound','Tunnel Dash','Golden Hour','Prism Wake','Halo Counter','Gravehook Swing'];
  const durations=[1.45,3,.86,2.7,1.05,1.25,1.15,1.12,1.5,2,2,1.45];
  const colors=['#90e6ed','#f0ac59','#d5a2ff','#65eab5','#ffe16c','#ff775e','#b3df6d','#69d9ff','#ffcd70','#8debfa','#ffdb87','#c79bff'];
  const hookRange=6.2, swingArc=Math.PI*.96;
  const groundPound={core:3.9,radius:11.4,travel:.27};
  const quillFan={core:2.75,radius:8.8,travel:.18};
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
  function grounded(r){return !r.finish&&!r.ghost&&!r.fall&&!r.flight&&r.air<.14&&!(r.driverIndex===7&&r.active>0);}
  function nearby(st,r,s,x,branch,length,radius){
    return st.racers.filter(a=>a!==r&&a.branch===branch&&grounded(a)&&Math.hypot(gap(s,a.s,length),a.x-x)<=radius);
  }
  function impact(st,source,victim,power,time,slow,sourceX=source.x,shove=0){
    if(victim.protect>0)return false;
    const side=Math.sign(victim.x-sourceX)||((source.seat+victim.seat)%2?1:-1);
    victim.signatureHit={id:source.driverIndex,at:st.time,side,blocked:!!victim.guard};
    if(victim.guard>0){victim.guard=0;victim.protect=.72;tell(victim,'Bark guard absorbed the impact');return false;}
    victim.signatureHit.shove=shove;
    victim.protect=time;victim.hit=.31;victim.vx+=side*power;victim.x+=side*Math.min(.28,power*.034);
    victim.slow=Math.max(victim.slow,slow);
    if(slow)victim.v*=source.driverIndex===1?.96:source.driverIndex===6?.93:.84;
    tell(victim,({1:'Shoulder checked',4:'Caught by quills',6:'Shockwave impact',7:'Tunnel eruption'})[source.driverIndex]||'Hit');
    if(shove){
      const hitCount=source.signature.hits+1;
      const target=hitCount===1?victim.name:hitCount+' rivals';
      tell(source,({1:'Checked ',4:'Quills hit ',6:'Shockwave hit '})[source.driverIndex]+target);
    }
    return true;
  }
  function wave(st,r,length,radius,power,time,slow,inner=0,shove=0){
    const sig=r.signature;
    for(const rival of nearby(st,r,sig.s,sig.x,sig.branch,length,radius)){
      const bit=1<<rival.seat;if(sig.mask&bit||Math.hypot(gap(sig.s,rival.s,length),rival.x-sig.x)<inner)continue;
      sig.mask|=bit;
      if(impact(st,r,rival,power,time,slow,sig.x,shove))sig.hits++;
    }
  }
  function anchor(r){Object.assign(r.signature,{s:r.s,x:r.x,branch:r.branch});}
  function quills(st,r,length,radius){
    const sig=r.signature,inner=Math.max(0,(sig.waveRadius||0)-1);
    wave(st,r,length,radius,10.5,1.05,.52,inner,34);
    // Sweep the same annulus as the visible quills. Retire a cleared patch
    // before the projectile/contact pass later in this simulation tick.
    if(st.objects?.length)st.objects=st.objects.filter(o=>{
      if(o.kind!==2||o.owner===r.seat||o.branch!==sig.branch)return true;
      const dist=Math.hypot(gap(sig.s,o.s,length),o.x-sig.x);
      return dist>radius||dist<inner;
    });
    sig.waveRadius=radius;
  }
  function groundWave(st,r,length,radius){
    const sig=r.signature;
    for(const rival of nearby(st,r,sig.s,sig.x,sig.branch,length,radius)){
      const bit=1<<rival.seat;
      const distance=Math.hypot(gap(sig.s,rival.s,length),rival.x-sig.x);
      if(sig.mask&bit||distance+.75<(sig.waveRadius||0))continue;
      sig.mask|=bit;
      const strength=1-cap((distance-groundPound.core)/(groundPound.radius-groundPound.core),0,1);
      if(impact(st,r,rival,9+7*strength,1.05,.20+.20*strength,sig.x,18+24*strength)){
        sig.hits++;
        if(distance<=groundPound.core){
          rival.air=.34;rival.hazardHop={at:st.time,duration:.34,height:.72};
        }
      }
    }
    sig.waveRadius=radius;
  }
  function hookable(st,r){
    return r && grounded(r) && !r.hawk && !r.spin && !(r.freezeUntil>st.time);
  }
  function hookTarget(st,r,length,starts){
    if(!hookable(st,r)||!starts)return null;
    const origin=starts[r.seat];
    let best=null,nearest=hookRange;
    for(const other of st.racers){
      if(other===r||!hookable(st,other)||other.protect>0||other.branch!==r.branch)continue;
      const point=starts[other.seat],along=gap(origin.progress,point.progress,length);
      // Both checks matter on hairpins, overpasses and forks whose road ribbons touch.
      if(Math.abs(along)>hookRange+1 || Math.abs(origin.contactY-point.contactY)>2.15)continue;
      const d=Math.hypot(origin.x-point.x,origin.contactY-point.contactY,origin.z-point.z);
      if(d<nearest){nearest=d;best=other;}
    }
    return best;
  }
  function releaseHook(st,r,label,clean){
    beat(r,st,label,clean?'release':'cut');r.active=0;r.fx=clean?.46:.22;
    if(clean)r.contactCarry=Math.max(r.contactCarry||0,r.v);
  }
  function blockHook(st,r,other){
    other.guard=0;other.protect=.65;
    other.signatureHit={id:11,at:st.time,side:Math.sign(other.x-r.x)||1,blocked:true};
    tell(other,'Guard broke the gravehook');releaseHook(st,r,'Gravehook deflected',false);
  }
  function checkHook(st,r,starts,length){
    const sig=r.signature;
    if(sig?.stage!=='latched')return;
    const other=st.racers[sig.target],a=starts[r.seat],b=starts[sig.target];
    if(!hookable(st,r)||!hookable(st,other)||other.protect>0||!b||
       other.driverIndex!==sig.targetDriver||r.human!==sig.pilot||other.human!==sig.targetPilot||
       r.branch!==sig.branch||other.branch!==sig.branch||
       Math.abs(gap(a.progress,b.progress,length))>hookRange+2.2||
       Math.hypot(a.x-b.x,a.contactY-b.contactY,a.z-b.z)>hookRange+2.2||Math.abs(a.contactY-b.contactY)>2.65){
      releaseHook(st,r,'Chain broken',false);return;
    }
    if(other.guard>0)blockHook(st,r,other);
  }
  function swing(st,r,dt,length,road,starts,advanceScale){
    const sig=r.signature;
    if(sig?.stage!=='latched')return;
    const other=st.racers[sig.target],pivot=starts[sig.target],start=starts[r.seat];
    const omega=sig.turn*(2.55+.28*r.steer*sig.side);
    sig.arc+=Math.abs(omega)*dt;sig.angle+=omega*dt;
    const sn=Math.sin(sig.angle),cs=Math.cos(sig.angle),radius=sig.radius;
    const lane=pivot.lane+sn*radius,room=road.w-.65;
    if(Math.abs(lane)>room && Math.abs(r.x)>room-.2 && Math.sign(lane)===Math.sign(r.x)){
      releaseHook(st,r,'Released at the edge',true);return;
    }
    // A velocity constraint follows the moving pivot. Normal track integration below
    // still resolves branch changes, ramp lips, collisions and lap crossings.
    const alongError=gap(start.progress,pivot.progress,length)+cs*radius;
    const forward=other.v+(-sn*radius*omega+alongError*7)/advanceScale;
    const lateral=other.vx+cs*radius*omega+(lane-r.x)*7;
    r.v+=cap(forward-r.v,-82*dt,82*dt);
    r.v=cap(r.v,-3.8,Math.max(12,other.v+12));
    r.vx+=cap(cap(lateral,-14,14)-r.vx,-92*dt,92*dt);
    r.contactCarry=Math.max(r.contactCarry||0,r.v);
    // A gentle outward nudge. The hooked kart keeps its throttle and steering.
    other.vx-=sn*2.1*dt;
    if(sig.arc>=swingArc||r.active<=0)releaseHook(st,r,'Gravehook slingshot',true);
  }
  function start(st,r,length,starts){
    const id=r.driverIndex, duration=durations[id];
    const hooked=id===11?hookTarget(st,r,length,starts):null;
    if(id===11&&!hooked){tell(r,'Move closer to a rival');return;}
    if(id===3&&r.bank<.15){tell(r,'Hold a turn to arm');return;}
    if(id===9&&!r.prevDrift){tell(r,'Start a drift to arm');return;}
    const sig=r.signature={stage:'active',label:names[id],since:st.time,until:st.time+duration,beat:st.time,s:r.s,x:r.x,branch:r.branch,mask:0,hits:0,charge:0,side:Math.abs(r.steer)>.22?Math.sign(r.steer):0,target:-1};
    r.meter=0;r.active=duration;r.fx=duration;tell(r,names[id]);
    if(id===0){sig.label='Reverse your turn';r.slip=0;r.burr=0;r.puff=0;}
    if(id===1){sig.label='Bumpers braced';}
    if(id===2){r.air=duration;sig.label='Level for landing';}
    if(id===3){sig.charge=cap(r.bank*.48,.17,.48);sig.label='Banking boost';}
    if(id===4){sig.label='Quills away';const pack=nearby(st,r,r.s,r.x,r.branch,length,quillFan.radius);quills(st,r,length,quillFan.core);if(!pack.length)boost(r,.48,4.1);}
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
    if(id===8){sig.label='Follow the gold line';tell(r,sig.label);}
    if(id===9){sig.label='Charge and release your drift';tell(r,sig.label);}
    if(id===10){r.guard=Math.max(r.guard,duration);sig.previousGuard=r.guard;}
    if(id===11){
      if(hooked.guard>0){blockHook(st,r,hooked);return;}
      const a=starts[r.seat],b=starts[hooked.seat],ds=gap(b.progress,a.progress,length),dx=a.lane-b.lane;
      sig.side=sig.side||((Math.abs(dx)>.55?Math.sign(dx):-Math.sign(b.lane))||1);
      sig.angle=Math.atan2(dx,ds);
      // Behind a rival, steering right swings via their right flank. Starting alongside
      // favors the forward tangent rather than forcing the racer back into the pack.
      sig.turn=Math.abs(ds)>.75*Math.abs(dx)?sig.side*(Math.sign(ds)||-1):-Math.sign(dx)||sig.side;
      sig.radius=cap(Math.hypot(ds,dx),2.55,3.55);sig.arc=0;
      sig.target=hooked.seat;sig.targetDriver=hooked.driverIndex;sig.targetPilot=hooked.human;sig.pilot=r.human;
      beat(r,st,'Latched · tap to release','latched');tell(hooked,'Grimoire latched on');
    }
  }
  function tick(st,r,dt,length,road,input){
    const hit=r.signatureHit;
    if(hit){
      const age=st.time-hit.at;
      // A brief, fading lateral force makes a check travel across the lane.
      // Steering remains active, so a quick countersteer can shorten the skid.
      if(hit.shove&&age>=0&&age<.42&&!r.ghost&&!r.fall)r.vx+=hit.side*hit.shove*(1-age/.42)*dt;
      if(age>.60)delete r.signatureHit;
    }
    const sig=r.signature;if(!sig)return;
    const age=st.time-sig.since, sinceBeat=st.time-sig.beat, id=r.driverIndex;
    const linger=id===8&&sig.stage==='release'&&r.guard>0?3:1.25;
    if(st.time>sig.until+linger){delete r.signature;return;}
    if(id===11&&sig.stage==='latched'&&input.ability&&!r.prevAbility&&age>0)releaseHook(st,r,'Chain released',true);
    if(id===10&&sig.stage==='active'){
      if(r.guard<=0&&sig.previousGuard>dt+.0001&&st.time<=sig.until){
        beat(r,st,'Halo counterboost','release');boost(r,1.15,8.1);
      }
      sig.previousGuard=r.guard;
    }
    if(id===0&&r.active>0&&sig.stage==='active'){
      if(Math.abs(r.steer)>.34){
        if(!sig.side)sig.side=Math.sign(r.steer);
        else if(r.steer*sig.side<-.4&&age>.13){beat(r,st,'Switchback boost','release');boost(r,.96,7.8);}
      }
    }
    if(id===2&&sig.stage==='active'&&r.air<=0){
      anchor(r);
      if(!r.fall&&!r.ghost&&Math.abs(r.steer)<.52&&Math.abs(r.x)<road.w-.35&&input.gas>.1){beat(r,st,'Clean landing','release');boost(r,1.08,8.6);}
      else beat(r,st,'Touchdown','land');
    }
    if(id===3&&sig.stage==='active'){
      if(Math.abs(r.steer)>.27)sig.charge=cap(sig.charge+dt*(.58+Math.abs(r.steer)*.30),0,1);
      if(age>.20&&(Math.abs(r.steer)<.25||r.active<=0)){
        beat(r,st,sig.charge>.78?'Perfect berm exit':'Berm release','release');
        boost(r,.47+sig.charge*1.35,4.2+sig.charge*6.8);r.active=0;r.fx=.72;
      }
    }
    if(id===4&&(sig.waveRadius||0)<quillFan.radius&&age<=quillFan.travel+.03)quills(st,r,length,quillFan.core+Math.min(1,age/quillFan.travel)*(quillFan.radius-quillFan.core));
    if(id===5&&r.active>0&&sig.stage==='active'&&sig.target>=0){
      const rival=st.racers[sig.target];
      if(rival&&rival.branch===r.branch&&gap(r.s,rival.s,length)<-.35){
        beat(r,st,'Slingshot pass','release');boost(r,1.18,10.3);r.v=Math.max(r.v,21.3);
      }
    }
    if(id===6&&r.stomp&&r.air<=0){
      anchor(r);r.slip=0;r.burr=0;r.slow=0;r.sap=0;r.puff=0;r.vx*=.32;r.stomp=false;
      beat(r,st,'Seismic impact','wave');groundWave(st,r,length,groundPound.core);
    }else if(id===6&&sig.stage==='wave'&&sig.waveRadius<groundPound.radius){
      groundWave(st,r,length,groundPound.core+Math.min(1,sinceBeat/groundPound.travel)*(groundPound.radius-groundPound.core));
    }
    if(id===7&&sig.stage==='active'&&r.active<=0){
      anchor(r);beat(r,st,'Tunnel breach','breach');wave(st,r,length,3.6,6.8,.88,.12);
      if(sig.hits)boost(r,.49,5.6);
    }
    if(id===8&&sig.stage==='active'){
      const onLine=Math.abs(r.x)<=road.w*.34&&r.v>3&&!r.ghost&&!r.hit&&!r.fall;
      if(onLine)sig.charge+=dt;
      if(r.active<=0){
        if(sig.charge>=durations[id]*.92){
          beat(r,st,'Sunburst shield','release');boost(r,1.25,8.8);r.guard=Math.max(r.guard,3);
        }
        else beat(r,st,'Gold line missed','miss');
      }
    }
    if(id===9&&sig.stage==='active'){
      const clean=r.v>7&&!r.spin&&!r.fall&&!r.ghost&&!r.flight&&r.air<=0&&Math.abs(r.x)<road.w-.15;
      if(clean&&r.active>0&&r.prevDrift){
        if(input.drift){sig.charge=cap(sig.charge+dt*(.48+r.driftSlip*.76),0,1);}
        else if(sig.charge>=.18){
          beat(r,st,'Prism release','release');boost(r,.82+sig.charge*.92,8.7+sig.charge*4.1);r.active=0;r.fx=.8;
        }
      }
      if(sig.stage==='active'&&(!clean||!input.drift||!r.prevDrift||r.active<=0)){
        beat(r,st,'Prism wake faded','miss');r.active=0;r.fx=0;
      }
    }
  }
  function brace(st,a,b){
    const r=a.driverIndex===1&&a.active>0?a:b.driverIndex===1&&b.active>0?b:null;
    if(!r||!r.signature)return false;
    const rival=r===a?b:a;
    if(rival.protect>0)return false;
    r.active=0;r.fx=.78;
    beat(r,st,'Shoulder check','release');
    if(impact(st,r,rival,17.5,1.05,.16,r.x,36))r.signature.hits++;
    boost(r,.72,6.8);return true;
  }
  return {names,durations,colors,groundPound,quillFan,gap,start,tick,brace,boost,advanceBoost,hookTarget,checkHook,swing};
});
