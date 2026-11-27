import {atlasPose,atlasPoses,facingRow,stableFacingRow,attackFacing,attackFacingRow,directionalAnchor,dragonBreathAge,DRAGON_BREATH_SECONDS} from './directional-art.js';
import {directionalSheets} from './directional-sheets.js';
import {DirectionalPalette} from './directional-palette.js';
import {drawDragonBreath,createScorchBed,createGroundFlameFrame} from './dragon-flame.js';
import {queueArtwork} from './asset-loader.js';
import {BUILD_DEFS,UNIT_DEFS} from './core.js';
import {corpseOpacity} from './aftermath.js';
import {combatPose,drawCombatAccents,drawSiegeEarthImpact,isSiegeEarthImpact,visibleCombatEffects} from './combat-visuals.js';
import {PAINTED_TROOPS,paintedTroopDefinition,selectPaintedFrame} from './painted-troops.js';
import {PAINTED_HEROES,HERO_ACTIONS,selectHeroFrame,selectStandardFrame,heroOwnsVisibleStandard} from './painted-heroes.js';
import {paintTerrainPolish,roadsideFields,preparePaintedGround,bakePaintedGround,onPaintedApproach} from './terrain-polish.js';
import {FormationBannerLayer} from './formation-banners.js';
import {BridgeArtwork,bridgeSurface} from './bridge-art.js';
import {TREBUCHET_TIMES} from './regiments.js';
import {HALF_TILE_WIDTH as HW,HALF_TILE_HEIGHT as HH,projectileKind,projectileDrawPose} from './projectile-flight.js';
import {unitPresentationMix,unitPresentationPhase} from './local-presentation.js';

