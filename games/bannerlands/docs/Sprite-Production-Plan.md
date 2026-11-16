# Painted sprite production across the whole roster

The rollout covers **every troop**, including ordinary troops, house specialists,
reinforcements, mounted units, commanders, giants and siege crews. It will be
completed in batches. A generated sheet is a draft until its directions, poses,
proportions and in-game presentation have been checked.

## One standard for every troop

- Eight independently authored directions for every troop: front, rear, both
  sides and four diagonals. Foot spears, pikes and halberds require sixteen.
- A unique original design for every troop type and each house-specific regiment variant.
  Identity comes from the head, shoulders, armor, clothing, equipment and stance,
  as well as the house colors.
- Complete painted PNG frames: body, hands, armor and carried equipment together.
  No shape-drawn soldiers, replacement weapons, procedural limbs or reload parts.
- Movement, turning, ready, attack, recovery, hit and death in every direction.
  Backward movement, brace/lowering, healing, loading and deployment are included
  wherever the troop uses those actions.
- Stable feet and consistent human body scale. Long weapons get more space;
  their wielders are not reduced to fit a small cell.
- The whole weapon, protective shield pose and projectile release must agree
  with combat. Missing art is recorded explicitly, never counted as complete.
- Full character animation in every direction: at least four walk phases,
  preferably eight; a clear attack windup/draw, contact/release and recovery;
  at least two hit phases, four death phases and four phases for applicable
  loading, healing and other special actions. One still pose per heading is a
  reference study, not an animated troop.

## Authoring sources and runtime assets

Generated pages are authoring sources. Artists can split a difficult gait,
loading mechanism or long-weapon action across pages while keeping the same
character identity. Page counts and source filenames are production details,
not a different asset system for each troop.

Mechanical packing collects the approved painted frames into compact
per-troop runtime atlases. All troops use one consistent schema: action,
direction, phase, foot anchor, measured body scale and equipment metadata.
The game loads those packed atlases; it does not need to load every source
page. Packing copies existing painted pixels and never constructs body parts,
weapons or replacement poses.

Review includes an actual animation loop and gameplay-size motion preview.
A contact sheet alone cannot demonstrate a correct walk, reload or fall.
Static direction baselines remain reference-only until their full character
animation cycles are ready. The machine-readable coverage audit tracks all
34 unit types and 38 current variants, including commanders, the king, giants,
siege units and house-specific shield/lance regiments.

## Rollout order

### Batch 1: original redesigns and ranged loading

Painted drafts are being generated and reviewed for these troops. The Ranger is
an uncovered, headband-wearing field scout with a short blue half-cape and large
satchel; it does not reuse the Huntsman's peaked cap or the Sharpshooter's armor.

| Troop | Distinctive design | Direction target |
| --- | --- | ---: |
| River Ranger | Red headband, short asymmetric blue cape, light leather, field satchel, compact bow | 8 |
| Sharpshooter | Closed steel helmet, broad blue-and-steel protection, heavy windlass crossbow, large bolt case | 8 |
| Hill Huntsman | Peaked green hunting cap, asymmetric mantle, red-and-green panels, broad quiver, longbow | 8 |
| Tollhouse Crossbow | Broad flat helmet, square shoulders, blue-grey split tabard, twin towers, stirrup lever | 8 |
| Vale Sentinel | Slim falcon helmet, white/silver/blue, narrow cape, low firing stance, compact lever | 8 |
| Gilded Crossbow | Rounded gold-crested helmet, crimson and gold, belt-spanning mechanism | 8 |
| Winter Pikeman | Northern steel, short fur shoulders, blue-grey padded layers, long two-handed pike | 16 |
| Thornwall Pikeman | Leaf crest and pikehead, disciplined green-and-gold armor, planted stance | 16 |
| Horn Hill Halberdier | Broad breastplate, green mantle and red split cloth, complete axe/hook/point halberd | 16 |

The River Ranger is the first troop with a full eight-direction walking set of
eight phases per direction, alongside a motion preview at gameplay scale.
That establishes the first moving animation set for review; it does not finish
every attack, support, reaction and death check for the character or the roster.
Static design/direction references remain references, not completed troops.

