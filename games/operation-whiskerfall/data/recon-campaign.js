(function () {
  'use strict';
  const C = window.OW.Content;
  // Geography uses the original, unscaled world coordinates. Interior plans are
  // in their own 180-pixel grid so scaling an overworld save cannot move a wall.
  const regions = [
    ['hushfen', 'Hushfen Basin', 'marsh', '#668981', 0, 3700, 7, 'Rushlight Landing', 'Reed ferries meet at a brick pumping station.'],
    ['glasswind', 'Glasswind Shelf', 'mountain', '#8498b4', 3700, 3700, 12, 'Leeward Inn', 'The bell above the slate switchbacks rings before each gust.'],
    ['gloamroot', 'Gloamroot Canopy', 'forest', '#827591', 7400, 3800, 17, 'Lamplighter Refuge', 'Rope bridges hang between the roots of an ancient lantern tree.']
  ];
  const locations = [];
  regions.forEach(([slug,name,biome,color,y,h,level,town,description], i) => {
    const index = 10+i;
    C.regions.push({id:index,index,reconRegion:true,slug,name,biome,color,x:18000,y,w:2400,h,level,description,commander:'Berlin dispatch network'});
    locations.push({id:'town_'+index,name:town,description,type:'town',region:index,x:18800,y:y+950,radius:275,npc:'Field liaison'});
  });

  // # is wall, S is the arrival, T controls the crossing A, K is the permanent
  // service passage, O and R are independent observation and recovery rooms.
  const sites = [
    {id:'recon_archive',name:'Floodgate Archive',region:10,x:19400,y:2220,level:7,palette:'#77b4a4',machine:'Pump wheel',crossing:'Drained intake',shortcut:'Dry culvert',lesson:'Turn the pump wheel. The striped intake drains, joining the ledger room to the upper catwalk.',map:[
      '###########','#O...##...#','#..#A##.R.#','#..#..#...#','####..#...#','#..KT...#.#','#.....#...#','#.S...#####','###########']},
    {id:'recon_spire',name:'Signal Spire',region:11,x:19600,y:6250,level:12,palette:'#94adc9',machine:'Windbreak winch',crossing:'Lee passage',shortcut:'Cable lift',lesson:'Raise the windbreak. Cross the pale wind stripes between gusts, then watch the west perch or clear the east platform.',map:[
      '###########','#O...#..R.#','###..#.#..#','#...##.#..#','#.####.#..#','#...A..#K.#','####T.....#','#..S...####','###########']},
    {id:'recon_court',name:'Lantern Court',region:12,x:19650,y:9450,level:17,palette:'#b49ac4',machine:'Root gate latch',crossing:'High bridge',shortcut:'Inside bridge',lesson:'Unlatch the high bridge and follow the courier between the lanterns. A search party protects the low signet press.',map:[
      '###########','#.O....#..#','#.####.#R.#','#....A.#..#','#.##.#.#..#','#.#..#.K..#','#.T####.#.#','#...S.....#','###########']},
    {id:'recon_depot',name:'Cinder Rail Depot',region:6,x:5750,y:8650,level:18,palette:'#da9973',machine:'Siding switch',crossing:'Freight platform',shortcut:'Service tunnel',lesson:'Switch the siding, then board the freight platform at the striped track. The eastern booth holds a duplicate manifest.',map:[
      '###########','#..O...####','#.####....#','#..A.##.R.#','###..##...#','#.T.......#','#.#.###K#.#','#.S.......#','###########']},
    {id:'recon_cistern',name:'Mirror Cistern',region:4,x:12900,y:8470,level:20,palette:'#d7bd85',machine:'Heliostat',crossing:'Projected seal',shortcut:'Shaft ladder',lesson:'Rotate the heliostat until the beam opens the seal. Cross the shaft between sweeps, or use the guarded manual override.',map:[
      '###########','#...O..#..#','#.###A.#R.#','#.#...##..#','#...T.....#','#.###.###.#','#.K...#...#','#...S...###','###########']},
    {id:'recon_vault',name:'Blackglass Command Vault',region:7,x:2030,y:6660,level:25,palette:'#9bb3be',machine:'Maintenance relay',crossing:'Document lift',shortcut:'Courtyard hatch',lesson:'Cut the maintenance relay to reach document storage unseen. The east gatehouse leads to the same courtyard with its captured order.',map:[
      '###########','#.O...#...#','#.###.#.R.#','#...A.#...#','###.#.#.#.#','#..T#...#X#','#.#####K#.#','#.S.......#','###########']}
  ];
  for (const site of sites) {
    locations.push({id:site.id,name:site.name,type:'cave',recon:true,region:site.region,x:site.x,y:site.y,radius:105});
    // Provide the stock dungeon constructor with its required catalogue fields.
    C.dungeons.push({id:site.id,name:site.name,title:site.machine,level:site.level,region:site.region,guardian:0,variant:0,puzzle:'echo',sequence:[0,1,2,3],recon:true});
  }
  locations.push({id:'recon_courtyard',name:'Courtyard field station',type:'reconCheckpoint',x:2400,y:6610,region:7,radius:65});
  locations.push({id:'recon_vault_east',name:'Blackglass · Southern Gatehouse',type:'reconEntry',x:2940,y:7290,region:7,radius:105});

  const ops = [
    {id:'missing_dispatches',title:'The Missing Satchel',region:0,contact:'Saffron',brief:'My sister signed for sacks that never reached Willow. Watch the handoff before you follow her signature.',lead:'Watch the orchard stile or intercept the red satchel.',a:[1350,1035,'Orchard stile'],b:[1870,1720,'Red satchel'],clue:'A violet wax seal covers an older Willow mark.',result:'Saffron recognizes the seal of the north mill. The courier was diverted, not lost.'},
    {id:'double_entry',title:'Two Names for One Road',region:0,contact:'Miller Ada',brief:'Someone pays my mill twice for one load. My boy drove the second cart.',lead:'Read the bridge tally or recover the second toll slip.',a:[1580,2640,'Bridge tally'],b:[2250,2580,'Toll collector’s chest'],clue:'Both carts carry the same serial number.',result:'The mill copy records departures an hour early. Look for the false wagon at Fern Hollow.'},
    {id:'relay_schedule',title:'A Minute of Silence',region:1,contact:'Juniper',bosses:[0],brief:'Ironwhisker kept the mill witnesses apart. With the orchard fort free, their last report reached me.',lead:'Listen through the relay pause or seize the signal book.',a:[4910,3050,'Fern Hollow aerial'],b:[5200,3570,'Signal wagon'],clue:'The relay goes quiet before every eastbound convoy.',result:'That silent minute is a departure signal. Freight is travelling under flood-relief orders.'},
    {id:'convoy_marks',title:'White Chalk on the Axle',region:2,contact:'Crag',bosses:[1],brief:'After Bramble fell, the wheelwright brought me a rubbing from my missing crew’s axle.',lead:'Trace wheel marks at the pass or take the quartermaster’s stencil.',a:[8110,2400,'Quarry switchback'],b:[8610,2890,'Axle marking station'],clue:'A three-bar axle mark identifies empty relief wagons.',result:'Empty wagons visit Hushfen and leave riding low. The pumping archive keeps the real weights.'},
    {id:'flood_ledger',title:'The Weight of Water',site:'recon_archive',bosses:[2],contact:'Keeper Edda',brief:'Flintfang seized my pump records. The archive key was in his battery. The men listed as cargo are still alive.',lead:'Drain the ledger intake or recover its duplicate from the lift guard.',clue:'The intake ledger lists people by the weight of their kit.',result:'The dry culvert opens. The prisoners’ route is being transmitted under a weather call sign.'},
    {id:'winter_calls',title:'Someone Answers Snow',region:3,contact:'Lumi',bosses:[3],brief:'Whiteclaw’s operator survived. She begs us to answer the next transmission in her brother’s voice.',lead:'Monitor the snowline band or recover the operator’s acetate.',a:[12150,2210,'Snowline listening post'],b:[13130,2430,'Frozen signal hut'],clue:'Three low tones request a bearing from the Signal Spire.',result:'Glasswind hears the false weather calls. Read the echoes from opposite sides of its spire.'},
    {id:'spire_sequence',title:'Signals in the Lee',site:'recon_spire',contact:'Innkeeper Anwen',brief:'My roof bell rings in still weather. I kept the clapper for the climber who never came down.',lead:'Record the sheltered perch or seize the eastern strip chart.',clue:'A descending pair of flashes identifies the westbound relay.',result:'The cable lift runs again. The next signal is handed to a lantern courier under the canopy.'},
    {id:'lantern_signet',title:'The Empty Signet',site:'recon_court',bosses:[5],contact:'Lamplighter Rue',brief:'Miretooth had my seal, but his letters kept arriving after he fell. Someone took an impression.',lead:'Shadow the signet courier or recover wax at the low press.',clue:'The forged signet has a chip shaped like a moth.',result:'The inside bridge opens to resistance traffic. Moth-stamped bills travel to the Cinder yard.'},
    {id:'cinder_manifest',title:'Last Car on the Siding',site:'recon_depot',bosses:[6],contact:'Engineer Cinder',brief:'With Geargnash gone I can switch one train. My missing apprentices signed out that carriage.',lead:'Board the slow freight cart or raid the signal booth.',clue:'The last car carries mirror glass instead of munitions.',result:'The service tunnel bypasses the yard. The mirror shipment was rerouted toward Sunscar.'},
    {id:'cistern_map',title:'A Map Made of Light',site:'recon_cistern',bosses:[4],contact:'Sol',brief:'Sirocco used to hide dry wells on our maps. This time someone has hidden a city.',lead:'Project the seal pattern or force the hand-cranked override.',clue:'The projected seal exposes the missing Berlin map grid.',result:'A shaft ladder returns to daylight. The false grid and the relay schedule intersect at Dawnbridge.'},
    {id:'berlin_dossier',title:'The Names Under the Map',region:7,contact:'Agent Velvet',bosses:[7],brief:'Blackbanner’s fall lets our witness travel. Give me one last confirmation before I send anyone through that gate.',lead:'Compare the witness’s overlay or intercept the sealed gate order.',a:[1260,6860,'Dawnbridge survey table'],b:[1710,7350,'Gate courier rendezvous'],clue:'The command relay has a document lift and an eastern gatehouse.',result:'Both entrances to Blackglass are marked. The document lift carries a relay shutdown code.'},
    {id:'command_vault',title:'Behind the Black Glass',site:'recon_vault',contact:'Agent Velvet',brief:'The dispatches were lists of witnesses. Whisker means to erase them at the last transmission.',lead:'Decode the maintenance relay or take the courtyard order by force.',clue:'The next transmission will come from Whisker’s own arena.',result:'The courtyard checkpoint is open. Take both heroes through the hatch and confront Adolph Whisker.'}
  ];
  for (const [i,op] of ops.entries()) {
    op.act = i<3?1:i<9?2:3;
    if (op.site) op.region=sites.find(s=>s.id===op.site).region;
    else for(const [index,point] of [op.a,op.b].entries()) locations.push({id:op.id+(index?'_cache':'_perch'),name:point[2],type:'reconLead',region:op.region,x:point[0],y:point[1],radius:75});
  }
  const challenges = [
    {id:'quiet',title:'Lantern census',site:'recon_court',brief:'Record both the high courier and low press without sounding the alarm. East patrol doubled.',route:['O','R'],quiet:true},
    {id:'intact',title:'Unbroken seal',site:'recon_depot',brief:'Recover the freight seal at the booth, then carry it aboard the cart without taking damage. Guards hold the siding.',route:['R','O'],intact:true},
    {id:'crossing',title:'Against the current',site:'recon_archive',brief:'Claim both ledger copies and extract through the dry culvert. Two guards cover the lower channel.',route:['R','O','K']}
  ];
  function extendWorld(w,scale){
    // Complete shipped generation before appending geography. Missions in old saves
    // can refer to any original spawn, scenery coordinate or numeric location index.
    const added=C.regions.filter(r=>r.reconRegion);
    w.regions.push(...added.map(r=>({...r})));
    w.width=Math.max(w.width,...added.map(r=>r.x+r.w));w.height=Math.max(w.height,...added.map(r=>r.y+r.h));
    function clear(point,r=30){
      for(let ring=0;ring<=24;ring++)for(let i=0;i<(ring?16:1);i++){
        const a=i*Math.PI/8,x=point.x+Math.cos(a)*ring*28,y=point.y+Math.sin(a)*ring*28;
        if(!w.isBlocked(x,y,r))return {x,y};
      }
      return point;
    }
    for(const spec of locations){
      const l=w._addLocation({...spec,...clear({x:spec.x*scale,y:spec.y*scale})});
      if(l.type==='town'){
        l.safe=l.friendly=true;l.safeRadius=465;
        w.groundDetails.push({type:'plaza',x:l.x,y:l.y,w:605,h:490,region:l.region});
        for(const [i,dx,dy] of [[0,-170,-120],[1,175,-135],[2,-210,170]]){
          w._addObject({id:l.id+'_house_'+i,type:'house',x:l.x+dx,y:l.y+dy,w:152,h:125,solid:true,region:l.region,variant:i});
        }
        const forge=w._addLocation({id:'forge_'+l.id,name:l.name+' Forge',type:'forge',region:l.region,x:l.x+280,y:l.y+125,radius:95,townId:l.id});
        w._addObject({id:forge.id+'_workshop',type:'forge',x:forge.x,y:forge.y-75,w:150,h:110,solid:true,region:l.region});
        w._addObject({id:l.id+'_liaison',type:'friendlyCat',x:l.x-70,y:l.y+36,w:53,h:70,skin:l.region%3,role:3,phase:l.region,locationId:l.id,roamRadius:15,friendly:true});
        w._addObject({id:l.id+'_sign',type:'signpost',x:l.x+92,y:l.y+72,w:32,h:60,solid:false,label:l.name});
      }else if(l.id==='recon_courtyard'){
        w._addObject({id:'recon_courtyard_station',type:'tower',x:l.x,y:l.y-42,w:145,h:100,solid:false,locationId:l.id,region:l.region});
      }else if(l.type==='reconEntry'){
        w._addObject({id:l.id+'_gatehouse',type:'tower',x:l.x,y:l.y-45,w:99,h:125,solid:false,locationId:l.id,region:l.region});
      }else if(l.type==='cave'){
        l.dungeonId=l.id;w._addObject({id:l.id+'_entrance',type:'cave',x:l.x,y:l.y-35,w:155,h:130,solid:false,locationId:l.id,region:l.region});
      }
    }
    w._buildSafeZoneIndex();
    const road=(id1,id2,name)=>w._road(w.getLocation(id1),w.getLocation(id2),76,'highway',name);
    road('town_8','town_10','Rushlight reed ferry');road('town_10','town_11','Glasswind pass');road('town_11','town_12','Lantern bridge road');road('town_12','town_9','Crownrest ferry');
    for(const site of sites){
      const l=w.getLocation(site.id),start=w._nearestRoadPoint(l,w.roads.filter(r=>r.kind!=='local'));
      if(start)w._road(start,l,47,'trail',site.name+' approach');
    }
    const east=w.getLocation('recon_vault_east');
    w._road(w._nearestRoadPoint(east,w.roads.filter(r=>r.kind!=='local')),east,50,'trail','Blackglass gatehouse path');
    // Each new region gets separate scenery and patrol streams. Coordinates of
    // every shipment-era seed remain independent of these additional roads.
    for(const r of added){
      let seed=(w.seed+r.index*19661)>>>0;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const species={10:['bush','tree','bush','ruin'],11:['rock','pine','rock','ruin'],12:['tree','bush','pine','tree']}[r.index];
      for(let y=r.y+130;y<r.y+r.h-100;y+=155)for(let x=r.x+130;x<r.x+r.w-100;x+=155){
        const px=x+random()*85-42,py=y+random()*85-42,roll=random(),type=species[Math.floor(random()*species.length)];
        if(roll>.42||w.isOnRoad(px,py,75)||locations.some(spec=>{const l=w.getLocation(spec.id);return Math.hypot(px-l.x,py-l.y)<(l.type==='town'?500:l.radius+130);}))continue;
        w._addObject({id:'recon_scenery_'+r.index+'_'+x+'_'+y,type,x:px,y:py,w:type==='tree'?96:72,h:type==='tree'?120:72,variant:Math.floor(random()*4),solid:type!=='bush',region:r.index});
      }
      const roles=C.reconEnemyTypes||{},mix={10:[roles.sluice_warden,roles.rivet_guard,44],11:[roles.glasswind_sharpshot,roles.hookclaw_skirmisher,45],12:[roles.lantern_stalker,roles.signal_sergeant,47]}[r.index];
      for(let j=0;j<9;j++){
        const point={x:r.x+300+random()*(r.w-600),y:r.y+300+random()*(r.h-600)};
        if(w.safeZoneAt(point.x,point.y,220)||sites.some(s=>s.region===r.index&&Math.hypot(point.x-s.x*scale,point.y-s.y*scale)<850))continue;
        for(const [k,t] of mix.entries()){
          const p=clear({x:point.x+k*80,y:point.y+k*65});w._spawn({id:'recon_patrol_'+r.index+'_'+j+'_'+k,type:t??24,...p,homeX:p.x,homeY:p.y,level:r.level,locationId:null,region:r.index,boss:false,patrol:j*.8});
        }
      }
    }
  }
  C.reconCampaign={extendWorld,locations,sites,ops,challenges,acts:['The Missing Dispatches','The Hidden Network','The Berlin Dossier']};
}());
