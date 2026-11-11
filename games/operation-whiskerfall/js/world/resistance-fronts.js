(function(){
  'use strict';
  const W=window.OW,build=W.World.prototype._buildLocations;
  W.World.prototype._buildLocations=function(){build.call(this);for(const q of W.Content.invasions||[]){
    const region=this.regions[q.region],x=region.x+1900*this.coordinateScale,y=region.y+2850*this.coordinateScale;
    this._addLocation({id:q.target,name:q.frontName,type:'invasion',x,y,region:q.region,radius:620,questId:q.id,description:'Resistance muster point. Three stages, one frontline. Speak with the regional captain to enlist.'});
  }};
})();
