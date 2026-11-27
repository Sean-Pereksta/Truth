/* Small field diagrams use a fixed pixel grid so a chip or an augment stays readable
   alongside the much larger weapon portraits. */
(() => {
  'use strict';
  const ink='#101c24', shadow='#35494d', steel='#859d9a', light='#d5ded0';
  const amber='#efa75d', gold='#ffdb8f', fire='#ef704c', red='#aa4951';
  const teal='#68c7bd', mint='#b1f4d8', blue='#79bde6', ice='#d4f4ed';
  const violet='#b398e4', plum='#735e9c', lime='#b4db78', ivory='#fff1ce';

  function brush(c) {
    function rect(x,y,w,h,color) {
      c.fillStyle=color;c.fillRect(x,y,w,h);
    }
    function line(x,y,x2,y2,color,weight=1) {
      const dx=Math.abs(x2-x),dy=-Math.abs(y2-y),sx=x<x2?1:-1,sy=y<y2?1:-1;
      let error=dx+dy;
      for(;;){
        rect(x,y,weight,weight,color);
        if(x===x2&&y===y2)break;
        const twice=2*error;
        if(twice>=dy){error+=dy;x+=sx;}
        if(twice<=dx){error+=dx;y+=sy;}
      }
    }
    function path(points,color,weight=1) {
      for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],color,weight);
    }
    function plate(points,fill,rim=ink) {
      const ys=points.map(p=>p[1]);
      for(let y=Math.min(...ys);y<=Math.max(...ys);y++){
        const cuts=[];
        for(let i=0;i<points.length;i++){
          const [ax,ay]=points[i],[bx,by]=points[(i+1)%points.length];
          if((ay<=y+.5&&by>y+.5)||(by<=y+.5&&ay>y+.5))
            cuts.push(ax+(y+.5-ay)*(bx-ax)/(by-ay));
        }
        cuts.sort((a,b)=>a-b);
        for(let i=0;i<cuts.length;i+=2)rect(Math.ceil(cuts[i]),y,Math.max(1,Math.ceil(cuts[i+1])-Math.ceil(cuts[i])),1,fill);
      }
      path([...points,points[0]],rim);
    }
    function ring(x,y,rx,ry,color,weight=1){
      const points=[[x-rx+3,y-ry],[x+rx-3,y-ry],[x+rx,y-ry+3],[x+rx,y+ry-3],
        [x+rx-3,y+ry],[x-rx+3,y+ry],[x-rx,y+ry-3],[x-rx,y-ry+3]];
      path([...points,points[0]],color,weight);
    }
    function bolt(x,y,w,h,color=gold){
      plate([[x+Math.floor(w*.65),y],[x+1,y+Math.floor(h*.57)],[x+Math.floor(w*.46),y+Math.floor(h*.57)],
        [x+2,y+h],[x+w,y+Math.floor(h*.4)],[x+Math.floor(w*.58),y+Math.floor(h*.4)]],color,color);
    }
    function flare(x,y,color=amber,r=5){
      path([[x-r,y],[x-2,y-1],[x,y-r],[x+1,y-2],[x+r,y],[x+2,y+1],[x,y+r],[x-1,y+2],[x-r,y]],color);
      rect(x-1,y-1,3,3,ivory);
    }
    function dart(x,y,color=gold){
      rect(x-5,y,4,1,color);rect(x-1,y-1,3,3,color);rect(x+2,y,2,1,ivory);
    }
    function crystal(x,y,color=blue){
      plate([[x,y-6],[x+4,y-2],[x+3,y+3],[x-1,y+6],[x-4,y+2],[x-3,y-3]],color,shadow);
      line(x-2,y+1,x,y-4,ice);
    }
    function snow(x,y){
      line(x-5,y,x+5,y,ice);line(x,y-5,x,y+5,ice);
      line(x-3,y-3,x+3,y+3,blue);line(x-3,y+3,x+3,y-3,blue);rect(x-1,y-1,3,3,ice);
    }
    function fireball(x,y,h=11){
      plate([[x-5,y],[x-5,y-4],[x-2,y-7],[x-1,y-4],[x+2,y-h],[x+4,y-5],[x+6,y-7],[x+6,y-2],[x+3,y+1],[x-2,y+1]],fire,red);
      plate([[x-2,y],[x,y-5],[x+1,y-3],[x+3,y-5],[x+3,y]],gold,amber);
    }
    function cross(x,y,color){
      rect(x-2,y-6,5,13,color);rect(x-6,y-2,13,5,color);rect(x-1,y-5,2,4,ivory);
    }
    function shield(x,y,color=teal){
      plate([[x-8,y-8],[x-3,y-7],[x,y-9],[x+3,y-7],[x+8,y-8],[x+7,y+1],[x+4,y+5],[x,y+8],[x-5,y+5],[x-7,y+1]],color);
      path([[x-5,y-5],[x-4,y+1],[x,y+5],[x+3,y+2]],mint);rect(x+1,y-5,3,2,ivory);
    }
    function magazine(x,y){
      plate([[x-6,y-8],[x+5,y-8],[x+6,y+1],[x+3,y+8],[x-6,y+7],[x-4,y],[x-5,y-4]],steel);
      rect(x-5,y-7,9,3,amber);for(let i=0;i<3;i++)line(x-2,y-2+i*3,x+3,y-1+i*3,shadow);
      rect(x-3,y+6,5,1,light);
    }
    function rifle(x,y){
      plate([[x-13,y-3],[x-8,y-1],[x-6,y-4],[x+8,y-4],[x+8,y-2],[x+15,y-2],[x+15,y+1],
        [x+5,y+1],[x+3,y+4],[x-2,y+3],[x-4,y+8],[x-8,y+7],[x-6,y+2],[x-12,y+3]],steel);
      rect(x-5,y-3,10,2,light);rect(x+5,y-4,3,3,amber);rect(x+11,y-1,4,1,light);
    }
    function drone(x,y,color=teal){
      plate([[x-5,y-4],[x+4,y-4],[x+7,y-1],[x+3,y+3],[x-4,y+3],[x-7,y]],color);
      plate([[x-5,y-1],[x-11,y-5],[x-12,y-3],[x-9,y],[x-6,y+1]],steel);
      plate([[x+3,y-3],[x+7,y-8],[x+12,y-8],[x+11,y-5],[x+6,y-2]],light);
      rect(x-2,y-2,4,2,ivory);rect(x+3,y+2,3,3,amber);
    }
    function mask(x,y,color=violet){
      plate([[x-6,y-4],[x-3,y-8],[x+4,y-7],[x+7,y-4],[x+8,y+1],[x+5,y+3],[x+4,y+7],
        [x-3,y+6],[x-7,y+2]],color);
      path([[x-5,y-4],[x-2,y-6],[x+3,y-5]],light);rect(x-2,y-2,9,3,ink);
      rect(x+1,y-2,5,1,ice);rect(x+3,y+3,2,2,shadow);
    }
    function marker(x,y,color=red){
      for(const sx of [-1,1])for(const sy of [-1,1]){
        path([[x+sx*8,y+sy*4],[x+sx*8,y+sy*8],[x+sx*4,y+sy*8]],color);
      }
    }
    function node(x,y){
      plate([[x-4,y+1],[x-1,y-3],[x+3,y-3],[x+5,y+1],[x+3,y+4],[x-3,y+4]],plum);
      rect(x-1,y-2,3,3,ice);
    }
    return {rect,line,path,plate,ring,bolt,flare,dart,crystal,snow,fireball,cross,shield,magazine,rifle,drone,mask,marker,node};
  }

  const art = {
    'Upgrade a weapon'(d){
      d.rect(14,28,37,3,shadow);d.rect(17,27,30,1,light);
      d.rect(19,23,4,5,steel);d.rect(43,20,4,8,steel);
      d.rifle(32,17);d.rect(27,12,8,2,amber);
      d.plate([[49,28],[51,30],[62,18],[66,18],[70,14],[70,10],[66,14],[62,13],
        [62,10],[65,6],[61,7],[58,11],[58,15]],light);
      d.line(50,28,60,17,teal,2);
      for(let i=0;i<3;i++)d.path([[54+6*i,31],[56+6*i,29],[58+6*i,31]],gold);
    },
    'Heavy Core'(d){
      d.path([[12,16],[24,16],[31,20]],amber,2);d.line(14,23,29,23,steel);
      d.plate([[29,14],[36,8],[48,9],[55,17],[53,26],[46,31],[35,29],[29,24]],steel);
      d.plate([[34,15],[39,11],[46,12],[50,17],[48,23],[44,26],[36,25],[33,21]],shadow);
      d.bolt(36,13,12,11,amber);d.path([[56,13],[61,9],[60,15],[69,12],[64,19],[72,21],[62,24],[65,30],[57,26]],gold,2);
    },
    'Tight Orbit'(d){
      d.ring(43,21,21,10,shadow);d.path([[26,23],[22,17],[24,11],[34,7],[44,7]],teal,2);
      d.path([[58,15],[64,20],[63,26],[52,31],[43,31]],teal,2);d.ring(43,20,11,8,amber);
      d.bolt(38,12,10,16);d.plate([[44,4],[50,7],[44,11]],mint,teal);d.plate([[43,27],[36,31],[43,34]],mint,teal);
    },
    'Fast Hands'(d){
      d.rifle(36,16);d.flare(55,15,gold,6);
      d.plate([[24,24],[29,20],[34,19],[33,22],[40,20],[42,22],[38,27],[31,30],[25,30],[20,27]],amber);
      d.path([[26,25],[30,23],[34,23]],gold);d.line(12,26,20,26,teal);d.line(15,29,22,29,steel);d.dart(66,15);
    },
    'Long Cut'(d){
      for(const x of [28,44,60]){
        d.plate([[x-3,11],[x+1,9],[x+5,12],[x+3,26],[x,29],[x-5,26]],steel);
        d.line(x-3,13,x+1,11,light);
      }
      d.line(11,22,64,18,violet,2);d.line(17,21,66,17,ice);d.flare(65,17,violet,5);
    },
    'Tailwind'(d){
      d.path([[12,14],[33,14],[36,11]],teal,2);d.path([[17,20],[28,20],[32,17]],blue);
      d.plate([[36,8],[47,7],[51,13],[45,19],[45,22],[59,23],[64,27],[60,30],[43,30],[33,25],[32,20],[38,15]],steel);
      d.path([[38,9],[46,9],[48,12]],light,2);d.path([[36,24],[44,28],[59,28]],mint,2);d.line(22,26,30,26,teal);
    },
    'Counterweight'(d){
      d.rifle(36,15);d.line(40,19,40,24,light,2);
      d.plate([[35,24],[45,24],[48,28],[47,32],[34,32],[32,29]],amber);d.line(35,26,44,26,gold);
      d.line(54,14,67,14,teal);d.line(54,17,66,17,teal);d.rect(62,12,3,1,ice);
    },
    'Condensate Coil'(d){
      d.plate([[18,12],[22,9],[55,9],[60,14],[58,23],[21,23],[18,20]],steel);
      d.rect(21,12,35,9,shadow);for(const x of [25,32,39,46])d.path([[x,22],[x+4,12],[x+7,11]],blue,3);
      d.path([[23,10],[54,10],[58,14]],ice);
      d.plate([[60,17],[64,22],[64,26],[61,28],[57,27],[56,24]],teal);d.snow(31,29);
    },
    'Primer Cap'(d){
      d.plate([[15,16],[19,12],[39,12],[44,16],[39,21],[18,21],[15,19]],amber);
      d.rect(18,13,3,7,light);d.rect(23,14,14,2,gold);d.rect(21,25,12,2,shadow);
      d.path([[42,17],[51,17],[49,11],[56,15],[59,7],[60,15],[69,12],[64,19],[68,23],[60,22],[59,29],[55,23]],fire,2);
      d.flare(57,19,gold,6);
    },
    'Split Fuse'(d){
      d.ring(43,21,21,11,red,2);d.ring(43,21,13,6,shadow);d.rect(38,18,9,6,steel);
      for(const [x,y] of [[23,15],[61,15],[24,27],[62,28]])d.flare(x,y,amber,4);
      d.path([[40,18],[34,13],[27,13]],gold);d.path([[46,22],[51,26],[60,26]],gold);
    },
    'Relay Antenna'(d){
      d.plate([[25,30],[28,25],[41,25],[46,30],[43,32],[26,32]],steel);
      d.path([[29,25],[32,16],[36,16],[39,25]],light,2);
      d.plate([[22,10],[27,11],[39,17],[42,21],[38,23],[31,21],[26,17]],teal);
      d.path([[25,10],[34,15],[41,19]],ice,2);d.line(33,17,40,9,amber,2);
      for(const n of [0,6,12])d.path([[44+n,7],[49+n,12],[49+n,17]],n===12?mint:teal);
    },
    'Field Spool'(d){
      d.magazine(54,20);d.ring(32,20,9,10,steel,2);d.ring(32,20,5,6,amber,2);d.rect(30,18,4,5,shadow);
      d.path([[31,30],[38,33],[47,31],[52,28]],mint,2);d.line(13,16,21,16,teal);d.line(10,20,20,20,teal);
    },
    'Repair pack'(d){
      d.path([[34,12],[35,7],[48,7],[50,12]],steel,3);
      d.plate([[22,13],[26,10],[56,10],[61,14],[61,28],[57,31],[26,31],[22,27]],steel);
      d.rect(26,14,31,13,teal);d.rect(27,28,30,2,shadow);d.rect(27,13,4,6,light);
      d.rect(53,13,4,6,light);d.cross(42,21,ice);
    },
    'Salvage reserve'(d){
      d.plate([[19,20],[25,14],[40,15],[46,23],[40,29],[24,28]],shadow);
      d.plate([[32,19],[38,11],[52,12],[58,18],[53,25],[37,26]],amber);
      d.path([[35,18],[39,13],[51,14]],gold,2);d.rect(40,17,7,4,shadow);
      d.plate([[46,25],[52,18],[62,20],[65,25],[61,31],[49,32]],steel);
      d.path([[51,22],[55,20],[60,22]],light,2);d.rect(54,25,5,3,shadow);d.flare(23,12,gold,3);
    },
    'augment/0/1'(d){
      d.mask(22,21,steel);
      for(const [x,y] of [[49,9],[57,14],[60,20],[57,26],[49,32]])d.line(30,20,x,y,teal);
      d.path([[50,7],[62,13],[66,20],[62,27],[50,33]],mint,2);d.flare(67,13,amber,3);
    },
    'augment/0/2'(d){
      d.dart(23,20,fire);d.dart(26,26,amber);
      d.path([[35,7],[41,13],[43,21],[40,27],[35,32]],teal,3);d.flare(40,20,ice,4);
      for(const [x,y] of [[52,12],[61,17],[61,23],[51,29]])d.plate([[x-2,y-2],[x+4,y-1],[x,y+3]],mint,teal);
    },
    'augment/1/1'(d){
      d.dart(20,16,fire);d.dart(23,23,amber);d.shield(35,19,blue);
      d.path([[43,20],[48,20],[48,25],[53,25]],gold,2);d.rifle(58,17);d.bolt(52,18,8,12);
    },
    'augment/1/2'(d){
      d.mask(37,21,steel);d.shield(55,21,teal);
      d.line(14,16,26,16,teal);d.line(18,21,27,21,blue);d.line(13,25,25,25,shadow);
      d.path([[50,11],[53,8],[60,8]],mint);d.rect(43,23,5,2,light);
    },
    'augment/2/1'(d){
      d.mask(28,19,plum);for(const y of [18,22,26])d.line(19,y,28,y,shadow);
      d.path([[20,28],[15,30],[18,32],[34,32],[37,29]],violet);d.line(38,18,47,18,teal);
      d.mask(54,18,teal);d.path([[46,28],[43,30],[47,32],[61,32],[64,29]],mint);
    },
    'augment/2/2'(d){
      d.mask(41,17,teal);d.ring(41,28,11,3,mint);d.ring(41,28,18,5,teal);
      d.path([[23,13],[16,17],[23,21]],gold,2);d.path([[60,13],[67,17],[60,21]],gold,2);
      d.rect(20,16,9,2,amber);d.rect(54,16,9,2,amber);
    },
    'augment/3/1'(d){
      d.path([[21,28],[30,16],[35,19],[43,8],[52,19],[55,16],[63,28],[53,25],[47,29],[38,25],[32,29],[21,28]],blue,2);
      for(const [x,y] of [[21,28],[43,8],[63,28]])d.node(x,y);d.flare(43,21,violet,4);
    },
    'augment/3/2'(d){
      d.path([[18,26],[28,18],[33,22],[40,14],[47,21],[53,16],[64,25]],blue,2);
      d.node(18,26);d.node(64,25);d.mask(42,17,plum);d.bolt(40,7,13,24);d.flare(50,13,gold,4);
    },
    'augment/4/1'(d){
      d.ring(42,25,18,6,red);
      d.path([[48,5],[41,18],[39,23]],amber,3);d.flare(40,24,gold,6);
      for(const [x,y] of [[25,20],[58,19],[27,31],[56,31]])d.flare(x,y,fire,4);
    },
    'augment/4/2'(d){
      d.ring(47,28,16,4,red);d.marker(47,24,amber);
      d.plate([[51,5],[58,5],[49,22],[44,26],[45,18]],fire,amber);
      d.line(54,7,47,21,ivory,2);d.flare(46,26,gold,4);d.line(39,9,35,16,red);
    },
    'augment/5/1'(d){
      d.path([[17,18],[37,10],[52,12]],blue,2);d.path([[17,18],[34,24],[43,24]],ice);
      d.plate([[28,27],[40,20],[47,21],[55,18],[65,23],[62,29],[47,32],[31,31]],teal,blue);
      d.snow(47,24);d.rect(58,22,3,1,ice);d.rect(34,28,4,1,mint);
    },
    'augment/5/2'(d){
      d.line(10,22,29,20,blue,2);d.dart(33,19,gold);
      d.plate([[37,12],[44,7],[48,11],[43,17],[46,20],[40,26],[34,21]],blue);
      d.path([[44,10],[39,16],[42,18],[37,23]],ice);d.flare(46,19,ivory,4);
      for(const [x,y] of [[54,11],[62,18],[55,28]])d.crystal(x,y);
    },
    'augment/6/1'(d){
      d.path([[13,29],[29,28],[42,25],[55,25],[68,22]],red,3);d.fireball(25,27,8);d.fireball(56,24,10);
      d.mask(42,15,steel);d.fireball(43,26,16);d.flare(49,12,gold,3);
    },
    'augment/6/2'(d){
      for(const x of [27,39,51])d.fireball(x,28,11+(x===39?5:0));
      d.line(11,19,55,18,ice,2);d.dart(61,18,gold);d.path([[52,29],[57,27],[67,28]],amber,2);
    },
    'augment/7/1'(d){
      d.drone(29,14);d.path([[32,19],[38,24],[43,18],[47,21]],mint,2);
      d.shield(57,23,teal);d.cross(56,22,ice);
    },
    'augment/7/2'(d){
      d.drone(34,15);d.path([[33,20],[29,25],[24,25]],teal);d.cross(22,26,lime);
      d.path([[42,18],[47,20],[51,17]],ice);d.path([[50,12],[55,15],[55,23],[50,27]],blue,2);
      d.flare(56,18,gold,4);d.dart(66,15,fire);
    },
    'augment/8/1'(d){
      d.ring(31,21,11,11,plum,2);d.ring(31,21,7,7,violet);d.flare(31,21,ice,3);
      d.path([[48,10],[42,12],[43,16],[48,18],[58,18]],teal,2);d.dart(63,18,mint);d.dart(58,25,mint);
    },
    'augment/8/2'(d){
      d.ring(42,20,10,7,ice,2);d.ring(42,20,22,12,violet,2);d.ring(42,20,5,3,plum);
      d.flare(20,16,amber,3);d.flare(62,28,amber,3);
    },
    'augment/9/1'(d){
      d.path([[16,15],[23,10],[38,8],[52,10],[60,16],[60,23],[52,28],[36,29],[29,25],[27,20],[32,15],[45,14],[51,18],[50,22],[41,24],[36,21],[39,18]],plum,3);
      d.path([[19,14],[24,11],[37,9],[48,10]],violet,2);d.flare(41,20,ice,4);
      d.line(59,28,65,25,violet);d.line(19,24,26,27,violet);
    },
    'augment/9/2'(d){
      d.ring(31,22,13,9,plum,2);d.ring(31,22,7,5,violet);
      d.line(34,21,47,17,ice,2);d.mask(55,16,steel);d.marker(55,16,fire);d.flare(44,19,gold,3);
    },
    'augment/10/1'(d){
      d.plate([[22,26],[29,22],[40,23],[45,21],[56,22],[63,26],[57,30],[46,30],[39,33],[26,31]],lime,teal);
      d.mask(42,14,red);d.path([[44,17],[40,19],[43,21],[39,24]],amber);
      d.rect(28,26,6,2,mint);d.rect(49,25,3,2,gold);d.rect(36,29,3,1,mint);
    },
    'augment/10/2'(d){
      d.mask(24,13,teal);d.rifle(43,13);d.dart(66,11,mint);
      d.mask(25,27,red);d.path([[34,26],[41,23],[47,23],[48,25],[54,25]],violet,2);d.dart(62,25,violet);
    },
    'augment/11/1'(d){
      d.path([[12,17],[24,17],[28,14]],teal,2);d.path([[14,23],[24,23],[28,20]],teal,2);
      d.rifle(38,17);d.bolt(30,20,10,12);d.flare(54,16,amber,5);
      d.dart(65,13,gold);d.dart(69,19,gold);
    },
    'augment/11/2'(d){
      d.magazine(34,20);d.path([[25,8],[32,5],[40,5],[45,8]],amber,2);
      d.path([[46,17],[51,12],[58,12],[63,17],[63,23],[59,27],[51,27],[48,24]],teal,2);
      d.path([[55,15],[55,20],[60,20]],ivory,2);d.plate([[48,20],[49,26],[44,23]],mint,teal);
    }
  };
  window.FieldArt = {draw(ctx,name){
    if(!Object.hasOwn(art,name))return false;
    art[name](brush(ctx));
    return true;
  }};
})();
