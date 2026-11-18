(function(root){
  'use strict';

  // The score uses MIDI pitches, with one melody cell per eighth note.
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

  // Bass entries are [beat, interval]. Drum entries are [beat, instrument, pitch, accent].
  const grooves={
    folk:{bass:[[0,0],[2,7],[3.5,12]],chords:[.5,1.5,2.5,3.5],pattern:'strum',drums:[[0,'wood',53,.17],[1,'brush',0,.11],[2,'wood',56,.14],[3,'brush',0,.14]]},
    pan:{bass:[[0,0],[1.5,12],[3,0]],chords:[.25,1.75,2.5,3.25],pattern:'arpeggio',drums:[[0,'wood',64,.18],[.75,'wood',73,.11],[1.5,'wood',61,.15],[2.5,'brush',0,.12],[3,'wood',69,.18]]},
    waltz:{bass:[[0,0]],chords:[1,2],pattern:'strum',drums:[[0,'wood',47,.19],[1,'brush',0,.12],[2,'wood',62,.13]]},
    gallop:{bass:[[0,0],[.75,7],[1.5,12],[2,0],[2.75,7],[3.5,12]],chords:[.25,1,2.25,3],pattern:'arpeggio',drums:[[0,'kick',0,.20],[.75,'wood',64,.12],[1,'snare',0,.17],[2,'kick',0,.16],[2.75,'wood',65,.13],[3,'snare',0,.20]]},
    glide:{bass:[[0,0],[2.5,12]],chords:[.75,1.75,3.25],pattern:'arpeggio',drums:[[0,'kick',0,.12],[.75,'hat',0,.09],[2,'brush',0,.11],[3.5,'hat',0,.10]]},
    stomp:{bass:[[0,0],[1.5,0],[2,7],[3.5,12]],chords:[0,.75,1.5,2.5,3.25],pattern:'block',drums:[[0,'kick',0,.22],[.75,'wood',49,.12],[1.5,'snare',0,.17],[2,'wood',55,.18],[3,'kick',0,.17]]},
    rush:{bass:[[0,0],[1,12],[1.5,7],[2,0],[3,12]],chords:[.5,1.25,2.5,3.25],pattern:'arpeggio',drums:[[0,'kick',0,.18],[.5,'hat',0,.10],[1,'wood',65,.16],[1.75,'brush',0,.12],[2,'kick',0,.15],[2.5,'hat',0,.11],[3,'snare',0,.15],[3.5,'wood',72,.13]]},
    surf:{bass:[[0,0],[.5,12],[1.5,7],[2,0],[2.5,12],[3.5,7]],chords:[.5,1.5,2.5,3.5],pattern:'strum',drums:[[0,'kick',0,.23],[.5,'hat',0,.13],[1,'snare',0,.23],[1.5,'hat',0,.11],[2,'kick',0,.19],[2.5,'hat',0,.14],[3,'snare',0,.23],[3.5,'hat',0,.15]]}
  };
  const semitones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function notation(token){
    if(token==='.')return 0;
    if(token==='-')return -1;
    const [,letter,accidental,octave]=/^([A-G])([#b]?)(\d)$/.exec(token);
    return 12*(Number(octave)+1)+semitones[letter]+(accidental==='#'?1:accidental==='b'?-1:0);
  }
  function arrangeCourse(score){
    const {bars,bpm,beats,lead,answer,backing,groove}=score,shape=grooves[groove];
    const quarter=60/bpm,events=[];
    const add=(beat,voice,pitch,length,volume,pan)=>events.push({time:beat*quarter,voice,pitch,length:length*quarter,volume,pan});
    for(let bar=0;bar<bars.length;bar++){
      const [harmony,phrase]=bars[bar],chord=harmony.split(' ').map(notation),melody=phrase.split(' ').map(notation);
      const start=bar*beats,bridge=bar>=bars.length/2&&bar<bars.length*3/4,reprise=bar>=bars.length*3/4;
      const instrument=bridge?answer:lead;
      const chordIntervals=chord.slice(1).map(pitch=>(pitch-chord[0]+120)%12);
      const passingNote=chordIntervals.reduce((best,interval)=>Math.abs(interval-7)<Math.abs(best-7)?interval:best);
      for(let i=0;i<melody.length;i++){
        if(melody[i]<=0)continue;
        let held=1;
        while(melody[i+held]===-1)held++;
        const accent=i===0?1.13:i%2?.86:1;
        add(start+i*.5,instrument,melody[i],held*.5*.91,.255*accent,-.12);
        if(reprise&&i===0&&bar%2===0&&answer!==lead)add(start+.032,answer,melody[i]-12,.49,.10,.22);
      }
      for(const [beat,interval] of shape.bass){
        if(beat>=beats)continue;
        add(start+beat,'bass',chord[0]+(interval===7?passingNote:interval),groove==='waltz'?1.6:interval?.38:.68,interval?.18:.29,0);
      }
      for(let i=0;i<shape.chords.length;i++){
        const beat=shape.chords[i];if(beat>=beats)continue;
        if(shape.pattern==='arpeggio'){
          add(start+beat,backing,chord[1+i%3],.67,bridge?.125:.157,.29);
          if(reprise&&i===0)add(start+beat+.13,backing,chord[3],.44,.082,.4);
        }else{
          const spread=shape.pattern==='strum'?.034:.011;
          for(let tone=1;tone<4;tone++)add(start+beat+(tone-1)*spread,backing,chord[tone],groove==='waltz'?.56:.28,bridge?.081:.109,.26);
        }
      }
      for(const [beat,voice,pitch,volume] of shape.drums){
        if(beat<beats)add(start+beat,voice,pitch,.33,volume*(bridge?.69:1),voice==='hat'||voice==='brush'?.34:-.13);
      }
      if(reprise&&bar%4===bars.length%4&&groove!=='glide')add(start+beats-.24,'wood',71,.18,.14,-.24);
    }
    return {events:events.sort((a,b)=>a.time-b.time),length:quarter*bars.length*beats};
  }
  const songs={menu:arrangeMenu()};
  for(const [index,score] of Object.entries(root.AcornCourseScores||{}))songs['course-'+index]=arrangeCourse(score);

  const sampleRate=22050,tau=2*Math.PI;
  const heldVoices=new Set(['flute','reed','fiddle','whistle','organ']);
  const drumVoices=new Set(['brush','wood','kick','snare','hat']);
  const samples=new Map();
  let context=null,master=null,playback=null,timer=null;
  let scene='menu',enabled=true,paused=false,savedPosition=0;

  function sample(voice,pitch){
    const key=voice+':'+pitch;
    if(samples.has(key))return samples.get(key);
    const held=heldVoices.has(voice),drum=drumVoices.has(voice);
    const duration=held?2.1:voice==='bell'?1.72:voice==='bass'?1.27:drum?.29:.79;
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
      }else if(voice==='kick'){
        const a=tau*(46*t+53*.021*(1-Math.exp(-t/.021)));
        value=Math.sin(a)*.80*Math.exp(-t*23)+breath*.13*Math.exp(-t*102);
      }else if(voice==='snare'){
        value=(noise-breath*.77)*.55*Math.exp(-t*23)+Math.sin(t*tau*182)*.30*Math.exp(-t*51);
      }else if(voice==='hat'){
        value=(noise-previous)*.36*Math.exp(-t*57);
      }else if(voice==='brush'){
        value=(noise-breath)*.56*Math.exp(-t*38);
      }else if(voice==='wood'){
        value=(Math.sin(phase*2.46)*.42+Math.sin(phase*3.52)*.21+breath*.16)*Math.exp(-t*44);
      }else if(voice==='marimba'){
        value=Math.sin(phase)*.56*Math.exp(-t*7.8)+Math.sin(phase*3.98)*.18*Math.exp(-t*28)+breath*.11*Math.exp(-t*110);
      }else if(voice==='bass'){
        value=(Math.sin(phase)*.52+Math.sin(phase*2+.2)*.22+Math.sin(phase*3+.4)*.08)*Math.exp(-t*4.75)+breath*.05*Math.exp(-t*75);
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
