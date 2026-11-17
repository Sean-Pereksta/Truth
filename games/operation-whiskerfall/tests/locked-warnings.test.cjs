'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={document:{readyState:'loading',addEventListener(){}},console,localStorage:{getItem(){return null}}};
context.window=context;vm.createContext(context);
function load(src){vm.runInContext(fs.readFileSync(path.join(root,src),'utf8'),context,{filename:src});}
load('config.js');load('data/content.js');load('js/core/spatial.js');load('js/main.js');
const W=context.OW;W.Renderer=class{};W.UI=class{};W.ReconCombat={};W.Assets={};
load('js/ui/recon-combat-art.js');
const g=Object.create(W.Game.prototype);
g.world={isBlocked:(x,y,r)=>x-r<=0||x+r>=570||y-r<=0||y+r>=350};g.safeZoneAt=()=>false;g.pointLocked=()=>false;g.effect=()=>{};g.damagePlayer=(p)=>{p.touched=true;};
const start={x:90,y:83};const course=g.planRoll(start,.27,1480,23);
assert.ok(course.length>=3);
assert.equal(course[0].x,start.x);
for(let i=1;i<course.length;i++){assert.equal(course[i].x,course[i-1].tx);assert.equal(course[i].y,course[i-1].ty);}
const radius=45;
for(const fps of [24,60,120]){
  const roller={...start},action={course,leg:0,traversed:0,hitRadius:radius,damage:1};
  const middle=course[1],x=(middle.x+middle.tx)/2,y=(middle.y+middle.ty)/2;
  g.players=[{x,y},{x:-200,y:-200}];
  for(let n=0;n<500&&action.leg<course.length;n++){
    g.advanceRoll(roller,action,900/fps);
    assert.ok(!g.world.isBlocked(roller.x,roller.y,23));
    assert.ok(course.some(s=>{
      const dx=s.tx-s.x,dy=s.ty-s.y,t=Math.min(1,Math.max(0,((roller.x-s.x)*dx+(roller.y-s.y)*dy)/(s.length*s.length)));
      return Math.hypot(roller.x-s.x-t*dx,roller.y-s.y-t*dy)<.001;
    }));
  }
  assert.ok(g.players[0].touched&&!g.players[1].touched);
  assert.ok(Math.hypot(roller.x-course.at(-1).tx,roller.y-course.at(-1).ty)<.001);
}
const p={x:200,y:50},round={x:0,y:50,vx:400,vy:0,radius:4,life:2};
assert.equal(W.ReconCombat.approachTime(round,p),.5);
assert.equal(W.ReconCombat.approachTime({...round,vy:200},p),null);
assert.equal(W.ReconCombat.approachTime({...round,life:.3},p),null);
assert.equal(W.ReconCombat.approachTime(round,{...p,velocityY:250}),null);
console.log('PASS · locked ricochet geometry, actual hits at 24/60/120 Hz, range-limited offscreen projectile direction cues.');
