/* Cinder Relay | weapons awarded by the forge after a round. */
(() => {
  'use strict';

  const weapons = [
    {
      forgeId:'starbreaker', forgeTier:'Mythic', name:'Starbreaker', family:'Precision', color:'#89f5ef',
      desc:'Fire a wide stellar lance that pierces whole formations and crushes armored targets.',
      damage:125, rate:1.3, mag:7, reload:1.25, range:840, speed:1400
    },
    {
      forgeId:'red-dwarf', forgeTier:'Mythic', name:'Red Dwarf', family:'Ordnance', color:'#ff795a',
      desc:'Seed a collapsing star. It pulls a crowd into its core, then detonates in a burning supernova.',
      damage:165, rate:.72, mag:4, reload:1.65, range:580, speed:650, pointTargeted:true
    },
    {
      forgeId:'thunderhead', forgeTier:'Mythic', name:'Thunderhead', family:'Assault', color:'#a5b8ff',
      desc:'Rake the front line with lightning that forks through nearby enemies and rattles their shields.',
      damage:50, rate:4.25, mag:27, reload:1.2, range:500, speed:1250
    },
    {
      forgeId:'winter-crown', forgeTier:'Mythic', name:'Winter Crown', family:'Scatter', color:'#a9eaff',
      desc:'Sweep a glacier across the enemies in front of you. The next blast shatters surviving frozen foes.',
      damage:76, rate:2.3, mag:9, reload:1.3, range:240, speed:760
    },
    {
      forgeId:'seraph-foundry', forgeTier:'Mythic', name:'Seraph Foundry', family:'Fabricator', color:'#adffc3',
      desc:'Print automated siege prisms that lock beams onto nearby enemies. Up to three prisms can fire at once per pilot.',
      damage:50, rate:.95, mag:5, reload:1.55, range:430, speed:720, pointTargeted:true
    },
    {
      forgeId:'god-gun', forgeTier:'God', name:'God Gun', family:'Emitter', color:'#ffda83',
      desc:'Hold fire to sustain a straight, piercing beam of white-gold light. Its aura burns nearby foes and erases ordinary enemy fire.',
      damage:44, rate:9.6, mag:42, reload:1.35, range:950, speed:1450, heat:true
    }
  ];

  window.CinderMythicGear = {weapons};
})();
