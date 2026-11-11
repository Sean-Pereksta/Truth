(function () {
  'use strict';
  const W=window.OW,World=W.World;
  if(!World||World.prototype._deepEnemyPlacement)return;
  World.prototype._deepEnemyPlacement=true;
  const originalBuild=World.prototype._buildEnemies;
  const separation=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function randomFor(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  World.prototype._buildEnemies=function(){
    originalBuild.call(this);
    const types=['blackglass_reaver','cinder_mortar'].map(id=>W.Content.deepEnemyTypes?.[id]);
    if(types.some(type=>!Number.isInteger(type)||!W.Content.enemies[type]))return;
    const clear=(point,region)=>this.regionAt(point.x,point.y).index===region&&!this.isBlocked(point.x,point.y,24)&&!this.safeZoneAt(point.x,point.y,180)&&!this.gateAt(point.x,point.y,180);
    const occupied=point=>[...this._spawns.values()].some(e=>separation(e,point)<55);
    const add=(id,type,point,region,locationId,patrol)=>{
      this._spawn({id,type,x:point.x,y:point.y,homeX:point.x,homeY:point.y,level:this.regions[region].level+2,region,locationId,boss:false,patrol,deepEnemy:true});
    };
    for(const region of [6,7,8,9]){
      if(!this.regions[region])continue;
      // This private generator never consumes the old patrol/scenery sequence.
      const random=randomFor(this.seed+843917+region*1237);
      const bases=this.locations.filter(l=>l.region===region&&l.type==='base'&&!this.gateAt(l.x,l.y,400));
      const base=bases[0];
      if(base){
        const entrance={x:base.x,y:base.y+310};
        for(let kind=0;kind<2;kind++){
          let point=null;
          for(let ring=0;ring<6&&!point;ring++)for(let j=0;j<12;j++){
            const angle=(j+kind*6)*Math.PI/6,radius=55+ring*28,candidate={x:base.x+Math.cos(angle)*radius,y:base.y+210+Math.sin(angle)*radius};
            if(clear(candidate,region)&&!occupied(candidate)&&this._navigationRay(candidate.x,candidate.y,entrance.x,entrance.y,20)){point=candidate;break;}
          }
          if(point)add('deep_'+base.id+'_'+kind,types[kind],point,region,base.id,kind*Math.PI);
        }
      }
      // Pick traversable roadside ground, separated from settlements, bosses,
      // objectives and one another. The normal stream/save lifecycle owns them.
      const candidates=[];
      for(const road of this.roads.filter(r=>['arterial','highway','lane'].includes(r.kind))){
        const dx=road.x2-road.x1,dy=road.y2-road.y1,length=Math.hypot(dx,dy),steps=Math.max(1,Math.floor(length/180));
        for(let j=1;j<steps;j++){
          const t=j/steps,center={x:road.x1+dx*t,y:road.y1+dy*t};
          if(!clear(center,region)||this.locations.some(l=>separation(center,l)<l.radius+(l.type==='boss'?450:300)))continue;
          const normal={x:-dy/(length||1),y:dx/(length||1)},pair=[-1,1].map(side=>({x:center.x+normal.x*60*side,y:center.y+normal.y*60*side}));
          if(pair.some(point=>!clear(point,region)||occupied(point)||!this._navigationRay(center.x,center.y,point.x,point.y,20)))continue;
          candidates.push({center,pair,angle:Math.atan2(dy,dx),order:random()});
        }
      }
      candidates.sort((a,b)=>a.order-b.order);
      const placed=[];
      for(const candidate of candidates){
        if(placed.some(point=>separation(point,candidate.center)<1100)||candidate.pair.some(occupied))continue;
        const group=placed.length;candidate.pair.forEach((point,kind)=>add('deep_patrol_'+region+'_'+group+'_'+kind,types[kind],point,region,null,candidate.angle+kind*Math.PI));
        placed.push(candidate.center);if(placed.length===2)break;
      }
    }
  };
})();
