import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {alphaBounds,alphaComponents,gridRect,transparentGridEdges} from './process-painted-atlas.mjs';
const require=createRequire(import.meta.url);
export const PAINTED_ROW_MAPS=Object.freeze({
 polearm:{ready:[0],march:[1,2],backward:[3,4],turn:[5],lower:[6,7],brace:[8],thrust:[9,10],recovery:[11],hit:[12],death:[13,14,15]},
 ranged:{ready:[0],march:[1,2],backward:[3],turn:[4],aiming:[5],release:[6],lower:[7],span:[8,9],take_bolt:[10],seat_bolt:[11],raise:[12],hit:[13],death:[14,15]}
});
export async function buildPaintedManifest(config,baseDirectory=process.cwd()){
 const raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas'),manifest={version:1,provenance:'New image-generated hand-painted sprite PNGs; explicit cells, no procedural body or equipment replacements.',troops:{},buildings:config.buildings||{}},report={sources:[],missing:[],warnings:[]};
 for(const source of config.sources||[]){
  const file=path.resolve(baseDirectory,source.file),image=await raster.loadImage(file),columns=source.columns||8,rows=source.rows||16,actions=source.actions||PAINTED_ROW_MAPS[source.kind];
  if(!actions)throw new Error('Unknown row map '+source.kind);if(!(source.sourceBodyHeight>0))throw new Error('Declare the measured standing-body pixel height for '+source.type+'; weapon bounds must never determine body scale.');
  const directions=source.directions||((source.kind==='polearm'&&source.totalDirections!==8)?Array.from({length:8},(_,i)=>i*2+(source.page==='diagonal'?1:0)):Array.from({length:columns},(_,i)=>i)),totalDirections=source.totalDirections||(source.kind==='polearm'?16:8),sheetId=source.sheet||source.page||'main',anchor=source.anchor||[.5,.88];
  const troop=manifest.troops[source.type]??={house:source.house,directions:totalDirections,bodyHeight:source.bodyHeight||31,sheets:{},clips:{}};
  if(troop.sheets[sheetId])throw new Error('Duplicate sheet '+source.type+'/'+sheetId);
  troop.sheets[sheetId]={src:source.assetSrc||source.file.replaceAll('\\','/'),columns,rows,sourceBodyHeight:source.sourceBodyHeight,anchor};
  const canvas=raster.createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data;let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]<8)transparent++;
  if(transparent/(image.width*image.height)<.15)throw new Error(source.file+' has insufficient transparent background; use image generation/editing to supply transparent painted artwork.');
  const detected=source.adaptiveGrid?transparentGridEdges(data,image.width,image.height,columns,rows,source.separatorOptions):null,edges=source.edges||detected,cells=[];
  for(const [action,rowList]of Object.entries(actions)){
   const clip=troop.clips[action]??=Array.from({length:totalDirections},()=>[]);
   for(let column=0;column<directions.length;column++)for(const [phase,row]of rowList.entries()){
    if(clip[directions[column]][phase])throw new Error('Overlapping clip '+source.type+' '+action+' '+directions[column]+' '+phase);
    const rect=edges?{x:edges.x[column],y:edges.y[row],width:edges.x[column+1]-edges.x[column],height:edges.y[row+1]-edges.y[row]}:gridRect(image.width,image.height,column,row,columns,rows),cel=raster.createCanvas(rect.width,rect.height),c=cel.getContext('2d');c.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);const pixels=c.getImageData(0,0,rect.width,rect.height).data,bounds=alphaBounds(pixels,rect.width,rect.height,40);if(!bounds)throw new Error('Empty painted cell '+source.file+' '+column+','+row);
    const cell=row*columns+column,pose=source.pose?.[action]?.[column]?.[phase]||{},anchorPixels=source.footAnchors?.[cell]||(source.autoFootAnchor==='alpha-bottom'?[rect.width/2,bounds.bottom+1]:null);
    clip[directions[column]][phase]={sheet:sheetId,cell,...(edges?{rect:[rect.x,rect.y,rect.width,rect.height]}:{}),...(anchorPixels?{anchorPixels}:{}),...pose};
    const edge=Math.min(bounds.left,bounds.top,rect.width-bounds.right-1,rect.height-bounds.bottom-1);if(edge<2)report.warnings.push({file:source.file,cell,message:'Paint reaches a cell edge; visually inspect the complete weapon and row boundary.'});
    cells.push({cell,action,phase,direction:directions[column],...rect,alphaBounds:bounds,components:alphaComponents(pixels,rect.width,rect.height),anchorPixels:anchorPixels||[rect.width*anchor[0],rect.height*anchor[1]]});
   }
  }
  report.sources.push({file:source.file,type:source.type,sheet:sheetId,width:image.width,height:image.height,columns,rows,edges,transparentFraction:transparent/(image.width*image.height),sourceBodyHeight:source.sourceBodyHeight,bodyScale:troop.bodyHeight/source.sourceBodyHeight,cells});
 }
 for(const [type,troop]of Object.entries(manifest.troops))for(const [action,directions]of Object.entries(troop.clips))for(let d=0;d<troop.directions;d++)if(!directions[d]?.length)report.missing.push({type,action,direction:d});
 for(const type of config.requiredTroops||[])if(!manifest.troops[type])report.missing.push({type,message:'Required painted troop has no generated PNG source.'});
 if(config.requireComplete&&report.missing.length)throw new Error('Painted manifest has '+report.missing.length+' missing directions or troop sources.');
 const output=path.resolve(baseDirectory,config.output||'assets/painted-troops/manifest.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');const validation=output.replace(/\.json$/,'-validation.json');fs.writeFileSync(validation,JSON.stringify(report,null,2)+'\n');return {output,validation,troops:Object.keys(manifest.troops),sources:report.sources.length,missing:report.missing.length,warnings:report.warnings.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const configFile=path.resolve(process.argv[2]||'source/painted-source-map.json'),config=JSON.parse(fs.readFileSync(configFile,'utf8'));console.log(JSON.stringify(await buildPaintedManifest(config,path.resolve(config.root||'.')),null,2));}
