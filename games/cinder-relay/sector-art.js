/* Hand-pixelled structures below the arena. Drawn once when a room's floor is baked. */
(() => {
  "use strict";
  // Work on the floor texture's native pixel grid so that cables, panes and seams
  // stay sharp at the same zoom as the sprites.
  function tools(ctx) {
    let ink;
    function rect(x,y,w,h,color) {
      if(color!==ink){ctx.fillStyle=color;ink=color;}
      ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
    }
    function line(x,y,u,v,color,weight=1) {
      x=Math.round(x);y=Math.round(y);u=Math.round(u);v=Math.round(v);
      const dx=Math.abs(u-x),dy=-Math.abs(v-y),sx=x<u?1:-1,sy=y<v?1:-1;
      let err=dx+dy;
      for(;;){
        rect(x,y,weight,weight,color);
        if(x===u&&y===v)break;
        const twice=err*2;
        if(twice>=dy){err+=dy;x+=sx;}
        if(twice<=dx){err+=dx;y+=sy;}
      }
    }
    function polygon(points,color) {
      const ys=points.map(p=>p[1]);
      for(let y=Math.floor(Math.min(...ys));y<Math.ceil(Math.max(...ys));y++){
        const row=y+.5,hits=[];
        for(let a=points.length-1,b=0;b<points.length;a=b++){
          const [ax,ay]=points[a],[bx,by]=points[b];
          if((ay>row)!==(by>row))hits.push(ax+(row-ay)*(bx-ax)/(by-ay));
        }
        hits.sort((a,b)=>a-b);
        for(let i=0;i+1<hits.length;i+=2){
          const x=Math.ceil(hits[i]-.5),w=Math.ceil(hits[i+1]-.5)-x;
          if(w>0)rect(x,y,w,1,color);
        }
      }
    }
    function oval(x,y,rx,ry,color) {
      for(let j=-ry;j<=ry;j++){
        const n=Math.round(rx*Math.sqrt(Math.max(0,1-(j/ry)**2)));
        rect(x-n,y+j,2*n+1,1,color);
      }
    }
    function path(points,color,weight=1) {
      for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],color,weight);
    }
    function at(x,y,fn) {
      ctx.save();ctx.translate(x,y);fn();ctx.restore();ink=null;
    }
    return {rect,line,polygon,oval,path,at};
  }

  function water(d,room,deep,glint) {
    for(let i=0;i<66;i++){
      const x=(i*151+room*9)%480,y=226+(i*17)%45,w=4+(i*7)%19;
      d.rect(x,y,w,1,i%4?deep:glint);
      if(i%5===1)d.rect(x+4,y+2,w>>1,1,deep);
    }
  }
  function pipe(d,pts,edge,body,highlight,w=5) {
    d.path(pts,edge,w);
    d.path(pts.map(([x,y])=>[x+1,y]),body,w-2);
    d.path(pts.map(([x,y])=>[x+1,y]),highlight);
  }

  // A moored salvage barge: bridge windows, cargo ribs and its reflected running lights.
  function causeway(d,room){
    const {rect:r,line:l,polygon:p,path,at}=d;
    water(d,room,"#173740","#2d4b4e");
    at(0,257,()=>{
      p([[-4,-7],[7,-8],[17,-6],[64,-3],[88,-5],[95,-6],[86,2],[58,7],[24,10],[6,8]],"#0e232a");
      p([[-4,-9],[15,-9],[29,-7],[72,-6],[94,-8],[84,0],[57,4],[18,7],[4,5]],"#57504b");
      p([[1,-7],[28,-5],[75,-5],[92,-8],[83,-2],[49,2],[15,3]],"#37444a");
      path([[0,-9],[17,-9],[32,-7],[75,-7],[93,-9]],"#87918a");
      l(8,4,51,2,"#81594b");l(53,2,80,-2,"#795749");
      p([[7,-10],[7,-20],[11,-22],[29,-20],[32,-14],[31,-8]],"#3e5559");
      r(8,-24,21,3,"#2a4147");r(10,-23,19,1,"#a4aaa0");
      r(10,-20,17,3,"#152d39");r(11,-19,4,2,"#a4aa8c");r(17,-19,3,1,"#697f7b");r(23,-19,3,2,"#91a498");
      r(12,-14,4,5,"#253a43");r(24,-12,3,2,"#bfa076");
      r(13,-30,2,7,"#3c494a");l(15,-28,20,-28,"#9a9e92");
      for(let i=0;i<3;i++){const x=35+i*13,y=-13-(room+i)%3;
        r(x,y,12,8,i%2?"#6a6652":"#7a5e4b");r(x,y,12,1,"#9c8f75");
        for(let j=2;j<=9;j+=3)r(x+j,y+2,1,5,"#494b45");
      }
      for(let i=0;i<6;i++)r(12+i*12,11+i%3,8-i,1,i%2?"#45524d":"#34464a");
    });
    // The mooring chain descends around the corner to the dock wall.
    path([[452,228],[455,238],[460,246],[466,249],[475,249]],"#152b32",2);
    for(let i=0;i<5;i++)r(453+i*3,234+i*3,2,1,"#637476");
    at(464,251,()=>{p([[-7,5],[-3,1],[8,0],[13,3],[10,7],[-3,8]],"#273d40");r(-2,-5,10,10,"#344a4b");r(-4,-7,13,4,"#72807c");r(-3,-7,9,1,"#a49e87");});
  }

  // Mangrove buttresses, vascular channels, and an amber cyst growing in a recess.
  function orchard(d,room){
    const {rect:r,polygon:p,oval:o,path,at}=d;
    water(d,room,"#20473f","#34594c");
    for(let j=0;j<2;j++)at(j?404:0,j?257:247,()=>{
      p([[-11,26],[-10,-15],[3,-23],[17,-18],[29,-9],[47,-2],[61,4],[88,11],[95,16],[66,13],[48,11],[29,6],[44,22],[50,29]],"#182f30");
      for(let k=0;k<6;k++){
        let x=-11+k*5,y=-15+k%2;
        path([[x,y],[x+8,y+4],[x+17,y+13],[x+28,y+17],[x+43,y+20],[x+52,y+25]],k%2?"#31483b":"#586251",k%3+1);
      }
      for(let k=0;k<8;k++){
        const x=5+k*7,y=-10+k*2;
        p([[x,y],[x-6,y-9],[x-4,y-15],[x+3,y-11],[x+5,y-3]],"#3a5847");
        path([[x-4,y-13],[x-3,y-8],[x+2,y-1]],"#6e7960");
      }
      o(17,1,10,9,"#273e35");o(17,0,7,7,"#71704b");o(17,0,5,6,"#ab8e5e");
      o(16,-1,3,4,"#c4a36b");r(14,-4,2,3,"#dac793");path([[18,-7],[20,-3],[20,2],[17,7]],"#796744");
      path([[23,1],[29,3],[37,2],[43,5]],"#6c754d");r(32,1,2,1,"#a69b66");
    });
  }

  function furnace(d,room){
    const {rect:r,line:l,polygon:p,oval:o,path,at}=d;
    // A recessed tapping channel runs beneath the front of the casting floor.
    path([[0,255],[65,255],[89,264],[191,264],[212,257],[365,257],[414,248],[480,248]],"#211e25",10);
    path([[0,257],[65,257],[89,266],[191,266],[212,259],[365,259],[414,250],[480,250]],"#8c4a3c",4);
    path([[0,258],[65,258],[89,267],[191,267],[212,260],[365,260],[414,251],[480,251]],"#c37c59",1);
    at(5,248,()=>{
      p([[-12,-29],[11,-30],[15,-25],[13,-17],[26,-16],[35,-12],[28,-7],[5,-6],[-10,-15]],"#403a3b");
      path([[-10,-29],[10,-30],[14,-26],[12,-17],[25,-16],[34,-12]],"#a19382",2);
      o(4,-18,7,7,"#22292d");o(4,-18,4,4,"#756b61");o(4,-19,2,2,"#a1967f");
      path([[18,-14],[27,-13],[32,-11],[28,-7],[26,-1],[26,6],[29,10]],"#ae6340",4);
      path([[20,-14],[28,-12],[31,-11],[27,-5],[27,2],[28,7]],"#dfa15d",2);
      r(24,9,13,2,"#e9b275");
    });
    for(let i=0;i<7;i++){const x=87+i*39+(room%2)*8;l(x,257,x+6,266,"#24282b",3);l(x,257,x+6,266,"#756456");}
  }

  function choir(d,room){
    const {line:l,polygon:p,path,at}=d;
    const facets=[[-18,256,48,32],[12,255,36,22],[38,264,19,17],[382,266,24,12],[417,259,31,24],[463,254,43,45]];
    for(const [x,y,w,h] of facets)at(x,y,()=>{
      const tip=h%2?5:Math.floor(w*.39),ridge=w*.48;
      p([[0,0],[w*.15,-h*.52],[tip,-h],[w*.76,-h*.69],[w,-h*.17],[w*.83,4],[w*.28,6]],"#3e3653");
      p([[0,0],[w*.15,-h*.52],[tip,-h],[ridge,-h*.18],[w*.28,6]],"#665875");
      p([[tip,-h],[w*.76,-h*.69],[w,-h*.17],[ridge,-h*.18]],"#544b68");
      path([[0,0],[w*.15,-h*.52],[tip,-h],[w*.76,-h*.69]],"#8f7f97");
      l(tip,-h,ridge,-h*.18,"#a294a8");
    });
    // Stepped crystal guides feed a precisely machined resonator base.
    const x=118+room*15;
    path([[65,264],[x,264],[x+8,258],[x+43,258],[x+53,264],[342,264]],"#423a53",3);
    path([[65,264],[x,264],[x+8,258],[x+43,258],[x+53,264],[342,264]],"#786a85");
    for(let i=0;i<3;i++)at(x+13+i*11,259,()=>{
      p([[-3,0],[-3,-7],[0,-13],[3,-7],[3,0]],"#635b72");l(0,-12,1,-2,"#a697a4");
    });
  }

  function meridian(d,room){
    const {line:l,polygon:p,path,rect:r}=d;
    // Floated segments of a fractured orbital mirror descend towards the planet.
    for(let i=-1;i<13;i++){
      const x=i*42-8,y=252+(i<5?i:10-i)*2,miss=i===4||i===7+(room%2);
      if(miss)continue;
      const shear=(i%3)*2;
      p([[x,y],[x+28,y+2],[x+41,y+10],[x+39,y+15],[x+6,y+13],[x-5,y+5]],"#263747");
      p([[x,y],[x+27,y+2],[x+38,y+8],[x+7,y+7]],"#817d6d");
      p([[x+2,y+1],[x+24,y+3],[x+33,y+7],[x+8,y+5]],"#566979");
      path([[x,y],[x+27,y+2],[x+38,y+8]],"#b1ad95");l(x+8,y+9,x+33,y+11,"#475463",2);
      r(x+12+shear,y+9,3,1,"#a99c79");
    }
    for(let i=0;i<5;i++){let x=183+i*5+room,y=256+(i*5)%13;
      p([[x,y],[x+3,y+1],[x+6,y+4],[x+2,y+3]],i%2?"#83887e":"#566a76");}
  }

  function glassTide(d,room){
    const {rect:r,line:l,polygon:p,path,at}=d;
    for(const x of [7,85,372,451]){
      p([[x,204],[x+4,205],[x-12,268],[x-22,270]],"#214850");
      p([[x+8,211],[x+9,211],[x-2,260],[x-5,263]],"#31565a");
    }
    water(d,room,"#1e424a","#365c5b");
    // Long-finned rays swim behind the terminal observation glass.
    for(const [x,y,s] of [[15,249,1],[452,246,.8],[53,257,.55]])at(x+room*2,y,()=>{
      const pt=(a,b)=>[a*s,b*s];
      p([pt(-15,2),pt(-8,-1),pt(-5,-5),pt(-1,-13),pt(4,-4),pt(9,-2),pt(16,-4),pt(12,1),pt(7,6),pt(1,6),pt(-6,4)],"#355b61");
      path([pt(-14,2),pt(-7,0),pt(-1,-12),pt(3,-4),pt(8,-2)],"#608482");
      path([pt(7,4),pt(16,8),pt(29,7),pt(36,9)],"#577776");
      p([pt(-5,2),pt(0,1),pt(8,-2),pt(2,3)],"#84988b");
    });
    // Each diagonal mullion has separate outside and reflected interior edges.
    for(const x of [14,122,342,450]){
      p([[x,270],[x+5,270],[x+23,206],[x+18,206]],"#172e39");
      l(x+4,269,x+22,207,"#5c7473");l(x+6,269,x+24,207,"#345155");
    }
    path([[0,262],[102,263],[154,267],[298,267],[379,261],[480,260]],"#1d343b",6);
    r(2,262,84,1,"#5d7674");
  }

  function sporeLab(d,room){
    const {line:l,polygon:p,oval:o,path,at}=d;
    // Glass seed bells hang underneath floating plots, roots visible through the glass.
    for(const [x,y,w,h] of [[17,246,17,25],[51,255,11,15],[395,261,10,16],[445,248,18,27],[471,259,12,17]])at(x,y,()=>{
      p([[-w,0],[-w+1,-h*.55],[-w*.65,-h*.88],[-3,-h],[4,-h],[w*.72,-h*.81],[w-1,-h*.51],[w,0]],"#53655d");
      p([[-w+4,-2],[-w+5,-h*.57],[-w*.42,-h*.81],[0,-h+2],[w*.5,-h*.75],[w-4,-h*.43],[w-3,-2]],"#637469");
      for(let i=0;i<3;i++){let xx=i*5-6,yy=-4-(i+room)%3*3;l(xx,1,xx+1,yy,"#415747",2);o(xx+1,yy-2,3,2,"#b99b70");l(xx,yy-3,xx+2,yy-3,"#d9b887");}
      path([[-w,0],[-w+1,-h*.5],[-w*.65,-h*.88],[-3,-h],[4,-h],[w*.72,-h*.81]],"#c0b4a0");
      path([[-w*.45,0],[-w*.42,-h*.56],[0,-h],[w*.35,-h*.56],[w*.41,0]],"#8c9381");
      p([[-w-3,-1],[w+2,-1],[w+1,4],[w*.4,7],[2,11],[-3,8],[-8,9],[-w-1,4]],"#464d43");
      l(-w-2,-1,w+1,-1,"#aa9f7e");path([[-w,3],[-7,4],[-3,8],[1,9]],"#73725b");
    });
  }

  function slagworks(d,room){
    const {rect:r,line:l,polygon:p,oval:o,path,at}=d;
    for(const [x,y] of [[6,250],[39,260],[433,257],[465,249]])at(x,y,()=>{
      // Open fan housings on an exhaust stack with stepped flare and exposed cooling ribs.
      p([[-13,18],[-10,1],[-6,-8],[-6,-13],[6,-13],[7,-7],[13,4],[15,18]],"#514651");
      p([[-13,18],[-10,0],[-6,-9],[-6,-13],[-2,-13],[-2,-6],[-6,7],[-6,18]],"#80685e");
      for(let k=0;k<3;k++){l(-8-k,-3+k*6,9+k,-3+k*6,"#393743",2);l(-8-k,-3+k*6,8+k,-3+k*6,"#9c7b6a");}
      o(0,-13,10,4,"#a58b78");o(0,-13,8,2,"#51474b");
      l(-6,-13,0,-12,"#c08a6a");r(1,-14,4,1,"#e0a781");
    });
    // Catwalk bracing links each exhaust bank across the open furnace roof.
    for(let x=67+room%2*5;x<409;x+=21){
      l(x,269,x+11,257,"#3b3741",2);l(x+11,257,x+21,269,"#5e4e54",2);
      r(x+10,257,2,2,"#9e8378");
    }
    path([[51,255],[154,258],[351,258],[432,251]],"#493b45",3);
    path([[51,255],[154,258],[351,258],[432,251]],"#9b7f72");
  }

  function frequency(d,room){
    const {rect:r,line:l,polygon:p,path}=d;
    // A fallen mast, still tied by two long catenary wires to its concrete foot.
    const tip=115+room*5;
    p([[-4,255],[24,251],[49,254],[66,260],[122,261],[143,267],[176,270],[-4,270]],"#56515b");
    path([[-4,255],[24,251],[49,254],[67,260],[109,261]],"#797078");
    p([[-3,253],[8,231],[16,228],[29,235],[20,252]],"#43424b");
    l(5,240,12,231,"#898082",2);
    path([[14,249],[38,240],[tip,224]],"#333641",3);
    path([[15,238],[39,234],[tip,224]],"#a19595");
    for(let i=0;i<10;i++){const x=18+i*9,y=239-i*1.6;
      l(x,y,x+5,y+5-i*.45,"#827782");l(x+5,y+5-i*.45,x+9,y-2,"#666471");}
    path([[42,236],[45,251],[63,256],[89,258],[tip+13,256]],"#46444f");
    path([[tip,224],[tip+3,235],[tip+11,244],[tip+27,250],[tip+54,255]],"#786b78");
    for(let j=0;j<3;j++){const x=424+j*17,y=253+(j*7)%12;
      p([[x-5,y],[x-3,y-8],[x+1,y-10],[x+7,y-7],[x+10,y]],"#5f5961");
      l(x-3,y-8,x+1,y-10,"#978a89");r(x+3,y-5,2,3,"#3c404c");}
  }

  function moonDock(d,room){
    const {rect:r,line:l,polygon:p,path,at}=d;
    at(3+room*2,244,()=>{
      // A civilian ore tug lies docked in profile, engines cold and wings folded.
      p([[-12,5],[-3,-1],[12,-4],[22,-9],[32,-12],[43,-10],[49,-6],[73,-5],[84,0],[77,5],[40,9],[8,11]],"#253749");
      p([[4,0],[18,-5],[30,-10],[41,-10],[49,-5],[70,-4],[79,0],[51,3],[14,5]],"#697986");
      p([[14,-4],[24,-11],[31,-13],[39,-11],[40,-9],[19,-4]],"#485e71");
      path([[17,-6],[26,-12],[31,-13],[38,-12]],"#aab9b9");l(26,-10,30,-11,"#90adb6",2);
      p([[31,-3],[48,-4],[59,-12],[68,-14],[60,-3],[51,1]],"#42586a");
      l(49,-4,66,-13,"#83949a");l(51,3,75,0,"#abb4ac");
      r(4,3,9,3,"#53636c");r(15,3,4,1,"#bcab85");r(69,2,4,2,"#c3b08a");
      for(let i=0;i<4;i++){r(76+i*2,-2+i%2,2,5,"#2d4153");r(77+i*2,0,1,2,"#7b969d");}
      r(21,7,3,6,"#364a5a");r(18,12,10,2,"#677b80");r(59,5,3,6,"#364a5a");r(56,10,10,2,"#657a80");
    });
    path([[0,260],[73,257],[98,260],[158,260]],"#425463",3);
    path([[0,260],[73,257],[98,260],[158,260]],"#8c9897");
    for(let i=0;i<6;i++){let x=392+i*14,y=256-(i%3)*3;
      p([[x-4,y],[x,y-3],[x+4,y-2],[x+6,y],[x+2,y+2]],"#506477");l(x-2,y-1,x+1,y-3,"#81909a");
    }
  }

  function lantern(d,room){
    const {rect:r,line:l,polygon:p,oval:o,path,at}=d;
    // The fuel feed joins a line of oil-glass pods to the overhead dock.
    pipe(d,[[-3,255],[34,255],[52,265],[129,265],[144,257],[342,257],[360,265],[428,265],[450,252],[480,252]],"#252d2c","#716d54","#959075",5);
    for(const [x,y,s] of [[17,246,12],[44,257,8],[395,262,6],[430,255,10],[463,245,13]])at(x,y,()=>{
      const h=s*2+4;
      r(-4,-h-6,8,6,"#414b41");r(-7,-h-2,14,4,"#77816a");
      p([[-s+2,-h],[-s*.4,-h-2],[s*.55,-h-2],[s,-h+5],[s,h*.12],[s*.5,5],[-s*.6,5],[-s,h*.03],[-s,-h+4]],"#3a443a");
      p([[-s+3,-h+3],[-s*.38,-h],[s*.36,-h],[s-2,-h+5],[s-2,-1],[s*.33,3],[-s*.3,3],[-s+2,-3]],"#887d51");
      p([[-s*.58,-h+7],[s*.47,-h+5],[s*.6,-2],[-s*.43,1]],"#b8a064");
      r(-s+3,-h+6,2,Math.max(4,h-9),"#d2b784");r(-2,-h+4,2,4,"#e0c895");
      for(const yy of [-h+3,-h*.5,1]){r(-s,yy,s*2+1,2,"#4c5345");l(-s+1,yy,s-2,yy,"#92947b");}
      o(0,5,s-2,2,"#515845");r(-3,7,6,8,"#74775a");
    });
    for(let i=0;i<4;i++)path([[164+i*43,261],[166+i*43,265],[170+i*43,267]],"#676e57",2);
  }

  const plates=[causeway,orchard,furnace,choir,meridian,glassTide,sporeLab,slagworks,frequency,moonDock,lantern];
  function draw(ctx,map) {
    const paint=plates[map.id];
    if(!paint)return;
    ctx.save();ctx.scale(2,2);
    if(map.room%2){ctx.translate(480,0);ctx.scale(-1,1);}
    paint(tools(ctx),map.room);
    ctx.restore();
  }
  window.SectorArt={draw};
})();
