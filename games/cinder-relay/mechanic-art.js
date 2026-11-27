/* Pixel illustrations for field techniques and gun/ability synergies. */
(() => {
  'use strict';
  const ink='#182632', slate='#485965', metal='#83939b', ivory='#fff0c3';
  const amber='#ffba59', brass='#af753e', ember='#fa7a47', red='#b94743';
  const aqua='#79dbce', deep='#398f9a', blue='#75b9e3', ice='#c3f2ff';
  const purple='#bc95e7', plum='#725990', lime='#b8d77c', moss='#648b54';

  // Small repeatable silhouettes are shared across the scenes like a field manual.
  const mask=[
    '   000000   ','  02222330  ',' 0222122330 ','022211122330',
    '032224444430','033300444030',' 0332112230 ',' 0012213300 ',
    '   031130   ','   000000   '
  ];
  const wasp=[
    '  0220 0220  ','   0120210   ','  00000000   ',
    ' 0333133400  ','003131334420 ','  00010000   ','    00 00    '
  ];
  const foot=[
    '     0000000 ','     0122220 ','    0112230  ','    0111330  ',
    '    02333300 ','   0221133330',' 000001122230','022222222220 ',
    ' 0000000000  '
  ];
  const fire=[
    '      1     ','      11    ','  1  122   1','  11 1221 11',
    ' 12112221221',' 1222222221 ','11222332221 ','12223332321 ',
    ' 1223333221 ','  12233221  ','   112211   '
  ];
  const metalPalette=[ink,slate,metal,'#bfc7ba',ember];
  const flyPalette=[ink,slate,'#a0d19e',amber,ivory];
  const firePalette=[ink,red,ember,'#ffdc7a'];

  function brushes(c){
    function rect(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
    function line(x,y,tx,ty,color,size=1){
      const dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;
      let err=dx+dy;
      for(;;){
        rect(x,y,size,size,color);
        if(x===tx&&y===ty)break;
        const twice=2*err;
        if(twice>=dy){err+=dy;x+=sx;}
        if(twice<=dx){err+=dx;y+=sy;}
      }
    }
    function trace(pts,color,size=1){
      for(let i=2;i<pts.length;i+=2)line(pts[i-2],pts[i-1],pts[i],pts[i+1],color,size);
    }
    function poly(pts,color){
      let lo=Infinity,hi=-Infinity;
      for(let i=1;i<pts.length;i+=2){lo=Math.min(pts[i],lo);hi=Math.max(pts[i],hi);}
      for(let y=lo;y<hi;y++){
        const xs=[],row=y+.5;
        for(let i=0;i<pts.length;i+=2){
          const j=(i+2)%pts.length,x1=pts[i],y1=pts[i+1],x2=pts[j],y2=pts[j+1];
          if((y1<=row&&y2>row)||(y2<=row&&y1>row))xs.push(x1+(row-y1)*(x2-x1)/(y2-y1));
        }
        xs.sort((a,b)=>a-b);
        for(let i=0;i<xs.length;i+=2){
          const x=Math.round(xs[i]);rect(x,y,Math.round(xs[i+1])-x,1,color);
        }
      }
    }
    function stamp(rows,x,y,palette,scale=1){
      rows.forEach((row,ry)=>{
        for(let rx=0;rx<row.length;rx++)if(row[rx]!==' ')rect(x+rx*scale,y+ry*scale,scale,scale,palette[Number(row[rx])]);
      });
    }
    function oval(x,y,rx,ry,color){
      for(let n=-ry;n<=ry;n++){
        const w=Math.round(rx*Math.sqrt(1-n*n/(ry*ry)));rect(x-w,y+n,2*w+1,1,color);
      }
    }
    function reticle(x,y,r,color){
      for(const sx of [-1,1])for(const sy of [-1,1]){
        trace([x+sx*(r-3),y+sy*r,x+sx*r,y+sy*r,x+sx*r,y+sy*(r-3)],color);
      }
    }
    function dart(x,y,len,color,tip=ivory){
      rect(x,y,len,3,ink);rect(x,y+1,len-1,1,color);rect(x+len-4,y,4,2,tip);rect(x+len,y+1,1,1,color);
    }
    function arc(pts){
      trace(pts,'#244a61',4);trace(pts,blue,2);trace(pts,'#dbfffb');
    }
    function spark(x,y,color){
      rect(x,y-3,2,8,color);rect(x-3,y,8,2,color);rect(x,y,2,2,ivory);
    }
    function helmet(x,y,scale=1,colors=metalPalette){stamp(mask,x,y,colors,scale);}
    function flame(x,y,scale=1){stamp(fire,x,y,firePalette,scale);}
    function drone(x,y){stamp(wasp,x,y,flyPalette);}
    function boot(x,y,col=metalPalette){stamp(foot,x,y,col);}
    function shard(x,y,dx,dy,sz=3,col=blue){
      const ax=Math.abs(dx)>Math.abs(dy)?0:sz,ay=ax?0:sz;
      poly([x,y,x+Math.round(dx*.65)+ax,y+Math.round(dy*.65)+ay,x+dx,y+dy,x+Math.round(dx*.55)-ax,y+Math.round(dy*.55)-ay],col);
      line(x,y,x+dx,y+dy,ice);
    }
    function disk(x,y,col){
      oval(x,y,9,5,ink);oval(x,y-1,8,4,col);oval(x,y-1,5,2,slate);
      rect(x-3,y-1,6,1,ivory);rect(x+4,y,3,1,ivory);
    }
    function mine(x,y,armed){
      poly([x-12,y+4,x-9,y,x-8,y-4,x-4,y-7,x+4,y-7,x+8,y-4,x+9,y,x+12,y+4],ink);
      poly([x-10,y+2,x-6,y-3,x+6,y-3,x+10,y+2],slate);
      rect(x-5,y-5,10,3,metal);rect(x-2,y-7,4,3,armed?ember:brass);rect(x-1,y-7,2,1,armed?ivory:amber);
      rect(x-6,y,3,2,brass);rect(x+3,y,3,2,brass);
    }
    function shield(x,y){
      poly([x-10,y-8,x,y-11,x+10,y-8,x+9,y+1,x+6,y+7,x,y+11,x-6,y+7,x-9,y+1],ink);
      poly([x-8,y-7,x,y-9,x+8,y-7,x+7,y+1,x+5,y+5,x,y+9,x-5,y+5,x-7,y+1],aqua);
      poly([x-5,y-5,x,y-6,x+5,y-5,x+4,y+2,x,y+6,x-4,y+2],deep);
      trace([x-6,y-6,x,y-8,x+5,y-6],ice);
    }
    function gun(id,x,y,scale){
      const def=window.Combat.guns[id];window.WeaponArt.draw(c,def,x,y,scale);
    }
    return {rect,line,trace,poly,stamp,oval,reticle,dart,arc,spark,helmet,flame,drone,boot,shard,disk,mine,shield,gun};
  }

  const scenes={
    'Sustained Fire'(b){
      b.gun(0,22,21,.75);
      b.line(33,12,44,15,brass);b.line(33,29,44,26,brass);
      b.line(46,16,53,18,amber);b.line(46,25,53,23,amber);
      b.dart(38,20,10,amber);b.dart(52,20,9,amber);b.reticle(65,21,6,aqua);b.spark(65,20,amber);
      b.rect(21,30,3,2,brass);b.rect(16,33,3,2,brass);
    },
    'Breach Pattern'(b){
      b.gun(6,24,21,.85);
      b.poly([35,19,44,15,40,20,48,21,40,22,43,26,35,23],ember);
      for(const [x,y] of [[43,13],[46,28],[56,9],[57,32],[56,19],[64,20]]){
        b.rect(x-3,y+1,5,2,brass);b.rect(x,y,3,2,ivory);
      }
    },
    'Throughline'(b){
      b.helmet(31,12);b.helmet(51,14);
      b.trace([12,24,35,20,68,14],plum,3);b.trace([14,23,38,19,70,13],ice);
      b.shard(60,16,12,-3,3,purple);b.spark(35,19,purple);b.rect(54,9,2,3,purple);b.rect(59,26,2,2,blue);
    },
    'Expanded Yield'(b){
      b.oval(42,25,26,7,brass);b.oval(42,25,23,5,'#263a40');
      b.poly([23,26,33,24,26,13,39,19,42,3,47,17,57,9,53,21,61,23,52,27,31,29],red);
      b.poly([30,25,37,24,32,16,40,21,42,9,46,21,53,15,50,24,54,25,40,28],ember);
      b.poly([36,25,41,22,43,16,46,23,50,24,44,26],ivory);
      b.rect(16,17,3,2,amber);b.rect(65,20,3,2,amber);b.rect(51,5,2,2,ember);
    },
    'Closed Circuit'(b){
      b.trace([20,19,20,12,27,6,53,6,60,12,60,17],deep,3);
      b.trace([61,20,61,28,54,33,29,33,21,28],aqua,2);
      b.poly([18,23,16,16,25,16],aqua);b.poly([61,15,67,17,60,22],ice);
      b.gun(24,40,21,.86);b.rect(33,7,9,1,ice);b.rect(39,33,6,1,blue);
    },
    'Larger Clutch'(b){
      b.oval(29,29,14,4,ink);b.oval(29,27,12,4,brass);b.oval(29,26,9,3,slate);
      b.oval(29,25,6,2,amber);b.rect(25,25,8,1,ivory);
      b.drone(24,13);b.drone(43,5);b.drone(52,18);b.trace([34,19,39,14,43,14],moss);
      b.rect(43,24,6,1,moss);b.rect(37,27,5,1,moss);
    },
    'Fresh Paint'(b){
      b.helmet(46,11,2);b.reticle(58,21,13,ember);
      b.trace([13,25,25,25,34,21,45,21],brass,2);b.dart(24,19,16,amber);
      b.spark(48,20,ember);b.rect(43,13,2,2,amber);b.rect(44,27,2,2,amber);
    },
    'Second Address'(b){
      b.helmet(26,15);b.reticle(32,20,9,ember);b.helmet(52,13);
      b.dart(10,20,12,brass);b.line(37,20,58,17,purple,2);b.shard(58,17,14,-2,2,purple);
      b.rect(46,16,4,1,ice);b.rect(60,9,2,2,amber);
    },
    'Line Voltage'(b){
      b.helmet(13,18);b.helmet(60,10);
      b.arc([19,16,24,12,28,19,37,12,34,23,48,15,44,23,61,15]);
      b.trace([16,10,19,6,18,10,22,7],aqua,2);b.spark(63,16,aqua);
    },
    'Static Step'(b){
      b.rect(9,24,12,2,deep);b.rect(16,29,7,2,aqua);b.rect(14,20,6,1,aqua);
      b.boot(19,13);b.arc([32,22,40,16,36,25,45,20,51,21]);b.helmet(52,14);
      b.spark(53,17,aqua);b.rect(62,9,1,3,blue);b.rect(66,21,3,2,blue);
    },
    'Hot Lead'(b){
      b.helmet(47,13,2);b.dart(10,25,9,brass,amber);b.dart(23,22,11,ember,amber);
      b.dart(38,19,12,ember);b.flame(44,5,2);b.spark(50,22,amber);
      b.rect(50,4,2,2,ember);b.rect(67,10,2,3,amber);
    },
    'Flash Fuel'(b){
      b.oval(42,29,26,5,'#543d38');b.oval(42,28,23,3,red);b.oval(43,27,16,2,ember);
      b.helmet(29,20);b.flame(22,14);b.flame(34,6,2);b.flame(55,17);
      b.rect(32,8,2,3,amber);b.rect(51,4,2,2,ember);b.rect(59,13,1,2,amber);
    },
    'Ice Breaker'(b){
      b.shard(35,22,-6,-12,3,blue);b.shard(44,15,3,-10,3,blue);b.shard(55,17,11,-8,3,deep);
      b.helmet(32,16,2,[ink,deep,blue,ice,purple]);b.trace([48,15,42,20,46,20,40,27,42,28,39,34],ink,2);
      b.dart(10,23,19,blue);b.spark(33,24,ice);b.shard(56,22,12,1,3,blue);b.shard(51,28,7,7,2,blue);
    },
    'Spore Transfer'(b){
      b.oval(24,29,14,4,moss);b.oval(24,28,10,2,lime);b.helmet(19,21);
      b.helmet(55,13,1,[ink,moss,lime,'#d7ed9d',ivory]);
      for(const [x,y,r] of [[23,17,3],[30,12,2],[38,10,3],[47,12,2],[53,16,2]]){
        b.oval(x,y,r,r,moss);b.rect(x-1,y-1,2,2,lime);
      }
    },
    'Shield Harvest'(b){
      b.helmet(14,21);b.reticle(20,25,8,brass);b.rect(17,15,6,2,amber);
      b.shield(56,19);b.trace([26,23,33,20,39,20,47,15],deep);
      for(const [x,y] of [[31,19],[39,16],[46,13]]){b.rect(x,y,3,3,aqua);b.rect(x,y,1,1,ice);}
    },
    'Ready Powder'(b){
      b.mine(56,26,true);b.mine(25,22,false);
      b.trace([30,15,34,10,38,8,42,8,46,10,49,14],brass);
      b.spark(56,13,amber);b.trace([63,16,66,13],ember,2);b.trace([48,16,46,14],ember);
    },
    'Clean Escape'(b){
      b.helmet(13,20);b.poly([13,16,13,10,17,13,20,8,23,13,27,10,26,16],amber);
      b.trace([33,23,43,23],deep,2);b.trace([38,28,45,28],aqua);
      b.boot(43,9,[ink,deep,aqua,ice,amber]);
      b.poly([58,14,66,14,62,20,68,20,55,32,59,24,55,24],amber);b.rect(59,15,5,1,ivory);
    },
    'Quick Exchange'(b){
      b.gun(0,25,12,.6);b.gun(6,29,27,.75);b.trace([12,16,10,20,13,23],brass,2);
      b.poly([10,22,17,21,14,26],amber);b.helmet(56,18);
      b.dart(43,23,9,amber);b.spark(56,24,ember);b.trace([65,15,68,13,70,13],amber);b.rect(67,29,3,1,brass);
    },
    'Storm Circuit'(b){
      b.helmet(58,4);b.helmet(58,25);
      for(const [x,y] of [[30,10],[42,27]]){b.oval(x,y+3,5,2,slate);b.rect(x-2,y-4,4,7,deep);b.rect(x-1,y-5,2,4,aqua);}
      b.trace([30,8,42,25],purple,2);
      b.arc([10,24,18,16,18,22,28,16,32,20,40,16,38,22,50,15,60,10]);
      b.arc([40,21,48,26,48,22,60,28]);b.spark(38,19,aqua);
    },
    'Furnace Orbit'(b){
      b.trace([24,25,16,20,17,14,24,9,36,7,47,8,55,12],plum,2);
      b.trace([29,28,22,25,17,21],purple);b.disk(54,14,purple);
      b.oval(40,28,21,3,red);b.flame(21,18);b.flame(33,17);
      b.poly([44,25,52,23,47,18,56,22,63,19,60,23,73,24,60,27,65,31,52,28,44,30],ember);
      b.trace([48,26,55,24,65,24],ivory,2);
    },
    'Siege Breaker'(b){
      b.trace([11,26,18,26,25,29,32,29],plum,2);b.trace([69,32,61,32,57,29],plum,2);
      b.helmet(36,16,2);b.reticle(47,25,10,ember);
      b.poly([23,3,30,5,35,11,35,6,44,18,47,23,39,21,28,12,33,14],red);
      b.poly([30,8,37,13,43,18,45,22,40,20,34,15],amber);b.spark(43,21,ivory);
    },
    'Living Screen'(b){
      for(const [x,y] of [[11,12],[20,8],[14,20],[24,17],[12,29],[22,26]])b.dart(x,y,5,brass,amber);
      b.trace([38,4,34,10,33,23,37,31,40,33],deep,4);
      b.trace([39,5,36,11,35,22,38,30],aqua,2);
      b.spark(34,17,ivory);b.drone(43,14);b.drone(56,5);b.drone(55,26);
    },
    'Glass Garden'(b){
      b.helmet(30,15,1,[ink,deep,blue,ice,purple]);b.shard(15,24,16,-5,3,purple);b.spark(35,20,ice);
      for(const [dx,dy] of [[13,-11],[20,-6],[20,2],[17,11]])b.shard(40,20,dx,dy,3,purple);
      b.shard(52,14,10,-9,2,blue);b.shard(57,20,14,-1,2,blue);b.shard(53,26,13,9,2,blue);
    },
    'Relay Assassin'(b){
      b.oval(23,29,11,3,deep);b.oval(23,28,8,2,slate);b.rect(21,23,5,5,deep);b.rect(22,22,2,4,ice);
      b.helmet(19,12,1,[ink,'#38555f','#5e8993','#95c5c6',aqua]);b.helmet(43,20);
      b.trace([30,23,34,23,38,26,41,26],plum);
      b.trace([28,17,36,17,52,12],deep,2);b.shard(50,13,17,-2,2,blue);
      b.trace([52,24,57,22,63,22],plum,2);b.shard(59,22,14,-3,2,purple);
    }
  };
  window.MechanicArt={
    draw(ctx,name){
      if(!Object.hasOwn(scenes,name))return false;
      ctx.save();ctx.imageSmoothingEnabled=false;
      try{scenes[name](brushes(ctx));}finally{ctx.restore();}
      return true;
    }
  };
})();
