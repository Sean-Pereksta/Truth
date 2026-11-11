(function(){
  'use strict';
  const C=window.OW.Content;
  const definitions=[
    {id:'invasion_orchard',title:'When the Orchard Answers',region:0,level:3,prerequisite:'main_0_0',giverNpcId:'npc_town_0',frontName:'Harvest Road Barricade',opening:'Saffron: Those orders were signed by every commander. This is a coordinated offensive. Get the harvest crews out; we will hold the road together.',fallback:'Juniper: The supply road is compromised. Walk the families to the fallback lantern. I am staying with the last cart.',victory:'Saffron: They planned to silence one village at a time. Now every village will hear us. The signal crews are yours.',support:'Orchard signal crew',rewardGold:450,rewardXp:440},
    {id:'invasion_frost',title:'The Night Warmhearth Fell',region:3,level:10,prerequisite:'main_3_2',giverNpcId:'npc_town_3',frontName:'Warmhearth Evacuation Road',opening:'Lumi: Whiteclaw left the ferry route on the enemy frequency. Our safe road is gone. Save the families first; we can rebuild a road.',fallback:'Crag: My mountaineers found a shelter beyond the bend. Cover Lumi while she brings the wounded through.',victory:'Lumi: Every name on my list is accounted for. Take our siege-breaker and the medical team. Nobody faces Berlin alone.',support:'Warmhearth medics',rewardGold:1150,rewardXp:1200},
    {id:'invasion_berlin',title:'All Roads to the Resistance',region:7,level:22,prerequisite:'main_7_2',giverNpcId:'npc_town_7',frontName:'Blackbanner Supply Approach',opening:'Dawn: The commanders are falling, but Whisker is sending his reserve army. Keep this approach open and all our friends can join the final push.',fallback:'Cinder: The evacuation wagons carry the charges for Berlin. Walk them past the searchlights. I will keep the wheels turning.',victory:'Dawn: Signals, medicine, and a road through the dark. Every small victory brought us here. Our allies will meet you at Berlin.',support:'Blackbanner engineers',rewardGold:2400,rewardXp:2400}
  ];
  C.invasions=definitions;
  for(const q of definitions){
    Object.assign(q,{type:'invasion',main:false,target:q.id+'_front',targetLocation:q.id+'_front',required:3,description:q.opening+' Three stages: hold the barricade, escort the evacuation, then disable the siege command. No overall kill timer. Stage checkpoints preserve completed work. Choose a rescued medic team or reinforced barricade before the first attack.'});
    C.quests.push(q);const n=C.npcs.find(n=>n.id===q.giverNpcId);if(n)n.questIds.push(q.id);
  }
})();
