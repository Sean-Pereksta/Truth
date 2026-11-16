import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {setPaintedTroopAtlases,completeTroopFrame,paintedTroopCoverage} from '../complete-troops.js';
const require=createRequire(import.meta.url),raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas'),gameRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url))),manifestFile=path.resolve(process.argv[2]||path.join(gameRoot,'assets/painted-troops/manifest.json')),output=path.resolve(process.argv[3]||path.join(gameRoot,'source/outputs/painted-review'));
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),images=new Map();for(const troop of Object.values(manifest.troops||{}))for(const sheet of Object.values(troop.sheets||{}))if(!images.has(sheet.src))images.set(sheet.src,await raster.loadImage(path.resolve(gameRoot,sheet.src)));for(const building of Object.values(manifest.buildings||{}))if(!images.has(building.src))images.set(building.src,await raster.loadImage(path.resolve(gameRoot,building.src)));setPaintedTroopAtlases(manifest,images);fs.mkdirSync(output,{recursive:true});
const zoom=2,width=224,height=180;
for(const [type,troop]of Object.entries(manifest.troops||{})){
 if(process.argv[4]&&type!==process.argv[4])continue;const actionFilter=process.argv[5]?.split(',');
 const rows=[];for(const [action,directions]of Object.entries(troop.clips)){if(actionFilter&&!actionFilter.includes(action))continue;const phases=Math.max(...directions.map(clip=>clip.length));for(let phase=0;phase<phases;phase++)rows.push({action,phase,phases});}
 const canvas=raster.createCanvas(troop.directions*width,rows.length*height+28),c=canvas.getContext('2d');c.fillStyle='#26343b';c.fillRect(0,0,canvas.width,canvas.height);c.font='bold 15px sans-serif';c.fillStyle='#e9d6aa';c.fillText(type+' · painted source PNGs · display zoom '+zoom,8,20);
 for(const [row,{action,phase,phases}]of rows.entries())for(let direction=0;direction<troop.directions;direction++){
  const cel=completeTroopFrame(type,{sigil:troop.house},{action,directionIndex:direction,directions:troop.directions,phase:Math.min(.999,(phase+.01)/phases)});if(!cel)throw Error('Missing painted review cel '+type+' '+action+' '+direction);
  const x=direction*width+width/2,y=28+row*height+height-24;c.strokeStyle='#c1a66c';c.lineWidth=1;c.beginPath();c.moveTo(x-5,y);c.lineTo(x+5,y);c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke();c.drawImage(cel.image,cel.sx,cel.sy,cel.sw,cel.sh,x-cel.anchorX*zoom,y-cel.anchorY*zoom,cel.width*zoom,cel.height*zoom);c.fillStyle='#edddb5';c.font='11px sans-serif';c.fillText(`${action} ${phase+1}/${phases} · direction ${direction}`,direction*width+5,28+row*height+height-6);
 }
 fs.writeFileSync(path.join(output,type+'-painted-review.png'),canvas.toBuffer('image/png'));console.log('Reviewed painted PNG frames: '+type+' ('+rows.length+' pose rows × '+troop.directions+' directions)');
}
fs.writeFileSync(path.join(output,'painted-coverage.json'),JSON.stringify(paintedTroopCoverage(),null,2)+'\n');
