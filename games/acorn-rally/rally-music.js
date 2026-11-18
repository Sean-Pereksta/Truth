(function(root){
  'use strict';

  // The hub theme uses MIDI pitches, with one melody cell per eighth note.
  const menuBars=[
    [[43,55,59,62],[74,0,76,0,79,0,76,0]],
    [[42,54,57,62],[74,0,0,69,71,0,74,0]],
    [[40,55,59,64],[76,0,79,0,83,81,79,0]],
    [[48,55,60,64],[76,0,0,74,72,0,0,0]],
    [[45,55,60,64],[69,0,72,0,76,74,72,0]],
    [[47,55,59,62],[71,0,74,0,79,0,77,0]],
    [[48,55,60,64],[76,0,72,0,74,76,79,0]],
    [[50,54,57,60],[81,0,78,0,74,0,0,0]],
    [[43,55,59,62],[74,0,76,0,79,0,83,0]],
    [[42,54,57,62],[81,0,0,78,76,0,74,0]],
    [[40,55,59,64],[71,0,76,0,79,81,79,0]],
    [[48,55,60,64],[76,0,0,74,72,0,67,0]],
    [[45,55,60,64],[69,72,76,0,81,0,79,0]],
    [[48,55,60,64],[76,0,79,0,72,0,74,0]],
    [[50,54,57,60],[78,0,76,74,69,0,71,0]],
    [[43,55,59,62],[67,0,0,0,0,0,71,0]]
  ];
  function arrangeMenu(){
    const quarter=.6,events=[];
    const add=(beat,voice,pitch,length,volume,pan)=>events.push({time:beat*quarter,voice,pitch,length:length*quarter,volume,pan});
    for(let bar=0;bar<menuBars.length;bar++){
      const [chord,melody]=menuBars[bar],start=bar*4;
      for(let i=0;i<melody.length;i++){
        if(!melody[i])continue;
        const length=melody[i+1]?.55:melody[i+2]?1.0:1.65;
        add(start+i*.5,'flute',melody[i],length,.24*(i%2?.79:1),-.1);
      }
      add(start,'bass',chord[0],1.7,.24,0);
      add(start+2,'bass',chord[0]+12,1.3,.17,0);
      const contour=bar%4===3?[1,3,2,1]:[1,2,3,2];
      for(let i=0;i<contour.length;i++)add(start+.46+i*.87,'marimba',chord[contour[i]],1.05,i%2?.14:.18,.28);
      if(bar%2)add(start+3.5,'brush',0,.31,.075,.36);
    }
    return {events:events.sort((a,b)=>a.time-b.time),length:quarter*menuBars.length*4};
  }

  // Bass entries are [beat, interval]. Kicks, snares, hats and accents are beat positions.
  const grooves={
    folk:{
      bass:[[0,0],[.5,7],[1.25,12],[2,0],[2.5,7],[3.25,12],[3.75,7]],
      chords:[.5,1.5,2.5,3.5],pattern:'strum',
      kicks:[0,1.75,2.5],snares:[1,3],hats:[.5,1.5,2.5,3.5],wood:[[.75,64],[2.75,69]]
    },
    pan:{
      bass:[[0,0],[.75,12],[1.5,7],[2.25,0],[2.75,7],[3.5,12]],
      chords:[.25,1,1.75,2.5,3.25,3.75],pattern:'arpeggio',
      kicks:[0,1.5,2.75],snares:[1,3],hats:[.5,1.5,2,2.5,3.5],wood:[[.75,68],[1.75,73],[2.25,64],[3.75,71]]
    },
    waltz:{
      bass:[[0,0],[.75,7],[1.5,12],[2,7],[2.5,12]],
      chords:[.5,1,1.75,2,2.5],pattern:'strum',
      kicks:[0,2.5],snares:[1,2],hats:[.5,1.5,2.5],wood:[[.75,59],[1.75,66]]
    },
    gallop:{
      bass:[[0,0],[.5,7],[.75,12],[1.5,7],[2,0],[2.5,7],[2.75,12],[3.5,7]],
      chords:[.25,1,1.75,2.25,3,3.75],pattern:'arpeggio',
      kicks:[0,.75,2,2.75],snares:[1,3],hats:[.5,1.5,1.75,2.5,3.5],wood:[[1.25,65],[3.25,68]]
    },
    glide:{
      bass:[[0,0],[.75,12],[1.5,7],[2,0],[2.75,12],[3.5,7]],
      chords:[.25,.75,1.75,2.25,2.75,3.75],pattern:'arpeggio',
      kicks:[0,1,2,3],snares:[1,3],hats:[.5,1.5,2.5,3.5,3.75],wood:[[1.75,77],[3.25,72]]
    },
    stomp:{
      bass:[[0,0],[.5,0],[1,7],[1.75,0],[2,12],[2.5,7]],
      chords:[0,.75,1.5,2.25,2.75],pattern:'block',
      kicks:[0,.75,1.75,2.5],snares:[1,2],hats:[.25,.5,1.5,2.5],wood:[[.5,49],[1.75,55],[2.75,62]]
    },
    rush:{
      bass:[[0,0],[.5,12],[1.25,7],[1.75,12],[2,0],[2.5,12],[3.25,7],[3.75,12]],
      chords:[.5,1.25,1.75,2.5,3.25,3.75],pattern:'arpeggio',
      kicks:[0,1.5,2,2.75],snares:[1,3],hats:[.5,.75,1.5,2.5,3.5,3.75],wood:[[1.25,65],[3.25,72]]
    },
    surf:{
      bass:[[0,0],[.5,12],[1,7],[1.5,12],[2,0],[2.5,12],[3,7],[3.5,12]],
      chords:[.5,1.5,2.5,3.5],pattern:'strum',
      kicks:[0,1.5,2,2.75],snares:[1,3],hats:[0,.5,1,1.5,2,2.5,3,3.5],wood:[[1.75,58],[3.75,67]]
    }
  };
  const semitones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function notation(token){
    if(token==='.')return 0;
    if(token==='-')return -1;
    const [,letter,accidental,octave]=/^([A-G])([#b]?)(\d)$/.exec(token);
    return 12*(Number(octave)+1)+semitones[letter]+(accidental==='#'?1:accidental==='b'?-1:0);
  }
  function melodyCell(cell){
    const notes=cell.split('/').map(notation);
    return notes.length===2?notes:[notes[0],notes[0]===0?0:-1];
  }
  function arrangeCourse(score){
    const {bars,bpm,beats,lead,answer,backing,groove}=score,shape=grooves[groove];
    const quarter=60/bpm,events=[];
    const add=(beat,voice,pitch,length,volume,pan)=>events.push({time:beat*quarter,voice,pitch,length:length*quarter,volume,pan});
    for(let bar=0;bar<bars.length;bar++){
      const [harmony,phrase]=bars[bar],chord=harmony.split(' ').map(notation),melody=phrase.split(' ').flatMap(melodyCell);
      const start=bar*beats,bridge=bar>=bars.length/2&&bar<bars.length*3/4,reprise=bar>=bars.length*3/4;
      const instrument=bridge?answer:lead;
      const counter=bridge?lead:answer;
      const fill=bar%4===3;
      const chordIntervals=chord.slice(1).map(pitch=>(pitch-chord[0]+120)%12);
      const passingNote=chordIntervals.reduce((best,interval)=>Math.abs(interval-7)<Math.abs(best-7)?interval:best);
      for(let i=0;i<melody.length;i++){
        if(melody[i]<=0)continue;
        let held=1;
        while(melody[i+held]===-1)held++;
        const accent=i%4===0?1.12:i%2?.84:1;
        add(start+i*.25,instrument,melody[i],held*.25*.89,.31*accent,-.13);
        if(reprise&&i===0&&counter!==instrument)add(start+.024,counter,melody[i]-12,.26,.13,.26);
      }
      if(bridge){
        add(start+.75,counter,chord[2]+12,.19,.10,.30);
        add(start+beats-.75,counter,chord[3]+12,.19,.12,.30);
      }
      for(const [beat,interval] of shape.bass){
        add(start+beat,'raceBass',chord[0]+(interval===7?passingNote:interval),beat%1?.18:.31,interval?.20:.28,0);
      }
      for(let i=0;i<shape.chords.length;i++){
        const beat=shape.chords[i];
        if(shape.pattern==='arpeggio'){
          add(start+beat,backing,chord[1+i%3],.31,bridge?.115:.164,.29);
          if(reprise&&i===0)add(start+beat+.13,backing,chord[3]+12,.23,.092,.4);
        }else{
          const spread=shape.pattern==='strum'?.027:.008;
          for(let tone=1;tone<4;tone++)add(start+beat+(tone-1)*spread,backing,chord[tone],.23,bridge?.075:.094,.26);
        }
      }
      for(const beat of shape.kicks)add(start+beat,'kick',0,.37,beat===0?.34:.25,0);
      for(const beat of shape.snares)add(start+beat,'snare',0,.31,.28,-.08);
      for(const beat of shape.hats)add(start+beat,'hat',0,.20,beat%1===.5?.18:.11,.36);
      for(const [beat,pitch] of shape.wood)add(start+beat,'wood',pitch,.21,.14,-.28);
      if(fill){
        add(start+beats-.5,'snare',0,.14,.15,.17);
        add(start+beats-.25,'snare',0,.19,.23,-.08);
      }else if(bar===0||bar===bars.length/2||bar===bars.length*3/4){
        add(start,'crash',0,.7,.20,.21);
      }
    }
    return {events:events.sort((a,b)=>a.time-b.time),length:quarter*bars.length*beats};
  }
  const songs={menu:arrangeMenu()};
  for(const [index,score] of Object.entries(root.AcornCourseScores||{}))songs['course-'+index]=arrangeCourse(score);

  const sampleRate=22050,tau=2*Math.PI;
  const heldVoices=new Set(['flute','reed','fiddle','whistle','organ']);
  const drumVoices=new Set(['brush','wood','kick','snare','hat','crash']);
  const samples=new Map();
  let context=null,master=null,playback=null,timer=null;
  let scene='menu',enabled=true,paused=false,savedPosition=0;

  function sample(voice,pitch){
    const key=voice+':'+pitch;
    if(samples.has(key))return samples.get(key);
    const held=heldVoices.has(voice),drum=drumVoices.has(voice);
    const duration=held?2.1:voice==='bell'?1.72:voice==='bass'?1.27:voice==='crash'?.48:drum?.29:.79;
    const hz=440*2**((pitch-69)/12),buffer=context.createBuffer(1,Math.ceil(sampleRate*duration),sampleRate),data=buffer.getChannelData(0);
    let seed=11217+pitch*713,breath=0,previous=0;
    for(let i=0;i<data.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=seed/2147483648-1,t=i/sampleRate,phase=tau*hz*t;
      breath+=.42*(noise-breath);
      const attack=Math.min(1,t/(held?.031:drum?.0025:.006));
      const tail=Math.min(1,(duration-t)/.034);
      let value;
      if(voice==='flute'||voice==='reed'){
        const vibrato=Math.sin(t*tau*(voice==='flute'?5.1:5.8))*Math.min(t*1.4,1)*.11;
        const a=phase+vibrato;
        value=Math.sin(a)*.43+Math.sin(a*2+.3)*.075+Math.sin(a*3+.47)*(voice==='reed'?.15:.028)+breath*.048;
        value*=.82+.18*Math.sin(t*tau*2.6+.8);
      }else if(voice==='fiddle'){
        const a=phase+Math.sin(t*tau*5.9)*Math.min(1,t*6.2)*.26;
        value=(Math.sin(a)*.39+Math.sin(a*2+.25)*.16+Math.sin(a*3)*.13+Math.sin(a*4+.42)*.08
          +Math.sin(a*5+.12)*.063+breath*.056)*(.86+.14*Math.sin(t*tau*3.7));
      }else if(voice==='whistle'){
        const a=phase+Math.sin(t*tau*5.4)*Math.min(1,t*4)*.15;
        value=(Math.sin(a)*.58+Math.sin(a*2)*.084+Math.sin(a*3)*.031+breath*.06)*(.87+.13*Math.sin(t*tau*3));
      }else if(voice==='organ'){
        value=(Math.sin(phase*.5)*.15+Math.sin(phase)*.40+Math.sin(phase*2)*.15
          +Math.sin(phase*3)*.095+Math.sin(phase*4)*.07)*(.87+.13*Math.sin(t*tau*5.2));
      }else if(voice==='bell'){
        value=Math.sin(phase)*.63*Math.exp(-t*2.45)+Math.sin(phase*2.002)*.23*Math.exp(-t*6.5)
          +Math.sin(phase*3.011+.4)*.12*Math.exp(-t*11)+Math.sin(phase*4.17)*.074*Math.exp(-t*19);
      }else if(voice==='hammer'){
        value=(Math.sin(phase)*.49+Math.sin(phase*1.994+.3)*.19)*Math.exp(-t*12)
          +(Math.sin(phase*3.021)*.14+Math.sin(phase*4.91)*.15+breath*.30)*Math.exp(-t*48);
      }else if(voice==='dulcimer'){
        value=(Math.sin(phase)*.40+Math.sin(phase*1.0037)*.27+Math.sin(phase*2.011+.18)*.17)*Math.exp(-t*6.4)
          +(Math.sin(phase*4.04)*.17+Math.sin(phase*5.14)*.12+breath*.076)*Math.exp(-t*24);
      }else if(voice==='guitar'){
        const twang=Math.sin(phase)*.57+Math.sin(phase*2.001)*.24+Math.sin(phase*3.004+.12)*.16+Math.sin(phase*4.007)*.11;
        value=Math.tanh(twang*1.19)*.77*Math.exp(-t*6.2)+(Math.sin(phase*5.015)*.24+breath*.15)*Math.exp(-t*28);
      }else if(voice==='electric'){
        const riff=Math.sin(phase)*.52+Math.sin(phase*2)*.26+Math.sin(phase*3+.11)*.20+Math.sin(phase*5)*.12;
        value=Math.tanh(riff*2.1)*.72*Math.exp(-t*3.9)+breath*.20*Math.exp(-t*51);
      }else if(voice==='brass'){
        const a=phase-.48*(1-Math.exp(-t*95));
        value=(Math.sin(a)*.45+Math.sin(a*2)*.21+Math.sin(a*3)*.16+Math.sin(a*4)*.095+Math.sin(a*6)*.064)
          *(.72+.28*Math.exp(-t*15))+breath*.13*Math.exp(-t*50);
      }else if(voice==='synth'){
        const a=phase*1.003,b=phase*.997;
        value=(Math.sin(a)*.36+Math.sin(b+.42)*.29+Math.sin(a*2)*.14+Math.sin(b*3)*.18+Math.sin(a*5)*.09)
          *(.74+.26*Math.exp(-t*13));
      }else if(voice==='kick'){
        const a=tau*(46*t+53*.021*(1-Math.exp(-t/.021)));
        value=Math.sin(a)*.80*Math.exp(-t*23)+breath*.13*Math.exp(-t*102);
      }else if(voice==='snare'){
        value=(noise-breath*.77)*.55*Math.exp(-t*23)+Math.sin(t*tau*182)*.30*Math.exp(-t*51);
      }else if(voice==='hat'){
        value=(noise-previous)*.36*Math.exp(-t*57);
      }else if(voice==='crash'){
        value=((noise-previous)*.29+Math.sin(t*tau*1321)*.14+Math.sin(t*tau*1933)*.09)*Math.exp(-t*13);
      }else if(voice==='brush'){
        value=(noise-breath)*.56*Math.exp(-t*38);
      }else if(voice==='wood'){
        value=(Math.sin(phase*2.46)*.42+Math.sin(phase*3.52)*.21+breath*.16)*Math.exp(-t*44);
      }else if(voice==='marimba'){
        value=Math.sin(phase)*.56*Math.exp(-t*7.8)+Math.sin(phase*3.98)*.18*Math.exp(-t*28)+breath*.11*Math.exp(-t*110);
      }else if(voice==='bass'){
        value=(Math.sin(phase)*.52+Math.sin(phase*2+.2)*.22+Math.sin(phase*3+.4)*.08)*Math.exp(-t*4.75)+breath*.05*Math.exp(-t*75);
      }else if(voice==='raceBass'){
        const pluck=Math.sin(phase)*.63+Math.sin(phase*2+.18)*.31+Math.sin(phase*3)*.15+Math.sin(phase*5)*.09;
        value=Math.tanh(pluck*1.4)*.77*Math.exp(-t*6.4)+breath*.10*Math.exp(-t*85);
      }else{
        const string=Math.sin(phase)*.43+Math.sin(phase*2.011+.24)*.23+Math.sin(phase*3.019+.5)*.14;
        const pick=Math.sin(phase*5.034)*.13+Math.sin(phase*7.049)*.088+(noise-previous)*.065;
        value=string*Math.exp(-t*8.8)+pick*Math.exp(-t*47);
      }
      data[i]=value*attack*tail;
      previous=noise;
    }
    samples.set(key,buffer);
    return buffer;
  }

  function play(event,time,bus){
    const source=context.createBufferSource(),volume=context.createGain();
    source.buffer=sample(event.voice,event.pitch);
    const held=Math.min(event.length,source.buffer.duration-.024);
    const end=time+held+.033;
    volume.gain.setValueAtTime(event.volume,time);
    volume.gain.setValueAtTime(event.volume,time+Math.max(0,held-.033));
    volume.gain.linearRampToValueAtTime(0,end);
    source.connect(volume);
    let pan;
    if(context.createStereoPanner&&event.pan){
      pan=context.createStereoPanner();pan.pan.value=event.pan;
      volume.connect(pan).connect(bus);
    }else volume.connect(bus);
    source.onended=()=>{source.disconnect();volume.disconnect();pan?.disconnect();};
    source.start(time);
    source.stop(end+.002);
  }

  function schedule(){
    if(!playback||context.state!=='running')return;
    const {song,bus}=playback,now=context.currentTime;
    // Skip missed events if a stalled tab resumes between scheduler ticks.
    if(playback.origin+song.length<now-.2){
      playback.origin+=Math.floor((now-playback.origin)/song.length)*song.length;
      playback.index=0;
    }
    while(playback.origin+song.events[playback.index].time<now+.145){
      const event=song.events[playback.index++],at=playback.origin+event.time;
      if(at>=now-.06)play(event,Math.max(now+.005,at),bus);
      if(playback.index===song.events.length){playback.index=0;playback.origin+=song.length;}
    }
  }

  function stop(remember){
    if(timer!==null){root.clearInterval(timer);timer=null;}
    if(!playback)return;
    const {song,bus,origin}=playback,now=context.currentTime;
    savedPosition=remember?((now-origin)%song.length+song.length)%song.length:0;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(0,now,.067);
    root.setTimeout(()=>bus.disconnect(),410);
    playback=null;
  }

  function sync(){
    if(!enabled||!context||context.state!=='running'||playback)return;
    const song=songs[scene],bus=context.createGain(),now=context.currentTime;
    bus.gain.setValueAtTime(0,now);bus.gain.setTargetAtTime(1,now,.092);
    bus.connect(master);
    let index=song.events.findIndex(event=>event.time>=savedPosition);
    let origin=now+.05-savedPosition;
    if(index<0){index=0;origin+=song.length;}
    playback={song,bus,index,origin};
    schedule();
    timer=root.setInterval(schedule,43);
  }

  function unlock(shared){
    if(!enabled)return;
    try{
      if(!context){
        const Audio=root.AudioContext||root.webkitAudioContext;
        if(!shared&&!Audio)return;
        context=shared||new Audio();
        master=context.createGain();master.gain.value=paused?.127:.45;
        master.connect(context.destination);
      }
      if(context.state==='running')sync();
      else if(context.state!=='closed')context.resume().then(sync).catch(()=>{});
    }catch{}
  }

  function setScene(next,trackIndex=0){
    const destination=next==='race'?'course-'+trackIndex:next;
    if(!Object.hasOwn(songs,destination)||destination===scene)return;
    stop(false);scene=destination;savedPosition=0;
    sync();
  }

  function setEnabled(value){
    enabled=Boolean(value);
    if(enabled)sync();
    else stop(true);
  }

  function setPaused(value){
    paused=Boolean(value);
    if(master)master.gain.setTargetAtTime(paused?.127:.45,context.currentTime,.14);
  }

  root.AcornMusic={unlock,setScene,setEnabled,setPaused};
})(window);
