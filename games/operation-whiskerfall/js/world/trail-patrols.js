(function () {
  'use strict';
  const W=window.OW, C=W.Content;
  const World=W.World.prototype;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const ambient=id=>/^(?:trail_|(?:recon_|deep_)?patrol_|event-)/.test(id);
  const localRadius=625, packSpacing=790, arrivalRadius=1120;

  World.quietApproach=function(x,y){
    return this.safeZoneAt(x,y,360)||Math.hypot(x-this.start.x,y-this.start.y)<arrivalRadius;
  };
  World.installTrailPatrols=function(){
    // Keep stable IDs for missions, clearable outposts and old campaign saves.
    // Optional patrols are placed after all settlements and their walls exist.
    const posted=[...this._spawns.values()], added=[];
    for(const region of this.regions){
      const sites=this.locations.filter(l=>l.region===region.index);
      const outposts=sites.filter(l=>l.type==='base'), trails=sites.filter(l=>l.type==='cache'||l.type==='cave');
      const groups=[trails,outposts];
      for(const anchors of groups){
        let placed=false;
        for(const anchor of anchors){
          if(placed)break;
          const kind=(region.index+added.length)%2;
          for(let step=0;step<16;step++){
            const a=(step+region.index)*Math.PI/8, offset=anchor.type==='base'?890:anchor.type==='cave'?730:375;
            const point={x:anchor.x+Math.cos(a)*offset,y:anchor.y+Math.sin(a)*offset};
            const mate={x:point.x+Math.cos(a+Math.PI/2)*91,y:point.y+Math.sin(a+Math.PI/2)*91};
            const pair=region.index>1&&added.length%2===0?[point,mate]:[point];
            if(pair.some(p=>this.regionAt(p.x,p.y)!==region||this.isBlocked(p.x,p.y,24)||this.quietApproach(p.x,p.y)||this.gateAt(p.x,p.y,80)))continue;
            if(posted.some(p=>distance(p,point)<localRadius)||added.some(p=>distance(p,point)<packSpacing))continue;
            if(!this._navigationRay(point.x,point.y,mate.x,mate.y,19))continue;
            pair.forEach((p,i)=>{
              const id=(kind+i)%2?'seam_ripper':'gallows_bell';
              this._spawn({id:'trail_'+anchor.id+'_'+i,type:C.trailEnemyTypes[id],...p,homeX:p.x,homeY:p.y,level:region.level,region:region.index,boss:false,patrol:a});
            });
            added.push({...point,region:region.index});placed=true;break;
          }
        }
      }
    }
  };
  World.selectTrailPatrols=function(ranked,players){
    const chosen=[],positions=[];
    // Reserve space for authored encounters and preserve already visible actors.
    // A transient spawn cannot displace a pursuer or materialize beside P2.
    for(const [id,{def}] of ranked)if(!ambient(id)||this._active.has(id))positions.push(this._active.get(id)||this._dormant.get(id)||def);
    for(const entry of ranked){
      const [id,item]=entry,def=this._dormant.get(id)||item.def;
      if(ambient(id)&&!this._active.has(id)){
        if(players.some(p=>(def.x-p.x)**2+(def.y-p.y)**2<360**2)||this.quietApproach(def.x,def.y))continue;
        let local=0,overlap=false;
        const pack=id.slice(0,id.lastIndexOf('_'));
        for(const other of positions){
          const d=distance(other,def);
          if(d>=localRadius)continue;
          local++;
          if(d<470&&other.id.slice(0,other.id.lastIndexOf('_'))!==pack)overlap=true;
        }
        if(overlap||local>=2)continue;
        positions.push(def);
      }
      chosen.push(entry);
    }
    return chosen;
  };
})();
