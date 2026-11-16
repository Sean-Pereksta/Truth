// Reproducible review sheets from the same complete cels used by the battlefield.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {completeTroopFrame,COMPLETE_TROOP_TYPES,TROOP_ACTIONS,TROOP_CELL} from '../complete-troops.js';
import {equipmentFor} from '../equipment.js';
const require=createRequire(import.meta.url),raster=require(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');
globalThis.document={createElement:()=>raster.createCanvas(1,1)};
const out=path.resolve(process.argv[2]||'source/outputs');fs.mkdirSync(out,{recursive:true});
const priorities=['river_ranger','sharpshooter','hill_huntsman','tollhouse_crossbow','hornhill_halberdier','vale_sentinel','winter_pikeman','thornwall_pikeman'];
const colors={wolf:'#8ac9e8',rose:'#95cb75',fish:'#6daedc',bridge:'#b6c4d1',huntsman:'#b88d68',falcon:'#a5b7ef'};
const teamFor=type=>{const sigil=type==='winter_pikeman'?'wolf':type==='thornwall_pikeman'?'rose':['sharpshooter','river_ranger'].includes(type)?'fish':type==='tollhouse_crossbow'?'bridge':['hill_huntsman','hornhill_halberdier'].includes(type)?'huntsman':'falcon';return {sigil,color:colors[sigil],dark:'#30444b'};};
function sheet(name,types,actions,directions=[0]){
 const scale=2,w=types.length*440,h=actions.length*directions.length*280+60,canvas=raster.createCanvas(w,h),c=canvas.getContext('2d');c.fillStyle='#1b3035';c.fillRect(0,0,w,h);c.font='bold 14px sans-serif';c.fillStyle='#ead9b3';types.forEach((type,i)=>c.fillText(type.replaceAll('_',' '),i*440+8,22));
 for(const [ai,action]of actions.entries())for(const [di,direction]of directions.entries())for(const [i,type]of types.entries()){
  const dirs=equipmentFor(type).directions||8,state={action,directionIndex:Math.round(direction*dirs/16)%dirs,directions:dirs,frame:action==='span'?3:action==='lower'?4:4,equipment:equipmentFor(type)},frame=completeTroopFrame(type,teamFor(type),state),x=i*440,y=60+(ai*directions.length+di)*280;
  c.fillStyle='#8fa9a6';c.font='11px sans-serif';c.fillText(action+' · '+Math.round(direction*dirs/16)+'/'+dirs,x+8,y+13);c.save();c.translate(x+220,y+250);c.scale(scale,scale);c.drawImage(frame.image,-frame.anchorX,-frame.anchorY);c.restore();
 }
 fs.writeFileSync(path.join(out,name+'.png'),canvas.toBuffer('image/png'));
}
sheet('troop-priorities',priorities,['ready','march','brace','thrust','death']);
sheet('ranged-release-cels',['river_ranger','hill_huntsman','dune_skirmisher','saltwind_axethrower'],['ready','aiming','release','recovery']);
sheet('crossbow-full-cels',['gilded_crossbow','tollhouse_crossbow','sharpshooter','vale_sentinel'],['ready','aiming','release','lower','span','take_bolt','seat_bolt','raise']);
sheet('polearm-directions',['winter_pikeman','thornwall_pikeman','hornhill_halberdier','bridge_warden'],['brace'],Array.from({length:16},(_,i)=>i));
fs.writeFileSync(path.join(out,'complete-troops-manifest.json'),JSON.stringify({cell:TROOP_CELL,bodyScale:'31px at battlefield zoom 1',rendering:'whole-cel, shared transparent cache',types:COMPLETE_TROOP_TYPES.map(type=>({type,directions:equipmentFor(type).directions||8,actions:TROOP_ACTIONS}))},null,2));
console.log('Wrote complete troop contact sheets and pose manifest to '+out);
