import {BUILD_DEFS,UNIT_DEFS} from './core.js';

const HW=28, HH=14;
const TAU=Math.PI*2;
const HOUSE_ART_ORDER=['wolf','lion','dragon','stag','rose','sun','kraken','falcon','flayed','bridge','bear','fish','frog','beacon','huntsman','bone'];
const HOUSE_UNIT_CLASSES={wolf:'infantry',lion:'archer',dragon:'siege',stag:'cavalry',rose:'cavalry',sun:'archer',kraken:'infantry',falcon:'archer',flayed:'infantry',bridge:'infantry',bear:'infantry',fish:'archer',frog:'archer',beacon:'siege',huntsman:'archer',bone:'infantry'};
const REGIMENT_ART_TYPES=['shield_bearer','lance_champion'];
const REGIMENT_ART_HOUSES={wolf:'shield_bearer',lion:'shield_bearer',dragon:'shield_bearer',rose:'shield_bearer',bear:'lance_champion',sun:'lance_champion',falcon:'lance_champion'};
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
  async loadCampaignArt(src='./assets/campaign-structures.png'){
    this.campaignArtReady=false;
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The capital, watchtower and standard artwork could not be loaded.'));im.src=src;});
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
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The troop sprite atlas could not be loaded.'));im.src=src;});
      this.setTroopAtlas(image);return this.troopAtlasInfo;
    }catch(error){this.assetError=error;throw error;}
  }
  setTroopAtlas(image){
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(width<80||height<100)throw new Error('The troop atlas must contain eight columns and five rows.');
    // Actual RGBA sprite sheet: five unit classes, four walk and four attack frames.
    // Intrinsic dimensions are used because generated atlases need not be 1280 square.
    const types=['infantry','archer','cavalry','siege','hero'];
    const heights={infantry:28,archer:28,cavalry:37,siege:37,hero:35};
    const widths={infantry:20,archer:20,cavalry:31,siege:32,hero:24};
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
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The structure sprite atlas could not be loaded.'));im.src=src;});
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
    const load=src=>new Promise((resolve,reject)=>{if(!src)return reject(new Error('A house artwork source is missing.'));const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('House artwork could not be loaded: '+(src.startsWith('data:')?'embedded PNG':src)));image.src=src;});
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
      const largestWidth=Math.max(...frames.map(f=>f.width)),largestHeight=Math.max(...frames.map(f=>f.height)),size=sizes[HOUSE_UNIT_CLASSES[sigil]],scale=Math.min(size[0]/largestWidth,size[1]/largestHeight);
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
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The '+sigil+' regiment artwork could not be loaded.'));image.src=src;
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
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The house regiment production artwork could not be loaded.'));im.src=src;});
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
    const entries=await Promise.all(Object.entries(sources).map(async([key,src])=>[key,await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Castle conquest artwork could not be loaded: '+key));im.src=src;})]));
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
  getStructureFrame(type,houseSigil=null,level=1){
    if(CONQUEST_ART_BUILDINGS.includes(type))return this.conquestArtReady&&BUILD_DEFS[type]?.house===houseSigil?this.conquestBuildingFrames[type]:null;
    if(type==='restored_castle')return this.conquestArtReady?this.castleStateFrames[1]:null;
    const definition=BUILD_DEFS[type];
    if(definition?.regimentBuilding)return this.regimentBuildingsReady&&definition.house===houseSigil?this.regimentBuildingFrames[houseSigil]||null:null;
    if(this.campaignArtReady&&(type==='keep'||type==='tower'))return this.campaignFrames[type][clamp(Math.floor(level)||1,1,3)-1];
    if(houseSigil&&this.houseArtReady){if(type==='keep')return this.houseKeepFrames[houseSigil]||this.structureFrames.keep;if(!this.structureFrames[type])return this.houseProductionFrames[houseSigil]||null;}
    return this.structureFrames[type]||null;
  }
  getTroopFrame(type,houseSigil=null){
    if(CONQUEST_ART_HOUSES[type])return this.conquestArtReady&&CONQUEST_ART_HOUSES[type].includes(houseSigil)?this.conquestTroopFrames[type]:null;
    if(REGIMENT_ART_TYPES.includes(type))return this.regimentArtReady?this.regimentTroopFrames[type]?.[houseSigil]||null:null;
    return this.troopFrames[type]||(houseSigil&&this.houseArtReady?this.houseTroopFrames[houseSigil]:null)||null;
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
    this.terrainReady=false;const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The terrain artwork could not be loaded.'));im.src=src;});
    const [ground,props]=await Promise.all([load(groundSrc),load(propsSrc)]);return this.setTerrainAtlases(ground,props);
  }
  async loadLandsArt(src='./assets/lands-atlas.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The Lands Update artwork could not be loaded.'));im.src=src;});
    this.landsFrames={};
    ['mountain','woodland','stoneBridge','woodBridge','pass','ford','waymarker','ruin'].forEach((kind,i)=>{const f=atlasCell(image,i%4,Math.floor(i/4),4,2,'Lands '+kind),c=f.image.getContext('2d',{willReadFrequently:true}),pixels=c.getImageData(0,0,f.image.width,f.image.height),data=pixels.data;for(let p=0;p<data.length;p+=4){if(data[p]>180&&data[p]>data[p+1]*1.8&&data[p]>data[p+2]*1.8)data[p+3]=0;}c.putImageData(pixels,0,0);this.landsFrames[kind]=f;});
    this.landsArtReady=true;this.treeSprites.clear();this.terrainChunkCache.clear();this.cachedGame=null;
    return {source:src,columns:4,rows:2,classes:Object.keys(this.landsFrames)};
  }
  async loadLandsGround(src='./assets/lands-ground.png'){
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The Lands ground textures could not be loaded.'));im.src=src;});
    this.landsGroundFrames={};const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    ['water','road','bridge','ford','pass','mountain','bank','timber'].forEach((kind,i)=>{const sx=Math.floor(i%4*w/4),sy=Math.floor(Math.floor(i/4)*h/2),sw=Math.floor((i%4+1)*w/4)-sx,sh=Math.floor((Math.floor(i/4)+1)*h/2)-sy,a=makeCanvas(sw,sh);a.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,sw,sh);this.landsGroundFrames[kind]=a;});
    this.terrainTileSprites.clear();this.terrainChunkCache.clear();this.cachedGame=null;return {source:src,columns:4,rows:2,classes:Object.keys(this.landsGroundFrames)};
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
    this.sceneryChunkCache=new Map();this.sceneryChunkBytes=0;
    this.terrainChunkCache.clear();this.decor=[];this.decorChunks=new Map();this.miniBase=null;this.miniTerrainPixels=makeCanvas(g.W,g.H);const miniCtx=this.miniTerrainPixels.getContext('2d'),miniData=miniCtx.createImageData(g.W,g.H);
    for(const t of g.tiles){const r=hash(t.x,t.y),i=(t.y*g.W+t.x)*4,color=t.feature==='bridge'?[218,197,142]:t.feature==='ford'?[131,174,169]:t.feature==='road'?[180,159,108]:t.feature==='pass'?[177,168,136]:t.terrain==='mountain'?[102,105,101]:t.terrain==='water'?[35,100,116]:t.terrain==='forest'?[48,71,37]:t.terrain==='hill'?[114,105,75]:[91,115,52];miniData.data.set([...color,255],i);if(t.feature||t.terrain==='water')continue;
      if(t.terrain==='mountain'){
        if(t.x%2===0&&t.y%2===0||r>.96)this.decor.push({x:t.x+.5,y:t.y+.5,kind:'mountain',variant:Math.floor(r*8),scale:.8+r*.32});
        continue;
      }
      if(t.terrain==='forest'){
        if(r>.17)this.decor.push({x:t.x+.23+hash(t.x*2,t.y)*.5,y:t.y+.15+hash(t.x,t.y*3)*.65,kind:this.landsArtReady&&r>.82?'woodland':'tree',variant:Math.floor(hash(t.x,t.y)*6),scale:.72+hash(t.x*3,t.y)*.35});
      }else if(t.terrain==='hill'){
        if(r>.58)this.decor.push({x:t.x+.2,y:t.y+.15,kind:'rock',variant:Math.floor(r*3),scale:.48+r*.45});
      }else if(r>.94){this.decor.push({x:t.x+.05,y:t.y+.08,kind:'bush',variant:0,scale:.6+r*.2});}
    }
    for(const mark of g.landmarks||[]){if(mark.kind==='pass'||mark.kind==='road')this.decor.push({x:mark.x+.48,y:mark.y-.48,kind:mark.kind==='pass'?'pass':'waymarker',variant:0,scale:.7});}
    miniCtx.putImageData(miniData,0,0);this.miniFeaturePixels=makeCanvas(g.W,g.H);const fc=this.miniFeaturePixels.getContext('2d'),fd=fc.createImageData(g.W,g.H);for(const t of g.tiles)if(t.feature){const i=(t.y*g.W+t.x)*4;fd.data.set(miniData.data.subarray(i,i+4),i);}fc.putImageData(fd,0,0);this.ownerPixels=makeCanvas(g.W,g.H);this.ownerImageData=this.ownerPixels.getContext('2d').createImageData(g.W,g.H);this.clearBuildingSites(g);this.territoryTime=-1;this.buildOverview(g);this.updateTerritory(g);
    // Prime the opening artwork while the map is preparing, so the first jump
    // to a distant capital does not pay for faction-tint pixel readbacks.
    for(const team of g.teams){for(const type of ['infantry','archer','cavalry','siege','hero'])this.soldierSprite(type,team.color,team.dark,1,0,false);for(const type of ['keep','barracks','range'])this.structureSprite(type,team.color,team.sigil);const house=g.houseContent?.(team.id);if(house){this.soldierSprite(house.unit,team.color,team.dark,1,0,false,team.sigil);this.structureSprite(house.building,team.color,team.sigil);}}
  }
  fogScene(g){
    if(!g.config?.fogOfWar)return {buildings:g.buildings,units:g.units,castles:g.castles||[],objectives:g.objectives||[]};
    return {buildings:g.knownBuildings(0),units:g.knownUnits(0),castles:g.knownCastleSites(0),objectives:(g.objectives||[]).map(o=>g.isVisibleTo(0,o)?o:{...o,progress:[],controller:null,contested:false,cooldownUntil:0})};
  }
  fogPixels(g){
    if(!g.config?.fogOfWar||!g.vision)return null;
    if(this.fogGame===g&&this.fogRevision===g.vision.revision)return this.fogImage;
    if(this.fogGame!==g){this.fogImage=makeCanvas(g.W,g.H);this.fogGame=g;}
    const c=this.fogImage.getContext('2d'),pixels=c.createImageData(g.W,g.H),visible=g.vision.gridFor(0),explored=g.vision.exploredFor(0);
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
    this.sceneryChunkCache?.clear();this.sceneryChunkBytes=0;
    this.decorOverviewDirty=true;
  }
  buildOverview(g){
    this.overviewScale=Math.min(.32,2048/this.mapW);const s=this.overviewScale,w=Math.ceil(this.mapW*s),h=Math.ceil(this.mapH*s);this.terrainOverview=makeCanvas(w,h);this.decorOverview=makeCanvas(w,h);const c=this.terrainOverview.getContext('2d');c.scale(s,s);c.translate(-this.left,-this.top);
    for(const t of g.tiles){const p=iso(t.x+.5,t.y+.5),tile=this.landsTileSprite(g,t);c.drawImage(tile,p.x-HW-1,p.y-HH-1,58,33);}
    this.rebuildDecorOverview();
    // Resolve the offscreen snapshots during preparation, rather than making
    // the first overview-camera jump perform a large deferred raster upload.
    const primer=makeCanvas(2,2),pc=primer.getContext('2d');pc.drawImage(this.terrainOverview,0,0,2,2);pc.drawImage(this.decorOverview,0,0,2,2);
  }
  rebuildDecorOverview(){const d=this.decorOverview.getContext('2d'),s=this.overviewScale;d.setTransform(1,0,0,1,0,0);d.clearRect(0,0,this.decorOverview.width,this.decorOverview.height);d.scale(s,s);d.translate(-this.left,-this.top);for(const z of [...this.decor].sort((a,b)=>a.x+a.y-b.x-b.y)){const p=iso(z.x,z.y),a=this.treeSprite(z.kind,z.variant),scale=z.scale*(z.kind==='bush'?.38:1);if(a)d.drawImage(a,p.x-48*scale,p.y-100*scale,96*scale,112*scale);}this.decorOverviewDirty=false;}
  terrainChunk(g,cx,cy){
    const key=cx+','+cy;let ch=this.terrainChunkCache.get(key);if(ch){this.terrainChunkCache.delete(key);this.terrainChunkCache.set(key,ch);return ch;}
    const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16),left=(x0-y1)*HW-2,top=(x0+y0)*HH-2,w=(x1-x0+y1-y0)*HW+4,h=(x1-x0+y1-y0)*HH+7,a=makeCanvas(w,h),c=a.getContext('2d');c.translate(-left,-top);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const t=g.tiles[y*g.W+x],p=iso(x+.5,y+.5),tile=this.landsTileSprite(g,t);c.drawImage(tile,p.x-HW-1,p.y-HH-1,58,33);}
    ch={image:a,left,top,width:w,height:h};this.terrainChunkCache.set(key,ch);while(this.terrainChunkCache.size>this.maxTerrainChunks)this.terrainChunkCache.delete(this.terrainChunkCache.keys().next().value);return ch;
  }
  visibleWorldRange(g,bounds){const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]].map(([x,y])=>({x:(x/HW+y/HH)/2,y:(y/HH-x/HW)/2}));return{x0:clamp(Math.floor(Math.min(...points.map(p=>p.x)))-1,0,g.W-1),x1:clamp(Math.ceil(Math.max(...points.map(p=>p.x)))+1,0,g.W-1),y0:clamp(Math.floor(Math.min(...points.map(p=>p.y)))-1,0,g.H-1),y1:clamp(Math.ceil(Math.max(...points.map(p=>p.y)))+1,0,g.H-1)};}
  drawStrategicScenery(c,range,bounds){
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
  drawGround(c,g,v,bounds,range){
    if(v.zoom<.75)c.drawImage(this.terrainOverview,this.left,this.top,this.mapW,this.mapH);
    else for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++){
      const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16),left=(x0-y1)*HW,right=(x1-y0)*HW,top=(x0+y0)*HH,bottom=(x1+y1)*HH+6;if(right<bounds.left||left>bounds.right||bottom<bounds.top||top>bounds.bottom)continue;const ch=this.terrainChunk(g,cx,cy);c.drawImage(ch.image,ch.left,ch.top);
    }
    if(v.zoom>.48&&!this.lowDetail)for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const t=g.tiles[y*g.W+x];if(t.terrain!=='water'||t.feature||hash(x,y)<.55)continue;const p=iso(x+.5,y+.5),drift=Math.sin(g.time*.7+x+y)*3;c.globalAlpha=.12+Math.sin(g.time*.8+x*.4+y*.7)*.06;line(c,p.x-5+drift,p.y,p.x+6+drift,p.y-.7,'#c5e6d9',.8);c.globalAlpha=1;}
    c.save();c.globalAlpha=.16;c.imageSmoothingEnabled=false;c.transform(HW,HH,-HW,HH,0,0);c.drawImage(this.ownerPixels,0,0);c.restore();
    const width=v.zoom<.45?1.2/v.zoom:1.35;for(const e of this.territoryEdges){if(Math.max(e.x1,e.x2)<bounds.left||Math.min(e.x1,e.x2)>bounds.right||Math.max(e.y1,e.y2)<bounds.top||Math.min(e.y1,e.y2)>bounds.bottom)continue;line(c,e.x1,e.y1,e.x2,e.y2,e.color,width);}
    if(v.zoom<.42){if(this.decorOverviewDirty)this.rebuildDecorOverview();c.drawImage(this.decorOverview,this.left,this.top,this.mapW,this.mapH);}
    else if(v.zoom<.75){if(v.w/v.zoom>4500||v.h/v.zoom>2800){if(this.decorOverviewDirty)this.rebuildDecorOverview();c.drawImage(this.decorOverview,this.left,this.top,this.mapW,this.mapH);}else this.drawStrategicScenery(c,range,bounds);}
    this.drawBridgeArchitecture(c,g,range);
  }
  drawBridgeArchitecture(c,g,range){
    // Bridge masonry is static. Rasterize each occupied chunk once instead of
    // scanning every visible tile and rebuilding hundreds of paths every frame.
    if(!this.bridgeArchitectureCache||this.bridgeArchitectureGame!==g){this.bridgeArchitectureCache=new Map();this.bridgeArchitectureGame=g;this.bridgeArchitectureBytes=0;}
    for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++){
      const key=cx+','+cy;let chunk=this.bridgeArchitectureCache.get(key);
      if(chunk===undefined){
        const x0=cx*16,y0=cy*16,x1=Math.min(g.W,x0+16),y1=Math.min(g.H,y0+16);let occupied=false,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(g.tiles[y*g.W+x].feature==='bridge'){const p=iso(x+.5,y+.5);occupied=true;left=Math.min(left,p.x-HW);right=Math.max(right,p.x+HW);top=Math.min(top,p.y-HH);bottom=Math.max(bottom,p.y+HH);}
        if(!occupied){this.bridgeArchitectureCache.set(key,null);continue;}
        left-=12;top-=12;const width=right-left+24,height=bottom-top+32;
        const image=makeCanvas(width*2,height*2),ctx=image.getContext('2d');ctx.scale(2,2);ctx.translate(-left,-top);
        this.paintBridgeArchitecture(ctx,g,{x0,y0,x1:x1-1,y1:y1-1});
        chunk={image,left,top,width,height,bytes:image.width*image.height*4};this.bridgeArchitectureCache.set(key,chunk);this.bridgeArchitectureBytes+=chunk.bytes;
        while(this.bridgeArchitectureBytes>32*1024*1024&&this.bridgeArchitectureCache.size>1){const oldest=this.bridgeArchitectureCache.keys().next().value,entry=this.bridgeArchitectureCache.get(oldest);this.bridgeArchitectureBytes-=entry?.bytes||0;this.bridgeArchitectureCache.delete(oldest);}
      }
      else if(chunk){this.bridgeArchitectureCache.delete(key);this.bridgeArchitectureCache.set(key,chunk);}
      if(chunk)c.drawImage(chunk.image,chunk.left,chunk.top,chunk.width,chunk.height);
    }
  }
  paintBridgeArchitecture(c,g,range){
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
    const c=this.ownerPixels.getContext('2d'),data=this.ownerImageData.data,colors=g.teams.map(t=>[parseInt(t.color.slice(1,3),16),parseInt(t.color.slice(3,5),16),parseInt(t.color.slice(5,7),16)]),owners=g.config?.fogOfWar?g.vision.ownersFor(0):null,ownerAt=t=>t?(owners?owners[t.y*g.W+t.x]:t.owner):-1;data.fill(0);this.territoryEdges=[];
    for(const t of g.tiles){const owner=ownerAt(t);if(owner<0||!g.isWalkable(t.x+.5,t.y+.5))continue;const team=g.teams[owner];if(!team)continue;const i=(t.y*g.W+t.x)*4;data.set([...colors[owner],255],i);const p=iso(t.x+.5,t.y+.5);
      const corners=[[p.x,p.y-HH],[p.x+HW,p.y],[p.x,p.y+HH],[p.x-HW,p.y]];
      const checks=[[t.x,t.y-1,0],[t.x+1,t.y,1],[t.x,t.y+1,2],[t.x-1,t.y,3]];
      for(const [x,y,e]of checks){const nt=x>=0&&y>=0&&x<g.W&&y<g.H?g.tiles[y*g.W+x]:null;if(ownerAt(nt)!==owner){const a=corners[e],b=corners[(e+1)%4];this.territoryEdges.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1],color:team.color});}}
    }
    c.putImageData(this.ownerImageData,0,0);this.territoryTime=g.time;this.minimapRevision=(this.minimapRevision||0)+1;
  }
  treeSprite(kind,variant=0){
    if(['mountain','woodland','stoneBridge','woodBridge','pass','ford','waymarker','ruin'].includes(kind))return this.landsPropSprite(kind,variant);
    return this.terrainPropSprite(kind==='rock'?'rock':kind==='bush'?'oak':variant%3===0?'oak':'pine',variant);
  }
  soldierSprite(type,color,dark,dir,frame,attack=false,specialHouse=null){
    if(!this.rasterSpritesReady&&!this.houseArtReady&&!this.regimentArtReady&&!this.conquestArtReady)return null;
    const row=this.getTroopFrame(type,specialHouse)||((REGIMENT_ART_TYPES.includes(type)||CONQUEST_ART_HOUSES[type])?null:this.troopFrames[HOUSE_UNIT_CLASSES[specialHouse]]||this.troopFrames.infantry);if(!row)return null;const index=(attack?4:0)+clamp(Math.floor(frame),0,3);
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
    for(const order of g.teamOrders||[]){if(order.expiresAt<=g.time||order.alliance!==g.teams[0]?.alliance)continue;const p=iso(order.x,order.y),defend=order.kind==='defend',color=defend?'#8fdfca':'#f3b77c',countdown=Math.max(0,Math.ceil(order.launchAt-g.time)),scale=clamp(1/zoom,.8,2);
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
    if(sprite){if(f.campaign)c.drawImage(sprite,-w/2,12-h,w,h);else c.drawImage(sprite,-70,-134,140,160);}
    // The painted structure is a genuine PNG; lightweight overlays animate its life.
    const flagPin={keep:[.045,.84,.65],barracks:[.15,.76,.43],range:[.11,.8,.42],stables:[-.15,.68,.35],tower:[0,.84,.56],workshop:[-.25,.65,.35]}[b.type]||[.12,.83,.4];
    if(!f.campaign)this.flag(c,w*flagPin[0],12-h*flagPin[1],team.teamColor||color,t,flagPin[2]);
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
    const health=clamp(b.hp/b.maxHp,0,1);
    if(health<.45){for(let k=0;k<(this.lowDetail?1:3);k++){const z=(t*.42+k*.32)%1;c.save();c.globalAlpha*=(1-z)*.32;ellipse(c,Math.sin(t+k)*5,12-h*.55-z*26,2+z*7,3+z*6,'#4b4e49');c.restore();}}
    c.restore();
    if(keep||tower){const bw=keep?52+level*8:66,y=f.campaign?20:level>1?42:24;
      c.fillStyle='rgba(12,31,33,.93)';c.fillRect(-bw/2-3,y-2,bw+6,20);c.strokeStyle=team.teamColor||color;c.lineWidth=.8;c.strokeRect(-bw/2-3,y-2,bw+6,20);
      c.fillStyle='#29403d';c.fillRect(-bw/2,y+12,bw,3);c.fillStyle=(g.allied?.(b.team,0)??b.team===0)?'#a8d3ad':'#e2a080';c.fillRect(-bw/2,y+12,bw*health,3);
      c.textAlign='center';c.font='bold 8px Segoe UI';c.fillStyle='#efe0b2';c.fillText(`${(keep?['','HALL I','KEEP II','CITADEL III']:['','WATCH I','GUARD II','ROYAL III'])[level]} · ${Math.ceil(Math.max(0,b.hp))}`,0,y+7);
    }else if(health<1){const bw=35;c.fillStyle='#10292a';c.fillRect(-bw/2,15,bw,3);c.fillStyle=(g.allied?.(b.team,0)??b.team===0)?'#a2c8a1':'#d39b7f';c.fillRect(-bw/2,15,bw*health,3);}
    c.restore();
  }
  drawTownHallPortrait(canvas,team,level=1){
    this.drawStructurePortrait(canvas,'keep',team,level);
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
  unit(c,u,g,ui,zoom){
    if(!this.rasterSpritesReady&&!this.houseArtReady&&!this.regimentArtReady&&!this.conquestArtReady)return;
    const p=iso(u.x,u.y),team=g.teams[u.team];if(!team)return;const specialHouse=REGIMENT_ART_TYPES.includes(u.type)||CONQUEST_ART_HOUSES[u.type]||g.houseContent?.(u.team)?.unit===u.type?team.sigil:null,unitClass=g.unitClass?.(u)||HOUSE_UNIT_CLASSES[specialHouse]||u.type,vx=Number.isFinite(u.motionVX)?u.motionVX:(u.vx||0),vy=Number.isFinite(u.motionVY)?u.motionVY:(u.vy||0),selected=ui.selected?.has(u.id),moving=Math.hypot(vx,vy)>.07;
    if(g.mode?.teams&&zoom>.32){const color=team.teamColor||team.color;c.save();c.globalAlpha=.55;ellipse(c,p.x,p.y+2,unitClass==='cavalry'?8:5,unitClass==='cavalry'?3.3:2.2,color);c.globalAlpha=.95;polygon(c,[[p.x-2,p.y+2],[p.x,p.y+4],[p.x+2,p.y+2],[p.x,p.y]],team.color);c.restore();}
    if(u.elite){c.save();c.beginPath();c.ellipse(p.x,p.y+1,unitClass==='cavalry'?11:8,unitClass==='cavalry'?5:3.8,0,0,TAU);c.strokeStyle='#f4d785';c.lineWidth=1.4;c.stroke();if(zoom>.45){polygon(c,[[p.x,p.y-37],[p.x+2,p.y-33],[p.x+6,p.y-32],[p.x+2,p.y-30],[p.x,p.y-26],[p.x-2,p.y-30],[p.x-6,p.y-32],[p.x-2,p.y-33]],'#ffe7a0','#7f6b3f');}c.restore();}
    if(unitClass==='cavalry'&&u.charging&&moving&&zoom>.35){
      const speed=Math.hypot(vx,vy),dir=u.chargeDir||{x:vx/(speed||1),y:vy/(speed||1)},screenDir=iso(dir.x,dir.y),len=Math.hypot(screenDir.x,screenDir.y)||1,dx=screenDir.x/len,dy=screenDir.y/len,momentum=clamp(u.momentum??.6,0,1),count=this.lowDetail?3:6;
      c.save();for(let k=0;k<count;k++){const drift=((g.time*7+u.id*.37+k*.27)%1),distance=8+k*8+drift*7,x=p.x-dx*distance,y=p.y-dy*distance+Math.sin(u.id+k)*3;c.globalAlpha=(.32-k*.035)*(1-drift*.55)*momentum;ellipse(c,x,y,4+k*1.7,2.2+k*.7,'#c5b88b');}c.globalAlpha=.4+momentum*.25;line(c,p.x-dx*15-2,p.y-dy*15-6,p.x-dx*34-2,p.y-dy*34-6,'#f2d391',1.2);if(!this.lowDetail)line(c,p.x-dx*17+3,p.y-dy*17-2,p.x-dx*43+3,p.y-dy*43-2,'#d9cfaa',1);c.restore();
    }
    if(selected){ellipse(c,p.x,p.y+1,unitClass==='cavalry'?11:8,unitClass==='cavalry'?5:3.8,'rgba(224,215,144,.19)');c.beginPath();c.ellipse(p.x,p.y+1,unitClass==='cavalry'?11:8,unitClass==='cavalry'?5:3.8,0,0,TAU);c.strokeStyle='#f6d986';c.lineWidth=1;c.stroke();}
    if(u.type==='hero'){c.beginPath();c.ellipse(p.x,p.y+1,11,5,0,0,TAU);c.strokeStyle='#e5cb74';c.lineWidth=1.5;c.stroke();}
    const direction=u.braceDir||(Number.isFinite(u.facingX)&&Number.isFinite(u.facingY)?{x:u.facingX,y:u.facingY}:{x:vx,y:vy}),screenFacing=iso(direction.x,direction.y),faceLength=Math.hypot(screenFacing.x,screenFacing.y)||1;
    const facing=screenFacing.x<-.03?-1:1,attack=(u.attackAnim||0)>.05;
    const phase=Number.isFinite(u.phase)?u.phase:0;let frame=attack?Math.min(3,Math.floor((1-clamp(u.attackAnim,0,1))*4)):moving?Math.floor(phase/TAU*4):0;frame=((frame%4)+4)%4;
    if(u.backpedaling&&moving&&!attack)frame=3-frame;
    const braced=zoom>.6&&u.braceDir&&(u.braceTime||0)>=.45&&!(u.knockT>0);
    const sprite=this.soldierSprite(u.type,team.color,team.dark,facing,frame,attack||u.type==='trebuchet'&&(u.setupProgress||0)>=UNIT_DEFS.trebuchet.setupSeconds,specialHouse);if(sprite)c.drawImage(sprite,p.x-32,p.y-64,64,72);
    if(u.type==='trebuchet'&&zoom>.5){const setup=UNIT_DEFS.trebuchet.setupSeconds,progress=clamp((u.setupProgress||0)/setup,0,1);c.fillStyle='#142c2c';c.fillRect(p.x-20,p.y-61,40,4);c.fillStyle=progress>=1?'#b8d4a0':'#d6b773';c.fillRect(p.x-20,p.y-61,40*progress,4);if(selected){c.font='bold 8px Segoe UI';c.textAlign='center';c.fillStyle='#f2deac';c.fillText(progress>=1?'DEPLOYED':'SETUP '+Math.ceil(setup-(u.setupProgress||0))+'s',p.x,p.y-65);}}
    if(selected&&zoom>.55&&Math.hypot(direction.x,direction.y)>.01){
      const dx=screenFacing.x/faceLength,dy=screenFacing.y/faceLength,color=u.backpedaling?'#a8ddd1':'#e7cc89';
      c.save();c.globalAlpha=.85;line(c,p.x+dx*9,p.y+1+dy*9,p.x+dx*17,p.y+1+dy*17,color,1.2);
      line(c,p.x+dx*17,p.y+1+dy*17,p.x+dx*13-dy*2.5,p.y+1+dy*13+dx*2.5,color,1.2);line(c,p.x+dx*17,p.y+1+dy*17,p.x+dx*13+dy*2.5,p.y+1+dy*13-dx*2.5,color,1.2);c.restore();
    }
    if(braced){
      // Visible levelled spear and ground line make the narrow frontal counter readable.
      const point=iso(u.braceDir.x,u.braceDir.y),length=Math.hypot(point.x,point.y)||1,dx=point.x/length,dy=point.y/length,reach=u.type==='dread_pike'?27:22;
      line(c,p.x-dx*4,p.y-12-dy*4,p.x+dx*reach,p.y-12+dy*reach,'#d5c6a2',1.8);polygon(c,[[p.x+dx*(reach+4),p.y-12+dy*(reach+4)],[p.x+dx*(reach-1)-dy*2,p.y-12+dy*(reach-1)+dx*2],[p.x+dx*(reach-1)+dy*2,p.y-12+dy*(reach-1)-dx*2]],'#e1ecdc');
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
    if(attack&&unitClass!=='archer'&&unitClass!=='siege'&&u.attackAnim>.64){const a=(1-u.attackAnim)*5;c.beginPath();c.arc(p.x+facing*9,p.y-12,12,-1.7+a,-.4+a);c.strokeStyle=`rgba(248,226,156,${u.attackAnim*.7})`;c.lineWidth=1.4;c.stroke();}
    if((selected||u.hp<u.maxHp*.7)&&zoom>.57){const w=u.type==='hero'?19:12;c.fillStyle='#15302f';c.fillRect(p.x-w/2,p.y-29-(unitClass==='cavalry'?9:0),w,2);c.fillStyle=(g.allied?.(u.team,0)??u.team===0)?'#b9d9a1':'#d4a18a';c.fillRect(p.x-w/2,p.y-29-(unitClass==='cavalry'?9:0),w*clamp(u.hp/u.maxHp,0,1),2);}
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
  projectiles(c,g){
    for(const b of g.projectiles||[]){if(g.config?.fogOfWar&&!g.isVisibleTo(0,{x:b.x,y:b.y}))continue;const progress=clamp((b.t||0)/(b.duration||1),0,1),p=iso(b.x,b.y),piercing=b.sourceType==='beacon_engineer',firepot=b.sourceType==='dragonfire_acolyte',javelin=b.sourceType==='dune_skirmisher',lift=Math.sin(progress*Math.PI)*(piercing?7:firepot?42:b.type==='rock'?70:32);ellipse(c,p.x,p.y,3,1.2,'rgba(8,22,22,.2)');
      const v=iso((b.tx??b.x)-(b.sx??b.x),(b.ty??b.y)-(b.sy??b.y));let a=Math.atan2(v.y,v.x);c.save();c.translate(p.x,p.y-lift-10);c.rotate(a);
      if(piercing){line(c,-15,0,7,0,'#d4c7a6',2);polygon(c,[[8,0],[2,-3],[2,3]],'#eef1d5');line(c,-15,0,-19,-3,'#99b8bc',1.5);}
      else if(firepot){ellipse(c,0,0,4,3.5,'#bd653a');ellipse(c,1,-2,2.5,3,'#ffce67');line(c,-8,0,-2,0,'#ed9c50',2);}
      else if(javelin){line(c,-12,0,5,0,'#bc9669',1.5);polygon(c,[[7,0],[2,-2],[2,2]],'#eee6c6');}
      else if(b.type==='rock'){ellipse(c,0,0,4,3.3,'#b9aa86');ellipse(c,1,-1,2,1.5,'#e5cb8c');c.fillStyle='rgba(241,174,67,.5)';c.fillRect(-9,-1,8,2);}
      else{line(c,-7,0,3,0,'#dddcc0',1.1);polygon(c,[[3,0],[-.5,-2],[-.5,2]],'#f5f0d0');line(c,-7,0,-9,-2,'#a9b7a5',1);}
      c.restore();
    }
  }
  fireZones(c,g,bounds,zoom){
    const zones=g.fireZones||[];let visible=0;
    for(let index=zones.length-1;index>=0&&visible<24;index--){const z=zones[index];if(!(z.life>0)||g.config?.fogOfWar&&!g.isVisibleTo(0,{x:z.x,y:z.y}))continue;const p=iso(z.x,z.y),radius=clamp(z.radius||1,.3,3),rw=radius*40,rh=radius*20;if(p.x+rw<bounds.left||p.x-rw>bounds.right||p.y+rh<bounds.top||p.y-rh-45>bounds.bottom)continue;visible++;
      const fade=Math.min(1,z.life/.5),count=zoom<.3?5:this.lowDetail?8:14;c.save();c.globalAlpha=fade;ellipse(c,p.x,p.y+2,rw,rh,'rgba(38,22,12,.24)');
      for(let k=0;k<count;k++){const angle=k*2.399963+index*.71,distance=Math.sqrt(hash(k+index*3,z.team||0))*radius*.86,foot=iso(z.x+Math.cos(angle)*distance,z.y+Math.sin(angle)*distance),flicker=.84+Math.sin(g.time*12.2+k*2.1)*.12,scale=(.56+hash(k,17)*.24)*flicker,height=38*scale;
        const sprite=this.fireSprite(Math.floor(g.time*12+k*1.7)%8,k%3);c.drawImage(sprite,foot.x-24*scale,foot.y-60*scale,48*scale,64*scale);
        if(!this.lowDetail&&zoom>.35&&k%3===0){const rise=(g.time*.7+k*.23)%1;c.save();c.globalAlpha*=(1-rise)*.3;ellipse(c,foot.x+Math.sin(k+g.time)*4,foot.y-height-rise*23,2+rise*5,3+rise*5,'#7b7667');c.restore();line(c,foot.x+2,foot.y-height-5-rise*15,foot.x+3,foot.y-height-7-rise*15,'#e5ad57',.8);}
      }c.restore();
    }
  }
  fireSprite(frame,variant=0){
    this.fireSprites??=new Map();const key=frame+'|'+variant;if(this.fireSprites.has(key))return this.fireSprites.get(key);const a=makeCanvas(96,128),c=a.getContext('2d');c.scale(2,2);c.translate(24,60);const phase=frame/8*TAU+variant*1.3,sway=Math.sin(phase)*3,h=34+Math.sin(phase*2)*4+variant*2;
    const glow=c.createRadialGradient(0,-9,1,0,-9,18);glow.addColorStop(0,'rgba(248,151,41,.25)');glow.addColorStop(1,'rgba(218,110,24,0)');c.fillStyle=glow;c.fillRect(-21,-32,42,37);
    const gradient=c.createLinearGradient(0,1,0,-h);gradient.addColorStop(0,'#fff1bd');gradient.addColorStop(.22,'#f6c65d');gradient.addColorStop(.62,'#e88b2e');gradient.addColorStop(1,'rgba(201,77,23,.08)');c.fillStyle=gradient;c.beginPath();c.moveTo(-8,0);c.bezierCurveTo(-15,-12,1,-18,sway-3,-h);c.bezierCurveTo(9,-h+7,2,-20,10,-13);c.bezierCurveTo(16,-5,7,4,-8,0);c.fill();
    c.fillStyle='#ffdc81';c.beginPath();c.moveTo(-4,0);c.bezierCurveTo(-8,-7,3,-13,2+sway*.4,-h*.7);c.bezierCurveTo(9,-13,1,-9,6,-3);c.bezierCurveTo(9,3,-2,3,-4,0);c.fill();c.fillStyle='#fff4c9';c.beginPath();c.moveTo(-2,1);c.bezierCurveTo(-4,-5,2,-7,2,-12);c.bezierCurveTo(7,-4,4,3,-2,1);c.fill();
    this.fireSprites.set(key,a);return a;
  }
  effects(c,g,lowDetail=false){
    let detailIndex=0;
    for(const f of g.effects||[]){if(g.config?.fogOfWar&&!g.isVisibleTo(0,{x:f.x,y:f.y}))continue;if(lowDetail&&(f.type==='dust'||(f.type==='hit'&&detailIndex++%2)))continue;const p=iso(f.x,f.y),r=clamp(1-f.life/(f.maxLife||1),0,1);c.save();c.translate(p.x,p.y-7);c.globalAlpha=1-r;
      if(f.type==='specialHit'){
        const color={guard:'#b4deec',pierce:'#c8e5f0',cleave:'#e4bd82',heal:'#a8dfa0',loot:'#f1ce73',shock:'#f3d26e',snare:'#d1a27e',poison:'#adcb6d',cripple:'#efb174',finish:'#df9292',fury:'#e8a275'}[f.kind]||'#e9d9a7';
        if(f.kind==='heal'){line(c,-4,-12-r*7,4,-12-r*7,color,2);line(c,0,-16-r*7,0,-8-r*7,color,2);}
        else if(f.kind==='cleave'||f.kind==='finish'){c.beginPath();c.arc(0,-7,8+r*14,-2.8,-.1);c.strokeStyle=color;c.lineWidth=2*(1-r)+.4;c.stroke();}
        else if(f.kind==='loot'){for(let k=0;k<3;k++)ellipse(c,(k-1)*5,-8-r*15-k*2,2,2.8,color);}
        else if(f.kind==='poison'){ellipse(c,-3,-9-r*12,2,3,color);ellipse(c,4,-5-r*9,1.5,2.5,color);}
        else{c.beginPath();c.ellipse(0,1,6+r*12,3+r*5,0,0,TAU);c.strokeStyle=color;c.lineWidth=1.6*(1-r)+.4;c.stroke();line(c,-4,-8-r*6,0,-14-r*6,color,1.3);line(c,0,-14-r*6,4,-8-r*6,color,1.3);}
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
  draw(g,v,ui={}){
    if(!this.terrainReady)return;
    const scene=this.fogScene(g);
    const lowDetail=ui.quality!=='high'&&(!!ui.lowDetail||v.zoom<.75);
    this.lowDetail=lowDetail;
    if(!this.w||!this.h)this.resize(v.w,v.h,v.dpr||1);if(this.cachedGame!==g)this.prepare(g);if(this.lastBuildingCount!==g.buildings.length||this.lastBuildingId!==(g.buildings.at(-1)?.id||0))this.clearBuildingSites(g);if(g.config?.fogOfWar&&this.territoryVisionRevision!==g.vision.revision){this.updateTerritory(g);this.territoryVisionRevision=g.vision.revision;const signature=scene.buildings.map(b=>b.id).join(',')+'|'+scene.castles.map(b=>b.id).join(',');if(signature!==this.fogSiteSignature){this.clearBuildingSites(g);this.fogSiteSignature=signature;}}if(g.time-this.territoryTime>(lowDetail?.55:.35)||this.territoryTime<0)this.updateTerritory(g);
    this.frame++;const c=this.ctx,d=this.dpr;c.setTransform(d,0,0,d,0,0);c.fillStyle='#10272e';c.fillRect(0,0,v.w,v.h);
    const glow=c.createRadialGradient(v.w*.52,v.h*.42,10,v.w*.5,v.h*.5,v.w*.7);glow.addColorStop(0,'#25404a');glow.addColorStop(1,'#0d222a');c.fillStyle=glow;c.fillRect(0,0,v.w,v.h);
    c.save();c.translate(v.w/2-v.x*v.zoom,v.h/2-v.y*v.zoom);c.scale(v.zoom,v.zoom);
    const bounds={left:v.x-v.w/v.zoom/2-90,right:v.x+v.w/v.zoom/2+90,top:v.y-v.h/v.zoom/2-110,bottom:v.y+v.h/v.zoom/2+80};
    const range=this.visibleWorldRange(g,bounds);this.lastVisibleRange=range;
    for(let i=0;i<(lowDetail?22:44);i++){const x=this.left+hash(i,4)*(this.mapW),y=-60+hash(i,8)*this.mapH;if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)continue;const wave=Math.sin(g.time*.8+i)*3;line(c,x+wave,y,x+8+wave,y,'rgba(106,152,159,.16)',.8);if(!lowDetail)line(c,x+4+wave,y+3,x+15+wave,y+3,'rgba(106,152,159,.10)',.7);}
    this.drawGround(c,g,v,bounds,range);
    for(const objective of [...scene.objectives,...scene.castles.filter(site=>site.ruined)]){const p=iso(objective.x,objective.y),radius=(objective.radius||4)*HW*1.5;if(p.x+radius>bounds.left&&p.x-radius<bounds.right&&p.y+radius>bounds.top&&p.y-radius<bounds.bottom)this.objectiveGround(c,objective,g,v.zoom);}
    if(ui.showGrid){
      if(v.zoom>.48){c.lineWidth=.65;for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const p=iso(x+.5,y+.5);if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)continue;diamond(c,p.x,p.y,HW,HH,null,'rgba(197,211,174,.11)');}}
      else{for(let x=Math.ceil(range.x0/4)*4;x<=range.x1;x+=4){const a=iso(x,range.y0),b=iso(x,range.y1+1);line(c,a.x,a.y,b.x,b.y,'rgba(197,211,174,.10)',.65/v.zoom);}for(let y=Math.ceil(range.y0/4)*4;y<=range.y1;y+=4){const a=iso(range.x0,y),b=iso(range.x1+1,y);line(c,a.x,a.y,b.x,b.y,'rgba(197,211,174,.10)',.65/v.zoom);}}
    }
    if(v.zoom>.32)for(let y=range.y0;y<=range.y1;y++)for(let x=range.x0;x<=range.x1;x++){const t=g.tiles[y*g.W+x];if(t.claim<0||!t.capture||t.capture>.999||g.config?.fogOfWar&&!g.isVisibleTo(0,{x:x+.5,y:y+.5}))continue;const p=iso(t.x+.5,t.y+.5);if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)continue;const color=g.teams[t.claim]?.color||'#dac589';c.globalAlpha=.08+Math.sin(g.time*4)*.03;diamond(c,p.x,p.y,HW,HH,color);c.globalAlpha=1;c.fillStyle='rgba(10,35,32,.7)';c.fillRect(p.x-11,p.y+5,22,2);c.fillStyle=color;c.fillRect(p.x-11,p.y+5,22*t.capture,2);}
    this.fireZones(c,g,bounds,v.zoom);
    // Rally markers belong to the selected production posts, never army orders.
    const rallies=new Map();
    for(const b of g.buildings){if(b.team!==0||b.hp<=0||!ui.selectedBuildings?.has(b.id))continue;const p=iso(b.x,b.y),scale=b.type==='keep'?(1+((b.level||1)-1)*.25):1;c.save();c.strokeStyle='#f1d187';c.lineWidth=2/v.zoom;diamond(c,p.x,p.y+3,(b.type==='keep'?38:25)*scale,(b.type==='keep'?19:12)*scale,null,'#f1d187');
      if(g.config?.fogOfWar&&b.type==='tower'){const radius=g.vision.sightRadius(b);c.strokeStyle='#9fcac7';c.globalAlpha=.6;c.setLineDash([8/v.zoom,6/v.zoom]);c.beginPath();c.ellipse(p.x,p.y,radius*HW*Math.SQRT2,radius*HH*Math.SQRT2,0,0,TAU);c.stroke();}if(b.rally){const q=iso(b.rally.x,b.rally.y);c.globalAlpha=.5;c.setLineDash([5/v.zoom,5/v.zoom]);line(c,p.x,p.y,q.x,q.y,'#d9ce91',1/v.zoom);rallies.set(`${b.rally.x},${b.rally.y}`,q);}c.restore();
    }
    for(const p of rallies.values()){c.save();c.strokeStyle='#f4d38b';c.lineWidth=1.8/v.zoom;c.beginPath();c.ellipse(p.x,p.y,13,6,0,0,TAU);c.stroke();this.flag(c,p.x,p.y-2,'#e8c377',g.time,.7);c.restore();}
    if(ui.orderMarker){const m=ui.orderMarker,age=g.time-m.time;if(age<1.7&&age>=0){const p=iso(m.x,m.y),a=1-age/1.7;c.globalAlpha=a;c.beginPath();c.ellipse(p.x,p.y,13+age*9,6+age*4,0,0,TAU);c.strokeStyle=m.mode==='move'?'#c2e0ce':'#edca78';c.lineWidth=2;c.stroke();line(c,p.x-4,p.y,p.x+4,p.y,'#ead89c',1.5);line(c,p.x,p.y-4,p.x,p.y+4,'#ead89c',1.5);c.globalAlpha=1;}}
    if(ui.facingPreview)this.facingPreview(c,g,ui.facingPreview,v.zoom);
    const items=[];
    let decorIndex=0;
    if(v.zoom>=.75)for(let cy=Math.floor(range.y0/16);cy<=Math.floor(range.y1/16);cy++)for(let cx=Math.floor(range.x0/16);cx<=Math.floor(range.x1/16);cx++)for(const z of this.decorChunks.get(cx+','+cy)||[]){const index=decorIndex++;if(lowDetail&&v.zoom<.8&&index%2)continue;const p=iso(z.x,z.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:0,obj:z,p});}
    for(const b of scene.buildings){if(b.hp<=0)continue;const p=iso(b.x,b.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:1,obj:b});}
    for(const u of scene.units){if(u.hp<=0)continue;const p=iso(u.x,u.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:2,obj:u});}
    for(const objective of scene.objectives){const p=iso(objective.x,objective.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:3,obj:objective});}
    for(const site of scene.castles){if(!site.ruined)continue;const p=iso(site.x,site.y);if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom)items.push({depth:p.y,kind:4,obj:site});}
    items.sort((a,b)=>a.depth-b.depth||a.kind-b.kind);
    for(const it of items){if(it.kind===0){const z=it.obj,a=this.treeSprite(z.kind,z.variant),s=z.scale*(z.kind==='bush'?.38:1);if(!a)continue;const wind=!lowDetail&&z.kind==='tree'?Math.sin(g.time*1.3+z.x*.2)*.65:0;
      // Nearby armies remain readable through foreground vegetation and rocks.
      if(z.occlusionTime===undefined||g.time-z.occlusionTime>.1){let occupied=false;const radius=z.kind==='tree'?1:.75;g.hash?.visit(z.x,z.y,radius,u=>{if(u.hp>0&&(!g.config?.fogOfWar||g.isVisibleTo(0,u))&&(u.x-z.x)**2+(u.y-z.y)**2<radius*radius)occupied=true;});z.opacity=occupied?(z.kind==='tree'?.23:.35):1;z.occlusionTime=g.time;}
      c.globalAlpha=z.opacity??1;c.drawImage(a,it.p.x-48*s+wind,it.p.y-100*s,96*s,112*s);c.globalAlpha=1;
    }else if(it.kind===1){if(it.obj.remembered)this.rememberedBuilding(c,it.obj,g);else this.building(c,it.obj,g);}else if(it.kind===2)this.unit(c,it.obj,g,ui,v.zoom);else if(it.kind===4)this.castleRuin(c,it.obj,g,v.zoom);else this.objectiveFlag(c,it.obj,g,v.zoom);}
    this.projectiles(c,g);this.effects(c,g,lowDetail);this.drawFog(c,g);
    this.teamOrderMarkers(c,g,v.zoom);
    if(ui.teamOrderMode&&ui.hover){const p=iso(ui.hover.x,ui.hover.y),color=ui.teamOrderMode==='defend'?'#8fdfca':'#f3b77c';c.save();c.strokeStyle=color;c.lineWidth=2/v.zoom;c.setLineDash([5/v.zoom,4/v.zoom]);diamond(c,p.x,p.y,32,16,null,color);c.setLineDash([]);this.flag(c,p.x,p.y,color,g.time,.8);c.restore();}
    if(ui.hover&&ui.hover.x>=0&&ui.hover.y>=0&&ui.hover.x<g.W&&ui.hover.y<g.H){const tx=Math.floor(ui.hover.x),ty=Math.floor(ui.hover.y),p=iso(tx+.5,ty+.5),tile=g.tiles[ty*g.W+tx];c.lineWidth=1.2;diamond(c,p.x,p.y,HW,HH,null,ui.buildMode?(tile.owner===0&&g.isWalkable(tx+.5,ty+.5)&&!['bridge','ford','pass'].includes(tile.feature)?'#e8d38a':'#e28a71'):'rgba(229,223,174,.6)');if(ui.buildMode){c.globalAlpha=.55;this.building(c,{type:ui.buildMode,x:tx+.5,y:ty+.5,team:0,hp:1,maxHp:1},g);c.globalAlpha=1;}}
    c.restore();
    const vignette=c.createRadialGradient(v.w/2,v.h/2,v.h*.3,v.w/2,v.h/2,v.w*.8);vignette.addColorStop(0,'rgba(2,14,19,0)');vignette.addColorStop(1,'rgba(2,14,19,.35)');c.fillStyle=vignette;c.fillRect(0,0,v.w,v.h);
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
    for(const u of scene.units){if(u.hp<=0)continue;const p=iso(u.x,u.y);c.fillStyle=g.teams[u.team]?.color||'#ddd';c.globalAlpha=.9;c.fillRect(p.x*scale+ox-1,p.y*scale+oy-1,2,2);}c.globalAlpha=1;
    for(const o of scene.objectives){const p=iso(o.x,o.y),x=p.x*scale+ox,y=p.y*scale+oy,team=g.teams.find(s=>s.alliance===o.controller),color=o.contested?'#f0ab77':team?.teamColor||'#edd490';line(c,x-2,y+3,x-2,y-5,'#f1ead2',1);polygon(c,[[x-1,y-5],[x+5,y-4],[x+3,y],[x-1,y-1]],color,'#153331');}
    for(const order of g.teamOrders||[]){if(order.expiresAt<=g.time||order.alliance!==g.teams[0]?.alliance)continue;const p=iso(order.x,order.y),x=p.x*scale+ox,y=p.y*scale+oy,color=order.kind==='defend'?'#8fdfca':'#f3b77c';c.beginPath();c.arc(x,y,5,0,TAU);c.strokeStyle=color;c.lineWidth=1.2;c.stroke();line(c,x-3,y,x+3,y,color,1);line(c,x,y-3,x,y+3,color,1);}
    c.strokeStyle='#f1e0a7';c.lineWidth=1;c.strokeRect((v.x-v.w/v.zoom/2)*scale+ox,(v.y-v.h/v.zoom/2)*scale+oy,v.w/v.zoom*scale,v.h/v.zoom*scale);
  }
}
