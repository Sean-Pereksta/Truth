/* Cinder Relay · battlefield layouts, terrain rendering and encounter director */
(function () {
  "use strict";
  const W = 960, H = 540, TAU = Math.PI * 2;
  const maps = [
    {name:"Saltglass Causeway", desc:"A flooded launch depot under orange floodlights.", type:"dock", accent:"#efa45c", rooms:["Entry Gantry","Container Exchange","Crane Yard","Launch Apron"], enemies:[0,12,2,1,3,6,7,9,11], stamp:"SALTGLASS"},
    {name:"The Lung Orchard", desc:"Living roots knot through a flooded greenhouse.", type:"grove", accent:"#c8d685", rooms:["Sluice Walk","Root Exchange","Pollination Court","Heart Pool"], enemies:[12,13,15,14,17,18,19,20,21,22,23,16], stamp:"ORCHARD"},
    {name:"Furnace Nine", desc:"Copper presses and slag pits share a casting floor.", type:"forge", accent:"#ff995d", rooms:["Freight Intake","Slag Crossing","Coolant Works","Casting Floor"], enemies:[3,5,7,8,1,2,9,4,10,11,6,0], stamp:"FURNACE"},
    {name:"The Choir Array", desc:"Three listening dishes stand on violet mineral flats.", type:"array", accent:"#bb9fda", rooms:["Service Tunnel","South Dish","Triad Plaza","Resonance Dais"], enemies:[24,25,26,27,28,29,30,31,32,33,34,35], stamp:"CHOIR"},
    {name:"Meridian Aperture", desc:"A broken observation lens above a banded planet.", type:"orbital", accent:"#d5be83", rooms:["Outer Airlock","Observation Ring","Stabilizer Spokes","Central Iris"], enemies:[29,26,5,15,27,31,35,33,22,7,34], stamp:"MERIDIAN"},
    {name:"Glass Tide", desc:"Daylight glimmers behind a drowned terminal.", type:"tide", accent:"#82d5ce", rooms:["Airlock Three","Shutter Junction","Convoy Cutoff","Glass Terminal"], enemies:[9,6,3,18,24,1,2,8], stamp:"GLASS TIDE"},
    {name:"Spore Observatory", desc:"A floating nursery with amber observation bulbs.", type:"spore", accent:"#f2b479", rooms:["Vineway","Observation Bulbs","Seed Loop","Sunset Chamber"], enemies:[14,13,21,20,16,22,23,19], stamp:"SPORE LAB"},
    {name:"Slagworks Crown", desc:"Open-air workstations rise above a glowing forge.", type:"crown", accent:"#ef8d76", rooms:["Roof Access","Upper Presses","Cinder Stair","Crown Spine"], enemies:[7,8,10,4,5,30,3,1], stamp:"SLAGWORKS"},
    {name:"Dead Frequency", desc:"Half-buried antennas link twin listening courts.", type:"signal", accent:"#c0b4e0", rooms:["Survey Post","Western Arches","Antenna Court","Silent Receiver"], enemies:[25,35,28,31,27,11,26,34], stamp:"FREQUENCY"},
    {name:"Moonfall Dock", desc:"A moonlit turntable feeds the orbital freight ramps.", type:"moon", accent:"#a8c7e8", rooms:["Landing Ramp","Cargo Turntable","Transfer Locks","Moonfall Ring"], enemies:[11,9,7,32,8,15,4,27], stamp:"MOONFALL"},
    {name:"The Lantern Vault", desc:"Four luminous fuel bays feed a buried central hub.", type:"vault", accent:"#dbb978", rooms:["Vault Mouth","Lamp Bays","Pressure Hub","Reserve Chamber"], enemies:[18,14,16,26,19,30,21,35], stamp:"LANTERN"}
  ];
  const themes = {
    dock: ["#0a1d26","#13313a","#24505a","#273b42","#33494c","#13272e","#607173","#c78349"],
    grove:["#0e2628","#163e39","#28665b","#32413a","#405444","#182e2b","#77886b","#a3a263"],
    forge:["#271b22","#492c2a","#975335","#3c3536","#504647","#231f26","#7e7370","#be7947"],
    array:["#1b192e","#342945","#5d4a72","#3b384b","#4d485d","#292538","#81738f","#a387ad"],
    orbital:["#0d1929","#24384e","#506575","#353e4b","#495464","#212936","#82929b","#b39b71"],
    tide:["#0b2734","#143c47","#39717b","#2e424a","#3a535b","#19303a","#819491","#749e94"],
    spore:["#2a2832","#564748","#a36e53","#3b433c","#505649","#29332c","#8c9075","#bc9a6c"],
    crown:["#2a202c","#58383b","#a05a49","#40373c","#52474d","#28222c","#897373","#bc8272"],
    signal:["#282634","#49434c","#716476","#3e4048","#50545b","#282a33","#878b8e","#a49bab"],
    moon:["#111b30","#24354e","#506b83","#303e4e","#435266","#202c3c","#8194a2","#a0a7a0"],
    vault:["#1e2529","#383d36","#67664b","#3b403c","#4b5149","#262b29","#858871","#b3a36c"]
  };
  const isOrganic = type => type === "grove" || type === "spore";
  const isOrbital = type => type === "moon" || type === "orbital";
  const isHot = type => type === "forge" || type === "crown";
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const pilots = g => g.players?.length ? g.players : [g.player];
  const livingPilots = g => pilots(g).filter(p=>p && p.hp>0);
  function seeded(seed) {
    return () => { seed = Math.imul(seed ^ (seed >>> 15),2246822519) + 0x6d2b79f5 | 0; return (seed >>> 0) / 4294967296; };
  }
  function rect(c,x,y,w,h,color) { c.fillStyle=color; c.fillRect(x,y,w,h); }
  function poly(c,pts,fill,outline,width=2) {
    c.beginPath(); c.moveTo(pts[0][0],pts[0][1]);
    for (let i=1;i<pts.length;i++) c.lineTo(pts[i][0],pts[i][1]);
    c.closePath();
    if (fill) {c.fillStyle=fill;c.fill();}
    if (outline) {c.lineWidth=width;c.strokeStyle=outline;c.stroke();}
  }
  function line(c,pts,color,width=2) {
    c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
    c.lineWidth=width;c.strokeStyle=color;c.stroke();
  }
  function oval(c,x,y,rx,ry,color,edge,width=2) {
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);
    if(color){c.fillStyle=color;c.fill();}if(edge){c.lineWidth=width;c.strokeStyle=edge;c.stroke();}
  }
  function band(c,x,y,w,color) {
    for(let i=0;i<w-5;i+=12)poly(c,[[x+i,y+6],[x+i+5,y],[x+i+10,y],[x+i+5,y+6]],color);
  }
  function label(c,text,x,y,size,color) {
    c.save();c.font="bold "+size+"px monospace";c.fillStyle=color;c.fillText(text,x,y);c.restore();
  }
  const deck = [[25,112],[78,59],[880,59],[935,111],[935,443],[885,491],[78,491],[25,439]];
  const decks=[
    [[25,132],[85,76],[196,52],[820,52],[900,82],[937,135],[937,418],[869,479],[738,500],[166,500],[68,473],[25,420]],
    [[28,202],[72,123],[174,69],[335,48],[685,48],[835,88],[914,166],[940,246],[923,365],[856,440],[695,494],[327,500],[152,460],[62,389],[27,318]],
    [[29,107],[81,57],[881,57],[930,108],[930,440],[879,491],[81,491],[29,440]],
    [[23,246],[141,117],[303,57],[666,57],[835,128],[939,242],[932,323],[801,439],[653,490],[291,490],[148,442],[30,341]],
    [[22,236],[82,146],[215,78],[383,49],[623,49],[762,77],[882,141],[943,237],[937,323],[876,404],[740,471],[596,503],[365,503],[212,473],[85,405],[26,324]],
    [[26,157],[103,81],[245,54],[831,54],[928,121],[936,410],[846,484],[230,499],[93,474],[26,395]],
    [[25,244],[88,145],[212,86],[347,51],[635,51],[802,89],[891,151],[942,237],[927,350],[814,443],[687,477],[533,497],[333,490],[177,445],[65,374]],
    [[25,163],[88,107],[224,56],[859,56],[931,119],[935,387],[843,475],[738,497],[186,497],[81,460],[27,403]],
    [[24,141],[130,70],[333,51],[691,51],[847,85],[934,160],[936,381],[840,458],[677,489],[267,491],[113,460],[27,401]],
    [[25,217],[90,139],[230,71],[433,48],[680,57],[826,101],[931,194],[936,336],[850,424],[683,481],[504,499],[282,485],[125,435],[27,347]],
    [[29,137],[102,71],[277,54],[771,54],[868,82],[932,152],[933,390],[857,465],[735,489],[204,489],[95,456],[29,397]]
  ];
  const deckEdges=new WeakMap();
  function insideDeck(x,y,r=0,outline=deck) {
    if(x>164+r&&x<794-r&&y>138+r&&y<394-r)return true;
    let edges=deckEdges.get(outline);
    if(!edges){
      edges=outline.map(([x,y],i)=>{const b=outline[(i+1)%outline.length],dx=b[0]-x,dy=b[1]-y,s=Math.hypot(dx,dy);return [-dy/s,dx/s,(dy*x-dx*y)/s];});
      deckEdges.set(outline,edges);
    }
    for(const e of edges)if(e[0]*x+e[1]*y+e[2]<r)return false;
    return true;
  }
  const openPits = new Set(['hold','pool','slag','void','well']);
  function blocked(g,x,y,r=0,projectile=false) {
    if(g.map?.lab)return Labyrinth.blocked(g.map.lab,x,y,r);
    if(!insideDeck(x,y,r+1,g.map?.outline||deck))return true;
    return (g.map?.blockers||[]).some(b=>{
      if(projectile&&openPits.has(b.type))return false;
      const dx=x-Math.max(b.x,Math.min(x,b.x+b.w)),dy=y-Math.max(b.y,Math.min(y,b.y+b.h));
      if(dx*dx+dy*dy>(r+.2)*(r+.2))return false;
      if(!b.verts)return true;
      let inPoly=false;
      const v=b.verts;
      for(let i=0,j=v.length-1;i<v.length;j=i++){
        const [x1,y1]=v[j],[x2,y2]=v[i],ex=x2-x1,ey=y2-y1,ux=x-x1,uy=y-y1;
        if((y1>y)!==(y2>y) && x<ex*(y-y1)/ey+x1)inPoly=!inPoly;
        const q=Math.max(0,Math.min(1,(ux*ex+uy*ey)/(ex*ex+ey*ey||1)));
        if((ux-q*ex)**2+(uy-q*ey)**2<=(r+.2)**2)return true;
      }
      return inPoly;
    });
  }
  const shape=(type,x,y,w,h)=>({x,y,w,h,type});
  function pit(type,verts){
    const xs=verts.map(v=>v[0]),ys=verts.map(v=>v[1]),x=Math.min(...xs),y=Math.min(...ys);
    return {type,x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,verts};
  }
  function wedge(type,x,y,rx,ry,a,b,inner=.60){
    const points=[];
    for(let i=0;i<=7;i++){const angle=a+(b-a)*i/7;points.push([x+rx*Math.cos(angle),y+ry*Math.sin(angle)]);}
    for(let i=7;i>=0;i--){const angle=a+(b-a)*i/7;points.push([x+rx*inner*Math.cos(angle),y+ry*inner*Math.sin(angle)]);}
    return pit(type,points);
  }
  function lake(x,y,w,h){
    return pit("pool",[[x-w,y],[x-w*.70,y-h*.60],[x-w*.27,y-h],[x+w*.25,y-h*.64],[x+w*.72,y-h*.73],[x+w,y-h*.13],[x+w*.87,y+h*.60],[x+w*.26,y+h],[x-w*.36,y+h*.78],[x-w*.75,y+h*.37]]);
  }
  function shapes(id,room,stage) {
    const bossFloor=["hold","pool","slag","well","void","pool","root","slag","well","void","tank"];
    if(room===3){
      if(id===1)return [lake(478,180,66,27),lake(480,360,69,27)];
      if(id===2||id===7)return [shape("slag",232,119,114,24),shape("slag",617,388,114,24)];
      if(id===3||id===8)return [shape("lens",195,189,30,27),shape("lens",724,363,30,27)];
      if(id===4||id===9)return [];
      return [shape(bossFloor[id],216,132,47,28),shape(bossFloor[id],699,377,47,28)];
    }
    if(id===0){
      if(room===0)return [shape("hold",223,238,181,59),shape("hold",521,238,184,59),shape("cargo",366,118,67,35),shape("cargo",600,377,77,33)];
      if(room===1)return [shape("cargo",196,164,142,40),shape("cargo",197,329,89,40),shape("cargo",500,212,135,39),shape("cargo",581,338,135,40),shape("hold",397,380,74,52),shape("hold",665,99,82,52)];
      return [shape("hold",245,120,194,42),shape("hold",552,402,175,35),shape("cargo",193,330,75,48),shape("cargo",702,211,59,49),shape("press",447,232,64,57)];
    }
    if(id===1){
      if(room===0)return [lake(306,242,83,56),lake(615,311,94,53),lake(560,131,111,27),shape("root",359,371,57,35)];
      if(room===1)return [lake(334,288,101,48),lake(584,216,100,54),lake(568,379,85,36),shape("root",428,273,44,33)];
      return [lake(388,185,85,53),lake(570,346,105,59),lake(237,356,52,32),lake(731,162,55,28),shape("root",455,239,50,52)];
    }
    if(id===2){
      if(room===0)return [shape("slag",225,147,230,36),shape("slag",497,365,227,36),shape("press",396,294,61,55),shape("press",588,192,66,44)];
      if(room===1)return [shape("slag",428,102,39,114),shape("slag",492,321,39,115),shape("slag",210,248,146,40),shape("slag",601,248,152,40),shape("press",308,139,48,45),shape("press",626,357,55,43)];
      return [pit("slag",[[266,150],[387,150],[443,205],[443,235],[404,235],[371,200],[266,200]]),pit("slag",[[514,302],[552,302],[593,343],[707,343],[707,389],[581,389],[514,327]]),shape("press",285,355,65,40),shape("press",625,133,65,40)];
    }
    if(id===3){
      const cy=room===0?280:room===1?239:263,dx=room===1?-38:room===2?34:0;
      return [pit("well",[[361+dx,cy-39],[443+dx,cy-123],[443+dx,cy-60],[412+dx,cy-30]]),
        pit("well",[[512+dx,cy-121],[610+dx,cy-26],[558+dx,cy-26],[512+dx,cy-68]]),
        pit("well",[[366+dx,cy+65],[587+dx,cy+65],[564+dx,cy+104],[391+dx,cy+104]]),
        shape("crystal",209,room===2?175:320,46,34),shape("crystal",705,room===2?327:176,46,34)];
    }
    if(id===4){
      const shift=room===1?.26:room===2?-.20:0,rx=room===1?207:238,ry=room===2?107:127;
      let segments=Array.from({length:4},(_,n)=>wedge("void",480,269,rx,ry,n*Math.PI/2+.21+shift,(n+1)*Math.PI/2-.21+shift,.66));
      if(room===1)segments.push(shape("lens",451,238,58,57));
      if(room===2)segments.push(wedge("void",480,269,315,177,3.35,4.18,.85),wedge("void",480,269,315,177,.22,1.05,.85));
      return segments;
    }
    if(id===5)return [shape("pool",201,140+18*room,228,36),shape("pool",529,140+18*room,222,36),shape("pool",201,365-14*room,143,37),shape("pool",436,365-14*room,285,37),shape("cargo",room===1?571:375,244,62,35)];
    if(id===6)return [lake(291,room===1?191:271,64,55),lake(556,146+room*10,69,39),lake(610,357-room*11,79,44),shape("root",room===2?437:423,room===2?308:240,40,42)];
    if(id===7){
      const v=room*13;
      return [pit("slag",[[232,148+v],[388,148+v],[418,178+v],[418,206+v],[377,183+v],[232,183+v]]),
        pit("slag",[[540,337-v],[576,365-v],[744,365-v],[744,395-v],[565,395-v],[540,371-v]]),
        shape("press",room===1?622:546,114,65,41),shape("press",room===2?347:272,365,59,43),shape("press",room===1?480:455,239+v,53,42)];
    }
    if(id===8){
      const offset=room===1?72:room===2?-63:0,x=462+offset;
      return [shape("dish",223,room===1?145:339,66,41),shape("dish",674,room===1?332:131,65,41),
        pit("well",[[x-6,76],[x+30,76],[x+37,126],[x+12,140],[x-6,115]]),
        shape("crystal",x,200,33,34),shape("crystal",x,316,33,34),
        pit("well",[[x+9,408],[x+35,421],[x+34,468],[x-8,468],[x-8,440]])];
    }
    if(id===9){
      const angle=room*.47+.23;
      return [wedge("void",480,269,195,106,angle,angle+1.8,.70),wedge("void",480,269,195,106,angle+Math.PI,angle+Math.PI+1.8,.70),
        shape("cargo",room===2?240:285,room===1?167:344,85,33),shape("cargo",room===2?644:601,room===1?355:145,80,34)];
    }
    if(id===10)return [shape("tank",201,126,86,50),shape("tank",672,362,86,50),
      wedge("pool",480,269,181,97,.21+room*.15,1.35+room*.15,.59),wedge("pool",480,269,181,97,3.32+room*.15,4.46+room*.15,.59),shape("tank",433,room===1?187:333,68,37)];
    return [];
  }
  function drawBackdrop(c,map,rng) {
    const {type}=map.def,p=map.pal;
    const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,p[2]);sky.addColorStop(.36,p[1]);sky.addColorStop(1,p[0]);rect(c,0,0,W,H,sky);
    if(isOrbital(type)){
      for(let i=0;i<180;i++){const x=rng()*W,y=rng()*H;rect(c,x,y,i%19===0?3:1.6,1.6,i%3?p[6]:"#e0d9cd");}
      c.save();c.beginPath();c.ellipse(698,535,515,158,-.1,0,TAU);c.clip();
      rect(c,120,340,850,200,"#476371");
      for(let i=0;i<23;i++){const y=363+i*9;line(c,[[96,y+85],[305,y+47],[565,y+17],[785,y],[980,y+8]],["#3d5768","#66858b","#748d8e","#4c6876"][i%4],5+rng()*9);}
      c.restore();
    } else {
      for(let i=0;i<500;i++){
        const x=rng()*W,y=rng()*H,width=isHot(type)?2+rng()*9:3+rng()*31;
        rect(c,x,y,width,1.5,i%5===0?p[2]:p[1]);
      }
      if(isOrganic(type)){
        for(let i=0;i<27;i++){const x=i*41-25,h=16+rng()*53;
          line(c,[[x-18,76],[x-22,56],[x-15,h*.53],[x+4,h*.35],[x+16,54]],p[1],7);
          oval(c,x+2,h*.35,13,9,p[2]);
        }
      }else{
        for(let i=0;i<29;i++){const x=i*36-6,h=5+rng()*37;rect(c,x,57-h,14+rng()*24,h,p[1]);if(i%3===0)rect(c,x+4,50-h,4,8,p[2]);}
      }
    }
    if(type==="dock"||type==="tide"||type==="moon"){
      for(const [x,y,s] of [[108,54,.78],[600,47,.64],[773,60,.92]]){
        c.save();c.translate(x,y);c.scale(s,s);
        poly(c,[[-46,0],[12,0],[6,-5],[-2,-5],[-4,-49],[-11,-49],[-22,-10]],p[0]);
        line(c,[[-12,-52],[3,-67],[86,-51],[85,-45],[-12,-46]],p[0],4);
        for(let j=0;j<6;j++)line(c,[[j*13-5,-48],[j*13+1,-59+j*1.3],[j*13+9,-47]],p[0],2);
        line(c,[[72,-48],[72,-20]],p[0],2);rect(c,65,-22,14,6,p[1]);c.restore();
      }
    }
    if(type==="array"||type==="signal"){
      for(const x of [50,415,825]){
        poly(c,[[x,72],[x+14,32],[x+21,32],[x+37,72]],p[0]);
        poly(c,[[x-29,16],[x+5,27],[x+31,22],[x+60,10],[x+39,31],[x+17,39],[x+2,37]],p[1]);
        line(c,[[x-26,15],[x+13,25],[x+59,9]],p[6],2);line(c,[[x+16,32],[x+25,2]],p[0],3);
      }
    }
    if(isHot(type)){
      for(const x of [47,212,750,862]){
        poly(c,[[x,70],[x+8,15],[x+21,15],[x+30,70]],p[0]);rect(c,x+6,14,17,5,p[2]);
        for(let j=0;j<3;j++)oval(c,x+15+j*8,10-j*6,8+j*5,4+j*2,p[1]);
      }
    }
  }
  function floorLines(c,m,rng) {
    const p=m.pal, def=m.def;
    c.save();
    poly(c,m.outline,"#000");c.clip();rect(c,0,0,W,H,p[3]);
    const style=def.type;
    // Recessed construction seams and blast plates follow the grid of each deck.
    for(let row=0;row<12;row++){
      const y=54+row*40;
      for(let col=-1;col<15;col++){
        const x=col*77+((row%2)*38),d=rng();
        if(d>.76){c.globalAlpha=.48;rect(c,x+2,y+2,75,37,p[4]);c.globalAlpha=1;}
        rect(c,x,y,76,1.2,p[5]);rect(c,x+1,y+1,73,1,"rgba(211,222,218,.075)");rect(c,x,y+1,1,39,p[5]);
        if(d<.32){rect(c,x+5,y+4,2.5,1.6,p[6]);rect(c,x+70,y+33,2.5,1.6,p[5]);}
        for(let k=0;k<4;k++){const u=x+4+rng()*66,v=y+5+rng()*27;rect(c,u,v,rng()*6+1,1,d>.55?"rgba(187,202,192,.08)":"rgba(5,10,18,.12)");}
      }
    }
    // Repeated deck markings and machine tracks establish direction while leaving fire lanes quiet.
    const transit=def.type==="dock" || def.type==="moon" || def.type==="forge" || def.type==="crown" || def.type==="tide";
    if(transit){
      for(const y of [201,326]){
        const route=[[34,y+16],[134,y+16],[181,y],[776,y],[825,y+16],[931,y+16]];
        line(c,route,p[5],9);line(c,route,p[6],4);line(c,route,p[4],2);
        for(let x=192;x<767;x+=30){rect(c,x,y-5,4,2,p[5]);rect(c,x,y+4,4,2,p[5]);}
      }
      for(const y of [90,451]){
        for(let x=117;x<860;x+=66){
          rect(c,x,y,44,9,p[5]);rect(c,x+1,y,42,2,p[6]);
          for(let k=0;k<10;k++)rect(c,x+1+k*4,y+3,1.5,5,p[4]);
        }
      }
    }else{
      const center=[480,270],biomeRing=isOrganic(style)?"rgba(137,157,110,.32)":"rgba(145,141,169,.4)";
      for(const size of [77,89,172,179]){
        const pts=[];for(let n=0;n<12;n++){const a=n*TAU/12;pts.push([center[0]+Math.cos(a)*size*2,center[1]+Math.sin(a)*size*.9]);}
        poly(c,pts,null,biomeRing,size===89?3:1.5);
      }
      for(const sign of [-1,1]) {
        line(c,[[53,268+sign*120],[168,268+sign*120],[240,268+sign*78],[365,268+sign*78]],p[5],5);
        line(c,[[595,268+sign*76],[743,268+sign*76],[798,268+sign*119],[908,268+sign*119]],p[6],2);
      }
    }
    const number=String(m.id+1).padStart(2,"0");
    label(c,number,102,168,47,"rgba(194,198,177,.20)");
    label(c,def.stamp,104,182,10,"rgba(206,212,192,.33)");
    for(let i=0;i<4;i++){const x=110+i*10;poly(c,[[x,194],[x+5,194],[x+8,198],[x+5,202],[x,202],[x+3,198]],"rgba(203,199,169,.23)");}
    label(c,"SECTOR "+String(m.room+1).padStart(2,"0"),735,421,12,"rgba(214,210,183,.3)");
    for(let i=0;i<10;i++)rect(c,736+i*6,428,i%3===0?3:1.4,7,p[5]);
    if(m.room===3){
      for(const radius of [72,79,140])oval(c,480,270,radius*1.45,radius*.84,null,"rgba(189,181,158,.18)",2);
    }
    c.restore();
  }
  function deckEdge(c,m){
    const p=m.pal,a=m.def.accent;
    const outline=m.outline;poly(c,outline,null,p[5],9);poly(c,outline,null,p[6],3);
    for(let i=0;i<outline.length;i++){
      const [x,y]=outline[i],[u,v]=outline[(i+1)%outline.length],dx=u-x,dy=v-y,dist=Math.hypot(dx,dy);
      if(dx<0 && (v+y)/2>292)line(c,[[x+3,y+8],[u+3,v+8]],p[4],2.5);
      const steps=Math.max(1,Math.floor(dist/44));
      for(let j=0;j<steps;j++){
        const pos=(j+.5)/steps,px=x+pos*dx,py=y+pos*dy;
        c.save();c.translate(px,py);c.rotate(Math.atan2(dy,dx));
        rect(c,-6,-2,12,6,p[5]);rect(c,-5,-2,10,2,p[6]);
        if(j%3===0)rect(c,-3,1,6,2,a);c.restore();
        if(dx<0 && py>345 && j%2===0){rect(c,px,py+5,6,8,p[0]);rect(c,px+1,py+5,2,6,p[4]);}
      }
    }
  }
  function cargo(c,x,y,w,h,p) {
    const top=y-5,side=(Math.round(x/3)%3===0)?"#667879":"#80624d";
    poly(c,[[x+5,y+5],[x+w+9,y+5],[x+w+9,y+h+8],[x+5,y+h+8]],"rgba(2,10,16,.42)");
    rect(c,x,y,w,h,p[5]);rect(c,x,top,w,h-5,side);
    rect(c,x,top,w,3,"#97a09a");rect(c,x+1,top+3,3,h-8,"#91918a");
    rect(c,x+5,top+5,w-10,h-14,"#465153");
    for(let u=x+9;u<x+w-7;u+=8){
      rect(c,u,top+6,4,h-16,side);rect(c,u,top+6,1.5,h-16,"#89908a");
    }
    rect(c,x+1,y+h-9,w-2,8,"#29383c");
    for(const u of [x+3,x+w-8]){rect(c,u,y+h-7,5,4,side);rect(c,u,top+2,4,3,"#c0b99c");}
    rect(c,x+7,top+6,14,6,"#d9bea1");rect(c,x+9,top+8,5,2,p[5]);
  }
  function cutaway(c,b,m,rng) {
    const {x,y,w,h,type}=b,p=m.pal;
    rect(c,x-4,y-4,w+8,h+8,p[5]);rect(c,x-2,y-2,w+4,h+4,p[6]);
    rect(c,x,y,w,h,p[0]);rect(c,x+3,y+1,w-6,8,p[5]);
    if(type==="hold"){
      rect(c,x+3,y+10,w-6,h-13,"#15343d");
      for(let n=0;n<16;n++){const yy=y+14+rng()*(h-20);rect(c,x+8+rng()*(w-30),yy,4+rng()*15,1.5,"#2c5360");}
      for(const u of [x+12,x+w-18]){
        rect(c,u,y+2,5,h-5,p[0]);rect(c,u+1,y+2,2,h-5,p[4]);rect(c,u-3,y+5,12,4,p[7]);
      }
      band(c,x+5,y+h-1,Math.min(53,w-10),p[7]);
    }else if(type==="slag"){
      rect(c,x+5,y+9,w-10,h-11,"#8c412e");
      for(let n=0;n<w;n+=3){
        const u=x+5+rng()*(w-16),v=y+13+rng()*(h-19);rect(c,u,v,2+rng()*8,2,["#b85e35","#c67a43","#71362b"][n%3]);
      }
      for(const v of [y+7,y+h-5])rect(c,x+1,v,w-2,2,p[5]);
      for(let k=0;k<4;k++){rect(c,x+8+k*(w-15)/4,y+2,3,7,p[7]);}
    }else if(type==="pool"){
      const water=m.def.type==="vault"?"#6b6644":isOrganic(m.def.type)?"#25554d":"#23545e";
      rect(c,x+3,y+7,w-6,h-9,water);
      for(let n=0;n<24;n++){
        const u=x+5+rng()*(w-21),v=y+8+rng()*(h-15);
        rect(c,u,v,4+rng()*11,1.5,n%3===0?"#59837b":p[1]);
        if(isOrganic(m.def.type)&&n%4===0)oval(c,u,v,3,2.5,"#7c9167");
      }
      for(let j=0;j<5;j++)rect(c,x+4+j*12,y+h-3,5,2,p[4]);
    }else {
      for(let n=0;n<16;n++){
        const u=x+3+rng()*(w-6),v=y+6+rng()*(h-8);rect(c,u,v,n%6===0?3:1.6,1.5,p[6]);
      }
      if(type==="well"){
        const cx=x+w/2,cy=y+h/2;
        for(let j=0;j<3;j++)poly(c,[[cx,cy-5-j*4],[cx+10+j*7,cy],[cx,cy+5+j*4],[cx-10-j*7,cy]],null,j%2?p[4]:p[2],1.5);
      }
    }
    for(const u of [x+2,x+w-6])for(const v of [y-2,y+h-1])rect(c,u,v,4,2,"#89938d");
  }
  function plant(c,b,m,rng) {
    const {x,y,w,h}=b,yt=y+5,yy=y+h-3;
    oval(c,x+w/2+5,yy,w*.56,10,"rgba(6,17,13,.5)");
    const cx=x+w*.49,cy=y+h*.58;
    for(let n=0;n<9;n++){
      const a=n*TAU/9+rng()*.2,rx=Math.cos(a)*w*.52,ry=Math.sin(a)*h*.5;
      const path=[[cx,cy],[cx+rx*.4,cy+ry*.55+3],[cx+rx*.74,cy+ry*.72-3],[cx+rx,cy+ry]];
      line(c,path,"#182f2a",7);line(c,path,"#57705a",3);
    }
    for(let n=0;n<5;n++){
      const u=x+8+rng()*(w-17),v=yt+rng()*(h*.47);
      line(c,[[u,yy-2],[u+4,v+7],[u,v]],"#2c493d",5);
      oval(c,u+1,v,7,9,"#233b36");oval(c,u,v-3,5,8,"#71846a");
      rect(c,u-2,v-8,3,5,n%2?"#b9c38c":"#d7af74");rect(c,u+2,v-2,2,3,"#4a6750");
    }
    for(let n=0;n<9;n++){
      const u=x+4+rng()*(w-8),v=yy-rng()*11;
      poly(c,[[u,v],[u-9,v-6],[u-3,v-7],[u+1,v-2],[u+8,v-9],[u+6,v-3]],n%2?"#54775b":"#75906b");
    }
  }
  function machine(c,b,m,rng) {
    const {x,y,w,h,type}=b,p=m.pal;
    rect(c,x+5,y+6,w+3,h+2,"rgba(3,9,14,.38)");
    rect(c,x-1,y-1,w+2,h+2,p[5]);rect(c,x,y,w,h,p[4]);rect(c,x+1,y,w-2,3,p[6]);
    if(type==="press"){
      for(const u of [x+3,x+w-14]){
        rect(c,u,y+5,11,h-9,p[5]);rect(c,u+2,y+4,7,h-12,"#8e7771");
        for(let j=0;j<h-15;j+=6)rect(c,u+2,y+6+j,7,2,p[3]);
      }
      rect(c,x+16,y+5,w-32,h-9,"#604a43");rect(c,x+17,y+8,w-34,h*.35,"#a57555");
      rect(c,x+19,y+h*.57,w-38,h*.26,p[5]);band(c,x+17,y+h-12,w-32,"#b88352");
    }else if(type==="crystal"){
      for(let j=0;j<5;j++){
        const u=x+11+(j%3)*(w-20)/3,v=y+16+(j>>1)*6,s=9+rng()*11;
        poly(c,[[u,v+8],[u-5,v],[u-3,v-s],[u+3,v-s-3],[u+8,v-3],[u+4,v+8]],"#554967",p[5]);
        poly(c,[[u-3,v-s],[u+3,v-s-3],[u+3,v+3]],"#a391ba");
      }
    }else if(type==="lens"||type==="dish"){
      const cx=x+w/2,cy=y+h*.52;
      oval(c,cx,cy+2,w*.38,h*.4,p[5]);oval(c,cx,cy-2,w*.38,h*.37,"#667482",p[6]);
      oval(c,cx,cy-3,w*.28,h*.28,p[2],"#a2abb1",2);oval(c,cx,cy-3,w*.13,h*.13,p[1]);
      line(c,[[cx,cy+1],[cx+10,cy-14],[cx+16,cy-19]],p[6],3);rect(c,cx+14,cy-20,5,3,m.def.accent);
    }else if(type==="tank"){
      for(let j=0;j<3;j++){
        const u=x+8+j*(w-12)/3;
        rect(c,u,y+9,((w-18)/3)-2,h-18,"#9e9569");
        for(const v of [y+9,y+19,y+h-16])rect(c,u,v,(w-18)/3-2,4,"#565c51");
        rect(c,u+3,y+15,2,h-31,"#c9bb83");
      }
    }
    for(const u of [x+3,x+w-5]){rect(c,u,y+h-4,3,2,p[7]);}
  }
  function cornerMachinery(c,m,rng){
    const {type}=m.def,p=m.pal;
    for(const x of [112,751]){
      const y=66;
      line(c,[[x-22,y+3],[x-17,y+12],[x+5,y+12],[x+12,y+18],[x+39,y+18]],p[5],5);
      line(c,[[x-22,y+2],[x-17,y+11],[x+5,y+11],[x+12,y+17],[x+39,y+17]],p[6],1.5);
    }
    if(isOrganic(type)){
      for(let j=0;j<6;j++){
        const x=166+j*118,y=j%2?66:480;
        for(let n=0;n<4;n++) {
          const dir=j%2?1:-1,off=rng()*30;
          line(c,[[x,y],[x+10,y+dir*8],[x+7+off,y+dir*15],[x+15+off,y+dir*23]],p[5],5);
          line(c,[[x,y],[x+10,y+dir*8],[x+7+off,y+dir*15]],"#627559",2);
        }
      }
    }else{
      for(const x of [185,437,689]){
        rect(c,x,63,38,10,p[5]);rect(c,x+1,62,36,3,p[6]);rect(c,x+7,66,11,2,p[7]);
        rect(c,x+22,66,8,2,p[4]);rect(c,x+28,466,61,12,p[5]);
        for(let j=0;j<12;j++)rect(c,x+30+j*4.8,468,2,7,p[4]);
      }
    }
  }
  function bake(m) {
    const image=document.createElement("canvas");image.width=480;image.height=270;
    const c=image.getContext("2d");c.scale(.5,.5);c.lineJoin="bevel";
    const rng=seeded(74921+(m.id+1)*7859+m.room*2999);drawBackdrop(c,m,rng);
    window.Art?.vista?.(c,m.id,W,H);
    window.SectorArt?.draw(c,m);
    const offset=m.outline.map(([x,y])=>[x+4,y+11]);poly(c,offset,m.pal[0],m.pal[0],8);
    floorLines(c,m,rng);serviceRuns(c,m,rng);deckEdge(c,m);
    c.save();poly(c,m.outline,null);c.clip();cornerMachinery(c,m,rng);c.restore();
    for(const b of m.blockers){
      if(b.verts){
        poly(c,b.verts,m.pal[5],m.pal[6],4);
        c.save();poly(c,b.verts,null);c.clip();cutaway(c,b,m,rng);c.restore();
        poly(c,b.verts,null,m.pal[5],2);
      }else if(["hold","pool","slag","well","void"].includes(b.type))cutaway(c,b,m,rng);
      else if(b.type==="cargo")cargo(c,b.x,b.y,b.w,b.h,m.pal);
      else if(b.type==="root")plant(c,b,m,rng);else machine(c,b,m,rng);
    }
    infrastructure(c,m);
    for(const x of [46,898]){
      const v=c.createRadialGradient(x,268,1,x,268,70);
      v.addColorStop(0,"rgba(230,172,91,.12)");v.addColorStop(1,"rgba(230,172,91,0)");rect(c,x-70,198,140,140,v);
    }
    return image;
  }
  function infrastructure(c,m){
    const t=m.def.type,p=m.pal; c.save();
    if(t==="dock"||t==="tide"){
      // A working traveling hoist rides its own north rail; the operator's cab sits over the quay.
      c.save();c.translate(m.room===2?460:197,60);
      poly(c,[[-20,13],[-7,-17],[3,-18],[11,10],[20,15],[20,18],[-22,18]],"#192f36",p[6],1.6);
      for(const x of [-12,6]){rect(c,x,12,9,8,p[5]);rect(c,x+2,13,4,3,"#8d8f80");}
      line(c,[[-9,-34],[-5,-8],[9,8]],"#805f46",6);
      poly(c,[[-21,-31],[-9,-41],[78,-31],[85,-25],[75,-23],[-9,-28],[-17,-22]],"#9e7851","#283d42",2);
      for(let j=0;j<7;j++)line(c,[[j*11-5,-29+j*.45],[j*11,-36+j*.9],[j*11+6,-28+j*.45]],"#3c4540",2);
      rect(c,-22,-22,21,16,"#5b6660");rect(c,-20,-22,17,3,"#a8a397");
      rect(c,-19,-17,12,6,"#304952");rect(c,-18,-16,9,2,"#8daaaa");
      line(c,[[74,-23],[74,-9],[77,-8],[79,-11]],"#647573",2);
      c.restore();
    }else if(isOrganic(t)){
      for(const x of [186,755]){
        const sign=x<400?1:-1;
        line(c,[[x,103],[x+sign*14,76],[x+sign*48,51],[x+sign*92,49]],"#334f47",11);
        line(c,[[x-1,102],[x+sign*14,75],[x+sign*48,50],[x+sign*92,48]],"#779184",5);
        line(c,[[x+sign*5,101],[x+sign*20,77],[x+sign*47,57]],"#48685b",2);
        for(let j=0;j<4;j++){const u=x+sign*(14+j*18),v=j===0?81:56;oval(c,u,v,4,6,"#9a9568","#435c47",2);}
      }
    }else if(isHot(t)){
      for(const x of [155,738]){
        line(c,[[x,64],[x,44],[x+10,34],[x+37,34],[x+45,43],[x+45,69]],"#352e34",11);
        line(c,[[x-1,64],[x-1,44],[x+9,33],[x+37,33],[x+44,43],[x+44,69]],"#877369",6);
        for(const u of [x-4,x+41]){rect(c,u,51,9,4,"#473c3c");rect(c,u,52,9,1.5,"#aa8e76");}
        rect(c,x-9,64,18,8,p[5]);rect(c,x+36,67,18,7,p[5]);rect(c,x-6,65,12,2,p[7]);
      }
    }else if(t==="array"||t==="signal"){
      for(const x of [227,699]){
        const y=79;
        poly(c,[[x-8,y+5],[x-3,y-17],[x+3,y-17],[x+10,y+5]],p[5],p[6],1.5);
        poly(c,[[x-22,y-22],[x-7,y-16],[x+5,y-16],[x+23,y-26],[x+13,y-12],[x+2,y-9],[x-12,y-12]],"#776d88",p[5],2);
        line(c,[[x-21,y-23],[x-7,y-18],[x+7,y-19],[x+22,y-27]],"#ad9fba",2);
        line(c,[[x+2,y-14],[x+10,y-31]],p[6],2);rect(c,x+9,y-32,3,2,m.def.accent);
      }
    }else if(isOrbital(t)){
      for(const x of [239,660]){
        const y=67;
        poly(c,[[x-3,y+13],[x+6,y-15],[x+10,y-15],[x+3,y+14]],p[6]);
        poly(c,[[x-30,y-6],[x-22,y-22],[x+47,y-29],[x+38,y-13]],"#345368","#a1a59c",2);
        for(let j=0;j<6;j++)line(c,[[x-20+j*10,y-8-j],[x-12+j*10,y-22-j]],"#6b8492",1.5);
        line(c,[[x-26,y-13],[x+44,y-20]],"#75909c",1.5);
      }
    }else{
      for(const x of [242,703])for(let j=0;j<3;j++){
        rect(c,x+j*13,48,10,23,"#626653");rect(c,x+j*13+2,50,5,17,"#a89968");rect(c,x+j*13,65,10,3,p[5]);
      }
    }
    c.restore();
  }
  function serviceRuns(c,m,rng){
    const t=m.def.type,p=m.pal;
    c.save();poly(c,m.outline,null);c.clip();
    // The service lines physically connect each fixture to a collector on the perimeter.
    for(const b of m.blockers){
      const x=b.x+b.w*.52,y=b.y+b.h*.5,top=y<252,to=top?82:466,dir=top?-1:1;
      const cable=[[x,y],[x,y+dir*(b.h*.5+7)],[x+10,y+dir*(b.h*.5+17)],[x+10,to]];
      line(c,cable,p[5],7);line(c,cable,p[4],4);line(c,cable,p[6],1.3);
      for(let n=Math.min(y+dir*(b.h*.5+24),to)+8;n<Math.max(y+dir*(b.h*.5+24),to)-4;n+=14){
        rect(c,x+6,n,8,3,p[5]);rect(c,x+6,n,8,1,p[6]);
      }
      if(b.type==="cargo"||b.type==="press"||b.type==="tank"){
        c.setLineDash([12,6]);c.strokeStyle=p[7];c.lineWidth=1.5;c.strokeRect(b.x-7,b.y-10,b.w+15,b.h+19);c.setLineDash([]);
      }
    }
    if(t==="dock"||t==="tide"){
      // Wet slabs hold low, broken reflections of the overhead lamps.
      for(let i=0;i<11;i++){
        const x=100+rng()*750,y=93+rng()*353,w=12+rng()*42,h=3+rng()*7;
        poly(c,[[x-w*.66,y],[x-w*.27,y-h],[x+w*.35,y-h*.8],[x+w*.63,y-h*.4],[x+w,y+h*.1],[x+w*.23,y+h],[x-w*.42,y+h*.6]],"#263c43");
        rect(c,x-w*.27,y-h*.5,w*.54,1.4,"#4d6566");rect(c,x-w*.16,y+h*.28,w*.27,1.4,"#4e6565");
      }
      if(m.room===2){
        for(const rad of [76,82])oval(c,479,270,rad*1.6,rad*.74,null,"#526265",2);
        for(let i=0;i<24;i++){const a=i*TAU/24,x=479+Math.cos(a)*123,y=270+Math.sin(a)*58;rect(c,x,y,3,2,p[5]);}
      }
    }else if(isHot(t)){
      const y=259;
      for(const x of [61,666]){
        rect(c,x,y,210,19,p[5]);rect(c,x,y+3,210,12,"#4b4444");
        for(let k=0;k<26;k++)rect(c,x+4+k*8,y+3,2,11,"#71605a");
        rect(c,x,y+17,210,2,p[6]);
      }
    }else if(isOrganic(t)){
      for(const x of [122,211,715,835]){
        const y=x%2?448:91,sign=y>270?-1:1;
        for(let i=0;i<5;i++){
          const len=14+rng()*21,off=(i-2)*7;
          line(c,[[x,y],[x+off*.6,y+sign*len*.4],[x+off*1.2,y+sign*len*.7],[x+off*.9,y+sign*len]],"#3a5243",3.5);
        }
      }
    }else{
      for(const x of [172,773]){
        for(const y of [191,345]){
          const dir=x>470?-1:1;
          for(let n=0;n<3;n++)line(c,[[x,y+n*5],[x+dir*38,y+n*5],[x+dir*51,y-12+n*5],[x+dir*(63+n*7),y-12+n*5]],p[6],1.2);
          oval(c,x,y+5,5,5,p[5],p[6],1.5);
        }
      }
    }
    // Darken the rim to give the central route natural emphasis.
    const shade=c.createLinearGradient(0,60,0,490);shade.addColorStop(0,"rgba(5,10,19,.15)");shade.addColorStop(.35,"rgba(5,10,19,0)");shade.addColorStop(1,"rgba(5,10,19,.12)");rect(c,0,60,W,430,shade);
    c.restore();
  }
  const sockets=[[732,104],[802,430],[861,183],[829,329],[498,437],[498,93],[156,421],[159,106],[793,265],[154,265],[363,198],[410,323],[608,196],[620,315],[254,343],[250,191]];
  const point=(x,y)=>({x,y});
  function freePoint(g,x,y,r) {
    for(let i=0;i<80;i++){
      const a=i*2.39996,d=i?12*Math.ceil(i/8):0,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
      if(!blocked(g,px,py,r))return point(px,py);
    }
    return point(480,270);
  }
  const rewardNames={chip:"weapon chip",gun:"weapon cache",active:"active cache",repair:"hull repair",armor:"armor locker",overclock:"overclock"};
  function vaultThreshold(lab){
    const r=lab.bossRoom,d=lab.door,t=lab.tile;
    // The keyed bulkhead sits two tiles upstream. The fight shutter closes
    // immediately outside the chamber, across the full width of its passage.
    const x=d.x<r.center.x?r.x/t-1:(r.x+r.w)/t;
    const y=d.y<r.center.y?r.y/t-1:(r.y+r.h)/t;
    lab.sealCells=d.cells.map(p=>d.axis==="x"?{cx:x,cy:p.cy}:{cx:p.cx,cy:y});
    const cols=lab.sealCells.map(p=>p.cx),rows=lab.sealCells.map(p=>p.cy);
    lab.seal={left:Math.min(...cols),right:Math.max(...cols),top:Math.min(...rows),bottom:Math.max(...rows)};
    lab.sealClosed=false;
  }
  function insideVault(room,p,pad){
    return !!p&&p.x>=room.x+pad&&p.x<=room.x+room.w-pad&&p.y>=room.y+pad&&p.y<=room.y+room.h-pad;
  }
  function permitsRecall(g,dest){
    return !g.map?.lab?.sealClosed||insideVault(g.map.bossRoom,dest,g.player.bodyR??g.player.r??10);
  }
  function build(g,options={}) {
    const id=Math.max(0,Math.min(maps.length-1,Math.floor(g.mapId||0))),def=maps[id],room=g.room||0;
    const deep=g.stage>5, bossStage=!deep||g.stage%5===0, boss=room===3&&bossStage;
    const hasRoute=deep||g.expeditionMode==="endless";
    // On boss sectors the route objective occupies the approach to the arena.
    const objectiveRoom=bossStage?2:3;
    const depth=Math.max(0,g.stage-1),crew=pilots(g).length>1;
    const growth=8.5*Math.min(depth,9)+6.6*Math.min(20,Math.max(0,depth-9))+16*Math.sqrt(Math.max(0,depth-29));
    const challenge=window.ExpeditionRules?.difficulty(g.difficulty);
    const baseLimit=Math.min(48,16+4*Math.min(depth,4)+Math.max(0,depth-4)*2)+(crew?8:0);
    const m=g.map={
      id,room,def,pal:themes[def.type],outline:decks[id],blockers:shapes(id,room,g.stage),boss,complete:false,left:false,age:0,
      wave:0,totalWaves:boss?1:3,arrivals:[],waveStarted:false,gap:.45,serial:0,
      baseWaveSize:Math.floor(16+growth+room*3),crew,challenge,packSize:Math.min(15,5+Math.floor(g.stage/2))+(crew?2:0),
      liveLimit:Math.min(crew?56:48,Math.round(baseLimit*(challenge?.live??1))),
      waveSize:0,waveQueued:0,packDelay:0,packIndex:0,
      gate:point(873,271),side:null,nodes:[],route:hasRoute?(g.route||{}):{},task:"",command:null,
      modTimer:5.4,strip:null,signal:0,linkActive:false,modifierNode:null,weather:[],mapName:def.name
    };
    m.lab=window.Labyrinth?.create(g,options)||null;
    g.worldW=m.width=m.lab?.width||W;g.worldH=m.height=m.lab?.height||H;
    g.encounter=m.lab?.layoutName||def.rooms[room]||def.rooms[0];g.objective=m.lab?Labyrinth.goal(m.lab):"Incoming contacts";g.prompt="";g.prompts=[];
    g.player.x=m.lab?.entry.x??100;g.player.y=m.lab?.entry.y??271;
    if(m.lab){
      m.gate=m.lab.gate;m.blockers=[];m.totalWaves=m.lab.rooms.filter(r=>r.ambush).length;
      m.bossRoom=boss?m.lab.bossRoom:null;
      if(m.bossRoom)vaultThreshold(m.lab);
    }else if(!boss){
      const offset=(room%2)*52;
      m.posts=[[212+offset,206],[734-offset,321],[485,117],[479,424]].map(([x,y])=>({...freePoint(g,x,y,18),disabled:0}));
      m.pulse={clock:g.stage===1&&room===0?5:3,serial:0,post:null,tell:0,angles:[]};
    }
    if (m.lab || room===1) {
      const k=m.lab&&room!==1?"gun":["chip","active","repair","chip","armor","gun"][id%6];
      m.side={...(m.lab?m.lab.cache:freePoint(g,481,399,25)),kind:k,state:"available",engaged:false};
    }
    if(!m.lab && id===1 && room===1){
      const root=m.blockers.find(b=>b.type==="root"),p=freePoint(g,root.x-20,root.y+root.h*.5,17);
      m.rootValve={root,target:Foes.objective(g,"nest",p.x,p.y,{hp:36,goal:false})};
    }
    if(!m.lab && id===5 && room<3){
      const slab=shape("pool",428,140+room*18,101,36);
      m.shutter={slab,open:false,clock:5};m.blockers.push(slab);
    }
    m.huntOpening=hasRoute && m.route.objective==="Hunt" && room===objectiveRoom-1;
    if(hasRoute && (m.huntOpening || room===objectiveRoom)){
      m.task=m.route.objective||"Breach";
      if(m.task==="Hunt" && !m.huntOpening && g.huntCarry?.stage===g.stage && g.huntCarry.defeated){
        m.command={hp:0,dead:true};g.huntCarry=null;
      }
      if(m.lab&&m.lab.taskAnchors){
        const count={Purge:3,Stabilize:3,Breach:2,Transmit:1}[m.task]||0;
        for(const pos of m.lab.taskAnchors.slice(0,count))m.nodes.push({...pos,done:false,target:null,hp:74});
      }else if(m.task==="Purge"){
        for(const [x,y] of [[275,253],[519,380],[755,237]]){
          const p=freePoint(g,x,y,22);
          const target=Foes.objective(g,"nest",p.x,p.y,{hp:74,spawnId:12,goal:true});
          m.nodes.push({...p,target,done:false});
        }
      }else if(m.task==="Transmit"){
        m.nodes.push({...freePoint(g,521,269,33),done:false});
      }else if(m.task==="Breach"||m.task==="Stabilize"){
        const places=m.task==="Stabilize"?[[248,266],[480,152],[748,279]]:[[244,255],[737,287]];
        for(const [x,y] of places)m.nodes.push({...freePoint(g,x,y,18),done:false});
      }
    }
    if(!m.lab && !boss && hasRoute && m.route.modifier==="Sleeping Relays"){
      const p=freePoint(g,775,259,19);
      m.modifierNode=Foes.objective(g,"portal",p.x,p.y,{hp:85,spawnId:24,goal:false});
    }
    if(m.lab)return;
    const rng=seeded(87412+id*487+room*67);
    for(let i=0;i<48;i++)m.weather.push({x:rng()*W,y:rng()*H,s:1+rng()*2,l:3+rng()*8});
  }
  function chooseBoss(g) {
    if(g.expeditionMode==="endless"&&g.stage>=2&&g.stage<=5){
      const pair=g.stage<=3?1:3,flip=((g.seed>>>pair)&1);
      return pair+(g.stage-1-pair+flip)%2;
    }
    if(g.stage<=5)return g.stage-1;
    let next;
    if(g.stage===10)next=5;
    else if(g.stage===15)next=6;
    else {next=Math.floor(g.rng()*6);if(next>=(g.lastBossId??-1))next=(next+1)%7;}
    return next;
  }
  const laneVectors=[[0,-1],[1,0],[0,1],[-1,0]];
  function chamberSpawn(g,room,serial,lane,radius,except) {
    const squad=livingPilots(g),crowd=g.enemies.filter(e=>!e.dead&&e.hp>0).concat(g.map.arrivals.filter(a=>a!==except));
    const vector=laneVectors[lane]||[0,0],center=room.center;
    let best=center,score=-Infinity;
    // Use the chamber vents first. Interior fallback positions keep a camped vent
    // or a wall near a bevel from permanently holding up the encounter.
    for(let i=0;i<24;i++){
      let x,y;
      if(i<16&&room.vents.length){
        const vent=room.vents[(serial+i)%room.vents.length];
        x=vent.x+(g.rng()-.5)*(i<8?28:80);y=vent.y+(g.rng()-.5)*(i<8?28:80);
      }else{
        x=room.x+radius+(room.w-radius*2)*g.rng();y=room.y+radius+(room.h-radius*2)*g.rng();
      }
      if(blocked(g,x,y,radius))continue;
      const p={x,y};let gap=120;
      for(const e of crowd)gap=Math.min(gap,Math.hypot(x-e.x,y-e.y)-(e.r||12)-radius);
      const fromPilot=Math.min(...squad.map(pilot=>distance(p,pilot)));
      const sided=vector[0]*(x-center.x)/room.w+vector[1]*(y-center.y)/room.h;
      const value=Math.min(230,fromPilot)*.27-Math.max(0,105-fromPilot)*9+
        Math.min(65,gap)*.55-Math.max(0,4-gap)*9+sided*25+(i<8?28:0);
      if(value>score){score=value;best=p;}
    }
    return best;
  }
  function spawnSpot(g,serial,boss,lane=-1,except=null,room=null,radius=21) {
    const m=g.map;
    if(boss&&room&&!except&&m.lab.bossSpawn){
      const p=m.lab.bossSpawn;
      if(!blocked(g,p.x,p.y,radius)&&livingPilots(g).every(pilot=>distance(p,pilot)>120)&&
          !g.enemies.some(e=>e.hp>0&&!e.dead&&distance(e,p)<radius+(e.r||12)))return p;
    }
    if(room)return chamberSpawn(g,room,serial,lane,radius,except);
    const squad=livingPilots(g),target=squad[serial%Math.max(1,squad.length)]||g.player;
    if(boss){
      const p=freePoint(g,655,267,radius);
      if(squad.every(pilot=>distance(p,pilot)>=90)&&!g.enemies.some(e=>e.hp>0&&!e.dead&&distance(p,e)<radius+(e.r||12)))return p;
    }
    const vector=laneVectors[lane],occupied=g.enemies.filter(e=>e.hp>0&&!e.dead).concat(m.arrivals.filter(a=>a!==except));
    let best=null,score=-Infinity;
    for(let i=0;i<sockets.length;i++){
      const n=(i+serial*3+m.room)%sockets.length,arr=sockets[n];
      const p=freePoint(g,arr[0]+(g.rng()-.5)*88,arr[1]+(g.rng()-.5)*62,radius);
      const playerDist=distance(p,target),nearestDist=Math.min(...squad.map(pilot=>distance(p,pilot)));
      let nearestSq=170*170;
      for(const other of occupied){
        const dx=other.x-p.x,dy=other.y-p.y;
        nearestSq=Math.min(nearestSq,dx*dx+dy*dy);
      }
      const neighbor=Math.sqrt(nearestSq);
      const ideal=235+(serial%3)*49;
      let sight=24;
      for(let n=1;n<6;n++)if(blocked(g,p.x+(target.x-p.x)*n/6,p.y+(target.y-p.y)*n/6,1)){sight=-12;break;}
      const laneFit=vector?75*(vector[0]*(p.x-480)/420+vector[1]*(p.y-270)/180):0;
      const open=-Math.abs(ideal-playerDist)*.30-Math.max(0,145-nearestDist)*3.5+
        neighbor*.9-Math.max(0,34-neighbor)*10+sight+laneFit+g.rng()*24;
      if(open>score){score=open;best=p;}
    }
    return best;
  }
  function queueFoe(g,id,delay,opts={},role="",lane=-1) {
    const m=g.map;
    const room=m.lab?(role==="side"?Labyrinth.roomAt(m.lab,m.side.x,m.side.y):m.lab.activeRoom):null;
    const radius=opts.boss?50:Math.max(9,(Foes.defs[id]?.r||15)*(opts.elite?1.12:1)+2);
    const p=spawnSpot(g,++m.serial,opts.boss,lane,null,room,radius);
    m.arrivals.push({...p,id,remaining:delay,opts,role,lane,room,radius});
  }
  const openingPatrols=[
    [[0,12,0,12,0],[0,12,12,2,0,1],[2,0,3,12,0,12,1]],
    [[0,1,12,0,12],[3,12,2,0,1,6],[7,12,2,0,13,12,6,0]],
    [[0,12,2,0,12],[7,0,9,12,2,1],[5,6,2,12,0,7,11,12,3]]
  ];
  function chooseFoe(g,index) {
    const m=g.map,roster=m.def.enemies;
    if(g.stage===1&&(m.id===0||!Number.isInteger(g.startRegion))){
      const candidates=openingPatrols[m.room]?.[m.wave-1];if(candidates)return candidates[index%candidates.length];
    }
    const unlocked=g.stage<6?Math.min(roster.length,4+m.room*2+m.wave*2):roster.length;
    if(g.stage>5&&index%5===4)return (m.id*7+m.room*3+m.wave+index+Math.floor(g.rng()*12))%36;
    return roster[Math.floor(g.rng()*unlocked)];
  }
  function beginWave(g) {
    const m=g.map;m.wave++;m.waveStarted=true;
    if(m.boss&&!m.lab){
      const id=chooseBoss(g);g.lastBossId=id;
      queueFoe(g,id,1.25,{boss:true},"boss");return;
    }
    const chamberGrowth=Math.max(6,Math.ceil(m.baseWaveSize*.16));
    m.waveSize=Math.ceil((m.baseWaveSize+chamberGrowth*(m.wave-1))*(m.crew?1.3:1)*(m.challenge?.wave??1));
    m.waveQueued=0;m.packDelay=0;m.packIndex=0;
    if((m.task==="Intercept"||m.task==="Hunt")&&!m.command && m.wave===1){
      const id=g.huntCarry?.stage===g.stage?g.huntCarry.id:m.def.enemies[Math.min(m.def.enemies.length-1,4)];
      queueFoe(g,id,.85,{elite:true},"command");
    }
  }
  function swarmType(m) {
    if(isOrganic(m.def.type))return 37;
    if(isOrbital(m.def.type)||m.def.type==="array"||m.def.type==="signal"||m.def.type==="vault")return 38;
    return 36;
  }
  function queueWavePack(g,dt,liveCount) {
    const m=g.map,remaining=m.waveSize-m.waveQueued;
    if(!remaining)return;
    m.packDelay-=dt;
    const reserved=m.arrivals.length;
    const slots=Math.min(m.liveLimit-liveCount-reserved,Math.ceil(m.liveLimit*.55)-reserved);
    const count=Math.min(m.packSize,remaining,slots);
    if(m.packDelay>0 || count<Math.min(2,remaining))return;
    const firstLane=(m.packIndex+m.room+m.wave-1)%4;
    for(let j=0;j<count;j++){
      const index=m.waveQueued+j;
      const elite=m.room===2 && m.wave===m.totalWaves && index===0 && m.task!=="Hunt"
        || g.stage>=20 && m.wave===2 && index===1;
      const lane=(firstLane+(j%2)*2)%4;
      const fodderShare=Math.min(7,3+Math.floor(g.stage/6));
      const rush=m.packIndex%3===0||(index+m.packIndex)%10<fodderShare;
      const id=rush&&!elite?swarmType(m):chooseFoe(g,index);
      queueFoe(g,id,.72+j*(rush?.075:.12),{elite},"",lane);
    }
    m.waveQueued+=count;m.packIndex++;
    m.packDelay=(g.stage===1&&m.room===0?1.5:Math.max(.56,1.6-g.stage*.07))*(m.challenge?.packDelay??1);
  }
  function resolveArrivals(g,dt,squad,live) {
    const m=g.map;
    for(let i=m.arrivals.length-1;i>=0;i--){
      const obj=m.arrivals[i];obj.remaining-=dt;if(obj.remaining>0)continue;
      if(live.length>=m.liveLimit){obj.remaining=.28;continue;}
      const radius=obj.radius;
      if(squad.some(p=>distance(obj,p)<90)||blocked(g,obj.x,obj.y,radius)||
        live.some(e=>distance(e,obj)<(e.r||12)+radius)){
        const safe=spawnSpot(g,++m.serial,obj.opts.boss,obj.lane,obj,obj.room,radius);
        obj.x=safe.x;obj.y=safe.y;obj.remaining=obj.opts.boss?1.25:.72;continue;
      }
      const e=g.spawn(obj.id,obj.x,obj.y,obj.opts);
      if(obj.room)e.chamberId=obj.room.id;
      live.push(e);
      if(obj.role==="command"){
        m.command=e;m.patrol=0;
        if(m.task==="Hunt" && !m.huntOpening && g.huntCarry?.stage===g.stage){e.hp=Math.max(1,Math.round(g.huntCarry.ratio*e.maxHp));g.huntCarry=null;}
      }
      if(obj.role==="side"){e.sideGuard=true;m.side.targets.push(e);}
      if(obj.role==="boss")m.bossEntity=e;
      m.arrivals.splice(i,1);
    }
  }
  function objectiveLogic(g,dt,squad) {
    const m=g.map;
    if(m.pulse&&!m.complete)fieldPulse(g,dt,squad);
    if(m.rootValve && !m.rootValve.open && (m.rootValve.target.hp<=0 || m.rootValve.target.life<=0)){
      const b=m.rootValve.root;m.blockers=m.blockers.filter(o=>o!==b);m.image=null;m.rootValve.open=true;
      g.fx(b.x+b.w/2,b.y+b.h/2,"#a8ba80",16);
    }
    if(m.shutter){
      const s=m.shutter,b=s.slab;s.clock-=dt;
      if(s.clock<=0){
        const occupied=[...pilots(g),...g.enemies.filter(e=>!e.dead&&e.hp>0)].some(e=>{
          const r=(e.r||12)+5;return e.x>b.x-r&&e.x<b.x+b.w+r&&e.y>b.y-r&&e.y<b.y+b.h+r;
        });
        if(!s.open || !occupied){
          s.open=!s.open;s.clock=s.open?11:6;
          if(s.open)m.blockers=m.blockers.filter(o=>o!==b);else m.blockers.push(b);
          m.image=null;
        }
      }
    }
    if(m.task==="Purge")for(const n of m.nodes){
      if(n.done)continue;
      if(n.target&&(n.target.hp<=0||n.target.life<=0)){
        n.done=true;n.hp=0;n.target.life=0;if(m.lab)g.labSafe?.();continue;
      }
      if(!m.lab)continue;
      const close=squad.some(p=>Labyrinth.roomAt(m.lab,p.x,p.y)?.id===n.roomId||
        distance(n,p)<225&&Labyrinth.clearLine(m.lab,n,p));
      if(close&&!n.target)n.target=Foes.objective(g,"nest",n.x,n.y,{hp:n.hp,spawnId:12,goal:true});
      else if(!close&&n.target){
        n.hp=n.target.hp;n.target.life=0;n.target=null;
      }
    }
    if(m.task==="Transmit"&&m.linkActive&&!m.nodes[0].done &&squad.some(p=>distance(p,m.nodes[0])<90)){
      m.signal=Math.min(16,m.signal+dt);m.nodes[0].done=m.signal>=16;
      if(m.nodes[0].done&&m.lab)g.labSafe?.();
    }
    if(m.command?.hp>0&&!m.command.dead){
      if(m.task==="Intercept"){
        const chamber=m.lab?.rooms.find(r=>r.id===m.command.chamberId);
        if(chamber){
          const dest=chamber.vents[m.patrol%chamber.vents.length];
          m.command.chase=Labyrinth.waypoint(m.lab,m.command,dest);
          if(distance(m.command,dest)<44)m.patrol++;
        }else{
          const course=[[778,271],[755,402],[480,270],[191,119],[185,264],[493,412]],p=course[m.patrol%course.length];
          m.command.chase=freePoint(g,p[0],p[1],20);if(distance(m.command,m.command.chase)<44)m.patrol++;
        }
      }else if(m.huntOpening && m.command.hp<m.command.maxHp*.5){
        g.huntCarry={stage:g.stage,id:m.command.id,ratio:m.command.hp/m.command.maxHp};
        g.fx(m.command.x,m.command.y,"#c5adff",18);m.command.dead=true;m.command.hp=0;
      }
    }
    if(m.huntOpening && m.command && (m.command.dead||m.command.hp<=0) && g.huntCarry?.stage!==g.stage){
      g.huntCarry={stage:g.stage,defeated:true};
    }
    if(m.side?.state==="fighting"&&!m.arrivals.some(a=>a.role==="side")&&m.side.targets.length>0&&m.side.targets.every(e=>e.dead||e.hp<=0)){
      m.side.state="ready";if(m.lab)g.labSafe?.();
    }
    m.modTimer-=dt;
    const red=m.route.modifier==="Red Shift",stabilize=m.task==="Stabilize"&&m.nodes.some(n=>!n.done);
    if(squad.length && !m.complete&&!m.strip&&m.modTimer<=0&&(red||stabilize)&&(!m.lab||m.lab.activeRoom)){
      const room=m.lab?.activeRoom;
      const targets=room?squad.filter(p=>Labyrinth.roomAt(m.lab,p.x,p.y)===room):squad;
      const target=targets[(m.sweepIndex||0)%Math.max(1,targets.length)]||room.center;
      const y=room?Math.max(room.y+25,Math.min(room.y+room.h-25,target.y)):Math.max(102,Math.min(431,target.y));
      m.sweepIndex=(m.sweepIndex||0)+1;
      m.strip={y,left:room?room.x+24:32,right:room?room.x+room.w-24:927,age:0,struck:new Set()};m.modTimer=7.7;
    }
    if(m.strip){
      m.strip.age+=dt;
      if(m.strip.age>1.45&&m.strip.age<1.80){
        for(const pilot of squad)if(!m.strip.struck.has(pilot) && Math.abs(pilot.y-m.strip.y)<16&&pilot.x>=m.strip.left&&pilot.x<=m.strip.right){
          m.strip.struck.add(pilot);
          (g.forPilot?.(pilot) || g).hurtPlayer(10);
        }
      }
      if(m.strip.age>=1.9)m.strip=null;
    }
    if(m.route.modifier==="Crosswind"){
      const turn=Math.sin(m.age*.65)*.14*dt,cos=Math.cos(turn),sin=Math.sin(turn);
      for(const b of g.hostile){
        if(!b.heavy && Number.isFinite(b.vx)&&Number.isFinite(b.vy) && b.life>0){
          const vx=b.vx;b.vx=vx*cos-b.vy*sin;b.vy=vx*sin+b.vy*cos;
        }
      }
    }
  }
  function fieldPulse(g,dt,squad){
    const m=g.map,p=m.pulse,s=g.stage;
    for(const b of m.posts)b.disabled=Math.max(0,b.disabled-dt);
    if(p.post){
      p.tell-=dt;
      if(p.tell>0)return;
      const b=p.post,c=p.color;
      if(!b.disabled && g.hostile.length<Math.min(135,56+6*s)){
        const speed=113+Math.min(6,s)*4;
        for(const [i,a] of p.angles.entries()){
          const charge=p.pattern===3&&i%2===0?1.12:1;
          g.hostile.push({x:b.x+Math.cos(a)*12,y:b.y+Math.sin(a)*12,vx:Math.cos(a)*speed*charge,vy:Math.sin(a)*speed*charge,
            r:3.4,age:0,life:4.2,shape:p.pattern===1?"seed":p.pattern===2?"diamond":"dart",color:c,damage:7,heavy:false});
        }
        g.fx(b.x,b.y,c,4);
      }
      p.post=null;p.clock=(s===1&&m.room===0?3.7:3.0)+g.rng()*.7;return;
    }
    p.clock-=dt;if(p.clock>0||!m.wave||!squad.length)return;
    const target=squad[p.serial%squad.length];
    let choice=null,score=-Infinity;
    for(let i=0;i<m.posts.length;i++){
      const post=m.posts[(p.serial+i)%m.posts.length],d=distance(target,post);
      if(post.disabled||squad.some(pilot=>distance(pilot,post)<96))continue;
      let weight=18-i*2-Math.abs(265-d)*.023;
      for(let n=1;n<10;n++)if(blocked(g,post.x+(target.x-post.x)*n/10,post.y+(target.y-post.y)*n/10,1)){weight-=19;break;}
      if(weight>score){choice=post;score=weight;}
    }
    if(!choice){p.clock=.65;return;}
    p.post=choice;p.serial++;p.tell=1.08;
    const a=Math.atan2(target.y-choice.y,target.x-choice.x),kind=m.id;
    p.pattern=isOrganic(m.def.type)?1:isHot(m.def.type)?2:(kind===3||kind===4||kind===8)?3:0;
    p.color=["#ffab76","#f6dc78","#ff9b68","#f2a7e6"][p.pattern];
    if(p.pattern===1)p.angles=Array.from({length:9},(_,i)=>a-.65+(i+1)*TAU/11);
    else if(p.pattern===2)p.angles=[-.7,-.42,0,.42,.7].map(v=>a+v);
    else if(p.pattern===3)p.angles=[-.83,-.50,-.18,.18,.50,.83].map(v=>a+v);
    else p.angles=(m.room===0&&s===1?[-.34,0,.34]:[-.72,-.36,0,.36,.72]).map(v=>a+v);
  }
  function taskDone(m) {
    if(m.task==="Intercept"||m.task==="Hunt")return m.command && (m.command.hp<=0||m.command.dead);
    return m.nodes.every(o=>o.done);
  }
  function taskText(m) {
    const count=m.nodes.filter(n=>n.done).length,progress=count+"/"+m.nodes.length;
    switch(m.task){
      case "Purge":return "Destroy root nodes · "+progress;
      case "Breach":return "Bypass control panels · "+progress;
      case "Stabilize":return "Disarm hazard towers · "+progress;
      case "Transmit":return m.linkActive?"Hold the uplink · "+Math.floor(m.signal/16*100)+"%":"Activate the uplink";
      case "Intercept":return "Intercept the moving commander";
      case "Hunt":return m.huntOpening?"Track the marked commander":"Eliminate the wounded commander";
      default:return "";
    }
  }
  function nearby(g,pilot=g.player) {
    if(!pilot || pilot.hp<=0)return null;
    const m=g.map;
    if(m.complete&&distance(pilot,m.gate)<64)return {title:m.room===3?"Open sector gate":"Enter transit gate",kind:"gate"};
    if(m.lab){
      const {key,door}=m.lab;
      if(!key.taken&&distance(pilot,key)<44)return {title:"Collect access key",kind:"lab"};
      if(!door.open&&distance(pilot,door)<58)return {title:key.taken?"Unlock bulkhead":"Bulkhead · access key required",kind:"lab"};
    }
    const s=m.side;
    if(s && distance(pilot,s)<59){
      if(s.state==="available")return {title:"Optional fight · "+rewardNames[s.kind],kind:"side"};
      if(s.state==="ready")return {title:"Claim "+rewardNames[s.kind],kind:"claim"};
    }
    const node=m.nodes.find(n=>!n.done&&distance(n,pilot)<58);
    if(node && m.task!=="Purge" && (m.task!=="Transmit" || !m.linkActive))
      return {title:m.task==="Transmit"?"Start uplink":m.task==="Breach"?"Bypass panel":"Disable tower",kind:"node",node};
    const post=m.posts?.find(n=>!n.disabled && distance(n,pilot)<36);
    if(post&&!m.complete)return {title:"Jam defense post · 14 s",kind:"jam",node:post};
    return null;
  }
  function labEvent(g,previous) {
    const event=g.map.lab.event;
    if(!event||event.serial===previous)return;
    g.sound(event.kind==="key"?"reward":"gate");if(event.text)g.toast?.(event.text);
    g.labSafe?.();
  }
  function stageBoss(g,dt,squad){
    const m=g.map,lab=m.lab,crew=pilots(g);
    const assembled=Labyrinth.bossReady(lab,squad)&&crew.every(p=>p.hp>0&&insideVault(m.bossRoom,p,(p.bodyR??p.r??10)+20));
    if(!assembled){m.bossCountdown=null;return;}
    if(m.bossCountdown==null){
      m.bossCountdown=1.25;g.toast?.("Vault sealing · step back to cancel");g.sound("gate");g.labSafe?.();return;
    }
    m.bossCountdown-=dt;
    if(m.bossCountdown>0)return;
    m.bossCountdown=null;lab.sealClosed=true;lab.nav.clear();
    const id=chooseBoss(g);g.lastBossId=id;
    lab.activeRoom=m.bossRoom;m.bossRoom.state="active";m.bossStarted=true;
    queueFoe(g,id,1.6,{boss:true},"boss");
    g.toast?.(m.bossRoom.name+" · heavy contact");g.sound("gate");
  }
  function updateLab(g,dt,squad,live) {
    const m=g.map,lab=m.lab,event=lab.event?.serial;
    const room=Labyrinth.step(lab,squad,!lab.activeRoom&&!m.complete);
    labEvent(g,event);
    if(room){
      lab.activeRoom=room;room.state="active";beginWave(g);
      g.toast?.(room.name+" · swarm inbound");g.sound("gate");
      if(m.route.modifier==="Sleeping Relays"&&!m.relayUsed){
        const pos=room.vents[0];m.modifierNode=Foes.objective(g,"portal",pos.x,pos.y,{hp:85,spawnId:24,goal:false});
        m.relayUsed=true;
      }
    }
    const hallsClear=()=>lab.rooms.every(r=>!r.ambush||r.state==="clear");
    if(m.bossRoom&&!m.bossStarted&&!lab.activeRoom&&lab.door.open&&hallsClear()&&taskDone(m))stageBoss(g,dt,squad);
    if(lab.activeRoom&&lab.activeRoom!==m.bossRoom)queueWavePack(g,dt,live.length);
    resolveArrivals(g,dt,squad,live);
    const active=lab.activeRoom;
    let remaining=0;
    if(active&&active!==m.bossRoom){
      remaining=m.waveSize-m.waveQueued;
      for(const e of live)if(!e.sideGuard&&e.chamberId===active.id)remaining++;
      for(const a of m.arrivals)if(a.role!=="side"&&a.room===active)remaining++;
    }
    if(active&&active!==m.bossRoom&&remaining===0){
      const cleared=lab.activeRoom;cleared.state="clear";lab.activeRoom=null;m.waveStarted=false;
      if(m.modifierNode){m.modifierNode.life=0;m.modifierNode.hp=0;}
      g.toast?.(cleared.name+" secured");g.sound("reward");g.labSafe?.();
    }
    if(m.bossRoom&&m.bossEntity&&!lab.bossDefeated&&(m.bossEntity.dead||m.bossEntity.hp<=0)){
      lab.bossDefeated=true;m.bossRoom.state="clear";lab.activeRoom=null;m.strip=null;lab.sealClosed=false;lab.nav.clear();
      for(const e of live)if(!e.sideGuard&&Labyrinth.roomAt(lab,e.x,e.y)===m.bossRoom){e.dead=true;e.hp=0;}
      for(const b of g.hostile)if(b.owner===m.bossEntity||Labyrinth.roomAt(lab,b.x,b.y)===m.bossRoom)b.life=0;
    }
    const secure=hallsClear();
    if(!m.complete&&lab.door.open&&secure&&taskDone(m)&&(!m.bossRoom||lab.bossDefeated)){
      m.complete=true;g.sound("gate");g.labSafe?.();
    }
    const mission=m.task&&!taskDone(m);
    lab.missionTarget=mission?(m.command?.hp>0?m.command:m.nodes.find(n=>!n.done))||null:null;
    if(lab.activeRoom&&lab.activeRoom===m.bossRoom)
      g.objective=m.bossEntity?"Defeat "+m.bossEntity.name:"Heavy contact inbound";
    else if(lab.activeRoom)g.objective=lab.activeRoom.name+" · Repel swarm ("+remaining+")";
    else if(m.side?.state==="fighting")g.objective="Secure the side cache";
    else if(mission&&secure)g.objective=taskText(m);
    else if(m.bossRoom&&secure&&lab.door.open&&!lab.bossDefeated){
      const crew=pilots(g),down=crew.findIndex(p=>p.hp<=0);
      if(m.bossCountdown!=null)g.objective="Vault sealing · step back to cancel";
      else if(down>=0)g.objective="Revive Pilot "+(down+1)+" before entering the vault";
      else g.objective=(crew.length>1?"Regroup inside ":"Enter the ")+m.bossRoom.name;
    }
    else g.objective=m.complete?"Reach the transit gate":Labyrinth.goal(lab);
  }
  function labCheckpoint(g) {
    const m=g.map;
    if(!m?.lab||m.left||m.lab.activeRoom||m.arrivals.length||m.side?.state==="fighting"||
       m.strip||g.hostile.some(b=>b.life>0)||g.enemies.some(e=>!e.dead&&e.hp>0))return null;
    if(livingPilots(g).some(p=>{
      const room=Labyrinth.roomAt(m.lab,p.x,p.y);return room?.ambush&&room.state==="idle";
    }))return null;
    return {stage:g.stage,room:g.room,layoutName:m.lab.layoutName,generation:m.lab.generation||1,layoutId:m.lab.layoutId,
      ...Labyrinth.snapshot(m.lab),sideState:m.side?.state||null,relayUsed:!!m.relayUsed,bossDefeated:!!m.lab.bossDefeated,
      nodes:m.nodes.map(n=>({done:n.done,hp:n.target?.hp??n.hp})),commandDefeated:!!m.command&&(m.command.dead||m.command.hp<=0),
      signal:m.signal,linkActive:m.linkActive};
  }
  function restoreLab(g,snapshot) {
    const m=g.map,lab=m?.lab;
    if(!lab||!snapshot||snapshot.stage!==g.stage||snapshot.room!==g.room||snapshot.layoutName!==lab.layoutName||
       (snapshot.generation||1)!==(lab.generation||1)||snapshot.layoutId&&snapshot.layoutId!==lab.layoutId)return false;
    Labyrinth.restore(lab,snapshot);
    m.relayUsed=!!snapshot.relayUsed;
    m.nodes.forEach((n,i)=>{
      const saved=snapshot.nodes?.[i];if(!saved)return;
      n.done=!!saved.done;
      if(Number.isFinite(saved.hp))n.hp=saved.hp;
    });
    m.signal=Math.max(0,Math.min(16,+snapshot.signal||0));m.linkActive=!!snapshot.linkActive;
    if(snapshot.commandDefeated)m.command={hp:0,dead:true};
    lab.bossDefeated=!!snapshot.bossDefeated;m.bossStarted=lab.bossDefeated;
    m.wave=lab.rooms.filter(r=>r.ambush&&r.state==="clear").length;
    m.complete=lab.door.open&&m.wave===m.totalWaves&&taskDone(m)&&(!m.bossRoom||lab.bossDefeated);
    if(m.side&&["ready","claimed"].includes(snapshot.sideState))m.side.state=snapshot.sideState;
    g.objective=m.complete?"Reach the transit gate":Labyrinth.goal(lab);return true;
  }
  function update(g,dt) {
    const m=g.map;if(!m||m.left)return;
    const squad=livingPilots(g);
    m.age+=dt;objectiveLogic(g,dt,squad);
    const live=g.enemies.filter(e=>!e.dead&&e.hp>0);
    if(m.lab){
      updateLab(g,dt,squad,live);
      g.prompts=pilots(g).map(p=>nearby(g,p)?.title||"");
      g.prompt=g.prompts.find(Boolean)||"";return;
    }
    if(!m.complete) {
      if(!m.waveStarted){m.gap-=dt;if(m.gap<=0)beginWave(g);}
      if(m.waveStarted&&!m.boss)queueWavePack(g,dt,live.length);
      resolveArrivals(g,dt,squad,live);
      if(m.waveStarted && m.waveQueued===m.waveSize && !m.arrivals.length){
        const bossDefeated=m.boss && m.bossEntity && (m.bossEntity.dead||m.bossEntity.hp<=0);
        if(m.wave<m.totalWaves && live.length<=Math.max(2,Math.floor(m.liveLimit*.2))){
          m.waveStarted=false;m.gap=1.25;
        } else if((bossDefeated || (m.wave===m.totalWaves && !live.length)) && taskDone(m)){
          m.complete=true;m.strip=null;g.sound("gate");
          if(bossDefeated){g.hostile.length=0;for(const e of g.enemies){e.dead=true;e.hp=0;}}
        }
      }
    }else if(m.arrivals.length)resolveArrivals(g,dt,squad,live);
    if(m.complete)g.objective=m.side?.state==="fighting"?"Optional security detail":"Gate online · move east";
    else if(m.task && !taskDone(m))g.objective=taskText(m);
    else if(m.boss)g.objective=m.bossEntity?"Defeat "+m.bossEntity.name:"Heavy contact inbound";
    else g.objective="Clear hostiles · wave "+Math.max(1,m.wave)+"/"+m.totalWaves;
    g.prompts=pilots(g).map(p=>nearby(g,p)?.title||"");
    g.prompt=g.prompts.find(Boolean)||"";
  }
  function interact(g) {
    const m=g.map,action=m&&!m.left?nearby(g):null;if(!action)return false;
    if(action.kind==="lab"){const serial=m.lab.event?.serial;Labyrinth.interact(m.lab,g.player);labEvent(g,serial);}
    else if(action.kind==="gate"){m.left=true;g.prompt="";g.completeRoom();}
    else if(action.kind==="side"){
      m.side.state="fighting";m.side.targets=[];
      for(let i=0;i<3;i++)queueFoe(g,m.def.enemies[(i*2+2)%m.def.enemies.length],.72+.4*i,{elite:i===0},"side");
      g.sound("gate");
    }
    else if(action.kind==="claim"){m.side.state="claimed";g.sideReward(m.side.kind);if(m.lab)g.labSafe?.();}
    else if(action.kind==="node"){
      if(m.task==="Transmit")m.linkActive=true;else action.node.done=true;
      if(m.lab)g.labSafe?.();
      g.fx(action.node.x,action.node.y,"#a6dfc7",10);g.sound("gate");
    }
    else if(action.kind==="jam"){action.node.disabled=14;g.fx(action.node.x,action.node.y,"#9cd6c8",7);g.sound("gate");}
    return true;
  }
  function atmosphere(c,m,time){
    const type=m.def.type,p=m.pal;
    c.save();
    if(type==="dock"||type==="tide"||type==="moon"){
      const y=73;
      for(const x of [112,760]){
        const osc=Math.sin(time*.21+x)*12;
        poly(c,[[x,y-3],[x+6,y-3],[x+86+osc,y+104],[x+18+osc,y+104]],"rgba(242,192,114,.047)");
        rect(c,x-3,y-3,12,3,"#a99570");rect(c,x,y-3,5,1.5,"#e6cba0");
      }
      if(type!=="moon"){
        c.beginPath();
        for(const a of m.weather){
          const x=(a.x+W-(time*(17+a.s)%W))%W,y=(a.y+time*(102+a.s*13))%H;
          c.moveTo(x,y);c.lineTo(x-2.8,y+a.l*.65);
        }
        c.lineWidth=1;c.strokeStyle="rgba(172,207,209,.16)";c.stroke();
        for(let i=0;i<6;i++){
          const a=m.weather[i],k=(time*.54+i*.31)%1;
          if(k<.68 && insideDeck(a.x,a.y,15,m.outline))oval(c,a.x,a.y,2+k*7,1+k*2.6,null,"rgba(145,178,179,.17)",1);
        }
      }
      if(type==="tide")for(let i=0;i<7;i++){
        const x=i*172+Math.sin(time*.27+i)*14;
        poly(c,[[x,0],[x+13,0],[x+94,93],[x+66,93]],"rgba(179,221,207,.055)");
      }
    }else if(isOrganic(type)||isHot(type)||type==="vault"){
      const organic=isOrganic(type),hot=isHot(type),seed=organic?"#d1bf80":hot?"#df955e":"#ddbc8b";
      for(let i=0;i<(organic?23:19);i++){
        const a=m.weather[i],x=(a.x+Math.sin(time*.35+i)*14+W)%W,y=(H+a.y-((time*(hot?11+a.s*6:4+a.s*2))%H))%H;
        c.globalAlpha=(.19+(.5+.5*Math.sin(time*.7+i))*.18);
        rect(c,Math.round(x),Math.round(y),i%6===0?3:1.8,hot?3:1.8,seed);
      }
      c.globalAlpha=1;
    }else if(type==="array"||type==="signal"){
      for(const x of [48,412,825]){
        const phase=(time*.45+x*.05)%1; c.globalAlpha=(1-phase)*.35;
        c.beginPath();c.arc(x+23,8,8+phase*33,Math.PI*1.07,Math.PI*1.81);c.lineWidth=1.6;c.strokeStyle="#b7a6c9";c.stroke();
      }
      c.globalAlpha=1;
    }
    for(const b of m.blockers){
      if(b.type==="slag"||b.type==="pool"||b.type==="hold"){
        const k=.5+.5*Math.sin(time*(b.type==="slag"?1.5:.7)+b.x),x=b.x+9+(b.w-34)*k;
        c.globalAlpha=.28+.23*k;
        rect(c,x,b.y+b.h*.61,8+7*k,1.4,b.type==="slag"?"#ffb764":"#a0c7b4");
        rect(c,x+5,b.y+b.h*.61+3,4+3*k,1.3,p[6]);c.globalAlpha=1;
      }else if(b.type==="lens"||b.type==="dish"){
        const x=b.x+b.w*.5,y=b.y+b.h*.45,k=time*.5;
        line(c,[[x,y],[x+Math.cos(k)*b.w*.24,y+Math.sin(k)*b.h*.17]],p[6],1.3);
      }else if(b.type==="press"){
        const n=(Math.floor(time*1.4)+Math.floor(b.x))%3;
        for(let i=0;i<3;i++)rect(c,b.x+b.w*.41+i*4,b.y+b.h*.37,2,2,i===n?"#dec29c":"#5d4a3e");
      }
    }
    c.restore();
  }
  function draw(c,g) {
    const m=g.map;if(!m)return;
    if(m.lab){Labyrinth.draw(c,g);return;}
    if(!m.image)m.image=bake(m);
    c.save();c.imageSmoothingEnabled=false;c.drawImage(m.image,0,0,W,H);atmosphere(c,m,g.time||m.age);c.restore();
  }
  function gate(c,x,y,m,t) {
    const online=m.complete,col=online?"#99e9d1":m.pal[7];
    c.save();c.translate(x,y);
    poly(c,[[-21,-30],[10,-30],[19,-22],[19,21],[11,29],[-20,29],[-27,22],[-27,-22]],"#17272d",m.pal[6],2);
    for(let i=0;i<7;i++)rect(c,-22,-17+i*5,38,2,"#3d5053");
    for(const v of [-34,28]){
      poly(c,[[-21,v],[-13,v-3],[12,v-3],[21,v+1],[18,v+8],[-20,v+8]],"#26363d",m.pal[6],2);
      rect(c,-11,v+1,20,3,col);
    }
    for(let i=0;i<3;i++){
      const u=-18+i*10,j=online?(Math.floor(t*4)%3===i):false;
      poly(c,[[u,-8],[u+5,-8],[u+12,0],[u+5,8],[u,8],[u+7,0]],j?"#d6fff1":online?"#69b5aa":"#65736e");
    }
    if(online){
      const k=(t*.9)%1;
      c.globalAlpha=(1-k)*.6;
      poly(c,[[-34-k*6,-28],[-24,-38-k*6],[19,-38-k*6],[27+k*6,-28],[27+k*6,27],[16,36+k*6],[-24,36+k*6],[-34-k*6,27]],null,"#a8ecda",2);
    }
    c.restore();
  }
  function consoleArt(c,obj,kind,active,t) {
    const {x,y}=obj,col=active?"#a4efda":"#e0bb7b";
    c.save();c.translate(x,y);
    oval(c,4,5,16,7,"rgba(5,12,18,.48)");
    poly(c,[[-12,7],[-12,-6],[-7,-12],[8,-12],[14,-7],[14,6],[8,10],[-8,10]],"#223138","#728785",2);
    rect(c,-8,-13,16,8,"#38484a");rect(c,-6,-12,12,4,col);
    rect(c,-8,1,17,5,"#15282a");rect(c,-5,2,3,2,"#82948c");rect(c,3,2,4,2,"#82948c");
    const dy=-24+Math.sin(t*3)*1.5;
    if(kind==="cache"){
      poly(c,[[0,dy-6],[6,dy],[0,dy+6],[-6,dy]],"#283a39",col,1.8);rect(c,-2,dy-1,4,2,col);
    }else{
      line(c,[[-5,dy+1],[0,dy-4],[5,dy+1]],col,2);rect(c,-1,dy,2,5,col);
    }
    c.restore();
  }
  function drawObjects(c,g) {
    const m=g.map;if(!m)return;
    const t=g.time||m.age;c.save();c.lineJoin="bevel";
    if(m.lab)Labyrinth.drawObjects(c,g);
    if(m.posts)for(const post of m.posts){
      const live=m.pulse.post===post && !m.complete && !post.disabled;
      const col=post.disabled||m.complete?"#80b1a6":live?m.pulse.color:"#aa8267";
      const {x,y}=post;
      poly(c,[[x-10,y-4],[x-5,y-8],[x+6,y-8],[x+11,y-3],[x+10,y+4],[x+4,y+8],[x-6,y+8],[x-11,y+3]],"#27343a",m.pal[6],1.5);
      rect(c,x-7,y+4,14,2,m.pal[5]);oval(c,x,y-1,5.4,4.2,m.pal[5],col,1.5);rect(c,x-1.5,y-3,3,3,col);
      if(live){
        const fraction=1-Math.min(1,m.pulse.tell/1.08),r=14+fraction*6;
        oval(c,x,y,r,r*.75,null,col,1.4);
        for(const a of m.pulse.angles){
          const u=Math.cos(a),v=Math.sin(a);
          line(c,[[x+u*10,y+v*10],[x+u*(19+fraction*13),y+v*(19+fraction*13)]],col,1.5);
        }
      }
    }
    if(m.shutter){
      const {slab:b,open}=m.shutter,col=open?"#a8d6bf":"#c9a474";
      for(const x of [b.x+1,b.x+b.w-3]){
        rect(c,x,b.y-5,4,5,col);rect(c,x,b.y+b.h,4,5,col);
      }
      if(open){
        for(let j=0;j<6;j++)rect(c,b.x+5+j*16,b.y+4,3,b.h-8,"rgba(164,181,172,.22)");
      }
    }
    if(m.rootValve&&!m.rootValve.open){
      const v=m.rootValve;line(c,[[v.target.x,v.target.y],[v.root.x+8,v.root.y+v.root.h*.5]],"#839476",2);
    }
    gate(c,m.gate.x,m.gate.y,m,t);
    if(m.complete){
      label(c,"GATE",m.gate.x-14,m.gate.y+52,11,"#cdf3df");
      const k=Math.floor(t*3)%4;
      for(let i=0;i<4;i++) {
        const x=m.gate.x-46-i*12,y=m.gate.y;
        line(c,[[x-4,y-4],[x,y],[x-4,y+4]],k===3-i?"#ade7d3":"#516d69",2);
      }
    }
    const s=m.side;
    if(s&&s.state!=="claimed"){
      consoleArt(c,s,"cache",s.state==="ready",t);
      label(c,s.state==="ready"?"CACHE ONLINE":"SIDE CACHE",s.x-27,s.y+24,9,s.state==="ready"?"#b8efdb":"#d2bc91");
    }
    if(m.task==="Breach"||m.task==="Stabilize"||m.task==="Transmit"){
      for(const n of m.nodes){
        if(n.done){oval(c,n.x,n.y,9,4,m.pal[5],m.pal[6]);rect(c,n.x-3,n.y-2,6,2,"#a3c4a5");continue;}
        if(m.task==="Transmit"){
          c.setLineDash([8,10]);oval(c,n.x,n.y,88,88,"rgba(127,211,183,.045)","#6d9e95",1.6);c.setLineDash([]);
        }
        consoleArt(c,n,"relay",true,t);
      }
    }
    if(m.command?.hp>0&&!m.command.dead){
      const e=m.command;poly(c,[[e.x,e.y-e.r-7],[e.x-4,e.y-e.r-13],[e.x+4,e.y-e.r-13]],"#ffdf80");
    }
    for(const a of m.arrivals){
      if(a.remaining>1)continue;
      const edge=Math.max(0,a.remaining),rad=(a.opts.boss?27:13)+edge*15;
      oval(c,a.x,a.y,rad,rad*.57,"rgba(233,154,87,.065)",a.opts.boss?"#ec9976":"#ccab82",1.65);
      for(let n=0;n<4;n++){const phi=n*Math.PI*.5+t*1.4,dx=Math.cos(phi),dy=Math.sin(phi)*.57;
        line(c,[[a.x+dx*(rad-3),a.y+dy*(rad-3)],[a.x+dx*(rad+3),a.y+dy*(rad+3)]],"#f9d89b",2);
      }
    }
    if(m.strip){
      const warn=m.strip.age<1.45,y=m.strip.y,warnRatio=m.strip.age/1.45;
      const {left,right}=m.strip;
      rect(c,left,y-13,right-left,26,warn?"rgba(203,79,66,.18)":"rgba(255,106,77,.58)");
      c.setLineDash(warn?[9,6]:[]);line(c,[[left,y-13],[right,y-13]],warn?"#ef956f":"#ffdec3",2);line(c,[[left,y+13],[right,y+13]],warn?"#ef956f":"#ffdec3",2);c.setLineDash([]);
      if(warn){for(let x=left+18;x<right;x+=52)line(c,[[x-4,y+4],[x,y-3],[x+4,y+4]],"#dc9c7d",1.5);}
      if(warnRatio>1)rect(c,left,y-2,right-left,4,"#ffc8a3");
    }
    c.restore();
  }
  window.World={maps,build,blocked,draw,drawObjects,update,interact,labCheckpoint,restoreLab,permitsRecall};
})();
