(function () {
  'use strict';
  const OW = window.OW = window.OW || {};
  const TAU = Math.PI * 2;
  const ASSETS = OW.Assets = {
    actors: 'assets/characters/actors.png', bodies:'assets/characters/bodies-v2.png',friendly:'assets/characters/friendly-cats.png', arms:'assets/weapons/arms.png',scenery: 'assets/buildings/scenery.png', specialists:'assets/enemies/specialists.png',
    items: 'assets/weapons/items.png', terrain: 'assets/terrain/terrain.png', title: 'assets/ui/title.png', landmarks:'assets/buildings/landmarks.png',forge:'assets/buildings/forge.png',
    atlas: 'assets/atlas.json'
  };
  // Illustrated expansion sheets share one manifest with the fitted art renderer.
  for(const [key,sheet] of Object.entries(OW.Art?.sheets||{}))ASSETS[key]=sheet.path;
  const biomeTile = {grass:0,grassland:0,forest:1,mountain:2,rock:2,desert:3,sand:3,snow:4,marsh:5,industrial:6,fortress:6,coast:0,isles:5,water:7,road:0};
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hash = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
  const alive = e => e && e.alive !== false;
  const BODY_FRAMES=[[[35,55,111,117],[217,55,109,117],[401,55,102,116],[574,55,112,118],[753,54,113,118],[937,86,113,85],[1121,57,105,115],[1297,116,124,56]],[[34,237,111,119],[218,236,108,122],[401,236,105,122],[575,239,110,119],[753,236,115,123],[936,271,114,85],[1121,239,105,120],[1294,299,126,57]],[[31,418,114,120],[216,419,110,120],[395,419,106,120],[573,422,114,117],[752,419,115,120],[936,451,114,88],[1121,420,104,120],[1295,481,125,59]],[[34,592,112,121],[216,594,110,118],[400,593,105,120],[573,594,114,120],[752,595,115,120],[936,626,112,88],[1123,593,106,121],[1297,656,126,58]],[[32,767,112,119],[216,768,109,117],[399,768,104,122],[576,771,110,118],[753,767,115,123],[936,797,114,91],[1121,770,107,121],[1293,828,131,59]],[[32,924,113,119],[216,925,110,120],[400,925,104,120],[572,928,113,117],[755,924,113,122],[935,954,115,89],[1123,926,107,120],[1296,985,124,58]]];
  const BODY_BASELINES=[172,356,538,713,886,1043];
  const BODY_HEIGHTS=[117,119,120,121,119,119];
  // The torso artwork is upright regardless of aim. These source-space joints
  // follow its six outfits and locomotion poses, including the low dodge pose.
  const BODY_SHOULDERS=[
    [[94,115],[270,114],[452,115],[634,116],[814,114],[993,140],[1176,116]],
    [[94,297],[270,296],[452,297],[634,298],[814,297],[993,321],[1176,298]],
    [[94,479],[270,479],[452,480],[634,480],[814,479],[993,502],[1176,480]],
    [[94,654],[270,653],[452,653],[634,654],[814,655],[993,676],[1176,654]],
    [[94,828],[270,828],[452,829],[634,829],[814,829],[993,847],[1176,830]],
    [[94,985],[270,986],[452,987],[634,986],[814,987],[993,1005],[1176,987]]
  ];
  const ARM_BOUNDS=[[0,190],[190,392],[392,636],[636,837],[837,1066],[1066,1254]];
  const ARM_ROWS=[220,378,550,712,872,1043];
  const FRIENDLY_FRAMES=[[[43,31,187,225],[288,41,184,215],[542,43,180,213],[797,46,178,210]],[[39,277,192,235],[285,278,213,233],[538,279,215,233],[800,283,205,229]],[[42,529,189,227],[289,535,195,222],[542,536,192,222],[798,535,182,223]],[[43,769,186,241],[278,781,196,229],[536,782,197,230],[781,780,200,232]],[[40,1024,184,232],[284,1035,188,223],[541,1041,185,218],[800,1042,178,216]],[[34,1280,199,228],[284,1280,190,225],[539,1281,187,226],[796,1287,190,220]]];
  const FRIENDLY_BASELINES=[256,512,756,1010,1256,1508];
  const FRIENDLY_HEIGHTS=[225,235,227,241,232,228];
  const ENEMY_ART={
    roller:{key:'enemyVanguard',row:0,w:86,h:74},blinkstalker:{key:'enemyVanguard',row:1,w:88,h:82},
    fencer:{key:'enemyVanguard',row:2,w:132,h:80},burrowrat:{key:'enemyVanguard',row:3,w:94,h:73},
    cinderbeast:{key:'enemyElemental',row:0,w:116,h:90},venomrat:{key:'enemyElemental',row:1,w:102,h:78},
    frostwarden:{key:'enemyElemental',row:2,w:110,h:94},voidknight:{key:'enemyElemental',row:3,w:116,h:96},
    harpooner:{key:'enemyCoastal',row:0,w:111,h:76},bellringer:{key:'enemyCoastal',row:1,w:102,h:87},
    shellguard:{key:'enemyCoastal',row:2,w:110,h:83},tideblade:{key:'enemyCoastal',row:3,w:113,h:82},
    blackglassreaver:{key:'enemyDeep',row:0,w:112,h:86},cindermortar:{key:'enemyDeep',row:1,w:112,h:94}
  };
  const GUARDIAN_ART=[{w:170,h:142},{w:218,h:144},{w:214,h:137},{w:180,h:157}];
  function canvasOf(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

  class Renderer {
    constructor(canvas,game) {
      this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false}); this.game=game;
      this.images={}; this.patterns=[]; this.chunks=new Map(); this.ready=false; this.clock=0;
      this.width=innerWidth; this.height=innerHeight; this.dpr=1; this.frame=0;
      this.resize(); window.addEventListener('resize',()=>this.resize());
    }
    assetURL(path) {
      const config=OW.config||OW.Config||window.WHISKERFALL_CONFIG||window.OW_CONFIG||window.GAME_CONFIG||{};
      const base=config.assetBaseURL||'';
      return base ? base.replace(/\/$/,'')+'/'+path.replace(/^assets\//,'') : path;
    }
    async load() {
      await Promise.all(Object.entries(ASSETS).filter(([k])=>k!=='atlas').map(([key,path])=>new Promise(resolve=>{
        const img=new Image(); img.onload=()=>{this.images[key]=img;resolve();}; img.onerror=()=>resolve();
        img.src=this.assetURL(path);
      })));
      if (this.images.terrain) {
        const img=this.images.terrain;
        for(let i=0;i<8;i++) {
          const c=canvasOf(256,256),p=c.getContext('2d');
          const x=(i%4)*img.width/4,y=Math.floor(i/4)*img.height/2;
          p.drawImage(img,x,y,img.width/4,img.height/2,0,0,256,256);
          this.patterns.push(this.ctx.createPattern(c,'repeat'));
        }
      }
      this.ready=true; this.chunks.clear(); return this;
    }
    resize() {
      const r=this.canvas.getBoundingClientRect(); this.width=Math.max(1,r.width||innerWidth); this.height=Math.max(1,r.height||innerHeight);
      const quality=this.game?.settings?.quality||'high'; this.dpr=quality==='low'?1:Math.min(devicePixelRatio||1,quality==='medium'?1.5:2);
      this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
      this.ctx.imageSmoothingEnabled=true; this.ctx.imageSmoothingQuality='high';
    }
    visible(x,y,pad=100) { const v=this.view; return !v || (x>v.x-pad&&x<v.x+v.w+pad&&y>v.y-pad&&y<v.y+v.h+pad); }
    sprite(key,col,row,cols,rows,x,y,w,h,opts) {
      const img=this.images[key]; if(!img) return;
      opts=opts||{};const c=this.ctx, sx=opts.sx??Math.round(col*img.width/cols), sy=opts.sy??Math.round(row*img.height/rows);
      const sw=opts.sw??Math.round((col+1)*img.width/cols)-sx,sh=opts.sh??Math.round((row+1)*img.height/rows)-sy;
      c.save(); c.translate(x,y); if(opts.angle)c.rotate(opts.angle); if(opts.flip)c.scale(-1,1);
      if(opts.alpha!==undefined)c.globalAlpha*=opts.alpha;
      if(opts.glow){c.shadowColor=opts.glow;c.shadowBlur=12;}
      c.drawImage(img,sx,sy,sw,sh,-w*(opts.px??.5),-h*(opts.py??.5),w,h); c.restore();
    }
    shadow(x,y,w,h,alpha=.2) {
      const c=this.ctx;c.save();c.fillStyle='rgba(12,26,24,'+alpha+')';c.beginPath();c.ellipse(x+4,y+4,w,h,-.15,0,TAU);c.fill();c.restore();
    }
    terrainType(world,x,y) {
      if(world.terrainAt){const t=world.terrainAt(x,y);return typeof t==='string'?(t==='water'||t==='road'?world.regionAt?.(x,y)?.biome||'grass':t):t?.biome||world.regionAt?.(x,y)?.biome||t?.type||'grass';}
      const r=world.regionAt?.(x,y);return r?.biome||'grass';
    }
    groundChunk(world,cx,cy) {
      const key=cx+','+cy; if(this.chunks.has(key))return this.chunks.get(key);
      const size=640,c=canvasOf(size,size),ctx=c.getContext('2d');
      const colors=['#759b50','#527a48','#888e78','#c8af70','#d8e6e3','#5c8771','#7a8077','#3b879b'];
      for(let y=0;y<size;y+=160)for(let x=0;x<size;x+=160){
        const wx=cx*size+x,wy=cy*size+y,t=this.terrainType(world,wx+80,wy+80),tile=biomeTile[t]??0;
        if((t==='coast'||t==='isles')&&this.images.coastalTerrain){const im=this.images.coastalTerrain,n=t==='isles'?2:0;ctx.drawImage(im,(n%2)*im.width/2,Math.floor(n/2)*im.height/2,im.width/2,im.height/2,x,y,160,160);}
        else if(this.images.terrain){const im=this.images.terrain;ctx.drawImage(im,(tile%4)*im.width/4,Math.floor(tile/4)*im.height/2,im.width/4,im.height/2,x,y,160,160);}
        else {ctx.fillStyle=colors[tile];ctx.fillRect(x,y,160,160);}
        ctx.fillStyle='rgba(26,48,25,'+(hash(wx,wy)*.055)+')';ctx.fillRect(x,y,160,160);
      }
      this.chunks.set(key,c); if(this.chunks.size>64)this.chunks.delete(this.chunks.keys().next().value); return c;
    }
    path(points,width,color) {
      if(!points?.length)return;const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);
      c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.lineWidth=width;c.stroke();
    }
    drawTerrain(world) {
      const c=this.ctx,v=this.view,size=640;
      for(let cy=Math.floor(v.y/size);cy<=Math.floor((v.y+v.h)/size);cy++)for(let cx=Math.floor(v.x/size);cx<=Math.floor((v.x+v.w)/size);cx++){
        if(cx<0||cy<0||cx*size>=world.width||cy*size>=world.height)continue;
        c.drawImage(this.groundChunk(world,cx,cy),cx*size,cy*size);
      }
      for(const river of world.rivers||[]) {
        const pts=river.points||[];this.path(pts,river.width+38,'#6c8d64');this.path(pts,river.width+17,'#c1b487');
        this.path(pts,river.width,'#387e92'); this.path(pts,Math.max(8,river.width-25),(/stormglass|crown/.test(river.id||'')&&this.coastalWaterPattern())||this.patterns[7]||'#4697aa');
        c.save();c.globalAlpha=.15;c.setLineDash([30,80]);c.lineDashOffset=-this.clock*15;this.path(pts,3,'#e6f5e9');c.restore();
      }
      for(const detail of world.groundDetails||[])if(this.visible(detail.x,detail.y,Math.max(detail.w,detail.h)))this.drawGroundDetail(detail);
      const roads=(world.roads||[]).filter(r=>Math.max(r.x1,r.x2)>v.x-100&&Math.min(r.x1,r.x2)<v.x+v.w+100&&Math.max(r.y1,r.y2)>v.y-100&&Math.min(r.y1,r.y2)<v.y+v.h+100);
      // Paint all verges before the road surfaces, so junctions merge cleanly.
      for(const road of roads)this.path(road.points,(road.width||58)+(road.kind==='trail'?8:14),'rgba(48,65,39,.2)');
      for(const road of roads){
        const trail=road.kind==='trail',major=road.kind==='highway',width=road.width||58;
        this.path(road.points,width,trail?'#928961':major?'#b9ae86':'#aa9e76');
        this.path(road.points,Math.max(8,width-10),trail?'#a69c73':major?'#c5b893':'#b9ac82');
        if(major){c.save();c.globalAlpha=.3;c.setLineDash([18,42]);this.path(road.points,2,'#f2dfb5');c.restore();}
      }
      for(const b of world.bridges||[])if(this.visible(b.x,b.y,Math.max(240,b.w)))this.drawBridge(b);
      c.strokeStyle='rgba(25,48,50,.7)';c.lineWidth=18;c.strokeRect(0,0,world.width,world.height);
    }
    coastalWaterPattern(){
      if(this._coastalWaterPattern)return this._coastalWaterPattern;if(!this.images.coastalTerrain)return null;
      const image=this.images.coastalTerrain,tile=canvasOf(160,160),ctx=tile.getContext('2d');ctx.drawImage(image,image.width/2,image.height/2,image.width/2,image.height/2,0,0,160,160);
      return this._coastalWaterPattern=this.ctx.createPattern(tile,'repeat');
    }
    drawGroundDetail(d) {
      const c=this.ctx;c.save();c.translate(d.x,d.y);
      if(d.type==='coastalShore'){
        c.beginPath();c.ellipse(0,0,d.w/2,d.h/2,.16,0,TAU);c.clip();
        const im=this.images.coastalTerrain;
        if(im){for(let y=-d.h/2;y<d.h/2;y+=160)for(let x=-d.w/2;x<d.w/2;x+=160)c.drawImage(im,im.width/2,0,im.width/2,im.height/2,x,y,160,160);}
        else{c.fillStyle='#b9b49a';c.fillRect(-d.w/2,-d.h/2,d.w,d.h);}
      }else if(d.type==='plaza'){
        c.fillStyle='#65765455';c.beginPath();c.roundRect(-d.w/2-16,-d.h/2-14,d.w+32,d.h+28,95);c.fill();
        c.fillStyle='#b2ab8a';c.beginPath();c.roundRect(-d.w/2,-d.h/2,d.w,d.h,85);c.fill();
        c.strokeStyle='#7b806857';c.lineWidth=2;for(let y=-220;y<=240;y+=38){c.beginPath();c.moveTo(-270,y);c.lineTo(270,y);c.stroke();for(let x=-260;x<290;x+=75){c.beginPath();c.moveTo(x+(Math.round(y/38)%2)*34,y);c.lineTo(x+(Math.round(y/38)%2)*34,y+36);c.stroke();}}
        c.strokeStyle='#d2c49b';c.lineWidth=8;c.beginPath();c.ellipse(0,10,108,66,0,0,TAU);c.stroke();
      }else if(d.type==='campYard'||d.type==='fortYard'){
        c.fillStyle=d.type==='fortYard'?'#77766c':'#939176';c.beginPath();c.roundRect(-d.w/2,-d.h/2,d.w,d.h,38);c.fill();
        c.strokeStyle='#b4ac88';c.lineWidth=3;c.setLineDash([16,10]);c.strokeRect(-d.w/2+28,-d.h/2+28,d.w-56,d.h-56);c.setLineDash([]);
        c.strokeStyle='#494e482a';c.lineWidth=9;for(const x of [-35,35]){c.beginPath();c.moveTo(x,-d.h/2);c.lineTo(x,d.h/2+40);c.stroke();}
      }else if(d.type==='caveApron'){
        c.fillStyle='#817f6b99';c.beginPath();c.ellipse(0,-12,d.w*.5,d.h*.5,0,0,TAU);c.fill();
        c.strokeStyle='#d1c196';c.lineWidth=3;for(let n=0;n<4;n++){c.beginPath();c.moveTo(-30,28+n*13);c.lineTo(30,28+n*13);c.stroke();}
      }else if(d.type==='frontier'){
        c.fillStyle='#6c67482b';c.beginPath();c.ellipse(0,0,d.w/2,d.h/2,0,0,TAU);c.fill();
      }c.restore();
    }
    drawBridge(b) {
      const c=this.ctx,length=b.w||200,width=b.h||85;c.save();c.translate(b.x,b.y);c.rotate(b.angle||0);
      c.fillStyle='#353c3399';c.fillRect(-length/2-6,-width/2+7,length+12,width+10);c.fillStyle='#a58c61';c.fillRect(-length/2,-width/2,length,width);
      c.strokeStyle='#594d36';c.lineWidth=2;for(let x=-length/2;x<length/2;x+=15){c.beginPath();c.moveTo(x,-width/2);c.lineTo(x,width/2);c.stroke();}
      c.fillStyle='#d1b681';c.fillRect(-length/2,-width/2-5,length,8);c.fillRect(-length/2,width/2-3,length,8);
      c.fillStyle='#63533b';for(let x=-length/2;x<=length/2;x+=65){c.fillRect(x-3,-width/2-11,6,18);c.fillRect(x-3,width/2-7,6,18);}c.restore();
    }
    objectSpec(o,world) {
      const type=o.type;const region=world.regions?.[o.region]||world.regionAt?.(o.x,o.y)||{};
      const biome=region.biome||'';let col=0,row=0,w=150,h=150,py=.83,key='scenery',cols=6,rows=4;
      if(type==='forge')return {key:'forge',cols:1,rows:1,col:0,row:0,w:190,h:135,py:.75};
      if(type==='npc')return {key:'landmarks',cols:4,rows:2,col:0,row:1,w:105,h:105,py:.8};
      if(this.images.landmarks&&['fortress','cave','prison','truck','merchant','farm','warMachine','willow'].includes(type)){
        const i=['fortress','cave','prison','truck','merchant','farm','warMachine','willow'].indexOf(type);
        const widths={fortress:330,cave:200,prison:100,truck:160,merchant:145,farm:180,warMachine:190,willow:180};
        return {key:'landmarks',cols:4,rows:2,col:i%4,row:Math.floor(i/4),w:widths[type],h:widths[type],py:type==='farm'?.5:.82};
      }
      if(type==='tree'||type==='pine'||type==='palm'){
        col=type==='palm'||biome==='desert'?4:type==='pine'||biome==='snow'?(biome==='snow'?3:1):biome==='forest'?1:biome==='marsh'?0:(o.variant||0)%4===3?2:0;
        w=(o.w||65)*2.1;h=(o.h||85)*2.1;py=.84;
      }else if(type==='rock'||type==='cliff'||type==='mountain'){col=type==='cliff'?0:biome==='mountain'&&o.w>100?5:0;row=col===5?0:type==='cliff'?2:3;w=Math.max(70,(o.w||55)*1.45);h=Math.max(65,(o.h||50)*1.55);}
      else if(type==='building'||type==='house'||type==='shop'){row=1;col=type==='shop'?1:biome==='industrial'||biome==='fortress'?5:(o.variant||0)%3===1?1:0;w=Math.max(150,(o.w||120)*1.35);h=Math.max(150,(o.h||110)*1.5);}
      else if(type==='tent'){row=1;col=2;w=Math.max(140,(o.w||100)*1.4);h=w;}
      else if(type==='bunker'||type==='cave'){row=1;col=3;w=Math.max(160,(o.w||120)*1.4);h=w;}
      else if(type==='tower'){row=1;col=4;w=Math.max(130,(o.w||70)*1.6);h=w*1.2;}
      else if(type==='factory'||type==='fortress'){row=1;col=5;w=Math.max(200,(o.w||140)*1.6);h=w;}
      else if(type==='wall'||type==='sandbag'){row=2;col=2;w=Math.max(85,(o.w||70)*1.3);h=Math.max(60,(o.h||45)*1.4);py=.65;}
      else if(type==='artillery'){row=2;col=3;w=145;h=145;}
      else if(type==='radio'){row=2;col=4;w=160;h=200;}
      else if(type==='tank'||type==='truck'){row=2;col=5;w=160;h=150;}
      else if(type==='bush'||type==='grass'){row=3;col=1;w=Math.max(40,(o.w||35)*1.7);h=w;py=.7;}
      else if(type==='chest'||type==='cache'){row=3;col=2;w=65;h=65;py=.7;}
      else if(type==='crate'||type==='barrel'){row=3;col=3;w=Math.max(42,(o.w||36)*1.35);h=w;py=.68;}
      else if(type==='windmill'){row=3;col=4;w=190;h=190;}
      else if(type==='ruin'||type==='prison'){row=3;col=5;w=Math.max(140,(o.w||100)*1.4);h=w;}
      else if(type==='bridge'){row=2;col=1;w=Math.max(150,o.w||180);h=Math.max(110,o.h||150);py=.5;}
      else if(type==='flag'){return null;}else{return null;}
      return {key,cols,rows,col,row,w,h,py};
    }
    drawObject(o,world) {
      if(o.hidden||o.destroyed||o.alive===false)return;
      if(o.type==='coastalProp'){
        if(OW.Art?.draw?.(this,'coastalProps',(o.variant||0)%4,Math.floor((o.variant||0)/4),o.x,o.y,o.w||120,o.h||140,{py:.92}))return;
        this.sprite('landmarks',(o.variant||0)%4,0,4,2,o.x,o.y,o.w||120,o.h||140,{py:.92});return;
      }
      if(o.type==='bridge')return;
      if(['well','marketStall','garden','lantern','signpost','supplyStack'].includes(o.type)){this.drawSettlementProp(o);return;}
      if(o.type==='objective'){this.drawObjective(o,world);return;}
      if(o.type==='npc'){
        const profile=(OW.Content?.npcs||[]).find(n=>n.id===o.npcId)||{};
        this.drawFriendly({...profile,...o,role:profile.role||o.role,portrait:profile.portrait??o.portrait,dialogue:profile.dialogue||o.dialogue,questIds:profile.questIds||o.questIds},{x:o.x,y:o.y,flip:false,walk:false});return;
      }
      if(o.type==='bountyBoard'||o.type==='bountyCenter'||o.type==='bounty'){
        this.drawBountyBoard(o);return;
      }
      if(o.type==='friendlyCat'){
        if(o.liberatedOnly&&!world.liberated?.has(o.locationId))return;
        const p=this.friendlyPosition(o);this.drawFriendly(o,p);return;
      }
      if(o.type==='flag'){
        const c=this.ctx,friendly=o.friendly||world.liberated?.has(o.locationId),h=o.h||85,w=o.w||40;
        c.save();this.shadow(o.x,o.y,16,6,.16);c.strokeStyle='#473c2b';c.lineWidth=4;c.beginPath();c.moveTo(o.x,o.y+5);c.lineTo(o.x,o.y-h);c.stroke();
        c.fillStyle=friendly?'#3d9d91':'#aa483e';c.strokeStyle=friendly?'#a5e6d2':'#eab17c';c.lineWidth=2;c.beginPath();c.moveTo(o.x,o.y-h);c.quadraticCurveTo(o.x+w*.5,o.y-h+Math.sin(this.clock*3+o.x)*4,o.x+w,o.y-h+4);c.lineTo(o.x+w*.8,o.y-h+30);c.quadraticCurveTo(o.x+w*.4,o.y-h+26,o.x,o.y-h+29);c.closePath();c.fill();c.stroke();
        if(friendly){c.fillStyle='#f4dc93';c.beginPath();c.moveTo(o.x+9,o.y-h+9);c.lineTo(o.x+13,o.y-h+4);c.lineTo(o.x+17,o.y-h+10);c.lineTo(o.x+23,o.y-h+8);c.lineTo(o.x+23,o.y-h+20);c.quadraticCurveTo(o.x+16,o.y-h+27,o.x+10,o.y-h+20);c.closePath();c.fill();}
        else {c.strokeStyle='#efd0a0';c.lineWidth=3;c.beginPath();c.moveTo(o.x+12,o.y-h+10);c.lineTo(o.x+25,o.y-h+15);c.lineTo(o.x+12,o.y-h+22);c.closePath();c.stroke();}c.restore();return;
      }
      const s=this.objectSpec(o,world);if(!s)return;
      const c=this.ctx,player=(this.game.players||[]).find(p=>Math.abs(p.x-o.x)<s.w*.4&&p.y<o.y+20&&p.y>o.y-s.h*.7);
      const translucent=player&&(o.type==='tree'||o.type==='pine'||o.type==='building'||o.type==='tower');
      this.shadow(o.x,o.y,s.w*.31,Math.min(25,s.h*.11),.16);
      let sway=(o.type==='tree'||o.type==='pine'||o.type==='bush')?Math.sin(this.clock*1.3+o.x*.01)*.009:0;
      this.sprite(s.key||'scenery',s.col,s.row,s.cols||6,s.rows||4,o.x,o.y+s.h*.12,s.w,s.h,{py:s.py,angle:sway,alpha:translucent?.48:1});
    }
    drawSettlementProp(o) {
      const c=this.ctx;c.save();c.translate(o.x,o.y);
      if(o.type==='well'){
        c.fillStyle='#333f3d';c.beginPath();c.ellipse(0,-12,27,17,0,0,TAU);c.fill();c.strokeStyle='#c8c2a5';c.lineWidth=9;c.stroke();c.fillStyle='#467c87';c.beginPath();c.ellipse(0,-10,17,8,0,0,TAU);c.fill();c.fillStyle='#77583a';c.fillRect(-30,-70,6,70);c.fillRect(24,-70,6,70);c.fillRect(-35,-74,70,7);c.strokeStyle='#d8bc81';c.lineWidth=2;c.beginPath();c.moveTo(5,-70);c.lineTo(5,-14);c.stroke();
      }else if(o.type==='marketStall'){
        c.fillStyle='#624d35';c.fillRect(-43,-8,6,15);c.fillRect(37,-8,6,15);c.fillRect(-46,-28,92,27);c.fillStyle='#c6a16a';c.fillRect(-48,-31,96,8);for(let i=0;i<6;i++){c.fillStyle=i%2?'#c69f50':'#6e9453';c.beginPath();c.arc(-35+i*14,-36,7,0,TAU);c.fill();}c.fillStyle='#755a3a';c.fillRect(-44,-83,5,61);c.fillRect(39,-83,5,61);for(let i=0;i<6;i++){c.fillStyle=i%2?'#e0c88c':['#4c8e80','#8b665b','#6f8190','#789c92'][o.variant%4];c.beginPath();c.moveTo(-52+i*18,-87);c.lineTo(-34+i*18,-87);c.lineTo(-30+i*18,-61);c.lineTo(-48+i*18,-61);c.closePath();c.fill();}c.strokeStyle='#493b2d';c.lineWidth=2;c.strokeRect(-49,-88,108,28);
      }else if(o.type==='garden'){
        c.fillStyle='#786344';c.fillRect(-o.w/2,-o.h/2,o.w,o.h);c.strokeStyle='#b9a77a';c.lineWidth=4;c.strokeRect(-o.w/2,-o.h/2,o.w,o.h);for(let row=0;row<4;row++){c.strokeStyle='#4f4930';c.lineWidth=4;c.beginPath();c.moveTo(-o.w/2+10,-o.h/2+14+row*22);c.lineTo(o.w/2-10,-o.h/2+14+row*22);c.stroke();for(let col=0;col<7;col++){c.fillStyle=row%2?'#91ae68':'#648b4f';c.beginPath();c.ellipse(-o.w/2+20+col*23,-o.h/2+12+row*22,7,4,-.6,0,TAU);c.fill();}}
      }else if(o.type==='lantern'){
        c.fillStyle='#574e37';c.fillRect(-3,-66,6,68);c.fillRect(-13,-69,26,5);c.fillStyle='#f1cf7c';c.shadowColor='#ffe7a2';c.shadowBlur=18;c.fillRect(-7,-62,14,18);c.shadowBlur=0;c.strokeStyle='#554a35';c.lineWidth=2;c.strokeRect(-9,-64,18,22);
      }else if(o.type==='signpost'){
        c.fillStyle='#615139';c.fillRect(-4,-63,8,67);c.fillStyle=o.hostile?'#8f6250':'#b9a478';c.beginPath();c.moveTo(-29,-60);c.lineTo(23,-60);c.lineTo(36,-50);c.lineTo(23,-40);c.lineTo(-29,-40);c.closePath();c.fill();c.strokeStyle='#ead2a0';c.lineWidth=2;c.beginPath();c.moveTo(-19,-51);c.lineTo(19,-51);c.stroke();
      }else if(o.type==='supplyStack'){
        for(let i=0;i<3;i++){const x=-34+i*23,y=i===1?-40:-24;c.fillStyle='#8a7955';c.fillRect(x,y,30,30);c.strokeStyle='#c1ad7d';c.lineWidth=3;c.strokeRect(x,y,30,30);c.beginPath();c.moveTo(x,y);c.lineTo(x+30,y+30);c.stroke();}
      }c.restore();
      if(o.type==='signpost'&&(this.game.players||[]).some(p=>Math.hypot(p.x-o.x,p.y-o.y)<130))this.worldLabel(o.label,o.x,o.y-83,o.hostile?'#f0b394':'#e8dab3',10);
    }
    illustratedEnemyFrame(e) {
      const role=e.role||OW.Content?.enemies?.[e.type]?.role;
      const spec=e.dungeonBoss&&GUARDIAN_ART[e.guardian]?{...GUARDIAN_ART[e.guardian],key:'cavernGuardians',row:e.guardian}:ENEMY_ART[role];
      if(!spec)return null;
      const time=e.moveTime??this.clock,attackTime=e.animTime??this.clock;
      const moving=Math.hypot(e.velocityX||0,e.velocityY||0)>8||e.anim==='run'||e.anim==='walk'||(!e.dungeonBoss&&['patrol','chase','flank'].includes(e.state));
      const rolling=e.combatState==='rolling'||e.dungeonBoss&&e.guardian===0&&e.charging>0;
      const worldTime=this.game?.time??this.clock;
      let col=moving?1+Math.floor(time*9)%2:0;
      if(rolling||e.charging>0)col=4+Math.floor(this.clock*12)%2;
      else if(e.hit>.03||e.anim==='hurt'||e.anim==='death')col=7;
      else if(e.artAttackUntil>worldTime&&['enemyCoastal','enemyDeep'].includes(spec.key))col=4+(e.artAttackPose??Math.floor(attackTime*12)%2);
      else if(e.windup||e.combatState==='windup'||e.combatState==='strike'&&!['enemyCoastal','enemyDeep'].includes(spec.key)||e.specialMove?.windup>0||e.anim==='windup')col=3;
      else if(e.artAttackUntil>worldTime||e.attackVisual>0||e.specialMove||['shoot','melee','heavy','special','ability','jump','charge'].includes(e.anim)&&!(e.combatState==='recovery'&&attackTime>.2))col=4+Math.floor(attackTime*12)%2;
      else if(e.artRecoverUntil>worldTime||e.combatState==='recovery'||e.anim==='land'||e.stun>0)col=6;
      return {...spec,art:true,role,col,cols:8,rows:OW.Art?.groups?.[spec.key]?.length||4,rolling};
    }
    drawIllustratedEnemy(e,frame=this.illustratedEnemyFrame(e),options={}) {
      if(!frame||!OW.Art?.draw)return false;
      const rolling=frame.rolling,angle=e.angle||0,flip=Math.cos(angle)<0;
      const jumpHeight=Math.max(0,e.jumpHeight||0),alpha=e.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1;
      // Tucked roll poses rotate around their centre; upright poses retain a
      // stable floor anchor rather than tilting with the actor's aim direction.
      const rollSize=e.dungeonBoss?116:59;
      const w=rolling?rollSize:frame.w,h=rolling?rollSize:frame.h;
      const y=e.y+3-jumpHeight-(rolling?rollSize*.5:0);
      const rotation=rolling?this.clock*16*(Math.cos(e.rollAngle??e.chargeAngle??angle)<0?-1:1):e.combatState==='recovery'?Math.sin(this.clock*13)*.045:0;
      return OW.Art.draw(this,frame.key,frame.col,frame.row,e.x,y,w,h,{py:rolling?.5:1,flip:rolling?false:flip,angle:rotation,alpha,glow:e.hit>0?'#fff0c3':undefined,...options});
    }
    actorFrame(e,isPlayer,legacyOnly=false) {
      const moving=Math.hypot(e.velocityX||0,e.velocityY||0)>8||e.anim==='run'||e.anim==='walk'||e.state==='patrol'||e.state==='chase'||e.state==='flank';
      const moveTime=e.moveTime??this.clock+(typeof e.id==='number'?e.id*.17:0),outfit=['Scout','Ranger','Vanguard'][clamp(Math.floor(e.armorSet||0),0,2)],sheet=((e.skin||0)%2?'white':'orange')+outfit;
      if(isPlayer&&this.images.bodies){
        let col=moving?1+Math.floor(moveTime*11)%4:0;
        if(e.downed||e.anim==='death')col=7;else if(e.anim==='hurt')col=6;else if(e.dodgeTime>0||e.anim==='dodge')col=5;
        const row=((e.skin||0)%2)*3+clamp(Math.floor(e.armorSet||0),0,2);
        return {key:'bodies',col,row,cols:8,rows:6,modular:true,crop:BODY_FRAMES[row][col]};
      }
      if(!isPlayer&&!legacyOnly&&OW.Art?.draw){const art=this.illustratedEnemyFrame(e);if(art&&this.images[art.key])return art;}
      if(!isPlayer&&e.type>=24&&e.type<30&&this.images.specialists){
        const cols={windup:3,jump:4,charge:4,special:5,shoot:5,melee:5,land:6,hurt:7,death:7};
        return {key:'specialists',row:e.type-24,col:cols[e.anim]??(moving?1+Math.floor(moveTime*9)%2:0),cols:8,rows:6};
      }
      if(isPlayer&&this.images[sheet]&&!['melee','heavy','hurt','death','revive','ability'].includes(e.anim)&&!e.downed){
        const kind=OW.Content?.weapons?.[e.weapon||0]?.kind||'pistol',row=kind==='rocket'?4:kind==='shotgun'?3:kind==='smg'||kind==='lmg'?1:/rifle|sniper|plasma|flame/.test(kind)?2:0;
        let col=moving?1+Math.floor(moveTime*11)%4:0;
        if(e.anim==='aim'&&!moving)col=5;else if(e.anim==='shoot'&&(!moving||(e.animTime||0)<.09))col=6;else if(e.anim==='reload'||e.reloading)col=7;
        return {key:sheet,col,row,cols:8,rows:5};
      }
      const type=isPlayer?((e.skin||0)%2)*2:e.boss||e.type===7||e.type>=16?6:4;
      let row=type,col=0;const t=e.animTime??this.clock;
      if(moving)col=Math.floor(moveTime*11)%8;else{row=type+1;col=Math.floor(this.clock*1.5)%2;}
      if((['shoot','aim','melee','heavy','reload','hurt','ability','death','revive'].includes(e.anim)&&!(moving&&(e.anim==='shoot'&&t>=.09||e.anim==='aim')))||e.reloading){
        row=type+1;
        if(e.anim==='shoot')col=2+Math.floor(t*18)%2;
        else if(e.anim==='melee'||e.anim==='heavy')col=4+(Math.floor(t*11)%2);
        else if(e.anim==='reload'||e.reloading)col=6;
        else if(e.anim==='hurt'||e.anim==='death')col=7;
        else if(e.anim==='ability')col=4;
        else col=0;
      }
      return {key:'actors',row,col,cols:8,rows:8};
    }
    playerShoulder(e,jumpHeight=0) {
      const f=this.actorFrame(e,true),row=f.row,col=Math.min(f.col,6),joint=BODY_SHOULDERS[row][col];
      const scale=68/BODY_HEIGHTS[row],flip=Math.cos(e.angle||0)<0;
      const localX=(joint[0]-(col+.5)*181)*scale*(flip?-1:1),localY=(joint[1]-BODY_BASELINES[row])*scale;
      const lean=e.dodgeTime>0||e.anim==='dodge'?Math.sin(this.clock*30)*.13:0;
      return {x:e.x+localX*Math.cos(lean)-localY*Math.sin(lean),y:e.y+3-jumpHeight+localX*Math.sin(lean)+localY*Math.cos(lean),row,col};
    }
    playerArmPose(e,size=77,jumpHeight=0) {
      const kind=OW.Content?.weapons?.[e.weapon||0]?.kind||'pistol',melee=e.anim==='melee'||e.anim==='heavy';
      const col=melee?5:kind==='rocket'?4:kind==='shotgun'?3:kind==='smg'||kind==='lmg'?1:/rifle|sniper|plasma|flame/.test(kind)?2:0;
      const joint=this.playerShoulder(e,jumpHeight),row=joint.row,t=e.animTime||0;
      let angle=e.angle||0;
      if(melee)angle+=Math.sin(clamp(t/.24,0,1)*Math.PI-Math.PI*.5)*(e.anim==='heavy'?1.8:1.3);
      if(e.reloading>0||e.anim==='reload')angle+=Math.sin(this.clock*9)*.12+.35;
      // Recoil rotates around the shoulder; translating the complete arm used
      // to pull its sleeve away from the body each time the player fired.
      if(e.anim==='shoot'&&t<.1)angle-=(Math.cos(angle)<0?-1:1)*(1-t/.1)*.075;
      const flip=Math.cos(angle)<0,rotation=angle-(flip?(angle>=0?Math.PI:-Math.PI):0),bounds=ARM_BOUNDS[col],sw=bounds[1]-bounds[0],w=size*.84*sw/209;
      return {...joint,weaponCol:col,melee,angle,rotation,flip,sx:bounds[0],sy:ARM_ROWS[row],sw,w,h:w*140/sw,px:31/sw,py:56/140};
    }
    drawPlayerArms(e,size,jumpHeight) {
      if(!this.images.arms||e.downed||e.anim==='death')return;
      const p=this.playerArmPose(e,size,jumpHeight);
      this.sprite('arms',p.weaponCol,p.row,6,6,p.x,p.y,p.w,p.h,{sx:p.sx,sw:p.sw,sy:p.sy,sh:140,angle:p.rotation,flip:p.flip,px:p.px,py:p.py,alpha:e.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1});
      if(e.charge>0&&!p.melee){const power=e.charge/(OW.Content?.weapons?.[e.weapon||0]?.chargeTime||.85);this.sprite('items',4,3,8,4,p.x+Math.cos(p.angle)*43,p.y+Math.sin(p.angle)*43,13+power*14,13+power*14,{angle:this.clock*3,alpha:clamp(power,.25,.85)});}
    }
    friendlyPosition(o) {
      const phase=o.phase||0,t=this.clock*.22+phase,roam=o.roamRadius??35;
      return {x:(o.homeX??o.x)+Math.sin(t)*roam,y:(o.homeY??o.y)+Math.cos(t*.8)*roam*.55,flip:Math.cos(t)<0,walk:Math.sin(this.clock*.4+phase)>-.55};
    }
    npcHasAvailableQuest(o) {
      if(o.type!=='npc'||!this.game?.questProgress)return false;
      if(this.game.availableQuestsForNpc)return this.game.availableQuestsForNpc(o).length>0;
      const content=OW.Content||{},npcId=o.npcId||o.id,profile=(content.npcs||[]).find(n=>n.id===npcId);
      const ids=new Set([...(o.questIds||[]),...(profile?.questIds||[]),...(content.quests||[]).filter(q=>q.giverNpcId===npcId).map(q=>q.id)]);
      return [...ids].some(id=>{const progress=this.game.questProgress(id);return progress?.available&&!progress.complete&&!this.game.completedQuests?.has(id)&&!this.game.acceptedQuests?.has(id);});
    }
    drawFriendly(o,pos) {
      if(!this.images.friendly)return;pos=pos||{x:o.x,y:o.y,flip:Math.cos(o.angle||0)<0,walk:o.anim==='run'||o.anim==='walk'};
      const roles=['trader','blacksmith','farmer','ranger','medic','civilian'],roleAliases={quartermaster:'trader',merchant:'trader',armourer:'blacksmith',engineer:'blacksmith',scout:'ranger',captain:'ranger',courier:'ranger',doctor:'medic',villager:'civilian'};
      const row=clamp(typeof o.friendlyRole==='number'?o.friendlyRole:typeof o.portrait==='number'?o.portrait%6:typeof o.role==='number'?o.role:Math.max(0,roles.indexOf(roleAliases[o.role]||o.role||'civilian')),0,5);
      const col=pos.walk?1+Math.floor((o.moveTime??this.clock+(o.phase||0))*6)%3:0,src=FRIENDLY_FRAMES[row][col],scale=59/FRIENDLY_HEIGHTS[row],availableQuest=this.npcHasAvailableQuest(o);
      if(availableQuest){const c=this.ctx;c.save();c.globalAlpha=.09+Math.sin(this.clock*2.3)*.018;c.fillStyle='#ffe3a1';c.beginPath();c.ellipse(pos.x,pos.y-26,32,36,0,0,TAU);c.fill();c.restore();}
      this.shadow(pos.x,pos.y,16,6,.2);this.sprite('friendly',col,row,4,6,pos.x,pos.y+2,src[2]*scale,src[3]*scale,{sx:src[0],sy:src[1],sw:src[2],sh:src[3],px:((col+.5)*256-src[0])/src[2],py:(FRIENDLY_BASELINES[row]-src[1])/src[3],flip:pos.flip,glow:availableQuest?'rgba(255,218,132,.65)':undefined});
      if(availableQuest)this.drawQuestAvailable(pos.x,pos.y);
      if(o.hp!=null){const c=this.ctx,w=51;c.fillStyle='#183d3e';c.fillRect(pos.x-w/2,pos.y-68,w,5);c.fillStyle='#86d6a3';c.fillRect(pos.x-w/2,pos.y-68,w*clamp(o.hp/(o.maxHp||o.hp||1),0,1),5);c.textAlign='center';c.font='700 10px system-ui';c.strokeStyle='#17303a';c.lineWidth=3;c.fillStyle='#c4f1d1';const text=o.name||'RESISTANCE ESCORT';c.strokeText(text,pos.x,pos.y-76);c.fillText(text,pos.x,pos.y-76);}
      const near=(this.game?.players||[]).some(p=>!p.downed&&Math.hypot(p.x-pos.x,p.y-pos.y)<185);
      if(o.type==='npc'&&near){
        const hasQuest=availableQuest;
        this.worldLabel(o.name||'Resistance Cat',pos.x,pos.y-72,hasQuest?'#ffe296':'#c6efdc',11);
        this.worldLabel('E / B · Talk',pos.x,pos.y+24,'#f4e8bf',10);
        const lines=Array.isArray(o.dialogue)?o.dialogue:[];
        if(!hasQuest&&lines.length&&Math.floor(this.clock)%10<5)this.speechBubble(lines[Math.floor(this.clock/10)%lines.length],pos.x,pos.y-96);
      }
    }
    drawQuestAvailable(x,y){
      const c=this.ctx,bob=Math.sin(this.clock*3)*4,cy=y-112+bob;c.save();c.translate(x,cy);c.shadowColor='#ffc75b';c.shadowBlur=13;c.fillStyle='#17322ff2';c.strokeStyle='#ffdb7c';c.lineWidth=2.5;c.beginPath();c.moveTo(0,-28);c.lineTo(23,0);c.lineTo(0,28);c.lineTo(-23,0);c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.font='900 39px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe99b';c.fillText('!',0,-1);c.restore();
    }
    worldLabel(text,x,y,color='#f5e3af',size=11) {
      const c=this.ctx;c.save();c.font='700 '+size+'px system-ui';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#183139';c.fillStyle=color;c.strokeText(text,x,y);c.fillText(text,x,y);c.restore();
    }
    speechBubble(text,x,y) {
      const c=this.ctx,words=String(text||'').split(/\s+/),lines=[];let line='';
      for(const word of words){if((line+' '+word).trim().length>36&&line){lines.push(line);line=word;if(lines.length===2)break;}else line=(line+' '+word).trim();}
      if(lines.length<2&&line)lines.push(line);if(!lines.length)return;
      if(words.join(' ').length>lines.join(' ').length)lines[lines.length-1]+='…';
      const w=Math.min(250,Math.max(...lines.map(t=>t.length))*5.4+22),h=lines.length*15+16;
      c.save();c.fillStyle='rgba(241,237,210,.96)';c.strokeStyle='#36554f';c.lineWidth=2;c.beginPath();c.roundRect(x-w/2,y-h,w,h,9);c.fill();c.stroke();c.beginPath();c.moveTo(x-6,y);c.lineTo(x,y+8);c.lineTo(x+7,y);c.fill();c.font='600 10px system-ui';c.textAlign='center';c.fillStyle='#253f42';lines.forEach((l,i)=>c.fillText(l,x,y-h+18+i*15));c.restore();
    }
    drawObjective(o,world) {
      const q=OW.Content?.quests?.find(q=>q.id===o.questId),run=this.game.missionRuns?.[o.questId];
      if(!q||!run||run.state!=='active')return;
      const step=q.steps?.[run.stepIndex||0],id=o.locationId||o.id.replace(/_prop$/,'');
      // A transmitter can be activated and then defended in separate steps.
      // Its original placement step is metadata; current targets own visibility.
      if(!step?.targets?.includes(id)||Array.isArray(run.completedTargets)&&run.completedTargets.includes(id))return;
      const c=this.ctx,kind=o.displayType||'parcel',pulse=1+Math.sin(this.clock*3)*.08;
      c.save();c.strokeStyle='#f6d78b';c.fillStyle='rgba(246,215,139,.1)';c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();c.ellipse(o.x,o.y+2,35*pulse,19*pulse,0,0,TAU);c.fill();c.stroke();c.restore();
      if(kind==='wounded')this.drawFriendly({role:'medic',name:'Wounded resistance cat'},{x:o.x,y:o.y,flip:false,walk:false});
      else if(kind==='relay'||kind==='signal')this.sprite('scenery',4,2,6,4,o.x,o.y,72,95,{py:.8});
      else if(kind==='terminal'){
        this.sprite('scenery',3,3,6,4,o.x,o.y,65,65,{py:.7});c.save();c.fillStyle='#223d3f';c.fillRect(o.x-18,o.y-49,36,24);c.strokeStyle='#a6e6c3';c.lineWidth=2;c.strokeRect(o.x-18,o.y-49,36,24);c.fillStyle='#8ce8b1';for(let i=0;i<3;i++)c.fillRect(o.x-12,o.y-43+i*6,14+i*3,2);c.restore();
      }else{this.sprite('scenery',kind==='charge'?3:2,3,6,4,o.x,o.y,58,58,{py:.7});if(kind==='charge')this.sprite('items',4,1,8,4,o.x,o.y-25,25,25);}
      this.worldLabel(step.label||o.label||'Mission objective',o.x,o.y-90,'#ffe29a',11);
      if((this.game.players||[]).some(p=>!p.downed&&Math.hypot(p.x-o.x,p.y-o.y)<130))this.worldLabel('E / B · '+(step.action||o.action||'Interact').replace(/_/g,' '),o.x,o.y+36,'#fff1ca',11);
    }
    drawBountyBoard(o) {
      const c=this.ctx;this.shadow(o.x,o.y,48,12,.2);c.save();c.fillStyle='#483d2c';c.fillRect(o.x-39,o.y-66,7,72);c.fillRect(o.x+32,o.y-66,7,72);c.fillStyle='#6e5036';c.fillRect(o.x-62,o.y-100,124,76);c.strokeStyle='#c8a56c';c.lineWidth=3;c.strokeRect(o.x-62,o.y-100,124,76);
      for(let i=0;i<4;i++){const x=o.x-51+i*28;c.fillStyle='#ddc392';c.fillRect(x,o.y-88,23,46);c.fillStyle='#705545';c.beginPath();c.arc(x+11.5,o.y-75,6,0,TAU);c.fill();c.fillRect(x+6,o.y-69,11,12);c.fillRect(x+4,o.y-52,15,2);}
      c.restore();this.worldLabel('BOUNTY CENTER',o.x,o.y-112,'#ffe09a',12);
      if((this.game.players||[]).some(p=>Math.hypot(p.x-o.x,p.y-o.y)<180))this.worldLabel('E / B · Boss posters & locations',o.x,o.y+28,'#fff0c4',11);
    }
    drawCampaignBoundaries(world) {
      const sectors=world.sectors||OW.Content?.sectors||[],c=this.ctx;
      for(const s of sectors){
        if(s.id!=='berlin'||s.x>this.view.x+this.view.w||s.x+s.w<this.view.x||s.y>this.view.y+this.view.h||s.y+s.h<this.view.y)continue;
        const unlocked=!!(this.game.berlinUnlocked?.()??world.berlinUnlocked?.()),color=unlocked?'#9dddbf':'#e6a672',gate=s.gate||{x:s.x,y:s.y+s.h*.5};
        c.save();c.strokeStyle='#3a4141';c.lineWidth=22;c.strokeRect(s.x,s.y,s.w,s.h);c.strokeStyle='#9a8a71';c.lineWidth=4;c.setLineDash([14,10]);c.strokeRect(s.x,s.y,s.w,s.h);c.setLineDash([]);
        // The single west gate is visibly sealed until every regional boss falls.
        c.fillStyle=unlocked?'#788271':'#443e40';c.fillRect(gate.x-16,gate.y-78,32,156);c.strokeStyle=color;c.lineWidth=4;
        if(!unlocked){for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(gate.x-23,gate.y+i*20-9);c.lineTo(gate.x+23,gate.y+i*20+9);c.stroke();}}else{c.fillStyle='#859180';c.fillRect(gate.x-18,gate.y-72,36,144);c.strokeRect(gate.x-18,gate.y-72,36,144);}
        c.restore();this.worldLabel('BERLIN SECTOR',gate.x,gate.y-112,color,14);this.worldLabel(unlocked?'GATE OPEN · Adolph Whisker awaits':'LOCKED · Defeat all 8 regional bosses',gate.x,gate.y-92,color,11);
      }
    }
    drawActor(e,isPlayer=false,index=0) {
      if(e.alive===false||(!isPlayer&&e.hp<=0))return;
      if(isPlayer&&e.harpoonPull&&!e.downed)this.drawHarpoonTether(e);
      const c=this.ctx,f=this.actorFrame(e,isPlayer),ang=e.angle||0,flip=Math.cos(ang)<0;
      let size=f.art?f.h:e.boss?118:isPlayer?77:67; if(!isPlayer&&!f.art&&[6,14,15].includes(e.type))size*=1.14;
      const dodging=e.dodgeTime>0||e.anim==='dodge';const downed=e.downed||e.anim==='death';
      if(isPlayer){c.save();c.strokeStyle=index?'rgba(103,210,244,.72)':'rgba(244,202,103,.72)';c.lineWidth=2;c.beginPath();c.ellipse(e.x,e.y+4,22,11,0,0,TAU);c.stroke();c.restore();}
      this.shadow(e.x,e.y,size*.27,size*.095,dodging?.13:.26);
      const jumpHeight=Math.max(0,e.jumpHeight||0),lean=f.modular?(dodging?Math.sin(this.clock*30)*.13:0):downed?Math.PI*.43:dodging?Math.sin(this.clock*30)*.65:Math.sin(ang)*(flip?-.16:.16);
      let frameW=size,frameH=size,frameOptions={py:.86};
      if(f.crop){const q=f.crop,scale=68/BODY_HEIGHTS[f.row];frameW=q[2]*scale;frameH=q[3]*scale;frameOptions={sx:q[0],sy:q[1],sw:q[2],sh:q[3],px:((f.col+.5)*181-q[0])/q[2],py:(BODY_BASELINES[f.row]-q[1])/q[3]};}
      if(dodging&&this.game.settings?.quality!=='low'){
        for(let i=2;i>0;i--){const x=e.x-Math.cos(ang)*i*9,y=e.y-Math.sin(ang)*i*7;if(f.art)this.drawIllustratedEnemy({...e,x,y},f,{alpha:.14});else this.sprite(f.key,f.col,f.row,f.cols,f.rows,x,y,frameW,frameH,{...frameOptions,flip,angle:lean,alpha:.14});}
      }
      const blink=e.invuln>0&&Math.floor(this.clock*18)%2===0;
      const rolling=!isPlayer&&e.combatState==='rolling';
      const illustrated=f.art&&this.drawIllustratedEnemy(e,f);
      if(illustrated){if(rolling)this.drawRollTrail(e);}
      else if(rolling)this.drawRollingMouse(e);
      else {const legacy=f.art?this.actorFrame(e,false,true):f;this.sprite(legacy.key,legacy.col,legacy.row,legacy.cols,legacy.rows,e.x,e.y+3-jumpHeight,frameW,frameH,{...frameOptions,flip,angle:lean+(e.combatState==='recovery'?Math.sin(this.clock*13)*.13:0),alpha:blink?.5:1,glow:e.hit>0?'#fff3a1':undefined});}
      if(!isPlayer){if(!illustrated)this.drawEnemyAccents(e,rolling);this.drawEnemyStatus(e);}
      if(f.modular)this.drawPlayerArms(e,size,jumpHeight);
      if(!isPlayer&&(e.hp<e.maxHp||e.boss||e.hit>0)){const w=e.boss?88:40;c.fillStyle='#243139';c.fillRect(e.x-w/2,e.y-size*.86-10,w,5);c.fillStyle=e.boss?'#efac5a':'#e76e57';c.fillRect(e.x-w/2,e.y-size*.86-10,w*clamp(e.hp/e.maxHp,0,1),5);}
      if(!isPlayer&&!e.boss&&e.type>=24){const def=OW.Content?.enemies?.[e.type];if(def){const roleNames={mortar:'MORTAR',frost:'FROST',stormcaller:'STORM',bombardier:'CLUSTER',bulwark:'SHIELD',skirmisher:'DASH',leaper:'LEAP',bruiser:'SHOCK',sapper:'MINES',jammer:'JAMMER',duelist:'BLADE',hunter:'SNARE'};this.worldLabel(roleNames[def.role]||def.name.toUpperCase(),e.x,e.y-size*.86-21,def.color||'#eac88e',9);}}
      if(isPlayer){c.save();c.font='700 10px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#10212c';c.fillStyle=index?'#9fddf6':'#f7dd97';const text=downed?'HOLD INTERACT TO REVIVE':'P'+(index+1);c.strokeText(text,e.x,e.y-size*.88-7);c.fillText(text,e.x,e.y-size*.88-7);c.restore();}
      if(e.boss){c.save();c.textAlign='center';c.font='700 11px system-ui';c.fillStyle='#ffe1a3';c.shadowColor='#142026';c.shadowBlur=5;c.fillText(e.name||OW.Content?.enemies?.[e.type]?.name||'COMMANDER',e.x,e.y-size*.86-18);c.restore();if(e.phase)this.worldLabel('PHASE '+e.phase+' / '+(e.bossIndex===8?4:3),e.x,e.y-size*.86-33,'#f5aa98',10);}
    }
    drawHarpoonTether(player){
      const pull=player.harpoonPull,source=this.game.world.activeEnemies.find(e=>e.id===pull.sourceId&&e.hp>0&&!e.dead);if(!source)return;
      const c=this.ctx,x=source.x+Math.cos(source.angle||0)*24,y=source.y-24,px=player.x,py=player.y-25;
      c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(x,y);c.lineTo((x+px)/2,(y+py)/2+7);c.lineTo(px,py);c.strokeStyle='#162e37';c.lineWidth=6;c.stroke();c.strokeStyle='#edce8b';c.lineWidth=2.5;c.stroke();
      c.strokeStyle='#baf3e7';c.lineWidth=2;c.beginPath();c.moveTo(px-5,py-5);c.lineTo(px+5,py+5);c.moveTo(px+5,py-5);c.lineTo(px-5,py+5);c.stroke();c.restore();
    }
    drawRollingMouse(e) {
      const c=this.ctx;c.save();c.translate(e.x,e.y-21);c.rotate(this.clock*16);c.fillStyle='#788c90';c.strokeStyle='#d5e6dc';c.lineWidth=3;c.beginPath();c.arc(0,0,26,0,TAU);c.fill();c.stroke();
      c.strokeStyle='#364b53';c.lineWidth=5;for(let n=0;n<4;n++){c.beginPath();c.ellipse(0,0,10,23,n*Math.PI/4,0,TAU);c.stroke();}c.fillStyle='#d1b9a0';c.beginPath();c.arc(8,-8,7,0,TAU);c.fill();c.restore();
      this.drawRollTrail(e);
    }
    drawRollTrail(e) {
      const c=this.ctx;
      c.save();c.strokeStyle='#dcebd5';c.lineWidth=2;const angle=e.rollAngle||0;for(let n=0;n<3;n++){const x=e.x-Math.cos(angle)*(33+n*12),y=e.y-21-Math.sin(angle)*(33+n*12);c.beginPath();c.moveTo(x-Math.sin(angle)*11,y+Math.cos(angle)*11);c.lineTo(x+Math.sin(angle)*11,y-Math.cos(angle)*11);c.stroke();}c.restore();
    }
    drawEnemyAccents(e,rolling) {
      const role=e.role||OW.Content?.enemies?.[e.type]?.role,c=this.ctx;if(rolling)return;
      if(role==='fencer'||role==='voidknight'){
        const a=e.angle||0,x=e.x+Math.cos(a)*12,y=e.y-28+Math.sin(a)*12;c.save();c.strokeStyle=role==='voidknight'?'#b59cff':'#e8eee0';c.lineWidth=role==='voidknight'?4:2;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*52,y+Math.sin(a)*52);c.stroke();c.strokeStyle='#e3bf75';c.lineWidth=3;c.beginPath();c.moveTo(x-Math.sin(a)*9,y+Math.cos(a)*9);c.lineTo(x+Math.sin(a)*9,y-Math.cos(a)*9);c.stroke();c.restore();
      }else if(role==='blinkstalker'){
        c.save();c.strokeStyle='#c2a3f2';c.lineWidth=2;c.setLineDash([5,6]);c.lineDashOffset=-this.clock*18;c.beginPath();c.ellipse(e.x,e.y-23,29,39,0,0,TAU);c.stroke();c.restore();
      }else if(role==='roller'){
        c.save();c.strokeStyle='#a8c1c1';c.lineWidth=5;c.beginPath();c.arc(e.x,e.y-29,24,.2,Math.PI-.2);c.stroke();c.restore();
      }else if(['burrowrat','cinderbeast','venomrat','frostwarden'].includes(role)){
        const color={burrowrat:'#c3a984',cinderbeast:'#f5a667',venomrat:'#a8d66f',frostwarden:'#a6e5ef'}[role];c.save();c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.moveTo(e.x-13,e.y-8);c.quadraticCurveTo(e.x-44,e.y-1,e.x-40,e.y-30);c.stroke();c.fillStyle=color;for(const side of [-1,1]){c.beginPath();c.moveTo(e.x+side*10,e.y-55);c.lineTo(e.x+side*22,e.y-76);c.lineTo(e.x+side*27,e.y-51);c.closePath();c.fill();}c.restore();
      }
    }
    drawEnemyStatus(e) {
      const c=this.ctx;if(e.freeze>0||e.chillTime>0){if(!this.drawArtEffect(2,1,e.x,e.y-24,82,81,{alpha:e.freeze>0?.72:.32})){c.save();c.fillStyle=e.freeze>0?'#8ed9e969':'#8ed9e928';c.strokeStyle='#c1f3ff';c.lineWidth=2;c.beginPath();c.moveTo(e.x-25,e.y+2);c.lineTo(e.x-30,e.y-41);c.lineTo(e.x-8,e.y-65);c.lineTo(e.x+24,e.y-47);c.lineTo(e.x+29,e.y+2);c.closePath();c.fill();c.stroke();c.restore();}}
      if(e.poison>0){this.drawArtEffect(3,1,e.x,e.y-17,53,57,{alpha:.28,angle:Math.sin(this.clock*.9)*.1});c.save();c.fillStyle='#bfe987';for(let n=0;n<3;n++){c.globalAlpha=.65;c.beginPath();c.arc(e.x+Math.sin(this.clock*2+n*2)*22,e.y-18-((this.clock*17+n*13)%42),2.5,0,TAU);c.fill();}c.restore();}
      if(e.burn>0){if(!this.drawArtEffect(3,2,e.x,e.y-14,61,59,{alpha:.62+Math.sin(this.clock*16)*.08})){c.save();c.fillStyle='#f7ab4d';for(let n=0;n<3;n++){const x=e.x-14+n*14;c.beginPath();c.moveTo(x-5,e.y-5);c.quadraticCurveTo(x-9,e.y-18,x+Math.sin(this.clock*12+n)*6,e.y-33);c.quadraticCurveTo(x+9,e.y-13,x+5,e.y-5);c.fill();}c.restore();}}
    }
    drawDrop(d) {
      const t=this.clock+(d.x||0)*.02,y=d.y+Math.sin(t*3)*4;let col=2,row=3;
      if(d.type==='ammo')col=1;else if(d.type==='health'||d.type==='medkit')col=0;else if(d.type==='material'||d.type==='materials')col=3;
      else if(d.type==='equipment'||d.type==='item'){col=(typeof d.item==='number'?d.item:0)%8;row=0;}
      this.shadow(d.x,d.y+5,12,5,.16);this.sprite('items',6,3,8,4,d.x,d.y-8,43,65,{alpha:.5});this.sprite('items',col,row,8,4,d.x,y-8,35,35);
      if(d.reward)this.drawArtEffect(2,3,d.x,d.y-20,58,74,{alpha:.5+Math.sin(t*3)*.15});
    }
    drawArtEffect(col,row,x,y,w,h,options={}) {
      return !!OW.Art?.draw?.(this,'dungeonFX',col,row,x,y,w,h,options);
    }
    drawLuminousBeam(x,y,tx,ty,color,alpha=1,width=5) {
      const c=this.ctx;c.save();c.lineCap='round';c.lineJoin='round';
      // All three strokes share exact endpoints; artwork supplies light bloom
      // at the ends without stretching a painted beam across collision space.
      c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);
      c.strokeStyle=color||'#9aeaff';c.globalAlpha=alpha*.16;c.lineWidth=width*3.1;c.stroke();
      c.globalAlpha=alpha*.82;c.lineWidth=width;c.stroke();
      c.strokeStyle='#f5ffff';c.globalAlpha=alpha;c.lineWidth=Math.max(1,width*.28);c.stroke();c.restore();
    }
    drawProjectile(p) {
      const c=this.ctx,a=Math.atan2(p.vy||0,p.vx||0),rocket=p.kind==='rocket'||p.kind==='grenade',y=p.y-(p.visualHeight??(p.owner>=0?30:12));
      if(rocket){this.sprite('items',p.kind==='grenade'?4:7,p.kind==='grenade'?1:0,8,4,p.x,y,p.kind==='grenade'?23:42,23,{angle:a});this.sprite('items',7,2,8,4,p.x-Math.cos(a)*16,y-Math.sin(a)*16,28,28,{alpha:.5});}
      else if(p.kind==='flame'){if(!this.drawArtEffect(3,2,p.x,y,34,34,{angle:a,alpha:.8}))this.sprite('items',2,2,8,4,p.x,y,29,29,{angle:a,alpha:.7});}
      else if((p.kind==='ice'||p.freeze)&&this.drawArtEffect(2,1,p.x,y,23,23,{angle:a,alpha:.92}))return;
      else if(p.kind==='plasma'&&this.drawArtEffect(0,1,p.x,y,31,15,{angle:a,alpha:.95}))return;
      else {c.save();c.translate(p.x,y);c.rotate(a);c.shadowColor=p.color||'#ffe9a4';c.shadowBlur=7;c.fillStyle=p.color||(p.owner<0||p.owner==='enemy'?'#f28a62':'#ffe7a3');c.fillRect(-8,-1.4,15,2.8);c.fillStyle='#fff9d0';c.fillRect(2,-1,5,2);c.restore();}
    }
    drawEffect(e,front=false) {
      const c=this.ctx,type=e.type,t=1-clamp((e.life||0)/(e.maxLife||1),0,1),r=e.radius||60;
      if(type==='beam'){
        if(!front)return;const x=e.x,y=e.y-(e.height??12),tx=e.tx??e.x,ty=(e.ty??e.y)-(e.height??0),a=Math.atan2(ty-y,tx-x);
        this.drawLuminousBeam(x,y,tx,ty,e.color||'#9aeaff',1-t,5);
        this.drawArtEffect(0,1,x,y,31,15,{angle:a,alpha:(1-t)*.8});this.drawArtEffect(1,1,tx,ty,40,40,{alpha:(1-t)*.72});return;
      }
      if(type==='hazard'){
        if(front)return;const icy=!!e.slow||/ice|frost|snow/.test(String(e.kind||e.element||''))||e.color==='#9ee1ef'||e.color==='#a9efff'||e.color==='#99dbe9';
        c.save();c.globalAlpha=.35+Math.sin(this.clock*4)*.04;c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.clip();c.fillStyle=this.patterns[icy?7:5]||(icy?'#88dce9':'#6eb96b');c.fillRect(e.x-r,e.y-r,r*2,r*2);c.globalAlpha=.22;c.fillStyle=e.color||(icy?'#a1e7ee':'#76cc65');c.fillRect(e.x-r,e.y-r,r*2,r*2);c.restore();
        c.save();c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.clip();this.drawArtEffect(icy?2:e.fire?3:e.jam?0:2,icy?1:2,e.x,e.y,r*2,r*1.4,{alpha:icy?.6:e.fire?.7:.62});c.restore();
        c.save();c.globalAlpha=.55;c.strokeStyle=e.color||(icy?'#c0f4ff':'#a7da72');c.lineWidth=2;c.setLineDash([8,6]);c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.stroke();c.restore();return;
      }
      if(type==='chargeLane'){
        if(front)return;const tx=e.tx??e.x,ty=e.ty??e.y,a=Math.atan2(ty-e.y,tx-e.x),w=e.width||e.radius||55;
        c.save();c.lineCap='round';c.strokeStyle='rgba(241,111,70,'+(.13+t*.13)+')';c.lineWidth=w;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(tx,ty);c.stroke();c.lineWidth=2;c.setLineDash([13,9]);c.strokeStyle='#ffb06c';c.stroke();c.setLineDash([]);for(let i=1;i<6;i++){const p=i/6,x=e.x+(tx-e.x)*p,y=e.y+(ty-e.y)*p;c.beginPath();c.moveTo(x+Math.cos(a-2.5)*10,y+Math.sin(a-2.5)*10);c.lineTo(x,y);c.lineTo(x+Math.cos(a+2.5)*10,y+Math.sin(a+2.5)*10);c.stroke();}c.restore();return;
      }
      if(type==='telegraph'||type==='airstrike'||type==='mine'||type==='grenade'||type==='meleeWarning'||type==='bossWarning'){
        if(type==='grenade'&&front){const x=(e.startX??e.x)+(e.x-(e.startX??e.x))*t,y=(e.startY??e.y)+(e.y-(e.startY??e.y))*t-Math.sin(t*Math.PI)*130;this.shadow(x,y+Math.sin(t*Math.PI)*130,9,4,.2);this.sprite('items',4,1,8,4,x,y,28,28,{angle:t*10});return;}
        if(type==='bossWarning'&&front){c.save();c.textAlign='center';c.font='800 18px system-ui';c.lineWidth=4;c.strokeStyle='#263239';c.fillStyle='#ffbe78';c.globalAlpha=1-t*.5;c.strokeText(e.text||'INCOMING ATTACK',e.x,e.y-115-t*20);c.fillText(e.text||'INCOMING ATTACK',e.x,e.y-115-t*20);c.restore();return;}
        if(front)return;c.save();c.globalAlpha=(1-t)*.65+.12;c.strokeStyle=type==='mine'?'#ffbd54':'#ff7056';c.fillStyle='rgba(223,65,42,.13)';c.lineWidth=3;c.setLineDash([12,8]);c.beginPath();c.ellipse(e.x,e.y,r,r*.7,0,0,TAU);c.fill();c.stroke();c.setLineDash([]);c.beginPath();c.ellipse(e.x,e.y,r*(1-t),r*(1-t)*.7,0,0,TAU);c.stroke();c.restore();return;
      }
      if(type==='sniper'){if(front)return;c.save();c.globalAlpha=.3+t*.6;c.strokeStyle='#ff6c52';c.lineWidth=2;c.setLineDash([15,10]);c.beginPath();c.moveTo(e.x,e.y-15);c.lineTo(e.tx??e.x,e.ty??e.y);c.stroke();c.setLineDash([]);c.beginPath();c.arc(e.tx??e.x,e.ty??e.y,14*(1-t)+6,0,TAU);c.stroke();c.restore();return;}
      if(front&&type==='lightning'&&Number.isFinite(e.tx)){c.save();c.shadowColor='#b4f7ff';c.shadowBlur=15;c.strokeStyle='#c9fbff';c.lineWidth=3;c.beginPath();c.moveTo(e.x,e.y-15);for(let i=1;i<9;i++){const p=i/8;c.lineTo(e.x+(e.tx-e.x)*p+(i===8?0:(hash(i,this.frame)-.5)*32),e.y-15+(e.ty-e.y)*p+(i===8?0:(hash(i,this.frame+3)-.5)*32));}c.stroke();c.restore();if(!this.drawArtEffect(2,1,e.tx,e.ty-15,52,52,{alpha:1-t}))this.sprite('items',5,3,8,4,e.tx,e.ty-15,55,55,{alpha:1-t});return;}
      if(front&&(type==='burn'||type==='fire')){for(let i=0;i<7;i++){const a=i*2.4,rr=hash(i,e.x)*r,x=e.x+Math.cos(a)*rr,y=e.y+Math.sin(a)*rr*.7-14,pulse=1+Math.sin(this.clock*13+i)*.08;if(!this.drawArtEffect(3,2,x,y,64*pulse,78*pulse,{alpha:.58*(1-t*.5)}))this.sprite('items',1+Math.floor(this.clock*10+i)%4,2,8,4,x,y,65,85,{alpha:.65*(1-t*.5)});}return;}
      if(front&&type==='muzzle'){if(!this.drawArtEffect(1,3,e.x,e.y-(e.height??12),r*1.8,r*1.1,{angle:e.angle||0,alpha:1-t}))this.sprite('items',4,3,8,4,e.x,e.y-(e.height??12),r*1.8,r*1.8,{angle:e.angle||0,alpha:1-t});return;}
      if(front&&type==='impact'){if(!this.drawArtEffect(1,0,e.x,e.y,r*2.8,r*2.8,{alpha:1-t,angle:e.angle||0}))this.sprite('items',7,3,8,4,e.x,e.y,r*2.8,r*2.8,{alpha:1-t,angle:e.angle||0});return;}
      if(front&&type==='defeat'){const f={type:e.typeIndex||0,dungeonBoss:e.dungeonBoss,guardian:e.guardian,x:e.x,y:e.y,anim:'death',animTime:t};const af=this.actorFrame(f,false);if(!af.art||!this.drawIllustratedEnemy(f,af,{alpha:1-t,angle:t*.2})){const legacy=af.art?this.actorFrame(f,false,true):af;this.sprite(legacy.key,legacy.col,legacy.row,legacy.cols,legacy.rows,e.x,e.y,68,68,{py:.8,angle:t*.8,alpha:1-t});}this.sprite('items',7,3,8,4,e.x,e.y,55+t*35,45,{alpha:(1-t)*.5});return;}
      if(type==='reinforcement'){if(!front){this.drawArtEffect(0,2,e.x,e.y+3,r*1.5,r*.85,{alpha:(1-t)*.65});return;}if(!this.drawArtEffect(1,2,e.x,e.y-20,r*1.25,r*1.5,{alpha:(1-t)*.8}))this.sprite('items',5,3,8,4,e.x,e.y-20,r,r,{alpha:(1-t)*.8});return;}
      if(!front&&(type==='explosion'||type==='smoke'||type==='heal'||type==='level'||type==='lightning'||type==='plane'||type==='text'||type==='slash'||type==='shockwave'))return;
      if(front&&type==='explosion'){const f=Math.min(7,Math.floor(t*8)),size=r*(1.4+t*.8);if(!this.drawArtEffect(3,2,e.x,e.y-12,size,size,{alpha:Math.min(1,(1-t)*2),angle:t*.12}))this.sprite('items',f,2,8,4,e.x,e.y-12,size,size,{alpha:Math.min(1,(1-t)*2)});}
      else if(front&&type==='smoke')for(let i=0;i<4;i++)this.sprite('items',5+i%2,2,8,4,e.x+Math.cos(i*2.4)*r*.3,e.y+Math.sin(i*2.4)*r*.2-t*24,r*1.8,r*1.8,{alpha:(1-t)*.55,angle:i});
      else if(front&&(type==='heal'||type==='level'||type==='lightning')){this.sprite('items',type==='level'?6:5,3,8,4,e.x,e.y-20,r*(1+t),r*(1+t),{alpha:1-t,angle:t*.6});}
      else if(front&&type==='shockwave'){c.save();c.globalAlpha=1-t;c.strokeStyle=e.color||'#9ee7ec';c.lineWidth=7*(1-t)+1;c.beginPath();c.ellipse(e.x,e.y,r*t,r*t*.7,0,0,TAU);c.stroke();c.restore();}
      else if(front&&type==='plane'){this.shadow(e.x,e.y+110,100,22,.18);this.sprite('items',7,1,8,4,e.x,e.y-160,210,210,{angle:(e.angle??Math.PI/2)});}
      else if(front&&(type==='slash'||type==='enemySlash')){if(e.windup)return;const a=e.angle||0,x=e.x+Math.cos(a)*r*.38,y=e.y-26+Math.sin(a)*r*.38;if(!this.drawArtEffect(0,3,x,y,r*(e.heavy?1.6:1.3),r*.88,{angle:a,alpha:(1-t)*.66})){c.save();c.globalAlpha=(1-t)*.55;c.strokeStyle=type==='enemySlash'?'#f5c6ac':'#edf5e8';c.lineWidth=e.heavy?5:3;c.lineCap='round';c.beginPath();c.arc(e.x,e.y-26,r*.78,a-.8+t*.2,a+.8+t*.2);c.stroke();c.restore();}}
      else if(front&&type==='text'&&this.game.settings?.damageNumbers!==false){c.save();c.globalAlpha=Math.min(1,(1-t)*2);c.font=(e.crit?'800 22px':'700 16px')+' system-ui';c.textAlign='center';c.strokeStyle='#172c35';c.lineWidth=3;c.fillStyle=e.color||'#fff0c7';c.strokeText(e.text||'',e.x,e.y-24-t*35);c.fillText(e.text||'',e.x,e.y-24-t*35);c.restore();}
    }
    drawParticles() {
      const c=this.ctx,list=this.game.particles||[];let count=0,max=this.game.settings?.quality==='low'?50:200;
      for(const p of list){if(!alive(p)||!this.visible(p.x,p.y,30)||++count>max)continue;c.save();c.globalAlpha=clamp((p.life||.5)/(p.maxLife||1),0,1);c.fillStyle=p.color||'#ead19a';c.beginPath();c.arc(p.x,p.y,p.size||2,0,TAU);c.fill();c.restore();}
    }
    drawLocationLabels(world) {
      const c=this.ctx;
      for(const l of world.locations||[]) {
        // Named cats already own their name, dialogue and interaction prompt.
        if(l.type==='npc')continue;
        if(!this.visible(l.x,l.y,120))continue;
        const near=(this.game.players||[]).some(p=>Math.hypot(p.x-l.x,p.y-l.y)<(l.radius||180)+160);
        if(!near)continue;const cleared=l.type==='cave'?this.game.dungeonStates?.[l.id]?.claimed:l.cleared||world.liberated?.has(l.id);c.save();c.textAlign='center';c.font='700 12px system-ui';c.lineWidth=4;c.strokeStyle='rgba(20,39,43,.9)';c.fillStyle=cleared?'#b8ecc5':l.type==='town'?'#ffe6a8':'#efcfaa';
        const text=(cleared?(l.type==='cave'?'RELIC RECOVERED · ':'LIBERATED · '):'')+l.name;c.strokeText(text,l.x,l.y-(l.radius||150)*.75-40);c.fillText(text,l.x,l.y-(l.radius||150)*.75-40);
        if((this.game.players||[]).some(p=>!p.downed&&Math.hypot(p.x-l.x,p.y-l.y)<(l.type==='town'?250:130))&&(l.type==='town'||l.type==='cache'||l.type==='cave'||cleared)){
          const hint=l.type==='cave'?'E / B · Enter cavern':l.type==='town'||cleared?'E / B · Quartermaster': 'E / B · Recover cache';c.font='700 11px system-ui';c.fillStyle='#fff2c3';c.strokeText(hint,l.x,l.y+65);c.fillText(hint,l.x,l.y+65);
        }c.restore();
      }
    }
    atmosphere(world) {
      const c=this.ctx,g=this.game,region=world.regionAt?.(g.camera?.x||0,g.camera?.y||0),biome=region?.biome;
      if(biome==='snow'&&g.settings?.quality!=='low') {
        c.save();c.fillStyle='rgba(235,248,255,.7)';for(let i=0;i<55;i++){const x=(hash(i,7)*this.width+this.clock*(12+i%7))%this.width,y=(hash(i,9)*this.height+this.clock*(22+i%13))%this.height;c.beginPath();c.arc(x,y,1.3+(i%3)*.5,0,TAU);c.fill();}c.restore();
      }
      const grad=c.createRadialGradient(this.width*.5,this.height*.42,this.height*.1,this.width*.5,this.height*.5,this.width*.8);grad.addColorStop(0,'rgba(10,23,34,0)');grad.addColorStop(1,'rgba(10,23,34,.26)');c.fillStyle=grad;c.fillRect(0,0,this.width,this.height);
      const night=Math.max(0,Math.sin((g.time||0)/300)*.06);if(night){c.fillStyle='rgba(21,33,67,'+night+')';c.fillRect(0,0,this.width,this.height);}
    }
    drawItemReveal(){
      const g=this.game,item=(g.itemReveals||g.world?.itemReveals||[])[0];if(!item||item.life<=0||g.ui?.isOpen)return;
      const c=this.ctx,rarities=['Common','Uncommon','Rare','Epic','Legendary','Mythic'],rank=typeof item.rarity==='number'?clamp(item.rarity,0,5):Math.max(0,rarities.findIndex(r=>r.toLowerCase()===String(item.rarity).toLowerCase())),color=['#c7d3c0','#a8dc8e','#8ed7ef','#d4aeef','#ffd179','#ffb99b'][rank],age=(item.maxLife||5)-item.life,entrance=clamp(age/.22,0,1),alpha=Math.min(entrance,clamp(item.life/.65,0,1)),width=Math.min(440,this.width-30),height=142,x=(this.width-width)/2,y=Math.min(165,this.height*.22)-14*(1-entrance),iconX=x+58,iconY=y+73;
      c.save();c.globalAlpha=alpha;c.shadowColor='#0009';c.shadowBlur=22;c.fillStyle='#102724f5';c.fillRect(x,y,width,height);c.shadowBlur=0;c.strokeStyle=color;c.lineWidth=2;c.strokeRect(x,y,width,height);c.fillStyle=color;c.fillRect(x,y,width,4);
      c.save();c.translate(iconX,iconY);c.strokeStyle=color;c.globalAlpha=alpha*.3;for(let i=0;i<12;i++){const a=i*TAU/12+age*.16;c.beginPath();c.moveTo(Math.cos(a)*31,Math.sin(a)*31);c.lineTo(Math.cos(a)*46,Math.sin(a)*46);c.stroke();}c.restore();
      const definition=(OW.Content?.equipment||[]).find(e=>e.id===item.id),icon=Number.isInteger(item.icon)?item.icon:definition&&g.ui?.iconIndex?g.ui.iconIndex(definition):item.type==='armor'?14:item.type==='helmet'?13:item.type==='melee'?8:item.type==='accessory'?27:3;this.sprite('items',icon%8,Math.floor(icon/8),8,4,iconX,iconY,75,75,{alpha:1});
      const tx=x+112,room=width-128;c.textAlign='left';c.fillStyle=color;c.font='800 10px system-ui';c.fillText('NEW EQUIPMENT · '+rarities[rank].toUpperCase(),tx,y+27,room);c.fillStyle='#fff2d7';c.font='700 21px Georgia';c.fillText(item.name||'New equipment',tx,y+55,room);c.fillStyle='#b8cfbd';c.font='11px system-ui';c.fillText((item.type||'Equipment').toUpperCase()+(item.level?' · LEVEL '+item.level:''),tx,y+76,room);c.fillStyle='#d9decd';c.fillText(String(item.description||'Added to your inventory.').slice(0,68),tx,y+97,room);c.fillStyle=color;c.font='700 10px system-ui';c.fillText('OPEN INVENTORY TO EQUIP',tx,y+119,room);c.globalAlpha=alpha*.5;c.fillRect(x+1,y+height-3,(width-2)*clamp(item.life/(item.maxLife||5),0,1),2);c.restore();
    }
    draw(dt) {
      this.clock+=dt||.016;this.frame++; const c=this.ctx,g=this.game,world=g.world;
      c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#182d35';c.fillRect(0,0,this.width,this.height);
      if(!world)return;
      const cam=g.camera||{x:1100,y:1100,zoom:1},zoom=cam.zoom||1;const shake=(cam.shake||0)*(g.settings?.screenShake===false?0:1);
      this.view={x:cam.x-this.width/(2*zoom)-150,y:cam.y-this.height/(2*zoom)-150,w:this.width/zoom+300,h:this.height/zoom+300};
      c.save();c.translate(this.width/2+(hash(this.frame,1)-.5)*shake,this.height/2+(hash(this.frame,2)-.5)*shake);c.scale(zoom,zoom);c.translate(-cam.x,-cam.y);
      this.drawTerrain(world);
      this.drawCampaignBoundaries(world);
      const missionRuns=Object.values(g.missionRuns||{});
      for(const run of missionRuns)if(run.state==='active'&&run.type==='defend'&&this.visible(run.x,run.y,260)){
        c.save();c.strokeStyle='#a7d4bc';c.fillStyle='rgba(66,142,116,.08)';c.lineWidth=3;c.setLineDash([14,10]);c.lineDashOffset=-this.clock*9;c.beginPath();c.ellipse(run.x,run.y,190,133,0,0,TAU);c.fill();c.stroke();c.setLineDash([]);c.font='700 12px system-ui';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#183739';c.fillStyle='#d1edcf';const label='HOLD AREA · '+Math.ceil(Math.max(0,(run.duration||45)-(run.elapsed||0)))+'s LEFT'+(run.holdInside===false?' · PAUSED':'');c.strokeText(label,run.x,run.y-145);c.fillText(label,run.x,run.y-145);c.restore();for(let i=0;i<3;i++)this.sprite('scenery',3,3,6,4,run.x+(i-1)*50,run.y+25,58,58,{py:.7});
      }
      for(const e of g.effects||[])if(alive(e)&&this.visible(e.x,e.y,e.radius||100))this.drawEffect(e,false);
      for(const d of g.drops||[])if(alive(d)&&this.visible(d.x,d.y,60))this.drawDrop(d);
      let objects=world.getVisibleObjects?world.getVisibleObjects(this.view.x,this.view.y,this.view.w,this.view.h):world.objects||[];
      const stack=[];for(const o of objects)if(this.visible(o.x,o.y,260)&&o.type!=='bridge')stack.push({y:o.type==='friendlyCat'?this.friendlyPosition(o).y:o.y,object:o});
      for(const run of missionRuns)if(run.state==='active'&&run.type==='escort'&&this.visible(run.x,run.y,120))stack.push({y:run.y,escort:run});
      for(const e of world.activeEnemies||[])if(alive(e)&&this.visible(e.x,e.y,160))stack.push({y:e.y,actor:e});
      for(const a of g.allies||[])if(alive(a)&&this.visible(a.x,a.y,160))stack.push({y:a.y,actor:a,ally:true});
      (g.players||[]).forEach((p,i)=>{if(this.visible(p.x,p.y,100))stack.push({y:p.y,actor:p,player:true,index:i});});
      stack.sort((a,b)=>a.y-b.y);for(const s of stack){if(s.object)this.drawObject(s.object,world);else if(s.escort)this.drawFriendly(s.escort);else if(s.ally){this.drawActor(s.actor,true,1);}else this.drawActor(s.actor,s.player,s.index);}
      for(const p of g.projectiles||[])if(alive(p)&&this.visible(p.x,p.y,40))this.drawProjectile(p);
      for(const e of g.effects||[])if(alive(e)&&this.visible(e.x,e.y,e.type==='plane'?2000:(e.radius||100)*2))this.drawEffect(e,true);
      this.drawParticles();this.drawLocationLabels(world);
      (g.players||[]).forEach((p,i)=>{if(!p.usingController||p.downed)return;const r=8/(zoom||1),dist=p.aimDistance||180,x=p.x+Math.cos(p.angle||0)*dist,y=p.y+Math.sin(p.angle||0)*dist;c.save();c.strokeStyle=i?'#8ce2f5':'#ffe0a0';c.lineWidth=1.7/(zoom||1);c.shadowColor='#122b36';c.shadowBlur=3;c.beginPath();c.arc(x,y,r*.6,0,TAU);for(let j=0;j<4;j++){const a=j*Math.PI/2;c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*r*1.65,y+Math.sin(a)*r*1.65);}c.stroke();c.restore();});
      if(g.marker){c.save();c.strokeStyle='#f4d58d';c.lineWidth=3;c.setLineDash([5,5]);c.beginPath();c.ellipse(g.marker.x,g.marker.y,24+Math.sin(this.clock*3)*4,15,0,0,TAU);c.stroke();c.restore();}
      c.restore();this.atmosphere(world);this.drawItemReveal();
    }
    drawMap(ctx,width,height,options={}) {
      const world=this.game.world;if(!world)return;const sx=width/world.width,sy=height/world.height;
      ctx.fillStyle='#10212e';ctx.fillRect(0,0,width,height);ctx.save();ctx.scale(sx,sy);
      const colors=['#718e55','#466b50','#929379','#d2e0dc','#c2a767','#668875','#797e76','#777570'];
      for(const r of world.regions||[]){ctx.fillStyle=r.color||colors[r.index??r.id]||'#647b54';ctx.fillRect(r.x,r.y,r.w,r.h);}
      ctx.lineCap='round';for(const river of world.rivers||[]){ctx.strokeStyle='#4e9da9';ctx.lineWidth=river.width+45;ctx.beginPath();river.points?.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
      for(const road of world.roads||[]){if(road.kind==='local')continue;ctx.strokeStyle=road.kind==='trail'?'#b2b18b':road.kind==='highway'?'#e4d1a0':'#c4b78a';ctx.lineWidth=road.kind==='trail'?15:road.kind==='highway'?45:28;ctx.beginPath();ctx.moveTo(road.x1,road.y1);ctx.lineTo(road.x2,road.y2);ctx.stroke();}
      for(const sector of world.sectors||OW.Content?.sectors||[]){if(sector.id!=='berlin')continue;const unlocked=!!(this.game.berlinUnlocked?.()??world.berlinUnlocked?.());ctx.fillStyle=unlocked?'rgba(123,199,164,.22)':'rgba(154,55,68,.3)';ctx.fillRect(sector.x,sector.y,sector.w,sector.h);ctx.strokeStyle=unlocked?'#b1edc7':'#f2b485';ctx.lineWidth=20;ctx.strokeRect(sector.x,sector.y,sector.w,sector.h);ctx.font='bold 90px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff1c9';ctx.fillText('BERLIN',sector.x+sector.w*.5,sector.y+sector.h*.18);}
      if(options.fog!==false){const size=640;ctx.fillStyle='rgba(11,26,38,.82)';for(let y=0;y<world.height;y+=size)for(let x=0;x<world.width;x+=size){const key=Math.floor(x/size)+','+Math.floor(y/size);if(!world.discovered?.has(key)&&!world.discovered?.has(Math.floor(x/size)+':'+Math.floor(y/size)))ctx.fillRect(x,y,size+1,size+1);}}
      for(const l of world.locations||[]){if(['npc','forge','bounty','objective'].includes(l.type))continue;const discovered=options.fog===false||world.discovered?.has(Math.floor(l.x/640)+','+Math.floor(l.y/640))||world.discovered?.has(Math.floor(l.x/640)+':'+Math.floor(l.y/640));if(!discovered)continue;ctx.fillStyle=l.cleared||world.liberated?.has(l.id)?'#a1d6a0':l.type==='town'?'#f2d38c':l.type==='boss'?'#f16d5f':l.type==='cave'?'#c3a4e4':'#d99364';ctx.beginPath();if(l.type==='cave'){ctx.moveTo(l.x,l.y-80);ctx.lineTo(l.x+65,l.y+45);ctx.lineTo(l.x-65,l.y+45);ctx.closePath();}else ctx.arc(l.x,l.y,l.type==='boss'?78:l.type==='town'?66:40,0,TAU);ctx.fill();}
      (this.game.players||[]).forEach((p,i)=>{ctx.fillStyle=i?'#8be2f3':'#fff3a5';ctx.beginPath();ctx.arc(p.x,p.y,65,0,TAU);ctx.fill();});
      if(this.game.marker){ctx.strokeStyle='#ffe3a1';ctx.lineWidth=26;ctx.beginPath();ctx.arc(this.game.marker.x,this.game.marker.y,100,0,TAU);ctx.stroke();}ctx.restore();
    }
  }
  OW.Renderer=Renderer;
})();
