# Painted troop action artwork

This folder contains 23 generated transparent PNG troop sheets with **370
authored character frames**, plus `pike-buildings.png` with the two new training
buildings. `prompts.json` records built-in image-generation prompts, final
sources and discarded/refined variants.

Every frame illustrates the complete character, including hands, equipment,
weapons and applicable shields. The game uses the original two graphical
facings: screen-right artwork and its horizontal mirror. Logical combat angles
do not select additional directional images.

| Group | Sheets |
| --- | --- |
| Bow and support | `river_ranger`, `hill_huntsman` |
| Crossbows | `gilded_crossbow`, `tollhouse_crossbow`, `sharpshooter`, `vale_sentinel` |
| Foot polearms | `winter_pikeman`, `thornwall_pikeman`, `hornhill_halberdier`, `bridge_warden`, `dread_pike`, `crannog_spearhand` |
| Javelins | `dune_skirmisher` |
| Mounted lances | `cavalry`, `storm_rider`, `thorn_lancer`, `bear_lance_champion`, `sun_lance_champion`, `falcon_lance_champion` |
| Shields | `infantry`, `winter_guard`, `lion_shield_bearer`, `dragon_shield_bearer` |

Most sheets contain four rows of four actions. Gilded Crossbows and Tully
Sharpshooters have a five-pose loading row and 17 total frames each. The
authoritative action indices and troop/house mapping are in
`../../painted-troops.js`.

`../../painted-frame-bounds.js` records the measured transparent gutters of each
final image. Generated rows and columns are not assumed perfectly equal.
Extraction normalizes very low-alpha padding, crops the actual illustrated
frames and caches them. Standing body height controls scale; long weapons keep
their complete bounds. The two pike regiments use long two-handed pikes and have
no inherited heavy shields. The new Vale Sentinel also has no oversized back
shield.

The renderer selects complete authored movement, combat, loading, guard, impact
and death poses. It does not draw replacement hands, shields or long weapons
over these soldiers. Selection rings, exact facing indicators, formation
footprints and released projectiles remain separate battlefield elements.

Validation combines the actual browser renderer, native raster tests and direct
visual inspection. The browser check covers every identity, transparent pixels,
frame gutters, distinct poses, action selection, consistent scale, foot anchors,
mirroring and paused animation. The final visual review includes the full
contact sheet and a focused River Ranger review; repaired cavalry transparency,
mounted gutters and Huntsman death-pose spacing were inspected after refinement.
