/* Cinder Relay · actor workshop. Pixel-space plates, joints and organic shells are
   baked to small canvases; play only composites the current animation cells. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const INK = '#111d29', JOINT = '#293846', METAL = '#51616a';
  const PARCHMENT = '#e7d5b4', SILVER = '#a0afb0';
  const ember = ['#52404a','#98524a','#d9784e','#ffb975','#ffe4a6'];
  const human = ['#3a454d','#576570','#899496','#d3d2bf','#ff9b56'];
  const bug = ['#293e43','#3b5d55','#63836a','#a1af81','#f5c467'];
  const worm = ['#2e4a53','#486c74','#6a9497','#aad1bc','#e8e59e'];
  const crystal = ['#393955','#5c5178','#87759d','#c2abc7','#efdbeb'];
  const coral = ['#493c4d','#865160','#bd755f','#eca56f','#ffe2a2'];
  const suitColors = [
    ['#465967','#7f9399','#c0c9bd','#ff9f54'], ['#6a818c','#afc3c6','#f0ead6','#76daff'],
    ['#734f49','#aa6550','#dd8963','#ffc877'], ['#69605b','#af8757','#efba70','#9cf7e9'],
    ['#5c6358','#a3946d','#dfc892','#9bf8c1'], ['#68524e','#b47b5d','#e8a973','#ffe990'],
    ['#514868','#837599','#b9a9cd','#f7d8ff'], ['#675f49','#a79562','#d4bc82','#a7ead9'],
    ['#39626a','#67999b','#a5c8b9','#ffe78a'], ['#668295','#9dbcc9','#e1e5d4','#aefaff'],
    ['#333344','#555a71','#9695ad','#f2e7ff'], ['#464853','#676d77','#b4bdba','#ff8c85']
  ];
  const cache = new Map();
  const keyColor = ['#ffaf77','#a9ebe7','#ffca91','#abf9ec','#b2ffe4','#ffe18e','#e9c0ff','#ffd89c','#a5ebe3','#d8fcff','#efe4ff','#ff9390'];
  function pixels(canvas, origin) {
    const ctx = canvas.getContext('2d');
    let ox=origin, oy=origin;
    function rect(x,y,w,h,c) { ctx.fillStyle=c; ctx.fillRect(Math.round(ox+x),Math.round(oy+y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h))); }
    function line(x,y,u,v,c,w=1) {
      const n = Math.max(1,Math.ceil(Math.max(Math.abs(u-x),Math.abs(v-y))));
      for(let i=0;i<=n;i++)rect(x+(u-x)*i/n-Math.floor(w/2),y+(v-y)*i/n-Math.floor(w/2),w,w,c);
    }
    // Scanline rasterization keeps diagonals and negative space at native pixel resolution.
    function poly(v,c) {
      const ymin=Math.ceil(Math.min(...v.map(p=>p[1]))), ymax=Math.ceil(Math.max(...v.map(p=>p[1])));
      for(let y=ymin;y<ymax;y++) {
        const cuts=[];
        for(let i=0;i<v.length;i++) {
          const a=v[i], b=v[(i+1)%v.length];
          if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cuts.sort((a,b)=>a-b);
        for(let j=0;j+1<cuts.length;j+=2)rect(Math.ceil(cuts[j]),y,Math.max(1,Math.floor(cuts[j+1])-Math.ceil(cuts[j])+1),1,c);
      }
    }
    function oval(x,y,rx,ry,c) {
      for(let j=-Math.floor(ry);j<=ry;j++){const span=Math.round(rx*Math.sqrt(Math.max(0,1-(j/Math.max(.1,ry))**2)));rect(x-span,y+j,span*2+1,1,c);}
    }
    function plate(v,mid,hi,sh=INK) {
      poly(v,sh);
      const center=v.reduce((a,p)=>[a[0]+p[0]/v.length,a[1]+p[1]/v.length],[0,0]);
      const v2=v.map(p=>[Math.round(p[0]+Math.sign(center[0]-p[0])),Math.round(p[1]+Math.sign(center[1]-p[1]))]);
      poly(v2,mid);line(...v2[0],...v2[1],hi);
    }
    function ell(x,y,rx,ry,pal) {
      oval(x,y,rx,ry,INK);oval(x,y-1,Math.max(1,rx-1),Math.max(1,ry-1),pal[0]);
      oval(x-1,y-2,Math.max(1,rx-2),Math.max(1,ry-2),pal[1]);rect(x-2,y-ry+1,Math.max(1,rx-2),1,pal[2]);
    }
    function limb(x,y,k,l,u,v,mid,hi,w=3) {
      line(x,y,k,l,INK,w+2);line(k,l,u,v,INK,w);
      line(x,y-1,k,l-1,mid,w);line(k,l-1,u,v-1,hi,Math.max(1,w-2));rect(k-1,l-2,2,2,hi);
    }
    function offset(x,y,fn) {ox+=x;oy+=y;fn();ox-=x;oy-=y;}
    return {rect,line,poly,oval,ell,limb,plate,offset};
  }
  // Each row is a piece of hardware worn on the pack, or a mark painted on the pauldron.
  const armorDetails = {
    Lined:['++..+','.....','+..++'],
    Vented:['+++++','...+.','++++.','..+..','+++..'],
    Counterweighted:['.+++.','+...+','+...+','+++++'],
    Insulated:['++...','..++.','++...','..++.'],
    Lightened:['.+..+','+..+.','.....','.+...'],
    'of Recovery':['..+..','..+..','+++++','..+..','..+..'],
    'of the Long Step':['++...','..++.','....+','..++.','++...'],
    'of Reserves':['+++++','+...+','+++++','+...+','+++++'],
    'of Fieldwork':['+...+','.+.+.','..+..','.+.+.','+...+'],
    'of the Guard':['+++++','+...+','+...+','.+.+.','..+..']
  };
  function insignia(ctx,mark,x,y,color) {
    const rows=armorDetails[mark];
    if(!rows)return;
    ctx.fillStyle=INK;ctx.fillRect(x-1,y-1,7,rows.length+2);
    ctx.fillStyle=color;
    rows.forEach((row,dy)=>{
      for(let dx=0;dx<row.length;dx++)if(row[dx]==='+')ctx.fillRect(x+dx,y+dy,1,1);
    });
  }
  function trooper(D,id,f,back,walking) {
    const [dark,mid,hi,light]=suitColors[id]||suitColors[0];
    const {rect:r,line:l,oval:o,ell,limb,plate:p,poly,offset}=D;
    const step=walking?[0,2,0,-2][f]:0,bob=walking?(f%2):0;
    const heavy=[2,3,7,9].includes(id), scout=[1,6,8,10].includes(id);
    const shoulder=heavy?5:scout?2:3;
    const ceramic=id===0?'#e2dfc7':hi, trim=id===0?'#f29557':light;
    const lens=id===0?'#73e8db':light;
    // A split field tabard, stabilizer vanes or paired thrusters identify the suit at a glance.
    if(heavy){
      for(const x of [-8,6]){
        p([[x-2,2],[x+2,1],[x+4,4],[x+3,12],[x,13],[x-2,10]],dark,ceramic);
        r(x,8,3,3,JOINT);r(x,10,3,1,lens);
        if(walking)r(x+1,11,1,2+f%2,'#e7fff2');
      }
    }else if(scout){
      for(const [x,y] of [[-12,-14],[8,-12]]){
        p([[x-2,y-3],[x+1,y-2],[x+5,y+8],[x+3,y+14],[x,y+10]],dark,ceramic);
        l(x,y-1,x+1,y+3,trim);
      }
    }else{
      const tail=walking?[-2,-4,-1,0][f]:0;
      p([[-6,1],[-1,3],[-6,9],[-12+tail,13],[-12+tail,9],[-16+tail,10],[-11,4]],'#a35848','#ffb370');
      l(-10,6,-14+tail,9,'#ef8e58');l(-5,5,-9+tail,10,'#ef8e58');
    }
    // Two planted boots with different values leave a notch between them even in the idle pose.
    limb(3,4,5,9,6+step,14-step*.5,dark,mid,5);
    r(4+step,12-step*.5,6,4,INK);r(5+step,12-step*.5,4,2,mid);r(6+step,14-step*.5,5,2,INK);
    limb(-3,5,-5,9,-5-step,15+step*.5,mid,hi,5);
    p([[-7,7],[-3,7],[-2,9],[-4,12],[-7,11]],mid,ceramic);
    r(-8-step,13+step*.5,7,4,INK);r(-7-step,13+step*.5,5,2,mid);r(-7-step,13+step*.5,4,1,hi);
    if([1,8,9].includes(id)){r(-6-step,11+step*.5,3,2,light);r(4+step,10-step*.5,2,2,light);}
    offset(0,bob,()=>{
      // Backpack and silhouette-defining attachments.
      p([[-9,-7],[-6,-10],[-3,-8],[-2,4],[-6,6],[-10,3]],dark,hi);
      if(id===3||id===7){r(-13,-7,5,11,INK);for(let k=0;k<3;k++)r(-12,-6+k*3,3,1,light);r(9,-5,4,7,dark);}
      if(id===5){for(let k=0;k<4;k++){r(-11,-9+k*3,6,2,mid);r(-12,-9+k*3,2,1,light);}}
      if(id===6||id===10)for(let k=0;k<3;k++)p([[-12-k,-7+k*5],[-8,-8+k*4],[-9,-5+k*4],[-13-k,-3+k*4]],mid,hi);
      if(id===8){l(-7,-7,-10,-19,dark,2);r(-11,-19,3,1,light);r(-10,-14,4,1,hi);}
      if(id===4)for(let k=0;k<2;k++){l(-9,-5+k*4,-12,2+k*3,mid,2);l(-12,2+k*3,-7,7,hi);}
      p([[-7,-7],[-2,-10],[7,-7],[8,1],[4,7],[-4,8],[-8,3]],mid,ceramic);
      poly([[-5,-5],[5,-6],[7,-2],[3,1],[-1,2],[-5,0]],dark);
      if(back){
        r(-3,-5,7,7,JOINT);r(-2,-4,5,2,mid);r(-1,-4,3,1,lens);r(-2,0,4,1,hi);
      }else{
        poly([[-6,-4],[-3,-4],[-1,-1],[3,-1],[6,-3],[6,-1],[2,2],[-1,2]],hi);
      }
      r(-5,3,10,3,JOINT);r(-2,3,4,2,hi);
      p([[0,1],[4,0],[6,2],[3,5],[0,4]],ceramic,trim);
      r(2,2,2,1,back?hi:lens);r(-6,4,2,4,mid);r(-6,4,2,1,trim);
      if(id===4)o(1,-3,3,2,light);
      if(id===11){r(-2,-5,5,2,'#f1b8a9');r(0,-7,1,5,'#ed716c');}
      // The broad rescue shoulder and its diagonal stripe stay readable underneath a turning gun.
      p([[-11-shoulder,-5],[-10-shoulder,-9],[-7,-12],[-3,-11],[-2,-6],[-6,-2],[-11-shoulder,-2]],mid,ceramic);
      poly([[-10-shoulder,-7],[-8,-10],[-4,-10],[-5,-8],[-10,-6]],ceramic);
      poly([[-11-shoulder,-5],[-7,-7],[-7,-5],[-11-shoulder,-3]],trim);
      p([[5,-8],[10,-8],[11+shoulder,-5],[10+shoulder,-1],[6,0],[3,-4]],mid,hi);
      if(id===2||id===3){r(8,-6,4,1,dark);r(9,-4,4,1,dark);}
      if(id===11){r(-11,-7,5,1,'#ffe8d4');r(-9,-9,1,5,'#ff968c');}
      limb(-8,-2,-9,2,-6,5,dark,hi,id===2?5:3);r(-8,3,5,4,JOINT);
      if(id===4){
        ell(1,-11,8,8,[dark,mid,ceramic]);
        r(-5,-15,2,2,ceramic);r(-5,-8,2,2,ceramic);
        if(back){r(-3,-14,8,7,dark);r(-2,-13,6,2,mid);r(-1,-9,4,1,trim);}
        else{
          o(3,-11,5,5,INK);o(3,-11,4,4,'#406b65');o(4,-12,3,3,lens);
          r(3,-14,3,1,'#fff6d6');r(2,-13,2,1,'#fff6d6');r(3,-8,4,1,'#79a598');
        }
        l(-5,-7,-1,-4,hi);
      }
      else{
        const w=scout?7:8;
        // Common helmet family: a split crown stripe, projecting brow, and dark wraparound glass.
        p([[-7,-14],[-4,-18],[2,-19],[6,-17],[w,-14],[w+1,-11],[w,-7],[4,-4],[-2,-4],[-6,-7]],mid,ceramic);
        poly([[-6,-14],[-3,-17],[2,-18],[5,-16],[1,-15],[-3,-12]],ceramic);
        poly([[-3,-17],[0,-18],[3,-18],[0,-15],[-3,-13],[-5,-13]],trim);
        if(back){
          poly([[-5,-12],[0,-13],[6,-13],[7,-9],[4,-5],[-2,-5],[-5,-8]],dark);
          r(-3,-12,7,2,mid);r(-2,-9,5,2,JOINT);r(-1,-9,3,1,lens);
          l(3,-6,6,-8,hi);
        }else{
          poly([[-4,-12],[0,-14],[w+1,-14],[w+2,-12],[w,-8],[4,-6],[0,-7],[-3,-9]],INK);
          poly([[-2,-11],[1,-13],[w,-13],[w,-11],[5,-8],[1,-8]],'#315760');
          poly([[-2,-11],[1,-13],[w,-13],[w-1,-11],[3,-10],[0,-10]],lens);
          r(3,-13,4,1,'#fffae3');
          poly([[-2,-8],[2,-6],[5,-6],[w,-8],[6,-5],[2,-4],[-2,-5]],heavy?hi:mid);
          if(id===2||id===5){r(1,-6,4,1,dark);r(3,-5,3,1,dark);}
        }
        if(id===6||id===10)poly([[-7,-12],[-4,-15],[-4,-10],[-3,-6],[-6,-3],[-8,-2]],dark);
        if(id===9)p([[-6,-15],[-4,-19],[0,-18],[-2,-14]],hi,light);
        if(id===7){r(6,-15,4,4,INK);r(7,-14,3,2,light);}
      }
      r(-7,-11,4,5,INK);r(-7,-10,3,3,mid);r(-7,-10,2,1,hi);
    });
  }
  const troopPalettes=[
    ['#3b424c','#816360','#d68c67'], ['#4c4d50','#8b8678','#e0b784'], ['#344954','#66818a','#bfad96'],
    ['#414853','#6a7076','#b0a48b'],['#47484c','#937966','#d6a474'],['#414a53','#75818a','#c6ab91'],
    ['#4c474d','#9f6759','#eba97a'],['#4e4841','#a78346','#f5c268'],['#454753','#807061','#c8a979'],
    ['#3c4650','#667e87','#c3cbc3'],['#454854','#9c7058','#ffc07e'],['#3d4951','#7c8174','#d6cd9e']
  ];
  function foundry(D,id,f,wind) {
    const {rect:r,line:l,oval:o,ell,limb,plate:p,poly,offset}=D;
    const [dark,mid,hi]=troopPalettes[id], step=[-1,1,2,0][f],lamp=wind?'#fff6cf':'#ff8868';
    const disk=(x,y,radius)=>ell(x,y,radius,radius,[dark,mid,hi]);
    const vent=(x,y,n)=>{for(let i=0;i<n;i++){r(x+i*3,y,2,3,INK);r(x+i*3,y,1,1,hi);}};
    function gun(x,y,long=10){p([[x-3,y-1],[x,y-4],[x+5,y-3],[x+6,y-1],[x+long,y-2],[x+long+4,y-2],[x+long+4,y+1],[x+5,y+2],[x+2,y+4],[x-3,y+3]],dark,hi);r(x+long+2,y-1,3,1,lamp);}
    function body(big=0){
      limb(3,3,5+step,8,4+step,12,dark,mid,4+big);r(3+step,12,6,2,INK);
      limb(-3,4,-5-step,7,-6-step,13,mid,hi,4+big);r(-7-step,12,7,3,INK);r(-6-step,12,5,1,mid);
      p([[-8-big,-6],[-4,-10],[5,-10],[8+big,-6],[9+big,0],[5,6],[-4,7],[-8-big,3]],mid,hi);
      poly([[-4,-1],[4,-3],[7,-1],[4,2],[-3,3]],dark);r(-4,4,8,2,JOINT);
      p([[-8-big,-8],[-3,-10],[0,-7],[-2,-3],[-8-big,-2],[-11-big,-5]],mid,hi);
      limb(-8,-3,-9,1,-5,4,dark,hi,3+big);
    }
    function head(x,y,w=6){p([[x-w,y-3],[x-2,y-7],[x+4,y-6],[x+w+1,y-3],[x+w,y+2],[x+2,y+4],[x-3,y+3],[x-w,y]],mid,hi);l(x,y-1,x+w,y-2,INK,3);l(x+1,y-1,x+w,y-2,lamp);r(x-4,y,2,3,dark);}
    function legs4(w=10){for(let side of [-1,1])for(let k=0;k<2;k++){const d=k?step:-step;limb(side*(w-5),-3+k*4,side*(w+1),-3+k*6,side*(w+4)+d,5+k*5,mid,hi,4-k);r(side*(w+4)+d-2,5+k*5,5,2,INK);}}
    switch(id) {
      case 0:{
        p([[-12,-10],[-7,-13],[-4,-10],[-4,2],[-8,5],[-12,2]],dark,hi);
        l(-10,-8,-10,1,'#e5946d',2);body();head(1,-7);
        p([[-12,-6],[-10,-10],[-5,-10],[-3,-6],[-6,-2],[-11,-2]],'#a9634e','#f6bd82');
        l(-10,-6,-7,-8,'#ffe1a2');l(-10,0,-8,4,'#b77b57',2);
        gun(4,wind?-2:0,11);r(8,wind?-4:-2,4,2,'#ce7854');r(10,wind?-4:-2,1,2,'#f7bd79');
        if(wind){r(18,-4,2,3,'#ffdc96');r(20,-3,2,1,'#fff7d4');}break;}
      case 1: body(1);head(0,-8);gun(7,0,8);p([[2,-10],[9,-13],[15,-12],[15,7],[9,10],[3,6]],mid,hi);p([[5,-8],[11,-10],[13,-9],[13,4],[8,6],[5,4]],dark,hi);l(7,-5,12,-7,lamp,2);r(-11,-3,2,6,'#ef7859');break;
      case 2: body();head(-1,-9,4);l(0,-4,2,-16,mid,2);r(-1,-18,8,3,INK);r(4,-17,3,1,lamp);gun(2,-1,18);l(12,1,14,9,hi);l(12,1,9,8,dark);break;
      case 3: for(let y of [-3,6]){p([[-13,y-3],[7,y-4],[14,y],[11,y+4],[-8,y+5],[-15,y+1]],dark,hi);for(let x=-10;x<11;x+=4)r(x,y+1,2,2,mid);}p([[-12,-6],[-8,-10],[4,-11],[11,-5],[9,2],[-7,4],[-12,1]],mid,hi);for(let i=0;i<3;i++)disk(-6+i*5,-5,3);r(8,0,4,2,lamp);break;
      case 4: body(2);head(-1,-9);limb(5,-4,10,0,11,5,mid,hi,5);l(10,4,16,8,SILVER);disk(17,9+step,4);r(15,8+step,3,2,lamp);p([[-12,-6],[-9,-10],[-4,-9],[-4,3],[-10,5]],dark,hi);break;
      case 5: legs4();p([[-10,-7],[-5,-11],[7,-10],[13,-5],[11,3],[3,7],[-8,4]],mid,hi);head(0,-5,5);p([[-11,-11],[-6,-15],[4,-15],[8,-11],[5,-6],[-8,-6]],dark,hi);for(let i=0;i<3;i++){r(-7+i*4,-12,3,3,INK);r(-7+i*4,-12,2,1,lamp);}break;
      case 6: body();head(1,-6,4);gun(6,-1,6);p([[-11,-8],[-5,-9],[-2,-5],[-11,5],[-14,4]],mid,hi);for(let x of [-6,5]){r(x,9,3,6,mid);r(x,14,2,3,'#e1f8e4');}break;
      case 7: body(1);head(-3,-8,4);for(let x of [-3,9]){r(x,-16,3,22,INK);r(x+1,-16,1,20,hi);}p([[3,-6],[12,-8],[16,-5],[15,3],[7,6],[3,3]],'#957052','#e1ad76');l(5,-4,13,2,'#655349',2);r(-11,-7,6,2,hi);break;
      case 8: legs4(9);p([[-10,-5],[-4,-9],[7,-7],[10,-1],[6,5],[-7,6],[-12,1]],mid,hi);p([[-5,-4],[-3,-12],[4,-20],[10,-18],[10,-15],[4,-3],[0,1]],mid,hi);l(4,-18,9,-16,INK,3);r(7,-17,2,1,lamp);vent(-8,0,3);break;
      case 9: for(let y of [-1,6]){p([[-16,y],[-6,y-4],[5,y-4],[14,y-1],[9,y+2],[-12,y+4]],dark,hi);r(-15,y+1,4,2,'#e1f4de');}p([[-10,-3],[1,-8],[8,-7],[14,-3],[5,2],[-4,3]],mid,hi);l(3,-5,8,-5,lamp,2);break;
      case 10: body(1);p([[-13,-7],[-10,-13],[-5,-12],[-3,4],[-11,5]],mid,hi);for(let k=0;k<3;k++)r(-11,-8+k*3,5,1,INK);head(1,-7);gun(5,0,8);l(14,-1,17,-3,'#9ffbea',2);break;
      case 11: body();p([[-13,-9],[-9,-14],[-4,-13],[-3,3],[-11,6]],mid,hi);for(let k=0;k<3;k++)r(-11,-9+k*4,4,2,dark);head(1,-8,4);gun(3,0,5);break;
    }
  }
  function orchard(D,id,f,wind) {
    const {rect:r,line:l,oval:o,ell,limb,plate:p,poly}=D;
    const s=[-1,0,1,0][f],live=wind?'#fff4b2':'#efbc6e';
    function car(x,y,rx,ry,pal=bug){ell(x,y,rx,ry,[pal[0],pal[1],pal[3]]);o(x-1,y-1,Math.max(1,rx-3),Math.max(1,ry-2),pal[2]);l(x-rx+2,y-1,x-2,y-ry+1,pal[3]);}
    function spine(x,y,u,v,pal=bug,w=4){p([[x-2,y+2],[x,y-2],[u,v],[x+w,y+2]],pal[2],pal[3]);}
    function legs(n,w,reach=5){for(let side of [-1,1])for(let i=0;i<n;i++){let y=-5+i*4,inset=Math.abs(i-1)*2,st=i%2?s:-s;limb(side*(w-4),y,side*(w+2-inset),y-2+st,side*(w+reach-inset),y+4+st,bug[1],bug[3],3);}}
    function eye(x,y){o(x,y,2,2,INK);r(x,y-1,2,2,live);}
    function curved(x,y,mx,my,ex,ey,co,w){for(let i=0;i<9;i++){let t=i/9,tt=(i+1)/9;const q=k=>[(1-k)**2*x+2*(1-k)*k*mx+k*k*ex,(1-k)**2*y+2*(1-k)*k*my+k*k*ey];l(...q(t),...q(tt),co,w);}}
    switch(id){
      case 0:{
        legs(3,7,7);car(-3,0,7,5);
        p([[-9,-5],[-5,-11],[-1,-10],[4,-5],[4,0],[-4,-1]],bug[2],'#d7d49a');
        for(let i=0;i<3;i++)l(-6+i*3,-6+i,-4+i*3,-8+i,'#edc77a');
        car(5,2,5,4);eye(7,1);
        for(const side of [-1,1]){
          const k=wind?2:0,y=2+side*3;
          p([[6,y],[10,y+side*4],[15+k,y+side*5],[13+k,y+side],[9,y+side]],'#af8b63','#ffdb99');
          r(13+k,y+side,2,1,'#f3e7ae');
        }break;}
      case 1: legs(3,9);car(0,0,12+(wind?1:0),10,coral);for(let i=0;i<3;i++){let x=-5+i*5;curved(x-2,-6,x+4,-3,x,6,coral[1],2);}car(7,3,4,3);eye(9,2);r(-6,-5,3,2,live);break;
      case 2: legs(3,7,6);for(let i=0;i<3;i++){let x=-6+i*5,y=-13+(i%2)*3;l(x+1,1,x+s,y,bug[0],3);car(x+s,y,4,5,i%2?bug:coral);r(x+s-1,y-3,2,2,live);}car(1,3,7,5);eye(5,3);break;
      case 3: legs(2,6,6);car(0,-3,4,7);car(4,-9,4,4);eye(6,-10);for(let side of [-1,1]){let x=side<0?-4:5;limb(x,-3,x+side*7,-10+s,x+side*8,3,bug[2],bug[3],3);spine(x+side*8,4,x+side*4,11,worm);}break;
      case 4: legs(3,9);car(0,0,12,8,worm);for(let i=0;i<5;i++){const x=-8+i*4;curved(x,-5,x+4,-2,x,4,worm[0],2);l(x,-5,x+1,-6,'#a3d4c9');}car(8,2,4,4);eye(10,2);break;
      case 5: for(let i=0;i<7;i++){let x=-13+i*4,y=Math.round(Math.sin(i*.7+f*1.1)*2);car(x,y,2+Math.min(i,3),3+Math.min(i,2),worm);r(x,y-1,2,1,'#a0e2c4');}eye(12,0);break;
      case 6: legs(2,7,6);p([[-13,1],[-11,-5],[-4,-9],[4,-9],[11,-6],[14,0],[8,5],[-8,6]],bug[1],bug[3]);for(let i=0;i<5;i++)l(-8+i*4,-5-Math.min(i,4-i),-4+i*2,2,bug[2],2);l(-10,2,10,-1,live,wind?3:1);p([[-11,3],[11,0],[12,3],[4,7],[-4,8]],bug[2],bug[3]);break;
      case 7: for(let side of [-1,1])curved(side*4,1,side*10,7,side*6+s*2,15+s,bug[3],2);
        p([[-12,-4],[0,-14],[12,-3],[4,5],[-1,8],[-6,3]],bug[2],bug[3]);poly([[-10,-5],[0,-12],[-1,2]],worm[2]);l(0,-12,0,3,bug[0],2);eye(4,-3);break;
      case 8: legs(2,9,6);car(-3,0,10,7,coral);car(6,-1,8,7);p([[3,-5],[6,-11],[12,-8],[16,-2],[10,1],[6,-1]],coral[2],coral[3]);eye(10,0);spine(6,-6,15,-11,coral);break;
      case 9: legs(3,11,6);car(0,0,11,6);for(let side of [-1,1]){car(side*11,-2,5,4);spine(side*12,-3,side*17,-8);spine(side*12,1,side*17,-3);}p([[-6,-5],[0,-9],[7,-5],[4,1],[-4,2]],bug[2],bug[3]);eye(5,-3);break;
      case 10: legs(2,6,5);for(let i=0;i<3;i++){let x=-5+i*5;car(x,3+(i%2)*2,4+(wind?1:0),6,coral);r(x-1,1,2,2,live);}car(0,-3,6,5);spine(-3,-6,-7,-11);eye(4,-4);break;
      case 11: curved(-4,3,-20,8,-17,-6+s,bug[0],4);curved(-4,2,-18,7,-17,-7+s,bug[3],2);legs(2,7,4);car(-1,0,7,6);car(5,-3,5,4);eye(7,-4);for(let y of [-6,3]){limb(5,y,12,y-4,17,y+1,bug[1],bug[3],3);spine(15,y+2,12,y+6,coral,2);}break;
    }
  }
  function relay(D,id,f,wind) {
    const {rect:r,line:l,oval:o,ell,limb,plate:p,poly}=D;
    const [deep,sh,mid,hi,white]=crystal, pulse=wind?'#ffefe2':'#f0b4ee',s=[-1,0,1,0][f];
    function jewel(x,y,rx,ry,c=mid){p([[x-rx,y],[x,y-ry],[x+rx,y],[x,y+ry]],c,hi);poly([[x-rx+2,y],[x,y-ry+2],[x,y+ry-2]],sh);r(x-1,y-1,3,2,pulse);}
    function ring(x,y,rx,ry){o(x,y,rx,ry,INK);o(x,y-1,rx-1,ry-1,mid);o(x,y-1,rx-3,Math.max(1,ry-3),deep);l(x-rx+2,y-2,x-1,y-ry+1,hi);}
    switch(id){
      case 0:{
        for(let q of [-1,1]){
          const x=q*(11+(wind?2:0));
          limb(q*3,1,q*8,-3,x+s,6,mid,hi,3);
          p([[x-2,3],[x,0],[x+3,4],[x+2,8],[x-1,10]],sh,hi);r(x,4,2,3,pulse);
        }
        jewel(0,-2,7,10);p([[-3,-5],[1,-7],[5,-4],[4,0],[0,3],[-4,0]],deep,white);
        o(1,-2,2,2,'#e8aaff');r(1,-3,2,1,'#fff2e2');jewel(6,-12+s,2,3);break;}
      case 1: p([[-6,-10],[1,-14],[7,-11],[8,7],[2,12],[-6,8]],mid,hi);poly([[-3,-9],[3,-10],[4,6],[-2,8]],deep);for(let i=0;i<4;i++)r(-2+(i%2),-7+i*3+s,3-(i%2),1,pulse);break;
      case 2: ring(-5,1,7,10);ring(7,-2,6,9);r(-6,-3,2,5,pulse);r(6,-5,2,5,pulse);l(-6,9,5,6,sh,2);break;
      case 3: ell(0,0,11,10,[deep,sh,hi]);for(let i=0;i<6;i++){let a=i*TAU/6+f*.09,x=Math.cos(a)*7,y=Math.sin(a)*6;jewel(x,y,4,4);}jewel(0,0,4,5,hi);break;
      case 4: for(let i=0;i<3;i++){const x=-7+i*7;l(x,0,x-5,8+s,sh,2);l(x-5,8+s,x-3,12,pulse);}jewel(0,-3,6,8);l(4,-5,9,-12,hi,2);r(8,-13,3,2,pulse);break;
      case 5: for(let i=0;i<5;i++){let a=(i*TAU/5)-Math.PI/2,x=Math.cos(a)*(wind?10:7),y=Math.sin(a)*(wind?8:5);jewel(x,y,5,6);}ring(0,0,5,5);r(-1,-1,3,3,pulse);break;
      case 6: p([[-10,-10],[8,-12],[10,-9],[0,-5],[-6,-6],[-6,7],[-11,9]],mid,hi);l(5,-8,5+s*2,5,hi);jewel(5+s*2,7,4,5);l(-7,6,-2,8,pulse);break;
      case 7: for(let i=0;i<3;i++){let a=i*TAU/3+f*.3,x=Math.cos(a)*11,y=Math.sin(a)*8;l(x,y,0,0,sh);jewel(x,y,3,4);}jewel(0,0,4,11);break;
      case 8: p([[-14,-4],[-7,-9],[3,-8],[13,-3],[8,1],[2,6],[-6,9],[-2,4],[3,-1],[-2,-3]],mid,white);l(-9,-6,-5,-8,pulse,2);break;
      case 9: jewel(0,-2,8,13);jewel(0,1,4,6,hi);l(-8,9,6,7,sh,2);r(-1,12,3,2,pulse);break;
      case 10: p([[-12,-8],[-5,-10],[-6,4],[-12,7]],mid,hi);p([[6,-7],[13,-9],[12,4],[6,7]],mid,hi);l(-7,2,6,-1,hi,2);jewel(0,0,3,6);break;
      case 11: p([[-7,-9],[-1,-13],[7,-10],[8,4],[3,9],[1,12],[-2,11],[-1,6],[5,2],[4,-6],[-3,-8],[-5,5],[-8,3]],mid,hi);jewel(0,-2+s,4,6,hi);break;
    }
  }
  function fodder(D,id,f,wind) {
    const {rect:r,line:l,oval:o,plate:p}=D;
    const stride=[-1,0,1,0][f];
    if(id===36){
      // Two black tire silhouettes under a short enamel wedge and a hinged copper jaw.
      for(const x of [-5,5]){
        o(x,4,4,4,INK);o(x,4,3,3,'#49565d');r(x-1,3,3,2,'#c18b68');
        r(x+stride,6,1,1,'#d5c2ad');
      }
      p([[-10,1],[-9,-4],[-3,-7],[4,-7],[9,-3],[7,2],[1,4],[-6,3]],'#a75f43','#f3bd86');
      l(-7,-3,-2,-5,'#f0a367',2);r(-4,-3,2,2,INK);r(-1,-4,2,2,INK);
      p([[4,-3],[9,-4],[12,-2],[8,0],[5,0]],'#393b40','#edb485');
      r(7,-3,3,1,wind?'#ffffdf':'#ff8758');l(7,2,11,wind?4:1,'#ffd89e',2);
    }else if(id===37){
      // Splayed limbs, forked sickles and a split lime carapace.
      for(const side of [-1,1])for(let i=0;i<2;i++){
        const y=side*(3+i),x=-4+i*5,k=i?stride:-stride;
        l(x,y,x-3+k,side*(7+i),INK,3);l(x-3+k,side*(7+i),x-6+k,side*(8+i),'#adc07d');
      }
      p([[-9,0],[-6,-5],[-2,-6],[3,-3],[6,0],[1,4],[-4,5]],'#5b7852','#dae1a0');
      l(-6,0,-1,-3,'#c5b775',2);l(-5,1,2,1,'#34493f');o(4,0,4,3,INK);
      for(const side of [-1,1]){
        const jaw=wind?4:2;
        l(6,side,9,side*jaw,'#e9ce84',2);l(9,side*jaw,11,side*(jaw-1),'#fff1bc');
        r(5,side,2,1,wind?'#ffffe1':'#ffc972');
      }
    }else{
      // A dark central aperture surrounded by three detached iridescent vanes.
      for(let i=0;i<3;i++){
        const a=i*TAU/3+f*.24,dx=Math.cos(a),dy=Math.sin(a),rad=wind?10:8;
        const part=(u,v)=>[Math.round(dx*u-dy*v),Math.round(dy*u+dx*v)];
        p([part(rad+2,-1),part(rad-1,3),part(rad-5,3),part(rad-3,0),part(rad-3,-2)],'#ac86bd','#ead2ee');
      }
      p([[-5,0],[-1,-5],[4,-3],[5,1],[1,5],[-4,3]],'#67547c','#c8b5dd');
      o(0,0,3,3,INK);r(-1,-1,3,3,wind?'#fff4dc':'#ee99dc');r(0,-1,2,1,'#fff1ed');
    }
  }
  function major(D,id,f,wind,phase,exposed) {
    const {rect:r,line:l,oval:o,ell,limb,plate:p,poly,offset}=D;
    const s=[0,2,0,-2][f], ready=wind||phase===3, eye=ready?'#fff2b5':'#ffae72';
    const hot=wind?'#ffc079':'#c28362',litCore='#bcffdb',coolCore='#579d99';
    // A pale edge and a dark, interrupted seam make damage persist across attack poses.
    function fracture(points,rim) {
      for(let i=1;i<points.length;i++){
        const [x,y]=points[i-1],[ex,ey]=points[i];
        l(x+1,y,ex+1,ey,rim);l(x,y,ex,ey,INK);
      }
    }
    function chamber(x,y,rx,ry){
      o(x,y,rx+2,ry+2,INK);o(x,y,rx+1,ry+1,'#445961');
      o(x,y,rx,ry,'#31565d');o(x-1,y-1,Math.max(1,rx-1),Math.max(1,ry-1),coolCore);
      o(x-1,y-1,Math.max(1,rx-3),Math.max(1,ry-2),litCore);
      r(x-2,y-ry+1,2,1,'#f0ffea');
    }
    function hub(x,y,size,hot=false) {
      ell(x,y,size,size,[JOINT,hot?'#ae7358':'#748087','#d6b991']);o(x,y,Math.max(1,size-3),Math.max(1,size-3),INK);r(x-1,y-1,3,2,hot?eye:SILVER);
    }
    function metalLeg(x,y,k,n,u,v,d,near=true) {
      const mid=near?'#7c6b65':'#515461',hi=near?'#e4a57c':'#9a9190';
      l(x+2,y+3,k+2,n+4,SILVER,3);limb(x,y,k,n,u,v,mid,hi,d);
      l(k+2,n+3,u+2,v-1,JOINT,3);l(k+2,n+3,u+2,v-1,SILVER);
      hub(k,n,Math.max(3,Math.round(d*.6)),near);hub(u,v,3,near);r(u-4,v+2,10,3,INK);r(u-4,v+2,7,1,mid);
    }
    function mechPod(x,y,k) {
      offset(x,y,()=>{
        p([[-14,-8],[-7,-14],[8,-14],[15,-8],[15,3],[9,8],[-8,8],[-15,2]],'#8b685c','#e1a679');
        p([[-12,-4],[-8,-9],[6,-10],[13,-6],[9,-1],[-8,4]],'#aa795a','#edb67f');
        p([[-11,4],[8,-1],[13,-3],[11,3],[7,6],[-9,8]],'#51505a','#b29279');
        for(let i=0;i<4;i++){l(-7+i*4,-7,-9+i*4,-3,INK,2);r(-7+i*4,-8,2,1,ready?eye:'#d79467');}
        for(let i=0;i<3;i++){r(-8+i*8,7,3,8,JOINT);r(-7+i*8,8,1,5,SILVER);}
        p([[-12,14],[-8,10+k],[7,10+k],[12,13],[11,18],[-11,18]],'#69727b','#ddb58e');
        l(-10,16,10,15,ready?'#ff9961':'#9e6a56',2);
      });
    }
    function pod(x,y,rx,ry,pal) {
      ell(x,y,rx,ry,[pal[0],pal[1],pal[3]]);
      o(x-1,y-1,Math.max(1,rx-3),Math.max(1,ry-3),pal[2]);l(x-rx+3,y-2,x-2,y-ry+2,pal[3],2);
    }
    if(id===0){
      metalLeg(-14,1,-27,-1,-30+s,16,6,false);metalLeg(13,0,24,-5,32-s,15,6,false);
      metalLeg(-12,4,-26,9,-25-s,23,7);metalLeg(13,5,27,7,23+s,22,8);
      for(let i=0;i<3;i++){l(-11+i*3,5,-5+i*4,15,JOINT,2);l(-5+i*4,15,6+i*3,6,METAL,2);}
      p([[-22,-10],[-14,-16],[5,-18],[18,-12],[24,-6],[21,4],[13,9],[-12,10],[-21,5]],'#64606a','#b39b85');
      p([[-21,-12],[-11,-21],[2,-24],[15,-20],[24,-11],[22,-6],[12,-1],[-16,2],[-24,-4]],'#8b7468','#ebb085');
      poly([[-17,-12],[-9,-19],[2,-22],[14,-19],[17,-16],[5,-15],[-1,-10]],'#b89277');
      p([[3,-12],[16,-15],[24,-12],[25,-6],[19,-2],[3,0]],'#514d59','#ae8d79');l(11,-8,23,-10,eye,3);
      for(let i=0;i<4;i++){l(-13+i*4,-8,-15+i*4,-4,INK,2);r(-11+i*4,5,2,3,phase>1?eye:'#ad7d6a');}
      l(-7,-20,-9,-30,JOINT,2);r(-10,-31,3,2,eye);
      // The dock hauler charges a three-section rivet ram. Its aft radiator louvers lift to vent.
      const extension=wind?2+f%2:0;
      p([[9,1],[13,-3],[23,-4],[25,-2],[34+extension,-3],[35+extension,0],[23,3],[16,6],[10,6]],METAL,SILVER);
      for(let i=0;i<3;i++){r(18+i*4,-3,2,5,JOINT);r(18+i*4,-3,1,2,hot);}
      r(33+extension,-2,3,2,eye);
      p([[-22,-9],[-16,-14],[-5,-13],[-3,-8],[-8,0],[-19,1],[-24,-3]],'#4e515a','#a59c88');
      for(let i=0;i<4;i++){
        const x=-20+i*3.5;
        l(x,-4,x+3,-10,INK,3);
        l(x,-4,x+3,-10,exposed?litCore:'#d2aa78');
        if(exposed)l(x,-6,x+1,-12,'#d9c1a0',2);
      }
      r(-16,-18,5,2,'#c8ad7a');r(-16,-18,1,2,JOINT);r(-13,-18,1,2,JOINT);
      if(phase>=2)fracture([[-7,-20],[-5,-16],[0,-17],[2,-14]],'#d8b191');
      if(phase===3){poly([[1,-21],[10,-20],[13,-16],[7,-15],[4,-17],[2,-16]],JOINT);l(4,-19,9,-18,hot,2);r(6,-18,1,3,INK);}
      return;
    }
    if(id===1){
      for(let side of [-1,1])for(let k=0;k<2;k++){const x=side*(9+k*3);limb(x,-4+k*7,side*(21+k*2),-9+k*10,side*(27-k*3)+s*(k?1:-1),13+k*9,bug[2],bug[3],5-k);p([[x-3,-3+k*7],[side*20,-10+k*10],[side*22,-9+k*10],[x+3,1+k*7]],bug[1],bug[3]);}
      pod(0,-1,17,22,coral);
      for(let i=-2;i<=2;i++){let x=i*5;l(x,-17+Math.abs(i)*2,x*1.4,-6,coral[1],2);l(x*1.4,-6,x,10,coral[3],2);l(x,10,x*.6,16,coral[0],2);}
      const spread=exposed?4:wind?2+(f%2):0;
      for(let q of [-1,1]){
        const rim=q*(7+spread);
        p([[q*4,-17],[q*12,-15],[q*17,-7],[q*15,3],[q*12,8],[rim,2],[rim,-8]],'#926457','#e4aa7d');
        for(let i=0;i<3;i++)l(q*(12+i%2),-11+i*5,rim,-9+i*4,wind?'#ffd68c':'#bd9068');
        p([[q*8,-13],[q*13,-24],[q*19,-27],[q*15,-16],[q*13,-9]],bug[2],bug[3]);
        pod(q*10,12,4,5,bug);
        if(phase>1&&q<0)fracture([[-14,-11],[-12,-6],[-15,-2],[-12,2]],'#ebbd82');
      }
      // A hanging seed heart is visible through separated ribs after the bloom.
      pod(1,-3,5+spread,10+(wind&&f%2?1:0),ember);
      if(exposed){chamber(1,-2,5,8);l(-1,2,-2,6,'#e4ffbb');}
      else{l(1,-9,-1,-4,eye,2);l(-1,-4,2,1,eye,2);r(1,1,2,4,eye);}
      if(phase===3){p([[7,4],[14,1],[12,8],[9,10],[6,8]],'#5b404b','#e0996f');l(9,5,11,4,'#ffc085');}
      return;
    }
    if(id===2||id===5){
      if(id===5){l(-20,-3,20,-3,INK,6);l(-20,-4,20,-4,'#bd805e');for(let k=0;k<3;k++)r(-5+k*4,-5+s,2,3,eye);}
      for(let q of [-1,1]){metalLeg(q*(id===2?9:14),1,q*26,4,q*(27+s),18,6);metalLeg(q*12,-5,q*21,-9,q*(26-s),-1,5,false);}
      if(id===2){p([[-17,-9],[-12,-19],[11,-20],[19,-13],[18,5],[-18,7]],METAL,SILVER);
        for(let i=0;i<2;i++){r(-12+i*18,-22,6,14,INK);r(-11+i*18,-25,3,15,'#958278');r(-10+i*18,-25,1,5,eye);}
        const jawY=wind?-4+s:exposed?4:s;
        mechPod(1,jawY,phase===3?2:0);
        for(const q of [-1,1]){
          p([[q*5,-13],[q*13,-15],[q*16,-14],[q*12,-4],[q*7,-2]],'#725249','#c49369');
          l(q*10,-11,q*13,-12,hot,2);
        }
        // Two induction coils drive the press. A lifted jaw exposes the turquoise coolant column.
        if(exposed){chamber(0,-8,4,7);for(const y of [-11,-6,-1])r(-5,y,10,1,'#839b90');}
        else{r(-3,-16,6,13,INK);for(let i=0;i<4;i++)r(-2,-15+i*3,4,2,wind?'#ffcb76':'#bd8054');}
        for(let i=0;i<4;i++)l(-11+i*6,13+jawY,-8+i*6,11+jawY,'#c0a379',2);
        if(phase>1)fracture([[6,-10],[8,-7],[6,-4],[10,-3]],'#e6ba94');
        if(phase===3){p([[-14,1],[-9,-1],[-5,3],[-11,6]],'#443943','#b3947e');r(-12,3,3,1,'#ffac69');}
      }else{
        // Two independent hammerheads share a visible winding cable and alternate their strokes.
        const travel=wind?4+s:s;
        for(const q of [-1,1]){
          const y=-4+q*travel,x=q*14;
          mechPod(x,y,q>0?2:0);
          offset(x,y,()=>{for(let j=0;j<3;j++)l(-7+j*5,0,-5+j*5,-3,q<0?'#e3b060':'#98b9bd',2);});
          l(q*9,7+y,q*5,7,INK,3);l(q*9,6+y,q*5,6,q<0?'#d7a364':'#8cacae');
        }
        p([[-6,-8],[-2,-11],[3,-10],[6,-6],[5,6],[0,10],[-5,5]],'#5b5861','#adb5ae');
        if(exposed)chamber(0,-1,3,6);
        else{r(-2,-6,5,11,INK);for(let i=0;i<4;i++)r(-1,-5+i*2,3,1,hot);}
        if(phase>1)fracture([[-22,-12],[-20,-9],[-23,-6],[-20,-4]],'#f3bb85');
        if(phase===3)fracture([[13,-11],[15,-8],[13,-5],[17,-2],[16,1]],'#d5e1cf');
      }return;
    }
    if(id===3){
      for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3+f*.09,x=Math.cos(a)*23,y=Math.sin(a)*19;
        l(0,0,x,y,crystal[1],2);p([[x-6,y-3],[x,y-7],[x+7,y-3],[x+4,y+4],[x-3,y+6]],crystal[2],crystal[3]);r(x-2,y-2,4,3,ready?'#fff4d2':'#efb4ef');
      }
      p([[-21,10],[-4,-20],[2,-23],[22,10],[18,15],[-16,17]],crystal[2],crystal[4]);
      poly([[-16,10],[-1,-14],[15,9],[-1,3]],crystal[0]);
      // Slender tuning forks flare out of the triangular conductor as it prepares a chord.
      for(const q of [-1,1]){
        const dx=q*(wind?2+f%2:0);
        p([[q*15+dx,7],[q*9+dx,-5],[q*10+dx,-8],[q*16+dx,0],[q*20+dx,7],[q*18+dx,9]],'#655974','#d2b6d0');
        l(q*12+dx,-4,q*17+dx,4,wind?'#ffdbbe':'#a99bb8');
        for(let j=0;j<3;j++)r(q*(6+j*3)-1,9+j,2,1,wind?'#ffe6c4':crystal[2]);
      }
      if(exposed){
        p([[-10,6],[-2,-10],[0,-8],[-5,5],[-1,10]],crystal[1],crystal[3]);
        p([[3,-8],[10,5],[3,10],[5,4],[1,-5]],crystal[1],crystal[3]);
        poly([[-5,3],[0,-5],[5,3],[0,7]],litCore);l(0,-4,0,4,'#efffe5');
      }else{p([[-9,6],[-1,-9],[8,5],[0,11]],crystal[2],crystal[3]);r(-2,1,5,4,ready?'#fff0c4':'#f6c8ef');}
      if(phase>1)fracture([[-13,3],[-10,4],[-9,8],[-5,9]],'#dec9df');
      if(phase===3){poly([[4,-15],[8,-9],[6,-9],[3,-12]],INK);p([[6,-17],[10,-15],[10,-12],[7,-13]],crystal[2],crystal[4]);}
      return;
    }
    if(id===4){
      const ring=(radius,dx)=>{for(let i=0;i<9;i++){
        // The outer spindle loses two plates across the fight. Their exposed struts stay attached.
        const outer=radius>20;
        const a=i*TAU/9+f*(outer?.14:-.14)+dx,x=Math.cos(a)*radius,y=Math.sin(a)*radius*.77;
        if(outer&&(i===2&&phase>1||i===7&&phase===3)){
          l(x*.74,y*.74,x+2,y-1,'#6d6577',3);r(x+1,y-2,2,2,'#edbd98');continue;
        }
        p([[x-5,y-2],[x-1,y-5],[x+5,y-4],[x+7,y+1],[x+2,y+4],[x-5,y+2]],i%3?'#9a99a0':'#ccbcab','#ecdbbe');
        l(x-3,y,x+1,y-2,crystal[1]);if(wind&&i%3===f%3)r(x+2,y-2,2,2,'#fff0d1');
      }};ring(25,0);ring(exposed?18:16,.5);
      p([[-6,10],[-8,-4],[-1,-19],[8,-8],[9,6],[1,20]],crystal[2],crystal[4]);
      ell(0,1,10,8,[crystal[0],crystal[2],crystal[4]]);
      if(exposed){chamber(0,0,7,5);o(0,0,2,4,'#255158');r(-1,-2,1,2,'#f5ffdc');}
      else{
        const gap=wind?1+f%2:3;o(1,0,6,gap,'#fabf97');
        p([[-9,0],[-5,-6],[3,-7],[8,-3],[2,-gap],[-5,-gap+1]],crystal[2],'#e4d6bc');
        l(-2,0,3,0,ready?'#fff5cb':'#eed6bc',2);
      }
      return;
    }
    // Husk of the Horizon, a seed-vessel with recurved, ribbed wings.
    for(let side of [-1,1]){
      const lift=wind?3+f%2:0,tip=phase===3&&side<0?29:37;
      p([[side*4,-7],[side*18,-13-lift],[side*31,-11+s-lift],[side*tip,-4+s-lift],[side*24,-4],[side*15,5],[side*8,9]],bug[1],bug[3]);
      for(let i=0;i<4;i++){let x=side*(10+i*5);l(x,-8-lift,x+side*3,-5,bug[3],2);pod(x,-5,3,4,coral);}
      for(let i=0;i<3;i++){const x=side*(12+i*5);l(x,-5,x+side*4,-6-lift,'#edb17d');l(x,-3,x-side*3,2,'#3f5453');}
      limb(side*7,4,side*15,14,side*13+s,22,bug[2],bug[3],4);}
    pod(0,0,10,16,bug);
    const aperture=exposed?5:1;
    for(const q of [-1,1]){
      p([[q*aperture,-10],[q*6,-13],[q*10,-7],[q*8,7],[q*4,12],[q*aperture,7]],bug[1],bug[3]);
      l(q*(aperture+1),2,q*6,-7,coral[2]);
    }
    if(exposed){chamber(0,0,4,8);r(0,3,1,4,'#eaffe2');}
    else{pod(0,-1,4,8,coral);l(0,-5,1,2,eye,2);}
    poly([[-4,-10],[0,-16],[6,-12],[2,-6]],bug[3]);
    if(phase>1)fracture([[13,-10],[15,-8],[17,-10],[19,-7]],'#c9b088');
    if(phase===3){p([[-25,-6],[-17,-4],[-16,-1],[-20,-1]],'#53474c','#c39979');r(-21,-5,3,1,coral[3]);}
  }
  function glyph(D,id) {
    const {rect:r,line:l,oval:o,plate:p}=D,c=['#80e3d7','#94dbe8','#bbabf1','#95e5e0','#ffab75','#b1e6f3','#ffc071','#a4e2ae','#d5b2f0','#b89ee5','#a6d78b','#f4cd77'][id]||SILVER;
    const hi='#f4ecda';
    function ring(x,y,rx,ry){o(x,y,rx,ry,c);o(x,y,rx-2,Math.max(1,ry-2),JOINT);}
    switch(id){
      case 0: for(let i=0;i<3;i++){l(-10+i*5,-7+i, -5+i*5,0,c,2);l(-5+i*5,0,-10+i*5,7-i,c,2);}break;
      case 1:p([[-9,-8],[0,-11],[9,-8],[8,2],[0,11],[-7,4]],'#49667a',c);l(0,-7,0,6,hi,2);break;
      case 2:ring(-5,5,6,3);ring(6,-6,5,3);l(-4,3,6,-4,c,2);r(-4,0,2,3,hi);break;
      case 3:for(let [x,y] of [[-9,6],[9,5],[0,-9]]){o(x,y,3,3,c);r(x,y-1,1,2,hi);}l(-8,5,0,-8,c);l(0,-8,8,4,c);l(7,5,-8,6,c);break;
      case 4:ring(0,6,9,3);l(9,-11,-1,4,c,3);l(2,-10,-4,0,c);break;
      case 5:for(let i=0;i<6;i++){let a=i*TAU/6;l(0,0,Math.cos(a)*9,Math.sin(a)*9,c,2);let x=Math.cos(a)*5,y=Math.sin(a)*5;l(x,y,x+Math.cos(a+.7)*3,y+Math.sin(a+.7)*3,hi);}break;
      case 6:p([[-9,8],[-9,1],[-4,-5],[-3,0],[3,-11],[4,-1],[9,-4],[8,4],[3,9]],'#d77d53',c);r(-2,1,4,6,hi);break;
      case 7:for(let q of [-1,1]){p([[q*2,-2],[q*5,-8],[q*12,-5],[q*7,0]],'#769282',c);}o(0,3,4,6,c);r(-3,2,6,2,JOINT);break;
      case 8:ring(0,0,11,6);ring(0,0,6,10);r(-1,-1,3,3,hi);break;
      case 9: // Gravity Fold: an eclipsed core above a luminous accretion disk.
        o(0,1,12,4,'#776796');o(0,1,10,2,JOINT);
        o(0,-2,7,7,c);o(1,-1,6,6,INK);
        r(-3,-8,4,1,hi);
        l(-12,1,-7,4,c,2);l(-7,4,4,4,c,2);l(4,4,11,1,c,2);
        l(-6,4,2,4,hi);r(8,-8,2,1,c);
        break;
      case 10:p([[-9,7],[-7,-4],[-1,-11],[6,-7],[9,2],[6,8]],'#728c67',c);l(-6,2,5,-2,hi,2);break;
      case 11:for(let y of [-6,0,6]){l(-8,y+2,0,y-2,c,2);l(0,y-2,8,y+2,hi,2);}break;
    }
  }
  function sprite(kind,id,f=0,wind=false,phase=1,back=false,walking=false,flash=false,exposed=false) {
    const key=[kind,id,f,+wind,phase,+back,+walking,+flash,+exposed].join('.');
    if(cache.has(key))return cache.get(key);
    const c=document.createElement('canvas'); c.width=c.height=kind==='boss'?96:56;
    const D=pixels(c,c.width/2);
    if(kind==='suit')trooper(D,id,f,back,walking);
    else if(kind==='ability')glyph(D,id);
    else if(kind==='boss')major(D,id,f,wind,phase,exposed);
    else if(id<12)foundry(D,id,f,wind);
    else if(id<24)orchard(D,id-12,f,wind);
    else if(id<36)relay(D,id-24,f,wind);
    else fodder(D,id,f,wind);
    if(flash){const c2=c.getContext('2d');c2.globalCompositeOperation='source-atop';c2.fillStyle='rgba(255,237,190,0.55)';c2.fillRect(0,0,c.width,c.height);c2.globalCompositeOperation='source-over';}
    cache.set(key,c);return c;
  }
  function shadow(ctx,x,y,w,h,alpha=.36) {
    ctx.save();ctx.fillStyle='rgba(8,17,25,'+alpha+')';ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,TAU);ctx.fill();ctx.restore();
  }
  function place(ctx,img,x,y,scale=1,mirror=false) {
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y));ctx.scale(mirror?-scale:scale,scale);
    ctx.drawImage(img,-img.width/2,-img.height/2);ctx.restore();
  }
  function dashTrail(ctx,p,suit,color,t){
    const phase=Math.floor(t*32)%4;
    ctx.save();
    ctx.translate(Math.round(p.x),Math.round(p.y+4));
    ctx.rotate(Math.atan2(p.dashY||0,p.dashX||0));
    ctx.fillStyle=color;
    if(suit===4||suit===6||suit===9||suit===10){
      // Droplets, weave motes, ice splinters and broken plates fall away from the boots.
      for(let i=0;i<5;i++){
        const x=-8-i*3-phase,y=(i%2?1:-1)*(2+i%3);
        if(suit===4){ctx.fillRect(x,y,2,3);ctx.fillRect(x,y-1,1,1);}
        if(suit===6){ctx.fillRect(x-1,y,3,1);ctx.fillRect(x,y-1,1,3);}
        if(suit===9){ctx.fillRect(x,y,4,1);ctx.fillRect(x+2,y-2,1,4);}
        if(suit===10){ctx.fillRect(x,y-1,4,2);}
      }
    }else if(suit===1||suit===8){
      for(const side of [-1,1]){
        ctx.fillRect(-21-phase,side*4,14,1);ctx.fillRect(-26-phase,side*5,4,1);
      }
      if(suit===8)ctx.fillRect(-14,0,5,1);
    }else if(suit===2||suit===3||suit===7){
      for(const side of [-1,1]){
        ctx.fillRect(-15-phase,side*4,7,3);ctx.fillRect(-20-phase,side*5,3,1);
      }
      if(suit===3){ctx.fillStyle='#d8ffeb';ctx.fillRect(-11,0,6,1);}
      if(suit===7)ctx.fillRect(-21-phase,0,4,2);
    }else{
      for(let i=-1;i<=1;i++)ctx.fillRect(-16-phase+Math.abs(i)*3,i*4,11-Math.abs(i)*3,2);
      if(suit===5){ctx.fillStyle='#ffeed0';ctx.fillRect(-18-phase,0,10,1);}
      if(suit===11){ctx.fillRect(-20,-1,3,1);ctx.fillRect(-19,-2,1,3);}
    }
    ctx.restore();
  }
  function player(ctx,p,t=0) {
    const suit=p.skin??p.suit??0,a=p.a||0,mirror=Math.cos(a)<0,back=Math.sin(a)<-.48;
    const frame=p.moving?Math.floor(p.walkCycle||0)%4:0;
    const img=sprite('suit',suit,frame,false,1,back,p.moving,!!(p.flash>.03));
    const color=keyColor[suit]||keyColor[0],item=p.guns?.[p.ready?.[p.selected??0]??0];
    shadow(ctx,p.x,p.y+8,10,4);
    ctx.save();
    if(p.invuln>0&&p.dashTime<=0)ctx.globalAlpha*=.68+.32*Math.cos(t*45)**2;
    if(p.dashTime>0)dashTrail(ctx,p,suit,color,t);
    const handX=p.x+Math.cos(a)*7,handY=p.y+Math.sin(a)*4+1.5;
    const gun=()=>{if(item && window.Combat?.drawGun)window.Combat.drawGun(ctx,item.id,handX+Math.cos(a)*5,handY+Math.sin(a)*5,.76,a,item);};
    if(back)gun();
    place(ctx,img,p.x,p.y,1,mirror);
    const roll=p.suitRolls?.[p.suit];
    if(roll?.prefix||roll?.suffix){
      ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y)+(p.moving?frame%2:0));ctx.scale(mirror?-1:1,1);
      insignia(ctx,roll.prefix,-9,-3,SILVER);
      insignia(ctx,roll.suffix,6,-7,PARCHMENT);
      ctx.restore();
    }
    if(!back){gun();ctx.fillStyle=suitColors[suit]?.[1]||human[2];ctx.fillRect(Math.round(handX)-2,Math.round(handY)-1,4,3);}
    ctx.restore();
  }
  function enemy(ctx,e,t=0) {
    if(e.dead||e.hp<=0)return;
    const b=!!e.boss, id=e.id??0,f=Math.floor(t*(b?4.5:id>=36?12:6)+(e.serial||0))%4;
    const wind=e.windup>0,exposed=b&&(e.recover>.16||e.stagger>0);
    const img=sprite(b?'boss':'enemy',id,f,wind,b?e.phase||1:1,false,false,e.flash>.02,exposed);
    const mirror=Math.cos(e.a||0)<0;
    const hover=b?(id===3||id===4||id===6):(id===19||(id>=24&&id<36)||id===38);
    const y=e.y+(hover?Math.sin(t*3+(e.serial||0))*1.4-1:0);
    const scale=b?1.45:(e.elite?1.13:1.0);
    shadow(ctx,e.x,e.y+(b?13:id>=36?5:7),b?25:id>=36?7:id<12?11:9,b?7:3);
    ctx.save();
    if(e.arrive>0)ctx.globalAlpha*=Math.max(.48,1-e.arrive*.4);
    place(ctx,img,e.x,y,scale,mirror);
    if(e.shield>0){
      const radius=e.r+3;
      ctx.strokeStyle='#aae4dc';ctx.lineWidth=1.5;
      // Broken arcs hug the carrier and cannot be mistaken for an expanding attack ring.
      for(const side of [0,Math.PI]){
        ctx.beginPath();ctx.ellipse(e.x,y,radius,radius*.85,0,side-.55,side+.55);ctx.stroke();
      }
    }
    if(e.elite&&!b){
      const x=Math.round(e.x),ey=Math.round(y-21);
      ctx.fillStyle='#332934';ctx.fillRect(x-4,ey-2,9,4);ctx.fillStyle='#f3bd6a';
      ctx.fillRect(x-3,ey-2,2,2);ctx.fillRect(x-1,ey,3,1);ctx.fillRect(x+2,ey-2,2,2);
    }
    ctx.restore();
  }
  function portrait(ctx,kind,id,x,y,size,t=0) {
    if(kind==='gun'){window.Combat?.drawGun(ctx,id,x,y,Math.max(.25,size/40),-.12);return;}
    if(kind==='armor')kind='suit';
    if(kind==='active')kind='ability';
    const f=Math.floor(t*3)%4||0,s=sprite(kind,id||0,f);
    const native=kind==='boss'?80:kind==='ability'?26:kind==='suit'?36:38;
    place(ctx,s,x,y,size/native);
  }
  const landscapes = new Map();
  const skies = [
    ['#273e51','#8e8990','#c0a28a','#657f84','#394f60','#243e4b','#d5a477'],
    ['#22394a','#467268','#8c9676','#456c63','#364f4a','#233c3d','#d8ad72'],
    ['#423444','#895c5a','#c08868','#865e56','#53454e','#313844','#e7a56a'],
    ['#292c48','#585372','#a695a2','#66647d','#454b64','#30384f','#bc9bb2'],
    ['#121f34','#2e455e','#648190','#637f8b','#455569','#293a4d','#d0bfa0'],
    ['#173a51','#477984','#9ac1ad','#527f82','#3d666e','#254952','#a9ccb2'],
    ['#5e4c61','#bd8580','#deaf8a','#8c817a','#5a6864','#344f4e','#e9ba84'],
    ['#493b50','#9b6c6b','#dba17f','#9d7169','#665865','#433d4b','#e6aa80'],
    ['#4e5067','#8c8390','#d5b5a4','#8d8490','#666879','#414d66','#d8b8a3'],
    ['#192a45','#354e70','#8fa5b6','#5b7688','#445a70','#263d52','#c3cfcb'],
    ['#1f303a','#536759','#a49d76','#64766a','#495b54','#2a4242','#caae78']
  ];
  function landscapeCell(id) {
    id=((Number(id)||0)%11+11)%11;
    if(landscapes.has(id))return landscapes.get(id);
    const cv=document.createElement('canvas');cv.width=640;cv.height=96;
    const D=pixels(cv,0), {rect:r,line:l,oval:o,poly,plate:p}=D;
    let seed=id*36401+321791;function rand(a=1,b){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;return b===undefined?v*a:a+(b-a)*v;}
    const pal=skies[id],[zen,sky,horizon,far,stone,shadow,light]=pal;
    function mix(a,b,t){return '#'+[1,3,5].map(i=>{const a0=parseInt(a.slice(i,i+2),16),b0=parseInt(b.slice(i,i+2),16);return Math.round(a0+(b0-a0)*t).toString(16).padStart(2,'0');}).join('');}
    function grad(y1,y2,a,b){for(let y=y1;y<=y2;y++)r(0,y,640,1,mix(a,b,(y-y1)/Math.max(1,y2-y1)));}
    function curve(ax,ay,bx,by,cx,cy,c,w=1){const at=t=>[(1-t)**2*ax+2*(1-t)*t*bx+t*t*cx,(1-t)**2*ay+2*(1-t)*t*by+t*t*cy];for(let i=0;i<20;i++)l(...at(i/20),...at((i+1)/20),c,w);}
    function ridge(y,c,amp,n=14){let v=[];for(let i=0;i<=n+1;i++)v.push([i*640/n,y+rand(-amp,amp)]);poly([...v,[675,98],[-5,98]],c);return v;}
    function litCity(x1,x2,y,minh,maxh,c){let x=x1;while(x<x2){const w=Math.floor(rand(5,18)),h=rand(minh,maxh);r(x,y-h,w,h+2,c);if(rand()>.55){r(x+2,y-h-3,w*.4,3,c);r(x+3,y-h-6,1,5,c);}l(x+1,y-h,x+w-2,y-h,mix(c,horizon,.32));if(w>6&&rand()>.48)r(x+2,y-h+3,w*.45,1,mix(c,light,.63));x+=w+rand(-2,3);}}
    function specks(y1,y2,n,c,streak=1){for(let i=0;i<n;i++)r(rand(641),rand(y1,y2),rand(1,streak),1,c);}
    grad(0,43,zen,sky);grad(44,88,sky,horizon);grad(89,95,far,shadow);
    if([0,6,8,9].includes(id)){const x=[0,6,8,9].indexOf(id),cx=[149,433,178,423][x],cy=[37,43,33,29][x],rr=[14,20,14,11][x];o(cx,cy,rr,rr,mix(horizon,light,.5));o(cx+1,cy,rr-2,rr-2,light);}
    if(![4,5,10].includes(id)){for(let i=0;i<70;i++){let x=rand(-24,640),y=rand(3,54),w=rand(4,39),v=rand(1,4);poly([[x,y],[x+w*.22,y-1],[x+w*.4,y-1],[x+w*.61,y-v],[x+w*.87,y-v+1],[x+w,y],[x+w*.4,y+1]],mix(sky,far,rand(.2,.75)));}}
    if(id===0){
      ridge(61,mix(far,horizon,.4),5,32);litCity(-3,650,67,3,11,far);
      grad(66,95,mix(far,horizon,.34),stone);specks(69,92,270,mix(far,horizon,.5),13);
      // Container ships, modular hangars and a lifting bridge with loaded cranes.
      for(const [x,w] of [[15,81],[421,63]]){poly([[x,65],[x+8,62],[x+16,61],[x+25,57],[x+w*.66,58],[x+w*.72,62],[x+w,59],[x+w-9,67],[x+5,69]],stone);l(x+3,66,x+w-5,63,mix(stone,light,.42));r(x+25,56,8,3,stone);}
      function crane(x,y,s,main,hi){const L=(a,b,cc,d,w=1)=>l(x+a*s,y+b*s,x+cc*s,y+d*s,main,Math.max(1,Math.round(w*s)));L(-7,0,-3,-37,5);L(14,0,0,-19,3);L(-19,0,-1,-20,3);L(0,-36,43,-46,3);L(-15,-27,47,-42,3);for(let j=0;j<6;j++)L(j*7-1,-34-j*1.6,j*7+5,-32-j*1.6,2);L(0,-37,2,-46,2);L(2,-46,42,-46);L(34,-41,34,-18);L(39,-42,39,-18);r(x+29*s,y-17*s,16*s,6*s,main);l(x-3*s,y-35*s,x+43*s,y-46*s,hi);}
      for(const [x,y,s] of [[87,70,.85],[264,68,1.16],[491,68,.87],[571,70,.98]])crane(x,y,s,stone,mix(stone,horizon,.5));
      for(const [a,b,y] of [[0,225,75],[375,641,78]]){r(a,y,b-a,4,shadow);r(a,y,b-a,1,mix(stone,horizon,.35));for(let x=a+11;x<b;x+=23){r(x,y+3,2,16,stone);l(x,y+10,x+9,y+3,stone);}}
      for(const [x,y] of [[193,70],[395,74],[420,73],[625,72]]){r(x,y-5,12,5,stone);r(x+1,y-6,9,1,mix(stone,light,.5));for(let j=0;j<3;j++)r(x+2+j*3,y-4,1,3,shadow);}
    }else if(id===1||id===6){
      ridge(56,far,6,38);ridge(68,stone,11,29);grad(67,95,mix(far,sky,.65),shadow);specks(69,92,250,mix(far,horizon,.35),8);
      // Vertebral arches follow the beds. Each separate rib has a scalloped edge and a suspended amber pod.
      for(let j=0;j<2;j++){const y=64+j*20;for(let i=0;i<(j?6:11);i++){const x=i*(j?126:65)+(j?-24:12)+rand(-11,11),rad=(j?40:25)+rand(-4,8),height=(j?59:40)+rand(-7,8);const bark=j?shadow:stone,edge=j?mix(stone,light,.42):far;
        curve(x-rad,y,x-rad*.75,y-height*.86,x+1,y-height,bark,j?6:3);curve(x+1,y-height,x+rad*.76,y-height*.69,x+rad,y-2,bark,j?5:3);
        curve(x-rad+1,y-2,x-rad*.75+1,y-height*.86,x+1,y-height+1,edge,j?2:1);
        for(let k=0;k<5;k++){let xx=x-rad*.63+k*(rad*.28),cy=y-height+Math.abs(k-2)*5;l(xx,cy+2,xx+2,cy+6,edge);}
        let px=x+rad*.48,py=y-height*.65,ray=rand(6,11);curve(px,py,px+3,py+7,px-1,py+ray,bark,2);o(px-1,py+ray+3,j?5:3,j?7:4,bark);o(px-1,py+ray+3,j?3:2,j?5:3,j?light:mix(far,light,.5));if(j)l(px-2,py+ray+1,px-3,py+ray+4,mix(light,horizon,.6));}}
      if(id===6)for(let i=0;i<4;i++){const x=76+i*153,y=68;curve(x-26,y,x-27,y-57,x,y-56,stone,2);curve(x,y-56,x+25,y-53,x+27,y,stone,2);l(x-26,y-20,x+24,y-20,far);l(x,y-56,x,y,stone);r(x-30,y,60,3,shadow);}
    }else if(id===2||id===7){
      ridge(60,far,8,31);litCity(-4,650,63,3,16,far);r(0,65,640,31,stone);
      for(let i=0;i<16;i++){let x=i*43+rand(-8,9),h=rand(14,35);r(x,72-h,10,h,stone);r(x-2,71-h,14,4,mix(stone,far,.5));r(x+2,70-h,7,1,light);for(let j=0;j<4;j++)o(x+4+j*5,66-h-j*3,4+j*2,2+j/2,mix(sky,far,.5));}
      for(let i=0;i<4;i++){let y=71+i*6;curve(-30,y,180,y-15,665,y+2,i%2?shadow:light,i%2?4:2);}
      for(let i=0;i<5;i++){let x=39+i*144,y=15+(i%2)*9;const w=id===7?18:25;r(x-w,1,w*2,5,shadow);for(let j of [-1,1]){r(x+j*w-2,4,5,y+5,stone);r(x+j*w,4,1,y+4,far);}poly([[x-w-4,y+3],[x-w+2,y],[x+w,y],[x+w+5,y+5],[x+w-1,y+14],[x-w+1,y+14]],shadow);r(x-w+2,y+2,w*2-3,2,far);for(let j=0;j<4;j++){r(x-w+4+j*9,y+6,5,3,stone);r(x-w+3+j*9,y+13,4,8,far);}
        poly([[x-w+3,y+22],[x-w+7,y+18],[x+w-6,y+18],[x+w-2,y+22],[x+w-2,y+27],[x-w+3,y+27]],stone);r(x-w+4,y+25,w*2-6,2,light);
        r(x-w-6,76,w*2+11,6,shadow);r(x-w-5,75,w*2+9,2,mix(far,light,.7));}
      if(id===7){for(let x=0;x<640;x+=57){l(x,65,x+19,50,stone,2);l(x+19,50,x+38,65,stone,2);}r(0,63,640,3,shadow);}
      specks(41,79,33,mix(far,light,.55),2);
    }else if(id===3||id===8){
      specks(0,39,94,mix(sky,horizon,.5));ridge(60,mix(sky,horizon,.55),7,32);ridge(73,far,12,30);ridge(87,stone,6,48);
      for(let i=0;i<90;i++){let x=rand(0,640),y=rand(72,93);l(x,y,x+rand(2,9),y-1,mix(stone,far,.6));}
      function dish(x,y,s,co,edge){const pt=(a,b)=>[x+a*s,y+b*s],L=(a,b,c,d,col,w=1)=>l(...pt(a,b),...pt(c,d),col,Math.max(1,Math.round(w*s)));
        poly([pt(-13,0),pt(-6,-3),pt(0,-25),pt(6,-26),pt(16,-2),pt(23,0),pt(19,3),pt(-14,3)],co);
        L(2,-22,13,-3,edge);L(0,-13,7,-8,edge);poly([pt(-38,-46),pt(-17,-38),pt(4,-34),pt(28,-37),pt(45,-44),pt(33,-30),pt(17,-21),pt(5,-18),pt(-9,-22),pt(-27,-33)],co);
        curve(...pt(-37,-45),...pt(1,-23),...pt(44,-44),edge,Math.ceil(s));for(let j=-2;j<=2;j++){let a=j*13;L(a,-34-Math.abs(j)*3,6,-20,edge);}
        L(4,-33,10,-53,co,2);L(-29,-41,10,-53,edge);L(10,-53,34,-40,edge);r(x+8*s,y-55*s,5*s,2*s,light);}
      for(let [x,y,s] of [[94,65,.66],[296,67,.82],[555,65,.74],[179,85,1.17],[458,85,1.37]])dish(x+(id===8?37:0),y,s,s<1?far:shadow,s<1?mix(far,horizon,.45):mix(stone,far,.7));
      for(let i=0;i<13;i++){let x=rand(641),y=rand(80,92),h=rand(2,9);poly([[x-3,y],[x,y-h],[x+2,y-2],[x+4,y-4],[x+5,y]],stone);l(x,y-h+1,x+1,y-1,far);}
    }else if(id===4||id===9){
      grad(0,95,zen,stone);specks(0,81,165,mix(sky,horizon,.68));specks(0,65,18,mix(light,horizon,.7),2);
      // The cloud-banded limb of a planet curves across the entire width.
      for(let x=0;x<640;x++){let y=Math.round(21+.00022*(x-390)**2+(id===9?12:0));r(x,y,1,97-y,mix(far,sky,.5));r(x,y,1,1,mix(horizon,light,.7));r(x,y+1,1,2,horizon);}
      for(let i=0;i<122;i++){let x=rand(0,639),ySurface=24+.00022*(x-390)**2+(id===9?12:0),y=rand(ySurface,96),w=rand(4,38);if(y>95)continue;curve(x,y,x+w*.4,y-2,x+w,y-1,i%3===0?far:mix(far,horizon,.35),1+((i%6)===0));}
      // Pixelated ring sections, assembled from individual plates; gaps reveal the planet below.
      for(let j=0;j<69;j++){const a=-3.03+j*.043;if(j%14>10||j===26||j===42)continue;const cx=345,cy=124,rx=325,ry=104;const at=(ar,ra,rb)=>[cx+Math.cos(ar)*ra,cy+Math.sin(ar)*rb];let q=[at(a,rx,ry),at(a+.04,rx,ry),at(a+.04,rx-10,ry-7),at(a,rx-10,ry-7)];poly(q,stone);l(...q[0],...q[1],j%4?mix(far,light,.65):light,2);l(...q[2],...q[3],shadow,2);if(j%4===0){const [bx,by]=q[2];r(bx,by,2,3,light);}}
      if(id===9){for(let i=0;i<4;i++){let x=25+i*165;poly([[x,86],[x+4,46],[x+14,41],[x+27,44],[x+31,85]],shadow);l(x+6,46,x+14,41,far,2);l(x+8,49,x+24,50,light);r(x+10,54,13,27,stone);}}
    }else if(id===5){
      grad(0,95,sky,zen);for(let i=0;i<9;i++){let x=45+i*75;poly([[x,0],[x+7,0],[x-24,56],[x-44,79]],mix(sky,far,.5));}
      ridge(68,far,17,26);ridge(83,stone,11,42);
      for(let i=0;i<49;i++){let x=rand(0,640),y=rand(46,77);curve(x,y+12,x-4,y+2,x+rand(-4,4),y-5,far,2);}
      for(let i=0;i<9;i++){let x=i*84;r(x,-1,7,99,shadow);r(x+1,5,2,79,stone);l(x+4,89,x+13,80,stone,2);l(x+2,8,x+11,15,far,2);}r(0,81,640,5,shadow);r(0,81,640,1,far);
      specks(4,73,58,mix(sky,horizon,.40));
    }else{
      grad(0,96,zen,far);for(let i=0;i<8;i++){let x=10+i*85;curve(x,10,x-4,26,x+24,36,stone,3);r(x-4,-4,5,17,stone);r(x+17,34,14,4,shadow);}
      for(let i=0;i<6;i++){let x=28+i*116;poly([[x-20,75],[x-20,32],[x-14,22],[x+12,22],[x+20,30],[x+20,77],[x+12,83],[x-13,83]],shadow);r(x-16,31,32,38,far);o(x,30,15,6,stone);r(x-13,38,26,23,mix(far,light,.6));r(x-9,41,5,16,light);for(let k=0;k<3;k++){r(x-19,38+k*14,38,3,stone);r(x-17,38+k*14,33,1,mix(far,light,.4));}r(x-6,14,10,9,stone);l(x-2,13,x+2,1,shadow,3);r(x-15,81,28,5,shadow);}
      for(let k=0;k<2;k++)curve(-5,70+k*4,180,58,640,77+k*4,shadow,2);
    }
    landscapes.set(id,cv);return cv;
  }
  function landscape(ctx,id,x,y,w,h){
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(landscapeCell(id),x,y,w,h);ctx.restore();
  }
  function vista(ctx,id,w,h) {
    const edge=Math.round(h*.144);
    landscape(ctx,id,0,0,w,edge);
    const shade=ctx.createLinearGradient(0,edge*.54,0,edge);shade.addColorStop(0,'rgba(14,28,37,0)');shade.addColorStop(1,'rgba(14,28,37,.24)');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,edge);
  }
  window.Art={player,enemy,portrait,vista,landscape};
})();
