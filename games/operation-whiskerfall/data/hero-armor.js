(function(){
  'use strict';
  const C=window.OW.Content;
  const patterns=[
    {id:'armor_stormrunner',name:'Stormrunner Harness',armorStyle:'stormrunner',armor:.2,health:45,rarity:4,color:'#73d6d0',commanders:2,cost:{gold:1800,materials:90,cores:4},playstyle:'Mobile marksman',benefit:'Each dodge loads up to 2 rounds from reserves and empowers your next shot by 35% for 3 seconds.',tradeoff:'Moderate protection; the shot bonus expires if you wait or change armor.'},
    {id:'armor_bastion',name:'Bastion Bulwark',armorStyle:'bastion',armor:.32,health:70,rarity:4,color:'#e5be75',commanders:4,cost:{gold:3400,materials:150,cores:7},playstyle:'Braced frontline fighter',benefit:'Stand still for 0.35 seconds to reduce frontal damage by another 30%. A guarded hit empowers your next melee swing by 30% for 3 seconds.',tradeoff:'14% slower walking. Moving, dodging or swinging breaks your brace; side and rear attacks bypass it.'},
    {id:'armor_spellweaver',name:'Spellweaver Mantle',armorStyle:'spellweaver',armor:.18,health:40,rarity:5,color:'#c6a0ed',commanders:6,cost:{gold:5400,materials:220,cores:10},playstyle:'Spell-focused caster',benefit:'Successful abilities have 20% shorter cooldowns and grant a 2.5-second ward absorbing 35 + 2 per hero level damage, capped at 75.',tradeoff:'Firearms deal 15% less damage. The ward replaces itself; it never stacks or restores health.'}
  ];
  C.heroArmorPatterns=patterns;
  for(const pattern of patterns){const item={...pattern,slot:'armor',level:1,price:pattern.cost.gold,forgeOnly:true,description:pattern.benefit+' '+pattern.tradeoff,rewardSource:'Resistance forge · '+pattern.commanders+' commanders defeated'};const index=C.equipment.findIndex(e=>e.id===item.id);if(index<0)C.equipment.push(item);else C.equipment[index]=item;}
})();
