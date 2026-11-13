// Bannerlands simulation. World coordinates are measured in grid cells.
import {generateLands,isPassableTile,tileTravelCost} from './lands.js';
import {LandsNavigation} from './navigation.js';
import {CombatTerrain} from './cover.js';
import {WarVision} from './vision.js';
import {BattleAftermath} from './aftermath.js';
import {registerRegiments,regimentForHouse,regimentAllowed,regimentRequiredBuilding,regimentBuildingForHouse,regimentsForHouse,regimentBuildingsForHouse,houseCanRecruit,houseCanBuild,shieldFacingMultiplier} from './regiments.js';
export const HOUSES = [
  {name:'House Stark',motto:'Winter is coming',sigil:'wolf',color:'#8ac9e8',dark:'#234c61',trait:'Steadfast in the North'},
  {name:'House Lannister',motto:'Hear me roar',sigil:'lion',color:'#ef7165',dark:'#672e31',trait:'The pride of the West'},
  {name:'House Targaryen',motto:'Fire and blood',sigil:'dragon',color:'#bc98ed',dark:'#493264',trait:'Born to conquer'},
  {name:'House Baratheon',motto:'Ours is the fury',sigil:'stag',color:'#e9bf58',dark:'#665127',trait:'Thunder of the Stormlands'},
  {name:'House Tyrell',motto:'Growing strong',sigil:'rose',color:'#95cb75',dark:'#3a5e35',trait:'The strength of the Reach'},
  {name:'House Martell',motto:'Unbowed, unbent, unbroken',sigil:'sun',color:'#f4a361',dark:'#734b2c',trait:'The spears of Dorne'},
  {name:'House Greyjoy',motto:'We do not sow',sigil:'kraken',color:'#73d3c4',dark:'#285852',trait:'Reavers of the Iron Islands'},
  {name:'House Arryn',motto:'As high as honor',sigil:'falcon',color:'#a5b7ef',dark:'#3e4a72',trait:'Guardians of the Vale'},
  {name:'House Bolton',motto:'Our blades are sharp',sigil:'flayed',color:'#df8f9d',dark:'#703c4b',trait:'Relentless close assaults'},
  {name:'House Frey',motto:'We stand together',sigil:'bridge',color:'#b6c4d1',dark:'#465763',trait:'Two fronts, one banner'},
  {name:'House Mormont',motto:'Here we stand',sigil:'bear',color:'#89ba8d',dark:'#37533e',trait:'An unyielding guard'},
  {name:'House Tully',motto:'Family, duty, honor',sigil:'fish',color:'#6daedc',dark:'#304e70',trait:'A network of strongholds'},
  {name:'House Reed',motto:'Through the hidden paths',sigil:'frog',color:'#b2c365',dark:'#4d5b2e',trait:'Masters of the greenwood'},
  {name:'House Hightower',motto:'We light the way',sigil:'beacon',color:'#c6c6df',dark:'#50536e',trait:'Engineers of conquest'},
  {name:'House Tarly',motto:'First in battle',sigil:'huntsman',color:'#b88d68',dark:'#64432f',trait:'Discipline wins battles'},
  {name:'Free Folk',motto:'We do not kneel',sigil:'bone',color:'#ded2b4',dark:'#655d48',trait:'Strength in numbers'}
];

const HOUSE_IDENTITIES={
 wolf:{playstyle:'Defensive battle lines',advantages:['Held infantry resists charge knockback by an extra 45%.','Troops holding owned ground recover health 2.5× faster.'],power:{name:'Northern Resolve',description:'Heal your selected soldiers by 16% and strengthen their resolve and recovery for 8 seconds. With no selection, affects your army.',cooldown:45,cost:0}},
 lion:{playstyle:'Forward mercenary warfare',advantages:['Paid companies muster at the owned building closest to your rally point.','Hire a mixed sellsword company at your forward recruitment post.'],power:{name:'Sellsword Contract',description:'Spend 150 gold for 8 swordsmen and 4 archers at the building closest to your rally. Requires 12 free supply.',cooldown:45,cost:150}},
 dragon:{playstyle:'Siege and area denial',advantages:['Catapult impacts leave burning ground for 3 seconds.','Fire zones damage enemies only; overlapping flames do not stack damage.'],power:{name:'Firestorm',description:'Burn an enemy position within 8 cells of your selected force for 5 seconds. Select a frontline force to aim the fire.',cooldown:55,cost:0}},
 stag:{playstyle:'Cavalry shock assaults',advantages:['Cavalry loses 25% less momentum on collision.','Charges push enemies 20% farther.'],power:{name:'Storm Charge',description:'For 10 seconds, selected cavalry builds its charge faster and retains more momentum on impact. A real run-up is still required.',cooldown:45,cost:0}},
 rose:{playstyle:'Territory and rapid mustering',advantages:['Each completed Bannerland speeds automatic training by 2%, up to 20%.','Muster extra companies across your production network.'],power:{name:'Rapid Muster',description:'Immediately train one company at up to 4 production buildings, within your supply limit.',cooldown:60,cost:0}},
 sun:{playstyle:'Mobile archer skirmishing',advantages:['Attack-ordered archers back away from nearby melee troops while firing.','Venom arrows apply a non-stacking poison and a light slow.'],power:{name:'Viper Venom',description:'For 10 seconds, selected archers poison enemies hit by their arrows for 4 seconds.',cooldown:45,cost:0}},
 kraken:{playstyle:'Raiding and mobile conquest',advantages:['First capture of each enemy-held tile pays 6 gold; recaptures cannot farm the reward.','Use raiding speed to seize ground without stopping to claim each tile.'],power:{name:'Reaver\'s Rush',description:'Selected soldiers move 15% faster and keep marching while capturing for 10 seconds.',cooldown:45,cost:0}},
 falcon:{playstyle:'Watchtower garrisons',advantages:['New watchtowers deploy 3 archers, subject to supply.','Watchtowers fire 0.7 cells farther.'],power:{name:'Falcon Guard',description:'For 10 seconds, your watchtowers gain another 1.2 cells of range and fire 40% faster. Requires a watchtower.',cooldown:50,cost:0}},
 flayed:{playstyle:'Sustained infantry assaults',advantages:['Swordsmen recover 8 health when they finish an enemy soldier.','Feed a successful close assault with temporary life-stealing strikes.'],power:{name:'Dread Harvest',description:'For 10 seconds, selected swordsmen recover 25% of the melee damage they inflict.',cooldown:50,cost:0}},
 bridge:{playstyle:'Two-front reinforcement',advantages:['Paid companies split between two recruitment posts nearest the rally.','Muster twin garrisons to reinforce separated fronts.'],power:{name:'Twin Garrisons',description:'Spend 200 gold to raise 4 swordsmen and 4 archers at each of two owned buildings. Requires two posts and 16 free supply.',cooldown:60,cost:200}},
 bear:{playstyle:'Commander-led infantry',advantages:['Idle infantry near a commander recovers health faster.','A commander anchors nearby infantry against knockback.'],power:{name:'Bear Guard',description:'For 10 seconds, selected infantry takes 30% less damage and strongly resists knockback.',cooldown:50,cost:0}},
 fish:{playstyle:'Interlocking strongholds',advantages:['Idle soldiers near friendly towers and keeps recover health faster.','Repair and resupply a network of forts in one rally.'],power:{name:'River Renewal',description:'Repair all owned buildings by 18% and heal nearby friendly soldiers by 12%.',cooldown:60,cost:0}},
 frog:{playstyle:'Forest ambushes',advantages:['Archers in forests gain 1 extra cell of range and fire 15% faster.','Use woodland paths for fast, uninterrupted flanking marches.'],power:{name:'Hidden Paths',description:'For 12 seconds, selected troops ignore forest penalties, gain 30% forest movement speed, and march through forest capture points without stopping.',cooldown:45,cost:0}},
 beacon:{playstyle:'A siege production network',advantages:['Siege workshops train catapults 25% faster.','Call engineers to repair workshops and deploy an extra siege company.'],power:{name:'Engineering Corps',description:'Spend 120 gold to deploy 2 catapults at a siege workshop and repair your workshops by 20%. Requires 2 free supply.',cooldown:65,cost:120}},
 huntsman:{playstyle:'Disciplined infantry advances',advantages:['Swordsmen in Line formation attack 15% faster.','Advance and strike without breaking the march.'],power:{name:'Disciplined Advance',description:'For 10 seconds, selected infantry attacks while advancing along its order and captures without stopping.',cooldown:45,cost:0}},
 bone:{playstyle:'Massed war bands',advantages:['Paid infantry and archer companies contain 2 additional soldiers.','Muster a large war band to overwhelm a front.'],power:{name:'Wild Muster',description:'Spend 150 gold to muster 20 swordsmen at your main recruitment post. Requires 20 free supply.',cooldown:60,cost:150}}
};
const HOUSE_WEAKNESSES={wolf:['Cavalry needs 25% more time to prepare a charge.'],lion:['Automatic recruitment runs 10% slower.'],dragon:['Paid catapult companies cost 25% more.'],stag:['Paid cavalry companies cost 15% more.'],rose:['Automatic catapult training runs 25% slower.'],sun:['Paid infantry companies cost 15% more.','Cannot build siege works or recruit catapults; horse archers are poor against fortifications.'],kraken:['Passive recovery on owned ground is 50% slower.'],falcon:['Paid catapult companies cost 20% more.'],flayed:['Paid archer companies cost 20% more.'],bridge:['Paid cavalry companies cost 20% more.'],bear:['All paid reinforcement companies cost 10% more.'],fish:['Weapons upgrades cost 15% more.'],frog:['Automatic catapult training runs 20% slower.'],beacon:['Paid cavalry companies cost 20% more.'],huntsman:['Automatic archer training runs 15% slower.'],bone:['Armor upgrades cost 20% more.']};
for(const h of HOUSES)Object.assign(h,HOUSE_IDENTITIES[h.sigil],{weaknesses:HOUSE_WEAKNESSES[h.sigil]});

export const UNIT_DEFS = {
  infantry:{label:'Swordsmen',cost:100,batch:8,hp:132,damage:13,range:.64,speed:1.42,rate:.83,radius:.145,role:'Armored frontline · vulnerable to full charges'},
  archer:{label:'Archers',cost:130,batch:8,hp:80,damage:12,range:3.65,speed:1.38,rate:1.2,radius:.13,role:'Ranged volleys · counters infantry'},
  cavalry:{label:'Cavalry',cost:180,batch:6,hp:175,damage:24,range:.73,speed:2.25,rate:1.15,radius:.195,role:'Fast flanks · counters archers'},
  siege:{label:'Catapults',cost:240,batch:2,hp:194,damage:82,range:5.4,speed:.88,rate:3.1,radius:.24,role:'Area bombardment · destroys buildings'},
  hero:{label:'Commander',cost:0,batch:1,hp:800,damage:28,range:.85,speed:1.72,rate:.7,radius:.2,role:'A resilient rallying champion'}
};

export const BUILD_DEFS = {
  keep:{label:'Keep',cost:0,hp:2500,range:5.5,damage:24,rate:1.1,interval:18,batch:3,unit:'infantry',radius:.8,role:'Castle realm · +60 supply · trains 3 swordsmen every 18 seconds'},
  barracks:{label:'Barracks',cost:220,hp:850,interval:18,batch:4,unit:'infantry',radius:.52,role:'Trains 4 swordsmen every 18 seconds'},
  range:{label:'Archery range',cost:260,hp:660,interval:24,batch:4,unit:'archer',radius:.5,role:'Trains 4 archers every 24 seconds'},
  stables:{label:'Stables',cost:320,hp:900,interval:30,batch:3,unit:'cavalry',radius:.58,role:'Trains 3 riders every 30 seconds'},
  tower:{label:'Watchtower',cost:200,hp:1150,range:4.6,damage:25,rate:1.25,radius:.38,role:'Defends a frontier with arrow fire'},
  workshop:{label:'Siege works',cost:400,hp:880,interval:50,batch:1,unit:'siege',radius:.58,role:'Builds a catapult every 50 seconds'}
};

export const HOUSE_CONTENT = {
  wolf:{"unit":"winter_guard","building":"winter_hall","castleName":"Winterfell","movement":"Infantry moves 12% faster on owned land.","recruitment":"Winter Halls within 6 tiles of your keep train 15% faster."},
  lion:{"unit":"gilded_crossbow","building":"mercenary_guild","castleName":"Casterly Rock","movement":"Move orders march 12% faster.","recruitment":"Paid Gilded Crossbow companies cost 15% less and muster at the guild nearest your rally."},
  dragon:{"unit":"dragonfire_acolyte","building":"dragonfire_foundry","castleName":"Dragonstone","movement":"Troops within 4 tiles of their commander move 10% faster.","recruitment":"Dragonfire Foundries train 15% faster after your first weapons upgrade."},
  stag:{"unit":"storm_rider","building":"storm_paddock","castleName":"Storm’s End","movement":"Cavalry moves 12% faster outside forests.","recruitment":"Paid Storm Rider companies gain 1 rider while you own a regular stables."},
  rose:{"unit":"thorn_lancer","building":"garden_stables","castleName":"Highgarden","movement":"Troops move 10% faster on owned land.","recruitment":"Paid Thorn Lancer companies gain 1 rider at 3 completed Bannerlands."},
  sun:{"unit":"dune_skirmisher","building":"sunspear_yard","castleName":"Sunspear","movement":"Troops move 15% faster on open grassland.","recruitment":"Paid Dune Skirmisher companies cost 15% less once you own 100 tiles."},
  kraken:{"unit":"ironborn_reaver","building":"raider_longhall","castleName":"Pyke","movement":"Troops move 15% faster on enemy territory.","recruitment":"Paid Ironborn Reavers earn a 1% discount per house kill, up to 20%."},
  falcon:{"unit":"vale_sentinel","building":"falcon_roost","castleName":"The Eyrie","movement":"Troops move 18% faster on hills.","recruitment":"Falcon Roosts train 15% faster while at least 2 watchtowers survive."},
  flayed:{"unit":"dread_pike","building":"dreadfort_yard","castleName":"The Dreadfort","movement":"Attack-ordered troops above half health move 10% faster.","recruitment":"Paid Dread Pike companies gain 1 soldier while your army is below half supply."},
  bridge:{"unit":"bridge_warden","building":"twin_guardhouse","castleName":"The Twins","movement":"Troops within 4 tiles of a production building move 12% faster.","recruitment":"Paid Bridge Wardens split between the 2 nearest Twin Guardhouses when both survive."},
  bear:{"unit":"bear_mauler","building":"bear_lodge","castleName":"Bear Island","movement":"Troops within 3 tiles of their commander move 14% faster.","recruitment":"Bear Lodges within 4 tiles of a living commander train 20% faster."},
  fish:{"unit":"river_ranger","building":"riverside_lodge","castleName":"Riverrun","movement":"Troops within 4 tiles of a keep or watchtower move 12% faster.","recruitment":"Riverside Lodges within 4 tiles of a keep or watchtower train 15% faster."},
  frog:{"unit":"crannog_hunter","building":"marsh_hideout","castleName":"Greywater Watch","movement":"Troops move 20% faster in forests.","recruitment":"Marsh Hideouts built in forests train 20% faster."},
  beacon:{"unit":"beacon_engineer","building":"engineers_college","castleName":"The Hightower","movement":"Siege troops move 14% faster.","recruitment":"Paid Beacon Engineer companies cost 15% less while 2 regular siege workshops survive."},
  huntsman:{"unit":"hill_huntsman","building":"huntsman_lodge","castleName":"Horn Hill","movement":"Infantry and archers in Line formation move 12% faster.","recruitment":"Huntsman Lodges train 15% faster after both weapons and armor reach level 1."},
  bone:{"unit":"freefolk_berserker","building":"warband_camp","castleName":"Free Folk Stronghold","movement":"Troops move 15% faster in forests and hills.","recruitment":"Paid Berserker companies gain 2 additional warriors while you own fewer than 100 tiles."},
};
for(const h of HOUSES){const c=HOUSE_CONTENT[h.sigil];h.advantages=[...h.advantages,c.movement,c.recruitment];h.specialist=c.unit;h.production=c.building;h.castleName=c.castleName;}

