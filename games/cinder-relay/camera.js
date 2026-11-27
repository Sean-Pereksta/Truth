/* Screen coordinates stay fixed at 960 × 540. Each view maps one part of that
   screen onto the same simulation, including when the pilots take different paths. */
(() => {
  'use strict';
  const width=960, height=540;
  const clamp=(n,low,high)=>Math.max(low,Math.min(n,high));
  function update(g,dt=0,snap=false){
    const large=!!g.map?.lab;
    const live=g.players.filter(p=>p.hp>0);
    const crew=live.length?live:g.players;
    const old=g.camera, pair=large&&crew.length===2;
    const wide=pair?Math.abs(crew[0].x-crew[1].x):0;
    const tall=pair?Math.abs(crew[0].y-crew[1].y):0;
    const wasSplit=!snap&&old?.split;
    const split=Boolean(pair&&(wide>(wasSplit?500:640)||tall>(wasSplit?250:350)));
    const count=split?2:1,sw=width/count,zoom=split ? .875 : 1;
    const changed=snap||!old||old.split!==split||old.map!==g.map;
    const cam=changed?{map:g.map,split,views:[]}:old;
    const weight=changed?1:1-Math.exp(-12*dt);
    for(let i=0;i<count;i++){
      const followed=split?[g.players[i]]:crew;
      const v=cam.views[i]||(cam.views[i]={x:0,y:0,sx:i*sw,sy:0,sw,sh:height,zoom,pilot:split?i:null});
      if(!large||!followed.length){v.x=0;v.y=0;continue;}
      let x=0,y=0;
      for(const p of followed){x+=p.x+(p.moveX||0)*18;y+=p.y+(p.moveY||0)*14;}
      const ww=sw/zoom,wh=height/zoom;
      const targetX=clamp(x/followed.length-ww/2,0,Math.max(0,g.worldW-ww));
      const targetY=clamp(y/followed.length-wh/2,0,Math.max(0,g.worldH-wh));
      v.x+=(targetX-v.x)*weight;v.y+=(targetY-v.y)*weight;
    }
    g.camera=cam;
  }
  function view(g,pilot=0){return g.camera.views[g.camera.split?pilot:0];}
  function worldPoint(g,x,y,pilot=0){
    const v=view(g,pilot);
    return {x:v.x+clamp(x-v.sx,0,v.sw)/v.zoom,y:v.y+clamp(y-v.sy,0,v.sh)/v.zoom};
  }
  function screenPoint(g,x,y,pilot=0){
    const v=view(g,pilot);return {x:v.sx+(x-v.x)*v.zoom,y:v.sy+(y-v.y)*v.zoom};
  }
  window.RelayCamera={update,worldPoint,screenPoint};
})();
