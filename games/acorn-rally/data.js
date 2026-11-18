'use strict';
window.RallyData = {
  tracks: [
    {name:'Hoh Root Run',line:['Hoh','Root Run'],region:'Washington, USA',place:'Olympic Peninsula, Washington',level:'Beginner',length:840,surface:'Forest floor',feature:'Cross a fallen nurse log, dive beneath its roots, and drift through the mossy glade.',shape:'M16 27 C9 16 20 8 33 12 S49 6 58 7 Q76 6 74 18 Q72 25 82 27 Q95 34 82 43 Q76 47 68 40 L57 34 Q49 29 42 40 Q34 53 26 44 Z'},
    {name:'Bamboo Bell Run',line:['Bamboo','Bell Run'],region:'Kyoto, Japan',place:'Saga–Arashiyama, Kyoto',level:'Intermediate',length:900,surface:'Timber & gravel',feature:'Thread the bamboo gates and choose between a wet timber catwalk and the broad riverbank.',shape:'M10 37 Q5 25 22 24 Q34 23 28 14 Q23 5 46 8 L67 11 Q82 13 83 23 L85 34 Q85 44 68 41 L53 33 Q46 29 40 40 Q30 51 17 44 Z'},
    {name:'Sluice Sprint',line:['Sluice','Sprint'],region:'Kinderdijk, Netherlands',place:'Kinderdijk, Netherlands',level:'Intermediate',length:930,surface:'Brick & wet deck',feature:'Race along canal dikes, time the low sluice crossing, and sweep around the windmill.',shape:'M10 32 L36 10 Q41 7 54 9 L82 12 Q94 15 84 24 L62 36 Q51 44 43 36 L38 30 Q34 25 29 32 L21 41 Q11 48 10 32 Z'},
    {name:'Finbreak Canyon',line:['Finbreak','Canyon'],region:'Utah, USA',place:'Moab, Utah',level:'Advanced',length:1000,surface:'Sandstone & sand',feature:'Slalom through sandstone fins, bank beneath the arch, and brake for the twin hairpins.',shape:'M11 31 Q5 18 21 13 L35 8 Q43 6 47 16 Q53 24 59 14 Q65 3 74 10 L87 26 Q94 39 82 42 Q75 44 69 33 Q63 23 56 34 L50 43 Q42 51 32 44 Z'},
    {name:'Mirror Saltway',line:['Mirror','Saltway'],region:'Uyuni, Bolivia',place:'Salar de Uyuni, Bolivia',level:'Intermediate',length:1020,surface:'Salt crust & water',feature:'Carry speed across dry salt, cut through the mirror basin, and line up the weir chicane.',shape:'M8 30 Q3 20 18 15 L61 7 Q74 5 82 16 Q93 29 78 36 L54 44 Q45 46 39 38 Q36 29 28 34 Q15 43 8 30 Z'},
    {name:'Chimney Spiral',line:['Chimney','Spiral'],region:'Cappadocia, Türkiye',place:'Cappadocia, Türkiye',level:'Expert',length:1100,surface:'Chalky ridge',feature:'Descend between capped pinnacles, take the workshop tunnel, and climb the switchbacks.',shape:'M12 28 Q10 16 25 11 Q43 3 50 15 Q54 24 64 15 Q74 3 84 15 Q94 28 78 35 Q67 40 59 33 Q51 26 46 38 Q40 49 29 42 Q24 37 20 40 Q10 43 12 28 Z'},
    {name:'Cloudfall Canopy',line:['Cloudfall','Canopy'],region:'El Yunque, Puerto Rico',place:'El Yunque, Puerto Rico',level:'Advanced',length:1030,surface:'Trestle & stone',feature:'Drop through fern canopies, leap the ravine, and climb the trestle around a giant trunk.',shape:'M11 21 Q16 9 29 14 Q38 21 45 12 Q54 2 63 12 Q69 22 79 20 Q92 19 87 32 Q82 43 68 37 Q59 33 50 42 Q34 51 28 40 Q24 33 18 34 Q7 35 11 21 Z'},
    {name:'Basalt Breakwater',line:['Basalt','Breakwater'],region:'Vík, Iceland',place:'Vík, Iceland',level:'Expert',length:1100,surface:'Volcanic sand',feature:'Follow the retreating surf through basalt gates and climb back onto the grassy headland.',shape:'M10 29 Q8 18 23 14 L45 7 Q52 7 55 16 Q59 25 66 17 Q76 6 84 17 Q93 28 79 37 Q67 47 55 39 Q46 32 38 40 Q28 49 18 40 Z'}
  ],
  drivers: [
    {name:'Nib',species:'Mouse',kart:'Spool Runner',ability:'Needle Turn',color:'#ed814c',handling:'Quick steering and nimble direction changes.',description:'A thread-spool chassis and bottle-cap hubs make tight lines through traffic Nib’s specialty.',abilityText:'Shake off burrs and thistle gusts, cut a tight line, then flick the other way for a switchback boost.',stats:[5,4,2]},
    {name:'Bristle',species:'Rat',kart:'Tin Rumbler',ability:'Shoulder Through',color:'#7fabd1',handling:'Stable in traffic, with a heavier shove on ordinary contact.',description:'A riveted tin body and a thick cork bumper keep Bristle steady when the pack crowds a corner.',abilityText:'Brace the brass bumpers. Your next contact delivers a heavy side check and an exit boost.',stats:[3,3,5]},
    {name:'Clover',species:'Rabbit',kart:'Reed Hopper',ability:'Springstep',color:'#bc95c9',handling:'Quick acceleration and a settled landing.',description:'A curved reed frame on spring suspension lets Clover gather speed as soon as a corner opens.',abilityText:'Spring over hazards and onto raised detours. Land straight on the accelerator for a second burst of speed.',stats:[4,5,3]},
    {name:'Tumble',species:'Squirrel',kart:'Pod Rocket',ability:'Berm Burst',color:'#79bbab',handling:'Sure-footed through long banked corners.',description:'A wide wooden axle keeps Tumble’s seedpod kart planted on the longest sweepers.',abilityText:'Hold a turn to charge your seedpod. Straighten the wheel to release it; a longer bank gives a stronger exit.',stats:[4,3,4]},
    {name:'Hazel',species:'Hedgehog',kart:'Chestnut Cruiser',ability:'Quill Fan',color:'#e8bc48',handling:'Planted and predictable through a crowded corner.',description:'Hazel carries a spiny silhouette into the grid on a chestnut-shell chassis trimmed in rally yellow.',abilityText:'Fire a ring of quills that shoves rivals across their lane and sweeps away enemy Burr Patches. In clear air, gain a short burst.',stats:[3,4,4]},
    {name:'Ember',species:'Fox',kart:'Foxglove Flyer',ability:'Slipstream Dash',color:'#e66659',handling:'Light, lively, and quick to take a new line.',description:'A low scarlet body leaves room for Ember’s white-tipped tail. The narrow chassis slips into a gap behind the kart ahead.',abilityText:'Dash into a rival’s slipstream. Pass the kart you locked onto before the dash ends to earn a second burst.',stats:[5,4,2]},
    {name:'Flint',species:'Badger',kart:'Rivet Ram',ability:'Ground Pound',color:'#a1ba66',handling:'Heavy and sure-footed with a wide stance.',description:'Flint’s riveted olive kart rides low on chunky tires, with a broad nose and a stout suspension.',abilityText:'Slam down to scatter rivals and shake off sap, burrs and thistle gusts. The center of the shockwave throws karts into the air.',stats:[2,3,5]},
    {name:'Mica',species:'Mole',kart:'Lantern Buggy',ability:'Tunnel Dash',color:'#81b6e8',handling:'Compact and nimble, with strong drive out of a slow bend.',description:'A brass headlamp lights the nose of Mica’s cobalt workshop buggy. Wide digging paws grip the little steering wheel.',abilityText:'Dig below hazards and rivals, clearing sap as you go. Erupt beneath a nearby rival for a shove and a burst.',stats:[4,5,2]},
    {id:'solstice',name:'Solstice',species:'Barn owl',kart:'Orrery',ability:'Golden Hour',color:'#6cd3c1',handling:'Balanced turn-in and brisk acceleration reward a clean racing line.',description:'Solstice pilots a midnight-teal roadster with a brass orbital hoop and a sun dial worked into its nose.',abilityText:'Follow the gold centerline for one and a half seconds. A clean run earns a sunburst boost and a three-second shield that absorbs one hit.',stats:[4,4,3]}
  ],
  icons:{
    flag:'<path d="M4 21V4m1 1c5-4 9 3 16-1v11c-7 4-11-3-16 1"/><path d="m7 5 3 .2v3H7zm3 3.2 3 1v3l-3-1zm3-2.2 3 .8v3l-3-.8zm3 3.8 3-.5v3l-3 .5z" fill="currentColor" stroke="none"/>',
    garage:'<path d="m3 10 9-6 9 6v10H3zM7 20v-7h10v7M8 16h8"/>',
    trophy:'<path d="M7 4h10v5c0 4-2 6-5 6s-5-2-5-6zM7 6H3v2q0 5 6 5m8-7h4v2q0 5-6 5m-3 2v4m-5 2h10m-8-2h6"/>',
    volume:'<path d="M3 9h4l5-4v14l-5-4H3zm12-1q4 4 0 8m3-11q7 7 0 14"/>',mute:'<path d="M3 9h4l5-4v14l-5-4H3zm13 0 5 6m0-6-5 6"/>',
    settings:'<path d="m9 4 1-2h4l1 2 2 1 2-.3 2 3-1 2v3l1 2-2 3-2-.3-2 1-1 2h-4l-1-2-2-1-2 .3-2-3 1-2v-3L3 8l2-3 2 .3z"/><circle cx="12" cy="11.5" r="3"/>',
    down:'<path d="m7 10 5 5 5-5"/>',left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    tune:'<path d="M3 7h7m4 0h7M3 17h11m4 0h3"/><circle cx="12" cy="7" r="2.5"/><circle cx="16" cy="17" r="2.5"/>',
    play:'<path d="m7 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
    check:'<path d="m5 12 4 4L20 5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
    lap:'<path d="M4 11a8 8 0 1 1 1 6m-2-6h5m-5 0V6"/>',
    road:'<path d="m7 3-4 18m14-18 4 18M12 4v3m0 4v3m0 4v3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',
    gamepad:'<path d="M7 6h10q3 0 4 5l1 5q0 4-3 3l-4-3H9l-4 3q-3 1-3-3l1-5q1-5 4-5Z"/><path d="M5 11h5m-2.5-2.5v5m9-3h.5m1.5 3h.5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    track:'<path d="m4 13 6-8q2-2 5 0l6 6q2 3-2 5l-4 2q-3 2-6 0l-4-1q-4-1-1-4Z"/>',
    tree:'<path d="m12 2-6 8h3l-5 7h16l-5-7h3zM12 17v5"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1m-9 4h7"/>'
  }
};
