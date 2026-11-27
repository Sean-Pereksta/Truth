/* Native-pixel inventory illustrations for chassis upgrades and the six weapon families. */
(() => {
  'use strict';
  const ink='#111c23', recess='#26373e', steel='#50666e', rim='#96a8a3', ivory='#f4ecd3';
  const copper='#975e45', ember='#ed8a53', amber='#ffc581', teal='#579e9c', mint='#a2e3ce';
  const blue='#78b5d0', frost='#c3e7ed', violet='#aa91cf';
  function brush(ctx){
    function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
    function line(x,y,ex,ey,color,width=1){
      const dx=Math.abs(ex-x),dy=-Math.abs(ey-y),sx=x<ex?1:-1,sy=y<ey?1:-1;
      let err=dx+dy;
      for(;;){
        rect(x,y,width,width,color);
        if(x===ex&&y===ey)break;
        const e2=err*2;
        if(e2>=dy){err+=dy;x+=sx;}
        if(e2<=dx){err+=dx;y+=sy;}
      }
    }
    function poly(points,color){
      const ys=points.map(v=>v[1]),low=Math.min(...ys),high=Math.max(...ys);
      for(let y=low;y<high;y++){
        const cross=[],row=y+.5;
        for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[j],b=points[i];
          if((a[1]>row)!==(b[1]>row))cross.push(a[0]+(row-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cross.sort((a,b)=>a-b);
        for(let i=0;i+1<cross.length;i+=2){const x=Math.ceil(cross[i]-.5);rect(x,y,Math.ceil(cross[i+1]-.5)-x,1,color);}
      }
    }
    function oct(x,y,r,color){
      const b=Math.ceil(r*.43);
      poly([[x-r+b,y-r],[x+r-b,y-r],[x+r,y-r+b],[x+r,y+r-b],
        [x+r-b,y+r],[x-r+b,y+r],[x-r,y+r-b],[x-r,y-r+b]],color);
    }
    function bolt(x,y){rect(x,y,3,3,ink);rect(x,y,2,1,ivory);rect(x+1,y+1,1,1,rim);}
    function shield(x,y,outer,inner){
      poly([[x,y],[x+5,y+2],[x+11,y+3],[x+10,y+13],[x+7,y+17],[x,y+22],[x-7,y+17],[x-10,y+13],[x-11,y+3],[x-5,y+2]],outer);
      poly([[x,y+3],[x+8,y+5],[x+7,y+12],[x+4,y+16],[x,y+18],[x-5,y+15],[x-7,y+11],[x-7,y+5]],inner);
    }
    return {rect,line,poly,oct,bolt,shield};
  }

  const designs={
    'Reactor Tuning'({rect,line,oct,bolt}){
      rect(21,11,42,17,ink);rect(22,13,39,12,steel);
      for(const x of [23,55]){rect(x,10,6,18,copper);rect(x,11,2,14,amber);bolt(x+2,23);}
      oct(42,20,17,ink);oct(42,19,15,rim);oct(42,20,13,recess);oct(42,20,10,copper);
      oct(42,20,8,ember);oct(42,20,5,amber);oct(42,20,3,ivory);
      for(const [x,y,ex,ey] of [[34,10,39,13],[49,11,48,16],[51,23,46,26],[37,29,38,24]]){
        line(x,y,ex,ey,recess,3);line(x,y,ex,ey,rim);
      }
      rect(41,4,3,3,ivory);rect(41,32,3,2,copper);
    },
    'Overpressure'({rect,line,poly,bolt}){
      // Exposed feed belt and successive glowing rounds distinguish cadence from projectile speed.
      poly([[12,15],[17,15],[19,11],[34,11],[36,13],[38,13],[38,24],[30,24],[26,29],[21,29],[22,24],[14,24]],ink);
      poly([[14,16],[20,16],[21,13],[33,13],[34,15],[36,15],[36,21],[29,21],[26,24],[16,22]],steel);
      rect(20,13,12,2,rim);rect(17,17,13,2,copper);rect(17,17,9,1,amber);
      for(const x of [22,26,30]){rect(x,22,3,5,copper);rect(x,23,2,3,amber);}
      rect(34,13,5,11,ink);rect(35,14,4,8,rim);rect(36,17,3,4,recess);
      poly([[39,15],[44,18],[48,19],[44,20],[39,23],[41,19]],ember);rect(40,18,4,2,ivory);
      for(const [x,y] of [[48,18],[58,18],[68,18]]){
        poly([[x-2,y],[x+2,y],[x+4,y+2],[x+2,y+4],[x-2,y+4]],ember);
        rect(x-1,y+1,3,1,ivory);
      }
      line(28,10,30,7,amber,2);line(21,10,22,8,copper,2);bolt(14,20);
    },
    'Deep Magazine'({rect,line,poly,bolt}){
      poly([[25,5],[50,5],[53,22],[59,28],[55,35],[37,35],[29,25]],ink);
      poly([[27,7],[48,7],[52,23],[56,28],[53,32],[38,32],[32,24]],steel);
      poly([[32,10],[45,10],[49,24],[52,28],[40,28],[35,22]],recess);
      for(const [x,y] of [[32,10],[33,15],[35,20],[38,25]]){
        rect(x,y,9,3,copper);rect(x,y,7,1,amber);rect(x+7,y+1,4,1,ivory);
      }
      rect(25,5,26,3,rim);rect(26,8,25,2,ink);line(37,32,53,32,rim);bolt(50,27);
      rect(59,14,9,3,teal);rect(62,11,3,9,mint);
    },
    'Quick Feed'({rect,line,poly}){
      poly([[20,5],[56,5],[61,9],[61,14],[47,14],[44,18],[36,18],[35,14],[25,14],[24,17],[20,17]],ink);
      poly([[22,7],[54,7],[58,9],[58,12],[45,12],[43,15],[37,15],[36,12],[23,12]],steel);
      rect(24,7,29,2,rim);rect(38,12,6,2,amber);
      poly([[30,22],[44,20],[47,31],[44,34],[32,35]],ink);
      poly([[32,23],[43,22],[45,30],[42,32],[34,33]],copper);
      for(const x of [34,38])line(x,24,x+2,30,amber);
      poly([[54,27],[54,22],[51,22],[57,15],[63,22],[60,22],[60,27]],mint);
      rect(54,29,6,2,teal);line(25,28,25,22,steel);line(28,24,28,20,rim);
    },
    'Heat Sink'({rect,line,poly,bolt}){
      poly([[20,19],[49,13],[64,19],[63,28],[34,35],[20,28]],ink);
      poly([[22,21],[49,16],[62,20],[61,26],[34,32],[22,27]],copper);
      for(let i=0;i<7;i++){
        const x=24+i*4,y=21-Math.floor(i*.8);
        poly([[x,y-3],[x+3,y-4],[x+13,y+1],[x+13,y+9],[x+10,y+10],[x,y+4]],steel);
        line(x,y-3,x+10,y+2,frost);line(x+10,y+3,x+10,y+8,teal,2);
      }
      for(const [x,y] of [[29,14],[40,12],[50,10]]){
        line(x,y,x-2,y-3,teal);line(x-2,y-4,x,y-7,mint);
      }
      bolt(23,26);
    },
    'Fast Tracers'({rect,line,poly}){
      line(13,25,36,20,copper);line(16,29,44,22,ember,2);line(25,33,45,26,copper);
      poly([[32,23],[51,14],[62,12],[71,13],[66,19],[54,26],[39,28]],ink);
      poly([[34,24],[52,16],[63,13],[69,14],[62,19],[52,24],[39,26]],amber);
      poly([[53,17],[62,14],[68,14],[61,17],[54,19]],ivory);
      line(50,17,53,23,copper,2);line(40,21,43,25,ember,2);
      line(16,20,29,17,copper);line(34,14,49,11,steel);
    },
    'Arc Battery'({rect,line,poly,bolt}){
      rect(32,7,23,26,ink);rect(35,5,5,4,rim);rect(47,5,5,4,rim);
      rect(33,9,21,22,steel);rect(34,10,2,18,rim);rect(37,10,14,19,recess);
      poly([[45,9],[41,17],[45,17],[40,29],[51,15],[46,15],[50,9]],amber);
      line(45,11,42,16,ivory);rect(35,29,17,2,copper);bolt(33,9);
      for(const [x,y,s] of [[30,14,-1],[57,14,1]]){
        line(x,y,x+s*6,y+7,teal,2);line(x+s*6,y+7,x+s*3,y+7,mint);
        line(x+s*3,y+7,x+s*8,y+13,mint,2);
      }
    },
    'Field Capacitors'({rect,line,oct}){
      for(const [x,y,col] of [[24,12,teal],[35,9,blue]]){
        rect(x+1,y-3,6,4,rim);rect(x-2,y,12,20,ink);rect(x,y,8,18,steel);
        rect(x,y+3,8,10,col);rect(x+1,y+3,2,9,frost);
        rect(x,y+15,8,2,rim);rect(x+1,y+19,2,4,copper);rect(x+5,y+19,2,4,copper);
      }
      oct(54,23,11,ink);oct(54,23,9,mint);oct(54,23,7,recess);
      line(54,23,54,18,ivory,2);line(54,23,59,23,amber,2);
      line(49,11,57,11,teal);line(57,11,61,14,teal);rect(59,11,2,4,mint);
    },
    'Servo Stride'({rect,line,poly,oct}){
      poly([[35,5],[48,5],[51,11],[46,17],[45,23],[49,23],[55,26],[66,27],[66,32],[60,35],[38,34],[32,29],[33,21],[35,15]],ink);
      poly([[37,7],[46,7],[48,11],[44,17],[42,24],[46,26],[58,28],[62,29],[62,31],[40,31],[35,28],[36,19],[39,14]],steel);
      poly([[38,7],[46,7],[46,11],[41,15],[37,15]],rim);line(38,18,36,24,mint,2);
      oct(41,24,5,ink);oct(41,24,3,amber);rect(41,23,2,2,copper);
      line(49,26,57,28,ivory);rect(41,31,21,2,copper);for(const x of [40,46,52,58])rect(x,32,3,2,amber);
      for(const [x,y] of [[18,15],[12,22],[22,27]]){rect(x,y,11,1,teal);rect(x+4,y-1,8,1,mint);}
    },
    'Dash Bearings'({rect,line,poly,oct}){
      oct(42,20,15,ink);oct(42,20,13,rim);oct(42,20,10,recess);
      for(const [x,y] of [[42,11],[49,14],[51,21],[48,27],[40,29],[34,25],[33,18],[36,13]]){
        oct(x,y,2,teal);rect(x-1,y-1,2,1,frost);
      }
      oct(42,20,6,steel);oct(42,20,4,ink);rect(41,17,3,1,rim);
      line(20,21,24,13,copper,2);line(24,13,29,9,amber,2);
      line(56,31,63,25,teal,2);line(63,25,64,19,mint,2);
      poly([[59,20],[64,13],[69,20]],mint);rect(17,25,5,2,copper);
    },
    'Layered Plating'({rect,line,poly}){
      for(const [y,col,edge] of [[21,steel,teal],[15,rim,steel],[9,'#adbbb0','#71888a']]){
        const plate=[[20,y+4],[36,y-2],[53,y-2],[64,y+4],[45,y+12],[31,y+10]];
        poly(plate.map(([x,h])=>[x,h+3]),ink);poly(plate,edge);poly(plate.map(([x,h])=>[x,h-1]),col);
        line(21,y+3,35,y-2,ivory);line(46,y+10,61,y+4,ink);
      }
      rect(40,7,3,8,recess);rect(37,10,9,3,recess);rect(41,8,2,6,mint);rect(39,10,6,2,mint);
    },
    'Shield Reservoir'({rect,poly,shield}){
      poly([[23,8],[26,6],[41,6],[45,10],[45,29],[41,33],[26,33],[23,30]],ink);
      rect(25,10,18,19,steel);rect(27,11,14,17,recess);
      for(let y=14;y<=24;y+=5){rect(28,y,12,3,teal);rect(29,y,9,1,frost);}
      rect(25,7,16,3,rim);rect(25,29,17,2,rim);rect(26,11,2,15,blue);
      shield(52,9,ink,teal);shield(52,8,mint,teal);
      poly([[52,12],[57,14],[57,20],[52,25]],blue);rect(48,14,2,6,frost);
    },
    'Shield Wake'({rect,line,shield,poly}){
      shield(45,8,ink,steel);shield(45,7,mint,recess);
      poly([[43,12],[47,13],[48,17],[46,22],[43,24],[40,21],[39,16]],teal);
      line(13,23,23,23,steel,2);line(23,23,26,19,teal,2);line(26,19,29,25,teal,2);
      line(29,25,34,16,mint,2);line(34,16,38,19,mint,2);
      line(59,23,63,18,teal,2);line(63,18,67,20,mint,2);line(67,20,70,17,mint,2);
      rect(44,14,2,4,ivory);
    },
    'Salvage Magnet'({rect,line,poly}){
      const form=[[48,5],[50,10],[36,16],[33,20],[33,23],[37,27],[43,26],[54,19],[58,25],[47,32],[38,34],[30,32],[25,27],[23,21],[25,15],[30,10]];
      poly(form.map(([x,y])=>[x,y+2]),ink);poly(form,copper);
      line(25,18,30,12,ember,2);line(31,11,43,7,amber,2);line(27,24,32,30,ember,2);
      poly([[42,7],[48,5],[51,11],[45,14]],rim);poly([[49,21],[54,18],[59,25],[54,28]],rim);
      line(45,7,47,12,ivory);line(53,20,55,24,ivory);
      for(const [x,y,c] of [[57,7,amber],[66,11,teal],[60,16,rim]]){
        poly([[x,y-2],[x+3,y-1],[x+4,y+2],[x+1,y+4],[x-2,y+2]],c);rect(x,y-1,2,1,ivory);
      }
      line(52,13,55,11,teal);line(58,18,61,17,teal);
    }
  };

  // Use the actual weapon silhouette as the family identifier. The right-hand
  // side illustrates the family's impact: bursts, spread, pierce, blast, arc or drone.
  const calibration={
    'Assault Calibration':[0,ember],
    'Scatter Calibration':[6,amber],
    'Precision Calibration':[12,blue],
    'Ordnance Calibration':[19,ember],
    'Emitter Calibration':[24,violet],
    'Fabricator Calibration':[30,mint]
  };
  function caliber(ctx,tools,id,accent){
    const {rect,line,poly,oct}=tools;
    window.WeaponArt.draw(ctx,window.Combat.guns[id],31,21,1,0);
    rect(13,9,6,1,steel);rect(13,9,1,6,steel);
    rect(67,26,1,5,steel);rect(62,30,6,1,steel);
    switch(id){
      case 0:
        for(const x of [50,56,62]){rect(x,19,4,2,accent);rect(x+2,19,2,1,ivory);}
        line(67,16,70,12,copper,2);line(67,22,70,25,ember,2);break;
      case 6:
        for(const [x,y] of [[49,18],[50,22],[55,16],[57,21],[56,25],[63,13],[65,20],[63,28]]){
          rect(x,y,3,2,accent);rect(x+1,y,1,1,ivory);
        }break;
      case 12:
        for(const x of [55,63]){poly([[x,12],[x+3,14],[x+1,26],[x-2,24]],steel);rect(x,13,2,2,blue);}
        rect(47,19,23,2,accent);rect(51,19,18,1,ivory);break;
      case 19:
        oct(62,19,9,copper);poly([[62,7],[65,15],[71,14],[67,19],[70,25],[63,23],[59,30],[59,23],[52,22],[57,18],[55,12],[61,15]],accent);
        oct(62,19,4,amber);rect(61,17,3,3,ivory);break;
      case 24:
        for(const [x,y,ex,ey] of [[46,21,52,16],[52,16,52,21],[52,21,60,15],[60,15,66,12],[59,16,66,23]]){
          line(x,y,ex,ey,accent,2);line(x,y,ex,ey,frost);
        }oct(67,11,3,teal);oct(67,23,3,teal);rect(66,10,2,2,ivory);rect(66,22,2,2,ivory);break;
      case 30:
        for(const [x,y] of [[53,13],[61,22]]){
          poly([[x-5,y-4],[x,y-1],[x+6,y-4],[x+5,y],[x+2,y+2],[x,y+5],[x-2,y+2],[x-5,y]],teal);
          rect(x-1,y,3,3,amber);rect(x-4,y-3,2,1,mint);rect(x+3,y-3,2,1,mint);
        }line(65,21,70,18,accent);break;
    }
  }
  function draw(ctx,name){
    const chassis=Object.hasOwn(designs,name)?designs[name]:null;
    const family=Object.hasOwn(calibration,name)?calibration[name]:null;
    if(!chassis&&!family)return false;
    const tools=brush(ctx);
    ctx.save();
    if(chassis)chassis(tools);else caliber(ctx,tools,...family);
    ctx.restore();return true;
  }
  window.ChassisArt={draw};
})();
