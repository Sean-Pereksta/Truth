(function(root){
  'use strict';
  const tau=Math.PI*2,clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
  const colors=root.AcornSignatures.colors;
  function meshes(Mesh){
    const models={};
    function make(name){return models[name]=new Mesh();}
    function bar(m,p,q,r,color,mat=5){m.ring(p,q,r,r,color,5,mat);}
    function loop(m,r,w,y,co,arcs=1,sections=28){
      for(let i=0;i<sections;i++){
        if(arcs>1&&i%arcs===arcs-1)continue;
        const a=tau*i/sections,b=tau*(i+1)/sections;
        m.quad([Math.sin(a)*r,y,Math.cos(a)*r],[Math.sin(b)*r,y,Math.cos(b)*r],
          [Math.sin(b)*(r-w),y+.008,Math.cos(b)*(r-w)],[Math.sin(a)*(r-w),y+.008,Math.cos(a)*(r-w)],co,5);
      }
    }
    function trail(m,len,width,col,shine){
      const p=(t,side)=>[Math.sin(t*2.8)*width*.55+side*width*(1-t*.89),.08+.09*Math.sin(t*Math.PI),-len*t];
      for(let j=0;j<7;j++){const a=j/7,b=(j+1)/7;m.quad(p(a,-1),p(a,1),p(b,1),p(b,-1),col,5);
        bar(m,p(a,.05),p(b,.05),.016,shine);}
    }
    const needle=make('sigNeedle');
    needle.ring([0,.05,-.74],[0,.11,.77],.012,.052,'#aeeef2',6,5);
    needle.ring([0,.11,.77],[0,.13,1.08],.052,0,'#fff8d8',6,5);
    const thread=make('sigThread');trail(thread,1.4,.10,'#4dbcc5','#d7fffb');
    const bumper=make('sigBumper');
    for(const side of [-1,1]){
      const x=side*.83;
      for(const y of [.26,.53]){bar(bumper,[x,y,-.83],[x,y,.72],.065,'#eab266',2);
        bar(bumper,[x,y,.72],[x*.73,y,1.03],.065,'#ffe0a1',2);}
      for(const z of [-.68,-.02,.64]){bumper.box(x-.047,.23,z,.095,.39,.17,0,'#78543a',2);bumper.blob(x+side*.055,.41,z,.038,.04,.04,'#fce6a3',6,5);}
    }
    const spring=make('sigSpring');
    for(let n=0;n<22;n++){const p=j=>[Math.cos(j/22*tau*2.5)*.32,.09+j/22*.88,Math.sin(j/22*tau*2.5)*.32];
      bar(spring,p(n),p(n+1),.041,n%4===0?'#fff0d2':'#c49af7');}
    const paw=make('sigPaw');paw.blob(0,.025,0,.14,.02,.25,'#e7c6ff',8,5);
    for(let i=-1;i<=1;i++)paw.blob(i*.126,.025,.24-Math.abs(i)*.045,.052,.027,.082,'#f9deff',6,5);
    const leaf=make('sigLeaf');
    leaf.tri([0,.01,-.4],[-.19,.09,.02],[0,.13,.43],'#139873',5);
    leaf.tri([0,.01,-.4],[0,.13,.43],[.19,.06,.02],'#8bf0ad',5);
    bar(leaf,[0,.11,-.35],[0,.13,.43],.018,'#e6ffb2');
    const berm=make('sigBerm');trail(berm,1.25,.14,'#22aa86','#adffd3');
    const spine=make('sigSpine');
    spine.ring([0,.03,-.42],[0,.08,-.17],.018,.088,'#754129',7,2);
    spine.ring([0,.08,-.17],[0,.12,.12],.088,.071,'#faaf4f',7,2);
    spine.ring([0,.12,.12],[0,.16,.67],.071,0,'#ffe8a1',7,5);
    const ember=make('sigEmber');trail(ember,1.8,.16,'#f65d42','#ffe7ac');
    const chevron=make('sigChevron');for(const s of [-1,1])bar(chevron,[s*.54,.03,-.28],[0,.035,.28],.044,'#ffae7f');
    const fault=make('sigFault');
    for(let j=0;j<14;j++){
      const angle=j/14*tau,point=(rad,offset,y)=>[Math.sin(angle+offset)*rad,y,Math.cos(angle+offset)*rad];
      const a=point(.55,0,.015),b=point(.81,.045,.025),d=point(1,-.025,.04);
      bar(fault,a,b,.022,'#6d593d',2);bar(fault,b,d,.018,'#e1d69a');
    }
    const dirt=make('sigDirt');dirt.blob(0,.04,0,.20,.15,.22,'#8a6647',6,2,.3);
    dirt.blob(.115,.092,.07,.10,.073,.12,'#c69c6a',5,2);
    const lantern=make('sigLamp');lantern.blob(0,0,0,.10,.12,.1,'#ffe6a1',8,5);
    const sunMark=make('sigSunMark');
    sunMark.quad([0,.04,.34],[.12,.04,0],[0,.04,-.34],[-.12,.04,0],'#ffce6c',5);
    bar(sunMark,[0,.06,-.17],[0,.06,.17],.025,'#fff3c9');
    trail(make('sigPrismIce'),1.9,.15,'#72dff0','#f3fdff');
    trail(make('sigPrismViolet'),1.9,.13,'#aa7cfa','#edcaff');
    for(const [id,co] of colors.entries()){const ring=make('sigRing'+id);loop(ring,1,.043,.02,co,6,30);loop(ring,.955,.015,.02,'#fff1c3',6,30);}
    return models;
  }
  function render(st,r,emit,courseLength){
    const hit=r.signatureHit,hitAge=hit?st.time-hit.at:2;
    if(hitAge>=0&&hitAge<.58){
      const t=hitAge/.58;
      emit('sigRing'+hit.id,r.s,r.x,.2+t*.48,0,.6+t*1.0,(1-t)*.92);
      if(!hit.blocked)for(let j=0;j<6;j++){const a=(j*.145-.36)*Math.PI;
        const kind=hit.id===4?'sigSpine':hit.id===7||hit.id===6?'sigDirt':'sigLeaf';
        emit(kind,r.s+Math.sin(a)*t*1.7,r.x+hit.side*Math.cos(a)*(.6+t*1.6),.55+Math.sin(t*Math.PI)*.8,a,.36+(1-t)*.40,1-t);}
    }
    const s=r.signature;if(!s)return;
    const id=r.driverIndex,time=st.time,age=Math.max(0,time-s.since),beat=Math.max(0,time-s.beat),phase=age/root.AcornSignatures.durations[id];
    const here=(mesh,d,l,y,ang,size,alpha,stretch)=>emit(mesh,r.s+d,r.x+l,y,ang,size,alpha,stretch,r.branch);
    const at=(mesh,d,l,y,ang,size,alpha,stretch)=>emit(mesh,s.s+d,s.x+l,y,ang,size,alpha,stretch,s.branch);
    function wake(kind,count,spread=1){
      for(let j=0;j<count;j++){
        const t=(time*2+j/count)%1,sgn=j%2?1:-1;
        here(kind,-.6-t*(1.5+spread),sgn*(.43+t*.25),.1+t*.09,-sgn*.09,1.05-t*.44,(1-t)*.81, [1,1,spread]);
      }
    }
    if(id===0&&r.active>0){
      const side=Math.sign(r.steer)||s.side||1;
      for(let i=0;i<6;i++){const u=(i+.55)/6;
        here(i===5?'sigNeedle':'sigThread',.68+u*4.9,side*u*u*2.1,.07,side*u*.73,i===5?.79:.75,.43+u*.45);}
      if(s.stage==='release'&&beat<.55)wake('sigThread',4,1.4);
    }
    if(id===1){
      if(r.active>0){here('sigBumper',0,0,.03,0,1,.96,[1.13,1.08,1]);here('sigRing1',0,0,.08,0,1.15+.03*Math.sin(time*9),.59,[1,1,1.29]);}
      if(s.stage==='release'&&beat<.60){const t=beat/.60;here('sigRing1',0,0,.39,0,1+2.8*t,1-t);wake('sigThread',4);}
    }
    if(id===2){
      if(s.stage==='active'&&phase<=1){
        if(phase<.76){at('sigRing2',0,0,.075,0,.66+phase*1.6,1-phase);for(const side of [-1,1])at('sigPaw',0,side*.43,.095,side*.14,.95,.95-phase*.6);}
        const height=Math.sin(Math.PI*clamp(phase));
        for(const side of [-1,1])here('sigSpring',-.31,side*.53,.15,0,.72, .49+height*.38,[1,.45+height*1.55,1]);
      }
      if((s.stage==='release'||s.stage==='land')&&beat<.55){const t=beat/.55;at('sigRing2',0,0,.07,0,.65+t*2.4,1-t);
        for(const side of [-1,1])at('sigPaw',.32,side*.37,.095,side*.19,1,.84*(1-t));}
    }
    if(id===3){
      if(s.stage==='active'&&r.active>0){const count=3+Math.floor(s.charge*5);for(let j=0;j<count;j++){
        const a=time*3.5+j/count*tau;here('sigLeaf',Math.cos(a)*1.13,Math.sin(a)*1.07,.40+.11*Math.sin(a*2),a,.53+s.charge*.24,.90);}
        wake('sigBerm',3,.78);}
      if(s.stage==='release'&&beat<1.04){wake('sigBerm',6,1.7);if(beat<.38)here('sigRing3',-.68,0,.15,0,.62+beat*3,1-beat/.38);}
    }
    if(id===4&&age<.67){
      const fan=root.AcornSignatures.quillFan,t=clamp(age/fan.travel),rad=fan.core+(fan.radius-fan.core)*t;
      at('sigRing4',0,0,.09,0,rad,Math.max(0,.62-age*.84));
      for(let j=0;j<15;j++){const a=j/15*tau;at('sigSpine',Math.cos(a)*rad,Math.sin(a)*rad,.23+Math.sin(t*Math.PI)*.35,a,.94,clamp((.67-age)/.22));}
    }
    if(id===5&&((s.stage==='active'&&r.active>0)||(s.stage==='release'&&beat<.9))){
      wake('sigEmber',s.target>=0?7:4,s.stage==='release'?2.0:1.35);
      const target=st.racers[s.target];
      if(target&&s.stage==='active'&&target.branch===r.branch){
        const delta=root.AcornSignatures.gap(r.s,target.s,courseLength);
        if(delta>1&&delta<21){
          here('sigRing5',delta,target.x-r.x,.09,-time,.96,.78,[1,1,1.24]);
          for(let j=1;j<=3;j++){const u=j/4;here('sigChevron',delta*u,(target.x-r.x)*u,.08,0,.81+u*.22,.68+.17*Math.sin(time*8+j));}
        }
      }
    }
    if(id===6){
      if(s.stage==='active'&&r.stomp)here('sigRing6',0,0,.07,0,1.3-age,.88);
      if(s.stage==='wave'&&beat<.92){const wave=root.AcornSignatures.groundPound,t=clamp(beat/wave.travel),rad=wave.core+t*(wave.radius-wave.core),fade=clamp((.92-beat)/.43);
        at('sigFault',0,0,.05,0,rad,fade*.82);
        at('sigRing6',0,0,.09,0,rad,fade*.85);
        if(beat<.35)at('sigRing6',0,0,.16+beat*.8,0,wave.core*(.50+beat*1.3),1-beat/.35);
        for(let j=0;j<12;j++){const a=tau*j/12;at('sigDirt',Math.cos(a)*rad*.87,Math.sin(a)*rad*.87,.13+Math.sin(t*Math.PI)*1.24,a+t,1.0+(j%3)*.28,fade);}
      }
    }
    if(id===8&&s.stage==='active'&&r.active>0){
      for(let j=0;j<7;j++)here('sigSunMark',2.5+j*2.6,-r.x,.06,0,.90,.88-j*.07);
      here('sigRing8',0,0,.1,0,.86,.5+clamp(s.charge/1.5)*.35);
    }
    if(id===8&&s.stage==='release'&&beat<.80){
      for(const side of [-1,1])for(let j=0;j<4;j++){
        const t=(beat*2.8+j/4)%1;here('sigSunMark',-.6-t*2.6,side*(.4+t*.26),.23+t*.12,0,.63,1-t);
      }
    }
    if(id===8&&s.stage==='release'&&r.guard>0&&beat<3){
      const glow=.66+Math.sin(time*7)*.13;
      here('sigRing8',0,0,.32,0,1.10,glow,[1,1,1.36]);
      for(let j=0;j<3;j++){const a=time*2.3+j*tau/3;
        here('sigSunMark',1.34*Math.cos(a),1.10*Math.sin(a),.34+.20*Math.sin(a),a,.6,glow);}
    }
    if(id===9){
      if(s.stage==='active'&&r.active>0){
        wake('sigPrismIce',4,.9+s.charge*.75);
        here('sigRing9',-.4,0,.075,0,.62+s.charge*.47,.36+s.charge*.49);
      }
      if(s.stage==='release'&&beat<.82){
        wake('sigPrismIce',6,2.0);wake('sigPrismViolet',5,1.5);
        if(beat<.42)here('sigRing9',-.7,0,.14,0,.48+beat*3,1-beat/.42);
      }
    }
    if(id===10 && s.stage==='active' && r.guard>0 && r.active>0){
      here('sigRing10',0,0,1.86+.05*Math.sin(time*7),0,.57,.87);
      for(const side of [-1,1])here('sigSunMark',0,side*1.03,.78,side*.42,.77,.85);
    }
    if(id===10 && s.stage==='release' && beat<.75){
      for(const side of [-1,1])for(let j=0;j<3;j++){
        const t=(beat*2+j/3)%1;
        here('sigSunMark',-.9-t*2.4,side*(.4+t*.45),.52-t*.38,side*.3,.65,1-t);
      }
    }
    if(id===7){
      if(r.active>0){here('sigLamp',.77,0,.15,0,1.42,.98);here('sigRing7',.25,0,.08,0,.75,.55,[1,1,1.46]);
        for(let j=0;j<8;j++){const t=(time*2.7+j/8)%1,sign=j%2?1:-1;
          here('sigDirt',.66-t*3.6,sign*(.32+t*.42),.08+Math.sin(t*Math.PI)*.37,t*3,.65+(1-t)*.53,1-t*.75);}}
      if(s.stage==='breach'&&beat<.55){const t=beat/.55;at('sigRing7',0,0,.08,0,.8+2.8*t,1-t);
        for(let j=0;j<9;j++){const a=tau*j/9,rad=.52+t*2.0;at('sigDirt',Math.cos(a)*rad,Math.sin(a)*rad,.13+Math.sin(t*Math.PI)*1.15,a+t*3,1-t*.55,1-t);}}
    }
  }
  // Project large ground effects on the road; a billboard ring can cross the horizon.
  function groundGlyph(ctx,name,s,x,height,angle,size,alpha,stretch,project){
    const ring=name.startsWith('sigRing');if(!ring&&name!=='sigFault')return false;
    const point=(a,f)=>{
      const dx=Math.sin(a)*size*f*(stretch?.[0]||1),ds=Math.cos(a)*size*f*(stretch?.[2]||1),co=Math.cos(angle),si=Math.sin(angle);
      return project(s+ds*co-dx*si,x+dx*co+ds*si,height);
    };
    function line(p,q,color,width){
      if(p.z<.95||q.z<.95)return;
      ctx.strokeStyle=color;ctx.lineWidth=clamp((p.k+q.k)*.5*width*size,.72,5.5);
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    }
    ctx.save();ctx.globalAlpha=clamp(alpha);ctx.lineCap='round';
    if(ring)for(let i=0;i<36;i++){if(i%6===5)continue;line(point(tau*i/36,1),point(tau*(i+1)/36,1),colors[Number(name.slice('sigRing'.length))],.035);}
    else for(let i=0;i<14;i++){const a=tau*i/14,b=point(a+.045,.8);line(point(a,.58),b,'#776444',.027);line(b,point(a-.025,1),'#dfd59e',.018);}
    ctx.restore();return true;
  }
  // The fallback uses the exact same timing, track anchors and effect radii.
  function glyph(ctx,name,x,y,scale,angle,alpha,stretch){
    if(scale<.3||alpha<.035)return;
    ctx.save();ctx.translate(x,y);ctx.scale(scale*(stretch?.[0]||1),scale*.48*(stretch?.[2]||1));ctx.globalAlpha=clamp(alpha);
    ctx.lineWidth=.045;ctx.lineCap='round';ctx.lineJoin='round';
    if(name.startsWith('sigRing')){ctx.strokeStyle=colors[Number(name.slice('sigRing'.length))];ctx.setLineDash([.32,.12]);ctx.beginPath();ctx.arc(0,0,1,0,tau);ctx.stroke();}
    else if(name==='sigBumper'){ctx.strokeStyle='#ffd49a';ctx.lineWidth=.09;for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(d*.91,.62);ctx.lineTo(d*.91,-.72);ctx.lineTo(d*.65,-1.02);ctx.stroke();}}
    else if(name==='sigFault'){ctx.strokeStyle='#ced390';for(let j=0;j<12;j++){const a=tau*j/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*.55,Math.sin(a)*.55);ctx.lineTo(Math.cos(a+.06)*.83,Math.sin(a+.06)*.83);ctx.lineTo(Math.cos(a)*.99,Math.sin(a)*.99);ctx.stroke();}}
    else if(name==='sigSpring'){ctx.strokeStyle='#ddc4ff';ctx.lineWidth=.07;ctx.beginPath();for(let j=0;j<34;j++){const a=j/33*tau*2.5;const xx=Math.cos(a)*.32,yy=-j/33+Math.sin(a)*.15;if(!j)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();}
    else if(name==='sigPaw'){ctx.fillStyle='#eccdff';for(const [xx,yy,rr] of [[0,0,.22],[-.16,-.24,.075],[0,-.29,.08],[.16,-.24,.075]]){ctx.beginPath();ctx.arc(xx,yy,rr,0,tau);ctx.fill();}}
    else if(name==='sigLamp'||name==='sigDirt'){ctx.fillStyle=name==='sigLamp'?'#ffdf9c':'#af8863';ctx.beginPath();ctx.ellipse(0,0,name==='sigLamp'?.12:.24,.16,angle,0,tau);ctx.fill();}
    else{ctx.rotate(-angle);ctx.beginPath();
      if(name==='sigChevron'){ctx.strokeStyle='#ffaf7f';ctx.lineWidth=.09;ctx.moveTo(-.52,.22);ctx.lineTo(0,-.27);ctx.lineTo(.52,.22);ctx.stroke();}
      else{const color={sigSpine:'#ffe17d',sigNeedle:'#e2fff8',sigThread:'#89ece8',sigLeaf:'#85f2ae',sigBerm:'#55e1ac',sigEmber:'#ff8568',sigSunMark:'#ffcd70',sigPrismIce:'#72dff0',sigPrismViolet:'#aa7cfa'}[name]||'#fff3ba';
        const length=name==='sigEmber'?1.65:name==='sigSpine'?.81:1.03;ctx.fillStyle=color;ctx.moveTo(0,-length*.61);ctx.lineTo(.12,0);ctx.lineTo(.02,length*.72);ctx.lineTo(-.095,0);ctx.closePath();ctx.fill();}}
    ctx.restore();
  }
  root.AcornSignatureArt={meshes,render,glyph,groundGlyph};
})(typeof globalThis==='object'?globalThis:this);
