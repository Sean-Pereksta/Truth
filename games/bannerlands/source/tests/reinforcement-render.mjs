import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Renderer} from '../../render.js';
import {FRONTIER_BUILDINGS} from '../../regiments.js';
import {HOUSES} from '../../core.js';
const require=createRequire(import.meta.url),raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');
const root=fileURLToPath(new URL('../..',import.meta.url));
const canvas=(w,h)=>raster.createCanvas(w,h);globalThis.document={createElement:()=>canvas(1,1)};globalThis.Image=raster.Image;
const r=new Renderer(canvas(100,100)),sources=Object.fromEntries(Object.values(FRONTIER_BUILDINGS).map(b=>[b.unit,path.join(root,'assets/reinforcements/'+b.unit+'.png')]));sources.buildings=path.join(root,'assets/reinforcements/buildings.png');
for(const b of Object.values(FRONTIER_BUILDINGS)){assert.equal(r.getTroopFrame(b.unit,b.house),null);assert.equal(r.getStructureFrame(b.type,b.house),null);}
assert.deepEqual(await r.loadReinforcementArt(sources),{troops:6,troopFrames:48,buildings:6});
for(const [house,b]of Object.entries(FRONTIER_BUILDINGS)){
  const row=r.getTroopFrame(b.unit,house);assert.equal(row.frames.length,8);assert.equal(r.getTroopFrame(b.unit,house==='wolf'?'lion':'wolf'),null);
  const hashes=[];
  for(const f of row.frames){const pixels=f.image.getContext('2d').getImageData(0,0,f.image.width,f.image.height).data;let visible=0,clear=0;
    for(let i=3;i<pixels.length;i+=4){if(pixels[i]>75)visible++;if(pixels[i]===0)clear++;}
    assert.ok(visible>200&&clear>100,'Real painted sprites with transparent margins are required.');hashes.push(Buffer.from(pixels).toString('base64'));
    assert.ok(f.sourceBounds.left>0&&f.sourceBounds.right>0,'No sprite may touch a neighboring cell.');
  }
  assert.equal(new Set(hashes).size,8,'All walk and attack poses must differ.');
  const frame=r.getStructureFrame(b.type,house);assert.ok(frame.width>50&&frame.height>50);assert.equal(r.getStructureFrame(b.type,'wolf'),null);
}
const out=process.env.LANDS_RENDER_OUT;
if(out){
  fs.mkdirSync(out,{recursive:true});const sheet=canvas(1500,1050),c=sheet.getContext('2d');c.fillStyle='#102a30';c.fillRect(0,0,1500,1050);c.fillStyle='#eed9a7';c.font='bold 30px Georgia';c.fillText('Bannerlands · New house troops & training buildings',30,43);
  for(const [i,[house,b]]of Object.entries(FRONTIER_BUILDINGS).entries()){
    const x=20+i%3*493,y=75+Math.floor(i/3)*480,h=HOUSES.find(h=>h.sigil===house);c.fillStyle='#203b37';c.fillRect(x,y,475,460);c.fillStyle=h.color;c.font='bold 22px Georgia';c.fillText(h.name,x+18,y+29);c.fillStyle='#eed9a7';c.font='18px Segoe UI';c.fillText(b.label,x+18,y+57);
    const f=r.getStructureFrame(b.type,house);c.drawImage(f.image,f.left,f.top,f.width,f.height,x+80,y+75,f.drawWidth*2.8,f.drawHeight*2.8);
    const row=r.getTroopFrame(b.unit,house);for(let k=0;k<4;k++){const f=row.frames[k+4],scale=1.4;c.drawImage(f.image,f.left,f.top,f.width,f.height,x+24+k*112,y+423-f.height/3*scale,f.width/3*scale,f.height/3*scale);}
    c.fillStyle='#b9c9b5';c.font='14px Segoe UI';c.fillText(b.unit.replaceAll('_',' '),x+18,y+447);
  }
  fs.writeFileSync(path.join(out,'House-reinforcements-preview.png'),sheet.toBuffer('image/png'));
}
console.log('PASS 48 distinct animation frames, 6 transparent structures, exact house selection and artwork preview.');
