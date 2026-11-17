import {worldToScreen,screenToWorld} from './render.js';

const cues={
  block:{hz:1020,end:280,duration:.085,gain:.019,wave:'triangle'},
  volley:{hz:2900,end:850,duration:.10,gain:.029,noise:true},
  hooves:{hz:98,end:47,duration:.19,gain:.042,wave:'triangle'},
  siege:{hz:270,end:46,duration:.27,gain:.075,noise:true}
};

export class BattleAudio {
  constructor(context){
    this.context=context;this.voices=new Set();this.seen=new WeakSet();this.lastHooves=-Infinity;
    this.master=context.createGain();this.master.connect(context.destination);
  }
  mute(muted){this.master.gain.value=muted?0:1;}
  noiseBuffer(){
    if(this.noise)return this.noise;
    const ctx=this.context,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.3),ctx.sampleRate);
    const data=buffer.getChannelData(0);let seed=937;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    return this.noise=buffer;
  }
  play(kind,pan=0,level=1,clickHz=240,clickGain=.025){
    const ctx=this.context,click=kind==='click';
    // Six simultaneous voices in total. Two remain available for order feedback.
    if(ctx.state!=='running'||this.master.gain.value===0||this.voices.size>=(click?6:4))return false;
    const def=click?{hz:clickHz,end:clickHz*.55,duration:.16,gain:clickGain,wave:'sine'}:cues[kind];
    if(!def)return false;
    const t=ctx.currentTime,end=t+def.duration,gain=ctx.createGain(),nodes=[gain];
    let source;
    if(def.noise){
      source=ctx.createBufferSource();source.buffer=this.noiseBuffer();
      const filter=ctx.createBiquadFilter();filter.type=kind==='volley'?'bandpass':'lowpass';
      filter.frequency.setValueAtTime(def.hz,t);filter.frequency.exponentialRampToValueAtTime(def.end,end);
      source.connect(filter).connect(gain);nodes.push(filter);
    }else{
      source=ctx.createOscillator();source.type=def.wave;
      source.frequency.setValueAtTime(def.hz,t);source.frequency.exponentialRampToValueAtTime(def.end,end);source.connect(gain);
    }
    const peak=Math.max(.0002,level*def.gain);
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(peak,t+.005);
    if(kind==='hooves'){gain.gain.exponentialRampToValueAtTime(.0001,t+.061);gain.gain.linearRampToValueAtTime(peak*.65,t+.077);}
    gain.gain.exponentialRampToValueAtTime(.0001,end);
    if(ctx.createStereoPanner&&pan!==0){
      const stereo=ctx.createStereoPanner();stereo.pan.value=pan;gain.connect(stereo).connect(this.master);nodes.push(stereo);
    }else gain.connect(this.master);
    this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();for(const node of nodes)node.disconnect();};
    source.start(t);source.stop(end+.005);return true;
  }
  update(g,view,now){
    if(g.paused||g.winner!=null||this.master.gain.value===0||this.context.state!=='running')return;
    const candidates=new Map();
    const consider=(kind,x,y)=>{
      const pos=worldToScreen(x,y,view),pan=2*pos.x/view.w-1,vertical=2*pos.y/view.h-1;
      if(Math.abs(pan)>1||Math.abs(vertical)>1||g.config?.fogOfWar&&!g.isVisibleTo(g.playerTeam??0,{x,y}))return;
      const level=1-Math.min(.84,Math.hypot(pan,vertical)*.58);
      if(!candidates.has(kind)||candidates.get(kind).level<level)candidates.set(kind,{pan,level});
    };
    // New transient events are appended in both the local simulation and the
    // filtered guest snapshot. Old or newly discovered shots never replay.
    for(let i=g.effects.length-1;i>=Math.max(0,g.effects.length-48);i--){
      const e=g.effects[i],kind=e.type==='blockImpact'?'block':e.type==='explosion'?'siege':null;
      if(!kind||e.maxLife-e.life>.2||this.seen.has(e))continue;
      this.seen.add(e);consider(kind,e.x,e.y);
    }
    for(let i=g.projectiles.length-1;i>=Math.max(0,g.projectiles.length-48);i--){
      const p=g.projectiles[i];
      if(!['arrow','bolt'].includes(p.type)||p.t>.14||this.seen.has(p))continue;
      this.seen.add(p);consider('volley',p.sx,p.sy);
    }
    if(now-this.lastHooves>=290){
      this.lastHooves=now;
      const center=screenToWorld(view.w/2,view.h/2,view);
      g.hash?.visit(center.x,center.y,6,u=>{
        if(u.hp>0&&(u.charging||u.momentum>.35))consider('hooves',u.x,u.y);
      });
    }
    for(const kind of ['siege','block','volley','hooves']){
      const candidate=candidates.get(kind);if(candidate)this.play(kind,candidate.pan,candidate.level);
    }
  }
}
