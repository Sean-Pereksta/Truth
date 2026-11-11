(function () {
  'use strict';
  const C=window.OW.Content;
  if(C.stormglass)return;
  // Expansion geography is appended; the original campaign's eight regions,
  // location IDs and save coordinates stay exactly where they were.
  C.regions.push(
    {id:8,index:8,slug:'stormglass',name:'Stormglass Coast',biome:'coast',color:'#658e94',level:12,commander:'The Stormglass Occupation',description:'Wind-bent moors, salvager villages and luminous beacons above a stormy coast. Optional adventures for levels 12–16.',x:14400,y:0,w:3600,h:5600},
    {id:9,index:9,slug:'sunkencrown',name:'Sunken Crown Isles',biome:'isles',color:'#537e80',level:16,commander:'The Crown Fleet',description:'Tidal causeways connect drowned ruins, refuge islands and occupied anchorages. Optional adventures for levels 16–20.',x:14400,y:5600,w:3600,h:5600}
  );
  const locations=[
    {id:'town_8',name:'Brinewatch Refuge',type:'town',region:8,x:15180,y:2300,radius:300,npc:'Keeper Nacre',description:'A cliffside haven for lighthouse keepers and shipwreck survivors.'},
    {id:'town_stormglass_lantern',name:'Lantern Quay',type:'town',region:8,x:16900,y:4600,radius:280,npc:'Tinker Pip',description:'Salvagers keep the coastal lamps burning from this sheltered quay.'},
    {id:'town_9',name:'Crownrest Haven',type:'town',region:9,x:15700,y:8700,radius:300,npc:'Captain Coral',description:'Fishing families and escaped prisoners share a safe island harbor.'},
    {id:'base_stormglass_0',name:'Harpoon Moorings',type:'base',region:8,x:15550,y:3900,radius:290,level:14,questId:'stormglass_moorings',enemyPool:[44,47,46,44,45,47]},
    {id:'base_sunkencrown_0',name:'Drowned Bell Stockade',type:'base',region:9,x:16900,y:7100,radius:290,level:17,prison:true,questId:'stormglass_prison',enemyPool:[46,45,47,44,46,45]},
    {id:'base_sunkencrown_1',name:'Crown Fleet Anchorage',type:'base',region:9,x:16900,y:10000,radius:300,level:18,convoy:true,questId:'stormglass_convoy',enemyPool:[44,46,45,47,46,47]},
    {id:'cache_stormglass_salvage',name:'The Glass-Tide Wreck',type:'cache',region:8,x:17400,y:3400,radius:80,questId:'stormglass_salvage'},
    {id:'cache_stormglass_cliff',name:'Saltwind Lookout Cache',type:'cache',region:8,x:16600,y:1100,radius:80},
    {id:'cache_sunkencrown_ruins',name:'Drowned Courtyard Cache',type:'cache',region:9,x:15050,y:10150,radius:80},
    {id:'cache_sunkencrown_reed',name:'Reedcrown Smuggler Cache',type:'cache',region:9,x:17400,y:6100,radius:80},
    {id:'defend_stormglass_0',name:'Saltwind Beacon Watch',type:'defend',region:8,x:15050,y:1200,radius:125,friendly:true},
    {id:'defend_stormglass_1',name:'Glass-Tide Rescue Camp',type:'defend',region:8,x:16180,y:3200,radius:125,friendly:true},
    {id:'defend_stormglass_2',name:'Last Lantern Causeway',type:'defend',region:8,x:17300,y:5100,radius:125,friendly:true},
    {id:'defend_sunkencrown_0',name:'Reedcrown Landing',type:'defend',region:9,x:15300,y:6300,radius:125,friendly:true},
    {id:'defend_sunkencrown_1',name:'The Sunken Bell',type:'defend',region:9,x:17100,y:8300,radius:125,friendly:true},
    {id:'defend_sunkencrown_2',name:'Crownrest Evacuation Pier',type:'defend',region:9,x:16050,y:10250,radius:125,friendly:true}
  ];
  const profiles=[
    ['npc_stormglass_nacre','town_8',8,'Keeper Nacre','Lighthouse keeper',0,-320,220,'My lamp survived the last storm. Its sister beacons did not. Follow the northern road east from Frostmarch and you will always find a warm kettle here.','The coast is open to any traveler. You do not need to defeat the commanders to help our villages.'],
    ['npc_stormglass_brindle','town_8',8,'Bosun Brindle','Rescue captain',1,230,270,'Every glass float on that shelf came from a boat we brought home. I am still making room for the missing ones.','The Glass-Tide wreck lies east of the moorings. Rescue work goes better when someone has already stopped the harpoons.'],
    ['npc_stormglass_pip','town_stormglass_lantern',8,'Tinker Pip','Salvage engineer',2,-320,220,'Salt ruins a machine faster than any enemy. I oil every hinge in this village, including the ones that refuse to thank me.','Harpoon Skirmishers pin a lane; Tideblades rush the opening. Keep moving across their aim, then hit the exposed flank.'],
    ['npc_stormglass_mira','town_stormglass_lantern',8,'Scout Mira','Causeway scout',3,230,270,'At low tide you can hear the old city bells under the water. At high tide, you only hear the Bellringers. I prefer the old bells.','The road south becomes the Crown Causeway. Follow its bridges to Crownrest Haven, where Captain Coral shelters escaped prisoners.'],
    ['npc_sunkencrown_coral','town_9',9,'Captain Coral','Island captain',1,-320,220,'We named this island Crownrest because crowns ought to rest while ordinary folk get on with living. The fleet disagrees.','A Shellguard can hold a narrow bridge all day. Draw it onto the wider bank, circle its shield and attack from the side.'],
    ['npc_sunkencrown_fenn','town_9',9,'Herbalist Fenn','Tide-garden keeper',0,230,270,'The tide garden grows medicine in places the maps call empty water. I keep a much more useful map in my apron.','Lit beacons guide the little ferryboats home. A repaired lamp can save as many lives as a cleared garrison.']
  ];
  for(const [id,townId,region,name,role,portrait,offsetX,offsetY,opening,advice]of profiles)C.npcs.push({id,townId,region,name,role,portrait,offsetX,offsetY,resident:true,questIds:[],dialogue:[opening,advice],topics:{local:[opening],advice:[advice]}});
  const quests=[
    {id:'stormglass_beacons',title:'A Light Beyond the Snow',type:'repair',region:8,giverNpcId:'npc_stormglass_nacre',description:'Restore the three salt-damaged roadside beacons so rescued crews can find Brinewatch. Then take Nacre’s news to Bosun Brindle.',objectives:[{id:'stormglass_beacon_0',x:14600,y:1600,label:'Snowline beacon',displayType:'relay'},{id:'stormglass_beacon_1',x:15900,y:1800,label:'Saltwind beacon',displayType:'relay'},{id:'stormglass_beacon_2',x:16350,y:2700,label:'Moorland beacon',displayType:'relay'}],steps:[{action:'repair',label:'Relight the three roadside beacons',targets:['stormglass_beacon_0','stormglass_beacon_1','stormglass_beacon_2']}],required:1,rewardGold:520,rewardXp:600},
    {id:'stormglass_salvage',title:'Salvage the Glass Tide',type:'cache',region:8,giverNpcId:'npc_stormglass_brindle',description:'Recover the sealed rescue stores from the Glass-Tide wreck. Tinker Pip at Lantern Quay can use the surviving signal lenses.',target:'cache_stormglass_salvage',required:1,rewardGold:580,rewardXp:650},
    {id:'stormglass_moorings',title:'Cut the Harpoon Lines',type:'liberate',region:8,giverNpcId:'npc_stormglass_pip',description:'Clear every guard from Harpoon Moorings so the fishing boats can move again. Scout Mira is waiting at Lantern Quay with news from the southern islands.',target:'base_stormglass_0',required:1,rewardGold:720,rewardXp:800},
    {id:'stormglass_prison',title:'The Drowned Bell Prisoners',type:'rescue',region:9,giverNpcId:'npc_stormglass_mira',description:'Cross the Crown Causeway and clear Drowned Bell Stockade to free its captive ferrymen. Find Captain Coral at Crownrest Haven afterward.',target:'base_sunkencrown_0',required:1,rewardGold:850,rewardXp:1000},
    {id:'stormglass_convoy',title:'Break the Crown Blockade',type:'convoy',region:9,giverNpcId:'npc_sunkencrown_coral',description:'Overrun Crown Fleet Anchorage and seize the blockade’s supply convoy. Herbalist Fenn at Crownrest will help the evacuated families return home.',target:'base_sunkencrown_1',required:1,rewardGold:950,rewardXp:1100},
    {id:'stormglass_homecoming',title:'The Homecoming Lights',type:'delivery',region:9,giverNpcId:'npc_sunkencrown_fenn',description:'Relight two forgotten island lanterns, then bring the ferry chart back to Crownrest. The defended watch camps will need your help keeping these routes open.',objectives:[{id:'sunkencrown_lantern_0',x:14900,y:9400,label:'Tide-garden lantern',displayType:'relay'},{id:'sunkencrown_lantern_1',x:16400,y:10800,label:'Outer-crown lantern',displayType:'relay'},{id:'sunkencrown_ferry_chart',x:15700,y:8750,label:'Crownrest ferry chart table',displayType:'terminal'}],steps:[{action:'repair',label:'Relight both island lanterns',targets:['sunkencrown_lantern_0','sunkencrown_lantern_1']},{action:'deliver',label:'Return the safe-passage chart to Crownrest',targets:['sunkencrown_ferry_chart']}],required:2,rewardGold:1100,rewardXp:1300}
  ];
  quests.forEach((q,i)=>{q.main=false;q.prerequisite=i?quests[i-1].id:null;q.nextQuestId=quests[i+1]?.id;q.target=q.target||q.objectives[0].id;q.targetLocation=q.target;C.quests.push(q);C.npcs.find(n=>n.id===q.giverNpcId).questIds.push(q.id);});
  for(const q of quests){const next=quests.find(n=>n.id===q.nextQuestId),contact=next&&C.npcs.find(n=>n.id===next.giverNpcId);if(contact)q.followUp='After this assignment, speak with '+contact.name+' about “'+next.title+'”.';}
  for(const id of ['npc_town_3','npc_town_4']){const n=C.npcs.find(n=>n.id===id);if(n){n.dialogue=n.dialogue||[];n.dialogue.push('The eastern coast road is open. Keeper Nacre at Brinewatch Refuge has work for travelers; Captain Coral watches the Sunken Crown Isles farther south.');}}
  C.stormglass={version:1,locations,questIds:quests.map(q=>q.id),regionIndices:[8,9]};
})();
