/* Crown of the Tides — authored archipelago and deterministic voyage content. */
(() => {
  'use strict';
  const WIDTH = 52000, HEIGHT = 44000;
  const regions = [
    {id:'calm',name:'Calm Sea',cx:8600,cy:8600,r:10800,danger:0.08,color:'#1e8f9b',waterColor:'#126677',biome:'tropical',weather:'clear',description:'Sheltered anchorages and a captain\'s first command.'},
    {id:'sapphire',name:'Sapphire Shoals',cx:21400,cy:7200,r:10200,danger:0.24,color:'#287dbb',waterColor:'#145c82',biome:'shoals',weather:'clear',description:'Shallow turquoise banks and merchant lanes among brilliant reefs.'},
    {id:'pearl',name:'Pearl Coast',cx:33300,cy:9000,r:10100,danger:0.34,color:'#2dafac',waterColor:'#146d79',biome:'tropical',weather:'clear',description:'White beaches shelter smugglers and wealthy convoys.'},
    {id:'indigo',name:'Indigo Trench',cx:9400,cy:33000,r:13900,danger:0.48,color:'#7769b1',waterColor:'#233c65',biome:'deep',weather:'mist',description:'Privateer sails stalk the deep western passage.'},
    {id:'emerald',name:'Emerald Expanse',cx:33000,cy:27000,r:11500,danger:0.65,color:'#268d70',waterColor:'#15574f',biome:'tropical',weather:'clear',description:'Fortified islands divide the great southern trade route.'},
    {id:'crimson',name:'Crimson Strait',cx:44000,cy:36000,r:12800,danger:0.94,color:'#bc655f',waterColor:'#563b4e',biome:'volcanic',weather:'ash',description:'Volcanic shores and the Dread Admiral\'s battle fleet.'},
    {id:'storm',name:'Stormbreak Sea',cx:17000,cy:22000,r:10600,danger:0.70,color:'#758ba0',waterColor:'#253a52',biome:'storm',weather:'storm',description:'Thunderheads gather over wreck-strewn channels and privateer battle lines.'},
    {id:'frost',name:'Frostwater',cx:44000,cy:5500,r:8700,danger:0.67,color:'#b0e7ee',waterColor:'#315f81',biome:'ice',weather:'snow',description:'Glittering ice floes, frozen cliffs, and pale-sailed northern raiders.'},
    {id:'bone',name:'The Bone Sea',cx:46500,cy:21100,r:7900,danger:0.88,color:'#94ceb7',waterColor:'#203e40',biome:'haunted',weather:'ghost',description:'Green witchfire and deathly fog conceal the restless skeleton fleets.'}
  ];

  const definitions = {
    sloop:{L:250,W:86,hp:340,speed:245,turn:1.05,cannons:3,reload:3.8,damage:24,crewCap:16,crew:12,goldMin:75,goldMax:125,range:1300},
    brig:{L:330,W:110,hp:720,speed:235,turn:0.83,cannons:4,reload:4.1,damage:32,crewCap:28,crew:18,goldMin:130,goldMax:210,range:1540},
    galleon:{L:470,W:155,hp:1280,playerHp:1880,speed:185,turn:0.58,cannons:6,reload:4.8,damage:39,crewCap:42,crew:30,goldMin:240,goldMax:360,range:1700},
    warship:{L:530,W:170,hp:1700,playerHp:2300,speed:200,turn:0.54,cannons:7,reload:4.5,damage:44,crewCap:48,crew:36,goldMin:340,goldMax:490,range:1850},
    boss:{L:620,W:210,hp:3600,speed:170,turn:0.45,cannons:10,reload:5.3,damage:48,crewCap:64,crew:48,goldMin:1100,goldMax:1500,range:2000},
    merchant:{L:360,W:122,hp:590,speed:160,turn:0.60,cannons:2,reload:5.8,damage:18,crewCap:20,crew:12,goldMin:280,goldMax:430,range:1180},
    ghost:{L:450,W:150,hp:1000,playerHp:1600,speed:210,turn:0.68,cannons:5,reload:4.2,damage:32,crewCap:32,crew:24,goldMin:240,goldMax:390,range:1700,skeleton:true,ghost:true,flagColor:'#a6e8b4'},
    cutter:{L:210,W:74,hp:420,playerHp:750,speed:310,turn:1.40,cannons:2,reload:2.8,damage:22,crewCap:28,crew:14,goldMin:90,goldMax:155,range:1150},
    frigate:{L:420,W:125,hp:1100,playerHp:1500,speed:280,turn:0.88,cannons:5,reload:3.6,damage:36,crewCap:42,crew:28,goldMin:240,goldMax:365,range:1850},
    ironclad:{L:420,W:165,hp:2100,playerHp:2400,speed:145,turn:0.42,cannons:5,reload:5.8,damage:48,crewCap:44,crew:32,goldMin:340,goldMax:480,range:1650,armor:0.68},
    bombard:{L:370,W:145,hp:1100,playerHp:1500,speed:160,turn:0.50,cannons:2,reload:7.5,damage:105,crewCap:32,crew:20,goldMin:240,goldMax:380,range:2450,weapon:'mortar',splashRadius:150},
    galley:{L:390,W:95,hp:850,playerHp:1150,speed:220,turn:1.10,cannons:3,reload:3.5,damage:27,crewCap:46,crew:32,goldMin:180,goldMax:295,range:1280,rowBonus:20,boardParty:10,meleeDamage:22},
    stormark:{L:740,W:240,hp:3200,playerHp:4200,speed:175,turn:0.44,cannons:8,reload:5.1,damage:48,crewCap:76,crew:54,goldMin:680,goldMax:950,range:2150,armor:0.90},
    leviathan:{L:1120,W:330,hp:6800,playerHp:7600,speed:105,turn:0.24,cannons:14,reload:6.2,damage:62,crewCap:110,crew:80,goldMin:1600,goldMax:2200,range:2350,armor:0.80}
  };
  // The shipyard uses the same authored profiles as the simulation and sea encounters.
  const shipCatalog = [
    {kind:'cutter',name:'Swift Cutter',role:'Scout & skirmisher',strength:'Fastest sails, tightest turns, and rapid twin-gun broadsides.',weakness:'Light hull, short cannon range, and only two guns per side.',cost:480},
    {kind:'galley',name:'Raider Galley',role:'Boarding specialist',strength:'Powerful rowing, ten-sailor boarding parties, and stronger deck fighters.',weakness:'Narrow lightly protected hull and modest short-range cannon fire.',cost:900},
    {kind:'galleon',name:'Grand Galleon',role:'Heavy broadside flagship',strength:'Six guns per side, a stout hull, and room for a large crew.',weakness:'Slow sails and wide turns make pursuit and evasive maneuvers difficult.',cost:1100},
    {kind:'frigate',name:'Corsair Frigate',role:'Fast line fighter',strength:'Fast sails, responsive handling, and five long-range guns per side.',weakness:'Lighter hull than the heavy warships; expensive to expose in close combat.',cost:1350},
    {kind:'bombard',name:'Siege Bombard',role:'Long-range artillery',strength:'Arcing mortar shells reach distant ships and blast clustered enemies.',weakness:'Very slow reload, sluggish movement, and only two mortars per side.',cost:1550},
    {kind:'warship',name:'Man-of-War',role:'Battle-line powerhouse',strength:'Seven heavy guns per side, a reinforced hull, and forty-eight crew berths.',weakness:'Heavy handling and an expensive hull reward deliberate broadside positioning.',cost:1850},
    {kind:'ironclad',name:'Armored Ironclad',role:'Armored brawler',strength:'Armored plating absorbs 32% of hull damage; heavy guns punish close opponents.',weakness:'Slow sails, heavy turns, and long cannon reloads.',cost:2150},
    {kind:'ghost',name:'Revenant Galleon',role:'Haunted-water raider',strength:'Witchfire sails, skeleton crew, and five quick-firing guns carry the Bone Sea\'s menace.',weakness:'A modest hull and only thirty-two crew berths demand careful boarding decisions.',cost:3100},
    {kind:'stormark',name:'Tempest Stormark',role:'Grand expedition flagship',strength:'Eight long-range guns per side, armored timber, and seventy-six berths carry a battle fleet through deep water.',weakness:'A huge hull, slow turns, and a costly berth require grand-harbor logistics.',cost:4400},
    {kind:'leviathan',name:'Sovereign Leviathan',role:'Giant fleet dreadnought',strength:'Fourteen massive guns per side, 20% damage protection, and room for one hundred ten sailors.',weakness:'The slowest vessel and widest turns in the archipelago; vulnerable to fast flankers and boarding losses.',cost:8500}
  ];
  const standardShips=['cutter','galley','galleon','frigate','bombard','warship','ironclad'];
  const fullItems=['repair','hire','speed','cannons','hull','slot','fire','chain','grape'];
  const portDefinitions={
    'port-tortuga':{tier:1,specialty:'Coastal outfitter',grandPort:false,stock:{ships:['cutter','galley'],items:['repair','hire','speed','hull','cannons']},refitCaps:{speed:1,cannons:1,hull:1,slot:0}},
    'port-pearlhaven':{tier:2,specialty:'Sailmakers & frigate yard',grandPort:false,stock:{ships:['cutter','galley','galleon','frigate'],items:['repair','hire','speed','cannons','hull','slot','chain','grape']},refitCaps:{speed:3,cannons:3,hull:3,slot:1}},
    'port-sapphire':{tier:3,specialty:'Grand royal arsenal',grandPort:true,stock:{ships:[...standardShips,'stormark'],items:fullItems},refitCaps:{speed:5,cannons:5,hull:5,slot:2}},
    'port-driftwood':{tier:1,specialty:'Boarders & coastal salvage',grandPort:false,stock:{ships:['cutter','galley'],items:['repair','hire','speed','hull','cannons','grape']},refitCaps:{speed:2,cannons:1,hull:2,slot:0}},
    'port-blackwater':{tier:3,specialty:'Grand dreadnought foundry',grandPort:true,stock:{ships:[...standardShips,'leviathan'],items:fullItems},refitCaps:{speed:5,cannons:5,hull:5,slot:2}},
    'port-emerald':{tier:2,specialty:'Trade fleet & fast escorts',grandPort:false,stock:{ships:['cutter','galley','galleon','frigate'],items:['repair','hire','speed','cannons','hull','slot','chain']},refitCaps:{speed:4,cannons:3,hull:3,slot:1}},
    'port-sunspire':{tier:2,specialty:'Ancient salvage & siege mortars',grandPort:false,stock:{ships:['galley','galleon','bombard'],items:['repair','hire','speed','cannons','hull','slot','fire','grape']},refitCaps:{speed:2,cannons:4,hull:3,slot:1}},
    'port-ember':{tier:3,specialty:'Volcanic guns & armored hulls',grandPort:false,stock:{ships:['galleon','bombard','warship','ironclad'],items:['repair','hire','cannons','hull','slot','fire','chain','grape']},refitCaps:{speed:3,cannons:5,hull:5,slot:2}},
    'port-frostglass':{tier:2,specialty:'Northern pursuit ships',grandPort:false,stock:{ships:['cutter','frigate','ironclad'],items:['repair','hire','speed','cannons','hull','slot','chain']},refitCaps:{speed:4,cannons:3,hull:4,slot:1}},
    'port-bone':{tier:3,specialty:'Revenant hulls & witchfire',grandPort:false,stock:{ships:['galley','bombard','ghost'],items:['repair','hire','cannons','hull','slot','fire','grape']},refitCaps:{speed:3,cannons:4,hull:4,slot:1}},
    'port-storm':{tier:3,specialty:'Tempest expedition yards',grandPort:false,stock:{ships:['frigate','bombard','warship','stormark'],items:['repair','hire','speed','cannons','hull','slot','chain','fire']},refitCaps:{speed:5,cannons:4,hull:4,slot:2}},
    'port-lantern':{tier:2,specialty:'Pearl-road caravels & outfitters',grandPort:false,stock:{ships:['cutter','galley','galleon','frigate'],items:['repair','hire','speed','cannons','hull','chain','grape']},refitCaps:{speed:3,cannons:2,hull:2,slot:0}}
  };
  function portDef(id){
    const source=portDefinitions[typeof id==='object'?id?.id:id]||portDefinitions['port-tortuga'];
    return {...source,stock:{ships:[...source.stock.ships],items:[...source.stock.items]},refitCaps:{...source.refitCaps}};
  }
  function shipDef(kind){
    const d=definitions[kind]||definitions.brig;
    const profile=shipCatalog.find(ship=>ship.kind===kind);
    return {...d,...profile,gold:Math.round((d.goldMin+d.goldMax)/2)};
  }
  function seedValue(seed){
    if(Number.isFinite(seed)) return seed>>>0;
    let h=2166136261;
    for(const ch of String(seed??'crown-of-the-tides')) h=Math.imul(h^ch.charCodeAt(0),16777619);
    return h>>>0;
  }
  function rng(seed){
    let a=seedValue(seed);
    return () => {a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  }
  function regionFor(x,y){
    let best=regions[0],score=Infinity;
    for(const r of regions){const d=Math.hypot(x-r.cx,y-r.cy)/r.r;if(d<score){score=d;best=r;}}
    return best;
  }
  function voyageLandmarks(islands){
    const tortuga=islands.find(i=>i.id==='port-tortuga')||{x:8400,y:8000,r:520};
    const pearl=islands.find(i=>i.id==='port-pearlhaven')||{x:17600,y:11200,r:620};
    const ember=islands.find(i=>i.id==='port-ember')||{x:43800,y:36600,r:590};
    const startX=tortuga.x+tortuga.r+650;
    return {sail:{x:startX+830,y:tortuga.y+300},tutorial:{x:startX+1900,y:tortuga.y+1000},prize:{x:pearl.x+2500,y:pearl.y+2400},admiral:{x:ember.x+3800,y:ember.y+3800}};
  }
  const deepFleetDefinitions=[
    {id:'deep-blackwake',name:'Blackwake Expedition',region:'Indigo Trench',cx:5000,cy:37000,patrolRadius:1250,heading:-.45,formationRadius:1650,ships:['stormark','warship','galleon','galleon','frigate','frigate','bombard','galley'],captain:'Commodore Sable · Blackwake Crown'},
    {id:'deep-thunder',name:'Thunder Crown Armada',region:'Stormbreak Sea',cx:20500,cy:18000,patrolRadius:1200,heading:1.1,formationRadius:1750,ships:['stormark','warship','warship','frigate','frigate','ironclad','bombard','bombard','galley'],captain:'High Admiral Tempest · Thunder Crown'},
    {id:'deep-sovereign',name:'Sovereign Siege Fleet',region:'Crimson Strait',cx:36500,cy:39800,patrolRadius:1050,heading:-2.7,formationRadius:1800,ships:['leviathan','warship','warship','warship','ironclad','ironclad','bombard','bombard','frigate','frigate'],captain:'The Worldbreaker · Sovereign Leviathan'},
    {id:'deep-ossuary',name:'Ossuary Grand Procession',region:'The Bone Sea',cx:48100,cy:25300,patrolRadius:900,heading:Math.PI/2,formationRadius:1700,ships:['stormark','ghost','ghost','ghost','ghost','ghost','ghost','ghost','ghost'],captain:'The Deathless Regent · Ossuary Ark',skeleton:true},
    {id:'deep-rimeguard',name:'Rimeguard Deep Patrol',region:'Frostwater',cx:48000,cy:5700,patrolRadius:1000,heading:Math.PI*.75,formationRadius:1650,ships:['stormark','ironclad','ironclad','frigate','frigate','frigate','warship','bombard'],captain:'Lord Rime · Aurora Stormark',ice:true}
  ];
  function create(seed=73192){
    const random=rng(seed), between=(a,b)=>a+random()*(b-a);
    const ports=[
      {id:'port-tortuga',name:'Tortuga Anchorage',x:8400,y:8000,r:520,type:'tropical',region:'Calm Sea',shop:'The Copper Compass',flavor:'A safe harbor for a new captain. The dockmaster has a bounty with your name on it.',discovered:true},
      {id:'port-pearlhaven',name:'Pearlhaven',x:17600,y:11200,r:620,type:'tropical',region:'Sapphire Shoals',shop:'Pearlhaven Shipwright',flavor:'Fine sails, fresh hands, and rumors of a stolen admiral\'s chart.'},
      {id:'port-sapphire',name:'Azure Watch',x:35600,y:7200,r:1250,type:'fort',region:'Pearl Coast',shop:'The Azure Arsenal',flavor:'Royal drydocks, towering seawalls, and a grand arsenal fit for the largest expedition ships.'},
      {id:'port-driftwood',name:'Driftwood Cove',x:8400,y:24000,r:610,type:'tropical',region:'Indigo Trench',shop:'Driftwood Outfitters',flavor:'Lanterns guide privateers home through the western squalls.'},
      {id:'port-blackwater',name:'Blackwater Bastion',x:22600,y:25200,r:1450,type:'fort',region:'Stormbreak Sea',shop:'Bastion Foundry',flavor:'A vast fortified harbor of shipyards, stone quays, and a dreadnought foundry. Only these grand docks can launch a Sovereign Leviathan.'},
      {id:'port-emerald',name:'Emerald Quay',x:40400,y:22400,r:620,type:'tropical',region:'Emerald Expanse',shop:'The Verdant Exchange',flavor:'Spice ships, green lagoons, and rich convoys bound for the strait.'},
      {id:'port-sunspire',name:'Sunspire Refuge',x:16200,y:37600,r:650,type:'ruins',region:'Indigo Trench',shop:'Sunspire Salvage',flavor:'Pirates have made a harbor beneath the broken pillars of an older kingdom.'},
      {id:'port-ember',name:'Emberfall Harbor',x:43800,y:36600,r:590,type:'volcanic',region:'Crimson Strait',shop:'Emberfall Forge',flavor:'The final sheltered anchorage before the Dread Admiral\'s guns.'},
      {id:'port-frostglass',name:'Frostglass Haven',x:43100,y:4100,r:640,type:'ice',region:'Frostwater',shop:'The Northern Chandlery',flavor:'Icebound piers shelter northern sailors beneath the aurora.'},
      {id:'port-bone',name:'Gravesend Refuge',x:47400,y:18800,r:680,type:'haunted',region:'The Bone Sea',shop:'The Bone Lantern',flavor:'A bell of black iron keeps the restless dead beyond the harbor lights.'},
      {id:'port-storm',name:'Thunderhead Bastion',x:15500,y:21200,r:620,type:'fort',region:'Stormbreak Sea',shop:'Stormbreaker Shipworks',flavor:'Stone seawalls guard a warm tavern and the storm fleet\'s finest shipwrights.'},
      {id:'port-lantern',name:'Lantern Bay',x:33700,y:18400,r:600,type:'tropical',region:'Pearl Coast',shop:'The Lantern Exchange',flavor:'A crossroads of bright markets, pearl divers, and tales of the haunted eastern sea.'}
    ];
    const islands=ports.map((p,i)=>({...p,...portDef(p.id),port:true,seed:seedValue(seed)+i*7919,trees:p.type==='tropical'?32:p.type==='ice'?0:14,known:true,discovered:!!p.discovered,biome:p.type==='ice'?'ice':p.type==='haunted'?'haunted':regionFor(p.x,p.y).biome}));
    const names=['Mariner\'s Rest','Whalebone Key','Crescent Isle','Silverleaf Atoll','Devil\'s Teeth','Gullrock','Coral Crown','Moonwake Isle','Cutlass Cay','Windward Key','Saltspire','The Broken Crown','Mango Reach','Widow\'s Watch','Starfall Cay','Turtleback Isle','Old King\'s Reef','Smuggler\'s Rest','Lost Lantern','Siren\'s Refuge','Cinder Key','Ironjaw Isle','The Sleeping Giant','Drowned Chapel','Blueglass Atoll','Stormwatch','Ivory Reach','The Twins','Captain\'s Folly','Three Palms','Sable Rock','Goldfinch Cay','Seafoam Rest','Ruby Reef','Castaway Key','The Watcher','Dragon\'s Wake','Sunken Bell','Cobalt Key','Pirate\'s Promise','Ashen Crown','Fortune\'s End'];
    const start={x:ports[0].x+ports[0].r+650,y:ports[0].y,a:0.18,portId:ports[0].id};
    const landmarks=voyageLandmarks(islands);
    // Reserve the opening lane, each harbor approach, and every authored battle arena.
    const reserved=[{...landmarks.sail,r:1000},{...landmarks.tutorial,r:850},{...landmarks.prize,r:1000},{...landmarks.admiral,r:1500},{x:26400,y:19400,r:1400},{x:32600,y:30200,r:1400},{x:9600,y:32000,r:1300},{x:45100,y:21800,r:1200},{x:42500,y:25500,r:1200},{x:43700,y:15100,r:1200}];
    for(const fleet of deepFleetDefinitions)reserved.push({x:fleet.cx,y:fleet.cy,r:fleet.formationRadius+fleet.patrolRadius+900});
    for(const p of ports) reserved.push({x:p.x+p.r+450,y:p.y,r:700});
    let tries=0;
    while(islands.length<112&&tries++<30000){
      const x=between(1500,WIDTH-1500),y=between(1500,HEIGHT-1500),r=between(350,950);
      if(islands.some(i=>Math.hypot(x-i.x,y-i.y)<r+i.r+850)) continue;
      if(reserved.some(v=>Math.hypot(x-v.x,y-v.y)<r+v.r)) continue;
      if(Math.hypot(x-start.x,y-start.y)<2100) continue;
      const region=regionFor(x,y),n=islands.length-ports.length;
      let type='tropical';
      if(region.id==='frost') type='ice';
      else if(region.id==='bone') type='haunted';
      else if(region.id==='crimson'&&random()<0.68) type='volcanic';
      else if(random()<0.19) type='ruins';
      else if(region.danger>0.4&&random()<0.18) type='fort';
      const themedNames={ice:['Frostfang','Winter\'s Crown','Glacierwatch','Aurora Isle','Pale King\'s Rest','Shiverglass'],haunted:['Skullhaven','The Gallows','Dead Man\'s Lantern','Wraithfall','Bone Crown','Mourning Key'],volcanic:['Cindermaw','Ashen Teeth','Dragonfire','Ember Crown','Black Cinder','Firewake']};
      const baseName=themedNames[type]?.[n%6]||names[n%names.length];
      islands.push({id:`island-${n+1}`,name:n<names.length&&!themedNames[type]?baseName:`${baseName} ${Math.floor(n/6)+1}`,x,y,r,seed:Math.floor(between(1,0x7fffffff)),port:false,type,region:region.name,biome:region.biome,discovered:false,trees:type==='ice'?0:type==='tropical'?Math.floor(between(24,60)):Math.floor(between(6,18)),treasure:Math.floor(between(85,250)),treasureClaimed:false,skeleton:type==='haunted'});
    }

    const encounters=[];
    const clear=(x,y,space=260)=>x>650&&x<WIDTH-650&&y>650&&y<HEIGHT-650&&!islands.some(i=>Math.hypot(x-i.x,y-i.y)<i.r+space);
    function position(x,y,space=280){
      if(clear(x,y,space)) return {x,y};
      for(let j=1;j<100;j++){
        const a=j*2.3999632297,d=Math.sqrt(j)*170,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
        if(clear(px,py,space)) return {x:px,y:py};
      }
      return null;
    }
    function add(kind,team,x,y,name,group,level=1,questTag=null,extra={}){
      const p=position(x,y,shipDef(kind).L*0.45+160);
      if(!p) return null;
      // Keep authored ships apart even when an island displaces a spawn.
      let placement=p;
      if(encounters.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<360)){
        for(let j=1;j<40;j++){
          const a=j*2.3999632297,d=Math.sqrt(j)*230,q=position(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d,shipDef(kind).L*0.45+130);
          if(q&&!encounters.some(e=>Math.hypot(e.x-q.x,e.y-q.y)<380)){placement=q;break;}
        }
      }
      const encounterKey=extra.encounterKey||`voyage-${group}-${encounters.filter(e=>e.group===group).length}`;
      const e={kind,team,...placement,name,group,level,questTag,encounterKey,a:between(-Math.PI,Math.PI),region:regionFor(placement.x,placement.y).name,skeleton:kind==='ghost',ghost:kind==='ghost',...extra};
      encounters.push(e);return e;
    }
    add('sloop','enemy',landmarks.tutorial.x,landmarks.tutorial.y,'Red Jack\'s Swift Revenge','tutorial',0.72,'tutorial');
    add('sloop','enemy',landmarks.prize.x,landmarks.prize.y,'The Forsaken Crown','first-prize',0.85,'first-prize');
    // Named captains and their escorts create memorable mid-voyage fleet battles.
    add('galleon','enemy',26400,19400,'Captain Vane · The Gilded Wraith','vane',1.05,'vane');
    add('cutter','enemy',25200,18400,'Needlewind · Wraith Scout','vane',1);
    add('frigate','enemy',27600,18400,'The Gilded Talon','vane',1);
    add('sloop','enemy',26400,20800,'Wraith Escort III','vane',1);
    add('ironclad','enemy',32600,30200,'Iron Duchess · Queen of Chains','duchess',1.10,'duchess');
    add('galley','enemy',31200,29600,'Chainbreaker · Boarding Galley','duchess',1.05);
    add('brig','enemy',34000,29600,'Iron Vow','duchess',1.05);
    add('sloop','enemy',32000,31600,'Needlefish','duchess',1);
    add('sloop','enemy',34000,31600,'Black Ribbon','duchess',1);
    add('galleon','enemy',9600,32000,'Captain Flint · Lantern Eater','flint',1.05,'flint');
    add('bombard','enemy',8400,31000,'Nightglass · Siege Bombard','flint',1);
    add('sloop','enemy',11000,31400,'Last Light','flint',1);

    const pirateNames=['Black Gull','The Brass Serpent','Bitter Fortune','Storm Petrel','Crimson Vow','Ragged Crown','The Debt Collector','Sea Witch','Hollow Promise','The Wayward Saint','Daggerfin','Royal Plunder','The Grey Revenant','Fool\'s Gold','The Broken Oath','Salt Widow'];
    let attempts=0,n=0;
    while(n<36&&attempts++<3000){
      const x=between(2300,WIDTH-2000),y=between(2300,HEIGHT-1700),rg=regionFor(x,y);
      if(Math.hypot(x-start.x,y-start.y)<4200||!clear(x,y,500)||encounters.some(e=>Math.hypot(e.x-x,e.y-y)<1500)||deepFleetDefinitions.some(f=>Math.hypot(x-f.cx,y-f.cy)<f.formationRadius+f.patrolRadius+950)) continue;
      const pool=rg.id==='bone'?['ghost']:rg.id==='frost'?['frigate','brig','ironclad']:rg.danger>0.7?['warship','galleon','ironclad','bombard','frigate']:rg.danger>0.4?['brig','galley','frigate','cutter']:['sloop','cutter','galley'];
      const kind=pool[Math.floor(random()*pool.length)];
      add(kind,'enemy',x,y,`${rg.id==='frost'?'Frost Raider · ':rg.id==='bone'?'Restless · ':''}${pirateNames[n%pirateNames.length]}${n>=pirateNames.length?' II':''}`,`patrol-${n}`,0.85+rg.danger*0.35,null,{ice:rg.id==='frost'});n++;
    }
    const convoys=[{x:21000,y:7000,name:'Pearl Company'},{x:35600,y:18600,name:'Emerald Spice Fleet'},{x:14000,y:28000,name:'Western Silver Fleet'},{x:31800,y:4100,name:'Azure Pearl Convoy'},{x:42000,y:10000,name:'Frostglass Fur Company'},{x:26500,y:36500,name:'Sunspire Antiquities'}];
    convoys.forEach((c,i)=>{
      add('merchant','neutral',c.x,c.y,`${c.name} · Treasure Ship`,`convoy-${i}`,1);
      add('sloop','neutral',c.x-540,c.y-440,`${c.name} Escort`,`convoy-${i}`,1);
      add('merchant','neutral',c.x-620,c.y+420,`${c.name} · Supply Ship`,`convoy-${i}`,1);
    });
    add('boss','enemy',landmarks.admiral.x,landmarks.admiral.y,'Dread Admiral · Crown of Ash','admiral-fleet',1,'admiral');
    add('warship','enemy',46000,39400,'Admiral\'s Guard · Red Sovereign','admiral-fleet',1.06);
    add('warship','enemy',49000,39400,'Admiral\'s Guard · Tyrant','admiral-fleet',1.06);
    add('galleon','enemy',46000,41800,'The Gallows Bell','admiral-fleet',1.05);
    add('brig','enemy',49000,41800,'Ashen Fang','admiral-fleet',1.05);
    add('brig','enemy',47600,38000,'Ember Lance','admiral-fleet',1.05);
    // Witchfire fleets patrol three passages through the haunted eastern sea.
    const deadCaptains=[
      {x:45100,y:21800,name:'Captain Morrow · The Ossuary',tag:'ghost-morrow',escorts:['The Ribcage','Last Breath','Grave Promise']},
      {x:42500,y:25500,name:'Admiral Hollow · The Pale Covenant',tag:'ghost-hollow',escorts:['Widow\'s Rattle','The Unburied','Carrion Crown']},
      {x:43700,y:15100,name:'The Bone Queen · Dirge of the Deep',tag:'ghost-queen',escorts:['Skull Lantern','Drowned Choir','The Undertow']}
    ];
    for(const captain of deadCaptains){
      add('ghost','enemy',captain.x,captain.y,captain.name,captain.tag,1.20,captain.tag,{skeleton:true,ghost:true,ghostCaptain:true});
      captain.escorts.forEach((name,k)=>{const a=k/3*Math.PI*2;add('ghost','enemy',captain.x+Math.cos(a)*700,captain.y+Math.sin(a)*700,name,captain.tag,1.02,null,{skeleton:true,ghost:true});});
    }
    for(let k=0;k<10;k++){
      let found=false;
      for(let attempt=0;attempt<100&&!found;attempt++){
        const x=between(41400,50700),y=between(13200,29200);
        if(regionFor(x,y).id!=='bone'||!clear(x,y,600)||encounters.some(e=>Math.hypot(e.x-x,e.y-y)<1500)||deepFleetDefinitions.some(f=>Math.hypot(x-f.cx,y-f.cy)<f.formationRadius+f.patrolRadius+850)) continue;
        found=!!add('ghost','enemy',x,y,['Witchlight','The Black Reliquary','Dead Reckoning','The Mourning Star','Hollow Heart','Spectral Fortune','The Bone Collector','Fogbound','The Last Toll','The Endless Wake'][k],`ghost-rover-${k}`,1.05,null,{skeleton:true,ghost:true});
      }
    }
    add('warship','enemy',44900,9700,'Captain Rime · The White Tempest','frost-fleet',1.12,'rime',{ice:true,flagColor:'#c5f3ff'});
    add('brig','enemy',44200,10300,'Winter\'s Vow','frost-fleet',1.08,null,{ice:true,flagColor:'#c5f3ff'});
    add('brig','enemy',45600,10300,'Pale Horizon','frost-fleet',1.08,null,{ice:true,flagColor:'#c5f3ff'});
    // Each deep-water formation is one patrol, with stable slots for shared AI and save migration.
    const deepFleets=[];
    for(const fleet of deepFleetDefinitions){
      const ca=Math.cos(fleet.heading),sa=Math.sin(fleet.heading),count=fleet.ships.length;
      const publicFleet={id:fleet.id,name:fleet.name,region:fleet.region,cx:fleet.cx,cy:fleet.cy,patrolRadius:fleet.patrolRadius,heading:fleet.heading,formationRadius:fleet.formationRadius,count,flagshipKind:fleet.ships[0]};
      deepFleets.push(publicFleet);
      fleet.ships.forEach((kind,slot)=>{
        const a=(slot-1)/Math.max(1,count-1)*Math.PI*2;
        const lx=slot===0?0:Math.cos(a)*fleet.formationRadius,ly=slot===0?0:Math.sin(a)*fleet.formationRadius;
        const x=fleet.cx+lx*ca-ly*sa,y=fleet.cy+lx*sa+ly*ca;
        add(kind,'enemy',x,y,slot===0?fleet.captain:`${fleet.name} · ${slot<10?'0':''}${slot}`,fleet.id,slot===0?1.14:1.06,null,{encounterKey:`${fleet.id}-slot-${slot}`,deepFleetId:fleet.id,fleetLeader:slot===0,fleetSlot:slot,fleetOffsetX:lx,fleetOffsetY:ly,skeleton:!!fleet.skeleton||kind==='ghost',ghost:!!fleet.skeleton||kind==='ghost',ice:!!fleet.ice,a:fleet.heading,region:fleet.region});
      });
    }
    return {islands,encounters,start,deepFleets,regions:regions.map(r=>({...r})),seed:seedValue(seed),w:WIDTH,h:HEIGHT};
  }

  function quests(islands){
    const pearl=islands.find(i=>i.id==='port-pearlhaven')||{id:'port-pearlhaven',x:17600,y:11200,r:620};
    const points=voyageLandmarks(islands);
    return [
      {id:'first-command',kind:'sail',title:'A captain\'s first command',description:'Hold W to set sail, then use A and D to steer toward the gold marker. Q and E fire your left and right broadsides.',targetX:points.sail.x,targetY:points.sail.y,targetRadius:420,progress:0,goal:1,reward:60},
      {id:'red-jack',kind:'sink',title:'Bounty: Red Jack',description:'Find the red-sailed sloop southeast of Tortuga. Turn your side toward it, fire a broadside, and collect its floating treasure.',targetX:points.tutorial.x,targetY:points.tutorial.y,targetTag:'tutorial',progress:0,goal:1,reward:220},
      {id:'pearlhaven',kind:'port',title:'A proper outfitting',description:'Sail to Pearlhaven and dock with H. Repair your hull, hire sailors, and upgrade your guns before deeper waters.',targetX:pearl.x+pearl.r+180,targetY:pearl.y,portId:pearl.id,progress:0,goal:1,reward:140},
      {id:'take-a-prize',kind:'capture',title:'Raise your own fleet',description:'The Forsaken Crown sails southeast of Pearlhaven. Weaken it, grapple with G, send boarders with B, then press C when it is ready to surrender. Any enemy prize counts.',targetX:points.prize.x,targetY:points.prize.y,targetTag:'first-prize',progress:0,goal:1,reward:400},
      {id:'crown-of-the-tides',kind:'boss',title:'The Crown of the Tides',description:'Cross the nine seas and gather a fleet. Frostwater hides northern raiders; skeleton captains haunt the Bone Sea. When ready, defeat the Dread Admiral in Crimson Strait. Emberfall is your last safe harbor.',targetX:points.admiral.x,targetY:points.admiral.y,targetTag:'admiral',progress:0,goal:1,reward:1800}
    ];
  }
  window.PirateWorld={create,shipDef,shipCatalog,portDef,quests,regions,regionFor};
})();
