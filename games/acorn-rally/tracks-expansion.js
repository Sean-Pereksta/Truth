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
      tip: 'The ore lift lowers over the inside line. Pass to its left, or wait for the basket to rise.',
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
      feature:'Drift across wooden boardwalks above the muddy fens, watch for a hopping bullfrog, and carry speed into the last turn.',
      anchors:[[-96,-68],[-115,-42],[-107,-16],[-83,-7],[-64,15],[-77,38],[-51,64],[-19,55],[-11,28],[9,14],[34,22],[42,48],[72,59],[101,36],[94,6],[66,-3],[51,-24],[60,-51],[39,-73],[13,-72],[-8,-50],[-31,-43],[-53,-61],[-76,-75]],
      section:[[0,7.4,6.4],[.09,5.7,5.6],[.18,7,4.95],[.25,10,4.8],[.34,8,5.35],[.43,5.5,5.25],[.53,8.3,4.75],[.64,9.9,4.7],[.73,5.6,5.0],[.83,4.8,5.65],[.94,6,6.15],[1,7.4,6.4]],
      fork:[.36,.53,13,3.8,2.9],bridge:.53,drops:[[.32,.47],[.57,.68]],
      hazard:{style:2,name:'Marsh geyser',u:.706,side:-1,period:8.8,warn:2.15,live:3.3,offset:1.7,width:1.5,length:2.6,speed:.58,push:3.1,slip:.55,hop:.25},
      obstacles:[{style:8,key:'frog-crossing',name:'Bullfrog crossing',u:.555,side:-1,period:10.8,warn:1.75,live:3.75,offset:1.2,width:.76,length:.75,push:5.9,hop:.24}],
      tip:'A bullfrog crosses the boardwalk in four hops and can knock you backward. Watch its landing spot, then steer clear of the geyser at the final pond.'
    },
    {
      name:'Tempest Treetops',line:['Tempest','Treetops'],region:'The Stormwood',place:'Stormwood canopy',
      level:'Expert',surface:'Timber trestle & slate',length:1420,
      feature:'Climb the zigzag trestle, race high above the lower loop, then brake for the descent through the storm gates.',
      anchors:[[-108,-66],[-116,-31],[-93,0],[-66,21],[-32,15],[0,0],[33,-18],[53,-43],[77,-58],[109,-42],[116,-9],[104,21],[78,48],[42,66],[18,53],[9,25],[0,0],[-12,-29],[-38,-34],[-49,-63],[-80,-80]],
      section:[[0,20,6.2],[.13,25,5.2],[.22,36,4.65],[.31,37,4.9],[.41,30,5.2],[.51,23,5.4],[.63,17,4.9],[.72,12,4.5],[.80,11,5],[.88,15,5.1],[.96,19,6],[1,20,6.2]],
      fork:[.41,.59,13,4.3,2.8],bridge:.22,drops:[[.11,.34],[.40,.65],[.73,.84]],
      hazard:{style:1,name:'Storm signal arm',u:.575,side:1,period:8.5,warn:2.2,live:3.2,offset:2.4,width:.58,length:.9,speed:.68,push:3.8},
      tip:'Keep to the middle of the exposed deck. Move off the signal arm’s path before it swings down.',
      ramps:[{id:'tempest-trestle',name:'Trestle lip',style:'trestle',branch:true,u:.49,lane:0,halfWidth:2.1,landingWidth:2.55,runup:8.2,rise:1.55,gap:2,landingRise:.88,landingLength:31,minSpeed:6}]
    }
  ];

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
