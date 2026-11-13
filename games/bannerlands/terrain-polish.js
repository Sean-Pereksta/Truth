// Static terrain accents are painted into the renderer's existing overview and
// terrain-chunk caches. They never change terrain, ownership or the game RNG.
const TERRAIN_POLISH_DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const terrainPolishHash=(x,y,salt=0)=>{
  let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(salt+1,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
};
const terrainPolishAt=(g,x,y)=>x>=0&&y>=0&&x<g.W&&y<g.H?g.tiles[y*g.W+x]:null;
const terrainPolishLand=t=>!!t&&['grass','forest','hill'].includes(t.terrain)&&(!t.feature||t.feature==='road');
const terrainPolishOpenLand=t=>terrainPolishLand(t)&&!t.feature;

// Kept separate from painting so callers and checks can inspect eligible edges
// without allocating a canvas. Sides are north, east, south, west.
export function terrainPolishEdges(g,t){
  if(!terrainPolishLand(t))return null;
  const neighbors=TERRAIN_POLISH_DIRECTIONS.map(([dx,dy])=>terrainPolishAt(g,t.x+dx,t.y+dy));
  return {
    road:t.feature==='road',
    shoulders:neighbors.map(n=>terrainPolishLand(n)&&(t.feature==='road')!==(n.feature==='road')),
    forest:neighbors.map(n=>terrainPolishOpenLand(t)&&terrainPolishOpenLand(n)&&(t.terrain==='forest')!==(n.terrain==='forest')),
    shore:neighbors.map(n=>terrainPolishOpenLand(t)&&n?.terrain==='water'&&!n.feature)
  };
}

function terrainPolishBand(c,x,y,side,depth,outer,inner){
  c.save();c.translate(x,y);
  // A common local edge coordinate system keeps the width consistent around
  // bends and caps; every mark stays inside its own tile, including at chunks.
  if(side===1){c.translate(1,0);c.rotate(Math.PI/2);}
  else if(side===2){c.translate(1,1);c.rotate(Math.PI);}
  else if(side===3){c.translate(0,1);c.rotate(-Math.PI/2);}
  const fade=c.createLinearGradient(0,0,0,depth);fade.addColorStop(0,outer);fade.addColorStop(1,inner);
  c.fillStyle=fade;c.fillRect(0,0,1,depth);c.restore();
}

function terrainPolishEdgePoint(x,y,side,along,inset){
  return side===0?[x+along,y+inset]:side===1?[x+1-inset,y+along]:side===2?[x+along,y+1-inset]:[x+inset,y+along];
}

function terrainPolishTuft(c,x,y,shade,height=.065){
  c.strokeStyle=shade;c.lineWidth=.014;c.lineCap='round';
  c.beginPath();c.moveTo(x,y);c.lineTo(x-height*.8,y-height*1.1);
  c.moveTo(x,y);c.lineTo(x-height*.25,y-height*1.45);
  c.moveTo(x,y);c.lineTo(x-height*1.3,y-height*.4);c.stroke();
}

// x1/y1 are exclusive, matching terrainChunk's bake loop. The context must use
// the renderer's normal isometric pixel coordinates (any outer scale/translate
// is preserved). Calling once per baked chunk avoids per-frame full-map scans.
export function paintTerrainPolish(c,g,range={},options={}){
  const x0=Math.max(0,Math.floor(range.x0??0)),y0=Math.max(0,Math.floor(range.y0??0));
  const x1=Math.min(g.W,Math.ceil(range.x1??g.W)),y1=Math.min(g.H,Math.ceil(range.y1??g.H));
  const hw=options.halfWidth??28,hh=options.halfHeight??14,overview=options.detail==='overview';
  const stats={tiles:0,roadEdges:0,forestEdges:0,shoreEdges:0,ruts:0};
  c.save();c.transform(hw,hh,-hw,hh,0,0);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const t=terrainPolishAt(g,x,y),edges=terrainPolishEdges(g,t);if(!edges)continue;
    stats.tiles++;c.save();c.beginPath();c.rect(x,y,1,1);c.clip();
    // Gentle soil/grass variation breaks identical texture repetition without
    // replacing the painted ground or adding another decorative sprite layer.
    const grain=terrainPolishHash(x,y,19),cx=x+.18+terrainPolishHash(x,y,20)*.64,cy=y+.18+terrainPolishHash(x,y,21)*.64;
    if(!edges.road&&grain>.55){const wash=c.createRadialGradient(cx,cy,0,cx,cy,.62);wash.addColorStop(0,grain>.78?'rgba(187,164,95,.12)':'rgba(38,65,31,.1)');wash.addColorStop(1,'rgba(65,87,43,0)');c.fillStyle=wash;c.fillRect(x,y,1,1);}
    for(let side=0;side<4;side++){
      const salt=side*37;
      if(edges.shoulders[side]){
        stats.roadEdges++;
        terrainPolishBand(c,x,y,side,edges.road?.18:.23,edges.road?'rgba(96,112,54,.58)':'rgba(158,131,83,.38)','rgba(111,117,63,0)');
        // Uneven sandy flecks and tiny grass incursions hide the straight tile
        // outline. All marks are clipped to the eligible land tile.
        for(let k=0;k<(overview?3:6);k++){
          const along=.05+terrainPolishHash(x*7+k,y,salt+1)*.9,inset=.025+terrainPolishHash(x,y*7+k,salt+2)*.16;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset),size=.018+terrainPolishHash(x+k,y,salt+3)*.045;
          c.fillStyle=edges.road?'rgba(112,128,62,.35)':'rgba(178,154,105,.28)';c.beginPath();c.ellipse(px,py,size*1.5,size,0,0,Math.PI*2);c.fill();
          if(!overview&&k%2===0)terrainPolishTuft(c,px,py,edges.road?'rgba(122,142,70,.52)':'rgba(148,161,87,.45)',.045);
        }
      }
      if(edges.forest[side]){
        stats.forestEdges++;const inside=t.terrain==='forest';
        terrainPolishBand(c,x,y,side,.3,inside?'rgba(129,137,72,.3)':'rgba(48,75,37,.29)','rgba(78,102,49,0)');
        for(let k=0;k<(overview?1:4);k++){
          const along=.07+terrainPolishHash(x*5+k,y,salt+8)*.86,inset=.025+terrainPolishHash(x,y*5+k,salt+9)*.24;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset);
          if(overview){c.fillStyle='rgba(57,83,38,.18)';c.beginPath();c.ellipse(px,py,.07,.045,0,0,Math.PI*2);c.fill();}
          else terrainPolishTuft(c,px,py,inside?'rgba(168,163,90,.42)':'rgba(80,111,45,.57)',.055+terrainPolishHash(x+k,y,salt+10)*.05);
        }
      }
      if(edges.shore[side]){
        stats.shoreEdges++;
        terrainPolishBand(c,x,y,side,.24,'rgba(164,151,104,.62)','rgba(123,127,73,0)');
        // Reeds and washed pebbles sit on the land side. Water pixels and
        // bridge/ford/pass decks remain untouched and fully readable.
        for(let k=0;k<(overview?2:5);k++){
          const along=.08+terrainPolishHash(x*7+k,y,salt+14)*.84,inset=.045+terrainPolishHash(x,y*7+k,salt+15)*.13;
          const [px,py]=terrainPolishEdgePoint(x,y,side,along,inset);
          c.fillStyle=k%2?'rgba(184,175,131,.52)':'rgba(104,116,76,.34)';c.beginPath();c.ellipse(px,py,.025,.018,0,0,Math.PI*2);c.fill();
          if(!overview&&k%3===0)terrainPolishTuft(c,px,py,'rgba(116,136,75,.6)',.11);
        }
      }
    }
    if(edges.road&&!overview){
      const axis=t.featureAxis||'x';
      for(const offset of [.31,.69]){
        // Broken, offset wheel impressions complement the underlying track
        // texture without forming another hard seam across every road tile.
        const start=.02+terrainPolishHash(x,y,axis==='x'?31:32)*.16,end=.83+terrainPolishHash(x,y,33)*.15;
        const wobble=(terrainPolishHash(x,y,34)-.5)*.035;c.beginPath();
        if(axis==='y'){c.moveTo(x+offset+wobble,y+start);c.bezierCurveTo(x+offset-.018,y+.35,x+offset+.018,y+.65,x+offset-wobble,y+end);}
        else{c.moveTo(x+start,y+offset+wobble);c.bezierCurveTo(x+.35,y+offset-.018,x+.65,y+offset+.018,x+end,y+offset-wobble);}
        c.strokeStyle='rgba(77,69,45,.16)';c.lineWidth=.024;c.lineCap='round';c.stroke();stats.ruts++;
      }
    }
    c.restore();
  }
  c.restore();return stats;
}
