(function () {
  'use strict';
  const C = window.OW.Content;
  const roles = [
    ['hookclaw_skirmisher', 'Hookclaw Skirmisher', 76, 12, 226, 260, '#ef9a75', 'Two hooked blades cut in sequence. Step sideways after the first cut, then punish its landing.'],
    ['rivet_guard', 'Rivet Guard', 115, 16, 155, 126, '#eac090', 'Bait the shield sweep, flank it, or break its guard with an impact weapon.'],
    ['signal_sergeant', 'Signal Sergeant', 92, 12, 176, 540, '#f2bb64', 'Signal wires order two allies to fire. Hit the caller during the count or hide behind cover.'],
    ['glasswind_sharpshot', 'Glasswind Sharpshot', 71, 15, 175, 620, '#bacde8', 'Cross its locked lane after the sights stop moving. Both shots travel along that lane.'],
    ['sluice_warden', 'Sluice Warden', 108, 14, 166, 265, '#7fddcd', 'Move upstream of the fan and avoid the striped drain. Close in during the dry interval.'],
    ['lantern_stalker', 'Lantern Stalker', 84, 16, 206, 350, '#e3acdc', 'Break sight to mislead its search. Leave the lantern stamp before it lands.']
  ];
  C.reconEnemyTypes = {};
  roles.forEach(([id, name, hp, damage, speed, range, color, hint], artRow) => {
    const enemy = {id, name, hp, damage, speed, range, color, hint, role:id, reconRole:true, artRow, artKey:'reconPatrol', xp:38 + artRow * 4, fireRate:1};
    C.reconEnemyTypes[id] = C.enemies.length;
    C.enemies.push(enemy);
  });
  // Compress the late ordinary health curve. Saved actors retain their health
  // fraction through ensureEnemyScaling, including pre-scale and legacy actors.
  const originalScaling = C.enemyScaling;
  C.enemyScaling = function (region, legacy = false) {
    const scale = originalScaling(region, legacy);
    if (legacy) return scale;
    return {health: 0.84 * Math.pow(scale.health, 0.79), damage: 0.9 * Math.pow(scale.damage, 0.48)};
  };
  const whisker = C.bosses.find(b => b.id === 'adolph_whisker');
  whisker.hp = 9500;
  whisker.attackHints = [
    'Command duel · cross the locked dash or double volley, then counter.',
    'Signal network · shoot the relay to interrupt the broken ring. Its open wedge is safe.',
    'False retreat · leave the marked landing and deal with the signal escort.',
    'Last stand · anticipate the double shot and the following landing, then attack together.'
  ];
  const poster = C.bossPosters?.find(p => p.bossId === whisker.id);
  if (poster) poster.attackHints = whisker.attackHints;
})();
