'use strict';
// Read the original generated PNGs; measure frame rectangles without changing pixels.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const base=path.join(__dirname,'..');
const ids=['player','mars','minerva','diana','apollo','juno','neptune','vulcan','venus','saturn'];
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
function decodePNG(bytes){
 const chunks=[bytes.subarray(0,8)];
 for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type!=='caBX')chunks.push(bytes.subarray(at,at+length+12));at+=length+12;}
 return Buffer.concat(chunks);
}
function bands(values,count,allowValleys=false){
 const nominal=values.length/count,threshold=Math.max(2,Math.max(...values)*.02),runs=[];
 for(let i=0;i<values.length;i++)if(values[i]>threshold){const start=i;while(i+1<values.length&&values[i+1]>threshold)i++;runs.push([start,i+1]);}
 for(let i=1;i<runs.length;)if(runs[i][0]-runs[i-1][1]<Math.max(3,nominal*.045)){runs[i-1][1]=runs[i][1];runs.splice(i,1);}else i++;
 const detected=runs.length;
 while(runs.length>count){let nearest=1,gap=Infinity;for(let i=1;i<runs.length;i++){const distance=runs[i][0]-runs[i-1][1];if(distance<gap){gap=distance;nearest=i;}}runs[nearest-1][1]=runs[nearest][1];runs.splice(nearest,1);}
 if(runs.length===count&&runs.every(r=>r[1]-r[0]>nominal*.24))return {cuts:[0,...runs.slice(1).map((r,i)=>Math.round((runs[i][1]+r[0])/2)),values.length],mode:'alpha-bands',detected};
 if(allowValleys){
  // Long spear tips can join adjacent column projections despite separate bodies.
  // Find the emptiest gutter near each nominal cell edge, never discard a pose.
  const cuts=[0];
  for(let i=1;i<count;i++){
   const expected=nominal*i,start=Math.max(cuts.at(-1)+Math.round(nominal*.55),Math.round(expected-nominal*.4)),end=Math.min(values.length-Math.round(nominal*.55),Math.round(expected+nominal*.4));
   let best=Math.round(expected),score=Infinity;
   for(let p=start;p<=end;p++){let ink=0;for(let q=Math.max(0,p-2);q<=Math.min(values.length-1,p+2);q++)ink+=values[q];const candidate=ink+Math.abs(p-expected)*.03;if(candidate<score){score=candidate;best=p;}}
   cuts.push(best);
  }
  return {cuts:[...cuts,values.length],mode:'alpha-valleys',detected};
 }
 throw new Error(`Expected ${count} separated sprite bands, found ${detected}`);
}
async function analyze(file,rowCount=6){
 const bytes=fs.readFileSync(file),image=await loadImage(decodePNG(bytes)),width=image.width,height=image.height;
 const canvas=createCanvas(width,height),c=canvas.getContext('2d');c.drawImage(image,0,0);
 const pixels=c.getImageData(0,0,width,height).data,projection=new Array(height).fill(0);let transparent=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=pixels[(y*width+x)*4+3];if(alpha>=80)projection[y]++;if(alpha===0)transparent++;}
 if(transparent/(width*height)<.2)throw new Error(`${file}: missing transparent background`);
 const rows=bands(projection,rowCount,rowCount===6),frames=[],columnCuts=[],columnDetection=[];let boundaryInk=0;
 for(let row=0;row<rowCount;row++){
  const top=rows.cuts[row],bottom=rows.cuts[row+1],projectionX=new Array(width).fill(0);
  for(let y=top;y<bottom;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>=80)projectionX[x]++;
  const cols=bands(projectionX,8,true);columnCuts.push(cols.cuts);columnDetection.push(cols.mode);const rowFrames=[];
  for(let col=0;col<8;col++){
   const left=cols.cuts[col],right=cols.cuts[col+1];let x0=right,y0=bottom,x1=left-1,y1=top-1,ink=0;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*width+x)*4+3]>=80){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);ink++;if(x===left||x===right-1||y===top||y===bottom-1)boundaryInk++;}
   if(ink<100)throw new Error(`${file}: empty frame ${row*8+col}`);
   let bodySum=0,weight=0;
   for(let y=Math.round(y0+(y1-y0)*.55);y<=y1;y++)for(let x=x0;x<=x1;x++){const a=pixels[(y*width+x)*4+3];if(a>=80){bodySum+=x*a;weight+=a;}}
   const x=Math.max(left,x0-2),y=Math.max(top,y0-2);
   rowFrames.push({x,y,w:Math.min(right,x1+3)-x,h:Math.min(bottom,y1+3)-y,feet:y1+1,bodyCenter:bodySum/weight,col});
  }
  // Stable horizontal pitch keeps weapon swings from shifting the planted feet.
  const fit=rowFrames.slice(0,6),mean=fit.reduce((s,f)=>s+f.bodyCenter,0)/6;
  let numerator=0,denominator=0;fit.forEach((f,i)=>{numerator+=(i-2.5)*(f.bodyCenter-mean);denominator+=(i-2.5)**2;});
  const pitch=Math.max(width/8*.75,Math.min(width/8*1.25,numerator/denominator)),origin=mean-pitch*2.5;
  for(const f of rowFrames)frames.push({x:f.x,y:f.y,w:f.w,h:f.h,anchorX:+(origin+pitch*f.col-f.x).toFixed(2),anchorY:f.feet-f.y});
 }
 return {width,height,columns:8,rows:rowCount,referenceHeight:median(frames.map(f=>f.h)),rowCuts:rows.cuts,columnCuts,frames,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),quality:{paintedFrames:rowCount*8,transparentFraction:+(transparent/(width*height)).toFixed(4),boundaryInkPixels:boundaryInk,rowDetection:rows.mode,columnDetection}};
}
async function main(){
 const frames={},sheets={},offsets={};
 for(const id of ids){
  const separate=fs.existsSync(path.join(base,`armor-troops/${id}-light.png`));
  const combined=separate?null:await analyze(path.join(base,`armor-troops/${id}.png`),18);
  for(const [index,tier] of ['light','heavy','champion'].entries()){
   const key=id+'-'+tier;sheets[key]=`armor-troops/${id}${separate?'-'+tier:''}.png`;offsets[key]=separate?0:index*6;
   frames[key]=combined||await analyze(path.join(base,sheets[key]));
   console.log(`${key}: ${frames[key].width}x${frames[key].height}, ${frames[key].quality.paintedFrames} frames, boundary ink ${frames[key].quality.boundaryInkPixels}`);
  }
 }
 const manifest={sheets,frames,offsets};
 fs.writeFileSync(path.join(base,'armor-troops/frames.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(base,'armor-troops.js'),'/* Generated by tools/build-armor-metadata.cjs. Full-body troops, never armor overlays. */\nwindow.AcademyArmorTroops='+JSON.stringify(manifest)+';\n');
}
module.exports={analyze,bands,decodePNG};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
