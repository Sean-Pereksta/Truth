(function () {
  'use strict';
  const C = window.OW.Content;
  const patterns = [];
  const families = {
    carbine: [['Short stroke', 'Cycle bursts 22% faster with one fewer round per burst.'], ['Long stroke', 'One extra round per burst with 20% longer recovery.']],
    scatter: [['Duckbill', 'Widen spread 45% and double knockback.'], ['Choke', 'Narrow spread 45% and reach 25% farther.']],
    marksman: [['Quick coil', 'Charge 35% faster at 15% less damage.'], ['Overdraw', 'Gain 30% damage at a 35% longer charge.']],
    spool: [['Heat sink', 'Cool 60% faster at 10% lower cadence.'], ['Overdrive', 'Cycle 22% faster and build 30% more heat per shot.']],
    saber: [['Counterweight', 'Extend your riposte opening by 0.22 seconds.'], ['Feather tang', 'Recover 20% faster with a 12% shorter reach.']],
    maul: [['Long haft', 'Reach 25% farther with 20% more recovery.'], ['Split head', 'Heavy blows stagger longer and deal 18% more damage at 12% shorter reach.']]
  };
  function pattern(id, name, family, index, clues, description, extra) {
    const n = patterns.length;
    const cost = {gold: 50 + clues * 25, materials: 4 + clues * 2, cores: clues >= 5 ? 1 : 0};
    const item = {id, name, level:1, rarity:clues >= 7 ? 4 : clues >= 3 ? 3 : 2,
      forgeOnly:true, reconFamily:family, reconArt:index, clues, cost, description,
      rewardSource: clues ? 'Resistance forge · confirm '+clues+' dossier '+(clues===1?'lead':'leads') : 'Resistance forge · field issue', ...extra};
    C.equipment.push(item);
    patterns[n] = item;
  }
  const guns = [
    ['rushleaf','Rushleaf Carbine','carbine',0,'A short two-round burst keeps the courier mobile between shots.',
      {kind:'rifle',mechanic:'burst',burstCount:2,burstDelay:.065,damage:14,fireRate:3.7,magazine:20,reload:.86,range:585,spread:.07}],
    ['switchback','Switchback Carbine','carbine',3,'Four slow, tightly spaced rounds reward a clear firing lane.',
      {kind:'rifle',mechanic:'burst',burstCount:4,burstDelay:.055,damage:17,fireRate:2.15,magazine:16,reload:1.48,range:790,spread:.026}],
    ['lockjaw','Lockjaw Scattergun','scatter',1,'Six pellets push a patrol apart. Damage falls off at distance.',
      {kind:'shotgun',mechanic:'auto',pellets:6,damage:8,fireRate:1.75,magazine:5,reload:1.13,range:370,spread:.53,knockback:17}],
    ['rivetpunch','Rivet Punch','scatter',4,'A single dense slug strips a guard and penetrates the next target.',
      {kind:'shotgun',mechanic:'semi',pellets:1,damage:48,fireRate:1.8,magazine:4,reload:1.28,range:575,spread:.055,knockback:32,penetration:1,guardBreak:true}],
    ['skyneedle','Skyneedle','marksman',2,'A quick charge and light magazine favor mobile, deliberate shots.',
      {kind:'sniper',mechanic:'charge',damage:32,chargeTime:.42,fireRate:3.1,magazine:7,reload:1.28,range:980,spread:.018}],
    ['bellglass','Bellglass Lens','marksman',6,'Hold the charge for a long, penetrating shot. Moving scatters the sight.',
      {kind:'sniper',mechanic:'charge',damage:55,chargeTime:.92,fireRate:1.7,magazine:4,reload:1.6,range:1180,spread:.014,penetration:2}],
    ['wrenwheel','Wrenwheel Repeater','spool',2,'A light rotor reaches full cadence quickly. Pause to vent its small heat sink.',
      {kind:'lmg',mechanic:'spinup',damage:11,spinupTime:.37,heatPerShot:.095,coolingRate:.34,overheatTime:.8,fireRate:10,magazine:30,reload:1.3,range:660,spread:.08}],
    ['redfoundry','Red Foundry Repeater','spool',7,'A heavy rotor needs sustained fire. Larger heat capacity favors holding position.',
      {kind:'lmg',mechanic:'spinup',damage:16,spinupTime:1.05,heatPerShot:.065,coolingRate:.22,overheatTime:1.4,fireRate:11,magazine:54,reload:2.15,range:725,spread:.065}]
  ];
  for(const [index,[id,name,family,clues,description,stats]] of guns.entries()){
    const weapon=C.weapons.length;
    C.weapons.push({id,name,level:1,speed:1040,reconFamily:family,reconArt:index,mechanicName:name,mechanicDescription:description,...stats});
    pattern('weapon_'+id,name,family,index,clues,description,{slot:'weapon',weapon});
  }
  const blades=[
    ['leafsaber','Leafrunner Saber','saber',0,21,76,.29,'A fast cut. Dodge an incoming strike, then cut within 0.55s for a double-damage riposte.'],
    ['bellfoil','Bell Tower Foil','saber',4,27,107,.39,'Longer reach and a narrower arc. A timely dodge opens a 0.7s double-damage riposte.'],
    ['latchhammer','Latch Hammer','maul',1,33,86,.52,'Wide, short sweeps expose shields. Heavy swings stop guards.'],
    ['turnkey','Turnkey Maul','maul',8,48,114,.74,'A long two-paw reach and a deliberate recovery. Heavy blows sweep through a shield line.']
  ];
  for(const [i,[id,name,family,clues,damage,range,speed,description]] of blades.entries()){
    const melee=C.melee.length,index=i+8;
    C.melee.push({id,name,level:1,damage,range,speed,reconArt:index,reconFamily:family,description,riposteTime:i===1?.7:.55,arc:[1.04,.71,1.38,1.58][i]});
    pattern('melee_'+id,name,family,index,clues,description,{slot:'melee',melee});
  }
  const suits=[
    ['reedrunner','Dispatch Poncho',0,.09,6,'Scout','Walk 15% faster. Light canvas offers only 9% protection.'],
    ['sluice','Sluice Waders',2,.13,12,'Scout','Recover your dodge 22% faster. Water seals cost 12% longer reloads.'],
    ['railcoat','Railhandler Coat',3,.18,20,'Field','Reload 26% faster. Reinforced sleeves slow walking by 6%.'],
    ['lantern','Lantern Cloak',5,.12,15,'Scout','A well-timed dodge loads 3 reserve rounds. The thin cloak adds only 12% protection.'],
    ['medic','Patchkeeper Apron',1,.14,25,'Field','Field dressings also heal nearby allies for 24% of their maximum health. Walk 5% slower.'],
    ['rigger','Coil Rigger',4,.16,22,'Field','Cool the spool 65% faster. Cartridge belts slow dodge recovery by 15%.'],
    ['riveter','Rivetwall Plate',6,.28,54,'Heavy','Impact plates reduce heavy hits of 32 or more by a further 22%. Walk 14% slower.'],
    ['breakwater','Breakwater Shell',10,.31,66,'Heavy','Your heavy melee strikes hold ordinary enemies stunned for an extra 0.4s. Walk 17% slower and reload 10% slower.']
  ];
  for(const [i,[id,name,clues,armor,health,role,description]] of suits.entries()){
    pattern('armor_recon_'+id,name,'armor',i,clues,description,{slot:'armor',armor,health,role,reconSuit:id});
  }
  // Expedition plans use the shared turn-in ledger, including when the
  // second hero rests at camp. The final hub can also issue the heavy shell.
  const expeditionPlans=[
    ['weapon_bellglass','rare_rimeglass','Keeper Thistle at Rimeglass Reservoir',false],
    ['weapon_redfoundry','rare_cindercoil','Foreman Brindle at Cindercoil Foundry',true],
    ['armor_recon_lantern','rare_zephyr','Pilgrim Sora at Zephyr Reliquary',false],
    ['armor_recon_breakwater','rare_kraken','Diver Pearl at the Drowned Maw',true]
  ];
  for(const [id,quest,contact,exclusive] of expeditionPlans){
    const item=patterns.find(entry=>entry.id===id);
    item.planQuest=quest;item.planContact=contact;item.exclusivePlan=exclusive;
    item.hubPlan=id==='armor_recon_breakwater';
    item.rewardSource=(exclusive?'Return to '+contact:'Confirm '+item.clues+' leads or return to '+contact)+(item.hubPlan?' or finish the Berlin campaign.':'.');
  }
  C.reconGear={patterns,families};
}());