UNIT_DEFS.winter_guard={"label":"Winter Guard","class":"infantry","house":"wolf","cost":240,"batch":4,"hp":212,"damage":20,"range":0.78,"speed":1.25,"rate":0.95,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.winter_hall={"label":"Winter Hall","house":"wolf","cost":360,"hp":1000,"interval":34,"batch":3,"unit":"winter_guard","radius":0.58,"role":"Trains 3 winter guard every 34 seconds before house bonuses"};
UNIT_DEFS.gilded_crossbow={"label":"Gilded Crossbows","class":"archer","house":"lion","cost":240,"batch":4,"hp":118,"damage":23,"range":4.05,"speed":1.32,"rate":1.65,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.mercenary_guild={"label":"Mercenary Guild","house":"lion","cost":380,"hp":1000,"interval":36,"batch":3,"unit":"gilded_crossbow","radius":0.58,"role":"Trains 3 gilded crossbows every 36 seconds before house bonuses"};
UNIT_DEFS.dragonfire_acolyte={"label":"Dragonfire Acolytes","class":"siege","house":"dragon","cost":300,"batch":2,"hp":170,"damage":48,"range":4.25,"speed":1.22,"rate":3.15,"radius":0.23,"role":"House elite bombardment · destroys buildings"};
BUILD_DEFS.dragonfire_foundry={"label":"Dragonfire Foundry","house":"dragon","cost":440,"hp":1000,"interval":48,"batch":1,"unit":"dragonfire_acolyte","radius":0.58,"role":"Trains 1 dragonfire acolytes every 48 seconds before house bonuses"};
UNIT_DEFS.storm_rider={"label":"Storm Riders","class":"cavalry","house":"stag","cost":280,"batch":3,"hp":235,"damage":31,"range":0.84,"speed":2.45,"rate":1.3,"radius":0.2,"role":"House elite riders · counters archers"};
BUILD_DEFS.storm_paddock={"label":"Storm Paddock","house":"stag","cost":420,"hp":1000,"interval":42,"batch":2,"unit":"storm_rider","radius":0.58,"role":"Trains 2 storm riders every 42 seconds before house bonuses"};
UNIT_DEFS.thorn_lancer={"label":"Thorn Lancers","class":"cavalry","house":"rose","cost":250,"batch":4,"hp":205,"damage":26,"range":0.88,"speed":2.3,"rate":1.22,"radius":0.2,"role":"House elite riders · counters archers"};
BUILD_DEFS.garden_stables={"label":"Garden Stables","house":"rose","cost":390,"hp":1000,"interval":38,"batch":2,"unit":"thorn_lancer","radius":0.58,"role":"Trains 2 thorn lancers every 38 seconds before house bonuses"};
UNIT_DEFS.dune_skirmisher={"label":"Dune Skirmishers","class":"archer","house":"sun","cost":220,"batch":5,"hp":122,"damage":21,"range":3.25,"speed":1.72,"rate":1.25,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.sunspear_yard={"label":"Sunspear Yard","house":"sun","cost":350,"hp":1000,"interval":32,"batch":3,"unit":"dune_skirmisher","radius":0.58,"role":"Trains 3 dune skirmishers every 32 seconds before house bonuses"};
UNIT_DEFS.ironborn_reaver={"label":"Ironborn Reavers","class":"infantry","house":"kraken","cost":230,"batch":5,"hp":178,"damage":25,"range":0.75,"speed":1.815,"rate":1,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.raider_longhall={"label":"Raider Longhall","house":"kraken","cost":360,"hp":1000,"interval":34,"batch":3,"unit":"ironborn_reaver","radius":0.58,"role":"Trains 3 ironborn reavers every 34 seconds before house bonuses"};
UNIT_DEFS.vale_sentinel={"label":"Vale Sentinels","class":"archer","house":"falcon","cost":250,"batch":4,"hp":145,"damage":23,"range":4.3,"speed":1.3,"rate":1.65,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.falcon_roost={"label":"Falcon Roost","house":"falcon","cost":400,"hp":1000,"interval":39,"batch":3,"unit":"vale_sentinel","radius":0.58,"role":"Trains 3 vale sentinels every 39 seconds before house bonuses"};
UNIT_DEFS.dread_pike={"label":"Dread Pikes","class":"infantry","house":"flayed","cost":230,"batch":5,"hp":198,"damage":25,"range":1,"speed":1.35,"rate":1.1,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.dreadfort_yard={"label":"Dreadfort Yard","house":"flayed","cost":370,"hp":1000,"interval":35,"batch":3,"unit":"dread_pike","radius":0.58,"role":"Trains 3 dread pikes every 35 seconds before house bonuses"};
UNIT_DEFS.bridge_warden={"label":"Bridge Wardens","class":"infantry","house":"bridge","cost":220,"batch":5,"hp":192,"damage":21,"range":0.95,"speed":1.42,"rate":1,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.twin_guardhouse={"label":"Twin Guardhouse","house":"bridge","cost":350,"hp":1000,"interval":34,"batch":3,"unit":"bridge_warden","radius":0.58,"role":"Trains 3 bridge wardens every 34 seconds before house bonuses"};
UNIT_DEFS.bear_mauler={"label":"Bear Maulers","class":"infantry","house":"bear","cost":270,"batch":3,"hp":248,"damage":30,"range":0.84,"speed":1.18,"rate":1.35,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.bear_lodge={"label":"Bear Lodge","house":"bear","cost":390,"hp":1000,"interval":40,"batch":2,"unit":"bear_mauler","radius":0.58,"role":"Trains 2 bear maulers every 40 seconds before house bonuses"};
UNIT_DEFS.river_ranger={"label":"River Rangers","class":"archer","house":"fish","cost":235,"batch":4,"hp":128,"damage":21,"range":4.4,"speed":1.672,"rate":1.5,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.riverside_lodge={"label":"Riverside Lodge","house":"fish","cost":370,"hp":1000,"interval":35,"batch":3,"unit":"river_ranger","radius":0.58,"role":"Trains 3 river rangers every 35 seconds before house bonuses"};
UNIT_DEFS.crannog_hunter={"label":"Crannog Hunters","class":"archer","house":"frog","cost":210,"batch":5,"hp":106,"damage":18,"range":3.9,"speed":1.75,"rate":1.3,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.marsh_hideout={"label":"Marsh Hideout","house":"frog","cost":330,"hp":1000,"interval":32,"batch":3,"unit":"crannog_hunter","radius":0.58,"role":"Trains 3 crannog hunters every 32 seconds before house bonuses"};
UNIT_DEFS.beacon_engineer={"label":"Beacon Engineers","class":"siege","house":"beacon","cost":310,"batch":2,"hp":245,"damage":74,"range":5.7,"speed":1.03,"rate":3.7,"radius":0.23,"role":"House elite bombardment · destroys buildings"};
BUILD_DEFS.engineers_college={"label":"Engineers College","house":"beacon","cost":460,"hp":1000,"interval":50,"batch":1,"unit":"beacon_engineer","radius":0.58,"role":"Trains 1 beacon engineers every 50 seconds before house bonuses"};
UNIT_DEFS.hill_huntsman={"label":"Hill Huntsmen","class":"archer","house":"huntsman","cost":250,"batch":4,"hp":132,"damage":27,"range":4.7,"speed":1.48,"rate":1.7,"radius":0.15,"role":"House elite ranged troops · counters infantry"};
BUILD_DEFS.huntsman_lodge={"label":"Huntsman Lodge","house":"huntsman","cost":390,"hp":1000,"interval":38,"batch":3,"unit":"hill_huntsman","radius":0.58,"role":"Trains 3 hill huntsmen every 38 seconds before house bonuses"};
UNIT_DEFS.freefolk_berserker={"label":"Free Folk Berserkers","class":"infantry","house":"bone","cost":200,"batch":6,"hp":194,"damage":23,"range":0.78,"speed":1.738,"rate":1,"radius":0.15,"role":"House elite frontline · counters cavalry"};
BUILD_DEFS.warband_camp={"label":"Warband Camp","house":"bone","cost":300,"hp":1000,"interval":32,"batch":4,"unit":"freefolk_berserker","radius":0.58,"role":"Trains 4 free folk berserkers every 32 seconds before house bonuses"};

const SPECIALIST_IMPACTS={
 wolf:['Winter Bulwark','While holding, protects other allies within 1.6 tiles from 20% of melee and charge damage. Guard auras do not stack.'],
 lion:['Gilded Bolts','Crossbow hits deal 35% more damage to troops whose house has armor upgrades.'],
 dragon:['Dragonfire Pots','Impacts leave a larger 1.2-tile fire zone for 4 seconds, dealing 8 weapon-scaled damage per second. Overlapping fire never stacks.'],
 stag:['Storm Shock','A genuine charge impact shocks surviving enemies for 0.65 seconds, briefly stopping attacks and nearly stopping movement.'],
 rose:['Thorn Breakthrough','Charges hit 20% harder, throw unbraced troops 30% farther and retain more momentum through multiple ranks. Held infantry takes 25% extra impact damage. Living, braced spears still stop a frontal charge.'],
 sun:['Hamstring Javelins','Javelin hits slow surviving enemy troops by 25% for 2 seconds. Repeated hits refresh the duration without stacking.'],
 kraken:['Pillage','Melee attacks deal 50% more building damage. Destroying an enemy building awards 15 gold once per building.'],
 falcon:['Falcon Overwatch','While holding, gains 1 tile of range and deals 30% more damage to cavalry.'],
 flayed:['Hooked Pike Brace','After facing and settling for 0.45 seconds, living Dread Pikes stop frontal cavalry charges, retaliate and snare riders for 0.9 seconds. Pike strikes deal 2.5× damage to cavalry. Flank, rear and moving pikes cannot brace.'],
 bridge:['Spearwall','After facing and settling for 0.45 seconds, living Bridge Wardens stop frontal cavalry charges and retaliate. Spear strikes deal 2.15× damage to cavalry. While holding, protect nearby allies from 15% of direct hit damage; only the strongest guard aura applies. Flank their spears.'],
 bear:['Mauling Sweep','Every third melee swing cleaves up to 2 nearby enemies for 40% damage and knocks them aside.'],
 fish:['River Mending','Every 4 seconds, heals the most wounded ally within 3 tiles for 6% of maximum health. Each ally can receive this healing only once per 4 seconds.'],
 frog:['Crannog Toxins','Arrow hits poison troops for 3 seconds, dealing 5 weapon-scaled damage per second. Poison does not stack and weaker toxins cannot replace stronger ones.'],
 beacon:['Piercing Ballista','Bolts pierce up to 3 enemies in a narrow line, losing 30% damage per target. Buildings take triple damage.'],
 huntsman:['Hunter’s Finish','Arrow hits deal 40% more damage to enemy troops below 35% health.'],
 bone:['Blood Fury','Below 40% health, gains 30% melee damage and 15% movement speed. A melee kill sustains this fury for 4 seconds without stacking.']
};
for(const h of HOUSES){const c=HOUSE_CONTENT[h.sigil],[impactName,impact]=SPECIALIST_IMPACTS[h.sigil];Object.assign(c,{impactName,impact});Object.assign(UNIT_DEFS[c.unit],{impactName,impact,role:UNIT_DEFS[c.unit].role.split(' · ')[0]+' · '+impactName});h.specialistImpact=impactName+': '+impact;}
for(const type of ['dread_pike','bridge_warden']){UNIT_DEFS[type].spearBrace=true;UNIT_DEFS[type].role=type==='dread_pike'?'House pikemen · fixed frontal charge counter':'House spearmen · fixed frontal charge counter';}
registerRegiments(UNIT_DEFS,BUILD_DEFS);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ds=(a,b)=> (a.x-b.x)**2+(a.y-b.y)**2;
const result=(ok,message)=>({ok,message});
const MAP_SIZES={standard:{width:112,height:96,name:'Standard'},epic:{width:160,height:128,name:'Epic'},continent:{width:224,height:176,name:'Continent'}};
const GAME_MODES={
  conquest:{id:'conquest',label:'Castle Conquest',teams:false,objectiveGoal:0},
  bannerfall:{id:'bannerfall',label:'Bannerfall',teams:false,objectiveGoal:5},
  dominion:{id:'dominion',label:'Dominion',teams:false,objectiveGoal:0},
  'team-conquest':{id:'team-conquest',label:'Team Castle Conquest',teams:true,objectiveGoal:0},
  'team-bannerfall':{id:'team-bannerfall',label:'Team Bannerfall',teams:true,objectiveGoal:5},
  'team-dominion':{id:'team-dominion',label:'Team Dominion',teams:true,objectiveGoal:0},
  'defend-king':{id:'defend-king',label:'Defend the King',teams:false,objectiveGoal:0,kingSurvival:true,fixedArmies:4,flagWaves:true,flagRequired:12,flagReinforcements:12,flagInterval:45},
  'crown-control':{id:'crown-control',label:'Crown Control',teams:false,objectiveGoal:0,controlGoal:120,flagPriority:true},
  'blitz-flags':{id:'blitz-flags',label:'Blitz Flags',teams:false,objectiveGoal:3,flagRequired:10,flagCooldown:12,flagPriority:true}
};
const HALL_LEVELS=[null,{label:'Town Hall',hp:2500,damage:24,range:5.5,radius:.8,cost:0},{label:'Fortified Keep',hp:4500,damage:36,range:6.2,radius:1.05,cost:500},{label:'Royal Citadel',hp:7500,damage:52,range:7,radius:1.3,cost:950}];
const TOWER_LEVELS=[null,{label:'Watchtower',hp:1150,damage:25,range:4.6,radius:.38,cost:0},{label:'Guard Tower',hp:2000,damage:38,range:5.2,radius:.48,cost:250},{label:'Royal Bastion',hp:3200,damage:55,range:5.9,radius:.58,cost:450}];
const ALLIANCE_COLORS=['#69c5ff','#ff7d7b','#95df87','#e1a0ff','#ffd172','#64ded0','#ffa4c6','#c6cce0'];
function terrainNoise(x,y,seed){
  const sample=(xx,yy)=>{let n=Math.imul(xx,374761393)^Math.imul(yy,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const top=sample(ix,iy)*(1-sx)+sample(ix+1,iy)*sx,bottom=sample(ix,iy+1)*(1-sx)+sample(ix+1,iy+1)*sx;
  return top*(1-sy)+bottom*sy;
}
// Difficulty changes strategic pressure; economy, health and damage stay shared.
const AI_DIFFICULTIES={
  relaxed:{decision:4.6,opening:12,firstAssault:65,assaultEvery:40,force:.48,minArmy:72,squad:10,danger:1.15,frontiers:50},
  standard:{decision:2.5,opening:7,firstAssault:38,assaultEvery:24,force:.62,minArmy:60,squad:12,danger:.7,frontiers:80},
  veteran:{decision:1.4,opening:4.5,firstAssault:30,assaultEvery:20,force:.7,minArmy:52,squad:14,danger:.5,frontiers:100},
  warlord:{decision:.9,opening:2.5,firstAssault:22,assaultEvery:15,force:.78,minArmy:48,squad:16,danger:.4,frontiers:120}
};

class SpatialHash {
  constructor(w,h){this.size=1.25;this.w=Math.ceil(w/this.size)+2;this.h=Math.ceil(h/this.size)+2;this.buckets=Array.from({length:this.w*this.h},()=>[]);}
  rebuild(units){for(const b of this.buckets)b.length=0;for(const u of units)if(u.hp>0){const x=clamp(Math.floor(u.x/this.size),0,this.w-1),y=clamp(Math.floor(u.y/this.size),0,this.h-1);this.buckets[y*this.w+x].push(u);}}
  visit(x,y,r,fn){const x0=clamp(Math.floor((x-r)/this.size),0,this.w-1),x1=clamp(Math.floor((x+r)/this.size),0,this.w-1),y0=clamp(Math.floor((y-r)/this.size),0,this.h-1),y1=clamp(Math.floor((y+r)/this.size),0,this.h-1);for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){const b=this.buckets[yy*this.w+xx];for(let i=0;i<b.length;i++)fn(b[i]);}}
}

export class Game {
  constructor(config={}){
    this.config={house:0,enemies:3,difficulty:'standard',scale:'epic',seed:44277,mode:'conquest',landscape:'crownlands',fogOfWar:false,...config};
    if(!GAME_MODES[this.config.mode])this.config.mode='conquest';
    this.mode={...GAME_MODES[this.config.mode]};this.teamOrders=[];this.nextTeamOrder=1;this.objectives=[];this.objectiveScores=[];this.castles=[];this.victoryReason='';
    if(!AI_DIFFICULTIES[this.config.difficulty])this.config.difficulty='standard';
    this.aiRules=AI_DIFFICULTIES[this.config.difficulty];
    this.config.enemies=clamp(Math.floor(+this.config.enemies||3),1,15);
    if(this.mode.fixedArmies)this.config.enemies=this.mode.fixedArmies-1;
    if(this.mode.teams)this.config.enemies=clamp(this.config.enemies%2?this.config.enemies:this.config.enemies+1,3,15);
    if(!MAP_SIZES[this.config.scale])this.config.scale='epic';
    const map=MAP_SIZES[this.config.scale];this.W=map.width;this.H=map.height;this.mapName=map.name;
    this.seed=(Number(this.config.seed)||44277)>>>0;this.time=0;this.paused=false;this.winner=null;this.units=[];this.buildings=[];this.projectiles=[];this.effects=[];this.events=[];this.tiles=[];this.teams=[];this.nextId=1;this.eventId=0;this.captureClock=0;this.economyClock=0;this.cleanClock=0;this.byId=new Map();this.stats={battles:0,captured:0,dead:0,chargeImpacts:0};
    this.aftermath=new BattleAftermath();this.controlScores=[];this.nextFlagWaveAt=this.mode.flagWaves?15:null;this.flagWave=0;this.nextFlagId=1000000;
    this.hash=new SpatialHash(this.W,this.H);this.capturePower=new Float32Array(this.W*this.H*(this.config.enemies+1));this.captureTouched=[];this.playable=0;
    const terrainSeed=this.seed;
    for(let y=0;y<this.H;y++)for(let x=0;x<this.W;x++){
      const border=x===0||y===0||x===this.W-1||y===this.H-1;
      // Smooth fields create actual forests and rocky uplands, rather than confetti.
      const forest=terrainNoise(x/8,y/8,terrainSeed)*.78+terrainNoise(x/3,y/3,terrainSeed^0x6d2b79f5)*.22;
      const upland=terrainNoise(x/12,y/12,terrainSeed^0x3c6ef372)*.8+terrainNoise(x/4,y/4,terrainSeed^0x1b873593)*.2;
      const terrain=border?'water':forest>.6?'forest':upland>.65?'hill':'grass';
      this.tiles.push({x,y,terrain,owner:-1,claim:-1,capture:0,value:terrain==='hill'?2:1,variation:this.random(),height:terrain==='hill'?.12:0});if(!border)this.playable++;
    }
    const n=this.config.enemies+1,house=clamp(+this.config.house||0,0,HOUSES.length-1),houseIds=[house,...HOUSES.map((_,i)=>i).filter(i=>i!==house)];
    // Twenty widely spaced reservations support sixteen factions without
    // crowding starting armies, even on the smallest battlefield.
    const xs=Array.from({length:5},(_,i)=>Math.round(8+(this.W-16)*i/4)+.5),ys=Array.from({length:4},(_,i)=>Math.round(8+(this.H-16)*i/3)+.5),candidates=[];
    for(const y of ys)for(const x of xs)candidates.push({x,y});
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    const homes=this.mode.kingSurvival?[{x:xs[0],y:ys[0]},{x:xs[4],y:ys[3]},{x:xs[4],y:ys[0]},{x:xs[0],y:ys[3]}]:[candidates.shift()];
    while(homes.length<n){let best=0,bestGap=-1;for(let i=0;i<candidates.length;i++){const gap=Math.min(...homes.map(p=>ds(p,candidates[i])));if(gap>bestGap){best=i;bestGap=gap;}}homes.push(candidates.splice(best,1)[0]);}
    let minCapitalDistance=Infinity;for(let i=0;i<homes.length;i++)for(let j=i+1;j<homes.length;j++)minCapitalDistance=Math.min(minCapitalDistance,Math.sqrt(ds(homes[i],homes[j])));
    // Pair nearby starting reservations so allies share a defensible front.
    if(this.mode.teams)for(let i=0;i+1<homes.length;i+=2){let nearest=i+1;for(let j=i+2;j<homes.length;j++)if(ds(homes[i],homes[j])<ds(homes[i],homes[nearest]))nearest=j;[homes[i+1],homes[nearest]]=[homes[nearest],homes[i+1]];}
    generateLands(this,homes);
    this.navigation=new LandsNavigation(this);this.combatTerrain=new CombatTerrain(this);
    this.spawnSafety={minCapitalDistance,armyRadius:6,minimumArmyGap:minCapitalDistance-12};
    for(let t=0;t<n;t++){
      const home=homes[t];
      const h=HOUSES[houseIds[t]],alliance=this.mode.teams?Math.floor(t/2):t,teamColor=ALLIANCE_COLORS[alliance%ALLIANCE_COLORS.length],team={id:t,...h,houseColor:h.color,alliance,teamColor:this.mode.teams?teamColor:h.color,teamName:this.mode.teams?`Alliance ${alliance+1}`:h.name,house:houseIds[t],gold:700,income:0,count:0,cap:280,tiles:0,alive:true,kills:0,upgrades:{weapons:0,armor:0,economy:0},home,rally:t===0?null:{...home},aiClock:this.aiRules.opening+t*.28,heroTimer:0,assault:0,lastThreat:0};
      if(this.mode.teams){team.color=t%2?this.tintColor(teamColor,.24):teamColor;team.dark=this.tintColor(teamColor,-.65);}
      this.teams.push(team);this.objectiveScores[alliance]=0;
      // Every opening army has a clear, equally valued mustering field.
      for(let yy=Math.floor(home.y)-7;yy<=Math.floor(home.y)+7;yy++)for(let xx=Math.floor(home.x)-7;xx<=Math.floor(home.x)+7;xx++){
        const tile=this.tileAt(xx+.5,yy+.5);if(isPassableTile(tile)&&ds({x:xx+.5,y:yy+.5},home)<6.75**2){tile.terrain='grass';tile.feature=null;tile.height=0;tile.value=1;}
      }
      for(let yy=Math.floor(home.y)-3;yy<=Math.floor(home.y)+3;yy++)for(let xx=Math.floor(home.x)-3;xx<=Math.floor(home.x)+3;xx++){const tile=this.tileAt(xx+.5,yy+.5);if(isPassableTile(tile)){tile.owner=t;tile.value=1;}}
      this.addBuilding(t,'keep',home.x,home.y);
      this.addBuilding(t,'barracks',home.x+1.65,home.y+.2);
      this.addBuilding(t,'range',home.x-.2,home.y+1.65);
    }
    // All buildings exist before any soldiers are placed, so a later house can
    // never put a new structure underneath a previously mustered army.
    for(let t=0;t<n;t++){
      const home=homes[t];
      const composition=['hero',...Array(40).fill('infantry'),...Array(8).fill('cavalry'),...Array(20).fill('archer'),this.teams[t].sigil==='sun'?'sun_horse_archer':'siege'];
      const heading=Math.atan2(this.H/2-home.y,this.W/2-home.x),fx=Math.cos(heading),fy=Math.sin(heading),sideX=-fy,sideY=fx;
      const slots=[];
      // A broad, center-facing mustering field keeps troops outside the capital.
      // Every point stays inside a six-cell reservation; adjacent enemy
      // reservations have at least twelve completely empty cells between them.
      const accept=slot=>{
        if(slot.x<1.4||slot.y<1.4||slot.x>this.W-1.4||slot.y>this.H-1.4||ds(slot,home)>36||!this.isWalkable(slot.x,slot.y))return;
        if(this.buildings.some(b=>ds(b,slot)<(this.buildingRadius(b)+.46)**2))return;
        if(this.units.some(u=>ds(u,slot)<(u.team===t?.5:12)**2))return;
        if(slots.some(p=>ds(p,slot)<.48**2))return;slots.push(slot);
      };
      for(let row=0;row<22;row++)for(let col=0;col<24;col++){
        const lateral=(Math.floor(col/2)+.5)*.5*(col%2===0?1:-1),forward=5.2-row*.5;
        accept({x:home.x+fx*forward+sideX*lateral,y:home.y+fy*forward+sideY*lateral});
      }
      // Deterministic fallback makes malformed or future placement changes safe.
      if(slots.length<composition.length)for(let yy=-11;yy<=11;yy++)for(let xx=-11;xx<=11;xx++)accept({x:home.x+xx*.5,y:home.y+yy*.5});
      if(slots.length<composition.length)throw new Error('The map could not reserve a safe opening army field.');
      for(let i=0;i<composition.length;i++){
        const slot=slots[i],u=this.addUnit(t,composition[i],slot.x,slot.y);this.idle([u.id]);
        if(this.mode.kingSurvival&&u.type==='hero'){u.isKing=true;u.maxHp*=1.5;u.hp=u.maxHp;this.teams[t].kingId=u.id;this.hold([u.id]);}
      }
    }
    this.fireZones=[];this.stats.housePowerUses=0;this.stats.siegeImpacts=0;
    for(const team of this.teams){team.powerReadyAt=0;team.buffs={};}
    this.controlScores=Array(this.objectiveScores.length).fill(0);
    this.navigation.invalidate();this.createObjectives();this.createCastleRuins();this.recount();this.hash.rebuild(this.units);this.vision=new WarVision(this);this.vision.update(true);this.event(`${this.landscape.label}: ${this.mode.label}. `+(this.mode.kingSurvival?'Protect your king. Central flags bring reinforcements; the first wave arrives in 15 seconds.':'Start with 280 troop capacity. Hold castle ruins for 60 seconds; each additional castle adds 60.'),0);
  }

  tintColor(hex,amount){const n=parseInt(hex.slice(1),16),mix=v=>Math.round(amount>=0?v+(255-v)*amount:v*(1+amount));return '#'+[n>>16,(n>>8)&255,n&255].map(v=>mix(v).toString(16).padStart(2,'0')).join('');}
  allied(a,b){return a>=0&&b>=0&&!!this.teams[a]&&!!this.teams[b]&&this.teams[a].alliance===this.teams[b].alliance;}
  hostile(a,b){return a>=0&&b>=0&&!!this.teams[a]&&!!this.teams[b]&&!this.allied(a,b);}
  isVisibleTo(team,point){return !this.config.fogOfWar||this.allied(team,point?.team)||!!point&&!!this.vision?.isVisible(team,point.x,point.y);}
  knownUnits(team){return this.config.fogOfWar&&this.vision?this.vision.knownUnits(team):this.units.filter(u=>u.hp>0);}
  knownBuildings(team){return this.config.fogOfWar&&this.vision?this.vision.knownBuildings(team):this.buildings.filter(b=>b.hp>0);}
  knownCastleSites(team){return this.config.fogOfWar&&this.vision?this.vision.knownCastleSites(team):this.castles;}
  buildingRadius(b){return b?.radius||BUILD_DEFS[b?.type]?.radius||.5;}
  townHallDetails(team=0){
    const hall=this.buildings.find(b=>b.team===team&&b.type==='keep'&&b.hp>0),level=hall?.level||1,d=HALL_LEVELS[level],next=HALL_LEVELS[level+1];
    return {level,max:3,label:d.label,hp:hall?.hp||0,maxHp:hall?.maxHp||d.hp,damage:d.damage,range:d.range,radius:d.radius,cost:next?.cost||0,nextLevel:next?level+1:null,nextHp:next?.hp||d.hp,maxed:!next,alive:!!hall&&this.teams[team]?.alive};
  }
  upgradeTownHall(team=0){
    const s=this.teams[team],d=this.townHallDetails(team);if(!d.alive)return result(false,'Your town hall has fallen.');if(d.maxed)return result(false,'Your Royal Citadel is already level 3.');if(s.gold<d.cost)return result(false,`You need ${d.cost} gold.`);
    const hall=this.buildings.find(b=>b.team===team&&b.type==='keep'&&b.hp>0),next=HALL_LEVELS[d.nextLevel],fraction=hall.hp/hall.maxHp;s.gold-=d.cost;hall.level=d.nextLevel;hall.maxHp=next.hp;hall.hp=next.hp*fraction;hall.radius=next.radius;
    this.event(`${s.name} upgraded to a level ${hall.level} ${next.label}.`,team);return result(true,`${next.label} complete: level ${hall.level}, ${next.hp.toLocaleString()} maximum health.`);
  }
  towerDetails(id,team=0){
    const entity=this.byId.get(id),tower=entity?.type==='tower'?entity:null,level=clamp(tower?.level||1,1,3),d=TOWER_LEVELS[level],next=TOWER_LEVELS[level+1];
    return {id:tower?.id??id,level,max:3,label:d.label,hp:tower?.hp||0,maxHp:tower?.maxHp||d.hp,radius:d.radius,damage:d.damage,range:d.range,cost:next?.cost||0,nextLevel:next?level+1:null,nextHp:next?.hp||d.hp,maxed:!next,alive:!!tower&&tower.team===team&&tower.hp>0&&!!this.teams[team]?.alive};
  }
  upgradeTower(id,team=0){
    const details=this.towerDetails(id,team),s=this.teams[team];if(!details.alive)return result(false,'Select one of your living watchtowers.');if(details.maxed)return result(false,'This Royal Bastion is already level 3.');if(s.gold<details.cost)return result(false,`You need ${details.cost} gold.`);
    const tower=this.byId.get(id),next=TOWER_LEVELS[details.nextLevel],fraction=clamp(tower.hp/tower.maxHp,0,1);s.gold-=details.cost;tower.level=details.nextLevel;tower.maxHp=next.hp;tower.hp=next.hp*fraction;tower.radius=next.radius;
    this.event(`${s.name} upgraded a tower to a level ${tower.level} ${next.label}.`,team);return result(true,`${next.label} complete: level ${tower.level}, ${next.hp.toLocaleString()} maximum health.`);
  }
  callTeamOrder(kind,x,y,team=0){
    const s=this.teams[team],tile=this.tileAt(x,y);if(!s?.alive||!this.mode.teams)return result(false,'Coordinated orders require a living house in a team campaign.');if(!['assault','defend'].includes(kind)||!Number.isFinite(x)||!Number.isFinite(y)||!isPassableTile(tile))return result(false,'Choose open ground, a bridge or a mountain pass for your allies.');
    if(!this.teams.some(t=>t.id!==team&&t.alive&&this.allied(team,t.id)))return result(false,'No allied houses remain to answer your call.');
    const existing=this.teamOrders.find(o=>o.alliance===s.alliance&&o.expiresAt>this.time&&o.kind===kind);
    // Bot calls cannot move the player's live coordination marker.
    if(existing&&existing.issuer===0&&team!==0)return result(false,'Your alliance is following its commander’s order.');
    this.teamOrders=this.teamOrders.filter(o=>!(o.alliance===s.alliance&&o.kind===kind));
    const order={id:this.nextTeamOrder++,alliance:s.alliance,kind,x,y,issuer:team,createdAt:this.time,launchAt:this.time+(kind==='assault'?8:0),expiresAt:this.time+(kind==='assault'?100:45)};
    this.teamOrders.push(order);for(const ally of this.teams)if(ally.id!==0&&ally.alive&&this.allied(team,ally.id))ally.aiClock=0;
    this.event(`${s.teamName}: ${kind==='assault'?'joint assault gathers for 8 seconds':'allied defense requested'}.`,team);return result(true,kind==='assault'?'Allied bots are gathering. Joint assault launches in 8 seconds.':'Allied bots are responding to defend this position.');
  }
  createObjectives(){
    if(this.mode.flagWaves)return;
    const count=this.objectiveScores.length,spots=this.mode.controlGoal?[[.5,.5]]:[[.5,.5],[.34,.34],[.66,.66]],names=['Crown Standard','Western Standard','Eastern Standard'];
    for(let i=0;i<spots.length;i++){
      const anchor={x:Math.floor(this.W*spots[i][0])+.5,y:Math.floor(this.H*spots[i][1])+.5};let p=null,best=Infinity;
      // Validate the final location: snapping away from water must never move a flag into a starting army.
      for(const tile of this.tiles){
        if(!isPassableTile(tile))continue;const candidate={x:tile.x+.5,y:tile.y+.5},score=ds(candidate,anchor);
        if(score>=best||this.teams.some(s=>ds(s.home,candidate)<121)||this.objectives.some(o=>ds(o,candidate)<100))continue;
        let room=0;for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<=9&&this.isWalkable(candidate.x+x,candidate.y+y))room++;
        if(room<21)continue;p=candidate;best=score;
      }
      p=p||this.navigation.nearestPassable(anchor);
      this.objectives.push({id:i,name:names[i],...p,radius:this.mode.controlGoal?5:4,required:this.mode.controlGoal||this.mode.flagRequired||30,progress:Array(count).fill(0),controller:null,contested:false,cooldownUntil:0,captures:0});
    }
  }
  kingFor(team){const king=this.byId.get(this.teams[team]?.kingId);return king?.hp>0&&king.isKing?king:null;}
  spawnRoyalFlags(){
    this.objectives=[];this.flagWave++;const radius=Math.min(this.W,this.H)*.1;
    for(let i=0;i<3;i++){
      const angle=i*Math.PI*2/3+this.flagWave*Math.PI/6,anchor={x:this.W/2+Math.cos(angle)*radius,y:this.H/2+Math.sin(angle)*radius};let point=null,best=Infinity;
      for(const tile of this.tiles){if(!isPassableTile(tile))continue;const p={x:tile.x+.5,y:tile.y+.5},score=ds(p,anchor);if(score>=best||Math.abs(p.x-this.W/2)>this.W*.22||Math.abs(p.y-this.H/2)>this.H*.22||this.teams.some(s=>ds(s.home,p)<14**2)||this.objectives.some(o=>ds(o,p)<8**2)||this.buildings.some(b=>b.hp>0&&ds(b,p)<5**2))continue;
        let room=0;for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<=9&&this.isWalkable(p.x+x,p.y+y))room++;if(room<21)continue;point=p;best=score;
      }
      if(!point)continue;
      this.objectives.push({id:this.nextFlagId++,name:`Crown Reinforcement ${i+1}`,...point,radius:4,required:this.mode.flagRequired,progress:Array(this.objectiveScores.length).fill(0),controller:null,contested:false,cooldownUntil:0,captures:0,expiresAt:this.time+this.mode.flagInterval,wave:this.flagWave});
    }
    this.nextFlagWaveAt=this.time+this.mode.flagInterval;this.event(`Central flag wave ${this.flagWave}: capture a standard for ${this.mode.flagReinforcements} reinforcements at your king.`,0);
  }
  updateObjectives(dt){
    if(this.mode.flagWaves){if(this.time>=this.nextFlagWaveAt)this.spawnRoyalFlags();this.objectives=this.objectives.filter(flag=>flag.expiresAt>this.time&&!flag.consumed);}
    for(const flag of this.objectives){
      if(this.time<flag.cooldownUntil){flag.controller=null;flag.contested=false;continue;}
      const counts=Array(this.objectiveScores.length).fill(0);let total=0;
      this.hash.visit(flag.x,flag.y,flag.radius,u=>{if(u.hp>0&&this.teams[u.team].alive&&ds(u,flag)<=flag.radius**2){counts[this.teams[u.team].alliance]++;total++;}});
      const dominant=total?counts.findIndex(n=>n>0&&n/total>=.9):-1;flag.controller=dominant<0?null:dominant;flag.contested=total>0&&dominant<0;
      if(dominant<0)continue;
      if(this.mode.controlGoal){this.controlScores[dominant]=Math.min(this.mode.controlGoal,this.controlScores[dominant]+dt);flag.progress[dominant]=this.controlScores[dominant];if(this.controlScores[dominant]>=this.mode.controlGoal-1e-7){this.winner=this.teams.find(s=>s.alive&&s.alliance===dominant).id;this.victoryReason=`Held the Crown Standard for ${this.mode.controlGoal} seconds`;this.event(`${this.teams[this.winner].name} controls the crown.`,this.winner);return;}continue;}
      flag.progress[dominant]=Math.min(flag.required,flag.progress[dominant]+dt);
      if(flag.progress[dominant]>=flag.required-1e-7){this.awardObjective(flag,dominant);if(this.winner!==null)return;}
    }
    if(this.mode.flagWaves)this.objectives=this.objectives.filter(flag=>!flag.consumed);
  }
  awardObjective(flag,alliance){
    const members=this.teams.filter(s=>s.alive&&s.alliance===alliance);if(!members.length)return;
    if(this.mode.kingSurvival){
      const team=members[0],king=this.kingFor(team.id);if(!king||flag.consumed)return;flag.consumed=true;this.objectiveScores[alliance]++;const types=['infantry','infantry','archer','cavalry'];
      for(let i=0;i<this.mode.flagReinforcements;i++){const angle=i*2.399963,goal=this.navigation.nearestPassable(this.bound({x:king.x+Math.cos(angle)*(1+i%3*.35),y:king.y+Math.sin(angle)*(1+i%3*.35)}));if(!goal)continue;const u=this.addUnit(team.id,types[i%types.length],goal.x,goal.y);u.royalReinforcement=true;this.idle([u.id]);}
      this.event(`${team.name} secured ${flag.name}: ${this.mode.flagReinforcements} reinforcements join its king!`,team.id);return;
    }
    this.objectiveScores[alliance]++;flag.captures++;flag.progress[alliance]=0;flag.cooldownUntil=this.time+(this.mode.flagCooldown||20);flag.controller=null;flag.contested=false;
    for(let i=0;i<8;i++){const s=members[i%members.length],hall=this.buildings.find(b=>b.team===s.id&&b.type==='keep'&&b.hp>0);if(!hall)continue;const a=i*2.399963,u=this.addUnit(s.id,this.houseContent(s.id).unit,hall.x+Math.cos(a)*(this.buildingRadius(hall)+.65),hall.y+Math.sin(a)*(this.buildingRadius(hall)+.65));u.elite=true;u.maxHp*=1.5;u.hp=u.maxHp;this.idle([u.id]);}
    this.event(`${members[0].teamName} secured ${flag.name}: 8 Royal Guard reinforcements!`,members[0].id);
    if(this.mode.objectiveGoal&&this.objectiveScores[alliance]>=this.mode.objectiveGoal){this.winner=members.find(s=>s.id===0)?.id??members[0].id;this.victoryReason=`Secured ${this.mode.objectiveGoal} standards`;}
  }
  createCastleSite(point,team=-1,buildingId=null){
    const site={id:this.nextId++,name:team>=0?this.teams[team].castleName:`Ruined Castle ${this.castles.filter(c=>c.ruined).length+1}`,x:point.x,y:point.y,radius:4,required:60,progress:Array(this.objectiveScores.length).fill(0),controller:null,contested:false,team,buildingId,ruined:team<0,captures:0};
    this.castles.push(site);return site;
  }
  createCastleRuins(){
    for(const site of this.castles)site.progress=Array(this.objectiveScores.length).fill(0);
    if(this.mode.kingSurvival)return;
    const count={standard:3,epic:5,continent:6}[this.config.scale]||3;
    for(let i=0;i<count;i++){
      let best=null,bestScore=-Infinity;
      for(const tile of this.tiles){
        if(!isPassableTile(tile)||tile.x<8||tile.y<8||tile.x>this.W-9||tile.y>this.H-9)continue;
        const p={x:tile.x+.5,y:tile.y+.5},homeGap=Math.min(...this.teams.map(s=>ds(s.home,p))),castleGap=Math.min(...this.castles.filter(c=>c.ruined).map(c=>ds(c,p)),Infinity);
        if(homeGap<14**2||castleGap<18**2||this.objectives.some(o=>ds(o,p)<9**2)||this.buildings.some(b=>ds(b,p)<6**2))continue;
        let room=0;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)if(this.isWalkable(p.x+x,p.y+y))room++;
        if(room<21||!this.navigation.isClearPoint(p.x,p.y,BUILD_DEFS.keep.radius))continue;
        const score=Math.min(homeGap,castleGap*.8)-ds(p,{x:this.W/2,y:this.H/2})*.08+tile.variation*.01;
        if(score>bestScore){best=p;bestScore=score;}
      }
      if(best)this.createCastleSite(best);
    }
  }
  updateCastles(dt){
    for(const site of this.castles){
      if(!site.ruined)continue;
      const counts=Array(this.objectiveScores.length).fill(0),houses=Array(this.teams.length).fill(0);let total=0;
      this.hash.visit(site.x,site.y,site.radius,u=>{if(u.hp>0&&this.teams[u.team].alive&&ds(u,site)<=site.radius**2){counts[this.teams[u.team].alliance]++;houses[u.team]++;total++;}});
      const dominant=total?counts.findIndex(n=>n>0&&n/total>=.9):-1;site.controller=dominant<0?null:dominant;site.contested=total>0&&dominant<0;
      if(dominant<0)continue;
      site.progress[dominant]=Math.min(site.required,(site.progress[dominant]||0)+dt);
      if(site.progress[dominant]>=site.required-1e-7){
        const owner=this.teams.filter(s=>s.alive&&s.alliance===dominant&&houses[s.id]>0).sort((a,b)=>houses[b.id]-houses[a.id]||a.id-b.id)[0];
        if(owner)this.captureCastle(site,owner.id);
      }
    }
  }
  captureCastle(site,team){
    if(!site?.ruined||!this.teams[team]?.alive)return false;
    const keep=this.addBuilding(team,'keep',site.x,site.y);keep.restoredCastle=true;
    site.captures++;site.progress.fill(0);site.controller=null;site.contested=false;
    for(const tile of this.tiles){if(!isPassableTile(tile)||ds({x:tile.x+.5,y:tile.y+.5},site)>8**2||this.allied(tile.owner,team)&&tile.owner!==team)continue;tile.owner=team;tile.claim=-1;tile.capture=0;}
    this.recount();this.event(`${this.teams[team].name} restored ${site.name}: ${this.teams[team].keeps>1?'+60 troop capacity and ':''}the surrounding realm claimed.`,team);
    this.effects.push({x:site.x,y:site.y,type:'capture',life:1.6,maxLife:1.6,team});return true;
  }
  ruinCastle(keep){
    const site=this.castles.find(c=>c.id===keep.castleId)||this.createCastleSite(keep,keep.team,keep.id);
    site.team=-1;site.buildingId=null;site.ruined=true;site.progress.fill(0);site.controller=null;site.contested=false;
    const s=this.teams[keep.team],remaining=this.buildings.filter(b=>b.team===keep.team&&b.type==='keep'&&b.hp>0);
    if(remaining.length){
      if(ds(s.home,keep)<1){const home=[...remaining].sort((a,b)=>b.hp-a.hp||a.id-b.id)[0];s.home={x:home.x,y:home.y};if(s.rally&&ds(s.rally,keep)<4)s.rally={...s.home};}
      this.recount();this.event(`${s.name} still holds ${remaining.length} castle${remaining.length===1?'':'s'}. ${site.name} is now a recapturable ruin.`,s.id);
    }else if(this.mode.kingSurvival&&this.kingFor(keep.team)){this.recount();this.event(`${s.name}'s castle fell, but its king still commands the army.`,s.id);}
    else this.eliminate(keep.team);
  }
  eliminate(team,reason='castle'){
    const s=this.teams[team];if(!s?.alive)return;s.alive=false;s.count=0;s.tiles=0;s.value=0;s.banners=0;s.keeps=0;s.income=0;s.heroTimer=0;s.rally=null;
    for(const u of this.units)if(u.team===team){u.hp=0;u.target=null;u.order=null;}
    for(const b of this.buildings)if(b.team===team)b.hp=0;
    // Keep persistent map sites consistent even when a scenario eliminates a
    // faction directly, rather than damaging each of its keeps first.
    for(const site of this.castles)if(site.team===team){site.team=-1;site.buildingId=null;site.ruined=true;site.progress.fill(0);site.controller=null;site.contested=false;}
    for(const tile of this.tiles){if(tile.owner===team)tile.owner=-1;if(tile.claim===team){tile.claim=-1;tile.capture=0;}}
    this.projectiles=this.projectiles.filter(p=>p.team!==team);this.fireZones=this.fireZones.filter(z=>z.team!==team);this.event(reason==='king'?`${s.name}'s king has fallen. Its army is eliminated.`:`${s.name}'s last castle has fallen. Its faction is wiped out.`,team);
    this.checkVictory();
  }

  houseContent(team=0){return HOUSE_CONTENT[this.teams[team]?.sigil]||null;}
  unitClass(value){const type=typeof value==='string'?value:value?.type;return UNIT_DEFS[type]?.class||type;}
  isRanged(value){const type=typeof value==='string'?value:value?.type;return this.unitClass(type)==='archer'||!!UNIT_DEFS[type]?.ranged;}
  nearCommander(point,team,radius){let nearby=false;this.hash.visit(point.x,point.y,radius,u=>{if(u.team===team&&this.unitClass(u)==='hero'&&u.hp>0&&ds(u,point)<radius*radius)nearby=true;});return nearby;}
  nearBuilding(point,team,radius,predicate){return this.buildings.some(b=>b.team===team&&b.hp>0&&predicate(b)&&ds(b,point)<radius*radius);}
  movementMultiplier(u){
    const s=this.teams[u.team],tile=this.tileAt(u.x,u.y),kind=this.unitClass(u),mode=u.order?.mode;
    switch(s.sigil){
      case 'wolf':return kind==='infantry'&&tile?.owner===u.team?1.12:1;
      case 'lion':return mode==='move'?1.12:1;
      case 'dragon':return this.nearCommander(u,u.team,4)?1.1:1;
      case 'stag':return kind==='cavalry'&&tile?.terrain!=='forest'?1.12:1;
      case 'rose':return tile?.owner===u.team?1.1:1;
      case 'sun':return tile?.terrain==='grass'?1.15:1;
      case 'kraken':return tile&&tile.owner>=0&&this.hostile(tile.owner,u.team)?1.15:1;
      case 'falcon':return tile?.terrain==='hill'?1.18:1;
      case 'flayed':return mode==='attack'&&u.hp>u.maxHp*.5?1.1:1;
      case 'bridge':return this.nearBuilding(u,u.team,4,b=>!!BUILD_DEFS[b.type].unit)?1.12:1;
      case 'bear':return this.nearCommander(u,u.team,3)?1.14:1;
      case 'fish':return this.nearBuilding(u,u.team,4,b=>b.type==='keep'||b.type==='tower')?1.12:1;
      case 'frog':return tile?.terrain==='forest'?1.2*(UNIT_DEFS[u.type].forestBonus||1):1;
      case 'beacon':return kind==='siege'?1.14:1;
      case 'huntsman':return ['infantry','archer'].includes(kind)&&u.order?.formation==='line'?1.12:1;
      case 'bone':return tile&&['forest','hill'].includes(tile.terrain)?1.15:1;
      default:return 1;
    }
  }
  trainingRate(b){
    const s=this.teams[b.team];let rate=(s.sigil==='rose'?1+Math.min(.2,s.banners*.02):s.sigil==='lion'?.9:1)*(BUILD_DEFS[b.type]?.trainingFactor||1);
    if(b.type==='workshop')rate*=s.sigil==='beacon'?1.25:s.sigil==='rose'?.75:s.sigil==='frog'?.8:1;
    if(b.type==='range'&&s.sigil==='huntsman')rate*=.85;
    if(b.type!==this.houseContent(b.team)?.building)return rate;
    if(s.sigil==='wolf'&&this.nearBuilding(b,b.team,6,p=>p.type==='keep'))rate*=1.15;
    if(s.sigil==='dragon'&&s.upgrades.weapons>=1)rate*=1.15;
    if(s.sigil==='falcon'&&this.buildings.filter(p=>p.team===b.team&&p.hp>0&&p.type==='tower').length>=2)rate*=1.15;
    if(s.sigil==='bear'&&this.nearCommander(b,b.team,4))rate*=1.2;
    if(s.sigil==='fish'&&this.nearBuilding(b,b.team,4,p=>p.type==='keep'||p.type==='tower'))rate*=1.15;
    if(s.sigil==='frog'&&this.tileAt(b.x,b.y)?.terrain==='forest')rate*=1.2;
    if(s.sigil==='huntsman'&&s.upgrades.weapons>=1&&s.upgrades.armor>=1)rate*=1.15;
    return rate;
  }

  random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  tileAt(x,y){const xx=Math.floor(x),yy=Math.floor(y);return xx<0||yy<0||xx>=this.W||yy>=this.H?null:this.tiles[yy*this.W+xx];}
  isWalkable(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&isPassableTile(this.tileAt(x,y));}
  buildingGround(type,x,y){const radius=(BUILD_DEFS[type]?.radius||.5)+.12;for(const [dx,dy]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,radius],[-radius,radius],[radius,-radius]]){const tile=this.tileAt(x+dx,y+dy);if(!isPassableTile(tile)||['bridge','ford','pass','road'].includes(tile.feature))return false;}return true;}
  bound(p){p.x=clamp(p.x,1.22,this.W-1.22);p.y=clamp(p.y,1.22,this.H-1.22);return p;}
  event(text,team=-1){this.events.push({id:++this.eventId,text,team,time:this.time});if(this.events.length>35)this.events.shift();}
  addUnit(team,type,x,y){
    const d=UNIT_DEFS[type],s=this.teams[team],armor=this.upgradeMultiplier('armor',s.upgrades.armor),angle=Math.atan2(this.H/2-y,this.W/2-x);const u={id:this.nextId++,team,type,x,y,radius:d.radius,hp:d.hp*armor,maxHp:d.hp*armor,vx:0,vy:0,facingX:Math.cos(angle),facingY:Math.sin(angle),backpedaling:false,attackAnim:0,phase:this.random()*6.28,cooldown:this.random()*d.rate,seek:this.random()*.2,target:null,order:null,charge:0,momentum:0,charging:false,chargeSpeed:0,chargeDir:{x:1,y:0},chargeRunup:0,chargeTravel:0,chargeCooldown:0,chargeElapsed:0,chargeHits:this.unitClass(type)==='cavalry'?new Map():null,knockT:0,knockVX:0,knockVY:0,alive:true,spawn:this.time,hit:0};this.bound(u);if(!this.isWalkable(u.x,u.y))Object.assign(u,this.navigation.nearestPassable(u));this.units.push(u);this.byId.set(u.id,u);s.count++;if(d.setupSeconds){u.setupProgress=0;u.setupX=u.x;u.setupY=u.y;}return u;
  }
  addBuilding(team,type,x,y){const d=BUILD_DEFS[type],rally=this.teams[team]?.rally,b={id:this.nextId++,team,type,x,y,hp:d.hp,maxHp:d.hp,level:type==='keep'||type==='tower'?1:undefined,radius:d.radius,spawnTimer:0,cooldown:this.random(),hit:0,progress:1,rally:rally?{...rally}:null};this.bound(b);this.buildings.push(b);this.byId.set(b.id,b);if(type==='keep'){const site=this.castles.find(c=>c.ruined&&ds(c,b)<.01)||this.createCastleSite(b,team,b.id);Object.assign(site,{team,buildingId:b.id,ruined:false});b.castleId=site.id;}return b;}
  group(team){return this.units.filter(u=>u.team===team&&u.hp>0);}
  idle(ids){
    for(const id of ids){const u=this.byId.get(id);if(!u||u.hp<=0||!UNIT_DEFS[u.type])continue;
      if(this.unitClass(u)==='cavalry')this.stopCharge(u);
      u.order={x:u.x,y:u.y,mode:'idle',formation:u.order?.formation||'line'};u.target=null;u.seek=0;u.aggroAnchor=null;u.braceDir=null;u.braceTime=0;u.championRegroup=null;u.championCyclePending=false;
    }
  }
  autonomousAggro(u){return !this.hasFacingOrder(u)&&['idle','patrol'].includes(u.order?.mode||'idle');}
  aggroRange(u){return Math.max(8,this.unitRange(u)+1.5);}
  canAggro(u,target,anchor=u.aggroAnchor||u.order||u){
    const leash=this.aggroRange(u)+2;
    if(target.hp<=0||!this.hostile(u.team,target.team)||!this.teams[target.team]?.alive||!this.isVisibleTo(u.team,target)||ds(anchor,target)>leash*leash)return false;
    const kind=this.unitClass(u),direct=this.isRanged(u)||u.type==='beacon_engineer'||UNIT_DEFS[u.type].lanceChampion;
    if(direct&&!this.combatTerrain.canShoot(u,target))return false;
    if((direct||kind==='siege')&&ds(u,target)<=(this.unitRange(u)+.07)**2)return true;
    if(this.navigation.clearSegment(u,target,u.radius))return true;
    // Share the existing bounded navigation work; an enemy across an impassable
    // bank must not pin an idle company or send it on a map-wide detour.
    const origin=this.navigation.index(u),field=this.navigation.field(target,this.unitClass(u),origin);
    return !!field&&field.distance[origin]<=leash*1.5;
  }
  hasFacingOrder(u){return Number.isFinite(u.order?.facingX)&&Number.isFinite(u.order?.facingY);}
  formationSettled(u){return u.order?.mode==='hold'||this.hasFacingOrder(u)&&Math.hypot(u.x-u.order.x,u.y-u.order.y)<.3;}
  turnFacing(u,dx,dy,dt){
    const length=Math.hypot(dx,dy);if(length<.001)return;dx/=length;dy/=length;
    const dot=(u.facingX??dx)*dx+(u.facingY??dy)*dy;if(dot>.9999){u.facingX=dx;u.facingY=dy;return;}
    const angle=Math.atan2(u.facingY??dy,u.facingX??dx),delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));
    const rate=this.hasFacingOrder(u)&&this.unitClass(u)==='infantry'?1.8:4.5,next=angle+clamp(delta,-rate*dt,rate*dt);u.facingX=Math.cos(next);u.facingY=Math.sin(next);
  }
  canAttackFacing(u,target){
    if(!this.hasFacingOrder(u))return true;const dx=target.x-u.x,dy=target.y-u.y,length=Math.hypot(dx,dy)||1;
    return (dx*u.facingX+dy*u.facingY)/length>(UNIT_DEFS[u.type].spearBrace?.35:0);
  }
  facingDamageMultiplier(target,source){
    if(!UNIT_DEFS[target.type]||source.secondary||source.impactKind!=='weapon'||!Number.isFinite(source.originX)||!Number.isFinite(source.originY))return 1;
    const dx=source.originX-target.x,dy=source.originY-target.y,length=Math.hypot(dx,dy);if(length<.001)return 1;
    const facing=target.braceDir||{x:target.facingX||0,y:target.facingY||0};if(Math.hypot(facing.x,facing.y)<.5)return 1;const dot=(dx*facing.x+dy*facing.y)/length,kind=this.unitClass(source),missile=source.projectileType==='arrow'||source.projectileType==='bolt'||source.projectileType==='axe';
    if(!missile&&['infantry','cavalry','hero'].includes(kind)){if(dot<-.5)return 1.3;if(Math.abs(dot)<.35)return 1.12;}
    const guarded=this.unitClass(target)==='infantry'&&target.order?.formation==='line'&&(target.order?.mode==='hold'||this.hasFacingOrder(target));
    if(guarded&&dot>.5&&!UNIT_DEFS[target.type].shieldBearer){const pike=target.type==='dread_pike';return missile?(pike?1:.8):(pike?.95:.85);}
    return 1;
  }

  command(ids,x,y,mode='attack',formation='line',facing=null){
    const arr=[...new Set(ids||[])].map(id=>this.byId.get(id)).filter(u=>u&&u.hp>0&&UNIT_DEFS[u.type]);if(!arr.length||!Number.isFinite(x)||!Number.isFinite(y))return;
    x=clamp(x,1.4,this.W-1.4);y=clamp(y,1.4,this.H-1.4);
    const destination=this.navigation.nearestPassable({x,y});if(!destination)return;x=destination.x;y=destination.y;
    const center=arr.reduce((o,u)=>({x:o.x+u.x/arr.length,y:o.y+u.y/arr.length}),{x:0,y:0});
    const facingLength=Math.hypot(facing?.x||0,facing?.y||0),locked=Number.isFinite(facing?.x)&&Number.isFinite(facing?.y)&&facingLength>.001;
    const angle=locked?Math.atan2(facing.y,facing.x):Math.atan2(y-center.y,x-center.x),fx=Math.cos(angle),fy=Math.sin(angle),sideX=-fy,sideY=fx;
    // Keep ranged fighters at the rear instead of collapsing the whole army onto one point.
    const rank=u=>this.unitClass(u)==='siege'?4:this.unitClass(u)==='archer'?3:UNIT_DEFS[u.type].spearBrace?0:UNIT_DEFS[u.type].shieldBearer?.5:1;
    arr.sort((a,b)=>rank(a)-rank(b)||a.id-b.id);
    const spacing=formation==='spread'?.7:.43,cols=Math.max(3,Math.ceil(Math.sqrt(arr.length)*1.45)),rows=Math.ceil(arr.length/cols);
    arr.forEach((u,i)=>{let side=(i%cols-(Math.min(cols,arr.length)-1)/2)*spacing,back=(Math.floor(i/cols)-(rows-1)/2)*spacing;
      if(formation==='wedge'&&arr.length>1){side=(i%cols-(cols-1)/2)*spacing;back=Math.abs(side)*.7+Math.floor(i/cols)*spacing-rows*spacing*.45;}
      let goal=this.bound({x:x+sideX*side-fx*back,y:y+sideY*side-fy*back});if(!this.isWalkable(goal.x,goal.y))goal=this.navigation.nearestPassable(goal)||destination;if(!this.navigation.isClearPoint(goal.x,goal.y,u.radius))goal={x:Math.floor(goal.x)+.5,y:Math.floor(goal.y)+.5};if(this.unitClass(u)==='cavalry'&&(mode!=='attack'||u.charging&&((goal.x-u.x)*u.chargeDir.x+(goal.y-u.y)*u.chargeDir.y)<0||locked&&fx*u.chargeDir.x+fy*u.chargeDir.y<.5))this.stopCharge(u);u.championRegroup=null;u.championCyclePending=false;u.order={...goal,mode,formation,groupX:x,groupY:y,...(locked?{facingX:fx,facingY:fy}:{})};u.braceTime=0;u.braceDir=null;u.target=null;u.aggroAnchor=null;u.seek=0;u.sweepWait=0;if(UNIT_DEFS[u.type].setupSeconds&&Math.hypot(goal.x-u.x,goal.y-u.y)>.16)u.setupProgress=0;
    });
  }
  attackNearest(ids,formation='line'){
    const troops=[...new Set(ids||[])].map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&UNIT_DEFS[u.type]&&this.teams[u.team]?.alive);
    if(!troops.length)return {...result(false,'Select soldiers first.'),count:0};
    const candidates=new Map();let count=0,structures=0;
    for(const u of troops){
      let foes=candidates.get(u.team);
      if(!foes){
        foes=this.knownUnits(u.team).filter(e=>e.hp>0&&this.hostile(u.team,e.team)&&(this.config.fogOfWar||this.teams[e.team]?.alive));
        if(!foes.length)foes=this.knownBuildings(u.team).filter(e=>e.hp>0&&this.hostile(u.team,e.team)&&(this.config.fogOfWar||this.teams[e.team]?.alive));
        candidates.set(u.team,foes);
      }
      let target=null,best=Infinity;
      for(const enemy of foes){const distance=ds(u,enemy);if(distance<best||target&&distance===best&&enemy.id<target.id){best=distance;target=enemy;}}
      if(!target)continue;
      // Independent normal attack orders preserve local combat and bounded path planning.
      this.command([u.id],target.x,target.y,'attack',formation);
      u.target=target.remembered?null:target;u.seek=.2+(u.id%7)*.018;count++;if(BUILD_DEFS[target.type])structures++;
    }
    return {...result(count>0,count?(structures===count?'Each selected troop attacks its nearest enemy structure.':'Each selected troop attacks its nearest enemy unit.'):'No enemy remains to attack.'),count};
  }
  hold(ids){for(const id of ids){const u=this.byId.get(id);if(u&&UNIT_DEFS[u.type]){const locked=this.hasFacingOrder(u),facing=locked?{facingX:u.order.facingX,facingY:u.order.facingY}:{};if(this.unitClass(u)==='cavalry')this.stopCharge(u);u.championRegroup=null;u.championCyclePending=false;if(UNIT_DEFS[u.type].spearBrace){const dx=locked?u.facingX:u.target?u.target.x-u.x:u.vx||u.facingX||0,dy=locked?u.facingY:u.target?u.target.y-u.y:u.vy||u.facingY||0,length=Math.hypot(dx,dy);u.braceDir=length>.01?{x:dx/length,y:dy/length}:null;u.braceTime=0;}u.order={x:u.x,y:u.y,mode:'hold',formation:u.order?.formation||'line',...facing};u.target=null;u.aggroAnchor=null;u.seek=0;}}}
  championRally(u){
    const team=this.teams[u.team],type=regimentRequiredBuilding(u.type,team.sigil),posts=this.buildings.filter(b=>b.hp>0&&b.team===u.team&&b.type===type).sort((a,b)=>(b.id===u.spawnOriginId)-(a.id===u.spawnOriginId)||ds(a,u)-ds(b,u));
    const valid=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&this.isWalkable(p.x,p.y)&&this.navigation.route(u,p,'cavalry').reachable;
    for(const post of posts)if(valid(post.rally))return {...post.rally};
    if(valid(team.rally))return {...team.rally};
    return this.navigation.nearestPassable(team.home)||{x:u.x,y:u.y};
  }
  regroupChampion(u){
    if(!UNIT_DEFS[u.type].lanceChampion||u.team===0||u.hp<=0||u.order?.mode!=='attack')return;
    const resumeOrder={...u.order},rally=this.championRally(u);this.command([u.id],rally.x,rally.y,'move','spread');
    u.order.aiTask=resumeOrder.aiTask;u.order.championWithdraw=true;u.championRegroup={resumeOrder,rally};
  }
  retreat(ids){const teams=new Map();for(const id of new Set(ids||[])){const u=this.byId.get(id);if(u?.hp>0&&UNIT_DEFS[u.type]){if(UNIT_DEFS[u.type].lanceChampion){const rally=this.championRally(u);this.command([u.id],rally.x,rally.y,'move','spread');u.order.championWithdraw=true;}else{if(!teams.has(u.team))teams.set(u.team,[]);teams.get(u.team).push(id);}}}for(const [team,list]of teams){const h=this.teams[team].home;this.command(list,h.x,h.y,'move','spread');}}
  patrol(ids,team=0){
    const troops=[...new Set(ids||[])].map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&u.team===team&&this.teams[team]?.alive&&this.unitClass(u)==='cavalry');
    if(!troops.length)return {...result(false,'Select cavalry to patrol the edges of your territory.'),count:0};
    for(const u of troops){this.stopCharge(u);u.championRegroup=null;u.championCyclePending=false;u.target=null;u.aggroAnchor=null;u.seek=0;u.order={x:u.x,y:u.y,mode:'patrol',formation:'spread',patrolTile:null,patrolDirection:u.id%2?1:-1,patrolBlocked:0};}
    this.patrolPlanAt=0;this.updatePatrolOrders();
    return {...result(true,`${troops.length} cavalry ${troops.length===1?'unit is':'units are'} scouting your territory's edges. Patrols engage nearby enemies, then resume scouting.`),count:troops.length};
  }
  patrolRegions(){
    if(this.patrolRegionVersion===this.navigation.version&&this.patrolRegionGrid?.length===this.tiles.length)return this.patrolRegionGrid;
    const regions=new Int32Array(this.tiles.length),queue=new Int32Array(this.tiles.length);regions.fill(-1);let region=0;
    for(let start=0;start<regions.length;start++)if(this.navigation.walkable[start]&&regions[start]<0){let first=0,last=1;queue[0]=start;regions[start]=region;while(first<last){const index=queue[first++],offset=index*8;for(let d=0;d<8;d++){const next=this.navigation.neighbors[offset+d];if(next>=0&&regions[next]<0){regions[next]=region;queue[last++]=next;}}}region++;}
    this.patrolRegionVersion=this.navigation.version;this.patrolRegionGrid=regions;return regions;
  }
  planningOwners(team){return this.config.fogOfWar?this.vision?.ownersFor(team):null;}
  isPatrolEdge(index,team,owners=this.planningOwners(team)){
    const tile=this.tiles[index];if(!tile||(owners?owners[index]:tile.owner)!==team||!isPassableTile(tile))return false;
    const x=index%this.W,y=Math.floor(index/this.W);if(x===0||y===0||x===this.W-1||y===this.H-1)return true;
    return owners?owners[index-1]!==team||owners[index+1]!==team||owners[index-this.W]!==team||owners[index+this.W]!==team:this.tiles[index-1].owner!==team||this.tiles[index+1].owner!==team||this.tiles[index-this.W].owner!==team||this.tiles[index+this.W].owner!==team;
  }
  patrolEdges(team,owners=this.planningOwners(team)){
    this.patrolRouteCache??=new Map();const old=this.patrolRouteCache.get(team),s=this.teams[team],owned=owners?null:s.tiles;
    // Hidden land losses cannot invalidate scouting routes. The shared timed
    // refresh will incorporate ownership when the alliance actually observes it.
    if(old&&old.at+3>this.time&&old.terrain===this.navigation.version&&old.owned===owned)return old;
    const regions=this.patrolRegions(),groups=new Map(),home=s.home,posts=this.buildings.filter(b=>b.hp>0&&this.allied(team,b.team));
    for(let index=0;index<this.tiles.length;index++)if(this.isPatrolEdge(index,team,owners)){
      const tile=this.tiles[index],point={index,x:tile.x+.5,y:tile.y+.5,region:regions[index]};if(point.x<1.4||point.y<1.4||point.x>this.W-1.4||point.y>this.H-1.4||!this.navigation.isClearPoint(point.x,point.y,.25)||posts.some(b=>ds(b,point)<(this.buildingRadius(b)+.4)**2))continue;
      if(!groups.has(point.region))groups.set(point.region,[]);groups.get(point.region).push(point);
    }
    const points=[];for(const group of groups.values()){
      group.sort((a,b)=>Math.atan2(a.y-home.y,a.x-home.x)-Math.atan2(b.y-home.y,b.x-home.x)||ds(a,home)-ds(b,home)||a.index-b.index);
      const count=Math.min(32,group.length);for(let i=0;i<count;i++)points.push(group[Math.floor(i*group.length/count)]);
    }
    const route={points,at:this.time,terrain:this.navigation.version,owned};this.patrolRouteCache.set(team,route);this.patrolScans=(this.patrolScans||0)+1;return route;
  }
  updatePatrolOrders(){
    if((this.patrolPlanAt||0)>this.time)return;this.patrolPlanAt=this.time+.5;
    const groups=new Map();for(const u of this.units)if(u.hp>0&&u.order?.mode==='patrol'){if(!groups.has(u.team))groups.set(u.team,[]);groups.get(u.team).push(u);}
    if(!groups.size)return;const regions=this.patrolRegions();
    for(const [team,troops]of groups){
      const owners=this.planningOwners(team),route=this.patrolEdges(team,owners),reserved=new Map();for(const u of troops)if(u.order.patrolTile!=null)reserved.set(u.order.patrolTile,(reserved.get(u.order.patrolTile)||0)+1);
      for(const u of troops){const order=u.order,region=regions[this.navigation.index(u)],points=route.points.filter(p=>p.region===region),distance=Math.hypot(u.x-order.x,u.y-order.y),moved=order.patrolLast?Math.hypot(u.x-order.patrolLast.x,u.y-order.patrolLast.y):1;
        if(u.target||u.aggroAnchor){order.patrolBlocked=0;order.patrolLast={x:u.x,y:u.y};continue;}
        order.patrolBlocked=moved<.05&&distance>.8?(order.patrolBlocked||0)+.5:0;order.patrolLast={x:u.x,y:u.y};
        if(this.isPatrolEdge(order.patrolTile,team,owners)&&distance>.7&&order.patrolBlocked<6)continue;
        let next=null;const current=points.findIndex(p=>p.index===order.patrolTile);
        if(current>=0&&distance<=.7&&points.length>1)next=points[(current+order.patrolDirection+points.length)%points.length];
        else{let best=Infinity;for(const p of points){const score=ds(u,p)+(reserved.get(p.index)||0)*100+(p.index===order.patrolTile&&points.length>1?1000:0);if(score<best){best=score;next=p;}}}
        if(order.patrolTile!=null)reserved.set(order.patrolTile,Math.max(0,(reserved.get(order.patrolTile)||0)-1));
        order.x=next?.x??u.x;order.y=next?.y??u.y;order.patrolTile=next?.index??null;order.patrolBlocked=0;if(next)reserved.set(next.index,(reserved.get(next.index)||0)+1);u.target=null;
      }
    }
  }
  expand(ids){
    const troops=[...new Set(ids)].map(id=>this.byId.get(id)).filter(u=>u&&u.hp>0&&UNIT_DEFS[u.type]&&this.teams[u.team]?.alive);
    if(!troops.length)return result(false,'Select troops to expand your territory.');
    const cohorts=new Map();for(const u of troops){if(!cohorts.has(u.team))cohorts.set(u.team,this.nextExpansionId=(this.nextExpansionId||0)+1);if(this.unitClass(u)==='cavalry')this.stopCharge(u);u.championRegroup=null;u.championCyclePending=false;u.target=null;u.aggroAnchor=null;u.seek=0;u.order={x:u.x,y:u.y,mode:'expand',formation:'spread',expandId:cohorts.get(u.team),expandTile:null};}
    this.expansionPlanAt=0;this.updateExpansionOrders();
    return result(true,'Expand nearby: troops will keep claiming connected land until given another order or attacked.');
  }
  updateExpansionOrders(){
    if((this.expansionPlanAt||0)>this.time)return;this.expansionPlanAt=this.time+.75;
    const teams=new Map();for(const u of this.units)if(u.hp>0&&u.order?.mode==='expand'){if(!teams.has(u.team))teams.set(u.team,[]);teams.get(u.team).push(u);}
    for(const [team,troops]of teams){
      // One frontier scan per team and planning tick, rather than one map scan per soldier.
      const owners=this.planningOwners(team),frontier=[],reserved=new Map();for(let i=0;i<this.tiles.length;i++){const tile=this.tiles[i];if(isPassableTile(tile)&&(owners?owners[i]:tile.owner)!==team&&this.canPlanCapture(tile,team,owners))frontier.push({index:i,x:tile.x+.5,y:tile.y+.5});}
      const valid=u=>{const index=u.order.expandTile,tile=this.tiles[index];return index!==null&&isPassableTile(tile)&&(owners?owners[index]:tile.owner)!==team&&this.canPlanCapture(tile,team,owners);};
      // Finish a contested tile before choosing another; reservations keep companies spread out.
      for(const u of troops)if(valid(u)){const index=u.order.expandTile;reserved.set(index,(reserved.get(index)||0)+1);}
      for(const u of troops){
        if(valid(u))continue;let best=null,bestScore=Infinity;
        for(const candidate of frontier){const score=ds(u,candidate)+(reserved.get(candidate.index)||0)*9;if(score<bestScore){best=candidate;bestScore=score;}}
        if(best){u.order.x=best.x;u.order.y=best.y;u.order.expandTile=best.index;reserved.set(best.index,(reserved.get(best.index)||0)+1);}
        else{u.order.x=u.x;u.order.y=u.y;u.order.expandTile=null;}
      }
    }
  }
  interruptExpansion(target){
    const cohort=target.order?.expandId;if(target.order?.mode!=='expand')return;
    const ids=this.units.filter(u=>u.hp>0&&u.team===target.team&&u.order?.mode==='expand'&&u.order.expandId===cohort).map(u=>u.id);
    this.hold(ids);for(const id of ids){const u=this.byId.get(id);u.seek=0;u.order.expandStopped='attacked';}
    this.event('Expansion interrupted by an attack. Troops hold their ground to defend.',target.team);
  }
  setRally(x,y,team=0,buildingIds=null){
    const s=this.teams[team],tile=Number.isFinite(x)&&Number.isFinite(y)?this.tileAt(x,y):null;
    if(!s?.alive)return result(false,'Your house has fallen.');
    if(!isPassableTile(tile))return result(false,'Choose open ground, a bridge or a pass for your rally point.');
    const ids=buildingIds===null?null:new Set(buildingIds),posts=this.buildings.filter(b=>b.team===team&&b.hp>0&&(!ids||ids.has(b.id)));
    if(!posts.length)return result(false,'Select one of your buildings first.');
    const point=this.bound({x,y});
    if(ids===null)s.rally={...point};
    for(const b of posts)b.rally={...point};
    return result(true,`Rally point set for ${posts.length===1?'this building':posts.length+' buildings'}.`);
  }
  clearRally(team=0,buildingIds=null){
    const s=this.teams[team];if(!s?.alive)return result(false,'Your house has fallen.');
    const ids=buildingIds===null?null:new Set(buildingIds),posts=this.buildings.filter(b=>b.team===team&&b.hp>0&&(!ids||ids.has(b.id)));
    if(!posts.length)return result(false,'Select one of your buildings first.');
    if(ids===null)s.rally=null;
    for(const b of posts)b.rally=null;
    return result(true,'Rally cleared. New troops will defend their recruitment building.');
  }

  recruitDetails(type,team=0){
    const d=UNIT_DEFS[type],s=this.teams[team];if(!d||!s)return null;const kind=this.unitClass(type),special=!!d.house;let multiplier=1;
    if(s.sigil==='bear')multiplier=1.1;else if(s.sigil==='dragon'&&kind==='siege')multiplier=1.25;else if(s.sigil==='stag'&&kind==='cavalry')multiplier=1.15;else if(s.sigil==='sun'&&kind==='infantry')multiplier=1.15;else if(s.sigil==='falcon'&&kind==='siege'||s.sigil==='flayed'&&kind==='archer'||s.sigil==='bridge'&&kind==='cavalry'||s.sigil==='beacon'&&kind==='cavalry')multiplier=1.2;
    let batch=d.batch+(!d.fixedBatch&&s.sigil==='bone'&&['infantry','archer'].includes(kind)?2:0);
    if(special){
      if(s.sigil==='lion')multiplier*=.85;
      if(s.sigil==='stag'&&this.buildings.some(b=>b.team===team&&b.hp>0&&b.type==='stables'))batch++;
      if(s.sigil==='rose'&&s.banners>=3)batch++;
      if(s.sigil==='sun'&&s.tiles>=100)multiplier*=.85;
      if(s.sigil==='kraken')multiplier*=1-Math.min(.2,s.kills*.01);
      if(s.sigil==='flayed'&&s.count<s.cap*.5)batch++;
      if(s.sigil==='beacon'&&this.buildings.filter(b=>b.team===team&&b.hp>0&&b.type==='workshop').length>=2)multiplier*=.85;
      if(s.sigil==='bone'&&s.tiles<100)batch+=2;
    }
    const requiredBuilding=d.regiment?regimentRequiredBuilding(type,s.sigil):special?HOUSE_CONTENT[d.house]?.building:null,unlocked=houseCanRecruit(type,s.sigil)&&(!d.regiment||regimentAllowed(type,s.sigil))&&(!special||d.house===s.sigil)&&(!requiredBuilding||this.buildings.some(b=>b.team===team&&b.type===requiredBuilding&&b.hp>0));
    const remaining=d.musterSeconds?Math.max(0,this.recruitmentOrigin(team,type)?.musterCooldown||0):0;
    return {...d,cost:Math.ceil(d.cost*multiplier-1e-9),batch,requiredBuilding,unlocked,remaining};
  }
  recruit(type,team=0){
    const s=this.teams[team],d=this.recruitDetails(type,team);if(!s||!s.alive||!d||this.unitClass(type)==='hero')return result(false,'Choose a regiment to recruit.');
    if(!houseCanRecruit(type,s.sigil))return result(false,'Martell replaces catapults with Sun Horse Archers. Build a Sunbow Corral.');
    if(d.house&&d.house!==s.sigil)return result(false,'Only this house can recruit its own specialist troops.');
    if(d.regiment&&!regimentAllowed(type,s.sigil))return result(false,'This regiment is not available to your house.');
    if(!d.unlocked)return result(false,`Build a ${BUILD_DEFS[d.requiredBuilding].label} to recruit ${d.label.toLowerCase()}.`);
    if(d.remaining>0)return result(false,`${d.label} need ${Math.ceil(d.remaining)} more seconds to muster at their camp.`);
    const origin=this.recruitmentOrigin(team,type);if(!origin)return result(false,'A recruitment building is required.');
    if(s.count+d.batch>s.cap)return result(false,'Supply limit. Capture another castle to field a larger army.');
    if(s.gold<d.cost)return result(false,`You need ${d.cost} gold.`);
    s.gold-=d.cost;const anchor=s.rally||s.home,twins=s.sigil==='bridge'?this.buildings.filter(b=>b.team===team&&b.hp>0&&(!d.house&&!d.regiment||b.type===d.requiredBuilding)).sort((a,b)=>ds(a,anchor)-ds(b,anchor)).slice(0,2):[];if(twins.length===2){this.spawnBatch(twins[0],type,Math.ceil(d.batch/2));this.spawnBatch(twins[1],type,Math.floor(d.batch/2));}else this.spawnBatch(origin,type,d.batch);return result(true,`${d.batch} ${d.label.toLowerCase()} join your banner.`);
  }
  spawnBatch(origin,type,n){
    const team=this.teams[origin.team],spawned=[],definition=UNIT_DEFS[type];
    if(!houseCanRecruit(type,team.sigil)||definition.musterSeconds&&(origin.musterCooldown||0)>0)return;
    for(let i=0;i<n&&team.count<team.cap;i++){const angle=this.random()*Math.PI*2,r=Math.max(.85,this.buildingRadius(origin)+UNIT_DEFS[type].radius+.3)+this.random()*.45;const u=this.addUnit(origin.team,type,origin.x+Math.cos(angle)*r,origin.y+Math.sin(angle)*r);if(definition.lanceChampion)u.spawnOriginId=origin.id;spawned.push(u.id);}
    if(spawned.length){if(definition.musterSeconds){origin.musterCooldown=definition.musterSeconds;origin.spawnTimer=0;}const rally=origin.team===0?origin.rally:team.rally;if(rally&&(origin.team===0||ds(origin,rally)>2.5))this.command(spawned,rally.x,rally.y,'attack','spread');else this.idle(spawned);}
  }
  buildingStatus(team=0){
    const tiles=this.teams[team]?.tiles||0;
    return {count:this.buildings.filter(b=>b.hp>0&&b.team===team).length,cap:16+Math.floor(tiles/8),nextTiles:8-tiles%8};
  }
  build(type,x,y,team=0){
    const s=this.teams[team],d=BUILD_DEFS[type],tile=this.tileAt(x,y);if(!s?.alive||!d||type==='keep')return result(false,'Choose a building.');
    if(!houseCanBuild(type,s.sigil))return result(false,'Martell cannot build siege works. Build a Sunbow Corral for horse archers.');
    if(d.house&&d.house!==s.sigil)return result(false,'Only this house can build its specialist production structure.');
    if(!tile||tile.owner!==team)return result(false,'Build on territory owned by your house.');
    if(!this.buildingGround(type,x,y))return result(false,'Leave roads, crossings and passes open. Buildings need clear, solid ground.');
    if(s.gold<d.cost)return result(false,`You need ${d.cost} gold.`);
    if(this.buildings.some(b=>b.hp>0&&ds(b,{x,y})<(this.buildingRadius(b)+d.radius+.45)**2))return result(false,'Leave more room between buildings.');
    if(this.castles.some(c=>c.ruined&&ds(c,{x,y})<(BUILD_DEFS.keep.radius+d.radius+.45)**2))return result(false,'Leave castle ruins clear so an army can restore them.');
    const slots=this.buildingStatus(team);
    if(slots.count>=slots.cap)return result(false,`Structure limit (${slots.count}/${slots.cap}). Capture more land: every 8 owned tiles adds a slot. Existing structures remain if land is lost.`);
    s.gold-=d.cost;const built=this.addBuilding(team,type,x,y);if(s.sigil==='falcon'&&type==='tower')this.spawnBatch(built,'archer',3);return result(true,`${d.label} established. ${slots.count+1}/${slots.cap} structure slots used.`);
  }
  upgradeMultiplier(kind,level=0){const bounded=clamp(Number.isFinite(level)?level:0,0,500);return 1+(kind==='economy'?.12*Math.sqrt(bounded):bounded*.02);}
  incomeFor(team=0){const s=this.teams[team];if(!s)return 0;return (4+1.1*Math.log2(1+Math.max(0,s.value)/49)+.18*Math.log2(1+Math.max(0,s.banners)))*this.upgradeMultiplier('economy',s.upgrades.economy);}
  upgradeDetails(kind,team=0){
    const s=this.teams[team],valid=['weapons','armor','economy'].includes(kind),level=s?.upgrades[kind]||0,max=500,currentBonus=this.upgradeMultiplier(kind,level)-1,nextBonus=this.upgradeMultiplier(kind,Math.min(max,level+1))-1,bonusPerLevel=kind==='economy'?nextBonus-currentBonus:.02;
    const penalty=s?.sigil==='fish'&&kind==='weapons'?1.15:s?.sigil==='bone'&&kind==='armor'?1.2:1,cost=valid?Math.ceil((200+level*160+level*level*8)*penalty-1e-9):Infinity;
    return {level,max,cost,bonusPerLevel,currentBonus,nextBonus,diminishing:kind==='economy'};
  }
  upgrade(kind,team=0){
    const s=this.teams[team];if(!s?.alive||!['weapons','armor','economy'].includes(kind))return result(false,'Choose an upgrade.');const {level,cost,max}=this.upgradeDetails(kind,team);if(level>=max)return result(false,`Already at this house's maximum level (${max}).`);if(s.gold<cost)return result(false,`You need ${cost} gold.`);s.gold-=cost;s.upgrades[kind]++;
    if(kind==='armor')for(const u of this.units)if(u.team===team&&u.hp>0){const fraction=clamp(u.hp/u.maxHp,0,1);u.maxHp=UNIT_DEFS[u.type].hp*this.upgradeMultiplier('armor',s.upgrades.armor)*(u.elite?1.5:1);u.hp=u.maxHp*fraction;}
    if(kind==='economy')s.income=this.incomeFor(team);
    return result(true,`${kind[0].toUpperCase()+kind.slice(1)} upgraded to level ${level+1}.`);
  }

  recruitmentOrigin(team=0,type=null){
    const s=this.teams[team],buildings=this.buildings.filter(b=>b.team===team&&b.hp>0);if(!s||!buildings.length)return null;const anchor=s.rally||s.home;
    if(UNIT_DEFS[type]?.house){const required=HOUSE_CONTENT[UNIT_DEFS[type].house].building;return buildings.filter(b=>b.type===required).sort((a,b)=>ds(a,anchor)-ds(b,anchor))[0]||null;}
    if(UNIT_DEFS[type]?.regiment){const required=regimentRequiredBuilding(type,s.sigil);return buildings.filter(b=>b.type===required).sort((a,b)=>(UNIT_DEFS[type].musterSeconds?Math.max(0,a.musterCooldown||0)-Math.max(0,b.musterCooldown||0):0)||ds(a,anchor)-ds(b,anchor))[0]||null;}
    return s.sigil==='lion'?buildings.sort((a,b)=>ds(a,anchor)-ds(b,anchor))[0]:buildings.find(b=>b.type==='keep')||buildings[0];
  }
  powerStatus(team=0){const s=this.teams[team],p=s?.power;if(!p)return {name:'House power',description:'',cooldown:0,remaining:0,ready:false,cost:0};const remaining=Math.max(0,(s.powerReadyAt||0)-this.time);return {...p,remaining,ready:s.alive&&remaining<=0};}
  useHousePower(ids=[],team=0){
    const s=this.teams[team],status=this.powerStatus(team);if(!s?.alive)return result(false,'Your house has fallen.');if(!status.ready)return result(false,`${status.name} is ready in ${Math.ceil(status.remaining)} seconds.`);
    if(s.gold<status.cost)return result(false,`You need ${status.cost} gold.`);
    const wanted=ids instanceof Set?[...ids]:ids;let units=wanted.length?wanted.map(id=>this.byId.get(id)).filter(u=>u&&u.team===team&&u.hp>0&&UNIT_DEFS[u.type]):this.group(team);
    const center=units.length?units.reduce((p,u)=>({x:p.x+u.x/units.length,y:p.y+u.y/units.length}),{x:0,y:0}):s.home;
    if(s.sigil==='wolf'){
      if(!units.length)return result(false,'Select soldiers to rally.');for(const u of units){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.16);u.resolveUntil=this.time+8;}
    }else if(s.sigil==='lion'){
      const origin=this.recruitmentOrigin(team);if(!origin)return result(false,'Build a recruitment post first.');if(s.cap-s.count<12)return result(false,'The contract needs 12 free supply.');
      this.spawnBatch(origin,'infantry',8);this.spawnBatch(origin,'archer',4);
    }else if(s.sigil==='dragon'){
      const targets=[...this.units,...this.buildings].filter(u=>this.hostile(u.team,team)&&u.hp>0&&this.isVisibleTo(team,u)&&ds(u,center)<=64).sort((a,b)=>ds(a,center)-ds(b,center));if(!targets.length)return result(false,'Move a selected force within 8 cells of a visible enemy position.');
      let target=targets[0],score=-Infinity;for(const e of targets.slice(0,20)){let count=0;this.hash.visit(e.x,e.y,1.6,u=>{if(this.hostile(u.team,team)&&u.hp>0&&this.isVisibleTo(team,u)&&ds(u,e)<2.56)count++;});const value=count*4-ds(e,center)*.05;if(value>score){score=value;target=e;}}
      this.addFireZone(team,target.x,target.y,1.6,5,9);
    }else if(s.sigil==='stag'){
      units=units.filter(u=>this.unitClass(u)==='cavalry');if(!units.length)return result(false,'Select cavalry for Storm Charge.');for(const u of units)u.stormUntil=this.time+10;
    }else if(s.sigil==='rose'){
      const posts=this.buildings.filter(b=>b.team===team&&b.hp>0&&BUILD_DEFS[b.type].unit).slice(0,4);if(!posts.length||s.count>=s.cap)return result(false,'A production building and free supply are required.');
      for(const b of posts){const d=BUILD_DEFS[b.type];this.spawnBatch(b,d.unit,d.batch);b.spawnTimer=0;}
    }else if(s.sigil==='sun'){
      units=units.filter(u=>this.isRanged(u));if(!units.length)return result(false,'Select archers for Viper Venom.');for(const u of units)u.venomUntil=this.time+10;
    }else if(s.sigil==='kraken'){
      if(!units.length)return result(false,'Select a raiding force.');for(const u of units)u.rushUntil=this.time+10;
    }else if(s.sigil==='falcon'){
      if(!this.buildings.some(b=>b.team===team&&b.type==='tower'&&b.hp>0))return result(false,'Build a watchtower for Falcon Guard.');s.buffs.falconUntil=this.time+10;
    }else if(s.sigil==='flayed'){
      units=units.filter(u=>this.unitClass(u)==='infantry');if(!units.length)return result(false,'Select swordsmen for Dread Harvest.');for(const u of units)u.harvestUntil=this.time+10;
    }else if(s.sigil==='bridge'){
      const anchor=s.rally||s.home,posts=this.buildings.filter(b=>b.team===team&&b.hp>0).sort((a,b)=>ds(a,anchor)-ds(b,anchor)).slice(0,2);if(posts.length<2||s.cap-s.count<16)return result(false,'Twin Garrisons needs two posts and 16 free supply.');for(const post of posts){this.spawnBatch(post,'infantry',4);this.spawnBatch(post,'archer',4);}
    }else if(s.sigil==='bear'){
      units=units.filter(u=>this.unitClass(u)==='infantry'||this.unitClass(u)==='hero');if(!units.length)return result(false,'Select infantry for Bear Guard.');for(const u of units)u.bearUntil=this.time+10;
    }else if(s.sigil==='fish'){
      const forts=this.buildings.filter(b=>b.team===team&&b.hp>0);if(!forts.length)return result(false,'You need a stronghold to rally.');for(const b of forts)b.hp=Math.min(b.maxHp,b.hp+b.maxHp*.18);for(const u of this.units)if(u.team===team&&u.hp>0&&forts.some(b=>ds(b,u)<16))u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.12);
    }else if(s.sigil==='frog'){
      if(!units.length)return result(false,'Select a woodland force.');for(const u of units)u.pathsUntil=this.time+12;
    }else if(s.sigil==='beacon'){
      const anchor=s.rally||s.home,workshop=this.buildings.filter(b=>b.team===team&&b.type==='workshop'&&b.hp>0).sort((a,b)=>ds(a,anchor)-ds(b,anchor))[0];if(!workshop||s.cap-s.count<2)return result(false,'Engineering Corps needs a siege workshop and 2 free supply.');this.spawnBatch(workshop,'siege',2);for(const b of this.buildings)if(b.team===team&&b.type==='workshop'&&b.hp>0)b.hp=Math.min(b.maxHp,b.hp+b.maxHp*.2);
    }else if(s.sigil==='huntsman'){
      units=units.filter(u=>this.unitClass(u)==='infantry');if(!units.length)return result(false,'Select infantry for Disciplined Advance.');for(const u of units)u.disciplineUntil=this.time+10;
    }else if(s.sigil==='bone'){
      const origin=this.recruitmentOrigin(team);if(!origin||s.cap-s.count<20)return result(false,'Wild Muster needs a recruitment post and 20 free supply.');this.spawnBatch(origin,'infantry',20);
    }
    s.gold-=status.cost;s.powerReadyAt=this.time+status.cooldown;this.stats.housePowerUses++;this.event(`${s.name}: ${status.name}!`,team);return result(true,`${status.name} activated.`);
  }
  unitSource(u,impactKind='weapon'){
    return {team:u.team,type:u.type,id:u.id,sourceId:u.id,impactKind,held:u.order?.mode==='hold',weaponScale:this.upgradeMultiplier('weapons',this.teams[u.team].upgrades.weapons),originX:u.x,originY:u.y};
  }
  sourceUnit(source){const u=this.byId.get(source.sourceId??source.id);return u&&UNIT_DEFS[u.type]&&u.team===source.team&&u.type===source.type?u:null;}
  specialCue(kind,point,team){if(this.effects.length<220)this.effects.push({type:'specialHit',kind,x:point.x,y:point.y,team,life:.55,maxLife:.55});this.stats.specialistProcs=(this.stats.specialistProcs||0)+1;}
  bloodFury(u){return u.type==='freefolk_berserker'&&(u.hp<u.maxHp*.4||(u.berserkUntil||0)>this.time);}
  specialistSpeed(u){let factor=this.bloodFury(u)?1.15:1;if(u.crippledUntil>this.time)factor*=.75;if(u.snaredUntil>this.time)factor*=.15;if(u.shockUntil>this.time)factor*=.1;return factor;}
  specialistGuard(target,source){
    if(!UNIT_DEFS[target.type]||this.allied(target.team,source.team)||!source.impactKind||source.secondary)return 0;
    const melee=['infantry','cavalry','hero'].includes(this.unitClass(source)),r=1.8;let guard=0;
    this.hash.visit(target.x,target.y,r,u=>{if(u===target||u.team!==target.team||u.hp<=0||u.order?.mode!=='hold')return;const distance=ds(u,target);if(u.type==='winter_guard'&&melee&&distance<1.6**2)guard=Math.max(guard,.2);if(u.type==='bridge_warden'&&distance<r*r)guard=Math.max(guard,.15);});
    if(guard){target.specialGuardUntil=this.time+.35;this.specialCue('guard',target,target.team);}return guard;
  }
  specialistDamage(target,amount,source){
    if(this.allied(target.team,source.team)||!source.impactKind||source.secondary)return amount;
    const troop=!!UNIT_DEFS[target.type];
    if(source.type==='gilded_crossbow'&&troop&&this.teams[target.team].upgrades.armor>0)amount*=1.35;
    if(source.type==='ironborn_reaver'&&BUILD_DEFS[target.type])amount*=1.5;
    if(source.type==='vale_sentinel'&&source.held&&this.unitClass(target)==='cavalry')amount*=1.3;
    if(source.type==='hill_huntsman'&&troop&&target.hp<target.maxHp*.35){amount*=1.4;this.specialCue('finish',target,source.team);}
    const attacker=this.sourceUnit(source);if(source.type==='freefolk_berserker'&&attacker?.hp>0&&this.bloodFury(attacker))amount*=1.3;
    return amount;
  }
  specialistHit(target,amount,source){
    if(this.allied(target.team,source.team)||!source.impactKind||source.secondary)return;const troop=!!UNIT_DEFS[target.type],attacker=this.sourceUnit(source),alive=attacker?.hp>0;
    if(troop&&target.hp>0){
      if(source.type==='dune_skirmisher'){target.crippledUntil=this.time+2;this.specialCue('cripple',target,source.team);}
      if(source.type==='crannog_hunter'){
        const poison=target.crannogPoison,dps=5*(source.weaponScale||1);if(!poison||poison.until<=this.time||dps>=poison.dps)target.crannogPoison={until:this.time+3,dps,team:source.team,sourceId:source.sourceId,sourceType:source.type};
        this.specialCue('poison',target,source.team);
      }
    }
    if(source.type==='bear_mauler'&&source.cleaveReady&&alive){
      const foes=[];this.hash.visit(target.x,target.y,1.1,u=>{if(u!==target&&this.hostile(u.team,source.team)&&u.hp>0&&ds(u,target)<1.1**2)foes.push(u);});foes.sort((a,b)=>ds(a,target)-ds(b,target)||a.id-b.id);
      for(const foe of foes.slice(0,2)){
        this.damage(foe,amount*.4,{...source,secondary:true,impactKind:'cleave'});if(foe.hp>0){let dx=foe.x-(attacker.x||source.originX),dy=foe.y-(attacker.y||source.originY),length=Math.hypot(dx,dy)||1;foe.knockVX=dx/length*1.5;foe.knockVY=dy/length*1.5;foe.knockT=.2;foe.knockDuration=.2;}
        this.specialCue('cleave',foe,source.team);
      }
    }
    if(target.hp<=0&&source.type==='ironborn_reaver'&&BUILD_DEFS[target.type]&&!target.reaverLootPaid){target.reaverLootPaid=true;this.teams[source.team].gold+=15;this.specialCue('loot',target,source.team);}
    if(target.hp<=0&&troop&&source.type==='freefolk_berserker'&&alive){attacker.berserkUntil=this.time+4;this.specialCue('fury',attacker,source.team);}
  }
  updateSpecialists(dt){
    for(const u of this.units){if(u.hp<=0)continue;const poison=u.crannogPoison;
      if(poison&&poison.until>this.time&&this.hostile(poison.team,u.team)){this.damage(u,poison.dps*dt,{team:poison.team,type:poison.sourceType,sourceId:poison.sourceId,secondary:true});if(u.hp<=0)continue;}
      if(u.type!=='river_ranger'||(u.riverMendAt||0)>this.time)continue;u.riverMendAt=this.time+4;
      let target=null,wounded=0;this.hash.visit(u.x,u.y,3,v=>{if(v===u||v.team!==u.team||v.hp<=0||(v.riverMendedUntil||0)>this.time||ds(u,v)>=9)return;const missing=1-v.hp/v.maxHp;if(missing>wounded){wounded=missing;target=v;}});
      if(target){target.hp=Math.min(target.maxHp,target.hp+target.maxHp*.06);target.riverMendedUntil=this.time+4;this.specialCue('heal',target,u.team);}
    }
  }
  ballistaImpact(p){
    const dx=p.tx-p.sx,dy=p.ty-p.sy,length=Math.hypot(dx,dy)||1,end={x:p.tx+dx/length*1.4,y:p.ty+dy/length*1.4},ex=end.x-p.sx,ey=end.y-p.sy,length2=ex*ex+ey*ey,candidates=[];
    for(const target of [...this.units,...this.buildings]){if(!this.hostile(target.team,p.team)||target.hp<=0)continue;const along=length2?((target.x-p.sx)*ex+(target.y-p.sy)*ey)/length2:0;if(along<0||along>1)continue;const radius=(UNIT_DEFS[target.type]?.radius||this.buildingRadius(target))+.16,px=p.sx+along*ex,py=p.sy+along*ey;if((target.x-px)**2+(target.y-py)**2<radius*radius)candidates.push({target,along});}
    candidates.sort((a,b)=>a.along-b.along||a.target.id-b.target.id);
    const source={team:p.team,type:p.sourceType,sourceId:p.sourceId,impactKind:'bolt',projectileType:'bolt',weaponScale:p.weaponScale,held:p.held,originX:p.sx,originY:p.sy};
    candidates.filter(({target})=>this.combatTerrain.canShoot({x:p.sx,y:p.sy},target)).slice(0,3).forEach(({target},index)=>{const amount=p.siegeBaseDamage*(BUILD_DEFS[target.type]?3:1)*.7**index;this.damage(target,amount,source);this.specialCue('pierce',target,p.team);});
  }
  addFireZone(team,x,y,radius,life,dps){
    const near=this.fireZones.find(z=>z.team===team&&(z.x-x)**2+(z.y-y)**2<.16);if(near){near.life=Math.max(near.life,life);near.maxLife=Math.max(near.maxLife,life);near.radius=Math.max(near.radius,radius);near.dps=Math.max(near.dps,dps);return;}
    if(this.fireZones.length>=24)this.fireZones.shift();this.fireZones.push({team,x,y,radius,life,maxLife:life,dps});
  }
  updateHouseEffects(dt){
    const burning=new Map();for(const z of this.fireZones){z.life-=dt;if(z.life<=0)continue;this.hash.visit(z.x,z.y,z.radius,u=>{if(this.hostile(u.team,z.team)&&u.hp>0&&ds(u,z)<z.radius*z.radius){const old=burning.get(u.id);if(!old||old.dps<z.dps)burning.set(u.id,{u,dps:z.dps,team:z.team});}});}
    for(const {u,dps,team}of burning.values())this.damage(u,dps*dt,{team});this.fireZones=this.fireZones.filter(z=>z.life>0);
  }
  houseProjectileImpact(p){
    if(p.type==='rock'&&this.teams[p.team]?.sigil==='dragon'){const special=p.sourceType==='dragonfire_acolyte';this.addFireZone(p.team,p.tx,p.ty,special?1.2:.95,special?4:3,special?8*(p.weaponScale||1):6);}
    if(p.venom){const target=this.byId.get(p.target);if(target&&this.hostile(target.team,p.team)&&target.hp>0&&UNIT_DEFS[target.type]){target.poisonUntil=this.time+4;target.poisonTeam=p.team;}}
  }
  unitRange(u){return UNIT_DEFS[u.type].range+this.combatTerrain.hillRange(u,this.unitClass(u))+(this.teams[u.team].sigil==='frog'&&this.unitClass(u)==='archer'&&this.tileAt(u.x,u.y)?.terrain==='forest'?1:0)+(u.type==='vale_sentinel'&&u.order?.mode==='hold'?1:0);}
  recoveryRate(u,mode){
    const s=this.teams[u.team];let rate=.0035;if(s.sigil==='wolf'&&mode==='hold')rate*=2.5;if(s.sigil==='kraken')rate*=.5;
    if((s.sigil==='bear'&&this.unitClass(u)==='infantry')||s.sigil==='fish'){
      if((u.auraAt||0)<=this.time){u.auraAt=this.time+.5;u.houseAura=false;if(s.sigil==='bear')this.hash.visit(u.x,u.y,3,v=>{if(v.team===u.team&&this.unitClass(v)==='hero'&&v.hp>0&&ds(u,v)<9)u.houseAura=true;});else u.houseAura=this.buildings.some(b=>b.team===u.team&&b.hp>0&&(b.type==='keep'||b.type==='tower')&&ds(u,b)<16);}
      if(u.houseAura)rate+=.006;
    }return rate;
  }
  knockbackFactor(u){const s=this.teams[u.team];let factor=1;if(s.sigil==='wolf'&&this.unitClass(u)==='infantry'&&u.order?.mode==='hold')factor*=.55;if(u.resolveUntil>this.time)factor*=.65;if(u.bearUntil>this.time)factor*=.35;if(s.sigil==='bear'){this.recoveryRate(u,u.order?.mode);if(u.houseAura)factor*=.8;}return factor;}
  siegeImpact(p){
    const radius=p.splash||1.3,base=p.siegeBaseDamage??p.damage,point={x:p.tx,y:p.ty};this.stats.siegeImpacts=(this.stats.siegeImpacts||0)+1;
    this.hash.visit(p.tx,p.ty,radius,u=>{if(!this.hostile(u.team,p.team)||u.hp<=0)return;const distance=Math.sqrt(ds(u,point));if(distance>radius)return;const falloff=1-.62*distance/radius;this.damage(u,base*.62*falloff,{team:p.team});if(u.hp<=0)return;
      let dx=u.x-p.tx,dy=u.y-p.ty,len=Math.hypot(dx,dy);if(len<.00001){const angle=u.id*2.399963;dx=Math.cos(angle);dy=Math.sin(angle);len=1;}
      const mass=this.unitClass(u)==='hero'?.48:this.unitClass(u)==='siege'?.4:this.unitClass(u)==='cavalry'?.68:this.unitClass(u)==='infantry'?.8:1,travel=Math.min(1.15,(.35+.8*falloff)*mass*this.knockbackFactor(u)),duration=.36,kick=travel*2/duration;
      u.knockVX=dx/len*kick;u.knockVY=dy/len*kick;u.knockT=duration;u.knockDuration=duration;if(this.unitClass(u)==='cavalry')this.stopCharge(u);
    });
    for(const b of this.buildings){if(!this.hostile(b.team,p.team)||b.hp<=0)continue;const distance=Math.sqrt(ds(b,point));if(distance<radius+this.buildingRadius(b)*.35)this.damage(b,base*3*Math.max(.45,1-.4*distance/radius),{team:p.team});}
    if(this.effects.length<230)this.effects.push({x:p.tx,y:p.ty,type:'explosion',life:.7,maxLife:.7,team:p.team,radius,strength:1.25});
  }
  aiHousePower(s,army){
    const status=this.powerStatus(s.id);if(!status.ready||this.time<12)return;const economic=['lion','bridge','rose','beacon','bone'].includes(s.sigil);if(economic){if(!status.cost||s.gold-status.cost>=(s.aiPlan?.economyReserve??s.aiPlan?.production?.reserved??0))this.useHousePower([],s.id);return;}
    if(s.sigil==='fish'&&this.buildings.some(b=>b.team===s.id&&b.hp>0&&b.hp<b.maxHp*.8)){this.useHousePower([],s.id);return;}
    if(s.sigil==='falcon'){let threatened=false;for(const b of this.buildings)if(b.team===s.id&&b.type==='tower'&&b.hp>0)this.hash.visit(b.x,b.y,7,u=>{if(this.hostile(s.id,u.team)&&u.hp>0&&ds(b,u)<49&&(!this.config.fogOfWar||this.isVisibleTo(s.id,u)))threatened=true;});if(threatened){this.useHousePower([],s.id);return;}}
    const lead=army.find(u=>u.target&&u.target.hp>0&&this.hostile(s.id,u.target.team)&&(!this.config.fogOfWar||this.isVisibleTo(s.id,u.target)))||army.find(u=>u.hp<u.maxHp*.75);if(!lead)return;const local=army.filter(u=>ds(u,lead)<36);this.useHousePower(local.map(u=>u.id),s.id);
  }
  damage(target,amount,source){
    if(target.hp<=0||!Number.isFinite(amount)||amount<=0)return;source=source||{team:-1};if(this.allied(source.team,target.team)||source.team>=0&&!this.teams[source.team]?.alive)return;amount=this.specialistDamage(target,amount,source);const facingFactor=this.facingDamageMultiplier(target,source),shieldFactor=shieldFacingMultiplier(target,source);amount*=facingFactor*shieldFactor;if(UNIT_DEFS[target.type])amount*=this.combatTerrain.coverMultiplier(target,source.projectileType);amount*=target.bearUntil>this.time?.7:1;amount*=1-this.specialistGuard(target,source);if(this.hostile(source.team,target.team)&&target.order?.mode==='expand')this.interruptExpansion(target);const dealt=Math.min(target.hp,amount);target.hp-=amount;target.hit=.16;
    if(UNIT_DEFS[target.type]&&!source.secondary&&Number.isFinite(source.originX)&&Number.isFinite(source.originY)){
      const dx=target.x-source.originX,dy=target.y-source.originY,length=Math.hypot(dx,dy)||1,blocked=shieldFactor<1||facingFactor<1;
      target.hitVisual={at:this.time,dx:dx/length,dy:dy/length,blocked};
      if(blocked&&this.effects.length<180)this.effects.push({x:target.x,y:target.y,type:'blockImpact',life:.2,maxLife:.2,team:target.team,dx:dx/length,dy:dy/length});
    }
    const attacker=this.teams[source.team],attackerUnit=this.sourceUnit(source);if(this.unitClass(source)==='infantry'&&attacker?.sigil==='flayed'&&attackerUnit?.hp>0){if(attackerUnit.harvestUntil>this.time)attackerUnit.hp=Math.min(attackerUnit.maxHp,attackerUnit.hp+dealt*.25);if(target.hp<=0&&UNIT_DEFS[target.type])attackerUnit.hp=Math.min(attackerUnit.maxHp,attackerUnit.hp+8);}
    this.specialistHit(target,amount,source);
    if(target.hp<=0){const s=this.teams[source.team];if(s)s.kills++;this.stats.dead++;if(UNIT_DEFS[target.type]){this.aftermath.record(target,this.teams[target.team],this.aftermath.time,this.unitClass(target));this.teams[target.team].count--;if(target.isKing&&this.mode.kingSurvival){this.eliminate(target.team,'king');return;}if(this.unitClass(target)==='hero'){this.teams[target.team].heroTimer=35;this.event(`${this.teams[target.team].name}'s commander has fallen.`,target.team);}}else{this.event(`${this.teams[target.team].name} lost a ${BUILD_DEFS[target.type].label.toLowerCase()}.`,target.team);this.effects.push({x:target.x,y:target.y,type:'explosion',life:1.1,maxLife:1.1,team:target.team});if(target.type==='keep')this.ruinCastle(target);}}
  }
  findTarget(u){
    const autonomous=this.autonomousAggro(u),direct=this.isRanged(u)||u.type==='beacon_engineer',range=autonomous?this.aggroRange(u):this.unitClass(u)==='cavalry'&&u.order?.mode==='attack'?6.2:this.unitRange(u)+1.5;let best=null,bestScore=Infinity;
    this.hash.visit(u.x,u.y,range,e=>{if(!this.hostile(e.team,u.team)||e.hp<=0||!this.isVisibleTo(u.team,e))return;const distance=ds(u,e);if(distance>range*range||!this.canAttackFacing(u,e))return;let score=distance;
      if(this.unitClass(u)==='cavalry'&&this.unitClass(e)==='archer')score*=.58;
      if(this.unitClass(u)==='archer'&&this.unitClass(e)==='infantry')score*=.78;
      if(this.unitClass(u)==='infantry'&&this.unitClass(e)==='cavalry')score*=.75;
      if(score<bestScore&&(!direct||this.combatTerrain.canShoot(u,e))&&(!autonomous||this.canAggro(u,e))){best=e;bestScore=score;}
    });
    // Autonomous soldiers react to enemy troops. Structure attacks remain an
    // explicit attack order, so a nearby fort cannot pull guards off their post.
    if(autonomous)return best;
    for(const b of this.buildings){if(!this.hostile(b.team,u.team)||b.hp<=0||!this.isVisibleTo(u.team,b))continue;const distance=ds(u,b);if(distance>(range+.6)**2||!this.canAttackFacing(u,b))continue;const score=distance*(this.unitClass(u)==='siege'?.32:1.7);if(score<bestScore&&(!direct||this.combatTerrain.canShoot(u,b))){best=b;bestScore=score;}}
    return best;
  }
  attack(u,target){
    if(u.hp<=0||target.hp<=0||target.remembered||!this.hostile(u.team,target.team)||!this.isVisibleTo(u.team,target)||u.shockUntil>this.time||!this.canAttackFacing(u,target)||(this.isRanged(u)||u.type==='beacon_engineer'||UNIT_DEFS[u.type].lanceChampion)&&!this.combatTerrain.canShoot(u,target))return;
    if(UNIT_DEFS[u.type].setupSeconds&&((u.setupProgress||0)<UNIT_DEFS[u.type].setupSeconds||Math.hypot(u.vx||0,u.vy||0)>.03||u.knockT>0))return;
    const d=UNIT_DEFS[u.type],s=this.teams[u.team];let amount=d.damage*this.upgradeMultiplier('weapons',s.upgrades.weapons)*(u.elite?1.35:1),counter=1;this.stats.battles++;
    if(this.unitClass(u)==='infantry'&&this.unitClass(target)==='cavalry')counter=d.spearWeapon?2:d.spearBrace?(u.type==='dread_pike'?2.5:2.15):1.55;
    if(this.isRanged(u)&&this.unitClass(target)==='infantry')counter=1.3;
    if(this.unitClass(u)==='cavalry'&&!d.ranged&&this.unitClass(target)==='archer')counter=1.65;
    // Impact is resolved by swept physical contact, separately from weapon strikes.
    // A rider can strike while galloping, spending momentum on each weapon attack.
    if(this.unitClass(u)==='cavalry'&&u.charging)u.momentum=Math.max(0,u.momentum-.04);
    const building=!!BUILD_DEFS[target.type];if(building)amount*=this.unitClass(u)==='siege'?3:this.isRanged(u)?.5:.8;
    const disciplined=s.sigil==='huntsman'&&this.unitClass(u)==='infantry'&&u.order?.formation==='line',woodland=s.sigil==='frog'&&this.unitClass(u)==='archer'&&this.tileAt(u.x,u.y)?.terrain==='forest';amount*=counter;if(d.hammer&&!building&&this.isSpearBraced(target,{x:target.x-u.x,y:target.y-u.y}))amount*=1.25;u.cooldown=d.rate/(disciplined||woodland?1.15:1)/(d.stationaryReload&&(u.stationaryTime||0)>=2?1.25:1);u.attackAnim=1;
    const visualDX=target.x-u.x,visualDY=target.y-u.y,visualDistance=Math.hypot(visualDX,visualDY)||1;u.attackVisual={at:this.time,cycle:u.cooldown,dx:visualDX/visualDistance,dy:visualDY/visualDistance,distance:visualDistance};
    if(this.isRanged(u)||this.unitClass(u)==='siege'){
      const duration=d.setupSeconds?1.15+Math.sqrt(ds(u,target))*.025:this.unitClass(u)==='siege'?.8:.24+Math.sqrt(ds(u,target))*.035;
      this.projectiles.push({sx:u.x,sy:u.y,x:u.x,y:u.y,tx:target.x,ty:target.y,t:0,duration,type:d.projectile||(u.type==='beacon_engineer'?'bolt':this.unitClass(u)==='siege'?'rock':'arrow'),team:u.team,target:target.id,sourceId:u.id,sourceType:u.type,held:u.order?.mode==='hold',weaponScale:this.upgradeMultiplier('weapons',s.upgrades.weapons),damage:amount,siegeBaseDamage:d.damage*this.upgradeMultiplier('weapons',s.upgrades.weapons)*(u.elite?1.35:1),venom:this.isRanged(u)&&u.venomUntil>this.time,piercing:u.type==='beacon_engineer',splash:this.unitClass(u)==='siege'&&u.type!=='beacon_engineer'?(d.splashRadius||1.3):0});
    }else{const source=this.unitSource(u);if(u.type==='bear_mauler'){u.maulSwings=(u.maulSwings||0)+1;source.cleaveReady=u.maulSwings%3===0;}this.damage(target,amount,source);if(d.hammer)this.hammerImpact(u,target);if(u.type==='giant'){
      const center={x:target.x,y:target.y},radius=d.splashRadius;
      const shove=(foe,travel)=>{
        if(!UNIT_DEFS[foe.type]||foe.hp<=0||!this.hostile(u.team,foe.team))return;
        let dx=foe.x-u.x,dy=foe.y-u.y,length=Math.hypot(dx,dy);if(length<.00001){const angle=foe.id*2.399963;dx=Math.cos(angle);dy=Math.sin(angle);length=1;}
        const kind=this.unitClass(foe),mass=foe.type==='giant'?.35:kind==='hero'?.5:kind==='siege'?.4:kind==='cavalry'?.7:1,front=-(dx*(foe.facingX||0)+dy*(foe.facingY||0))/length>.5,shield=UNIT_DEFS[foe.type].shieldBearer&&front?.55:1,duration=.42,kick=travel*mass*shield*this.knockbackFactor(foe)*2/duration;
        foe.knockVX=dx/length*kick;foe.knockVY=dy/length*kick;foe.knockT=duration;foe.knockDuration=duration;if(kind==='cavalry')this.stopCharge(foe);
      };
      shove(target,1.3);
      this.hash.visit(center.x,center.y,radius,foe=>{if(foe!==target&&foe.hp>0&&this.hostile(u.team,foe.team)&&ds(foe,center)<=radius*radius){this.damage(foe,amount*.65,{...source,secondary:true,impactKind:'cleave'});shove(foe,1);}});
      this.specialCue('cleave',center,u.team);if(this.effects.length<230)this.effects.push({...center,type:'explosion',life:.3,maxLife:.3,team:u.team,radius,strength:.45});
    }if(this.effects.length<180&&this.random()<.35)this.effects.push({x:(u.x+target.x)/2,y:(u.y+target.y)/2,type:'hit',life:.22,maxLife:.22,team:u.team});}
  }

  hammerImpact(attacker,target){
    const dx=target.x-attacker.x,dy=target.y-attacker.y,length=Math.hypot(dx,dy)||1;
    if(this.effects.length<230)this.effects.push({x:target.x,y:target.y,type:'hammerImpact',life:.48,maxLife:.48,team:attacker.team,dx:dx/length,dy:dy/length});
    if(!UNIT_DEFS[target.type]||target.hp<=0)return;
    const kind=this.unitClass(target),front=-(dx*(target.facingX||0)+dy*(target.facingY||0))/length>.5;
    const braced=this.isSpearBraced(target,{x:dx/length,y:dy/length}),mass=target.type==='giant'?.25:kind==='hero'?.4:kind==='siege'?.35:kind==='cavalry'?.6:1;
    const resistance=(braced?.3:1)*(UNIT_DEFS[target.type].shieldBearer&&front?.45:1)*this.knockbackFactor(target),duration=.38,kick=1.15*mass*resistance*2/duration;
    target.knockVX=dx/length*kick;target.knockVY=dy/length*kick;target.knockT=duration;target.knockDuration=duration;
    if(kind==='cavalry')this.stopCharge(target);
  }
  applyCavalryMotion(u,wantVX,wantVY,dt,returnGoal=null){
    wantVX=Number.isFinite(wantVX)?wantVX:0;wantVY=Number.isFinite(wantVY)?wantVY:0;dt=clamp(Number.isFinite(dt)?dt:0,0,.06);
    if(this.unitClass(u)!=='cavalry')return {x:wantVX,y:wantVY};
    const base=UNIT_DEFS[u.type].speed,currentVX=Number.isFinite(u.motionVX)?u.motionVX:(u.vx||0),currentVY=Number.isFinite(u.motionVY)?u.motionVY:(u.vy||0),speed=Math.hypot(currentVX,currentVY);
    let wantedSpeed=Math.hypot(wantVX,wantVY),angle=speed>.025?Math.atan2(currentVY,currentVX):this.hasFacingOrder(u)&&Math.hypot(wantVX,wantVY)>.001?Math.atan2(wantVY,wantVX):Math.atan2(u.facingY??u.chargeDir?.y??0,u.facingX??u.chargeDir?.x??1),wantedAngle=wantedSpeed>.001?Math.atan2(wantVY,wantVX):angle;
    if(u.charging&&u.chargeDir)wantedAngle=Math.atan2(u.chargeDir.y,u.chargeDir.x);
    let delta=Math.atan2(Math.sin(wantedAngle-angle),Math.cos(wantedAngle-angle));
    // Horses preserve pace through gentle curves. Sharp turns spend speed,
    // and moving riders can rotate only about two radians per second.
    const withdrawing=!!UNIT_DEFS[u.type].lanceChampion&&u.order?.mode==='move',bend=Math.abs(delta),turnRate=(2+6*(1-clamp(speed/base,0,1)))*(withdrawing?1.5:1);
    if(!u.charging&&wantedSpeed>.001){const turnFactor=bend<=.35?1:bend<=1.2?1-(bend-.35)/.85*.45:bend<=2.3?.55-(bend-1.2)/1.1*.41:.08;wantedSpeed*=withdrawing?Math.max(.35,turnFactor):turnFactor;}
    angle+=clamp(delta,-turnRate*dt,turnRate*dt);
    const order=returnGoal||u.order,arriving=order&&!u.charging&&(!u.target||order.mode==='move');
    let goalX=0,goalY=0,goalDistance=Infinity;
    if(arriving){goalX=order.x-u.x;goalY=order.y-u.y;goalDistance=Math.hypot(goalX,goalY);wantedSpeed=Math.min(wantedSpeed,Math.sqrt(14*Math.max(0,goalDistance-.1)));}
    // Even a full gallop can be reined in within roughly a third of a cell.
    const stopping=wantedSpeed<.001,brake=stopping?Math.max(7,u.motionBraking||0,speed*speed/.72):7,change=(wantedSpeed>speed?5:brake)*dt;
    u.motionBraking=stopping?brake:0;
    let nextSpeed=wantedSpeed>speed?Math.min(wantedSpeed,speed+change):Math.max(wantedSpeed,speed-change);
    const facingX=Math.cos(angle),facingY=Math.sin(angle);
    if(arriving&&dt>0){const forward=goalX*facingX+goalY*facingY;if(forward>0&&forward<nextSpeed*dt)nextSpeed=forward/dt;}
    let vx=facingX*nextSpeed,vy=facingY*nextSpeed;
    if(u.x<=1.23&&vx<0||u.x>=this.W-1.23&&vx>0)vx=0;if(u.y<=1.23&&vy<0||u.y>=this.H-1.23&&vy>0)vy=0;
    if(nextSpeed<.002){vx=0;vy=0;}
    u.motionVX=vx;u.motionVY=vy;u.motionSpeed=Math.hypot(vx,vy);if(!this.hasFacingOrder(u)){u.facingX=facingX;u.facingY=facingY;}
    return {x:vx,y:vy};
  }

  stopCharge(u){
    if(u.charging&&UNIT_DEFS[u.type].lanceChampion&&u.championChargeHit&&u.team!==0&&u.order?.mode==='attack')u.championCyclePending=true;
    if(u.charging)u.chargeCooldown=Math.max(u.chargeCooldown||0,3);
    u.charging=false;u.momentum=0;u.charge=0;u.chargeRunup=0;u.chargeTravel=0;u.chargeSpeed=0;u.chargeElapsed=0;
  }
  beginCharge(u,target){
    if(UNIT_DEFS[u.type].noCharge)return;
    u.championChargeHit=false;
    u.charging=true;u.momentum=clamp(u.momentum,.86,1);u.chargeElapsed=0;u.chargeSpeed=UNIT_DEFS[u.type].speed*(1+.85*u.momentum);
    if(UNIT_DEFS[u.type].lanceChampion)u.lanceFirstStrike=true;
    const breakthrough=u.type==='thorn_lancer'?6.4:4.8;u.chargeEnd={x:target.x+u.chargeDir.x*breakthrough,y:target.y+u.chargeDir.y*breakthrough};
    for(const [id,time]of u.chargeHits)if(this.time-time>2.8)u.chargeHits.delete(id);
  }
  chargeContact(u,oldX,oldY,dt){
    if(!u.charging)return;const dx=u.x-oldX,dy=u.y-oldY,length2=dx*dx+dy*dy,dir=u.chargeDir;
    const alongPoint=p=>length2>1e-9?clamp(((p.x-oldX)*dx+(p.y-oldY)*dy)/length2,0,1):0;
    // A solid building consumes the charge; horses never tunnel through a fort.
    for(const b of this.buildings){if(b.hp<=0)continue;const t=alongPoint(b),px=oldX+dx*t,py=oldY+dy*t,rad=this.buildingRadius(b)+UNIT_DEFS[u.type].radius+.06;
      if((px-b.x)**2+(py-b.y)**2<rad*rad){const distance=Math.hypot(oldX-b.x,oldY-b.y)||1;u.x=b.x+(oldX-b.x)/distance*(rad+.015);u.y=b.y+(oldY-b.y)/distance*(rad+.015);this.bound(u);this.stopCharge(u);return;}
    }
    const champion=!!UNIT_DEFS[u.type].lanceChampion,reach=champion?UNIT_DEFS[u.type].range:0,hitDX=dx+dir.x*reach,hitDY=dy+dir.y*reach,hitLength2=hitDX*hitDX+hitDY*hitDY;
    const hitAlong=p=>hitLength2>1e-9?clamp(((p.x-oldX)*hitDX+(p.y-oldY)*hitDY)/hitLength2,0,1):0;
    const hits=[];
    this.hash.visit(oldX+hitDX/2,oldY+hitDY/2,.72+Math.sqrt(hitLength2),e=>{
      if(!this.hostile(e.team,u.team)||e.hp<=0||(u.chargeHits.get(e.id)??-Infinity)>this.time-2.8)return;
      if(champion&&!this.combatTerrain.canShoot(u,e))return;
      if((e.x-oldX)*dir.x+(e.y-oldY)*dir.y<-.18)return;
      const spear=this.isSpearBraced(e,dir),t=hitAlong(e),px=oldX+hitDX*t,py=oldY+hitDY*t,rad=UNIT_DEFS[u.type].radius+UNIT_DEFS[e.type].radius+(spear?.42:.085);
      if((px-e.x)**2+(py-e.y)**2<=rad*rad)hits.push({e,t});
    });
    hits.sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
    for(const {e}of hits){
      if(!u.charging||u.momentum<.18||u.hp<=0)break;if(e.hp<=0)continue;
      const power=u.momentum,ex=e.braceDir?.x??e.facingX??0,ey=e.braceDir?.y??e.facingY??0,faceLength=Math.hypot(ex,ey)||1,dot=(ex*dir.x+ey*dir.y)/faceLength;
      const frontal=dot<-.4,rear=dot>.5,flank=!frontal&&!rear;
      const braced=this.unitClass(e)==='infantry'&&this.formationSettled(e)&&Math.hypot(e.vx||0,e.vy||0)<.45&&frontal,spearBraced=this.isSpearBraced(e,dir),lancer=u.type==='thorn_lancer';
      const resistance=spearBraced?.35:braced?.78:this.unitClass(e)==='hero'?.6:this.unitClass(e)==='siege'?.65:this.unitClass(e)==='cavalry'?.78:this.unitClass(e)==='archer'?1.12:.95;
      const cost=(braced?.2:this.unitClass(e)==='infantry'?.16:this.unitClass(e)==='hero'?.4:this.unitClass(e)==='siege'?.35:this.unitClass(e)==='cavalry'?.28:.105)*(rear?.45:flank?.75:1)*(this.teams[u.team].sigil==='stag'?.75:1)*(u.stormUntil>this.time?.75:1)*(lancer?.65:1);
      const firstLance=champion&&u.lanceFirstStrike,amount=(24+62*power)*this.upgradeMultiplier('weapons',this.teams[u.team].upgrades.weapons)*resistance*(rear?1.45:flank?1.15:1)*(lancer?1.2:1)*(lancer&&braced?1.25:1)*(champion?(firstLance?1.8:.5):1);
      if(champion){u.lanceFirstStrike=false;u.championChargeHit=true;}
      u.chargeHits.set(e.id,this.time);this.damage(e,amount,{...this.unitSource(u,'charge'),originX:e.x-dir.x,originY:e.y-dir.y});this.stats.chargeImpacts++;
      if(u.type==='storm_rider'&&e.hp>0){e.shockUntil=this.time+.65;this.specialCue('shock',e,u.team);}
      if(spearBraced&&e.hp>0){
        this.damage(u,(34+26*power)*this.upgradeMultiplier('weapons',this.teams[e.team].upgrades.weapons),{...this.unitSource(e,'brace'),secondary:true});
        u.snaredUntil=this.time+(e.type==='dread_pike'?.9:.45);u.chargeBlockedUntil=this.time+.9;this.stopCharge(u);
        // Keep the horse outside the living spear line instead of letting a fast frame cross it.
        const stopDistance=UNIT_DEFS[u.type].radius+UNIT_DEFS[e.type].radius+.43,along=(u.x-e.x)*dir.x+(u.y-e.y)*dir.y;
        if(along>-stopDistance){u.x-=dir.x*(along+stopDistance);u.y-=dir.y*(along+stopDistance);this.bound(u);}
        u.motionVX=0;u.motionVY=0;u.knockVX=-dir.x*2.2;u.knockVY=-dir.y*2.2;u.knockT=.22;u.knockDuration=.22;
        if(this.effects.length<220)this.effects.push({type:'braceImpact',x:e.x,y:e.y,dx:dir.x,dy:dir.y,life:.7,maxLife:.7,team:e.team});
      }
      const distance=(spearBraced?.12:braced?.6+.5*power:this.unitClass(e)==='archer'?1.1+1.05*power:this.unitClass(e)==='infantry'?.8+.85*power:this.unitClass(e)==='hero'?.35+.3*power:this.unitClass(e)==='siege'?.3+.2*power:.7+.65*power)*this.knockbackFactor(e)*(this.teams[u.team].sigil==='stag'?1.2:1)*(lancer&&!spearBraced?1.3:1)*(firstLance&&!spearBraced?1.5:1)*(UNIT_DEFS[e.type].shieldBearer&&frontal?.45:1);
      const lateral=(e.x-u.x)*-dir.y+(e.y-u.y)*dir.x,side=Math.abs(lateral)>.04?Math.sign(lateral):e.id%2?1:-1,scatter=spearBraced?.1:braced?.45:this.unitClass(e)==='archer'?.9:this.unitClass(e)==='infantry'?.72:.45;
      const kickX=dir.x-dir.y*side*scatter,kickY=dir.y+dir.x*side*scatter,kickLength=Math.hypot(kickX,kickY);
      const duration=.5,kick=Math.min(11,distance*2/duration),blend=e.knockT>0?.6:1;
      // A successful spear block keeps its footing against the rest of the
      // company; it can still be killed or broken by other damage and flanking.
      if(spearBraced&&e.hp>0){e.knockVX=0;e.knockVY=0;e.knockT=0;e.knockDuration=0;}
      else{e.knockVX=(e.knockVX||0)*(1-blend)+kickX/kickLength*kick*blend;e.knockVY=(e.knockVY||0)*(1-blend)+kickY/kickLength*kick*blend;e.knockT=duration;e.knockDuration=duration;}
      if(this.unitClass(e)==='cavalry'&&e.charging)this.stopCharge(e);
      u.momentum=Math.max(0,u.momentum-cost);u.attackAnim=Math.max(u.attackAnim,.8);
      if(this.effects.length<220)this.effects.push({type:'chargeImpact',x:e.x,y:e.y,dx:dir.x,dy:dir.y,life:.48,maxLife:.48,team:u.team,strength:power});
      if(u.momentum<.18)this.stopCharge(u);
    }
    if(u.charging){u.momentum=Math.max(0,u.momentum-dt*.04);u.chargeElapsed+=dt;const end=u.chargeEnd,passed=end&&(u.x-end.x)*dir.x+(u.y-end.y)*dir.y>=0;if(u.momentum<.18||passed||u.chargeElapsed>4.5)this.stopCharge(u);}
  }
  isSpearBraced(u,chargeDir){
    const facing=u.braceDir;return !!(UNIT_DEFS[u.type].spearBrace&&u.hp>0&&this.formationSettled(u)&&(u.braceTime||0)>=.45&&u.knockT<=0&&Math.hypot(u.vx||0,u.vy||0)<.45&&facing&&facing.x*chargeDir.x+facing.y*chargeDir.y<-.45);
  }

  updateAftermath(dt){if(!this.paused&&Number.isFinite(dt)&&dt>0)this.aftermath.update(this.aftermath.time+dt);}
  update(dt){
    if(this.paused)return;dt=clamp(dt,0,.06);this.updateAftermath(dt);if(this.winner!==null)return;this.time+=dt;this.navigation.beginUpdate();this.hash.rebuild(this.units);this.vision?.update();
    for(const s of this.teams)if(s.alive){s.gold+=s.income*dt;if(s.id!==0){s.aiClock-=dt;if(s.aiClock<=0){this.ai(s);s.aiClock=this.aiRules.decision;}}
      if(s.heroTimer>0&&!this.mode.kingSurvival){s.heroTimer-=dt;if(s.heroTimer<=0){const keep=this.buildings.find(b=>b.team===s.id&&b.type==='keep'&&b.hp>0);if(keep){this.addUnit(s.id,'hero',keep.x+this.buildingRadius(keep)+.5,keep.y);this.event(`${s.name}'s commander returns.`,s.id);}}}
    }
    this.updateBuildings(dt);if(this.winner!==null)return;this.updateUnits(dt);if(this.winner!==null)return;this.updateProjectiles(dt);if(this.winner!==null)return;this.updateHouseEffects(dt);this.updateObjectives(dt);if(this.winner!==null)return;this.updateCastles(dt);this.teamOrders=this.teamOrders.filter(o=>o.expiresAt>this.time);
    for(const f of this.effects)f.life-=dt;this.effects=this.effects.filter(f=>f.life>0);if(this.effects.length>240)this.effects.splice(0,this.effects.length-240);
    this.captureClock+=dt;this.economyClock+=dt;this.cleanClock+=dt;
    if(this.captureClock>=.2){this.capture(this.captureClock);this.captureClock=0;}
    if(this.economyClock>=1){this.recount();this.checkVictory();this.economyClock=0;}
    if(this.cleanClock>=.4){this.units=this.units.filter(u=>u.hp>0);this.buildings=this.buildings.filter(b=>b.hp>0);for(const [id,e]of this.byId)if(e.hp<=0)this.byId.delete(id);this.cleanClock=0;}
  }

  updateBuildings(dt){
    for(const b of this.buildings){if(b.hp<=0)continue;const d=BUILD_DEFS[b.type],s=this.teams[b.team];b.hit=Math.max(0,b.hit-dt);b.cooldown-=dt;if(b.musterCooldown>0)b.musterCooldown=Math.max(0,b.musterCooldown-dt);
      if(d.unit&&houseCanRecruit(d.unit,s.sigil)){const training=this.trainingRate(b);b.spawnTimer+=dt*training;if(b.spawnTimer>=d.interval){if(s.count<s.cap&&!(b.musterCooldown>0)){this.spawnBatch(b,d.unit,d.batch);b.spawnTimer=0;}else b.spawnTimer=d.interval;}}
      const defense=b.type==='keep'?HALL_LEVELS[b.level||1]:b.type==='tower'?TOWER_LEVELS[b.level||1]:null;const falcon=s.sigil==='falcon'&&b.type==='tower',guard=falcon&&s.buffs.falconUntil>this.time,towerRange=(defense?.range||d.range||0)+(falcon?.7:0)+(guard?1.2:0);
      if(d.range&&b.cooldown<=0){let target=null,best=towerRange*towerRange;this.hash.visit(b.x,b.y,towerRange,u=>{if(this.hostile(u.team,b.team)&&u.hp>0&&this.isVisibleTo(b.team,u)){const dd=ds(b,u);if(dd<best&&this.combatTerrain.canShoot(b,u)){target=u;best=dd;}}});if(target){this.projectiles.push({sx:b.x,sy:b.y,x:b.x,y:b.y,tx:target.x,ty:target.y,t:0,duration:.34,type:'arrow',team:b.team,target:target.id,damage:(defense?.damage||d.damage)*this.upgradeMultiplier('weapons',s.upgrades.weapons),splash:0});b.cooldown=d.rate/(guard?1.4:1);}}
      if(b.type==='keep'&&b.hp<b.maxHp&&this.time%1<dt)b.hp=Math.min(b.maxHp,b.hp+2);
    }
  }
  updateUnits(dt){
    this.updateExpansionOrders();this.updatePatrolOrders();this.updateSpecialists(dt);
    for(const u of this.units){if(u.hp<=0)continue;const d=UNIT_DEFS[u.type];u.cooldown-=dt;u.seek-=dt;u.attackAnim=Math.max(0,u.attackAnim-dt*3.6);u.hit=Math.max(0,u.hit-dt);if(this.unitClass(u)==='cavalry')u.chargeCooldown=Math.max(0,(u.chargeCooldown||0)-dt);
      const team=this.teams[u.team],range=this.unitRange(u);if(u.target&&(u.target.hp<=0||!this.isVisibleTo(u.team,u.target))){u.target=null;u.seek=0;}
      if(d.lanceChampion&&u.championCyclePending){u.championCyclePending=false;this.regroupChampion(u);}
      if(u.championRegroup&&ds(u,u.championRegroup.rally)<.65**2&&u.chargeCooldown<=0){
        // Keep the original wave membership while withdrawing, then require a
        // fresh physical run-up on the resumed attack.
        const resume=u.championRegroup.resumeOrder,goal=this.config.fogOfWar?[...this.knownUnits(u.team),...this.knownBuildings(u.team)].find(e=>e.id===resume.aiTarget):this.byId.get(resume.aiTarget),stale=resume.aiTarget!=null&&(!goal||goal.hp<=0||!this.hostile(u.team,goal.team))||resume.aiOrder!=null&&!this.teamOrders.some(o=>o.id===resume.aiOrder&&o.expiresAt>this.time&&o.alliance===team.alliance);
        if(stale){this.idle([u.id]);u.order.aiTask='muster';}
        else{u.order={...resume};u.championRegroup=null;u.target=null;u.seek=0;}
      }
      if(d.setupSeconds){
        // Setup follows physical motion, including pushes and knockback; new
        // engines cannot fire on the frame they are created.
        const drift=Math.hypot(u.x-(u.setupX??u.x),u.y-(u.setupY??u.y)),moving=Math.hypot(u.vx||0,u.vy||0)>.03||u.knockT>0||drift>.003;
        u.setupProgress=moving?0:Math.min(d.setupSeconds,(u.setupProgress||0)+dt);u.setupX=u.x;u.setupY=u.y;
      }
      if(u.poisonUntil>this.time&&this.hostile(u.poisonTeam,u.team)){this.damage(u,3*dt,{team:u.poisonTeam});if(u.hp<=0)continue;}if(u.resolveUntil>this.time)u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.008*dt);
      if(d.spearBrace&&u.team!==0){
        // Rival spear factions prepare a line against an approaching gallop;
        // human spearmen follow the player's Hold order instead.
        let threat=null,nearest=5.2**2;this.hash.visit(u.x,u.y,5.2,e=>{if(!this.hostile(e.team,u.team)||e.hp<=0||!this.isVisibleTo(u.team,e)||this.unitClass(e)!=='cavalry'||e.order?.mode!=='attack'||(e.momentum||0)<.2)return;const dx=u.x-e.x,dy=u.y-e.y,distance=dx*dx+dy*dy,speed=Math.hypot(e.vx||0,e.vy||0);if(distance<nearest&&speed>.5&&((e.vx||0)*dx+(e.vy||0)*dy)/(speed*Math.sqrt(distance)||1)>.7){threat=e;nearest=distance;}});
        if(threat){u.spearThreatAt=this.time;if(u.order?.mode!=='hold'&&u.order?.aiTask!=='spearBrace'){u.spearResumeOrder=u.order?{...u.order}:null;this.hold([u.id]);const dx=threat.x-u.x,dy=threat.y-u.y,length=Math.hypot(dx,dy)||1;u.braceDir={x:dx/length,y:dy/length};u.order.aiTask='spearBrace';}}
        else if(u.order?.aiTask==='spearBrace'&&this.time-(u.spearThreatAt||0)>2){u.order=u.spearResumeOrder||{x:u.x,y:u.y,mode:'hold'};u.spearResumeOrder=null;u.braceDir=null;u.braceTime=0;}
      }
      if(!u.order)this.idle([u.id]);
      const order=u.order,mode=order.mode,locked=this.hasFacingOrder(u),autonomous=this.autonomousAggro(u);u.backpedaling=false;
      if(locked)this.turnFacing(u,order.facingX,order.facingY,dt);else if(d.spearBrace&&u.braceDir&&this.formationSettled(u))this.turnFacing(u,u.braceDir.x,u.braceDir.y,dt);
      if(d.spearBrace){
        const aligned=!locked||u.facingX*order.facingX+u.facingY*order.facingY>.985;
        if(this.formationSettled(u)&&aligned&&Math.hypot(u.vx||0,u.vy||0)<.45&&!(u.knockT>0)){
          if(locked)u.braceDir={x:u.facingX,y:u.facingY};
          const set=u.braceDir,ready=!set||u.facingX*set.x+u.facingY*set.y>.985;u.braceTime=ready?(u.braceTime||0)+dt:0;
        }else{u.braceTime=0;u.braceDir=null;}
      }
      const stagger=(u.knockT||0)>0;if(this.unitClass(u)==='cavalry'&&(mode!=='attack'||stagger&&u.charging))this.stopCharge(u);
      if(!u.target&&u.hit===0&&u.hp<u.maxHp){const recovery=this.recoveryRate(u,mode);if(this.tileAt(u.x,u.y)?.owner===u.team||u.houseAura&&(team.sigil==='bear'||team.sigil==='fish'))u.hp=Math.min(u.maxHp,u.hp+u.maxHp*recovery*dt);}
      if(!autonomous)u.aggroAnchor=null;
      if(autonomous){
        const anchor=u.aggroAnchor,leash=this.aggroRange(u)+2;
        if(anchor&&(ds(anchor,u)>leash*leash||u.target&&ds(anchor,u.target)>leash*leash)){u.target=null;anchor.returning=true;}
        if(u.target&&(!this.hostile(u.team,u.target.team)||!this.isVisibleTo(u.team,u.target)))u.target=null;
        if(u.target&&u.seek<=0){if(!this.canAggro(u,u.target))u.target=null;u.seek=.2+((u.id%7)*.018);}
        if(anchor?.returning&&ds(u,anchor)<.3**2){u.aggroAnchor=null;u.seek=0;}
        if(!u.target&&!u.aggroAnchor?.returning&&u.seek<=0){
          // A patrol anchors pursuit where contact began, independent of its
          // next waypoint. Keep the original order intact for resumption.
          u.aggroAnchor??=mode==='idle'?{x:order.x,y:order.y}:{x:u.x,y:u.y};
          u.target=this.findTarget(u);
          if(!u.target){if(anchor===u.aggroAnchor)u.aggroAnchor.returning=true;else u.aggroAnchor=null;}
          u.seek=.2+((u.id%7)*.018);
        }
      }else if(mode==='move'||mode==='expand')u.target=null;
      else if(u.seek<=0){u.target=this.findTarget(u);u.seek=.2+((u.id%7)*.018);}
      if(d.spearBrace&&this.formationSettled(u)&&!u.braceDir&&u.target){const dx=locked?u.facingX:u.target.x-u.x,dy=locked?u.facingY:u.target.y-u.y,length=Math.hypot(dx,dy)||1;u.braceDir={x:dx/length,y:dy/length};}
      let tx=u.x,ty=u.y,moving=false,target=u.target;
      if(!locked&&target&&(this.unitClass(u)!=='cavalry'||d.ranged)&&!(d.spearBrace&&u.braceDir))this.turnFacing(u,target.x-u.x,target.y-u.y,dt);
      if(target){const distance=Math.sqrt(ds(u,target)),extra=BUILD_DEFS[target.type]?this.buildingRadius(target):.07;
        const leash=mode==='hold'?range+1:6.5;if(distance>leash&&mode==='hold'){u.target=null;target=null;}
        else if(distance<=range+extra){if(u.cooldown<=0)this.attack(u,target);if(u.charging&&BUILD_DEFS[target.type])this.stopCharge(u);}
        else if(mode!=='hold'&&!locked){tx=target.x;ty=target.y;moving=true;}
      }
      if(!target&&order){const goal=u.aggroAnchor?.returning?u.aggroAnchor:order,distance=Math.hypot(goal.x-u.x,goal.y-u.y);if(distance>.16){tx=goal.x;ty=goal.y;moving=true;}}
      // A facing order is a deliberate formation march, never an invitation to
      // chase a flank target away from the ordered line or orderly withdrawal.
      if(locked&&order&&mode!=='hold'&&Math.hypot(order.x-u.x,order.y-u.y)>.16){tx=order.x;ty=order.y;moving=true;}
      if(team.sigil==='sun'&&this.isRanged(u)&&mode==='attack'){let danger=null,nearest=1.7**2;this.hash.visit(u.x,u.y,1.7,e=>{if(this.hostile(e.team,u.team)&&e.hp>0&&this.isVisibleTo(u.team,e)&&this.unitClass(e)!=='archer'&&this.unitClass(e)!=='siege'){const dd=ds(u,e);if(dd<nearest){nearest=dd;danger=e;}}});if(danger){const away=Math.sqrt(nearest)||1;tx=u.x+(u.x-danger.x)/away;ty=u.y+(u.y-danger.y)/away;moving=true;}}
      if(u.disciplineUntil>this.time&&mode==='attack'&&order&&Math.hypot(order.x-u.x,order.y-u.y)>.16){tx=order.x;ty=order.y;moving=true;}
      if(u.charging){tx=u.x+u.chargeDir.x;ty=u.y+u.chargeDir.y;moving=true;}
      if(moving&&!u.charging){const waypoint=this.navigation.steer(u,{x:tx,y:ty},this.unitClass(u));tx=waypoint.x;ty=waypoint.y;if(waypoint.blocked)moving=false;}
      let mx=0,my=0;
      if(moving){const dx=tx-u.x,dy=ty-u.y,len=Math.hypot(dx,dy)||1;let speed=d.speed*this.movementMultiplier(u)*this.specialistSpeed(u)*(d.lanceChampion&&mode==='move'?d.withdrawSpeed:1);
        if(d.lanceChampion&&mode==='move'){
          // Champions can work their way out of a melee, but a packed crowd
          // still slows the horse until it physically reaches clear ground.
          let crowd=0;this.hash.visit(u.x,u.y,1.1,o=>{if(o!==u&&o.hp>0){const distance=Math.sqrt(ds(u,o));if(distance<1.1)crowd+=1-distance/1.1;}});speed*=Math.max(.65,1-crowd*.08);
        }
        const tile=this.tileAt(u.x,u.y);speed/=tileTravelCost(tile,this.unitClass(u));if(tile?.terrain==='forest'&&u.pathsUntil>this.time){speed*=1.3*tileTravelCost(tile,this.unitClass(u));}if(u.rushUntil>this.time)speed*=1.15;if(u.poisonUntil>this.time)speed*=.84;
        // Attack marching pauses briefly to secure land; a pure move order never stops.
        // Riders need a genuine run-up across neutral ground and capture passively.
        if(this.unitClass(u)!=='cavalry'&&!['bridge','ford','pass'].includes(tile?.feature)&&!(u.rushUntil>this.time)&&!(u.disciplineUntil>this.time)&&!(u.pathsUntil>this.time&&tile?.terrain==='forest')&&!target&&mode==='attack'&&tile&&tile.owner!==u.team&&this.canCapture(tile,u.team)&&tile.capture<.95){speed*=.16;u.sweepWait=(u.sweepWait||0)+dt;if(u.sweepWait>3)speed=d.speed*.65;}
        else u.sweepWait=0;
        if(locked&&!u.charging){const alignment=(dx*u.facingX+dy*u.facingY)/len;if(alignment<-.25){speed*=.55;u.backpedaling=true;}else if(alignment<.5)speed*=.8;}
        if(u.charging)speed*=1+.85*u.momentum;if(stagger)speed*=.1;
        mx=dx/len*speed;my=dy/len*speed;
      }
      if(!locked&&!target&&this.unitClass(u)!=='cavalry'&&moving)this.turnFacing(u,mx,my,dt);
      if(this.unitClass(u)==='cavalry'){const motion=this.applyCavalryMotion(u,mx,my,dt,u.aggroAnchor?.returning?u.aggroAnchor:null);mx=motion.x;my=motion.y;}
      // Local avoidance is always active, including holding units and fighting front ranks.
      let pushX=0,pushY=0;
      this.hash.visit(u.x,u.y,.62,o=>{if(o===u||o.hp<=0)return;let dx=u.x-o.x,dy=u.y-o.y,dd=dx*dx+dy*dy;const min=d.radius+UNIT_DEFS[o.type].radius+.055;if(dd>=min*min)return;if(dd<.000001){const a=(u.id*2.399+o.id)*1.1;dx=Math.cos(a)*.001;dy=Math.sin(a)*.001;dd=.000001;}const distance=Math.sqrt(dd),force=(min-distance)/min*2.6*(u.charging&&this.hostile(o.team,u.team)?.12:d.lanceChampion&&mode==='move'?.4:1);pushX+=dx/distance*force;pushY+=dy/distance*force;});
      for(const b of this.buildings){if(b.hp<=0)continue;const rad=this.buildingRadius(b)+d.radius,dx=u.x-b.x,dy=u.y-b.y,dd=dx*dx+dy*dy;if(dd<rad*rad&&dd>.000001){const len=Math.sqrt(dd),force=(rad-len)/rad*3.5;pushX+=dx/len*force;pushY+=dy/len*force;}}
      mx+=pushX;my+=pushY;const speed=Math.hypot(mx,my),limit=(u.charging?d.speed*(1+.9*u.momentum):d.speed*1.3*(d.lanceChampion&&mode==='move'?d.withdrawSpeed:1))*this.specialistSpeed(u);if(speed>limit){mx*=limit/speed;my*=limit/speed;}
      if(stagger){const fade=u.knockT/(u.knockDuration||.34);mx+=(u.knockVX||0)*fade;my+=(u.knockVY||0)*fade;u.knockT=Math.max(0,u.knockT-dt);if(!u.knockT){u.knockVX=0;u.knockVY=0;}}
      const oldX=u.x,oldY=u.y;u.x+=mx*dt;u.y+=my*dt;this.bound(u);
      if(this.navigation.constrain(u,oldX,oldY)&&u.charging)this.stopCharge(u);
      if(u.charging){this.chargeContact(u,oldX,oldY,dt);this.navigation.constrain(u,oldX,oldY);}
      u.vx=(u.x-oldX)/dt;u.vy=(u.y-oldY)/dt;
      const actual=Math.hypot(u.vx,u.vy);if(d.stationaryReload)u.stationaryTime=actual>.03||stagger?0:(u.stationaryTime||0)+dt;u.phase+=actual*dt*9;if(d.setupSeconds&&actual>.03)u.setupProgress=0;
      if(this.unitClass(u)==='cavalry'){
        if(!u.charging){
          if(!d.noCharge&&mode==='attack'&&moving&&!stagger&&u.chargeCooldown<=0&&actual>d.speed*.75&&(!locked||(u.vx*u.facingX+u.vy*u.facingY)/actual>.8)){
            const nx=u.vx/actual,ny=u.vy/actual,dot=nx*u.chargeDir.x+ny*u.chargeDir.y;
            const preparation=(team.sigil==='wolf'?.8:1)*(u.stormUntil>this.time?1.5:1);if(dot>.92){u.chargeRunup+=dt*preparation;u.chargeTravel+=actual*dt;}else{u.chargeRunup=dt*preparation;u.chargeTravel=actual*dt;}
            u.chargeDir={x:nx,y:ny};u.momentum=clamp(u.chargeRunup/1.25,0,1)*clamp(u.chargeTravel/2.6,0,1);
            const travelNeeded=u.stormUntil>this.time?2.1:2.6;if(u.stormUntil>this.time)u.momentum=clamp(u.chargeRunup/1.25,0,1)*clamp(u.chargeTravel/travelNeeded,0,1);if(u.chargeRunup>=1.2&&u.chargeTravel>=travelNeeded&&u.momentum>=.85&&target&&!BUILD_DEFS[target.type])this.beginCharge(u,target);
          }else{u.chargeRunup=0;u.chargeTravel=0;u.momentum=Math.max(0,u.momentum-dt*1.6);}
        }
        u.charge=u.momentum;u.chargeSpeed=u.charging?actual:0;
      }
      if(mode==='move'&&u.order===order&&Math.hypot(u.x-order.x,u.y-order.y)<.22){order.mode=locked?'hold':'idle';u.aggroAnchor=null;u.seek=0;u.target=null;}
    }
    // Symmetric positional relaxation prevents front ranks from occupying the same ground.
    this.hash.rebuild(this.units);
    for(const u of this.units){if(u.hp<=0)continue;this.hash.visit(u.x,u.y,.52,o=>{if(o.id<=u.id||o.hp<=0)return;let dx=u.x-o.x,dy=u.y-o.y,dd=dx*dx+dy*dy,min=(UNIT_DEFS[u.type].radius+UNIT_DEFS[o.type].radius)*.92;if(dd>=min*min)return;if(dd<.0000001){dx=.0001*Math.cos(u.id);dy=.0001*Math.sin(u.id);dd=dx*dx+dy*dy;}const len=Math.sqrt(dd),shift=Math.min(.055,(min-len)*.4);
      // A struck fighter is deflected out of the rider's lane, rather than
      // becoming an unlimited forward-moving bulldozer for the whole charge.
      const horse=this.hostile(u.team,o.team)?(u.charging?u:o.charging?o:null):null,foe=horse===u?o:u;
      const ux=u.x,uy=u.y,ox=o.x,oy=o.y;
      if(horse&&foe.knockT>0&&(horse.chargeHits.get(foe.id)??-Infinity)>this.time-.5){const dir=horse.chargeDir,lateral=(foe.x-horse.x)*-dir.y+(foe.y-horse.y)*dir.x,side=Math.abs(lateral)>.03?Math.sign(lateral):foe.id%2?1:-1;foe.x-=dir.y*side*shift*2;foe.y+=dir.x*side*shift*2;this.bound(foe);this.navigation.constrain(foe,foe===u?ux:ox,foe===u?uy:oy);return;}
      dx=dx/len*shift;dy=dy/len*shift;const pullingU=!!UNIT_DEFS[u.type].lanceChampion&&u.order?.mode==='move',pullingO=!!UNIT_DEFS[o.type].lanceChampion&&o.order?.mode==='move',weight=pullingU!==pullingO?(pullingU?.2:.8):this.hostile(u.team,o.team)?(u.charging?.2:o.charging?.8:.5):.5;u.x+=dx*weight*2;u.y+=dy*weight*2;o.x-=dx*(1-weight)*2;o.y-=dy*(1-weight)*2;this.bound(u);this.bound(o);this.navigation.constrain(u,ux,uy);this.navigation.constrain(o,ox,oy);});}
  }

  updateProjectiles(dt){
    for(const p of this.projectiles){p.t+=dt;const t=Math.min(1,p.t/p.duration);p.x=p.sx+(p.tx-p.sx)*t;p.y=p.sy+(p.ty-p.sy)*t;if(p.t<p.duration)continue;
      const source={team:p.team,type:p.sourceType,sourceId:p.sourceId,held:p.held,weaponScale:p.weaponScale,impactKind:'weapon',projectileType:p.type,originX:p.sx,originY:p.sy};if(p.piercing){this.houseProjectileImpact(p);this.ballistaImpact(p);}else if(p.splash){this.houseProjectileImpact(p);this.siegeImpact(p);}
      else{const target=this.byId.get(p.target);if(target&&target.hp>0&&this.combatTerrain.canShoot({x:p.sx,y:p.sy},target)){this.houseProjectileImpact(p);this.damage(target,p.damage,source);}if(this.effects.length<180&&this.random()<.2)this.effects.push({x:p.tx,y:p.ty,type:'hit',life:.18,maxLife:.18,team:p.team});}
    }
    this.projectiles=this.projectiles.filter(p=>p.t<p.duration);
  }
  canPlanCapture(tile,team,owners){
    if(!owners)return this.canCapture(tile,team);
    const x=tile.x,y=tile.y,index=y*this.W+x,owner=owners[index];if(owner===team)return true;if(this.allied(owner,team))return false;
    return x>0&&this.allied(owners[index-1],team)||x<this.W-1&&this.allied(owners[index+1],team)||y>0&&this.allied(owners[index-this.W],team)||y<this.H-1&&this.allied(owners[index+this.W],team);
  }
  canCapture(tile,team){if(tile.owner===team)return true;if(this.allied(tile.owner,team))return false;const x=tile.x,y=tile.y;return (x>0&&this.allied(this.tiles[y*this.W+x-1].owner,team))||(x<this.W-1&&this.allied(this.tiles[y*this.W+x+1].owner,team))||(y>0&&this.allied(this.tiles[(y-1)*this.W+x].owner,team))||(y<this.H-1&&this.allied(this.tiles[(y+1)*this.W+x].owner,team));}
  capture(dt){
    const len=this.tiles.length,power=this.capturePower;power.fill(0);
    // Only occupied or decaying tiles need faction comparisons. Keep ascending
    // tile order so connected captures and seeded rewards match the full scan.
    const marked=this.captureMarked?.length===len?this.captureMarked:(this.captureMarked=new Uint8Array(len)),touched=this.captureTouched;touched.length=0;marked.fill(0);
    for(const u of this.units){if(u.hp<=0)continue;const x=Math.floor(u.x),y=Math.floor(u.y),strength=this.unitClass(u)==='hero'?1.7:1;for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){if(xx<1||yy<1||xx>=this.W-1||yy>=this.H-1)continue;const dd=(u.x-(xx+.5))**2+(u.y-(yy+.5))**2;if(dd<1.3){const i=yy*this.W+xx;power[u.team*len+i]+=strength*Math.max(.15,1-dd*.65);if(!marked[i]){marked[i]=1;touched.push(i);}}}}
    for(let i=0;i<len;i++){const tile=this.tiles[i];if(!isPassableTile(tile))continue;if(tile.capture>0&&!marked[i])touched.push(i);else if(!marked[i]&&tile.capture===0)tile.claim=-1;}
    touched.sort((a,b)=>a-b);
    const alliancePower=Array(this.objectiveScores.length).fill(0);
    for(const i of touched){const tile=this.tiles[i];if(!isPassableTile(tile))continue;alliancePower.fill(0);let best=-1,max=0,second=0,strongest=0;
      for(let t=0;t<this.teams.length;t++)if(this.teams[t].alive)alliancePower[this.teams[t].alliance]+=power[t*len+i];
      let leading=-1;for(let a=0;a<alliancePower.length;a++){const v=alliancePower[a];if(v>max){second=max;max=v;leading=a;}else if(v>second)second=v;}
      for(let t=0;t<this.teams.length;t++)if(this.teams[t].alive&&this.teams[t].alliance===leading&&power[t*len+i]>strongest){best=t;strongest=power[t*len+i];}
      if(best<0||max<.12||max<=second*1.15||best===tile.owner||!this.canCapture(tile,best)){tile.capture=Math.max(0,tile.capture-dt*.16);if(tile.capture===0)tile.claim=-1;continue;}
      if(tile.claim!==best){tile.capture=Math.max(0,tile.capture-dt*.55);if(tile.capture>0)continue;tile.claim=best;}
      const rate=(tile.owner===-1?.39:.24)*Math.min(2.1,Math.sqrt(Math.max(.1,max-second*.75)));tile.capture+=dt*rate;
      if(tile.capture>=1){const previous=tile.owner;if(previous>=0&&previous!==best&&this.teams[best].sigil==='kraken'&&!((tile.raidMask||0)&(1<<best))){tile.raidMask=(tile.raidMask||0)|(1<<best);this.teams[best].gold+=6;}tile.owner=best;tile.capture=0;tile.claim=-1;if(best===0)this.stats.captured++;if(this.random()<.08&&this.effects.length<180)this.effects.push({x:tile.x+.5,y:tile.y+.5,type:'capture',life:.6,maxLife:.6,team:best});}
    }
  }
  recount(){
    for(const s of this.teams){s.tiles=0;s.count=0;s.value=0;s.banners=0;s.keeps=0;}
    for(const t of this.tiles)if(t.owner>=0){this.teams[t.owner].tiles++;this.teams[t.owner].value+=t.value;}
    for(const u of this.units)if(u.hp>0)this.teams[u.team].count++;
    for(let y=1;y<this.H-4;y+=4)for(let x=1;x<this.W-4;x+=4){const team=this.tiles[y*this.W+x].owner;if(team<0)continue;let owned=true;for(let yy=y;yy<y+4&&owned;yy++)for(let xx=x;xx<x+4;xx++)if(this.tiles[yy*this.W+xx].owner!==team){owned=false;break;}if(owned)this.teams[team].banners++;}
    for(const b of this.buildings)if(b.type==='keep'&&b.hp>0)this.teams[b.team].keeps++;
    // The starting castle is included in 280; only additional standing castles raise army capacity.
    for(const s of this.teams){s.cap=280+Math.max(0,s.keeps-1)*60;s.income=this.incomeFor(s.id);}
  }
  checkVictory(){
    if(this.winner!==null)return;
    for(const s of this.teams)if(s.alive&&(this.mode.kingSurvival?!this.kingFor(s.id):!this.buildings.some(b=>b.team===s.id&&b.type==='keep'&&b.hp>0))){this.eliminate(s.id,this.mode.kingSurvival?'king':'castle');if(this.winner!==null)return;}
    const alive=this.teams.filter(s=>s.alive);
    if(!this.teams[0].alive){this.winner=alive.find(s=>this.hostile(s.id,0))?.id??this.teams.find(s=>this.hostile(s.id,0))?.id??-1;this.victoryReason=this.mode.kingSurvival?'Your king was slain':'Your last castle was destroyed';return;}
    const alliances=new Set(alive.map(s=>s.alliance));if(alliances.size===1&&alive.length){this.winner=alive.find(s=>s.id===0)?.id??alive[0].id;this.victoryReason=this.mode.kingSurvival?'All rival kings defeated':'All rival castles destroyed';this.event(`${alive[0].teamName} rules the realm.`,this.winner);return;}
    if(this.mode.id.endsWith('dominion')&&this.time>90){const territory=Array(this.objectiveScores.length).fill(0);for(const s of alive)territory[s.alliance]+=s.tiles;const alliance=territory.findIndex(n=>n/this.playable>=.65);if(alliance>=0){this.winner=alive.find(s=>s.id===0&&s.alliance===alliance)?.id??alive.find(s=>s.alliance===alliance).id;this.victoryReason='Controls 65% of the realm';this.event(`${this.teams[this.winner].teamName} controls the realm.`,this.winner);}}
  }

  aiPlanFor(s){
    if(s.aiPlan)return s.aiPlan;
    const styles={wolf:'defensive',lion:'mass',dragon:'siege',stag:'raider',rose:'objective',sun:'raider',kraken:'raider',falcon:'defensive',flayed:'mass',bridge:'mass',bear:'defensive',fish:'objective',frog:'raider',beacon:'siege',huntsman:'siege',bone:'mass'};
    const plans={
      mass:{label:'Grand host',fraction:.76,reserve:.18,min:38,rest:34,opening:1,expansion:.14},
      raider:{label:'Flanking raiders',fraction:.5,reserve:.2,min:20,rest:25,opening:.85,expansion:.24},
      siege:{label:'Siege column',fraction:.68,reserve:.22,min:34,rest:42,opening:1.3,expansion:.16},
      defensive:{label:'Bastion & counterattack',fraction:.56,reserve:.3,min:34,rest:42,opening:1.65,expansion:.18},
      objective:{label:'Banner guard',fraction:.6,reserve:.2,min:28,rest:30,opening:1.05,expansion:.18}
    };
    const style=typeof s.strategy==='string'&&plans[s.strategy]?s.strategy:styles[s.sigil]||'mass';
    s.strategy=style;
    s.aiPlan={...plans[style],rest:plans[style].rest*this.aiRules.assaultEvery/24,fraction:clamp(plans[style].fraction+(this.aiRules.force-.62)*.2,.35,.86),style,phase:'muster',cohort:[],nextAttackAt:this.aiRules.firstAssault*plans[style].opening+s.id*1.1,startedAt:this.time,economyAt:0,frontierAt:0,coordinationId:null};
    return s.aiPlan;
  }
  aiIssue(troops,point,mode,task,extra={}){
    if(!troops.length)return;
    this.command(troops.map(u=>u.id),point.x,point.y,mode,task==='raid'?'spread':'line');
    for(const u of troops)if(u.order)Object.assign(u.order,{aiTask:task,...extra});
  }
  aiTaskOf(u){return u.order?.aiTask==='spearBrace'?u.spearResumeOrder?.aiTask:u.order?.aiTask;}
  aiFogTarget(s,plan){
    const buildings=this.knownBuildings(s.id),enemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team));
    const candidates=buildings.filter(b=>b.hp>0&&this.hostile(s.id,b.team)&&(b.type==='keep'||plan.style==='raider'&&BUILD_DEFS[b.type]?.unit));
    let best=null,score=Infinity;
    for(const b of candidates){
      const route=this.navigation.route(s.home,b,plan.style==='raider'?'cavalry':plan.style==='siege'?'siege':'infantry');if(!route.reachable)continue;
      const guards=enemies.filter(u=>this.allied(u.team,b.team)&&ds(u,b)<100).reduce((n,u)=>n+(this.unitClass(u)==='siege'?2:this.unitClass(u)==='hero'?3:1),0),forts=buildings.filter(f=>f.hp>0&&this.hostile(s.id,f.team)&&f.type==='tower'&&ds(f,b)<81).length;
      const value=route.cost+guards*(plan.style==='siege'?.65:1.5)+forts*(plan.style==='siege'?3:9)+(b.hp/Math.max(1,b.maxHp))*14+(b.remembered?4:0)+(plan.style==='raider'?(b.type==='keep'?22:-18):0);
      if(value<score-1e-7||Math.abs(value-score)<1e-7&&b.id<best?.id){best=b;score=value;plan.targetRoute={distance:route.distance,cost:route.cost,crossings:route.crossings};}
    }
    return best;
  }
  aiFogCastleTarget(s){
    const enemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team));let best=null,score=Infinity;
    for(const site of this.knownCastleSites(s.id)){
      if(!site.ruined)continue;const route=this.navigation.route(s.home,site);if(!route.reachable)continue;
      const danger=enemies.filter(u=>ds(u,site)<81).length,value=route.cost+danger*1.7-(site.progress?.[s.alliance]||0)*.8;
      if(value<score){best=site;score=value;}
    }return best;
  }
  aiFogProductionSite(s,type){
    if(type==='tower'){const watch=this.aiFogTowerSite(s);return watch?{x:watch.x,y:watch.y}:null;}
    const d=BUILD_DEFS[type],buildings=this.knownBuildings(s.id).filter(b=>b.hp>0),sites=this.knownCastleSites(s.id),enemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team)),owners=this.vision?.ownersFor(s.id);let best=null,score=Infinity;
    for(const tile of this.tiles){
      if((owners?.[tile.y*this.W+tile.x]??tile.owner)!==s.id||!isPassableTile(tile))continue;const p={x:tile.x+.5,y:tile.y+.5};
      if(!this.buildingGround(type,p.x,p.y)||buildings.some(b=>ds(b,p)<(this.buildingRadius(b)+d.radius+.45)**2)||sites.some(c=>c.ruined&&ds(c,p)<(BUILD_DEFS.keep.radius+d.radius+.45)**2)||enemies.some(u=>ds(u,p)<(this.unitClass(u)==='siege'?8:6.5)**2))continue;
      if(buildings.some(b=>this.hostile(s.id,b.team)&&['keep','tower'].includes(b.type)&&ds(b,p)<((b.type==='keep'?5.5+(b.level||1)*.5:4.6+(b.level||1)*.5)+d.radius+1)**2))continue;
      const value=ds(p,s.home)*.02+(tile.terrain==='forest'?.2:0);if(value<score){best=p;score=value;}
    }return best;
  }
  aiFogTowerSite(s){
    const plan=this.aiPlanFor(s);if(plan.watchSiteAt>this.time)return plan.watchSite;
    const buildings=this.knownBuildings(s.id).filter(b=>b.hp>0),sites=this.knownCastleSites(s.id),enemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team)),watch=buildings.filter(b=>this.allied(s.id,b.team)&&['keep','tower'].includes(b.type)),grid=this.vision?.gridFor(s.id),owners=this.vision?.ownersFor(s.id),radius=12;let best=null,score=-Infinity;
    for(const tile of this.tiles){
      if((owners?.[tile.y*this.W+tile.x]??tile.owner)!==s.id||tile.x%2||tile.y%2||!isPassableTile(tile))continue;const p={x:tile.x+.5,y:tile.y+.5};
      if(!this.buildingGround('tower',p.x,p.y)||watch.some(b=>ds(b,p)<(b.type==='tower'?10:8)**2)||buildings.some(b=>ds(b,p)<(this.buildingRadius(b)+BUILD_DEFS.tower.radius+.45)**2)||sites.some(c=>c.ruined&&ds(c,p)<(BUILD_DEFS.keep.radius+BUILD_DEFS.tower.radius+.45)**2)||enemies.some(u=>ds(u,p)<64))continue;
      let gain=0;for(let yy=-radius;yy<=radius;yy+=4)for(let xx=-radius;xx<=radius;xx+=4){if(xx*xx+yy*yy>radius*radius)continue;const t=this.tileAt(p.x+xx,p.y+yy);if(t&&isPassableTile(t)&&!grid?.[t.y*this.W+t.x])gain++;}
      const value=gain-ds(p,s.home)*.002+(tile.terrain==='hill'?2:0);if(gain>=8&&value>score){score=value;best={...p,gain};}
    }
    plan.watchSiteAt=this.time+5;plan.watchSite=best;return best;
  }
  aiFogScoutGoal(s,plan,scout,index=0){
    const explored=this.vision?.exploredFor(s.id),visible=this.vision?.gridFor(s.id),visits=plan.scoutVisits||{},style=plan.scoutStyle,candidates=[];let best=null;
    const points=[];for(let y=5;y<this.H-4;y+=8)for(let x=5;x<this.W-4;x+=8)points.push({x:x+.5,y:y+.5});
    if(style==='crossing survey')for(const l of this.landmarks||[])if(['bridge','ford','pass'].includes(l.kind))points.push({x:l.x,y:l.y,landmark:true});
    for(const p of points){
      if(!this.isWalkable(p.x,p.y)||ds(p,scout)<16)continue;const tile=this.tileAt(p.x,p.y),i=tile.y*this.W+tile.x;if(visible?.[i])continue;
      const distance=Math.sqrt(ds(p,scout)),homeDistance=Math.sqrt(ds(p,s.home)),angle=Math.atan2(p.y-s.home.y,p.x-s.home.x),sector=Math.cos(angle-(s.id+index)*2.399963),last=visits[i]??-1e6;
      const value=(explored?.[i]?0:35)+Math.min(18,(this.time-last)*.05)+(style==='deep probes'?homeDistance*.16:style==='crossing survey'&&p.landmark?25:sector*12)-distance*(style==='deep probes'?.3:style==='cautious survey'?1:.65);
      candidates.push({point:p,score:value});
    }
    // Rank public geography cheaply, then route only a bounded shortlist.
    // Large maps must not run a path search for every improving candidate.
    candidates.sort((a,b)=>b.score-a.score);
    for(const candidate of candidates.slice(0,8))if(this.navigation.route(scout,candidate.point,this.unitClass(scout)).reachable){best=candidate.point;break;}
    if(best){const tile=this.tileAt(best.x,best.y);plan.scoutVisits={...visits,[tile.y*this.W+tile.x]:this.time};}
    return best;
  }
  aiFogScouts(s,plan,army,committed,danger=false){
    const styles={defensive:'border screen',raider:'deep probes',objective:'crossing survey',siege:'cautious survey',mass:'fan sweep'};plan.scoutStyle=this.mode.kingSurvival?'royal reconnaissance':styles[plan.style]||'fan sweep';
    let scouts=army.filter(u=>this.aiTaskOf(u)==='scout');for(const u of scouts)committed.add(u.id);
    if(danger)return;
    const desired=plan.style==='defensive'?2:plan.style==='raider'?4:3;
    if(scouts.length<desired&&this.time>=(plan.scoutAt||0)){
      const candidates=army.filter(u=>!committed.has(u.id)&&u.hp>u.maxHp*.65&&['cavalry','infantry'].includes(this.unitClass(u))&&!['assault','raid','objective','team','retreat'].includes(this.aiTaskOf(u))).sort((a,b)=>(this.unitClass(a)==='cavalry'?0:1)-(this.unitClass(b)==='cavalry'?0:1)||a.id-b.id).slice(0,desired-scouts.length);
      for(const u of candidates){
        if(plan.style==='defensive'&&!this.mode.kingSurvival&&this.patrol&&this.unitClass(u)==='cavalry'){const result=this.patrol([u.id],s.id);if(result?.ok&&u.order)u.order.aiTask='scout';else continue;}
        else{const point=this.aiFogScoutGoal(s,plan,u,scouts.length);if(!point)continue;this.aiIssue([u],point,'move','scout');}
        committed.add(u.id);scouts.push(u);
      }plan.scoutAt=this.time+12;
    }
    const enemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team));
    for(let i=0;i<scouts.length;i++){
      const u=scouts[i];if(u.hp<u.maxHp*.4||enemies.filter(e=>ds(e,u)<25).length>=4){this.aiIssue([u],s.home,'move','retreat');continue;}
      if(u.order?.mode==='patrol')continue;
      if(ds(u,u.order||u)<2.25||u.order?.mode==='hold'){const point=this.aiFogScoutGoal(s,plan,u,i);if(point)this.aiIssue([u],point,'move','scout');}
    }
    plan.scouting={style:plan.scoutStyle,count:scouts.length};
  }
  aiCastleTarget(s){
    if(this.config.fogOfWar)return this.aiFogCastleTarget(s);
    let best=null,score=Infinity;
    for(const site of this.castles){
      if(!site.ruined)continue;const route=this.navigation.route(s.home,site);if(!route.reachable)continue;
      let enemies=0,allies=0;this.hash.visit(site.x,site.y,9,u=>{if(u.hp<=0||ds(u,site)>81)return;if(this.hostile(s.id,u.team))enemies++;else if(u.team!==s.id&&this.allied(s.id,u.team))allies++;});
      // Existing progress makes staying with a siege worthwhile; avoid sending
      // another allied army to an uncontested ruin already being restored.
      const value=route.cost+enemies*1.7+allies*.4-(site.progress[s.alliance]||0)*.8;
      if(value<score){score=value;best=site;}
    }
    return best;
  }
  aiTarget(s,plan){
    if(this.config.fogOfWar)return this.aiFogTarget(s,plan);
    const candidates=this.buildings.filter(b=>b.hp>0&&this.teams[b.team]?.alive&&this.hostile(s.id,b.team)&&(b.type==='keep'||plan.style==='raider'&&!!BUILD_DEFS[b.type].unit));
    if(!candidates.length)return null;
    const leader=Math.max(1,...this.teams.filter(t=>t.alive&&this.hostile(s.id,t.id)).map(t=>t.tiles||0));
    // Waves muster at home; a remote foothold can support an invasion, but cannot erase its march.
    const frontier=[s.home],borders=new Map(),pressure=new Map();
    for(const tile of this.tiles){
      if(tile.owner!==s.id||!isPassableTile(tile))continue;
      let edge=false;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const x=tile.x+dx,y=tile.y+dy;if(x<0||y<0||x>=this.W||y>=this.H)continue;
        const next=this.tiles[y*this.W+x];if(!isPassableTile(next)||this.allied(s.id,next.owner))continue;
        edge=true;
        if(this.teams[next.owner]?.alive&&this.hostile(s.id,next.owner)){const alliance=this.teams[next.owner].alliance;borders.set(alliance,(borders.get(alliance)||0)+1);}
      }
      if(edge)frontier.push({x:tile.x+.5,y:tile.y+.5});
    }
    // Independent rivals avoid piling onto an already contested front. Allied joint assaults stay useful.
    for(const rival of this.teams){
      const wave=rival.aiPlan,goal=this.byId.get(wave?.targetId);
      if(!rival.alive||!this.hostile(s.id,rival.id)||wave?.phase!=='advance'||!goal||goal.hp<=0||!this.teams[goal.team]?.alive||!this.hostile(rival.id,goal.team)||this.time-wave.startedAt>wave.timeout)continue;
      const troops=(wave.cohort||[]).filter(id=>{const u=this.byId.get(id);return u?.hp>0&&u.team===rival.id&&['assault','raid'].includes(this.aiTaskOf(u));}).length;
      if(troops){const alliance=this.teams[goal.team].alliance;pressure.set(alliance,(pressure.get(alliance)||0)+Math.min(1,troops/Math.max(1,wave.initialSize||wave.cohort.length)));}
    }
    const forts=this.buildings.filter(b=>b.hp>0&&this.teams[b.team]?.alive&&this.hostile(s.id,b.team)&&['keep','tower'].includes(b.type));
    let target=null,best=Infinity,bestTie=Infinity;
    for(const b of candidates){
      const route=this.navigation.route(s.home,b,plan.style==='raider'?'cavalry':plan.style==='siege'?'siege':'infantry');if(!route.reachable)continue;
      let guards=0,retaliation=0;this.hash.visit(b.x,b.y,10,u=>{if(u.hp>0&&this.allied(u.team,b.team)&&ds(u,b)<100)guards+=this.unitClass(u)==='siege'?2:this.unitClass(u)==='hero'?3:1;});
      this.hash.visit(s.home.x,s.home.y,13,u=>{if(u.hp>0&&u.team===b.team&&ds(u,s.home)<169)retaliation++;});
      const towers=this.buildings.filter(p=>p.hp>0&&this.allied(p.team,b.team)&&p.type==='tower'&&ds(p,b)<81).length;
      const distance=Math.sqrt(ds(b,s.home)),vulnerability=b.hp/b.maxHp;
      let frontierDistance=distance;for(const point of frontier)frontierDistance=Math.min(frontierDistance,Math.sqrt(ds(b,point)));
      const alliance=this.teams[b.team].alliance,samples=Math.max(1,route.points.length);let crossings=0;
      for(const point of route.points){const tile=this.tileAt(point.x,point.y);if(tile&&this.teams[tile.owner]?.alive&&this.hostile(s.id,tile.owner)&&!this.allied(tile.owner,b.team))crossings++;}
      let routeForts=0;const exposed=new Set();
      for(const crossing of route.crossings)this.hash.visit(crossing.x,crossing.y,6,u=>{if(u.hp>0&&this.hostile(s.id,u.team)&&ds(u,crossing)<36)exposed.add(u.id);});
      for(const fort of forts){
        if(ds(fort,b)<100)continue;
        const range=fort.type==='keep'?this.townHallDetails(fort.team).range:this.towerDetails(fort.id,fort.team).range;
        if(route.points.some(point=>ds(fort,point)<(range+1)**2))routeForts+=fort.type==='keep'?8:5;
      }
      const geography=route.cost+frontierDistance*.3-Math.min(10,Math.sqrt(borders.get(alliance)||0)*2)+crossings/samples*20+Math.min(24,routeForts)+Math.min(24,exposed.size*(plan.style==='siege'?.4:1));
      let score=geography+guards*(plan.style==='siege'?.65:1.5)+towers*(plan.style==='siege'?3:9)+vulnerability*22-Math.min(12,retaliation*1.5)-(this.teams[b.team].tiles||0)/leader*12+Math.min(16,(pressure.get(alliance)||0)*8);
      if(plan.style==='raider'){score+=b.type==='keep'?22:-18;score+=guards*.5;}
      if(b.type==='keep')score-=this.teams[b.team].keeps<=1?12:8;
      // Stable seeded ties neither favor the first-created (player) building nor change on every decision.
      let tie=(Number(this.config.seed)||44277)^Math.imul(s.id+1,0x9e3779b1)^Math.imul(b.id,0x85ebca6b);tie=Math.imul(tie^(tie>>>16),0x7feb352d);tie=Math.imul(tie^(tie>>>15),0x846ca68b);tie=(tie^(tie>>>16))>>>0;
      if(score<best-1e-7||Math.abs(score-best)<=1e-7&&tie<bestTie){best=score;bestTie=tie;target=b;plan.targetRoute={distance:route.distance,cost:route.cost,crossings:route.crossings};}
    }
    return target;
  }
  aiProductionPlan(s,plan,army,threatened){
    const owned=this.buildings.filter(b=>b.hp>0&&b.team===s.id),content=this.houseContent(s.id),kinds=['infantry','archer','cavalry','siege'],weights={infantry:1,archer:1.05,cavalry:1.35,siege:3.2};
    const profiles={mass:[.57,.27,.11,.05],raider:[.32,.23,.4,.05],siege:[.4,.3,.12,.18],defensive:[.5,.35,.1,.05],objective:[.4,.39,.16,.05]};
    const ratios=Object.fromEntries(kinds.map((k,i)=>[k,(profiles[plan.style]||profiles.mass)[i]])),counts=Object.fromEntries(kinds.map(k=>[k,0])),throughput={...counts},sites={};
    for(const u of army){const kind=this.unitClass(u);if(kind in counts)counts[kind]+=weights[kind];}
    for(const b of owned){sites[b.type]=(sites[b.type]||0)+1;const d=BUILD_DEFS[b.type],kind=this.unitClass(d.unit);if(d.unit&&kind in throughput)throughput[kind]+=d.batch/d.interval*this.trainingRate(b)*weights[kind];}
    // Coarse scout coverage remembers what our troops and outposts could actually observe.
    const sight=new Set();for(const p of [...army,...owned]){const x=Math.floor(p.x/8),y=Math.floor(p.y/8);for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)sight.add(`${x+xx},${y+yy}`);}
    const mix={...Object.fromEntries(kinds.map(k=>[k,0]))};let observed=0,forts=0;
    for(const u of (this.config.fogOfWar?this.knownUnits(s.id):this.units))if(u.hp>0&&this.hostile(s.id,u.team)&&(this.config.fogOfWar||sight.has(`${Math.floor(u.x/8)},${Math.floor(u.y/8)}`))){const k=this.unitClass(u);if(k in mix){mix[k]++;observed++;}}
    for(const b of (this.config.fogOfWar?this.knownBuildings(s.id):this.buildings))if(b.hp>0&&this.hostile(s.id,b.team)&&['keep','tower'].includes(b.type)&&(this.config.fogOfWar||sight.has(`${Math.floor(b.x/8)},${Math.floor(b.y/8)}`)))forts++;
    if(observed||forts)plan.productionIntel={mix,observed,forts,until:this.time+45};
    const intel=plan.productionIntel?.until>=this.time?plan.productionIntel:{mix,observed,forts};let counter='';
    if(intel.observed>=6){
      if(intel.mix.archer/intel.observed>.4){ratios.cavalry+=.18;ratios.infantry-=.1;ratios.archer-=.08;counter='archers';}
      else if(intel.mix.cavalry/intel.observed>.32){ratios.infantry+=.17;ratios.cavalry-=.1;ratios.archer-=.07;counter='cavalry';}
      else if(intel.mix.infantry/intel.observed>.55){ratios.archer+=.15;ratios.infantry-=.12;ratios.cavalry-=.03;counter='infantry';}
      else if(intel.mix.siege/intel.observed>.12){ratios.cavalry+=.12;ratios.infantry-=.06;ratios.archer-=.06;counter='artillery';}
    }
    if(intel.forts>=2){ratios.siege+=.09;ratios.infantry-=.05;ratios.archer-=.04;if(!counter)counter='forts';}
    const sum=kinds.reduce((n,k)=>n+Math.max(.03,ratios[k]),0);for(const k of kinds)ratios[k]=Math.max(.03,ratios[k])/sum;
    const previousIds=plan.productionArmyIds||[],elapsed=Math.max(1,this.time-(plan.productionSampleAt??this.time-8)),lost=previousIds.filter(id=>!this.byId.get(id)||this.byId.get(id).hp<=0).length;
    plan.productionLossRate=(plan.productionLossRate||0)*.65+lost/elapsed*.35;plan.productionSampleAt=this.time;plan.productionArmyIds=army.map(u=>u.id);
    const spare=Math.max(0,s.cap-army.length),income=Math.max(0,s.income||this.incomeFor(s.id)),desired=Math.min(s.cap/24,.65+Math.sqrt(Math.max(0,s.tiles))/28+income*.12+plan.productionLossRate*1.5),current=kinds.reduce((n,k)=>n+throughput[k],0);
    const total=owned.filter(b=>b.type!=='keep'&&BUILD_DEFS[b.type].unit).length,slots=this.buildingStatus(s.id),value=kinds.reduce((n,k)=>n+counts[k],0),forceValue=value+spare*.8;
    const target=Math.max(total,Math.min(slots.cap-1,total+Math.ceil(Math.max(0,desired-current)/Math.max(.1,current/Math.max(1,total+1))))),previous=plan.production,options=[];
    const reasonFor=(type,kind,rebuild)=>rebuild?`Rebuild lost ${BUILD_DEFS[type].label.toLowerCase()} training.`:counter==='archers'&&kind==='cavalry'?'Scouted archers call for more cavalry training.':counter==='cavalry'&&kind==='infantry'?'Enemy cavalry calls for a stronger infantry screen.':counter==='infantry'&&kind==='archer'?'Scouted infantry calls for more ranged volleys.':counter==='artillery'&&kind==='cavalry'?'Train riders to hunt enemy artillery.':counter==='forts'&&kind==='siege'?'Scouted enemy forts require more siege support.':(type===content?.building||BUILD_DEFS[type].regimentBuilding||BUILD_DEFS[type].conquestBuilding)&&!sites[type]?`Unlock ${UNIT_DEFS[BUILD_DEFS[type].unit].label.toLowerCase()} and strengthen the ${kind} force.`:plan.productionLossRate>.25?'Expand training to replace battlefield losses.':`Add ${kind} training for the ${plan.label.toLowerCase()}.`;
    for(const type of ['barracks','range','stables','workshop',content?.building,...regimentBuildingsForHouse(s.sigil)].filter(type=>type&&houseCanBuild(type,s.sigil))){
      const d=BUILD_DEFS[type],kind=this.unitClass(d.unit),gap=desired*ratios[kind]-throughput[kind],rebuild=(plan.productionKnown?.[type]||0)>0&&!sites[type];
      if(gap<=desired*.025&&!rebuild)continue;
      const rate=d.batch/d.interval*weights[kind]*(d.trainingFactor||1),deficit=Math.max(0,forceValue*ratios[kind]-counts[kind])/Math.max(12,forceValue*ratios[kind]);
      const score=gap/Math.max(.5,desired)*5+deficit*.7+rate/d.cost*180+(rebuild?1.5:0)+(type===content?.building&&!sites[type] ? .25 : 0)+((d.regimentBuilding||d.conquestBuilding)&&!sites[type]?.45:0);
      options.push({type,label:d.label,cost:d.cost,score,reason:reasonFor(type,kind,rebuild),kind,rebuild});
    }
    const towerLimit=Math.min(Math.floor((total+2)/(plan.style==='defensive'?3:5)),Math.max(1,Math.floor(Math.sqrt(Math.max(0,s.tiles))/25)));
    if((sites.tower||0)<towerLimit&&(plan.style==='defensive'||this.time-s.lastThreat<60))options.push({type:'tower',label:BUILD_DEFS.tower.label,cost:BUILD_DEFS.tower.cost,score:(plan.style==='defensive'?.8:.35)+(s.lastThreat>0&&this.time-s.lastThreat<60?.7:0),reason:'Guard the expanding recruitment network.',kind:'defense'});
    if(this.config.fogOfWar){
      const desiredWatch=Math.min(10,Math.max(1,Math.ceil(Math.max(0,s.tiles)/(plan.style==='defensive'?160:240)))),watch=this.aiFogTowerSite(s);
      if(watch&&(sites.tower||0)<desiredWatch){const existing=options.find(o=>o.type==='tower'),score=(plan.style==='defensive'?2:1.05)+Math.min(1,watch.gain/35);if(existing){existing.score=Math.max(existing.score,score);existing.reason='Extend the watchtower sight network into unobserved territory.';}else options.push({type:'tower',label:BUILD_DEFS.tower.label,cost:BUILD_DEFS.tower.cost,score,reason:'Extend the watchtower sight network into unobserved territory.',kind:'defense'});}
    }
    options.sort((a,b)=>b.score-a.score||a.cost-b.cost||a.type.localeCompare(b.type));
    let chosen=options[0];
    const retained=options.find(o=>o.type===previous?.type),changedCounter=previous?.counter!==counter&&intel.observed>=6;
    if(retained&&['saving','blocked'].includes(previous.status)&&!changedCounter&&!chosen.rebuild&&chosen.score<retained.score*1.5+.2)chosen=retained;
    plan.productionKnown={...plan.productionKnown};for(const [type,count] of Object.entries(sites))plan.productionKnown[type]=Math.max(plan.productionKnown[type]||0,count);
    const state={type:chosen?.type||null,label:chosen?.label||'Balanced training',reason:chosen?.reason||'Existing training covers the current army plan.',status:'enough',target:chosen?Math.max(target,total+Number(chosen.type!=='tower')):target,total,cost:chosen?.cost||0,reserved:0,throughput:current,desiredThroughput:desired,ratios,counts,spare,counter,options:options.map(({type,label,cost,reason,score})=>({type,label,cost,reason,score}))};
    if(threatened){state.status='threat';state.reason='Capital under attack: spend on immediate defenders.';}
    else if(spare<Math.max(16,s.cap*.1)&&!(this.config.fogOfWar&&chosen?.type==='tower')){state.status='supply';state.reason='Army supply is nearly full; resume construction after losses or capturing another castle.';}
    else if(chosen&&slots.count>=slots.cap){state.status='blocked';state.reason='All land-based structure slots are occupied; capture more land.';}
    else if(chosen){state.status='saving';state.reserved=chosen.cost+100;state.decidedAt=previous?.type===chosen.type?previous.decidedAt:this.time;}
    plan.production=state;return state;
  }
  aiProductionSite(s,type){
    if(this.config.fogOfWar)return this.aiFogProductionSite(s,type);
    const d=BUILD_DEFS[type],buildings=this.buildings.filter(b=>b.hp>0),forts=buildings.filter(b=>this.hostile(s.id,b.team)&&['keep','tower'].includes(b.type));let best=null,bestScore=Infinity;
    for(const tile of this.tiles){
      if(tile.owner!==s.id||!isPassableTile(tile)||!this.buildingGround(type,tile.x+.5,tile.y+.5))continue;const p={x:tile.x+.5,y:tile.y+.5};
      if(buildings.some(b=>ds(b,p)<(this.buildingRadius(b)+d.radius+.45)**2))continue;
      if(forts.some(b=>ds(b,p)<((b.type==='keep'?this.townHallDetails(b.team).range:this.towerDetails?.(b.id,b.team)?.range||BUILD_DEFS.tower.range)+d.radius+1)**2))continue;
      if(this.castles.some(c=>c.ruined&&ds(c,p)<(BUILD_DEFS.keep.radius+d.radius+.45)**2))continue;
      let unsafe=false;this.hash.visit(p.x,p.y,8,u=>{if(!unsafe&&u.hp>0&&this.hostile(s.id,u.team)&&ds(u,p)<(this.unitClass(u)==='siege'?8:6.5)**2)unsafe=true;});if(unsafe)continue;
      const score=ds(p,s.home)*.02+(tile.terrain==='forest'?.2:0)-(type==='tower'&&tile.terrain==='hill'?.6:0);
      if(score<bestScore){best=p;bestScore=score;}
    }
    return best;
  }
  aiEconomy(s,plan,army,threatened){
    if(this.time<plan.economyAt)return;plan.economyAt=this.time+5+this.aiRules.decision;
    const counts={};for(const u of army){const kind=this.unitClass(u);counts[kind]=(counts[kind]||0)+1;}
    const owned=this.buildings.filter(b=>b.hp>0&&b.team===s.id),content=this.houseContent(s.id),production=this.aiProductionPlan(s,plan,army,threatened);
    if(production.status==='saving'&&s.gold>=production.reserved){
      const site=this.aiProductionSite(s,production.type),purchase=site?this.build(production.type,site.x,site.y,s.id):null;
      if(purchase?.ok){production.status='built';production.reserved=0;production.total+=Number(production.type!=='tower');production.reason=`Built ${production.label.toLowerCase()} for this army plan.`;production.site=site;}
      else{production.status='blocked';production.reserved=0;production.reason=site?purchase.message:'No safe, clear building site on owned land; reclaim or defend more ground.';}
    }
    const factoryReserve=production.reserved,hall=this.townHallDetails?.(s.id),canUpgradeHall=!threatened&&army.length>48&&hall&&hall.level<(hall.max||3)&&this.time>(plan.style==='defensive'?45:85);
    let reserve=factoryReserve,upgradedHall=false;
    if(canUpgradeHall&&['enough','supply','blocked'].includes(production.status))reserve=Math.max(reserve,hall.cost+180);
    // Useful production has first claim on savings. Capital upgrades use surplus, never a permanent lock.
    if(canUpgradeHall&&s.gold>=hall.cost+factoryReserve+180){upgradedHall=this.upgradeTownHall(s.id).ok;if(upgradedHall)reserve=factoryReserve;}
    plan.economyReserve=reserve;
    if(!threatened&&!upgradedHall&&army.length>48&&this.time>=(plan.towerInvestAt||0)&&typeof this.towerDetails==='function'&&typeof this.upgradeTower==='function'){
      const defensive=plan.style==='defensive'&&hall?.level>=2,towers=owned.filter(b=>b.type==='tower').map(b=>({b,d:this.towerDetails(b.id,s.id)})).filter(({d})=>d.alive&&!d.maxed&&d.level<(d.max||3));
      towers.sort((a,b)=>(a.d.level-b.d.level)*24+(Math.sqrt(ds(a.b,s.home))-Math.sqrt(ds(b.b,s.home)))*(defensive?.6:.15));
      const next=towers[0],budget=reserve+(defensive?180:250);
      if(next&&s.gold>=next.d.cost+budget&&this.upgradeTower(next.b.id,s.id).ok)plan.towerInvestAt=this.time+(defensive?40:70);
    }
    if(!threatened&&s.gold>reserve+420&&army.length>55){
      const preferred=plan.style==='defensive'?['armor','economy','weapons']:plan.style==='siege'?['weapons','economy','armor']:['economy','weapons','armor'];
      const key=preferred.sort((a,b)=>s.upgrades[a]-s.upgrades[b]).find(k=>{const next=this.upgradeDetails(k,s.id);return next.level<next.max&&s.gold-next.cost>=reserve+180;});if(key)this.upgrade(key,s.id);
    }
    if(s.count>=s.cap-8)return;
    const candidates=['infantry','archer','cavalry','siege'].filter(type=>houseCanRecruit(type,s.sigil)),weights={infantry:1,archer:1.05,cavalry:1.35,siege:3.2},total=candidates.reduce((n,k)=>n+(counts[k]||0)*weights[k],0);
    let type=candidates.sort((a,b)=>(production.ratios[b]*(total+18)-(counts[b]||0)*weights[b])/weights[b]-(production.ratios[a]*(total+18)-(counts[a]||0)*weights[a])/weights[a])[0];
    const regiment=regimentsForHouse(s.sigil).filter(type=>this.recruitDetails(type,s.id)?.unlocked).sort((a,b)=>army.filter(u=>u.type===a).length-army.filter(u=>u.type===b).length)[0],regimentDetails=regiment?this.recruitDetails(regiment,s.id):null;
    if(regimentDetails?.unlocked&&this.unitClass(regiment)===type&&army.filter(u=>u.type===regiment).length+regimentDetails.batch<=Math.max(regimentDetails.batch,army.length*.12)&&s.gold>=regimentDetails.cost+reserve)type=regiment;
    else if(content){const special=this.recruitDetails(content.unit,s.id);if(special.unlocked&&this.unitClass(content.unit)===type&&army.filter(u=>u.type===content.unit).length<army.length*.22&&s.gold>=special.cost+reserve)type=content.unit;}
    const purchase=this.recruitDetails(type,s.id);if(s.gold>=purchase.cost+reserve)this.recruit(type,s.id);
  }
  aiFog(s){
    if(!s.alive)return;const plan=this.aiPlanFor(s),home=s.home;s.rally={...home};
    let army=this.group(s.id),visibleEnemies=this.knownUnits(s.id).filter(u=>u.hp>0&&this.hostile(s.id,u.team)),danger=visibleEnemies.filter(u=>ds(u,home)<121).length>4;
    this.aiEconomy(s,plan,army,danger);army=this.group(s.id);this.aiHousePower(s,army);if(!army.length)return;
    const committed=new Set(army.filter(u=>u.championRegroup).map(u=>u.id));
    const wounded=army.filter(u=>u.hp<u.maxHp*.25&&this.aiTaskOf(u)!=='retreat');this.aiIssue(wounded,home,'move','retreat');
    for(const u of army){if(this.aiTaskOf(u)==='retreat'&&u.hp<u.maxHp*.6)committed.add(u.id);else if(this.aiTaskOf(u)==='retreat')this.idle([u.id]);}
    let threatenedKeep=null,threats=[],severity=0;
    for(const keep of this.buildings){
      if(keep.hp<=0||keep.type!=='keep'||!this.allied(s.id,keep.team))continue;
      const nearby=visibleEnemies.filter(u=>ds(u,keep)<121),value=nearby.length*(keep.team===s.id?1.8:1)+(1-keep.hp/keep.maxHp)*nearby.length*2;
      if(nearby.length>4&&value>severity){threatenedKeep=keep;threats=nearby;severity=value;}
    }
    const emergency=!!threatenedKeep&&(threatenedKeep.team===s.id||threatenedKeep.hp<threatenedKeep.maxHp*.55);
    this.aiFogScouts(s,plan,army,committed,!!threatenedKeep);
    const reserveCount=Math.max(10,Math.ceil(army.length*plan.reserve)),garrison=army.filter(u=>!committed.has(u.id)&&!['assault','raid','objective','team','frontier','scout'].includes(this.aiTaskOf(u))).sort((a,b)=>(this.unitClass(a)==='hero'?-25:0)+ds(a,home)-(this.unitClass(b)==='hero'?-25:0)-ds(b,home)).slice(0,reserveCount);
    for(const u of garrison)committed.add(u.id);
    if(threatenedKeep){
      const defenders=army.filter(u=>u.hp>=u.maxHp*.3&&this.aiTaskOf(u)!=='retreat'&&(emergency||!committed.has(u.id)&&!['assault','raid','objective','team'].includes(this.aiTaskOf(u)))).sort((a,b)=>ds(a,threatenedKeep)-ds(b,threatenedKeep)).slice(0,Math.min(army.length,Math.ceil(threats.length*1.7)+14));
      const focus=threats.reduce((p,u)=>({x:p.x+u.x/threats.length,y:p.y+u.y/threats.length}),{x:0,y:0});
      if(!plan.defensePoint||ds(plan.defensePoint,focus)>9||this.time>(plan.defenseAt||0)){this.aiIssue(defenders,focus,'attack','defend',{aiDefend:threatenedKeep.id});plan.defensePoint=focus;plan.defenseAt=this.time+5;}
      for(const u of defenders)committed.add(u.id);s.lastThreat=this.time;
      if(this.mode.teams&&this.time>=(s.defenseCallAt||0)){this.callTeamOrder('defend',threatenedKeep.x,threatenedKeep.y,s.id);s.defenseCallAt=this.time+28;}
      if(emergency){const recalled=army.filter(u=>['assault','raid','objective','team','scout'].includes(this.aiTaskOf(u))&&!defenders.includes(u));this.aiIssue(recalled,home,'move','muster');for(const u of recalled)committed.add(u.id);Object.assign(plan,{phase:'defend',cohort:[],teamCohort:[],coordinationId:null,teamLaunched:false,nextAttackAt:Math.max(plan.nextAttackAt,this.time+16)});}
    }else{
      for(const u of army)if(this.aiTaskOf(u)==='defend')this.aiIssue([u],home,'move','muster');plan.defensePoint=null;if(plan.phase==='defend')Object.assign(plan,{phase:'regroup',cohort:[],startedAt:this.time});
    }
    const activeOrder=this.teamOrders.filter(o=>o.alliance===s.alliance&&o.expiresAt>this.time).sort((a,b)=>(b.kind==='defend')-(a.kind==='defend')||b.id-a.id)[0],coordinated=activeOrder&&!emergency;
    if(coordinated){
      const order=activeOrder;
      if(plan.coordinationId!==order.id){
        const force=army.filter(u=>u.hp>=u.maxHp*.4&&this.aiTaskOf(u)!=='retreat'&&!garrison.includes(u)).slice(0,Math.max(8,Math.floor(army.length*plan.fraction))),chosen=new Set(force.map(u=>u.id)),released=army.filter(u=>!chosen.has(u.id)&&['assault','raid','objective','team'].includes(this.aiTaskOf(u)));
        this.aiIssue(released,home,'move','muster');Object.assign(plan,{cohort:[],coordinationId:order.id,teamCohort:force.map(u=>u.id),teamLaunched:false,phase:'coordinate'});this.aiIssue(force,home,'move','team',{aiOrder:order.id});
      }
      const force=(plan.teamCohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)!=='retreat');
      if((this.time>=order.launchAt||order.kind==='defend')&&!plan.teamLaunched){this.aiIssue(force,order,'attack','team',{aiOrder:order.id});plan.teamLaunched=true;}for(const u of force)committed.add(u.id);
    }else if(plan.coordinationId!=null){
      const force=(plan.teamCohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)==='team');this.aiIssue(force,home,'move','muster');Object.assign(plan,{coordinationId:null,teamCohort:[],phase:'regroup',startedAt:this.time,nextAttackAt:this.time+plan.rest});for(const u of force)committed.add(u.id);
    }
    if(!coordinated&&plan.phase==='advance'){
      // All hostile facts come from observations or frozen last-seen records.
      // A hidden death or move cannot cancel or redirect a committed invasion.
      const target=this.knownBuildings(s.id).find(b=>b.id===plan.targetId),force=(plan.cohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&['assault','raid'].includes(this.aiTaskOf(u))),ruin=this.knownCastleSites(s.id).find(c=>c.id===plan.targetCastleId&&c.ruined);
      if(ruin&&force.length>=Math.max(7,plan.initialSize*.4)){this.aiIssue(force,ruin,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'castle',objectiveId:ruin.id,startedAt:this.time});}
      else if(!target||target.hp<=0||!this.hostile(s.id,target.team)||force.length<Math.max(7,plan.initialSize*.4)||this.time-plan.startedAt>plan.timeout){this.aiIssue(force,home,'move','muster');Object.assign(plan,{phase:'regroup',startedAt:this.time,nextAttackAt:this.time+plan.rest,cohort:[]});}
      else if(plan.stage==='flank'&&(force.filter(u=>ds(u,plan.waypoint)<49).length>=force.length*.5||this.time-plan.stageAt>plan.flankTimeout)){this.aiIssue(force,target,'attack','raid',{aiTarget:target.id});plan.stage='strike';}
      for(const u of force)committed.add(u.id);
    }
    if(!coordinated&&plan.phase==='objective'){
      const castle=plan.objectiveKind==='castle',objective=(castle?this.knownCastleSites(s.id):this.objectives.filter(o=>this.isVisibleTo(s.id,o)||this.vision?.exploredFor(s.id)?.[Math.floor(o.y)*this.W+Math.floor(o.x)])).find(o=>o.id===plan.objectiveId),force=(plan.cohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)==='objective');
      const observing=objective&&this.isVisibleTo(s.id,objective);
      if(!objective||castle&&!objective.ruined||observing&&objective.cooldownUntil>this.time||force.length<Math.max(7,plan.initialSize*.35)||this.time-plan.startedAt>(castle?300:180)){this.aiIssue(force,home,'move','muster');Object.assign(plan,{phase:'regroup',startedAt:this.time,nextAttackAt:this.time+plan.rest,cohort:[]});}
      else for(const u of force)if(ds(u,objective)<(objective.radius*.8)**2&&u.order?.mode!=='idle'&&u.order?.aiTask!=='spearBrace'){this.idle([u.id]);u.order.aiTask='objective';}for(const u of force)committed.add(u.id);
    }
    if(plan.phase==='regroup'&&this.time>=plan.nextAttackAt)plan.phase='muster';
    const expansion=army.filter(u=>this.aiTaskOf(u)==='frontier'&&u.order?.mode==='expand');for(const u of expansion)committed.add(u.id);
    if(!coordinated&&!threatenedKeep&&this.time>=plan.frontierAt&&expansion.length<Math.floor(army.length*plan.expansion)){
      plan.frontierAt=this.time+15;const scouts=army.filter(u=>!committed.has(u.id)&&u.hp>=u.maxHp*.6&&!['assault','raid','objective','team','scout'].includes(this.aiTaskOf(u))).slice(0,Math.min(6,Math.floor(army.length*plan.expansion)-expansion.length));
      if(scouts.length){this.expand(scouts.map(u=>u.id));for(const u of scouts){u.order.aiTask='frontier';committed.add(u.id);}}
    }
    const available=army.filter(u=>!committed.has(u.id)&&u.hp>=u.maxHp*.6&&!u.target),pool=available.filter(u=>ds(u,home)<225);
    if(!coordinated&&!threatenedKeep&&plan.phase==='muster'&&this.time>=plan.nextAttackAt&&pool.length>=Math.max(plan.min,this.aiRules.minArmy*.55)){
      const castle=this.aiFogCastleTarget(s),target=this.aiFogTarget(s,plan),explored=this.vision?.exploredFor(s.id),flags=this.objectives.filter(o=>explored?.[Math.floor(o.y)*this.W+Math.floor(o.x)]&&(!this.isVisibleTo(s.id,o)||!(o.cooldownUntil>this.time)));
      if(castle&&!this.mode.flagPriority){const force=pool.slice(0,Math.max(plan.min,Math.floor(pool.length*.82)));this.aiIssue(force,castle,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'castle',objectiveId:castle.id,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time});}
      else if(flags.length&&(this.mode.flagPriority||plan.style==='objective'||this.mode.objectiveGoal)){
        const flag=[...flags].sort((a,b)=>this.navigation.route(home,a).cost-this.navigation.route(home,b).cost)[0],force=pool.slice(0,Math.max(plan.min,Math.floor(pool.length*.82)));this.aiIssue(force,flag,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'flag',objectiveId:flag.id,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time});
      }else if(target){
        const force=[...pool].sort((a,b)=>plan.style==='raider'?(this.unitClass(a)==='cavalry'?0:1)-(this.unitClass(b)==='cavalry'?0:1)||ds(a,home)-ds(b,home):ds(a,home)-ds(b,home)).slice(0,Math.max(plan.min,Math.floor(pool.length*plan.fraction))),distance=Math.sqrt(ds(home,target));
        Object.assign(plan,{phase:'advance',targetId:target.id,targetCastleId:target.castleId??null,targetTeam:target.team,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time,timeout:70+(plan.targetRoute?.cost||distance)*2.5,stage:'strike'});
        if(plan.style==='raider'){const dx=(target.x-home.x)/(distance||1),dy=(target.y-home.y)/(distance||1),side=s.id%2?1:-1,bend=Math.min(14,distance*.2),waypoint=this.navigation.nearestPassable(this.bound({x:home.x+(target.x-home.x)*.58-dy*bend*side,y:home.y+(target.y-home.y)*.58+dx*bend*side})),route=this.navigation.route(home,waypoint,'cavalry');Object.assign(plan,{waypoint,stage:'flank',stageAt:this.time,flankTimeout:15+route.cost*2.2});this.aiIssue(force,waypoint,'attack','raid',{aiTarget:target.id});}
        else this.aiIssue(force,target,'attack','assault',{aiTarget:target.id});s.assault=this.time;
      }
    }else if(!coordinated&&!threatenedKeep&&['muster','regroup'].includes(plan.phase)){const strays=available.filter(u=>ds(u,home)>64&&this.aiTaskOf(u)!=='muster');this.aiIssue(strays,home,'move','muster');}
    if(!threatenedKeep){const strays=garrison.filter(u=>ds(u,home)>49&&this.aiTaskOf(u)!=='muster');this.aiIssue(strays,home,'move','muster');}
  }
  aiKing(s){
    if(!s.alive)return;const king=this.kingFor(s.id);if(!king){this.eliminate(s.id,'king');return;}
    const plan=this.aiPlanFor(s),known=this.knownUnits(s.id),threats=known.filter(u=>u.hp>0&&this.hostile(s.id,u.team)&&ds(u,king)<12**2).sort((a,b)=>ds(a,king)-ds(b,king));
    let army=this.group(s.id);s.rally={x:king.x,y:king.y};this.aiEconomy(s,plan,army,threats.length>3);army=this.group(s.id);this.aiHousePower(s,army);
    // Kings are protected leaders, never members of automatic attacking waves.
    if(threats.length&&king.hp<king.maxHp*.65&&this.time>=(s.kingWithdrawAt||0)){
      const danger=threats[0],dx=king.x-danger.x,dy=king.y-danger.y,length=Math.hypot(dx,dy)||1,point=this.navigation.nearestPassable(this.bound({x:king.x+dx/length*5,y:king.y+dy/length*5}));
      if(point){this.command([king.id],point.x,point.y,'move','spread');king.order.aiTask='kingWithdraw';s.kingWithdrawAt=this.time+5;}
    }else if(king.order?.mode!=='hold'&&king.order?.mode!=='move')this.hold([king.id]);
    const soldiers=army.filter(u=>!u.isKing),guardCount=Math.min(soldiers.length,Math.max(10,Math.ceil(soldiers.length*(threats.length?.4:.24)))),guards=soldiers.filter(u=>!['scout','retreat'].includes(this.aiTaskOf(u))).sort((a,b)=>ds(a,king)-ds(b,king)).slice(0,guardCount),guardIds=new Set(guards.map(u=>u.id));
    for(const u of guards){
      if(threats.length){const target=threats[0];if(u.order?.aiTask!=='kingGuard'||u.order?.aiTarget!==target.id||ds(u.order,target)>9)this.aiIssue([u],target,'attack','kingGuard',{aiTarget:target.id});}
      else if(ds(u,king)>6**2||u.order?.aiTask!=='kingGuard'){const angle=u.id*2.399963,point=this.navigation.nearestPassable(this.bound({x:king.x+Math.cos(angle)*3,y:king.y+Math.sin(angle)*3}));if(point)this.aiIssue([u],point,'move','kingGuard');}
    }
    const committed=new Set([king.id,...guardIds]);if(this.config.fogOfWar)this.aiFogScouts(s,plan,army,committed,threats.length>3);
    const flags=this.objectives.filter(o=>!o.consumed&&!(o.cooldownUntil>this.time)),enemyKings=known.filter(u=>u.isKing&&u.hp>0&&this.hostile(s.id,u.team)).sort((a,b)=>ds(a,king)-ds(b,king)),force=soldiers.filter(u=>!committed.has(u.id)),hunters=this.time>=90?Math.ceil(force.length*.35):0;
    for(let i=0;i<force.length;i++){
      const u=force[i],hunt=enemyKings[0]&&(i<hunters||!flags.length&&this.flagWave>0&&this.time>=this.nextFlagWaveAt-this.mode.flagInterval+12);
      if(hunt){const target=enemyKings[0];if(u.order?.aiTask!=='kingHunt'||u.order.aiTarget!==target.id||ds(u.order,target)>9)this.aiIssue([u],target,'attack','kingHunt',{aiTarget:target.id});continue;}
      // A lost contact can be investigated at its last ordered location, but
      // hidden motion never updates that position or creates a new live target.
      if(this.config.fogOfWar&&u.order?.aiTask==='kingHunt'&&!this.isVisibleTo(s.id,u.order)&&ds(u,u.order)>4)continue;
      const retained=flags.find(o=>o.id===u.order?.aiFlagId),flag=retained||flags[i%Math.max(1,flags.length)];
      if(flag){
        if(!retained)this.aiIssue([u],flag,'attack','royalFlag',{aiFlagId:flag.id});
        if(ds(u,flag)<(flag.radius*.8)**2&&u.order?.mode==='attack'){this.idle([u.id]);Object.assign(u.order,{aiTask:'royalFlag',aiFlagId:flag.id});}
      }else if(u.order?.aiTask!=='royalReserve'){const point=this.navigation.nearestPassable({x:this.W/2,y:this.H/2});if(point)this.aiIssue([u],point,'attack','royalReserve');}
    }
    plan.phase=threats.length?'protect king':flags.length?'capture standards':enemyKings.length?'hunt kings':'scout center';
  }
  ai(s){
    if(this.mode.kingSurvival)return this.aiKing(s);
    if(this.config.fogOfWar)return this.aiFog(s);
    if(!s.alive)return;
    const plan=this.aiPlanFor(s),home=s.home;
    // Recruits always muster at home. An invasion is a fixed company, never a recruitment route.
    s.rally={...home};
    let army=this.group(s.id);const ownThreats=this.units.filter(u=>u.hp>0&&this.hostile(s.id,u.team)&&ds(u,home)<121);
    this.aiEconomy(s,plan,army,ownThreats.length>4);army=this.group(s.id);this.aiHousePower(s,army);if(!army.length)return;
    const committed=new Set(army.filter(u=>u.championRegroup).map(u=>u.id));
    const wounded=army.filter(u=>u.hp<u.maxHp*.25&&this.aiTaskOf(u)!=='retreat');
    this.aiIssue(wounded,home,'move','retreat');
    for(const u of army){if(this.aiTaskOf(u)==='retreat'&&u.hp<u.maxHp*.6)committed.add(u.id);else if(this.aiTaskOf(u)==='retreat')this.idle([u.id]);}
    // Keep an actual home guard. Heroes and ranged troops anchor the capital while waves deploy.
    const reserveCount=Math.max(10,Math.ceil(army.length*plan.reserve));
    const garrison=army.filter(u=>!committed.has(u.id)&&!['assault','raid','objective','team','frontier'].includes(this.aiTaskOf(u))).sort((a,b)=>(this.unitClass(a)==='hero'?-25:0)+ds(a,home)-(this.unitClass(b)==='hero'?-25:0)-ds(b,home)).slice(0,reserveCount);
    for(const u of garrison)committed.add(u.id);
    let threatenedKeep=null,threats=[],danger=0;
    for(const keep of this.buildings){
      if(keep.hp<=0||keep.type!=='keep'||!this.allied(s.id,keep.team))continue;
      const enemies=[];this.hash.visit(keep.x,keep.y,11,u=>{if(u.hp>0&&this.hostile(s.id,u.team)&&ds(u,keep)<121)enemies.push(u);});
      const severity=enemies.length*(keep.team===s.id?1.8:1)+(1-keep.hp/keep.maxHp)*enemies.length*2;
      if(enemies.length>4&&severity>danger){threatenedKeep=keep;threats=enemies;danger=severity;}
    }
    if(threatenedKeep){
      const emergency=threatenedKeep.team===s.id||threatenedKeep.hp<threatenedKeep.maxHp*.55;
      const defenders=army.filter(u=>u.hp>=u.maxHp*.3&&this.aiTaskOf(u)!=='retreat'&&(emergency||!committed.has(u.id)&&!['assault','raid','objective','team'].includes(this.aiTaskOf(u)))).sort((a,b)=>ds(a,threatenedKeep)-ds(b,threatenedKeep)).slice(0,Math.min(army.length,Math.ceil(threats.length*1.7)+14));
      const focus=threats.reduce((p,u)=>({x:p.x+u.x/threats.length,y:p.y+u.y/threats.length}),{x:0,y:0});
      if(!plan.defensePoint||ds(plan.defensePoint,focus)>9||this.time>(plan.defenseAt||0)){
        this.aiIssue(defenders,focus,'attack','defend',{aiDefend:threatenedKeep.id});plan.defensePoint=focus;plan.defenseAt=this.time+5;
      }
      for(const u of defenders)committed.add(u.id);s.lastThreat=this.time;
      if(this.mode?.teams&&this.time>=(s.defenseCallAt||0)){
        this.callTeamOrder('defend',threatenedKeep.x,threatenedKeep.y,s.id);s.defenseCallAt=this.time+28;
      }
      if(emergency){
        const recalled=army.filter(u=>['assault','raid','objective','team'].includes(this.aiTaskOf(u))&&!defenders.includes(u));
        this.aiIssue(recalled,home,'move','muster');for(const u of recalled)committed.add(u.id);
        plan.phase='defend';plan.cohort=[];plan.teamCohort=[];plan.coordinationId=null;plan.teamLaunched=false;
        plan.nextAttackAt=Math.max(plan.nextAttackAt,this.time+16);
      }
    }else{
      for(const u of army)if(this.aiTaskOf(u)==='defend')this.aiIssue([u],home,'move','muster');
      plan.defensePoint=null;if(plan.phase==='defend'){plan.phase='regroup';plan.cohort=[];plan.startedAt=this.time;}
    }
    const emergencyDefense=threatenedKeep&&(threatenedKeep.team===s.id||threatenedKeep.hp<threatenedKeep.maxHp*.55);
    const activeOrder=(this.teamOrders||[]).filter(o=>o.alliance===s.alliance&&o.expiresAt>this.time).sort((a,b)=>(b.kind==='defend')-(a.kind==='defend')||b.id-a.id)[0];
    if(activeOrder&&!emergencyDefense){
      const order=activeOrder,launch=this.time>=order.launchAt||order.kind==='defend';
      if(plan.coordinationId!==order.id){
        // An expired wave regroups before a later call; a fresh call can redirect a living wave.
        const force=army.filter(u=>u.hp>=u.maxHp*.4&&this.aiTaskOf(u)!=='retreat'&&!garrison.includes(u)).slice(0,Math.max(8,Math.floor(army.length*plan.fraction)));
        const chosen=new Set(force.map(u=>u.id)),released=army.filter(u=>!chosen.has(u.id)&&['assault','raid','objective','team'].includes(this.aiTaskOf(u)));
        this.aiIssue(released,home,'move','muster');for(const u of released)committed.add(u.id);
        plan.cohort=[];
        plan.coordinationId=order.id;plan.teamCohort=force.map(u=>u.id);plan.teamLaunched=false;plan.phase='coordinate';
        this.aiIssue(force,home,'move','team',{aiOrder:order.id});
      }
      const force=(plan.teamCohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)!=='retreat');
      if(launch&&!plan.teamLaunched){this.aiIssue(force,order,'attack','team',{aiOrder:order.id});plan.teamLaunched=true;}
      for(const u of force)committed.add(u.id);
    }else if(plan.coordinationId!==null){
      const force=(plan.teamCohort||[]).map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)==='team');
      this.aiIssue(force,home,'move','muster');plan.coordinationId=null;plan.teamCohort=[];plan.phase='regroup';plan.startedAt=this.time;plan.nextAttackAt=this.time+plan.rest;
      for(const u of force)committed.add(u.id);
    }
    const coordinated=activeOrder&&!emergencyDefense;
    if(!coordinated&&plan.phase==='advance'){
      const target=this.byId.get(plan.targetId),force=plan.cohort.map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&['assault','raid'].includes(this.aiTaskOf(u)));
      const ruin=this.castles.find(c=>c.id===plan.targetCastleId&&c.ruined),canRestore=ruin&&force.length>=Math.max(7,plan.initialSize*.4);
      const failed=!target||target.hp<=0||!this.hostile(s.id,target.team)||force.length<Math.max(7,plan.initialSize*.4)||this.time-plan.startedAt>plan.timeout;
      if(canRestore){
        this.aiIssue(force,ruin,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'castle',objectiveId:ruin.id,startedAt:this.time});
      }else if(failed){
        this.aiIssue(force,home,'move','muster');plan.phase='regroup';plan.startedAt=this.time;plan.nextAttackAt=this.time+plan.rest;plan.cohort=[];
      }else if(plan.stage==='flank'){
        const arrived=force.filter(u=>ds(u,plan.waypoint)<49).length>=force.length*.5;
        if(arrived||this.time-plan.stageAt>plan.flankTimeout){this.aiIssue(force,target,'attack','raid',{aiTarget:target.id});plan.stage='strike';}
      }
      for(const u of force)committed.add(u.id);
    }
    if(!coordinated&&plan.phase==='objective'){
      const castleMission=plan.objectiveKind==='castle',objective=(castleMission?this.castles:this.objectives||[]).find(o=>o.id===plan.objectiveId),force=plan.cohort.map(id=>this.byId.get(id)).filter(u=>u?.hp>0&&this.aiTaskOf(u)==='objective');
      if(!objective||castleMission&&!objective.ruined||objective.cooldownUntil>this.time||force.length<Math.max(7,plan.initialSize*.35)||this.time-plan.startedAt>(castleMission?300:180)){
        this.aiIssue(force,home,'move','muster');plan.phase='regroup';plan.startedAt=this.time;plan.nextAttackAt=this.time+plan.rest;plan.cohort=[];
      }else{
        const arrived=force.filter(u=>ds(u,objective)<(objective.radius*.8)**2);
        for(const u of arrived)if(u.order?.mode!=='idle'&&u.order?.aiTask!=='spearBrace'){this.idle([u.id]);u.order.aiTask='objective';}
      }
      for(const u of force)committed.add(u.id);
    }
    if(plan.phase==='regroup'&&this.time>=plan.nextAttackAt)plan.phase='muster';
    // Only a small, persistent scouting company expands. The main army waits for its planned wave.
    const expansion=army.filter(u=>this.aiTaskOf(u)==='frontier'&&u.order?.mode==='expand');for(const u of expansion)committed.add(u.id);
    if(!coordinated&&!threatenedKeep&&this.time>=plan.frontierAt&&expansion.length<Math.floor(army.length*plan.expansion)){
      plan.frontierAt=this.time+15;
      const candidates=this.tiles.filter(tile=>tile.owner===-1&&isPassableTile(tile)&&this.canCapture(tile,s.id));
      if(candidates.length){
        const scouts=army.filter(u=>!committed.has(u.id)&&u.hp>=u.maxHp*.6&&!['assault','raid','objective','team'].includes(this.aiTaskOf(u))).slice(0,Math.min(8,Math.floor(army.length*plan.expansion)-expansion.length));
        if(scouts.length){this.expand(scouts.map(u=>u.id));for(const u of scouts){u.order.aiTask='frontier';committed.add(u.id);}}
      }
    }
    const available=army.filter(u=>!committed.has(u.id)&&u.hp>=u.maxHp*.6&&!u.target),pool=available.filter(u=>ds(u,home)<225);
    if(!coordinated&&!threatenedKeep&&plan.phase==='muster'&&this.time>=plan.nextAttackAt&&pool.length>=Math.max(plan.min,this.aiRules.minArmy*.55)){
      const objectives=(this.objectives||[]).filter(o=>!(o.cooldownUntil>this.time)),castle=this.aiCastleTarget(s);
      const seekCastle=!this.mode.flagPriority&&castle&&(!this.mode?.objectiveGoal||plan.style!=='objective'||s.cap-s.count<40||this.random()<.6);
      const seekObjective=objectives.length&&(this.mode.flagPriority||plan.style==='objective'||this.mode?.objectiveGoal||this.random()<.3);
      if(seekCastle){
        const force=pool.slice(0,Math.max(plan.min,Math.floor(pool.length*.82)));
        this.aiIssue(force,castle,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'castle',objectiveId:castle.id,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time});
        this.event(`${s.name} marches to restore ${castle.name} and secure another realm.`,s.id);
      }else if(seekObjective){
        const objective=[...objectives].sort((a,b)=>this.navigation.route(home,a).cost-this.navigation.route(home,b).cost-(a.progress?.[s.alliance]||0)*.8+(b.progress?.[s.alliance]||0)*.8)[0];
        const force=pool.slice(0,Math.max(plan.min,Math.floor(pool.length*.82)));
        this.aiIssue(force,objective,'attack','objective');Object.assign(plan,{phase:'objective',objectiveKind:'flag',objectiveId:objective.id,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time});
      }else{
        const target=this.aiTarget(s,plan);
        if(target){
          const force=[...pool].sort((a,b)=>plan.style==='raider'?(this.unitClass(a)==='cavalry'?0:1)-(this.unitClass(b)==='cavalry'?0:1)||ds(a,home)-ds(b,home):ds(a,home)-ds(b,home)).slice(0,Math.max(plan.min,Math.floor(pool.length*plan.fraction)));
          const distance=Math.sqrt(ds(home,target));Object.assign(plan,{phase:'advance',targetId:target.id,targetCastleId:target.castleId??null,targetTeam:target.team,cohort:force.map(u=>u.id),initialSize:force.length,startedAt:this.time,timeout:70+(plan.targetRoute?.cost||distance)*2.5,stage:'strike'});
          if(plan.style==='raider'){
            const dx=(target.x-home.x)/(distance||1),dy=(target.y-home.y)/(distance||1),side=(s.id%2?1:-1),bend=Math.min(14,distance*.2);
            const waypoint=this.navigation.nearestPassable(this.bound({x:home.x+(target.x-home.x)*.58-dy*bend*side,y:home.y+(target.y-home.y)*.58+dx*bend*side})),approach=this.navigation.route(home,waypoint,'cavalry');
            Object.assign(plan,{waypoint,stage:'flank',stageAt:this.time,flankTimeout:15+approach.cost*2.2});this.aiIssue(force,waypoint,'attack','raid',{aiTarget:target.id});
          }else this.aiIssue(force,target,'attack','assault',{aiTarget:target.id});
          s.assault=this.time;this.event(`${s.name}: ${plan.label.toLowerCase()} advances on ${this.teams[target.team].name}.`,s.id);
          if(this.mode?.teams&&this.time>=(s.assaultCallAt||0)&&this.teams.some(t=>t.alive&&t.id!==s.id&&this.allied(t.id,s.id))){this.callTeamOrder('assault',target.x,target.y,s.id);s.assaultCallAt=this.time+90;}
        }
      }
    }else if(!coordinated&&!threatenedKeep&&['muster','regroup'].includes(plan.phase)){
      const strays=available.filter(u=>ds(u,home)>64&&this.aiTaskOf(u)!=='muster');this.aiIssue(strays,home,'move','muster');
    }
    // Guards are returned to the capital, never absorbed into new attack or frontier orders.
    if(!threatenedKeep){const strays=garrison.filter(u=>ds(u,home)>49&&this.aiTaskOf(u)!=='muster');this.aiIssue(strays,home,'move','muster');}
  }

}

