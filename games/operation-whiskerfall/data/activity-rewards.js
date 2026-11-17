(function(){
  'use strict';
  const C=window.OW.Content;
  const records=[
    ['lantern','Nettle’s Signal Brooch','Bellkeeper’s Tea Room','Standing still tightens firearm spread by 35% and extends range by 12%.',3],
    ['quarry','Quarry Laurel','Quarry Ring','Heavy melee strikes deal 20% more damage. Light strikes keep their usual cadence.',4],
    ['bay','Shellbreak Creel','Shellbreak Bay','A field dressing restores another 15% of your maximum health and heals a nearby partner for 8%.',3],
    ['yard','Brass Coupler','Switchyard Dispatch','An indexed cartridge belt reduces firearm reload time by 20%.',3],
    ['wind','Kitehook Spool','Windpost Trial','The quick-release line shortens dodge recovery by 18%.',4]
  ];
  const requirements={
    lantern:'Win a four-Signal match against the visiting mouse or a local opponent.',
    quarry:'Defeat Champion Slate-Ear in the final ranked bout.',
    bay:'Land eight fish in one timed catch race, or land three fish totaling at least 7 kg in one outing.',
    yard:'Deliver all three carts on the expert yard with zero conflicts in twelve beats or fewer.',
    wind:'Finish all six rings in under 120 seconds with no collision or broken-line penalties.'
  };
  C.activityMasterworks=records.map(([activity,name,venue,description,rarity])=>{
    const item={id:'accessory_mastery_'+activity,name,slot:'accessory',level:1,rarity,activityMastery:activity,
      rewardOnly:true,rewardSource:venue+' · '+requirements[activity],requirement:requirements[activity],description,art:'assets/activities/reward-'+activity+'.webp'};
    C.equipment.push(item);return item;
  });
}());