const TAU=Math.PI*2;
const HOUSE_ART_ORDER=['wolf','lion','dragon','stag','rose','sun','kraken','falcon','flayed','bridge','bear','fish','frog','beacon','huntsman','bone'];
const HOUSE_UNIT_CLASSES={wolf:'infantry',lion:'archer',dragon:'siege',stag:'cavalry',rose:'cavalry',sun:'archer',kraken:'infantry',falcon:'archer',flayed:'infantry',bridge:'infantry',bear:'infantry',fish:'archer',frog:'archer',beacon:'siege',huntsman:'archer',bone:'infantry'};
const REGIMENT_ART_TYPES=['shield_bearer','lance_champion'];
const REGIMENT_ART_HOUSES={wolf:'shield_bearer',lion:'shield_bearer',dragon:'shield_bearer',rose:'shield_bearer',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion'};
const REINFORCEMENT_HOUSES={"stormbreaker": "stag", "saltwind_axethrower": "kraken", "tollhouse_crossbow": "bridge", "crannog_spearhand": "frog", "hornhill_halberdier": "huntsman", "sun_horse_archer": "sun"};
const REINFORCEMENT_BUILDINGS=["stormbreaker_forge", "saltwind_lodge", "tollhouse_range", "crannog_spear_lodge", "hornhill_drill_hall", "sunbow_corral"];
const CONQUEST_ART_HOUSES={trebuchet:['flayed','beacon'],giant:['bone'],sharpshooter:['fish']};
const CONQUEST_ART_BUILDINGS=['dread_siege_yard','hightower_siege_yard','giant_camp','sharpshooter_lodge'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const iso=(x,y)=>({x:(x-y)*HW,y:(x+y)*HH});
const hash=(x,y=0)=>{let n=(x*374761393+y*668265263)^0x45d9f3b;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
export function worldToScreen(x,y,v){return {x:((x-y)*HW-v.x)*v.zoom+v.w/2,y:((x+y)*HH-v.y)*v.zoom+v.h/2};}
export function screenToWorld(x,y,v){const ix=(x-v.w/2)/v.zoom+v.x,iy=(y-v.h/2)/v.zoom+v.y;return {x:(ix/HW+iy/HH)/2,y:(iy/HH-ix/HW)/2};}
function polygon(c,pts,fill,stroke){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function diamond(c,x,y,w=HW,h=HH,fill,stroke){polygon(c,[[x,y-h],[x+w,y],[x,y+h],[x-w,y]],fill,stroke);}
function line(c,x1,y1,x2,y2,color,width=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
function makeCanvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
function softenMaterialSeam(canvas){
  // Blend the opposing edges of the painted material once, before it wraps.
  // Preserve the authored brushwork in the interior and use no substitute colors.
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,im=c.getImageData(0,0,w,h),p=im.data;
  const blend=(a,b,weight)=>{
    for(let channel=0;channel<3;channel++){
      const delta=(p[b+channel]-p[a+channel])*weight;p[a+channel]+=delta;p[b+channel]-=delta;
    }
  };
  const border=Math.max(1,Math.round(Math.min(w,h)*.08));
  for(let d=0;d<border;d++){
    const mix=.5*(1-d/border)**2;
    for(let y=0;y<h;y++)blend((y*w+d)*4,(y*w+w-1-d)*4,mix);
    for(let x=0;x<w;x++)blend((d*w+x)*4,((h-1-d)*w+x)*4,mix);
  }
  c.putImageData(im,0,0);
}
function loadBattlefieldSheet(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('A painted battlefield sheet could not be loaded.'));
    queueArtwork(image,src);
  });
}
const highlandRockWidths=[88,62,82,58,89,84];
function placeHighlandCrags(g,decor){
  // One rock group per two-tile patch. Choose its foot on impassable rock,
  // keeping the bright, lower shelves and scree nearest the playable pass.
  const mountain=t=>t?.terrain==='mountain'&&!t.feature;
  const cols=Math.ceil(g.W/2),patches=new Int8Array(cols*Math.ceil(g.H/2)).fill(-1);
  for(let y=0;y<g.H;y+=2)for(let x=0;x<g.W;x+=2){
    let t,rank=-1;
    for(let dy=0;dy<2&&y+dy<g.H;dy++)for(let dx=0;dx<2&&x+dx<g.W;dx++){
      const here=g.tiles[(y+dy)*g.W+x+dx],score=hash(x+dx+117,y+dy+21);
      if(mountain(here)&&score>rank){t=here;rank=score;}
    }
    if(!t)continue;
    const neighbors=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>g.tileAt(t.x+dx+.5,t.y+dy+.5));
    const pass=neighbors.some(n=>n?.feature==='pass'),edge=neighbors.some(n=>!mountain(n));
    const variants=pass?[1,3,4]:edge?[0,1,3,4,5]:[0,2,4,5,1];
    const patch=y/2*cols+x/2;
    const adjacent=[patches[patch-cols],x>0?patches[patch-1]:-1,
      x>0?patches[patch-cols-1]:-1,x/2+1<cols?patches[patch-cols+1]:-1];
    const unique=variants.filter(v=>!adjacent.includes(v)),choices=unique.length?unique:variants;
    const v=choices[Math.min(choices.length-1,Math.floor(hash(t.x+501,t.y)*choices.length))];patches[patch]=v;
    decor.push({x:t.x+.26+hash(t.x,t.y+232)*.48,y:t.y+.26+hash(t.x+134,t.y)*.48,
      kind:'crag',variant:v,scale:(pass ? .71 : edge ? .82 : .98)+hash(t.x+76,t.y)*.26});
  }
}
function atlasCell(image,col,row,columns,rows,label){
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(width<columns*16||height<rows*16)throw new Error(label+' artwork is too small for its sprite grid.');
  const sx=Math.floor(col*width/columns),sy=Math.floor(row*height/rows),sw=Math.floor((col+1)*width/columns)-sx,sh=Math.floor((row+1)*height/rows)-sy;
  const cell=makeCanvas(sw,sh),ctx=cell.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
  const pixels=ctx.getImageData(0,0,sw,sh),data=pixels.data;let left=sw,top=sh,right=-1,bottom=-1;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4;if(data[i+3]<40){data[i+3]=0;continue;}if(data[i+3]>75){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(right<left)throw new Error(label+' contains an empty sprite.');
  ctx.putImageData(pixels,0,0);return {image:cell,left,top,width:right-left+1,height:bottom-top+1};
}
function compactAtlasFrame(frame,scale){
  const width=Math.max(1,Math.ceil(frame.width*scale)),height=Math.max(1,Math.ceil(frame.height*scale)),image=makeCanvas(width+4,height+4),c=image.getContext('2d');
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(frame.image,frame.left,frame.top,frame.width,frame.height,2,2,width,height);
  return {image,left:2,top:2,width,height,sourceBounds:{left:frame.left,top:frame.top,right:frame.image.width-frame.left-frame.width,bottom:frame.image.height-frame.top-frame.height,cellWidth:frame.image.width,cellHeight:frame.image.height}};
}

export class Renderer{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.sprites=new Map();this.treeSprites=new Map();this.structureSprites=new Map();this.structureFrames={};this.structuresReady=false;this.houseArtReady=false;this.houseTroopFrames={};this.houseKeepFrames={};this.houseProductionFrames={};this.regimentArtReady=false;this.regimentTroopFrames={};this.regimentBuildingsReady=false;this.regimentBuildingFrames={};this.campaignArtReady=false;this.campaignFrames={keep:[],tower:[],flag:[]};this.campaignSprites=new Map();this.cachedGame=null;this.territoryTime=-1;this.frame=0;this.minimapTransform=null;this.rasterSpritesReady=false;this.troopFrames={};this.assetError=null;this.terrainReady=false;this.terrainChunkCache=new Map();this.maxTerrainChunks=24;this.terrainChunkSize=16;this.terrainTileSprites=new Map();}
  async loadDirectionalSheets(game){
    this.directionalRows=new Map();
    this.directionalFacings=new WeakMap();
    this.directionalPalette=new DirectionalPalette();
    for(const [id,d] of Object.entries(directionalSheets)){
      const poses=atlasPoses(d.kit,id.startsWith('hero-'));
      this.directionalRows.set(id,{...d,columns:new Map(poses.map((pose,i)=>[pose,i]))});
    }
    // Decode the companies in this battle first. Reinforcements request their
    // own painting on first appearance, so unused houses cost no image memory.
    const initial=new Set((game?.units||[]).map(u=>this.directionalRow(u.type,game.teams[u.team]?.sigil)));
    if(game?.teams?.some(team=>team.sigil==='dragon'))initial.add(this.directionalRow('dragon'));
    await Promise.all([...initial].filter(Boolean).map(row=>this.loadDirectionalRow(row)));
  }
  directionalRow(type,sigil){
    return this.directionalRows?.get(type+'-'+sigil)||this.directionalRows?.get(type);
  }
  loadDirectionalRow(row){
    if(!row.loading){
      row.loading=loadBattlefieldSheet(row.src).then(img=>{
        if(img.width!==row.w*row.columns.size||img.height!==row.h*8)throw Error('Invalid directional sheet: '+row.src);
        row.img=img;
      }).catch(error=>{row.failed=true;throw error;});
    }
    return row.loading;
  }
  directionalFacing(u,g,direction,windup,remember=true){
    const previous=this.directionalFacings?.get(u);
    const captured=attackFacingRow(u,g);
    const angle=captured??(u.braceDir===direction?facingRow(direction.x,direction.y):
      windup>0&&previous!==undefined?previous:stableFacingRow(direction.x,direction.y,previous));
    if(remember&&u.hp>0&&angle!==previous)this.directionalFacings?.set(u,angle);
    return angle;
  }
  drawDirectional(c,u,g,sigil,color,p,direction,moving,windup=0,phase=u.phase,hitX=0,hitY=0){
    const row=this.directionalRow(u.type,sigil);
    if(!row)return false;
    if(!row.img){
      if(!row.loading&&!row.failed)this.loadDirectionalRow(row).catch(error=>{this.assetError=error.message;});
      return false;
    }
    const pose=atlasPose(u,g,moving,windup,phase);
    const col=row.columns.get(pose)??row.columns.get(pose==='block'?'hit':'idle');
    const angle=this.directionalFacing(u,g,direction,windup),anchor=directionalAnchor(row,angle,col),scale=row.worldScale??.5;
    const ax=anchor?.x??row.ax,ay=anchor?.y??row.ay;
    let img=row.img,sx=col*row.w,sy=angle*row.h,w=row.w,h=row.h,worldW=w,worldH=h,left=0,top=0;
    const small=this.directionalDisplayScale<=1&&scale<=.5;
    if(row.tint?/^#[0-9a-f]{6}$/i.test(color||''):small){
      const frame=this.directionalPalette.frame(row,col,angle,row.tint?color:null,small);
      img=frame.page.canvas;sx=frame.x;sy=frame.y;w=frame.w;h=frame.h;
      left=frame.cell.left;top=frame.cell.top;worldW=frame.cell.width;worldH=frame.cell.height;
    }
    const breath=u.type==='dragon'&&u.hp>0?dragonBreathAge(u,g):Infinity;
    const breathing=breath>=0&&breath<DRAGON_BREATH_SECONDS;
    if(breathing&&angle>=5)drawDragonBreath(c,p,u.attackVisual,angle,breath,this.lowDetail,this.dragonFlame);
    // The painted strike already carries the forward lean. Keep its ground
    // pivot with the selection ring, and reserve displacement for hit reaction.
    c.drawImage(img,sx,sy,w,h,p.x+(left-ax)*scale+hitX,p.y+(top-ay)*scale+hitY,worldW*scale,worldH*scale);
    if(breathing&&angle<5)drawDragonBreath(c,p,u.attackVisual,angle,breath,this.lowDetail,this.dragonFlame);
    return true;
  }
  async loadDragonArt(spireSrc,portraitSrc,flameSrc){
    const [spire,portrait,flame]=await Promise.all([loadBattlefieldSheet(spireSrc),loadBattlefieldSheet(portraitSrc),loadBattlefieldSheet(flameSrc)]);
    const width=spire.naturalWidth||spire.width,height=spire.naturalHeight||spire.height;
    const scale=Math.min(122/width,140/height);
    this.dragonspireFrame={image:spire,left:0,top:0,width,height,drawWidth:width*scale,drawHeight:height*scale,house:'dragon'};
    this.dragonIcon=portrait;
    this.dragonFlame=flame;
    this.fireSprites?.clear();
    this.structureSprites.clear();
  }
  dragonContainsScreenPoint(u,g,groundPoint,point,zoom){
    const row=this.directionalRow('dragon');
    if(!row?.img||u.hp<=0||!(zoom>0))return false;
    const scale=row.worldScale??.5;
    const lift=this.bridgeArtwork?.spanReady?this.bridgeArtwork.deckLift(g,u.x,u.y):0;
    const vx=u.motionVX??u.vx??0,vy=u.motionVY??u.vy??0;
    const moving=Math.hypot(vx,vy)>.07;
    const windup=zoom>=.5?combatPose(u,g,UNIT_DEFS.dragon,moving)?.windup:0;
    const col=row.columns.get(atlasPose(u,g,moving,windup))??0;
    const angle=this.directionalFacing(u,g,{x:u.facingX??vx,y:u.facingY??vy},windup,false);
    const anchor=directionalAnchor(row,angle,col),key=angle*row.columns.size+col;
    const px=(point.x-groundPoint.x)/zoom/scale+(anchor?.x??row.ax);
    const py=((point.y-groundPoint.y)/zoom+lift)/scale+(anchor?.y??row.ay);
    if(px<0||py<0||px>=row.w||py>=row.h)return false;
    const masks=row.hitMasks??=new Map();
    let mask=masks.get(key);
    if(!mask){
      const w=Math.ceil(row.w/4),h=Math.ceil(row.h/4),canvas=makeCanvas(w,h);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(row.img,col*row.w,angle*row.h,row.w,row.h,0,0,w,h);
      mask=ctx.getImageData(0,0,w,h);masks.set(key,mask);
    }
    const x=Math.floor(px/row.w*mask.width),y=Math.floor(py/row.h*mask.height);
    return mask.data[(y*mask.width+x)*4+3]>=88;
  }
  async loadBridgeArt(src='./assets/bridges/stone-edges.png'){
    this.bridgeArtwork??=new BridgeArtwork();const info=await this.bridgeArtwork.load(src);
    this.bridgeArchitectureCache=new Map();this.bridgeArchitectureBytes=0;return info;
  }
  async loadPaintedBridge(src,broadSrc){
    this.bridgeArtwork??=new BridgeArtwork();const result=await this.bridgeArtwork.loadSpan(src,broadSrc);
    this.terrainTileSprites.clear();this.cachedGame=null;return result;
  }
  async loadHouseEmblems(src='./assets/house-emblems.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('House-selection crest artwork could not be loaded.'));queueArtwork(im,src);});
    return this.setHouseEmblems(image);
  }
  setHouseEmblems(image){
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,frames={};
    for(const [index,sigil]of HOUSE_ART_ORDER.entries()){
      const sx=Math.floor(index%4*width/4),sy=Math.floor(Math.floor(index/4)*height/4),sw=Math.floor((index%4+1)*width/4)-sx,sh=Math.floor((Math.floor(index/4)+1)*height/4)-sy;
      const crest=makeCanvas(64,64),ctx=crest.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sx,sy,sw,sh,0,0,64,64);
      // The menu atlas has an opaque teal surround. Remove only teal pixels
      // connected to a cell border, preserving the exact painted shield inside.
      const pixels=ctx.getImageData(0,0,64,64),data=pixels.data,seen=new Uint8Array(4096),queue=new Uint16Array(4096);let head=0,tail=0;
      const visit=(x,y)=>{if(x<0||y<0||x>=64||y>=64)return;const n=y*64+x;if(seen[n])return;seen[n]=1;const i=n*4,r=data[i],g=data[i+1],b=data[i+2];if(r<80&&g<110&&b<115&&g>r*1.12&&b>r*1.03){data[i+3]=0;queue[tail++]=n;}};
      for(let k=0;k<64;k++){visit(k,0);visit(k,63);visit(0,k);visit(63,k);}
      while(head<tail){const n=queue[head++],x=n%64,y=Math.floor(n/64);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
      ctx.putImageData(pixels,0,0);frames[sigil]=crest;
    }
    this.houseEmblemFrames=frames;return {columns:4,rows:4,frames:16};
  }
  drawHouseCrest(c,team,x,y,size){
    const crest=this.houseEmblemFrames?.[team.sigil];if(crest)c.drawImage(crest,x-size/2,y-size/2,size,size);
  }
  async loadCampaignArt(src='./assets/campaign-structures.png'){
    this.campaignArtReady=false;
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The capital, watchtower and standard artwork could not be loaded.'));queueArtwork(im,src);});
    return this.setCampaignArt(image);
  }
  setCampaignArt(image){
    const sizes={keep:[[100,115],[135,145],[165,165]],tower:[[40,70],[52,90],[65,110]],flag:[[28,65],[31,70],[35,75]]},frames={keep:[],tower:[],flag:[]};
    const sourceWidth=image.naturalWidth||image.width,sourceHeight=image.naturalHeight||image.height,rowEdges=[0,Math.round(sourceHeight*400/1254),Math.round(sourceHeight*807/1254),sourceHeight];
    for(const [row,kind]of ['keep','tower','flag'].entries()){
      const rowImage=makeCanvas(sourceWidth,rowEdges[row+1]-rowEdges[row]);rowImage.getContext('2d').drawImage(image,0,rowEdges[row],sourceWidth,rowImage.height,0,0,sourceWidth,rowImage.height);
      for(let col=0;col<3;col++){
      const cell=atlasCell(rowImage,col,0,3,1,`${kind} level ${col+1}`),[width,height]=sizes[kind][col],scale=Math.min(width/cell.width,height/cell.height);
      frames[kind].push({...cell,scale,drawWidth:cell.width*scale,drawHeight:cell.height*scale,campaign:true,kind,level:col+1,anchorX:kind==='flag'?.27:.5});
      }
    }
    this.campaignFrames=frames;this.campaignSprites.clear();this.structureSprites.clear();this.campaignArtReady=true;this.cachedGame=null;
    this.campaignArtInfo={source:typeof image.src==='string'&&!image.src.startsWith('data:')?image.src:'embedded campaign PNG atlas',width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,columns:3,rows:3,frames:9,capitalLevels:3,towerLevels:3,standards:['neutral','common','royal']};
    return this.campaignArtInfo;
  }
  campaignSprite(frame,color=null){
    const key=frame.kind+'|'+frame.level+'|'+(color||'original');if(this.campaignSprites.has(key))return this.campaignSprites.get(key);
    const sprite=makeCanvas(frame.width,frame.height),c=sprite.getContext('2d',{willReadFrequently:true});c.drawImage(frame.image,frame.left,frame.top,frame.width,frame.height,0,0,frame.width,frame.height);
    if(/^#[0-9a-f]{6}$/i.test(color||'')){
      const pixels=c.getImageData(0,0,sprite.width,sprite.height),data=pixels.data,target=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
      for(let i=0;i<data.length;i+=4){if(data[i+3]<30)continue;const r=data[i],g=data[i+1],b=data[i+2],blue=b-Math.max(r,g);if(blue>12&&b>r*1.12&&b>g*1.05){const shade=clamp(b/175,.2,1.25),mix=clamp(blue/42,.3,.95);data[i]=r*(1-mix)+Math.min(255,target[0]*shade)*mix;data[i+1]=g*(1-mix)+Math.min(255,target[1]*shade)*mix;data[i+2]=b*(1-mix)+Math.min(255,target[2]*shade)*mix;}}
      c.putImageData(pixels,0,0);
    }
    this.campaignSprites.set(key,sprite);return sprite;
  }
  async loadTroops(src='./assets/troops-atlas.png'){
    this.rasterSpritesReady=false;this.assetError=null;
    try{
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The troop sprite atlas could not be loaded.'));queueArtwork(im,src);});
      this.setTroopAtlas(image);return this.troopAtlasInfo;
    }catch(error){this.assetError=error;throw error;}
  }
  setTroopAtlas(image){
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(width<80||height<100)throw new Error('The troop atlas must contain eight columns and five rows.');
    // Actual RGBA sprite sheet: five unit classes, four walk and four attack frames.
    // Intrinsic dimensions are used because generated atlases need not be 1280 square.
    const types=['infantry','archer','cavalry','siege','hero'];
    // The archer's atlas bounds include the bow and quiver, while the modern
    // infantry art is normalized to a 35-pixel body. Allow room for that
    // equipment so the archer's person remains comparable in size.
    const heights={infantry:28,archer:40,cavalry:37,siege:37,hero:35};
    const widths={infantry:20,archer:29,cavalry:31,siege:32,hero:24};
    this.troopFrames={};this.sprites.clear();
    for(let row=0;row<5;row++){
      const frames=[],type=types[row];let largestWidth=1,largestHeight=1;
      for(let col=0;col<8;col++){
        const sx=Math.floor(col*width/8),sy=Math.floor(row*height/5),sw=Math.floor((col+1)*width/8)-sx,sh=Math.floor((row+1)*height/5)-sy;
        const cell=makeCanvas(sw,sh),ctx=cell.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
        const pixels=ctx.getImageData(0,0,sw,sh),data=pixels.data;let left=sw,top=sh,right=0,bottom=0;
        for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4;if(data[i+3]<18){data[i+3]=0;continue;}if(data[i+3]>45){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
        if(left>right){left=0;top=0;right=sw-1;bottom=sh-1;}
        ctx.putImageData(pixels,0,0);const bw=right-left+1,bh=bottom-top+1;
        largestWidth=Math.max(largestWidth,bw);largestHeight=Math.max(largestHeight,bh);frames.push({image:cell,left,top,width:bw,height:bh});
      }
      const scale=Math.min(heights[type]/largestHeight,widths[type]/largestWidth);
      this.troopFrames[type]={frames,scale,height:largestHeight*scale,width:largestWidth*scale};
    }
    const source=typeof image.src==='string'?(image.src.startsWith('data:')?'embedded PNG atlas':image.src):'troops-atlas.png';
    this.troopAtlasInfo={source,width,height,columns:8,rows:5,frames:40,format:'RGBA',walkColumns:[0,1,2,3],attackColumns:[4,5,6,7],classes:types};
    this.rasterSpritesReady=true;this.assetError=null;return this.troopAtlasInfo;
  }
  async loadStructures(src='./assets/structures-atlas.png'){
    this.structuresReady=false;
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The structure sprite atlas could not be loaded.'));queueArtwork(im,src);});
    return this.setStructureAtlas(image);
  }
  setStructureAtlas(image){
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(width<90||height<80)throw new Error('The structure atlas must contain three columns and two rows.');
    const types=['keep','barracks','range','stables','tower','workshop'];
    const sizes={keep:[114,124],barracks:[77,76],range:[80,72],stables:[88,74],tower:[57,102],workshop:[91,81]};
    this.structureFrames={};this.structureSprites.clear();
    types.forEach((type,index)=>{
      const col=index%3,row=Math.floor(index/3),sx=Math.floor(col*width/3),sy=Math.floor(row*height/2),sw=Math.floor((col+1)*width/3)-sx,sh=Math.floor((row+1)*height/2)-sy;
      const cell=makeCanvas(sw,sh),ctx=cell.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
      const pixels=ctx.getImageData(0,0,sw,sh),data=pixels.data;let left=sw,top=sh,right=-1,bottom=-1;
      for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4;if(data[i+3]<18){data[i+3]=0;continue;}if(data[i+3]>45){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
      if(right<left)throw new Error('The '+type+' structure sprite is empty.');
      ctx.putImageData(pixels,0,0);const bw=right-left+1,bh=bottom-top+1,scale=Math.min(sizes[type][0]/bw,sizes[type][1]/bh);
      this.structureFrames[type]={image:cell,left,top,width:bw,height:bh,scale,drawWidth:bw*scale,drawHeight:bh*scale};
    });
    const source=typeof image.src==='string'?(image.src.startsWith('data:')?'embedded PNG atlas':image.src):'structures-atlas.png';
    this.structAtlasInfo={source,width,height,columns:3,rows:2,frames:6,format:'RGBA',classes:types};this.structuresReady=true;return this.structAtlasInfo;
  }
  async loadHouseArt({troops,castles,production}){
    this.houseArtReady=false;
    const load=src=>new Promise((resolve,reject)=>{if(!src)return reject(new Error('A house artwork source is missing.'));const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('House artwork could not be loaded: '+(src.startsWith('data:')?'embedded PNG':src)));queueArtwork(image,src);});
    try{
      const images=await Promise.all([...HOUSE_ART_ORDER.map(sigil=>load(troops?.[sigil])),load(castles),load(production)]);
      return this.setHouseArt({troops:Object.fromEntries(HOUSE_ART_ORDER.map((sigil,index)=>[sigil,images[index]])),castles:images[16],production:images[17]});
    }catch(error){this.assetError=error;throw error;}
  }
  setHouseArt({troops,castles,production}){
    this.houseArtReady=false;const unitFrames={},keepFrames={},productionFrames={};
    const sizes={infantry:[26,31],archer:[26,31],cavalry:[35,41],siege:[38,39]};
    for(const [index,sigil]of HOUSE_ART_ORDER.entries()){
      const image=troops?.[sigil];if(!image)throw new Error('Missing '+sigil+' troop sprite sheet.');
      const frames=Array.from({length:8},(_,frame)=>atlasCell(image,frame%4,Math.floor(frame/4),4,2,sigil+' troop frame '+frame));
      // Frey's extended polearm must not force its armored bearer into the
      // compact shared infantry box. Keep the full weapon, at human scale.
      const largestWidth=Math.max(...frames.map(f=>f.width)),largestHeight=Math.max(...frames.map(f=>f.height)),size=sigil==='bridge'?[33,40]:sizes[HOUSE_UNIT_CLASSES[sigil]],scale=Math.min(size[0]/largestWidth,size[1]/largestHeight);
      unitFrames[sigil]={frames,scale,width:largestWidth*scale,height:largestHeight*scale,house:sigil};
      for(const [kind,source,target,maxSize]of [['keep',castles,keepFrames,[124,132]],['production',production,productionFrames,[96,90]]]){
        if(!source)throw new Error('Missing house '+kind+' artwork.');
        const frame=atlasCell(source,index%4,Math.floor(index/4),4,4,sigil+' '+kind),scale=Math.min(maxSize[0]/frame.width,maxSize[1]/frame.height);
        target[sigil]={...frame,scale,drawWidth:frame.width*scale,drawHeight:frame.height*scale,house:sigil};
      }
    }
    this.houseTroopFrames=unitFrames;this.houseKeepFrames=keepFrames;this.houseProductionFrames=productionFrames;this.sprites.clear();this.structureSprites.clear();this.cachedGame=null;this.houseArtReady=true;this.assetError=null;
    const source=image=>typeof image.src==='string'&&!image.src.startsWith('data:')?image.src:'embedded PNG atlas';
    this.houseArtInfo={houses:HOUSE_ART_ORDER.slice(),troops:Object.fromEntries(HOUSE_ART_ORDER.map(sigil=>[sigil,{source:source(troops[sigil]),columns:4,rows:2,frames:8,walkFrames:[0,1,2,3],attackFrames:[4,5,6,7]}])),castles:{source:source(castles),columns:4,rows:4,frames:16},production:{source:source(production),columns:4,rows:4,frames:16}};
    return this.houseArtInfo;
  }
  async loadRegimentArt(sources=Object.fromEntries(Object.entries(REGIMENT_ART_HOUSES).map(([sigil,type])=>[sigil,'./assets/regiments/'+sigil+'-'+type.replaceAll('_','-')+'.png']))){
    this.regimentArtReady=false;
    try{
      const sigils=Object.keys(REGIMENT_ART_HOUSES),images=await Promise.all(sigils.map(sigil=>new Promise((resolve,reject)=>{
        const src=sources?.[sigil];if(!src)return reject(new Error('Missing '+sigil+' regiment artwork.'));
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The '+sigil+' regiment artwork could not be loaded.'));queueArtwork(image,src);
      })));
      return this.setRegimentArt(Object.fromEntries(sigils.map((sigil,index)=>[sigil,images[index]])));
    }catch(error){this.assetError=error;throw error;}
  }
  setRegimentArt(images){
    this.regimentArtReady=false;const rows={},info={},sizes={shield_bearer:[27,33],lance_champion:[50,56]};
    for(const [sigil,type]of Object.entries(REGIMENT_ART_HOUSES)){
      const image=images?.[sigil];if(!image)throw new Error('Missing '+sigil+' regiment artwork.');
      const extracted=Array.from({length:8},(_,frame)=>atlasCell(image,frame%4,Math.floor(frame/4),4,2,sigil+' '+type+' frame '+frame)),width=Math.max(...extracted.map(f=>f.width)),height=Math.max(...extracted.map(f=>f.height)),size=sizes[type],scale=Math.min(size[0]/width,size[1]/height),frames=extracted.map(frame=>compactAtlasFrame(frame,scale*3));
      (rows[type]??={})[sigil]={frames,scale:1/3,width:Math.max(...frames.map(f=>f.width))/3,height:Math.max(...frames.map(f=>f.height))/3,house:sigil,regiment:type};
      info[sigil]={type,source:typeof image.src==='string'&&!image.src.startsWith('data:')?image.src:'embedded regiment PNG atlas',columns:4,rows:2,frames:8,walkFrames:[0,1,2,3],attackFrames:[4,5,6,7]};
    }
    this.regimentTroopFrames=rows;this.regimentArtInfo=info;this.regimentArtReady=true;this.sprites.clear();this.assetError=null;return info;
  }
  async loadRegimentBuildings(src='./assets/regiments/production-buildings.png'){
    this.regimentBuildingsReady=false;
    try{
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The house regiment production artwork could not be loaded.'));queueArtwork(im,src);});
      return this.setRegimentBuildings(image);
    }catch(error){this.assetError=error;throw error;}
  }
  setRegimentBuildings(image){
    this.regimentBuildingsReady=false;const frames={},houses=Object.keys(REGIMENT_ART_HOUSES);
    for(const [index,sigil]of houses.entries()){
      const extracted=atlasCell(image,index%4,Math.floor(index/4),4,2,sigil+' regiment production building'),scale=Math.min(85/extracted.width,90/extracted.height),frame=compactAtlasFrame(extracted,scale*3);
      frames[sigil]={...frame,scale:1/3,drawWidth:frame.width/3,drawHeight:frame.height/3,house:sigil,regimentBuilding:true};
    }
    this.regimentBuildingFrames=frames;this.regimentBuildingsReady=true;this.structureSprites.clear();this.cachedGame=null;this.assetError=null;
    this.regimentBuildingArtInfo={source:typeof image.src==='string'&&!image.src.startsWith('data:')?image.src:'embedded regiment production PNG atlas',columns:4,rows:2,frames:7,houses};return this.regimentBuildingArtInfo;
  }
  async loadConquestArt(sources){
    this.conquestArtReady=false;
    const entries=await Promise.all(Object.entries(sources).map(async([key,src])=>[key,await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Castle conquest artwork could not be loaded: '+key));queueArtwork(im,src);})]));
    return this.setConquestArt(Object.fromEntries(entries));
  }
  setConquestArt(images){
    this.conquestArtReady=false;const troops={},buildings={},sizes={trebuchet:[58,55],giant:[44,58],sharpshooter:[27,34]};
    for(const type of Object.keys(CONQUEST_ART_HOUSES)){
      if(!images[type])throw new Error('Missing '+type+' conquest artwork.');
      const extracted=Array.from({length:8},(_,i)=>atlasCell(images[type],i%4,Math.floor(i/4),4,2,type+' frame '+i)),scale=Math.min(sizes[type][0]/Math.max(...extracted.map(f=>f.width)),sizes[type][1]/Math.max(...extracted.map(f=>f.height))),frames=extracted.map(f=>compactAtlasFrame(f,scale*3));
      troops[type]={frames,scale:1/3,width:Math.max(...frames.map(f=>f.width))/3,height:Math.max(...frames.map(f=>f.height))/3,...(type==='trebuchet'?{}:{house:CONQUEST_ART_HOUSES[type][0]})};
    }
    if(!images.buildings||!images.castles)throw new Error('Missing castle or conquest production artwork.');
    for(const [i,type]of CONQUEST_ART_BUILDINGS.entries()){
      const cell=atlasCell(images.buildings,i%2,Math.floor(i/2),2,2,type),scale=Math.min(98/cell.width,100/cell.height),frame=compactAtlasFrame(cell,scale*3);
      buildings[type]={...frame,scale:1/3,drawWidth:frame.width/3,drawHeight:frame.height/3,conquest:true};
    }
    const castles=Array.from({length:4},(_,i)=>{const cell=atlasCell(images.castles,i%2,Math.floor(i/2),2,2,'castle state '+i),scale=Math.min(132/cell.width,138/cell.height),frame=compactAtlasFrame(cell,scale*3);return {...frame,scale:1/3,drawWidth:frame.width/3,drawHeight:frame.height/3,conquest:true};});
    this.conquestTroopFrames=troops;this.conquestBuildingFrames=buildings;this.castleStateFrames=castles;this.conquestArtReady=true;this.sprites.clear();this.structureSprites.clear();this.cachedGame=null;
    return this.conquestArtInfo={troops:3,troopFrames:24,buildings:4,castleStates:4};
  }
  async loadReinforcementArt(sources){
    const entries=await Promise.all(Object.entries(sources).map(async([key,src])=>[key,await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Reinforcement artwork could not load: '+key));queueArtwork(im,src);})]));
    return this.setReinforcementArt(Object.fromEntries(entries));
  }
  setReinforcementArt(images){
    this.reinforcementArtReady=false;const troops={},buildings={};
    const sizes={stormbreaker:[30,37],saltwind_axethrower:[27,34],tollhouse_crossbow:[28,35],crannog_spearhand:[30,35],hornhill_halberdier:[39,52],sun_horse_archer:[48,49]};
    for(const [type,house]of Object.entries(REINFORCEMENT_HOUSES)){
      if(!images[type])throw new Error('Missing reinforcement sheet: '+type);
      const extracted=Array.from({length:8},(_,i)=>atlasCell(images[type],i%4,Math.floor(i/4),4,2,type+' frame '+i));
      const scale=Math.min(sizes[type][0]/Math.max(...extracted.map(f=>f.width)),sizes[type][1]/Math.max(...extracted.map(f=>f.height))),frames=extracted.map(f=>compactAtlasFrame(f,scale*3));
      troops[type]={frames,scale:1/3,width:Math.max(...frames.map(f=>f.width))/3,height:Math.max(...frames.map(f=>f.height))/3,house,reinforcement:true};
    }
    if(!images.buildings)throw new Error('Missing reinforcement buildings.');
    for(const [i,type]of REINFORCEMENT_BUILDINGS.entries()){
      const cell=atlasCell(images.buildings,i%3,Math.floor(i/3),3,2,type),scale=Math.min(97/cell.width,100/cell.height),frame=compactAtlasFrame(cell,scale*3);
      buildings[type]={...frame,scale:1/3,drawWidth:frame.width/3,drawHeight:frame.height/3,house:BUILD_DEFS[type].house,reinforcement:true};
    }
    this.reinforcementTroopFrames=troops;this.reinforcementBuildingFrames=buildings;this.reinforcementArtReady=true;this.sprites.clear();this.structureSprites.clear();this.cachedGame=null;
    return {troops:6,troopFrames:48,buildings:6};
  }
  getStructureFrame(type,houseSigil=null,level=1){
    if(type==='dragonspire'){
      const row=this.directionalRow('dragon');
      if(row&&!row.loading)this.loadDirectionalRow(row).catch(error=>{this.assetError=error.message;});
      return this.dragonspireFrame||null;
    }
    if(this.pikeBuildingFrames?.[type])return this.pikeBuildingFrames[type];
    if(REINFORCEMENT_BUILDINGS.includes(type))return this.reinforcementArtReady&&BUILD_DEFS[type]?.house===houseSigil?this.reinforcementBuildingFrames[type]:null;
    if(CONQUEST_ART_BUILDINGS.includes(type))return this.conquestArtReady&&BUILD_DEFS[type]?.house===houseSigil?this.conquestBuildingFrames[type]:null;
    if(type==='restored_castle')return this.conquestArtReady?this.castleStateFrames[1]:null;
    const definition=BUILD_DEFS[type];
    if(definition?.regimentBuilding)return this.regimentBuildingsReady&&definition.house===houseSigil?this.regimentBuildingFrames[houseSigil]||null:null;
    if(this.campaignArtReady&&(type==='keep'||type==='tower'))return this.campaignFrames[type][clamp(Math.floor(level)||1,1,3)-1];
    if(houseSigil&&this.houseArtReady){if(type==='keep')return this.houseKeepFrames[houseSigil]||this.structureFrames.keep;if(!this.structureFrames[type])return this.houseProductionFrames[houseSigil]||null;}
    return this.structureFrames[type]||null;
  }
  getTroopFrame(type,houseSigil=null){
    const painted=this.getPaintedTroop(type,houseSigil);if(painted)return painted;
    if(REINFORCEMENT_HOUSES[type])return this.reinforcementArtReady&&REINFORCEMENT_HOUSES[type]===houseSigil?this.reinforcementTroopFrames[type]:null;
    if(CONQUEST_ART_HOUSES[type])return this.conquestArtReady&&CONQUEST_ART_HOUSES[type].includes(houseSigil)?this.conquestTroopFrames[type]:null;
    if(REGIMENT_ART_TYPES.includes(type))return this.regimentArtReady?this.regimentTroopFrames[type]?.[houseSigil]||null:null;
    return this.troopFrames[type]||(houseSigil&&this.houseArtReady?this.houseTroopFrames[houseSigil]:null)||null;
  }
  getPaintedTroop(type,house=null){
    if(type==='hero')return this.heroRows?.get(house)||null;
    const d=paintedTroopDefinition(type,house);return d?this.paintedRows?.get(d.id)||null:null;
  }
  async loadCavalryCharge(src='./assets/battlefield-slice/cavalry-charge.png',directionSrc){
    const images=await Promise.all([loadBattlefieldSheet(src),loadBattlefieldSheet(directionSrc||src.replace('cavalry-charge.png','cavalry-directions.png'))]);
    // Authored toward/away views occupy less screen width than the side view.
    // All frames use a uniform rider/horse scale and the row's planted ground
    // line, so lifting a hoof neither stretches the animal nor moves the saddle.
    const pack=(image,rows,saddles,groundLines)=>{
      const cells=Array.from({length:4*rows},(_,i)=>atlasCell(image,i%4,Math.floor(i/4),4,rows,'cavalry frame '+i));
      const referenceHeight=Math.max(...cells.slice(0,4).map(cell=>cell.height));
      const scale=PAINTED_TROOPS.cavalry.bodyHeight/referenceHeight;
      return cells.map((cell,i)=>{
        const packed=compactAtlasFrame(cell,scale*2);
        return {image:packed.image,left:0,top:0,width:packed.image.width,height:packed.image.height,scale:.5,mutedBlueCloth:true,
          anchorX:2+(saddles[i]*cell.image.width-cell.left)*packed.width/cell.width,
          anchorY:2+(groundLines[Math.floor(i/4)]*cell.image.height-cell.top)*packed.height/cell.height};
      });
    };
    this.cavalryChargeFrames=[
      ...pack(images[0],2,[.42,.43,.45,.44,.46,.44,.41,.39],[.845,.90]),
      ...pack(images[1],4,[.46,.46,.46,.46,.46,.46,.46,.46,.53,.53,.53,.53,.53,.53,.53,.53],[.895,.905,.905,.91])
    ];
    this.registerCavalryCharge();
    return {frames:this.cavalryChargeFrames.length,source:src};
  }
  registerCavalryCharge(){
    const row=this.paintedRows?.get('cavalry');
    if(!row||!this.cavalryChargeFrames)return;
    const start=row.chargeFrameStart??row.frames.length,frames=[...row.frames.slice(0,start),...this.cavalryChargeFrames];
    this.paintedRows.set('cavalry',{...row,frames,chargeFrameStart:start,directionFrameStart:start+8,
      width:Math.max(...frames.map(f=>f.width*f.scale)),height:Math.max(...frames.map(f=>f.height*f.scale))});
    this.paintedPalettes?.clear();this.paintedSpriteCache?.clear();
  }
  async loadPaintedHeroes(sources=null,ids=null){
    this.heroArtReady=false;const rows=new Map();
    await Promise.all(Object.values(PAINTED_HEROES).filter(d=>!ids||ids.includes(d.house)).map(async d=>{
      const source=sources?.[d.house]||d.file,image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Missing painted hero artwork: '+d.house));queueArtwork(im,source);});
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,atlas=makeCanvas(width,height),ctx=atlas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const imageData=ctx.getImageData(0,0,width,height),pixels=imageData.data,rowCounts=new Uint32Array(height);
      // Generated PNGs sometimes retain almost-transparent RGB at their edges.
      // Normalize that padding exactly as for the existing painted troops.
      for(let i=3;i<pixels.length;i+=4){if(pixels[i]<=16)pixels[i]=0;if(pixels[i]>96)rowCounts[Math.floor((i/4)/width)]++;}ctx.putImageData(imageData,0,0);
      const gutter=(counts,expected,size)=>{let best=Math.round(expected),score=Infinity;for(let n=Math.max(1,Math.round(expected-size*.28));n<=Math.min(counts.length-1,Math.round(expected+size*.28));n++){const value=counts[n]+Math.abs(n-expected)*.08;if(value<score){score=value;best=n;}}return best;};
      const rowCuts=[0,...Array.from({length:7},(_,n)=>gutter(rowCounts,(n+1)*height/8,height/8)),height],frames=[],columnCuts=[];
      // Read the transparent gutters rather than assuming the image service's
      // returned dimensions divide evenly. Only crop authored raster pixels.
      for(let row=0;row<8;row++){
        const y1=rowCuts[row],y2=rowCuts[row+1],counts=new Uint32Array(width);for(let y=y1;y<y2;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>96)counts[x]++;
        const cuts=[0,...Array.from({length:7},(_,n)=>gutter(counts,(n+1)*width/8,width/8)),width];columnCuts.push(cuts);
        for(let col=0;col<8;col++){
          const x1=cuts[col],x2=cuts[col+1],w=x2-x1,h=y2-y1;let left=w,top=h,right=-1,bottom=-1;
          for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[((y+y1)*width+x+x1)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
          if(right<left)throw new Error('Empty painted hero action: '+d.house+' '+frames.length);
          let feet=0,weight=0;for(let y=Math.max(top,bottom-Math.ceil((bottom-top)*.08));y<=bottom;y++)for(let x=left;x<=right;x++)if(pixels[((y+y1)*width+x+x1)*4+3]>160){feet+=x;weight++;}
          const anchor=weight?feet/weight:(left+right)/2;let bodyTop=Math.round(h*.26);
          for(;bodyTop<bottom;bodyTop++){let count=0;for(let x=Math.max(0,Math.floor(anchor-w*.12));x<=Math.min(w-1,Math.ceil(anchor+w*.12));x++)if(pixels[((bodyTop+y1)*width+x+x1)*4+3]>160)count++;if(count>Math.max(4,w*.045))break;}
          const frame=makeCanvas(right-left+1,bottom-top+1),c=frame.getContext('2d');c.drawImage(atlas,x1+left,y1+top,frame.width,frame.height,0,0,frame.width,frame.height);
          let poleX=Math.round(anchor+w*.22),poleScore=-1;
          for(let x=Math.max(left,Math.round(anchor+w*.1));x<=right;x++){let count=0;for(let y=Math.round(top+(bottom-top)*.32);y<=bottom;y++)if(pixels[((y+y1)*width+x+x1)*4+3]>160)count++;if(count>poleScore){poleScore=count;poleX=x;}}
          frames.push({image:frame,left:0,top:0,width:frame.width,height:frame.height,anchorX:anchor-left,anchorY:bottom-top+1,poleAnchorX:poleX-left,poleAnchorY:bottom-top+1,bodyPixels:bottom-bodyTop+1,sourceBounds:{x:x1+left,y:y1+top,width:frame.width,height:frame.height}});
        }
      }
      const references=[16,18,19,20].map(n=>frames[n].bodyPixels).sort((a,b)=>a-b),scale=d.bodyHeight/Math.max(1,references[1]);
      for(const frame of frames)frame.scale=scale;
      rows.set(d.house,{...d,frames,painted:true,source,width:Math.max(...frames.map(f=>f.width*scale)),height:Math.max(...frames.map(f=>f.height*scale)),rowCuts,columnCuts});
    }));
    this.heroRows=rows;this.heroArtReady=true;this.paintedSpriteCache?.clear();this.sprites.clear();return {heroes:rows.size,frames:rows.size*64,facings:2,sourceFacing:'screen-right',otherFacing:'horizontal-mirror'};
  }
  drawHeroPortrait(canvas,sigil){
    const row=this.heroRows?.get(sigil);if(!row)return false;
    const frame=row.frames[HERO_ACTIONS.portrait],c=canvas.getContext('2d'),scale=Math.min((canvas.width-4)/frame.width,(canvas.height-4)/frame.height);
    c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(frame.image,(canvas.width-frame.width*scale)/2,canvas.height-frame.height*scale,frame.width*scale,frame.height*scale);return true;
  }
  heroStandardGround(c,g,ui,zoom){
    const ring=(x,y,radius,color)=>{c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.3/zoom;c.globalAlpha=.12;c.beginPath();for(let i=0;i<=64;i++){const a=i*TAU/64,p=iso(x+Math.cos(a)*radius,y+Math.sin(a)*radius);if(!i)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}c.closePath();c.fill();c.globalAlpha=.7;c.stroke();c.restore();};
    if(ui.standardPreview){const p=ui.standardPreview;ring(p.x,p.y,p.radius||5,p.valid?'#bddca0':'#ee9980');const q=iso(p.x,p.y);diamond(c,q.x,q.y,10,5,null,p.valid?'#dce9b3':'#ee9980');}
    for(const hero of g.units||[]){if(hero.type!=='hero'||hero.hp<=0||!ui.selected?.has(hero.id))continue;const standard=g.standardFor?.(hero.team)||g.standards?.find(s=>s.team===hero.team);if(!standard)continue;
      if(standard.state==='carrying'&&standard.carrierId===hero.id)ring(hero.x,hero.y,3,'#d6d49c');
      else if(standard.state==='planted'&&!standard.dormant)ring(standard.x,standard.y,5,'#d6d49c');
    }
  }
  battleStandard(c,standard,g){
    const row=this.heroRows?.get(g.teams[standard.team]?.sigil);if(!row)return;
    const p=iso(standard.x,standard.y),direction=iso(standard.facingX??1,standard.facingY??0),facing=direction.x<-.03?-1:1;
    this.drawPaintedTroop(c,row,selectStandardFrame(standard,g),facing,p.x,p.y);
  }
  async loadPaintedTroops(sources=null,ids=null){
    const rows=new Map();
    await Promise.all(Object.values(PAINTED_TROOPS).filter(d=>!ids||ids.includes(d.id)).map(async d=>{
      const src=sources?.[d.id]||d.file,image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Missing painted troop artwork: '+d.id));queueArtwork(im,src);});
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,frames=[];
      for(let row=0;row<d.rows;row++){
        const columns=d.rowColumns?.[row]||d.columns,cellTop=Math.round((d.rowCuts?.[row]??row/d.rows)*height),cellBottom=Math.round((d.rowCuts?.[row+1]??(row+1)/d.rows)*height);
        for(let col=0;col<columns;col++){
          const cellLeft=Math.round((d.columnCuts?.[row]?.[col]??col/columns)*width),cellRight=Math.round((d.columnCuts?.[row]?.[col+1]??(col+1)/columns)*width),w=cellRight-cellLeft,h=cellBottom-cellTop;
          const scan=makeCanvas(w,h),ctx=scan.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,cellLeft,cellTop,w,h,0,0,w,h);
          const imageData=ctx.getImageData(0,0,w,h),pixels=imageData.data;let left=w,top=h,right=-1,bottom=-1;
          // Normalize transparent padding during extraction, as the original
          // atlas loader does. Never paint replacement equipment or anatomy.
          for(let i=3;i<pixels.length;i+=4)if(pixels[i]<=16)pixels[i]=0;
          ctx.putImageData(imageData,0,0);
          const rowCounts=new Uint32Array(h);
          for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);rowCounts[y]++;}
          if(right<left)throw new Error('Empty painted action: '+d.id+' '+frames.length);
          let feet=0,weight=0;for(let y=Math.max(top,bottom-Math.ceil((bottom-top)*.09));y<=bottom;y++)for(let x=left;x<=right;x++){const a=pixels[(y*w+x)*4+3];if(a>96){feet+=x;weight++;}}
          const anchor=weight?feet/weight:(left+right)/2;
          // Thin raised shafts do not count as a soldier's body-height reference.
          let bodyTop=top;while(bodyTop<bottom&&rowCounts[bodyTop]<Math.max(5,w*.025))bodyTop++;
          frames.push({image:scan,left,top,width:right-left+1,height:bottom-top+1,anchorX:anchor-left,anchorY:bottom-top+1,bodyPixels:bottom-bodyTop+1});
        }
      }
      const bodyPixels=frames.slice(0,4).map(f=>f.bodyPixels).sort((a,b)=>a-b)[1],scale=d.bodyHeight/bodyPixels;
      const compact=frames.map(f=>{
        // Cache small RGBA frames once. Large weapons keep their full bounds.
        const factor=Math.min(1,scale*3),w=Math.ceil(f.width*factor),h=Math.ceil(f.height*factor),im=makeCanvas(w,h),c=im.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(f.image,f.left,f.top,f.width,f.height,0,0,w,h);
        const [releaseX,releaseY]=d.projectileRelease.point;
        return {...f,releaseX:(releaseX*w-f.anchorX*factor)*scale/factor,releaseHeight:(f.anchorY*factor-releaseY*h)*scale/factor,image:im,left:0,top:0,width:w,height:h,anchorX:f.anchorX*factor,anchorY:f.anchorY*factor,scale:scale/factor};
      });
      rows.set(d.id,{...d,frames:compact,scale:1,width:Math.max(...compact.map(f=>f.width*f.scale)),height:Math.max(...compact.map(f=>f.height*f.scale)),painted:true,source:src});
    }));
    this.paintedRows=rows;this.registerCavalryCharge();this.paintedArtReady=true;this.paintedPalettes?.clear();this.paintedSpriteCache?.clear();this.sprites.clear();return {troops:rows.size,facings:2,sourceFacing:'screen-right',otherFacing:'horizontal-mirror'};
  }
  drawPaintedTroop(c,row,index,facing,x,y,color=null){
    const f=row.frames[index]||row.frames[row.actions.ready]||row.frames[0],w=f.width*f.scale,h=f.height*f.scale;
    let source=f.image;
    if(!row.house&&/^#[0-9a-f]{6}$/i.test(color||'')){
      this.paintedPalettes??=new Map();const key=row.id+'|'+index+'|'+color;
      source=this.paintedPalettes.get(key);
      if(!source){source=makeCanvas(f.width,f.height);const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(f.image,0,0);const data=ctx.getImageData(0,0,source.width,source.height),target=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
        for(let i=0;i<data.data.length;i+=4){
          const p=data.data,r=p[i],g=p[i+1],b=p[i+2],blue=b-Math.max(r,g);
          const cloth=f.mutedBlueCloth?b-r>7&&b-g>1:blue>9&&b>r*1.1&&b>g*1.04;
          if(p[i+3]>16&&cloth){
            const shade=clamp(b/148,.14,1.18),mix=clamp(f.mutedBlueCloth?(b-r)/20:blue/38,.3,1);
            for(let k=0;k<3;k++)p[i+k]=p[i+k]*(1-mix)+Math.min(255,target[k]*shade)*mix;
          }
        }
        ctx.putImageData(data,0,0);this.paintedPalettes.set(key,source);
      }
    }
    let anchorX=f.anchorX;
    if(facing<0){
      this.paintedMirrors??=new WeakMap();let mirrored=this.paintedMirrors.get(source);
      if(!mirrored){mirrored=makeCanvas(f.width,f.height);const ctx=mirrored.getContext('2d');ctx.translate(f.width,0);ctx.scale(-1,1);ctx.drawImage(source,0,0);this.paintedMirrors.set(source,mirrored);}
      source=mirrored;anchorX=f.width-f.anchorX;
    }
    // Mirroring is cached, retaining the existing two facings without a
    // transform/save/restore for every soldier in a large battle.
    c.drawImage(source,x-anchorX*f.scale,y-f.anchorY*f.scale,w,h);
  }
  paintedSprite(row,index,facing=1){
    this.paintedSpriteCache??=new Map();const key=row.id+'|'+index+'|'+facing;if(this.paintedSpriteCache.has(key))return this.paintedSpriteCache.get(key);
    const f=row.frames[index]||row.frames[0],a=makeCanvas(f.width,f.height),c=a.getContext('2d');c.translate(facing<0?a.width:0,0);c.scale(facing,1);c.drawImage(f.image,0,0);a.anchorX=facing<0?a.width-f.anchorX:f.anchorX;a.anchorY=f.anchorY;a.worldScale=f.scale;this.paintedSpriteCache.set(key,a);return a;
  }
  async loadPikeBuildings(src='./assets/overhaul/pike-buildings.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Missing painted pike production artwork.'));queueArtwork(im,src);});
    this.pikeBuildingFrames={};['winter_pike_hall','thornwall_pavilion'].forEach((type,col)=>{const f=atlasCell(image,col,0,2,1,type),scale=Math.min(95/f.width,100/f.height);this.pikeBuildingFrames[type]={...f,scale,drawWidth:f.width*scale,drawHeight:f.height*scale,house:col?'rose':'wolf'};});this.structureSprites.clear();this.cachedGame=null;
  }
  structureSprite(type,color,houseSigil=null,level=1){
    const f=this.getStructureFrame(type,houseSigil,level);if(!f)return null;
    if(f.campaign)return this.campaignSprite(f,color);
    const key=type+'|'+(f.house?'house:'+f.house:color);if(this.structureSprites.has(key))return this.structureSprites.get(key);
    const a=makeCanvas(280,320),c=a.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(f.image,f.left,f.top,f.width,f.height,(70-f.drawWidth/2)*2,(146-f.drawHeight)*2,f.drawWidth*2,f.drawHeight*2);
    if(f.house){this.structureSprites.set(key,a);return a;}
    const pixels=c.getImageData(0,0,a.width,a.height),data=pixels.data;
    const target=/^#[0-9a-f]{6}$/i.test(color)?[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]:[125,180,220];
    for(let i=0;i<data.length;i+=4){if(data[i+3]<16)continue;const r=data[i],g=data[i+1],b=data[i+2],blue=b-Math.max(r,g);if(blue>9&&b>r*1.1&&b>g*1.04){const shade=clamp(b/148,.14,1.18),mix=clamp(blue/38,.3,1);data[i]=r*(1-mix)+Math.min(255,target[0]*shade)*mix;data[i+1]=g*(1-mix)+Math.min(255,target[1]*shade)*mix;data[i+2]=b*(1-mix)+Math.min(255,target[2]*shade)*mix;}}
    c.putImageData(pixels,0,0);this.structureSprites.set(key,a);return a;
  }
  async loadTerrain(groundSrc='./assets/ground-textures.png',propsSrc='./assets/terrain-props.png'){
    this.terrainReady=false;const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The terrain artwork could not be loaded.'));queueArtwork(im,src);});
    const [ground,props]=await Promise.all([load(groundSrc),load(propsSrc)]);return this.setTerrainAtlases(ground,props);
  }
  refreshLandscape(){
    if(this.deferLandscapeRefresh)return;
    this.treeSprites.clear();this.terrainTileSprites.clear();this.terrainChunkCache.clear();
    this.cachedGame=null;
  }
  async loadLandsArt(src='./assets/lands-atlas.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The Lands Update artwork could not be loaded.'));queueArtwork(im,src);});
    this.landsFrames={};
    ['mountain','woodland','stoneBridge','woodBridge','pass','ford','waymarker','ruin'].forEach((kind,i)=>{const f=atlasCell(image,i%4,Math.floor(i/4),4,2,'Lands '+kind),c=f.image.getContext('2d',{willReadFrequently:true}),pixels=c.getImageData(0,0,f.image.width,f.image.height),data=pixels.data;for(let p=0;p<data.length;p+=4){if(data[p]>180&&data[p]>data[p+1]*1.8&&data[p]>data[p+2]*1.8)data[p+3]=0;}c.putImageData(pixels,0,0);this.landsFrames[kind]=f;});
    this.landsArtReady=true;this.refreshLandscape();
    return {source:src,columns:4,rows:2,classes:Object.keys(this.landsFrames)};
  }
  async loadLandsGround(src='./assets/lands-ground.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The Lands ground textures could not be loaded.'));queueArtwork(im,src);});
    this.landsGroundFrames={};const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    ['water','road','bridge','ford','pass','mountain','bank','timber'].forEach((kind,i)=>{const sx=Math.floor(i%4*w/4),sy=Math.floor(Math.floor(i/4)*h/2),sw=Math.floor((i%4+1)*w/4)-sx,sh=Math.floor((Math.floor(i/4)+1)*h/2)-sy,a=makeCanvas(sw,sh);a.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,sw,sh);this.landsGroundFrames[kind]=a;});
    this.refreshLandscape();return {source:src,columns:4,rows:2,classes:Object.keys(this.landsGroundFrames)};
  }
  async loadBattlefieldArt(src,props=false){
    const image=await loadBattlefieldSheet(src);
    const names=props?['reeds','wattle','fordStones','heather','foundation','forestShrubs']:['riverPasture','cropland','shallows','hillPasture','passGravel','cartRoad'];
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,frames={};
    for(let i=0;i<names.length;i++){
      const col=i%3,row=Math.floor(i/3),x=Math.round(col*w/3),y=Math.round(row*h/2);
      const f=props?atlasCell(image,col,row,3,2,names[i]):{image,left:x,top:y,width:Math.round((col+1)*w/3)-x,height:Math.round((row+1)*h/2)-y};
      const cap=props&&names[i]!=='foundation'?144:384,scale=Math.min(1,cap/Math.max(f.width,f.height));
      const frame=makeCanvas(Math.max(1,Math.round(f.width*scale)),Math.max(1,Math.round(f.height*scale)));
      const ctx=frame.getContext('2d');ctx.imageSmoothingQuality='high';
      ctx.drawImage(f.image,f.left,f.top,f.width,f.height,0,0,frame.width,frame.height);
      if(!props)softenMaterialSeam(frame);
      frames[names[i]]=frame;
    }
    if(props)this.sliceDetails=frames;
    else this.sliceGround=frames;
    this.refreshLandscape();return names;
  }
  async loadHighlandCrags(src){
    const atlas=await loadBattlefieldSheet(src);
    this.highlandCrags=highlandRockWidths.map((width,i)=>{
      const f=atlasCell(atlas,i%3,Math.floor(i/3),3,2,'Highland crag'),height=width*f.height/f.width;
      const sprite=makeCanvas(288,336),ctx=sprite.getContext('2d');ctx.scale(3,3);ctx.imageSmoothingQuality='high';
      ctx.drawImage(f.image,f.left,f.top,f.width,f.height,48-width/2,100-height*.85,width,height);
      return sprite;
    });
    this.refreshLandscape();return this.highlandCrags.length;
  }
  async loadCartway(src){
    const image=await loadBattlefieldSheet(src),frame=makeCanvas(384,384),c=frame.getContext('2d');
    c.imageSmoothingQuality='high';c.drawImage(image,0,0,frame.width,frame.height);
    softenMaterialSeam(frame);
    // Preserve the dirt and turf beneath the outer brush strokes of the cartway.
    const pixels=c.getImageData(0,0,frame.width,frame.height);
    for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
      const across=(x+.5)/frame.width;
      const opacity=Math.max(0,Math.min(1,(across-.20)/.14,(.80-across)/.14));
      pixels.data[(y*frame.width+x)*4+3]*=opacity;
    }
    c.putImageData(pixels,0,0);this.cartway=frame;this.refreshLandscape();
  }
  async loadRiverMaterials(src){
    const image=await loadBattlefieldSheet(src),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    const frames={};
    for(const [i,kind] of ['channel','shoal','bank'].entries()){
      const frame=makeCanvas(256,256),ctx=frame.getContext('2d');
      const left=Math.round(w*i/3),right=Math.round(w*(i+1)/3);
      ctx.imageSmoothingQuality='high';ctx.drawImage(image,left,0,right-left,h,0,0,256,256);
      softenMaterialSeam(frame);frames[kind]=frame;
    }
    this.riverMaterials=frames;this.refreshLandscape();
    return Object.keys(frames);
  }
  async loadBattlefieldProjectiles(src){
    const image=await loadBattlefieldSheet(src),frames={};
    for(const [index,kind] of ['arrow','bolt','javelin','axe','rock','firepot'].entries()){
      const cell=atlasCell(image,index%3,Math.floor(index/3),3,2,kind);
      frames[kind]=compactAtlasFrame(cell,Math.min(1,96/Math.max(cell.width,cell.height)));
    }
    this.projectileFrames=frames;
  }
  battlefieldTile(g,t){
    const river=g.landscape?.id==='riverlands';if(!river&&g.landscape?.id!=='highlands')return null;
    const field=this.fieldTiles?.[t.y*g.W+t.x];
    let kind;
    if(t.feature==='road')kind='cartRoad';
    else if(river&&t.feature==='ford')kind='shallows';
    else if(!river&&t.feature==='pass')kind='passGravel';
    else if(t.terrain==='grass'&&!t.feature)kind=field?'cropland':river?'riverPasture':'hillPasture';
    else return null;
    const cols=4,rows=field?3:4;
    // Adjacent road tiles can have different routing axes at junctions. Use
    // world coordinates across the entire cartway to keep the brushwork joined.
    const sx=field?(t.x-2)%6:t.x%cols,sy=field?(t.y-2)%5:t.y%rows;
    const key=['painted',kind,sx,sy].join('|');
    let tile=this.terrainTileSprites.get(key);if(tile)return tile;
    tile=makeCanvas(116,66);const ctx=tile.getContext('2d'),f=this.sliceGround[kind];
    ctx.scale(2,2);ctx.translate(1,1);ctx.transform(HW,HH,-HW,HH,HW,0);
    const sw=f.width/cols,sh=f.height/rows;
    ctx.drawImage(f,sx*sw,sy*sh,sw,sh,-.014,-.014,1.028,1.028);
    this.terrainTileSprites.set(key,tile);return tile;
  }
  landsPropSprite(kind,variant=0){
    const f=this.landsFrames?.[kind];if(!f)return null;const key='lands|'+kind+'|'+variant;if(this.treeSprites.has(key))return this.treeSprites.get(key);
    const size=kind==='mountain'?[72+variant%3*8,70+variant%4*9]:kind==='woodland'?[68,72]:kind==='waymarker'?[22,34]:kind==='pass'?[60,48]:[66,42],scale=Math.min(size[0]/f.width,size[1]/f.height),w=f.width*scale,h=f.height*scale,a=makeCanvas(192,224),c=a.getContext('2d');c.scale(2,2);c.translate(48,100);if(variant%2)c.scale(-1,1);if(kind==='mountain')c.filter='saturate(.62) brightness('+(variant%3===0?.72:variant%3===1?.87:1)+')';c.drawImage(f.image,f.left,f.top,f.width,f.height,-w/2,-h+3,w,h);this.treeSprites.set(key,a);return a;
  }
  setTerrainAtlases(ground,props){
    const gw=ground.naturalWidth||ground.width,gh=ground.naturalHeight||ground.height,pw=props.naturalWidth||props.width,ph=props.naturalHeight||props.height;
    if(gw<90||gh<30||pw<90||ph<30)throw new Error('Terrain artwork needs three ground textures and three prop sprites.');
    this.groundFrames={};this.propFrames={};this.treeSprites.clear();this.terrainTileSprites.clear();this.terrainChunkCache.clear();
    ['grass','forest','hill'].forEach((kind,index)=>{const left=Math.floor(index*gw/3),right=Math.floor((index+1)*gw/3),a=makeCanvas(right-left,gh);a.getContext('2d').drawImage(ground,left,0,right-left,gh,0,0,right-left,gh);this.groundFrames[kind]=a;});
    ['pine','oak','rock'].forEach((kind,index)=>{const sx=Math.floor(index*pw/3),sw=Math.floor((index+1)*pw/3)-sx,a=makeCanvas(sw,ph),c=a.getContext('2d',{willReadFrequently:true});c.drawImage(props,sx,0,sw,ph,0,0,sw,ph);const pixels=c.getImageData(0,0,sw,ph),data=pixels.data;let left=sw,top=ph,right=-1,bottom=-1;
      for(let y=0;y<ph;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4;if(data[i+3]<18){data[i+3]=0;continue;}if(data[i+3]>45){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
      if(right<left)throw new Error('The '+kind+' terrain sprite is empty.');c.putImageData(pixels,0,0);this.propFrames[kind]={image:a,left,top,width:right-left+1,height:bottom-top+1};
    });
    const src=im=>typeof im.src==='string'&&!im.src.startsWith('data:')?im.src:'embedded PNG atlas';
    this.terrainAtlasInfo={ground:{source:src(ground),width:gw,height:gh,columns:3,classes:['grass','forest','hill']},props:{source:src(props),width:pw,height:ph,columns:3,classes:['pine','oak','rock']}};
    this.terrainReady=true;this.cachedGame=null;return this.terrainAtlasInfo;
  }
  terrainPropSprite(kind,variant=0){
    if(!this.terrainReady)return null;const key=kind+'|'+variant;if(this.treeSprites.has(key))return this.treeSprites.get(key);const f=this.propFrames[kind]||this.propFrames.pine;
    const sizes={pine:[51,74],oak:[69,64],rock:[39,24]},size=sizes[kind]||sizes.pine,scale=Math.min(size[0]/f.width,size[1]/f.height),w=f.width*scale,h=f.height*scale,a=makeCanvas(192,224),c=a.getContext('2d');
    c.scale(2,2);c.translate(48,100);if(variant%2)c.scale(-1,1);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(f.image,f.left,f.top,f.width,f.height,-w/2,-h,w,h);
    this.treeSprites.set(key,a);return a;
  }
  groundTileSprite(kind,variant=0){
    const key=kind+'|'+variant;if(this.terrainTileSprites.has(key))return this.terrainTileSprites.get(key);const a=makeCanvas(116,66),c=a.getContext('2d');c.scale(2,2);c.translate(1,1);
    if(kind==='water'){diamond(c,HW,HH,HW,HH,'#193c42');for(let k=0;k<9;k++){const x=8+hash(k,variant)*38,y=8+hash(k+8,variant)*12;line(c,x,y,x+4,y-.3,'rgba(122,169,170,.14)',.6);}}
    else{polygon(c,[[0,HH],[HW,HH*2],[HW*2,HH],[HW*2,HH+1.5],[HW,HH*2+1.5],[0,HH+1.5]],'#293c2a');
      const texture=this.groundFrames?.[kind==='mountain'?'hill':kind]||this.groundFrames?.grass;if(texture){c.save();c.transform(HW,HH,-HW,HH,HW,0);c.translate(.5,.5);c.rotate((variant%4)*Math.PI/2);if(variant>3)c.scale(-1,1);c.drawImage(texture,-.5,-.5,1,1);c.restore();
        c.globalAlpha=.07;diamond(c,HW,HH,HW,HH,variant%2?'#20341f':'#c5bd7d');c.globalAlpha=1;
      }else diamond(c,HW,HH,HW,HH,'#4d6843');
    }
    this.terrainTileSprites.set(key,a);return a;
  }
  landsTileSprite(g,t){
    if(t.feature==='bridge'){
      const feature=bridgeSurface(g,t);
      if(feature!=='bridge')return this.landsTileSprite(g,{...t,feature,terrain:feature==='ford'?'water':'grass'});
      if(this.bridgeArtwork?.spanReady)return this.landsTileSprite(g,{...t,terrain:'water',feature:null,featureAxis:null});
    }
    const painted=this.sliceGround&&this.battlefieldTile(g,t);if(painted)return painted;
    const neighbors=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>t.x+dx>=0&&t.y+dy>=0&&t.x+dx<g.W&&t.y+dy<g.H?g.tiles[(t.y+dy)*g.W+t.x+dx]:null);
    const wet=t.terrain==='water',banks=neighbors.reduce((m,n,i)=>m|((!!n&&n.terrain!=='water')?1<<i:0),0),links=neighbors.reduce((m,n,i)=>m|((!!n&&['road','bridge','ford','pass'].includes(n.feature))?1<<i:0),0),bridgeLinks=neighbors.reduce((m,n,i)=>m|(n?.feature==='bridge'?1<<i:0),0),variant=Math.floor(hash(t.x,t.y)*8),key='land|'+[t.terrain,t.feature||'',t.featureAxis||'',wet?banks:0,links,bridgeLinks,variant].join('|');
    if(this.terrainTileSprites.has(key))return this.terrainTileSprites.get(key);
    const a=makeCanvas(116,66),c=a.getContext('2d');c.drawImage(this.groundTileSprite(t.terrain,variant),0,0);c.scale(2,2);c.translate(1,1);
    const ground=this.landsGroundFrames?.[t.terrain];if(ground){c.save();c.transform(HW,HH,-HW,HH,HW,0);c.drawImage(ground,0,0,1,1);c.restore();}
    if(wet){
      c.save();polygon(c,[[0,HH],[HW,0],[HW*2,HH],[HW,HH*2]],null);c.clip();
      const glow=c.createLinearGradient(0,0,56,28);glow.addColorStop(0,'rgba(37,115,126,.46)');glow.addColorStop(.55,'rgba(36,95,106,.2)');glow.addColorStop(1,'rgba(9,40,54,.32)');c.fillStyle=glow;c.fillRect(0,0,56,28);
      const corners=[[HW,0],[HW*2,HH],[HW,HH*2],[0,HH]];
      for(let i=0;i<4;i++)if(banks&(1<<i)){const p=corners[i],q=corners[(i+1)%4];line(c,p[0],p[1],q[0],q[1],'#665f41',4);if(this.landsGroundFrames?.bank){c.save();polygon(c,[p,q,[q[0]*.83+HW*.17,q[1]*.83+HH*.17],[p[0]*.83+HW*.17,p[1]*.83+HH*.17]],null);c.clip();c.transform(HW,HH,-HW,HH,HW,0);c.drawImage(this.landsGroundFrames.bank,0,0,1,1);c.restore();}line(c,p[0],p[1]+.5,q[0],q[1]+.5,'#a49a66',1.3);}
      for(let i=0;i<6;i++){const x=5+hash(i,variant)*43,y=4+hash(i+10,variant)*19;line(c,x,y,x+6,y-1,'rgba(155,207,204,.24)',.6);}c.restore();
    }
    if(t.terrain==='mountain'&&t.feature!=='pass'&&!this.landsGroundFrames?.mountain){
      polygon(c,[[3,14],[19,5],[35,13],[48,10],[55,17],[28,28]],'#514f43','#4a493c');polygon(c,[[8,16],[23,2],[35,15],[24,21]],'#858372');polygon(c,[[23,2],[35,15],[24,21]],'#5e645c');polygon(c,[[15,10],[23,2],[28,9],[24,8],[21,10]],'#d6d2bd');
    }
    if(t.feature){
      const bridge=t.feature==='bridge',ford=t.feature==='ford',pass=t.feature==='pass',axis=t.featureAxis||'x';
      c.save();c.transform(HW,HH,-HW,HH,HW,0);c.lineCap='round';c.lineJoin='round';
      c.lineCap='butt';
      if(bridge){
        // The deck fills every walkable bridge tile. Only the outside corridor edges have parapets.
        c.fillStyle=variant%2?'#a49e84':'#98947c';c.fillRect(-.015,-.015,1.03,1.03);
        if(this.landsGroundFrames?.bridge)c.drawImage(this.landsGroundFrames.bridge,0,0,1,1);
        for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=col/3,y=row/3;c.fillStyle=hash(row*3+col,variant)>.5?'rgba(222,211,170,.14)':'rgba(78,76,61,.1)';c.fillRect(x+.016,y+.014,.3,.3);}
        for(let i=0;i<3;i++){const z=(i+1)/3;c.beginPath();if(axis==='y'){c.moveTo(0,z);c.lineTo(1,z);}else{c.moveTo(z,0);c.lineTo(z,1);}c.strokeStyle='rgba(70,68,53,.3)';c.lineWidth=.014;c.stroke();}
        for(const [offset,mask] of axis==='y'?[[0,8],[1,2]]:[[0,1],[1,4]])if(!(bridgeLinks&mask)){c.beginPath();if(axis==='y'){c.moveTo(offset,0);c.lineTo(offset,1);}else{c.moveTo(0,offset);c.lineTo(1,offset);}c.strokeStyle='#625e4c';c.lineWidth=.14;c.stroke();c.strokeStyle='#d4c9a2';c.lineWidth=.075;c.stroke();}
      }else if(ford){c.fillStyle='rgba(111,154,145,.65)';c.fillRect(-.01,-.01,1.02,1.02);if(this.landsGroundFrames?.ford)c.drawImage(this.landsGroundFrames.ford,0,0,1,1);for(let i=0;i<7;i++){const z=.1+(i%4)*.24,side=.22+Math.floor(i/4)*.5;c.fillStyle=i%2?'#c1bd9e':'#8b9685';c.beginPath();c.ellipse(axis==='y'?side:z,axis==='y'?z:side,.075,.055,0,0,TAU);c.fill();}}
      else{
        // Road and pass features are corridors of several complete tiles, not thin spokes per tile.
        c.fillStyle=pass?'rgba(162,150,118,.9)':'rgba(172,149,98,.72)';c.fillRect(-.01,-.01,1.02,1.02);
        const texture=this.landsGroundFrames?.[pass?'pass':'road'];if(texture)c.drawImage(texture,0,0,1,1);else if(this.groundFrames?.hill){c.globalAlpha=pass?.5:.36;c.drawImage(this.groundFrames.hill,0,0,1,1);c.globalAlpha=1;c.fillStyle=pass?'rgba(154,146,120,.15)':'rgba(153,126,75,.22)';c.fillRect(0,0,1,1);}
        const edges=[[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]];
        edges.forEach(([a,b],i)=>{if(links&(1<<i))return;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=pass?'#7c7963':'#7f8257';c.lineWidth=.045;c.stroke();});
        for(const offset of [.3,.7]){c.beginPath();if(axis==='y'){c.moveTo(offset,0);c.lineTo(offset,1);}else{c.moveTo(0,offset);c.lineTo(1,offset);}c.strokeStyle='rgba(90,78,49,.2)';c.lineWidth=.025;c.stroke();}
        for(let i=0;i<24;i++){c.fillStyle=i%2?'rgba(224,206,151,.2)':'rgba(91,85,58,.18)';c.fillRect(.04+hash(i,variant)*.9,.04+hash(i+7,variant)*.9,.02+hash(i+8,variant)*.035,.015+hash(i+11,variant)*.02);}
      }
      c.restore();
    }
    this.terrainTileSprites.set(key,a);return a;
  }
  resize(w,h,dpr=1){this.w=w;this.h=h;this.dpr=Math.min(2,dpr);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';}
  prepare(g){
    this.cachedGame=g;this.left=-g.H*HW-80;this.top=-90;this.mapW=(g.W+g.H)*HW+160;this.mapH=(g.W+g.H)*HH+210;
    this.bridgeArchitectureCache=new Map();this.bridgeArchitectureGame=g;this.bridgeArchitectureBytes=0;
    this.sceneryChunkCache=new Map();this.sceneryChunkBytes=0;this.strategicSceneryComposite=null;this.strategicSceneryView=null;this.strategicSceneryProbe=null;
    this.terrainChunkCache.clear();this.decor=[];this.decorChunks=new Map();this.miniBase=null;this.miniTerrainPixels=makeCanvas(g.W,g.H);const miniCtx=this.miniTerrainPixels.getContext('2d'),miniData=miniCtx.createImageData(g.W,g.H);
    this.fieldTiles=roadsideFields(g);
    this.bridgeArtwork?.clearSpans?.();
    this.paintedGround=preparePaintedGround(g,this);
    const highland=g.landscape?.id==='highlands',river=g.landscape?.id==='riverlands',crags=highland&&this.highlandCrags;
    if(crags)placeHighlandCrags(g,this.decor);
    for(const t of g.tiles){const r=hash(t.x,t.y),i=(t.y*g.W+t.x)*4,color=t.feature==='bridge'?[218,197,142]:t.feature==='ford'?[131,174,169]:t.feature==='road'?[180,159,108]:t.feature==='pass'?[177,168,136]:t.terrain==='mountain'?[102,105,101]:t.terrain==='water'?[35,100,116]:t.terrain==='forest'?[48,71,37]:t.terrain==='hill'?[114,105,75]:[91,115,52];miniData.data.set([...color,255],i);if(t.feature||t.terrain==='water')continue;
      if(t.terrain==='mountain'){
        if(crags)continue;
        if(t.x%2===0&&t.y%2===0||r>.96){
          const ledge=highland&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.tileAt(t.x+dx+.5,t.y+dy+.5)?.feature==='pass');
          this.decor.push({x:t.x+.5,y:t.y+.5,kind:'mountain',variant:Math.floor(r*8),scale:ledge?.54+r*.15:.8+r*.32});
        }
        continue;
      }
      if(t.terrain==='forest'){
        if(r>.17){
          // Group oak and pine by grove. The forest floor still shows the
          // exact cover boundary, including the gaps between painted crowns.
          const grove=hash(Math.floor(t.x/4),Math.floor(t.y/4)),oak=river?grove>.28:grove>.86;
          const variant=river||highland?(oak?(r>.6?3:0):r>.6?1:2):Math.floor(r*6);
          this.decor.push({x:t.x+.23+hash(t.x*2,t.y)*.5,y:t.y+.15+hash(t.x,t.y*3)*.65,kind:this.landsArtReady&&r>.82?'woodland':'tree',variant,scale:.72+hash(t.x*3,t.y)*.35});
        }
      }else if(t.terrain==='hill'){
        if(r>(crags ? .87 : .58))this.decor.push({x:t.x+.2,y:t.y+.15,kind:'rock',variant:Math.floor(r*3),scale:.48+r*.45});
      }else if(r>.94&&!onPaintedApproach(this.paintedGround,t.x+.05,t.y+.08)){this.decor.push({x:t.x+.05,y:t.y+.08,kind:'bush',variant:0,scale:.6+r*.2});}
    }
    if(this.sliceDetails&&(river||highland))this.addPaintedScenery(g,river);
    if(this.bridgeArtwork?.spanReady)this.decor=this.bridgeArtwork.clearDecor(g,this.decor);
    for(const mark of g.landmarks||[]){if(mark.kind==='pass'||mark.kind==='road')this.decor.push({x:mark.x+.48,y:mark.y-.48,kind:mark.kind==='pass'?'pass':'waymarker',variant:0,scale:.7});}
    miniCtx.putImageData(miniData,0,0);this.miniFeaturePixels=makeCanvas(g.W,g.H);const fc=this.miniFeaturePixels.getContext('2d'),fd=fc.createImageData(g.W,g.H);for(const t of g.tiles)if(t.feature){const i=(t.y*g.W+t.x)*4;fd.data.set(miniData.data.subarray(i,i+4),i);}fc.putImageData(fd,0,0);this.ownerPixels=makeCanvas(g.W,g.H);this.ownerImageData=this.ownerPixels.getContext('2d').createImageData(g.W,g.H);this.clearBuildingSites(g);this.territoryTime=-1;this.buildOverview(g);this.updateTerritory(g);
    // Prime the opening artwork while the map is preparing, so the first jump
    // to a distant capital does not pay for faction-tint pixel readbacks.
    for(const team of g.teams){for(const type of ['infantry','archer','cavalry','siege','hero'])this.soldierSprite(type,team.color,team.dark,1,0,false);for(const type of ['keep','barracks','range'])this.structureSprite(type,team.color,team.sigil);const house=g.houseContent?.(team.id);if(house){this.soldierSprite(house.unit,team.color,team.dark,1,0,false,team.sigil);this.structureSprite(house.building,team.color,team.sigil);}}
  }
  fogScene(g){
    if(!g.config?.fogOfWar)return {buildings:g.buildings,units:g.units,castles:g.castles||[],objectives:g.objectives||[]};
    return {buildings:g.knownBuildings((g.playerTeam??0)),units:g.knownUnits((g.playerTeam??0)),castles:g.knownCastleSites((g.playerTeam??0)),objectives:(g.objectives||[]).map(o=>g.isVisibleTo((g.playerTeam??0),o)?o:{...o,progress:[],controller:null,contested:false,cooldownUntil:0})};
  }
  fogPixels(g){
    if(!g.config?.fogOfWar||!g.vision)return null;
    if(this.fogGame===g&&this.fogRevision===g.vision.revision)return this.fogImage;
    if(this.fogGame!==g){this.fogImage=makeCanvas(g.W,g.H);this.fogGame=g;}
    const c=this.fogImage.getContext('2d'),pixels=c.createImageData(g.W,g.H),visible=g.vision.gridFor((g.playerTeam??0)),explored=g.vision.exploredFor((g.playerTeam??0));
    for(let i=0;i<g.W*g.H;i++){const p=i*4;pixels.data[p]=23;pixels.data[p+1]=35;pixels.data[p+2]=43;pixels.data[p+3]=visible[i]?0:explored[i]?72:119;}
    c.putImageData(pixels,0,0);this.fogRevision=g.vision.revision;return this.fogImage;
  }
  drawFog(c,g){const fog=this.fogPixels(g);if(!fog)return;c.save();c.imageSmoothingEnabled=false;c.transform(HW,HH,-HW,HH,0,0);c.drawImage(fog,0,0);c.restore();}
  rememberedBuilding(c,b,g){
    c.save();c.globalAlpha=.53;c.filter='saturate(.2)';this.building(c,{...b,hit:0},g);c.restore();
    const p=iso(b.x,b.y);c.save();c.textAlign='center';c.font='bold 8px Segoe UI';c.strokeStyle='#132c30';c.lineWidth=3;c.strokeText('LAST SEEN',p.x,p.y+50);c.fillStyle='#bac8c2';c.fillText('LAST SEEN',p.x,p.y+50);c.restore();
  }
  clearBuildingSites(g){
    const scene=this.fogScene(g);
    this.decor=this.decor.filter(z=>!scene.buildings.some(b=>b.hp>0&&(z.x-b.x)**2+(z.y-b.y)**2<(b.type==='keep'?5:1.25))&&!(g.objectives||[]).some(o=>(z.x-o.x)**2+(z.y-o.y)**2<1.7)&&!scene.castles.some(o=>(z.x-o.x)**2+(z.y-o.y)**2<5));
    this.lastBuildingCount=g.buildings.length;this.lastBuildingId=g.buildings.at(-1)?.id||0;
    this.decorChunks=new Map();for(const z of this.decor){const key=Math.floor(z.x/16)+','+Math.floor(z.y/16);if(!this.decorChunks.has(key))this.decorChunks.set(key,[]);this.decorChunks.get(key).push(z);}
    this.sceneryChunkCache?.clear();this.sceneryChunkBytes=0;this.strategicSceneryComposite=null;this.strategicSceneryView=null;this.strategicSceneryProbe=null;
    this.decorOverviewDirty=true;
  }
  buildOverview(g){
    this.overviewScale=Math.min(.32,2048/this.mapW);const s=this.overviewScale,w=Math.ceil(this.mapW*s),h=Math.ceil(this.mapH*s);this.terrainOverview=makeCanvas(w,h);this.decorOverview=makeCanvas(w,h);const c=this.terrainOverview.getContext('2d');c.scale(s,s);c.translate(-this.left,-this.top);
    if(this.paintedGround){
      for(let y=0;y<g.H;y+=24)for(let x=0;x<g.W;x+=24)this.paintGroundRegion(c,g,{x0:x,y0:y,x1:Math.min(g.W,x+24),y1:Math.min(g.H,y+24)},true);
    }else this.paintGroundRegion(c,g,{x0:0,y0:0,x1:g.W,y1:g.H},true);
    this.rebuildDecorOverview();
    // Resolve the offscreen snapshots during preparation, rather than making
    // the first overview-camera jump perform a large deferred raster upload.
    const primer=makeCanvas(2,2),pc=primer.getContext('2d');pc.drawImage(this.terrainOverview,0,0,2,2);pc.drawImage(this.decorOverview,0,0,2,2);
  }
  rebuildDecorOverview(){const d=this.decorOverview.getContext('2d'),s=this.overviewScale;d.setTransform(1,0,0,1,0,0);d.clearRect(0,0,this.decorOverview.width,this.decorOverview.height);d.scale(s,s);d.translate(-this.left,-this.top);for(const z of [...this.decor].sort((a,b)=>a.x+a.y-b.x-b.y)){const p=iso(z.x,z.y),a=this.treeSprite(z.kind,z.variant),scale=z.scale*(z.kind==='bush'?.38:1);if(a)d.drawImage(a,p.x-48*scale,p.y-100*scale,96*scale,112*scale);}this.decorOverviewDirty=false;}
  paintGroundRegion(c,g,range,overview,density=1){
    const painted=this.paintedGround;
    if(painted)bakePaintedGround(c,painted,range,overview,density);
    for(let y=range.y0;y<range.y1;y++)for(let x=range.x0;x<range.x1;x++){
      const t=g.tiles[y*g.W+x];
      if(painted&&(t.feature!=='bridge'||this.bridgeArtwork?.spanReady||bridgeSurface(g,t)!=='bridge'))continue;
      const p=iso(x+.5,y+.5),tile=this.landsTileSprite(g,t);
      c.drawImage(tile,p.x-HW-1,p.y-HH-1,58,33);
    }
    if(!painted)paintTerrainPolish(c,g,range,overview?{detail:'overview'}:{});
  }
  terrainChunk(g,cx,cy,density=1){
    const key=cx+','+cy+'@'+density;let ch=this.terrainChunkCache.get(key);if(ch){this.terrainChunkCache.delete(key);this.terrainChunkCache.set(key,ch);return ch;}
    const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16),left=(x0-y1)*HW-2,top=(x0+y0)*HH-2,w=(x1-x0+y1-y0)*HW+4,h=(x1-x0+y1-y0)*HH+7;
    const a=makeCanvas(Math.ceil(w*density),Math.ceil(h*density)),c=a.getContext('2d');
    c.scale(a.width/w,a.height/h);c.translate(-left,-top);
    this.paintGroundRegion(c,g,{x0,y0,x1,y1},false,density);
    ch={image:a,left,top,width:w,height:h};this.terrainChunkCache.set(key,ch);while(this.terrainChunkCache.size>this.maxTerrainChunks)this.terrainChunkCache.delete(this.terrainChunkCache.keys().next().value);return ch;
  }
  visibleWorldRange(g,bounds){const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]].map(([x,y])=>({x:(x/HW+y/HH)/2,y:(y/HH-x/HW)/2}));return{x0:clamp(Math.floor(Math.min(...points.map(p=>p.x)))-1,0,g.W-1),x1:clamp(Math.ceil(Math.max(...points.map(p=>p.x)))+1,0,g.W-1),y0:clamp(Math.floor(Math.min(...points.map(p=>p.y)))-1,0,g.H-1),y1:clamp(Math.ceil(Math.max(...points.map(p=>p.y)))+1,0,g.H-1)};}
  drawStrategicScenery(c,range,bounds){
    // Static scenery can be reused at the exact device-pixel transform once
    // the camera settles. This retains the original samples, scale and detail;
    // moving cameras still draw the existing native chunks directly. Accelerated
    // backends that already draw these chunks cheaply keep that original path.
    const transform=c.getTransform?.(),width=this.canvas.width,height=this.canvas.height;
    if(!transform||!Number.isFinite(transform.a)||width*height*4>32*1024*1024){this.paintStrategicScenery(c,range,bounds);return;}
    const key=[width,height,transform.a,transform.b,transform.c,transform.d,transform.e,transform.f,c.imageSmoothingEnabled,c.imageSmoothingQuality].join('|'),cached=this.strategicSceneryComposite;
    if(cached?.key===key){c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(cached.image,0,0);c.restore();return;}
    if(this.strategicSceneryView!==key){this.strategicSceneryView=key;this.strategicSceneryComposite=null;this.strategicSceneryProbe={expensive:0};this.paintStrategicScenery(c,range,bounds);return;}
    const probe=this.strategicSceneryProbe??={expensive:0};
    if(probe.expensive<3){const at=performance.now();this.paintStrategicScenery(c,range,bounds);probe.expensive=performance.now()-at>=(this.strategicSceneryCacheThresholdMs??4)?probe.expensive+1:0;return;}
    const image=makeCanvas(width,height),ctx=image.getContext('2d');ctx.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e,transform.f);ctx.imageSmoothingEnabled=c.imageSmoothingEnabled;ctx.imageSmoothingQuality=c.imageSmoothingQuality;this.paintStrategicScenery(ctx,range,bounds);
    this.strategicSceneryComposite={key,image,bytes:width*height*4};c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(image,0,0);c.restore();
  }
  paintStrategicScenery(c,range,bounds){
    // Strategic views keep the same illustrated trees and rocks, but composite
    // their static chunks once. Armies remain a live layer above the scenery.
    for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++){
      const x0=cx*16,y0=cy*16,x1=x0+16,y1=y0+16;if((x1-y0)*HW+60<bounds.left||(x0-y1)*HW-60>bounds.right||(x1+y1)*HH+20<bounds.top||(x0+y0)*HH-110>bounds.bottom)continue;
      const key=cx+','+cy;let chunk=this.sceneryChunkCache.get(key);
      if(chunk===undefined){
        const decor=this.decorChunks.get(key);if(!decor?.length){this.sceneryChunkCache.set(key,null);continue;}
        let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;const items=[];
        for(const z of decor){const p=iso(z.x,z.y),sprite=this.treeSprite(z.kind,z.variant),s=z.scale*(z.kind==='bush'?.38:1);if(!sprite)continue;const x=p.x-48*s,y=p.y-100*s,w=96*s,h=112*s;items.push({sprite,x,y,w,h,depth:p.y});left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+w);bottom=Math.max(bottom,y+h);}
        if(!items.length){this.sceneryChunkCache.set(key,null);continue;}
        left=Math.floor(left);top=Math.floor(top);const width=Math.ceil(right)-left,height=Math.ceil(bottom)-top,image=makeCanvas(width,height),ctx=image.getContext('2d');ctx.translate(-left,-top);
        items.sort((a,b)=>a.depth-b.depth);for(const item of items)ctx.drawImage(item.sprite,item.x,item.y,item.w,item.h);
        chunk={image,left,top,width,height,bytes:width*height*4};this.sceneryChunkCache.set(key,chunk);this.sceneryChunkBytes+=chunk.bytes;
        while(this.sceneryChunkBytes>64*1024*1024&&this.sceneryChunkCache.size>1){const oldest=this.sceneryChunkCache.keys().next().value,entry=this.sceneryChunkCache.get(oldest);this.sceneryChunkBytes-=entry?.bytes||0;this.sceneryChunkCache.delete(oldest);}
      }else if(chunk){this.sceneryChunkCache.delete(key);this.sceneryChunkCache.set(key,chunk);}
      if(chunk)c.drawImage(chunk.image,chunk.left,chunk.top,chunk.width,chunk.height);
    }
  }
  drawGround(c,g,v,bounds,range,layerScenery=v.zoom>=.75){
    // At close zoom, sample the original material at a higher density. A full
    // set of 24 detailed chunks stays below 85 MiB of RGBA pixel storage.
    const density=this.paintedGround&&!this.lowDetail&&v.zoom*this.dpr>=1.4?1.5:1;
    if(v.zoom<.75)c.drawImage(this.terrainOverview,this.left,this.top,this.mapW,this.mapH);
    else for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++){
      const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16),left=(x0-y1)*HW,right=(x1-y0)*HW,top=(x0+y0)*HH,bottom=(x1+y1)*HH+6;if(right<bounds.left||left>bounds.right||bottom<bounds.top||top>bounds.bottom)continue;const ch=this.terrainChunk(g,cx,cy,density);c.drawImage(ch.image,ch.left,ch.top,ch.width,ch.height);
    }
    if(!this.paintedGround&&v.zoom>.48&&!this.lowDetail)for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const t=g.tiles[y*g.W+x];if(t.terrain!=='water'||t.feature||hash(x,y)<.55)continue;const p=iso(x+.5,y+.5),drift=Math.sin(g.time*.7+x+y)*3;c.globalAlpha=.12+Math.sin(g.time*.8+x*.4+y*.7)*.06;line(c,p.x-5+drift,p.y,p.x+6+drift,p.y-.7,'#c5e6d9',.8);c.globalAlpha=1;}
    c.save();c.globalAlpha=.16;c.imageSmoothingEnabled=false;c.transform(HW,HH,-HW,HH,0,0);c.drawImage(this.ownerPixels,0,0);c.restore();
    const width=v.zoom<.45?1.2/v.zoom:1.35;for(const e of this.territoryEdges){if(Math.max(e.x1,e.x2)<bounds.left||Math.min(e.x1,e.x2)>bounds.right||Math.max(e.y1,e.y2)<bounds.top||Math.min(e.y1,e.y2)>bounds.bottom)continue;line(c,e.x1,e.y1,e.x2,e.y2,e.color,width);}
    if(!layerScenery){
      if(v.zoom<.42||v.w/v.zoom>4500||v.h/v.zoom>2800){
        if(this.decorOverviewDirty)this.rebuildDecorOverview();
        c.drawImage(this.decorOverview,this.left,this.top,this.mapW,this.mapH);
      }else this.drawStrategicScenery(c,range,bounds);
    }
    if(this.bridgeArtwork?.spanReady)this.bridgeArtwork.drawSpans(c,g,range);
    else if(this.bridgeArtwork?.ready){this.drawBridgeArchitecture(c,g,range,'back');this.drawBridgeArchitecture(c,g,range,'front');}
    else this.drawBridgeArchitecture(c,g,range);
  }
  drawBridgeArchitecture(c,g,range,layer='all'){
    // Bridge masonry is static. Rasterize each occupied chunk once instead of
    // scanning every visible tile and rebuilding hundreds of paths every frame.
    if(!this.bridgeArchitectureCache||this.bridgeArchitectureGame!==g){this.bridgeArchitectureCache=new Map();this.bridgeArchitectureGame=g;this.bridgeArchitectureBytes=0;}
    for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++){
      const key=layer+':'+cx+','+cy;let chunk=this.bridgeArchitectureCache.get(key);
      if(chunk===undefined){
        const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16);let occupied=false,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(g.tiles[y*g.W+x].feature==='bridge'){const p=iso(x+.5,y+.5);occupied=true;left=Math.min(left,p.x-HW);right=Math.max(right,p.x+HW);top=Math.min(top,p.y-HH);bottom=Math.max(bottom,p.y+HH);}
        if(!occupied){this.bridgeArchitectureCache.set(key,null);continue;}
        left-=20;top-=32;const width=right-left+20,height=bottom-top+32;
        const image=makeCanvas(width*2,height*2),ctx=image.getContext('2d');ctx.scale(2,2);ctx.translate(-left,-top);
        this.paintBridgeArchitecture(ctx,g,{x0,y0,x1:x1-1,y1:y1-1},layer);
        chunk={image,left,top,width,height,bytes:image.width*image.height*4};this.bridgeArchitectureCache.set(key,chunk);this.bridgeArchitectureBytes+=chunk.bytes;
        while(this.bridgeArchitectureBytes>32*1024*1024&&this.bridgeArchitectureCache.size>1){const oldest=this.bridgeArchitectureCache.keys().next().value,entry=this.bridgeArchitectureCache.get(oldest);this.bridgeArchitectureBytes-=entry?.bytes||0;this.bridgeArchitectureCache.delete(oldest);}
      }
      else if(chunk){this.bridgeArchitectureCache.delete(key);this.bridgeArchitectureCache.set(key,chunk);}
      if(chunk)c.drawImage(chunk.image,chunk.left,chunk.top,chunk.width,chunk.height);
    }
  }
  paintBridgeArchitecture(c,g,range,layer='all'){
    if(this.bridgeArtwork?.ready){
      if(layer==='front'){
        // Repaint only the opaque deck over the back-wall layer. Drawing the
        // entire terrain again would erase its coping as well; a tight tile
        // clip occludes far arches below the walking plane without hiding rail.
        for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){
          const t=g.tiles[y*g.W+x];if(t.feature!=='bridge')continue;const p=iso(x+.5,y+.5);
          c.save();diamond(c,p.x,p.y,HW,HH,null);c.clip();c.drawImage(this.landsTileSprite(g,t),p.x-HW-1,p.y-HH-1,58,33);c.restore();
        }
      }
      this.bridgeArtwork.paint(c,g,range,{layer});return;
    }
    // Sidewalls extend down outside the deck. The walking surface stays on the same plane as troop feet.
    const bridgeAt=(x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H&&g.tiles[y*g.W+x].feature==='bridge';
    for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){
      const t=g.tiles[y*g.W+x];if(t.feature!=='bridge')continue;
      const axis=t.featureAxis||'x',edges=axis==='x'?[[!bridgeAt(x,y-1),[x,y],[x+1,y],false],[!bridgeAt(x,y+1),[x,y+1],[x+1,y+1],true]]:[[!bridgeAt(x-1,y),[x,y],[x,y+1],true],[!bridgeAt(x+1,y),[x+1,y],[x+1,y+1],false]];
      for(const [visible,wa,wb,front]of edges){
        if(!visible)continue;const a=iso(...wa),b=iso(...wb),dx=b.x-a.x,dy=b.y-a.y,depth=front?10:6;
        polygon(c,[[a.x,a.y+3],[b.x,b.y+3],[b.x+3,b.y+depth+5],[a.x+3,a.y+depth+5]],'rgba(9,24,27,.26)');
        polygon(c,[[a.x,a.y],[b.x,b.y],[b.x,b.y+depth],[a.x,a.y+depth]],front?'#656859':'#858474','#555c50');
        // Three stone courses and staggered joints give a continuous masonry face.
        for(let row=1;row<3;row++){const z=row*depth/3;line(c,a.x,a.y+z,b.x,b.y+z,'rgba(35,43,36,.35)',.65);}
        for(let j=1;j<4;j++){const k=j/4;line(c,a.x+dx*k,a.y+dy*k,b.x-dx*(1-k),b.y-dy*(1-k)+depth,'rgba(39,44,36,.45)',.8);}
        const mid={x:a.x+dx*.5,y:a.y+dy*.5};
        if((axis==='x'?x:y)%2===0){
          // Dark arched openings sit below the deck edge, leaving every lane unobstructed.
          c.save();c.translate(mid.x,mid.y+depth*.7);c.rotate(Math.atan2(dy,dx));c.beginPath();c.ellipse(0,0,7,depth*.42,0,Math.PI,TAU);c.lineTo(7,depth*.35);c.lineTo(-7,depth*.35);c.closePath();c.fillStyle='#284c50';c.fill();c.strokeStyle='#aaa58b';c.lineWidth=1.4;c.stroke();c.restore();
        }
        line(c,a.x,a.y-3.8,b.x,b.y-3.8,front?'#777965':'#999984',4.3);line(c,a.x,a.y-5.2,b.x,b.y-5.2,'#c3bca1',1.1);
        for(const k of [0,.5,1]){const px=a.x+dx*k,py=a.y+dy*k;line(c,px,py-5.5,px,py-1.4,'#646c5b',.8);}
        const end=axis==='x'?!bridgeAt(x-1,y)||!bridgeAt(x+1,y):!bridgeAt(x,y-1)||!bridgeAt(x,y+1);
        if(end){polygon(c,[[mid.x-4,mid.y-3],[mid.x+4,mid.y-1],[mid.x+4,mid.y+depth+3],[mid.x-4,mid.y+depth+1]],'#7a7d69','#545f50');line(c,mid.x-4,mid.y-3,mid.x+4,mid.y-1,'#c1b797',1.2);}
      }
    }
  }
  updateTerritory(g){
    const data=this.ownerImageData.data,owners=g.config?.fogOfWar?g.vision.ownersFor((g.playerTeam??0)):null,palette=g.teams.map(t=>t.color).join('|');
    let changed=this.territorySource!==g||this.territoryPixelData!==data||this.territoryPalette!==palette;
    if(this.territorySource!==g||this.territoryOwners?.length!==g.tiles.length){this.territoryOwners=new Int16Array(g.tiles.length);this.territoryPassable=new Uint8Array(g.tiles.length);changed=true;}
    const snapshot=this.territoryOwners,passable=this.territoryPassable;
    // A scheduled refresh still checks the current ownership (including fog
    // memory), but unchanged ground keeps its pixels, edges and minimap bake.
    for(let index=0;index<g.tiles.length;index++){
      const t=g.tiles[index],owner=owners?owners[index]:t.owner,clear=owner>=0&&g.teams[owner]&&g.isWalkable(t.x+.5,t.y+.5)?1:0;
      if(snapshot[index]!==owner||passable[index]!==clear){snapshot[index]=owner;passable[index]=clear;changed=true;}
    }
    this.territoryTime=g.time;if(!changed)return;
    this.territorySource=g;this.territoryPixelData=data;this.territoryPalette=palette;data.fill(0);this.territoryEdges=[];
    const colors=g.teams.map(t=>[parseInt(t.color.slice(1,3),16),parseInt(t.color.slice(3,5),16),parseInt(t.color.slice(5,7),16)]),W=g.W,H=g.H,edges=this.territoryEdges;
    for(let index=0;index<g.tiles.length;index++){
      if(!passable[index])continue;const t=g.tiles[index],owner=snapshot[index],color=g.teams[owner].color,rgb=colors[owner],i=index*4,px=(t.x-t.y)*HW,py=(t.x+t.y+1)*HH;
      data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
      // Emit the four exposed sides directly, avoiding temporary corner and
      // neighbor arrays for every owned tile on large maps.
      if((t.y>0?snapshot[index-W]:-1)!==owner)edges.push({x1:px,y1:py-HH,x2:px+HW,y2:py,color});
      if((t.x<W-1?snapshot[index+1]:-1)!==owner)edges.push({x1:px+HW,y1:py,x2:px,y2:py+HH,color});
      if((t.y<H-1?snapshot[index+W]:-1)!==owner)edges.push({x1:px,y1:py+HH,x2:px-HW,y2:py,color});
      if((t.x>0?snapshot[index-1]:-1)!==owner)edges.push({x1:px-HW,y1:py,x2:px,y2:py-HH,color});
    }
    this.ownerPixels.getContext('2d').putImageData(this.ownerImageData,0,0);this.minimapRevision=(this.minimapRevision||0)+1;
  }
  addPaintedScenery(g,river){
    for(const t of g.tiles){
      const chance=hash(t.x,t.y+503),field=this.fieldTiles?.[t.y*g.W+t.x];
      let kind,x=t.x+.5,y=t.y+.5;
      if(t.feature==='ford'&&river&&chance>.78)kind='fordStones';
      else if(field&1){kind='wattle';y=t.y+.06;}
      else if(t.feature||t.terrain==='water'||t.terrain==='mountain'||chance<.63)continue;
      else if(t.terrain==='hill'&&!river&&(!this.highlandCrags||chance>.80))kind='heather';
      else{
        for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
          const n=g.tileAt(x+dx,y+dy);if(!n||n.feature)continue;
          if(n.terrain==='water'&&river)kind='reeds';
          else if(n.terrain==='grass'&&t.terrain==='forest')kind='forestShrubs';
          if(kind){x+=dx*.4;y+=dy*.4;break;}
        }
      }
      if(kind)this.decor.push({x,y,kind,variant:0,scale:kind==='wattle'?1:.8+chance*.25,
        detailOnly:kind!=='wattle'&&hash(t.x+86,t.y)>.36});
    }
  }
  treeSprite(kind,variant=0){
    if(kind==='crag')return this.highlandCrags[variant];
    const detail=this.sliceDetails?.[kind];
    if(detail){
      const key='slice|'+kind;if(this.treeSprites.has(key))return this.treeSprites.get(key);
      const width={reeds:23,wattle:30,fordStones:18,heather:26,forestShrubs:34}[kind]||25;
      const height=width*detail.height/detail.width,sprite=makeCanvas(192,224),ctx=sprite.getContext('2d');
      ctx.scale(2,2);ctx.drawImage(detail,48-width/2,100-height*.84,width,height);
      this.treeSprites.set(key,sprite);return sprite;
    }
    if(['mountain','woodland','stoneBridge','woodBridge','pass','ford','waymarker','ruin'].includes(kind))return this.landsPropSprite(kind,variant);
    return this.terrainPropSprite(kind==='rock'?'rock':kind==='bush'?'oak':variant%3===0?'oak':'pine',variant);
  }
  soldierSprite(type,color,dark,dir,frame,attack=false,specialHouse=null){
    const painted=this.getPaintedTroop(type,specialHouse);
    if(painted){
      const index=attack?[painted.actions.aim??painted.actions.lower??painted.actions.ready,painted.actions.fire??painted.actions.thrust??painted.actions.ready,painted.actions.recovery??painted.actions.ready,painted.actions.ready][clamp(Math.floor(frame),0,3)]:painted.actions.walk[clamp(Math.floor(frame),0,3)];
      // Legacy callers (portraits) keep their existing 128x144 convention.
      const a=makeCanvas(128,144),c=a.getContext('2d');c.scale(2,2);c.translate(32,64);this.drawPaintedTroop(c,painted,index,dir,0,0);return a;
    }
    if(!this.rasterSpritesReady&&!this.houseArtReady&&!this.regimentArtReady&&!this.conquestArtReady&&!this.reinforcementArtReady)return null;
    const row=this.getTroopFrame(type,specialHouse)||((REGIMENT_ART_TYPES.includes(type)||CONQUEST_ART_HOUSES[type]||REINFORCEMENT_HOUSES[type])?null:this.troopFrames[HOUSE_UNIT_CLASSES[specialHouse]]||this.troopFrames.infantry);if(!row)return null;const index=(attack?4:0)+clamp(Math.floor(frame),0,3);
    const key=[type,row.house?'house:'+row.house:color,dir,index].join('|');if(this.sprites.has(key))return this.sprites.get(key);
    const f=row.frames[index],a=makeCanvas(128,144),c=a.getContext('2d',{willReadFrequently:true});
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.save();c.scale(2,2);c.translate(32,64);c.scale(dir,1);
    const w=f.width*row.scale,h=f.height*row.scale;
    c.drawImage(f.image,f.left,f.top,f.width,f.height,-w/2,-h,w,h);c.restore();
    if(row.house){this.sprites.set(key,a);return a;}
    const pixels=c.getImageData(0,0,128,144),data=pixels.data;
    const target=/^#[0-9a-f]{6}$/i.test(color)?[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]:[125,180,220];
    // Recolor blue cloth only. Steel highlights, skin, weapons and wood retain
    // their source artwork; luminance preserves cloth folds and cast shadows.
    for(let i=0;i<data.length;i+=4){if(data[i+3]<16)continue;const r=data[i],g=data[i+1],b=data[i+2],blue=b-Math.max(r,g);
      if(blue>9&&b>r*1.1&&b>g*1.04){const shade=clamp(b/148,.14,1.18),mix=clamp(blue/38,.3,1);data[i]=r*(1-mix)+Math.min(255,target[0]*shade)*mix;data[i+1]=g*(1-mix)+Math.min(255,target[1]*shade)*mix;data[i+2]=b*(1-mix)+Math.min(255,target[2]*shade)*mix;}
    }
    c.putImageData(pixels,0,0);this.sprites.set(key,a);return a;
  }
  drawTroopPortrait(canvas,type,house){
    if(type==='dragon'){
      if(!this.dragonIcon)return;
      const c=canvas.getContext('2d'),im=this.dragonIcon;
      const scale=Math.min(canvas.width/im.width,canvas.height/im.height),w=im.width*scale,h=im.height*scale;
      c.clearRect(0,0,canvas.width,canvas.height);
      c.drawImage(im,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      return;
    }
    const painted=this.getPaintedTroop(type,house.sigil);
    if(painted){const c=canvas.getContext('2d'),f=painted.frames[painted.actions.ready],scale=Math.min((canvas.height-8)/painted.bodyHeight,(canvas.width-8)/(Math.min(painted.width,painted.bodyHeight*1.2)));c.clearRect(0,0,canvas.width,canvas.height);c.save();c.translate(canvas.width/2,canvas.height-4);c.scale(scale,scale);this.drawPaintedTroop(c,painted,painted.actions.ready,1,0,0);c.restore();return;}
    const row=this.getTroopFrame(type,house.sigil);if(!row)return;
    const sprite=this.soldierSprite(type,house.color,house.dark,1,0,false,house.sigil);if(!sprite)return;
    const c=canvas.getContext('2d'),scale=Math.min((canvas.width-8)/(row.width*2),(canvas.height-8)/(row.height*2)),w=row.width*2*scale,h=row.height*2*scale;
    c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(sprite,64-row.width,128-row.height*2,row.width*2,row.height*2,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  }
  flag(c,x,y,color,time,scale=1){
    if(this.campaignArtReady){const f=this.campaignFrames.flag[1];c.save();c.translate(x,y);c.scale(scale,scale);c.transform(1,0,Math.sin(time*3+x*.1)*.025,1,0,0);c.drawImage(this.campaignSprite(f,color),-f.drawWidth*f.anchorX,-f.drawHeight,f.drawWidth,f.drawHeight);c.restore();return;}
    c.save();c.translate(x,y);c.scale(scale,scale);
    ellipse(c,0,1,5.2,2.3,'rgba(8,20,22,.25)');
    polygon(c,[[-3,0],[0,2],[3,0],[3,-2],[0,-4],[-3,-2]],'#8c9485','#414e49');
    line(c,0,-2,0,-39,'#4c453b',2.6);line(c,-.6,-2,-.6,-39,'#d6c9a3',.8);
    polygon(c,[[0,-43],[-2,-39],[0,-37],[2,-39]],'#efcf80','#897349');
    const wave=Math.sin(time*4+x*.1)*2,fold=Math.sin(time*4+x*.1+1.5)*1.2;
    c.beginPath();c.moveTo(1,-37);c.bezierCurveTo(7,-40+fold,12,-34+wave,22,-36+wave);c.lineTo(18,-28+wave);c.lineTo(22,-21+wave);c.bezierCurveTo(12,-19+wave,7,-26+fold,1,-23);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#e6d69c';c.lineWidth=.65;c.stroke();
    polygon(c,[[1,-37],[6,-37+fold],[6,-23+fold],[1,-23]],'rgba(255,255,255,.16)');
    line(c,10,-36+fold,10,-23+wave,'rgba(7,23,28,.28)',1.2);
    polygon(c,[[11,-32+wave],[14,-29+wave],[11,-26+wave],[8,-29+wave]],'#fff2bc');
    line(c,2,-36,7,-36+fold,'rgba(255,255,255,.6)',.7);c.restore();
  }
  townHallWalls(c,level,color,time,front=false){
    if(level<2)return;
    const width=level===3?66:52,depth=level===3?25:20,height=level===3?22:15;
    if(!front){
      ellipse(c,0,7,width+13,depth+10,'rgba(7,18,22,.28)');
      polygon(c,[[-width,0],[0,-depth],[width,0],[0,depth]],'#777b68','#aaa58b');
      for(const side of [-1,1]){const x=side*width*.68,y=-depth*.48;this.tower(c,x,y,level===3?11:8,level===3?59:43,color,time,level===3);this.flag(c,x,y-(level===3?76:47),color,time+x,.44);}
      polygon(c,[[-width,0],[0,-depth],[width,0],[width,-height],[0,-depth-height],[-width,-height]],'#747b70','#abb09b');
      return;
    }
    const wall=(a,b)=>{polygon(c,[[a[0],a[1]],[b[0],b[1]],[b[0],b[1]-height],[a[0],a[1]-height]],a[0]<0?'#7c8576':'#505d58','#afb19a');for(let i=0;i<8;i++){const f=i/7,x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;polygon(c,[[x-2.5,y-height],[x+2.5,y-height+1],[x+2.5,y-height-5],[x-2.5,y-height-6]],'#a6aa91','#6b7567');}for(let j=5;j<height;j+=6)line(c,a[0],a[1]-j,b[0],b[1]-j,'rgba(25,40,36,.32)',.8);};
    wall([-width,0],[0,depth]);wall([0,depth],[width,0]);
    for(const side of[-1,1]){const x=side*width;this.tower(c,x,0,level===3?11:8,height+13,color,time,false);this.flag(c,x,-height-16,color,time+x,.4);}
    polygon(c,[[-8,depth-1],[8,depth-5],[8,depth-height+2],[2,depth-height-4],[-8,depth-height+1]],'#243b39','#c2b794');
    for(let x=-5;x<8;x+=3)line(c,x,depth-2-x*.25,x,depth-height+2-x*.25,'#9b8b66',.8);
    polygon(c,[[-10,depth],[1,depth+6],[11,depth+3],[0,depth-2]],'#aa9b76');
    if(level===3){this.flag(c,-width,-height-17,'#e2c878',time,.26);this.flag(c,width,-height-17,'#e2c878',time+2,.26);}
  }
  castleRuin(c,site,g,zoom){
    if(!this.conquestArtReady)return;const p=iso(site.x,site.y),f=this.castleStateFrames[site.captures>0?2:0];
    c.save();c.translate(p.x,p.y);c.drawImage(f.image,f.left,f.top,f.width,f.height,-f.drawWidth/2,8-f.drawHeight,f.drawWidth,f.drawHeight);
    if(zoom>.36){const progress=site.progress||[],leader=site.controller??progress.reduce((best,value,i)=>value>(progress[best]||0)?i:best,0),team=g.teams.find(t=>t.alliance===leader),amount=clamp((progress[leader]||0)/(site.required||60),0,1),color=site.contested?'#efab7c':amount>0?team?.teamColor||team?.color||'#e5cb89':'#e5cb89';
      c.fillStyle='rgba(9,28,29,.92)';c.fillRect(-57,13,114,27);c.strokeStyle=color;c.lineWidth=1;c.strokeRect(-57,13,114,27);c.font='bold 8px Segoe UI';c.textAlign='center';c.fillStyle='#ead9b3';c.fillText(site.contested?'CONTESTED':amount>0?'CAPTURING '+Math.floor((progress[leader]||0))+' / 60s':'RUINED CASTLE · +60',0,24);c.fillStyle='#30413c';c.fillRect(-51,31,102,4);c.fillStyle=color;c.fillRect(-51,31,102*amount,4);
    }c.restore();
  }
  objectiveGround(c,o,g,zoom){
    const p=iso(o.x,o.y),team=g.teams.find(s=>s.alliance===o.controller),color=team?.teamColor||team?.color||'#e5c87f',radius=o.radius||4;
    c.save();c.translate(p.x,p.y);c.strokeStyle=o.contested?'#f1ac75':color;c.fillStyle=o.contested?'rgba(211,126,74,.08)':'rgba(228,199,124,.07)';c.lineWidth=1.5/zoom;c.setLineDash([9/zoom,6/zoom]);
    c.beginPath();c.ellipse(0,0,radius*HW*Math.SQRT2,radius*HH*Math.SQRT2,0,0,TAU);c.fill();c.stroke();c.setLineDash([]);
    for(let i=0;i<8;i++){const angle=i*TAU/8,x=Math.cos(angle)*radius*HW*Math.SQRT2,y=Math.sin(angle)*radius*HH*Math.SQRT2;ellipse(c,x,y,3,1.7,color);}
    c.restore();
  }
  objectiveFlag(c,o,g,zoom){
    const p=iso(o.x,o.y),progress=o.progress||[],leader=o.controller??progress.reduce((best,value,i)=>value>(progress[best]||0)?i:best,0),team=g.teams.find(s=>s.alliance===leader),claimed=o.controller!=null||(progress[leader]||0)>0,color=claimed?(team?.teamColor||team?.color||'#e5c87f'):'#e5c87f',remaining=Math.max(0,(o.cooldownUntil||0)-g.time),amount=clamp((progress[leader]||0)/(o.required||30),0,1);
    c.save();c.translate(p.x,p.y);ellipse(c,0,3,24,10,'rgba(7,23,24,.4)');
    if(this.campaignArtReady){const f=this.campaignFrames.flag[remaining>0?2:claimed?1:0],scale=1.7;c.save();c.transform(1,0,Math.sin(g.time*2.4+o.id)*.014,1,0,0);c.drawImage(this.campaignSprite(f,claimed?color:null),-f.drawWidth*f.anchorX*scale,5-f.drawHeight*scale,f.drawWidth*scale,f.drawHeight*scale);c.restore();}
    else{diamond(c,0,0,19,9,'#8e947f','#d4c999');diamond(c,0,-5,13,6,'#b4b49a','#e0d9b6');this.flag(c,0,-7,remaining>0?'#a3aa9c':color,g.time,1.7);}
    c.beginPath();c.ellipse(0,3,28,12,0,-Math.PI/2,-Math.PI/2+TAU*amount);c.strokeStyle=o.contested?'#edb18a':color;c.lineWidth=3;c.stroke();
    const scale=clamp(1/zoom,.75,2.3);c.translate(0,27);c.scale(scale,scale);c.textAlign='center';c.font='bold 10px Segoe UI';
    const title=o.name||'Banner beacon',status=remaining>0?`Rearming · ${Math.ceil(remaining)}s`:o.contested?`Contested · ${Math.floor(progress[leader]||0)}s saved`:`${Math.floor(progress[leader]||0)} / ${o.required||30}s · ${o.controller==null?'Secure 90%':team?.teamName||team?.name||'Holding'}`;
    const width=Math.max(c.measureText(title).width,c.measureText(status).width)+18;c.fillStyle='rgba(12,30,33,.92)';c.fillRect(-width/2,-10,width,31);c.strokeStyle=o.contested?'#bd8561':'#8f8b61';c.lineWidth=.7;c.strokeRect(-width/2,-10,width,31);c.fillStyle='#eee3ba';c.fillText(title,0,1);c.font='9px Segoe UI';c.fillStyle=o.contested?'#edb18a':'#bed3c5';c.fillText(status,0,14);c.restore();
  }
  teamOrderMarkers(c,g,zoom){
    for(const order of g.teamOrders||[]){if(order.expiresAt<=g.time||order.alliance!==g.teams[g.playerTeam??0]?.alliance)continue;const p=iso(order.x,order.y),defend=order.kind==='defend',color=defend?'#8fdfca':'#f3b77c',countdown=Math.max(0,Math.ceil(order.launchAt-g.time)),scale=clamp(1/zoom,.8,2);
      c.save();c.translate(p.x,p.y);c.strokeStyle=color;c.lineWidth=1.6/zoom;c.setLineDash([6/zoom,5/zoom]);c.beginPath();c.ellipse(0,0,40,19,0,0,TAU);c.stroke();c.setLineDash([]);c.scale(scale,scale);
      if(defend)polygon(c,[[-8,-24],[8,-24],[7,-13],[0,-7],[-7,-13]],'rgba(26,67,57,.9)',color);else{line(c,-8,-23,7,-8,color,2);line(c,8,-23,-7,-8,color,2);line(c,-10,-13,-3,-20,color,1.5);line(c,3,-20,10,-13,color,1.5);}
      c.font='bold 9px Segoe UI';c.textAlign='center';c.strokeStyle='#142e31';c.lineWidth=3;const label=defend?'ALLIED DEFENSE':countdown?`ASSEMBLE · ${countdown}s`:'JOINT ASSAULT';c.strokeText(label,0,31);c.fillStyle=color;c.fillText(label,0,31);c.restore();
    }
  }
  tower(c,x,y,w,h,color,time,roof=true){
    polygon(c,[[x-w,y],[x,y+5],[x+w,y],[x+w,y-h],[x,y-h-5],[x-w,y-h]],'#727c74');
    polygon(c,[[x,y+5],[x+w,y],[x+w,y-h],[x,y-h+5]],'#444f4e');polygon(c,[[x-w,y],[x,y+5],[x,y-h+5],[x-w,y-h]],'#69746a');
    for(let j=7;j<h;j+=8){line(c,x-w+1,y-j,x,y-j+5,'rgba(33,48,44,.45)',.8);line(c,x,y-j+5,x+w-1,y-j,'rgba(24,38,37,.55)',.8);}
    polygon(c,[[x-w-1,y-h],[x,y-h+5],[x+w+1,y-h],[x,y-h-6]],'#9ca48e');
    for(const dx of[-w,-w/3,w/3,w]){polygon(c,[[x+dx-2,y-h-1],[x+dx+1,y-h+1],[x+dx+1,y-h-5],[x+dx-2,y-h-7]],'#929b86');}
    c.fillStyle='#223c3d';c.fillRect(x+w*.3,y-h+9,2.5,7);line(c,x+w*.3,y-h+9,x+w*.3+2,y-h+8,'#b1b49a',.7);
    if(roof){polygon(c,[[x-w-3,y-h-4],[x,y-h-22],[x+w+3,y-h-4],[x,y-h+1]],color);polygon(c,[[x,y-h-22],[x+w+3,y-h-4],[x,y-h+1]],'#263d42');}
  }
  building(c,b,g){
    const team=g.teams[b.team];if(!team)return;const keep=b.type==='keep',tower=b.type==='tower',artType=b.restoredCastle&&this.conquestArtReady?'restored_castle':b.type,level=keep||tower?clamp(b.level||1,1,3):1,f=this.getStructureFrame(artType,team.sigil,level);if(!f)return;
    const p=iso(b.x,b.y),color=team.color,sprite=this.structureSprite(artType,color,team.sigil,level),t=g.time,w=f.drawWidth,h=f.drawHeight;
    const size=keep&&!f.campaign?[0,.85,1,1.16][level]:1;
    c.save();c.translate(p.x,p.y);c.save();c.scale(size,size);
    const foundation=this.sliceDetails?.foundation;
    if(keep&&foundation&&['riverlands','highlands'].includes(g.landscape?.id)){
      const fw=w*1.08,fh=fw*foundation.height/foundation.width;
      c.drawImage(foundation, -fw*.5, 12-fh*.76,fw,fh);
    }
    if(sprite){if(f.campaign)c.drawImage(sprite,-w/2,12-h,w,h);else c.drawImage(sprite,-70,-134,140,160);}
    // The painted structure is a genuine PNG; lightweight overlays animate its life.
    const flagPin={keep:[.045,.84,.65],barracks:[.15,.76,.43],range:[.11,.8,.42],stables:[-.15,.68,.35],tower:[0,.84,.56],workshop:[-.25,.65,.35]}[b.type]||[.12,.83,.4];
    if(!f.campaign&&b.type!=='dragonspire')this.flag(c,w*flagPin[0],12-h*flagPin[1],team.teamColor||color,t,flagPin[2]);
    else this.houseBadge(c,team,-w*.34,3-h*.12,keep?15:11);
    const pulse=.72+Math.sin(t*10.5+(b.id||0)*.7)*.12+Math.sin(t*17.3)*.08;
    if(b.type==='keep'||b.type==='tower'){
      const tx=w*.22,ty=12-h*.36;c.save();c.globalAlpha*=pulse;
      ellipse(c,tx,ty,4.4,3.6,'rgba(246,165,55,.14)');
      ellipse(c,tx,ty,1.1,2.3,'#e4a14a');ellipse(c,tx,ty-1.2,.7,1.7,'#f3d18a');c.restore();
    }
    if(b.type==='workshop'){
      const chimneyX=w*.14,chimneyY=12-h*.87;
      for(let k=0;k<(this.lowDetail?2:4);k++){const z=(t*.33+k*.25)%1;c.save();c.globalAlpha*=(1-z)*.23;ellipse(c,chimneyX+Math.sin(t*.7+k)*4,chimneyY-z*25,2+z*5,2.5+z*4,'#a5afa2');c.restore();}
      c.save();c.globalAlpha*=pulse;ellipse(c,-w*.14,12-h*.23,6,3.4,'rgba(245,137,42,.16)');ellipse(c,-w*.14,12-h*.23,1.3,1.7,'#e5b361');c.restore();
    }
    if(!b.remembered&&(b.dragonBurnUntil||g.dragonBurns?.size))this.drawBurningVictim(c,g,b,0,12-h*.28,true);
    const health=clamp(b.hp/b.maxHp,0,1);
    if(health<.45){for(let k=0;k<(this.lowDetail?1:3);k++){const z=(t*.42+k*.32)%1;c.save();c.globalAlpha*=(1-z)*.32;ellipse(c,Math.sin(t+k)*5,12-h*.55-z*26,2+z*7,3+z*6,'#4b4e49');c.restore();}}
    c.restore();
    if(keep||tower){const bw=keep?52+level*8:66,y=f.campaign?20:level>1?42:24;
      c.fillStyle='rgba(12,31,33,.93)';c.fillRect(-bw/2-3,y-2,bw+6,20);c.strokeStyle=team.teamColor||color;c.lineWidth=.8;c.strokeRect(-bw/2-3,y-2,bw+6,20);
      c.fillStyle='#29403d';c.fillRect(-bw/2,y+12,bw,3);c.fillStyle=(g.allied?.(b.team,(g.playerTeam??0))??b.team===(g.playerTeam??0))?'#a8d3ad':'#e2a080';c.fillRect(-bw/2,y+12,bw*health,3);
      c.textAlign='center';c.font='bold 8px Segoe UI';c.fillStyle='#efe0b2';c.fillText(`${(keep?['','HALL I','KEEP II','CITADEL III']:['','WATCH I','GUARD II','ROYAL III'])[level]} · ${Math.ceil(Math.max(0,b.hp))}`,0,y+7);
    }else if(health<1){const bw=35;c.fillStyle='#10292a';c.fillRect(-bw/2,15,bw,3);c.fillStyle=(g.allied?.(b.team,(g.playerTeam??0))??b.team===(g.playerTeam??0))?'#a2c8a1':'#d39b7f';c.fillRect(-bw/2,15,bw*health,3);}
    c.restore();
  }
  drawTownHallPortrait(canvas,team,level=1){
    this.drawStructurePortrait(canvas,'keep',team,level);
  }
  drawSelectedProduction(c,g,ui,v,bounds){
    if(!ui.selectedBuildings?.size||!g.productionStatus)return;
    for(const id of ui.selectedBuildings){
      const b=g.byId?.get(id);
      if(!b||b.team!==(g.playerTeam??0)||b.hp<=0)continue;
      const p=iso(b.x,b.y);
      if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom+150)continue;
      const status=g.productionStatus(b);
      if(!status)continue;
      const seconds=Math.max(0,Math.ceil(status.remaining));
      const label=status.ready?'READY':status.blocked==='unique'?'DRAGON AFIELD':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
      const h=this.getStructureFrame(b.type,g.teams[b.team].sigil,b.level)?.drawHeight||70;
      c.save();c.translate(p.x,p.y+12-h);c.scale(1/v.zoom,1/v.zoom);
      c.font='bold 10px Segoe UI';c.textAlign='center';
      const w=c.measureText(label).width+12;
      c.fillStyle=status.ready?'#163b2a':'#12282c';c.fillRect(-w/2,-19,w,15);
      c.lineWidth=1;c.strokeStyle=status.ready?'#85cd95':'#a39472';c.strokeRect(-w/2,-19,w,15);
      c.fillStyle=status.ready?'#bff1bd':'#f4e4ba';c.fillText(label,0,-8);c.restore();
    }
  }
  drawTowerPortrait(canvas,team,level=1){
    this.drawStructurePortrait(canvas,'tower',team,level);
  }
  drawStructurePortrait(canvas,type,team,level=1){
    if(!canvas||!team)return;const f=this.getStructureFrame(type,team.sigil,level);if(!f)return;const c=canvas.getContext('2d'),width=canvas.width||96,height=canvas.height||96,scale=Math.min((width-8)/f.drawWidth,(height-8)/f.drawHeight),w=f.drawWidth*scale,h=f.drawHeight*scale;
    c.clearRect(0,0,width,height);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';const sprite=this.structureSprite(type,team.color,team.sigil,level);if(!sprite)return;
    if(f.campaign)c.drawImage(sprite,(width-w)/2,(height-h)/2,w,h);
    else c.drawImage(sprite,(70-f.drawWidth/2)*2,(146-f.drawHeight)*2,f.drawWidth*2,f.drawHeight*2,(width-w)/2,(height-h)/2,w,h);
  }
  houseBadge(c,team,x,y,size){
    c.save();c.translate(x,y);polygon(c,[[-size*.45,-size*.55],[size*.45,-size*.55],[size*.4,size*.18],[0,size*.55],[-size*.4,size*.18]],team.teamColor||team.color,'#e2c686');
    const symbol=document.getElementById('i-'+team.sigil),box=symbol?.getAttribute('viewBox')?.split(/\s+/).map(Number)||[0,0,24,24];c.save();c.translate(-size*.34,-size*.38);c.scale(size*.68/box[2],size*.68/box[3]);c.fillStyle='#fff1bf';c.strokeStyle='#fff1bf';c.lineWidth=2;c.lineJoin='round';c.lineCap='round';
    if(symbol){for(const node of symbol.querySelectorAll('path')){const shape=new Path2D(node.getAttribute('d'));if(node.getAttribute('fill')&&node.getAttribute('fill')!=='none')c.fill(shape);if(node.getAttribute('stroke')!=='none')c.stroke(shape);}for(const node of symbol.querySelectorAll('circle')){c.beginPath();c.arc(+node.getAttribute('cx'),+node.getAttribute('cy'),+node.getAttribute('r'),0,TAU);c.stroke();}}
    else{c.font='bold 19px Segoe UI';c.textAlign='center';c.fillText((team.sigil||'?')[0].toUpperCase(),12,20);}c.restore();c.restore();
  }
  corpseSprite(body){
    this.corpseSprites??=new Map();
    const key=[body.type==='giant'?'giant':body.kind,body.color,body.dark,body.trim,body.variant,body.isKing].join('|');
    // Cache pose families: sixteen factions, three palettes and all supported
    // troop kinds fit in the cache together, even after a very large battle.
    let frames=this.corpseSprites.get(key);if(!frames){frames=Array.from({length:4},(_,pose)=>this.makeCorpseSprite({...body,pose}));this.corpseSprites.set(key,frames);if(this.corpseSprites.size>384)this.corpseSprites.delete(this.corpseSprites.keys().next().value);}
    return frames[body.pose%4];
  }
  makeCorpseSprite(body){
    const kind=body.type==='giant'?'giant':body.kind==='cavalry'?'cavalry':body.kind==='siege'?'siege':'soldier';
    const sprite=makeCanvas(80,44),c=sprite.getContext('2d');c.translate(40,22);
    c.globalAlpha=.25;ellipse(c,0,1,kind==='cavalry'||kind==='siege'?19:13,kind==='cavalry'?7:5,'#111b16');c.globalAlpha=1;
    c.scale(1,.63);c.rotate([-.38,.35,1.05,-1.12][body.pose]);c.lineCap='round';c.lineJoin='round';
    if(kind==='siege'){
      line(c,-17,-8,15,7,'#3f3327',4);line(c,-13,9,11,-10,'#796044',3.5);line(c,-12,-7,17,-2,'#9a805a',2.5);
      for(const [x,y]of [[-10,9],[12,5]]){c.beginPath();c.ellipse(x,y,5,4,.4,0,TAU);c.strokeStyle='#3e4038';c.lineWidth=2;c.stroke();line(c,x-4,y,x+4,y,'#92724a',1.5);}
      line(c,-3,-5,4,-17,'#8f7957',2);polygon(c,[[4,-17],[14,-13],[9,-7],[0,-10]],body.color,body.dark);line(c,-18,1,-9,-4,'#b6a081',1.2);
    }else{
      if(kind==='cavalry'){
        // A fallen mount lies on its side beneath the rider and saddle cloth.
        const hide=['#695646','#86715a','#514a41'][body.variant];ellipse(c,0,4,15,7,hide);ellipse(c,-15,1,6,4.5,hide);
        line(c,-18,0,-23,3,'#4d4439',3);line(c,-6,8,-12,14,hide,3);line(c,7,8,15,14,hide,3);line(c,12,3,20,-1,'#332e29',2);
        polygon(c,[[-6,-2],[5,-3],[11,5],[-5,8]],body.dark,'#292f2b');line(c,-2,-2,4,5,body.trim,1.6);c.translate(1,-3);c.scale(.9,.9);
      }
      if(kind==='giant')c.scale(1.35,1.35);
      const bent=body.pose%2?1:-1;
      // Distinct splayed/curled limbs, faction cloak, armor and dropped gear.
      polygon(c,[[-6,-5],[6,-4],[9,7],[-9,5]],body.dark,'#26332e');
      line(c,4,1,12,4*bent,body.armor,3.5);line(c,12,4*bent,17,6*bent,'#3e4440',3.2);
      line(c,3,4,9,9,body.armor,3.2);line(c,9,9,14,10,'#3c443e',3.1);
      line(c,-1,-3,-4,-9,body.color,3);line(c,-4,-9,-10,-9+bent*2,body.armor,2.6);
      line(c,-1,3,-7,8,body.color,3);line(c,-7,8,-12,7,body.skin,2.3);
      ellipse(c,-2,0,6,5,body.color);polygon(c,[[-7,-2],[1,-4],[4,2],[-3,4]],body.armor,'#404b45');line(c,-5,-1,2,2,'#bbc0ab',.8);
      ellipse(c,-10,-1,3.4,3.5,body.skin);polygon(c,[[-13,-4],[-8,-5],[-6,-2],[-12,-1]],body.armor,'#404b45');
      line(c,-2,-4,1,-2,body.trim,1.4);
      if(body.kind==='archer'){c.beginPath();c.arc(8,-10,7,-1.15,1.2);c.strokeStyle='#a1885d';c.lineWidth=1.3;c.stroke();line(c,10,-16,10,-4,'#b7b496',.6);}
      else{line(c,4,-10,18,-14,'#b2b9a4',1.2);line(c,6,-13,8,-8,'#7d7351',1.7);}
      if(body.variant!==1){ellipse(c,10,-5,4.5,5.2,body.color);c.beginPath();c.ellipse(10,-5,4.5,5.2,0,0,TAU);c.strokeStyle=body.armor;c.lineWidth=1.2;c.stroke();ellipse(c,10,-5,1.3,1.5,'#b6b9a5');}
      if(body.isKing)polygon(c,[[-18,2],[-18,-3],[-15,-1],[-13,-5],[-11,-1],[-8,-3],[-9,2]],'#e1c16c','#665332');
    }
    return sprite;
  }
  drawAftermath(c,g,bounds){
    const aftermath=g.aftermath;if(!aftermath?.bodies?.length)return;
    const time=aftermath.time??g.time;c.save();
    for(const body of aftermath.bodies){
      const alpha=corpseOpacity(body,time);if(alpha<=0||g.config?.fogOfWar&&!g.vision?.isVisible((g.playerTeam??0),body.x,body.y))continue;
      const p=iso(body.x,body.y);if(p.x<bounds.left-140||p.x>bounds.right+140||p.y<bounds.top-70||p.y>bounds.bottom+70)continue;
      c.globalAlpha=alpha*.92;
      if(this.drawDirectional(c,{...body,hp:0},{time},body.sigil,body.color,p,{x:body.facingX??1,y:body.facingY??0},false))continue;
      const painted=this.getPaintedTroop(body.type,body.sigil);
      if(painted){const index=body.type==='hero'?selectHeroFrame({...body,hp:0,heroMode:time-(body.bornAt??time)>.65?'signature':body.heroMode},{time}):selectPaintedFrame({...body,hp:0},g,painted),direction=iso(body.facingX??1,body.facingY??0);this.drawPaintedTroop(c,painted,index,direction.x<-.03?-1:1,p.x,p.y,body.color);}
      else c.drawImage(this.corpseSprite(body),p.x-40,p.y-22,80,44);
    }
    c.restore();
  }
  selectionMarkers(visibleTroops,selected,zoom){
    if(!selected||selected.size<=12)return null;
    // Sample the visible, fog-filtered selection in screen space. Neighboring
    // soldiers share a cue, except when their orders lock different fronts.
    const markers=new Set(),cells=new Map(),width=90/zoom,height=52/zoom;
    for(const lockedFirst of [true,false])for(const u of visibleTroops){
      if(u.hp<=0||!selected.has(u.id))continue;
      const o=u.order,locked=Number.isFinite(o?.facingX)&&Number.isFinite(o?.facingY);
      if(locked!==lockedFirst)continue;
      const heading=locked?(Math.round(Math.atan2(o.facingY,o.facingX)*4/Math.PI)+8)%8:-1;
      const p=iso(u.x,u.y),x=p.x/width,y=p.y/height,bx=Math.floor(x),by=Math.floor(y);
      let covered=false;
      for(let dy=-1;dy<=1&&!covered;dy++)for(let dx=-1;dx<=1&&!covered;dx++){
        const nearby=cells.get((by+dy)*65536+bx+dx);
        covered=!!nearby?.some(m=>m.team===u.team&&(heading<0||heading===m.heading)&&(x-m.x)**2+(y-m.y)**2<1);
      }
      if(covered)continue;
      markers.add(u.id);const key=by*65536+bx;
      let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);
      bucket.push({x,y,heading,team:u.team});
    }
    return markers;
  }
  groundShadow(c,x,y,rx,ry){
    if(!this.groundShadowSprite){
      const sprite=makeCanvas(32,32),ctx=sprite.getContext('2d');
      const fill=ctx.createRadialGradient(16,16,2,16,16,16);
      fill.addColorStop(0,'rgba(17,18,21,.47)');
      fill.addColorStop(.55,'rgba(17,18,21,.26)');
      fill.addColorStop(1,'rgba(17,18,21,0)');
      ctx.fillStyle=fill;ctx.fillRect(0,0,32,32);
      this.groundShadowSprite=sprite;
    }
    c.drawImage(this.groundShadowSprite,x-rx,y-ry,rx*2,ry*2);
  }
  unit(c,u,g,ui,zoom,markers=null,point=null,worldX=u.x,worldY=u.y,phase=u.phase,shadows=false){
    if(!this.directionalRows&&!this.heroArtReady&&!this.paintedArtReady&&!this.rasterSpritesReady&&!this.houseArtReady&&!this.regimentArtReady&&!this.conquestArtReady&&!this.reinforcementArtReady)return;
    const p=point??iso(worldX,worldY),team=g.teams[u.team];if(!team)return;
    const definition=UNIT_DEFS[u.type],unitClass=g.unitClass?.(u)||definition?.class||u.type;
    const vx=Number.isFinite(u.motionVX)?u.motionVX:(u.vx||0),vy=Number.isFinite(u.motionVY)?u.motionVY:(u.vy||0);
    const selected=ui.selected?.has(u.id),moving=vx*vx+vy*vy>.07*.07;
    const dragon=u.type==='dragon',mounted=unitClass==='cavalry'||u.type==='sun_horse_archer';
    if(this.bridgeArtwork?.spanReady)p.y-=this.bridgeArtwork.deckLift(g,worldX,worldY);
    if(dragon){
      if(this.lowDetail)ellipse(c,p.x,p.y+1,31,12,'rgba(17,18,21,.24)');
      else this.groundShadow(c,p.x,p.y+1,38,16);
    }else if(shadows){
      this.groundShadow(c,p.x,p.y+1,mounted?13:unitClass==='siege'?17:8,mounted?5:unitClass==='siege'?7:3.5);
    }
    if(g.mode?.teams&&zoom>.32){const color=team.teamColor||team.color;c.save();c.globalAlpha=.55;ellipse(c,p.x,p.y+2,unitClass==='cavalry'?8:5,unitClass==='cavalry'?3.3:2.2,color);c.globalAlpha=.95;polygon(c,[[p.x-2,p.y+2],[p.x,p.y+4],[p.x+2,p.y+2],[p.x,p.y]],team.color);c.restore();}
    if(u.elite){c.save();c.beginPath();c.ellipse(p.x,p.y+1,unitClass==='cavalry'?11:8,unitClass==='cavalry'?5:3.8,0,0,TAU);c.strokeStyle='#f4d785';c.lineWidth=1.4;c.stroke();if(zoom>.45){polygon(c,[[p.x,p.y-37],[p.x+2,p.y-33],[p.x+6,p.y-32],[p.x+2,p.y-30],[p.x,p.y-26],[p.x-2,p.y-30],[p.x-6,p.y-32],[p.x-2,p.y-33]],'#ffe7a0','#7f6b3f');}c.restore();}
    if(mounted&&(u.charging||u.momentum>.28)&&moving&&zoom>.35){
      const cells=this.hoofCells??=new Set(),key=Math.floor(p.x/42)*65536+Math.floor(p.y/32);
      if(cells.size<(this.lowDetail?10:24)&&!cells.has(key)){
        cells.add(key);
        const dir=iso(vx,vy),length=Math.hypot(dir.x,dir.y)||1,dx=dir.x/length,dy=dir.y/length;
        const beat=((phase||0)/TAU*2)%1,distance=6+beat*11;
        const ground=!this.lowDetail&&g.tileAt?.(worldX,worldY);
        const wet=ground&&(ground.terrain==='water'||ground.feature==='ford'||ground.feature==='bridge');
        const dust=wet?'#9baba1':ground?.terrain==='forest'?'#a39475':'#c9b993';
        c.save();c.globalAlpha=(1-beat)*.48*clamp(u.momentum??.7,0,1);
        ellipse(c,p.x-dx*distance,p.y-dy*distance-beat*3,2.5+beat*4,1.3+beat*1.7,dust);c.restore();
      }
    }
    const marked=selected&&(dragon||!markers||markers.has(u.id));
    if(marked){
      const rx=dragon?35:unitClass==='cavalry'?11:8,ry=dragon?15:unitClass==='cavalry'?5:3.8;
      ellipse(c,p.x,p.y+1,rx,ry,'rgba(224,215,144,.19)');c.beginPath();c.ellipse(p.x,p.y+1,rx,ry,0,0,TAU);c.strokeStyle='#f6d986';c.lineWidth=dragon?1.6:1;c.stroke();
    }
    if(u.type==='hero'){c.beginPath();c.ellipse(p.x,p.y+1,11,5,0,0,TAU);c.strokeStyle='#e5cb74';c.lineWidth=1.5;c.stroke();}
    const planted=u.spearState==='braced'||u.spearState==='lowering';
    const direction=(planted&&u.braceDir)||(Number.isFinite(u.facingX)&&Number.isFinite(u.facingY)?{x:u.facingX,y:u.facingY}:{x:vx,y:vy});
    const pose=zoom>=.5?combatPose(u,g,definition,moving):null;
    const braced=zoom>.6&&u.braceDir&&(u.braceTime||0)>=.45&&!(u.knockT>0);
    const drawn=this.drawDirectional(c,u,g,team.sigil,team.color,p,direction,moving,pose?.windup,phase,dragon?0:pose?.hitX,dragon?0:pose?.hitY);
    const painted=drawn?null:this.getPaintedTroop(u.type,team.sigil);
    if(painted){
      const screenFacing=iso(direction.x,direction.y),facing=screenFacing.x<-.03?-1:1;
      const index=u.type==='hero'?selectHeroFrame(u,g,moving):selectPaintedFrame(u,g,painted,moving,pose?.windup,screenFacing);
      // Contact and deflection carry the whole authored weapon/hand pose together.
      let x=p.x+(pose?.dx||0),y=p.y+(pose?.dy||0);
      if(u.type==='hero'&&heroOwnsVisibleStandard(u,g)){
        const action=u.standardAction?.phase==='handling'?u.standardAction:u.standardVisual;
        if(['plant','pickup'].includes(action?.kind)&&Number.isFinite(action.x)&&Number.isFinite(action.y)){
          const target=iso(action.x,action.y),f=painted.frames[index],delta=(f.poleAnchorX-f.anchorX)*f.scale*facing;
          // Full interaction frames contain the same pole as the world object.
          // Align the authored pole root at the handoff, never draw a spare pole.
          const blend=action.kind==='plant'&&action.phase!=='abort'?clamp((action.progress||0)/.25,0,1):1;
          x+=(target.x-delta-p.x)*blend;y+=(target.y-p.y)*blend;
        }
      }
      this.drawPaintedTroop(c,painted,index,facing,x,y,team.color);
    }
    else if(!drawn&&!dragon){
      const hasHouseArt=REGIMENT_ART_TYPES.includes(u.type)||CONQUEST_ART_HOUSES[u.type]||REINFORCEMENT_HOUSES[u.type]||g.houseContent?.(u.team)?.unit===u.type;
      const facing=(direction.x-direction.y)*HW<-.03?-1:1,attack=pose?.attack||(u.attackAnim||0)>.05;
      let frame=pose?.attack?pose.frame:attack?Math.min(3,Math.floor((1-clamp(u.attackAnim,0,1))*4)):moving?Math.floor((phase||0)/TAU*4):0;
      frame=((frame%4)+4)%4;
      if(u.backpedaling&&moving&&!attack)frame=3-frame;
      const deployed=u.type==='trebuchet'&&(u.trebuchetState?u.trebuchetState==='deployed'||u.trebuchetState==='takingDown':(u.setupProgress||0)>=UNIT_DEFS.trebuchet.setupSeconds);
      const sprite=this.soldierSprite(u.type,team.color,team.dark,facing,frame,attack||deployed,hasHouseArt?team.sigil:null);
      if(sprite)c.drawImage(sprite,p.x-32,p.y-64,64,72);
    }
    if(u.dragonBurnUntil||g.dragonBurns?.size)this.drawBurningVictim(c,g,u,p.x,p.y-(dragon?33:unitClass==='cavalry'?18:10),false);
    if(u.type==='trebuchet'&&zoom>.5){
      const state=u.trebuchetState,takingDown=state==='takingDown',packed=state==='packed';
      const duration=state?TREBUCHET_TIMES[takingDown?'takedown':'setup']:UNIT_DEFS.trebuchet.setupSeconds;
      const remaining=state?u.trebuchetRemaining||0:duration-(u.setupProgress||0);
      const ready=state?state==='deployed':remaining<=0;
      if(!packed){
        const progress=clamp(1-remaining/duration,0,1);
        c.fillStyle='#142c2c';c.fillRect(p.x-20,p.y-97,40,4);
        c.fillStyle=ready?'#b8d4a0':'#d6b773';c.fillRect(p.x-20,p.y-97,40*progress,4);
      }
      if(selected){
        const label=ready?'DEPLOYED':packed?(u.order?.setupOnArrival?'SET UP QUEUED':'PACKED'):`${takingDown?'TAKEDOWN':'SETUP'} ${Math.ceil(remaining)}s`;
        c.font='bold 8px Segoe UI';c.textAlign='center';c.fillStyle='#f2deac';c.fillText(label,p.x,p.y-101);
      }
    }
    if(marked&&zoom>.55&&Math.hypot(direction.x,direction.y)>.01){
      const screenFacing=iso(direction.x,direction.y),faceLength=Math.hypot(screenFacing.x,screenFacing.y)||1;
      const dx=screenFacing.x/faceLength,dy=screenFacing.y/faceLength,color=u.backpedaling?'#a8ddd1':'#e7cc89';
      c.save();c.globalAlpha=.85;line(c,p.x+dx*9,p.y+1+dy*9,p.x+dx*17,p.y+1+dy*17,color,1.2);
      line(c,p.x+dx*17,p.y+1+dy*17,p.x+dx*13-dy*2.5,p.y+1+dy*13+dx*2.5,color,1.2);line(c,p.x+dx*17,p.y+1+dy*17,p.x+dx*13+dy*2.5,p.y+1+dy*13-dx*2.5,color,1.2);c.restore();
    }
    if(braced){
      // A ground front marker communicates the precise simulated angle. The
      // complete painted soldier already includes its weapon and both hands.
      const point=iso(u.braceDir.x,u.braceDir.y),length=Math.hypot(point.x,point.y)||1,dx=point.x/length,dy=point.y/length,reach=u.type==='dread_pike'?27:22;
      line(c,p.x+dx*13-dy*7,p.y+dy*13+dx*7,p.x+dx*13+dy*7,p.y+dy*13-dx*7,'#b7d6d1',1.4);
    }
    if(selected&&zoom>.8&&(u.charging||u.chargeBlockedUntil>g.time)){c.save();c.font='bold 7px Segoe UI';c.textAlign='center';c.strokeStyle='#122423';c.lineWidth=3;c.strokeText(u.charging?'CHARGE':'CHARGE BROKEN',p.x,p.y-44);c.fillStyle=u.charging?'#f2d391':'#edab8f';c.fillText(u.charging?'CHARGE':'CHARGE BROKEN',p.x,p.y-44);c.restore();}
    if(selected&&zoom>.8&&UNIT_DEFS[u.type]?.lanceChampion&&u.order?.mode==='move'&&!(u.chargeBlockedUntil>g.time)){c.save();c.font='bold 7px Segoe UI';c.textAlign='center';c.strokeStyle='#122423';c.lineWidth=3;c.strokeText('REGROUPING',p.x,p.y-44);c.fillStyle='#a8ddd1';c.fillText('REGROUPING',p.x,p.y-44);c.restore();}
    if(zoom>.5&&(u.resolveUntil||0)>g.time){const glint=.45+Math.sin(g.time*7+u.id)*.25;c.save();c.globalAlpha=glint;line(c,p.x-5,p.y-21,p.x-2,p.y-25,'#bce4ed',1);line(c,p.x-4,p.y-24,p.x-1,p.y-22,'#e6f4f1',.8);c.restore();}
    if(zoom>.5&&((u.venomUntil||0)>g.time||(u.poisonUntil||0)>g.time)){c.save();c.globalAlpha=.38+Math.sin(g.time*8+u.id)*.14;const lift=((g.time*1.7+u.id*.19)%1)*8;line(c,p.x+4,p.y-14-lift,p.x+5,p.y-17-lift,'#a4cd69',1);if((u.poisonUntil||0)>g.time)line(c,p.x-3,p.y-10-lift,p.x-2,p.y-13-lift,'#88ae52',.9);c.restore();}
    if(zoom>.55){
      if((u.shockUntil||0)>g.time){line(c,p.x-4,p.y-32,p.x,p.y-36,'#f5d778',1.3);line(c,p.x,p.y-36,p.x-1,p.y-30,'#f5d778',1.3);}
      if((u.snaredUntil||0)>g.time||(u.crippledUntil||0)>g.time){c.beginPath();c.ellipse(p.x,p.y+2,8,3.5,0,0,TAU);c.strokeStyle=(u.snaredUntil||0)>g.time?'#d3a98a':'#edb475';c.lineWidth=1;c.stroke();}
      if((u.crannogPoison?.until||0)>g.time){const lift=((g.time*1.3+u.id*.2)%1)*8;ellipse(c,p.x+5,p.y-14-lift,1.6,2,'#a7c96c');}
      if((u.specialGuardUntil||0)>g.time){c.beginPath();c.ellipse(p.x,p.y,10,4.4,0,0,TAU);c.strokeStyle='#b6dbe5';c.lineWidth=1;c.stroke();}
      if((u.berserkUntil||0)>g.time||u.type==='freefolk_berserker'&&u.hp<u.maxHp*.4){line(c,p.x-7,p.y-9,p.x-5,p.y-18,'#ef9a69',1.2);line(c,p.x+6,p.y-8,p.x+8,p.y-17,'#ef9a69',1.2);}
    }
    if(!this.lowDetail&&(this.meleeArcs??0)<36&&u.attackAnim>.64&&!dragon&&!definition?.ranged&&unitClass!=='archer'&&unitClass!=='siege'){
      this.meleeArcs=(this.meleeArcs??0)+1;
      const front=attackFacing(u,g,direction),axis=iso(front.x,front.y);
      const angle=Math.atan2(axis.y,axis.x),sweep=(1-u.attackAnim)*2,opacity=c.globalAlpha;
      c.beginPath();c.ellipse(p.x,p.y-(unitClass==='cavalry'?28:16),15,7,0,angle-1.1+sweep,angle+.22+sweep);
      c.globalAlpha=opacity*u.attackAnim*.7;c.strokeStyle='#f8e29c';c.lineWidth=1.4;c.stroke();c.globalAlpha=opacity;
    }
    const showHealth=selected?(dragon||!markers||u.hp<u.maxHp):u.hp<u.maxHp*.7;
    if(u.type!=='hero'&&showHealth&&zoom>(dragon?.26:.57)){
      const row=dragon?this.directionalRow('dragon'):null;
      const w=dragon?52:12,h=dragon?4:2,barY=p.y-(row?row.ay*(row.worldScale??.5)+4:u.type==='trebuchet'?89:unitClass==='siege'?64:unitClass==='cavalry'?49:34);
      c.fillStyle='#15302f';c.fillRect(p.x-w/2,barY,w,h);c.fillStyle=(g.allied?.(u.team,(g.playerTeam??0))??u.team===(g.playerTeam??0))?'#b9d9a1':'#d4a18a';c.fillRect(p.x-w/2,barY,w*clamp(u.hp/u.maxHp,0,1),h);
    }
    if(u.isKing){c.save();if(zoom>.57){c.fillStyle='#15302f';c.fillRect(p.x-8,p.y-29,16,3);c.fillStyle='#f3d77d';c.fillRect(p.x-8,p.y-29,16*clamp(u.hp/u.maxHp,0,1),3);}c.lineWidth=1.6;c.strokeStyle='#f0d78b';c.beginPath();c.ellipse(p.x,p.y+1,14,6,0,0,TAU);c.stroke();
      polygon(c,[[p.x-6,p.y-42],[p.x-7,p.y-49],[p.x-3,p.y-46],[p.x,p.y-51],[p.x+3,p.y-46],[p.x+7,p.y-49],[p.x+6,p.y-42]],'#f3d77d','#6a5633');
      if(zoom>.5){c.font='bold 8px Segoe UI';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#11241f';c.strokeText('KING',p.x,p.y-56);c.fillStyle='#f3dda0';c.fillText('KING',p.x,p.y-56);}c.restore();}
  }
  facingPreview(c,g,preview,zoom){
    const {x,y,faceX,faceY}=preview,length=Math.hypot(faceX,faceY);if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(length)||length<.001)return;
    const fx=faceX/length,fy=faceY/length,sx=-fy,sy=fx,count=Math.max(1,Math.min(100000,Number.isFinite(preview.count)?Math.floor(preview.count):1)),spacing=preview.formation==='spread'?.7:.43,cols=Math.max(3,Math.ceil(Math.sqrt(count)*1.45)),rows=Math.ceil(count/cols),shown=Math.min(36,count),color='#e9cd8b';
    c.save();c.lineWidth=1.2/zoom;c.strokeStyle=color;c.fillStyle=color;c.globalAlpha=.85;
    // Sample a bounded number of slots while preserving the commanded width.
    for(let sample=0;sample<shown;sample++){
      const i=shown===1?0:Math.round(sample*(count-1)/(shown-1));let side=(i%cols-(Math.min(cols,count)-1)/2)*spacing,back=(Math.floor(i/cols)-(rows-1)/2)*spacing;
      if(preview.formation==='wedge'&&count>1){side=(i%cols-(cols-1)/2)*spacing;back=Math.abs(side)*.7+Math.floor(i/cols)*spacing-rows*spacing*.45;}
      const wx=x+sx*side-fx*back,wy=y+sy*side-fy*back,p=iso(wx,wy);
      if(g.isWalkable?.(wx,wy)!==false){c.beginPath();c.ellipse(p.x,p.y,4.5,2.3,0,0,TAU);c.fill();}
      else{line(c,p.x-3,p.y-3,p.x+3,p.y+3,'#e3a184',1.2/zoom);line(c,p.x-3,p.y+3,p.x+3,p.y-3,'#e3a184',1.2/zoom);}
    }
    const half=Math.max(.65,(Math.min(cols,count)-1)*spacing*.5),front=(rows-1)*spacing*.5+.35,a=iso(x+sx*half+fx*front,y+sy*half+fy*front),b=iso(x-sx*half+fx*front,y-sy*half+fy*front),p=iso(x+fx*front,y+fy*front),q=iso(x+fx*(front+1.55),y+fy*(front+1.55)),arrow=iso(fx,fy),alen=Math.hypot(arrow.x,arrow.y)||1,dx=arrow.x/alen,dy=arrow.y/alen,head=7/zoom;
    c.globalAlpha=.95;line(c,a.x,a.y,b.x,b.y,color,2/zoom);line(c,p.x,p.y,q.x,q.y,color,2/zoom);polygon(c,[[q.x+dx*head,q.y+dy*head],[q.x-dy*head*.55,q.y+dx*head*.55],[q.x+dy*head*.55,q.y-dx*head*.55]],color);
    c.font=`600 ${10/zoom}px Segoe UI`;c.textAlign='center';c.textBaseline='middle';c.strokeStyle='#10282d';c.lineWidth=4/zoom;const tx=q.x+dx*19/zoom,ty=q.y+dy*19/zoom;c.strokeText('FRONT',tx,ty);c.fillStyle='#f4dfb2';c.fillText('FRONT',tx,ty);c.restore();
  }
  advancePreview(c,{x,y,fromX,fromY,valid},zoom){
    const start=iso(fromX,fromY),end=iso(x,y),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),size=7/zoom;
    const color=valid?'#f3d88c':'#eb9b83';
    c.save();
    if(length>size*2){
      c.setLineDash([6/zoom,5/zoom]);
      line(c,start.x,start.y,end.x,end.y,color,1.75/zoom);
      c.setLineDash([]);
      const fx=dx/length,fy=dy/length;
      polygon(c,[[end.x+fx*size,end.y+fy*size],[end.x-(fx+fy)*size,end.y-(fy-fx)*size],[end.x-(fx-fy)*size,end.y-(fy+fx)*size]],color);
    }
    c.beginPath();c.ellipse(end.x,end.y,size*1.55,size*1.2,0,0,TAU);c.strokeStyle=color;c.lineWidth=1.5/zoom;c.stroke();
    c.restore();
  }
  projectiles(c,g,bounds){
    for(const b of g.projectiles||[]){
      const p=iso(b.x,b.y);
      if(bounds&&(p.x<bounds.left-16||p.x>bounds.right+16||p.y<bounds.top-16||p.y>bounds.bottom+120))continue;
      if(g.config?.fogOfWar&&!g.isVisibleTo((g.playerTeam??0),{x:b.x,y:b.y}))continue;
      const kind=projectileKind(b),{height,angle}=projectileDrawPose(b,kind);
      c.save();c.translate(p.x,p.y-height);c.rotate(angle);
      if(kind==='arrow'||kind==='bolt'){
        const bolt=kind==='bolt',half=b.sourceType==='beacon_engineer'?13:bolt?7:10;
        line(c,-half,0,half,0,'#271f19',bolt?2.5:2);
        line(c,-half,0,half-3,0,bolt?'#d4b980':'#eed2a0',1);
        if(!this.lowDetail){
          c.beginPath();c.moveTo(-half-1,-2.4);c.lineTo(-half+4,-.65);c.lineTo(-half+4,.65);c.lineTo(-half-1,2.4);c.closePath();
          c.fillStyle=bolt?'#996357':'#e8ddbb';c.fill();
        }
        c.beginPath();c.moveTo(half-4,-2.3);c.lineTo(half+1,0);c.lineTo(half-4,2.3);c.closePath();
        c.fillStyle=bolt?'#9daaaf':'#d1d9d6';c.fill();
      }else{
        const sprite=this.projectileFrames?.[kind];
        const width=kind==='rock'?(b.sourceType==='trebuchet'?15:10):kind==='javelin'?20:kind==='axe'?12:9;
        if(sprite){
          const heightPx=width*sprite.height/sprite.width;
          c.drawImage(sprite.image,sprite.left,sprite.top,sprite.width,sprite.height,-width/2,-heightPx/2,width,heightPx);
        }else if(kind==='javelin')line(c,-width/2,0,width/2,0,'#e6c69a',1.8);
        else ellipse(c,0,0,width/2,width*.32,kind==='firepot'?'#b86b37':'#65635b');
      }
      c.restore();
    }
  }
  fireZones(c,g,bounds,zoom){
    const zones=g.fireZones||[];let visible=0;
    for(let index=zones.length-1;index>=0&&visible<24;index--){const z=zones[index];if(!(z.life>0)||g.config?.fogOfWar&&!g.isVisibleTo((g.playerTeam??0),{x:z.x,y:z.y}))continue;const p=iso(z.x,z.y),radius=clamp(z.radius||1,.3,3),rw=radius*40,rh=radius*20;if(p.x+rw<bounds.left||p.x-rw>bounds.right||p.y+rh<bounds.top||p.y-rh-45>bounds.bottom)continue;visible++;
      const fade=Math.min(1,z.life/.7),heat=.45+.55*clamp(z.life/(z.maxLife||4),0,1);
      const count=zoom<.3?3:this.lowDetail?5:10;
      const seed=Math.round(z.x*59)+Math.round(z.y*71)*31,spin=hash(seed)*TAU;
      c.save();c.globalAlpha*=fade;
      this.scorchBed??=createScorchBed();
      c.drawImage(this.scorchBed,p.x-rw,p.y-rh,rw*2,rh*2);
      for(let k=0;k<count;k++){
        const angle=spin+k*2.399963,dist=radius*Math.sqrt((k+.5)/count)*.88;
        const foot=iso(z.x+Math.cos(angle)*dist,z.y+Math.sin(angle)*dist);
        const noise=hash(seed,k),phase=g.time*(9+noise*4)+k*3.7+spin;
        const height=(20+22*noise)*(1+.1*Math.sin(phase*.55))*heat;
        const width=height*(.66+.29*hash(k,seed));
        const sprite=this.fireSprite(Math.floor(phase)&15,k%3);
        c.drawImage(sprite,foot.x-width*.5,foot.y-height*.83,width,height);
        if(!this.lowDetail&&zoom>.35&&k%3===0){
          const rise=(g.time*(.65+noise*.3)+noise)%1;
          const x=foot.x+rise*(4+noise*8)+Math.sin(rise*7+k)*2,y=foot.y-height*.53-rise*17;
          c.save();c.globalAlpha*=(1-rise)*.85;line(c,x,y,x+.8,y-1.6,'#ffc573',1.05);c.restore();
        }
      }c.restore();
    }
  }
  fireSprite(frame,variant=0){
    if(!this.dragonFlame)return this.scorchBed??=createScorchBed();
    this.fireSprites??=new Map();const key=(frame&15)*3+variant;
    if(this.fireSprites.has(key))return this.fireSprites.get(key);
    const sprite=createGroundFlameFrame(this.dragonFlame,frame,variant);
    this.fireSprites.set(key,sprite);return sprite;
  }
  drawBurningVictim(c,g,entity,x,y,building){
    const remaining=(entity.dragonBurnUntil??g.dragonBurns?.get(entity.id)?.until??0)-g.time;
    if(remaining<=0)return;
    const low=this.lowDetail,cells=this.burningCells??=new Set();
    const size=low?1.7:.65,key=Math.floor(entity.x/size)*65536+Math.floor(entity.y/size);
    if(cells.size>=(low?10:28)||cells.has(key))return;
    cells.add(key);
    const variety=hash(entity.id,41),phase=g.time*(10+3*variety)+entity.id;
    const height=(building?31:16)*(1+.47*variety)*(.8+.2*Math.min(1,remaining));
    const width=height*(building?.83:.64);
    x+=(variety-.5)*(building?16:6);
    c.save();c.globalAlpha*=Math.min(1,remaining*3)*.85;
    c.drawImage(this.fireSprite(Math.floor(phase)&15,entity.id%3),x-width*.5,y-height*.83,width,height);
    if(!low){
      const t=phase*.068%1,sparkX=x+Math.sin(phase*.35)*4;
      c.globalAlpha*=1-t;line(c,sparkX,y-height*.55-t*9,sparkX+1.4,y-height*.55-t*9-2.2,'#ffc77d',1);
    }
    c.restore();
  }
  effects(c,g,lowDetail=false,bounds,effects=visibleCombatEffects(g,bounds,lowDetail)){
    for(const {f,p} of effects){
      if(isSiegeEarthImpact(f)){
        drawSiegeEarthImpact(c,f,p,g.tileAt?.(f.x,f.y),lowDetail,false);
        continue;
      }
      const r=clamp(1-f.life/(f.maxLife||1),0,1);c.save();c.translate(p.x,p.y-7);c.globalAlpha=1-r;
      if(f.type==='specialHit'){
        const color={guard:'#b4deec',pierce:'#c8e5f0',cleave:'#e4bd82',heal:'#a8dfa0',loot:'#f1ce73',shock:'#f3d26e',snare:'#d1a27e',poison:'#adcb6d',cripple:'#efb174',finish:'#df9292',fury:'#e8a275'}[f.kind]||'#e9d9a7';
        if(f.kind==='heal'){line(c,-4,-12-r*7,4,-12-r*7,color,2);line(c,0,-16-r*7,0,-8-r*7,color,2);}
        else if(f.kind==='cleave'||f.kind==='finish'){c.beginPath();c.arc(0,-7,8+r*14,-2.8,-.1);c.strokeStyle=color;c.lineWidth=2*(1-r)+.4;c.stroke();}
        else if(f.kind==='loot'){for(let k=0;k<3;k++)ellipse(c,(k-1)*5,-8-r*15-k*2,2,2.8,color);}
        else if(f.kind==='poison'){ellipse(c,-3,-9-r*12,2,3,color);ellipse(c,4,-5-r*9,1.5,2.5,color);}
        else{c.beginPath();c.ellipse(0,1,6+r*12,3+r*5,0,0,TAU);c.strokeStyle=color;c.lineWidth=1.6*(1-r)+.4;c.stroke();line(c,-4,-8-r*6,0,-14-r*6,color,1.3);line(c,0,-14-r*6,4,-8-r*6,color,1.3);}
      }else if(f.type==='blockImpact'){
        const v=iso(f.dx||0,f.dy||0),length=Math.hypot(v.x,v.y)||1;c.translate(-v.x/length*5,-13-v.y/length*5);
        for(let k=0;k<(lowDetail?3:5);k++){const angle=k*1.35+r*.5,travel=3+r*11;line(c,Math.cos(angle)*travel*.45,Math.sin(angle)*travel*.45,Math.cos(angle)*travel,Math.sin(angle)*travel,'#f4df9e',1.7*(1-r));}
      }else if(f.type==='hammerImpact'){
        const heading=iso(f.dx||1,f.dy||0);c.rotate(Math.atan2(heading.y,heading.x));
        c.beginPath();c.ellipse(0,0,7+r*25,4+r*13,0,0,TAU);c.strokeStyle='#f1cb72';c.lineWidth=3*(1-r)+.5;c.stroke();
        for(let k=0;k<(lowDetail?4:8);k++){const angle=k*2.399963,travel=5+r*(16+k%3*4),x=Math.cos(angle)*travel,y=Math.sin(angle)*travel*.6;ellipse(c,x,y,1.8+r*2,1+r*1.5,k%2?'#b7a989':'#e0c999');line(c,x*.5,y*.5-4,x,y-6,'#fff0b6',1.8*(1-r));}
        line(c,-5-r*12,-2,8+r*16,-2,'#ffe7a0',2.5*(1-r));
      }else if(f.type==='braceImpact'){
        c.globalAlpha=(1-r)*.9;const size=9+r*20;line(c,-size,-size*.6,size,size*.6,'#f2b190',2.4);line(c,-size,size*.6,size,-size*.6,'#dce6d6',2.4);c.beginPath();c.ellipse(0,0,8+r*25,4+r*12,0,0,TAU);c.strokeStyle='#edb18e';c.lineWidth=2*(1-r)+.5;c.stroke();
      }else if(f.type==='chargeImpact'){
        const heading=iso(Number.isFinite(f.dx)?f.dx:1,Number.isFinite(f.dy)?f.dy:0),angle=Math.atan2(heading.y,heading.x),strength=clamp(f.strength??.7,.15,1.5);c.rotate(angle);c.scale(1.3,1.3);
        for(let k=0;k<(lowDetail?3:6);k++){const spread=(k/(lowDetail?2:5)-.5)*1.8,travel=(5+r*25)*strength,px=Math.cos(spread)*travel,py=Math.sin(spread)*travel*.65;ellipse(c,px-r*6,py-r*4,2+r*4,1.5+r*2.2,k%2?'#b9ad82':'#d0be8b');if(k%2===0)line(c,px*.42,py*.42-3,px+3,py-5,'#f0d69a',1.2*(1-r));}
        c.globalAlpha*=(1-r)*.6;line(c,-8-r*14,-3,r*8,-3,'#5d6046',1.4);line(c,-6-r*12,3,r*7,3,'#777557',1.1);
        c.beginPath();c.ellipse(3+r*13,0,4+r*8,7+r*10,0,-1.35,1.35);c.strokeStyle='#dfc58e';c.lineWidth=1.5*(1-r);c.stroke();
      }else if(f.type==='explosion'){
        const blastScale=clamp(f.radius||1,.7,1.8);c.scale(blastScale,blastScale);
        ellipse(c,0,5,10+r*25,4+r*9,'rgba(39,29,20,.45)');for(let k=0;k<6;k++){const a=k/6*TAU+hash(k)*3,rr=5+r*19;ellipse(c,Math.cos(a)*rr,Math.sin(a)*rr-r*12,5*(1-r)+3,6*(1-r)+2,k%2?'#e8ae5d':'#e8d197');}
        c.beginPath();c.arc(0,0,3+r*27,0,TAU);c.strokeStyle='#f8d27e';c.lineWidth=2*(1-r);c.stroke();
      }else if(f.type==='capture'){
        c.beginPath();c.ellipse(0,6,10+r*27,4+r*12,0,0,TAU);c.strokeStyle=g.teams[f.team]?.color||'#ead58d';c.lineWidth=1.5;c.stroke();
      }else if(f.type==='dust'){
        ellipse(c,Math.sin(r*3)*4,4-r*8,2+r*6,1+r*4,'#a3a483');
      }else{
        for(let k=0;k<3;k++){const a=k/3*TAU+r*2;line(c,Math.cos(a)*r*6,-7+Math.sin(a)*r*6,Math.cos(a)*(3+r*10),-7+Math.sin(a)*(3+r*10),'#f7dfa1',1.3);}
      }c.restore();
    }
  }
  battlefieldLighting(c,v){
    const lighting=this.lighting;
    if(lighting?.width===v.w&&lighting.height===v.h&&lighting.dpr===this.dpr)return lighting;
    const glow=c.createRadialGradient(v.w*.52,v.h*.42,10,v.w*.5,v.h*.5,v.w*.7);
    glow.addColorStop(0,'#25404a');glow.addColorStop(1,'#0d222a');
    const vignette=c.createRadialGradient(v.w/2,v.h/2,v.h*.3,v.w/2,v.h/2,v.w*.8);
    vignette.addColorStop(0,'rgba(2,14,19,0)');vignette.addColorStop(1,'rgba(2,14,19,.35)');
    return this.lighting={width:v.w,height:v.h,dpr:this.dpr,glow,vignette};
  }
  draw(g,v,ui={}){
    if(!this.terrainReady)return;
    this.directionalDisplayScale=v.zoom*(v.dpr||1);
    const scene=this.fogScene(g);
    const lowDetail=ui.quality==='performance'||ui.quality!=='high'&&(!!ui.lowDetail||v.zoom<.75);
    const layerScenery=!lowDetail&&v.zoom>=(ui.quality==='high'?.55:.75);
    this.lowDetail=lowDetail;
    this.burningCells?.clear();
    if(!this.w||!this.h)this.resize(v.w,v.h,v.dpr||1);if(this.cachedGame!==g)this.prepare(g);if(this.lastBuildingCount!==g.buildings.length||this.lastBuildingId!==(g.buildings.at(-1)?.id||0))this.clearBuildingSites(g);if(g.config?.fogOfWar&&this.territoryVisionRevision!==g.vision.revision){this.updateTerritory(g);this.territoryVisionRevision=g.vision.revision;const signature=scene.buildings.map(b=>b.id).join(',')+'|'+scene.castles.map(b=>b.id).join(',');if(signature!==this.fogSiteSignature){this.clearBuildingSites(g);this.fogSiteSignature=signature;}}if(g.time-this.territoryTime>(lowDetail?.55:.35)||this.territoryTime<0)this.updateTerritory(g);
    this.frame++;const c=this.ctx,d=this.dpr;c.setTransform(d,0,0,d,0,0);
    const lighting=this.battlefieldLighting(c,v);c.fillStyle=lighting.glow;c.fillRect(0,0,v.w,v.h);
    c.save();c.translate(v.w/2-v.x*v.zoom,v.h/2-v.y*v.zoom);c.scale(v.zoom,v.zoom);
    const bounds={left:v.x-v.w/v.zoom/2-140,right:v.x+v.w/v.zoom/2+140,top:v.y-v.h/v.zoom/2-110,bottom:v.y+v.h/v.zoom/2+80};
    const combatEffects=visibleCombatEffects(g,bounds,lowDetail);
    const range=this.visibleWorldRange(g,bounds);this.lastVisibleRange=range;
    for(let i=0;i<(lowDetail?22:44);i++){const x=this.left+hash(i,4)*(this.mapW),y=-60+hash(i,8)*this.mapH;if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)continue;const wave=Math.sin(g.time*.8+i)*3;line(c,x+wave,y,x+8+wave,y,'rgba(106,152,159,.16)',.8);if(!lowDetail)line(c,x+4+wave,y+3,x+15+wave,y+3,'rgba(106,152,159,.10)',.7);}
    this.drawGround(c,g,v,bounds,range,layerScenery);
    for(const {f,p} of combatEffects){
      if(isSiegeEarthImpact(f))drawSiegeEarthImpact(c,f,p,g.tileAt?.(f.x,f.y),lowDetail,true);
    }
    this.heroStandardGround(c,g,ui,v.zoom);
    for(const objective of [...scene.objectives,...scene.castles.filter(site=>site.ruined)]){const p=iso(objective.x,objective.y),radius=(objective.radius||4)*HW*1.5;if(p.x+radius>bounds.left&&p.x-radius<bounds.right&&p.y+radius>bounds.top&&p.y-radius<bounds.bottom)this.objectiveGround(c,objective,g,v.zoom);}
    if(ui.showGrid||ui.buildMode||ui.facingPreview){
      c.save();c.globalAlpha=ui.buildMode||ui.facingPreview?1:.24;
      if(v.zoom>.48){c.lineWidth=.65;for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const p=iso(x+.5,y+.5);if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)continue;diamond(c,p.x,p.y,HW,HH,null,'rgba(197,211,174,.11)');}}
      else{for(let x=Math.ceil(range.x0/4)*4;x<=range.x1;x+=4){const a=iso(x,range.y0),b=iso(x,range.y1+1);line(c,a.x,a.y,b.x,b.y,'rgba(197,211,174,.10)',.65/v.zoom);}for(let y=Math.ceil(range.y0/4)*4;y<=range.y1;y+=4){const a=iso(range.x0,y),b=iso(range.x1+1,y);line(c,a.x,a.y,b.x,b.y,'rgba(197,211,174,.10)',.65/v.zoom);}}
      c.restore();
    }
    if(v.zoom>.32)for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const t=g.tiles[y*g.W+x];if(t.claim<0||!t.capture||t.capture>.999||g.config?.fogOfWar&&!g.isVisibleTo((g.playerTeam??0),{x:x+.5,y:y+.5}))continue;const p=iso(t.x+.5,t.y+.5);if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)continue;const color=g.teams[t.claim]?.color||'#dac589';c.globalAlpha=.08+Math.sin(g.time*4)*.03;diamond(c,p.x,p.y,HW,HH,color);c.globalAlpha=1;c.fillStyle='rgba(10,35,32,.7)';c.fillRect(p.x-11,p.y+5,22,2);c.fillStyle=color;c.fillRect(p.x-11,p.y+5,22*t.capture,2);}
    this.drawAftermath(c,g,bounds);
    this.fireZones(c,g,bounds,v.zoom);
    // Rally markers belong to the selected production posts, never army orders.
    const rallies=new Map();
    for(const b of g.buildings){if(b.team!==(g.playerTeam??0)||b.hp<=0||!ui.selectedBuildings?.has(b.id))continue;const p=iso(b.x,b.y),scale=b.type==='keep'?(1+((b.level||1)-1)*.25):1;c.save();c.strokeStyle='#f1d187';c.lineWidth=2/v.zoom;diamond(c,p.x,p.y+3,(b.type==='keep'?38:25)*scale,(b.type==='keep'?19:12)*scale,null,'#f1d187');
      if(g.config?.fogOfWar&&b.type==='tower'){const radius=g.vision.sightRadius(b);c.strokeStyle='#9fcac7';c.globalAlpha=.6;c.setLineDash([8/v.zoom,6/v.zoom]);c.beginPath();c.ellipse(p.x,p.y,radius*HW*Math.SQRT2,radius*HH*Math.SQRT2,0,0,TAU);c.stroke();}if(b.rally){const q=iso(b.rally.x,b.rally.y);c.globalAlpha=.5;c.setLineDash([5/v.zoom,5/v.zoom]);line(c,p.x,p.y,q.x,q.y,'#d9ce91',1/v.zoom);rallies.set(`${b.rally.x},${b.rally.y}`,q);}c.restore();
    }
    for(const p of rallies.values()){c.save();c.strokeStyle='#f4d38b';c.lineWidth=1.8/v.zoom;c.beginPath();c.ellipse(p.x,p.y,13,6,0,0,TAU);c.stroke();this.flag(c,p.x,p.y-2,'#e8c377',g.time,.7);c.restore();}
    if(ui.orderMarker){const m=ui.orderMarker,wall=globalThis.performance?.now()??Date.now(),age=g.remote?(wall-(m.wallStartedAt??=wall))/1000:g.time-m.time;if(age<1.7&&age>=0){const p=iso(m.x,m.y),a=1-age/1.7;c.globalAlpha=a;c.beginPath();c.ellipse(p.x,p.y,13+age*9,6+age*4,0,0,TAU);c.strokeStyle=m.mode==='move'?'#c2e0ce':'#edca78';c.lineWidth=2;if(m.pending)c.setLineDash([4/v.zoom,4/v.zoom]);c.stroke();c.setLineDash([]);line(c,p.x-4,p.y,p.x+4,p.y,'#ead89c',1.5);line(c,p.x,p.y-4,p.x,p.y+4,'#ead89c',1.5);c.globalAlpha=1;}}
    if(ui.facingPreview)this.facingPreview(c,g,ui.facingPreview,v.zoom);
    const items=[],visibleTroops=[];
    this.hoofCells?.clear();
    this.meleeArcs=0;
    const selectedColumns=new Map();
    if(layerScenery){
      const decorRange=this.visibleWorldRange(g,{...bounds,bottom:bounds.bottom+112});
      for(let cy=Math.floor(decorRange.y0/16);cy<=Math.floor(decorRange.y1/16);cy++)for(let cx=Math.floor(decorRange.x0/16);cx<=Math.floor(decorRange.x1/16);cx++){
        for(const z of this.decorChunks.get(cx+','+cy)||[]){
          const p=iso(z.x,z.y),scale=z.scale*(z.kind==='bush'?.38:1);
          if(p.x+48*scale>bounds.left&&p.x-48*scale<bounds.right&&p.y+12*scale>bounds.top&&p.y-100*scale<bounds.bottom){
            items.push({depth:p.y,kind:0,obj:z,p,scale});
          }
        }
      }
    }
    for(const b of scene.buildings){if(b.hp<=0)continue;const p=iso(b.x,b.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:1,obj:b});}
    const poseMix=ui.localPoseMix;
    for(const u of scene.units){if(u.hp<=0)continue;
      let x=u.x,y=u.y;
      const mix=poseMix==null?1:unitPresentationMix(u,poseMix);
      if(mix<1){
        x=u.previousRenderX+(x-u.previousRenderX)*mix;
        y=u.previousRenderY+(y-u.previousRenderY)*mix;
      }
      const p=iso(x,y);
      const pad=u.type==='dragon'?Math.max(110,(u.attackVisual?.distance||0)*40):0;
      if(p.x>bounds.left-pad&&p.x<bounds.right+pad&&p.y>bounds.top-pad&&p.y<bounds.bottom+pad){
        items.push({depth:p.y,kind:2,obj:u,p,x,y,phase:unitPresentationPhase(g,u,mix)});
        visibleTroops.push(u);
        if(layerScenery&&ui.selected?.has(u.id)){
          const column=Math.floor(p.x/48);
          if(!selectedColumns.has(column))selectedColumns.set(column,[]);
          selectedColumns.get(column).push(p);
        }
      }
    }
    for(const objective of scene.objectives){const p=iso(objective.x,objective.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:3,obj:objective});}
    for(const site of scene.castles){if(!site.ruined)continue;const p=iso(site.x,site.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:4,obj:site});}
    for(const standard of g.standards||[]){
      if(standard.state==='carrying'||standard.carrierId!=null)continue;
      const handling=g.byId?.get(standard.handlingHeroId);if(handling&&heroOwnsVisibleStandard(handling,g))continue;
      if(standard.state==='fallen'&&g.aftermath?.bodies?.some(body=>body.type==='hero'&&body.standardId===standard.id&&body.heroMode!=='signature'&&g.time-(body.bornAt??-Infinity)<.65))continue;
      // Owners always know their standard's location; this does not reveal
      // nearby terrain or enemy units through the vision system.
      if(g.config?.fogOfWar&&!g.isVisibleTo((g.playerTeam??0),standard))continue;
      const p=iso(standard.x,standard.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:5,obj:standard});
    }
    if(this.bridgeArtwork?.spanReady)this.bridgeArtwork.queueParapets(items,visibleTroops,g);
    items.sort((a,b)=>a.depth-b.depth||a.kind-b.kind);
    const selectionMarkers=this.selectionMarkers(visibleTroops,ui.selected,v.zoom);
    const shadows=!lowDetail&&v.zoom>=.75&&visibleTroops.length<=180;
    for(const it of items){if(it.kind===0){
      const z=it.obj,image=this.treeSprite(z.kind,z.variant),s=it.scale,p=it.p;
      if(!image)continue;
      if(z.kind==='tree'||z.kind==='woodland'){
        // Fade only foliage in front of a selected unit. The trunk's foot is the
        // same depth key used by soldiers, even while the crown bends in the wind.
        const reach=29*s+9;
        let overSelection=false;
        for(let column=Math.floor((p.x-reach)/48);column<=Math.floor((p.x+reach)/48)&&!overSelection;column++){
          overSelection=selectedColumns.get(column)?.some(foot=>foot.y<p.y&&foot.y>=p.y-90*s&&Math.abs(foot.x-p.x)<reach);
        }
        const wind=.014*Math.sin(g.time*1.3+z.x*.37+z.y*.23)+.008*Math.sin(g.time*.57+z.y*.41);
        c.save();c.translate(p.x,p.y);c.transform(1,0,wind,1,0,0);
        c.globalAlpha=overSelection?.42:1;
        c.drawImage(image,-48*s,-100*s,96*s,112*s);c.restore();
      }else c.drawImage(image,p.x-48*s,p.y-100*s,96*s,112*s);
    }else if(it.kind===6)this.bridgeArtwork.drawParapet(c,it);else if(it.kind===1){if(it.obj.remembered)this.rememberedBuilding(c,it.obj,g);else this.building(c,it.obj,g);}else if(it.kind===2)this.unit(c,it.obj,g,ui,v.zoom,selectionMarkers,it.p,it.x,it.y,it.phase,shadows);else if(it.kind===4)this.castleRuin(c,it.obj,g,v.zoom);else if(it.kind===5)this.battleStandard(c,it.obj,g);else this.objectiveFlag(c,it.obj,g,v.zoom);}
    (this.formationBannerLayer??=new FormationBannerLayer()).draw(c,visibleTroops,g.teams,{source:g,time:g.time,zoom:v.zoom,bounds,selected:ui.selected,lowDetail,visible:u=>!g.config?.fogOfWar||g.isVisibleTo((g.playerTeam??0),u),drawCrest:(ctx,team,x,y,size)=>this.drawHouseCrest(ctx,team,x,y,size)});
    this.projectiles(c,g,bounds);this.effects(c,g,lowDetail,bounds,combatEffects);this.drawFog(c,g);
    this.drawSelectedProduction(c,g,ui,v,bounds);
    if(g.config?.fogOfWar)for(const standard of g.standards||[]){if(standard.team===(g.playerTeam??0)&&standard.carrierId==null&&!g.isVisibleTo((g.playerTeam??0),standard)&&!(standard.handlingHeroId!=null&&heroOwnsVisibleStandard(g.byId?.get(standard.handlingHeroId),g)))this.battleStandard(c,standard,g);}
    this.teamOrderMarkers(c,g,v.zoom);
    if(ui.teamOrderMode&&ui.hover){const p=iso(ui.hover.x,ui.hover.y),color=ui.teamOrderMode==='defend'?'#8fdfca':'#f3b77c';c.save();c.strokeStyle=color;c.lineWidth=2/v.zoom;c.setLineDash([5/v.zoom,4/v.zoom]);diamond(c,p.x,p.y,32,16,null,color);c.setLineDash([]);this.flag(c,p.x,p.y,color,g.time,.8);c.restore();}
    if(ui.hover&&ui.hover.x>=0&&ui.hover.y>=0&&ui.hover.x<g.W&&ui.hover.y<g.H){const tx=Math.floor(ui.hover.x),ty=Math.floor(ui.hover.y),p=iso(tx+.5,ty+.5),tile=g.tiles[ty*g.W+tx];c.lineWidth=1.2;diamond(c,p.x,p.y,HW,HH,null,ui.buildMode?(tile.owner===(g.playerTeam??0)&&g.isWalkable(tx+.5,ty+.5)&&!['bridge','ford','pass'].includes(tile.feature)?'#e8d38a':'#e28a71'):'rgba(229,223,174,.6)');if(ui.buildMode){c.globalAlpha=.55;this.building(c,{type:ui.buildMode,x:tx+.5,y:ty+.5,team:(g.playerTeam??0),hp:1,maxHp:1},g);c.globalAlpha=1;}}
    if(ui.advancePreview)this.advancePreview(c,ui.advancePreview,v.zoom);
    c.restore();
    c.fillStyle=lighting.vignette;c.fillRect(0,0,v.w,v.h);
    if(ui.drag){const r=ui.drag,x=Math.min(r.x0,r.x1),y=Math.min(r.y0,r.y1),w=Math.abs(r.x1-r.x0),h=Math.abs(r.y1-r.y0);c.fillStyle='rgba(221,208,140,.08)';c.fillRect(x,y,w,h);c.strokeStyle='#e0cc83';c.lineWidth=1;c.setLineDash([4,3]);c.strokeRect(x+.5,y+.5,w,h);c.setLineDash([]);}
  }
  drawMinimap(g,canvas,v){
    if(!this.terrainReady)return;if(this.cachedGame!==g)this.prepare(g);const scene=this.fogScene(g);if(g.config?.fogOfWar&&this.territoryVisionRevision!==g.vision.revision){this.updateTerritory(g);this.territoryVisionRevision=g.vision.revision;}
    const rect=canvas.getBoundingClientRect(),w=Math.max(50,Math.round(rect.width||200)),h=Math.max(50,Math.round(rect.height||140)),d=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
    const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);const scale=Math.min((w-14)/((g.W+g.H)*HW),(h-14)/((g.W+g.H)*HH)),ox=(w-(g.W-g.H)*HW*scale)/2,oy=(h-(g.W+g.H)*HH*scale)/2;
    this.minimapTransform={scale,ox,oy,width:w,height:h};
    if(!this.miniBase||this.miniBase.width!==Math.round(w*d)||this.miniBase.height!==Math.round(h*d)||this.miniRevision!==this.minimapRevision){this.miniBase=makeCanvas(Math.round(w*d),Math.round(h*d));const m=this.miniBase.getContext('2d');m.scale(d,d);m.fillStyle='#10272c';m.fillRect(0,0,w,h);m.imageSmoothingEnabled=false;m.transform(HW*scale,HH*scale,-HW*scale,HH*scale,ox,oy);m.drawImage(this.miniTerrainPixels,0,0);m.globalAlpha=.78;m.drawImage(this.ownerPixels,0,0);m.globalAlpha=1;m.drawImage(this.miniFeaturePixels,0,0);this.miniRevision=this.minimapRevision;}
    c.drawImage(this.miniBase,0,0,w,h);const fog=this.fogPixels(g);if(fog){c.save();c.imageSmoothingEnabled=false;c.transform(HW*scale,HH*scale,-HW*scale,HH*scale,ox,oy);c.drawImage(fog,0,0);c.restore();}
    for(const b of scene.buildings){if(b.hp<=0||b.type!=='keep'&&!(g.config?.fogOfWar&&b.type==='tower'))continue;const p=iso(b.x,b.y),x=p.x*scale+ox,y=p.y*scale+oy,size=2+(b.level||1)*.5;c.globalAlpha=b.remembered?.45:1;c.fillStyle=g.teams[b.team]?.teamColor||g.teams[b.team]?.color||'#f3e4b0';c.fillRect(x-size,y-size,size*2,size*2);c.strokeStyle='#eee3bc';c.lineWidth=.65;c.strokeRect(x-size,y-size,size*2,size*2);}c.globalAlpha=1;
    for(const site of scene.castles){if(!site.ruined)continue;const p=iso(site.x,site.y),x=p.x*scale+ox,y=p.y*scale+oy;c.globalAlpha=site.remembered?.45:1;c.fillStyle=site.contested?'#efab7c':'#d6c59b';c.strokeStyle='#172f31';c.lineWidth=1;polygon(c,[[x,y-4],[x+4,y],[x,y+4],[x-4,y]],c.fillStyle,c.strokeStyle);}c.globalAlpha=1;
    for(const u of scene.units){if(u.hp<=0)continue;const p=iso(u.x,u.y),x=p.x*scale+ox,y=p.y*scale+oy;c.fillStyle=g.teams[u.team]?.color||'#ddd';c.globalAlpha=.9;c.fillRect(x-1,y-1,2,2);if(u.isKing){c.globalAlpha=1;polygon(c,[[x,y-5],[x+4,y],[x,y+5],[x-4,y]],g.teams[u.team]?.color||'#ddd','#f3d782');}}c.globalAlpha=1;
    for(const o of scene.objectives){const p=iso(o.x,o.y),x=p.x*scale+ox,y=p.y*scale+oy,team=g.teams.find(s=>s.alliance===o.controller),color=o.contested?'#f0ab77':team?.teamColor||'#edd490';line(c,x-2,y+3,x-2,y-5,'#f1ead2',1);polygon(c,[[x-1,y-5],[x+5,y-4],[x+3,y],[x-1,y-1]],color,'#153331');}
    for(const standard of g.standards||[]){if(standard.carrierId!=null||standard.state==='destroyed'||standard.team!==(g.playerTeam??0)&&g.config?.fogOfWar&&!g.isVisibleTo((g.playerTeam??0),standard))continue;const row=this.heroRows?.get(g.teams[standard.team]?.sigil);if(!row)continue;const p=iso(standard.x,standard.y);c.save();c.translate(p.x*scale+ox,p.y*scale+oy);c.scale(.22,.22);this.drawPaintedTroop(c,row,selectStandardFrame(standard,g),1,0,0);c.restore();}
    for(const order of g.teamOrders||[]){if(order.expiresAt<=g.time||order.alliance!==g.teams[g.playerTeam??0]?.alliance)continue;const p=iso(order.x,order.y),x=p.x*scale+ox,y=p.y*scale+oy,color=order.kind==='defend'?'#8fdfca':'#f3b77c';c.beginPath();c.arc(x,y,5,0,TAU);c.strokeStyle=color;c.lineWidth=1.2;c.stroke();line(c,x-3,y,x+3,y,color,1);line(c,x,y-3,x,y+3,color,1);}
    c.strokeStyle='#f1e0a7';c.lineWidth=1;c.strokeRect((v.x-v.w/v.zoom/2)*scale+ox,(v.y-v.h/v.zoom/2)*scale+oy,v.w/v.zoom*scale,v.h/v.zoom*scale);
  }
}