**Open review items:** source frames sometimes repeat a right-facing profile in
the intended left-facing column. Those cells need new generated left-facing
frames. Pike drafts also need longer weapons before acceptance. Grid counts,
alpha transparency and visual direction are checked separately; a grid with
eight columns is not automatically eight verified directions.

### Batch 2: the remaining long weapons and mounted troops

| Troop or variant | Direction target | Required extra actions |
| --- | ---: | --- |
| Frey Bridge Warden | 16 | Lower, brace, thrust, backward march |
| Bolton Dread Pike | 16 | Lower, brace, thrust, backward march |
| Reed Crannog Spearhand | 16 | Lower, lighter planted guard, thrust, backward march |
| Martell Dune Skirmisher | 8 | Javelin preparation, release, recovery |
| Ordinary Cavalry | 8 | Horse movement, couched lance, charge, recovery |
| Baratheon Storm Rider | 8 | Mounted lance and charge |
| Tyrell Thorn Lancer | 8 | Mounted lance and charge |
| Mormont Lance Champion | 8 | Unique bear-house rider/horse, lance and charge |
| Martell Lance Champion | 8 | Unique sun-house rider/horse, lance and charge |
| Arryn Lance Champion | 8 | Unique falcon-house rider/horse, lance and charge |
| Martell Sun Horse Archer | 8 | Mounted bow draw, release, recovery |

### Batch 3: foot soldiers, shields and remaining specialists

| Troop or variant | Direction target | Design/action requirement |
| --- | ---: | --- |
| Ordinary Swordsman | 8 | Complete sword/shield, raised/lowered guard, block and attack |
| Ordinary Archer | 8 | Complete bow draw/release, quiver and carrying frames |
| Stark Winter Guard | 8 | Distinct northern shield guard, preserving its own identity |
| Lannister Shield Bearer | 8 | Heavy red/gold shield equipment and guard poses |
| Targaryen Shield Bearer | 8 | Dark angular armor and dragon-marked heavy shield |
| Ironborn Reaver | 8 | Weathered sea-raider silhouette and axe handling |
| Mormont Bear Mauler | 8 | Bear-house fur/armor silhouette and heavy weapon handling |
| Reed Crannog Hunter | 8 | Distinct marsh hunter, bow draw/release |
| Free Folk Berserker | 8 | Distinct fur/bare-arm silhouette and full attack/reaction poses |
| Baratheon Stormbreaker | 8 | Complete hammer windup, impact and recovery |
| Saltwind Axethrower | 8 | Axe preparation, empty-hand release and retrieval |
| Commander | 8 | Distinct command silhouette, movement, attack and reactions |
| King | 8 | Complete crown-bearing frames, retaining commander scale |

### Batch 4: large units and siege crews

| Troop | Direction target | Required extra actions |
| --- | ---: | --- |
| Catapult | 8 | Travel, loading, firing and wreckage |
| Trebuchet | 8 | Packed travel, deployment, loading, firing and wreckage |
| Dragonfire Acolyte | 8 | Complete crew/equipment and firepot release |
| Beacon Engineer | 8 | Complete machine/crew preparation and bolt release |
| Giant | 8 | Full-body movement, club windup/contact/recovery and fall |

## How each batch is finished

1. Establish a separate painted design for each troop and house variant.
2. Generate complete action/direction sheets from that troop's own design.
3. Inspect the actual figures. Record missing or incorrect views and regenerate
   those cells; do not manufacture a direction by drawing new body parts.
4. Measure frame rectangles, standing body height and foot anchors from the PNG.
   Mechanical slicing uses the painted pixels without changing the artwork.
5. Check the full equipment through each action, including completed crossbow
   loading stages while carrying the weapon.
6. Preview all directions and actions at normal battlefield zoom, then check the
   actual game, portraits, interruptions and lower graphics settings.
7. Mark that troop verified only after visual and animation checks pass. Keep the
   pull request a draft while the roster-wide rollout remains incomplete.

The machine-readable coverage report and source manifest sit beside the painted
assets. Existing painted PNGs remain available while replacement sets are under
review. The current batch does **not** imply that the entire roster has already
received its final directional animation set.
