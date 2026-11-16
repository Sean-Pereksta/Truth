import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PAINTED_TROOPS} from '../../painted-troops.js';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright')));}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const ids=process.argv.slice(2),entries=Object.entries(PAINTED_TROOPS).filter(([id,d])=>(!ids.length||ids.includes(id))&&fs.existsSync(path.join(root,d.file)));
const output=path.resolve(process.env.LANDS_RENDER_OUT||path.join(root,'../../../../painted-audit'));fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><body style="margin:0;background:#1c4435"></body>');return;}const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'image/png'}).end(data);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BANNERLANDS_BROWSER});
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const report=await page.evaluate(async entries=>{
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=Math.ceil(entries.length/2)*850;const ctx=sheet.getContext('2d');ctx.fillStyle='#1c4435';ctx.fillRect(0,0,sheet.width,sheet.height);const rows=[];
    for(let index=0;index<entries.length;index++){
      const [id,d]=entries[index],image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='/'+d.file;});
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(image,0,0);const data=cx.getImageData(0,0,c.width,c.height).data,histogram=new Array(256).fill(0),rowCounts=new Array(c.height).fill(0);let neutralHaze=0,coloredHaze=0;
      for(let n=0;n<data.length;n+=4){const a=data[n+3];histogram[a]++;if(a>48)rowCounts[Math.floor(n/4/c.width)]++;if(a>0&&a<160){const max=Math.max(data[n],data[n+1],data[n+2]),min=Math.min(data[n],data[n+1],data[n+2]);if(max-min<35)neutralHaze++;else coloredHaze++;}}
      const count=c.width*c.height,x=index%2*800,y=Math.floor(index/2)*850;ctx.fillStyle='#eedfb9';ctx.font='20px Segoe UI';ctx.fillText(id,x+15,y+30);const scale=Math.min(780/c.width,790/c.height);ctx.drawImage(image,x+(800-c.width*scale)/2,y+50,c.width*scale,c.height*scale);
      const bands=[];let active=null;for(let y=0;y<c.height;y++){if(rowCounts[y]>5){if(active===null)active=y;}else if(active!==null){bands.push([active,y-1]);active=null;}}if(active!==null)bands.push([active,c.height-1]);
      const valleys=[];for(let y=1;y<c.height-1;y++)if(rowCounts[y]<=5){const start=y;while(y<c.height-1&&rowCounts[y+1]<=5)y++;valleys.push([start,y]);}
      const suggestedCuts=[0,...[1,2,3].map(i=>{const expected=i*c.height/4,candidates=valleys.filter(([a,b])=>a>expected-c.height*.15&&b<expected+c.height*.15);if(!candidates.length)return Math.round(expected);const [a,b]=candidates.sort((a,b)=>Math.abs((a[0]+a[1])/2-expected)-Math.abs((b[0]+b[1])/2-expected))[0];return Math.round((a+b)/2);}),c.height];
      const columnCuts=[],columnValleys=[];
      for(let row=0;row<d.rows;row++){
        const xCounts=new Array(c.width).fill(0),columns=d.rowColumns?.[row]||d.columns;
        for(let y=suggestedCuts[row];y<suggestedCuts[row+1];y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>48)xCounts[x]++;
        const gaps=[];for(let x=1;x<c.width-1;x++)if(xCounts[x]<=2){const start=x;while(x<c.width-1&&xCounts[x+1]<=2)x++;if(x-start>=2)gaps.push([start,x]);}
        columnValleys.push(gaps);columnCuts.push([0,...Array.from({length:columns-1},(_,j)=>{const expected=(j+1)*c.width/columns,candidates=gaps.filter(([a,b])=>a>expected-c.width/(columns*2)&&b<expected+c.width/(columns*2));if(!candidates.length)return Math.round(expected);const [a,b]=candidates.sort((a,b)=>Math.abs((a[0]+a[1])/2-expected)-Math.abs((b[0]+b[1])/2-expected))[0];return Math.round((a+b)/2);}),c.width]);
      }
      const row={id,width:c.width,height:c.height,empty:histogram[0]/count,opaque:histogram.slice(220).reduce((a,b)=>a+b,0)/count,lowAlpha:histogram.slice(1,160).reduce((a,b)=>a+b,0)/count,neutralHaze:neutralHaze/count,coloredHaze:coloredHaze/count,bands,valleys,suggestedCuts,columnCuts,columnValleys,rowCounts,histogram};rows.push(row);
    }
    return {rows,sheet:sheet.toDataURL('image/png')};
  },entries);
  fs.writeFileSync(path.join(output,'atlas-alpha-report.json'),JSON.stringify(report.rows,null,2));fs.writeFileSync(path.join(output,'atlas-on-green.png'),Buffer.from(report.sheet.split(',')[1],'base64'));console.log(JSON.stringify(report.rows.map(({id,width,height,suggestedCuts,columnCuts})=>({id,width,height,suggestedCuts,columnCuts})),null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
