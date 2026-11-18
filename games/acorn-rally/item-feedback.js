(() => {
'use strict';
const {hawkItem,iconSrc}=window.AcornItemArt;
const roles=['Grip + burst','Sticky slowdown','Wheel snag','One-hit shield','Pack crosswind','Bouncing launcher','Sustained boost','8th-place airlift'];
const actions=['Grip restored','Sap fired','Burr planted','Shield raised','Lane swept','Pinecone skipping','Tailwind caught'];
const hits={1:'Sapped · motor slowed',2:'Burr snag · grip lost',4:'Thistle crosswind',5:'Pinecone impact',[hawkItem]:'Hawk impact'};
const confirms={1:'Sapped',2:'Snagged',4:'Swept',5:'Launched',[hawkItem]:'Clipped'};
const hawkLabels={swoop:'Hawk incoming',carry:'Hawk airlift',release:'Full-speed drop'};
const durations=window.AcornSim?.itemTimes||{sap:3.05,burr:1.72,puff:1.05,pine:1.23};
const voice=[
 [[200,.10,'triangle',390,0],[415,.21,'sawtooth',740,.06]],
 [[680,.09,'triangle',265,0],[260,.18,'sine',115,.09]],
 [[200,.06,'square',105,0],[290,.07,'triangle',170,.08],[370,.08,'triangle',140,.16]],
 [[235,.13,'triangle',175,0],[415,.26,'sine',630,.04]],
 [[830,.18,'sine',510,0],[1046,.3,'sine',755,.08]],
 [[210,.08,'triangle',138,0],[300,.07,'triangle',155,.11],[405,.07,'triangle',170,.21]],
 [[230,.32,'sine',465,0],[392,.47,'triangle',720,.12],[589,.55,'sine',810,.23]],
 [[1420,.31,'triangle',540,0],[760,.20,'sine',380,.07]]
];
const icons=[];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function art(i){if(!icons[i]){const im=new Image();im.src=iconSrc(i);icons[i]=im}return icons[i]}
function cue(sound,item){const notes=voice[item];if(notes)for(const [hz,sec,shape,end,delay] of notes)sound.tone(hz,sec,.031,shape,end,delay)}
function hawkCue(sound,phase){
 if(phase==='swoop')cue(sound,hawkItem);
 if(phase==='carry'){
  sound.tone(112,.33,.037,'triangle',350);sound.tone(410,.28,.025,'sine',710,.075);
 }
 if(phase==='release'){
  sound.tone(270,.22,.036,'triangle',115);sound.tone(540,.15,.019,'sine',270,.04);
 }
}
function impactCue(sound,id,blocked){
 const chords=blocked?[[188,.08,'square',66,0],[410,.15,'triangle',102,.04],[265,.12,'triangle',84,.09]]:
  ({1:[[140,.18,'sine',57,0],[485,.11,'triangle',165,.035]],2:[[402,.055,'square',178,0],[328,.075,'triangle',112,.046],[263,.08,'triangle',70,.103]],
    4:[[270,.18,'triangle',570,0],[774,.39,'sine',326,.05],[510,.37,'sine',185,.15]],
    5:[[162,.16,'triangle',42,0],[545,.085,'square',118,.014],[91,.28,'sine',40,.052]],
    [hawkItem]:[[132,.25,'triangle',51,0],[555,.14,'sawtooth',137,.018],[250,.16,'sine',95,.055]]})[id];
 for(const [hz,sec,shape,end,delay] of chords||[])sound.tone(hz,sec,.035,shape,end,delay);
}
function edgeImpact(ctx,w,h,id,timeLeft,blocked,compact){
 if(reduced.matches)return;
 const p=Math.max(0,Math.min(1,1-timeLeft/.8)),arc=Math.sin(Math.PI*p),amount=compact?4:9;
 ctx.save();ctx.globalAlpha=(1-p)*.78;
 for(let i=0;i<amount;i++){
  const side=i%2?1:-1,rank=(i*7%11)/11;
  const ix=side<0?0:w,x=ix-side*w*(.04+.12*rank+.08*arc),y=h*(.32+.56*((i*3%13)/13))+(id===1?p*p*h*.13:-arc*h*.065);
  const sz=(compact?3.5:5.5)*(1+rank*.9);
  ctx.save();ctx.translate(x,y);
  if(id===1&&!blocked){
   ctx.rotate(side*.50);ctx.fillStyle='#efa52c';ctx.beginPath();ctx.moveTo(0,-sz*1.4);ctx.bezierCurveTo(-sz*1.4,-sz*.12,-sz*.77,sz,0,sz);ctx.bezierCurveTo(sz*.9,sz,sz,-sz*.3,0,-sz*1.4);ctx.fill();
   ctx.fillStyle='#ffdf8a';ctx.beginPath();ctx.ellipse(-sz*.25,-sz*.1,sz*.19,sz*.28,0,0,Math.PI*2);ctx.fill();
  }else if(id===4&&!blocked){
   ctx.rotate(side*(.8+p));ctx.strokeStyle='#d9bcf4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,sz*1.7);ctx.lineTo(0,0);for(let k=-2;k<=2;k++){ctx.moveTo(0,0);ctx.lineTo(sz*k*.48,-sz*(1.4-Math.abs(k)*.25))}ctx.stroke();
  }else if(id===hawkItem&&!blocked){
   ctx.rotate(side*(.86+p*2.2));ctx.fillStyle=i%2?'#f5d4a8':'#ab7652';
   ctx.beginPath();ctx.moveTo(0,-sz*1.45);ctx.quadraticCurveTo(sz*.76,-sz*.53,0,sz*1.26);
   ctx.quadraticCurveTo(-sz*.62,sz*.26,0,-sz*1.45);ctx.fill();
   ctx.strokeStyle='#f8e4bc';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(0,sz*1.47);ctx.lineTo(0,-sz*.92);ctx.stroke();
  }else{
   ctx.rotate(side*(i*.9+p*2.5));ctx.fillStyle=blocked?(i%2?'#c8975f':'#825638'):id===2?(i%2?'#c8db82':'#88ac4e'):'#daa473';
   ctx.beginPath();ctx.moveTo(-sz*.3,sz);ctx.lineTo(sz*.7,sz*.3);ctx.lineTo(sz*.34,-sz*1.3);ctx.lineTo(-sz*.65,-sz*.06);ctx.closePath();ctx.fill();
  }
  ctx.restore();
 }
 ctx.restore();
}
function tintEdges(ctx,w,h,color,alpha){
 const grad=ctx.createRadialGradient(w*.5,h*.49,Math.min(w,h)*.27,w*.5,h*.49,Math.hypot(w,h)*.53);
 grad.addColorStop(0,color+'00');grad.addColorStop(1,color+Math.round(255*Math.min(.3,alpha)).toString(16).padStart(2,'0'));ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
}
function draw(ctx,w,h,r,time,compact){
 const fresh=r.itemFx>0,impact=r.itemHitFx>0,boost=r.boost>0&&(r.boostStyle==='seed'||r.boostStyle==='tailwind');
 const hawk=hawkLabels[r.hawkPhase],carrying=r.hawkPhase==='carry',rush=boost||carrying;
 const status=r.sap>0?1:r.burr>0&&r.slip>0?2:r.puff>0?4:r.pine>0?5:-1,remaining=({1:r.sap/durations.sap,2:r.burr/durations.burr,4:r.puff/durations.puff,5:r.pine/durations.pine})[status]||0;
 const confirmed=r.confirmFx>0;
 if(!hawk&&!fresh&&!impact&&!rush&&!confirmed&&status<0)return;
 const id=impact?(r.itemBlocked?3:r.itemHitKind):hawk?hawkItem:status>=0?status:fresh?r.usedItem:confirmed?r.confirmedItem:r.boostStyle==='seed'?0:6;
 const col=window.AcornItemArt.colors[id];if(!col)return;
 ctx.save();
 const temporal=impact?Math.min(1,r.itemHitFx*4):hawk?1:fresh?Math.min(1,r.itemFx*3):.5;
 if(impact||rush)tintEdges(ctx,w,h,col,.28*temporal);
 if(impact)edgeImpact(ctx,w,h,id,r.itemHitFx,r.itemBlocked,compact);
 if(rush&&!reduced.matches){
  const hwind=r.boostStyle==='tailwind'&&!carrying,amount=compact?5:10;
  ctx.lineCap='round';
  for(let i=0;i<amount;i++){
   const side=i%2?1:-1,shift=(time*(carrying?2.35:hwind?.68:1.7)+i*.293)%1;
   const x=side<0?0:w,y=h*(.22+.72*((i*.193)%1));ctx.globalAlpha=(1-shift)*.50;
   ctx.beginPath();ctx.lineWidth=hwind?1.8:2.4;ctx.strokeStyle=col;
   if(hwind){const e=side<0?w*.135:w*.865;ctx.moveTo(e,y);ctx.quadraticCurveTo(x-side*w*.04,y-h*.04,x+side*w*.02,y+h*.16*shift)}
   else{ctx.moveTo(x-side*w*(.05+.1*(1-shift)),y-h*.02);ctx.lineTo(x+side*w*.03,y+(y-h*.43)*.14)}
   ctx.stroke();
  }
 }
 ctx.globalAlpha=1;
 if(hawk||fresh||impact||status>=0){
  let label=impact?(r.itemBlocked?'Hit absorbed':hits[id]):hawk||(status>=0?hits[status]:actions[id]);
  if(status===4&&id===4)label='Crosswind · steer '+(r.puffSide>0?'left':'right');
  if(status===5&&id===5)label=r.air>0?'Launched by pinecone':'Regaining speed';
  if(label){
   const size=compact?19:28;font(ctx,compact?13:17);const tw=ctx.measureText(label).width,boxw=tw+size+(compact?18:22),boxh=compact?24:35;
   const x=(w-boxw)/2,y=h*(compact?.22:.235);
   ctx.globalAlpha=status===id?Math.min(1,remaining*11):temporal;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,boxw,boxh,5):ctx.rect(x,y,boxw,boxh);ctx.fillStyle='#1c241ded';ctx.fill();
   ctx.fillStyle=col;ctx.fillRect(x,y+4,2,boxh-8);const img=art(id);if(img.complete&&img.naturalWidth)ctx.drawImage(img,x+5,y+(boxh-size)/2,size,size);
   ctx.fillStyle='#fff7e8';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,x+size+10,y+boxh/2+.5);
   if(carrying&&!impact||status===id){
    const progress=carrying&&!impact?Math.max(0,1-(r.hawkPhaseT||0)):remaining;
    ctx.fillStyle='#162015';ctx.fillRect(x+3,y+boxh-3,boxw-6,2);ctx.fillStyle=col;ctx.fillRect(x+3,y+boxh-3,(boxw-6)*progress,2);
   }
  }
 }
 if(confirmed){
  const it=r.confirmedItem,tone=window.AcornItemArt.colors[r.confirmedBlocked?3:it],label=r.confirmedBlocked?r.confirmedName+' blocked it':(confirms[it]||'Hit')+' '+r.confirmedName;
  const size=compact?17:23;font(ctx,compact?13:16);const width=ctx.measureText(label).width+size+19,height=compact?23:30;
  const x=w-width-(compact?10:24),y=h*(compact?.36:.39);
  ctx.globalAlpha=Math.min(1,r.confirmFx*4);ctx.fillStyle='#18231df0';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,width,height,5):ctx.rect(x,y,width,height);ctx.fill();
  const im=art(r.confirmedBlocked?3:it);if(im.complete&&im.naturalWidth)ctx.drawImage(im,x+4,y+(height-size)/2,size,size);
  ctx.fillStyle=tone;ctx.fillRect(x+width-2,y+4,2,height-8);ctx.fillStyle='#fff7e8';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,x+size+9,y+height*.52);
 }
 ctx.restore();
}
function confirmCue(sound,blocked){sound.tone(blocked?295:660,.075,.026,'sine',blocked?220:770);sound.tone(blocked?210:880,.12,.025,'triangle',blocked?150:1050,.075);}
function font(ctx,n){ctx.font='700 '+n+'px Condensed, sans-serif'}
window.AcornFeedback={roles,draw,cue,hawkCue,impactCue,confirmCue};
})();
