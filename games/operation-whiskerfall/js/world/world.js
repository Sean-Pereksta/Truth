(function () {
  'use strict';
  const OW = window.OW = window.OW || {};
  const CHUNK = 640, SCALE = 1.3, WIDTH = 14400*SCALE, HEIGHT = 11200*SCALE;
  const sq = n=>n*n;
  function distanceSegment(x,y,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
  }
  function seeded(seed) { let s=seed>>>0; return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;}; }
  function hash(x,y,seed) { let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295; }
  // Authored content remains in the original coordinate space. Transform it
  // once so quests, map labels and gameplay all use the same larger world.
  function scalePositions(value,ratio,seen=new Set()) {
    if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    const keys=new Set(['x','y','homeX','homeY','startX','startY','targetX','targetY','destX','destY','tx','ty','endX','endY']);
    for(const [key,child]of Object.entries(value))if(keys.has(key)&&Number.isFinite(child))value[key]=child*ratio;else if(child&&typeof child==='object')scalePositions(child,ratio,seen);
  }
  function prepareContentCoordinates() {
    const content=OW.Content,ratio=SCALE/(content.coordinateScale||1);if(ratio===1)return;
    for(const bounds of [...content.regions,...(content.sectors||[])]){scalePositions(bounds,ratio);for(const key of ['w','h','width','height'])if(Number.isFinite(bounds[key]))bounds[key]*=ratio;}
    scalePositions(content.quests,ratio);content.coordinateScale=SCALE;
  }
  class World {
    constructor(seed=763219) {
      prepareContentCoordinates();this.coordinateScale=SCALE;
      this.seed=Number(seed)||763219;this.width=Math.max(WIDTH,...OW.Content.regions.map(r=>r.x+r.w));this.height=Math.max(HEIGHT,...OW.Content.regions.map(r=>r.y+r.h));this.chunkSize=CHUNK;
      this.start={x:1100*SCALE,y:1100*SCALE};this.regions=OW.Content.regions.map(r=>Object.assign({},r));this.sectors=(OW.Content.sectors||[]).map(s=>Object.assign({},s));this.berlinSector=this.sectors.find(s=>s.id==='berlin');
      this.locations=[];this.objects=[];this.roads=[];this.rivers=[];this.bridges=[];this.groundDetails=[];this.frontierPasses=[];
      this.activeEnemies=[];this.chunks=new Map();this.discovered=new Set();this.liberated=new Set();this.dead=new Set();this.opened=new Set();
      this._objectChunks=new Map();this._spawnChunks=new Map();this._enemyGrid=new Map();this._waterChunks=new Map();this._roadChunks=new Map();this._safeZoneChunks=new Map();this.safeZones=[];this._riverSegments=[];this._spawns=new Map();this._dormant=new Map();this._active=new Map();this._locationMap=new Map();
      this._streamTimer=0;this._lastPlayerCells='';this.maxActiveEnemies=160;this.activeRadius=1450;
      this._generating=true;this._buildLocations();this._buildSafeZoneIndex();this._buildGeography();this._buildStructures();this._buildScenery();this._buildEnemies();this._generating=false;
      this.reveal(this.start.x,this.start.y);
    }
    _key(x,y) { return Math.floor(x/CHUNK)+','+Math.floor(y/CHUNK); }
    _index(map,x,y,entry) { const key=this._key(x,y);if(!map.has(key))map.set(key,[]);map.get(key).push(entry); }
    _addObject(o) {
      o.id=o.id||'object_'+this.objects.length;o.w=o.w||64;o.h=o.h||64;o.variant=o.variant||0;
      o.region=o.region==null?this.regionAt(o.x,o.y).index:o.region;o.solid=!!o.solid;
      this.objects.push(o);
      // Index an object in every chunk touched by its bounds. Queries deduplicate overlaps.
      const x0=Math.floor((o.x-o.w/2)/CHUNK),x1=Math.floor((o.x+o.w/2)/CHUNK),y0=Math.floor((o.y-o.h/2)/CHUNK),y1=Math.floor((o.y+o.h/2)/CHUNK);
      for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const k=cx+','+cy;if(!this._objectChunks.has(k))this._objectChunks.set(k,[]);this._objectChunks.get(k).push(o);}
      return o;
    }
    _addLocation(o) { o.cleared=false;o.enemyIds=[];o.radius=o.radius||260;o.index=this.locations.length;this.locations.push(o);this._locationMap.set(o.id,o);return o; }
    _buildLocations() {
      const townNames=['Willow Resistance Camp','Mossbell Village','Goat’s Rest','Snowhaven','Sundial Oasis','Otter’s Crossing','Ashford Refuge','Dawnbridge'];
      const extraNames=['Applewick','Fern Hollow','Highstone','Whitepine'];
      const baseNames=[['Orchard Checkpoint','Millroad Garrison','Briar Prison','Wheatfield Supply Depot'],['Bramble Radio Post','Timberline Barracks','Fernwood Stockade','Mossroad Convoy Depot'],['Lower Battery','Summit Redoubt','Quarry Prison','Iron Pass Depot'],['Pinewatch Barracks','Frozen Battery','Icefield Prison','Winter Supply Yard'],['Dune Signal Post','Sunscar Barracks','Sandglass Prison','Caravan Depot'],['Reedwater Docks','Floodgate Battery','Mire Prison','Delta Convoy Yard'],['Cinder Foundry','Ironworks Garrison','Ashfall Prison','Armored Train Depot'],['Outer Citadel','Capital Garrison','Blackbanner Prison','Imperial Supply Yard']];
      this.regions.slice(0,8).forEach((r,i)=>{
        const pos=(x,y)=>({x:r.x+x*SCALE,y:r.y+y*SCALE});
        this._addLocation(Object.assign({id:'town_'+i,name:townNames[i],type:'town',region:i,radius:300,npc:['Captain Saffron','Scout Juniper','Ranger Crag','Medic Lumi','Trader Sol','Harbormaster Reed','Engineer Cinder','Captain Dawn'][i],description:'Friendly resistance settlement: merchant, healing, upgrades, and mission board.'},pos(1100,1100)));
        if(i<4)this._addLocation(Object.assign({id:'town_extra_'+i,name:extraNames[i],type:'town',region:i,radius:270,npc:'Quartermaster '+['Hazel','Fern','Slate','Aurora'][i],description:'A quiet village supporting the resistance.'},pos(2100,3200)));
        const basePositions=[[2000,1500],[1200,2600],[2800,3550],[950,4550]];
        basePositions.forEach((p,j)=>this._addLocation(Object.assign({id:'base_'+i+'_'+j,name:baseNames[i][j],type:'base',region:i,radius:290,questId:j<2?'main_'+i+'_'+j:'side_'+i+'_'+(j===2?2:3),prison:j===2,convoy:j===3,level:r.level+(j>1?1:0)},pos(p[0],i===4&&j===2?2950:p[1]))));
        this._addLocation(Object.assign({id:'boss_'+i,name:['Ironwhisker’s Orchard Fort','Bramble’s Hidden Command','Flintfang’s Summit Battery','Whiteclaw’s Ice Citadel','Sirocco’s Buried War Factory','Miretooth’s Floodgate','Geargnash’s Furnace','Blackbanner Throne'][i],type:'boss',region:i,radius:390,questId:'main_'+i+'_2',bossId:r.boss,level:r.level+3},pos(2650,4700)));
        [[570,2050],[2920,2570],[1750,5130]].forEach((p,j)=>this._addLocation(Object.assign({id:'cache_'+i+'_'+j,name:r.name+' Supply Cache '+(j+1),type:'cache',region:i,radius:80,questId:j===0?'side_'+i+'_1':null},pos(p[0],p[1]))));
        [[650,3600],[2900,800]].forEach((p,j)=>this._addLocation(Object.assign({id:'cave_'+i+'_'+j,name:[['Badger’s Hollow','Forgotten Root Cellar'],['Owl’s Grotto','Moonmoss Cavern'],['Echoing Quarry','Crystal Pass'],['Frozen Den','Aurora Cavern'],['Amber Vault','Sandstone Refuge'],['Reedroot Grotto','Sunken Hideaway'],['Cinder Tunnel','Abandoned Workshop'],['Old Resistance Vault','Citadel Catacombs']][i][j],type:'cave',region:i,radius:135,questId:j===0?'side_'+i+'_0':null},pos(p[0],p[1]))));
      });
      const berlin=this.berlinSector;if(berlin){
        // The old eastern cave stays reachable before the endgame sector opens.
        const cave=this.getLocation('cave_7_1');if(cave){cave.x=2100*SCALE;cave.y=6400*SCALE;}
        this._addLocation({id:'boss_berlin',name:'Adolph Whisker’s Berlin Headquarters',type:'boss',x:2900*SCALE,y:6550*SCALE,region:7,radius:480,level:28,questId:'main_berlin_final',bossId:'adolph_whisker',bossIndex:8,finalBoss:true,final:true,sector:'berlin',arenaBounds:berlin});
      }
      for(const r of this.regions.slice(0,8))this._addLocation({id:'town_way_'+r.index,name:['Clover Rest','Fernlight Refuge','Badger’s Lantern','Warmhearth','Amber Rest','Reedlight Refuge','Ember Rest','Last Lantern'][r.index],type:'town',x:r.x+420*SCALE,y:r.y+3100*SCALE,region:r.index,radius:250,npc:'Resistance Wayfinder',description:'A peaceful refuge with a friendly quest scout and an upgrade forge.'});
      for(const l of OW.Content.stormglass?.locations||[])this._addLocation({...l,x:l.x*SCALE,y:l.y*SCALE});
      for(const town of this.locations.filter(l=>l.type==='town')){
        town.safeRadius=500;town.friendly=true;town.safe=true;
        this._addLocation({id:'forge_'+town.id,name:town.name+' Forge',type:'forge',x:town.x+300,y:town.y+240,region:town.region,radius:110,townId:town.id,npc:'Resistance Armourer',description:'Upgrade firearms and protective outfits at the resistance forge.'});
        const profiles=(OW.Content.npcs||[]).filter(n=>n.townId===town.id);
        for(const profile of profiles)this._addLocation({id:profile.id,name:profile.name,type:'npc',x:town.x+(profile.offsetX??85),y:town.y+(profile.offsetY??100),region:town.region,radius:55,townId:town.id,npcId:profile.id,npc:profile,profile,questIds:profile.questIds||[],dialogue:profile.dialogue||[],variant:profile.portrait||0,role:profile.role,portrait:profile.portrait||0,friendly:true});
        this._addLocation({id:'bounty_'+town.id,name:town.name+' Bounty Center',type:'bounty',x:town.x-300,y:town.y-35,region:town.region,radius:70,townId:town.id,posterBossIds:OW.Content.bosses.map(b=>b.id),posters:OW.Content.bossPosters,friendly:true,description:'Nine wanted posters list every major commander, their location, and the Berlin gate conditions.'});
      }
      for(const r of this.regions.slice(0,8)){
        const escort=OW.Content.quests.find(q=>q.id==='escort_'+r.index);
        this._addLocation({id:'escort_'+r.index,name:r.name+' Courier Meeting Point',type:'escort',x:escort.x,y:escort.y,region:r.index,radius:100,questId:escort.id,startX:escort.startX,startY:escort.startY,waypoints:escort.waypoints});
        this._addLocation({id:'defend_'+r.index,name:r.name+' Resistance Road Post',type:'defend',x:r.x+1477*SCALE,y:r.y+2155.6*SCALE,region:r.index,radius:125,questId:'defend_'+r.index,friendly:true});
      }
      for(const q of OW.Content.quests)for(const point of q.objectives||[]){const stepIndex=q.steps.findIndex(s=>s.targets.includes(point.id)),step=q.steps[stepIndex];this._addLocation(Object.assign({name:point.label,type:'objective',region:q.region,radius:65,questId:q.id,stepIndex,action:step.action,description:step.label,friendly:point.displayType==='wounded'},point));}
    }
    _road(a,b,width=62,kind='lane',name='') {
      if(Math.hypot(b.x-a.x,b.y-a.y)<2)return;
      const road={x1:a.x,y1:a.y,x2:b.x,y2:b.y,width,kind,name,points:[{x:a.x,y:a.y},{x:b.x,y:b.y}]};this.roads.push(road);
      const pad=width*.5+160;for(let cy=Math.floor((Math.min(a.y,b.y)-pad)/CHUNK);cy<=Math.floor((Math.max(a.y,b.y)+pad)/CHUNK);cy++)for(let cx=Math.floor((Math.min(a.x,b.x)-pad)/CHUNK);cx<=Math.floor((Math.max(a.x,b.x)+pad)/CHUNK);cx++){const key=cx+','+cy;if(!this._roadChunks.has(key))this._roadChunks.set(key,[]);this._roadChunks.get(key).push(road);}
      return road;
    }
    _route(points,width,kind,name) {for(let i=1;i<points.length;i++)this._road(points[i-1],points[i],width,kind,name);}
    _nearestRoadPoint(point,roads) {
      let nearest=null,distance=Infinity;
      for(const road of roads){const a=road.points[0],b=road.points[1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),p={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-point.x,p.y-point.y);if(d<distance){nearest=p;distance=d;}}
      return nearest;
    }
    _buildSafeZoneIndex() {
      this.safeZones=this.locations.filter(l=>l.type==='town');this._safeZoneChunks.clear();
      for(const town of this.safeZones){const radius=(town.safeRadius||500)+96;for(let cy=Math.floor((town.y-radius)/CHUNK);cy<=Math.floor((town.y+radius)/CHUNK);cy++)for(let cx=Math.floor((town.x-radius)/CHUNK);cx<=Math.floor((town.x+radius)/CHUNK);cx++){const key=cx+','+cy;if(!this._safeZoneChunks.has(key))this._safeZoneChunks.set(key,[]);this._safeZoneChunks.get(key).push(town);}}
    }
    safeZoneAt(x,y,margin=0) {
      const candidates=margin<=96?(this._safeZoneChunks.get(this._key(x,y))||[]):this.safeZones;
      return candidates.find(t=>sq(t.x-x)+sq(t.y-y)<sq((t.safeRadius||500)+margin));
    }
    _buildGeography() {
      // Each valley has one main road. Settlements and garrisons receive short
      // branches; people, forges and mission props never create map-wide roads.
      this.regions.slice(0,8).forEach((r,i)=>{
        const p=(x,y)=>({x:r.x+x*SCALE,y:r.y+y*SCALE});
        this._route([p(1100,1100),p(1750,2920),p(1800,3900),p(1800,5200)],76,'arterial',r.name+' valley road');
        // Keep the courier's short, authored departure route clear of scenery.
        const escort=OW.Content.quests.find(q=>q.id==='escort_'+i);if(escort)this._route(escort.waypoints,38,'local','Courier departure');
      });
      for(let i=0;i<3;i++)this._road(this.getLocation('town_'+i),this.getLocation('town_'+(i+1)),88,'highway','Northern caravan road');
      for(let i=4;i<6;i++)this._road(this.getLocation('town_'+i),this.getLocation('town_'+(i+1)),88,'highway','Southern caravan road');
      const p=(x,y)=>({x:x*SCALE,y:y*SCALE});
      this._route([this.getLocation('town_6'),p(3850,7450),p(1775,7450),this.getLocation('town_7')],88,'highway','Citadel bypass');
      this._route([p(12600,5200),p(13550,5300),p(13650,6000),p(12650,6500),this.getLocation('town_4')],80,'highway','Whiteglass Pass');
      if(OW.Content.stormglass){
        this._route([this.getLocation('town_3'),p(13800,1900),this.getLocation('town_8')],82,'highway','Stormglass Coast Road');
        this._route([this.getLocation('town_8'),p(16000,2850),p(16300,4050),this.getLocation('town_stormglass_lantern'),p(16450,5550),p(15700,6400),p(15700,7700),this.getLocation('town_9'),p(16000,10550)],78,'arterial','Crown Causeway');
        this._route([this.getLocation('town_4'),p(14050,8700),this.getLocation('town_9')],82,'highway','Sundial Island Road');
        // A continuous bridge road joins both new regions before any boss gate.
        this._route([p(16450,5350),p(16450,5950)],76,'highway','Sunken Crown Crossing');
      }
      const trunks=this.roads.filter(r=>r.kind==='arterial'||r.kind==='highway');
      for(const l of this.locations.filter(l=>l.type==='town'&&!/^town_[0-7]$/.test(l.id)||l.type==='base'||l.type==='boss'&&!l.finalBoss)){
        const approach={x:l.x,y:l.y+(l.type==='town'?0:250)},junction=this._nearestRoadPoint(approach,trunks);
        this._road(junction,approach,l.type==='town'?54:48,'lane',l.name+' approach');
        if(l.type!=='town')this._road(approach,l,48,'local',l.name+' gate');
      }
      if(this.berlinSector){const gate=this.berlinSector.gate;this._route([p(1775,7450),p(2000,7150),p(2000,6550),gate,this.getLocation('boss_berlin')],68,'lane','Berlin military road');}
      // Two rivers form readable natural boundaries, with a branching delta.
      const riverA={id:'willow_river',width:155,points:[]},riverB={id:'silver_river',width:125,points:[]};
      for(let y=0;y<=11200+400;y+=400){riverA.points.push(p(3820+Math.sin(y/850)*220,y));riverB.points.push(p(10050+Math.sin(y/1100+1.5)*280,y));}
      this.rivers.push(riverA,riverB,{id:'reedwater_branch',width:190,points:[[7200,8300],[8100,8500],[9100,7900],[10050,8100],[11000,8800],[14400,9200]].map(v=>p(...v))});
      if(OW.Content.stormglass){
        this.rivers.push({id:'stormglass_surf',width:360,points:[[17830,0],[17720,1800],[17830,3800],[17700,5600],[17830,7800],[17700,9600],[17830,11200]].map(v=>p(...v))},
          {id:'crown_tidal_channel',width:210,points:[[14400,5650],[15400,5700],[16500,5750],[17700,5600]].map(v=>p(...v))},
          {id:'crown_southern_channel',width:180,points:[[14400,9200],[15400,9600],[16600,9250],[17760,9500]].map(v=>p(...v))});
        for(const [x,y,region]of [[17550,2400,8],[17450,4700,8],[17400,6800,9],[17380,10600,9]])this.groundDetails.push({type:'coastalShore',x:x*SCALE,y:y*SCALE,w:460,h:680,region});
      }
      // River engineering follows the banks around established villages. A
      // settlement must not leave its workshop stranded on a tiny wet island.
      for(const river of this.rivers){
        const original=river.points,nearby=this.locations.filter(l=>l.type==='town'&&original.some((a,i)=>i&&distanceSegment(l.x,l.y,original[i-1],a)<620));if(!nearby.length)continue;
        const points=[];for(let i=1;i<original.length;i++){const a=original[i-1],b=original[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/140);for(let n=i===1?0:1;n<=steps;n++)points.push({x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps});}
        for(const town of nearby){let nearest=null,best=Infinity;for(let i=1;i<original.length;i++){const a=original[i-1],b=original[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((town.x-a.x)*dx+(town.y-a.y)*dy)/(dx*dx+dy*dy))),q={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(q.x-town.x,q.y-town.y);if(d<best){nearest=q;best=d;}}
          const nx=(nearest.x-town.x)/(best||1)||1,ny=(nearest.y-town.y)/(best||1),radius=640;
          for(const q of points){const dx=q.x-town.x,dy=q.y-town.y;if(Math.hypot(dx,dy)>=radius)continue;const along=-dx*ny+dy*nx,outward=Math.sqrt(Math.max(0,radius*radius-along*along));q.x=town.x+nx*outward-ny*along;q.y=town.y+ny*outward+nx*along;}
        }river.points=points;
      }
      this._prepareWaterIndex();
      // Hidden rewards sit on dry banks. A river can never make a quest cache unreachable.
      for(const l of this.locations)if((l.type==='cache'||l.type==='cave'||l.type==='objective')&&this._waterDistance(l.x,l.y)<95){
        const r=this.regions[l.region];for(let step=1;step<=10;step++){let found=false;for(const sign of [-1,1]){const nx=Math.max(r.x+130,Math.min(r.x+r.w-130,l.x+sign*step*70));if(this._waterDistance(nx,l.y)>100){l.x=nx;found=true;break;}}if(found)break;}
      }
      // Small footpaths make every dungeon entrance discoverable and reachable.
      const approaches=this.roads.filter(r=>r.kind!=='local');
      for(const cave of this.locations.filter(l=>l.type==='cave')){const junction=this._nearestRoadPoint(cave,approaches);this._road(junction,cave,28,'trail',cave.name+' trail');cave.dungeonId=cave.id;this.groundDetails.push({type:'caveApron',x:cave.x,y:cave.y,w:215,h:145,region:cave.region});}
      for(const l of this.locations.filter(l=>l.region>=8&&['cache','defend','objective'].includes(l.type))){const junction=this._nearestRoadPoint(l,approaches);this._road(junction,l,36,'trail',l.name+' coast path');}
      for(const road of this.roads.filter(r=>r.kind==='highway')){
        const a=road.points[0],b=road.points[1],regionA=this.regionAt(a.x,a.y),regionB=this.regionAt(b.x,b.y);if(regionA.index===regionB.index)continue;
        const point={x:(a.x+b.x)/2,y:(a.y+b.y)/2};this.frontierPasses.push({...point,angle:Math.atan2(b.y-a.y,b.x-a.x),region:Math.max(regionA.index,regionB.index),name:road.name});
      }
      // Bridge decks are generated at road / river intersections and receive their own illustrated sprites.
      for(const road of this.roads){
        const steps=Math.max(1,Math.ceil(Math.hypot(road.x2-road.x1,road.y2-road.y1)/24));let entry=null;
        for(let n=0;n<=steps;n++){const t=n/steps,x=road.x1+(road.x2-road.x1)*t,y=road.y1+(road.y2-road.y1)*t;const wet=this._waterDistance(x,y)<0;
          if(wet&&!entry)entry={x,y};
          if(entry&&(!wet||n===steps)){const angle=Math.atan2(road.y2-road.y1,road.x2-road.x1),b={id:'bridge_'+this.bridges.length,type:'bridge',x:(entry.x+x)/2,y:(entry.y+y)/2,w:Math.hypot(x-entry.x,y-entry.y)+58,h:road.width+20,angle,solid:false,variant:0};if(!this.bridges.some(v=>Math.hypot(v.x-b.x,v.y-b.y)<90)){this.bridges.push(b);this._addObject(b);}entry=null;}
        }
      }
    }
    _buildStructures() {
      for(const l of this.locations){
        if(l.type==='town'){
          this.groundDetails.push({type:'plaza',x:l.x,y:l.y,w:680,h:560,region:l.region,small:l.id.includes('_way_')});
          [{dx:-225,dy:-150,w:155,h:130},{dx:225,dy:-150,w:155,h:130},{dx:0,dy:-305,w:160,h:135},{dx:-220,dy:235,w:125,h:105}].forEach((p,j)=>{
            let x=l.x+p.dx,y=l.y+p.dy;
            if(this.isOnRoad(x,y,85)){y-=130;if(this.isOnRoad(x,y,85))x+=p.dx<0?-100:100;}
            this._addObject({id:l.id+'_building_'+j,type:'building',x,y,w:p.w,h:p.h,solid:true,variant:(l.region+j)%4,locationId:l.id});
          });
          this._route([{x:l.x-330,y:l.y},{x:l.x+300,y:l.y}],36,'local',l.name+' square');
          this._route([{x:l.x+190,y:l.y},{x:l.x+300,y:l.y+85},{x:l.x+300,y:l.y+240}],26,'local',l.name+' forge walk');
          this._addObject({id:l.id+'_well',type:'well',x:l.x-115,y:l.y+84,w:48,h:46,solid:false,locationId:l.id});
          this._addObject({id:l.id+'_market',type:'marketStall',x:l.x-130,y:l.y-60,w:90,h:70,solid:false,variant:l.region,locationId:l.id});
          this._addObject({id:l.id+'_garden',type:'garden',x:l.x-215,y:l.y+400,w:180,h:95,solid:false,variant:l.region,locationId:l.id});
          for(const [j,dx]of [-365,355].entries())this._addObject({id:l.id+'_lantern_'+j,type:'lantern',x:l.x+dx,y:l.y+90,w:18,h:65,solid:false,locationId:l.id});
          this._addObject({id:l.id+'_sign',type:'signpost',x:l.x+100,y:l.y+325,w:30,h:65,solid:false,label:l.name,locationId:l.id});
          this._addObject({id:l.id+'_flag',type:'flag',x:l.x+60,y:l.y+35,w:40,h:88,solid:false,friendly:true,locationId:l.id});
          this._addObject({id:l.id+'_crate',type:'crate',x:l.x-50,y:l.y+65,w:45,h:42,solid:false,locationId:l.id});
          [[-20,-15],[135,150],[-120,240]].forEach((d,j)=>this._addObject({id:l.id+'_friendly_'+j,type:'friendlyCat',x:l.x+d[0],y:l.y+d[1],homeX:l.x+d[0],homeY:l.y+d[1],w:40,h:55,solid:false,skin:(l.region+j)%4,role:j===0?0:j===1?1:2+l.region%4,phase:(l.region*1.7+j*2.2),roamRadius:35,locationId:l.id,friendly:true}));
        } else if(l.type==='base'||l.type==='boss') {
          this.groundDetails.push({type:l.type==='boss'?'fortYard':'campYard',x:l.x,y:l.y,w:l.type==='boss'?690:590,h:550,region:l.region});
          this._addObject({id:l.id+'_headquarters',type:l.type==='boss'?'fortress':'tent',x:l.x,y:l.y-(l.type==='boss'?125:80),w:l.type==='boss'?230:170,h:l.type==='boss'?180:125,solid:true,variant:l.region,locationId:l.id});
          [[-225,-170],[225,-170]].forEach((d,j)=>this._addObject({id:l.id+'_tower_'+j,type:'tower',x:l.x+d[0],y:l.y+d[1],w:74,h:107,solid:true,variant:l.region,locationId:l.id}));
          // Walls leave wide approaches on every side; entries cannot become dead ends.
          [[-155,190],[155,190],[-245,15],[245,15]].forEach((d,j)=>this._addObject({id:l.id+'_wall_'+j,type:'wall',x:l.x+d[0],y:l.y+d[1],w:j<2?130:28,h:j<2?28:120,solid:true,variant:l.region,locationId:l.id}));
          [[-110,75],[130,70]].forEach((d,j)=>this._addObject({id:l.id+'_crate_'+j,type:j?'barrel':'crate',x:l.x+d[0],y:l.y+d[1],w:43,h:43,solid:true,variant:j,locationId:l.id}));
          this._addObject({id:l.id+'_flag',type:'flag',x:l.x+65,y:l.y+30,w:45,h:95,solid:false,locationId:l.id});
          if(l.prison)this._addObject({id:l.id+'_prisoners',type:'prison',x:l.x-80,y:l.y+100,w:68,h:65,solid:false,locationId:l.id});
          if(l.convoy)this._addObject({id:l.id+'_truck',type:'truck',x:l.x+80,y:l.y+110,w:104,h:72,solid:true,locationId:l.id});
          this._addObject({id:l.id+'_radio',type:'radio',x:l.x-110,y:l.y-285,w:44,h:65,solid:true,locationId:l.id});
          this._addObject({id:l.id+'_stores',type:'supplyStack',x:l.x+160,y:l.y-260,w:74,h:58,solid:true,variant:l.region,locationId:l.id});
          if(l.type==='boss'||l.region>1)this._addObject({id:l.id+'_artillery',type:'artillery',x:l.x-340,y:l.y-100,w:80,h:62,solid:true,variant:l.region,locationId:l.id});
          this._addObject({id:l.id+'_warning',type:'signpost',x:l.x+75,y:l.y+315,w:30,h:65,solid:false,label:l.type==='boss'?'COMMAND POST':'OCCUPIED CAMP',hostile:true,locationId:l.id});
          [[-40,125],[55,145]].forEach((d,j)=>this._addObject({id:l.id+'_liberated_friendly_'+j,type:'friendlyCat',x:l.x+d[0],y:l.y+d[1],homeX:l.x+d[0],homeY:l.y+d[1],w:40,h:55,solid:false,skin:(l.region+j)%4,role:j?4:3,phase:l.region+j*3,roamRadius:18,locationId:l.id,friendly:true,liberatedOnly:true}));
        } else if(l.type==='npc')this._addObject({id:l.id+'_person',type:'npc',x:l.x,y:l.y,w:53,h:72,solid:false,variant:l.variant||0,skin:l.portrait||0,portrait:l.portrait||0,role:l.role,friendly:true,locationId:l.id,npcId:l.npcId});
        else if(l.type==='bounty')this._addObject({id:l.id+'_board',type:'bountyBoard',x:l.x,y:l.y,w:110,h:95,solid:false,locationId:l.id});
        else if(l.type==='objective'){
          // Mission props use a clear, dry footprint even when an authored point
          // happens to meet the corner of an existing camp wall or tower.
          if(this.isBlocked(l.x,l.y,22)){const ox=l.x,oy=l.y;let found=false;for(let ring=1;ring<12&&!found;ring++)for(let n=0;n<16;n++){const a=n*Math.PI/8,x=ox+Math.cos(a)*ring*25,y=oy+Math.sin(a)*ring*25;if(!this.isBlocked(x,y,22)&&this._waterDistance(x,y)>45){l.x=x;l.y=y;found=true;break;}}}
          this._addObject({id:l.id+'_prop',type:'objective',x:l.x,y:l.y,w:55,h:l.displayType==='wounded'?58:70,solid:false,locationId:l.id,questId:l.questId,stepIndex:l.stepIndex,action:l.action,label:l.label,displayType:l.displayType,skin:l.region%4,friendly:l.friendly});
        }
        else if(l.type==='forge')this._addObject({id:l.id+'_workshop',type:'forge',x:l.x,y:l.y-70,w:150,h:110,solid:true,variant:l.region,locationId:l.id});
        else if(l.type==='cache')this._addObject({id:l.id+'_chest',type:'chest',x:l.x,y:l.y,w:57,h:44,solid:false,locationId:l.id});
        else if(l.type==='cave')this._addObject({id:l.id+'_entrance',type:'cave',x:l.x,y:l.y-40,w:150,h:125,solid:false,locationId:l.id});
        else if(l.type==='defend')this._addObject({id:l.id+'_banner',type:'flag',x:l.x+45,y:l.y-30,w:42,h:85,solid:false,locationId:l.id,friendly:true});
      }
    }
    _buildScenery() {
      const random=seeded(this.seed);
      for(let y=120;y<HEIGHT-100;y+=125)for(let x=120;x<WIDTH-100;x+=125){
        const px=x+(random()-.5)*100,py=y+(random()-.5)*100,r=this.regionAt(px,py),n=random();
        if(Math.hypot(px-this.start.x,py-this.start.y)<430||this.locations.some(l=>Math.hypot(px-l.x,py-l.y)<(l.type==='town'?490:l.radius+95))||this.isOnRoad(px,py,65)||this._waterDistance(px,py)<25)continue;
        const densities={grass:.28,forest:.68,mountain:.37,snow:.33,desert:.18,marsh:.39,industrial:.25,fortress:.3};
        if(n>densities[r.biome])continue;
        let type='tree',w=92,h=123,solid=true;
        const variant=Math.floor(random()*4);
        if(r.biome==='forest'){type=random()<.7?'tree':'bush';}
        else if(r.biome==='snow'){type=random()<.75?'pine':'rock';}
        else if(r.biome==='desert'){type=random()<.3?'palm':random()<.7?'rock':'bush';}
        else if(r.biome==='mountain'){type=random()<.6?'rock':'pine';}
        else if(r.biome==='industrial'||r.biome==='fortress'){type=random()<.38?'ruin':random()<.6?'rock':random()<.8?'barrel':'tree';}
        else if(r.biome==='marsh'){type=random()<.55?'bush':'tree';}
        else type=random()<.6?'tree':random()<.7?'rock':'bush';
        if(type==='bush'){w=64;h=51;solid=false;}if(type==='rock'){w=72+variant*8;h=60+variant*5;}if(type==='ruin'){w=95;h=80;}if(type==='barrel'){w=40;h=42;}
        this._addObject({type,x:px,y:py,w,h,solid,variant,region:r.index});
      }
      // Run the expansion separately so adding coastline never advances the
      // original landscape's random sequence or moves scenery in old saves.
      if(OW.Content.stormglass){
        const coastRandom=seeded(this.seed+84293);
        for(let y=120;y<this.height-100;y+=125)for(let x=WIDTH+80;x<this.width-100;x+=125){
          const px=x+(coastRandom()-.5)*90,py=y+(coastRandom()-.5)*90,r=this.regionAt(px,py),n=coastRandom();
          if(this.locations.some(l=>Math.hypot(px-l.x,py-l.y)<(l.type==='town'?490:l.radius+95))||this.isOnRoad(px,py,65)||this._waterDistance(px,py)<35||n>(r.index===8?.26:.34))continue;
          const roll=coastRandom(),variant=Math.floor(coastRandom()*4),type=r.index===8?(roll<.48?'rock':roll<.82?'bush':'pine'):(roll<.48?'bush':roll<.7?'palm':roll<.87?'rock':'ruin'),size={rock:[82,68],bush:[68,55],pine:[82,120],palm:[85,115],ruin:[105,88]}[type];
          this._addObject({type,x:px,y:py,w:size[0],h:size[1],solid:type!=='bush',variant,region:r.index});
        }
        for(const [x,y,region,label]of [[14530,1990,8,'BRINEWATCH · EAST'],[16180,5500,8,'SUNKEN CROWN ISLES · SOUTH'],[14530,8700,9,'CROWNREST HAVEN · EAST']])this._addObject({type:'signpost',x:x*SCALE,y:y*SCALE+90,w:34,h:78,solid:false,region,label,friendly:true});
        this._buildCoastalProps();
      }
      // Regional landmarks: mountain ridges and shoreline rocks, interrupted by roads.
      for(const r of this.regions)if(['mountain','snow','desert'].includes(r.biome))for(let i=0;i<36;i++){
        const x=r.x+(180+i*88)*SCALE,y=r.y+(2100+Math.sin(i*.35)*230)*SCALE;
        if(this.isOnRoad(x,y,100)||this.locations.some(l=>Math.hypot(l.x-x,l.y-y)<l.radius+120))continue;
        this._addObject({type:'rock',x,y,w:105,h:88,solid:true,variant:i%4,region:r.index});
      }
      // Frontier bands and ruined waystations make long journeys legible.
      for(const pass of this.frontierPasses){
        this.groundDetails.push({type:'frontier',x:pass.x,y:pass.y,w:560,h:400,region:pass.region});
        for(const sign of [-1,1])this._addObject({id:'frontier_'+pass.region+'_'+sign+'_'+Math.round(pass.x),type:'signpost',x:pass.x+sign*125,y:pass.y+100,w:30,h:70,solid:false,hostile:true,label:this.regions[pass.region].name+' · LV '+this.regions[pass.region].level});
      }
    }
    _buildCoastalProps() {
      // Ground-foot anchors and actual draw dimensions; the art remains
      // decorative so a lighthouse or arch can never close a travel route.
      const sizes=[[220,290],[145,165],[235,150],[125,155],[230,220],[160,210],[115,95],[95,75]];
      const clear=(x,y,w,h,region)=>{
        const r=this.regions[region];
        if(!r||x<r.x+w/2+30||x>r.x+r.w-w/2-30||y<r.y+h+30||y>r.y+r.h-50||this._waterDistance(x,y)<w*.4+25)return false;
        if(this.isOnRoad(x,y,w*.5+35)||this.isOnRoad(x,y-h*.4,w*.45+30))return false;
        // Leave the entire interaction circle and its overhead marker visible.
        if(this.locations.some(l=>Math.abs(l.x-x)<w/2+100&&l.y>y-h-100&&l.y<y+100))return false;
        for(const o of this.getVisibleObjects(x-w/2-20,y-h-20,w+40,h+60)){
          if(!o.solid&&o.type!=='coastalProp')continue;
          if(Math.abs(o.x-x)<(o.w+w)/2+20&&o.y>y-h-25&&o.y-o.h<y+25)return false;
        }
        return true;
      };
      const landmark=(locationId,variant,dx=180,dy=40)=>{
        const l=this.getLocation(locationId);if(!l||l.region<8)return;
        const [w,h]=sizes[variant];let point=null;
        if(clear(l.x+dx,l.y+dy,w,h,l.region))point={x:l.x+dx,y:l.y+dy};
        for(let radius=200;radius<=680&&!point;radius+=60)for(let n=0;n<16;n++){
          const a=n*Math.PI/8-.35,x=l.x+Math.cos(a)*radius,y=l.y+Math.sin(a)*radius;
          if(clear(x,y,w,h,l.region)){point={x,y};break;}
        }
        if(point)this._addObject({id:'coastal_landmark_'+locationId+'_'+variant,type:'coastalProp',...point,w,h,variant,region:l.region,locationId,solid:false,landmark:true});
      };
      landmark('town_8',0,520,-100);landmark('town_stormglass_lantern',0,500,-130);
      landmark('cache_stormglass_salvage',2,210,100);
      landmark('town_9',5,470,-100);landmark('base_sunkencrown_0',4,440,160);landmark('cache_sunkencrown_ruins',4,240,80);
      for(const l of this.locations.filter(l=>l.region>=8)){
        if(l.type==='defend')landmark(l.id,1,185,55);
        if(l.type==='objective'&&l.displayType==='relay')landmark(l.id,3,160,35);
        if(l.type==='cache')landmark(l.id,6,-165,40);
      }
      const shrubRandom=seeded(this.seed+382417),[w,h]=sizes[7];
      for(let y=240,row=0;y<this.height-120;y+=400,row++)for(let x=WIDTH+180,col=0;x<this.width-120;x+=350,col++){
        const px=x+(shrubRandom()-.5)*130,py=y+(shrubRandom()-.5)*130,region=this.regionAt(px,py).index;
        if(shrubRandom()>.62||!clear(px,py,w,h,region))continue;
        this._addObject({id:'coastal_shrub_'+row+'_'+col,type:'coastalProp',x:px,y:py,w,h,variant:7,region,solid:false});
      }
    }
    _spawn(def) {
      const unsafe=(x,y)=>this.isBlocked(x,y,def.boss?36:18)||this.safeZoneAt(x,y,30);
      if(unsafe(def.x,def.y)){
        const ox=def.x,oy=def.y;let found=false;
        for(let ring=1;ring<=20&&!found;ring++)for(let n=0;n<16;n++){const a=n*Math.PI/8,x=ox+Math.cos(a)*ring*30,y=oy+Math.sin(a)*ring*30;if(!unsafe(x,y)){def.x=x;def.y=y;def.homeX=x;def.homeY=y;found=true;break;}}
      }
      this._spawns.set(def.id,def);this._index(this._spawnChunks,def.x,def.y,def);const l=this.getLocation(def.locationId);if(l)l.enemyIds.push(def.id);
    }
    _buildEnemies() {
      const random=seeded(this.seed+221),coastRandom=seeded(this.seed+64983);
      for(const l of this.locations){
        const spawnRandom=l.region>=8?coastRandom:random;
        if(l.type==='base'||l.type==='boss'){
          const counts=l.region===0?[3,4,4,4]:l.region===1?[4,5,5,5]:[6+Math.min(4,l.region),7+Math.min(4,l.region),7+Math.min(4,l.region),7+Math.min(4,l.region)];
          const baseNumber=Number(l.id.split('_')[2]);const count=l.type==='boss'?(l.finalBoss?6:l.region<2?3:5):counts[baseNumber]||6;
          const pools=[[20,1,24,0,4,36,2],[0,24,5,27,6,30,3,36,38,39],[0,6,7,25,26,12,32,10,11,3,36,38,39],[6,13,29,24,26,31,11,3,42,37,38],[8,14,21,25,28,33,17,11,40,36,38,39],[5,15,16,24,27,30,10,4,41,37,39],[8,12,21,26,27,34,17,3,40,36,38],[30,31,32,33,34,35,18,19,25,28,29,37,43,42]];
          for(let j=0;j<count;j++){
            const angle=j/count*Math.PI*2+.2,rad=(l.region<2?245:205)+(j%3)*80;let x=l.x+Math.cos(angle)*rad,y=l.y+Math.sin(angle)*rad;
            let tries=0;while(this.isBlocked(x,y,18)&&tries++<20){x=l.x+(spawnRandom()-.5)*650;y=l.y+(spawnRandom()-.5)*620;}
            // Keep legacy named target IDs stable even though the opening camps now contain fewer guards.
            const namedMission=l.id==='base_'+l.region+'_1'&&j===Math.min(count-1,7)?OW.Content.quests.find(q=>q.id==='assassination_'+l.region):l.id==='base_'+l.region+'_3'&&j===Math.min(count-1,6)?OW.Content.quests.find(q=>q.id==='bounty_'+l.region):null;
            const spawnId=namedMission?namedMission.target:l.id+'_guard_'+j;
            const pool=(l.enemyPool||pools[l.region]||[0,24,28,7]).filter(type=>OW.Content.enemies[type]),poolOffset=Number.isFinite(baseNumber)?baseNumber*2:l.finalBoss?4:0;
            this._spawn({id:spawnId,type:namedMission?9:(pool[(j+poolOffset)%pool.length]??0),x,y,homeX:x,homeY:y,level:namedMission?namedMission.level:Math.max(1,l.level+(j%3===0&&l.region>1?1:0)),locationId:l.id,region:l.region,boss:false,patrol:spawnRandom()*Math.PI*2,name:namedMission?namedMission.targetName:undefined,elite:!!namedMission,hpMultiplier:namedMission?(l.region<2?.8:1.25):1,questTargetId:namedMission?namedMission.id:undefined});
          }
          if(l.type==='boss'){
            const bossIndex=l.bossIndex??l.region,b=OW.Content.bosses[bossIndex],x=l.x,y=l.y+155;
            this._spawn({id:l.id+'_commander',type:l.region===7?23:22,x,y,homeX:x,homeY:y,level:b.level,locationId:l.id,region:l.region,boss:true,bossIndex,bossId:b.id,finalBoss:!!l.finalBoss,pattern:b.pattern,name:b.name});
          }
        }
        if(l.type==='cave')for(let j=0;j<(l.region===0?1:l.region===1?2:3);j++){
          const x=l.x+Math.cos(j*2.1)*140,y=l.y+120+Math.sin(j*2.1)*100;
          const caveTypes=[[39,2],[39,36],[39,38],[42,39],[40,36],[41,39],[40,38],[43,37]],type=caveTypes[l.region][j%2];
          this._spawn({id:l.id+'_sentry_'+j,type:OW.Content.enemies[type]?type:2,x,y,homeX:x,homeY:y,level:this.regions[l.region].level,locationId:l.id,region:l.region,boss:false,patrol:j});
        }
      }
      // Sparse road patrols provide encounters between installations without simulating the whole map.
      this.regions.slice(0,8).forEach(r=>{
        for(let j=0;j<(r.index===0?4:r.index===1?6:9);j++){
          let x=r.x+(700+random()*2300)*SCALE,y=r.y+(1700+random()*3300)*SCALE;
          if(this.locations.some(l=>Math.hypot(l.x-x,l.y-y)<l.radius+250)||this.isBlocked(x,y,20))continue;
          for(let k=0;k<(r.index===0?1:r.index===1?2:3);k++)this._spawn({id:'patrol_'+r.index+'_'+j+'_'+k,type:k===0?1:r.index<3?0:18,x:x+k*78,y:y+k*52,homeX:x,homeY:y,level:r.level,locationId:null,region:r.index,boss:false,patrol:j*.8});
        }
      });
      if(OW.Content.stormglass)for(const r of this.regions.filter(r=>r.index>=8)){
        const patrolRandom=seeded(this.seed+r.index*1951),types=[44,47,45,46].filter(type=>OW.Content.enemies[type]);
        if(!types.length)types.push(0,24,28,7);
        for(let j=0;j<10;j++){
          const x=r.x+(350+patrolRandom()*2700)*SCALE,y=r.y+(650+patrolRandom()*4200)*SCALE;
          if(this.locations.some(l=>Math.hypot(l.x-x,l.y-y)<l.radius+280)||this.isBlocked(x,y,20))continue;
          for(let k=0;k<3;k++)this._spawn({id:'patrol_'+r.index+'_'+j+'_'+k,type:types[(j+k)%types.length],x:x+k*75,y:y+k*45,homeX:x,homeY:y,level:r.level+(j%3),locationId:null,region:r.index,boss:false,patrol:j*.8});
        }
      }
      for(const [i,pass]of this.frontierPasses.entries()){
        const r=this.regions[pass.region],types=pass.region>=8?[44,47,46]:pass.region<3?[36,38,6]:pass.region<6?[37,38,42]:[43,37,38,34];
        for(let j=0;j<types.length;j++)if(OW.Content.enemies[types[j]])this._spawn({id:'frontier_'+i+'_guard_'+j,type:types[j],x:pass.x+Math.cos(pass.angle)*(j-1)*110,y:pass.y+Math.sin(pass.angle)*(j-1)*110,homeX:pass.x,homeY:pass.y,level:r.level+2,locationId:null,region:r.index,boss:false,elite:j===0,patrol:j*.9});
      }
    }
    _createEnemy(def) {
      const t=def.boss?OW.Content.bosses[def.bossIndex]:OW.Content.enemies[def.type];
      const scale=def.finalBoss?1:def.boss?1+(def.bossIndex||0)*.65:1+(def.level-1)*.105,hp=Math.round(t.hp*scale*(def.hpMultiplier||1));
      return Object.assign({},def,{hp,maxHp:hp,damage:t.damage*(1+(def.level-1)*.045),speed:t.speed,range:t.range,fireRate:t.fireRate,xp:t.xp,angle:0,anim:'idle',animTime:0,state:'patrol',hit:0,attackTimer:.7+(hash(Math.floor(def.x),Math.floor(def.y),this.seed)*1.3),alert:0,velocityX:0,velocityY:0,radius:def.boss?36:18,role:t.role||'general',name:def.name||t.name,color:t.color});
    }
    getLocation(id) {return this._locationMap.get(id)||null;}
    remainingMajorBosses() {return this.locations.filter(l=>l.type==='boss'&&!l.finalBoss&&!this.liberated.has(l.id)&&!this.dead.has(l.id+'_commander'));}
    majorBossesDefeated() {return 8-this.remainingMajorBosses().length;}
    berlinUnlocked() {for(let i=0;i<8;i++)if(!this.liberated.has('boss_'+i)&&!this.dead.has('boss_'+i+'_commander'))return false;return true;}
    isFinalArena(x,y,margin=0) {const s=this.berlinSector;return !!s&&x>=s.x-margin&&x<=s.x+s.w+margin&&y>=s.y-margin&&y<=s.y+s.h+margin;}
    gateAt(x,y,margin=0) {return !this.berlinUnlocked()&&this.isFinalArena(x,y,margin)?this.berlinSector:null;}
    isLocationLocked(location) {const l=typeof location==='string'?this.getLocation(location):location;return !!l&&!!this.gateAt(l.x,l.y);}
    regionAt(x,y) {
      const px=Math.max(0,Math.min(this.width-.001,Number.isFinite(x)?x:0)),py=Math.max(0,Math.min(this.height-.001,Number.isFinite(y)?y:0));
      return this.regions.find(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h)||this.regions[0];
    }
    locationAt(x,y) {
      let result=null,distance=Infinity;for(const l of this.locations){const d=Math.hypot(x-l.x,y-l.y);if(d<l.radius&&d<distance){result=l;distance=d;}}return result;
    }
    isOnRoad(x,y,margin=0) {return (margin<=160?(this._roadChunks.get(this._key(x,y))||[]):this.roads).some(r=>distanceSegment(x,y,r.points[0],r.points[1])<r.width*.5+margin);}
    _prepareWaterIndex() {
      this._waterChunks.clear();this._riverSegments=[];
      for(const river of this.rivers)for(let i=1;i<river.points.length;i++){
        const a=river.points[i-1],b=river.points[i],half=river.width*.5,seg={a,b,half,minX:Math.min(a.x,b.x)-half,maxX:Math.max(a.x,b.x)+half,minY:Math.min(a.y,b.y)-half,maxY:Math.max(a.y,b.y)+half};
        this._riverSegments.push(seg);
        for(let cy=Math.floor((seg.minY-96)/CHUNK);cy<=Math.floor((seg.maxY+96)/CHUNK);cy++)for(let cx=Math.floor((seg.minX-96)/CHUNK);cx<=Math.floor((seg.maxX+96)/CHUNK);cx++){const k=cx+','+cy;if(!this._waterChunks.has(k))this._waterChunks.set(k,[]);this._waterChunks.get(k).push(seg);}
      }
    }
    _inWater(x,y,margin=0) {
      const segments=margin<=96?(this._waterChunks.get(this._key(x,y))||[]):this._riverSegments;
      for(const s of segments)if(x>=s.minX-margin&&x<=s.maxX+margin&&y>=s.minY-margin&&y<=s.maxY+margin&&distanceSegment(x,y,s.a,s.b)<s.half+margin)return true;
      return false;
    }
    _waterDistance(x,y) {
      let d=Infinity;for(const s of this._riverSegments){const dx=Math.max(s.minX-x,0,x-s.maxX),dy=Math.max(s.minY-y,0,y-s.maxY);if(dx*dx+dy*dy>d*d&&d>0)continue;d=Math.min(d,distanceSegment(x,y,s.a,s.b)-s.half);}return d;
    }
    terrainAt(x,y) {
      const r=this.regionAt(x,y),road=this.isOnRoad(x,y),wet=this._inWater(x,y);
      return {type:road?'road':wet?'water':r.biome,region:r.index,height:r.biome==='mountain'?.75+.2*Math.sin(x/900)*Math.cos(y/700):.25+.15*Math.sin(x/600+y/700),moisture:['marsh','isles'].includes(r.biome)?.9:r.biome==='coast'?.7:r.biome==='desert'?.05:.5,biome:r.biome};
    }
    isBlocked(x,y,radius=16) {
      if(x<radius+24||y<radius+24||x>this.width-radius-24||y>this.height-radius-24)return true;
      if(!this._generating&&this.gateAt(x,y,radius))return true;
      // River banks are solid except where the road network makes bridge crossings.
      if(this._inWater(x,y,radius*.35)&&!this.isOnRoad(x,y,18))return true;
      const x0=Math.floor((x-radius)/CHUNK),x1=Math.floor((x+radius)/CHUNK),y0=Math.floor((y-radius)/CHUNK),y1=Math.floor((y+radius)/CHUNK),seen=new Set();
      for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++)for(const o of this._objectChunks.get(xx+','+yy)||[]){
        if(!o.solid||seen.has(o.id))continue;seen.add(o.id);
        // Sprite tops may overhang: collision uses the footprint at the base of the artwork.
        const hw=o.w*(o.type==='tree'||o.type==='pine'||o.type==='palm'?.17:.43),hh=o.h*(o.type==='tree'||o.type==='pine'||o.type==='palm'?.1:.29),oy=o.y+o.h*.17;
        if(Math.abs(x-o.x)<hw+radius&&Math.abs(y-oy)<hh+radius)return true;
      }
      return false;
    }
    _navigationRay(x,y,tx,ty,radius) {
      const count=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/16));
      for(let i=1;i<=count;i++)if(this.isBlocked(x+(tx-x)*i/count,y+(ty-y)*i/count,radius))return false;
      return true;
    }
    steerAround(enemy,target,dt) {
      const radius=enemy.boss?34:17,dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy),aim=Math.atan2(dy,dx);
      if(d<5)return {mx:0,my:0};
      let nav=enemy._steer;
      if(nav){nav.time-=dt;if(nav.time>0&&Math.hypot(target.x-nav.tx,target.y-nav.ty)<100&&this._navigationRay(enemy.x,enemy.y,enemy.x+nav.mx*24,enemy.y+nav.my*24,radius))return {mx:nav.mx,my:nav.my};}
      if(enemy._navSalt==null){let salt=0;for(const c of String(enemy.id))salt=(Math.imul(salt,31)+c.charCodeAt(0))>>>0;enemy._navSalt=salt;}
      const side=nav?nav.side:(enemy._navSalt%2?1:-1),look=Math.min(112,d);
      const offsets=[0,.45*side,-.45*side,.9*side,-.9*side,1.35*side,-1.35*side,1.75*side,-1.75*side,2.15*side,-2.15*side,Math.PI];
      let best=null;
      for(const offset of offsets){
        const a=aim+offset,mx=Math.cos(a),my=Math.sin(a),nx=enemy.x+mx*look,ny=enemy.y+my*look;
        if(!this._navigationRay(enemy.x,enemy.y,nx,ny,radius))continue;
        const turn=nav?Math.abs(Math.atan2(Math.sin(a-nav.angle),Math.cos(a-nav.angle))):0;
        const score=Math.hypot(target.x-nx,target.y-ny)+Math.abs(offset)*5+(offset*side<0?12:0)+turn*5;
        if(!best||score<best.score)best={mx,my,angle:a,score,side:Math.abs(offset)>.2?Math.sign(offset):side};
      }
      if(!best)return {mx:0,my:0};
      enemy._steer={mx:best.mx,my:best.my,angle:best.angle,side:best.side,time:.5+(enemy._navSalt%31)/100,tx:target.x,ty:target.y};
      return {mx:best.mx,my:best.my};
    }
    getVisibleObjects(x,y,w,h) {
      const list=[],seen=new Set(),x0=Math.floor((x-180)/CHUNK),x1=Math.floor((x+w+180)/CHUNK),y0=Math.floor((y-180)/CHUNK),y1=Math.floor((y+h+180)/CHUNK);
      for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++)for(const o of this._objectChunks.get(cx+','+cy)||[]){if(!seen.has(o.id)&&o.x+o.w>x&&o.y+o.h>y&&o.x-o.w<x+w&&o.y-o.h<y+h){seen.add(o.id);list.push(o);}}return list;
    }
    updateActive(players,dt,game) {
      if(!players||!players.length)return;
      // Event and boss reinforcements are created by the gameplay system.
      for(const e of this.activeEnemies)if(e.ephemeral&&!this.dead.has(e.id)&&e.hp>0&&!this._active.has(e.id))this._active.set(e.id,e);
      this._streamTimer-=dt;const cells=players.map(p=>this._key(p.x,p.y)).join('|');
      if(this._streamTimer>0&&cells===this._lastPlayerCells){this._rebuildEnemyGrid();return;}
      this._streamTimer=.35;this._lastPlayerCells=cells;
      const desired=new Map(),chunks=new Map(),radius=this.activeRadius,near2=sq(radius);
      for(const p of players){
        const x0=Math.floor((p.x-radius)/CHUNK),x1=Math.floor((p.x+radius)/CHUNK),y0=Math.floor((p.y-radius)/CHUNK),y1=Math.floor((p.y+radius)/CHUNK);
        for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
          if(cx<0||cy<0||cx*CHUNK>this.width||cy*CHUNK>this.height)continue;
          const key=cx+','+cy;chunks.set(key,{x:cx*CHUNK,y:cy*CHUNK,key,objects:this._objectChunks.get(key)||[],active:true});
          for(const def of this._spawnChunks.get(key)||[]){
            if(this.dead.has(def.id)||this.liberated.has(def.locationId))continue;
            if(this.gateAt(def.x,def.y))continue;
            const current=this._active.get(def.id)||this._dormant.get(def.id)||def,d=sq(current.x-p.x)+sq(current.y-p.y);
            if(d<=near2&&(!desired.has(def.id)||d<desired.get(def.id).distance))desired.set(def.id,{def,distance:d});
          }
        }
        this.reveal(p.x,p.y);
      }
      // Keep pursuing enemies alive while their current position is still close to either player.
      for(const e of this._active.values())if(!this.dead.has(e.id)&&e.hp>0&&!this.gateAt(e.x,e.y)){let d=Infinity;for(const p of players)d=Math.min(d,sq(e.x-p.x)+sq(e.y-p.y));if(d<=sq(radius+160))desired.set(e.id,{def:this._spawns.get(e.id)||e,distance:d});}
      const chosen=[...desired.entries()].sort((a,b)=>a[1].distance-b[1].distance).slice(0,this.maxActiveEnemies),keep=new Set(chosen.map(e=>e[0]));
      for(const [id,e]of this._active)if(!keep.has(id)||this.dead.has(id)||e.hp<=0){if(!this.dead.has(id)&&e.hp>0&&!e.ephemeral)this._dormant.set(id,e);else this._dormant.delete(id);this._active.delete(id);}
      for(const [id,item]of chosen)if(!this._active.has(id)&&!this.dead.has(id)){const e=this._dormant.get(id)||this._createEnemy(item.def);this._dormant.delete(id);this._active.set(id,e);}
      this.chunks=chunks;this.activeEnemies=[...this._active.values()];this._rebuildEnemyGrid();
      // The `game` parameter is reserved for event integration. AI belongs to the game loop.
    }
    _rebuildEnemyGrid() {this._enemyGrid.clear();for(const e of this.activeEnemies)if(e.hp>0&&!this.dead.has(e.id))this._index(this._enemyGrid,e.x,e.y,e);}
    addEnemy(enemy) {enemy.ephemeral=true;this._active.set(enemy.id,enemy);if(!this.activeEnemies.some(e=>e.id===enemy.id))this.activeEnemies.push(enemy);this._rebuildEnemyGrid();return enemy;}
    nearbyEnemies(x,y,radius) {
      const found=[],r2=radius*radius,x0=Math.floor((x-radius)/CHUNK),x1=Math.floor((x+radius)/CHUNK),y0=Math.floor((y-radius)/CHUNK),y1=Math.floor((y+radius)/CHUNK);
      for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++)for(const e of this._enemyGrid.get(cx+','+cy)||[])if(e.hp>0&&!this.dead.has(e.id)&&sq(e.x-x)+sq(e.y-y)<=r2)found.push(e);return found;
    }
    reveal(x,y) {
      const cx=Math.floor(x/CHUNK),cy=Math.floor(y/CHUNK);for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++)if(xx>=0&&yy>=0&&xx*CHUNK<this.width&&yy*CHUNK<this.height)this.discovered.add(xx+','+yy);
      for(const l of this.locations)if(Math.hypot(x-l.x,y-l.y)<680)this.discovered.add(l.id);
    }
    exportState() {
      const persistent=[];for(const e of [...this._dormant.values(),...this._active.values()])if(e.hp>0&&!this.dead.has(e.id)&&!e.ephemeral)persistent.push({id:e.id,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,regionScaleApplied:e.regionScaleApplied,regionHealthScale:e.regionHealthScale,regionDamage:e.regionDamage,angle:e.angle,state:'patrol',attackTimer:e.attackTimer||1});
      return {version:1,coordinateScale:SCALE,seed:this.seed,dead:[...this.dead],liberated:[...this.liberated],discovered:[...this.discovered],opened:[...this.opened],locations:this.locations.filter(l=>l.cleared||l.opened).map(l=>({id:l.id,cleared:l.cleared,opened:l.opened})),enemies:persistent};
    }
    importState(state) {
      if(!state)return;World.migrateSaveCoordinates({world:state});this.dead=new Set(state.dead||[]);this.liberated=new Set(state.liberated||[]);this.discovered=new Set(state.discovered||[]);this.opened=new Set(state.opened||[]);
      this._active.clear();this._dormant.clear();this.activeEnemies=[];this._enemyGrid.clear();
      for(const l of this.locations){l.cleared=false;l.opened=false;}
      for(const s of state.locations||[]){const l=this.getLocation(s.id);if(l){l.cleared=!!s.cleared;l.opened=!!s.opened;}}
      for(const l of this.locations)if(this.liberated.has(l.id))l.cleared=true;
      for(const s of state.enemies||[]){const def=this._spawns.get(s.id);if(def&&!this.dead.has(s.id))this._dormant.set(s.id,Object.assign(this._createEnemy(def),s));}
      this._streamTimer=0;this._lastPlayerCells='';
    }
  }
  World.coordinateScale=SCALE;
  World.prepareContentCoordinates=prepareContentCoordinates;
  World.migrateSaveCoordinates=function(data){
    if(!data||!data.world)return data;const ratio=SCALE/(data.world.coordinateScale||1);if(ratio===1)return data;
    const seen=new Set();for(const value of [data.players,data.reservePlayer,data.marker,data.missionRuns,data.missionEnemies,data.world.enemies])scalePositions(value,ratio,seen);
    const discovered=new Set();for(const key of data.world.discovered||[]){if(!/^\d+,\d+$/.test(key)){discovered.add(key);continue;}const [x,y]=key.split(',').map(Number);for(let cy=Math.floor(y*ratio);cy<Math.ceil((y+1)*ratio);cy++)for(let cx=Math.floor(x*ratio);cx<Math.ceil((x+1)*ratio);cx++)discovered.add(cx+','+cy);}
    data.world.discovered=[...discovered];data.world.coordinateScale=SCALE;return data;
  };
  OW.World=World;
})();
