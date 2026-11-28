/* Cinder Relay armory. Guns are painted once at native pixel size and shared
   by troopers, crew mates, the equipment rack and the field manual. */
(() => {
  'use strict';
  const width=52,height=32,ox=25,oy=16;
  const ink='#14202b',steel='#788e97',silver='#c8d2c5',brass='#b18753',bone='#d7c8a9';
  const cast='#445565',charcoal='#303844',copper='#a5684e',bark='#88694e',violet='#8d7fa4';
  const cells=[];
  // Native muzzle positions; the mortar actually vents upward from its sloping barrel.
  const muzzle=[[17,-1],[12,-2],[16,-1],[17,-2],[14,0],[16,0],
    [15,0],[13,-1],[14,-1],[14,0],[15,0],[14,-1],
    [19,0],[19,-2],[18,0],[15,-1],[18,-2],[16,-2],
    [10,-8],[12,0],[14,-1],[13,-2],[16,0],[14,1],
    [16,0],[11,0],[12,-1],[12,0],[14,0],[16,0],
    [12,0],[15,0],[15,0],[12,0],[10,-1],[13,0],
    [19,-1],[14,-1],[15,0],[11,-8],[12,-1],[14,0],[13,0]];

  const creatureMuzzle={catLauncher:30,unicornSniper:36,unicornStream:28,rainbowLaser:30,rainbowExploder:33};
  const forgeMuzzle={starbreaker:[22,0],'red-dwarf':[19,0],thunderhead:[19,0],
    'winter-crown':[17,0],'seraph-foundry':[20,0],'god-gun':[22,0]};

  function drawCreatureGun(ctx,def,x,y,scale,angle,item){
    const art=window.CinderCreatureArt;
    if(!art)return;
    const key=art.artId(def.creatureId), size=scale*.64;
    const firing=item?.flash>0, mx=creatureMuzzle[key];
    const recoil=firing&&mx?1.5*scale:0;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.translate(Math.round(x)-Math.cos(angle)*recoil,Math.round(y)-Math.sin(angle)*recoil);
    art.drawGear(ctx,key,0,0,size,angle);
    ctx.rotate(angle);ctx.scale(size,Math.cos(angle)<0?-size:size);
    if(item?.prefix){ctx.fillStyle='#93ddbc';ctx.fillRect(-10,2,3,2);}
    if(item?.suffix){ctx.fillStyle='#d1aedb';ctx.fillRect(-6,2,2,2);}
    if(firing&&mx){
      ctx.fillStyle=def.color;ctx.fillRect(mx,-2,6,4);
      ctx.fillStyle='#fff7dc';ctx.fillRect(mx+1,-1,9,2);
      ctx.fillRect(mx+3,-4,2,8);
    }
    ctx.restore();
  }

  function bake(id,accent){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d');c.translate(ox,oy);
    function rect(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
    function line(x,y,ex,ey,color,thick=1){
      const n=Math.max(1,Math.abs(ex-x),Math.abs(ey-y));
      for(let i=0;i<=n;i++)rect(Math.round(x+(ex-x)*i/n),Math.round(y+(ey-y)*i/n),thick,thick,color);
    }
    function fill(points,color){
      const ys=points.map(v=>v[1]),lo=Math.min(...ys),hi=Math.max(...ys);
      for(let y=lo;y<hi;y++){
        const cuts=[];
        for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];
          if((a[1]<=y&&y<b[1])||(b[1]<=y&&y<a[1]))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cuts.sort((a,b)=>a-b);
        for(let j=0;j+1<cuts.length;j+=2)rect(Math.ceil(cuts[j]),y,Math.floor(cuts[j+1])-Math.ceil(cuts[j])+1,1,color);
      }
    }
    function plate(p,color,edge=silver){
      fill(p,color);
      for(let k=0;k<p.length;k++)line(...p[k],...p[(k+1)%p.length],ink);
      line(p[0][0],p[0][1]+1,p[1][0],p[1][1]+1,edge);
    }
    function block(x,y,w,h,color,edge=silver){
      rect(x,y,w,h,ink);rect(x+1,y+1,w-2,h-2,color);rect(x+1,y+1,w-2,1,edge);
    }
    function ellipse(x,y,rx,ry,color){
      for(let row=-ry;row<=ry;row++){const dx=Math.round(rx*Math.sqrt(1-(row/ry)**2));rect(x-dx,y+row,2*dx+1,1,color);}
    }
    function drum(x,y,rx,ry,color,edge=silver){
      ellipse(x,y,rx,ry,ink);ellipse(x,y,rx-1,ry-1,color);line(x-1,y-ry+1,x+1,y-ry+1,edge);
    }
    function stock(long,drop=3,color=cast){
      plate([[-long,-2],[-long+5,-3],[-6,-2],[-5,1],[-long+5,2],[-long+2,drop],[-long,drop]],color);
    }
    function grip(x,y=1,color=cast){
      plate([[x,y],[x+5,y],[x+3,y+6],[x-1,y+6],[x+1,y+2]],color);
    }
    function vents(x,y,n,color,space=3){for(let k=0;k<n;k++)rect(x+k*space,y,1,2,color);}
    function tube(x,y,w,h,color,edge=silver){block(x,y,w,h,color,edge);}
    switch(id){
      case 0: // Linebreaker: carrying handle, straight box magazine, long gas block.
        stock(17,4);grip(-7);plate([[-11,-3],[-7,-5],[3,-5],[7,-3],[7,2],[-9,3]],steel);
        block(-1,1,6,7,cast);tube(6,-3,13,4,cast);block(2,-5,9,4,steel);
        rect(-5,-7,4,2,ink);rect(-4,-7,2,1,accent);vents(3,-3,3,ink);break;
      case 1: // Sable Burst: compact rear magazine and low suppressor.
        grip(0,1);plate([[-15,-3],[-11,-6],[-3,-6],[3,-3],[6,-2],[5,2],[-11,3],[-15,1]],charcoal,'#89959b');
        plate([[-12,1],[-6,1],[-5,6],[-10,6]],cast);tube(4,-3,10,4,cast);
        for(let k=0;k<3;k++)rect(-10+k*3,-3,2,1,accent);break;
      case 2: // Thornwheel: a seeded drum, curved bone stock and a living spike.
        stock(16,4,bone);grip(-6,2,bark);plate([[0,-2],[7,-4],[13,-3],[16,-1],[8,1],[0,3]],'#68785b',bone);
        drum(-2,-1,7,7,'#758957',bone);drum(-2,-1,4,4,cast);
        for(const [x,y] of [[-3,-6],[1,-3],[-1,2],[-6,0]])rect(x,y,2,2,accent);
        line(8,-2,16,-1,bone);break;
      case 3: // Prism Carbine: a long faceted chamber between square copper terminals.
        stock(13);grip(-6,2);block(-10,-3,8,7,cast);tube(12,-3,7,3,steel);
        plate([[-4,-2],[0,-6],[10,-6],[15,-2],[10,2],[-1,2]],violet,'#eee1ff');
        fill([[-1,-2],[2,-5],[10,-5],[6,-2]],accent);line(2,0,9,-2,'#d7f0fb');block(-5,-4,3,8,brass);break;
      case 4: // Ratchet AR: offset brass wheel, manual crank, and short perforated muzzle.
        stock(15,3,brass);grip(-6,1);tube(-8,-4,19,7,cast);block(7,-3,9,6,brass);
        drum(-1,2,6,6,brass,'#ffe2a0');drum(-1,2,3,3,cast);line(-1,2,3,6,accent,2);
        rect(3,6,4,2,ink);rect(5,6,2,1,silver);vents(8,-1,3,ink,2);break;
      case 5: // Duplex Repeater: separate color-coded muzzle paths and twin feed boxes.
        stock(14);grip(-5,2);for(const [y,c0] of [[-5,'#8cd9f2'],[1,'#f08a70']]){
          block(-8,y,19,5,steel);tube(9,y+1,9,3,cast);rect(-5,y+2,12,1,c0);
        }break;
      case 6: // Rivet Jaw: two heavy toothed jaws with a round hinge.
        stock(13,4);grip(-7,1);drum(-4,0,5,5,steel);
        for(const side of [-1,1]){plate([[-2,side],[3,side*5],[13,side*6],[16,side*3],[14,side*2],[5,side*3]],steel);
          for(const j of [5,10])rect(j,side>0?2:-3,2,2,brass);}
        rect(-5,-1,3,2,accent);break;
      case 7: // Furnace Vent: top chimney, copper radiator and a ceramic nozzle.
        stock(12);grip(-7,1);block(-4,-9,5,7,copper);block(-8,-4,18,9,copper,'#edb187');
        plate([[7,-4],[12,-5],[15,-3],[15,2],[12,4],[7,3]],'#995f49');
        for(let k=0;k<4;k++){rect(-6+k*3,-1,2,4,ink);rect(-6+k*3,-1,1,3,accent);}rect(12,-2,2,4,'#ffba7c');break;
      case 8: // Glass Choir: a crown of separate white-violet quartz tines.
        stock(12,3,bone);grip(-6,1);plate([[-8,-2],[-3,-4],[6,-2],[14,0],[13,4],[-5,4]],violet);
        for(const [x,tip] of [[-3,-6],[1,-10],[5,-8],[9,-6]]){
          plate([[x-1,0],[x,tip+2],[x+2,tip],[x+3,-2],[x+2,1]],accent,'#f7f1ff');}
        line(3,1,13,1,silver);break;
      case 9: // Maw Pump: open green throat over a broad sliding brass fore-end.
        stock(15,5,bark);grip(-9,2,bark);tube(-10,-4,22,7,'#6d8360');
        plate([[3,-3],[9,-5],[13,-4],[15,-1],[13,2],[6,0]],'#778953',bone);
        line(5,-2,12,-2,accent);line(-5,4,12,4,silver);block(-1,2,10,5,brass);vents(1,4,3,ink);break;
      case 10: // Shear Door: widely spaced squared brackets, empty muzzle center.
        stock(12);grip(-6);block(-7,-4,8,8,steel);
        for(const q of [-1,1]){block(-1,q>0?3:-7,18,4,steel);rect(13,q>0?2:-5,3,3,accent);}
        break;
      case 11: // Kiln Brake: flared ceramic bell with ribbed mechanical collar.
        stock(13);grip(-8);tube(-9,-3,11,6,cast);
        plate([[-1,-4],[4,-4],[8,-6],[14,-7],[16,-4],[16,3],[13,6],[6,4],[-1,4]],'#988b9a',bone);
        for(const k of [1,4,7]){rect(k,-3,2,7,ink);rect(k,-3,1,6,accent);}rect(13,-4,2,8,cast);break;
      case 12: // Rail Spike: two long parallel rails and three rear charge lamps.
        stock(16,4);grip(-8);block(-10,-4,12,8,steel);
        for(const y of [-5,2]){tube(0,y,21,4,steel);rect(2,y+1,15,1,accent);}vents(-8,-2,3,accent);
        break;
      case 13: // Horizon Nail: long olive barrel, exposed golden feed tube below.
        stock(18,3,'#7c8067');grip(-9);plate([[-12,-4],[-1,-5],[6,-3],[4,1],[-11,2]],'#7c876a');
        tube(3,-4,18,3,'#747f6e');line(1,1,17,1,brass);rect(1,0,2,3,ink);rect(14,0,2,3,ink);rect(-6,-4,3,1,accent);break;
      case 14: // Rift Needle: two floating violet magnetic rings around a pencil-thin barrel.
        stock(14,4,charcoal);grip(-7);block(-9,-3,10,6,charcoal);tube(0,-1,20,3,charcoal);
        for(const [x,h] of [[3,6],[11,5]]){block(x-2,-h,5,2*h+1,violet);rect(x,-h+2,1,2*h-3,accent);}
        break;
      case 15: // Surveyor: folding fork antenna and optics over a straight marksman's receiver.
        stock(14);grip(-6);block(-9,-3,14,6,steel);tube(4,-2,13,3,steel);
        block(-6,-6,8,3,cast);line(0,-6,3,-11,silver,2);line(3,-11,7,-9,accent);line(0,-6,-3,-9,accent);
        break;
      case 16: // Corner Pin: a long nested silver stake mounted on a folding bipod.
        stock(13);grip(-9);tube(-9,-4,19,6,steel);tube(7,-3,8,4,cast);tube(13,-3,7,3,silver);
        line(4,1,1,8,ink,2);line(4,1,8,7,silver,2);rect(0,8,4,2,cast);rect(8,7,3,2,cast);rect(-7,-3,2,1,accent);break;
      case 17: // Redress Rifle: a hanging red lever under five individual breech chambers.
        stock(17,4,bark);grip(-9,1,bark);block(-9,-5,18,7,copper);tube(8,-3,10,4,steel);
        for(let k=0;k<5;k++)rect(-7+k*3,-3,2,3,k%2?brass:bone);
        line(-4,2,-2,7,accent,2);line(-2,7,5,6,accent,2);line(5,6,7,2,accent);break;
      case 18: // Drum Mortar: angled tube, breech drum and a shoulder pad.
        stock(12,5);grip(-7);plate([[-3,1],[0,-5],[8,-10],[12,-8],[11,-3],[3,4]],steel);
        drum(-2,3,6,6,copper);drum(-2,3,3,3,cast);rect(-3,2,3,1,brass);line(6,-7,10,-9,accent,2);break;
      case 19: // Cinder Cluster: four exposed, independently collared shell cups.
        stock(13,4);grip(-7);plate([[-8,-3],[-2,-6],[9,-7],[14,-3],[14,5],[5,7],[-6,4]],copper);
        for(const [x,y] of [[2,-3],[9,-4],[2,3],[9,2]]){drum(x,y,3,3,brass);ellipse(x+1,y,1,1,accent);}break;
      case 20: // Anchor Cannon: heavy hoops enclose a deep, nearly black field core.
        stock(14,4);grip(-8);tube(-10,-3,25,6,charcoal);drum(3,0,6,5,'#303146');
        for(const [x,h] of [[-2,8],[8,7]]){plate([[x-2,-h],[x+1,-h],[x+3,-h+3],[x+3,h-3],[x,h],[x-3,h-2]],'#646479',silver);rect(x,-h+2,1,2*h-4,accent);}
        break;
      case 21: // Seedpod Lobber: a fleshy pod bound in three curved wooden ribs.
        stock(13,4,bark);grip(-7,2,bark);drum(2,-1,10,7,'#8f8465',bone);
        fill([[-4,0],[2,-6],[7,-4],[10,-1],[4,3],[-1,3]],'#b57e67');
        for(const x of [-4,1,6]){line(x-2,-4,x,-7,bark,2);line(x,-7,x+3,-4,bone);line(x+3,-4,x+1,4,bark,2);}
        plate([[8,-3],[13,-5],[15,-3],[11,0]],'#7f9560',accent);break;
      case 22: // Knucklebone: a chalk-white load between narrow low-slung forks.
        stock(15,4);grip(-8);block(-9,-3,12,6,'#8d8675');
        for(const q of [-1,1])plate([[1,q],[3,q*4],[16,q*5],[17,q*3],[7,q*2]],'#9a927d',bone);
        drum(8,0,4,3,bone,'#fff5dc');line(7,-1,10,0,silver);break;
      case 23: // Fuse Stitcher: a high staple carriage and a dangling belt of brass primers.
        stock(12);grip(-8);block(-8,-5,7,10,cast);block(-3,-7,18,4,brass);block(11,-5,5,9,steel);
        tube(-3,0,18,4,cast);for(let j=0;j<5;j++)block(-9+j*3,3+Math.min(j,4-j),4,4,j%2?brass:copper);rect(13,0,2,2,accent);break;
      case 24: // Volt Arc: a brass tuning fork with separated contacts.
        stock(12);grip(-6);drum(-3,0,5,5,brass);tube(-1,-2,7,5,copper);
        for(const q of [-1,1]){line(3,0,6,q*5,ink,3);line(5,q*5,15,q*5,ink,3);line(4,0,7,q*5,brass,2);line(6,q*5,15,q*5,brass,2);rect(14,q*5,3,2,accent);}break;
      case 25: // Sunspool: a round heat exchanger surrounding an amber solar lens.
        stock(12,4,brass);grip(-7);tube(7,-2,7,4,brass);drum(1,-1,8,8,copper,'#ffe1a8');
        drum(1,-1,6,6,brass);drum(1,-1,4,4,accent);rect(0,-3,3,3,'#fff1ab');
        for(const x of [-11,-8])rect(x,-5,2,4,brass);break;
      case 26: // Frost Fan: two pale fan nacelles above an icy intake.
        stock(12);grip(-6);plate([[-9,-2],[-4,-5],[6,-5],[14,-2],[14,3],[6,6],[-9,4]],'#91acac');
        for(const [x,y] of [[-1,-3],[7,1]]){drum(x,y,4,4,steel);line(x-2,y-1,x+2,y+1,accent);line(x+1,y-2,x-1,y+2,silver);}
        break;
      case 27: // Phase Disc: open-sided crescent carriage around a slim violet cutting wheel.
        grip(-6);plate([[-14,-2],[-9,-4],[-4,-3],[-1,1],[-3,3],[-12,2]],cast);
        drum(3,-1,8,7,violet,'#dec7f7');drum(3,-1,5,4,charcoal);
        line(-1,-2,3,-5,accent,2);line(3,-5,7,-3,accent,2);rect(3,-2,2,2,silver);tube(7,0,7,3,violet);break;
      case 28: // Sweep Lantern: fan-like dark reflector wings cup an exposed bulb.
        stock(11,3);grip(-6);block(-8,-3,11,6,steel);drum(5,0,4,4,accent);
        for(const q of [-1,1])plate([[0,q*3],[4,q*5],[14,q*8],[12,q*4],[6,q*2]],'#72928c',silver);
        rect(5,-2,2,3,'#dcffeb');break;
      case 29: // Crossfield: two squared U-shaped coils angle inward across a dark gap.
        stock(13,4);grip(-7);tube(-9,-3,14,6,charcoal);
        for(const q of [-1,1]){line(0,q*2,2,q*7,steel,3);line(2,q*7,11,q*7,steel,3);line(11,q*7,15,q*3,steel,3);
          line(3,q*6,10,q*6,accent);line(11,q*6,15,q*2,accent);}
        break;
      case 30: // Wasp Foundry: winged bronze cage with the striped wasp inside.
        stock(12,3,brass);grip(-6);tube(-9,-3,22,6,brass);block(-5,-5,15,10,'#5d5744',bone);
        for(const q of [-1,1])plate([[0,0],[q*5,-8],[q*8,-9],[q*7,-5],[q*2,-1]],'#919583',bone);
        drum(3,0,4,3,accent);rect(2,-2,1,5,ink);rect(5,-1,1,3,ink);vents(-4,-2,2,brass);break;
      case 31: // Hive Needle: thick honeycomb body, bone pistol grip and a long thin stinger.
        grip(-4,3,bone);plate([[-11,-2],[-6,-8],[3,-8],[8,-3],[7,3],[1,6],[-8,4]],'#84926b',bone);
        for(const [x,y] of [[-5,-3],[0,-4],[-2,1],[3,0]]){ellipse(x,y,2,2,ink);rect(x-1,y-1,2,1,accent);}
        tube(7,-1,10,3,bone);break;
      case 32: // Remora Caster: recurved clamp arms project beyond the pink pilot capsule.
        stock(12,4);grip(-7);tube(-7,-2,12,5,violet);
        for(const q of [-1,1])plate([[0,q*2],[5,q*5],[13,q*5],[16,q*2],[11,q*3],[5,q*3]],'#97848c',bone);
        drum(3,0,3,2,accent);break;
      case 33: // Fossil Engine: ivory skull, hollow eye socket, individual teeth, crank wheel.
        stock(12,5,bark);grip(-7);drum(-5,3,5,5,brass);rect(-6,2,3,2,ink);
        plate([[-6,-2],[-2,-7],[4,-8],[9,-5],[13,-3],[13,1],[8,3],[0,2],[-5,0]],bone,'#f3e7c6');
        ellipse(3,-3,3,2,cast);rect(10,-2,2,1,ink);for(const x of [4,7,10])rect(x,2,2,3,bone);
        break;
      case 34: // Lantern Tick: a curled iron carrying loop surrounds a luminous hanging tick.
        stock(12,3,bark);grip(-8);block(-8,-2,11,6,cast);drum(3,-1,7,8,brass);
        ellipse(3,-1,5,6,ink);line(0,-6,4,-5,brass);line(4,-5,4,-2,silver);drum(3,1,3,4,accent);
        for(const q of [-1,1])line(3+q*2,2,3+q*5,4,brass);break;
      case 35: // Husk Loom: two rose-colored spools on the tips of the recurved bow frame.
        stock(11,4,bark);grip(-6);tube(-8,-2,17,5,bark);
        for(const q of [-1,1]){plate([[-1,q*2],[4,q*5],[9,q*9],[12,q*7],[9,q*3],[4,q]],bark,bone);
          drum(9,q*7,3,3,violet);rect(8,q*7,3,1,accent);}
        line(12,-6,12,6,'#deb6b8');rect(10,-1,4,2,bone);break;
      case 36: // Suture Carbine: ceramic needle housing and a suspended glass repair ampoule.
        stock(16,3,'#687f79');grip(-9,1);
        plate([[-11,-4],[-5,-6],[4,-6],[9,-3],[9,1],[4,3],[-7,2]],'#c7d9c9','#f1f4dc');
        tube(7,-3,7,5,steel);line(13,-1,19,-1,'#c0e4d5');rect(17,-1,3,1,accent);
        plate([[-5,1],[2,1],[3,5],[1,9],[-3,10],[-6,7]],'#486b67','#b7e8d6');
        fill([[-4,4],[1,4],[1,7],[-2,8],[-4,7]],accent);rect(-4,3,1,3,'#e8fff2');
        rect(-6,-4,7,2,'#477e75');rect(-5,-4,4,1,accent);break;
      case 37: // Switchyard Driver: a conductor bridge spans two blue ceramic insulators.
        stock(14,4,brass);grip(-7,2);tube(-9,-2,24,6,cast);
        plate([[-9,-3],[-7,-5],[8,-5],[11,-2],[8,3],[-8,3]],'#b78944','#ffe096');
        for(const [x,h] of [[-5,9],[5,11]]){
          block(x-2,-h,5,h-2,'#4892ad','#c4f1eb');
          rect(x-3,-h+3,7,2,steel);rect(x-3,-h+3,6,1,'#a8def2');
        }
        line(-5,-10,5,-12,ink,2);line(-5,-10,5,-12,accent);
        rect(-6,-1,12,2,cast);vents(-5,-1,4,accent);rect(13,-1,2,1,'#b8ebff');break;
      case 38: // Bulwark Repeater: overlapping shield plates flank a bright central bore.
        stock(15,3,cast);grip(-7,2);tube(-7,-2,24,6,'#4a798b');
        plate([[-7,-5],[2,-9],[9,-8],[13,-4],[10,-1],[1,-1],[-5,1]],'#438ca0','#b9f4ed');
        plate([[-6,0],[2,-2],[11,-2],[10,3],[4,8],[-2,7]],'#386d83','#84c5cc');
        line(-4,-4,2,-6,accent,2);line(3,-6,8,-6,accent,2);
        line(6,2,3,5,'#9adfdd');rect(13,0,4,2,accent);break;
      case 39: // Lifeboat Mortar: a cream flotation collar around the orange rescue shell.
        stock(15,5,'#84665a');grip(-8,3);drum(-5,3,5,5,copper,bone);
        plate([[-6,1],[-3,-6],[4,-11],[9,-11],[13,-8],[13,-4],[7,2],[-1,6]],'#cf855a','#fff0c8');
        plate([[0,-6],[4,-10],[8,-10],[10,-8],[6,-4],[2,-3]],'#e9d4aa','#fff4d2');
        line(3,-5,8,-10,accent,2);line(-3,-1,2,3,'#f3dfbd',2);
        block(-6,3,7,4,cast);rect(-4,4,3,1,'#ffd595');break;
      case 40: // Honeycomb Harvester: open wax cells spill around a dark honey valve.
        grip(-6,2,bark);stock(13,3,bark);
        plate([[-9,-3],[-6,-7],[1,-8],[9,-5],[13,0],[8,4],[-2,5],[-9,2]],'#967344',bone);
        for(const [x,y] of [[-5,-3],[1,-5],[7,-3],[-1,1],[5,1]]){
          fill([[x-3,y],[x-2,y-2],[x+1,y-3],[x+3,y-1],[x+2,y+2],[x-1,y+2]],brass);
          rect(x-1,y-1,3,2,'#594b3f');line(x-1,y+1,x+1,y+1,accent);
        }
        tube(9,-2,5,4,copper);rect(12,-1,2,2,accent);
        line(-6,3,-3,6,bone,2);drum(-2,6,3,3,'#bd8a43',accent);break;
      case 41: // Watchtower Press: overhead print gantry with an exposed hanging carriage.
        grip(-7,2);plate([[-14,0],[-9,-4],[-5,-3],[-6,3],[-13,5]],cast);
        tube(-8,0,23,5,steel);block(-8,-9,5,12,'#576d7d');block(8,-9,5,12,'#576d7d');
        block(-9,-10,23,4,steel);block(-2,-8,6,5,'#52778b');rect(-1,-7,3,2,accent);
        rect(0,-3,2,4,accent);rect(10,-7,2,2,brass);rect(2,1,9,1,'#c1e3df');
        line(6,4,10,7,steel,2);line(10,7,14,7,ink,2);break;
      case 42: // Gravwinch Mill: a violet cable winds around an exposed flanged spool.
        stock(13,4,'#74677c');grip(-8,2);tube(-8,-2,22,5,cast);
        drum(0,-1,8,8,'#847d98','#ddd5e6');drum(0,-1,6,6,'#493e61');
        line(-4,-4,0,-6,accent);line(0,-6,4,-4,accent);line(-5,-1,-2,3,'#8f78b3');
        drum(0,-1,2,2,steel);line(3,2,8,4,accent,2);line(8,4,12,2,accent,2);
        plate([[9,-1],[13,-3],[16,-1],[15,3],[12,4],[14,1]],steel,'#e5d5ff');break;
      case 'starbreaker': {
        stock(22,4,'#2f6270');grip(-9,3,'#426d75');tube(-14,-3,36,7,'#577b84','#9bc9d0');
        for(const side of [-1,1]){
          plate([[-8,side*4],[-3,side*8],[12,side*6],[22,side*3],[17,side*2],[-5,side*3]],'#3f626c','#e8d19b');
          line(-4,side*6,17,side*3,accent);
          rect(11,side>0?4:-5,3,1,'#fff1bf');
        }
        plate([[-9,0],[-4,-5],[2,0],[-4,5]],'#59c1c5','#e5fff0');
        ellipse(-4,0,2,1,'#faffeb');line(2,0,21,0,'#f0fff3');break;
      }
      case 'red-dwarf': {
        stock(16,5,'#704449');grip(-8,3,copper);tube(-11,-4,32,9,'#75404a','#ffac77');
        drum(1,0,11,10,'#7f4657','#e89c7f');drum(1,0,9,8,'#491f36');
        ellipse(2,0,6,5,accent);ellipse(3,-1,4,3,'#ffbc7e');ellipse(4,-1,2,1,'#fff2bb');
        for(const side of [-1,1]){
          plate([[0,side*7],[7,side*11],[15,side*7],[18,side*3],[14,side*2],[9,side*5]],'#9c514f','#ffd193');
          line(8,side*8,15,side*5,'#ffae6e');
        }
        block(16,-3,5,7,'#ac6356','#ffe0a5');rect(18,-1,2,3,'#fa9366');break;
      }
      case 'thunderhead': {
        stock(17,4,'#4d4a7c');grip(-6,2,'#4d4a7c');tube(-9,-3,30,7,'#536285','#b4bafb');
        for(const [x,h] of [[-8,7],[-2,12],[5,14],[12,10]]){
          block(x,-h,5,h+2,'#574e91','#ceccff');
          rect(x+1,-h+2,3,1,accent);rect(x+1,-h+5,3,1,'#e8f5ff');rect(x+2,-h+8,1,2,accent);
        }
        for(const [x,y] of [[-8,1],[-3,4],[3,1],[8,3],[15,0]])rect(x,y,4,2,accent);
        block(17,-4,4,9,'#6c72a4','#e8e5ff');rect(19,-1,2,3,'#f0fbff');break;
      }
      case 'winter-crown': {
        stock(16,4,'#427887');grip(-7,4,'#3c596f');tube(-11,-3,27,8,'#4b8092','#c1f6ff');
        for(const [x,y,h] of [[-8,-6,7],[-2,-9,11],[4,-11,10],[10,-9,8],[13,-6,5]]){
          plate([[x-3,y+6],[x,y+6-h],[x+3,y+5],[x+1,y+9]],'#65a9b8',accent);
          line(x,y+7-h,x,y+4,'#e7ffff');
        }
        for(const side of [-1,1]){
          plate([[5,side*2],[13,side*6],[19,side*4],[19,side*1],[14,side*2],[8,side]],'#79b9c6','#d5ffff');
        }
        ellipse(11,0,4,2,'#4f6e9b');rect(10,-1,6,2,accent);break;
      }
      case 'seraph-foundry': {
        stock(15,5,'#58706b');grip(-8,2,'#5f7a71');tube(-10,0,30,5,'#548477','#c6e0ab');
        for(const side of [-1,1]){
          plate([[-13,side*3],[-6,side*10],[9,side*11],[19,side*6],[15,side*3],[8,side*6],[-4,side*6]],'#658f77','#f2db95');
          line(-7,side*7,8,side*9,accent);line(9,side*9,16,side*6,'#c6e7b2');
        }
        plate([[-5,0],[2,-6],[9,0],[2,6]],'#76b88e','#e4ffe2');
        plate([[-1,0],[3,-3],[7,0],[3,3]],accent,'#efffdd');
        block(16,-3,5,7,'#b2a46d','#fff0b1');rect(18,-1,3,2,accent);break;
      }
      case 'god-gun': {
        stock(22,5,'#8a6e67');grip(-9,4,'#6e5775');tube(-15,-3,36,7,'#816c8c','#e9c5ef');
        for(const side of [-1,1]){
          plate([[-14,side*3],[-6,side*13],[4,side*12],[13,side*8],[22,side*5],[20,side*2],[12,side*5],[3,side*7],[-5,side*7]],'#ad815c','#fff0aa');
          line(-6,side*11,4,side*10,accent);line(4,side*10,19,side*5,'#fff8d5');
          rect(-7,side>0?8:-10,2,2,'#fff5a0');rect(2,side>0?8:-10,3,1,'#f6c3ff');
        }
        drum(0,0,8,8,'#746096','#f0affe');drum(0,0,6,6,'#a27b9e',accent);
        plate([[-6,0],[0,-5],[6,0],[0,5]],accent,'#fff9e1');
        line(-3,0,5,0,'#fffdf0',2);line(6,0,22,0,'#fff3bc');rect(21,-1,2,3,'#fffff3');break;
      }
    }
    return canvas;
  }

  function draw(ctx,def,x,y,scale=1,angle=0,item=null){
    if(def.creatureId){drawCreatureGun(ctx,def,x,y,scale,angle,item);return;}
    const id=def.id,key=def.forgeId??id,sprite=cells[id]||(cells[id]=bake(key,def.color));
    const [mx,my]=def.forgeId?forgeMuzzle[key]:muzzle[id];
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);
    ctx.scale(scale,Math.cos(angle)<0?-scale:scale);
    const firing=item?.flash>0;
    if(firing&&id<24)ctx.translate(-1,0);
    ctx.drawImage(sprite,-ox,-oy);
    if(item?.prefix){ctx.fillStyle='#93ddbc';ctx.fillRect(-8,-2,3,2);}
    if(item?.suffix){ctx.fillStyle='#d1aedb';ctx.fillRect(-8,1,2,1);}
    if(item?.charge>0){
      ctx.fillStyle='#dcfff6';const n=Math.ceil(3*item.charge);
      for(let k=0;k<n;k++)ctx.fillRect(-7+k*3,-3,2,2);
    }
    if(item?.heat>.45){ctx.fillStyle=item.heat>.8?'#ffe9b0':'#f2a972';ctx.fillRect(-5,-2,2+(item.heat>.8?2:0),1);}
    if(firing){
      const q=id===5?(item.shots%2?'#8edfff':'#ff927c'):def.color;
      ctx.fillStyle=q;
      if(def.forgeId){
        ctx.fillRect(mx,my-3,6,7);ctx.fillRect(mx+6,my-1,4,3);
        ctx.fillStyle='#fffbee';ctx.fillRect(mx+1,my-1,7,3);ctx.fillRect(mx+3,my-5,1,11);
      }else if(id===18||id===39){ctx.fillRect(mx+1,my-4,3,4);ctx.fillRect(mx+4,my-6,2,3);}
      else if(id===36){ctx.fillRect(mx,my,8,1);ctx.fillRect(mx+3,my-1,3,3);}
      else if(id===5||id===6||id===10||id===24||id===29){
        const gap=id===5?3:4;for(const side of [-1,1])if(id!==5||side===(item.shots%2?-1:1))ctx.fillRect(mx,my+side*gap,5,2);
      }else if(id<6||id>=12&&id<18){ctx.fillRect(mx,my-1,id>=12?8:5,2);ctx.fillRect(mx+1,my-2,2,4);}
      else if(id<24){ctx.fillRect(mx,my-2,4,5);ctx.fillRect(mx+3,my-1,4,3);}
      else{ctx.fillRect(mx,my-1,3,3);ctx.fillRect(mx+4,my-2,2,1);}
    }
    ctx.restore();
  }
  window.WeaponArt={draw};
})();
