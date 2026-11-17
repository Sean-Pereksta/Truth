import assert from 'node:assert/strict';
import {BattleAudio} from '../../battle-audio.js';

const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>({connect(target){return target;},disconnect(){},start(){},stop(){},gain:param(),frequency:param(),pan:param()});
const context={state:'running',currentTime:0,sampleRate:8000,destination:node(),createGain:node,createOscillator:node,
  createBiquadFilter:node,createBufferSource:node,createStereoPanner:node,
  createBuffer:(_channels,samples)=>({getChannelData:()=>new Float32Array(samples)})};
const audio=new BattleAudio(context);
for(const kind of ['block','volley','siege','hooves'])assert.equal(audio.play(kind,.5),true);
assert.equal(audio.play('siege'),false);assert.equal(audio.play('click'),true);assert.equal(audio.play('click'),true);
assert.equal(audio.play('click'),false);assert.equal(audio.voices.size,6);
for(const voice of audio.voices)voice.onended();
audio.mute(true);assert.equal(audio.play('click'),false);audio.mute(false);
const heard=[],view={x:0,y:560,w:800,h:440,zoom:1};
audio.play=(kind,pan,level)=>heard.push({kind,pan,level});
const event=(x,type)=>({type,x,y:20,life:.18,maxLife:.2,team:0});
const g={playerTeam:0,config:{fogOfWar:true},units:new Proxy([],{get(){throw Error('Army scan');}}),
  isVisibleTo:(_team,p)=>p.team===0||p.x<25,
  effects:[event(18,'blockImpact'),event(24,'explosion'),event(26,'blockImpact'),event(-70,'explosion')],
  projectiles:[{type:'arrow',sx:21,sy:20,t:.05},{type:'bolt',sx:26,sy:20,t:.08}],
  hash:{visit(_x,_y,r,fn){assert.equal(r,6);fn({x:22,y:20,hp:25,charging:true});}}};
audio.update(g,view,1000);
assert.deepEqual(heard.map(e=>e.kind),['siege','block','volley','hooves']);
assert.ok(heard.find(e=>e.kind==='block').pan<0);assert.ok(heard.find(e=>e.kind==='siege').pan>0);
audio.update(g,view,1120);assert.equal(heard.length,4,'No replay or second hoofbeat');
g.effects.push(event(26,'explosion'));g.projectiles.push({type:'arrow',sx:26,sy:20,t:.03});
audio.update(g,view,1240);assert.equal(heard.length,4,'Friendly projectiles and impacts also obey location-only fog');
g.paused=true;audio.update(g,view,1600);assert.equal(heard.length,4);
console.log('PASS six-voice ceiling, order feedback reservation, stereo positioning, event deduplication, paused time, mute and coordinate-based fog.');
