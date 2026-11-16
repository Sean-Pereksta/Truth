import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const ids=process.argv.slice(2);
const output=process.env.LANDS_RENDER_OUT?path.resolve(process.env.LANDS_RENDER_OUT):null;
if(output)fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/__painted-qa'){response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html><body style="margin:0;background:#172d30"></body></html>');return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/__painted-qa`);
  const report=await page.evaluate(async ids=>{
    const {Renderer}=await import('/render.js');
    const {PAINTED_TROOPS,selectPaintedFrame}=await import('/painted-troops.js');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const renderer=new Renderer(canvas);await renderer.loadPaintedTroops(null,ids.length?ids:null);
    const definitions=Object.values(PAINTED_TROOPS).filter(d=>!ids.length||ids.includes(d.id));
    const digest=canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let hash=2166136261;for(let i=0;i<data.length;i++){hash^=data[i];hash=Math.imul(hash,16777619);}return hash>>>0;
    };
    const alphaGeometry=canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1,total=0,cx=0,cy=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const a=data[(y*canvas.width+x)*4+3];total+=a;cx+=x*a;cy+=y*a;if(a>48){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
      return {bounds:[left,top,right,bottom],total,cx:cx/(total||1),cy:cy/(total||1)};
    };
    const drawRegression=row=>{
      let boundDrift=0,centerDrift=0,coverageDrift=0;const indices=[row.actions.ready,row.actions.walk[2],row.actions.fire??row.actions.thrust??row.actions.guard,row.actions.death.at(-1)];
      for(const index of indices)for(const facing of [-1,1])for(const offset of [0,.25]){
        const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=400;a.height=b.height=300;const ca=a.getContext('2d'),cb=b.getContext('2d'),f=row.frames[index];
        ca.save();ca.translate(200+offset,210+offset);ca.scale(facing,1);ca.drawImage(f.image,f.left,f.top,f.width,f.height,-f.anchorX*f.scale,-f.anchorY*f.scale,f.width*f.scale,f.height*f.scale);ca.restore();
        renderer.drawPaintedTroop(cb,row,index,facing,200+offset,210+offset);const x=alphaGeometry(a),y=alphaGeometry(b);
        boundDrift=Math.max(boundDrift,...x.bounds.map((value,i)=>Math.abs(value-y.bounds[i])));centerDrift=Math.max(centerDrift,Math.hypot(x.cx-y.cx,x.cy-y.cy));coverageDrift=Math.max(coverageDrift,Math.abs(x.total-y.total)/(x.total||1));
      }
      return {boundDrift,centerDrift,coverageDrift};
    };
    const atlasStats=async definition=>{
      const file=definition.file;
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='/'+file;});
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const data=ctx.getImageData(0,0,c.width,c.height).data;let empty=0,transparent=0,solid=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)empty++;if(data[i]<=16)transparent++;if(data[i]>220)solid++;}
      const rowGutters=(definition.rowCuts||[0,.25,.5,.75,1]).slice(1,-1).map(cut=>{const y=Math.round(cut*c.height);let count=0;for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>48)count++;return count;});
      const columnGutters=[];for(let row=0;row<definition.rows;row++){const y1=Math.round((definition.rowCuts?.[row]??row/definition.rows)*c.height),y2=Math.round((definition.rowCuts?.[row+1]??(row+1)/definition.rows)*c.height);for(const cut of (definition.columnCuts?.[row]||[]).slice(1,-1)){const x=Math.round(cut*c.width);let count=0;for(let y=y1;y<y2;y++)if(data[(y*c.width+x)*4+3]>48)count++;columnGutters.push(count);}}
      return {width:c.width,height:c.height,empty:empty/(c.width*c.height),transparent:transparent/(c.width*c.height),solid:solid/(c.width*c.height),rowGutters,columnGutters};
    };
    const rows=[];
    for(const definition of definitions){
      const row=renderer.getPaintedTroop(definition.type,definition.house);
      if(!row){rows.push({id:definition.id,missing:true});continue;}
      const counts=row.frames.map(frame=>{
        const ctx=frame.image.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(frame.left,frame.top,frame.width,frame.height).data;
        let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>75)opaque++;
        return {opaque,anchorX:frame.anchorX,anchorY:frame.anchorY,scale:frame.scale,width:frame.width,height:frame.height};
      });
      const right=renderer.paintedSprite(row,definition.actions.ready,1),left=renderer.paintedSprite(row,definition.actions.ready,-1);
      const frames=row.frames.map((_,index)=>digest(renderer.paintedSprite(row,index,1)));
      const g={time:20};
      const walk=selectPaintedFrame({hp:100,phase:Math.PI},g,definition,true);
      const ready=selectPaintedFrame({hp:100,phase:0},g,definition,false);
      const lowered=selectPaintedFrame({hp:100,spearState:'lowering'},g,definition,false);
      const braced=selectPaintedFrame({hp:100,spearState:'braced'},g,definition,false);
      const fire=selectPaintedFrame({hp:100,attackVisual:{at:20}},g,definition,false);
      const reload=definition.kind==='crossbow'?['lower','span','retrieve','seat','raise'].map(stage=>selectPaintedFrame({hp:100,reloading:true,reload:{stage,progress:1,duration:3}},g,definition,false)):[];
      const pausedA=selectPaintedFrame({hp:100,reloading:true,reload:{stage:'span',progress:1,duration:3}},g,definition,false);
      const pausedB=selectPaintedFrame({hp:100,reloading:true,reload:{stage:'span',progress:1,duration:3}},g,definition,false);
      rows.push({id:definition.id,kind:definition.kind,type:definition.type,frameCount:row.frames.length,expectedFrames:definition.rowColumns?.reduce((a,b)=>a+b,0)||definition.columns*definition.rows,bodyHeight:row.bodyHeight,counts,uniqueFrames:new Set(frames).size,mirrored:digest(right)!==digest(left),spriteWidth:right.width,spriteHeight:right.height,drawRegression:drawRegression(row),atlas:await atlasStats(definition),walk,ready,lowered,braced,fire,reload,paused:pausedA===pausedB,actions:definition.actions});
    }

    // A contact sheet captures real renderer output without drawn replacement
    // equipment. Automated checks complement, but cannot replace, art review.
    const sheet=document.createElement('canvas');sheet.width=1450;sheet.height=definitions.length*155+65;
    const ctx=sheet.getContext('2d');ctx.fillStyle='#172d30';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#ead9ae';ctx.font='bold 24px Georgia';ctx.fillText('Bannerlands · authored troop action review',24,38);
    definitions.forEach((definition,index)=>{
      const row=renderer.getPaintedTroop(definition.type,definition.house),a=definition.actions;
      const actions=[['Ready',a.ready],['March',a.walk[2]],['Action',a.fire??a.thrust??a.guard],['Brace / aim',a.brace??a.aim??a.guard],['Hit',a.hit],['Fallen',a.death.at(-1)]];
      const y=65+index*155;ctx.fillStyle=index%2?'#1c3738':'#203c3a';ctx.fillRect(0,y,sheet.width,155);ctx.fillStyle='#e2d7b5';ctx.font='15px Segoe UI';ctx.fillText(definition.id,20,y+28);
      actions.forEach(([label,frame],column)=>{
        const x=250+column*195;
        ctx.save();ctx.translate(x+60,y+125);ctx.scale(2,2);renderer.drawPaintedTroop(ctx,row,Array.isArray(frame)?frame[0]:frame,1,0,0);ctx.restore();ctx.fillStyle='#b8cec0';ctx.font='12px Segoe UI';ctx.fillText(label,x+10,y+145);
      });
    });
    document.body.appendChild(sheet);
    const rangerIndex=definitions.findIndex(d=>d.id==='river_ranger'),ranger=document.createElement('canvas');ranger.width=sheet.width;ranger.height=220;const rangerCtx=ranger.getContext('2d');rangerCtx.fillStyle='#172d30';rangerCtx.fillRect(0,0,ranger.width,ranger.height);rangerCtx.drawImage(sheet,0,0,sheet.width,65,0,0,sheet.width,65);if(rangerIndex>=0)rangerCtx.drawImage(sheet,0,65+rangerIndex*155,sheet.width,155,0,65,sheet.width,155);
    return {rows,sheet:sheet.toDataURL('image/png'),ranger:rangerIndex>=0?ranger.toDataURL('image/png'):null};
  },ids);
  if(output){fs.writeFileSync(path.join(output,'painted-troops-contact-sheet.png'),Buffer.from(report.sheet.split(',')[1],'base64'));fs.writeFileSync(path.join(output,'painted-art-checks.json'),JSON.stringify(report.rows,null,2));if(report.ranger)fs.writeFileSync(path.join(output,'River-Ranger-review.png'),Buffer.from(report.ranger.split(',')[1],'base64'));}
  const required=['river_ranger','hill_huntsman','sharpshooter','tollhouse_crossbow','vale_sentinel','gilded_crossbow','winter_pikeman','thornwall_pikeman','hornhill_halberdier','bridge_warden','dread_pike','crannog_spearhand','dune_skirmisher','cavalry','storm_rider','thorn_lancer','bear_lance_champion','sun_lance_champion','falcon_lance_champion','infantry','winter_guard','lion_shield_bearer','dragon_shield_bearer'];
  assert.deepEqual(report.rows.map(row=>row.id).sort(),(ids.length?required.filter(id=>ids.includes(id)):required).sort(),'All requested troop and house identities load');
  for(const row of report.rows){
    assert.equal(row.missing,undefined,row.id+' painted row');assert.equal(row.frameCount,row.expectedFrames,row.id+' full authored action grid');
    assert.ok(row.counts.every(frame=>frame.opaque>150),row.id+' nonempty raster frames');
    assert.ok(row.atlas.transparent>.25&&row.atlas.solid>.05,row.id+' transparent background and painted pixels');
    assert.ok(row.atlas.rowGutters.every(count=>count<=8)&&row.atlas.columnGutters.every(count=>count<=8),row.id+' clean frame gutters without neighboring sprite fragments');
    assert.ok(row.uniqueFrames>=Math.ceil(row.frameCount*.75),row.id+' distinct authored action poses');
    assert.ok(row.counts.every(frame=>Number.isFinite(frame.anchorX)&&Number.isFinite(frame.anchorY)&&frame.scale>0),row.id+' complete foot registration');
    assert.ok(Math.max(...row.counts.map(frame=>frame.scale))-Math.min(...row.counts.map(frame=>frame.scale))<1e-8,row.id+' consistent scale across every action');
    assert.equal(row.mirrored,true,row.id+' original two-direction mirroring');assert.equal(row.paused,true,row.id+' paused animation remains stable');
    assert.ok(row.drawRegression.boundDrift<=1&&row.drawRegression.centerDrift<.25&&row.drawRegression.coverageDrift<.02,row.id+' cached drawing preserves mirrored frame geometry and foot registration');
    assert.equal(row.ready,row.actions.ready,row.id+' ready state');assert.ok(row.actions.walk.includes(row.walk),row.id+' movement action');
    if(row.kind==='polearm'){assert.equal(row.lowered,row.actions.lower);assert.equal(row.braced,row.actions.brace);}
    if(row.kind==='crossbow'){assert.equal(new Set(row.reload).size,5,row.id+' five loading actions');assert.equal(row.fire,row.actions.fire);}
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log(`PASS ${report.rows.length} troop identities: transparent authored frames, action selection, mirroring and paused timing.`);
  console.log('Visual consistency and artwork quality still require inspection of the generated contact sheet.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
