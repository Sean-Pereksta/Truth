// Repeatable native-canvas comparisons. Set LANDS_GAME_ROOT to a second checkout
// and LANDS_RENDER_OUT to a different directory to capture matching before images.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(process.env.LANDS_GAME_ROOT||fileURLToPath(new URL('../..',import.meta.url)));
const fromGame=file=>pathToFileURL(path.join(root,file)).href;
const {Game,HOUSES}=await import(fromGame('core.js'));
const {Renderer}=await import(fromGame('render.js'));
const raster=createRequire(import.meta.url)(process.env.LANDS_CANVAS_MODULE||'@napi-rs/canvas');
const canvas=(w=1,h=1)=>Object.assign(raster.createCanvas(w,h),{style:{}});
globalThis.Image=raster.Image;
globalThis.Path2D=raster.Path2D;
globalThis.window={devicePixelRatio:1};
globalThis.document={createElement:()=>canvas(),getElementById:()=>null};
const out=process.env.LANDS_RENDER_OUT;
if(out)fs.mkdirSync(out,{recursive:true});
const asset=file=>path.join(root,'assets',file);
const r=new Renderer(canvas());
r.setTerrainAtlases(await raster.loadImage(asset('ground-textures.png')),await raster.loadImage(asset('terrain-props.png')));
r.setTroopAtlas(await raster.loadImage(asset('troops-atlas.png')));
const ids=['infantry','winter_pikeman','river_ranger','sharpshooter','cavalry'];
const art=Object.fromEntries(ids.map(id=>[id,asset('overhaul/'+id+'.png')]));
await Promise.all([r.loadLandsArt(asset('lands-atlas.png')),r.loadLandsGround(asset('lands-ground.png')),
  r.loadBridgeArt(asset('bridges/stone-edges.png')),r.loadHouseEmblems(asset('house-emblems.png')),
  r.loadPaintedTroops(art,ids),r.loadStructures(asset('structures-atlas.png')),r.loadCampaignArt(asset('campaign-structures.png'))]);
if(r.loadBattlefieldArt){
  await Promise.all([r.loadBattlefieldArt(asset('battlefield-slice/ground.png')),r.loadBattlefieldArt(asset('battlefield-slice/details.png'),true)]);
  assert.equal(Object.keys(r.sliceGround).length,6);assert.equal(Object.keys(r.sliceDetails).length,6);
  for(const [kind,sprite] of Object.entries(r.sliceDetails)){
    const pixels=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data;
    let transparent=0,painted=0;
    for(let i=3;i<pixels.length;i+=4){if(pixels[i]<12)transparent++;if(pixels[i]>80)painted++;}
    assert.ok(transparent>pixels.length/400&&painted>pixels.length/400,kind+' has a painted silhouette and a clear cutout');
  }
}
if(r.loadBattlefieldProjectiles)await r.loadBattlefieldProjectiles(asset('battlefield-slice/projectiles.png'));

const width=800,height=440;
r.resize(width,height,1);
for(const [landscape,name] of [['riverlands','Willow Bridge'],['riverlands','Willow Ford'],['highlands','High King Pass']]){
  const g=new Game({landscape,scale:'standard',house:HOUSES.findIndex(h=>h.sigil==='wolf'),enemies:1,seed:44277,fogOfWar:false});
  const mark=g.landmarks.find(m=>m.name===name);
  assert.ok(mark);
  g.units=[];g.buildings=[];g.castles=[];g.objectives=[];g.standards=[];g.byId.clear();
  for(const team of g.teams){team.count=0;team.alive=true;team.aiClock=99999;}
  Object.assign(g.teams[1],HOUSES.find(h=>h.sigil==='fish'));
  const selected=new Set();
  for(let lane=0;lane<4;lane++){
    const lateral=(lane-1.5)*.95;
    for(const [along,type,team] of [[-2.8,'winter_pikeman',0],[-1.4,'infantry',0],[1.4,'infantry',1],[3,'river_ranger',1],[4.35,'sharpshooter',1],[-5,'cavalry',0]]){
      const x=mark.x+(mark.axis==='x'?along:lateral),y=mark.y+(mark.axis==='x'?lateral:along);
      const u=g.addUnit(team,type,x,y);
      assert.ok(g.isWalkable(u.x,u.y));
      u.order={mode:'attack',x:mark.x,y:mark.y};
      u.facingX=mark.axis==='x'?(team?-1:1):0;u.facingY=mark.axis==='y'?(team?-1:1):0;
      if(team===0&&lane===2)selected.add(u.id);
    }
  }
  g.hash.rebuild(g.units);g.vision.update(true);
  // Capture a real combat step with cooldowns, visibility and release times intact.
  for(let i=0;i<20;i++)g.update(1/30);
  assert.ok(g.units.some(u=>u.attackVisual||u.crossbowAim||u.reloading),'battle has started');
  const slug=name.toLowerCase().replaceAll(' ','-');
  for(const [label,zoom] of [['overview',.43],['normal',1],['close',1.8]]){
    const view={x:(mark.x-mark.y)*28,y:(mark.x+mark.y)*14-12,w:width,h:height,dpr:1,zoom};
    for(const quality of ['auto','high','performance']){
      const ui={selected,selectedBuildings:new Set(),quality,lowDetail:quality==='performance',showGrid:false};
      r.draw(g,view,ui);
      if(r.sliceGround){
        const samples=g.tiles.filter(t=>t.feature===mark.kind);
        assert.ok(samples.length>0);
        if(mark.kind!=='bridge')assert.ok(r.battlefieldTile(g,samples[0]),'Painted material covers '+name);
      }
      if(out)fs.writeFileSync(path.join(out,slug+'-'+label+'-'+quality+'.png'),r.canvas.toBuffer('image/png'));
    }
  }
  console.log('Captured '+name+' in three zooms and three quality settings; '+g.units.length+' combatants.');
}
if(out&&r.sliceDetails){
  const g=new Game({landscape:'highlands',scale:'standard',enemies:1,seed:44277,fogOfWar:false});
  const keep=g.buildings.find(b=>b.type==='keep'&&b.team===0);
  // Isolate the keep for a registration check without the starting garrison or
  // adjacent recruitment buildings covering the edge of the new foundation.
  g.units=[];g.buildings=[keep];g.objectives=[];g.castles=[];g.standards=[];g.byId=new Map([[keep.id,keep]]);
  g.hash.rebuild(g.units);g.vision.update(true);r.prepare(g);
  const field=g.tiles.find(t=>r.fieldTiles[t.y*g.W+t.x]&&t.x>10&&t.y>10);
  const forest=r.decor.find(d=>d.kind==='forestShrubs'&&d.x>10&&d.y>10);
  for(const [label,point,offset] of [['keep',keep,-22],['field',field,0],['forest',forest,0]]){
    assert.ok(point,label+' present in generated scene');
    const v={x:(point.x-point.y)*28,y:(point.x+point.y)*14+offset,w:width,h:height,dpr:1,zoom:1.55};
    r.draw(g,v,{selected:new Set(),selectedBuildings:new Set(),quality:'high',showGrid:false});
    fs.writeFileSync(path.join(out,'detail-'+label+'.png'),r.canvas.toBuffer('image/png'));
  }
}
