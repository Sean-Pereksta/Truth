// Shared alliance sight and deliberately stale observations. Terrain is public;
// enemy armies and changing structures are intelligence, never global truth.
export class WarVision {
  constructor(game){this.game=game;this.revision=0;this.nextUpdate=-Infinity;this.alliances=new Map();}
  get enabled(){return !!this.game.config.fogOfWar;}
  alliance(team){return this.game.teams[team]?.alliance??team;}
  dataFor(team){
    const alliance=this.alliance(team);let data=this.alliances.get(alliance);
    if(!data){data={current:new Uint8Array(this.game.W*this.game.H),explored:new Uint8Array(this.game.W*this.game.H),owners:new Int16Array(this.game.W*this.game.H).fill(-1),buildings:new Map(),castles:new Map()};this.alliances.set(alliance,data);}
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
  mark(data,entity){
    const g=this.game,r=this.sightRadius(entity),rr=r*r,x0=Math.max(0,Math.floor(entity.x-r)),x1=Math.min(g.W-1,Math.floor(entity.x+r)),y0=Math.max(0,Math.floor(entity.y-r)),y1=Math.min(g.H-1,Math.floor(entity.y+r));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if((x+.5-entity.x)**2+(y+.5-entity.y)**2<=rr){const index=y*g.W+x;data.current[index]=1;data.explored[index]=1;}
  }
  buildingSnapshot(b){return Object.freeze({id:b.id,type:b.type,team:b.team,x:b.x,y:b.y,hp:b.hp,maxHp:b.maxHp,level:b.level,radius:b.radius,castleId:b.castleId,restoredCastle:b.restoredCastle,remembered:true,lastSeen:this.game.time});}
  castleSnapshot(site){return Object.freeze({...site,progress:Object.freeze([...(site.progress||[])]),remembered:true,lastSeen:this.game.time});}
  update(force=false){
    if(!this.enabled)return;const g=this.game;if(!force&&g.time<this.nextUpdate)return;this.nextUpdate=g.time+.2;
    for(const s of g.teams)this.dataFor(s.id);
    for(const data of this.alliances.values())data.current.fill(0);
    for(const entity of [...g.units,...g.buildings])if(entity.hp>0&&g.teams[entity.team]?.alive)this.mark(this.dataFor(entity.team),entity);
    const buildings=new Map(g.buildings.filter(b=>b.hp>0).map(b=>[b.id,b])),castles=new Map((g.castles||[]).map(site=>[site.id,site]));
    for(const [alliance,data]of this.alliances){
      for(let i=0;i<g.tiles.length;i++){const owner=g.tiles[i].owner;if(data.current[i]||owner>=0&&g.teams[owner]?.alliance===alliance)data.owners[i]=owner;}
      const visible=point=>{const x=Math.floor(point.x),y=Math.floor(point.y);return x>=0&&y>=0&&x<g.W&&y<g.H&&!!data.current[y*g.W+x];};
      for(const [id,memory]of data.buildings)if(visible(memory)&&(!buildings.has(id)||g.teams[buildings.get(id).team]?.alliance===alliance))data.buildings.delete(id);
      for(const b of buildings.values())if(g.teams[b.team]?.alliance!==alliance&&visible(b))data.buildings.set(b.id,this.buildingSnapshot(b));
      for(const [id,memory]of data.castles)if(visible(memory)&&!castles.has(id))data.castles.delete(id);
      for(const site of castles.values())if(visible(site))data.castles.set(site.id,this.castleSnapshot(site));
    }
    this.revision++;
  }
  knownUnits(team){this.update();return this.game.units.filter(u=>u.hp>0&&(this.game.allied(team,u.team)||this.isVisible(team,u.x,u.y)));}
  knownBuildings(team){
    this.update();const current=this.game.buildings.filter(b=>b.hp>0&&(this.game.allied(team,b.team)||this.isVisible(team,b.x,b.y))),ids=new Set(current.map(b=>b.id));
    return [...current,...[...this.dataFor(team).buildings.values()].filter(memory=>!ids.has(memory.id))];
  }
  knownCastleSites(team){
    this.update();const current=(this.game.castles||[]).filter(site=>this.game.allied(team,site.team)||this.isVisible(team,site.x,site.y)),ids=new Set(current.map(site=>site.id));
    return [...current,...[...this.dataFor(team).castles.values()].filter(memory=>!ids.has(memory.id))];
  }
}
