import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Mechanical processing only. Every visible soldier and item must come from a
// generated/painted input PNG. This tool never draws body or equipment pixels.
const require=createRequire(import.meta.url);
export function alphaBounds(data,width,height,threshold=40){
 let left=width,top=height,right=-1,bottom=-1,opaque=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=threshold){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);opaque++;}
 return right<left?null:{left,top,right,bottom,width:right-left+1,height:bottom-top+1,opaque};
}
export function alphaComponents(data,width,height,threshold=40,minimumPixels=8){
 const seen=new Uint8Array(width*height),queue=new Uint32Array(width*height),components=[];
 for(let start=0;start<seen.length;start++){
  if(seen[start]||data[start*4+3]<threshold)continue;let head=0,tail=1,left=width,top=height,right=-1,bottom=-1;queue[0]=start;seen[start]=1;
  while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const next of [x>0?n-1:-1,x<width-1?n+1:-1,y>0?n-width:-1,y<height-1?n+width:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=threshold){seen[next]=1;queue[tail++]=next;}}
  if(tail>=minimumPixels)components.push({left,top,right,bottom,pixels:tail});
 }
 return components.sort((a,b)=>b.pixels-a.pixels);
}
export function thickBodyAnchor(data,width,height,{threshold=70,radius=2}={}){
 // Analysis only: eroding a temporary mask removes thin shafts/string without
 // changing a single painted PNG pixel. The largest thick component is the body.
 const mask=new Uint8ClampedArray(data.length);
 for(let y=radius;y<height-radius;y++)for(let x=radius;x<width-radius;x++){
  let solid=true;for(let oy=-radius;oy<=radius&&solid;oy++)for(let ox=-radius;ox<=radius;ox++)if(ox*ox+oy*oy<=radius*radius&&data[((y+oy)*width+x+ox)*4+3]<threshold){solid=false;break;}
  if(solid)mask[(y*width+x)*4+3]=255;
 }
 const body=alphaComponents(mask,width,height,70,12)[0]||alphaBounds(data,width,height,threshold);if(!body)return null;
 const footY=Math.min(height,body.bottom+radius+1),bodyHeight=body.bottom-body.top+1+radius*2,lowerStart=Math.max(body.top,body.bottom-Math.max(4,Math.round(bodyHeight*.18)));
 let totalX=0,count=0;for(let y=lowerStart;y<=body.bottom;y++)for(let x=body.left;x<=body.right;x++)if(mask[(y*width+x)*4+3]){totalX+=x;count++;}
 return {x:count?totalX/count:(body.left+body.right)/2,y:footY,bodyHeight,bodyBounds:body,method:'largest thick alpha component; source pixels unchanged'};
}
export function removeConnectedKey(data,width,height,color,tolerance=45){
 const key=Array.isArray(color)?color:color.replace('#','').match(/../g).map(v=>parseInt(v,16)),seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0,removed=0;
 function visit(x,y){if(x<0||y<0||x>=width||y>=height)return;const n=y*width+x;if(seen[n])return;seen[n]=1;const i=n*4,delta=Math.hypot(data[i]-key[0],data[i+1]-key[1],data[i+2]-key[2]);if(data[i+3]===0||delta<=tolerance){data[i+3]=0;queue[tail++]=n;removed++;}}
 for(let x=0;x<width;x++){visit(x,0);visit(x,height-1);}for(let y=0;y<height;y++){visit(0,y);visit(width-1,y);}while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}return removed;
}
export function gridRect(width,height,column,row,columns,rows){
 if(column<0||row<0||column>=columns||row>=rows)throw new Error('Source grid index is outside the declared sheet.');
 const x=Math.floor(column*width/columns),y=Math.floor(row*height/rows);return {x,y,width:Math.floor((column+1)*width/columns)-x,height:Math.floor((row+1)*height/rows)-y};
}
export function transparentGridEdges(data,width,height,columns,rows,{threshold=70,maximumInkPixels=3,minimumGap=2}={}){
 function edges(length,crossLength,horizontal,count){
  const ink=Array.from({length},(_,position)=>{let n=0;for(let cross=0;cross<crossLength;cross++){const x=horizontal?cross:position,y=horizontal?position:cross;if(data[(y*width+x)*4+3]>=threshold)n++;}return n;});
  const gaps=[];let start=-1;for(let p=0;p<=length;p++){if((ink[p]??Infinity)<=maximumInkPixels){if(start<0)start=p;}else if(start>=0){if(p-start>=minimumGap&&start>0&&p<length)gaps.push({start,end:p-1,middle:Math.round((start+p-1)/2),length:p-start});start=-1;}}
  if(gaps.length!==count-1)throw new Error(`Transparent ${horizontal?'row':'column'} separators: expected ${count-1}, found ${gaps.length}. Inspect the image or provide explicit crop rectangles; no figure will be guessed or redrawn.`);
  return [0,...gaps.map(g=>g.middle),length];
 }
 return {x:edges(width,height,false,columns),y:edges(height,width,true,rows)};
}
export function validateFrameEntries(frames){
 const keys=new Set();for(const frame of frames){if(!frame.type||!frame.action||!Number.isInteger(frame.direction)||!Number.isInteger(frame.directions)||frame.direction<0||frame.direction>=frame.directions)throw new Error('Each frame requires type, action, direction and directions.');const key=[frame.type,frame.action,frame.direction,frame.frame||0].join('|');if(keys.has(key))throw new Error('Repeated frame mapping: '+key);keys.add(key);}return keys;
}
function rasterLibrary(){return require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');}
export async function processPaintedAtlas(config,baseDirectory=process.cwd()){
 validateFrameEntries(config.frames||[]);if(!config.frames?.length)throw new Error('At least one explicitly mapped painted frame is required.');
 const {createCanvas,loadImage}=rasterLibrary(),sources=new Map();
 for(const [key,source]of Object.entries(config.sources||{})){const file=path.resolve(baseDirectory,source.path),image=await loadImage(file);sources.set(key,{...source,file,image});}
 const cellWidth=config.cellWidth||256,cellHeight=config.cellHeight||256,anchorX=config.anchorX??cellWidth/2,anchorY=config.anchorY??cellHeight*.84,columns=config.columns||Math.min(8,config.frames.length),rows=Math.ceil(config.frames.length/columns);
 const atlas=createCanvas(columns*cellWidth,rows*cellHeight),ctx=atlas.getContext('2d'),entries=[],warnings=[],fingerprints=new Map();
 for(const [index,frame]of config.frames.entries()){
  const source=sources.get(frame.source);if(!source)throw new Error('Unknown painted source '+frame.source);
  const rect=frame.crop?{x:frame.crop[0],y:frame.crop[1],width:frame.crop[2],height:frame.crop[3]}:gridRect(source.image.width,source.image.height,frame.column,frame.row,source.columns,source.rows);
  const cell=createCanvas(rect.width,rect.height),c=cell.getContext('2d');c.drawImage(source.image,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);const rgba=c.getImageData(0,0,rect.width,rect.height);
  if(source.keyColor)removeConnectedKey(rgba.data,rect.width,rect.height,source.keyColor,source.keyTolerance);c.putImageData(rgba,0,0);
  const bounds=alphaBounds(rgba.data,rect.width,rect.height,config.alphaThreshold||40);if(!bounds)throw new Error('Empty painted source frame '+index);
  const sourceAnchor=frame.sourceAnchor||source.anchor||[rect.width/2,rect.height*(source.anchorFraction??.85)],scale=frame.scale??source.scale??(config.bodyHeight&& (frame.sourceBodyHeight||source.bodyHeight)?config.bodyHeight/(frame.sourceBodyHeight||source.bodyHeight):1),x=index%columns*cellWidth,y=Math.floor(index/columns)*cellHeight;
  const destLeft=anchorX+(bounds.left-sourceAnchor[0])*scale,destTop=anchorY+(bounds.top-sourceAnchor[1])*scale,destRight=anchorX+(bounds.right+1-sourceAnchor[0])*scale,destBottom=anchorY+(bounds.bottom+1-sourceAnchor[1])*scale;
  if(Math.min(destLeft,destTop,cellWidth-destRight,cellHeight-destBottom)<(config.minimumPadding??2))throw new Error('Painted troop or weapon would clip output cell '+index+'; enlarge the cell or correct the shared scale/anchor.');
  ctx.drawImage(cell,0,0,rect.width,rect.height,x+anchorX-sourceAnchor[0]*scale,y+anchorY-sourceAnchor[1]*scale,rect.width*scale,rect.height*scale);
  const hash=createHash('sha256').update(rgba.data).digest('hex'),duplicate=fingerprints.get(hash);if(duplicate!==undefined)warnings.push({frame:index,duplicateOf:duplicate,message:'Exact duplicate painted pixels; inspect animation identity.'});else fingerprints.set(hash,index);
  const sourceEdge=Math.min(bounds.left,bounds.top,rect.width-bounds.right-1,rect.height-bounds.bottom-1);if(sourceEdge<2)warnings.push({frame:index,message:'Painted source touches a grid edge; inspect for a clipped weapon or neighboring cell.'});
  if(!frame.sourceAnchor&&!source.anchor)warnings.push({frame:index,message:'Foot anchor uses declared uniform grid fraction; verify it in review contact sheet.'});
  entries.push({type:frame.type,action:frame.action,direction:frame.direction,directions:frame.directions,frame:frame.frame||0,x,y,width:cellWidth,height:cellHeight,anchorX,anchorY,bodyHeight:config.bodyHeight||((frame.sourceBodyHeight||source.bodyHeight)?(frame.sourceBodyHeight||source.bodyHeight)*scale:null),source:frame.source,sourceCell:{...rect,anchor:sourceAnchor,bodyHeight:frame.sourceBodyHeight||source.bodyHeight||null,components:alphaComponents(rgba.data,rect.width,rect.height)},scale,bounds:{left:destLeft,top:destTop,right:destRight,bottom:destBottom},sha256:hash,...(frame.pose?{pose:frame.pose}:{})});
 }
 const output=path.resolve(baseDirectory,config.output),outDirectory=path.dirname(output);fs.mkdirSync(outDirectory,{recursive:true});fs.writeFileSync(output,atlas.toBuffer('image/png'));
 const manifest={version:1,provenance:'image-generated painted PNG; mechanical slicing only',atlas:path.basename(output),width:atlas.width,height:atlas.height,cellWidth,cellHeight,anchorX,anchorY,columns,rows,frames:entries};
 const manifestFile=output.replace(/\.png$/i,'.json');fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 if(config.loaderManifest){
  const loader={version:1,troops:{}};
  for(const [index,e]of entries.entries()){
   const settings=config.troops?.[e.type]||{},troop=loader.troops[e.type]??={house:settings.house,directions:e.directions,bodyHeight:settings.bodyHeight||31,sheets:{main:{src:config.assetSrc||path.basename(output),columns,rows,sourceBodyHeight:e.bodyHeight,anchor:[anchorX/cellWidth,anchorY/cellHeight]}},clips:{}};
   const directions=troop.clips[e.action]??=Array.from({length:e.directions},()=>[]);directions[e.direction][e.frame]={sheet:'main',cell:index,...(e.pose||{})};
  }
  const file=path.resolve(baseDirectory,config.loaderManifest);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(loader,null,2)+'\n');
 }
 const report={sourceFiles:[...sources].map(([id,s])=>({id,path:s.file,width:s.image.width,height:s.image.height})),output,manifest:manifestFile,frames:entries.length,warnings};fs.writeFileSync(output.replace(/\.png$/i,'-validation.json'),JSON.stringify(report,null,2)+'\n');
 if(config.review){const review=createCanvas(columns*cellWidth,rows*(cellHeight+24)),r=review.getContext('2d');r.fillStyle='#26333c';r.fillRect(0,0,review.width,review.height);for(const [i,e]of entries.entries()){const x=i%columns*cellWidth,y=Math.floor(i/columns)*(cellHeight+24);r.drawImage(atlas,e.x,e.y,cellWidth,cellHeight,x,y,cellWidth,cellHeight);r.fillStyle='#f0dfb1';r.font='12px sans-serif';r.fillText(`${e.type} ${e.action} d${e.direction}/${e.directions} f${e.frame}`,x+4,y+cellHeight+17);r.strokeStyle='#f5c871';r.lineWidth=1;r.beginPath();r.moveTo(x+anchorX-5,y+anchorY);r.lineTo(x+anchorX+5,y+anchorY);r.moveTo(x+anchorX,y+anchorY-4);r.lineTo(x+anchorX,y+anchorY+4);r.stroke();}const reviewFile=path.resolve(baseDirectory,config.review);fs.mkdirSync(path.dirname(reviewFile),{recursive:true});fs.writeFileSync(reviewFile,review.toBuffer('image/png'));report.review=reviewFile;}
 return report;
}
const self=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===self){const configFile=process.argv[2];if(!configFile)throw new Error('Usage: node source/process-painted-atlas.mjs path/to/config.json');const absolute=path.resolve(configFile),report=await processPaintedAtlas(JSON.parse(fs.readFileSync(absolute,'utf8')),path.dirname(absolute));console.log(JSON.stringify(report,null,2));}
