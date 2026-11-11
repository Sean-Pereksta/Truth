(function(){
  'use strict';
  const C=window.OW.Content;
  const trialNames=['The Moonmoss Vigil','The Aurora Gauntlet','The Drowned Watch','The Last Resistance'];
  [1,3,5,7].forEach((region,index)=>{
    const d=C.dungeons.find(d=>d.id==='cave_'+region+'_1');
    d.encounter='survival';d.waveCount=3+Math.floor(index/2);d.title=trialNames[index];
    const q=C.quests.find(q=>q.id===d.questId);
    q.title=d.title+' · '+C.regions[region].name;q.description='Wake the watch altar. Survive '+d.waveCount+' escalating waves, defeat the awakened guardian, and recover its unique relics.';
  });
  function assign(q){C.quests.push(q);const npc=C.npcs.find(n=>n.id===q.giverNpcId)||C.npcs.find(n=>n.townId==='town_'+q.region);if(npc){q.giverNpcId=npc.id;npc.questIds=npc.questIds||[];npc.questIds.push(q.id);}}
  const defenses=[
    [0,'Hold the Orchard Line','Captain Saffron’s road camp is sheltering the harvest crews. Ring its defense bell and protect the supply chest from three arriving squads.'],
    [2,'The Lantern Must Stay Lit','Ranger Crag’s mountaineers need their exposed pass camp. Keep its supplies intact against the approaching battery crews.'],
    [4,'Last Water at Sundial','Sol’s caravan cannot leave without its water stores. Defend the desert road camp against four raiding waves.'],
    [6,'A Hearth in the Ash','Engineer Cinder’s evacuation camp is the last refuge before the foundries. Hold its supply chest against four escalating siege waves.']
  ];
  defenses.forEach(([region,title,description],index)=>assign({id:'camp_waves_'+region,title,description,type:'campDefense',target:'defend_'+region,targetLocation:'defend_'+region,region,required:1,waveCount:3+Math.floor(index/2),campHealth:500+region*110,rewardGold:260+region*120,rewardXp:250+region*100,giverNpcId:'npc_town_'+region,main:false}));
  // Separate camps from the timed road posts. Stable quest IDs preserve rewards
  // and existing active saves retain their stored battlefield coordinates.
  const sites={0:[2130,2240,'Harvest Crews’ Orchard Camp'],2:[1990,2200,'Lantern Ridge Barricade'],4:[2240,2100,'Sundial Water Convoy'],6:[2020,2230,'Ashford Evacuation Yard']};
  for(const [region,site]of Object.entries(sites)){
    const q=C.quests.find(q=>q.id==='camp_waves_'+region),r=C.regions[region];
    q.campSite={id:'resistance_camp_'+region,name:site[2],x:r.x+site[0],y:r.y+site[1]};
    q.target=q.targetLocation=q.campSite.id;q.level=r.level;q.campHealth={0:750,2:1400,4:2200,6:3200}[region];
    q.description+=' Every wave must be defeated; there is no overall kill timer. Intermissions are preparation time.';
  }
  const counter=C.quests.find(q=>q.id==='camp_waves_2'),ridge=C.regions[2];
  counter.title='Turn the Lantern Line';counter.counterattack=true;counter.holdDuration=18;
  counter.commandSite={id:'lantern_command_post',name:'Lantern Ridge Battery Command',x:ridge.x+2410,y:ridge.y+2460};
  counter.description='Ranger Crag has spotted the commander coordinating the offensive. Hold Lantern Ridge for 18 seconds while the mountaineers withdraw, then pursue the battery captain and disable the command post. No kill deadline. A checkpoint preserves the withdrawal.';
  for(const q of C.quests.filter(q=>q.type==='defend'))q.description='Hold the area for 45 seconds. The countdown advances while at least one standing hero is inside the circle. Leaving pauses progress; defeating every enemy is not required.';
  // Idempotent world integration also used by the offline map exporter. The
  // coordinates above are converted once by World.prepareContentCoordinates.
  C.installCampLocations=function(World){
    const proto=World.prototype;if(proto._resistanceCampsInstalled)return;proto._resistanceCampsInstalled=true;
    const build=proto._buildLocations;proto._buildLocations=function(){build.call(this);for(const q of C.quests)for(const site of [q.campSite,q.commandSite].filter(Boolean))this._addLocation({...site,type:'defend',region:q.region,radius:190,questId:q.id,friendly:true,description:q.description});};
    const geography=proto._buildGeography;proto._buildGeography=function(){geography.call(this);const roads=this.roads.filter(r=>r.kind==='arterial'||r.kind==='highway');for(const q of C.quests)for(const site of [q.campSite,q.commandSite].filter(Boolean)){const l=this.getLocation(site.id),join=this._nearestRoadPoint(l,roads);if(join)this._road(join,l,52,'trail',site.name+' approach');}};
  };
  const demolitions=[
    [1,'Bramble’s Silent Sawmill','Juniper has found the three drives that feed the occupiers’ sawmill. Plant a charge on each drive, then retreat to the separate remote switch.'],
    [3,'Break the Winter Battery','Lumi wants the frozen artillery relay silenced. Arm its three relay charges and use the sheltered remote switch to destroy them together.'],
    [5,'Cut the Floodgate Supply','Reed has marked three pumping engines feeding the military docks. Place the charges before using the separate remote switch.'],
    [7,'The Citadel Goes Dark','Dawn has a final opening: plant charges on the three outer-citadel generators, then use their isolated remote switch to cut the searchlights.']
  ];
  demolitions.forEach(([region,title,description])=>{
    const r=C.regions[region],id='demolition_'+region;
    const points=[[1880,2440,'relay','North drive'],[2240,2440,'relay','East drive'],[2240,2800,'relay','South drive'],[1740,2860,'terminal','Sheltered remote switch']];
    const objectives=points.map((p,i)=>({id:id+'_point_'+i,x:r.x+p[0],y:r.y+p[1],displayType:p[2],label:p[3]}));
    assign({id,title,description,type:'demolition',encounter:'demolition',region,main:false,target:objectives[0].id,targetLocation:objectives[0].id,objectives,required:2,steps:[{action:'plant',label:'Plant all three demolition charges',targets:objectives.slice(0,3).map(p=>p.id)},{action:'detonate',label:'Use the separate remote switch',targets:[objectives[3].id],blastTargets:[0,1,2]}],rewardGold:330+region*120,rewardXp:300+region*110,giverNpcId:'npc_town_'+region});
  });
})();
