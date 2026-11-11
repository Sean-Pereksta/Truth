(function () {
  'use strict';
  const OW = window.OW = window.OW || {};
  const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const regions = [
    {id:'greenfields',name:'Greenfields Reach',biome:'grass',color:'#719254',level:1,commander:'Colonel Ironwhisker',boss:'ironwhisker',description:'Orchards, wheat farms, and the first sparks of resistance.'},
    {id:'mosswood',name:'Mosswood Wilds',biome:'forest',color:'#3d7155',level:4,commander:'Major Bramble',boss:'bramble',description:'Ancient woodland conceals prison camps and radio towers.'},
    {id:'stonecrest',name:'Stonecrest Highlands',biome:'mountain',color:'#85877e',level:7,commander:'General Flintfang',boss:'flintfang',description:'Rocky passes climb toward fortified mountain batteries.'},
    {id:'frostmarch',name:'Frostmarch',biome:'snow',color:'#c0cbd0',level:10,commander:'Marshal Whiteclaw',boss:'whiteclaw',description:'Frozen lakes and pine forests surround an icy command post.'},
    {id:'sunscar',name:'Sunscar Dunes',biome:'desert',color:'#c5a36d',level:13,commander:'Field Marshal Sirocco',boss:'sirocco',description:'Desert caravan roads carry supplies to a buried war factory.'},
    {id:'reedwater',name:'Reedwater Delta',biome:'marsh',color:'#71846a',level:16,commander:'Admiral Miretooth',boss:'miretooth',description:'Wetlands, fishing villages, and occupied river docks.'},
    {id:'emberworks',name:'Emberworks',biome:'industrial',color:'#8b7970',level:19,commander:'Director Geargnash',boss:'geargnash',description:'Smokestacks and armored factories dominate the ruined countryside.'},
    {id:'blackbanner',name:'Blackbanner Citadel',biome:'fortress',color:'#73716d',level:22,commander:'Supreme Commander Vex',boss:'vex',description:'An occupied capital surrounding the sealed Berlin Sector.'}
  ].map((r,i)=>Object.assign(r,{slug:r.id,id:i,index:i,x:(i<4?i:7-i)*3600,y:Math.floor(i/4)*5600,w:3600,h:5600}));

  const enemyRows = [
    ['trooper','Mouse Trooper',42,7,78,390,.75,13,'rifle','#929981'],
    ['scout','Trail Scout',32,5,115,350,1,12,'scout','#b7a076'],
    ['raider','Knife Raider',52,10,117,40,1.1,16,'melee','#a69b85'],
    ['gunner','Machine Gunner',80,6,50,450,3,22,'gunner','#8e9276'],
    ['grenadier','Grenadier',62,14,63,330,.38,22,'grenadier','#8c9377'],
    ['medic','Field Medic',48,5,71,280,.6,19,'medic','#d5d1ac'],
    ['sniper','Watchtower Sniper',45,17,44,690,.42,25,'sniper','#758d79'],
    ['shield','Shield Guard',130,10,48,48,.7,27,'shield','#788787'],
    ['flamer','Flamethrower',86,9,61,185,3,29,'flamer','#b87f59'],
    ['officer','Mouse Officer',95,11,74,425,1.25,33,'officer','#7f8e8b'],
    ['hound','Clockwork Hound',68,12,147,42,1.2,24,'hound','#89979c'],
    ['rocketeer','Rocket Trooper',84,23,56,520,.33,34,'rocket','#b19070'],
    ['engineer','Combat Engineer',102,12,62,350,1,33,'engineer','#b7a061'],
    ['ice','Frost Specialist',94,13,68,400,.85,35,'ice','#9ecccc'],
    ['desert','Dune Sharpshooter',100,15,87,500,.8,37,'desert','#d3b67d'],
    ['swamp','Marsh Ambusher',108,14,98,280,1.2,38,'swamp','#74966b'],
    ['drone','Sentry Drone',70,9,116,330,1.8,34,'drone','#a5b0af'],
    ['heavy','Armored Heavy',210,18,40,410,1.35,55,'heavy','#777b7a'],
    ['elite','Blackbanner Elite',162,18,91,440,1.6,51,'elite','#525e68'],
    ['assassin','Shadow Infiltrator',110,23,138,44,1.1,46,'assassin','#787187']
  ];
  const roleAliases={rifle:'rifleman',melee:'knife',gunner:'machinegun',flamer:'flame',hound:'knife',ice:'rifleman',desert:'sniper',swamp:'commando',drone:'scout',elite:'commando',assassin:'knife'};
  const enemies = enemyRows.map(r=>({id:r[0],name:r[1],hp:r[2],damage:r[3],speed:r[4],range:r[5],fireRate:r[6],xp:r[7],role:roleAliases[r[8]]||r[8],color:r[9]}));
  enemies.push({id:'recruit',name:'Mouse Recruit',hp:32,damage:5,speed:72,range:300,fireRate:.65,xp:10,role:'recruit',color:'#9f9b7c'},{id:'tank',name:'Mouse Tank Crew',hp:270,damage:26,speed:34,range:540,fireRate:.45,xp:66,role:'tank',color:'#788675'},{id:'general',name:'Mouse General',hp:240,damage:23,speed:63,range:550,fireRate:1.3,xp:80,role:'general',color:'#8b716e'},{id:'war_machine',name:'Mouse War Machine',hp:410,damage:30,speed:30,range:610,fireRate:.6,xp:95,role:'warMachine',color:'#71797d'});
  enemies.push(
    {id:'leaper',name:'Mouse Leaper',hp:66,damage:16,speed:105,range:340,fireRate:.65,xp:25,role:'leaper',color:'#9b8a70',attack:'telegraphedPounce'},
    {id:'bruiser',name:'Mouse Shock Bruiser',hp:175,damage:23,speed:55,range:185,fireRate:.5,xp:43,role:'bruiser',color:'#9c7f70',attack:'groundShockwave'},
    {id:'mortarman',name:'Mouse Mortarman',hp:88,damage:20,speed:48,range:750,fireRate:.3,xp:38,role:'mortar',color:'#9c9579',attack:'threeShellVolley'},
    {id:'sapper',name:'Mouse Sapper',hp:90,damage:21,speed:78,range:410,fireRate:.55,xp:36,role:'sapper',color:'#baa15b',attack:'proximityMines'},
    {id:'skirmisher',name:'Mouse Skirmisher',hp:102,damage:12,speed:126,range:440,fireRate:1.6,xp:39,role:'skirmisher',color:'#6e9f92',attack:'dashBurst'},
    {id:'frostcaller',name:'Mouse Frostcaller',hp:118,damage:15,speed:61,range:540,fireRate:.7,xp:42,role:'frost',color:'#9fced9',attack:'iceFan'}
  );
  enemies.push(
    {id:'jammer',name:'Signal Jammer',hp:96,damage:11,speed:63,range:420,fireRate:.7,xp:40,role:'jammer',color:'#9b7aaa',attack:'disruptionPulse'},
    {id:'stormcaller',name:'Storm Caller',hp:126,damage:18,speed:57,range:590,fireRate:.45,xp:49,role:'stormcaller',color:'#8dbcc9',attack:'markedLightning'},
    {id:'duelist',name:'Blade Duelist',hp:138,damage:27,speed:108,range:95,fireRate:.65,xp:47,role:'duelist',color:'#a77e84',attack:'parryLunge'},
    {id:'hunter',name:'Wire Hunter',hp:105,damage:15,speed:95,range:520,fireRate:.75,xp:43,role:'hunter',color:'#8eab7c',attack:'snareFan'},
    {id:'bombardier',name:'Cluster Bombardier',hp:145,damage:24,speed:45,range:680,fireRate:.3,xp:56,role:'bombardier',color:'#bda179',attack:'splittingBombs'},
    {id:'bulwark',name:'Citadel Bulwark',hp:295,damage:23,speed:43,range:440,fireRate:.7,xp:67,role:'bulwark',color:'#667a8e',attack:'shieldRush'}
  );
  // Appended indices preserve older saves.
  enemies.push(
    {id:'roller',name:'Ironhide Roller',hp:125,damage:17,speed:54,range:540,fireRate:.3,xp:38,role:'roller',color:'#bd9e73',hint:'Watch the amber lane and the walls: fast armored rolls ricochet repeatedly. Attack during its brief dizzy recovery.'},
    {id:'blinkstalker',name:'Rift Stalker',hp:130,damage:24,speed:76,range:600,fireRate:.3,xp:50,role:'blinkstalker',color:'#c693e8',hint:'Move away from the violet destination rune. Its slash follows the arrival.'},
    {id:'fencer',name:'Needleblade Fencer',hp:112,damage:26,speed:116,range:490,fireRate:.4,xp:46,role:'fencer',color:'#d99c96',hint:'The red line locks before the lunge. Dodge sideways, then attack during recovery.'},
    {id:'burrowrat',name:'Tunnel Fangrat',hp:82,damage:15,speed:138,range:420,fireRate:.45,xp:29,role:'burrowrat',color:'#a58d76',hint:'Dust circles reveal where it will surface.'},
    {id:'cinderbeast',name:'Cinderback Beast',hp:225,damage:27,speed:71,range:560,fireRate:.3,xp:64,role:'cinderbeast',color:'#ed9865',hint:'Its charge leaves burning ground. Move across its path.'},
    {id:'venomrat',name:'Venom Crown Rat',hp:115,damage:20,speed:103,range:510,fireRate:.5,xp:49,role:'venomrat',color:'#afcb70',hint:'Venom fans spread wide; find a gap before the next volley.'},
    {id:'frostwarden',name:'Rimeplate Warden',hp:245,damage:30,speed:59,range:650,fireRate:.35,xp:73,role:'frostwarden',color:'#a6e2ee',hint:'Find gaps in its ice ring, then sidestep the marked lance.'},
    {id:'voidknight',name:'Blackglass Knight',hp:290,damage:34,speed:105,range:650,fireRate:.3,xp:90,role:'voidknight',color:'#b39ada',hint:'A second violet rune follows its first attack. Keep moving after the first slash.'}
  );
  // The opening stays familiar; each frontier demands stronger equipment.
  const enemyHealth=[1,2.2,4,6.6,10.2,15.2,22,31],enemyDamage=[1,1.8,2.8,4.2,6,8.4,11.5,15.5];
  // Retain the previous curve only to migrate wounded enemies in existing saves.
  const legacyEnemyHealth=[1,1.65,2.5,3.7,5.4,7.8,11,15.2],legacyEnemyDamage=[1,1.45,1.95,2.7,3.65,4.9,6.4,8.2];
  const enemyScaling=(region,legacy=false)=>{const r=Math.trunc(Math.max(0,Math.min(7,Number(region)||0)));return {health:(legacy?legacyEnemyHealth:enemyHealth)[r],damage:(legacy?legacyEnemyDamage:enemyDamage)[r]};};
  const bossRows = [
    ['ironwhisker','Colonel Ironwhisker','charge',920,15,83,'#a28558'],
    ['bramble','Major Bramble','summon',1400,17,72,'#68855b'],
    ['flintfang','General Flintfang','barrage',1950,23,58,'#a09480'],
    ['whiteclaw','Marshal Whiteclaw','frost',2500,24,86,'#b7d5df'],
    ['sirocco','Field Marshal Sirocco','dash',3050,29,113,'#d4ad69'],
    ['miretooth','Admiral Miretooth','poison',3650,29,77,'#6c997d'],
    ['geargnash','Director Geargnash','mines',4250,33,63,'#b38a62'],
    ['vex','Supreme Commander Vex','final',5200,37,96,'#aa6570']
  ];
  const bosses = bossRows.map((r,i)=>({id:r[0],name:r[1],pattern:r[2],hp:r[3],damage:r[4],speed:r[5],color:r[6],range:570,fireRate:.8,xp:240+i*130,level:4+i*3,phases:3}));
  const bossHints=[
    ['Sidestep the marked charge line, then punish the recovery.','Rifle fans and marked artillery alternate with a ground slam.','In the third phase the charge chains into a return charge.'],
    ['Bramble leaps to a new firing position and marks delayed sniper shots.','Artillery lanes are backed by summoned scouts and wire hunters.','Watch for a teleport followed by a spreading rifle fan.'],
    ['Move out of the marked ground slam before Flintfang lands.','Seismic rings expand around the battery; leave a clear path between marks.','Full-circle bullets alternate with a line of delayed shells.'],
    ['Find gaps in the full-circle ice fan while Whiteclaw skates aside.','Marked frost patches become slowing ground.','An aimed slam is followed by a narrower ice fan.'],
    ['Dodge across the charge direction and keep clear of the marked sand strikes.','A rocket fan covers Sirocco’s sideways skate.','The final phase adds a leap to the surrounding artillery pattern.'],
    ['Leave marked poison circles before Miretooth leaps toward you.','A line of venom patches is backed by spreading rifle fire.','A teleport to the floodgate is followed by reinforcements.'],
    ['Geargnash shields up, deploys a turret and marks the ground around you.','The furnace slam leaves burning zones on both sides.','Rocket fans alternate with engineer or signal-jammer reinforcements.'],
    ['Full-circle bullet rings cover Vex’s leap to a new position.','Delayed artillery crosses your route with an ice fan.','The final phase adds seismic rings and skirmisher reinforcements.']
  ];
  bosses.forEach((b,i)=>{b.attackHints=bossHints[i];});
  bosses.push({id:'adolph_whisker',name:'Adolph Whisker',pattern:'whisker',hp:42000,damage:48,speed:135,color:'#c86174',range:820,fireRate:1.15,xp:4000,level:28,phases:4,finalBoss:true,attackHints:['Phase I · Tyrant’s Arsenal: teleport rings, marked artillery and rocket fans.','Phase II · Blink Assault: a wider arsenal joins the teleport and delayed strike combinations.','Phase III · Berlin Lockdown: lingering hazards, summoned elites and orbital strikes.','Phase IV · Last Whisker: chained teleports weave every attack together. Save dodge and healing for this phase.']});
  const sectors=[{id:'berlin',name:'Berlin Sector',region:7,x:2250,y:5680,w:1290,h:1370,gate:{x:2250,y:6550},bossId:'adolph_whisker',description:'Adolph Whisker’s sealed headquarters. Defeat all eight regional commanders to open the gate.'}];

  const weaponRows = [
    ['field_pistol','Field Pistol','pistol',12,3.4,580,12,1.05,820,.055,1,0,1,0],
    ['woodland_carbine','Woodland Carbine','rifle',15,5.4,710,24,1.35,980,.055,1,1,2,190],
    ['trench_scattergun','Trench Scattergun','shotgun',10,1.1,390,6,1.8,760,.23,6,1,3,240],
    ['swift_paw','Swiftpaw SMG','smg',9,10,480,30,1.45,910,.11,1,1,3,270],
    ['longtail','Longtail Rifle','sniper',62,.8,1250,5,2,1500,.008,1,2,4,380],
    ['copper_revolver','Copper Revolver','pistol',28,2.1,650,6,1.5,1050,.035,1,1,5,350],
    ['foxguard','Foxguard Rifle','rifle',20,6.2,760,28,1.5,1100,.045,1,2,6,480],
    ['briar_smg','Briar SMG','smg',13,11,500,34,1.4,980,.09,1,2,7,530],
    ['barkbreaker','Barkbreaker','shotgun',15,1.3,420,8,1.85,800,.24,7,2,8,590],
    ['peakwatch','Peakwatch Marksman','sniper',88,.9,1350,6,2.1,1550,.007,1,2,9,660],
    ['stonewall','Stonewall LMG','lmg',19,8,690,60,3,1080,.075,1,2,10,720],
    ['firefly','Firefly Launcher','rocket',145,.55,850,1,2,610,.015,1,3,11,830],
    ['snowshoe','Snowshoe Pistol','pistol',38,3.5,680,14,1,1200,.025,1,2,12,790],
    ['wintertooth','Wintertooth Rifle','rifle',28,7,820,30,1.4,1200,.04,1,3,13,900],
    ['glacier','Glacier Scattergun','shotgun',21,1.4,460,8,1.65,890,.22,7,3,14,990],
    ['suncatcher','Suncatcher SMG','smg',19,12,550,40,1.45,1080,.085,1,3,15,1080],
    ['mirage','Mirage Long Rifle','sniper',125,1,1450,7,1.9,1700,.005,1,3,16,1200],
    ['dunehammer','Dunehammer LMG','lmg',27,8.6,750,70,2.7,1160,.065,1,3,17,1310],
    ['reedrunner','Reedrunner Carbine','rifle',33,7.5,850,32,1.3,1300,.035,1,3,18,1430],
    ['stormcall','Stormcall Launcher','rocket',225,.65,920,2,2.4,680,.012,1,4,19,1600],
    ['emberline','Emberline SMG','smg',24,13,590,44,1.35,1200,.075,1,3,20,1670],
    ['forgeheart','Forgeheart Repeater','rifle',40,7.6,890,36,1.35,1370,.025,1,4,21,1800],
    ['anvil','Anvil Scattergun','shotgun',30,1.55,490,10,1.6,950,.2,8,4,22,1940],
    ['liberator','Liberator LMG','lmg',35,10,810,90,2.5,1280,.055,1,4,23,2100],
    ['dawnpiercer','Dawnpiercer','sniper',185,1.1,1550,8,1.8,1850,.003,1,4,24,2260],
    ['whiskerfall','Whiskerfall Launcher','rocket',310,.78,1000,3,2.2,740,.008,1,4,25,2490],
    ['freedoms_echo','Freedom’s Echo','rifle',48,8.5,950,40,1.2,1450,.02,1,4,25,2700],
    ['cinder_pistol','Cinder Pistol','pistol',56,4.2,760,18,.95,1300,.02,1,4,23,2050],
    ['aurora_arc','Aurora Arc Projector','plasma',46,7,790,32,1.8,1050,.03,1,5,25,3250],
    ['phoenix_coil','Phoenix Flame Coil','flame',19,15,285,75,2.4,590,.19,1,5,24,3100],
    ['starlight','Starlight Particle Rifle','plasma',115,2.4,1120,12,2,1600,.008,1,5,25,3500],
    ['sparrow_burst','Sparrow Burst Carbine','rifle',12,3,760,30,1.55,1120,.03,1,2,5,490],
    ['badger_slug','Badger Slug Gun','shotgun',76,1.15,810,5,2,1150,.015,1,2,8,740],
    ['thundercoil','Thundercoil Charger','plasma',190,.8,1170,8,2.1,1320,.012,1,4,18,1840],
    ['bankshot','Bankshot Revolver','pistol',43,2.8,880,8,1.6,1100,.025,1,3,12,1090],
    ['owlet_guided','Owlet Guided Launcher','rocket',145,.8,1100,4,2.8,570,.01,1,4,17,1610],
    ['sunbeam','Sunbeam Projector','plasma',16,17,710,80,2.3,1800,.008,1,5,22,2860],
    ['hedgehog','Hedgehog Scatter Repeater','shotgun',17,2.6,460,12,1.7,900,.3,4,3,11,950],
    ['firecracker','Firecracker Autopistol','pistol',24,4.6,650,18,1.5,1060,.04,1,3,15,1350],
    ['silverline_rail','Silverline Rail Rifle','sniper',235,.65,1600,4,2.2,2000,.002,1,5,24,3170],
    ['triplethunder','Triplethunder Breacher','shotgun',12,1.1,510,18,2.4,940,.2,5,4,19,1970]
  ];
  const weapons = weaponRows.map(r=>({id:r[0],name:r[1],kind:r[2],damage:r[3],fireRate:r[4],range:r[5],magazine:r[6],reload:r[7],speed:r[8],spread:r[9],pellets:r[10],rarity:r[11],level:r[12],price:r[13],description:r[2]==='rocket'?'Explosive impact. Keep a little distance.':r[2]==='shotgun'?'Several pellets reward close range aim.':r[2]==='sniper'?'Accurate and powerful, with a deliberate rhythm.':'Reliable resistance equipment.'}));
  const mechanics={sparrow_burst:{mechanic:'burst',burstCount:3,burstDelay:.08,description:'A controlled three-shot burst rewards steady aim.'},badger_slug:{mechanic:'slug',penetration:1,knockback:42,description:'One heavy slug trades pellet spread for reach and knockback.'},thundercoil:{mechanic:'charge',chargeTime:.65,penetration:2,description:'Charge a powerful electric shot that punches through a line.'},bankshot:{mechanic:'ricochet',bounces:3,description:'Shots ricochet from solid cover up to three times.'},owlet_guided:{mechanic:'homing',homingStrength:3.2,description:'Guided rockets turn toward the closest hostile target.'},sunbeam:{mechanic:'beam',beamWidth:9,penetration:3,description:'A sustained beam burns through several enemies in a line.'},hedgehog:{mechanic:'spread',knockback:18,description:'A quick four-pellet spread makes a dependable close-range repeater.'},firecracker:{mechanic:'explosive',explosive:true,blastRadius:65,description:'Autopistol rounds burst into small impact explosions.'},silverline_rail:{mechanic:'charge',chargeTime:.85,penetration:5,description:'A deliberate rail charge penetrates an entire enemy formation.'},triplethunder:{mechanic:'burst',burstCount:3,burstDelay:.13,description:'Three rapid five-pellet blasts trade ammunition for close-range power.'}};
  weapons.forEach(w=>{w.mechanic={pistol:'semi',rifle:'auto',smg:'heat',sniper:'penetrate',shotgun:'pellets',lmg:'spinup',rocket:'rocket',plasma:'pierce',flame:'flame'}[w.kind];if(w.kind==='sniper')w.penetration=2;if(w.kind==='smg'){w.heatPerShot=.07;w.coolingRate=.22;w.overheatTime=.95+w.rarity*.06;}if(w.kind==='lmg')w.spinupTime=.6;Object.assign(w,mechanics[w.id]||{});});
  const mechanicInfo={semi:['Semi-auto','A deliberate shot with each trigger pull.'],auto:['Automatic','Hold the trigger for steady automatic fire.'],heat:['Heat build-up','Sustained fire builds heat. Release the trigger to cool the barrel.'],penetrate:['Piercing shot','A powerful rifle round passes through several targets.'],pellets:['Pellet spread','A spread of pellets rewards close-range aim.'],spinup:['Barrel spin-up','Hold fire to bring the heavy barrel up to full speed.'],rocket:['Explosive rocket','A slow projectile explodes in an area on impact.'],pierce:['Plasma piercing','Energy rounds travel through more than one enemy.'],flame:['Flame stream','A short-range stream burns targets over time.'],burst:['Burst fire','One trigger action fires a short, controlled burst.'],slug:['Heavy slug','One heavy round trades spread for range and knockback.'],charge:['Charged shot','Hold the trigger to charge a powerful penetrating shot.'],ricochet:['Ricochet','Shots bounce from solid cover to reach enemies at an angle.'],homing:['Guided rocket','Rockets curve toward a nearby hostile target.'],beam:['Energy beam','Hold the trigger for a sustained line of piercing energy.'],spread:['Wide spread','Several projectiles spread across a close-range area.'],explosive:['Explosive ammo','Shots create a small blast on impact.']};
  weapons.forEach(w=>{const info=mechanicInfo[w.mechanic];w.mechanicName=info[0];w.mechanicDescription=info[1];});
  const meleeNames = ['Combat Knife','Orchard Machete','Dual Daggers','Hunting Knife','Copper Bayonet','Ranger Spear','Stonecrest Cleaver','Miner’s Pick','Frostfang Blade','Icebreaker Hammer','Dune Scimitar','Sunscar Glaive','Reedwater Trident','Marshwarden Axe','Ember Sabre','Foundry Maul','Electrified Blade','Citadel Greatblade','Dawnbreaker','Whiskerfall Resistance Knife'];
  const melee = meleeNames.map((name,i)=>({id:'melee_'+i,name,damage:24+i*5,range:68+(i%4)*7,speed:.43+(i%4)*.06,rarity:i>17?5:Math.min(4,Math.floor(i/4)),level:1+Math.floor(i*1.2),price:i?100+i*90:0,crit:.05+(i%4)*.025,description:i%4===3?'A broad swing with heavy impact.':'A dependable close combat weapon.'}));
  const abilities = [
    {id:'airstrike',name:'Airstrike',kind:'airstrike',description:'Mark your aim for an aircraft bombing run.',cooldown:18,damage:95,radius:155,level:1,color:'#efad75'},
    {id:'medic_drop',name:'Medic Drop',kind:'heal',description:'Drop medical supplies that restore nearby allies.',cooldown:20,damage:65,radius:230,level:1,color:'#8ed7a5'},
    {id:'shockwave',name:'Shockwave',kind:'shockwave',description:'An expanding pulse throws nearby enemies backward.',cooldown:10,damage:80,radius:190,level:3,color:'#ecc16f'},
    {id:'smoke_bomb',name:'Smoke Bomb',kind:'smoke',description:'A cloud of smoke conceals your team from enemy aim.',cooldown:16,damage:0,radius:220,level:5,color:'#c1c9c9'},
    {id:'artillery',name:'Artillery Barrage',kind:'artillery',description:'Multiple shells strike a targeted area.',cooldown:24,damage:115,radius:190,level:7,color:'#f6b17b'},
    {id:'lightning',name:'Lightning Device',kind:'lightning',description:'Electric arcs leap between nearby enemy soldiers.',cooldown:14,damage:120,radius:350,level:9,color:'#9ee1ef'},
    {id:'minefield',name:'Minefield',kind:'mine',description:'Deploy several proximity explosives around your line.',cooldown:17,damage:145,radius:160,level:11,color:'#e2bd73'},
    {id:'flame_burst',name:'Flame Burst',kind:'fire',description:'An expanding ring of fire burns surrounding enemies.',cooldown:19,damage:130,radius:250,level:13,color:'#f5a16c'},
    {id:'reinforcements',name:'Resistance Reinforcements',kind:'reinforcements',description:'Summon temporary allied fighters to support the team.',cooldown:28,damage:145,radius:340,level:15,color:'#b1d0d3'},
    {id:'rocket_rain',name:'Rocket Rain',kind:'rockets',description:'A volley of guided missiles seeks nearby enemies.',cooldown:26,damage:185,radius:350,level:17,color:'#efad75'},
    {id:'cluster',name:'Cluster Grenades',kind:'cluster',description:'An explosive charge splits into several smaller blasts.',cooldown:24,damage:170,radius:250,level:20,color:'#d5e08e'},
    {id:'bomber',name:'Bomber Squadron',kind:'bomber',description:'A powerful sweeping aircraft attack crosses the battlefield.',cooldown:36,damage:275,radius:290,level:23,color:'#f7d385'}
  ];
  abilities.forEach((ability,index)=>ability.level=[1,1,1,2,2,3,5,7,9,11,14,18][index]);
  abilities.forEach((a,i)=>{a.category=['Offense','Support','Defense','Defense','Offense','Control','Control','Offense','Support','Offense','Offense','Offense'][i];a.unlockCost=0;});
  abilities.push(
    {id:'dashstep',name:'Dashstep',kind:'dashstep',category:'Movement',level:1,unlockCost:1,cooldown:5,radius:260,damage:0,color:'#8ee8d9',description:'Dash 260m along your aim with brief protection. Walls and locked gates still stop you.'},
    {id:'aegis_field',name:'Aegis Field',kind:'aegis',category:'Defense',level:1,unlockCost:1,cooldown:17,radius:90,damage:0,color:'#a4ddff',description:'Create an eight-second barrier that absorbs damage equal to 70% of your maximum health plus 40.'},
    {id:'frost_nova',name:'Frost Nova',kind:'frostnova',category:'Control',level:2,unlockCost:1,cooldown:13,radius:240,damage:28,color:'#a3edff',description:'Freeze nearby ordinary enemies for two seconds. Bosses take damage and suffer a longer chill instead.'},
    {id:'gravity_well',name:'Gravity Well',kind:'gravitywell',category:'Control',level:4,unlockCost:2,cooldown:20,radius:230,damage:16,color:'#c9a2ed',description:'Place a five-second field at your aim. It drags ordinary enemies inward and pulses damage; bosses resist the pull.'},
    {id:'mirror_ward',name:'Mirror Ward',kind:'mirrorward',category:'Defense',level:3,unlockCost:2,cooldown:19,radius:115,damage:0,color:'#dbf4ef',description:'For four seconds, nearby hostile projectiles reflect back as your shots. Explosions and melee still threaten you.'},
    {id:'vital_siphon',name:'Vital Siphon',kind:'siphon',category:'Support',level:5,unlockCost:2,cooldown:15,radius:420,damage:95,color:'#efa2b8',description:'Drain up to three enemies in your forward arc. Recover health equal to 30% of the actual damage dealt.'},
    {id:'venom_fan',name:'Venom Fan',kind:'venomfan',category:'Offense',level:3,unlockCost:1,cooldown:9,radius:700,damage:25,color:'#b9dc8a',description:'Fire seven piercing needles in a fan. Hits build the same stacking poison used by venom weapons.'},
    {id:'overdrive',name:'Overdrive',kind:'overdrive',category:'Offense',level:4,unlockCost:2,cooldown:21,radius:80,damage:0,color:'#ffcd87',description:'For six seconds your firearm recovers between shots 45% faster. Ammunition, reloads, and heat still matter.'},
    {id:'field_supply',name:'Field Supply',kind:'supply',category:'Support',level:2,unlockCost:1,cooldown:28,radius:240,damage:0,color:'#b5dbaa',description:'Give each nearby standing hero 200 reserve rounds, one medkit, and two grenades.'},
    {id:'revival_beacon',name:'Revival Beacon',kind:'revivebeacon',category:'Support',level:6,unlockCost:2,cooldown:32,radius:190,damage:0,color:'#a8efce',description:'Place a five-second medical beacon. It steadily heals allies and revives a fallen partner who stays within its field for two seconds.'},
    {id:'orbiting_blades',name:'Orbiting Blades',kind:'orbitblades',category:'Offense',level:8,unlockCost:3,cooldown:24,radius:105,damage:38,color:'#e8ddbc',description:'Four blades orbit you for eight seconds, cutting enemies they physically pass through. Position close to land repeated hits.'},
    {id:'grapple_hook',name:'Grapple Hook',kind:'grapple',category:'Movement',level:5,unlockCost:2,cooldown:10,radius:500,damage:45,color:'#d3c19c',description:'Hook an ordinary enemy in your aim and drag it toward you. The pull stops at cover; bosses cannot be dragged.'}
  );
  const equipment = [];
  weapons.forEach((w,i)=>equipment.push({id:w.id,name:w.name,slot:'weapon',weapon:i,rarity:w.rarity,level:w.level,price:w.price,requiredBosses:i?Math.max(0,Math.floor((w.level-1)/3)):0,coreCost:i?1+Math.floor(w.rarity*.7):0,description:w.description}));
  melee.forEach((w,i)=>equipment.push({id:w.id,name:w.name,slot:'melee',melee:i,rarity:w.rarity,level:w.level,price:w.price,description:w.description}));
  const armorSets = ['Scout','Woodland','Stoneguard','Winterwatch','Dunewarden','Riverguard','Forgeguard','Dawnkeeper'];
  armorSets.forEach((name,i)=>{
    equipment.push({id:'armor_'+i,name:name+' Jacket',slot:'armor',armor:.12+i*.035,health:24+i*16,rarity:Math.min(4,Math.floor(i/2)+1),level:1+i*3,price:90+i*180,description:'Reduces incoming damage and improves maximum health.'});
    equipment.push({id:'vest_'+i,name:name+' Battle Vest',slot:'armor',armor:.18+i*.036,health:18+i*14,rarity:Math.min(4,Math.floor(i/2)+1),level:2+i*3,price:120+i*190,description:'Heavy protective plating for difficult fights.'});
    equipment.push({id:'coat_'+i,name:name+' Field Coat',slot:'armor',armor:.08+i*.028,health:42+i*21,rarity:Math.min(4,Math.floor(i/2)+1),level:1+i*3,price:110+i*180,description:'A comfortable coat with a generous health bonus.'});
    equipment.push({id:'helmet_'+i,name:name+' Helmet',slot:'helmet',armor:.04+i*.014,health:12+i*7,rarity:Math.min(4,Math.floor(i/2)+1),level:1+i*3,price:75+i*140,description:'A reinforced helmet worn by resistance veterans.'});
    equipment.push({id:'cap_'+i,name:name+' Field Cap',slot:'helmet',armor:.025+i*.011,health:20+i*10,rarity:Math.min(4,Math.floor(i/2)+1),level:2+i*3,price:85+i*145,description:'A light field cap that adds extra health.'});
  });
  const accessoryNames = ['Acorn Charm','Ranger Compass','Copper Bell','Veteran’s Medal','Bramble Locket','Foxfire Pin','Moonstone Ring','Rescue Ribbon','Stonecrest Signet','Lucky Whisker','Winter Brooch','Frost Sapphire','Sunscar Pendant','Golden Beetle','Caravan Token','River Pearl','Reed Knot','Owl Feather','Forge Emblem','Clockwork Heart','Iron Promise','Citadel Key','Dawn Medallion','Freedom Ribbon','Feline Crown','Liberator’s Star','Resistance Seal','Old Scout’s Watch','Silver Fish','Songbird Pendant','Mountain Amber','Starlight Loop'];
  accessoryNames.forEach((name,i)=>equipment.push({id:'accessory_'+i,name,slot:'accessory',rarity:Math.min(4,Math.floor(i/7)),level:1+Math.floor(i*.75),price:70+i*65,health:i%3===0?15+i*2:0,damage:i%3===1?.03+i*.004:0,armor:i%3===2?.02+i*.002:0,description:i%3===0?'A resistance keepsake that strengthens your heart.':i%3===1?'An inspiring keepsake that increases damage.':'A lucky keepsake that softens incoming attacks.'}));
  equipment.push({id:'medkit',name:'Field Medkit',slot:'consumable',rarity:0,level:1,price:35,health:65,description:'Restore health during an expedition.'},{id:'ammo_crate',name:'Ammunition Pack',slot:'consumable',rarity:0,level:1,price:25,description:'Refill reserve ammunition.'});
  const modifiers={firefly:'explosive',stormcall:'areaDamage',whiskerfall:'areaDamage',freedoms_echo:'healOnKill',aurora_arc:'chain',phoenix_coil:'burn',starlight:'pierce',melee_16:'shock',melee_18:'crit',melee_19:'healOnKill',accessory_9:'fastDodge',accessory_18:'fireResist',accessory_23:'healOnKill',accessory_24:'crit',accessory_25:'areaDamage'};
  equipment.forEach(item=>{if(modifiers[item.id]){item.modifier=modifiers[item.id];item.description+=' Special: '+({explosive:'explosive ammunition',areaDamage:'larger blast radius',healOnKill:'recover health on a defeat',chain:'chained electric impact',burn:'burning ammunition',pierce:'piercing ammunition',shock:'electrified strikes',crit:'improved critical damage',fastDodge:'faster dodging',fireResist:'fire resistance'}[item.modifier])+'.';}});
  // Append both weapon and equipment entries after the original catalog; saved
  // inventory indices and existing weapon indices must keep their meanings.
  const treasureWeapons=[
    {id:'ember_seed',name:'Emberseed Repeater',kind:'rifle',damage:18,fireRate:4.8,magazine:20,reload:1.45,range:810,speed:1070,spread:.035,pellets:1,rarity:3,level:3,mechanic:'auto',burn:true,color:'#ffad68',rewardSource:'Ironwhisker or a Greenfields cavern guardian',description:'Every round ignites its victim for three seconds. Burning targets keep taking damage while you dodge.'},
    {id:'viper_bloom',name:'Viperbloom Needler',kind:'smg',damage:12,fireRate:8.5,magazine:32,reload:1.5,range:700,speed:1060,spread:.075,pellets:1,rarity:3,level:5,mechanic:'heat',poison:true,heatPerShot:.05,coolingRate:.3,rewardSource:'Venom Crown Rats and Mosswood cavern guardians',description:'Needles stack venom up to five times. Each stack drains health for four seconds.'},
    {id:'rime_fan',name:'Rimefan',kind:'shotgun',damage:16,fireRate:1.4,magazine:8,reload:1.8,range:590,speed:900,spread:.4,pellets:5,rarity:3,level:8,mechanic:'pellets',freeze:true,color:'#9ee9ff',rewardSource:'Stonecrest cavern guardians',description:'Five ice shards build frost. Three hits freeze ordinary enemies briefly; bosses are slowed.'},
    {id:'echo_fang',name:'Echofang Revolver',kind:'pistol',damage:42,fireRate:2.3,magazine:7,reload:1.5,range:1100,speed:1080,spread:.015,pellets:1,rarity:4,level:10,mechanic:'ricochet',bounces:2,enemyBounces:3,color:'#d6b8ff',rewardSource:'Ironhide Rollers and Stonecrest cavern guardians',description:'Each bullet seeks up to three different enemies after impact and bounces twice from stone.'},
    {id:'winter_halo',name:'Winter Halo',kind:'plasma',damage:31,fireRate:2.2,magazine:18,reload:1.8,range:900,speed:950,spread:.14,pellets:3,rarity:4,level:11,mechanic:'spread',freeze:true,penetration:1,color:'#a4f6ff',rewardSource:'Whiteclaw and Frostmarch cavern guardians',description:'Three parallel frost lances pierce targets and build freezing frost.'},
    {id:'sunburst_mortar',name:'Sunburst Mortar',kind:'rocket',damage:185,fireRate:.65,magazine:3,reload:2.3,range:1050,speed:590,spread:.02,pellets:1,rarity:4,level:14,mechanic:'rocket',blastRadius:190,burn:true,color:'#ffc178',rewardSource:'Sirocco and Sunscar cavern guardians',description:'Large blasts ignite every enemy caught in the explosion.'},
    {id:'wasp_swarm',name:'Wasp Swarm',kind:'rifle',damage:29,fireRate:2.1,magazine:30,reload:1.8,range:950,speed:1090,spread:.045,pellets:1,rarity:4,level:15,mechanic:'burst',burstCount:5,burstDelay:.065,poison:true,rewardSource:'Reedwater cavern guardians',description:'A five-needle burst rapidly builds five venom stacks on a single enemy.'},
    {id:'shatterglass',name:'Shatterglass',kind:'sniper',damage:168,fireRate:.8,magazine:5,reload:2.1,range:1500,speed:1700,spread:.004,pellets:1,rarity:4,level:17,mechanic:'penetrate',penetration:3,shatter:true,rewardSource:'Rimeplate Wardens and Frostmarch cavern guardians',description:'Deals double damage to chilled enemies and shatters their frost into a blast.'},
    {id:'cinderwheel',name:'Cinderwheel',kind:'shotgun',damage:25,fireRate:1.15,magazine:10,reload:2,range:670,speed:1050,spread:.5,pellets:7,rarity:4,level:19,mechanic:'pellets',burn:true,enemyBounces:1,rewardSource:'Cinderback Beasts and Emberworks cavern guardians',description:'Seven burning pellets each bounce to one additional enemy.'},
    {id:'storm_loom',name:'Storm Loom',kind:'plasma',damage:59,fireRate:4.2,magazine:24,reload:1.8,range:1040,speed:1250,spread:.02,pellets:1,rarity:5,level:20,mechanic:'pierce',penetration:1,chain:true,shock:true,color:'#c4f7ff',rewardSource:'Geargnash and Emberworks cavern guardians',description:'Arcs fork to nearby enemies and interrupt ordinary enemies with a short stun.'},
    {id:'eventide',name:'Eventide Prism',kind:'plasma',damage:155,fireRate:.8,magazine:9,reload:2.2,range:1450,speed:1500,spread:.13,pellets:3,rarity:5,level:23,mechanic:'charge',chargeTime:.8,penetration:3,enemyBounces:1,color:'#d2a8ff',rewardSource:'Blackglass Knights and Blackbanner cavern guardians',description:'Release three charged lances. Each lance pierces, then turns toward another enemy.'},
    {id:'rat_kings_rattle',name:'Rat King’s Rattle',kind:'rocket',damage:240,fireRate:.8,magazine:4,reload:2.4,range:1200,speed:650,spread:.03,pellets:1,rarity:5,level:24,mechanic:'homing',homingStrength:2.1,blastRadius:175,poison:true,rewardSource:'The deepest Blackbanner cavern guardians',description:'Seeking shells release a venomous explosion that poisons the entire group.'}
  ];
  for(const gun of treasureWeapons){gun.price=0;gun.rewardOnly=true;gun.mechanicName=mechanicInfo[gun.mechanic][0];gun.mechanicDescription=gun.description;const index=weapons.push(gun)-1;equipment.push({id:gun.id,name:gun.name,slot:'weapon',weapon:index,rarity:gun.rarity,level:gun.level,price:0,rewardOnly:true,rewardSource:gun.rewardSource,description:gun.description});}
  const rewardArmor=[
    {id:'armor_rollshell',name:'Rollshell Mantle',level:5,rarity:3,armor:.24,health:45,modifier:'rollshell',rewardSource:'Ironhide Rollers',description:'Dodges push nearby enemies away and recover 18% faster.'},
    {id:'armor_wayfarer',name:'Wayfarer’s Thread',level:8,rarity:3,armor:.19,health:65,modifier:'wayfarer',rewardSource:'Needleblade Fencers and Stonecrest cavern guardians',description:'Move 14% faster. Dodging reloads three rounds from your reserve.'},
    {id:'armor_rimeheart',name:'Rimeheart Plate',level:11,rarity:4,armor:.32,health:80,modifier:'rimeheart',rewardSource:'Rimeplate Wardens and Frostmarch cavern guardians',description:'Cold cannot slow you. Taking damage releases a frost pulse once every six seconds.'},
    {id:'armor_venomskin',name:'Venomskin Coat',level:15,rarity:4,armor:.28,health:105,modifier:'venomskin',rewardSource:'Venom Crown Rats and Reedwater cavern guardians',description:'Resist poison by 75%. Defeating a poisoned enemy restores 12 health.'},
    {id:'armor_cinderproof',name:'Cinderproof Carapace',level:19,rarity:4,armor:.38,health:110,modifier:'cinderproof',rewardSource:'Cinderback Beasts and Emberworks cavern guardians',description:'Take 70% less fire damage. Dodges leave burning ground behind you.'},
    {id:'armor_phaseweave',name:'Phaseweave Shroud',level:23,rarity:5,armor:.30,health:145,modifier:'phaseweave',rewardSource:'Blackglass Knights and Blackbanner cavern guardians',description:'Dodge protection lasts a quarter-second longer. Killing an enemy grants a brief shield once every 12 seconds.'}
  ];
  rewardArmor.forEach(a=>equipment.push({...a,slot:'armor',price:0,rewardOnly:true}));
  const shopWeapons=['field_pistol','woodland_carbine','trench_scattergun','foxguard','peakwatch','snowshoe','suncatcher','reedrunner','emberline','liberator'];
  const bossRewards=[['ember_seed','sparrow_burst'],['viper_bloom','briar_smg'],['echo_fang','badger_slug'],['winter_halo','rime_fan'],['sunburst_mortar','owlet_guided'],['wasp_swarm','stormcall'],['storm_loom','cinderwheel','melee_16'],['eventide','dawnpiercer','melee_17','melee_18'],['rat_kings_rattle','starlight','melee_19']];
  for(const item of equipment){if(item.weapon!=null&&!shopWeapons.includes(item.id)){item.rewardOnly=true;if(!item.rewardSource){const region=Math.min(7,Math.floor(((item.level||1)-1)/3));item.rewardSource=regions[region].commander+' and elite enemies in '+regions[region].name;}}if(item.melee>=16){item.rewardOnly=true;item.rewardSource='Elite commanders in '+regions[Math.min(7,Math.floor((item.level-1)/3))].name;}}
  // Regular troops never grant equipment, including advanced and elite variants.
  const enemyRewards={};
  for(const item of equipment.filter(i=>i.melee>=16)){const boss=item.melee===16?6:item.melee===19?8:7;item.rewardSource=bosses[boss].name+' or veteran elites in '+regions[boss===6?6:7].name;}
  const dungeonRewards=[['ember_seed','armor_rollshell'],['sparrow_burst','ember_seed'],['viper_bloom','armor_rollshell'],['briar_smg','viper_bloom'],['echo_fang','armor_wayfarer'],['rime_fan','badger_slug'],['winter_halo','armor_rimeheart'],['shatterglass','thundercoil'],['sunburst_mortar','owlet_guided'],['firecracker','bankshot'],['wasp_swarm','armor_venomskin'],['stormcall','viper_bloom'],['cinderwheel','armor_cinderproof'],['storm_loom','sunbeam'],['eventide','armor_phaseweave'],['rat_kings_rattle','starlight']];
  // Ordinary archetypes never award equipment. Every exclusive has a finite,
  // named campaign source. Each commander cache offers a choice of ONE item.
  for(const item of equipment.filter(i=>i.rewardOnly)){
    let boss=bossRewards.findIndex(pool=>pool.includes(item.id));
    if(boss<0){boss=Math.min(7,Math.floor(((item.level||1)-1)/3));bossRewards[boss].push(item.id);}
    const caves=dungeonRewards.map((pool,i)=>pool.includes(item.id)?regions[Math.floor(i/2)].name:null).filter(Boolean);
    item.rewardSource=bosses[boss].name+(caves.length?' or '+[...new Set(caves)].join(' / ')+' cavern guardians':'');
    if(item.weapon!=null)weapons[item.weapon].rewardSource=item.rewardSource;
  }
  const quests = [];
  regions.forEach((r,i)=>{
    const p='main_'+i+'_';
    const prior=i?'main_'+(i-1)+'_2':null;
    quests.push({id:p+'0',title:['A Spark in Greenfields','Into the Mosswood','The Mountain Road','A Winter Offensive','The Long Caravan','Across the Delta','Break the War Machine','At the Gates'][i],description:'Liberate '+r.name+'’s first occupied outpost and open the supply road.',type:'liberate',region:i,target:'base_'+i+'_0',required:1,rewardGold:100+i*90,rewardXp:90+i*80,main:true,prerequisite:prior});
    quests.push({id:p+'1',title:['Cut the Supply Line','Silence the Forest Guns','Take the High Ground','Thaw the Front Line','The Desert Signal','Clear the River','Sabotage the Foundry','The Last Approach'][i],description:'Secure the second enemy stronghold in '+r.name+'.',type:'liberate',region:i,target:'base_'+i+'_1',required:1,rewardGold:150+i*100,rewardXp:140+i*90,main:true,prerequisite:p+'0'});
    quests.push({id:p+'2',title:i===7?'Operation Whiskerfall':'Defeat '+r.commander,description:'Confront '+r.commander+' and free '+r.name+' from occupation.',type:'boss',region:i,target:'boss_'+i,required:1,rewardGold:320+i*160,rewardXp:350+i*160,main:true,prerequisite:p+'1'});
    const sides = [
      {type:'explore',target:'cave_'+i+'_0',title:'Secrets of '+r.name,description:'Find the hidden cavern marked by local scouts.'},
      {type:'cache',target:'cache_'+i+'_0',title:'Supplies for the Resistance',description:'Recover a lost resistance supply cache.'},
      {type:'rescue',target:'base_'+i+'_2',title:'Bring Them Home',description:'Clear the prison outpost and free the captive villagers.'},
      {type:'convoy',target:'base_'+i+'_3',title:'Stop the War Convoy',description:'Break the convoy depot’s guard and recover its supplies.'},
      {type:'kill',target:i,title:'Reclaim the Countryside',description:'Defeat occupying troops anywhere in this region.',required:12+i*2}
    ];
    sides.forEach((s,j)=>quests.push(Object.assign({id:'side_'+i+'_'+j,region:i,required:1,rewardGold:100+i*65+j*15,rewardXp:90+i*55+j*20,main:false,prerequisite:null},s)));
    const startX=r.x+1100,startY=r.y+1280,destination={x:r.x+1386,y:r.y+1900.8};
    const waypoints=[{x:startX,y:startY},... [.12,.24,.36,.44].map(t=>({x:r.x+1100+650*t,y:r.y+1100+1820*t}))];
    quests.push({id:'escort_'+i,title:['A Courier’s First Run','Letters through Mosswood','Medicine for the Pass','Warmth for Snowhaven','Water for the Caravan','The Delta Messenger','A Package for the Forge','The Last Dispatch'][i],description:'Meet the courier south of '+['Willow Camp','Mossbell','Goat’s Rest','Snowhaven','Sundial Oasis','Otter’s Crossing','Ashford Refuge','Dawnbridge'][i]+', then stay close while they follow the marked road to the forward meeting point.',type:'escort',region:i,level:r.level,target:'escort_'+i,required:1,startX,startY,x:destination.x,y:destination.y,waypoints,escortKind:'courier',escortHp:220+i*35,escortSpeed:80,waveCount:2,rewardGold:240+i*100,rewardXp:180+i*80,main:false,prerequisite:null});
    quests.push({id:'defend_'+i,title:'Hold the '+['Orchard','Mosswood','Stonecrest','Frostmarch','Sunscar','Reedwater','Emberworks','Citadel'][i]+' Road',description:'Rally at the marked resistance post. Remain nearby and repel three attack waves for 45 seconds.',type:'defend',region:i,level:r.level,target:'defend_'+i,required:1,duration:45,waveCount:3,rewardGold:300+i*110,rewardXp:230+i*85,main:false,prerequisite:'main_'+i+'_0'});
    const officerName=['Captain Gristle','Captain Thorn','Captain Scree','Captain Rime','Captain Dustfang','Captain Murk','Captain Rivet','Captain Onyx'][i];
    quests.push({id:'assassination_'+i,title:'Wanted: '+officerName,description:'Find '+officerName+' at '+['Millroad Garrison','Timberline Barracks','Summit Redoubt','Frozen Battery','Sunscar Barracks','Floodgate Battery','Ironworks Garrison','Capital Garrison'][i]+'. Defeat this named officer; the rest of the base is optional.',type:'assassination',region:i,level:r.level+1,target:'base_'+i+'_1_guard_7',targetLocation:'base_'+i+'_1',targetName:officerName,required:1,rewardGold:350+i*100,rewardXp:220+i*80,main:false,prerequisite:null});
    const generalName=['General Soot','General Nettle','General Basalt','General Hoarfang','General Copperdune','General Bogclaw','General Crucible','General Nightiron'][i];
    quests.push({id:'bounty_'+i,title:'Commander Bounty: '+generalName,description:'Track down '+generalName+' at the marked supply depot. This armored commander carries a valuable resistance bounty.',type:'bounty',region:i,level:r.level+2,target:'base_'+i+'_3_guard_6',targetLocation:'base_'+i+'_3',targetName:generalName,required:1,rewardGold:500+i*120,rewardXp:280+i*90,main:false,prerequisite:null});
  });
  quests.find(q=>q.id==='main_7_2').title='Break Vex’s Command';
  quests.push({id:'main_berlin_final',title:'Operation Whiskerfall: The Berlin Reckoning',description:'Defeat all eight regional commanders, enter the unlocked Berlin Sector, and end Adolph Whisker’s rule. Killing him wins the campaign.',type:'boss',region:7,target:'boss_berlin',required:1,rewardGold:6000,rewardXp:6000,main:true,prerequisite:'main_7_2',requiresAllBosses:true});
  // These are authored, multi-stage jobs. Their actions are handled by the mission system;
  // collecting an object, healing a cat or arming a relay never counts as clearing a camp.
  function operation(id,title,type,region,description,points,steps) {
    const r=regions[region],objectives=points.map((p,n)=>({id:id+'_point_'+n,x:r.x+p[0],y:r.y+p[1],displayType:p[2],label:p[3]}));
    const namedSteps=steps.map(s=>Object.assign({},s,{targets:s.targets.map(n=>typeof n==='number'?objectives[n].id:n)}));
    const q={id,title,type,region,description,main:false,target:objectives[0].id,objectives,steps:namedSteps,required:namedSteps.length,rewardGold:260+region*110,rewardXp:210+region*85,prerequisite:null,giverNpcId:'npc_resident_'+region+'_'+(quests.filter(t=>t.steps&&t.region===region).length%2)};
    quests.push(q);return q;
  }
  operation('sabotage_0','Paws Off the Airwaves','sabotage',0,'Moth has mapped three orchard alarm relays. Disable each relay without needing to wipe out the whole garrison, then bring her the fuses.',[[1810,1840,'relay','Orchard alarm relay'],[2160,1800,'relay','Millroad alarm relay'],[2320,2200,'relay','Wheatfield alarm relay']],[{action:'sabotage',label:'Remove the three alarm fuses',targets:[0,1,2]},{action:'report',label:'Return the fuses to Moth',targets:['npc_resident_0_0']}]);
  operation('delivery_0','The Baker’s Last Basket','delivery',0,'Marmalade hid a basket of bread beside the old road. Recover it and carry it home. You move more slowly while carrying the basket.',[[1510,2130,'parcel','Marmalade’s bread basket']],[{action:'recover',label:'Recover the basket beside the old road',targets:[0],carry:true},{action:'deliver',label:'Bring the bread to Marmalade in Willow Camp',targets:['npc_resident_0_1'],consumeCarry:true}]);
  operation('triage_1','Not One Paw Left Behind','triage',1,'Nurse Fern’s missing scouts are alive. Use a field medkit on each wounded cat, then report back. Each patient needs one medkit.',[[1780,2200,'wounded','Wounded Scout Alder'],[2170,2500,'wounded','Wounded Scout Sorrel']],[{action:'heal',label:'Treat Alder and Sorrel with field medkits',targets:[0,1],medkit:true},{action:'report',label:'Tell Nurse Fern both scouts are stable',targets:['npc_resident_1_0']}]);
  operation('recon_1','What the Owls Heard','recon',1,'Professor Purr needs recordings from three listening stones. Interact at each point, then remain close and clear of enemies for four seconds.',[[1470,2190,'signal','North listening stone'],[2000,2830,'signal','Old oak listening stone'],[2410,3170,'signal','South listening stone']],[{action:'scan',label:'Record all three listening stones',targets:[0,1,2],duration:4},{action:'report',label:'Deliver the recordings to Professor Purr',targets:['npc_resident_1_1']}]);
  operation('demolition_2','An Avalanche of Our Own','demolition',2,'Miner Flint has placed charges beside the battery road. Arm both charges, withdraw to the detonator and bring the mountainside down on the supply line.',[[1620,2620,'charge','West rock charge'],[1980,2770,'charge','East rock charge'],[1510,3060,'terminal','Quarry remote detonator']],[{action:'plant',label:'Arm both rock charges',targets:[0,1]},{action:'detonate',label:'Trigger the charges from the remote detonator',targets:[2],blastTargets:[0,1]},{action:'report',label:'Tell Miner Flint the supply road is cut',targets:['npc_resident_2_0']}]);
  operation('recovery_2','A Map Written in Echoes','recovery',2,'Cartographer Pebble scattered three survey pages while escaping the quarry. Search the different overlooks and return the whole map.',[[890,1950,'parcel','North survey page'],[1600,3440,'parcel','Quarry survey page'],[2440,3980,'parcel','Summit survey page']],[{action:'recover',label:'Gather the three scattered survey pages',targets:[0,1,2]},{action:'report',label:'Return the complete survey to Pebble',targets:['npc_resident_2_1']}]);
  operation('signal_3','The Aurora Code','signal',3,'Radio Cat Solstice can break Whiteclaw’s cipher if you tune the northern dishes in order. Defend the last receiver while its signal uploads.',[[1540,2040,'relay','First aurora dish'],[1860,2450,'relay','Second aurora dish'],[2200,2900,'signal','Aurora uplink receiver']],[{action:'activate',label:'Tune the first dish to the moon frequency',targets:[0]},{action:'activate',label:'Tune the second dish to the aurora frequency',targets:[1]},{action:'hold',label:'Stay at the uplink while the cipher uploads',targets:[2],duration:14,ambush:2},{action:'report',label:'Give the decoded signal to Solstice',targets:['npc_resident_3_0']}]);
  operation('delivery_3','A Hearth for Snowhaven','delivery',3,'Grandma Mittens needs heater cells before nightfall. Recover both cells, carry them through the snow and bring them to her hearth.',[[940,2400,'parcel','Abandoned heater cell'],[1690,2930,'parcel','Frozen heater cell']],[{action:'recover',label:'Recover both heater cells',targets:[0,1],carry:true},{action:'deliver',label:'Bring the heater cells to Grandma Mittens',targets:['npc_resident_3_1'],consumeCarry:true}]);
  operation('recovery_4','Water Beneath the Sand','recovery',4,'Pumpkeeper Fennel knows where the old well survives. Open its intake, keep the purifier running, and carry a clean water sample back to the oasis.',[[1520,2400,'relay','Buried well intake'],[1870,2830,'terminal','Sandglass water purifier']],[{action:'activate',label:'Open the buried well intake',targets:[0]},{action:'hold',label:'Keep the purifier running for twelve seconds',targets:[1],duration:12,ambush:2,carry:true},{action:'deliver',label:'Bring clean water to Pumpkeeper Fennel',targets:['npc_resident_4_0'],consumeCarry:true}]);
  operation('infiltration_4','The Mirage Ledger','infiltration',4,'Archivist Sable has one chance to expose a supply fraud. Read the depot schedule, take the real ledger from its hiding place and return before it disappears.',[[2230,3260,'terminal','Depot schedule terminal'],[2900,3130,'parcel','Hidden caravan ledger']],[{action:'scan',label:'Decode the depot schedule',targets:[0],duration:5},{action:'recover',label:'Recover the real caravan ledger',targets:[1]},{action:'report',label:'Bring the ledger to Archivist Sable',targets:['npc_resident_4_1']}]);
  operation('triage_5','Lanterns in the Fog','triage',5,'Doctor Willow’s fishing crew was caught in a gas attack. Find all three lanterns and use one field medkit to treat each stranded fisher.',[[1710,2280,'wounded','Fisher Minnow'],[2150,2900,'wounded','Fisher Kelp'],[2450,3490,'wounded','Fisher Tansy']],[{action:'heal',label:'Treat the three fishers with field medkits',targets:[0,1,2],medkit:true},{action:'report',label:'Report the rescue to Doctor Willow',targets:['npc_resident_5_0']}]);
  operation('sabotage_5','The River Remembers','sabotage',5,'Lockkeeper Ripple wants the delta flowing again. Release both pressure valves before opening the main floodgate. No amount of defeated guards can turn these wheels for you.',[[1570,2380,'relay','West pressure valve'],[2240,2760,'relay','East pressure valve'],[2370,3270,'terminal','River floodgate wheel']],[{action:'activate',label:'Release both pressure valves',targets:[0,1]},{action:'activate',label:'Open the main river floodgate',targets:[2]},{action:'report',label:'Tell Lockkeeper Ripple the river is free',targets:['npc_resident_5_1']}]);
  operation('demolition_6','The Quiet Assembly Line','demolition',6,'Welder Copper has found the furnace’s weak points. Plant three shaped charges and set them off from a safe console to stop the war production.',[[1760,2090,'charge','Cooling pipe charge'],[2130,2510,'charge','Drive belt charge'],[2430,2880,'charge','Exhaust charge'],[1730,3180,'terminal','Foundry safety console']],[{action:'plant',label:'Arm the three shaped charges',targets:[0,1,2]},{action:'detonate',label:'Use the safety console to destroy the line',targets:[3],blastTargets:[0,1,2]},{action:'report',label:'Tell Welder Copper the assembly line has stopped',targets:['npc_resident_6_0']}]);
  operation('recovery_6','Cinder’s Spare Heart','recovery',6,'Tinker Button can build a refugee warning beacon from a crashed drone. Retrieve its core, then spend eight materials to repair the beacon outside Ashford.',[[2720,2590,'parcel','Crashed drone heart'],[1410,1550,'signal','Refugee warning beacon']],[{action:'recover',label:'Retrieve the crashed drone’s power core',targets:[0]},{action:'repair',label:'Repair the warning beacon using eight materials',targets:[1],materials:8},{action:'report',label:'Show Tinker Button the beacon is working',targets:['npc_resident_6_1']}]);
  operation('infiltration_7','Nine Lives of Intelligence','infiltration',7,'Agent Velvet needs proof of what waits in Berlin. Record the outer patrol frequencies, steal the gate manifest and return to Dawnbridge.',[[1580,2070,'signal','Blackbanner listening post'],[2090,2440,'parcel','Berlin gate manifest']],[{action:'scan',label:'Record the outer patrol frequencies',targets:[0],duration:6},{action:'recover',label:'Steal the Berlin gate manifest',targets:[1]},{action:'report',label:'Give Agent Velvet the Berlin intelligence',targets:['npc_resident_7_0']}]);
  operation('signal_7','One Voice Before Dawn','signal',7,'Poet Patches wants the captive city to hear hope. Start the old transmitter, protect its broadcast and return when the resistance anthem reaches Berlin.',[[1760,2860,'terminal','Old city transmitter']],[{action:'activate',label:'Tune the old city transmitter',targets:[0]},{action:'hold',label:'Protect the resistance broadcast for twenty seconds',targets:[0],duration:20,ambush:3},{action:'report',label:'Tell Poet Patches the city heard the anthem',targets:['npc_resident_7_1']}]);
  const npcs=[];
  regions.forEach((r,i)=>{
    const towns=['town_'+i,'town_way_'+i];if(i<4)towns.push('town_extra_'+i);
    towns.forEach((townId,j)=>npcs.push({id:'npc_'+townId,townId,region:i,name:(j===0?['Captain Saffron','Scout Juniper','Ranger Crag','Medic Lumi','Trader Sol','Harbormaster Reed','Engineer Cinder','Captain Dawn'][i]:j===1?'Wayfinder '+['Poppy','Bramble','Granite','Flurry','Saffron','Ripple','Coal','Starling'][i]:'Scout '+['Hazel','Fern','Slate','Aurora'][i]),portrait:i%4,questIds:['main_'+i+'_0','main_'+i+'_1','main_'+i+'_2',...Array.from({length:5},(_,n)=>'side_'+i+'_'+n),'escort_'+i,'defend_'+i,'assassination_'+i,'bounty_'+i],dialogue:[j===1?'Rest your paws. This waystation is peaceful, and the forge is ready.':'Welcome, resistance fighter. You are safe here. Let us plan our next move.',r.commander+' holds '+r.name+'. Our scouts have marked the installations on your map.','I have courier escorts, defensive patrols, named officer assignments, and commander bounties. Choose a mission to see its first step and a map marker.','Speak to me for missions, visit the merchant for supplies, and use the forge to strengthen your gun and armour.']}));
  });
  const residents=[
    [['Moth','scout','I used to mend radios. Now I pull their teeth. A relay goes silent when its fuse is in your pocket.','Listen for the orchard bells. Three rings means the patrol has changed.'],['Marmalade','civilian','My oven is cold, but my neighbors still need supper. A basket of bread can be as important as a crate of bullets.','Pip used to steal the burnt crusts. I always left one where he could reach it.']],
    [['Nurse Fern','medic','Alder and Sorrel came back for me when the trees caught fire. I will not leave them in that forest.','Keep a medkit for someone other than yourself. Sometimes that is how a village survives.'],['Professor Purr','scholar','The owls remember every engine they hear. I only need a few quiet recordings to learn the enemy’s route.','Stand still long enough and this forest tells you who has passed through it.']],
    [['Miner Flint','engineer','We know the mountain better than Flintfang. Put our charges in place and let gravity take our side.','Do not stand beside a charge when you press its detonator. That lesson cost me half a whisker.'],['Cartographer Pebble','scout','A map is a promise that a frightened traveler can find home. Mine is scattered over three overlooks.','I draw every refuge as a little paw print. Follow those and you will always find a friend.']],
    [['Radio Cat Solstice','engineer','The aurora hides our signal. Tune the dishes in order and I can turn Whiteclaw’s own cipher against him.','A transmission needs time. Hold the receiver even when the snow starts moving.'],['Grandma Mittens','civilian','These paws knitted coats for three generations. Today I need two heater cells and a brave courier.','You look cold, dear. The snow takes enough from us without taking our manners too.']],
    [['Pumpkeeper Fennel','engineer','The well is under the old sand road. Open the intake before you start the purifier or you will burn it dry.','Water belongs to everyone who is thirsty. No commander can change that.'],['Archivist Sable','scholar','The convoy books do not agree. One honest ledger could feed this oasis for a year.','Facts are patient things. Bring me the real ones, and I will make them loud.']],
    [['Doctor Willow','medic','Three fishing lanterns failed to return. Take medkits; the marsh gas hurts lungs long after the gunfire stops.','The delta is a family of little boats. If one is missing, we all feel the empty place.'],['Lockkeeper Ripple','engineer','Two valves, then the big wheel. Open them in that order and the river will breathe again.','My grandfather taught me every bend in this water. I still talk to him when the fog comes in.']],
    [['Welder Copper','engineer','That assembly line makes weapons all night. Three charges and one safe console can finally let Ashford sleep.','Give a machine a purpose worth serving. Otherwise all you built is a louder problem.'],['Tinker Button','engineer','The refugees need a warning beacon. Bring me a drone heart and eight pieces of useful scrap; we can make one.','I once made a toy mouse that chased itself. The children liked it better than my serious inventions.']],
    [['Agent Velvet','scout','Berlin is sealed by eight command seals. Take down every regional boss and its gate loses power. Vex is only one of them.','Adolph Whisker can blink across his arena. Save a dodge for the place he lands, not the place he left.'],['Poet Patches','civilian','There are cats inside Berlin who think we forgot them. Keep my transmitter alive long enough to prove we did not.','When the anthem reaches the city, listen between the verses. That silence is people deciding to hope.']]
  ];
  residents.forEach((pair,i)=>pair.forEach((p,j)=>{const id='npc_resident_'+i+'_'+j,job=quests.find(q=>q.giverNpcId===id);npcs.push({id,townId:'town_'+i,region:i,resident:true,offsetX:j?230:-320,offsetY:j?270:220,name:p[0],role:p[1],portrait:(i+j)%4,questIds:job?[job.id]:[],dialogue:[p[2],p[3],job?'I have one personal request: '+job.title+'. Ask about my work when you are ready.':'You have given this village another day.'],topics:{local:[p[3],regions[i].commander+' still commands the regional stronghold. The bounty center has the latest poster.'],advice:[p[2],j?'Carry a second weapon that covers your first weapon’s weakness.':'A knife can end a fight quickly, but getting close means accepting the danger.']}});}));
  npcs.filter(n=>!n.resident).forEach(n=>{n.role=n.name.startsWith('Medic')?'medic':n.name.startsWith('Engineer')?'engineer':'scout';n.topics={local:[regions[n.region].description,'The bounty center lists every major boss and the sector where they hide.'],advice:['Early orchard camps hold small patrols. Watch their tells and pick your approach.','Berlin opens after all eight commanders fall. Adolph Whisker is the final target.']};n.dialogue.push(n.topics.local[0]);});
  // Every assignment has a real contact. Regional dispatches move between the
  // refuge and waystation, then hand the player to the next region's captain.
  regions.forEach((r,i)=>{
    const captain='npc_town_'+i,wayfinder='npc_town_way_'+i,scout=i<4?'npc_town_extra_'+i:wayfinder;
    const owner={['main_'+i+'_0']:captain,['main_'+i+'_1']:wayfinder,['main_'+i+'_2']:captain,['side_'+i+'_0']:scout,['side_'+i+'_1']:wayfinder,['side_'+i+'_2']:captain,['side_'+i+'_3']:wayfinder,['side_'+i+'_4']:scout,['escort_'+i]:wayfinder,['defend_'+i]:captain,['assassination_'+i]:scout,['bounty_'+i]:captain};
    for(const q of quests.filter(q=>q.region===i)){
      q.giverNpcId=q.giverNpcId||owner[q.id]||captain;
      if(q.id==='main_'+i+'_0')q.nextQuestId='main_'+i+'_1';
      else if(q.id==='main_'+i+'_1')q.nextQuestId='main_'+i+'_2';
      else if(q.id==='main_'+i+'_2')q.nextQuestId=i<7?'main_'+(i+1)+'_0':'main_berlin_final';
      else if(q.id!=='main_berlin_final')q.nextQuestId=q.giverNpcId===captain?'escort_'+i:'main_'+i+'_0';
    }
    const personal=quests.filter(q=>q.region===i&&q.steps);
    if(personal.length>1){personal[0].nextQuestId=personal[1].id;personal[1].nextQuestId='escort_'+i;}
  });
  for(const n of npcs)n.questIds=quests.filter(q=>q.giverNpcId===n.id).map(q=>q.id);
  for(const q of quests){const next=quests.find(n=>n.id===q.nextQuestId),contact=next&&npcs.find(n=>n.id===next.giverNpcId);if(contact)q.followUp='After this assignment, speak with '+contact.name+' about “'+next.title+'”.';}
  const bossPosters=bosses.map((b,i)=>({bossId:b.id,bossIndex:i,name:b.name,region:i<8?i:7,sector:i===8?'Berlin Sector':regions[i].name,locationId:i===8?'boss_berlin':'boss_'+i,questId:i===8?'main_berlin_final':'main_'+i+'_2',finalBoss:!!b.finalBoss,attackHints:b.attackHints}));
  OW.Content = {regions,sectors,enemies,enemyScaling,bosses,bossPosters,weapons,melee,abilities,equipment,shopWeapons,bossRewards,enemyRewards,dungeonRewards,quests,rarities,npcs,characters:[{id:'tabby',name:'Captain Pip',color:'#dca26a'},{id:'blackcat',name:'Scout Nyx',color:'#58616f'},{id:'fox',name:'Ranger Ember',color:'#c47b52'},{id:'snowcat',name:'Medic Luna',color:'#d5d9d4'}],version:1};
})();
