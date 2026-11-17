'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function webp(p){
  const b=fs.readFileSync(path.join(root,p));
  assert.equal(b.toString('ascii',0,4),'RIFF',p);assert.equal(b.toString('ascii',8,12),'WEBP');
  for(let i=12;i+8<b.length;){const kind=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4),d=i+8;
    if(kind==='VP8X')return [1+b.readUIntLE(d+4,3),1+b.readUIntLE(d+7,3)];
    if(kind==='VP8 ')return [b.readUInt16LE(d+6)&16383,b.readUInt16LE(d+8)&16383];
    if(kind==='VP8L'){const v=b.readUInt32LE(d+1);return [(v&16383)+1,((v>>>14)&16383)+1];}
    i=d+n+(n%2);
  }throw Error('Invalid texture '+p);
}
const records=['assets/fieldwork/atlas.json','assets/fieldwork/street-atlas.json','assets/fieldwork/district-atlas.json','assets/cases/atlas.json'].flatMap(read);
for(const r of records){
  assert.deepEqual(webp(r.path),r.exportSize,r.path);
  const [x,y,right,bottom]=r.sourceCrop;assert.ok(x>=0&&y>=0&&right>x&&bottom>y&&right<=r.sourceSize[0]&&bottom<=r.sourceSize[1],r.key);
}
const motion=Object.assign({},read('assets/fieldwork/motion-atlas.json'),read('assets/fieldwork/street-motion.json'));
let frames=0;
for(const r of Object.values(motion)){
  assert.deepEqual(webp(r.path),r.exportSize);for(const f of r.frames){
    const [x,y,w,h]=f.crop;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=r.exportSize[0]&&y+h<=r.exportSize[1],r.path);frames++;
  }
}
const cases=read('assets/cases/atlas.json').map(a=>a.key.slice(6));
assert.deepEqual(cases,read('data/quests.json').map(q=>q.id));assert.equal(new Set(cases).size,159);
console.log(records.length+' registered pictures including 159 individual case files and '+frames+' motion frames fit the actual offline textures.');
