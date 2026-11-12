const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=require('../armor-troops/frames.json');
const base=path.join(__dirname,'..');
const ids=['player','mars','minerva','diana','apollo','juno','neptune','vulcan','venus','saturn'];

test('every house supplies all three complete animated armor tiers',()=>{
 assert.equal(Object.keys(manifest.sheets).length,30);
 for(const tier of ['light','heavy','champion']){
  const unique=new Set();
  for(const id of ids){
   const key=id+'-'+tier,bytes=fs.readFileSync(path.join(base,manifest.sheets[key])),m=manifest.frames[key],offset=manifest.offsets[key];
   assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),m.width);assert.equal(bytes.readUInt32BE(20),m.height);
   const hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,m.sourceSha256);unique.add(hash);
   assert.equal(m.columns,8);assert([6,18].includes(m.rows));assert.equal(m.frames.length,m.rows*8);assert(offset+6<=m.rows);
   assert(m.quality.transparentFraction>.2,`${key} needs real transparent gutters`);
   for(const f of m.frames.slice(offset*8,(offset+6)*8)){assert(f.w>15&&f.h>25,`${key}: complete body missing`);assert(f.x>=0&&f.y>=0&&f.x+f.w<=m.width&&f.y+f.h<=m.height);assert(Number.isFinite(f.anchorX)&&Number.isFinite(f.anchorY));}
  }
  assert.equal(unique.size,10,`${tier}: houses must have distinct artwork`);
 }
});

test('the page loads armor atlases before the renderer',()=>{
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');assert(html.indexOf('armor-troops.js')<html.indexOf('renderer.js'));
 const renderer=fs.readFileSync(path.join(base,'renderer.js'),'utf8');assert(!renderer.includes('paintedArmor'),'static armor pieces must not be stamped over characters');assert(!renderer.includes("loadAtlas('armor')"));
});
