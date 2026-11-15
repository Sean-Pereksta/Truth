// Shared alliance sight and deliberately stale observations. Terrain is public;
// enemy armies and changing structures are intelligence, never global truth.
export class WarVision {
  constructor(game){this.game=game;this.revision=0;this.nextUpdate=-Infinity;this.alliances=new Map();this.sources=new Map();this.stats={changedSources:0,changedCells:0,ownerReads:0};}
  get enabled(){return !!this.game.config.fogOfWar;}
  alliance(team){return this.game.teams[team]?.alliance??team;}
  dataFor(team){
    const alliance=this.alliance(team);let data=this.alliances.get(alliance);
    if(!data){const size=this.game.W*this.game.H;data={current:new Uint8Array(size),explored:new Uint8Array(size),owners:new Int16Array(size).fill(-1),buildings:new Map(),castles:new Map(),counts:new Uint32Array(size),positions:new Uint32Array(size),visible:new Uint32Array(size),visibleCount:0};this.alliances.set(alliance,data);}
    return data;
  }
  gridFor(team){if(!this.enabled)return null;this.update();return this.dataFor(team).current;}
  exploredFor(team){if(!this.enabled)return null;this.update();return this.dataFor(team).explored;}
  ownersFor(team){if(!this.enabled)return null;this.update();return this.dataFor(team).owners;}
  sightRadius(entity){
    if(entity.type==='tower')return 12+Math.max(0,(entity.level||1)-1)*3;
    if(entity.type==='keep')return 9+Math.max(0,(entity.level||1)-1);
    const kind=this.game.unitClass(entity);
    if(kind==='cavalry'||kind==='hero')return 8;
    if(kind==='siege')return 5;
    if(['infantry','archer'].includes(kind))return 6;
    return 4;
  }
  isVisible(team,x,y){
    if(!this.enabled)return true;this.update();const xx=Math.floor(x),yy=Math.floor(y);
    return Number.isFinite(xx)&&Number.isFinite(yy)&&xx>=0&&yy>=0&&xx<this.game.W&&yy<this.game.H&&!!this.dataFor(team).current[yy*this.game.W+xx];
  }
  changeSpan(data,y,left,right,delta){
    if(right<left)return;this.stats.changedCells+=right-left+1;
    const start=y*this.game.W+left,end=y*this.game.W+right;
    for(let i=start;i<=end;i++){
      const previous=data.counts[i],count=previous+delta;data.counts[i]=count;
      if(!previous&&count){data.current[i]=1;data.explored[i]=1;data.positions[i]=data.visibleCount;data.visible[data.visibleCount++]=i;}
      else if(previous&&!count){data.current[i]=0;const position=data.positions[i],last=data.visible[--data.visibleCount];data.visible[position]=last;data.positions[last]=position;}
    }
  }
  removeSource(record){for(let y=record.y0;y<=record.y1;y++){const p=(y-record.y0)*2;this.changeSpan(record.data,y,record.spans[p],record.spans[p+1],-1);}}
  mark(data,entity){
    const g=this.game,r=this.sightRadius(entity),seen=this.revision+1;
    let record=this.sources.get(entity);
    if(!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||!Number.isFinite(r)){if(record){this.removeSource(record);this.sources.delete(entity);}return;}
    if(record&&record.x===entity.x&&record.y===entity.y&&record.r===r&&record.data===data){record.seen=seen;return;}
    this.stats.changedSources++;
    const y0=Math.max(0,Math.floor(entity.y-r)),y1=Math.min(g.H-1,Math.floor(entity.y+r)),length=Math.max(0,y1-y0+1)*2;
    const spans=record?.spare?.length>=length?record.spare:new Int32Array(length),rr=r*r;
    for(let y=y0;y<=y1;y++){
      const dy=y+.5-entity.y,dy2=dy*dy,p=(y-y0)*2;
      if(dy2>rr){spans[p]=1;spans[p+1]=0;continue;}
      const reach=Math.sqrt(rr-dy2);let left=Math.min(g.W,Math.max(0,Math.ceil(entity.x-.5-reach))),right=Math.max(-1,Math.min(g.W-1,Math.floor(entity.x-.5+reach)));
      // Correct endpoints with the original predicate to preserve exact boundary cells.
      while(left<=right&&(left+.5-entity.x)**2+dy2>rr)left++;
      while(left>0&&(left-.5-entity.x)**2+dy2<=rr)left--;
      while(right>=left&&(right+.5-entity.x)**2+dy2>rr)right--;
      while(right<g.W-1&&(right+1.5-entity.x)**2+dy2<=rr)right++;
      spans[p]=left;spans[p+1]=right;
    }
    if(record&&record.data===data){
      // Moving a circle normally changes only a thin strip at its perimeter.
      // Overlapping cells retain their counts instead of being erased/repainted.
      for(let y=Math.min(y0,record.y0);y<=Math.max(y1,record.y1);y++){
        const old=(y-record.y0)*2,next=(y-y0)*2,oldLeft=y>=record.y0&&y<=record.y1?record.spans[old]:1,oldRight=y>=record.y0&&y<=record.y1?record.spans[old+1]:0,newLeft=y>=y0&&y<=y1?spans[next]:1,newRight=y>=y0&&y<=y1?spans[next+1]:0;
        if(oldLeft===newLeft&&oldRight===newRight)continue;
        if(oldRight>=oldLeft){if(newRight<newLeft)this.changeSpan(data,y,oldLeft,oldRight,-1);else{this.changeSpan(data,y,oldLeft,Math.min(oldRight,newLeft-1),-1);this.changeSpan(data,y,Math.max(oldLeft,newRight+1),oldRight,-1);}}
        if(newRight>=newLeft){if(oldRight<oldLeft)this.changeSpan(data,y,newLeft,newRight,1);else{this.changeSpan(data,y,newLeft,Math.min(newRight,oldLeft-1),1);this.changeSpan(data,y,Math.max(newLeft,oldRight+1),newRight,1);}}
      }
    }else{
      if(record)this.removeSource(record);
      for(let y=y0;y<=y1;y++){const p=(y-y0)*2;this.changeSpan(data,y,spans[p],spans[p+1],1);}
    }
    const spare=record?.spans;if(!record){record={};this.sources.set(entity,record);}record.x=entity.x;record.y=entity.y;record.r=r;record.data=data;record.y0=y0;record.y1=y1;record.spans=spans;record.spare=spare;record.seen=seen;
  }
  buildingSnapshot(b){return Object.freeze({id:b.id,type:b.type,team:b.team,x:b.x,y:b.y,hp:b.hp,maxHp:b.maxHp,level:b.level,radius:b.radius,castleId:b.castleId,restoredCastle:b.restoredCastle,remembered:true,lastSeen:this.game.time});}
  castleSnapshot(site){return Object.freeze({...site,progress:Object.freeze([...(site.progress||[])]),remembered:true,lastSeen:this.game.time});}
  update(force=false){
    if(!this.enabled)return;const g=this.game;if(!force&&g.time<this.nextUpdate)return;this.nextUpdate=g.time+.2;
    this.stats.changedSources=0;this.stats.changedCells=0;this.stats.ownerReads=0;
    const teamData=g.teams.map(s=>this.dataFor(s.id));
    for(const entity of g.units)if(entity.hp>0&&g.teams[entity.team]?.alive)this.mark(teamData[entity.team],entity);
    for(const entity of g.buildings)if(entity.hp>0&&g.teams[entity.team]?.alive)this.mark(teamData[entity.team],entity);
    for(const [entity,record]of this.sources)if(record.seen!==this.revision+1){this.removeSource(record);this.sources.delete(entity);}
    // Each owned tile updates its alliance once. Hidden losses remain stale.
    for(let i=0;i<g.tiles.length;i++){const owner=g.tiles[i].owner;if(owner>=0&&teamData[owner])teamData[owner].owners[i]=owner;}
    this.stats.ownerReads=g.tiles.length;
    const buildings=new Map();for(const b of g.buildings)if(b.hp>0)buildings.set(b.id,b);
    const castles=new Map((g.castles||[]).map(site=>[site.id,site]));
    for(const [alliance,data]of this.alliances){
      for(let j=0;j<data.visibleCount;j++){const i=data.visible[j];data.owners[i]=g.tiles[i].owner;}
      this.stats.ownerReads+=data.visibleCount;
      const visible=point=>{const x=Math.floor(point.x),y=Math.floor(point.y);return x>=0&&y>=0&&x<g.W&&y<g.H&&!!data.current[y*g.W+x];};
      for(const [id,memory]of data.buildings)if(visible(memory)&&(!buildings.has(id)||g.teams[buildings.get(id).team]?.alliance===alliance))data.buildings.delete(id);
      for(const b of buildings.values())if(g.teams[b.team]?.alliance!==alliance&&visible(b))data.buildings.set(b.id,this.buildingSnapshot(b));
      for(const [id,memory]of data.castles)if(visible(memory)&&!castles.has(id))data.castles.delete(id);
      for(const site of castles.values())if(visible(site))data.castles.set(site.id,this.castleSnapshot(site));
    }
    this.revision++;
  }
  knownUnits(team){
    if(!this.enabled)return this.game.units.filter(u=>u.hp>0);
    this.update();const g=this.game,grid=this.dataFor(team).current,alliance=this.alliance(team),known=[];
    for(const u of g.units){if(u.hp<=0)continue;const x=Math.floor(u.x),y=Math.floor(u.y);if(g.teams[u.team]?.alliance===alliance||x>=0&&y>=0&&x<g.W&&y<g.H&&grid[y*g.W+x])known.push(u);}
    return known;
  }
  knownBuildings(team){
    this.update();const g=this.game,data=this.dataFor(team),grid=data.current,alliance=this.alliance(team),disabled=!this.enabled,current=[],ids=new Set();
    for(const b of g.buildings){if(b.hp<=0)continue;const x=Math.floor(b.x),y=Math.floor(b.y);if(disabled||g.teams[b.team]?.alliance===alliance||x>=0&&y>=0&&x<g.W&&y<g.H&&grid[y*g.W+x]){current.push(b);ids.add(b.id);}}
    for(const memory of data.buildings.values())if(!ids.has(memory.id))current.push(memory);
    return current;
  }
  knownCastleSites(team){
    this.update();const g=this.game,data=this.dataFor(team),grid=data.current,alliance=this.alliance(team),disabled=!this.enabled,current=[],ids=new Set();
    for(const site of g.castles||[]){const x=Math.floor(site.x),y=Math.floor(site.y);if(disabled||site.team>=0&&g.teams[site.team]?.alliance===alliance||x>=0&&y>=0&&x<g.W&&y<g.H&&grid[y*g.W+x]){current.push(site);ids.add(site.id);}}
    for(const memory of data.castles.values())if(!ids.has(memory.id))current.push(memory);
    return current;
  }
}
