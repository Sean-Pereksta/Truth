/* Cinder Relay | cat and unicorn equipment catalog extensions. */
(() => {
  'use strict';

  const weapons = [
    {
      creatureId:'cat-spawner', creatureClass:'cat', name:'Cat Spawner', family:'Fabricator', color:'#ffb55e',
      desc:'Deploy a carrier that releases three hunting cats. Each cat chases enemies and bites until its timer runs out.',
      damage:16, rate:.48, mag:4, reload:2.1, range:280, speed:220, pointTargeted:true
    },
    {
      creatureId:'cat-launcher', creatureClass:'cat', name:'Cat Launcher', family:'Ordnance', color:'#ff986a',
      desc:'Launch a fast, spinning cat that hits one target hard and splashes nearby enemies.',
      damage:51, rate:1.8, mag:7, reload:1.55, range:490, speed:565
    },
    {
      creatureId:'catana', creatureClass:'cat', name:'Catana', family:'Scatter', color:'#ffd58a',
      desc:'Cleave the enemies in front of you with a heavy close-range sweep, then launch a cat in your aiming direction.',
      damage:48, rate:1.55, mag:7, reload:1.35, range:350, speed:465
    },
    {
      creatureId:'unicorn-sniper', creatureClass:'unicorn', name:'Unicorn Sniper', family:'Precision', color:'#c5aaff',
      desc:'Fire a long-range horn lance that pierces a line of enemies. Hits are strongest on the first target.',
      damage:94, rate:1.05, mag:5, reload:1.65, range:820, speed:1320
    },
    {
      creatureId:'unicorn-stream', creatureClass:'unicorn', name:'Unicorn Stream', family:'Emitter', color:'#8eecee',
      desc:'Hold fire to send out a rapid, weaving stream of tiny unicorns that spreads over distance.',
      damage:10, rate:13, mag:44, reload:1.45, range:390, speed:560, heat:true
    },
    {
      creatureId:'rainbow-laser', creatureClass:'unicorn', name:'Rainbow Laser', family:'Emitter', color:'#f5a2ed',
      desc:'Hold fire to sustain a rainbow beam that burns multiple enemies along its path and vents when overheated.',
      damage:13, rate:8.3, mag:38, reload:1.9, range:440, speed:960, heat:true
    },
    {
      creatureId:'rainbow-exploder', creatureClass:'unicorn', name:'Rainbow Exploder', family:'Ordnance', color:'#ffb685',
      desc:'Fire a prism bomb that bursts on impact or at maximum range. Enemies near the center take the hardest hit.',
      damage:77, rate:1.28, mag:5, reload:1.75, range:465, speed:500
    }
  ];

  const armors = [
    {
      creatureId:'cat-armor', creatureClass:'cat', name:'Cat Armor Set', role:'Cat weapon specialist', color:'#ffb55e',
      damageBonus:.30
    },
    {
      creatureId:'unicorn-armor', creatureClass:'unicorn', name:'Unicorn Armor Set', role:'Unicorn weapon specialist', color:'#c5aaff',
      damageBonus:.30
    }
  ].map(suit => ({
    ...suit,
    desc:'Deal '+Math.round(suit.damageBonus*100)+'% more damage with '+suit.creatureClass+' weapons.'
  }));

  window.CinderCreatureGear = {weapons, armors};
})();
