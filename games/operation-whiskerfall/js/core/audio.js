(function () {
  'use strict';
  const OW=window.OW=window.OW||{};
  const THEMES={
    exploration:{bpm:92,root:50,melody:[0,7,12,9,7,4,2,7,0,4,7,12,14,12,9,7],chords:[0,5,9,7]},
    combat:{bpm:132,root:50,melody:[0,0,7,3,0,10,7,3,5,5,12,8,7,3,10,7],chords:[0,8,5,7]},
    boss:{bpm:148,root:45,melody:[0,7,3,10,0,12,7,3,1,8,4,11,7,3,10,7],chords:[0,1,8,7]}
  };
  const noteHz=n=>440*Math.pow(2,(n-69)/12);
  class AudioSystem {
    constructor(){
      this.context=null;this.ready=false;this.volumes={music:.35,sfx:.7,ui:.5};this._appliedVolumes={};this._layerVolumes={};this._windVolume=null;this.mode='exploration';this.musicStep=0;this.nextNote=0;this.birdTimer=5;this.townTimer=12;this.stepTimer=0;this._lastSound={};this._voices=0;this.enabled=true;
      this._animalBuffers=new Map();this._animalSources=new Set();this._animalBags={};this._animalLast={};this._animalCooldowns=new Map();this._animalActors=new WeakMap();this._animalNext=0;this._catTimer=3;this._mouseTimer=4;this._animalWorld=null;
    }
    init(){
      if(this.context){if(this.context.state==='suspended')this.context.resume().catch(()=>{});return;}
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      try{
        const ctx=this.context=new Context();this.master=ctx.createGain();this.master.gain.value=.65;
        this.compressor=ctx.createDynamicsCompressor();this.compressor.threshold.value=-15;this.compressor.knee.value=18;this.compressor.ratio.value=5;
        this.master.connect(this.compressor);this.compressor.connect(ctx.destination);
        this.musicBus=ctx.createGain();this.sfxBus=ctx.createGain();this.uiBus=ctx.createGain();
        this.musicBus.connect(this.master);this.sfxBus.connect(this.master);this.uiBus.connect(this.master);
        this.layerBus={};for(const key of Object.keys(THEMES)){const bus=ctx.createGain();bus.gain.value=key==='exploration'?1:0;bus.connect(this.musicBus);this.layerBus[key]=bus;}
        this.noiseBuffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*2),ctx.sampleRate);const d=this.noiseBuffer.getChannelData(0);let s=7269;for(let i=0;i<d.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;d[i]=s/2147483648-1;}
        this.setVolumes(this.volumes);this.nextNote=ctx.currentTime+.12;this.ready=true;
        this._ambient();this._loadAnimals();ctx.resume().catch(()=>{});
      }catch(e){this.enabled=false;}
    }
    setVolumes(settings={}){
      ['music','sfx','ui'].forEach(k=>{if(Number.isFinite(+settings[k]))this.volumes[k]=Math.max(0,Math.min(1,+settings[k]));});
      if(this.context)for(const key of ['music','sfx','ui'])if(this._appliedVolumes[key]!==this.volumes[key]){this[key+'Bus'].gain.setTargetAtTime(this.volumes[key]*(key==='music'?.44:1),this.context.currentTime,key==='music'?.08:.04);this._appliedVolumes[key]=this.volumes[key];}
    }
    _tone(freq,duration,volume=.1,type='sine',time,pan=0,bus,endFreq){
      if(!this.ready||this._voices>72)return;const ctx=this.context,t=time==null?ctx.currentTime:time,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(Math.max(15,freq),t);if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(15,endFreq),t+duration);
      gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(gain);let end=gain;
      if(ctx.createStereoPanner&&pan){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(p);end=p;}
      end.connect(bus||this.sfxBus);osc.start(t);osc.stop(t+duration+.02);this._voices++;
      osc.onended=()=>{osc.disconnect();gain.disconnect();if(end!==gain)end.disconnect();this._voices--;};
    }
    _noise(duration,volume,cutoff=1500,time,pan=0,bus,highpass=40){
      if(!this.ready||this._voices>72)return;const ctx=this.context,t=time==null?ctx.currentTime:time,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),hp=ctx.createBiquadFilter(),gain=ctx.createGain();
      source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,t);filter.frequency.exponentialRampToValueAtTime(Math.max(80,cutoff*.23),t+duration);hp.type='highpass';hp.frequency.value=highpass;
      gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(hp);hp.connect(gain);let end=gain;
      if(ctx.createStereoPanner&&pan){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(p);end=p;}
      end.connect(bus||this.sfxBus);source.start(t,(Math.floor(t*900)%1000)/1000);source.stop(t+duration+.01);this._voices++;
      source.onended=()=>{source.disconnect();filter.disconnect();hp.disconnect();gain.disconnect();if(end!==gain)end.disconnect();this._voices--;};
    }
    _ambient(){
      const ctx=this.context,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noiseBuffer;source.loop=true;filter.type='lowpass';filter.frequency.value=350;gain.gain.value=.025;source.connect(filter);filter.connect(gain);gain.connect(this.sfxBus);source.start();this.wind=source;this.windGain=gain;
    }
    _loadAnimals(){
      const ctx=this.context,bank=OW.AnimalSounds;
      if(!ctx||!bank)return Promise.resolve();
      // Inline WAV data keeps the complete sound bank playable from file:// as well as a server.
      this._animalLoad=Promise.all(bank.clips.map(async clip=>{
        try{const raw=window.atob(clip.data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
          const buffer=await ctx.decodeAudioData(bytes.buffer);if(this.context===ctx)this._animalBuffers.set(clip.id,buffer);
        }catch(_){/* A missing/unsupported clip never interrupts the game. */}
      }));return this._animalLoad;
    }
    resetAnimals(){
      for(const voice of [...this._animalSources]){try{voice.source.stop();}catch(_){}voice.finish();}
      this._animalCooldowns.clear();this._animalActors=new WeakMap();this._animalNext=0;this._catTimer=3+Math.random()*3;this._mouseTimer=4+Math.random()*3;this._animalWorld=null;
    }
    isRodent(actor){
      if(!actor||actor.turret||actor.guardianOwner)return false;if(actor.dungeonBoss)return actor.guardian===0||actor.guardian===3;
      const spec=OW.Content?.enemies?.[actor.type]||{},identity=[actor.name,spec.id,spec.name].join(' ').toLowerCase();
      return !/drone|clockwork hound|war.machine|sentry|turret|spider|spiderling|brood|gloamwing/.test(identity);
    }
    _animalClip(kind){
      const ids=(OW.AnimalSounds?.groups?.[kind]||[]).filter(id=>this._animalBuffers.has(id));if(!ids.length)return null;
      const family=kind.split('_')[0];let bag=this._animalBags[kind];
      if(!bag?.length){bag=[...ids];for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}this._animalBags[kind]=bag;}
      if(bag.length>1&&bag[bag.length-1]===this._animalLast[family]){[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}
      // Different event groups can share a recording. Avoid repeating it at a bag boundary too.
      if(bag.length===1&&bag[0]===this._animalLast[family]&&ids.length>1){const alternative=ids.find(id=>id!==bag[0]);bag.unshift(bag.pop());this._animalLast[family]=alternative;return alternative;}
      const id=bag.pop();this._animalLast[family]=id;return id;
    }
    vocal(kind,actor,game,options={}){
      const ctx=this.context;if(!this.ready||!this.enabled||!ctx||ctx.state!=='running'||this.volumes.sfx<=0||!game||game.state!=='playing'||(game.paused&&!options.allowMenu))return false;
      if(kind.startsWith('mouse_')&&!this.isRodent(actor))return false;
      const players=(game.players||[]).filter(p=>!p.downed),listeners=players.length?players:(game.players||[]);if(!listeners.length)return false;
      actor=actor||listeners[0];if(!Number.isFinite(actor.x)||!Number.isFinite(actor.y))return false;
      const distance=Math.min(...listeners.map(p=>Math.hypot(actor.x-p.x,actor.y-p.y))),range=options.range||760;if(distance>=range)return false;
      if(this._animalWorld!==game.world){this.resetAnimals();this._animalWorld=game.world;}
      const now=ctx.currentTime,family=kind.split('_')[0],key=family+':'+String(actor.id??actor.name??'local')+(/down|defeat/.test(kind)?':terminal':''),cooldown=/idle|chatter|purr/.test(kind)?5:/greet/.test(kind)?3:kind==='mouse_attack'?2.2:1.05;
      if(now<this._animalNext||now<(this._animalCooldowns.get(key)||0)||this._animalSources.size>=3)return false;
      const id=this._animalClip(kind);if(!id)return false;
      const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
      source.buffer=this._animalBuffers.get(id);
      const identity=String(actor.id??actor.name??''),hash=Array.from(identity).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0),pitch=(family==='cat'?.94:.93)+(hash%9)*.012+(Math.random()-.5)*.035;
      source.playbackRate.value=pitch;
      gain.gain.value=(kind==='cat_purr'?.13:family==='cat'?.28:.19)*Math.pow(1-distance/range,1.4)*(options.volume??1);
      source.connect(gain);if(pan){pan.pan.value=Math.max(-.8,Math.min(.8,(actor.x-(game.camera?.x??listeners[0].x))/480));gain.connect(pan);pan.connect(this.sfxBus);}else gain.connect(this.sfxBus);
      const voice={source,finish:()=>{if(!this._animalSources.delete(voice))return;source.disconnect();gain.disconnect();pan?.disconnect();}};
      this._animalSources.add(voice);source.onended=voice.finish;
      try{source.start();}catch(_){voice.finish();return false;}
      this._animalNext=now+(family==='cat'?.25:.18);this._animalCooldowns.set(key,now+cooldown);
      if(this._animalCooldowns.size>256)for(const [id,until]of this._animalCooldowns)if(until<now)this._animalCooldowns.delete(id);
      return true;
    }
    _updateAnimals(dt,game,mode){
      if(!game||game.paused||game.state!=='playing')return;
      if(this._animalWorld!==game.world){this.resetAnimals();this._animalWorld=game.world;}
      const players=(game.players||[]).filter(p=>!p.downed);if(!players.length)return;
      const near=actor=>players.some(p=>Math.hypot(actor.x-p.x,actor.y-p.y)<620);
      const rodents=(game.world?.activeEnemies||[]).filter(e=>e.hp>0&&!e.dead&&this.isRodent(e));
      for(const e of rodents){
        const previous=this._animalActors.get(e)||{},alerted=(e.alert||0)>0||e.state==='attack',attacking=!!(e.windup||e.specialMove||e.combatState==='windup'||e.anim==='melee');
        if(near(e)){if(alerted&&!previous.alerted)this.vocal('mouse_alert',e,game);else if(attacking&&!previous.attacking)this.vocal('mouse_attack',e,game);}
        this._animalActors.set(e,{alerted,attacking});
      }
      this._catTimer-=dt;this._mouseTimer-=dt;
      if(this._catTimer<=0){this._catTimer=7+Math.random()*8;
        const cats=(game.world?.locations||[]).filter(l=>l.type==='npc'&&near(l));
        if(mode==='exploration'&&cats.length)this.vocal(Math.random()<.3?'cat_purr':'cat_idle',cats[Math.floor(Math.random()*cats.length)],game,{range:620,volume:.8});
      }
      if(this._mouseTimer<=0){this._mouseTimer=5+Math.random()*7;const nearby=rodents.filter(near);if(nearby.length)this.vocal('mouse_chatter',nearby[Math.floor(Math.random()*nearby.length)],game,{range:620,volume:.72});}
    }
    play(name,position){
      if(!this.ready||!this.enabled)return;const ctx=this.context,t=ctx.currentTime;
      const pan=typeof position==='number'?Math.max(-.85,Math.min(.85,position)):0;
      const minInterval={shoot:.035,smg:.035,lmg:.035,hit:.045,footstep:.1,ui:.05}[name]||.02;
      if(t-(this._lastSound[name]||-10)<minInterval)return;this._lastSound[name]=t;
      const tone=(f,d,v,type='sine',delay=0,end)=>this._tone(f,d,v,type,t+delay,pan,name==='ui'?this.uiBus:this.sfxBus,end);
      const noise=(d,v,c=1500,delay=0,hp=40)=>this._noise(d,v,c,t+delay,pan,this.sfxBus,hp);
      switch(name){
        case 'shoot':case 'pistol':tone(160,.085,.14,'triangle',0,48);noise(.095,.2,3300);break;
        case 'rifle':case 'smg':case 'lmg':tone(name==='lmg'?105:185,.07,.13,'triangle',0,40);noise(.08,.18,4700);break;
        case 'sniper':tone(95,.22,.23,'triangle',0,30);noise(.2,.31,6500);break;
        case 'shotgun':tone(92,.18,.23,'triangle',0,24);noise(.23,.35,4200);break;
        case 'plasma':tone(600,.18,.12,'sawtooth',0,140);tone(820,.13,.05,'sine',0,220);break;
        case 'flame':noise(.18,.13,2400);tone(72,.14,.07,'triangle');break;
        case 'rocket':case 'airstrike':noise(.6,.19,2100);tone(240,.5,.12,'sawtooth',0,40);break;
        case 'melee':noise(.15,.11,2300,0,500);tone(430,.11,.035,'triangle',0,100);break;
        case 'hit':noise(.08,.14,1350);tone(95,.09,.09,'triangle',0,45);break;
        case 'explosion':case 'artillery':tone(75,.7,.28,'sine',0,22);noise(.85,.43,4200);noise(.45,.19,1500,.15);break;
        case 'reload':noise(.035,.12,4700);tone(650,.045,.05,'square');noise(.04,.12,3300,.17);tone(370,.045,.05,'square',.19);break;
        case 'dodge':case 'dash':noise(.2,.09,1300,0,180);break;
        case 'leap':case 'jump':tone(130,.3,.1,'triangle',0,520);noise(.2,.07,1600);break;
        case 'stomp':case 'mortar':tone(95,.4,.18,'sine',0,28);noise(.45,.22,1900);break;
        case 'mine':tone(1000,.12,.06);tone(1000,.12,.06,'sine',.17);break;
        case 'ice':[72,76,81].forEach((n,i)=>tone(noteHz(n),.5,.04,'sine',i*.025));noise(.25,.06,4500);break;
        case 'town_bell':tone(660,1.1,.025);tone(1320,.9,.008);break;
        case 'pickup':tone(660,.13,.09,'sine');tone(990,.2,.08,'sine',.08);break;
        case 'level':case 'quest':case 'victory':{const ns=name==='quest'?[62,66,69,74]:[62,66,69,74,78,81];ns.forEach((n,i)=>tone(noteHz(n),.4,.065,'triangle',i*.095));break;}
        case 'ui':tone(570,.07,.07,'sine');break;
        case 'heal':case 'revive':[64,69,73,76].forEach((n,i)=>tone(noteHz(n),.45,.05,'sine',i*.09));break;
        case 'lightning':tone(1800,.25,.13,'sawtooth',0,80);noise(.16,.15,6500);break;
        case 'alarm':tone(520,.3,.07,'triangle',0,810);tone(810,.3,.07,'triangle',.3,520);break;
        case 'footstep':noise(.045,.025,950);break;
        case 'snowstep':noise(.08,.025,3100,0,700);break;
        case 'waterstep':noise(.09,.025,1300);tone(250,.08,.015,'sine',0,120);break;
        default:break;
      }
    }
    _musicTick(time){
      const theme=THEMES[this.mode],s=this.musicStep,beat=60/theme.bpm,bus=this.layerBus[this.mode],bar=Math.floor(s/8),chord=theme.chords[bar%4],n=theme.melody[s%theme.melody.length];
      // An original 16-note motif sits over a four-chord progression. Threat adds bass and percussion.
      this._tone(noteHz(theme.root+24+n),beat*.78,this.mode==='exploration'?.058:.045,'triangle',time,Math.sin(s*.8)*.24,bus);
      if(s%2===0)this._tone(noteHz(theme.root+chord),beat*.9,.07,'triangle',time,0,bus);
      if(s%8===0)[0,7,12].forEach((v,i)=>this._tone(noteHz(theme.root+12+chord+v),beat*3.8,.025,'sine',time+i*.015,(i-1)*.3,bus));
      if(this.mode!=='exploration'){
        if(s%4===0)this._tone(96,.18,.13,'sine',time,0,bus,32);
        if(s%4===2)this._noise(.13,.085,4200,time,0,bus,450);
        this._noise(.025,s%2?.026:.04,7000,time,.2,bus,4500);
      } else if(s%4===2)this._noise(.035,.015,2100,time,-.2,bus,1000);
      this.musicStep++;this.nextNote=time+beat/2;
    }
    update(dt,game){
      if(!this.ready||!this.enabled)return;if(this.context.state==='suspended')return;
      if(game&&game.settings)this.setVolumes(game.settings);
      const active=game&&game.state==='playing'&&!game.paused;
      let desired='exploration';
      let inTown=false,industrial=false;
      if(active&&game.world){const enemies=game.world.activeEnemies||[],players=game.players||[];let danger=false,boss=false;
        for(const e of enemies)if(e.hp>0&&players.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<(e.boss?950:620))){danger=true;if(e.boss)boss=true;}
        desired=boss?'boss':danger?'combat':'exploration';
        const p=players[0];if(p){inTown=game.world.locations.some(l=>l.type==='town'&&Math.hypot(l.x-p.x,l.y-p.y)<(l.safeRadius||500));const r=game.world.regionAt(p.x,p.y);industrial=r.biome==='industrial'||r.biome==='fortress';}
      }
      const now=this.context.currentTime;if(desired!==this.mode){this.mode=desired;this.musicStep=0;this.nextNote=now+.08;}
      if(active)this._updateAnimals(dt,game,desired);
      for(const key of Object.keys(this.layerBus)){const value=key===this.mode?(active?1:.35):0;if(this._layerVolumes[key]!==value){this.layerBus[key].gain.setTargetAtTime(value,now,.7);this._layerVolumes[key]=value;}}
      const windVolume=inTown?.013:industrial?.035:.025;if(this.windGain&&windVolume!==this._windVolume){this.windGain.gain.setTargetAtTime(windVolume,now,2);this._windVolume=windVolume;}
      if(this.nextNote<now-.15)this.nextNote=now+.05;
      let scheduled=0;while(this.nextNote<now+.2&&scheduled++<4)this._musicTick(this.nextNote);
      this.birdTimer-=dt;if(this.birdTimer<0){this.birdTimer=5+Math.random()*7;if(this.mode==='exploration'&&active){this._tone(2100,.12,.018,'sine',now,Math.sin(now));this._tone(2700,.14,.015,'sine',now+.13,Math.sin(now));}}
      this.townTimer-=dt;if(this.townTimer<0){this.townTimer=16+Math.random()*12;if(inTown&&active)this.play('town_bell');}
      this.stepTimer-=dt;if(active&&this.stepTimer<=0&&(game.players||[]).some(p=>Math.hypot(p.velocityX||0,p.velocityY||0)>20)){
        this.stepTimer=.31;const p=game.players[0],r=game.world.regionAt(p.x,p.y);this.play(r.biome==='snow'?'snowstep':r.biome==='marsh'?'waterstep':'footstep');
      }
    }
    destroy(){this.resetAnimals();this._animalBuffers.clear();if(this.wind)this.wind.stop();if(this.context)this.context.close();this.context=null;this.ready=false;}
  }
  OW.Audio=AudioSystem;OW.AudioThemes=THEMES;
})();
