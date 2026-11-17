(function(){
  'use strict';
  const W=window.OW,G=W.Game.prototype,R=W.Renderer.prototype,WP=W.World.prototype;
  const schedules={
    ironveil:[
      ['Mara','bread runner',0,0,0,2,0,'The night foreman lets me take the flour cart through the station arch. The guards check the main road.'],
      ['Brass','porter',1,2,0,2,2,'A freight whistle means a new shift. The workers come home along Clockmakers’ Cut.'],
      ['Pella','market cook',2,3,3,5,3,'My second pot goes to the couriers. They eat standing up and leave by the canal.'],
      ['Moth','proof runner',3,6,2,6,4,'I bring the union a clean galley every night. Watch the brass clock over the arcade.'],
      ['Tern','lock tender',4,3,4,3,2,'Canal lamps go out at curfew. The white stripe on the footbridge stays visible.'],
      ['Aster','mill nurse',5,1,4,2,4,'The clinic takes its deliveries down the back lane. The shutters are open for one more shift.'],
      ['Bix','clock winder',1,4,4,4,2,'One tooth on Union Clock is missing. It skips at the same minute every night.'],
      ['Olive','news seller',0,7,5,7,3,'The early edition goes straight to the freight lifts. I save yesterday’s paper for wrapping fish.']
    ],
    blackglass:[
      ['Vellum','night compositor',3,1,1,3,1,'The typesetters leave a light in the bindery. We can find our way by the gold on the glass.'],
      ['Sable','embassy porter',2,7,2,6,2,'The embassy gates close at the trumpet. The little lane beside the florist stays open.'],
      ['Nix','tram conductor',1,3,3,3,5,'The night mail waits for nobody. I ring twice before the carriage moves.'],
      ['Wren','street florist',5,4,4,4,2,'I put a blue wreath on the ministry rail for every name they leave out of the papers.'],
      ['Dot','copy clerk',4,2,5,1,5,'The night press has two doors. One takes the paper in, the other lets the truth out.'],
      ['Fennel','cafe owner',0,0,4,0,2,'People used to linger here. Now I serve the coffee in cups they can carry.'],
      ['Parch','messenger',3,5,0,5,2,'After the last delivery I bring my satchel to the archive steps and wait for the tram.'],
      ['Lumen','lamp mender',1,6,5,6,4,'They want the boulevard bright. You can still see the little stars down the mews.']
    ]
  };
  const network=new WeakMap(),current=new WeakMap(),shots=new WeakMap();
  const fire=G.cityGunshot;
  G.cityGunshot=function(hero,gun){
    const result=fire.apply(this,arguments),city=W.CityWatch.zone(this.world,hero);
    if(!this.paused&&city)shots.set(this.world,{city:city.key,x:hero.x,y:hero.y,until:this.time+1.5});
    return result;
  };
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function trip(points,speed,wait){
    const stops=[],route=[...points,...points.slice(1,-1).reverse()],edges=route.map((p,i)=>[p,route[(i+1)%route.length]]);
    let total=0;
    for(const [a,b] of edges){stops.push({a,b:a,start:total,end:total+wait,walk:false});total+=wait;
      const duration=dist(a,b)/speed;stops.push({a,b,start:total,end:total+duration,walk:true});total+=duration;}
    return {stops,total};
  }
  function physical(w,x,y,ox,oy){
    if(!w.isBlocked(x+ox,y+oy,15))return {x:x+ox,y:y+oy};
    return {x,y};
  }
  function population(w){
    if(network.has(w))return network.get(w);
    const groups=new Map();
    for(const c of w.cityZones||[]){
      const people=[],X=c.streetsX,Y=c.streetsY;
      for(const [i,[name,trade,role,ax,ay,bx,by,line]] of schedules[c.key].entries()){
        const side=i%2?1:-1,dx=ax===bx?side*24:0,dy=ay===by?side*21:0;
        const a=physical(w,X[ax],Y[ay],dx,dy),b=physical(w,X[bx],Y[by],dx,dy);
        const route=trip([a,b],i%3===0?55:40,5+i%4);
        for(let j=0;j<3;j++){
          people.push({id:c.id+'_commuter_'+i+'_'+j,type:'friendlyCat',cityCitizen:true,cityKey:c.key,name:j?'':name,trade,line,role:(role+j)%6,skin:(i+j)%4,region:c.region,friendly:true,w:55,h:72,
            route,offset:route.total*(j/3+(i*.137)%1),x:a.x,y:a.y,walk:false,flip:false});
        }
      }
      for(const [i,r] of c.routes.filter(r=>r.kind==='rail'&&r.points.length>3).entries()){
        people.push({id:c.id+'_moving_tram_'+i,type:'streetFixture',painting:'civic-10',cityVehicle:true,w:128,h:95,cityKey:c.key,region:c.region,route:trip(r.points,59,6),offset:i*3,x:r.points[0].x,y:r.points[0].y});
      }
      for(const canal of c.canals){const x=canal.x+canal.w*.5;
        people.push({id:c.id+'_working_barge',type:'streetFixture',painting:'civic-11',cityVehicle:true,w:82,h:64,cityKey:c.key,region:c.region,route:trip([{x,y:canal.y+22},{x,y:canal.y+canal.h-22}],28,8),offset:8,x,y:canal.y});}
      groups.set(c.key,people);
    }
    network.set(w,groups);return groups;
  }
  function sample(actor,t){
    const phase=((t+actor.offset)%actor.route.total+actor.route.total)%actor.route.total;
    const s=actor.route.stops.find(v=>v.end>=phase)||actor.route.stops.at(-1),fraction=(phase-s.start)/(s.end-s.start||1);
    return {x:s.a.x+(s.b.x-s.a.x)*fraction,y:s.a.y+(s.b.y-s.a.y)*fraction,walk:s.walk,flip:s.b.x<s.a.x};
  }
  function shelter(w,city,actor,guard){
    let best=null,score=Infinity;
    for(const wall of city.cover){
      const p={x:Math.min(wall.x+wall.w,Math.max(wall.x,actor.x)),y:wall.y+wall.h+22};
      const length=dist(actor,p);if(length>205||length>=score||!w._navigationRay(actor.x,actor.y,p.x,p.y,13))continue;
      const covered=W.CityWatch.limit(guard,Math.atan2(p.y-guard.y,p.x-guard.x),[wall])<dist(guard,p);
      const cost=length+(covered?0:65);if(cost<score){score=cost;best=p;}
    }return best||{x:actor.x,y:actor.y};
  }
  function stepTo(g,actor,p,step){
    const gap=dist(actor,p);if(gap<2)return true;
    const amount=Math.min(step,gap)/gap,dx=(p.x-actor.x)*amount,dy=(p.y-actor.y)*amount;
    g.move(actor,dx,dy,12);actor.walk=true;actor.flip=dx<0;return false;
  }
  function update(g,dt){
    const w=g.world;
    if(!w.cityZones||w.isDungeon){if(w)current.delete(w);return;}
    const districts=new Set(g.players.map(p=>W.CityWatch.zone(w,p)?.key).filter(Boolean));
    if(!districts.size){current.delete(w);return;}
    const visible=[],groups=population(w),shot=shots.get(w);
    for(const key of districts){
      const watch=w.activeEnemies.filter(e=>e.cityWatch===key&&e.hp>0&&e.watchMode==='alarm');
      for(const actor of groups.get(key)||[]){
        if(actor.cityCitizen){
          if(actor.refugeUntil==null)Object.assign(actor,sample(actor,g.time));
          const noise=shot?.city===key&&shot.until>g.time&&dist(actor,shot)<420?shot:null;
          const alarm=noise||watch.find(e=>dist(actor,e)<255);
          // Civilians stop at the next sheltered doorway when the watch sounds.
          if(alarm&&actor.refugeUntil==null){actor.refugeStarted=g.time;actor.refugeUntil=g.time+5.5;actor.shelter=shelter(w,w.cityZones.find(c=>c.key===key),actor,alarm);actor.rejoin={x:actor.x,y:actor.y};}
          if(actor.refugeUntil!=null&&g.time<actor.refugeUntil){actor.sheltering=stepTo(g,actor,actor.shelter,dt*86);actor.walk=!actor.sheltering;visible.push(actor);continue;}
          if(actor.refugeUntil!=null){
            actor.sheltering=false;
            if(!stepTo(g,actor,actor.rejoin,dt*64)){visible.push(actor);continue;}
            actor.offset-=g.time-actor.refugeStarted;actor.refugeUntil=null;
          }
        }
        if(!actor.cityCitizen)Object.assign(actor,sample(actor,g.time));
        visible.push(actor);
      }
    }
    current.set(w,visible);
  }
  const missions=G.updateMissions;
  G.updateMissions=function(dt){const result=missions.apply(this,arguments);if(!this.paused)update(this,dt);return result;};
  const fetch=WP.getVisibleObjects;
  WP.getVisibleObjects=function(x,y,w,h,list,seen){
    const result=fetch.apply(this,arguments);
    for(const actor of current.get(this)||[])if(actor.x+actor.w>x&&actor.x-actor.w<x+w&&actor.y+actor.h>y&&actor.y-actor.h<y+h)result.push(actor);
    return result;
  };
  const position=R.friendlyPosition;
  R.friendlyPosition=function(o){return o.cityCitizen?{x:o.x,y:o.y,walk:o.walk,flip:o.flip}:position.call(this,o);};
  const draw=R.drawObject;
  R.drawObject=function(o,w){
    if(o.cityCitizen&&o.sheltering){this.ctx.save();this.ctx.translate(o.x,o.y);this.ctx.scale(1,.78);this.ctx.translate(-o.x,-o.y);draw.apply(this,arguments);this.ctx.restore();return;}
    return draw.apply(this,arguments);
  };
  function listener(g,p){
    const people=current.get(g.world);if(!people)return;
    const nearby=people.find(o=>o.name&&!o.cityVehicle&&dist(o,p)<59);
    return nearby&&!g.world.locations.some(l=>l.city&&dist(l,p)<132)?nearby:null;
  }
  const interact=G.interact;
  G.interact=function(p){
    const npc=!this.paused&&!p.downed&&listener(this,p);
    if(!npc||this.players.some(q=>q.downed&&dist(q,p)<105))return interact.apply(this,arguments);
    this.audio.vocal?.('cat_greet',npc,this);this.ui.toast(npc.name+', '+npc.trade+' · '+(npc.sheltering?'Down. The watch has the street.':npc.line),'quest');return true;
  };
  const labels=R.drawLocationLabels;
  R.drawLocationLabels=function(w){const result=labels.apply(this,arguments);if(!current.has(w))return result;
    for(const p of this.game.players){const n=listener(this.game,p);if(n)this.worldLabel(n.name+' · '+n.trade,n.x,n.y-66,'#f1dfb0',12);}
    return result;
  };
  const region=W.UI.prototype.hudRegionInfo;
  W.UI.prototype.hudRegionInfo=function(p){
    const city=W.CityWatch.zone(this.game.world,p);if(!city)return region.call(this,p);
    if(!this.cityAddress||this.cityAddress.key!==city.key||dist(this.cityAddress,p)>32){
      let road=null,best=Infinity;
      for(const r of city.routes)for(let i=1;i<r.points.length;i++){
        const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        const gap=Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y);if(gap<best){road=r;best=gap;}
      }
      const quarter=city.quarters[(p.y-city.top>1550?2:0)+(p.x-city.left>2020?1:0)];
      this.cityAddress={key:city.key,x:p.x,y:p.y,title:city.name,subtitle:quarter+' · '+(road?.name||'Curfew in effect')};
    }return this.cityAddress;
  };
  W.CityLife={population,update,sample};
}());
