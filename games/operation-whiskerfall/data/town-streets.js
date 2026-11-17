/* District plans use offsets from the original checkpoint. Indices and contact IDs stay stable. */
(function () {
  'use strict';
  const C = window.OW.Content;
  const districts = [
    ['town_0','willow','The dispatch willow','Dispatch green','Compare the seal with the copy pinned behind Saffron’s map.','Match the two receipts','A courier hangs her first signed receipt on the line.','Harvest crews bring their apple carts back to camp.','main_0_0','missing_dispatches','circle','#be985c',[[0,-205],[-235,-120],[210,-110],[-260,205]],[-105,187]],
    ['town_1','mossbell','Bellkeeper’s Tea Room','Bell path','Follow the lowest bell rope over the footbridge. Its knot is a carved Scout.','Untangle the bell rope','The tea-room lanterns light the way back across the roots.','Visiting players gather at the outdoor tea table.','main_1_0','relay_schedule','creek','#9aab76',[[-115,-190],[240,-250],[-285,-70],[-205,215]],[120,205]],
    ['town_2','quarry','Quarry Ring','Lower terrace','The old gate has two facing mallets. Underneath is the name of the first stonecutter to fight here.','Raise the old gate standard','The stonecutters hang a pennant for the new season.','The gallery displays a champion’s trophy.','main_2_0','convoy_marks','terraces','#ca9d6b',[[85,-225],[-280,-85],[285,-165],[-240,200]],[-100,205]],
    ['town_3','snowhaven','The warming hall','Quilt walk','Medic Lumi left the brazier wick in the covered passage. Relight it before the blankets freeze.','Light the hall brazier','Amber windows mark the way to a warm bed.','Evacuated families gather at the quilt stand.','escort_3','winter_calls','courts','#a4c2cf',[[-75,-215],[210,-160],[-245,-45],[-190,230]],[120,190]],
    ['town_4','sundial','Reservoir sundial','Caravan arcade','Match the lowest tide notch to the route cut into the blue caravan tile.','Chalk the low-water road','The restored sun marker shows the safe caravan road.','Water carriers bring their camels back to the bazaar.','escort_4','cistern_map','crescents','#d5af77',[[15,-220],[-245,-100],[255,-90],[-235,190]],[-115,200]],
    ['town_6','ashford','Foundry signal box','Boiler street','Follow the whistle pipe to the spur. A sheared cotter pin has wedged the workshop bell.','Free the bell linkage','The bell swings above the repaired freight spur.','Engineers test their hoist on the workshop yard.','main_6_1','cinder_manifest','rails','#b39172',[[40,-220],[-260,-135],[300,-140],[-255,155]],[115,205]],
    ['town_9','crownrest','Shellbreak fish market','Crescent quay','Fenn’s salvage net tangled in a bollard. Follow the cork floats down the old quay.','Free the market net','The dockmaster lights the fishing pier again.','A fishing family rigs its skiff at the open market.','stormglass_homecoming','flood_ledger','harbor','#82b6ab',[[-60,-200],[-275,-40],[205,-155],[-270,190]],[-105,180]],
    ['town_7','dawnbridge','The relay arches','Messenger square','Align the east-bank relay lantern with the western messenger standard.','Align the relay lamp','The lamp flashes from the relay bank to the square.','The civilian dispatch desk opens below the arches.','main_7_2','berlin_dossier','bridge','#a8b7bd',[[0,-235],[285,-115],[-285,-85],[-250,215]],[128,180]],
    ['town_10','sluicecross','Ferrymaster’s gauge','Lower boardwalk','Keeper Edda scored the old high-water line on a piling. Compare it with the slanted reading today.','Read the ferry gauge','A green ferry lamp appears beside the dry boardwalk.','The repaired sluice wheel carries water to the archive.','main_2_2','flood_ledger','stilts','#95b0a0',[[-95,-175],[230,-120],[-230,150]],[105,160]],
    ['town_11','kitehook','Leeward cable station','Cliff switchback','Anwen’s pennants hang slack on one side of the lift. Secure the lee-side cable before launch.','Fasten the weighted hook','The launch pennants unfurl above the station.','A cable operator reopens the hoist for returning climbers.','main_3_2','spire_sequence','switchback','#a4acc5',[[-70,-210],[230,-118],[-235,190]],[105,165]],
    ['town_12','boughhall','The hollow lantern tree','Upper root walk','Rue’s couriers tie amber thread to the sheltered root. Trace it to the empty bridge lantern.','Light the bridge lantern','The night couriers can see the hollow from the upper walk.','A lantern footbridge opens inside the roots.','main_5_2','lantern_signet','loops','#b498b4',[[-55,-188],[210,-130],[-270,145]],[100,160]]
  ];
  const plans = Object.create(null);
  districts.forEach(([id,key,landmark,lane,clue,action,first,second,quest,report,layout,tint,buildings,work],index)=>{
    plans[id]={id,key,landmark,lane,clue,action,first,second,quest,report,layout,tint,buildings,work,index};
  });
  const hamlets = [
    ['town_extra_0','Applewick cider press','Cider lane'],['town_extra_1','Fern Hollow herb loft','Herbalist’s walk'],
    ['town_extra_2','Highstone signal bell','Bell steps'],['town_extra_3','Whitepine post cabin','Needle path'],
    ['town_way_0','Clover creamery','Milking lane'],['town_way_1','Fernlight lantern bridge','Lantern walk'],
    ['town_way_2','The badger brazier','Iron path'],['town_way_3','Warmhearth soup kitchen','Kitchen court'],
    ['town_way_4','Amber glass stall','Glass walk'],['town_way_5','Reedlight net shed','Netters’ quay'],
    ['town_way_6','Ember Rest kiln','Kiln street'],['town_way_7','Last Lantern watch hut','Radio path'],
    ['town_8','Brinewatch light','Lighthouse walk'],['town_stormglass_lantern','The crescent beacon','Beacon quay'],
    ['town_5','The otter ferry','Oarsmen’s lane']
  ];
  for (const [i,[id,landmark,lane]] of hamlets.entries()) {
    plans[id]={id,key:'outpost-'+i,landmark,lane,small:true,index:11,tint:'#baae88',
      layout:['fork','courts','terraces','creek'][i%4],buildings:null};
  }
  C.townStreets = plans;

  // Painted lanes and map roads share these polylines. All coordinates are in world units.
  const lanes = {
    circle:[[[-250,5],[-170,-100],[0,-128],[167,-84],[211,16],[120,112],[-80,135],[-221,75],[-250,5]]],
    creek:[[[-340,100],[-175,30],[-120,-30],[25,-22],[94,60],[225,115],[330,80]]],
    terraces:[[[-340,120],[-155,120],[-110,55],[95,55],[140,-25],[315,-25]]],
    courts:[[[-290,130],[-160,65],[-160,-48],[-30,-65],[-20,30],[126,50],[122,138],[285,135]]],
    crescents:[[[-315,40],[-220,-50],[0,-100],[205,-50],[315,40]], [[-315,40],[-212,130],[0,170],[205,130],[315,40]]],
    rails:[[[-300,95],[300,95]],[[-295,-55],[110,-55],[193,6],[295,6]]],
    harbor:[[[-355,40],[-250,105],[-95,160],[100,185],[250,158],[360,120]],[[72,179],[72,300]]],
    bridge:[[[-350,40],[-120,40],[100,40],[335,40]],[[205,40],[250,145],[320,200]]],
    stilts:[[[-285,58],[-138,58],[-138,-44],[68,-44],[68,60],[225,60],[225,170]]],
    switchback:[[[-280,160],[128,160],[190,88],[-120,88],[-163,15],[112,15],[190,-50]]],
    loops:[[[-270,45],[-180,-65],[-35,-50],[15,30],[-62,135],[-205,114],[-270,45]],[[15,30],[123,-70],[256,-40],[270,70],[178,125],[58,102],[15,30]]],
    fork:[[[-220,165],[0,0],[155,-70]],[[0,0],[172,105]]]
  };
  C.townLanes = lanes;
  // Boardwalks are structural gaps in the water footprint. The renderer reads these same values.
  C.streetWaters={
    crownrest:{x:5,y:300,rx:230,ry:74,deck:72,width:58},
    sundial:{x:0,y:15,rx:79,ry:39,deck:0,width:44},
    mossbell:{x:-158,y:134,rx:94,ry:30,deck:-154,width:42},
    dawnbridge:{x:73,y:-95,rx:42,ry:140,deck:72,width:38},
    sluicecross:{x:-15,y:104,rx:158,ry:32,deck:69,width:48},
    boughhall:{x:6,y:-11,rx:78,ry:28,deck:16,width:42}
  };
  C.installTownStreets = function (world) {
    const original = new Map(world.objects.map(o=>[o.id,o]));
    const moved = new Set();world.streetWater=[];
    for (const town of world.locations.filter(l=>l.type==='town')) {
      const d=plans[town.id];
      if (!d) continue;
      town.streetKey=d.key;
      if(C.streetWaters[d.key])world.streetWater.push({...C.streetWaters[d.key],tx:town.x,ty:town.y,key:d.key});
      const plaza=world.groundDetails.find(p=>p.type==='plaza'&&p.x===town.x&&p.y===town.y);
      if (plaza) Object.assign(plaza,{townId:town.id,w:d.small?482:770,h:d.small?345:590});
      const buildings=[0,1,2,3].map(i=>original.get(town.id+'_building_'+i)||original.get(town.id+'_house_'+i)).filter(Boolean);
      for (const [i,house] of buildings.entries()) {
        house.townId=town.id;
        if(i===0)house.townPainting=d.small?d.key:'landmark-'+d.key;
        if (!d.buildings?.[i]) continue;
        const [dx,dy]=d.buildings[i];
        // Only scenery moves. Leave clear space around all saved contacts, local objectives and the forge.
        const x=town.x+dx,y=town.y+dy;
        if (world.locations.some(l=>l!==town&&Math.abs(l.x-x)<house.w*.5+45&&Math.abs(l.y-y-house.h*.17)<house.h*.35+45)) continue;
        house.x=x;house.y=y;moved.add(house);
      }
      town.description=d.small?d.landmark+' stands on '+d.lane+'. Local supplies, a checkpoint and the resistance forge.':d.landmark+' overlooks '+d.lane+'. '+d.clue;
      for (const path of lanes[d.layout]) world._route(path.map(([x,y])=>({x:town.x+x,y:town.y+y})),d.small?34:46,'local',town.name+' · '+d.lane);
    }
    // Move existing chunk entries once after original seeded scenery and spawns have been built.
    for (const [key,entries] of world._objectChunks) {
      if(entries.some(o=>moved.has(o)))world._objectChunks.set(key,entries.filter(o=>!moved.has(o)));
    }
    for(const house of moved)world._indexObject(house);
    for (const d of districts.map(row=>plans[row[0]])) {
      const town=world.getLocation(d.id);
      if(!town)continue;
      const [dx,dy]=d.work;
      let point;
      for(const dist of [0,28,52,90,138,180]) {
        for(let i=0;i<12;i++) {
          const x=town.x+dx+Math.cos(i*Math.PI/6)*dist,y=town.y+dy+Math.sin(i*Math.PI/6)*dist;
          if(world.isBlocked(x,y,24)||world.locations.some(l=>l!==town&&Math.hypot(l.x-x,l.y-y)<95))continue;
          if(!world._navigationRay(town.x,town.y,x,y,18))continue;
          point={x,y};break;
        }
        if(point)break;
      }
      if(!point)throw Error('No accessible walk to '+town.name+' local work');
      const stop=world._addLocation({id:'work_'+d.id,type:'townWork',name:d.lane,region:town.region,townId:d.id,radius:45,...point});
      world._addObject({id:stop.id+'_lamp',type:'townWork',townId:d.id,locationId:stop.id,...point,w:52,h:67,solid:false});
      world._addObject({id:d.id+'_homecoming',type:'townAftermath',townId:d.id,x:town.x-125,y:town.y+84,w:130,h:108,solid:false});
    }
  };
}());
