import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {HOUSES} from '../../core.js';
import {BattleAftermath,corpseOpacity} from '../../aftermath.js';
const require=createRequire(import.meta.url);let raster;try{raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}catch{console.log('SKIP aftermath rendering: install @napi-rs/canvas or set LANDS_CANVAS_MODULE.');process.exit(0);}
const canvas=(w=300,h=150)=>{const c=raster.createCanvas(w,h);c.style={};return c;};
globalThis.document={createElement:()=>canvas(),getElementById:()=>null};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),r=new Renderer(canvas());
const digest=c=>createHash('sha256').update(c.toBuffer('image/png')).digest('hex'),pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const make=(kind='infantry',id=1,team=0,isKing=false)=>{const a=new BattleAftermath();a.record({id,team,type:kind,hp:0,x:0,y:0,isKing},HOUSES[team],0,kind);return a;};
let cases=0;const test=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
test('Faction colors, fallen poses, riders and siege wreckage produce distinct corpse drawings',()=>{
  const images=new Set();for(const team of [0,1,2,3])for(const kind of ['infantry','archer','cavalry','siege'])images.add(digest(r.corpseSprite(make(kind,team+1,team).bodies[0])));assert.equal(images.size,16);
  const a=new BattleAftermath();for(let i=1;i<=4;i++)a.record({id:i,team:0,type:'infantry',hp:0,x:0,y:0},HOUSES[0],0,'infantry');assert.equal(new Set(a.bodies.map(b=>digest(r.corpseSprite(b)))).size,4);
});
test('Rendered opacity declines smoothly rather than leaving a solid body until expiry',()=>{
  const a=make(),g={aftermath:a,config:{}},draw=time=>{a.update(time);const c=canvas(100,80),ctx=c.getContext('2d');ctx.translate(50,40);r.drawAftermath(ctx,g,{left:-100,right:100,top:-100,bottom:100});return pixels(c).filter((_,i)=>i%4===3).reduce((sum,x)=>sum+x,0);};
  const fresh=draw(0),middle=draw(60),late=draw(110),gone=draw(120);assert.ok(fresh>middle*1.7);assert.ok(middle>late*4);assert.equal(gone,0);
});
test('Fog and off-screen culling prevent invisible deaths from affecting battlefield pixels',()=>{
  const a=make(),g={aftermath:a,config:{fogOfWar:true},vision:{isVisible:()=>false}},c=canvas(),ctx=c.getContext('2d');r.drawAftermath(ctx,g,{left:-100,right:100,top:-100,bottom:100});assert.ok(pixels(c).every(x=>x===0));
  g.vision.isVisible=()=>true;r.drawAftermath(ctx,g,{left:1000,right:1200,top:1000,bottom:1200});assert.ok(pixels(c).every(x=>x===0));
  ctx.translate(100,60);r.drawAftermath(ctx,g,{left:-100,right:100,top:-100,bottom:100});assert.ok(pixels(c).some(x=>x>0));
});
test('Sprite caching is bounded and rendering never mutates body data',()=>{
  const a=make(),before=JSON.stringify(a.bodies[0]),first=r.corpseSprite(a.bodies[0]);assert.equal(r.corpseSprite(a.bodies[0]),first);
  for(let i=0;i<500;i++)r.corpseSprite({...a.bodies[0],color:'#'+(i+1).toString(16).padStart(6,'0')});assert.ok(r.corpseSprites.size<=384);assert.equal(JSON.stringify(a.bodies[0]),before);
});
test('A large mixed-faction aftermath reuses every pose without rebuilding canvases each frame',()=>{
  const renderer=new Renderer(canvas()),a=new BattleAftermath();let id=1;
  for(let team=0;team<16;team++)for(const type of ['infantry','archer','cavalry','siege','giant','hero','king'])for(let i=0;i<24;i++)a.record({id:id++,team,type:type==='king'?'hero':type,isKing:type==='king',hp:0,x:0,y:0},HOUSES[team],0,type==='king'?'hero':type==='giant'?'infantry':type);
  for(const body of a.bodies)renderer.corpseSprite(body);assert.ok(renderer.corpseSprites.size<=336);let rebuilt=0;const make=renderer.makeCorpseSprite.bind(renderer);renderer.makeCorpseSprite=body=>{rebuilt++;return make(body);};
  for(const body of a.bodies)renderer.corpseSprite(body);assert.equal(rebuilt,0,'Visible corpses must reuse cached poses even when many factions and unit types die.');
});
r.setTroopAtlas(await raster.loadImage(path.join(root,'assets/troops-atlas.png')));
test('A living king has an unmistakable crown, label and full-health gold bar',()=>{
  const g={teams:HOUSES,time:0,unitClass:()=> 'hero',allied:(a,b)=>a===b},u={id:1,type:'hero',team:0,x:0,y:0,hp:800,maxHp:800,facingX:1,facingY:0,phase:0},ui={selected:new Set()},draw=isKing=>{const c=canvas(100,110),ctx=c.getContext('2d');ctx.translate(50,82);const labels=[],text=ctx.fillText.bind(ctx);ctx.fillText=(value,...args)=>{labels.push(value);text(value,...args);};r.unit(ctx,{...u,isKing},g,ui,1);return {c,labels};};
  const ordinary=draw(false),king=draw(true);assert.notEqual(digest(ordinary.c),digest(king.c));assert.ok(king.labels.includes('KING'));assert.equal(ordinary.labels.includes('KING'),false);
  const p=king.c.getContext('2d').getImageData(50,53,1,1).data;assert.ok(p[0]>200&&p[1]>150&&p[2]<150,'The king keeps a gold health bar even at full health.');
});

const preview=canvas(1120,680),c=preview.getContext('2d');c.fillStyle='#142a2a';c.fillRect(0,0,preview.width,preview.height);c.fillStyle='#ead5a0';c.font='bold 26px Georgia';c.fillText('Bannerlands · Faction aftermath',24,35);c.fillStyle='#b8c5b0';c.font='13px Segoe UI';c.fillText('Faction cloaks, varied fallen poses, mounts and siege wreckage · Cosmetic only · Fade over 120 seconds',24,59);
for(let i=0;i<HOUSES.length;i++){const team=HOUSES[i],x=18+(i%4)*277,y=80+Math.floor(i/4)*146;c.fillStyle='#243b31';c.fillRect(x,y,266,135);c.strokeStyle=team.color;c.strokeRect(x+.5,y+.5,265,134);c.fillStyle=team.color;c.font='bold 14px Georgia';c.fillText(team.name.replace('House ',''),x+12,y+23);
  for(let j=0;j<3;j++){const age=[0,60,105][j],a=new BattleAftermath(),body=a.record({id:i*10+j+1,team:i,type:['infantry','cavalry','siege'][j],hp:0,x:0,y:0},team,0,['infantry','cavalry','siege'][j]);c.globalAlpha=corpseOpacity(body,age);c.drawImage(r.corpseSprite(body),x+8+j*83,y+43,80,44);c.globalAlpha=1;c.fillStyle='#a9b8a3';c.font='11px Segoe UI';c.fillText([`Fresh`,`${age}s`][j?1:0],x+28+j*83,y+108);}}
const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT,'aftermath-preview.png'):path.resolve(root,'../../../../work/aftermath-preview.png');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,preview.toBuffer('image/png'));console.log('Aftermath preview: '+output);
console.log(`${cases} aftermath rendering checks passed.`);
