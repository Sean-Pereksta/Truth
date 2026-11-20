(function (root, build) {
  const api = build();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AcornExpansion = api;
    root.RallyData.tracks.push(...api.courses.map(course => course.menu));
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const firstIndex = 8;
  const courses = [
    {
      name: 'Lumen Hollow', line: ['Lumen', 'Hollow'], region: 'The Underwood', place: 'Glowworm mines, the Underwood',
      surface: 'Glowstone & rail ties', length: 1200, level: 'Advanced',
      feature: 'Weave through dripstone teeth, swing wide around the geode chamber, then take the left rail shelf above the glowworm rift.',
      anchors: [[-96,-48],[-96,-16],[-82,4],[-58,12],[-65,30],[-53,47],[-30,42],[-14,52],[-3,73],
        [23,78],[47,68],[51,48],[34,32],[44,17],[71,24],[91,13],[94,-13],[81,-33],[53,-37],
        [25,-31],[5,-47],[-5,-68],[-32,-77],[-50,-63],[-67,-72],[-87,-69]],
      // Distance around the lap, deck height, and half-width. Both ends are the same start apron.
      section: [[0,6,6.2],[.08,5,5.2],[.17,5.8,4.2],[.27,7.5,4.5],[.34,5,6],[.45,4.8,6.1],
        [.53,7.4,5.3],[.62,10,5.25],[.71,7,4.6],[.80,12.5,4.3],[.89,14,4.55],[.96,7,5.3],[1,6,6.2]],
      fork: [.52,.70,15,3.7,2.9], bridge: .86, drops: [[.745,.91]],
      hazard: {style:5,name:'Ore lift',u:.38,side:-1,period:9.1,warn:2.3,live:3.7,offset:1.15,width:1.34,length:1.12,speed:.61,push:3.7,hop:.17},
      obstacles: [
        {style:12,key:81,name:'Mine cart crossing',u:.139,side:-1,period:13.2,warn:1.25,live:6.6,offset:2.7,width:.88,length:20,speed:0,push:4.4,hop:.43},
        {style:12,key:82,name:'Geode freight cart',u:.465,side:1,period:14.7,warn:1.25,live:6.8,offset:8.15,width:.88,length:22,speed:0,push:4.4,hop:.43}
      ],
      tip: 'Watch the crossing lights and give loaded mine carts a full lane. Pass the ore lift on the left while its basket is down.',
      ramps: [{id:'geode-trestle',name:'Mine rail lip',style:'trestle',branch:true,u:.622,lane:0,halfWidth:2.10,
        landingWidth:2.60,runup:8.3,rise:1.65,gap:2.2,landingRise:.88,landingLength:31,minSpeed:6}]
    },
    {
      name: 'Kitewire Crossing', line: ['Kitewire','Crossing'], region: 'The Upper Air', place: 'Kite post, the Upper Air',
      surface: 'Rope & sky planks', length: 1270, level: 'Expert',
      feature: 'Leave the mooring platform for open-sided suspension bridges. Brake for the kite towers and center the kart before the narrow summit span.',
      anchors: [[-106,-53],[-106,-15],[-91,18],[-58,48],[-34,69],[-8,72],[10,56],[2,32],[-19,18],
        [-13,4],[17,7],[47,33],[71,61],[93,61],[111,41],[101,20],[82,5],[67,-15],[85,-32],
        [83,-53],[60,-66],[35,-52],[14,-27],[-11,-22],[-37,-43],[-60,-68],[-87,-69]],
      section: [[0,21,6.5],[.055,24,4.8],[.12,32,4.25],[.22,23,3.85],[.30,28,4.7],
        [.36,30,5.15],[.43,26,4.7],[.50,23,5],[.61,31,5],[.70,33,4.4],[.765,38,3.35],
        [.835,35,3.55],[.91,26,4.45],[.963,22,5.3],[1,21,6.5]],
      fork: [.49,.69,14.8,2.4,3.0], bridge: .765, drops: [[.045,.975]],
      hazard: {style:1,name:'Signal boom',u:.345,side:-1,period:8.4,warn:2.4,live:3.25,offset:2.4,width:.46,length:.57,speed:.68,push:3.4},
      tip: 'Watch the signal boom at the tower. Leave room on the left, then bring the kart back to the center of the bridge.'
    },
    {
      name: 'Orrery Outpost', line: ['Orrery','Outpost'], region: 'The Acorn Belt', place: 'Orbital dock, the Acorn Belt',
      surface: 'Lunar alloy', length: 1340, level: 'Expert',
      feature: 'Dodge freeze beams around the observatory’s stacked figure eight. The left launch spur trades a narrow landing for a faster route through low gravity.',
      // Both passes through (0, 0) have independent heights. Progress stays on its own deck.
      anchors: [[-86,-54],[-99,-27],[-98,9],[-84,40],[-58,58],[-34,54],[-16,29],[0,0],[16,-28],
        [42,-54],[72,-59],[96,-38],[103,-9],[88,17],[67,25],[53,49],[32,54],[15,34],[0,0],
        [-19,-21],[-43,-17],[-57,-31],[-57,-52],[-70,-66]],
      section: [[0,13,6.2],[.12,16,5.6],[.23,22,5.0],[.30,25,4.75],[.40,21,5.7],[.53,15,5.7],
        [.62,11,4.8],[.70,9,4.6],[.79,8.5,4.9],[.87,10,5.45],[.95,14,5.7],[1,13,6.2]],
      fork: [.37,.54,16,2.8,3.0], bridge: .30, drops: [[.11,.325],[.595,.74],[.825,.93]],
      hazard: {style:3,name:'Meteor fragment',u:.76,side:-1,period:8.5,warn:2.45,live:3.2,offset:1.6,width:.90,length:.96,speed:.59,push:4.1,hop:.41},
      obstacles: [
        {style:11,key:'orrery-beam-1',name:'Alien freeze beam',u:.195,side:-1,period:10.6,warn:2.05,live:.94,offset:1.3,width:1.40,length:1.40,lane:1.9,height:12.0},
        {style:11,key:'orrery-beam-2',name:'Alien freeze beam',u:.590,side:1,period:11.7,warn:2.05,live:1.04,offset:5.6,width:1.53,length:1.53,lane:2.1,height:13.6},
        {style:11,key:'orrery-beam-3',name:'Alien freeze beam',u:.930,side:-1,period:12.3,warn:2.15,live:1.0,offset:7.0,width:1.38,length:1.38,lane:1.75,height:11.6}
      ],
      tip: 'Leave the saucer’s marked lane before its beam locks you in place for one second. Watch the meteor shadow at the docking bend.',
      ramps: [{id:'orbital-launch',name:'Low-gravity launch spur',style:'chalk',branch:true,u:.445,lane:0,halfWidth:2.22,
        landingWidth:2.65,runup:10,rise:2.05,gap:2.75,landingRise:1.03,landingLength:46,minSpeed:6},
        {id:'lunar-kicker',name:'Observatory kicker',style:'chalk',branch:false,u:.865,lane:-1.85,halfWidth:2.05,
        landingWidth:2.52,runup:9,rise:1.63,gap:2.1,landingRise:.85,landingLength:39,minSpeed:6}]
    },
    {
      name: 'Cinder Crown', line: ['Cinder','Crown'], region: 'The Ember Isles', place: 'Caldera rim, the Ember Isles',
      surface: 'Obsidian & clinker', length: 1390, level: 'Expert',
      feature: 'Climb the switchbacks beneath the lava guardian’s fireballs, choose the low lava-tube bypass, then link the downhill basalt esses.',
      anchors: [[-90,-57],[-94,-29],[-73,-8],[-44,0],[-43,13],[-66,16],[-78,32],[-65,45],[-38,40],
        [-22,47],[-21,65],[0,78],[31,77],[62,63],[85,40],[91,12],[75,-10],[50,-18],[24,-10],
        [9,-24],[22,-43],[52,-51],[56,-69],[34,-81],[9,-74],[-11,-51],[-31,-44],[-46,-64],[-69,-76]],
      section: [[0,5,6.35],[.08,7,5.2],[.18,16,4.65],[.265,22,4.45],[.335,29,4.85],[.425,32,5.65],
        [.52,26,5.45],[.62,22,5.45],[.705,18,4.85],[.795,10,4.7],[.88,5,4.5],[.955,4,5.4],[1,5,6.35]],
      fork: [.53,.70,16,-5.0,3.1], bridge: .42, drops: [[.32,.505],[.74,.845]],
      hazard: {style:4,name:'Fracturing caldera crust',u:.40,side:1,period:10.0,warn:2.4,live:4.5,offset:1.8,width:1.65,length:3.15,speed:.63,push:2.8,slip:.62,hop:.15},
      obstacles: [
        {style:10,key:'cinder-fire-1',name:'Lava guardian fireball',u:.305,side:-1,period:18,warn:2.3,live:.66,offset:2.0,width:1.64,length:1.64,lane:1.85,arc:28,speed:.48,push:5.3,hop:.78},
        {style:10,key:'cinder-fire-2',name:'Lava guardian fireball',u:.490,side:1,period:18,warn:2.45,live:.72,offset:14.0,width:1.83,length:1.83,lane:2.05,arc:25,speed:.44,push:5.7,hop:.87},
        {style:10,key:'cinder-fire-3',name:'Lava guardian fireball',u:.768,side:-1,period:18,warn:2.5,live:.66,offset:8.0,width:1.57,length:1.57,lane:1.85,arc:37,speed:.48,push:5.2,hop:.76}
      ],
      tip: 'Move away from the guardian’s glowing impact markers. Take the solid right lane when the caldera crust starts to split.'
    },
    {
      name: 'Prism Parade', line: ['Prism','Parade'], region: 'Festival Special', place: 'Aurora fairground',
      surface: 'Spectrum glass', length: 1320, level: 'Expert',
      feature: 'Ride a seven-color ribbon through the aurora. Link the prism bends, try the fountain balcony, and catch the last sweeping descent to the lantern arch.',
      anchors: [[-104,-49],[-102,-16],[-81,7],[-65,36],[-43,57],[-22,48],[-7,27],[10,31],[21,55],
        [39,69],[62,62],[77,36],[60,14],[45,-2],[50,-20],[69,-29],[89,-16],[107,-20],[112,-41],
        [94,-62],[66,-72],[32,-63],[9,-45],[-16,-43],[-41,-58],[-69,-71],[-90,-65]],
      section: [[0,16,6.45],[.08,18,5.4],[.15,24,5.1],[.23,31,4.75],[.30,25,5.15],[.385,20,4.4],
        [.46,18,5.4],[.56,23,5.45],[.65,22,5.15],[.73,29,4.4],[.80,23,4.35],[.86,30,4.65],
        [.94,18,5.55],[1,16,6.45]],
      fork: [.46,.65,13.2,4.8,2.85], bridge: .855, drops: [[.145,.275],[.50,.61],[.68,.92]],
      hazard: {style:2,name:'Festival fountain',u:.588,side:1,period:8.8,warn:2.35,live:3.45,offset:2.5,width:1.22,length:3,speed:.75,push:4.3,slip:.60,branch:true},
      tip: 'The fountain sweeps the left balcony. Stay on the main ribbon or hug the right side of the spray.',
      ramps: [{id:'prism-lip',name:'Prism balcony step',style:'trestle',branch:true,u:.520,lane:0,halfWidth:2.13,
        landingWidth:2.5,runup:8,rise:1.55,gap:2.0,landingRise:.82,landingLength:30,minSpeed:6}]
    },
    {
      name:'Otterworks Spillway',line:['Otterworks','Spillway'],region:'Riverworks',place:'Otterworks reservoir',
      level:'Advanced',surface:'Brick & sluice timber',length:1250,
      feature:'Build speed on the dam, dodge falling timber around the pump house, then choose the lower service cut before the riverside esses.',
      anchors:[[-112,-54],[-111,0],[-107,43],[-89,60],[-68,67],[-45,47],[-37,22],[-19,18],[-7,35],[16,63],[49,66],[68,48],[65,23],[53,5],[68,-18],[89,-10],[112,-27],[119,-55],[97,-74],[62,-69],[26,-48],[-4,-54],[-38,-72],[-75,-73],[-97,-70]],
      section:[[0,13,6.6],[.11,15,6.1],[.22,12,5.25],[.29,7,5.6],[.36,5,5.25],[.47,5.8,5.7],[.57,9.5,5.25],[.64,12,5.1],[.72,16.2,6],[.81,19,6.4],[.93,16,6.25],[1,13,6.6]],
      fork:[.41,.60,14,-3.2,3.0],bridge:.60,drops:[[.62,.71]],
      hazard:{style:2,name:'Spillway release',u:.62,side:1,period:9.8,warn:2.2,live:3.5,offset:2.9,width:1.6,length:3.1,speed:.68,push:3.9,slip:.45},
      obstacles:[
        {style:9,key:'mill-log',name:'Falling mill log',u:.24,side:-1,period:10.2,warn:1.95,live:3.1,offset:1.4,width:.44,length:.55,reach:5.7,speed:.48,push:5.6,slip:.41,hop:.21},
        {style:9,key:'boom-log',name:'Falling boom log',u:.82,side:1,period:11.4,warn:2.15,live:3.6,offset:5.7,width:.40,length:.51,reach:6.3,speed:.51,push:5.1,slip:.36,hop:.20}
      ],
      tip:'Take the open lane away from a shaking log. At the lower bend, steer clear when the sluice starts to spray.'
    },
    {
      name:'Mooncap Marsh',line:['Mooncap','Marsh'],region:'The Mooncap Fens',place:'Mooncap Fens',
      level:'Advanced',surface:'Boardwalk & peat',length:1280,
      feature:'Drift across boardwalks above the muddy fens, watch for hopping bullfrogs, and carry speed into the last turn.',
      anchors:[[-96,-68],[-115,-42],[-107,-16],[-83,-7],[-64,15],[-77,38],[-51,64],[-19,55],[-11,28],[9,14],[34,22],[42,48],[72,59],[101,36],[94,6],[66,-3],[51,-24],[60,-51],[39,-73],[13,-72],[-8,-50],[-31,-43],[-53,-61],[-76,-75]],
      section:[[0,7.4,6.4],[.09,5.7,5.6],[.18,7,4.95],[.25,10,4.8],[.34,8,5.35],[.43,5.5,5.25],[.53,8.3,4.75],[.64,9.9,4.7],[.73,5.6,5.0],[.83,4.8,5.65],[.94,6,6.15],[1,7.4,6.4]],
      fork:[.36,.53,13,3.8,2.9],bridge:.53,drops:[[.32,.47],[.57,.68]],
      hazard:{style:2,name:'Marsh geyser',u:.706,side:-1,period:8.8,warn:2.15,live:3.3,offset:1.7,width:1.5,length:2.6,speed:.58,push:3.1,slip:.55,hop:.25},
      obstacles:[
        {style:8,key:'frog-reed-bank',name:'Reed-bank bullfrog',u:.224,side:1,period:11.7,warn:1.6,live:3.5,offset:4.8,width:.73,length:.74,push:5.7,hop:.23},
        {style:8,key:'frog-crossing',name:'Bullfrog crossing',u:.555,side:-1,period:10.8,warn:1.75,live:3.75,offset:1.2,width:.76,length:.75,push:5.9,hop:.24},
        {style:8,key:'frog-mud-bank',name:'Mud-bank bullfrog',u:.869,side:-1,period:12.6,warn:1.7,live:3.8,offset:7.4,width:.78,length:.79,push:6.0,hop:.25}
      ],
      tip:'Bullfrogs can knock you backward. Watch their marked landing spots and steer clear of the final geyser.'
    },
    {
      name:'Tempest Treetops',line:['Tempest','Treetops'],region:'The Stormwood',place:'Stormwood canopy',
      level:'Expert',surface:'Timber trestle & slate',length:1420,
      feature:'Climb the zigzag trestle above the lower loop and dodge lightning on the exposed decks.',
      anchors:[[-108,-66],[-116,-31],[-93,0],[-66,21],[-32,15],[0,0],[33,-18],[53,-43],[77,-58],[109,-42],[116,-9],[104,21],[78,48],[42,66],[18,53],[9,25],[0,0],[-12,-29],[-38,-34],[-49,-63],[-80,-80]],
      section:[[0,20,6.2],[.13,25,5.2],[.22,36,4.65],[.31,37,4.9],[.41,30,5.2],[.51,23,5.4],[.63,17,4.9],[.72,12,4.5],[.80,11,5],[.88,15,5.1],[.96,19,6],[1,20,6.2]],
      fork:[.41,.59,13,4.3,2.8],bridge:.22,drops:[[.11,.34],[.40,.65],[.73,.84]],
      hazard:{style:1,name:'Storm signal arm',u:.575,side:1,period:8.5,warn:2.2,live:3.2,offset:2.4,width:.58,length:.9,speed:.68,push:3.8},
      obstacles:[
        {style:13,key:'tempest-upper-bolt',name:'Lightning strike',u:.181,side:-1,period:11.4,warn:1.16,live:.39,offset:1.1,width:1.64,length:1.83,lane:1.55,speed:.49,push:3.3,hop:.31},
        {style:13,key:'tempest-descent-bolt',name:'Lightning strike',u:.679,side:1,period:11.4,warn:1.16,live:.39,offset:4.9,width:1.78,length:1.97,lane:1.72,speed:.49,push:3.2,hop:.30},
        {style:13,key:'tempest-lower-bolt',name:'Lightning strike',u:.845,side:-1,period:11.4,warn:1.16,live:.39,offset:8.7,width:1.62,length:1.82,lane:1.58,speed:.49,push:3.3,hop:.31}
      ],
      tip:'Steer away from the amber rings before lightning hits. Watch the swinging signal arm on the high deck.',
      ramps:[{id:'tempest-trestle',name:'Trestle lip',style:'trestle',branch:true,u:.49,lane:0,halfWidth:2.1,landingWidth:2.55,runup:8.2,rise:1.55,gap:2,landingRise:.88,landingLength:31,minSpeed:6}]
    }
  ];

  // Mythos Cup. Keep every spring's approach and landing clear of timed hazards.
  // Fork widths refer to the isolated ribbon, after it separates from the main road.
  courses.push(
    {
      name:'Somnimbus Sound',line:['Somnimbus','Sound'],region:'The Sleeping Sea',place:'Over the Sleeping Sea',
      level:'Master',length:1560,surface:'Starlit satin & cloud silk',
      feature:'Spiral beneath the whale road, bounce across its missing span, then climb through the same opening on the upper deck. A narrow silk ribbon splits off above the cloud sea.',
      anchors:[[-106,-70],[-106,-36],[-102,-10],[-82,0],[-66,-13],[-60,-35],[-40,-53],
        [-13,-55],[10,-36],[18,-6],[6,16],[-20,23],[-40,11],[-41,-8],[-25,-18],[-3,-10],
        [14,9],[35,27],[66,60],[99,63],[122,42],[122,12],[109,0],[91,8],[75,24],[57,21],
        [49,6],[62,-9],[91,-22],[105,-41],[90,-64],[63,-66],[40,-55],[20,-59],[-7,-84],[-42,-88],[-73,-75]],
      // The spiral crosses itself at .260 and .410, with 23 units of headroom.
      section:[[0,19,6.4],[.062,21,5.7],[.125,12,4.5],[.178,14,4.75],[.212,15,4.65],
        [.252,15,4.8],[.29,17,4.35],[.34,25,3.9],[.39,37,4.55],[.425,38,4.7],
        [.475,38,4.75],[.529,34,5.2],[.592,26,4.2],[.655,20,4.5],[.713,27,3.95],
        [.78,32,4.55],[.848,21,4.2],[.924,15,5],[.97,18,5.9],[1,19,6.4]],
      fork:[.375,.522,13,4,3.65],bridge:.410,drops:[[.069,.177],[.184,.292],[.32,.523],[.56,.808]],
      hazard:{style:14,key:'dream-wake',name:'Dreamtide Leviathan',u:.127,side:-1,
        width:1,length:1.9,period:10.8,warn:1.9,live:2.65,offset:1.2,speed:.53,push:4.2,hop:.28},
      obstacles:[
        {style:15,key:'dream-hart',name:'Constellation Hart',u:.545,side:1,
          width:.95,length:1.5,period:8.6,warn:1.6,live:2.1,offset:3.7,speed:.56,push:3.6,hop:.22},
        {style:14,key:'dream-ebb',name:'Dreamtide Leviathan',u:.817,side:1,
          width:1,length:1.9,period:11.4,warn:1.85,live:2.8,offset:6.3,speed:.52,push:4.15,hop:.29}
      ],
      ramps:[
        {id:'dream-pillow',name:'Cloud pillow',style:'trampoline',branch:false,u:.217,lane:0,
          halfWidth:3.2,landingWidth:3.85,runup:7,rise:.8,gap:10,landingRise:.55,landingLength:34,minSpeed:7},
        {id:'dream-silk',name:'Silk sling',style:'trampoline',branch:true,u:.449,lane:0,
          halfWidth:2.5,landingWidth:3.05,runup:6,rise:.78,gap:10.5,landingRise:.6,landingLength:32,minSpeed:8}
      ],
      tip:'Pass behind the breaching leviathan. Center up on the cloud pillow before the spiral and take the upper silk fork for a second bounce.'
    },
    {
      name:'Thistledown Court',line:['Thistledown','Court'],region:'The Fairy Demesne',place:'The Fairy Queen’s garden',
      level:'Master',length:1620,surface:'Veined leaves & petal silk',
      feature:'Race a three-lobed flower crown. Each petal folds into a tight turn at its stem. Cross the torn leaf on a flower spring, then choose the narrow calyx fork near the finish.',
      anchors:[[-107,-55],[-110,-20],[-104,5],[-87,16],[-70,10],[-61,-4],[-48,-1],[-48,17],
        [-68,40],[-71,66],[-56,86],[-29,87],[-13,67],[-17,41],[-13,24],[2,25],[12,47],
        [12,69],[33,91],[60,86],[74,63],[63,43],[44,32],[38,16],[52,6],[74,17],
        [98,23],[120,8],[118,-15],[99,-32],[70,-31],[53,-48],[36,-57],[23,-43],
        [9,-29],[-9,-39],[-24,-63],[-48,-73],[-68,-57],[-82,-49],[-95,-68]],
      section:[[0,12,6.35],[.06,13,5.4],[.124,10,4.2],[.192,22,4.55],[.254,29,4.35],
        [.318,14,4.05],[.348,9,3.95],[.403,25,4.4],[.461,32,4.45],[.518,21,4.25],
        [.565,15,4.05],[.589,16,4.65],[.633,16,4.75],[.68,23,4.4],[.754,10,4.3],
        [.813,17,4.1],[.877,21,5.05],[.903,22,4.8],[.953,22,4.7],[.978,15,5.55],[1,12,6.35]],
      fork:[.866,.978,12,3.6,3.55],bridge:.453,drops:[[.164,.314],[.376,.542],[.579,.716],[.85,.968]],
      hazard:{style:16,key:'court-glasswing',name:'Glasswing Moth',u:.193,side:1,
        width:1.55,length:1,period:8.7,warn:1.7,live:2.75,offset:2.7,speed:.58,push:3.9,slip:.34},
      obstacles:[
        {style:17,key:'court-orchid',name:'Slipper Orchid',u:.354,side:-1,
          width:1.3,length:1.3,period:8.3,warn:1.65,live:2.35,offset:1.1,speed:.48,push:4.05,hop:.26},
        {style:16,key:'court-veils',name:'Glasswing Moth',u:.774,side:-1,
          width:1.55,length:1,period:9.4,warn:1.7,live:2.65,offset:5.2,speed:.56,push:4,slip:.36}
      ],
      ramps:[
        {id:'court-corolla',name:'Corolla spring',style:'trampoline',branch:false,u:.598,lane:.25,
          halfWidth:2.95,landingWidth:3.65,runup:6.7,rise:.82,gap:11,landingRise:.6,landingLength:34,minSpeed:7.5},
        {id:'court-calyx',name:'Calyx spring',style:'trampoline',branch:true,u:.924,lane:0,
          halfWidth:2.45,landingWidth:3,runup:6,rise:.8,gap:10,landingRise:.55,landingLength:31,minSpeed:8}
      ],
      tip:'Watch the moth’s low wing and the orchid’s marked lane. Unwind your steering as you enter the flower spring, before the leaf tears away.'
    },
    {
      name:'The Maw Between',line:['The Maw','Between'],region:'The Waking Dark',place:'The gate of bad dreams',
      level:'Master',length:1650,surface:'Black glass & fossil bone',
      feature:'Thread two opposing rows of teeth, clear the broken jaw, then plunge into the lower mouth. A shorter passage splits off beside the last claw strike.',
      anchors:[[-116,-68],[-117,-38],[-122,1],[-112,31],[-92,50],[-76,44],[-74,22],[-80,7],
        [-71,-4],[-54,10],[-51,39],[-35,59],[-12,68],[-2,56],[-12,30],[-3,14],[17,24],
        [29,54],[58,66],[88,61],[109,42],[107,21],[87,6],[62,1],[46,-14],[52,-34],
        [72,-44],[92,-48],[104,-65],[86,-80],[61,-80],[33,-61],[11,-57],[-8,-76],
        [-31,-82],[-54,-62],[-68,-43],[-84,-42],[-101,-66]],
      section:[[0,19,6.3],[.065,12,5.25],[.125,21,4.25],[.189,12,3.9],[.239,23,4.15],
        [.267,24,4.35],[.316,24,4.45],[.366,13,3.85],[.43,25,4.15],[.493,32,4.25],
        [.546,13,4.55],[.605,7,4.3],[.661,14,4.05],[.718,22,4.6],[.759,20,4.65],
        [.812,20,4.7],[.852,15,4.45],[.91,11,3.95],[.958,17,5.25],[1,19,6.3]],
      fork:[.702,.851,12.5,-4.5,3.55],bridge:.493,drops:[[.108,.218],[.239,.432],[.448,.624],[.707,.86],[.888,.935]],
      hazard:{style:18,key:'maw-sentry',name:'Three-Mouthed Hound',u:.163,side:1,
        width:1,length:1.9,period:8.8,warn:1.65,live:2.4,offset:1.4,speed:.47,push:4.35,slip:.32},
      obstacles:[
        {style:19,key:'maw-watcher',name:'Watcher’s Talon',u:.412,side:-1,
          width:1.25,length:1.25,period:7.9,warn:1.6,live:2.2,offset:5.1,speed:.48,push:4.2,hop:.28},
        {style:18,key:'maw-keeper',name:'Three-Mouthed Hound',u:.59,side:-1,
          width:1,length:1.9,period:9.2,warn:1.65,live:2.4,offset:4.4,speed:.47,push:4.35,slip:.32},
        {style:19,key:'maw-gate',name:'Watcher’s Talon',u:.764,side:1,
          width:1.25,length:1.25,period:8.6,warn:1.6,live:2.3,offset:2.8,speed:.46,push:4.2,hop:.3}
      ],
      ramps:[
        {id:'maw-jaw',name:'Jawbone spring',style:'trampoline',branch:false,u:.279,lane:0,
          halfWidth:2.85,landingWidth:3.55,runup:6.6,rise:.85,gap:11.5,landingRise:.65,landingLength:35,minSpeed:8},
        {id:'maw-sinew',name:'Sinew sling',style:'trampoline',branch:true,u:.776,lane:0,
          halfWidth:2.35,landingWidth:2.95,runup:6.4,rise:.87,gap:11,landingRise:.55,landingLength:32,minSpeed:8}
      ],
      tip:'Brake at the tips of the teeth and take the open side of a lunging hound. The lower fork skips the final talon and has a narrow sling landing.'
    },
    {
      name:'Aegis Ascent',line:['Aegis','Ascent'],region:'Mount Olympus',place:'The terraces of Olympus',
      level:'Master',length:1800,surface:'Veined marble & chased bronze',
      feature:'Climb four marble terraces to a broken causeway above the clouds. Link two shield springs at the summit, then race the bronze eagle down the outside of the mountain.',
      anchors:[[-119,-91],[-122,-62],[-114,-42],[-91,-30],[-56,-25],[-37,-16],[-39,-4],[-59,2],
        [-91,0],[-109,14],[-103,31],[-76,38],[-45,35],[-24,46],[-24,61],[-46,71],
        [-74,70],[-82,84],[-65,98],[-27,98],[5,84],[37,68],[72,65],[101,75],[123,62],
        [120,40],[101,24],[77,25],[67,11],[79,-4],[102,-9],[117,-27],[110,-47],
        [84,-53],[56,-45],[41,-29],[22,-26],[15,-42],[29,-65],[24,-83],[6,-96],
        [-23,-91],[-46,-71],[-62,-65],[-81,-75],[-100,-97]],
      section:[[0,14,6.4],[.056,16,5.2],[.109,21,4.5],[.146,23,3.9],[.194,29,4.1],
        [.243,32,4.45],[.291,38,4.05],[.348,42,3.95],[.397,47,4.75],[.487,47,4.8],
        [.539,44,4.45],[.595,30,4.3],[.633,25,3.85],[.686,24,4.65],[.708,23,4.7],
        [.768,23,4.65],[.806,15,4.1],[.853,20,3.95],[.91,12,4.4],[.965,14,5.15],[1,14,6.4]],
      fork:[.66,.794,13,4,3.6],bridge:.451,drops:[[.082,.213],[.247,.515],[.545,.65],[.68,.79],[.821,.911]],
      hazard:{style:20,key:'aegis-guardian',name:'Talos Heel',u:.165,side:1,
        width:1.45,length:2,period:9.6,warn:1.85,live:2.35,offset:1.8,speed:.43,push:4.45,hop:.35},
      obstacles:[
        {style:21,key:'aegis-summit',name:'Aetos Eagle',u:.322,side:-1,
          width:1.55,length:1.4,period:8.5,warn:1.75,live:2.25,offset:3.1,speed:.52,push:4.15,slip:.3},
        {style:20,key:'aegis-step',name:'Talos Heel',u:.589,side:-1,
          width:1.45,length:2,period:10.2,warn:1.85,live:2.45,offset:5.8,speed:.44,push:4.45,hop:.33},
        {style:21,key:'aegis-descent',name:'Aetos Eagle',u:.858,side:1,
          width:1.55,length:1.4,period:8.9,warn:1.65,live:2.3,offset:1.2,speed:.50,push:4.15,slip:.32}
      ],
      ramps:[
        {id:'aegis-first-shield',name:'First shield spring',style:'trampoline',branch:false,u:.423,lane:-.45,
          halfWidth:3,landingWidth:3.65,runup:7,rise:.88,gap:11,landingRise:.55,landingLength:32,minSpeed:8},
        {id:'aegis-second-shield',name:'Second shield spring',style:'trampoline',branch:false,u:.458,lane:.65,
          halfWidth:2.65,landingWidth:3.45,runup:6.3,rise:.92,gap:12,landingRise:.65,landingLength:33,minSpeed:8.5},
        {id:'aegis-aerie',name:'Eagle aerie spring',style:'trampoline',branch:true,u:.729,lane:0,
          halfWidth:2.35,landingWidth:2.95,runup:6.2,rise:.87,gap:11.5,landingRise:.6,landingLength:32,minSpeed:8}
      ],
      tip:'At the summit, launch just left of center, then move right on the little terrace for the second shield. Leave the marked lane before Talos plants his foot.'
    }
  );

  // Project the real Catmull–Rom loop into the menu badge. Equivalent cubic
  // Bézier handles keep the tight hairpins and the orbital crossover visible.
  function outline(anchors) {
    const count = anchors.length;
    const xs = anchors.map(p => p[0]), zs = anchors.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const scale = Math.min(80 / (maxX - minX), 39 / (maxZ - minZ));
    const point = ([x,z]) => [(48+(x-(maxX+minX)/2)*scale).toFixed(2),(27-(z-(maxZ+minZ)/2)*scale).toFixed(2)].join(' ');
    let path = 'M'+point(anchors[0]);
    for (let i=0; i<count; i++) {
      const a=anchors[(i+count-1)%count], b=anchors[i], c=anchors[(i+1)%count], d=anchors[(i+2)%count];
      path += ' C'+point([b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6])+' '+point([c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6])+' '+point(c);
    }
    return path+' Z';
  }
  courses.forEach((c,i) => {
    c.index = firstIndex+i;
    const {name,line,region,place,level,length,surface,feature} = c;
    c.menu = {name,line,region,place,level,length,surface,feature,shape:outline(c.anchors)};
  });
  function section(course,u) {
    const end = course.section.findIndex(stop => stop[0] > u);
    if (end < 1) return course.section[0].slice(1);
    const a=course.section[end-1], b=course.section[end];
    const t=(u-a[0])/(b[0]-a[0]), blend=t*t*(3-2*t);
    return [a[1]+(b[1]-a[1])*blend, a[2]+(b[2]-a[2])*blend];
  }
  function exposed(index,u) {
    const course=courses[index-firstIndex];
    return !!course && course.drops.some(([start,end]) => u>=start && u<=end);
  }
  return {firstIndex,courses,section,exposed};
});
