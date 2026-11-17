(function () {
  'use strict';
  const C = window.OW.Content;
  C.trailEnemyTypes = {};
  const enemies = [
    {id:'gallows_bell', name:'Gallows Bell Rat', hp:138, damage:15, speed:84, range:265, xp:46,
      color:'#efbe72', image:'gallows-bell', hint:'The cracked bell shakes an amber ring. Run beneath the bell or beyond the outer chalk line before it tolls.'},
    {id:'seam_ripper', name:'Seam Ripper', hp:92, damage:18, speed:134, range:380, xp:43,
      color:'#f4a5a3', image:'seam-ripper', hint:'The shears click twice before a straight dash. Leave the stitched lane, then strike while its jaws are stuck.'}
  ];
  for (const spec of enemies) {
    C.trailEnemyTypes[spec.id] = C.enemies.length;
    C.enemies.push({...spec, role:spec.id, trailEnemy:true, fireRate:.65});
  }
})();
