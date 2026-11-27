import {DRAGON_BREATH_SECONDS} from './directional-art.js';
import {dragonMouthOffsets} from './dragon-art.js';
import {HALF_TILE_WIDTH,HALF_TILE_HEIGHT} from './projectile-flight.js';

export function createScorchBed(){
  const tile=document.createElement('canvas');
  tile.width=tile.height=96;
  const c=tile.getContext('2d');
  const shade=c.createRadialGradient(48,48,0,48,48,47);
  shade.addColorStop(0,'rgba(88,42,26,.36)');
  shade.addColorStop(.52,'rgba(72,40,28,.31)');
  shade.addColorStop(.84,'rgba(43,30,22,.18)');
  shade.addColorStop(1,'rgba(43,30,22,0)');
  c.fillStyle=shade;c.fillRect(0,0,96,96);
  for(let i=0;i<8;i++){
    const angle=i*2.39996,r=Math.sqrt((i+.5)/8)*35;
    const x=48+r*Math.cos(angle),y=48+r*Math.sin(angle),radius=9+i%4;
    const coal=c.createRadialGradient(x,y,1,x,y,radius);
    coal.addColorStop(0,'rgba(249,107,26,.3)');
    coal.addColorStop(.35,'rgba(193,64,18,.24)');
    coal.addColorStop(1,'rgba(137,44,18,0)');
    c.fillStyle=coal;c.fillRect(x-radius,y-radius,2*radius,2*radius);
  }
  return tile;
}

// Bake a few upright tongues from different moments of the same flame atlas.
// Cropping the incandescent middle produces a broad burning base while the
// original frayed end remains free to roll upward. Reuse the baked frame at
// every ground contact or burning soldier with no per-frame gradients.
export function createGroundFlameFrame(sheet,frame,variant){
  const tile=document.createElement('canvas');
  tile.width=88;tile.height=104;
  const c=tile.getContext('2d'),w=sheet.width/4,h=sheet.height/4;
  const tongues=variant===1?2:3;
  for(let i=0;i<tongues;i++){
    const seed=variant*2.52+i*3.91;
    const phase=(frame+variant*4+i*5)&15;
    const heat=.5+.5*Math.sin(phase/16*Math.PI*2+seed);
    const width=23+12*heat+(i===0?8:0),length=(i===0?67:44)+heat*12;
    const foot=44+(i===0?0:(i===1?-1:1)*(6+variant*2));
    const lean=(i===0?-.10:i===1?-.36:.27)+Math.sin(frame/16*Math.PI*2+seed)*.14;
    c.save();c.translate(foot,88);
    c.rotate(-Math.PI/2+lean);
    const offset=.32+.075*i;
    c.drawImage(sheet,w*((phase%4)+offset),h*(phase>>2),w*(1-offset),h,-4,-width*.5,length,width);
    c.restore();
  }
  c.globalCompositeOperation='destination-in';
  const edge=c.createLinearGradient(0,79,0,94);
  edge.addColorStop(0,'#fff');edge.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=edge;c.fillRect(0,0,88,104);
  c.globalCompositeOperation='destination-over';
  c.translate(44,86);c.scale(1,.42);
  const halo=c.createRadialGradient(0,0,0,0,0,34);
  halo.addColorStop(0,'rgba(255,172,64,.33)');
  halo.addColorStop(.5,'rgba(255,105,32,.18)');
  halo.addColorStop(1,'rgba(240,80,22,0)');
  c.fillStyle=halo;c.fillRect(-34,-34,68,68);
  return tile;
}

// Sixteen looping frames contain the hot jet, turbulent flame and softer
// smoke at its rim. Bend narrow strips along an arc from jaw to impact.
export function drawDragonBreath(c,ground,attack,row,age,lowDetail,sheet){
  if(!sheet||!(age>=0&&age<DRAGON_BREATH_SECONDS&&attack.distance>0))return;
  const [jawX,jawY]=dragonMouthOffsets[row];
  const x=ground.x+jawX,y=ground.y+jawY;
  const endX=ground.x+(attack.dx-attack.dy)*attack.distance*HALF_TILE_WIDTH;
  const endY=ground.y+(attack.dx+attack.dy)*attack.distance*HALF_TILE_HEIGHT-4;
  const dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy)||1;
  const nx=-dy/length,ny=dx/length;
  const width=Math.min(1/Math.hypot(nx/62,ny/31),length*.42+16);
  const lift=Math.min(29,10+length*.12,Math.abs(dx)*.42+length*.19);
  const front=Math.min(1,age/.15);
  const tail=Math.max(0,(age-(DRAGON_BREATH_SECONDS-.15))/.15);
  const span=front-tail;
  if(span<=0)return;
  const scaleY=2*width/(sheet.height/4);
  const frame=Math.floor(age*23+(attack.at||0)*7)&15;
  const w=sheet.width/4,h=sheet.height/4,sx=(frame%4)*w,sy=(frame>>2)*h;
  const segments=lowDetail?3:7;
  c.save();c.globalAlpha*=Math.min(1,age*32,(DRAGON_BREATH_SECONDS-age)*15);
  for(let i=0;i<segments;i++){
    const s0=i/segments,s1=(i+1)/segments;
    const t0=tail+s0*span,t1=tail+s1*span;
    const x0=x+dx*t0,y0=y+dy*t0-lift*4*t0*(1-t0);
    const x1=x+dx*t1,y1=y+dy*t1-lift*4*t1*(1-t1);
    const crop=w*(s1-s0),overlap=i<segments-1?.65:0;
    c.save();
    c.transform((x1-x0)/crop,(y1-y0)/crop,nx*scaleY,ny*scaleY,x0-nx*width,y0-ny*width);
    c.drawImage(sheet,sx+w*s0,sy,crop+overlap,h,0,0,crop+overlap,h);
    c.restore();
  }
  if(front>.95){
    // Spread the impact over the ground and let tongues roll upward. This
    // keeps the landing legible when looking down the length of the plume.
    const flares=lowDetail?2:4,opacity=c.globalAlpha;
    for(let i=0;i<flares;i++){
      const strand=(i/(flares-1)-.5)*2;
      const wave=.5+.5*Math.sin(age*17+i*1.9);
      const radius=(10+wave*7)*(1-Math.abs(strand)*.2);
      c.save();c.globalAlpha=opacity*(.58+.16*wave);
      c.translate(endX+strand*width*.50,endY-Math.abs(strand)*1.8);
      c.rotate(-Math.PI*.5+strand*.78);
      c.drawImage(sheet,sx,sy,w,h,0,-radius*.22,radius,radius*.43);
      c.restore();
    }
  }
  // Embers move independently of the flame texture. One batched stroke
  // renders them and no particles enter the simulation or network snapshot.
  c.strokeStyle='#ffce72';c.lineWidth=lowDetail?1.4:1.15;c.beginPath();
  const sparks=lowDetail?4:18,seed=(attack.at||0)*3.17+row;
  for(let i=0;i<sparks;i++){
    const s=(age*1.4+i*.618034)%1,t=tail+s*span;
    const offset=Math.sin(i*2.39996+seed)*width*s*(.65+.42*Math.sin(i*3.3+age));
    const px=x+dx*t+nx*offset;
    const py=y+dy*t-lift*4*t*(1-t)+ny*offset-s*s*(7+(i%5)*5);
    c.moveTo(px,py);c.lineTo(px+dx/length*(2+s*3),py+dy/length*2-1.5*s);
  }
  c.stroke();c.restore();
}
