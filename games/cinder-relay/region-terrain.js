/* Architectural finishes for the Prism Archive and Brinepump Warrens.
   All terrain art is painted into the existing room or labyrinth bake. */
(() => {
  'use strict';
  const tau=Math.PI*2;
  const prism={
    base:'#16212e',floor:['#2d3c4f','#303f54','#2a394c'],joint:'#202f43',rim:'#718aa2',
    wall:'#3c4c63',trim:'#b475ad',lamp:'#b5efe9',shade:'#101c2a',material:'prism'
  };
  const brine={
    base:'#172c2c',floor:['#334743','#364a44','#304340'],joint:'#203636',rim:'#648075',
    wall:'#3e5149',trim:'#b88757',lamp:'#e7be85',shade:'#122528',material:'brine'
  };
  const prismBand=['#587587','#627c9a','#877799','#ae7fa0','#8aadaf'];
  const channelColors=['#274a46','#2b5550','#305c55','#244843'];

  function rect(c,x,y,w,h,color) {
    c.fillStyle=color;
    c.fillRect(x,y,w,h);
  }
  function path(c,points,closed=false) {
    c.beginPath();
    c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)c.lineTo(...points[i]);
    if(closed)c.closePath();
  }
  function line(c,points,color,width=2) {
    c.strokeStyle=color;
    c.lineWidth=width;
    path(c,points);
    c.stroke();
  }
  function poly(c,points,color) {
    path(c,points,true);
    c.fillStyle=color;
    c.fill();
  }
  function ellipse(c,x,y,rx,ry,col,width=0) {
    c.beginPath();
    c.ellipse(x,y,rx,ry,0,0,tau);
    if(width){c.strokeStyle=col;c.lineWidth=width;c.stroke();}
    else {c.fillStyle=col;c.fill();}
  }
  function chamfer(x,y,w,h,inset) {
    return [[x+inset,y],[x+w-inset,y],[x+w,y+inset],[x+w,y+h-inset],[x+w-inset,y+h],[x+inset,y+h],[x,y+h-inset],[x,y+inset]];
  }
  function prismFace(c,x,y,w,h,variant) {
    const tip=[x+w*.57,y],root=[x+w*.42,y+h];
    const shoulder=[x+w*.14,y+h*.37],right=[x+w*.92,y+h*.29],foot=[x+w,y+h*.83],left=[x,y+h*.86];
    const spine=[x+w*.55,y+h*.72];
    poly(c,[tip,right,foot,root,left,shoulder],'#617e9a');
    poly(c,[tip,shoulder,left,root,spine],'#50778d');
    poly(c,[tip,right,spine],'#8db7c4');
    poly(c,[tip,spine,shoulder],variant?'#8c779d':'#669fab');
    poly(c,[right,foot,root,spine],variant?'#645373':'#455e7c');
    line(c,[shoulder,tip,right],'#c1dcde',2);
    line(c,[tip,spine,root],variant?'#d3a0c9':'#acdbd7',2);
    line(c,[left,root,foot],'#3d526f',2);
  }
  function archiveModule(c,x,y,w,h,variant) {
    const inset=Math.max(5,Math.min(w,h)*.16);
    poly(c,chamfer(x+3,y+6,w,h,inset),'#121b2a');
    poly(c,chamfer(x,y,w,h,inset),'#51667e');
    poly(c,chamfer(x+4,y+4,w-8,h-8,6),'#2b3d53');
    line(c,[[x+inset,y+1],[x+w-inset,y+1],[x+w-2,y+inset]],'#8eb1be',2);
    line(c,[[x+2,y+h-inset],[x+inset,y+h-2],[x+w-inset,y+h-2]],'#213044',3);
    rect(c,x+7,y+9,w-14,7,'#1b2b41');
    for(let i=0;i<5;i++)rect(c,x+10+i*(w-18)/5,y+11,Math.max(1,(w-29)/6),2,prismBand[(i+variant)%5]);
    const coreW=Math.min(w*.42,h*.6),coreH=(h-19)*.88;
    if(coreW>6&&coreH>6)prismFace(c,x+(w-coreW)/2,y+17,coreW,coreH,variant%2);
    for(const aa of [x+6,x+w-9])rect(c,aa,y+h-10,3,3,'#a9bbc1');
  }
  function lens(c,x,y,r,strength=1) {
    const hue=strength===1?'#546f87':'#637084';
    const diamond=k=>[[x-r*k,y],[x,y-r*k],[x+r*k,y],[x,y+r*k],[x-r*k,y]];
    poly(c,diamond(1),'#283b51');
    line(c,diamond(1),hue,3);
    line(c,diamond(.86),'#425a71',2);
    poly(c,diamond(.55),'#304a61');
    line(c,diamond(.55),'#628995',2);
    line(c,[[x-r*.55,y],[x,y-r*.55],[x+r*.55,y]],'#7899a9',2);
    line(c,[[x-r*.3,y-r*.07],[x,y-r*.33],[x+r*.29,y-r*.05]],'#7d668a',2);
    rect(c,x-5,y-5,10,10,'#40707b');
    rect(c,x-2,y-2,4,4,'#8eb6bb');
    for(const [xx,yy] of [[x-r*.92,y],[x+r*.92,y],[x,y-r*.92],[x,y+r*.92]])rect(c,xx-2,yy-2,4,4,'#8f7a95');
  }
  function trace(c,points,bright) {
    line(c,points,'#1f2d43',8);
    line(c,points,'#466178',5);
    line(c,points,bright?'#76959f':'#675e81',2);
  }
  function pipe(c,points,width,wet=true) {
    line(c,points,'#152d2d',width+5);
    line(c,points,wet?'#46645a':'#6e5547',width);
    line(c,points,wet?'#708878':'#ac8060',Math.max(2,width*.32));
  }
  function wheel(c,x,y,r,clock=0) {
    ellipse(c,x,y,r+3,r+3,'#192f2e');
    ellipse(c,x,y,r,r,'#49625b');
    ellipse(c,x,y,r*.73,r*.73,'#263e3d');
    for(let i=0;i<6;i++){
      const a=(i+clock)*tau/6,xx=Math.cos(a),yy=Math.sin(a);
      line(c,[[x+xx*r*.19,y+yy*r*.19],[x+xx*r*.76,y+yy*r*.76]],i%2?'#7b6854':'#697e6a',r*.13);
      rect(c,x+xx*r*.9-1.5,y+yy*r*.9-1.5,3,3,'#907753');
    }
    ellipse(c,x,y,r*.28,r*.28,'#948268');
    ellipse(c,x-1,y-1,r*.12,r*.12,'#bac1a4');
  }
  function waterBay(c,x,y,w,h,seed) {
    rect(c,x,y,w,h,'#203636');
    rect(c,x+3,y+3,w-6,h-6,'#2b514b');
    for(let k=0;k<Math.min(48,Math.max(8,(w+h)/4));k++){
      const xx=x+6+(k*47+seed*17)%Math.max(1,w-22),yy=y+6+(k*31+seed*11)%Math.max(1,h-13);
      const len=Math.min(w-7-(xx-x),5+(k*13)%24);
      rect(c,xx,yy,len,2,channelColors[(k+seed)%4]);
    }
    line(c,[[x,y+h],[x,y],[x+w,y],[x+w,y+h]],'#61786b',2);
    rect(c,x+3,y+h-6,w-6,4,'#223933');
    for(let k=11;k<w-8;k+=20)rect(c,x+k,y+h-5,5,3,'#79684f');
  }
  function pump(c,x,y,w,h,variant) {
    const cap=Math.max(4,Math.min(w,h)*.12);
    poly(c,chamfer(x+3,y+5,w,h,cap),'#162b2a');
    poly(c,chamfer(x,y,w,h,cap),'#617462');
    poly(c,chamfer(x+3,y+3,w-6,h-6,cap*.55),'#354f48');
    rect(c,x+7,y+6,w-14,5,'#263c38');
    rect(c,x+9,y+7,Math.min(w*.24,18),2,'#c79961');
    rect(c,x+w-13,y+7,5,2,'#87a290');
    const radius=Math.min(h*.29,w*.25);
    wheel(c,x+w*.50,y+h*.56,radius,variant*.16);
    for(const ox of [.21,.79]){
      const xx=x+w*ox;
      rect(c,xx-2,y+h-10,4,10,'#223733');
      rect(c,xx-4,y+h-13,8,6,'#79664f');
    }
    rect(c,x+5,y+h-3,w-10,3,'#263c39');
  }

  function labStyle(route) {
    if(route===11)return {theme:prism,layout:4};
    if(route===12)return {theme:brine,layout:5};
    return null;
  }
  function labFloor(c,lab,x,y,n) {
    if(lab.theme.material==='prism'){
      if(n%4<2){
        poly(c,[[x+3,y+3],[x+30,y+3],[x+30,y+22]],n%2?'#3a4a61':'#3d5065');
        line(c,[[x+15,y+5],[x+27,y+13],[x+27,y+25]],'#526781',1.5);
      }
      if(n%9===1){
        rect(c,x+4,y+25,14,2,'#567385');
        rect(c,x+4,y+25,4,2,'#8f799a');
        rect(c,x+23,y+10,2,2,'#809fa5');
      }
    }else if(lab.theme.material==='brine'){
      if(n%5<2){
        rect(c,x+3,y+3,27,26,'#304b41');
        for(let k=0;k<4;k++)rect(c,x+4+((n>>>k)%8),y+5+k*5,6+(n>>>(k+11))%12,2,channelColors[(n+k)%4]);
      }
      if(n%9===2){
        rect(c,x+6,y+8,21,13,'#243b36');
        for(let k=0;k<5;k++)rect(c,x+8+k*4,y+10,1.5,9,'#57736a');
        rect(c,x+7,y+8,19,1,'#8a7655');
      }
    }
  }
  function labWall(c,lab,x,y,n,near) {
    if(lab.theme.material==='prism'){
      if(n%2)poly(c,[[x+6,y+5],[x+22,y+5],[x+24,y+12],[x+12,y+17]],'#62738d');
      for(let k=0;k<3;k++)rect(c,x+7+6*k,y+10+(n%3),2,5,prismBand[(n+k)%5]);
      if(near[2])rect(c,x+8,y+20,14,2,n%5?'#8bb3b7':'#ca9dbf');
    }else if(lab.theme.material==='brine'){
      if(near[2]||near[0]){
        pipe(c,[[x+2,y+13],[x+12,y+13],[x+17,y+10],[x+29,y+10]],5,n%4!==0);
        rect(c,x+10,y+10,4,7,'#92775c');
      }
      if(n%3===1)rect(c,x+20,y+18,5,4,'#b58964');
    }
  }
  function labFixture(c,lab,x,y,index) {
    if(lab.theme.material==='prism'){
      archiveModule(c,x-23,y-13,46,26,index);
      return true;
    }
    if(lab.theme.material==='brine'){
      pipe(c,[[x-29,y],[x-9,y],[x-7,y+6],[x+22,y+6]],8,index%3!==0);
      pump(c,x-16,y-14,34,27,index);
      return true;
    }
    return false;
  }
  function labPiers(c,lab) {
    const material=lab.theme.material;
    if(material!=='prism'&&material!=='brine')return false;
    for(const [cx,cy,cols,rows] of lab.piers){
      const x=cx*lab.tile+4,y=cy*lab.tile+4,w=cols*lab.tile-8,h=rows*lab.tile-8;
      if(material==='prism')archiveModule(c,x,y,w,h,cx+cy);
      else pump(c,x,y,w,h,cx+cy);
    }
    return true;
  }
  function labRoom(c,lab,r,index) {
    const material=lab.theme.material;
    if(material!=='prism'&&material!=='brine')return false;
    const w=r.w,h=r.h,x=w/2,y=h/2,p=lab.theme;
    c.save();
    c.translate(r.x,r.y);
    if(material==='prism'){
      const r0=Math.min(h*.29,w*.24);
      line(c,chamfer(16,16,w-32,h-32,14).concat([[30,16]]),'#526b81',2);
      for(const sign of [-1,1]){
        const yy=y+sign*Math.min(66,h*.24);
        trace(c,[[22,yy],[x-r0-16,yy],[x-r0,yy-sign*16],[x+r0,yy-sign*16],[x+r0+16,yy],[w-22,yy]],sign===-1);
        for(const xx of [33,w-33])rect(c,xx-3,yy-4,6,8,'#987e9c');
      }
      if(r.id==='key'||r.id==='gallery'){
        const n=r.id==='key'?3:5;
        for(let i=0;i<n;i++){
          const xx=28+(w-56)*(i+.5)/n;
          lens(c,xx,y,Math.min(50,(w-56)/n*.35),i%2);
        }
      }else {
        lens(c,x,y,r0,index%2);
        for(const xx of [w*.21,w*.79])lens(c,xx,y,Math.min(30,r0*.4),0);
      }
    }else{
      const channelHeight=Math.min(33,h*.11),channelWidth=w-58;
      for(const sign of [-1,1]){
        const yy=y+sign*h*.25-channelHeight/2;
        waterBay(c,29,yy,channelWidth,channelHeight,index+(sign+1));
        for(const xx of [w*.28,w*.68]){
          rect(c,xx-10,yy-2,20,channelHeight+4,'#52695a');
          for(let k=0;k<4;k++)rect(c,xx-9+k*5,yy+1,2,channelHeight-1,'#344d44');
        }
      }
      const r0=Math.min(w*.17,h*.16);
      if(r.id==='hall'||r.id==='loop'||r.id==='exit'){
        for(const sign of [-1,1]){
          const xx=x+sign*w*.2;
          pipe(c,[[xx,y-14],[xx,y],[x,y],[x,y+16]],7,sign<0);
          wheel(c,xx,y,r0,index);
        }
      }else{
        pipe(c,[[37,y+6],[x-52,y+6],[x-26,y],[x+30,y],[x+48,y+6],[w-37,y+6]],8,index%2===0);
        wheel(c,x,y,r0,index);
      }
    }
    c.font='bold 14px monospace';
    c.textBaseline='middle';
    const label=r.name.toUpperCase(),sw=Math.min(w-58,c.measureText(label).width+18);
    rect(c,26,h-41,sw,20,p.joint);
    rect(c,26,h-41,4,20,p.trim);
    c.fillStyle=material==='prism'?'#a3bbc6':'#b5b8a1';
    c.fillText(label,35,h-30,sw-12);
    c.restore();
    return true;
  }

  function arenaBackdrop(c,map) {
    const style=map.def.type;
    if(style!=='prism'&&style!=='brine')return false;
    if(style==='prism'){
      const glass=c.createLinearGradient(0,0,0,540);
      glass.addColorStop(0,'#293750');
      glass.addColorStop(.45,'#192a40');
      glass.addColorStop(1,'#0d1725');
      rect(c,0,0,960,540,glass);
      for(let i=0;i<12;i++){
        const x=i*92-40,y=40+(i*23)%55;
        poly(c,[[x,y],[x+49,y-41],[x+78,y-26],[x+60,y+490],[x+8,y+505]],'#213146');
        line(c,[[x+10,y],[x+49,y-29],[x+69,y-18],[x+51,y+455]],i%3?'#48627b':'#615975',3);
        line(c,[[x+52,y-27],[x+35,y+453]],'#2d435a',2);
        if(i%2===0)prismFace(c,x+15,y+405,37,57,i%3);
      }
      for(const y of [33,487,513,532]){
        line(c,[[0,y],[190,y],[219,y-7],[712,y-7],[744,y],[960,y]],'#303f56',8);
        line(c,[[0,y],[190,y],[219,y-7],[712,y-7],[744,y],[960,y]],y%2?'#697c8f':'#665e7b',2);
      }
    }else if(style==='brine'){
      const water=c.createLinearGradient(0,0,0,540);
      water.addColorStop(0,'#2e4d46');
      water.addColorStop(.58,'#1b3e3d');
      water.addColorStop(1,'#142e32');
      rect(c,0,0,960,540,water);
      for(let i=0;i<180;i++){
        const x=(i*127+map.room*29)%960,y=(i*83+map.room*41)%540;
        rect(c,x,y,4+(i*13)%66,2,i%6?'#305450':'#446b5d');
      }
      for(let i=0;i<8;i++){
        const x=i*137-40,y=i%2?477:25;
        pipe(c,[[x-31,y],[x+34,y],[x+60,y+16],[x+135,y+16]],i%2?23:15,i%3!==0);
        pump(c,x,y-13,43,38,i);
      }
    }
    return true;
  }
  function arenaFloor(c,map) {
    const style=map.def.type;
    if(style!=='prism'&&style!=='brine')return;
    c.save();
    path(c,map.outline,true);
    c.clip();
    if(style==='prism'){
      for(const sign of [-1,1]){
        const y=270+sign*128;
        trace(c,[[70,y+sign*25],[176,y+sign*25],[225,y],[735,y],[784,y+sign*25],[885,y+sign*25]],sign<0);
        for(let i=0;i<8;i++){
          const x=239+i*68;
          poly(c,[[x,y+sign*7],[x+19,y+sign*7],[x+25,y+sign*13],[x+6,y+sign*13]],prismBand[i%5]+'aa');
        }
      }
      lens(c,480,270,77,map.room%2);
      for(const x of [219,741])lens(c,x,270,38,1);
    }else{
      for(const sign of [-1,1]){
        const y=270+sign*132;
        waterBay(c,104,y-10,749,23,map.room+sign+1);
        for(const x of [238,462,686]){
          rect(c,x,y-14,35,30,'#597368');
          for(let k=0;k<6;k++)rect(c,x+2+k*5,y-10,2,23,'#384d43');
          rect(c,x+1,y-14,32,2,'#9b7d59');
        }
      }
      for(const x of [230,730]){
        pipe(c,[[x-81,278],[x-30,278],[x,270],[x+30,278],[x+81,278]],8,map.room%2===0);
        wheel(c,x,270,35,map.room*.22);
      }
    }
    c.restore();
  }
  function arenaBlocker(c,b,map) {
    const {x,y,w,h,type}=b;
    if(type==='prism-stack'){
      archiveModule(c,x,y,w,h,map.room);
      return true;
    }
    if(type==='brine-pool'||type==='brine-pump'){
      if(type==='brine-pool'){
        c.save();
        if(b.verts){path(c,b.verts,true);c.clip();}
        waterBay(c,x,y,w,h,map.room);
        c.restore();
      }else pump(c,x,y,w,h,map.room);
      return true;
    }
    return false;
  }

  function arenaVista(c,type,w,h) {
    if(type!=='prism'&&type!=='brine')return false;
    c.save();
    c.scale(w/400,h/98);
    if(type==='prism'){
      const glass=c.createLinearGradient(0,0,0,98);
      glass.addColorStop(0,'#24364b');glass.addColorStop(1,'#121d2e');
      rect(c,0,0,400,98,glass);
      for(let i=0;i<9;i++){
        const x=i*53-36;
        poly(c,[[x,4],[x+48,-3],[x+38,68],[x-1,90]],i%3?'#253c50':'#3f3855');
        line(c,[[x+42,1],[x+34,65],[x+2,86]],i%2?'#4f6c7c':'#655e78',2);
      }
      for(let i=0;i<5;i++){
        const x=24+i*76,y=18+((i+1)%3)*6;
        poly(c,[[x-7,77],[x+62,77],[x+44,94],[x-15,94]],'#293e52');
        archiveModule(c,x,y+8,58,52,i);
      }
      line(c,[[0,88],[93,88],[109,92],[287,92],[304,88],[400,88]],'#628391',2);
    }else{
      rect(c,0,0,400,98,'#1d3938');
      waterBay(c,0,1,400,96,2);
      for(let i=0;i<5;i++){
        const x=16+i*76,y=24+(i%2)*8;
        pipe(c,[[x-15,y+34],[x+6,y+34],[x+15,y+24],[x+56,y+24],[x+72,y+34]],12,i%2!==0);
        pump(c,x,y,54,47,i);
      }
      rect(c,0,84,400,5,'#33483e');
      for(let x=-3;x<400;x+=16)line(c,[[x,88],[x+9,85]],'#957a56',2);
    }
    c.restore();
    return true;
  }
  window.RegionTerrain={labStyle,labFloor,labRoom,labWall,labFixture,labPiers,arenaBackdrop,arenaFloor,arenaBlocker,arenaVista};
})();
