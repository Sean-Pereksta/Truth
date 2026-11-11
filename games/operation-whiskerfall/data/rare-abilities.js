(function(){
  'use strict';
  const C=window.OW.Content;
  const abilities=[
    {id:'frost_breath',name:'Frost Breath',kind:'frostbreath',category:'Control',level:12,unlockCost:1,questOnly:true,questId:'rare_rimeglass',questName:'A Breath Beneath the Ice',cooldown:18,damage:18,radius:270,range:270,duration:.9,color:'#a5edff',rewardStatement:'REWARD: Frost Breath — sweep a cone of biting cold across your foes, building frost until ordinary enemies freeze.',discoveryClue:'Seek the lost reservoir expedition in Frostmarch. Its entrance requires the Rimeglass Valve Key, hidden elsewhere in Stonecrest.',description:'Breathe three pulses through a 270-range cone: 18 base damage per pulse, plus hero level and Tactics scaling. Each pulse builds frost. Four frost hits freeze ordinary enemies for 1.1 seconds; bosses are chilled instead. Frozen targets resist another freeze for 4 seconds. Earned only from A Breath Beneath the Ice.'},
    {id:'aurora_well',name:'Aurora Well',kind:'aurorawell',category:'Support',level:16,unlockCost:1,questOnly:true,questId:'rare_zephyr',questName:'The Wind Remembers',cooldown:24,damage:0,radius:165,duration:4,color:'#9ff4d9',rewardStatement:'REWARD: Aurora Well — plant a four-second sanctuary that restores nearby heroes and allies while clearing the chill.',discoveryClue:'Find the wayfinder who watches the wind-carved Zephyr Reliquary in Reedwater.',description:'Create a 165-radius sanctuary for 4 seconds. Living heroes inside recover 6% maximum health each second, up to 24% total; nearby resistance allies recover at the same rate. Clears slowing chill while inside. Does not revive fallen allies, and overlapping wells do not stack. Earned only from The Wind Remembers.'}
  ];
  for(const ability of abilities)if(!C.abilities.some(a=>a.id===ability.id))C.abilities.push(ability);
  C.rareAbilityRewards={rare_rimeglass:'frost_breath',rare_zephyr:'aurora_well'};
})();
